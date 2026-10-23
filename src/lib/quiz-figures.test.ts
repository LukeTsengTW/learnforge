import { expect, it } from 'vitest'
import { quizFigureReferences, validateQuizFigures } from './quiz-figures'

it('uses CommonMark images, including references, without treating math or code as images', () => {
  const source = '![FIGURE 1](figures/one.svg)\n![FIGURE 2][two]\n\n[two]: figures/two.png\n\n`![code](https://bad.test/x)`\n\n$![math](ignored)$'
  expect(quizFigureReferences(source).map(ref => ref.url)).toEqual(['figures/one.svg', 'figures/two.png'])
  expect(() => validateQuizFigures(source, ['figures/one.svg', 'figures/two.png'])).not.toThrow()
})

it.each(['../x.svg', 'figures/../x.svg', 'https://example.com/x.svg', '//example.com/x.svg',
  '/x.svg', 'data:image/png,a', 'blob:a', 'figures/%2e%2e/x.svg', 'figures/x.svg?x',
  'figures/x.svg#x', 'figures/x.html', 'figures/a/b.svg', 'figures/x\\y.svg'])('rejects unsafe figure path %s', url => {
  expect(() => validateQuizFigures(`![FIGURE 1](<${url}>)`, [url])).toThrow(/Invalid quiz figure/)
})

it('rejects a missing file and does not accept a same-named file from another quiz', () => {
  expect(() => validateQuizFigures('![FIGURE 1](figures/one.svg)', ['../other/figures/one.svg']))
    .toThrow(/Missing quiz figure/)
})
