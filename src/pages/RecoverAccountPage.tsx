import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { passwordError, securityError, useAccountSecurity } from '../features/auth/account-security'
import { Turnstile } from '../features/auth/Turnstile'
import { turnstileSiteKey } from '../features/auth/captcha-config'
export function RecoverAccountPage() {
  const service = useAccountSecurity()
  const [username, setUsername] = useState(''), [code, setCode] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('')
  const [token, setToken] = useState(''), [captchaKey, setCaptchaKey] = useState(0)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    const invalid = passwordError(password, confirm); setError(invalid ?? '')
    if (invalid || !service) return
    setBusy(true)
    try { await service.recover(username, code, password, token); setPassword(''); setConfirm(''); setCode(''); setDone(true) }
    catch (failure) { setError(securityError(failure)) }
    finally { setBusy(false); setToken(''); setCaptchaKey(key => key + 1) }
  }
  return <section className="auth-card"><h1>復原帳號</h1><p>使用你保存的帳號復原碼設定新密碼，不需要電子郵件。</p>
    {done ? <div role="status"><h2>密碼已更新</h2><p>請使用新密碼正常登入，並產生新的復原碼。</p><Link to="/login">前往登入</Link></div> : <form onSubmit={event => { void submit(event) }}>
      <label htmlFor="recover-username">使用者名稱</label><input id="recover-username" autoComplete="username" autoCapitalize="none" value={username} onChange={e => setUsername(e.target.value)} required />
      <label htmlFor="recover-code">帳號復原碼</label><input id="recover-code" autoComplete="off" spellCheck={false} value={code} onChange={e => setCode(e.target.value)} required />
      <label htmlFor="recover-password">新密碼</label><input id="recover-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required />
      <p className="field-note">至少 8 個字元，最多 72 UTF-8 bytes。</p>
      <label htmlFor="recover-confirm">確認新密碼</label><input id="recover-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
      <Turnstile key={captchaKey} action="recovery" onToken={setToken} />
      {error && <p role="alert" className="notice warning">{error}</p>}
      <button className="button primary" disabled={busy || !service || (!!turnstileSiteKey && !token)}>{busy ? '處理中…' : '重設密碼'}</button>
    </form>}
    <div className="auth-links"><Link to="/login">返回登入</Link><Link to="/forgot-password">密碼提示（不能重設密碼）</Link></div>
  </section>
}
