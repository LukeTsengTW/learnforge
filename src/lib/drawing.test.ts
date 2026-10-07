// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { drawingReducer, exportDrawingPng, replayDrawing, toLogicalPoint } from './drawing'
import type { DrawingHistory, DrawingStroke } from '../models/drawing'

const config = { width: 800, height: 600 }
const stroke: DrawingStroke = { tool: 'pen', color: '#202b38', width: 4, points: [{ x: 100, y: 100 }, { x: 300, y: 200 }] }
afterEach(() => vi.restoreAllMocks())
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

function recordingContext() {
  const fills: { operation: string; color: string }[] = []
  const calls = {
    save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillRect: vi.fn(),
    globalCompositeOperation: 'source-over', fillStyle: '', strokeStyle: '', lineWidth: 0,
    fill: vi.fn(() => { fills.push({ operation: calls.globalCompositeOperation, color: calls.fillStyle }) }),
  }
  return { context: calls as unknown as CanvasRenderingContext2D, calls, fills }
}
const stationary = (count: number, tool: DrawingStroke['tool'] = 'pen'): DrawingStroke => ({
  ...stroke, tool, color: '#c03535', width: 12,
  points: Array.from({ length: count }, () => ({ x: 20, y: 40 })),
})

describe('stationary stroke replay', () => {
  it.each([1, 2, 5])('renders %i identical pen points as one filled dot without changing stored points', count => {
    const { context, calls, fills } = recordingContext(), ink = stationary(count)
    const original = structuredClone(ink)
    replayDrawing(context, config, [ink])
    expect(calls.arc).toHaveBeenCalledExactlyOnceWith(20, 40, 6, 0, Math.PI * 2)
    expect(calls.fill).toHaveBeenCalledTimes(1)
    expect(fills).toEqual([{ operation: 'source-over', color: '#c03535' }])
    expect(calls.stroke).not.toHaveBeenCalled()
    expect(calls.lineTo).not.toHaveBeenCalled()
    expect(ink).toEqual(original)
  })

  it.each([2, 5])('erases one circular dot for %i identical eraser points', count => {
    const { context, calls, fills } = recordingContext()
    replayDrawing(context, config, [stationary(count, 'eraser')])
    expect(calls.arc).toHaveBeenCalledExactlyOnceWith(20, 40, 6, 0, Math.PI * 2)
    expect(fills).toEqual([{ operation: 'destination-out', color: '#c03535' }])
    expect(calls.stroke).not.toHaveBeenCalled()
  })

  it.each([
    [{ x: 20, y: 40 }, { x: 30, y: 40 }],
    [{ x: 20, y: 40 }, { x: 20, y: 50 }],
    [{ x: 20, y: 40 }, { x: 30, y: 50 }, { x: 20, y: 40 }],
  ])('retains the line path for displacement, including a return to the start: %j', (...points) => {
    const { context, calls } = recordingContext()
    replayDrawing(context, config, [{ ...stationary(1), points }])
    expect(calls.moveTo).toHaveBeenCalledExactlyOnceWith(20, 40)
    expect(calls.lineTo.mock.calls).toEqual(points.slice(1).map(p => [p.x, p.y]))
    expect(calls.stroke).toHaveBeenCalledTimes(1)
    expect(calls.strokeStyle).toBe('#c03535')
    expect(calls.lineWidth).toBe(12)
    expect(calls.arc).not.toHaveBeenCalled()
    expect(calls.fill).not.toHaveBeenCalled()
  })

  it('still skips empty strokes', () => {
    const { context, calls } = recordingContext()
    replayDrawing(context, config, [{ ...stroke, points: [] }])
    expect(calls.clearRect).toHaveBeenCalledExactlyOnceWith(0, 0, 800, 600)
    expect(calls.beginPath).not.toHaveBeenCalled()
  })

  it('exports persisted repeated-point pen and eraser dots through the shared replay semantics', async () => {
    const { context, calls, fills } = recordingContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
    const blob = new Blob(['export fixture'], { type: 'image/png' })
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(blob))
    expect(await exportDrawingPng(config, [stationary(2), stationary(5, 'eraser')])).toBe(blob)
    expect(calls.arc.mock.calls).toEqual([[20, 40, 6, 0, Math.PI * 2], [20, 40, 6, 0, Math.PI * 2]])
    expect(fills).toEqual([
      { operation: 'source-over', color: '#c03535' },
      { operation: 'destination-out', color: '#c03535' },
    ])
    expect(calls.stroke).not.toHaveBeenCalled()
    expect(calls.globalCompositeOperation).toBe('destination-over')
    expect(calls.fillStyle).toBe('#ffffff')
    expect(calls.fillRect).toHaveBeenCalledExactlyOnceWith(0, 0, 800, 600)
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
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
