import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Lunar, LunarYear, Solar } from 'lunar-javascript';
import { Body, HourAngle, Observer } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt, describeFortuneFact } from './control/fortune-prompt.mjs';
import { createFortuneDeepSeek } from './server/deepseek-expression.mjs';
const { baziDailyBranchContext, baziSourceContext, baziLuckTransitions, baziWorkTimingContext, firstDegreeTwist } = await import('./control/bazi-source-context.ts');
const { baziInteractions, describeBaZiStem } = await import('./control/bazi-calculation.ts');
const { smthFireAssemblyMonth, smthTaiSuiClashMonth } = await import('./control/bazi-smth-month-cases.ts');
const { fateClearBranchContext, fateClearJieMonth, fateClearMonthlyExample, repeatedMonthStemTheme } = await import('./control/bazi-fateclear.ts');
const { fateClearBaseBalance } = await import('./control/bazi-fateclear-balance.ts');
const { apparentSolarEpoch, fateClearSolarDays, fateClearSolarDayPolicy } = await import('./control/bazi-apparent-solar-time.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const legacyIndices = [1, 2, 4, 6, 7, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 38, 39, 40, 41];
function archive(gender = 1, y = 1990, m = 9, d = 29, hour = 12, minute = 0) {
  const lunar = Solar.fromYmdHms(y, m, d, hour, minute, 0).getLunar();
  const luckPeriods = lunar.getEightChar().getYun(gender, 2).getDaYun(11).slice(1)
    .map(stage => ({ ganZhi: stage.getGanZhi(), startAge: stage.getStartAge(), endAge: stage.getEndAge() }));
  return { timeKnown: true,
    bazi: { engineName: 'lunar-javascript', engineVersion: '1.7.8', rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1',
      rawResult: [{ utc: new Date(Date.UTC(y, m - 1, d, hour - 8, minute)).toISOString(),
        year: lunar.getYearInGanZhiExact(), month: lunar.getMonthInGanZhiExact(), day: lunar.getDayInGanZhiExact(),
        hour: lunar.getTimeInGanZhi(), luckPeriods, tenGods: {}, shenSha: {} }] },
    ziwei: { rawResult: [] }, western: { rawResult: [] } };
}
function calculate(chart, periodType, targetPeriod) {
  const params = { periodType, displayTimezone: 'Asia/Shanghai', targetPeriod };
  const time = buildFactTimeContext(params, Date.parse('2026-11-18T03:00:00Z'), 'server');
  return calculateFortuneFacts(params, time, 'legacy-context-run', { snapshotId: 'legacy-context-snapshot', chart });
}
function withLongitude(chart, longitude = 116.4) {
  return { ...chart, birthContext: { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc,
    latitude: 39.9, longitude, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' } };
}
function submit(chart, periodType, targetPeriod) {
  const params = { periodType, displayTimezone: 'Asia/Shanghai', targetPeriod };
  const now = Date.parse('2026-11-18T03:00:00Z'), reference = { snapshotId: 'fateclear-source-fixture' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...reference, chart })));
  return bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'fateclear-test-run', reference);
}
const matched = (run, index) => matchFortuneKnowledge(run).byMethod.bazi.find(row => row.knowledgeId === fortuneKnowledge.bazi.rules[index].knowledgeId);

test('the hour blade supports the source branch with depleted day qi and a concrete wealth target', async () => {
  const chart = archive(1, 1946, 9, 17, 6, 30);
  const natal = chart.bazi.rawResult[0];
  assert.deepEqual([natal.year, natal.month, natal.day, natal.hour], ['丙戌', '丁酉', '甲午', '丁卯']);

  const run = submit(chart, 'year', { year: 1958 });
  const boundary = '1958-02-04T07:49:11.000Z';
  const fact = run.facts.find(row => row.factType === 'smth_hour_blade' && row.activeFrom === boundary);
  assert.ok(fact);
  const p = fact.normalizedPayload;
  assert.deepEqual([p.year, p.luckPillar, p.verifiedAnnualCombineAndLuckContact], ['戊戌', '戊戌', 'six-combination']);
  assert.deepEqual([p.dayQiScreen.dayPhase, p.dayQiScreen.monthHiddenSupport], ['死', []]);
  assert.equal(p.verifiedDepletedDayBladeWithWealth, true);
  assert.deepEqual(p.depletedDayBladeWealthTargets.map(row => [row.column, row.pillar, row.stem, row.placement]),
    [['year', '丙戌', '戊', 'main_qi']]);
  const hit = matched(run, 20);
  assert.equal(hit.status, 'matched');
  assert.ok(hit.matchedSourceExcerpt.split('\n').includes('日干無氣時逄陽刃'));
  const branch = hit.confirmedBranches.find(row => row.conditions.some(line => line.includes('时卯藏乙确能克到')));
  assert.deepEqual(branch.windows, [{ start: boundary, endExclusive: fact.activeTo }]);
  assert.deepEqual(branch.sourceFactIds, [fact.factId]);

  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'depleted-day-hour-blade')).input;
  assert.match(formatFortuneFactAudit(model), /按卷五日干无气一段，日支为死.*本命年柱丙戌/u);
  const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
    const message = JSON.parse(options.body).messages[1].content;
    assert.match(message, /日干無氣時逄陽刃/u);
    assert.doesNotMatch(message, /depletedDayBladeWealthTargets|按卷五日干无气一段|陽刃不為㓙/u);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(model);

  const next = submit(chart, 'year', { year: 1959 });
  const withSeal = next.facts.find(row => row.factType === 'smth_hour_blade' && row.normalizedPayload.year === '己亥');
  assert.ok(withSeal);
  assert.equal(withSeal.normalizedPayload.luckPillar, '戊戌');
  assert.equal(withSeal.normalizedPayload.verifiedDepletedDayBladeWithWealth, false);
  assert.ok(!matched(next, 20).sourceFactIds.includes(withSeal.factId));
});

test('the hour-blade source reaches SQLite from a real Jia-Mao chart and repeats the same clash only in the actual luck stage', () => {
  const chart = archive(0, 1980, 2, 11, 6, 30);
  const target = { year: 2029 };
  const run = submit(chart, 'year', target);
  const result = matched(run, 20);
  const liChun = '2029-02-03T13:20:47.000Z';
  assert.equal(result.status, 'matched');
  assert.equal(result.matchedSourceExcerpt, '甲日生人');
  assert.deepEqual(result.windows, [{ start: liChun, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
  const fact = run.facts.find(row => row.factType === 'smth_hour_blade'
    && row.normalizedPayload.year === '己酉' && row.normalizedPayload.luckPillar === '癸酉');
  const p = fact.normalizedPayload;
  assert.ok(result.sourceFactIds.includes(fact.factId));
  assert.deepEqual([p.natalDay, p.publishedHour, p.actualHour, p.year], ['甲寅', '乙卯', '丁卯', '己酉']);
  assert.equal(p.yearClashesHourBlade, true);
  assert.equal(p.repeated, true);
  assert.equal(p.verifiedJiYouAndLuckContact, true);
  assert.deepEqual(p.luckContacts, [{ kind: '六冲', members: ['natal:hour', 'decadal'], values: '卯酉' }]);
  assert.deepEqual(p.heavenVirtue, [{ basis: 'stem', value: '丁', positions: ['natal:hour'] }]);
  assert.ok(p.dayRootPositions.includes('hour'));
  assert.equal(p.dayQiScreen.dayPhase, '临官');
  assert.equal(p.dayQiScreen.listedDepletedPhase, false);
  assert.equal(p.dayQiScreen.monthPillar, '戊寅');
  assert.equal(p.dayQiScreen.monthMainQi.stem, '甲');
  assert.deepEqual(p.dayQiScreen.monthHiddenSupport.map(row => [row.stem, row.tenGod]), [['甲', '比肩']]);
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'hour-blade-case')).input;
  assert.ok(model.sections.flatMap(section => section.findings).some(item => item.knowledgeId === result.knowledgeId));
  const provider = formatFortunePrompt(model);
  assert.match(provider, /甲日生人/u);
  assert.doesNotMatch(provider, /此是真刃|verifiedJiYouAndLuckContact|本命天德按实干查丁/u);
  const prompt = formatFortuneFactAudit(model);
  for (const phrase of ['本命时柱丁卯', '实岁己酉', '底本文字为乙卯', '本命天德按实干查丁']) assert.ok(prompt.includes(phrase), phrase);
  assert.equal(matched(submit({ ...chart, timeKnown: false }, 'year', target), 20).status, 'unknown');
  const forgedClock = structuredClone(chart);
  forgedClock.bazi.rawResult[0].hour = '乙卯';
  assert.equal(matched(submit(forgedClock, 'year', target), 20).status, 'unknown');
  chart.bazi.rawResult[0].luckPeriods = [];
  const unknownLuck = submit(chart, 'year', target);
  assert.equal(matched(unknownLuck, 20).status, 'partial');
  const unknown = unknownLuck.facts.find(row => row.factType === 'smth_hour_blade' && row.normalizedPayload.yearClashesHourBlade).normalizedPayload;
  assert.equal(unknown.luckStatus, 'unavailable');
  assert.equal(unknown.repeated, undefined);
  assert.equal(unknown.verifiedJiYouAndLuckContact, undefined);
});

test('the hour-blade source keeps the day virtues separate from Geng and from the ongoing annual and luck contacts', () => {
  const chart = archive(0, 1947, 8, 3, 6, 30), target = { year: 1969 };
  const run = submit(chart, 'year', target), cut = '1969-05-28T18:30:00.000Z';
  const rows = run.facts.filter(row => row.factType === 'smth_hour_blade' && row.normalizedPayload.year === '己酉');
  const before = rows.find(row => row.activeTo === cut && row.normalizedPayload.luckPillar === '己酉');
  const after = rows.find(row => row.activeFrom === cut && row.normalizedPayload.luckPillar === '庚戌');
  assert.ok(before && after);
  for (const fact of [before, after]) {
    const p = fact.normalizedPayload;
    assert.equal(p.verifiedJiYouAndLuckContact, true);
    assert.equal(p.verifiedUnopposedDayVirtuesWithHourBlade, fact === before);
    assert.deepEqual(p.dayVirtueWitness, {
      monthBranch: '未', dayPillar: '甲寅', hourPillar: '丁卯', stem: '甲', tabooStem: '庚', hourObstructions: [],
      tabooPillars: fact === before ? [] : [{ id: 'decadal', pillar: '庚戌' }],
    });
    const isolated = { ...run, facts: [fact] }, hit = matched(isolated, 20);
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    assert.match(hit.matchedSourceExcerpt, /甲日生人/u);
    assert.equal(/天月[德徳]/u.test(hit.matchedSourceExcerpt), fact === before);
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'hour-blade-virtues'));
    const audit = formatFortuneFactAudit(input);
    const clear = /未月天德、月德同临甲寅日，时柱未见所列克冲刑破，同段没有明庚/u;
    const obstructed = /未月二德临日的同段另见明庚：庚戌/u;
    assert.equal(clear.test(audit), fact === before);
    assert.equal(obstructed.test(audit), fact === after);
    const provider = formatFortunePrompt(input);
    assert.equal(/天月[德徳]/u.test(provider), fact === before);
    assert.doesNotMatch(provider, /同临甲寅日|二德临日的同段另见明庚|dayVirtueWitness|verifiedUnopposedDayVirtuesWithHourBlade/u);
  }
  const sameYear = matched(run, 20);
  const virtueBranch = sameYear.confirmedBranches.find(branch => branch.conditions.some(line => line.includes('天德、月德同为甲')));
  assert.deepEqual(virtueBranch.sourceFactIds, [before.factId]);
  assert.deepEqual(virtueBranch.windows, [{ start: before.activeFrom, endExclusive: cut }]);
  const missingLuck = structuredClone(chart);
  missingLuck.bazi.rawResult[0].luckPeriods = [];
  const unknown = submit(missingLuck, 'year', target).facts.find(row => row.factType === 'smth_hour_blade'
    && row.normalizedPayload.year === '己酉');
  assert.equal(unknown.normalizedPayload.dayVirtueWitness.stem, '甲');
  assert.equal(unknown.normalizedPayload.verifiedUnopposedDayVirtuesWithHourBlade, undefined);
  const broken = submit(archive(0, 1935, 7, 17, 6, 30), 'year', target);
  const brokenFact = broken.facts.find(row => row.factType === 'smth_hour_blade'
    && row.normalizedPayload.year === '己酉' && row.normalizedPayload.luckPillar === '丙戌');
  const brokenData = brokenFact.normalizedPayload;
  assert.equal(brokenData.verifiedJiYouAndLuckContact, true);
  assert.deepEqual(brokenData.dayVirtueWitness.tabooPillars, []);
  assert.deepEqual(brokenData.dayVirtueWitness.hourObstructions, ['六破']);
  assert.equal(brokenData.pardonDayObserved, true);
  assert.equal(brokenData.verifiedUnopposedDayVirtuesWithHourBlade, false);
  assert.doesNotMatch(matched(broken, 20).matchedSourceExcerpt, /天月[德徳]/u);
});

test('the hour-blade source confirms repetition only after the same complete annual and luck pillar arrives', () => {
  const chart = archive(1, 1983, 9, 13, 6, 30), year = { year: 2035 };
  const run = submit(chart, 'year', year);
  validateFortuneFacts(run);
  const boundary = '2035-04-07T18:30:00.000Z';
  const rows = run.facts.filter(row => row.factType === 'smth_hour_blade' && row.normalizedPayload.year === '乙卯');
  const before = rows.find(row => row.activeTo === boundary), after = rows.find(row => row.activeFrom === boundary);
  assert.ok(before && after);
  assert.deepEqual([before.normalizedPayload.luckPillar, after.normalizedPayload.luckPillar], ['丙辰', '乙卯']);
  assert.ok([before, after].every(({ normalizedPayload: p }) => p.yearRepeatsBlade && p.actualHour === '丁卯'));
  assert.equal(before.normalizedPayload.verifiedSamePillarBladeRepetition, false);
  assert.equal(after.normalizedPayload.verifiedSamePillarBladeRepetition, true);
  const match = matched(run, 20);
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.sourceFactIds, [after.factId]);
  assert.deepEqual(match.windows, [{ start: boundary, endExclusive: after.activeTo }]);
  assert.match(match.matchedSourceExcerpt, /再遇羊刃/u);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'hour-blade-pillar-repetition'));
  assert.match(formatFortuneFactAudit(input), /实岁与同段实运均为乙卯，按卷二记真刃岁运并临/u);
  assert.match(formatFortunePrompt(input), /同一乙卯或丁卯整柱/u);
  assert.doesNotMatch(formatFortunePrompt(input), /实岁与同段实运均为乙卯/u);
  assert.doesNotMatch(formatFortunePrompt(input), /verifiedSamePillarBladeRepetition|yearRepeatsBlade/u);
  const missingLuck = structuredClone(chart);
  missingLuck.bazi.rawResult[0].luckPeriods = [];
  assert.notEqual(matched(submit(missingLuck, 'year', year), 20).status, 'matched');
});

test('the hour-blade source confirms single annual and single luck contacts on their own effective segments', () => {
  for (const { chart, year, layer, from, pillar, excerpt, layerName } of [
    { chart: archive(1, 1972, 8, 11, 6, 30), year: 2029, layer: 'annual', from: '2029-02-03T13:20:47.000Z',
      pillar: '癸丑', excerpt: '歲沖合而運不沖合', layerName: '实际流年' },
    { chart: archive(1, 1970, 1, 14, 6, 30), year: 1992, layer: 'luck', from: '1992-10-06T08:30:00.000Z',
      pillar: '甲戌', excerpt: '運沖合而歲不沖合', layerName: '已核大运' },
  ]) {
    const run = submit(chart, 'year', { year });
    const match = matched(run, 20);
    const rows = run.facts.filter(row => row.factType === 'smth_hour_blade');
    const before = rows.find(row => row.activeTo === from);
    const after = rows.find(row => row.activeFrom === from);
    assert.equal(before.normalizedPayload.verifiedSingleLayerContact, 'none');
    assert.equal(after.normalizedPayload.verifiedSingleLayerContact, layer);
    assert.equal(after.normalizedPayload.luckPillar, pillar);
    assert.ok(after.normalizedPayload.natalContacts.length);
    assert.equal(match.status, 'matched');
    assert.deepEqual(match.windows, [{ start: from, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
    assert.deepEqual(match.sourceFactIds, [after.factId]);
    assert.equal(match.matchedSourceExcerpt, excerpt);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'hour-blade-single-contact'));
    assert.ok(formatFortuneFactAudit(input).includes('同段只有' + layerName + '再次触及时卯'));
    assert.ok(formatFortunePrompt(input).includes(excerpt));
    assert.doesNotMatch(formatFortunePrompt(input), /verifiedSingleLayerContact|岁层与运层均有/u);
  }
});

test('the hour-blade source distinguishes annual six-combination, half-combination and an actual full group', () => {
  const base = archive(0, 1980, 2, 11, 6, 30);
  for (const { year, pillar, chart = base, half, six, group, verified, begins } of [
    { year: 2027, pillar: '丁未', half: '卯未' },
    { year: 2030, pillar: '庚戌', six: '卯戌', verified: 'six-combination', begins: '2030-02-03T19:08:28.000Z' },
    { year: 2031, pillar: '辛亥', half: '亥卯' },
    { year: 2031, pillar: '辛亥', half: '亥卯', group: [['flow:year'], ['natal:hour'], ['natal:year']],
      verified: 'wood-group', begins: '2031-02-04T00:58:19.000Z', chart: archive(0, 1979, 5, 27, 6, 30) },
    { year: 2027, pillar: '丁未', half: '卯未', group: [['natal:year'], ['natal:hour'], ['flow:year']],
      verified: 'wood-group', begins: '2027-02-04T01:46:18.000Z', chart: archive(1, 1983, 2, 5, 6, 30) },
    { year: 2031, pillar: '辛亥', half: '亥卯', group: [['flow:year'], ['natal:hour'], ['decadal']],
      chart: archive(0, 1960, 2, 16, 6, 30) },
  ]) {
    const run = submit(chart, 'year', { year });
    validateFortuneFacts(run);
    const result = matched(run, 20);
    const fact = run.facts.find(row => row.factType === 'smth_hour_blade' && row.normalizedPayload.year === pillar
      && [...result.sourceFactIds, ...(result.candidateFactIds ?? [])].includes(row.factId));
    assert.ok(fact);
    const isolated = { ...run, facts: [fact] };
    const match = matched(isolated, 20);
    assert.equal(match.status, verified ? 'matched' : 'partial');
    if (verified) {
      assert.equal(match.matchedSourceExcerpt, '見亥未戌是合歳君');
      assert.deepEqual(match.windows, [{ start: begins, endExclusive: fact.activeTo }]);
      assert.ok(result.sourceFactIds.includes(fact.factId));
      const windows = result.confirmedBranches?.find(row => row.sourceFactIds.includes(fact.factId))?.windows ?? result.windows;
      assert.ok(windows.some(window => window.start <= begins && window.endExclusive >= fact.activeTo));
    }
    const p = fact.normalizedPayload;
    assert.equal(p.yearClashesHourBlade, false);
    assert.equal(p.yearHourBladeCombinationCandidate, true);
    assert.equal(p.yearSixCombination?.values, six);
    assert.equal(p.yearHalfWoodContact?.values, half);
    assert.deepEqual(p.yearWoodGroup, group);
    assert.equal(p.verifiedAnnualCombineAndLuckContact, verified);
    if (year === 2030) {
      const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'hour-blade-annual-combination'));
      const phrase = /实岁庚戌与该时支卯戌六合/u;
      assert.match(formatFortuneFactAudit(input), phrase);
      const prompt = formatFortunePrompt(input);
      assert.match(prompt, /見亥未戌是合歳君/u);
      assert.doesNotMatch(prompt, phrase);
    }
  }
  assert.equal(matched(submit(base, 'year', { year: 2026 }), 20).status, 'not_matched');
  const exception = submit(archive(0, 1979, 5, 17, 6, 30), 'year', { year: 2031 });
  assert.equal(matched(exception, 20).status, 'excluded');
});

test('the printed Jia-Shen exception is excluded and the other month and pardon readings remain distinct', () => {
  const target = { year: 2029 };
  const exception = submit(archive(0, 1980, 1, 12, 6, 30), 'year', target);
  const excluded = matched(exception, 20);
  assert.equal(excluded.status, 'excluded');
  assert.deepEqual(excluded.windows, []);
  const exceptionFact = exception.facts.find(row => row.factType === 'smth_hour_blade' && row.normalizedPayload.jiaShenException);
  assert.equal(exceptionFact.normalizedPayload.yearClashesHourBlade, true);
  assert.equal(exceptionFact.normalizedPayload.verifiedJiYouAndLuckContact, false);
  assert.deepEqual(exceptionFact.normalizedPayload.exceptionWealthPositions, ['natal:year']);
  const { exceptionStemPair, dayQiScreen } = exceptionFact.normalizedPayload;
  assert.deepEqual([exceptionStemPair.day, exceptionStemPair.hour].map(row => [row.position, row.pillar, row.stem, row.tenGod]),
    [['natal:day', '甲申', '庚', '七杀'], ['natal:hour', '丁卯', '乙', '劫财']]);
  assert.equal(exceptionStemPair.hourOutput.tenGod, '伤官');
  assert.equal(dayQiScreen.dayPhase, '绝');
  assert.equal(dayQiScreen.listedDepletedPhase, true);
  assert.equal(dayQiScreen.monthMainQi.stem, '己');
  assert.deepEqual(dayQiScreen.monthHiddenSupport.map(row => [row.stem, row.tenGod]), [['癸', '正印']]);
  assert.deepEqual(dayQiScreen.exposedSeals, []);
  assert.ok(dayQiScreen.hiddenSeals.some(row => row.position === 'natal:day' && row.stem === '壬'));
  const combined = submit(archive(0, 1980, 3, 22, 6, 30), 'year', target);
  const combinedFact = combined.facts.find(row => row.factType === 'smth_hour_blade'
    && row.normalizedPayload.year === '己酉' && row.normalizedPayload.luckPillar === '甲戌');
  const p = combinedFact.normalizedPayload;
  assert.equal(p.repeated, true);
  assert.equal(p.verifiedJiYouAndLuckContact, true);
  assert.equal(matched(combined, 20).status, 'matched');
  assert.equal(p.exceptionStemPair, undefined);
  assert.equal(p.dayQiScreen.dayPhase, '死');
  assert.equal(p.dayQiScreen.listedDepletedPhase, true);
  assert.equal(p.dayQiScreen.monthPhase, '帝旺');
  assert.deepEqual(p.dayQiScreen.monthHiddenSupport.map(row => [row.stem, row.tenGod]), [['乙', '劫财']]);
  assert.deepEqual(p.luckContacts, [{ kind: '六合', members: ['natal:hour', 'decadal'], values: '卯戌' }]);
  assert.deepEqual(p.heavenVirtue, [{ basis: 'yuanhai', value: '申', positions: ['natal:year'] },
    { basis: 'kaoyuan', value: '未', positions: [] }]);
  assert.equal(p.heavenTrigram, '坤');
  assert.deepEqual(p.moonVirtuePositions, ['natal:day']);
  assert.equal(p.pardonDayObserved, false);
  const summer = submit(archive(0, 1980, 5, 21, 6, 30), 'year', target);
  const hotMonth = summer.facts.find(row => row.factType === 'smth_hour_blade' && row.normalizedPayload.yearClashesHourBlade).normalizedPayload;
  assert.equal(hotMonth.pardonDay, '甲午');
  assert.equal(hotMonth.pardonDayObserved, true);
});

test('the hour-blade source distinguishes single luck wood contacts from a full wood group', () => {
  const target = { year: 2029 };
  for (const [chart, luck, values] of [
    [archive(0, 1960, 2, 16, 6, 30), '辛未', '卯未'],
    [archive(1, 1960, 4, 16, 6, 30), '丁亥', '亥卯'],
    [archive(1, 1960, 1, 17, 6, 30), '庚午', undefined],
  ]) {
    const run = submit(chart, 'year', target);
    const result = matched(run, 20);
    const fact = run.facts.find(row => row.factType === 'smth_hour_blade'
      && row.normalizedPayload.year === '己酉' && row.normalizedPayload.luckPillar === luck);
    assert.equal(result.status, 'partial', luck);
    assert.ok(result.sourceFactIds.includes(fact.factId), luck);
    const p = fact.normalizedPayload;
    assert.equal(p.yearClashesHourBlade, true, luck);
    assert.deepEqual(p.luckContacts, [], luck);
    assert.deepEqual(p.luckHalfWoodContact, values ? { kind: '半合', members: ['natal:hour', 'decadal'], values } : undefined, luck);
    assert.equal(p.luckWoodGroup, undefined, luck);
    assert.equal(p.repeated, Boolean(values), luck);
    assert.equal(p.verifiedJiYouAndLuckContact, false, luck);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'actual-hour-blade-half-combination'));
    const phrase = /当前运支与本命卯时构成(?:亥卯|卯未)半合/u;
    assert.equal(phrase.test(formatFortuneFactAudit(input)), Boolean(values), luck);
    assert.doesNotMatch(formatFortunePrompt(input), phrase, luck);
  }
});

