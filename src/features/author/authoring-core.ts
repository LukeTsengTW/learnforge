import { gradeQuiz } from '../../lib/grading'
import { parseQuiz, QuizParseError } from '../../lib/quiz-parser'
import { hasScoredRubric } from '../../lib/scored-rubric'
import { QUESTION_TYPE, type QuestionType, type Quiz } from '../../models/quiz'

export const MAX_AUTHOR_SOURCE_BYTES = 1024 * 1024
export const AUTHOR_DRAFT_KEY = 'learnforge:author:draft:v1'
export const PARSE_DELAY_MS = 300

export class AuthoringError extends Error {}

export type AuthorParseState =
  | { status: 'idle' | 'pending' }
  | { status: 'valid'; quiz: Quiz }
  | { status: 'invalid'; error: QuizParseError }

export interface AuthoringDocument {
  source: string
  filename?: string
  originQuizId?: string
  cleanSource: string
  dirty: boolean
  version: number
  parseState: AuthorParseState
}

export function sourceBytes(source: string): number {
  return new TextEncoder().encode(source).length
}

function assertSourceSize(source: string) {
  if (sourceBytes(source) > MAX_AUTHOR_SOURCE_BYTES) throw new AuthoringError('題庫文字不可超過 1 MiB。')
}

export function createAuthoringDocument(source = '', filename?: string, originQuizId?: string,
  cleanSource = source): AuthoringDocument {
  assertSourceSize(source)
  return { source, filename, originQuizId, cleanSource, dirty: source !== cleanSource, version: 0,
    parseState: source ? { status: 'pending' } : { status: 'idle' } }
}

export function editAuthoringDocument(document: AuthoringDocument, source: string): AuthoringDocument {
  assertSourceSize(source)
  if (source === document.source) return document
  return { ...document, source, dirty: source !== document.cleanSource, version: document.version + 1,
    parseState: source ? { status: 'pending' } : { status: 'idle' } }
}

/** The version guard also protects state when an older scheduled parse finishes late. */
export function completeAuthoringParse(document: AuthoringDocument, version: number): AuthoringDocument {
  if (version !== document.version || !document.source) return document
  try {
    return { ...document, parseState: { status: 'valid', quiz: parseQuiz(document.source) } }
  } catch (error) {
    const parseError = error instanceof QuizParseError ? error : new QuizParseError('無法解析測驗內容。', 1)
    return { ...document, parseState: { status: 'invalid', error: parseError } }
  }
}

export function markExported(document: AuthoringDocument): AuthoringDocument {
  return { ...document, cleanSource: document.source, dirty: false }
}

export const NEW_QUIZ_TEMPLATE = `@quiz id="new-quiz" revision="v1" subject="一般" tags="example" estimatedMinutes="10" current="true"
# 新題庫

請描述這份題庫要練習的主題。

:::question id="q1" type="single" points="1"
### 範例單選題
請選出正確選項。
:::options
- [x] a | 正確選項
- [ ] b | 另一個選項
:::hint
這是可選的提示。
:::solution
請在此說明答案與原因。
:::end
`

