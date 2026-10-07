// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { DrawingStroke } from '../../models/drawing'
import * as drawing from '../../lib/drawing'
import { DRAWING_INPUT_MODE_KEY } from '../../lib/drawing-input-mode'
import { DrawingCanvas, type DrawingCanvasHandle } from './DrawingCanvas'

const config = { width: 800, height: 600 }
const stroke: DrawingStroke = { tool: 'pen', color: '#202b38', width: 4,
  points: [{ x: 20, y: 40 }, { x: 60, y: 80 }, { x: 80, y: 100 }] }
let context: Record<string, ReturnType<typeof vi.fn>>
beforeEach(() => {
  localStorage.clear()
  context = Object.fromEntries(['save', 'restore', 'clearRect', 'beginPath', 'arc', 'fill', 'moveTo', 'lineTo', 'stroke'].map(key => [key, vi.fn()]))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 10, top: 20, width: 400, height: 300, right: 410, bottom: 320, x: 10, y: 20, toJSON: () => ({}),
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); window.history.replaceState(null, '', '/') })

function Harness({ onChange = vi.fn() }: { onChange?: (ink: DrawingStroke[]) => void }) {
  const [ink, setInk] = useState<DrawingStroke[]>([])
  return <DrawingCanvas id="input-test" config={config} strokes={ink} onChange={next => { onChange(next); setInk(next) }} />
}
const captureStates = new WeakMap<HTMLCanvasElement, Set<number>>()
function surface() {
  const canvas = screen.getByRole('img', { name: '繪圖作答區' }) as HTMLCanvasElement
  const captures = new Set<number>()
  captureStates.set(canvas, captures)
  canvas.setPointerCapture = vi.fn(id => { captures.add(id) })
  canvas.hasPointerCapture = vi.fn(id => captures.has(id))
  canvas.releasePointerCapture = vi.fn(id => { captures.delete(id) })
  return canvas
}
// jsdom has no native PointerEvent; retain realistic type, identity and primary flags.
function pointer(canvas: HTMLCanvasElement, type: string, pointerType: string, pointerId: number, x = 20, y = 40, isPrimary = true) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperties(event, { pointerType: { value: pointerType }, pointerId: { value: pointerId }, isPrimary: { value: isPrimary } })
  fireEvent(canvas, event)
  // The UA releases capture AFTER up/cancel handlers. A delayed old lost event
  // does not clear a new capture; genuine loss is explicitly modelled by tests.
  if (type === 'pointerup' || type === 'pointercancel') captureStates.get(canvas)?.delete(pointerId)
}
function mode(value: 'standard' | 'stylus') {
  fireEvent.change(screen.getByRole('combobox', { name: '輸入方式' }), { target: { value } })
}
function draw(canvas: HTMLCanvasElement, type: string, id: number) {
  pointer(canvas, 'pointerdown', type, id)
  pointer(canvas, 'pointermove', type, id, 40, 60)
  pointer(canvas, 'pointerup', type, id, 50, 70)
}