test('historical calendar comparisons distinguish a compatible Jia-Wu reconstruction from the unverified day-virtue date', () => {
  for (const [birth, target, columns, luck, year, month] of [
    [[1529, 11, 10, 10], [1566, 6, 10, 12], ['己丑', '乙亥', '壬申', '乙巳'], '辛未', '丙寅', '甲午'],
    [[1460, 3, 13, 4], [1497, 5, 10, 12], ['庚辰', '己卯', '戊辰', '甲寅'], '癸未', '丁巳', '乙巳'],
  ]) {
    const native = Solar.fromYmdHms(...birth, 0, 0).getLunar();
    assert.deepEqual([native.getYearInGanZhiExact(), native.getMonthInGanZhiExact(), native.getDayInGanZhiExact(),
      native.getTimeInGanZhi()], columns);
    const visiting = Solar.fromYmdHms(...target, 0, 0).getLunar();
    assert.deepEqual([visiting.getYearInGanZhiExact(), visiting.getMonthInGanZhiExact()], [year, month]);
    const table = native.getEightChar().getYun(1, 2).getDaYun(8);
    const step = table.find(row => row.getStartYear() < target[0] && target[0] < row.getEndYear());
    assert.equal(step?.getGanZhi(), luck);
  }
});

test('the printed day-virtue columns admit two distinct pre-publication fourth-month replays', () => {
  for (const [birthYear, expected, recordedDays] of [
    [1520, ['1557-04-26 08:45:32', '1557-05-27 15:15:20', '1557-04-29 00:00:00', '1557-05-28 00:00:00'],
      // The Ming Veritable Records, volumes 446–447, explicitly give both new-moon days.
      [[4, 1, '甲申'], [5, 1, '癸丑']]],
    [1280, ['1317-04-28 07:28:59', '1317-05-29 15:05:16', '1317-05-12 00:00:00', '1317-06-10 00:00:00'],
      // The History of Yuan, volume 26, gives the third-month new moon. The two dated fourth-month events fall on days 2 and 3 in the replay.
      [[3, 1, '丁卯'], [4, 2, '戊戌'], [4, 3, '己亥']]],
  ]) {
    // Historical Solar labels follow the library's Julian calendar before 1582.
    const targetYear = birthYear + 37;
    for (const [month, day, dayPillar] of recordedDays) {
      assert.equal(Lunar.fromYmd(targetYear, month, day).getDayInGanZhi(), dayPillar);
    }
    const lunarStart = Lunar.fromYmd(targetYear, 4, 1).getSolar();
    const lunarEnd = lunarStart.next(LunarYear.fromYear(targetYear).getMonth(4).getDayCount());
    const { 立夏: jieStart, 芒种: jieEnd } = lunarStart.getLunar().getJieQiTable();
    assert.deepEqual([jieStart, jieEnd, lunarStart, lunarEnd].map(date => date.toYmdHms()), expected);
    const [jieFrom, jieTo, lunarFrom, lunarTo] = [jieStart, jieEnd, lunarStart, lunarEnd].map(date => date.getJulianDay());
    assert.ok(jieFrom < lunarFrom && lunarFrom < jieTo && jieTo < lunarTo);
    assert.deepEqual([jieStart, lunarStart].map(date => [date.getLunar().getYearInGanZhiExact(), date.getLunar().getMonthInGanZhiExact()]),
      [['丁巳', '乙巳'], ['丁巳', '乙巳']]);
    assert.equal(jieEnd.getLunar().getMonthInGanZhiExact(), '丙午');
    for (const [hour, minute, second] of [[3, 0, 0], [4, 59, 59]]) {
      const natal = Solar.fromYmdHms(birthYear, 2, 27, hour, minute, second).getLunar();
      assert.deepEqual([natal.getYearInGanZhiExact(), natal.getMonthInGanZhiExact(), natal.getDayInGanZhiExact(), natal.getTimeInGanZhi()],
        ['庚辰', '己卯', '戊辰', '甲寅']);
      const yun = natal.getEightChar().getYun(1, 2);
      const firstLuck = yun.getStartSolar();
      assert.equal(yun.getDaYun(4)[3].getGanZhi(), '壬午');
      assert.ok(firstLuck.nextYear(20).getJulianDay() <= jieFrom && lunarTo <= firstLuck.nextYear(30).getJulianDay());
    }
  }
});

test('the Tai-Sui clash case carries verified branch positions and a separate month fire meeting into SQLite', () => {
  const chart = archive(1, 2009, 11, 23, 10, 30);
  const target = { year: 2046, month: 6 };
  const run = submit(chart, 'month', target);
  const result = matched(run, 21);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.unresolvedConditions, []);
  assert.deepEqual(result.windows, [{ start: '2046-06-05T11:32:19.000Z', endExclusive: '2046-06-30T16:00:00.000Z' }]);
  const fact = run.facts.find(row => result.sourceFactIds.includes(row.factId));
  const p = fact.normalizedPayload;
  assert.equal(fact.factType, 'smth_tai_sui_clash_month');
  const { year, month, day, hour } = chart.bazi.rawResult[0];
  const natal = { year, month, day, hour };
  assert.deepEqual(natal, { year: '己丑', month: '乙亥', day: '壬申', hour: '乙巳' });
  assert.deepEqual([p.natalYear, p.luck, p.year, p.month], ['己丑', '辛未', '丙寅', '甲午']);
  assert.deepEqual(p.punishment, [['flow:year'], ['natal:hour'], ['natal:day']]);
  assert.equal(p.dayStemControlsYear, true);
  assert.equal(p.dayBranchControlsYear, true);
  assert.equal(p.luckYearStemCombine, true);
  assert.equal(p.yinHaiCombine, true);
  assert.deepEqual(p.woodMembers.map(row => row.pillar[1]), ['亥', '未']);
  assert.deepEqual(p.luckWoodOutput, { branch: '未', stem: '乙', tenGod: '伤官' });
  assert.deepEqual(p.fireMeeting, [['natal:hour'], ['flow:month'], ['decadal']]);
  assert.equal(p.monthMainQi, '丁');
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'tai-sui-clash-month')).input;
  assert.ok(model.sections.flatMap(section => section.findings).some(item => item.knowledgeId === result.knowledgeId));
  assert.match(formatFortuneFactAudit(model), /申本气庚金克寅本气甲木/u);
  const provider = formatFortunePrompt(model);
  assert.match(provider, /其年甲午月火旺戰尅/u);
  assert.match(provider, /实际运未藏乙为壬日伤官/u);
  assert.match(provider, /只用于可复算的同案版本对照/u);
  assert.doesNotMatch(provider, /故死非命|申本气庚金克寅本气甲木|matchesPublishedGeometry|luckWoodOutput/u);
  assert.equal(matched(submit(chart, 'month', { year: 2046, month: 5 }), 21).status, 'not_matched');
  const july = matched(submit(chart, 'month', { year: 2046, month: 7 }), 21);
  assert.equal(july.status, 'matched');
  assert.deepEqual(july.windows, [{ start: '2046-06-30T16:00:00.000Z', endExclusive: '2046-07-06T21:40:21.000Z' }]);
  assert.equal(result.windows[0].endExclusive, july.windows[0].start);
  assert.equal(matched(submit(archive(0, 2009, 11, 23, 10, 30), 'month', target), 21).status, 'not_matched');
  const luck = { pillar: p.luck, start: Date.parse(p.stageStart), end: Date.parse(p.stageEnd) };
  assert.equal(smthTaiSuiClashMonth({ ...natal, year: '乙丑' }, p.year, p.month, luck).matchesPublishedGeometry, false);
  const copiedReading = structuredClone(chart);
  copiedReading.bazi.rawResult[0].year = '乙丑';
  assert.equal(matched(submit(copiedReading, 'month', target), 21).status, 'unknown');
  const uncheckedLuck = structuredClone(chart);
  uncheckedLuck.bazi.rawResult[0].luckPeriods = [];
  const unknown = matched(submit(uncheckedLuck, 'month', target), 21);
  assert.equal(unknown.status, 'unknown');
  assert.deepEqual(unknown.sourceFactIds, []);
});

test('the fire assembly case requires all four published pillars and preserves water after the stem combination', () => {
  const chart = archive(1, 2003, 1, 17, 20, 30);
  const target = { year: 2054, month: 10 };
  const run = submit(chart, 'month', target);
  const result = matched(run, 22);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.unresolvedConditions, []);
  assert.deepEqual(result.windows, [{ start: '2054-10-08T01:22:19.000Z', endExclusive: '2054-10-31T16:00:00.000Z' }]);
  const november = matched(submit(chart, 'month', { year: 2054, month: 11 }), 22);
  const winterStart = Solar.fromYmd(2054, 11, 10).getLunar().getJieQiTable()['立冬'].toYmdHms().replace(' ', 'T');
  assert.equal(november.status, 'matched');
  assert.deepEqual(november.windows, [{ start: result.windows[0].endExclusive,
    endExclusive: new Date(winterStart + '+08:00').toISOString() }]);
  const fact = run.facts.find(row => result.sourceFactIds.includes(row.factId));
  const p = fact.normalizedPayload;
  assert.equal(fact.factType, 'smth_fire_assembly_month');
  assert.deepEqual([p.natalMonth, p.luck, p.year, p.month], ['癸丑', '戊午', '甲戌', '甲戌']);
  assert.deepEqual(p.natalFire, [['natal:day'], ['natal:year'], ['natal:hour']]);
  assert.deepEqual(p.withFlowsFire, [['natal:day'], ['natal:year', 'decadal'], ['natal:hour', 'flow:year', 'flow:month']]);
  assert.equal(p.wuGui, true);
  assert.deepEqual(p.waterStems, [{ id: 'natal:year', stem: '壬' }, { id: 'natal:month', stem: '癸' }]);
  assert.deepEqual(p.waterHiddenStems, [{ id: 'natal:month', branch: '丑', stem: '癸' }]);
  assert.equal(p.natalFireSeason, false);
  assert.equal(p.flowFireSeason, true);
  const sameBranches = archive(1, 2003, 1, 29, 20, 30);
  const { year, month, day, hour } = sameBranches.bazi.rawResult[0];
  assert.deepEqual([year, month, day, hour], ['壬午', '癸丑', '壬寅', '庚戌']);
  const sameBranchesRun = submit(sameBranches, 'month', target);
  assert.ok(sameBranchesRun.facts.some(row => row.factType === 'zpqz_moving_relations'
    && row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '戊午'));
  assert.equal(matched(sameBranchesRun, 22).status, 'not_matched');
  const otherHour = archive(1, 2003, 1, 17, 18, 30);
  assert.equal(matched(submit(otherHour, 'month', target), 22).status, 'not_matched');
  const noVerifiedLuck = structuredClone(chart);
  noVerifiedLuck.bazi.rawResult[0].luckPeriods = [];
  assert.equal(matched(submit(noVerifiedLuck, 'month', target), 22).status, 'unknown');
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'fire-assembly-month')).input;
  assert.ok(model.sections.flatMap(section => section.findings).some(item => item.knowledgeId === result.knowledgeId));
  assert.match(formatFortuneFactAudit(model), /运干戊与本命月干癸五合/u);
  assert.match(formatFortuneFactAudit(model), /支藏之水在本命月柱丑癸/u);
  const prompt = formatFortunePrompt(model);
  assert.match(prompt, /甲戌年甲戌月/u);
  assert.match(prompt, /卷三原作者按戊癸化火解释这组条件/u);
  assert.doesNotMatch(prompt, /支藏之水在本命月柱丑癸|遂遭火災|withFlowsFire/u);
});

test('the recorded Wan birth date and whole Xu hour reproduce the 1574 fire assembly month offline', () => {
  // Convert the library's historical Julian date labels before constructing a JavaScript timestamp.
  const epoch = solar => (Math.round((solar.getJulianDay() - 2440587.5) * 86400) - 8 * 3600) * 1000;
  const natal = lunar => ({ year: lunar.getYearInGanZhiExact(), month: lunar.getMonthInGanZhiExact(),
    day: lunar.getDayInGanZhiExact(), hour: lunar.getTimeInGanZhi() });
  const terms = Solar.fromYmd(1574, 10, 15).getLunar().getJieQiTable();
  const monthStart = epoch(terms['寒露']);
  const monthEnd = epoch(terms['立冬']);
  assert.equal(new Date(monthStart).toISOString(), '1574-10-08T19:03:41.000Z');
  assert.equal(new Date(monthEnd).toISOString(), '1574-11-07T19:17:17.000Z');

  const expectedNatal = { year: '壬午', month: '癸丑', day: '庚寅', hour: '丙戌' };
  const birthTime = Lunar.fromYmdHms(1522, 12, 18, 20, 0, 0);
  assert.equal(birthTime.getSolar().toYmd(), '1523-01-04');
  assert.equal(new Date(epoch(birthTime.getSolar())).toISOString(), '1523-01-14T12:00:00.000Z');
  const luckFor = birth => {
    const yun = birth.getEightChar().getYun(1, 2);
    const startSolar = yun.getStartSolar();
    return { pillar: yun.getDaYun(7)[5].getGanZhi(), start: epoch(startSolar.nextYear(40)), end: epoch(startSolar.nextYear(50)) };
  };
  for (let minute = 0; minute < 120; minute += 1) {
    const birth = Lunar.fromYmdHms(1522, 12, 18, 19 + Math.floor(minute / 60), minute % 60, 0);
    assert.deepEqual(natal(birth), expectedNatal);
    const luck = luckFor(birth);
    assert.equal(luck.pillar, '戊午');
    assert.ok(luck.start < monthStart && monthEnd < luck.end);
  }

  const luck = luckFor(birthTime);
  for (const [instant, expectedMonth, matches] of [
    [monthStart - 1000, '癸酉', false], [monthStart, '甲戌', true],
    [monthEnd - 1000, '甲戌', true], [monthEnd, '乙亥', false],
  ]) {
    const flow = natal(Solar.fromJulianDay(instant / 86400000 + 2440587.5 + 8 / 24).getLunar());
    assert.equal(flow.year, '甲戌');
    assert.equal(flow.month, expectedMonth);
    const fact = smthFireAssemblyMonth(natal(birthTime), flow.year, flow.month, luck);
    assert.equal(fact.matchesPublishedGeometry, matches);
    if (matches) {
      assert.equal(fact.wuGui, true);
      assert.deepEqual(fact.waterHiddenStems, [{ id: 'natal:month', branch: '丑', stem: '癸' }]);
    }
  }
  const nextHour = Lunar.fromYmdHms(1522, 12, 18, 21, 0, 0);
  assert.equal(natal(nextHour).hour, '丁亥');
  assert.equal(smthFireAssemblyMonth(natal(nextHour), '甲戌', '甲戌', luck).matchesPublishedGeometry, false);
  assert.equal(smthFireAssemblyMonth(natal(birthTime), '甲戌', '甲戌', { ...luck, pillar: '丁巳' }).matchesPublishedGeometry, false);
  assert.equal(smthFireAssemblyMonth(natal(birthTime), '甲戌', '甲戌').matchesPublishedGeometry, undefined);
});

test('the dragon-back case binds actual Jie month and separate natal and annual earth roles', () => {
  const chart = archive(1, 1949, 5, 2, 0, 30);
  const target = { year: 1988, month: 3 };
  const run = submit(chart, 'month', target);
  const result = matched(run, 23);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: '1988-03-05T08:46:32.000Z', endExclusive: '1988-03-31T16:00:00.000Z' }]);
  const p = run.facts.find(row => result.sourceFactIds.includes(row.factId)).normalizedPayload;
  assert.deepEqual(p.native.map(row => row.pillar), ['己丑', '戊辰', '壬辰', '庚子']);
  assert.deepEqual(p.earthStems.map(row => [row.id, row.stem, row.tenGod]), [
    ['natal:year', '己', '正官'], ['natal:month', '戊', '七杀'], ['flow:year', '戊', '七杀'],
  ]);
  assert.deepEqual(p.earthMainQi.map(row => [row.id, row.branch, row.stem]), [
    ['natal:year', '丑', '己'], ['natal:month', '辰', '戊'], ['natal:day', '辰', '戊'], ['flow:year', '辰', '戊'],
  ]);
  assert.deepEqual(p.natalWaterMembers, [{ id: 'natal:hour', pillar: '庚子' }]);
  assert.equal(p.monthTenGod, '伤官');
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'dragon-back-case')).input;
  const finding = model.sections.flatMap(section => section.findings).find(item => item.knowledgeId === result.knowledgeId);
  assert.ok(finding && formatFortunePrompt(model).includes(finding.note));
  assert.deepEqual(finding.windows, result.windows);
  assert.match(finding.note, /戊辰.*乙卯/u);
  assert.match(formatFortuneFactAudit(model), /流年柱戊为七杀/u);
  assert.equal(matched(submit({ ...chart, timeKnown: false }, 'month', target), 23).status, 'unknown');
  assert.equal(matched(submit(chart, 'month', { year: 1988, month: 2 }), 23).status, 'not_matched');
  const april = submit(chart, 'month', { year: 1988, month: 4 });
  const aprilMatch = matched(april, 23);
  const qingMing = '1988-04-04T13:39:04.000Z';
  assert.deepEqual(aprilMatch.windows, [{ start: result.windows[0].endExclusive, endExclusive: qingMing }]);
  assert.ok(april.facts.some(row => row.factType === 'smth_dragon_back_month' && row.activeFrom === qingMing
    && row.normalizedPayload.matchesPublishedGeometry === false));
  const genericOnly = { ...run, facts: run.facts.filter(row => row.factType !== 'smth_dragon_back_month') };
  assert.equal(matched(genericOnly, 23).status, 'unknown');
});

test('the day-virtue case checks the published age and both readings of the fourth month within the actual Ren-Wu stage', async () => {
  const chart = archive(1, 2000, 3, 11, 4, 30);
  const may = submit(chart, 'month', { year: 2037, month: 5 });
  const result = matched(may, 24);
  const candidates = run => run.facts.filter(row => row.factType === 'smth_day_virtue_month' && row.normalizedPayload.matchesPublishedGeometry)
    .map(row => [row.normalizedPayload.monthBasis, row.activeFrom, row.activeTo, row.normalizedPayload.month]);
  assert.equal(result.status, 'matched');
  assert.equal(result.matchedSourceExcerpt, '丁巳年寅巳相刑四月');
  assert.deepEqual(result.windows, [{ start: '2037-05-14T16:00:00.000Z', endExclusive: '2037-05-31T16:00:00.000Z' }]);
  assert.deepEqual(result.candidateWindows, [{ start: '2037-05-05T03:49:29.000Z', endExclusive: result.windows[0].start }]);
  assert.deepEqual(candidates(may), [
    ['jie-si-month', '2037-05-05T03:49:29.000Z', '2037-05-31T16:00:00.000Z', '乙巳'],
    ['regular-lunar-fourth', '2037-05-14T16:00:00.000Z', '2037-05-31T16:00:00.000Z', '乙巳'],
  ]);
  const fact = may.facts.find(row => result.sourceFactIds.includes(row.factId));
  const p = fact.normalizedPayload;
  assert.equal(p.monthBasis, 'regular-lunar-fourth');
  assert.equal(p.month, '乙巳');
  assert.deepEqual(p.dayVirtuePositions.map(row => row.pillar), ['庚辰', '戊辰', '甲寅']);
  assert.equal(p.luck, '壬午');
  assert.equal(p.bladeBranch, '午');
  assert.deepEqual(p.sourceLuckWealthBlade, {
    wealthStem: '壬', wealthGod: '偏财', bladeBranch: '午', bladePeerStem: '己', bladePeerGod: '劫财',
  });
  assert.equal(p.yearHourPunishment, true);
  assert.equal(p.yearStemControlsHour, true);
  assert.deepEqual(p.sourceAge, { civilYears: 37, civilClock: 'beijing', liChunOrdinal: 38, lunarOrdinal: 38 });
  assert.equal(p.sourceAge38, true);
  for (const [sourceAge38, status] of [[false, 'not_matched'], [undefined, 'unknown']]) {
    const facts = [{ ...fact, normalizedPayload: { ...p, sourceAge38 } }];
    assert.equal(matched({ ...may, facts }, 24).status, status);
  }

  const june = submit(chart, 'month', { year: 2037, month: 6 });
  assert.deepEqual(candidates(june), [
    ['jie-si-month', '2037-05-31T16:00:00.000Z', '2037-06-05T07:46:52.000Z', '乙巳'],
    ['regular-lunar-fourth', '2037-05-31T16:00:00.000Z', '2037-06-05T07:46:52.000Z', '乙巳'],
    ['regular-lunar-fourth', '2037-06-05T07:46:52.000Z', '2037-06-13T16:00:00.000Z', '丙午'],
  ]);
  const juneMatch = matched(june, 24);
  assert.equal(juneMatch.status, 'matched');
  assert.deepEqual(juneMatch.windows, [{ start: '2037-05-31T16:00:00.000Z', endExclusive: '2037-06-05T07:46:52.000Z' }]);
  assert.deepEqual(juneMatch.candidateWindows, [{ start: '2037-06-05T07:46:52.000Z', endExclusive: '2037-06-13T16:00:00.000Z' }]);
  assert.equal(matched(submit(chart, 'month', { year: 2037, month: 4 }), 24).status, 'unknown');
  const otherLuck = archive(0, 2000, 3, 11, 4, 30);
  assert.equal(matched(submit(otherLuck, 'month', { year: 2037, month: 5 }), 24).status, 'not_matched');
  const nextCycle = submit(chart, 'month', { year: 2097, month: 5 });
  const nextTime = nextCycle.facts.find(row => row.factType === 'smth_day_virtue_month').normalizedPayload;
  assert.deepEqual([nextTime.year, nextTime.month, nextTime.luck], ['丁巳', '乙巳', '戊子']);
  assert.deepEqual(nextTime.sourceAge, { civilYears: 97, civilClock: 'beijing', liChunOrdinal: 98, lunarOrdinal: 98 });
  assert.equal(nextTime.sourceAge38, false);
  assert.equal(nextTime.sourceLuckWealthBlade, undefined);
  assert.equal(matched(nextCycle, 24).status, 'not_matched');
  const model = buildFortuneModelContext(june, interpretFortune(june, requestForFortuneRun(june), 'day-virtue-case')).input;
  const finding = model.sections.flatMap(section => section.findings).find(item => item.knowledgeId === result.knowledgeId);
  assert.equal(finding.originalText, '丁巳年寅巳相刑四月');
  assert.deepEqual(finding.windows, juneMatch.windows);
  assert.match(finding.conditions.join(''), /同时在农历正四月和按节令划分的巳月内/u);
  const prompt = formatFortuneFactAudit(model);
  for (const phrase of ['节令巳月', '农历正四月', '戊日禄前刃位为午', '流年巳支与本命时支寅相刑', '两种年序都为三十八', '实满37周岁']) {
    assert.ok(prompt.includes(phrase), phrase);
  }
  const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
    const message = JSON.parse(options.body).messages[1].content;
    assert.match(message, /丁巳年寅巳相刑四月/u);
    assert.match(message, /壬午运干壬对戊日为偏财，午藏己为劫财/u);
    assert.doesNotMatch(message, /四月死|实满37周岁|sourceAge38|sourceLuckWealthBlade|月柱采用哪种月制/u);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(model);
});

