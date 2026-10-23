import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMath from 'remark-math'
import type { Root, RootContent } from 'mdast'
import type { Quiz } from '../models/quiz'

export type QuizFigures = Readonly<Record<string, string>>
const figurePath = /^figures\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.(?:svg|png|jpe?g|webp)$/
export const isQuizFigurePath = (url: string): boolean => figurePath.test(url)

/** Match the renderer's CommonMark/math grammar, including reference-style images. */
export function quizFigureReferences(source: string): { url: string; line: number }[] {
  const root = unified().use(remarkParse).use(remarkMath).parse(source)
  const definitions = new Map<string, string>()
  const refs: { url: string; line: number }[] = []
  function visit(node: Root | RootContent, action: (node: Root | RootContent) => void) {
    action(node)
    if ('children' in node) for (const child of node.children) visit(child, action)
  }
  visit(root, node => {
    if (node.type === 'definition' && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url)
  })
  visit(root, node => {
    const url = node.type === 'image' ? node.url
      : node.type === 'imageReference' ? definitions.get(node.identifier) : undefined
    if (url !== undefined) refs.push({ url, line: node.position?.start.line ?? 1 })
  })
  return refs
}

/** Definitions are local to each Markdown renderer, never shared across DSL fields. */
export function quizMarkdownFields(quiz: Quiz): string[] {
  return [quiz.description, ...quiz.questions.flatMap(question => [question.prompt, question.hint ?? '',
    question.solution, ...question.rubric.map(item => item.description),
    ...('options' in question ? question.options.map(option => option.content)
      : 'referenceAnswer' in question ? [question.referenceAnswer]
        : typeof question.correctAnswer === 'string' ? [question.correctAnswer] : [])])]
}

export function validateQuizFigures(source: string | Quiz, available?: Iterable<string>): void {
  const files = available === undefined ? undefined : new Set(available)
  for (const field of typeof source === 'string' ? [source] : quizMarkdownFields(source)) {
    for (const { url, line } of quizFigureReferences(field)) {
      if (!isQuizFigurePath(url)) throw new Error(`Invalid quiz figure at line ${line}: ${url}`)
      if (files && !files.has(url)) throw new Error(`Missing quiz figure at line ${line}: ${url}`)
    }
  }
}
