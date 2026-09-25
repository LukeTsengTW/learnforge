import { describe, expect, it, vi } from 'vitest'
import { createAiResponsesHandler, type StoredAiRow } from '../../../supabase/functions/ai-responses/handler'

const attemptId = '11111111-1111-4111-8111-111111111111'
const output = { title: '提示', message: '先整理條件。', keyPoints: [], nextStep: null }
const row = (feature: string, questionId = 'q1'): StoredAiRow => ({
  question_id: questionId, feature, response: output, completed_at: '2026-09-25T10:00:00Z', pending: false,
})

describe('AI response read boundary', () => {
  it('checks owned attempt before reading ledger and gives the same 404 for unknown attempts', async () => {
    const loadResponses = vi.fn().mockResolvedValue([row('hint')])
    const handler = createAiResponsesHandler({ ownsAttempt: vi.fn().mockResolvedValue(false), loadResponses })
    const foreign = await handler(new Request(`https://example.test/ai-responses?attemptId=${attemptId}`))
    const invalid = await handler(new Request('https://example.test/ai-responses?attemptId=invalid'))
    expect(foreign.status).toBe(404)
    expect(await foreign.json()).toEqual(await invalid.json())
    expect(loadResponses).not.toHaveBeenCalled()
  })

  it('projects completed content by question and feature plus a content-free pending signal', async () => {
    const rows = [row('hint'), row('explain_mistake'), row('explain_solution', 'q2'),
      { ...row('hint', 'q3'), pending: true, response: null, completed_at: null },
      { ...row('hint', 'q4'), response: { ...output, provider_response_id: 'private' } }]
    const handler = createAiResponsesHandler({ ownsAttempt: vi.fn().mockResolvedValue(true),
      loadResponses: vi.fn().mockResolvedValue(rows) })
    const response = await handler(new Request(`https://example.test/ai-responses?attemptId=${attemptId}`))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body.responses).toEqual([
      { questionId: 'q1', feature: 'hint', response: output, completedAt: '2026-09-25T10:00:00Z' },
      { questionId: 'q1', feature: 'explain_mistake', response: output, completedAt: '2026-09-25T10:00:00Z' },
      { questionId: 'q2', feature: 'explain_solution', response: output, completedAt: '2026-09-25T10:00:00Z' },
    ])
    expect(body.pending).toEqual([{ questionId: 'q3', feature: 'hint' }])
    expect(JSON.stringify(body)).not.toContain('provider_response_id')
  })

  it('is read only and does not call a provider or quota reservation', async () => {
    const backend = { ownsAttempt: vi.fn().mockResolvedValue(true), loadResponses: vi.fn().mockResolvedValue([]) }
    const response = await createAiResponsesHandler(backend)(new Request(`https://example.test/ai-responses?attemptId=${attemptId}`))
    expect(response.status).toBe(200)
    expect(backend.loadResponses).toHaveBeenCalledWith(attemptId)
    expect(Object.keys(backend)).toEqual(['ownsAttempt', 'loadResponses'])
  })
})
