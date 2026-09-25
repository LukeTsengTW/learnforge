import { parseTutorResponse } from '../_shared/ai-tutor.ts'
import { tutorContext } from '../_shared/ai-tutor.ts'
import { GRADING_FEATURE, parseStoredGradingResponse } from '../_shared/calculation-grading.ts'

export interface StoredAiRow {
  question_id: string
  feature: string
  response: unknown
  completed_at: string | null
  pending: boolean
}
export interface AiResponsesBackend {
  ownsAttempt: (attemptId: string) => Promise<boolean | { quizId: string; revision: string; status: string }>
  loadResponses: (attemptId: string) => Promise<StoredAiRow[]>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FEATURES = new Set(['hint', 'explain_mistake', 'explain_solution', GRADING_FEATURE])
const HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const unavailable = () => Response.json({ code: 'not_found', error: '找不到此作答紀錄，或目前無法取得。' },
  { status: 404, headers: HEADERS })

export function createAiResponsesHandler(backend: AiResponsesBackend) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') return Response.json({ code: 'method_not_allowed' }, { status: 405, headers: HEADERS })
    const attemptId = new URL(request.url).searchParams.get('attemptId')
    if (!attemptId || !UUID.test(attemptId)) return unavailable()
    try {
      // The user-scoped attempts query must succeed before any private ledger read.
      const ownership = await backend.ownsAttempt(attemptId)
      if (!ownership) return unavailable()
      const rows = await backend.loadResponses(attemptId)
      const responses: { questionId: string; feature: string; response: unknown; completedAt: string }[] = []
      const pending: { questionId: string; feature: string }[] = []
      for (const row of rows) {
        if (!row.question_id || !FEATURES.has(row.feature)) continue
        if (row.feature === GRADING_FEATURE) {
          if (typeof ownership !== 'object' || ownership.status !== 'submitted') continue
          const question = tutorContext.get(ownership.quizId, ownership.revision, row.question_id)
          if (!question) continue
          if (row.pending) { pending.push({ questionId: row.question_id, feature: row.feature }); continue }
          const grading = parseStoredGradingResponse(row.response, question)
          if (grading && row.completed_at) responses.push({ questionId: row.question_id,
            feature: row.feature, response: grading, completedAt: row.completed_at })
          continue
        }
        if (row.pending) { pending.push({ questionId: row.question_id, feature: row.feature }); continue }
        const response = parseTutorResponse(row.response)
        if (response && row.completed_at) responses.push({ questionId: row.question_id,
          feature: row.feature, response, completedAt: row.completed_at })
      }
      return Response.json({ responses, pending }, { headers: HEADERS })
    } catch {
      return Response.json({ code: 'unavailable', error: 'AI 建議暫時無法載入。' }, { status: 503, headers: HEADERS })
    }
  }
}
