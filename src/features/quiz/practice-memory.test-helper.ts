import { createAttempt } from '../../lib/attempt'
import type { QuizAttempt } from '../../models/attempt'
import type { Quiz } from '../../models/quiz'
import type { Database } from '../../types/database.types'
import type { PracticeRepository } from './practice-context'
import type { DraftReference, PracticeRecord, SubmittedPage } from './practice-repository'
import { PersistenceError, type StoredAttempt } from './repositories'

type AttemptRow = Database['public']['Tables']['attempts']['Row']
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
        deterministic_score: null, deterministic_max_score: null, correct_count: null, incorrect_count: null, unanswered_count: null,
        created_at: now, updated_at: now }
      const record = { id, row, quiz, attempt, version: { id, updatedAt: now } }
      records.set(id, record)
      return clone(record)
    },
    async saveDraft(record: PracticeRecord, attempt: QuizAttempt): Promise<StoredAttempt> {
      const stored = records.get(record.id)
      if (!stored || stored.row.status !== 'draft' || stored.version.updatedAt !== record.version.updatedAt
        || stored.row.quiz_revision !== attempt.quizRevision) throw new PersistenceError('conflict')
      const now = timestamp()
      stored.attempt = structuredClone(attempt)
      stored.row = { ...stored.row, status: attempt.status === 'submitted' ? 'submitted' : 'draft',
        client_updated_at: attempt.updatedAt, submitted_at: attempt.status === 'submitted' ? attempt.submittedAt : null,
        deterministic_score: attempt.status === 'submitted' ? attempt.result.score : null,
        deterministic_max_score: attempt.status === 'submitted' ? attempt.result.maxScore : null,
        correct_count: attempt.status === 'submitted' ? attempt.result.correctCount : null,
        incorrect_count: attempt.status === 'submitted' ? attempt.result.incorrectCount : null,
        unanswered_count: attempt.status === 'submitted' ? attempt.result.unansweredCount : null, updated_at: now }
      stored.version = { id: record.id, updatedAt: now }
      return { attempt, version: stored.version }
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
    async loadLatestSubmittedForQuiz(quizId: string) {
      const sorted = [...records.values()].filter((record) => record.row.quiz_id === quizId && record.row.status === 'submitted')
        .sort((a, b) => (b.row.submitted_at ?? '').localeCompare(a.row.submitted_at ?? '') || b.id.localeCompare(a.id))
      return sorted[0] ? clone(sorted[0]) : null
    },
  }
}
