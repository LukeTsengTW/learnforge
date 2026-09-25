import { withSupabase } from 'npm:@supabase/server@1.5.3'
import type { Database } from '../../../src/types/database.types.ts'
import { createAiResponsesHandler } from './handler.ts'

export default {
  fetch: withSupabase<Database>({ auth: 'user' }, async (request, ctx) => {
    const userId = ctx.userClaims?.id
    if (!userId) return Response.json({ code: 'unauthorized' }, { status: 401 })
    return createAiResponsesHandler({
      async ownsAttempt(attemptId) {
        const { data, error } = await ctx.supabase.from('attempts').select('id,quiz_id,quiz_revision,status')
          .eq('id', attemptId).eq('user_id', userId).maybeSingle()
        if (error) throw new Error('Attempt unavailable')
        return data?.id === attemptId ? { quizId: data.quiz_id, revision: data.quiz_revision, status: data.status } : false
      },
      async loadResponses(attemptId) {
        const { data, error } = await ctx.supabaseAdmin.rpc('get_ai_responses_for_attempt', {
          p_user_id: userId, p_attempt_id: attemptId,
        })
        if (error) throw new Error('Responses unavailable')
        return data ?? []
      },
    })(request)
  }),
}
