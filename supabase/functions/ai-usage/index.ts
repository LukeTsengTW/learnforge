import { withSupabase } from 'npm:@supabase/server@1.5.3'
import type { Database } from '../../../src/types/database.types.ts'
import { createAiUsageHandler } from './handler.ts'

export default {
  fetch: withSupabase<Database>({ auth: 'user' }, async (request, ctx) => {
    const userId = ctx.userClaims?.id
    if (!userId) return Response.json({ code: 'unauthorized' }, { status: 401 })
    return createAiUsageHandler({
      async summary() {
        const { data, error } = await ctx.supabaseAdmin.rpc('get_ai_usage_summary', { p_user_id: userId })
        if (error) throw new Error('Summary unavailable')
        return data
      },
      async page(cursor) {
        const { data, error } = await ctx.supabaseAdmin.rpc('get_ai_usage_page', {
          p_user_id: userId, p_cursor_at: cursor?.createdAt,
          p_cursor_id: cursor?.id, p_limit: 21,
        })
        if (error) throw new Error('Page unavailable')
        const rows = data ?? []
        const attemptIds = [...new Set(rows.map((row) => row.attempt_id))]
        if (attemptIds.length === 0) return []
        const { data: attempts, error: attemptError } = await ctx.supabase.from('attempts')
          .select('id,quiz_id,quiz_revision').eq('user_id', userId).in('id', attemptIds)
        if (attemptError) throw new Error('Attempt metadata unavailable')
        const metadata = new Map((attempts ?? []).map((attempt) => [attempt.id, attempt]))
        return rows.map((row) => ({ ...row,
          quiz_id: metadata.get(row.attempt_id)?.quiz_id ?? null,
          quiz_revision: metadata.get(row.attempt_id)?.quiz_revision ?? null }))
      },
    })(request)
  }),
}
