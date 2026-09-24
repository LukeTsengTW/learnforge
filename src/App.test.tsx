// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { Markdown } from './components/Markdown'
import { QuizErrorPage } from './components/ErrorPage'
import { HashRouter } from 'react-router-dom'
import { loadQuizSource } from './features/quiz/quiz-loader'

beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#/'
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function input(id: string): HTMLInputElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLInputElement)) throw new Error(`Missing input ${id}`)
  return element
}

describe('practice flow', () => {
  it('warns about unanswered objective questions, persists a result and restarts', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('link', { name: /開始練習/ }))
    expect(screen.getByRole('heading', { name: '數位邏輯與基礎數學', level: 1 })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '提交測驗' }))
    expect(screen.getByRole('alert')).toHaveTextContent('還有 5 題自動評分題未作答')
    await user.click(screen.getByRole('button', { name: '繼續作答' }))
    expect(window.location.hash).toBe('#/quiz/demo')
    expect(screen.queryByRole('alert')).toBeNull()
    await user.click(screen.getByRole('button', { name: '提交測驗' }))
    await user.click(screen.getByRole('button', { name: '仍然提交' }))
    expect(window.location.hash).toBe('#/result/demo')
    expect(screen.getByRole('heading', { name: '自動評分得分' })).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(JSON.parse(localStorage.getItem('learnforge:attempt:v1:demo')!).result).toMatchObject({ score: 0, maxScore: 10, unansweredCount: 5 })
    await user.click(screen.getByRole('button', { name: '重新開始測驗' }))
    await user.click(screen.getByRole('button', { name: '確認重新開始' }))
    expect(window.location.hash).toBe('#/quiz/demo')
    await waitFor(() => expect(localStorage.getItem('learnforge:attempt:v1:demo')).toBeNull())
    expect(screen.getAllByRole('radio').every((element) => !(element as HTMLInputElement).checked)).toBe(true)
  })
  it('restores drafts on remount, scores a completed quiz, and locks quiz routes after submission', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await user.click(screen.getByRole('link', { name: /開始練習/ }))
    await user.click(input('answer-q1-b'))
    await user.type(screen.getByRole('textbox', { name: '你的答案' }), 'xor')
    first.unmount()
    render(<App />)
    expect(input('answer-q1-b')).toBeChecked()
    expect(screen.getByRole('textbox', { name: '你的答案' })).toHaveValue('xor')
    await user.click(input('answer-q2-b'))
    for (const id of ['b', 'c', 'd']) await user.click(input(`answer-q3-${id}`))
    await user.click(input('answer-q4-true'))
    await user.type(screen.getByRole('textbox', { name: '你的推導過程' }), 'My work: $x=3$')
    await user.click(screen.getByRole('button', { name: '提交測驗' }))
    const saved = JSON.parse(localStorage.getItem('learnforge:attempt:v1:demo')!)
    expect(saved.result).toMatchObject({ score: 10, maxScore: 10, correctCount: 5, incorrectCount: 0, unansweredCount: 0 })
    cleanup()
    window.location.hash = '#/quiz/demo'
    render(<App />)
    await waitFor(() => expect(window.location.hash).toBe('#/result/demo'))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText(/My work:/)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('learnforge:attempt:v1:demo')!).submittedAt).toBe(saved.submittedAt)
  })
  it('provides a useful direct result route before submission', () => {
    window.location.hash = '#/result/demo'
    render(<App />)
    expect(screen.getByRole('heading', { name: '還沒有測驗結果' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '前往練習' })).toHaveAttribute('href', '#/quiz/demo')
  })
})

describe('safe content and failure UI', () => {
  it('renders math and Markdown while discarding raw HTML and unsafe links', () => {
    const { container } = render(<Markdown>{'**Bold** $x^2$\n\n$$\nx=2\n$$\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert%281%29)'}</Markdown>)
    expect(screen.getByText('Bold').tagName).toBe('STRONG')
    expect(container.querySelector('.katex')).not.toBeNull()
    expect(container.querySelector('.katex-display')).not.toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('a')?.getAttribute('href')).not.toContain('javascript:')
  })
  it('turns parser failures into a visible error, not a white screen', () => {
    const loaded = loadQuizSource('bad quiz')
    expect(loaded.ok).toBe(false)
    if (!loaded.ok) render(<HashRouter><QuizErrorPage detail={loaded.error} /></HashRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('題目格式錯誤，無法載入。')
  })
})
