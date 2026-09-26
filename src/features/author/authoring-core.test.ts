// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import demoSource from '../../content/quizzes/demo/v1.quiz.md?raw'
import booleanSource from '../../content/quizzes/boolean-algebra/v1.quiz.md?raw'
import relationsSource from '../../content/quizzes/relations/v1.quiz.md?raw'
import { parseQuiz } from '../../lib/quiz-parser'
import {
  AUTHOR_DRAFT_KEY, MAX_AUTHOR_SOURCE_BYTES, NEW_QUIZ_TEMPLATE, bundledRevisionMetadata,
  clearAuthorDraft, completeAuthoringParse, copyMarkdown, createAuthoringDocument,
  createRevisedSource, editAuthoringDocument, exportQuizSource, importQuizFile, insertQuestionSnippet,
  inspectAiCapabilities, inspectQualityWarnings, inspectQuiz, markExported, nextQuestionId,
  readAuthorDraft, safeExportFilename, saveAuthorDraft, sourceBytes, suggestQuizPath,
  validateProposedRevisionChange,
} from './authoring-core'

const sources = {
  'src/content/quizzes/demo/v1.quiz.md': demoSource,
  'src/content/quizzes/boolean-algebra/v1.quiz.md': booleanSource,
  'src/content/quizzes/relations/v1.quiz.md': relationsSource,
}
const existing = bundledRevisionMetadata(sources)

beforeEach(() => localStorage.clear())

describe('raw authoring document', () => {
  it('starts from a valid Markdown template with canonical metadata', () => {
    const quiz = parseQuiz(NEW_QUIZ_TEMPLATE, true)
    expect(quiz.questions).toHaveLength(1)
    expect(quiz.questions[0].type).toBe('single')
    expect(quiz.revision).toBe('v1')
  })
  it('tracks only unexported edits as dirty', () => {
    const initial = createAuthoringDocument(demoSource, 'v1.quiz.md')
    expect(initial.dirty).toBe(false)
    const edited = editAuthoringDocument(initial, demoSource + '\n')
    expect(edited.dirty).toBe(true)
    expect(markExported(edited).dirty).toBe(false)
    expect(editAuthoringDocument(edited, demoSource).dirty).toBe(false)
  })
  it('keeps source and line-aware error when parsing fails', () => {
    const broken = demoSource.replace(':::end', ':::bad')
    const document = completeAuthoringParse(createAuthoringDocument(broken), 0)
    expect(document.source).toBe(broken)
    expect(document.parseState.status).toBe('invalid')
    if (document.parseState.status === 'invalid') {
      expect(document.parseState.error.line).toBeGreaterThan(1)
      expect(document.parseState.error.questionId).toBe('q1')
    }
  })
  it('ignores an older scheduled parse after a newer edit', () => {
    const first = createAuthoringDocument(demoSource)
    const second = editAuthoringDocument(first, 'invalid source')
    expect(completeAuthoringParse(second, first.version)).toBe(second)
    expect(completeAuthoringParse(second, second.version).parseState.status).toBe('invalid')
  })
  it('rejects oversized editing and local draft sources', () => {
    const huge = 'a'.repeat(MAX_AUTHOR_SOURCE_BYTES + 1)
    expect(sourceBytes(huge)).toBe(MAX_AUTHOR_SOURCE_BYTES + 1)
    expect(() => editAuthoringDocument(createAuthoringDocument(), huge)).toThrow('1 MiB')
    localStorage.setItem(AUTHOR_DRAFT_KEY, JSON.stringify({ source: huge }))
    expect(readAuthorDraft(localStorage)).toBeNull()
  })
  it('inserts all six valid DSL snippets with the next unused qN', () => {
    let source = NEW_QUIZ_TEMPLATE
    for (const type of ['single', 'multiple', 'true-false', 'fill', 'calculation', 'drawing'] as const) {
      const id = nextQuestionId(source)
      source = insertQuestionSnippet(source, type)
      expect(source).toContain(`id="${id}" type="${type}"`)
      expect(parseQuiz(source).questions.at(-1)?.type).toBe(type)
    }
    expect(nextQuestionId(source)).toBe('q8')
    expect(source).toContain(':::rubric\n- 1 |')
  })
  it('computes declared, deterministic and manual points from canonical Quiz', () => {
    const metadata = inspectQuiz(parseQuiz(demoSource))
    expect(metadata).toMatchObject({ id: 'demo', questionCount: 7, totalDeclaredPoints: 20,
      deterministicMax: 10, manualPoints: 10 })
    expect(metadata.questionTypes).toMatchObject({ single: 2, multiple: 1, calculation: 1, drawing: 1 })
  })
  it('uses the real scored rubric gate for calculation and drawing capability', () => {
    const quiz = parseQuiz(demoSource)
    expect(inspectAiCapabilities(quiz).map((item) => [item.questionId, item.available]))
      .toEqual([['q6', true], ['q7', true]])
    const unscored = { ...quiz, questions: quiz.questions.map((question) =>
      question.type === 'calculation' || question.type === 'drawing'
        ? { ...question, rubric: question.rubric.map((criterion) => ({ ...criterion, score: null })) }
        : question) }
    expect(inspectAiCapabilities(unscored).map((item) => item.available)).toEqual([false, false])
    expect(inspectAiCapabilities(unscored)[0].message).toContain('可正常作答')
    expect(inspectAiCapabilities(parseQuiz(booleanSource))).toEqual([])
  })
  it('keeps content warnings separate from parse errors', () => {
    const quiz = parseQuiz(booleanSource)
    expect(inspectQualityWarnings(quiz)).toContain('identity：沒有提示。')
    expect(parseQuiz(booleanSource).questions).toHaveLength(7)
  })
  it('saves, restores and clears a single namespaced local draft', () => {
    const draft = editAuthoringDocument(createAuthoringDocument(demoSource, 'demo.quiz.md', 'demo'), demoSource + '\n')
    saveAuthorDraft(localStorage, draft)
    expect(localStorage.getItem(AUTHOR_DRAFT_KEY)).toContain('demo.quiz.md')
    expect(readAuthorDraft(localStorage)).toMatchObject({ source: demoSource + '\n', originQuizId: 'demo' })
    clearAuthorDraft(localStorage)
    expect(readAuthorDraft(localStorage)).toBeNull()
  })
})

