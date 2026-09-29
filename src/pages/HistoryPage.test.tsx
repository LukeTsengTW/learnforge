// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PracticeContext, type PracticeRepository } from '../features/quiz/practice-context'
import type { PracticeRecord } from '../features/quiz/practice-repository'
import { quizCatalog } from '../features/quiz/quiz-loader'
import { GRADING_VERSION } from '../models/grading-version'
import { HistoryPage } from './HistoryPage'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('history restores persisted v3 scores', () => {
  it('shows six-type total and partial count from the reconstructed result without grading again', async () => {
    const quiz = quizCatalog.getCurrentQuiz('demo')!
    const record = { id: 'attempt-v3', row: { id: 'attempt-v3', quiz_id: quiz.id,
      quiz_revision: quiz.revision, status: 'submitted', submitted_at: '2026-09-28T00:00:00Z',
      grading_version: GRADING_VERSION.aiGradingV3 }, quiz,
      attempt: { status: 'submitted', submittedAt: '2026-09-28T00:00:00Z', result: {
        score: 15, maxScore: 20, correctCount: 3, partialCount: 2, incorrectCount: 1,
        unansweredCount: 1, manualCount: 0, questions: [],
      } }, version: { id: 'attempt-v3', updatedAt: '2026-09-28T00:00:00Z' },
    } as unknown as PracticeRecord
    const listSubmittedPage = vi.fn(async () => ({ records: [record], nextOffset: null }))
    render(<PracticeContext.Provider value={{ listSubmittedPage } as unknown as PracticeRepository}>
      <MemoryRouter><HistoryPage /></MemoryRouter>
    </PracticeContext.Provider>)
    expect(await screen.findByText('15 / 20')).toBeInTheDocument()
    expect(screen.getByText(/部分得分 2/)).toBeInTheDocument()
    expect(listSubmittedPage).toHaveBeenCalledTimes(1)
  })
})