describe('opt-in local drawing event diagnostics', () => {
  type TraceEntry = { source: string; phase: string; type: string; label: string; decision: string; reason: string | null;
    pointerId: number | null; pendingPointerId: number | null; time: number; changedTouches?: unknown[] }
  let writeText: ReturnType<typeof vi.fn>
  beforeEach(() => {
    window.history.replaceState(null, '', '/?drawingDebug=1')
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  })
  async function log() {
    fireEvent.click(screen.getByRole('button', { name: '複製診斷紀錄' }))
    await screen.findByText(/已複製/)
    return JSON.parse(writeText.mock.lastCall![0]) as { entries: TraceEntry[]; dropped: number }
  }
  function diagnosticPointer(target: Element, type = 'pointerdown', fields: Record<string, unknown> = {}) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 20, clientY: 40, button: Number(fields.button ?? 0), buttons: 1 })
    Object.defineProperties(event, Object.fromEntries(Object.entries({ pointerType: 'pen', pointerId: 31, isPrimary: true, pressure: 0.7, ...fields })
      .filter(([key]) => key !== 'button').map(([key, value]) => [key, { value }])))
    fireEvent(target, event)
    return event
  }
  it.each(['', '?drawingDebug=0', '?drawingDebug=true'])('has no diagnostic panel, listeners or output without exact opt-in %s', search => {
    window.history.replaceState(null, '', `/${search}`)
    const listen = vi.spyOn(document, 'addEventListener')
    render(<Harness />)
    expect(screen.queryByRole('region', { name: '繪圖事件診斷' })).not.toBeInTheDocument()
    expect(listen.mock.calls.filter(([type]) => /^(pointer|touch|gotpointer|lostpointer)/.test(type))).toEqual([])
    draw(surface(), 'pen', 31)
    expect(writeText).not.toHaveBeenCalled()
  })
  it('exports document/native canvas delivery and accepted React start with current state, without answer or account content', async () => {
    render(<Harness />)
    expect(screen.getByRole('region', { name: '繪圖事件診斷' })).toBeInTheDocument()
    const canvas = surface()
    diagnosticPointer(canvas)
    const { entries } = await log()
    const accepted = entries.find(e => e.label === 'START_ACCEPTED')!
    expect(accepted).toMatchObject({ source: 'canvas', phase: 'react-handler', type: 'pointerdown', decision: 'accepted', reason: null,
      pointerId: 31, pointerType: 'pen', isPrimary: true, button: 0, buttons: 1, pressure: 0.7, clientX: 20, clientY: 40,
      hasPointerCapture: true, pendingPointerId: 31, inputMode: 'standard', target: { tag: 'canvas', classes: ['drawing-canvas'] } })
    expect(accepted.time).toBeGreaterThanOrEqual(0)
    expect(entries.filter(e => e.type === 'pointerdown').map(e => [e.source, e.phase])).toEqual([
      ['document-capture', 'dom'], ['canvas', 'dom'], ['canvas', 'react-handler'],
    ])
    expect(JSON.stringify(entries)).not.toMatch(/strokes|answer|email|account|input-test/)
  })
  it.each([
    { reason: 'touch-stylus-mode', fields: { pointerType: 'touch' }, stylus: true, pending: false },
    { reason: 'button', fields: { button: 2 }, stylus: false, pending: false },
    { reason: 'not-primary', fields: { isPrimary: false }, stylus: false, pending: false },
    { reason: 'pending-active', fields: { pointerId: 32 }, stylus: false, pending: true },
  ])('records unchanged pointerdown rejection: $reason', async ({ reason, fields, stylus, pending }) => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const canvas = surface()
    if (stylus) mode('stylus')
    if (pending) diagnosticPointer(canvas)
    const event = diagnosticPointer(canvas, 'pointerdown', fields)
    const rejected = (await log()).entries.find(e => e.reason === reason)!
    expect(rejected).toMatchObject({ decision: 'rejected', label: 'START_REJECTED', pendingPointerId: pending ? 31 : null })
    expect(event.defaultPrevented).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
    expect(canvas.setPointerCapture).toHaveBeenCalledTimes(pending ? 1 : 0)
  })
  it('observes document events without canvas delivery and native canvas events when React propagation is blocked', async () => {
    render(<Harness />)
    const canvas = surface()
    const unrelated = document.createElement('input')
    unrelated.className = 'private-account'; unrelated.value = 'private answer'
    document.body.append(unrelated)
    diagnosticPointer(unrelated, 'pointerdown', { pointerId: 77 })
    canvas.addEventListener('pointerdown', event => event.stopPropagation(), { once: true })
    diagnosticPointer(canvas)
    const { entries } = await log()
    expect(entries.filter(e => e.pointerId === 77)).toMatchObject([{ source: 'document-capture', target: { tag: 'input', classes: [] } }])
    expect(entries.filter(e => e.pointerId === 31).map(e => e.phase)).toEqual(['dom', 'dom'])
    expect(canvas.setPointerCapture).not.toHaveBeenCalled()
    expect(JSON.stringify(entries)).not.toContain('private')
    unrelated.remove()
  })
  it('passively observes all pointer boundary/capture and touch fallback events without drawing from Touch', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const canvas = surface()
    for (const type of ['pointerover', 'pointerenter', 'pointerout', 'pointerleave', 'gotpointercapture', 'lostpointercapture']) diagnosticPointer(canvas, type)
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'changedTouches', { value: [{ identifier: 9, touchType: 'stylus', clientX: 23, clientY: 45 }] })
      fireEvent(canvas, event)
      expect(event.defaultPrevented).toBe(false)
    }
    const { entries } = await log()
    for (const type of ['pointerover', 'pointerenter', 'pointerout', 'pointerleave', 'gotpointercapture', 'lostpointercapture', 'touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      expect(entries.filter(e => e.type === type && e.phase === 'dom').map(e => e.source)).toEqual(['document-capture', 'canvas'])
    }
    expect(entries.find(e => e.type === 'touchstart')).toMatchObject({ changedTouches: [{ identifier: 9, touchType: 'stylus', clientX: 23, clientY: 45 }] })
    expect(onChange).not.toHaveBeenCalled()
    expect(canvas.setPointerCapture).not.toHaveBeenCalled()
    expect(canvas.releasePointerCapture).not.toHaveBeenCalled()
  })
  it('preserves rapid reused-ID strokes and records stale loss versus real commit without network or storage writes', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const canvas = surface()
    draw(canvas, 'pen', 31)
    pointer(canvas, 'pointerdown', 'pen', 31)
    pointer(canvas, 'lostpointercapture', 'pen', 31)
    pointer(canvas, 'pointermove', 'pen', 31, 40, 60)
    pointer(canvas, 'pointerup', 'pen', 31, 50, 70)
    const { entries } = await log()
    expect(onChange.mock.lastCall![0]).toEqual([stroke, stroke])
    expect(entries.filter(e => e.label === 'UP_COMMIT')).toHaveLength(2)
    expect(entries.find(e => e.label === 'STALE_CAPTURE_IGNORED')).toMatchObject({ hasPointerCapture: true, pendingPointerId: 31 })
    expect(canvas.releasePointerCapture).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(storage).not.toHaveBeenCalled()
  })
  it('bounds memory, clears all entries, and removes observation listeners when unmounted', async () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const view = render(<Harness />)
    const canvas = surface()
    for (let i = 0; i < 220; i++) diagnosticPointer(canvas, 'pointermove', { pointerId: i })
    const full = await log()
    expect(full.entries.length).toBeLessThanOrEqual(500)
    expect(full.dropped).toBeGreaterThan(0)
    expect(full.entries.some(e => e.pointerId === 219)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '清除紀錄' }))
    expect((await log()).entries).toEqual([])
    view.unmount()
    expect(remove.mock.calls.filter(([type]) => /^(pointer|touch|gotpointer|lostpointer)/.test(type))).toHaveLength(14)
  })
  it('offers manual copy fallback if the browser clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    render(<Harness />)
    diagnosticPointer(surface())
    fireEvent.click(screen.getByRole('button', { name: '複製診斷紀錄' }))
    const field = await screen.findByRole('textbox', { name: '診斷紀錄' })
    expect(JSON.parse((field as HTMLTextAreaElement).value).entries.some((e: TraceEntry) => e.label === 'START_ACCEPTED')).toBe(true)
  })
})

