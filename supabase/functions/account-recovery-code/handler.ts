import { digest, generateRecoveryCode, normalizeRecoveryCode, readSecurityBody, securityHeaders, securityJson } from '../_shared/account-security.ts'
export interface RecoveryCodeBackend {
  manage(hash: string | null): Promise<{ validSession: boolean; active?: boolean; createdAt?: string | null }>
}
export function createRecoveryCodeHandler(backend: RecoveryCodeBackend) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: securityHeaders })
    if (request.method !== 'POST') return securityJson({ error: '不支援的要求。' }, 405)
    try {
      const input = await readSecurityBody(request)
      if (Object.keys(input).length !== 1 || !['status', 'generate'].includes(String(input.action))) return securityJson({ error: '格式錯誤。' }, 400)
      const code = input.action === 'generate' ? generateRecoveryCode() : null
      const state = await backend.manage(code ? await digest(normalizeRecoveryCode(code)!) : null)
      if (!state.validSession) return securityJson({ error: '請重新登入後再試。' }, 401)
      return securityJson({ active: state.active === true, createdAt: state.createdAt ?? null, ...(code ? { code } : {}) })
    } catch { return securityJson({ error: '目前無法管理復原碼，請稍後再試。' }, 503) }
  }
}
