import { describe, expect, it } from 'vitest'
import { decodeQuizDraftV4, upgradeLegacyQuizDraftV4 } from './draft-v4'
import { createAttempt } from './attempt'
import { decodeAttempt } from './attempt-storage'
import { gradeQuiz } from './grading'
import type { QuizAttempt } from '../models/attempt'
import type { Quiz } from '../models/quiz'
import { quizCatalog } from '../features/quiz/quiz-loader'

// The text-only historical revision; `future` below is a synthetic capable copy of it.
const quiz = quizCatalog.getQuizRevision('demo', 'v1-7d7c900e')!
const future: Quiz = { ...quiz, revision: 'future-v4', questions: quiz.questions.map((question) =>
  question.type === 'calculation' ? { ...question, drawing: { width: 800, height: 600 } } : question) }
const now = '2026-10-01T10:00:00.123456Z'
const stroke = { tool: 'pen' as const, color: '#202b38' as const, width: 4, points: [{ x: 100, y: 100 }] }
const calculation = { type: 'calculation' as const, mode: 'text' as const, text: '  $x = 3$\n\n', strokes: [] }
const base = { schemaVersion: 2, quizId: quiz.id, quizRevision: quiz.revision,
  status: 'in-progress', startedAt: now, updatedAt: now, answers: { q6: calculation } }

describe('strict future draft decoder', () => {
  it('accepts text-only calculation for its exact revision and preserves text bytes', () => {
    expect(decodeQuizDraftV4(JSON.stringify(base), quiz)).toEqual(base)
  })

  it.each(['text', 'drawing'] as const)('keeps both valid buffers in capable %s mode', (mode) => {
    const value = { ...base, quizRevision: future.revision,
      answers: { q6: { ...calculation, mode, strokes: [stroke] } } }
    const decoded = decodeQuizDraftV4(JSON.stringify(value), future)!
    expect(decoded).toEqual(value)
    expect(decoded.answers.q6).not.toBe(value.answers.q6)
  })
  it.each(['text', 'drawing'] as const)('preserves width-100 erasers in %s mode and DrawingQuestion drafts', (mode) => {
    const eraser = { ...stroke, tool: 'eraser' as const, width: 100 }
    const value = { ...base, quizRevision: future.revision, answers: {
      q6: { ...calculation, mode, strokes: [eraser] }, q7: { type: 'drawing', strokes: [eraser] },
    } }
    expect(decodeQuizDraftV4(JSON.stringify(value), future)).toEqual(value)
    expect(decodeQuizDraftV4(JSON.stringify({ ...value, answers: {
      ...value.answers, q6: { ...value.answers.q6, strokes: [{ ...eraser, width: 101 }] },
    } }), future)).toBeNull()
    expect(decodeQuizDraftV4(JSON.stringify({ ...value, answers: {
      ...value.answers, q7: { type: 'drawing', strokes: [{ ...eraser, width: 101 }] },
    } }), future)).toBeNull()
  })

  it.each([
    { type: 'calculation', text: 'legacy' },
    { ...calculation, mode: 'drawing' },
    { ...calculation, strokes: [stroke] },
    { ...calculation, mode: 'invalid' },
    { ...calculation, score: 6 },
    { ...calculation, text: 'x'.repeat(100001) },
  ])('rejects malformed/incompatible schema-2 calculation without repair', (answer) => {
    expect(decodeQuizDraftV4(JSON.stringify({ ...base, answers: { q6: answer } }), quiz)).toBeNull()
  })

  it('rejects invalid inactive geometry even in text mode', () => {
    const value = { ...base, quizRevision: future.revision, answers: {
      q6: { ...calculation, strokes: [{ ...stroke, points: [{ x: 801, y: 100 }] }] },
    } }
    expect(decodeQuizDraftV4(JSON.stringify(value), future)).toBeNull()
  })

  it.each([
    { ...base, schemaVersion: 1 }, { ...base, status: 'submitted' }, { ...base, quizRevision: 'missing' },
    { ...base, quizId: 'foreign' }, { ...base, result: {} }, { ...base, startedAt: '2026-02-30T10:00:00Z' },
    { ...base, answers: { unknown: calculation } }, { ...base, answers: { q6: { type: 'fill', text: 'x' } } },
  ])('rejects wrong identity, historical submission and extra/invalid fields', (value) => {
    expect(decodeQuizDraftV4(JSON.stringify(value), quiz)).toBeNull()
  })

  it('does not fall back from an old text-only revision to the capable revision', () => {
    const raw = JSON.stringify({ ...base, answers: { q6: { ...calculation, mode: 'drawing', strokes: [stroke] } } })
    expect(decodeQuizDraftV4(raw, quiz)).toBeNull()
    expect(decodeQuizDraftV4(raw, future)).toBeNull()
  })
})

describe('pure legacy draft promotion', () => {
  it('normalizes only legacy calculations and deep-copies all retained answer content', () => {
    const legacy: QuizAttempt = { ...createAttempt(future, now), answers: {
      q1: { type: 'single', optionId: 'a' }, q2: { type: 'single', optionId: 'b' },
      q3: { type: 'multiple', optionIds: ['b', 'c', 'd'] }, q4: { type: 'true-false', value: true },
      q5: { type: 'fill', text: '  XOR\n' },
      q6: { type: 'calculation', text: calculation.text }, q7: { type: 'drawing', strokes: [stroke] },
    } }
    const before = JSON.stringify(legacy), upgraded = upgradeLegacyQuizDraftV4(legacy, future)!
    expect(upgraded).toEqual({ ...legacy, schemaVersion: 2, answers: {
      ...legacy.answers, q6: { ...calculation, strokes: [] },
    } })
    expect(upgraded.answers.q2).not.toBe(legacy.answers.q2)
    expect(upgraded.answers.q7).not.toBe(legacy.answers.q7)
    if (upgraded.answers.q7.type === 'drawing') upgraded.answers.q7.strokes[0].points[0].x = 200
    expect(JSON.stringify(legacy)).toBe(before)
  })

  it('keeps existing schema-1 text-only drafts readable and unchanged by reading/upgrading', () => {
    const legacy: QuizAttempt = { ...createAttempt(quiz, now), answers: { q6: { type: 'calculation', text: calculation.text } } }
    const raw = JSON.stringify(legacy)
    expect(decodeAttempt(raw, quiz)).toEqual(legacy)
    expect(upgradeLegacyQuizDraftV4(legacy, quiz)?.answers.q6).toEqual(calculation)
    expect(JSON.stringify(legacy)).toBe(raw)
  })

  it('never upgrades submitted historical attempts', () => {
    const submitted: QuizAttempt = { schemaVersion: 1, quizId: quiz.id, quizRevision: quiz.revision,
      status: 'submitted', startedAt: now, updatedAt: now, submittedAt: now, answers: {}, result: gradeQuiz(quiz, {}) }
    const raw = JSON.stringify(submitted)
    expect(upgradeLegacyQuizDraftV4(submitted, quiz)).toBeNull()
    expect(decodeAttempt(raw, quiz)?.status).toBe('submitted')
    expect(JSON.stringify(submitted)).toBe(raw)
  })

  it('refuses exact-revision mismatch and malformed hybrid legacy data', () => {
    const legacy = { ...createAttempt(quiz, now), answers: { q6: { ...calculation } } }
    // A hybrid schema-1 object must not be accepted as a legacy calculation merely by reading it.
    expect(upgradeLegacyQuizDraftV4(legacy as unknown as QuizAttempt, quiz)).toBeNull()
    expect(upgradeLegacyQuizDraftV4(createAttempt(quiz, now), future)).toBeNull()
  })
})