test('Lu case 56 carries the full rootless archive and concurrent staged geometry through the client and SQLite', () => {
  const chart = archive(1, 1957, 2, 19, 4);
  const run = submit(chart, 'day', { date: '1997-09-02' });
  const match = matched(run, 41);
  assert.equal(match.status, 'matched');
  const expectedRange = { start: '1997-09-01T16:00:00.000Z', endExclusive: '1997-09-02T15:00:00.000Z' };
  assert.deepEqual(match.windows, [expectedRange]);
  const [fact] = run.facts.filter(row => match.sourceFactIds.includes(row.factId));
  const p = fact.normalizedPayload;
  assert.equal(fact.factType, 'lu_rootless_day_case');
  assert.deepEqual(p.natal.map(row => row.pillar), ['丁酉', '壬寅', '壬戌', '壬寅']);
  assert.deepEqual(p.moving.map(row => row.pillar), ['戊戌', '丁丑', '戊申', '丁未']);
  assert.deepEqual(p.renStemPositions, ['natal:month', 'natal:day', 'natal:hour']);
  assert.deepEqual(p.rootPositions, []);
  assert.equal(p.natal[0].mainQi.stem, '辛');
  assert.equal(p.moving.find(row => row.id === 'flow:month').holdsWater, true);
  assert.equal(p.stageStart, '1992-01-19T08:00:00.000Z');
  assert.equal(p.stageEnd, '2002-01-19T08:00:00.000Z');
  assert.equal(p.branchHalfStartsAt, '1997-01-19T08:00:00.000Z');
  assert.equal(p.sourceBranchHalf, true);
  assert.equal(matched({ ...run, facts: [{ ...fact, normalizedPayload: { ...p, sourceBranchHalf: false } }] }, 41).status, 'not_matched');
  assert.deepEqual(p.dingRen.map(row => row.members.find(id => id !== 'natal:day')), ['natal:year', 'flow:year', 'flow:day']);
  assert.deepEqual(p.yinShen.map(row => row.members.find(id => id !== 'flow:month')), ['natal:month', 'natal:hour']);
  assert.deepEqual(p.chouXuWei, [['flow:year'], ['natal:day', 'decadal'], ['flow:day']]);
  assert.deepEqual(p.archingColumns, [['natal:month', 'natal:day'], ['natal:day', 'natal:hour']]);
  const week = submit(chart, 'week', { weekStartDate: '1997-09-01' });
  const weekWitness = week.facts.find(row => row.factType === fact.factType && row.activeFrom === fact.activeFrom);
  assert.equal(weekWitness?.activeTo, fact.activeTo);
  assert.equal(matched(week, 41).status, 'not_applicable');
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'lu-rootless-geometry')).input;
  const finding = model.sections.flatMap(section => section.findings).find(item => item.knowledgeId === match.knowledgeId);
  assert.ok(finding && formatFortunePrompt(model).includes(finding.note));
  assert.deepEqual(finding.windows, match.windows);
  const prompt = formatFortuneFactAudit(model);
  for (const phrase of ['四支藏干均未见水根', '流月申支藏壬水', '丁壬合', '丑戌相刑', '酉戌六害', '寅申六冲', '寅戌夹午候选']) {
    assert.ok(prompt.includes(phrase), phrase);
  }
  const onlyGeneric = { ...run, facts: run.facts.filter(row => row.factType !== 'lu_rootless_day_case') };
  assert.equal(matched(onlyGeneric, 41).status, 'unknown');
});

test('Lu case 56 rejects the previous civil day, a different known hour, and unverified luck', () => {
  const chart = archive(1, 1957, 2, 19, 4);
  const target = { date: '1997-09-02' };
  const before = submit(chart, 'day', { date: '1997-09-01' });
  assert.ok(before.facts.some(fact => fact.factType === 'layer_pillar' && fact.scope === 'daily' && fact.normalizedPayload.pillar === '丁未'));
  assert.equal(matched(before, 41).status, 'unknown');
  const otherHour = archive(1, 1957, 2, 19, 6);
  assert.equal(matched(submit(otherHour, 'day', target), 41).status, 'not_matched');
  const withoutHour = submit({ ...chart, timeKnown: false }, 'day', target);
  assert.ok(!withoutHour.facts.some(fact => fact.factType === 'lu_rootless_day_case'));
  assert.equal(matched(withoutHour, 41).status, 'unknown');
  chart.bazi.rawResult[0].luckPeriods = [];
  const withoutLuck = submit(chart, 'day', target);
  assert.equal(matched(withoutLuck, 41).status, 'unknown');
  assert.ok(withoutLuck.facts.some(fact => fact.factType === 'lu_rootless_day_case'
    && fact.normalizedPayload.matchesPublishedGeometry === undefined));
});

test('the Lu month/day source reaches SQLite for the printed pair and both cycle seams at actual late-Zi boundaries', () => {
  const chart = archive(1, 1919, 7, 7, 20);
  for (const [date, month, day, stemStep, stemWrap, branchWrap] of [
    ['1996-08-16', '丙申', '乙酉', -1, false, false],
    ['1993-12-20', '甲子', '乙亥', 1, false, true],
    ['1997-03-13', '癸卯', '甲寅', 1, true, false],
  ]) {
    const run = submit(chart, 'day', { date });
    const result = matched(run, 39);
    assert.equal(result.status, 'matched', date);
    const [fact] = run.facts.filter(row => result.sourceFactIds.includes(row.factId));
    assert.deepEqual(fact.subjectIds, ['flow:month', 'flow:day']);
    assert.equal(fact.normalizedPayload.first, month);
    assert.equal(fact.normalizedPayload.second, day);
    assert.equal(fact.normalizedPayload.stemStep, stemStep);
    assert.equal(fact.normalizedPayload.branchStep, -stemStep);
    assert.equal(fact.normalizedPayload.stemWrap, stemWrap);
    assert.equal(fact.normalizedPayload.branchWrap, branchWrap);
    assert.deepEqual(result.windows, [{ start: run.time.displayWindow.instantRange.startInstant, endExclusive: date + 'T15:00:00.000Z' }]);
  }
});

test('Lu case 25 uses the recomputed archive, month, and both directed pairings with their actual concurrent branches', () => {
  const chart = archive(1, 1919, 7, 7, 20);
  const raw = chart.bazi.rawResult[0];
  assert.deepEqual([raw.year, raw.month, raw.day, raw.hour], ['己未', '庚午', '庚申', '丙戌']);
  const run = submit(chart, 'day', { date: '1991-11-01' });
  const result = matched(run, 40);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: '1991-10-31T16:00:00.000Z', endExclusive: '1991-11-01T15:00:00.000Z' }]);
  const fact = run.facts.find(row => result.sourceFactIds.includes(row.factId));
  const p = fact.normalizedPayload;
  assert.deepEqual([p.yearTwist.first, p.yearTwist.second, p.yearTwist.stemStep, p.yearTwist.branchStep], ['庚申', '辛未', 1, -1]);
  assert.deepEqual([p.dayTwist.first, p.dayTwist.second, p.dayTwist.stemStep, p.dayTwist.branchStep], ['丙戌', '乙亥', -1, 1]);
  assert.equal(p.month, '戊戌');
  assert.equal(p.luck, '癸亥');
  assert.equal(p.sourceDate, '1991-11-01');
  assert.equal(p.hasPublishedLuck, true);
  assert.ok(p.weiXu.some(row => row.members.includes('flow:year') && row.members.includes('natal:hour')));
  assert.ok(p.haiShen.some(row => row.members.includes('flow:day') && row.members.includes('natal:day')));
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'lu-published-geometry')).input;
  const finding = model.sections.flatMap(section => section.findings).find(item => item.knowledgeId === result.knowledgeId);
  assert.ok(finding && formatFortunePrompt(model).includes(finding.note));
  assert.deepEqual(finding.windows, result.windows);
  const prompt = formatFortuneFactAudit(model);
  for (const phrase of ['本命日柱庚申到流年辛未', '本命时柱丙戌到流日乙亥', '未戌相刑', '亥申六害']) assert.ok(prompt.includes(phrase), phrase);

  const wrongMonth = submit(chart, 'day', { date: '1991-09-02' });
  assert.ok(wrongMonth.facts.some(row => row.factType === 'layer_pillar' && row.scope === 'daily' && row.normalizedPayload.pillar === '乙亥'));
  assert.equal(matched(wrongMonth, 40).status, 'not_matched');
  const previousCivilDay = submit(chart, 'day', { date: '1991-10-31' });
  assert.ok(previousCivilDay.facts.some(row => row.factType === 'layer_pillar' && row.scope === 'daily' && row.normalizedPayload.pillar === '乙亥'));
  assert.equal(matched(previousCivilDay, 40).status, 'not_matched');
  assert.equal(matched(submit({ ...chart, timeKnown: false }, 'day', { date: '1991-11-01' }), 40).status, 'unknown');
  const wrongNatal = archive(1, 1919, 9, 5, 20);
  assert.equal(wrongNatal.bazi.rawResult[0].hour, '丙戌');
  assert.equal(matched(submit(wrongNatal, 'day', { date: '1991-11-01' }), 40).status, 'not_matched');
  const differentLuck = submit(archive(0, 1919, 7, 7, 20), 'day', { date: '1991-11-01' });
  assert.ok(differentLuck.facts.some(({ factType, normalizedPayload }) => factType === 'lu_annual_daily_twist'
    && normalizedPayload.matchesPublishedGeometry && normalizedPayload.hasPublishedLuck === false));
  assert.equal(matched(differentLuck, 40).status, 'not_matched');
  raw.luckPeriods = [];
  assert.equal(matched(submit(chart, 'day', { date: '1991-11-01' }), 40).status, 'unknown');
});

test('both Lu case replays are stable across the published birth hour without a historical minute', () => {
  const cases = [
    { index: 40, birth: [1919, 7, 7], hours: [[19, 0], [20, 59]], date: '1991-11-01' },
    { index: 41, birth: [1957, 2, 19], hours: [[3, 0], [4, 59]], date: '1997-09-02' },
  ];
  for (const { index, birth, hours, date } of cases) {
    const results = hours.map(hour => matched(submit(archive(1, ...birth, ...hour), 'day', { date }), index));
    assert.ok(results.every(result => result.status === 'matched'), date);
    assert.deepEqual(results[0].windows, results[1].windows, date);
  }
});

test('daily contacts retain each actual branch and pillar, including two relations on one pair', () => {
  const natal = { year: '甲寅', month: '庚申', day: '甲辰', hour: '癸巳' };
  const unknownHour = baziDailyBranchContext(natal, false, '壬申', '乙亥');
  const relationKeys = value => value.contacts.map(({ target, targetBranch, kind }) => [target, targetBranch, kind]);
  assert.deepEqual(relationKeys(unknownHour), [
    ['natal:year', '寅', '六冲'], ['natal:year', '寅', '相刑'], ['flow:month', '亥', '六害'],
  ]);
  const knownHour = baziDailyBranchContext(natal, true, '壬申', '乙亥');
  assert.ok(relationKeys(knownHour).some(([target, branch, kind]) => target === 'natal:hour' && branch === '巳' && kind === '六合'));
  assert.ok(knownHour.contacts.every(contact => contact.kind !== '六破'));
  const shared = baziInteractions([
    ...Object.entries(natal).map(([layer, pillar]) => ({ id: 'natal:' + layer, pillar })),
    { id: 'flow:year', pillar: '丙寅' }, { id: 'flow:month', pillar: '乙亥' }, { id: 'flow:day', pillar: '壬申' },
  ]);
  assert.ok(shared.pairs.some(({ kind, members }) => kind === '六冲' && members.includes('flow:year') && members.includes('flow:day')));
  assert.deepEqual(baziDailyBranchContext(natal, true, '壬申', '乙亥', shared), knownHour);
  assert.deepEqual(baziDailyBranchContext(natal, false, '壬申', '乙亥', shared), unknownHour);
  assert.deepEqual(knownHour.repeatedContacts, []);
  const differentPunishmentBranch = baziDailyBranchContext(natal, true, '壬申', '乙亥', undefined, '癸巳');
  assert.ok(baziInteractions([{ id: 'natal:year', pillar: natal.year }, { id: 'flow:year', pillar: '癸巳' }]).pairs
    .some(row => row.kind === '相刑'));
  assert.deepEqual(differentPunishmentBranch.repeatedContacts, []);
  const stemOnly = baziDailyBranchContext({ year: '戊寅', month: '丁巳', day: '甲申', hour: '庚午' }, false, '甲子', '己巳');
  assert.equal(stemOnly.hasBranchContact, undefined);
  assert.deepEqual(stemOnly.contacts, []);
});

test('daily client facts change month contacts at the actual solar term and reach SQLite as partial evidence', () => {
  const chart = archive(1, 1990, 1, 28);
  const run = submit(chart, 'day', { date: '2026-05-05' });
  const facts = run.facts.filter(fact => fact.factType === 'daily_branch_context');
  const solarTerm = '2026-05-05T11:48:44.000Z', lateZi = '2026-05-05T15:00:00.000Z';
  const before = facts.find(fact => fact.activeTo === solarTerm);
  const after = facts.find(fact => fact.activeFrom === solarTerm);
  assert.equal(before.normalizedPayload.dayPillar, '己卯');
  assert.equal(before.normalizedPayload.monthPillar, '壬辰');
  assert.deepEqual(before.normalizedPayload.contacts.map(({ target, targetBranch, kind }) => [target, targetBranch, kind]),
    [['flow:month', '辰', '六害']]);
  assert.equal(after.normalizedPayload.dayPillar, '己卯');
  assert.equal(after.normalizedPayload.monthPillar, '癸巳');
  assert.equal(after.normalizedPayload.hasBranchContact, false);
  assert.equal(after.activeTo, lateZi);
  assert.equal(facts.find(fact => fact.activeFrom === lateZi).normalizedPayload.dayPillar, '庚辰');
  const outcome = matched(run, 38);
  assert.equal(outcome.status, 'partial');
  assert.ok(outcome.sourceFactIds.includes(before.factId));
  assert.ok(!outcome.sourceFactIds.includes(after.factId));
  assert.equal(outcome.windows[0].endExclusive, solarTerm);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'daily-branches-report'));
  assert.ok(!input.sections.flatMap(section => section.findings).some(item => item.knowledgeId === outcome.knowledgeId));
  assert.match(formatFortuneFactAudit(input), /流日卯支与流月柱的辰支形成六害/u);
  const onlyGeneric = { ...run, facts: run.facts.filter(fact => fact.factType !== 'daily_branch_context') };
  assert.equal(matched(onlyGeneric, 38).status, 'unknown');
});

test('the daily branch can complete a real three-branch contact without borrowing the annual branch', () => {
  const target = { date: '2026-01-11' }, cutoff = '2026-01-11T15:00:00.000Z';
  const chart = archive(1, 1990, 1, 28);
  const run = submit(chart, 'day', target);
  const facts = run.facts.filter(row => row.factType === 'daily_branch_context');
  const before = facts.find(row => row.activeTo === cutoff), after = facts.find(row => row.activeFrom === cutoff);
  assert.equal(before.normalizedPayload.dayPillar, '乙酉');
  assert.deepEqual(before.normalizedPayload.contacts, []);
  assert.deepEqual(before.normalizedPayload.completedGroups, [{ kind: '三合', branches: '巳酉丑',
    positions: [['natal:year', 'natal:day'], ['flow:day'], ['natal:month', 'flow:month']] }]);
  assert.deepEqual(baziDailyBranchContext(chart.bazi.rawResult[0], false, '乙酉', '己丑').completedGroups, []);
  assert.deepEqual(after.normalizedPayload.completedGroups, []);
  assert.ok(['flow:month', 'natal:year', 'natal:day', 'natal:month'].every(id => before.subjectIds.includes(id)));
  assert.ok(matched(run, 38).sourceFactIds.includes(before.factId));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'daily-three-branches'));
  assert.match(formatFortuneFactAudit(input), /流日酉支补齐巳酉丑三合支位/u);
  assert.doesNotMatch(formatFortunePrompt(input), /流日酉支补齐巳酉丑|completedGroups/u);

  const other = submit(archive(1, 1985, 10, 12), 'day', target);
  const yearlyMember = other.facts.find(row => row.factType === 'daily_branch_context' && row.activeTo === cutoff);
  assert.deepEqual(yearlyMember.normalizedPayload.completedGroups, []);
  assert.ok(other.facts.some(row => row.factType === 'three_combinations' && row.activeTo === cutoff
    && row.normalizedPayload.kind === '三合' && row.normalizedPayload.values === '巳酉丑'
    && row.normalizedPayload.byBranch.some(ids => ids.length === 1 && ids[0] === 'flow:year')));

  const punishment = submit(chart, 'day', { date: '2026-02-15' });
  const groups = punishment.facts.find(row => row.factType === 'daily_branch_context' && row.normalizedPayload.dayPillar === '庚申')
    .normalizedPayload.completedGroups;
  assert.deepEqual(groups.find(group => group.kind === '三刑'), { kind: '三刑', branches: '寅巳申',
    positions: [['flow:month'], ['natal:year', 'natal:day'], ['flow:day']] });
});

test('daily contacts repeat actual longer layers only at the same natal column and with the same relation', () => {
  const run = submit(archive(1, 1990, 1, 28), 'day', { date: '2026-06-13' });
  const facts = run.facts.filter(fact => fact.factType === 'daily_branch_context');
  const lateZi = '2026-06-13T15:00:00.000Z';
  const before = facts.find(fact => fact.activeTo === lateZi);
  const after = facts.find(fact => fact.activeFrom === lateZi);
  const background = [{ layer: 'month', pillar: '甲午' }, { layer: 'year', pillar: '丙午' }];
  assert.equal(before.normalizedPayload.dayPillar, '戊午');
  assert.deepEqual(before.normalizedPayload.repeatedContacts, [
    { kind: '六害', target: 'natal:month', targetPillar: '丁丑', background },
    { kind: '相刑', target: 'natal:hour', targetPillar: '戊午', background },
  ]);
  assert.equal(after.normalizedPayload.dayPillar, '己未');
  assert.ok(after.normalizedPayload.contacts.length > 0);
  assert.deepEqual(after.normalizedPayload.repeatedContacts, []);
  assert.deepEqual(before.normalizedPayload.workRepeatedBranchWitnesses.map(({ kind, target }) => [kind, target]),
    [['六害', 'natal:month']]);
  assert.deepEqual(after.normalizedPayload.workRepeatedBranchWitnesses.map(({ kind, target }) => [kind, target]),
    [['六冲', 'natal:month'], ['相刑', 'natal:month']]);
  const outcome = matched(run, 38);
  assert.equal(outcome.status, 'matched');
  assert.ok([before, after].every(fact => outcome.sourceFactIds.includes(fact.factId)));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'daily-repeated-contacts'));
  const text = /甲午流月、丙午流年与流日同样对.+丁丑形成六害/u;
  assert.match(formatFortuneFactAudit(input), text);
  assert.doesNotMatch(formatFortunePrompt(input), text);
});

test('a verified major-luck repetition ends at the actual change and is excluded with an unconfirmed table', () => {
  const chart = archive(1, 1990, 1, 28);
  const target = { date: '2017-08-04' };
  const run = submit(chart, 'day', target);
  const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '甲戌');
  assert.equal(change.exactInstant, '2017-08-04T10:00:00.000Z');
  const facts = run.facts.filter(fact => fact.factType === 'daily_branch_context');
  const before = facts.find(fact => fact.activeTo === change.exactInstant);
  const after = facts.find(fact => fact.activeFrom === change.exactInstant);
  assert.equal(before.normalizedPayload.dayPillar, '癸亥');
  assert.deepEqual(after.normalizedPayload.contacts, before.normalizedPayload.contacts);
  const background = [{ layer: 'decadal', pillar: '乙亥' }];
  assert.deepEqual(before.normalizedPayload.repeatedContacts, [
    { kind: '六冲', target: 'natal:year', targetPillar: '己巳', background },
    { kind: '六冲', target: 'natal:day', targetPillar: '癸巳', background },
  ]);
  assert.deepEqual(after.normalizedPayload.repeatedContacts, []);
  assert.ok(before.subjectIds.includes('decadal'));
  assert.ok(!after.subjectIds.includes('decadal'));
  const outcome = matched(run, 38);
  assert.equal(outcome.status, 'partial');
  assert.ok([before, after].every(fact => outcome.sourceFactIds.includes(fact.factId)));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'daily-luck-repetition'));
  const repetition = /乙亥大运与流日同样对.+癸巳形成六冲/u;
  assert.match(formatFortuneFactAudit(input), repetition);
  assert.doesNotMatch(formatFortunePrompt(input), repetition);

  chart.bazi.rawResult[0].luckPeriods.pop();
  const unconfirmed = submit(chart, 'day', target);
  assert.ok(unconfirmed.facts.some(fact => fact.factType === 'luck_pillar' && fact.normalizedPayload.confirmed === false));
  const alternatives = unconfirmed.facts.filter(fact => fact.factType === 'daily_branch_context');
  assert.ok(alternatives.some(fact => fact.normalizedPayload.contacts.length > 0));
  assert.ok(alternatives.every(fact => !fact.subjectIds.includes('decadal')
    && fact.normalizedPayload.repeatedContacts.every(row => row.background.every(item => item.layer !== 'decadal'))));
});

test('atomic contexts bind real year/month/day and natal positions without leaking unknown hour or mixing flow layers', () => {
  const natal = { year: '甲子', month: '丁卯', day: '庚申', hour: '丙戌' };
  const result = baziSourceContext(natal, true, [{ layer: 'year', pillar: '辛未' }, { layer: 'month', pillar: '庚子' }, { layer: 'day', pillar: '乙亥' }]);
  assert.equal(result.natalDay, '庚申'); assert.equal(result.natalHour, '丙戌');
  assert.equal(result.yearTenGod, '劫财'); assert.equal(result.monthTenGod, '比肩'); assert.equal(result.dayTenGod, '正财');
  assert.ok(result.firstDegreeTwists.includes('year:natal:day'));
  assert.ok(result.firstDegreeTwists.includes('day:natal:hour'));
  assert.ok(result.relations.includes('day:natal:day:六害'));
  const unknown = baziSourceContext(natal, false, [{ layer: 'year', pillar: '辛未' }, { layer: 'day', pillar: '乙亥' }]);
  assert.equal(unknown.natalHour, undefined); assert.equal(unknown.monthAvailable, undefined);
  assert.ok(unknown.relations.every(token => !token.includes(':hour:')));
  assert.ok(!unknown.firstDegreeTwists.includes('day:natal:hour'));
  assert.throws(() => baziSourceContext(natal, true, [{ layer: 'day', pillar: '甲丑' }]));
  assert.throws(() => baziSourceContext(natal, true, [{ layer: 'day', pillar: '乙亥' }, { layer: 'day', pillar: '乙亥' }]));
});

test('first degree twists and stem/main-qi comparisons use cyclic coordinates and the actual hidden main qi', () => {
  assert.equal(firstDegreeTwist('庚申', '辛未'), true);
  assert.equal(firstDegreeTwist('丙戌', '乙亥'), true);
  assert.equal(firstDegreeTwist('癸丑', '甲子'), true);
  assert.equal(firstDegreeTwist('甲戌', '癸亥'), true);
  assert.equal(firstDegreeTwist('甲子', '乙丑'), false);
  assert.equal(firstDegreeTwist('甲子', '甲子'), false);
  const natal = { year: '甲子', month: '丁卯', day: '庚申', hour: '丙戌' };
  const result = baziSourceContext(natal, true, [{ layer: 'year', pillar: '壬子' }, { layer: 'month', pillar: '甲辰' }, { layer: 'day', pillar: '庚辰' }]);
  assert.equal(result.yearMonthSameStemElement, false); assert.equal(result.yearDaySameStemElement, false);
  assert.equal(result.dayStemMainQiSameElement, false);
  assert.equal(baziSourceContext(natal, true, [{ layer: 'day', pillar: '庚申' }]).dayStemMainQiSameElement, true);
});

function direction(from, to, forward = true, confirmed = true) {
  return { direction: forward ? 'forward' : 'backward', confirmed,
    stages: [{ index: 1, start: 0, end: 1000, pillar: { pillar: from } }, { index: 2, start: 1000, end: 2000, pillar: { pillar: to } }] };
}
test('source forward corners are exact adjacent changes, with independent reverse and Gui-to-Jia markers and half-open edges', () => {
  for (const [from, to] of [['己丑', '庚寅'], ['壬辰', '癸巳'], ['乙未', '丙申'], ['戊戌', '己亥']]) {
    const result = baziLuckTransitions({ start: 0, end: 2000 }, [direction(from, to)]);
    assert.equal(result.length, 1); assert.equal(result[0].forwardCorner, true); assert.equal(result[0].confirmed, true);
    assert.equal(result[0].sameSeason, false);
  }
  const reverse = baziLuckTransitions({ start: 1000, end: 2000 }, [direction('庚寅', '己丑', false)])[0];
  assert.equal(reverse.reverseCorner, true); assert.equal(reverse.forwardCorner, false);
  const wrap = baziLuckTransitions({ start: 1000, end: 2000 }, [direction('癸亥', '甲子')])[0];
  assert.equal(wrap.stemWrap, true); assert.equal(wrap.forwardCorner, false);
  assert.equal(wrap.sameSeason, true); assert.equal(wrap.fromSeason, '北');
  assert.deepEqual(baziLuckTransitions({ start: 0, end: 2000 }, [direction('甲戌', '癸亥')]), []);
  assert.deepEqual(baziLuckTransitions({ start: 0, end: 1000 }, [direction('己丑', '庚寅')]), []);
  assert.equal(baziLuckTransitions({ start: 1000, end: 1001 }, [direction('己丑', '庚寅')]).length, 1);
  for (const damage of [row => { row.stages[0].pillar = null; }, row => { row.stages[1].index = 3; },
    row => { row.stages[0].end = 999; }, row => { row.stages[1].pillar.pillar = '壬辰'; }, row => { row.direction = 'unknown'; }]) {
    const row = direction('己丑', '庚寅'); damage(row);
    assert.deepEqual(baziLuckTransitions({ start: 0, end: 2000 }, [row]), []);
  }
  assert.equal(baziLuckTransitions({ start: 0, end: 2000 }, [direction('己丑', '庚寅', true, false)])[0].confirmed, false);
  assert.ok(baziLuckTransitions({ start: 0, end: 2000 }, [direction('己丑', '庚寅'), direction('己丑', '庚寅')]).every(row => !row.confirmed));
});

