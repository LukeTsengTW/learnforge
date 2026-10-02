import { gradeQuizV3, gradeQuizV4 } from '../../../src/lib/grading.ts'
import { isV4BlankText } from '../../../src/lib/v4-blank.ts'
import type { AnswerMap, GradeResult, TrustedFillJudgment, TrustedRubricJudgment } from '../../../src/models/attempt.ts'
import type { DraftAnswerMapV4 } from '../../../src/models/draft-v4.ts'
import type { Quiz, Question } from '../../../src/models/quiz.ts'
import { AiProviderError, type ProviderUsage } from '../_shared/ai-provider.ts'
import { DrawingRasterError, rasterizeStoredDrawing } from '../_shared/drawing-raster.ts'
import { tutorContext, TutorInputError, readBoundedJson, type TutorQuestionContext } from '../_shared/ai-tutor.ts'
import { answerHash, normalizeStoredAnswers, parseFillJudgment, parseFillVerdict,
  parseSubmissionInput, ruleFillStatus, type FillJudgment, type FillProvider, type StoredAnswerRow,
  type SubmissionInput } from '../_shared/semantic-fill.ts'
import { GRADING_ANSWER_MAX_BYTES, type SubmissionCalculationProvider,
  type SubmissionCalculationV4Provider } from '../_shared/calculation-grading.ts'
import { canonicalizeSubmissionRubricV4, isCanonicalSubmissionRubricContextV4,
  isCanonicalSubmissionRubricV4 } from '../_shared/submission-rubric-v4.ts'
import type { SubmissionDrawingProvider } from '../_shared/drawing-analysis.ts'
import { DraftValidationError, normalizeDraftAnswersV4, type DraftQuestionContext } from '../_shared/draft-v4.ts'
import { parseStoredSubmissionRubricJudgment, type SubmissionRubricJudgment,
  type SubmissionRubricProviderResult, type SubmissionRubricQuestionType } from '../_shared/submission-rubric.ts'
import { GRADING_VERSION } from '../../../src/models/grading-version.ts'

export interface AttemptSnapshot {
  id: string
  user_id: string
  quiz_id: string
  quiz_revision: string
  status: string
  updated_at: string
  answer_schema_version: number
  grading_version: string
  submission_request_id: string | null
  deterministic_score: number | null
  deterministic_max_score: number | null
  correct_count: number | null
  partial_count: number | null
  incorrect_count: number | null
  unanswered_count: number | null
  answers: StoredAnswerRow[]
}
export interface PersistedFillJudgment extends FillJudgment { judgeVersion: string }
export interface PersistedRubricJudgment {
  question_id: string
  question_type: string
  answer_hash: string
  judge_version: string
  source: string
  status: string
  score: number
  max_score: number
  criteria: unknown
  confidence: string | null
  summary: string | null
  details: unknown
  model: string | null
  reasoning_effort: string | null
}
interface FillClaimInput {
  userId: string; attemptId: string; expectedUpdatedAt: string; questionId: string; answerHash: string; requestId: string
}
interface FillClaimResult {
  state: 'claimed' | 'cached' | 'in_progress' | 'conflict' | 'limited'
  claimToken?: string
  answerHash?: string
  verdict?: unknown
  confidence?: unknown
  reason?: unknown
}
export interface RubricClaimInput {
  userId: string
  attemptId: string
  expectedUpdatedAt: string
  requestId: string
  quizId: string
  quizRevision: string
  questionId: string
  questionType: SubmissionRubricQuestionType
  maxScore: number
  systemUnanswered: boolean
}
export interface RubricClaimResult {
  state: 'claimed' | 'cached' | 'in_progress' | 'conflict' | 'limited' | 'unanswered'
  claimToken?: string
  answerHash?: string
  response?: unknown
  providerResponseId?: string | null
}
export interface CanonicalSubmissionQuestion {
  questionId: string
  type: Question['type']
  points: number
  correctOptionId?: string
  correctOptionIds?: string[]
  correctAnswer?: string | boolean
  match?: 'exact' | 'case-insensitive'
  referenceAnswer?: string
  solution?: string
  drawing?: { width: number; height: number }
  rubric?: { criterionId: string; maxScore: number }[]
}
export interface FinalizeSubmissionInput {
  userId: string; attemptId: string; expectedUpdatedAt: string; requestId: string
  quizId: string; quizRevision: string; result: GradeResult; fillJudgments: FillJudgment[]
  rubricJudgments: TrustedRubricJudgment[]; questions: CanonicalSubmissionQuestion[]
}
/** PostgreSQL-computed active-only v4 identities for persisted rubric answers. */
export interface AnswerHashesV4 { answers: Record<string, string>; missing: string }

