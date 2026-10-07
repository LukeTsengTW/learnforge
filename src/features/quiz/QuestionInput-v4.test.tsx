// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PracticeAnswer } from '../../models/draft-v4'
import type { CalculationQuestion } from '../../models/quiz'
import type { PendingInputFlush } from './attempt-context'
import { FORMAL_TEXT_LIMIT_NOTICE, QuestionInput } from './QuestionInput'
import { QuestionCard } from './QuestionCard'
import { pen, v3Quiz, v4Quiz } from './practice-v4.test-helper'
import { quizCatalog } from './quiz-loader'
import { requiresV4Draft } from '../../lib/draft-v4'

vi.mock('../ai/AiTutorControls', () => ({ AiTutorControls: () => <div data-testid="ai-tutor-controls" /> }))
const capable = v4Quiz.questions.find((question) => question.id === 'q_hand') as CalculationQuestion
const textOnly = v4Quiz.questions.find((question) => question.id === 'q_text') as CalculationQuestion
const legacyCalc = v3Quiz.questions.find((question) => question.id === 'q_hand') as CalculationQuestion

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

function Harness({ question, schema, initial, onChange, register }: {
  question: CalculationQuestion; schema: 1 | 2; initial?: PracticeAnswer
  onChange: (answer: PracticeAnswer) => void; register?: (flush: PendingInputFlush) => () => void
}) {
  const [answer, setAnswer] = useState<PracticeAnswer | undefined>(initial)
  return <QuestionInput question={question} answer={answer} draftSchema={schema} registerPendingFlush={register}
    onChange={(next) => { setAnswer(next); onChange(next) }} />
}

