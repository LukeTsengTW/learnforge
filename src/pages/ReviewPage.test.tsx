// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HashRouter } from 'react-router-dom'
import type { AnalyticsAttempt } from '../models/analytics'
import { QUESTION_TYPE, type Quiz } from '../models/quiz'
import { PracticeContext, type PracticeRepository } from '../features/quiz/practice-context'
import { quizCatalog } from '../features/quiz/quiz-loader'
import { ReviewPage } from './ReviewPage'

const now = '2026-09-21T12:00:00Z'
const source: Quiz = { id: 'review-fixture', revision: 'v1', title: 'Review fixture', subject: 'Logic', tags: ['logic'],
  description: '', estimatedMinutes: 5, current: true, questions: ['q1', 'q2'].map((id) => ({
    id, type: QUESTION_TYPE.single, tags: ['topic'], points: 2, prompt: `Prompt ${id}`,
    hint: null, solution: `Explanation ${id}`, rubric: [],
    options: [{ id: 'a', content: 'Correct option' }, { id: 'b', content: 'Wrong option' }], correctOptionId: 'a',
  })) }
const first: AnalyticsAttempt = { id: 'a1', status: 'submitted', quizId: source.id, quizRevision: source.revision,
  submittedAt: '2026-09-20T12:00:00Z', quiz: source, answers: { q1: { type: 'single', optionId: 'b' } } }
const second: AnalyticsAttempt = { id: 'a2', status: 'submitted', quizId: source.id, quizRevision: source.revision,
  submittedAt: now, quiz: source, answers: { q1: { type: 'single', optionId: 'a' }, q2: { type: 'single', optionId: 'b' } } }

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('focused review stays ephemeral', () => {
  it('uses the latest formal outcome, reveals the solution only after check, and retry hides it again', async () => {
    const user = userEvent.setup()
    const saveDraft = vi.fn()
    const from = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const repo = { listSubmittedAnalyticsPage: vi.fn(async () => ({ records: [second, first], nextOffset: null })),
      saveDraft, from } as unknown as PracticeRepository
    render(<PracticeContext.Provider value={repo}><HashRouter><ReviewPage /></HashRouter></PracticeContext.Provider>)
    expect(await screen.findByText('Prompt q2')).toBeInTheDocument()
    expect(screen.queryByText('Prompt q1')).toBeNull()
    expect(screen.queryByText('Explanation q2')).toBeNull()
    const check = screen.getByRole('button', { name: '檢查答案' })
    expect(check).toBeDisabled()
    await user.click(document.getElementById('answer-q2-b')!)
    await user.click(check)
    expect(await screen.findByText('答錯，請查看正確答案與解題說明。')).toBeInTheDocument()
    expect(screen.getByText('Explanation q2')).toBeInTheDocument()
    expect(within(screen.getByText('正確答案').parentElement!).getByText('Correct option')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '再試一次' }))
    expect(screen.queryByText('Explanation q2')).toBeNull()
    expect(screen.getByRole('button', { name: '檢查答案' })).toBeDisabled()
    await user.click(document.getElementById('answer-q2-a')!)
    await user.click(screen.getByRole('button', { name: '檢查答案' }))
    expect(await screen.findByText('答對')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '下一題' }))
    expect(screen.getByText(/本次已答對 1 題/)).toBeInTheDocument()
    expect(saveDraft).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  it('keeps an archived revision visible without replacing the HashRouter route', async () => {
    const user = userEvent.setup()
    const current = quizCatalog.getCurrentQuiz('demo')!
    const historical = { ...current, revision: 'archived-v1', current: false }
    const record: AnalyticsAttempt = { id: 'old', status: 'submitted', quizId: current.id,
      quizRevision: historical.revision, submittedAt: now, quiz: historical,
      answers: { q1: { type: 'single', optionId: 'a' } } }
    const repo = { listSubmittedAnalyticsPage: vi.fn(async () => ({ records: [record], nextOffset: null })) } as unknown as PracticeRepository
    window.location.hash = '#/review'
    render(<PracticeContext.Provider value={repo}><HashRouter><ReviewPage /></HashRouter></PracticeContext.Provider>)
    expect(await screen.findByText(/此錯題來自舊版題目 archived-v1/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '前往目前完整題庫' })).toHaveAttribute('href', '#/quiz/demo')
    await user.click(screen.getByRole('button', { name: '練習當時版本' }))
    expect(window.location.hash).toBe('#/review')
    expect(document.getElementById('review-question')).toHaveFocus()
  })
})
