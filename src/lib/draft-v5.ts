import { decodeAttempt } from './attempt-storage.ts'
import { decodeDraftAnswersV4, decodeQuizDraftV4, upgradeLegacyQuizDraftV4 } from './draft-v4.ts'
import { normalizeDraftAnswersV5, requiresV5DraftContext, DRAFT_V5_LIMITS } from '../../supabase/functions/_shared/draft-v5.ts'
import { DraftValidationError, draftExactKeys, draftRecord, validDraftTimestamp } from '../../supabase/functions/_shared/draft-v4.ts'
import type { CalculationAnswerV4, CalculationAnswerV5, QuizAttempt } from '../models/attempt.ts'
import type { DraftAnswerMapV4, PracticeAnswerV5, QuizDraftV4 } from '../models/draft-v4.ts'
import type { DraftAnswerMapV5, QuizDraftV5 } from '../models/draft-v5.ts'
import type { Quiz } from '../models/quiz.ts'

export function requiresV5Draft(quiz: Quiz): boolean {
  return requiresV5DraftContext(quiz.questions)
}

export function emptyCalculationAnswerV5(drawingCapable: boolean): CalculationAnswerV5 {
  return { type: 'calculation', mode: 'text', text: '', pages: drawingCapable ? [[]] : [] }
}

/** True only for legacy answer shapes that remain writable through schema 1. */
export function isLegacyQuestionAnswerV5(answer: PracticeAnswerV5 | undefined): answer is import('../models/attempt.ts').QuestionAnswer {
  return !!answer && (answer.type !== 'calculation' || !('pages' in answer) && !('strokes' in answer))
}

/** Strict schema-3 answer map for the exact revision; no legacy or schema-2 answer repair. */
export function decodeDraftAnswersV5(quiz: Quiz, raw: unknown): DraftAnswerMapV5 | null {
  try { return normalizeDraftAnswersV5(contexts(quiz), raw) } catch { return null }
}

/** Strict schema-3 read. Submitted attempts remain on their original historical decoder. */
export function decodeQuizDraftV5(raw: string, quiz: Quiz): QuizDraftV5 | null {
  try {
    if (!requiresV5Draft(quiz) || new TextEncoder().encode(raw).length > DRAFT_V5_LIMITS.maxRequestBytes) return null
    const value: unknown = JSON.parse(raw)
    if (!draftRecord(value) || !draftExactKeys(value,
      ['schemaVersion', 'quizId', 'quizRevision', 'status', 'startedAt', 'updatedAt', 'answers'])
      || value.schemaVersion !== 3 || value.status !== 'in-progress'
      || value.quizId !== quiz.id || value.quizRevision !== quiz.revision
      || !validDraftTimestamp(value.startedAt) || !validDraftTimestamp(value.updatedAt)) return null
    const answers = normalizeDraftAnswersV5(contexts(quiz), value.answers)
    return { schemaVersion: 3, status: 'in-progress', quizId: quiz.id, quizRevision: quiz.revision,
      startedAt: value.startedAt, updatedAt: value.updatedAt, answers }
  } catch { return null }
}

/**
 * Forward-promotes only in-progress schema-1/schema-2 drafts for an exact handwriting-capable
 * revision. Historical submissions are never rewritten; schema-3 promotion is idempotent.
 */
