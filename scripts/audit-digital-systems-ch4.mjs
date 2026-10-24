// Source-bound Chapter 4 checks; no network, provider, or learner-data access.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, lstatSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { Buffer } from 'node:buffer'
import { log } from 'node:console'
import katex from 'katex'

const directory = new URL('../src/content/quizzes/digital-systems-ch4-textbook/', import.meta.url)
const source = readFileSync(new URL('v1.quiz.md', directory), 'utf8').replaceAll('\r\n', '\n')
const entries = [...source.matchAll(/:::question id="(q\d+)"[^\n]*\n([\s\S]*?):::end/g)]
const fields = new Map(entries.map(([, id, body]) => [id, {
  prompt: body.split(':::drawing')[0].trim(),
  answer: body.split(':::answer')[1].split(':::solution')[0].trim(),
  solution: body.split(':::solution')[1].split(':::rubric')[0].trim(),
}]))
let checks = 0
function check(condition, message) { assert.ok(condition, message); checks++ }
const q = id => { assert.ok(fields.has(id), id); return fields.get(id) }
function expression(id, output) {
  const line = q(id).answer.split('\n').find(line => line.startsWith(`$${output}=`))
  assert.ok(line, `${id}/${output}`)
  return line.slice(1, -1).split('=').at(-1)
}
// Evaluate the saved SOP rather than substituting a second hard-coded answer.
function sop(text, variables, row) {
  return Number(text.split('+').some(term => {
    const literals = term.match(/[A-Za-z]'?/g) ?? []
    assert.equal(literals.join(''), term, `Unsupported SOP: ${text}`)
    return literals.every(literal => {
      const bit = variables.indexOf(literal[0])
      assert.ok(bit >= 0, `Unknown variable: ${literal}`)
      return Boolean(row >> (variables.length - bit - 1) & 1) !== literal.endsWith("'")
    })
  }))
}
function table(id) {
  return q(id).solution.split('\n').filter(line => /^[01]&/.test(line))
    .map(line => line.replace(/\\\\$/, '').split('&').map(Number))
}
function muxInputs(saved, expected) {
  const assignments = [...saved.matchAll(/I_(\d+)=([A-Za-z]'?|[01])(?![A-Za-z0-9'])/g)]
  assert.equal(assignments.length, expected.length, 'saved MUX input count')
  assert.equal(new Set(assignments.map(([, index]) => index)).size, expected.length, 'unique saved MUX inputs')
  const values = expected.map((_, index) => assignments.find(([, inputIndex]) => Number(inputIndex) === index)?.[2])
  assert.deepEqual(values, expected, 'exact saved MUX inputs')
  return values
}

check(entries.length === 15, 'six examples and nine exercises')
check(entries.map(([, id]) => id).join(',') === Array.from({ length: 15 }, (_, i) => `q${String(i + 1).padStart(2, '0')}`).join(','), 'source order')
const pePrompts = {
  q02: 'Analyze the logic diagram in Fig. PE4.1 and find the Boolean expression for $F_1$ and $F_2$.\n\n![](figures/pe4-1.png)',
  q04: 'Explain how a half adder and a full adder differ in their functionality.',
  q05: 'What is the main drawback of a ripple adder?',
  q06: 'What is the main drawback of a lookahead adder?',
  q07: 'Add the following two binary words and find the sum and carry bit:\n\n$A=1100\\_0101$, $B=1010\\_1010$.',
  q08: 'Find $A-B$ with $A=1001_2$ and $B=0110_2$;',
  q10: 'Find the product $(0101)_2\\times(1001)_2$.',
  q11: 'Draw a logic diagram constructing a $3\\times8$ decoder with active-low enable, using a pair of $2\\times4$ decoders; also draw a truth table for the configuration.',
  q14: 'Implement the Boolean function $F(A,B,C)=\\Sigma(3,5,6,7)$ with a multiplexer.',
}
for (const [id, prompt] of Object.entries(pePrompts)) check(q(id).prompt.split('\n\n').slice(1).join('\n\n') === prompt, `${id}: exact PE wording`)
for (const [, field] of fields) check(!/[\u3400-\u9fff]/.test(field.prompt), 'English source-only prompts')

const t1 = table('q01')
check(t1.length === 8, 'Fig. 4.2 truth table has eight rows')
const t11 = table('q11')
check(t11.length === 8, 'PE4.8 source truth table has eight rows')
for (let row = 0; row < 8; row++) {
  const a = row >> 2 & 1, b = row >> 1 & 1, c = row & 1
  const carry = Number(a + b + c >= 2), sum = (a + b + c) % 2
  check(sop(expression('q01', 'F_2'), 'ABC', row) === carry, `q01 carry ${row}`)
  check(sop(expression('q01', 'F_1'), 'ABC', row) === sum, `q01 sum ${row}`)
  check(JSON.stringify(t1[row]) === JSON.stringify([a,b,c,carry,1-carry,Number(a||b||c),a*b*c,Number(!carry&&(a||b||c)),sum]), `q01 table ${row}`)
  check(sop(expression('q02', 'F_2'), 'ABC', row) === Number(a||b), `q02 printed answer ${row}`)
  const diagramF2 = Number(a*b || a || c || b*c)
  check(Number(a||b||c||a*b*c*!diagramF2) === sop(expression('q02', 'F_1'), 'ABC', row), `q02 diagram F1 ${row}`)
  check(JSON.stringify(t11[row]) === JSON.stringify([a,b,c,...Array.from({length:8}, (_, i) => Number(i===row))]), `q11 one-hot row ${row}`)
}
check(q('q02').solution.includes('F_2=AB+A+C+BC=A+C+BC'), 'PE4.1 diagram discrepancy retained')
check(sop(expression('q02', 'F_2'), 'ABC', 1) === 0, 'PE4.1 printed answer differs from diagram at 001')
check(q('q11').solution.includes('no independent global enable'), 'PE4.8 wording discrepancy retained')

