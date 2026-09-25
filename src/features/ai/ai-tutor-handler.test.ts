import { describe, expect, it, vi } from 'vitest'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { createTutorHandler, type TutorBackend } from '../../../supabase/functions/ai-tutor/handler'
import type { TutorQuestionContext, TutorProviderResult } from '../../../supabase/functions/_shared/ai-tutor'

const contexts = AI_QUIZ_CONTEXT as unknown as TutorQuestionContext[]
const single = contexts.find((item) => item.type === 'single')!
const drawing = contexts.find((item) => item.type === 'drawing')!
const wrongOption = single.options!.find((option) => option.id !== single.correctOptionId)!.id
const userId = crypto.randomUUID()
const attemptId = crypto.randomUUID()
const output = { title: '再想一步', message: '先整理題目給定的條件。', keyPoints: [], nextStep: null }
const usage = { inputTokens: 10, cachedInputTokens: 0, outputTokens: 20, reasoningTokens: 3 }
const success: TutorProviderResult = { kind: 'success', response: output, responseId: 'resp_fixture', usage }
const requestFor = (question = single, feature = 'hint', requestId = crypto.randomUUID()) => ({
  requestId, feature, attemptId, questionId: question.questionId,
})
const http = (body: unknown) => new Request('https://example.test/ai-tutor', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

function fakeBackend(options: { owner?: string; quizId?: string; revision?: string; status?: string; answer?: unknown;
  reservationState?: string; provider?: TutorBackend['provider'] } = {}) {
  const ledger = new Map<string, { state: string; response?: typeof output }>()
  const provider = options.provider === undefined ? { generate: vi.fn().mockResolvedValue(success) } : options.provider
  const backend: TutorBackend = {
    userId,
    provider,
    loadAttempt: vi.fn(async () => ({ id: attemptId, user_id: options.owner ?? userId,
      quiz_id: options.quizId ?? single.quizId, quiz_revision: options.revision ?? single.revision, status: options.status ?? 'draft' })),
    loadAnswer: vi.fn(async () => options.answer ?? null),
    findRequest: vi.fn(async ({ requestId }) => {
      const previous = ledger.get(requestId)
      return previous ? { state: previous.state, response: previous.response } : { state: 'missing' }
    }),
    reserve: vi.fn(async ({ requestId }) => {
      const previous = ledger.get(requestId)
      if (previous) return { state: previous.state, response: previous.response }
      const state = options.reservationState ?? 'created'
      if (state === 'created') ledger.set(requestId, { state: 'reserved' })
      return { state, credits: 1 }
    }),
    complete: vi.fn(async (_owner, requestId, response) => {
      ledger.set(requestId, { state: 'completed', response }); return true
    }),
    refund: vi.fn(async (_owner, requestId) => { ledger.set(requestId, { state: 'refunded' }) }),
  }
  return { backend, ledger, provider }
}

describe('authenticated Tutor handler', () => {
  it('rejects unknown fields and oversized bodies before backend access', async () => {
    const { backend } = fakeBackend()
    expect((await createTutorHandler(backend)(http({ ...requestFor(), model: 'gpt-6-astra' }))).status).toBe(400)
    expect((await createTutorHandler(backend)(http({ ...requestFor(), prompt: 'chat' }))).status).toBe(400)
    expect((await createTutorHandler(backend)(http({ ...requestFor(), padding: 'x'.repeat(5000) }))).status).toBe(413)
    expect(backend.loadAttempt).not.toHaveBeenCalled()
  })
  it('fails safely if the OpenAI secret is missing and spends no credit', async () => {
    const { backend } = fakeBackend({ provider: null })
    expect((await createTutorHandler(backend)(http(requestFor()))).status).toBe(503)
    expect(backend.reserve).not.toHaveBeenCalled()
  })
  it('checks owner, revision and question before quota or provider', async () => {
    for (const [options, status, question] of [
      [{ owner: crypto.randomUUID() }, 404, single],
      [{ revision: 'missing' }, 409, single],
      [{}, 404, { ...single, questionId: 'unknown' }],
      [{ quizId: drawing.quizId, revision: drawing.revision }, 422, drawing],
    ] as const) {
      const { backend, provider } = fakeBackend(options)
      expect((await createTutorHandler(backend)(http(requestFor(question)))).status).toBe(status)
      expect(backend.reserve).not.toHaveBeenCalled()
      expect(provider?.generate).not.toHaveBeenCalled()
    }
  })
  it('enforces draft and submitted feature rules and objective incorrect grade', async () => {
    const draft = fakeBackend({ answer: { type: 'single', optionId: wrongOption } })
    expect((await createTutorHandler(draft.backend)(http(requestFor(single, 'explain_mistake')))).status).toBe(409)
    const submitted = fakeBackend({ status: 'submitted', answer: { type: 'single', optionId: wrongOption } })
    expect((await createTutorHandler(submitted.backend)(http(requestFor(single, 'hint')))).status).toBe(409)
    expect((await createTutorHandler(submitted.backend)(http(requestFor(single, 'explain_mistake')))).status).toBe(200)
    const correct = fakeBackend({ status: 'submitted', answer: { type: 'single', optionId: single.correctOptionId } })
    expect((await createTutorHandler(correct.backend)(http(requestFor(single, 'explain_mistake')))).status).toBe(409)
  })
  it('stores completion and serves duplicate requestId without another provider call or charge', async () => {
    const { backend, provider } = fakeBackend()
    const input = requestFor()
    const first = await createTutorHandler(backend)(http(input))
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ response: output, cached: false })
    const second = await createTutorHandler(backend)(http(input))
    expect(second.status).toBe(200)
    expect(await second.json()).toMatchObject({ response: output, cached: true })
    expect(provider?.generate).toHaveBeenCalledTimes(1)
    expect(backend.complete).toHaveBeenCalledTimes(1)
    expect(backend.reserve).toHaveBeenCalledTimes(1)
  })
  it('returns a completed hint on retry after the attempt has been submitted', async () => {
    const options = { status: 'draft' }
    const { backend, provider } = fakeBackend(options)
    const input = requestFor()
    expect((await createTutorHandler(backend)(http(input))).status).toBe(200)
    options.status = 'submitted'
    expect((await createTutorHandler(backend)(http(input))).status).toBe(200)
    expect(provider?.generate).toHaveBeenCalledTimes(1)
  })
  it('returns retryable in-progress, terminal refunded and quota denial states', async () => {
    for (const [state, status] of [['reserved', 202], ['refunded', 409], ['expired', 409], ['denied', 429]] as const) {
      const { backend, provider } = fakeBackend({ reservationState: state })
      expect((await createTutorHandler(backend)(http(requestFor()))).status).toBe(status)
      expect(provider?.generate).not.toHaveBeenCalled()
    }
  })
  it('refunds malformed, incomplete and provider failures', async () => {
    for (const code of ['malformed', 'incomplete', 'rate_limited', 'timeout', 'provider_unavailable'] as const) {
      const backend = fakeBackend({ provider: { generate: vi.fn().mockRejectedValue(Object.assign(new Error(code), { code })) } })
      expect((await createTutorHandler(backend.backend)(http(requestFor()))).status).toBe(503)
      expect(backend.backend.refund).toHaveBeenCalledTimes(1)
      expect(backend.backend.complete).not.toHaveBeenCalled()
    }
  })
  it('charges safe refusal once and returns a fixed user-facing message', async () => {
    const { backend } = fakeBackend({ provider: { generate: vi.fn().mockResolvedValue({ ...success, kind: 'refusal', response: null }) } })
    const response = await createTutorHandler(backend)(http(requestFor()))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ response: { title: '暫時無法提供 AI 說明' } })
    expect(backend.complete).toHaveBeenCalledTimes(1)
    expect(backend.refund).not.toHaveBeenCalled()
  })
})
