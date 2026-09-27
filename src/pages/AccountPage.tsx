import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'
import { passwordError, securityError, useAccountSecurity, type RecoveryStatus } from '../features/auth/account-security'
import { RecoveryCode } from '../features/auth/RecoveryCode'
import { Turnstile } from '../features/auth/Turnstile'
import { turnstileSiteKey } from '../features/auth/captcha-config'
export function AccountPage() {
  const { account, service, refresh } = useAuth(), security = useAccountSecurity()
  const [status, setStatus] = useState<RecoveryStatus | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [current, setCurrent] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('')
  const [token, setToken] = useState(''), [captchaKey, setCaptchaKey] = useState(0)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    void security?.status().then(value => { if (active) setStatus(value) }).catch(failure => { if (active) setError(securityError(failure)) })
    return () => { active = false }
  }, [security])
  async function generate() {
    if (!security || busy) return
    if (status?.active && !window.confirm('產生新的復原碼後，舊碼立即失效。確定要更換？')) return
    setBusy(true); setError('')
    try { setCode(await security.generate()); setStatus({ active: true, createdAt: null }) }
    catch (failure) { setError(securityError(failure)) } finally { setBusy(false) }
  }
  async function change(event: FormEvent) {
    event.preventDefault(); setNotice('')
    const invalid = !current ? '請輸入目前密碼。' : passwordError(password, confirm)
    setError(invalid ?? '')
    if (invalid || !security || !account) return
    setBusy(true)
    try {
      await security.changePassword(account.username, current, password, token)
      setCurrent(''); setPassword(''); setConfirm(''); setNotice('密碼已更新。'); await refresh()
    } catch (failure) { setError(securityError(failure)) }
    finally { setBusy(false); setToken(''); setCaptchaKey(key => key + 1) }
  }
  return <section className="account-page"><span className="subject-label">LEARNFORGE · ACCOUNT</span><h1>帳號與安全</h1>
    <p>使用者名稱：<strong>{account?.username}</strong></p>
    {error && <p role="alert" className="notice warning">{error}</p>}{notice && <p role="status" className="notice">{notice}</p>}
    {code ? <RecoveryCode code={code} onSaved={() => setCode(null)} /> : <section className="account-section"><h2>帳號復原碼</h2>
      <p>{status ? status.active ? 'Recovery Code 已設定' : '尚未設定 Recovery Code' : '正在讀取復原碼狀態…'}</p>
      <p>單次使用的密碼復原方式；新碼會立即取代舊碼。</p>
      <button className="button secondary" disabled={busy || !security || !status} onClick={() => { void generate() }}>{!status ? '讀取中…' : status.active ? '更換復原碼' : '產生復原碼'}</button></section>}
    {!code && <><section className="account-section"><h2>修改密碼</h2><form onSubmit={event => { void change(event) }}>
      <label htmlFor="current-password">目前密碼</label><input id="current-password" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required />
      <label htmlFor="new-password">新密碼</label><input id="new-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required />
      <p className="field-note">至少 8 個字元，最多 72 UTF-8 bytes。</p>
      <label htmlFor="confirm-new-password">確認新密碼</label><input id="confirm-new-password" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
      <Turnstile key={captchaKey} action="login" onToken={setToken} />
      <button className="button primary" disabled={busy || !security || (!!turnstileSiteKey && !token)}>更新密碼</button>
    </form></section><section className="account-section"><h2>本機練習備份</h2><p>同步衝突的作答備份存放於此瀏覽器，與帳號復原碼不同。</p><Link to="/recovery">查看本機練習備份</Link></section>
    <section className="account-section"><h2>登入工作階段</h2><p>目前已登入。系統會向伺服器驗證工作階段；離線或驗證失敗時，請恢復連線後重新登入。本機作答仍會保留。</p>
      <button className="button secondary" disabled={busy} onClick={async () => { try { await service?.logout(); await refresh() } catch (failure) { setError(securityError(failure)) } }}>登出此瀏覽器</button></section></>}
  </section>
}
