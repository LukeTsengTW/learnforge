import type { QuizAttempt } from '../../models/attempt'
import type { Quiz } from '../../models/quiz'
import type { Database, Json } from '../../types/database.types'
import type { AppSupabase } from '../../lib/supabase'
import { decodeAttempt } from '../../lib/attempt-storage'

export interface RemoteVersion { id: string; updatedAt: string }
export interface StoredAttempt { attempt: QuizAttempt; version: RemoteVersion | null }
export interface AttemptRepository {
  load(): Promise<StoredAttempt | null>
  save(value: StoredAttempt): Promise<StoredAttempt>
  delete(version: RemoteVersion | null): Promise<void>
}
export class PersistenceError extends Error {
  readonly kind: 'invalid' | 'conflict' | 'unavailable'
  constructor(kind: PersistenceError['kind']) { super(kind); this.kind = kind }
}
export type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export const cacheKey = (userId: string, quizId: string) => `learnforge:attempt:v2:${userId}:${quizId}`
export class LocalAttemptRepository implements AttemptRepository {
  readonly key: string
  readonly quiz: Quiz
  readonly storage: () => StoragePort
  constructor(quiz: Quiz, userId: string, storage: () => StoragePort = () => window.localStorage) {
    this.quiz = quiz; this.key = cacheKey(userId, quiz.id); this.storage = storage
  }
  read(): StoredAttempt | null {
    const raw = this.storage().getItem(this.key)
    if (!raw) return null
    let value: unknown
    try { value = JSON.parse(raw) } catch { throw new PersistenceError('invalid') }
    if (typeof value !== 'object' || value === null || !('schemaVersion' in value) || value.schemaVersion !== 2 || !('attempt' in value) || !('version' in value)) throw new PersistenceError('invalid')
    const attempt = decodeAttempt(JSON.stringify(value.attempt), this.quiz)
    const v = value.version
    if (!attempt || (v !== null && (typeof v !== 'object' || !('id' in v) || typeof v.id !== 'string' || !('updatedAt' in v) || typeof v.updatedAt !== 'string' || !Number.isFinite(Date.parse(v.updatedAt))))) throw new PersistenceError('invalid')
    return { attempt, version: v as RemoteVersion | null }
  }
  write(value: StoredAttempt): void { this.storage().setItem(this.key, JSON.stringify({ schemaVersion: 2, ...value })) }
  archive(value: StoredAttempt): void {
    // A conflicting valid attempt remains recoverable instead of being silently overwritten.
    this.storage().setItem(`${this.key}:recovery:${crypto.randomUUID()}`, JSON.stringify({ schemaVersion: 2, ...value }))
  }
  preserveRaw(): void {
    const raw = this.storage().getItem(this.key)
    if (raw !== null) this.storage().setItem(`${this.key}:recovery:${crypto.randomUUID()}`, raw)
  }
  async load() { return this.read() }
  async save(value: StoredAttempt) { this.write(value); return value }
  async delete() { this.storage().removeItem(this.key) }
}

type AttemptRow = Database['public']['Tables']['attempts']['Row']
type AnswerRow = Database['public']['Tables']['answers']['Row']
export function fromDatabase(row: AttemptRow, answers: AnswerRow[], quiz: Quiz, userId: string): StoredAttempt {
  if (row.user_id !== userId || !['draft', 'submitted'].includes(row.status) || answers.some(a => a.user_id !== userId || a.attempt_id !== row.id)
    || new Set(answers.map(a => a.question_id)).size !== answers.length || !Number.isFinite(Date.parse(row.updated_at))) throw new PersistenceError('invalid')
  const attempt = decodeAttempt(JSON.stringify({ schemaVersion: 1, quizId: row.quiz_id, quizRevision: row.quiz_revision,
    startedAt: row.started_at, updatedAt: row.client_updated_at, submittedAt: row.submitted_at,
    status: row.status === 'draft' ? 'in-progress' : 'submitted', answers: Object.fromEntries(answers.map(a => [a.question_id, a.answer])) }), quiz)
  if (!attempt || Date.parse(attempt.updatedAt) < Date.parse(attempt.startedAt)
    || (attempt.status === 'submitted' && Date.parse(attempt.submittedAt) < Date.parse(attempt.startedAt))) throw new PersistenceError('invalid')
  // decodeAttempt regrades canonical answers; persisted score/grade JSON is never trusted.
  return { attempt, version: { id: row.id, updatedAt: row.updated_at } }
}
export function toDatabase(attempt: QuizAttempt, ownerId: string): Json {
  return JSON.parse(JSON.stringify({ ...attempt, ownerId })) as Json
}
export class SupabaseAttemptRepository implements AttemptRepository {
  readonly client: AppSupabase
  readonly quiz: Quiz
  readonly userId: string
  constructor(client: AppSupabase, quiz: Quiz, userId: string) { this.client = client; this.quiz = quiz; this.userId = userId }
  async load(): Promise<StoredAttempt | null> {
    const { data, error } = await this.client.from('attempts').select('*, answers(*)').eq('user_id', this.userId).eq('quiz_id', this.quiz.id).maybeSingle()
    if (error) throw new PersistenceError('unavailable')
    return data ? fromDatabase(data, data.answers, this.quiz, this.userId) : null
  }
  async save(value: StoredAttempt): Promise<StoredAttempt> {
    const valid = decodeAttempt(JSON.stringify(value.attempt), this.quiz)
    if (!valid) throw new PersistenceError('invalid')
    const { data, error } = await this.client.rpc('save_quiz_attempt', {
      p_quiz_id: this.quiz.id, p_payload: toDatabase(valid, this.userId),
      p_expected_id: value.version?.id, p_expected_updated_at: value.version?.updatedAt,
    })
    if (error) throw new PersistenceError(['40001', '23505', '23514'].includes(error.code) ? 'conflict' : 'unavailable')
    const row = data?.[0]
    if (!row || row.user_id !== this.userId) throw new PersistenceError('invalid')
    return { attempt: valid, version: { id: row.id, updatedAt: row.updated_at } }
  }
  async delete(version: RemoteVersion | null): Promise<void> {
    if (!version) {
      if (await this.load()) throw new PersistenceError('conflict')
      return
    }
    const { data, error } = await this.client.from('attempts').delete().eq('id', version.id).eq('updated_at', version.updatedAt).eq('user_id', this.userId).select('id')
    if (error) throw new PersistenceError('unavailable')
    if (data.length !== 1) throw new PersistenceError('conflict')
  }
}
