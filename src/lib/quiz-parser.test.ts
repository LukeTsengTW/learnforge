import { describe, expect, it } from 'vitest'
import rawDemoSource from '../content/quizzes/demo/v1.quiz.md?raw'
import { parseQuiz, QuizParseError } from './quiz-parser'

const demoSource = rawDemoSource.replaceAll('\r\n', '\n')

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

describe('future calculation drawing DSL', () => {
  const source = [
    '@quiz id="synthetic" revision="m1" subject="algebra" tags="algebra" estimatedMinutes="5" current="true"',
    '# Synthetic calculation',
    ':::question id="calc" type="calculation" points="2"',
    'Solve $x+1=2$.',
    ':::answer', '$x=1$',
    ':::solution', 'Subtract one from both sides.',
    ':::rubric', '- 2 | Show a valid derivation.',
    ':::end',
  ].join('\n')
  const withDrawing = (config: string) => source.replace(':::end', ':::drawing\n' + config + '\n:::end')

  it('leaves legacy calculations without a config structurally unchanged', () => {
    expect(parseQuiz(source).questions[0]).toEqual({
      id: 'calc', type: 'calculation', tags: [], points: 2, prompt: 'Solve $x+1=2$.',
      hint: null, referenceAnswer: '$x=1$', solution: 'Subtract one from both sides.',
      rubric: [{ score: 2, description: 'Show a valid derivation.' }],
    })
    expect(parseQuiz(demoSource).questions[5]).not.toHaveProperty('drawing')
  })

  it('uses the existing drawing grammar for optional calculation capability', () => {
    expect(parseQuiz(withDrawing('width=1000\nheight=700')).questions[0]).toMatchObject({
      type: 'calculation', drawing: { width: 1000, height: 700 },
    })
  })

  it.each([
    '', 'width=800', 'height=600', 'width=99\nheight=600', 'width=2001\nheight=600',
    'width=800.5\nheight=600', 'width=800\nheight=no', 'width=800\nwidth=900\nheight=600',
    'width=800\nheight=600\nmodel=forged',
  ])('preserves line-aware errors for invalid calculation config %#', (config) => {
    try {
      parseQuiz(withDrawing(config))
      throw new Error('Expected parser rejection')
    } catch (error) {
      expect(error).toBeInstanceOf(QuizParseError)
      if (!(error instanceof QuizParseError)) throw error
      expect(error.questionId).toBe('calc')
      expect(error.line).toBeGreaterThan(0)
      expect(error.message).toContain('drawing')
    }
  })

  it('rejects duplicate drawing sections at the duplicate directive line', () => {
    const duplicate = withDrawing('width=800\nheight=600').replace(':::end', ':::drawing\nwidth=800\nheight=600\n:::end')
    const directives = duplicate.split('\n').flatMap((line, index) => line === ':::drawing' ? [index + 1] : [])
    try {
      parseQuiz(duplicate)
      throw new Error('Expected parser rejection')
    } catch (error) {
      expect(error).toBeInstanceOf(QuizParseError)
      if (!(error instanceof QuizParseError)) throw error
      expect(error.line).toBe(directives[1])
      expect(error.message).toContain('重複的 drawing')
    }
  })

  it.each(['single', 'multiple', 'true-false', 'fill'])('keeps drawing sections disallowed on %s', (type) => {
    const metadata = 'type="' + type + '"' + (type === 'fill' ? ' match="exact"' : '')
    let invalid = withDrawing('width=800\nheight=600').replace('type="calculation"', metadata)
    if (type === 'single' || type === 'multiple') {
      invalid = invalid.replace(':::answer\n$x=1$', ':::options\n- [x] a | 1\n- [ ] b | 2')
    } else if (type === 'true-false') invalid = invalid.replace(':::answer\n$x=1$', ':::answer\ntrue')
    expect(() => parseQuiz(invalid))
      .toThrow(new RegExp(type + ' 題型不接受 drawing'))
  })

  it('retains required drawing config for actual drawing questions', () => {
    expect(parseQuiz(withDrawing('width=800\nheight=600').replace('type="calculation"', 'type="drawing"')).questions[0])
      .toMatchObject({ type: 'drawing', drawing: { width: 800, height: 600 } })
    expect(() => parseQuiz(source.replace('type="calculation"', 'type="drawing"'))).toThrow(/drawing/)
  })

  it('retains historical parse dimensions separately from future publication bounds', () => {
    expect(parseQuiz(withDrawing('width=2000\nheight=2000')).questions[0]).toMatchObject({
      type: 'calculation', drawing: { width: 2000, height: 2000 },
    })
  })
})
