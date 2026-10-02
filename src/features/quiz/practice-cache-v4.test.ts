import { describe, expect, it } from 'vitest'
import { reduceAttempt } from '../../lib/attempt'
import { upgradeLegacyQuizDraftV4 } from '../../lib/draft-v4'
import type { QuizAttempt } from '../../models/attempt'
import { LocalPracticeCache, LocalPracticeCacheV4, practiceCacheKey, practiceCacheKeyV4 } from './practice-cache'
import { listPracticeBackups, restorePracticeBackup } from './practice-recovery'
import { createPracticeStore } from './practice-store'
import { PersistenceError } from './repositories'
import { createV4MemoryRepository, memoryStorage, pen, v3Quiz, v4Catalog, v4Quiz } from './practice-v4.test-helper'

const handDraw = (text = 'inactive') => ({ type: 'calculation' as const, mode: 'drawing' as const, text, strokes: [pen()] })
/** Storage-compatible map for the recovery API (which expects the Storage key/length surface). */
function browserLike() {
  const base = memoryStorage()
  const storage = Object.assign(base, { key: (index: number) => [...base.data.keys()][index] ?? null, clear: () => base.data.clear() })
  Object.defineProperty(storage, 'length', { get: () => base.data.size })
  return storage as unknown as Storage & { data: Map<string, string> }
}

describe('M5 schema-2 local cache namespace', () => {
  it('keeps the existing schema-1 cache readable and isolates schema 2 in its own namespace', async () => {
    const server = createV4MemoryRepository('a')
    const record = await server.repo.getOrCreateDraft(v3Quiz)
    const storage = memoryStorage(), cache = new LocalPracticeCache('a', () => storage)
    cache.write({ id: record.id, attempt: record.attempt as QuizAttempt, version: record.version })
    expect(cache.read(record.id, v3Quiz)?.attempt.schemaVersion).toBe(1)
    expect(practiceCacheKeyV4('a', record.id)).not.toBe(practiceCacheKey('a', record.id))
    expect(storage.getItem(practiceCacheKeyV4('a', record.id))).toBeNull()
  })

  it('reads/writes schema-2 drafts strictly and isolates accounts and attempts', async () => {
    const server = createV4MemoryRepository('a')
    const record = await server.repo.getOrCreateDraft(v4Quiz)
    const draft = { ...upgradeLegacyQuizDraftV4(record.attempt as QuizAttempt, v4Quiz)!, answers: { q_hand: handDraw() } }
    const storage = memoryStorage()
    const a = new LocalPracticeCacheV4('a', () => storage), b = new LocalPracticeCacheV4('b', () => storage)
    a.write({ id: record.id, attempt: draft, version: record.version })
    expect(a.read(record.id, v4Quiz)?.attempt.answers.q_hand).toEqual(handDraw())
    expect(b.read(record.id, v4Quiz)).toBeNull()
    expect(a.read('00000000-0000-4000-8000-00000000ffff', v4Quiz)).toBeNull()
    // Exact revision only: the same bytes never decode against another revision.
    expect(() => a.read(record.id, v3Quiz)).toThrow(PersistenceError)
  })

  it('backs up a corrupt schema-2 cache entry instead of repairing it', async () => {
    const server = createV4MemoryRepository('a')
    const record = await server.repo.getOrCreateDraft(v4Quiz)
    const storage = memoryStorage()
    storage.setItem(practiceCacheKeyV4('a', record.id), '{"cacheVersion":4,"broken":')
    expect(() => new LocalPracticeCacheV4('a', () => storage).read(record.id, v4Quiz)).toThrow(PersistenceError)
    expect(storage.getItem(`${practiceCacheKeyV4('a', record.id)}:recovery:migration`)).toBe('{"cacheVersion":4,"broken":')
  })

  it('promotes a matching schema-1 local draft into the v4 namespace and retains the original as evidence', async () => {
    const server = createV4MemoryRepository('a')
    const record = await server.repo.getOrCreateDraft(v4Quiz)
    const storage = memoryStorage(), cache = new LocalPracticeCache('a', () => storage)
    const local = reduceAttempt(v4Quiz, record.attempt as QuizAttempt, { type: 'answer', questionId: 'q_hand',
      answer: { type: 'calculation', text: 'offline typed' }, now: '2099-01-01T00:00:00.000Z' })
    cache.write({ id: record.id, attempt: local, version: record.version })
    const v3Bytes = storage.getItem(practiceCacheKey('a', record.id))
    const store = createPracticeStore(record, server.repo, cache, 60_000)
    expect(store.getSnapshot().attempt.answers.q_hand).toEqual({ type: 'calculation', mode: 'text', text: 'offline typed', strokes: [] })
    expect(storage.getItem(practiceCacheKeyV4('a', record.id))).toContain('offline typed')
    expect(storage.getItem(practiceCacheKey('a', record.id))).toBe(v3Bytes)
    await store.retry()
    expect(server.v4Saves).toHaveLength(1)
    expect(server.v3Saves).toHaveLength(0)
    store.stop()
  })

  it('never lets schema-1 local data replace a server marker-2 draft', async () => {
    const server = createV4MemoryRepository('a')
    const record = await server.repo.getOrCreateDraft(v4Quiz)
    const storage = memoryStorage(), cache = new LocalPracticeCache('a', () => storage)
    const first = createPracticeStore(record, server.repo, cache, 60_000)
    first.answer('q_hand', handDraw('server v4'))
    await first.retry(); first.stop()
    storage.removeItem(practiceCacheKeyV4('a', record.id))
    const stale = reduceAttempt(v4Quiz, record.attempt as QuizAttempt, { type: 'answer', questionId: 'q_hand',
      answer: { type: 'calculation', text: 'stale schema-1 local' }, now: '2099-01-01T00:00:00.000Z' })
    cache.write({ id: record.id, attempt: stale, version: record.version })
    const reloaded = createPracticeStore((await server.repo.loadAttempt(record.id))!, server.repo, cache, 60_000)
    expect(reloaded.getSnapshot().attempt.answers.q_hand).toEqual(handDraw('server v4'))
    reloaded.stop()
  })
})

