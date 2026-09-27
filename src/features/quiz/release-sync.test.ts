// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryPracticeRepository } from './practice-memory.test-helper'
import { LocalPracticeCache } from './practice-cache'
import { createPracticeStore } from './practice-store'
import { listPracticeBackups, readBackup, restorePracticeBackup } from './practice-recovery'
import { quizCatalog } from './quiz-loader'
import { reduceAttempt } from '../../lib/attempt'
import { PersistenceError } from './repositories'
const quiz = quizCatalog.getCurrentQuiz('demo')!
const cloneStorage = (): Storage => {
  const data = new Map<string, string>()
  return { get length() { return data.size }, key: i => [...data.keys()][i] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: key => { data.delete(key) }, clear: () => data.clear() }
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime('2026-09-26T10:00:00Z'); localStorage.clear() })
afterEach(() => vi.useRealTimers())
describe('release synchronization and local recovery', () => {
  it.each([false, true])('two devices / shared tabs preserve submitted UUID (shared=%s)', async shared => {
    const repo = createMemoryPracticeRepository('student'), a = await repo.getOrCreateDraft(quiz), b = await repo.getOrCreateDraft(quiz)
    expect(b.id).toBe(a.id)
    const sa = cloneStorage(), sb = shared ? sa : cloneStorage()
    const A = createPracticeStore(a, repo, new LocalPracticeCache('student', () => sa), 60000)
    const B = createPracticeStore(b, repo, new LocalPracticeCache('student', () => sb), 60000)
    A.answer('q1', { type: 'single', optionId: 'b' }); await A.retry()
    B.answer('q1', { type: 'single', optionId: 'a' })
    expect(await A.submit()).toBe(a.id)
    await B.retry()
    const submitted = await repo.loadAttempt(a.id)
    expect(submitted?.row.status).toBe('submitted')
    expect(submitted?.attempt?.answers.q1).toEqual({ type: 'single', optionId: 'b' })
    B.answer('q1', { type: 'single', optionId: 'c' }); await B.retry()
    expect((await repo.loadAttempt(a.id))?.attempt).toEqual(submitted?.attempt)
    expect(listPracticeBackups('student', sb).length).toBeGreaterThan(0)
    expect(await B.submit()).toBeNull()
    A.stop(); B.stop()
  })
  it.each([['server-newer', 0, 2, 'a'], ['local-newer', 2, 0, 'b'], ['same-time', 1, 1, 'a']] as const)('deterministically resolves %s and keeps the losing answers', async (_, localOffset, remoteOffset, winner) => {
    const repo = createMemoryPracticeRepository('student'), record = await repo.getOrCreateDraft(quiz), storage = cloneStorage()
    const cache = new LocalPracticeCache('student', () => storage)
    const base = Date.parse(record.attempt!.updatedAt) + 10
    const local = reduceAttempt(quiz, record.attempt!, { type: 'answer', questionId: 'q1', answer: { type: 'single', optionId: 'b' }, now: new Date(base + localOffset).toISOString() })
    const remote = reduceAttempt(quiz, record.attempt!, { type: 'answer', questionId: 'q1', answer: { type: 'single', optionId: 'a' }, now: new Date(base + remoteOffset).toISOString() })
    cache.write({ id: record.id, attempt: local, version: record.version })
    expect(cache.reconcile({ ...record, attempt: remote }).attempt.answers.q1).toEqual({ type: 'single', optionId: winner })
    expect(listPracticeBackups('student', storage)).toHaveLength(1)
  })
  it('keeps local answers during offline failure and a CAS conflict, then recovers', async () => {
    const repo = createMemoryPracticeRepository('student'), record = await repo.getOrCreateDraft(quiz), storage = cloneStorage()
    const load = vi.fn(repo.loadAttempt).mockRejectedValueOnce(new PersistenceError('unavailable'))
    const save = vi.fn(repo.saveDraft).mockRejectedValueOnce(new PersistenceError('conflict'))
    const cache = new LocalPracticeCache('student', () => storage)
    const store = createPracticeStore(record, { ...repo, loadAttempt: load, saveDraft: save }, cache, 60000)
    store.answer('q1', { type: 'single', optionId: 'b' })
    await store.retry(); expect(cache.read(record.id, quiz)?.attempt.answers.q1).toBeDefined()
    await store.retry(); expect(store.getSnapshot().notice).toContain('雲端草稿已變更')
    await store.retry(); expect((await repo.loadAttempt(record.id))?.attempt?.answers.q1).toBeDefined()
    store.stop()
  })
  it('only restores to an unchanged empty draft and fences a later cloud update', async () => {
    const repo = createMemoryPracticeRepository('student'), record = await repo.getOrCreateDraft(quiz), cache = new LocalPracticeCache('student')
    const answered = reduceAttempt(quiz, record.attempt!, { type: 'answer', questionId: 'q1', answer: { type: 'single', optionId: 'b' }, now: '2026-09-26T10:00:01Z' })
    cache.archive({ id: record.id, attempt: answered, version: record.version })
    const backup = listPracticeBackups('student', localStorage)[0]
    expect(await restorePracticeBackup('student', backup.key, localStorage, repo)).toBe(quiz.id)
    expect(cache.read(record.id, quiz)?.recoveryExpectedVersion).toBe(record.version.updatedAt)
    await repo.saveDraft(record, reduceAttempt(quiz, record.attempt!, { type: 'answer', questionId: 'q1', answer: { type: 'single', optionId: 'a' }, now: '2026-09-26T10:00:02Z' }))
    const changed = await repo.loadAttempt(record.id)
    expect(cache.reconcile(changed!).attempt.answers.q1).toEqual({ type: 'single', optionId: 'a' })
    await expect(restorePracticeBackup('student', backup.key, localStorage, repo)).rejects.toThrow()
  })
  it('rejects cross-user access, submitted backups and submitted cloud attempts', async () => {
    const repo = createMemoryPracticeRepository('student'), record = await repo.getOrCreateDraft(quiz), cache = new LocalPracticeCache('student')
    const submitted = reduceAttempt(quiz, record.attempt!, { type: 'submit', now: '2026-09-26T10:00:02Z' })
    cache.archive({ id: record.id, attempt: submitted, version: record.version })
    const key = listPracticeBackups('student', localStorage)[0].key
    expect(listPracticeBackups('other', localStorage)).toEqual([])
    expect(() => readBackup('other', key, localStorage)).toThrow()
    await expect(restorePracticeBackup('student', key, localStorage, repo)).rejects.toThrow()
    cache.archive({ id: record.id, attempt: record.attempt!, version: record.version })
    await repo.saveDraft(record, submitted)
    for (const backup of listPracticeBackups('student', localStorage)) await expect(restorePracticeBackup('student', backup.key, localStorage, repo)).rejects.toThrow()
    expect((await repo.loadAttempt(record.id))?.row.status).toBe('submitted')
  })
})
