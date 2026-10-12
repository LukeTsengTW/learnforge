// @vitest-environment jsdom
import { createRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { DrawingPoint, DrawingStroke } from '../../models/drawing'
import { STROKE_SAMPLE_MAX_SEGMENT, STROKE_SAMPLE_TOLERANCE } from '../../lib/stroke-sampling'
import { DrawingCanvas, type DrawingCanvasHandle } from './DrawingCanvas'

/**
 * Dense pointer sampling is reduced while the stroke is drawn. What the canvas paints is always the
 * stroke that a commit would store at that moment, so the reduction never makes the visible ink and
 * the answer differ.
 */
const config = { width: 800, height: 600 }
/** Polylines of the most recent paint, one per stroke, as the 2D context received them. */
let paintedPaths: DrawingPoint[][] = []
beforeEach(() => {
  localStorage.clear()
  paintedPaths = []
  const noop = () => undefined
  const plot = (x: number, y: number) => { paintedPaths.at(-1)!.push({ x, y }) }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ save: noop, restore: noop,
    clearRect: () => { paintedPaths = [] }, beginPath: () => { paintedPaths.push([]) }, arc: noop, fill: noop,
    moveTo: plot, lineTo: plot, stroke: noop } as unknown as CanvasRenderingContext2D)
  // The display rect equals the logical size, so client coordinates are logical coordinates.
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
  Object.assign(HTMLCanvasElement.prototype, { setPointerCapture: () => undefined, hasPointerCapture: () => false,
    releasePointerCapture: () => undefined })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const canvas = () => screen.getByRole('img', { name: '繪圖作答區' })
function pointer(type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperties(event, { pointerId: { value: 6 }, isPrimary: { value: true }, pointerType: { value: 'pen' } })
  fireEvent(canvas(), event)
}
/** Draws one gesture through the given samples and returns them. */
function gesture(samples: DrawingPoint[]) {
  pointer('pointerdown', samples[0].x, samples[0].y)
  for (const sample of samples.slice(1, -1)) pointer('pointermove', sample.x, sample.y)
  pointer('pointerup', samples.at(-1)!.x, samples.at(-1)!.y)
  return samples
}
function Owner({ seen, handle }: { seen: DrawingStroke[][]; handle?: React.Ref<DrawingCanvasHandle> }) {
  const [ink, setInk] = useState<DrawingStroke[]>([])
  return <DrawingCanvas ref={handle} id="sampling" config={config} strokes={ink}
    onChange={(next) => { seen.push(next); setInk(next); return 'accepted' }} />
}
function distanceToSegment(point: DrawingPoint, from: DrawingPoint, to: DrawingPoint) {
  const dx = to.x - from.x, dy = to.y - from.y, span = dx * dx + dy * dy
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / span))
  return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy))
}
const deviation = (raw: DrawingPoint[], stored: DrawingPoint[]) =>
  Math.max(...raw.map((point) => Math.min(...stored.slice(1).map((to, index) => distanceToSegment(point, stored[index], to)))))
/**
 * A handwriting-sized loop sampled about one unit apart. Coordinates are multiples of 1/8 so that the
 * conversion from client to logical coordinates is exact and samples can be compared by value.
 */
const eighth = (value: number) => Math.round(value * 8) / 8
const loop = (cx: number, cy: number) => Array.from({ length: 140 }, (_, index) =>
  ({ x: eighth(cx + 22 * Math.cos(index / 22)), y: eighth(cy + 30 * Math.sin(index / 22)) }))

describe('DrawingCanvas reduces dense pointer samples without changing what is shown', () => {
  it('stores a densely sampled curve with a fraction of its samples, within the tolerance, ending where the pen lifted', () => {
    const seen: DrawingStroke[][] = []
    render(<Owner seen={seen} />)
    const raw = gesture(loop(300, 200))
    expect(seen).toHaveLength(1)
    const stored = seen[0][0].points
    expect(stored.length).toBeLessThan(raw.length / 3)
    expect(stored[0]).toEqual(raw[0])
    expect(stored.at(-1)).toEqual(raw.at(-1))
    expect(deviation(raw, stored)).toBeLessThanOrEqual(STROKE_SAMPLE_TOLERANCE + 1e-9)
    // The canvas shows exactly the stored stroke.
    expect(paintedPaths).toEqual([stored])
  })

  it('paints, while the pen is down, exactly the stroke a commit would store at that moment', () => {
    const seen: DrawingStroke[][] = []
    const handle = createRef<DrawingCanvasHandle>()
    render(<Owner seen={seen} handle={handle} />)
    const raw = loop(400, 300)
    pointer('pointerdown', raw[0].x, raw[0].y)
    for (const sample of raw.slice(1, 90)) {
      pointer('pointermove', sample.x, sample.y)
      // The in-progress stroke always reaches the pen.
      expect(paintedPaths.at(-1)!.at(-1)).toEqual(sample)
    }
    const inProgress = paintedPaths.at(-1)!
    expect(inProgress.length).toBeLessThan(90 / 3)
    // A flush (mode switch, submit) commits what was on screen, point for point.
    let flushed: DrawingStroke[] = []
    act(() => { flushed = handle.current!.flushPendingStroke() })
    expect(flushed.at(-1)!.points).toEqual(inProgress)
    expect(seen.at(-1)!.at(-1)!.points).toEqual(inProgress)
    expect(paintedPaths).toEqual([inProgress])
  })

  it('stores sparse samples as received, so strokes drawn with few events are unchanged', () => {
    const seen: DrawingStroke[][] = []
    render(<Owner seen={seen} />)
    const raw = gesture([{ x: 10, y: 100 }, { x: 10 + STROKE_SAMPLE_MAX_SEGMENT + 6, y: 100 }, { x: 10 + 2 * (STROKE_SAMPLE_MAX_SEGMENT + 6), y: 100 }])
    expect(seen[0][0].points).toEqual(raw)
  })

  it('samples eraser strokes the same way and keeps their tool and width', () => {
    const seen: DrawingStroke[][] = []
    render(<Owner seen={seen} />)
    fireEvent.click(screen.getByRole('button', { name: '橡皮擦' }))
    const raw = gesture(Array.from({ length: 21 }, (_, index) => ({ x: 100 + index, y: 250 })))
    expect(seen[0][0]).toMatchObject({ tool: 'eraser', width: 24, points: [raw[0], raw[20]] })
  })

  it('keeps a tap as the two samples it always was', () => {
    const seen: DrawingStroke[][] = []
    render(<Owner seen={seen} />)
    gesture([{ x: 50, y: 60 }, { x: 50, y: 60 }])
    expect(seen[0][0].points).toEqual([{ x: 50, y: 60 }, { x: 50, y: 60 }])
  })
})
