import { isLegacyCalculationAnswer } from './calculation-answer.ts'
import { DRAFT_V4_LIMITS, DraftValidationError, draftExactKeys, draftRecord, normalizeDraftAnswersV4, requiresV4DraftContext,
  validDraftTimestamp, type DraftQuestionContext } from '../../supabase/functions/_shared/draft-v4.ts'
import type { CalculationAnswerV4, QuestionAnswer, QuizAttempt } from '../models/attempt.ts'
import type { DraftAnswerMapV4, PracticeAnswer, QuizDraftV4 } from '../models/draft-v4.ts'
import type { Quiz } from '../models/quiz.ts'

/**
 * The only v4 draft gate: an EXACT revision is schema-2 capable when it declares handwriting for at
 * least one calculation question. Every other revision stays schema 1 / ai-grading-v3.
 */
export function requiresV4Draft(quiz: Quiz): boolean {
  return requiresV4DraftContext(quiz.questions)
}

export function emptyCalculationAnswerV4(): CalculationAnswerV4 {
  return { type: 'calculation', mode: 'text', text: '', strokes: [] }
}

/** True for every historical schema-1 answer shape; a full v4 calculation answer is excluded. */
export function isLegacyQuestionAnswer(answer: PracticeAnswer | undefined): answer is QuestionAnswer {
  return !!answer && (answer.type !== 'calculation' || isLegacyCalculationAnswer(answer))
}

/** Strict schema-2 answer map for the exact revision: no legacy calculation, no repair. */
export function decodeDraftAnswersV4(quiz: Quiz, raw: unknown): DraftAnswerMapV4 | null {
  try { return normalizeDraftAnswersV4(contexts(quiz), raw, false) } catch { return null }
}

const encoder = new TextEncoder()
// Answers are replaced, never mutated, so the serialized size of an answer object does not change.
const answerBytes = new WeakMap<object, number>()

/**
 * Exactly draftAnswersBytes(answers), the size the save path checks against maxAnswerBytes, computed
 * from one cached size per answer so that an update serializes only the answer it changes.
 */
export function draftAnswerMapBytes(answers: DraftAnswerMapV4): number {
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

type DraftAnswerProblem = 'oversized' | 'draft-oversized' | 'invalid'

/** The answer map after this update, or why the update is not taken. */
function updatedAnswersV4(quiz: Quiz, draft: QuizDraftV4, questionId: string,
  answer: PracticeAnswer): DraftAnswerMapV4 | DraftAnswerProblem {
  const question = quiz.questions.find((item) => item.id === questionId)
  if (!question || question.type !== answer.type || draft.quizId !== quiz.id || draft.quizRevision !== quiz.revision) return 'invalid'
  let normalized: DraftAnswerMapV4
  try { normalized = normalizeDraftAnswersV4(contexts(quiz), { [questionId]: answer }, false) }
  catch (error) { return error instanceof DraftValidationError && error.kind === 'oversized' ? 'oversized' : 'invalid' }
  const answers = { ...draft.answers, [questionId]: normalized[questionId] }
  // Saving refuses a draft above the aggregate cap, so an update that would grow the draft past it is
  // not taken. One that does not grow it (undo, clear) always is.
  const size = draftAnswerMapBytes(answers)
  if (size > DRAFT_V4_LIMITS.maxAnswerBytes && size > draftAnswerMapBytes(draft.answers)) return 'draft-oversized'
  return answers
}

/**
 * Pure schema-2 answer update. Validates the question/type, the complete answer (including the
 * inactive calculation buffer) and the size of the whole draft, advances client time and never grades.
 */
export function answerQuizDraftV4(quiz: Quiz, draft: QuizDraftV4, questionId: string,
  answer: PracticeAnswer, now: string): QuizDraftV4 {
  const answers = updatedAnswersV4(quiz, draft, questionId, answer)
  return typeof answers === 'string' ? draft : { ...draft, status: 'in-progress', updatedAt: now, answers }
}

/**
 * Why answerQuizDraftV4 keeps the draft unchanged for this answer: 'oversized' when a stored-answer
 * limit refuses it, 'draft-oversized' when the whole draft would exceed the size that can be saved,
 * 'invalid' for any other refusal, null when the answer would be stored.
 */
export function draftAnswerProblemV4(quiz: Quiz, draft: QuizDraftV4, questionId: string,
  answer: PracticeAnswer): DraftAnswerProblem | null {
  const answers = updatedAnswersV4(quiz, draft, questionId, answer)
  return typeof answers === 'string' ? answers : null
}

function contexts(quiz: Quiz): DraftQuestionContext[] {
  return quiz.questions.map((question) => ({ questionId: question.id, type: question.type,
    ...('options' in question ? { options: question.options } : {}),
    ...('drawing' in question ? { drawing: question.drawing } : {}) }))
}

/** Strict schema-2 read: no repair, automatic persistence, grading or submitted-attempt upgrade. */
export function decodeQuizDraftV4(raw: string, quiz: Quiz): QuizDraftV4 | null {
  try {
    if (new TextEncoder().encode(raw).length > DRAFT_V4_LIMITS.maxRequestBytes) return null
    const value: unknown = JSON.parse(raw)
    if (!draftRecord(value) || !draftExactKeys(value,
      ['schemaVersion', 'quizId', 'quizRevision', 'status', 'startedAt', 'updatedAt', 'answers'])
      || value.schemaVersion !== 2 || value.status !== 'in-progress'
      || value.quizId !== quiz.id || value.quizRevision !== quiz.revision
      || !validDraftTimestamp(value.startedAt) || !validDraftTimestamp(value.updatedAt)) return null
    const answers = normalizeDraftAnswersV4(contexts(quiz), value.answers, false)
    return { schemaVersion: 2, status: 'in-progress', quizId: quiz.id, quizRevision: quiz.revision,
      startedAt: value.startedAt, updatedAt: value.updatedAt, answers }
  } catch { return null }
}

/** Pure in-memory draft promotion. Historical/submitted schema-1 data is never rewritten. */
export function upgradeLegacyQuizDraftV4(attempt: QuizAttempt, quiz: Quiz): QuizDraftV4 | null {
  try {
    if (attempt.schemaVersion !== 1 || attempt.status !== 'in-progress'
      || attempt.quizId !== quiz.id || attempt.quizRevision !== quiz.revision
      || !validDraftTimestamp(attempt.startedAt) || !validDraftTimestamp(attempt.updatedAt)
      || !draftRecord(attempt.answers)) return null
    for (const [id, answer] of Object.entries(attempt.answers)) {
      if (quiz.questions.find((question) => question.id === id)?.type === 'calculation'
        && !isLegacyCalculationAnswer(answer)) return null
    }
    return { schemaVersion: 2, status: 'in-progress', quizId: quiz.id, quizRevision: quiz.revision,
      startedAt: attempt.startedAt, updatedAt: attempt.updatedAt,
      answers: normalizeDraftAnswersV4(contexts(quiz), attempt.answers) }
  } catch { return null }
}
