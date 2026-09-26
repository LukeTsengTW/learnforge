import { gradeQuiz } from '../../lib/grading'
import type { AnalyticsAttempt, LearningAnalytics, ObjectiveOccurrence, ReviewItem,
  SubjectStats, TagStats, TopicSignal, QuestionTypeStats, WeeklyTrendPoint } from '../../models/analytics'
import { isObjectiveQuestion, QUESTION_TYPE, type Quiz } from '../../models/quiz'

const OBJECTIVE_TYPES = [QUESTION_TYPE.single, QUESTION_TYPE.multiple, QUESTION_TYPE.trueFalse, QUESTION_TYPE.fill] as const
const MIN_TOPIC_SAMPLE = 3
const STABLE_ACCURACY = 0.8
const PRACTICE_ACCURACY = 0.6
const TREND_WEEKS = 8

const compareKey = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const compareTime = (a: string, b: string) => Date.parse(a) - Date.parse(b) || compareKey(a, b)
const later = (a: string, b: string) => compareTime(a, b) > 0 ? a : b
const accuracy = (correct: number, incorrect: number) => correct + incorrect ? correct / (correct + incorrect) : null
const roundPoints = (value: number) => Number(value.toFixed(8))

/** Question tags win; quiz tags are used only when the question has none. A multi-tag question counts once in each tag. */
export function occurrenceTags(questionTags: string[], quizTags: string[]): string[] {
  const normalized = questionTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)
  const source = normalized.length ? normalized : quizTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)
  return [...new Set(source)].sort(compareKey)
}

export function topicSignal(answered: number, observedAccuracy: number | null): TopicSignal {
  if (answered < MIN_TOPIC_SAMPLE || observedAccuracy === null) return '資料不足'
  if (observedAccuracy >= STABLE_ACCURACY) return '表現穩定'
  if (observedAccuracy >= PRACTICE_ACCURACY) return '持續練習'
  return '需要複習'
}

function deriveOccurrences(records: AnalyticsAttempt[]) {
  const occurrences: ObjectiveOccurrence[] = []
  const validAttempts: AnalyticsAttempt[] = []
  let unavailableHistoryCount = 0, malformedAttemptCount = 0, manualQuestionSubmissions = 0
  for (const record of records) {
    if (record.status !== 'submitted') continue
    if (!record.quiz || record.unavailableReason === 'missing-revision') { unavailableHistoryCount++; continue }
    if (record.unavailableReason === 'malformed' || !record.answers || !record.submittedAt
      || !Number.isFinite(Date.parse(record.submittedAt)) || record.quiz.id !== record.quizId
      || record.quiz.revision !== record.quizRevision) { malformedAttemptCount++; continue }
    try {
      const result = gradeQuiz(record.quiz, record.answers)
      const next: ObjectiveOccurrence[] = []
      record.quiz.questions.forEach((question, questionIndex) => {
        const grade = result.questions[questionIndex]
        if (!isObjectiveQuestion(question)) return
        if (grade.status === 'manual') throw new Error('Invalid objective grade')
        next.push({ attemptId: record.id, quizId: record.quizId, quizRevision: record.quizRevision,
          questionId: question.id, subject: record.quiz!.subject, tags: occurrenceTags(question.tags, record.quiz!.tags),
          questionType: question.type, submittedAt: record.submittedAt!, status: grade.status,
          score: grade.score, maxScore: grade.maxScore, questionIndex, quiz: record.quiz!, question,
          answer: record.answers?.[question.id] })
      })
      occurrences.push(...next)
      validAttempts.push(record)
      manualQuestionSubmissions += result.manualCount
    } catch { malformedAttemptCount++ }
  }
  return { occurrences, validAttempts, unavailableHistoryCount, malformedAttemptCount, manualQuestionSubmissions }
}

export function aggregateBySubject(attempts: AnalyticsAttempt[], occurrences: ObjectiveOccurrence[]): SubjectStats[] {
  const bySubject = new Map<string, SubjectStats>()
  for (const attempt of attempts) {
    const subject = attempt.quiz!.subject
    const row = bySubject.get(subject) ?? { subject, attemptCount: 0, answeredCount: 0, correct: 0,
      incorrect: 0, unanswered: 0, accuracy: null, lastPracticedAt: attempt.submittedAt! }
    row.attemptCount++
    row.lastPracticedAt = later(row.lastPracticedAt, attempt.submittedAt!)
    bySubject.set(subject, row)
  }
  for (const item of occurrences) {
    const row = bySubject.get(item.subject)!
    row[item.status]++
    if (item.status !== 'unanswered') row.answeredCount++
  }
  return [...bySubject.values()].map((row) => ({ ...row, accuracy: accuracy(row.correct, row.incorrect) }))
    .sort((a, b) => compareTime(b.lastPracticedAt, a.lastPracticedAt) || compareKey(a.subject, b.subject))
}

export function aggregateByTag(occurrences: ObjectiveOccurrence[]): TagStats[] {
  const byTag = new Map<string, TagStats>()
  for (const item of occurrences) for (const tag of item.tags) {
    const row = byTag.get(tag) ?? { tag, sampleCount: 0, answered: 0, correct: 0, incorrect: 0,
      unanswered: 0, accuracy: null, lastSeenAt: item.submittedAt, signal: '資料不足' as TopicSignal }
    row.sampleCount++
    row[item.status]++
    if (item.status !== 'unanswered') row.answered++
    row.lastSeenAt = later(row.lastSeenAt, item.submittedAt)
    byTag.set(tag, row)
  }
  return [...byTag.values()].map((row) => {
    const observed = accuracy(row.correct, row.incorrect)
    return { ...row, accuracy: observed, signal: topicSignal(row.answered, observed) }
  }).sort((a, b) => b.sampleCount - a.sampleCount || compareKey(a.tag, b.tag))
}

