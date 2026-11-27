import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Solar } from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
const { validateFortuneFacts } = await import('./control/fortune-facts.ts');
import { formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';

const { baziSmthSealHurting } = await import('./control/bazi-smth-seal-hurting.ts');
const { baziColumnRoles } = await import('./control/bazi-calculation.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { createFortuneDeepSeek } = await import('./server/deepseek-expression.mjs');

const factType = 'smth_seal_hurting_context';
const cases = {
  annualSeal: { month: 5, day: 7, hour: 20, gender: 0, pillars: ['戊辰', '丁巳', '壬戌', '庚戌'] },
  luckSeal: { month: 1, day: 1, hour: 8, gender: 0, pillars: ['丁卯', '壬子', '乙卯', '庚辰'] },
  officerDamage: { month: 1, day: 7, hour: 16, gender: 0, pillars: ['丁卯', '癸丑', '辛酉', '丙申'] },
  unsupportedOfficer: { month: 1, day: 10, hour: 8, gender: 1, pillars: ['丁卯', '癸丑', '甲子', '戊辰'] },
  officerBlade: { month: 5, day: 25, hour: 8, gender: 1, pillars: ['戊辰', '丁巳', '庚辰', '庚辰'] },
  seasonalBladeKiller: { year: 1981, month: 8, day: 24, hour: 6, gender: 1, targetYear: 2028, pillars: ['辛酉', '丙申', '甲戌', '丁卯'] },
  monthOfficerExposure: { month: 5, day: 10, hour: 8, gender: 1, targetYear: 2011, pillars: ['戊辰', '丁巳', '乙丑', '庚辰'] },
  autumnOfficerRoot: { month: 10, day: 16, hour: 8, gender: 1, targetYear: 2021, pillars: ['戊辰', '壬戌', '甲辰', '戊辰'] },
  winterOfficerRoot: { month: 11, day: 15, hour: 8, gender: 1, targetYear: 2021, pillars: ['戊辰', '癸亥', '甲戌', '戊辰'] },
  visibleHurtOfficer: { year: 1957, month: 8, day: 10, hour: 8, gender: 0, targetYear: 2021, pillars: ['丁酉', '戊申', '甲寅', '戊辰'] },
  namedWuHurtOfficer: { year: 1979, month: 7, day: 6, hour: 14, gender: 0, targetYear: 1981, pillars: ['己未', '庚午', '甲戌', '辛未'] },
  wuHurtOfficerOtherHour: { year: 1979, month: 7, day: 6, hour: 12, gender: 0, targetYear: 1981, pillars: ['己未', '庚午', '甲戌', '庚午'] },
  namedSiHurtOfficer: { year: 1977, month: 5, day: 8, hour: 16, gender: 1, targetYear: 2040, pillars: ['丁巳', '乙巳', '乙丑', '甲申'] },
  siHurtOfficerOtherHour: { year: 1977, month: 5, day: 8, hour: 14, gender: 1, targetYear: 2040, pillars: ['丁巳', '乙巳', '乙丑', '癸未'] },
  namedWuHurtZiOfficer: { year: 1977, month: 6, day: 8, hour: 0, gender: 1, targetYear: 2033, pillars: ['丁巳', '丙午', '丙申', '戊子'] },
  namedWuHurtExposedOfficer: { year: 1977, month: 6, day: 8, hour: 10, gender: 1, targetYear: 2033, pillars: ['丁巳', '丙午', '丙申', '癸巳'] },
  wuHurtGuiOtherHour: { year: 1977, month: 6, day: 8, hour: 12, gender: 1, targetYear: 2033, pillars: ['丁巳', '丙午', '丙申', '甲午'] },
  officerWithDutySeal: { year: 1962, month: 5, day: 13, hour: 4, gender: 0, targetYear: 1986, pillars: ['壬寅', '乙巳', '辛亥', '庚寅'] },
  officerAfterDutySeal: { year: 1962, month: 5, day: 13, hour: 10, gender: 0, targetYear: 1986, pillars: ['壬寅', '乙巳', '辛亥', '癸巳'] },
  autumnDingBelowRen: { year: 2002, month: 10, day: 3, hour: 4, gender: 0, targetYear: 2021, pillars: ['壬午', '己酉', '甲辰', '丙寅'] },
  autumnUnshieldedHurt: { year: 2002, month: 10, day: 3, hour: 20, gender: 0, targetYear: 2021, pillars: ['壬午', '己酉', '甲辰', '甲戌'] },
  autumnDingAboveHai: { year: 1947, month: 9, day: 22, hour: 8, gender: 0, targetYear: 2021, pillars: ['丁亥', '己酉', '甲辰', '戊辰'] },
  peerBoundary: { month: 6, day: 13, hour: 12, gender: 1, pillars: ['戊辰', '戊午', '己亥', '庚午'] },
  hurtingOnDuty: { year: 1978, month: 7, day: 11, hour: 4, gender: 0, targetYear: 2011, pillars: ['戊午', '己未', '甲戌', '丙寅'] },
  hurtingOutsideDuty: { year: 1978, month: 6, day: 13, hour: 4, gender: 0, targetYear: 1982, pillars: ['戊午', '戊午', '丙午', '庚寅'] },
  builtLuLuckWealth: { year: 1978, month: 6, day: 5, hour: 4, gender: 0, targetYear: 2020, pillars: ['戊午', '丁巳', '戊戌', '甲寅'] },
  builtLuOnlyAnnualWealth: { year: 1979, month: 6, day: 11, hour: 4, gender: 1, targetYear: 1982, pillars: ['己未', '庚午', '己酉', '丙寅'] },
  builtLuWithoutWealthOfficer: { year: 2007, month: 3, day: 22, hour: 22, gender: 0, targetYear: 2021, pillars: ['丁亥', '癸卯', '乙卯', '丁亥'] },
  builtLuWithHiddenKiller: { year: 2007, month: 3, day: 22, hour: 18, gender: 0, targetYear: 2025, pillars: ['丁亥', '癸卯', '乙卯', '乙酉'] },
  builtLuRobbery: { year: 1983, month: 3, day: 28, hour: 22, gender: 0, targetYear: 2065, pillars: ['癸亥', '乙卯', '乙卯', '丁亥'] },
  builtLuRobberyWithHiddenKiller: { year: 1983, month: 3, day: 28, hour: 18, gender: 0, targetYear: 2065, pillars: ['癸亥', '乙卯', '乙卯', '乙酉'] },
  builtLuNamedPressure: { year: 1977, month: 7, day: 1, hour: 8, gender: 1, targetYear: 2015, pillars: ['丁巳', '丙午', '己未', '戊辰'] },
  builtLuNamedOtherHour: { year: 1977, month: 7, day: 1, hour: 6, gender: 1, targetYear: 2016, pillars: ['丁巳', '丙午', '己未', '丁卯'] },
  sealOnDuty: { year: 1978, month: 4, day: 5, hour: 12, gender: 0, targetYear: 1980, pillars: ['戊午', '丙辰', '丁酉', '丙午'] },
  sealSourceWealthLand: { year: 1907, month: 12, day: 12, hour: 0, gender: 0, targetYear: 1947, pillars: ['丁未', '壬子', '乙未', '丙子'] },
  sealNamedLandAnnualWealth: { year: 2019, month: 12, day: 24, hour: 0, gender: 1, targetYear: 2096, pillars: ['己亥', '丙子', '乙未', '丙子'] },
  sealSourceWealthLandWithKiller: { year: 1907, month: 12, day: 12, hour: 2, gender: 0, targetYear: 1947, pillars: ['丁未', '壬子', '乙未', '丁丑'] },
  woodSealAnnualWealth: { year: 1998, month: 3, day: 20, hour: 20, gender: 1, targetYear: 2041, pillars: ['戊寅', '乙卯', '丙寅', '戊戌'] },
  fireSealDecadalWealth: { year: 1920, month: 5, day: 11, hour: 12, gender: 0, targetYear: 1966, pillars: ['庚申', '辛巳', '己巳', '庚午'] },
  fireSealAnnualWealth: { year: 1920, month: 5, day: 11, hour: 12, gender: 1, targetYear: 1936, pillars: ['庚申', '辛巳', '己巳', '庚午'] },
  sealNatalVisibleWealth: { year: 1978, month: 11, day: 9, hour: 12, gender: 0, targetYear: 2027, pillars: ['戊午', '癸亥', '乙亥', '壬午'] },
  sealNatalVisibleWealthWithKiller: { year: 1978, month: 11, day: 9, hour: 2, gender: 0, targetYear: 2027, pillars: ['戊午', '癸亥', '乙亥', '丁丑'] },
  sealNatalVisibleWealthWithPeer: { year: 1978, month: 11, day: 9, hour: 4, gender: 0, targetYear: 2027, pillars: ['戊午', '癸亥', '乙亥', '戊寅'] },
  sealWithRestraints: { year: 1978, month: 1, day: 3, hour: 4, gender: 0, targetYear: 2000, pillars: ['丁巳', '壬子', '乙丑', '戊寅'] },
  sealWithNativeWealth: { year: 1978, month: 1, day: 3, hour: 4, gender: 0, targetYear: 2005, pillars: ['丁巳', '壬子', '乙丑', '戊寅'] },
  sealWealthAssembly: { year: 1970, month: 8, day: 8, hour: 6, gender: 1, targetYear: 2000, pillars: ['庚戌', '癸未', '庚申', '己卯'] },
  namedHurtingWealth: { year: 2003, month: 3, day: 28, hour: 8, gender: 0, targetYear: 2045, pillars: ['癸未', '乙卯', '庚子', '庚辰'] },
  unrelatedHurtingWealth: { year: 2003, month: 3, day: 28, hour: 6, gender: 0, targetYear: 2046, pillars: ['癸未', '乙卯', '庚子', '己卯'] },
  natalKillerOnly: { year: 1978, month: 12, day: 11, hour: 4, gender: 0, targetYear: 2022, pillars: ['戊午', '甲子', '丁未', '壬寅'] },
};
const suffixes = { seal: 'career-smth-v5-seal-p004-001', officer: 'career-smth-v5-hurting-p003-001',
  peer: 'wealth-smth-v5-hurting-p003-002', builtLu: 'wealth-smth-v6-built-lu-p002-001' };
const idFor = name => 'bazi-fortune-v1-year-' + suffixes[name];
const outcome = (run, name) => matchFortuneKnowledge(run).byMethod.bazi.find(item => item.knowledgeId === idFor(name));
const facts = run => run.facts.filter(fact => fact.factType === factType);
const solarYear = run => facts(run).filter(fact => fact.normalizedPayload.yearPillar === '丙午');

function archive(name, { timeKnown = true, verifyLuck = true } = {}) {
  const { year = 1988, month, day, hour, gender, pillars } = cases[name];
  const lunar = Solar.fromYmdHms(year, month, day, hour, 0, 0).getLunar();
  const natal = [lunar.getYearInGanZhiExact(), lunar.getMonthInGanZhiExact(), lunar.getDayInGanZhiExact(), lunar.getTimeInGanZhi()];
  assert.deepEqual(natal, pillars);
  const luckPeriods = lunar.getEightChar().getYun(gender, 2).getDaYun(11).slice(1)
    .map(stage => ({ ganZhi: stage.getGanZhi(), startAge: stage.getStartAge(), endAge: stage.getEndAge() }));
  return { timeKnown, bazi: { engineName: 'lunar-javascript', engineVersion: '1.7.8', rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1',
    rawResult: [{ utc: new Date(Date.UTC(year, month - 1, day, hour - 8)).toISOString(),
      year: natal[0], month: natal[1], day: natal[2], hour: natal[3], ...(verifyLuck ? { luckPeriods } : {}), tenGods: {}, shenSha: {} }] },
    ziwei: { rawResult: [] }, western: { rawResult: [] } };
}

function submit(name, options, targetYear = cases[name].targetYear ?? 2026) {
  const params = { periodType: 'year', targetPeriod: { year: targetYear }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.parse('2026-11-01T02:00:00Z');
  const reference = { snapshotId: 'smth-fixture-' + name };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...reference, chart: archive(name, options) })));
  return bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'smth-fortune-fixture', reference);
}