test('legacy Bazi entries retain reviewed source predicates and distinguish complete conditions', () => {
  const library = fortuneKnowledge.bazi;
  assert.equal(library.rules.filter(rule => !rule.queries.length).length, 0);
  for (const index of legacyIndices) {
    const rule = library.rules[index], entry = library.entries.find(entry => entry.id === rule.knowledgeId);
    assert.ok(rule.queries.length > 0, entry.id);
    assert.equal(rule.unresolved.length === 0, [4, 11, 17, 21, 22, 23, 26, 29, 30, 33, 34, 35, 36, 39, 40, 41].includes(index), entry.id);
    assert.equal(rule.review.sourcePassageId, entry.source.passage_id);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
  }
  assert.match(library.rules[11].review.mappedConditions.join(), /一气相连/u);
  assert.match(library.rules[24].unresolved.join(), /农历正四月和节令巳月分别计算/u);
  assert.equal(library.rules[33].queries[0].where.clock, fateClearSolarDayPolicy);
  assert.match(library.rules[20].unresolved.join(), /五鼠遁/u);
  const jia = Solar.fromYmdHms(2026, 11, 26, 6, 0, 0).getLunar();
  assert.equal(jia.getDayInGanZhiExact()[0], '甲'); assert.equal(jia.getTimeInGanZhi(), '丁卯');
  assert.equal(library.rules[40].queries[0].where.matchesPublishedGeometry, true);
});

test('real archived forward and backward luck changes reach source queries at the precise instant; no nearby-year or unconfirmed shortcut', () => {
  const run = calculate(archive(), 'year', { year: 2033 }); validateFortuneFacts(run);
  const changes = run.facts.filter(fact => fact.factType === 'luck_transition');
  assert.equal(changes.length, 1); const change = changes[0];
  assert.equal(change.activeFrom, '2033-11-14T06:00:00.000Z'); assert.equal(change.exactInstant, change.activeFrom);
  assert.equal(Date.parse(change.activeTo) - Date.parse(change.activeFrom), 1000);
  assert.equal(change.normalizedPayload.fromPillar, '己丑'); assert.equal(change.normalizedPayload.toPillar, '庚寅');
  const result = matched(run, 11); assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: change.activeFrom, endExclusive: change.activeTo }]);
  assert.equal(matched(calculate(archive(), 'year', { year: 2034 }), 11).status, 'unknown');
  const bad = archive(); bad.bazi.rawResult[0].luckPeriods.pop();
  assert.equal(matched(calculate(bad, 'year', { year: 2033 }), 11).status, 'unknown');
  const backward = calculate(archive(0), 'year', { year: 2027 });
  assert.equal(backward.facts.find(fact => fact.factType === 'luck_transition').normalizedPayload.forwardCorner, false);
  assert.equal(matched(backward, 11).status, 'not_matched');
  const report = interpretFortune(run, requestForFortuneRun(run), 'transition-prompt');
  const { input } = buildFortuneModelContext(run, report), prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /大运从己丑切换到庚寅/u); assert.match(prompt, /2033-11-14 14:00:00/u);
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId);
  assert.deepEqual(finding.windows, result.windows);
  assert.equal(finding.originalText, '丑交寅辰交巳未交申戍交亥');
  for (const key of ['source_layer_context', 'forwardCorner', 'firstDegreeTwists', 'policyVersion', 'luckPeriods']) assert.ok(!prompt.includes(key), key);
});

test('a real corner with Gui-to-Jia matches while real same-direction seasonal continuity with Gui-to-Jia is excluded', () => {
  const corner = calculate(archive(1, 1980, 3, 15), 'year', { year: 2027 });
  const overlap = corner.facts.find(f => f.factType === 'luck_transition');
  assert.equal(overlap.activeFrom, '2027-01-10T08:00:00.000Z');
  assert.equal(overlap.normalizedPayload.stemWrap, true);
  assert.equal(overlap.normalizedPayload.sameSeason, false);
  assert.equal(matched(corner, 11).status, 'matched');
  assert.match(describeFortuneFact({ method: 'bazi', type: 'luck_transition', data: overlap.normalizedPayload }, String), /转角同时换甲/u);

  const continuous = calculate(archive(0, 1979, 5, 2), 'year', { year: 2030 });
  const stayed = continuous.facts.find(f => f.factType === 'luck_transition');
  assert.equal(stayed.normalizedPayload.stemWrap, true);
  assert.equal(stayed.normalizedPayload.sameSeason, true);
  assert.equal(matched(continuous, 11).status, 'not_matched');
  assert.match(describeFortuneFact({ method: 'bazi', type: 'luck_transition', data: stayed.normalizedPayload }, String), /西方一气相连/u);
});

const timingFactAt = (run, at) => run.facts.find(fact => fact.factType === 'work_timing_context' && fact.activeFrom <= at && at < fact.activeTo);
const timingMatch = (run, period) => matchFortuneKnowledge(run).byMethod.bazi.find(row => row.knowledgeId.endsWith(`adee-${period}-v1-work-p001-001`));

test('real monthly timing binds the same natal column across confirmed luck, year and Jie month', () => {
  const run = calculate(archive(), 'month', { year: 2027, month: 2 });
  const at = '2027-02-05T00:00:00.000Z', fact = timingFactAt(run, at);
  assert.deepEqual(fact.normalizedPayload.repeatedByMonth, ['hour']);
  const result = timingMatch(run, 'month');
  assert.equal(result.status, 'matched'); assert.ok(result.sourceFactIds.includes(fact.factId));
  assert.ok(fact.activeFrom.startsWith('2027-02-04'));
  assert.ok(fact.sourceFactIds.every(id => run.rawFacts.some(row => row.rawFactId === id)));
  const source = run.facts.filter(row => row.factType !== 'work_timing_context');
  assert.equal(timingMatch({ ...run, facts: source }, 'month').status, 'unknown');
  const unverified = archive(); unverified.bazi.rawResult[0].luckPeriods.pop();
  assert.equal(timingMatch(calculate(unverified, 'month', { year: 2027, month: 2 }), 'month').status, 'unknown');
  const mismatch = calculate(archive(), 'month', { year: 2027, month: 9 });
  const later = timingFactAt(mismatch, '2027-09-09T00:00:00.000Z');
  assert.ok(later.normalizedPayload.upperWorkTargets.length && later.normalizedPayload.evidence[2].contacts.length);
  assert.equal(later.normalizedPayload.monthlyCandidate, false);
  assert.ok(!timingMatch(mismatch, 'month').sourceFactIds.includes(later.factId));
  assert.equal(timingMatch({ ...mismatch, facts: [later] }, 'month').status, 'not_matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'work-month'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /这个流月再次触及本命时柱/u);
  const finding = input.sections.flatMap(section => section.findings).find(item => item.knowledgeId === result.knowledgeId);
  assert.ok(finding);
  assert.match(finding.note, /(?:如果|若).*工作.*(?:留意|关注|观察)/u);
  assert.deepEqual(finding.windows, result.windows);
  assert.ok(!/work_timing_context|repeatedByMonth|adee-work-timing/u.test(prompt));
});

test('daily contacts confirm a work branch only when the confirmed luck, year and month share its natal column', () => {
  const chart = archive();
  const run = submit(chart, 'day', { date: '2027-02-09' });
  validateFortuneFacts(run);
  const cut = '2027-02-09T15:00:00.000Z';
  const contacts = run.facts.filter(fact => fact.factType === 'daily_branch_context');
  const earlier = contacts.find(fact => fact.activeTo === cut);
  const later = contacts.find(fact => fact.activeFrom === cut);
  assert.deepEqual([earlier.normalizedPayload.dayPillar, later.normalizedPayload.dayPillar], ['己未', '庚申']);
  assert.ok(earlier.normalizedPayload.contacts.some(row => row.target === 'natal:year' && row.kind === '六合'));
  assert.deepEqual(earlier.normalizedPayload.workRepeatedBranchWitnesses.map(row => [row.target, row.kind]), [['natal:hour', '六合']]);
  assert.equal(earlier.normalizedPayload.workMonthBranchConfirmed, false);
  for (const id of ['decadal', 'flow:year', 'flow:month', 'natal:hour']) assert.ok(earlier.subjectIds.includes(id));
  assert.ok(later.normalizedPayload.contacts.some(row => row.target === 'flow:month'));
  assert.equal(later.normalizedPayload.workRepeatedBranchConfirmed, false);
  const hit = matched(run, 38);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: earlier.activeFrom, endExclusive: cut }]);
  assert.equal(matched({ ...run, facts: [later] }, 38).status, 'partial');
  const unrelated = submit(chart, 'day', { date: '2027-02-06' });
  const wrongColumn = unrelated.facts.find(row => row.factType === 'daily_branch_context' && row.normalizedPayload.dayPillar === '丙辰');
  assert.ok(wrongColumn.normalizedPayload.contacts.some(row => row.target === 'natal:day' && row.kind === '六合'));
  assert.equal(matched({ ...unrelated, facts: [wrongColumn] }, 38).status, 'partial');
  const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'work-daily-repeated')).input;
  assert.match(formatFortuneFactAudit(input), /岁运的工作线索、当令流月与流日都触及本命时柱丙午/u);
  const provider = formatFortunePrompt(input);
  assert.match(provider, /当令流月再次触及该柱/u);
  assert.doesNotMatch(provider, /本命时柱丙午|workRepeatedBranchWitnesses/u);
});

test('daily officer and month clashes only trigger with the confirmed upper officer background', async () => {
  const chart = archive(1, 1985, 10, 12);
  const cases = [
    ['2029-02-07', undefined, true, false, true, ['2029-02-06T16:00:00.000Z', '2029-02-07T15:00:00.000Z']],
    ['2029-02-09', '七杀', false, false, false, ['2029-02-09T15:00:00.000Z', '2029-02-09T16:00:00.000Z']],
    ['2029-02-10', '正官', false, false, true, ['2029-02-09T16:00:00.000Z', '2029-02-10T15:00:00.000Z']],
    ['2029-02-11', undefined, false, true, false],
  ];
  for (const [date, god, birthClash, flowClash, matches, window] of cases) {
    const run = submit(chart, 'day', { date }), at = date + 'T00:00:00.000Z', fact = timingFactAt(run, at);
    const p = fact.normalizedPayload;
    assert.deepEqual(p.upperOfficerTargets, ['month']);
    assert.ok(p.upperWorkTargets.includes('day'), 'the day column has food and wealth links, without an upper officer link');
    assert.deepEqual([p.dayOfficerGod, p.dayClashesBirthMonth, p.dayClashesFlowMonth], [god, birthClash, flowClash]);
    const branch = run.facts.find(row => row.factType === 'daily_branch_context' && row.activeFrom <= at && at < row.activeTo);
    const witness = branch.normalizedPayload.workMonthBranchWitness;
    assert.equal(Boolean(witness), birthClash);
    assert.equal(branch.normalizedPayload.workMonthBranchConfirmed, birthClash);
    const contactResult = matched({ ...run, facts: [branch] }, 38);
    assert.equal(contactResult.status === 'matched', birthClash);
    if (birthClash) {
      assert.deepEqual(witness, { ...branch.normalizedPayload.contacts.find(row => row.target === 'natal:month' && row.kind === '六冲'),
        annualPillar: p.evidence[1].pillar, luckPillar: p.evidence[0].pillar });
      assert.deepEqual([branch.activeFrom, branch.activeTo], window);
      assert.ok(branch.subjectIds.includes('flow:year') && branch.subjectIds.includes('decadal'));
      assert.deepEqual(contactResult.sourceFactIds, [branch.factId]);
      assert.deepEqual(contactResult.windows, [{ start: window[0], endExclusive: window[1] }]);
      assert.equal(contactResult.matchedSourceExcerpt, '碰到关键支位');
    }
    const result = timingMatch(run, 'day');
    assert.equal(result.sourceFactIds.includes(fact.factId), matches);
    assert.equal(timingMatch({ ...run, facts: [fact] }, 'day').status, matches ? 'matched' : 'not_matched');
    assert.deepEqual(result.windows, window ? [{ start: window[0], endExclusive: window[1] }] : []);
    if (matches) {
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'work-day'));
      const finding = input.sections.flatMap(section => section.findings).find(item => item.knowledgeId === result.knowledgeId);
      assert.ok(finding);
      assert.match(finding.note, /(?:如果|若).*工作.*(?:留意|关注|观察)/u);
      assert.deepEqual(finding.windows, result.windows);
      if (birthClash) {
        assert.match(formatFortuneFactAudit(input), /大运与流年的官杀线索同触本命月柱.*当天的观察点/u);
        assert.doesNotMatch(formatFortunePrompt(input), /当天的观察点|workMonthBranchWitness/u);
        const contactFinding = input.sections.flatMap(section => section.findings).find(item => item.knowledgeId === contactResult.knowledgeId);
        assert.equal(contactFinding.originalText, '碰到关键支位');
        assert.ok(contactFinding.confirmedBranches.some(candidate =>
          /若本次讨论工作.*日支.*六冲该月支/u.test(candidate.conditions.join(''))
          && candidate.windows.some(({ start, endExclusive }) => start === window[0] && endExclusive === window[1])));
        const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
          const message = JSON.parse(options.body).messages[1].content;
          assert.match(message, /若本次讨论工作.*六冲该月支/u);
          assert.doesNotMatch(message, /当天的观察点|workMonthBranchConfirmed|workMonthBranchWitness/u);
          return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
        } });
        await provider.interpret(input);
      }
    }
  }
  const officerAlone = calculate(archive(), 'day', { date: '2026-01-08' });
  const isolated = timingFactAt(officerAlone, '2026-01-08T00:00:00.000Z');
  assert.equal(isolated.normalizedPayload.dayOfficerGod, '正官');
  assert.deepEqual(isolated.normalizedPayload.upperOfficerTargets, []);
  assert.equal(timingMatch(officerAlone, 'day').status, 'not_matched');
  const wrongColumn = submit(chart, 'day', { date: '2030-07-08' });
  const mismatched = timingFactAt(wrongColumn, '2030-07-08T00:00:00.000Z').normalizedPayload;
  assert.equal(mismatched.dayClashesBirthMonth, true);
  assert.equal(mismatched.dayOfficer, false);
  assert.deepEqual(mismatched.upperOfficerTargets, ['year']);
  assert.equal(timingMatch(wrongColumn, 'day').status, 'not_matched');
  assert.notEqual(matched(wrongColumn, 38).status, 'matched');
  assert.ok(wrongColumn.facts.filter(row => row.factType === 'daily_branch_context')
    .every(row => row.normalizedPayload.workMonthBranchWitness === undefined));
  const unknownLuck = archive(1, 1985, 10, 12);
  unknownLuck.bazi.rawResult[0].luckPeriods.pop();
  const unverified = submit(unknownLuck, 'day', { date: '2029-02-07' });
  assert.notEqual(matched(unverified, 38).status, 'matched');
  assert.ok(unverified.facts.filter(row => row.factType === 'daily_branch_context')
    .every(row => row.normalizedPayload.workMonthBranchWitness === undefined));
  const natal = chart.bazi.rawResult[0];
  const flowMonthOnly = baziWorkTimingContext(natal, true, '辛巳', '己酉', '丙寅', '甲申');
  assert.equal(flowMonthOnly.dayClashesBirthMonth, false);
  assert.equal(flowMonthOnly.dayClashesFlowMonth, true);
  assert.equal(flowMonthOnly.dailyCandidate, true);
});

test('both published Jie-month readings require the actual archive and are complete only inside their exact source period', () => {
  const cases = [
    [archive(1, 1959, 11, 3, 1, 15), 29, 1972, 4, '1972-04-04T16:28:50.000Z', '癸酉', '壬子', '甲辰', '木'],
    [archive(0, 1979, 5, 17, 18, 45), 30, 1989, 2, '1989-02-03T20:27:09.000Z', '庚午', '己巳', '丙寅', '水'],
  ];
  for (const [chart, index, year, month, start, luck, annual, moving, useful] of cases) {
    const run = calculate(chart, 'month', { year, month }); validateFortuneFacts(run);
    const result = matched(run, index);
    assert.equal(result.status, 'matched');
    assert.equal(result.windows.length, 1); assert.equal(result.windows[0].start, start);
    for (const fact of run.facts.filter(fact => result.sourceFactIds.includes(fact.factId))) {
      assert.equal(fact.factType, 'fateclear_bazi_context');
      assert.equal(fact.normalizedPayload.exampleYear, annual); assert.equal(fact.normalizedPayload.movingPillar, moving);
      assert.equal(fact.normalizedPayload.exampleLuck, luck); assert.equal(fact.normalizedPayload.exampleReading.useful, useful);
      assert.equal(fact.normalizedPayload.monthlyUsefulnessBasis, 'legacy-published-civil-match');
      assert.ok(fact.sourceFactIds.every(id => run.rawFacts.some(raw => raw.rawFactId === id)));
    }
    assert.ok(run.facts.some(fact => fact.factType === 'fateclear_bazi_context' && fact.activeTo === start
      && fact.normalizedPayload.exampleVerified !== true));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'published-case'));
    const entry = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId);
    assert.deepEqual(entry.windows, result.windows);
    assert.match(formatFortuneFactAudit(input), new RegExp('原文对该例定为身[强弱]、用' + useful, 'u'));
  }

  const [original, index] = cases[0];
  const natal = original.bazi.rawResult[0], shifted = archive(1, 1959, 11, 3, 1, 30);
  const luck = { pillar: '癸酉', genderBasis: '男' };
  for (const layer of ['year', 'month', 'day', 'hour']) {
    assert.equal(fateClearMonthlyExample({ ...natal, [layer]: '甲子' }, true, '壬子', '甲辰', luck).exampleVerified, undefined);
    assert.equal(shifted.bazi.rawResult[0][layer], natal[layer]);
  }
  assert.equal(matched(calculate(shifted, 'month', { year: 1972, month: 4 }), index).status, 'not_matched');
  assert.equal(matched(calculate(archive(0, 1959, 11, 3, 1, 15), 'month', { year: 1972, month: 4 }), index).status, 'not_matched');
  const unverified = structuredClone(original); unverified.bazi.rawResult[0].luckPeriods.pop();
  assert.equal(matched(calculate(unverified, 'month', { year: 1972, month: 4 }), index).status, 'unknown');
});

test('monthly source readings check archived apparent solar time as well as the published civil birth and pillars', async () => {
  const cases = [
    [archive(1, 1959, 11, 3, 1, 15), { year: 1972, month: 4 }, '甲辰', 'monthUsefulYearOther', 26, 29],
    [archive(0, 1979, 5, 17, 18, 45), { year: 1989, month: 2 }, '丙寅', 'monthStemAdverse', 30, 30],
    [archive(1, 1973, 9, 24, 9, 45), { year: 1988, month: 10 }, '壬戌', 'monthStemAdverse', 27, undefined],
  ];
  for (const [chart, target, pillar, selector, index, namedIndex] of cases) {
    const exact = submit(withLongitude(chart), 'month', target);
    const moved = submit(withLongitude(chart, 121.5), 'month', target);
    const choose = run => run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === pillar);
    const accepted = choose(exact), rejected = choose(moved);
    assert.ok(accepted && rejected, pillar);
    assert.equal(accepted.activeFrom, rejected.activeFrom);
    assert.equal(accepted.activeTo, rejected.activeTo);
    assert.equal(accepted.normalizedPayload.archiveLuckConfirmed, true);
    assert.equal(rejected.normalizedPayload.archiveLuckConfirmed, true);
    assert.equal(accepted.normalizedPayload.monthlyUsefulnessBasis, 'published-natal-reading');
    assert.equal(accepted.normalizedPayload.publishedReadingVerified, true);
    assert.equal(accepted.normalizedPayload[selector], true);
    assert.ok(matched(exact, index).sourceFactIds.includes(accepted.factId));
    assert.equal(rejected.normalizedPayload[selector], undefined);
    assert.equal(rejected.normalizedPayload.publishedReadingVerified, undefined);
    assert.equal(rejected.normalizedPayload.sourceReading, undefined);
    assert.notEqual(rejected.normalizedPayload.monthlyUsefulnessBasis, 'published-natal-reading');
    const describe = fact => describeFortuneFact({ method: 'bazi', type: fact.factType, data: fact.normalizedPayload }, String);
    assert.match(describe(accepted), /本段喜忌依据已核为同一出生盘的作者公开原例/u);
    assert.doesNotMatch(describe(rejected), /本段喜忌依据已核为同一出生盘的作者公开原例/u);
    if (namedIndex !== undefined) {
      assert.equal(matched(exact, namedIndex).status, 'matched');
      assert.equal(matched(moved, namedIndex).status, 'not_matched');
      const layerOrder = matched(exact, 25);
      assert.equal(layerOrder.status, 'matched');
      assert.equal(layerOrder.matchedSourceExcerpt, '按節氣換月');
      const preceding = exact.facts.find(row => row.factType === 'fateclear_bazi_context' && row.activeTo === accepted.activeFrom);
      assert.ok(preceding);
      assert.notEqual(preceding.normalizedPayload.exampleVerified, true);
      assert.ok(layerOrder.sourceFactIds.includes(preceding.factId));
      assert.deepEqual(layerOrder.windows, [{ start: preceding.activeFrom, endExclusive: accepted.activeTo }]);
      assert.equal(layerOrder.candidateWindows, undefined);
      assert.equal(accepted.normalizedPayload.monthlyCalendarOnly, false);
      assert.equal(rejected.normalizedPayload.monthlyCalendarOnly, true);
      const movedOrder = matched(moved, 25);
      assert.equal(movedOrder.status, 'matched');
      assert.ok(movedOrder.sourceFactIds.includes(rejected.factId));
      assert.ok(movedOrder.matchedConditions.some(line => /只确认历法与层序/u.test(line)));
      const { input } = buildFortuneModelContext(exact, interpretFortune(exact, requestForFortuneRun(exact), 'monthly-layer-confirmation'));
      const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === layerOrder.knowledgeId);
      assert.deepEqual(finding.windows, layerOrder.windows);
      const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
        const message = JSON.parse(options.body).messages[1].content;
        assert.match(message, /按作者公开命例核对本命喜忌.*以整节气月中点计算的流月/u);
        assert.doesNotMatch(message, /monthlyLayerOrderVerified|candidateWindows|普通命盘只核基础扶抑候选/u);
        return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
      } });
      await provider.interpret(input);
    }
  }
});

test('a monthly clash to the natal year alone is rejected and a real day-branch clash starts at the Jie instant', () => {
  const before = calculate(archive(), 'month', { year: 2026, month: 12 });
  assert.ok(before.facts.some(f => f.factType === 'fateclear_bazi_context'
    && f.normalizedPayload.clashedColumns.includes('year') && !f.normalizedPayload.clashedColumns.includes('day')));
  assert.equal(matched(before, 28).status, 'not_matched');
  const noBasis = calculate(archive(), 'month', { year: 2026, month: 3 });
  assert.equal(matched(noBasis, 28).status, 'unknown');
  const during = calculate(withLongitude(archive()), 'month', { year: 2026, month: 3 }), result = matched(during, 28);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.windows, [{ start: '2026-03-05T13:59:00.000Z', endExclusive: '2026-03-31T16:00:00.000Z' }]);
  assert.ok(during.facts.filter(f => result.sourceFactIds.includes(f.factId)).every(f => {
    const p = f.normalizedPayload;
    return p.dayClashReviewed === true && p.clashedColumns.includes('day')
      && p.movingBranchDirection === 'aligns_with_balance'
      && p.clashes.find(target => target.id === 'day').branchDirection === 'opposes_balance';
  }));
});

