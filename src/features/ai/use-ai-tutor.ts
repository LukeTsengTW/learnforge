import { useCallback, useEffect, useRef, useState } from 'react'
import { useTutorService } from './tutor-context'
import { TutorServiceError, type AiQuota, type AiFeature, type CalculationGradingResponse,
  type TutorFeature, type TutorResponse } from './tutor-service'

const keyFor = (attemptId: string | undefined, feature: AiFeature, questionId: string) => `${attemptId}:${feature}:${questionId}`
const PENDING_MESSAGE = '先前的 AI 請求仍在處理中。'

export type AiRequestState =
  | { kind: 'idle'; response: null; message?: string }
  | { kind: 'loading'; response: TutorResponse | null }
  | { kind: 'completed'; response: TutorResponse; message?: string }
  | { kind: 'retryable'; response: TutorResponse | null; message: string }
  | { kind: 'pending'; response: TutorResponse | null; message: string }
  | { kind: 'quota_exhausted'; response: TutorResponse | null; message: string }

const IDLE: AiRequestState = { kind: 'idle', response: null }
export type AiGradingState =
  | { kind: 'idle'; response: null; message?: string }
  | { kind: 'loading'; response: CalculationGradingResponse | null }
  | { kind: 'completed'; response: CalculationGradingResponse; message?: string }
  | { kind: 'retryable' | 'pending' | 'quota_exhausted'; response: CalculationGradingResponse | null; message: string }
const GRADING_IDLE: AiGradingState = { kind: 'idle', response: null }
function userMessage(error: unknown): string {
  const code = error instanceof TutorServiceError ? error.code : 'unavailable'
  switch (code) {
    case 'quota_exhausted': return 'AI 額度不足，請稍後再試。'
    case 'in_progress': return PENDING_MESSAGE
    case 'request_closed': return '前次 AI 請求已結束，可以重新提出要求。'
    case 'network': return '網路連線中斷，請確認連線後重試。'
    case 'unauthorized': return '登入已失效，請重新登入。'
    case 'context_unavailable': return '這份題目版本目前無法使用 AI 說明。'
    case 'rubric_unavailable': return '此題未提供可量化評分規準，因此無法使用 AI 參考評分。'
    case 'answer_too_long': return '此作答內容過長，暫時無法使用 AI 參考評分。'
    case 'answer_unavailable': return '這道題尚未提供可評分的作答。'
    default: return 'AI 學習輔助暫時無法使用，請稍後再試。'
  }
}

