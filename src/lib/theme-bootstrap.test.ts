import { existsSync, readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const script = readFileSync(new URL('../../public/assets/theme-init.js', import.meta.url), 'utf8')
function bootstrap(stored: string | null, dark: boolean, blocked = false) {
  const document = { documentElement: { dataset: {} as Record<string, string> } }
  const window = {
    localStorage: {
      getItem: (key: string) => {
        if (blocked) throw new Error('Storage blocked')
        return key === 'learnforge:theme' ? stored : null
      },
      setItem: () => { throw new Error('Bootstrap must not store an implicit preference') },
    },
    matchMedia: () => ({ matches: dark }),
  }
  runInNewContext(script, { document, window })
  return document.documentElement.dataset.theme
}

describe('pre-paint theme bootstrap', () => {
  it('loads a classic head script from the Pages assets namespace before the application', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    const bootstrapScript = /<script\b(?=[^>]*\bsrc\s*=\s*["']\/assets\/theme-init\.js["'])[^>]*>/i.exec(html)
    const applicationScript = /<script\b(?=[^>]*\btype\s*=\s*["']module["'])[^>]*>/i.exec(html)
    expect(bootstrapScript).not.toBeNull()
    expect(applicationScript).not.toBeNull()
    if (!bootstrapScript || !applicationScript) throw new Error('Bootstrap and application scripts are required')
    const headStart = /<head\b[^>]*>/i.exec(html)
    const headEnd = /<\/head\s*>/i.exec(html)
    expect(headStart).not.toBeNull()
    expect(headEnd).not.toBeNull()
    expect(bootstrapScript.index).toBeGreaterThan(headStart?.index ?? html.length)
    expect(bootstrapScript.index).toBeLessThan(headEnd?.index ?? 0)
    expect(bootstrapScript[0]).not.toMatch(/\s(?:async|defer)(?=\s|=|>)/i)
    expect(bootstrapScript[0]).not.toMatch(/\btype\s*=\s*["']module["']/i)
    expect(bootstrapScript.index).toBeLessThan(applicationScript.index)
    expect(html).not.toMatch(/<script\b[^>]*\bsrc\s*=\s*["']\/theme-init\.js["']/i)
    expect(existsSync(new URL('../../public/assets/theme-init.js', import.meta.url))).toBe(true)
    expect(existsSync(new URL('../../public/theme-init.js', import.meta.url))).toBe(false)
  })

  it.each(['light', 'dark'])('applies saved %s before the application loads', theme => {
    expect(bootstrap(theme, theme === 'light')).toBe(theme)
  })
  it.each([false, true])('initializes from the system (dark: %s) without writing a choice', dark => {
    expect(bootstrap(null, dark)).toBe(dark ? 'dark' : 'light')
  })
  it('falls back to the system for invalid preference data', () => {
    expect(bootstrap('invalid', true)).toBe('dark')
  })
  it('still sets a theme when access to localStorage throws', () => {
    expect(bootstrap(null, true, true)).toBe('dark')
  })
  it('defaults to light when storage and system preference detection are unavailable', () => {
    const document = { documentElement: { dataset: {} as Record<string, string> } }
    runInNewContext(script, { document, window: {} })
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
