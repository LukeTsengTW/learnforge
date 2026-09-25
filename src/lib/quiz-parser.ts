import {
  QUESTION_TYPE, type ChoiceOption, type DrawingConfig, type Question,
  type Quiz, type RubricCriterion,
} from '../models/quiz'

export class QuizParseError extends Error {
  readonly line: number
  readonly questionId: string | null
  constructor(message: string, line: number, questionId: string | null = null) {
    super(`第 ${line} 行${questionId ? `（題目 ${questionId}）` : ''}：${message}`)
    this.name = 'QuizParseError'
    this.line = line
    this.questionId = questionId
  }
}

interface SourceLine { text: string; line: number }
interface Block { attributes: Record<string, string>; line: number; sections: Map<string, SourceLine[]> }
const SECTION_NAMES = ['options', 'answer', 'hint', 'solution', 'rubric', 'drawing']
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/
const RESERVED_IDS = ['__proto__', 'constructor', 'prototype']
const validId = (id: string | undefined): id is string =>
  Boolean(id && ID_PATTERN.test(id) && !RESERVED_IDS.includes(id))

function parseTags(raw: string | undefined): string[] {
  if (!raw) return []
  const tags = raw.split(',').map((tag) => tag.trim().toLowerCase())
  if (tags.some((tag) => !tag || !/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(tag))) {
    throw new Error('tags 必須是以逗號分隔的非空標籤。')
  }
  return [...new Set(tags)]
}

function fail(message: string, block: Block, line = block.line): never {
  throw new QuizParseError(message, line, block.attributes.id || null)
}

function parseAttributes(source: string, line: number, allowed: string[]): Record<string, string> {
  const attributes: Record<string, string> = {}
  let rest = source.trim()
  while (rest) {
    const match = /^([a-zA-Z][\w-]*)="([^"\r\n]*)"(?:\s+|$)/.exec(rest)
    if (!match) throw new QuizParseError('屬性必須使用 key="value" 格式。', line, attributes.id)
    const [, key, value] = match
    if (!allowed.includes(key) || Object.hasOwn(attributes, key)) {
      throw new QuizParseError(`未知或重複的屬性「${key}」。`, line, attributes.id)
    }
    attributes[key] = value
    rest = rest.slice(match[0].length).trim()
  }
  return attributes
}

function sectionText(block: Block, name: string, required = false): string {
  const text = (block.sections.get(name) ?? []).map((line) => line.text).join('\n').trim()
  if (required && !text) fail(`缺少或空白的 ${name} 區塊。`, block)
  return text
}

function parseOptions(block: Block): { options: ChoiceOption[]; correct: string[] } {
  const options: ChoiceOption[] = []
  const correct: string[] = []
  for (const { text, line } of block.sections.get('options') ?? []) {
    if (!text.trim()) {
      if (options.length) options[options.length - 1].content += '\n'
      continue
    }
    const match = /^- \[([ xX])\] ([a-zA-Z0-9][\w-]*) \| (.+)$/.exec(text)
    if (match) {
      const [, checked, id, content] = match
      if (!validId(id) || options.some((option) => option.id === id)) fail('選項 id 無效或重複。', block, line)
      if (!content.trim()) fail('選項不可空白。', block, line)
      options.push({ id, content: content.trim() })
      if (checked.toLowerCase() === 'x') correct.push(id)
    } else if (/^ {2}/.test(text) && options.length) {
      options[options.length - 1].content += `\n${text.slice(2)}`
    } else {
      fail('選項格式應為 - [x] id | Markdown；續行需縮排兩個空格。', block, line)
    }
  }
  if (options.length < 2) fail('選擇題至少需要兩個選項。', block)
  return { options: options.map((option) => ({ ...option, content: option.content.trim() })), correct }
}

function parseRubric(block: Block, points: number): RubricCriterion[] {
  const rubric: RubricCriterion[] = []
  if (block.sections.has('rubric')) sectionText(block, 'rubric', true)
  for (const { text, line } of block.sections.get('rubric') ?? []) {
    if (!text.trim()) continue
    const match = /^-\s*(\d+(?:\.\d+)?)?\s*\|\s*(.+)$/.exec(text)
    if (!match || !match[2].trim()) fail('rubric 格式應為 - 分數 | 說明，或 - | 說明。', block, line)
    rubric.push({ score: match[1] === undefined ? null : Number(match[1]), description: match[2].trim() })
  }
  const scored = rubric.filter((criterion) => criterion.score !== null)
  if (scored.length && (scored.length !== rubric.length
    || Math.abs(scored.reduce((sum, item) => sum + (item.score ?? 0), 0) - points) > 1e-8)) {
    fail('rubric 必須全部有分數或全部無分數；分數總和必須等於題目 points。', block)
  }
  return rubric
}