/** Schema-2 contract. Claim/finalize RPCs are the v4-only service functions. */
export interface SubmissionBackendV4 {
  calculationProvider: SubmissionCalculationV4Provider | null
  claimRubric(input: RubricClaimInput): Promise<RubricClaimResult>
  loadAnswerHashes(attemptId: string): Promise<AnswerHashesV4>
  finalize(input: FinalizeSubmissionInput): Promise<boolean>
}

export class SubmissionConflict extends Error {}
export interface SubmissionBackend {
  userId: string
  fillProvider: FillProvider | null
  calculationProvider: SubmissionCalculationProvider | null
  drawingProvider: SubmissionDrawingProvider | null
  loadAttempt(attemptId: string): Promise<AttemptSnapshot | null>
  loadFinalFillJudgments(attemptId: string): Promise<PersistedFillJudgment[]>
  loadFinalRubricJudgments(attemptId: string): Promise<PersistedRubricJudgment[]>
  claimFill(input: FillClaimInput): Promise<FillClaimResult>
  completeFill(claimToken: string, verdict: 'correct' | 'incorrect', confidence: 'high' | 'medium' | 'low',
    reason: string, responseId: string | null, usage: ProviderUsage): Promise<boolean>
  failFill(claimToken: string, errorCode: string): Promise<void>
  claimRubric(input: RubricClaimInput): Promise<RubricClaimResult>
  completeRubric(claimToken: string, judgment: SubmissionRubricJudgment,
    responseId: string | null, usage: ProviderUsage): Promise<boolean>
  failRubric(claimToken: string, errorCode: string): Promise<void>
  finalize(input: FinalizeSubmissionInput): Promise<boolean>
  v4?: SubmissionBackendV4
}
interface SubmissionContextLookup { listRevision(quizId: string, revision: string): readonly TutorQuestionContext[] }

export const AI_GRADING_UNAVAILABLE = 'AI 評分暫時無法完成，本次作答尚未提交，請稍後再試。'
export const INVALID_DRAFT_ANSWERS = '雲端草稿內容無效，作答尚未提交。請重新儲存答案後再試。'
const HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: HEADERS })
const unavailable = () => json({ code: 'service_unavailable', error: AI_GRADING_UNAVAILABLE }, 503)
const conflict = () => json({ code: 'conflict', error: '雲端草稿已變更，作答尚未提交。請確認答案後重試。' }, 409)
const invalidAnswers = () => json({ code: 'invalid_answers', error: INVALID_DRAFT_ANSWERS }, 422)
const HASH = /^[a-f0-9]{64}$/
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const rubricStatus = (score: number, maxScore: number) => score === maxScore ? 'correct' as const
  : score === 0 ? 'incorrect' as const : 'partial' as const

function exactQuiz(questions: readonly TutorQuestionContext[], quizId: string, revision: string): Quiz {
  if (!questions.length || questions.some((question, index) => question.questionIndex !== index
    || !Number.isFinite(question.points) || (question.points ?? 0) <= 0)) throw new Error('Invalid canonical quiz')
  const parsed: Question[] = questions.map((question) => {
    const base = { id: question.questionId, tags: [] as string[], points: question.points!, prompt: question.prompt,
      hint: question.hint, solution: question.solution,
      rubric: (question.gradingRubric ?? question.rubric.map((item, index) => ({
        id: `r${index + 1}`, points: item.score, description: item.description,
      }))).map((item) => ({ description: item.description, score: item.points })) }
    switch (question.type) {
      case 'single':
        if (!question.options || typeof question.correctOptionId !== 'string') throw new Error('Invalid single context')
        return { ...base, type: 'single', options: [...question.options], correctOptionId: question.correctOptionId }
      case 'multiple':
        if (!question.options || !question.correctOptionIds) throw new Error('Invalid multiple context')
        return { ...base, type: 'multiple', options: [...question.options], correctOptionIds: [...question.correctOptionIds] }
      case 'true-false':
        if (typeof question.correctAnswer !== 'boolean') throw new Error('Invalid true-false context')
        return { ...base, type: 'true-false', correctAnswer: question.correctAnswer }
      case 'fill':
        if (typeof question.correctAnswer !== 'string' || !question.match) throw new Error('Invalid fill context')
        return { ...base, type: 'fill', correctAnswer: question.correctAnswer, match: question.match }
      case 'calculation':
        if (typeof question.referenceAnswer !== 'string' || !question.gradingRubric) throw new Error('Invalid calculation context')
        // Only an exact future-capable revision declares drawing; historical calculations have none.
        return { ...base, type: 'calculation', referenceAnswer: question.referenceAnswer,
          ...(question.drawing === undefined ? {} : { drawing: { width: question.drawing.width, height: question.drawing.height } }) }
      case 'drawing':
        if (typeof question.referenceAnswer !== 'string' || !question.gradingRubric || !question.drawing) throw new Error('Invalid drawing context')
        return { ...base, type: 'drawing', referenceAnswer: question.referenceAnswer, drawing: { ...question.drawing } }
    }
  })
  return { id: quizId, revision, title: '', description: '', subject: '', tags: [], estimatedMinutes: 0,
    current: false, questions: parsed }
}

