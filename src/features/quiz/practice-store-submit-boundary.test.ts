import { DRAWING_LIMITS } from '../../../supabase/functions/_shared/drawing-raster'
import { describe, expect, it } from 'vitest'
import type { PracticeAnswer } from '../../models/draft-v4'
import type { DrawingStroke } from '../../models/drawing'
import { LocalPracticeCache, practiceCacheKeyV4, STALE_V4_DRAFT_REASON } from './practice-cache'
import { createPracticeStore, STALE_DRAFT_NOTICE } from './practice-store'
import { createV4MemoryRepository, memoryStorage, v4Quiz } from './practice-v4.test-helper'

/**
 * Store half of the submit-boundary contract: every answer update has a synchronous outcome, an
 * older save of this store never rolls newer local work back, and a draft that synchronization
 * replaced is never submitted in place of the one the user saw.
 */
const strokes = (count: number, points = 2): DrawingStroke[] => Array.from({ length: count }, (_, row) => ({
  tool: 'pen', color: '#202b38', width: 4,
  points: Array.from({ length: points }, (_, step) => ({ x: 10 + (step % 700), y: 10 + (row % 500) })) }))
const MAX_STROKES = DRAWING_LIMITS.maxStrokes, MAX_POINTS = DRAWING_LIMITS.maxPoints
const hand = (drawn: DrawingStroke[], text = ''): PracticeAnswer => ({ type: 'calculation', mode: 'drawing', text, strokes: drawn })
const handStrokes = (attempt: { answers: Record<string, unknown> } | null | undefined) =>
  (attempt?.answers.q_hand as { strokes: DrawingStroke[] } | undefined)?.strokes ?? []

async function environment() {
  const server = createV4MemoryRepository('student')
  const initial = await server.repo.getOrCreateDraft(v4Quiz)
  const storage = memoryStorage()
  const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', () => storage), 60_000)
  const staleBackups = () => [...storage.data.entries()].filter(([key, value]) =>
    key.startsWith(`${practiceCacheKeyV4('student', initial.id)}:recovery:`) && value.includes(STALE_V4_DRAFT_REASON))
  return { server, initial, storage, store, staleBackups, row: () => server.rows.get(initial.id)! }
}

describe('answer updates have a synchronous outcome', () => {
  it('reports accepted, limit and rejected, and a refusal leaves the draft exactly as it was', async () => {
    const { store } = await environment()
    expect(store.answer('q_hand', hand(strokes(MAX_STROKES, 1)))).toBe('accepted')
    const held = store.getSnapshot().attempt
    // One stroke more than the stroke ceiling, and one point more than the point budget.
    expect(store.answer('q_hand', hand(strokes(MAX_STROKES + 1, 1)))).toBe('limit')
    expect(store.answer('q_hand', hand([...strokes(MAX_POINTS / 100, 100), ...strokes(1, 1)]))).toBe('limit')
    expect(store.getSnapshot().attempt).toBe(held)
    expect(handStrokes(held)).toHaveLength(MAX_STROKES)
    // Refused for other reasons: unknown question, answer of another type.
    expect(store.answer('q_missing', hand([]))).toBe('rejected')
    expect(store.answer('q_hand', { type: 'fill', text: 'x' })).toBe('rejected')
    expect(store.getSnapshot().attempt).toBe(held)
    // Still editable: a drawing that fits is accepted again.
    expect(store.answer('q_hand', hand(strokes(MAX_POINTS / 100, 100)))).toBe('accepted')
    store.stop()
    expect(store.answer('q_hand', hand(strokes(1)))).toBe('rejected')
  })

  it('rejects updates while a submission is in flight and accepts them again after it fails', async () => {
    const { store, server, initial } = await environment()
    const submitDraft = server.repo.submitDraft
    let finish: (() => void) | null = null
    server.repo.submitDraft = async (...args) => { await new Promise<void>((resolve) => { finish = resolve }); return submitDraft(...args) }
    expect(store.answer('q_hand', hand(strokes(2)))).toBe('accepted')
    const submitting = store.submit()
    await expect.poll(() => finish).not.toBeNull()
    expect(store.answer('q_hand', hand(strokes(3)))).toBe('rejected')
    finish!()
    expect(await submitting).toBe(initial.id)
    expect(handStrokes(server.rows.get(initial.id)!.record.attempt)).toHaveLength(2)
    store.stop()
  })
})

