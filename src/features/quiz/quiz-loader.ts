import demoSource from '../../content/demo.quiz.md?raw'
import type { Quiz } from '../../models/quiz'
import { parseQuiz, QuizParseError } from '../../lib/quiz-parser'

type QuizLoadResult = { ok: true; quiz: Quiz } | { ok: false; error: string }
export function loadQuizSource(source: string): QuizLoadResult {
  try { return { ok: true, quiz: parseQuiz(source) } }
  catch (error) { return { ok: false, error: error instanceof QuizParseError ? error.message : '無法解析測驗內容。' } }
}
export const demoQuiz = loadQuizSource(demoSource)
