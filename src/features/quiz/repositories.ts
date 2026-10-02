import type { GradingVersion, QuizAttempt, TrustedFillJudgment, TrustedRubricJudgment } from '../../models/attempt'
import type { DraftSchemaVersion, PracticeAttempt, QuizAttemptV4 } from '../../models/draft-v4'
import type { Quiz } from '../../models/quiz'
import type { Database, Json } from '../../types/database.types'
import type { AppSupabase } from '../../lib/supabase'
import { decodeAttempt } from '../../lib/attempt-storage'
import { decodeDraftAnswersV4, requiresV4Draft } from '../../lib/draft-v4'
import { gradeQuizV3, gradeQuizV4, gradeQuizWithFillJudgments } from '../../lib/grading'
import { isCanonicalV4Score } from '../../lib/v4-score'
import { GRADING_VERSION } from '../../models/grading-version'

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
export type JudgmentRow = Database['public']['Tables']['fill_judgments']['Row']
export interface RubricJudgmentRow {
  user_id: string
  attempt_id: string
  quiz_id: string
  quiz_revision: string
  question_id: string
  question_type: string
  answer_hash: string
  judge_version: string
  source: string
  status: string
  score: number
  max_score: number
  criteria: unknown
  confidence: string | null
  summary: string | null
  details: unknown
  model: string | null
  reasoning_effort: string | null
  finalized_at: string
}
export function trustedFillJudgments(row: AttemptRow, judgments: JudgmentRow[], userId: string,
  judgeVersion: GradingVersion = GRADING_VERSION.semanticFillV2): TrustedFillJudgment[] {
  if (judgments.some((judgment) => judgment.user_id !== userId || judgment.attempt_id !== row.id
    || judgment.quiz_id !== row.quiz_id || judgment.quiz_revision !== row.quiz_revision
    || judgment.judge_version !== judgeVersion || !/^[a-f0-9]{64}$/.test(judgment.answer_hash)
    || !['rule', 'ai'].includes(judgment.source) || !['correct', 'incorrect', 'unanswered'].includes(judgment.status)
    || (judgment.source === 'ai' && (judgment.model !== 'gpt-6-luna' || judgment.reasoning_effort !== 'medium'
      || !['high', 'medium', 'low'].includes(judgment.confidence ?? '') || !judgment.reason?.trim()
      || judgment.reason.length > 240))
    || (judgment.source === 'rule' && (judgment.model !== null || judgment.reasoning_effort !== null
      || judgment.confidence !== null || judgment.reason !== null)))) throw new PersistenceError('invalid')
  return judgments.map((judgment) => ({
    questionId: judgment.question_id, source: judgment.source as 'rule' | 'ai',
    status: judgment.status as TrustedFillJudgment['status'], reason: judgment.reason,
  }))
}
export function trustedRubricJudgments(row: AttemptRow, judgments: RubricJudgmentRow[], userId: string,
  judgeVersion: typeof GRADING_VERSION.aiGradingV3 | typeof GRADING_VERSION.aiGradingV4 = GRADING_VERSION.aiGradingV3): TrustedRubricJudgment[] {
  // v4 evidence additionally follows the 8-decimal canonical score contract. The browser never
  // recomputes PostgreSQL's answer hash; it validates only the hash format and binding fields.
  if (judgeVersion === GRADING_VERSION.aiGradingV4 && judgments.some((judgment) => !isCanonicalV4Score(judgment.score)
    || !isCanonicalV4Score(judgment.max_score) || !Array.isArray(judgment.criteria)
    || judgment.criteria.some((criterion: unknown) => typeof criterion !== 'object' || criterion === null
      || !isCanonicalV4Score((criterion as Record<string, unknown>).awardedScore)
      || !isCanonicalV4Score((criterion as Record<string, unknown>).maxScore)))) throw new PersistenceError('invalid')
  if (judgments.some((judgment) => judgment.user_id !== userId || judgment.attempt_id !== row.id
    || judgment.quiz_id !== row.quiz_id || judgment.quiz_revision !== row.quiz_revision
    || judgment.judge_version !== judgeVersion
    || (judgment.question_type !== 'calculation' && judgment.question_type !== 'drawing')
    || !/^[a-f0-9]{64}$/.test(judgment.answer_hash) || !Number.isFinite(judgment.score)
    || !Number.isFinite(Date.parse(judgment.finalized_at))
    || !Number.isFinite(judgment.max_score) || !judgment.details || typeof judgment.details !== 'object'
    || Array.isArray(judgment.details)
    || (judgment.source === 'system' && (judgment.status !== 'unanswered' || judgment.score !== 0
      || !Array.isArray(judgment.criteria) || judgment.criteria.length !== 0 || judgment.confidence !== null
      || judgment.summary !== null || judgment.model !== null || judgment.reasoning_effort !== null
      || Object.keys(judgment.details).length !== 0))
    || (judgment.source === 'ai' && (!['correct', 'partial', 'incorrect'].includes(judgment.status)
      || judgment.model !== 'gpt-6-luna' || judgment.reasoning_effort !== 'medium'
      || !['high', 'medium', 'low'].includes(judgment.confidence ?? '')
      || typeof judgment.summary !== 'string' || !judgment.summary.trim()))
    || (judgment.source !== 'system' && judgment.source !== 'ai'))) throw new PersistenceError('invalid')
  if (new Set(judgments.map((judgment) => judgment.question_id)).size !== judgments.length) {
    throw new PersistenceError('invalid')
  }
  return judgments.map((judgment) => judgment.source === 'system'
    ? { questionId: judgment.question_id, questionType: judgment.question_type as 'calculation' | 'drawing',
      answerHash: judgment.answer_hash, source: 'system', status: 'unanswered', score: 0,
      maxScore: judgment.max_score, criteria: [] }
    : { questionId: judgment.question_id, questionType: judgment.question_type as 'calculation' | 'drawing',
      answerHash: judgment.answer_hash, source: 'ai', status: judgment.status as 'correct' | 'partial' | 'incorrect',
      score: judgment.score, maxScore: judgment.max_score,
      criteria: judgment.criteria as Extract<TrustedRubricJudgment, { source: 'ai' }>['criteria'],
      confidence: judgment.confidence as 'high' | 'medium' | 'low', summary: judgment.summary!,
      model: 'gpt-6-luna', reasoningEffort: 'medium',
      ...(judgment.details as Partial<Pick<Extract<TrustedRubricJudgment, { source: 'ai' }>,
        'strengths' | 'improvements' | 'observations' | 'missingOrUnclear'>>) })
}
/**
 * Server answer schema marker. Generated database types predate M3, so the field is a narrow,
 * runtime-validated intersection. Rows from a pre-M3 schema (no column) can only be schema 1.
 */