export function promoteQuizDraftV5(value: unknown, quiz: Quiz): QuizDraftV5 | null {
  if (!requiresV5Draft(quiz) || !draftRecord(value)) return null
  if (value.schemaVersion === 3) {
    try { return decodeQuizDraftV5(JSON.stringify(value), quiz) } catch { return null }
  }
  let source: QuizDraftV4 | null = null
  if (value.schemaVersion === 1) {
    let legacy: QuizAttempt | null = null
    try { legacy = decodeAttempt(JSON.stringify(value), quiz) } catch { /* Invalid legacy data is never repaired. */ }
    if (!legacy) return null
    source = upgradeLegacyQuizDraftV4(legacy, quiz)
  } else if (value.schemaVersion === 2) {
    try { source = decodeQuizDraftV4(JSON.stringify(value), quiz) } catch { return null }
  }
  if (!source) return null
  const oldAnswers: DraftAnswerMapV4 | null = decodeDraftAnswersV4(quiz, source.answers)
  if (!oldAnswers) return null
  const answers: Record<string, unknown> = {}
  for (const [id, answer] of Object.entries(oldAnswers)) {
    if (answer.type !== 'calculation') {
      answers[id] = answer
      continue
    }
    const question = quiz.questions.find((item) => item.id === id)
    if (!question || question.type !== 'calculation') return null
    const old = answer as CalculationAnswerV4
    answers[id] = { type: 'calculation', mode: old.mode, text: old.text,
      pages: question.drawing === undefined ? [] : [old.strokes] } satisfies CalculationAnswerV5
  }
  const promotedAnswers = decodeDraftAnswersV5(quiz, answers)
  if (!promotedAnswers) return null
  return { schemaVersion: 3, quizId: quiz.id, quizRevision: quiz.revision, status: 'in-progress',
    startedAt: source.startedAt, updatedAt: source.updatedAt, answers: promotedAnswers }
}

function contexts(quiz: Quiz) {
  return quiz.questions.map((question) => ({ questionId: question.id, type: question.type,
    ...('options' in question ? { options: question.options } : {}),
    ...('drawing' in question ? { drawing: question.drawing } : {}) }))
}

const encoder = new TextEncoder()
const answerBytes = new WeakMap<object, number>()
/** UTF-8 size of the complete answer map, using the same JSON accounting as the server. */
export function draftAnswerMapBytesV5(answers: DraftAnswerMapV5): number {
  let total = 2
  let members = 0
  for (const [id, answer] of Object.entries(answers)) {
    let size = answerBytes.get(answer)
    if (size === undefined) { size = encoder.encode(JSON.stringify(answer)).length; answerBytes.set(answer, size) }
    total += encoder.encode(JSON.stringify(id)).length + 1 + size
    members++
  }
  return total + Math.max(0, members - 1)
}

type DraftAnswerProblemV5 = 'oversized' | 'draft-oversized' | 'invalid'

function updatedAnswersV5(quiz: Quiz, draft: QuizDraftV5, questionId: string, answer: PracticeAnswerV5):
  DraftAnswerMapV5 | DraftAnswerProblemV5 {
  const question = quiz.questions.find((item) => item.id === questionId)
  if (!question || question.type !== answer.type || draft.quizId !== quiz.id || draft.quizRevision !== quiz.revision) return 'invalid'
  let normalized: DraftAnswerMapV5
  try { normalized = normalizeDraftAnswersV5(contexts(quiz), { [questionId]: answer }) }
  catch (error) { return error instanceof DraftValidationError && error.kind === 'oversized' ? 'oversized' : 'invalid' }
  const answers = { ...draft.answers, [questionId]: normalized[questionId] }
  const size = draftAnswerMapBytesV5(answers)
  if (size > DRAFT_V5_LIMITS.maxAnswerBytes && size > draftAnswerMapBytesV5(draft.answers)) return 'draft-oversized'
  return answers
}

/** Applies a strict schema-3 answer update while preserving the whole-draft capacity rule. */
export function answerQuizDraftV5(quiz: Quiz, draft: QuizDraftV5, questionId: string,
  answer: PracticeAnswerV5, now: string): QuizDraftV5 {
  const answers = updatedAnswersV5(quiz, draft, questionId, answer)
  return typeof answers === 'string' ? draft : { ...draft, updatedAt: now, answers }
}

export function draftAnswerProblemV5(quiz: Quiz, draft: QuizDraftV5, questionId: string,
  answer: PracticeAnswerV5): DraftAnswerProblemV5 | null {
  const answers = updatedAnswersV5(quiz, draft, questionId, answer)
  return typeof answers === 'string' ? answers : null
}
