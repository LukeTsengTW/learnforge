import { describe, expect, it } from 'vitest'
import { normalizeUsername, validateUsername, usernameToSyntheticEmail } from '../../lib/username'
import { validateLogin, validateRegistration, authError } from './auth-service'
import { safeDestination } from './auth-navigation'
import { configureSupabase } from '../../lib/supabase'
const registration = { username: ' Student ', password: 'long-enough-password', confirmPassword: 'long-enough-password', hint: 'A memorable phrase' }
describe('auth boundary', () => {
  it('normalizes whitespace and case consistently', () => {
    expect(normalizeUsername(' LuKe_123 ')).toBe('luke_123')
    expect(usernameToSyntheticEmail(' LuKe_123 ')).toBe('luke_123@users.learnforge.invalid')
  })
  it.each(['ab', 'a'.repeat(25), 'a-b', 'abc@example.com', '名字', 'abc\nxyz', 'a.b'])('rejects invalid username %s', value => {
    expect(validateUsername(value)).toBe(false)
    expect(() => usernameToSyntheticEmail(value)).toThrow()
  })
  it('accepts the length boundaries', () => {
    expect(validateUsername('abc')).toBe(true); expect(validateUsername('a'.repeat(24))).toBe(true)
  })
  it('validates login and every registration input without contacting Auth', () => {
    expect(validateLogin('student', '')).toMatch(/密碼/)
    expect(validateRegistration(registration)).toBeNull()
    expect(validateRegistration({ ...registration, password: 'short' })).toMatch(/8/)
    expect(validateRegistration({ ...registration, confirmPassword: 'different' })).toMatch(/不一致/)
    expect(validateRegistration({ ...registration, hint: '  ' })).toMatch(/1–200/)
    expect(validateRegistration({ ...registration, hint: 'a'.repeat(201) })).toMatch(/1–200/)
    expect(validateRegistration({ ...registration, hint: registration.password })).toMatch(/請勿/)
  })
  it('handles missing/secret config and sanitizes server errors and destinations', () => {
    expect(configureSupabase('', '').client).toBeNull()
    expect(configureSupabase('https://example.invalid', 'not-a-publishable-key').client).toBeNull()
    expect(authError({ code: 'user_already_exists', message: 'internal database detail' })).toBe('此使用者名稱已被註冊。')
    expect(authError(new Error('internal database detail'))).not.toMatch(/internal/)
    expect(safeDestination('https://evil.invalid')).toBe('/')
    expect(safeDestination('//evil.invalid')).toBe('/')
    expect(safeDestination('/login')).toBe('/')
    expect(safeDestination('/result/demo')).toBe('/result/demo')
  })
})
