import type { Quiz } from '../../models/quiz'
import { parseQuiz, QuizParseError } from '../../lib/quiz-parser'
import { gradeQuiz } from '../../lib/grading'

export type QuizLoadResult = { ok: true; quiz: Quiz } | { ok: false; error: string }
export interface QuizCatalogEntry { quiz: Quiz; questionCount: number; maxPoints: number }
export interface QuizCatalog {
  current: QuizCatalogEntry[]
  errors: { file: string; message: string }[]
  getCurrentQuiz(id: string): Quiz | null
  getQuizRevision(id: string, revision: string): Quiz | null
}
export function loadQuizSource(source: string): QuizLoadResult {
  try { return { ok: true, quiz: parseQuiz(source) } }
  catch (error) { return { ok: false, error: error instanceof QuizParseError ? error.message : '無法解析測驗內容。' } }
}

/** Only current revisions appear in the library; archived revisions remain addressable. */
export function createQuizCatalog(sources: Record<string, string>): QuizCatalog {
  const revisions = new Map<string, Map<string, Quiz>>()
  const current = new Map<string, Quiz>()
  const errors: QuizCatalog['errors'] = []
  for (const [file, source] of Object.entries(sources).sort(([a], [b]) => a.localeCompare(b))) {
    let quiz: Quiz
    try { quiz = parseQuiz(source, true) }
    catch (error) { errors.push({ file, message: error instanceof Error ? error.message : '未知解析錯誤' }); continue }
    const known = revisions.get(quiz.id) ?? new Map<string, Quiz>()
    if (known.has(quiz.revision)) throw new Error(`${file}: duplicate quiz id + revision ${quiz.id}/${quiz.revision}`)
    if (quiz.current && current.has(quiz.id)) throw new Error(`${file}: duplicate current quiz id ${quiz.id}`)
    known.set(quiz.revision, quiz)
    revisions.set(quiz.id, known)
    if (quiz.current) current.set(quiz.id, quiz)
  }
  for (const id of revisions.keys()) if (!current.has(id)) throw new Error(`quiz ${id}: current revision missing`)
  const entries = [...current.values()].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'))
    .map((quiz) => ({ quiz, questionCount: quiz.questions.length, maxPoints: gradeQuiz(quiz, {}).maxScore }))
  return { current: entries, errors,
    getCurrentQuiz: (id) => current.get(id) ?? null,
    getQuizRevision: (id, revision) => revisions.get(id)?.get(revision) ?? null }
}

const bundledSources = import.meta.glob<string>('../../content/quizzes/**/*.quiz.md', { query: '?raw', import: 'default', eager: true })
export const quizCatalog = createQuizCatalog(bundledSources)
const currentDemo = quizCatalog.getCurrentQuiz('demo')
export const demoQuiz: QuizLoadResult = currentDemo ? { ok: true, quiz: currentDemo } : { ok: false, error: '找不到 demo 題庫。' }
