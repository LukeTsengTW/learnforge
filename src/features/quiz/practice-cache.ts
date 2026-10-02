import { decodeAttempt } from '../../lib/attempt-storage'
import { decodeQuizDraftV4, requiresV4Draft, upgradeLegacyQuizDraftV4 } from '../../lib/draft-v4'
import type { QuizAttempt } from '../../models/attempt'
import type { QuizAttemptV4, QuizDraftV4 } from '../../models/draft-v4'
import type { Quiz } from '../../models/quiz'
import { resolveAttemptConflict, sameAttempt } from './sync'
import { cacheKey, PersistenceError, type RemoteVersion, type StoragePort } from './repositories'
import type { PracticeRecord } from './practice-repository'

export interface CachedPractice { id: string; attempt: QuizAttempt; version: RemoteVersion; recoveryExpectedVersion?: string }
export const practiceCacheKey = (userId: string, attemptId: string) => `learnforge:attempt:v3:${userId}:${attemptId}`
export const draftIndexKey = (userId: string, quizId: string) => `learnforge:draft-index:v3:${userId}:${quizId}`
/**
 * Separate schema-2 namespace. Schema-1 client code only ever reads/writes the v2/v3 prefixes, so an
 * older already-open tab cannot overwrite (or downgrade) a schema-2 local draft.
 */
export const practiceCacheKeyV4 = (userId: string, attemptId: string) => `learnforge:attempt:v4:${userId}:${attemptId}`
export const STALE_V4_DRAFT_REASON = '雲端草稿已由其他分頁或裝置更新；此本機版本未自動套用'
export interface CachedPracticeV4 { id: string; attempt: QuizAttemptV4; version: RemoteVersion; recoveryExpectedVersion?: string }

