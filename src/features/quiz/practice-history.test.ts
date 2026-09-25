import { describe, expect, it } from 'vitest'
import { quizCatalog } from './quiz-loader'
import { mapPracticeRecord } from './practice-repository'
import { deriveMistakes } from './practice-history'
import type { Database } from '../../types/database.types'

const quiz = quizCatalog.getCurrentQuiz('demo')!
const now = '2026-09-25T06:00:00.000Z'
type Row = Database['public']['Tables']['attempts']['Row']
type Answer = Database['public']['Tables']['answers']['Row']
const row: Row = { id: '00000000-0000-4000-8000-000000000001', user_id: 'a', quiz_id: quiz.id,
  quiz_revision: quiz.revision, status: 'submitted', started_at: now, client_updated_at: now, submitted_at: now,
  deterministic_score: 999, deterministic_max_score: 999, correct_count: 999, incorrect_count: 0,
  unanswered_count: 0, created_at: now, updated_at: now }
function answer(question_id: string, value: Answer['answer'], attempt_id = row.id): Answer {
  return { id: `${attempt_id}:${question_id}`, attempt_id, user_id: 'a', question_id,
    answer: value, grade: { status: 'correct', score: 999 }, created_at: now, updated_at: now }
}
describe('history and mistakes are derived from exact published content', () => {
  it('regrades a forged stored score and includes only incorrect objective answers', () => {
    const record = mapPracticeRecord({ ...row, answers: [
      answer('q1', { type: 'single', optionId: 'a' }),
      answer('q2', { type: 'single', optionId: 'b' }),
      answer('q6', { type: 'calculation', text: 'wrong' }),
      answer('q7', { type: 'drawing', strokes: [] }),
    ] }, 'a')
    expect(record.attempt?.status === 'submitted' && record.attempt.result.score).toBe(2)
    expect(deriveMistakes([record]).map((item) => item.question.id)).toEqual(['q1'])
  })
  it('separates unanswered questions and manual types from mistakes', () => {
    const record = mapPracticeRecord({ ...row, answers: [] }, 'a')
    expect(record.attempt?.status === 'submitted' && record.attempt.result.unansweredCount).toBe(5)
    expect(deriveMistakes([record])).toHaveLength(0)
  })
  it('preserves distinct occurrences from repeated attempts', () => {
    const first = mapPracticeRecord({ ...row, answers: [answer('q1', { type: 'single', optionId: 'a' })] }, 'a')
    const secondId = '00000000-0000-4000-8000-000000000002'
    const second = mapPracticeRecord({ ...row, id: secondId, answers: [answer('q1', { type: 'single', optionId: 'a' }, secondId)] }, 'a')
    expect(deriveMistakes([first, second]).map((item) => item.record.id)).toEqual([row.id, secondId])
  })
  it('shows missing revisions as unavailable without guessing answers', () => {
    const missing = mapPracticeRecord({ ...row, quiz_revision: 'not-bundled', answers: [answer('q1', { type: 'single', optionId: 'a' })] }, 'a')
    expect(missing.quiz).toBeNull()
    expect(missing.attempt).toBeNull()
    expect(deriveMistakes([missing])).toEqual([])
  })
  it('rejects foreign attempt or answer data before derivation', () => {
    expect(() => mapPracticeRecord({ ...row, answers: [] }, 'b')).toThrow()
    expect(() => mapPracticeRecord({ ...row, answers: [{ ...answer('q1', { type: 'single', optionId: 'a' }), user_id: 'b' }] }, 'a')).toThrow()
  })
})
