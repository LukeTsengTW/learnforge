// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TutorContext } from './tutor-context'
import { TutorServiceError, type AiQuota, type TutorService } from './tutor-service'
import { useAiTutor } from './use-ai-tutor'

afterEach(cleanup)

const quota = (remaining: number): AiQuota => ({ limit: 20, used: 20 - remaining, remaining,
  windowSeconds: 18000, nextCreditAt: null,
  featureCosts: { hint: 1, explain_mistake: 1, explain_solution: 2 } })

describe('AI Tutor retry state', () => {
  it('reuses a request ID to recover a lost response after the last credit is spent', async () => {
    const output = { title: '提示', message: '先整理條件。', keyPoints: [], nextStep: null }
    const getQuota = vi.fn().mockResolvedValueOnce(quota(1)).mockResolvedValue(quota(0))
    const request = vi.fn().mockRejectedValueOnce(new TutorServiceError('network')).mockResolvedValue(output)
    const service: TutorService = { getQuota, request }
    const wrapper = ({ children }: { children: ReactNode }) => <TutorContext.Provider value={service}>{children}</TutorContext.Provider>
    const { result } = renderHook(() => useAiTutor('attempt-1'), { wrapper })
    await waitFor(() => expect(result.current.quota?.remaining).toBe(1))
    const sync = vi.fn().mockResolvedValue(undefined)
    await act(async () => { await result.current.run('hint', 'q1', sync) })
    expect(result.current.quota?.remaining).toBe(0)
    expect(result.current.pending('hint', 'q1')).toBe(true)
    await act(async () => { await result.current.run('hint', 'q1', sync) })
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[1][0].requestId).toBe(request.mock.calls[0][0].requestId)
    expect(sync).toHaveBeenCalledOnce()
    expect(result.current.result('hint', 'q1')).toEqual(output)
    expect(result.current.pending('hint', 'q1')).toBe(false)
  })
})