test('monthly day clashes distinguish verified structure from published incoming roles and actual natal combinations', () => {
  const cases = [
    [withLongitude(archive(0, 1979, 5, 17, 18, 45)), { year: 1989, month: 2 }, '寅', '甲申', true, 'supportive', 'partial'],
    [withLongitude(archive(1, 1959, 11, 3, 1, 15)), { year: 1972, month: 7 }, '未', '己丑', false, 'adverse', 'matched'],
    [withLongitude(archive(0, 1979, 5, 17, 18, 46)), { year: 1989, month: 2 }, '寅', '甲申', true, undefined, 'partial'],
    [withLongitude(archive(0, 1979, 5, 17, 18, 45), 121.5), { year: 1989, month: 2 }, '寅', '甲申', true, undefined, 'partial'],
  ];
  for (const [chart, target, branch, natalDay, hasRelatedNatalSixCombination, publishedIncomingDirection, expectedStatus] of cases) {
    const run = submit(chart, 'month', target);
    const fact = run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingBranch === branch);
    assert.ok(fact);
    assert.equal(fact.normalizedPayload.monthDayClashGeometryVerified, true);
    const review = fact.normalizedPayload.monthDayClashReview;
    assert.equal(review.natalDay, natalDay);
    assert.equal(review.hasRelatedNatalSixCombination, hasRelatedNatalSixCombination);
    assert.equal(review.publishedIncomingDirection, publishedIncomingDirection);
    assert.deepEqual(review.relatedNatalTrines, []);
    assert.equal(fact.normalizedPayload.publishedMonthDayClashReviewed, publishedIncomingDirection ? true : undefined);
    assert.ok(fact.sourceFactIds.every(id => run.rawFacts.some(raw => raw.rawFactId === id)));
    const result = matched(run, 28);
    assert.equal(result.status, expectedStatus);
    assert.ok(result.sourceFactIds.includes(fact.factId));
  }

  const chart = withLongitude(archive());
  delete chart.bazi.rawResult[0].luckPeriods;
  const run = submit(chart, 'month', { year: 2026, month: 3 });
  const fact = run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.clashedColumns.includes('day'));
  assert.equal(fact.normalizedPayload.monthDayClashGeometryVerified, true);
  assert.equal(fact.normalizedPayload.monthDayClashReview.publishedIncomingDirection, undefined);
  assert.equal(fact.normalizedPayload.publishedMonthDayClashReviewed, undefined);
  assert.equal(fact.normalizedPayload.dayClashReviewed, undefined);
  const result = matched(run, 28);
  assert.equal(result.status, 'partial');
  assert.ok(result.sourceFactIds.includes(fact.factId));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'monthly-day-clash-geometry'));
  assert.ok(input.sections.every(section => section.findings.every(finding => finding.knowledgeId !== result.knowledgeId)));
});

test('monthly day clash confirms the same-seat published adjacent combination and keeps a clashed partner conditional', () => {
  const positive = withLongitude(archive(0, 1973, 6, 13, 18, 30));
  const movedClock = withLongitude(archive(0, 1973, 6, 13, 18, 31));
  for (const [chart, year, expected] of [[positive, 1996, 'matched'], [positive, 1999, 'partial'], [movedClock, 1996, 'partial']]) {
    const run = submit(chart, 'month', { year, month: 10 });
    const fact = run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingBranch === '戌');
    assert.ok(fact);
    const p = fact.normalizedPayload;
    assert.equal(p.jieMonth.startTerm, '寒露');
    assert.equal(p.monthlyLayerOrderVerified, true);
    assert.equal(p.monthDayClashReview.natalDay, '庚辰');
    assert.equal(p.monthDayClashReview.hasRelatedNatalSixCombination, true);
    const partner = p.clashes.find(target => target.id === 'day').natalCombinations[0];
    assert.deepEqual(partner.members, ['day', 'hour']);
    assert.equal(partner.partner, 'hour');
    if (year === 1999) assert.deepEqual(partner.upperOppositions.filter(period => period.layer === 'annual').map(({ layer, pillar }) => ({ layer, pillar })),
      [{ layer: 'annual', pillar: '己卯' }]);
    const result = matched(run, 28);
    assert.equal(result.status, expected);
    assert.equal(p.publishedMonthDayClashAdjacentCombination, expected === 'matched' ? true : undefined);
    if (expected !== 'matched') continue;
    assert.equal(p.monthDayClashReview.publishedIncomingDirection, 'adverse');
    assert.equal(p.monthDayClashReview.publishedAdjacentCombination.dayDirection, 'adverse');
    assert.equal(p.monthDayClashReview.publishedAdjacentCombination.partnerDirection, 'adverse');
    assert.deepEqual(result.windows, [{ start: new Date(p.jieMonth.start).toISOString(),
      endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'monthly-combination-review'));
    assert.match(formatFortuneFactAudit(input), /受冲日支与原局相邻时支辰酉六合/u);
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /同一日支与原局相邻一支六合/u);
    assert.doesNotMatch(prompt, /publishedAdjacentCombination|庚辰|辰酉/u);
  }
});

test('a published day clash keeps the same natal trine and excludes the stages with upper opposition', () => {
  const date = [1, 1978, 7, 23, 5];
  for (const [year, minute, expected] of [[2043, 15, 'matched'], [2028, 15, 'partial'], [2043, 16, 'partial']]) {
    const run = submit(withLongitude(archive(...date, minute)), 'month', { year, month: 4 });
    const afterJie = run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingBranch === '辰');
    assert.ok(afterJie);
    const { jieMonth, monthlyLayerOrderVerified, monthDayClashReview: review, publishedMonthDayClashNatalTrine: reviewed } = afterJie.normalizedPayload;
    assert.equal(monthlyLayerOrderVerified, true);
    assert.equal(jieMonth.startTerm, '清明');
    assert.equal(review.natalDay, '丙戌');
    assert.deepEqual(review.relatedNatalTrines, [{ branches: '寅午戌', positions: [['hour'], ['year'], ['day']] }]);
    assert.equal(review.publishedIncomingDirection, minute === 15 ? 'supportive' : undefined);
    const match = matched(run, 28);
    assert.equal(match.status, expected);
    assert.ok(match.sourceFactIds.includes(afterJie.factId));
    assert.equal(reviewed, expected === 'matched' ? true : undefined);
    if (expected !== 'matched') continue;
    assert.deepEqual([review.publishedNatalTrine.element, review.publishedNatalTrine.direction, review.publishedNatalTrine.dayDirection],
      ['火', 'adverse', 'supportive']);
    assert.deepEqual(match.windows, [{ start: new Date(jieMonth.start).toISOString(), endExclusive: afterJie.activeTo }]);
    for (const index of [25, 27]) {
      const other = matched(run, index);
      assert.equal(other.status, 'matched');
      assert.ok(other.sourceFactIds.includes(afterJie.factId));
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'monthly-trine-review'));
    const message = formatFortunePrompt(input);
    assert.match(message, /同一受冲日支.*原局三合/u);
    assert.doesNotMatch(message, /publishedNatalTrine|publishedMonthDayClashNatalTrine|寅午戌/u);
  }
});

test('a published day clash distinguishes the weak half group from annual completion or attack', () => {
  const chart = withLongitude(archive(1, 2002, 2, 2, 17, 15));
  for (const [year, annual, monthly, expected] of [[2016, '丙申', '乙未', 'matched'], [2017, '丁酉', '丁未', 'partial'], [2019, '己亥', '辛未', 'partial']]) {
    const run = submit(chart, 'month', { year, month: 7 });
    const afterJie = run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === monthly);
    assert.ok(afterJie);
    const p = afterJie.normalizedPayload;
    assert.deepEqual(p.direction.map(row => row.pillar), [annual, monthly, '庚子']);
    assert.deepEqual(p.clashedColumns.filter(id => ['month', 'day'].includes(id)), ['month', 'day']);
    const review = p.monthDayClashReview, raw = review.relatedNatalHalfTrine;
    assert.equal(p.monthDayClashNoNatalCombination, false);
    assert.deepEqual([raw.fullGroup, raw.element, raw.missingBranch, raw.hasCentralBranch, raw.direction],
      ['巳酉丑', '金', '酉', false, 'adverse']);
    assert.deepEqual(raw.members, [{ branch: '巳', positions: ['year'] }, { branch: '丑', positions: ['month', 'day'] }]);
    assert.equal(review.publishedIncomingDirection, 'adverse');
    const match = matched(run, 28);
    assert.equal(match.status, expected);
    assert.ok(match.sourceFactIds.includes(afterJie.factId));
    assert.equal(p.publishedMonthDayClashNatalHalfTrine, expected === 'matched' ? true : undefined);
    if (expected !== 'matched') continue;
    assert.deepEqual(review.publishedNatalHalfTrine, { ...raw, dayDirection: 'adverse' });
    assert.deepEqual(match.windows, [{ start: new Date(p.jieMonth.start).toISOString(), endExclusive: afterJie.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'monthly-half-trine-review'));
    const message = formatFortunePrompt(input);
    assert.match(message, /弱半合/u);
    assert.doesNotMatch(message, /publishedNatalHalfTrine|publishedMonthDayClashNatalHalfTrine|巳酉丑/u);
  }
});

test('branch combinations show the precise third column and preserve which links require the moving branch', () => {
  const natal = { year: '丙子', month: '丁亥', day: '己丑', hour: '庚午' };
  const context = fateClearBranchContext(natal, true, 'month', '丁未');
  const day = context.clashes.find(target => target.id === 'day');
  assert.deepEqual(day.natalCombinations.map(pair => pair.members), [['year', 'day']]);
  assert.equal(day.hasDirectNatalCombination, true);
  assert.equal(day.natalCombinations[0].adjacent, false);
  assert.deepEqual(day.natalCombinations[0].opposingColumns, ['hour']);
  assert.deepEqual(context.movingCombinations.map(pair => pair.members), [['hour', 'flow']]);
  assert.equal(context.movingElement, '土'); assert.equal(context.movingMainQi.stem, '己');
  const trine = fateClearBranchContext({ ...natal, year: '乙巳', month: '乙酉' }, true, 'month', '丁未');
  assert.equal(trine.monthDayClashReview.hasRelatedNatalSixCombination, false);
  assert.deepEqual(trine.monthDayClashReview.relatedNatalTrines,
    [{ branches: '巳酉丑', positions: [['year'], ['month'], ['day']] }]);
  assert.equal(trine.monthDayClashReview.relatedNatalHalfTrine, undefined);
  const unknown = fateClearBranchContext(natal, false, 'month', '丁未');
  assert.deepEqual(unknown.movingCombinations, []); assert.equal(unknown.timeKnown, false);
  const withTrine = fateClearBranchContext({ ...natal, year: '乙巳', month: '丁酉' }, true, 'month', '丁未');
  assert.deepEqual(withTrine.clashes[0].natalTrines, [{ branches: '巳酉丑', positions: [['year'], ['month'], ['day']] }]);
  assert.equal(withTrine.clashes[0].hasDirectNatalCombination, false);
  assert.equal(withTrine.monthDayClashReview.hasRelatedNatalSixCombination, false);
  assert.deepEqual(withTrine.movingCombinations.map(pair => pair.members), [['hour', 'flow']]);
  const adjacent = fateClearBranchContext({ ...natal, month: '壬子' }, true, 'month', '丁未').clashes[0];
  assert.equal(adjacent.natalCombinations.find(pair => pair.partner === 'month').adjacent, true);
  const hiddenHour = fateClearBranchContext({ ...natal, year: '庚申', hour: '甲子' }, false, 'month', '丁未');
  assert.equal(hiddenHour.clashes[0].hasDirectNatalCombination, undefined);
  assert.equal(hiddenHour.monthDayClashReview.relatedNatalHalfTrine, undefined);
  assert.equal(hiddenHour.monthDayClashNatalCombinationsChecked, undefined);
  const prompt = describeFortuneFact({ method: 'bazi', type: 'fateclear_bazi_context', data: context }, String);
  assert.match(prompt, /年柱与日柱的地支子丑六合/u);
  assert.match(prompt, /时柱与流月的地支午未六合/u);
  assert.match(prompt, /年柱直接六合受冲支，两柱隔位，合方同时受时柱冲/u);
});

test('monthly clash keeps the published Liuhe examples and Taishui opposing the same natal partner separate', async () => {
  const chart = withLongitude(archive(0, 1957, 3, 15, 14, 30));
  for (const [year, expectedOpposition] of [[2028, []], [2029, [{ layer: 'annual', pillar: '己酉' }]]]) {
    const run = submit(chart, 'month', { year, month: 4 });
    const fact = run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingBranch === '辰');
    const data = fact.normalizedPayload;
    assert.equal(data.publishedReadingVerified, true);
    assert.equal(data.monthDayClashReview.publishedIncomingDirection, undefined);
    assert.equal(data.monthDayClashNoNatalCombination, false);
    const partner = data.clashes.find(target => target.id === 'day').natalCombinations.find(link => link.partner === 'month');
    assert.equal(partner.adjacent, true);
    assert.equal(partner.partnerDirection, 'adverse');
    assert.deepEqual(partner.opposingColumns, ['year']);
    assert.deepEqual(partner.upperOppositions.map(({ layer, pillar }) => ({ layer, pillar })), expectedOpposition);
    const verdict = matched(run, 28);
    assert.equal(verdict.status, 'partial');
    assert.ok(verdict.sourceFactIds.includes(fact.factId));
    const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'monthly-liuhe-review')).input;
    const audit = formatFortuneFactAudit(input);
    assert.equal(audit.includes('合方同段还受流年己酉冲'), expectedOpposition.length > 0);
    assert.doesNotMatch(formatFortunePrompt(input), /合方同段还受流年己酉冲|upperOppositions/u);
  }

  const moved = submit(withLongitude(chart, 121.5), 'month', { year: 2029, month: 4 });
  const movedFact = moved.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingBranch === '辰');
  assert.equal(movedFact.normalizedPayload.publishedReadingVerified, undefined);
  assert.equal(movedFact.normalizedPayload.monthDayClashReview.hasRelatedNatalSixCombination, true);

  const other = withLongitude(archive(0, 1994, 10, 10, 6));
  const run = submit(other, 'month', { year: 2026, month: 11 });
  const fact = run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingBranch === '亥');
  assert.equal(fact.normalizedPayload.publishedReadingVerified, true);
  assert.equal(fact.normalizedPayload.monthDayClashReview.publishedIncomingDirection, 'useful');
  assert.equal(fact.normalizedPayload.monthDayClashReview.hasRelatedNatalSixCombination, false);
  assert.equal(fact.normalizedPayload.monthDayClashNoNatalCombination, true);
  const confirmed = matched(run, 28);
  assert.equal(confirmed.status, 'matched');
  assert.deepEqual(confirmed.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.deepEqual(confirmed.sourceFactIds, [fact.factId]);
  const wrongLongitude = submit(withLongitude(other, 121.5), 'month', { year: 2026, month: 11 });
  assert.equal(matched(wrongLongitude, 28).status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'published-clash-confirmation'));
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === confirmed.knowledgeId);
  assert.deepEqual(finding.windows, confirmed.windows);
  const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
    const message = JSON.parse(options.body).messages[1].content;
    assert.match(message, /来支本气的喜忌与作者公开原盘一致.*受冲的同一日支在原局未见可核的六合/u);
    assert.doesNotMatch(message, /monthDayClashNoNatalCombination|相合、相会的力量和实际缓冲仍须合参/u);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(input);
});

test('published non-transformation and seal examples flow through the verified FateClear month and its real boundary', () => {
  const nonTransforming = withLongitude(archive(0, 1987, 11, 23, 14, 30));
  const sealed = withLongitude(archive(0, 1990, 6, 2, 17, 45));
  const facts = run => run.facts.filter(row => row.factType === 'fateclear_bazi_context');
  const choose = (run, pillar) => facts(run).find(({ normalizedPayload: p }) => p.movingPillar === pillar);

  const clashMonth = submit(nonTransforming, 'month', { year: 2026, month: 6 });
  validateFortuneFacts(clashMonth);
  const clash = choose(clashMonth, '甲午');
  assert.ok(clash);
  assert.deepEqual(clash.normalizedPayload.sourceReading,
    { strength: '身弱', useful: '木', supportive: ['火'], adverse: ['土', '金'] });
  assert.equal(clash.normalizedPayload.monthlyUsefulnessBasis, 'published-natal-reading');
  assert.equal(clash.normalizedPayload.monthDayClashReview.publishedIncomingDirection, 'supportive');
  assert.equal(clash.normalizedPayload.monthDayClashNoNatalCombination, true);
  assert.equal(matched(clashMonth, 25).status, 'matched');
  const branch = matched(clashMonth, 28);
  assert.equal(branch.status, 'matched');
  assert.deepEqual(branch.sourceFactIds, [clash.factId]);
  assert.deepEqual(branch.windows, [{ start: '2026-06-05T15:48:21.000Z', endExclusive: clash.activeTo }]);

  const contrast = submit(nonTransforming, 'month', { year: 2034, month: 4 });
  const adverse = choose(contrast, '戊辰');
  assert.ok(adverse);
  const roles = adverse.normalizedPayload.direction;
  assert.deepEqual(roles.filter(row => row.layer === 'annual' || row.layer === 'monthly')
    .map(row => [row.pillar, row.stemDirection, row.mainDirection]),
  [['甲寅', 'useful', 'useful'], ['戊辰', 'adverse', 'adverse']]);
  const timing = matched(contrast, 27);
  assert.equal(timing.status, 'matched');
  assert.deepEqual(timing.sourceFactIds, [adverse.factId]);
  assert.deepEqual(timing.windows, [{ start: adverse.activeFrom, endExclusive: adverse.activeTo }]);
  assert.ok(contrast.facts.some(row => row.factType === 'fateclear_bazi_context'
    && row.activeTo === adverse.activeFrom && !timing.sourceFactIds.includes(row.factId)));

  const sealMonth = submit(sealed, 'month', { year: 2025, month: 4 });
  const metal = choose(sealMonth, '庚辰');
  assert.ok(metal);
  assert.deepEqual(metal.normalizedPayload.sourceReading,
    { strength: '身弱', useful: '火', supportive: ['土', '木'], adverse: ['金'] });
  assert.equal(matched(sealMonth, 25).status, 'matched');
  assert.equal(metal.normalizedPayload.monthStemAdverse, true);
  assert.equal(matched(sealMonth, 27).status, 'unknown');
  assert.equal(matched(sealMonth, 28).status, 'partial');
  const shifted = withLongitude(archive(0, 1987, 11, 23, 14, 31));
  const shiftedMonth = submit(shifted, 'month', { year: 2026, month: 6 });
  assert.ok(facts(shiftedMonth).every(row => row.normalizedPayload.sourceReading === undefined));
  assert.notEqual(matched(shiftedMonth, 28).status, 'matched');

  const { input } = buildFortuneModelContext(clashMonth,
    interpretFortune(clashMonth, requestForFortuneRun(clashMonth), 'fateclear-non-transforming-original'));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /有沒有合來緩沖/u);
  assert.doesNotMatch(prompt, /1987-11-23|publishedIncomingDirection|monthDayClashReview/u);
});

test('FateClear monthly clash distinguishes natal half-trines and a seasonal meeting containing the actual day branch', async () => {
  const cases = [
    { hour: 4, missing: '午', central: false, members: ['寅', '戌'] },
    { hour: 12, missing: '寅', central: true, members: ['午', '戌'] },
    { hour: 14 },
    { hour: 16, meetings: [{ branches: '申酉戌', positions: [['hour'], ['year'], ['day']] }] },
  ];
  const target = { year: 2029, month: 4 };
  for (const { hour, missing, central, members, meetings = [] } of cases) {
    const run = submit(withLongitude(archive(0, 1957, 3, 15, hour, 30)), 'month', target);
    const fact = run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingBranch === '辰');
    assert.ok(fact, hour);
    const p = fact.normalizedPayload;
    assert.equal(p.monthDayClashNatalCombinationsChecked, true);
    assert.deepEqual(p.clashes.find(row => row.id === 'day').branch, '戌');
    const { relatedNatalHalfTrine, relatedNatalMeetings, relatedNatalTrines } = p.monthDayClashReview;
    assert.deepEqual(relatedNatalTrines, []);
    assert.deepEqual(relatedNatalMeetings, meetings);
    if (members) {
      assert.equal(relatedNatalHalfTrine.fullGroup, '寅午戌');
      assert.equal(relatedNatalHalfTrine.element, '火');
      assert.equal(relatedNatalHalfTrine.missingBranch, missing);
      assert.equal(relatedNatalHalfTrine.hasCentralBranch, central);
      assert.deepEqual(relatedNatalHalfTrine.members, members.map(branch => ({ branch, positions: [branch === '戌' ? 'day' : 'hour'] })));
    } else assert.equal(relatedNatalHalfTrine, undefined);
    const hit = matched(run, 28);
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.equal(hit.windows[0].start, fact.activeFrom);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'monthly-clash-natal-groups'));
    const audit = formatFortuneFactAudit(input);
    if (members) assert.match(audit, new RegExp(members.join('') + '半合.*缺' + missing + '，' + (central ? '有' : '无') + '中神', 'u'));
    else assert.doesNotMatch(audit, /半合含受冲日支/u);
    if (meetings.length) assert.match(audit, /申酉戌三会含受冲日支/u);
    else assert.doesNotMatch(audit, /三会含受冲日支/u);
    const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
      const message = JSON.parse(options.body).messages[1].content;
      assert.doesNotMatch(message, /半合含受冲日支|三会含受冲日支|relatedNatalHalfTrine|relatedNatalMeetings|monthDayClashNatalCombinationsChecked/u);
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
    } });
    await provider.interpret(input);
    const oldPayload = structuredClone(run);
    for (const row of oldPayload.facts.filter(row => row.factType === fact.factType)) delete row.normalizedPayload.monthDayClashNatalCombinationsChecked;
    assert.deepEqual(matched(oldPayload, 28).sourceFactIds, []);
  }
});

test('FateClear day clashes use actual solar windows and stay unknown without the archived longitude', () => {
  const chart = withLongitude(archive());
  delete chart.bazi.rawResult[0].luckPeriods;
  for (const [index, column, date, phrase] of [
    [33, 'day', '2026-11-13', /安排.*伴侣/u], [34, 'year', '2026-11-10', /环境.*长辈/u],
  ]) {
    const target = { date };
    const run = submit(chart, 'day', target);
    const missing = calculate(archive(), 'day', target);
    const result = matched(run, index);
    assert.equal(result.status, 'matched');
    assert.equal(matched(missing, index).status, 'unknown');
    assert.ok(result.windows.every(window => Date.parse(window.endExclusive) - Date.parse(window.start) <= 86_460_000));
    const witnesses = run.facts.filter(fact => result.sourceFactIds.includes(fact.factId));
    assert.ok(witnesses.length);
    for (const fact of witnesses) {
      assert.equal(fact.factType, 'fateclear_bazi_context');
      assert.equal(fact.normalizedPayload.clock, fateClearSolarDayPolicy);
      assert.ok(fact.normalizedPayload.clashedColumns.includes(column));
      assert.equal(fact.normalizedPayload[column + 'ClashReviewed'], undefined);
      const { instantRange } = run.time.displayWindow;
      const solarDay = fact.normalizedPayload.apparentDay;
      assert.equal(fact.activeFrom, [solarDay.startInstant, instantRange.startInstant].sort().at(-1));
      assert.equal(fact.activeTo, [solarDay.endInstantExclusive, instantRange.endInstantExclusive].sort()[0]);
    }
    assert.ok(result.windows.every(window => !window.start.includes('T15:00:00')));
    assert.ok(missing.facts.some(fact => fact.factType === 'layer_pillar' && fact.scope === 'daily'));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'day-context-prompt'));
    const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId);
    assert.ok(finding);
    assert.match(finding.note, phrase);
    assert.match(formatFortuneFactAudit(input), /按出生地真太阳时23点换日/u);
  }
  assert.match(describeFortuneFact({ method: 'bazi', type: 'source_layer_context', data: baziSourceContext(
    { year: '甲子', month: '丁卯', day: '庚申', hour: '丙戌' }, true, [{ layer: 'year', pillar: '辛未' }, { layer: 'day', pillar: '乙亥' }]) }, String), /一级扭曲/u);
});

test('source case day clashes use the clashed branch role and never borrow the direction of the incoming branch', () => {
  const chart = withLongitude(archive(0, 1980, 3, 11, 6, 30));
  for (const [index, id, natalBranch, incoming, role, date, expected] of [
    [33, 'day', '未', '己丑', 'adverse', '1986-02-14', /受冲本命支的本气方向为忌神/u],
    [34, 'year', '申', '庚寅', 'useful', '1986-02-15', /受冲本命支的本气方向为用神/u],
  ]) {
    const run = submit(chart, 'day', { date });
    validateFortuneFacts(run);
    const result = matched(run, index);
    assert.equal(result.status, 'matched');
    const [fact] = run.facts.filter(row => result.sourceFactIds.includes(row.factId));
    assert.deepEqual(result.sourceFactIds, [fact.factId]);
    const p = fact.normalizedPayload;
    const target = p.clashes.find(row => row.id === id);
    assert.deepEqual([p.movingPillar, p.movingBranchDirection, target.branch, target.branchDirection], [incoming, 'adverse', natalBranch, role]);
    assert.equal(target.hasDirectNatalCombination, false);
    assert.equal(p[id + 'ClashReviewed'], true);
    const otherIndex = index === 33 ? 34 : 33;
    assert.equal(matched({ ...run, facts: [fact] }, otherIndex).status, 'not_matched');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'fateclear-reviewed-clash'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, expected);
    assert.doesNotMatch(prompt, /dayClashReviewed|yearClashReviewed|branchDirection/u);
  }
});

