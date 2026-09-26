import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { usePracticeRepository } from '../features/quiz/practice-context'
import { quizCatalog } from '../features/quiz/quiz-loader'
import { formatAttemptDate } from '../features/quiz/practice-history'
import type { PracticeRecord } from '../features/quiz/practice-repository'
import { ResultQuestion } from '../features/quiz/ResultQuestion'
import { AiQuotaStatus } from '../features/ai/AiTutorControls'
import { useAiTutor } from '../features/ai/use-ai-tutor'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function ResultPage() {
  const { attemptId = '' } = useParams()
  const repo = usePracticeRepository()
  const legacyQuiz = !UUID.test(attemptId) ? quizCatalog.getCurrentQuiz(attemptId) : null
  const [state, setState] = useState<{ key: string; record: PracticeRecord | null; error: boolean } | null>(null)
  const tutor = useAiTutor(UUID.test(attemptId) ? attemptId : undefined)
  useEffect(() => {
    let active = true
    const load = legacyQuiz ? repo.loadLatestSubmittedForQuiz(legacyQuiz.id) : repo.loadAttempt(attemptId)
    void load.then((record) => { if (active) setState({ key: attemptId, record, error: false }) })
      .catch(() => { if (active) setState({ key: attemptId, record: null, error: true }) })
    return () => { active = false }
  }, [repo, attemptId, legacyQuiz])
  if (!state || state.key !== attemptId) return <p role="status">正在載入作答紀錄…</p>
  if (legacyQuiz && state.record?.row.status === 'submitted') return <Navigate to={`/result/${state.record.id}`} replace />
  if (legacyQuiz && !state.record && !state.error) return <div className="empty-state"><h1>還沒有測驗結果</h1>
    <p>完成並提交測驗後，就能在這裡查看答案與解析。</p><Link to={`/quiz/${legacyQuiz.id}`} className="button primary">前往練習</Link></div>
  const record = state.record
  if (state.error || !record || record.row.status !== 'submitted') return <div className="empty-state" role="alert">
    <h1>找不到此作答紀錄，或你沒有權限查看。</h1><Link className="button secondary" to="/history">返回練習紀錄</Link></div>
  if (!record.quiz || record.attempt?.status !== 'submitted') return <div className="empty-state">
    <h1>題目版本無法載入</h1><p>{record.row.quiz_id} · 版本 {record.row.quiz_revision} · {formatAttemptDate(record.row.submitted_at)}</p>
    <p>儲存時的分數快取：{record.row.deterministic_score ?? '—'} / {record.row.deterministic_max_score ?? '—'}。目前無法安全重算或顯示解答。</p>
    <Link className="button secondary" to="/history">返回練習紀錄</Link></div>
  const { quiz, attempt } = record
  const { result } = attempt
  const current = quizCatalog.getCurrentQuiz(quiz.id)
  return <>
    <div className="breadcrumb"><Link to="/history">練習紀錄</Link><span aria-hidden="true">/</span><span>測驗結果</span></div>
    <header className="page-heading"><span className="subject-label">練習完成 · 版本 {quiz.revision}</span><h1>把答案，變成理解。</h1>
      <p>{quiz.title} · {formatAttemptDate(attempt.submittedAt)}</p></header>
    {current && current.revision !== quiz.revision && <div className="notice warning" role="status">此紀錄使用題目版本 {quiz.revision}；目前題庫版本為 {current.revision}。再次練習會使用最新版。</div>}
    <AiQuotaStatus tutor={tutor} />
    <section className="result-summary" aria-labelledby="result-summary-heading" role="status">
      <div className="score-display"><h2 id="result-summary-heading">自動評分得分</h2><p><strong>{result.score}</strong><span>/ {result.maxScore}</span></p><span>共 {result.correctCount + result.incorrectCount + result.unansweredCount} 題自動評分</span></div>
      <dl className="result-counts"><div><dt>正確</dt><dd>{result.correctCount}</dd></div><div><dt>錯誤</dt><dd>{result.incorrectCount}</dd></div><div><dt>未作答</dt><dd>{result.unansweredCount}</dd></div></dl>
      <p className="score-note">計算題與畫圖題未納入自動評分。<br />以下 {result.manualCount} 題可搭配參考解答與評分規準檢查；AI 參考評分與圖像分析另外顯示。</p>
    </section>
    <div className="results-heading"><h2>作答回顧</h2><Link className="button secondary" to={`/quiz/${quiz.id}`}>再次練習</Link></div>
    <div className="result-stack">{quiz.questions.map((question, index) => <ResultQuestion key={question.id} question={question}
      answer={attempt.answers[question.id]} grade={result.questions[index]} index={index} aiTutor={tutor} />)}</div>
    <div className="result-footer"><p>每一次作答都已保留在練習紀錄。</p><Link className="button secondary" to="/history">查看練習紀錄</Link></div>
  </>
}
