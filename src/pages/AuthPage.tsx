import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'
import { authError, validateLogin, validateRegistration } from '../features/auth/auth-service'
import { safeDestination } from '../features/auth/auth-navigation'
import { normalizeUsername, validateUsername } from '../lib/username'

export function AuthPage({ mode }: { mode: 'login' | 'register' | 'hint' }) {
  const { account, loading, service, refresh } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirm] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const destination = safeDestination(location.state?.from)
  const title = mode === 'register' ? '建立學習帳號' : mode === 'hint' ? '找回密碼提示' : '歡迎回來'
  if (!loading && account && mode !== 'hint') return <Navigate to={destination} replace />
  async function submit(event: FormEvent) {
    event.preventDefault()
    const input = { username, password, confirmPassword, hint }
    const invalid = mode === 'register' ? validateRegistration(input) : mode === 'login' ? validateLogin(username, password)
      : validateUsername(username) ? null : '使用者名稱須為 3–24 個英文字母、數字或底線。'
    setError(invalid); setResult(null)
    if (invalid || !service) return
    setBusy(true)
    try {
      if (mode === 'hint') setResult(await service.hint(username) ?? '找不到此帳號的密碼提示，請確認使用者名稱。')
      else {
        if (mode === 'register') await service.register(input)
        else await service.login(username, password)
        setPassword(''); setConfirm('')
        await refresh(); navigate(destination, { replace: true })
      }
    } catch (failure) { setError(authError(failure)) }
    finally { setBusy(false) }
  }
  return <section className="auth-card" aria-labelledby="auth-title"><span className="subject-label">LEARNFORGE · 學習帳號</span>
    <h1 id="auth-title">{title}</h1><p className="muted">{mode === 'hint' ? 'LearnForge Demo 目前僅提供密碼提示，無法重設遺失的密碼。' : '登入後，在不同裝置接續你的練習。'}</p>
    <form noValidate onSubmit={(event) => { void submit(event) }}>
      <label htmlFor="username">使用者名稱</label><input id="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
        value={username} onChange={(event) => setUsername(event.target.value)} onBlur={() => setUsername(normalizeUsername(username))} aria-describedby="username-help" />
      <p id="username-help" className="field-note">3–24 個英文字母、數字或底線；英文字母統一轉為小寫。</p>
      {mode !== 'hint' && <><label htmlFor="password">密碼</label><input id="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></>}
      {mode === 'register' && <><p className="field-note">至少 8 個字元。</p><label htmlFor="confirm-password">確認密碼</label><input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirm(event.target.value)} />
        <label htmlFor="password-hint">密碼提示</label><input id="password-hint" type="text" autoComplete="off" value={hint} onChange={(event) => setHint(event.target.value)} aria-describedby="hint-help" />
        <p id="hint-help" className="field-note">密碼提示僅用於協助你回想密碼，無法重設密碼。<br />請勿直接把密碼寫在提示中。知道使用者名稱的人可查詢提示，請勿填入敏感資料。</p></>}
      {error && <p className="notice warning" role="alert">{error}</p>}
      {result !== null && <div className="notice" role="status"><strong>密碼提示</strong><p className="literal-answer">{result}</p></div>}
      <button className="button primary" type="submit" disabled={busy || loading || !service}>{busy ? '處理中…' : mode === 'register' ? '註冊' : mode === 'hint' ? '查詢提示' : '登入'}</button>
    </form>
    <div className="auth-links">{mode !== 'login' && <Link to="/login" state={{ from: destination }}>返回登入</Link>}{mode !== 'register' && <Link to="/register" state={{ from: destination }}>建立帳號</Link>}{mode === 'login' && <Link to="/forgot-password">忘記密碼？查看提示</Link>}</div>
  </section>
}
