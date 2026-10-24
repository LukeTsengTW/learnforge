// Independent finite checks against the selected PDF problems, never a provider/runtime call.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, lstatSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { log } from 'node:console'
import { URL } from 'node:url'
import katex from 'katex'

const root = new URL('../src/content/quizzes/digital-systems-ch1-ch4-textbook-exercises/', import.meta.url)
const source = readFileSync(new URL('v1.quiz.md', root), 'utf8').replaceAll('\r\n', '\n')
const entries = [...source.matchAll(/:::question id="(q\d+)"[^\n]*points="(\d+)"[^\n]*\n([\s\S]*?):::end/g)]
const questions = new Map(entries.map(([, id, points, body]) => [id, {
  points: Number(points), prompt: body.split(':::drawing')[0].trim(),
  answer: body.split(':::answer')[1]?.split(':::solution')[0].trim(),
  solution: body.split(':::solution')[1]?.split(':::rubric')[0].trim(),
  rubric: body.split(':::rubric')[1].trim(), body,
}]))
let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks++ }
const q = number => questions.get(`q${String(number).padStart(2, '0')}`)
const math = text => [...text.matchAll(/\$([^$\n]+)\$/g)].map(m => m[1])
const answers = number => math(q(number).answer)
const rhs = text => text.split('=').at(-1).replace(/[.,;]$/, '')
const bits = (row, count) => Array.from({length:count}, (_, i) => row >> (count-i-1) & 1)
const set = (text, kind = 'Sigma') => {
  const match = text.match(new RegExp(`\\\\${kind}\\(([^)]*)\\)`))
  assert.ok(match, `Missing ${kind}: ${text}`)
  return match[1].split(',').map(Number)
}
const table = text => text.split('\n').filter(line => /^\|[01]|^[01]+&/.test(line))
  .map(line => line.startsWith('|') ? line.slice(1,-1).split('|').map(Number)
    : line.replace(/\\\\$/, '').split('&').map(Number))