test('the printed autumn Jia exception leaves unrelated hurt positions eligible in the real Xin-Chou year', () => {
  for (const [name, placement, waterPlacement, unshielded] of [
    ['autumnDingBelowRen', 'main_qi', 'stem', false],
    ['autumnUnshieldedHurt', 'main_qi', 'stem', true],
    ['autumnDingAboveHai', 'stem', 'main_qi', false],
  ]) {
    const run = submit(name);
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === '辛丑');
    assert.ok(fact, name);
    const p = fact.normalizedPayload;
    const [exception] = p.hurtOfficerSourceExceptions;
    assert.deepEqual([exception.hurt.column, exception.hurt.stem, exception.hurt.placement], ['year', '丁', placement]);
    assert.deepEqual([exception.water.column, exception.water.stem, exception.water.placement], ['year', '壬', waterPlacement]);
    assert.deepEqual([exception.monthOfficer.column, exception.monthOfficer.stem], ['month', '辛']);
    assert.ok(exception.arrivals.some(({officer, damage}) => officer.column === 'annual' && officer.stem === '辛'
      && damage.some(row => row.kind === '六破' && row.members.includes('day'))));
    assert.equal(p.hurtOfficerPathCandidate, unshielded, name);
    assert.deepEqual(p.hurtOfficerReview.map(row => row.hurt.column), unshielded ? ['hour'] : []);
    const matched = outcome(run, 'officer');
    assert.equal(matched.status, unshielded ? 'partial' : 'not_matched', name);
    assert.equal(matched.sourceFactIds.includes(fact.factId), unshielded, name);
    if (name === 'autumnDingBelowRen') {
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'autumn-officer-audit'));
      assert.match(formatFortuneFactAudit(input), /按卷五秋月甲日例.*从伤官候选中只排除/u);
      assert.doesNotMatch(formatFortunePrompt(input), /按卷五秋月甲日例|hurtOfficerSourceExceptions/u);
    }
    const request = requestForFortuneRun(run);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, request, 'smth-autumn-exclusion'));
    assert.match(formatFortuneFactAudit(input), /按卷五秋月甲日例.*从伤官候选中只排除/u);
    assert.doesNotMatch(formatFortunePrompt(input), /卷五秋月甲日例|hurtOfficerSourceExceptions/u);
  }
});

test('the source rows preserve their hashes and run atomic annual SQLite predicates', () => {
  for (const name of Object.keys(suffixes)) {
    const id = idFor(name);
    const entry = fortuneKnowledge.bazi.entries.find(item => item.id === id);
    const rule = fortuneKnowledge.bazi.rules.find(item => item.knowledgeId === id);
    assert.equal(rule.review.sourcePassageId, entry.source.passage_id);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
    assert.equal(rule.queries.length, 1);
    assert.equal(rule.queries[0].factType, factType);
    assert.equal(rule.queries[0].scope, 'yearly');
    assert.equal(rule.unresolved.length === 0, name === 'peer', id);
  }
});

test('month main qi, exposed secondary seal and moving main-qi wealth remain distinguishable', () => {
  const { year, month, day, hour } = archive('luckSeal').bazi.rawResult[0];
  const natal = { year, month, day, hour };
  const before = baziSmthSealHurting(natal, true, '乙巳', { status: 'before_luck' });
  assert.equal(before.monthSealCandidate, true);
  assert.equal(before.monthSealCandidates[0].placement, 'main_qi');
  assert.equal(before.annualWealthCandidate, false, '巳藏庚丙戊中的非本气财不作当前候选');
  assert.equal(before.luckWealthCandidate, false);
  const annual = submit('annualSeal', { verifyLuck: false });
  const annualFact = solarYear(annual)[0];
  assert.deepEqual(annualFact.normalizedPayload.monthSealExposures.map(row => [row.column, row.stem]), [['hour', '庚']]);
  assert.deepEqual(annualFact.normalizedPayload.movingWealth.map(row => [row.column, row.stem, row.placement]),
    [['annual', '丙', 'stem'], ['annual', '丁', 'main_qi']]);
  assert.equal(annualFact.normalizedPayload.luckWealthCandidate, undefined);
  assert.equal(outcome(annual, 'seal').status, 'partial');
  assert.equal(outcome(submit('annualSeal', { timeKnown: false }), 'seal').status, 'unknown');

  const luck = submit('luckSeal'), luckFact = solarYear(luck)[0];
  assert.deepEqual(luckFact.normalizedPayload.movingWealth.map(row => [row.column, row.stem, row.placement]), [['decadal', '戊', 'main_qi']]);
  assert.equal(luckFact.normalizedPayload.luckPillar, '丙辰');
  assert.equal(outcome(luck, 'seal').status, 'partial');
  assert.equal(outcome(submit('luckSeal', { verifyLuck: false }), 'seal').status, 'unknown');
});

test('monthly seal paths anchor arriving wealth, officer support and natal wealth restrained by the current luck', () => {
  const onDuty = submit('sealOnDuty'), dutyHit = outcome(onDuty, 'seal');
  assert.equal(dutyHit.status, 'partial');
  const duty = facts(onDuty).find(row => dutyHit.sourceFactIds.includes(row.factId)
    && row.normalizedPayload.yearPillar === '庚申').normalizedPayload;
  assert.equal(duty.monthSealCandidate, false);
  assert.equal(duty.sealWealthPathCandidate, true);
  assert.deepEqual(duty.sealWealthPaths.map(row => [row.target.stem, row.target.placement, row.dutyDay]),
    [['乙', 'other_hidden', 1]]);
  assert.deepEqual(duty.sealWealthPaths[0].arrivingWealth.map(row => [row.column, row.stem, row.placement]),
    [['annual', '庚', 'stem'], ['annual', '庚', 'main_qi']]);
  assert.deepEqual(duty.sealWealthPaths[0].wealthOfficerRelays, []);

  const review = submit('sealWithRestraints'), hit = outcome(review, 'seal');
  assert.equal(hit.status, 'partial');
  const data = facts(review).find(row => hit.sourceFactIds.includes(row.factId)
    && row.normalizedPayload.yearPillar === '庚辰').normalizedPayload;
  assert.equal(data.luckPillar, '乙卯');
  const [path] = data.sealWealthPaths;
  assert.deepEqual([path.target.column, path.target.stem], ['month', '癸']);
  assert.deepEqual(path.arrivingWealth.map(row => [row.column, row.stem]), [['annual', '戊']]);
  assert.deepEqual(path.feedingOfficers.map(row => [row.column, row.stem]), [['annual', '庚']]);
  assert.deepEqual(path.wealthOfficerRelays.map(({ wealth, officer }) => [wealth.column, wealth.stem, officer.column, officer.stem]),
    [['day', '己', 'annual', '庚'], ['hour', '戊', 'annual', '庚'], ['annual', '戊', 'annual', '庚']]);
  assert.deepEqual(path.nativeWealthWithLuckPeers.map(row => [row.wealth.column, row.wealth.stem]),
    [['day', '己'], ['hour', '戊']]);
  assert.ok(path.nativeWealthWithLuckPeers.every(row => row.peers.every(peer => peer.column === 'decadal' && peer.stem === '乙')));
  assert.equal(data.sealNativeWealthReliefCandidate, true);
  const model = buildFortuneModelContext(review, interpretFortune(review, requestForFortuneRun(review), 'monthly-seal-review')).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /本段流年柱庚辰的支本气戊为正财克本命月柱壬子的支本气癸为偏印/u);
  assert.match(prompt, /本段流年柱庚辰的天干庚为正官同时生同一处印/u);
  assert.match(prompt, /同一官杀再生本命月柱壬子/u);
  assert.match(prompt, /本命时柱戊寅的天干戊为正财克这处印，.+又克这处原局财，实际救应待核/u);
  assert.doesNotMatch(prompt, /sealWealthPaths|nativeWealthWithLuckPeers|sealOfficerReviewProfile/u);
  assert.ok(model.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
});

