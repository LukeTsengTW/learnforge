import type { AppSupabase } from '../../lib/supabase'
import { decodeAttempt } from '../../lib/attempt-storage'
import type { GradeResult, QuizAttempt } from '../../models/attempt'
import type { AnalyticsAttempt } from '../../models/analytics'
import type { Quiz } from '../../models/quiz'
import type { Database } from '../../types/database.types'
import { quizCatalog, type QuizCatalog } from './quiz-loader'
import { fromDatabase, PersistenceError, toDatabase, trustedFillJudgments,
  type JudgmentRow, type RemoteVersion, type StoredAttempt } from './repositories'

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
export interface SubmittedAnalyticsPage { records: AnalyticsAttempt[]; nextOffset: number | null }
export type FormalSubmission = { state: 'pending' } | { state: 'submitted'; result: GradeResult }
export class SubmissionError extends Error {
  readonly kind: 'conflict' | 'unavailable'
  constructor(kind: SubmissionError['kind']) { super(kind); this.kind = kind }
}
export const ANALYTICS_PAGE_SIZE = 50

export function mapPracticeRecord(row: JoinedRow, userId: string, catalog: QuizCatalog = quizCatalog,
  judgments: JudgmentRow[] = []): PracticeRecord {
  if (row.user_id !== userId || row.answers.some((answer) => answer.user_id !== userId || answer.attempt_id !== row.id)) {
    throw new PersistenceError('invalid')
  }
  const quiz = catalog.getQuizRevision(row.quiz_id, row.quiz_revision)
  let stored: StoredAttempt | null = null
  try { stored = quiz ? fromDatabase(row, row.answers, quiz, userId, judgments) : null }
  catch (error) {
    if (!(error instanceof PersistenceError) || row.status !== 'submitted') throw error
  }
  return { id: row.id, row, quiz, attempt: stored?.attempt ?? null, version: { id: row.id, updatedAt: row.updated_at } }
}

export function mapAnalyticsRecord(row: AttemptRow, answers: AnswerRow[], userId: string,
  catalog: QuizCatalog = quizCatalog, judgments: JudgmentRow[] = []): AnalyticsAttempt {
  // Treat an ownership mismatch as a security failure, never as a skippable malformed row.
  if (row.user_id !== userId || answers.some((answer) => answer.user_id !== userId || answer.attempt_id !== row.id)) {
    throw new PersistenceError('invalid')
  }
  const base = { id: row.id, quizId: row.quiz_id, quizRevision: row.quiz_revision,
    submittedAt: row.submitted_at, status: row.status as AnalyticsAttempt['status'] }
  const quiz = catalog.getQuizRevision(row.quiz_id, row.quiz_revision)
  if (!quiz) return { ...base, quiz: null, answers: null, unavailableReason: 'missing-revision' }
  try {
    const stored = fromDatabase(row, answers, quiz, userId, judgments)
    if (stored.attempt.status !== 'submitted' || row.status !== 'submitted') throw new PersistenceError('invalid')
    return { ...base, quiz, answers: stored.attempt.answers,
      gradingVersion: row.grading_version as AnalyticsAttempt['gradingVersion'],
      fillJudgments: row.grading_version === 'semantic-fill-v2' ? trustedFillJudgments(row, judgments, userId) : [] }
  } catch {
    return { ...base, quiz, answers: null, unavailableReason: 'malformed' }
  }
}

export class SupabasePracticeRepository {
  readonly client: AppSupabase
  readonly userId: string
  readonly catalog: QuizCatalog
  constructor(client: AppSupabase, userId: string, catalog: QuizCatalog = quizCatalog) {
    this.client = client; this.userId = userId; this.catalog = catalog
  }