function parseDrawing(block: Block): DrawingConfig {
  sectionText(block, 'drawing', true)
  const values: Record<string, number> = {}
  for (const { text, line } of block.sections.get('drawing') ?? []) {
    if (!text.trim()) continue
    const match = /^(width|height)=(\d+)$/.exec(text.trim())
    if (!match || Object.hasOwn(values, match[1])) fail('drawing 只接受不重複的 width=整數 與 height=整數。', block, line)
    const value = Number(match[2])
    if (!Number.isInteger(value) || value < 100 || value > 2000) fail('drawing 寬高須為 100 到 2000 的整數。', block, line)
    values[match[1]] = value
  }
  if (!values.width || !values.height) fail('drawing 必須同時指定 width 與 height。', block)
  return { width: values.width, height: values.height }
}

function toQuestion(block: Block): Question {
  const { id, type, points: rawPoints, match } = block.attributes
  if (!validId(id)) fail('缺少或無效的 question id。', block)
  if (!Object.values(QUESTION_TYPE).some((known) => known === type)) fail(`未知題型「${type ?? ''}」。`, block)
  if (!rawPoints || !/^\d+(?:\.\d+)?$/.test(rawPoints) || !Number.isFinite(Number(rawPoints)) || Number(rawPoints) <= 0) {
    fail('points 必須是大於 0 的有限數字。', block)
  }
  const points = Number(rawPoints)
  let tags: string[]
  try { tags = parseTags(block.attributes.tags) } catch { return fail('tags 格式無效。', block) }
  const common = { id, tags, points, prompt: sectionText(block, 'prompt', true),
    hint: sectionText(block, 'hint') || null, solution: sectionText(block, 'solution', true),
    rubric: parseRubric(block, points) }
  const allowed = new Set(['prompt', 'solution', 'hint', 'rubric'])
  const choice = type === QUESTION_TYPE.single || type === QUESTION_TYPE.multiple
  allowed.add(choice ? 'options' : 'answer')
  if (type === QUESTION_TYPE.drawing) allowed.add('drawing')
  for (const section of block.sections.keys()) if (!allowed.has(section)) fail(`${type} 題型不接受 ${section} 區塊。`, block)
  if (match !== undefined && type !== QUESTION_TYPE.fill) fail('match 屬性只適用於填空題。', block)
  switch (type) {
    case QUESTION_TYPE.single: {
      const { options, correct } = parseOptions(block)
      if (correct.length !== 1) fail('單選題必須恰好有一個正確答案。', block)
      return { ...common, type, options, correctOptionId: correct[0] }
    }
    case QUESTION_TYPE.multiple: {
      const { options, correct } = parseOptions(block)
      if (!correct.length) fail('多選題至少需要一個正確答案。', block)
      return { ...common, type, options, correctOptionIds: correct }
    }
    case QUESTION_TYPE.trueFalse: {
      const answer = sectionText(block, 'answer', true)
      if (answer !== 'true' && answer !== 'false') fail('是非題 answer 必須是 true 或 false。', block)
      return { ...common, type, correctAnswer: answer === 'true' }
    }
    case QUESTION_TYPE.fill:
      if (match !== 'exact' && match !== 'case-insensitive') fail('填空題需指定 match="exact" 或 "case-insensitive"。', block)
      if (sectionText(block, 'answer', true).includes('\n')) fail('填空題 answer 必須是單行文字。', block)
      return { ...common, type, match, correctAnswer: sectionText(block, 'answer', true) }
    case QUESTION_TYPE.calculation:
      return { ...common, type, referenceAnswer: sectionText(block, 'answer', true) }
    case QUESTION_TYPE.drawing:
      return { ...common, type, referenceAnswer: sectionText(block, 'answer', true), drawing: parseDrawing(block) }
    default: return fail('未知題型。', block)
  }
}

function sourceRevision(source: string): string {
  let hash = 2166136261
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619)
  return `v1-${(hash >>> 0).toString(16)}`
}

