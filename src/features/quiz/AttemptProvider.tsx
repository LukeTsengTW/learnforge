import { useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Quiz } from '../../models/quiz'
import { isLegacyQuestionAnswerV5 } from '../../lib/draft-v5'
import { AttemptContext } from './attempt-context'
import { createAttemptStore } from './attempt-store'

export function AttemptProvider({ quiz, children }: { quiz: Quiz; children: ReactNode }) {
  const [store] = useState(() => createAttemptStore(quiz))
  const { attempt, notice } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const dispatch = store.dispatch
  return <AttemptContext.Provider value={{ quiz, attempt, storageNotice: notice,
    answerQuestion: (questionId, answer) => {
      // Legacy local-only provider: schema 1 only.
      if (!isLegacyQuestionAnswerV5(answer)) return 'rejected'
      const before = store.getSnapshot().attempt
      dispatch({ type: 'answer', questionId, answer, now: new Date().toISOString() })
      return store.getSnapshot().attempt === before ? 'rejected' : 'accepted'
    },
    submit: () => { dispatch({ type: 'submit', now: new Date().toISOString() }); return quiz.id },
    restart: async () => { dispatch({ type: 'restart', now: new Date().toISOString() }); return true },
  }}>{children}</AttemptContext.Provider>
}
