import type { AppSupabase } from '../../lib/supabase'
import { normalizeUsername, usernameToSyntheticEmail, validateUsername } from '../../lib/username'

export interface Account { id: string; username: string }
export interface Registration { username: string; password: string; confirmPassword: string; hint: string }
export interface AuthService {
  restore(): Promise<Account | null>
  subscribe(listener: () => void): () => void
  login(username: string, password: string): Promise<void>
  register(input: Registration): Promise<void>
  logout(): Promise<void>
  hint(username: string): Promise<string | null>
}
export function validateLogin(username: string, password: string): string | null {
  if (!validateUsername(username)) return '使用者名稱須為 3–24 個英文字母、數字或底線。'
  if (!password) return '請輸入密碼。'
  return null
}
export function validateRegistration(input: Registration): string | null {
  const base = validateLogin(input.username, input.password)
  if (base) return base
  if (input.password.length < 8) return '密碼至少需要 8 個字元。'
  if (input.password !== input.confirmPassword) return '兩次輸入的密碼不一致。'
  if (!input.hint.trim() || [...input.hint.trim()].length > 200) return '密碼提示須為 1–200 個字元。'
  if (input.hint.includes(input.password)) return '請勿直接把密碼寫在提示中。'
  return null
}
export function authError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : ''
  if (code === 'invalid_credentials') return '使用者名稱或密碼不正確。'
  if (code === 'user_already_exists' || code === 'email_exists') return '此使用者名稱已被註冊。'
  if (code === 'weak_password') return '密碼強度不足，請使用至少 8 個字元的較長密碼。'
  if (code === 'refresh_token_not_found' || code === 'refresh_token_already_used' || code === 'session_not_found') return '登入已過期，作答內容仍保留。請重新登入。'
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') return '請求過於頻繁，請稍後再試。'
  return '目前無法完成要求，請檢查網路連線後再試。'
}

export function createAuthService(client: AppSupabase): AuthService {
  return {
    async restore() {
      const { data, error } = await client.auth.getSession()
      if (error) { await client.auth.signOut({ scope: 'local' }); throw error }
      if (!data.session) return null
      const { data: verified, error: verifyError } = await client.auth.getUser()
      if (verifyError) {
        // Retain local work during transport outages, but never accept an expired token offline.
        if (verifyError.status === 401 || verifyError.status === 403 || !data.session.expires_at || data.session.expires_at * 1000 <= Date.now()) {
          await client.auth.signOut({ scope: 'local' }); return null
        }
        const name: unknown = data.session.user.user_metadata.username
        if (typeof name === 'string' && validateUsername(name)) return { id: data.session.user.id, username: normalizeUsername(name) }
        throw verifyError
      }
      const { data: profile, error: profileError } = await client.from('profiles').select('id, username').eq('id', verified.user.id).single()
      if (profileError) throw profileError
      return { id: profile.id, username: profile.username }
    },
    subscribe(listener) {
      // Do not await other Auth methods inside the auth lock/callback.
      const { data } = client.auth.onAuthStateChange(() => { queueMicrotask(listener) })
      return () => data.subscription.unsubscribe()
    },
    async login(username, password) {
      const invalid = validateLogin(username, password)
      if (invalid) throw new Error(invalid)
      const { error } = await client.auth.signInWithPassword({ email: usernameToSyntheticEmail(username), password })
      if (error) throw error
    },
    async register(input) {
      const invalid = validateRegistration(input)
      if (invalid) throw new Error(invalid)
      const { data, error } = await client.auth.signUp({ email: usernameToSyntheticEmail(input.username), password: input.password,
        options: { data: { username: normalizeUsername(input.username), password_hint: input.hint.trim() } } })
      if (error) throw error
      if (!data.session) throw new Error('Registration did not establish a session. Check email confirmation settings.')
    },
    async logout() {
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) throw error
    },
    async hint(username) {
      const { data, error } = await client.functions.invoke('password-hint', { body: { username: normalizeUsername(username) } })
      if (error) {
        if ('context' in error && error.context instanceof Response && error.context.status === 429) {
          throw Object.assign(new Error('Rate limited'), { code: 'over_request_rate_limit' })
        }
        throw error
      }
      if (!data || (data.hint !== null && typeof data.hint !== 'string')) throw new Error('Invalid response')
      return data.hint as string | null
    },
  }
}
