// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import demoSource from '../../content/quizzes/demo/v1.quiz.md?raw'
import { bundledQuizSources } from '../quiz/quiz-loader'
import { AuthorPage } from './AuthorPage'
import { AUTHOR_DRAFT_KEY, NEW_QUIZ_TEMPLATE } from './authoring-core'

const demoFile = Object.keys(bundledQuizSources).find((file) => file.endsWith('/demo/v1.quiz.md'))!

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  Element.prototype.scrollIntoView = vi.fn()
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected network call'))
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function newQuiz(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '建立空白題庫' }))
  await screen.findByText('Valid')
  return screen.getByRole('textbox', { name: '題庫 Markdown 編輯器' }) as HTMLTextAreaElement
}
async function loadDemo(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Bundled revision'), demoFile)
  await user.click(screen.getByRole('button', { name: '載入 bundled source' }))
  await screen.findByText('Valid')
}

describe('authoring workspace', () => {
  it('renders a valid new template and debounces rapid source edits to the newest result', async () => {
    const user = userEvent.setup()
    render(<AuthorPage />)
    const editor = await newQuiz(user)
    expect(screen.getByRole('heading', { name: '新題庫' })).toBeInTheDocument()
    fireEvent.change(editor, { target: { value: 'broken' } })
    fireEvent.change(editor, { target: { value: NEW_QUIZ_TEMPLATE.replace('# 新題庫', '# 最終題庫') } })
    await screen.findByRole('heading', { name: '最終題庫' })
    expect(screen.queryByText('1 個阻塞問題')).toBeNull()
    expect(screen.getByText('未匯出修改')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses all six formal input renderers, memory-only answers, solution preview, and drawing canvas', async () => {
    const user = userEvent.setup()
    render(<AuthorPage />)
    await loadDemo(user)
    expect(screen.getByRole('img', { name: '繪圖作答區' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0)
    expect(screen.getByRole('textbox', { name: '你的答案' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '你的推導過程' })).toBeInTheDocument()
    const editor = screen.getByRole('textbox', { name: '題庫 Markdown 編輯器' }) as HTMLTextAreaElement
    await user.click(document.getElementById('answer-q1-b')!)
    expect(document.getElementById('answer-q1-b')).toBeChecked()
    const canvas = screen.getByRole('img', { name: '繪圖作答區' }) as HTMLCanvasElement
    canvas.setPointerCapture = vi.fn()
    canvas.hasPointerCapture = vi.fn(() => true)
    canvas.releasePointerCapture = vi.fn()
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 800, bottom: 600,
      width: 800, height: 600, x: 0, y: 0, toJSON: () => ({}) })
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, isPrimary: true, clientX: 10, clientY: 10 })
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, isPrimary: true, clientX: 50, clientY: 50 })
    expect(screen.getByRole('button', { name: '復原' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Answer Preview' }))
    expect(screen.getAllByRole('heading', { name: '解題說明' })).toHaveLength(7)
    expect(screen.getAllByRole('heading', { name: /評分規準/ })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /AI 參考評分|AI 圖像/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Student Preview' }))
    await user.click(screen.getByRole('button', { name: '重設預覽作答' }))
    expect(document.getElementById('answer-q1-b')).not.toBeChecked()
    expect(editor.value).toBe(demoSource)
    expect(localStorage.length).toBe(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('confirms destructive replacement and saves, reloads, then clears its isolated draft', async () => {
    const user = userEvent.setup()
    render(<AuthorPage />)
    const editor = await newQuiz(user)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await user.click(screen.getByRole('button', { name: '載入 bundled source' }))
    expect(confirm).toHaveBeenCalled()
    expect(editor.value).toBe(NEW_QUIZ_TEMPLATE)
    await user.click(screen.getByRole('button', { name: '儲存本機草稿' }))
    expect(localStorage.getItem(AUTHOR_DRAFT_KEY)).toContain('new-quiz')
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: '載入 bundled source' }))
    await screen.findByText('Valid')
    await user.click(screen.getByRole('button', { name: '載入本機草稿' }))
    await waitFor(() => expect(editor.value).toBe(NEW_QUIZ_TEMPLATE))
    await user.click(screen.getByRole('button', { name: '清除本機草稿' }))
    expect(localStorage.getItem(AUTHOR_DRAFT_KEY)).toBeNull()
    expect([...Array(localStorage.length).keys()].map((index) => localStorage.key(index))).not.toContain('learnforge:practice')
  })
  it('does not overwrite a dirty source when an import is declined', async () => {
    const user = userEvent.setup()
    render(<AuthorPage />)
    const editor = await newQuiz(user)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await user.upload(screen.getByLabelText('匯入 .quiz.md'), new File([demoSource], 'demo.quiz.md'))
    expect(confirm).toHaveBeenCalled()
    expect(editor.value).toBe(NEW_QUIZ_TEMPLATE)
    confirm.mockReturnValue(true)
    await user.upload(screen.getByLabelText('匯入 .quiz.md'), new File([demoSource], 'demo.quiz.md'))
    await waitFor(() => expect(editor.value).toBe(demoSource))
  })

  it('imports untrusted text, skips raw HTML, shows parser error, then recovers', async () => {
    const user = userEvent.setup()
    render(<AuthorPage />)
    const malicious = NEW_QUIZ_TEMPLATE.replace('請選出正確選項。',
      '請選出正確選項。\n<script>alert(1)</script>\n<img src=x onerror=alert(2)>')
    const file = new File([malicious], 'import.quiz.md', { type: 'text/plain' })
    await user.upload(screen.getByLabelText('匯入 .quiz.md'), file)
    const editor = screen.getByRole('textbox', { name: '題庫 Markdown 編輯器' }) as HTMLTextAreaElement
    await screen.findByText('Valid')
    expect(editor.value).toContain('<script>')
    expect(document.querySelector('.author-preview-content script')).toBeNull()
    expect(document.querySelector('.author-preview-content img')).toBeNull()
    const broken = malicious.replace(':::end', ':::bad')
    fireEvent.change(editor, { target: { value: broken } })
    await screen.findByText('1 個阻塞問題')
    const error = screen.getByRole('button', { name: /跳至該行/ })
    expect(error).toHaveTextContent('題目 q1')
    await user.click(error)
    expect(editor).toHaveFocus()
    fireEvent.change(editor, { target: { value: malicious } })
    await screen.findByText('Valid')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects duplicate revision, then simulates catalog change and exports a safe file', async () => {
    const user = userEvent.setup()
    render(<AuthorPage />)
    await loadDemo(user)
    const revision = screen.getByRole('textbox', { name: '新 revision（手動指定）' })
    await user.type(revision, 'v1-7d7c900e')
    await user.click(screen.getByRole('button', { name: '建立新 revision' }))
    expect(screen.getByText('新 revision 必須不同於目前 revision。')).toBeInTheDocument()
    await user.clear(revision)
    await user.type(revision, 'v2')
    await user.click(screen.getByRole('button', { name: '建立新 revision' }))
    await screen.findByText('Valid')
    expect(screen.getByText('src/content/quizzes/demo/v2.quiz.md')).toBeInTheDocument()
    expect(screen.getByText(/Catalog 模擬：通過/)).toBeInTheDocument()
    expect(bundledQuizSources[demoFile]).toBe(demoSource)
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const createUrl = vi.fn(() => 'blob:author-test')
    const revokeUrl = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl })
    await user.click(screen.getByRole('button', { name: '下載 .quiz.md' }))
    expect(clicked).toHaveBeenCalledOnce()
    expect(createUrl).toHaveBeenCalledOnce()
    expect(revokeUrl).toHaveBeenCalledWith('blob:author-test')
    expect(screen.getByText('無未匯出修改')).toBeInTheDocument()
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
    await user.click(screen.getByRole('button', { name: '複製 Markdown' }))
    expect(clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('revision="v2"'))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('exposes validation, metadata, warnings and keyboard usable question navigation', async () => {
    const user = userEvent.setup()
    render(<AuthorPage />)
    await loadDemo(user)
    const inspector = screen.getByRole('heading', { name: 'Metadata inspector' }).closest('section')!
    expect(within(inspector).getAllByText('20')).toHaveLength(2)
    expect(within(inspector).getAllByText('10')).toHaveLength(2)
    expect(screen.getByText(/AI 參考評分可用/)).toBeInTheDocument()
    expect(screen.getByText(/AI 圖像參考分析可用/)).toBeInTheDocument()
    const nav = within(inspector).getByRole('navigation', { name: '題目導覽' })
    await user.click(within(nav).getByRole('button', { name: 'Q7 · drawing · q7' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
})
