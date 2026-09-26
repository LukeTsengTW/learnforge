import { AI_MODEL, DRAWING_REASONING_EFFORT } from '../_shared/ai-config.ts'
import { AiProviderError, type ProviderUsage } from '../_shared/ai-provider.ts'
import { DRAWING_FEATURE, parseDrawingRequest, isScoredDrawingContext,
  parseStoredDrawingResponse, type DrawingAnalysisResponse, type DrawingProvider } from '../_shared/drawing-analysis.ts'
import { DrawingRasterError, rasterizeStoredDrawing } from '../_shared/drawing-raster.ts'
import { readBoundedJson, TutorInputError, tutorContext } from '../_shared/ai-tutor.ts'

interface AttemptSnapshot { id: string; user_id: string; quiz_id: string; quiz_revision: string; status: string }
interface Reservation { state: string; response?: unknown }
interface Identity { userId: string; requestId: string; attemptId: string; questionId: string;
  feature: typeof DRAWING_FEATURE; model: string; reasoningEffort: string }
export interface DrawingBackend {
  userId: string
  provider: DrawingProvider | null
  loadAttempt: (attemptId: string) => Promise<AttemptSnapshot | null>
  loadAnswer: (attemptId: string, questionId: string) => Promise<unknown>
  findRequest: (identity: Identity) => Promise<Reservation>
  reserve: (identity: Identity) => Promise<Reservation>
  complete: (userId: string, requestId: string, response: DrawingAnalysisResponse,
    responseId: string | null, usage: ProviderUsage) => Promise<boolean>
  refund: (userId: string, requestId: string, code: string) => Promise<void>
}

const HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: HEADERS })
const error = (code: string, message: string, status: number) => json({ code, error: message }, status)
const UNAVAILABLE = 'AI 圖像分析暫時無法使用，請稍後再試。'

export function createDrawingHandler(backend: DrawingBackend) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return error('method_not_allowed', '不支援的要求。', 405)
    let input
    try { input = parseDrawingRequest(await readBoundedJson(request)) }
    catch (failure) {
      if (failure instanceof TutorInputError && failure.kind === 'oversized') return error('request_too_large', '要求內容過長。', 413)
      return error('invalid_request', '要求格式錯誤。', 400)
    }
    if (!input) return error('invalid_request', '要求格式錯誤。', 400)
    if (!backend.provider) return error('service_unavailable', UNAVAILABLE, 503)

    let reserved = false
    try {
      const attempt = await backend.loadAttempt(input.attemptId)
      if (!attempt || attempt.id !== input.attemptId || attempt.user_id !== backend.userId) {
        return error('attempt_unavailable', '找不到此作答紀錄，或目前無法取得。', 404)
      }
      if (attempt.status !== 'submitted') return error('feature_unavailable', '提交作答後才能使用 AI 圖像分析。', 409)
      if (!tutorContext.hasRevision(attempt.quiz_id, attempt.quiz_revision)) {
        return error('context_unavailable', '這份題目版本目前無法使用 AI 圖像分析。', 409)
      }
      const question = tutorContext.get(attempt.quiz_id, attempt.quiz_revision, input.questionId)
      if (!question) return error('question_unavailable', '找不到這道題目。', 404)
      if (question.type !== 'drawing') return error('feature_unavailable', '此題型無法使用 AI 圖像分析。', 409)
      if (!isScoredDrawingContext(question)) {
        return error('rubric_unavailable', '此題未提供可量化評分規準，因此無法使用 AI 圖像分析。', 422)
      }
      const identity: Identity = { userId: backend.userId, requestId: input.requestId,
        attemptId: attempt.id, questionId: question.questionId, feature: DRAWING_FEATURE,
        model: AI_MODEL, reasoningEffort: DRAWING_REASONING_EFFORT }
      const previous = await backend.findRequest(identity)
      if (previous.state === 'completed') {
        const cached = parseStoredDrawingResponse(previous.response, question)
        return cached ? json({ requestId: input.requestId, response: cached, cached: true })
          : error('service_unavailable', UNAVAILABLE, 503)
      }
      if (previous.state === 'reserved') return json({ code: 'in_progress' }, 202)
      if (previous.state === 'refunded' || previous.state === 'expired') {
        return error('request_closed', '這次 AI 要求已結束，請重新點選。', 409)
      }
      if (previous.state !== 'missing') return error('invalid_request', '要求格式錯誤。', 409)
      let png: Uint8Array
      try {
        const drawing = await rasterizeStoredDrawing(await backend.loadAnswer(attempt.id, question.questionId), question.drawing!)
        png = drawing.png
      } catch (failure) {
        if (failure instanceof DrawingRasterError && failure.kind === 'oversized') {
          return error('drawing_too_large', '此圖像內容過大，暫時無法使用 AI 分析。', 413)
        }
        if (failure instanceof DrawingRasterError) {
          return error('drawing_unavailable', '這道題尚未提供可分析的繪圖內容。', 409)
        }
        throw failure
      }
      const reservation = await backend.reserve(identity)
      if (reservation.state === 'completed') {
        const cached = parseStoredDrawingResponse(reservation.response, question)
        return cached ? json({ requestId: input.requestId, response: cached, cached: true })
          : error('service_unavailable', UNAVAILABLE, 503)
      }
      if (reservation.state === 'reserved') return json({ code: 'in_progress' }, 202)
      if (reservation.state === 'denied') return error('quota_exhausted', 'AI 額度不足，請稍後再試。', 429)
      if (reservation.state === 'refunded' || reservation.state === 'expired') {
        return error('request_closed', '這次 AI 要求已結束，請重新點選。', 409)
      }
      if (reservation.state !== 'created') return error('invalid_request', '要求格式錯誤。', 409)
      reserved = true
      const result = await backend.provider.generate(question, png)
      const response = parseStoredDrawingResponse(result.response, question)
      if (!response || new TextEncoder().encode(JSON.stringify(response)).length > 16000) {
        throw new AiProviderError('malformed')
      }
      const completed = await backend.complete(backend.userId, input.requestId, response, result.responseId, result.usage)
      if (!completed) throw new Error('Completion unavailable')
      reserved = false
      return json({ requestId: input.requestId, response, cached: false })
    } catch (failure) {
      if (reserved) {
        const code = failure instanceof AiProviderError ? failure.code : 'internal_error'
        try { await backend.refund(backend.userId, input.requestId, code) } catch { /* TTL releases stale reservations. */ }
      }
      return error('service_unavailable', UNAVAILABLE, 503)
    }
  }
}