export function aggregateByQuestionType(occurrences: ObjectiveOccurrence[]): QuestionTypeStats[] {
  const rows = OBJECTIVE_TYPES.map((questionType) => ({ questionType, answered: 0, correct: 0,
    incorrect: 0, unanswered: 0, accuracy: null as number | null }))
  const byType = new Map(rows.map((row) => [row.questionType, row]))
  for (const item of occurrences) {
    const row = byType.get(item.questionType)!
    row[item.status]++
    if (item.status !== 'unanswered') row.answered++
  }
  return rows.map((row) => ({ ...row, accuracy: accuracy(row.correct, row.incorrect) }))
}

function utcWeekStart(value: string): string {
  const date = new Date(value)
  const day = date.getUTCDay()
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - (day + 6) % 7))
    .toISOString().slice(0, 10)
}

/** Eight UTC Monday–Sunday weeks ending with the latest available objective submission. Empty weeks have null accuracy. */
export function buildWeeklyTrend(occurrences: ObjectiveOccurrence[]): WeeklyTrendPoint[] {
  if (!occurrences.length) return []
  const latest = occurrences.reduce((value, item) => later(value, item.submittedAt), occurrences[0].submittedAt)
  const end = Date.parse(`${utcWeekStart(latest)}T00:00:00.000Z`)
  const rows = Array.from({ length: TREND_WEEKS }, (_, index) => ({
    weekStart: new Date(end - (TREND_WEEKS - 1 - index) * 7 * 86400000).toISOString().slice(0, 10),
    answered: 0, correct: 0, accuracy: null as number | null,
  }))
  const byWeek = new Map(rows.map((row) => [row.weekStart, row]))
  for (const item of occurrences) {
    const row = byWeek.get(utcWeekStart(item.submittedAt))
    if (!row || item.status === 'unanswered') continue
    row.answered++
    if (item.status === 'correct') row.correct++
  }
  return rows.map((row) => ({ ...row, accuracy: row.answered ? row.correct / row.answered : null }))
}

/** Latest resolvable objective outcome decides queue membership. Unanswered clears a previous mistake from this queue. */
export function buildReviewQueue(occurrences: ObjectiveOccurrence[], getCurrentQuiz: (id: string) => Quiz | null): ReviewItem[] {
  const latest = new Map<string, ObjectiveOccurrence>()
  const incorrectCounts = new Map<string, number>()
  for (const item of occurrences) {
    const key = JSON.stringify([item.quizId, item.questionId])
    if (item.status === 'incorrect') incorrectCounts.set(key, (incorrectCounts.get(key) ?? 0) + 1)
    const previous = latest.get(key)
    if (!previous || Date.parse(item.submittedAt) > Date.parse(previous.submittedAt)
      || (Date.parse(item.submittedAt) === Date.parse(previous.submittedAt)
        && compareKey(item.attemptId, previous.attemptId) > 0)) latest.set(key, item)
  }
  return [...latest.entries()].filter(([, item]) => item.status === 'incorrect').map(([key, item]) => ({
    key, quizId: item.quizId, quizTitle: item.quiz.title, quizRevision: item.quizRevision,
    currentRevision: getCurrentQuiz(item.quizId)?.revision ?? null, subject: item.subject,
    questionId: item.questionId, question: item.question, questionType: item.questionType,
    tags: item.tags, incorrectCount: incorrectCounts.get(key) ?? 0, latestIncorrectAt: item.submittedAt,
    latestStudentAnswer: item.answer, quiz: item.quiz,
  })).sort((a, b) => compareTime(b.latestIncorrectAt, a.latestIncorrectAt) || compareKey(a.key, b.key))
}

/** All scores are derived from the exact bundled revision and stored student answers, never cached grade fields. */
export function buildLearningAnalytics(records: AnalyticsAttempt[], isTruncated: boolean,
  getCurrentQuiz: (id: string) => Quiz | null): LearningAnalytics {
  const { occurrences, validAttempts, unavailableHistoryCount, malformedAttemptCount,
    manualQuestionSubmissions } = deriveOccurrences(records)
  const correct = occurrences.filter((item) => item.status === 'correct').length
  const incorrect = occurrences.filter((item) => item.status === 'incorrect').length
  const unanswered = occurrences.length - correct - incorrect
  return {
    scannedAttemptCount: records.length, isTruncated,
    completedAttempts: records.filter((record) => record.status === 'submitted').length,
    excludedCount: unavailableHistoryCount + malformedAttemptCount, unavailableHistoryCount, malformedAttemptCount,
    manualQuestionSubmissions, objectiveQuestions: occurrences.length,
    answeredObjectiveQuestions: correct + incorrect, correct, incorrect, unanswered,
    answeredAccuracy: accuracy(correct, incorrect), completionRate: occurrences.length ? (correct + incorrect) / occurrences.length : null,
    objectivePointsEarned: roundPoints(occurrences.reduce((sum, item) => sum + item.score, 0)),
    objectivePointsAvailable: roundPoints(occurrences.reduce((sum, item) => sum + item.maxScore, 0)),
    subjects: aggregateBySubject(validAttempts, occurrences), tags: aggregateByTag(occurrences),
    questionTypes: aggregateByQuestionType(occurrences), weeklyTrend: buildWeeklyTrend(occurrences),
    reviewQueue: buildReviewQueue(occurrences, getCurrentQuiz),
  }
}
