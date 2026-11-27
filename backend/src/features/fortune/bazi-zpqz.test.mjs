import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Lunar, Solar } from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
const { baziZpqzLuckContext } = await import('./control/bazi-zpqz.ts');
const { baziZpqzMovingRelations } = await import('./control/bazi-zpqz-relations.ts');
const { buildBaZiCalculation } = await import('./control/bazi-calculation.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');

const native = { year: '辛酉', month: '己亥', day: '壬子', hour: '己酉' };
const group = (p, value) => p.groupWitnesses.find(row => row.values === value);
const numbered = (rows, n) => rows.find(row => row.knowledgeId.includes('zpqz-1936-interpretation-p' + String(n).padStart(3, '0') + '-'));
function archive(date = [1990, 11, 13], gender = 0, hour = 18) {
  const [year, month, day] = date, lunar = Solar.fromYmdHms(year, month, day, hour, 0, 0).getLunar();
  const luckPeriods = lunar.getEightChar().getYun(gender, 2).getDaYun(11).slice(1)
    .map(stage => ({ ganZhi: stage.getGanZhi(), startAge: stage.getStartAge(), endAge: stage.getEndAge() }));
  return { timeKnown: true,
    bazi: { engineName: 'lunar-javascript', engineVersion: '1.7.8', rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1',
      rawResult: [{ utc: new Date(Date.UTC(year, month - 1, day, hour - 8)).toISOString(),
        year: lunar.getYearInGanZhiExact(), month: lunar.getMonthInGanZhiExact(), day: lunar.getDayInGanZhiExact(),
        hour: lunar.getTimeInGanZhi(), luckPeriods, tenGods: {}, shenSha: {} }] },
    ziwei: { rawResult: [] }, western: { rawResult: [] } };
}
function calculate(chart = archive(), year = 2026) {
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const time = buildFactTimeContext(input, Date.parse(year + '-11-18T02:00:00Z'), 'server');
  return calculateFortuneFacts(input, time, 'zpqz-test', { snapshotId: 'zpqz-test-chart', chart });
}

function submitZpqzLuck(date, hour, year, gender = 0) {
  const chart = archive(date, gender, hour);
  chart.birthContext = { birthInstant: chart.bazi.rawResult[0].utc, precision: 'minute', latitude: 39.9042, longitude: 116.4074,
    timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const ref = { snapshotId: 'zpqz-luck-' + date.join('-') + '-' + hour }, at = Date.UTC(year, 10, 19, 2);
  const body = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, at, { ...ref, chart })));
  const run = bindClientFortuneRun(params, body, readClientFactTime(params, body, at), ref.snapshotId, ref);
  validateFortuneFacts(run);
  return run;
}

test('hidden-stem exposure retains its original branch and distinguishes previous exposure and the day master', () => {
  const natal = { year: '癸亥', month: '丙寅', day: '乙亥', hour: '甲申' };
  const p = baziZpqzLuckContext(natal, true, '甲子');
  const jia = p.hiddenActivations.filter(row => row.stem === '甲');
  assert.deepEqual(jia.map(row => row.position), ['year', 'month', 'day']);
  assert.ok(jia.every(row => row.luckStemSame && !row.newlyExposedByLuck));
  assert.ok(jia.every(row => row.natalExposurePositions.join() === 'hour'));
  const absent = baziZpqzLuckContext({ ...natal, hour: '戊午' }, true, '甲子');
  assert.equal(absent.hasNewlyExposedStem, true);
  assert.ok(absent.hiddenActivations.filter(row => row.stem === '甲').every(row => row.newlyExposedByLuck));
  const self = baziZpqzLuckContext({ ...natal, day: '甲子', hour: '戊午' }, true, '甲子');
  assert.equal(self.hasNewlyExposedStem, false);
});

test('source roles keep Hai Ren lu and Jia birth roots distinct from same-element roots and Yin Chen qi order', () => {
  const p = baziZpqzLuckContext({ year: '壬亥', month: '甲寅', day: '戊辰', hour: '乙卯' }, true, '甲午');
  const hai = p.hiddenActivations.filter(row => row.branch === '亥');
  assert.deepEqual(hai.map(row => [row.stem, row.sourceRole]), [['壬', '壬禄之根'], ['甲', '甲长生之根']]);
  assert.deepEqual(p.hiddenActivations.filter(row => row.branch === '寅').map(row => row.sourceRole), ['当旺之气', '方生之气', '寄生之气']);
  assert.deepEqual(p.hiddenActivations.filter(row => row.branch === '辰').map(row => row.sourceRole), ['土之本气', '春之余气', '水之墓']);
  const roots = p.rootWitnesses.find(row => row.stem === '甲').roots;
  assert.equal(roots.find(row => row.branch === '亥').exactStem, true);
  assert.equal(roots.find(row => row.branch === '卯').exactStem, false);
  assert.equal(roots.find(row => row.branch === '辰').sourceRole, undefined);
  assert.equal(p.strength, undefined);
});

test('three-branch members retain duplicate positions, missing members and already complete versus luck-completed groups', () => {
  const partial = baziZpqzLuckContext(native, true, '乙未');
  assert.deepEqual(group(partial, '亥卯未').missingBranches, ['卯']);
  assert.equal(partial.woodComplete, false); assert.equal(partial.jiAtWei, true);
  const completed = baziZpqzLuckContext({ ...native, day: '壬卯' }, true, '乙未');
  assert.equal(group(completed, '亥卯未').completedByLuck, true);
  const existing = baziZpqzLuckContext({ ...native, day: '壬卯', hour: '己未' }, true, '乙未');
  assert.equal(group(existing, '亥卯未').complete, true);
  assert.equal(group(existing, '亥卯未').nativeComplete, true);
  assert.equal(group(existing, '亥卯未').completedByLuck, false);
  const repeated = baziZpqzLuckContext({ ...native, year: '己亥' }, true, '乙未');
  assert.deepEqual(group(repeated, '亥卯未').members[0].natalPositions, ['year', 'month']);
  assert.equal(group(repeated, '亥卯未').complete, false);
});

test('Yin Hai combination and Shen You clashes are actual member pairs rather than automatic transformation or rescue', () => {
  const yin = baziZpqzLuckContext({ ...native, year: '庚申' }, true, '甲寅');
  assert.ok(yin.luckPairs.some(row => row.kind === '六合' && row.members.map(m => m.branch).join() === '亥,寅'));
  assert.ok(yin.luckPairs.some(row => row.kind === '六冲' && row.members.map(m => m.branch).join() === '申,寅'));
  assert.equal(yin.groupWitnesses.some(row => row.complete), false);
  const mao = baziZpqzLuckContext(native, true, '乙卯');
  assert.deepEqual(mao.luckPairs.filter(row => row.kind === '六冲').map(row => row.members[0].position), ['year', 'hour']);
  assert.equal(mao.rescued, undefined); assert.equal(mao.transformed, undefined);
});

test('an unknown hour is excluded and cannot prove whole-chart absence, first exposure or missing group members', () => {
  const natal = { year: '癸亥', month: '丙寅', day: '乙亥', hour: '甲未' };
  const p = baziZpqzLuckContext(natal, false, '甲卯');
  assert.ok(!JSON.stringify(p).includes('hour'));
  assert.equal(p.hasNewlyExposedStem, undefined);
  assert.equal(p.woodComplete, undefined); assert.equal(p.woodMissingBranches, undefined);
  assert.equal(group(p, '亥卯未').complete, undefined);
  assert.ok(p.hiddenActivations.filter(row => row.stem === '甲').every(row => row.newlyExposedByLuck === undefined));
});

