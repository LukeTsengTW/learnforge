// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../features/auth/auth-context'
import { PracticeContext } from '../features/quiz/practice-context'
import { quizCatalog, type QuizCatalogEntry } from '../features/quiz/quiz-loader'
import { HomePage } from './HomePage'

const originalCatalog = quizCatalog.current
const booleanEntry = originalCatalog.find(({ quiz }) => quiz.id === 'boolean-algebra')!

function renderHome(entries: QuizCatalogEntry[]) {
  quizCatalog.current = entries
  render(<AuthContext.Provider value={{ account: null, loading: false, error: null, service: null, refresh: async () => {} }}>
    <PracticeContext.Provider value={null}>
      <MemoryRouter><HomePage /></MemoryRouter>
    </PracticeContext.Provider>
  </AuthContext.Provider>)
}

afterEach(() => { cleanup(); quizCatalog.current = originalCatalog })

describe('Home featured quiz', () => {
  it('keeps boolean algebra featured when another quiz sorts first', () => {
    const earlier = { ...booleanEntry, quiz: { ...booleanEntry.quiz, id: 'earlier-title', title: '2025 Sorting First' } }
    renderHome([earlier, ...originalCatalog])
    const card = screen.getByRole('article')
    expect(within(card).getByRole('heading', { name: '布林代數基礎', level: 3 })).toBeInTheDocument()
    expect(within(card).queryByRole('heading', { name: '2025 Sorting First' })).not.toBeInTheDocument()
  })

  it('uses the featured entry declared total rather than deterministic capacity', () => {
    renderHome([{ ...booleanEntry, totalPoints: 100, maxPoints: 36 }])
    const card = screen.getByRole('article')
    expect(within(card).getByText('總分 100 分')).toBeInTheDocument()
    expect(within(card).queryByText('36 分自動評分')).not.toBeInTheDocument()
  })
})
