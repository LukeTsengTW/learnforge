import { describe, expect, it, vi } from 'vitest'
import { DRAFT_V4_LIMITS, DraftValidationError, normalizeDraftAnswersV4, sameDraftTimestamp,
  validDraftTimestamp, type DraftQuestionContext } from '../../../supabase/functions/_shared/draft-v4'
import { parseSaveQuizDraftRequest } from '../../../supabase/functions/_shared/draft-request'
import { createSaveQuizDraftHandler, DraftSaveConflict,
  type DraftAttemptSnapshot, type DraftSaveBackend } from '../../../supabase/functions/save-quiz-draft/handler'

const attemptId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const version = '2026-10-01T10:00:00.123456Z', nextVersion = '2026-10-01T10:00:01.000001Z'
const config = { width: 800, height: 600 }
const stroke = { tool: 'pen', color: '#202b38', width: 4, points: [{ x: 100, y: 100 }] }
const calc = { type: 'calculation', mode: 'text', text: '  $x = 3$\n\n', strokes: [stroke] }
const contexts: DraftQuestionContext[] = [
  { questionId: 'single', type: 'single', options: [{ id: 'a' }, { id: 'b' }] },
  { questionId: 'multiple', type: 'multiple', options: [{ id: 'a' }, { id: 'b' }] },
  { questionId: 'tf', type: 'true-false' }, { questionId: 'fill', type: 'fill' },
  { questionId: 'calc', type: 'calculation', drawing: config },
  { questionId: 'textonly', type: 'calculation' }, { questionId: 'draw', type: 'drawing', drawing: config },
]
const input = { attemptId, expectedUpdatedAt: version, clientUpdatedAt: nextVersion, answers: { calc } }
const request = (body: unknown = input) => new Request('https://local.invalid/save-quiz-draft', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

function setup(overrides: Partial<DraftAttemptSnapshot> = {}) {
  const state = { attempt: { id: attemptId, user_id: userId, quiz_id: 'fixture', quiz_revision: 'new',
    status: 'draft', updated_at: version, answer_schema_version: 1, ...overrides },
  answers: { calc: { type: 'calculation', text: 'old' } } as Record<string, unknown> }
  const backend: DraftSaveBackend = {
    userId,
    loadAttempt: vi.fn(async () => structuredClone(state.attempt)),
    saveDraft: vi.fn(async (save) => {
      if (!sameDraftTimestamp(state.attempt.updated_at, save.expectedUpdatedAt)) throw new DraftSaveConflict()
      state.answers = structuredClone(save.answers)
      state.attempt.answer_schema_version = 2
      state.attempt.updated_at = nextVersion
      return { attemptId, updatedAt: nextVersion, answerSchemaVersion: 2 as const }
    }),
  }
  const lookup = { listRevision: vi.fn((quizId: string, revision: string) => {
    if (quizId !== 'fixture') return []
    if (revision === 'new') return contexts
    if (revision === 'old') return contexts.map((question) => question.questionId === 'calc'
      ? { questionId: question.questionId, type: question.type } : question)
    return []
  }) }
  return { backend, state, lookup, handler: createSaveQuizDraftHandler(backend, lookup) }
}

describe('draft-save request envelope', () => {
  it('accepts exactly changes/CAS and canonicalizes UUID casing', () => {
    expect(parseSaveQuizDraftRequest(input)).toEqual(input)
    expect(parseSaveQuizDraftRequest({ ...input, attemptId: attemptId.toUpperCase() })?.attemptId).toBe(attemptId)
  })
  it.each(['userId', 'ownerId', 'quizId', 'quizRevision', 'startedAt', 'answerSchemaVersion', 'gradingVersion',
    'submissionRequestId', 'score', 'result', 'model', 'rubric'])('rejects browser-owned %s', (key) => {
    expect(parseSaveQuizDraftRequest({ ...input, [key]: 'forged' })).toBeNull()
  })
  it.each([{ ...input, attemptId: 'bad' }, { ...input, expectedUpdatedAt: 'infinity' },
    { ...input, clientUpdatedAt: '2026-02-30T10:00:00Z' }, { ...input, answers: [] }])('rejects malformed envelope', (value) => {
    expect(parseSaveQuizDraftRequest(value)).toBeNull()
  })
  it('compares full microsecond CAS precision rather than truncating to JavaScript milliseconds', () => {
    expect(sameDraftTimestamp(version, '2026-10-01T12:00:00.123456+02:00')).toBe(true)
    expect(sameDraftTimestamp(version, '2026-10-01T10:00:00.123457Z')).toBe(false)
    expect(validDraftTimestamp('2026-10-01T10:00:00.1234567Z')).toBe(false)
  })
})

describe('canonical future answer validation', () => {
  it('normalizes legacy calculation and preserves exact objective/fill/drawing semantics', () => {
    const raw = { single: { type: 'single', optionId: 'a' }, multiple: { type: 'multiple', optionIds: ['b', 'a'] },
      tf: { type: 'true-false', value: false }, fill: { type: 'fill', text: '  \n' },
      calc: { type: 'calculation', text: calc.text }, draw: { type: 'drawing', strokes: [stroke] } }
    const before = JSON.stringify(raw), normalized = normalizeDraftAnswersV4(contexts, raw)
    expect(normalized).toEqual({ ...raw, calc: { ...calc, strokes: [] } })
    expect(normalized.draw).not.toBe(raw.draw)
    expect(JSON.stringify(raw)).toBe(before)
  })
  it.each(['text', 'drawing'])('keeps both bounded buffers in calculation %s mode', (mode) => {
    expect(normalizeDraftAnswersV4(contexts, { calc: { ...calc, mode } })).toEqual({ calc: { ...calc, mode } })
  })
  it('accepts text-only calculation and blank strokes without meaningful-blankness/raster work', () => {
    expect(normalizeDraftAnswersV4(contexts, { textonly: { ...calc, text: '', strokes: [] },
      draw: { type: 'drawing', strokes: [] } })).toEqual({ textonly: { ...calc, text: '', strokes: [] },
      draw: { type: 'drawing', strokes: [] } })
  })
  it.each(['score', 'rubric', 'model', 'prompt', 'answerHash', 'gradingVersion', 'png', 'image', 'imageUrl', 'base64',
    'width', 'height'])('rejects future calculation extra/authority field %s', (key) => {
    expect(() => normalizeDraftAnswersV4(contexts, { calc: { ...calc, [key]: 'forged' } })).toThrow(DraftValidationError)
  })
  it.each([
    { single: { type: 'single', optionId: 'unknown' } },
    { single: { type: 'single', optionId: 'a', score: 1 } },
    { multiple: { type: 'multiple', optionIds: ['a', 'a'] } },
    { multiple: { type: 'multiple', optionIds: ['unknown'] } },
    { tf: { type: 'true-false', value: 'true' } }, { fill: { type: 'fill', text: 3 } },
    { fill: { type: 'fill', text: 'x', rubric: [] } },
    { draw: { type: 'drawing', strokes: [], width: 800, height: 600 } },
    { calc: { ...calc, mode: 'both' } }, { textonly: { ...calc, mode: 'drawing', strokes: [] } },
    { textonly: calc }, { calc: { type: 'drawing', strokes: [stroke] } },
    { unknown: calc }, { calc: null },
  ])('rejects non-canonical or malformed answer', (answers) => {
    expect(() => normalizeDraftAnswersV4(contexts, answers)).toThrow(DraftValidationError)
  })
  it('preserves the existing 100000-character draft text bound', () => {
    const fill = { type: 'fill', text: '字'.repeat(100000) }
    expect(normalizeDraftAnswersV4(contexts, { fill }).fill).toEqual(fill)
    expect(() => normalizeDraftAnswersV4(contexts, { fill: { ...fill, text: fill.text + '字' } })).toThrow('oversized')
  })
})

describe('authenticated Edge draft save', () => {
  it('calls the service backend with authenticated identity and normalized answers, returning only version metadata', async () => {
    const env = setup()
    const response = await env.handler(request({ ...input, answers: { calc: { type: 'calculation', text: calc.text } } }))
    expect(response.status).toBe(200)
    expect(env.backend.saveDraft).toHaveBeenCalledExactlyOnceWith({ userId, attemptId, expectedUpdatedAt: version,
      clientUpdatedAt: nextVersion, answers: { calc: { ...calc, strokes: [] } } })
    expect(await response.json()).toEqual({ attemptId, updatedAt: nextVersion, answerSchemaVersion: 2 })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(env.state.attempt.answer_schema_version).toBe(2)
    expect(env.lookup.listRevision).toHaveBeenCalledExactlyOnceWith('fixture', 'new')
  })
  it('authenticates before reading any body or loading an attempt', async () => {
    const env = setup()
    env.backend.userId = null
    const response = await env.handler(request({ ...input, answers: 'invalid' }))
    expect(response.status).toBe(401)
    expect(env.backend.loadAttempt).not.toHaveBeenCalled()
    expect(env.backend.saveDraft).not.toHaveBeenCalled()
  })
  it('rejects foreign and missing attempts with identical generic responses', async () => {
    const foreign = setup({ user_id: 'foreign' }), missing = setup()
    vi.mocked(missing.backend.loadAttempt).mockResolvedValue(null)
    const a = await foreign.handler(request()), b = await missing.handler(request())
    expect(a.status).toBe(409)
    expect(b.status).toBe(409)
    expect(await a.json()).toEqual(await b.json())
    expect(foreign.backend.saveDraft).not.toHaveBeenCalled()
    expect(missing.backend.saveDraft).not.toHaveBeenCalled()
  })
  it.each([{ updated_at: '2026-10-01T10:00:00.123457Z' }, { status: 'submitted' }])('rejects stale/submitted drafts before save', async (row) => {
    const env = setup(row), before = JSON.stringify(env.state)
    expect((await env.handler(request())).status).toBe(409)
    expect(env.backend.saveDraft).not.toHaveBeenCalled()
    expect(JSON.stringify(env.state)).toBe(before)
  })
  it('uses the old exact revision capability and never falls back to the current revision', async () => {
    const env = setup({ quiz_revision: 'old' }), before = JSON.stringify(env.state)
    const response = await env.handler(request({ ...input, answers: { calc: { ...calc, mode: 'drawing' } } }))
    expect(response.status).toBe(400)
    expect(env.lookup.listRevision).toHaveBeenCalledExactlyOnceWith('fixture', 'old')
    expect(env.backend.saveDraft).not.toHaveBeenCalled()
    expect(JSON.stringify(env.state)).toBe(before)
    expect((await env.handler(request({ ...input, answers: { calc: { type: 'calculation', text: 'old text' } } }))).status).toBe(200)
  })
  it('refuses missing canonical revisions without calling the RPC', async () => {
    const env = setup({ quiz_revision: 'missing' })
    expect((await env.handler(request())).status).toBe(503)
    expect(env.backend.saveDraft).not.toHaveBeenCalled()
  })
  it('returns a generic conflict if CAS changes after validation and before the atomic RPC', async () => {
    const env = setup(), before = JSON.stringify(env.state)
    vi.mocked(env.backend.saveDraft).mockRejectedValue(new DraftSaveConflict('private SQL details'))
    const response = await env.handler(request())
    expect(response.status).toBe(409)
    expect(JSON.stringify(await response.json())).not.toContain('private SQL')
    expect(JSON.stringify(env.state)).toBe(before)
  })
  it('does not leak backend/provider/SQL details or student answers', async () => {
    const env = setup()
    vi.mocked(env.backend.loadAttempt).mockRejectedValue(new Error('service_role secret canonical answer'))
    const response = await env.handler(request())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ code: 'unavailable', error: '無法儲存草稿，請確認作答狀態後重試。' })
  })
  it('rejects over-limit streaming bodies even when Content-Length lies', async () => {
    const env = setup(), cancel = vi.fn(), before = JSON.stringify(env.state)
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array(DRAFT_V4_LIMITS.maxRequestBytes))
      controller.enqueue(new Uint8Array(1))
    }, cancel })
    const response = await env.handler(new Request('https://local.invalid', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '1' }, body, duplex: 'half' } as RequestInit))
    expect(response.status).toBe(413)
    expect(cancel).toHaveBeenCalled()
    expect(env.backend.loadAttempt).not.toHaveBeenCalled()
    expect(env.backend.saveDraft).not.toHaveBeenCalled()
    expect(JSON.stringify(env.state)).toBe(before)
  })
  it.each([
    [{ unknown: calc }, 400], [{ calc: { ...calc, type: 'fill' } }, 400],
    [{ calc: { ...calc, mode: 'both' } }, 400], [{ textonly: { ...calc, mode: 'drawing' } }, 400],
    [{ calc: { ...calc, strokes: Array.from({ length: 257 }, () => stroke) } }, 413],
    [{ calc: { ...calc, strokes: [{ ...stroke, points: Array.from({ length: 6001 }, () => stroke.points[0]) }] } }, 413],
    [{ calc: { ...calc, strokes: [{ ...stroke, points: [{ x: 801, y: 100 }] }] } }, 400],
    [{ calc: { ...calc, strokes: [{ ...stroke, tool: 'brush' }] } }, 400],
    [{ calc: { ...calc, strokes: [{ ...stroke, color: '#ffffff' }] } }, 400],
    [{ calc: { ...calc, strokes: [{ ...stroke, width: 41 }] } }, 400],
    [{ calc: { ...calc, strokes: [{ ...stroke, points: [{ x: 100, y: 100, score: 1 }] }] } }, 400],
    [{ calc: { ...calc, drawing: { width: 2000, height: 2000 } } }, 400],
    [{ calc: { ...calc, score: 6 } }, 400],
    [{ draw: { type: 'drawing', strokes: [{ ...stroke, points: [{ x: -1, y: 0 }] }] } }, 400],
    [Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`q${i}`, calc])), 413],
    [{ calc: { ...calc, strokes: [{ ...stroke, points: Array.from({ length: 100 }, (_, i) =>
      ({ x: i % 2 ? 800 : 0, y: i % 2 ? 600 : 0 })) }] } }, 413],
    [{ calc: { ...calc, text: 'x'.repeat(DRAFT_V4_LIMITS.maxAnswerBytes) } }, 413],
  ] as const)('leaves all prior state untouched for malformed/resource-excessive ingress', async (answers, status) => {
    const env = setup(), before = JSON.stringify(env.state)
    expect((await env.handler(request({ ...input, answers }))).status).toBe(status)
    expect(env.backend.saveDraft).not.toHaveBeenCalled()
    expect(JSON.stringify(env.state)).toBe(before)
  })
})