test('real Ren Hai charts reach the source method, while Hai Mao Wei full membership excludes the empty-pair branch', () => {
  const female = calculate(); validateFortuneFacts(female);
  const p = female.facts.find(row => row.factType === 'zpqz_luck_context').normalizedPayload;
  assert.equal(p.luckPillar, '癸未'); assert.deepEqual(p.woodMissingBranches, ['卯']);
  assert.ok(female.facts.filter(row => row.factType === 'zpqz_luck_context').every(row => row.completeness === 'complete'));
  const matches = matchFortuneKnowledge(female).byMethod.bazi;
  assert.equal(numbered(matches, 44).status, 'matched');
  assert.equal(numbered(matches, 43).status, 'not_matched');
  assert.equal(numbered(matchFortuneKnowledge(calculate(archive([1990, 11, 13], 1))).byMethod.bazi, 43).status, 'partial');
  const full = calculate(archive([1987, 11, 9], 1));
  assert.ok(full.facts.some(row => row.factType === 'zpqz_luck_context' && row.normalizedPayload.woodComplete));
  assert.equal(numbered(matchFortuneKnowledge(full).byMethod.bazi, 44).status, 'not_matched');
});

test('client Ren Hai facts separate Yin-Hai joining, Mao meetings and the exact seal return pairs in SQLite', () => {
  const cases = [
    [[1975, 11, 12], 18, 2004, '庚寅', [], true],
    [[1975, 11, 22], 18, 2002, '庚寅', [['day', '申']], false],
    [[1975, 11, 12], 18, 2016, '辛卯', [['hour', '酉']], false],
    [[1976, 11, 16], 4, 2051, '辛卯', [], true],
    [[1976, 11, 16], 14, 2051, '辛卯', [], true],
    [[1979, 11, 11], 6, 2020, '己卯', [], true],
  ];
  for (const [date, hour, year, pillar, returnPositions, positive] of cases) {
    const run = submitZpqzLuck(date, hour, year);
    const fact = run.facts.find(row => row.factType === 'zpqz_luck_context'
      && row.normalizedPayload.luckPillar === pillar && row.normalizedPayload.confirmed);
    assert.ok(fact, date.join('-'));
    const data = fact.normalizedPayload;
    assert.deepEqual(data.sealReturnPairs.flatMap(row => row.members.filter(member => member.position !== 'decadal')
      .map(member => [member.position, member.branch])), returnPositions);
    const moving = run.facts.find(row => row.factType === 'zpqz_moving_relations' && row.activeFrom === fact.activeFrom
      && row.normalizedPayload.luckPillar === pillar);
    assert.equal(moving.normalizedPayload.hasMatchingSealReturnClash, data.hasMatchingSealReturnClash);
    assert.equal(moving.normalizedPayload.renHaiOfficerRoute, data.renHaiOfficerRoute);
    const returnContacts = moving.normalizedPayload.renHaiReturnContacts;
    const yinLuck = pillar[1] === '寅';
    assert.deepEqual(returnContacts.map(({ seal, output }) => [seal.position, seal.stem, seal.tenGod, output.pillar, output.stem, output.tenGod]),
      returnPositions.map(([position]) => yinLuck ? [position, '庚', '偏印', pillar, '甲', '食神']
        : [position, '辛', '正印', pillar, '乙', '伤官']));
    assert.ok(returnContacts.every(({ seal, output, monthLu }) => monthLu.position === 'month' && monthLu.branch === '亥'
      && (yinLuck ? seal.branch === '申' && output.branch === '寅' : seal.branch === '酉' && output.branch === '卯')));
    const context = data.renHaiOfficerContext;
    assert.deepEqual([context.monthLu.position, context.monthLu.branch], ['month', '亥']);
    const officerPosition = { 1975: 'hour', 1976: 'month', 1979: 'year' }[date[0]];
    assert.deepEqual(context.jiOfficers.map(row => [row.position, row.pillar[0]]), [[officerPosition, '己']]);
    const wood = context.woodContacts.map(row => [row.position, row.stem, row.tenGod]);
    if (pillar[1] === '寅') {
      assert.equal(data.renHaiOfficerRoute, 'yin-hai');
      assert.deepEqual(wood, [['month', '甲', '食神'], ['decadal', '甲', '食神']]);
    } else {
      assert.equal(data.renHaiOfficerRoute, 'mao-hai');
      assert.ok(wood.some(row => row.join() === 'decadal,乙,伤官'));
      assert.ok(wood.some(row => row.join() === 'month,甲,食神'));
      if (hour === 4) assert.ok(!wood.some(([position]) => position === 'hour'));
    }
    const matches = matchFortuneKnowledge(run).byMethod.bazi;
    assert.equal(numbered(matches, 43).status, positive ? 'partial' : 'not_matched');
    const returnMatch = numbered(matches, 47);
    assert.equal(returnMatch.status, positive ? 'not_matched' : 'matched');
    assert.equal(returnMatch.sourceFactIds.includes(moving.factId), !positive);
    assert.equal(numbered(matches, 43).sourceFactIds.includes(fact.factId), positive);
    if (pillar === '庚寅') assert.ok(data.yinLuckJoinsMonthHai);
    if (year === 2004) {
      const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === pillar);
      assert.equal(numbered(matches, 43).windows[0].start, transition.exactInstant);
      assert.equal(moving.normalizedPayload.annualBranch, '申');
    }
    if (year === 2051) assert.equal(data.woodCompletedByLuck, hour === 14);
    if (year === 2020) assert.equal(group(data, '亥卯未').nativeComplete, true);
    if (!positive) {
      assert.match(describeFortuneFact({ method: 'bazi', type: fact.factType, data }, String), /同一步运见对应回冲/u);
      const report = interpretFortune(run, requestForFortuneRun(run), 'hai-return-contact');
      const { input } = buildFortuneModelContext(run, report);
      const prompt = formatFortuneFactAudit(input);
      assert.ok(prompt.includes(yinLuck ? '庚金克甲木的五行方向' : '辛金克乙木的五行方向'));
      assert.doesNotMatch(prompt, /renHaiReturnContacts/u);
    }
  }
});

test('Wei luck distinguishes an absent Mao from completing or repeating a natal wood group', () => {
  const cases = [
    [[1975, 11, 12], 18, 2056, '乙未', true, false, false],
    [[1976, 11, 26], 6, 2015, '乙未', true, false, false],
    [[1976, 11, 16], 18, 2011, '乙未', false, true, true],
    [[1976, 11, 16], 2, 2011, '乙未', false, true, true],
    [[1979, 11, 11], 6, 2060, '癸未', false, false, false],
  ];
  for (const [date, hour, year, pillar, completes, hollow, hollowWithSeal] of cases) {
    const run = submitZpqzLuck(date, hour, year), matches = matchFortuneKnowledge(run).byMethod.bazi;
    const fact = run.facts.find(row => row.factType === 'zpqz_luck_context' && row.normalizedPayload.luckPillar === pillar);
    const data = fact.normalizedPayload;
    assert.equal(data.woodCompletedByLuck, completes);
    assert.deepEqual(data.woodMissingBranches, hollow ? ['卯'] : []);
    assert.equal(data.renHaiOfficerRoute, completes ? 'wei-completes' : hollow ? 'wei-incomplete' : 'wei-native-complete');
    const { officerRoots, woodContacts, weiHollow } = data.renHaiOfficerContext;
    assert.deepEqual(officerRoots.find(row => row.position === 'decadal'), { position: 'decadal', pillar, branch: '未', mainQi: true });
    assert.ok(woodContacts.some(row => row.position === 'decadal' && row.stem === '乙' && row.tenGod === '伤官'));
    if (hollow) {
      assert.deepEqual(officerRoots.filter(row => row.position !== 'decadal').map(row => [row.position, row.pillar]),
        hour === 2 ? [['hour', '辛丑']] : []);
      assert.deepEqual(weiHollow.pair.map(row => [row.position, row.branch]), [['month', '亥'], ['decadal', '未']]);
      assert.equal(weiHollow.missingBranch, '卯');
      assert.deepEqual([weiHollow.monthRoot.stem, weiHollow.incomingOfficerRoot.stem, weiHollow.incomingOfficerRoot.tenGod],
        ['壬', '己', '正官']);
    } else assert.equal(weiHollow, undefined);
    assert.equal(numbered(matches, 43).status, completes ? 'partial' : 'not_matched');
    assert.equal(numbered(matches, 44).status, hollow ? 'matched' : 'not_matched');
    assert.equal(numbered(matches, 47).status, 'not_matched');
    const moving = run.facts.find(row => row.factType === 'zpqz_moving_relations' && row.activeFrom === fact.activeFrom
      && row.normalizedPayload.luckPillar === pillar);
    assert.equal(moving.normalizedPayload.hasMatchingSealReturnClash, false);
    assert.deepEqual(moving.normalizedPayload.renHaiReturnContacts, []);
    if (hollowWithSeal) assert.ok(moving.normalizedPayload.natalBranches.some(branch => ['申', '酉'].includes(branch)));
    if (hollow) assert.ok(run.facts.some(row => row.factType === 'zpqz_moving_relations' && row.normalizedPayload.annualBranch === '卯'));
    if (completes || hollow) {
      const report = interpretFortune(run, requestForFortuneRun(run), 'hai-wood-case');
      const { input } = buildFortuneModelContext(run, report), prompt = formatFortuneFactAudit(input);
      assert.ok(prompt.includes('本步大运' + pillar + '以己为本气，是同干己官根位'));
      assert.match(prompt, /藏乙伤官，五行方向为乙木克己土/u);
      assert.doesNotMatch(prompt, /woodCompletedByLuck|sealReturnPairs|renHaiOfficerContext/u);
      if (completes) {
        assert.match(prompt, /本步未运补齐亥卯未，是正文的会局候选/u);
        assert.doesNotMatch(prompt, /原局缺卯，列作评注虚会候选/u);
      } else {
        assert.match(prompt, /该段亥未见位而缺卯，未中己的根位和乙伤官藏气分别留证/u);
        if (hour === 2) assert.match(prompt, /本命时柱辛丑以己为本气，是同干己官根位/u);
      }
      assert.ok(input.sections.every(section => !section.findings.some(row => row.knowledgeId === numbered(matches, 43).knowledgeId)));
    }
  }
});

