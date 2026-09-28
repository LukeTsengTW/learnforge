import { withSupabase } from 'npm:@supabase/server@1.5.3'
import type { Database, Json } from '../../../src/types/database.types.ts'
import { createOpenAIFillProvider, type FillJudgment } from '../_shared/semantic-fill.ts'
import { createSubmitQuizHandler, SubmissionConflict } from './handler.ts'

export default {
  fetch: withSupabase<Database>({ auth: 'user' }, async (request, ctx) => {
    const userId = ctx.userClaims?.id
    if (!userId) return Response.json({ code: 'unauthorized' }, { status: 401 })
    const admin = ctx.supabaseAdmin
    const key = Deno.env.get('OPENAI_API_KEY')?.trim()
    return createSubmitQuizHandler({
      userId, provider: key ? createOpenAIFillProvider(key) : null,
      async loadAttempt(attemptId) {
        const { data, error } = await ctx.supabase.from('attempts').select('*, answers(question_id,answer)')
          .eq('id', attemptId).eq('user_id', userId).maybeSingle()
        if (error) throw new Error('Attempt load failed')
        return data
      },
      async loadFinalJudgments(attemptId) {
        const { data, error } = await ctx.supabase.from('fill_judgments')
          .select('question_id,answer_hash,source,status,confidence,reason')
          .eq('attempt_id', attemptId).eq('user_id', userId)
        if (error) throw new Error('Judgment load failed')
        return (data ?? []).map((row) => ({ questionId: row.question_id, answerHash: row.answer_hash,
          source: row.source, status: row.status, confidence: row.confidence, reason: row.reason })) as FillJudgment[]
      },
      async claim(input) {
        const { data, error } = await admin.rpc('claim_fill_judgment', {
          p_user_id: input.userId, p_attempt_id: input.attemptId,
          p_expected_updated_at: input.expectedUpdatedAt, p_question_id: input.questionId,
          p_answer_hash: input.answerHash, p_request_id: input.requestId,
        })
        if (error || !data || typeof data !== 'object') throw new Error('Claim failed')
        return data as { state: 'claimed' | 'cached' | 'in_progress' | 'conflict' | 'limited'; claimToken?: string;
          verdict?: unknown; confidence?: unknown; reason?: unknown }
      },
      async complete(token, verdict, confidence, reason, responseId, usage) {
        const { data, error } = await admin.rpc('complete_fill_judgment', {
          p_claim_token: token, p_verdict: verdict, p_confidence: confidence, p_reason: reason,
          p_provider_response_id: responseId ?? '', p_input_tokens: usage.inputTokens,
          p_cached_input_tokens: usage.cachedInputTokens, p_output_tokens: usage.outputTokens,
          p_reasoning_tokens: usage.reasoningTokens,
        })
        if (error) throw new Error('Completion failed')
        return data === true
      },
      async fail(token, code) {
        const { error } = await admin.rpc('fail_fill_judgment', { p_claim_token: token, p_error_code: code })
        if (error) throw new Error('Release failed')
      },
      async finalize(input) {
        const resultPayload = {
          score: input.result.score,
          maxScore: input.result.maxScore,
          correctCount: input.result.correctCount,
          incorrectCount: input.result.incorrectCount,
          unansweredCount: input.result.unansweredCount,
        } satisfies Json
        const judgmentsPayload = input.judgments.map((judgment) => ({
          questionId: judgment.questionId,
          answerHash: judgment.answerHash,
          source: judgment.source,
          status: judgment.status,
          confidence: judgment.confidence ?? null,
          reason: judgment.reason ?? null,
        })) satisfies Json
        const { data, error } = await admin.rpc('finalize_semantic_fill_submission', {
          p_user_id: input.userId, p_attempt_id: input.attemptId,
          p_expected_updated_at: input.expectedUpdatedAt, p_request_id: input.requestId,
          p_result: resultPayload, p_judgments: judgmentsPayload,
        })
        if (error?.code === '40001') throw new SubmissionConflict()
        if (error) throw new Error('Finalization failed')
        return data?.length === 1 && data[0].id === input.attemptId
          && data[0].user_id === input.userId && data[0].status === 'submitted'
      },
    })(request)
  }),
}
