import { FunctionsHttpError } from '@supabase/supabase-js'
import type { AppSupabase } from '../../lib/supabase'
import { decodeAttempt } from '../../lib/attempt-storage'
import { decodeQuizDraftV4, requiresV4Draft } from '../../lib/draft-v4'
import type { AnswerMap, GradeResult } from '../../models/attempt'
import type { AnalyticsAttempt } from '../../models/analytics'
import type { DraftAnswerMapV4, DraftSchemaVersion, PracticeAttempt } from '../../models/draft-v4'
import type { Quiz } from '../../models/quiz'
import { GRADING_VERSION, type GradingVersion } from '../../models/grading-version'
import type { Database } from '../../types/database.types'
import { draftExactKeys, draftRecord, validDraftTimestamp } from '../../../supabase/functions/_shared/draft-v4.ts'
import { quizCatalog, type QuizCatalog } from './quiz-loader'
import { answerSchemaVersion, fromDatabasePractice, PersistenceError, toDatabase, trustedFillJudgments,
  trustedRubricJudgments, type AttemptRowWithSchema, type JudgmentRow, type RemoteVersion, type RubricJudgmentRow,
  type StoredPracticeAttempt } from './repositories'

type AttemptRow = AttemptRowWithSchema
type AnswerRow = Database['public']['Tables']['answers']['Row']
type JoinedRow = AttemptRow & { answers: AnswerRow[] }
export interface PracticeRecord {
  id: string
  row: AttemptRow
  quiz: Quiz | null
  attempt: PracticeAttempt | null
  version: RemoteVersion
  /** Server-owned answer schema marker (1 legacy/v3, 2 multimodal/v4). */
  schemaVersion: DraftSchemaVersion
}
export interface DraftReference { id: string; quizId: string; revision: string; updatedAt: string }
export interface SubmittedPage { records: PracticeRecord[]; nextOffset: number | null }
export interface SubmittedAnalyticsPage { records: AnalyticsAttempt[]; nextOffset: number | null }
export type FormalSubmission = { state: 'pending' } | { state: 'submitted'; result: GradeResult }
export class SubmissionError extends Error {
  readonly kind: 'conflict' | 'unavailable' | 'invalid'
  constructor(kind: SubmissionError['kind']) { super(kind); this.kind = kind }
}
const OFFICIAL_JUDGMENT_VERSIONS: readonly string[] = [GRADING_VERSION.semanticFillV2, GRADING_VERSION.aiGradingV3,
  GRADING_VERSION.aiGradingV4]
/** Local response consistency only; the browser never sends a grading version. */
export const expectedGradingVersion = (schema: DraftSchemaVersion): GradingVersion =>
  schema === 2 ? GRADING_VERSION.aiGradingV4 : GRADING_VERSION.aiGradingV3

async function edgeErrorStatus(error: unknown): Promise<{ status: number | null; code: unknown }> {
  // Only an HTTP error carries a trusted function status; relay and fetch failures are unavailable.
  const http = error instanceof FunctionsHttpError
    || (!!error && typeof error === 'object' && (error as { name?: unknown }).name === 'FunctionsHttpError')
  const context = http ? (error as { context?: unknown }).context : null
  if (!(context instanceof Response)) return { status: null, code: null }
  let code: unknown = null
  try {
    const body: unknown = await context.json()
    if (body && typeof body === 'object' && 'code' in body) code = body.code
  } catch { /* A non-JSON body keeps only the status. */ }
  return { status: context.status, code }
}
export const ANALYTICS_PAGE_SIZE = 50

interface RubricQuery extends PromiseLike<{ data: RubricJudgmentRow[] | null; error: unknown | null }> {
  select(columns: string): RubricQuery
  eq(column: string, value: string): RubricQuery
  in(column: string, values: string[]): RubricQuery
}
type RubricQueryClient = { from(table: 'rubric_judgments'): RubricQuery }

interface LoadedJudgments { fill: JudgmentRow[]; rubric: RubricJudgmentRow[] }

export function mapPracticeRecord(row: JoinedRow, userId: string, catalog: QuizCatalog = quizCatalog,
  judgments: JudgmentRow[] = [], rubricJudgments: RubricJudgmentRow[] = []): PracticeRecord {
  if (row.user_id !== userId || row.answers.some((answer) => answer.user_id !== userId || answer.attempt_id !== row.id)) {
    throw new PersistenceError('invalid')
  }
  const schemaVersion = answerSchemaVersion(row)
  const quiz = catalog.getQuizRevision(row.quiz_id, row.quiz_revision)
  let stored: StoredPracticeAttempt | null = null
  try { stored = quiz ? fromDatabasePractice(row, row.answers, quiz, userId, judgments, rubricJudgments) : null }
  catch (error) {
    if (!(error instanceof PersistenceError) || row.status !== 'submitted') throw error
  }
  return { id: row.id, row, quiz, attempt: stored?.attempt ?? null, version: { id: row.id, updatedAt: row.updated_at },
    schemaVersion }
}

