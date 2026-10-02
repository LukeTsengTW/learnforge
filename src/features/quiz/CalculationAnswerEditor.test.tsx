// @vitest-environment jsdom
import { createRef, useState, type Ref } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CalculationAnswerV4 } from '../../models/attempt'
import type { DrawingStroke } from '../../models/drawing'
import type { CalculationQuestion } from '../../models/quiz'
import { CalculationAnswerEditor } from './CalculationAnswerEditor'
import { DrawingCanvas, type DrawingCanvasHandle } from './DrawingCanvas'
import { QuestionInput } from './QuestionInput'
import { quizCatalog } from './quiz-loader'

const config = { width: 800, height: 600 }
const textOnly: CalculationQuestion = {
  id: 'calculation-fixture', type: 'calculation', tags: [], points: 6, prompt: '求 x。', hint: null,
  solution: 'x = 3', referenceAnswer: 'x = 3', rubric: [{ description: '推導正確', score: 6 }],
}
const capable = { ...textOnly, drawing: config }
const first: DrawingStroke = { tool: 'pen', color: '#202b38', width: 4, points: [{ x: 20, y: 40 }, { x: 60, y: 80 }] }
const second: DrawingStroke = { ...first, points: [{ x: 100, y: 120 }, { x: 160, y: 180 }] }
const draft: CalculationAnswerV4 = { type: 'calculation', mode: 'text', text: '  $x = 3$\n\n', strokes: [first] }
const makeContext = () => ({
  save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
  moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
})
let context: ReturnType<typeof makeContext>

beforeEach(() => {
  context = makeContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 10, top: 20, width: 400, height: 300, right: 410, bottom: 320, x: 10, y: 20, toJSON: () => ({}),
  })
})
afterEach(cleanup)

function pointer(element: HTMLCanvasElement, type: string, x = 20, y = 40, pointerId = 7) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperties(event, { pointerId: { value: pointerId }, isPrimary: { value: true } })
  fireEvent(element, event)
}

function getCanvas() {
  const element = screen.getByRole('img', { name: '繪圖作答區' }) as HTMLCanvasElement
  const captures = new Set<number>()
  element.setPointerCapture = vi.fn((id: number) => { captures.add(id) })
  element.hasPointerCapture = vi.fn((id: number) => captures.has(id))
  element.releasePointerCapture = vi.fn((id: number) => {
    captures.delete(id)
    // Browsers emit this when capture is released; the commit must not happen twice.
    pointer(element, 'lostpointercapture', 0, 0, id)
  })
  return element
}

function EditorHarness({ initial = draft, question = capable, onChange = vi.fn() }: {
  initial?: CalculationAnswerV4
  question?: CalculationQuestion
  onChange?: (value: CalculationAnswerV4) => void
}) {
  const [value, setValue] = useState(initial)
  return <CalculationAnswerEditor id="answer" question={question} value={value} onChange={(next) => {
    onChange(next)
    setValue(next)
  }} />
}