test('confirmed luck restraining natal wealth can supply the monthly seal path without arriving wealth', () => {
  const review = submit('sealWithNativeWealth');
  const fact = facts(review).find(row => row.normalizedPayload.yearPillar === '乙酉');
  const p = fact.normalizedPayload;
  assert.equal(p.luckPillar, '乙卯');
  assert.equal(p.sealWealthPathCandidate, false);
  assert.equal(p.sealNativeWealthReliefCandidate, true);
  assert.equal(p.sealSourceNatalVisibleWealth, false);
  const [path] = p.sealWealthPaths;
  assert.deepEqual([path.target.column, path.target.stem, path.arrivingWealth], ['month', '癸', []]);
  assert.deepEqual(path.natalYearHourWealth.map(row => [row.column, row.stem]), [['hour', '戊']]);
  assert.deepEqual(path.nativeWealthWithLuckPeers.map(row => [row.wealth.column, row.wealth.stem]),
    [['day', '己'], ['hour', '戊']]);
  assert.ok(path.nativeWealthWithLuckPeers.every(row => row.peers.every(peer => peer.column === 'decadal' && peer.stem === '乙')));
  const hit = outcome(review, 'seal');
  assert.equal(hit.status, 'partial');
  assert.ok(hit.sourceFactIds.includes(fact.factId));
  const model = buildFortuneModelContext(review, interpretFortune(review, requestForFortuneRun(review), 'native-wealth-month-seal')).input;
  assert.match(formatFortuneFactAudit(model), /本命时柱戊寅的天干戊为正财克这处印，.+又克这处原局财，实际救应待核/u);
  assert.ok(model.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));

  const unverified = submit('sealWithNativeWealth', { verifyLuck: false });
  assert.equal(outcome(unverified, 'seal').status, 'unknown');
  assert.equal(facts(unverified).find(row => row.normalizedPayload.yearPillar === '乙酉')
    .normalizedPayload.sealNativeWealthReliefCandidate, undefined);
});

test('the printed wealth land branch binds actual Chen main-qi wealth to the month seal only without its listed relays', async () => {
  const run = submit('sealSourceWealthLand');
  const stage = facts(run).find(row => row.normalizedPayload.yearPillar === '丁亥' && row.normalizedPayload.luckPillar === '丙辰');
  assert.ok(stage);
  const before = facts(run).find(row => row.activeTo === stage.activeFrom && row.normalizedPayload.luckPillar === '丙辰');
  assert.equal(before.normalizedPayload.yearPillar, '丙戌');
  assert.equal(before.normalizedPayload.sealSourceWealthLand, false);
  assert.ok(baziColumnRoles('annual', before.normalizedPayload.yearPillar, '乙').some(row => row.stem === '辛'
    && row.god === '七杀' && row.placement === 'other_hidden'));
  const p = stage.normalizedPayload;
  assert.equal(p.sealSourceWealthLand, true);
  const path = p.sealWealthPaths.find(row => row.target.stem === '癸' && row.target.placement === 'main_qi');
  assert.equal(path.target.pillar, '壬子');
  assert.ok(path.arrivingWealth.some(row => row.column === 'decadal' && row.placement === 'main_qi' && row.stem === '戊'));
  const result = outcome(run, 'seal');
  assert.equal(result.status, 'matched');
  assert.equal(result.matchedSourceExcerpt, '運入財鄉');
  assert.equal(result.windows[0].start, stage.activeFrom);
  assert.ok(result.sourceFactIds.includes(stage.factId) && !result.sourceFactIds.includes(before.factId));
  assert.ok(result.candidateWindows.some(row => row.endExclusive === stage.activeFrom));

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'month-seal-source-wealth-land'));
  assert.match(formatFortuneFactAudit(input), /按卷五运入财乡一支，大运支本气的实财克同一月令本气印/u);
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId);
  assert.equal(finding.originalText, '運入財鄉');
  assert.match(finding.conditions.join(''), /实际大运支的本气是财.*若该月印为用/u);
  const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
    const message = JSON.parse(options.body).messages[1].content;
    assert.match(message, /運入財鄉/u);
    assert.doesNotMatch(message, /却宜退身避位|sealSourceWealthLand|按卷五运入财乡一支/u);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(input);

  const withKiller = submit('sealSourceWealthLandWithKiller');
  const withKillerFact = facts(withKiller).find(row => row.normalizedPayload.yearPillar === '丁亥');
  const hour = withKillerFact.normalizedPayload.natalPillars.find(row => row.column === 'hour');
  assert.ok(baziColumnRoles('hour', hour.pillar, '乙').some(row => row.stem === '辛'
    && row.god === '七杀' && row.placement === 'other_hidden'));
  assert.equal(withKillerFact.normalizedPayload.sealSourceWealthLand, false);
  assert.equal(outcome(withKiller, 'seal').status, 'partial');
  const stemWealthOnly = submit('sealSourceWealthLand', undefined, 1966);
  const stemFact = facts(stemWealthOnly).find(row => row.normalizedPayload.luckPillar === '戊午');
  assert.ok(stemFact.normalizedPayload.sealWealthPaths.some(row => row.arrivingWealth.some(wealth =>
    wealth.column === 'decadal' && wealth.placement === 'stem' && wealth.stem === '戊')));
  assert.equal(stemFact.normalizedPayload.sealSourceWealthLand, false);
  assert.equal(outcome(stemWealthOnly, 'seal').status, 'partial');
});

test('the actual yearly wealth land resolves only after Li Chun and with no same-seal protection', async () => {
  const targetYear = 1967;
  const boundary = '1967-02-04T12:30:49.000Z';
  const run = submit('sealSourceWealthLand', undefined, targetYear);
  const before = facts(run).find(row => row.activeTo === boundary);
  const after = facts(run).find(row => row.activeFrom === boundary);
  assert.ok(before && after);
  assert.deepEqual([before.normalizedPayload.yearPillar, after.normalizedPayload.yearPillar], ['丙午', '丁未']);
  assert.deepEqual([before.normalizedPayload.luckPillar, after.normalizedPayload.luckPillar], ['戊午', '戊午']);
  assert.equal(before.normalizedPayload.sealSourceAnnualWealthLand, false);
  const data = after.normalizedPayload;
  assert.equal(data.sealSourceAnnualWealthLand, true);
  assert.equal(data.sealSourceWealthLand, false);
  const { target, arrivingWealth } = data.sealWealthPaths.find(row => row.target.stem === '癸');
  assert.equal(target.pillar, '壬子');
  assert.deepEqual(arrivingWealth.map(row => [row.column, row.placement, row.stem]),
    [['annual', 'main_qi', '己'], ['decadal', 'stem', '戊']]);
  const hit = outcome(run, 'seal');
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '歲運同論');
  assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: after.activeTo }]);
  assert.ok(hit.sourceFactIds.includes(after.factId) && !hit.sourceFactIds.includes(before.factId));

  const withKiller = submit('sealSourceWealthLandWithKiller', undefined, targetYear);
  const blocked = facts(withKiller).find(row => row.activeFrom === boundary);
  assert.equal(blocked.normalizedPayload.sealSourceAnnualWealthLand, false);
  assert.equal(outcome(withKiller, 'seal').status, 'partial');
  const notVerified = submit('sealSourceWealthLand', { verifyLuck: false }, targetYear);
  assert.ok(facts(notVerified).every(row => row.normalizedPayload.sealSourceAnnualWealthLand === undefined));

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'annual-wealth-land'));
  assert.match(formatFortuneFactAudit(input), /按卷五岁运同论一支，太岁支本气的实财克同一月令本气印/u);
  const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
    const message = JSON.parse(options.body).messages[1].content;
    assert.match(message, /歲運同論/u);
    assert.doesNotMatch(message, /按卷五岁运同论一支|sealSourceAnnualWealthLand|退身避位/u);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(input);
});

test('the named Yi seal land confirms annual wealth at the actual year change', async () => {
  const beforeAndAfter = [
    { name: 'sealSourceWealthLand', year: 1948, before: '丁亥', active: '戊子', luck: '丙辰',
      boundary: '1948-02-04T21:42:00.000Z', placement: 'stem', alsoHasLuckWealth: true },
    { name: 'sealNamedLandAnnualWealth', year: 2096, before: '乙卯', active: '丙辰', luck: '戊辰',
      boundary: '2096-02-03T19:46:51.000Z', placement: 'main_qi', alsoHasLuckWealth: false },
  ];

  for (const sample of beforeAndAfter) {
    const run = submit(sample.name, undefined, sample.year);
    const before = facts(run).find(row => row.activeTo === sample.boundary);
    const after = facts(run).find(row => row.activeFrom === sample.boundary);
    assert.ok(before && after, sample.name);
    assert.deepEqual([before.normalizedPayload.yearPillar, after.normalizedPayload.yearPillar], [sample.before, sample.active]);
    assert.deepEqual([before.normalizedPayload.luckPillar, after.normalizedPayload.luckPillar], [sample.luck, sample.luck]);
    assert.equal(before.normalizedPayload.sealSourceNamedLandAnnualWealth, false);
    assert.equal(after.normalizedPayload.sealSourceNamedLandAnnualWealth, true);
    assert.equal(after.normalizedPayload.sealSourceWealthLand, sample.alsoHasLuckWealth);
    assert.equal(after.normalizedPayload.sealSourceAnnualWealthLand, false);
    const [path] = after.normalizedPayload.sealNamedLandAnnualWealthPaths;
    assert.equal(path.target.stem, '癸');
    assert.deepEqual(path.namedLandPositions.map(row => [row.column, row.pillar]), [['decadal', sample.luck]]);
    assert.deepEqual(path.annualWealth.map(row => [row.column, row.placement, row.stem]), [['annual', sample.placement, '戊']]);

    const hit = outcome(run, 'seal');
    assert.equal(hit.status, 'matched');
    assert.ok(hit.matchedSourceExcerpt.split('\n').includes('流年再遇財尅印'));
    const branch = hit.confirmedBranches?.find(item => item.conditions[0].includes('时支或实际运支临卯、辰、巳')) ?? hit;
    assert.deepEqual(branch.windows, [{ start: sample.boundary, endExclusive: after.activeTo }]);
    assert.ok(branch.sourceFactIds.includes(after.factId) && !branch.sourceFactIds.includes(before.factId));

    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'named-yi-seal-land'));
    assert.match(formatFortuneFactAudit(input), /乙日亥子月印见原文时运卯辰巳的位证/u);
    const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
      const message = JSON.parse(options.body).messages[1].content;
      assert.match(message, /流年再遇財尅印/u);
      assert.doesNotMatch(message, /黄泉|黃泉|sealNamedLandAnnualWealthPaths|乙日亥子月印见原文时运卯辰巳的位证/u);
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
    } });
    await provider.interpret(input);
  }

  const protectedSeal = submit('sealSourceWealthLandWithKiller', undefined, 1948);
  const protectedYear = facts(protectedSeal).find(row => row.normalizedPayload.yearPillar === '戊子');
  assert.equal(protectedYear.normalizedPayload.sealSourceNamedLandAnnualWealth, false);
  assert.equal(outcome(protectedSeal, 'seal').status, 'partial');
});

