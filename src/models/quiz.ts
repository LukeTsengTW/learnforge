export const QUESTION_TYPE = {
  single: 'single', multiple: 'multiple', trueFalse: 'true-false',
  fill: 'fill', calculation: 'calculation', drawing: 'drawing',
} as const

export type QuestionType = typeof QUESTION_TYPE[keyof typeof QUESTION_TYPE]
export type FillMatchStrategy = 'exact' | 'case-insensitive'
export interface RubricCriterion { description: string; score: number | null }
export interface ChoiceOption { id: string; content: string }
export interface DrawingConfig { width: number; height: number }

interface QuestionBase {
  id: string
  tags: string[]
  points: number
  prompt: string
  hint: string | null
  solution: string
  rubric: RubricCriterion[]
}

export interface SingleChoiceQuestion extends QuestionBase {
  type: typeof QUESTION_TYPE.single
  options: ChoiceOption[]
  correctOptionId: string
}
export interface MultipleChoiceQuestion extends QuestionBase {
  type: typeof QUESTION_TYPE.multiple
  options: ChoiceOption[]
  correctOptionIds: string[]
}
export interface TrueFalseQuestion extends QuestionBase {
  type: typeof QUESTION_TYPE.trueFalse
  correctAnswer: boolean
}
export interface FillBlankQuestion extends QuestionBase {
  type: typeof QUESTION_TYPE.fill
  correctAnswer: string
  match: FillMatchStrategy
}
export interface CalculationQuestion extends QuestionBase {
  type: typeof QUESTION_TYPE.calculation
  referenceAnswer: string
}
export interface DrawingQuestion extends QuestionBase {
  type: typeof QUESTION_TYPE.drawing
  referenceAnswer: string
  drawing: DrawingConfig
}
export type Question = SingleChoiceQuestion | MultipleChoiceQuestion | TrueFalseQuestion
  | FillBlankQuestion | CalculationQuestion | DrawingQuestion
export type ObjectiveQuestion = Exclude<Question, CalculationQuestion | DrawingQuestion>

export interface Quiz {
  id: string
  title: string
  description: string
  subject: string
  tags: string[]
  estimatedMinutes: number
  current: boolean
  /** Stable content revision. Published revisions must remain bundled. */
  revision: string
  questions: Question[]
}

export function isObjectiveQuestion(question: Question): question is ObjectiveQuestion {
  return question.type !== QUESTION_TYPE.calculation && question.type !== QUESTION_TYPE.drawing
}

export const QUESTION_LABEL: Record<QuestionType, string> = {
  single: '單選題', multiple: '多選題', 'true-false': '是非題',
  fill: '填空題', calculation: '計算題', drawing: '畫圖題',
}
