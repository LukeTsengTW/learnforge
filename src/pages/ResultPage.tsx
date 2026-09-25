import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAttempt } from '../features/quiz/attempt-context'
import { ResultQuestion } from '../features/quiz/ResultQuestion'

export function ResultPage() {
  const { quiz, attempt, restart } = useAttempt()
  const [confirmRestart, setConfirmRestart] = useState(false)
  const navigate = useNavigate()
  if (attempt.status !== 'submitted') return <div className="empty-state"><span className="empty-symbol" aria-hidden="true">✎</span>
    <h1>還沒有測驗結果</h1><p>完成並提交測驗後，就能在這裡查看答案與解析。</p>
    <Link to={`/quiz/${quiz.id}`} className="button primary">前往練習</Link></div>
  const { result } = attempt
  return <>
    <div className="breadcrumb"><Link to="/">練習首頁</Link><span aria-hidden="true">/</span><span>測驗結果</span></div>
    <header className="page-heading"><span className="subject-label">練習完成</span><h1>把答案，變成理解。</h1><p>{quiz.title}</p></header>
    <section className="result-summary" aria-labelledby="result-summary-heading" role="status">
      <div className="score-display"><h2 id="result-summary-heading">自動評分得分</h2><p><strong>{result.score}</strong><span>/ {result.maxScore}</span></p><span>共 {result.correctCount + result.incorrectCount + result.unansweredCount} 題自動評分</span></div>
      <dl className="result-counts"><div><dt>正確</dt><dd>{result.correctCount}</dd></div><div><dt>錯誤</dt><dd>{result.incorrectCount}</dd></div><div><dt>未作答</dt><dd>{result.unansweredCount}</dd></div></dl>
      <p className="score-note">計算題與畫圖題目前未納入自動評分。<br />以下 {result.manualCount} 題請搭配參考解答與評分規準，自行檢查。</p>
    </section>
    <div className="results-heading"><h2>作答回顧</h2><button className="text-button" type="button" onClick={() => setConfirmRestart(true)}>重新開始測驗</button></div>
    {confirmRestart && <div className="notice warning" role="alert"><strong>重新開始會清除本次答案與測驗結果。</strong>
      <div className="inline-actions"><button type="button" className="button primary" onClick={async () => { if (await restart()) navigate(`/quiz/${quiz.id}`) }}>確認重新開始</button>
        <button type="button" className="button secondary" onClick={() => setConfirmRestart(false)}>保留結果</button></div></div>}
    <div className="result-stack">{quiz.questions.map((question, index) => <ResultQuestion key={question.id} question={question}
      answer={attempt.answers[question.id]} grade={result.questions[index]} index={index} />)}</div>
    <div className="result-footer"><p>練習的價值，藏在每一個重新理解的瞬間。</p><Link className="button secondary" to="/">回到練習首頁</Link></div>
  </>
}