describe('M5 recovery', () => {
  it('lists schema-2 backups with their marker and restores them only through the v4 writer', async () => {
    const server = createV4MemoryRepository('a')
    const record = await server.repo.getOrCreateDraft(v4Quiz)
    const storage = browserLike()
    const v4 = new LocalPracticeCacheV4('a', () => storage)
    const draft = { ...upgradeLegacyQuizDraftV4(record.attempt as QuizAttempt, v4Quiz)!, answers: { q_hand: handDraw('recovered') } }
    v4.archive({ id: record.id, attempt: draft, version: record.version }, 'test conflict')
    const [backup] = listPracticeBackups('a', storage)
    expect(backup).toMatchObject({ schemaVersion: 2, attemptId: record.id, quizId: v4Quiz.id })
    expect(listPracticeBackups('b', storage)).toEqual([])
    expect(await restorePracticeBackup('a', backup.key, storage, server.repo, v4Catalog)).toBe(v4Quiz.id)
    expect(storage.getItem(backup.key)).not.toBeNull()
    const store = createPracticeStore((await server.repo.loadAttempt(record.id))!, server.repo, new LocalPracticeCache('a', () => storage), 60_000)
    await store.retry()
    expect(server.v4Saves.at(-1)?.attempt.answers.q_hand).toEqual(handDraw('recovered'))
    expect(server.v3Saves).toHaveLength(0)
    store.stop()
  })

  it('promotes a schema-1 backup for a v4-capable revision and refuses schema-1 restore over a marker-2 draft', async () => {
    const server = createV4MemoryRepository('a')
    const record = await server.repo.getOrCreateDraft(v4Quiz)
    const storage = browserLike(), legacy = new LocalPracticeCache('a', () => storage)
    const local = reduceAttempt(v4Quiz, record.attempt as QuizAttempt, { type: 'answer', questionId: 'q_hand',
      answer: { type: 'calculation', text: 'legacy backup' }, now: '2099-01-01T00:00:00.000Z' })
    legacy.archive({ id: record.id, attempt: local, version: record.version })
    const [backup] = listPracticeBackups('a', storage)
    expect(backup.schemaVersion).toBe(1)
    await restorePracticeBackup('a', backup.key, storage, server.repo, v4Catalog)
    expect(storage.getItem(practiceCacheKeyV4('a', record.id))).toContain('legacy backup')

    const textOnly = createV4MemoryRepository('a')
    const draft = await textOnly.repo.getOrCreateDraft(v3Quiz)
    const promoted = upgradeLegacyQuizDraftV4(draft.attempt as QuizAttempt, v3Quiz)!
    textOnly.serverEdit(draft.id, promoted)
    const store2 = browserLike(), cache2 = new LocalPracticeCache('a', () => store2)
    cache2.archive({ id: draft.id, attempt: draft.attempt as QuizAttempt, version: (await textOnly.repo.loadAttempt(draft.id))!.version })
    const [oldBackup] = listPracticeBackups('a', store2)
    await expect(restorePracticeBackup('a', oldBackup.key, store2, textOnly.repo, v4Catalog)).rejects.toMatchObject({ kind: 'conflict' })
  })

  it('rejects a schema-1 backup over a marker-2 server draft even with the CURRENT matching CAS', async () => {
    const server = createV4MemoryRepository('a')
    const record = await server.repo.getOrCreateDraft(v4Quiz)
    const promoted = upgradeLegacyQuizDraftV4(record.attempt as QuizAttempt, v4Quiz)!
    const currentVersion = server.serverEdit(record.id, promoted)
    expect(server.rows.get(record.id)!.schemaVersion).toBe(2)
    expect(Object.keys(server.rows.get(record.id)!.record.attempt!.answers)).toHaveLength(0)
    const storage = browserLike()
    const legacy = reduceAttempt(v4Quiz, record.attempt as QuizAttempt, { type: 'answer', questionId: 'q_hand',
      answer: { type: 'calculation', text: 'schema-1 backup' }, now: '2099-01-01T00:00:00.000Z' })
    // Deliberately bind the backup to the server's CURRENT version so CAS cannot be the reason.
    new LocalPracticeCache('a', () => storage).archive({ id: record.id, attempt: legacy, version: { id: record.id, updatedAt: currentVersion } })
    const [backup] = listPracticeBackups('a', storage)
    expect(backup.schemaVersion).toBe(1)
    await expect(restorePracticeBackup('a', backup.key, storage, server.repo, v4Catalog)).rejects.toMatchObject({ kind: 'conflict' })
    expect(storage.getItem(practiceCacheKeyV4('a', record.id))).toBeNull()
    expect(storage.getItem(backup.key)).not.toBeNull()

    // A genuine schema-2 backup with the current CAS still restores over the empty marker-2 draft.
    const v4Backup = { ...promoted, answers: { q_hand: handDraw('v4 backup') } }
    new LocalPracticeCacheV4('a', () => storage).archive({ id: record.id, attempt: v4Backup, version: { id: record.id, updatedAt: currentVersion } })
    const v4Key = listPracticeBackups('a', storage).find((item) => item.schemaVersion === 2)!.key
    expect(await restorePracticeBackup('a', v4Key, storage, server.repo, v4Catalog)).toBe(v4Quiz.id)
    expect(storage.getItem(practiceCacheKeyV4('a', record.id))).toContain('v4 backup')
  })

  it('keeps malformed or wrong-revision v4 backups and rejects them', async () => {
    const server = createV4MemoryRepository('a')
    const record = await server.repo.getOrCreateDraft(v4Quiz)
    const storage = browserLike()
    const key = `${practiceCacheKeyV4('a', record.id)}:recovery:manual`
    storage.setItem(key, JSON.stringify({ cacheVersion: 4, ownerId: 'a', id: record.id, version: record.version,
      attempt: { schemaVersion: 2, quizId: v4Quiz.id, quizRevision: 'missing-revision', status: 'in-progress',
        startedAt: record.attempt!.startedAt, updatedAt: record.attempt!.updatedAt, answers: {} } }))
    await expect(restorePracticeBackup('a', key, storage, server.repo, v4Catalog)).rejects.toBeInstanceOf(PersistenceError)
    storage.setItem(key, '{broken')
    await expect(restorePracticeBackup('a', key, storage, server.repo, v4Catalog)).rejects.toBeTruthy()
    expect(storage.getItem(key)).toBe('{broken')
    expect(storage.getItem(practiceCacheKeyV4('a', record.id))).toBeNull()
  })
})
