import { withSupabase } from 'npm:@supabase/server@1.5.3'
import type { Database } from '../../../src/types/database.types.ts'
import { createQuotaHandler } from './handler.ts'

export default {
  fetch: withSupabase<Database>({ auth: 'user' }, async (request, ctx) => {
    const userId = ctx.userClaims?.id
    if (!userId) return Response.json({ code: 'unauthorized', error: '請重新登入後再試。' }, { status: 401 })
    return createQuotaHandler({
      async status() {
        const { data, error } = await ctx.supabaseAdmin.rpc('get_ai_quota_status', { p_user_id: userId })
        if (error) throw new Error('Quota unavailable')
        return data
      },
    })(request)
  }),
}
