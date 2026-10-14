// @vitest-environment jsdom
import { createRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { DrawingStroke } from '../../models/drawing'
import { DrawingCanvas, type DrawingCanvasHandle } from './DrawingCanvas'

/**
 * While a stroke is in progress the canvas paints a copy of the finished strokes plus that stroke.
 * At rest it is always a full replay of the answer. Every canvas here has its own recording context,
 * as in a browser, so the copy is really used; what is stored must not depend on it.
 */
const config = { width: 800, height: 600 }
interface Recorder { ops: string[]; context: CanvasRenderingContext2D }
let recorders = new WeakMap<HTMLCanvasElement, Recorder>()
let asked: HTMLCanvasElement[] = []
let drawImage: 'works' | 'missing' | 'throws' = 'works'
function recorder(): Recorder {
  const ops: string[] = []
  const context = { globalCompositeOperation: 'source-over', lineWidth: 1, strokeStyle: '', fillStyle: '', lineCap: 'butt', lineJoin: 'miter',
    save: () => undefined, restore: () => { context.globalCompositeOperation = 'source-over' },
    clearRect: () => { ops.push('clear') }, beginPath: () => { ops.push('path') }, arc: () => undefined, fill: () => undefined,
    moveTo: () => undefined, lineTo: () => undefined, stroke: () => { ops.push(`stroke:${context.globalCompositeOperation}`) },
    ...(drawImage === 'missing' ? {} : { drawImage: () => { if (drawImage === 'throws') throw new Error('cannot copy'); ops.push('image') } }) }
  return { ops, context: context as unknown as CanvasRenderingContext2D }
}
beforeEach(() => {
  localStorage.clear()
  recorders = new WeakMap(); asked = []; drawImage = 'works'
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    let entry = recorders.get(this)
    if (!entry) { entry = recorder(); recorders.set(this, entry); asked.push(this) }
    return entry.context
  } as unknown as HTMLCanvasElement['getContext'])
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
  Object.assign(HTMLCanvasElement.prototype, { setPointerCapture: () => undefined, hasPointerCapture: () => false,
    releasePointerCapture: () => undefined })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const canvas = (name = '繪圖作答區') => screen.getAllByRole('img', { name })[0] as HTMLCanvasElement
function pointer(type: string, x: number, y: number, target: HTMLCanvasElement = canvas()) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperties(event, { pointerId: { value: 5 }, isPrimary: { value: true }, pointerType: { value: 'pen' } })
  fireEvent(target, event)
}
/** What a canvas was asked to draw since it was last cleared. */
const sinceClear = (element: HTMLCanvasElement) => { const ops = recorders.get(element)!.ops; return ops.slice(ops.lastIndexOf('clear') + 1) }
const paths = (ops: string[]) => ops.filter((op) => op === 'path').length
/** The canvas the component did not render: the shared offscreen copy. */
const offscreen = () => asked.find((element) => !document.body.contains(element))
const saved = (count: number): DrawingStroke[] => Array.from({ length: count }, (_, row) =>
  ({ tool: 'pen', color: '#202b38', width: 4, points: [{ x: 10, y: 10 + row * 5 }, { x: 700, y: 10 + row * 5 }] }))
/** A zigzag gesture: every sample is far from its neighbours, so all of them are stored. */
const zigzag = (y: number, moves = 6) => Array.from({ length: moves + 2 }, (_, step) => ({ x: 40 + step * 60, y: y + (step % 2) * 40 }))
function gesture(samples: { x: number; y: number }[], target?: HTMLCanvasElement) {
  pointer('pointerdown', samples[0].x, samples[0].y, target)
  for (const sample of samples.slice(1, -1)) pointer('pointermove', sample.x, sample.y, target)
  pointer('pointerup', samples.at(-1)!.x, samples.at(-1)!.y, target)
}
/** `copies`: hand the canvas a fresh copy of every accepted drawing, as the practice store does after validating it. */
function Owner({ initial = [], seen, copies = false, refuse = false, handle, id = 'ink' }: {
  initial?: DrawingStroke[]; seen?: DrawingStroke[][]; copies?: boolean; refuse?: boolean; handle?: React.Ref<DrawingCanvasHandle>; id?: string
}) {
  const [ink, setInk] = useState(initial)
  return <DrawingCanvas ref={handle} id={id} config={config} strokes={ink} onChange={(next) => {
    if (refuse) return 'limit'
    seen?.push(next); setInk(copies ? structuredClone(next) : next); return 'accepted'
  }} />
}