test('the printed wealth land uses the actual metal or water wealth for the named wood and fire seals', () => {
  for (const { name, year, luck, element, column, stem } of [
    { name: 'woodSealAnnualWealth', year: '辛酉', luck: '己未', element: '木', column: 'annual', stem: '辛' },
    { name: 'fireSealDecadalWealth', year: '丙午', luck: '丙子', element: '火', column: 'decadal', stem: '癸' },
    { name: 'fireSealAnnualWealth', year: '丙子', luck: '壬午', element: '火', column: 'annual', stem: '癸' },
  ]) {
    const run = submit(name);
    const fact = facts(run).find(({ normalizedPayload: p }) => p.yearPillar === year && p.luckPillar === luck);
    assert.ok(fact, name);
    const p = fact.normalizedPayload;
    assert.equal(p.sealSourceWealthLand, column === 'decadal', name);
    assert.equal(p.sealSourceAnnualWealthLand, column === 'annual', name);
    const path = p.sealWealthPaths.find(row => row.target.element === element && row.target.placement === 'main_qi');
    assert.ok(path.arrivingWealth.some(row => row.column === column && row.placement === 'main_qi' && row.stem === stem));
    const matched = outcome(run, 'seal');
    assert.equal(matched.status, 'matched', name);
    assert.ok(matched.sourceFactIds.includes(fact.factId), name);
    assert.ok(matched.matchedSourceExcerpt.includes(column === 'annual' ? '歲運同論' : '運入財鄉'), name);
  }

  const next = submit('woodSealAnnualWealth', undefined, 2042);
  const after = facts(next).find(({ normalizedPayload: p }) => p.yearPillar === '壬戌');
  assert.equal(after.normalizedPayload.sealSourceAnnualWealthLand, false);
  assert.ok(!outcome(next, 'seal').sourceFactIds.includes(after.factId));
});

test('natal year wealth reaches the monthly proper seal only in the absence of proven protection', () => {
  for (const [name, eligible] of [['sealNatalVisibleWealth', true], ['sealNatalVisibleWealthWithKiller', false],
    ['sealNatalVisibleWealthWithPeer', false]]) {
    const run = submit(name);
    validateFortuneFacts(run);
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === '丁未' && row.normalizedPayload.luckPillar === '戊午');
    assert.ok(fact, name);
    const p = fact.normalizedPayload;
    const path = p.sealWealthPaths.find(({ target }) => target.god === '正印' && target.stem === '壬' && target.placement === 'main_qi');
    assert.ok(path?.natalYearHourWealth.some(wealth => wealth.column === 'year' && wealth.stem === '戊' && wealth.placement === 'stem'));
    assert.equal(p.sealSourceNatalVisibleWealth, eligible);
    assert.equal(p.sealSourceWealthLand, false);
    const contrast = outcome({ ...run, facts: [fact] }, 'seal');
    if (eligible) {
      const [source] = p.sealSourceNatalVisibleWealthPaths;
      assert.equal(source.target.column, 'month');
      assert.deepEqual(source.wealth.map(({ column, stem }) => [column, stem]), [['year', '戊']]);
      assert.equal(contrast.status, 'matched');
      assert.equal(contrast.matchedSourceExcerpt, '嵗時忌見財星');
      assert.deepEqual(contrast.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      const context = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'natal-wealth-proper-seal')).input;
      const prompt = formatFortunePrompt(context);
      assert.match(prompt, /嵗時忌見財星/u);
      assert.doesNotMatch(prompt, /sealSourceNatalVisibleWealth|却宜退身避位/u);
    } else {
      assert.deepEqual(p.sealSourceNatalVisibleWealthPaths, []);
      assert.equal(contrast.status, 'partial');
      const hourRoles = baziColumnRoles('hour', cases[name].pillars[3], '乙');
      if (name.endsWith('Killer')) assert.ok(hourRoles.some(row => row.stem === '辛' && row.god === '七杀'));
      else assert.ok(hourRoles.some(row => row.stem === '甲' && row.god === '劫财' && row.placement === 'main_qi'));
    }
  }
});

test('a confirmed luck branch adds the missing member of the wealth trine without moving main-qi wealth', () => {
  const run = submit('sealWealthAssembly');
  const windows = facts(run).filter(row => row.normalizedPayload.yearPillar === '庚辰');
  const before = windows.find(row => row.normalizedPayload.luckPillar === '丙戌');
  const after = windows.find(row => row.normalizedPayload.luckPillar === '丁亥');
  const p = after.normalizedPayload;
  assert.equal(before.activeTo, after.activeFrom);
  assert.equal(before.normalizedPayload.sealLuckWealthAssemblyCandidate, false);
  assert.equal(p.sealLuckWealthAssemblyCandidate, true);
  assert.deepEqual(p.movingWealth, []);
  assert.equal(p.sealNativeWealthReliefCandidate, false);
  const [assembly] = p.sealLuckWealthAssemblies;
  assert.deepEqual([assembly.branches, assembly.positions], ['亥卯未', [['decadal'], ['hour'], ['month']]]);
  assert.deepEqual([assembly.peak.column, assembly.peak.stem, assembly.peak.god], ['hour', '乙', '正财']);
  assert.ok(assembly.affectedSeals.some(row => row.column === 'month' && row.stem === '己'));
  const result = outcome(run, 'seal');
  assert.equal(result.status, 'partial');
  assert.ok(result.sourceFactIds.includes(after.factId));
  assert.ok(!result.sourceFactIds.includes(before.factId));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'seal-wealth-assembly'));
  assert.match(formatFortuneFactAudit(input), /大运补齐亥卯未三合财局/u);
  assert.doesNotMatch(formatFortunePrompt(input), /亥卯未三合财局|sealLuckWealthAssemblies/u);
  const incomplete = submit('sealWealthAssembly', { verifyLuck: false });
  const missing = facts(incomplete).find(row => row.normalizedPayload.yearPillar === '庚辰');
  assert.equal(missing.normalizedPayload.sealLuckWealthAssemblyCandidate, undefined);
  assert.ok(!outcome(incomplete, 'seal').sourceFactIds.includes(missing.factId));
});

test('officer support follows the actual pillar and branch damage with a separate same-window blade branch', () => {
  const run = submit('officerDamage'), fact = solarYear(run)[0], data = fact.normalizedPayload;
  assert.equal(data.natalHurtPresent, true);
  assert.ok(data.natalOfficers.some(row => row.column === 'hour' && row.stem === '丙'));
  assert.deepEqual(data.supportedOfficers.map(row => [row.officer.column, row.officer.stem, row.branchSupport?.stem, row.monthSupport?.stem]),
    [['annual', '丙', '丁', undefined]]);
  assert.deepEqual(data.officerDamage.map(row => [row.kind, row.values, row.officerColumn]), [['六破', '卯午', 'annual'], ['六害', '丑午', 'annual']]);
  const [path] = data.hurtOfficerReview;
  assert.deepEqual([path.hurt.column, path.hurt.stem, path.hurt.placement], ['hour', '壬', 'other_hidden']);
  assert.deepEqual(path.nativeTargets.map(row => [row.column, row.stem]), [['hour', '丙']]);
  assert.deepEqual(path.arrivals.map(row => [row.officer.column, row.officer.stem, row.damage.map(item => item.officerColumn)]),
    [['annual', '丙', ['annual', 'annual']]]);
  assert.ok(path.arrivals[0].sealsFedByOfficer.some(row => row.column === 'month' && row.stem === '己' && row.placement === 'main_qi'));
  assert.ok(path.arrivals[0].sealsFedByOfficer.every(row => path.competingSeals.some(seal =>
    seal.column === row.column && seal.placement === row.placement && seal.stem === row.stem)));
  assert.equal(data.bladeKillerCandidate, false);
  const result = outcome(run, 'officer');
  assert.equal(result.status, 'partial');
  assert.ok(result.sourceFactIds.includes(fact.factId));
  assert.ok(fact.sourceFactIds.every(id => run.rawFacts.some(raw => raw.rawFactId === id)));
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'officer-relays')).input;
  assert.match(formatFortuneFactAudit(model), /这处印又克原局同一伤官/u);

  const blade = submit('officerBlade'), bladeData = solarYear(blade)[0].normalizedPayload;
  assert.equal(bladeData.officerDamageCandidate, false);
  assert.equal(bladeData.bladeKillerCandidate, true);
  assert.deepEqual(bladeData.movingBlades.map(row => [row.column, row.pillar]), [['decadal', '辛酉']]);
  assert.equal(bladeData.supportedOfficers[0].monthSupport.pillar, '丁巳');
  assert.ok(bladeData.hurtOfficerReview.every(row => row.arrivals.every(arrival =>
    arrival.movingKillers.every(killer => killer.column === 'annual' && killer.stem === '丙'))));
  assert.equal(outcome(blade, 'officer').status, 'partial');

  const weak = submit('unsupportedOfficer'), weakData = solarYear(weak)[0].normalizedPayload;
  assert.ok(weakData.natalHurtPresent && weakData.natalOfficerPresent);
  assert.deepEqual(weakData.officerArrivals.map(row => [row.column, row.pillar]), [['decadal', '己酉']]);
  assert.equal(weakData.officerSupportCandidate, false);
  assert.deepEqual(weakData.officerDamage, []);
  assert.equal(outcome(weak, 'officer').status, 'not_matched');
});

