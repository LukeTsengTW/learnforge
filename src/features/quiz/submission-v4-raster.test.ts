import { describe, expect, it, vi } from 'vitest'
import { DrawingRasterError, rasterizeStoredDrawing } from '../../../supabase/functions/_shared/drawing-raster'
import { calcHand, calcText, fixture, pen, submit } from './submission-v4.test-helper'

vi.mock('../../../supabase/functions/_shared/drawing-raster', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../supabase/functions/_shared/drawing-raster')>()
  return { ...actual, rasterizeStoredDrawing: vi.fn(actual.rasterizeStoredDrawing) }
})
const raster = vi.mocked(rasterizeStoredDrawing)

describe('ai-grading-v4 server raster authority', () => {
  it.each([
    ['oversized raster', new DrawingRasterError('oversized'), 'q_hand:raster_oversized'],
    ['invalid raster', new DrawingRasterError('invalid'), 'q_hand:raster_invalid'],
    ['encoder failure', new Error('CompressionStream failed'), 'q_hand:raster_failed'],
  ])('%s after reservation fails the claim and never becomes a zero score', async (_label, error, code) => {
    const test = fixture({ q_hand: calcHand([pen()]), q_draw: { type: 'drawing', strokes: [pen()] } })
    raster.mockRejectedValueOnce(error)
    const response = await test.submit(submit())
    expect(response.status).toBe(503)
    expect(test.state.failures).toEqual([code])
    expect(test.state.attempt.status).toBe('draft')
    expect(test.state.finalRubric).toEqual([])
    expect(test.backend.v4!.finalize).not.toHaveBeenCalled()
    expect(test.calculationV4.generateDrawing).not.toHaveBeenCalled()
    // Retryable: the next submission reserves again and grades normally.
    expect((await test.submit(submit())).status).toBe(200)
    expect(test.calculationV4.generateDrawing).toHaveBeenCalledTimes(1)
  })

  it('reserves before rasterizing and rasterizes only the active drawing buffer on the server', async () => {
    const test = fixture({ q_hand: calcHand([pen()]), q_text: calcText('x = 2') })
    raster.mockClear()
    expect((await test.submit(submit())).status).toBe(200)
    const handCall = raster.mock.calls.findIndex(([, config]) => config.width === 800)
    expect(handCall).toBeGreaterThanOrEqual(0)
    expect(raster.mock.calls[handCall][0]).toEqual({ type: 'drawing', strokes: [pen()] })
    const claimOrder = vi.mocked(test.backend.v4!.claimRubric).mock.invocationCallOrder[
      test.state.claims.findIndex((item) => item.questionId === 'q_hand')]
    expect(claimOrder).toBeLessThan(raster.mock.invocationCallOrder[handCall])
  })

  it('never rasterizes a text-mode calculation, even with retained inactive strokes', async () => {
    const test = fixture({ q_hand: calcText('x = 3', [pen()]), q_draw: { type: 'drawing', strokes: [pen()] } })
    raster.mockClear()
    expect((await test.submit(submit())).status).toBe(200)
    expect(raster.mock.calls.every(([, config]) => config.width === 400)).toBe(true)
    expect(raster).toHaveBeenCalledTimes(1)
  })
})
