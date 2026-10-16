// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { DrawingStroke } from '../../models/drawing'
import { DRAWING_COLLAPSED_STATUS, DRAWING_EXPANDED_STATUS, DrawingCanvas } from './DrawingCanvas'

const config = { width: 800, height: 600 }
beforeEach(() => {
  localStorage.clear()
  const context = Object.fromEntries(['save', 'restore', 'clearRect', 'beginPath', 'arc', 'fill', 'moveTo', 'lineTo', 'stroke', 'drawImage']
    .map(key => [key, vi.fn()]))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 10, top: 20, width: 400, height: 300, right: 410, bottom: 320, x: 10, y: 20, toJSON: () => ({}),
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); document.documentElement.style.overflow = '' })

function Harness({ id = 'enlarged', onChange = vi.fn() }: { id?: string, onChange?: (ink: DrawingStroke[]) => void }) {
  const [ink, setInk] = useState<DrawingStroke[]>([])
  return <DrawingCanvas id={id} config={config} strokes={ink} onChange={next => { onChange(next); setInk(next) }} />
}
const canvas = () => {
  const element = screen.getByRole('img', { name: '繪圖作答區' }) as HTMLCanvasElement
  element.setPointerCapture = vi.fn()
  element.hasPointerCapture = vi.fn(() => true)
  element.releasePointerCapture = vi.fn()
  return element
}
const editor = () => canvas().closest('.drawing-editor') as HTMLElement
const viewport = () => canvas().closest('.canvas-viewport') as HTMLElement
const frame = () => canvas().closest('.canvas-frame') as HTMLElement
// The editor's own live status line (the brush-width <output> is a status role too).
const statusLine = () => editor().querySelector('p.drawing-status') as HTMLElement
function pointer(target: HTMLElement, type: string, x: number, y: number, pointerId = 1, pointerType = 'mouse') {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperties(event, { pointerType: { value: pointerType }, pointerId: { value: pointerId }, isPrimary: { value: true } })
  fireEvent(target, event)
}
/** The viewport's border box, scrollbars included (what the fit is measured from). */
function outerBox(width: number, height: number) {
  viewport().getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width, height, right: width, bottom: height, toJSON: () => ({}) })
}
/** Gives the viewport a size (jsdom has no layout) before the enlarged editor measures it. */
function sizeViewport(width: number, height: number) {
  const element = viewport()
  outerBox(width, height)
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: height })
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: width })
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: height })
  let left = 0, top = 0
  Object.defineProperty(element, 'scrollLeft', { configurable: true, get: () => left, set: (value: number) => { left = value } })
  Object.defineProperty(element, 'scrollTop', { configurable: true, get: () => top, set: (value: number) => { top = value } })
}

