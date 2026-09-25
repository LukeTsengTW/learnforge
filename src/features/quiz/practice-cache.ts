import { decodeAttempt } from '../../lib/attempt-storage'
import type { QuizAttempt } from '../../models/attempt'
import type { Quiz } from '../../models/quiz'
import { resolveAttemptConflict, sameAttempt } from './sync'
import { cacheKey, PersistenceError, type RemoteVersion, type StoragePort } from './repositories'
import type { PracticeRecord } from './practice-repository'

export interface CachedPractice { id: string; attempt: QuizAttempt; version: RemoteVersion }
export const practiceCacheKey = (userId: string, attemptId: string) => `learnforge:attempt:v3:${userId}:${attemptId}`
export const draftIndexKey = (userId: string, quizId: string) => `learnforge:draft-index:v3:${userId}:${quizId}`

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
      return { id, attempt, version: value.version }
    } catch {
      this.backup(this.key(id), raw)
      throw new PersistenceError('invalid')
    }
  }
  write(value: CachedPractice): void {
    if (value.version.id !== value.id) throw new PersistenceError('invalid')
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
  archive(value: CachedPractice): void {
    this.storage().setItem(`${this.key(value.id)}:recovery:${crypto.randomUUID()}`,
      JSON.stringify({ schemaVersion: 3, ownerId: this.userId, ...value }))
  }
  removeDraft(value: CachedPractice): void {
    if (value.attempt.status !== 'in-progress') throw new PersistenceError('invalid')
    this.storage().removeItem(this.key(value.id))
    const index = draftIndexKey(this.userId, value.attempt.quizId)
    if (this.storage().getItem(index) === value.id) this.storage().removeItem(index)
  }
  /** Copy matching v2 data once; retain the old key as a recovery source. */
  migrateV2(record: PracticeRecord): CachedPractice | null {
    if (!record.quiz || !record.attempt) return null
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
  reconcile(record: PracticeRecord): CachedPractice {
    if (!record.quiz || !record.attempt) throw new PersistenceError('invalid')
    const remote = { id: record.id, attempt: record.attempt, version: record.version }
    const local = this.read(record.id, record.quiz) ?? this.migrateV2(record)
    if (!local) { this.write(remote); return remote }
    if (record.attempt.status === 'submitted') {
      if (!sameAttempt(local.attempt, remote.attempt)) {
        this.archive(local)
        this.storage().removeItem(this.key(record.id))
      }
      this.write(remote); return remote
    }
    if (local.attempt.status === 'submitted') {
      if (!sameAttempt(local.attempt, remote.attempt)) this.archive(remote)
      const winning = { ...local, version: record.version }
      this.write(winning); return winning
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
