// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TutorContext } from './tutor-context'
import { TutorServiceError, type AiQuota, type TutorRestore, type TutorService } from './tutor-service'
import { useAiTutor } from './use-ai-tutor'

afterEach(cleanup)

const output = { title: '提示', message: '先整理條件。', keyPoints: [], nextStep: null }
const empty: TutorRestore = { responses: [], pending: [] }
const quota = (remaining: number): AiQuota => ({ limit: 20, used: 20 - remaining, remaining,
  windowSeconds: 18000, serverNow: '2026-09-25T12:00:00Z', nextCreditAt: null,
  featureCosts: { hint: 1, explain_mistake: 1, explain_solution: 2, calculation_grading: 2, drawing_analysis: 4 } })
function setup(overrides: Partial<TutorService> = {}) {
  const service: TutorService = {
    getQuota: vi.fn().mockResolvedValue(quota(2)),
    getResponses: vi.fn().mockResolvedValue(empty),
    getUsage: vi.fn(),
    request: vi.fn().mockResolvedValue(output),
    requestGrading: vi.fn(),
    requestDrawing: vi.fn(),
    ...overrides,
  }
  const wrapper = ({ children }: { children: ReactNode }) => <TutorContext.Provider value={service}>{children}</TutorContext.Provider>
  return { service, wrapper }
}

describe('AI Tutor persistence and request state', () => {
  it('restores all completed features on reload without reserving credit or calling AI', async () => {
    const restored: TutorRestore = { responses: [
      { questionId: 'q1', feature: 'hint', response: output, completedAt: '2026-09-25T11:00:00Z' },
      { questionId: 'q1', feature: 'explain_mistake', response: { ...output, title: '錯誤' }, completedAt: '2026-09-25T11:01:00Z' },
      { questionId: 'q1', feature: 'explain_solution', response: { ...output, title: '解答' }, completedAt: '2026-09-25T11:02:00Z' },
    ], pending: [] }
    const { service, wrapper } = setup({ getQuota: vi.fn().mockResolvedValue(quota(0)),
      getResponses: vi.fn().mockResolvedValue(restored) })
    const first = renderHook(() => useAiTutor('attempt-A'), { wrapper })
    await waitFor(() => expect(first.result.current.restoring).toBe(false))
    expect(first.result.current.result('hint', 'q1')?.title).toBe('提示')
    expect(first.result.current.result('explain_mistake', 'q1')?.title).toBe('錯誤')
    expect(first.result.current.result('explain_solution', 'q1')?.title).toBe('解答')
    expect(first.result.current.result('hint', 'q2')).toBeNull()
    first.unmount()
    const reopened = renderHook(() => useAiTutor('attempt-A'), { wrapper })
    await waitFor(() => expect(reopened.result.current.restoring).toBe(false))
    expect(reopened.result.current.result('explain_solution', 'q1')?.title).toBe('解答')
    expect(service.getResponses).toHaveBeenCalledTimes(2)
    expect(service.request).not.toHaveBeenCalled()
  })

  it('replays the same ID after an ambiguous timeout, even when quota reaches zero', async () => {
    const getQuota = vi.fn().mockResolvedValueOnce(quota(1)).mockResolvedValue(quota(0))
    const request = vi.fn().mockRejectedValueOnce(new TutorServiceError('network')).mockResolvedValue(output)
    const { wrapper } = setup({ getQuota, request })
    const { result } = renderHook(() => useAiTutor('attempt-A'), { wrapper })
    await waitFor(() => expect(result.current.restoring).toBe(false))
    await waitFor(() => expect(result.current.quota?.remaining).toBe(1))
    const sync = vi.fn().mockResolvedValue(undefined)
    await act(async () => { await result.current.run('hint', 'q1', sync) })
    expect(result.current.state('hint', 'q1').kind).toBe('retryable')
    expect(result.current.quota?.remaining).toBe(0)
    await act(async () => { await result.current.run('hint', 'q1', sync) })
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[1][0].requestId).toBe(request.mock.calls[0][0].requestId)
    expect(sync).toHaveBeenCalledOnce()
    expect(result.current.result('hint', 'q1')).toEqual(output)
  })

  it('uses a new ID only for explicit regeneration', async () => {
    const request = vi.fn().mockResolvedValue(output)
    const { wrapper } = setup({ request })
    const { result } = renderHook(() => useAiTutor('attempt-A'), { wrapper })
    await waitFor(() => expect(result.current.restoring).toBe(false))
    await waitFor(() => expect(result.current.quota).not.toBeNull())
    await act(async () => { await result.current.run('explain_solution', 'q1') })
    await act(async () => { await result.current.run('explain_solution', 'q1', undefined, true) })
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[1][0].requestId).not.toBe(request.mock.calls[0][0].requestId)
  })

  it('shows a pending signal without fake content and rechecks by reading only', async () => {
    const getResponses = vi.fn().mockResolvedValueOnce({ responses: [], pending: [{ questionId: 'q1', feature: 'hint' }] })
      .mockResolvedValue({ responses: [{ questionId: 'q1', feature: 'hint', response: output,
        completedAt: '2026-09-25T12:00:00Z' }], pending: [] })
    const { service, wrapper } = setup({ getQuota: vi.fn().mockResolvedValue(quota(0)), getResponses })
    const { result } = renderHook(() => useAiTutor('attempt-A'), { wrapper })
    await waitFor(() => expect(result.current.restoring).toBe(false))
    expect(result.current.state('hint', 'q1').kind).toBe('pending')
    expect(result.current.result('hint', 'q1')).toBeNull()
    await act(async () => { await result.current.restore() })
    expect(result.current.state('hint', 'q1').kind).toBe('completed')
    expect(service.request).not.toHaveBeenCalled()
  })
})

