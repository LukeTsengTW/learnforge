import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildLearningAnalytics } from '../features/analytics/learning-analytics'
import { ANALYTICS_SCAN_LIMIT, useLearningHistory } from '../features/analytics/use-learning-history'
import { QuestionCard } from '../features/quiz/QuestionCard'
import { ResultQuestion } from '../features/quiz/ResultQuestion'
import { quizCatalog } from '../features/quiz/quiz-loader'
import { formatAttemptDate } from '../features/quiz/practice-history'
import { gradeQuiz, hasAnswer } from '../lib/grading'
import type { QuestionAnswer, QuestionGrade } from '../models/attempt'

export function ReviewPage() {
  const history = useLearningHistory()
  const analytics = useMemo(() => buildLearningAnalytics(history.records, history.isTruncated,
    (id) => quizCatalog.getCurrentQuiz(id)), [history.records, history.isTruncated])
  const queue = analytics.reviewQueue
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<QuestionAnswer | undefined>()
  const [grade, setGrade] = useState<QuestionGrade | null>(null)
  const [trial, setTrial] = useState(0)
  const [outcomes, setOutcomes] = useState<Record<string, 'correct' | 'incorrect'>>({})
  const item = queue[index]
  const correctThisSession = Object.values(outcomes).filter((status) => status === 'correct').length
  const stillNeedsReview = Object.values(outcomes).filter((status) => status === 'incorrect').length
  function resetAnswer() { setAnswer(undefined); setGrade(null); setTrial((value) => value + 1) }
  function checkAnswer() {
    if (!item || !hasAnswer(answer)) return
    const result = gradeQuiz({ ...item.quiz, questions: [item.question] }, { [item.questionId]: answer! }).questions[0]
    setGrade(result)
    setOutcomes((old) => ({ ...old, [item.key]: result.status === 'correct' ? 'correct' : 'incorrect' }))
  }
  return <div className="review-page"><div className="breadcrumb"><Link to="/mistakes">歷史錯題</Link><span aria-hidden="true">/</span><span>錯題複習</span></div>
    <header className="page-heading"><span className="subject-label">Focused Review</span><h1>一次複習一題。</h1>
      <p>佇列依同一題最新可解析的正式作答決定。這裡的答案只存在本次頁面，不會寫入練習紀錄或使用 AI 額度。</p></header>
    {history.loading && <p role="status">正在整理學習紀錄… 已讀取 {history.scannedAttemptCount} 次練習</p>}
    {history.error && <div className="notice warning" role="alert">目前無法取得完整學習分析，因此無法建立錯題複習佇列。請確認網路連線後重新整理。</div>}
    {!history.loading && !history.error && <>
      {analytics.isTruncated && <div className="notice warning" role="status">錯題佇列目前依最近 {ANALYTICS_SCAN_LIMIT} 次完成練習建立。</div>}
      {analytics.unavailableHistoryCount > 0 && <div className="notice warning" role="status">有 {analytics.unavailableHistoryCount} 筆舊版紀錄因題目版本不存在，未納入複習佇列。</div>}
      {analytics.malformedAttemptCount > 0 && <div className="notice warning" role="status">有 {analytics.malformedAttemptCount} 筆紀錄格式異常，未納入複習佇列。</div>}
      {!queue.length ? <div className="empty-state"><h2>目前沒有待複習的錯題</h2><p>正式練習中最新答錯的客觀題會出現在這裡。</p><Link className="button primary" to="/library">瀏覽題庫</Link></div>
        : index >= queue.length ? <div className="empty-state"><h2>本次複習已走完</h2><p>本次已答對 {correctThisSession} 題；本次仍需複習 {stillNeedsReview} 題。重新整理可再開始，正式練習紀錄不會改變。</p>
          <button className="button secondary" onClick={() => { setIndex(0); setOutcomes({}); resetAnswer() }}>再複習一次</button></div>
          : <section className="review-session" aria-label="單題錯題複習">
            <div className="review-progress"><strong>{index + 1} / {queue.length}</strong><span>本次已答對 {correctThisSession} · 本次仍需複習 {stillNeedsReview}</span></div>
            <div className="review-context"><span className="subject-label">{item.subject}</span><h2>{item.quizTitle}</h2>
              <p>題目版本 {item.quizRevision} · 最近答錯 {formatAttemptDate(item.latestIncorrectAt)} · 歷史答錯 {item.incorrectCount} 次</p>
              {item.tags.length > 0 && <ul className="tag-list">{item.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
              {item.currentRevision && item.quizRevision !== item.currentRevision && <div className="notice warning">
                <p>此錯題來自舊版題目 {item.quizRevision}，目前題庫版本為 {item.currentRevision}。</p>
                <div className="inline-actions"><button className="text-button" type="button" onClick={() => {
                  document.getElementById('review-question')?.focus()
                }}>練習當時版本</button><Link to={`/quiz/${item.quizId}`}>前往目前完整題庫</Link></div>
              </div>}
            </div>
            <div id="review-question" className="review-question" tabIndex={-1}>
              {grade ? <><div role="status" aria-live="polite" className={`review-feedback status-${grade.status}`}>{grade.status === 'correct' ? '答對' : '答錯，請查看正確答案與解題說明。'}</div>
                <ResultQuestion question={item.question} answer={answer} grade={grade} index={0} idPrefix="review-" /></>
                : <QuestionCard key={`${item.key}:${trial}`} question={item.question} index={0} answer={answer} onChange={setAnswer} />}
            </div>
            <div className="review-actions">
              {grade ? <button className="button secondary" onClick={resetAnswer}>再試一次</button>
                : <button className="button primary" disabled={!hasAnswer(answer)} onClick={checkAnswer}>檢查答案</button>}
              {grade && <button className="button primary" onClick={() => { setIndex((value) => value + 1); resetAnswer() }}>下一題</button>}
              <Link to={`/quiz/${item.quizId}`}>重新練習完整題庫</Link>
            </div>
            <p className="analytics-note">本次複習答對不會移除佇列項目。要永久移除，請在正式題庫重新提交並答對。</p>
          </section>}
    </>}
  </div>
}
