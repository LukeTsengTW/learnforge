import { describe, expect, it } from 'vitest'
import demoV1Source from '../../content/quizzes/demo/v1.quiz.md?raw'
import demoSource from '../../content/quizzes/demo/v2.quiz.md?raw'
import booleanSource from '../../content/quizzes/boolean-algebra/v1.quiz.md?raw'
import { parseQuiz } from '../../lib/quiz-parser'
import { bundledQuizSources, createQuizCatalog, quizCatalog } from './quiz-loader'

// Includes archived revisions as well as every current bundled quiz.
const sources = { ...bundledQuizSources }
describe('bundled quiz catalog', () => {
  it('parses four current quizzes in zh-Hant title order without catalog errors', () => {
    expect(quizCatalog.errors).toEqual([])
    expect(quizCatalog.current.map(({ quiz }) => quiz.id)).toEqual(['discrete-math', 'boolean-algebra', 'demo', 'relations'])
    for (const { quiz, maxPoints } of quizCatalog.current) {
      expect(quiz.questions.length).toBeGreaterThanOrEqual(7)
      expect(maxPoints).toBeGreaterThan(0)
    }
  })
  it.each(['boolean-algebra', 'demo', 'relations'])('preserves the four objective types in %s', (id) => {
    expect(quizCatalog.getCurrentQuiz(id)!.questions.map((question) => question.type))
      .toEqual(expect.arrayContaining(['single', 'multiple', 'true-false', 'fill']))
  })
  it('loads the approved midterm with declared total distinct from deterministic capacity', () => {
    const entry = quizCatalog.current.find(({ quiz }) => quiz.id === 'discrete-math')
    expect(entry).toMatchObject({ questionCount: 11, totalPoints: 100, maxPoints: 36,
      quiz: { id: 'discrete-math', revision: '2', current: true, title: '2025 Discrete Mathematics 期中考', subject: '離散數學', estimatedMinutes: 90 } })
    const quiz = quizCatalog.getCurrentQuiz('discrete-math')!
    expect(quizCatalog.getQuizRevision('discrete-math', '2')).toBe(quiz)
    expect(quizCatalog.current.filter(({ quiz }) => quiz.id === 'discrete-math')).toHaveLength(1)
    expect(quiz.questions.filter((question) => question.type === 'single')).toHaveLength(6)
    expect(quiz.questions.filter((question) => question.type === 'calculation')).toHaveLength(5)
    expect(quiz.questions.map((question) => question.id)).toEqual(['q1-i', 'q1-ii', 'q1-iii', 'q1-iv', 'q1-v', 'q1-vi', 'q2', 'q3', 'q4', 'q5', 'q6'])
    const q3 = quiz.questions.find((question) => question.id === 'q3')!
    for (const bound of ['x_1\\ge5', 'x_2\\ge5', 'x_3\\ge7', 'x_4\\ge7']) {
      expect(q3.prompt.replaceAll(/\s/g, '')).toContain(bound)
    }
    expect(q3).toMatchObject({ type: 'calculation', referenceAnswer: expect.stringContaining('=165') })
  })
  it('preserves the published demo revision', () => {
    expect(quizCatalog.getQuizRevision('demo', 'v1-7d7c900e')?.questions).toHaveLength(7)
  })
  it('archives discrete math revision 1 and preserves every question field in revision 2', () => {
    const v1 = quizCatalog.getQuizRevision('discrete-math', '1')!
    const v2 = quizCatalog.getCurrentQuiz('discrete-math')!
    expect(v1.current).toBe(false)
    expect(v2.revision).toBe('2')
    expect(v2.current).toBe(true)
    expect({ ...v2, revision: v1.revision, current: v1.current, questions: v1.questions }).toEqual(v1)
    expect(v2.questions.map(({ id }) => id)).toEqual(v1.questions.map(({ id }) => id))
    const calculations = v2.questions.filter((question) => question.type === 'calculation')
    expect(calculations.map(({ id }) => id)).toEqual(['q2', 'q3', 'q4', 'q5', 'q6'])
    for (const [index, question] of v2.questions.entries()) {
      expect(v1.questions[index]).not.toHaveProperty('drawing')
      expect(question).toEqual(question.type === 'calculation'
        ? { ...v1.questions[index], drawing: { width: 1200, height: 900 } }
        : v1.questions[index])
    }
  })
  it('publishes demo v2-handwriting as v1 content with handwriting added only to q6', () => {
    const v1 = quizCatalog.getQuizRevision('demo', 'v1-7d7c900e')!
    const v2 = quizCatalog.getCurrentQuiz('demo')!
    expect(v2.revision).toBe('v2-handwriting')
    expect(v1.current).toBe(false)
    expect(v2.questions.map((question) => question.id)).toEqual(v1.questions.map((question) => question.id))
    for (const [index, question] of v2.questions.entries()) {
      if (question.id === 'q6') expect(question).toEqual({ ...v1.questions[index], drawing: { width: 800, height: 600 } })
      else expect(question).toEqual(v1.questions[index])
    }
    expect(v1.questions.find((question) => question.id === 'q6')).not.toHaveProperty('drawing')
  })
  it('keeps calculation handwriting capability bound to the exact synthetic revision', () => {
    const original = demoV1Source.replaceAll('\r\n', '\n')
    const next = original.replace('revision="v1-7d7c900e"', 'revision="synthetic-m1"').replace('current="false"', 'current="true"')
      .replace(/(:::question id="q6"[\s\S]*?)(:::end)/, '$1:::drawing\nwidth=1000\nheight=700\n$2')
    const catalog = createQuizCatalog({ original, next })
    expect(catalog.errors).toEqual([])
    const oldQuestion = catalog.getQuizRevision('demo', 'v1-7d7c900e')!.questions.find((question) => question.type === 'calculation')!
    const nextQuestion = catalog.getQuizRevision('demo', 'synthetic-m1')!.questions.find((question) => question.type === 'calculation')!
    expect(oldQuestion).not.toHaveProperty('drawing')
    expect(nextQuestion.drawing).toEqual({ width: 1000, height: 700 })
    expect(catalog.getCurrentQuiz('demo')?.revision).toBe('synthetic-m1')
    expect(catalog.getQuizRevision('demo', 'missing-historical-revision')).toBeNull()
    expect(quizCatalog.getQuizRevision('demo', 'v1-7d7c900e')!.questions.find((question) => question.type === 'calculation'))
      .not.toHaveProperty('drawing')
  })

  it('normalizes quiz and question tags without affecting grading', () => {
    const quiz = parseQuiz(booleanSource.replace('tags="boolean-algebra,logic-gates"', 'tags="Boolean-Algebra, boolean-algebra,LOGIC-GATES"'))
    expect(quiz.tags).toEqual(['boolean-algebra', 'logic-gates'])
    expect(quiz.questions[0].tags).toEqual(['identity-laws'])
  })
  it('resolves an archived revision without duplicating the library card', () => {
    const archived = demoSource.replace('revision="v2-handwriting"', 'revision="archive"').replace('current="true"', 'current="false"')
    const catalog = createQuizCatalog({ ...sources, archived })
    expect(catalog.current).toHaveLength(4)
    expect(catalog.getQuizRevision('demo', 'archive')?.revision).toBe('archive')
    expect(catalog.getQuizRevision('demo', 'v1-7d7c900e')?.current).toBe(false)
    expect(catalog.getCurrentQuiz('demo')?.revision).toBe('v2-handwriting')
  })
  it('rejects duplicate id/revision and ambiguous current revisions', () => {
    expect(() => createQuizCatalog({ ...sources, duplicate: demoSource })).toThrow(/duplicate quiz id \+ revision/)
    const second = demoSource.replace('revision="v2-handwriting"', 'revision="2"')
    expect(() => createQuizCatalog({ ...sources, second })).toThrow(/duplicate current quiz id/)
  })
  it('rejects a missing current revision', () => {
    expect(() => createQuizCatalog({ archived: demoV1Source })).toThrow(/current revision missing/)
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
    expect(catalog.current).toHaveLength(4)
    expect(catalog.errors[0].file).toBe('broken')
  })
  it('retains fingerprint revisions for legacy Quiz Markdown', () => {
    const legacy = demoSource.replace(/ revision="[^"]*"/, '')
    expect(parseQuiz(legacy).revision).toMatch(/^v1-/)
    expect(() => parseQuiz(legacy, true)).toThrow(/metadata/)
  })
})
