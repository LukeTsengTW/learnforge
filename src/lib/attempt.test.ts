import { describe, expect, it } from 'vitest'
import demoSource from '../content/quizzes/demo/v1.quiz.md?raw'
import { parseQuiz } from './quiz-parser'
import { createAttempt, reduceAttempt } from './attempt'
import { attemptKey, decodeAttempt, loadAttempt, saveAttempt } from './attempt-storage'

const quiz = parseQuiz(demoSource)
const now = '2026-09-25T00:00:00.000Z'
const empty = createAttempt(quiz, now)
const answered = reduceAttempt(quiz, empty, { type: 'answer', questionId: 'q1', answer: { type: 'single', optionId: 'b' }, now })
const submitted = reduceAttempt(quiz, answered, { type: 'submit', now })
function memoryStorage() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}

describe('attempt lifecycle and persistence', () => {
  it('locks submissions, including duplicate submits', () => {
    expect(submitted.status).toBe('submitted')
    expect(reduceAttempt(quiz, submitted, { type: 'answer', questionId: 'q1', answer: { type: 'single', optionId: 'a' }, now })).toBe(submitted)
    expect(reduceAttempt(quiz, submitted, { type: 'submit', now })).toBe(submitted)
    expect(empty.answers).toEqual({})
  })
  it('rejects unknown questions and mismatched answer types', () => {
    expect(reduceAttempt(quiz, empty, { type: 'answer', questionId: 'missing', answer: { type: 'single', optionId: 'b' }, now })).toBe(empty)
    expect(reduceAttempt(quiz, empty, { type: 'answer', questionId: 'q1', answer: { type: 'fill', text: 'b' }, now })).toBe(empty)
  })
  it('roundtrips drafts and submitted results through a versioned storage boundary', () => {
    const storage = memoryStorage()
    expect(attemptKey('demo')).toBe('learnforge:attempt:v1:demo')
    for (const attempt of [answered, submitted]) {
      expect(saveAttempt(attempt, storage)).toBeNull()
      expect(loadAttempt(quiz, now, storage).attempt).toEqual(attempt)
    }
  })
  it('restarts with empty answers and removes the old stored attempt', () => {
    const storage = memoryStorage()
    saveAttempt(submitted, storage)
    const restarted = reduceAttempt(quiz, submitted, { type: 'restart', now })
    expect(restarted).toEqual(empty)
    saveAttempt(restarted, storage)
    expect(storage.getItem(attemptKey(quiz.id))).toBeNull()
  })
  it('does not trust forged stored scores', () => {
    const loaded = decodeAttempt(JSON.stringify({ ...submitted, result: { score: 1000 } }), quiz)
    expect(loaded?.status === 'submitted' && loaded.result.score).toBe(2)
  })
  it.each([
    '{broken', 'null', '[]',
    JSON.stringify({ ...answered, schemaVersion: 99 }),
    JSON.stringify({ ...answered, quizRevision: 'outdated' }),
    JSON.stringify({ ...answered, startedAt: 'not a date' }),
    JSON.stringify({ ...answered, answers: { q1: { type: 'single', optionId: 'unknown' } } }),
    JSON.stringify({ ...answered, answers: { q4: { type: 'true-false', value: 'false' } } }),
    JSON.stringify({ ...answered, answers: { q7: { type: 'drawing', strokes: [{ tool: 'pen', color: '#202b38', width: 4, points: [{ x: 9999, y: 1 }] }] } } }),
  ])('rejects corrupt or incompatible storage %#', (raw) => {
    expect(decodeAttempt(raw, quiz)).toBeNull()
  })
  it('reports invalid storage and denied/quota failures without throwing', () => {
    const storage = memoryStorage()
    storage.setItem(attemptKey(quiz.id), '{broken')
    expect(loadAttempt(quiz, now, storage).notice).toContain('格式不符')
    const denied = {
      getItem: () => { throw new Error('Denied') }, setItem: () => { throw new Error('Quota') }, removeItem: () => { throw new Error('Denied') },
    }
    expect(loadAttempt(quiz, now, denied).notice).toContain('無法讀取')
    expect(saveAttempt(submitted, denied)).toContain('無法儲存')
  })
})
