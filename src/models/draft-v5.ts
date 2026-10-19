import type { CalculationAnswerV5, GradeResult, QuestionAnswer, QuizAttempt } from './attempt.ts'
import type { QuizAttemptV4 } from './draft-v4.ts'

export type DraftQuestionAnswerV5 = Exclude<QuestionAnswer, { type: 'calculation' }> | CalculationAnswerV5
export type DraftAnswerMapV5 = Record<string, DraftQuestionAnswerV5>

/** Schema-3 draft. Schema-2 history stays represented by QuizDraftV4. */
export interface QuizDraftV5 {
  schemaVersion: 3
  quizId: string
  quizRevision: string
  status: 'in-progress'
  startedAt: string
  updatedAt: string
  answers: DraftAnswerMapV5
}

/** Server-finalized ai-grading-v5 evidence reconstructed from persisted rows. */
export interface SubmittedQuizAttemptV5 {
  schemaVersion: 3
  quizId: string
  quizRevision: string
  status: 'submitted'
  startedAt: string
  updatedAt: string
  submittedAt: string
  answers: DraftAnswerMapV5
  result: GradeResult
}

export type QuizAttemptV5 = QuizDraftV5 | SubmittedQuizAttemptV5
export type Schema3PromotionSource = QuizAttempt | QuizAttemptV4 | QuizAttemptV5
