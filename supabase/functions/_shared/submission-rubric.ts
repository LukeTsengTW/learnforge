import { AI_MODEL, GRADING_REASONING_EFFORT } from './ai-config.ts'
import { AiProviderError, callOpenAI, parseProviderEnvelope, type ProviderUsage } from './ai-provider.ts'
import type { TutorQuestionContext } from './ai-tutor.ts'

export type SubmissionRubricQuestionType = 'calculation' | 'drawing'
export type SubmissionRubricCriterionStatus = 'full' | 'partial' | 'none'
export interface SubmissionRubricCriterion {
  criterionId: string
  awardedScore: number
  maxScore: number
  status: SubmissionRubricCriterionStatus
  feedback: string
}
export interface SubmissionRubricOutput {
  score: number
  maxScore: number
  criteria: SubmissionRubricCriterion[]
  confidence: 'high' | 'medium' | 'low'
  summary: string
  strengths?: string[]
  improvements?: string[]
  observations?: string[]
  missingOrUnclear?: string[]
}
export interface SubmissionRubricJudgment extends SubmissionRubricOutput {
  questionId: string
  questionType: SubmissionRubricQuestionType
  answerHash: string
}
export interface SubmissionRubricProviderResult {
  output: SubmissionRubricOutput
  responseId: string | null
  usage: ProviderUsage
}

const CRITERION_KEYS = ['criterionId', 'awardedScore', 'maxScore', 'status', 'feedback'] as const
const confidenceValues = ['high', 'medium', 'low'] as const
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-8

function outputKeys(type: SubmissionRubricQuestionType) {
  return type === 'calculation'
    ? ['score', 'maxScore', 'criteria', 'confidence', 'summary', 'strengths', 'improvements'] as const
    : ['score', 'maxScore', 'criteria', 'confidence', 'summary', 'observations', 'missingOrUnclear'] as const
}

export function submissionRubricSchema(type: SubmissionRubricQuestionType) {
  const properties: Record<string, unknown> = {
    score: { type: 'number' }, maxScore: { type: 'number' },
    criteria: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: [...CRITERION_KEYS], properties: {
        criterionId: { type: 'string' }, awardedScore: { type: 'number' }, maxScore: { type: 'number' },
        status: { type: 'string', enum: ['full', 'partial', 'none'] }, feedback: { type: 'string' },
      } } },
    confidence: { type: 'string', enum: [...confidenceValues] }, summary: { type: 'string' },
  }
  if (type === 'calculation') {
    properties.strengths = { type: 'array', items: { type: 'string' } }
    properties.improvements = { type: 'array', items: { type: 'string' } }
  } else {
    properties.observations = { type: 'array', items: { type: 'string' } }
    properties.missingOrUnclear = { type: 'array', items: { type: 'string' } }
  }
  return { type: 'object', additionalProperties: false, required: [...outputKeys(type)], properties }
}

function validCanonicalContext(question: TutorQuestionContext, type: SubmissionRubricQuestionType): boolean {
  const rubric = question.gradingRubric
  if (question.type !== type || !finite(question.points) || question.points <= 0
    || typeof question.referenceAnswer !== 'string' || !question.referenceAnswer.trim()
    || !question.solution.trim() || !Array.isArray(rubric) || rubric.length < 1 || rubric.length > 20
    || !rubric.every((item, index) => item.id === `r${index + 1}`
      && finite(item.points) && item.points > 0 && !!item.description.trim())
    || !close(rubric.reduce((sum, item) => sum + item.points, 0), question.points)) return false
  if (type === 'drawing') return !!question.drawing
    && Number.isInteger(question.drawing.width) && Number.isInteger(question.drawing.height)
    && question.drawing.width >= 100 && question.drawing.height >= 100
    && question.drawing.width <= 2000 && question.drawing.height <= 2000
  return true
}

const boundedList = (value: unknown, maxItems: number, maxLength: number): value is string[] =>
  Array.isArray(value) && value.length <= maxItems
    && value.every((item) => typeof item === 'string' && item.length <= maxLength)

