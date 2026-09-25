// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiQuotaStatus, AiTutorControls } from './AiTutorControls'
import type { AiTutorState, AiRequestState } from './use-ai-tutor'

afterEach(cleanup)
const output = { title: '下一步', message: '**重點** <script>alert(1)</script> 與 $x^2$',
  keyPoints: ['先列條件'], nextStep: '自行再試一次' }
function tutor(remaining: number, state: AiRequestState = { kind: 'idle', response: null }): AiTutorState {
  return {
    enabled: true, quota: { limit: 20, used: 20 - remaining, remaining, windowSeconds: 18000,
      serverNow: '2026-09-25T12:00:00Z', nextCreditAt: remaining ? null : '2026-09-25T12:30:00Z',
      featureCosts: { hint: 1, explain_mistake: 1, explain_solution: 2, calculation_grading: 2 } },
    quotaError: false, quotaLoading: false, refreshQuota: vi.fn(), restoring: false,
    restoreError: false, restore: vi.fn(), state: () => state, result: () => state.response, run: vi.fn(),
    gradingState: () => ({ kind: 'idle', response: null }), runGrading: vi.fn(),
  }
}

describe('AI Tutor controls', () => {
  it('shows only affordable actions at 0, 1 and 2 credits', () => {
    const features = ['explain_mistake', 'explain_solution'] as const
    const view = render(<AiTutorControls tutor={tutor(0)} questionId="q1" features={features} />)
    expect(screen.queryByRole('button', { name: /AI 解釋/ })).toBeNull()
    view.rerender(<AiTutorControls tutor={tutor(1)} questionId="q1" features={features} />)
    expect(screen.getByRole('button', { name: /AI 解釋我錯在哪/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /AI 換個方式解釋/ })).toBeNull()
    view.rerender(<AiTutorControls tutor={tutor(2)} questionId="q1" features={features} />)
    expect(screen.getByRole('button', { name: /AI 換個方式解釋/ })).toBeTruthy()
  })

  it('keeps restored content readable at zero credits and hides regeneration', () => {
    const view = render(<AiTutorControls tutor={tutor(0, { kind: 'completed', response: output })}
      questionId="q1" features={['hint']} />)
    expect(screen.getByRole('heading', { name: '下一步' })).toBeTruthy()
    expect(screen.getByText('AI 建議')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /重新產生/ })).toBeNull()
    expect(view.container.querySelector('script')).toBeNull()
  })

  it('uses server timestamps to explain the next rolling credit', () => {
    const state = tutor(0)
    render(<MemoryRouter><AiQuotaStatus tutor={state} /></MemoryRouter>)
    expect(screen.getByText(/30 分鐘後恢復 1 credit/)).toBeTruthy()
    expect(screen.getByText(/已用 20/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'AI 使用紀錄' })).toBeTruthy()
  })

  it('shows explicit regeneration only when affordable', () => {
    const state = tutor(2, { kind: 'completed', response: output })
    render(<AiTutorControls tutor={state} questionId="q1" features={['explain_solution']} />)
    fireEvent.click(screen.getByRole('button', { name: '重新產生 AI 解釋 · 2 credits' }))
    expect(state.run).toHaveBeenCalledWith('explain_solution', 'q1', undefined, true)
  })

  it('rechecks a pending DB request without starting model generation', () => {
    const state = tutor(0, { kind: 'pending', response: null, message: '先前的 AI 請求仍在處理中。' })
    render(<AiTutorControls tutor={state} questionId="q1" features={['hint']} />)
    fireEvent.click(screen.getByRole('button', { name: '重新檢查' }))
    expect(state.restore).toHaveBeenCalledOnce()
    expect(state.run).not.toHaveBeenCalled()
  })

  it('retries an ambiguous request ID even after credit is spent', () => {
    const state = tutor(0, { kind: 'retryable', response: null, message: '網路連線中斷。' })
    render(<AiTutorControls tutor={state} questionId="q1" features={['hint']} />)
    fireEvent.click(screen.getByRole('button', { name: '重試取得前次說明' }))
    expect(state.run).toHaveBeenCalledWith('hint', 'q1')
  })
})
