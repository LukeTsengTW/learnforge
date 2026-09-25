import { useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Quiz } from '../../models/quiz'
import { AttemptContext } from './attempt-context'
import { createAttemptStore } from './attempt-store'

export function AttemptProvider({ quiz, children }: { quiz: Quiz; children: ReactNode }) {
  const [store] = useState(() => createAttemptStore(quiz))
  const { attempt, notice } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const dispatch = store.dispatch
  return <AttemptContext.Provider value={{ quiz, attempt, storageNotice: notice,
    answerQuestion: (questionId, answer) => dispatch({ type: 'answer', questionId, answer, now: new Date().toISOString() }),
    submit: () => { dispatch({ type: 'submit', now: new Date().toISOString() }); return quiz.id },
    restart: async () => { dispatch({ type: 'restart', now: new Date().toISOString() }); return true },
  }}>{children}</AttemptContext.Provider>
}
