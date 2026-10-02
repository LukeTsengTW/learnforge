import { withSupabase } from 'npm:@supabase/server@1.5.3'
import type { Database } from '../../../src/types/database.types.ts'
import { draftRecord, validDraftTimestamp } from '../_shared/draft-v4.ts'
import { createSaveQuizDraftHandler, DraftSaveConflict, type DraftAttemptSnapshot } from './handler.ts'

interface RpcResponse { data: unknown; error: { code?: string; message: string } | null }
interface DraftRpcClient { rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResponse> }

export default {
  fetch: withSupabase<Database>({ auth: 'user' }, async (request, ctx) => {
    const userId = ctx.userClaims?.id
    if (!userId) return Response.json({ code: 'unauthorized' }, { status: 401 })
    // Production-generated types predate this local-only migration. Keep the untyped RPC
    // boundary small, with explicitly checked metadata, until rollout type generation.
    const admin = ctx.supabaseAdmin as unknown as DraftRpcClient
    return createSaveQuizDraftHandler({
      userId,
      async loadAttempt(attemptId) {
        const { data, error } = await ctx.supabase.from('attempts')
          .select('id,user_id,quiz_id,quiz_revision,status,updated_at,answer_schema_version')
          .eq('id', attemptId).eq('user_id', userId).maybeSingle()
        if (error) throw new Error('Draft load unavailable')
        return data as unknown as DraftAttemptSnapshot | null
      },
      async saveDraft(input) {
        const { data, error } = await admin.rpc('save_quiz_attempt_v4', {
          p_user_id: input.userId, p_attempt_id: input.attemptId,
          p_expected_updated_at: input.expectedUpdatedAt, p_client_updated_at: input.clientUpdatedAt,
          p_answers: input.answers,
        })
        if (error?.code === '40001') throw new DraftSaveConflict()
        if (error || !Array.isArray(data) || data.length !== 1 || !draftRecord(data[0])) throw new Error('Draft save unavailable')
        const row = data[0]
        if (row.id !== input.attemptId || row.answer_schema_version !== 2 || !validDraftTimestamp(row.updated_at)) {
          throw new Error('Draft metadata unavailable')
        }
        return { attemptId: input.attemptId, updatedAt: row.updated_at, answerSchemaVersion: 2 }
      },
    })(request)
  }),
}
