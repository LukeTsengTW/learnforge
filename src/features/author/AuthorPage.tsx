import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import type { AnswerMap, QuestionAnswer } from '../../models/attempt'
import { QUESTION_LABEL, QUESTION_TYPE, type QuestionType } from '../../models/quiz'
import { bundledQuizSources } from '../quiz/quiz-loader'
import { AuthorPreview } from './AuthorPreview'
import {
  MAX_AUTHOR_SOURCE_BYTES, NEW_QUIZ_TEMPLATE, PARSE_DELAY_MS, bundledRevisionMetadata,
  clearAuthorDraft, completeAuthoringParse, copyMarkdown, createAuthoringDocument,
  createRevisedSource, editAuthoringDocument, exportQuizSource, importQuizFile,
  insertQuestionSnippet, inspectAiCapabilities, inspectQualityWarnings, inspectQuiz,
  markExported, readAuthorDraft, saveAuthorDraft, sourceBytes,
  suggestQuizPath, validateProposedRevisionChange, type AuthoringDocument,
} from './authoring-core'
import './author.css'

const bundled = Object.entries(bundledQuizSources).sort(([a], [b]) => a.localeCompare(b))
const revisions = bundledRevisionMetadata(bundledQuizSources)
const questionTypes = Object.values(QUESTION_TYPE)

function cursorPosition(source: string, index: number) {
  const before = source.slice(0, index)
  const line = before.split('\n').length
  return { line, column: index - before.lastIndexOf('\n') }
}