test('the seasonal officer branch confirms a verified yang blade together with a real moving killer in the same interval', () => {
  const cases = [[2028, '戊申', 'main_qi'], [2030, '庚戌', 'stem']];
  for (const [year, pillar, placement] of cases) {
    const run = submit('seasonalBladeKiller', undefined, year);
    validateFortuneFacts(run);
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === pillar && row.normalizedPayload.luckPillar === '辛卯');
    assert.ok(fact, pillar);
    const p = fact.normalizedPayload;
    assert.equal(p.hurtOfficerSeasonalBladeKillerConfirmed, true);
    const [witness] = p.hurtOfficerSeasonalBladeKiller;
    assert.deepEqual([witness.hurt.column, witness.hurt.stem, witness.officer.column, witness.officer.stem],
      ['hour', '丁', 'decadal', '辛']);
    assert.deepEqual(witness.blades, [{ column: 'decadal', pillar: '辛卯' }]);
    assert.ok(witness.killers.some(killer => killer.column === 'annual' && killer.stem === '庚' && killer.placement === placement));
    const isolated = { ...run, facts: [fact] };
    const hit = outcome(isolated, 'officer');
    assert.equal(hit.status, 'matched');
    const branches = hit.confirmedBranches ?? [{ sourceExcerpt: hit.matchedSourceExcerpt, windows: hit.windows }];
    assert.ok(branches.some(branch => branch.sourceExcerpt === '刃煞克身'
      && branch.windows.some(window => window.start === fact.activeFrom && window.endExclusive === fact.activeTo)));
    const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'blade-killer-real')).input;
    assert.match(formatFortuneFactAudit(input), /同段岁运阳刃与实际七杀克日干方向/u);
    assert.doesNotMatch(formatFortunePrompt(input), /同段岁运阳刃与实际七杀克日干方向|hurtOfficerSeasonalBladeKiller/u);
  }
  const other = submit('seasonalBladeKiller', undefined, 2029);
  const adjacent = facts(other).find(row => row.normalizedPayload.yearPillar === '己酉');
  assert.equal(adjacent.normalizedPayload.hurtOfficerSeasonalBladeKillerConfirmed, false);
  assert.ok(adjacent.normalizedPayload.movingBlades.some(row => row.pillar === '辛卯'));
  assert.ok(adjacent.normalizedPayload.killers.some(row => row.column === 'month' && row.stem === '庚'));
  const noLuck = submit('seasonalBladeKiller', { verifyLuck: false }, 2028);
  assert.ok(facts(noLuck).every(row => row.normalizedPayload.hurtOfficerSeasonalBladeKillerConfirmed !== true));
});

test('a natal-only killer does not satisfy the moving blade-and-killer alternative', () => {
  const run = submit('natalKillerOnly');
  const fact = facts(run).find(row => row.normalizedPayload.yearPillar === '壬寅' && row.normalizedPayload.luckPillar === '己未');
  const p = fact.normalizedPayload;
  assert.equal(p.officerSupportCandidate, true);
  assert.equal(p.officerDamageCandidate, false);
  assert.equal(p.bladeKillerCandidate, true);
  assert.deepEqual(p.killers.map(row => [row.column, row.stem]), [['month', '癸']]);
  assert.equal(p.hurtOfficerPathCandidate, false);
  assert.deepEqual(p.hurtOfficerReview, []);
  const hit = outcome(run, 'officer');
  assert.ok(!hit.sourceFactIds.includes(fact.factId));
  assert.ok(hit.windows.every(window => window.endExclusive <= fact.activeFrom || window.start >= fact.activeTo));
});

test('a printed monthly officer seat requires the same hidden stem to arrive and its pillar to take damage', () => {
  const run = submit('monthOfficerExposure');
  const [incoming, next] = ['庚寅', '辛卯'].map(pillar => facts(run).find(fact => fact.normalizedPayload.yearPillar === pillar));
  const result = outcome(run, 'officer');
  assert.equal(result.status, 'partial');
  assert.ok(result.sourceFactIds.includes(incoming.factId));
  assert.ok(!result.sourceFactIds.includes(next.factId));
  const data = incoming.normalizedPayload;
  assert.equal(data.luckPillar, '己未');
  const [support] = data.supportedOfficers;
  assert.deepEqual([support.officer.column, support.officer.stem, support.branchSupport, support.monthSupport],
    ['annual', '庚', undefined, undefined]);
  assert.deepEqual([support.sourceMonthOfficer.pillar, support.sourceMonthOfficer.stem, support.sourceMonthOfficer.placement],
    ['丁巳', '庚', 'other_hidden']);
  assert.ok(data.hurtOfficerReview.some(row => row.arrivals.some(arrival => arrival.sourceMonthOfficer?.stem === '庚'
    && arrival.damage.some(relation => relation.officerColumn === 'annual' && relation.members?.includes('month')))));
  assert.equal(next.normalizedPayload.hurtOfficerPathCandidate, false);
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'month-officer')).input;
  assert.ok(formatFortuneFactAudit(model).includes('来官与本命月柱丁巳的支非本气藏干庚为正官同干'));
  assert.ok(!formatFortunePrompt(model).includes('来官与本命月柱丁巳'));
});

test('peer wealth candidates begin at the actual stage boundary and require an archived luck direction', () => {
  const run = submit('peerBoundary'), windows = solarYear(run);
  const change = '2026-05-10T20:00:00.000Z';
  assert.deepEqual(windows.map(row => [row.normalizedPayload.luckPillar, row.normalizedPayload.luckPeerCandidate]), [['辛酉', false], ['壬戌', true]]);
  assert.equal(windows[0].activeTo, change);
  assert.equal(windows[1].activeFrom, change);
  assert.equal(windows[1].normalizedPayload.stageStart, change);
  assert.deepEqual(windows[1].normalizedPayload.luckPeers.map(row => [row.stem, row.placement]), [['戊', 'main_qi']]);
  const wealth = windows[1].normalizedPayload.peerWealthPaths.find(row => row.target.stem === '壬' && row.target.column === 'day');
  assert.deepEqual(wealth.hurtingSources.map(row => [row.column, row.stem]), [['hour', '庚']]);
  assert.deepEqual(wealth.peers.map(row => [row.column, row.stem]), [['decadal', '戊']]);
  assert.equal(windows[1].normalizedPayload.useVerified, false);
  const result = outcome(run, 'peer');
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: change, endExclusive: '2026-12-31T16:00:00.000Z' }]);
  assert.deepEqual(result.sourceFactIds, [windows[1].factId]);
  assert.equal(outcome(submit('peerBoundary', { verifyLuck: false }), 'peer').status, 'unknown');
});

test('a seasonal officer root must be on the same arriving pillar and supported by the natal month', () => {
  const run = submit('autumnOfficerRoot'), hit = outcome(run, 'officer');
  const prior = facts(run).findLast(fact => fact.normalizedPayload.yearPillar === '庚子');
  const current = facts(run).find(fact => fact.normalizedPayload.yearPillar === '辛丑');
  assert.ok(prior && current);
  assert.equal(prior.activeTo, current.activeFrom);
  assert.equal(prior.normalizedPayload.hurtOfficerPathCandidate, false);
  assert.equal(hit.status, 'partial');
  assert.ok(hit.sourceFactIds.includes(current.factId));
  assert.ok(facts(run).filter(fact => hit.sourceFactIds.includes(fact.factId)).every(fact =>
    fact.normalizedPayload.yearPillar === '辛丑' && fact.activeFrom >= current.activeFrom));
  const support = current.normalizedPayload.supportedOfficers.find(row => row.seasonalOfficerRoot);
  assert.ok(support);
  assert.equal(support.branchSupport, undefined);
  assert.equal(support.monthSupport, undefined);
  assert.equal(support.sourceMonthOfficer, undefined);
  assert.deepEqual([support.officer.column, support.officer.stem, support.officer.placement], ['annual', '辛', 'stem']);
  assert.deepEqual([support.seasonalOfficerRoot.pillar, support.seasonalOfficerRoot.stem, support.seasonalOfficerRoot.placement], ['辛丑', '辛', 'other_hidden']);
  assert.ok(current.normalizedPayload.hurtOfficerReview.some(row => row.arrivals.some(arrival =>
    arrival.seasonalOfficerRoot && arrival.damage.some(pair => pair.officerColumn === 'annual'))));

  const winter = submit('winterOfficerRoot');
  assert.ok(facts(winter).some(fact => fact.normalizedPayload.yearPillar === '辛丑'
    && fact.normalizedPayload.officerArrivals.some(row => row.column === 'annual' && row.stem === '辛')
    && !fact.normalizedPayload.supportedOfficers.some(row => row.seasonalOfficerRoot)));
  assert.equal(outcome(winter, 'officer').status, 'not_matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'seasonal-officer-root'));
  const phrase = /来官五行按卷二本命月令表为旺，同一来柱的支余气见同干官根/u;
  assert.match(formatFortuneFactAudit(input), phrase);
  assert.doesNotMatch(formatFortunePrompt(input), phrase);
});

test('p003 confirms a visibly arriving seasonal officer and actual damage on that same pillar', () => {
  for (const [year, ganZhi, rootKind, damageKind] of [
    [2021, '辛丑', 'other_hidden', '六破'],
    [2041, '辛酉', 'main_qi', '相刑'],
  ]) {
    const run = submit('visibleHurtOfficer', undefined, year);
    validateFortuneFacts(run);
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === ganZhi);
    const { normalizedPayload: p } = fact;
    assert.equal(p.hurtOfficerSeasonalDamage, true);
    const oldYear = facts(run).find(row => row.activeTo === fact.activeFrom);
    assert.ok(oldYear && !oldYear.normalizedPayload.hurtOfficerSeasonalDamage);
    const path = p.hurtOfficerReview.find(row => row.hurt.placement === 'stem');
    const arrival = path.arrivals.find(row => row.officer.placement === 'stem');
    assert.deepEqual([path.hurt.column, path.hurt.stem, arrival.officer.pillar], ['year', '丁', ganZhi]);
    assert.ok(arrival.damage.some(row => row.kind === damageKind && row.officerColumn === 'annual'));
    assert.ok(baziColumnRoles('annual', ganZhi, p.dayMaster).some(row => row.stem === '辛' && row.placement === rootKind));
    const hit = outcome(run, 'officer');
    assert.equal(hit.matchedSourceExcerpt, '官來乘旺再見刑衝破害');
    assert.ok(hit.sourceFactIds.includes(fact.factId));
    assert.ok(hit.windows.every(window => window.start >= fact.activeFrom));
    const oldFact = { ...fact, normalizedPayload: { ...p, hurtOfficerSeasonalDamage: undefined } };
    assert.equal(outcome({ ...run, facts: [oldFact] }, 'officer').status, 'partial');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'seasonal-damage'));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /官來乘旺再見刑衝破害/u);
    assert.doesNotMatch(prompt, /hurtOfficerSeasonalDamage|官柱所涉|徒流死亡/u);
  }
});