export type AttemptRowWithSchema = AttemptRow & { answer_schema_version?: number }
export function answerSchemaVersion(row: AttemptRowWithSchema): DraftSchemaVersion {
  const value = row.answer_schema_version
  if (value === undefined || value === 1) return 1
  if (value === 2) return 2
  throw new PersistenceError('invalid')
}

/** Stored schema-1 or schema-2 attempt for the client practice domain. */
export interface StoredPracticeAttempt { attempt: PracticeAttempt; version: RemoteVersion }

/** Dispatches strictly on the server marker; schema 2 is never decoded as schema 1 (or vice versa). */
export function fromDatabasePractice(row: AttemptRowWithSchema, answers: AnswerRow[], quiz: Quiz, userId: string,
  judgments: JudgmentRow[] = [], rubricJudgments: RubricJudgmentRow[] = []): StoredPracticeAttempt {
  if (answerSchemaVersion(row) === 2) return fromDatabaseV4(row, answers, quiz, userId, judgments, rubricJudgments)
  const stored = fromDatabase(row, answers, quiz, userId, judgments, rubricJudgments)
  return { attempt: stored.attempt, version: stored.version ?? { id: row.id, updatedAt: row.updated_at } }
}

/**
 * Schema-2 reader. Drafts decode only the strict v4 grammar for the exact revision. A submitted v4
 * attempt is recomposed with gradeQuizV4 from persisted fill/rubric evidence; no provider is called
 * and the stored aggregates must match the reconstruction.
 */
