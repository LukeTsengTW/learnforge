import { GRADE_STATUS, type AnswerMap, type GradeResult, type QuestionAnswer, type QuestionGrade,
  type TrustedFillJudgment } from '../models/attempt'
import { QUESTION_TYPE, type FillBlankQuestion, type MultipleChoiceQuestion, type ObjectiveQuestion,
  type Quiz, type Question, type SingleChoiceQuestion, type TrueFalseQuestion } from '../models/quiz'

export function hasAnswer(answer: QuestionAnswer | undefined): boolean {
  if (!answer) return false
  switch (answer.type) {
    case QUESTION_TYPE.single: return Boolean(answer.optionId)
    case QUESTION_TYPE.multiple: return answer.optionIds.length > 0
    case QUESTION_TYPE.trueFalse: return true
    case QUESTION_TYPE.fill:
    case QUESTION_TYPE.calculation: return answer.text.trim().length > 0
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
