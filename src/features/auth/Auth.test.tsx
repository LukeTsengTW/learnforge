// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Application } from '../../App'
import type { Account, AuthService } from './auth-service'
import type { AttemptRepository } from '../quiz/repositories'
function mockService() {
  let account: Account | null = null
  const listeners = new Set<() => void>()
  const authenticate = async () => { account = { id: 'student-id', username: 'student' }; listeners.forEach(fn => fn()) }
  const service: AuthService = {
    restore: vi.fn(async () => account), subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn) } },
    login: vi.fn(authenticate), register: vi.fn(authenticate),
    logout: vi.fn(async () => { account = null; listeners.forEach(fn => fn()) }), hint: vi.fn(async () => 'A clue'),
  }
  return service
}
const remote: AttemptRepository = { load: async () => null, save: async value => value, delete: async () => {} }
beforeEach(() => {
  localStorage.clear(); window.location.hash = '#/'
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('auth UI and session boundaries', () => {
  it('redirects to login, validates input, returns to the intended result, restores session and logs out', async () => {
    const auth = mockService(), user = userEvent.setup()
    window.location.hash = '#/result/demo'
    const first = render(<Application auth={auth} createRepository={() => remote} />)
    await screen.findByRole('heading', { name: '歡迎回來' })
    await user.click(screen.getByRole('button', { name: '登入' }))
    expect(screen.getByRole('alert')).toHaveTextContent('使用者名稱')
    expect(auth.login).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('使用者名稱'), ' Student ')
    await user.type(screen.getByLabelText('密碼', { exact: true }), 'password123')
    await user.click(screen.getByRole('button', { name: '登入' }))
    await screen.findByRole('heading', { name: '還沒有測驗結果' })
    expect(window.location.hash).toBe('#/result/demo')
    first.unmount(); render(<Application auth={auth} createRepository={() => remote} />)
    await screen.findByRole('button', { name: '登出' })
    await user.click(screen.getByRole('button', { name: '登出' }))
    await screen.findByRole('heading', { name: '歡迎回來' })
    expect(auth.logout).toHaveBeenCalledTimes(1)
  })
  it('validates registration and exposes only Username/Password UI', async () => {
    const auth = mockService(), user = userEvent.setup()
    window.location.hash = '#/register'
    render(<Application auth={auth} createRepository={() => remote} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '註冊' })).toBeEnabled())
    expect(screen.queryByLabelText(/Email|電子郵件/i)).toBeNull()
    await user.type(screen.getByLabelText('使用者名稱'), 'Student')
    await user.type(screen.getByLabelText('密碼', { exact: true }), 'short')
    await user.click(screen.getByRole('button', { name: '註冊' }))
    expect(screen.getByRole('alert')).toHaveTextContent('8')
    await user.clear(screen.getByLabelText('密碼', { exact: true }))
    await user.type(screen.getByLabelText('密碼', { exact: true }), 'password123')
    await user.type(screen.getByLabelText('確認密碼'), 'different')
    await user.click(screen.getByRole('button', { name: '註冊' }))
    expect(screen.getByRole('alert')).toHaveTextContent('不一致')
    await user.clear(screen.getByLabelText('確認密碼')); await user.type(screen.getByLabelText('確認密碼'), 'password123')
    await user.click(screen.getByRole('button', { name: '註冊' }))
    expect(screen.getByRole('alert')).toHaveTextContent('1–200')
    await user.type(screen.getByLabelText('密碼提示'), 'A private memory, no personal details')
    await user.click(screen.getByRole('button', { name: '註冊' }))
    await screen.findByRole('button', { name: '登出' })
    expect(auth.register).toHaveBeenCalledWith(expect.objectContaining({ username: 'student' }))
  })
  it('shows safe login errors and renders hints as text', async () => {
    const auth = mockService(), user = userEvent.setup()
    vi.mocked(auth.login).mockRejectedValue({ code: 'invalid_credentials', message: 'secret detail' })
    window.location.hash = '#/login'
    render(<Application auth={auth} createRepository={() => remote} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '登入' })).toBeEnabled())
    await user.type(screen.getByLabelText('使用者名稱'), 'student'); await user.type(screen.getByLabelText('密碼'), 'password123')
    await user.click(screen.getByRole('button', { name: '登入' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('使用者名稱或密碼不正確')
    await user.click(screen.getByRole('link', { name: /忘記密碼/ }))
    expect(screen.getByText('LearnForge Demo 目前僅提供密碼提示，無法重設遺失的密碼。')).toBeInTheDocument()
    vi.mocked(auth.hint).mockResolvedValue('<script>not executed</script>')
    await user.type(screen.getByLabelText('使用者名稱'), 'student')
    await user.click(screen.getByRole('button', { name: '查詢提示' }))
    expect(await screen.findByText('<script>not executed</script>')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })
})
