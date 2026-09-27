import { withSupabase } from 'npm:@supabase/server@1.5.3'
import type { Database } from '../../../src/types/database.types.ts'
import { createRecoveryCodeHandler, type RecoveryCodeBackend } from './handler.ts'
import { securityJson } from '../_shared/account-security.ts'

export default { fetch: withSupabase<Database>({ auth: 'user' }, async (request, ctx) => {
  const userId = ctx.userClaims?.id
  const sessionId = ctx.jwtClaims?.session_id
  if (!userId || typeof sessionId !== 'string') return securityJson({ error: '請重新登入後再試。' }, 401)
  return createRecoveryCodeHandler({ async manage(hash) {
    const { data, error } = await ctx.supabaseAdmin.rpc('manage_account_recovery', { p_user_id: userId, p_session_id: sessionId, ...(hash ? { p_code_hash: hash } : {}) })
    if (error || !data) throw new Error('Unavailable')
    return data as unknown as Awaited<ReturnType<RecoveryCodeBackend['manage']>>
  } })(request)
}) }
