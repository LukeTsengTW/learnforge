// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { PracticeContext, type PracticeRepository } from '../features/quiz/practice-context'
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
})
