import type { DrawingStroke } from './drawing.ts'
import type { QuestionType } from './quiz.ts'

export type QuestionAnswer =
  | { type: 'single'; optionId: string }
  | { type: 'multiple'; optionIds: string[] }
  | { type: 'true-false'; value: boolean }
  | { type: 'fill'; text: string }
  | { type: 'calculation'; text: string }
  | { type: 'drawing'; strokes: DrawingStroke[] }

export type AnswerMap = Record<string, QuestionAnswer>
export const GRADE_STATUS = {
  correct: 'correct', partial: 'partial', incorrect: 'incorrect', unanswered: 'unanswered', manual: 'manual',
} as const
export type ObjectiveStatus = typeof GRADE_STATUS.correct | typeof GRADE_STATUS.incorrect
  | typeof GRADE_STATUS.unanswered
export type ScoredStatus = ObjectiveStatus | typeof GRADE_STATUS.partial
export type RubricScoredStatus = typeof GRADE_STATUS.correct | typeof GRADE_STATUS.partial | typeof GRADE_STATUS.incorrect
export type RubricCriterionStatus = 'full' | 'partial' | 'none'
export interface TrustedRubricCriterionJudgment {
  criterionId: string
  awardedScore: number
  maxScore: number
  status: RubricCriterionStatus
  feedback?: string
}
interface TrustedRubricJudgmentBase {
  questionId: string
  questionType: 'calculation' | 'drawing'
  answerHash: string
  score: number
  maxScore: number
}
export type TrustedRubricJudgment =
  | (TrustedRubricJudgmentBase & {
    source: 'system'
    status: typeof GRADE_STATUS.unanswered
    criteria: []
  })
  | (TrustedRubricJudgmentBase & {
  source: 'ai'
  status: RubricScoredStatus
  criteria: TrustedRubricCriterionJudgment[]
  confidence: 'high' | 'medium' | 'low'
  summary: string
  model: 'gpt-6-luna'
  reasoningEffort: 'medium'
  strengths?: string[]
  improvements?: string[]
  observations?: string[]
  missingOrUnclear?: string[]
})
export type QuestionGrade =
  | { questionId: string; type: Exclude<QuestionType, 'calculation' | 'drawing'>; status: ObjectiveStatus; score: number; maxScore: number;
      source?: 'rule' | 'ai'; reason?: string }
  | { questionId: string; type: 'calculation' | 'drawing'; status: typeof GRADE_STATUS.manual; score: null; maxScore: null }
  | { questionId: string; type: 'calculation' | 'drawing'; status: typeof GRADE_STATUS.unanswered; score: 0; maxScore: number }
  | { questionId: string; type: 'calculation' | 'drawing'; status: typeof GRADE_STATUS.unanswered; score: 0; maxScore: number;
      source: 'system'; answerHash: string }
  | ({ questionId: string; type: 'calculation' | 'drawing'; status: RubricScoredStatus; score: number; maxScore: number; source: 'ai' }
    & Pick<Extract<TrustedRubricJudgment, { source: 'ai' }>, 'answerHash' | 'criteria' | 'confidence' | 'summary'>
    & Partial<Pick<Extract<TrustedRubricJudgment, { source: 'ai' }>, 'strengths' | 'improvements' | 'observations' | 'missingOrUnclear'>>)

export interface GradeResult {
  score: number
  maxScore: number
  correctCount: number
  partialCount: number
  incorrectCount: number
  unansweredCount: number
  manualCount: number
  questions: QuestionGrade[]
}

export type { GradingVersion } from './grading-version'
export { GRADING_VERSION } from './grading-version'
export interface TrustedFillJudgment {
  questionId: string
  source: 'rule' | 'ai'
  status: ObjectiveStatus
  reason: string | null
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
