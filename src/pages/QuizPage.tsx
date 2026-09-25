import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Markdown } from '../components/Markdown'
import { QuestionCard } from '../features/quiz/QuestionCard'
import { useAttempt } from '../features/quiz/attempt-context'
import { gradeQuiz, hasAnswer } from '../lib/grading'
import { quizCatalog } from '../features/quiz/quiz-loader'

export function QuizPage() {
  const { quiz, attempt, attemptId, answerQuestion, submit, restart, storageNotice, syncing, pendingSubmission, retry, importLegacy } = useAttempt()
  const [confirmIncomplete, setConfirmIncomplete] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const navigate = useNavigate()
  if (attempt.status === 'submitted') {
    if (pendingSubmission) return <div className="empty-state" role="status"><h1>正在完成舊版作答同步</h1>
      <p>此裝置保留了一份已提交的作答，正在將它寫入雲端。請保持連線。</p>
      {storageNotice && <p>{storageNotice}</p>}
      {retry && <button type="button" className="button secondary" disabled={syncing} onClick={() => { void retry() }}>重試同步</button>}</div>
    return <Navigate replace to={`/result/${attemptId ?? quiz.id}`} />
  }
  const answeredCount = quiz.questions.filter((question) => hasAnswer(attempt.answers[question.id])).length
  const unanswered = gradeQuiz(quiz, attempt.answers).unansweredCount
  async function submitQuiz() { const savedId = await submit(); if (savedId) navigate(`/result/${savedId}`) }
  function goToQuestion(id: string) {
    const heading = document.getElementById(`heading-${id}`)
    heading?.scrollIntoView({ block: 'start' })
    heading?.focus({ preventScroll: true })
    setConfirmIncomplete(false)
  }
  return <>
    <div className="breadcrumb"><Link to="/library">題庫</Link><span aria-hidden="true">/</span><span>正在練習</span></div>
    <header className="page-heading"><span className="subject-label">基礎練習</span><h1>{quiz.title}</h1><Markdown>{quiz.description}</Markdown></header>
    {quizCatalog.getCurrentQuiz(quiz.id)?.revision !== quiz.revision && <div className="notice warning" role="status">此未完成練習使用舊版題目（{quiz.revision}）。你可以繼續完成，或捨棄草稿並使用最新版重新開始。</div>}
    {storageNotice && <div className="notice warning" role="status">{storageNotice}</div>}
    {retry && <div className="sync-bar"><span role="status">{syncing ? '正在同步…' : '本機即時暫存 · 雲端批次同步'}</span><button type="button" disabled={syncing} onClick={() => { void retry() }}>重試同步</button></div>}
    {importLegacy && <details className="legacy-import"><summary>此裝置有 v0.1 未綁定帳號的進度</summary><p>請確認這是你的作答，再匯入目前帳號。舊版原始資料會保留。</p><button type="button" onClick={() => { void importLegacy() }}>匯入我的舊版進度</button></details>}
    {confirmRestart && <div className="notice warning" role="alert"><strong>重新開始會清除目前的所有答案與繪圖。</strong>
      <div className="inline-actions"><button type="button" className="button primary" onClick={async () => {
        if (await restart()) { setConfirmRestart(false); setConfirmIncomplete(false) }
      }}>確認重新開始</button><button type="button" onClick={() => setConfirmRestart(false)}>保留進度</button></div></div>}
    <div className="progress-strip"><label htmlFor="quiz-progress">作答進度 <strong>{answeredCount} / {quiz.questions.length}</strong></label>
      <progress id="quiz-progress" max={quiz.questions.length} value={answeredCount} /><span>{storageNotice ? '請留意上方儲存通知' : '在此裝置自動儲存'}</span></div>
    <div className="quiz-layout"><aside className="quiz-sidebar">
      <nav aria-label="題目導覽"><h2>題目一覽</h2><div className="question-nav">
        {quiz.questions.map((question, index) => <button type="button" key={question.id}
          className={hasAnswer(attempt.answers[question.id]) ? 'nav-answered' : ''}
          aria-label={`跳至第 ${index + 1} 題${hasAnswer(attempt.answers[question.id]) ? '，已作答' : '，未作答'}`}
          onClick={() => goToQuestion(question.id)}>{index + 1}{hasAnswer(attempt.answers[question.id]) && <span aria-hidden="true">✓</span>}</button>)}
      </div><p className="sidebar-note">✓ 已作答</p></nav>
      <div className="sidebar-tip"><h3>練習小提醒</h3><p>不確定時可以先跳過。提交前，記得回來檢查尚未作答的題目。</p></div>
      <button type="button" className="text-button restart-draft" onClick={() => { setConfirmRestart(true); window.scrollTo(0, 0) }}>{quizCatalog.getCurrentQuiz(quiz.id)?.revision !== quiz.revision ? '捨棄舊草稿並使用最新版重新開始' : '重新開始測驗'}</button>
    </aside>
    <form className="question-stack" onSubmit={(event) => { event.preventDefault(); if (unanswered) setConfirmIncomplete(true); else submitQuiz() }}>
      {quiz.questions.map((question, index) => <QuestionCard key={`${attempt.startedAt}-${question.id}`} question={question} index={index}
        answer={attempt.answers[question.id]} onChange={(answer) => { answerQuestion(question.id, answer); setConfirmIncomplete(false) }} />)}
      <section className="submit-panel"><div><h2>準備好對照答案了嗎？</h2><p>提交後會保留這次作答，並顯示完整解答。</p></div>
        <button className="button primary" type="submit">提交測驗</button>
        {confirmIncomplete && <div className="notice warning submit-warning" role="alert"><strong>還有 {unanswered} 題自動評分題未作答。</strong><p>未作答題會以 0 分計算，仍要提交嗎？</p>
          <div className="inline-actions"><button type="button" className="button primary" onClick={submitQuiz}>仍然提交</button>
            <button type="button" className="button secondary" onClick={() => {
              const missing = quiz.questions.find((question) => question.type !== 'calculation' && question.type !== 'drawing' && !hasAnswer(attempt.answers[question.id]))
              if (missing) goToQuestion(missing.id)
            }}>繼續作答</button></div>
        </div>}
      </section>
    </form></div>
  </>
}