function toAnswerMap(questions: readonly TutorQuestionContext[], values: ReturnType<typeof normalizeStoredAnswers>): AnswerMap {
  const answerMap: Record<string, unknown> = {}
  for (const question of questions) {
    const answer = values[question.questionId]
    if (answer) answerMap[question.questionId] = answer
  }
  return answerMap as AnswerMap
}

function canonicalManifest(quiz: Quiz, includeCalculationDrawing = false): CanonicalSubmissionQuestion[] {
  return quiz.questions.map((question): CanonicalSubmissionQuestion => {
    const base: CanonicalSubmissionQuestion = { questionId: question.id, type: question.type, points: question.points }
    switch (question.type) {
      case 'single': return { ...base, correctOptionId: question.correctOptionId }
      case 'multiple': return { ...base, correctOptionIds: [...question.correctOptionIds] }
      case 'true-false': return { ...base, correctAnswer: question.correctAnswer }
      case 'fill': return { ...base, correctAnswer: question.correctAnswer, match: question.match }
      case 'calculation': return { ...base, referenceAnswer: question.referenceAnswer, solution: question.solution,
        ...(includeCalculationDrawing && question.drawing !== undefined ? { drawing: { ...question.drawing } } : {}),
        rubric: question.rubric.map((criterion, index) => ({ criterionId: `r${index + 1}`, maxScore: criterion.score! })) }
      case 'drawing': return { ...base, referenceAnswer: question.referenceAnswer, solution: question.solution,
        drawing: { ...question.drawing },
        rubric: question.rubric.map((criterion, index) => ({ criterionId: `r${index + 1}`, maxScore: criterion.score! })) }
    }
  })
}

function trustedFillJudgments(fillJudgments: readonly FillJudgment[]): TrustedFillJudgment[] {
  return fillJudgments.map(({ questionId, source, status, reason }) => ({ questionId, source, status, reason }))
}

function trustedPersistedRubric(row: PersistedRubricJudgment, question: TutorQuestionContext,
  version: typeof GRADING_VERSION.aiGradingV3 | typeof GRADING_VERSION.aiGradingV4 = GRADING_VERSION.aiGradingV3): TrustedRubricJudgment | null {
  if (row.judge_version !== version
    || (row.question_type !== 'calculation' && row.question_type !== 'drawing')
    || !/^[a-f0-9]{64}$/.test(row.answer_hash)
    || !Number.isFinite(row.score) || !Number.isFinite(row.max_score) || !isRecord(row.details)) return null
  const type = row.question_type
  if (row.source === 'system') {
    if (row.status !== 'unanswered' || row.score !== 0 || row.max_score !== question.points
      || !Array.isArray(row.criteria) || row.criteria.length !== 0
      || row.confidence !== null || row.summary !== null || row.model !== null || row.reasoning_effort !== null
      || Object.keys(row.details).length !== 0) return null
    return { questionId: row.question_id, questionType: type, answerHash: row.answer_hash,
      source: 'system', status: 'unanswered', score: 0, maxScore: row.max_score, criteria: [] }
  }
  if (row.source !== 'ai' || !['correct', 'partial', 'incorrect'].includes(row.status)
    || row.model !== 'gpt-6-luna' || row.reasoning_effort !== 'medium'
    || row.confidence === null || row.summary === null) return null
  const candidate = { questionId: row.question_id, questionType: type, answerHash: row.answer_hash,
    score: row.score, maxScore: row.max_score, criteria: row.criteria, confidence: row.confidence,
    summary: row.summary, ...row.details }
  const parsed = parseStoredSubmissionRubricJudgment(candidate, question, type)
  const derivedStatus = row.score === row.max_score ? 'correct' : row.score === 0 ? 'incorrect' : 'partial'
  if (!parsed || row.status !== derivedStatus) return null
  return { ...parsed, source: 'ai', status: derivedStatus, model: 'gpt-6-luna', reasoningEffort: 'medium' }
}

/** v4 cached/persisted AI evidence must already use the canonical v4 score precision. */
function isCanonicalV4Judgment(judgment: SubmissionRubricJudgment | TrustedRubricJudgment, question: TutorQuestionContext): boolean {
  const output = Object.fromEntries(Object.entries(judgment).filter(([key]) => !['questionId', 'questionType',
    'answerHash', 'source', 'status', 'model', 'reasoningEffort'].includes(key)))
  return (judgment.questionType === 'calculation' || judgment.questionType === 'drawing')
    && isCanonicalSubmissionRubricV4(output as never, question, judgment.questionType)
}

