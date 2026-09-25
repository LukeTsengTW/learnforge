import { createContext, useContext } from 'react'
import type { SupabasePracticeRepository } from './practice-repository'

export type PracticeRepository = Pick<SupabasePracticeRepository,
  'listCurrentDrafts' | 'loadAttempt' | 'getOrCreateDraft' | 'saveDraft' | 'deleteDraft' | 'listSubmittedPage' | 'loadLatestSubmittedForQuiz'>
export const PracticeContext = createContext<PracticeRepository | null>(null)
export function usePracticeRepository(): PracticeRepository {
  const repository = useContext(PracticeContext)
  if (!repository) throw new Error('PracticeRepository required')
  return repository
}
