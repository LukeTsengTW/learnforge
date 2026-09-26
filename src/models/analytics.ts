import type { AnswerMap, ObjectiveStatus, QuestionAnswer } from './attempt'
import type { ObjectiveQuestion, Quiz } from './quiz'

/** A bounded, submitted history row after ownership checks. Invalid rows stay countable. */
export interface AnalyticsAttempt {
  id: string
  quizId: string
  quizRevision: string
  submittedAt: string | null
  status: 'submitted' | 'draft'
  quiz: Quiz | null
  answers: AnswerMap | null
  unavailableReason?: 'missing-revision' | 'malformed'
}

export interface ObjectiveOccurrence {
  attemptId: string
  quizId: string
  quizRevision: string
  questionId: string
  subject: string
  tags: string[]
  questionType: ObjectiveQuestion['type']
  submittedAt: string
  status: ObjectiveStatus
  score: number
  maxScore: number
  questionIndex: number
  quiz: Quiz
  question: ObjectiveQuestion
  answer: QuestionAnswer | undefined
}

export interface SubjectStats {
  subject: string
  attemptCount: number
  answeredCount: number
  correct: number
  incorrect: number
  unanswered: number
  accuracy: number | null
  lastPracticedAt: string
}

export type TopicSignal = '資料不足' | '表現穩定' | '持續練習' | '需要複習'
export interface TagStats {
  tag: string
  sampleCount: number
  answered: number
  correct: number
  incorrect: number
  unanswered: number
  accuracy: number | null
  lastSeenAt: string
  signal: TopicSignal
}

export interface QuestionTypeStats {
  questionType: ObjectiveQuestion['type']
  answered: number
  correct: number
  incorrect: number
  unanswered: number
  accuracy: number | null
}

export interface WeeklyTrendPoint {
  weekStart: string
  answered: number
  correct: number
  accuracy: number | null
}

export interface ReviewItem {
  key: string
  quizId: string
  quizTitle: string
  quizRevision: string
  currentRevision: string | null
  subject: string
  questionId: string
  question: ObjectiveQuestion
  questionType: ObjectiveQuestion['type']
  tags: string[]
  incorrectCount: number
  latestIncorrectAt: string
  latestStudentAnswer: QuestionAnswer | undefined
  quiz: Quiz
}

export interface LearningAnalytics {
  scannedAttemptCount: number
  isTruncated: boolean
  completedAttempts: number
  excludedCount: number
  unavailableHistoryCount: number
  malformedAttemptCount: number
  manualQuestionSubmissions: number
  objectiveQuestions: number
  answeredObjectiveQuestions: number
  correct: number
  incorrect: number
  unanswered: number
  answeredAccuracy: number | null
  completionRate: number | null
  objectivePointsEarned: number
  objectivePointsAvailable: number
  subjects: SubjectStats[]
  tags: TagStats[]
  questionTypes: QuestionTypeStats[]
  weeklyTrend: WeeklyTrendPoint[]
  reviewQueue: ReviewItem[]
}
