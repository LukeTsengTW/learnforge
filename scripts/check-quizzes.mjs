import { createServer } from 'vite'
import { readdir, readFile } from 'node:fs/promises'
import { resolve, relative, dirname, basename } from 'node:path'
import console from 'node:console'

const root = resolve(import.meta.dirname, '..')
const quizRoot = resolve(root, 'src/content/quizzes')

async function quizFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? quizFiles(path) : entry.name.endsWith('.quiz.md') ? [path] : []
  }))
  return nested.flat().sort()
}

const server = await createServer({ configFile: false, root, appType: 'custom', server: { middlewareMode: true, hmr: false } })
try {
  const { parseQuiz } = await server.ssrLoadModule('/src/lib/quiz-parser.ts')
  const { createQuizCatalog } = await server.ssrLoadModule('/src/features/quiz/quiz-loader.ts')
  const { validateV3Publication, validateV4Publication } = await server.ssrLoadModule('/src/lib/scored-rubric.ts')
  const { requiresV4Draft } = await server.ssrLoadModule('/src/lib/draft-v4.ts')
  const files = await quizFiles(quizRoot)
  if (!files.length) throw new Error('No bundled Quiz Markdown files found.')
  const sources = {}
  let questionCount = 0
  for (const file of files) {
    const name = relative(root, file).replaceAll('\\', '/')
    const source = await readFile(file, 'utf8')
    const quiz = parseQuiz(source, true)
    if (basename(dirname(file)) !== quiz.id) throw new Error(`${name}: folder must match quiz id ${quiz.id}`)
    sources[name] = source
    questionCount += quiz.questions.length
  }
  const catalog = createQuizCatalog(sources)
  if (catalog.errors.length) throw new Error(catalog.errors.map((error) => `${error.file}: ${error.message}`).join('\n'))
  // A current revision that declares handwriting is published under the v4 contract; all others stay v3.
  const v4Current = catalog.current.filter(({ quiz }) => requiresV4Draft(quiz))
  const publicationErrors = catalog.current.flatMap(({ quiz }) =>
    (requiresV4Draft(quiz) ? validateV4Publication(quiz) : validateV3Publication(quiz)).map((error) => `${quiz.id}/${quiz.revision} ${error}`))
  if (publicationErrors.length) throw new Error(`Current quizzes are not valid for publication:\n${publicationErrors.join('\n')}`)
  console.log(`Validated ${files.length} bundled revisions, ${catalog.current.length} current quizzes `
    + `(${v4Current.length} v4: ${v4Current.map(({ quiz }) => `${quiz.id}/${quiz.revision}`).join(', ') || 'none'}), ${questionCount} questions.`)
} finally {
  await server.close()
}
