import { describe, expect, it } from 'vitest'
import { createAttempt } from '../../lib/attempt'
import { promoteQuizDraftV5 } from '../../lib/draft-v5'
import { upgradeLegacyQuizDraftV4 } from '../../lib/draft-v4'
import type { QuizDraftV5 } from '../../models/draft-v5'
import { LocalPracticeCache, LocalPracticeCacheV4, LocalPracticeCacheV5, practiceCacheKeyV4, practiceCacheKeyV5 } from './practice-cache'
import { listPracticeBackups, restorePracticeBackup } from './practice-recovery'
import { createPracticeStore } from './practice-store'
import { createV4MemoryRepository, memoryStorage, pen, v4Catalog, v4Quiz } from './practice-v4.test-helper'

function browserStorage() {
  const base = memoryStorage()
  const storage = Object.assign(base, { key: (index: number) => [...base.data.keys()][index] ?? null })
  Object.defineProperty(storage, 'length', { get: () => base.data.size })
  return storage as unknown as Storage
}

describe('M5 schema-3 cache and persistence', () => {
  it('promotes a matching schema-2 local draft losslessly into a separate cache namespace', async () => {
    const server = createV4MemoryRepository('student')
    const record = await server.repo.getOrCreateDraft(v4Quiz)
    const v4 = { ...upgradeLegacyQuizDraftV4(record.attempt as never, v4Quiz)!, answers: {
      q_hand: { type: 'calculation' as const, mode: 'drawing' as const, text: 'kept inactive', strokes: [pen()] },
    } }
    server.serverEdit(record.id, v4)
    const current = await server.repo.loadAttempt(record.id)
    const storage = memoryStorage()
    const oldCache = new LocalPracticeCacheV4('student', () => storage)
    oldCache.write({ id: record.id, attempt: v4, version: current!.version })
    const oldBytes = storage.getItem(practiceCacheKeyV4('student', record.id))
    const cache = new LocalPracticeCacheV5('student', () => storage)
    const promoted = cache.promoteOlder(current!, v4Quiz)
    expect(promoted?.attempt.answers.q_hand).toEqual({ type: 'calculation', mode: 'drawing', text: 'kept inactive', pages: [[pen()]] })
    expect(storage.getItem(practiceCacheKeyV4('student', record.id))).toBe(oldBytes)
    expect(cache.read(record.id, v4Quiz)).toEqual(promoted)
    expect(storage.getItem(practiceCacheKeyV5('student', record.id))).toContain('"cacheVersion":5')
  })

  it('promotes an exact-revision schema-2 cloud draft in memory, then writes only with schema 3 and CAS', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const old = { ...upgradeLegacyQuizDraftV4(initial.attempt as never, v4Quiz)!,
      answers: { q_hand: { type: 'calculation' as const, mode: 'drawing' as const, text: 'old note', strokes: [pen()] } } }
    server.serverEdit(initial.id, old)
    const record = await server.repo.loadAttempt(initial.id)
    const storage = memoryStorage()
    const cache = new LocalPracticeCache('student', () => storage)
    const store = createPracticeStore(record!, server.repo, cache, 60_000)
    expect(store.getSnapshot().draftSchema).toBe(3)
    expect(store.getSnapshot().attempt.schemaVersion).toBe(3)
    expect(store.getSnapshot().attempt.answers.q_hand).toEqual({ type: 'calculation', mode: 'drawing', text: 'old note', pages: [[pen()]] })
    const pageAnswer = { type: 'calculation' as const, mode: 'drawing' as const, text: 'new inactive', pages: [[], [pen(200)]] }
    store.answer('q_hand', pageAnswer)
    await store.retry()
    expect(server.v4Saves).toHaveLength(0)
    expect(server.v5Saves).toHaveLength(1)
    expect(server.v5Saves[0].expectedUpdatedAt).toBe(record!.version.updatedAt)
    expect(server.rows.get(initial.id)!.schemaVersion).toBe(3)
    expect((await server.repo.loadAttempt(initial.id))?.attempt?.answers.q_hand).toEqual(pageAnswer)
    expect(storage.getItem(practiceCacheKeyV5('student', initial.id))).toContain('new inactive')
    expect(storage.getItem(practiceCacheKeyV4('student', initial.id))).toBeNull()
    store.stop()
  })

  it('reloads schema-3 pages with an unchanged CAS generation and keeps older attempts untouched', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const storage = memoryStorage(), cache = new LocalPracticeCache('student', () => storage)
    const store = createPracticeStore(initial, server.repo, cache, 60_000)
    const pageAnswer = { type: 'calculation' as const, mode: 'drawing' as const, text: 'retained', pages: [[pen()], [], [pen(250)]] }
    store.answer('q_hand', pageAnswer)
    await store.retry(); store.stop()
    const current = await server.repo.loadAttempt(initial.id)
    const reloaded = createPracticeStore(current!, server.repo, cache, 60_000)
    expect(reloaded.getSnapshot().draftSchema).toBe(3)
    expect(reloaded.getSnapshot().attempt.answers.q_hand).toEqual(pageAnswer)
    expect(server.v3Saves).toHaveLength(0)
    expect(server.v4Saves).toHaveLength(0)
    expect(server.v5Saves).toHaveLength(1)
    reloaded.stop()
  })

  it('uses V5 empty-page canonical forms while preserving text-only schema-3 answers', () => {
    const legacy = { ...createAttempt(v4Quiz, '2026-10-19T00:00:00.000Z'), answers: {
      q_text: { type: 'calculation' as const, text: '' }, q_hand: { type: 'calculation' as const, text: '' },
    } }
    const draft = promoteQuizDraftV5(legacy, v4Quiz) as QuizDraftV5
    expect(draft.answers.q_text).toEqual({ type: 'calculation', mode: 'text', text: '', pages: [] })
    expect(draft.answers.q_hand).toEqual({ type: 'calculation', mode: 'text', text: '', pages: [[]] })
  })

  it('lists and restores a schema-3 recovery backup only into the v5 cache at the same server version', async () => {
    const server = createV4MemoryRepository('student')
    const record = await server.repo.getOrCreateDraft(v4Quiz)
    const storage = browserStorage()
    const attempt = promoteQuizDraftV5(record.attempt, v4Quiz)!
    const withWork = { ...attempt, answers: { q_hand: { type: 'calculation' as const, mode: 'drawing' as const,
      text: 'saved pages', pages: [[], [pen()]] } } }
    const cache = new LocalPracticeCacheV5('student', () => storage)
    cache.archive({ id: record.id, attempt: withWork, version: record.version }, 'v5 test backup')
    const backup = listPracticeBackups('student', storage)[0]
    expect(backup.schemaVersion).toBe(3)
    await restorePracticeBackup('student', backup.key, storage, server.repo, v4Catalog)
    expect(new LocalPracticeCacheV5('student', () => storage).read(record.id, v4Quiz)?.attempt.answers.q_hand).toEqual(withWork.answers.q_hand)
    expect((await server.repo.loadAttempt(record.id))?.schemaVersion).toBe(1)
    expect(server.v5Saves).toHaveLength(0)
  })
})
