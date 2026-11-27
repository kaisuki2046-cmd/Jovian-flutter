import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { astro } from 'iztro';
import * as LunarPackage from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit } from './control/fortune-prompt.mjs';
const { quanshuTianxingCondition, quanshuZiweiPolicy } = await import('./control/ziwei-quanshu.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const reference = JSON.parse(readFileSync(new URL('./model/fixtures/quanshu-tianxing-reference.json', import.meta.url)));
const config = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current' };
const native = (example = reference.realExamples[0]) => astro.withOptions({ ...example, fixLeap: true, config }).toJSON();
const stars = palace => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
const position = natal => natal.palaces.find(p => stars(p).some(s => s.name === '天刑'));
const chart = (natal = native()) => ({ timeKnown: true, bazi: { rawResult: [] }, western: { rawResult: [] },
  ziwei: { engineName: 'iztro', engineVersion: '2.6.5', rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1', rawResult: [natal] } });
function calculate(snapshot = chart(), year = 2025) {
  const input = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const time = buildFactTimeContext(input, Date.parse('2026-11-19T03:00:00Z'), 'server');
  return calculateFortuneFacts(input, time, 'tianxing-run', { snapshotId: 'tianxing-snapshot', chart: snapshot });
}
const rule = fortuneKnowledge.ziwei.rules[67];
const result = run => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === rule.knowledgeId);
const specific = run => run.facts.filter(f => f.factType === 'quanshu_tianxing_condition');
const cached = new Map();
const realRun = example => {
  const key = example.dateStr + ':' + example.year;
  if (!cached.has(key)) cached.set(key, calculate(chart(native(example)), example.year));
  return cached.get(key);
};

test('source month placement covers all twelve branches and the four-seat reading never borrows engine brightness', () => {
  assert.equal(reference.profile, quanshuZiweiPolicy.tianxing);
  assert.deepEqual(reference.birthMonthBranches, ['酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申']);
  for (let month = 1; month <= 12; month++) {
    const dateStr = LunarPackage.Lunar.fromYmd(1991, month, 1).getSolar().toYmd();
    const natal = native({ dateStr, timeIndex: 2, gender: '女' }), before = structuredClone(natal), palace = position(natal);
    const condition = quanshuTianxingCondition(natal, palace.index);
    assert.equal(condition.ready, true, dateStr); assert.equal(condition.birthMonth, month);
    assert.equal(condition.tianxingBranch, reference.birthMonthBranches[month - 1]); assert.equal(condition.inLimit, true);
    assert.equal(condition.templeListed, reference.templeListedBranches.includes(palace.earthlyBranch));
    assert.deepEqual(natal, before);
    for (const star of stars(palace)) if (star.name === '天刑') star.brightness = condition.templeListed ? '陷' : '庙';
    assert.deepEqual(quanshuTianxingCondition(natal, palace.index), condition);
    assert.equal(quanshuTianxingCondition(natal, (palace.index + 1) % 12).inLimit, false);
  }
});

test('missing, duplicate, displaced, leap and invalid source frames cannot fabricate a definite Tianxing condition', () => {
  for (const alter of [
    n => { position(n).adjectiveStars = position(n).adjectiveStars.filter(s => s.name !== '天刑'); },
    n => { position(n).adjectiveStars.push({ name: '天刑' }); },
    n => { const p = position(n); const star = stars(p).find(s => s.name === '天刑'); p.adjectiveStars = p.adjectiveStars.filter(s => s.name !== '天刑'); n.palaces[(p.index + 1) % 12].adjectiveStars.push(star); },
    n => { n.rawDates.lunarDate.isLeap = true; },
    n => { n.rawDates.lunarDate.lunarMonth = 0; },
    n => { n.rawDates.chineseDate.yearly[0] = '辛'; },
  ]) {
    const natal = native(); alter(natal);
    const condition = quanshuTianxingCondition(natal, 0);
    assert.equal(condition.ready, false); assert.equal(condition.templeListed, undefined);
  }
  assert.equal(quanshuTianxingCondition(native(), 12).ready, false);
});

test('both source branches reach actual limit facts, SQLite matching and the Chinese prompt with intact effective windows', () => {
  for (const example of reference.realExamples) {
    const run = realRun(example); validateFortuneFacts(run);
    const match = result(run); assert.equal(match.status, 'matched', example.dateStr);
    const facts = specific(run);
    assert.ok(facts.length); assert.ok(facts.every(f => ['decadal', 'minor'].includes(f.scope) && f.completeness === 'complete'));
    const relevant = facts.filter(f => f.normalizedPayload.inLimit);
    assert.ok(relevant.length); assert.ok(relevant.every(f => f.normalizedPayload.templeListed === example.templeListed));
    assert.ok(relevant.some(f => f.scope === example.scope));
    assert.ok(relevant.every(f => f.normalizedPayload.birthMonth === example.birthMonth && f.normalizedPayload.tianxingBranch === example.tianxingBranch));
    assert.ok(match.windows.every(w => relevant.some(f => f.activeFrom <= w.start && w.endExclusive <= f.activeTo)));
    assert.ok(match.sourceFactIds.every(id => relevant.some(f => f.factId === id)));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'tianxing-prompt'));
    assert.ok(input.sections.flatMap(s => s.findings).some(f => f.knowledgeId === rule.knowledgeId));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, /原文：二限逢之主出家，官事牢狱失财，入庙则吉/u);
    assert.match(prompt, example.templeListed ? /符合入庙例外/u : /未列不等于落陷/u);
    assert.match(prompt, /没有认定昌曲吉星凑合/u);
    for (const forbidden of ['templeListed', 'quanshu_tianxing', 'tianxingBranch', 'tianxing-run', 'https://', '"inLimit"']) assert.ok(!prompt.includes(forbidden), forbidden);
  }
});

