import { describe, expect, it } from 'vitest'
import { createAttempt, reduceAttempt } from '../../lib/attempt'
import { demoQuiz } from './quiz-loader'
import { cacheKey, PersistenceError } from './repositories'
import { LocalPracticeCache, draftIndexKey, practiceCacheKey } from './practice-cache'
import { createMemoryPracticeRepository } from './practice-memory.test-helper'

if (!demoQuiz.ok) throw new Error('Invalid demo')
const quiz = demoQuiz.quiz
function memory() {
  const data = new Map<string, string>()
  return { data, getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}
describe('v2 to v3 local cache', () => {
  it('copies a matching valid v2 attempt by UUID and is idempotent', async () => {
    const record = await createMemoryPracticeRepository('a').getOrCreateDraft(quiz)
    const storage = memory(), cache = new LocalPracticeCache('a', () => storage)
    const local = reduceAttempt(quiz, record.attempt!, { type: 'answer', questionId: 'q1', answer: { type: 'single', optionId: 'b' }, now: '2099-01-01T00:00:00Z' })
    const raw = JSON.stringify({ schemaVersion: 2, attempt: local, version: record.version })
    storage.setItem(cacheKey('a', quiz.id), raw)
    expect(cache.migrateV2(record)?.attempt.answers.q1).toEqual({ type: 'single', optionId: 'b' })
    const first = storage.getItem(practiceCacheKey('a', record.id))
    expect(cache.migrateV2(record)?.id).toBe(record.id)
    expect(storage.getItem(practiceCacheKey('a', record.id))).toBe(first)
    expect(storage.getItem(cacheKey('a', quiz.id))).toBe(raw)
    expect(cache.reconcile(record).attempt.answers.q1).toEqual({ type: 'single', optionId: 'b' })
  })
  it('keeps malformed v2 bytes in an idempotent recovery backup', async () => {
    const record = await createMemoryPracticeRepository('a').getOrCreateDraft(quiz)
    const storage = memory(), cache = new LocalPracticeCache('a', () => storage)
    storage.setItem(cacheKey('a', quiz.id), '{broken')
    expect(cache.migrateV2(record)).toBeNull()
    expect(cache.migrateV2(record)).toBeNull()
    expect(storage.getItem(`${cacheKey('a', quiz.id)}:recovery:migration`)).toBe('{broken')
    expect(storage.getItem(cacheKey('a', quiz.id))).toBe('{broken')
  })
  it('does not mistake another attempt at the same quiz for the current UUID', async () => {
    const record = await createMemoryPracticeRepository('a').getOrCreateDraft(quiz)
    const storage = memory(), cache = new LocalPracticeCache('a', () => storage)
    storage.setItem(cacheKey('a', quiz.id), JSON.stringify({ schemaVersion: 2, attempt: record.attempt, version: { id: 'other', updatedAt: record.version.updatedAt } }))
    expect(cache.migrateV2(record)).toBeNull()
    expect(storage.getItem(practiceCacheKey('a', record.id))).toBeNull()
  })
  it('isolates accounts and different attempt UUIDs', async () => {
    const repo = createMemoryPracticeRepository('a'), first = await repo.getOrCreateDraft(quiz)
    const storage = memory(), a = new LocalPracticeCache('a', () => storage), b = new LocalPracticeCache('b', () => storage)
    a.write({ id: first.id, attempt: first.attempt!, version: first.version })
    expect(b.read(first.id, quiz)).toBeNull()
    expect(storage.getItem(draftIndexKey('a', quiz.id))).toBe(first.id)
    const submitted = reduceAttempt(quiz, first.attempt!, { type: 'submit', now: first.attempt!.startedAt })
    await repo.saveDraft(first, submitted)
    const second = await repo.getOrCreateDraft(quiz)
    a.write({ id: second.id, attempt: second.attempt!, version: second.version })
    expect(first.id).not.toBe(second.id)
    expect(a.read(first.id, quiz)?.id).toBe(first.id)
    expect(a.read(second.id, quiz)?.id).toBe(second.id)
  })
  it('keeps a submitted cache immutable and permits deleting only a draft', async () => {
    const record = await createMemoryPracticeRepository('a').getOrCreateDraft(quiz)
    const storage = memory(), cache = new LocalPracticeCache('a', () => storage)
    const submitted = reduceAttempt(quiz, createAttempt(quiz, record.attempt!.startedAt), { type: 'submit', now: record.attempt!.startedAt })
    cache.write({ id: record.id, attempt: submitted, version: record.version })
    expect(() => cache.write({ id: record.id, attempt: { ...submitted, answers: { q1: { type: 'single', optionId: 'b' } } }, version: record.version })).toThrow(PersistenceError)
    expect(() => cache.removeDraft({ id: record.id, attempt: submitted, version: record.version })).toThrow(PersistenceError)
  })
  it('retains a locally submitted attempt when the same remote UUID is still a draft', async () => {
    const record = await createMemoryPracticeRepository('a').getOrCreateDraft(quiz)
    const local = memory(), cache = new LocalPracticeCache('a', () => local)
    const submitted = reduceAttempt(quiz, record.attempt!, { type: 'submit',
      now: new Date(Date.parse(record.attempt!.startedAt) + 1).toISOString() })
    cache.write({ id: record.id, attempt: submitted, version: record.version })
    expect(cache.reconcile(record).attempt.status).toBe('submitted')
    expect(cache.read(record.id, quiz)?.attempt.status).toBe('submitted')
  })
})
