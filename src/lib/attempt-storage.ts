import type { AnswerMap, QuestionAnswer, QuizAttempt } from '../models/attempt'
import { DRAWING_COLORS, type DrawingStroke } from '../models/drawing'
import { QUESTION_TYPE, type Question, type Quiz } from '../models/quiz'
import { createAttempt } from './attempt'
import { gradeQuiz } from './grading'

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export interface LoadedAttempt { attempt: QuizAttempt; notice: string | null }
export const attemptKey = (quizId: string): string => `learnforge:attempt:v1:${quizId}`
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function validStroke(value: unknown, question: Extract<Question, { type: 'drawing' }>): value is DrawingStroke {
  if (!isRecord(value) || (value.tool !== 'pen' && value.tool !== 'eraser')
    || !DRAWING_COLORS.some((color) => color === value.color)
    || !finite(value.width) || value.width < 1 || value.width > 40 || !Array.isArray(value.points)
    || value.points.length === 0 || value.points.length > 100000) return false
  return value.points.every((point: unknown) => isRecord(point) && finite(point.x) && finite(point.y)
    && point.x >= 0 && point.x <= question.drawing.width && point.y >= 0 && point.y <= question.drawing.height)
}

function validAnswer(value: unknown, question: Question): value is QuestionAnswer {
  if (!isRecord(value) || value.type !== question.type) return false
  switch (question.type) {
    case QUESTION_TYPE.single: return typeof value.optionId === 'string' && question.options.some((option) => option.id === value.optionId)
    case QUESTION_TYPE.multiple: return Array.isArray(value.optionIds)
      && new Set(value.optionIds).size === value.optionIds.length
      && value.optionIds.every((id: unknown) => typeof id === 'string' && question.options.some((option) => option.id === id))
    case QUESTION_TYPE.trueFalse: return typeof value.value === 'boolean'
    case QUESTION_TYPE.fill:
    case QUESTION_TYPE.calculation: return typeof value.text === 'string' && value.text.length <= 100000
    case QUESTION_TYPE.drawing: return Array.isArray(value.strokes) && value.strokes.length <= 10000
      && value.strokes.every((stroke: unknown) => validStroke(stroke, question))
  }
}

/** Unknown local data is validated before becoming domain state. Scores are rederived. */
export function decodeAttempt(raw: string, quiz: Quiz): QuizAttempt | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || value.schemaVersion !== 1 || value.quizId !== quiz.id || value.quizRevision !== quiz.revision
      || !validDate(value.startedAt) || !validDate(value.updatedAt) || !isRecord(value.answers)
      || (value.status !== 'in-progress' && value.status !== 'submitted')) return null
    const answers: AnswerMap = {}
    for (const [id, answer] of Object.entries(value.answers)) {
      const question = quiz.questions.find((item) => item.id === id)
      if (!question || !validAnswer(answer, question)) return null
      answers[id] = answer
    }
    const base = { schemaVersion: 1 as const, quizId: quiz.id, quizRevision: quiz.revision,
      startedAt: value.startedAt, updatedAt: value.updatedAt, answers }
    if (value.status === 'in-progress') return { ...base, status: 'in-progress' }
    if (!validDate(value.submittedAt)) return null
    return { ...base, status: 'submitted', submittedAt: value.submittedAt, result: gradeQuiz(quiz, answers) }
  } catch { return null }
}

function browserStorage(): StoragePort { return window.localStorage }

export function loadAttempt(quiz: Quiz, now: string, storage?: StoragePort): LoadedAttempt {
  const empty = createAttempt(quiz, now)
  try {
    const raw = (storage ?? browserStorage()).getItem(attemptKey(quiz.id))
    if (raw === null) return { attempt: empty, notice: null }
    const attempt = decodeAttempt(raw, quiz)
    return attempt ? { attempt, notice: null } : { attempt: empty,
      notice: '儲存的進度格式不符或題目已更新，已開啟新的測驗。' }
  } catch {
    return { attempt: empty, notice: '無法讀取本機進度。你仍可作答，但請勿重新整理或關閉此頁。' }
  }
}

export function saveAttempt(attempt: QuizAttempt, storage?: StoragePort): string | null {
  try {
    const target = storage ?? browserStorage()
    // A fresh/restarted quiz leaves no previous attempt behind.
    if (attempt.status === 'in-progress' && !Object.keys(attempt.answers).length) target.removeItem(attemptKey(attempt.quizId))
    else target.setItem(attemptKey(attempt.quizId), JSON.stringify(attempt))
    return null
  } catch {
    return '無法儲存本機進度（儲存空間已滿或瀏覽器禁止存取）。本次仍可作答，請勿重新整理或關閉此頁。'
  }
}
