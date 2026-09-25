import { Link } from 'react-router-dom'
import { Brand } from './Brand'

export function QuizErrorPage({ detail }: { detail: string }) {
  return <main className="error-page"><Brand /><div className="empty-state" role="alert">
    <h1>題目格式錯誤，無法載入。</h1>
    <p>請檢查題庫檔案的格式後再試一次。</p>
    {import.meta.env.DEV && <pre>{detail}</pre>}
    <button className="button" onClick={() => window.location.reload()}>重新載入</button>
  </div></main>
}
export function NotFoundPage() {
  return <div className="empty-state"><h1>找不到這個練習</h1><p>請到題庫選擇目前可用的練習。</p>
    <Link className="button" to="/library">瀏覽題庫</Link></div>
}
