import { describe, expect, it } from 'vitest'
import demoSource from '../content/quizzes/demo/v1.quiz.md?raw'
import type { AnswerMap, TrustedRubricJudgment } from '../models/attempt'
import type { Quiz, CalculationQuestion, DrawingQuestion } from '../models/quiz'
import { gradeQuiz, gradeQuizV3, gradeQuizWithFillJudgments } from './grading'
import { parseQuiz } from './quiz-parser'

const quiz = parseQuiz(demoSource)
const calculation = quiz.questions.find((question): question is CalculationQuestion => question.type === 'calculation')!
const drawing = quiz.questions.find((question): question is DrawingQuestion => question.type === 'drawing')!
const calcRubricQuiz: Quiz = { ...quiz, questions: [{ ...calculation, rubric: [
  { description: 'Derivation', score: 2 }, { description: 'Roots', score: 2 }, { description: 'Check', score: 2 },
] }] }
const drawingRubricQuiz: Quiz = { ...quiz, questions: [{ ...drawing, rubric: [
  { description: 'Shape', score: 1 }, { description: 'Inputs', score: 1 },
  { description: 'Output', score: 1 }, { description: 'Expression', score: 1 },
] }] }
const calcQuestion = calcRubricQuiz.questions[0] as CalculationQuestion
const drawingQuestion = drawingRubricQuiz.questions[0] as DrawingQuestion
const calcAnswer: AnswerMap = { [calcQuestion.id]: { type: 'calculation', text: '2x^2-7x+3=(2x-1)(x-3)' } }
const drawingAnswer: AnswerMap = { [drawingQuestion.id]: { type: 'drawing', strokes: [
  { tool: 'pen', color: '#202b38', width: 2, points: [{ x: 5, y: 5 }, { x: 20, y: 20 }] },
] } }

type AiRubricJudgment = Extract<TrustedRubricJudgment, { source: 'ai' }>
type SystemRubricJudgment = Extract<TrustedRubricJudgment, { source: 'system' }>

function rubricJudgment(question: CalculationQuestion | DrawingQuestion, awards: number[]): AiRubricJudgment {
  const criteria = question.rubric.map((criterion, index) => {
    const maxScore = criterion.score!
    const awardedScore = awards[index]
    return { criterionId: `r${index + 1}`, maxScore, awardedScore,
      status: awardedScore === maxScore ? 'full' as const : awardedScore === 0 ? 'none' as const : 'partial' as const,
      feedback: `Criterion ${index + 1}` }
  })
  return { questionId: question.id, questionType: question.type, answerHash: 'a'.repeat(64),
    source: 'ai', status: awards.reduce((sum, score) => sum + score, 0) === question.points ? 'correct'
      : awards.every((score) => score === 0) ? 'incorrect' : 'partial',
    score: awards.reduce((sum, score) => sum + score, 0), maxScore: question.points, criteria,
    confidence: 'medium', summary: '作答符合部分評分規準。', model: 'gpt-6-luna', reasoningEffort: 'medium',
    ...(question.type === 'calculation' ? { strengths: ['推導方向正確'], improvements: ['補上檢查'] }
      : { observations: ['可辨認主要圖形'], missingOrUnclear: ['輸出標籤不清楚'] }) }
}

function systemBlank(question: CalculationQuestion | DrawingQuestion): SystemRubricJudgment {
  return { questionId: question.id, questionType: question.type, answerHash: 'b'.repeat(64),
    source: 'system', status: 'unanswered', score: 0, maxScore: question.points, criteria: [] }
}