describe('drawing input preference and pointer routing', () => {
  it('defaults to standard and changes the accessible description without changing ink', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    expect(screen.getByRole('combobox', { name: '輸入方式' })).toHaveValue('standard')
    expect(screen.getByText('滑鼠、手指與觸控筆皆可繪圖')).toBeInTheDocument()
    mode('stylus')
    expect(screen.getByRole('combobox', { name: '輸入方式' })).toHaveValue('stylus')
    expect(screen.getByText('已忽略手指與手掌觸控；請使用觸控筆或滑鼠繪圖。')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    expect(localStorage.getItem(DRAWING_INPUT_MODE_KEY)).toBe('stylus')
  })
  it.each(['standard', 'stylus'])('restores stored %s preference', value => {
    localStorage.setItem(DRAWING_INPUT_MODE_KEY, value)
    render(<Harness />)
    expect(screen.getByRole('combobox', { name: '輸入方式' })).toHaveValue(value)
  })
  it.each(['invalid', '', 'STYLUS'])('falls back safely for invalid stored value %j', value => {
    localStorage.setItem(DRAWING_INPUT_MODE_KEY, value)
    render(<Harness />)
    expect(screen.getByRole('combobox', { name: '輸入方式' })).toHaveValue('standard')
  })
  it('works for this session when storage reads and writes throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    expect(screen.getByRole('combobox', { name: '輸入方式' })).toHaveValue('standard')
    mode('stylus')
    const canvas = surface()
    draw(canvas, 'touch', 21)
    expect(onChange).not.toHaveBeenCalled()
    draw(canvas, 'pen', 31)
    expect(onChange).toHaveBeenCalledExactlyOnceWith([stroke])
  })
  it.each(['mouse', 'pen', 'touch', '', 'unknown'])('accepts %j in standard mode', type => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const canvas = surface()
    draw(canvas, type, 11)
    expect(canvas.setPointerCapture).toHaveBeenCalledExactlyOnceWith(11)
    expect(onChange).toHaveBeenCalledExactlyOnceWith([stroke])
    expect(canvas.releasePointerCapture).not.toHaveBeenCalled()
    expect(canvas.hasPointerCapture(11)).toBe(false)
  })
  it.each(['mouse', 'pen', '', 'unknown'])('accepts %j in stylus mode', type => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    mode('stylus')
    const canvas = surface()
    draw(canvas, type, 31)
    expect(canvas.setPointerCapture).toHaveBeenCalledExactlyOnceWith(31)
    expect(onChange).toHaveBeenCalledExactlyOnceWith([stroke])
  })
  it('rejects touch before pending ink/capture and accepts a later pen', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    mode('stylus')
    const canvas = surface()
    context.fill.mockClear(); context.stroke.mockClear()
    draw(canvas, 'touch', 21)
    pointer(canvas, 'pointercancel', 'touch', 21)
    pointer(canvas, 'lostpointercapture', 'touch', 21)
    expect(canvas.setPointerCapture).not.toHaveBeenCalled()
    expect(context.fill).not.toHaveBeenCalled()
    expect(context.stroke).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    draw(canvas, 'pen', 31)
    expect(onChange).toHaveBeenCalledExactlyOnceWith([stroke])
  })
  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])('ignores unrelated touch %s while the primary pen continues', ending => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    mode('stylus')
    const canvas = surface()
    pointer(canvas, 'pointerdown', 'pen', 31)
    pointer(canvas, 'pointerdown', 'touch', 21, 300, 250)
    pointer(canvas, 'pointermove', 'touch', 21, 350, 280)
    pointer(canvas, ending, 'touch', 21, 390, 290)
    expect(onChange).not.toHaveBeenCalled()
    expect(canvas.setPointerCapture).toHaveBeenCalledExactlyOnceWith(31)
    expect(canvas.releasePointerCapture).not.toHaveBeenCalled()
    pointer(canvas, 'pointermove', 'pen', 31, 40, 60)
    pointer(canvas, 'pointerup', 'pen', 31, 50, 70)
    expect(onChange).toHaveBeenCalledExactlyOnceWith([stroke])
    expect(canvas.releasePointerCapture).not.toHaveBeenCalled()
    expect(canvas.hasPointerCapture(31)).toBe(false)
  })
  it('allows only the active accepted ID to append or finish even for another pen', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const canvas = surface()
    pointer(canvas, 'pointerdown', 'pen', 31)
    pointer(canvas, 'pointerdown', 'pen', 32, 300, 250, false)
    for (const type of ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) pointer(canvas, type, 'pen', 32, 350, 280, false)
    expect(onChange).not.toHaveBeenCalled()
    pointer(canvas, 'pointermove', 'pen', 31, 40, 60)
    pointer(canvas, 'pointerup', 'pen', 31, 50, 70)
    expect(onChange).toHaveBeenCalledExactlyOnceWith([stroke])
    expect(canvas.setPointerCapture).toHaveBeenCalledExactlyOnceWith(31)
  })
  it('changing preference during ink does not flush, discard or alter the active stroke', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const canvas = surface()
    pointer(canvas, 'pointerdown', 'pen', 31)
    mode('stylus')
    expect(onChange).not.toHaveBeenCalled()
    pointer(canvas, 'pointermove', 'pen', 31, 40, 60)
    pointer(canvas, 'pointerup', 'pen', 31, 50, 70)
    expect(onChange).toHaveBeenCalledExactlyOnceWith([stroke])
    mode('standard')
    draw(canvas, 'touch', 21)
    expect(onChange).toHaveBeenLastCalledWith([stroke, stroke])
    expect(localStorage.getItem(DRAWING_INPUT_MODE_KEY)).toBe('standard')
  })
  it('retains tool/color/width, undo/redo/clear and PNG export', async () => {
    const download = vi.spyOn(drawing, 'downloadDrawingPng').mockResolvedValue(undefined)
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    mode('stylus')
    fireEvent.click(screen.getByRole('button', { name: '紅色' }))
    fireEvent.change(screen.getByRole('slider'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: '橡皮擦' }))
    draw(surface(), 'pen', 31)
    const eraser: DrawingStroke = { ...stroke, tool: 'eraser', color: '#c03535', width: 12 }
    // The canonical palette is authoritative; never change the stored stroke shape.
    const ink = onChange.mock.calls[0][0] as DrawingStroke[]
    expect(ink).toEqual([eraser])
    fireEvent.click(screen.getByRole('button', { name: '匯出 PNG' }))
    expect(download).toHaveBeenCalledExactlyOnceWith(config, ink, 'input-test.png')
    await screen.findByText('PNG 已匯出。')
    fireEvent.click(screen.getByRole('button', { name: '復原' }))
    expect(onChange).toHaveBeenLastCalledWith([])
    fireEvent.click(screen.getByRole('button', { name: '重做' }))
    expect(onChange).toHaveBeenLastCalledWith(ink)
    fireEvent.click(screen.getByRole('button', { name: '清除畫布' }))
    fireEvent.click(screen.getByRole('button', { name: '確認清除' }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })
  it('prevents the canvas context menu through the normal event path', () => {
    render(<Harness />)
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    fireEvent(surface(), event)
    expect(event.defaultPrevented).toBe(true)
  })
  it('protects only the interactive drawing surface and keeps responsive sizing', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8')
    const protection = css.match(/\.canvas-frame,\s*\.drawing-canvas\s*\{([^}]+)\}/)?.[1]
    expect(protection).toMatch(/touch-action:\s*none/)
    expect(protection).toMatch(/(?:^|[;\s])user-select:\s*none/)
    expect(protection).toMatch(/-webkit-user-select:\s*none/)
    expect(protection).toMatch(/-webkit-touch-callout:\s*none/)
    expect(css).toMatch(/\.drawing-canvas,\s*\.drawing-preview\s*\{[^}]*width:\s*100%;\s*height:\s*auto/)
  })
})

