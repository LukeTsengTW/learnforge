import { describe, expect, it, vi } from 'vitest'
import { createAttempt } from '../../lib/attempt'
import { requiresV4Draft, upgradeLegacyQuizDraftV4 } from '../../lib/draft-v4'
import type { AppSupabase } from '../../lib/supabase'
import type { QuizAttempt } from '../../models/attempt'
import { requiresV4DraftContext } from '../../../supabase/functions/_shared/draft-v4'
import { createSaveQuizDraftHandler, type DraftAttemptSnapshot, type DraftSaveBackend } from '../../../supabase/functions/save-quiz-draft/handler'
import { LocalPracticeCache, LocalPracticeCacheV4, practiceCacheKeyV4 } from './practice-cache'
import { restorePracticeBackup } from './practice-recovery'
import { mapPracticeRecord, SupabasePracticeRepository, type PracticeRecord } from './practice-repository'
import { draftSchemaFor } from './practice-store'
import { quizCatalog } from './quiz-loader'
import { fromDatabaseV4, type RubricJudgmentRow } from './repositories'
import { createV4MemoryRepository, memoryStorage, pen, submittedV4Rows, v3Quiz, v4Catalog, v4Quiz } from './practice-v4.test-helper'
import { ctx, fixture as edgeFixture, lookup as edgeLookup, R0, R1, submit as edgeSubmit } from './submission-v4.test-helper'

const demo = quizCatalog.getCurrentQuiz('demo')!
const attemptId = '00000000-0000-4000-8000-0000000000e1'
const userId = '00000000-0000-4000-8000-0000000000e2'
const version = '2026-10-02T05:00:00.123456Z'
const handText = { type: 'calculation', mode: 'text', text: 'x = 3', strokes: [] }

function saveBackend(quizId: string, revision: string) {
  const state = { attempt: { id: attemptId, user_id: userId, quiz_id: quizId, quiz_revision: revision, status: 'draft',
    updated_at: version, answer_schema_version: 1 } as DraftAttemptSnapshot }
  const backend: DraftSaveBackend = { userId,
    loadAttempt: vi.fn(async () => structuredClone(state.attempt)),
    saveDraft: vi.fn(async () => { state.attempt.answer_schema_version = 2
      return { attemptId, updatedAt: '2026-10-02T05:00:01.000000Z', answerSchemaVersion: 2 as const } }) }
  return { state, backend }
}
const saveRequest = (answers: Record<string, unknown>) => new Request('https://local.invalid/save-quiz-draft', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ attemptId, expectedUpdatedAt: version, clientUpdatedAt: '2026-10-02T05:00:02.000Z', answers }) })

describe('M5.1 one exact-revision v4 capability rule', () => {
  it('client and Edge share the same predicate; every bundled revision stays schema 1 / v3', () => {
    expect(requiresV4DraftContext(v4Quiz.questions)).toBe(true)
    expect(requiresV4DraftContext(v3Quiz.questions)).toBe(false)
    expect(requiresV4DraftContext(edgeLookup.listRevision(v4Quiz.id, R1))).toBe(true)
    expect(requiresV4DraftContext(edgeLookup.listRevision(v4Quiz.id, R0))).toBe(false)
    for (const entry of quizCatalog.current) {
      expect(requiresV4Draft(entry.quiz)).toBe(requiresV4DraftContext(entry.quiz.questions))
      expect(requiresV4Draft(entry.quiz)).toBe(false)
    }
  })
})

describe('M5.1 save-quiz-draft enforces capability on the server', () => {
  it('refuses a direct save for the bundled v3-only exact revision without any write or promotion', async () => {
    const env = saveBackend(demo.id, demo.revision)
    const calc = demo.questions.find((question) => question.type === 'calculation')!
    // Uses the real bundled exact-revision context (tutorContext), not a browser hint.
    const response = await createSaveQuizDraftHandler(env.backend)(saveRequest({ [calc.id]: { type: 'calculation', text: 'x' } }))
    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('unavailable')
    expect(env.backend.saveDraft).not.toHaveBeenCalled()
    expect(env.state.attempt.answer_schema_version).toBe(1)
  })

  it('accepts the same valid request for a v4-capable exact revision', async () => {
    const env = saveBackend(v4Quiz.id, R1)
    const response = await createSaveQuizDraftHandler(env.backend, edgeLookup)(saveRequest({ q_hand: handText }))
    expect(response.status).toBe(200)
    expect(env.backend.saveDraft).toHaveBeenCalledTimes(1)
    expect(env.state.attempt.answer_schema_version).toBe(2)
  })
})