for (let n = 0; n < 10; n++) {
  const actual = ['w','x','y','z'].reduce((value, output) => value * 2 + sop(expression('q03', output), 'ABCD', n), 0)
  check(actual === n + 3, `BCD-to-excess-3 digit ${n}`)
}
check(q('q07').answer === 'Sum = $0110\\_1111$, Carry = 1' && 0b11000101 + 0b10101010 === 0b101101111, 'PE4.5 sum and carry')
check(q('q08').answer === '$A-B=1\\_0011_2$' && 0b1001 + ((~0b0110)&15) + 1 === 0b10011, 'PE4.6 carry-out and difference')
check(q('q10').answer === '$0101101_2$' && 0b0101*0b1001 === 0b0101101, 'PE4.7 product')
for (const [left,right,outCarry,inCarry,result] of [[70,80,0,1,150],[186,176,1,0,106]]) {
  check((left+right & 255) === result && (left+right >> 8) === outCarry && ((left&127)+(right&127) >> 7) === inCarry, 'overflow source calculation')
  check(outCarry !== inCarry, 'overflow in both signed additions')
}
check(q('q09').prompt.includes('0\\quad1') && q('q09').prompt.includes('1\\quad0'), 'both source carry rows')
check(q('q09').answer === '$V=1$, overflow, for both additions.', 'overflow answer')
const workedRows = [...q('q09').prompt.matchAll(/&([+-]\d+)&([01])\\ ([01]+)/g)].map(match => match.slice(1))
check(JSON.stringify(workedRows) === JSON.stringify([
  ['+70','0','1000110'],['+80','0','1010000'],['+150','1','0010110'],
  ['-70','1','0111010'],['-80','1','0110000'],['-150','0','1101010'],
]), 'exact source overflow operands and worked results')

for (const [id,variable,on,inputs] of [
  ['q12','z',[1,2,6,7],['z',"z'",'0','1']],
  ['q13','D',[1,3,4,11,12,13,14,15],['D','D',"D'",'0','0','D','1','1']],
  ['q14','C',[3,5,6,7],['0','C','C','1']],
]) {
  const saved = id === 'q14' ? q(id).solution : q(id).answer
  const parsed = muxInputs(saved, inputs)
  for (const [i, input] of inputs.entries()) check(parsed[i] === input, `${id} exact source input ${i}`)
  for (let row=0;row<parsed.length*2;row++) {
    const input=parsed[row>>1], bit=row&1
    const actual=input==='0'?0:input==='1'?1:input===variable?bit:1-bit
    check(actual === Number(on.includes(row)), `${id} MUX row ${row}`)
  }
}
const corruptedMux = q('q12').answer.replace('I_0=z,', "I_0=z',")
check(corruptedMux !== q('q12').answer, 'MUX prime negative control actually changes the saved answer')
assert.throws(() => muxInputs(corruptedMux, ['z',"z'",'0','1']), /exact saved MUX inputs/)
check(true, 'MUX prime negative control rejected')
check(q('q12').solution.includes('Equivalent $A,B,C$ labels are accepted.'), 'source xyz/ABC correspondence')
for (const text of ['$S_1,S_0$','$EN$','$I_0,I_1,I_2,I_3$','$Y$']) check(q('q15').solution.includes(text), `three-state source labels ${text}`)

const expectedFigures = {
  'figure-4-2.png':'0f6233ff56a99b8424c8de2b4e256efc34826f2517d94ba88de25f9f210c8ace',
  'figure-4-30.png':'62613c16d5a3b67ab472db0178a70f1e6f6b461dc913a52a098946e32e1488b9',
  'pe4-1.png':'1affefe88f66f9c89895b2ebca6f4f072601da70c4d4e073590f2f398bb2feec',
  'pe4-8.png':'d390efc7acb139c438d86062104a2afc7b420d04e82b126d9f51e152c6a79721',
  'pe4-9.png':'878df6fc89ed29efcc308ae965e2ae3a63de8b07716274c100068aafb60818b1',
}
const figureDirectory = fileURLToPath(new URL('figures/', directory))
check(JSON.stringify(readdirSync(figureDirectory).sort()) === JSON.stringify(Object.keys(expectedFigures).sort()), 'exact five source exports')
for (const [name,hash] of Object.entries(expectedFigures)) {
  const file = new URL(`figures/${name}`, directory), bytes = readFileSync(file), stat = lstatSync(file)
  check(stat.isFile() && !stat.isSymbolicLink(), `regular figure ${name}`)
  check(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), `PNG signature ${name}`)
  check(createHash('sha256').update(bytes).digest('hex') === hash, `reviewed source pixels ${name}`)
}
let formulas = 0
for (const match of source.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)) {
  katex.renderToString(match[1] ?? match[2], { strict: 'error', throwOnError: true, trust: false })
  formulas++
}
log(JSON.stringify({status:'PASS',questions:entries.length,checks,formulas,figures:Object.keys(expectedFigures).length}))
