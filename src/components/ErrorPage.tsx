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
  return <div className="empty-state"><h1>找不到這個練習</h1><p>目前可練習「數位邏輯與基礎數學」。</p>
    <Link className="button" to="/">回到練習首頁</Link></div>
}
