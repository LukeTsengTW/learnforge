// @vitest-environment jsdom
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Markdown } from '../../components/Markdown'
import { requiresV4Draft } from '../../lib/draft-v4'
import { inspectQuiz, publicationErrors } from '../author/authoring-core'
import { toTutorContext } from '../../../scripts/ai-quiz-context'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { bundledQuizSources, quizCatalog } from './quiz-loader'

const id = 'discrete-math-ch7-relations-second-examples'
const title = '離散數學第七章：關係－第二回－例題練習'
const source = Object.values(bundledQuizSources).find((value) => value.includes('id="discrete-math-ch7-relations-second-examples"'))!
const quiz = quizCatalog.getQuizRevision(id, '1')!
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const unitHeadings = [
  '### 關係例：由 $A\\times A$ 的子集合判斷關係（投影片第 2 頁）',
  '### 例題 7.1：小於等於關係與模 $7$ 關係（投影片第 3 頁）',
  '### 例題 7.4：反身關係（投影片第 4 頁）',
  '### 例題 7.5：反身關係的個數（投影片第 5 頁）',
  '### 例題 7.6：反身性與對稱性（投影片第 6 頁）',
  '### 對稱關係的個數（投影片第 7 頁）',
  '### 例題 7.10：判斷遞移性（投影片第 8 頁）',
  '### 例題 7.8：整除關係的性質（投影片第 9 頁）',
  '### 例題 7.9：由乘積符號定義的關係（投影片第 10 頁）',
  '### 例題 7.12：對稱與反對稱（投影片第 11 頁）',
  '### 反對稱關係的個數（投影片第 12–13 頁）',
  '### 等價關係例：$A=\\{1,2,3\\}$ 上的四個關係（投影片第 15 頁）',
  '### Example 7.15：整除關係形成偏序（投影片第 16 頁）',
  '### 偏序補充：子集合關係（投影片第 17 頁）',
  '### 等價關係補充：和為偶數（投影片第 18 頁）',
  '### 例題 7.52：集合的分割（投影片第 43 頁）',
  '### 等價類例：由關係 $R_1$ 求分割（投影片第 44 頁）',
  '### 例題 7.54：模 $4$ 的等價關係（投影片第 45 頁）',
  '### 例題 7.55：平方相等的等價關係（投影片第 46 頁）',
  '### 例題 7.56：有限集合上的等價類（投影片第 47 頁）',
  '### 例題 7.58：由分割建立等價關係（投影片第 49 頁）',
]
const question = (questionId: string) => quiz.questions.find((candidate) => candidate.id === questionId)!

afterEach(cleanup)

