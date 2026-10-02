import type { CalculationAnswerV4, QuestionAnswer } from './attempt.ts'

export type DraftQuestionAnswerV4 = Exclude<QuestionAnswer, { type: 'calculation' }> | CalculationAnswerV4
export type DraftAnswerMapV4 = Record<string, DraftQuestionAnswerV4>

/** Future draft-only domain. The production schema-1 QuizAttempt writer is unchanged. */
export interface QuizDraftV4 {
  schemaVersion: 2
  quizId: string
  quizRevision: string
  status: 'in-progress'
  startedAt: string
  updatedAt: string
  answers: DraftAnswerMapV4
}
