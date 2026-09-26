import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePracticeRepository } from '../features/quiz/practice-context'
import type { PracticeRecord } from '../features/quiz/practice-repository'
import { deriveMistakes, formatAttemptDate } from '../features/quiz/practice-history'
import { ResultQuestion } from '../features/quiz/ResultQuestion'

export function MistakesPage() {
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
  const mistakes = deriveMistakes(records)
  return <div className="mistakes-page"><div className="breadcrumb"><Link to="/history">練習紀錄</Link><span aria-hidden="true">/</span><span>錯題</span></div>
    <header className="page-heading"><span className="subject-label">Mistakes</span><h1>把錯誤，變成下一次的理解。</h1>
      <p>只列出已提交作答中答錯的客觀題；未作答、計算題與畫圖題不算錯題。</p>
      <div className="inline-actions page-links"><Link to="/review">開始錯題複習</Link><Link to="/analytics">查看學習分析</Link></div></header>
    {error && <div className="notice warning" role="alert">暫時無法載入錯題。請稍後重試。</div>}
    {records.some((record) => !record.quiz) && <div className="notice warning" role="status">部分歷史題目版本無法載入，相關錯題無法安全推導；紀錄仍可在練習紀錄中查看。</div>}
    {!loading && !mistakes.length && !error && <div className="empty-state"><h2>目前沒有可顯示的錯題</h2><p>完成練習後，答錯的客觀題會出現在這裡。</p><Link className="button primary" to="/library">瀏覽題庫</Link></div>}
    <div className="mistake-list">{mistakes.map(({ record, question, answer, grade, index }) => <article key={`${record.id}:${question.id}`} className="mistake-entry">
      <div className="mistake-meta"><div><span className="subject-label">{record.quiz?.subject}</span><h2>{record.quiz?.title}</h2>
        <p>版本 {record.row.quiz_revision} · {formatAttemptDate(record.row.submitted_at)}</p></div>
        <div className="inline-actions"><Link to={`/result/${record.id}`}>查看完整作答</Link><Link to={`/quiz/${record.row.quiz_id}`}>重新練習此題庫</Link></div></div>
      <ResultQuestion question={question} answer={answer} grade={grade} index={index} idPrefix={`${record.id}-`} />
    </article>)}</div>
    {nextOffset !== null && <button className="button secondary load-more" disabled={loading} onClick={() => { void loadMore() }}>{loading ? '載入中…' : '載入更多'}</button>}
    {loading && records.length === 0 && <p role="status">正在載入錯題…</p>}
  </div>
}