describe('Chapter 7 relations, second examples', () => {
  it('publishes revision 1 with exactly 21 handwriting-capable calculations worth 150 points', () => {
    expect(quiz).toMatchObject({ id, revision: '1', current: true, title, subject: '離散數學', estimatedMinutes: 120 })
    expect(quiz.questions.map((item) => item.id)).toEqual(Array.from({ length: 21 }, (_, index) => 'q' + String(index + 1).padStart(2, '0')))
    expect(quiz.questions.reduce((sum, item) => sum + item.points, 0)).toBe(150)
    expect(quiz.questions.every((item) => item.type === 'calculation' && item.drawing?.width === 1200 && item.drawing.height === 900)).toBe(true)
    expect(quiz.questions.every((item) => item.rubric.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0) === item.points)).toBe(true)
    expect(new Set(quiz.questions.flatMap((item) => item.tags))).toEqual(new Set(quiz.tags))
    expect(quiz.tags).toEqual(['relations', 'reflexive', 'symmetric', 'antisymmetric', 'transitive',
      'partial-orders', 'equivalence-relations', 'partitions', 'equivalence-classes'])
    expect(requiresV4Draft(quiz)).toBe(true)
    expect(publicationErrors(quiz)).toEqual([])
    expect(inspectQuiz(quiz)).toMatchObject({ questionCount: 21, totalDeclaredPoints: 150, deterministicMax: 0,
      calculationDrawingPoints: 150, questionTypes: { single: 0, multiple: 0, 'true-false': 0, fill: 0, calculation: 21, drawing: 0 } })
    expect(quizCatalog.getCurrentQuiz(id)).toBe(quiz)
    expect(quizCatalog.getQuizRevision(id, '2')).toBeNull()
    expect(quizCatalog.errors).toEqual([])
  })

  it('keeps the exact 21 source units and slide-page order', () => {
    expect(quiz.questions.map((item) => item.prompt.split('\n')[0])).toEqual(unitHeadings)
    expect(unitHeadings.map((heading) => Number(heading.match(/第 ([\d–]+) 頁/)?.[1].split('–')[0])))
      .toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16, 17, 18, 43, 44, 45, 46, 47, 49])
    const publishedContent = quiz.questions.map((item) => {
      if (item.type !== 'calculation') throw new Error('Expected a calculation question')
      return [item.prompt, item.referenceAnswer, item.solution,
        ...item.rubric.map((criterion) => criterion.description)].join('\n')
    }).join('\n')
    expect(publishedContent).not.toMatch(/7\.2|7\.3|（略）|Hasse|關係矩陣|relation matrix|零-壹矩陣|有向圖/i)
    expect(source).toContain('來源更正：投影片此頁寫')
    expect(question('q10').prompt).toContain('A=\\{1,2,3,4\\}')
    expect(question('q10').prompt).toContain('(2,4)')
  })

  it('keeps judgment and proof work while leaving calculation prompts focused', () => {
    for (const questionId of ['q02', 'q04', 'q06', 'q11']) {
      expect(question(questionId).prompt).not.toMatch(/說明原理|為什麼|請證明|解釋原因/)
    }
    for (const questionId of ['q08', 'q09', 'q13', 'q14', 'q15', 'q18', 'q19']) {
      expect(question(questionId).prompt).toMatch(/必要的推理|證明|反例/)
    }
    expect(question('q12').prompt).toContain('不要求逐一證明')
  })

  it.each(Array.from({ length: 21 }, (_, index) => 'q' + String(index + 1).padStart(2, '0')))('%s renders without KaTeX errors and matches its canonical tutor context', (questionId) => {
      const item = question(questionId)
      expect(item.type).toBe('calculation')
      if (item.type !== 'calculation') throw new Error('Expected a calculation question')
      expect(item.rubric.reduce((sum, criterion) => sum + (criterion.score ?? 0), 0)).toBe(item.points)
      const content = [item.prompt, item.referenceAnswer, item.solution, ...item.rubric.map((criterion) => criterion.description)].join('\n\n')
      const { container } = render(<Markdown>{content}</Markdown>)
      expect(container.querySelector('.katex-error')).toBeNull()
      expect(container.querySelector('.katex')).not.toBeNull()
      const context = AI_QUIZ_CONTEXT.find((candidate) => candidate.quizId === id && candidate.revision === '1'
        && candidate.questionId === questionId)
      expect(context).toEqual(toTutorContext(quiz, item))
    })

  it('renders all source formulas and keeps the Markdown renderer contract', () => {
    const formulas = [...source.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)].map((match) => match[0])
    expect(formulas.length).toBeGreaterThan(100)
    const { container } = render(<Markdown>{formulas.join('\n\n')}</Markdown>)
    expect([...container.querySelectorAll('.katex-error')].map((error) => error.textContent)).toEqual([])
    expect(container.querySelectorAll('.katex')).toHaveLength(formulas.length)
    expect(source).not.toMatch(/^\s*\|.*\|\s*$/m)
    expect(source).not.toMatch(/<\/?[a-zA-Z][^>]*>/)
    for (const directive of ['question', 'drawing', 'answer', 'solution', 'rubric', 'end']) {
      expect(source.match(new RegExp('^:::' + directive + '\\b', 'gm'))).toHaveLength(21)
    }
  })

  it('adds 21 contexts and preserves the existing canonical context fingerprint', () => {
    const chapter8Id = 'discrete-math-ch8-inclusion-exclusion-examples'
    const midtermIds = new Set(['discrete-math-midterm-2021', 'discrete-math-midterm-2023', 'discrete-math-midterm-2024'])
    const existing = AI_QUIZ_CONTEXT.filter((context) => context.quizId !== 'economics-ch1-4-exercises'
      && context.quizId !== id && context.quizId !== chapter8Id
      && !midtermIds.has(context.quizId))
    expect(AI_QUIZ_CONTEXT).toHaveLength(211)
    expect(existing).toHaveLength(112)
    expect(AI_QUIZ_CONTEXT.filter((context) => context.quizId === id && context.revision === '1')).toHaveLength(21)
    expect(sha(existing)).toBe('f3e9710df4a12ddf38ce4b395a92d72f8fb5779c3ba11f93f24fe0c6aad8f065')
  })
})
