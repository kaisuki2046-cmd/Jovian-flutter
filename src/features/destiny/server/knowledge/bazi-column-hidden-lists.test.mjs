import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baziLiteralConditions, compatibleBaZiLiteralFacts } from './bazi-literal-conditions.mjs';
const positions = ['year', 'month', 'day', 'hour'];
const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
const parse = text => baziLiteralConditions({ conditions: { normalized: [text] } }, { positive: () => null, absence: () => null });
const matches = (groups, facts) => groups?.some(g => g.required.every(f => facts.some(x => JSON.stringify(x) === JSON.stringify(f))));
const stem = (position, stem) => ({ kind: 'stem', position, stem });
const branch = (position, branch) => ({ kind: 'branch', position, branch });

test('a named month/hour pair requires both named columns across all 1,000 visible stem arrangements', () => {
  const groups = parse('月时庚均透');
  assert.deepEqual(groups, [{ required: [stem('month','庚'),stem('hour','庚')], mustBeAbsent: [] }]);
  let checked = 0;
  for (const year of stems) for (const month of stems) for (const hour of stems) {
    assert.equal(matches(groups,[stem('year',year),stem('month',month),stem('day','庚'),stem('hour',hour)]), month === '庚' && hour === '庚'); checked++;
  }
  assert.equal(checked,1000); assert.equal(matches(groups,[stem('month','庚')]),false);
});

test('hidden lists are a conjunction with independent literal branch evidence across all 20,736 branch assignments', () => {
  const groups = parse('庚辛都伏藏'); let checked = 0;
  for (const year of branches) for (const month of branches) for (const day of branches) for (const hour of branches) {
    const values = [year,month,day,hour], expected = values.some(b => ['巳','申'].includes(b)) && values.some(b => ['丑','酉','戌'].includes(b));
    assert.equal(matches(groups,values.map((b,i) => branch(positions[i],b))),expected); checked++;
  }
  assert.equal(checked,20736); assert.ok(groups.every(g => g.mustBeAbsent.length === 0));
  assert.equal(matches(groups,[stem('year','庚'),stem('month','辛')]),false);
});

test('hidden list syntax neither requires main qi nor excludes simultaneous exposure', () => {
  const groups = parse('庚辛都伏藏');
  assert.equal(matches(groups,[branch('year','巳'),branch('day','丑'),stem('year','庚'),stem('hour','辛')]),true);
  assert.equal(matches(groups,[branch('year','巳')]),false);
  assert.ok(groups.some(g => g.required.some(f => f.branch === '巳') && g.required.some(f => f.branch === '丑')));
});

test('multi-stem exposure preserves all distinct non-day slots and does not turn an AND into an OR', () => {
  for (const text of ['甲戊庚出干','甲戊庚皆透']) {
    const groups = parse(text); assert.equal(groups.length,6);
    for (const g of groups) { assert.equal(new Set(g.required.map(f => f.position)).size,3); assert.ok(!g.required.some(f => f.position === 'day')); }
    assert.equal(matches(groups,[stem('year','甲'),stem('month','戊'),stem('hour','庚')]),true);
    assert.equal(matches(groups,[stem('year','甲'),stem('month','戊'),stem('day','庚')]),false);
  }
});

test('both apparent triple-exposure sources remain impossible under independent five-tiger month enumeration', () => {
  for (const [text,monthBranch,dayStem] of [['甲戊庚出干','亥','丙'],['丙癸甲皆透','申','戊']]) {
    const groups = parse(text);
    for (const g of groups) {
      const year = g.required.find(f => f.position === 'year').stem, month = g.required.find(f => f.position === 'month').stem;
      const tigerStart = { 甲:'丙',乙:'戊',丙:'庚',丁:'壬',戊:'甲',己:'丙',庚:'戊',辛:'庚',壬:'壬',癸:'甲' }[year];
      const actualMonth = stems[(stems.indexOf(tigerStart) + '寅卯辰巳午未申酉戌亥子丑'.indexOf(monthBranch)) % 10];
      assert.notEqual(month,actualMonth);
      assert.equal(compatibleBaZiLiteralFacts([...g.required,branch('month',monthBranch),stem('day',dayStem)]),false);
    }
  }
});

test('unknown modifiers, repeated names and ambiguous month/hour syntax fail closed', () => {
  for (const text of ['庚庚都伏藏','庚辛都伏藏且制化成功','庚辛都伏藏且另需未知条件','月时庚透','月时透癸','甲甲庚出干','甲戊庚皆透且无冲破','庚辛见','月时庚均透则必贵']) assert.equal(parse(text),null,text);
});
