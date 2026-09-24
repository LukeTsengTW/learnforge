import { useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAttempt } from '../features/quiz/attempt-context'
import { Brand } from './Brand'

export function Layout() {
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  const { attempt, storageNotice } = useAttempt()
  useEffect(() => { window.scrollTo(0, 0); main.current?.focus({ preventScroll: true }) }, [pathname])
  return <>
    <a className="skip-link" href="#main-content" onClick={(event) => {
      event.preventDefault(); main.current?.focus()
    }}>跳至主要內容</a>
    <header className="site-header"><div className="header-inner">
      <Brand />
      <nav aria-label="主要導覽">
        <Link to="/" aria-current={pathname === '/' ? 'page' : undefined}>練習首頁</Link>
        {attempt.status === 'submitted' && <Link to="/result/demo" aria-current={pathname.startsWith('/result') ? 'page' : undefined}>測驗結果</Link>}
        <span className="version-label">v0.1</span>
      </nav>
    </div></header>
    <main id="main-content" ref={main} tabIndex={-1} className="main-container">
      {storageNotice && <div className="notice warning" role="status">{storageNotice}</div>}
      <Outlet />
    </main>
    <footer className="site-footer"><span>LearnForge</span><span>每一次練習，讓理解更扎實。</span></footer>
  </>
}
