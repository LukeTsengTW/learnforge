import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAttempt, reduceAttempt } from '../../lib/attempt'
import { decodeAttempt } from '../../lib/attempt-storage'
import { answerQuizDraftV4, emptyCalculationAnswerV4, requiresV4Draft, upgradeLegacyQuizDraftV4 } from '../../lib/draft-v4'
import { emptyCalculationAnswerV5, requiresV5Draft } from '../../lib/draft-v5'
import type { QuizAttempt } from '../../models/attempt'
import type { QuizDraftV4 } from '../../models/draft-v4'
import { LocalPracticeCache, practiceCacheKey, practiceCacheKeyV4, STALE_V5_DRAFT_REASON } from './practice-cache'
import { createPracticeStore, INVALID_SUBMISSION_NOTICE, SCHEMA_CHANGED_NOTICE, STALE_DRAFT_NOTICE } from './practice-store'
import { SubmissionError } from './practice-repository'
import { quizCatalog } from './quiz-loader'
import { createV4MemoryRepository, memoryStorage, pen, v3Quiz, v4Quiz } from './practice-v4.test-helper'
vi.mock('./quiz-loader', async (importOriginal) => (await import('../../test-fixtures/fixture-quizzes.test-helper')).withFixtureQuizzes(await importOriginal<typeof import('./quiz-loader')>()))

afterEach(() => { vi.useRealTimers() })
const handText = (text: string, strokes = [pen()]) => ({ type: 'calculation' as const, mode: 'text' as const, text, strokes })
const handDraw = (strokes = [pen()], text = 'inactive note') => ({ type: 'calculation' as const, mode: 'drawing' as const, text, strokes })
const handTextV5 = (text: string) => ({ type: 'calculation' as const, mode: 'text' as const, text, pages: [[]] })
const handDrawV5 = (strokes = [pen()], text = 'inactive note') => ({ type: 'calculation' as const, mode: 'drawing' as const, text, pages: [strokes] })

