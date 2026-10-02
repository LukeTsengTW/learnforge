import { GRADE_STATUS, type AnswerMap, type CalculationAnswerV4, type GradeResult, type QuestionAnswer, type QuestionGrade,
  type TrustedFillJudgment, type TrustedRubricJudgment } from '../models/attempt.ts'
import type { DraftAnswerMapV4 } from '../models/draft-v4.ts'
import { QUESTION_TYPE, type FillBlankQuestion, type MultipleChoiceQuestion, type ObjectiveQuestion,
  type Quiz, type Question, type SingleChoiceQuestion, type TrueFalseQuestion } from '../models/quiz.ts'
import { isV4BlankText } from './v4-blank.ts'
import { canonicalV4Score, isCanonicalV4Score } from './v4-score.ts'

/** Progress/display presence. A v4 calculation counts only its ACTIVE buffer. */
export function hasAnswer(answer: QuestionAnswer | CalculationAnswerV4 | undefined): boolean {
  if (!answer) return false
  switch (answer.type) {
    case QUESTION_TYPE.single: return Boolean(answer.optionId)
    case QUESTION_TYPE.multiple: return answer.optionIds.length > 0
    case QUESTION_TYPE.trueFalse: return true
    case QUESTION_TYPE.fill: return answer.text.trim().length > 0
    case QUESTION_TYPE.calculation:
      if (answer.mode === 'drawing') return answer.strokes.some((stroke) => stroke.tool === 'pen' && stroke.points.length > 0)
      return answer.mode === 'text' ? !isV4BlankText(answer.text) : answer.text.trim().length > 0
    case QUESTION_TYPE.drawing: return answer.strokes.some((stroke) => stroke.tool === 'pen' && stroke.points.length > 0)
  }
}

function objectiveGrade(question: ObjectiveQuestion, answered: boolean, correct: boolean): QuestionGrade {
  return { questionId: question.id, type: question.type,
    status: !answered ? GRADE_STATUS.unanswered : correct ? GRADE_STATUS.correct : GRADE_STATUS.incorrect,
    score: answered && correct ? question.points : 0, maxScore: question.points }
}

export function gradeSingleChoice(question: SingleChoiceQuestion, optionId: string | undefined): QuestionGrade {
  return objectiveGrade(question, Boolean(optionId), optionId === question.correctOptionId)
}
export function gradeMultipleChoice(question: MultipleChoiceQuestion, optionIds: string[] | undefined): QuestionGrade {
  const student = new Set(optionIds ?? [])
  const correct = new Set(question.correctOptionIds)
  return objectiveGrade(question, student.size > 0, student.size === correct.size && [...student].every((id) => correct.has(id)))
}
export function gradeTrueFalse(question: TrueFalseQuestion, value: boolean | undefined): QuestionGrade {
  return objectiveGrade(question, value !== undefined, value === question.correctAnswer)
}
const fillMatchers = {
  exact: (student: string, correct: string) => student === correct,
  'case-insensitive': (student: string, correct: string) => student.toLowerCase() === correct.toLowerCase(),
} satisfies Record<FillBlankQuestion['match'], (student: string, correct: string) => boolean>

export function gradeFillBlank(question: FillBlankQuestion, text: string | undefined): QuestionGrade {
  return objectiveGrade(question, Boolean(text?.trim()), text !== undefined && fillMatchers[question.match](text, question.correctAnswer))
}

function gradeQuestion(question: Question, answer: QuestionAnswer | undefined): QuestionGrade {
  switch (question.type) {
    case QUESTION_TYPE.single: return gradeSingleChoice(question, answer?.type === question.type ? answer.optionId : undefined)
    case QUESTION_TYPE.multiple: return gradeMultipleChoice(question, answer?.type === question.type ? answer.optionIds : undefined)
    case QUESTION_TYPE.trueFalse: return gradeTrueFalse(question, answer?.type === question.type ? answer.value : undefined)
    case QUESTION_TYPE.fill: return gradeFillBlank(question, answer?.type === question.type ? answer.text : undefined)
    case QUESTION_TYPE.calculation:
    case QUESTION_TYPE.drawing:
      return { questionId: question.id, type: question.type, status: GRADE_STATUS.manual, score: null, maxScore: null }
  }
}

/** Manual questions do not contribute to the score or objective counts. */
function aggregate(questions: QuestionGrade[]): GradeResult {
  return { questions,
    score: Number(questions.reduce((total, grade) => total + (grade.score ?? 0), 0).toFixed(8)),
    maxScore: Number(questions.reduce((total, grade) => total + (grade.maxScore ?? 0), 0).toFixed(8)),
    correctCount: questions.filter((grade) => grade.status === GRADE_STATUS.correct).length,
    partialCount: questions.filter((grade) => grade.status === GRADE_STATUS.partial).length,
    incorrectCount: questions.filter((grade) => grade.status === GRADE_STATUS.incorrect).length,
    unansweredCount: questions.filter((grade) => grade.status === GRADE_STATUS.unanswered).length,
    manualCount: questions.filter((grade) => grade.status === GRADE_STATUS.manual).length }
}

