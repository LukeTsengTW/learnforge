import type { AppSupabase } from '../../lib/supabase'
import { decodeAttempt } from '../../lib/attempt-storage'
import type { QuizAttempt } from '../../models/attempt'
import type { Quiz } from '../../models/quiz'
import type { Database } from '../../types/database.types'
import { quizCatalog, type QuizCatalog } from './quiz-loader'
import { fromDatabase, PersistenceError, toDatabase, type RemoteVersion, type StoredAttempt } from './repositories'

type AttemptRow = Database['public']['Tables']['attempts']['Row']
type AnswerRow = Database['public']['Tables']['answers']['Row']
type JoinedRow = AttemptRow & { answers: AnswerRow[] }
export interface PracticeRecord {
  id: string
  row: AttemptRow
  quiz: Quiz | null
  attempt: QuizAttempt | null
  version: RemoteVersion
}
export interface DraftReference { id: string; quizId: string; revision: string; updatedAt: string }
export interface SubmittedPage { records: PracticeRecord[]; nextOffset: number | null }

export function mapPracticeRecord(row: JoinedRow, userId: string, catalog: QuizCatalog = quizCatalog): PracticeRecord {
  if (row.user_id !== userId || row.answers.some((answer) => answer.user_id !== userId || answer.attempt_id !== row.id)) {
    throw new PersistenceError('invalid')
  }
  const quiz = catalog.getQuizRevision(row.quiz_id, row.quiz_revision)
  const stored = quiz ? fromDatabase(row, row.answers, quiz, userId) : null
  return { id: row.id, row, quiz, attempt: stored?.attempt ?? null, version: { id: row.id, updatedAt: row.updated_at } }
}

export class SupabasePracticeRepository {
  readonly client: AppSupabase
  readonly userId: string
  readonly catalog: QuizCatalog
  constructor(client: AppSupabase, userId: string, catalog: QuizCatalog = quizCatalog) {
    this.client = client; this.userId = userId; this.catalog = catalog
  }

  async listCurrentDrafts(): Promise<DraftReference[]> {
    const { data, error } = await this.client.from('attempts').select('id,quiz_id,quiz_revision,updated_at')
      .eq('user_id', this.userId).eq('status', 'draft')
    if (error) throw new PersistenceError('unavailable')
    return (data ?? []).map((row) => ({ id: row.id, quizId: row.quiz_id, revision: row.quiz_revision, updatedAt: row.updated_at }))
  }

  async loadAttempt(attemptId: string): Promise<PracticeRecord | null> {
    const { data, error } = await this.client.from('attempts').select('*, answers(*)')
      .eq('id', attemptId).eq('user_id', this.userId).maybeSingle()
    if (error) throw new PersistenceError('unavailable')
    return data ? mapPracticeRecord(data, this.userId, this.catalog) : null
  }

  async getOrCreateDraft(currentQuiz: Quiz): Promise<PracticeRecord> {
    const { data, error } = await this.client.rpc('get_or_create_quiz_draft', {
      p_owner_id: this.userId, p_quiz_id: currentQuiz.id, p_quiz_revision: currentQuiz.revision,
    })
    if (error) throw new PersistenceError(error.code === '23505' ? 'conflict' : 'unavailable')
    const row = data?.[0]
    if (!row || row.user_id !== this.userId || row.quiz_id !== currentQuiz.id || row.status !== 'draft') throw new PersistenceError('invalid')
    const loaded = await this.loadAttempt(row.id)
    if (!loaded || loaded.row.status !== 'draft') throw new PersistenceError('conflict')
    return loaded
  }

  async saveDraft(record: PracticeRecord, attempt: QuizAttempt): Promise<StoredAttempt> {
    if (!record.quiz || record.id !== record.version.id || attempt.quizId !== record.row.quiz_id
      || attempt.quizRevision !== record.row.quiz_revision || !decodeAttempt(JSON.stringify(attempt), record.quiz)) {
      throw new PersistenceError('invalid')
    }
    const { data, error } = await this.client.rpc('save_quiz_attempt_v3', {
      p_attempt_id: record.id, p_payload: toDatabase(attempt, this.userId), p_expected_updated_at: record.version.updatedAt,
    })
    if (error) throw new PersistenceError(['40001', '23505', '23514'].includes(error.code) ? 'conflict' : 'unavailable')
    const row = data?.[0]
    if (!row || row.id !== record.id || row.user_id !== this.userId || row.quiz_revision !== attempt.quizRevision) throw new PersistenceError('invalid')
    return { attempt, version: { id: row.id, updatedAt: row.updated_at } }
  }

  async deleteDraft(record: PracticeRecord): Promise<void> {
    if (record.row.status !== 'draft') throw new PersistenceError('invalid')
    const { data, error } = await this.client.from('attempts').delete().eq('id', record.id)
      .eq('user_id', this.userId).eq('status', 'draft').eq('updated_at', record.version.updatedAt).select('id')
    if (error) throw new PersistenceError('unavailable')
    if (data?.length !== 1) throw new PersistenceError('conflict')
  }

  async listSubmittedPage(offset = 0, pageSize = 20): Promise<SubmittedPage> {
    const { data, error } = await this.client.from('attempts').select('*, answers(*)')
      .eq('user_id', this.userId).eq('status', 'submitted')
      .order('submitted_at', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + pageSize)
    if (error) throw new PersistenceError('unavailable')
    const rows = data ?? []
    return { records: rows.slice(0, pageSize).map((row) => mapPracticeRecord(row, this.userId, this.catalog)),
      nextOffset: rows.length > pageSize ? offset + pageSize : null }
  }

  async loadLatestSubmittedForQuiz(quizId: string): Promise<PracticeRecord | null> {
    const { data, error } = await this.client.from('attempts').select('*, answers(*)')
      .eq('user_id', this.userId).eq('quiz_id', quizId).eq('status', 'submitted')
      .order('submitted_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()
    if (error) throw new PersistenceError('unavailable')
    return data ? mapPracticeRecord(data, this.userId, this.catalog) : null
  }
}
