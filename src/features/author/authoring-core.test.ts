// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import demoSource from '../../content/quizzes/demo/v1.quiz.md?raw'
import demoV2Source from '../../content/quizzes/demo/v2.quiz.md?raw'
import booleanSource from '../../content/quizzes/boolean-algebra/v1.quiz.md?raw'
import relationsSource from '../../content/quizzes/relations/v1.quiz.md?raw'
import { parseQuiz } from '../../lib/quiz-parser'
import { validateV3Publication, validateV4Publication } from '../../lib/scored-rubric'
import {
  AUTHOR_DRAFT_KEY, MAX_AUTHOR_SOURCE_BYTES, NEW_QUIZ_TEMPLATE, bundledRevisionMetadata,
  clearAuthorDraft, completeAuthoringParse, copyMarkdown, createAuthoringDocument,
  createRevisedSource, editAuthoringDocument, exportQuizSource, importQuizFile, insertQuestionSnippet,
  inspectAiCapabilities, inspectQualityWarnings, inspectQuiz, markExported, nextQuestionId, publicationErrors,
  readAuthorDraft, safeExportFilename, saveAuthorDraft, sourceBytes, suggestQuizPath,
  validateProposedRevisionChange,
} from './authoring-core'

// Mirrors the bundle: text-only demo v1-7d7c900e is archived, demo v2-handwriting is current.
const sources = {
  'src/content/quizzes/demo/v1.quiz.md': demoSource,
  'src/content/quizzes/demo/v2.quiz.md': demoV2Source,
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
  it('computes declared, deterministic and calculation/drawing points from canonical Quiz', () => {
    const metadata = inspectQuiz(parseQuiz(demoSource))
    expect(metadata).toMatchObject({ id: 'demo', questionCount: 7, totalDeclaredPoints: 20,
      deterministicMax: 10, calculationDrawingPoints: 10 })
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
    expect(inspectAiCapabilities(unscored)[0].message).toContain('v3 發布條件')
    const missingSolution = { ...quiz, questions: quiz.questions.map((question) =>
      question.type === 'calculation' ? { ...question, solution: ' ' } : question) }
    expect(inspectAiCapabilities(missingSolution)[0].available).toBe(false)
    const invalidDrawing = { ...quiz, questions: quiz.questions.map((question) =>
      question.type === 'drawing' ? { ...question, drawing: { ...question.drawing, width: 99 } } : question) }
    expect(inspectAiCapabilities(invalidDrawing)[1].available).toBe(false)
    const tooManyCriteria = { ...quiz, questions: quiz.questions.map((question) =>
      question.type === 'calculation' ? { ...question, rubric: Array.from({ length: 21 }, () => ({
        ...question.rubric[0], score: question.points / 21,
      })) } : question) }
    expect(inspectAiCapabilities(tooManyCriteria)[0].available).toBe(false)
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
    expect(suggestQuizPath(quiz, Object.keys(sources), true)).toBe('src/content/quizzes/demo/v3.quiz.md')
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
  it('clones a bundled source to a distinct manually named revision without touching the old text', () => {
    const old = demoSource
    const revised = createRevisedSource(old, 'v2', 'demo', existing)
    expect(parseQuiz(revised.source, true).revision).toBe('v2')
    expect(revised.source).toContain('current="true"')
    expect(old).toBe(demoSource)
    expect(existing.filter((item) => item.id === 'demo' && item.current).map((item) => item.revision)).toEqual(['v2-handwriting'])
    expect(validateProposedRevisionChange(existing, revised.source, 'demo').valid).toBe(true)
  })
  it('rejects missing, same, duplicate and id-changing revisions', () => {
    expect(() => createRevisedSource(demoSource, '', 'demo', existing)).toThrow('請輸入')
    expect(() => createRevisedSource(demoSource, 'v1-7d7c900e', 'demo', existing)).toThrow('不同')
    const duplicate = [...existing, { id: 'demo', revision: 'v2', current: false,
      file: 'src/content/quizzes/demo/v3.quiz.md' }]
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
  it('keeps historical parsing permissive while blocking an unscored current v3 revision', () => {
    const calculationStart = demoSource.indexOf(':::question id="q6"')
    const drawingStart = demoSource.indexOf(':::question id="q7"')
    const unscored = demoSource.slice(0, calculationStart)
      + demoSource.slice(calculationStart, drawingStart).replace(/^- \d+ \| /gm, '- | ')
      + demoSource.slice(drawingStart)
    expect(parseQuiz(unscored, true).questions.find((question) => question.id === 'q6')?.type).toBe('calculation')
    const proposal = unscored.replace('revision="v1-7d7c900e"', 'revision="v2"')
    expect(validateProposedRevisionChange(existing, proposal, 'demo')).toMatchObject({ valid: false })
    expect(validateProposedRevisionChange(existing, proposal, 'demo').errors.join(' ')).toContain('rubric')
  })

  it.each([[800, true], [1200, true], [2000, false]] as const)(
    'publishes added calculation drawing capability under v4 at %i pixels (valid=%s)', (size, valid) => {
      const textOnly = createRevisedSource(demoSource, 'v3', 'demo', existing).source
      const proposal = editQuestion(textOnly, 'q6', (block) =>
        block.replace(':::end', `:::drawing\nwidth=${size}\nheight=${size}\n:::end`))
      expect(parseQuiz(proposal, true).questions.find((question) => question.id === 'q6'))
        .toMatchObject({ type: 'calculation', drawing: { width: size, height: size } })
      expect(validateProposedRevisionChange(existing, proposal, 'demo')).toMatchObject(valid
        ? { valid: true, errors: [] }
        : { valid: false, errors: ['q6: v4 drawing config 的寬高必須為 100 至 1200 的整數。'] })
    })
})

// Replaces one question block of a source; the rest of the text is untouched.
function editQuestion(source: string, id: string, edit: (block: string) => string): string {
  const start = source.indexOf(`:::question id="${id}"`)
  const end = source.indexOf(':::end', start) + ':::end'.length
  return source.slice(0, start) + edit(source.slice(start, end)) + source.slice(end)
}
// Scores pass the shared 1e-8 sum tolerance but are not exact 8-decimal v4 scores.
const nonCanonicalRubric = (block: string) => block.replace(/^- 2 \| /m, '- 1.999999999 | ')
  .replace(/^- 2 \| (寫出)/m, '- 2.000000001 | $1')

describe('v3/v4 publication selection', () => {
  it('keeps a revision without handwriting on the v3 gate', () => {
    const v3 = parseQuiz(demoSource, true)
    expect(publicationErrors(v3)).toEqual(validateV3Publication(v3))
    // v3 tolerances that v4 would reject: a 1500px drawing question and non-canonical rubric decimals.
    const proposal = editQuestion(editQuestion(createRevisedSource(demoSource, 'v3', 'demo', existing).source,
      'q7', (block) => block.replace('width=800', 'width=1500')), 'q6', nonCanonicalRubric)
    const proposed = parseQuiz(proposal, true)
    expect(validateV3Publication(proposed)).toEqual([])
    expect(validateV4Publication(proposed)).not.toEqual([])
    expect(validateProposedRevisionChange(existing, proposal, 'demo')).toMatchObject({ valid: true, errors: [] })
    expect(inspectAiCapabilities(proposed).every((item) => item.available)).toBe(true)
  })

  it('holds a revision that declares handwriting to the v4 gate', () => {
    const v4 = parseQuiz(demoV2Source, true)
    expect(publicationErrors(v4)).toEqual(validateV4Publication(v4))
    expect(validateV3Publication(v4)).toEqual(['q6: calculation drawing capability 需要 ai-grading-v4。'])
    expect(inspectAiCapabilities(v4)).toEqual([
      { questionId: 'q6', type: 'calculation', available: true, message: '計算題 AI 自動評分可用' },
      { questionId: 'q7', type: 'drawing', available: true, message: '畫圖題 AI 自動評分可用' },
    ])
    // The whole revision's gate applies to every inspected question, including the plain drawing question.
    const wide = { ...v4, questions: v4.questions.map((question) =>
      question.type === 'drawing' ? { ...question, drawing: { width: 1500, height: 600 } } : question) }
    expect(inspectAiCapabilities(wide)[1]).toEqual({ questionId: 'q7', type: 'drawing', available: false,
      message: '畫圖題 AI 自動評分尚未符合 v4 發布條件：q7: v4 drawing config 的寬高必須為 100 至 1200 的整數。' })
  })

  it('creates the next revision from demo/v2-handwriting without removing q6 handwriting', () => {
    const revised = createRevisedSource(demoV2Source, 'v3', 'demo', existing)
    // Only the revision identity changes; no capability has to be dropped.
    expect(revised.source).toBe(demoV2Source.replace('revision="v2-handwriting"', 'revision="v3"'))
    expect(revised.quiz.questions.find((question) => question.id === 'q6'))
      .toMatchObject({ type: 'calculation', drawing: { width: 800, height: 600 } })
    expect(validateProposedRevisionChange(existing, revised.source, 'demo')).toMatchObject({ valid: true, errors: [] })
    expect(inspectAiCapabilities(revised.quiz).map((item) => item.available)).toEqual([true, true])
  })

  it.each([
    ['canvas over the v4 limit', (block: string) => block.replace('width=800', 'width=1201'),
      'q6: v4 drawing config 的寬高必須為 100 至 1200 的整數。'],
    ['unscored rubric', (block: string) => block.replace(/^- \d+ \| /gm, '- | '),
      'q6: rubric 必須有正分標準，且總分須等於題目配分。'],
    ['non-canonical rubric decimals', nonCanonicalRubric,
      'q6: v4 配分與 rubric 分數必須為最多 8 位小數，且 rubric 總分須與題目配分完全相等。'],
  ])('rejects a v4 revision with %s', (_, edit, error) => {
    const proposal = editQuestion(createRevisedSource(demoV2Source, 'v3', 'demo', existing).source, 'q6', edit)
    expect(validateProposedRevisionChange(existing, proposal, 'demo')).toMatchObject({ valid: false, errors: [error] })
    expect(() => createRevisedSource(proposal, 'v4', 'demo', existing)).toThrow(error)
    expect(inspectAiCapabilities(parseQuiz(proposal, true))[0]).toMatchObject({
      available: false, message: expect.stringContaining('v4 發布條件') })
  })

  it.each([
    ['canvas under the minimum', (block: string) => block.replace('height=600', 'height=99'), 'drawing 寬高'],
    ['canvas over the parser maximum', (block: string) => block.replace('width=800', 'width=2001'), 'drawing 寬高'],
    ['rubric total below the points', (block: string) => block.replace(/^- 2 \| /m, '- 1 | '), '分數總和'],
  ])('rejects a malformed v4 revision with %s before publication', (_, edit, error) => {
    const proposal = editQuestion(createRevisedSource(demoV2Source, 'v3', 'demo', existing).source, 'q6', edit)
    const validation = validateProposedRevisionChange(existing, proposal, 'demo')
    expect(validation).toMatchObject({ valid: false, proposed: undefined })
    expect(validation.errors).toEqual([expect.stringMatching(new RegExp(`題目 q6.*${error}`))])
  })
})
