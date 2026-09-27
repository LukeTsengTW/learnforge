/* global crypto, console, fetch, AbortSignal, process */
// Live, dedicated-account test. Requires explicit approval for the temporary dev CAPTCHA flag.
// Credentials and raw recovery codes exist only in this process. No traces or state files.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)
  .filter(line => /^[A-Z_]+=/.test(line)).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const username = `lfv10rc_${crypto.randomUUID().slice(0, 8)}`
const password = `Lf10!${crypto.randomUUID()}`, nextPassword = `Lf10!${crypto.randomUUID()}`
const email = `${username}@users.learnforge.invalid`
let count = 0
function check(ok, label) { if (!ok) throw new Error(label); count++; console.log(`PASS ${label}`) }
async function edge(name, body, token) {
  const response = await fetch(`${url}/functions/v1/${name}`, { method: 'POST', headers: { apikey: key, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) })
  return { status: response.status, data: await response.json() }
}
try {
  const signup = await client.auth.signUp({ email, password, options: { data: { username, password_hint: 'Dedicated release verification account' } } })
  check(!signup.error && !!signup.data.session, 'register dedicated account')
  console.log(`TEST_ACCOUNT ${username}`)
  const token = signup.data.session.access_token
  const generated = await edge('account-recovery-code', { action: 'generate' }, token)
  check(generated.status === 200 && typeof generated.data.code === 'string', 'generate recovery code')
  const code = generated.data.code
  const status = await edge('account-recovery-code', { action: 'status' }, token)
  check(status.data.active === true && !('code' in status.data), 'status never returns raw code')
  await client.auth.signOut({ scope: 'local' })
  const invalid = await edge('recover-account', { username, code: crypto.randomUUID().replaceAll('-', ''), password: nextPassword })
  check(invalid.status === 400, 'bad recovery code denied')
  const recovered = await edge('recover-account', { username, code, password: nextPassword })
  check(recovered.status === 200 && recovered.data.success === true, `correct code changes password (HTTP ${recovered.status})`)
  check(!('session' in recovered.data), 'recovery creates no session')
  const replay = await edge('recover-account', { username, code, password: nextPassword })
  check(replay.status === 400 && replay.data.error === invalid.data.error, 'used code replay denied with same generic error')
  const oldLogin = await client.auth.signInWithPassword({ email, password })
  check(!!oldLogin.error, 'old password denied')
  const newLogin = await client.auth.signInWithPassword({ email, password: nextPassword })
  check(!newLogin.error && !!newLogin.data.session, 'new password accepted')
  const fresh = await edge('account-recovery-code', { action: 'generate' }, newLogin.data.session.access_token)
  check(fresh.status === 200 && typeof fresh.data.code === 'string', 'generate new recovery code after recovery')
  const revoked = await edge('account-recovery-code', { action: 'status' }, token)
  check(revoked.status === 401, 'revoked JWT session denied')
  const thirdPassword = `Lf10!${crypto.randomUUID()}`
  const noCurrent = await client.auth.updateUser({ password: thirdPassword })
  check(!!noCurrent.error, 'server denies password change without current password')
  const wrongCurrent = await client.auth.updateUser({ password: thirdPassword, current_password: `Lf10!${crypto.randomUUID()}` })
  check(!!wrongCurrent.error, 'server denies incorrect current password')
  const correctCurrent = await client.auth.updateUser({ password: thirdPassword, current_password: nextPassword })
  check(!correctCurrent.error, 'server accepts verified current password change')
  await client.auth.signOut({ scope: 'local' })
  check(!!(await client.auth.signInWithPassword({ email, password: nextPassword })).error, 'previous password denied after authenticated change')
  check(!(await client.auth.signInWithPassword({ email, password: thirdPassword })).error, 'new authenticated-change password accepted')
  for (const name of ['ai-tutor','ai-grade','ai-drawing','ai-quota','ai-responses','ai-usage','account-recovery-code']) {
    check((await edge(name, {})).status === 401, `${name} unauthenticated 401`)
  }
  await client.auth.signOut({ scope: 'local' })
  console.log(`LIVE_RECOVERY_PASS checks=${count} OpenAI_calls=0`)
} catch (error) {
  console.error(`LIVE_RECOVERY_FAIL ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
} finally {
  // Always remove the explicitly authorized temporary dev exception, including after failures.
  const cli = path.join(root, 'node_modules/@supabase/cli-windows-x64/bin/supabase.exe')
  const cleanup = spawnSync(cli, ['secrets','unset','RECOVERY_ALLOW_NO_CAPTCHA','--project-ref','mrrssxqolvcjxgqzoeqt','--yes'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 20000 })
  console.log(`CAPTCHA_DEV_FLAG_REMOVAL exit=${cleanup.status}`)
  if (cleanup.status !== 0) { process.exitCode = 1; console.error('Temporary CAPTCHA exception cleanup needs operator attention.') }
  else {
    const closed = await edge('recover-account', { username, code: 'invalid', password: nextPassword })
    check(closed.status === 400 && closed.data.error === '請完成安全驗證後再試。', 'recovery fails closed after temporary CAPTCHA flag removal')
  }
}