describe('calculation grading request state', () => {
  const grading = { kind: 'calculation_grading' as const, outcome: 'refusal' as const,
    message: 'AI 無法提供此題的參考評分。' }
  it('restores a completed grading on reload with zero credits and no provider call', async () => {
    const getResponses = vi.fn().mockResolvedValue({ responses: [{ questionId: 'q6', feature: 'calculation_grading',
      response: grading, completedAt: '2026-09-25T12:00:00Z' }], pending: [] })
    const { service, wrapper } = setup({ getQuota: vi.fn().mockResolvedValue(quota(0)), getResponses })
    const first = renderHook(() => useAiTutor('attempt-A'), { wrapper })
    await waitFor(() => expect(first.result.current.restoring).toBe(false))
    expect(first.result.current.gradingState('q6').response).toEqual(grading)
    first.unmount()
    const reopened = renderHook(() => useAiTutor('attempt-A'), { wrapper })
    await waitFor(() => expect(reopened.result.current.restoring).toBe(false))
    expect(reopened.result.current.gradingState('q6').response).toEqual(grading)
    expect(service.requestGrading).not.toHaveBeenCalled()
  })
  it('retries an ambiguous result with the original request ID and regenerates with a new one', async () => {
    const getQuota = vi.fn().mockResolvedValueOnce(quota(2)).mockResolvedValue(quota(0))
    const requestGrading = vi.fn().mockRejectedValueOnce(new TutorServiceError('network')).mockResolvedValue(grading)
    const { wrapper } = setup({ getQuota, requestGrading })
    const { result } = renderHook(() => useAiTutor('attempt-A'), { wrapper })
    await waitFor(() => expect(result.current.restoring).toBe(false))
    await waitFor(() => expect(result.current.quota?.remaining).toBe(2))
    await act(async () => { await result.current.runGrading('q6') })
    expect(result.current.gradingState('q6').kind).toBe('retryable')
    await act(async () => { await result.current.runGrading('q6') })
    expect(requestGrading.mock.calls[1][0].requestId).toBe(requestGrading.mock.calls[0][0].requestId)
    expect(result.current.gradingState('q6').response).toEqual(grading)
    await act(async () => { await result.current.runGrading('q6', true) })
    expect(requestGrading).toHaveBeenCalledTimes(2) // zero quota blocks a new request
  })
  it('uses a new request ID on explicit regeneration when two credits remain', async () => {
    const requestGrading = vi.fn().mockResolvedValue(grading)
    const { wrapper } = setup({ requestGrading })
    const { result } = renderHook(() => useAiTutor('attempt-A'), { wrapper })
    await waitFor(() => expect(result.current.restoring).toBe(false))
    await waitFor(() => expect(result.current.quota).not.toBeNull())
    await act(async () => { await result.current.runGrading('q6') })
    await act(async () => { await result.current.runGrading('q6', true) })
    expect(requestGrading).toHaveBeenCalledTimes(2)
    expect(requestGrading.mock.calls[1][0].requestId).not.toBe(requestGrading.mock.calls[0][0].requestId)
  })
})