describe('M5 schema-aware calculation input', () => {
  it.each(['q2', 'q3', 'q4', 'q5', 'q6'])('renders both modes and retains both buffers for discrete-math/2 %s', async (id) => {
    const quiz = quizCatalog.getQuizRevision('discrete-math', '2')!
    expect(requiresV4Draft(quiz)).toBe(true)
    const question = quiz.questions.find((item) => item.id === id) as CalculationQuestion
    const user = userEvent.setup(), onChange = vi.fn()
    render(<Harness question={question} schema={2} onChange={onChange} />)
    expect(screen.getByRole('radio', { name: '打字' })).toBeChecked()
    fireEvent.change(screen.getByLabelText('你的推導過程'), { target: { value: '  $x = \\frac{6}{2}$\n' } })
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    const canvas = screen.getByRole('img', { name: '繪圖作答區' })
    expect(canvas).toHaveAttribute('width', '1200')
    expect(canvas).toHaveAttribute('height', '900')
    canvas.setPointerCapture = vi.fn(); canvas.hasPointerCapture = vi.fn(() => false); canvas.releasePointerCapture = vi.fn()
    pointer(canvas, 'pointerdown', 10, 10); pointer(canvas, 'pointermove', 50, 50); pointer(canvas, 'pointerup', 60, 60)
    const drawn = onChange.mock.lastCall![0]
    expect(drawn.strokes).toHaveLength(1)
    await user.click(screen.getByRole('radio', { name: '打字' }))
    expect(screen.getByLabelText('你的推導過程')).toHaveValue(drawn.text)
    expect(onChange).toHaveBeenLastCalledWith({ ...drawn, mode: 'text' })
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    expect(onChange).toHaveBeenLastCalledWith(drawn)
    cleanup()
    const historical = quizCatalog.getQuizRevision('discrete-math', '1')!
    expect(requiresV4Draft(historical)).toBe(false)
    render(<Harness question={historical.questions.find((item) => item.id === id) as CalculationQuestion}
      schema={1} onChange={vi.fn()} />)
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.getByLabelText('你的推導過程')).toBeInTheDocument()
  })

  it('keeps all six discrete math single-choice inputs free of handwriting controls', () => {
    const quiz = quizCatalog.getQuizRevision('discrete-math', '2')!
    const singles = quiz.questions.filter((question) => question.type === 'single')
    expect(singles).toHaveLength(6)
    for (const question of singles) {
      render(<QuestionInput question={question} answer={undefined} draftSchema={2} onChange={vi.fn()} />)
      expect(screen.queryByRole('group', { name: '本題作答方式' })).toBeNull()
      expect(screen.queryByRole('img', { name: '繪圖作答區' })).toBeNull()
      cleanup()
    }
  })
  it('keeps the exact legacy textarea and legacy answer for schema 1', async () => {
    const onChange = vi.fn()
    render(<Harness question={legacyCalc} schema={1} onChange={onChange} />)
    expect(screen.queryByRole('radio')).toBeNull()
    await userEvent.type(screen.getByLabelText('你的推導過程'), 'x')
    expect(onChange).toHaveBeenLastCalledWith({ type: 'calculation', text: 'x' })
  })

  it('uses a text-only v4 editor without a mode selector for a schema-2 calculation lacking capability', async () => {
    const onChange = vi.fn()
    render(<Harness question={textOnly} schema={2} onChange={onChange} />)
    expect(screen.queryByRole('radio')).toBeNull()
    await userEvent.type(screen.getByLabelText('你的推導過程'), 'y')
    expect(onChange).toHaveBeenLastCalledWith({ type: 'calculation', mode: 'text', text: 'y', strokes: [] })
  })

  it('shows ⌨️ 打字 / ✏️ 手寫 for a capable calculation and retains both buffers across switches', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness question={capable} schema={2} onChange={onChange} />)
    expect(screen.getByRole('radio', { name: '打字' })).toBeChecked()
    expect(screen.getByText('⌨️', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('✏️', { exact: false })).toBeInTheDocument()
    await user.type(screen.getByLabelText('你的推導過程'), 'k')
    expect(onChange).toHaveBeenLastCalledWith({ type: 'calculation', mode: 'text', text: 'k', strokes: [] })
    await user.click(screen.getByRole('radio', { name: '手寫' }))
    expect(onChange).toHaveBeenLastCalledWith({ type: 'calculation', mode: 'drawing', text: 'k', strokes: [] })
    const canvas = screen.getByRole('img', { name: '繪圖作答區' })
    canvas.setPointerCapture = vi.fn(); canvas.hasPointerCapture = vi.fn(() => false); canvas.releasePointerCapture = vi.fn()
    pointer(canvas, 'pointerdown', 10, 10); pointer(canvas, 'pointermove', 50, 50); pointer(canvas, 'pointerup', 60, 60)
    const drawn = onChange.mock.lastCall![0]
    expect(drawn).toMatchObject({ mode: 'drawing', text: 'k' })
    expect(drawn.strokes).toHaveLength(1)
    await user.click(screen.getByRole('radio', { name: '打字' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...drawn, mode: 'text' })
  })

  it('flushes a pending stroke (pointerdown, pointermove, no pointerup) through the form registry', () => {
    const onChange = vi.fn()
    const flushes: PendingInputFlush[] = []
    const register = (flush: PendingInputFlush) => { flushes.push(flush); return () => { flushes.splice(flushes.indexOf(flush), 1) } }
    render(<Harness question={capable} schema={2} onChange={onChange} register={register}
      initial={{ type: 'calculation', mode: 'drawing', text: 'note', strokes: [pen()] }} />)
    const canvas = screen.getByRole('img', { name: '繪圖作答區' })
    canvas.setPointerCapture = vi.fn(); canvas.hasPointerCapture = vi.fn(() => true); canvas.releasePointerCapture = vi.fn()
    pointer(canvas, 'pointerdown', 100, 100); pointer(canvas, 'pointermove', 200, 200)
    expect(onChange).not.toHaveBeenCalled()
    expect(flushes).toHaveLength(1)
    flushes.forEach((flush) => flush())
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.lastCall![0]).toMatchObject({ type: 'calculation', mode: 'drawing', text: 'note' })
    expect(onChange.mock.lastCall![0].strokes).toHaveLength(2)
    cleanup()
    expect(flushes).toHaveLength(0)
  })

  it('warns (without truncating or blocking) when active text exceeds the formal UTF-8 byte limit', () => {
    const long = '字'.repeat(2731)
    render(<Harness question={capable} schema={2} onChange={vi.fn()} initial={{ type: 'calculation', mode: 'text', text: long, strokes: [] }} />)
    expect(screen.getByText(FORMAL_TEXT_LIMIT_NOTICE)).toBeInTheDocument()
    expect((screen.getByLabelText('你的推導過程') as HTMLTextAreaElement).value).toBe(long)
    cleanup()
    render(<Harness question={capable} schema={2} onChange={vi.fn()} initial={{ type: 'calculation', mode: 'drawing', text: long, strokes: [] }} />)
    expect(screen.queryByText(FORMAL_TEXT_LIMIT_NOTICE)).toBeNull()
    cleanup()
    render(<Harness question={capable} schema={2} onChange={vi.fn()} initial={{ type: 'calculation', mode: 'text', text: '　'.repeat(4000), strokes: [] }} />)
    expect(screen.queryByText(FORMAL_TEXT_LIMIT_NOTICE)).toBeNull()
  })

  it('keeps DrawingQuestion input unchanged and hides the text hint only while handwriting is active', () => {
    const onChange = vi.fn()
    const drawing = v4Quiz.questions.find((question) => question.type === 'drawing')!
    render(<QuestionInput question={drawing} answer={undefined} draftSchema={2} onChange={onChange} />)
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.getByRole('img', { name: '繪圖作答區' })).toBeInTheDocument()
    cleanup()
    const tutor = {} as never
    render(<QuestionCard question={capable} index={0} draftSchema={2} aiTutor={tutor} onChange={vi.fn()}
      answer={{ type: 'calculation', mode: 'drawing', text: 'x', strokes: [] }} />)
    expect(screen.queryByTestId('ai-tutor-controls')).toBeNull()
    cleanup()
    render(<QuestionCard question={capable} index={0} draftSchema={2} aiTutor={tutor} onChange={vi.fn()}
      answer={{ type: 'calculation', mode: 'text', text: 'x', strokes: [] }} />)
    expect(screen.getByTestId('ai-tutor-controls')).toBeInTheDocument()
  })
})
