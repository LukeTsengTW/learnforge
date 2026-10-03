import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { git, repositoryRoot, validateSha } from './common.mjs'
import { validateRef } from './classify-impact.mjs'
import { readSourceInventory } from './source-inventory.mjs'

// Bind local evidence to reviewed content, including dirty/staged/untracked code.
// Ignored source is rejected; only explicit generated/dependency roots are excluded.
export function snapshotSource({ cwd = repositoryRoot, base = 'HEAD' } = {}, dependencies = {}) {
  validateRef(base)
  const readGit = dependencies.git ?? git
  const baseSha = validateSha(readGit(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`], { cwd }))
  const headSha = validateSha(readGit(['rev-parse', '--verify', 'HEAD^{commit}'], { cwd }))
  const { files } = readSourceInventory({ cwd }, { git: readGit })
  const staged = readGit(['ls-files', '--stage', '-z', '--'], { cwd })
  const digest = createHash('sha256')
  digest.update(JSON.stringify([baseSha, headSha, staged]))
  for (const file of files) {
    const absolute = path.resolve(cwd, file)
    const relative = path.relative(cwd, absolute)
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
      || file.split(/[\\/]/).includes('..')) throw new Error('Unsafe source inventory path')
    let ancestor = cwd
    for (const segment of relative.split(path.sep).slice(0, -1)) {
      ancestor = path.join(ancestor, segment)
      let directory
      try { directory = fs.lstatSync(ancestor) }
      catch (failure) {
        if (failure.code === 'ENOENT') break
        throw new Error('Cannot inspect source ancestor', { cause: failure })
      }
      if (directory.isSymbolicLink() || !directory.isDirectory()) throw new Error('Unsupported source ancestor')
    }
    digest.update(JSON.stringify(file))
    let stat
    try { stat = fs.lstatSync(absolute) }
    catch (failure) {
      if (failure.code !== 'ENOENT') throw new Error('Cannot inspect source inventory file', { cause: failure })
      digest.update('deleted')
      continue
    }
    // Do not follow a symlink into files outside the reviewed repository.
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsupported source inventory file')
    try {
      digest.update(JSON.stringify([stat.mode, createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')]))
    } catch { throw new Error('Cannot fingerprint source inventory file') }
  }
  return { baseSha, sourceFingerprint: digest.digest('hex') }
}
