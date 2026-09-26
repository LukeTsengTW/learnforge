import { useEffect, useState } from 'react'
import type { AnalyticsAttempt } from '../../models/analytics'
import { usePracticeRepository, type PracticeRepository } from '../quiz/practice-context'
import { ANALYTICS_PAGE_SIZE } from '../quiz/practice-repository'

export const ANALYTICS_SCAN_LIMIT = 500
export interface LearningHistoryState {
  records: AnalyticsAttempt[]
  scannedAttemptCount: number
  isTruncated: boolean
  loading: boolean
  error: boolean
}
const initialState: LearningHistoryState = { records: [], scannedAttemptCount: 0,
  isTruncated: false, loading: true, error: false }

export async function scanLearningHistory(repo: Pick<PracticeRepository, 'listSubmittedAnalyticsPage'>,
  onProgress?: (count: number) => void): Promise<Pick<LearningHistoryState, 'records' | 'scannedAttemptCount' | 'isTruncated'>> {
  const records: AnalyticsAttempt[] = []
  let offset = 0, nextOffset: number | null = 0
  while (nextOffset !== null && records.length < ANALYTICS_SCAN_LIMIT) {
    const page = await repo.listSubmittedAnalyticsPage(offset)
    records.push(...page.records.slice(0, ANALYTICS_SCAN_LIMIT - records.length))
    onProgress?.(records.length)
    nextOffset = page.nextOffset
    if (page.records.length === 0) break
    offset += ANALYTICS_PAGE_SIZE
  }
  return { records, scannedAttemptCount: records.length,
    isTruncated: nextOffset !== null && records.length === ANALYTICS_SCAN_LIMIT }
}

/** Cloud history must finish loading before it can be represented as complete analytics. */
export function useLearningHistory(): LearningHistoryState {
  const repo = usePracticeRepository()
  const [snapshot, setSnapshot] = useState({ repo, state: initialState })
  useEffect(() => {
    let active = true
    // StrictMode cleans up the first development effect before this microtask runs.
    queueMicrotask(() => {
      if (!active) return
      void scanLearningHistory(repo, (count) => {
        if (active) setSnapshot((old) => ({ repo, state: { ...(old.repo === repo ? old.state : initialState), scannedAttemptCount: count } }))
      }).then((result) => {
        if (active) setSnapshot({ repo, state: { ...result, loading: false, error: false } })
      }).catch(() => {
        if (active) setSnapshot({ repo, state: { ...initialState, loading: false, error: true } })
      })
    })
    return () => { active = false }
  }, [repo])
  return snapshot.repo === repo ? snapshot.state : initialState
}