describe('M5 v4 compatibility and schema-3 capability', () => {
  it('uses the exact revision: calculation drawing capability selects schema 3 while v4 parsing stays compatible', () => {
    expect(requiresV4Draft(v4Quiz)).toBe(true)
    expect(requiresV5Draft(v4Quiz)).toBe(true)
    expect(requiresV4Draft(v3Quiz)).toBe(false)
    expect(requiresV5Draft(v3Quiz)).toBe(false)
    // Capability belongs to the exact revision, including archived text-only revisions.
    expect(requiresV4Draft(quizCatalog.getQuizRevision('demo', 'v2-handwriting')!)).toBe(true)
    expect(requiresV4Draft(quizCatalog.getQuizRevision('demo', 'v1-7d7c900e')!)).toBe(false)
    expect(requiresV4Draft(quizCatalog.getQuizRevision('discrete-math', '1')!)).toBe(false)
    expect(requiresV4Draft(quizCatalog.getQuizRevision('discrete-math', '2')!)).toBe(true)
  })

  it('promotes a schema-1 draft without changing objective/fill answers, text or timestamps', () => {
    const now = '2026-10-02T00:00:00.000Z'
    const legacy: QuizAttempt = { ...createAttempt(v4Quiz, now), updatedAt: '2026-10-02T00:00:05.000Z', answers: {
      q_single: { type: 'single', optionId: 'b' }, q_fill: { type: 'fill', text: ' CPU ' },
      q_text: { type: 'calculation', text: '2x = 4' }, q_hand: { type: 'calculation', text: '$x=3$\n' },
      q_draw: { type: 'drawing', strokes: [pen(100)] } } }
    const promoted = upgradeLegacyQuizDraftV4(legacy, v4Quiz)!
    expect(promoted).toMatchObject({ schemaVersion: 2, status: 'in-progress', startedAt: now, updatedAt: '2026-10-02T00:00:05.000Z' })
    expect(promoted.answers).toEqual({ ...legacy.answers,
      q_text: { type: 'calculation', mode: 'text', text: '2x = 4', strokes: [] },
      q_hand: { type: 'calculation', mode: 'text', text: '$x=3$\n', strokes: [] } })
    const submitted = reduceAttempt(v4Quiz, legacy, { type: 'submit', now: '2026-10-02T00:01:00.000Z' })
    expect(upgradeLegacyQuizDraftV4(submitted, v4Quiz)).toBeNull()
    expect(upgradeLegacyQuizDraftV4({ ...legacy, answers: { q_hand: { type: 'calculation', text: 'x', mode: 'text' } as never } }, v4Quiz)).toBeNull()
  })

  it('never decodes a v4 calculation (or any schema-2 draft) as a schema-1 attempt', () => {
    const base = createAttempt(v4Quiz, '2026-10-02T00:00:00.000Z')
    expect(decodeAttempt(JSON.stringify({ ...base, answers: { q_hand: handDraw() } }), v4Quiz)).toBeNull()
    expect(decodeAttempt(JSON.stringify({ ...base, answers: { q_hand: handText('x') } }), v4Quiz)).toBeNull()
    expect(decodeAttempt(JSON.stringify({ ...base, schemaVersion: 2 }), v4Quiz)).toBeNull()
    expect(decodeAttempt(JSON.stringify({ ...base, answers: { q_hand: { type: 'calculation', text: 'legacy' } } }), v4Quiz))
      .not.toBeNull()
  })

  it('updates a v4 answer purely: full calculation retained, inactive buffer kept, time advanced, input unmutated', () => {
    const draft = upgradeLegacyQuizDraftV4(createAttempt(v4Quiz, '2026-10-02T00:00:00.000Z'), v4Quiz)!
    const before = JSON.stringify(draft)
    const next = answerQuizDraftV4(v4Quiz, draft, 'q_hand', handDraw([pen()], 'keep me'), '2026-10-02T00:00:01.000Z')
    expect(next.answers.q_hand).toEqual(handDraw([pen()], 'keep me'))
    expect(next).toMatchObject({ status: 'in-progress', updatedAt: '2026-10-02T00:00:01.000Z', schemaVersion: 2 })
    expect(JSON.stringify(draft)).toBe(before)
    for (const bad of [{ type: 'calculation', text: 'legacy' }, { ...handText('x'), score: 4 }, { type: 'fill', text: 'x' },
      handDraw([{ ...pen(), points: [{ x: 9000, y: 1 }] }])]) {
      expect(answerQuizDraftV4(v4Quiz, draft, 'q_hand', bad as never, '2026-10-02T00:00:02.000Z')).toBe(draft)
    }
    expect(answerQuizDraftV4(v4Quiz, draft, 'q_text', handDraw(), '2026-10-02T00:00:02.000Z')).toBe(draft)
  })
})

