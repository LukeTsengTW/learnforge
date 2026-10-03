import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { log } from 'node:console'
import { releaseConfig } from './config.mjs'
import { git, isMain, parseArgs, readPackage, repositoryRoot, runCli, validateSha, validateVersion } from './common.mjs'

export function writeManifest({ cwd = repositoryRoot, sha } = {}) {
  const version = validateVersion(readPackage(cwd).version)
  const head = validateSha(git(['rev-parse', '--verify', 'HEAD^{commit}'], { cwd }))
  if (sha !== undefined && validateSha(sha) !== head) throw new Error('Manifest SHA does not match checked-out HEAD')
  const dist = path.join(cwd, 'dist')
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Manifest requires an existing production build (dist/index.html)')
  const manifest = { app: releaseConfig.app, version, gitSha: head }
  fs.writeFileSync(path.join(dist, 'release.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  return manifest
}

if (isMain(import.meta.url)) {
  await runCli(() => {
    const options = parseArgs(process.argv.slice(2), { sha: 'string' })
    const result = writeManifest({ sha: options.sha })
    log(JSON.stringify(result))
  })
}
