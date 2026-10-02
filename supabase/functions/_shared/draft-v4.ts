import { isCalculationAnswerV4, normalizeLegacyCalculationDraft } from '../../../src/lib/calculation-answer.ts'
import type { DraftAnswerMapV4, DraftQuestionAnswerV4 } from '../../../src/models/draft-v4.ts'
import type { CalculationQuestion, DrawingConfig, Question } from '../../../src/models/quiz.ts'
import { DrawingRasterError, parseStoredDrawing } from './drawing-raster.ts'

// A full 6000-point drawing is below 0.5 MiB of compact JSON; even worst-case escaped
// 100000-character text adds at most 0.6 MiB. The aggregate cap permits several such
// answers while bounding memory; all 100 entries cannot simultaneously use every maximum.
export const DRAFT_V4_LIMITS = { maxAnswers: 100, maxAnswerBytes: 4 * 1024 * 1024,
  maxRequestBytes: 4 * 1024 * 1024 + 1024, maxTextLength: 100000, maxOptionIds: 12 } as const
export const DRAFT_QUESTION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/
export const draftRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
export const draftExactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Reflect.ownKeys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
export class DraftValidationError extends Error {
  readonly kind: 'invalid' | 'oversized'
  constructor(kind: 'invalid' | 'oversized') { super(kind); this.kind = kind }
}
const invalid = (): never => { throw new DraftValidationError('invalid') }
const oversized = (): never => { throw new DraftValidationError('oversized') }

export interface DraftQuestionContext {
  questionId: string
  type: Question['type']
  options?: readonly { id: string }[]
  drawing?: DrawingConfig
}

/**
 * Single source of the v4 capability rule (client and Edge): schema 2 / ai-grading-v4 is allowed only
 * when the attempt's EXACT revision has a calculation question declaring handwriting. Callers must
 * pass exact-revision questions; the current/latest revision is never a substitute.
 */
export function requiresV4DraftContext(questions: readonly { type: string; drawing?: unknown }[]): boolean {
  return questions.some((question) => question.type === 'calculation' && question.drawing !== undefined)
}

function text(value: unknown): string {
  if (typeof value !== 'string') return invalid()
  if (value.length > DRAFT_V4_LIMITS.maxTextLength) return oversized()
  return value
}

function drawing(value: unknown, config: DrawingConfig | undefined) {
  if (!config || !Array.isArray(value)) return invalid()
  // parseStoredDrawing owns geometry/resource limits; these checks reject hidden extra fields.
  for (const stroke of value) {
    if (!draftRecord(stroke) || !draftExactKeys(stroke, ['tool', 'color', 'width', 'points'])
      || !Array.isArray(stroke.points) || !stroke.points.every((point: unknown) =>
        draftRecord(point) && draftExactKeys(point, ['x', 'y']))) return invalid()
  }
  try { return parseStoredDrawing({ type: 'drawing', strokes: value }, config) }
  catch (error) {
    if (error instanceof DrawingRasterError && error.kind === 'oversized') return oversized()
    return invalid()
  }
}

function normalizeAnswer(question: DraftQuestionContext, raw: unknown, allowLegacy: boolean): DraftQuestionAnswerV4 {
  if (!draftRecord(raw) || raw.type !== question.type) return invalid()
  switch (question.type) {
    case 'single':
      if (!draftExactKeys(raw, ['type', 'optionId']) || typeof raw.optionId !== 'string'
        || !question.options?.some((option) => option.id === raw.optionId)) return invalid()
      return { type: 'single', optionId: raw.optionId }
    case 'multiple':
      if (!draftExactKeys(raw, ['type', 'optionIds']) || !Array.isArray(raw.optionIds)) return invalid()
      if (raw.optionIds.length > DRAFT_V4_LIMITS.maxOptionIds) return oversized()
      if (new Set(raw.optionIds).size !== raw.optionIds.length || !raw.optionIds.every((id: unknown) =>
        typeof id === 'string' && question.options?.some((option) => option.id === id))) return invalid()
      return { type: 'multiple', optionIds: [...raw.optionIds] }
    case 'true-false':
      if (!draftExactKeys(raw, ['type', 'value']) || typeof raw.value !== 'boolean') return invalid()
      return { type: 'true-false', value: raw.value }
    case 'fill':
      if (!draftExactKeys(raw, ['type', 'text'])) return invalid()
      return { type: 'fill', text: text(raw.text) }
    case 'drawing':
      if (!draftExactKeys(raw, ['type', 'strokes'])) return invalid()
      return { type: 'drawing', strokes: drawing(raw.strokes, question.drawing) }
    case 'calculation': {
      const legacy = draftExactKeys(raw, ['type', 'text'])
      if ((!legacy || !allowLegacy) && !draftExactKeys(raw, ['type', 'mode', 'text', 'strokes'])) return invalid()
      text(raw.text)
      const candidate = legacy && allowLegacy ? normalizeLegacyCalculationDraft(raw) : raw
      if (!candidate || !Array.isArray(candidate.strokes)) return invalid()
      const strokes = question.drawing === undefined ? [] : drawing(candidate.strokes, question.drawing)
      // Only capability is relevant to the M1 grammar; no grading authority is fabricated or persisted.
      const exactQuestion: CalculationQuestion = { id: question.questionId, type: 'calculation', drawing: question.drawing,
        tags: [], points: 0, prompt: '', hint: null, solution: '', referenceAnswer: '', rubric: [] }
      if (!isCalculationAnswerV4(candidate, exactQuestion)) return invalid()
      return { type: 'calculation', mode: candidate.mode, text: candidate.text, strokes }
    }
  }
}

/** The caller supplies the exact canonical revision, never browser-owned quiz metadata. */
export function normalizeDraftAnswersV4(questions: readonly DraftQuestionContext[], raw: unknown,
  allowLegacyCalculation = true): DraftAnswerMapV4 {
  if (!draftRecord(raw)) return invalid()
  const entries = Object.entries(raw)
  if (entries.length > DRAFT_V4_LIMITS.maxAnswers) return oversized()
  if (new TextEncoder().encode(JSON.stringify(raw)).length > DRAFT_V4_LIMITS.maxAnswerBytes) return oversized()
  const lookup = new Map(questions.map((question) => [question.questionId, question]))
  if (lookup.size !== questions.length) return invalid()
  return Object.fromEntries(entries.map(([id, answer]) => {
    const question = lookup.get(id)
    if (!DRAFT_QUESTION_ID.test(id) || !question) return invalid()
    return [id, normalizeAnswer(question, answer, allowLegacyCalculation)]
  }))
}

/** RFC3339 instants with up to PostgreSQL's six fractional digits; reject normalized bad dates. */
export function validDraftTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match || Number(match[1]) < 1000 || !Number.isFinite(Date.parse(value))) return false
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`)
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() + 1 !== Number(match[2])
    || date.getUTCDate() !== Number(match[3]) || date.getUTCHours() !== Number(match[4])
    || date.getUTCMinutes() !== Number(match[5]) || date.getUTCSeconds() !== Number(match[6])) return false
  return match[8] === 'Z' || (Number(match[8].slice(1, 3)) <= 23 && Number(match[8].slice(4)) <= 59)
}

export function sameDraftTimestamp(a: string, b: string): boolean {
  const micros = (value: string) => {
    if (!validDraftTimestamp(value)) return null
    const fraction = /\.(\d+)/.exec(value)?.[1] ?? ''
    return BigInt(Date.parse(value)) * 1000n + BigInt(fraction.padEnd(6, '0').slice(3))
  }
  const first = micros(a), second = micros(b)
  return first !== null && second !== null && first === second
}
