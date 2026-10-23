import { expect, it } from 'vitest'
import { parseQuiz } from '../../lib/quiz-parser'
import { createQuizCatalog } from './quiz-loader'
import { validateQuizFigures } from '../../lib/quiz-figures'

const source = '@quiz id="external" revision="1" subject="Test" tags="test" estimatedMinutes="1" current="true"\n# Test\n:::question id="q1" type="calculation" points="1"\n![FIGURE 1](figures/missing.svg)\n:::answer\n1\n:::solution\n1\n:::end'

it('rejects unsafe references through the production parser with the actual source line', () => {
  expect(() => parseQuiz(source.replace('figures/missing.svg', '../other.svg')))
    .toThrow(/第 4 行.*Invalid quiz figure/)
})

it('reports a missing figure with its bundled source filename', () => {
  expect(createQuizCatalog({ 'external/v1.quiz.md': source }).errors)
    .toEqual([{ file: 'external/v1.quiz.md', message: expect.stringContaining('Missing quiz figure at line 4') }])
})

it.each(['https://example.com/bad.svg', 'figures/missing2.svg'])(
  'validates repeated reference definitions within each rendered field: %s', url => {
    const first = source.replace('![FIGURE 1](figures/missing.svg)', '![FIGURE 1][fig]\n\n[fig]: figures/one.svg')
    const second = first.slice(first.indexOf(':::question')).replace('id="q1"', 'id="q2"')
      .replace('figures/one.svg', url)
    const raw = `${first}\n${second}`
    if (url.startsWith('https:')) expect(() => parseQuiz(raw)).toThrow(/Invalid quiz figure/)
    else {
      expect(() => validateQuizFigures(parseQuiz(raw), ['figures/one.svg'])).toThrow(/Missing quiz figure/)
      expect(() => parseQuiz(raw, true, ['figures/one.svg'])).toThrow(/Missing quiz figure/)
    }
  })