test('p043 confirms actual Mao completing the wood positions and stops short of assigning the five-year effect', () => {
  const date = [1976, 11, 16], run = submitZpqzLuck(date, 14, 2013, 1);
  const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸卯');
  assert.equal(transition?.exactInstant, '2013-10-14T14:00:00.000Z');
  const candidate = run.facts.find(row => row.factType === 'zpqz_luck_context'
    && row.activeFrom === transition.exactInstant && row.normalizedPayload.luckPillar === '癸卯');
  assert.equal(candidate.normalizedPayload.renHaiMaoWoodContact, true);
  assert.deepEqual(candidate.normalizedPayload.renHaiOfficerContext.jiOfficers.map(row => row.pillar), ['己亥']);
  assert.deepEqual(group(candidate.normalizedPayload, '亥卯未').members.map(row => [row.branch, row.natalPositions, row.luckPresent]),
    [['亥', ['month'], false], ['卯', [], true], ['未', ['hour'], false]]);
  assert.equal(candidate.normalizedPayload.effectTiming, 'source-five-year-unresolved');
  const hit = numbered(matchFortuneKnowledge(run).byMethod.bazi, 43);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '運逢寅卯');
  assert.deepEqual(hit.windows, [{ start: candidate.activeFrom, endExclusive: candidate.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ren-hai-completed-at-mao'));
  assert.match(formatFortunePrompt(input), /真实卯运补齐原局亥、未的三合支位/u);
  assert.doesNotMatch(formatFortunePrompt(input), /為建祿化傷|renHaiMaoWoodContact/u);
  for (const [hour, year, gender] of [[4, 2013, 1], [14, 2051, 0]]) {
    const other = submitZpqzLuck(date, hour, year, gender);
    assert.equal(numbered(matchFortuneKnowledge(other).byMethod.bazi, 43).status, 'partial');
  }
});

test('p043 confirms the source Yin–Hai pair and its actual hidden Jia without declaring transformation', () => {
  const date = [1975, 11, 12], run = submitZpqzLuck(date, 18, 2057, 1);
  const boundary = '2057-04-27T06:00:00.000Z';
  const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊寅');
  assert.equal(change?.exactInstant, boundary);
  const facts = run.facts.filter(row => row.factType === 'zpqz_luck_context');
  const previous = facts.find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '己卯');
  const current = facts.find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '戊寅');
  assert.ok(previous && current);
  const data = current.normalizedPayload;
  assert.equal(previous.normalizedPayload.renHaiYinWoodContact, false);
  assert.equal(previous.normalizedPayload.hasMatchingSealReturnClash, true);
  assert.equal(data.renHaiYinWoodContact, true);
  assert.equal(data.renHaiMaoWoodContact, false);
  assert.equal(data.effectTiming, 'source-five-year-unresolved');
  assert.deepEqual(data.renHaiOfficerContext.jiOfficers.map(row => [row.position, row.pillar]), [['hour', '己酉']]);
  assert.deepEqual(data.renHaiOfficerContext.woodContacts.map(row => [row.position, row.pillar, row.stem, row.tenGod]),
    [['month', '丁亥', '甲', '食神'], ['decadal', '戊寅', '甲', '食神']]);
  assert.deepEqual(data.luckPairs.filter(row => row.members.some(member => member.position === 'month')).map(row => row.kind), ['六合', '六破']);
  const hit = numbered(matchFortuneKnowledge(run).byMethod.bazi, 43);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '運逢寅卯');
  assert.deepEqual(hit.windows, [{ start: current.activeFrom, endExclusive: current.activeTo }]);
  assert.ok(hit.sourceFactIds.includes(current.factId) && !hit.sourceFactIds.includes(previous.factId));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ren-hai-combination-at-yin'));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /实际寅运.*月亥六合/u);
  assert.match(prompt, /寅的本气甲食神/u);
  assert.doesNotMatch(prompt, /為建祿化傷|renHaiYinWoodContact/u);
  const conflict = baziZpqzLuckContext({ year: '乙卯', month: '丁亥', day: '壬戌', hour: '己酉' }, true, '庚寅');
  assert.equal(conflict.yinLuckJoinsMonthHai, true);
  assert.equal(conflict.renHaiYinWoodContact, false);
  const competing = baziZpqzLuckContext({ year: '乙亥', month: '丁亥', day: '壬戌', hour: '己酉' }, true, '戊寅');
  assert.equal(competing.yinLuckJoinsMonthHai, true);
  assert.equal(competing.renHaiYinWoodContact, false);
  assert.ok(competing.luckPairs.some(pair => pair.kind === '六合' && pair.members.some(row => row.position === 'year')));
  const unknown = baziZpqzLuckContext({ year: '乙卯', month: '丁亥', day: '壬戌', hour: '己酉' }, false, '戊寅');
  assert.equal(unknown.renHaiYinWoodContact, undefined);
});

test('a complete Ren Hai chart without natal Ji cannot enter the officer transformation routes', () => {
  const run = submitZpqzLuck([1975, 11, 12], 6, 2004);
  const fact = run.facts.find(row => row.factType === 'zpqz_luck_context' && row.normalizedPayload.luckPillar === '庚寅');
  assert.equal(fact.normalizedPayload.yinLuckJoinsMonthHai, true);
  assert.equal(fact.normalizedPayload.renHaiOfficerRoute, 'none');
  assert.equal(fact.normalizedPayload.renHaiOfficerContext, undefined);
  const matches = matchFortuneKnowledge(run).byMethod.bazi;
  for (const n of [43, 44, 47]) assert.equal(numbered(matches, n).status, 'not_matched');
});

test('unverified or multiple natal candidates cannot combine a source-qualified natal with a different luck direction', () => {
  for (const alter of [chart => { chart.timeKnown = false; }, chart => { chart.bazi.rawResult[0].luckPeriods[0].startAge++; },
    chart => { chart.bazi.rawResult.push(structuredClone(chart.bazi.rawResult[0])); }]) {
    const chart = archive(); alter(chart); const run = calculate(chart);
    assert.ok(!run.facts.some(row => row.factType === 'zpqz_luck_context' && row.completeness === 'complete'));
    assert.ok(!['matched', 'partial'].includes(numbered(matchFortuneKnowledge(run).byMethod.bazi, 44).status));
  }
});

