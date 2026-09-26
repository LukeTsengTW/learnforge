import { describe, expect, it, vi } from 'vitest'
import { createAiUsageHandler, type UsagePageRow } from '../../../supabase/functions/ai-usage/handler'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const window = { requestCount: 2, completedCount: 1, refundedCount: 1, expiredCount: 0,
  hintCount: 1, mistakeCount: 0, solutionCount: 0, calculationGradingCount: 0, drawingAnalysisCount: 0, inputTokens: 10,
  cachedInputTokens: 2, outputTokens: 5, reasoningTokens: 1, usageReportedCount: 1 }
const summary = { last5Hours: window, last24Hours: window, allTime: window }
const row = (n: number): UsagePageRow => ({ id: id(n), created_at: '2026-09-25T12:00:00Z',
  quiz_id: 'demo', quiz_revision: 'v1', question_id: `q${n}`, feature: 'hint', credits: 1, status: 'completed' })

describe('AI usage read endpoint', () => {
  it('projects 20 entries and uses the last displayed (created_at,id) as cursor', async () => {
    const backend = { summary: vi.fn().mockResolvedValue(summary), page: vi.fn().mockResolvedValue(Array.from({ length: 21 }, (_, i) => row(21 - i))) }
    const response = await createAiUsageHandler(backend)(new Request('https://example.test/ai-usage'))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(20)
    expect(body.items[0].questionId).toBe('q21')
    expect(body.items[19].questionId).toBe('q2')
    expect(body.items[0]).not.toHaveProperty('id')
    expect(body.nextCursor).toEqual({ createdAt: '2026-09-25T12:00:00Z', id: id(2) })
    expect(body.summary.last5Hours.inputTokens).toBe(10)
    expect(backend.page).toHaveBeenCalledWith(null)
  })

  it('passes a stable cursor and rejects malformed cursor pairs before any query', async () => {
    const backend = { summary: vi.fn().mockResolvedValue(summary), page: vi.fn().mockResolvedValue([row(1)]) }
    const handler = createAiUsageHandler(backend)
    const invalid = await handler(new Request('https://example.test/ai-usage?cursorAt=2026-09-25'))
    expect(invalid.status).toBe(400)
    expect(backend.summary).not.toHaveBeenCalled()
    const response = await handler(new Request(`https://example.test/ai-usage?cursorAt=2026-09-25T12%3A00%3A00Z&cursorId=${id(2)}`))
    expect(response.status).toBe(200)
    expect(backend.page).toHaveBeenCalledWith({ createdAt: '2026-09-25T12:00:00Z', id: id(2) })
    expect((await response.json()).nextCursor).toBeNull()
  })

  it('projects only user-facing fields and hides server errors', async () => {
    const backend = { summary: vi.fn().mockResolvedValue(summary), page: vi.fn().mockResolvedValue([{ ...row(1), provider_response_id: 'private' }]) }
    const handler = createAiUsageHandler(backend)
    const response = await handler(new Request('https://example.test/ai-usage?userId=foreign'))
    expect(JSON.stringify(await response.json())).not.toContain('provider_response_id')
    backend.page.mockRejectedValueOnce(new Error('private database error'))
    const failed = await handler(new Request('https://example.test/ai-usage'))
    expect(failed.status).toBe(503)
    expect(JSON.stringify(await failed.json())).not.toContain('private database error')
  })
  it('includes calculation grading as a two-credit audit item without a score', async () => {
    const backend = { summary: vi.fn().mockResolvedValue({ last5Hours: { ...window, calculationGradingCount: 1 },
      last24Hours: { ...window, calculationGradingCount: 1 }, allTime: { ...window, calculationGradingCount: 1 } }),
    page: vi.fn().mockResolvedValue([{ ...row(1), feature: 'calculation_grading', credits: 2,
      response: { overallScore: 6 } }]) }
    const body = await (await createAiUsageHandler(backend)(new Request('https://example.test/ai-usage'))).json()
    expect(body.summary.last5Hours.calculationGradingCount).toBe(1)
    expect(body.items[0]).toMatchObject({ feature: 'calculation_grading', credits: 2 })
    expect(JSON.stringify(body.items)).not.toContain('overallScore')
  })
  it('includes drawing analysis as a four-credit audit item without an image or score', async () => {
    const backend = { summary: vi.fn().mockResolvedValue({ last5Hours: { ...window, drawingAnalysisCount: 1 },
      last24Hours: { ...window, drawingAnalysisCount: 1 }, allTime: { ...window, drawingAnalysisCount: 1 } }),
    page: vi.fn().mockResolvedValue([{ ...row(1), feature: 'drawing_analysis', credits: 4,
      response: { overallScore: 4 }, image: 'private' }]) }
    const body = await (await createAiUsageHandler(backend)(new Request('https://example.test/ai-usage'))).json()
    expect(body.summary.last5Hours.drawingAnalysisCount).toBe(1)
    expect(body.items[0]).toMatchObject({ feature: 'drawing_analysis', credits: 4 })
    expect(JSON.stringify(body.items)).not.toMatch(/overallScore|private/)
  })
})
