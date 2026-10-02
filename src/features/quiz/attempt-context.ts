import { createContext, useContext } from 'react'
import type { DraftSchemaVersion, PracticeAnswer, PracticeAttempt } from '../../models/draft-v4'
import type { Quiz } from '../../models/quiz'

/** Synchronously commits uncommitted editor input (e.g. an in-progress handwriting stroke). */
export type PendingInputFlush = () => void

export interface AttemptContextValue {
  quiz: Quiz
  attempt: PracticeAttempt
  attemptId?: string
  /** Active draft schema; schema 2 renders the multimodal calculation editor. */
  draftSchema?: DraftSchemaVersion
  storageNotice: string | null
  answerQuestion: (questionId: string, answer: PracticeAnswer) => void
  submit: () => Promise<string | null> | string | null | void
  restart: () => Promise<boolean>
  /** Registers a pending-input flush that runs before formal submission; returns an unregister function. */
  registerPendingFlush?: (flush: PendingInputFlush) => () => void
  loading?: boolean
  syncing?: boolean
  submitting?: boolean
  pendingSubmission?: boolean
  retry?: () => Promise<void>
  importLegacy?: () => Promise<void>
}
export const AttemptContext = createContext<AttemptContextValue | null>(null)
export function useAttempt(): AttemptContextValue {
  const value = useContext(AttemptContext)
  if (!value) throw new Error('useAttempt must be used inside AttemptProvider.')
  return value
}
