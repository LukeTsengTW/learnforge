import { withSupabase } from 'npm:@supabase/server@1.5.3'
import type { Database } from '../../../src/types/database.types.ts'
import { createOpenAITutorProvider } from '../_shared/ai-tutor.ts'
import { createTutorHandler } from './handler.ts'

export default {
  fetch: withSupabase<Database>({ auth: 'user' }, async (request, ctx) => {
    const userId = ctx.userClaims?.id
    if (!userId) return Response.json({ code: 'unauthorized', error: '請重新登入後再試。' }, { status: 401 })
    const admin = ctx.supabaseAdmin
    const key = Deno.env.get('OPENAI_API_KEY')?.trim()
    return createTutorHandler({
      userId,
      provider: key ? createOpenAITutorProvider(key) : null,
      async loadAttempt(attemptId) {
        const { data, error } = await ctx.supabase.from('attempts')
          .select('id,user_id,quiz_id,quiz_revision,status').eq('id', attemptId).eq('user_id', userId).maybeSingle()
        if (error) throw new Error('Attempt unavailable')
        return data
      },
      async loadAnswer(attemptId, questionId) {
        const { data, error } = await ctx.supabase.from('answers').select('answer')
          .eq('attempt_id', attemptId).eq('user_id', userId).eq('question_id', questionId).maybeSingle()
        if (error) throw new Error('Answer unavailable')
        return data?.answer ?? null
      },
      async findRequest(input) {
        const { data, error } = await admin.rpc('find_ai_request', {
          p_user_id: input.userId, p_request_id: input.requestId, p_attempt_id: input.attemptId,
          p_question_id: input.questionId, p_feature: input.feature, p_model: input.model,
          p_reasoning_effort: input.reasoningEffort,
        })
        if (error || !data || typeof data !== 'object' || !('state' in data)) throw new Error('Request unavailable')
        return data as { state: string; response?: unknown }
      },
      async reserve(input) {
        const { data, error } = await admin.rpc('reserve_ai_request', {
          p_user_id: input.userId, p_request_id: input.requestId, p_attempt_id: input.attemptId,
          p_question_id: input.questionId, p_feature: input.feature, p_model: input.model,
          p_reasoning_effort: input.reasoningEffort,
        })
        if (error || !data || typeof data !== 'object' || !('state' in data)) throw new Error('Quota unavailable')
        return data as { state: string; response?: unknown; credits?: number }
      },
      async complete(ownerId, requestId, response, responseId, usage) {
        const { data, error } = await admin.rpc('complete_ai_request', {
          p_user_id: ownerId, p_request_id: requestId,
          p_response: { title: response.title, message: response.message,
            keyPoints: response.keyPoints, nextStep: response.nextStep },
          p_provider_response_id: responseId ?? '', p_input_tokens: usage.inputTokens,
          p_cached_input_tokens: usage.cachedInputTokens, p_output_tokens: usage.outputTokens,
          p_reasoning_tokens: usage.reasoningTokens,
        })
        if (error) throw new Error('Completion unavailable')
        return data === true
      },
      async refund(ownerId, requestId, code) {
        const { error } = await admin.rpc('refund_ai_request', {
          p_user_id: ownerId, p_request_id: requestId, p_error_code: code,
        })
        if (error) throw new Error('Refund unavailable')
      },
    })(request)
  }),
}
