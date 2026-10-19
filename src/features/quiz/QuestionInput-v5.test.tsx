// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CalculationAnswerV5 } from '../../models/attempt'
import type { PracticeAnswerV5 } from '../../models/draft-v4'
import type { CalculationQuestion } from '../../models/quiz'
import { emptyCalculationAnswerV5 } from '../../lib/draft-v5'
import { QuestionInput } from './QuestionInput'
import { pen, v4Quiz } from './practice-v4.test-helper'

vi.mock('../ai/AiTutorControls', () => ({ AiTutorControls: () => <div data-testid="ai-tutor-controls" /> }))
vi.mock('../../lib/drawing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/drawing')>()
  return { ...actual, downloadDrawingPng: vi.fn(async () => {}) }
})
import { downloadDrawingPng } from '../../lib/drawing'
const capable = v4Quiz.questions.find((question) => question.id === 'q_hand') as CalculationQuestion
const textOnly = v4Quiz.questions.find((question) => question.id === 'q_text') as CalculationQuestion

beforeEach(() => {
  const context = { save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function pointer(element: Element, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperties(event, { pointerId: { value: 3 }, isPrimary: { value: true } })
  fireEvent(element, event)
}

function attachPointerCapture(canvas: Element) {
  Object.assign(canvas, { setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn() })
}

function Harness({ initial = emptyCalculationAnswerV5(true), onChange = vi.fn() }: {
  initial?: CalculationAnswerV5; onChange?: (answer: PracticeAnswerV5) => void
}) {
  const [answer, setAnswer] = useState<PracticeAnswerV5>(initial)
  return <QuestionInput question={capable} answer={answer} draftSchema={3}
    onChange={(next) => { setAnswer(next); onChange(next); return 'accepted' }} />
}

function drawingCanvas() { return screen.getByRole('img', { name: /手寫作答區/ }) }

describe('M6 schema-3 paged handwriting input', () => {
  it('keeps text-only calculations on the canonical empty-pages answer shape', async () => {
    const onChange = vi.fn()
    render(<QuestionInput question={textOnly} answer={undefined} draftSchema={3}
      onChange={(answer) => { onChange(answer); return 'accepted' }} />)
    expect(screen.queryByRole('radio')).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: '你的推導過程' }), { target: { value: 'typed work' } })
    expect(onChange).toHaveBeenLastCalledWith({ type: 'calculation', mode: 'text', text: 'typed work', pages: [] })
    expect(screen.queryByRole('button', { name: '新增一頁' })).toBeNull()
  })

  it('keeps strokes on their page while navigating and adding pages', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: '手寫' }))

    const firstCanvas = drawingCanvas()
    attachPointerCapture(firstCanvas)
    pointer(firstCanvas, 'pointerdown', 10, 10)
    pointer(firstCanvas, 'pointermove', 40, 35)
    pointer(firstCanvas, 'pointerup', 60, 55)
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ mode: 'drawing', pages: [[expect.any(Object)]] })

    await user.click(screen.getByRole('button', { name: '新增一頁' }))
    expect(screen.getByRole('status', { name: '手寫頁面狀態' })).toHaveTextContent('第 2 頁，共 2 頁')
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ pages: [[expect.any(Object)], []] })

    const secondCanvas = drawingCanvas()
    attachPointerCapture(secondCanvas)
    pointer(secondCanvas, 'pointerdown', 20, 20)
    pointer(secondCanvas, 'pointermove', 50, 45)
    pointer(secondCanvas, 'pointerup', 70, 65)
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ pages: [[expect.any(Object)], [expect.any(Object)]] })

    await user.click(screen.getByRole('button', { name: '上一頁' }))
    expect(screen.getByRole('status', { name: '手寫頁面狀態' })).toHaveTextContent('第 1 頁，共 2 頁')
    await user.click(screen.getByRole('button', { name: '下一頁' }))
    expect(screen.getByRole('status', { name: '手寫頁面狀態' })).toHaveTextContent('第 2 頁，共 2 頁')
  })

  it('flushes an in-progress stroke to the old page before navigating', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    const canvas = drawingCanvas()
    attachPointerCapture(canvas)
    pointer(canvas, 'pointerdown', 10, 10)
    pointer(canvas, 'pointermove', 40, 40)

    await user.click(screen.getByRole('button', { name: '新增一頁' }))
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ pages: [[expect.any(Object)], []] })
    expect(screen.getByRole('status', { name: '手寫頁面狀態' })).toHaveTextContent('第 2 頁，共 2 頁')
  })

  it('flushes the active page before switching or confirming its deletion', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial={{ type: 'calculation', mode: 'drawing', text: '', pages: [[], []] }} onChange={onChange} />)
    const firstCanvas = drawingCanvas()
    attachPointerCapture(firstCanvas)
    pointer(firstCanvas, 'pointerdown', 10, 10)
    pointer(firstCanvas, 'pointermove', 40, 40)
    await user.click(screen.getByRole('button', { name: '下一頁' }))
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ pages: [[expect.any(Object)], []] })
    expect(screen.getByRole('status', { name: '手寫頁面狀態' })).toHaveTextContent('第 2 頁，共 2 頁')

    const secondCanvas = drawingCanvas()
    attachPointerCapture(secondCanvas)
    pointer(secondCanvas, 'pointerdown', 20, 20)
    pointer(secondCanvas, 'pointermove', 50, 50)
    await user.click(screen.getByRole('button', { name: '刪除本頁' }))
    expect(screen.getByRole('button', { name: '確認刪除本頁' })).toBeInTheDocument()
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ pages: [[expect.any(Object)], [expect.any(Object)]] })
    await user.click(screen.getByRole('button', { name: '確認刪除本頁' }))
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ pages: [[expect.any(Object)]] })
  })

  it('limits the answer to six pages and never deletes the final page', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    const add = screen.getByRole('button', { name: '新增一頁' })
    for (let index = 0; index < 5; index++) await user.click(add)
    expect(screen.getByRole('status', { name: '手寫頁面狀態' })).toHaveTextContent('第 6 頁，共 6 頁')
    expect(screen.getByRole('status', { name: '手寫頁面狀態' })).toHaveTextContent('已達 6 頁上限')
    expect(add).toBeDisabled()
    expect(screen.getByRole('button', { name: '刪除本頁' })).toBeEnabled()

    for (let index = 0; index < 5; index++) await user.click(screen.getByRole('button', { name: '刪除本頁' }))
    expect(screen.getByRole('status', { name: '手寫頁面狀態' })).toHaveTextContent('第 1 頁，共 1 頁')
    expect(screen.getByRole('button', { name: '刪除本頁' })).toBeDisabled()
  })

  it('asks before deleting a page containing strokes', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial={{ type: 'calculation', mode: 'drawing', text: '', pages: [[pen()], []] }} onChange={onChange} />)
    expect(screen.getByRole('status', { name: '手寫頁面狀態' })).toHaveTextContent('第 1 頁，共 2 頁')
    await user.click(screen.getByRole('button', { name: '刪除本頁' }))
    expect(screen.getByRole('button', { name: '確認刪除本頁' })).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '確認刪除本頁' }))
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ pages: [[]] })
    expect(screen.getByRole('status', { name: '手寫頁面狀態' })).toHaveTextContent('第 1 頁，共 1 頁')
  })

  it('keeps undo and redo history isolated per page', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    const firstCanvas = drawingCanvas()
    attachPointerCapture(firstCanvas)
    pointer(firstCanvas, 'pointerdown', 10, 10); pointer(firstCanvas, 'pointermove', 40, 40); pointer(firstCanvas, 'pointerup', 50, 50)
    await user.click(screen.getByRole('button', { name: '新增一頁' }))

    expect(screen.getByRole('button', { name: '復原' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '重做' })).toBeDisabled()
    const secondCanvas = drawingCanvas()
    attachPointerCapture(secondCanvas)
    pointer(secondCanvas, 'pointerdown', 20, 20); pointer(secondCanvas, 'pointermove', 50, 50); pointer(secondCanvas, 'pointerup', 60, 60)
    await user.click(screen.getByRole('button', { name: '復原' }))
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ pages: [[expect.any(Object)], []] })
    expect(screen.getByRole('button', { name: '重做' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: '上一頁' }))
    expect(screen.getByRole('button', { name: '復原' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '重做' })).toBeDisabled()
  })

  it('keeps page controls available inside expanded writing mode', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    await user.click(screen.getByRole('button', { name: '放大書寫' }))
    const dialog = screen.getByRole('dialog', { name: '放大書寫' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新增一頁' })).toBeInTheDocument()
    expect(within(dialog).getByRole('status', { name: '手寫頁面狀態' })).toHaveTextContent('第 1 頁，共 1 頁')
    await user.click(screen.getByRole('button', { name: '新增一頁' }))
    expect(within(dialog).getByRole('status', { name: '手寫頁面狀態' })).toHaveTextContent('第 2 頁，共 2 頁')
    const canvas = drawingCanvas()
    attachPointerCapture(canvas)
    pointer(canvas, 'pointerdown', 10, 10)
    pointer(canvas, 'pointermove', 40, 40)
    pointer(canvas, 'pointerup', 60, 60)
    await user.click(screen.getByRole('button', { name: '刪除本頁' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('刪除本頁後')
    await user.click(within(dialog).getByRole('button', { name: '確認刪除本頁' }))
    expect(within(dialog).getByRole('status', { name: '手寫頁面狀態' })).toHaveTextContent('第 1 頁，共 1 頁')
    expect(screen.getByRole('dialog', { name: '放大書寫' })).toBeInTheDocument()
  })

  it('keeps drawing preferences when switching pages', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    await user.click(screen.getByRole('button', { name: '紅色' }))
    await user.click(screen.getByRole('button', { name: '橡皮擦' }))
    await user.selectOptions(screen.getByLabelText('輸入方式'), 'stylus')
    fireEvent.change(screen.getByLabelText('橡皮擦大小'), { target: { value: '31' } })
    await user.click(screen.getByRole('button', { name: '新增一頁' }))

    expect(screen.getByRole('button', { name: '紅色' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '橡皮擦' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('輸入方式')).toHaveValue('stylus')
    expect(screen.getByLabelText('橡皮擦大小')).toHaveValue('31')
  })

  it('exports the current page with its page index in the filename', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    await user.click(screen.getByRole('button', { name: '新增一頁' }))
    await user.click(screen.getByRole('button', { name: '匯出 PNG' }))
    expect(downloadDrawingPng).toHaveBeenCalledWith(capable.drawing, [], 'answer-q_hand-page-2.png')
  })

  it('shows the answer-wide drawing budget on the active page', async () => {
    const user = userEvent.setup()
    const otherPageStrokes = Array.from({ length: 12_000 }, () => pen())
    render(<Harness initial={{ type: 'calculation', mode: 'drawing', text: '', pages: [otherPageStrokes, []] }} />)
    await user.click(screen.getByRole('button', { name: '下一頁' }))
    expect(document.querySelector('.drawing-capacity')).toHaveTextContent('手寫容量幾乎用完')
  })
})
