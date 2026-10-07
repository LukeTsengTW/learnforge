// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { DrawingStroke } from '../../models/drawing'
import * as drawing from '../../lib/drawing'
import { DRAWING_INPUT_MODE_KEY } from '../../lib/drawing-input-mode'
import { DrawingCanvas } from './DrawingCanvas'

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
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear() })

function Harness({ onChange = vi.fn() }: { onChange?: (ink: DrawingStroke[]) => void }) {
  const [ink, setInk] = useState<DrawingStroke[]>([])
  return <DrawingCanvas id="input-test" config={config} strokes={ink} onChange={next => { onChange(next); setInk(next) }} />
}
function surface() {
  const canvas = screen.getByRole('img', { name: '繪圖作答區' }) as HTMLCanvasElement
  const captures = new Set<number>()
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
}
function mode(value: 'standard' | 'stylus') {
  fireEvent.change(screen.getByRole('combobox', { name: '輸入方式' }), { target: { value } })
}
function draw(canvas: HTMLCanvasElement, type: string, id: number) {
  pointer(canvas, 'pointerdown', type, id)
  pointer(canvas, 'pointermove', type, id, 40, 60)
  pointer(canvas, 'pointerup', type, id, 50, 70)
}

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
    expect(canvas.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(11)
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
    expect(canvas.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(31)
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
