import { describe, expect, it } from 'vitest'
import { drawingReducer, toLogicalPoint } from './drawing'
import type { DrawingHistory, DrawingStroke } from '../models/drawing'

const config = { width: 800, height: 600 }
const stroke: DrawingStroke = { tool: 'pen', color: '#202b38', width: 4, points: [{ x: 100, y: 100 }, { x: 300, y: 200 }] }
describe('logical drawing coordinates', () => {
  it.each([320, 360, 768, 1000])('maps the center at CSS width %i to the same logical point', (width) => {
    const height = width * 600 / 800
    expect(toLogicalPoint(20 + width / 2, 50 + height / 2, { left: 20, top: 50, width, height }, config)).toEqual({ x: 400, y: 300 })
  })
  it('clamps captured pointers outside the canvas', () => {
    expect(toLogicalPoint(-100, 999, { left: 0, top: 0, width: 400, height: 300 }, config)).toEqual({ x: 0, y: 600 })
  })
  it('rejects zero-sized canvases', () => {
    expect(() => toLogicalPoint(1, 1, { left: 0, top: 0, width: 0, height: 0 }, config)).toThrow(RangeError)
  })
})
describe('stroke history', () => {
  const empty: DrawingHistory = { strokes: [], undone: [] }
  it('supports add, undo, redo and clear without changing old state', () => {
    const drawn = drawingReducer(empty, { type: 'add', stroke })
    const undone = drawingReducer(drawn, { type: 'undo' })
    expect(drawn.strokes).toEqual([stroke])
    expect(empty.strokes).toEqual([])
    expect(undone.strokes).toEqual([])
    const redone = drawingReducer(undone, { type: 'redo' })
    expect(redone.strokes).toEqual([stroke])
    expect(drawingReducer(redone, { type: 'clear' })).toEqual(empty)
  })
  it('clears redo history on new strokes and clones stroke points', () => {
    const editable = structuredClone(stroke)
    const drawn = drawingReducer(empty, { type: 'add', stroke: editable })
    editable.points[0].x = 999
    expect(drawn.strokes[0].points[0].x).toBe(100)
    const changed = drawingReducer(drawingReducer(drawn, { type: 'undo' }), { type: 'add', stroke: { ...stroke, tool: 'eraser' } })
    expect(changed.undone).toEqual([])
    expect(changed.strokes[0].tool).toBe('eraser')
    expect(drawingReducer(changed, { type: 'redo' })).toBe(changed)
  })
  it('ignores empty strokes and empty undo/redo', () => {
    expect(drawingReducer(empty, { type: 'add', stroke: { ...stroke, points: [] } })).toBe(empty)
    expect(drawingReducer(empty, { type: 'undo' })).toBe(empty)
    expect(drawingReducer(empty, { type: 'redo' })).toBe(empty)
  })
})