describe('rapid stylus lifecycle', () => {
  it.each([31, 32])('keeps B moving after delayed A capture loss with B pointerId=%i', nextId => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    mode('stylus')
    const canvas = surface()
    draw(canvas, 'pen', 31)
    expect(onChange).toHaveBeenCalledExactlyOnceWith([stroke])
    pointer(canvas, 'pointerdown', 'pen', nextId, 100, 100)
    expect(canvas.hasPointerCapture(nextId)).toBe(true)
    pointer(canvas, 'lostpointercapture', 'pen', 31)
    expect(onChange).toHaveBeenCalledTimes(1)
    pointer(canvas, 'pointermove', 'pen', nextId, 120, 130)
    pointer(canvas, 'pointerup', 'pen', nextId, 140, 150)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith([stroke, { ...stroke, points: [
      { x: 180, y: 160 }, { x: 220, y: 220 }, { x: 260, y: 260 },
    ] }])
  })

  it.each(['none', 'between', 'held'])('preserves A B C D with palm=%s and repeated pointerId reuse', palm => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    mode('stylus')
    const canvas = surface()
    if (palm === 'held') pointer(canvas, 'pointerdown', 'touch', 21)
    for (let i = 0; i < 4; i++) {
      if (palm === 'between' && i === 1) draw(canvas, 'touch', 21)
      pointer(canvas, 'pointerdown', 'pen', 31, 20 + i * 10, 40)
      if (i > 0) pointer(canvas, 'lostpointercapture', 'pen', 31)
      if (palm === 'held') pointer(canvas, 'pointermove', 'touch', 21, 300, 250)
      pointer(canvas, 'pointermove', 'pen', 31, 40 + i * 10, 60)
      pointer(canvas, 'pointerup', 'pen', 31, 50 + i * 10, 70)
    }
    if (palm === 'held') pointer(canvas, 'pointerup', 'touch', 21)
    expect(onChange).toHaveBeenCalledTimes(4)
    const ink = onChange.mock.lastCall![0] as DrawingStroke[]
    expect(ink).toEqual(Array.from({ length: 4 }, (_, i) => ({ ...stroke,
      points: stroke.points.map(p => ({ ...p, x: p.x + i * 20 })),
    })))
    expect(canvas.setPointerCapture).toHaveBeenCalledTimes(4)
    expect(canvas.setPointerCapture).not.toHaveBeenCalledWith(21)
  })

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])('commits only once and accepts the next pen after genuine %s', ending => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    mode('stylus')
    const canvas = surface()
    pointer(canvas, 'pointerdown', 'pen', 31)
    pointer(canvas, 'pointermove', 'pen', 31, 40, 60)
    if (ending === 'lostpointercapture') captureStates.get(canvas)!.delete(31)
    pointer(canvas, ending, 'pen', 31, 50, 70)
    const first = ending === 'pointerup' ? stroke : { ...stroke, points: stroke.points.slice(0, 2) }
    expect(onChange).toHaveBeenCalledExactlyOnceWith([first])
    pointer(canvas, 'lostpointercapture', 'pen', 31)
    pointer(canvas, 'pointerup', 'pen', 31)
    expect(onChange).toHaveBeenCalledTimes(1)
    draw(canvas, 'pen', 31)
    expect(onChange).toHaveBeenLastCalledWith([first, stroke])
  })

  it('commits rapid dots and repaints every committed dot after acknowledgement', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    mode('stylus')
    const canvas = surface()
    for (let i = 0; i < 24; i++) {
      pointer(canvas, 'pointerdown', 'pen', 31, 20 + i, 40)
      if (i) pointer(canvas, 'lostpointercapture', 'pen', 31)
      pointer(canvas, 'pointerup', 'pen', 31, 20 + i, 40)
    }
    expect(onChange).toHaveBeenCalledTimes(24)
    expect(onChange.mock.lastCall![0]).toEqual(Array.from({ length: 24 }, (_, i) => ({ ...stroke,
      points: [{ x: 20 + i * 2, y: 40 }, { x: 20 + i * 2, y: 40 }],
    })))
    // Replay only the final committed history, excluding pending pointerdown ink.
    context.fill.mockClear(); context.arc.mockClear(); context.stroke.mockClear()
    drawing.replayDrawing(context as unknown as CanvasRenderingContext2D, config, onChange.mock.lastCall![0])
    expect(context.fill).toHaveBeenCalledTimes(24)
    expect(context.arc.mock.calls).toEqual(Array.from({ length: 24 }, (_, i) => [20 + i * 2, 40, 2, 0, Math.PI * 2]))
    expect(context.stroke).not.toHaveBeenCalled()
  })

  it('retains captured moves outside the canvas in logical bounds', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    mode('stylus')
    const canvas = surface()
    pointer(canvas, 'pointerdown', 'pen', 31)
    pointer(canvas, 'pointermove', 'pen', 31, 900, -100)
    pointer(canvas, 'pointerup', 'pen', 31, 900, 900)
    expect(onChange).toHaveBeenCalledExactlyOnceWith([{ ...stroke, points: [
      { x: 20, y: 40 }, { x: 800, y: 0 }, { x: 800, y: 600 },
    ] }])
  })

  it('imperatively flushes once, releases active capture and preserves the next stroke', () => {
    const onChange = vi.fn(), ref = createRef<DrawingCanvasHandle>()
    render(<DrawingCanvas ref={ref} id="deferred" config={config} strokes={[]} onChange={onChange} />)
    mode('stylus')
    const canvas = surface()
    pointer(canvas, 'pointerdown', 'pen', 31)
    pointer(canvas, 'pointermove', 'pen', 31, 40, 60)
    const first = { ...stroke, points: stroke.points.slice(0, 2) }
    act(() => { expect(ref.current!.flushPendingStroke()).toEqual([first]) })
    expect(canvas.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(31)
    act(() => { expect(ref.current!.flushPendingStroke()).toEqual([first]) })
    expect(onChange).toHaveBeenCalledTimes(1)
    pointer(canvas, 'pointerdown', 'pen', 31)
    pointer(canvas, 'lostpointercapture', 'pen', 31)
    pointer(canvas, 'pointermove', 'pen', 31, 40, 60)
    pointer(canvas, 'pointerup', 'pen', 31, 50, 70)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith([first, stroke])
  })
})

