// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { parseQuiz } from '../../lib/quiz-parser'
import { AuthorPreview } from './AuthorPreview'

afterEach(cleanup)

it('keeps an imported quiz usable when its local figure is unavailable', () => {
  const quiz = parseQuiz('@quiz id="external"\n# External\n:::question id="q1" type="calculation" points="1"\n![FIGURE 1](figures/missing.svg)\n:::answer\n1\n:::solution\n1\n:::rubric\n- 1 | 1\n:::end')
  const { container } = render(<AuthorPreview quiz={quiz} mode="answer" answers={{}} onAnswer={() => {}} />)
  expect(container.querySelector('img')).toBeNull()
  expect(screen.getByText('圖片無法使用：FIGURE 1')).toBeTruthy()
  expect(screen.getByText('External')).toBeTruthy()
  expect(screen.getByText('參考答案')).toBeTruthy()
})
