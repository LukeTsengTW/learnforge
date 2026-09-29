// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { PracticeContext, type PracticeRepository } from '../features/quiz/practice-context'
import { quizCatalog } from '../features/quiz/quiz-loader'
import type { AnalyticsAttempt } from '../models/analytics'
import type { TrustedRubricJudgment } from '../models/attempt'
import { GRADING_VERSION } from '../models/grading-version'
import { AnalyticsPage } from './AnalyticsPage'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
function renderWith(repo: Pick<PracticeRepository, 'listSubmittedAnalyticsPage'>) {
  render(<PracticeContext.Provider value={repo as PracticeRepository}><HashRouter><AnalyticsPage /></HashRouter></PracticeContext.Provider>)
}
describe('analytics loading states', () => {
  it('shows an invitation instead of a grid of zero percentages when there are no submissions', async () => {
    renderWith({ listSubmittedAnalyticsPage: vi.fn(async () => ({ records: [], nextOffset: null })) })
    expect(await screen.findByText('完成一次練習後，這裡會整理你的學習紀錄。')).toBeInTheDocument()
    expect(screen.queryByText('0%')).toBeNull()
  })
  it('does not display partial cloud history as a complete offline analysis', async () => {
    renderWith({ listSubmittedAnalyticsPage: vi.fn(async () => { throw new Error('offline') }) })
    expect(await screen.findByRole('alert')).toHaveTextContent('目前無法取得完整學習分析')
    expect(screen.queryByRole('heading', { name: '整體概況' })).toBeNull()
  })
  it('makes one history scan when StrictMode replays the mount effect', async () => {
    const listSubmittedAnalyticsPage = vi.fn(async () => ({ records: [], nextOffset: null }))
    render(<StrictMode><PracticeContext.Provider value={{ listSubmittedAnalyticsPage } as unknown as PracticeRepository}>
      <HashRouter><AnalyticsPage /></HashRouter>
    </PracticeContext.Provider></StrictMode>)
    expect(await screen.findByText('完成一次練習後，這裡會整理你的學習紀錄。')).toBeInTheDocument()
    expect(listSubmittedAnalyticsPage).toHaveBeenCalledTimes(1)
  })
  it('uses persisted v3 rubric evidence for overall score rate without an AI request', async () => {
    const quiz = quizCatalog.getCurrentQuiz('demo')!
    const rubric = (questionId: 'q6' | 'q7', awards: number[]): TrustedRubricJudgment => {
      const question = quiz.questions.find((item) => item.id === questionId)!
      const criteria = question.rubric.map((criterion, index) => {
        const maxScore = criterion.score!
        const awardedScore = awards[index]
        return { criterionId: `r${index + 1}`, maxScore, awardedScore,
          status: awardedScore === maxScore ? 'full' as const : awardedScore === 0 ? 'none' as const : 'partial' as const }
      })
      const score = awards.reduce((sum, item) => sum + item, 0)
      return { questionId, questionType: question.type as 'calculation' | 'drawing', answerHash: 'a'.repeat(64),
        source: 'ai', status: score === question.points ? 'correct' : score === 0 ? 'incorrect' : 'partial',
        score, maxScore: question.points, criteria, model: 'gpt-6-luna', reasoningEffort: 'medium',
        confidence: 'medium', summary: 'Persisted rubric result.' }
    }
    const record: AnalyticsAttempt = { id: 'v3', quizId: quiz.id, quizRevision: quiz.revision,
      submittedAt: '2026-09-28T00:00:00Z', status: 'submitted', quiz, gradingVersion: GRADING_VERSION.aiGradingV3,
      answers: { q1: { type: 'single', optionId: 'b' }, q2: { type: 'single', optionId: 'b' },
        q3: { type: 'multiple', optionIds: ['b', 'c', 'd'] }, q4: { type: 'true-false', value: true },
        q5: { type: 'fill', text: 'XOR' }, q6: { type: 'calculation', text: 'partial work' },
        q7: { type: 'drawing', strokes: [{ tool: 'pen', color: '#202b38', width: 2,
          points: [{ x: 10, y: 10 }, { x: 40, y: 40 }] }] } },
      fillJudgments: [{ questionId: 'q5', source: 'rule', status: 'correct', reason: null }],
      rubricJudgments: [rubric('q6', [2, 1, 0]), rubric('q7', [1, 1, 0, 0])] }
    const listSubmittedAnalyticsPage = vi.fn(async () => ({ records: [record], nextOffset: null }))
    renderWith({ listSubmittedAnalyticsPage })
    expect(await screen.findByText('整體得分率')).toBeInTheDocument()
    expect(screen.getByText(/15 \/ 20 · 75%/)).toBeInTheDocument()
    expect(screen.getByText(/ai-grading-v3 1 筆/)).toBeInTheDocument()
    expect(screen.getByText(/不會重新呼叫 AI/)).toBeInTheDocument()
    expect(listSubmittedAnalyticsPage).toHaveBeenCalledTimes(1)
  })
})