test('the actual luck change cuts witnesses and candidate windows without inventing a five-year effect interval', () => {
  const run = calculate(archive([1990, 11, 23]));
  const facts = run.facts.filter(row => row.factType === 'zpqz_luck_context');
  const starts = facts.filter(row => row.normalizedPayload.luckPillar === '癸未');
  const ends = facts.filter(row => row.normalizedPayload.luckPillar === '甲申');
  assert.ok(starts.length && ends.length);
  const boundary = starts[0].normalizedPayload.stageStart;
  assert.equal(ends.at(-1).activeTo, boundary); assert.equal(starts[0].activeFrom, boundary);
  assert.ok(facts.every(row => row.activeFrom >= row.normalizedPayload.stageStart && row.activeTo <= row.normalizedPayload.stageEnd));
  assert.equal(numbered(matchFortuneKnowledge(run).byMethod.bazi, 44).windows[0].start, boundary);
  assert.ok(facts.every(row => row.normalizedPayload.effectTiming === 'source-five-year-unresolved'));
});

test('source root pairs cross natal and luck layers, keeping the four Jia roots and the two Hai roles distinct', () => {
  const chart = { year: '壬午', month: '乙卯', day: '甲辰', hour: '丁亥' };
  const paired = baziZpqzLuckContext(chart, true, '甲子');
  assert.deepEqual(paired.crossLayerRoots.filter(row => row.stemPosition === 'decadal').map(row => [row.position, row.exact, row.role]),
    [['month', false, undefined], ['hour', true, '甲长生之根']]);
  assert.deepEqual(paired.haiRoles, [{ position: 'hour', pillar: '丁亥', branch: '亥', renPositions: ['year'], jiaPositions: ['day', 'decadal'] }]);
  const fromNatal = baziZpqzLuckContext({ ...chart, hour: '壬申' }, true, '辛亥');
  assert.ok(fromNatal.crossLayerRoots.some(row => row.stemPosition === 'day' && row.position === 'decadal' && row.role === '甲长生之根'));
  assert.ok(fromNatal.crossLayerRoots.some(row => row.stemPosition === 'hour' && row.position === 'decadal' && row.role === '壬禄之根'));
  const wei = baziZpqzLuckContext(chart, true, '己未');
  assert.ok(wei.crossLayerRoots.some(row => row.stemPosition === 'day' && row.position === 'decadal' && row.branch === '未' && !row.exact));
  const [jiaToWei] = wei.crossLayerRootReview.columns.filter(row => row.position === 'day').map(row => row.natalStemInLuck);
  assert.deepEqual([jiaToWei.exact, jiaToWei.namedJiaRoot, jiaToWei.sameElementStems], [false, true, ['乙']]);
  assert.equal(baziZpqzLuckContext(chart, false, '己未').crossLayerRootReview, undefined);
  const bothLayers = baziZpqzLuckContext({ ...chart, month: '丙寅' }, true, '甲子');
  assert.ok(bothLayers.crossLayerRoots.some(row => row.stemPosition === 'decadal' && row.position === 'month' && row.role === '当旺之气'));
  assert.ok(bothLayers.crossLayerRoots.every(row => (row.stemPosition === 'decadal') !== (row.position === 'decadal')));
});

test('SQLite p055 completes the positional review on both sides of a verified transition even when no cross-layer root is found', () => {
  const run = calculate(archive(), 2012);
  validateFortuneFacts(run);
  const facts = run.facts.filter(row => row.factType === 'zpqz_luck_context');
  const old = facts.filter(row => row.normalizedPayload.luckPillar === '乙酉');
  const next = facts.filter(row => row.normalizedPayload.luckPillar === '甲申');
  assert.ok(old.length && next.length);
  assert.ok(old.every(row => row.normalizedPayload.confirmed && !row.normalizedPayload.hasCrossLayerRoot));
  assert.ok(old[0].normalizedPayload.rootWitnesses.some(row => row.roots.some(root => !root.exactStem)));
  const checked = old[0].normalizedPayload.crossLayerRootReview;
  assert.deepEqual(checked.columns.map(row => row.position), ['year', 'month', 'day', 'hour']);
  const comparisons = checked.columns.flatMap(row => [row.natalStemInLuck, row.luckStemInNatal]);
  assert.ok(comparisons.every(row => !row.exact && !row.namedJiaRoot));
  assert.ok(comparisons.some(row => row.sameElementStems.length === 0));
  assert.ok(checked.luckHiddenExposures.some(row => row.stem === '辛' && row.natalStemPositions.length === 0 && !row.alreadyInLuckStem));
  const boundary = next[0].normalizedPayload.stageStart;
  assert.equal(old.at(-1).activeTo, boundary);
  const result = numbered(matchFortuneKnowledge(run).byMethod.bazi, 55);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: old[0].activeFrom, endExclusive: next.at(-1).activeTo }]);
  assert.ok([...old, ...next].every(row => result.sourceFactIds.includes(row.factId)));
  const miss = numbered(matchFortuneKnowledge(calculate(archive(), 2008)).byMethod.bazi, 55);
  assert.equal(miss.status, 'matched');
  const changed = archive(); changed.bazi.rawResult[0].hour = '丁酉';
  assert.equal(numbered(matchFortuneKnowledge(calculate(changed, 2012)).byMethod.bazi, 55).status, 'unknown');

  const report = interpretFortune(run, requestForFortuneRun(run), 'zpqz-root-pairing-report');
  const { input } = buildFortuneModelContext(run, report);
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /运干甲以本命月柱丁亥所藏同干为根位（甲长生之根）/u);
  assert.match(prompt, /壬在本命日干，为壬禄根。甲在运干，为甲长生根。两干并见/u);
  assert.match(prompt, /运支藏辛，本命四干未见/u);
  assert.match(prompt, /未见同五行藏干/u);
  assert.doesNotMatch(prompt, /crossLayerRoots|crossLayerRootReview|haiRoles|rootPairingProfile/u);
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId);
  assert.deepEqual(finding?.windows, result.windows);
});

test('source hashes and distinct missing conditions survive the four atomic mappings', () => {
  const library = fortuneKnowledge.bazi;
  for (const n of [43, 44, 54, 55]) {
    const rule = numbered(library.rules, n), entry = library.entries.find(row => row.id === rule.knowledgeId);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
    assert.equal(rule.queries.length, 1); assert.equal(rule.queries[0].factType, 'zpqz_luck_context');
    assert.equal(rule.queries[0].where.timeKnown, true); assert.equal(rule.queries[0].where.confirmed, true);
    assert.equal(rule.unresolved.length === 0, [44, 55].includes(n));
  }
  assert.match(numbered(library.rules, 43).unresolved[0], /五年/u);
});

test('the printed Ding-You example retains both natal Wei positions when Mao luck meets them', () => {
  const chart = { year: '丁丑', month: '丁未', day: '丁酉', hour: '丁未' };
  const p = baziZpqzLuckContext(chart, true, '癸卯');
  assert.deepEqual(p.sourceTwoBranchMeetings.map(row => [row.natal.position, row.natal.pillar, row.luck.branch, row.missingBranches]),
    [['month', '丁未', '卯', ['亥']], ['hour', '丁未', '卯', ['亥']]]);
  assert.equal(p.hasSourceTwoBranchMeeting, true);
  assert.equal(group(p, '亥卯未').complete, false);
});

