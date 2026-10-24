// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../features/auth/auth-context'
import { PracticeContext } from '../features/quiz/practice-context'
import { createMemoryPracticeRepository } from '../features/quiz/practice-memory.test-helper'
import { createQuizCatalog, quizCatalog, type QuizCatalogEntry } from '../features/quiz/quiz-loader'
import { fixtureQuizSources } from '../test-fixtures/fixture-quizzes.test-helper'
import { QUESTION_LABEL, QUESTION_TYPE, type QuestionType } from '../models/quiz'
import { LibraryPage } from './LibraryPage'

const originalCatalog = quizCatalog.current
const demo = createQuizCatalog(fixtureQuizSources).getCurrentQuiz('demo')!

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
const midterm2021Title = '2021 Discrete Mathematics 期中考'
const midterm2023Title = '2023 Discrete Mathematics 期中考'
const midterm2024Title = '2024 Discrete Mathematics 期中考'
const midtermTitle = '2025 Discrete Mathematics 期中考'
const countingTitle = '離散數學第一章：計數的基本原理－例題練習'
const exercisesTitle = '離散數學習題 Ch1、Ch3、Ch5、Ch7、Ch8'
const setTheoryTitle = '離散數學第三章：集合論－例題練習'
const relationsFunctionsTitle = '離散數學第五章：關係和函數－例題練習'
const chapter7Title = '離散數學第七章：關係－第二回－例題練習'
const chapter8Title = '離散數學第八章：包含及互斥原理－例題練習'
const digitalSystemsTitle = '【課本題目】數位系統導論 - Chapter 1'
const digitalSystems2Title = '【課本題目】數位系統導論 - Chapter 2'
const digitalSystems3Title = '【課本題目】數位系統導論 - Chapter 3'
const digitalSystems4Title = '【課本題目】數位系統導論 - Chapter 4'
const bundledTitles = originalCatalog.map(({ quiz }) => quiz.title)
const inCatalogOrder = (...titles: string[]) => bundledTitles.filter((title) => titles.includes(title))

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

  it('shows the audited digital systems quiz with its current metadata and link', () => {
    renderLibrary(originalCatalog)
    const card = screen.getByRole('heading', { name: digitalSystemsTitle, level: 2 }).closest('article')!
    expect(within(card).getByText('數位系統導論')).toBeInTheDocument()
    expect(within(card).getByText('42 題')).toBeInTheDocument()
    expect(within(card).getByText('總分 206 分')).toBeInTheDocument()
    expect(within(card).getByText('約 170 分鐘')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: /開始練習/ }))
      .toHaveAttribute('href', '/quiz/digital-systems-ch1-textbook')
  })

  it('shows the audited digital systems chapter 2 quiz with its current metadata and link', () => {
    renderLibrary(originalCatalog)
    const card = screen.getByRole('heading', { name: digitalSystems2Title, level: 2 }).closest('article')!
    expect(within(card).getByText('數位系統導論')).toBeInTheDocument()
    expect(within(card).getByText('26 題')).toBeInTheDocument()
    expect(within(card).getByText('總分 122 分')).toBeInTheDocument()
    expect(within(card).getByText('約 115 分鐘')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: /開始練習/ }))
      .toHaveAttribute('href', '/quiz/digital-systems-ch2-textbook')
  })

  it('shows the audited digital systems chapter 3 quiz with its current metadata and link', () => {
    renderLibrary(originalCatalog)
    const card = screen.getByRole('heading', { name: digitalSystems3Title, level: 2 }).closest('article')!
    expect(within(card).getByText('數位系統導論')).toBeInTheDocument()
    expect(within(card).getByText('24 題')).toBeInTheDocument()
    expect(within(card).getByText('總分 152 分')).toBeInTheDocument()
    expect(within(card).getByText('約 135 分鐘')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: /開始練習/ }))
      .toHaveAttribute('href', '/quiz/digital-systems-ch3-textbook')
  })

  it('shows the audited digital systems chapter 4 quiz with its current metadata and link', () => {
    renderLibrary(originalCatalog)
    const card = screen.getByRole('heading', { name: digitalSystems4Title, level: 2 }).closest('article')!
    expect(within(card).getByText('數位系統導論')).toBeInTheDocument()
    expect(within(card).getByText('15 題')).toBeInTheDocument()
    expect(within(card).getByText('總分 97 分')).toBeInTheDocument()
    expect(within(card).getByText('約 105 分鐘')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: /開始練習/ }))
      .toHaveAttribute('href', '/quiz/digital-systems-ch4-textbook')
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

  it('shows the separate Chapter 1 calculation quiz with its full declared points', () => {
    renderLibrary(originalCatalog)
    const card = screen.getByRole('heading', { name: countingTitle, level: 2 }).closest('article')!
    expect(within(card).getByText('離散數學')).toBeInTheDocument()
    expect(within(card).getByText('26 題')).toBeInTheDocument()
    expect(within(card).getByText('總分 150 分')).toBeInTheDocument()
    expect(within(card).getByText('約 120 分鐘')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: /開始練習/ }))
      .toHaveAttribute('href', '/quiz/discrete-math-ch1-counting-examples')
  })

  it('shows Chapter 7 with its current revision facts and practice route', () => {
    renderLibrary(originalCatalog)
    const card = screen.getByRole('heading', { name: chapter7Title, level: 2 }).closest('article')!
    expect(within(card).getByText('離散數學')).toBeInTheDocument()
    expect(within(card).getByText('21 題')).toBeInTheDocument()
    expect(within(card).getByText('總分 150 分')).toBeInTheDocument()
    expect(within(card).getByText('約 120 分鐘')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: /開始練習/ }))
      .toHaveAttribute('href', '/quiz/discrete-math-ch7-relations-second-examples')
  })

  it.each([
    ['2025', [midtermTitle]],
    ['Discrete Mathematics', inCatalogOrder(midterm2021Title, midterm2023Title, midterm2024Title, midtermTitle)],
    ['期中考', inCatalogOrder(midterm2021Title, midterm2023Title, midterm2024Title, midtermTitle)],
  ])('finds the matching bundled midterm(s) with %s', async (query, expected) => {
    const user = renderLibrary(originalCatalog)
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), query)
    expect(visibleTitles()).toEqual(expected)
  })

  it('shows the separate 2026 exercises quiz with its declared points, tags and quiz link', () => {
    renderLibrary(originalCatalog)
    const card = screen.getByRole('heading', { name: exercisesTitle, level: 2 }).closest('article')!
    expect(within(card).getByText('離散數學')).toBeInTheDocument()
    expect(within(card).getByText('13 題')).toBeInTheDocument()
    expect(within(card).getByText('總分 150 分')).toBeInTheDocument()
    expect(within(card).getByText('約 120 分鐘')).toBeInTheDocument()
    expect(within(within(card).getByRole('list', { name: '題庫標籤' })).getAllByRole('listitem').map((tag) => tag.textContent))
      .toEqual(['counting', 'permutations', 'combinations', 'stars-and-bars', 'inclusion-exclusion', 'sets', 'relations',
        'equivalence-relations', 'functions', 'stirling-numbers'])
    expect(within(card).getByRole('link', { name: /開始練習/ }))
      .toHaveAttribute('href', '/quiz/discrete-math-exercises-2026')
  })

  it('shows the separate Chapter 3 set theory quiz with its declared points, tags and quiz link', () => {
    renderLibrary(originalCatalog)
    const card = screen.getByRole('heading', { name: setTheoryTitle, level: 2 }).closest('article')!
    expect(within(card).getByText('離散數學')).toBeInTheDocument()
    expect(within(card).getByText('13 題')).toBeInTheDocument()
    expect(within(card).getByText('總分 150 分')).toBeInTheDocument()
    expect(within(card).getByText('約 120 分鐘')).toBeInTheDocument()
    expect(within(within(card).getByRole('list', { name: '題庫標籤' })).getAllByRole('listitem').map((tag) => tag.textContent))
      .toEqual(['sets', 'subsets', 'power-set', 'set-operations', 'set-laws', 'duality', 'de-morgan', 'venn-diagram', 'inclusion-exclusion'])
    expect(within(card).getByRole('link', { name: /開始練習/ }))
      .toHaveAttribute('href', '/quiz/discrete-math-ch3-set-theory-examples')
  })

  it('shows the separate Chapter 5 relations and functions quiz (current revision 2) with its declared points, tags and quiz link', () => {
    renderLibrary(originalCatalog)
    const card = screen.getByRole('heading', { name: relationsFunctionsTitle, level: 2 }).closest('article')!
    expect(within(card).getByText('離散數學')).toBeInTheDocument()
    expect(within(card).getByText('18 題')).toBeInTheDocument()
    expect(within(card).getByText('總分 136 分')).toBeInTheDocument()
    expect(within(card).getByText('約 100 分鐘')).toBeInTheDocument()
    expect(within(within(card).getByRole('list', { name: '題庫標籤' })).getAllByRole('listitem').map((tag) => tag.textContent))
      .toEqual(['cartesian-product', 'relations', 'functions', 'one-to-one', 'onto', 'stirling-numbers', 'pigeonhole-principle'])
    expect(within(card).getByRole('link', { name: /開始練習/ }))
      .toHaveAttribute('href', '/quiz/discrete-math-ch5-relations-functions-examples')
  })

  it.each([
    ['第五章', [relationsFunctionsTitle]],
    ['關係和函數', [relationsFunctionsTitle]],
    ['pigeonhole-principle', inCatalogOrder(midterm2023Title, midterm2024Title, relationsFunctionsTitle)],
  ])('finds the matching quiz with %s', async (query, expected) => {
    const user = renderLibrary(originalCatalog)
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), query)
    expect(visibleTitles()).toEqual(expected)
  })

  it.each(['第三章', '集合論', 'power-set'])('finds the Chapter 3 quiz with %s', async (query) => {
    const user = renderLibrary(originalCatalog)
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), query)
    expect(visibleTitles()).toEqual([setTheoryTitle])
  })

  it.each([
    ['第一章', [countingTitle]],
    ['計數的基本原理', [countingTitle]],
    ['binomial-theorem', inCatalogOrder(midterm2021Title, midterm2023Title, countingTitle)],
  ])('finds the matching quiz with %s', async (query, expected) => {
    const user = renderLibrary(originalCatalog)
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), query)
    expect(visibleTitles()).toEqual(expected)
  })

  it.each(['Ch7', '五份習題解答'])('finds the 2026 exercises quiz with %s', async (query) => {
    const user = renderLibrary(originalCatalog)
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), query)
    expect(visibleTitles()).toEqual([exercisesTitle])
  })

  it('finds all stirling-numbers quizzes when the tag is searched', async () => {
    const user = renderLibrary(originalCatalog)
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), 'stirling-numbers')
    expect(visibleTitles()).toEqual(inCatalogOrder(midterm2021Title, midterm2023Title, exercisesTitle, relationsFunctionsTitle))
  })

  it('finds all stars-and-bars quizzes when the tag is searched', async () => {
    const user = renderLibrary(originalCatalog)
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), 'stars-and-bars')
    expect(visibleTitles()).toEqual(inCatalogOrder(midterm2021Title, midterm2023Title, midterm2024Title,
      countingTitle, exercisesTitle, chapter8Title))
  })

  it.each([
    ['科目', '離散數學', inCatalogOrder(midterm2021Title, midterm2023Title, midterm2024Title, midtermTitle,
      countingTitle, exercisesTitle, setTheoryTitle, relationsFunctionsTitle, chapter7Title, chapter8Title)],
    ['科目', '數位系統導論', inCatalogOrder(digitalSystemsTitle, digitalSystems2Title, digitalSystems3Title, digitalSystems4Title)],
    ['題型', QUESTION_TYPE.single, inCatalogOrder(midterm2023Title, midterm2024Title, midtermTitle, '經濟學第 1～5 章習題')],
    ['題型', QUESTION_TYPE.calculation, inCatalogOrder(midterm2021Title, midterm2023Title, midterm2024Title, midtermTitle,
      countingTitle, exercisesTitle, setTheoryTitle, relationsFunctionsTitle, chapter7Title, chapter8Title, digitalSystemsTitle, digitalSystems2Title, digitalSystems3Title, digitalSystems4Title)],
    ['標籤', 'combinatorics', inCatalogOrder(midterm2021Title, midterm2023Title, midterm2024Title, midtermTitle)],
    ['標籤', 'inclusion-exclusion', inCatalogOrder(midterm2021Title, midterm2023Title, midterm2024Title,
      midtermTitle, exercisesTitle, setTheoryTitle, chapter8Title)],
    ['標籤', 'sets', inCatalogOrder(midterm2023Title, exercisesTitle, setTheoryTitle)],
    ['標籤', 'de-morgan', [setTheoryTitle]],
    ['標籤', 'relations', inCatalogOrder(midterm2021Title, midterm2023Title, midterm2024Title,
      midtermTitle, exercisesTitle, relationsFunctionsTitle, chapter7Title)],
    ['標籤', 'counting', inCatalogOrder(midterm2021Title, midterm2023Title, midterm2024Title,
      midtermTitle, countingTitle, exercisesTitle, chapter8Title)],
    ['標籤', 'stars-and-bars', inCatalogOrder(midterm2021Title, midterm2023Title, midterm2024Title,
      countingTitle, exercisesTitle, chapter8Title)],
    ['標籤', 'stirling-numbers', inCatalogOrder(midterm2021Title, midterm2023Title, exercisesTitle, relationsFunctionsTitle)],
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
