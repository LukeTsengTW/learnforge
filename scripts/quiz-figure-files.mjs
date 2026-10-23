import { readdir, lstat } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** Do not let a quiz-local-looking path resolve through a filesystem link. */
export async function quizFigureFiles(quizFile) {
  const directory = join(dirname(quizFile), 'figures')
  const directoryStat = await lstat(directory).catch(error => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (!directoryStat) return []
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) throw new Error(`${directory}: figures must be a real directory`)
  const files = []
  for (const name of await readdir(directory)) {
    const stat = await lstat(join(directory, name))
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${directory}/${name}: figures must be regular files`)
    files.push(`figures/${name}`)
  }
  return files
}