describe('M5 practice store schema routing', () => {
  it('keeps a v3-only exact revision on schema 1 and the legacy v3 writer', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v3Quiz)
    const local = memoryStorage()
    const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', () => local), 60_000)
    expect(store.getSnapshot().draftSchema).toBe(1)
    store.answer('q_hand', { type: 'calculation', text: 'x = 3' })
    store.answer('q_hand', handText('ignored v4 shape'))
    await store.retry()
    expect(server.v3Saves).toHaveLength(1)
    expect(server.v4Saves).toHaveLength(0)
    expect((await server.repo.loadAttempt(initial.id))?.attempt?.answers.q_hand).toEqual({ type: 'calculation', text: 'x = 3' })
    expect(local.getItem(practiceCacheKeyV4('student', initial.id))).toBeNull()
    store.stop()
  })

  it('promotes a schema-1 server draft in memory with no write on load, then saves as schema 3', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const local = memoryStorage()
    const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', () => local), 60_000)
    expect(store.getSnapshot().draftSchema).toBe(3)
    expect(store.getSnapshot().attempt.schemaVersion).toBe(3)
    await store.retry()
    expect(server.v3Saves).toHaveLength(0)
    expect(server.v4Saves).toHaveLength(0)
    expect(server.v5Saves).toHaveLength(0)
    expect(server.rows.get(initial.id)!.schemaVersion).toBe(1)
    store.answer('q_hand', handDrawV5([pen()], 'my text stays'))
    store.answer('q_single', { type: 'single', optionId: 'b' })
    await store.retry()
    expect(server.v3Saves).toHaveLength(0)
    expect(server.v4Saves).toHaveLength(0)
    expect(server.v5Saves).toHaveLength(1)
    expect(server.v5Saves[0].attempt.answers.q_hand).toEqual(handDrawV5([pen()], 'my text stays'))
    expect(server.rows.get(initial.id)!.schemaVersion).toBe(3)
    expect(local.getItem(practiceCacheKeyV4('student', initial.id))).toBeNull()
    expect(local.getItem(`learnforge:attempt:v5:student:${initial.id}`)).toContain('my text stays')
    store.stop()
  })

  it('rejects legacy answers on a schema-3 store and never converts back to legacy', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', memoryStorage), 60_000)
    store.answer('q_hand', { type: 'calculation', text: 'legacy shape' })
    expect(store.getSnapshot().attempt.answers.q_hand).toBeUndefined()
    store.answer('q_hand', handTextV5('v4 text'))
    await store.retry()
    const record = await server.repo.loadAttempt(initial.id)
    expect(record?.schemaVersion).toBe(3)
    expect(record?.attempt?.answers.q_hand).toEqual(handTextV5('v4 text'))
    expect(server.v4Saves).toHaveLength(0)
    expect(server.v5Saves).toHaveLength(1)
    store.stop()
  })

  it('promotes a schema-2 server draft on the exact capable revision and preserves both buffers', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const v4 = upgradeLegacyQuizDraftV4(initial.attempt as QuizAttempt, v4Quiz)!
    server.serverEdit(initial.id, v4)
    const v4Record = await server.repo.loadAttempt(initial.id)
    const first = createPracticeStore(v4Record!, server.repo, new LocalPracticeCache('student', memoryStorage), 60_000)
    first.answer('q_hand', handDrawV5([pen(), pen(200)], 'inactive survives'))
    await first.retry(); first.stop()
    const reloaded = await server.repo.loadAttempt(initial.id)
    const second = createPracticeStore(reloaded!, server.repo, new LocalPracticeCache('student', memoryStorage), 60_000)
    expect(second.getSnapshot().draftSchema).toBe(3)
    expect(second.getSnapshot().attempt.answers.q_hand).toEqual(handDrawV5([pen(), pen(200)], 'inactive survives'))
    expect(server.rows.get(initial.id)!.schemaVersion).toBe(3)
    second.stop()
  })
})

describe('M5 formal submission', () => {
  it('saves pending edits first, then submits only CAS/request id and expects ai-grading-v5 for schema 3', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const save = server.repo.saveDraft
    const savedVersions: string[] = []
    server.repo.saveDraft = async (...args) => { const saved = await save(...args); savedVersions.push(saved.version.updatedAt); return saved }
    const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', memoryStorage), 60_000)
    store.answer('q_hand', handDrawV5())
    expect(await store.submit()).toBe(initial.id)
    expect(server.v5Saves).toHaveLength(1)
    expect(server.submits).toHaveLength(1)
    expect(server.submits[0]).toMatchObject({ gradingVersion: 'ai-grading-v5', expectedUpdatedAt: savedVersions[0] })
    expect(savedVersions[0]).not.toBe(initial.version.updatedAt)
    expect(store.getSnapshot().attempt.status).toBe('submitted')
    store.stop()
  })

  it('promotes an untouched schema-1 draft on explicit submit instead of submitting it as schema 1', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', memoryStorage), 60_000)
    expect(await store.submit()).toBe(initial.id)
    expect(server.v5Saves).toHaveLength(1)
    expect(server.submits[0].gradingVersion).toBe('ai-grading-v5')
    store.stop()
  })

  it('expects ai-grading-v3 for schema 1 and rejects a mismatched version client-side', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v3Quiz)
    const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', memoryStorage), 60_000)
    expect(await store.submit()).toBe(initial.id)
    expect(server.submits[0].gradingVersion).toBe('ai-grading-v3')
    store.stop()

    const mismatch = createV4MemoryRepository('student')
    const draft = await mismatch.repo.getOrCreateDraft(v4Quiz)
    mismatch.submitBehavior.mockImplementationOnce(async (row) => {
      row.record.row = { ...row.record.row, grading_version: 'ai-grading-v3' }
      return { state: 'submitted', result: { score: 0, maxScore: 0, correctCount: 0, partialCount: 0, incorrectCount: 0,
        unansweredCount: 0, manualCount: 0, questions: [] } }
    })
    const schema3Store = createPracticeStore(draft, mismatch.repo, new LocalPracticeCache('student', memoryStorage), 60_000)
    expect(await schema3Store.submit()).toBeNull()
    expect(schema3Store.getSnapshot().notice).toBe('AI 評分暫時無法完成，本次作答尚未提交，請稍後再試。')
    schema3Store.stop()
  })

  it('handles 422 invalid_answers explicitly: no polling, editable draft, fresh request id', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', memoryStorage), 60_000)
    server.submitBehavior.mockImplementationOnce(async () => { throw new SubmissionError('invalid') })
    store.answer('q_text', { type: 'calculation', mode: 'text', text: 'a'.repeat(9000), strokes: [] })
    expect(await store.submit()).toBeNull()
    expect(store.getSnapshot().notice).toBe(INVALID_SUBMISSION_NOTICE)
    expect(server.submits).toHaveLength(1)
    expect(store.getSnapshot().attempt.status).toBe('in-progress')
    store.answer('q_text', { type: 'calculation', mode: 'text', text: 'x = 2', strokes: [] })
    expect(await store.submit()).toBe(initial.id)
    expect(server.submits[1].requestId).not.toBe(server.submits[0].requestId)
    store.stop()
  })

  it('maps 409 to conflict and keeps the draft', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', memoryStorage), 60_000)
    server.submitBehavior.mockImplementationOnce(async () => { throw new SubmissionError('conflict') })
    expect(await store.submit()).toBeNull()
    expect(store.getSnapshot().notice).toBe('雲端草稿已變更，作答尚未提交。請確認答案後重試。')
    expect(server.rows.get(initial.id)!.record.row.status).toBe('draft')
    store.stop()
  })

  it('keeps bounded in_progress polling unchanged', async () => {
    vi.useFakeTimers()
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', memoryStorage), 60_000)
    server.submitBehavior.mockImplementation(async () => ({ state: 'pending' }))
    const submitting = store.submit()
    await vi.advanceTimersByTimeAsync(40 * 1500)
    expect(await submitting).toBeNull()
    expect(server.submits).toHaveLength(40)
    expect(store.getSnapshot().notice).toBe('AI 評分暫時無法完成，本次作答尚未提交，請稍後再試。')
    store.stop()
  })
})

