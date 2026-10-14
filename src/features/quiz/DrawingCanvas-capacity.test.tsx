// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DRAWING_LIMITS, parseStoredDrawing } from '../../../supabase/functions/_shared/drawing-raster'
import { drawingUsage } from '../../lib/drawing-capacity'
import type { DrawingStroke } from '../../models/drawing'
import { DraftCapacityContext, type AnswerOutcome, type DraftCapacity } from './attempt-context'
import { DRAWING_CAPACITY_TIGHT_STATUS, DRAWING_LIMIT_NOTICES, DrawingCanvas } from './DrawingCanvas'

/**
 * The capacity line under the canvas and the notice for a refused stroke name the limit that is
 * involved. The owner in these tests accepts a drawing exactly when the stored-answer parser does.
 */
const config = { width: 1200, height: 900 }
const { maxStrokes, maxPoints, maxGeometryPixels } = DRAWING_LIMITS
beforeEach(() => {
  localStorage.clear()
  const noop = () => undefined
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ save: noop, restore: noop, clearRect: noop,
    beginPath: noop, arc: noop, fill: noop, moveTo: noop, lineTo: noop, stroke: noop } as unknown as CanvasRenderingContext2D)
  // The display rect equals the logical size, so client coordinates are logical coordinates.
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 1200, height: 900, right: 1200, bottom: 900, x: 0, y: 0, toJSON: () => ({}) })
  Object.assign(HTMLCanvasElement.prototype, { setPointerCapture: () => undefined, hasPointerCapture: () => false,
    releasePointerCapture: () => undefined })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const canvas = () => screen.getByRole('img', { name: '繪圖作答區' })
function pointer(type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperties(event, { pointerId: { value: 3 }, isPrimary: { value: true }, pointerType: { value: 'pen' } })
  fireEvent(canvas(), event)
}
/** One short gesture: three stored points, 60 units long. */
function draw(y = 450) { pointer('pointerdown', 300, y); pointer('pointermove', 330, y); pointer('pointerup', 360, y) }
const line = () => document.querySelector('.drawing-capacity')
// The canvas's own status line (the brush-width output is a status region as well).
const status = () => document.querySelector('.drawing-status')
const dots = (count: number): DrawingStroke[] => Array.from({ length: count }, () => ({ tool: 'pen', color: '#202b38', width: 1, points: [{ x: 600, y: 450 }] }))
const stationary = (count: number): DrawingStroke => ({ tool: 'pen', color: '#202b38', width: 1, points: Array.from({ length: count }, () => ({ x: 600, y: 450 })) })
/** Wide eraser zigzags, then stationary points, until `left` to `left + 15` geometry pixels remain. */
function geometryLeft(left: number): DrawingStroke[] {
  const strokes: DrawingStroke[] = []
  const used = () => drawingUsage(strokes, config).geometryPixels
  const scrub = (): DrawingStroke => ({ tool: 'eraser', color: '#202b38', width: 100,
    points: Array.from({ length: 20 }, (_, index) => ({ x: index % 2 ? 1100 : 100, y: 100 + index * 11 })) })
  const scrubPixels = drawingUsage([scrub()], config).geometryPixels
  while (used() + scrubPixels <= maxGeometryPixels - left) strokes.push(scrub())
  const coarse = Math.floor((maxGeometryPixels - left - used()) / 10404)
  if (coarse > 0) strokes.push({ tool: 'eraser', color: '#202b38', width: 100, points: Array.from({ length: coarse }, () => ({ x: 600, y: 450 })) })
  const fine = Math.floor((maxGeometryPixels - left - used()) / 16)
  if (fine > 0) strokes.push(stationary(fine))
  return strokes
}
/** Accepts a drawing exactly when parseStoredDrawing does, like the practice store; can also report a full draft. */
function Owner({ initial, draft = null, draftFull = false }: { initial: DrawingStroke[]; draft?: DraftCapacity | null; draftFull?: boolean }) {
  const [ink, setInk] = useState(initial)
  const decide = (next: DrawingStroke[]): AnswerOutcome => {
    if (draftFull && next.length > ink.length) return 'draft-limit'
    try { parseStoredDrawing({ type: 'drawing', strokes: next }, config) } catch { return 'limit' }
    setInk(next)
    return 'accepted'
  }
  return <DraftCapacityContext.Provider value={draft}>
    <DrawingCanvas id="capacity" config={config} strokes={ink} onChange={decide} />
  </DraftCapacityContext.Provider>
}