test('p003 verifies the printed Wu month injury against natal and arriving Xin with its own Lu', () => {
  const run = submit('namedWuHurtOfficer');
  validateFortuneFacts(run);
  const fact = facts(run).find(row => row.normalizedPayload.yearPillar === '辛酉'
    && row.normalizedPayload.luckPillar === '辛未');
  assert.ok(fact);
  const old = facts(run).find(row => row.activeTo === fact.activeFrom);
  assert.equal(fact.activeFrom, '1981-02-03T21:55:23.000Z');
  assert.equal(old.normalizedPayload.yearPillar, '庚申');
  assert.equal(old.normalizedPayload.hurtOfficerNamedWuXinYouDamage, false);
  assert.equal(fact.normalizedPayload.hurtOfficerSeasonalDamage, false);
  assert.equal(fact.normalizedPayload.hurtOfficerNamedWuXinYouDamage, true);
  const [path] = fact.normalizedPayload.hurtOfficerNamedWuXinYou;
  assert.deepEqual([path.hurt, path.natalOfficer, path.officer, path.ownRoot]
    .map(row => [row.column, row.pillar, row.stem, row.placement]),
    [['month', '庚午', '丁', 'main_qi'], ['hour', '辛未', '辛', 'stem'],
      ['annual', '辛酉', '辛', 'stem'], ['annual', '辛酉', '辛', 'main_qi']]);
  assert.deepEqual(path.damage, [{ kind: '六害', members: ['day', 'annual'], values: '戌酉', officerColumn: 'annual' }]);
  const hit = outcome(run, 'officer');
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '官來乘旺再見刑衝破害');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'named-wu-hurt-officer'));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /午月.*辛未时/u);
  assert.match(prompt, /来柱辛酉的辛透而酉本气同干/u);
  const auditOnly = /同一丁也克.*辛酉.*同柱官根实见/u;
  assert.match(formatFortuneFactAudit(input), auditOnly);
  assert.doesNotMatch(prompt, auditOnly);
  assert.doesNotMatch(prompt, /徒流死亡|hurtOfficerNamedWuXinYou/u);

  const counter = submit('wuHurtOfficerOtherHour');
  const counterFact = facts(counter).find(row => row.normalizedPayload.yearPillar === '辛酉');
  assert.ok(counterFact);
  assert.equal(counterFact.normalizedPayload.hurtOfficerNamedWuXinYouDamage, false);
  assert.equal(outcome(counter, 'officer').status, 'partial');
  const { input: counterInput } = buildFortuneModelContext(counter,
    interpretFortune(counter, requestForFortuneRun(counter), 'named-wu-hurt-officer-wrong-hour'));
  assert.doesNotMatch(formatFortunePrompt(counterInput), /午月.*辛未时/u);
});

test('an in-duty secondary month seal keeps the same seasonal officer pressure in review', () => {
  for (const [name, protectedByDuty] of [['officerWithDutySeal', true], ['officerAfterDutySeal', false]]) {
    const run = submit(name);
    validateFortuneFacts(run);
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === '丙寅' && row.normalizedPayload.luckPillar === '壬寅');
    assert.ok(fact, name);
    const p = fact.normalizedPayload;
    const path = p.hurtOfficerReview.find(({ hurt }) => hurt.column === 'year' && hurt.stem === '壬');
    assert.ok(path?.arrivals.some(({ officer, damage }) => officer.column === 'annual'
      && officer.stem === '丙' && damage.length > 0));
    assert.deepEqual(path.competingSeals.map(({ column, stem, placement }) => [column, stem, placement]),
      protectedByDuty ? [['month', '戊', 'other_hidden']] : []);
    assert.equal(p.hurtOfficerPathCandidate, true);
    assert.equal(p.hurtOfficerSeasonalDamage, !protectedByDuty);
    const isolated = { ...run, facts: [fact] }, hit = outcome(isolated, 'officer');
    assert.equal(hit.status, protectedByDuty ? 'partial' : 'matched');
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'officer-duty-source'));
    assert.equal(/官來乘旺再見刑衝破害/u.test(formatFortunePrompt(input)), !protectedByDuty);
  }
});

test('the remaining printed month-injury routes keep the original hour and the same incoming officer column', () => {
  for (const [name, caseId, selector, annual, hurt, nativePlacement, rootPlacement, damage] of [
    ['namedSiHurtOfficer', 'yi-si-geng-shen', 'hurtOfficerNamedYiSiGengShen', '庚申', '丙', 'main_qi', 'main_qi', '相刑'],
    ['namedWuHurtZiOfficer', 'bing-wu-gui-chou', 'hurtOfficerNamedBingWuGuiChou', '癸丑', '己', 'main_qi', 'other_hidden', '六害'],
    ['namedWuHurtExposedOfficer', 'bing-wu-gui-chou', 'hurtOfficerNamedBingWuGuiChou', '癸丑', '己', 'stem', 'other_hidden', '六害'],
  ]) {
    const run = submit(name);
    validateFortuneFacts(run);
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === annual);
    assert.ok(fact, name);
    const p = fact.normalizedPayload;
    assert.equal(p.luckStatus, 'confirmed', name);
    assert.equal(p[selector], true, name);
    const witness = p.hurtOfficerNamedHiddenMonthCases.find(row => row.caseId === caseId && row.officer.column === 'annual');
    assert.ok(witness, name);
    assert.deepEqual([witness.hurt.column, witness.hurt.stem, witness.natalOfficer.column, witness.natalOfficer.placement],
      ['month', hurt, 'hour', nativePlacement], name);
    assert.deepEqual([witness.officer.pillar, witness.officer.placement, witness.ownRoot.stem, witness.ownRoot.placement],
      [annual, 'stem', annual[0], rootPlacement], name);
    assert.ok(witness.damage.some(row => row.kind === damage && row.members.includes('month')
      && row.officerColumn === 'annual'), name);
    const hit = outcome(run, 'officer');
    assert.equal(hit.status, 'matched', name);
    const sourceExcerpt = hurt === '丙' ? '巳中丙火傷庚' : '午中巳土傷癸';
    assert.ok(hit.matchedSourceExcerpt.split('\n').includes(sourceExcerpt), name);
    assert.ok(hit.sourceFactIds.includes(fact.factId), name);
    assert.ok(hit.windows.some(window => window.start === fact.activeFrom), name);
    assert.ok(facts(run).some(row => row.activeTo === fact.activeFrom
      && row.normalizedPayload.yearPillar !== annual && row.normalizedPayload[selector] === false), name);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), name));
    const localPhrase = '同一' + hurt + '也克';
    assert.ok(formatFortuneFactAudit(input).includes(localPhrase), name);
    assert.ok(formatFortunePrompt(input).includes(sourceExcerpt), name);
    assert.doesNotMatch(formatFortunePrompt(input), /同一[丙己]也克|同柱官根实见|hurtOfficerNamedHiddenMonthCases/u);
  }
  for (const [name, annual, selector, status] of [
    ['siHurtOfficerOtherHour', '庚申', 'hurtOfficerNamedYiSiGengShen', 'partial'],
    ['wuHurtGuiOtherHour', '癸丑', 'hurtOfficerNamedBingWuGuiChou', 'not_matched'],
  ]) {
    const run = submit(name);
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === annual);
    assert.equal(fact.normalizedPayload[selector], false, name);
    assert.deepEqual(fact.normalizedPayload.hurtOfficerNamedHiddenMonthCases, [], name);
    assert.equal(outcome(run, 'officer').status, status, name);
  }
});

test('the printed Si-month earth seal shares the actual duty cut and preserves the competing officer path', () => {
  for (const [name, inDuty] of [['officerWithDutySeal', true], ['officerAfterDutySeal', false]]) {
    const run = submit(name, undefined, 1974);
    const yearRows = facts(run).filter(row => row.normalizedPayload.yearPillar === '甲寅');
    const [fact, next] = yearRows;
    assert.ok(fact && next, name);
    const p = fact.normalizedPayload;
    assert.equal(p.luckStatus, 'confirmed', name);
    assert.equal(p.sealSourceSiDutyEarthWealth, inDuty, name);
    const hit = outcome(run, 'seal');
    if (inDuty) {
      const [path] = p.sealSourceSiDutyEarthWealthPaths;
      assert.deepEqual([path.dutyDay, path.target.column, path.target.pillar, path.target.stem, path.target.placement],
        [7, 'month', '乙巳', '戊', 'other_hidden']);
      assert.ok(path.arrivingWealth.some(row => row.column === 'annual' && row.pillar === '甲寅' && row.stem === '甲'));
      assert.ok(path.feedingOfficers.some(row => row.column === 'month' && row.pillar === '乙巳' && row.stem === '丙'));
      assert.ok(!path.arrivingWealth.some(row => row.column === 'decadal'));
      assert.equal(next.activeFrom, '1974-08-22T02:00:00.000Z');
      assert.equal(fact.activeTo, next.activeFrom);
      assert.ok(next.normalizedPayload.sealSourceSiDutyEarthWealthPaths[0].arrivingWealth.some(row =>
        row.column === 'decadal' && row.pillar === '癸卯' && row.stem === '乙'));
      assert.equal(hit.status, 'matched');
      assert.ok(hit.sourceFactIds.includes(fact.factId));
      assert.ok(hit.sourceFactIds.includes(next.factId));
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), name));
      assert.match(formatFortuneFactAudit(input), /按巳月初段戊司事核实.*卯.*生这处戊印/u);
      assert.match(formatFortunePrompt(input), /歲運同論/u);
      assert.doesNotMatch(formatFortunePrompt(input), /按巳月初段戊司事核实|sealSourceSiDutyEarthWealthPaths/u);
    } else {
      assert.deepEqual(p.sealSourceSiDutyEarthWealthPaths, []);
      assert.ok(!hit.sourceFactIds.includes(fact.factId));
      assert.equal(next.normalizedPayload.sealSourceSiDutyEarthWealth, false);
    }
    assert.equal(p.sealSourceWealthLand, false, name);
    assert.equal(p.sealSourceAnnualWealthLand, false, name);
  }
});

