import { describe, expect, it, vi } from 'vitest'
import { createMemoryPracticeRepository, legacyAttempt } from './practice-memory.test-helper'
import { SubmissionError } from './practice-repository'
import { LocalPracticeCache, practiceCacheKey } from './practice-cache'
import { createPracticeStore } from './practice-store'
import { quizCatalog } from './quiz-loader'
import { reduceAttempt } from '../../lib/attempt'

const quiz = quizCatalog.getCurrentQuiz('demo')!
function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

describe('attempt identity and live draft synchronization', () => {
  it('resumes after an effect cleanup and saves to the same attempt UUID', async () => {
    const repo = createMemoryPracticeRepository('student')
    const initial = await repo.getOrCreateDraft(quiz)
    const local = storage()
    const store = createPracticeStore(initial, repo, new LocalPracticeCache('student', () => local), 60_000)
    store.stop()
    store.start()
    store.answer('q1', { type: 'single', optionId: 'b' })
    expect(local.getItem(practiceCacheKey('student', initial.id))).toContain('"q1"')
    await store.retry()
    expect((await repo.loadAttempt(initial.id))?.attempt?.answers.q1).toEqual({ type: 'single', optionId: 'b' })
    expect((await repo.getOrCreateDraft(quiz)).id).toBe(initial.id)
    store.stop()
  })

  it('sends edits made while a save is in flight without losing either answer', async () => {
    const repo = createMemoryPracticeRepository('student')
    const initial = await repo.getOrCreateDraft(quiz)
    let release!: () => void
    let entered!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const started = new Promise<void>((resolve) => { entered = resolve })
    const save = vi.fn(async (...args: Parameters<typeof repo.saveDraft>) => {
      if (save.mock.calls.length === 1) { entered(); await gate }
      return repo.saveDraft(...args)
    })
    const local = storage()
    const store = createPracticeStore(initial, { ...repo, saveDraft: save }, new LocalPracticeCache('student', () => local), 60_000)
    store.answer('q1', { type: 'single', optionId: 'b' })
    const flushing = store.retry()
    await started
    store.answer('q2', { type: 'single', optionId: 'b' })
    release()
    await flushing
    const saved = await repo.loadAttempt(initial.id)
    expect(saved?.attempt?.answers).toMatchObject({
      q1: { type: 'single', optionId: 'b' }, q2: { type: 'single', optionId: 'b' },
    })
    expect(save).toHaveBeenCalledTimes(2)
    store.stop()
  })

  it('preserves a submitted UUID and allocates a different draft for practice again', async () => {
    const repo = createMemoryPracticeRepository('student')
    const initial = await repo.getOrCreateDraft(quiz)
    const local = storage()
    const store = createPracticeStore(initial, repo, new LocalPracticeCache('student', () => local), 60_000)
    expect(await store.submit()).toBe(initial.id)
    expect((await repo.loadAttempt(initial.id))?.row.status).toBe('submitted')
    const next = await repo.getOrCreateDraft(quiz)
    expect(next.id).not.toBe(initial.id)
    expect((await repo.loadAttempt(initial.id))?.row.status).toBe('submitted')
    store.stop()
  })

  it('shows submission as pending and suppresses duplicate submits and answer edits', async () => {
    const repo = createMemoryPracticeRepository('student')
    const initial = await repo.getOrCreateDraft(quiz)
    let release!: () => void
    let entered!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const started = new Promise<void>((resolve) => { entered = resolve })
    const submitDraft = vi.fn(async (...args: Parameters<typeof repo.submitDraft>) => {
      entered(); await gate
      return repo.submitDraft(...args)
    })
    const store = createPracticeStore(initial, { ...repo, submitDraft },
      new LocalPracticeCache('student', storage), 60_000)
    const first = store.submit()
    await started
    expect(store.getSnapshot().submitting).toBe(true)
    expect(await store.submit()).toBeNull()
    store.answer('q5', { type: 'fill', text: 'changed while judging' })
    expect(store.getSnapshot().attempt.answers.q5).toBeUndefined()
    release()
    expect(await first).toBe(initial.id)
    expect(submitDraft).toHaveBeenCalledTimes(1)
    store.stop()
  })

  it('shows the generic retryable AI grading message and leaves the attempt as a draft', async () => {
    const repo = createMemoryPracticeRepository('student')
    const initial = await repo.getOrCreateDraft(quiz)
    const submitDraft = vi.fn(async () => { throw new SubmissionError('unavailable') })
    const store = createPracticeStore(initial, { ...repo, submitDraft },
      new LocalPracticeCache('student', storage), 60_000)
    expect(await store.submit()).toBeNull()
    expect(store.getSnapshot().notice).toBe('AI 評分暫時無法完成，本次作答尚未提交，請稍後再試。')
    expect((await repo.loadAttempt(initial.id))?.row.status).toBe('draft')
    store.stop()
  })

  it('recognizes its committed request after the submission response is lost', async () => {
    const repo = createMemoryPracticeRepository('student')
    const initial = await repo.getOrCreateDraft(quiz)
    const submitDraft = vi.fn(async (...args: Parameters<typeof repo.submitDraft>) => {
      const result = await repo.submitDraft(...args)
      if (submitDraft.mock.calls.length === 1) throw new SubmissionError('unavailable')
      return result
    })
    const store = createPracticeStore(initial, { ...repo, submitDraft },
      new LocalPracticeCache('student', storage), 60_000)
    expect(await store.submit()).toBeNull()
    expect((await repo.loadAttempt(initial.id))?.row.status).toBe('submitted')
    expect(await store.submit()).toBe(initial.id)
    expect(submitDraft).toHaveBeenCalledTimes(1)
    store.stop()
  })

  it('restores an old locally submitted cache to a draft and requires formal submission', async () => {
    const repo = createMemoryPracticeRepository('student')
    const initial = await repo.getOrCreateDraft(quiz)
    const local = storage(), cache = new LocalPracticeCache('student', () => local)
    const submitted = reduceAttempt(quiz, legacyAttempt(initial), { type: 'submit',
      now: new Date(Date.parse(legacyAttempt(initial).startedAt) + 1).toISOString() })
    cache.write({ id: initial.id, attempt: submitted, version: initial.version })
    const store = createPracticeStore(initial, repo, cache, 60_000)
    expect(store.getSnapshot().attempt.status).toBe('in-progress')
    await store.retry()
    expect(store.getSnapshot().pendingSubmission).toBe(false)
    expect((await repo.loadAttempt(initial.id))?.row.status).toBe('draft')
    expect(await store.submit()).toBe(initial.id)
    expect(cache.read(initial.id, quiz)?.attempt.status).toBe('submitted')
    store.stop()
  })

  it('recognizes a submission completed by another tab', async () => {
    const repo = createMemoryPracticeRepository('student')
    const initial = await repo.getOrCreateDraft(quiz)
    const local = storage(), cache = new LocalPracticeCache('student', () => local)
    const store = createPracticeStore(initial, repo, cache, 60_000)
    await repo.submitDraft(initial.id, initial.version.updatedAt, crypto.randomUUID())
    await store.retry()
    expect(store.getSnapshot().attempt.status).toBe('submitted')
    expect(store.getSnapshot().pendingSubmission).toBe(false)
    store.stop()
  })
})