test('p054 finds only the named natal-to-luck pair when all prior query alternatives are absent', () => {
  const cases = [
    [[1975, 3, 8], 12, 1977, 1, '戊寅', ['hour', '午'], ['戌'], true],
    [[1976, 4, 10], 12, 2030, 0, '丙戌', ['hour', '午'], ['寅'], true],
    [[1975, 1, 8], 14, 2067, 0, '丁卯', ['hour', '未'], ['亥'], true],
    [[1975, 1, 10], 6, 2026, 0, '辛未', ['hour', '卯'], ['亥'], true],
    [[1960, 1, 8], 6, 1981, 0, '己卯', ['day', '未'], [], false],
    [[1960, 1, 9], 4, 2051, 0, '丙戌'],
    [[1960, 1, 15], 12, 1982, 0, '己卯'],
  ];
  for (const [date, hour, year, gender, luck, natalPartner, missing, addsBranch] of cases) {
    const run = submitZpqzLuck(date, hour, year, gender);
    const fact = run.facts.find(row => row.factType === 'zpqz_luck_context' && row.normalizedPayload.luckPillar === luck
      && row.normalizedPayload.confirmed);
    assert.ok(fact, year);
    const p = fact.normalizedPayload;
    assert.equal(p.hasNewlyExposedStem, false, year);
    assert.equal(p.hasLuckCombination, false, year);
    assert.equal(p.hasSourceTwoBranchMeeting, Boolean(natalPartner), year);
    assert.equal(p.sourceTwoBranchMeetings.length, natalPartner ? 1 : 0, year);
    const result = numbered(matchFortuneKnowledge(run).byMethod.bazi, 54);
    assert.equal(result.status, natalPartner ? 'partial' : 'not_matched', year);
    assert.equal(result.sourceFactIds.includes(fact.factId), Boolean(natalPartner), year);
    if (year === 1982) assert.ok(run.facts.some(row => row.factType === 'zpqz_moving_relations'
      && row.normalizedPayload.annualBranch === '戌' && row.normalizedPayload.luckPillar === luck));
    if (!natalPartner) continue;
    const [meeting] = p.sourceTwoBranchMeetings;
    assert.deepEqual([meeting.natal.position, meeting.natal.branch], natalPartner);
    assert.deepEqual([meeting.luck.position, meeting.luck.pillar], ['decadal', luck]);
    assert.deepEqual(meeting.missingBranches, missing);
    assert.equal(meeting.luckAddsBranch, addsBranch);
    if (year === 2026) {
      const entry = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === luck);
      assert.ok(entry);
      assert.equal(result.windows[0].start, entry.exactInstant);
      const report = interpretFortune(run, requestForFortuneRun(run), 'two-branch-meeting');
      const { input } = buildFortuneModelContext(run, report), prompt = formatFortuneFactAudit(input);
      assert.ok(prompt.includes('本命时柱辛卯与本步大运辛未构成原文两支会位'));
      assert.ok(prompt.includes('亥卯未组目前缺亥'));
      assert.match(prompt, /原文五年作用的具体起止尚未核定/u);
      assert.doesNotMatch(prompt, /sourceTwoBranchMeetings|hasSourceTwoBranchMeeting|luckAddsBranch/u);
      assert.ok(input.sections.every(section => !section.findings.some(row => row.knowledgeId === result.knowledgeId)));
    }
  }
});

test('p054 evidence survives a later luck change that has no named pair', () => {
  const run = submitZpqzLuck([1975, 1, 10], 6, 2036);
  const match = numbered(matchFortuneKnowledge(run).byMethod.bazi, 54);
  const transition = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '庚午');
  assert.ok(transition);
  assert.equal(match.status, 'partial');
  assert.equal(match.windows.at(-1).endExclusive, transition.exactInstant);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'two-branch-ending'));
  const evidence = input.facts.find(fact => fact.type === 'zpqz_luck_context' && fact.data.luckPillar === '辛未'
    && fact.endExclusive === transition.exactInstant);
  assert.ok(evidence);
  assert.ok(describeFortuneFact(evidence, String).includes('本命时柱辛卯与本步大运辛未构成原文两支会位'));
  assert.ok(input.facts.some(fact => fact.type === 'zpqz_luck_context' && fact.data.luckPillar === '庚午'));
});

test('p054 keeps the actual fire-meeting positions separate from the named exposed officer or killer', () => {
  const cases = [
    { date: [1966, 8, 13], hour: 12, year: 2020, luck: '庚寅', monthBranch: '申',
      seats: [['year', '丙午', '较重'], ['hour', '庚午', '较缓']], targets: [['hour', '庚午', '庚', '七杀']], root: ['month', '丙申'] },
    { date: [1961, 9, 8], hour: 12, year: 1973, luck: '戊戌', monthBranch: '酉',
      seats: [['hour', '庚午', '较缓']], targets: [['year', '辛丑', '辛', '正官']], root: ['month', '丁酉'] },
    { date: [1980, 2, 11], hour: 12, year: 2014, luck: '甲戌', monthBranch: '寅',
      seats: [['hour', '庚午', '较缓']], targets: [['year', '庚申', '庚', '七杀'], ['hour', '庚午', '庚', '七杀']], root: ['year', '庚申'] },
    { date: [1961, 4, 21], hour: 12, year: 2017, luck: '戊戌', monthBranch: '辰',
      seats: [['hour', '庚午', '较缓']], targets: [['hour', '庚午', '庚', '七杀']], root: ['day', '甲申'] },
    { date: [1960, 9, 13], hour: 12, year: 2024, luck: '戊寅', monthBranch: '酉',
      seats: [['hour', '庚午', '较缓']], targets: [] },
    { date: [1962, 8, 24], hour: 0, year: 2019, luck: '壬寅', monthBranch: '申',
      seats: [['day', '甲午', '次之']], targets: [] },
  ];
  for (const { date, hour, year, luck, monthBranch, seats, targets, root } of cases) {
    const run = submitZpqzLuck(date, hour, year);
    const result = numbered(matchFortuneKnowledge(run).byMethod.bazi, 54);
    const fact = run.facts.find(row => row.factType === 'zpqz_luck_context' && row.normalizedPayload.luckPillar === luck
      && result.sourceFactIds.includes(row.factId));
    assert.equal(result.status, 'partial');
    assert.ok(fact);
    assert.ok(result.windows.some(row => row.start <= fact.activeFrom && row.endExclusive >= fact.activeTo));
    const p = fact.normalizedPayload;
    assert.deepEqual([p.dayMaster, p.natalMonthBranch], ['甲', monthBranch]);
    assert.deepEqual(p.sourceTwoBranchMeetings.map(row => [row.natal.position, row.natal.pillar, row.sourceFireWeight]), seats);
    for (const row of p.sourceTwoBranchMeetings) {
      assert.deepEqual([row.group, row.luck.pillar], ['寅午戌', luck]);
      assert.deepEqual(row.fireControlTargets.map(target => [target.position, target.pillar, target.stem, target.tenGod]),
        targets.filter(([position]) => position !== row.natal.position));
      for (const target of row.fireControlTargets) assert.deepEqual(target.rootSeats.map(seat => [seat.position, seat.pillar]), [root]);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'zpqz-fire-targets'));
    const prompt = formatFortuneFactAudit(input);
    for (const [, , weight] of seats) assert.ok(prompt.includes('属于' + weight + '的位置'));
    const separateTargets = targets.filter(([position]) => seats.some(([seat]) => seat !== position));
    for (const [, pillar, stem, god] of separateTargets) {
      assert.ok(prompt.includes(pillar + '的' + stem + god + '，原局的具名支位在'));
      assert.ok(prompt.includes(root[1] + '。午和透干分居两柱，此处保留丁火克' + stem + '的方向'));
    }
    if (!separateTargets.length) assert.doesNotMatch(prompt, /此会位对应透在/u);
    assert.doesNotMatch(prompt, /sourceFireWeight|fireControlTargets/u);
  }
});