describe('a pointer move paints the copy and one stroke, however many strokes the drawing has', () => {
  it.each([0, 3, 400])('with %i finished strokes', (count) => {
    render(<Owner initial={saved(count)} />)
    // At rest: a full replay.
    expect(paths(sinceClear(canvas()))).toBe(count)
    const samples = zigzag(300)
    pointer('pointerdown', samples[0].x, samples[0].y)
    expect(sinceClear(canvas())).toEqual(['image', 'path'])
    for (const sample of samples.slice(1, -1)) {
      pointer('pointermove', sample.x, sample.y)
      expect(sinceClear(canvas())).toEqual(['image', 'path', 'stroke:source-over'])
    }
    // The copy was built by replaying the finished strokes once, when the stroke began.
    expect(paths(recorders.get(offscreen()!)!.ops)).toBe(count)
    pointer('pointerup', samples.at(-1)!.x, samples.at(-1)!.y)
    // Released: the canvas is a full replay again, and it was copied for the next stroke.
    expect(paths(sinceClear(canvas()))).toBe(count + 1)
    expect(sinceClear(canvas())).not.toContain('image')
    expect(recorders.get(offscreen()!)!.ops.slice(-2)).toEqual(['clear', 'image'])
  })

  it.each([false, true])('does not replay into the copy again for later strokes (owner hands back copies: %s)', (copies) => {
    render(<Owner initial={saved(50)} copies={copies} />)
    gesture(zigzag(300))
    const layer = recorders.get(offscreen()!)!.ops
    const replayed = paths(layer)
    expect(replayed).toBe(50)
    for (let stroke = 0; stroke < 5; stroke++) gesture(zigzag(320 + stroke * 10))
    // Five more strokes: the copy was refreshed by copying the replayed canvas, never by replaying strokes into it.
    expect(paths(layer)).toBe(replayed)
    expect(paths(sinceClear(canvas()))).toBe(56)
  })

  it('applies an eraser in progress to the copied ink', () => {
    render(<Owner initial={saved(2)} />)
    fireEvent.click(screen.getByRole('button', { name: '橡皮擦' }))
    pointer('pointerdown', 40, 12); pointer('pointermove', 200, 14)
    expect(sinceClear(canvas())).toEqual(['image', 'path', 'stroke:destination-out'])
    pointer('pointerup', 400, 12)
    expect(sinceClear(canvas())).toEqual(['path', 'stroke:source-over', 'path', 'stroke:source-over', 'path', 'stroke:destination-out'])
  })
})

describe('what is stored does not depend on how the stroke in progress was painted', () => {
  function record(mode: typeof drawImage) {
    drawImage = mode
    const seen: DrawingStroke[][] = []
    const view = render(<Owner seen={seen} />)
    gesture(zigzag(100)); gesture(Array.from({ length: 80 }, (_, step) => ({ x: 100 + step, y: 300 + Math.round(20 * Math.sin(step / 9) * 10) / 10 })))
    fireEvent.click(screen.getByRole('button', { name: '橡皮擦' }))
    gesture(zigzag(200, 3))
    fireEvent.click(screen.getByRole('button', { name: '復原' }))
    fireEvent.click(screen.getByRole('button', { name: '重做' }))
    view.unmount()
    return seen
  }
  it('stores the same strokes, value for value, with the copy, without it, and when copying fails', () => {
    const withCopy = record('works')
    expect(withCopy.at(-1)).toHaveLength(3)
    expect(withCopy.at(-1)![0].points).toEqual(zigzag(100))
    expect(record('missing')).toEqual(withCopy)
    expect(record('throws')).toEqual(withCopy)
  })
})