test('the solar day boundary agrees with an independent hour-angle check at distant longitudes', () => {
  const start = Date.parse('2026-11-08T16:00:00Z'), end = Date.parse('2026-11-10T16:00:00Z');
  for (const longitude of [-180, -118.25, 0, 87.6, 116.4, 180]) {
    const days = fateClearSolarDays({ start, end }, longitude);
    assert.equal(days[0].start, start);
    assert.equal(days.at(-1).end, end);
    for (const [index, day] of days.entries()) {
      if (index) assert.equal(days[index - 1].end, day.start);
      const hour = (HourAngle(Body.Sun, new Date(day.solarStart), new Observer(39.9, longitude, 0)) + 12) % 24;
      assert.ok(Math.abs(hour - 23) * 3600 < 1.5, `hour angle at ${longitude}: ${hour}`);
      const target = Date.parse(day.solarDate + 'T00:00:00Z') - 3_600_000;
      assert.ok(apparentSolarEpoch(day.solarStart - 1, longitude) < target);
      assert.ok(apparentSolarEpoch(day.solarStart, longitude) >= target);
    }
  }
  assert.deepEqual(fateClearSolarDays({ start, end }, 181), []);
  const solarBirth = new Date(apparentSolarEpoch(Date.parse('1980-03-10T22:30:00Z'), 116.4));
  assert.equal(solarBirth.toISOString().slice(0, 16), '1980-03-11T06:05');
});

test('published daily directions distinguish an adverse branch from an unlisted branch while the named example keeps its own date', async () => {
  const chart = withLongitude(archive(0, 1980, 3, 11, 6, 30)), target = { date: '1986-02-05' };
  const run = submit(chart, 'day', target), result = matched(run, 36);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: '1986-02-04T16:00:00.000Z', endExclusive: '1986-02-05T15:28:25.835Z' }]);
  const fact = run.facts.find(row => result.sourceFactIds.includes(row.factId)), data = fact.normalizedPayload;
  assert.equal(data.dailyUsefulnessBasis, 'published-natal-reading');
  assert.deepEqual([data.dayStemSupportive, data.dayStemBranchOpposed, data.dayUsefulYearOther], [true, true, true]);
  assert.deepEqual(data.direction.map(row => [row.layer, row.pillar, row.stemDirection, row.mainDirection]), [
    ['annual', '丙寅', 'unlisted', 'adverse'], ['monthly', '庚寅', 'useful', 'adverse'],
    ['decadal', '戊寅', 'adverse', 'adverse'], ['daily', '庚辰', 'useful', 'adverse'],
  ]);
  assert.ok(fact.sourceFactIds.every(id => run.rawFacts.some(raw => raw.rawFactId === id)));
  const after = run.facts.find(row => row.factType === fact.factType && row.activeFrom === fact.activeTo);
  assert.equal(after.normalizedPayload.movingPillar, '辛巳');
  assert.equal(after.normalizedPayload.dailyCaseVerified, false);
  const eve = submit(chart, 'day', { date: '1986-02-04' });
  const spring = '1986-02-04T03:07:42.000Z', solarStart = data.apparentDay.startInstant;
  const beforeAndAfterSpring = eve.facts.filter(row => row.factType === fact.factType && row.normalizedPayload.solarDate === '1986-02-04');
  assert.deepEqual(beforeAndAfterSpring.map(row => [row.activeFrom, row.activeTo, ...row.normalizedPayload.direction.slice(0, 2).map(p => p.pillar)]), [
    ['1986-02-03T16:00:00.000Z', spring, '乙丑', '己丑'], [spring, solarStart, '丙寅', '庚寅'],
  ]);
  assert.deepEqual(matched(eve, 36).windows, [{ start: solarStart, endExclusive: '1986-02-04T16:00:00.000Z' }]);
  const dated = [31, 32].map(index => matched(run, index));
  assert.ok(dated.every(match => match.status === 'matched'));
  assert.deepEqual(dated[0].windows, [{ start: fact.activeFrom, endExclusive: after.activeTo }]);
  assert.deepEqual(dated[0].sourceFactIds, [fact.factId, after.factId]);
  assert.equal(dated[0].candidateWindows, undefined);
  assert.deepEqual(dated[1].windows, result.windows);
  assert.deepEqual(dated[1].sourceFactIds, [fact.factId]);
  assert.equal(dated[1].candidateWindows, undefined);
  const mismatch = matched(run, 35);
  assert.equal(mismatch.status, 'matched');
  assert.deepEqual(mismatch.windows, [{ start: result.windows[0].start, endExclusive: '1986-02-05T16:00:00.000Z' }]);
  assert.ok(mismatch.sourceFactIds.includes(after.factId));
  const missing = structuredClone(chart); delete missing.bazi.rawResult[0].luckPeriods;
  assert.equal(matched(submit(missing, 'day', target), 36).status, 'unknown');
  const moved = withLongitude(chart, 121.5);
  const movedRun = submit(moved, 'day', target);
  assert.equal(matched(movedRun, 36).status, 'not_matched');
  assert.ok(movedRun.facts.filter(row => row.factType === 'fateclear_bazi_context').every(row =>
    row.normalizedPayload.dailyUsefulnessBasis !== 'published-natal-reading'));
  assert.equal(matched(submit(chart, 'day', { date: '1986-02-06' }), 36).status, 'not_matched');

  const strong = submit(withLongitude(archive(1, 1973, 9, 24, 9, 45)), 'day', { date: '1983-09-05' });
  assert.equal(matched(strong, 31).status, 'matched');
  assert.equal(matched(strong, 32).status, 'not_matched');
  const strongDay = strong.facts.find(row => row.factType === fact.factType && row.normalizedPayload.movingPillar === '丙申');
  assert.equal(strongDay.normalizedPayload.dailyUsefulnessBasis, 'published-natal-reading');
  assert.equal(strongDay.normalizedPayload.dayStemBranchOpposed, false);
  const supportive = submit(chart, 'day', { date: '1986-02-07' });
  const supportiveDay = supportive.facts.find(row => row.factType === fact.factType && row.normalizedPayload.movingPillar === '壬午');
  assert.equal(supportiveDay.normalizedPayload.dailyUsefulnessBasis, 'published-natal-reading');
  assert.equal(supportiveDay.normalizedPayload.direction.find(row => row.layer === 'daily').stemDirection, 'supportive');
  assert.equal(supportiveDay.normalizedPayload.dayStemSupportive, true);
  assert.equal(supportiveDay.normalizedPayload.dayUsefulYearOther, false);
  assert.ok(matched(supportive, 31).sourceFactIds.includes(supportiveDay.factId));
  assert.equal(matched(supportive, 31).status, 'matched');
  assert.ok(!matched(supportive, 35).sourceFactIds.includes(supportiveDay.factId));
  const aligned = submit(chart, 'day', { date: '1990-06-14' });
  const alignedFact = aligned.facts.find(row => row.factType === fact.factType && row.normalizedPayload.movingPillar === '庚戌');
  assert.deepEqual(alignedFact.normalizedPayload.direction.filter(row => ['annual', 'daily'].includes(row.layer))
    .map(row => [row.pillar, row.stemDirection]), [['庚午', 'useful'], ['庚戌', 'useful']]);
  assert.equal(alignedFact.normalizedPayload.dayUsefulYearOther, false);
  assert.equal(matched(aligned, 35).status, 'not_matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'solar-source-case'));
  const prompt = formatFortuneFactAudit(input);
  assert.deepEqual(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === mismatch.knowledgeId)?.windows, mismatch.windows);
  assert.match(formatFortunePrompt(input), /当前真太阳日的日干为用、同段年干未取为用/u);
  assert.match(prompt, /流日庚辰天干庚为用神，支本气戊为忌神/u);
  assert.match(prompt, /当地真太阳日为1986-02-05/u);
  assert.doesNotMatch(prompt, /116\.4|fateclear-apparent-solar|archiveLuckConfirmed|fateclear-source-fixture/u);
  for (const match of dated) {
    const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === match.knowledgeId);
    assert.deepEqual(finding.windows, match.windows);
  }
  const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
    const message = JSON.parse(options.body).messages[1].content;
    assert.match(message, /真太阳日的天干落在明列喜用一侧/u);
    assert.match(message, /真太阳日的天干与支本气分别落在同盘明列的喜用与忌神两边/u);
    assert.doesNotMatch(message, /dailyCaseVerified|candidateWindows|普通命盘仍需可证的取用标准/u);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(input);
});

test('published daily rules keep the named Bing-Shen case and a verified adverse stem distinct', () => {
  const namedChart = withLongitude(archive(1, 1973, 9, 24, 9, 45));
  const weakChart = withLongitude(archive(0, 1980, 3, 11, 6, 30));
  const find = (run, id) => matchFortuneKnowledge(run).byMethod.bazi
    .find(row => row.knowledgeId === 'fortune-entry-' + id);
  const namedDay = submit(namedChart, 'day', { date: '1983-09-05' });
  const first = find(namedDay, 2231);
  assert.equal(first.status, 'matched');
  const fact = namedDay.facts.find(row => first.sourceFactIds.includes(row.factId));
  assert.deepEqual(first.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.deepEqual([fact.normalizedPayload.movingPillar, fact.normalizedPayload.publishedDayStemDirection,
    fact.normalizedPayload.publishedDayMainDirection], ['丙申', 'useful', 'unlisted']);
  assert.equal(find(submit(namedChart, 'day', { date: '1983-09-06' }), 2231).status, 'not_matched');
  assert.notEqual(find(submit(withLongitude(namedChart, 121.5), 'day', { date: '1983-09-05' }), 2231).status, 'matched');

  const adverseDay = submit(weakChart, 'day', { date: '1986-02-09' });
  const adverse = find(adverseDay, 2232);
  assert.equal(adverse.status, 'matched');
  const evidence = adverseDay.facts.filter(row => adverse.sourceFactIds.includes(row.factId));
  assert.ok(evidence.some(row => row.normalizedPayload.movingPillar === '甲申'));
  assert.ok(evidence.every(row => row.normalizedPayload.publishedDayStemDirection === 'adverse'));
  assert.equal(find(submit(weakChart, 'day', { date: '1986-02-07' }), 2232).status, 'not_matched');
  assert.notEqual(find(submit(withLongitude(weakChart, 121.5), 'day', { date: '1986-02-09' }), 2232).status, 'matched');

  for (const [run, match] of [[namedDay, first], [adverseDay, adverse]]) {
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), match.knowledgeId));
    const finding = input.sections.flatMap(section => section.findings).find(item => item.knowledgeId === match.knowledgeId);
    assert.deepEqual(finding.windows, match.windows);
  }
});

test('daily branch main qi and annual stem contact keep the source day and upper scopes separate', () => {
  const chart = archive(0, 1980, 3, 11, 6, 30);
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.bazi.find(row => row.knowledgeId === 'fortune-entry-' + id);
  const cases = [
    [2280, '1986-02-09', '甲申', 'publishedDayMainDirection', 'useful'],
    [2281, '1986-02-05', '庚辰', 'publishedDayMainDirection', 'adverse'],
    [2282, '1986-02-12', '丁亥', 'sameAnnualAndDailyStemElement', true],
  ];
  for (const [id, date, pillar, field, expected] of cases) {
    const run = submit(withLongitude(chart), 'day', { date });
    const found = lookup(run, id);
    assert.equal(found.status, 'matched', 'entry ' + id);
    const witness = run.facts.find(row => found.sourceFactIds.includes(row.factId) && row.normalizedPayload.movingPillar === pillar);
    assert.ok(witness);
    const data = witness.normalizedPayload;
    const [annual] = data.direction;
    const daily = data.direction.find(row => row.layer === 'daily');
    assert.equal(data[field], expected);
    if (id === 2282) {
      assert.equal(annual.pillar, '丙寅');
      assert.notEqual(annual.stem, daily.stem);
      assert.equal(annual.stemElement, daily.stemElement);
    } else {
      assert.notEqual(data.publishedDayStemDirection, expected);
    }
    const opposite = { ...witness, normalizedPayload: { ...data, [field]: id === 2282 ? false : 'neutral' } };
    assert.equal(lookup({ ...run, facts: [opposite] }, id).status, 'not_matched');
    const noLuck = { ...witness, normalizedPayload: { ...data, archiveLuckConfirmed: false } };
    assert.equal(lookup({ ...run, facts: [noLuck] }, id).status, 'not_matched');
    if (id === 2281) {
      assert.equal(matched({ ...run, facts: [noLuck] }, 32).status, 'not_matched');
    }
    const noLongitude = submit(chart, 'day', { date });
    assert.notEqual(lookup(noLongitude, id).status, 'matched');
  }
});

test('monthly theme rules require the actual month stem and the preceding complete Jie month when specified', () => {
  const jia = withLongitude(archive(1, 1984, 1, 31, 12));
  const geng = withLongitude(archive(1, 1970, 8, 28, 17, 45));
  const cases = [
    [2305, jia, 2, '丙寅', 'movingStemTenGod', '食神'],
    [2306, geng, 2, '丙寅', 'movingStemTenGod', '七杀'],
    [2307, jia, 7, '辛未', 'clashedColumns', ['month']],
    [2308, jia, 5, '己巳', 'repeatedMonthStemTheme', '财星', '戊辰'],
    [2309, jia, 7, '辛未', 'repeatedMonthStemTheme', '官杀', '庚午'],
    [2310, jia, 9, '癸酉', 'repeatedMonthStemTheme', '印星', '壬申'],
    [2311, jia, 3, '丁卯', 'repeatedMonthStemTheme', '食伤', '丙寅'],
  ];
  const byMonth = new Map();
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.bazi.find(row => row.knowledgeId === 'fortune-entry-' + id);
  for (const [id, chart, month, pillar, field, expected, previous] of cases) {
    const key = chart.bazi.rawResult[0].day + '/' + month;
    if (!byMonth.has(key)) byMonth.set(key, submit(chart, 'month', { year: 2024, month }));
    const run = byMonth.get(key);
    const match = lookup(run, id);
    assert.equal(match.status, 'matched', 'entry ' + id);
    const witness = run.facts.find(row => match.sourceFactIds.includes(row.factId) && row.normalizedPayload.movingPillar === pillar);
    assert.ok(witness);
    const data = witness.normalizedPayload;
    if (Array.isArray(expected)) assert.ok(expected.every(value => data[field].includes(value)));
    else assert.equal(data[field], expected);
    if (previous) assert.equal(data.previousJieMonthPillar, previous);
    assert.equal(data.jieMonth.start, Date.parse(witness.activeFrom));
    const wrong = { ...witness, normalizedPayload: { ...data, [field]: Array.isArray(expected) ? ['day'] : '其他' } };
    assert.equal(lookup({ ...run, facts: [wrong] }, id).status, 'not_matched');
  }
  const afterLiChun = byMonth.get('甲子/2');
  const season = afterLiChun.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === '丙寅');
  assert.equal(season.normalizedPayload.previousJieMonthPillar, undefined);
  assert.notEqual(lookup(afterLiChun, 2311).status, 'matched');
  const may = fateClearJieMonth(Date.UTC(2024, 4, 15));
  assert.equal(repeatedMonthStemTheme('甲', may, may.start - 1), undefined);
});

test('the published month-stem matrix reaches SQLite only in the named Jie month and natal day stem', () => {
  const months = [
    [2026, 10, '戊戌'], [2026, 11, '己亥'], [2026, 12, '庚子'], [2027, 1, '辛丑'],
    [2027, 2, '壬寅'], [2027, 3, '癸卯'], [2027, 4, '甲辰'], [2027, 5, '乙巳'],
    [2027, 6, '丙午'], [2027, 7, '丁未'], [2027, 8, '戊申'], [2027, 9, '己酉'],
    [2027, 10, '庚戌'], [2027, 11, '辛亥'], [2027, 12, '壬子'], [2028, 1, '癸丑'],
  ];
  const stems = '甲乙丙丁戊己庚辛壬癸';
  const charts = new Map(Array.from({ length: 10 }, (_, index) => {
    const chart = withLongitude(archive(1, 1984, 12, index + 1));
    return [chart.bazi.rawResult[0].day[0], chart];
  }));
  const lookup = run => matchFortuneKnowledge(run).byMethod.bazi.filter(row => {
    const id = Number(row.knowledgeId.slice('fortune-entry-'.length));
    return row.status === 'matched' && id >= 2457 && id <= 2616;
  });
  for (const [monthIndex, [year, month, pillar]] of months.entries()) {
    const master = stems[monthIndex % stems.length];
    const run = submit(charts.get(master), 'month', { year, month });
    const fact = run.facts.find(row => row.factType === 'bazi_jie_month_context' && row.normalizedPayload.monthPillar === pillar);
    assert.ok(fact, pillar);
    assert.equal(fact.normalizedPayload.dayMaster, master);
    assert.equal(fact.normalizedPayload.monthTenGod, describeBaZiStem(pillar[0], master).tenGod);
    const actualId = 'fortune-entry-' + (2457 + monthIndex * 10 + stems.indexOf(master));
    assert.ok(lookup(run).some(row => row.knowledgeId === actualId && row.windows[0].start === fact.activeFrom));
    if (pillar === '壬寅') {
      assert.equal(fact.activeFrom, '2027-02-04T01:46:18.000Z');
      assert.equal(fact.normalizedPayload.annualPillar, '丁未');
      assert.equal(run.facts.find(row => row.factType === fact.factType && row.activeTo === fact.activeFrom)
        .normalizedPayload.annualPillar, '丙午');
    }
    for (const [stemIndex, dayMaster] of [...stems].entries()) {
      const evidence = { ...fact, normalizedPayload: {
        ...fact.normalizedPayload, dayMaster, monthTenGod: describeBaZiStem(pillar[0], dayMaster).tenGod,
      } };
      assert.deepEqual(lookup({ ...run, facts: [evidence] }).map(row => row.knowledgeId),
        ['fortune-entry-' + (2457 + monthIndex * 10 + stemIndex)], dayMaster + '/' + pillar);
    }
    const wrongEdition = { ...fact, normalizedPayload: { ...fact.normalizedPayload, jieStartDate: '2087-02-04' } };
    assert.deepEqual(lookup({ ...run, facts: [wrongEdition] }), []);
  }
});

test('the published branch-clash months distinguish the actual natal day and year positions', () => {
  const cases = [
    [2617, 2026, 11, 1976, 7, '己亥', 'day'], [2618, 2026, 11, 1977, 1, '己亥', 'year'],
    [2619, 2026, 12, 1976, 8, '庚子', 'day'], [2620, 2026, 12, 1978, 1, '庚子', 'year'],
    [2621, 2027, 1, 1976, 9, '辛丑', 'day'], [2622, 2027, 1, 1979, 1, '辛丑', 'year'],
    [2623, 2027, 2, 1976, 10, '壬寅', 'day'], [2624, 2027, 2, 1980, 2, '壬寅', 'year'],
  ];
  for (const [id, year, month, birthYear, birthDay, pillar, position] of cases) {
    const run = submit(withLongitude(archive(1, birthYear, 12, birthDay)), 'month', { year, month });
    const lookup = (candidate, entry) => matchFortuneKnowledge(candidate).byMethod.bazi
      .find(row => row.knowledgeId === 'fortune-entry-' + entry);
    const match = lookup(run, id);
    assert.equal(match.status, 'matched');
    const evidence = run.facts.find(row => match.sourceFactIds.includes(row.factId));
    assert.deepEqual(evidence.normalizedPayload.clashedNatalPositions, ['natal:' + position]);
    assert.equal(evidence.normalizedPayload.monthPillar, pillar);
    assert.notEqual(lookup(run, position === 'day' ? id + 1 : id - 1).status, 'matched');
    const different = { ...evidence, normalizedPayload: { ...evidence.normalizedPayload, clashedNatalPositions: ['natal:month'] } };
    assert.equal(lookup({ ...run, facts: [different] }, id).status, 'not_matched');
  }
});

test('monthly direction rules use one published natal reading and both upper pillars inside the same Jie segment', () => {
  const example = archive(1, 1959, 11, 3, 1, 15);
  const april = submit(example, 'month', { year: 1972, month: 4 }), results = [25, 26, 27].map(index => matched(april, index));
  assert.deepEqual(results.map(row => row.status), ['matched', 'matched', 'not_matched']);
  assert.deepEqual(results[1].windows, [{ start: '1972-04-04T16:28:50.000Z', endExclusive: '1972-04-30T16:00:00.000Z' }]);
  const { input } = buildFortuneModelContext(april, interpretFortune(april, requestForFortuneRun(april), 'monthly-useful-mismatch'));
  assert.deepEqual(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === results[1].knowledgeId)?.windows, results[1].windows);
  assert.match(formatFortunePrompt(input), /交节后的月干为用、同段年干未取为用/u);
  const september = submit(example, 'month', { year: 1972, month: 9 });
  const contrasting = matched(september, 27);
  assert.equal(contrasting.status, 'partial');
  assert.ok(september.facts.filter(row => contrasting.sourceFactIds.includes(row.factId)).every(row =>
    row.normalizedPayload.direction[0].stemDirection === 'supportive' && row.normalizedPayload.direction[0].mainDirection === 'supportive'
    && row.normalizedPayload.direction[1].stemDirection === 'adverse'));
  const samePillars = submit(archive(1, 1959, 11, 3, 1, 30), 'month', { year: 1972, month: 4 });
  assert.equal(matched(samePillars, 25).status, 'matched');
  assert.ok([26, 27].every(index => matched(samePillars, index).status === 'unknown'));
  const aligned = submit(withLongitude(example), 'month', { year: 1974, month: 10 });
  const fact = aligned.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === '甲戌');
  assert.deepEqual(fact.normalizedPayload.direction.slice(0, 2).map(row => [row.pillar, row.stemDirection]),
    [['甲寅', 'useful'], ['甲戌', 'useful']]);
  assert.equal(fact.normalizedPayload.monthUsefulYearOther, false);
  assert.equal(matched(aligned, 26).status, 'not_matched');
});

test('reviewed monthly stems and year-branch clashes require their own verified Jie-month facts', () => {
  const supported = withLongitude(archive(1, 1959, 11, 3, 1, 15));
  const clashed = withLongitude(archive(0, 1979, 5, 17, 18, 45));
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.bazi
    .find(row => row.knowledgeId === 'fortune-entry-' + id);
  const autumn = submit(supported, 'month', { year: 1972, month: 10 });
  const special = lookup(autumn, 2235);
  assert.equal(special.status, 'matched');
  const [afterJie] = autumn.facts.filter(fact => special.sourceFactIds.includes(fact.factId));
  assert.equal(afterJie.normalizedPayload.movingPillar, '庚戌');
  assert.equal(afterJie.normalizedPayload.publishedMonthStemDirection, 'supportive');
  assert.ok(Date.parse(special.windows[0].start) === afterJie.normalizedPayload.jieMonth.start);
  const useful = submit(supported, 'month', { year: 1972, month: 4 });
  const useStem = useful.facts.find(fact => fact.factType === 'fateclear_bazi_context'
    && fact.normalizedPayload.movingPillar === '甲辰');
  assert.equal(useStem.normalizedPayload.publishedMonthStemDirection, 'useful');
  assert.deepEqual(lookup({ ...useful, facts: [useStem] }, 2235).windows, []);

  const winter = submit(clashed, 'month', { year: 1989, month: 1 });
  const yearClash = lookup(winter, 2236);
  assert.equal(yearClash.status, 'matched');
  const [clash] = winter.facts.filter(fact => yearClash.sourceFactIds.includes(fact.factId));
  assert.equal(clash.normalizedPayload.movingBranch, '丑');
  assert.deepEqual(clash.normalizedPayload.clashedColumns, ['year']);
  assert.equal(clash.normalizedPayload.movingBranchDirection, 'adverse');
  assert.equal(clash.normalizedPayload.clashes[0].hasDirectNatalCombination, false);
  const dayOnly = submit(clashed, 'month', { year: 1989, month: 3 });
  assert.ok(dayOnly.facts.some(fact => fact.factType === 'fateclear_bazi_context'
    && fact.normalizedPayload.clashedColumns.includes('day')));
  assert.equal(lookup(dayOnly, 2236).status, 'not_matched');
  assert.notEqual(lookup(submit(withLongitude(clashed, 121.5), 'month', { year: 1989, month: 1 }), 2236).status, 'matched');
});

