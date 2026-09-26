import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { buildLearningAnalytics } from '../features/analytics/learning-analytics'
import { ANALYTICS_SCAN_LIMIT, useLearningHistory } from '../features/analytics/use-learning-history'
import { quizCatalog } from '../features/quiz/quiz-loader'
import { formatAttemptDate } from '../features/quiz/practice-history'
import { QUESTION_LABEL } from '../models/quiz'

const percent = (value: number | null) => value === null ? '—' : `${Math.round(value * 100)}%`

export function AnalyticsPage() {
  const history = useLearningHistory()
  const analytics = useMemo(() => buildLearningAnalytics(history.records, history.isTruncated,
    (id) => quizCatalog.getCurrentQuiz(id)), [history.records, history.isTruncated])
  return <div className="analytics-page"><div className="breadcrumb"><Link to="/history">練習紀錄</Link><span aria-hidden="true">/</span><span>學習分析</span></div>
    <header className="page-heading"><span className="subject-label">Learning Analytics</span><h1>從練習紀錄，看見學習軌跡。</h1>
      <p>只分析已提交的練習。客觀題依當時題目版本與作答重新評分；計算、畫圖與 AI 參考分數不計入正確率。</p></header>
    {history.loading && <p role="status">正在整理學習紀錄… 已讀取 {history.scannedAttemptCount} 次練習</p>}
    {history.error && <div className="notice warning" role="alert">目前無法取得完整學習分析。請確認網路連線後重新整理。</div>}
    {!history.loading && !history.error && <>
      {analytics.isTruncated && <div className="notice warning" role="status">分析目前以最近 {ANALYTICS_SCAN_LIMIT} 次完成練習為範圍。</div>}
      {analytics.unavailableHistoryCount > 0 && <div className="notice warning" role="status">有 {analytics.unavailableHistoryCount} 筆舊版紀錄因題目版本不存在，未納入分析。</div>}
      {analytics.malformedAttemptCount > 0 && <div className="notice warning" role="status">有 {analytics.malformedAttemptCount} 筆紀錄格式異常，未納入分析。</div>}
      {analytics.completedAttempts === 0 ? <div className="empty-state"><h2>還沒有分析資料</h2><p>完成一次練習後，這裡會整理你的學習紀錄。</p><Link className="button primary" to="/library">瀏覽題庫</Link></div> : <>
        <section className="analytics-section" aria-labelledby="analytics-overview"><h2 id="analytics-overview">整體概況</h2>
          <dl className="analytics-metrics">
            <div><dt>完成練習</dt><dd>{analytics.completedAttempts} 次</dd></div>
            <div><dt>客觀題作答機會</dt><dd>{analytics.objectiveQuestions} 題次</dd></div>
            <div><dt>已作答客觀題</dt><dd>{analytics.answeredObjectiveQuestions} 題次</dd></div>
            <div><dt>答對</dt><dd>{analytics.correct}</dd></div><div><dt>答錯</dt><dd>{analytics.incorrect}</dd></div>
            <div><dt>未作答</dt><dd>{analytics.unanswered}</dd></div>
            <div><dt>已作答正確率</dt><dd>{percent(analytics.answeredAccuracy)}</dd></div>
            <div><dt>客觀題完成率</dt><dd>{percent(analytics.completionRate)}</dd></div>
            <div><dt>自動評分題得分</dt><dd>{analytics.objectivePointsEarned} / {analytics.objectivePointsAvailable}</dd></div>
          </dl><p className="analytics-note">正確率＝答對 ÷（答對＋答錯）；完成率＝已作答 ÷ 全部客觀題。另有 {analytics.manualQuestionSubmissions} 題次手動題提交，未列入上述分數。</p></section>
        <section className="analytics-section" aria-labelledby="analytics-subjects"><h2 id="analytics-subjects">科目</h2>
          {analytics.subjects.length ? <ul className="analytics-card-list">{analytics.subjects.map((subject) => <li key={subject.subject}>
            <h3>{subject.subject}</h3><p>{subject.attemptCount} 次練習 · 已作答 {subject.answeredCount} · 答對 {subject.correct} · 答錯 {subject.incorrect} · 未作答 {subject.unanswered}</p>
            <p>已作答正確率 {percent(subject.accuracy)} · 最近練習 {formatAttemptDate(subject.lastPracticedAt)}</p>
          </li>)}</ul> : <p className="muted">尚無可解析的科目資料。</p>}</section>
        <section className="analytics-section" aria-labelledby="analytics-topics"><h2 id="analytics-topics">主題標籤</h2>
          <p className="analytics-note">優先使用題目標籤；題目未設定時使用題庫標籤。多標籤題目會計入每個標籤。至少 3 次已作答才給表現提示。</p>
          {analytics.tags.length ? <ul className="analytics-card-list">{analytics.tags.map((tag) => <li key={tag.tag}>
            <h3>{tag.tag}</h3><p>樣本 {tag.sampleCount} 題次 · 已作答 {tag.answered} · 答對 {tag.correct} · 答錯 {tag.incorrect} · 未作答 {tag.unanswered}</p>
            <p>已作答正確率 {percent(tag.accuracy)} · {tag.signal} · 最近出現 {formatAttemptDate(tag.lastSeenAt)}</p>
          </li>)}</ul> : <p className="muted">尚無主題標籤資料。</p>}</section>
        <section className="analytics-section" aria-labelledby="analytics-types"><h2 id="analytics-types">題型</h2>
          <ul className="analytics-card-list">{analytics.questionTypes.map((type) => <li key={type.questionType}>
            <h3>{QUESTION_LABEL[type.questionType]}</h3><p>已作答 {type.answered} · 答對 {type.correct} · 答錯 {type.incorrect} · 未作答 {type.unanswered}</p>
            <p>已作答正確率 {percent(type.accuracy)}</p>
          </li>)}</ul></section>
        <section className="analytics-section" aria-labelledby="analytics-trend"><h2 id="analytics-trend">最近表現趨勢</h2>
          <p className="analytics-note">以最近一次可分析的作答為結尾，顯示 8 個 UTC 週（週一開始）；無已作答資料的週不計正確率。</p>
          {analytics.weeklyTrend.length ? <ol className="trend-list">{analytics.weeklyTrend.map((week) => <li key={week.weekStart}>
            <span>{week.weekStart} 起</span><span>已作答 {week.answered} · 答對 {week.correct}</span><strong>正確率 {percent(week.accuracy)}</strong>
          </li>)}</ol> : <p className="muted">尚無客觀題趨勢資料。</p>}</section>
        <section className="analytics-section analytics-review-summary" aria-labelledby="analytics-review"><h2 id="analytics-review">錯題複習</h2>
          <p>目前有 {analytics.reviewQueue.length} 題最新正式作答仍為答錯，可進行單題複習。</p>
          <Link className="button primary" to="/review">前往錯題複習</Link>
          <p className="analytics-note">單題複習不會改寫歷史；正式重新提交並答對後，題目才會從佇列移除。</p>
        </section>
      </>}
    </>}
  </div>
}
