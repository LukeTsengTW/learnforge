import type { CalculationAnswerV4, GradeResult, QuestionAnswer, QuizAttempt } from './attempt.ts'

export type DraftQuestionAnswerV4 = Exclude<QuestionAnswer, { type: 'calculation' }> | CalculationAnswerV4
export type DraftAnswerMapV4 = Record<string, DraftQuestionAnswerV4>

/** Schema-2 draft. Historical schema-1 QuizAttempt/QuestionAnswer semantics are unchanged. */
export interface QuizDraftV4 {
  schemaVersion: 2
  quizId: string
  quizRevision: string
  status: 'in-progress'
  startedAt: string
  updatedAt: string
  answers: DraftAnswerMapV4
}

/**
 * Server-finalized ai-grading-v4 attempt reconstructed from persisted evidence. It keeps the full
 * CalculationAnswerV4 (both buffers); only the active mode is ever displayed or graded.
 */
export interface SubmittedQuizAttemptV4 {
  schemaVersion: 2
  quizId: string
  quizRevision: string
  status: 'submitted'
  startedAt: string
  updatedAt: string
  submittedAt: string
  answers: DraftAnswerMapV4
  result: GradeResult
}

export type QuizAttemptV4 = QuizDraftV4 | SubmittedQuizAttemptV4
/** Client-facing union; schema 1 remains the explicit historical QuizAttempt. */
export type PracticeAttempt = QuizAttempt | QuizAttemptV4
export type PracticeAnswer = QuestionAnswer | CalculationAnswerV4
export type PracticeAnswerMap = Record<string, PracticeAnswer>
export type DraftSchemaVersion = 1 | 2