function resultMatchesAttempt(result: GradeResult, attempt: AttemptSnapshot): boolean {
  return result.score === attempt.deterministic_score && result.maxScore === attempt.deterministic_max_score
    && result.correctCount === attempt.correct_count && result.partialCount === attempt.partial_count
    && result.incorrectCount === attempt.incorrect_count && result.unansweredCount === attempt.unanswered_count
}

type FillRule = (question: TutorQuestionContext, text: string | undefined) => 'correct' | 'incorrect' | 'unanswered'
/** v4 fill blank classification uses the explicit v4 whitespace contract (matches SQL). */
const ruleFillStatusV4: FillRule = (question, text) =>
  text === undefined || isV4BlankText(text) ? 'unanswered' : ruleFillStatus(question, text)

/** Shared formal fill judging: rule first, semantic AI (semantic-fill-v2 cache) only on nonblank mismatch. */
async function judgeFills(backend: SubmissionBackend, input: SubmissionInput, attempt: AttemptSnapshot,
  questions: readonly TutorQuestionContext[], textOf: (questionId: string) => string | undefined,
  rule: FillRule): Promise<FillJudgment[] | Response> {
  const fillJudgments: FillJudgment[] = []
  for (const question of questions) {
    if (question.type !== 'fill') continue
    const text = textOf(question.questionId)
    const hash = await answerHash(text ?? '')
    const status = rule(question, text)
    if (status !== 'incorrect') {
      fillJudgments.push({ questionId: question.questionId, answerHash: hash, source: 'rule',
        status, confidence: null, reason: null })
      continue
    }
    const claim = await backend.claimFill({ userId: backend.userId, attemptId: attempt.id,
      expectedUpdatedAt: input.expectedUpdatedAt, questionId: question.questionId, answerHash: hash, requestId: input.requestId })
    if (claim.state === 'conflict') return conflict()
    if (claim.state === 'in_progress') return json({ code: 'in_progress' }, 202)
    if (claim.state === 'limited') return unavailable()
    if (claim.state === 'cached') {
      const verdict = parseFillVerdict({ verdict: claim.verdict, confidence: claim.confidence, reason: claim.reason })
      if (claim.answerHash !== hash || !verdict) return unavailable()
      fillJudgments.push({ questionId: question.questionId, answerHash: hash, source: 'ai',
        status: verdict.verdict, confidence: verdict.confidence, reason: verdict.reason })
      continue
    }
    if (claim.state !== 'claimed' || !claim.claimToken || claim.answerHash !== hash) return unavailable()
    if (!backend.fillProvider) {
      await backend.failFill(claim.claimToken, 'provider_unavailable').catch(() => undefined)
      return unavailable()
    }
    try {
      const judged = await backend.fillProvider.judge(question, text!)
      const verdict = parseFillVerdict(judged.verdict)
      if (!verdict || !await backend.completeFill(claim.claimToken, verdict.verdict, verdict.confidence,
        verdict.reason, judged.responseId, judged.usage)) throw new AiProviderError('malformed')
      fillJudgments.push({ questionId: question.questionId, answerHash: hash, source: 'ai',
        status: verdict.verdict, confidence: verdict.confidence, reason: verdict.reason })
    } catch (failure) {
      await backend.failFill(claim.claimToken, failure instanceof AiProviderError ? failure.code : 'server_error')
        .catch(() => undefined)
      return unavailable()
    }
  }
  return fillJudgments
}

async function persistedFillJudgments(rows: readonly PersistedFillJudgment[], questions: readonly TutorQuestionContext[],
  textOf: (questionId: string) => string | undefined, version: string): Promise<FillJudgment[] | null> {
  if (rows.length !== questions.filter((question) => question.type === 'fill').length) return null
  const fillJudgments: FillJudgment[] = []
  for (const row of rows) {
    const expectedHash = await answerHash(textOf(row.questionId) ?? '')
    if (row.judgeVersion !== version || row.answerHash !== expectedHash) return null
    const judgment = parseFillJudgment(row)
    if (!judgment) return null
    fillJudgments.push(judgment)
  }
  return fillJudgments
}

function draftContexts(questions: readonly TutorQuestionContext[]): DraftQuestionContext[] {
  return questions.map((question) => ({ questionId: question.questionId, type: question.type,
    ...(question.options ? { options: question.options } : {}),
    ...(question.drawing ? { drawing: { width: question.drawing.width, height: question.drawing.height } } : {}) }))
}

/** Strict formal schema-2 read of the raw persisted rows: no legacy calculation shape, no repair. */
function strictV4Answers(questions: readonly TutorQuestionContext[], rows: readonly StoredAnswerRow[]): DraftAnswerMapV4 {
  const raw: Record<string, unknown> = {}
  for (const row of rows) {
    if (!isRecord(row) || typeof row.question_id !== 'string' || Object.hasOwn(raw, row.question_id)) {
      throw new DraftValidationError('invalid')
    }
    raw[row.question_id] = row.answer
  }
  return normalizeDraftAnswersV4(draftContexts(questions), raw, false)
}

