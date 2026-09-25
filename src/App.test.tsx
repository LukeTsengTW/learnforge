// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppRoutes } from './App'
import { AuthContext } from './features/auth/auth-context'
import { PracticeContext } from './features/quiz/practice-context'
import { createMemoryPracticeRepository } from './features/quiz/practice-memory.test-helper'
import { practiceCacheKey } from './features/quiz/practice-cache'
import { Markdown } from './components/Markdown'
import { QuizErrorPage } from './components/ErrorPage'
import { HashRouter } from 'react-router-dom'
import { loadQuizSource, quizCatalog } from './features/quiz/quiz-loader'
import { reduceAttempt } from './lib/attempt'

type MemoryRepo = ReturnType<typeof createMemoryPracticeRepository>
const demo = quizCatalog.getCurrentQuiz('demo')!
async function createSubmitted(repo: MemoryRepo) {
  const draft = await repo.getOrCreateDraft(demo)
  const submitted = reduceAttempt(demo, draft.attempt!, { type: 'submit',
    now: new Date(Date.parse(draft.attempt!.startedAt) + 1).toISOString() })
  await repo.saveDraft(draft, submitted)
  return (await repo.loadAttempt(draft.id))!
}
function TestApp({ repo }: { repo: MemoryRepo }) {
  return <AuthContext.Provider value={{ account: { id: 'test', username: 'student' }, loading: false, error: null, service: null, refresh: async () => {} }}>
    <PracticeContext.Provider value={repo}><HashRouter><AppRoutes /></HashRouter></PracticeContext.Provider>
  </AuthContext.Provider>
}
beforeEach(() => {
  localStorage.clear(); window.location.hash = '#/'
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
async function openDemo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('link', { name: '題庫' }))
  const card = screen.getByRole('heading', { name: '數位邏輯與基礎數學' }).closest('article')!
  await user.click(within(card).getByRole('link', { name: /開始練習|繼續作答/ }))
  await screen.findByRole('heading', { name: '數位邏輯與基礎數學', level: 1 })
}
async function submitIncomplete(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '提交測驗' }))
  await user.click(screen.getByRole('button', { name: '仍然提交' }))
  await screen.findByRole('heading', { name: '自動評分得分' })
}

