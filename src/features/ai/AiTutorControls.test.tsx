// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiQuotaStatus, AiTutorControls } from './AiTutorControls'
import type { AiTutorState } from './use-ai-tutor'

afterEach(cleanup)

function tutor(remaining: number, response: AiTutorState['result'] = () => null): AiTutorState {
  return {
    enabled: true, quota: { limit: 20, used: 20 - remaining, remaining, windowSeconds: 18000,
      nextCreditAt: null, featureCosts: { hint: 1, explain_mistake: 1, explain_solution: 2 } },
    quotaError: false, quotaLoading: false, refreshQuota: vi.fn(), result: response,
    error: () => null, busy: () => false, pending: () => false, run: vi.fn(),
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
  it('keeps an existing response visible after quota reaches zero and renders Markdown without raw HTML', () => {
    const state = tutor(0, () => ({ title: '下一步', message: '**重點** <script>alert(1)</script> 與 $x^2$',
      keyPoints: ['先列條件'], nextStep: '自行再試一次' }))
    const view = render(<AiTutorControls tutor={state} questionId="q1" features={['hint']} />)
    expect(screen.getByRole('heading', { name: '下一步' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /AI 提示/ })).toBeNull()
    expect(view.container.querySelector('script')).toBeNull()
  })
  it('shows textual quota and disclaimer and calls the action only on a click', () => {
    const state = tutor(17)
    render(<><AiQuotaStatus tutor={state} /><AiTutorControls tutor={state} questionId="q1" features={['hint']} /></>)
    expect(screen.getByText(/AI 額度/).textContent).toContain('17 / 20')
    expect(screen.getByText(/AI 建議僅供學習參考/)).toBeTruthy()
    expect(state.run).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /AI 提示/ }))
    expect(state.run).toHaveBeenCalledWith('hint', 'q1', undefined)
  })
  it('can retrieve an already pending response even when no new credit remains', () => {
    const state = tutor(0)
    state.pending = () => true
    state.error = () => '網路連線中斷，請確認連線後重試。'
    render(<AiTutorControls tutor={state} questionId="q1" features={['hint']} />)
    expect(screen.queryByRole('button', { name: /AI 提示/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '重試取得前次說明' }))
    expect(state.run).toHaveBeenCalledWith('hint', 'q1')
  })
})
