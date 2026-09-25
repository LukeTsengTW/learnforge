import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAttempt } from '../features/quiz/attempt-context'
import { Brand } from './Brand'
import { useAuth } from '../features/auth/auth-context'
import { authError } from '../features/auth/auth-service'

export function Layout() {
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  const { attempt, storageNotice, loading: attemptLoading, syncing, retry, importLegacy } = useAttempt()
  const { account, loading, error, service, refresh } = useAuth()
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  useEffect(() => { window.scrollTo(0, 0); main.current?.focus({ preventScroll: true }) }, [pathname])
  return <>
    <a className="skip-link" href="#main-content" onClick={(event) => {
      event.preventDefault(); main.current?.focus()
    }}>跳至主要內容</a>
    <header className="site-header"><div className="header-inner">
      <Brand />
      <nav aria-label="主要導覽">
        <Link to="/" aria-current={pathname === '/' ? 'page' : undefined}>練習首頁</Link>
        {account && attempt.status === 'submitted' && <Link to="/result/demo" aria-current={pathname.startsWith('/result') ? 'page' : undefined}>測驗結果</Link>}
        {account ? <><span className="account-name" title={account.username}>{account.username}</span><button type="button" disabled={loggingOut} onClick={async () => {
          setLoggingOut(true); setLogoutError(null)
          try { await service?.logout(); await refresh() } catch (failure) { setLogoutError(authError(failure)) } finally { setLoggingOut(false) }
        }}>登出</button></> : !loading && <><Link to="/login">登入</Link><Link to="/register">註冊</Link></>}
        <span className="version-label">v0.2</span>
      </nav>
    </div></header>
    <main id="main-content" ref={main} tabIndex={-1} className="main-container">
      {(error || logoutError) && <div className="notice warning" role="alert">{logoutError ?? error}</div>}
      {storageNotice && <div className="notice warning" role="status">{storageNotice}</div>}
      {account && retry && <div className="sync-bar"><span role="status">{attemptLoading ? '正在載入雲端進度…' : syncing ? '正在同步…' : '本機即時暫存 · 雲端批次同步'}</span><button type="button" onClick={() => { void retry() }} disabled={attemptLoading || syncing}>重試同步</button></div>}
      {account && importLegacy && <details className="legacy-import"><summary>此裝置有 v0.1 未綁定帳號的進度</summary><p>請確認這是你的作答，再匯入目前帳號。舊版原始資料會保留。</p><button type="button" onClick={() => { void importLegacy() }}>匯入我的舊版進度</button></details>}
      {attemptLoading && /^\/(quiz|result)\//.test(pathname) ? <p role="status">正在恢復作答…</p> : <Outlet />}
    </main>
    <footer className="site-footer"><span>LearnForge</span><span>每一次練習，讓理解更扎實。</span></footer>
  </>
}
