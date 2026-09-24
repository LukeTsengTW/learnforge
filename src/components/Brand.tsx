import { Link } from 'react-router-dom'

export function Brand() {
  return <Link className="brand" to="/" aria-label="LearnForge 首頁">
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="9" fill="currentColor" />
      <path d="M10 9v16h14M15 10h10M15 16h7" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
    <span>Learn<span className="brand-accent">Forge</span></span>
  </Link>
}