// Small Boolean parser: adjacency=AND, +=OR, ^=XOR, postfix prime=NOT.
// Macro support validates the saved NAND/NOR netlists, including their actual polarity.
function evaluate(expression, values) {
  const text = expression.replaceAll('\\oplus','^').replace(/\\operatorname\{(NAND|NOR)\}/g,'$1').replaceAll('[','(').replaceAll(']',')').replaceAll(/\s/g,'')
  let pos = 0
  function atom() {
    let value
    const macro = /^(NAND|NOR)/.exec(text.slice(pos))?.[1]
    if (macro) {
      pos += macro.length
      assert.equal(text[pos++], '(')
      const args = [sum()]
      while (text[pos] === ',') { pos++; args.push(sum()) }
      assert.equal(text[pos++], ')')
      value = macro==='NAND' ? !args.every(Boolean) : !args.some(Boolean)
    } else if (text[pos] === '(') {
      pos++; value = sum(); assert.equal(text[pos++], ')')
    } else {
      const token = text[pos++]
      assert.ok(token === '0' || token === '1' || Object.hasOwn(values,token), `Unknown ${token} in ${expression}`)
      value = token==='0' ? false : token==='1' ? true : Boolean(values[token])
    }
    while (text[pos] === "'") { pos++; value = !value }
    return value
  }
  function product() {
    let value = atom()
    while (/[A-Za-z01(]/.test(text[pos] ?? '') && pos < text.length) { const next=atom(); value=value&&next }
    return value
  }
  function xor() {
    let value = product()
    while (text[pos] === '^') { pos++; const next=product(); value=value!==next }
    return value
  }
  function sum() {
    let value = xor()
    while (text[pos] === '+') { pos++; const next=xor(); value=value||next }
    return value
  }
  const value = sum()
  assert.equal(pos,text.length, `Unconsumed input: ${expression}`)
  return Number(value)
}
function same(expression, variables, expected, dc=[]) {
  for (let row=0; row<2**variables.length; row++) {
    if (dc.includes(row)) continue
    const values=Object.fromEntries([...variables].map((v,i)=>[v,bits(row,variables.length)[i]]))
    check(evaluate(expression,values)===Number(expected(row,values)), `${expression}: row ${row}`)
  }
}
const member = on => row => on.includes(row)
const from = (expression,variables) => (row) => evaluate(expression,Object.fromEntries([...variables].map((v,i)=>[v,bits(row,variables.length)[i]])))
function signalValue(expression, values) {
  const names=Object.keys(values), alphabet='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const renamed=expression.replace(/\\operatorname\{(?:NAND|NOR)\}|\\oplus|[A-Za-z](?:_\{[^}]+\}|_[a-z]+|_\d+)?/g,token=>{
    if(token.startsWith('\\')) return token
    assert.ok(names.includes(token),`Unknown signal ${token}: ${expression}`)
    return alphabet[names.indexOf(token)]
  })
  return evaluate(renamed,Object.fromEntries(names.map((name,i)=>[alphabet[i],values[name]])))
}
function runNetlist(equations, inputs) {
  const values={...inputs}
  for(const text of equations) {
    const [output,expression]=text.split('=')
    values[output]=signalValue(expression,values)
  }
  return values
}
function canonical(text, variables, expected, kind='Sigma') {
  const actual=set(text,kind)
  const desired=Array.from({length:2**variables.length},(_,i)=>i).filter(i=>Number(expected(i)) === (kind==='Sigma'?1:0))
  check(JSON.stringify(actual)===JSON.stringify(desired), `Saved canonical ${text}`)
}
// Exact minimum two-level cover cost, terms first then literals; all 3^n cubes.
function minimum(variables, on, dc=[]) {
  const allowed=new Set([...on,...dc]), wanted=new Map(on.map((n,i)=>[n,i]))
  const candidates=[]
  for (let code=0;code<3**variables.length;code++) {
    let n=code
    const pattern=Array.from({length:variables.length},()=>{const d=n%3;n=Math.floor(n/3);return d})
    const rows=Array.from({length:2**variables.length},(_,i)=>i).filter(row=>bits(row,variables.length).every((bit,i)=>pattern[i]===2||pattern[i]===bit))
    if (rows.some(row=>!allowed.has(row))) continue
    const mask=rows.reduce((m,row)=>m|(wanted.has(row)?1<<wanted.get(row):0),0)
    if(mask) candidates.push([mask,100+pattern.filter(d=>d!==2).length])
  }
  const costs=Array(1<<on.length).fill(Infinity);costs[0]=0
  for(let mask=0;mask<costs.length;mask++) if(Number.isFinite(costs[mask])) for(const [cover,cost] of candidates) {
    const next=mask|cover;costs[next]=Math.min(costs[next],costs[mask]+cost)
  }
  return costs.at(-1)
}
function minimal(expression, variables, on, dc=[], pos=false) {
  const literals=(expression.match(/[a-z]/gi)??[]).length
  const terms=pos ? [...expression.matchAll(/\([^()]+\)|[A-Za-z]'?/g)].length : expression.split('+').length
  const target=pos ? Array.from({length:2**variables.length},(_,i)=>i).filter(i=>!on.includes(i)&&!dc.includes(i)) : on
  check(100*terms+literals===minimum(variables,target,dc), `Nonminimum ${pos?'POS':'SOP'}: ${expression}`)
}

const inventory=['1.9','1.13(a)','1.18','1.20','1.22','1.30','2.3','2.9','2.11','2.14','2.15','2.17','2.18','2.19','2.22','2.27','2.33','3.5','3.6','3.12','3.13','3.15','3.17','3.19','3.20','3.23','3.24','3.28','4.4','4.5','4.6','4.7','4.10','4.12','4.16','4.21','4.26','4.27','4.28','4.31','4.32','4.34']
check(entries.length===inventory.length,'42 selected units')
check(entries.reduce((sum,[,,points])=>sum+Number(points),0)===411,'411 authored points')
for(const [i,[,id]] of entries.entries()) {
  const item=q(i+1)
  check(id===`q${String(i+1).padStart(2,'0')}`,'stable source order')
  check(item.prompt.startsWith(`### Problem ${inventory[i]}\n`),`Source inventory ${id}`)
  check(!/[\u3400-\u9fff]/.test(item.prompt),`English source wording ${id}`)
  check(!item.body.includes('::::'),'no malformed directive')
  check(item.answer?.length>0 && item.solution?.length>15,`Authored fields ${id}`)
  const scores=[...item.rubric.matchAll(/^- ([\d.]+) \| /gm)].map(m=>Number(m[1]))
  check(scores.length>1&&scores.every(n=>n>0)&&scores.reduce((a,b)=>a+b,0)===item.points,`Scored rubric ${id}`)
}

// Ch1: independent place values, width, arithmetic and actual saved bytes.
for(const [i,value] of [21.625,100.5,177.5625,20958.75,51.125].entries()) check(Number(answers(1)[i])===value,'1.9 decimal values')
check(answers(2)[0].includes('(101101.001)_2')&&45.125===0b101101+1/8,'1.13(a) conversion')
for(const [i,[left,right,result]] of [[25,18,7],[12,30,-18],[21,27,-6],[99,17,82]].entries()) {
  const saved=answers(3)[i].split('=')
  check(left-right===result&&Number(saved[1])===result,'1.18 subtraction')
  check((saved[0].startsWith('-')?-1:1)*parseInt(saved[0].replace(/[^01]/g,''),2)===result,'1.18 saved binary')
}
for(const [left,right,word] of [[29,-49,'11101100'],[-29,49,'00010100'],[-29,-49,'10110010']]) {
  check(q(4).answer.includes(word), '1.20 saved eight-bit result')
  check(parseInt(word,2)-(word[0]==='1'?256:0)===left+right,'1.20 no overflow')
}
const codes=answers(5).map(s=>s.split('\\rightarrow')[1].split('\\ ').map(x=>x.trim()))
for(const [i,text] of ['9045','337'].entries()) {
  check(codes[i].join('')===[...text].map(n=>Number(n).toString(2).padStart(4,'0')).join(''),'1.22 BCD')
  const desired=[...text].map(c=>{const n=c.charCodeAt(0);return ((n.toString(2).replaceAll('0','').length%2)*128+n).toString(2).padStart(8,'0')})
  check(JSON.stringify(codes[i+2])===JSON.stringify(desired),'1.22 saved parity ASCII')
}
const hex=[0x47,0x2e,0x5c,0x42,0xcf,0xcf,0xcc,0xc5]
check(q(6).answer.includes(hex.map(n=>n.toString(2).padStart(8,'0')).join(' ')),'1.30 saved bits')
check(q(6).answer.includes(String.fromCharCode(...hex.map(n=>n&127))),'1.30 decoded characters')
check(hex.every(n=>n.toString(2).replaceAll('0','').length%2===0)&&q(6).answer.includes('Even parity'),'1.30 parity')

// Ch2: independently transcribed source expressions, exhaustive equivalence.
const p23=["xyz+x'y+xyz'","x'yz+xz","(x+y)'(x'+y')","xy+x(wz+wz')","(yz'+x'w)(xy'+zw')","(x'+z')(x+y'+z')"]
p23.forEach((text,i)=>same(answers(7)[i],'wxyz',from(text,'wxyz')))
const p29=["xyz+x'y'z'","(x+y')(y+z')(z+x')","w'x'+w(x+y+z)"]
p29.forEach((text,i)=>same(answers(8)[i],'wxyz',row=>!from(text,'wxyz')(row)))
const t211=table(q(9).answer)
for(const [i,original] of ["x'z'+xy+yz","a'b'c'+a'bc+ab'c'+abc"].entries()) for(let row=0;row<8;row++) {
  const vars=i?'abc':'xyz'
  check(JSON.stringify(t211[i*8+row])===JSON.stringify([...bits(row,3),from(original,vars)(row)]),'2.11 saved truth table')
}
for(const text of answers(10).slice(0,4)) same(rhs(text),'xyz',from("x'y+xy'+xz",'xyz'))
const t215=table(q(11).prompt)
for(let row=0;row<8;row++) for(const [i,out] of answers(11).entries()) check(evaluate(rhs(out),Object.fromEntries([...('ABC')].map((v,j)=>[v,bits(row,3)[j]])))===t215[row][i+3],'2.15 source table')
const p217=['(ac+b)(ab+d)',"(a'+c'+d')(ab+cd)","(b+c'd')(a+bc')","a'b'c'+acd+ab'd'+b'cd"]
const t217=table(q(12).answer)
check(t217.length===16,'2.17 sixteen rows')
p217.forEach((original,i)=>{
  canonical(answers(12)[i],'abcd',from(original,'abcd'))
  canonical(answers(12)[i],'abcd',from(original,'abcd'),'Pi')
  for(let row=0;row<16;row++) check(t217[row].length===8&&t217[row][i+4]===from(original,'abcd')(row),'2.17 saved truth cells')
})
const p218="w'xy+w'yz+wy'z+w'y'z+xy"
canonical(answers(13)[0],'wxyz',from(p218,'wxyz'))
const reduced218=answers(13).find(s=>s.startsWith('F=')&&!s.includes('\\Sigma')).slice(2)
same(reduced218,'wxyz',from(p218,'wxyz'))
check((reduced218.match(/[a-z]/g)??[]).length===5,'2.18 minimum factored literals')
for(const line of answers(14)) canonical(line,'ABCD',from("AB'+BC+ACD'",'ABCD'),line.includes('\\Pi')?'Pi':'Sigma')
for(const [i,original] of ["(w+xy')(x+y'z)","xy+(w'+y'z')(z'+x'y')"].entries()) for(const text of answers(15).slice(i*2,i*2+2)) same(text,'wxyz',from(original,'wxyz'))
const partial=table(q(16).prompt)
check(partial.length===7&&JSON.stringify(partial.map(r=>4*r[2]+2*r[3]+r[4]))==='[0,1,2,3,4,5,7]','2.27 exact seven source rows')
const funcs=answers(16).filter(s=>/^f_[12]=/.test(s)).map(rhs)
for(const row of partial) for(let i=0;i<2;i++) check(evaluate(funcs[i],{a:row[2],b:row[3],c:row[4]})===row[i],'2.27 conditional equations')
check(q(16).solution.includes('四種')&&q(16).rubric.includes('不強制'),'2.27 all completions accepted')
check(q(17).answer.includes("g=(a\\oplus b)'")&&q(17).answer.includes('f=0,1,1,0')&&q(17).answer.includes('g=1,0,0,1'),'2.33 source XOR/XNOR waveforms')

// Ch3: exact care sets and exact minimum two-level covers, read from saved answers.
const p35=[[0,2,3,4,6,8,9,12],[0,1,2,3,5,8,13],[2,3,5,7,11,13],[1,2,3,6,7,8,9,12,13]]
p35.forEach((on,i)=>{const e=rhs(answers(18)[i]);same(e,'wxyz',member(on));minimal(e,'wxyz',on)})
const p36=["ABC'D'+AB'C+B'C'D'+AB'CD+B'C'D","w'x'y'+w'x'yz+x'y'z+xyz+y'z'","A'B'CD+A'BC+C'D+ABCD+AB'C","A'B'C'+A'BD+A'BC'D'+BC'D+ABCD"]
p36.forEach((original,i)=>{const vars=i===1?'wxyz':'ABCD',on=Array.from({length:16},(_,r)=>r).filter(from(original,vars));same(answers(19)[i],vars,member(on));minimal(answers(19)[i],vars,on)})
for(const [i,text] of math(q(19).solution).filter(s=>s.includes('\\{')).entries()) {
  const vars=i===1?'wxyz':'ABCD'
  const saved=text.replaceAll('\\{','').replaceAll('\\}','').split(',').map(Number)
  check(JSON.stringify(saved)===JSON.stringify(Array.from({length:16},(_,r)=>r).filter(from(p36[i],vars))),'3.6 saved solution minterms')
}
for(const [i,zero] of [[0,1,6,7,8,10,12,14],[0,2,5,8,10,15]].entries()) {const e=rhs(answers(20)[i]),on=Array.from({length:16},(_,r)=>r).filter(r=>!zero.includes(r));same(e,'ABCD',member(on));minimal(e,'ABCD',on,[],true)}
const p313=["x'y'z'+yz'+xy","A'B+A'B'C+CD","A'B'D'+A'D+BCD+BC'D'","A'B'C+A'C'D+A'BC+ABD"]
p313.forEach((original,i)=>{const vars=i?'ABCD':'xyz',on=Array.from({length:2**vars.length},(_,r)=>r).filter(from(original,vars));answers(21).slice(i*2,i*2+2).forEach((e,j)=>{same(e,vars,member(on));minimal(e,vars,on,[],j===1)})})
math(q(21).solution).filter(s=>s.includes('\\Sigma')).forEach((text,i)=>canonical(text,i?'ABCD':'xyz',from(p313[i],i?'ABCD':'xyz')))
const p315=[[[0,3,5],[1,6,7]],[[1,2,4,6,12],[0,3,5,7,11,15]],[[3,5,6,11],[4,7,9,12,15]],[[4,5,8,9,14,15],[2,3,12,13]]]
p315.forEach(([on,dc],i)=>{const vars=i?'ABCD':'xyz',text=answers(22)[i],e=text.split('=')[1];same(e,vars,member(on),dc);canonical(text,vars,from(e,vars));minimal(e,vars,on,dc)})
const on317=[1,3,6,7,12,13,14,15]
canonical(answers(23)[0],'ABCD',member(on317))
answers(23).slice(1).forEach((text,i)=>{const e=rhs(text);same(e,'ABCD',member(on317));minimal(e,'ABCD',on317,[],i===1)})
const p319=["wx'y'+wy'z'+xy'",null,"[(x'+y)(y+z')]'".replaceAll('[','(').replaceAll(']',')')]
answers(24).forEach((text,i)=>{const vars=i===2?'xyz':'wxyz',original=i===1?member([0,2,8,9,10,11,14]):from(p319[i],vars),on=Array.from({length:2**vars.length},(_,r)=>r).filter(original);same(rhs(text),vars,original);minimal(rhs(text),vars,on,[],true)})
check(q(25).prompt.includes("CD(B+C)A+(BC'+DE'),")&&!q(25).prompt.includes("DE')'"),'3.20 exact source has no outer prime')
same(rhs(answers(25).find(s=>s.startsWith('F='))),'ABCDE',from("CD(B+C)A+(BC'+DE')",'ABCDE'))
for(let row=0;row<32;row++) {
  const inputs=Object.fromEntries([...('ABCDE')].map((v,i)=>[v,bits(row,5)[i]]))
  const equations=answers(25).filter(s=>/^[pqrstF]=/.test(s))
  const nor=runNetlist(equations,{...inputs,"A'":1-inputs.A,"B'":1-inputs.B,"C'":1-inputs.C,"D'":1-inputs.D})
  check(nor.F===from("CD(B+C)A+(BC'+DE')",'ABCDE')(row),'3.20 saved NOR netlist')
  const nandEquations=math(q(25).solution).filter(s=>/^(?:n_[123]|F)=\\operatorname/.test(s))
  const nand=runNetlist(nandEquations,inputs)
  check(nand.F===from("CD(B+C)A+(BC'+DE')",'ABCDE')(row),'3.20 saved NAND netlist')
}
check(from("CD(B+C)A+(BC'+DE')",'ABCDE')(0)===0&&from("CD(B+C)A+(BC'+DE')'",'ABCDE')(0)===1,'3.20 erroneous outer-prime negative control')
same(rhs(answers(26)[0]),'ABCD',member([2,4,10,12,14]),[0,1,5,8])
const on324=[0,4,8,9,10,11,12,14]
for(const [i,text] of answers(27).slice(0,4).entries()) same(rhs(text),'ABCD',i<2?member(on324):r=>!on324.includes(r))
same(rhs(answers(28)[1]),'ABC',r=>bits(r,3).reduce((a,b)=>a+b,0)%2===0)

// Ch4: complete arithmetic, decoder and MUX domains.
for(const [i,on] of [[3,4,5,6,7],[1,2,4,5,7]].entries()) {const text=answers(29).filter(s=>s.startsWith('F='))[i];canonical(text,'xyz',member(on));same(rhs(text),'xyz',member(on))}
const t45=table(q(30).answer)
check(t45.length===8,'4.5 conditional truth table')
for(let row=0;row<8;row++) {
  const actual=answers(30).filter(s=>/^[ABC]=/.test(s)).reduce((n,e)=>2*n+evaluate(rhs(e),Object.fromEntries([...('xyz')].map((v,i)=>[v,bits(row,3)[i]]))),0)
  check(t45[row][0]===Number(row.toString(2))&&parseInt(String(t45[row][1]),2)===actual&&actual===(row<4?row*2:Math.floor(row/2)),'4.5 floor-only saved mapping')
}
check(q(30).answer.includes('cannot be satisfied exactly')&&q(30).rubric.includes('獲滿分'),'4.5 exact impossibility accepted')
canonical(answers(31).find(s=>s.includes('\\Sigma')),'xyz',r=>bits(r,3).reduce((a,b)=>a+b,0)<2)
same(rhs(answers(31).find(s=>s.includes('\\Sigma'))),'xyz',r=>bits(r,3).reduce((a,b)=>a+b,0)<2)
check(q(31).answer.includes('does not specify the number'),'4.6 input-count assumption explicit')
const gateModel=q(31).answer.match(/```verilog\n([\s\S]+?)```/)[1]
for(let row=0;row<8;row++) {
  const values={x:row>>2&1,y:row>>1&1,z:row&1}
  for(const [,gate,args] of gateModel.matchAll(/\b(not|and|or)\s+([^;]+);/g)) for(const match of args.matchAll(/\(([^)]+)\)/g)) {
    const [out,...inputs]=match[1].split(',').map(s=>s.trim())
    assert.ok(inputs.every(name=>Object.hasOwn(values,name)),'gate-level signal declared before use')
    values[out]=Number(gate==='not'?!values[inputs[0]]:gate==='and'?inputs.every(name=>values[name]):inputs.some(name=>values[name]))
  }
  check(values.F===Number(bits(row,3).reduce((a,b)=>a+b,0)<2),'4.6 saved HDL gate primitives')
}
const cases=[...q(32).answer.matchAll(/4'b([01]{4}): B = 4'b([01]{4});/g)]
check(cases.length===16&&new Set(cases.map(m=>m[1])).size===16,'4.7 all saved HDL cases')
for(const [,gray,binary] of cases) {
  const n=parseInt(binary,2),values=Object.fromEntries(bits(parseInt(gray,2),4).map((bit,i)=>[`G_${3-i}`,bit]))
  const equations=answers(32).filter(s=>/^B_[0-3]=/.test(s))
  const actual=equations.reduce((out,e)=>out*2+signalValue(rhs(e),values),0)
  check((n^(n>>1))===parseInt(gray,2)&&actual===n,'4.7 saved XOR functions and HDL cases')
}
for(const width of [4,5]) for(let value=0;value<2**width;value++) {
  const outputs=answers(33).filter(s=>/^Y_[0-4]=/.test(s)).filter(s=>Number(s[2])<width)
  const actual=outputs.reduce((out,line)=>{const [left,expression]=line.split('=');const normalized=expression.replace(/A_([0-4])/g,(_,n)=>'abcde'[Number(n)]);const values=Object.fromEntries([...('abcde')].map((v,i)=>[v,value>>i&1]));return out | evaluate(normalized.replace(/[.,]$/,''),values)<<Number(left[2])},0)
  check(actual===(-value & ((1<<width)-1)),'4.10 complementer')
}
for(let row=0;row<8;row++) {
  const [x,y,b]=bits(row,3),diff=x^y^b,borrow=Number(x-y-b<0)
  const saved=answers(34),values={x,y,'B_{in}':b}
  check(signalValue(rhs(saved[2]),values)===diff&&signalValue(rhs(saved[3]),values)===borrow&&x-y-b===diff-2*borrow,'4.12 saved full subtractor arithmetic')
  if(b===0) check(signalValue(rhs(saved[0]),values)===(x^y)&&signalValue(rhs(saved[1]),values)===Number(x<y),'4.12 saved half subtractor')
}
for(let row=0;row<8;row++) {
  const [a,b,c]=bits(row,3),p=a|b,g=a&b
  check(evaluate("(c'g'+p')'",{p,g,c})===Number(a+b+c>=2),'4.16 source carry')
  check(evaluate("(pg')^c",{p,g,c})===(a^b^c),'4.16 source sum')
}
for(let a=0;a<4;a++) for(let b=0;b<4;b++) {
  const values=runNetlist(answers(36).filter(s=>/^(?:S_[012]|C_1)=/.test(s)),{A_1:a>>1,A_0:a&1,B_1:b>>1,B_0:b&1})
  check(values.S_0+2*values.S_1+4*values.S_2===a+b,'4.21 saved two-bit adder')
}
check(q(37).answer.includes('five')||q(37).solution.includes('五個 decoder'),'4.26 declared five-block design manually source-reviewed')
const p427=[[1,4,6],[3,5],[2,4,6,7]]
for(const [i,text] of answers(38).filter(s=>/^F_[123]=/.test(s)).entries()) for(let row=0;row<8;row++) {
  const saved=rhs(text).replace(/Y_([0-7])/g,(_,n)=>'abcdefgh'[Number(n)])
  const values=Object.fromEntries([...('abcdefgh')].map((v,j)=>[v,Number(row!==j)]))
  check(evaluate(saved,values)===Number(p427[i].includes(row)),'4.27 saved active-low NAND outputs')
}
const p428=["x'y'+xz","xy'z'+yz","x'y'z'+xy","(x+y')z'","(x'+y)(x'+z)","(y+z)(x'+z')"]
answers(39).forEach((text,i)=>canonical(text,'xyz',from(p428[i],'xyz')))
check(q(40).answer.includes('$S_2,S_1,S_0$')&&q(40).answer.includes('$S_3$')&&q(40).answer.includes('$I_8$–$I_{15}$'),'4.31 saved bank/select wiring manually source-reviewed')
const muxInputs=answers(41).filter(s=>s.startsWith('[')).map(s=>s.slice(1,-1).split(','))
for(const [i,inputs] of muxInputs.entries()) {check(inputs.length===8,'4.32 eight saved inputs');for(let row=0;row<16;row++) check(evaluate(inputs[row>>1],{D:row&1})===Number(i?![2,6,11].includes(row):[0,2,5,8,10,14].includes(row)),'4.32 MUX function')}
const mux434=[['D','0','1',"D'",'D','1','1','0'],['D','D','0','0',"D'",'1','0',"D'"]]
mux434.forEach((inputs,i)=>{const expected=row=>evaluate(inputs[row>>1],{D:row&1});canonical(answers(42)[i*2],'ABCD',expected);same(rhs(answers(42)[i*2+1]),'ABCD',expected)})

const figures=readdirSync(new URL('figures/',root)).sort()
check(JSON.stringify(figures)==='["p2-33.webp","p4-16.webp"]','exact two source figures')
for(const figure of figures) {const file=new URL(`figures/${figure}`,root);check(lstatSync(file).isFile()&&!lstatSync(file).isSymbolicLink(),'regular figure');check(readFileSync(file).subarray(8,12).toString()==='WEBP','WEBP signature')}
let formulas=0
for(const match of source.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)) {katex.renderToString(match[1]??match[2],{strict:'error',throwOnError:true,trust:false});formulas++}
// The parser itself must distinguish a missing prime, not merely count expressions.
check(evaluate("x'y",{x:0,y:1})!==evaluate('xy',{x:0,y:1}),'prime negative control')
log(JSON.stringify({status:'PASS',questions:entries.length,points:411,checks,formulas,figures:figures.map(name=>({name,sha256:createHash('sha256').update(readFileSync(new URL(`figures/${name}`,root))).digest('hex')}))}))
