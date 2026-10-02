import { createAttempt } from '../../lib/attempt'
import { reduceAttempt } from '../../lib/attempt'
import type { QuizAttempt } from '../../models/attempt'
import type { PracticeAttempt } from '../../models/draft-v4'
import type { AnalyticsAttempt } from '../../models/analytics'
import type { Quiz } from '../../models/quiz'
import type { Database } from '../../types/database.types'
import type { PracticeRepository } from './practice-context'
import { ANALYTICS_PAGE_SIZE, type DraftReference, type PracticeRecord, type SubmittedPage,
  type SubmittedAnalyticsPage } from './practice-repository'
import { PersistenceError, type StoredPracticeAttempt } from './repositories'

type AttemptRow = Database['public']['Tables']['attempts']['Row']
/** Schema-1 test records: asserts the historical attempt shape instead of an unchecked cast. */
export function legacyAttempt(record: { attempt: PracticeAttempt | null }): QuizAttempt {
  if (!record.attempt || record.attempt.schemaVersion !== 1) throw new Error('Expected a schema-1 attempt')
  return record.attempt
}
export function createMemoryPracticeRepository(userId: string): PracticeRepository & { all(): PracticeRecord[] } {
  const records = new Map<string, PracticeRecord>()
  let counter = 0
  const timestamp = () => new Date(Date.now() + ++counter).toISOString()
  const clone = (record: PracticeRecord) => structuredClone(record)
  return {
    all: () => [...records.values()].map(clone),
    async listCurrentDrafts(): Promise<DraftReference[]> {
      return [...records.values()].filter((record) => record.row.status === 'draft').map((record) => ({
        id: record.id, quizId: record.row.quiz_id, revision: record.row.quiz_revision, updatedAt: record.row.updated_at,
      }))
    },
    async loadAttempt(id: string) { return records.has(id) ? clone(records.get(id)!) : null },
    async getOrCreateDraft(quiz: Quiz) {
      const existing = [...records.values()].find((record) => record.row.quiz_id === quiz.id && record.row.status === 'draft')
      if (existing) return clone(existing)
      const now = timestamp(), id = `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`
      const attempt = createAttempt(quiz, now)
      const row: AttemptRow = { id, user_id: userId, quiz_id: quiz.id, quiz_revision: quiz.revision,
        status: 'draft', started_at: now, client_updated_at: now, submitted_at: null,
        grading_version: 'deterministic-v1', submission_request_id: null,
        deterministic_score: null, deterministic_max_score: null, correct_count: null, partial_count: 0, incorrect_count: null, unanswered_count: null,
        created_at: now, updated_at: now }
      const record: PracticeRecord = { id, row, quiz, attempt, version: { id, updatedAt: now }, schemaVersion: 1 }
      records.set(id, record)
      return clone(record)
    },
    async saveDraft(record: PracticeRecord, attempt: PracticeAttempt): Promise<StoredPracticeAttempt> {
      const stored = records.get(record.id)
      if (!stored || stored.row.status !== 'draft' || stored.version.updatedAt !== record.version.updatedAt
        || stored.row.quiz_revision !== attempt.quizRevision || attempt.status !== 'in-progress'
        || attempt.schemaVersion !== 1) throw new PersistenceError('conflict')
      const now = timestamp()
      stored.attempt = structuredClone(attempt)
      stored.row = { ...stored.row, client_updated_at: attempt.updatedAt, updated_at: now }
      stored.version = { id: record.id, updatedAt: now }
      return { attempt, version: stored.version }
    },
    async submitDraft(attemptId: string, expectedUpdatedAt: string, requestId: string) {
      const stored = records.get(attemptId)
      if (!stored || !stored.quiz || !stored.attempt || stored.attempt.schemaVersion !== 1 || stored.row.status !== 'draft'
        || stored.version.updatedAt !== expectedUpdatedAt) throw new PersistenceError('conflict')
      const now = timestamp()
      const submitted = reduceAttempt(stored.quiz, stored.attempt, { type: 'submit', now })
      if (submitted.status !== 'submitted') throw new PersistenceError('invalid')
      stored.attempt = submitted
      stored.row = { ...stored.row, status: 'submitted', grading_version: 'semantic-fill-v2',
        submission_request_id: requestId, submitted_at: now, updated_at: now,
        deterministic_score: submitted.result.score, deterministic_max_score: submitted.result.maxScore,
        correct_count: submitted.result.correctCount, incorrect_count: submitted.result.incorrectCount,
        partial_count: submitted.result.partialCount,
        unanswered_count: submitted.result.unansweredCount }
      stored.version = { id: attemptId, updatedAt: now }
      return { state: 'submitted' as const, result: submitted.result }
    },
    async deleteDraft(record: PracticeRecord) {
      const stored = records.get(record.id)
      if (!stored || stored.row.status !== 'draft' || stored.version.updatedAt !== record.version.updatedAt) throw new PersistenceError('conflict')
      records.delete(record.id)
    },
    async listSubmittedPage(offset = 0, pageSize = 20): Promise<SubmittedPage> {
      const sorted = [...records.values()].filter((record) => record.row.status === 'submitted')
        .sort((a, b) => (b.row.submitted_at ?? '').localeCompare(a.row.submitted_at ?? '') || b.id.localeCompare(a.id))
      const slice = sorted.slice(offset, offset + pageSize + 1)
      return { records: slice.slice(0, pageSize).map(clone), nextOffset: slice.length > pageSize ? offset + pageSize : null }
    },
    async listSubmittedAnalyticsPage(offset = 0): Promise<SubmittedAnalyticsPage> {
      const sorted = [...records.values()].filter((record) => record.row.status === 'submitted')
        .sort((a, b) => (b.row.submitted_at ?? '').localeCompare(a.row.submitted_at ?? '') || b.id.localeCompare(a.id))
      const slice = sorted.slice(offset, offset + ANALYTICS_PAGE_SIZE + 1)
      const mapped: AnalyticsAttempt[] = slice.slice(0, ANALYTICS_PAGE_SIZE).map((record) => ({
        id: record.id, quizId: record.row.quiz_id, quizRevision: record.row.quiz_revision,
        submittedAt: record.row.submitted_at, status: 'submitted', quiz: record.quiz,
        answers: record.attempt?.status === 'submitted' && record.attempt.schemaVersion === 1 ? record.attempt.answers : null,
      }))
      return { records: structuredClone(mapped), nextOffset: slice.length > ANALYTICS_PAGE_SIZE ? offset + ANALYTICS_PAGE_SIZE : null }
    },
    async loadLatestSubmittedForQuiz(quizId: string) {
      const sorted = [...records.values()].filter((record) => record.row.quiz_id === quizId && record.row.status === 'submitted')
        .sort((a, b) => (b.row.submitted_at ?? '').localeCompare(a.row.submitted_at ?? '') || b.id.localeCompare(a.id))
      return sorted[0] ? clone(sorted[0]) : null
    },
  }
}
