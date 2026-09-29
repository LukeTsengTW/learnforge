// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { PracticeRecord } from '../features/quiz/practice-repository'
import { PracticeContext, type PracticeRepository } from '../features/quiz/practice-context'
import { quizCatalog } from '../features/quiz/quiz-loader'
import { gradeQuizV3 } from '../lib/grading'
import type { TrustedRubricJudgment } from '../models/attempt'
import type { AnswerMap } from '../models/attempt'
import { GRADING_VERSION } from '../models/grading-version'
import { ResultPage } from './ResultPage'

vi.mock('../features/ai/use-ai-tutor', () => ({ useAiTutor: () => ({}) }))
vi.mock('../features/ai/AiTutorControls', () => ({ AiTutorControls: () => null, AiQuotaStatus: () => null }))
vi.mock('../features/ai/AiGradingControls', () => ({ AiGradingControls: () => <div data-testid="ai-grading-controls" /> }))
vi.mock('../features/ai/AiDrawingControls', () => ({ AiDrawingControls: () => <div data-testid="ai-drawing-controls" /> }))

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const quiz = quizCatalog.getCurrentQuiz('demo')!
const rubricJudgment = (questionId: 'q6' | 'q7', awards: number[]): TrustedRubricJudgment => {
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
    score, maxScore: question.points,
    model: 'gpt-6-luna', reasoningEffort: 'medium',
    criteria, confidence: 'medium', summary: 'The answer meets some rubric criteria.',
    ...(questionId === 'q6' ? { strengths: ['Correct factorization'], improvements: ['Show substitution'] }
      : { observations: ['Gate outline is visible'], missingOrUnclear: ['Output label'] }) }
}

describe('v3 result page', () => {
  it('shows the official six-type score, disclaimer, partial count, and no advisory grading controls', async () => {
    const attemptId = '00000000-0000-4000-8000-000000000001'
    const answers: AnswerMap = {
      q1: { type: 'single', optionId: 'b' }, q2: { type: 'single', optionId: 'b' },
      q3: { type: 'multiple', optionIds: ['b', 'c', 'd'] }, q4: { type: 'true-false', value: true },
      q5: { type: 'fill', text: 'XOR' }, q6: { type: 'calculation', text: '2x^2-7x+3=(2x-1)(x-3)' },
      q7: { type: 'drawing', strokes: [{ tool: 'pen', color: '#202b38', width: 2, points: [{ x: 10, y: 10 }, { x: 40, y: 40 }] }] },
    }
    const result = gradeQuizV3(quiz, answers, [{ questionId: 'q5', source: 'rule', status: 'correct', reason: null }], [
      rubricJudgment('q6', [2, 1, 0]), rubricJudgment('q7', [1, 1, 0, 0]),
    ])
    expect(result).toMatchObject({ score: 15, maxScore: 20, partialCount: 2 })
    const record = { id: attemptId, row: { id: attemptId, user_id: 'student', quiz_id: quiz.id,
      quiz_revision: quiz.revision, status: 'submitted', submitted_at: '2026-09-28T00:00:00Z',
      grading_version: GRADING_VERSION.aiGradingV3 }, quiz,
      attempt: { schemaVersion: 1, quizId: quiz.id, quizRevision: quiz.revision,
        startedAt: '2026-09-28T00:00:00Z', updatedAt: '2026-09-28T00:00:00Z', submittedAt: '2026-09-28T00:00:00Z',
        status: 'submitted', answers, result }, version: { id: attemptId, updatedAt: '2026-09-28T00:00:00Z' },
    } as unknown as PracticeRecord
    const loadAttempt = vi.fn(async () => record)
    render(<PracticeContext.Provider value={{ loadAttempt } as unknown as PracticeRepository}>
      <MemoryRouter initialEntries={[`/result/${attemptId}`]}><Routes>
        <Route path="/result/:attemptId" element={<ResultPage />} />
      </Routes></MemoryRouter>
    </PracticeContext.Provider>)
    expect(await screen.findByRole('heading', { name: '本次練習得分' })).toBeInTheDocument()
    expect(document.querySelector('.result-summary')).toHaveTextContent('15/ 20')
    expect(document.querySelector('.result-counts')).toHaveTextContent('部分得分2')
    expect(screen.getByText('部分題型使用 AI 自動評分。AI 自動評分僅供學習參考，可能存在誤判。')).toBeInTheDocument()
    expect(screen.queryByText(/計算題與畫圖題未納入自動評分/)).toBeNull()
    expect(screen.queryByTestId('ai-grading-controls')).toBeNull()
    expect(screen.queryByTestId('ai-drawing-controls')).toBeNull()
  })
})
