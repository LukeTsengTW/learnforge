import { describe, expect, it, vi } from 'vitest'
import { DRAFT_V5_LIMITS } from '../../../supabase/functions/_shared/draft-v5'
import { DRAWING_LIMITS } from '../../../supabase/functions/_shared/drawing-raster'
import { drawingCapacity, drawingUsage, ORDINARY_STROKE_BYTES, ORDINARY_STROKE_POINTS } from '../../lib/drawing-capacity'
import { draftAnswerMapBytesV5 } from '../../lib/draft-v5'
import type { PracticeAnswerV5, PracticeAttempt } from '../../models/draft-v4'
import type { DrawingStroke } from '../../models/drawing'
import type { Quiz } from '../../models/quiz'
import { LocalPracticeCache } from './practice-cache'
import { mapPracticeRecord } from './practice-repository'
import { createPracticeStore, DRAFT_FULL_NOTICE } from './practice-store'
import { createV4MemoryRepository, memoryStorage, v4Catalog, v4Quiz } from './practice-v4.test-helper'
import { PersistenceError } from './repositories'

/**
 * The whole draft has a size that can be saved. The store takes an answer update only while the draft
 * stays within it, tells the user when it does not, and never ends up holding answers it cannot save.
 */
const hand = v4Quiz.questions.find((question) => question.id === 'q_hand')!
/** Twenty handwriting-capable calculation questions: long typed answers reach the size cap. */
const quiz: Quiz = { ...v4Quiz, id: 'capacity-synthetic', revision: 'c1',
  questions: Array.from({ length: 20 }, (_, index) => ({ ...hand, id: `c${String(index + 1).padStart(2, '0')}`, drawing: { width: 1200, height: 900 } })) }
const CAP = DRAFT_V5_LIMITS.maxAnswerBytes
const config = { width: 1200, height: 900 }
const typed = (chars: number, cjk = true): PracticeAnswerV5 => ({ type: 'calculation', mode: 'text', text: (cjk ? '題' : 'x').repeat(chars), pages: [[]] })
const written = (strokes: DrawingStroke[]): PracticeAnswerV5 => ({ type: 'calculation', mode: 'drawing', text: '', pages: [strokes] })
const answerBytes = (attempt: PracticeAttempt) => {
  if (attempt.schemaVersion !== 3) throw new Error('Expected a schema-3 draft')
  return draftAnswerMapBytesV5(attempt.answers)
}
const id = (index: number) => quiz.questions[index].id
/** The longest stroke the capacity line keeps room for, with coordinates that take the most bytes. */
const longestOrdinaryStroke = (width = 100): DrawingStroke => ({ tool: 'eraser', color: '#202b38', width,
  points: Array.from({ length: ORDINARY_STROKE_POINTS }, (_, index) => ({ x: 1100.1 + (index % 2) * 10.8, y: 800.1 + (index % 3) * 10.8 })) })

async function environment() {
  const server = createV4MemoryRepository('student')
  const initial = await server.repo.getOrCreateDraft(quiz)
  const storage = memoryStorage()
  const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', () => storage), 60_000)
  const bytes = () => store.getSnapshot().draftBytes
  /** Typed answers on the questions after the first until exactly `left` bytes remain below the cap. */
  function fill(left: number) {
    let index = 1
    const room = () => CAP - left - bytes()
    for (; room() > 300_200; index++) expect(store.answer(id(index), typed(100_000))).toBe('accepted')
    for (; room() > 95_000; index++) expect(store.answer(id(index), typed(90_000, false))).toBe('accepted')
    const before = bytes()
    expect(store.answer(id(index), typed(0, false))).toBe('accepted')
    const overhead = bytes() - before
    expect(store.answer(id(index), typed(CAP - left - before - overhead, false))).toBe('accepted')
    expect(bytes()).toBe(CAP - left)
  }
  return { server, initial, store, bytes, fill, row: () => server.rows.get(initial.id)! }
}