describe('M5 multi-tab and CAS safety', () => {
  it('old schema-1 tab cannot overwrite a promoted schema-3 server draft or the v5 local namespace', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const shared = memoryStorage()
    // Tab B (new client) promotes and saves through save-quiz-draft.
    const b = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', () => shared), 60_000)
    b.answer('q_hand', handDrawV5([pen()], 'B text'))
    await b.retry()
    expect(server.rows.get(initial.id)!.schemaVersion).toBe(3)
    const v5Key = `learnforge:attempt:v5:student:${initial.id}`
    const v5Bytes = shared.getItem(v5Key)
    // Tab A (old code path): writes only the schema-1 namespace and the legacy v3 writer.
    const oldAttempt = reduceAttempt(v4Quiz, initial.attempt as QuizAttempt, { type: 'answer', questionId: 'q_hand',
      answer: { type: 'calculation', text: 'A legacy overwrite' }, now: '2026-10-02T01:00:00.000Z' })
    new LocalPracticeCache('student', () => shared).write({ id: initial.id, attempt: oldAttempt, version: initial.version })
    await expect(server.repo.saveDraft({ ...initial, version: server.rows.get(initial.id)!.record.version }, oldAttempt))
      .rejects.toMatchObject({ kind: 'conflict' })
    expect(server.rows.get(initial.id)!.record.attempt!.answers.q_hand).toEqual(handDrawV5([pen()], 'B text'))
    expect(shared.getItem(v5Key)).toBe(v5Bytes)
    expect(shared.getItem(practiceCacheKey('student', initial.id))).toContain('A legacy overwrite')
    b.stop()
    // B reloads the intact v5 draft; the stale schema-1 local data never replaces server marker 3.
    const reloaded = createPracticeStore((await server.repo.loadAttempt(initial.id))!, server.repo,
      new LocalPracticeCache('student', () => shared), 60_000)
    expect(reloaded.getSnapshot().attempt.answers.q_hand).toEqual(handDrawV5([pen()], 'B text'))
    reloaded.stop()
  })

  it('a schema-1 store that discovers server marker 2 stops syncing instead of downgrading', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v3Quiz)
    const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', memoryStorage), 60_000)
    const promoted = upgradeLegacyQuizDraftV4(initial.attempt as QuizAttempt, v3Quiz) as QuizDraftV4
    server.serverEdit(initial.id, { ...promoted, updatedAt: '2026-10-02T02:00:00.000Z' })
    store.answer('q_single', { type: 'single', optionId: 'a' })
    await store.retry()
    expect(store.getSnapshot().notice).toBe(SCHEMA_CHANGED_NOTICE)
    expect(server.v3Saves).toHaveLength(0)
    expect(await store.submit()).toBeNull()
    expect(server.submits).toHaveLength(0)
    store.stop()
  })

  it('two schema-3 tabs: the stale CAS save conflicts, preserves local work and never overwrites', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const storageA = memoryStorage(), storageB = memoryStorage()
    const a = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', () => storageA), 60_000)
    const b = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', () => storageB), 60_000)
    a.answer('q_hand', handTextV5('A wins'))
    await a.retry()
    const versionA = server.rows.get(initial.id)!.record.version.updatedAt
    // B has an unsaved local edit based on V0 with a NEWER client timestamp than A's.
    b.answer('q_hand', handTextV5('B stale'))
    // The low-level writer refuses B's stale CAS.
    await expect(server.repo.saveDraft({ ...initial }, b.getSnapshot().attempt)).rejects.toMatchObject({ kind: 'conflict' })
    const savesBeforeRetry = server.v5Saves.length
    // Normal store path: B syncs. The newer server generation wins; B's work is preserved, not auto-saved.
    await b.retry()
    expect(server.rows.get(initial.id)!.record.version.updatedAt).toBe(versionA)
    expect(server.rows.get(initial.id)!.record.attempt!.answers.q_hand).toEqual(handTextV5('A wins'))
    expect(server.v5Saves).toHaveLength(savesBeforeRetry)
    expect(server.v5Saves.every((save) => JSON.stringify(save.attempt).includes('B stale') === false)).toBe(true)
    expect(b.getSnapshot().attempt.answers.q_hand).toEqual(handTextV5('A wins'))
    expect(b.getSnapshot().notice).toBe(STALE_DRAFT_NOTICE)
    const backups = [...storageB.data.entries()].filter(([key]) => key.startsWith(`learnforge:attempt:v5:student:${initial.id}:recovery:`))
    expect(backups).toHaveLength(1)
    expect(backups[0][1]).toContain('B stale')
    expect(backups[0][1]).toContain(STALE_V5_DRAFT_REASON)
    // A further retry does not resurrect the stale edit either.
    await b.retry()
    expect(server.v5Saves).toHaveLength(savesBeforeRetry)
    expect(server.rows.get(initial.id)!.record.attempt!.answers.q_hand).toEqual(handTextV5('A wins'))
    // Same server generation: ordinary local edits still autosave normally.
    b.answer('q_hand', handTextV5('B after reload'))
    await b.retry()
    expect(server.v5Saves).toHaveLength(savesBeforeRetry + 1)
    expect(server.rows.get(initial.id)!.record.attempt!.answers.q_hand).toEqual(handTextV5('B after reload'))
    a.stop(); b.stop()
  })
})

describe('M5 pending input before submission', () => {
  it('commits flushed editor input before saving, and saves before submitting', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', memoryStorage), 60_000)
    const order: string[] = []
    const save = server.repo.saveDraft, submitDraft = server.repo.submitDraft
    server.repo.saveDraft = async (...args) => { order.push(`save:${JSON.stringify(args[1].answers.q_hand)}`); return save(...args) }
    server.repo.submitDraft = async (...args) => { order.push('submit'); return submitDraft(...args) }
    // The registry flush (as wired by PracticeQuizRoute) runs synchronously before store.submit().
    const flushPending = () => store.answer('q_hand', { type: 'calculation', mode: 'drawing', text: '', pages: [[pen(), pen(220)]] })
    flushPending()
    expect(await store.submit()).toBe(initial.id)
    expect(order).toEqual([`save:${JSON.stringify({ type: 'calculation', mode: 'drawing', text: '', pages: [[pen(), pen(220)]] })}`, 'submit'])
    expect(emptyCalculationAnswerV4()).toEqual({ type: 'calculation', mode: 'text', text: '', strokes: [] })
    expect(emptyCalculationAnswerV5(true)).toEqual({ type: 'calculation', mode: 'text', text: '', pages: [[]] })
    store.stop()
  })
})
