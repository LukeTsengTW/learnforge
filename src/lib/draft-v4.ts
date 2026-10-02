import { isLegacyCalculationAnswer } from './calculation-answer.ts'
import { DRAFT_V4_LIMITS, draftExactKeys, draftRecord, normalizeDraftAnswersV4,
  validDraftTimestamp, type DraftQuestionContext } from '../../supabase/functions/_shared/draft-v4.ts'
import type { QuizAttempt } from '../models/attempt.ts'
import type { QuizDraftV4 } from '../models/draft-v4.ts'
import type { Quiz } from '../models/quiz.ts'

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
