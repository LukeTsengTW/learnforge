import { describe, expect, it, vi } from 'vitest'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import type { TutorQuestionContext } from '../../../supabase/functions/_shared/ai-tutor'
import { validateDrawingResult } from '../../../supabase/functions/_shared/drawing-analysis'
import { createDrawingHandler, type DrawingBackend } from '../../../supabase/functions/ai-drawing/handler'

const contexts = AI_QUIZ_CONTEXT as unknown as TutorQuestionContext[]
const drawing = contexts.find((item) => item.type === 'drawing')!
const calculation = contexts.find((item) => item.type === 'calculation')!
const objective = contexts.find((item) => item.type === 'single')!
const userId = crypto.randomUUID()
const attemptId = crypto.randomUUID()
const usage = { inputTokens: 100, cachedInputTokens: 5, outputTokens: 200, reasoningTokens: 40 }
const analyzed = validateDrawingResult({ overallScore: 4, maxScore: 4,
  criteria: [1, 2, 3, 4].map((n) => ({ criterionId: `r${n}`, awardedScore: 1, maxScore: 1,
    status: 'full', feedback: `第 ${n} 項符合。` })),
  observations: ['兩個輸入'], missingOrUnclear: [], summary: '符合。', confidence: 'medium',
  requiresManualReview: false }, drawing)!
const pen = (y = 30) => ({ tool: 'pen', color: '#202b38', width: 4,
  points: [{ x: 20, y }, { x: 100, y }] })
const input = (questionId = drawing.questionId, requestId = crypto.randomUUID(), id = attemptId) =>
  ({ requestId, feature: 'drawing_analysis', attemptId: id, questionId })
const http = (body: unknown) => new Request('https://example.test/ai-drawing', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})
function fakeBackend(options: { owner?: string; status?: string; revision?: string; quizId?: string;
  answer?: unknown; reservation?: string; provider?: DrawingBackend['provider'] } = {}) {
  const ledger = new Map<string, { state: string; response?: unknown }>()
  const provider = options.provider === undefined ? { generate: vi.fn().mockResolvedValue({
    response: analyzed, responseId: 'resp_fixture', usage,
  }) } : options.provider
  const backend: DrawingBackend = {
    userId, provider,
    loadAttempt: vi.fn(async (id) => ({ id, user_id: options.owner ?? userId,
      quiz_id: options.quizId ?? drawing.quizId, quiz_revision: options.revision ?? drawing.revision,
      status: options.status ?? 'submitted' })),
    loadAnswer: vi.fn(async () => options.answer === undefined ? { type: 'drawing', strokes: [pen()] } : options.answer),
    findRequest: vi.fn(async ({ requestId }) => ledger.get(requestId) ?? { state: 'missing' }),
    reserve: vi.fn(async ({ requestId }) => {
      if (ledger.has(requestId)) return ledger.get(requestId)!
      const state = options.reservation ?? 'created'
      if (state === 'created') ledger.set(requestId, { state: 'reserved' })
      return { state }
    }),
    complete: vi.fn(async (_owner, requestId, response) => { ledger.set(requestId, { state: 'completed', response }); return true }),
    refund: vi.fn(async (_owner, requestId) => { ledger.set(requestId, { state: 'refunded' }) }),
  }
  return { backend, provider, ledger }
}

describe('drawing analysis endpoint', () => {
  it('rejects every caller-supplied image or context field before ledger access', async () => {
    const { backend } = fakeBackend()
    for (const field of ['image', 'imageUrl', 'base64', 'PNG', 'strokes', 'question', 'reference',
      'solution', 'rubric', 'prompt', 'model', 'credits', 'detail', 'tools']) {
      expect((await createDrawingHandler(backend)(http({ ...input(), [field]: 'forged' }))).status).toBe(400)
    }
    expect(backend.loadAttempt).not.toHaveBeenCalled()
    expect(backend.findRequest).not.toHaveBeenCalled()
  })
  it('checks owner, submission, revision, type, blank content and payload limits before reservation', async () => {
    const erased = [pen(), { ...pen(), tool: 'eraser', width: 12 }]
    const cases = [
      [{ owner: crypto.randomUUID() }, input(), 404],
      [{ status: 'draft' }, input(), 409],
      [{ revision: 'missing' }, input(), 409],
      [{}, input('missing'), 404],
      [{ quizId: calculation.quizId, revision: calculation.revision }, input(calculation.questionId), 409],
      [{ quizId: objective.quizId, revision: objective.revision }, input(objective.questionId), 409],
      [{ answer: { type: 'drawing', strokes: [] } }, input(), 409],
      [{ answer: { type: 'drawing', strokes: erased } }, input(), 409],
      [{ answer: { type: 'drawing', strokes: Array.from({ length: 257 }, () => pen()) } }, input(), 413],
    ] as const
    for (const [options, request, expected] of cases) {
      const { backend, provider } = fakeBackend(options)
      expect((await createDrawingHandler(backend)(http(request))).status).toBe(expected)
      expect(backend.reserve).not.toHaveBeenCalled()
      expect(provider?.generate).not.toHaveBeenCalled()
    }
  })
  it('rasterizes stored strokes, replays an id, and charges a new explicit regeneration', async () => {
    const { backend, provider } = fakeBackend()
    const request = input()
    const first = await createDrawingHandler(backend)(http(request))
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ response: { outcome: 'analyzed', overallScore: 4 }, cached: false })
    expect(backend.loadAnswer).toHaveBeenCalledWith(attemptId, drawing.questionId)
    expect(backend.findRequest).toHaveBeenCalledWith(expect.objectContaining({ feature: 'drawing_analysis',
      model: 'gpt-6-luna', reasoningEffort: 'medium' }))
    const png = (provider!.generate as ReturnType<typeof vi.fn>).mock.calls[0][1] as Uint8Array
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(Object.keys(backend)).not.toContain('saveAttempt')
    const replay = await createDrawingHandler(backend)(http(request))
    expect(await replay.json()).toMatchObject({ cached: true })
    expect(backend.reserve).toHaveBeenCalledTimes(1)
    expect(provider?.generate).toHaveBeenCalledTimes(1)
    expect((await createDrawingHandler(backend)(http(input()))).status).toBe(200)
    expect(provider?.generate).toHaveBeenCalledTimes(2)
  })
  it('does not share a raster between distinct submitted attempts', async () => {
    const a = crypto.randomUUID(); const b = crypto.randomUUID()
    const { backend, provider } = fakeBackend()
    backend.loadAnswer = vi.fn(async (id) => ({ type: 'drawing', strokes: [pen(id === a ? 30 : 60)] }))
    expect((await createDrawingHandler(backend)(http(input(drawing.questionId, crypto.randomUUID(), a)))).status).toBe(200)
    expect((await createDrawingHandler(backend)(http(input(drawing.questionId, crypto.randomUUID(), b)))).status).toBe(200)
    const calls = (provider!.generate as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0][1]).not.toEqual(calls[1][1])
    expect(backend.loadAnswer).toHaveBeenNthCalledWith(1, a, drawing.questionId)
    expect(backend.loadAnswer).toHaveBeenNthCalledWith(2, b, drawing.questionId)
  })
  it('refunds malformed provider output and never persists a fabricated score', async () => {
    const provider = { generate: vi.fn().mockResolvedValue({ response: { ...analyzed, overallScore: 100 },
      responseId: 'bad', usage }) }
    const { backend } = fakeBackend({ provider })
    expect((await createDrawingHandler(backend)(http(input()))).status).toBe(503)
    expect(backend.complete).not.toHaveBeenCalled()
    expect(backend.refund).toHaveBeenCalledOnce()
  })
})
