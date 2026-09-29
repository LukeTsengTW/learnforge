import { withSupabase } from 'npm:@supabase/server@1.5.3'
import type { Database, Json } from '../../../src/types/database.types.ts'
import { GRADING_VERSION } from '../../../src/models/grading-version.ts'
import { createOpenAIFillProvider } from '../_shared/semantic-fill.ts'
import { createOpenAISubmissionCalculationProvider } from '../_shared/calculation-grading.ts'
import { createOpenAISubmissionDrawingProvider } from '../_shared/drawing-analysis.ts'
import { submissionRubricPayload, type SubmissionRubricJudgment } from '../_shared/submission-rubric.ts'
import { createSubmitQuizHandler, SubmissionConflict, type AttemptSnapshot, type PersistedFillJudgment,
  type PersistedRubricJudgment } from './handler.ts'

interface QueryResponse { data: unknown; error: { code?: string; message: string } | null }
interface QueryBuilder extends PromiseLike<QueryResponse> { eq(column: string, value: unknown): QueryBuilder }
interface UntypedAdmin {
  from(table: string): { select(columns: string): QueryBuilder }
  rpc(name: string, args: Record<string, unknown>): PromiseLike<QueryResponse>
}

export default {
  fetch: withSupabase<Database>({ auth: 'user' }, async (request, ctx) => {
    const userId = ctx.userClaims?.id
    if (!userId) return Response.json({ code: 'unauthorized' }, { status: 401 })
    const admin = ctx.supabaseAdmin
    const untypedAdmin = admin as unknown as UntypedAdmin
    const key = Deno.env.get('OPENAI_API_KEY')?.trim()
    return createSubmitQuizHandler({
      userId,
      fillProvider: key ? createOpenAIFillProvider(key) : null,
      calculationProvider: key ? createOpenAISubmissionCalculationProvider(key) : null,
      drawingProvider: key ? createOpenAISubmissionDrawingProvider(key) : null,
      async loadAttempt(attemptId) {
        const { data, error } = await ctx.supabase.from('attempts').select('*, answers(question_id,answer)')
          .eq('id', attemptId).eq('user_id', userId).maybeSingle()
        if (error) throw new Error('Attempt load failed')
        return data as unknown as AttemptSnapshot | null
      },
      async loadFinalFillJudgments(attemptId) {
        const { data, error } = await ctx.supabase.from('fill_judgments')
          .select('question_id,answer_hash,source,status,confidence,reason,judge_version')
          .eq('attempt_id', attemptId).eq('user_id', userId)
        if (error) throw new Error('Fill judgment load failed')
        return (data ?? []).map((row) => ({ questionId: row.question_id, answerHash: row.answer_hash,
          source: row.source, status: row.status, confidence: row.confidence, reason: row.reason,
          judgeVersion: row.judge_version })) as PersistedFillJudgment[]
      },
      async loadFinalRubricJudgments(attemptId) {
        const { data, error } = await untypedAdmin.from('rubric_judgments')
          .select('question_id,question_type,answer_hash,judge_version,source,status,score,max_score,criteria,confidence,summary,details,model,reasoning_effort')
          .eq('attempt_id', attemptId).eq('user_id', userId)
        if (error || !Array.isArray(data)) throw new Error('Rubric judgment load failed')
        return data as PersistedRubricJudgment[]
      },
      async claimFill(input) {
        const { data, error } = await admin.rpc('claim_fill_judgment', {
          p_user_id: input.userId, p_attempt_id: input.attemptId,
          p_expected_updated_at: input.expectedUpdatedAt, p_question_id: input.questionId,
          p_answer_hash: input.answerHash, p_request_id: input.requestId,
        })
        if (error || !data || typeof data !== 'object') throw new Error('Fill claim failed')
        return data as { state: 'claimed' | 'cached' | 'in_progress' | 'conflict' | 'limited';
          claimToken?: string; answerHash?: string; verdict?: unknown; confidence?: unknown; reason?: unknown }
      },
      async completeFill(token, verdict, confidence, reason, responseId, usage) {
        const { data, error } = await admin.rpc('complete_fill_judgment', {
          p_claim_token: token, p_verdict: verdict, p_confidence: confidence, p_reason: reason,
          p_provider_response_id: responseId ?? '', p_input_tokens: usage.inputTokens,
          p_cached_input_tokens: usage.cachedInputTokens, p_output_tokens: usage.outputTokens,
          p_reasoning_tokens: usage.reasoningTokens,
        })
        if (error) throw new Error('Fill completion failed')
        return data === true
      },
      async failFill(token, code) {
        const { error } = await admin.rpc('fail_fill_judgment', { p_claim_token: token, p_error_code: code })
        if (error) throw new Error('Fill claim release failed')
      },
      async claimRubric(input) {
        const { data, error } = await untypedAdmin.rpc('claim_rubric_judgment', {
          p_user_id: input.userId, p_attempt_id: input.attemptId,
          p_expected_updated_at: input.expectedUpdatedAt, p_request_id: input.requestId,
          p_quiz_id: input.quizId, p_quiz_revision: input.quizRevision,
          p_question_id: input.questionId, p_question_type: input.questionType, p_max_score: input.maxScore,
          p_system_unanswered: input.systemUnanswered,
        })
        if (error || !data || typeof data !== 'object') throw new Error('Rubric claim failed')
        return data as { state: 'claimed' | 'cached' | 'in_progress' | 'conflict' | 'limited' | 'unanswered';
          claimToken?: string; answerHash?: string; response?: unknown; providerResponseId?: string | null }
      },
      async completeRubric(token, judgment: SubmissionRubricJudgment, responseId, usage) {
        const { data, error } = await untypedAdmin.rpc('complete_rubric_judgment', {
          p_claim_token: token, p_response: submissionRubricPayload(judgment) as Json,
          p_provider_response_id: responseId,
          p_input_tokens: usage.inputTokens, p_cached_input_tokens: usage.cachedInputTokens,
          p_output_tokens: usage.outputTokens, p_reasoning_tokens: usage.reasoningTokens,
        })
        if (error) throw new Error('Rubric completion failed')
        return data === true
      },
      async failRubric(token, code) {
        const { error } = await untypedAdmin.rpc('fail_rubric_judgment', { p_claim_token: token, p_error_code: code })
        if (error) throw new Error('Rubric claim release failed')
      },
      async finalize(input) {
        const resultPayload = {
          score: input.result.score, maxScore: input.result.maxScore,
          correctCount: input.result.correctCount, partialCount: input.result.partialCount,
          incorrectCount: input.result.incorrectCount, unansweredCount: input.result.unansweredCount,
          manualCount: input.result.manualCount,
          questions: input.result.questions.map((grade) => ({ questionId: grade.questionId, type: grade.type,
            status: grade.status, score: grade.score, maxScore: grade.maxScore })),
        } satisfies Json
        const fillPayload = input.fillJudgments.map((judgment) => ({ questionId: judgment.questionId,
          answerHash: judgment.answerHash, source: judgment.source, status: judgment.status,
          confidence: judgment.confidence, reason: judgment.reason })) satisfies Json
        const rubricPayload = input.rubricJudgments.map((judgment) => judgment.source === 'system'
          ? { questionId: judgment.questionId, questionType: judgment.questionType, answerHash: judgment.answerHash,
            source: judgment.source, status: judgment.status, score: judgment.score, maxScore: judgment.maxScore,
            criteria: [] }
          : { questionId: judgment.questionId, questionType: judgment.questionType, answerHash: judgment.answerHash,
            source: judgment.source, status: judgment.status, score: judgment.score, maxScore: judgment.maxScore,
            criteria: judgment.criteria.map((criterion) => ({ criterionId: criterion.criterionId,
              awardedScore: criterion.awardedScore, maxScore: criterion.maxScore, status: criterion.status,
              ...(criterion.feedback === undefined ? {} : { feedback: criterion.feedback }) })),
            confidence: judgment.confidence, summary: judgment.summary,
            model: judgment.model, reasoningEffort: judgment.reasoningEffort,
            ...(judgment.strengths ? { strengths: judgment.strengths } : {}),
            ...(judgment.improvements ? { improvements: judgment.improvements } : {}),
            ...(judgment.observations ? { observations: judgment.observations } : {}),
            ...(judgment.missingOrUnclear ? { missingOrUnclear: judgment.missingOrUnclear } : {}) }) satisfies Json
        const canonicalQuestions = input.questions.map((question) => ({
          questionId: question.questionId, type: question.type, points: question.points,
          ...(question.correctOptionId === undefined ? {} : { correctOptionId: question.correctOptionId }),
          ...(question.correctOptionIds === undefined ? {} : { correctOptionIds: [...question.correctOptionIds] }),
          ...(question.correctAnswer === undefined ? {} : { correctAnswer: question.correctAnswer }),
          ...(question.match === undefined ? {} : { match: question.match }),
          ...(question.referenceAnswer === undefined ? {} : { referenceAnswer: question.referenceAnswer }),
          ...(question.solution === undefined ? {} : { solution: question.solution }),
          ...(question.drawing === undefined ? {} : { drawing: { width: question.drawing.width, height: question.drawing.height } }),
          ...(question.rubric === undefined ? {} : { rubric: question.rubric.map((criterion) => ({
            criterionId: criterion.criterionId, maxScore: criterion.maxScore,
          })) }),
        })) satisfies Json
        const { data, error } = await untypedAdmin.rpc('finalize_ai_grading_submission', {
          p_user_id: input.userId, p_attempt_id: input.attemptId,
          p_expected_updated_at: input.expectedUpdatedAt, p_request_id: input.requestId,
          p_quiz_id: input.quizId, p_quiz_revision: input.quizRevision,
          p_result: resultPayload, p_fill_judgments: fillPayload,
          p_rubric_judgments: rubricPayload, p_questions: canonicalQuestions,
        })
        if (error?.code === '40001') throw new SubmissionConflict()
        if (error) throw new Error('V3 finalization failed')
        return Array.isArray(data) && data.length === 1
          && !!data[0] && typeof data[0] === 'object'
          && (data[0] as Record<string, unknown>).id === input.attemptId
          && (data[0] as Record<string, unknown>).user_id === input.userId
          && (data[0] as Record<string, unknown>).status === 'submitted'
          && (data[0] as Record<string, unknown>).grading_version === GRADING_VERSION.aiGradingV3
      },
    })(request)
  }),
}
