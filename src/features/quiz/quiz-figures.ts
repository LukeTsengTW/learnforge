import type { QuizFigures } from '../../lib/quiz-figures'

// no-inline ensures even small SVGs are emitted as hashed, base-aware assets.
export const bundledQuizFigures = import.meta.glob<string>('../../content/quizzes/*/figures/*.{svg,png,jpg,jpeg,webp}',
  { query: '?url&no-inline', import: 'default', eager: true })

const figuresByQuiz = new Map<string, QuizFigures>()
const emptyFigures: QuizFigures = Object.freeze({})
for (const [file, url] of Object.entries(bundledQuizFigures)) {
  const match = /^\.\.\/\.\.\/content\/quizzes\/([^/]+)\/(figures\/[^/]+)$/.exec(file)
  if (!match) continue
  figuresByQuiz.set(match[1], { ...figuresByQuiz.get(match[1]), [match[2]]: url })
}
export const figuresForQuiz = (id: string): QuizFigures => figuresByQuiz.get(id) ?? emptyFigures