export function gradeQuiz(quiz: Quiz, answers: AnswerMap): GradeResult {
  return aggregate(quiz.questions.map((question) => gradeQuestion(question, answers[question.id])))
}

/** Only pass records loaded from the server-trusted, answer-bound judgment table. */
export function gradeQuizWithFillJudgments(quiz: Quiz, answers: AnswerMap,
  judgments: readonly TrustedFillJudgment[]): GradeResult {
  const byId = new Map(judgments.map((judgment) => [judgment.questionId, judgment]))
  if (byId.size !== judgments.length || judgments.length !== quiz.questions.filter((question) => question.type === 'fill').length) {
    throw new Error('Incomplete official fill judgments')
  }
  return aggregate(quiz.questions.map((question) => {
    if (question.type !== 'fill') return gradeQuestion(question, answers[question.id])
    const answer = answers[question.id]
    const text = answer?.type === 'fill' ? answer.text : undefined
    const rule = gradeFillBlank(question, text)
    const judgment = byId.get(question.id)
    if (!judgment || (rule.status === 'incorrect' && (judgment.source !== 'ai'
      || !['correct', 'incorrect'].includes(judgment.status) || typeof judgment.reason !== 'string'
      || !judgment.reason.trim() || judgment.reason.length > 240))
      || (rule.status !== 'incorrect' && (judgment.source !== 'rule' || judgment.status !== rule.status
        || judgment.reason !== null))) throw new Error('Invalid official fill judgment')
    return { questionId: question.id, type: question.type, status: judgment.status,
      score: judgment.status === 'correct' ? question.points : 0, maxScore: question.points,
      source: judgment.source, ...(judgment.source === 'ai' ? { reason: judgment.reason! } : {}) }
  }))
}

/** Stable IDs are derived from order so published quiz revisions need no format change. */
export function canonicalRubricCriterionId(index: number): string {
  return `r${index + 1}`
}

function roundedScore(value: number): number {
  return Number(value.toFixed(8))
}

function optionalTextList(value: unknown): value is string[] {
  return value === undefined || (Array.isArray(value)
    && value.every((item) => typeof item === 'string' && item.length <= 1000))
}

function validateRubricJudgment(question: Extract<Question, { type: 'calculation' | 'drawing' }>,
  judgment: Extract<TrustedRubricJudgment, { source: 'ai' }>): void {
  if (judgment.questionId !== question.id || judgment.questionType !== question.type
    || judgment.maxScore !== question.points || !Number.isFinite(question.points) || question.points <= 0
    || !Number.isFinite(judgment.score) || judgment.score < 0 || judgment.score > question.points
    || judgment.source !== 'ai'
    || judgment.status !== (judgment.score === question.points ? GRADE_STATUS.correct
      : judgment.score === 0 ? GRADE_STATUS.incorrect : GRADE_STATUS.partial)
    || judgment.model !== 'gpt-6-luna' || judgment.reasoningEffort !== 'medium'
    || !/^[a-f0-9]{64}$/.test(judgment.answerHash)
    || !['high', 'medium', 'low'].includes(judgment.confidence)
    || typeof judgment.summary !== 'string' || !judgment.summary.trim() || judgment.summary.length > 2000
    || !optionalTextList(judgment.strengths) || !optionalTextList(judgment.improvements)
    || !optionalTextList(judgment.observations) || !optionalTextList(judgment.missingOrUnclear)
    || !Array.isArray(judgment.criteria)) throw new Error('Invalid trusted rubric judgment')

  const rubric = question.rubric
  if (!Array.isArray(rubric) || rubric.length === 0
    || rubric.some((criterion) => typeof criterion.score !== 'number' || !Number.isFinite(criterion.score) || criterion.score <= 0)
    || roundedScore(rubric.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0)) !== roundedScore(question.points)
    || judgment.criteria.length !== rubric.length) throw new Error('Invalid canonical rubric')

  const criterionIds = new Set<string>()
  let criteriaTotal = 0
  for (let index = 0; index < rubric.length; index++) {
    const expected = rubric[index]
    const received = judgment.criteria[index]
    const expectedId = canonicalRubricCriterionId(index)
    if (!received || typeof received !== 'object' || received.criterionId !== expectedId
      || criterionIds.has(received.criterionId)
      || received.maxScore !== expected.score
      || !Number.isFinite(received.awardedScore) || received.awardedScore < 0 || received.awardedScore > (expected.score ?? 0)
      || !['full', 'partial', 'none'].includes(received.status)
      || (received.status === 'full' && received.awardedScore !== received.maxScore)
      || (received.status === 'partial' && !(received.awardedScore > 0 && received.awardedScore < received.maxScore))
      || (received.status === 'none' && received.awardedScore !== 0)
      || (received.feedback !== undefined && (typeof received.feedback !== 'string' || received.feedback.length > 1000))) {
      throw new Error('Invalid rubric criterion judgment')
    }
    criterionIds.add(received.criterionId)
    criteriaTotal += received.awardedScore
  }
  if (roundedScore(criteriaTotal) !== roundedScore(judgment.score)) throw new Error('Rubric criteria score mismatch')
}

