import { describe, expect, it, vi, afterEach } from 'vitest'
import { demoQuiz } from './quiz-loader'
import { createAttempt, reduceAttempt } from '../../lib/attempt'
import { LocalAttemptRepository, SupabaseAttemptRepository, PersistenceError, fromDatabase, toDatabase, type AttemptRepository, type StoredAttempt } from './repositories'
import type { AppSupabase } from '../../lib/supabase'
import { resolveAttemptConflict, sameAttempt } from './sync'
import { createCloudAttemptStore, SYNC_WARNING } from './cloud-attempt-store'
if (!demoQuiz.ok) throw new Error('Invalid demo')
const quiz = demoQuiz.quiz
const t1 = '2026-09-25T01:00:00.000Z', t2 = '2026-09-25T02:00:00.000Z'
const draft = reduceAttempt(quiz, createAttempt(quiz, t1), { type: 'answer', questionId: 'q1', answer: { type: 'single', optionId: 'b' }, now: t1 })
const newer = { ...draft, updatedAt: t2 }
const submitted = reduceAttempt(quiz, draft, { type: 'submit', now: t2 })
function memory() {
  const data = new Map<string, string>()
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}
const version = { id: 'remote-id', updatedAt: t1 }
function repository(initial: StoredAttempt | null = null) {
  let value = initial
  const remote: AttemptRepository = {
    load: vi.fn(async () => value),
    save: vi.fn(async (next: StoredAttempt) => { value = { ...next, version }; return value }),
    delete: vi.fn(async () => { value = null }),
  }
  return remote
}
afterEach(() => { vi.useRealTimers() })
describe('conflict rule', () => {
  it('compares JSONB answers independently of object property order', () => {
    expect(sameAttempt(draft, { ...draft, answers: { q1: { optionId: 'b', type: 'single' } } })).toBe(true)
    expect(sameAttempt(draft, { ...draft, answers: { q1: { optionId: 'a', type: 'single' } } })).toBe(false)
  })
  it('compares valid dates with remote tie-break and immutable submissions', () => {
    expect(resolveAttemptConflict(draft, newer)).toBe('remote')
    expect(resolveAttemptConflict(newer, draft)).toBe('local')
    expect(resolveAttemptConflict(draft, draft)).toBe('remote')
    expect(resolveAttemptConflict(submitted, newer)).toBe('local')
    expect(resolveAttemptConflict(newer, submitted)).toBe('remote')
    expect(resolveAttemptConflict({ ...submitted, updatedAt: '2099-01-01' }, submitted)).toBe('remote')
  })
})
describe('database mapping', () => {
  const row = { id: version.id, user_id: 'owner', quiz_id: quiz.id, quiz_revision: quiz.revision, status: 'submitted', started_at: t1, client_updated_at: t2,
    submitted_at: t2, deterministic_score: 999, deterministic_max_score: 999, correct_count: 999, incorrect_count: 0, unanswered_count: 0, created_at: t1, updated_at: t2 }
  const answers = [{ id: 'answer', user_id: 'owner', attempt_id: version.id, question_id: 'q1', answer: { type: 'single', optionId: 'b' }, grade: null, created_at: t1, updated_at: t2 }]
  it('regrades stored scores and maps unchanged domain answers', () => {
    const value = fromDatabase(row, answers, quiz, 'owner')
    expect(value.attempt.status).toBe('submitted')
    if (value.attempt.status === 'submitted') expect(value.attempt.result.score).toBe(2)
    expect(toDatabase(draft, 'owner')).toMatchObject({ ownerId: 'owner', answers: draft.answers })
  })
  it('rejects foreign owners, malformed answers, revisions and duplicate questions', () => {
    expect(() => fromDatabase(row, answers, quiz, 'someone-else')).toThrow(PersistenceError)
    expect(() => fromDatabase(row, [{ ...answers[0], answer: { type: 'single', optionId: 'unknown' } }], quiz, 'owner')).toThrow()
    expect(() => fromDatabase({ ...row, quiz_revision: 'old' }, answers, quiz, 'owner')).toThrow()
    expect(() => fromDatabase(row, [...answers, ...answers], quiz, 'owner')).toThrow()
    expect(() => fromDatabase(row, [{ ...answers[0], user_id: 'other' }], quiz, 'owner')).toThrow()
  })
  it('binds RPC payloads to the original owner and translates write conflicts/failures', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '40001' } })
    const repo = new SupabaseAttemptRepository({ rpc } as unknown as AppSupabase, quiz, 'owner')
    await expect(repo.save({ attempt: draft, version })).rejects.toMatchObject({ kind: 'conflict' })
    expect(rpc).toHaveBeenCalledWith('save_quiz_attempt', expect.objectContaining({ p_payload: expect.objectContaining({ ownerId: 'owner' }), p_expected_id: version.id, p_expected_updated_at: t1 }))
    rpc.mockResolvedValue({ data: null, error: { code: '42501' } })
    await expect(repo.save({ attempt: draft, version })).rejects.toMatchObject({ kind: 'unavailable' })
  })
})
describe('local and cloud repositories', () => {
  it('isolates accounts and retains the v1 key', async () => {
    const storage = memory(); storage.setItem('learnforge:attempt:v1:demo', JSON.stringify(draft))
    const a = new LocalAttemptRepository(quiz, 'a', () => storage), b = new LocalAttemptRepository(quiz, 'b', () => storage)
    await a.save({ attempt: draft, version: null })
    expect((await a.load())?.attempt.answers).toEqual(draft.answers); expect(await b.load()).toBeNull()
    await a.delete(); expect(storage.getItem('learnforge:attempt:v1:demo')).not.toBeNull()
  })
  it('loads remote drafts instead of letting a new empty local draft overwrite them', async () => {
    const remote = repository({ attempt: draft, version })
    const store = createCloudAttemptStore(quiz, new LocalAttemptRepository(quiz, 'a', () => memory()), remote)
    await store.start(); await store.retry()
    expect(store.getSnapshot().attempt.answers).toEqual(draft.answers); expect(remote.save).not.toHaveBeenCalled(); store.stop()
  })
  it('preserves conflicting local submissions as a backup and locks the remote submission', async () => {
    const storage = memory(), local = new LocalAttemptRepository(quiz, 'a', () => storage)
    await local.save({ attempt: { ...submitted, answers: {} }, version })
    const remote = repository({ attempt: submitted, version })
    const store = createCloudAttemptStore(quiz, local, remote)
    await store.start()
    store.dispatch({ type: 'answer', questionId: 'q1', answer: { type: 'single', optionId: 'a' }, now: t2 })
    await store.retry()
    expect(store.getSnapshot().attempt.answers).toEqual(submitted.answers)
    expect([...storage.data.keys()].some(k => k.includes(':recovery:'))).toBe(true)
    expect(remote.save).not.toHaveBeenCalled(); store.stop()
  })
  it('keeps answers when offline/save fails and restores them after refresh', async () => {
    const storage = memory(), local = new LocalAttemptRepository(quiz, 'a', () => storage), remote = repository()
    vi.mocked(remote.save).mockRejectedValue(new Error('offline'))
    const store = createCloudAttemptStore(quiz, local, remote)
    await store.start()
    store.dispatch({ type: 'answer', questionId: 'q1', answer: { type: 'single', optionId: 'b' }, now: new Date().toISOString() })
    await store.retry()
    expect(store.getSnapshot().notice).toBe(SYNC_WARNING)
    expect((await local.load())?.attempt.answers).toEqual(draft.answers)
    store.stop()
    vi.mocked(remote.load).mockRejectedValue(new Error('offline'))
    const restored = createCloudAttemptStore(quiz, local, remote)
    await restored.start(); expect(restored.getSnapshot().attempt.answers).toEqual(draft.answers); restored.stop()
  })
  it('does not overwrite malformed remote data or discard a failed restart', async () => {
    const local = new LocalAttemptRepository(quiz, 'a', () => memory()), remote = repository({ attempt: submitted, version })
    const store = createCloudAttemptStore(quiz, local, remote)
    await store.start()
    vi.mocked(remote.delete).mockRejectedValue(new Error('offline'))
    expect(await store.restart()).toBe(false); expect(store.getSnapshot().attempt.status).toBe('submitted')
    vi.mocked(remote.load).mockRejectedValue(new PersistenceError('invalid'))
    await store.retry(); expect(remote.save).not.toHaveBeenCalled(); expect(store.getSnapshot().notice).toMatch(/格式不符/); store.stop()
  })
  it('debounces a burst and does not save after account disposal', async () => {
    vi.useFakeTimers()
    const storage = memory(), remote = repository(), store = createCloudAttemptStore(quiz, new LocalAttemptRepository(quiz, 'a', () => storage), remote)
    await store.start()
    for (const text of ['x', 'xo', 'xor']) store.dispatch({ type: 'answer', questionId: 'q5', answer: { type: 'fill', text }, now: new Date().toISOString() })
    expect(remote.save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(801)
    expect(remote.save).toHaveBeenCalledTimes(1)
    store.dispatch({ type: 'answer', questionId: 'q5', answer: { type: 'fill', text: 'or' }, now: new Date().toISOString() })
    store.stop(); await vi.advanceTimersByTimeAsync(1000)
    expect(remote.save).toHaveBeenCalledTimes(1)
  })
  it('recognizes remote restart generations and archives stale local submissions', async () => {
    const storage = memory(), local = new LocalAttemptRepository(quiz, 'a', () => storage)
    await local.save({ attempt: submitted, version })
    const remote = repository({ attempt: newer, version: { ...version, id: 'new-generation' } })
    const store = createCloudAttemptStore(quiz, local, remote)
    await store.start(); await store.retry()
    expect(store.getSnapshot().attempt.status).toBe('in-progress'); expect(remote.save).not.toHaveBeenCalled(); store.stop()
  })
  it('preserves edits arriving during an in-flight save and serializes the next save', async () => {
    const storage = memory(), local = new LocalAttemptRepository(quiz, 'a', () => storage), remote = repository()
    let finish: (value: StoredAttempt) => void = () => {}
    vi.mocked(remote.save).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const store = createCloudAttemptStore(quiz, local, remote)
    await store.start()
    store.dispatch({ type: 'answer', questionId: 'q5', answer: { type: 'fill', text: 'x' }, now: new Date().toISOString() })
    const flush = store.retry()
    await vi.waitFor(() => expect(remote.save).toHaveBeenCalledTimes(1))
    const first = vi.mocked(remote.save).mock.calls[0][0]
    store.dispatch({ type: 'answer', questionId: 'q5', answer: { type: 'fill', text: 'xor' }, now: new Date().toISOString() })
    finish({ ...first, version })
    await flush
    expect(remote.save).toHaveBeenCalledTimes(2)
    expect(vi.mocked(remote.save).mock.calls[1][0].attempt.answers.q5).toEqual({ type: 'fill', text: 'xor' })
    expect((await local.load())?.attempt.answers.q5).toEqual({ type: 'fill', text: 'xor' }); store.stop()
  })
  it('archives a cached old generation when the cloud attempt was deleted', async () => {
    const storage = memory(), local = new LocalAttemptRepository(quiz, 'a', () => storage), remote = repository()
    await local.save({ attempt: submitted, version })
    const store = createCloudAttemptStore(quiz, local, remote)
    await store.start(); await store.retry()
    expect(store.getSnapshot().attempt.answers).toEqual({})
    expect([...storage.data.keys()].some(k => k.includes(':recovery:'))).toBe(true)
    expect(remote.save).not.toHaveBeenCalled(); store.stop()
  })
  it('does not replace a valid conflicting local attempt if its recovery backup cannot be saved', async () => {
    const storage = memory(), local = new LocalAttemptRepository(quiz, 'a', () => storage)
    await local.save({ attempt: newer, version })
    const stored = storage.getItem(local.key)
    vi.spyOn(local, 'archive').mockImplementation(() => { throw new Error('Quota exceeded') })
    const remote = repository({ attempt: submitted, version })
    const store = createCloudAttemptStore(quiz, local, remote)
    await store.start()
    expect(store.getSnapshot().attempt.status).toBe('in-progress')
    expect(storage.getItem(local.key)).toBe(stored); expect(remote.save).not.toHaveBeenCalled(); store.stop()
  })
  it('backs up malformed local data before restoring the valid cloud attempt', async () => {
    const storage = memory(), local = new LocalAttemptRepository(quiz, 'a', () => storage)
    storage.setItem(local.key, '{broken json')
    const store = createCloudAttemptStore(quiz, local, repository({ attempt: draft, version }))
    await store.start()
    expect(store.getSnapshot().attempt.answers).toEqual(draft.answers)
    expect([...storage.data.entries()].some(([k,v]) => k.includes(':recovery:') && v === '{broken json')).toBe(true)
    store.stop()
  })
  it('backs up an independently changed remote draft before a newer local attempt wins', async () => {
    const storage = memory(), local = new LocalAttemptRepository(quiz, 'a', () => storage)
    await local.save({ attempt: newer, version: { ...version, updatedAt: '2026-09-25T00:00:00Z' } })
    const remote = repository({ attempt: { ...draft, answers: { q1: { type: 'single', optionId: 'a' } } }, version })
    const store = createCloudAttemptStore(quiz, local, remote)
    await store.start(); await store.retry()
    const backups = [...storage.data.entries()].filter(([k]) => k.includes(':recovery:'))
    expect(backups.some(([,raw]) => JSON.parse(raw).attempt.answers.q1.optionId === 'a')).toBe(true)
    expect(store.getSnapshot().attempt.answers.q1).toEqual({ type: 'single', optionId: 'b' }); store.stop()
  })
  it('can continue with cloud storage when the browser blocks localStorage', async () => {
    const local = new LocalAttemptRepository(quiz, 'a', () => { throw new Error('Storage blocked') })
    const remote = repository({ attempt: draft, version })
    const store = createCloudAttemptStore(quiz, local, remote)
    await store.start()
    store.dispatch({ type: 'answer', questionId: 'q5', answer: { type: 'fill', text: 'xor' }, now: new Date().toISOString() })
    await store.retry()
    expect(remote.save).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().attempt.answers.q5).toEqual({ type: 'fill', text: 'xor' })
    expect(store.getSnapshot().notice).toMatch(/無法儲存本機/); store.stop()
  })
})
