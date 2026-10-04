import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Markdown } from '../components/Markdown'
import { filterLibraryEntries, getLibraryFilterOptions, type LibraryFilters } from '../features/quiz/library-filters'
import { quizCatalog } from '../features/quiz/quiz-loader'
import { useDrafts } from '../features/quiz/use-drafts'
import { QUESTION_LABEL, QUESTION_TYPE, type QuestionType } from '../models/quiz'

const initialFilters: LibraryFilters = { search: '', tag: '', subject: '', questionType: '' }

export function LibraryPage() {
  const drafts = useDrafts()
  const active = new Set(drafts.map((draft) => draft.quizId))
  const [filters, setFilters] = useState(initialFilters)
  const searchInput = useRef<HTMLInputElement>(null)
  const options = getLibraryFilterOptions(quizCatalog.current)
  const entries = filterLibraryEntries(quizCatalog.current, filters)
  const hasActiveFilters = Boolean(filters.search.trim() || filters.tag || filters.subject || filters.questionType)
  function clearFilters() {
    setFilters(initialFilters)
    searchInput.current?.focus()
  }
  return <div className="library-page">
    <div className="breadcrumb"><Link to="/">練習首頁</Link><span aria-hidden="true">/</span><span>題庫</span></div>
    <header className="page-heading"><span className="subject-label">Quiz Library</span><h1>選一份題目，開始思考。</h1>
      <p>每次提交都會保留紀錄；想再練習時，會建立新的草稿。</p></header>
    <div className="library-filter-panel">
      <fieldset className="library-filter-group">
        <legend>篩選</legend>
        <div className="library-filter-options">
          <label className="library-filter-field" htmlFor="library-tag"><span>標籤</span>
            <select id="library-tag" value={filters.tag} onChange={(event) => setFilters({ ...filters, tag: event.target.value })}>
              <option value="">所有標籤</option>
              {options.tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </label>
          <label className="library-filter-field" htmlFor="library-subject"><span>科目</span>
            <select id="library-subject" value={filters.subject} onChange={(event) => setFilters({ ...filters, subject: event.target.value })}>
              <option value="">所有科目</option>
              {options.subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
          </label>
          <label className="library-filter-field" htmlFor="library-question-type"><span>題型</span>
            <select id="library-question-type" value={filters.questionType}
              onChange={(event) => setFilters({ ...filters, questionType: event.target.value as QuestionType | '' })}>
              <option value="">所有題型</option>
              {Object.values(QUESTION_TYPE).map((type) => <option key={type} value={type}>{QUESTION_LABEL[type]}</option>)}
            </select>
          </label>
        </div>
      </fieldset>
      <div className="library-search">
        <label htmlFor="library-search">搜尋</label>
        <div className="library-search-field">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" />
          </svg>
          <input id="library-search" ref={searchInput} type="search" value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            placeholder="搜尋題目、標籤或關鍵字" />
        </div>
      </div>
    </div>
    {entries.length > 0 ? <div className="library-grid">{entries.map(({ quiz, questionCount, maxPoints }) => <article className="library-card" key={quiz.id}>
      <span className="subject-label">{quiz.subject}</span><h2>{quiz.title}</h2>
      <div className="library-description"><Markdown>{quiz.description}</Markdown></div>
      <ul className="tag-list" aria-label="題庫標籤">{quiz.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
      <div className="quiz-facts"><span>{questionCount} 題</span><span>{maxPoints} 分自動評分</span><span>約 {quiz.estimatedMinutes} 分鐘</span></div>
      <Link className="button primary" to={`/quiz/${quiz.id}`}>{active.has(quiz.id) ? '繼續作答' : '開始練習'}<span aria-hidden="true">↗</span></Link>
    </article>)}</div> : <div className="empty-state" role="status">
      <h2>找不到符合條件的題庫。</h2><p>試試其他關鍵字或調整篩選條件。</p>
      {hasActiveFilters && <button type="button" className="button secondary" onClick={clearFilters}>清除篩選</button>}
    </div>}
    {quizCatalog.errors.length > 0 && <div className="notice warning" role="status"><strong>部分題庫目前無法載入。</strong>
      {import.meta.env.DEV && <ul>{quizCatalog.errors.map(({ file, message }) => <li key={file}>{file}：{message}</li>)}</ul>}</div>}
  </div>
}
