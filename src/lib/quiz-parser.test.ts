import { describe, expect, it } from 'vitest'
import demoSource from '../content/demo.quiz.md?raw'
import { parseQuiz, QuizParseError } from './quiz-parser'

const validSingle = `@quiz id="test"
# A quiz
Description with $x^2$.
:::question id="one" type="single" points="2"
Which **option**?
:::options
- [x] a | Answer A
- [ ] b | Answer B
:::solution
Because A.
:::end`

describe('Quiz Markdown parser', () => {
  it('parses the complete demo into six discriminated types', () => {
    const quiz = parseQuiz(demoSource)
    expect(quiz.id).toBe('demo')
    expect(quiz.questions).toHaveLength(7)
    expect(new Set(quiz.questions.map((question) => question.type)).size).toBe(6)
    expect(quiz.questions[5].rubric.map((criterion) => criterion.score)).toEqual([2, 2, 2])
    expect(quiz.questions[6]).toMatchObject({ type: 'drawing', drawing: { width: 800, height: 600 } })
    expect(quiz.questions[1].prompt).toContain('$$')
  })
  it('rejects duplicate question ids with id and line information', () => {
    const source = validSingle + '\n' + validSingle.slice(validSingle.indexOf(':::question'))
    expect(() => parseQuiz(source)).toThrow(/第 12 行.*one.*重複/)
  })
  it.each([
    ['no correct choice', validSingle.replace('[x]', '[ ]')],
    ['two correct choices', validSingle.replace('[ ]', '[x]')],
    ['missing id', validSingle.replace('id="one" ', '')],
    ['unknown type', validSingle.replace('type="single"', 'type="alien"')],
    ['zero points', validSingle.replace('points="2"', 'points="0"')],
    ['negative points', validSingle.replace('points="2"', 'points="-1"')],
    ['infinite points', validSingle.replace('points="2"', 'points="Infinity"')],
    ['empty prompt', validSingle.replace('Which **option**?', '')],
    ['missing end', validSingle.replace(':::end', '')],
    ['unknown section', validSingle.replace(':::solution', ':::soluton')],
    ['missing solution', validSingle.replace('Because A.', '')],
    ['bad attributes', validSingle.replace('points="2"', 'points=2')],
    ['duplicate attributes', validSingle.replace('points="2"', 'points="2" points="2"')],
    ['duplicate option id', validSingle.replace('b |', 'a |')],
    ['unknown attribute', validSingle.replace('points="2"', 'points="2" mystery="x"')],
    ['unclosed code fence', validSingle.replace('Because A.', '```\nA')],
    ['single with answer section', validSingle.replace(':::solution', ':::answer\na\n:::solution')],
  ])('rejects malformed content: %s', (_label, source) => {
    expect(() => parseQuiz(source)).toThrow(QuizParseError)
  })
  it('rejects multiple choice without any correct answers', () => {
    expect(() => parseQuiz(validSingle.replace('single', 'multiple').replace('[x]', '[ ]'))).toThrow(/多選題至少/)
  })
  it('validates rubric totals and disallows partially scored criteria', () => {
    for (const rubric of ['- 1 | One point', '- 2 | Two points\n- | Unscored']) {
      expect(() => parseQuiz(validSingle.replace(':::end', `:::rubric\n${rubric}\n:::end`))).toThrow(/rubric/)
    }
  })
  it('accepts unscored and fully scored rubrics', () => {
    for (const rubric of ['- | A criterion', '- 0.5 | First\n- 1.5 | Second']) {
      expect(parseQuiz(validSingle.replace(':::end', `:::rubric\n${rubric}\n:::end`)).questions[0].rubric.length).toBeGreaterThan(0)
    }
  })
  it.each(['width=0', 'width=800.5', 'width=800\nwidth=900', 'width=800\nheight=no', 'size=800'])('rejects malformed drawing config: %s', (bad) => {
    expect(() => parseQuiz(demoSource.replace('width=800\nheight=600', bad))).toThrow(/drawing/)
  })
  it('does not interpret directives inside fenced Markdown', () => {
    const source = validSingle.replace('Which **option**?', '```text\n:::unknown\n:::end\n```\nWhich option?')
    expect(parseQuiz(source).questions[0].prompt).toContain(':::unknown')
  })
  it('preserves Markdown and multiline option math', () => {
    const source = validSingle.replace('Answer A', () => '**Answer A**\n  $$\n  x=2\n  $$')
    const question = parseQuiz(source).questions[0]
    expect(question.type === 'single' && question.options[0].content).toBe('**Answer A**\n$$\nx=2\n$$')
  })
  it('normalizes Windows line endings but invalidates changed quiz content', () => {
    expect(parseQuiz(validSingle.replaceAll('\n', '\r\n')).revision).toBe(parseQuiz(validSingle).revision)
    expect(parseQuiz(validSingle + '\n').revision).not.toBe(parseQuiz(validSingle).revision)
  })
  it('rejects unsupported fill strategies and multiline fill answers', () => {
    expect(() => parseQuiz(demoSource.replace('match="case-insensitive"', 'match="regex"'))).toThrow(/match/)
    expect(() => parseQuiz(demoSource.replace(':::answer\nXOR', ':::answer\nXOR\nAND'))).toThrow(/單行/)
  })
  it('preserves paragraph breaks in multiline options', () => {
    const question = parseQuiz(validSingle.replace('Answer A', 'First paragraph\n  \n  Second paragraph')).questions[0]
    expect(question.type === 'single' && question.options[0].content).toBe('First paragraph\n\nSecond paragraph')
  })
})