describe('an older save of this store never rolls newer local work back', () => {
  it('adopts its own save when the server applied it but the response was lost, then saves and submits the newer drawing', async () => {
    const { store, server, initial, staleBackups, row } = await environment()
    const save = server.repo.saveDraft
    let lose = true
    server.repo.saveDraft = async (...args) => {
      const saved = await save(...args)
      if (lose) { lose = false; throw new Error('network: response lost') }
      return saved
    }
    store.answer('q_hand', hand(strokes(2)))
    await store.retry()
    // The server holds the two strokes under a generation the store never learned.
    expect(handStrokes(row().record.attempt)).toHaveLength(2)
    store.answer('q_hand', hand(strokes(3)))
    expect(await store.submit()).toBe(initial.id)
    expect(server.v4Saves.map((item) => handStrokes(item.attempt).length)).toEqual([2, 3])
    expect(server.submits).toHaveLength(1)
    expect(server.submits[0].expectedUpdatedAt).not.toBe(initial.version.updatedAt)
    expect(handStrokes(row().record.attempt)).toHaveLength(3)
    expect(store.getSnapshot().notice).toBeNull()
    expect(staleBackups()).toHaveLength(0)
    store.stop()
  })

  it('recognizes its own save even when it reaches the server after a newer save was already sent', async () => {
    const { store, server, staleBackups, row } = await environment()
    const save = server.repo.saveDraft
    type SaveArguments = Parameters<typeof save>
    let delayed: SaveArguments | null = null
    let call = 0
    server.repo.saveDraft = async (...args) => {
      call++
      // 1: the request leaves but the client gives up on it. 2: it lands just before the newer save.
      if (call === 1) { delayed = args; throw new Error('network: timeout') }
      if (call === 2) await save(...delayed!)
      return save(...args)
    }
    store.answer('q_hand', hand(strokes(2)))
    await store.retry()
    expect(handStrokes(row().record.attempt)).toHaveLength(0)
    store.answer('q_hand', hand(strokes(3)))
    await store.retry() // the newer save loses the CAS against the store's own older save
    expect(handStrokes(row().record.attempt)).toHaveLength(2)
    expect(handStrokes(store.getSnapshot().attempt)).toHaveLength(3)
    await store.retry()
    expect(handStrokes(row().record.attempt)).toHaveLength(3)
    expect(handStrokes(store.getSnapshot().attempt)).toHaveLength(3)
    expect(store.getSnapshot().notice).not.toBe(STALE_DRAFT_NOTICE)
    expect(staleBackups()).toHaveLength(0)
    store.stop()
  })

  it('does not treat another client as its own save: a different server draft still wins and local work is set aside', async () => {
    const { store, server, initial, staleBackups, row } = await environment()
    const save = server.repo.saveDraft
    let lose = true
    server.repo.saveDraft = async (...args) => {
      const saved = await save(...args)
      if (lose) { lose = false; throw new Error('network: response lost') }
      return saved
    }
    store.answer('q_hand', hand(strokes(2)))
    await store.retry()
    // Another client replaces the draft before this store synchronizes again.
    const other = { ...row().record.attempt!, updatedAt: '2026-10-02T05:00:00.000Z',
      answers: { q_hand: hand(strokes(1), 'other device') } } as typeof initial.attempt
    server.serverEdit(initial.id, other!)
    store.answer('q_hand', hand(strokes(3)))
    const savesBefore = server.v4Saves.length
    await store.retry()
    expect(server.v4Saves).toHaveLength(savesBefore)
    expect(row().record.attempt!.answers.q_hand).toEqual(hand(strokes(1), 'other device'))
    expect(store.getSnapshot().attempt.answers.q_hand).toEqual(hand(strokes(1), 'other device'))
    expect(store.getSnapshot().notice).toBe(STALE_DRAFT_NOTICE)
    expect(staleBackups()).toHaveLength(1)
    store.stop()
  })
})

describe('submit boundary guard', () => {
  it('does not submit a different server draft in place of the one held at submit, and says so', async () => {
    const { store, server, initial, staleBackups, row } = await environment()
    store.answer('q_hand', hand(strokes(2)))
    await store.retry()
    const other = { ...row().record.attempt!, updatedAt: '2026-10-02T05:00:00.000Z',
      answers: { q_hand: hand(strokes(1), 'other device') } } as typeof initial.attempt
    server.serverEdit(initial.id, other!)
    store.answer('q_hand', hand(strokes(3))) // what the user sees when pressing submit
    expect(await store.submit()).toBeNull()
    expect(server.submits).toHaveLength(0)
    expect(row().record.row.status).toBe('draft')
    expect(store.getSnapshot().notice).toContain('作答尚未提交')
    expect(store.getSnapshot().notice).toContain(STALE_DRAFT_NOTICE)
    // The page now shows the other client's draft; the user's own strokes are in the local backup.
    expect(store.getSnapshot().attempt.answers.q_hand).toEqual(hand(strokes(1), 'other device'))
    expect(staleBackups()).toHaveLength(1)
    // Submitting again is a decision about the draft that is now on screen.
    expect(await store.submit()).toBe(initial.id)
    expect(server.submits).toHaveLength(1)
    expect(row().record.attempt!.answers.q_hand).toEqual(hand(strokes(1), 'other device'))
    store.stop()
  })

  it('also stops when the draft was replaced although this page had nothing unsaved', async () => {
    const { store, server, initial, row } = await environment()
    store.answer('q_hand', hand(strokes(2)))
    await store.retry()
    const other = { ...row().record.attempt!, updatedAt: '2026-10-02T05:00:00.000Z',
      answers: { q_hand: hand(strokes(1), 'other device') } } as typeof initial.attempt
    server.serverEdit(initial.id, other!)
    expect(await store.submit()).toBeNull()
    expect(server.submits).toHaveLength(0)
    expect(store.getSnapshot().notice).toBe('雲端草稿已更新，請確認目前答案後再提交。')
    expect(store.getSnapshot().attempt.answers.q_hand).toEqual(hand(strokes(1), 'other device'))
    store.stop()
  })
})
