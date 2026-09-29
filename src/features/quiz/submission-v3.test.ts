import { describe, expect, it, vi } from 'vitest'
import { quizCatalog } from './quiz-loader'
import { tutorContext, type TutorQuestionContext } from '../../../supabase/functions/_shared/ai-tutor'
import { AiProviderError } from '../../../supabase/functions/_shared/ai-provider'
import { parseSubmissionInput, type FillVerdict } from '../../../supabase/functions/_shared/semantic-fill'
import { validateSubmissionRubricOutput, type SubmissionRubricJudgment,
  type SubmissionRubricOutput, type SubmissionRubricQuestionType } from '../../../supabase/functions/_shared/submission-rubric'
import { AI_GRADING_UNAVAILABLE, createSubmitQuizHandler, type AttemptSnapshot, type PersistedFillJudgment,
  type PersistedRubricJudgment, type SubmissionBackend } from '../../../supabase/functions/submit-quiz/handler'

const quiz = quizCatalog.getCurrentQuiz('demo')!
const contexts = tutorContext.listRevision(quiz.id, quiz.revision)
const calc = contexts.find((question) => question.type === 'calculation')!
const drawing = contexts.find((question) => question.type === 'drawing')!
const qid = (question: TutorQuestionContext) => question.questionId
const firstVersion = '2026-09-28T00:00:00.000Z'
const nextVersion = '2026-09-28T00:00:01.000Z'
const attemptId = '00000000-0000-4000-8000-000000000411'
const requestId = '00000000-0000-4000-8000-000000000422'
const userId = '00000000-0000-4000-8000-000000000433'
const usage = { inputTokens: 10, cachedInputTokens: 0, outputTokens: 12, reasoningTokens: 2 }
const fillCorrect: FillVerdict = { verdict: 'correct', confidence: 'medium', reason: '語意相同。' }

function rows(...items: [string, unknown][]) {
  return items.map(([question_id, answer]) => ({ question_id, answer }))
}
function allDeterministicAnswers() {
  return rows(...quiz.questions.flatMap((question) => {
    switch (question.type) {
      case 'single': return [[question.id, { type: question.type, optionId: question.correctOptionId }] as [string, unknown]]
      case 'multiple': return [[question.id, { type: question.type, optionIds: [...question.correctOptionIds] }] as [string, unknown]]
      case 'true-false': return [[question.id, { type: question.type, value: question.correctAnswer }] as [string, unknown]]
      case 'fill': return [[question.id, { type: question.type, text: question.correctAnswer }] as [string, unknown]]
      case 'calculation':
      case 'drawing': return []
    }
  }))
}
function calcAnswer(text = '2x^2-7x+3=(2x-1)(x-3)') { return rows([qid(calc), { type: 'calculation', text }]) }
function drawingAnswer() {
  return rows([qid(drawing), { type: 'drawing', strokes: [{ tool: 'pen', color: '#202b38', width: 4,
    points: [{ x: 120, y: 240 }, { x: 320, y: 240 }, { x: 400, y: 300 }] }] }])
}
function rubricOutput(question: TutorQuestionContext, type: SubmissionRubricQuestionType, score: 'full' | 'partial' | 'zero' = 'full'): SubmissionRubricOutput {
  const rubric = question.gradingRubric!
  const awards = rubric.map((criterion, index) => score === 'full' ? criterion.points
    : score === 'zero' ? 0 : index === 0 ? criterion.points / 2 : 0)
  const criteria = rubric.map((criterion, index) => {
    const awardedScore = awards[index]
    return { criterionId: criterion.id, maxScore: criterion.points, awardedScore,
      status: awardedScore === criterion.points ? 'full' as const : awardedScore === 0 ? 'none' as const : 'partial' as const,
      feedback: 'Evidence checked.' }
  })
  return { score: awards.reduce((sum, item) => sum + item, 0), maxScore: question.points!, criteria,
    confidence: 'medium', summary: 'Checked against the fixed rubric.',
    ...(type === 'calculation' ? { strengths: ['A valid step is present.'], improvements: ['Show the remaining steps.'] }
      : { observations: ['The main structure is visible.'], missingOrUnclear: ['One detail is unclear.'] }) }
}
async function hashAnswer(answer: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(answer)))
  return [...new Uint8Array(bytes)].map((item) => item.toString(16).padStart(2, '0')).join('')
}
const submissionRequest = (expectedUpdatedAt = firstVersion, extra: Record<string, unknown> = {}) => new Request('http://local/submit-quiz', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ requestId, attemptId, expectedUpdatedAt, ...extra }),
})

