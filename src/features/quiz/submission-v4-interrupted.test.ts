import { describe, expect, it, vi } from 'vitest'
import { rasterizeStoredDrawing } from '../../../supabase/functions/_shared/drawing-raster'
import { calcHand, calcText, fixture, pen, submit } from './submission-v4.test-helper'

// The real rasterizer, counted: the handler imports it from this module.
vi.mock('../../../supabase/functions/_shared/drawing-raster', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../supabase/functions/_shared/drawing-raster')>()
  return { ...actual, rasterizeStoredDrawing: vi.fn(actual.rasterizeStoredDrawing) }
})

/**
 * A formal submission rasterizes and grades its handwritten questions one after another in a single
 * request. If that request is ended part-way (for example at the platform's CPU limit) nothing may be
 * lost or finalized: the attempt stays a draft, and a retry does only the work that was not finished.
 */
describe('ai-grading-v4 submission that is ended part-way', () => {
  it('stays a draft, waits while the unfinished question is still reserved, then finishes without redoing finished questions', async () => {
    const test = fixture({ q_text: calcText('2x = 4 so x = 2'), q_hand: calcHand([pen()]), q_draw: { type: 'drawing', strokes: [pen()] } })
    const rasters = vi.mocked(rasterizeStoredDrawing)
    rasters.mockClear()
    // An ended request runs no cleanup: the claim of the question it was working on stays reserved.
    const failRubric = vi.spyOn(test.backend, 'failRubric').mockImplementation(async () => undefined)
    const claim = vi.mocked(test.backend.v4!.claimRubric)
    const original = claim.getMockImplementation()!
    const reserved = () => new Set([...test.state.pending.values()].map((key) => key.split(':')[1]))
    claim.mockImplementation(async (input) => reserved().has(input.questionId) ? { state: 'in_progress' } : original(input))
    // The request ends while the last handwritten question is with the provider.
    test.drawingProvider.generate.mockImplementationOnce(() => { throw new Error('request ended') })

    const first = await test.submit(submit())
    expect(first.status).toBe(503)
    expect(test.state.attempt.status).toBe('draft')
    expect(test.backend.v4!.finalize).not.toHaveBeenCalled()
    // Two questions were finished and kept; the third is still reserved.
    expect([...test.state.cache.keys()].map((key) => key.split(':')[1]).sort()).toEqual(['q_hand', 'q_text'])
    expect([...reserved()]).toEqual(['q_draw'])
    expect(rasters).toHaveBeenCalledTimes(2)
    expect(test.calculationV4.generateText).toHaveBeenCalledTimes(1)
    expect(test.calculationV4.generateDrawing).toHaveBeenCalledTimes(1)

    // A retry while the reservation is held does no raster or provider work and submits nothing.
    const second = await test.submit(submit())
    expect(second.status).toBe(202)
    expect(test.state.attempt.status).toBe('draft')
    expect(rasters).toHaveBeenCalledTimes(2)
    expect(test.calculationV4.generateText).toHaveBeenCalledTimes(1)
    expect(test.calculationV4.generateDrawing).toHaveBeenCalledTimes(1)
    expect(test.drawingProvider.generate).toHaveBeenCalledTimes(1)

    // The reservation expires (90 seconds in the database): the retry rasterizes and grades only the unfinished question.
    test.state.pending.clear()
    const third = await test.submit(submit())
    expect(third.status).toBe(200)
    expect(test.state.attempt.status).toBe('submitted')
    expect(rasters).toHaveBeenCalledTimes(3)
    expect(test.calculationV4.generateText).toHaveBeenCalledTimes(1)
    expect(test.calculationV4.generateDrawing).toHaveBeenCalledTimes(1)
    expect(test.drawingProvider.generate).toHaveBeenCalledTimes(2)
    expect(test.backend.v4!.finalize).toHaveBeenCalledTimes(1)
    expect(test.state.finalRubric.map((judgment) => judgment.question_id).sort()).toEqual(['q_draw', 'q_hand', 'q_text'])
    failRubric.mockRestore()
  })
})
