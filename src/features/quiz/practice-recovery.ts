import { decodeAttempt } from '../../lib/attempt-storage'
import { decodeQuizDraftV4, requiresV4Draft, upgradeLegacyQuizDraftV4 } from '../../lib/draft-v4'
import type { QuizDraftV4 } from '../../models/draft-v4'
import type { Quiz } from '../../models/quiz'
import { LocalPracticeCache, type CachedPractice } from './practice-cache'
import { quizCatalog, type QuizCatalog } from './quiz-loader'
import type { PracticeRepository } from './practice-context'
import type { PracticeRecord } from './practice-repository'
import { PersistenceError } from './repositories'

export interface PracticeBackup {
  key: string; quizId: string; attemptId: string; savedAt: string | null; reason: string
  /** Draft schema recorded by the backup namespace (2 = multimodal v4 draft). */
  schemaVersion: 1 | 2
}
const isV4Key = (userId: string, key: string) => key.startsWith(`learnforge:attempt:v4:${userId}:`)
function ownsKey(userId: string, key: string) {
  return [2, 3, 4].some(version => key.startsWith(`learnforge:attempt:v${version}:${userId}:`)) && key.includes(':recovery:')
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
        reason: value?.recovery?.reason ?? (key.endsWith(':migration') ? '舊資料遷移／資料格式損壞' : '歷史同步衝突'),
        schemaVersion: isV4Key(userId, key) ? 2 : 1 })
    } catch { /* Never expose an envelope owned by a different account. */ }
  }
  return backups.sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''))
}

/** Remote must be this owner's untouched draft at the backup's exact revision and CAS version. */
function assertRestorableRemote(remote: PracticeRecord | null, userId: string, quiz: Quiz, expectedVersion: string) {
  if (!remote || remote.row.user_id !== userId || remote.row.status !== 'draft' || !remote.attempt
    || remote.row.quiz_revision !== quiz.revision || remote.version.updatedAt !== expectedVersion
    || Object.keys(remote.attempt.answers).length) throw new PersistenceError('conflict')
}

/**
 * Restores a backup as a LOCAL draft only; the next sync saves it through the schema-correct writer.
 * Schema-2 data is never parsed as schema 1, never downgraded, and malformed backups are left intact.
 */
export async function restorePracticeBackup(userId: string, key: string, storage: Storage, repo: PracticeRepository,
  catalog: QuizCatalog = quizCatalog): Promise<string> {
  const value = JSON.parse(readBackup(userId, key, storage)) as Record<string, unknown> & {
    id?: unknown; version?: { id?: unknown; updatedAt?: unknown }; attempt?: { quizId?: unknown; quizRevision?: unknown } }
  if (typeof value.id !== 'string' || value.id !== value.version?.id || typeof value.version.updatedAt !== 'string'
    || value.ownerId !== userId) throw new PersistenceError('invalid')
  const id = value.id, expectedVersion = value.version.updatedAt
  const quiz = catalog.getQuizRevision(String(value.attempt?.quizId), String(value.attempt?.quizRevision))
  if (!quiz) throw new PersistenceError('conflict')
  const cache = new LocalPracticeCache(userId, () => storage)
  const now = (updatedAt: string) => new Date(Math.max(Date.now(), Date.parse(updatedAt) + 1)).toISOString()

  let draft: QuizDraftV4
  let schema1Backup = false
  if (isV4Key(userId, key)) {
    // Schema-2 backup: v4 envelope + strict v4 grammar for an exact v4-capable revision only.
    if (value.cacheVersion !== 4 || !key.startsWith(`learnforge:attempt:v4:${userId}:${id}:recovery:`)) throw new PersistenceError('invalid')
    if (!requiresV4Draft(quiz)) throw new PersistenceError('conflict')
    const decoded = decodeQuizDraftV4(JSON.stringify(value.attempt), quiz)
    if (!decoded) throw new PersistenceError('conflict')
    draft = decoded
  } else {
    if (value.schemaVersion !== 3 || !key.startsWith(`learnforge:attempt:v3:${userId}:${id}:recovery:`)) throw new PersistenceError('invalid')
    const legacy = decodeAttempt(JSON.stringify(value.attempt), quiz)
    if (!legacy || legacy.status !== 'in-progress') throw new PersistenceError('conflict')
    if (requiresV4Draft(quiz)) {
      // A v4-capable revision only accepts schema-2 drafts: promote in memory, never write schema 1.
      const promoted = upgradeLegacyQuizDraftV4(legacy, quiz)
      if (!promoted) throw new PersistenceError('conflict')
      draft = promoted
      schema1Backup = true
    } else {
      const remote = await repo.loadAttempt(id)
      // Never downgrade: a server schema-2 draft is not restorable from a schema-1 backup.
      if (remote?.schemaVersion !== 1) throw new PersistenceError('conflict')
      assertRestorableRemote(remote, userId, quiz, expectedVersion)
      const local = cache.read(id, quiz)
      if (local && (local.attempt.status !== 'in-progress' || Object.keys(local.attempt.answers).length)) throw new PersistenceError('conflict')
      const restored: CachedPractice = { id, attempt: { ...legacy, updatedAt: now(legacy.updatedAt) },
        version: remote.version, recoveryExpectedVersion: remote.version.updatedAt }
      cache.write(restored)
      return quiz.id
    }
  }
  const remote = await repo.loadAttempt(id)
  // Explicit schema invariant (independent of CAS): a schema-1 backup may be promoted only while the
  // authoritative server draft is still marker 1. Once the server is marker 2 it is never applied.
  if (schema1Backup && remote?.schemaVersion !== 1) throw new PersistenceError('conflict')
  assertRestorableRemote(remote, userId, quiz, expectedVersion)
  const v4 = cache.forV4()
  const local = v4.read(id, quiz)
  if (local && Object.keys(local.attempt.answers).length) throw new PersistenceError('conflict')
  // The store's schema-2 path saves this through save-quiz-draft once the exact remote version still matches.
  v4.write({ id, attempt: { ...draft, updatedAt: now(draft.updatedAt) }, version: remote!.version,
    recoveryExpectedVersion: remote!.version.updatedAt })
  return quiz.id
}
