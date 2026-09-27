/* global process, console, document, window, URL */
// Read-only widget smoke against the production build. No CAPTCHA substitutes,
// origin rewriting, traces, screenshots, credentials, or recovery codes.
import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, 'package.json'))
const { chromium, firefox, webkit } = require('playwright')
const base = process.env.RELEASE_PREVIEW_URL ?? 'http://127.0.0.1:4173/learnforge/'
assert.equal(new URL(base).pathname, '/learnforge/')
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
const authRoutes = [
  ['/login', '歡迎回來'],
  ['/register', '建立學習帳號'],
  ['/recover-account', '復原帳號'],
]
let widgetBlockers = 0
let applicationFailures = 0
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  if (process.env.RELEASE_BROWSER && process.env.RELEASE_BROWSER !== name) continue
  const browser = await engine.launch({ headless: process.env.RELEASE_HEADED !== 'true' })
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    page.setDefaultTimeout(20000)
    for (const [route, heading] of authRoutes) {
      let appConsoleErrors = 0, pageErrors = 0, environmentCsp = 0, externalErrors = 0
      let scriptLoaded = false
      const applicationDiagnostics = []
      const codes = new Set()
      const onConsole = msg => {
        if (!['error', 'warning', 'warn'].includes(msg.type())) return
        const value = msg.text()
        const errorCodes = value.match(/\b(?:110|200|300|400|600)\d{3}\b/g) ?? []
        for (const code of errorCodes) codes.add(code)
        if (msg.type() !== 'error') return
        if (value.includes('local.adguard.org') && /Content-Security-Policy|Content Security Policy/.test(value)) environmentCsp++
        else if (/turnstile|cloudflare/i.test(value) || msg.location().url.startsWith('https://challenges.cloudflare.com/')) externalErrors++
        else {
          appConsoleErrors++
          applicationDiagnostics.push({ source: msg.location().url ? new URL(msg.location().url).origin : 'unknown',
            message: value.replace(/https?:\/\/\S+/g, '[URL]').replace(/[A-Za-z0-9_.-]{40,}/g, '[redacted]').slice(0, 300) })
        }
      }
      const onPageError = error => {
        if (/turnstile|cloudflare/i.test(error.message)) {
          externalErrors++
          for (const code of error.message.match(/\b(?:110|200|300|400|600)\d{3}\b/g) ?? []) codes.add(code)
        } else pageErrors++
      }
      const onResponse = response => {
        if (response.url().startsWith('https://challenges.cloudflare.com/turnstile/v0/api.js')) scriptLoaded = response.ok()
      }
      page.on('console', onConsole)
      page.on('pageerror', onPageError)
      page.on('response', onResponse)
      const response = await page.goto(`${base}#${route}`)
      if (response) assert.equal(response.status(), 200)
      await page.getByRole('heading', { name: heading, exact: true }).waitFor()
      await page.locator('.captcha').scrollIntoViewIfNeeded()
      await page.waitForFunction(() =>
        Boolean(window.turnstile?.getResponse())
        || [...document.querySelectorAll('[role="alert"]')].some(el => el.textContent.includes('安全驗證無法載入')),
      undefined, { timeout: 15000 }).catch(() => {})
      await page.getByLabel('使用者名稱', { exact: true }).fill('')
      await page.getByLabel('使用者名稱', { exact: true }).pressSequentially('lfv10smoke')
      const formOperable = await page.getByLabel('使用者名稱', { exact: true }).inputValue() === 'lfv10smoke'
      const tokenIssued = await page.evaluate(() => Boolean(window.turnstile?.getResponse()))
      scriptLoaded ||= await page.evaluate(() => typeof window.turnstile?.render === 'function')
      const widgetError = await page.getByText('安全驗證無法載入，請重新整理後再試。', { exact: true }).isVisible()
      const frameLoaded = page.frames().some(frame => frame.url().startsWith('https://challenges.cloudflare.com/'))
      for (const frame of page.frames().filter(frame => frame.url().startsWith('https://challenges.cloudflare.com/'))) {
        const text = await frame.locator('body').innerText().catch(() => '')
        for (const code of text.match(/\b(?:110|200|300|400|600)\d{3}\b/g) ?? []) codes.add(code)
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
      if (!tokenIssued || widgetError) widgetBlockers++
      if (!formOperable || overflow || appConsoleErrors || pageErrors) applicationFailures++
      console.log(JSON.stringify({ browser: name, version: browser.version(), route, scriptLoaded, frameLoaded,
        tokenIssued, widgetError, providerErrorCodes: [...codes], formOperable, overflow,
        appConsoleErrors, pageErrors, environmentCsp, externalErrors, applicationDiagnostics }))
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
      page.off('response', onResponse)
    }
    await page.goto(`${base}#/author`)
    await page.getByRole('heading', { name: '題庫編寫工具', exact: true }).waitFor()
    console.log(JSON.stringify({ browser: name, route: '/author', visible: true }))
    await page.goto(`${base}#/library`)
    await page.getByRole('heading', { name: '選一份題目，開始思考。', exact: true }).waitFor()
    console.log(JSON.stringify({ browser: name, route: '/library', visible: true }))
    for (const route of ['/quiz/demo', '/history', '/analytics', '/review', '/account', '/result/00000000-0000-4000-8000-000000000000']) {
      await page.goto(`${base}#${route}`)
      await page.getByRole('heading', { name: '歡迎回來', exact: true }).waitFor()
    }
    console.log(JSON.stringify({ browser: name, protectedRouteGuards: 6, authenticatedFlows: 'NOT RUN: requires valid CAPTCHA signup/login' }))
    await context.close()
  } catch {
    // Do not print exception objects, DOM, URLs containing request data, or traces.
    applicationFailures++
    console.log(JSON.stringify({ browser: name, smoke: 'FAILED', diagnostic: 'Browser smoke assertion failed; no sensitive diagnostics recorded' }))
  } finally {
    await browser.close()
  }
}
console.log(JSON.stringify({ widgetBlockers, applicationFailures, authenticationFlow: 'Not exercised by read-only smoke' }))
process.exitCode = applicationFailures ? 1 : widgetBlockers ? 2 : 0
