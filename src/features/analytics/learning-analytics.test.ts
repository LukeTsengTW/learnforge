import { describe, expect, it } from 'vitest'
import type { AnalyticsAttempt } from '../../models/analytics'
import type { QuestionAnswer } from '../../models/attempt'
import { QUESTION_TYPE, type Question, type Quiz, type SingleChoiceQuestion } from '../../models/quiz'
import { aggregateByTag, buildLearningAnalytics, buildReviewQueue, buildWeeklyTrend,
  occurrenceTags, topicSignal } from './learning-analytics'

const single = (id: string, correctOptionId = 'a', tags: string[] = []): SingleChoiceQuestion => ({
  id, type: QUESTION_TYPE.single, tags, points: 2, prompt: `Question ${id}`, hint: null,
  solution: 'Because A.', rubric: [], options: [{ id: 'a', content: 'A' }, { id: 'b', content: 'B' }], correctOptionId,
})
const quiz = (id = 'quiz-a', revision = 'v1', subject = 'Math', questions: Question[] = [single('q1')],
  tags: string[] = ['quiz-tag']): Quiz => ({ id, revision, subject, questions, tags, title: id,
    description: '', estimatedMinutes: 10, current: true })
const answer = (optionId: string): QuestionAnswer => ({ type: 'single', optionId })
const submitted = (source: Quiz, id: string, submittedAt: string, answers: Record<string, QuestionAnswer> = {}): AnalyticsAttempt => ({
  id, quizId: source.id, quizRevision: source.revision, submittedAt, status: 'submitted', quiz: source, answers,
})
const current = (source: Quiz) => (id: string) => id === source.id ? source : null
const monday = '2026-09-21T00:00:00.000Z'

describe('learning analytics from exact historical revisions', () => {
  it('keeps empty data empty instead of showing false zero accuracy', () => {
    const result = buildLearningAnalytics([], false, () => null)
    expect(result).toMatchObject({ completedAttempts: 0, objectiveQuestions: 0, answeredAccuracy: null,
      completionRate: null, reviewQueue: [], weeklyTrend: [] })
  })
  it('separates correct, incorrect and unanswered denominators and objective points', () => {
    const source = quiz('q', 'v1', 'Math', Array.from({ length: 6 }, (_, i) => single(`q${i + 1}`)))
    const record = submitted(source, 'a1', monday, { q1: answer('a'), q2: answer('a'), q3: answer('a'), q4: answer('b') })
    const result = buildLearningAnalytics([record], false, current(source))
    expect(result).toMatchObject({ correct: 3, incorrect: 1, unanswered: 2, objectiveQuestions: 6,
      answeredObjectiveQuestions: 4, answeredAccuracy: 0.75, completionRate: 4 / 6,
      objectivePointsEarned: 6, objectivePointsAvailable: 12 })
  })
  it('excludes manual and AI advisory grades from objective performance', () => {
    const source = quiz('q', 'v1', 'Math', [single('q1'), {
      id: 'calc', type: QUESTION_TYPE.calculation, tags: [], points: 50, prompt: 'Calculate', hint: null,
      solution: 'x', rubric: [], referenceAnswer: 'x',
    }, { id: 'draw', type: QUESTION_TYPE.drawing, tags: [], points: 50, prompt: 'Draw', hint: null,
      solution: 'shape', rubric: [], referenceAnswer: 'shape', drawing: { width: 100, height: 100 } }])
    const result = buildLearningAnalytics([submitted(source, 'a1', monday, { q1: answer('a'),
      calc: { type: 'calculation', text: 'x' }, draw: { type: 'drawing', strokes: [] } })], false, current(source))
    expect(result).toMatchObject({ objectiveQuestions: 1, correct: 1, objectivePointsAvailable: 2,
      manualQuestionSubmissions: 2, answeredAccuracy: 1 })
    expect(result.questionTypes).toHaveLength(4)
  })
  it('excludes missing revisions and malformed rows while preserving completed count', () => {
    const source = quiz()
    const missing = { ...submitted(source, 'lost', monday), quiz: null, answers: null,
      unavailableReason: 'missing-revision' as const }
    const malformed = { ...submitted(source, 'bad', monday), answers: null, unavailableReason: 'malformed' as const }
    const draft = { ...submitted(source, 'draft', monday), status: 'draft' as const }
    const result = buildLearningAnalytics([submitted(source, 'good', monday, { q1: answer('a') }), missing, malformed, draft], true, current(source))
    expect(result).toMatchObject({ scannedAttemptCount: 4, completedAttempts: 3, excludedCount: 2,
      unavailableHistoryCount: 1, malformedAttemptCount: 1, objectiveQuestions: 1, isTruncated: true })
  })
  it('uses exact historical answer key even when the current revision has changed', () => {
    const oldQuiz = quiz('q', 'v1', 'Math', [single('q1', 'a')])
    const newQuiz = quiz('q', 'v2', 'Math', [single('q1', 'b')])
    const result = buildLearningAnalytics([submitted(oldQuiz, 'a1', monday, { q1: answer('a') })], false, current(newQuiz))
    expect(result.correct).toBe(1)
    expect(result.reviewQueue).toHaveLength(0)
  })
  it('aggregates separate quizzes and subjects without collapsing occurrences', () => {
    const a = quiz('a', 'v1', 'Math', [single('q1')])
    const b = quiz('b', 'v1', 'Science', [single('q1')])
    const result = buildLearningAnalytics([submitted(a, 'a1', monday, { q1: answer('a') }),
      submitted(b, 'b1', '2026-09-22T00:00:00Z', { q1: answer('b') })], false, () => null)
    expect(result.subjects.map((row) => [row.subject, row.attemptCount, row.accuracy])).toEqual([
      ['Science', 1, 0], ['Math', 1, 1],
    ])
    expect(result.reviewQueue).toHaveLength(1)
    expect(result.reviewQueue[0].quizId).toBe('b')
  })
})