describe('at rest the canvas is always a full replay of the answer', () => {
  it('after undo, redo, clear and a refused stroke', () => {
    const view = render(<Owner initial={saved(4)} />)
    gesture(zigzag(300))
    expect(paths(sinceClear(canvas()))).toBe(5)
    fireEvent.click(screen.getByRole('button', { name: '復原' }))
    expect(sinceClear(canvas())).not.toContain('image')
    expect(paths(sinceClear(canvas()))).toBe(4)
    fireEvent.click(screen.getByRole('button', { name: '重做' }))
    expect(paths(sinceClear(canvas()))).toBe(5)
    view.rerender(<Owner initial={saved(4)} refuse />)
    gesture(zigzag(400))
    // The refused stroke is gone and no copy is left on the canvas: the five accepted strokes are replayed.
    expect(sinceClear(canvas())).not.toContain('image')
    expect(paths(sinceClear(canvas()))).toBe(5)
    view.rerender(<Owner initial={saved(4)} />)
    fireEvent.click(screen.getByRole('button', { name: '清除畫布' }))
    fireEvent.click(screen.getByRole('button', { name: '確認清除' }))
    expect(sinceClear(canvas())).toEqual([])
    // The next stroke starts from an empty copy, not from the cleared drawing.
    pointer('pointerdown', 40, 40); pointer('pointermove', 200, 80)
    expect(sinceClear(canvas())).toEqual(['image', 'path', 'stroke:source-over'])
    pointer('pointerup', 300, 40)
    expect(paths(sinceClear(canvas()))).toBe(1)
  })

  it('after a pending stroke is completed by a flush, and after the owner replaces the strokes', () => {
    const handle = createRef<DrawingCanvasHandle>()
    function Replaceable() {
      const [ink, setInk] = useState(saved(3))
      return <><DrawingCanvas ref={handle} id="replace" config={config} strokes={ink} onChange={(next) => { setInk(next); return 'accepted' }} />
        <button type="button" onClick={() => setInk(saved(7))}>replace</button></>
    }
    render(<Replaceable />)
    pointer('pointerdown', 40, 300); pointer('pointermove', 200, 340)
    expect(sinceClear(canvas())).toEqual(['image', 'path', 'stroke:source-over'])
    act(() => { handle.current!.flushPendingStroke() })
    expect(sinceClear(canvas())).not.toContain('image')
    expect(paths(sinceClear(canvas()))).toBe(4)
    // Another client's drawing arrives: full replay of it, and the next stroke builds on it.
    fireEvent.click(screen.getByRole('button', { name: 'replace' }))
    expect(paths(sinceClear(canvas()))).toBe(7)
    pointer('pointerdown', 40, 400); pointer('pointermove', 200, 440)
    expect(sinceClear(canvas())).toEqual(['image', 'path', 'stroke:source-over'])
    pointer('pointerup', 300, 400)
    expect(paths(sinceClear(canvas()))).toBe(8)
  })

  it('replays the stroke in progress together with strokes the owner replaces meanwhile, and keeps going', () => {
    function Replaceable() {
      const [ink, setInk] = useState(saved(2))
      return <><DrawingCanvas id="meanwhile" config={config} strokes={ink} onChange={(next) => { setInk(next); return 'accepted' }} />
        <button type="button" onClick={() => setInk(saved(6))}>replace</button></>
    }
    render(<Replaceable />)
    pointer('pointerdown', 40, 300); pointer('pointermove', 200, 340)
    fireEvent.click(screen.getByRole('button', { name: 'replace' }))
    // Six replaced strokes and the one in progress, replayed in full.
    expect(sinceClear(canvas())).not.toContain('image')
    expect(paths(sinceClear(canvas()))).toBe(7)
    // The next move paints over a copy of the six, not of the two it started from.
    pointer('pointermove', 300, 300)
    expect(sinceClear(canvas())).toEqual(['image', 'path', 'stroke:source-over'])
    expect(paths(recorders.get(offscreen()!)!.ops.slice(recorders.get(offscreen()!)!.ops.lastIndexOf('clear')))).toBe(6)
    pointer('pointerup', 400, 340)
    expect(paths(sinceClear(canvas()))).toBe(7)
  })
})

describe('several canvases share one copy', () => {
  it('writing on one question and then another uses a single offscreen canvas and repaints each correctly', () => {
    render(<><Owner id="first" initial={saved(3)} /><Owner id="second" initial={saved(9)} /></>)
    const [first, second] = screen.getAllByRole('img', { name: '繪圖作答區' }) as HTMLCanvasElement[]
    gesture(zigzag(300), first)
    gesture(zigzag(300), second)
    pointer('pointerdown', 40, 400, first); pointer('pointermove', 200, 440, first)
    // Back on the first canvas: its own four strokes are under the stroke in progress.
    expect(sinceClear(first)).toEqual(['image', 'path', 'stroke:source-over'])
    const layer = recorders.get(offscreen()!)!.ops
    expect(paths(layer.slice(layer.lastIndexOf('clear')))).toBe(4)
    pointer('pointerup', 300, 400, first)
    expect(paths(sinceClear(first))).toBe(5)
    expect(paths(sinceClear(second))).toBe(10)
    expect(asked.filter((element) => !document.body.contains(element))).toHaveLength(1)
  })
})