test('p054 retains actual month-command exposure and named source examples through the server and prompt', () => {
  const cases = [
    { date: [1960, 4, 16], hour: 18, year: 1984, luck: '戊寅', laterLuck: '丁丑',
      origin: ['month', '庚辰', '戊', '偏财', true, 'jia-you-wu'], officer: ['hour', '癸酉'] },
    { date: [1960, 7, 15], hour: 18, year: 2016, luck: '丁丑',
      origin: ['month', '癸未', '丁', '伤官', true, 'jia-you-ding'], officer: ['hour', '癸酉'] },
    { date: [1960, 9, 13], hour: 12, year: 1982, gender: 1, luck: '丁亥',
      origin: ['hour', '庚午', '丁', '伤官', false, 'jia-you-ding'], officer: ['month', '乙酉'] },
    { date: [1960, 6, 13], hour: 2, year: 1985, luck: '己卯',
      origin: ['month', '壬午', '己', '正官', true, 'ren-wu-ji'] },
    { date: [1960, 6, 15], hour: 2, year: 2006, luck: '丁丑',
      origin: ['month', '壬午', '丁', '伤官', true, undefined] },
    { date: [1960, 6, 13], hour: 18, year: 1986, luck: '己卯', alreadyExposed: '己' },
    { date: [1960, 6, 15], hour: 18, year: 1977, luck: '庚辰', annualOnly: '丁' },
  ];
  for (const { date, hour, year, gender, luck, laterLuck, origin, officer, alreadyExposed, annualOnly } of cases) {
    const run = submitZpqzLuck(date, hour, year, gender);
    const result = numbered(matchFortuneKnowledge(run).byMethod.bazi, 54);
    const facts = run.facts.filter(row => row.factType === 'zpqz_luck_context' && row.normalizedPayload.confirmed === true);
    const fact = facts.findLast(row => row.normalizedPayload.luckPillar === luck);
    assert.ok(fact);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'zpqz-month-exposure'));
    const prompt = formatFortuneFactAudit(input);
    const p = fact.normalizedPayload;
    if (!origin) {
      assert.deepEqual(p.sourceNewExposures, []);
      assert.ok(!p.newExposureOrigins.includes('month-command'));
      if (alreadyExposed) assert.ok(p.hiddenActivations.some(row => row.position === 'month' && row.stem === alreadyExposed
        && row.luckStemSame && row.natalExposurePositions.length && row.newlyExposedByLuck === false));
      if (annualOnly) assert.ok(p.hiddenActivations.some(row => row.position === 'month' && row.stem === annualOnly
        && !row.luckStemSame && !row.natalExposurePositions.length && row.newlyExposedByLuck === false));
      assert.doesNotMatch(prompt, /正文另论的月令藏干透清|徐注所举的午中引己/u);
      continue;
    }
    assert.equal(result.status, 'partial');
    assert.ok(result.sourceFactIds.includes(fact.factId));
    assert.deepEqual(p.sourceNewExposures.map(row => [row.position, row.pillar, row.stem, row.tenGod, row.monthCommand, row.namedExample]), [origin]);
    assert.deepEqual(p.sourceNewExposures[0].officerSeats.map(row => [row.position, row.pillar]), officer ? [officer] : []);
    const [, pillar, stem, tenGod, monthCommand, namedExample] = origin;
    assert.equal(p.newExposureOrigins.includes('month-command'), monthCommand);
    if (monthCommand) assert.ok(prompt.includes(pillar + '所藏' + stem + tenGod + '由本步运干新透，属于正文另论的月令藏干透清'));
    else assert.doesNotMatch(prompt, /正文另论的月令藏干透清/u);
    if (officer) assert.ok(prompt.includes('甲日原局酉位在本命' + (officer[0] === 'month' ? '月柱' : '时柱') + officer[1]));
    else assert.doesNotMatch(prompt, /甲日原局酉位在/u);
    if (namedExample === 'ren-wu-ji') assert.match(prompt, /与徐注所举的午中引己对应/u);
    if (laterLuck) {
      assert.deepEqual(p.sourceTwoBranchMeetings, []);
      const next = facts.find(row => row.normalizedPayload.luckPillar === laterLuck);
      assert.equal(p.stageEnd, next.normalizedPayload.stageStart);
      assert.equal(fact.activeTo, next.activeFrom);
      assert.ok(input.facts.some(row => row.type === 'zpqz_luck_context' && row.data.luckPillar === laterLuck));
      assert.ok(input.facts.some(row => row.type === 'zpqz_luck_context' && row.data.luckPillar === luck));
      assert.ok(result.windows.some(row => row.start <= fact.activeFrom && row.endExclusive >= fact.activeTo));
    }
    assert.doesNotMatch(prompt, /sourceNewExposures|officerSeats|jia-you-ding/u);
  }
});

test('p054 keeps the Kang chart’s two Wu-Zi clashes before the actual Ji-Wei emergence and Mao-Wei meeting', () => {
  const run = submitZpqzLuck([2038, 4, 5], 0, 2068, 1);
  const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '己未');
  assert.ok(transition);
  const boundary = transition.exactInstant;
  const facts = run.facts.filter(row => row.factType === 'zpqz_luck_context');
  const before = facts.find(row => row.normalizedPayload.luckPillar === '戊午' && row.activeTo === boundary);
  const after = facts.find(row => row.normalizedPayload.luckPillar === '己未' && row.activeFrom === boundary);
  assert.ok(before && after);
  const hit = numbered(matchFortuneKnowledge(run).byMethod.bazi, 54);
  assert.equal(hit.status, 'partial');
  assert.equal(hit.windows[0].start, boundary);
  assert.ok(hit.sourceFactIds.includes(after.factId) && !hit.sourceFactIds.includes(before.factId));
  const earlier = before.normalizedPayload.kangExposureContext, active = after.normalizedPayload.kangExposureContext;
  assert.deepEqual(earlier.natalWu.map(row => [row.position, row.pillar, row.stem]), [['year', '戊午', '丁'], ['year', '戊午', '己']]);
  assert.deepEqual(earlier.wuClashes.map(pair => pair.members.map(row => [row.position, row.pillar])),
    [[['day', '壬子'], ['decadal', '戊午']], [['hour', '庚子'], ['decadal', '戊午']]]);
  assert.equal(earlier.jiExposure, undefined);
  assert.equal(active.jiExposure.stem, '己');
  assert.deepEqual(active.jiControls.map(row => [row.position, row.stem]), [['day', '癸'], ['hour', '癸']]);
  assert.deepEqual(active.maoWeiMeetings.map(row => [row.natal.pillar, row.luck.pillar, row.missingBranches]),
    [['乙卯', '己未', ['亥']]]);
  assert.deepEqual(active.wuClashes, []);
  const relationFacts = run.facts.filter(row => row.factType === 'zpqz_moving_relations');
  const lastWu = relationFacts.find(row => row.normalizedPayload.luckPillar === '戊午' && row.activeTo === boundary);
  const firstWei = relationFacts.find(row => row.normalizedPayload.luckPillar === '己未' && row.activeFrom === boundary);
  assert.equal(lastWu.normalizedPayload.confirmed, true);
  assert.equal(lastWu.normalizedPayload.hasKangDoubleClash, true);
  const clashes = lastWu.normalizedPayload.kangDoubleClash;
  assert.deepEqual([clashes.killer.position, clashes.killer.stem, clashes.killer.tenGod], ['year', '戊', '七杀']);
  assert.deepEqual(clashes.natalClashes.map(row => row.members.map(member => [member.position, member.pillar])),
    [[['year', '戊午'], ['day', '壬子']], [['year', '戊午'], ['hour', '庚子']]]);
  assert.deepEqual(clashes.alternativePairings.map(pairs => pairs.map(({ wu, zi }) => [wu.position, zi.position])),
    [[['year', 'day'], ['decadal', 'hour']], [['year', 'hour'], ['decadal', 'day']]]);
  assert.equal(firstWei.normalizedPayload.hasKangDoubleClash, false);
  const kang = { year: '戊午', month: '乙卯', day: '壬子', hour: '庚子' };
  assert.equal(baziZpqzMovingRelations(kang, true, '己未', '戊午').hasKangDoubleClash, false);
  assert.equal(baziZpqzMovingRelations(kang, false, '戊午', '戊子').hasKangDoubleClash, false);
  assert.equal(baziZpqzMovingRelations({ ...kang, hour: '壬寅' }, true, '戊午', '戊子').hasKangDoubleClash, false);
  assert.equal(numbered(matchFortuneKnowledge(run).byMethod.bazi, 40).status, 'not_matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'kang-emergence'));
  assert.ok(input.facts.some(row => row.type === 'zpqz_luck_context' && row.data.luckPillar === '戊午' && row.endExclusive === boundary));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /康例午运的六冲见于本命日柱壬子与本步大运戊午/u);
  assert.match(prompt, /康例午运的六冲见于本命时柱庚子与本步大运戊午/u);
  assert.match(prompt, /本命年午和运午分别可冲日子、时子，两种一对一配法/u);
  assert.match(prompt, /本命年柱戊午的己正官在本步由运干新透/u);
  assert.match(prompt, /康例本步大运己未的未与本命月柱乙卯的卯相会，该段缺亥/u);
  assert.doesNotMatch(prompt, /kangExposureContext|kangDoubleClash|jiExposure|maoWeiMeetings/u);
});

