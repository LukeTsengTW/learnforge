import { describe, expect, it } from 'vitest'
import demoSource from '../../content/quizzes/demo/v1.quiz.md?raw'
import booleanSource from '../../content/quizzes/boolean-algebra/v1.quiz.md?raw'
import relationsSource from '../../content/quizzes/relations/v1.quiz.md?raw'
import { parseQuiz } from '../../lib/quiz-parser'
import { createQuizCatalog, quizCatalog } from './quiz-loader'

const sources = { demo: demoSource, boolean: booleanSource, relations: relationsSource }
describe('bundled quiz catalog', () => {
  it('parses three usable quizzes with four objective types', () => {
    expect(quizCatalog.current).toHaveLength(3)
    for (const { quiz, maxPoints } of quizCatalog.current) {
      expect(quiz.questions.length).toBeGreaterThanOrEqual(7)
      expect(quiz.questions.map((question) => question.type)).toEqual(expect.arrayContaining(['single', 'multiple', 'true-false', 'fill']))
      expect(maxPoints).toBeGreaterThan(0)
    }
  })
  it('preserves the published demo revision', () => {
    expect(quizCatalog.getQuizRevision('demo', 'v1-7d7c900e')?.questions).toHaveLength(7)
  })
  it('normalizes quiz and question tags without affecting grading', () => {
    const quiz = parseQuiz(booleanSource.replace('tags="boolean-algebra,logic-gates"', 'tags="Boolean-Algebra, boolean-algebra,LOGIC-GATES"'))
    expect(quiz.tags).toEqual(['boolean-algebra', 'logic-gates'])
    expect(quiz.questions[0].tags).toEqual(['identity-laws'])
  })
  it('resolves an archived revision without duplicating the library card', () => {
    const archived = demoSource.replace('revision="v1-7d7c900e"', 'revision="archive"').replace('current="true"', 'current="false"')
    const catalog = createQuizCatalog({ ...sources, archived })
    expect(catalog.current).toHaveLength(3)
    expect(catalog.getQuizRevision('demo', 'archive')?.revision).toBe('archive')
    expect(catalog.getCurrentQuiz('demo')?.revision).toBe('v1-7d7c900e')
  })
  it('rejects duplicate id/revision and ambiguous current revisions', () => {
    expect(() => createQuizCatalog({ ...sources, duplicate: demoSource })).toThrow(/duplicate quiz id \+ revision/)
    const second = demoSource.replace('revision="v1-7d7c900e"', 'revision="2"')
    expect(() => createQuizCatalog({ ...sources, second })).toThrow(/duplicate current quiz id/)
  })
  it('rejects a missing current revision', () => {
    expect(() => createQuizCatalog({ archived: demoSource.replace('current="true"', 'current="false"') })).toThrow(/current revision missing/)
  })
  it.each(['revision', 'subject', 'tags', 'estimatedMinutes', 'current'])('reports missing %s metadata with filename', (key) => {
    const invalid = demoSource.replace(new RegExp(` ${key}="[^"]*"`), '')
    expect(createQuizCatalog({ ...sources, invalid }).errors).toEqual(expect.arrayContaining([expect.objectContaining({ file: 'invalid', message: expect.stringContaining('metadata') })]))
  })
  it('rejects invalid estimated minutes and malformed tags', () => {
    expect(createQuizCatalog({ invalid: demoSource.replace('estimatedMinutes="20"', 'estimatedMinutes="0"') }).errors[0].message).toContain('estimatedMinutes')
    expect(createQuizCatalog({ invalid: demoSource.replace('tags="logic-gates,algebra"', 'tags="logic-gates,,algebra"') }).errors[0].message).toContain('tags')
  })
  it('keeps valid quizzes available when one file fails parsing', () => {
    const catalog = createQuizCatalog({ ...sources, broken: '@quiz bad' })
    expect(catalog.current).toHaveLength(3)
    expect(catalog.errors[0].file).toBe('broken')
  })
  it('retains fingerprint revisions for legacy Quiz Markdown', () => {
    const legacy = demoSource.replace(/ revision="[^"]*"/, '')
    expect(parseQuiz(legacy).revision).toMatch(/^v1-/)
    expect(() => parseQuiz(legacy, true)).toThrow(/metadata/)
  })
})
