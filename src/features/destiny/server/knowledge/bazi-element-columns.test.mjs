import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { baziLiteralConditions } from './bazi-literal-conditions.mjs';
import { baziLiteralSourceConditions } from './bazi-literal-passages.mjs';
const stems='甲乙丙丁戊己庚辛壬癸',slots=['year','month','hour'];
const stem=(position,stem)=>({kind:'stem',position,stem});
const parse=text=>baziLiteralConditions({conditions:{normalized:[text]}},{positive:v=>v==='甲日'?[[stem('day','甲')]]:null,absence:()=>null});
const keys=facts=>new Set(facts.map(f=>JSON.stringify(f)));
const accepts=(groups,facts)=>{const present=keys(facts),known=new Set(facts.map(f=>f.position));return groups?.some(g=>g.required.every(f=>present.has(JSON.stringify(f)))&&g.mustBeAbsent.every(f=>known.has(f.position)&&!present.has(JSON.stringify(f))));};

test('explicit year, month and hour exposure never borrows another slot over all 3,000 arrangements',()=>{
  let checked=0;for(const[letter,position]of [['年','year'],['月','month'],['时','hour']])for(const year of stems)for(const month of stems)for(const hour of stems){
    const groups=parse(letter+'癸透'),values={year,month,hour};assert.equal(accepts(groups,slots.map(p=>stem(p,values[p]))),values[position]==='癸');checked++;
  }assert.equal(checked,3000);assert.equal(parse('日癸透'),null);
});

test('element exposure is an existential pair and non-exposure excludes both over 10,000 independent cases',()=>{
  let checked=0;
  for(const[element,names]of Object.entries({木:['甲','乙'],火:['丙','丁'],土:['戊','己'],金:['庚','辛'],水:['壬','癸']})){
    const positive=parse(element+'透'),negative=parse('甲日且'+element+'不透');assert.equal(positive.length,6);assert.equal(negative[0].mustBeAbsent.length,6);
    for(const year of stems)for(const month of stems)for(const hour of stems){const values=[year,month,hour],facts=slots.map((p,i)=>stem(p,values[i]));
      assert.equal(accepts(positive,facts),values.some(s=>names.includes(s)));assert.equal(accepts(negative,[...facts,stem('day','甲')]),values.every(s=>!names.includes(s)));checked+=2;
    }
  }assert.equal(checked,10000);
});

test('non-exposure cannot be proved from missing columns while positive exposure needs only its observed witness',()=>{
  assert.equal(accepts(parse('火透'),[stem('month','丁')]),true);
  assert.equal(accepts(parse('甲日且水不透'),[stem('day','甲'),stem('year','丙'),stem('month','丁')]),false);
  assert.equal(accepts(parse('甲日且水不透'),[stem('day','甲'),stem('year','丙'),stem('month','丁'),stem('hour','己')]),true);
  assert.equal(accepts(parse('火透'),[{kind:'branch',position:'year',branch:'巳'}]),false,'hidden fire is not exposed fire');
});

test('enumerated clauses preserve each predicate without breaking shared stem-list syntax',()=>{
  const groups=parse('丙藏、年癸透、月己透');assert.equal(groups.length,8);
  assert.ok(groups.every(g=>g.required.some(f=>f.position==='year'&&f.stem==='癸')&&g.required.some(f=>f.position==='month'&&f.stem==='己')&&g.required.some(f=>f.kind==='branch'&&['寅','巳'].includes(f.branch))));
  assert.equal(parse('甲、乙同透').length,6);
  for(const text of ['丙藏、年癸透、另有未定义条件','火透、水不透、制化成功','年癸透、','水不透且火势旺盛','有火透且无冲破','月时丙争合','年癸透即化合成功','甲日且有火不透','甲日且有水不透'])assert.equal(parse(text),null,text);
});

test('fixed-source clarifications require unchanged source, evidence, all conditions and review fields',()=>{
  const sources=JSON.parse(readFileSync(new URL('./claims/bazi.json',import.meta.url)));
  const mutations=[r=>{r.source.volume+='校';},r=>{r.evidence.original_text+='另句';},r=>{r.evidence.context+='新前提';},r=>r.conditions.normalized.push('新条件'),r=>r.conditions.original.push('新原文'),r=>r.conditions.uncertain.push('待核'),r=>r.conditions.excluded.push('有甲则否'),r=>{r.conditions.match={status:'pending'};}];
  let checked=0;for(const id of ['qtbj-v2-c006-p001-002','qtbj-v5-c081-p002-101']){const source=sources.find(r=>r.id===id);assert.equal(baziLiteralSourceConditions(source).compiler,'bazi-reviewed-literal-source-v1');
    for(const mutate of mutations){const changed=structuredClone(source);mutate(changed);assert.equal(baziLiteralSourceConditions(changed),null);checked++;}
    assert.equal(baziLiteralSourceConditions({...source,id:'another-source'}),undefined);
  }assert.equal(checked,16);
});

test('both source clarifications retain exactly the original literal requirements',()=>{
  const sources=JSON.parse(readFileSync(new URL('./claims/bazi.json',import.meta.url)));
  assert.deepEqual(baziLiteralSourceConditions(sources.find(r=>r.id==='qtbj-v2-c006-p001-002')).normalized,['秋月甲日','庚透','原局无丁']);
  assert.deepEqual(baziLiteralSourceConditions(sources.find(r=>r.id==='qtbj-v5-c081-p002-101')).normalized,['辰月辛日','月时丙均透']);
});
