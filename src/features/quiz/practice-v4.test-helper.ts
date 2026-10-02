import { vi } from 'vitest'
import { createAttempt } from '../../lib/attempt'
import { decodeAttempt } from '../../lib/attempt-storage'
import { decodeQuizDraftV4 } from '../../lib/draft-v4'
import type { GradeResult } from '../../models/attempt'
import type { DraftSchemaVersion, PracticeAttempt } from '../../models/draft-v4'
import type { DrawingStroke } from '../../models/drawing'
import type { GradingVersion } from '../../models/grading-version'
import type { Question, Quiz } from '../../models/quiz'
import type { PracticeRepository } from './practice-context'
import { SubmissionError, type FormalSubmission, type PracticeRecord } from './practice-repository'
import { PersistenceError, type AttemptRowWithSchema, type StoredPracticeAttempt } from './repositories'
import type { QuizCatalog } from './quiz-loader'

/**
 * Synthetic exact revisions for M5 client tests. Question IDs mirror the M4 Edge fixture
 * (submission-v4.test-helper) so client flows can be driven through the real submit handler.
 * Production quiz content is not involved.
 */
export const V4_QUIZ_ID = 'm4-synthetic'
const rubric = (scores: number[]) => scores.map((score, index) => ({ description: `Criterion ${index + 1}`, score }))
function questions(capable: boolean): Question[] {
  return [
    { id: 'q_single', type: 'single', tags: ['logic'], points: 1, prompt: 'Pick', hint: null, solution: 'b', rubric: [],
      options: [{ id: 'a', content: 'A' }, { id: 'b', content: 'B' }], correctOptionId: 'b' },
    { id: 'q_fill', type: 'fill', tags: ['words'], points: 1, prompt: 'Name it', hint: null, solution: 'CPU', rubric: [],
      correctAnswer: 'CPU', match: 'exact' },
    { id: 'q_text', type: 'calculation', tags: [], points: 4, prompt: 'Solve 2x=4', hint: null, solution: 'x=2',
      referenceAnswer: 'x=2', rubric: rubric([2, 2]) },
    { id: 'q_hand', type: 'calculation', tags: [], points: 4, prompt: 'Solve 3x=9', hint: null, solution: 'x=3',
      referenceAnswer: 'x=3', rubric: rubric([2, 2]), ...(capable ? { drawing: { width: 800, height: 600 } } : {}) },
    { id: 'q_draw', type: 'drawing', tags: [], points: 2, prompt: 'Draw', hint: null, solution: 'diagram',
      referenceAnswer: 'diagram', rubric: rubric([1, 1]), drawing: { width: 400, height: 300 } },
  ]
}
const quizFor = (revision: string, capable: boolean, current: boolean): Quiz => ({ id: V4_QUIZ_ID, revision,
  title: 'Synthetic multimodal', description: 'Synthetic', subject: 'Synthetic', tags: ['synthetic'], estimatedMinutes: 5,
  current, questions: questions(capable) })
/** v4-capable exact revision (calculation q_hand declares handwriting). */
export const v4Quiz = quizFor('m4-r1', true, true)
/** Same quiz id, historical text-only revision: stays schema 1 / ai-grading-v3. */
export const v3Quiz = quizFor('m4-r0', false, false)
export const v4Catalog: QuizCatalog = {
  current: [{ quiz: v4Quiz, questionCount: v4Quiz.questions.length, maxPoints: 12 }], errors: [],
  getCurrentQuiz: (id) => id === V4_QUIZ_ID ? v4Quiz : null,
  getQuizRevision: (id, revision) => id !== V4_QUIZ_ID ? null : revision === v4Quiz.revision ? v4Quiz
    : revision === v3Quiz.revision ? v3Quiz : null,
}

export const pen = (y = 150): DrawingStroke => ({ tool: 'pen', color: '#202b38', width: 4, points: [{ x: 20, y }, { x: 350, y }] })

/**
 * A server-finalized ai-grading-v4 attempt (rows exactly as the database returns them), including a
 * handwritten calculation whose INACTIVE text must never be displayed or graded.
 */