export function AuthorPage() {
  const [authorDocument, setAuthorDocument] = useState<AuthoringDocument>(() => createAuthoringDocument())
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [mode, setMode] = useState<'student' | 'answer'>('student')
  const [message, setMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState(bundled[0]?.[0] ?? '')
  const [snippetType, setSnippetType] = useState<QuestionType>('single')
  const [newRevision, setNewRevision] = useState('')
  const [suggestedPath, setSuggestedPath] = useState<string | null>(null)
  const [exportName, setExportName] = useState('')
  const [cursor, setCursor] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (authorDocument.parseState.status !== 'pending') return
    const version = authorDocument.version
    const timer = window.setTimeout(() => {
      setAuthorDocument((current) => completeAuthoringParse(current, version))
    }, PARSE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [authorDocument.version, authorDocument.source, authorDocument.parseState.status])

  const quiz = authorDocument.parseState.status === 'valid' ? authorDocument.parseState.quiz : null
  const metadata = useMemo(() => quiz ? inspectQuiz(quiz) : null, [quiz])
  const warnings = useMemo(() => quiz ? inspectQualityWarnings(quiz) : [], [quiz])
  const capabilities = useMemo(() => quiz ? inspectAiCapabilities(quiz) : [], [quiz])
  const proposal = useMemo(() => suggestedPath && quiz
    ? validateProposedRevisionChange(revisions, authorDocument.source, authorDocument.originQuizId ?? quiz.id)
    : null, [suggestedPath, quiz, authorDocument.source, authorDocument.originQuizId])
  const position = cursorPosition(authorDocument.source, cursor)

  function mayReplace(): boolean {
    return !authorDocument.dirty || window.confirm('目前有尚未匯出的修改。覆蓋後將失去這些修改，確定繼續嗎？')
  }
  function replace(document: AuthoringDocument, notice: string, path: string | null = null) {
    setAuthorDocument(document)
    setAnswers({})
    setMode('student')
    setSuggestedPath(path)
    setExportName(path?.split('/').at(-1) ?? document.filename ?? '')
    setCursor(0)
    setNewRevision('')
    setMessage(notice)
  }
  function edit(source: string) {
    if (sourceBytes(source) > MAX_AUTHOR_SOURCE_BYTES) {
      setMessage('題庫文字不可超過 1 MiB。')
      return
    }
    setAuthorDocument((current) => editAuthoringDocument(current, source))
    setAnswers({})
    setMessage('')
  }
  function jumpToLine(line: number) {
    const textarea = editorRef.current
    if (!textarea) return
    const lines = authorDocument.source.split('\n')
    const start = lines.slice(0, Math.max(0, line - 1)).reduce((sum, item) => sum + item.length + 1, 0)
    textarea.focus()
    textarea.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0))
    setCursor(start)
  }
  function onEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Tab' || event.shiftKey) return
    event.preventDefault()
    const field = event.currentTarget
    const start = field.selectionStart
    const end = field.selectionEnd
    edit(authorDocument.source.slice(0, start) + '  ' + authorDocument.source.slice(end))
    window.requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + 2, start + 2) })
  }
  async function onImport(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const files = input.files
    if (!files?.length) return
    if (files.length !== 1) { setMessage('一次只能匯入一個檔案。'); input.value = ''; return }
    if (!mayReplace()) { input.value = ''; return }
    try {
      const imported = await importQuizFile(files[0])
      replace(createAuthoringDocument(imported.source, imported.filename), `已匯入 ${imported.filename}；檔案只在瀏覽器內讀取。`)
    } catch (error) { setMessage(error instanceof Error ? error.message : '匯入失敗。') }
    input.value = ''
  }
  function onLoadBundled() {
    if (!mayReplace()) return
    const source = bundledQuizSources[selectedFile]
    const original = revisions.find((item) => item.file === selectedFile)
    if (!source || !original) { setMessage('找不到選取的 bundled revision。'); return }
    replace(createAuthoringDocument(source, selectedFile.split('/').at(-1), original.id),
      '已複製 bundled source 到編輯器；原始檔案未變更。')
  }
  function onLoadDraft() {
    if (!mayReplace()) return
    try {
      const draft = readAuthorDraft(localStorage)
      if (!draft) { setMessage('找不到可用的本機草稿。'); return }
      replace(createAuthoringDocument(draft.source, draft.filename, draft.originQuizId, ''),
        '已載入本機草稿；請匯出以保留版本。')
    } catch { setMessage('無法讀取本機草稿。') }
  }
  function onCreateRevision() {
    if (!quiz) { setMessage('請先修正解析錯誤，再建立新 revision。'); return }
    try {
      const expectedId = authorDocument.originQuizId ?? quiz.id
      const revised = createRevisedSource(authorDocument.source, newRevision, expectedId, revisions)
      const path = suggestQuizPath(revised.quiz, bundled.map(([file]) => file), true)
      replace(createAuthoringDocument(revised.source, path.split('/').at(-1), expectedId, authorDocument.source),
        '新 revision 已在編輯器建立，catalog 模擬通過。請匯出並依清單更新 Git source。', path)
    } catch (error) { setMessage(error instanceof Error ? error.message : '建立 revision 失敗。') }
  }
  function onExport() {
    if (!authorDocument.source) { setMessage('目前沒有可匯出的 Markdown。'); return }
    try {
      const fallback = quiz ? `${quiz.id}-${quiz.revision}.quiz.md` : 'quiz.quiz.md'
      const filename = exportQuizSource(authorDocument.source, exportName || fallback, document, URL)
      setAuthorDocument((current) => markExported(current))
      setMessage(`已下載 ${filename}；內容保留編輯器原文。`)
    } catch (error) { setMessage(error instanceof Error ? error.message : '下載失敗。') }
  }
  async function onCopy() {
    const ok = await copyMarkdown(authorDocument.source, navigator.clipboard, () => {
      const field = editorRef.current
      if (!field) return false
      const start = field.selectionStart, end = field.selectionEnd
      field.focus(); field.select()
      const copied = document.execCommand('copy')
      field.setSelectionRange(start, end)
      return copied
    })
    setMessage(ok ? 'Markdown 已複製。' : '複製失敗；請選取編輯器內容後手動複製。')
  }

  return <div className="author-page">
    <header className="author-heading">
      <div><span className="subject-label">Quiz Markdown · local workspace</span>
        <h1>題庫編寫工具</h1>
        <p>編輯原始 .quiz.md、檢查正式解析結果並預覽題目。內容只在此頁記憶體、本機草稿或下載檔案中。</p></div>
      <span className="author-local-badge">本機編寫 · 不會發布</span>
    </header>

    <section className="author-toolbar" aria-label="題庫來源與草稿">
      <div className="author-action-group">
        <button type="button" className="button primary" onClick={() => {
          if (mayReplace()) replace(createAuthoringDocument(NEW_QUIZ_TEMPLATE, undefined, 'new-quiz', ''),
            '已建立可解析的範例題庫。')
        }}>建立空白題庫</button>
        <label className="author-file-label" htmlFor="author-import">匯入 .quiz.md
          <input id="author-import" ref={fileRef} type="file" accept=".quiz.md,.md,.txt,text/plain,text/markdown"
            onChange={(event) => { void onImport(event) }} /></label>
      </div>
      <div className="author-action-group">
        <label htmlFor="author-bundled">Bundled revision</label>
        <select id="author-bundled" value={selectedFile} onChange={(event) => setSelectedFile(event.target.value)}>
          {bundled.map(([file]) => {
            const item = revisions.find((revision) => revision.file === file)
            return <option key={file} value={file}>{item?.id} · {item?.revision} {item?.current ? '· current' : ''}</option>
          })}
        </select>
        <button type="button" onClick={onLoadBundled}>載入 bundled source</button>
      </div>
      <div className="author-action-group">
        <button type="button" onClick={() => {
          try { saveAuthorDraft(localStorage, authorDocument); setMessage('草稿已儲存在此瀏覽器。') }
          catch { setMessage('本機草稿儲存失敗，請改用匯出。') }
        }} disabled={!authorDocument.source}>儲存本機草稿</button>
        <button type="button" onClick={onLoadDraft}>載入本機草稿</button>
        <button type="button" onClick={() => {
          try { clearAuthorDraft(localStorage); setMessage('本機草稿已清除。') }
          catch { setMessage('本機草稿清除失敗。') }
        }}>清除本機草稿</button>
      </div>
    </section>
    <p className="author-message" role="status" aria-live="polite">{message}</p>

    <div className="author-workspace">
      <div className="author-editor-column">
        <section className="author-panel author-editor-panel">
          <div className="author-panel-heading"><div><h2>Markdown source</h2><p>直接編輯 Quiz DSL；Tab 插入兩個空格。</p></div>
            <span className={authorDocument.dirty ? 'author-dirty' : 'author-clean'}>{authorDocument.dirty ? '未匯出修改' : '無未匯出修改'}</span></div>
          <label htmlFor="author-source" className="author-source-label">題庫 Markdown 編輯器</label>
          <textarea id="author-source" ref={editorRef} spellCheck={false} wrap="off"
            value={authorDocument.source} onChange={(event) => edit(event.target.value)}
            onKeyDown={onEditorKeyDown} onSelect={(event) => setCursor(event.currentTarget.selectionStart)}
            placeholder="選擇「建立空白題庫」、匯入檔案，或載入 bundled source。" />
          <div className="author-editor-status"><span>第 {position.line} 行，第 {position.column} 欄</span>
            <span>{sourceBytes(authorDocument.source).toLocaleString()} / {MAX_AUTHOR_SOURCE_BYTES.toLocaleString()} bytes</span></div>
          <div className="author-snippets"><label htmlFor="author-snippet">插入題型範本</label>
            <select id="author-snippet" value={snippetType} onChange={(event) => setSnippetType(event.target.value as QuestionType)}>
              {questionTypes.map((type) => <option key={type} value={type}>{QUESTION_LABEL[type]} · {type}</option>)}</select>
            <button type="button" disabled={!authorDocument.source} onClick={() => {
              try {
                const next = insertQuestionSnippet(authorDocument.source, snippetType)
                edit(next)
                setMessage(`已插入 ${snippetType} 題型；可直接修改 DSL。`)
              } catch (error) { setMessage(error instanceof Error ? error.message : '無法插入範本。') }
            }}>插入題型</button></div>
        </section>

        <section className="author-panel" aria-labelledby="author-validation-heading">
          <div className="author-panel-heading"><h2 id="author-validation-heading">Validation</h2>
            <strong aria-live="polite">{authorDocument.parseState.status === 'valid' ? 'Valid'
              : authorDocument.parseState.status === 'invalid' ? '1 個阻塞問題'
                : authorDocument.parseState.status === 'pending' ? '解析中…' : '等待 source'}</strong></div>
          {authorDocument.parseState.status === 'invalid' && <div className="notice warning" role="alert">
            <button type="button" className="author-error-jump" onClick={() => jumpToLine(authorDocument.parseState.status === 'invalid'
              ? authorDocument.parseState.error.line : 1)}>
              {authorDocument.parseState.error.message} · 跳至該行</button></div>}
          {authorDocument.parseState.status === 'valid' && <>
            <p>Parser 已建立 canonical Quiz。以下警告不影響解析。</p>
            <div className="author-warning-list"><h3>內容檢查 · {warnings.length} 個提醒</h3>
              {warnings.length ? <ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : <p>目前沒有內容提醒。</p>}</div>
            <div className="author-warning-list"><h3>AI capability</h3>
              {capabilities.length ? <ul>{capabilities.map((item) => <li key={item.questionId}>
                <strong>{item.questionId} · {item.type}</strong>：{item.message}</li>)}</ul> : <p>沒有手動評分題；客觀題不受影響。</p>}</div>
          </>}
          <p className="field-note">Parser 採 fail-fast；每次顯示第一個阻塞錯誤。此處不驗證學術內容正確性。</p>
        </section>

        <section className="author-panel">
          <h2>新 revision 與匯出</h2>
          <p className="author-revision-warning">已發布 revision 不應原地修改；請建立新 revision，以免歷史作答使用錯誤題目版本。</p>
          <div className="author-revision-form"><label htmlFor="author-revision">新 revision（手動指定）</label>
            <input id="author-revision" type="text" value={newRevision} onChange={(event) => setNewRevision(event.target.value)}
              placeholder="例如 v2；不自動產生 hash" />
            <button type="button" onClick={onCreateRevision} disabled={!quiz}>建立新 revision</button></div>
          {suggestedPath && <div className="author-publication-guide">
            <h3>Repository 路徑建議</h3><code>{suggestedPath}</code>
            <p className={proposal?.valid ? 'author-ok' : 'author-proposal-error'}>
              {proposal?.valid ? 'Catalog 模擬：通過；新 revision 唯一，模擬後恰有一個 current。'
                : `Catalog 模擬：${proposal?.errors.join(' ') || '等待解析。'}`}</p>
            <ol><li>將匯出檔案放入上方路徑。</li><li>將舊 revision 的 current 改為 false。</li>
              <li>確認新 revision 的 current=true。</li><li>執行 check:quizzes、test、build、check:ai-context，再透過 Git 提交。</li></ol>
            <p>本頁不修改 repository 或已發布 revision。</p>
          </div>}
          <div className="author-export">
            <label htmlFor="author-filename">下載檔名</label>
            <input id="author-filename" type="text" value={exportName}
              onChange={(event) => setExportName(event.target.value)}
              placeholder={quiz ? `${quiz.id}-${quiz.revision}.quiz.md` : 'quiz.quiz.md'} />
            <p className="field-note">輸出檔名會限制為安全字元並以 .quiz.md 結尾；檔案內容不會改寫。</p>
            <div className="inline-actions"><button type="button" className="button primary" onClick={onExport}
              disabled={!authorDocument.source}>下載 .quiz.md</button>
              <button type="button" onClick={() => { void onCopy() }} disabled={!authorDocument.source}>複製 Markdown</button></div>
          </div>
        </section>
      </div>

      <div className="author-preview-column">
        <section className="author-panel author-preview-panel" aria-labelledby="author-preview-heading">
          <div className="author-panel-heading"><div><h2 id="author-preview-heading">正式題目預覽</h2>
            <p>作答只存在頁面記憶體；不會建立練習或消耗 AI credits。</p></div></div>
          <div className="author-preview-actions" role="group" aria-label="預覽模式">
            <button type="button" aria-pressed={mode === 'student'} onClick={() => setMode('student')}>Student Preview</button>
            <button type="button" aria-pressed={mode === 'answer'} onClick={() => setMode('answer')}>Answer Preview</button>
            <button type="button" onClick={() => { setAnswers({}); setMessage('預覽作答已重設。') }}>重設預覽作答</button>
          </div>
          {quiz ? <AuthorPreview quiz={quiz} mode={mode} answers={answers}
            onAnswer={(id: string, answer: QuestionAnswer) => setAnswers((current) => ({ ...current, [id]: answer }))} />
            : <div className="empty-state"><p>{authorDocument.parseState.status === 'invalid'
              ? '修正解析錯誤後即可預覽。' : '建立或載入題庫後，這裡會顯示正式渲染。'}</p></div>}
        </section>
        {metadata && <section className="author-panel author-inspector">
          <h2>Metadata inspector</h2>
          <dl className="author-metadata">
            <div><dt>id</dt><dd>{metadata.id}</dd></div><div><dt>title</dt><dd>{metadata.title}</dd></div>
            <div><dt>description</dt><dd>{metadata.description || '—'}</dd></div>
            <div><dt>subject</dt><dd>{metadata.subject}</dd></div><div><dt>tags</dt><dd>{metadata.tags.join(', ') || '—'}</dd></div>
            <div><dt>revision</dt><dd>{metadata.revision}</dd></div>
            <div><dt>estimatedMinutes</dt><dd>{metadata.estimatedMinutes}</dd></div>
            <div><dt>current</dt><dd>{String(metadata.current)}</dd></div>
            <div><dt>question count</dt><dd>{metadata.questionCount}</dd></div>
            <div><dt>question types</dt><dd>{questionTypes.filter((type) => metadata.questionTypes[type] > 0)
              .map((type) => `${type}: ${metadata.questionTypes[type]}`).join(' · ')}</dd></div>
            <div><dt>total declared points</dt><dd>{metadata.totalDeclaredPoints}</dd></div>
            <div><dt>deterministic max</dt><dd>{metadata.deterministicMax}</dd></div>
            <div><dt>manual points</dt><dd>{metadata.manualPoints}</dd></div>
          </dl>
          <nav aria-label="題目導覽"><h3>題目清單</h3><div className="author-question-nav">
            {quiz?.questions.map((question, index) => <button type="button" key={question.id}
              onClick={() => document.getElementById(`author-question-${question.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Q{index + 1} · {question.type} · {question.id}</button>)}</div></nav>
        </section>}
      </div>
    </div>
    <p className="author-footer-note">題庫 source of truth 仍是 Git 中的 Quiz Markdown。匯出後請人工審閱、放入 repository，並執行驗證與提交。</p>
  </div>
}