export function nextQuestionId(source: string): string {
  const used = new Set([...source.matchAll(/^:::question[^\r\n]*\bid="([^"]+)"/gm)].map((match) => match[1]))
  let index = 1
  while (used.has(`q${index}`)) index++
  return `q${index}`
}

export function questionSnippet(type: QuestionType, id: string): string {
  const prompt = `:::question id="${id}" type="${type}" points="${type === 'calculation' || type === 'drawing' ? 2 : 1}"
### 新題目
請在此撰寫題目敘述。`
  const answer = {
    single: `:::options
- [x] a | 正確選項
- [ ] b | 其他選項`,
    multiple: `:::options
- [x] a | 正確選項一
- [x] b | 正確選項二
- [ ] c | 其他選項`,
    'true-false': `:::answer
true`,
    fill: `:::answer
答案`,
    calculation: `:::answer
請提供參考答案與推導。`,
    drawing: `:::drawing
width=800
height=600
:::answer
請描述參考圖形的關鍵元素。`,
  } satisfies Record<QuestionType, string>
  const match = type === 'fill' ? ' match="exact"' : ''
  const rubric = type === 'calculation' || type === 'drawing' ? `
:::rubric
- 1 | 第一個可觀察的評分條件。
- 1 | 第二個可觀察的評分條件。` : ''
  return `${prompt.replace(' points=', `${match} points=`)}
${answer[type]}
:::solution
請在此說明解題過程與判準。${rubric}
:::end`
}

export function insertQuestionSnippet(source: string, type: QuestionType): string {
  assertSourceSize(source)
  const snippet = questionSnippet(type, nextQuestionId(source))
  const next = `${source.trimEnd()}\n\n${snippet}\n`
  assertSourceSize(next)
  return next
}

export interface QuizMetadata {
  id: string; title: string; description: string; subject: string; tags: string[]
  revision: string; estimatedMinutes: number; current: boolean
  questionCount: number; questionTypes: Record<QuestionType, number>
  totalDeclaredPoints: number; deterministicMax: number; manualPoints: number
}

export function inspectQuiz(quiz: Quiz): QuizMetadata {
  const questionTypes = Object.fromEntries(Object.values(QUESTION_TYPE).map((type) => [type, 0])) as Record<QuestionType, number>
  for (const question of quiz.questions) questionTypes[question.type]++
  const totalDeclaredPoints = quiz.questions.reduce((sum, question) => sum + question.points, 0)
  const deterministicMax = gradeQuiz(quiz, {}).maxScore
  return { id: quiz.id, title: quiz.title, description: quiz.description, subject: quiz.subject,
    tags: quiz.tags, revision: quiz.revision, estimatedMinutes: quiz.estimatedMinutes, current: quiz.current,
    questionCount: quiz.questions.length, questionTypes,
    totalDeclaredPoints, deterministicMax, manualPoints: Number((totalDeclaredPoints - deterministicMax).toFixed(8)) }
}

export interface AiCapability { questionId: string; type: 'calculation' | 'drawing'; available: boolean; message: string }
export function inspectAiCapabilities(quiz: Quiz): AiCapability[] {
  return quiz.questions.flatMap((question) => {
    if (question.type !== 'calculation' && question.type !== 'drawing') return []
    const available = hasScoredRubric(question)
    const label = question.type === 'calculation' ? 'AI 參考評分' : 'AI 圖像參考分析'
    return [{ questionId: question.id, type: question.type, available,
      message: available ? `${label}可用` : `可正常作答，但不支援${label}（缺少 scored rubric）。` }]
  })
}

export function inspectQualityWarnings(quiz: Quiz): string[] {
  const warnings: string[] = []
  if (quiz.title.length > 90) warnings.push('題庫標題超過 90 字，請檢查顯示長度。')
  if (quiz.estimatedMinutes < 2 || quiz.estimatedMinutes > 180) warnings.push('預估時間可能過短或過長，請再檢查。')
  for (const question of quiz.questions) {
    if (!question.hint) warnings.push(`${question.id}：沒有提示。`)
    if (question.prompt.length > 4000) warnings.push(`${question.id}：題目敘述超過 4000 字。`)
    if (question.type === 'single' || question.type === 'multiple') {
      const visible = question.options.map((option) => option.content.trim().toLocaleLowerCase())
      if (new Set(visible).size !== visible.length) warnings.push(`${question.id}：選項顯示文字重複。`)
    }
  }
  return warnings
}

export interface BundledRevisionMetadata { id: string; revision: string; current: boolean; file: string }
export function bundledRevisionMetadata(sources: Record<string, string>): BundledRevisionMetadata[] {
  return Object.entries(sources).map(([file, source]) => {
    const quiz = parseQuiz(source, true)
    return { id: quiz.id, revision: quiz.revision, current: quiz.current, file }
  })
}

export interface ProposedRevisionValidation { valid: boolean; errors: string[]; proposed?: Quiz }
/** Simulates demoting the current bundled revision and adding the proposed source. No files are changed. */
export function validateProposedRevisionChange(existing: BundledRevisionMetadata[], newSource: string,
  expectedQuizId: string): ProposedRevisionValidation {
  const errors: string[] = []
  let proposed: Quiz | undefined
  try { proposed = parseQuiz(newSource, true) }
  catch (error) { errors.push(error instanceof Error ? error.message : '新 revision 無法解析。') }
  const identity = new Set<string>()
  const ids = new Set(existing.map((entry) => entry.id))
  for (const entry of existing) {
    const key = `${entry.id}/${entry.revision}`
    if (identity.has(key)) errors.push(`既有 catalog 有重複 revision：${key}。`)
    identity.add(key)
    if (!entry.file.replaceAll('\\', '/').includes(`/quizzes/${entry.id}/`)) errors.push(`既有 catalog 路徑與 id 不符：${entry.file}。`)
  }
  for (const id of ids) {
    if (existing.filter((entry) => entry.id === id && entry.current).length !== 1) errors.push(`既有 catalog 的 ${id} 必須恰有一個 current revision。`)
  }
  if (!ids.has(expectedQuizId)) errors.push('找不到同 id 的既有 bundled revision。')
  if (proposed) {
    if (proposed.id !== expectedQuizId) errors.push('新 revision 的 quiz id 不可與原題庫不同。')
    if (identity.has(`${proposed.id}/${proposed.revision}`)) errors.push('新 revision 與既有 revision 重複。')
    if (!proposed.current) errors.push('新 revision 必須設定 current="true"。')
    const simulated = existing.map((entry) => ({ ...entry, current: entry.id === expectedQuizId ? false : entry.current }))
    simulated.push({ id: proposed.id, revision: proposed.revision, current: proposed.current,
      file: `src/content/quizzes/${proposed.id}/proposed.quiz.md` })
    for (const id of new Set(simulated.map((entry) => entry.id))) {
      if (simulated.filter((entry) => entry.id === id && entry.current).length !== 1) errors.push(`模擬 catalog 的 ${id} 必須恰有一個 current revision。`)
    }
  }
  return { valid: errors.length === 0, errors, proposed }
}

export function createRevisedSource(source: string, revision: string, expectedQuizId: string,
  existing: BundledRevisionMetadata[]): { source: string; quiz: Quiz } {
  const base = parseQuiz(source, true)
  if (base.id !== expectedQuizId) throw new AuthoringError('目前 source 的 quiz id 與原題庫不同。')
  if (!revision.trim()) throw new AuthoringError('請輸入新 revision。')
  if (revision === base.revision) throw new AuthoringError('新 revision 必須不同於目前 revision。')
  const match = /^@quiz [^\r\n]*/m.exec(source)
  if (!match) throw new AuthoringError('找不到 quiz metadata。')
  const header = match[0].replace(/\brevision="[^"]*"/, `revision="${revision}"`)
    .replace(/\bcurrent="[^"]*"/, 'current="true"')
  const revised = source.slice(0, match.index) + header + source.slice(match.index + match[0].length)
  const validation = validateProposedRevisionChange(existing, revised, expectedQuizId)
  if (!validation.valid || !validation.proposed) throw new AuthoringError(validation.errors.join(' '))
  assertSourceSize(revised)
  return { source: revised, quiz: validation.proposed }
}

export function suggestQuizPath(quiz: Quiz, existingFiles: string[], newRevision: boolean): string {
  const files = existingFiles.map((file) => file.replaceAll('\\', '/'))
  let stem = quiz.revision
  const indexes = files.flatMap((file) => {
    const match = new RegExp(`/quizzes/${quiz.id}/v(\\d+)\\.quiz\\.md$`).exec(file)
    return match ? [Number(match[1])] : []
  })
  if (newRevision && indexes.length) stem = `v${Math.max(...indexes) + 1}`
  else if (!/^v\d+$/.test(stem)) stem = `${quiz.id}-${stem}`
  return `src/content/quizzes/${quiz.id}/${safeExportFilename(`${stem}.quiz.md`)}`
}

export function safeExportFilename(input: string): string {
  const basename = input.split(/[\\/]/).at(-1) ?? ''
  const safe = basename.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^\.+/, '').replace(/\.\.+/g, '.')
  const stem = safe.replace(/(\.quiz)?\.md$/i, '').replace(/\.+$/, '') || 'quiz'
  return `${stem}.quiz.md`
}