async function submitV3(backend: SubmissionBackend, input: SubmissionInput, attempt: AttemptSnapshot,
  questions: readonly TutorQuestionContext[]): Promise<Response> {
  const quiz = exactQuiz(questions, attempt.quiz_id, attempt.quiz_revision)
  const normalized = normalizeStoredAnswers(questions, attempt.answers)
  const answers = toAnswerMap(questions, normalized)
  const textOf = (questionId: string) => typeof normalized[questionId]?.text === 'string'
    ? normalized[questionId].text as string : undefined

  if (attempt.status === 'submitted') {
    const [persistedFill, persistedRubric] = await Promise.all([
      backend.loadFinalFillJudgments(attempt.id), backend.loadFinalRubricJudgments(attempt.id),
    ])
    const fillJudgments = await persistedFillJudgments(persistedFill, questions, textOf, GRADING_VERSION.aiGradingV3)
    if (!fillJudgments) return unavailable()
    const rubricJudgments: TrustedRubricJudgment[] = []
    for (const row of persistedRubric) {
      const question = questions.find((item) => item.questionId === row.question_id)
      if (!question) return unavailable()
      const judgment = trustedPersistedRubric(row, question)
      if (!judgment) return unavailable()
      rubricJudgments.push(judgment)
    }
    const result = gradeQuizV3(quiz, answers, trustedFillJudgments(fillJudgments), rubricJudgments)
    if (!resultMatchesAttempt(result, attempt)) return unavailable()
    return json({ attemptId: attempt.id, gradingVersion: GRADING_VERSION.aiGradingV3, result, cached: true })
  }

  const fillJudgments = await judgeFills(backend, input, attempt, questions, textOf, ruleFillStatus)
  if (fillJudgments instanceof Response) return fillJudgments

  const rubricJudgments: TrustedRubricJudgment[] = []
  for (const question of questions) {
    if (question.type !== 'calculation' && question.type !== 'drawing') continue
    const answer = normalized[question.questionId]
    let drawingPng: Uint8Array | null = null
    let systemUnanswered = false
    let claim: RubricClaimResult
    if (question.type === 'calculation') {
      if (answer && answer.type !== 'calculation') return unavailable()
      const text = typeof answer?.text === 'string' ? answer.text : ''
      systemUnanswered = !text.trim()
      claim = await backend.claimRubric({ userId: backend.userId, attemptId: attempt.id,
        expectedUpdatedAt: input.expectedUpdatedAt, requestId: input.requestId, quizId: attempt.quiz_id,
        quizRevision: attempt.quiz_revision, questionId: question.questionId,
        questionType: question.type, maxScore: question.points!, systemUnanswered })
    } else {
      if (answer && answer.type !== 'drawing') return unavailable()
      // Reserve before rasterizing persisted or empty strokes. Concurrent requests stop at
      // in_progress, and the per-attempt/user system bound covers expensive raster work.
      claim = await backend.claimRubric({ userId: backend.userId, attemptId: attempt.id,
        expectedUpdatedAt: input.expectedUpdatedAt, requestId: input.requestId, quizId: attempt.quiz_id,
        quizRevision: attempt.quiz_revision, questionId: question.questionId,
        questionType: question.type, maxScore: question.points!, systemUnanswered: false })
    }
    if (claim.state === 'conflict') return conflict()
    if (claim.state === 'in_progress') return json({ code: 'in_progress' }, 202)
    if (claim.state === 'limited') return unavailable()
    if (systemUnanswered) {
      if (claim.state !== 'unanswered' || !claim.answerHash || !/^[a-f0-9]{64}$/.test(claim.answerHash)) return unavailable()
      rubricJudgments.push({ questionId: question.questionId, questionType: question.type,
        answerHash: claim.answerHash, source: 'system', status: 'unanswered', score: 0,
        maxScore: question.points!, criteria: [] })
      continue
    }
    if (claim.state === 'cached') {
      if (!claim.answerHash) return unavailable()
      const cached = parseStoredSubmissionRubricJudgment(claim.response, question, question.type)
      if (!cached || cached.answerHash !== claim.answerHash) return unavailable()
      const status = cached.score === cached.maxScore ? 'correct' : cached.score === 0 ? 'incorrect' : 'partial'
      rubricJudgments.push({ ...cached, source: 'ai', status, model: 'gpt-6-luna', reasoningEffort: 'medium' })
      continue
    }
    if (claim.state !== 'claimed' || !claim.claimToken || !claim.answerHash
      || !/^[a-f0-9]{64}$/.test(claim.answerHash)) return unavailable()
    if (question.type === 'drawing') {
      try {
        const raster = await rasterizeStoredDrawing(answer ?? { type: 'drawing', strokes: [] }, question.drawing!)
        drawingPng = raster.png
      } catch (error) {
        await backend.failRubric(claim.claimToken, error instanceof DrawingRasterError ? `raster_${error.kind}` : 'raster_failed')
          .catch(() => undefined)
        if (error instanceof DrawingRasterError && error.kind === 'blank') {
          rubricJudgments.push({ questionId: question.questionId, questionType: question.type,
            answerHash: claim.answerHash, source: 'system', status: 'unanswered', score: 0,
            maxScore: question.points!, criteria: [] })
          continue
        }
        return unavailable()
      }
    }
    const provider = question.type === 'calculation' ? backend.calculationProvider : backend.drawingProvider
    if (!provider) {
      await backend.failRubric(claim.claimToken, 'provider_unavailable').catch(() => undefined)
      return unavailable()
    }
    try {
      const judged = question.type === 'calculation'
        ? await backend.calculationProvider!.generate(question, answer!.text as string)
        : await backend.drawingProvider!.generate(question, drawingPng!)
      const judgment: SubmissionRubricJudgment = { questionId: question.questionId, questionType: question.type,
        answerHash: claim.answerHash, ...judged.output }
      if (!await backend.completeRubric(claim.claimToken, judgment, judged.responseId, judged.usage)) {
        throw new AiProviderError('malformed')
      }
      const status = judgment.score === judgment.maxScore ? 'correct' : judgment.score === 0 ? 'incorrect' : 'partial'
      rubricJudgments.push({ ...judgment, source: 'ai', status, model: 'gpt-6-luna', reasoningEffort: 'medium' })
    } catch (failure) {
      await backend.failRubric(claim.claimToken, failure instanceof AiProviderError ? failure.code : 'server_error')
        .catch(() => undefined)
      return unavailable()
    }
  }

  const result = gradeQuizV3(quiz, answers, trustedFillJudgments(fillJudgments), rubricJudgments)
  const finalized = await backend.finalize({ userId: backend.userId, attemptId: attempt.id,
    expectedUpdatedAt: input.expectedUpdatedAt, requestId: input.requestId,
    quizId: attempt.quiz_id, quizRevision: attempt.quiz_revision, result, fillJudgments, rubricJudgments,
    questions: canonicalManifest(quiz) })
  if (!finalized) return conflict()
  return json({ attemptId: attempt.id, gradingVersion: GRADING_VERSION.aiGradingV3, result, cached: false })
}