describe('drawing analysis request state', () => {
  const analysis = { kind: 'drawing_analysis' as const, outcome: 'refusal' as const,
    message: 'AI 無法可靠分析此圖。' }
  it('restores a completed analysis on History reopen at zero credits without a provider call', async () => {
    const getResponses = vi.fn().mockResolvedValue({ responses: [{ questionId: 'q7', feature: 'drawing_analysis',
      response: analysis, completedAt: '2026-09-25T12:00:00Z' }], pending: [] })
    const { service, wrapper } = setup({ getQuota: vi.fn().mockResolvedValue(quota(0)), getResponses })
    const first = renderHook(() => useAiTutor('attempt-A'), { wrapper })
    await waitFor(() => expect(first.result.current.restoring).toBe(false))
    expect(first.result.current.drawingState('q7').response).toEqual(analysis)
    first.unmount()
    const reopened = renderHook(() => useAiTutor('attempt-A'), { wrapper })
    await waitFor(() => expect(reopened.result.current.restoring).toBe(false))
    expect(reopened.result.current.drawingState('q7').response).toEqual(analysis)
    expect(service.requestDrawing).not.toHaveBeenCalled()
  })
  it('requires four credits and reuses an uncertain request ID after a network failure', async () => {
    const requestDrawing = vi.fn().mockRejectedValueOnce(new TutorServiceError('network')).mockResolvedValue(analysis)
    const getQuota = vi.fn().mockResolvedValueOnce(quota(4)).mockResolvedValue(quota(0))
    const { wrapper } = setup({ getQuota, requestDrawing })
    const { result } = renderHook(() => useAiTutor('attempt-A'), { wrapper })
    await waitFor(() => expect(result.current.restoring).toBe(false))
    await waitFor(() => expect(result.current.quota?.remaining).toBe(4))
    await act(async () => { await result.current.runDrawing('q7') })
    expect(result.current.drawingState('q7').kind).toBe('retryable')
    await act(async () => { await result.current.runDrawing('q7') })
    expect(requestDrawing.mock.calls[1][0].requestId).toBe(requestDrawing.mock.calls[0][0].requestId)
    expect(result.current.drawingState('q7').response).toEqual(analysis)
    await act(async () => { await result.current.runDrawing('q7', true) })
    expect(requestDrawing).toHaveBeenCalledTimes(2)
  })
  it('blocks a first analysis at three credits and regenerates with a new ID at four', async () => {
    const denied = setup({ getQuota: vi.fn().mockResolvedValue(quota(3)), requestDrawing: vi.fn().mockResolvedValue(analysis) })
    const first = renderHook(() => useAiTutor('attempt-A'), { wrapper: denied.wrapper })
    await waitFor(() => expect(first.result.current.restoring).toBe(false))
    await waitFor(() => expect(first.result.current.quota?.remaining).toBe(3))
    await act(async () => { await first.result.current.runDrawing('q7') })
    expect(denied.service.requestDrawing).not.toHaveBeenCalled()
    first.unmount()
    const requestDrawing = vi.fn().mockResolvedValue(analysis)
    const allowed = setup({ getQuota: vi.fn().mockResolvedValue(quota(4)), requestDrawing })
    const second = renderHook(() => useAiTutor('attempt-A'), { wrapper: allowed.wrapper })
    await waitFor(() => expect(second.result.current.restoring).toBe(false))
    await waitFor(() => expect(second.result.current.quota?.remaining).toBe(4))
    await act(async () => { await second.result.current.runDrawing('q7') })
    await act(async () => { await second.result.current.runDrawing('q7', true) })
    expect(requestDrawing).toHaveBeenCalledTimes(2)
    expect(requestDrawing.mock.calls[1][0].requestId).not.toBe(requestDrawing.mock.calls[0][0].requestId)
  })
})
