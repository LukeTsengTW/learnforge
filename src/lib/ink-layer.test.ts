// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DrawingStroke } from '../models/drawing'

/**
 * While a stroke is in progress the canvas is painted from an offscreen copy of the finished strokes
 * plus that stroke, so the work per pointer move does not grow with the drawing. These tests check
 * which drawing operations each canvas receives; that the result is pixel for pixel a full replay is
 * checked in real browsers by the browser gate.
 */
const config = { width: 800, height: 600 }
const pen = (y: number, width = 4): DrawingStroke => ({ tool: 'pen', color: '#202b38', width, points: [{ x: 10, y }, { x: 90, y }] })
const eraser = (y: number): DrawingStroke => ({ tool: 'eraser', color: '#202b38', width: 24, points: [{ x: 10, y }, { x: 90, y }] })

interface Recorder { ops: string[]; context: CanvasRenderingContext2D }
const labels = new WeakMap<HTMLCanvasElement, string>()
let recorders = new WeakMap<HTMLCanvasElement, Recorder>()
/** Canvases that were asked for a context, in order; the one the module creates itself is the offscreen copy. */
let asked: HTMLCanvasElement[] = []
let drawImage: 'works' | 'missing' | 'throws' = 'works'
function recorder(): Recorder {
  const ops: string[] = []
  const saved: string[] = []
  const context = { globalCompositeOperation: 'source-over', lineWidth: 1, strokeStyle: '', fillStyle: '', lineCap: 'butt', lineJoin: 'miter',
    save: () => { saved.push(context.globalCompositeOperation); ops.push('save') },
    restore: () => { context.globalCompositeOperation = saved.pop() ?? 'source-over'; ops.push('restore') },
    clearRect: () => { ops.push('clear') },
    beginPath: () => { ops.push('path') }, arc: () => { ops.push('arc') },
    moveTo: (x: number, y: number) => { ops.push(`M${x},${y}`) }, lineTo: (x: number, y: number) => { ops.push(`L${x},${y}`) },
    stroke: () => { ops.push(`stroke:${context.globalCompositeOperation}:${context.lineWidth}`) },
    fill: () => { ops.push(`fill:${context.globalCompositeOperation}`) },
    ...(drawImage === 'missing' ? {} : { drawImage: (source: HTMLCanvasElement) => {
      if (drawImage === 'throws') throw new DOMException('The image argument is a canvas element with a width or height of 0.', 'InvalidStateError')
      ops.push(`image:${labels.get(source) ?? 'offscreen'}`)
    } }) }
  return { ops, context: context as unknown as CanvasRenderingContext2D }
}
function canvasNamed(label: string) {
  const canvas = document.createElement('canvas')
  canvas.width = config.width; canvas.height = config.height
  labels.set(canvas, label)
  return canvas
}
const opsOf = (canvas: HTMLCanvasElement) => recorders.get(canvas)!.ops
const offscreen = () => asked.find((canvas) => !labels.has(canvas))
const replayOps = (strokes: DrawingStroke[]) => ['save', 'clear', ...strokes.flatMap((stroke) => ['path', `M10,${stroke.points[0].y}`, `L90,${stroke.points[0].y}`,
  `stroke:${stroke.tool === 'eraser' ? 'destination-out' : 'source-over'}:${stroke.width}`]), 'restore']
const overCopyOps = (stroke: DrawingStroke) => ['save', 'clear', 'image:offscreen', 'path', `M10,${stroke.points[0].y}`, `L90,${stroke.points[0].y}`,
  `stroke:${stroke.tool === 'eraser' ? 'destination-out' : 'source-over'}:${stroke.width}`, 'restore']

let drawing: typeof import('./drawing')
beforeEach(async () => {
  recorders = new WeakMap(); asked = []; drawImage = 'works'
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    let entry = recorders.get(this)
    if (!entry) { entry = recorder(); recorders.set(this, entry); asked.push(this) }
    return entry.context
  } as unknown as HTMLCanvasElement['getContext'])
  // The offscreen copy is module state: every test starts with a fresh module.
  vi.resetModules()
  drawing = await import('./drawing')
})
afterEach(() => vi.restoreAllMocks())