describe('topic labels and multi-label tags', () => {
  it('prefers normalized, deduplicated question tags and falls back to quiz tags', () => {
    expect(occurrenceTags(['Algebra', ' algebra ', 'Logic'], ['fallback'])).toEqual(['algebra', 'logic'])
    expect(occurrenceTags([], ['Fallback', 'fallback'])).toEqual(['fallback'])
    expect(occurrenceTags([' '], ['Fallback'])).toEqual(['fallback'])
  })
  it('counts one occurrence in each tag and exposes both sample and answered counts', () => {
    const source = quiz('a', 'v1', 'Math', [single('q1', 'a', ['Algebra', 'logic', 'algebra']), single('q2')])
    const result = buildLearningAnalytics([submitted(source, 'a1', monday, { q1: answer('a') })], false, current(source))
    expect(result.tags.map((row) => [row.tag, row.sampleCount, row.answered, row.correct, row.unanswered])).toEqual([
      ['algebra', 1, 1, 1, 0], ['logic', 1, 1, 1, 0], ['quiz-tag', 1, 0, 0, 1],
    ])
    expect(result.tags[0].signal).toBe('資料不足')
  })
  it('applies only the documented sample thresholds', () => {
    expect(topicSignal(2, 1)).toBe('資料不足')
    expect(topicSignal(3, 0.8)).toBe('表現穩定')
    expect(topicSignal(3, 0.6)).toBe('持續練習')
    expect(topicSignal(3, 0.59)).toBe('需要複習')
    expect(aggregateByTag([])).toEqual([])
  })
})