function fixture(answerRows: { question_id: string; answer: unknown }[]) {
  const fillProvider = { judge: vi.fn(async () => ({ verdict: fillCorrect, responseId: 'fill-response', usage })) }
  const calculationProvider = { generate: vi.fn(async (question: TutorQuestionContext) => ({
    output: rubricOutput(question, 'calculation'), responseId: 'calc-response', usage,
  })) }
  const drawingProvider = { generate: vi.fn(async (question: TutorQuestionContext) => ({
    output: rubricOutput(question, 'drawing'), responseId: 'draw-response', usage,
  })) }
  const state: {
    attempt: AttemptSnapshot
    finalFill: PersistedFillJudgment[]
    finalRubric: PersistedRubricJudgment[]
    fillCache: Map<string, FillVerdict>
    pendingFill: Map<string, string>
    rubricCache: Map<string, SubmissionRubricJudgment>
    pendingRubric: Map<string, string>
    finalized: number
    failFinalizeOnce: boolean
    personalCredits: number
  } = {
    attempt: { id: attemptId, user_id: userId, quiz_id: quiz.id, quiz_revision: quiz.revision,
      status: 'draft', updated_at: firstVersion, grading_version: 'deterministic-v1', submission_request_id: null,
      deterministic_score: null, deterministic_max_score: null, correct_count: null, partial_count: null,
      incorrect_count: null, unanswered_count: null, answers: structuredClone(answerRows) },
    finalFill: [], finalRubric: [], fillCache: new Map(), pendingFill: new Map(), rubricCache: new Map(),
    pendingRubric: new Map(), finalized: 0, failFinalizeOnce: false, personalCredits: 20,
  }
  const backend: SubmissionBackend = {
    userId, fillProvider, calculationProvider, drawingProvider,
    async loadAttempt() { return structuredClone(state.attempt) },
    async loadFinalFillJudgments() { return structuredClone(state.finalFill) },
    async loadFinalRubricJudgments() { return structuredClone(state.finalRubric) },
    async claimFill(input) {
      if (state.attempt.status !== 'draft' || state.attempt.updated_at !== input.expectedUpdatedAt) return { state: 'conflict' }
      const cached = state.fillCache.get(input.answerHash)
      if (cached) return { state: 'cached', answerHash: input.answerHash, ...cached }
      const claimToken = crypto.randomUUID()
      state.pendingFill.set(claimToken, input.answerHash)
      return { state: 'claimed', claimToken, answerHash: input.answerHash }
    },
    async completeFill(token, verdict, confidence, reason) {
      const hash = state.pendingFill.get(token)
      if (!hash) return false
      state.fillCache.set(hash, { verdict, confidence, reason })
      state.pendingFill.delete(token)
      return true
    },
    async failFill(token) { state.pendingFill.delete(token) },
    async claimRubric(input) {
      if (state.attempt.status !== 'draft' || state.attempt.updated_at !== input.expectedUpdatedAt) return { state: 'conflict' }
      const row = state.attempt.answers.find((answer) => answer.question_id === input.questionId)
      if (!row && !input.systemUnanswered && input.questionType !== 'drawing') return { state: 'conflict' }
      const answerHash = await hashAnswer(row?.answer ?? null)
      if (input.systemUnanswered) return { state: 'unanswered', answerHash }
      const key = `${input.questionId}:${input.questionType}:${answerHash}`
      const cached = state.rubricCache.get(key)
      if (cached) return { state: 'cached', answerHash, response: structuredClone(cached), providerResponseId: 'cached-response' }
      const claimToken = crypto.randomUUID()
      state.pendingRubric.set(claimToken, key)
      return { state: 'claimed', claimToken, answerHash }
    },
    async completeRubric(token, judgment) {
      const key = state.pendingRubric.get(token)
      if (!key) return false
      const context = contexts.find((question) => question.questionId === judgment.questionId)!
      const output = Object.fromEntries(Object.entries(judgment)
        .filter(([key]) => !['questionId', 'questionType', 'answerHash'].includes(key)))
      if (!validateSubmissionRubricOutput(output, context, judgment.questionType)) return false
      state.rubricCache.set(key, structuredClone(judgment))
      state.pendingRubric.delete(token)
      return true
    },
    async failRubric(token) { state.pendingRubric.delete(token) },
    async finalize(input) {
      if (state.failFinalizeOnce) { state.failFinalizeOnce = false; throw new Error('temporary DB failure') }
      if (state.attempt.status !== 'draft' || state.attempt.updated_at !== input.expectedUpdatedAt) return false
      state.attempt.status = 'submitted'
      state.attempt.grading_version = 'ai-grading-v3'
      state.attempt.submission_request_id = input.requestId
      state.attempt.deterministic_score = input.result.score
      state.attempt.deterministic_max_score = input.result.maxScore
      state.attempt.correct_count = input.result.correctCount
      state.attempt.partial_count = input.result.partialCount
      state.attempt.incorrect_count = input.result.incorrectCount
      state.attempt.unanswered_count = input.result.unansweredCount
      state.finalFill = structuredClone(input.fillJudgments.map((judgment) => ({ ...judgment, judgeVersion: 'ai-grading-v3' })))
      state.finalRubric = structuredClone(input.rubricJudgments.map((judgment) => ({
        question_id: judgment.questionId, question_type: judgment.questionType, answer_hash: judgment.answerHash,
        judge_version: 'ai-grading-v3', source: judgment.source, status: judgment.status,
        score: judgment.score, max_score: judgment.maxScore, criteria: judgment.criteria,
        confidence: judgment.source === 'ai' ? judgment.confidence : null,
        summary: judgment.source === 'ai' ? judgment.summary : null,
        model: judgment.source === 'ai' ? judgment.model : null,
        reasoning_effort: judgment.source === 'ai' ? judgment.reasoningEffort : null,
        details: judgment.source === 'ai' ? { ...(judgment.strengths ? { strengths: judgment.strengths } : {}),
          ...(judgment.improvements ? { improvements: judgment.improvements } : {}),
          ...(judgment.observations ? { observations: judgment.observations } : {}),
          ...(judgment.missingOrUnclear ? { missingOrUnclear: judgment.missingOrUnclear } : {}) } : {},
      })))
      state.finalized++
      return true
    },
  }
  return { state, backend, fillProvider, calculationProvider, drawingProvider,
    submit: createSubmitQuizHandler(backend) }
}

