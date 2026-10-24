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

const id = 'digital-systems-ch4-textbook'
const quiz = quizCatalog.getQuizRevision(id, '1')!
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const all = Object.values(bundledQuizSources).map(source => parseQuiz(source, true))
afterEach(cleanup)

describe('source-audited Chapter 4 revision 1 integration', () => {
  it('publishes all 15 source units, exact points and scored v4 metadata', () => {
    expect(quizCatalog.errors).toEqual([])
    expect(quiz).toMatchObject({id,revision:'1',current:true,subject:'數位系統導論',
      title:'【課本題目】數位系統導論 - Chapter 4',estimatedMinutes:105})
    expect(quizCatalog.getCurrentQuiz(id)).toBe(quiz)
    expect(quizCatalog.getQuizRevision(id,'2')).toBeNull()
    expect(quizCatalog.current.filter(entry => entry.quiz.id===id)).toHaveLength(1)
    expect(quizCatalog.current.find(entry => entry.quiz.id===id)).toMatchObject({questionCount:15,totalPoints:97,maxPoints:0})
    expect(quiz.questions.map(q=>q.id)).toEqual(Array.from({length:15},(_,i)=>`q${String(i+1).padStart(2,'0')}`))
    expect(quiz.questions.map(q=>q.points)).toEqual([10,8,12,4,4,4,5,4,6,4,10,6,8,6,6])
    expect(requiresV4Draft(quiz)).toBe(true)
    expect(validateV4Publication(quiz)).toEqual([])
    for (const q of quiz.questions) {
      expect(q.type).toBe('calculation')
      if (q.type!=='calculation') throw new Error('Expected calculation')
      expect(q.drawing).toEqual({width:1200,height:900})
      expect(q.hint).toBeNull()
      expect(q.prompt).not.toMatch(/[\u3400-\u9fff]/)
      expect(q.referenceAnswer.trim()).not.toBe('')
      expect(q.solution.trim()).not.toBe('')
      expect(q.rubric.every(r=>r.score!==null && r.score>0 && r.description.trim()!=='')).toBe(true)
      expect(q.rubric.reduce((sum,r)=>sum+(r.score??0),0)).toBe(q.points)
    }
  })

  it('preserves the complete master baseline of 20 revisions and 447 contexts byte for byte', () => {
    const sources=Object.entries(bundledQuizSources).filter(([file])=>!file.includes(`/${id}/`) && !file.includes('/digital-systems-ch1-ch4-textbook-exercises/'))
      .map(([file,source])=>[file.split('/quizzes/')[1],source.replaceAll('\r\n','\n')])
      .sort(([a],[b])=>a.localeCompare(b))
    expect(sources).toHaveLength(20)
    expect(sha(sources)).toBe('8aadb623a360643c7aef675f2b436fae81a58bd3ba99a34f07f1a075d3444c24')
    const prior=AI_QUIZ_CONTEXT.filter(c=>c.quizId!==id && c.quizId!=='digital-systems-ch1-ch4-textbook-exercises')
    expect(prior).toHaveLength(447)
    expect(sha(prior)).toBe('1bf47d3047acd7488399668e59a9ddd8376ecf517a4ee52db391abf43d698fb8')
    // Derive the complete inventory from canonical sources; never guess a global count.
    expect(AI_QUIZ_CONTEXT).toHaveLength(all.reduce((sum,q)=>sum+q.questions.length,0))
    expect(quizCatalog.current.map(entry=>`${entry.quiz.id}/${entry.quiz.revision}`).sort())
      .toEqual(all.filter(q=>q.current).map(q=>`${q.id}/${q.revision}`).sort())
    expect(quizCatalog.current.reduce((sum,entry)=>sum+entry.questionCount,0))
      .toBe(all.filter(q=>q.current).reduce((sum,q)=>sum+q.questions.length,0))
    expect(all).toHaveLength(sources.length+1+all.filter(q=>q.id==='digital-systems-ch1-ch4-textbook-exercises').length)
    expect(AI_QUIZ_CONTEXT).toHaveLength(prior.length+quiz.questions.length+AI_QUIZ_CONTEXT.filter(c=>c.quizId==='digital-systems-ch1-ch4-textbook-exercises').length)
  })

  it('binds every generated context to the exact revision, source index and canonical fields', () => {
    const contexts=AI_QUIZ_CONTEXT.filter(c=>c.quizId===id)
    expect(contexts).toHaveLength(15)
    expect(new Set(contexts.map(c=>c.questionId)).size).toBe(15)
    for (const q of quiz.questions) expect(contexts.find(c=>c.questionId===q.id)).toEqual(toTutorContext(quiz,q))
    for (const qid of ['q02','q11','q12']) {
      expect(contexts.find(c=>c.questionId===qid)?.solution).toMatch(/Source discrepancy|source heading/)
    }
    expect(contexts.find(c=>c.questionId==='q11')?.solution).toContain('D_7')
    expect(contexts.find(c=>c.questionId==='q15')?.solution).toContain('$EN$')
  })

  it('recomputes the source answers, finite circuit tables, MUX functions and strict KaTeX', () => {
    const audit=JSON.parse(execFileSync(process.execPath,['scripts/audit-digital-systems-ch4.mjs'],{encoding:'utf8'}))
    expect(audit).toMatchObject({status:'PASS',questions:15,figures:5})
    const source=Object.values(bundledQuizSources).find(s=>s.includes(`id="${id}"`))!
    expect(audit.formulas).toBe([...source.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)].length)
  })

  it('resolves exactly the five safe same-quiz PNG source exports', () => {
    const figures=figuresForQuiz(id)
    expect(Object.keys(figures).sort()).toEqual(['figures/figure-4-2.png','figures/figure-4-30.png','figures/pe4-1.png','figures/pe4-8.png','figures/pe4-9.png'])
    expect(()=>validateQuizFigures(quiz,Object.keys(figures))).not.toThrow()
    expect(()=>validateQuizFigures('![](../other/figure.png)',Object.keys(figures))).toThrow('Invalid quiz figure')
    expect(()=>validateQuizFigures('![](figures/missing.png)',Object.keys(figures))).toThrow('Missing quiz figure')
    for (const url of Object.values(figures)) expect(url).toMatch(/digital-systems-ch4-textbook\/figures\/.*\.png/)
  })

  it('renders every canonical Markdown field with resolved images and no KaTeX errors', () => {
    const fields=quizMarkdownFields(quiz)
    const view=render(<>{fields.map((field,index)=><Markdown key={index} figures={figuresForQuiz(id)}>{field}</Markdown>)}</>)
    expect(view.container.querySelectorAll('.katex-error')).toHaveLength(0)
    expect(view.container.querySelectorAll('.quiz-figure-unavailable')).toHaveLength(0)
    expect(view.container.querySelectorAll('img')).toHaveLength(7)
    expect(view.container.textContent).not.toContain(':::')
    expect(view.container.textContent).not.toContain('$')
    expect(view.container.textContent).not.toMatch(/\|---|\| 0 \|/)
    for (const img of view.container.querySelectorAll('img')) expect(img.getAttribute('src')).toBeTruthy()
  })
})