describe('painting a stroke in progress over a copy of the finished strokes', () => {
  it('replays the finished strokes once into the copy; every move then paints the copy and only the stroke in progress', () => {
    const visible = canvasNamed('visible'), context = visible.getContext('2d')!
    const strokes = [pen(100), eraser(200), pen(300, 12)]
    drawing.paintInProgress(context, visible, config, strokes, pen(400))
    expect(opsOf(offscreen()!)).toEqual(replayOps(strokes))
    expect(opsOf(visible)).toEqual(overCopyOps(pen(400)))
    // More moves of the same stroke: the copy is not touched again, the visible canvas repeats the same short sequence.
    for (let move = 0; move < 5; move++) drawing.paintInProgress(context, visible, config, strokes, pen(400 + move))
    expect(opsOf(offscreen()!)).toEqual(replayOps(strokes))
    expect(opsOf(visible)).toHaveLength(6 * overCopyOps(pen(400)).length)
    expect(opsOf(visible).slice(-8)).toEqual(overCopyOps(pen(404)))
    expect(drawing.holdsInkOf(visible)).toBe(true)
  })

  it('applies an eraser in progress to the copied ink, not as white paint', () => {
    const visible = canvasNamed('visible')
    drawing.paintInProgress(visible.getContext('2d')!, visible, config, [pen(100)], eraser(100))
    expect(opsOf(visible)).toEqual(overCopyOps(eraser(100)))
    expect(opsOf(visible)).toContain('stroke:destination-out:24')
  })

  it('starts the next stroke from the copy remembered when the canvas was last replayed', () => {
    const visible = canvasNamed('visible'), context = visible.getContext('2d')!
    const before = [pen(100)], after = [pen(100), pen(200)]
    drawing.paintInProgress(context, visible, config, before, pen(200))
    // The stroke is committed: the canvas is replayed in full (by the caller) and the copy is taken from it.
    drawing.replayDrawing(context, config, after)
    drawing.rememberInk(visible, config, after)
    expect(opsOf(offscreen()!).slice(-2)).toEqual(['clear', 'image:visible'])
    const copied = opsOf(offscreen()!).length
    drawing.paintInProgress(context, visible, config, after, pen(300))
    // No replay into the copy: it already holds the two finished strokes.
    expect(opsOf(offscreen()!)).toHaveLength(copied)
    expect(opsOf(visible).slice(-8)).toEqual(overCopyOps(pen(300)))
  })

  it('rebuilds the copy when the finished strokes are another array, another canvas is written on, or the size differs', () => {
    const first = canvasNamed('first'), second = canvasNamed('second')
    const strokes = [pen(100)]
    drawing.paintInProgress(first.getContext('2d')!, first, config, strokes, pen(200))
    const layer = offscreen()!
    expect(opsOf(layer)).toEqual(replayOps(strokes))
    // Same content, new array (an undo, or the owner handing back its own copy).
    const replaced = [pen(100)]
    drawing.paintInProgress(first.getContext('2d')!, first, config, replaced, pen(200))
    expect(opsOf(layer)).toEqual([...replayOps(strokes), ...replayOps(replaced)])
    // Another canvas with its own strokes.
    const other = [pen(300), pen(350)]
    drawing.paintInProgress(second.getContext('2d')!, second, config, other, pen(400))
    expect(opsOf(layer).slice(-replayOps(other).length)).toEqual(replayOps(other))
    expect(drawing.holdsInkOf(second)).toBe(true)
    expect(drawing.holdsInkOf(first)).toBe(false)
    // Another logical size: the copy is resized (which clears it) and replayed.
    const small = { width: 400, height: 300 }
    const count = opsOf(layer).length
    drawing.paintInProgress(second.getContext('2d')!, second, small, other, pen(100))
    expect([layer.width, layer.height]).toEqual([400, 300])
    expect(opsOf(layer).slice(count)).toEqual(replayOps(other))
  })

  it('uses a single offscreen canvas for every canvas on the page', () => {
    const canvases = Array.from({ length: 12 }, (_, index) => canvasNamed(`question-${index}`))
    for (const canvas of canvases) {
      drawing.paintInProgress(canvas.getContext('2d')!, canvas, config, [pen(100)], pen(200))
      drawing.rememberInk(canvas, config, [pen(100), pen(200)])
    }
    expect(asked.filter((canvas) => !labels.has(canvas))).toHaveLength(1)
  })
})

describe('without a usable copy the canvas is replayed in full, as before', () => {
  const strokes = [pen(100), eraser(200)]

  it('when the context cannot draw images', () => {
    drawImage = 'missing'
    const visible = canvasNamed('visible')
    drawing.paintInProgress(visible.getContext('2d')!, visible, config, strokes, pen(300))
    expect(opsOf(visible)).toEqual(replayOps([...strokes, pen(300)]))
    expect(offscreen()).toBeUndefined()
  })

  it('when no offscreen context is available', () => {
    const visible = canvasNamed('visible'), context = visible.getContext('2d')!
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(function (this: HTMLCanvasElement) {
      return this === visible ? context : null
    } as unknown as HTMLCanvasElement['getContext'])
    drawing.paintInProgress(context, visible, config, strokes, pen(300))
    expect(opsOf(visible)).toEqual(replayOps([...strokes, pen(300)]))
    drawing.rememberInk(visible, config, strokes)
    expect(drawing.holdsInkOf(visible)).toBe(false)
  })

  it('when every canvas hands out the same context', () => {
    const visible = canvasNamed('visible'), shared = recorder()
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(shared.context)
    drawing.paintInProgress(shared.context, visible, config, strokes, pen(300))
    expect(shared.ops).toEqual(replayOps([...strokes, pen(300)]))
    // Remembering must not draw the canvas onto itself either.
    drawing.rememberInk(visible, config, strokes)
    expect(shared.ops).toEqual(replayOps([...strokes, pen(300)]))
  })

  it('when copying fails: nothing is thrown, the canvas still ends up fully replayed and its state stack is balanced', () => {
    const visible = canvasNamed('visible')
    // Every context created from here on, the visible and the offscreen one, fails to draw an image.
    drawImage = 'throws'
    const failing = recorder()
    recorders.set(visible, failing)
    expect(() => drawing.paintInProgress(failing.context, visible, config, strokes, pen(300))).not.toThrow()
    expect(failing.ops.slice(-replayOps([...strokes, pen(300)]).length)).toEqual(replayOps([...strokes, pen(300)]))
    expect(failing.ops.filter((op) => op === 'save')).toHaveLength(failing.ops.filter((op) => op === 'restore').length)
    expect(() => drawing.rememberInk(visible, config, strokes)).not.toThrow()
    expect(drawing.holdsInkOf(visible)).toBe(false)
  })
})
