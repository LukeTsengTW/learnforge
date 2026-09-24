import type { QuestionAnswer, QuizAttempt } from '../models/attempt'
import type { Quiz } from '../models/quiz'
import { gradeQuiz } from './grading'

export function createAttempt(quiz: Quiz, now: string): QuizAttempt {
  return { schemaVersion: 1, quizId: quiz.id, quizRevision: quiz.revision,
    status: 'in-progress', startedAt: now, updatedAt: now, answers: {} }
}
export type AttemptAction =
  | { type: 'answer'; questionId: string; answer: QuestionAnswer; now: string }
  | { type: 'submit'; now: string }
  | { type: 'restart'; now: string }

/** A submitted attempt is immutable; only an explicit restart creates a new one. */
export function reduceAttempt(quiz: Quiz, attempt: QuizAttempt, action: AttemptAction): QuizAttempt {
  if (action.type === 'restart') return createAttempt(quiz, action.now)
  if (attempt.status === 'submitted') return attempt
  if (action.type === 'submit') {
    const answers = structuredClone(attempt.answers)
    return { ...attempt, answers, status: 'submitted', updatedAt: action.now,
      submittedAt: action.now, result: gradeQuiz(quiz, answers) }
  }
  const question = quiz.questions.find((item) => item.id === action.questionId)
  if (!question || question.type !== action.answer.type) return attempt
  return { ...attempt, updatedAt: action.now,
    answers: { ...attempt.answers, [action.questionId]: structuredClone(action.answer) } }
}
