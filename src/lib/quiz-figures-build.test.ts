import { expect, it } from 'vitest'
import { build } from 'vite'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

it('emits even a small SVG with a hash, unchanged bytes and the Pages base URL', async () => {
  const file = fileURLToPath(new URL('../test-fixtures/figures/figure.svg', import.meta.url))
  const result = await build({ configFile: false, logLevel: 'silent', base: '/learnforge/',
    plugins: [{ name: 'figure-build-fixture', resolveId: id => id === 'figure-entry' ? '\0figure-entry' : undefined,
      load: id => id === '\0figure-entry' ? `import url from ${JSON.stringify(`${file.replaceAll('\\', '/')}?url&no-inline`)}; console.log(url)` : undefined }],
    build: { write: false, rolldownOptions: { input: 'figure-entry' } } })
  const built = Array.isArray(result) ? result[0] : result
  if (!('output' in built)) throw new Error('Unexpected watcher')
  const output = built.output
  const svg = output.find(item => item.type === 'asset' && item.fileName.endsWith('.svg'))!
  expect(svg.fileName).toMatch(/^assets\/figure-[A-Za-z0-9_-]+\.svg$/)
  if (svg.type !== 'asset') throw new Error('Missing SVG asset')
  expect(svg.source.toString()).toBe(readFileSync(file, 'utf8'))
  expect(output.some(item => item.type === 'chunk' && item.code.includes(`/learnforge/${svg.fileName}`))).toBe(true)
})
