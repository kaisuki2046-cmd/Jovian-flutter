import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Solar } from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit } from './control/fortune-prompt.mjs';

const { buildBaZiCalculation } = await import('./control/bazi-calculation.ts');
const { baziNatalConditions, baziLuckConditions } = await import('./control/bazi-conditions.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');

function archive(gender = 0) {
  const lunar = Solar.fromYmdHms(1990, 9, 29, 12, 0, 0).getLunar();
  const luckPeriods = lunar.getEightChar().getYun(gender, 2).getDaYun(11).slice(1)
    .map(stage => ({ ganZhi: stage.getGanZhi(), startAge: stage.getStartAge(), endAge: stage.getEndAge() }));
  return { timeKnown: true,
    bazi: { engineName: 'lunar-javascript', engineVersion: '1.7.8', rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1',
      rawResult: [{ utc: '1990-09-29T04:00:00.000Z', year: lunar.getYearInGanZhiExact(), month: lunar.getMonthInGanZhiExact(),
        day: lunar.getDayInGanZhiExact(), hour: lunar.getTimeInGanZhi(), luckPeriods, tenGods: {}, shenSha: {} }] },
    ziwei: { rawResult: [] }, western: { rawResult: [] } };
}
const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai' };
function calculate(chart = archive(), year = 2026) {
  const time = buildFactTimeContext({ ...params, targetPeriod: { year } }, Date.parse(`${year}-11-18T02:00:00Z`), 'server');
  return calculateFortuneFacts({ ...params, targetPeriod: { year } }, time, 'bazi-mapping-run', { snapshotId: 'bazi-snapshot', chart });
}
const ruleNumber = (rules, n) => rules.find(row => row.knowledgeId.includes('zpqz-1936-interpretation-p' + String(n).padStart(3, '0') + '-'));

test('natal observables separate exposed and hidden qi, day master, residual roots and genuinely unknown absences', () => {
  const natal = { year: '甲子', month: '丁卯', day: '甲辰', hour: '辛未' };
  const conditions = baziNatalConditions(natal, true);
  assert.equal(conditions.monthMainQi, '乙');
  assert.equal(conditions.monthMainQiTenGod, '劫财');
  assert.deepEqual(conditions.exposedStems, ['甲', '丁', '辛']);
  assert.deepEqual(conditions.stemConditions.find(item => item.stem === '甲').exposurePositions, ['year']);
  assert.deepEqual(conditions.stemConditions.find(item => item.stem === '甲').rootPositions, ['month', 'day', 'hour']);
  assert.ok(conditions.absentTenGods.includes('七杀'));
  const unknown = baziNatalConditions(natal, false);
  assert.equal(unknown.hourPillar, undefined);
  assert.equal(unknown.absentTenGods, undefined);
  assert.equal(unknown.stemConditions.find(item => item.stem === '辛').exposed, undefined);
  assert.ok(!unknown.stemConditions.find(item => item.stem === '甲').rootPositions.includes('hour'));
  const luck = baziLuckConditions('丙子', '甲', conditions);
  assert.equal(luck.stemRootedInLuckBranch, false);
  assert.equal(luck.branchDirection, 3);
  assert.equal(luck.tenGod, '食神');
  const repeated = baziNatalConditions({ year: '甲申', month: '丙申', day: '戊寅', hour: '壬子' }, true);
  assert.deepEqual(repeated.repeatedBranches, ['申']);
  const joint = baziLuckConditions('庚寅', '戊', repeated, '壬寅');
  assert.deepEqual(joint.clashedNatalPositions, ['year', 'month']);
  assert.deepEqual(joint.annualJointClashPositions, ['year', 'month']);
  const different = baziLuckConditions('庚寅', '戊', repeated, '壬午');
  assert.deepEqual(different.annualJointClashPositions, []);
  assert.equal(baziLuckConditions('甲子', '乙', baziNatalConditions({ year: '癸亥', month: '丙寅', day: '乙亥', hour: '戊午' }, true)).revealsNatalHiddenStem, true);
  assert.equal(baziLuckConditions('甲子', '甲', conditions).revealsNatalHiddenStem, false);
});

test('a unique recomputed ten-stage archive selects the real backward luck without borrowing Ziwei sex', () => {
  const result = calculate();
  validateFortuneFacts(result);
  const luck = result.facts.filter(fact => fact.factType === 'luck_conditions');
  assert.ok(luck.length > 0);
  assert.ok(luck.every(fact => fact.completeness === 'complete' && fact.normalizedPayload.confirmed));
  assert.deepEqual([...new Set(luck.map(fact => fact.normalizedPayload.pillar))], ['壬午']);
  assert.equal(luck[0].normalizedPayload.stageStart, '2017-10-31T02:00:00.000Z');
  assert.equal(luck[0].normalizedPayload.stageEnd, '2027-10-31T02:00:00.000Z');
  const pillars = result.facts.filter(fact => fact.factType === 'luck_pillar');
  assert.ok(pillars.every(fact => fact.normalizedPayload.direction === 'backward' && fact.completeness === 'complete'));
  const male = calculate(archive(1));
  assert.ok(male.facts.filter(fact => fact.factType === 'luck_pillar')
    .every(fact => fact.normalizedPayload.direction === 'forward' && fact.completeness === 'complete'));
});

