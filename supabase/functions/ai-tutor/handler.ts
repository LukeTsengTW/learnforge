import {
  AI_TUTOR_MODEL, AI_TUTOR_REASONING_EFFORT, TutorInputError, TutorProviderError,
  featureAllowed, normalizeStudentAnswer, parseTutorRequest, parseTutorResponse, readBoundedJson,
  tutorContext, type TutorProvider, type TutorResponse, type TutorUsage,
} from '../_shared/ai-tutor.ts'

interface AttemptSnapshot {
  id: string; user_id: string; quiz_id: string; quiz_revision: string; status: string
}
interface Reservation {
  state: string; response?: unknown; credits?: number
}
export interface TutorBackend {
  userId: string
  provider: TutorProvider | null
  loadAttempt: (attemptId: string) => Promise<AttemptSnapshot | null>
  loadAnswer: (attemptId: string, questionId: string) => Promise<unknown>
  findRequest: (input: { userId: string; requestId: string; attemptId: string; questionId: string;
    feature: string; model: string; reasoningEffort: string }) => Promise<Reservation>
  reserve: (input: { userId: string; requestId: string; attemptId: string; questionId: string;
    feature: string; model: string; reasoningEffort: string }) => Promise<Reservation>
  complete: (userId: string, requestId: string, response: TutorResponse,
    responseId: string | null, usage: TutorUsage) => Promise<boolean>
  refund: (userId: string, requestId: string, code: string) => Promise<void>
}

const HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: HEADERS })
const error = (code: string, message: string, status: number) => json({ code, error: message }, status)
const UNAVAILABLE = 'AI 學習輔助暫時無法使用，請稍後再試。'
const REFUSAL: TutorResponse = {
  title: '暫時無法提供 AI 說明',
  message: '這次 AI 說明無法提供。請先參考題目提供的答案與解析。',
  keyPoints: [], nextStep: null,
}

export function createTutorHandler(backend: TutorBackend) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return error('method_not_allowed', '不支援的要求。', 405)
    let input
    try { input = parseTutorRequest(await readBoundedJson(request)) }
    catch (failure) {
      if (failure instanceof TutorInputError && failure.kind === 'oversized') return error('request_too_large', '要求內容過長。', 413)
      return error('invalid_request', '要求格式錯誤。', 400)
    }
    if (!input) return error('invalid_request', '要求格式錯誤。', 400)
    if (!backend.provider) return error('service_unavailable', UNAVAILABLE, 503)

    let reserved = false
    try {
      const attempt = await backend.loadAttempt(input.attemptId)
      // The RLS-scoped query and explicit owner check both precede quota reservation.
      if (!attempt || attempt.id !== input.attemptId || attempt.user_id !== backend.userId) {
        return error('attempt_unavailable', '找不到此作答紀錄，或你沒有權限查看。', 404)
      }
      if (!tutorContext.hasRevision(attempt.quiz_id, attempt.quiz_revision)) {
        return error('context_unavailable', '這份題目版本目前無法使用 AI 說明。', 409)
      }
      const question = tutorContext.get(attempt.quiz_id, attempt.quiz_revision, input.questionId)
      if (!question) return error('question_unavailable', '找不到這道題目。', 404)
      if (question.type === 'drawing') return error('unsupported', '此題型目前沒有 AI 說明。', 422)
      const identity = { userId: backend.userId, requestId: input.requestId,
        attemptId: attempt.id, questionId: question.questionId, feature: input.feature,
        model: AI_TUTOR_MODEL, reasoningEffort: AI_TUTOR_REASONING_EFFORT }
      const previous = await backend.findRequest(identity)
      if (previous.state === 'completed') {
        const cached = parseTutorResponse(previous.response)
        return cached ? json({ requestId: input.requestId, response: cached, cached: true })
          : error('service_unavailable', UNAVAILABLE, 503)
      }
      if (previous.state === 'reserved') return json({ code: 'in_progress', message: 'AI 正在產生說明，請稍後重試。' }, 202)
      if (previous.state === 'refunded' || previous.state === 'expired') return error('request_closed', '這次 AI 要求已結束，請重新點選。', 409)
      if (previous.state !== 'missing') return error('invalid_request', '要求格式錯誤。', 409)
      const rawAnswer = await backend.loadAnswer(attempt.id, question.questionId)
      let answer
      try { answer = normalizeStudentAnswer(question, rawAnswer) }
      catch { return error('answer_unavailable', '目前無法讀取這道題的作答。', 409) }
      if (!featureAllowed(input.feature, attempt.status, question, answer)) {
        return error('feature_unavailable', '目前無法使用這項 AI 說明。', 409)
      }
      const reservation = await backend.reserve(identity)
      if (reservation.state === 'completed') {
        const cached = parseTutorResponse(reservation.response)
        return cached ? json({ requestId: input.requestId, response: cached, cached: true })
          : error('service_unavailable', UNAVAILABLE, 503)
      }
      if (reservation.state === 'reserved') return json({ code: 'in_progress', message: 'AI 正在產生說明，請稍後重試。' }, 202)
      if (reservation.state === 'denied') return error('quota_exhausted', 'AI 額度不足，請稍後再試。', 429)
      if (reservation.state === 'refunded' || reservation.state === 'expired') {
        return error('request_closed', '這次 AI 要求已結束，請重新點選。', 409)
      }
      if (reservation.state !== 'created') return error('invalid_request', '要求格式錯誤。', 409)
      reserved = true
      const result = await backend.provider.generate(input.feature, question, answer)
      const response = result.kind === 'refusal' ? REFUSAL : result.response
      if (!response || !parseTutorResponse(response)) throw new TutorProviderError('malformed')
      const completed = await backend.complete(backend.userId, input.requestId, response, result.responseId, result.usage)
      if (!completed) throw new Error('Completion unavailable')
      reserved = false
      return json({ requestId: input.requestId, response, cached: false })
    } catch (failure) {
      if (reserved) {
        const code = failure instanceof TutorProviderError ? failure.code : 'internal_error'
        try { await backend.refund(backend.userId, input.requestId, code) } catch { /* TTL also releases stale reservations. */ }
      }
      return error('service_unavailable', UNAVAILABLE, 503)
    }
  }
}