describe('standalone calculation editor', () => {
  it('keeps the text-only textarea contract and never exposes handwriting without capability', () => {
    const onChange = vi.fn()
    const initial = { ...draft, strokes: [] }
    render(<EditorHarness question={textOnly} initial={initial} onChange={onChange} />)
    expect(screen.queryByRole('group', { name: '本題作答方式' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    const input = screen.getByRole('textbox', { name: '你的推導過程' })
    expect(input).toHaveAttribute('rows', '8')
    expect(input).toHaveAttribute('maxlength', '100000')
    expect(input).toHaveValue(draft.text)
    fireEvent.change(input, { target: { value: '  $$x = 3$$\n' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...initial, text: '  $$x = 3$$\n' })
  })

  it('cannot show handwriting even if a parent supplies drawing mode without capability', () => {
    render(<EditorHarness question={textOnly} initial={{ ...draft, mode: 'drawing' }} />)
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '你的推導過程' })).toHaveValue(draft.text)
  })

  it.each(['text', 'drawing'] as const)('respects the supplied %s mode and only mounts the active panel', (mode) => {
    render(<EditorHarness initial={{ ...draft, mode }} />)
    expect(screen.getByRole('group', { name: '本題作答方式' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '打字' })).toHaveProperty('checked', mode === 'text')
    expect(screen.getByRole('radio', { name: '手寫' })).toHaveProperty('checked', mode === 'drawing')
    expect(screen.getByText(`目前作答方式：${mode === 'text' ? '打字' : '手寫'}。`)).toHaveAttribute('role', 'status')
    if (mode === 'text') {
      expect(screen.getByRole('textbox', { name: '你的推導過程' })).toHaveValue(draft.text)
      expect(screen.queryByRole('button', { name: '畫筆' })).not.toBeInTheDocument()
    } else {
      const canvas = getCanvas()
      expect(canvas).toHaveAttribute('width', '800')
      expect(canvas).toHaveAttribute('height', '600')
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(context.clearRect).toHaveBeenLastCalledWith(0, 0, 800, 600)
    }
  })

  it('keeps the parent value authoritative for text and mode updates', async () => {
    const user = userEvent.setup(), onChange = vi.fn()
    render(<CalculationAnswerEditor id="answer" question={capable} value={draft} onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: '你的推導過程' })
    fireEvent.change(input, { target: { value: 'x = 4' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...draft, text: 'x = 4' })
    expect(onChange.mock.calls.at(-1)![0].strokes).toBe(draft.strokes)
    expect(input).toHaveValue(draft.text)
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...draft, mode: 'drawing' })
    expect(screen.getByRole('radio', { name: '打字' })).toBeChecked()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('preserves exact Markdown, LaTeX and whitespace through a mode round trip', async () => {
    const user = userEvent.setup(), onChange = vi.fn()
    const text = '  推導 **步驟**\n$x = \\frac{6}{2}$\n\n  '
    render(<EditorHarness initial={{ ...draft, text: '' }} onChange={onChange} />)
    await user.click(screen.getByRole('textbox', { name: '你的推導過程' }))
    await user.paste(text)
    expect(onChange).toHaveBeenLastCalledWith({ ...draft, text })
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...draft, text, mode: 'drawing' })
    await user.click(screen.getByRole('radio', { name: '打字' }))
    expect(screen.getByRole('textbox', { name: '你的推導過程' })).toHaveValue(text)
    expect(onChange).toHaveBeenLastCalledWith({ ...draft, text })
  })

  it('changes only mode and retains the same text and stroke structure through both switches', async () => {
    const user = userEvent.setup(), onChange = vi.fn()
    const initial = { ...draft, mode: 'drawing' as const, strokes: [first, second] }
    const before = JSON.stringify(initial)
    render(<EditorHarness initial={initial} onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: '打字' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...initial, mode: 'text' })
    expect(onChange.mock.calls.at(-1)![0].strokes).toBe(initial.strokes)
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    expect(onChange).toHaveBeenLastCalledWith(initial)
    expect(context.lineTo).toHaveBeenLastCalledWith(160, 180)
    expect(JSON.stringify(initial)).toBe(before)
  })

  it('uses native radio tab and arrow-key behavior with a discoverable checked state', async () => {
    const user = userEvent.setup(), onChange = vi.fn()
    render(<EditorHarness onChange={onChange} />)
    const text = screen.getByRole('radio', { name: '打字' }), drawing = screen.getByRole('radio', { name: '手寫' })
    expect(text).toHaveAttribute('type', 'radio')
    expect(drawing).toHaveAttribute('name', text.getAttribute('name'))
    await user.tab()
    expect(text).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(drawing).toHaveFocus()
    expect(drawing).toBeChecked()
    expect(text).not.toBeChecked()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await user.tab()
    expect(screen.getByRole('button', { name: '畫筆' })).toHaveFocus()
    await user.click(text)
    await user.tab()
    expect(screen.getByRole('textbox', { name: '你的推導過程' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: '畫筆' })).not.toBeInTheDocument()
  })

  it('updates drawing strokes while retaining text, mode and the calculation answer type', () => {
    const onChange = vi.fn(), initial = { ...draft, mode: 'drawing' as const }
    render(<EditorHarness initial={initial} onChange={onChange} />)
    const canvas = getCanvas()
    pointer(canvas, 'pointerdown')
    pointer(canvas, 'pointermove', 40, 60)
    pointer(canvas, 'pointerup', 50, 70)
    expect(onChange).toHaveBeenLastCalledWith({ ...initial, strokes: [first, {
      ...first, points: [{ x: 20, y: 40 }, { x: 60, y: 80 }, { x: 80, y: 100 }],
    }] })
  })

  it.each([false, true])('commits visibly begun ink before a keyboard mode switch (moved=%s)', async (moved) => {
    const user = userEvent.setup(), onChange = vi.fn()
    const initial = { ...draft, mode: 'drawing' as const }
    render(<EditorHarness initial={initial} onChange={onChange} />)
    screen.getByRole('radio', { name: '手寫' }).focus()
    const canvas = getCanvas()
    pointer(canvas, 'pointerdown')
    if (moved) pointer(canvas, 'pointermove', 40, 60)
    expect(moved ? context.stroke : context.fill).toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    await user.keyboard('{ArrowLeft}')
    const strokes = [first, { ...first, points: moved ? first.points : [first.points[0]] }]
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange.mock.calls[0][0]).toEqual({ ...initial, strokes })
    expect(onChange).toHaveBeenLastCalledWith({ ...initial, mode: 'text', strokes })
    expect(canvas.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(7)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...initial, strokes })
  })

  it('retains visible strokes but resets local redo history when the canvas is remounted', async () => {
    const user = userEvent.setup(), onChange = vi.fn()
    const initial = { ...draft, mode: 'drawing' as const, strokes: [first, second] }
    render(<EditorHarness initial={initial} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '復原' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...initial, strokes: [first] })
    expect(screen.getByRole('button', { name: '重做' })).toBeEnabled()
    await user.click(screen.getByRole('radio', { name: '打字' }))
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...initial, strokes: [first] })
    expect(context.lineTo).toHaveBeenLastCalledWith(60, 80)
    expect(screen.getByRole('button', { name: '復原' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '重做' })).toBeDisabled()
  })

  it('keeps historical demo q6 and its legacy calculation writer text-only', () => {
    // demo/v2-handwriting is now current and declares q6 handwriting; v1-7d7c900e stays text-only.
    expect(quizCatalog.getCurrentQuiz('demo')!.questions.find((item) => item.id === 'q6'))
      .toMatchObject({ type: 'calculation', drawing: { width: 800, height: 600 } })
    const question = quizCatalog.getQuizRevision('demo', 'v1-7d7c900e')!.questions.find((item) => item.id === 'q6')!
    expect(question.type).toBe('calculation')
    expect(question).not.toHaveProperty('drawing')
    const onChange = vi.fn()
    render(<QuestionInput question={question} answer={{ type: 'calculation', text: draft.text }} onChange={onChange} />)
    expect(screen.getByText('提交後會依評分規準由 AI 自動評分並納入本次練習得分。AI 自動評分僅供學習參考，可能存在誤判。')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '你的推導過程' }), { target: { value: 'x = 3' } })
    expect(onChange).toHaveBeenLastCalledWith({ type: 'calculation', text: 'x = 3' })
  })

  it('does not integrate the future editor into the production QuestionInput gate', () => {
    const onChange = vi.fn()
    render(<QuestionInput question={capable} answer={undefined} onChange={onChange} />)
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '你的推導過程' }), { target: { value: 'x = 3' } })
    expect(onChange).toHaveBeenLastCalledWith({ type: 'calculation', text: 'x = 3' })
  })
})

