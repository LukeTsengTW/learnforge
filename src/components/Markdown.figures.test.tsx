// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Markdown } from './Markdown'

afterEach(cleanup)

it('renders only an explicitly resolved quiz figure and preserves its alt', () => {
  render(<Markdown figures={{ 'figures/pe2-4.svg': '/learnforge/assets/pe2-4-abc123.svg' }}>
    {'![FIGURE PE2.4](figures/pe2-4.svg)'}
  </Markdown>)
  expect(screen.getByRole('img').getAttribute('src')).toBe('/learnforge/assets/pe2-4-abc123.svg')
  expect(screen.getByRole('img').getAttribute('alt')).toBe('FIGURE PE2.4')
})

it.each(['figures/missing.svg', '../other.svg', 'https://example.com/a.svg', 'data:image/svg+xml,hi'])(
  'shows a safe, explicit fallback without an image request for %s', (url) => {
    const { container } = render(<Markdown>{`![FIGURE PE2.4](${url})`}</Markdown>)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText(/圖片無法使用.*FIGURE PE2.4/)).toBeTruthy()
  })