describe('practice flow', () => {
  it('keeps answer input active after React StrictMode remounts effects', async () => {
    const repo = createMemoryPracticeRepository('test'), user = userEvent.setup()
    render(<StrictMode><TestApp repo={repo} /></StrictMode>)
    await openDemo(user)
    await user.click(input('answer-q1-b'))
    const draft = repo.all()[0]
    expect(localStorage.getItem(practiceCacheKey('test', draft.id))).toContain('"q1"')
  })
  it('warns about unanswered questions, preserves submissions and derives mistakes across attempts', async () => {
    const repo = createMemoryPracticeRepository('test'), user = userEvent.setup()
    render(<TestApp repo={repo} />)
    await openDemo(user)
    await user.click(screen.getByRole('button', { name: '提交測驗' }))
    expect(screen.getByRole('alert')).toHaveTextContent('還有 5 題自動評分題未作答')
    await user.click(screen.getByRole('button', { name: '繼續作答' }))
    expect(screen.queryByRole('alert')).toBeNull()
    await user.click(input('answer-q1-b'))
    await submitIncomplete(user)
    const first = repo.all().find((record) => record.row.status === 'submitted')!
    expect(first.attempt?.status === 'submitted' && first.attempt.result.score).toBe(2)
    expect(localStorage.getItem(practiceCacheKey('test', first.id))).not.toBeNull()
    await user.click(screen.getByRole('link', { name: '再次練習' }))
    await screen.findByRole('heading', { name: '數位邏輯與基礎數學', level: 1 })
    await user.click(input('answer-q1-a'))
    await submitIncomplete(user)
    const submitted = repo.all().filter((record) => record.row.status === 'submitted')
    expect(submitted).toHaveLength(2)
    expect(new Set(submitted.map((record) => record.id)).size).toBe(2)
    expect(repo.all().find((record) => record.id === first.id)?.attempt?.answers.q1).toEqual({ type: 'single', optionId: 'b' })
    await user.click(screen.getByRole('link', { name: '查看練習紀錄' }))
    await screen.findByRole('heading', { name: '每一次練習，都值得留下。' })
    expect(screen.getAllByRole('link', { name: '查看結果' })).toHaveLength(2)
    await user.click(screen.getByRole('link', { name: '錯題' }))
    expect(await screen.findByText('你的答案')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看完整作答' })).toHaveAttribute('href', `#/result/${submitted.find((record) => record.id !== first.id)!.id}`)
  })
  it('restores drafts on remount, scores a complete quiz and keeps submitted results immutable', async () => {
    const repo = createMemoryPracticeRepository('test'), user = userEvent.setup()
    const first = render(<TestApp repo={repo} />)
    await openDemo(user)
    await user.click(input('answer-q1-b'))
    await user.type(screen.getByRole('textbox', { name: '你的答案' }), 'xor')
    first.unmount(); render(<TestApp repo={repo} />)
    await screen.findByRole('heading', { name: '數位邏輯與基礎數學', level: 1 })
    expect(input('answer-q1-b')).toBeChecked()
    expect(screen.getByRole('textbox', { name: '你的答案' })).toHaveValue('xor')
    await user.click(input('answer-q2-b'))
    for (const id of ['b', 'c', 'd']) await user.click(input(`answer-q3-${id}`))
    await user.click(input('answer-q4-true'))
    await user.type(screen.getByRole('textbox', { name: '你的推導過程' }), 'My work: $x=3$')
    await user.click(screen.getByRole('button', { name: '提交測驗' }))
    await screen.findByRole('heading', { name: '自動評分得分' })
    const saved = repo.all()[0]
    expect(saved.attempt?.status === 'submitted' && saved.attempt.result).toMatchObject({ score: 10, maxScore: 10, correctCount: 5, incorrectCount: 0, unansweredCount: 0 })
    expect(screen.queryByRole('textbox')).toBeNull()
    cleanup(); window.location.hash = `#/result/${saved.id}`; render(<TestApp repo={repo} />)
    await screen.findByText(/My work:/)
    expect(repo.all()[0].attempt).toEqual(saved.attempt)
  })
  it('deletes only a draft on restart and retains previous history', async () => {
    const repo = createMemoryPracticeRepository('test'), user = userEvent.setup()
    render(<TestApp repo={repo} />)
    await openDemo(user)
    await submitIncomplete(user)
    const firstId = repo.all()[0].id
    await user.click(screen.getByRole('link', { name: '再次練習' }))
    await screen.findByRole('heading', { name: '數位邏輯與基礎數學', level: 1 })
    const draftId = repo.all().find((record) => record.row.status === 'draft')!.id
    await user.click(screen.getByRole('button', { name: '重新開始測驗' }))
    await user.click(screen.getByRole('button', { name: '確認重新開始' }))
    await waitFor(() => expect(repo.all().find((record) => record.row.status === 'draft')?.id).not.toBe(draftId))
    expect(repo.all().find((record) => record.id === firstId)?.row.status).toBe('submitted')
  })
  it('keeps a clear legacy result route before submission', async () => {
    const repo = createMemoryPracticeRepository('test')
    window.location.hash = '#/result/demo'
    render(<TestApp repo={repo} />)
    expect(await screen.findByRole('heading', { name: '還沒有測驗結果' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '前往練習' })).toHaveAttribute('href', '#/quiz/demo')
  })
})

describe('history and result routes', () => {
  it('loads 20 history rows at a time and keeps distinct result links', async () => {
    const repo = createMemoryPracticeRepository('test'), user = userEvent.setup()
    for (let i = 0; i < 21; i++) await createSubmitted(repo)
    window.location.hash = '#/history'
    render(<TestApp repo={repo} />)
    await waitFor(() => expect(screen.getAllByRole('link', { name: '查看結果' })).toHaveLength(20))
    await user.click(screen.getByRole('button', { name: '載入更多' }))
    await waitFor(() => expect(screen.getAllByRole('link', { name: '查看結果' })).toHaveLength(21))
    expect(new Set(screen.getAllByRole('link', { name: '查看結果' }).map((link) => link.getAttribute('href'))).size).toBe(21)
  })

  it('shows an archived revision notice while rendering that exact attempt', async () => {
    const repo = createMemoryPracticeRepository('test')
    const record = await createSubmitted(repo)
    const historical = { ...record, row: { ...record.row, quiz_revision: 'archived-v1' },
      quiz: { ...record.quiz!, revision: 'archived-v1' },
      attempt: record.attempt?.status === 'submitted' ? { ...record.attempt, quizRevision: 'archived-v1' } : null }
    const wrapped = { ...repo, loadAttempt: async (id: string) => id === record.id ? historical : null }
    window.location.hash = `#/result/${record.id}`
    render(<TestApp repo={wrapped} />)
    expect(await screen.findByText(/此紀錄使用題目版本 archived-v1/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '作答回顧' })).toBeInTheDocument()
  })

  it('handles a missing revision without guessing answers', async () => {
    const repo = createMemoryPracticeRepository('test')
    const record = await createSubmitted(repo)
    const unavailable = { ...record, row: { ...record.row, quiz_revision: 'missing-v1' }, quiz: null, attempt: null }
    const wrapped = { ...repo, loadAttempt: async (id: string) => id === record.id ? unavailable : null }
    window.location.hash = `#/result/${record.id}`
    render(<TestApp repo={wrapped} />)
    expect(await screen.findByRole('heading', { name: '題目版本無法載入' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '作答回顧' })).toBeNull()
  })

  it('uses one generic unavailable message for a foreign or unknown UUID', async () => {
    const foreign = await createSubmitted(createMemoryPracticeRepository('another-user'))
    window.location.hash = `#/result/${foreign.id}`
    render(<TestApp repo={createMemoryPracticeRepository('test')} />)
    expect(await screen.findByRole('heading', { name: '找不到此作答紀錄，或你沒有權限查看。' })).toBeInTheDocument()
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