describe('pure v3 rubric grading', () => {
  it('grades calculation as full, partial, zero, or unanswered', () => {
    expect(gradeQuizV3(calcRubricQuiz, calcAnswer, [], [rubricJudgment(calcQuestion, [2, 2, 2])]))
      .toMatchObject({ score: 6, maxScore: 6, correctCount: 1, partialCount: 0, incorrectCount: 0, unansweredCount: 0, manualCount: 0,
        questions: [{ status: 'correct', source: 'ai', score: 6, maxScore: 6 }] })
    expect(gradeQuizV3(calcRubricQuiz, calcAnswer, [], [rubricJudgment(calcQuestion, [2, 1, 0])]))
      .toMatchObject({ score: 3, partialCount: 1, correctCount: 0,
        questions: [{ status: 'partial', score: 3, maxScore: 6, source: 'ai' }] })
    expect(gradeQuizV3(calcRubricQuiz, calcAnswer, [], [rubricJudgment(calcQuestion, [0, 0, 0])]))
      .toMatchObject({ score: 0, incorrectCount: 1, partialCount: 0,
        questions: [{ status: 'incorrect', score: 0, maxScore: 6 }] })
    expect(gradeQuizV3(calcRubricQuiz, {}, [], [systemBlank(calcQuestion)]))
      .toMatchObject({ score: 0, maxScore: 6, unansweredCount: 1,
        questions: [{ status: 'unanswered', score: 0, maxScore: 6, source: 'system' }] })
    expect(() => gradeQuizV3(calcRubricQuiz, {}, [], [])).toThrow('Incomplete official rubric judgments')
  })

  it('grades drawing as full, partial, zero, or unanswered', () => {
    expect(gradeQuizV3(drawingRubricQuiz, drawingAnswer, [], [rubricJudgment(drawingQuestion, [1, 1, 1, 1])]))
      .toMatchObject({ score: 4, maxScore: 4, correctCount: 1,
        questions: [{ status: 'correct', source: 'ai', score: 4, maxScore: 4 }] })
    expect(gradeQuizV3(drawingRubricQuiz, drawingAnswer, [], [rubricJudgment(drawingQuestion, [1, 0.5, 0, 0.25])]))
      .toMatchObject({ score: 1.75, partialCount: 1,
        questions: [{ status: 'partial', score: 1.75, maxScore: 4, confidence: 'medium', observations: ['可辨認主要圖形'] }] })
    expect(gradeQuizV3(drawingRubricQuiz, drawingAnswer, [], [rubricJudgment(drawingQuestion, [0, 0, 0, 0])]))
      .toMatchObject({ score: 0, incorrectCount: 1,
        questions: [{ status: 'incorrect', score: 0, maxScore: 4 }] })
    expect(gradeQuizV3(drawingRubricQuiz, {}, [], [systemBlank(drawingQuestion)]))
      .toMatchObject({ score: 0, maxScore: 4, unansweredCount: 1,
        questions: [{ status: 'unanswered', score: 0, maxScore: 4, source: 'system' }] })
    const erasedDrawing: AnswerMap = { [drawingQuestion.id]: { type: 'drawing', strokes: [
      { tool: 'pen', color: '#202b38', width: 2, points: [{ x: 2, y: 2 }, { x: 20, y: 20 }] },
      { tool: 'eraser', color: '#202b38', width: 8, points: [{ x: 2, y: 2 }, { x: 20, y: 20 }] },
    ] } }
    expect(gradeQuizV3(drawingRubricQuiz, erasedDrawing, [], [systemBlank(drawingQuestion)]))
      .toMatchObject({ score: 0, unansweredCount: 1, questions: [{ source: 'system', status: 'unanswered' }] })
  })

  it('aggregates all six question types and counts partial credit', () => {
    const answers: AnswerMap = {
      q1: { type: 'single', optionId: 'b' }, q2: { type: 'single', optionId: 'b' },
      q3: { type: 'multiple', optionIds: ['b', 'c', 'd'] }, q4: { type: 'true-false', value: true },
      q5: { type: 'fill', text: 'XOR' }, ...calcAnswer, ...drawingAnswer,
    }
    const result = gradeQuizV3(quiz, answers, [{ questionId: 'q5', source: 'rule', status: 'correct', reason: null }], [
      rubricJudgment(calculation, [2, 1, 0]), rubricJudgment(drawing, [1, 1, 0, 0]),
    ])
    expect(result).toMatchObject({ score: 15, maxScore: 20, correctCount: 5, partialCount: 2,
      incorrectCount: 0, unansweredCount: 0, manualCount: 0 })
  })

  it('rejects malformed, misbound, and structurally incomplete trusted judgments', () => {
    const valid = rubricJudgment(calcQuestion, [2, 1, 0])
    const rejects = (judgment: unknown) => expect(() =>
      gradeQuizV3(calcRubricQuiz, calcAnswer, [], [judgment as TrustedRubricJudgment])).toThrow()
    rejects({ ...valid, score: Number.NaN })
    rejects({ ...valid, questionId: 'wrong-question' })
    rejects({ ...valid, questionType: 'drawing' })
    rejects({ ...valid, maxScore: valid.maxScore - 1 })
    rejects({ ...valid, criteria: valid.criteria.map((criterion, index) => index === 1
      ? { ...criterion, criterionId: valid.criteria[0].criterionId } : criterion) })
    rejects({ ...valid, criteria: valid.criteria.slice(0, 2) })
    rejects({ ...valid, criteria: [...valid.criteria, { criterionId: 'r4', awardedScore: 0, maxScore: 1, status: 'none' }] })
    rejects({ ...valid, criteria: valid.criteria.map((criterion, index) => index === 0
      ? { ...criterion, awardedScore: 1 } : criterion) })
    rejects({ ...valid, criteria: valid.criteria.map((criterion, index) => index === 1
      ? { ...criterion, status: 'full' } : criterion) })
    rejects({ ...valid, answerHash: 'not-an-answer-hash' })
    rejects({ ...valid, status: 'incorrect' })
    rejects({ ...valid, model: 'gpt-6-astra' })
    rejects({ ...valid, reasoningEffort: 'low' })
  })

  it('requires explicit persisted blank evidence and rejects malformed answer-state evidence', () => {
    expect(() => gradeQuizV3(drawingRubricQuiz, {}, [], [])).toThrow('Incomplete official rubric judgments')
    expect(() => gradeQuizV3(drawingRubricQuiz, {}, [], [
      { ...systemBlank(drawingQuestion), questionId: 'wrong-question' },
    ])).toThrow()
    expect(() => gradeQuizV3(calcRubricQuiz, calcAnswer, [], [systemBlank(calcQuestion)])).toThrow()
    expect(() => gradeQuizV3(calcRubricQuiz, {}, [], [{ ...systemBlank(calcQuestion), score: 1 }])).toThrow()
  })

  it('leaves deterministic-v1 and semantic-fill-v2 historical grades unchanged', () => {
    const historicalAnswers: AnswerMap = { q5: { type: 'fill', text: 'Exclusive OR' },
      q6: { type: 'calculation', text: 'x=3' }, q7: { type: 'drawing', strokes: [] } }
    const deterministic = gradeQuiz(quiz, historicalAnswers)
    expect(deterministic).toMatchObject({ score: 0, maxScore: 10, correctCount: 0, partialCount: 0,
      incorrectCount: 1, unansweredCount: 4, manualCount: 2 })
    expect(deterministic.questions.find((grade) => grade.questionId === 'q6'))
      .toMatchObject({ status: 'manual', score: null, maxScore: null })
    const semanticFill = gradeQuizV2Compatibility(quiz, historicalAnswers)
    expect(semanticFill).toMatchObject({ score: 2, maxScore: 10, correctCount: 1, partialCount: 0,
      incorrectCount: 0, unansweredCount: 4, manualCount: 2 })
    expect(semanticFill.questions.find((grade) => grade.questionId === 'q5'))
      .toMatchObject({ status: 'correct', source: 'ai' })
    expect(semanticFill.questions.find((grade) => grade.questionId === 'q6'))
      .toMatchObject({ status: 'manual', score: null, maxScore: null })
  })
})

function gradeQuizV2Compatibility(sourceQuiz: Quiz, answers: AnswerMap) {
  // Kept local to this historical assertion so v3 fixtures do not alter v2 semantics.
  return gradeQuizWithFillJudgments(sourceQuiz, answers, [
    { questionId: 'q5', source: 'ai', status: 'correct', reason: 'The response expresses the same concept.' },
  ])
}
