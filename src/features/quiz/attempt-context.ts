import { createContext, useContext } from 'react'
import type { DraftSchemaVersion, PracticeAnswer, PracticeAttempt } from '../../models/draft-v4'
import type { Quiz } from '../../models/quiz'

/**
 * Synchronous result of an answer update. An editor may only keep showing input its owner accepted:
 * 'limit' means the stored-answer limits refused it, 'rejected' means it was not taken for another
 * reason (for example the attempt is locked while it is being submitted). Every answer owner reports it.
 */
export type AnswerOutcome = 'accepted' | 'limit' | 'rejected'

/**
 * Synchronously commits uncommitted editor input (e.g. an in-progress handwriting stroke) and reports
 * whether the owner took it; 'accepted' when nothing was pending.
 */
export type PendingInputFlush = () => AnswerOutcome

export interface AttemptContextValue {
  quiz: Quiz
  attempt: PracticeAttempt
  attemptId?: string
  /** Active draft schema; schema 2 renders the multimodal calculation editor. */
  draftSchema?: DraftSchemaVersion
  storageNotice: string | null
  answerQuestion: (questionId: string, answer: PracticeAnswer) => AnswerOutcome
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
