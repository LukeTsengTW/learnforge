// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { SubmitProgressCard } from './SubmitProgress'

afterEach(cleanup)
const activeStep = () => within(screen.getByRole('region', { name: '正在提交測驗' })).getAllByRole('listitem')
  .find((item) => item.getAttribute('aria-current') === 'step')!

describe('submission progress card', () => {
  it('names the question types of this quiz that may need AI grading', () => {
    render(<SubmitProgressCard progress={{ stage: 'grade', startedAt: Date.now(), waiting: false }} answeredCount={3}
      questionCount={5} aiGradedLabels={['填空題', '畫圖題']} />)
    expect(activeStep()).toHaveTextContent('填空題、畫圖題可能需要 AI 逐題評分')
    expect(screen.getByRole('status')).toHaveTextContent(/^步驟 3 \/ 4：評分作答$/)
  })

  it('says grading is by rule when no question of the quiz needs AI', () => {
    render(<SubmitProgressCard progress={{ stage: 'grade', startedAt: Date.now(), waiting: false }} answeredCount={4}
      questionCount={4} aiGradedLabels={[]} />)
    expect(activeStep()).toHaveTextContent('由系統自動評分。')
    expect(activeStep()).not.toHaveTextContent('AI')
  })

  it('announces a wait on grading that is already in progress', () => {
    render(<SubmitProgressCard progress={{ stage: 'grade', startedAt: Date.now(), waiting: true }} answeredCount={4}
      questionCount={4} aiGradedLabels={['計算題']} />)
    expect(screen.getByRole('status')).toHaveTextContent('步驟 3 / 4：評分作答（等待進行中的評分）')
    expect(activeStep()).toHaveTextContent('這份作答已有評分正在進行，正在等待結果。')
  })

  it('shows how many questions are answered while the draft is saved', () => {
    render(<SubmitProgressCard progress={{ stage: 'save', startedAt: Date.now(), waiting: false }} answeredCount={2}
      questionCount={7} aiGradedLabels={[]} />)
    expect(activeStep()).toHaveTextContent('儲存最新作答到雲端已作答 2 / 7 題進行中')
    expect(screen.getByRole('progressbar', { name: '提交進度' })).toHaveAttribute('aria-valuetext', '第 1 步，共 4 步')
  })
})
