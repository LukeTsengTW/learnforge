// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PracticeAnswerMap } from '../../models/draft-v4'
import { requiresV4Draft } from '../../lib/draft-v4'
import { projectActiveCalculationAnswer } from '../../lib/calculation-answer'
import { quizCatalog, bundledQuizSources } from '../quiz/quiz-loader'
import { AuthorPreview } from './AuthorPreview'
import { AuthorPage } from './AuthorPage'

const midterm = quizCatalog.getQuizRevision('discrete-math', '2')!
const legacy = quizCatalog.getQuizRevision('discrete-math', '1')!
const counting = quizCatalog.getQuizRevision('discrete-math-ch1-counting-examples', '1')!
const calculationIds = ['q2', 'q3', 'q4', 'q5', 'q6']
const text = '我的推導：保留 $x = 42$ 與空白。\n'
const stroke = { tool: 'pen' as const, color: '#202b38' as const, width: 4,
  points: [{ x: 20, y: 30 }, { x: 120, y: 130 }] }

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.spyOn(Storage.prototype, 'setItem')
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected preview network call'))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  Element.prototype.scrollIntoView = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 1200, height: 900, right: 1200, bottom: 900,
    x: 0, y: 0, toJSON: () => ({}),
  })
})

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled()
  expect(Storage.prototype.setItem).not.toHaveBeenCalled()
  cleanup()
  vi.restoreAllMocks()
})

function card(id = 'q2') { return within(document.getElementById(`author-question-${id}`)!) }

function draw(canvas: HTMLElement) {
  canvas.setPointerCapture = vi.fn()
  canvas.hasPointerCapture = vi.fn(() => false)
  canvas.releasePointerCapture = vi.fn()
  for (const [type, x, y] of [['pointerdown', 20, 30], ['pointermove', 80, 90], ['pointerup', 120, 130]] as const) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y })
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true }, pointerType: { value: 'mouse' } })
    fireEvent(canvas, event)
  }
}

function Harness({ quiz = midterm }: { quiz?: typeof midterm }) {
  const [answers, setAnswers] = useState<PracticeAnswerMap>({})
  return <><AuthorPreview quiz={quiz} mode="student" answers={answers}
    onAnswer={(id, answer) => setAnswers((current) => ({ ...current, [id]: answer }))} />
    <output data-testid="answers">{JSON.stringify(answers)}</output></>
}

async function fillBoth(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(card().getByRole('textbox', { name: '你的推導過程' }), { target: { value: text } })
  await user.click(card().getByRole('radio', { name: '手寫' }))
  draw(card().getByRole('img', { name: '繪圖作答區' }))
  expect(card().getByRole('button', { name: '復原' })).toBeEnabled()
}

async function load(user: ReturnType<typeof userEvent.setup>, revision: '1' | '2') {
  const file = Object.keys(bundledQuizSources).find((path) => path.endsWith(`/discrete-math/v${revision}.quiz.md`))!
  await user.selectOptions(screen.getByLabelText('Bundled revision'), file)
  await user.click(screen.getByRole('button', { name: '載入 bundled source' }))
  await screen.findByText('Valid')
}

