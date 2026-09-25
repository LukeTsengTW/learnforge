import { describe, expect, it, vi } from 'vitest'
import type { AppSupabase } from '../../lib/supabase'
import { SupabaseTutorService, TutorServiceError } from './tutor-service'

const input = { requestId: crypto.randomUUID(), attemptId: crypto.randomUUID(), questionId: 'q1', feature: 'hint' as const }

function serviceFor(error: unknown) {
  const invoke = vi.fn().mockResolvedValue({ data: null, error })
  return { service: new SupabaseTutorService({ functions: { invoke } } as unknown as AppSupabase), invoke }
}

describe('Tutor client error handling', () => {
  it('keeps the same request ID eligible for retry after an ambiguous provider or HTTP failure', async () => {
    for (const [failure, code] of [
      [{ context: Response.json({ code: 'service_unavailable' }, { status: 503 }) }, 'service_unavailable'],
      [{ context: new Response('Bad gateway', { status: 502 }) }, 'unavailable'],
    ] as const) {
      const { service, invoke } = serviceFor(failure)
      await expect(service.request(input)).rejects.toMatchObject({ code, definitive: false })
      expect(invoke).toHaveBeenCalledWith('ai-tutor', expect.objectContaining({ body: input }))
    }
  })

  it('marks a terminal quota denial as a new-action decision', async () => {
    const { service } = serviceFor({ context: Response.json({ code: 'quota_exhausted' }, { status: 429 }) })
    await expect(service.request(input)).rejects.toEqual(expect.objectContaining({ code: 'quota_exhausted', definitive: true }))
  })

  it('treats a transport failure as retryable', async () => {
    const { service } = serviceFor(new Error('network disconnected'))
    await expect(service.request(input)).rejects.toBeInstanceOf(TutorServiceError)
    await expect(service.request(input)).rejects.toMatchObject({ code: 'network', definitive: false })
  })
  it('routes grading to its dedicated endpoint with the four-field request', async () => {
    const grading = { kind: 'calculation_grading', outcome: 'refusal', message: 'AI 無法提供此題的參考評分。' }
    const invoke = vi.fn().mockResolvedValue({ data: { response: grading }, error: null })
    const service = new SupabaseTutorService({ functions: { invoke } } as unknown as AppSupabase)
    const request = { requestId: crypto.randomUUID(), feature: 'calculation_grading' as const,
      attemptId: crypto.randomUUID(), questionId: 'q6' }
    expect(await service.requestGrading(request)).toEqual(grading)
    expect(invoke).toHaveBeenCalledWith('ai-grade', expect.objectContaining({ body: request }))
  })
})