test('the FateClear month rules separate the branch main qi from the monthly and annual stems', () => {
  const birth = archive(1, 1964, 10, 22, 1, 15);
  const chart = withLongitude(birth);
  const monthRun = (month, snapshot = chart) => submit(snapshot, 'month', { year: 1974, month });
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.bazi
    .find(row => row.knowledgeId === 'fortune-entry-' + id);
  const cases = [
    [2277, 2, '丙寅', 'publishedMonthMainDirection', 'useful'],
    [2278, 10, '甲戌', 'publishedMonthMainDirection', 'adverse'],
    [2279, 11, '乙亥', 'sameAnnualAndMonthlyStemElement', true],
  ];
  for (const [id, month, pillar, field, expected] of cases) {
    const run = monthRun(month);
    const result = lookup(run, id);
    assert.equal(result.status, 'matched', 'entry ' + id);
    const fact = run.facts.find(row => result.sourceFactIds.includes(row.factId)
      && row.normalizedPayload.movingPillar === pillar);
    assert.ok(fact);
    assert.equal(fact.normalizedPayload[field], expected);
    assert.equal(fact.normalizedPayload.jieMonth.start, Date.parse(fact.activeFrom));
    assert.equal(fact.normalizedPayload.jieMonth.annualPillar, '甲寅');
    const [annual, monthly] = fact.normalizedPayload.direction;
    if (id === 2279) {
      assert.notEqual(annual.stem, monthly.stem);
      assert.equal(annual.stemElement, monthly.stemElement);
    } else {
      assert.notEqual(monthly.stemDirection, expected);
    }
    const opposite = { ...fact.normalizedPayload, [field]: field === 'publishedMonthMainDirection' ? 'neutral' : false };
    assert.equal(lookup({ ...run, facts: [{ ...fact, normalizedPayload: opposite }] }, id).status, 'not_matched');
    const wrongOrder = { ...fact.normalizedPayload, monthlyLayerOrderVerified: false };
    assert.equal(lookup({ ...run, facts: [{ ...fact, normalizedPayload: wrongOrder }] }, id).status, 'not_matched');
    const noClock = monthRun(month, birth);
    assert.equal(lookup(noClock, id).status === 'matched', id === 2279);
  }
});

test('monthly readings preserve a supported year and withhold it on actual annual friction at key branches', () => {
  const aligned = submit(withLongitude(archive(1, 1964, 10, 22, 1, 15)), 'month', { year: 1974, month: 4 });
  const fact = aligned.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === '戊辰');
  assert.notEqual(fact.normalizedPayload.exampleVerified, true);
  assert.deepEqual(fact.normalizedPayload.direction.map(row => row.pillar), ['甲寅', '戊辰', '乙亥']);
  assert.equal(fact.normalizedPayload.sourceReading.useful, '木');
  const previousMonth = aligned.facts.find(row => row.factType === 'fateclear_bazi_context' && row.activeTo === fact.activeFrom);
  assert.ok(previousMonth);
  const jie = fact.normalizedPayload.jieMonth;
  assert.deepEqual([jie.startTerm, jie.endTerm, jie.annualPillar, jie.monthPillar], ['清明', '立夏', '甲寅', '戊辰']);
  assert.equal(jie.start, Date.parse(fact.activeFrom));
  assert.equal(jie.start, previousMonth.normalizedPayload.jieMonth.end);
  assert.equal(jie.midpoint, jie.start + Math.floor((jie.end - jie.start) / 2));
  assert.ok(jie.end > Date.parse(fact.activeTo));
  const layerOrder = matched(aligned, 25);
  assert.equal(layerOrder.status, 'matched');
  assert.equal(layerOrder.matchedSourceExcerpt, '按節氣換月');
  assert.deepEqual(layerOrder.windows, [{ start: previousMonth.activeFrom, endExclusive: fact.activeTo }]);
  assert.deepEqual(layerOrder.sourceFactIds, [previousMonth.factId, fact.factId]);
  assert.deepEqual(fact.normalizedPayload.annualCoreClashes, []);
  assert.equal(fact.normalizedPayload.yearFavourableCandidate, true);
  assert.equal(fact.normalizedPayload.monthlyLayerOrderVerified, true);
  assert.equal(fact.normalizedPayload.monthStemAdverse, true);
  const confirmed = matched(aligned, 27);
  assert.equal(confirmed.status, 'matched');
  assert.equal(confirmed.matchedSourceExcerpt, '某個月天干踩忌');
  assert.deepEqual(confirmed.sourceFactIds, [fact.factId]);
  assert.deepEqual(confirmed.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const wrongJie = { ...fact, normalizedPayload: { ...fact.normalizedPayload, monthlyLayerOrderVerified: false } };
  assert.equal(matched({ ...aligned, facts: [wrongJie] }, 27).status, 'not_matched');
  const { input: verifiedInput } = buildFortuneModelContext(aligned,
    interpretFortune(aligned, requestForFortuneRun(aligned), 'fate-clear-corroborated-unfavourable-month'));
  assert.match(formatFortunePrompt(verifiedInput), /当前节令月干落忌/u);
  assert.match(formatFortunePrompt(verifiedInput), /按作者公开命例核对本命喜忌.*以整节气月中点计算的流月/u);
  assert.doesNotMatch(formatFortunePrompt(verifiedInput), /monthlyLayerOrderVerified|exampleVerified/u);
  const withoutClock = submit(archive(1, 1964, 10, 22, 1, 15), 'month', { year: 1974, month: 4 });
  assert.equal(matched(withoutClock, 27).status, 'unknown');
  assert.equal(matched(withoutClock, 25).status, 'matched');
  const adverseYear = submit(withLongitude(archive(1, 1963, 5, 12, 15, 45)), 'month', { year: 1969, month: 7 });
  const adverse = adverseYear.facts.find(row => row.factType === 'fateclear_bazi_context');
  assert.deepEqual(adverse.normalizedPayload.sourceReading, { strength: '身弱', useful: '水', supportive: ['木'], adverse: ['土', '火'] });
  assert.equal(adverse.normalizedPayload.direction[0].stemDirection, 'adverse');
  assert.equal(matched(adverseYear, 27).status, 'not_matched');

  const clash = submit(withLongitude(archive(0, 2004, 8, 22, 12)), 'month', { year: 2047, month: 10 });
  const clashed = clash.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === '庚戌');
  assert.deepEqual(clashed.normalizedPayload.direction.slice(0, 2).map(row => [row.pillar, row.stemDirection, row.mainDirection]),
    [['丁卯', 'useful', 'supportive'], ['庚戌', 'adverse', 'supportive']]);
  assert.ok(clashed.normalizedPayload.annualCoreClashes.some(row => row.id === 'day' && row.pillar === '癸酉'));
  assert.equal(clashed.normalizedPayload.yearFavourableCandidate, undefined);
  assert.ok(!matched(clash, 27).sourceFactIds.includes(clashed.factId));
  const { input } = buildFortuneModelContext(clash, interpretFortune(clash, requestForFortuneRun(clash), 'fate-clear-annual-clash'));
  assert.match(formatFortuneFactAudit(input), /流年实冲日柱癸酉，年度整体方向待核/u);
  assert.doesNotMatch(formatFortunePrompt(input), /流年实冲日柱癸酉|annualCoreClashes/u);

  const published = archive(1, 2002, 2, 2, 17, 15);
  const ordinary = archive(1, 2002, 2, 2, 17, 30);
  for (const chart of [published, ordinary]) {
    const run = submit(withLongitude(chart), 'month', { year: 2026, month: 10 });
    const harmed = run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === '戊戌');
    const payload = harmed.normalizedPayload;
    assert.equal(payload.direction[0].pillar, '丙午');
    assert.deepEqual(payload.annualCorePunishmentsAndHarms.filter(row => row.kind === '六害'), [
      { id: 'month', pillar: '辛丑', kind: '六害' },
      { id: 'day', pillar: '辛丑', kind: '六害' },
    ]);
    assert.equal(payload.yearFavourableCandidate, undefined);
    assert.ok(!matched(run, 27).sourceFactIds.includes(harmed.factId));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'fate-clear-annual-harm'));
    assert.match(formatFortuneFactAudit(input), /流年与日柱辛丑成六害，年度整体方向待核/u);
    assert.doesNotMatch(formatFortunePrompt(input), /年度整体方向待核|annualCorePunishmentsAndHarms/u);
  }

  const punishment = submit(withLongitude(published), 'month', { year: 2022, month: 10 });
  const punished = punishment.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === '庚戌');
  assert.equal(punished.normalizedPayload.direction[0].pillar, '壬寅');
  assert.deepEqual(punished.normalizedPayload.annualCoreClashes, []);
  assert.deepEqual(punished.normalizedPayload.annualCorePunishmentsAndHarms, [
    { id: 'year', pillar: '辛巳', kind: '六害' },
    { id: 'year', pillar: '辛巳', kind: '相刑' },
  ]);
  assert.ok(!matched(punishment, 27).sourceFactIds.includes(punished.factId));
});

test('two published strong charts yield opposite earth and water sides on the same apparent solar day', () => {
  const target = { date: '2026-11-10' };
  for (const [chart, stem, branch] of [
    [archive(0, 2004, 8, 22, 12), 'supportive', 'adverse'],
    [archive(1, 2002, 2, 2, 17, 15), 'adverse', 'supportive'],
  ]) {
    const run = submit(withLongitude(chart), 'day', target);
    const fact = run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === '戊子');
    assert.equal(fact.normalizedPayload.dailyUsefulnessBasis, 'published-natal-reading');
    assert.equal(fact.normalizedPayload.dailyCaseVerified, false);
    assert.equal(fact.normalizedPayload.archiveLuckConfirmed, true);
    assert.equal(fact.normalizedPayload.publishedReadingVerified, true);
    const day = fact.normalizedPayload.direction.find(row => row.layer === 'daily');
    assert.deepEqual([day.stemDirection, day.mainDirection], [stem, branch]);
    const supportive = matched(run, 31), opposite = matched(run, 32);
    assert.equal(supportive.sourceFactIds.includes(fact.factId), stem === 'supportive');
    if (stem === 'supportive') {
      assert.equal(supportive.status, 'matched');
      assert.equal(supportive.matchedSourceExcerpt, '流日天干若是喜用');
    }
    assert.equal(opposite.status, 'matched');
    assert.equal(opposite.matchedSourceExcerpt, '地支管底盤承接');
    assert.ok(opposite.sourceFactIds.includes(fact.factId));
    const exactDay = fact.normalizedPayload.apparentDay;
    assert.ok(Date.parse(exactDay.startInstant) <= Date.parse(fact.activeFrom));
    assert.equal(fact.activeTo, exactDay.endInstantExclusive);
    assert.deepEqual(opposite.windows, [{ start: fact.activeFrom, endExclusive: exactDay.endInstantExclusive }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'verified-source-day-directions'));
    const prompt = formatFortunePrompt(input);
    assert.equal(/真太阳日的天干落在明列喜用一侧/u.test(prompt), stem === 'supportive');
    assert.match(prompt, /真太阳日的天干与支本气分别落在同盘明列的喜用与忌神两边/u);
    assert.doesNotMatch(prompt, /dailyCaseVerified|dailyUsefulnessBasis|publishedReadingVerified/u);
  }
  const archiveAtWrongLongitude = submit(withLongitude(archive(0, 2004, 8, 22, 12), 121.5), 'day', target);
  assert.ok([31, 32].every(index => matched(archiveAtWrongLongitude, index).status !== 'matched'));
});

test('the base allocation reproduces seven published five-element and support score tables', () => {
  const examples = [
    ['乙丑 己丑 己巳 甲戌', [1.5, 0.7, 3.2, 0.85, 0.75], [3.9, 3.1]],
    ['乙丑 辛巳 庚申 丙戌', [0.5, 2.3, 1.2, 2.55, 0.45], [3.75, 3.25]],
    ['庚子 丙戌 乙未 丁亥', [0.43, 2.5, 1.8, 1.1, 1.17], [1.6, 5.4]],
    ['壬寅 丙午 丁亥 丙午', [0.63, 4.15, 1.05, 0, 1.17], [4.78, 2.22]],
    ['丁未 壬寅 乙卯 癸未', [2.35, 1.55, 1.1, 0, 2], [4.35, 2.65]],
    ['丙辰 己亥 丁卯 癸卯', [2.82, 0.5, 1.3, 0, 2.38], [3.32, 3.68]],
    ['己巳 己巳 辛巳 壬辰', [0.3, 2.1, 2.45, 1.05, 1.1], [3.5, 3.5]],
  ];
  for (const [pillars, scores, totals] of examples) {
    const [year, month, day, hour] = pillars.split(' ');
    const balance = fateClearBaseBalance({ year, month, day, hour });
    assert.deepEqual(Object.values(balance.scores), scores, pillars);
    assert.deepEqual([balance.support, balance.restraint], totals, pillars);
  }
});

test('the Tong Guan shares reproduce both published examples and enforce the separate individual and total thresholds', () => {
  const weak = fateClearBaseBalance({ year: '辛丑', month: '乙未', day: '癸丑', hour: '癸丑' });
  assert.deepEqual([weak.support, weak.restraint], [2.5, 4.5]);
  assert.deepEqual(weak.tongGuan, { proportions: { 木: 15, 火: 7.5, 土: 33.8, 金: 9.4, 水: 34.4 },
    routes: [{ controlling: '土', controlled: '水', bridge: '金' }] });
  const strong = fateClearBaseBalance({ year: '己巳', month: '丁卯', day: '戊寅', hour: '己未' });
  assert.deepEqual([strong.support, strong.restraint], [4.15, 2.85]);
  assert.deepEqual(strong.tongGuan, { proportions: { 木: 33.8, 火: 23.8, 土: 40.6, 金: 1.9, 水: 0 },
    routes: [{ controlling: '木', controlled: '土', bridge: '火' }] });

  const chart = { year: '乙丑', month: '戊子', day: '戊申', hour: '丁巳' };
  const belowTotal = fateClearBaseBalance(chart).tongGuan;
  assert.deepEqual([belowTotal.proportions.土, belowTotal.proportions.水], [31.3, 30.6]);
  assert.deepEqual(belowTotal.routes, []);
  const exactlyThirty = fateClearBaseBalance({ ...chart, hour: '癸亥' }).tongGuan;
  assert.deepEqual([exactlyThirty.proportions.土, exactlyThirty.proportions.水], [30, 51.5]);
  assert.deepEqual(exactlyThirty.routes, [{ controlling: '土', controlled: '水', bridge: '金' }]);
  const belowSingle = fateClearBaseBalance({ year: '丙寅', month: '壬辰', day: '乙巳', hour: '己卯' }).tongGuan;
  assert.deepEqual([belowSingle.proportions.木, belowSingle.proportions.土], [36.3, 29.4]);
  assert.deepEqual(belowSingle.routes, []);
});

test('the two published Tong Guan readings yield distinct exact useful elements only at their verified birth', () => {
  const cases = [
    [withLongitude(archive(0, 1961, 7, 19, 2, 30)), 3, '辛卯', '金', '金'],
    [withLongitude(archive(1, 1989, 3, 19, 14, 15)), 4, '壬辰', '水', '火'],
  ];
  for (const [chart, month, pillar, useful, bridge] of cases) {
    const run = submit(chart, 'month', { year: 2026, month });
    validateFortuneFacts(run);
    const result = matched(run, 26);
    assert.equal(result.status, 'matched');
    const hits = run.facts.filter(row => result.sourceFactIds.includes(row.factId));
    assert.ok(hits.some(row => row.normalizedPayload.movingPillar === pillar));
    for (const { normalizedPayload: p } of hits) {
      assert.equal(p.sourceReading.useful, useful);
      assert.equal(p.direction.find(row => row.layer === 'monthly').stemDirection, 'useful');
      assert.deepEqual(p.baseBalance.tongGuan.routes.map(row => row.bridge), [bridge]);
    }
  }
  const shifted = withLongitude(archive(1, 1989, 3, 19, 14, 30));
  const run = submit(shifted, 'month', { year: 2026, month: 4 });
  assert.equal(matched(run, 26).status, 'not_matched');
  assert.ok(run.facts.filter(row => row.factType === 'fateclear_bazi_context')
    .every(row => row.normalizedPayload.sourceReading === undefined));
});

test('published neutrality and ordinary Tong Guan review do not meet the one-supportive one-adverse rule', () => {
  const exact = withLongitude(archive(1, 1989, 3, 19, 14, 15));
  const ordinary = withLongitude(archive(1, 1989, 3, 19, 14, 30));
  for (const [chart, expected, status] of [[exact, 'neutral', 'not_matched'], [ordinary, 'tong_guan_review', 'unknown']]) {
    const run = submit(chart, 'day', { date: '2026-11-15' });
    const facts = run.facts.filter(row => row.factType === 'fateclear_bazi_context');
    const fact = facts.find(row => row.normalizedPayload.movingPillar === '癸巳');
    assert.equal(fact.normalizedPayload.direction.find(row => row.layer === 'daily').mainDirection, expected);
    assert.equal(matched(run, 32).status, status);
    assert.ok(!matched(run, 32).sourceFactIds.includes(fact.factId));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'tong-guan-day'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, /木克土，占比分别为33\.8%和40\.6%，通关候选为火/u);
    assert.match(prompt, expected === 'neutral' ? /巳天干癸为用神，支本气丙为原例不喜不忌/u : /支本气丙为基础扶抑反向，因通关仍须复核喜忌/u);
    assert.doesNotMatch(prompt, /tong_guan_review|balanceProfile/u);
  }
  const unaffected = submit(ordinary, 'day', { date: '2026-11-14' });
  assert.equal(matched(unaffected, 32).status, 'partial');
  const neutralClash = submit(exact, 'day', { date: '2026-10-28' });
  const uncertainClash = submit(ordinary, 'day', { date: '2026-10-28' });
  assert.equal(matched(neutralClash, 34).status, 'matched');
  assert.equal(matched(uncertainClash, 34).status, 'matched');
  const clash = uncertainClash.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === '乙亥');
  assert.equal(clash.normalizedPayload.clashes.find(row => row.id === 'year').branchDirection, 'tong_guan_review');
  assert.equal(clash.normalizedPayload.yearClashReviewed, undefined);
});

test('month command overrides a lower support score unless a clash has no other root or the month makes a restraining group', () => {
  const cases = [
    [1, 13, 0, 3.45, 'strong', 'month-command', [], ['month'], undefined],
    [1, 6, 8, 3.3, 'weak', 'scores', ['day'], [], undefined],
    [1, 6, 16, 3.4, 'strong', 'month-command', ['day'], ['hour'], undefined],
    [1, 13, 18, 3.45, 'weak', 'scores', [], ['month'], { kind: '三合', branches: '巳酉丑', element: '金', positions: [['year'], ['hour'], ['month']] }],
    [7, 24, 10, 3.37, 'weak', 'scores', [], [], { kind: '三会', branches: '巳午未', element: '火', positions: [['hour'], ['year'], ['month']] }],
  ];
  for (const [month, day, hour, score, strength, basis, clashes, roots, group] of cases) {
    const b = fateClearBaseBalance(archive(1, 1990, month, day, hour).bazi.rawResult[0]);
    assert.equal(b.monthSupports, true);
    assert.deepEqual([b.support, b.strength, b.strengthBasis, b.monthClashPositions, b.rootColumns], [score, strength, basis, clashes, roots]);
    assert.deepEqual(b.restrainingMonthGroups, group ? [group] : []);
  }
});

test('the month clash exception and an actual outside root lead to opposite SQLite stem directions', () => {
  for (const [hour, direction, hits] of [[8, 'aligns_with_balance', true], [16, 'opposes_balance', false]]) {
    const chart = withLongitude(archive(1, 1990, 1, 6, hour));
    const run = submit(chart, 'day', { date: '2026-11-13' });
    validateFortuneFacts(run);
    const result = matched(run, 31);
    const fact = run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === '辛卯');
    assert.equal(fact.normalizedPayload.direction.find(row => row.layer === 'daily').stemDirection, direction);
    assert.equal(result.sourceFactIds.includes(fact.factId), hits);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'month-command-stem'));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, hits ? /月支受冲，月支以外无本气根，取消月令直接判强/u : /月支本气帮身，按来源月令优先判强/u);
  }
});

test('near equality gets a score direction and true equality uses the published case reading for its own birth only', () => {
  const fixedBeijingClock = chart => {
    const dated = withLongitude(chart);
    dated.birthContext.timeZone = 'Etc/GMT-8';
    return dated;
  };
  const cases = [
    [withLongitude(archive(0, 1973, 6, 13, 18, 30)), 3.62, 3.38, 'scores', 'strong', '身强'],
    [fixedBeijingClock(archive(1, 1989, 5, 21, 8, 0)), 3.5, 3.5, 'equal-scores', undefined, '中和'],
  ];
  for (const [chart, support, restraint, basis, strength, authorStrength] of cases) {
    const run = submit(chart, 'month', { year: 2026, month: 4 });
    const result = matched(run, 26);
    assert.equal(result.status, 'matched', authorStrength);
    const fact = run.facts.find(row => result.sourceFactIds.includes(row.factId) && row.normalizedPayload.movingPillar === '壬辰');
    assert.equal(fact.normalizedPayload.sourceReading.strength, authorStrength);
    const b = fact.normalizedPayload.baseBalance;
    assert.deepEqual([b.support, b.restraint, b.strengthBasis, b.strength], [support, restraint, basis, strength]);
    assert.equal(fact.normalizedPayload.sourceReading.useful, '水');
  }
  const otherBirth = fixedBeijingClock(archive(1, 1989, 5, 21, 8, 15));
  const run = submit(otherBirth, 'month', { year: 2026, month: 4 });
  assert.equal(matched(run, 26).status, 'unknown');
  const fact = run.facts.find(row => row.factType === 'fateclear_bazi_context');
  assert.equal(fact.normalizedPayload.baseBalance.strengthBasis, 'equal-scores');
  assert.equal(fact.normalizedPayload.sourceReading, undefined);
});

test('concentration, following and Jia/Ji candidates keep the score without a generic direction', () => {
  for (const [month, day, hour, review] of [[1, 12, 12, 'concentrated-elements'],
    [1, 17, 14, 'possible-following'], [7, 23, 0, 'possible-earth-transformation']]) {
    const chart = archive(1, 1990, month, day, hour);
    const balance = fateClearBaseBalance(chart.bazi.rawResult[0]);
    assert.ok(balance.review.includes(review));
    assert.equal(balance.strength, undefined);
    assert.equal(balance.aligned, undefined);
    assert.equal(balance.opposed, undefined);
  }
});

test('following review uses the actual dominant external element and preserves the published half-share case', () => {
  const published = archive(1, 1955, 3, 23, 14, 30).bazi.rawResult[0];
  assert.deepEqual([published.year, published.month, published.day, published.hour], ['乙未', '己卯', '癸未', '己未']);
  const half = fateClearBaseBalance(published);
  assert.deepEqual(half.scores, { '木': 2.75, '火': 0.75, '土': 3.5, '金': 0, '水': 0 });
  assert.deepEqual(half.review, ['possible-following']);
  assert.equal(half.strength, undefined);

  const chart = withLongitude(archive(1, 1990, 1, 8, 4));
  const month = submit(chart, 'month', { year: 2020, month: 3 });
  const day = submit(chart, 'day', { date: '2026-11-14' });
  const peer = submit(withLongitude(archive(1, 1990, 1, 17, 14)), 'month', { year: 2020, month: 3 });
  const find = (run, pillar) => run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === pillar);
  const clashMonth = find(month, '己卯'), dividedDay = find(day, '壬辰');
  for (const { normalizedPayload: p } of [clashMonth, dividedDay]) {
    assert.deepEqual(p.baseBalance.scores, { '木': 1.6, '火': 1.6, '土': 1.85, '金': 1.35, '水': 0.6 });
    assert.deepEqual(p.baseBalance.review, []);
    assert.equal(p.baseBalance.strength, 'weak');
    assert.equal(p.sourceReading, undefined);
  }
  assert.ok(clashMonth.normalizedPayload.monthDayClashReview.relatedNatalTrines.some(row => row.branches === '巳酉丑'));
  assert.equal(clashMonth.normalizedPayload.movingBranchDirection, 'opposes_balance');
  assert.deepEqual([dividedDay.normalizedPayload.dayStemAlignedByBalance, dividedDay.normalizedPayload.dayStemBranchOpposedByBalance], [true, true]);
  for (const [run, indices, fact] of [[month, [25, 27, 28], clashMonth], [day, [31, 32], dividedDay]]) {
    const rules = matchFortuneKnowledge(run).byMethod.bazi;
    for (const index of indices) {
      const result = rules.find(row => row.knowledgeId === fortuneKnowledge.bazi.rules[index].knowledgeId);
      assert.equal(result.status, index === 25 ? 'matched' : 'partial');
      assert.ok(result.sourceFactIds.includes(fact.factId));
    }
  }
  const realGroup = find(peer, '己卯').normalizedPayload;
  assert.equal(realGroup.baseBalance.scores.火, 3.27);
  assert.deepEqual(realGroup.baseBalance.review, ['possible-following']);
  assert.equal(matched(peer, 25).status, 'matched');
});