function CanvasHarness({ initial = [], onChange, canvasRef }: {
  initial?: DrawingStroke[]
  onChange: (strokes: DrawingStroke[]) => void
  canvasRef?: Ref<DrawingCanvasHandle>
}) {
  const [strokes, setStrokes] = useState(initial)
  return <DrawingCanvas ref={canvasRef} id="drawing" config={config} strokes={strokes} onChange={(next) => {
    onChange(next)
    setStrokes(next)
  }} />
}

describe('DrawingCanvas flush and existing drawing regressions', () => {
  it('commits an ordinary pen stroke once and retains pointer capture until finish', () => {
    const onChange = vi.fn()
    render(<CanvasHarness onChange={onChange} />)
    const canvas = getCanvas()
    pointer(canvas, 'pointerdown')
    expect(canvas.setPointerCapture).toHaveBeenCalledExactlyOnceWith(7)
    pointer(canvas, 'pointermove', 40, 60, 8)
    pointer(canvas, 'pointerup', 50, 70, 8)
    expect(onChange).not.toHaveBeenCalled()
    expect(canvas.releasePointerCapture).not.toHaveBeenCalled()
    pointer(canvas, 'pointermove', 40, 60)
    pointer(canvas, 'pointerup', 50, 70)
    expect(onChange).toHaveBeenCalledExactlyOnceWith([{ ...first, points: [
      { x: 20, y: 40 }, { x: 60, y: 80 }, { x: 80, y: 100 },
    ] }])
    expect(canvas.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(7)
  })

  it.each(['pointercancel', 'lostpointercapture'])('preserves pending points once on %s', (event) => {
    const onChange = vi.fn()
    render(<CanvasHarness onChange={onChange} />)
    const canvas = getCanvas()
    pointer(canvas, 'pointerdown')
    pointer(canvas, 'pointermove', 40, 60)
    pointer(canvas, event, 400, 300)
    expect(onChange).toHaveBeenCalledExactlyOnceWith([first])
    pointer(canvas, 'pointerup', 50, 70)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('returns current committed strokes without notifying again when no pointer is pending', () => {
    const onChange = vi.fn(), canvasRef = createRef<DrawingCanvasHandle>()
    render(<CanvasHarness initial={[first]} onChange={onChange} canvasRef={canvasRef} />)
    let flushed: DrawingStroke[] = []
    act(() => { flushed = canvasRef.current!.flushPendingStroke() })
    expect(flushed).toEqual([first])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps undo and redo operational within the mounted canvas', async () => {
    const user = userEvent.setup(), onChange = vi.fn()
    render(<CanvasHarness initial={[first, second]} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '復原' }))
    expect(onChange).toHaveBeenLastCalledWith([first])
    await user.click(screen.getByRole('button', { name: '重做' }))
    expect(onChange).toHaveBeenLastCalledWith([first, second])
    expect(screen.getByRole('button', { name: '重做' })).toBeDisabled()
  })

  it('clears only after confirmation and clears undo/redo history', async () => {
    const user = userEvent.setup(), onChange = vi.fn()
    render(<CanvasHarness initial={[first, second]} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '復原' }))
    await user.click(screen.getByRole('button', { name: '清除畫布' }))
    await user.click(screen.getByRole('button', { name: '保留畫布' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: '清除畫布' }))
    await user.click(screen.getByRole('button', { name: '確認清除' }))
    expect(onChange).toHaveBeenLastCalledWith([])
    expect(screen.getByRole('button', { name: '復原' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '重做' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '清除畫布' })).toBeDisabled()
  })

  it('preserves the existing DrawingQuestion answer onChange shape', () => {
    const question = { ...capable, type: 'drawing' as const }, onChange = vi.fn()
    render(<QuestionInput question={question} answer={{ type: 'drawing', strokes: [] }} onChange={onChange} />)
    const canvas = getCanvas()
    pointer(canvas, 'pointerdown')
    pointer(canvas, 'pointermove', 40, 60)
    pointer(canvas, 'pointercancel')
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ type: 'drawing', strokes: [first] })
  })
})