export class LocalPracticeCacheV4 {
  readonly userId: string
  readonly storage: () => StoragePort
  constructor(userId: string, storage: () => StoragePort = () => window.localStorage) { this.userId = userId; this.storage = storage }
  private key(id: string) { return practiceCacheKeyV4(this.userId, id) }
  private backup(key: string, raw: string) {
    const backupKey = `${key}:recovery:migration`
    if (this.storage().getItem(backupKey) === null) this.storage().setItem(backupKey, raw)
  }
  private envelope(value: CachedPracticeV4) {
    return { cacheVersion: 4, ownerId: this.userId, id: value.id, version: value.version, attempt: value.attempt,
      ...(value.recoveryExpectedVersion ? { recoveryExpectedVersion: value.recoveryExpectedVersion } : {}) }
  }
  /** Strict read of a schema-2 local draft for its exact revision; corrupt bytes are backed up, never repaired. */
  read(id: string, quiz: Quiz): (CachedPracticeV4 & { attempt: QuizDraftV4 }) | null {
    // A non-capable exact revision can never legitimize schema-2 local data (bytes are left untouched).
    if (!requiresV4Draft(quiz)) throw new PersistenceError('invalid')
    const raw = this.storage().getItem(this.key(id))
    if (!raw) return null
    try {
      const value = JSON.parse(raw) as Record<string, unknown> & { version?: { id?: unknown; updatedAt?: unknown } }
      if (value.cacheVersion !== 4 || value.ownerId !== this.userId || value.id !== id
        || value.version?.id !== id || typeof value.version.updatedAt !== 'string'
        || !Number.isFinite(Date.parse(value.version.updatedAt))) throw new Error('Invalid cache envelope')
      const attempt = decodeQuizDraftV4(JSON.stringify(value.attempt), quiz)
      if (!attempt) throw new Error('Invalid schema-2 draft')
      return { id, attempt, version: { id, updatedAt: value.version.updatedAt },
        ...(typeof value.recoveryExpectedVersion === 'string' ? { recoveryExpectedVersion: value.recoveryExpectedVersion } : {}) }
    } catch {
      this.backup(this.key(id), raw)
      throw new PersistenceError('invalid')
    }
  }
  /** Only drafts are cached. A server-confirmed submission removes the draft; results come from the server. */
  write(value: CachedPracticeV4): void {
    if (value.version.id !== value.id || value.attempt.schemaVersion !== 2) throw new PersistenceError('invalid')
    if (value.attempt.status === 'submitted') { this.storage().removeItem(this.key(value.id)); return }
    this.storage().setItem(this.key(value.id), JSON.stringify(this.envelope(value)))
  }
  archive(value: CachedPracticeV4, reason = '同步版本衝突'): void {
    this.storage().setItem(`${this.key(value.id)}:recovery:${crypto.randomUUID()}`,
      JSON.stringify({ ...this.envelope(value), recovery: { savedAt: new Date().toISOString(), reason } }))
  }
  removeDraft(value: CachedPracticeV4): void {
    if (value.attempt.status !== 'in-progress') throw new PersistenceError('invalid')
    this.storage().removeItem(this.key(value.id))
  }
  /**
   * While the server marker is still 1, a matching schema-1 local draft (v3 namespace) is promoted in
   * memory into the v4 namespace. The v3 entry is retained as recovery evidence. A draft that cannot
   * be promoted is left untouched and the authoritative server draft is used instead.
   */
  promoteSchema1(record: PracticeRecord, quiz: Quiz): (CachedPracticeV4 & { attempt: QuizDraftV4 }) | null {
    if (record.schemaVersion !== 1 || !requiresV4Draft(quiz)) return null
    let legacy: CachedPractice | null
    try { legacy = new LocalPracticeCache(this.userId, this.storage).read(record.id, quiz) } catch { return null }
    // Only same-generation local work is promoted; older schema-1 data stays untouched in its own namespace.
    if (!legacy || legacy.version.id !== record.id || legacy.version.updatedAt !== record.version.updatedAt) return null
    const draft: QuizAttempt = legacy.attempt.status === 'in-progress' ? legacy.attempt
      : { schemaVersion: 1, quizId: legacy.attempt.quizId, quizRevision: legacy.attempt.quizRevision,
        startedAt: legacy.attempt.startedAt, updatedAt: legacy.attempt.updatedAt, answers: legacy.attempt.answers, status: 'in-progress' }
    const promoted = upgradeLegacyQuizDraftV4(draft, quiz)
    if (!promoted) return null
    const value = { id: record.id, attempt: promoted, version: legacy.version,
      ...(legacy.recoveryExpectedVersion ? { recoveryExpectedVersion: legacy.recoveryExpectedVersion } : {}) }
    this.write(value)
    return value
  }
  /** Same CAS + full-draft reconciliation as schema 1, applied to the effective schema-2 remote draft. */
  reconcile(record: PracticeRecord, remoteAttempt: QuizAttemptV4): CachedPracticeV4 {
    if (!record.quiz || !requiresV4Draft(record.quiz)) throw new PersistenceError('invalid')
    const remote: CachedPracticeV4 = { id: record.id, attempt: remoteAttempt, version: record.version }
    const local = this.read(record.id, record.quiz) ?? this.promoteSchema1(record, record.quiz)
    if (remoteAttempt.status === 'submitted') {
      if (local && !sameAttempt(local.attempt, remoteAttempt)) this.archive(local, '其他裝置或分頁已提交')
      this.storage().removeItem(this.key(record.id))
      return remote
    }
    if (!local) { this.write(remote); return remote }
    if (local.recoveryExpectedVersion && local.recoveryExpectedVersion !== record.version.updatedAt) {
      this.archive(local, '還原後雲端已有較新版本，已停止自動套用')
      this.storage().removeItem(this.key(record.id)); this.write(remote); return remote
    }
    if (local.version.updatedAt !== record.version.updatedAt) {
      // The server generation changed since this local draft was based on it. The active server draft
      // wins: stale local work is preserved as recovery evidence and is never rebound to the new CAS
      // (which would silently overwrite another tab's or device's save).
      if (!sameAttempt(local.attempt, remoteAttempt)) this.archive(local, STALE_V4_DRAFT_REASON)
      this.write(remote); return remote
    }
    if (resolveAttemptConflict(local.attempt, remoteAttempt) === 'local') {
      if (!sameAttempt(local.attempt, remoteAttempt)) this.archive(remote)
      const winning = { ...local, version: record.version }
      this.write(winning); return winning
    }
    if (!sameAttempt(local.attempt, remoteAttempt)) this.archive(local)
    this.write(remote); return remote
  }
}

