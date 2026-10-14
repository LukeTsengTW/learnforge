import { describe, expect, it } from 'vitest'
import { DRAFT_V4_LIMITS, draftAnswersBytes } from '../../supabase/functions/_shared/draft-v4'
import { quizCatalog } from '../features/quiz/quiz-loader'
import type { DraftAnswerMapV4, PracticeAnswer, QuizDraftV4 } from '../models/draft-v4'
import type { DrawingStroke } from '../models/drawing'
import type { Quiz } from '../models/quiz'
import { answerQuizDraftV4, decodeDraftAnswersV4, decodeQuizDraftV4, draftAnswerMapBytes, draftAnswerProblemV4 } from './draft-v4'

/**
 * Saving refuses a draft whose answers exceed DRAFT_V4_LIMITS.maxAnswerBytes. An answer update is
 * therefore only taken when the whole draft still fits, so that nothing the editor shows as part of
 * the answer can be impossible to save for its size.
 */
const template = quizCatalog.getQuizRevision('demo', 'v1-7d7c900e')!.questions.find((question) => question.type === 'calculation')!
/** Twenty handwriting-capable calculation questions: enough to reach the cap with long typed answers. */
const quiz: Quiz = { ...quizCatalog.getQuizRevision('demo', 'v1-7d7c900e')!, revision: 'capacity-v4',
  questions: Array.from({ length: 20 }, (_, index) => ({ ...template, id: `c${String(index + 1).padStart(2, '0')}`, drawing: { width: 1200, height: 900 } })) }
const now = '2026-10-13T10:00:00.000Z'
const empty = (): QuizDraftV4 => ({ schemaVersion: 2, quizId: quiz.id, quizRevision: quiz.revision, status: 'in-progress',
  startedAt: now, updatedAt: now, answers: {} })
const CAP = DRAFT_V4_LIMITS.maxAnswerBytes
let seed = 20261013
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const pick = (low: number, high: number) => low + Math.floor(random() * (high - low + 1))
/** A handwriting-sized stroke: short steps from a random start, so it stays far below the geometry limit. */
function stroke(points: number): DrawingStroke {
  let x = 50 + random() * 1100, y = 50 + random() * 800
  return { tool: random() < 0.2 ? 'eraser' : 'pen', color: '#202b38', width: pick(1, 24),
    points: Array.from({ length: points }, () => {
      x = Math.max(0, Math.min(1200, x + 10 * (random() - 0.5))); y = Math.max(0, Math.min(900, y + 10 * (random() - 0.5)))
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
    }) }
}
/** A typed answer of `chars` characters; CJK characters take three bytes each. */
const typed = (chars: number, cjk = true): PracticeAnswer => ({ type: 'calculation', mode: 'text', text: (cjk ? '題' : 'x').repeat(chars), strokes: [] })
const written = (strokes: DrawingStroke[], text = ''): PracticeAnswer => ({ type: 'calculation', mode: 'drawing', text, strokes })
const question = (index: number) => quiz.questions[index].id

describe('size of a draft as the save path measures it', () => {
  it('equals the UTF-8 size of the compact JSON of the answers, for empty, typed, CJK and handwritten drafts', () => {
    expect(draftAnswerMapBytes({})).toBe(draftAnswersBytes({}))
    expect(draftAnswerMapBytes({})).toBe(2)
    for (let round = 0; round < 60; round++) {
      let draft = empty()
      for (let update = pick(1, 12); update > 0; update--) {
        const answer = random() < 0.5 ? typed(pick(0, 3000), random() < 0.7)
          : written(Array.from({ length: pick(0, 12) }, () => stroke(pick(1, 40))), random() < 0.3 ? '混合 text ✓' : '')
        draft = answerQuizDraftV4(quiz, draft, question(pick(0, 19)), answer, now)
        // The cached per-answer sizes add up to exactly what one serialization of the map gives.
        expect(draftAnswerMapBytes(draft.answers)).toBe(draftAnswersBytes(draft.answers))
      }
      expect(draftAnswerMapBytes(draft.answers)).toBe(new TextEncoder().encode(JSON.stringify(draft.answers)).length)
    }
  })

  it('leaves room for the rest of a save request: a draft is at most a few hundred bytes larger than its answers', () => {
    const draft = answerQuizDraftV4(quiz, empty(), question(0), typed(1000), now)
    const envelope = new TextEncoder().encode(JSON.stringify(draft)).length - draftAnswersBytes(draft.answers)
    expect(envelope).toBeLessThan(DRAFT_V4_LIMITS.maxRequestBytes - DRAFT_V4_LIMITS.maxAnswerBytes)
  })
})