test('p054 compares the published Kang year with the recomputed later half of the Ji-Wei stage', () => {
  // The book supplies a lunar date and Zi hour. Beijing civil midnight is a replay convention.
  const birth = Lunar.fromYmdHms(1858, 2, 6, 0, 0, 0).getSolar();
  const event = Lunar.fromYmdHms(1898, 8, 6, 12, 0, 0).getSolar();
  assert.equal(birth.toYmd(), '1858-03-20');
  assert.equal(event.toYmd(), '1898-09-21');
  assert.equal(event.getLunar().getYearInGanZhiExact(), '戊戌');
  assert.equal(event.getYear() - birth.getYear() + 1, 41);
  const at = Date.parse(event.toYmd() + 'T12:00:00+08:00');
  const chart = archive([birth.getYear(), birth.getMonth(), birth.getDay()], 1, 0);
  const { candidates: [candidate] } = buildBaZiCalculation({ start: at, end: at + 86_400_000 }, at, chart);
  assert.deepEqual(['year', 'month', 'day', 'hour'].map(layer => candidate.natal[layer]), ['戊午', '乙卯', '壬子', '庚子']);
  const directions = candidate.directions.filter(row => row.confirmed);
  assert.equal(directions.length, 1);
  const stage = directions[0].stages.find(row => row.start <= at && at < row.end);
  assert.equal(stage.pillar.pillar, '己未');
  assert.equal(new Date(stage.start).toISOString(), '1893-09-09T00:00:00.000Z');
  assert.equal(new Date(stage.end).toISOString(), '1903-09-09T00:00:00.000Z');
  const laterHalf = new Date(stage.start);
  laterHalf.setUTCFullYear(laterHalf.getUTCFullYear() + 5);
  assert.equal(laterHalf.toISOString(), '1898-09-09T00:00:00.000Z');
  assert.ok(laterHalf.getTime() <= at && at < stage.end);
});

test('p054 matches the dated Zhao source replay without assigning a five-year span', () => {
  const solar = Lunar.fromYmdHms(1887, -4, 10, 8, 0, 0).getSolar();
  assert.equal(solar.toYmd(), '1887-06-01');
  const date = [solar.getYear(), solar.getMonth(), solar.getDay()];
  const run = submitZpqzLuck(date, 8, 1929, 1);
  const start = '1929-11-20T16:00:00.000Z', endExclusive = '1929-11-21T16:00:00.000Z';
  const fact = run.facts.find(row => row.factType === 'zpqz_luck_context' && row.normalizedPayload.zhaoDocumentedXinChouDay);
  assert.ok(fact);
  assert.equal(fact.normalizedPayload.luckPillar, '辛丑');
  assert.equal(fact.normalizedPayload.effectTiming, 'source-five-year-unresolved');
  assert.equal(group(fact.normalizedPayload, '巳酉丑').completedByLuck, true);
  const hit = numbered(matchFortuneKnowledge(run).byMethod.bazi, 54);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start, endExclusive }]);
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'zhao-archive-day'));
  assert.match(formatFortunePrompt(input), /运丑补齐本命月巳、日酉的三合/u);
  assert.doesNotMatch(formatFortunePrompt(input), /zhaoDocumentedXinChouDay/u);
  const geng = submitZpqzLuck(date, 8, 1930, 1);
  const recorded = geng.facts.find(row => row.factType === 'zpqz_luck_context' && row.normalizedPayload.zhaoDocumentedAnnualGengDay);
  assert.ok(recorded);
  assert.deepEqual([recorded.normalizedPayload.luckPillar, recorded.normalizedPayload.stageStart, recorded.normalizedPayload.stageEnd],
   ['辛丑', '1926-02-17T08:00:00.000Z', '1936-02-17T08:00:00.000Z']);
  assert.equal(recorded.normalizedPayload.effectTiming, 'source-five-year-unresolved');
  assert.deepEqual(recorded.normalizedPayload.zhaoAnnualGengCheck, {
   annualPillar: '庚午', combinesMonthYi: { position: 'month', pillar: '乙巳', stem: '乙' },
   controlsHourJia: { position: 'hour', pillar: '甲辰', stem: '甲' },
  });
  const gengHit = numbered(matchFortuneKnowledge(geng).byMethod.bazi, 54);
  assert.equal(gengHit.status, 'matched');
  assert.deepEqual(gengHit.sourceFactIds, [recorded.factId]);
  assert.deepEqual(gengHit.windows, [{ start: '1930-07-23T16:00:00.000Z', endExclusive: '1930-07-24T16:00:00.000Z' }]);
  assert.equal(gengHit.matchedSourceExcerpt, '合乙傷甲');
  const { input: gengInput } = buildFortuneModelContext(geng, interpretFortune(geng, requestForFortuneRun(geng), 'zhao-annual-geng-day'));
  const audit = /赵例史日仍在辛丑运，实岁庚午的庚合本命月柱乙巳之乙，克本命时柱甲辰之甲/u;
  assert.match(formatFortuneFactAudit(gengInput), audit);
  const prompt = formatFortunePrompt(gengInput);
  assert.match(prompt, /合乙傷甲/u);
  assert.match(prompt, /实际庚午岁干合原月乙、克原时甲/u);
  assert.doesNotMatch(prompt, /zhaoDocumentedAnnualGengDay|zhaoAnnualGengCheck|被刺|暗杀/u);
  assert.doesNotMatch(prompt, audit);
  const otherDays = { ...geng, facts: geng.facts.filter(row => row.factId !== recorded.factId) };
  assert.equal(numbered(matchFortuneKnowledge(otherDays).byMethod.bazi, 54).status, 'partial');
  for (const [hour, year] of [[8, 1931], [10, 1929], [10, 1930]]) {
    const changed = submitZpqzLuck(date, hour, year, 1);
    assert.ok(changed.facts.every(row => row.normalizedPayload.zhaoDocumentedXinChouDay !== true
      && row.normalizedPayload.zhaoDocumentedAnnualGengDay !== true));
    assert.notEqual(numbered(matchFortuneKnowledge(changed).byMethod.bazi, 54).status, 'matched');
  }
});

test('p054 traces separate Si metal completion and two Mao-Wei meetings with a You clash in the Yao chart', () => {
  const date = [1937, 7, 9], siRun = submitZpqzLuck(date, 14, 1950, 1), maoRun = submitZpqzLuck(date, 14, 1968, 1);
  const record = (run, stage) => {
    const hit = numbered(matchFortuneKnowledge(run).byMethod.bazi, 54);
    assert.equal(hit.status, 'partial');
    const fact = run.facts.find(row => row.factType === 'zpqz_luck_context' && row.normalizedPayload.luckPillar === stage
      && hit.sourceFactIds.includes(row.factId));
    assert.ok(fact);
    return fact;
  };
  const si = record(siRun, '乙巳').normalizedPayload.yaoExposureContext;
  assert.deepEqual(si.food.map(row => [row.position, row.stem]), [['year', '己'], ['month', '己'], ['hour', '己']]);
  assert.deepEqual([si.wealth.position, si.wealth.pillar, si.wealth.stem], ['day', '丁酉', '辛']);
  assert.equal(si.metalGroup.completedByLuck, true);
  assert.deepEqual(si.metalGroup.members.map(row => [row.branch, row.natalPositions, row.luckPresent]),
    [['巳', [], true], ['酉', ['day'], false], ['丑', ['year'], false]]);
  assert.equal(si.siWealth.stem, '庚');
  const maoRecord = record(maoRun, '癸卯'), mao = maoRecord.normalizedPayload.yaoExposureContext;
  assert.deepEqual(mao.maoWeiMeetings.map(row => [row.natal.position, row.natal.pillar, row.missingBranches]),
    [['month', '丁未', ['亥']], ['hour', '丁未', ['亥']]]);
  assert.deepEqual(mao.maoClashes.map(pair => pair.members.map(row => [row.position, row.pillar])),
    [[['day', '丁酉'], ['decadal', '癸卯']]]);
  assert.deepEqual(mao.maoControls.map(row => [row.position, row.stem]), [['year', '己'], ['month', '己'], ['hour', '己']]);
  const transition = maoRun.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸卯');
  assert.equal(maoRecord.activeFrom, transition.exactInstant);
  const prompt = run => formatFortuneFactAudit(buildFortuneModelContext(run,
    interpretFortune(run, requestForFortuneRun(run), 'yao-meetings')).input);
  assert.match(prompt(siRun), /姚例本运巳补齐原局的酉、丑，运支藏庚正财/u);
  assert.match(prompt(maoRun), /姚例同运另有六冲，实际柱位为本命日柱丁酉与本步大运癸卯/u);
  assert.doesNotMatch(prompt(maoRun), /姚例本运巳补齐原局|yaoExposureContext/u);
});