/** Validate untrusted JSON against the exact server-owned rubric before it can affect a score. */
export function validateSubmissionRubricOutput(value: unknown, question: TutorQuestionContext,
  type: SubmissionRubricQuestionType): SubmissionRubricOutput | null {
  if (!validCanonicalContext(question, type) || !record(value) || !exactKeys(value, outputKeys(type))
    || !finite(value.score) || !finite(value.maxScore) || value.maxScore !== question.points
    || value.score < 0 || value.score > question.points || !Array.isArray(value.criteria)
    || value.criteria.length !== question.gradingRubric!.length
    || !confidenceValues.includes(value.confidence as typeof confidenceValues[number])
    || typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 2000) return null
  if (type === 'calculation') {
    if (!boundedList(value.strengths, 5, 400) || !boundedList(value.improvements, 5, 400)) return null
  } else if (!boundedList(value.observations, 8, 400) || !boundedList(value.missingOrUnclear, 8, 400)) return null

  let score = 0
  const criteria: SubmissionRubricCriterion[] = []
  for (let index = 0; index < value.criteria.length; index++) {
    const criterion = value.criteria[index]
    const canonical = question.gradingRubric![index]
    if (!record(criterion) || !exactKeys(criterion, CRITERION_KEYS)
      || criterion.criterionId !== canonical.id || criterion.maxScore !== canonical.points
      || !finite(criterion.awardedScore) || criterion.awardedScore < 0 || criterion.awardedScore > canonical.points
      || !['full', 'partial', 'none'].includes(String(criterion.status))
      || typeof criterion.feedback !== 'string' || !criterion.feedback.trim() || criterion.feedback.length > 800) return null
    const awarded = criterion.awardedScore
    if ((criterion.status === 'full' && !close(awarded, canonical.points))
      || (criterion.status === 'partial' && !(awarded > 0 && awarded < canonical.points))
      || (criterion.status === 'none' && !close(awarded, 0))) return null
    score += awarded
    criteria.push({ criterionId: canonical.id, awardedScore: awarded, maxScore: canonical.points,
      status: criterion.status as SubmissionRubricCriterionStatus, feedback: criterion.feedback })
  }
  if (!close(score, value.score)) return null
  return { score: value.score, maxScore: value.maxScore, criteria,
    confidence: value.confidence as SubmissionRubricOutput['confidence'], summary: value.summary,
    ...(type === 'calculation' ? { strengths: [...value.strengths as string[]], improvements: [...value.improvements as string[]] }
      : { observations: [...value.observations as string[]], missingOrUnclear: [...value.missingOrUnclear as string[]] }) }
}

export function createSubmissionRubricRequest(question: TutorQuestionContext, type: SubmissionRubricQuestionType,
  instructions: string, formatName: string, content: string | readonly Record<string, unknown>[], maxOutputTokens: number) {
  if (!validCanonicalContext(question, type) || !Number.isInteger(maxOutputTokens) || maxOutputTokens < 1) {
    throw new Error('Invalid submission rubric context')
  }
  return {
    model: AI_MODEL, reasoning: { effort: GRADING_REASONING_EFFORT }, store: false,
    max_output_tokens: maxOutputTokens,
    instructions,
    input: [{ role: 'user', content }],
    text: { format: { type: 'json_schema', name: formatName, strict: true, schema: submissionRubricSchema(type) } },
  }
}

export function parseSubmissionRubricProviderResponse(providerRaw: unknown, question: TutorQuestionContext,
  type: SubmissionRubricQuestionType): SubmissionRubricProviderResult {
  const envelope = parseProviderEnvelope(providerRaw)
  if (envelope.kind === 'refusal') throw new AiProviderError('malformed')
  let parsed: unknown
  try { parsed = JSON.parse(envelope.text!) } catch { throw new AiProviderError('malformed') }
  const output = validateSubmissionRubricOutput(parsed, question, type)
  if (!output) throw new AiProviderError('malformed')
  return { output, responseId: envelope.responseId, usage: envelope.usage }
}

export async function callSubmissionRubricProvider(apiKey: string, request: unknown,
  question: TutorQuestionContext, type: SubmissionRubricQuestionType, fetcher: typeof fetch = fetch): Promise<SubmissionRubricProviderResult> {
  return parseSubmissionRubricProviderResponse(await callOpenAI(request, apiKey, fetcher), question, type)
}

export function parseStoredSubmissionRubricJudgment(value: unknown, question: TutorQuestionContext,
  type: SubmissionRubricQuestionType): SubmissionRubricJudgment | null {
  if (!record(value) || !exactKeys(value, ['questionId', 'questionType', 'answerHash', ...outputKeys(type)])
    || value.questionId !== question.questionId || value.questionType !== type
    || typeof value.answerHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.answerHash)) return null
  const output = validateSubmissionRubricOutput(Object.fromEntries(outputKeys(type).map((key) => [key, value[key]])), question, type)
  return output ? { questionId: question.questionId, questionType: type, answerHash: value.answerHash, ...output } : null
}

export function submissionRubricPayload(judgment: SubmissionRubricJudgment): Record<string, unknown> {
  return { questionId: judgment.questionId, questionType: judgment.questionType, answerHash: judgment.answerHash,
    score: judgment.score, maxScore: judgment.maxScore, criteria: judgment.criteria,
    confidence: judgment.confidence, summary: judgment.summary,
    ...(judgment.strengths ? { strengths: judgment.strengths } : {}),
    ...(judgment.improvements ? { improvements: judgment.improvements } : {}),
    ...(judgment.observations ? { observations: judgment.observations } : {}),
    ...(judgment.missingOrUnclear ? { missingOrUnclear: judgment.missingOrUnclear } : {}) }
}

export type { ProviderUsage }