  private async loadJudgments(rows: AttemptRow[]): Promise<Map<string, JudgmentRow[]>> {
    const ids = rows.filter((row) => row.status === 'submitted' && row.grading_version === 'semantic-fill-v2')
      .map((row) => row.id)
    const result = new Map<string, JudgmentRow[]>()
    if (!ids.length) return result
    const { data, error } = await this.client.from('fill_judgments').select('*')
      .eq('user_id', this.userId).in('attempt_id', ids)
    if (error) throw new PersistenceError('unavailable')
    const allowed = new Set(ids)
    for (const judgment of data ?? []) {
      if (judgment.user_id !== this.userId || !allowed.has(judgment.attempt_id)) throw new PersistenceError('invalid')
      const group = result.get(judgment.attempt_id) ?? []
      group.push(judgment)
      result.set(judgment.attempt_id, group)
    }
    return result
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
    if (!data) return null
    const judgments = await this.loadJudgments([data])
    return mapPracticeRecord(data, this.userId, this.catalog, judgments.get(data.id) ?? [])
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
    if (attempt.status !== 'in-progress' || !record.quiz || record.id !== record.version.id || attempt.quizId !== record.row.quiz_id
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

  async submitDraft(attemptId: string, expectedUpdatedAt: string, requestId: string): Promise<FormalSubmission> {
    const { data, error } = await this.client.functions.invoke('submit-quiz', {
      body: { requestId, attemptId, expectedUpdatedAt },
    })
    if (error) {
      const context = 'context' in error ? error.context : null
      if (context instanceof Response) {
        try {
          const body: unknown = await context.json()
          if (body && typeof body === 'object' && 'code' in body && body.code === 'conflict') {
            throw new SubmissionError('conflict')
          }
        } catch (failure) { if (failure instanceof SubmissionError) throw failure }
      }
      throw new SubmissionError('unavailable')
    }
    if (data && typeof data === 'object' && data.code === 'in_progress') return { state: 'pending' }
    if (!data || typeof data !== 'object' || data.attemptId !== attemptId
      || data.gradingVersion !== 'semantic-fill-v2' || !data.result
      || typeof data.result.score !== 'number' || !Array.isArray(data.result.questions)) {
      throw new SubmissionError('unavailable')
    }
    return { state: 'submitted', result: data.result as GradeResult }
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
    const page = rows.slice(0, pageSize)
    const judgments = await this.loadJudgments(page)
    return { records: page.map((row) => mapPracticeRecord(row, this.userId, this.catalog, judgments.get(row.id) ?? [])),
      nextOffset: rows.length > pageSize ? offset + pageSize : null }
  }

  /** One attempts read and one answer read per 50-row page; a 51st attempt signals truncation. */
  async listSubmittedAnalyticsPage(offset = 0): Promise<SubmittedAnalyticsPage> {
    const { data, error } = await this.client.from('attempts').select('*')
      .eq('user_id', this.userId).eq('status', 'submitted')
      .order('submitted_at', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + ANALYTICS_PAGE_SIZE)
    if (error) throw new PersistenceError('unavailable')
    const rows = (data ?? []).slice(0, ANALYTICS_PAGE_SIZE)
    if (!rows.length) return { records: [], nextOffset: null }
    const ids = rows.map((row) => row.id)
    const idSet = new Set(ids)
    const answerResult = await this.client.from('answers').select('*')
      .eq('user_id', this.userId).in('attempt_id', ids)
    if (answerResult.error) throw new PersistenceError('unavailable')
    const answersByAttempt = new Map<string, AnswerRow[]>()
    for (const answer of answerResult.data ?? []) {
      if (!idSet.has(answer.attempt_id)) throw new PersistenceError('invalid')
      const group = answersByAttempt.get(answer.attempt_id) ?? []
      group.push(answer)
      answersByAttempt.set(answer.attempt_id, group)
    }
    const judgments = await this.loadJudgments(rows)
    return { records: rows.map((row) => mapAnalyticsRecord(row, answersByAttempt.get(row.id) ?? [],
      this.userId, this.catalog, judgments.get(row.id) ?? [])),
      nextOffset: (data?.length ?? 0) > ANALYTICS_PAGE_SIZE ? offset + ANALYTICS_PAGE_SIZE : null }
  }

  async loadLatestSubmittedForQuiz(quizId: string): Promise<PracticeRecord | null> {
    const { data, error } = await this.client.from('attempts').select('*, answers(*)')
      .eq('user_id', this.userId).eq('quiz_id', quizId).eq('status', 'submitted')
      .order('submitted_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()
    if (error) throw new PersistenceError('unavailable')
    if (!data) return null
    const judgments = await this.loadJudgments([data])
    return mapPracticeRecord(data, this.userId, this.catalog, judgments.get(data.id) ?? [])
  }
}