async function submitV4(backend: SubmissionBackend, v4: SubmissionBackendV4, input: SubmissionInput,
  attempt: AttemptSnapshot, questions: readonly TutorQuestionContext[]): Promise<Response> {
  const quiz = exactQuiz(questions, attempt.quiz_id, attempt.quiz_revision)
  // Server-owned configuration preflight: the exact revision must satisfy the v4 rubric precision
  // invariant (the same exact rule as the SQL finalizer) before any claim, raster or provider work.
  // This is unavailable configuration, never a student answer error.
  if (questions.some((question) => (question.type === 'calculation' || question.type === 'drawing')
    && !isCanonicalSubmissionRubricContextV4(question))) return unavailable()
  // Formal finalization re-reads and revalidates the raw persisted answers against the exact
  // revision; an earlier save-quiz-draft validation is never treated as permanent authority.
  let answers: DraftAnswerMapV4
  try { answers = strictV4Answers(questions, attempt.answers) }
  catch (error) {
    if (error instanceof DraftValidationError) return attempt.status === 'draft' ? invalidAnswers() : unavailable()
    throw error
  }
  const textOf = (questionId: string) => {
    const answer = answers[questionId]
    return answer?.type === 'fill' ? answer.text : undefined
  }

  if (attempt.status === 'submitted') {
    const [persistedFill, persistedRubric, hashes] = await Promise.all([
      backend.loadFinalFillJudgments(attempt.id), backend.loadFinalRubricJudgments(attempt.id),
      v4.loadAnswerHashes(attempt.id),
    ])
    if (!isRecord(hashes) || !isRecord(hashes.answers) || typeof hashes.missing !== 'string' || !HASH.test(hashes.missing)) {
      return unavailable()
    }
    const fillJudgments = await persistedFillJudgments(persistedFill, questions, textOf, GRADING_VERSION.aiGradingV4)
    if (!fillJudgments) return unavailable()
    const rubricJudgments: TrustedRubricJudgment[] = []
    for (const row of persistedRubric) {
      const question = questions.find((item) => item.questionId === row.question_id)
      if (!question) return unavailable()
      const expectedHash = answers[question.questionId] === undefined ? hashes.missing : hashes.answers[question.questionId]
      const judgment = trustedPersistedRubric(row, question, GRADING_VERSION.aiGradingV4)
      if (!judgment || typeof expectedHash !== 'string' || judgment.answerHash !== expectedHash
        || (judgment.source === 'ai' && !isCanonicalV4Judgment(judgment, question))) return unavailable()
      rubricJudgments.push(judgment)
    }
    const result = gradeQuizV4(quiz, answers, trustedFillJudgments(fillJudgments), rubricJudgments)
    if (!resultMatchesAttempt(result, attempt)) return unavailable()
    return json({ attemptId: attempt.id, gradingVersion: GRADING_VERSION.aiGradingV4, result, cached: true })
  }

  // Draft capacity is larger than formal provider capacity. A nonblank ACTIVE text answer above
  // the provider byte limit is invalid submission input: reject before any claim, ledger row,
  // quota use or provider call. Blank text and inactive text in drawing mode are not measured.
  const encoder = new TextEncoder()
  for (const question of questions) {
    const answer = answers[question.questionId]
    if (question.type === 'calculation' && answer?.type === 'calculation' && answer.mode === 'text'
      && !isV4BlankText(answer.text) && encoder.encode(answer.text).length > GRADING_ANSWER_MAX_BYTES) {
      return invalidAnswers()
    }
  }

  const fillJudgments = await judgeFills(backend, input, attempt, questions, textOf, ruleFillStatusV4)
  if (fillJudgments instanceof Response) return fillJudgments

  const rubricJudgments: TrustedRubricJudgment[] = []
  const systemJudgment = (question: TutorQuestionContext, hash: string): TrustedRubricJudgment => ({
    questionId: question.questionId, questionType: question.type as SubmissionRubricQuestionType, answerHash: hash,
    source: 'system', status: 'unanswered', score: 0, maxScore: question.points!, criteria: [] })
  for (const question of questions) {
    if (question.type !== 'calculation' && question.type !== 'drawing') continue
    const answer = answers[question.questionId]
    if (answer && answer.type !== question.type) return unavailable()
    const claimInput = { userId: backend.userId, attemptId: attempt.id, expectedUpdatedAt: input.expectedUpdatedAt,
      requestId: input.requestId, quizId: attempt.quiz_id, quizRevision: attempt.quiz_revision,
      questionId: question.questionId, questionType: question.type, maxScore: question.points! }

    // Calculation identity and blankness use the ACTIVE mode only.
    const calculation = answer?.type === 'calculation' ? answer : null
    if (question.type === 'calculation' && (!calculation || (calculation.mode === 'text' && isV4BlankText(calculation.text)))) {
      const claim = await v4.claimRubric({ ...claimInput, systemUnanswered: true })
      if (claim.state === 'conflict') return conflict()
      if (claim.state !== 'unanswered' || !claim.answerHash || !HASH.test(claim.answerHash)) return unavailable()
      rubricJudgments.push(systemJudgment(question, claim.answerHash))
      continue
    }

    // Reserve before any raster work so concurrent duplicates stop at in_progress.
    const claim = await v4.claimRubric({ ...claimInput, systemUnanswered: false })
    if (claim.state === 'conflict') return conflict()
    if (claim.state === 'in_progress') return json({ code: 'in_progress' }, 202)
    if (claim.state === 'limited') return unavailable()
    if (claim.state === 'cached') {
      if (!claim.answerHash || !HASH.test(claim.answerHash)) return unavailable()
      const cached = parseStoredSubmissionRubricJudgment(claim.response, question, question.type)
      if (!cached || cached.answerHash !== claim.answerHash || !isCanonicalV4Judgment(cached, question)) return unavailable()
      rubricJudgments.push({ ...cached, source: 'ai', status: rubricStatus(cached.score, cached.maxScore),
        model: 'gpt-6-luna', reasoningEffort: 'medium' })
      continue
    }
    if (claim.state !== 'claimed' || !claim.claimToken || !claim.answerHash || !HASH.test(claim.answerHash)) return unavailable()
    const claimToken = claim.claimToken

    let png: Uint8Array | null = null
    const strokes = question.type === 'drawing' ? (answer?.type === 'drawing' ? answer.strokes : [])
      : calculation!.mode === 'drawing' ? calculation!.strokes : null
    if (strokes !== null) {
      try {
        if (!question.drawing) throw new DrawingRasterError('invalid')
        // Persisted strokes are parsed again by the server rasterizer; only its PNG is used.
        png = (await rasterizeStoredDrawing({ type: 'drawing', strokes }, question.drawing)).png
      } catch (error) {
        await backend.failRubric(claimToken, error instanceof DrawingRasterError ? `raster_${error.kind}` : 'raster_failed')
          .catch(() => undefined)
        if (error instanceof DrawingRasterError && error.kind === 'blank') {
          rubricJudgments.push(systemJudgment(question, claim.answerHash))
          continue
        }
        return unavailable()
      }
    }

    let generate: (() => Promise<SubmissionRubricProviderResult>) | null = null
    if (question.type === 'drawing') {
      const provider = backend.drawingProvider
      if (provider) generate = () => provider.generate(question, png!)
    } else if (v4.calculationProvider) {
      const provider = v4.calculationProvider
      // Inactive buffers are never provider input: text mode sends text only, drawing mode sends PNG only.
      generate = calculation!.mode === 'text'
        ? () => provider.generateText(question, calculation!.text)
        : () => provider.generateDrawing(question, png!)
    }
    if (!generate) {
      await backend.failRubric(claimToken, 'provider_unavailable').catch(() => undefined)
      return unavailable()
    }
    try {
      const judged = await generate()
      // The canonical v4 numbers are the only ones completed into cache, graded and finalized.
      const output = canonicalizeSubmissionRubricV4(judged.output, question, question.type)
      if (!output) throw new AiProviderError('malformed')
      const judgment: SubmissionRubricJudgment = { questionId: question.questionId, questionType: question.type,
        answerHash: claim.answerHash, ...output }
      if (!await backend.completeRubric(claimToken, judgment, judged.responseId, judged.usage)) {
        throw new AiProviderError('malformed')
      }
      rubricJudgments.push({ ...judgment, source: 'ai', status: rubricStatus(judgment.score, judgment.maxScore),
        model: 'gpt-6-luna', reasoningEffort: 'medium' })
    } catch (failure) {
      await backend.failRubric(claimToken, failure instanceof AiProviderError ? failure.code : 'server_error')
        .catch(() => undefined)
      return unavailable()
    }
  }

  const result = gradeQuizV4(quiz, answers, trustedFillJudgments(fillJudgments), rubricJudgments)
  const finalized = await v4.finalize({ userId: backend.userId, attemptId: attempt.id,
    expectedUpdatedAt: input.expectedUpdatedAt, requestId: input.requestId,
    quizId: attempt.quiz_id, quizRevision: attempt.quiz_revision, result, fillJudgments, rubricJudgments,
    questions: canonicalManifest(quiz, true) })
  if (!finalized) return conflict()
  return json({ attemptId: attempt.id, gradingVersion: GRADING_VERSION.aiGradingV4, result, cached: false })
}