describe('deferred controlled acknowledgement', () => {
  // The parent deliberately keeps the same strokes prop until rerender. React
  // act/fireEvent can render local toolbar state but cannot acknowledge ink.
  it('emits A plus B before the parent supplies either stroke back', () => {
    const onChange = vi.fn(), initial: DrawingStroke[] = []
    const view = render(<DrawingCanvas id="deferred" config={config} strokes={initial} onChange={onChange} />)
    mode('stylus')
    const canvas = surface()
    draw(canvas, 'pen', 31)
    expect(onChange).toHaveBeenCalledExactlyOnceWith([stroke])
    draw(canvas, 'pen', 31)
    expect(onChange).toHaveBeenLastCalledWith([stroke, stroke])
    const acknowledged = onChange.mock.lastCall![0] as DrawingStroke[]
    view.rerender(<DrawingCanvas id="deferred" config={config} strokes={acknowledged} onChange={onChange} />)
    draw(canvas, 'pen', 31)
    expect(onChange).toHaveBeenLastCalledWith([stroke, stroke, stroke])
  })

  it('repaints pending B when the parent acknowledges A', () => {
    const onChange = vi.fn(), replay = vi.spyOn(drawing, 'replayDrawing')
    const view = render(<DrawingCanvas id="deferred" config={config} strokes={[]} onChange={onChange} />)
    mode('stylus')
    const canvas = surface()
    draw(canvas, 'pen', 31)
    const first = onChange.mock.lastCall![0] as DrawingStroke[]
    pointer(canvas, 'pointerdown', 'pen', 31)
    pointer(canvas, 'pointermove', 'pen', 31, 40, 60)
    view.rerender(<DrawingCanvas id="deferred" config={config} strokes={first} onChange={onChange} />)
    expect(replay).toHaveBeenLastCalledWith(context, config, [stroke, { ...stroke, points: stroke.points.slice(0, 2) }])
    pointer(canvas, 'pointerup', 'pen', 31, 50, 70)
    expect(onChange).toHaveBeenLastCalledWith([stroke, stroke])
  })

  it('keeps four unacknowledged strokes available to undo, redo, export and clear', async () => {
    const onChange = vi.fn(), download = vi.spyOn(drawing, 'downloadDrawingPng').mockResolvedValue(undefined)
    const replay = vi.spyOn(drawing, 'replayDrawing')
    render(<DrawingCanvas id="deferred" config={config} strokes={[]} onChange={onChange} />)
    mode('stylus')
    const canvas = surface()
    // One batch additionally prevents React renders between the four commits.
    act(() => { for (let i = 0; i < 4; i++) draw(canvas, 'pen', 31) })
    expect(onChange).toHaveBeenCalledTimes(4)
    expect(onChange).toHaveBeenLastCalledWith([stroke, stroke, stroke, stroke])
    fireEvent.click(screen.getByRole('button', { name: '復原' }))
    expect(onChange).toHaveBeenLastCalledWith([stroke, stroke, stroke])
    expect(replay).toHaveBeenLastCalledWith(context, config, [stroke, stroke, stroke])
    fireEvent.click(screen.getByRole('button', { name: '重做' }))
    expect(onChange).toHaveBeenLastCalledWith([stroke, stroke, stroke, stroke])
    expect(replay).toHaveBeenLastCalledWith(context, config, [stroke, stroke, stroke, stroke])
    fireEvent.click(screen.getByRole('button', { name: '匯出 PNG' }))
    expect(download).toHaveBeenCalledExactlyOnceWith(config, [stroke, stroke, stroke, stroke], 'deferred.png')
    await screen.findByText('PNG 已匯出。')
    fireEvent.click(screen.getByRole('button', { name: '清除畫布' }))
    fireEvent.click(screen.getByRole('button', { name: '確認清除' }))
    expect(onChange).toHaveBeenLastCalledWith([])
    expect(replay).toHaveBeenLastCalledWith(context, config, [])
    expect(screen.getByRole('button', { name: '重做' })).toBeDisabled()
    draw(canvas, 'pen', 31)
    expect(onChange).toHaveBeenLastCalledWith([stroke])
  })

  it('uses an external replacement or clear as authority for the next local stroke', () => {
    const onChange = vi.fn()
    const view = render(<DrawingCanvas id="deferred" config={config} strokes={[]} onChange={onChange} />)
    mode('stylus')
    const canvas = surface()
    draw(canvas, 'pen', 31)
    const external = { ...stroke, color: '#c03535' as const }
    view.rerender(<DrawingCanvas id="deferred" config={config} strokes={[external]} onChange={onChange} />)
    draw(canvas, 'pen', 31)
    expect(onChange).toHaveBeenLastCalledWith([external, stroke])
    view.rerender(<DrawingCanvas id="deferred" config={config} strokes={[]} onChange={onChange} />)
    draw(canvas, 'pen', 31)
    expect(onChange).toHaveBeenLastCalledWith([stroke])
  })
})