describe('capacity line under the canvas', () => {
  it('stays hidden while every limit is less than three quarters full', () => {
    render(<Owner initial={dots(Math.floor(maxStrokes * 0.75) - 2)} />)
    expect(line()).toBeNull()
    draw()
    expect(line()).toBeNull()
  })

  it('appears at three quarters and counts the strokes; it is not a live region', () => {
    render(<Owner initial={dots(Math.floor(maxStrokes * 0.75) - 1)} />)
    expect(line()).toBeNull()
    draw()
    expect(line()).toHaveTextContent(`手寫容量已用 75%（筆數 ${(maxStrokes * 0.75).toLocaleString('en-US')}／${maxStrokes.toLocaleString('en-US')}）。`)
    expect(line()).not.toHaveClass('is-tight')
    expect(line()).not.toHaveAttribute('role')
    expect(line()).not.toHaveAttribute('aria-live')
    expect(status()).toBeEmptyDOMElement()
  })

  it('turns into a warning when the last stroke is used, says so once, and the next stroke is refused for the stroke limit', () => {
    render(<Owner initial={dots(maxStrokes - 2)} />)
    draw(300)
    expect(line()).not.toHaveClass('is-tight')
    expect(status()).toBeEmptyDOMElement()
    draw(400)
    expect(line()).toHaveClass('is-tight')
    expect(line()).toHaveTextContent(`手寫容量幾乎用完（筆數 ${maxStrokes.toLocaleString('en-US')}／${maxStrokes.toLocaleString('en-US')}），下一筆可能無法加入。`)
    expect(status()).toHaveTextContent(DRAWING_CAPACITY_TIGHT_STATUS)
    expect(screen.queryByRole('alert')).toBeNull()
    draw(500)
    expect(screen.getByRole('alert')).toHaveTextContent(DRAWING_LIMIT_NOTICES.strokes)
    // Undo makes room again: the notice goes away and the line is no longer a warning.
    fireEvent.click(screen.getByRole('button', { name: '復原' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(line()).not.toHaveClass('is-tight')
  })

  it('names the sample points when they are what runs out, and refuses the stroke that passes them for that limit', () => {
    render(<Owner initial={[stationary(maxPoints - 2)]} />)
    expect(line()).toHaveClass('is-tight')
    expect(line()).toHaveTextContent(`取樣點 ${(maxPoints - 2).toLocaleString('en-US')}／${maxPoints.toLocaleString('en-US')}`)
    draw()
    expect(screen.getByRole('alert')).toHaveTextContent(DRAWING_LIMIT_NOTICES.points)
    expect(screen.getByRole('alert')).toHaveTextContent(`最多 ${maxPoints.toLocaleString('en-US')} 個取樣點`)
  })

  it('names the brush area when wide eraser strokes use it up, and refuses the next wide stroke for that limit', () => {
    // 20,000 pixels are left; a three-point stroke with the widest eraser needs about 38,000, a pen stroke under 500.
    render(<Owner initial={geometryLeft(20_000)} />)
    expect(line()).toHaveTextContent('筆畫與橡皮擦的累計範圍')
    fireEvent.click(screen.getByRole('button', { name: '橡皮擦' }))
    fireEvent.change(screen.getByRole('slider', { name: '橡皮擦大小' }), { target: { value: '100' } })
    draw()
    expect(screen.getByRole('alert')).toHaveTextContent(DRAWING_LIMIT_NOTICES.geometry)
    expect(screen.getByRole('alert')).toHaveTextContent('較粗的橡皮擦')
    // A pen stroke still fits in what is left.
    fireEvent.click(screen.getByRole('button', { name: '畫筆' }))
    draw(500)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps more room for a wide eraser than for a pen: the same drawing warns only once the eraser is selected', () => {
    const initial = geometryLeft(2_000_000)
    const percent = Math.floor(100 * drawingUsage(initial, config).geometryPixels / maxGeometryPixels)
    expect(percent).toBeGreaterThanOrEqual(91)
    render(<Owner initial={initial} />)
    expect(line()).toHaveTextContent(`手寫容量已用 ${percent}%（筆畫與橡皮擦的累計範圍）。`)
    expect(line()).not.toHaveClass('is-tight')
    fireEvent.click(screen.getByRole('button', { name: '橡皮擦' }))
    fireEvent.change(screen.getByRole('slider', { name: '橡皮擦大小' }), { target: { value: '100' } })
    expect(line()).toHaveClass('is-tight')
    expect(line()).toHaveTextContent('手寫容量幾乎用完（筆畫與橡皮擦的累計範圍），下一筆可能無法加入。')
    // With the pen selected again there is room for an ordinary stroke, and one is accepted.
    fireEvent.click(screen.getByRole('button', { name: '畫筆' }))
    expect(line()).not.toHaveClass('is-tight')
    draw()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the size of the whole draft when that is what is nearly used up, and explains a stroke refused for it', () => {
    const cap = 4 * 1024 * 1024
    const view = render(<Owner initial={[]} draft={{ usedBytes: Math.ceil(cap * 0.8), maxBytes: cap }} />)
    expect(line()).toHaveTextContent('手寫容量已用 80%（整份作答的大小）。')
    view.rerender(<Owner initial={[]} draft={{ usedBytes: cap - 500, maxBytes: cap }} draftFull />)
    expect(line()).toHaveClass('is-tight')
    expect(line()).toHaveTextContent('手寫容量幾乎用完（整份作答的大小），下一筆可能無法加入。')
    draw()
    expect(screen.getByRole('alert')).toHaveTextContent(DRAWING_LIMIT_NOTICES.draft)
    expect(screen.getByRole('alert')).toHaveTextContent('任何一題皆可')
  })

  it('shows nothing about the draft where there is no draft (Author Preview)', () => {
    render(<Owner initial={[]} />)
    expect(line()).toBeNull()
  })
})