/** Legacy-safe projection used only for objective occurrences (calculation answers are excluded). */
function objectiveAnswerMap(answers: DraftAnswerMapV4): AnswerMap {
  return Object.fromEntries(Object.entries(answers).filter(([, answer]) => answer.type !== 'calculation')) as AnswerMap
}

export function mapAnalyticsRecord(row: AttemptRow, answers: AnswerRow[], userId: string,
  catalog: QuizCatalog = quizCatalog, judgments: JudgmentRow[] = [],
  rubricJudgments: RubricJudgmentRow[] = []): AnalyticsAttempt {
  // Treat an ownership mismatch as a security failure, never as a skippable malformed row.
  if (row.user_id !== userId || answers.some((answer) => answer.user_id !== userId || answer.attempt_id !== row.id)) {
    throw new PersistenceError('invalid')
  }
  const base = { id: row.id, quizId: row.quiz_id, quizRevision: row.quiz_revision,
    submittedAt: row.submitted_at, status: row.status as AnalyticsAttempt['status'] }
  const quiz = catalog.getQuizRevision(row.quiz_id, row.quiz_revision)
  if (!quiz) return { ...base, quiz: null, answers: null, unavailableReason: 'missing-revision' }
  try {
    const stored = fromDatabasePractice(row, answers, quiz, userId, judgments, rubricJudgments)
    if (stored.attempt.status !== 'submitted' || row.status !== 'submitted') throw new PersistenceError('invalid')
    const version = row.grading_version
    if (stored.attempt.schemaVersion === 2) {
      if (version !== GRADING_VERSION.aiGradingV4) throw new PersistenceError('invalid')
      return { ...base, quiz, answers: objectiveAnswerMap(stored.attempt.answers), answersV4: stored.attempt.answers,
        gradingVersion: version, fillJudgments: trustedFillJudgments(row, judgments, userId, version),
        rubricJudgments: trustedRubricJudgments(row, rubricJudgments, userId, version), gradeResult: stored.attempt.result }
    }
    return { ...base, quiz, answers: stored.attempt.answers,
      gradingVersion: version as AnalyticsAttempt['gradingVersion'],
      fillJudgments: version === GRADING_VERSION.semanticFillV2 || version === GRADING_VERSION.aiGradingV3
        ? trustedFillJudgments(row, judgments, userId, version) : [],
      rubricJudgments: version === GRADING_VERSION.aiGradingV3
        ? trustedRubricJudgments(row, rubricJudgments, userId) : [], gradeResult: stored.attempt.result }
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

  private async loadJudgments(rows: AttemptRow[]): Promise<Map<string, LoadedJudgments>> {
    // Explicit versions only: semantic-fill-v2 (fill), ai-grading-v3/v4 (fill + rubric). Unknown versions
    // load no evidence and therefore decode as unavailable/malformed.
    const ids = rows.filter((row) => row.status === 'submitted' && OFFICIAL_JUDGMENT_VERSIONS.includes(row.grading_version))
      .map((row) => row.id)
    const result = new Map<string, LoadedJudgments>()
    if (!ids.length) return result
    const { data, error } = await this.client.from('fill_judgments').select('*')
      .eq('user_id', this.userId).in('attempt_id', ids)
    if (error) throw new PersistenceError('unavailable')
    const allowed = new Set(ids)
    for (const judgment of data ?? []) {
      if (judgment.user_id !== this.userId || !allowed.has(judgment.attempt_id)) throw new PersistenceError('invalid')
      const group = result.get(judgment.attempt_id) ?? { fill: [], rubric: [] }
      group.fill.push(judgment)
      result.set(judgment.attempt_id, group)
    }
    const rubricClient = this.client as unknown as RubricQueryClient
    const rubricResult = await rubricClient.from('rubric_judgments').select('*')
      .eq('user_id', this.userId).in('attempt_id', ids)
    if (rubricResult.error) throw new PersistenceError('unavailable')
    const allowedAttempts = new Set(ids)
    for (const judgment of rubricResult.data ?? []) {
      if (judgment.user_id !== this.userId || !allowedAttempts.has(judgment.attempt_id)) throw new PersistenceError('invalid')
      const group = result.get(judgment.attempt_id) ?? { fill: [], rubric: [] }
      group.rubric.push(judgment)
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
    const loaded = judgments.get(data.id)
    return mapPracticeRecord(data, this.userId, this.catalog, loaded?.fill ?? [], loaded?.rubric ?? [])
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

  async saveDraft(record: PracticeRecord, attempt: PracticeAttempt): Promise<StoredPracticeAttempt> {
    if (attempt.status !== 'in-progress' || !record.quiz || record.id !== record.version.id || attempt.quizId !== record.row.quiz_id
      || attempt.quizRevision !== record.row.quiz_revision) throw new PersistenceError('invalid')
    if (attempt.schemaVersion === 2) return this.saveDraftV4(record, record.quiz, attempt)
    // A server schema-2 draft is never written through the legacy v3 writer (no downgrade).
    if (record.schemaVersion !== 1 || !decodeAttempt(JSON.stringify(attempt), record.quiz)) throw new PersistenceError('invalid')
    const { data, error } = await this.client.rpc('save_quiz_attempt_v3', {
      p_attempt_id: record.id, p_payload: toDatabase(attempt, this.userId), p_expected_updated_at: record.version.updatedAt,
    })
    if (error) throw new PersistenceError(['40001', '23505', '23514'].includes(error.code) ? 'conflict' : 'unavailable')
    const row = data?.[0]
    if (!row || row.id !== record.id || row.user_id !== this.userId || row.quiz_revision !== attempt.quizRevision) throw new PersistenceError('invalid')
    return { attempt, version: { id: row.id, updatedAt: row.updated_at } }
  }

  /**
   * Schema-2 drafts are saved only through the authenticated save-quiz-draft Edge Function. The
   * browser sends changes and CAS only; owner, quiz, revision and schema are server-owned.
   */
  private async saveDraftV4(record: PracticeRecord, quiz: Quiz, attempt: Extract<PracticeAttempt, { schemaVersion: 2 }>):
    Promise<StoredPracticeAttempt> {
    if (attempt.status !== 'in-progress' || !requiresV4Draft(quiz) || !decodeQuizDraftV4(JSON.stringify(attempt), quiz)
      || !validDraftTimestamp(record.version.updatedAt) || !validDraftTimestamp(attempt.updatedAt)) throw new PersistenceError('invalid')
    const body = { attemptId: record.id, expectedUpdatedAt: record.version.updatedAt,
      clientUpdatedAt: attempt.updatedAt, answers: attempt.answers }
    const { data, error } = await this.client.functions.invoke('save-quiz-draft', { body })
    if (error) {
      const { status } = await edgeErrorStatus(error)
      // Never fall back to the v3 writer after a schema-2 failure.
      throw new PersistenceError(status === 409 ? 'conflict' : status === 400 || status === 413 ? 'invalid' : 'unavailable')
    }
    if (!draftRecord(data) || !draftExactKeys(data, ['attemptId', 'updatedAt', 'answerSchemaVersion'])
      || data.attemptId !== record.id || data.answerSchemaVersion !== 2 || !validDraftTimestamp(data.updatedAt)) {
      throw new PersistenceError('invalid')
    }
    return { attempt, version: { id: record.id, updatedAt: data.updatedAt } }
  }

  /**
   * Formal submission. The request is exactly {requestId, attemptId, expectedUpdatedAt}; the expected
   * grading version is checked locally against the response and is never sent to the server.
   */
  async submitDraft(attemptId: string, expectedUpdatedAt: string, requestId: string,
    gradingVersion: GradingVersion = GRADING_VERSION.aiGradingV3): Promise<FormalSubmission> {
    const { data, error } = await this.client.functions.invoke('submit-quiz', {
      body: { requestId, attemptId, expectedUpdatedAt },
    })
    if (error) {
      const { status, code } = await edgeErrorStatus(error)
      if (code === 'conflict' || status === 409) throw new SubmissionError('conflict')
      if (status === 422 && code === 'invalid_answers') throw new SubmissionError('invalid')
      throw new SubmissionError('unavailable')
    }
    if (data && typeof data === 'object' && data.code === 'in_progress') return { state: 'pending' }
    if (!data || typeof data !== 'object' || data.attemptId !== attemptId
      || data.gradingVersion !== gradingVersion || !data.result
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
    return { records: page.map((row) => {
      const loaded = judgments.get(row.id)
      return mapPracticeRecord(row, this.userId, this.catalog, loaded?.fill ?? [], loaded?.rubric ?? [])
    }),
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
    return { records: rows.map((row) => {
      const loaded = judgments.get(row.id)
      return mapAnalyticsRecord(row, answersByAttempt.get(row.id) ?? [],
        this.userId, this.catalog, loaded?.fill ?? [], loaded?.rubric ?? [])
    }),
      nextOffset: (data?.length ?? 0) > ANALYTICS_PAGE_SIZE ? offset + ANALYTICS_PAGE_SIZE : null }
  }

  async loadLatestSubmittedForQuiz(quizId: string): Promise<PracticeRecord | null> {
    const { data, error } = await this.client.from('attempts').select('*, answers(*)')
      .eq('user_id', this.userId).eq('quiz_id', quizId).eq('status', 'submitted')
      .order('submitted_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()
    if (error) throw new PersistenceError('unavailable')
    if (!data) return null
    const judgments = await this.loadJudgments([data])
    const loaded = judgments.get(data.id)
    return mapPracticeRecord(data, this.userId, this.catalog, loaded?.fill ?? [], loaded?.rubric ?? [])
  }
}
