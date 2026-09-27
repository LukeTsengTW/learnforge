// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Application } from '../../App'
import { createMemoryPracticeRepository } from '../quiz/practice-memory.test-helper'
import type { AuthService } from './auth-service'
import type { AccountSecurity } from './account-security'
import { generateRecoveryCode } from '../../../supabase/functions/_shared/account-security'
afterEach(cleanup)
function setup(path: string, signedIn = true) {
  localStorage.clear(); window.location.hash = `#${path}`
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const auth: AuthService = { restore: vi.fn(async () => signedIn ? { id: 'student', username: 'student' } : null), subscribe: () => () => {},
    login: vi.fn(async () => {}), register: vi.fn(async () => { signedIn = true }), logout: vi.fn(async () => {}), hint: vi.fn(async () => null) }
  const code = generateRecoveryCode()
  const security: AccountSecurity = { status: vi.fn(async () => ({ active: false, createdAt: null })), generate: vi.fn(async () => code), recover: vi.fn(async () => {}), changePassword: vi.fn(async () => {}) }
  const view = render(<Application auth={auth} security={security} createRepository={() => createMemoryPracticeRepository('student')} />)
  return { auth, security, code, view, user: userEvent.setup() }
}
describe('account release UX', () => {
  it.each(['/account', '/recovery'])('guards %s', async path => {
    setup(path, false); await screen.findByRole('heading', { name: '歡迎回來' })
  })
  it('displays a generated code once, requires acknowledgement and never persists it', async () => {
    const { user, code } = setup('/account')
    await user.click(await screen.findByRole('button', { name: '產生復原碼' }))
    expect(await screen.findByText(code)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '繼續' })).toBeDisabled()
    await user.click(screen.getByLabelText('我已保存復原碼')); await user.click(screen.getByRole('button', { name: '繼續' }))
    expect(screen.queryByText(code)).toBeNull(); expect(localStorage.length).toBe(0)
    expect(screen.getByText('Recovery Code 已設定')).toBeInTheDocument()
  })
  it('keeps registration on the save-code step until explicit acknowledgement', async () => {
    const { user, code } = setup('/register', false)
    await screen.findByRole('heading', { name: '建立學習帳號' })
    await user.type(screen.getByLabelText('使用者名稱'), 'student')
    await user.type(screen.getByLabelText('密碼', { exact: true }), 'test-passphrase')
    await user.type(screen.getByLabelText('確認密碼'), 'test-passphrase')
    await user.type(screen.getByLabelText('密碼提示'), 'memory aid')
    await user.click(screen.getByRole('button', { name: '註冊' }))
    expect(await screen.findByText(code)).toBeInTheDocument()
    expect(window.location.hash).toBe('#/register')
    await user.click(screen.getByLabelText('我已保存復原碼')); await user.click(screen.getByRole('button', { name: '繼續' }))
    expect(window.location.hash).toBe('#/')
  })
  it('recovers without email or automatically signing in', async () => {
    const { user, auth, code, security } = setup('/recover-account', false)
    await screen.findByRole('heading', { name: '復原帳號' })
    await user.type(screen.getByLabelText('使用者名稱'), 'student'); await user.type(screen.getByLabelText('帳號復原碼'), code)
    await user.type(screen.getByLabelText('新密碼', { exact: true }), 'new-passphrase')
    await user.type(screen.getByLabelText('確認新密碼'), 'new-passphrase')
    await user.click(screen.getByRole('button', { name: '重設密碼' }))
    await screen.findByRole('heading', { name: '密碼已更新' })
    expect(security.recover).toHaveBeenCalledTimes(1); expect(auth.login).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/email/i)).toBeNull()
  })
})