export const INACTIVE_TEXT = 'INACTIVE TEXT MUST NOT RENDER'
export const ACTIVE_TEXT = 'ACTIVE TYPED DERIVATION'
export function submittedV4Rows(userId = 'student', attemptId = '00000000-0000-4000-8000-0000000000a4',
  options: { aiScore?: number; gradingVersion?: string; schema?: number } = {}) {
  const submittedAt = '2026-10-02T03:00:00.000Z'
  const answers = {
    q_single: { type: 'single', optionId: 'a' }, q_fill: { type: 'fill', text: 'CPU' },
    q_text: { type: 'calculation', mode: 'text', text: ACTIVE_TEXT, strokes: [] },
    q_hand: { type: 'calculation', mode: 'drawing', text: INACTIVE_TEXT, strokes: [pen()] },
    q_draw: { type: 'drawing', strokes: [pen(120)] },
  }
  const rubricRow = (questionId: string, questionType: 'calculation' | 'drawing', awards: number[], maxes: number[]) => {
    const score = Number(awards.reduce((sum, value) => sum + value, 0).toFixed(8))
    const max = maxes.reduce((sum, value) => sum + value, 0)
    return { user_id: userId, attempt_id: attemptId, quiz_id: V4_QUIZ_ID, quiz_revision: v4Quiz.revision,
      question_id: questionId, question_type: questionType, answer_hash: 'a'.repeat(64), judge_version: 'ai-grading-v4',
      source: 'ai', status: score === max ? 'correct' : score === 0 ? 'incorrect' : 'partial', score, max_score: max,
      criteria: awards.map((awardedScore, index) => ({ criterionId: `r${index + 1}`, awardedScore, maxScore: maxes[index],
        status: awardedScore === maxes[index] ? 'full' : awardedScore === 0 ? 'none' : 'partial', feedback: `Feedback ${index + 1}` })),
      confidence: 'medium', summary: `Summary for ${questionId}`,
      details: questionType === 'calculation' ? { strengths: ['Setup'], improvements: ['Finish'] }
        : { observations: ['Outline'], missingOrUnclear: [] },
      model: 'gpt-6-luna', reasoning_effort: 'medium', finalized_at: submittedAt }
  }
  const rubric = [rubricRow('q_text', 'calculation', [2, options.aiScore ?? 0.5], [2, 2]),
    rubricRow('q_hand', 'calculation', [0.1, 0.2], [2, 2]), rubricRow('q_draw', 'drawing', [1, 1], [1, 1])]
  const fill = [{ id: 'f1', user_id: userId, attempt_id: attemptId, quiz_id: V4_QUIZ_ID, quiz_revision: v4Quiz.revision,
    question_id: 'q_fill', answer_hash: 'b'.repeat(64), judge_version: 'ai-grading-v4', source: 'rule', status: 'correct',
    model: null, reasoning_effort: null, confidence: null, reason: null, created_at: submittedAt, finalized_at: submittedAt }]
  // q_single incorrect (0/1), q_fill 1/1, q_text 2.5/4, q_hand 0.3/4, q_draw 2/2.
  const score = Number((1 + 2 + (options.aiScore ?? 0.5) + 0.3 + 2).toFixed(8))
  const row = { id: attemptId, user_id: userId, quiz_id: V4_QUIZ_ID, quiz_revision: v4Quiz.revision, status: 'submitted',
    started_at: '2026-10-02T02:00:00.000Z', client_updated_at: '2026-10-02T02:30:00.000Z', submitted_at: submittedAt,
    grading_version: options.gradingVersion ?? 'ai-grading-v4', submission_request_id: '00000000-0000-4000-8000-0000000000b4',
    deterministic_score: score, deterministic_max_score: 12, correct_count: 2, partial_count: 2, incorrect_count: 1,
    unanswered_count: 0, created_at: submittedAt, updated_at: submittedAt, answer_schema_version: options.schema ?? 2,
    answers: Object.entries(answers).map(([question_id, answer], index) => ({ id: `ans-${index}`, attempt_id: attemptId,
      user_id: userId, question_id, answer, created_at: submittedAt, updated_at: submittedAt })) }
  return { row, fill, rubric, answers }
}

