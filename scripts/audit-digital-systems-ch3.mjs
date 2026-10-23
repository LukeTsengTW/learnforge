// Reproducible content evidence; no network, provider, or learner-data access.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import process from 'node:process'
import { log } from 'node:console'
import { fileURLToPath, URL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const file = 'src/content/quizzes/digital-systems-ch3-textbook/v1.quiz.md'
const source = process.argv.includes('--baseline')
  ? execFileSync('git', ['show', `9997e5675120da79ce219cb1bfc8e2a141046dad:${file}`], { cwd: root, encoding: 'utf8' })
  : fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const questions = [...source.matchAll(/:::question id="(q\d+)"[^\n]*\n([\s\S]*?):::end/g)]
const fields = new Map(questions.map(([, id, body]) => [id, {
  prompt: body.split(':::drawing')[0],
  answer: body.split(':::answer')[1].split(':::solution')[0],
  solution: body.split(':::solution')[1].split(':::rubric')[0],
}]))
let checks = 0
function check(condition, message) { assert.ok(condition, message); checks++ }

// Boolean grammar: sum (+), juxtaposed products, parentheses and postfix prime.
function value(expression, variables, row) {
  const s = expression.replaceAll(' ', '')
  let pos = 0
  function atom() {
    let result
    if (s[pos] === '(') {
      pos++; result = sum(); assert.equal(s[pos++], ')')
    } else {
      const index = variables.indexOf(s[pos++])
      assert.ok(index >= 0, `Unknown variable in ${expression}`)
      result = Boolean(row >> (variables.length - 1 - index) & 1)
    }
    while (s[pos] === "'") { pos++; result = !result }
    return result
  }
  function product() {
    let result = atom()
    while (pos < s.length && s[pos] !== ')' && s[pos] !== '+') {
      const right = atom(); result = result && right
    }
    return result
  }
  function sum() {
    let result = product()
    while (s[pos] === '+') { pos++; const right = product(); result = result || right }
    return result
  }
  const result = sum(); assert.equal(pos, s.length, expression)
  return result
}
function primes(variables, on, dc = []) {
  const rows = Array.from({ length: 2 ** variables.length }, (_, i) => i)
  const cubes = []
  for (let code = 0; code < 3 ** variables.length; code++) {
    let rest = code
    const digits = [...variables].map(() => { const d = rest % 3; rest = Math.floor(rest / 3); return d })
    const covered = rows.filter(row => digits.every((d, j) => d === 2 || d === (row >> (variables.length - 1 - j) & 1)))
    if (covered.some(m => on.includes(m)) && covered.every(m => on.includes(m) || dc.includes(m))) {
      cubes.push({ term: digits.map((d, i) => d === 2 ? '' : variables[i] + (d === 0 ? "'" : '')).join(''), covered })
    }
  }
  return cubes.filter(a => !cubes.some(b => b.covered.length > a.covered.length && a.covered.every(m => b.covered.includes(m))))
}
function minimum(variables, on, dc = []) {
  const cubes = primes(variables, on, dc)
  let best = [Infinity, Infinity]
  for (let mask = 1; mask < 2 ** cubes.length; mask++) {
    const selected = cubes.filter((_, i) => mask >> i & 1)
    if (!on.every(m => selected.some(c => c.covered.includes(m)))) continue
    const cost = [selected.length, selected.reduce((s, c) => s + c.term.replaceAll("'", '').length, 0)]
    if (cost[0] < best[0] || cost[0] === best[0] && cost[1] < best[1]) best = cost
  }
  return best
}
// Independent source-derived minterms and saved-answer expressions.
const cases = [
  ['q01','xyz',[2,3,4,5],["x'y+xy'"]],
  ['q02','xyz',[3,4,6,7],["yz+xz'"]],
  ['q03','xyz',[0,2,4,5,6],["z'+xy'"]],
  ['q04','ABC',[1,2,3,5,7],["C+A'B"]],
  ['q05','xyz',[0,1,6,7],["xy+x'y'"]],
  ['q06','xyz',[0,1,2,5],["x'z'+y'z"]],
  ['q07','xyz',[0,2,3,4,6],["z'+x'y"]],
  ['q08','xyz',[1,2,3,5,7],["z+x'y"]],
  ['q09','wxyz',[0,1,2,4,5,6,8,9,12,13,14],["y'+w'z'+xz'"]],
  ['q10','ABCD',[0,1,2,6,8,9,10],["B'D'+B'C'+A'CD'"]],
  ['q11','wxyz',[0,1,3,8,9,10,11,12,13,14,15],["x'y'+x'z+w"]],
  ['q12','wxyz',[0,2,4,6,8,10,11],["w'z'+x'z'+wx'y"]],
  ['q14','ABCD',[0,1,2,5,8,9,10],["(A'+B')(C'+D')(B'+D)","B'D'+B'C'+A'C'D"]],
  ['q15','wxyz',[0,2,8,10,12,13,14],["x'z'+wz'+wxy'","(w+x')(y'+z')(x+z')"]],
  ['q16','wxyz',[1,3,7,11,15],["yz+w'x'","yz+w'z"],[0,2,5]],
  ['q17','wxyz',[4,5,6,7,12],["xy'+xw'"],[0,8,13]],
  ['q18','ABCD',[3,7,11,12,13,14,15],["((AB)'(CD)')'"]],
  ['q19','xyz',[1,2,3,4,5,7],["xy'+x'y+z"]],
  ['q20','xyz',[0,1,3,5,6,7],["x'y'+xy+z"]],
  ['q21','ABCDE',Array.from({length:32},(_,i)=>i).filter(i=>(i&1)&&((i&16)||(i&8))&&((i&4)||(i&2))),["[(A+B)'+(C+D)'+E']'".replaceAll('[','(').replaceAll(']',')')]],
  ['q22','ABCD',[4,6,7,8,10,11],["(AB'+A'B)(C+D')"]],
  ['q23','wxyz',[4,6,7,8,10,11],["(y+z')(wx'+w'x)"]],
  ['q24','xyz',[0,6],["(x'y+xy'+z)'","x'y'z'+xyz'","((x+y+z)(x'+y'+z))'"]],
]
check(questions.length === 24, '24 source questions')
for (const [id, vars, on, expressions, dc = []] of cases) {
  const q = fields.get(id)
  for (const expression of expressions) {
    const bound = expression === "((A+B)'+(C+D)'+E')'" ? "[(A+B)'+(C+D)'+E']'" : expression
    check(q.answer.includes(bound), `${id}: saved answer must contain ${bound}`)
    for (let row = 0; row < 2 ** vars.length; row++) {
      if (!dc.includes(row)) check(value(expression, vars, row) === on.includes(row), `${id}: ${expression} at ${row}`)
    }
    // SOPs are checked for minimum term/literal cost as well as equivalence.
    if (!expression.includes('(')) {
      const cost = [expression.split('+').length, expression.replaceAll('+','').replaceAll("'",'').length]
      check(JSON.stringify(cost) === JSON.stringify(minimum(vars,on,dc)), `${id}: nonminimal SOP`)
    }
    if (id === 'q14' && expression.startsWith('(A') || id === 'q15' && expression.startsWith('(w')) {
      const zeros = Array.from({length:2**vars.length},(_,i)=>i).filter(i=>!on.includes(i))
      const cost = [expression.split(')(').length, expression.replace(/[^A-Za-z]/g,'').length]
      check(JSON.stringify(cost) === JSON.stringify(minimum(vars,zeros)), `${id}: nonminimal POS`)
    }
  }
}
for (const [id,vars,expression,on] of [
  ['q04','ABC',"A'C+A'B+AB'C+BC",[1,2,3,5,7]],
  ['q08','xyz',"xy'z+x'y+x'z+yz",[1,2,3,5,7]],
  ['q10','ABCD',"A'B'C'+B'CD'+A'BCD'+AB'C'",[0,1,2,6,8,9,10]],
]) {
  check(fields.get(id).prompt.includes(expression), `${id}: unchanged source formula`)
  for(let row=0;row<2**vars.length;row++) check(value(expression,vars,row)===on.includes(row),`${id}: original function ${row}`)
}
const pi = primes('wxyz',[0,2,4,5,6,7,8,10,13,14,15]).map(c=>c.term).sort()
const printed = [...fields.get('q13').answer.matchAll(/([wxyz]'?)+/g)].map(m=>m[0]).sort()
check(JSON.stringify(printed)===JSON.stringify(pi), `q13: all prime implicants ${pi}`)
check(!value("x'z'",'wxyz',1) && value("x'y'",'wxyz',1), 'PE3.7 typo counterexample m1')
const table = [...fields.get('q15').answer.matchAll(/([01]{4})&([01])/g)]
check(table.length===16,'PE3.8 table length')
table.forEach(([,row,out],i)=>check(parseInt(row,2)===i && Number(out)===Number([0,2,8,10,12,13,14].includes(i)),`PE3.8 row ${i}`))
check(fields.get('q23').answer.includes("(w'x+wx')'"), 'PE3.11 corrected plus')
check(fields.get('q16').solution.includes('兩種化簡'), 'both dont-care choices supported')
for(const [id,vars,gate,expected] of [
  ['q19','xyz',"((xy')'(x'y)'z')'","xy'+x'y+z"],
  ['q20','xyz',"((x'y')'(xy)'z')'","x'y'+xy+z"],
  ['q22','ABCD',"((AB'+A'B)'+(C+D')')'","(AB'+A'B)(C+D')"],
  ['q23','wxyz',"((y+z')'+(w'x+wx')')'","(y+z')(wx'+w'x)"],
]) {
  check(fields.get(id).solution.replaceAll('[','(').replaceAll(']',')').includes(gate),`${id}: saved gate expression`)
  for(let row=0;row<2**vars.length;row++) check(value(gate,vars,row)===value(expected,vars,row),`${id}: gate topology ${row}`)
}
log(JSON.stringify({status:'PASS',checks,questions:questions.length,primeImplicants:pi,source:'58 rendered slides; source inventory documented separately'},null,2))
