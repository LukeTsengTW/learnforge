import { describe, expect, it } from 'vitest'
import { quizCatalog } from '../features/quiz/quiz-loader'
import { mapAnalyticsRecord, mapPracticeRecord } from '../features/quiz/practice-repository'
import { deriveMistakes } from '../features/quiz/practice-history'
import { buildLearningAnalytics } from '../features/analytics/learning-analytics'
import { gradeQuiz, gradeQuizWithFillJudgments } from './grading'
import { answerHash, gradeOfficialSubmission, type FillJudgment,
  type NormalizedAnswers } from '../../supabase/functions/_shared/semantic-fill'
import { tutorContext } from '../../supabase/functions/_shared/ai-tutor'
import type { AnswerMap, TrustedFillJudgment } from '../models/attempt'
import type { Database } from '../types/database.types'

const quiz = quizCatalog.getCurrentQuiz('demo')!
const now = '2026-09-28T01:00:00.000Z'
const id = '00000000-0000-4000-8000-000000000099'
type AttemptRow = Database['public']['Tables']['attempts']['Row']
type AnswerRow = Database['public']['Tables']['answers']['Row']
type JudgmentRow = Database['public']['Tables']['fill_judgments']['Row']
const answer: AnswerRow = { id: crypto.randomUUID(), attempt_id: id, user_id: 'student',
  question_id: 'q5', answer: { type: 'fill', text: 'Exclusive OR' }, grade: null, created_at: now, updated_at: now }
const row: AttemptRow = {
  id, user_id: 'student', quiz_id: quiz.id, quiz_revision: quiz.revision,
  status: 'submitted', started_at: now, client_updated_at: now, submitted_at: now,
  grading_version: 'semantic-fill-v2', submission_request_id: crypto.randomUUID(),
  deterministic_score: 2, deterministic_max_score: 10, correct_count: 1, partial_count: 0,
  incorrect_count: 0, unanswered_count: 4, created_at: now, updated_at: now,
}
async function judgment(status: 'correct' | 'incorrect'): Promise<JudgmentRow> {
  return { id: crypto.randomUUID(), user_id: 'student', attempt_id: id,
    quiz_id: quiz.id, quiz_revision: quiz.revision, question_id: 'q5',
    answer_hash: await answerHash('Exclusive OR'), judge_version: 'semantic-fill-v2',
    source: 'ai', status, model: 'gpt-6-luna', reasoning_effort: 'medium',
    confidence: 'medium', reason: status === 'correct' ? '語意相同。' : '語意不符。',
    created_at: now, finalized_at: now }
}

describe('versioned official grading on every historical read path', () => {
  it('keeps server grading aligned with pure grading for every current quiz', () => {
    for (const { quiz: current } of quizCatalog.current) {
      const answers: AnswerMap = {}
      const serverJudgments: FillJudgment[] = []
      const trusted: TrustedFillJudgment[] = []
      for (const question of current.questions) {
        if (question.type === 'single') answers[question.id] = { type: 'single', optionId: question.correctOptionId }
        if (question.type === 'multiple') answers[question.id] = { type: 'multiple', optionIds: question.correctOptionIds }
        if (question.type === 'true-false') answers[question.id] = { type: 'true-false', value: question.correctAnswer }
        if (question.type === 'fill') {
          answers[question.id] = { type: 'fill', text: question.correctAnswer }
          serverJudgments.push({ questionId: question.id, answerHash: 'a'.repeat(64), source: 'rule',
            status: 'correct', confidence: null, reason: null })
          trusted.push({ questionId: question.id, source: 'rule', status: 'correct', reason: null })
        }
      }
      const contexts = tutorContext.listRevision(current.id, current.revision)
      expect(gradeOfficialSubmission(contexts, answers as NormalizedAnswers, serverJudgments))
        .toEqual(gradeQuizWithFillJudgments(current, answers, trusted))
    }
  })
  it('leaves a v1.0 attempt deterministic while the same answer is AI-correct in v1.1', async () => {
    const legacy = mapPracticeRecord({ ...row, grading_version: 'deterministic-v1',
      submission_request_id: null, answers: [answer] }, 'student')
    const semantic = mapPracticeRecord({ ...row, answers: [answer] }, 'student',
      quizCatalog, [await judgment('correct')])
    expect(gradeQuiz(quiz, { q5: { type: 'fill', text: 'Exclusive OR' } }).questions[4].status).toBe('incorrect')
    expect(legacy.attempt?.status === 'submitted' && legacy.attempt.result.questions[4].status).toBe('incorrect')
    expect(semantic.attempt?.status === 'submitted' && semantic.attempt.result.questions[4])
      .toMatchObject({ status: 'correct', score: 2, source: 'ai' })
  })
  it('uses persisted evidence on Result and History reloads and excludes AI-correct fill from Mistakes', async () => {
    const evidence = await judgment('correct')
    const first = mapPracticeRecord({ ...row, answers: [answer] }, 'student', quizCatalog, [evidence])
    const reloaded = mapPracticeRecord({ ...row, answers: [answer] }, 'student', quizCatalog, [evidence])
    expect(first.attempt?.status === 'submitted' && first.attempt.result.score).toBe(2)
    expect(reloaded.attempt?.status === 'submitted' && reloaded.attempt.result).toEqual(
      first.attempt?.status === 'submitted' && first.attempt.result)
    expect(deriveMistakes([reloaded])).toEqual([])
  })
  it('uses persisted AI-incorrect evidence in Mistakes and Review Queue', async () => {
    const evidence = await judgment('incorrect')
    const record = mapPracticeRecord({ ...row, answers: [answer] }, 'student', quizCatalog, [evidence])
    expect(deriveMistakes([record]).map((item) => item.question.id)).toEqual(['q5'])
    const analytics = buildLearningAnalytics([
      mapAnalyticsRecord(row, [answer], 'student', quizCatalog, [evidence]),
    ], false, (quizId) => quizCatalog.getCurrentQuiz(quizId))
    expect(analytics.reviewQueue.map((item) => item.questionId)).toEqual(['q5'])
    expect(analytics.objectivePointsEarned).toBe(0)
  })
  it('uses persisted AI-correct evidence in Analytics and clears an old mistake from Review', async () => {
    const old = mapAnalyticsRecord({ ...row, grading_version: 'deterministic-v1',
      submission_request_id: null, started_at: '2026-09-27T01:00:00.000Z',
      client_updated_at: '2026-09-27T01:00:00.000Z', submitted_at: '2026-09-27T01:00:00.000Z' },
    [answer], 'student')
    const latest = mapAnalyticsRecord(row, [answer], 'student', quizCatalog, [await judgment('correct')])
    const analytics = buildLearningAnalytics([old, latest], false, (quizId) => quizCatalog.getCurrentQuiz(quizId))
    expect(analytics.correct).toBe(1)
    expect(analytics.incorrect).toBe(1)
    expect(analytics.objectivePointsEarned).toBe(2)
    expect(analytics.reviewQueue).toEqual([])
  })
  it('rejects missing or inconsistent semantic evidence instead of silently regrading', () => {
    const answers = { q5: { type: 'fill' as const, text: 'Exclusive OR' } }
    expect(() => gradeQuizWithFillJudgments(quiz, answers, [])).toThrow()
    expect(() => gradeQuizWithFillJudgments(quiz, answers, [
      { questionId: 'q5', source: 'rule', status: 'correct', reason: null },
    ])).toThrow()
  })
})