export function memoryStorage() {
  const data = new Map<string, string>()
  return { data, getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}

interface ServerRow { record: PracticeRecord; schemaVersion: DraftSchemaVersion }
/**
 * In-memory server modeling the M3/M4 contract: schema marker, v3 writer refusing schema 2 (40001),
 * save-quiz-draft promoting 1 -> 2, CAS on every write, and version-consistent submit.
 */
export function createV4MemoryRepository(userId: string) {
  const rows = new Map<string, ServerRow>()
  let tick = 0
  const timestamp = () => new Date(Date.parse('2026-10-02T00:00:00.000Z') + ++tick * 1000).toISOString()
  const clone = <T>(value: T) => structuredClone(value)
  const v3Saves: { id: string; attempt: PracticeAttempt }[] = []
  const v4Saves: { id: string; expectedUpdatedAt: string; attempt: PracticeAttempt }[] = []
  const submits: { id: string; expectedUpdatedAt: string; requestId: string; gradingVersion: GradingVersion }[] = []
  const submitBehavior = vi.fn<(row: ServerRow, requestId: string) => Promise<FormalSubmission>>(async (row, requestId) => {
    const quiz = row.record.quiz!
    const result: GradeResult = { score: 0, maxScore: quiz.questions.reduce((sum, item) => sum + item.points, 0),
      correctCount: 0, partialCount: 0, incorrectCount: 0, unansweredCount: quiz.questions.length, manualCount: 0, questions: [] }
    const now = timestamp()
    const attempt = row.record.attempt!
    row.record.attempt = attempt.schemaVersion === 2
      ? { ...attempt, status: 'submitted', submittedAt: now, answers: clone(attempt.answers), result }
      : { ...attempt, schemaVersion: 1, status: 'submitted', submittedAt: now, answers: clone(attempt.answers), result } as PracticeAttempt
    row.record.row = { ...row.record.row, status: 'submitted', submitted_at: now, updated_at: now, submission_request_id: requestId,
      grading_version: row.schemaVersion === 2 ? 'ai-grading-v4' : 'ai-grading-v3' }
    row.record.version = { id: row.record.id, updatedAt: now }
    return { state: 'submitted', result }
  })
  const repo: PracticeRepository = {
    async listCurrentDrafts() {
      return [...rows.values()].filter((item) => item.record.row.status === 'draft').map(({ record }) => ({
        id: record.id, quizId: record.row.quiz_id, revision: record.row.quiz_revision, updatedAt: record.row.updated_at }))
    },
    async loadAttempt(id) { const row = rows.get(id); return row ? clone({ ...row.record, schemaVersion: row.schemaVersion }) : null },
    async getOrCreateDraft(quiz) {
      const existing = [...rows.values()].find((item) => item.record.row.quiz_id === quiz.id && item.record.row.status === 'draft')
      if (existing) return clone({ ...existing.record, schemaVersion: existing.schemaVersion })
      const now = timestamp(), id = `00000000-0000-4000-8000-${(rows.size + 1).toString(16).padStart(12, '0')}`
      const row: AttemptRowWithSchema = { id, user_id: userId, quiz_id: quiz.id, quiz_revision: quiz.revision, status: 'draft',
        started_at: now, client_updated_at: now, submitted_at: null, grading_version: 'deterministic-v1', submission_request_id: null,
        deterministic_score: null, deterministic_max_score: null, correct_count: null, partial_count: 0, incorrect_count: null,
        unanswered_count: null, created_at: now, updated_at: now, answer_schema_version: 1 }
      const record: PracticeRecord = { id, row, quiz, attempt: createAttempt(quiz, now), version: { id, updatedAt: now }, schemaVersion: 1 }
      rows.set(id, { record, schemaVersion: 1 })
      return clone(record)
    },
    async saveDraft(record, attempt): Promise<StoredPracticeAttempt> {
      const row = rows.get(record.id)
      if (!row || row.record.row.status !== 'draft' || row.record.version.updatedAt !== record.version.updatedAt
        || attempt.status !== 'in-progress') throw new PersistenceError('conflict')
      const quiz = row.record.quiz!
      if (attempt.schemaVersion === 1) {
        // save_quiz_attempt_v3 never overwrites a schema-2 draft.
        if (row.schemaVersion !== 1 || !decodeAttempt(JSON.stringify(attempt), quiz)) throw new PersistenceError('conflict')
        v3Saves.push({ id: record.id, attempt: clone(attempt) })
      } else {
        if (!decodeQuizDraftV4(JSON.stringify(attempt), quiz)) throw new PersistenceError('invalid')
        v4Saves.push({ id: record.id, expectedUpdatedAt: record.version.updatedAt, attempt: clone(attempt) })
        row.schemaVersion = 2
      }
      const now = timestamp()
      row.record.attempt = clone(attempt)
      row.record.row = { ...row.record.row, client_updated_at: attempt.updatedAt, updated_at: now, answer_schema_version: row.schemaVersion }
      row.record.version = { id: record.id, updatedAt: now }
      row.record.schemaVersion = row.schemaVersion
      return { attempt, version: row.record.version }
    },
    async submitDraft(id, expectedUpdatedAt, requestId, gradingVersion = 'ai-grading-v3') {
      submits.push({ id, expectedUpdatedAt, requestId, gradingVersion })
      const row = rows.get(id)
      if (!row || row.record.row.status !== 'draft' || row.record.version.updatedAt !== expectedUpdatedAt) {
        throw new SubmissionError('conflict')
      }
      const result = await submitBehavior(row, requestId)
      // Client-side response consistency mirrors SupabasePracticeRepository.submitDraft.
      if (result.state === 'submitted' && row.record.row.grading_version !== gradingVersion) throw new SubmissionError('unavailable')
      return result
    },
    async deleteDraft(record) {
      const row = rows.get(record.id)
      if (!row || row.record.row.status !== 'draft' || row.record.version.updatedAt !== record.version.updatedAt) throw new PersistenceError('conflict')
      rows.delete(record.id)
    },
    async listSubmittedPage() { return { records: [], nextOffset: null } },
    async listSubmittedAnalyticsPage() { return { records: [], nextOffset: null } },
    async loadLatestSubmittedForQuiz() { return null },
  }
  /** Simulates another (already-open) client writing directly; returns the new CAS version. */
  function serverEdit(id: string, attempt: PracticeAttempt) {
    const row = rows.get(id)!
    const now = timestamp()
    row.record.attempt = clone(attempt)
    row.schemaVersion = attempt.schemaVersion
    row.record.schemaVersion = attempt.schemaVersion
    row.record.row = { ...row.record.row, client_updated_at: attempt.updatedAt, updated_at: now, answer_schema_version: attempt.schemaVersion }
    row.record.version = { id, updatedAt: now }
    return now
  }
  return { repo, rows, v3Saves, v4Saves, submits, submitBehavior, serverEdit }
}
