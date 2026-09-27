import { normalizeUsername, validateUsername } from '../_shared/username.ts'
import { digest, normalizeRecoveryCode, readSecurityBody, RECOVERY_INVALID, securityHeaders, securityJson, validateNewPassword } from '../_shared/account-security.ts'
export interface RecoveryBackend {
  verifyCaptcha(token: string): Promise<boolean>
  claim(username: string, hash: string, ipHash: string): Promise<{ userId?: string; claimId?: string; limited?: boolean }>
  update(userId: string, claimId: string, password: string): Promise<void>
  release(userId: string, claimId: string): Promise<string>
}
export function createRecoveryHandler(backend: RecoveryBackend) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: securityHeaders })
    if (request.method !== 'POST') return securityJson({ error: '不支援的要求。' }, 405)
    try {
      const body = await readSecurityBody(request)
      if (Object.keys(body).some(key => !['username', 'code', 'password', 'captchaToken'].includes(key))
        || typeof body.username !== 'string' || !validateUsername(body.username) || typeof body.code !== 'string'
        || !validateNewPassword(body.password)) return securityJson({ error: RECOVERY_INVALID }, 400)
      if (!await backend.verifyCaptcha(typeof body.captchaToken === 'string' ? body.captchaToken : '')) return securityJson({ error: '請完成安全驗證後再試。' }, 400)
      // Malformed codes still spend the durable quotas; never query by user-supplied UUID.
      const hash = await digest(normalizeRecoveryCode(body.code) ?? 'invalid-format')
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 100) || 'unknown'
      const claim = await backend.claim(normalizeUsername(body.username), hash, await digest(ip))
      if (claim.limited) return securityJson({ error: '請求過於頻繁，請稍後再試。' }, 429, { 'Retry-After': '1800' })
      if (!claim.userId || !claim.claimId) return securityJson({ error: RECOVERY_INVALID }, 400)
      try { await backend.update(claim.userId, claim.claimId, body.password) }
      catch {
        // The database fence rejects a delayed write after release; committed updates stay used.
        const state = await backend.release(claim.userId, claim.claimId)
        if (state !== 'used') return securityJson({ error: '密碼未更新。請稍後以同一復原碼重試，或使用原密碼登入。' }, 503)
      }
      return securityJson({ success: true })
    } catch { return securityJson({ error: '目前無法復原帳號，請稍後重試。' }, 503) }
  }
}
