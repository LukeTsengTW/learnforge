import { describe, expect, it, vi } from 'vitest'
import { createQuotaHandler } from '../../../supabase/functions/ai-quota/handler'

const quota = { limit: 20, used: 3, remaining: 17, windowSeconds: 18000,
  nextCreditAt: '2026-09-25T13:00:00Z',
  featureCosts: { hint: 1, explain_mistake: 1, explain_solution: 2 } }

describe('AI quota endpoint', () => {
  it('projects only safe quota fields from the privileged result', async () => {
    const status = vi.fn().mockResolvedValue({ ...quota, secret: 'must not reach browser' })
    const response = await createQuotaHandler({ status })(new Request('https://example.test/ai-quota'))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual(quota)
    expect(status).toHaveBeenCalledOnce()
  })

  it('does not query quota for unsupported methods or expose backend errors', async () => {
    const status = vi.fn().mockRejectedValue(new Error('private backend details'))
    const handler = createQuotaHandler({ status })
    expect((await handler(new Request('https://example.test/ai-quota', { method: 'POST' }))).status).toBe(405)
    expect(status).not.toHaveBeenCalled()
    const response = await handler(new Request('https://example.test/ai-quota'))
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('private backend details')
  })
})