describe('Author preview calculation capability', () => {
  it('keeps schema-1 calculations as legacy textareas without mode selectors', () => {
    expect(requiresV4Draft(legacy)).toBe(false)
    render(<AuthorPreview quiz={legacy} mode="student" answers={{}} onAnswer={() => {}} />)
    for (const id of calculationIds) {
      expect(card(id).getByRole('textbox', { name: '你的推導過程' })).toBeInTheDocument()
      expect(card(id).queryByRole('radio')).toBeNull()
    }
  })

  it.each(calculationIds)('uses canonical schema-2 capability for existing %s', async (id) => {
    expect(requiresV4Draft(midterm)).toBe(true)
    render(<Harness />)
    expect(card(id).getByRole('radio', { name: '打字' })).toBeChecked()
    expect(card(id).getByRole('textbox', { name: '你的推導過程' })).toHaveValue('')
    await userEvent.click(card(id).getByRole('radio', { name: '手寫' }))
    const canvas = card(id).getByRole('img', { name: '繪圖作答區' })
    expect(canvas).toHaveAttribute('width', '1200')
    expect(canvas).toHaveAttribute('height', '900')
    expect(card(id).queryByRole('textbox')).toBeNull()
  })

  it.each(counting.questions)('exposes the existing handwriting editor for Chapter 1 $id', (question) => {
    render(<Harness quiz={{ ...counting, questions: [question] }} />)
    const view = card(question.id)
    expect(view.getByRole('radio', { name: '打字' })).toBeChecked()
    expect(view.getByRole('textbox', { name: '你的推導過程' })).toHaveValue('')
    fireEvent.click(view.getByRole('radio', { name: '手寫' }))
    expect(view.getByRole('radio', { name: '手寫' })).toBeChecked()
    expect(view.getByRole('img', { name: '繪圖作答區' })).toHaveAttribute('width', '1200')
    expect(view.getByRole('img', { name: '繪圖作答區' })).toHaveAttribute('height', '900')
    expect(view.queryByRole('textbox')).toBeNull()
  })

  it('preserves both buffers through two mode switches and isolates answers by question', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await fillBoth(user)
    const drawn = JSON.parse(screen.getByTestId('answers').textContent!).q2
    expect(drawn).toMatchObject({ type: 'calculation', mode: 'drawing', text })
    expect(drawn.strokes).toHaveLength(1)
    expect(card('q3').getByRole('textbox')).toHaveValue('')
    await user.click(card().getByRole('radio', { name: '打字' }))
    expect(card().getByRole('textbox')).toHaveValue(text)
    expect(JSON.parse(screen.getByTestId('answers').textContent!).q2).toEqual({ ...drawn, mode: 'text' })
    const question = midterm.questions.find((q) => q.id === 'q2')!
    if (question.type !== 'calculation') throw new Error('Expected calculation')
    expect(projectActiveCalculationAnswer({ ...drawn, mode: 'text' }, question)).toEqual({ type: 'calculation', mode: 'text', text })
    await user.click(card().getByRole('radio', { name: '手寫' }))
    expect(JSON.parse(screen.getByTestId('answers').textContent!).q2).toEqual(drawn)
    expect(projectActiveCalculationAnswer(drawn, question)).toEqual({ type: 'calculation', mode: 'drawing', strokes: drawn.strokes })
    expect(card().getByRole('button', { name: '復原' })).toBeEnabled()
  })

  it.each(['text', 'drawing'] as const)('Answer Preview shows only the active %s buffer and retains local/manual grading', (mode) => {
    const answers: PracticeAnswerMap = {
      q2: { type: 'calculation', mode, text: 'VISIBLE_ONLY_WHEN_TEXT_ACTIVE', strokes: [stroke] },
      'q1-i': { type: 'single', optionId: 'c' },
    }
    render(<AuthorPreview quiz={midterm} mode="answer" answers={answers} onAnswer={() => {}} />)
    const student = document.querySelector('#author-question-q2 .student-answer')!
    expect(student.textContent?.includes('VISIBLE_ONLY_WHEN_TEXT_ACTIVE')).toBe(mode === 'text')
    expect(within(student as HTMLElement).queryByRole('img', { name: '已提交的繪圖答案' }) !== null).toBe(mode === 'drawing')
    expect(card().getByText(/計算題不納入自動評分/)).toBeInTheDocument()
    expect(document.querySelector('#author-question-q1-i .result-question')).toHaveTextContent('6 / 6')
    expect(screen.queryByRole('button', { name: /AI 參考評分|AI 圖像/ })).toBeNull()
  })

  it.each(['reset', 'edit', 'replace'] as const)('AuthorPage %s clears both buffers without persisting or sending answers', async (action) => {
    const user = userEvent.setup()
    render(<AuthorPage />)
    await load(user, '2')
    await fillBoth(user)
    await user.click(screen.getByRole('button', { name: 'Answer Preview' }))
    expect(card().getByRole('img', { name: '已提交的繪圖答案' })).toBeInTheDocument()
    expect(document.querySelector('#author-question-q2 .student-answer')).not.toHaveTextContent('我的推導')
    await user.click(screen.getByRole('button', { name: 'Student Preview' }))
    expect(card().getByRole('radio', { name: '手寫' })).toBeChecked()
    if (action === 'reset') await user.click(screen.getByRole('button', { name: '重設預覽作答' }))
    if (action === 'edit') {
      const editor = screen.getByRole('textbox', { name: '題庫 Markdown 編輯器' }) as HTMLTextAreaElement
      fireEvent.change(editor, { target: { value: `${editor.value}\n` } })
      await screen.findByText('Valid')
    }
    if (action === 'replace') {
      await load(user, '1')
      expect(card().queryByRole('radio')).toBeNull()
      expect(card().getByRole('textbox')).toHaveValue('')
      await load(user, '2')
    }
    await waitFor(() => expect(card().getByRole('radio', { name: '打字' })).toBeChecked())
    expect(card().getByRole('textbox')).toHaveValue('')
    await user.click(card().getByRole('radio', { name: '手寫' }))
    expect(card().getByRole('button', { name: '復原' })).toBeDisabled()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})