/** Pure line-aware parser. Directives inside fenced code are ordinary Markdown. */
export function parseQuiz(raw: string, requireCatalogMetadata = false): Quiz {
  const source = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const lines = source.split('\n')
  const header: SourceLine[] = []
  const questions: Question[] = []
  let block: Block | null = null
  let section = 'prompt'
  let fence: { char: string; length: number; line: number } | null = null
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index]
    const line = index + 1
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text)
    const insideFence = fence !== null
    if (marker) {
      if (!fence) fence = { char: marker[1][0], length: marker[1].length, line }
      else if (marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null
    }
    if (!insideFence && !marker && text.startsWith(':::')) {
      if (/^:::question(?:\s|$)/.test(text)) {
        if (block) fail('上一題缺少 :::end。', block, line)
        block = { line, attributes: parseAttributes(text.slice(':::question'.length), line, ['id', 'type', 'points', 'match', 'tags']), sections: new Map([['prompt', []]]) }
        section = 'prompt'
      } else if (text === ':::end') {
        if (!block) throw new QuizParseError(':::end 前沒有 question。', line)
        const question = toQuestion(block)
        if (questions.some((existing) => existing.id === question.id)) fail('重複的 question id。', block)
        questions.push(question)
        block = null
      } else {
        const name = text.slice(3)
        if (!block || !SECTION_NAMES.includes(name)) throw new QuizParseError(`未知或位置錯誤的區塊「${text}」。`, line, block?.attributes.id)
        if (block.sections.has(name)) fail(`重複的 ${name} 區塊。`, block, line)
        section = name
        block.sections.set(section, [])
      }
    } else if (block) {
      block.sections.get(section)!.push({ text, line })
    } else if (questions.length) {
      if (text.trim()) throw new QuizParseError('題目之間只允許空白行。', line)
    } else {
      header.push({ text, line })
    }
  }
  if (fence) throw new QuizParseError('Markdown code fence 未關閉。', fence.line, block?.attributes.id)
  if (block) fail('題目缺少 :::end。', block)
  const nonempty = header.filter((item) => item.text.trim())
  const meta = nonempty[0]
  if (!meta || !meta.text.startsWith('@quiz ')) throw new QuizParseError('第一個非空白行必須是 @quiz id="quiz-id"。', meta?.line ?? 1)
  const { id, revision, subject, tags: rawTags, estimatedMinutes: rawMinutes, current } = parseAttributes(meta.text.slice(6), meta.line,
    ['id', 'revision', 'subject', 'tags', 'estimatedMinutes', 'current'])
  if (!validId(id)) throw new QuizParseError('缺少或無效的 quiz id。', meta.line)
  if (requireCatalogMetadata && (!revision || !subject || !rawTags || !rawMinutes || !current)) {
    throw new QuizParseError('缺少必要題庫 metadata：revision、subject、tags、estimatedMinutes 或 current。', meta.line)
  }
  if (revision !== undefined && !validId(revision)) throw new QuizParseError('revision 無效。', meta.line)
  if (subject !== undefined && !subject.trim()) throw new QuizParseError('subject 不可空白。', meta.line)
  if (rawMinutes !== undefined && (!/^[1-9]\d*$/.test(rawMinutes) || !Number.isSafeInteger(Number(rawMinutes)))) {
    throw new QuizParseError('estimatedMinutes 必須是正整數。', meta.line)
  }
  if (current !== undefined && current !== 'true' && current !== 'false') throw new QuizParseError('current 必須是 true 或 false。', meta.line)
  let tags: string[]
  try { tags = parseTags(rawTags) } catch { throw new QuizParseError('tags 格式無效。', meta.line) }
  const title = nonempty[1]
  if (!title || !/^#\s+\S/.test(title.text)) throw new QuizParseError('quiz metadata 之後必須有 # 測驗標題。', title?.line ?? meta.line + 1)
  if (!questions.length) throw new QuizParseError('測驗至少需要一題。', lines.length)
  return { id, title: title.text.replace(/^#\s+/, '').trim(),
    description: header.filter((item) => item.line > title.line).map((item) => item.text).join('\n').trim(),
    subject: subject?.trim() ?? '一般', tags, estimatedMinutes: rawMinutes ? Number(rawMinutes) : 1,
    current: current === undefined || current === 'true', revision: revision ?? sourceRevision(source), questions }
}