test('the built-Lu source example and the natal peer counterweight record the actual incoming wealth', () => {
  const run = submit('builtLuNamedPressure'), hit = outcome(run, 'builtLu');
  const prior = facts(run).findLast(fact => fact.normalizedPayload.luckPillar === '癸卯');
  const current = facts(run).find(fact => fact.normalizedPayload.luckPillar === '壬寅');
  assert.ok(prior && current);
  assert.equal(current.activeFrom, '2015-11-23T08:00:00.000Z');
  assert.equal(prior.activeTo, current.activeFrom);
  assert.equal(prior.normalizedPayload.builtLuNamedWealthPressure, undefined);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '行壬寅運');
  assert.ok(hit.sourceFactIds.includes(current.factId));
  assert.deepEqual(hit.windows, [{ start: current.activeFrom, endExclusive: current.activeTo }]);
  assert.equal(current.normalizedPayload.builtLuNamedWealthPressureVerified, true);
  const witness = current.normalizedPayload.builtLuNamedWealthPressure;
  assert.deepEqual([witness.peer.column, witness.peer.stem, witness.wealth.column, witness.wealth.stem], ['hour', '戊', 'decadal', '壬']);
  assert.deepEqual(witness.punishment, { kind: '相刑', members: ['year', 'decadal'], values: '巳寅' });
  const sealPath = current.normalizedPayload.sealWealthPaths.find(row => row.target.stem === '丁');
  const comparison = sealPath.arrivingWealthWithNativePeers.find(row => row.wealth.pillar === '壬寅');
  assert.deepEqual(comparison.wealth, witness.wealth);
  assert.ok(comparison.peers.some(row => row.column === 'day' && row.stem === '己' && row.god === '比肩'));
  assert.ok(comparison.peers.every(row => row.column !== 'decadal' && row.god === '比肩'));

  const counter = submit('builtLuNamedOtherHour');
  assert.ok(facts(counter).some(fact => fact.normalizedPayload.luckPillar === '壬寅'
    && fact.normalizedPayload.builtLuNamedWealthPressure === undefined));
  assert.notEqual(outcome(counter, 'builtLu').status, 'matched');
  const otherYear = submit('builtLuNamedPressure', undefined, 2009);
  const jiChou = facts(otherYear).filter(row => row.normalizedPayload.yearPillar === '己丑');
  assert.ok(jiChou.length > 0);
  assert.ok(jiChou.every(row => row.normalizedPayload.luckPillar !== '壬寅'
    && row.normalizedPayload.builtLuNamedWealthPressureVerified === false));
  assert.notEqual(outcome(otherYear, 'builtLu').status, 'matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'named-built-lu'));
  const phrase = /建禄不富〉原图的壬寅运核实/u;
  assert.match(formatFortuneFactAudit(input), phrase);
  assert.match(formatFortuneFactAudit(input), /按〈论印绶〉的比肩例外/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /行壬寅運/u);
  assert.doesNotMatch(prompt, /建禄不富〉原图的壬寅运核实|builtLuNamedWealthPressureVerified/u);
});

test('the author’s cited woman can qualify without a natal root after the matching luck begins', () => {
  const run = submit('namedHurtingWealth');
  const windows = facts(run).filter(row => row.normalizedPayload.yearPillar === '乙丑');
  const change = '2045-12-22T08:00:00.000Z';
  assert.deepEqual(windows.map(({ normalizedPayload: p }) => [p.luckPillar, p.dayMasterRootCandidate, p.namedHurtingWealthUse]),
    [['己未', false, false], ['庚申', false, true]]);
  assert.equal(windows[0].activeTo, change);
  assert.equal(windows[1].activeFrom, change);
  const path = windows[1].normalizedPayload.peerWealthPaths.find(row => row.target.column === 'month' && row.target.stem === '乙');
  assert.deepEqual(path.hurtingSources.map(row => [row.column, row.stem, row.placement]), [['year', '癸', 'stem']]);
  assert.ok(path.peers.every(row => row.column === 'decadal' && row.stem === '庚'));
  const hit = outcome(run, 'peer');
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: change, endExclusive: '2045-12-31T16:00:00.000Z' }]);
  assert.deepEqual(hit.sourceFactIds, [windows[1].factId]);
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'named-hurting-wealth')).input;
  assert.match(formatFortuneFactAudit(model), /本命年柱癸未的天干癸为伤官生这处财/u);
  const finding = model.sections.find(section => section.id === 'wealth').findings
    .find(row => row.knowledgeId === hit.knowledgeId);
  assert.deepEqual(finding.windows, hit.windows);
  assert.match(finding.note, /若[^。]*伤官[^。]*财/u);

  const other = submit('unrelatedHurtingWealth');
  const counter = facts(other).find(row => row.normalizedPayload.luckPillar === '庚申').normalizedPayload;
  assert.equal(counter.hurtingPeerWealthCandidate, true);
  assert.equal(counter.dayMasterRootCandidate, false);
  assert.equal(counter.namedHurtingWealthUse, false);
  assert.equal(outcome(other, 'peer').status, 'not_matched');
  const samePillars = archive('namedHurtingWealth').bazi.rawResult[0];
  assert.equal(baziSmthSealHurting(samePillars, true, '乙丑', { status: 'confirmed', pillar: '庚申' }, true)
    .namedHurtingWealthUse, false);
  assert.equal(outcome(submit('namedHurtingWealth', { verifyLuck: false }), 'peer').status, 'unknown');
});

test('secondary month hurt only supplies the same natal wealth path when it matches the verified birth-month duty', () => {
  const active = submit('hurtingOnDuty'), hit = outcome(active, 'peer');
  assert.equal(hit.status, 'matched');
  const p = facts(active).find(row => hit.sourceFactIds.includes(row.factId) && row.normalizedPayload.yearPillar === '辛卯').normalizedPayload;
  assert.equal(p.luckPillar, '乙卯');
  assert.equal(p.monthHurtDutyDay, 4);
  const path = p.peerWealthPaths.find(row => row.target.column === 'year' && row.target.stem === '戊');
  assert.deepEqual(path.hurtingSources.map(row => [row.column, row.stem, row.placement]), [['month', '丁', 'other_hidden']]);
  assert.ok(path.peers.every(row => row.stem === '乙' && row.column === 'decadal'));
  assert.ok(p.peerOfficerControls.some(row => row.peer.stem === '乙'
    && row.officers.some(officer => officer.column === 'annual' && officer.stem === '辛')
    && row.targets.some(target => target.column === 'year' && target.stem === '戊')));
  const model = buildFortuneModelContext(active, interpretFortune(active, requestForFortuneRun(active), 'hurt-duty')).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /出生月交节后第4日，非本气伤官是人元司事首表的候选/u);
  assert.match(prompt, /本命月柱己未的支非本气藏干丁为伤官生这处财/u);
  assert.match(prompt, /该比劫实际所克的财位是本命年柱/u);
  assert.doesNotMatch(prompt, /monthHurtDutyDay|peerWealthPaths|hurtingPeerWealthCandidate/u);

  const inactive = submit('hurtingOutsideDuty');
  const absent = facts(inactive).find(row => row.normalizedPayload.yearPillar === '壬戌').normalizedPayload;
  assert.equal(absent.natalHurtExposedOrMonth, true);
  assert.equal(absent.luckPeerCandidate, true);
  assert.equal(absent.hurtingPeerWealthCandidate, undefined);
  assert.ok(absent.peerWealthPaths.every(row => row.hurtingSources.length === 0));
  assert.equal(outcome(inactive, 'peer').status, 'unknown');
});

test('Built-Lu uses an actual natal or decadal wealth target and rejects annual wealth by itself', () => {
  const run = submit('builtLuLuckWealth'), hit = outcome(run, 'builtLu');
  assert.equal(hit.status, 'partial');
  assert.equal(outcome(run, 'peer').status, 'not_matched');
  const p = facts(run).find(row => hit.sourceFactIds.includes(row.factId) && row.normalizedPayload.yearPillar === '庚子').normalizedPayload;
  assert.equal(p.builtLuMonth, true);
  assert.equal(p.luckPillar, '癸丑');
  assert.equal(p.natalWealthCandidate, false);
  assert.equal(p.peerWealthPaths.length, 1);
  assert.equal(p.peerWealthPaths[0].target.column, 'decadal');
  assert.equal(p.peerWealthPaths[0].target.stem, '癸');
  assert.deepEqual(p.peerWealthPaths[0].peers.map(row => [row.stem, row.placement]), [['己', 'main_qi']]);
  const restraint = p.peerOfficerControls.find(row => row.peer.stem === '己'
    && row.officers.some(officer => officer.column === 'hour' && officer.stem === '甲'));
  assert.deepEqual(restraint.targets, [p.peerWealthPaths[0].target]);
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'built-lu-luck-target')).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /月支与日干禄位相同/u);
  assert.match(prompt, /同段已核大运柱癸丑的支本气己为劫财克这处财/u);
  assert.match(prompt, /本命时柱甲寅的天干甲为七杀.+另克同段已核大运柱癸丑的支本气己为劫财/u);
  assert.match(prompt, /该比劫实际所克的财位是同段已核大运柱癸丑/u);
  assert.ok(model.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));

  const onlyYear = submit('builtLuOnlyAnnualWealth');
  const other = facts(onlyYear).find(row => row.normalizedPayload.yearPillar === '壬戌').normalizedPayload;
  assert.equal(other.builtLuMonth, true);
  assert.equal(other.annualWealthCandidate, true);
  assert.equal(other.luckPeerCandidate, true);
  assert.deepEqual(other.peerWealthPaths, []);
  assert.deepEqual(other.peerOfficerControls, []);
  assert.equal(outcome(onlyYear, 'builtLu').status, 'not_matched');
  assert.equal(outcome(submit('builtLuLuckWealth', { verifyLuck: false }), 'builtLu').status, 'unknown');
});