test('missing, altered, shortened, ambiguous and unknown-time archives cannot select a complete luck direction', () => {
  const cases = [chart => { delete chart.bazi.rawResult[0].luckPeriods; },
    chart => { chart.bazi.rawResult[0].luckPeriods[7].startAge += 1; },
    chart => { chart.bazi.rawResult[0].luckPeriods.pop(); },
    chart => { chart.timeKnown = false; },
    chart => { chart.bazi.rawResult.push(structuredClone(chart.bazi.rawResult[0])); },
    chart => { chart.bazi.rawResult[0].utc = '1990-03-29T04:00:00Z'; }];
  for (const alter of cases) {
    const chart = archive(); alter(chart);
    const result = calculate(chart);
    assert.ok(!result.facts.some(fact => ['luck_conditions', 'luck_pillar'].includes(fact.factType) && fact.completeness === 'complete'));
  }
  const incompatible = archive(); incompatible.bazi.engineVersion = 'unknown';
  assert.equal(calculate(incompatible).methods.bazi.status, 'not_supported');
});

test('a luck change is cut at the computed instant rather than January 1 or the integer age', () => {
  const result = calculate(archive(), 2027);
  const facts = result.facts.filter(fact => fact.factType === 'luck_conditions');
  const change = '2027-10-31T02:00:00.000Z';
  assert.ok(facts.some(fact => fact.activeTo === change && fact.normalizedPayload.pillar === '壬午'));
  assert.ok(facts.some(fact => fact.activeFrom === change && fact.normalizedPayload.pillar === '辛巳'));
  assert.ok(facts.every(fact => fact.activeFrom >= fact.normalizedPayload.stageStart && fact.activeTo <= fact.normalizedPayload.stageEnd));
  const time = result.time;
  const calculation = buildBaZiCalculation(time.window, time.referenceAt, archive());
  assert.equal(calculation.candidates[0].directions.filter(direction => direction.confirmed).length, 1);
  const chart = archive();
  const natal = chart.bazi.rawResult[0];
  const selected = calculation.candidates[0].directions.find(direction => direction.confirmed);
  natal.luckContext = {
    profile: 'lunar-javascript-beijing-jie-sect2-v1', gender: 'female', direction: selected.direction,
    periods: natal.luckPeriods.map((period, index) => {
      const stage = selected.stages[index + 1];
      return { ...period, start: new Date(stage.start).toISOString(), endExclusive: new Date(stage.end).toISOString() };
    }),
  };
  const signed = () => buildBaZiCalculation(time.window, time.referenceAt, chart).candidates[0].directions;
  assert.equal(signed().filter(direction => direction.confirmed).length, 1);
  natal.luckContext.periods[0].start = natal.utc;
  assert.ok(signed().every(direction => !direction.confirmed));
});

