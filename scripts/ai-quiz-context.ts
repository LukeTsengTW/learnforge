import type { Quiz, Question } from '../src/models/quiz'

const bytes = (value: string) => new TextEncoder().encode(value).length
function bounded(value: string, max: number, label: string) {
  if (bytes(value) > max) throw new Error(`${label} exceeds ${max} UTF-8 bytes`)
}

export function toTutorContext(quiz: Quiz, question: Question) {
  const identity = `${quiz.id}/${quiz.revision}/${question.id}`
  bounded(question.prompt, 8192, `${identity} prompt`)
  bounded(question.solution, 12288, `${identity} solution`)
  bounded(question.hint ?? '', 4096, `${identity} hint`)
  if (question.rubric.length > 20) throw new Error(`${identity} has too many rubric items`)
  bounded(JSON.stringify(question.rubric), 8192, `${identity} rubric`)
  const context: Record<string, unknown> = {
    quizId: quiz.id, revision: quiz.revision, questionId: question.id, type: question.type,
    prompt: question.prompt, hint: question.hint, solution: question.solution, rubric: question.rubric,
  }
  switch (question.type) {
    case 'single':
      context.options = question.options
      context.correctOptionId = question.correctOptionId
      break
    case 'multiple':
      context.options = question.options
      context.correctOptionIds = question.correctOptionIds
      break
    case 'true-false': context.correctAnswer = question.correctAnswer; break
    case 'fill': context.correctAnswer = question.correctAnswer; context.match = question.match; break
    case 'calculation':
    case 'drawing': context.referenceAnswer = question.referenceAnswer; break
  }
  if (question.type === 'single' || question.type === 'multiple') {
    if (question.options.length > 12) throw new Error(`${identity} has too many options`)
    for (const option of question.options) bounded(option.content, 2048, `${identity} option`)
  }
  bounded(JSON.stringify(context), 32768, `${identity} context`)
  return context
}