test('p055 ties the printed hidden-stem order to the actual Yin or Chen root in a bound stage', () => {
  const cases = [
    { date: [1960, 1, 9], hour: 12, year: 1970, luck: '戊寅', root: ['decadal', '戊寅'],
      members: [['甲', '当旺之气', ['hour']], ['丙', '方生之气', ['day']], ['戊', '寄生之气', ['decadal']]] },
    { date: [1960, 2, 10], hour: 2, year: 1983, luck: '乙亥', root: ['day', '戊辰'],
      members: [['戊', '土之本气', ['month', 'day']], ['乙', '春之余气', ['decadal']], ['癸', '水之墓', ['hour']]] },
  ];
  for (const { date, hour, year, luck, root, members } of cases) {
    const run = submitZpqzLuck(date, hour, year);
    const result = numbered(matchFortuneKnowledge(run).byMethod.bazi, 55);
    const fact = run.facts.find(row => row.factType === 'zpqz_luck_context' && row.normalizedPayload.luckPillar === luck
      && result.sourceFactIds.includes(row.factId));
    assert.equal(result.status, 'matched');
    assert.ok(fact);
    assert.ok(result.windows.some(row => row.start <= fact.activeFrom && row.endExclusive >= fact.activeTo));
    const p = fact.normalizedPayload;
    assert.deepEqual(p.sourceRootOrders.map(row => [row.position, row.pillar]), [root]);
    const [order] = p.sourceRootOrders;
    assert.deepEqual(order.members.map(row => [row.stem, row.role, row.stemPositions]), members);
    assert.deepEqual(order.members.map(row => row.pairedStemPositions), root[0] === 'decadal' ? [['hour'], ['day'], []] : [[], ['decadal'], []]);
    assert.ok(p.crossLayerRoots.some(row => row.position === root[0] && row.pillar === root[1]));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'zpqz-root-order'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(root[1] + '的藏气顺序为' + members.map(([stem, role]) => stem + '（' + role + '）').join('、')));
    assert.match(prompt, /次序和实际发用仍须结合全局核对/u);
    assert.doesNotMatch(prompt, /sourceRootOrders|stemPositions/u);
  }
});

test('p055 retains the printed four-Yin Wu comparison when no generic cross-layer pairing is present', () => {
  const date = [1974, 2, 18], run = submitZpqzLuck(date, 4, 2009, 1);
  const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '庚午');
  assert.ok(transition);
  const boundary = transition.exactInstant;
  const facts = run.facts.filter(row => row.factType === 'zpqz_luck_context');
  const before = facts.find(row => row.normalizedPayload.luckPillar === '己巳' && row.activeTo === boundary);
  const after = facts.find(row => row.normalizedPayload.luckPillar === '庚午' && row.activeFrom === boundary);
  assert.ok(before && after);
  const result = numbered(matchFortuneKnowledge(run).byMethod.bazi, 55);
  assert.equal(result.status, 'matched');
  assert.ok(result.sourceFactIds.includes(before.factId) && result.sourceFactIds.includes(after.factId));
  assert.equal(before.normalizedPayload.hasCrossLayerRoot, true);
  assert.equal(before.normalizedPayload.hasPrintedYinWuComparison, false);
  const p = after.normalizedPayload, source = p.rootChoice;
  assert.equal(p.hasCrossLayerRoot, false);
  assert.equal(p.hasPrintedYinWuComparison, true);
  assert.deepEqual(source.yinSeats.map(row => row.pillar), ['甲寅', '丙寅', '庚寅', '戊寅']);
  assert.deepEqual(source.visibleYinStems.map(row => [row.stem, row.positions.map(seat => seat.position)]),
    [['甲', ['year']], ['丙', ['month']], ['戊', ['hour']]]);
  assert.deepEqual(source.natalFireMembers.map(row => row.positions.length), [4, 0, 0]);
  assert.equal(source.arrivingWu.pillar, '庚午');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'printed-yin-wu'));
  assert.ok(input.facts.some(row => row.type === 'zpqz_luck_context' && row.data.luckPillar === '庚午' && row.start === boundary));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /徐注依原图四寅将甲木按从财解释/u);
  assert.match(prompt, /本步大运庚午的午与原局诸寅相会。该段缺戌/u);
  assert.doesNotMatch(prompt, /rootChoice|hasPrintedYinWuComparison|pairedStemPositions/u);
  const near = submitZpqzLuck(date, 8, 2010, 1);
  const nearWu = near.facts.find(row => row.factType === 'zpqz_luck_context' && row.normalizedPayload.luckPillar === '庚午');
  assert.ok(nearWu);
  assert.equal(nearWu.normalizedPayload.rootChoice, undefined);
  assert.equal(nearWu.normalizedPayload.crossLayerRootReviewComplete, true);
  assert.equal(numbered(matchFortuneKnowledge(near).byMethod.bazi, 55).status, 'matched');
});

test('p055 locates the three originally exposed Yin stems and all natal fire members in the Shi Zai Cun comparison', () => {
  const run = submitZpqzLuck([2048, 2, 22], 12, 2064, 1);
  const result = numbered(matchFortuneKnowledge(run).byMethod.bazi, 55);
  const fact = run.facts.find(row => row.factType === 'zpqz_luck_context' && row.normalizedPayload.luckPillar === '丙辰'
    && result.sourceFactIds.includes(row.factId));
  assert.equal(result.status, 'matched');
  assert.ok(fact);
  const p = fact.normalizedPayload, source = p.rootChoice;
  assert.equal(source.example, 'shi-zai-cun');
  assert.deepEqual(source.visibleYinStems.map(row => [row.stem, row.positions.map(seat => seat.pillar)]),
    [['甲', ['甲寅']], ['丙', ['丙午']], ['戊', ['戊辰']]]);
  assert.deepEqual(source.natalFireMembers.map(row => [row.branch, row.positions.map(seat => seat.position)]),
    [['寅', ['month']], ['午', ['hour']], ['戌', ['day']]]);
  assert.equal(source.arrivingWu, undefined);
  assert.ok(p.crossLayerRoots.some(row => row.stem === '丙' && row.stemPosition === 'decadal' && row.position === 'month' && row.exact));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'printed-shi'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /原局寅午戌俱在，实位为寅在本命月柱甲寅，午在本命时柱丙午，戌在本命日柱壬戌/u);
  assert.match(prompt, /徐注在这个原图以丙火从财/u);
  assert.ok(input.sections.some(section => section.findings.some(row => row.knowledgeId === result.knowledgeId)));
});

test('real context is projected and translated, preserving member witnesses while excluding partial source text and JSON', () => {
  const run = calculate(), report = interpretFortune(run, requestForFortuneRun(run), 'zpqz-report');
  const { input } = buildFortuneModelContext(run, report);
  const fact = input.facts.find(row => row.type === 'zpqz_luck_context'); assert.ok(fact);
  const description = describeFortuneFact(fact, value => value);
  for (const expected of ['本命月柱丁亥藏壬', '壬禄之根', '缺卯', '运支藏干为己', '五年作用的具体起止尚未核定']) assert.ok(description.includes(expected), expected);
  assert.ok(!/[{}\[\]]|hiddenActivations|decadal|source-five-year|profile|newlyExposedByLuck/u.test(description));
  const prompt = formatFortuneFactAudit(input);
  assert.ok(prompt.includes('不把五年效用扩成十年'));
  const findings = input.sections.flatMap(section => section.findings);
  for (const n of [43, 44, 54]) {
    assert.ok(!findings.some(row => row.knowledgeId === numbered(fortuneKnowledge.bazi.rules, n).knowledgeId));
  }
  assert.ok(findings.some(row => row.knowledgeId === numbered(fortuneKnowledge.bazi.rules, 55).knowledgeId));
});
