import { expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { quizFigureFiles } from '../quiz-figure-files.mjs'

it('inventories only quiz-local regular files and rejects linked directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'quiz-figure-files-'))
  try {
    const quiz = join(root, 'quiz', 'v1.quiz.md')
    await mkdir(join(root, 'quiz'))
    expect(await quizFigureFiles(quiz)).toEqual([])
    await mkdir(join(root, 'quiz', 'figures'))
    await writeFile(join(root, 'quiz', 'figures', 'one.svg'), '<svg/>')
    expect(await quizFigureFiles(quiz)).toEqual(['figures/one.svg'])
    await mkdir(join(root, 'outside'))
    await symlink(join(root, 'outside'), join(root, 'quiz', 'figures', 'linked'), 'junction')
    await expect(quizFigureFiles(quiz)).rejects.toThrow(/regular files/)
    await mkdir(join(root, 'other'))
    await symlink(join(root, 'outside'), join(root, 'other', 'figures'), 'junction')
    await expect(quizFigureFiles(join(root, 'other', 'v1.quiz.md'))).rejects.toThrow(/real directory/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
