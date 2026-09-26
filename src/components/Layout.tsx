import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Brand } from './Brand'
import { useAuth } from '../features/auth/auth-context'
import { authError } from '../features/auth/auth-service'

export function Layout() {
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
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
        <Link to="/library" aria-current={pathname === '/library' ? 'page' : undefined}>題庫</Link>
        <Link to="/author" aria-current={pathname === '/author' ? 'page' : undefined}>題庫編寫</Link>
        {account && <><Link to="/history" aria-current={pathname === '/history' ? 'page' : undefined}>練習紀錄</Link>
          <Link to="/mistakes" aria-current={pathname === '/mistakes' ? 'page' : undefined}>錯題</Link>
          <details className="nav-learning"><summary>更多學習</summary><div className="nav-learning-menu">
          <Link to="/analytics" aria-current={pathname === '/analytics' ? 'page' : undefined}>學習分析</Link>
          <Link to="/review" aria-current={pathname === '/review' ? 'page' : undefined}>錯題複習</Link>
          <Link to="/ai-usage" aria-current={pathname === '/ai-usage' ? 'page' : undefined}>AI 使用紀錄</Link>
        </div></details></>}
        {account ? <><span className="account-name" title={account.username}>{account.username}</span><button type="button" disabled={loggingOut} onClick={async () => {
          setLoggingOut(true); setLogoutError(null)
          try { await service?.logout(); await refresh() } catch (failure) { setLogoutError(authError(failure)) } finally { setLoggingOut(false) }
        }}>登出</button></> : !loading && <><Link to="/login">登入</Link><Link to="/register">註冊</Link></>}
        <span className="version-label">v0.9</span>
      </nav>
    </div></header>
    <main id="main-content" ref={main} tabIndex={-1} className={pathname === '/author' ? 'main-container author-main' : 'main-container'}>
      {(error || logoutError) && <div className="notice warning" role="alert">{logoutError ?? error}</div>}
      <Outlet />
    </main>
    <footer className="site-footer"><span>LearnForge</span><span>每一次練習，讓理解更扎實。</span></footer>
  </>
}