export function createSubmitQuizHandler(backend: SubmissionBackend, lookup: SubmissionContextLookup = tutorContext) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ code: 'method_not_allowed' }, 405)
    if (!backend.userId) return json({ code: 'unauthorized' }, 401)
    let input
    try { input = parseSubmissionInput(await readBoundedJson(request, 2048)) }
    catch (error) { return json({ code: error instanceof TutorInputError && error.kind === 'oversized'
      ? 'request_too_large' : 'invalid_request' }, error instanceof TutorInputError && error.kind === 'oversized' ? 413 : 400) }
    if (!input) return json({ code: 'invalid_request' }, 400)

    try {
      const attempt = await backend.loadAttempt(input.attemptId)
      if (!attempt || attempt.user_id !== backend.userId || attempt.id !== input.attemptId) {
        return json({ code: 'attempt_unavailable' }, 404)
      }
      if (attempt.status === 'submitted' && ((attempt.grading_version !== GRADING_VERSION.aiGradingV3
        && attempt.grading_version !== GRADING_VERSION.aiGradingV4)
        || attempt.submission_request_id !== input.requestId)) return conflict()
      if (attempt.status === 'draft' && attempt.updated_at !== input.expectedUpdatedAt) return conflict()
      if (attempt.status !== 'draft' && attempt.status !== 'submitted') return conflict()

      // Server-owned dispatch: draft schema selects the contract; submitted rows replay their own version.
      const contract = attempt.status === 'submitted'
        ? attempt.grading_version === GRADING_VERSION.aiGradingV3 && attempt.answer_schema_version === 1 ? 'v3'
          : attempt.grading_version === GRADING_VERSION.aiGradingV4 && attempt.answer_schema_version === 2 ? 'v4' : null
        : attempt.answer_schema_version === 1 ? 'v3' : attempt.answer_schema_version === 2 ? 'v4' : null
      if (!contract) return unavailable()

      const questions = lookup.listRevision(attempt.quiz_id, attempt.quiz_revision)
      if (!questions.length || questions.some((question, index) => question.questionIndex !== index
        || question.quizId !== attempt.quiz_id || question.revision !== attempt.quiz_revision)) return unavailable()
      if (contract === 'v3') return await submitV3(backend, input, attempt, questions)
      if (!backend.v4) return unavailable()
      return await submitV4(backend, backend.v4, input, attempt, questions)
    } catch (error) {
      if (error instanceof SubmissionConflict) return conflict()
      return unavailable()
    }
  }
}
