import { createClient } from 'npm:@supabase/supabase-js@2.117.1'
import type { Database } from '../../../src/types/database.types.ts'
import { createRecoveryHandler, type RecoveryBackend } from './handler.ts'

const client = createClient<Database>(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12000) }) },
})
Deno.serve(createRecoveryHandler({
  async verifyCaptcha(token) {
    const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
    if (!secret) return Deno.env.get('RECOVERY_ALLOW_NO_CAPTCHA') === 'true'
    if (!token || token.length > 2048) return false
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret, response: token }), signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return false
    const result = await response.json()
    const hosts = (Deno.env.get('TURNSTILE_ALLOWED_HOSTNAMES') ?? '').split(',').map(host => host.trim()).filter(Boolean)
    return result.success === true && result.action === 'recovery' && hosts.includes(result.hostname)
  },
  async claim(username, hash, ipHash) {
    const { data, error } = await client.rpc('claim_account_recovery', { p_username: username, p_code_hash: hash, p_ip_hash: ipHash })
    if (error || !data) throw new Error('Unavailable')
    return data as unknown as Awaited<ReturnType<RecoveryBackend['claim']>>
  },
  async update(userId, claimId, password) {
    const { error } = await client.auth.admin.updateUserById(userId, { password, app_metadata: { learnforge_recovery_claim: claimId } })
    if (error) throw new Error('Update unavailable')
  },
  async release(userId, claimId) {
    const { data, error } = await client.rpc('release_account_recovery', { p_user_id: userId, p_claim_id: claimId })
    if (error || !data) throw new Error('Reconciliation unavailable')
    return data
  },
}))
