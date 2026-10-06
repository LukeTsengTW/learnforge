// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../features/auth/auth-context'
import { PracticeContext } from '../features/quiz/practice-context'
import { createMemoryPracticeRepository } from '../features/quiz/practice-memory.test-helper'
import { quizCatalog, type QuizCatalogEntry } from '../features/quiz/quiz-loader'
import { QUESTION_LABEL, QUESTION_TYPE, type QuestionType } from '../models/quiz'
import { LibraryPage } from './LibraryPage'

const originalCatalog = quizCatalog.current
const demo = quizCatalog.getCurrentQuiz('demo')!

function entry(id: string, title: string, subject: string, tags: string[], types: QuestionType[], description: string): QuizCatalogEntry {
  const questions = types.map((type) => {
    const question = demo.questions.find((candidate) => candidate.type === type)
    if (!question) throw new Error(`Missing fixture question: ${type}`)
    const copy = { ...question, hint: 'only-hint-keyword', solution: 'only-solution-keyword',
      rubric: [{ description: 'only-rubric-keyword', score: 1 }] }
    return copy.type === QUESTION_TYPE.fill ? { ...copy, correctAnswer: 'only-answer-keyword' } : copy
  })
  return { quiz: { ...demo, id, title, subject, tags, description, questions },
    questionCount: questions.length, totalPoints: questions.reduce((sum, question) => sum + question.points, 0), maxPoints: 10 }
}

// Deliberately keep the catalog in a different order from its titles.
const fixtures = [
  entry('challenge', 'Logic Challenge', '數位邏輯', ['進階', '共用'],
    [QUESTION_TYPE.calculation, QUESTION_TYPE.drawing, QUESTION_TYPE.single], '第二份邏輯練習'),
  entry('math', '數學進階', '離散數學', ['進階', '共用'],
    [QUESTION_TYPE.multiple, QUESTION_TYPE.fill], 'Practice with sets'),
  entry('warmup', 'Logic Warmup', '數位邏輯', ['入門', 'Logic'],
    [QUESTION_TYPE.single, QUESTION_TYPE.trueFalse], '入門練習與基本概念'),
]
const allTitles = ['Logic Challenge', '數學進階', 'Logic Warmup']
const midtermTitle = '2025 Discrete Mathematics 期中考'
const bundledTitles = [midtermTitle, '布林代數基礎', '數位邏輯與基礎數學', '離散數學：關係']

function renderLibrary(entries = fixtures, repo?: ReturnType<typeof createMemoryPracticeRepository>) {
  quizCatalog.current = entries
  render(<AuthContext.Provider value={{ account: repo ? { id: 'test', username: 'student' } : null,
    loading: false, error: null, service: null, refresh: async () => {} }}>
    <PracticeContext.Provider value={repo ?? null}>
      <MemoryRouter><LibraryPage /></MemoryRouter>
    </PracticeContext.Provider>
  </AuthContext.Provider>)
  return userEvent.setup()
}

function visibleTitles() {
  return screen.queryAllByRole('article').map((card) => within(card).getByRole('heading', { level: 2 }).textContent)
}

afterEach(() => { cleanup(); quizCatalog.current = originalCatalog })

