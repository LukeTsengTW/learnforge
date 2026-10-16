// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { DrawingStroke } from '../../models/drawing'
import { DrawingCanvas } from './DrawingCanvas'

beforeEach(() => {
  localStorage.clear()
  const context = Object.fromEntries(['save', 'restore', 'clearRect', 'beginPath', 'arc', 'fill', 'moveTo', 'lineTo', 'stroke', 'drawImage']
    .map(key => [key, vi.fn()]))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); document.documentElement.style.overflow = '' })

function Harness() {
  const [ink, setInk] = useState<DrawingStroke[]>([])
  return <DrawingCanvas id="icons" config={{ width: 800, height: 600 }} strokes={ink} onChange={setInk} />
}
/** An icon button: named by aria-label, a tooltip with the same name, no visible text, one decorative SVG. */
function expectIconButton(name: string, title = name) {
  const button = screen.getByRole('button', { name })
  expect(button).toHaveAttribute('title', title)
  expect(button).toHaveClass('icon-button')
  expect(button.textContent).toBe('')
  const icons = button.querySelectorAll('svg')
  expect(icons).toHaveLength(1)
  expect(icons[0]).toHaveAttribute('aria-hidden', 'true')
  expect(icons[0]).toHaveAttribute('focusable', 'false')
  return button
}

describe('drawing toolbar icons', () => {
  it('shows the tools as icons named by their label and tooltip', () => {
    render(<Harness />)
    for (const name of ['畫筆', '橡皮擦', '復原', '重做', '放大書寫']) expectIconButton(name)
    // Pressed and disabled states are unchanged.
    expect(screen.getByRole('button', { name: '畫筆' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '復原' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '橡皮擦' }))
    expect(screen.getByRole('button', { name: '橡皮擦' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches the enlarge icon while enlarged and shows the move tool as an icon; zoom levels keep their text', () => {
    render(<Harness />)
    const enlarge = screen.getByRole('button', { name: '放大書寫' })
    const before = enlarge.innerHTML
    fireEvent.click(enlarge)
    const exit = expectIconButton('結束放大', '結束放大（Esc）')
    expect(exit.innerHTML).not.toBe(before)
    expect(screen.getByRole('button', { name: '縮放 2 倍' })).toHaveTextContent('2×')
    fireEvent.click(screen.getByRole('button', { name: '縮放 2 倍' }))
    expectIconButton('移動畫面')
    // Leaving enlarged writing brings back the enlarge icon and name.
    fireEvent.click(exit)
    expect(expectIconButton('放大書寫').innerHTML).toBe(before)
  })

  it('keeps the colours, zoom levels, input mode and the actions below the canvas as they were', () => {
    render(<Harness />)
    expect(screen.getAllByRole('button').filter(button => button.classList.contains('icon-button'))
      .map(button => button.getAttribute('aria-label'))).toEqual(['畫筆', '橡皮擦', '復原', '重做', '放大書寫'])
    for (const name of ['清除畫布', '匯出 PNG']) expect(screen.getByRole('button', { name })).toHaveTextContent(name)
    expect(screen.getByRole('combobox', { name: '輸入方式' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '放大書寫' }))
    for (const level of ['1', '1.5', '2']) expect(screen.getByRole('button', { name: `縮放 ${level} 倍` })).not.toHaveClass('icon-button')
  })
})