describe('enlarged handwriting', () => {
  it('opens the editor over the page, locks page scrolling and returns with the button or Escape', () => {
    render(<Harness />)
    expect(editor()).not.toHaveClass('is-expanded')
    expect(screen.queryByRole('button', { name: '縮放 2 倍' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    expect(editor()).toHaveClass('is-expanded')
    expect(screen.getByRole('button', { name: '結束放大' })).toHaveAttribute('aria-pressed', 'true')
    expect(statusLine()).toHaveTextContent(DRAWING_EXPANDED_STATUS)
    expect(document.documentElement.style.overflow).toBe('hidden')
    for (const level of ['1', '1.5', '2']) expect(screen.getByRole('button', { name: `縮放 ${level} 倍` })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(editor()).not.toHaveClass('is-expanded')
    expect(document.documentElement.style.overflow).toBe('')
    expect(statusLine()).toHaveTextContent(DRAWING_COLLAPSED_STATUS)
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    fireEvent.click(screen.getByRole('button', { name: '結束放大' }))
    expect(editor()).not.toHaveClass('is-expanded')
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('restores the page scrolling it locked when the editor unmounts while enlarged', () => {
    document.documentElement.style.overflow = 'clip'
    const view = render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    expect(document.documentElement.style.overflow).toBe('hidden')
    view.unmount()
    expect(document.documentElement.style.overflow).toBe('clip')
  })

  it('fits the whole canvas in the window at 1× and magnifies it by the chosen zoom level', () => {
    render(<Harness />)
    expect(frame().style.width).toBe('')
    sizeViewport(1002, 702)
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    // 800×600 in a 1000×700 box (frame border excluded): limited by height, 700 × 4/3 = 933.3 → 933.
    expect(frame().style.width).toBe('935px')
    fireEvent.click(screen.getByRole('button', { name: '縮放 2 倍' }))
    expect(frame().style.width).toBe('1868px')
    expect(screen.getByRole('button', { name: '縮放 2 倍' })).toHaveAttribute('aria-pressed', 'true')
    expect(statusLine()).toHaveTextContent('書寫縮放 2×。')
    fireEvent.click(screen.getByRole('button', { name: '縮放 1.5 倍' }))
    expect(frame().style.width).toBe('1401.5px')
    // Leaving enlarged writing returns the canvas to the page's own width.
    fireEvent.click(screen.getByRole('button', { name: '結束放大' }))
    expect(frame().style.width).toBe('')
  })

  it('pans the magnified view without writing ink and keeps drawing mapped through the canvas rect', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    sizeViewport(1002, 702)
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    expect(screen.queryByRole('button', { name: '移動畫面' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '縮放 2 倍' }))
    fireEvent.click(screen.getByRole('button', { name: '移動畫面' }))
    expect(frame()).toHaveClass('is-panning')
    viewport().scrollLeft = 300
    viewport().scrollTop = 200
    pointer(canvas(), 'pointerdown', 100, 100)
    pointer(canvas(), 'pointermove', 60, 70)
    pointer(canvas(), 'pointerup', 40, 50)
    expect(viewport().scrollLeft).toBe(340)
    expect(viewport().scrollTop).toBe(230)
    expect(onChange).not.toHaveBeenCalled()
    // Back to the pen: the stroke maps through the canvas's on-screen rect (400×300 at 10,20 → 800×600).
    fireEvent.click(screen.getByRole('button', { name: '移動畫面' }))
    pointer(canvas(), 'pointerdown', 110, 70, 2, 'pen')
    pointer(canvas(), 'pointerup', 210, 170, 2, 'pen')
    expect(onChange).toHaveBeenCalledTimes(1)
    const [stroke] = onChange.mock.calls[0][0] as DrawingStroke[]
    expect(stroke.points[0]).toEqual({ x: 200, y: 100 })
    expect(stroke.points.at(-1)).toEqual({ x: 400, y: 300 })
    // Returning to 1× switches the pan tool off, so the next press writes again.
    fireEvent.click(screen.getByRole('button', { name: '移動畫面' }))
    fireEvent.click(screen.getByRole('button', { name: '縮放 1 倍' }))
    expect(screen.queryByRole('button', { name: '移動畫面' })).toBeNull()
    expect(frame()).not.toHaveClass('is-panning')
    pointer(canvas(), 'pointerdown', 50, 50, 3, 'pen')
    pointer(canvas(), 'pointerup', 60, 60, 3, 'pen')
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('measures the fit from the outer size, so scrollbars appearing at higher zoom do not change it', () => {
    render(<Harness />)
    sizeViewport(1002, 702)
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    fireEvent.click(screen.getByRole('button', { name: '縮放 2 倍' }))
    expect(frame().style.width).toBe('1868px')
    // Classic scrollbars take 17px from the client box only; the fit stays the same.
    Object.defineProperty(viewport(), 'clientWidth', { configurable: true, value: 985 })
    Object.defineProperty(viewport(), 'clientHeight', { configurable: true, value: 685 })
    fireEvent(window, new Event('resize'))
    expect(frame().style.width).toBe('1868px')
    // A real window resize still refits: 600×402 → min(600, 400 × 4/3 = 533.3) = 533 at 1×, 1066 at 2×.
    outerBox(602, 402)
    fireEvent(window, new Event('resize'))
    expect(frame().style.width).toBe('1068px')
    // A fractional box is floored, so the frame never overflows it by a fraction of a pixel: 402.6 → 402.
    outerBox(602.6, 402.6)
    fireEvent(window, new Event('resize'))
    expect(frame().style.width).toBe('1068px')
  })

  it('makes the page behind the enlarged editor inert and exposes the editor as a modal dialog', () => {
    render(<><button type="button">頁面按鈕</button><nav inert>已停用</nav><Harness /></>)
    const outside = screen.getByRole('button', { name: '頁面按鈕' })
    const alreadyInert = document.querySelector('nav') as HTMLElement
    expect(editor()).not.toHaveAttribute('role')
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    expect(outside).toHaveAttribute('inert')
    expect(editor()).not.toHaveAttribute('inert')
    expect(editor()).toHaveAttribute('role', 'dialog')
    expect(editor()).toHaveAttribute('aria-modal', 'true')
    expect(editor()).toHaveAttribute('aria-label', '放大書寫')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(outside).not.toHaveAttribute('inert')
    // Inertness the page set itself is left alone.
    expect(alreadyInert).toHaveAttribute('inert')
    expect(editor()).not.toHaveAttribute('role')
  })

  it('restores the page scrolling only after the last of two enlarged editors closes', () => {
    document.documentElement.style.overflow = 'clip'
    render(<><Harness id="first" /><Harness id="second" /></>)
    const [first, second] = screen.getAllByRole('button', { name: '放大書寫' })
    fireEvent.click(first)
    fireEvent.click(second)
    expect(document.documentElement.style.overflow).toBe('hidden')
    fireEvent.click(screen.getAllByRole('button', { name: '結束放大' })[0])
    expect(document.documentElement.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: '結束放大' }))
    expect(document.documentElement.style.overflow).toBe('clip')
  })

  it('commits a stroke in progress before Escape or a zoom change resizes the canvas, and returns to 1×', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    sizeViewport(1002, 702)
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    pointer(canvas(), 'pointerdown', 110, 70, 1, 'pen')
    pointer(canvas(), 'pointermove', 160, 120, 1, 'pen')
    fireEvent.click(screen.getByRole('button', { name: '縮放 2 倍' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0][0] as DrawingStroke[])[0].points.at(-1)).toEqual({ x: 300, y: 200 })
    // Samples after the commit belong to no stroke.
    pointer(canvas(), 'pointermove', 400, 300, 1, 'pen')
    pointer(canvas(), 'pointerup', 400, 300, 1, 'pen')
    expect(onChange).toHaveBeenCalledTimes(1)
    pointer(canvas(), 'pointerdown', 110, 70, 2, 'pen')
    pointer(canvas(), 'pointermove', 210, 170, 2, 'pen')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onChange).toHaveBeenCalledTimes(2)
    expect((onChange.mock.calls[1][0] as DrawingStroke[])).toHaveLength(2)
    expect(editor()).not.toHaveClass('is-expanded')
    // Enlarging again starts at 1×, without the pan tool.
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    expect(screen.getByRole('button', { name: '縮放 1 倍' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: '移動畫面' })).toBeNull()
  })

  it('commits a stroke in progress before enlarging', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    sizeViewport(1002, 702)
    pointer(canvas(), 'pointerdown', 110, 70, 1, 'pen')
    pointer(canvas(), 'pointermove', 160, 120, 1, 'pen')
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    expect(editor()).toHaveClass('is-expanded')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0][0] as DrawingStroke[])[0].points.at(-1)).toEqual({ x: 300, y: 200 })
    pointer(canvas(), 'pointerup', 400, 300, 1, 'pen')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('returns focus to the editor when it reaches content the page added while enlarged', () => {
    function Page() {
      const [notice, setNotice] = useState(false)
      return <>{notice && <a href="#/recovery">查看本機練習備份</a>}<button type="button" onClick={() => setNotice(true)}>同步失敗</button>
        <Harness /></>
    }
    render(<Page />)
    const trigger = screen.getByRole('button', { name: '同步失敗' })
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    // The page adds a notice after the editor was enlarged; it is not inert, but focus cannot stay on it.
    fireEvent.click(trigger)
    const link = screen.getByRole('link', { name: '查看本機練習備份' })
    link.focus()
    expect(screen.getByRole('button', { name: '結束放大' })).toHaveFocus()
    // Focus inside the editor stays where it is.
    screen.getByRole('button', { name: '縮放 2 倍' }).focus()
    expect(screen.getByRole('button', { name: '縮放 2 倍' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    link.focus()
    expect(link).toHaveFocus()
  })

  it('returns the page to its scroll position when enlarged writing ends, not on unmount', () => {
    const scrollTo = vi.mocked(window.scrollTo)
    const view = render(<Harness />)
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 1234 })
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    // The shorter page clamps the scroll position while enlarged.
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 900 })
    expect(scrollTo).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith(0, 1234)
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    view.unmount()
    expect(scrollTo).toHaveBeenCalledTimes(1)
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
  })

  it('ends a pan when the pointer is cancelled or loses capture', () => {
    render(<Harness />)
    sizeViewport(1002, 702)
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    fireEvent.click(screen.getByRole('button', { name: '縮放 2 倍' }))
    fireEvent.click(screen.getByRole('button', { name: '移動畫面' }))
    viewport().scrollLeft = 300
    pointer(canvas(), 'pointerdown', 100, 100)
    pointer(canvas(), 'pointercancel', 100, 100)
    pointer(canvas(), 'pointermove', 50, 100)
    expect(viewport().scrollLeft).toBe(300)
    const element = canvas()
    element.hasPointerCapture = vi.fn(() => false)
    pointer(element, 'pointerdown', 100, 100, 2)
    pointer(element, 'lostpointercapture', 100, 100, 2)
    pointer(element, 'pointermove', 50, 100, 2)
    expect(viewport().scrollLeft).toBe(300)
  })

  it('keeps the enlarged layout rules: fixed over the page and a scrolling viewport', () => {
    const css = readFileSync(resolve('src/styles/global.css'), 'utf8')
    expect(css).toMatch(/\.drawing-editor\.is-expanded\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0/)
    expect(css).toMatch(/\.drawing-editor\.is-expanded \.canvas-viewport\s*\{[^}]*overflow:\s*auto/)
    // The drawing surface keeps its gesture protection in both layouts.
    expect(css).toMatch(/\.canvas-frame,\s*\.drawing-canvas\s*\{[^}]*touch-action:\s*none/)
  })
})