describe('M5.1 submit-quiz refuses schema 2 on a non-capable revision', () => {
  it('returns unavailable before fill/rubric claims, raster, providers or finalization', async () => {
    const edge = edgeFixture({ q_fill: { type: 'fill', text: 'GPU' }, q_hand: handText }, { revision: R0 })
    const claimFill = vi.spyOn(edge.backend, 'claimFill')
    const response = await edge.submit(edgeSubmit())
    expect(response.status).toBe(503)
    expect(claimFill).not.toHaveBeenCalled()
    expect(edge.state.claims).toEqual([])
    expect(edge.state.failures).toEqual([])
    expect(edge.fillProvider.judge).not.toHaveBeenCalled()
    expect(edge.calculationV4.generateText).not.toHaveBeenCalled()
    expect(edge.calculationV4.generateDrawing).not.toHaveBeenCalled()
    expect(edge.drawingProvider.generate).not.toHaveBeenCalled()
    expect(edge.backend.finalize).not.toHaveBeenCalled()
    expect(edge.backend.v4!.finalize).not.toHaveBeenCalled()
    expect(edge.state.attempt.status).toBe('draft')
    expect(ctx('q_hand', R0).drawing).toBeUndefined()
  })

  it('never reconstructs a submitted schema-2 row on a non-capable revision (no evidence loading)', async () => {
    const edge = edgeFixture({ q_hand: handText }, { revision: R0 })
    Object.assign(edge.state.attempt, { status: 'submitted', grading_version: 'ai-grading-v4',
      submission_request_id: '00000000-0000-4000-8000-000000000522' })
    const loadFill = vi.spyOn(edge.backend, 'loadFinalFillJudgments')
    expect((await edge.submit(edgeSubmit())).status).toBe(503)
    expect(loadFill).not.toHaveBeenCalled()
    expect(edge.backend.v4!.loadAnswerHashes).not.toHaveBeenCalled()
  })
})

describe('M5.1 client refuses marker 2 on a non-capable exact revision', () => {
  const v3Record = (): PracticeRecord => ({ id: attemptId, schemaVersion: 2, quiz: v3Quiz,
    attempt: upgradeLegacyQuizDraftV4(createAttempt(v3Quiz, '2026-10-02T05:00:00.000Z'), v3Quiz),
    version: { id: attemptId, updatedAt: version },
    row: { id: attemptId, user_id: userId, quiz_id: v3Quiz.id, quiz_revision: v3Quiz.revision, status: 'draft',
      answer_schema_version: 2 } as PracticeRecord['row'] })

  it('does not choose schema 2 for marker 2 on a non-capable revision', () => {
    expect(() => draftSchemaFor(v3Record(), v3Quiz)).toThrow()
    expect(draftSchemaFor({ ...v3Record(), schemaVersion: 1 }, v3Quiz)).toBe(1)
  })

  it('rejects the schema-2 reader for a non-capable exact revision (draft unavailable, submitted null)', () => {
    const fixture = submittedV4Rows(userId)
    const row = { ...fixture.row, quiz_revision: v3Quiz.revision }
    const rubric = fixture.rubric.map((item) => ({ ...item, quiz_revision: v3Quiz.revision })) as unknown as RubricJudgmentRow[]
    expect(() => fromDatabaseV4(row as never, row.answers as never, v3Quiz, userId, [], rubric)).toThrow()
    expect(mapPracticeRecord(row as never, userId, v4Catalog, [], rubric).attempt).toBeNull()
    const draft = { ...row, status: 'draft', grading_version: 'deterministic-v1', submission_request_id: null, submitted_at: null }
    expect(() => mapPracticeRecord(draft as never, userId, v4Catalog)).toThrow()
  })

  it('never invokes save-quiz-draft for a non-capable exact revision', async () => {
    const invoke = vi.fn(), rpc = vi.fn()
    const repo = new SupabasePracticeRepository({ functions: { invoke }, rpc } as unknown as AppSupabase, userId, v4Catalog)
    const record = v3Record()
    await expect(repo.saveDraft(record, { ...record.attempt!, updatedAt: '2026-10-02T05:00:03.000Z' } as never))
      .rejects.toMatchObject({ kind: 'invalid' })
    expect(invoke).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('does not legitimize schema-2 local cache or recovery data for a non-capable revision', async () => {
    const storage = memoryStorage()
    const draft = upgradeLegacyQuizDraftV4(createAttempt(v4Quiz, '2026-10-02T05:00:00.000Z'), v4Quiz)!
    const cache = new LocalPracticeCacheV4('a', () => storage)
    cache.write({ id: attemptId, attempt: draft, version: { id: attemptId, updatedAt: version } })
    const bytes = storage.getItem(practiceCacheKeyV4('a', attemptId))
    expect(() => cache.read(attemptId, v3Quiz)).toThrow()
    expect(storage.getItem(practiceCacheKeyV4('a', attemptId))).toBe(bytes)

    const server = createV4MemoryRepository('a')
    const record = await server.repo.getOrCreateDraft(v3Quiz)
    const browser = Object.assign(memoryStorage(), { key: () => null, clear: () => undefined, length: 0 }) as unknown as Storage
    const key = `${practiceCacheKeyV4('a', record.id)}:recovery:manual`
    browser.setItem(key, JSON.stringify({ cacheVersion: 4, ownerId: 'a', id: record.id, version: record.version,
      attempt: { ...upgradeLegacyQuizDraftV4(record.attempt as QuizAttempt, v3Quiz), answers: { q_hand: handText } } }))
    await expect(restorePracticeBackup('a', key, browser, server.repo, v4Catalog)).rejects.toMatchObject({ kind: 'conflict' })
    expect(new LocalPracticeCache('a', () => browser).read(record.id, v3Quiz)).toBeNull()
    expect(pen()).toBeTruthy()
  })
})
