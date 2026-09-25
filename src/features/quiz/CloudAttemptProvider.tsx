import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Quiz } from '../../models/quiz'
import { createCloudAttemptStore } from './cloud-attempt-store'
import { AttemptContext } from './attempt-context'
import { LocalAttemptRepository, type AttemptRepository } from './repositories'
export function CloudAttemptProvider({ quiz, userId, repository, children }: { quiz: Quiz; userId: string; repository: AttemptRepository; children: ReactNode }) {
  const [store] = useState(() => createCloudAttemptStore(quiz, new LocalAttemptRepository(quiz, userId), repository))
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => {
    void store.start()
    const retry = () => { void store.retry() }
    window.addEventListener('online', retry)
    return () => { store.stop(); window.removeEventListener('online', retry) }
  }, [store])
  return <AttemptContext.Provider value={{ quiz, attempt: state.attempt, storageNotice: state.notice, loading: state.loading, syncing: state.syncing,
    retry: store.retry, importLegacy: state.legacy ? store.importLegacy : undefined,
    answerQuestion: (questionId, answer) => store.dispatch({ type: 'answer', questionId, answer, now: new Date().toISOString() }),
    submit: () => store.dispatch({ type: 'submit', now: new Date().toISOString() }), restart: store.restart,
  }}>{children}</AttemptContext.Provider>
}
