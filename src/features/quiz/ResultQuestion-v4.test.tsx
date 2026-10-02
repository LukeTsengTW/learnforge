// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { AiTutorState } from '../ai/use-ai-tutor'
import { GRADING_VERSION } from '../../models/grading-version'
import { HistoryPage } from '../../pages/HistoryPage'
import { ResultPage } from '../../pages/ResultPage'
import { PracticeContext, type PracticeRepository } from './practice-context'
import { mapPracticeRecord, type PracticeRecord } from './practice-repository'
import type { JudgmentRow, RubricJudgmentRow } from './repositories'
import { ResultQuestion } from './ResultQuestion'
import { ACTIVE_TEXT, INACTIVE_TEXT, submittedV4Rows, v4Catalog, v4Quiz } from './practice-v4.test-helper'

const tutorFeatures: string[][] = []
vi.mock('../ai/AiGradingControls', () => ({ AiGradingControls: () => <div data-testid="ai-grading-controls" /> }))
vi.mock('../ai/AiDrawingControls', () => ({ AiDrawingControls: () => <div data-testid="ai-drawing-controls" /> }))
vi.mock('../ai/AiTutorControls', () => ({
  AiTutorControls: ({ features }: { features: string[] }) => { tutorFeatures.push(features); return <div data-testid="ai-tutor-controls" /> },
  AiQuotaStatus: () => null,
}))
vi.mock('../ai/use-ai-tutor', () => ({ useAiTutor: () => ({}) }))

beforeEach(() => {
  tutorFeatures.length = 0
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() } as unknown as CanvasRenderingContext2D)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function reconstructed(): PracticeRecord {
  const fixture = submittedV4Rows()
  return mapPracticeRecord(fixture.row as never, 'student', v4Catalog,
    fixture.fill as unknown as JudgmentRow[], fixture.rubric as unknown as RubricJudgmentRow[])
}
const tutor = {} as AiTutorState

describe('M5 official v4 result question', () => {
  it('renders only the active text for a text-mode calculation and shows official AI grading', () => {
    const record = reconstructed()
    if (record.attempt?.status !== 'submitted') throw new Error('expected submitted')
    const index = v4Quiz.questions.findIndex((question) => question.id === 'q_text')
    render(<ResultQuestion question={v4Quiz.questions[index]} answer={record.attempt.answers.q_text}
      grade={record.attempt.result.questions[index]} index={index} gradingVersion={GRADING_VERSION.aiGradingV4} aiTutor={tutor} />)
    expect(screen.getByText(ACTIVE_TEXT)).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: '已提交的繪圖答案' })).toBeNull()
    expect(screen.getByRole('region', { name: 'AI 自動評分' })).toHaveTextContent('2.5 / 4 分')
    expect(screen.getByText('AI 自動評分僅供學習參考，可能存在誤判。')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-grading-controls')).toBeNull()
    expect(document.querySelector('.manual-notice')).toBeNull()
  })

  it('renders handwritten calculation with DrawingPreview of the active strokes and never the inactive text', () => {
    const record = reconstructed()
    if (record.attempt?.status !== 'submitted') throw new Error('expected submitted')
    const index = v4Quiz.questions.findIndex((question) => question.id === 'q_hand')
    render(<ResultQuestion question={v4Quiz.questions[index]} answer={record.attempt.answers.q_hand}
      grade={record.attempt.result.questions[index]} index={index} gradingVersion={GRADING_VERSION.aiGradingV4} aiTutor={tutor} />)
    const preview = screen.getByRole('img', { name: '已提交的繪圖答案' }) as HTMLCanvasElement
    expect(preview.width).toBe(800)
    expect(preview.height).toBe(600)
    expect(screen.queryByText(INACTIVE_TEXT)).toBeNull()
    expect(document.body.textContent).not.toContain(INACTIVE_TEXT)
    expect(screen.getByRole('region', { name: 'AI 自動評分' })).toHaveTextContent('0.3 / 4 分')
    expect(screen.getByText('做得好的地方：Setup')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-grading-controls')).toBeNull()
    expect(tutorFeatures.at(-1)).toEqual(['explain_solution'])
  })

  it('hides legacy AiDrawingControls for a v4 DrawingQuestion and keeps it a drawing result', () => {
    const record = reconstructed()
    if (record.attempt?.status !== 'submitted') throw new Error('expected submitted')
    const index = v4Quiz.questions.findIndex((question) => question.id === 'q_draw')
    render(<ResultQuestion question={v4Quiz.questions[index]} answer={record.attempt.answers.q_draw}
      grade={record.attempt.result.questions[index]} index={index} gradingVersion={GRADING_VERSION.aiGradingV4} aiTutor={tutor} />)
    expect(screen.getByRole('img', { name: '已提交的繪圖答案' })).toBeInTheDocument()
    expect(screen.getByText('圖中觀察：Outline')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-drawing-controls')).toBeNull()
  })
})

describe('M5 result and history pages for ai-grading-v4', () => {
  it('reloads a submitted v4 result from the repository only (no submit/provider path) and renders the active mode', async () => {
    const record = reconstructed()
    const loadAttempt = vi.fn(async () => record)
    const submitDraft = vi.fn()
    render(<PracticeContext.Provider value={{ loadAttempt, submitDraft } as unknown as PracticeRepository}>
      <MemoryRouter initialEntries={[`/result/${record.id}`]}><Routes>
        <Route path="/result/:attemptId" element={<ResultPage />} />
      </Routes></MemoryRouter></PracticeContext.Provider>)
    expect(await screen.findByRole('heading', { name: '本次練習得分' })).toBeInTheDocument()
    expect(document.querySelector('.result-summary')).toHaveTextContent('5.8/ 12')
    expect(document.querySelector('.result-counts')).toHaveTextContent('部分得分2')
    expect(screen.getAllByRole('img', { name: '已提交的繪圖答案' })).toHaveLength(2)
    expect(screen.getByText(ACTIVE_TEXT)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(INACTIVE_TEXT)
    expect(screen.queryByTestId('ai-grading-controls')).toBeNull()
    expect(screen.queryByTestId('ai-drawing-controls')).toBeNull()
    expect(loadAttempt).toHaveBeenCalledTimes(1)
    expect(submitDraft).not.toHaveBeenCalled()
  })

  it('shows the persisted v4 score with partial count in history', async () => {
    const listSubmittedPage = vi.fn(async () => ({ records: [reconstructed()], nextOffset: null }))
    render(<PracticeContext.Provider value={{ listSubmittedPage } as unknown as PracticeRepository}>
      <MemoryRouter><HistoryPage /></MemoryRouter></PracticeContext.Provider>)
    expect(await screen.findByText('5.8 / 12')).toBeInTheDocument()
    expect(screen.getByText(/部分得分 2/)).toBeInTheDocument()
  })

  it('shows unavailable (not a guessed score) for malformed v4 evidence', async () => {
    const fixture = submittedV4Rows()
    fixture.rubric[0].score = 99
    const record = mapPracticeRecord(fixture.row as never, 'student', v4Catalog,
      fixture.fill as unknown as JudgmentRow[], fixture.rubric as unknown as RubricJudgmentRow[])
    const listSubmittedPage = vi.fn(async () => ({ records: [record], nextOffset: null }))
    render(<PracticeContext.Provider value={{ listSubmittedPage } as unknown as PracticeRepository}>
      <MemoryRouter><HistoryPage /></MemoryRouter></PracticeContext.Provider>)
    expect(await screen.findByText('無法安全重現正式分數，請稍後重試')).toBeInTheDocument()
  })
})
