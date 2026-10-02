import { describe, expect, it } from 'vitest'
import { quizCatalog } from './quiz-loader'
import { mapPracticeRecord } from './practice-repository'
import { trustedFillJudgments, trustedRubricJudgments } from './repositories'
import { gradeQuizV3 } from '../../lib/grading'
import { decodeAttempt } from '../../lib/attempt-storage'
import { deriveMistakes } from './practice-history'
import type { Database } from '../../types/database.types'
import type { AnswerMap } from '../../models/attempt'
import type { JudgmentRow, RubricJudgmentRow } from './repositories'

const quiz = quizCatalog.getCurrentQuiz('demo')!
const now = '2026-09-25T06:00:00.000Z'
type Row = Database['public']['Tables']['attempts']['Row']
type Answer = Database['public']['Tables']['answers']['Row']
const row: Row = { id: '00000000-0000-4000-8000-000000000001', user_id: 'a', quiz_id: quiz.id,
  quiz_revision: quiz.revision, status: 'submitted', started_at: now, client_updated_at: now, submitted_at: now,
  answer_schema_version: 1, grading_version: 'deterministic-v1', submission_request_id: null,
  deterministic_score: 999, deterministic_max_score: 999, correct_count: 999, partial_count: 0, incorrect_count: 0,
  unanswered_count: 0, created_at: now, updated_at: now }