/**
 * Pure official v3 composition. All AI judgments must already be trusted, validated,
 * and bound to the persisted answer by the server-side submission pipeline. In particular,
 * drawing blank state comes from the server rasterizer and is carried as system evidence.
 */
export function gradeQuizV3(quiz: Quiz, answers: AnswerMap,
  fillJudgments: readonly TrustedFillJudgment[],
  rubricJudgments: readonly TrustedRubricJudgment[]): GradeResult {
  const fillGrades = gradeQuizWithFillJudgments(quiz, answers, fillJudgments)
  const rubricQuestions = quiz.questions.filter((question): question is Extract<Question, { type: 'calculation' | 'drawing' }> =>
    question.type === QUESTION_TYPE.calculation || question.type === QUESTION_TYPE.drawing)
  const judgmentById = new Map(rubricJudgments.map((judgment) => [judgment.questionId, judgment]))
  if (judgmentById.size !== rubricJudgments.length || judgmentById.size !== rubricQuestions.length) {
    throw new Error('Incomplete official rubric judgments')
  }

  const grades = fillGrades.questions.map((grade) => {
    const question = quiz.questions.find((item) => item.id === grade.questionId)
    if (!question || (question.type !== QUESTION_TYPE.calculation && question.type !== QUESTION_TYPE.drawing)) return grade
    const judgment = judgmentById.get(question.id)
    if (!judgment) throw new Error('Missing official rubric judgment')
    if (judgment.source === 'system') {
      const answer = answers[question.id]
      if (judgment.questionId !== question.id || judgment.questionType !== question.type
        || judgment.status !== GRADE_STATUS.unanswered || judgment.score !== 0
        || judgment.maxScore !== question.points || !Number.isFinite(question.points) || question.points <= 0
        || !/^[a-f0-9]{64}$/.test(judgment.answerHash) || !Array.isArray(judgment.criteria)
        || judgment.criteria.length !== 0
        || (question.type === QUESTION_TYPE.calculation
          && answer?.type === QUESTION_TYPE.calculation && answer.text.trim().length > 0)) {
        throw new Error('Invalid system unanswered rubric evidence')
      }
      return { questionId: question.id, type: question.type, status: GRADE_STATUS.unanswered,
        score: 0, maxScore: question.points, source: 'system', answerHash: judgment.answerHash } satisfies QuestionGrade
    }
    validateRubricJudgment(question, judgment)
    const status = judgment.score === question.points ? GRADE_STATUS.correct
      : judgment.score === 0 ? GRADE_STATUS.incorrect : GRADE_STATUS.partial
    return { questionId: question.id, type: question.type, status, score: judgment.score,
      maxScore: question.points, source: 'ai', answerHash: judgment.answerHash,
      criteria: judgment.criteria.map((criterion) => ({ ...criterion })), confidence: judgment.confidence,
      summary: judgment.summary,
      ...(judgment.strengths ? { strengths: [...judgment.strengths] } : {}),
      ...(judgment.improvements ? { improvements: [...judgment.improvements] } : {}),
      ...(judgment.observations ? { observations: [...judgment.observations] } : {}),
      ...(judgment.missingOrUnclear ? { missingOrUnclear: [...judgment.missingOrUnclear] } : {}),
    } satisfies QuestionGrade
  })
  return aggregate(grades)
}

type RubricQuestion = Extract<Question, { type: 'calculation' | 'drawing' }>

/**
 * Pure official v4 composition for schema-2 answers. Calculation evidence is bound to the
 * ACTIVE mode only: text-mode blankness uses the v4 classifier, while drawing-mode and
 * DrawingQuestion blankness is server raster evidence and is never inferred here from strokes.
 * Handwritten calculation remains calculation and must not carry drawing-only detail fields.
 */