test('a real minor-limit encounter begins at the native Lunar New Year, never at January first or across another limit scope', () => {
  const run = realRun(reference.realExamples[2]);
  const match = result(run), relevant = specific(run).filter(f => f.normalizedPayload.inLimit);
  assert.ok(relevant.length && relevant.every(f => f.scope === 'minor'));
  assert.deepEqual(match.windows, [{ start: '2021-02-11T16:00:00.000Z', endExclusive: '2021-12-31T16:00:00.000Z' }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'minor-tianxing'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /紫微斗数，小限/u);
  assert.match(prompt, /共同有效时段：2021-02-12 00:00:00至2022-01-01 00:00:00/u);
});

test('yearly/monthly substitutes, missing exception fields, generic star hits and non-contact limits never satisfy the complete mapping', () => {
  const baseline = realRun(reference.realExamples[0]);
  for (const scope of ['yearly', 'monthly', 'daily']) {
    const run = structuredClone(baseline); specific(run).forEach(f => { f.scope = scope; });
    assert.notEqual(result(run).status, 'matched', scope);
  }
  for (const field of ['templeListed', 'profile', 'ready']) {
    const run = structuredClone(baseline); specific(run).forEach(f => { delete f.normalizedPayload[field]; });
    assert.equal(result(run).status, 'unknown', field);
  }
  const generic = structuredClone(baseline); generic.facts = generic.facts.filter(f => f.factType !== 'quanshu_tianxing_condition');
  assert.equal(result(generic).status, 'unknown');
  const nonContact = structuredClone(baseline); specific(nonContact).forEach(f => { f.normalizedPayload.inLimit = false; });
  assert.equal(result(nonContact).status, 'not_matched');
  const wrongProfile = structuredClone(baseline); specific(wrongProfile).forEach(f => { f.normalizedPayload.profile = 'other-source'; });
  assert.equal(result(wrongProfile).status, 'not_matched');
});

test('real ambiguous, incompatible or damaged archives never provide a complete model finding', () => {
  for (const alter of [c => { c.timeKnown = false; },
    c => { c.ziwei.rawResult.push(structuredClone(c.ziwei.rawResult[0])); },
    c => { c.ziwei.engineVersion = 'other'; }, c => { c.ziwei.rawResult[0].rawDates.lunarDate.isLeap = true; },
    c => { position(c.ziwei.rawResult[0]).adjectiveStars.push({ name: '天刑' }); }]) {
    const snapshot = chart(); alter(snapshot); const run = calculate(snapshot);
    assert.notEqual(result(run).status, 'matched');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'no-tianxing'));
    assert.ok(!input.sections.flatMap(s => s.findings).some(f => f.knowledgeId === rule.knowledgeId));
  }
});

test('the reviewed source branch retains original evidence and conditions, fixed revision support and both exception states', () => {
  const entry = fortuneKnowledge.ziwei.entries.find(e => e.id === rule.knowledgeId);
  assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
  assert.equal(rule.unresolved.length, 0);
  assert.deepEqual(rule.queries[0].scopes, ['decadal', 'minor']);
  assert.deepEqual(rule.queries[0].anyOf, [{ templeListed: true }, { templeListed: false }]);
  assert.ok(rule.review.supportingSources.every(url => /oldid=(7913704|1963110)/u.test(url)));
  assert.match(rule.review.mappedConditions.join(), /未列不标成落陷/u);
  assert.match(rule.review.mappedConditions.join(), /不据此认定/u);
});
