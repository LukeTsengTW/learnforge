import type { QuizAttempt } from '../../models/attempt'
/** Inputs have already passed decodeAttempt. Ties and conflicting submissions favour the remote. */
export function resolveAttemptConflict(local: QuizAttempt, remote: QuizAttempt): 'local' | 'remote' {
  if (remote.status === 'submitted') return 'remote'
  if (local.status === 'submitted') return 'local'
  return Date.parse(local.updatedAt) > Date.parse(remote.updatedAt) ? 'local' : 'remote'
}
export function sameAttempt(a: QuizAttempt, b: QuizAttempt): boolean {
  return a.status === b.status && Date.parse(a.startedAt) === Date.parse(b.startedAt)
    && Date.parse(a.updatedAt) === Date.parse(b.updatedAt) && equalJson(a.answers, b.answers)
}

// PostgreSQL jsonb can reorder object properties; array/stroke order remains significant.
function equalJson(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((value, index) => equalJson(value, b[index]))
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null || Array.isArray(b)) return false
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>
  return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => Object.hasOwn(right, key) && equalJson(left[key], right[key]))
}