test('all 106 source expansions keep reviewed predicates with complete conditions for the verified relationships', () => {
  const library = fortuneKnowledge.bazi;
  const entries = library.entries.filter(entry => entry.id.includes('zpqz-1936-interpretation-'));
  assert.equal(entries.length, 106);
  for (const entry of entries) {
    const rule = library.rules.find(rule => rule.knowledgeId === entry.id);
    const atomicTypes = ['zpqz_luck_context', 'zpqz_moving_relations', 'zpqz_stem_order', 'zpqz_month_command', 'zpqz_seal_food_context', 'zpqz_food_killer_context', 'zpqz_killer_order_context', 'zpqz_wealth_context', 'zpqz_officer_context'];
    const atomic = rule.queries.some(query => atomicTypes.includes(query.factType));
    assert.equal(rule.queries.length, 1, entry.id + ' must use one same-candidate/same-stage atomic premise');
    assert.ok(!rule.queries.some(query => ['natal_conditions', 'luck_conditions'].includes(query.factType)), entry.id);
    assert.ok(rule.queries.length >= (atomic ? 1 : 2), entry.id);
    if (/p(?:002|011|032|033|034|048|049|051|078|081|082|084|096)-001$/u.test(entry.id)) assert.deepEqual(rule.unresolved, []);
    else assert.ok(rule.unresolved.length > 0, entry.id);
    assert.equal(rule.review.sourcePassageId, entry.source.passage_id);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
    assert.ok(rule.queries.some(query => ['luck_conditions', ...atomicTypes].includes(query.factType) && query.where.confirmed === true));
    for (const query of rule.queries.filter(query => query.factType === 'zpqz_moving_relations')) {
      assert.equal(query.scope, 'decadal');
      assert.equal(query.where.timeKnown, true);
      assert.equal(query.where.profile, 'zpqz-moving-root-clash-atomic-v1');
    }
    for (const query of rule.queries.filter(query => query.factType === 'zpqz_stem_order')) {
      assert.equal(query.scope, 'decadal');
      assert.equal(query.where.timeKnown, true);
      assert.equal(query.where.profile, 'zpqz-stem-order-targets-atomic-v1');
    }
    for (const query of rule.queries.filter(query => query.factType === 'zpqz_month_command')) {
      assert.equal(query.scope, 'decadal');
      assert.equal(query.where.timeKnown, true);
      assert.equal(query.where.confirmed, true);
      assert.equal(query.where.profile, 'zpqz-month-command-exposure-atomic-v1');
    }
    for (const query of rule.queries.filter(query => query.factType === 'zpqz_seal_food_context')) {
      assert.equal(query.scope, 'decadal');
      assert.equal(query.where.timeKnown, true);
      assert.equal(query.where.confirmed, true);
      assert.equal(query.where.profile, 'zpqz-seal-output-exposure-targets-v1');
    }
    for (const query of rule.queries.filter(query => query.factType === 'zpqz_food_killer_context')) {
      assert.equal(query.scope, 'decadal');
      assert.equal(query.where.timeKnown, true);
      assert.equal(query.where.confirmed, true);
      assert.equal(query.where.profile, 'zpqz-food-killer-no-seal-and-climate-candidates-v1');
    }
    for (const query of rule.queries.filter(query => query.factType === 'zpqz_killer_order_context')) {
      assert.equal(query.scope, 'decadal');
      assert.equal(query.where.timeKnown, true);
      assert.equal(query.where.confirmed, true);
      assert.equal(query.where.profile, 'zpqz-killer-clearing-helper-order-v1');
    }
    for (const query of rule.queries.filter(query => query.factType === 'zpqz_wealth_context')) {
      assert.equal(query.scope, 'decadal');
      assert.equal(query.where.timeKnown, true);
      assert.equal(query.where.confirmed, true);
      assert.equal(query.where.profile, 'zpqz-wealth-visible-food-seal-and-killer-targets-v1');
    }
    for (const query of rule.queries.filter(query => query.factType === 'zpqz_officer_context')) {
      assert.equal(query.scope, 'decadal');
      assert.equal(query.where.timeKnown, true);
      assert.equal(query.where.confirmed, true);
      assert.equal(query.where.profile, 'zpqz-officer-wealth-seal-output-targets-v1');
    }
    assert.ok(!rule.unresolved.some(value => value.includes('尚未登记')));
  }
  assert.deepEqual(ruleNumber(library.rules, 21).queries[0].where,
    { profile: 'zpqz-stem-order-targets-atomic-v1', timeKnown: true, confirmed: true, dayMaster: '甲',
      natalYearPillar: '戊辰', natalMonthPillar: '辛酉', luckStem: '癸', hasGuiWithYearWu: true,
      movingFiveTargets: { includesAll: ['year:戊:偏财'] } });
  assert.equal(ruleNumber(library.rules, 29).queries[0].where.dayMaster, '丙');
  assert.equal(ruleNumber(library.rules, 30).queries[0].where.dayMaster, '丁');
  assert.match(ruleNumber(library.rules, 43).unresolved[0], /五年/u);
  assert.match(ruleNumber(library.rules, 98).unresolved[0], /分歧/u);
});

test('verified Ding-You natal and Wu luck place the source definition in the model findings', () => {
  const run = calculate();
  const matching = ruleNumber(matchFortuneKnowledge(run).byMethod.bazi, 34);
  assert.equal(matching.status, 'matched');
  assert.ok(matching.sourceFactIds.every(id => run.facts.some(fact => fact.factId === id)));
  const male = ruleNumber(matchFortuneKnowledge(calculate(archive(1))).byMethod.bazi, 34);
  assert.equal(male.status, 'not_matched');
  const bad = archive(); bad.bazi.rawResult[0].luckPeriods[0].endAge += 1;
  assert.equal(ruleNumber(matchFortuneKnowledge(calculate(bad)).byMethod.bazi, 34).status, 'unknown');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'bazi-to-prompt'));
  assert.ok(input.facts.some(fact => fact.type === 'zpqz_seal_food_context'));
  assert.ok(input.facts.some(fact => fact.type === 'luck_conditions' || fact.type === 'luck_pillar'));
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === matching.knowledgeId);
  assert.ok(finding);
  assert.match(finding.note, /行午运到丁的禄位.*禄堂劫财.*比肩/u);
  assert.doesNotMatch(finding.note, /发财|破财|午藏丙|一定/u);
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /大运柱为壬午/u);
  assert.match(prompt, /唯一方案逐项一致/u);
  assert.ok(!/rootPolicy|selectionPolicy|luckPeriods|stemRootedIn|natal_conditions/u.test(prompt));
});
