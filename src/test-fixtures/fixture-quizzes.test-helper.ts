import type * as QuizLoader from '../features/quiz/quiz-loader'
import type * as QuizContext from '../../supabase/functions/_shared/quiz-context.generated'
import { toTutorContext } from '../../scripts/ai-quiz-context'
import { parseQuiz } from '../lib/quiz-parser'

const fixtureSources = import.meta.glob<string>('./quizzes/**/*.quiz.md', { query: '?raw', import: 'default', eager: true })

/** Quizzes that are no longer published but remain rich test fixtures, keyed like bundled sources. */
export const fixtureQuizSources: Record<string, string> = Object.fromEntries(
  Object.entries(fixtureSources).map(([file, source]) => [file.replace('./quizzes/', '../../content/quizzes/'), source]))

/** For `vi.mock` of quiz-loader: the shipped catalog plus the fixture quizzes (demo, boolean-algebra, relations). */
export function withFixtureQuizzes(actual: typeof QuizLoader): typeof QuizLoader {
  const bundledQuizSources = { ...actual.bundledQuizSources, ...fixtureQuizSources }
  return { ...actual, bundledQuizSources, quizCatalog: actual.createQuizCatalog(bundledQuizSources) }
}

/** For `vi.mock` of quiz-context.generated: the generated contexts plus the same canonical contexts of the fixture quizzes. */
export function withFixtureContexts(actual: typeof QuizContext): typeof QuizContext {
  const fixtureContexts = Object.values(fixtureQuizSources).flatMap((source) => {
    const quiz = parseQuiz(source, true)
    return quiz.questions.map((question) => toTutorContext(quiz, question))
  })
  const identity = (context: Record<string, unknown>) => `${context.quizId}/${context.revision}/${context.questionId}`
  const AI_QUIZ_CONTEXT = ([...actual.AI_QUIZ_CONTEXT, ...fixtureContexts] as Record<string, unknown>[])
    .sort((a, b) => identity(a).localeCompare(identity(b))) as unknown as typeof actual.AI_QUIZ_CONTEXT
  return { ...actual, AI_QUIZ_CONTEXT }
}