describe('import, export and revision boundaries', () => {
  it('imports UTF-8 text without changing canonical Quiz or source bytes', async () => {
    const imported = await importQuizFile(new File([demoSource], 'demo.quiz.md', { type: 'text/plain' }))
    expect(imported.source).toBe(demoSource)
    expect(parseQuiz(imported.source)).toEqual(parseQuiz(demoSource))
  })
  it('exports imported source byte-for-byte with a safe download name', async () => {
    const imported = await importQuizFile(new File([demoSource], 'demo.quiz.md'))
    const downloads: Blob[] = []
    const url = { createObjectURL: vi.fn((blob: Blob | MediaSource) => {
      if (blob instanceof Blob) downloads.push(blob)
      return 'blob:author-test'
    }), revokeObjectURL: vi.fn() }
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    expect(exportQuizSource(imported.source, '../demo.md', document, url)).toBe('demo.quiz.md')
    expect(await downloads[0].text()).toBe(demoSource)
    expect(click).toHaveBeenCalledOnce()
    expect(url.revokeObjectURL).toHaveBeenCalledWith('blob:author-test')
  })
  it('rejects unsupported extensions, oversized files and invalid UTF-8', async () => {
    await expect(importQuizFile(new File(['a'], 'quiz.html'))).rejects.toThrow('僅支援')
    await expect(importQuizFile(new File(['a'.repeat(MAX_AUTHOR_SOURCE_BYTES + 1)], 'huge.md'))).rejects.toThrow('1 MiB')
    await expect(importQuizFile(new File([new Uint8Array([0xff])], 'bad.md'))).rejects.toThrow()
  })
  it('sanitizes downloaded names and keeps repository suggestions inside the quiz folder', () => {
    for (const input of ['../../evil', 'C:\\folder\\evil.md', '/absolute/demo.quiz.md', 'a\u0000b.txt']) {
      expect(safeExportFilename(input)).toMatch(/^[a-zA-Z0-9._-]+\.quiz\.md$/)
      expect(safeExportFilename(input)).not.toContain('..')
    }
    const quiz = parseQuiz(demoSource)
    expect(suggestQuizPath(quiz, Object.keys(sources), true)).toBe('src/content/quizzes/demo/v2.quiz.md')
  })
  it('copies with Clipboard API and falls back after a clipboard failure', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const fallback = vi.fn(() => true)
    expect(await copyMarkdown('source', { writeText }, fallback)).toBe(true)
    expect(writeText).toHaveBeenCalledWith('source')
    expect(fallback).not.toHaveBeenCalled()
    writeText.mockRejectedValueOnce(new Error('denied'))
    expect(await copyMarkdown('source', { writeText }, fallback)).toBe(true)
    expect(fallback).toHaveBeenCalledOnce()
    expect(await copyMarkdown('source', undefined, () => { throw new Error('copy unavailable') })).toBe(false)
  })
  it('clones a current source to a distinct manually named revision without touching the old text', () => {
    const old = demoSource
    const revised = createRevisedSource(old, 'v2', 'demo', existing)
    expect(parseQuiz(revised.source, true).revision).toBe('v2')
    expect(revised.source).toContain('current="true"')
    expect(old).toBe(demoSource)
    expect(existing.find((item) => item.id === 'demo')?.current).toBe(true)
    expect(validateProposedRevisionChange(existing, revised.source, 'demo').valid).toBe(true)
  })
  it('rejects missing, same, duplicate and id-changing revisions', () => {
    expect(() => createRevisedSource(demoSource, '', 'demo', existing)).toThrow('請輸入')
    expect(() => createRevisedSource(demoSource, 'v1-7d7c900e', 'demo', existing)).toThrow('不同')
    const duplicate = [...existing, { id: 'demo', revision: 'v2', current: false,
      file: 'src/content/quizzes/demo/v2.quiz.md' }]
    expect(() => createRevisedSource(demoSource, 'v2', 'demo', duplicate)).toThrow('重複')
    expect(() => createRevisedSource(demoSource.replace('id="demo"', 'id="renamed"'), 'v2', 'demo', existing))
      .toThrow('id')
  })
  it('requires new current and validates simulated catalog identity and current uniqueness', () => {
    const revised = createRevisedSource(demoSource, 'v2', 'demo', existing).source
    expect(validateProposedRevisionChange(existing, revised.replace('current="true"', 'current="false"'), 'demo').valid).toBe(false)
    const twoCurrent = [...existing, { id: 'demo', revision: 'alternate', current: true,
      file: 'src/content/quizzes/demo/v0.quiz.md' }]
    expect(validateProposedRevisionChange(twoCurrent, revised, 'demo').valid).toBe(false)
    const wrongFolder = existing.map((entry) => entry.id === 'demo' ? { ...entry, file: 'src/content/quizzes/wrong/v1.quiz.md' } : entry)
    expect(validateProposedRevisionChange(wrongFolder, revised, 'demo').valid).toBe(false)
  })
})
