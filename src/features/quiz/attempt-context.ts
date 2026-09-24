import { createContext, useContext } from 'react'
import type { QuestionAnswer, QuizAttempt } from '../../models/attempt'
import type { Quiz } from '../../models/quiz'

export interface AttemptContextValue {
  quiz: Quiz
  attempt: QuizAttempt
  storageNotice: string | null
  answerQuestion: (questionId: string, answer: QuestionAnswer) => void
  submit: () => void
  restart: () => void
}
export const AttemptContext = createContext<AttemptContextValue | null>(null)
export function useAttempt(): AttemptContextValue {
  const value = useContext(AttemptContext)
  if (!value) throw new Error('useAttempt must be used inside AttemptProvider.')
  return value
}
