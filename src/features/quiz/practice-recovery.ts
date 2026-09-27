import { decodeAttempt } from '../../lib/attempt-storage'
import { LocalPracticeCache, type CachedPractice } from './practice-cache'
import { quizCatalog } from './quiz-loader'
import type { PracticeRepository } from './practice-context'
import { PersistenceError } from './repositories'

export interface PracticeBackup {
  key: string; quizId: string; attemptId: string; savedAt: string | null; reason: string
}
function ownsKey(userId: string, key: string) {
  return [2, 3].some(version => key.startsWith(`learnforge:attempt:v${version}:${userId}:`)) && key.includes(':recovery:')
}
export function readBackup(userId: string, key: string, storage: Storage): string {
  if (!ownsKey(userId, key)) throw new PersistenceError('invalid')
  const raw = storage.getItem(key)
  if (raw === null) throw new PersistenceError('invalid')
  try {
    const value = JSON.parse(raw)
    if (value?.ownerId && value.ownerId !== userId) throw new PersistenceError('invalid')
  } catch (error) { if (error instanceof PersistenceError) throw error }
  return raw
}
export function listPracticeBackups(userId: string, storage: Storage): PracticeBackup[] {
  const backups: PracticeBackup[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key || !ownsKey(userId, key)) continue
    try {
      const raw = readBackup(userId, key, storage)
      let value
      try { value = JSON.parse(raw) } catch { /* Corrupt backup remains exportable. */ }
      backups.push({ key, quizId: typeof value?.attempt?.quizId === 'string' ? value.attempt.quizId : '無法辨識題庫',
        attemptId: typeof value?.id === 'string' ? value.id : key.split(':')[4],
        savedAt: value?.recovery?.savedAt ?? value?.attempt?.updatedAt ?? null,
        reason: value?.recovery?.reason ?? (key.endsWith(':migration') ? '舊資料遷移／資料格式損壞' : '歷史同步衝突') })
    } catch { /* Never expose an envelope owned by a different account. */ }
  }
  return backups.sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''))
}
export async function restorePracticeBackup(userId: string, key: string, storage: Storage, repo: PracticeRepository): Promise<string> {
  const value = JSON.parse(readBackup(userId, key, storage)) as CachedPractice & { ownerId: string; schemaVersion: number }
  if (value.schemaVersion !== 3 || value.ownerId !== userId || value.id !== value.version?.id
    || !key.startsWith(`learnforge:attempt:v3:${userId}:${value.id}:recovery:`)) throw new PersistenceError('invalid')
  const quiz = quizCatalog.getQuizRevision(value.attempt?.quizId, value.attempt?.quizRevision)
  const attempt = quiz && decodeAttempt(JSON.stringify(value.attempt), quiz)
  if (!quiz || !attempt || attempt.status !== 'in-progress') throw new PersistenceError('conflict')
  const remote = await repo.loadAttempt(value.id)
  if (!remote || remote.row.user_id !== userId || remote.row.status !== 'draft' || !remote.attempt
    || remote.row.quiz_revision !== quiz.revision || remote.version.updatedAt !== value.version.updatedAt
    || Object.keys(remote.attempt.answers).length) throw new PersistenceError('conflict')
  const cache = new LocalPracticeCache(userId, () => storage)
  const local = cache.read(value.id, quiz)
  if (local && (local.attempt.status !== 'in-progress' || Object.keys(local.attempt.answers).length)) throw new PersistenceError('conflict')
  cache.write({ id: value.id, attempt: { ...attempt, updatedAt: new Date(Math.max(Date.now(), Date.parse(attempt.updatedAt) + 1)).toISOString() },
    version: remote.version, recoveryExpectedVersion: remote.version.updatedAt })
  return quiz.id
}
