/* global process, crypto, console, document, getComputedStyle, innerWidth, localStorage, fetch, AbortSignal, window, URL */
// Optional release validation; no new project dependency. Set PLAYWRIGHT_MODULE_DIR
// and PLAYWRIGHT_BROWSERS_PATH to an installed Playwright runtime/browser cache.
// Runs only against the linked development backend. No traces, credentials or raw
// recovery codes are written to disk. Dedicated accounts are deliberately retained.
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, 'package.json'))
const { chromium, firefox, webkit } = require('playwright')
const base = process.env.RELEASE_PREVIEW_URL ?? 'http://127.0.0.1:4173/learnforge/'
assert.ok(base.startsWith('http://127.0.0.1:'), 'Use the local production preview')
const username = `lfv10ui_${crypto.randomUUID().slice(0, 8)}`
const password = `Lf10!${crypto.randomUUID()}`
const browsers = [], errors = [], consoleErrors = [], cspDenials = []
const failedAssets = []
let checks = 0, stage = 'startup', allowNetworkErrors = false, providerCalls = 0, lastPage
function pass(label) { checks++; console.log(`PASS ${label}`) }
async function visible(page, name) { await page.getByRole('heading', { name, exact: true }).waitFor({ timeout: 25000 }) }
async function route(page, route, heading) {
  lastPage = page; stage = route
  await page.goto(`${base}#${route}`)
  if (heading) await visible(page, heading)
}
async function watch(page) {
  page.setDefaultTimeout(12000)
  page.on('pageerror', e => errors.push(e.message.replace(/https?:\/\/\S+/g, '[URL]').slice(0, 180)))
  page.on('requestfailed', request => { if (request.url().startsWith(base)) failedAssets.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }) })
  page.on('console', msg => {
    if (msg.type() !== 'error' || allowNetworkErrors) return
    const message = msg.text().replace(/https?:\/\/\S+/g, '[URL]').slice(0, 700)
    if (message.includes('Content-Security-Policy') && message.includes('inline script') && msg.text().includes('local.adguard.org')) cspDenials.push(message)
    else consoleErrors.push(message)
  })
  await page.route('**/functions/v1/ai-{tutor,grade,drawing}', async request => { providerCalls++; await request.abort() })
}
async function login(page) {
  await route(page, '/login', '歡迎回來')
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(el => el.textContent === '登入' && !el.disabled))
  await page.getByLabel('使用者名稱', { exact: true }).pressSequentially(username)
  await page.getByLabel('密碼', { exact: true }).fill(password)
  assert.equal(await page.getByLabel('使用者名稱', { exact: true }).inputValue(), username)
  await page.getByLabel('密碼', { exact: true }).press('Enter')
  await page.getByRole('button', { name: '登出', exact: true }).waitFor({ timeout: 25000 })
}
async function labelsAndKeyboard(page, label) {
  const unlabeled = await page.locator('input:not([type="hidden"]), textarea, select').evaluateAll(nodes => nodes.filter(el => !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && el.getBoundingClientRect().width > 0).length)
  assert.equal(unlabeled, 0, `${label}: controls have accessible labels`)
  await page.keyboard.press('Tab')
  const focused = await page.evaluate(() => { const el = document.activeElement; const style = getComputedStyle(el); return el !== document.body && (style.outlineStyle !== 'none' || style.boxShadow !== 'none') })
  assert.ok(focused, `${label}: keyboard focus visible`)
  pass(`${label}: labels and keyboard focus`)
}
async function layout(page, name) {
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 })
    await page.evaluate(() => document.fonts.ready)
    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth)
    assert.ok(overflow <= 1, `${name} ${width}: overflow ${overflow}`)
    await page.screenshot({ path: path.join(root, `output/playwright/v1.0-${name}-${width}.png`), fullPage: true })
    pass(`${name}: ${width}px no horizontal overflow`)
  }
}
async function sync(page) {
  await page.getByRole('button', { name: '重試同步', exact: true }).click()
  await page.waitForFunction(() => window.location.hash.startsWith('#/result/') || [...document.querySelectorAll('button')].some(el => el.textContent === '重試同步' && !el.disabled))
}
async function draftId(page) {
  return page.evaluate(() => { const key = Object.keys(localStorage).find(k => k.startsWith('learnforge:draft-index:v3:') && k.endsWith(':demo')); return key && localStorage.getItem(key) })
}
async function submit(page) {
  await page.getByRole('button', { name: '提交測驗', exact: true }).click()
  await page.getByRole('button', { name: '仍然提交', exact: true }).click()
  await page.waitForURL('**/#/result/**', { timeout: 25000 })
  await visible(page, '把答案，變成理解。')
}
async function serverRecord(page, id) {
  return page.evaluate(async attemptId => {
    const authKey = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k))
    const session = JSON.parse(localStorage.getItem(authKey))
    return { token: session.access_token, id: attemptId }
  }, id).then(async ({ token, id: attemptId }) => {
    const local = Object.fromEntries(fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
    const response = await fetch(`${local.VITE_SUPABASE_URL}/rest/v1/attempts?id=eq.${attemptId}&select=id,status,updated_at,answers(*)`, { headers: { apikey: local.VITE_SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) })
    assert.equal(response.status, 200)
    return await response.text()
  })
}
try {
  stage = 'Chromium registration'
  const browser = await chromium.launch({ headless: true }); browsers.push(browser)
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  const page = await context.newPage(); await watch(page)
  await route(page, '/register', '建立學習帳號')
  await page.getByLabel('使用者名稱', { exact: true }).fill(username)
  await page.getByLabel('密碼', { exact: true }).fill(password)
  await page.getByLabel('確認密碼', { exact: true }).fill(password)
  await page.getByLabel('密碼提示', { exact: true }).fill('Dedicated release browser verification')
  await page.getByRole('button', { name: '註冊', exact: true }).click()
  await page.locator('.recovery-secret').waitFor({ timeout: 25000 })
  console.log(`TEST_ACCOUNT ${username}`)
  let rawCode = await page.locator('.recovery-secret').textContent()
  assert.ok(await page.getByRole('button', { name: '繼續', exact: true }).isDisabled())
  assert.equal(await page.evaluate(secret => Object.values(localStorage).some(value => value.includes(secret)), rawCode), false)
  await page.getByLabel('我已保存復原碼').check()
  await page.getByRole('button', { name: '繼續', exact: true }).click(); rawCode = null
  await route(page, '/account', '帳號與安全')
  await page.getByText('Recovery Code 已設定', { exact: true }).waitFor()
  assert.equal(await page.locator('.recovery-secret').count(), 0)
  pass('registration acknowledgement; raw code absent after navigation and from localStorage')
  await page.getByRole('button', { name: '登出', exact: true }).click()
  await visible(page, '歡迎回來')
  await login(page); pass('Chromium login by keyboard')
  await route(page, '/library', '選一份題目，開始思考。')
  stage = 'live cross-device and cross-tab sync'
  await route(page, '/quiz/demo', '數位邏輯與基礎數學')
  await page.locator('#answer-q1-a').check(); await sync(page)
  const id = await draftId(page); assert.ok(id)
  const tab = await context.newPage(); await watch(tab)
  await route(tab, '/quiz/demo', '數位邏輯與基礎數學')
  assert.equal(await draftId(tab), id)
  const racingTab = await context.newPage(); await watch(racingTab)
  await route(racingTab, '/quiz/demo', '數位邏輯與基礎數學')
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage(); await watch(other); await login(other)
  await route(other, '/quiz/demo', '數位邏輯與基礎數學')
  assert.equal(await draftId(other), id)
  assert.ok(await other.locator('#answer-q1-a').isChecked())
  pass('two tabs and independent context share draft UUID and synced answer')
  allowNetworkErrors = true
  await otherContext.setOffline(true)
  await other.locator('#answer-q2-b').check()
  await page.locator('#answer-q1-c').check(); await sync(page)
  await page.getByRole('button', { name: '提交測驗', exact: true }).click()
  await racingTab.getByRole('button', { name: '提交測驗', exact: true }).click()
  await Promise.all([page, racingTab].map(p => p.getByRole('button', { name: '仍然提交', exact: true }).click()))
  await Promise.race([page, racingTab].map(p => p.waitForURL('**/#/result/**', { timeout: 25000 })))
  for (const p of [page, racingTab]) {
    if (!p.url().includes('#/result/')) await sync(p)
    await p.waitForURL('**/#/result/**', { timeout: 25000 })
    assert.ok(p.url().endsWith(id))
  }
  pass('simultaneous submit race converges to one immutable result UUID')
  await racingTab.close()
  const submitted = await serverRecord(page, id)
  await tab.locator('#answer-q2-c').check(); await sync(tab)
  await tab.waitForURL('**/#/result/**', { timeout: 25000 })
  assert.equal(await serverRecord(page, id), submitted)
  pass('stale same-context tab cannot rewrite submitted record')
  await otherContext.setOffline(false)
  await other.waitForURL('**/#/result/**', { timeout: 25000 })
  assert.equal(await serverRecord(page, id), submitted)
  pass('offline independent context reconnect cannot rewrite submitted record')
  await route(other, '/recovery', '本機練習備份')
  await other.locator('.backup-list li').first().waitFor()
  assert.equal(await other.locator('.backup-preview').count(), 0)
  await other.getByRole('button', { name: '檢視', exact: true }).first().click()
  await other.locator('.backup-preview').waitFor()
  await other.getByRole('button', { name: '收起內容' }).click()
  await other.getByRole('button', { name: '嘗試安全還原為本機草稿' }).first().click()
  await other.getByText(/此備份無法安全還原/).waitFor()
  assert.equal(await serverRecord(page, id), submitted)
  pass('conflict backup metadata/view; submitted restore denied without data changes')
  await layout(other, 'practice-recovery')
  await tab.close(); await otherContext.close(); allowNetworkErrors = false
  await layout(page, 'result'); await labelsAndKeyboard(page, 'result')
  for (const [routeName, heading] of [['/history','每一次練習，都值得留下。'],['/analytics','從練習紀錄，看見學習軌跡。'],['/review','一次複習一題。'],['/author','題庫編寫工具'],['/account','帳號與安全']]) {
    await route(page, routeName, heading)
    if (routeName === '/analytics') { await page.getByRole('heading', { name: '整體概況' }).waitFor(); await layout(page, 'analytics') }
    if (routeName === '/account') { await page.getByText('Recovery Code 已設定', { exact: true }).waitFor(); await layout(page, 'account') }
    if (routeName === '/review') { await page.locator('.review-session').waitFor(); await page.getByRole('radio').first().check(); await page.getByRole('button', { name: '檢查答案' }).press('Enter'); await page.locator('.review-feedback').waitFor() }
    if (routeName === '/author') await labelsAndKeyboard(page, 'author')
  }
  await page.reload(); await visible(page, '帳號與安全'); pass('HashRouter account reload with Pages project base')
  const logoutTab = await context.newPage(); await watch(logoutTab); await route(logoutTab, '/account', '帳號與安全')
  await page.getByRole('button', { name: '登出', exact: true }).click()
  await visible(logoutTab, '歡迎回來'); pass('logout propagates to another tab')
  await logoutTab.close()
  await route(page, '/login', '歡迎回來'); await labelsAndKeyboard(page, 'login')
  await route(page, '/recover-account', '復原帳號'); await labelsAndKeyboard(page, 'account recovery'); await layout(page, 'recover-account')
  await page.getByLabel('使用者名稱').fill(username)
  await page.getByLabel('帳號復原碼').fill('invalid')
  await page.getByLabel('新密碼', { exact: true }).fill('short')
  await page.getByLabel('確認新密碼').fill('short')
  await page.getByRole('button', { name: '重設密碼' }).press('Enter')
  await page.getByRole('alert').waitFor(); pass('recovery validation announces errors')
  pass('Chromium core routes, review interaction and author')
  for (const [name, engine] of [['Firefox', firefox], ['WebKit', webkit]]) {
    stage = `${name} core loop`
    const instance = await engine.launch({ headless: true }); browsers.push(instance)
    const ctx = await instance.newContext({ viewport: { width: 1440, height: 960 } })
    const current = await ctx.newPage(); await watch(current); await login(current)
    await route(current, '/library', '選一份題目，開始思考。')
    await route(current, '/quiz/demo', '數位邏輯與基礎數學')
    await current.locator('#answer-q1-a').check(); await labelsAndKeyboard(current, `${name} quiz`)
    await submit(current)
    for (const [routeName, heading] of [['/history','每一次練習，都值得留下。'],['/analytics','從練習紀錄，看見學習軌跡。'],['/review','一次複習一題。'],['/author','題庫編寫工具'],['/account','帳號與安全']]) await route(current, routeName, heading)
    await current.getByText('Recovery Code 已設定', { exact: true }).waitFor()
    await current.reload(); await visible(current, '帳號與安全')
    pass(`${name} ${instance.version()}: login library quiz submit result history analytics review author account; route reload`)
    await ctx.close()
  }
  assert.equal(providerCalls, 0, 'No AI provider endpoint should be invoked')
  assert.equal(errors.length, 0, 'No browser pageerror')
  assert.equal(consoleErrors.length, 0, `Unexpected console errors: ${consoleErrors.join('; ')}`)
  if (cspDenials.length) console.log(JSON.stringify({ blockedInlineScripts: cspDenials.length, samples: [...new Set(cspDenials)] }))
  console.log(`BROWSER_RELEASE_PASS checks=${checks} OpenAI_calls=0`)
} catch (error) {
  console.error(`BROWSER_RELEASE_FAIL stage=${stage}: ${String(error.message).replace(/Lf10![^\s]+/g, '[redacted]').slice(0, 1600)}`)
  console.error(JSON.stringify({ pageErrors: errors, consoleErrors, headings: await lastPage?.locator('h1,h2,[role="alert"]').allTextContents() }))
  console.error(JSON.stringify({ failedAssets, page: await lastPage?.evaluate(() => ({ url: window.location.href, ready: document.readyState, bodyChildren: document.body.children.length, statuses: [...document.querySelectorAll('[role="status"]')].map(el => el.textContent), scripts: [...document.scripts].map(el => el.src && new URL(el.src).pathname), policy: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content })) }))
  process.exitCode = 1
} finally { for (const browser of browsers) await browser.close() }
