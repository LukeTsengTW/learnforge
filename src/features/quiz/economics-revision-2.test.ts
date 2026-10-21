import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { gradeQuiz } from '../../lib/grading'
import { bundledQuizSources, quizCatalog } from './quiz-loader'
import { createMemoryPracticeRepository } from './practice-memory.test-helper'
import { mapPracticeRecord } from './practice-repository'

const id = 'economics-ch1-4-exercises'
const historical = quizCatalog.getQuizRevision(id, '1')!
const current = quizCatalog.getCurrentQuiz(id)!
const blocks = (source: string) => [...source.replace(/\r\n?/g, '\n')
  .matchAll(/^:::question[^\n]*\n[\s\S]*?^:::end[ \t]*$/gm)].map(([block]) => block)

describe('economics revision 2 promotion and historical records', () => {
  it('publishes one 52-point current revision and retains the 41-point historical revision', () => {
    const entries = quizCatalog.current.filter(({ quiz }) => quiz.id === id)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ questionCount: 52, totalPoints: 52, maxPoints: 52,
      quiz: { id, revision: '2', current: true, title: '經濟學第 1～5 章習題', subject: '經濟學', estimatedMinutes: 120 } })
    expect(historical).toMatchObject({ id, revision: '1', current: false,
      title: '經濟學第 1～4 章習題', estimatedMinutes: 90 })
    expect(historical.questions).toHaveLength(41)
    expect(gradeQuiz(historical, {}).maxScore).toBe(41)
    expect([1, 2, 3, 4, 5].map(chapter => current.questions.filter(q => q.id.startsWith(`ch${chapter}-`)).length))
      .toEqual([8, 10, 13, 10, 11])
    expect(current.questions.map(q => q.id)).toEqual([8, 10, 13, 10, 11]
      .flatMap((count, chapter) => Array.from({ length: count }, (_, i) => `ch${chapter + 1}-q${i + 1}`)))
    expect(current.questions.every(q => q.type === 'single' && q.points === 1)).toBe(true)
  })

  it('preserves every complete historical question block and its released fingerprint', () => {
    const sources = Object.values(bundledQuizSources).filter(source => source.startsWith(`@quiz id="${id}"`))
    const original = blocks(sources.find(source => source.includes('revision="1"'))!)
    const revised = blocks(sources.find(source => source.includes('revision="2"'))!)
    expect(original).toHaveLength(41)
    expect(revised).toHaveLength(52)
    expect(revised.slice(0, 41)).toEqual(original)
    expect(createHash('sha256').update(original.join('\n')).digest('hex'))
      .toBe('0be706cc4b1f82fe0173728889c74ac6101b924ba42f3a9a5f551ba284f34844')
  })

  it('resumes an existing revision 1 draft without substituting current content', async () => {
    const repo = createMemoryPracticeRepository('economics-revision-test')
    const old = await repo.getOrCreateDraft(historical)
    const resumed = await repo.getOrCreateDraft(current)
    expect(resumed.id).toBe(old.id)
    expect(resumed.quiz?.revision).toBe('1')
    expect(resumed.attempt?.quizRevision).toBe('1')
    const mapped = mapPracticeRecord({ ...resumed.row, answers: [] }, resumed.row.user_id)
    expect(mapped.quiz).toBe(historical)
    expect(mapped.quiz?.questions).toHaveLength(41)
    await repo.deleteDraft(resumed)
    const replacement = await repo.getOrCreateDraft(current)
    expect(replacement.id).not.toBe(old.id)
    expect(replacement.quiz?.revision).toBe('2')
    expect(replacement.attempt?.quizRevision).toBe('2')
  })

  it('hydrates a submitted historical result against its stored revision and max score', async () => {
    const repo = createMemoryPracticeRepository('economics-revision-test')
    const old = await repo.getOrCreateDraft(historical)
    await repo.submitDraft(old.id, old.version.updatedAt, '00000000-0000-4000-8000-000000000099')
    const submitted = (await repo.loadAttempt(old.id))!
    const mapped = mapPracticeRecord({ ...submitted.row, answers: [] }, submitted.row.user_id)
    expect(mapped.quiz).toBe(historical)
    expect(mapped.attempt).toMatchObject({ quizRevision: '1', status: 'submitted', result: { maxScore: 41 } })
    expect(mapped.quiz?.questions.some(q => q.id.startsWith('ch5-'))).toBe(false)
    expect((await repo.getOrCreateDraft(current)).quiz?.revision).toBe('2')
    expect((await repo.loadAttempt(old.id))?.attempt?.quizRevision).toBe('1')
  })
})