function answer(question_id: string, value: Answer['answer'], attempt_id = row.id): Answer {
  return { id: `${attempt_id}:${question_id}`, attempt_id, user_id: 'a', question_id,
    answer: value, grade: { status: 'correct', score: 999 }, created_at: now, updated_at: now }
}
describe('history and mistakes are derived from exact published content', () => {
  it('regrades a forged stored score and includes only incorrect objective answers', () => {
    const record = mapPracticeRecord({ ...row, answers: [
      answer('q1', { type: 'single', optionId: 'a' }),
      answer('q2', { type: 'single', optionId: 'b' }),
      answer('q6', { type: 'calculation', text: 'wrong' }),
      answer('q7', { type: 'drawing', strokes: [] }),
    ] }, 'a')
    expect(record.attempt?.status === 'submitted' && record.attempt.result.score).toBe(2)
    expect(deriveMistakes([record]).map((item) => item.question.id)).toEqual(['q1'])
  })
  it('separates unanswered questions and manual types from mistakes', () => {
    const record = mapPracticeRecord({ ...row, answers: [] }, 'a')
    expect(record.attempt?.status === 'submitted' && record.attempt.result.unansweredCount).toBe(5)
    expect(deriveMistakes([record])).toHaveLength(0)
  })
  it('preserves distinct occurrences from repeated attempts', () => {
    const first = mapPracticeRecord({ ...row, answers: [answer('q1', { type: 'single', optionId: 'a' })] }, 'a')
    const secondId = '00000000-0000-4000-8000-000000000002'
    const second = mapPracticeRecord({ ...row, id: secondId, answers: [answer('q1', { type: 'single', optionId: 'a' }, secondId)] }, 'a')
    expect(deriveMistakes([first, second]).map((item) => item.record.id)).toEqual([row.id, secondId])
  })
  it('shows missing revisions as unavailable without guessing answers', () => {
    const missing = mapPracticeRecord({ ...row, quiz_revision: 'not-bundled', answers: [answer('q1', { type: 'single', optionId: 'a' })] }, 'a')
    expect(missing.quiz).toBeNull()
    expect(missing.attempt).toBeNull()
    expect(deriveMistakes([missing])).toEqual([])
  })
  it('rejects foreign attempt or answer data before derivation', () => {
    expect(() => mapPracticeRecord({ ...row, answers: [] }, 'b')).toThrow()
    expect(() => mapPracticeRecord({ ...row, answers: [{ ...answer('q1', { type: 'single', optionId: 'a' }), user_id: 'b' }] }, 'a')).toThrow()
  })
  it('restores persisted v3 score and includes partial calculation plus incorrect drawing in mistakes', () => {
    const v3 = { ...row, grading_version: 'ai-grading-v3', deterministic_score: 1,
      deterministic_max_score: 20, correct_count: 0, partial_count: 1, incorrect_count: 2, unanswered_count: 4 }
    const answers = [answer('q1', { type: 'single', optionId: 'a' }),
      answer('q6', { type: 'calculation', text: 'unfinished derivation' }),
      answer('q7', { type: 'drawing', strokes: [{ tool: 'pen', color: '#202b38', width: 2,
        points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }] })]
    const fill: JudgmentRow = { id: 'fill-v3', user_id: 'a', attempt_id: row.id, quiz_id: quiz.id,
      quiz_revision: quiz.revision, question_id: 'q5', answer_hash: 'b'.repeat(64), judge_version: 'ai-grading-v3',
      source: 'rule', status: 'unanswered', model: null, reasoning_effort: null, confidence: null,
      reason: null, created_at: now, finalized_at: now }
    const rubricJudgments: RubricJudgmentRow[] = (['q6', 'q7'] as const).map((questionId) => {
      const question = quiz.questions.find((item) => item.id === questionId)!
      const awards = questionId === 'q6' ? [1, 0, 0] : [0, 0, 0, 0]
      return { user_id: 'a', attempt_id: row.id, quiz_id: quiz.id, quiz_revision: quiz.revision,
        question_id: questionId, question_type: question.type, answer_hash: 'a'.repeat(64),
        judge_version: 'ai-grading-v3', source: 'ai',
        status: awards.reduce((sum, item) => sum + item, 0) === question.points ? 'correct'
          : awards.every((item) => item === 0) ? 'incorrect' : 'partial',
        score: awards.reduce((sum, item) => sum + item, 0), max_score: question.points,
        criteria: question.rubric.map((criterion, index) => ({ criterionId: `r${index + 1}`,
          awardedScore: awards[index], maxScore: criterion.score,
          status: awards[index] === criterion.score ? 'full' : awards[index] === 0 ? 'none' : 'partial' })),
        confidence: 'medium', summary: 'Persisted rubric evidence.', details: {}, model: 'gpt-6-luna',
        reasoning_effort: 'medium', finalized_at: now }
    })
    const trustedFill = trustedFillJudgments(v3, [fill], 'a', 'ai-grading-v3')
    const trustedRubric = trustedRubricJudgments(v3, rubricJudgments, 'a')
    const answerMap = Object.fromEntries(answers.map((item) => [item.question_id, item.answer])) as AnswerMap
    expect(gradeQuizV3(quiz, answerMap, trustedFill, trustedRubric)).toMatchObject({ score: 1, maxScore: 20,
      partialCount: 1, incorrectCount: 2, unansweredCount: 4 })
    expect(decodeAttempt(JSON.stringify({ schemaVersion: 1, quizId: row.quiz_id, quizRevision: row.quiz_revision,
      startedAt: now, updatedAt: now, submittedAt: now, status: 'submitted', answers: answerMap }), quiz)).not.toBeNull()
    const record = mapPracticeRecord({ ...v3, answers }, 'a', undefined, [fill], rubricJudgments)
    expect(record.attempt?.status === 'submitted' && record.attempt.result).toMatchObject({
      score: 1, maxScore: 20, partialCount: 1, incorrectCount: 2, unansweredCount: 4,
    })
    expect(deriveMistakes([record]).map((item) => [item.question.id, item.grade.status])).toEqual([
      ['q1', 'incorrect'], ['q6', 'partial'], ['q7', 'incorrect'],
    ])
  })
  it('restores a fully erased drawing from persisted system evidence and rejects missing evidence', () => {
    const v3 = { ...row, grading_version: 'ai-grading-v3', deterministic_score: 0,
      deterministic_max_score: 20, correct_count: 0, partial_count: 0, incorrect_count: 0, unanswered_count: 7 }
    const erased = answer('q7', { type: 'drawing', strokes: [
      { tool: 'pen', color: '#202b38', width: 4, points: [{ x: 10, y: 50 }, { x: 90, y: 50 }] },
      { tool: 'eraser', color: '#202b38', width: 12, points: [{ x: 10, y: 50 }, { x: 90, y: 50 }] },
    ] })
    const fill: JudgmentRow = { id: 'fill-blank', user_id: 'a', attempt_id: row.id, quiz_id: quiz.id,
      quiz_revision: quiz.revision, question_id: 'q5', answer_hash: 'b'.repeat(64), judge_version: 'ai-grading-v3',
      source: 'rule', status: 'unanswered', model: null, reasoning_effort: null, confidence: null,
      reason: null, created_at: now, finalized_at: now }
    const systemEvidence = (questionId: 'q6' | 'q7'): RubricJudgmentRow => ({
      user_id: 'a', attempt_id: row.id, quiz_id: quiz.id, quiz_revision: quiz.revision,
      question_id: questionId, question_type: questionId === 'q6' ? 'calculation' : 'drawing',
      answer_hash: 'c'.repeat(64), judge_version: 'ai-grading-v3', source: 'system', status: 'unanswered',
      score: 0, max_score: questionId === 'q6' ? 6 : 4, criteria: [], confidence: null, summary: null,
      details: {}, model: null, reasoning_effort: null, finalized_at: now,
    })
    const evidence = [systemEvidence('q6'), systemEvidence('q7')]
    const record = mapPracticeRecord({ ...v3, answers: [erased] }, 'a', undefined, [fill], evidence)
    expect(record.attempt?.status === 'submitted' && record.attempt.result.questions.find((grade) => grade.questionId === 'q7'))
      .toMatchObject({ status: 'unanswered', source: 'system', score: 0, maxScore: 4 })
    const missing = mapPracticeRecord({ ...v3, answers: [erased] }, 'a', undefined, [fill], [])
    expect(missing.attempt).toBeNull()
  })
})
