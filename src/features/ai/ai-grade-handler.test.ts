import { describe, expect, it, vi } from 'vitest'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import type { TutorQuestionContext } from '../../../supabase/functions/_shared/ai-tutor'
import { validateGradingResult } from '../../../supabase/functions/_shared/calculation-grading'
import { createGradingHandler, type GradingBackend } from '../../../supabase/functions/ai-grade/handler'

const contexts = AI_QUIZ_CONTEXT as unknown as TutorQuestionContext[]
const calculation = contexts.find((item) => item.type === 'calculation')!
const objective = contexts.find((item) => item.type === 'single')!
const drawing = contexts.find((item) => item.type === 'drawing')!
const userId = crypto.randomUUID()
const attemptId = crypto.randomUUID()
const usage = { inputTokens: 100, cachedInputTokens: 5, outputTokens: 200, reasoningTokens: 40 }
const score = validateGradingResult({ overallScore: 3.5, maxScore: 6,
  criteria: [
    { criterionId: 'r1', awardedScore: 2, maxScore: 2, status: 'full', feedback: '因式分解正確。' },
    { criterionId: 'r2', awardedScore: 1.5, maxScore: 2, status: 'partial', feedback: '一個根正確。' },
    { criterionId: 'r3', awardedScore: 0, maxScore: 2, status: 'none', feedback: '未代回。' },
  ], summary: '推導部分正確。', strengths: [], improvements: [], confidence: 'medium',
  requiresManualReview: false }, calculation)!
const input = (questionId = calculation.questionId, requestId = crypto.randomUUID()) => ({
  requestId, feature: 'calculation_grading', attemptId, questionId,
})
const http = (body: unknown) => new Request('https://example.test/ai-grade', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})
function fakeBackend(options: { owner?: string; status?: string; revision?: string; quizId?: string;
  answer?: unknown; reservation?: string; provider?: GradingBackend['provider'] } = {}) {
  const ledger = new Map<string, { state: string; response?: unknown }>()
  const provider = options.provider === undefined ? { generate: vi.fn().mockResolvedValue({
    response: score, responseId: 'resp_fixture', usage,
  }) } : options.provider
  const backend: GradingBackend = {
    userId, provider,
    loadAttempt: vi.fn(async () => ({ id: attemptId, user_id: options.owner ?? userId,
      quiz_id: options.quizId ?? calculation.quizId, quiz_revision: options.revision ?? calculation.revision,
      status: options.status ?? 'submitted' })),
    loadAnswer: vi.fn(async () => options.answer === undefined ? { type: 'calculation', text: 'x=3; x=1/2' } : options.answer),
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

describe('calculation grading handler', () => {
  it('rejects caller-provided grading data and never touches ledger', async () => {
    const { backend } = fakeBackend()
    for (const field of ['studentAnswer', 'rubric', 'referenceAnswer', 'solution', 'prompt', 'model', 'credits']) {
      expect((await createGradingHandler(backend)(http({ ...input(), [field]: 'forged' }))).status).toBe(400)
    }
    expect(backend.findRequest).not.toHaveBeenCalled()
  })
  it('checks owner, submission, revision, type, and answer before reservation', async () => {
    const cases = [
      [{ owner: crypto.randomUUID() }, input(), 404],
      [{ status: 'draft' }, input(), 409],
      [{ revision: 'unknown' }, input(), 409],
      [{}, input('unknown'), 404],
      [{ quizId: objective.quizId, revision: objective.revision }, input(objective.questionId), 409],
      [{ quizId: drawing.quizId, revision: drawing.revision }, input(drawing.questionId), 409],
      [{ answer: { type: 'calculation', text: '  ' } }, input(), 409],
      [{ answer: { type: 'calculation', text: '漢'.repeat(3000) } }, input(), 413],
    ] as const
    for (const [options, request, expected] of cases) {
      const { backend, provider } = fakeBackend(options)
      expect((await createGradingHandler(backend)(http(request))).status).toBe(expected)
      expect(backend.reserve).not.toHaveBeenCalled()
      expect(provider?.generate).not.toHaveBeenCalled()
    }
  })
  it('accepts a different valid derivation without string equality checks and leaves the attempt untouched', async () => {
    const answer = { type: 'calculation', text: 'Using the quadratic formula: x=(7±5)/4, so x=3 or x=1/2.' }
    const { backend, provider } = fakeBackend({ answer })
    const request = input()
    const first = await createGradingHandler(backend)(http(request))
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ response: { outcome: 'graded', overallScore: 3.5 }, cached: false })
    expect(provider?.generate).toHaveBeenCalledWith(calculation, answer.text)
    expect(backend.loadAttempt).toHaveBeenCalled()
    expect(Object.keys(backend)).not.toContain('saveAttempt')
    expect(backend.findRequest).toHaveBeenCalledWith(expect.objectContaining({ feature: 'calculation_grading',
      model: 'gpt-6-luna', reasoningEffort: 'medium' }))
    const replay = await createGradingHandler(backend)(http(request))
    expect(await replay.json()).toMatchObject({ cached: true })
    expect(backend.reserve).toHaveBeenCalledTimes(1)
    expect(provider?.generate).toHaveBeenCalledTimes(1)
    const regenerated = await createGradingHandler(backend)(http(input()))
    expect(regenerated.status).toBe(200)
    expect(backend.reserve).toHaveBeenCalledTimes(2)
    expect(provider?.generate).toHaveBeenCalledTimes(2)
  })
  it('refunds on malformed provider result or persistence failure; never fabricates a score', async () => {
    for (const provider of [
      { generate: vi.fn().mockResolvedValue({ response: { ...score, overallScore: 6 }, responseId: 'bad', usage }) },
      { generate: vi.fn().mockRejectedValue(new Error('network')) },
    ]) {
      const { backend } = fakeBackend({ provider })
      expect((await createGradingHandler(backend)(http(input()))).status).toBe(503)
      expect(backend.complete).not.toHaveBeenCalled()
      expect(backend.refund).toHaveBeenCalledOnce()
    }
    const { backend } = fakeBackend()
    backend.complete = vi.fn().mockResolvedValue(false)
    expect((await createGradingHandler(backend)(http(input()))).status).toBe(503)
    expect(backend.refund).toHaveBeenCalledOnce()
  })
  it('does not reserve when the quota RPC denies two credits', async () => {
    const { backend, provider } = fakeBackend({ reservation: 'denied' })
    expect((await createGradingHandler(backend)(http(input()))).status).toBe(429)
    expect(provider?.generate).not.toHaveBeenCalled()
  })
})
