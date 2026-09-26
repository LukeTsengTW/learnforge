import { describe, expect, it, vi } from 'vitest'
import type { AppSupabase } from '../../lib/supabase'
import type { Database } from '../../types/database.types'
import { quizCatalog } from '../quiz/quiz-loader'
import { mapAnalyticsRecord, SupabasePracticeRepository } from '../quiz/practice-repository'
import { PersistenceError } from '../quiz/repositories'
import { scanLearningHistory } from './use-learning-history'

type AttemptRow = Database['public']['Tables']['attempts']['Row']
type AnswerRow = Database['public']['Tables']['answers']['Row']
const source = quizCatalog.getCurrentQuiz('demo')!
const now = '2026-09-21T12:00:00Z'
function attempt(id: string, user = 'student'): AttemptRow {
  return { id, user_id: user, quiz_id: source.id, quiz_revision: source.revision, status: 'submitted',
    started_at: now, client_updated_at: now, submitted_at: now,
    deterministic_score: 999, deterministic_max_score: 999, correct_count: 999, incorrect_count: 999,
    unanswered_count: 999, created_at: now, updated_at: now }
}
function answerRow(attemptId: string, user = 'student'): AnswerRow {
  return { id: `answer-${attemptId}`, attempt_id: attemptId, user_id: user, question_id: 'q1',
    answer: { type: 'single', optionId: 'a' }, grade: { status: 'correct', score: 999 }, created_at: now, updated_at: now }
}

describe('analytics repository batching and ownership', () => {
  it('reads one 50+1 attempts page and one batched answer query with explicit owner filters', async () => {
    const rows = Array.from({ length: 51 }, (_, index) => attempt(`a${index}`))
    const calls: unknown[][] = []
    const from = vi.fn((table: string) => {
      const query = {
        select(columns: string) { calls.push([table, 'select', columns]); return this },
        eq(column: string, value: string) { calls.push([table, 'eq', column, value]); return this },
        order(column: string, options: { ascending: boolean }) { calls.push([table, 'order', column, options.ascending]); return this },
        range(start: number, end: number) { calls.push([table, 'range', start, end]); return Promise.resolve({ data: rows, error: null }) },
        in(column: string, values: string[]) { calls.push([table, 'in', column, values]);
          return Promise.resolve({ data: values.map((id) => answerRow(id)), error: null }) },
      }
      return query
    })
    const repo = new SupabasePracticeRepository({ from } as unknown as AppSupabase, 'student')
    const page = await repo.listSubmittedAnalyticsPage()
    expect(page.records).toHaveLength(50)
    expect(page.nextOffset).toBe(50)
    expect(from.mock.calls.map(([table]) => table)).toEqual(['attempts', 'answers'])
    expect(calls).toEqual([
      ['attempts', 'select', '*'], ['attempts', 'eq', 'user_id', 'student'], ['attempts', 'eq', 'status', 'submitted'],
      ['attempts', 'order', 'submitted_at', false], ['attempts', 'order', 'id', false], ['attempts', 'range', 0, 50],
      ['answers', 'select', '*'], ['answers', 'eq', 'user_id', 'student'],
      ['answers', 'in', 'attempt_id', rows.slice(0, 50).map((row) => row.id)],
    ])
    expect(page.records[0].answers?.q1).toEqual({ type: 'single', optionId: 'a' })
  })
  it('rejects foreign attempts and foreign answers before treating a row as excluded', () => {
    expect(() => mapAnalyticsRecord(attempt('foreign', 'other'), [], 'student')).toThrow(PersistenceError)
    expect(() => mapAnalyticsRecord(attempt('own'), [answerRow('own', 'other')], 'student')).toThrow(PersistenceError)
    expect(() => mapAnalyticsRecord(attempt('own'), [answerRow('foreign')], 'student')).toThrow(PersistenceError)
  })
  it('keeps missing revisions and malformed answer JSON countable but ungraded', () => {
    expect(mapAnalyticsRecord({ ...attempt('lost'), quiz_revision: 'missing' }, [], 'student')).toMatchObject({
      quiz: null, answers: null, unavailableReason: 'missing-revision',
    })
    expect(mapAnalyticsRecord(attempt('bad'), [{ ...answerRow('bad'), answer: { type: 'single', optionId: 'unknown' } }], 'student'))
      .toMatchObject({ answers: null, unavailableReason: 'malformed' })
  })
  it('caps a multi-page scan at 500 and exposes truncation', async () => {
    const page = vi.fn(async (offset: number) => ({
      records: Array.from({ length: 50 }, (_, i) => ({ id: `${offset + i}` })), nextOffset: offset + 50,
    }))
    const result = await scanLearningHistory({ listSubmittedAnalyticsPage: page } as never)
    expect(result).toMatchObject({ scannedAttemptCount: 500, isTruncated: true })
    expect(page).toHaveBeenCalledTimes(10)
    expect(page.mock.calls.map(([offset]) => offset)).toEqual([0, 50, 100, 150, 200, 250, 300, 350, 400, 450])
  })
})