export function exportQuizSource(source: string, filename: string, browserDocument: Document,
  browserUrl: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>): string {
  assertSourceSize(source)
  const safeName = safeExportFilename(filename)
  const url = browserUrl.createObjectURL(new Blob([source], { type: 'text/markdown;charset=utf-8' }))
  const link = browserDocument.createElement('a')
  link.href = url
  link.download = safeName
  browserDocument.body.append(link)
  try { link.click() } finally { link.remove(); browserUrl.revokeObjectURL(url) }
  return safeName
}

export async function importQuizFile(file: File): Promise<{ source: string; filename: string }> {
  if (!/\.(quiz\.md|md|txt)$/i.test(file.name)) throw new AuthoringError('僅支援 .quiz.md、.md 或 .txt。')
  if (file.size > MAX_AUTHOR_SOURCE_BYTES) throw new AuthoringError('匯入檔案不可超過 1 MiB。')
  const source = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
  assertSourceSize(source)
  return { source, filename: file.name }
}

export async function copyMarkdown(source: string, clipboard: Pick<Clipboard, 'writeText'> | undefined,
  fallback: () => boolean): Promise<boolean> {
  try {
    if (clipboard) { await clipboard.writeText(source); return true }
  } catch { /* Try the selected textarea below. */ }
  try { return fallback() } catch { return false }
}

export interface AuthorDraft { source: string; filename?: string; originQuizId?: string }
export function saveAuthorDraft(storage: Storage, document: AuthoringDocument): void {
  assertSourceSize(document.source)
  storage.setItem(AUTHOR_DRAFT_KEY, JSON.stringify({ source: document.source, filename: document.filename,
    originQuizId: document.originQuizId } satisfies AuthorDraft))
}
export function readAuthorDraft(storage: Storage): AuthorDraft | null {
  const raw = storage.getItem(AUTHOR_DRAFT_KEY)
  if (!raw) return null
  try {
    const draft: unknown = JSON.parse(raw)
    if (!draft || typeof draft !== 'object' || !('source' in draft) || typeof draft.source !== 'string') return null
    assertSourceSize(draft.source)
    const filename = 'filename' in draft && typeof draft.filename === 'string' ? draft.filename : undefined
    const originQuizId = 'originQuizId' in draft && typeof draft.originQuizId === 'string' ? draft.originQuizId : undefined
    return { source: draft.source, filename, originQuizId }
  } catch { return null }
}
export function clearAuthorDraft(storage: Storage): void { storage.removeItem(AUTHOR_DRAFT_KEY) }
