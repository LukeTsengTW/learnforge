import { Link } from 'react-router-dom'
import { Markdown } from '../components/Markdown'
import { quizCatalog } from '../features/quiz/quiz-loader'
import { useDrafts } from '../features/quiz/use-drafts'

export function LibraryPage() {
  const drafts = useDrafts()
  const active = new Set(drafts.map((draft) => draft.quizId))
  return <div className="library-page">
    <div className="breadcrumb"><Link to="/">練習首頁</Link><span aria-hidden="true">/</span><span>題庫</span></div>
    <header className="page-heading"><span className="subject-label">Quiz Library</span><h1>選一份題目，開始思考。</h1>
      <p>每次提交都會保留紀錄；想再練習時，會建立新的草稿。</p></header>
    <div className="library-grid">{quizCatalog.current.map(({ quiz, questionCount, maxPoints }) => <article className="library-card" key={quiz.id}>
      <span className="subject-label">{quiz.subject}</span><h2>{quiz.title}</h2>
      <div className="library-description"><Markdown>{quiz.description}</Markdown></div>
      <ul className="tag-list" aria-label="題庫標籤">{quiz.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
      <div className="quiz-facts"><span>{questionCount} 題</span><span>{maxPoints} 分自動評分</span><span>約 {quiz.estimatedMinutes} 分鐘</span></div>
      <Link className="button primary" to={`/quiz/${quiz.id}`}>{active.has(quiz.id) ? '繼續作答' : '開始練習'}<span aria-hidden="true">↗</span></Link>
    </article>)}</div>
    {quizCatalog.errors.length > 0 && <div className="notice warning" role="status"><strong>部分題庫目前無法載入。</strong>
      {import.meta.env.DEV && <ul>{quizCatalog.errors.map(({ file, message }) => <li key={file}>{file}：{message}</li>)}</ul>}</div>}
  </div>
}