describe('UTC weekly trend', () => {
  it('aggregates the same week, keeps empty weeks as null, and orders oldest to newest', () => {
    const source = quiz()
    const result = buildLearningAnalytics([
      submitted(source, 'a1', '2026-09-06T23:59:59Z', { q1: answer('a') }),
      submitted(source, 'a2', '2026-09-07T00:00:00Z', { q1: answer('b') }),
      submitted(source, 'a3', '2026-09-08T00:00:00Z', { q1: answer('a') }),
      submitted(source, 'a4', monday, {}),
    ], false, current(source))
    const trend = result.weeklyTrend
    expect(trend).toHaveLength(8)
    expect(trend.map((row) => row.weekStart)).toEqual([...trend.map((row) => row.weekStart)].sort())
    expect(trend.find((row) => row.weekStart === '2026-09-07')).toMatchObject({ answered: 2, correct: 1, accuracy: 0.5 })
    expect(trend.find((row) => row.weekStart === '2026-09-14')).toMatchObject({ answered: 0, accuracy: null })
    expect(trend.find((row) => row.weekStart === '2026-09-21')).toMatchObject({ answered: 0, accuracy: null })
    expect(buildWeeklyTrend([])).toEqual([])
  })
})

describe('review queue latest outcome', () => {
  const source = quiz('quiz-a', 'v1', 'Math', [single('q1'), single('q2')])
  const records = (first: QuestionAnswer | undefined, second: QuestionAnswer | undefined, third?: QuestionAnswer) => [
    submitted(source, 'a1', '2026-09-01T00:00:00Z', first ? { q1: first } : {}),
    submitted(source, 'a2', '2026-09-02T00:00:00Z', second ? { q1: second } : {}),
    ...(third ? [submitted(source, 'a3', '2026-09-03T00:00:00Z', { q1: third })] : []),
  ]
  it('includes one incorrect outcome and deduplicates repeated mistakes', () => {
    const result = buildLearningAnalytics(records(answer('b'), answer('b')), false, current(source))
    expect(result.reviewQueue).toHaveLength(1)
    expect(result.reviewQueue[0]).toMatchObject({ incorrectCount: 2, quizRevision: 'v1', latestStudentAnswer: answer('b') })
  })
  it('removes incorrect then correct, but includes correct then incorrect', () => {
    expect(buildLearningAnalytics(records(answer('b'), answer('a')), false, current(source)).reviewQueue).toHaveLength(0)
    expect(buildLearningAnalytics(records(answer('a'), answer('b')), false, current(source)).reviewQueue).toHaveLength(1)
  })
  it('treats latest unanswered as outside the wrong-answer queue', () => {
    expect(buildLearningAnalytics(records(answer('b'), undefined), false, current(source)).reviewQueue).toHaveLength(0)
  })
  it('keeps same-quiz different questions separate and historical revision intact', () => {
    const oldQuiz = quiz('quiz-a', 'v0', 'Math', [single('q1'), single('q2')])
    const result = buildLearningAnalytics([submitted(oldQuiz, 'a1', monday, { q1: answer('b'), q2: answer('b') })], false, current(source))
    expect(result.reviewQueue).toHaveLength(2)
    expect(result.reviewQueue.map((item) => item.questionId)).toEqual(['q1', 'q2'])
    expect(result.reviewQueue[0]).toMatchObject({ quizRevision: 'v0', currentRevision: 'v1' })
  })
  it('excludes missing revisions without falling back to current question', () => {
    const lost = { ...submitted(source, 'lost', monday, { q1: answer('b') }), quiz: null, answers: null }
    const result = buildLearningAnalytics([lost], false, current(source))
    expect(result.reviewQueue).toEqual([])
    expect(result.unavailableHistoryCount).toBe(1)
  })
  it('runs a 500-attempt synthetic scan without per-attempt full-history rescans', () => {
    const many = Array.from({ length: 500 }, (_, i) => submitted(source, `a${i}`, new Date(Date.parse(monday) + i * 1000).toISOString(),
      { q1: answer(i % 2 ? 'a' : 'b') }))
    const result = buildLearningAnalytics(many, true, current(source))
    expect(result).toMatchObject({ scannedAttemptCount: 500, objectiveQuestions: 1000, reviewQueue: expect.any(Array) })
    expect(result.reviewQueue).toHaveLength(0)
    expect(buildReviewQueue([], current(source))).toEqual([])
  })
})
