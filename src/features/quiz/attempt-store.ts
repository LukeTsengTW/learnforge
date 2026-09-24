import type { Quiz } from '../../models/quiz'
import { reduceAttempt, type AttemptAction } from '../../lib/attempt'
import { loadAttempt, saveAttempt } from '../../lib/attempt-storage'

/** Small external store: event dispatch persists synchronously before navigation. */
export function createAttemptStore(quiz: Quiz) {
  let snapshot = loadAttempt(quiz, new Date().toISOString())
  const initialNotice = snapshot.notice
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    dispatch: (action: AttemptAction) => {
      const attempt = reduceAttempt(quiz, snapshot.attempt, action)
      if (attempt === snapshot.attempt) return
      snapshot = { attempt, notice: saveAttempt(attempt) ?? initialNotice }
      listeners.forEach((listener) => listener())
    },
  }
}