export function useAiTutor(attemptId: string | undefined) {
  const service = useTutorService()
  const [quota, setQuota] = useState<AiQuota | null>(null)
  const [quotaError, setQuotaError] = useState(false)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [states, setStates] = useState<Record<string, AiRequestState>>({})
  const [gradingStates, setGradingStates] = useState<Record<string, AiGradingState>>({})
  const [restoring, setRestoring] = useState(!!service && !!attemptId)
  const [restoreError, setRestoreError] = useState(false)
  const pendingIds = useRef<Record<string, string>>({})
  const busyIds = useRef(new Set<string>())
  const activeAttempt = useRef(attemptId)
  useEffect(() => { activeAttempt.current = attemptId }, [attemptId])

  const refreshQuota = useCallback(async () => {
    if (!service || !attemptId) return
    setQuotaLoading(true)
    try { setQuota(await service.getQuota()); setQuotaError(false) }
    catch { setQuotaError(true); setQuota(null) }
    finally { setQuotaLoading(false) }
  }, [service, attemptId])

  const restore = useCallback(async () => {
    if (!service || !attemptId) return
    setRestoring(true)
    try {
      const restored = await service.getResponses(attemptId)
      if (activeAttempt.current !== attemptId) return
      const next: Record<string, AiRequestState> = {}
      const nextGrading: Record<string, AiGradingState> = {}
      for (const item of restored.responses) {
        if (item.feature === 'calculation_grading') {
          nextGrading[keyFor(attemptId, item.feature, item.questionId)] = { kind: 'completed', response: item.response }
          continue
        }
        const key = keyFor(attemptId, item.feature, item.questionId)
        next[key] = { kind: 'completed', response: item.response }
      }
      const pendingKeys = new Set<string>()
      for (const item of restored.pending) {
        const key = keyFor(attemptId, item.feature, item.questionId)
        pendingKeys.add(key)
        if (item.feature === 'calculation_grading') {
          nextGrading[key] = { kind: 'pending', response: nextGrading[key]?.response ?? null, message: PENDING_MESSAGE }
        } else next[key] = { kind: 'pending', response: next[key]?.response ?? null, message: PENDING_MESSAGE }
      }
      for (const key of Object.keys(pendingIds.current)) if (!pendingKeys.has(key)) delete pendingIds.current[key]
      setStates(next)
      setGradingStates(nextGrading)
      setRestoreError(false)
    } catch {
      if (activeAttempt.current === attemptId) setRestoreError(true)
    } finally {
      if (activeAttempt.current === attemptId) setRestoring(false)
    }
  }, [service, attemptId])

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { void refreshQuota(); void restore() } })
    return () => { active = false }
  }, [refreshQuota, restore])

  async function run(feature: TutorFeature, questionId: string, beforeRun?: () => Promise<void>, regenerate = false) {
    if (!service || !attemptId || restoring || restoreError) return
    const key = keyFor(attemptId, feature, questionId)
    const current = states[key] ?? IDLE
    if (current.kind === 'pending' && !pendingIds.current[key] && !regenerate) { await restore(); return }
    const retrying = !regenerate && !!pendingIds.current[key]
    if (!retrying && (!quota || quota.remaining < quota.featureCosts[feature])) return
    if (busyIds.current.has(key)) return
    busyIds.current.add(key)
    const previous = current.response
    setStates((old) => ({ ...old, [key]: { kind: 'loading', response: previous } }))
    try {
      if (!retrying) await beforeRun?.()
      const requestId = retrying ? pendingIds.current[key] : crypto.randomUUID()
      pendingIds.current[key] = requestId
      const response = await service.request({ requestId, feature, attemptId, questionId })
      delete pendingIds.current[key]
      setStates((old) => ({ ...old, [key]: { kind: 'completed', response } }))
    } catch (failure) {
      const message = failure instanceof Error && !(failure instanceof TutorServiceError)
        && failure.message === 'draft_not_synced' ? '作答尚未同步到雲端，請確認連線後再試。' : userMessage(failure)
      if (failure instanceof TutorServiceError && failure.code === 'in_progress') {
        setStates((old) => ({ ...old, [key]: { kind: 'pending', response: previous, message } }))
      } else if (failure instanceof TutorServiceError && failure.code === 'quota_exhausted') {
        delete pendingIds.current[key]
        setStates((old) => ({ ...old, [key]: { kind: 'quota_exhausted', response: previous, message } }))
      } else if ((failure instanceof TutorServiceError && failure.definitive) ||
        (failure instanceof Error && failure.message === 'draft_not_synced')) {
        delete pendingIds.current[key]
        setStates((old) => ({ ...old, [key]: previous ? { kind: 'completed', response: previous, message }
          : { kind: 'idle', response: null, message } }))
      } else {
        setStates((old) => ({ ...old, [key]: { kind: 'retryable', response: previous, message } }))
      }
    } finally {
      busyIds.current.delete(key)
      await refreshQuota()
    }
  }

  async function runGrading(questionId: string, regenerate = false) {
    if (!service || !attemptId || restoring || restoreError) return
    const key = keyFor(attemptId, 'calculation_grading', questionId)
    const current = gradingStates[key] ?? GRADING_IDLE
    if (current.kind === 'pending' && !pendingIds.current[key] && !regenerate) { await restore(); return }
    const retrying = !regenerate && !!pendingIds.current[key]
    if (!retrying && (!quota || quota.remaining < quota.featureCosts.calculation_grading)) return
    if (busyIds.current.has(key)) return
    busyIds.current.add(key)
    const previous = current.response
    setGradingStates((old) => ({ ...old, [key]: { kind: 'loading', response: previous } }))
    try {
      const requestId = retrying ? pendingIds.current[key] : crypto.randomUUID()
      pendingIds.current[key] = requestId
      const response = await service.requestGrading({ requestId, feature: 'calculation_grading', attemptId, questionId })
      delete pendingIds.current[key]
      setGradingStates((old) => ({ ...old, [key]: { kind: 'completed', response } }))
    } catch (failure) {
      const message = userMessage(failure)
      if (failure instanceof TutorServiceError && failure.code === 'in_progress') {
        setGradingStates((old) => ({ ...old, [key]: { kind: 'pending', response: previous, message } }))
      } else if (failure instanceof TutorServiceError && failure.code === 'quota_exhausted') {
        delete pendingIds.current[key]
        setGradingStates((old) => ({ ...old, [key]: { kind: 'quota_exhausted', response: previous, message } }))
      } else if (failure instanceof TutorServiceError && failure.definitive) {
        delete pendingIds.current[key]
        setGradingStates((old) => ({ ...old, [key]: previous ? { kind: 'completed', response: previous, message }
          : { kind: 'idle', response: null, message } }))
      } else {
        setGradingStates((old) => ({ ...old, [key]: { kind: 'retryable', response: previous, message } }))
      }
    } finally {
      busyIds.current.delete(key)
      await refreshQuota()
    }
  }

  return {
    enabled: !!service && !!attemptId, quota, quotaError, quotaLoading, refreshQuota,
    restoring, restoreError, restore,
    state: (feature: TutorFeature, questionId: string): AiRequestState => states[keyFor(attemptId, feature, questionId)] ?? IDLE,
    result: (feature: TutorFeature, questionId: string): TutorResponse | null =>
      states[keyFor(attemptId, feature, questionId)]?.response ?? null,
    run,
    gradingState: (questionId: string): AiGradingState => gradingStates[keyFor(attemptId, 'calculation_grading', questionId)] ?? GRADING_IDLE,
    runGrading,
  }
}
export type AiTutorState = ReturnType<typeof useAiTutor>
