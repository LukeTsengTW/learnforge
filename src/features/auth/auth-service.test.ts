import { describe, expect, it, vi } from 'vitest'
import { createAuthService } from './auth-service'
import type { AppSupabase } from '../../lib/supabase'
function fakeClient() {
  const future = Math.floor(Date.now() / 1000) + 3600
  const session = { user: { id: 'account-a', user_metadata: { username: 'student' } }, expires_at: future }
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: session.user }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { session }, error: null }),
  }
  const profile = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'account-a', username: 'student' }, error: null }) }
  const client = { auth, from: vi.fn(() => profile) } as unknown as AppSupabase
  return { auth, profile, client, session, service: createAuthService(client) }
}
describe('Auth API boundaries', () => {
  it('passes passwords only as Auth credentials; profile metadata contains only normalized username and hint', async () => {
    const { service, auth } = fakeClient()
    await service.register({ username: ' Student ', password: 'test-passphrase', confirmPassword: 'test-passphrase', hint: 'a clue' })
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'student@users.learnforge.invalid', password: 'test-passphrase', options: { data: { username: 'student', password_hint: 'a clue' } } })
    await service.login(' Student ', 'test-passphrase')
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'student@users.learnforge.invalid', password: 'test-passphrase' })
  })
  it('reads only its own profile', async () => {
    const { service, profile } = fakeClient()
    expect(await service.restore()).toEqual({ id: 'account-a', username: 'student' })
    expect(profile.eq).toHaveBeenCalledWith('id', 'account-a')
  })
  it('clears failed refresh sessions and does not retain authenticated state', async () => {
    const { service, auth } = fakeClient()
    auth.getSession.mockResolvedValue({ data: { session: null }, error: { code: 'refresh_token_not_found' } })
    await expect(service.restore()).rejects.toMatchObject({ code: 'refresh_token_not_found' })
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
  it('rejects revoked/expired sessions but keeps a nonexpired offline session usable locally', async () => {
    const { service, auth, session } = fakeClient()
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } })
    expect(await service.restore()).toBeNull()
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 0 } })
    expect(await service.restore()).toEqual({ id: 'account-a', username: 'student' })
    auth.getSession.mockResolvedValue({ data: { session: { ...session, expires_at: 1 } }, error: null })
    expect(await service.restore()).toBeNull()
  })
})
