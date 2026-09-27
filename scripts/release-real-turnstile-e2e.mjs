/* global process, console, crypto, window, localStorage, fetch, AbortSignal */
// Real provider integration only. Run against the production preview with an
// explicitly authorized hostname. No CAPTCHA bypass, test keys, interception,
// traces, screenshots, storage-state files, or sensitive exception output.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, 'package.json'))
const { chromium } = require('playwright')
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)
  .filter(line => /^VITE_\w+=/.test(line)).map(line => {
    const index = line.indexOf('=')
    return [line.slice(0, index), line.slice(index + 1).trim()]
  }))
const base = 'http://127.0.0.1:4173/learnforge/'
assert.equal(env.VITE_SUPABASE_URL, 'https://mrrssxqolvcjxgqzoeqt.supabase.co')
const username = `lfv10gate_${crypto.randomUUID().slice(0, 8)}`
const password = `Lf10!${crypto.randomUUID()}`, replacement = `Lf10!${crypto.randomUUID()}`
let code, stage = 'startup', checks = 0, applicationErrors = 0, providerErrors = 0
const control = createInterface({ input: process.stdin })
let challengeNumber = 0
const browser = await chromium.launch({ headless: process.env.RELEASE_HEADED !== 'true',
  ...(process.env.RELEASE_BROWSER_CHANNEL ? { channel: process.env.RELEASE_BROWSER_CHANNEL } : {}) })
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
const page = await context.newPage()
page.setDefaultTimeout(30000)
page.on('pageerror', () => { applicationErrors++ })
page.on('console', message => {
  if (message.type() !== 'error') return
  if (/cloudflare|turnstile/i.test(message.text()) || message.location().url.startsWith('https://challenges.cloudflare.com/')) providerErrors++
  else applicationErrors++
})
function pass(label) { checks++; console.log(`PASS ${label}`) }
async function route(routeName, heading) {
  stage = routeName
  await page.goto(`${base}#${routeName}`)
  if (heading) await page.getByRole('heading', { name: heading, exact: true }).waitFor()
}
async function token(routeName, heading) {
  await route(routeName, heading)
  await page.reload()
  await page.locator('.captcha').scrollIntoViewIfNeeded()
  console.log(`WAIT_REAL_TURNSTILE ${routeName}`)
  await page.waitForFunction(() => Boolean(window.turnstile?.getResponse()), undefined, { timeout: 15000 }).catch(() => {})
  if (!await page.evaluate(() => Boolean(window.turnstile?.getResponse()))) {
    const providerState = []
    for (const frame of page.frames().filter(frame => frame.url().startsWith('https://challenges.cloudflare.com/'))) {
      providerState.push({ checkboxes: await frame.getByRole('checkbox').count(),
        text: (await frame.locator('body').innerText({ timeout: 2000 }).catch(() => '')).replace(/[A-Za-z0-9_.-]{40,}/g, '[redacted]').slice(0, 240) })
    }
    const submitEnabled = await page.locator('form button[type="submit"], form button.button.primary').isEnabled()
    const responseFieldCount = await page.locator('input[name="cf-turnstile-response"]').count()
    console.log(JSON.stringify({ awaitingProvider: routeName, providerState, submitEnabled, responseFieldCount }))
    if (process.env.RELEASE_INTERACTIVE_CAPTCHA === 'true') {
      // Only after explicit user approval to complete the real provider challenge.
      // The crop contains just the CAPTCHA, never the account/recovery form.
      const captcha = page.locator('.captcha')
      const screenshot = path.join(root, `output/playwright/v1.0-captcha-${++challengeNumber}.png`)
      await captcha.screenshot({ path: screenshot })
      console.log(`CAPTCHA_HANDOFF ${screenshot}`)
      const command = await new Promise(resolve => control.once('line', resolve))
      const match = /^clickcaptcha:(\d+):(\d+)$/.exec(command)
      assert.ok(match, 'Explicit CAPTCHA control input required')
      const bounds = await captcha.boundingBox()
      const x = Number(match[1]), y = Number(match[2])
      assert.ok(bounds && x >= 0 && x < bounds.width && y >= 0 && y < bounds.height)
      await page.mouse.click(bounds.x + x, bounds.y + y)
    }
    await page.waitForFunction(() => Boolean(window.turnstile?.getResponse()), undefined, { timeout: 300000 })
  }
  assert.equal(await page.getByText('安全驗證無法載入，請重新整理後再試。', { exact: true }).isVisible(), false)
  return page.evaluate(() => window.turnstile.getResponse())
}
async function request(endpoint, body) {
  const response = await fetch(`${env.VITE_SUPABASE_URL}${endpoint}`, {
    method: 'POST', headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(25000),
  })
  return { status: response.status, body: await response.json() }
}
async function recover(rawCode) {
  const captchaToken = await token('/recover-account', '復原帳號')
  return request('/functions/v1/recover-account', { username, code: rawCode, password: replacement, captchaToken })
}
try {
  await token('/register', '建立學習帳號')
  stage = 'real signup and recovery code generation'
  await page.getByLabel('使用者名稱', { exact: true }).fill(username)
  await page.getByLabel('密碼', { exact: true }).fill(password)
  await page.getByLabel('確認密碼', { exact: true }).fill(password)
  await page.getByLabel('密碼提示', { exact: true }).fill('Dedicated final release gate account')
  const signup = page.waitForResponse(response => response.url().includes('/auth/v1/signup'))
  await page.getByRole('button', { name: '註冊', exact: true }).click()
  assert.equal((await signup).status(), 200)
  await page.locator('.recovery-secret').waitFor()
  console.log(`TEST_ACCOUNT ${username}`)
  code = (await page.locator('.recovery-secret').textContent()).trim()
  assert.match(code, /^(?:[0-9A-F]{4}-){7}[0-9A-F]{4}$/)
  assert.ok(await page.getByRole('button', { name: '繼續', exact: true }).isDisabled())
  assert.equal(await page.evaluate(raw => Object.values(localStorage).some(value => value.includes(raw)), code), false)
  await page.getByLabel('我已保存復原碼').check()
  await page.getByRole('button', { name: '繼續', exact: true }).click()
  await route('/account', '帳號與安全')
  await page.getByText('Recovery Code 已設定', { exact: true }).waitFor()
  assert.equal(await page.locator('.recovery-secret').count(), 0)
  pass('real Turnstile signup; recovery code generated and acknowledged; no raw code persisted')
  await page.getByRole('button', { name: '登出', exact: true }).click()
  await page.getByRole('heading', { name: '歡迎回來', exact: true }).waitFor()
  pass('logout before recovery')

  stage = 'wrong recovery code'
  const wrong = await recover(crypto.randomUUID().replaceAll('-', '').toUpperCase())
  assert.equal(wrong.status, 400)
  assert.equal(wrong.body.error, '復原資訊無效或已過期。')
  pass('real Turnstile accepted; wrong recovery code rejected')
  stage = 'correct recovery code'
  const correct = await recover(code)
  assert.equal(correct.status, 200)
  assert.equal(correct.body.success, true)
  pass('real Turnstile and correct recovery code change password')
  stage = 'recovery replay'
  const replay = await recover(code)
  assert.equal(replay.status, 400)
  assert.equal(replay.body.error, '復原資訊無效或已過期。')
  code = undefined
  pass('fresh real Turnstile token does not permit recovery code replay')

  stage = 'old password login'
  const captchaToken = await token('/login', '歡迎回來')
  const oldLogin = await request('/auth/v1/token?grant_type=password', {
    email: `${username}@users.learnforge.invalid`, password, gotrue_meta_security: { captcha_token: captchaToken },
  })
  assert.equal(oldLogin.status, 400)
  assert.equal(oldLogin.body.error_code ?? oldLogin.body.code, 'invalid_credentials')
  pass('old password rejected after valid real Turnstile verification')
  await token('/login', '歡迎回來')
  stage = 'new password UI login'
  await page.getByLabel('使用者名稱', { exact: true }).fill(username)
  await page.getByLabel('密碼', { exact: true }).fill(replacement)
  await page.getByRole('button', { name: '登入', exact: true }).click()
  await page.getByRole('button', { name: '登出', exact: true }).waitFor()
  pass('new password UI login with real Turnstile succeeds')

  await route('/library', '選一份題目，開始思考。')
  await route('/quiz/demo', '數位邏輯與基礎數學')
  await page.locator('#answer-q1-a').check()
  await page.getByRole('button', { name: '提交測驗', exact: true }).click()
  await page.getByRole('button', { name: '仍然提交', exact: true }).click()
  await page.getByRole('heading', { name: '把答案，變成理解。', exact: true }).waitFor()
  pass('production preview library, quiz, submit, result')
  for (const [routeName, heading] of [
    ['/history', '每一次練習，都值得留下。'], ['/analytics', '從練習紀錄，看見學習軌跡。'],
    ['/review', '一次複習一題。'], ['/author', '題庫編寫工具'], ['/account', '帳號與安全'],
  ]) {
    await route(routeName, heading)
    if (routeName === '/analytics') await page.getByRole('heading', { name: '整體概況' }).waitFor()
    if (routeName === '/review') {
      await page.locator('.review-session').waitFor()
      await page.getByRole('radio').first().check()
      await page.getByRole('button', { name: '檢查答案' }).click()
      await page.locator('.review-feedback').waitFor()
    }
    pass(`production preview ${routeName}`)
  }
  await page.reload()
  await page.getByRole('heading', { name: '帳號與安全', exact: true }).waitFor()
  pass('production project base supports protected route reload')
  assert.equal(applicationErrors, 0)
  console.log(JSON.stringify({ realTurnstile: 'PASS', recovery: 'PASS', checks, applicationErrors, providerErrors, accountRetained: username }))
} catch {
  const providerState = []
  for (const frame of page.frames().filter(frame => frame.url().startsWith('https://challenges.cloudflare.com/'))) {
    providerState.push({ checkboxes: await frame.getByRole('checkbox').count(),
      text: (await frame.locator('body').innerText({ timeout: 2000 }).catch(() => '')).replace(/[A-Za-z0-9_.-]{40,}/g, '[redacted]').slice(0, 240) })
  }
  console.log(JSON.stringify({ realTurnstile: 'INCOMPLETE', stage, checks, applicationErrors, providerErrors,
    providerState, note: 'Sensitive diagnostics, credentials and recovery code deliberately excluded' }))
  process.exitCode = 1
} finally {
  // The isolated process exits here; all credentials remain runtime-only.
  control.close()
  await context.close()
  await browser.close()
}