export function gradeQuizV4(quiz: Quiz, answers: DraftAnswerMapV4,
  fillJudgments: readonly TrustedFillJudgment[],
  rubricJudgments: readonly TrustedRubricJudgment[]): GradeResult {
  const objectiveAnswers: AnswerMap = {}
  for (const [questionId, answer] of Object.entries(answers)) {
    const question = quiz.questions.find((item) => item.id === questionId)
    if (!question || answer.type !== question.type) throw new Error('Invalid v4 answer')
    if (answer.type === QUESTION_TYPE.calculation) {
      if ((answer.mode !== 'text' && answer.mode !== 'drawing') || typeof answer.text !== 'string'
        || !Array.isArray(answer.strokes)
        || (question.type === QUESTION_TYPE.calculation && question.drawing === undefined
          && (answer.mode !== 'text' || answer.strokes.length !== 0))) throw new Error('Invalid v4 calculation answer')
      continue
    }
    objectiveAnswers[questionId] = answer
  }
  const fillGrades = gradeQuizWithFillJudgments(quiz, objectiveAnswers, fillJudgments)
  const rubricQuestions = quiz.questions.filter((question): question is RubricQuestion =>
    question.type === QUESTION_TYPE.calculation || question.type === QUESTION_TYPE.drawing)
  const judgmentById = new Map(rubricJudgments.map((judgment) => [judgment.questionId, judgment]))
  if (judgmentById.size !== rubricJudgments.length || judgmentById.size !== rubricQuestions.length) {
    throw new Error('Incomplete official rubric judgments')
  }

  const grades = fillGrades.questions.map((grade) => {
    const question = quiz.questions.find((item) => item.id === grade.questionId)
    if (!question || (question.type !== QUESTION_TYPE.calculation && question.type !== QUESTION_TYPE.drawing)) return grade
    const judgment = judgmentById.get(question.id)
    if (!judgment) throw new Error('Missing official rubric judgment')
    const answer = answers[question.id]
    const activeText = answer?.type === QUESTION_TYPE.calculation && answer.mode === 'text' ? answer.text : null
    if (judgment.source === 'system') {
      if (judgment.questionId !== question.id || judgment.questionType !== question.type
        || judgment.status !== GRADE_STATUS.unanswered || judgment.score !== 0
        || judgment.maxScore !== question.points || !Number.isFinite(question.points) || question.points <= 0
        || !/^[a-f0-9]{64}$/.test(judgment.answerHash) || !Array.isArray(judgment.criteria)
        || judgment.criteria.length !== 0
        || (activeText !== null && !isV4BlankText(activeText))) {
        throw new Error('Invalid system unanswered rubric evidence')
      }
      return { questionId: question.id, type: question.type, status: GRADE_STATUS.unanswered,
        score: 0, maxScore: question.points, source: 'system', answerHash: judgment.answerHash } satisfies QuestionGrade
    }
    if (!answer || (activeText !== null && isV4BlankText(activeText))
      || (question.type === QUESTION_TYPE.calculation && (judgment.observations !== undefined || judgment.missingOrUnclear !== undefined))
      || (question.type === QUESTION_TYPE.drawing && (judgment.strengths !== undefined || judgment.improvements !== undefined))) {
      throw new Error('Invalid v4 AI rubric evidence')
    }
    // v4 precision: evidence is already canonical; the total is exactly the canonical criterion sum.
    if (!isCanonicalV4Score(judgment.score) || !isCanonicalV4Score(judgment.maxScore) || !Array.isArray(judgment.criteria)
      || judgment.criteria.some((criterion) => !isCanonicalV4Score(criterion.awardedScore) || !isCanonicalV4Score(criterion.maxScore))
      || canonicalV4Score(judgment.criteria.reduce((sum, criterion) => sum + criterion.awardedScore, 0)) !== judgment.score) {
      throw new Error('Non-canonical v4 rubric score')
    }
    validateRubricJudgment(question, judgment)
    const status = judgment.score === question.points ? GRADE_STATUS.correct
      : judgment.score === 0 ? GRADE_STATUS.incorrect : GRADE_STATUS.partial
    return { questionId: question.id, type: question.type, status, score: judgment.score,
      maxScore: question.points, source: 'ai', answerHash: judgment.answerHash,
      criteria: judgment.criteria.map((criterion) => ({ ...criterion })), confidence: judgment.confidence,
      summary: judgment.summary,
      ...(judgment.strengths ? { strengths: [...judgment.strengths] } : {}),
      ...(judgment.improvements ? { improvements: [...judgment.improvements] } : {}),
      ...(judgment.observations ? { observations: [...judgment.observations] } : {}),
      ...(judgment.missingOrUnclear ? { missingOrUnclear: [...judgment.missingOrUnclear] } : {}),
    } satisfies QuestionGrade
  })
  return aggregate(grades)
}
