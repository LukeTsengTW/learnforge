// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { AI_QUIZ_CONTEXT } from '../../../supabase/functions/_shared/quiz-context.generated'
import { toTutorContext } from '../../../scripts/ai-quiz-context'
import { Markdown } from '../../components/Markdown'
import { parseQuiz } from '../../lib/quiz-parser'
import { requiresV4Draft } from '../../lib/draft-v4'
import { validateV4Publication } from '../../lib/scored-rubric'
import { quizMarkdownFields, validateQuizFigures } from '../../lib/quiz-figures'
import { bundledQuizSources, quizCatalog } from './quiz-loader'
import { figuresForQuiz } from './quiz-figures'

const id = 'digital-systems-ch1-ch4-textbook-exercises'
const quiz = quizCatalog.getQuizRevision(id, '1')!
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const all = Object.values(bundledQuizSources).map(source => parseQuiz(source, true))
afterEach(cleanup)

describe('PDF-selected Chapter 1–4 textbook exercises integration', () => {
  it('publishes exactly the 42 selected calculations with 411 points and scored v4 metadata', () => {
    expect(quizCatalog.errors).toEqual([])
    expect(quiz).toMatchObject({ id, revision: '1', current: true, subject: '數位系統導論',
      title: '【課本習題】數位系統導論 Ch1 ~ Ch4', estimatedMinutes: 360 })
    expect(quizCatalog.getCurrentQuiz(id)).toBe(quiz)
    expect(quizCatalog.getQuizRevision(id, '2')).toBeNull()
    expect(quizCatalog.current.filter(entry => entry.quiz.id === id)).toHaveLength(1)
    expect(quizCatalog.current.find(entry => entry.quiz.id === id)).toMatchObject({questionCount:42,totalPoints:411,maxPoints:0})
    expect(quiz.questions.map(q => q.id)).toEqual(Array.from({length:42}, (_,i) => `q${String(i+1).padStart(2,'0')}`))
    expect(quiz.questions.map(q => q.points)).toEqual([5,4,8,10,10,10,6,6,8,10,8,12,12,8,8,10,8,12,12,10,12,12,12,12,12,10,12,10,10,10,10,10,10,10,12,8,10,10,12,10,10,10])
    expect(requiresV4Draft(quiz)).toBe(true)
    expect(validateV4Publication(quiz)).toEqual([])
    for (const q of quiz.questions) {
      expect(q.type).toBe('calculation')
      if (q.type !== 'calculation') throw new Error('Expected calculation')
      expect(q.drawing).toEqual({width:1200,height:q.id==='q12'?1200:900})
      expect(q.hint).toBeNull()
      expect(q.prompt).not.toMatch(/[\u3400-\u9fff]/)
      expect(q.referenceAnswer.trim()).not.toBe('')
      expect(q.solution).not.toContain('核對上列答案')
      expect(q.rubric.length).toBeGreaterThan(1)
      expect(q.rubric.every(r => r.score !== null && r.score > 0 && r.description.trim() !== '')).toBe(true)
      expect(q.rubric.reduce((sum,r) => sum+(r.score??0),0)).toBe(q.points)
    }
  })

  it('preserves every previous release source and context, while deriving the complete inventory', () => {
    const previousSources = Object.entries(bundledQuizSources).filter(([file]) => !file.includes(`/${id}/`))
      .map(([file,source]) => [file.split('/quizzes/')[1],source.replaceAll('\r\n','\n')])
      .sort(([a],[b]) => a.localeCompare(b))
    expect(previousSources).toHaveLength(21)
    expect(sha(previousSources)).toBe('d831dd585bfb4c79219acc5f2e5a0ef42af4596f1c6c63f3eefd7efa6383aca0')
    const prior = AI_QUIZ_CONTEXT.filter(c => c.quizId !== id)
    expect(prior).toHaveLength(462)
    expect(sha(prior)).toBe('5de4dce95b0d9c76ce96bae43df0efa042f7172b7ca98031841392bb080b1113')
    expect(AI_QUIZ_CONTEXT).toHaveLength(all.reduce((sum,q) => sum+q.questions.length,0))
    expect(all).toHaveLength(previousSources.length+1)
    expect(quizCatalog.current.map(entry => `${entry.quiz.id}/${entry.quiz.revision}`).sort())
      .toEqual(all.filter(q => q.current).map(q => `${q.id}/${q.revision}`).sort())
    expect(quizCatalog.current.reduce((sum,entry) => sum+entry.questionCount,0))
      .toBe(all.filter(q => q.current).reduce((sum,q) => sum+q.questions.length,0))
  })

  it('generates all exact-revision canonical contexts and preserves answer-side limitations', () => {
    const contexts = AI_QUIZ_CONTEXT.filter(c => c.quizId === id)
    expect(contexts).toHaveLength(42)
    expect(new Set(contexts.map(c => c.questionId)).size).toBe(42)
    for (const q of quiz.questions) expect(contexts.find(c => c.questionId === q.id)).toEqual(toTutorContext(quiz,q))
    expect(contexts.find(c => c.questionId === 'q16')?.solution).toContain('四種完整函數對')
    expect(contexts.find(c => c.questionId === 'q30')?.referenceAnswer).toContain('cannot be satisfied exactly')
    expect(contexts.find(c => c.questionId === 'q31')?.referenceAnswer).toContain('does not specify the number of inputs')
  })

  it('recomputes the saved finite answers, canonical sets, minimum covers, gate models and strict math', () => {
    const audit = JSON.parse(execFileSync(process.execPath,['scripts/audit-digital-systems-textbook-exercises.mjs'],{encoding:'utf8'}))
    expect(audit).toMatchObject({status:'PASS',questions:42,points:411,checks:1528})
    expect(audit.figures).toEqual([
      {name:'p2-33.webp',sha256:'e38a2a88d938ce1aafea6c537aa5215456356626a6ef135374de6f0f55aa11ec'},
      {name:'p4-16.webp',sha256:'0237c903c9deb6e65850cf1c940c7a4eda03c28123ab84f64b0fd98196a14eae'},
    ])
    const source = Object.values(bundledQuizSources).find(s => s.includes(`id="${id}"`))!
    expect(audit.formulas).toBe([...source.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)].length)
  })

  it('keeps the source seven-row table and exact half-input wording without learner-facing assumptions', () => {
    const p227=quiz.questions.find(q => q.id==='q16')!
    const rows=p227.prompt.split('\n').filter(line => /^[01]&/.test(line))
    expect(rows).toHaveLength(7)
    expect(rows).toEqual(['1&1&0&0&0\\\\','0&1&0&0&1\\\\','1&0&0&1&0\\\\','1&1&0&1&1\\\\','1&0&1&0&0\\\\','0&1&1&0&1\\\\','1&0&1&1&1'])
    expect(p227.prompt).not.toMatch(/don't-care|assum|missing/i)
    const p45=quiz.questions.find(q => q.id==='q30')!
    expect(p45.prompt).toContain('When the binary input is 4, 5, 6, or 7, the binary output is half the input.')
    expect(p45.prompt).not.toMatch(/integer|shift|truncat|round|floor|assum/i)
    expect(quiz.questions.find(q => q.id==='q25')!.prompt).toContain("CD(B+C)A+(BC'+DE'),")
    expect(quiz.questions.find(q => q.id==='q25')!.prompt).not.toContain("DE')'")
  })

  it('resolves only the two safe same-quiz source crops', () => {
    const figures=figuresForQuiz(id)
    expect(Object.keys(figures).sort()).toEqual(['figures/p2-33.webp','figures/p4-16.webp'])
    expect(() => validateQuizFigures(quiz,Object.keys(figures))).not.toThrow()
    expect(() => validateQuizFigures('![](../other/figure.webp)',Object.keys(figures))).toThrow('Invalid quiz figure')
    expect(() => validateQuizFigures('![](figures/missing.webp)',Object.keys(figures))).toThrow('Missing quiz figure')
    for (const url of Object.values(figures)) expect(url).toMatch(/digital-systems-ch1-ch4-textbook-exercises\/figures\/.*\.webp/)
  })

  it('renders every canonical field and all six source/answer tables without raw syntax', () => {
    const fields=quizMarkdownFields(quiz)
    const view=render(<>{fields.map((field,index) => <Markdown key={index} figures={figuresForQuiz(id)}>{field}</Markdown>)}</>)
    expect(view.container.querySelectorAll('.katex-error')).toHaveLength(0)
    expect(view.container.querySelectorAll('.quiz-figure-unavailable')).toHaveLength(0)
    expect(view.container.querySelectorAll('img')).toHaveLength(2)
    expect(view.container.querySelectorAll('.katex-html .mtable').length).toBeGreaterThanOrEqual(6)
    expect(view.container.textContent).not.toContain(':::')
    expect(view.container.textContent).not.toContain('$')
    expect(view.container.textContent).not.toContain('|---')
    for (const img of view.container.querySelectorAll('img')) expect(img.getAttribute('src')).toBeTruthy()
  })
})
