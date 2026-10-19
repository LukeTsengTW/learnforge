import { normalizeCalculationAnswerV5 } from '../../../src/lib/calculation-answer.ts'
import type { DraftAnswerMapV5, DraftQuestionAnswerV5 } from '../../../src/models/draft-v5.ts'
import type { DrawingConfig } from '../../../src/models/quiz.ts'
import { DrawingRasterError } from './drawing-raster.ts'
import { DRAFT_V4_LIMITS, DraftValidationError, DRAFT_QUESTION_ID, draftAnswersBytes, draftRecord,
  normalizeDraftAnswersV4, type DraftQuestionContext } from './draft-v4.ts'

/** Schema 3 keeps the same answer count, 4 MiB aggregate byte cap and request envelope as schema 2. */
export const DRAFT_V5_LIMITS = DRAFT_V4_LIMITS
const invalid = (): never => { throw new DraftValidationError('invalid') }
const oversized = (): never => { throw new DraftValidationError('oversized') }

/** Exact-revision capability. Never substitute the latest revision for the attempt's revision. */
export function requiresV5DraftContext(questions: readonly { type: string; drawing?: unknown }[]): boolean {
  return questions.some((question) => question.type === 'calculation' && question.drawing !== undefined)
}

/** Strict schema-3 answer map. Calculation pages use one aggregate budget across all pages. */
export function normalizeDraftAnswersV5(questions: readonly DraftQuestionContext[], raw: unknown): DraftAnswerMapV5 {
  if (!draftRecord(raw)) return invalid()
  let bytes: number
  try { bytes = draftAnswersBytes(raw) } catch { return invalid() }
  if (bytes > DRAFT_V5_LIMITS.maxAnswerBytes) return oversized()
  const entries = Object.entries(raw)
  if (entries.length > DRAFT_V5_LIMITS.maxAnswers) return oversized()
  const lookup = new Map(questions.map((question) => [question.questionId, question]))
  if (lookup.size !== questions.length) return invalid()

  const calculations: Record<string, DraftQuestionAnswerV5> = {}
  const otherAnswers: Record<string, unknown> = {}
  for (const [id, answer] of entries) {
    if (!DRAFT_QUESTION_ID.test(id)) return invalid()
    const question = lookup.get(id)
    if (!question) return invalid()
    if (question.type !== 'calculation') {
      otherAnswers[id] = answer
      continue
    }
    try {
      calculations[id] = normalizeCalculationAnswerV5(answer, { drawing: question.drawing as DrawingConfig | undefined })
    } catch (error) {
      if (error instanceof DrawingRasterError && error.kind === 'oversized') return oversized()
      return invalid()
    }
  }

  // The schema-2 parser remains authoritative for every unchanged answer type, including standalone drawing.
  const normalizedOther = normalizeDraftAnswersV4(questions, otherAnswers, false)
  return { ...normalizedOther, ...calculations } as DraftAnswerMapV5
}