test('a dominant pair without the day element retains the ordinary Jie-month and true-solar day candidates', () => {
  const chart = withLongitude(archive(1, 1990, 1, 5, 0));
  const month = submit(chart, 'month', { year: 2030, month: 12 });
  const day = submit(chart, 'day', { date: '2026-11-10' });
  const find = (run, pillar) => run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === pillar);
  const adverseMonth = find(month, '丁亥'), clashMonth = find(month, '戊子');
  const dividedDay = find(day, '戊子'), nextDay = find(day, '己丑');
  for (const { normalizedPayload: p } of [adverseMonth, clashMonth, dividedDay, nextDay]) {
    assert.deepEqual([p.dayMaster, p.baseBalance.scores.金, p.baseBalance.scores.火, p.baseBalance.scores.水], ['庚', 0.15, 2.97, 3]);
    assert.deepEqual(p.baseBalance.review, []);
    assert.equal(p.baseBalance.strength, 'weak');
    assert.equal(p.sourceReading, undefined);
  }
  for (const [run, index, fact] of [[month, 25, adverseMonth], [month, 27, adverseMonth], [month, 28, clashMonth],
    [day, 31, dividedDay], [day, 32, dividedDay]]) {
    const result = matched(run, index);
    assert.equal(result.status, index === 25 ? 'matched' : 'partial');
    assert.ok(result.sourceFactIds.includes(fact.factId));
  }
  assert.equal(adverseMonth.normalizedPayload.yearAlignedMonthOpposedByBalance, true);
  assert.equal(clashMonth.normalizedPayload.movingBranchDirection, 'opposes_balance');
  assert.equal(clashMonth.normalizedPayload.monthDayClashReview.publishedIncomingDirection, undefined);
  assert.equal(dividedDay.normalizedPayload.dayStemBranchOpposedByBalance, true);
  assert.equal(nextDay.normalizedPayload.dayStemBranchOpposedByBalance, false);
  assert.ok(!matched(day, 32).sourceFactIds.includes(nextDay.factId));
});

test('a Jie-month midpoint stays fixed across the actual intra-month major-luck handoff', () => {
  const chart = withLongitude(archive(0, 1956, 6, 22, 2)), target = { year: 1971, month: 10 };
  const run = submit(chart, 'month', target);
  const cut = '1971-10-23T20:00:00.000Z';
  const rows = run.facts.filter(fact => fact.factType === 'fateclear_bazi_context' && fact.normalizedPayload.movingPillar === '戊戌');
  const before = rows.find(row => row.activeTo === cut), after = rows.find(row => row.activeFrom === cut);
  assert.ok(before && after);
  const rule = matched(run, 25);
  assert.equal(rule.status, 'matched');
  assert.equal(rule.matchedSourceExcerpt, '按節氣換月');
  assert.ok(rule.matchedConditions.some(line => /只确认历法与层序/u.test(line)));
  const expected = ['癸巳', '壬辰'];
  for (const [index, row] of [before, after].entries()) {
    const p = row.normalizedPayload;
    assert.equal(p.monthlyLayerOrderVerified, true);
    assert.equal(p.archiveLuckConfirmed, true);
    assert.equal(p.monthlyCalendarOnly, true);
    assert.ok(rule.sourceFactIds.includes(row.factId));
    assert.deepEqual(p.direction.map(layer => [layer.layer, layer.pillar]),
      [['annual', '辛亥'], ['monthly', '戊戌'], ['decadal', expected[index]]]);
    assert.deepEqual(p.jieMonth, before.normalizedPayload.jieMonth);
    const { start, end, midpoint, startTerm, endTerm, annualPillar, monthPillar } = p.jieMonth;
    assert.deepEqual([startTerm, endTerm, annualPillar, monthPillar], ['寒露', '立冬', '辛亥', '戊戌']);
    assert.equal(midpoint, start + Math.floor((end - start) / 2));
    assert.ok(start <= Date.parse(row.activeFrom) && Date.parse(row.activeTo) <= end);
    assert.ok(end > Date.parse(run.time.displayWindow.instantRange.endInstantExclusive));
  }
  const report = interpretFortune(run, requestForFortuneRun(run), 'fateclear-jie-month-audit');
  const { input } = buildFortuneModelContext(run, report);
  const audit = formatFortuneFactAudit(input);
  const message = formatFortunePrompt(input);
  assert.match(message, /只确认历法与层序，本命喜忌仍要核/u);
  assert.doesNotMatch(message, /monthlyCalendarOnly|monthlyLayerOrderVerified/u);
  for (const pillar of expected) {
    const sentence = '同段依次核大运' + pillar + '、流年辛亥、流月戊戌';
    assert.ok(audit.includes(sentence));
    assert.ok(!message.includes(sentence));
  }
  const unchecked = structuredClone(chart);
  unchecked.bazi.rawResult[0].luckPeriods = [];
  const unverifiedRun = submit(unchecked, 'month', target);
  const unverified = unverifiedRun.facts.filter(fact => fact.factType === 'fateclear_bazi_context');
  assert.ok(unverified.length && unverified.every(row => row.normalizedPayload.jieMonth && row.normalizedPayload.monthlyLayerOrderVerified === undefined));
  const unverifiedRule = matched(unverifiedRun, 25);
  assert.equal(unverifiedRule.status, 'unknown');
  assert.ok(!unverifiedRule.sourceFactIds.length);
});

test('an ordinary archive supplies both monthly candidate branches without supplying an exact useful element', () => {
  const chart = withLongitude(archive(1, 1986, 1, 25, 20, 0));
  const target = { year: 2032, month: 7 }, run = submit(chart, 'month', target);
  assert.deepEqual([25, 26, 27].map(index => matched(run, index).status), ['matched', 'not_matched', 'partial']);
  const result = matched(run, 27);
  const slices = run.facts.filter(fact => result.sourceFactIds.includes(fact.factId));
  assert.deepEqual(slices.map(row => [row.activeFrom, row.normalizedPayload.movingPillar]), [
    ['2032-06-30T16:00:00.000Z', '丙午'], ['2032-07-06T12:40:54.000Z', '丁未'],
  ]);
  for (const { normalizedPayload: p, sourceFactIds } of slices) {
    assert.deepEqual([p.baseBalance.support, p.baseBalance.restraint], [3.9, 3.1]);
    assert.equal(p.monthlyUsefulnessBasis, 'base-balance-candidate');
    assert.ok(p.yearAlignedMonthOpposedByBalance);
    assert.equal(p.monthStemAdverse, undefined);
    assert.equal(p.sourceReading, undefined);
    assert.ok(sourceFactIds.every(id => run.rawFacts.some(raw => raw.rawFactId === id)));
  }
  const withoutCoordinates = { ...chart, birthContext: undefined };
  const calendarOnly = submit(withoutCoordinates, 'month', target);
  const calendarMatch = matched(calendarOnly, 25);
  assert.equal(calendarMatch.status, 'matched');
  assert.ok(calendarOnly.facts.filter(row => calendarMatch.sourceFactIds.includes(row.factId)).every(({ normalizedPayload: p }) =>
    p.monthlyCalendarOnly && p.monthlyUsefulnessBasis === undefined && p.sourceReading === undefined));
  const unchecked = structuredClone(chart); delete unchecked.bazi.rawResult[0].luckPeriods;
  assert.equal(matched(submit(unchecked, 'month', target), 27).status, 'unknown');
  const weak = submit(withLongitude(archive(1, 1960, 11, 3, 22, 15)), 'month', { year: 2026, month: 3 });
  assert.equal(weak.facts.find(fact => fact.factType === 'fateclear_bazi_context').normalizedPayload.baseBalance.strength, 'weak');
  assert.equal(matched(weak, 25).status, 'matched');
});

test('ordinary true-solar day candidates distinguish the stem and main qi without claiming source-specific usefulness', () => {
  const chart = withLongitude(archive(1, 1986, 1, 25, 20, 0));
  const aligned = submit(chart, 'day', { date: '2026-11-12' });
  assert.equal(matched(aligned, 31).status, 'partial');
  assert.equal(matched(aligned, 32).status, 'unknown');
  assert.equal(matched(aligned, 35).status, 'not_matched');
  const divided = submit(chart, 'day', { date: '2026-11-09' });
  const result = matched(divided, 32);
  assert.equal(result.status, 'partial');
  assert.equal(matched(divided, 31).status, 'unknown');
  const fact = divided.facts.find(row => result.sourceFactIds.includes(row.factId));
  assert.equal(fact.normalizedPayload.clock, fateClearSolarDayPolicy);
  assert.equal(fact.normalizedPayload.dailyUsefulnessBasis, 'base-balance-candidate');
  assert.deepEqual([fact.normalizedPayload.dayStemSupportive, fact.normalizedPayload.dayStemBranchOpposed,
    fact.normalizedPayload.dayUsefulYearOther], [undefined, undefined, undefined]);
  assert.deepEqual(fact.normalizedPayload.direction.find(row => row.layer === 'daily'), { layer: 'daily', pillar: '丁亥',
    stem: '丁', stemElement: '火', stemDirection: 'opposes_balance', mainQi: '壬', mainElement: '水', mainDirection: 'aligns_with_balance' });
  const { input } = buildFortuneModelContext(divided, interpretFortune(divided, requestForFortuneRun(divided), 'balance-direction'));
  assert.ok(input.sections.every(section => section.findings.every(finding => finding.knowledgeId !== result.knowledgeId)));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /扶分3\.9，抑分3\.1，基础方向偏强/u);
  assert.match(prompt, /流日丁亥天干丁为基础扶抑反向候选，支本气壬为基础扶抑同向候选/u);
  assert.doesNotMatch(prompt, /baseBalance|opposes_balance|yearAlignedMonthOpposedByBalance|116\.4/u);
});

test('the published climate priority keeps ordinary contrary water out of month and day matches', () => {
  const chart = withLongitude(archive(1, 1987, 7, 26, 11));
  const month = submit(chart, 'month', { year: 2025, month: 6 });
  const day = submit(chart, 'day', { date: '2025-01-13' });
  const fact = run => run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === '壬午');
  const matchFor = (run, fact, passage) => matchFortuneKnowledge({ ...run, facts: [fact] }).byMethod.bazi
    .find(rule => rule.knowledgeId.endsWith(passage));
  const monthly = fact(month), daily = fact(day);
  assert.ok(monthly && daily);
  for (const [row, layer] of [[monthly, 'monthly'], [daily, 'daily']]) {
    const p = row.normalizedPayload;
    assert.equal(p.baseBalance.strength, 'weak');
    assert.equal(p.baseBalance.primaryClimate, '水');
    assert.ok(p.baseBalance.opposed.includes('水'));
    assert.equal(p.balanceClimateProfile, 'fateclear-published-primary-climate-v1');
    const moving = p.direction.find(entry => entry.layer === layer);
    assert.deepEqual([moving.stemDirection, moving.mainDirection], ['climate_review', 'aligns_with_balance']);
  }
  assert.deepEqual(monthly.normalizedPayload.direction.filter(entry => entry.layer === 'annual')
    .map(({ stemDirection, mainDirection }) => [stemDirection, mainDirection]), [['aligns_with_balance', 'aligns_with_balance']]);
  assert.deepEqual(monthly.normalizedPayload.annualCoreClashes, []);
  assert.deepEqual(monthly.normalizedPayload.annualCorePunishmentsAndHarms, []);
  assert.equal(matchFor(month, monthly, 'fate-month-v1-window-p002-002').status, 'unknown');
  assert.equal(matchFor(day, daily, 'fate-day-v1-branch-p001-001').status, 'unknown');
  const legacy = { ...daily, normalizedPayload: { ...daily.normalizedPayload, dayStemBranchOpposedByBalance: true,
    balanceClimateProfile: undefined } };
  assert.equal(matchFor(day, legacy, 'fate-day-v1-branch-p001-001').status, 'unknown');
  for (const [run, passage] of [
    [submit(chart, 'month', { year: 2025, month: 5 }), 'fate-month-v1-window-p002-002'],
    [submit(chart, 'day', { date: '2025-01-12' }), 'fate-day-v1-branch-p001-001'],
  ]) {
    const metal = run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === '辛巳');
    assert.ok(metal);
    assert.equal(matchFor(run, metal, passage).status, 'partial');
  }
  const { input } = buildFortuneModelContext(day, interpretFortune(day, requestForFortuneRun(day), 'published-climate'));
  assert.match(formatFortuneFactAudit(input), /主调候为水|因来源所列主调候仍须复核喜忌/u);
  assert.doesNotMatch(formatFortunePrompt(input), /主调候为水|climate_review/u);
});

test('the same verified solar birth in the climate article retains its published useful element', () => {
  for (const [gender, y, m, d, hour, minute, useful, supportive, primaryClimate] of [
    [0, 1966, 1, 9, 7, 0, '火', ['土'], '火'],
    [1, 1978, 7, 23, 5, 15, '金', ['水', '土'], '水'],
  ]) {
    const run = submit(withLongitude(archive(gender, y, m, d, hour, minute)), 'month', { year: 2025, month: 6 });
    const fact = run.facts.find(row => row.factType === 'fateclear_bazi_context');
    const p = fact.normalizedPayload;
    assert.equal(p.monthlyUsefulnessBasis, 'published-natal-reading');
    assert.deepEqual([p.sourceReading.useful, p.sourceReading.supportive, p.baseBalance.primaryClimate], [useful, supportive, primaryClimate]);
  }
});

test('a verified Jia/Ji transformation applies the monthly adverse stem only with a checked favourable year', () => {
  const chart = withLongitude(archive(1, 1993, 7, 12, 12, 30));
  const run = submit(chart, 'month', { year: 2027, month: 4 });
  validateFortuneFacts(run);
  const cut = '2027-04-05T00:17:31.000Z';
  const earlier = run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.activeTo === cut);
  const later = run.facts.find(row => row.factType === 'fateclear_bazi_context' && row.activeFrom === cut);
  assert.deepEqual([earlier.normalizedPayload.movingPillar, later.normalizedPayload.movingPillar], ['癸卯', '甲辰']);
  assert.deepEqual(later.normalizedPayload.direction.filter(row => row.layer === 'annual')
    .map(({ pillar, stemDirection, mainDirection }) => [pillar, stemDirection, mainDirection]), [['丁未', 'supportive', 'useful']]);
  assert.equal(later.normalizedPayload.monthlyUsefulnessBasis, 'calculated-earth-transformation');
  const hit = matched(run, 27);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.sourceFactIds, [later.factId]);
  assert.deepEqual(hit.windows, [{ start: cut, endExclusive: later.activeTo }]);
  const conflict = submit(chart, 'month', { year: 2026, month: 7 });
  const checked = conflict.facts.filter(row => row.factType === 'fateclear_bazi_context');
  assert.ok(checked.length);
  assert.ok(checked.every(({ normalizedPayload: p }) => p.monthStemAdverse === true && p.yearFavourableCandidate === undefined
    && p.annualCorePunishmentsAndHarms.some(row => row.id === 'day' && row.kind === '相刑')));
  assert.notEqual(matched(conflict, 27).status, 'matched');
  const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'earth-month-adverse')).input;
  assert.match(formatFortuneFactAudit(input), /流月甲辰天干甲为推算的忌神候选/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /按作者公开的甲己化土条件核同一本命的用土/u);
  assert.doesNotMatch(prompt, /流月甲辰天干甲|yearFavourableCandidate/u);
});

test('a calculated Jia/Ji month clash verifies either the absence of a natal combination or a specific adjacent partner', () => {
  const cases = [
    [[1, 1993, 7, 27, 20, 30], { year: 2027, month: 3 }, '2027-03-05T19:39:33.000Z', '癸卯', 'adverse', null],
    [[1, 1989, 10, 26, 12, 30], { year: 2027, month: 1 }, '2027-01-05T14:09:58.000Z', '辛丑', 'useful', '未午'],
  ];
  for (const [birth, target, cut, pillar, direction, adjacent] of cases) {
    const run = submit(withLongitude(archive(...birth)), 'month', target);
    validateFortuneFacts(run);
    const hit = matched(run, 28);
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.windows, [{ start: cut, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
    const facts = run.facts.filter(row => hit.sourceFactIds.includes(row.factId));
    assert.ok(facts.length > 0);
    for (const { normalizedPayload: p } of facts) {
      assert.deepEqual([p.movingPillar, p.publishedMonthDayClashReviewed, p.calculatedEarthMonthDayClashReviewed,
        p.monthDayClashReview.calculatedEarthIncomingDirection, p.monthDayClashNoNatalCombination],
      [pillar, undefined, true, direction, adjacent === null]);
      assert.equal(p.monthDayClashReview.calculatedEarthAdjacentCombination?.values ?? null, adjacent);
    }
    const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'earth-month-clash')).input;
    assert.match(formatFortuneFactAudit(input), /来支喜忌按同盘化土条件核为/u);
    if (adjacent) assert.match(formatFortuneFactAudit(input), /原局相邻时支未午六合/u);
    assert.doesNotMatch(formatFortunePrompt(input), /来支喜忌按同盘|calculatedEarthMonthDayClashReviewed/u);
  }
  const chart = withLongitude(archive(1, 1989, 10, 26, 12, 30));
  const counter = submit(chart, 'month', { year: 2022, month: 1 });
  const facts = counter.facts.filter(row => row.factType === 'fateclear_bazi_context'
    && row.normalizedPayload.movingPillar === '辛丑');
  assert.ok(facts.length > 0 && facts.every(({ normalizedPayload: p }) =>
    p.calculatedEarthMonthDayClashReviewed === true && p.calculatedEarthMonthDayClashAdjacentCombination === undefined));
  assert.equal(matched(counter, 28).status, 'partial');
});

test('the published Jia/Ji earth branch supplies a specific useful element for a newly calculated chart and rejects wood outside the pair', () => {
  const chart = withLongitude(archive(1, 1993, 7, 12, 12, 30));
  const month = { year: 2026, month: 10 }, monthly = submit(chart, 'month', month);
  const result = matched(monthly, 26);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: '2026-10-08T06:29:17.000Z', endExclusive: '2026-10-31T16:00:00.000Z' }]);
  const readingOrder = matched(monthly, 25);
  assert.equal(readingOrder.status, 'matched');
  assert.equal(readingOrder.matchedSourceExcerpt, '按節氣換月');
  const orderedFacts = monthly.facts.filter(row => readingOrder.sourceFactIds.includes(row.factId));
  assert.deepEqual(orderedFacts.map(({ activeFrom, normalizedPayload: p }) => [activeFrom, p.movingPillar]), [
    ['2026-09-30T16:00:00.000Z', '丁酉'], ['2026-10-08T06:29:17.000Z', '戊戌'],
  ]);
  assert.ok(orderedFacts.every(({ normalizedPayload: p }) => p.monthlyLayerOrderVerified && p.archiveLuckConfirmed
    && p.monthlyUsefulnessBasis === 'calculated-earth-transformation' && p.publishedReadingVerified === undefined
    && p.monthlyCalendarOnly === false));
  assert.deepEqual(readingOrder.windows, [{ start: orderedFacts[0].activeFrom, endExclusive: orderedFacts[1].activeTo }]);
  const fact = monthly.facts.find(row => result.sourceFactIds.includes(row.factId));
  assert.deepEqual(fact.normalizedPayload.sourceReading, { strength: '化土格', useful: '土', supportive: ['火', '金'], adverse: ['木'],
    earthTransformation: { pair: '己甲', partner: 'month', monthBranch: '未' } });
  assert.equal(fact.normalizedPayload.monthlyUsefulnessBasis, 'calculated-earth-transformation');
  assert.equal(fact.normalizedPayload.balanceDirectionReady, false);
  const daily = submit(chart, 'day', { date: '2026-11-10' });
  const dailyFacts = daily.facts.filter(row => row.factType === 'fateclear_bazi_context');
  assert.ok(dailyFacts.length > 0);
  for (const { normalizedPayload: p } of dailyFacts) {
    assert.equal(p.dailyUsefulnessBasis, 'calculated-earth-transformation');
    assert.equal(p.sourceReading.useful, '土');
    assert.deepEqual([p.dayStemSupportive, p.dayStemBranchOpposed, p.dayUsefulYearOther], [undefined, undefined, undefined]);
  }
  const supportive = dailyFacts.find(row => row.normalizedPayload.movingPillar === '戊子');
  assert.equal(supportive.normalizedPayload.calculatedEarthDayStemSupportive, true);
  assert.equal(supportive.normalizedPayload.calculatedEarthDayStemBranchOpposed, false);
  const supportiveResult = matched(daily, 31);
  assert.equal(supportiveResult.status, 'matched');
  assert.equal(supportiveResult.matchedSourceExcerpt, '流日天干若是喜用');
  assert.match(supportiveResult.matchedConditions[0], /真太阳时二十三时切换.*用土、喜火和金、忌木/u);
  assert.ok(supportiveResult.sourceFactIds.includes(supportive.factId));
  assert.ok(!matched(daily, 32).sourceFactIds.includes(supportive.factId));
  assert.equal(matched(daily, 35).status, 'not_matched');
  const dividedDay = { date: '2026-11-13' };
  const divided = submit(chart, 'day', dividedDay);
  const opposing = divided.facts.find(row => row.factType === 'fateclear_bazi_context' && row.normalizedPayload.movingPillar === '辛卯');
  assert.equal(opposing.normalizedPayload.calculatedEarthDayStemBranchOpposed, true);
  assert.deepEqual(opposing.normalizedPayload.direction.filter(row => row.layer === 'daily').map(({ stemDirection, mainDirection }) =>
    [stemDirection, mainDirection]), [['supportive', 'adverse']]);
  const dividedResult = matched(divided, 32);
  assert.equal(dividedResult.status, 'matched');
  assert.equal(dividedResult.matchedSourceExcerpt, '地支管底盤承接');
  assert.ok(dividedResult.sourceFactIds.includes(opposing.factId));
  assert.deepEqual(dividedResult.windows, [{ start: opposing.activeFrom, endExclusive: opposing.activeTo }]);
  assert.ok(divided.facts.some(row => row.factType === 'fateclear_bazi_context' && row.activeFrom === opposing.activeTo
    && !dividedResult.sourceFactIds.includes(row.factId)));
  const woodChart = withLongitude(archive(1, 1993, 7, 12, 4, 30));
  const wood = submit(woodChart, 'month', month);
  assert.equal(matched(wood, 26).status, 'not_matched');
  assert.equal(matched(wood, 25).status, 'matched');
  assert.ok(wood.facts.filter(row => row.factType === 'fateclear_bazi_context').every(row => row.normalizedPayload.sourceReading === undefined));
  const ordinaryDay = submit(woodChart, 'day', dividedDay);
  assert.ok(ordinaryDay.facts.filter(row => row.factType === 'fateclear_bazi_context').every(row =>
    row.normalizedPayload.calculatedEarthDayStemSupportive === undefined && row.normalizedPayload.calculatedEarthDayStemBranchOpposed === undefined));
  assert.notEqual(matched(ordinaryDay, 31).status, 'matched');
  assert.notEqual(matched(ordinaryDay, 32).status, 'matched');
  const { input } = buildFortuneModelContext(monthly, interpretFortune(monthly, requestForFortuneRun(monthly), 'earth-source-branch'));
  assert.match(formatFortuneFactAudit(input), /按程序复算化土候选，日干与月柱合为己甲，月支为未，取化土格、用土、喜火、金、忌木/u);
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === readingOrder.knowledgeId);
  assert.deepEqual(finding?.windows, readingOrder.windows);
  const monthlyPrompt = formatFortunePrompt(input);
  assert.match(monthlyPrompt, /按作者公开的甲己化土条件.*先核同段实际大运和流年.*整节气月的中点核流月/u);
  assert.doesNotMatch(monthlyPrompt, /monthlyUsefulnessBasis|monthlyLayerOrderVerified|普通命盘只核基础扶抑候选/u);
  const dailyInput = buildFortuneModelContext(divided, interpretFortune(divided, requestForFortuneRun(divided), 'earth-day-branch')).input;
  assert.match(formatFortuneFactAudit(dailyInput), /流日辛卯天干辛为推算的喜神候选，支本气乙为推算的忌神候选/u);
  const dailyPrompt = formatFortunePrompt(dailyInput);
  assert.match(dailyPrompt, /地支管底盤承接/u);
  assert.doesNotMatch(dailyPrompt, /流日辛卯天干辛为推算的喜神候选|calculatedEarthDayStemBranchOpposed/u);
});
