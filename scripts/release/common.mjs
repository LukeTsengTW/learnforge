import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { error } from 'node:console'

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export function validateVersion(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value) || /\s/.test(value)) {
    throw new Error('Release version must be stable MAJOR.MINOR.PATCH without prefixes or leading zeros')
  }
  return value
}

export function validateSha(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value) || value.length !== 40) {
    throw new Error('Release SHA must be exactly 40 lowercase hexadecimal characters')
  }
  return value
}

export function readPackage(cwd = repositoryRoot) {
  return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'))
}

export function git(args, { cwd = repositoryRoot } = {}) {
  try {
    const output = execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 })
    return args.includes('-z') ? output : output.trim()
  } catch {
    // Never echo remote URLs, command stderr, or credential-helper diagnostics.
    throw new Error(`Read-only Git check failed: ${args[0]}`)
  }
}

export function npmCliPath() {
  const candidates = [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')]
  const result = candidates.find(candidate => candidate && fs.existsSync(candidate))
  if (!result) throw new Error('Cannot locate npm CLI for the current Node runtime')
  return result
}

export function runNpm(args, { cwd = repositoryRoot, env = process.env } = {}) {
  return spawnSync(process.execPath, [npmCliPath(), ...args], {
    cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
  })
}

export function parseArgs(argv, schema) {
  const result = {}
  for (let index = 0; index < argv.length; index++) {
    const option = argv[index]
    if (!option.startsWith('--')) throw new Error('Expected a named release option')
    const name = option.slice(2)
    if (!Object.hasOwn(schema, name)) throw new Error('Unknown release option')
    if (Object.hasOwn(result, name)) throw new Error('Duplicate release option')
    if (schema[name] === 'boolean') result[name] = true
    else {
      const value = argv[++index]
      if (!value || value.startsWith('-')) throw new Error('Release option requires a value')
      result[name] = value
    }
  }
  return result
}

export function isMain(url) {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(url)
}

export async function runCli(operation) {
  try { await operation() }
  catch (failure) {
    error(failure instanceof Error ? failure.message : 'Release check failed')
    process.exitCode = 1
  }
}
