import { useCallback, useEffect, useRef, useState } from 'react'
import { useTutorService } from './tutor-context'
import { TutorServiceError, type AiQuota, type TutorFeature, type TutorResponse } from './tutor-service'

const keyFor = (attemptId: string | undefined, feature: TutorFeature, questionId: string) => `${attemptId}:${feature}:${questionId}`
function userMessage(error: unknown): string {
  const code = error instanceof TutorServiceError ? error.code : 'unavailable'
  switch (code) {
    case 'quota_exhausted': return 'AI 額度不足，請稍後再試。'
    case 'in_progress': return 'AI 正在產生說明，請稍後重試。'
    case 'request_closed': return '這次要求已結束，請重新點選。'
    case 'network': return '網路連線中斷，請確認連線後重試。'
    case 'unauthorized': return '登入已失效，請重新登入。'
    case 'context_unavailable': return '這份題目版本目前無法使用 AI 說明。'
    default: return 'AI 學習輔助暫時無法使用，請稍後再試。'
  }
}

export function useAiTutor(attemptId: string | undefined) {
  const service = useTutorService()
  const [quota, setQuota] = useState<AiQuota | null>(null)
  const [quotaError, setQuotaError] = useState(false)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [responses, setResponses] = useState<Record<string, TutorResponse>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const pendingIds = useRef<Record<string, string>>({})
  const busyIds = useRef(new Set<string>())

  const refreshQuota = useCallback(async () => {
    if (!service || !attemptId) return
    setQuotaLoading(true)
    try { setQuota(await service.getQuota()); setQuotaError(false) }
    catch { setQuotaError(true); setQuota(null) }
    finally { setQuotaLoading(false) }
  }, [service, attemptId])
  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) void refreshQuota() })
    return () => { active = false }
  }, [refreshQuota])

  async function run(feature: TutorFeature, questionId: string, beforeRun?: () => Promise<void>) {
    if (!service || !attemptId) return
    const key = keyFor(attemptId, feature, questionId)
    const retrying = !!pendingIds.current[key]
    if (!retrying && (!quota || quota.remaining < quota.featureCosts[feature])) return
    if (busyIds.current.has(key)) return
    busyIds.current.add(key)
    setBusy((old) => ({ ...old, [key]: true }))
    setErrors((old) => ({ ...old, [key]: '' }))
    try {
      if (!retrying) await beforeRun?.()
      const requestId = pendingIds.current[key] ??= crypto.randomUUID()
      const response = await service.request({ requestId, feature, attemptId, questionId })
      delete pendingIds.current[key]
      setResponses((old) => ({ ...old, [key]: response }))
    } catch (failure) {
      if (failure instanceof TutorServiceError && failure.definitive) delete pendingIds.current[key]
      setErrors((old) => ({ ...old, [key]: failure instanceof Error && !(failure instanceof TutorServiceError)
        && failure.message === 'draft_not_synced' ? '作答尚未同步到雲端，請確認連線後再試。' : userMessage(failure) }))
    } finally {
      busyIds.current.delete(key)
      setBusy((old) => ({ ...old, [key]: false }))
      await refreshQuota()
    }
  }

  return { enabled: !!service && !!attemptId, quota, quotaError, quotaLoading, refreshQuota,
    result: (feature: TutorFeature, questionId: string): TutorResponse | null => responses[keyFor(attemptId, feature, questionId)] ?? null,
    error: (feature: TutorFeature, questionId: string): string | null => errors[keyFor(attemptId, feature, questionId)] ?? null,
    busy: (feature: TutorFeature, questionId: string) => busy[keyFor(attemptId, feature, questionId)] ?? false,
    pending: (feature: TutorFeature, questionId: string) => !!pendingIds.current[keyFor(attemptId, feature, questionId)],
    run }
}
export type AiTutorState = ReturnType<typeof useAiTutor>