export class LocalPracticeCache {
  readonly userId: string
  readonly storage: () => StoragePort
  constructor(userId: string, storage: () => StoragePort = () => window.localStorage) { this.userId = userId; this.storage = storage }
  private key(id: string) { return practiceCacheKey(this.userId, id) }
  private backup(key: string, raw: string) {
    const backupKey = `${key}:recovery:migration`
    if (this.storage().getItem(backupKey) === null) this.storage().setItem(backupKey, raw)
  }
  read(id: string, quiz: Quiz): CachedPractice | null {
    const raw = this.storage().getItem(this.key(id))
    if (!raw) return null
    try {
      const value = JSON.parse(raw) as CachedPractice & { schemaVersion: number; ownerId: string }
      if (value.schemaVersion !== 3 || value.ownerId !== this.userId || value.id !== id
        || value.version?.id !== id || typeof value.version.updatedAt !== 'string'
        || !Number.isFinite(Date.parse(value.version.updatedAt))) throw new Error('Invalid cache envelope')
      const attempt = decodeAttempt(JSON.stringify(value.attempt), quiz)
      if (!attempt) throw new Error('Invalid attempt')
      return { id, attempt, version: value.version, ...(typeof value.recoveryExpectedVersion === 'string' ? { recoveryExpectedVersion: value.recoveryExpectedVersion } : {}) }
    } catch {
      this.backup(this.key(id), raw)
      throw new PersistenceError('invalid')
    }
  }
  write(value: CachedPractice): void {
    if (value.version.id !== value.id || value.attempt.schemaVersion !== 1) throw new PersistenceError('invalid')
    const key = this.key(value.id)
    const previous = this.storage().getItem(key)
    if (previous) {
      const parsed = JSON.parse(previous) as CachedPractice
      if (parsed.attempt?.status === 'submitted' && !sameAttempt(parsed.attempt, value.attempt)) throw new PersistenceError('conflict')
    }
    this.storage().setItem(key, JSON.stringify({ schemaVersion: 3, ownerId: this.userId, ...value }))
    const index = draftIndexKey(this.userId, value.attempt.quizId)
    if (value.attempt.status === 'in-progress') this.storage().setItem(index, value.id)
    else if (this.storage().getItem(index) === value.id) this.storage().removeItem(index)
  }
  archive(value: CachedPractice, reason = '同步版本衝突'): void {
    this.storage().setItem(`${this.key(value.id)}:recovery:${crypto.randomUUID()}`,
      JSON.stringify({ schemaVersion: 3, ownerId: this.userId, ...value, recovery: { savedAt: new Date().toISOString(), reason } }))
  }
  removeDraft(value: CachedPractice): void {
    if (value.attempt.status !== 'in-progress') throw new PersistenceError('invalid')
    this.storage().removeItem(this.key(value.id))
    const index = draftIndexKey(this.userId, value.attempt.quizId)
    if (this.storage().getItem(index) === value.id) this.storage().removeItem(index)
  }
  /** Copy matching v2 data once; retain the old key as a recovery source. */
  migrateV2(record: PracticeRecord): CachedPractice | null {
    if (!record.quiz || !record.attempt || record.attempt.schemaVersion !== 1) return null
    const oldKey = cacheKey(this.userId, record.row.quiz_id)
    const raw = this.storage().getItem(oldKey)
    if (!raw) return null
    try {
      const value = JSON.parse(raw) as { schemaVersion: number; attempt: QuizAttempt; version: RemoteVersion | null }
      if (value.schemaVersion !== 2 || typeof value.version?.id !== 'string'
        || typeof value.version.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.version.updatedAt))) throw new Error('Invalid envelope')
      if (value.version.id !== record.id) return null
      const valid = decodeAttempt(JSON.stringify(value.attempt), record.quiz)
      if (!valid) throw new Error('Invalid attempt')
      const existing = this.read(record.id, record.quiz)
      if (existing) return existing
      const migrated = { id: record.id, attempt: valid, version: value.version }
      this.write(migrated)
      return migrated
    } catch {
      this.backup(oldKey, raw)
      return null
    }
  }
  /** Schema-2 adapter sharing this account's storage; it never touches the v3 namespace except to read for promotion. */
  forV4(): LocalPracticeCacheV4 { return new LocalPracticeCacheV4(this.userId, this.storage) }
  reconcile(record: PracticeRecord): CachedPractice {
    const attempt = record.attempt
    if (!record.quiz || !attempt || attempt.schemaVersion !== 1) throw new PersistenceError('invalid')
    const remote: CachedPractice = { id: record.id, attempt, version: record.version }
    const local = this.read(record.id, record.quiz) ?? this.migrateV2(record)
    if (!local) { this.write(remote); return remote }
    if (local.recoveryExpectedVersion && local.recoveryExpectedVersion !== record.version.updatedAt) {
      this.archive(local, '還原後雲端已有較新版本，已停止自動套用')
      this.storage().removeItem(this.key(record.id)); this.write(remote); return remote
    }
    if (attempt.status === 'submitted') {
      if (!sameAttempt(local.attempt, remote.attempt)) {
        this.archive(local)
        this.storage().removeItem(this.key(record.id))
      }
      this.write(remote); return remote
    }
    if (local.attempt.status === 'submitted') {
      // A pre-v1.1 offline submission is not an official submission. Preserve
      // its answers as a draft and require the formal server path on retry.
      this.archive(local, '舊版待同步提交已還原為草稿，需重新正式提交')
      this.storage().removeItem(this.key(record.id))
      const restored: CachedPractice = { id: record.id, version: record.version,
        attempt: { schemaVersion: 1, quizId: local.attempt.quizId,
          quizRevision: local.attempt.quizRevision, startedAt: local.attempt.startedAt,
          updatedAt: local.attempt.updatedAt, answers: local.attempt.answers,
          status: 'in-progress' } }
      this.write(restored); return restored
    }
    if (resolveAttemptConflict(local.attempt, remote.attempt) === 'local') {
      if (!sameAttempt(local.attempt, remote.attempt)) this.archive(remote)
      const winning = { ...local, version: record.version }
      this.write(winning); return winning
    }
    if (!sameAttempt(local.attempt, remote.attempt)) this.archive(local)
    this.write(remote); return remote
  }
}