describe('an update that would make the draft too large to save is not taken', () => {
  /** A draft filled with long typed answers until `left` bytes remain below the cap (exactly). */
  function filled(left: number): QuizDraftV4 {
    let draft = empty()
    let index = 1
    const room = () => CAP - left - draftAnswerMapBytes(draft.answers)
    // Answers of 300 kB, then of 90 kB, then one ASCII answer of the right length closes the gap to the byte.
    for (; room() > 300_200; index++) draft = answerQuizDraftV4(quiz, draft, question(index), typed(100_000), now)
    for (; room() > 95_000; index++) draft = answerQuizDraftV4(quiz, draft, question(index), typed(90_000, false), now)
    const before = draftAnswerMapBytes(draft.answers)
    const overhead = draftAnswerMapBytes(answerQuizDraftV4(quiz, draft, question(index), typed(0, false), now).answers) - before
    draft = answerQuizDraftV4(quiz, draft, question(index), typed(CAP - left - before - overhead, false), now)
    expect(draftAnswerMapBytes(draft.answers)).toBe(CAP - left)
    return draft
  }

  it('accepts an update that fills the draft exactly to the cap and refuses the one byte after it', () => {
    const draft = filled(1000)
    const base = draftAnswerMapBytes(answerQuizDraftV4(quiz, draft, question(0), typed(100, false), now).answers)
    const exact = typed(100 + CAP - base, false)
    const atCap = answerQuizDraftV4(quiz, draft, question(0), exact, now)
    expect(draftAnswerMapBytes(atCap.answers)).toBe(CAP)
    expect(draftAnswerProblemV4(quiz, draft, question(0), exact)).toBeNull()
    expect(decodeQuizDraftV4(JSON.stringify(atCap), quiz)).not.toBeNull()
    const over = typed(101 + CAP - base, false)
    expect(answerQuizDraftV4(quiz, draft, question(0), over, now)).toBe(draft)
    expect(draftAnswerProblemV4(quiz, draft, question(0), over)).toBe('draft-oversized')
  })

  it('names the answer limit, not the draft, when the answer alone is refused', () => {
    const draft = filled(1000)
    expect(draftAnswerProblemV4(quiz, draft, question(0), typed(100_001))).toBe('oversized')
    expect(draftAnswerProblemV4(quiz, draft, 'missing', typed(1))).toBe('invalid')
  })

  it('whatever sequence of updates is taken, the draft passes the size checks of loading and saving', () => {
    let draft = filled(400_000)
    let refused = 0, taken = 0
    for (let round = 0; round < 240; round++) {
      // Mostly long typed answers, so that the draft keeps running into the cap; some short ones and handwriting.
      const kind = random()
      const answer = kind < 0.85 ? typed(pick(80_000, 100_000)) : kind < 0.9 ? typed(pick(0, 100_000), false)
        : written(Array.from({ length: pick(0, 60) }, () => stroke(pick(1, 90))), random() < 0.2 ? '題'.repeat(pick(0, 40_000)) : '')
      const id = question(pick(0, 19))
      const next = answerQuizDraftV4(quiz, draft, id, answer, now)
      const problem = draftAnswerProblemV4(quiz, draft, id, answer)
      if (next === draft) {
        // Refused: for the size of the whole draft, and only when it really would not fit. The size is
        // measured here by one serialization of the map the update would have produced.
        expect(problem).toBe('draft-oversized')
        if (refused++ < 25) expect(draftAnswersBytes({ ...draft.answers, [id]: decodeDraftAnswersV4(quiz, { [id]: answer })![id] })).toBeGreaterThan(CAP)
        continue
      }
      expect(problem).toBeNull()
      draft = next
      // Every eighth draft that was taken goes through the strict loader and the validation that saving runs.
      if (taken++ % 8 === 0) {
        expect(draftAnswersBytes(draft.answers)).toBeLessThanOrEqual(CAP)
        expect(decodeDraftAnswersV4(quiz, draft.answers)).not.toBeNull()
        expect(decodeQuizDraftV4(JSON.stringify(draft), quiz)).not.toBeNull()
      }
    }
    expect(decodeQuizDraftV4(JSON.stringify(draft), quiz)).not.toBeNull()
    // Both outcomes occurred many times.
    expect(refused).toBeGreaterThan(30)
    expect(taken).toBeGreaterThan(30)
  }, 30_000)

  it('never refuses an update that does not grow the draft, even when the draft is already above the cap', () => {
    // No loader produces such a draft (see below); the rule still has to let a user get out of it.
    const answers: DraftAnswerMapV4 = {}
    for (let index = 0; index < 16; index++) answers[question(index)] = decodeDraftAnswersV4(quiz, { [question(index)]: typed(100_000) })![question(index)]
    const tooLarge: QuizDraftV4 = { ...empty(), answers }
    expect(draftAnswerMapBytes(tooLarge.answers)).toBeGreaterThan(CAP)
    expect(decodeQuizDraftV4(JSON.stringify(tooLarge), quiz)).toBeNull()
    // Shorter text for one question: taken, although the draft is still too large to save.
    const smaller = answerQuizDraftV4(quiz, tooLarge, question(0), typed(50_000), now)
    expect(smaller).not.toBe(tooLarge)
    expect(draftAnswerMapBytes(smaller.answers)).toBeLessThan(draftAnswerMapBytes(tooLarge.answers))
    // Clearing an answer and rewriting it with the same size are taken as well.
    expect(answerQuizDraftV4(quiz, tooLarge, question(1), typed(0), now)).not.toBe(tooLarge)
    expect(answerQuizDraftV4(quiz, tooLarge, question(2), typed(100_000), now)).not.toBe(tooLarge)
    // Anything that grows it is refused for the draft size.
    expect(answerQuizDraftV4(quiz, tooLarge, question(17), typed(10), now)).toBe(tooLarge)
    expect(draftAnswerProblemV4(quiz, tooLarge, question(17), typed(10))).toBe('draft-oversized')
  })
})
