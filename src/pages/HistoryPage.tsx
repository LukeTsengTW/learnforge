import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePracticeRepository } from '../features/quiz/practice-context'
import type { PracticeRecord } from '../features/quiz/practice-repository'
import { formatAttemptDate } from '../features/quiz/practice-history'

export function HistoryPage() {
  const repo = usePracticeRepository()
  const [records, setRecords] = useState<PracticeRecord[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    void repo.listSubmittedPage().then((page) => {
      if (active) { setRecords(page.records); setNextOffset(page.nextOffset); setLoading(false) }
    }).catch(() => { if (active) { setError(true); setLoading(false) } })
    return () => { active = false }
  }, [repo])
  async function loadMore() {
    if (nextOffset === null) return
    setLoading(true)
    try { const page = await repo.listSubmittedPage(nextOffset); setRecords((old) => [...old, ...page.records]); setNextOffset(page.nextOffset); setError(false) }
    catch { setError(true) } finally { setLoading(false) }
  }
  return <div className="history-page"><div className="breadcrumb"><Link to="/library">題庫</Link><span aria-hidden="true">/</span><span>練習紀錄</span></div>
    <header className="page-heading"><span className="subject-label">Practice History</span><h1>每一次練習，都值得留下。</h1>
      <p>提交後的作答永久保留。成績會依當時的題目版本重新檢查。</p></header>
    {error && <div className="notice warning" role="alert">暫時無法載入練習紀錄。請稍後重試。</div>}
    {!loading && !records.length && !error && <div className="empty-state"><h2>還沒有已提交的作答</h2><p>完成第一份練習後，就能在這裡回顧。</p><Link className="button primary" to="/library">瀏覽題庫</Link></div>}
    <div className="history-list">{records.map((record) => {
      const result = record.attempt?.status === 'submitted' ? record.attempt.result : null
      return <article className="history-card" key={record.id}>
        <div><span className="subject-label">{record.quiz?.subject ?? '題目版本無法載入'}</span><h2>{record.quiz?.title ?? record.row.quiz_id}</h2>
          <p>版本 {record.row.quiz_revision} · {formatAttemptDate(record.row.submitted_at)}</p></div>
        <div className="history-score"><strong>{result?.score ?? record.row.deterministic_score ?? '—'} / {result?.maxScore ?? record.row.deterministic_max_score ?? '—'}</strong>
          {result && <span>正確 {result.correctCount} · 錯誤 {result.incorrectCount} · 未作答 {result.unansweredCount}</span>}
          {!result && <span>題目版本無法載入；分數僅為儲存時的快取</span>}</div>
        <Link className="button secondary" to={`/result/${record.id}`}>查看結果</Link>
      </article>
    })}</div>
    {nextOffset !== null && <button className="button secondary load-more" disabled={loading} onClick={() => { void loadMore() }}>{loading ? '載入中…' : '載入更多'}</button>}
    {loading && records.length === 0 && <p role="status">正在載入練習紀錄…</p>}
  </div>
}