test('Built-Lu also admits the separate no natal wealth or officer branch on a confirmed companion luck', () => {
  const run = submit('builtLuWithoutWealthOfficer');
  const windows = facts(run).filter(row => row.normalizedPayload.yearPillar === '辛丑');
  const change = '2021-10-02T22:00:00.000Z';
  assert.deepEqual(windows.map(({ normalizedPayload: p }) => [p.luckPillar, p.builtLuMonth, p.builtLuNoWealthOfficerWithPeer]),
    [['甲辰', true, true], ['乙巳', true, true]]);
  assert.equal(windows[0].activeTo, change);
  assert.equal(windows[1].activeFrom, change);
  const p = windows[1].normalizedPayload;
  assert.equal(p.natalWealthCandidate, false);
  assert.equal(p.natalOfficerPresent, false);
  assert.deepEqual(p.peerWealthPaths, []);
  assert.deepEqual(p.luckPeers.map(row => [row.column, row.stem, row.placement, row.god]), [['decadal', '乙', 'stem', '比肩']]);
  assert.notEqual(p.builtLuPeerWealthCandidate, true);
  const hit = outcome(run, 'builtLu');
  assert.equal(hit.status, 'partial');
  assert.ok(hit.sourceFactIds.includes(windows[1].factId));
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'built-lu-without-support')).input;
  assert.match(formatFortuneFactAudit(model), /原局.{0,10}未见.{0,3}财.{0,5}官/u);
  assert.ok(model.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));

  const other = submit('builtLuWithHiddenKiller');
  const counter = facts(other).find(row => row.normalizedPayload.luckPillar === '乙巳').normalizedPayload;
  assert.equal(counter.builtLuMonth, true);
  assert.equal(counter.natalWealthCandidate, false);
  assert.ok(counter.killers.some(row => row.column === 'hour' && row.stem === '辛' && row.placement === 'main_qi'));
  assert.equal(counter.builtLuNoWealthOfficerWithPeer, false);
  assert.notEqual(outcome(other, 'builtLu').status, 'partial');
  assert.equal(outcome(submit('builtLuWithoutWealthOfficer', { verifyLuck: false }), 'builtLu').status, 'unknown');
});

test('Built-Lu admits actual robbery without a natal wealth or officer and excludes the changed hour with a killer', async () => {
  const run = submit('builtLuRobbery');
  const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '甲子');
  assert.ok(change);
  const before = facts(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '癸亥');
  const after = facts(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '甲子');
  assert.ok(before && after);
  const p = after.normalizedPayload;
  assert.equal(p.builtLuMonth, true);
  assert.equal(p.natalWealthCandidate, false);
  assert.equal(p.natalOfficerPresent, false);
  assert.deepEqual(p.killers.filter(row => row.column !== 'decadal' && row.column !== 'annual'), []);
  assert.deepEqual(p.luckPeers.map(row => [row.column, row.placement, row.stem, row.god]), [['decadal', 'stem', '甲', '劫财']]);
  assert.deepEqual(p.peerWealthPaths, []);
  assert.equal(p.builtLuPeerWealthCandidate, false);
  assert.equal(before.normalizedPayload.builtLuNoWealthOfficerWithPeer, false);
  assert.equal(p.builtLuNoWealthOfficerWithPeer, true);
  assert.equal(p.builtLuSourceNoWealthOrOfficer, false);
  assert.ok(p.killers.some(row => row.column === 'annual' && row.stem === '辛'));
  const hit = outcome(run, 'builtLu');
  assert.equal(hit.status, 'partial');
  assert.ok(hit.sourceFactIds.includes(after.factId) && !hit.sourceFactIds.includes(before.factId));
  assert.equal(hit.windows[0].start, change.exactInstant);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'built-lu-robbery'));
  assert.match(formatFortuneFactAudit(input), /原局透藏未见财、正官及七杀，同段大运见[^。\n]*甲为劫财/u);
  const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
    const message = JSON.parse(options.body).messages[1].content;
    assert.doesNotMatch(message, /原局透藏未见财、正官及七杀|builtLuNoWealthOfficerWithPeer/u);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(input);

  const other = submit('builtLuRobberyWithHiddenKiller');
  const excluded = facts(other).find(row => row.normalizedPayload.luckPillar === '甲子');
  assert.ok(excluded);
  assert.ok(excluded.normalizedPayload.killers.some(row => row.column === 'hour' && row.stem === '辛'));
  assert.equal(excluded.normalizedPayload.builtLuNoWealthOfficerWithPeer, false);
  assert.deepEqual(excluded.normalizedPayload.peerWealthPaths, []);
  assert.deepEqual(outcome(other, 'builtLu').sourceFactIds, []);

  const positive = submit('builtLuRobbery', undefined, 2067);
  const stage = facts(positive).find(row => row.normalizedPayload.yearPillar === '丁亥'
    && row.normalizedPayload.luckPillar === '甲子');
  assert.ok(stage);
  assert.equal(stage.normalizedPayload.builtLuSourceNoWealthOrOfficer, true);
  assert.deepEqual(stage.normalizedPayload.luckPeers.map(row => [row.stem, row.god]), [['甲', '劫财']]);
  const previousYear = facts(positive).find(row => row.activeTo === stage.activeFrom);
  assert.equal(previousYear.normalizedPayload.yearPillar, '丙戌');
  assert.equal(previousYear.normalizedPayload.builtLuSourceNoWealthOrOfficer, false);
  const confirmed = outcome(positive, 'builtLu');
  assert.equal(confirmed.status, 'matched');
  assert.equal(confirmed.matchedSourceExcerpt, '運再遇比刼');
  assert.equal(confirmed.windows[0].start, stage.activeFrom);
  assert.ok(confirmed.sourceFactIds.includes(stage.factId) && !confirmed.sourceFactIds.includes(previousYear.factId));
  assert.ok(confirmed.candidateWindows.some(row => row.endExclusive === stage.activeFrom));
  const { input: confirmedInput } = buildFortuneModelContext(positive,
    interpretFortune(positive, requestForFortuneRun(positive), 'built-lu-source-peer'));
  assert.match(formatFortuneFactAudit(confirmedInput), /按卷六建禄该支复核，同段岁柱与大运的透藏也均无财、正官和七杀/u);
  const finding = confirmedInput.sections.flatMap(section => section.findings).find(row => row.knowledgeId === confirmed.knowledgeId);
  assert.equal(finding.originalText, confirmed.matchedSourceExcerpt);
  assert.match(finding.conditions.join(''), /同段岁运的透藏均未见财星、正官或七杀/u);
  const confirmedProvider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
    const message = JSON.parse(options.body).messages[1].content;
    assert.match(message, /運再遇比刼/u);
    assert.doesNotMatch(message, /如人再有弟兄有分之人|按卷六建禄该支复核|builtLuSourceNoWealthOrOfficer/u);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await confirmedProvider.interpret(confirmedInput);
  const wrongHour = submit('builtLuRobberyWithHiddenKiller', undefined, 2067);
  assert.ok(facts(wrongHour).every(row => !row.normalizedPayload.builtLuSourceNoWealthOrOfficer));
  assert.notEqual(outcome(wrongHour, 'builtLu').status, 'matched');
});

test('generic natal and annual facts and distinct candidate subjects cannot replace the atomic evidence', () => {
  const run = submit('officerDamage');
  const without = { ...run, facts: run.facts.filter(fact => fact.factType !== factType) };
  assert.equal(outcome(without, 'officer').status, 'unknown');
  const split = structuredClone(run);
  for (const fact of facts(split)) fact.subjectIds[0] = 'bazi:candidate:other';
  assert.equal(outcome(split, 'officer').status, 'unknown');
});

test('model transport reserves incomplete sources for local audit and carries the conditional wealth rule', async () => {
  for (const [name, text] of [['annualSeal', /月令同干印的本命透出位置为本命时柱庚戌/u],
    ['officerDamage', /本命月柱与本段流年柱见丑午六害/u], ['peerBoundary', /同段已核大运柱壬戌的支本气戊为劫财/u]]) {
    const run = submit(name);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), name));
    const projected = input.facts.filter(fact => fact.type === factType);
    assert.ok(projected.length);
    const findings = input.sections.flatMap(section => section.findings);
    assert.ok(findings.every(finding => !['seal', 'officer', 'builtLu'].some(source => finding.knowledgeId === idFor(source))));
    assert.equal(findings.some(finding => finding.knowledgeId === idFor('peer')), name === 'peerBoundary');
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, text);
    assert.match(prompt, /月令取用、强弱和实际制化或救应仍待核定/u);
    assert.doesNotMatch(prompt, /monthSealCandidate|supportedOfficers|smth_seal_hurting_context|smth-fortune-fixture|官來乘旺再見刑衝破害|[{}\[\]]/u);
    if (name === 'peerBoundary') assert.deepEqual(projected.map(row => row.start), ['2026-05-10T20:00:00.000Z']);
    let called = false;
    const provider = createFortuneDeepSeek({ apiKey: 'test-key', transport: async (_url, options) => {
      called = true;
      const body = JSON.parse(options.body).messages[1].content;
      assert.equal(body, formatFortunePrompt(input));
      if (name === 'peerBoundary') assert.match(body, /现代释义：若[^\n]*伤官[^\n]*财/u);
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
    } });
    await provider.interpret(input);
    assert.equal(called, true);
  }
});