describe('ai-grading-v3 submission pipeline', () => {
  it('scores all deterministic types without AI and leaves blank rubric types unanswered', async () => {
    const test = fixture(allDeterministicAnswers())
    const response = await test.submit(submissionRequest())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.gradingVersion).toBe('ai-grading-v3')
    expect(body.result.score).toBe(10)
    expect(body.result.maxScore).toBe(20)
    expect(body.result.partialCount).toBe(0)
    expect(body.result.questions.filter((grade: { type: string }) => grade.type === 'calculation' || grade.type === 'drawing'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'calculation', status: 'unanswered', score: 0 }),
        expect.objectContaining({ type: 'drawing', status: 'unanswered', score: 0 }),
      ]))
    expect(test.fillProvider.judge).not.toHaveBeenCalled()
    expect(test.calculationProvider.generate).not.toHaveBeenCalled()
    expect(test.drawingProvider.generate).not.toHaveBeenCalled()
  })

  it('uses semantic AI only for a nonblank fill rule mismatch', async () => {
    const test = fixture(rows([qid(contexts.find((question) => question.type === 'fill')!),
      { type: 'fill', text: 'a semantic equivalent' }]))
    const response = await test.submit(submissionRequest())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.result.questions.find((grade: { type: string }) => grade.type === 'fill'))
      .toMatchObject({ source: 'ai', status: 'correct' })
    expect(test.fillProvider.judge).toHaveBeenCalledTimes(1)
    expect(test.calculationProvider.generate).not.toHaveBeenCalled()
    expect(test.drawingProvider.generate).not.toHaveBeenCalled()
  })

  it.each([
    ['full', 'correct', 6, 0], ['partial', 'partial', 1, 1],
  ] as const)('includes %s calculation rubric score in the practice total', async (_label, status, score, partialCount) => {
    const test = fixture(calcAnswer())
    if (status === 'partial') test.calculationProvider.generate.mockImplementationOnce(async (question) => ({
      output: rubricOutput(question, 'calculation', 'partial'), responseId: 'calc-partial', usage,
    }))
    const response = await test.submit(submissionRequest())
    const body = await response.json()
    const grade = body.result.questions.find((item: { type: string }) => item.type === 'calculation')
    expect(response.status).toBe(200)
    expect(grade).toMatchObject({ status, score, maxScore: 6, source: 'ai' })
    expect(body.result.partialCount).toBe(partialCount)
    expect(body.result.maxScore).toBeGreaterThanOrEqual(6)
  })

  it.each([
    ['full', 'correct', 4, 0], ['partial', 'partial', 0.5, 1],
  ] as const)('includes %s drawing rubric score in the practice total', async (_label, status, score, partialCount) => {
    const test = fixture(drawingAnswer())
    if (status === 'partial') test.drawingProvider.generate.mockImplementationOnce(async (question) => ({
      output: rubricOutput(question, 'drawing', 'partial'), responseId: 'draw-partial', usage,
    }))
    const response = await test.submit(submissionRequest())
    const body = await response.json()
    const grade = body.result.questions.find((item: { type: string }) => item.type === 'drawing')
    expect(response.status).toBe(200)
    expect(grade).toMatchObject({ status, score, maxScore: 4, source: 'ai' })
    expect(body.result.partialCount).toBe(partialCount)
  })

  it('grades calculation and drawing together from their separate shared providers', async () => {
    const test = fixture([...calcAnswer(), ...drawingAnswer()])
    expect((await test.submit(submissionRequest())).status).toBe(200)
    expect(test.calculationProvider.generate).toHaveBeenCalledTimes(1)
    expect(test.drawingProvider.generate).toHaveBeenCalledTimes(1)
    expect(test.state.personalCredits).toBe(20)
  })

  it('treats blank calculation and raster-blank drawing as unanswered without provider calls', async () => {
    const test = fixture([...rows([qid(calc), { type: 'calculation', text: '   ' }]),
      ...rows([qid(drawing), { type: 'drawing', strokes: [] }])])
    const response = await test.submit(submissionRequest())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.result.questions.filter((grade: { type: string }) => grade.type === 'calculation' || grade.type === 'drawing'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'calculation', status: 'unanswered', score: 0, maxScore: 6 }),
        expect.objectContaining({ type: 'drawing', status: 'unanswered', score: 0, maxScore: 4 }),
      ]))
    expect(test.calculationProvider.generate).not.toHaveBeenCalled()
    expect(test.drawingProvider.generate).not.toHaveBeenCalled()
    expect(test.state.pendingRubric.size).toBe(0)
    expect(test.state.finalRubric).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'system', status: 'unanswered', score: 0, max_score: 6, criteria: [] }),
      expect.objectContaining({ source: 'system', status: 'unanswered', score: 0, max_score: 4, criteria: [] }),
    ]))
  })

  it.each([
    ['pen fully erased', [{ tool: 'pen', color: '#202b38', width: 4, points: [{ x: 10, y: 50 }, { x: 90, y: 50 }] },
      { tool: 'eraser', color: '#202b38', width: 12, points: [{ x: 10, y: 50 }, { x: 90, y: 50 }] }]],
    ['tiny raster mark', [{ tool: 'pen', color: '#202b38', width: 1, points: [{ x: 250, y: 250 }] }]],
  ] as const)('%s uses persisted system unanswered evidence without AI', async (_label, strokes) => {
    const test = fixture(rows([qid(drawing), { type: 'drawing', strokes }]))
    const response = await test.submit(submissionRequest())
    expect(response.status).toBe(200)
    expect((await response.json()).result.questions.find((grade: { type: string }) => grade.type === 'drawing'))
      .toMatchObject({ status: 'unanswered', source: 'system', score: 0, maxScore: 4 })
    expect(test.state.finalRubric).toEqual(expect.arrayContaining([
      expect.objectContaining({ question_id: qid(drawing), source: 'system', status: 'unanswered' }),
    ]))
    expect(test.drawingProvider.generate).not.toHaveBeenCalled()
    const replay = await test.submit(submissionRequest())
    expect(replay.status).toBe(200)
    expect((await replay.json()).result.questions.find((grade: { type: string }) => grade.type === 'drawing'))
      .toMatchObject({ status: 'unanswered', source: 'system' })
    expect(test.drawingProvider.generate).not.toHaveBeenCalled()
  })

  it('claims persisted drawings before raster work so concurrent retries short-circuit', async () => {
    const test = fixture(rows([qid(drawing), { type: 'drawing',
      strokes: Array.from({ length: 257 }, () => ({})) }]))
    const claim = vi.spyOn(test.backend, 'claimRubric').mockImplementation(async (input) => input.questionId === qid(drawing)
      ? { state: 'in_progress' } : { state: 'unanswered', answerHash: 'a'.repeat(64) })
    const response = await test.submit(submissionRequest())
    expect(response.status).toBe(202)
    expect(claim).toHaveBeenCalledTimes(2)
    expect(claim).toHaveBeenCalledWith(expect.objectContaining({ questionId: qid(drawing), systemUnanswered: false }))
    expect(test.drawingProvider.generate).not.toHaveBeenCalled()
  })

  it.each(['calculation', 'drawing', 'fill'] as const)(
    '%s provider failure uses the submission-level unavailable message', async (type) => {
    const fillQuestion = contexts.find((question) => question.type === 'fill')!
    const answers = type === 'calculation' ? calcAnswer() : type === 'drawing' ? drawingAnswer()
      : rows([qid(fillQuestion), { type: 'fill', text: 'semantic mismatch' }])
    const test = fixture(answers)
    const provider = type === 'calculation' ? test.calculationProvider.generate
      : type === 'drawing' ? test.drawingProvider.generate : test.fillProvider.judge
    provider.mockImplementationOnce(async () => { throw new AiProviderError('provider_unavailable') })
    const response = await test.submit(submissionRequest())
    expect(response.status).toBe(503)
    const message = (await response.json()).error
    expect(message).toBe(AI_GRADING_UNAVAILABLE)
    expect(message).not.toMatch(/填空判題|填空判題暫時/)
    expect(test.state.attempt.status).toBe('draft')
    expect(test.state.finalized).toBe(0)
    },
  )

  it('leaves a draft on malformed grading output and drawing raster errors', async () => {
    const malformed = fixture(calcAnswer())
    malformed.calculationProvider.generate.mockImplementationOnce(async (question) => ({
      output: { ...rubricOutput(question, 'calculation'), score: 99 } as SubmissionRubricOutput,
      responseId: 'bad-response', usage,
    }))
    expect((await malformed.submit(submissionRequest())).status).toBe(503)
    expect(malformed.state.attempt.status).toBe('draft')

    const badDrawing = fixture(rows([qid(drawing), { type: 'drawing', strokes: [{ tool: 'unknown', points: [] }] }]))
    expect((await badDrawing.submit(submissionRequest())).status).toBe(503)
    expect(badDrawing.state.attempt.status).toBe('draft')
    expect(badDrawing.drawingProvider.generate).not.toHaveBeenCalled()

    const oversizedDrawing = fixture(rows([qid(drawing), { type: 'drawing', strokes: Array.from({ length: 257 }, () =>
      ({ tool: 'pen', color: '#202b38', width: 4, points: [{ x: 120, y: 240 }] })) }]))
    const oversizedResponse = await oversizedDrawing.submit(submissionRequest())
    expect(oversizedResponse.status).toBe(503)
    expect((await oversizedResponse.json()).error).toBe(AI_GRADING_UNAVAILABLE)
    expect(oversizedDrawing.state.attempt.status).toBe('draft')
  })

  it('reuses completed fill and calculation cache after a later drawing provider failure', async () => {
    const test = fixture([...rows([qid(contexts.find((question) => question.type === 'fill')!),
      { type: 'fill', text: 'semantic mismatch' }]), ...calcAnswer(), ...drawingAnswer()])
    test.drawingProvider.generate.mockImplementationOnce(async () => { throw new AiProviderError('provider_unavailable') })
    expect((await test.submit(submissionRequest())).status).toBe(503)
    expect(test.state.attempt.status).toBe('draft')
    expect(test.state.rubricCache.size).toBe(1)
    expect(test.fillProvider.judge).toHaveBeenCalledTimes(1)
    expect(test.calculationProvider.generate).toHaveBeenCalledTimes(1)

    expect((await test.submit(submissionRequest())).status).toBe(200)
    expect(test.fillProvider.judge).toHaveBeenCalledTimes(1)
    expect(test.calculationProvider.generate).toHaveBeenCalledTimes(1)
    expect(test.drawingProvider.generate).toHaveBeenCalledTimes(2)
  })

  it('does not reuse rubric cache if the persisted answer changed', async () => {
    const test = fixture(calcAnswer())
    test.state.failFinalizeOnce = true
    expect((await test.submit(submissionRequest())).status).toBe(503)
    test.state.attempt.answers = calcAnswer('a changed derivation')
    test.state.attempt.updated_at = nextVersion
    expect((await test.submit(submissionRequest(nextVersion))).status).toBe(200)
    expect(test.calculationProvider.generate).toHaveBeenCalledTimes(2)
  })

  it('rejects stale CAS, replays the same request from persisted judgments, and rejects a new request id', async () => {
    const test = fixture(calcAnswer())
    test.calculationProvider.generate.mockImplementationOnce(async (question) => {
      test.state.attempt.updated_at = nextVersion
      return { output: rubricOutput(question, 'calculation'), responseId: 'stale-cas', usage }
    })
    expect((await test.submit(submissionRequest())).status).toBe(409)
    expect(test.state.attempt.status).toBe('draft')
    test.state.attempt.updated_at = firstVersion
    expect((await test.submit(submissionRequest())).status).toBe(200)
    const replay = await test.submit(submissionRequest())
    expect(replay.status).toBe(200)
    expect((await replay.json()).cached).toBe(true)
    expect(test.calculationProvider.generate).toHaveBeenCalledTimes(1)
    expect((await test.submit(submissionRequest(firstVersion, { requestId: crypto.randomUUID() }))).status).toBe(409)
  })

  it('rejects browser-supplied canonical grading fields', () => {
    for (const key of ['question', 'prompt', 'canonicalAnswer', 'solution', 'rubric', 'maxScore', 'model',
      'reasoningEffort', 'score', 'confidence', 'imageUrl', 'answerHash']) {
      expect(parseSubmissionInput({ requestId, attemptId, expectedUpdatedAt: firstVersion, [key]: 'forged' })).toBeNull()
    }
  })
})
