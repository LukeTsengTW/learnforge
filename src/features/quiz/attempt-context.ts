import { createContext, useContext } from 'react'
import type { DraftSchemaVersion, PracticeAnswer, PracticeAttempt } from '../../models/draft-v4'
import type { Quiz } from '../../models/quiz'

/**
 * Synchronous result of an answer update. An editor may only keep showing input its owner accepted:
 * 'limit' means the limits of this one stored answer refused it, 'draft-limit' means the whole draft
 * would exceed the size that can be saved, 'rejected' means it was not taken for another reason (for
 * example the attempt is locked while it is being submitted). Every answer owner reports it.
 */
export type AnswerOutcome = 'accepted' | 'limit' | 'draft-limit' | 'rejected'

/** Size of the whole draft against the size that can be saved; absent where answers are not a draft. */
export interface DraftCapacity { usedBytes: number; maxBytes: number }
export const DraftCapacityContext = createContext<DraftCapacity | null>(null)

/**
 * Synchronously commits uncommitted editor input (e.g. an in-progress handwriting stroke) and reports
 * whether the owner took it; 'accepted' when nothing was pending.
 */
export type PendingInputFlush = () => AnswerOutcome

/** Steps of a formal submission, in the order it passes them. */
export const SUBMIT_STAGES = ['save', 'verify', 'grade', 'result'] as const
export type SubmitStage = typeof SUBMIT_STAGES[number]
/**
 * Where a running formal submission is. `startedAt` is the client clock (ms) when it began; `waiting`
 * means the server answered that grading of this draft is already in progress (an earlier request, or
 * another tab or device) and this submission polls for the result.
 */
export interface SubmitProgress { stage: SubmitStage; startedAt: number; waiting: boolean }

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
  /** Present while a formal submission runs, where the provider reports its steps. */
  submitProgress?: SubmitProgress | null
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