describe('Quiz Library search and filters', () => {
  it('keeps every current quiz visible by default and preserves the catalog order', () => {
    renderLibrary(originalCatalog)
    expect(visibleTitles()).toEqual(bundledTitles)
    expect(screen.queryByRole('button', { name: '清除篩選' })).not.toBeInTheDocument()
  })

  it('shows declared total points instead of deterministic-only capacity', () => {
    renderLibrary([{ ...fixtures[0], totalPoints: 100, maxPoints: 36 }])
    const card = screen.getByRole('article')
    expect(within(card).getByText('總分 100 分')).toBeInTheDocument()
    expect(within(card).queryByText('36 分自動評分')).not.toBeInTheDocument()
  })

  it('shows the real bundled midterm facts and current quiz link', () => {
    renderLibrary(originalCatalog)
    const card = screen.getByRole('heading', { name: midtermTitle, level: 2 }).closest('article')!
    expect(within(card).getByText('離散數學')).toBeInTheDocument()
    expect(within(card).getByText('11 題')).toBeInTheDocument()
    expect(within(card).getByText('總分 100 分')).toBeInTheDocument()
    expect(within(card).getByText('約 90 分鐘')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: /開始練習/ })).toHaveAttribute('href', '/quiz/discrete-math')
    expect(within(card).queryByText('36 分自動評分')).not.toBeInTheDocument()
  })

  it.each(['2025', 'Discrete Mathematics', '期中考'])('finds the bundled midterm with %s', async (query) => {
    const user = renderLibrary(originalCatalog)
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), query)
    expect(visibleTitles()).toEqual([midtermTitle])
  })

  it.each([
    ['科目', '離散數學', [midtermTitle, '離散數學：關係']],
    ['題型', QUESTION_TYPE.single, bundledTitles],
    ['題型', QUESTION_TYPE.calculation, [midtermTitle, '數位邏輯與基礎數學']],
    ['標籤', 'combinatorics', [midtermTitle]],
    ['標籤', 'inclusion-exclusion', [midtermTitle]],
    ['標籤', 'relations', [midtermTitle, '離散數學：關係']],
  ])('filters the real bundle by %s=%s', async (label, value, expected) => {
    const user = renderLibrary(originalCatalog)
    await user.selectOptions(screen.getByRole('combobox', { name: label }), value)
    expect(visibleTitles()).toEqual(expected)
  })

  it('uses the all-options as the default for each filter', () => {
    renderLibrary()
    expect(screen.getByRole('combobox', { name: '標籤' })).toHaveDisplayValue('所有標籤')
    expect(screen.getByRole('combobox', { name: '科目' })).toHaveDisplayValue('所有科目')
    expect(screen.getByRole('combobox', { name: '題型' })).toHaveDisplayValue('所有題型')
  })

  it.each([
    ['Warmup', ['Logic Warmup']],
    ['離散數學', ['數學進階']],
    ['共用', ['Logic Challenge', '數學進階']],
    ['Practice with sets', ['數學進階']],
    ['  lOgIc  ', ['Logic Challenge', 'Logic Warmup']],
    ['   ', allTitles],
  ])('searches permitted quiz metadata with %j', async (query, expected) => {
    const user = renderLibrary()
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), query)
    expect(visibleTitles()).toEqual(expected)
  })

  it.each(['only-answer-keyword', 'only-solution-keyword', 'only-rubric-keyword', 'only-hint-keyword'])(
    'does not search grading-authority content: %s', async (query) => {
      const user = renderLibrary()
      await user.type(screen.getByRole('searchbox', { name: '搜尋' }), query)
      expect(visibleTitles()).toEqual([])
      expect(screen.getByRole('status')).toHaveTextContent(/找不到.*題庫/)
    })

  it('filters by a tag and removes that restriction with 所有標籤', async () => {
    const user = renderLibrary()
    const select = screen.getByRole('combobox', { name: '標籤' })
    await user.selectOptions(select, '進階')
    expect(visibleTitles()).toEqual(['Logic Challenge', '數學進階'])
    await user.selectOptions(select, '')
    expect(visibleTitles()).toEqual(allTitles)
  })

  it('filters by a subject and removes that restriction with 所有科目', async () => {
    const user = renderLibrary()
    const select = screen.getByRole('combobox', { name: '科目' })
    await user.selectOptions(select, '數位邏輯')
    expect(visibleTitles()).toEqual(['Logic Challenge', 'Logic Warmup'])
    await user.selectOptions(select, '')
    expect(visibleTitles()).toEqual(allTitles)
  })

  it.each([
    [QUESTION_TYPE.single, ['Logic Challenge', 'Logic Warmup']],
    [QUESTION_TYPE.multiple, ['數學進階']],
    [QUESTION_TYPE.trueFalse, ['Logic Warmup']],
    [QUESTION_TYPE.fill, ['數學進階']],
    [QUESTION_TYPE.calculation, ['Logic Challenge']],
    [QUESTION_TYPE.drawing, ['Logic Challenge']],
  ])('matches a quiz containing any question of type %s', async (type, expected) => {
    const user = renderLibrary()
    const select = screen.getByRole('combobox', { name: '題型' })
    expect(within(select).getByRole('option', { name: QUESTION_LABEL[type] })).toHaveValue(type)
    await user.selectOptions(select, type)
    expect(visibleTitles()).toEqual(expected)
    await user.selectOptions(select, '')
    expect(visibleTitles()).toEqual(allTitles)
  })

  it('combines search and all three filters with AND semantics', async () => {
    const user = renderLibrary()
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), 'Logic')
    await user.selectOptions(screen.getByRole('combobox', { name: '標籤' }), '進階')
    await user.selectOptions(screen.getByRole('combobox', { name: '科目' }), '數位邏輯')
    await user.selectOptions(screen.getByRole('combobox', { name: '題型' }), QUESTION_TYPE.drawing)
    expect(visibleTitles()).toEqual(['Logic Challenge'])
    await user.selectOptions(screen.getByRole('combobox', { name: '題型' }), QUESTION_TYPE.trueFalse)
    expect(visibleTitles()).toEqual([])
    expect(screen.getByRole('status')).toHaveTextContent(/找不到.*題庫/)
  })

  it('clears search and all filters from the no-match state and restores the full catalog', async () => {
    const user = renderLibrary()
    await user.selectOptions(screen.getByRole('combobox', { name: '標籤' }), '進階')
    await user.selectOptions(screen.getByRole('combobox', { name: '科目' }), '數位邏輯')
    await user.selectOptions(screen.getByRole('combobox', { name: '題型' }), QUESTION_TYPE.fill)
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), 'no-match')
    expect(screen.getByRole('status')).toHaveTextContent(/找不到.*題庫/)
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '清除篩選' }))
    expect(screen.getByRole('searchbox', { name: '搜尋' })).toHaveValue('')
    for (const name of ['標籤', '科目', '題型']) expect(screen.getByRole('combobox', { name })).toHaveValue('')
    expect(visibleTitles()).toEqual(allTitles)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '清除篩選' })).not.toBeInTheDocument()
  })

  it('does not offer a reset when an empty catalog has no active search or filter', async () => {
    const user = renderLibrary([])
    expect(screen.getByRole('status')).toHaveTextContent(/找不到.*題庫/)
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), '   ')
    expect(screen.queryByRole('button', { name: '清除篩選' })).not.toBeInTheDocument()
  })

  it('derives unique tag and subject options from the full current catalog', async () => {
    const user = renderLibrary()
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), 'Warmup')
    const tags = within(screen.getByRole('combobox', { name: '標籤' })).getAllByRole('option')
    const subjects = within(screen.getByRole('combobox', { name: '科目' })).getAllByRole('option')
    expect(tags.map((option) => option.textContent)).toEqual(['所有標籤', '進階', '共用', '入門', 'Logic'])
    expect(subjects.map((option) => option.textContent)).toEqual(['所有科目', '數位邏輯', '離散數學'])
  })

  it('keeps filtered cards in the original catalog order', async () => {
    const user = renderLibrary()
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), 'Logic')
    expect(visibleTitles()).toEqual(['Logic Challenge', 'Logic Warmup'])
  })

  it('allows keyboard navigation through every control and keyboard reset', async () => {
    const user = renderLibrary()
    await user.tab()
    expect(screen.getByRole('link', { name: '練習首頁' })).toHaveFocus()
    for (const name of ['標籤', '科目', '題型']) {
      await user.tab()
      expect(screen.getByRole('combobox', { name })).toHaveFocus()
    }
    await user.tab()
    expect(screen.getByRole('searchbox', { name: '搜尋' })).toHaveFocus()
    await user.keyboard('no-match')
    await user.tab()
    expect(screen.getByRole('button', { name: '清除篩選' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(visibleTitles()).toEqual(allTitles)
    expect(screen.getByRole('searchbox', { name: '搜尋' })).toHaveFocus()
  })

  it('preserves practice and resume links after filtering, as well as the home breadcrumb', async () => {
    const repo = createMemoryPracticeRepository('test')
    await repo.getOrCreateDraft(fixtures[2].quiz)
    const user = renderLibrary(fixtures, repo)
    expect(await screen.findByRole('link', { name: /繼續作答/ })).toHaveAttribute('href', '/quiz/warmup')
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), 'Logic')
    expect(screen.getByRole('link', { name: /開始練習/ })).toHaveAttribute('href', '/quiz/challenge')
    expect(screen.getByRole('link', { name: /繼續作答/ })).toHaveAttribute('href', '/quiz/warmup')
    expect(screen.getByRole('link', { name: '練習首頁' })).toHaveAttribute('href', '/')
  })
})
