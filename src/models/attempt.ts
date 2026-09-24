import type { DrawingStroke } from './drawing'
import type { QuestionType } from './quiz'

export type QuestionAnswer =
  | { type: 'single'; optionId: string }
  | { type: 'multiple'; optionIds: string[] }
  | { type: 'true-false'; value: boolean }
  | { type: 'fill'; text: string }
  | { type: 'calculation'; text: string }
  | { type: 'drawing'; strokes: DrawingStroke[] }

export type AnswerMap = Record<string, QuestionAnswer>
export const GRADE_STATUS = {
  correct: 'correct', incorrect: 'incorrect', unanswered: 'unanswered', manual: 'manual',
} as const
export type ObjectiveStatus = typeof GRADE_STATUS.correct | typeof GRADE_STATUS.incorrect
  | typeof GRADE_STATUS.unanswered
export type QuestionGrade =
  | { questionId: string; type: Exclude<QuestionType, 'calculation' | 'drawing'>; status: ObjectiveStatus; score: number; maxScore: number }
  | { questionId: string; type: 'calculation' | 'drawing'; status: typeof GRADE_STATUS.manual; score: null; maxScore: null }

export interface GradeResult {
  score: number
  maxScore: number
  correctCount: number
  incorrectCount: number
  unansweredCount: number
  manualCount: number
  questions: QuestionGrade[]
}

interface AttemptBase {
  schemaVersion: 1
  quizId: string
  quizRevision: string
  startedAt: string
  updatedAt: string
  answers: AnswerMap
}
export type QuizAttempt =
  | (AttemptBase & { status: 'in-progress' })
  | (AttemptBase & { status: 'submitted'; submittedAt: string; result: GradeResult })
