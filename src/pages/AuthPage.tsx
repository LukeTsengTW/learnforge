import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'
import { authError, validateLogin, validateRegistration } from '../features/auth/auth-service'
import { safeDestination } from '../features/auth/auth-navigation'
import { normalizeUsername, validateUsername } from '../lib/username'
import { useAccountSecurity, securityError } from '../features/auth/account-security'
import { RecoveryCode } from '../features/auth/RecoveryCode'
import { Turnstile } from '../features/auth/Turnstile'
import { turnstileSiteKey } from '../features/auth/captcha-config'

export function AuthPage({ mode }: { mode: 'login' | 'register' | 'hint' }) {
  const { account, loading, service, refresh } = useAuth()
  const security = useAccountSecurity()
  const location = useLocation()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirm] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)
  const destination = safeDestination(location.state?.from)
  const title = mode === 'register' ? '建立學習帳號' : mode === 'hint' ? '找回密碼提示' : '歡迎回來'
  if (!loading && account && mode !== 'hint' && !registering) return <Navigate to={destination} replace />
  async function generateCode() {
    setBusy(true); setError(null)
    try {
      if (!security) throw new Error('Unavailable')
      setRecoveryCode(await security.generate())
    } catch (failure) { setError(securityError(failure)) } finally { setBusy(false) }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    const input = { username, password, confirmPassword, hint, ...(captchaToken ? { captchaToken } : {}) }
    const invalid = mode === 'register' ? validateRegistration(input) : mode === 'login' ? validateLogin(username, password)
      : validateUsername(username) ? null : '使用者名稱須為 3–24 個英文字母、數字或底線。'
    setError(invalid); setResult(null)
    if (invalid || !service) return
    setBusy(true)
    try {
      if (mode === 'hint') setResult(await service.hint(username) ?? '找不到此帳號的密碼提示，請確認使用者名稱。')
      else {
        if (mode === 'register') {
          setRegistering(true)
          try { await service.register(input) } catch (failure) { setRegistering(false); throw failure }
          setRegistered(true)
        } else await service.login(username, password, captchaToken || undefined)
        setPassword(''); setConfirm('')
        await refresh()
        if (mode === 'register') await generateCode()
        else navigate(destination, { replace: true })
      }
    } catch (failure) { setError(authError(failure)) }
    finally { setBusy(false); setCaptchaToken(''); setCaptchaKey(value => value + 1) }
  }
  if (registered) return <section className="auth-card"><h1>帳號已建立</h1>
    {recoveryCode ? <RecoveryCode code={recoveryCode} onSaved={() => { setRecoveryCode(null); navigate(destination, { replace: true }) }} />
      : <><p>請先產生並保存帳號復原碼，再繼續。</p>{error && <p role="alert" className="notice warning">{error}</p>}
        <button className="button primary" disabled={busy} onClick={() => { void generateCode() }}>重試產生復原碼</button></>}
  </section>
  return <section className="auth-card" aria-labelledby="auth-title"><span className="subject-label">LEARNFORGE · 學習帳號</span>
    <h1 id="auth-title">{title}</h1><p className="muted">{mode === 'hint' ? '提示不能重設密碼。它只是協助回想密碼；重設請使用帳號復原碼。' : '登入後，在不同裝置接續你的練習。'}</p>
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
      {mode !== 'hint' && <Turnstile key={captchaKey} action={mode === 'register' ? 'signup' : 'login'} onToken={setCaptchaToken} />}
      <button className="button primary" type="submit" disabled={busy || loading || !service || (mode !== 'hint' && !!turnstileSiteKey && !captchaToken)}>{busy ? '處理中…' : mode === 'register' ? '註冊' : mode === 'hint' ? '查詢提示' : '登入'}</button>
    </form>
    <div className="auth-links">{mode !== 'login' && <Link to="/login" state={{ from: destination }}>返回登入</Link>}{mode !== 'register' && <Link to="/register" state={{ from: destination }}>建立帳號</Link>}<Link to="/recover-account">使用復原碼重設密碼</Link>{mode === 'login' && <Link to="/forgot-password">忘記密碼？查看提示</Link>}</div>
  </section>
}