export function fromDatabaseV4(row: AttemptRowWithSchema, answers: AnswerRow[], quiz: Quiz, userId: string,
  judgments: JudgmentRow[] = [], rubricJudgments: RubricJudgmentRow[] = []): StoredPracticeAttempt & { attempt: QuizAttemptV4 } {
  // Schema 2 is legitimate only for an exact v4-capable revision, whatever the stored marker says.
  if (answerSchemaVersion(row) !== 2 || !requiresV4Draft(quiz) || row.user_id !== userId || !['draft', 'submitted'].includes(row.status)
    || row.quiz_id !== quiz.id || row.quiz_revision !== quiz.revision
    || answers.some((answer) => answer.user_id !== userId || answer.attempt_id !== row.id)
    || new Set(answers.map((answer) => answer.question_id)).size !== answers.length
    || !Number.isFinite(Date.parse(row.updated_at)) || !Number.isFinite(Date.parse(row.started_at))
    || !Number.isFinite(Date.parse(row.client_updated_at))
    || Date.parse(row.client_updated_at) < Date.parse(row.started_at)) throw new PersistenceError('invalid')
  const decoded = decodeDraftAnswersV4(quiz, Object.fromEntries(answers.map((answer) => [answer.question_id, answer.answer])))
  if (!decoded) throw new PersistenceError('invalid')
  const version = { id: row.id, updatedAt: row.updated_at }
  if (row.status === 'draft') {
    if (row.grading_version !== GRADING_VERSION.deterministicV1 || row.submission_request_id !== null) throw new PersistenceError('invalid')
    return { attempt: { schemaVersion: 2, quizId: quiz.id, quizRevision: quiz.revision, status: 'in-progress',
      startedAt: row.started_at, updatedAt: row.client_updated_at, answers: decoded }, version }
  }
  if (row.grading_version !== GRADING_VERSION.aiGradingV4 || !row.submitted_at
    || Date.parse(row.submitted_at) < Date.parse(row.started_at)) throw new PersistenceError('invalid')
  try {
    const fill = trustedFillJudgments(row, judgments, userId, GRADING_VERSION.aiGradingV4)
    const rubric = trustedRubricJudgments(row, rubricJudgments, userId, GRADING_VERSION.aiGradingV4)
    const result = gradeQuizV4(quiz, decoded, fill, rubric)
    const partialCount = (row as AttemptRow & { partial_count?: number }).partial_count
    if (partialCount !== result.partialCount || row.deterministic_score !== result.score
      || row.deterministic_max_score !== result.maxScore || row.correct_count !== result.correctCount
      || row.incorrect_count !== result.incorrectCount || row.unanswered_count !== result.unansweredCount) {
      throw new PersistenceError('invalid')
    }
    return { attempt: { schemaVersion: 2, quizId: quiz.id, quizRevision: quiz.revision, status: 'submitted',
      startedAt: row.started_at, updatedAt: row.client_updated_at, submittedAt: row.submitted_at,
      answers: decoded, result }, version }
  } catch { throw new PersistenceError('invalid') }
}

export function fromDatabase(row: AttemptRow, answers: AnswerRow[], quiz: Quiz, userId: string,
  judgments: JudgmentRow[] = [], rubricJudgments: RubricJudgmentRow[] = []): StoredAttempt {
  if (answerSchemaVersion(row) !== 1) throw new PersistenceError('invalid')
  if (row.user_id !== userId || !['draft', 'submitted'].includes(row.status) || answers.some(a => a.user_id !== userId || a.attempt_id !== row.id)
    || new Set(answers.map(a => a.question_id)).size !== answers.length || !Number.isFinite(Date.parse(row.updated_at))) throw new PersistenceError('invalid')
  const attempt = decodeAttempt(JSON.stringify({ schemaVersion: 1, quizId: row.quiz_id, quizRevision: row.quiz_revision,
    startedAt: row.started_at, updatedAt: row.client_updated_at, submittedAt: row.submitted_at,
    status: row.status === 'draft' ? 'in-progress' : 'submitted', answers: Object.fromEntries(answers.map(a => [a.question_id, a.answer])) }), quiz)
  if (!attempt || Date.parse(attempt.updatedAt) < Date.parse(attempt.startedAt)
    || (attempt.status === 'submitted' && Date.parse(attempt.submittedAt) < Date.parse(attempt.startedAt))) throw new PersistenceError('invalid')
  // Legacy submissions keep deterministic grading. New submissions use only the
  // immutable server judgment rows; persisted aggregate score fields remain caches.
  if (attempt.status === 'submitted' && row.grading_version === GRADING_VERSION.semanticFillV2) {
    const trusted = trustedFillJudgments(row, judgments, userId)
    try { return { attempt: { ...attempt, result: gradeQuizWithFillJudgments(quiz, attempt.answers, trusted) },
      version: { id: row.id, updatedAt: row.updated_at } } }
    catch { throw new PersistenceError('invalid') }
  }
  if (attempt.status === 'submitted' && row.grading_version === GRADING_VERSION.aiGradingV3) {
    try {
      const fill = trustedFillJudgments(row, judgments, userId, GRADING_VERSION.aiGradingV3)
      const rubric = trustedRubricJudgments(row, rubricJudgments, userId)
      const result = gradeQuizV3(quiz, attempt.answers, fill, rubric)
      const partialCount = (row as AttemptRow & { partial_count?: number }).partial_count
      if (partialCount !== result.partialCount || row.deterministic_score !== result.score
        || row.deterministic_max_score !== result.maxScore || row.correct_count !== result.correctCount
        || row.incorrect_count !== result.incorrectCount || row.unanswered_count !== result.unansweredCount) {
        throw new PersistenceError('invalid')
      }
      return { attempt: { ...attempt, result }, version: { id: row.id, updatedAt: row.updated_at } }
    } catch { throw new PersistenceError('invalid') }
  }
  if (row.grading_version !== GRADING_VERSION.deterministicV1) throw new PersistenceError('invalid')
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
