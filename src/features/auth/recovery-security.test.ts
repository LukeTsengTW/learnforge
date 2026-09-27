import { describe, expect, it, vi } from 'vitest'
import { digest, generateRecoveryCode, normalizeRecoveryCode, RECOVERY_INVALID } from '../../../supabase/functions/_shared/account-security'
import { createRecoveryHandler, type RecoveryBackend } from '../../../supabase/functions/recover-account/handler'
import { createRecoveryCodeHandler } from '../../../supabase/functions/account-recovery-code/handler'
import { createAccountSecurity } from './account-security'
import type { AppSupabase } from '../../lib/supabase'
const request = (body: unknown) => new Request('https://example.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
function setup() {
  const backend = { verifyCaptcha: vi.fn(async () => true), claim: vi.fn<RecoveryBackend['claim']>(async () => ({ userId: 'a', claimId: 'claim' })),
    update: vi.fn(async () => {}), release: vi.fn(async () => 'released') } satisfies RecoveryBackend
  return { backend, handle: createRecoveryHandler(backend), input: { username: ' Student ', code: generateRecoveryCode(), password: 'test-passphrase' } }
}
describe('account recovery security boundaries', () => {
  it('uses 16 random bytes, canonical encoding and one-way digests', async () => {
    const random = vi.spyOn(crypto, 'getRandomValues')
    const values = Array.from({ length: 50 }, generateRecoveryCode)
    expect(random).toHaveBeenCalledTimes(50)
    expect(random.mock.calls[0][0]?.byteLength).toBe(16)
    expect(new Set(values).size).toBe(50)
    expect(normalizeRecoveryCode(values[0].toLowerCase())).toHaveLength(32)
    expect(await digest(normalizeRecoveryCode(values[0])!)).toMatch(/^[a-f0-9]{64}$/)
    expect(normalizeRecoveryCode('123456')).toBeNull()
  })
  it('returns raw code only for generation and rejects forged user IDs', async () => {
    const manage = vi.fn(async () => ({ validSession: true, active: true }))
    const handle = createRecoveryCodeHandler({ manage })
    const generated = await (await handle(request({ action: 'generate' }))).json()
    expect(generated.code).toHaveLength(39)
    expect(manage.mock.calls[0]).toEqual([await digest(normalizeRecoveryCode(generated.code)!)])
    expect(await (await handle(request({ action: 'status' }))).json()).not.toHaveProperty('code')
    expect((await handle(request({ action: 'generate', userId: 'foreign' }))).status).toBe(400)
  })
  it('denies a revoked session before disclosing or generating a usable code', async () => {
    const handle = createRecoveryCodeHandler({ manage: async () => ({ validSession: false }) })
    expect((await handle(request({ action: 'generate' }))).status).toBe(401)
  })
  it('normalizes username, hashes secrets and never creates a session', async () => {
    const { backend, handle, input } = setup()
    const result = await handle(request(input))
    expect(await result.json()).toEqual({ success: true })
    expect(result.headers.get('cache-control')).toBe('no-store')
    expect(backend.claim.mock.calls[0]?.[0]).toBe('student')
    expect(backend.claim.mock.calls[0]?.[1]).not.toBe(input.code)
  })
  it.each(['unknown username', 'wrong code', 'used code'])('returns the same generic response for %s', async () => {
    const { backend, handle, input } = setup()
    backend.claim.mockResolvedValue({} as { userId: string; claimId: string })
    const response = await handle(request(input))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: RECOVERY_INVALID })
    expect(backend.update).not.toHaveBeenCalled()
  })
  it('checks CAPTCHA server-side and never accepts browser assertions', async () => {
    const { backend, handle, input } = setup()
    backend.verifyCaptcha.mockResolvedValue(false)
    expect((await handle(request({ ...input, captchaToken: 'untrusted' }))).status).toBe(400)
    expect(backend.claim).not.toHaveBeenCalled()
  })
  it('returns 429 and Retry-After without invoking Auth', async () => {
    const { backend, handle, input } = setup()
    backend.claim.mockResolvedValue({ limited: true } as unknown as { userId: string; claimId: string })
    const response = await handle(request(input))
    expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('1800')
    expect(backend.update).not.toHaveBeenCalled()
  })
  it.each([['released', 503], ['used', 200]])('reconciles an ambiguous Auth response as %s', async (state, status) => {
    const { backend, handle, input } = setup()
    backend.update.mockRejectedValue(new Error('provider secret must not escape'))
    backend.release.mockResolvedValue(state as string)
    const response = await handle(request(input))
    expect(response.status).toBe(status)
    expect(await response.text()).not.toContain('provider secret')
  })
  it.each([{ password: 'short' }, { userId: 'foreign' }, { model: 'arbitrary' }, { code: 1 }])('rejects invalid inputs %j', async extra => {
    const { backend, handle, input } = setup()
    expect((await handle(request({ ...input, ...extra }))).status).toBe(400)
    expect(backend.update).not.toHaveBeenCalled()
  })
  it('bounds request size even without Content-Length', async () => {
    const { handle, input } = setup()
    expect((await handle(request({ ...input, code: 'x'.repeat(5000) }))).status).toBe(503)
  })
  it('requires the current password and refuses to update on reauthentication failure', async () => {
    const auth = { getUser: vi.fn(async () => ({ data: { user: { id: 'a' } }, error: null })),
      signInWithPassword: vi.fn(async () => ({ data: {}, error: { code: 'invalid_credentials' } })), updateUser: vi.fn() }
    const security = createAccountSecurity({ auth } as unknown as AppSupabase)
    await expect(security.changePassword('student', 'wrong-current', 'new-passphrase')).rejects.toThrow('目前密碼')
    expect(auth.updateUser).not.toHaveBeenCalled()
  })
})
