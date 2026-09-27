import { createContext, useContext } from 'react'
import type { AppSupabase } from '../../lib/supabase'
import { usernameToSyntheticEmail, normalizeUsername } from '../../lib/username'
import { validateNewPassword } from '../../../supabase/functions/_shared/account-security'

export interface RecoveryStatus { active: boolean; createdAt: string | null }
export interface AccountSecurity {
  status(): Promise<RecoveryStatus>
  generate(): Promise<string>
  recover(username: string, code: string, password: string, captchaToken?: string): Promise<void>
  changePassword(username: string, current: string, password: string, captchaToken?: string): Promise<void>
}
export const SecurityContext = createContext<AccountSecurity | null>(null)
export const useAccountSecurity = () => useContext(SecurityContext)
export function passwordError(password: string, confirmation: string): string | null {
  if (!validateNewPassword(password)) return '密碼至少 8 個字元，UTF-8 編碼最多 72 bytes；建議使用較長且未重複使用的密碼。'
  if (password !== confirmation) return '兩次輸入的密碼不一致。'
  return null
}
export class AccountSecurityError extends Error {}
export function securityError(error: unknown): string {
  return error instanceof AccountSecurityError ? error.message : '目前無法完成要求，請檢查網路連線後再試。'
}
export function createAccountSecurity(client: AppSupabase): AccountSecurity {
  async function invoke(name: string, body: Record<string, unknown>) {
    const { data, error } = await client.functions.invoke(name, { body })
    if (error) {
      const response = 'context' in error && error.context instanceof Response ? error.context : null
      if (response?.status === 429) throw new AccountSecurityError('請求過於頻繁，請於 30 分鐘後再試。')
      if (response?.status === 401) throw new AccountSecurityError('登入已失效，請重新登入。')
      if (name === 'recover-account' && response?.status === 400) throw new AccountSecurityError('復原資訊無效或已過期，或安全驗證未完成。')
      throw new AccountSecurityError('服務暫時無法使用；請稍後重試。復原時若回覆中斷，請先嘗試以新密碼登入。')
    }
    if (!data || typeof data !== 'object') throw new Error('Invalid response')
    return data as Record<string, unknown>
  }
  return {
    async status() {
      const data = await invoke('account-recovery-code', { action: 'status' })
      if (typeof data.active !== 'boolean') throw new Error('Invalid response')
      return { active: data.active, createdAt: typeof data.createdAt === 'string' ? data.createdAt : null }
    },
    async generate() {
      const data = await invoke('account-recovery-code', { action: 'generate' })
      if (typeof data.code !== 'string' || !/^(?:[0-9A-F]{4}-){7}[0-9A-F]{4}$/.test(data.code)) throw new Error('Invalid response')
      return data.code
    },
    async recover(username, code, password, captchaToken) {
      const data = await invoke('recover-account', { username: normalizeUsername(username), code, password, captchaToken })
      if (data.success !== true) throw new Error('Invalid response')
    },
    async changePassword(username, current, password, captchaToken) {
      if (!current || !validateNewPassword(password)) throw new AccountSecurityError('請輸入目前密碼與符合規則的新密碼。')
      const { data: before, error: beforeError } = await client.auth.getUser()
      if (beforeError || !before.user) throw new AccountSecurityError('請重新登入。')
      const { data, error } = await client.auth.signInWithPassword({ email: usernameToSyntheticEmail(username), password: current,
        ...(captchaToken ? { options: { captchaToken } } : {}) })
      if (error || data.user?.id !== before.user.id) throw new AccountSecurityError('目前密碼不正確或安全驗證失敗。')
      const result = await client.auth.updateUser({ password, current_password: current })
      if (result.error) throw new AccountSecurityError('密碼未更新，請確認密碼強度後重試。')
    },
  }
}