describe('the store takes an update only while the whole draft can still be saved', () => {
  it('reports the size of the draft exactly as saving measures it', async () => {
    const { store, bytes } = await environment()
    expect(bytes()).toBe(2)
    expect(store.answer(id(0), typed(1234))).toBe('accepted')
    expect(store.answer(id(1), written([longestOrdinaryStroke(4)]))).toBe('accepted')
    expect(bytes()).toBe(answerBytes(store.getSnapshot().attempt))
  })

  it('refuses the update that would pass the cap as draft-limit, says so on the page, and keeps the draft as it was', async () => {
    const { store, bytes, fill, server, row } = await environment()
    fill(5_000)
    const held = store.getSnapshot().attempt
    expect(store.getSnapshot().notice).toBeNull()
    // A typed answer and a handwritten one, each larger than what is left.
    expect(store.answer(id(0), typed(6_000, false))).toBe('draft-limit')
    expect(store.getSnapshot().notice).toBe(DRAFT_FULL_NOTICE)
    expect(store.answer(id(0), written([longestOrdinaryStroke()]))).toBe('draft-limit')
    expect(store.getSnapshot().attempt).toBe(held)
    expect(bytes()).toBe(CAP - 5_000)
    // An answer that is too large on its own is still reported as that answer's limit.
    expect(store.answer(id(0), written(Array.from({ length: DRAWING_LIMITS.maxStrokes + 1 }, () => longestOrdinaryStroke(4)).map((stroke) => ({ ...stroke, points: stroke.points.slice(0, 1) }))))).toBe('limit')
    // Something that fits is taken, and the page notice goes away with it.
    expect(store.answer(id(0), typed(1_000, false))).toBe('accepted')
    expect(store.getSnapshot().notice).toBeNull()
    // Everything the store accepted is saved by the next synchronization.
    await store.retry()
    expect(server.v5Saves).toHaveLength(1)
    expect(store.getSnapshot().notice).toBeNull()
    expect(answerBytes(row().record.attempt!)).toBe(bytes())
    expect(bytes()).toBeLessThanOrEqual(CAP)
    store.stop()
  })

  it('takes a change that makes the draft smaller when it is full, so the user can always make room', async () => {
    const { store, bytes, fill } = await environment()
    fill(0)
    expect(bytes()).toBe(CAP)
    expect(store.answer(id(0), typed(1, false))).toBe('draft-limit')
    // Shorten one of the long answers: accepted, and the refused update fits afterwards.
    expect(store.answer(id(1), typed(50_000))).toBe('accepted')
    expect(store.answer(id(0), typed(1, false))).toBe('accepted')
    store.stop()
  })

  it('while the capacity line is not tight, the store accepts the longest ordinary stroke; without that room it may not', async () => {
    for (const left of [ORDINARY_STROKE_BYTES, ORDINARY_STROKE_BYTES + 4_000]) {
      const { store, bytes, fill } = await environment()
      fill(left)
      const capacity = drawingCapacity(drawingUsage([], config), 100, { usedBytes: bytes(), maxBytes: CAP })
      expect(capacity.tight).toBe(false)
      expect(store.answer(id(0), written([longestOrdinaryStroke()]))).toBe('accepted')
      expect(bytes()).toBeLessThanOrEqual(CAP)
      store.stop()
    }
    // One byte less and the line is tight: it makes no promise any more.
    const edge = await environment()
    edge.fill(ORDINARY_STROKE_BYTES - 1)
    expect(drawingCapacity(drawingUsage([], config), 100, { usedBytes: edge.bytes(), maxBytes: CAP })).toMatchObject({ tight: true, limit: 'draft' })
    edge.store.stop()
    // With little enough room the same stroke is refused, for the right reason.
    const full = await environment()
    full.fill(3_000)
    expect(full.store.answer(id(0), written([longestOrdinaryStroke()]))).toBe('draft-limit')
    full.store.stop()
  })
})

describe('a client that reads a draft above its own limits fails safe', () => {
  // What a page with lower limits (an older bundle left open) sees after a newer page saved more than it allows.
  const tooMany = Array.from({ length: DRAWING_LIMITS.maxStrokes + 1 }, (_, index): DrawingStroke =>
    ({ tool: 'pen', color: '#202b38', width: 4, points: [{ x: 10 + index % 700, y: 10 + index % 500 }] }))
  const answer = { type: 'calculation', mode: 'drawing', text: '', strokes: tooMany }
  const row = (status: 'draft' | 'submitted') => ({ id: 'attempt-1', user_id: 'student', quiz_id: v4Quiz.id, quiz_revision: v4Quiz.revision, status,
    started_at: '2026-10-02T00:00:00.000Z', client_updated_at: '2026-10-02T00:10:00.000Z', updated_at: '2026-10-02T00:10:01.000Z',
    submitted_at: status === 'submitted' ? '2026-10-02T00:11:00.000Z' : null,
    grading_version: status === 'submitted' ? 'ai-grading-v4' : 'deterministic-v1', submission_request_id: null,
    deterministic_score: null, deterministic_max_score: null, correct_count: null, partial_count: 0, incorrect_count: null,
    unanswered_count: null, created_at: '2026-10-02T00:00:00.000Z', answer_schema_version: 2,
    answers: [{ id: 'answer-1', attempt_id: 'attempt-1', user_id: 'student', question_id: 'q_hand', answer, created_at: '2026-10-02T00:10:00.000Z' }],
  }) as unknown as Parameters<typeof mapPracticeRecord>[0]

  it('does not load such a draft, and shows a submitted attempt of that kind as unreadable instead of failing', () => {
    expect(() => mapPracticeRecord(row('draft'), 'student', v4Catalog)).toThrow(PersistenceError)
    expect(mapPracticeRecord(row('submitted'), 'student', v4Catalog).attempt).toBeNull()
  })

  it('an open page never saves over, deletes or submits a draft it can no longer read', async () => {
    const server = createV4MemoryRepository('student')
    const initial = await server.repo.getOrCreateDraft(v4Quiz)
    const store = createPracticeStore(initial, server.repo, new LocalPracticeCache('student', () => memoryStorage()), 60_000)
    expect(store.answer('q_hand', written([tooMany[0]]))).toBe('accepted')
    // From now on the server holds a draft this client cannot decode: reading it fails as it does in the real repository.
    const saveDraft = vi.spyOn(server.repo, 'saveDraft'), deleteDraft = vi.spyOn(server.repo, 'deleteDraft'), submitDraft = vi.spyOn(server.repo, 'submitDraft')
    server.repo.loadAttempt = async () => { throw new PersistenceError('invalid') }
    await store.retry()
    expect(store.getSnapshot().notice).toBe('作答資料格式不符，已停止同步並保留本機內容。')
    expect(await store.deleteDraft()).toBe(false)
    expect(await store.submit()).toBeNull()
    expect(saveDraft).not.toHaveBeenCalled()
    expect(deleteDraft).not.toHaveBeenCalled()
    expect(submitDraft).not.toHaveBeenCalled()
    // The server row is untouched and the local answers are still held.
    expect(server.rows.get(initial.id)!.record.row.status).toBe('draft')
    expect(store.getSnapshot().attempt.answers).toHaveProperty('q_hand')
    store.stop()
  })
})
