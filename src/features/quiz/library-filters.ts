import type { QuestionType } from '../../models/quiz'
import type { QuizCatalogEntry } from './quiz-loader'

export interface LibraryFilters {
  search: string
  tag: string
  subject: string
  questionType: QuestionType | ''
}

export function getLibraryFilterOptions(entries: readonly QuizCatalogEntry[]) {
  return {
    tags: [...new Set(entries.flatMap(({ quiz }) => quiz.tags))],
    subjects: [...new Set(entries.map(({ quiz }) => quiz.subject))],
  }
}

export function filterLibraryEntries(entries: readonly QuizCatalogEntry[], filters: LibraryFilters) {
  const query = filters.search.trim().toLowerCase()
  return entries.filter(({ quiz }) =>
    (!filters.tag || quiz.tags.includes(filters.tag)) &&
    (!filters.subject || quiz.subject === filters.subject) &&
    (!filters.questionType || quiz.questions.some((question) => question.type === filters.questionType)) &&
    (!query || [quiz.title, quiz.description, quiz.subject, ...quiz.tags]
      .some((value) => value.toLowerCase().includes(query))))
}
