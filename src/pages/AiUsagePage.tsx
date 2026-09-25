import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTutorService } from '../features/ai/tutor-context'
import type { AiQuota, UsageCursor, UsageItem, UsagePage } from '../features/ai/tutor-service'
import { quizCatalog } from '../features/quiz/quiz-loader'

const FEATURE = { hint: 'AI 提示', explain_mistake: 'AI 錯誤解釋', explain_solution: 'AI 解答解釋' }
const STATUS = { reserved: '處理中', completed: '完成', refunded: '已退款', expired: '已過期' }

function itemTitle(item: UsageItem) {
  const quiz = item.quizId && item.quizRevision ? quizCatalog.getQuizRevision(item.quizId, item.quizRevision) : null
  const index = quiz?.questions.findIndex((question) => question.id === item.questionId) ?? -1
  return { quiz: quiz?.title ?? item.quizId ?? '題庫無法載入',
    question: index >= 0 ? `Q${index + 1}` : item.questionId }
}

export function AiUsagePage() {
  const service = useTutorService()
  const [quota, setQuota] = useState<AiQuota | null>(null)
  const [page, setPage] = useState<UsagePage | null>(null)
  const [items, setItems] = useState<UsageItem[]>([])
  const [nextCursor, setNextCursor] = useState<UsageCursor | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!service) return
    let active = true
    void Promise.all([service.getQuota(), service.getUsage()]).then(([status, first]) => {
      if (active) { setQuota(status); setPage(first); setItems(first.items); setNextCursor(first.nextCursor); setError(false); setLoading(false) }
    }).catch(() => { if (active) { setError(true); setLoading(false) } })
    return () => { active = false }
  }, [service])

  async function loadMore() {
    if (!service || !nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const next = await service.getUsage(nextCursor)
      setItems((old) => [...old, ...next.items])
      setNextCursor(next.nextCursor)
      setError(false)
    } catch { setError(true) } finally { setLoadingMore(false) }
  }

  return <div className="ai-usage-page">
    <div className="breadcrumb"><Link to="/library">題庫</Link><span aria-hidden="true">/</span><span>AI 使用紀錄</span></div>
    <header className="page-heading"><span className="subject-label">AI Tutor</span><h1>AI 使用紀錄</h1>
      <p>查看最近的 AI 建議與 5 小時滾動額度。</p></header>
    {loading && <p role="status">正在載入 AI 使用紀錄…</p>}
    {!service && <p role="alert">AI Tutor 目前無法使用。</p>}
    {error && <div className="notice warning" role="alert">AI 使用紀錄暫時無法載入。<button type="button"
      className="text-button" onClick={() => { window.location.reload() }}>重新載入</button></div>}
    {quota && page && <section className="ai-usage-summary" aria-labelledby="ai-usage-summary-heading">
      <h2 id="ai-usage-summary-heading">目前額度</h2>
      <p><strong>{quota.remaining} / {quota.limit}</strong> credits 剩餘 · 已用 {quota.used} · 5 小時滾動</p>
      <p>最近 5 小時：AI 提示 {page.summary.last5Hours.hintCount} 次 · 錯誤解釋 {page.summary.last5Hours.mistakeCount} 次 · 解答解釋 {page.summary.last5Hours.solutionCount} 次</p>
    </section>}
    {page && <section aria-labelledby="ai-usage-list-heading"><h2 id="ai-usage-list-heading">最近紀錄</h2>
      {items.length === 0 && <p>目前還沒有 AI 使用紀錄。</p>}
      <ol className="ai-usage-list">{items.map((item, index) => {
        const title = itemTitle(item)
        return <li key={`${item.createdAt}-${item.questionId}-${index}`}><article className="ai-usage-item">
          <div><h3>{title.quiz}</h3><p>{title.question} · {FEATURE[item.feature]}</p></div>
          <div><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('zh-TW')}</time>
            <p>{item.credits} {item.credits === 1 ? 'credit' : 'credits'} · {STATUS[item.status]}</p></div>
        </article></li>
      })}</ol>
      {nextCursor && <button type="button" className="button secondary load-more" disabled={loadingMore}
        onClick={() => { void loadMore() }}>{loadingMore ? '載入中…' : '載入更多'}</button>}
    </section>}
  </div>
}
