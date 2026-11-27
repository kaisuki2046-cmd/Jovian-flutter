import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { astro } from 'iztro';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
const { buildYunZiweiWindow, yunTransformations, yunMonthPillar, yunLifeBranch, yunPalaceName,
  yunDailyReadings, yunMonthlyFinanceAreas, yunSunJiCaseEvidence, yunSunJiCaseWindow, yunZiweiPolicy } = await import('./control/ziwei-yun.ts');
const { lunarAtBeijing } = await import('./control/fortune-calendar.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { evaluateFortuneRules, fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const reference = JSON.parse(readFileSync(new URL('./model/fixtures/yun-official-reference.json', import.meta.url)));
const config = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current' };
const natal = () => astro.withOptions({ dateStr: '1990-05-05', timeIndex: 6, gender: '女', fixLeap: true, config }).toJSON();
const span = (start, end) => ({ start: Date.parse(start), end: Date.parse(end) });
const build = (window, period = 'day', base = natal()) => buildYunZiweiWindow(window, period, base, [{ ...window, stem: '己', branch: '卯' }]);
const snapshot = () => ({ timeKnown: true, bazi: { rawResult: [] }, western: { rawResult: [] }, ziwei: {
  engineName: 'iztro', engineVersion: '2.6.5', rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1', rawResult: [natal()],
} });
const calculate = (periodType, targetPeriod, chart = snapshot()) => {
  const params = { periodType, targetPeriod, displayTimezone: 'Asia/Shanghai' };
  return calculateFortuneFacts(params, buildFactTimeContext(params, Date.parse('2026-11-18T04:00:00Z'), 'server'), 'yun-real-run', { snapshotId: 'yun-snapshot', chart });
};
function submitBirth(periodType, targetPeriod, at, birth = { dateStr: '1990-05-05', timeIndex: 6, gender: '女' }) {
  const chart = snapshot();
  const { fixLeap = true, ...input } = birth;
  chart.ziwei.rawResult = [astro.withOptions({ ...input, fixLeap, config }).toJSON()];
  const hour = String(birth.timeIndex * 2).padStart(2, '0');
  chart.birthContext = { birthInstant: new Date(birth.dateStr + 'T' + hour + ':00:00+08:00').toISOString(),
    precision: 'minute', latitude: 39.9042, longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  return submitChart(periodType, targetPeriod, at, chart);
}
function submitChart(periodType, targetPeriod, at, chart) {
  const params = { periodType, targetPeriod, displayTimezone: 'Asia/Shanghai' };
  const now = Date.parse(at), archive = { snapshotId: 'yun-complete-birth', chart };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
  validateFortuneFacts(run);
  return run;
}
const ruleResult = (run, index) => matchFortuneKnowledge(run).byMethod.ziwei.find(r => r.knowledgeId === fortuneKnowledge.ziwei.rules[index].knowledgeId);
const completedYunRules = new Set([32, 33, 35, ...Array.from({ length: 13 }, (_, i) => i + 36)]);
const agreedFrame = (date, rawChart = natal()) =>
  build(span(date + 'T04:00:00Z', date + 'T05:00:00Z'), 'day', rawChart).rows.find(row => row.scope === 'daily');

test('named monthly finance examples require one verified annual transformation at the actual monthly life palace', () => {
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === 'fortune-entry-' + id);
  const cases = [
    [2237, '1994-10-10', 6, 2017, 9, '太阴', '禄', '仆役', '2017-09-19T15:00:00.000Z'],
    [2238, '1987-11-23', 3, 2015, 3, '太阴', '忌', '仆役', '2015-03-19T15:00:00.000Z'],
    [2239, '1994-10-10', 6, 2039, 8, '武曲', '禄', '官禄', '2039-08-19T15:00:00.000Z'],
  ];
  for (const [id, dateStr, timeIndex, year, month, star, kind, palace, endExclusive] of cases) {
    const asOf = year + '-' + String(month).padStart(2, '0') + '-15T04:00:00.000Z';
    const birth = { dateStr, timeIndex, gender: '女' };
    const run = submitBirth('month', { year, month }, asOf, birth);
    const result = lookup(run, id);
    assert.equal(result.status, 'matched', 'source entry ' + id);
    assert.deepEqual(result.windows, [{ start: run.time.displayWindow.instantRange.startInstant, endExclusive }]);
    const [fact] = run.facts.filter(row => result.sourceFactIds.includes(row.factId));
    const data = fact.normalizedPayload;
    assert.deepEqual([fact.scope, data.star, data.kind, data.sourceScope], ['monthly', star, kind, 'yearly']);
    assert.ok([data.natalName, data.yearlyName].includes(palace));
    for (const change of [{ sourceScope: 'monthly' }, { natalName: '子女', yearlyName: '子女' }]) {
      const different = run.facts.map(row => row.factId === fact.factId
        ? { ...row, normalizedPayload: { ...data, ...change } } : row);
      assert.notEqual(lookup({ ...run, facts: different }, id).status, 'matched');
    }
    const daily = submitBirth('day', { date: asOf.slice(0, 10) }, asOf, birth);
    assert.equal(lookup(daily, id).status, 'not_applicable');
  }
});

test('new monthly finance rules use a verified natal wealth recipient at the actual monthly life palace', () => {
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === 'fortune-entry-' + id);
  const samples = [
    [2283, 3, 2022, 8, '2022-08-12T03:30:00.000Z', ['卯', '武曲', '忌', 'yearly', '财帛', '父母']],
    [2283, 3, 2014, 4, '2014-04-14T03:30:00.000Z', ['卯', '武曲', '忌', 'minor', '财帛', '子女']],
    [2284, 1, 2020, 8, '2020-08-04T03:30:00.000Z', ['亥', '天府', '科', 'yearly', '福德', '兄弟']],
    [2284, 4, 2017, 12, '2017-12-02T15:30:00.000Z', ['卯', '武曲', '禄', 'minor', '子女', '迁移']],
    [2285, 1, 2022, 8, '2022-08-12T03:30:00.000Z', ['丑', '武曲', '忌', 'yearly', '官禄', '兄弟']],
    [2285, 2, 2023, 5, '2023-05-04T03:30:00.000Z', ['子', '太阴', '忌', 'minor', '官禄', '子女']],
    [2286, 5, 2022, 2, '2022-02-15T15:30:00.000Z', ['亥', '武曲', '忌', 'yearly', '迁移', '子女']],
    [2286, 5, 2014, 10, '2014-10-08T15:30:00.000Z', ['亥', '武曲', '忌', 'minor', '迁移', '仆役']],
    [2287, 2, 2025, 3, '2025-03-14T03:30:00.000Z', ['子', '太阴', '忌', 'yearly', '官禄', '疾厄']],
    [2287, 1, 2014, 4, '2014-04-14T03:30:00.000Z', ['丑', '武曲', '忌', 'minor', '官禄', '疾厄']],
  ];
  for (const [id, timeIndex, year, month, at, positions] of samples) {
    const birth = { dateStr: '1994-10-10', timeIndex, gender: '女' };
    const run = submitBirth('month', { year, month }, at, birth);
    const match = lookup(run, id);
    assert.equal(match.status, 'matched', 'entry ' + id + ' ' + positions[3]);
    const evidence = run.facts.find(row => match.sourceFactIds.includes(row.factId)
      && row.activeFrom <= at && at < row.activeTo && row.normalizedPayload.sourceScope === positions[3]);
    assert.ok(evidence);
    const { branch, star, kind, sourceScope, natalName, yearlyName } = evidence.normalizedPayload;
    assert.deepEqual([branch, star, kind, sourceScope, natalName, yearlyName], positions);
    assert.equal(evidence.factType, 'yun_month_wealth_star_contact');
    assert.equal(evidence.scope, 'monthly');
    const annualOrMonthlyMismatch = { ...evidence, normalizedPayload: { ...evidence.normalizedPayload, sourceScope: 'monthly' } };
    assert.equal(lookup({ ...run, facts: [annualOrMonthlyMismatch] }, id).status, 'not_matched');
    if (id >= 2285) {
      const wrongPalace = { ...evidence, normalizedPayload: {
        ...evidence.normalizedPayload, natalName: '父母', yearlyName: '兄弟',
      } };
      assert.equal(lookup({ ...run, facts: [wrongPalace] }, id).status, 'not_matched');
    }
  }
});

test('monthly career and travel finance require Di Jie at the actual upper-level Ji seat', () => {
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === 'fortune-entry-' + id);
  for (const [id, dateStr, timeIndex, at, expected] of [
    [2321, '1997-03-15', 4, '2023-10-29T04:00:00.000Z', ['卯', '太阴', 'minor', '官禄', '命宫']],
    [2321, '1997-03-15', 4, '2025-09-06T16:00:00.000Z', ['卯', '太阴', 'yearly', '官禄', '夫妻']],
    [2322, '1994-10-10', 3, '2016-12-30T08:00:00.000Z', ['寅', '天同', 'minor', '疾厄', '迁移']],
    [2322, '1994-10-10', 3, '2041-01-17T04:00:00.000Z', ['寅', '天同', 'yearly', '疾厄', '迁移']],
  ]) {
    const target = { year: Number(at.slice(0, 4)), month: Number(at.slice(5, 7)) };
    const birth = { dateStr, timeIndex, gender: '女' };
    const run = submitBirth('month', target, at, birth);
    const match = lookup(run, id);
    assert.equal(match.status, 'matched', at);
    const evidence = run.facts.find(row => match.sourceFactIds.includes(row.factId)
      && row.activeFrom <= at && at < row.activeTo && row.normalizedPayload.sourceScope === expected[2]);
    assert.ok(evidence, at);
    assert.equal(evidence.factType, 'yun_month_di_jie_contact');
    const data = evidence.normalizedPayload;
    assert.deepEqual([data.branch, data.star, data.sourceScope, data.natalName, data.yearlyName], expected);
    for (const change of [{ sourceScope: 'monthly' }, { natalName: '兄弟', yearlyName: '父母' }, { atProperty: true }]) {
      assert.equal(lookup({ ...run, facts: [{ ...evidence, normalizedPayload: { ...data, ...change } }] }, id).status, 'not_matched');
    }
    const chart = astro.withOptions({ ...birth, fixLeap: true, config }).toJSON();
    const start = Date.parse(at) - 60 * 60 * 1000;
    const end = Date.parse(at) + 60 * 60 * 1000;
    const seat = chart.palaces.find(palace => palace.earthlyBranch === data.branch);
    const other = chart.palaces.find(palace => palace.earthlyBranch !== data.branch);
    const index = seat.minorStars.findIndex(star => star.name === '地劫');
    assert.ok(index >= 0);
    other.minorStars.push(...seat.minorStars.splice(index, 1));
    const shifted = buildYunZiweiWindow({ start, end }, 'month', chart, []).rows;
    assert.ok(shifted.flatMap(row => row.contacts).some(contact => contact.star === data.star
      && contact.sourceScope === data.sourceScope && contact.verifiedMajorSeat && contact.flowName === '命宫'
      && contact.branch === data.branch && !contact.verifiedDiJieAtSeat));
  }
});

test('daily finance outside the wealth and property seats requires the verified recipient and the matching day clock', () => {
  const cases = [
    [2302, '1994-10-10', 1, '2026-02-17', ['武曲', '忌', '丑', '官禄', '福德']],
    [2303, '1994-10-10', 1, '2026-02-15', ['天府', '科', '亥', '福德', '夫妻']],
    [2304, '1994-10-10', 3, '2026-02-04', ['天梁', '科', '寅', '疾厄', '夫妻']],
  ];
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === 'fortune-entry-' + id);
  for (const [id, dateStr, timeIndex, date, expected] of cases) {
    const run = submitBirth('day', { date }, date + 'T04:00:00.000Z', { dateStr, timeIndex, gender: '女' });
    const match = lookup(run, id);
    assert.equal(match.status, 'matched', 'entry ' + id);
    assert.deepEqual(match.windows, [{ start: run.time.displayWindow.instantRange.startInstant, endExclusive: date + 'T15:00:00.000Z' }]);
    const witness = run.facts.find(row => match.sourceFactIds.includes(row.factId));
    const data = witness.normalizedPayload;
    assert.deepEqual([data.star, data.kind, data.branch, data.natalName, data.dailyName], expected);
    assert.equal(data.verifiedMajorSeat, true);
    if (id === 2304) assert.equal(data.verifiedNatalLucunAtSeat, true);
    const counterexamples = [{ sourceScope: 'monthly' }, { sourceDayClock: 'zi-start' }, { verifiedMajorSeat: false },
      { dayOrNatalWealth: true }, { dayOrNatalProperty: true }];
    if (id === 2304) counterexamples.push({ verifiedNatalLucunAtSeat: false });
    for (const changes of counterexamples) {
      assert.equal(lookup({ ...run, facts: [{ ...witness, normalizedPayload: { ...data, ...changes } }] }, id).status, 'not_matched');
    }
  }
});

test('daily finance uses each named natal palace with its own verified wealth star and daily transformation', () => {
  const examples = [
    [2323, '命宫', 7, '01-01', '太阴', '忌'],
    [2324, '父母', 8, '01-01', '太阴', '忌'],
    [2325, '福德', 3, '01-08', '武曲', '忌', '1997-03-15'],
    [2326, '仆役', 2, '01-18', '武曲', '忌'],
    [2327, '迁移', 5, '01-18', '武曲', '忌'],
    [2328, '疾厄', 6, '01-08', '武曲', '忌'],
    [2329, '子女', 4, '01-18', '武曲', '忌'],
    [2330, '夫妻', 6, '01-01', '太阴', '忌'],
    [2331, '兄弟', 3, '01-01', '太阴', '忌', '1997-03-15'],
    [2332, '命宫', 3, '01-08', '紫微', '权'],
    [2333, '父母', 4, '01-01', '紫微', '科'],
    [2334, '迁移', 5, '01-05', '武曲', '禄'],
    [2335, '疾厄', 6, '01-05', '武曲', '禄'],
    [2336, '子女', 2, '01-01', '紫微', '科'],
    [2337, '夫妻', 5, '01-01', '紫微', '科'],
    [2338, '兄弟', 6, '01-01', '紫微', '科'],
  ];
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === 'fortune-entry-' + id);
  for (const [id, palace, timeIndex, monthDay, star, kind, dateStr = '1994-10-10'] of examples) {
    const date = '2026-' + monthDay;
    const run = submitBirth('day', { date }, date + 'T04:00:00.000Z', { dateStr, timeIndex, gender: '女' });
    const match = lookup(run, id);
    assert.equal(match.status, 'matched', 'entry ' + id);
    assert.deepEqual(match.windows, [{ start: run.time.displayWindow.instantRange.startInstant, endExclusive: date + 'T15:00:00.000Z' }]);
    const witness = run.facts.find(row => match.sourceFactIds.includes(row.factId)
      && row.normalizedPayload.star === star && row.normalizedPayload.kind === kind);
    assert.ok(witness, 'entry ' + id);
    const data = witness.normalizedPayload;
    assert.equal(data.natalName, palace);
    assert.equal(data.sourceScope, 'daily');
    assert.equal(data.verifiedMajorSeat, true);
    for (const changes of [
      { natalName: '财帛', dailyName: palace },
      { sourceScope: 'monthly' },
      { kind: kind === '忌' ? '禄' : '忌' },
      { intrinsicWealthStar: false },
    ]) {
      const unrelated = { ...witness, normalizedPayload: { ...data, ...changes } };
      assert.equal(lookup({ ...run, facts: [unrelated] }, id).status, 'not_matched');
    }
  }
});

test('all forty source transformations match the official script reference, with independent Geng Ke and only Lu/Ji in minor limits', () => {
  for (const [stem, stars] of Object.entries(reference.table)) {
    assert.deepEqual(yunTransformations(stem).map(r => r.star), stars);
    assert.deepEqual(yunTransformations(stem, true).map(r => [r.star, r.kind]), [[stars[0], '禄'], [stars[3], '忌']]);
  }
  assert.deepEqual(yunTransformations('庚').map(r => r.star), ['太阳', '武曲', '天府', '天同']);
  assert.deepEqual(yunTransformations('壬').map(r => r.star), ['天梁', '紫微', '左辅', '武曲']);
  assert.equal(yunTransformations('庚').filter(r => r.kind === '忌').length, 1);
  assert.throws(() => yunTransformations('庚庚')); assert.throws(() => yunMonthPillar(2026, 13));
});

test('twenty-five official lunar months and thirty daily pillars match offline, without a solar-Jie month clock', () => {
  assert.equal(reference.months.length, 25); assert.equal(reference.days.length, 30);
  for (const row of reference.months) {
    const lunar = lunarAtBeijing(Date.parse(row.date + 'T04:00:00Z'));
    assert.equal(lunar.getYear(), row.year); assert.equal(lunar.getMonth(), row.leap ? -row.month : row.month);
    assert.equal(lunar.getDay(), 1); assert.equal(yunMonthPillar(row.year, row.month), row.pillar);
  }
  for (const row of reference.days) {
    const lunar = lunarAtBeijing(Date.parse(row.date + 'T04:00:00Z'));
    assert.equal(lunar.getYear(), row.year); assert.equal(lunar.getMonth(), row.month); assert.equal(lunar.getDay(), row.day);
    assert.equal(lunar.getDayInGanZhiExact2(), row.pillar);
  }
  const march = build(span('2026-03-01T00:00:00Z', '2026-03-15T00:00:00Z'), 'month');
  assert.equal(march.rows.length, 1); assert.equal(march.rows[0].monthPillar, '庚寅');
  assert.equal(yunZiweiPolicy.dayClocks, 'published-midnight-and-zi-start-daily-witnesses-v1');
});

test('the real native frame agrees with twelve official synthetic palaces, stars and minor-age positions while retaining its own transformation labels', () => {
  const base = natal(), before = structuredClone(base);
  for (const expected of reference.natal.palaces) {
    const palace = base.palaces.find(p => p.earthlyBranch === expected.branch);
    assert.equal(palace.name, expected.name); assert.equal(palace.heavenlyStem, expected.stem);
    assert.ok(expected.minorAges.every(age => palace.ages.includes(age)));
    const stars = [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars].map(s => s.name);
    for (const name of expected.stars) assert.ok(stars.includes(name), expected.branch + ':' + name);
  }
  const result = build(span('2026-02-17T00:00:00Z', '2026-02-18T00:00:00Z'), 'day', base);
  assert.equal(result.status, 'ready');
  const day = result.rows.find(r => r.scope === 'daily');
  assert.equal(day.minorLifeBranch, '辰'); assert.equal(day.minorStem, '庚');
  assert.deepEqual(day.contacts.filter(c => c.sourceScope === 'minor').map(c => [c.star, c.kind]), [['太阳', '禄'], ['天同', '忌']]);
  const ke = day.contacts.filter(c => c.sourceScope === 'monthly' && c.kind === '科');
  assert.deepEqual(ke.map(c => [c.star, c.branch]), [['天府', '申']]);
  assert.deepEqual(base, before);
});

test('whole leap months advance one position, retain their named month stem and never split on the sixteenth day', () => {
  assert.equal(yunLifeBranch('巳', 4, '午', 5), '丑');
  assert.equal(yunLifeBranch('巳', 4, '午', 6), '寅');
  assert.equal(yunLifeBranch('巳', 4, '午', 7), '卯');
  const result = build(span('2025-07-23T16:00:00Z', '2025-08-24T16:00:00Z'), 'month');
  assert.deepEqual(result.rows.map(r => [r.lunarMonth, r.leap, r.monthOrdinal, r.monthPillar, r.lifeBranch]), [
    [6, false, 5, '癸未', '丑'], [6, true, 6, '癸未', '寅'], [7, false, 7, '甲申', '卯'],
  ]);
  assert.equal(result.rows[1].start, Date.parse('2025-07-24T16:00:00Z'));
  assert.equal(result.rows[1].end, Date.parse('2025-08-22T16:00:00Z'));
  assert.equal(result.rows[0].financeMonthEnd, Date.parse('2025-07-24T15:00:00Z'));
  assert.equal(result.rows[1].financeMonthEnd, Date.parse('2025-08-22T15:00:00Z'));
  assert.equal(yunPalaceName('亥', '未'), '财帛'); assert.equal(yunPalaceName('亥', '巳'), '迁移');
  assert.throws(() => yunLifeBranch('巳', 4, '午', 13));
});

test('late-Zi keeps both calendar dates across month and year cuts, while month and decade intervals keep their own boundaries', () => {
  const result = build(span('2026-02-16T14:00:00Z', '2026-02-17T17:00:00Z'));
  const days = result.rows.filter(r => r.scope === 'daily');
  assert.deepEqual(days.map(r => [r.lunarYear, r.lunarMonth, r.lunarDay, r.sourceStem, r.sourceDayClock, r.dayMonthBasisAgreed]), [
    [2025, 12, 29, '辛', 'agreed', true], [2025, 12, 29, '辛', 'civil-midnight', false], [2026, 1, 1, '壬', 'zi-start', false],
    [2026, 1, 1, '壬', 'agreed', true], [2026, 1, 1, '壬', 'civil-midnight', true], [2026, 1, 2, '癸', 'zi-start', true],
    [2026, 1, 2, '癸', 'agreed', true],
  ]);
  assert.equal(days[0].end, Date.parse('2026-02-16T15:00:00Z'));
  assert.equal(days[1].end, Date.parse('2026-02-16T16:00:00Z'));
  assert.equal(result.rows.find(row => row.scope === 'monthly').end, Date.parse('2026-02-16T16:00:00Z'));
  assert.equal(result.rows.find(row => row.scope === 'monthly').financeMonthEnd, Date.parse('2026-02-16T15:00:00Z'));
  for (const [date, months] of [['2025-07-24', [false, true]], ['2025-08-22', [true, false]]]) {
    const overnight = build(span(date + 'T15:00:00Z', date + 'T16:00:00Z')).rows.filter(row => row.scope === 'daily');
    assert.deepEqual(overnight.map(row => row.leap), months);
    assert.ok(overnight.every(row => row.dayMonthBasisAgreed === false));
  }
  const w = span('2026-02-17T00:00:00Z', '2026-02-19T00:00:00Z'), cut = Date.parse('2026-02-17T10:00:00Z');
  const changed = buildYunZiweiWindow(w, 'month', natal(), [{ start: w.start, end: cut, stem: '己', branch: '卯' }, { start: cut, end: w.end, stem: '戊', branch: '寅' }]);
  assert.deepEqual(changed.rows.map(r => r.decadeStem), ['己', '戊']);
  assert.equal(changed.rows[0].end, changed.rows[1].start);
});

test('published Taiwan evening cases reproduce distinct daily pillars under the two clocks', () => {
  const cases = [
    ['2019-04-08', '23:13:20', [[4, '乙'], [5, '丙']], 'zi-start'],
    ['2019-06-03', '23:00:00', [[1, '辛'], [2, '壬']], 'zi-start'],
    ['2019-12-29', '23:00:00', [[4, '庚'], [5, '辛']], 'zi-start'],
    ['2022-02-16', '23:02:30', [[16, '庚'], [17, '辛']], 'civil-midnight'],
  ];
  for (const [date, localClock, expected, published] of cases) {
    const start = Date.parse(date + 'T' + localClock + '+08:00');
    const days = build({ start, end: start + 1000 }).rows.filter(row => row.scope === 'daily');
    assert.deepEqual(days.map(row => [row.lunarDay, row.sourceStem]), expected);
    const witness = days.find(row => row.sourceDayClock === published);
    assert.deepEqual([witness.lunarDay, witness.sourceStem], expected[published === 'civil-midnight' ? 0 : 1]);
    assert.ok(days.every(row => row.dayMonthBasisAgreed === true));
  }
});

test('malformed or inconsistent archives cannot silently produce a source frame', () => {
  const w = span('2026-02-17T00:00:00Z', '2026-02-18T00:00:00Z');
  for (const alter of [n => { n.rawDates.lunarDate.isLeap = true; }, n => { n.rawDates.chineseDate.hourly = ''; },
    n => { n.palaces[0].name = '命宫'; }, n => { n.palaces[0].ages = []; }, n => { n.palaces.push(structuredClone(n.palaces[0])); },
    n => { n.palaces[0].majorStars.push({ name: '天府' }); }]) {
    const base = natal(); alter(base); assert.equal(build(w, 'day', base).status, 'unavailable');
  }
});

test('official leap-birth reference uses the named birth month throughout and requires the archived chart to agree', () => {
  // Public synthetic lunar inputs to the same official plate API recorded in reference.sources.
  const cases = [
    ['2025-08-08', 6, 6, 15, '丑', '丑', '未', '丑子戌酉申巳卯辰巳午未申酉丑辰戌酉巳卯辰寅酉辰巳'],
    ['2025-08-09', 6, 6, 16, '丑', '丑', '未', '午巳卯寅丑戌戌亥子丑寅卯辰申辰戌酉巳卯辰寅酉辰巳'],
    ['2025-08-22', 4, 6, 29, '卯', '亥', '未', '午巳卯寅丑戌戌亥子丑寅卯辰申午申酉巳卯辰寅未寅卯'],
    ['1990-07-08', 4, 5, 16, '寅', '戌', '辰', '酉申午巳辰丑未申酉戌亥子丑巳午申申午申酉未巳未卯'],
  ];
  const keys = '紫微 天机 太阳 武曲 天同 廉贞 天府 太阴 贪狼 巨门 天相 天梁 七杀 破军 文昌 文曲 左辅 右弼 禄存 擎羊 陀罗 火星 铃星 地劫'.split(' ');
  const w = span('2025-07-23T16:00:00Z', '2025-08-24T16:00:00Z');
  for (const [dateStr, timeIndex, month, day, life, body, minor, positions] of cases) {
    assert.equal(positions.length, keys.length);
    const input = { dateStr, timeIndex, gender: '女', config };
    const compatible = astro.withOptions({ ...input, fixLeap: false }).toJSON();
    assert.deepEqual(compatible.rawDates.lunarDate, { lunarYear: Number(dateStr.slice(0, 4)), lunarMonth: month, lunarDay: day, isLeap: true });
    assert.equal(compatible.palaces.find(p => p.name === '命宫').earthlyBranch, life);
    assert.equal(compatible.palaces.find(p => p.isBodyPalace).earthlyBranch, body);
    assert.equal(compatible.palaces.find(p => p.ages[0] === 1).earthlyBranch, minor);
    for (const [i, name] of keys.entries()) {
      const palace = compatible.palaces.find(p => [...p.majorStars, ...p.minorStars, ...p.adjectiveStars].some(s => s.name === name));
      assert.equal(palace?.earthlyBranch, positions[i], dateStr + ' ' + name);
    }
    const before = structuredClone(compatible);
    const frames = build(w, 'month', compatible);
    assert.equal(frames.status, 'ready');
    assert.deepEqual(frames.rows.map(row => [row.leap, row.monthPillar]), [[false, '癸未'], [true, '癸未'], [false, '甲申']]);
    assert.ok(frames.rows.every(row => row.profile === yunZiweiPolicy.nominalLeapBirthFinanceProfile
      && row.birthMonthBasis === 'nominal-intercalary-month' && row.birthLunarMonth === month));
    assert.equal(frames.rows[1].financeMonthEnd, Date.parse('2025-08-22T15:00:00Z'));
    assert.deepEqual(compatible, before);

    const standard = astro.withOptions({ ...input, fixLeap: true }).toJSON();
    assert.equal(build(w, 'month', standard).status, day <= 15 ? 'ready' : 'unavailable', dateStr + ' standard archive');
    const forged = structuredClone(compatible);
    forged.rawDates.lunarDate.lunarDay -= 1;
    assert.equal(build(w, 'month', forged).status, 'unavailable');
    const swapped = structuredClone(compatible);
    const seats = swapped.palaces.filter(p => p.ages[0] === 1 || p.ages[0] === 2);
    [seats[0].ages, seats[1].ages] = [seats[1].ages, seats[0].ages];
    assert.equal(build(w, 'month', swapped).status, 'unavailable');
    if (dateStr === '1990-07-08') {
      for (const [star, source, target] of [['文昌', 'minorStars', 'adjectiveStars'], ['武曲', 'majorStars', 'minorStars']]) {
        const wrongLayer = structuredClone(compatible);
        const seat = wrongLayer.palaces.find(palace => palace[source].some(row => row.name === star));
        seat[target].push(seat[source].splice(seat[source].findIndex(row => row.name === star), 1)[0]);
        assert.equal(build(w, 'month', wrongLayer).status, 'unavailable', star);
      }
    }
    assert.equal(build(w, 'day', compatible).status, 'unavailable');
  }
});

test('verified leap-birth month areas keep unknown Sky separate and isolate reviewed monthly evidence', () => {
  const birth = { dateStr: '1990-07-08', timeIndex: 4, gender: '女', fixLeap: false };
  const cases = [
    [29, 2020, 5, '2020-05-22T16:00:00.000Z'],
    [30, 2012, 3, '2012-02-29T16:00:00.000Z'],
    [31, 2000, 5, '2000-04-30T16:00:00.000Z'],
  ];
  for (const [index, year, month, start] of cases) {
    const run = submitBirth('month', { year, month }, start, birth);
    const result = ruleResult(run, index);
    assert.equal(result.status, index === 30 ? 'matched' : 'partial');
    assert.ok(result.windows.some(window => window.start === start));
    const source = run.facts.find(fact => result.sourceFactIds.includes(fact.factId) && fact.activeFrom === start);
    const proof = source.normalizedPayload;
    assert.equal(source.factType, 'yun_month_finance_area');
    assert.equal(proof.profile, yunZiweiPolicy.nominalLeapBirthFinanceProfile);
    assert.equal(proof.birthMonthBasis, 'nominal-intercalary-month');
    assert.equal(proof.birthLunarMonth, 5);
    assert.deepEqual(proof.unverifiedShaLocations, ['天空']);
    assert.equal(proof.completeShaLocations, false);
    assert.ok(proof.positions.every(position => !position.sha.includes('天空') && !position.sha.includes('地空')));
    assert.equal(proof.investmentExamples, undefined);
    assert.ok(run.facts.filter(fact => fact.factType.startsWith('yun_')).every(fact => fact.factType === 'yun_month_finance_area'
      || (fact.factType === 'yun_month_property_contact'
        && fact.normalizedPayload.propertyReading === 'upper-taboo'
        && fact.normalizedPayload.birthMonthLayerProof === yunZiweiPolicy.nominalLeapBirthLayerProof)));
    assert.ok(!matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === 'fortune-entry-865').sourceFactIds.length);
    const { birthMonthLayerProof, ...oldPayload } = proof;
    assert.equal(birthMonthLayerProof, yunZiweiPolicy.nominalLeapBirthLayerProof);
    const withoutLayerProof = { ...run, facts: [{ ...source, normalizedPayload: oldPayload }] };
    assert.equal(ruleResult(withoutLayerProof, index).status, 'unknown');
    if (index === 30) {
      assert.deepEqual(result.windows, [{ start, endExclusive: '2012-03-21T15:00:00.000Z' }]);
      assert.deepEqual(proof.affectedFinance.map(({ star, branch, sourceScope }) => [star, branch, sourceScope]),
        [['武曲', '巳', 'yearly'], ['贪狼', '酉', 'monthly']]);
      assert.equal(proof.shaCount, 2);
      const afterBoundary = run.facts.filter(fact => fact.factType === 'yun_month_finance_area'
        && fact.activeFrom === '2012-03-21T16:00:00.000Z');
      assert.ok(afterBoundary.length > 0);
      assert.ok(afterBoundary.every(fact => fact.normalizedPayload.affectedFinanceCount === 1));
      assert.ok(afterBoundary.every(fact => !result.sourceFactIds.includes(fact.factId)));
    }
    if (index === 31) continue;
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'yun-leap-birth'));
    assert.match(formatFortuneFactAudit(input), /闰月出生时，按紫微雲同名月的实算星位/u);
    assert.match(formatFortuneFactAudit(input), /来源有分歧的煞曜位置保持待核，涉及天空/u);
    const prompt = formatFortunePrompt(input);
    if (index === 30) assert.match(prompt, /分别作用于两颗不同财星/u);
    assert.doesNotMatch(prompt, /名义闰生月|来源有分歧的煞曜位置保持待核|nominal-intercalary-month|birthMonthLayerProof/u);
  }
  const standard = submitBirth('month', { year: 2020, month: 5 }, '2020-05-22T16:00:00.000Z', { ...birth, fixLeap: true });
  assert.ok(!standard.facts.some(fact => fact.factType.startsWith('yun_')));
  assert.deepEqual(ruleResult(standard, 29).sourceFactIds, []);
});

test('verified leap-birth property months retain the known natal sha and actual upper Ji without assuming a minimum count', () => {
  const birth = { dateStr: '2025-08-09', timeIndex: 6, gender: '女', fixLeap: false };
  const samples = [
    [2031, 6, '2031-05-31T16:00:00.000Z', '2031-06-19T15:00:00.000Z', 'yearly', '文昌'],
    [2039, 10, '2039-09-30T16:00:00.000Z', '2039-10-17T15:00:00.000Z', 'minor', '文昌'],
  ];
  for (const [year, month, start, endExclusive, scope, star] of samples) {
    const run = submitBirth('month', { year, month }, start, birth);
    const result = ruleResult(run, 34);
    assert.equal(result.status, 'partial', year + ' ' + scope);
    assert.ok(result.windows.some(window => window.start === start && window.endExclusive === endExclusive), JSON.stringify(result.windows));
    const witness = run.facts.find(fact => result.sourceFactIds.includes(fact.factId) && fact.activeFrom === start
      && fact.normalizedPayload.sourceScope === scope);
    assert.equal(witness.factType, 'yun_month_property_contact');
    const { birthMonthLayerProof, ...payload } = witness.normalizedPayload;
    assert.equal(birthMonthLayerProof, yunZiweiPolicy.nominalLeapBirthLayerProof);
    assert.deepEqual([payload.star, payload.branch, payload.kind], [star, '辰', '忌']);
    assert.deepEqual(payload.shaWitnesses.map(row => row.star), ['擎羊', '铃星']);
    assert.deepEqual(payload.missingShaPlacements, [{ star: '天空', layer: 'natal' }]);
    assert.equal(ruleResult({ ...run, facts: [{ ...witness, normalizedPayload: payload }] }, 34).status, 'unknown');
    if (scope === 'yearly') {
      const scoped = { ...run, facts: [witness] };
      const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'yun-leap-property'));
      const audit = formatFortuneFactAudit(input);
      assert.match(audit, /该盘以紫微雲同名闰生月的已核归档推算/u);
      assert.match(audit, /归档本命擎羊在辰宫.*同宫/u);
      const prompt = formatFortunePrompt(input);
      assert.doesNotMatch(prompt, /名义闰生月|同名闰生月|擎羊在辰宫|birthMonthLayerProof|nominal-intercalary-month/u);
      assert.ok(!input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId));
    }
  }
  const oneSha = submitBirth('month', { year: 2000, month: 3 }, '2000-03-05T16:00:00.000Z',
    { ...birth, dateStr: '1990-07-08', timeIndex: 4 });
  assert.equal(ruleResult(oneSha, 34).status, 'partial');
  assert.ok(oneSha.facts.some(fact => fact.factType === 'yun_month_property_contact'
    && fact.normalizedPayload.shaWitnessCount === 1));
});

test('real source facts retain raw provenance, exact same-palace flags, all upper levels and no invented financial score', () => {
  const run = calculate('day', { date: '2026-02-23' }); validateFortuneFacts(run);
  const contacts = run.facts.filter(f => f.factType === 'yun_transformation_contact'); assert.ok(contacts.length);
  for (const f of contacts) {
    const p = f.normalizedPayload, c = run.facts.find(x => x.factType === 'yun_palace_condition' && x.scope === f.scope && x.activeFrom === f.activeFrom
      && x.normalizedPayload.branch === p.branch && x.normalizedPayload.sourceDayClock === p.sourceDayClock);
    assert.ok(c); assert.equal(p.natalName, c.normalizedPayload.natalName); assert.equal(p.flowName, c.normalizedPayload.flowName);
    assert.ok(c.normalizedPayload.localStarNames.includes(p.star)); assert.ok(f.sourceFactIds.length >= 2);
    assert.ok(f.sourceFactIds.every(id => run.rawFacts.some(r => r.rawFactId === id)));
    if (p.sourceScope === 'minor') assert.ok(['禄', '忌'].includes(p.kind));
    assert.equal(p.score, undefined); assert.equal(p.strength, undefined);
  }
  assert.ok(contacts.some(f => f.normalizedPayload.sourceScope === 'monthly' && f.normalizedPayload.sourceStem === '庚' && f.normalizedPayload.star === '天府' && f.normalizedPayload.kind === '科'));
});

test('submitted full birth facts keep the common 23:00 match and reject one clock or prerequisites split across clocks', () => {
  const submitted = date => submitBirth('day', { date }, date + 'T03:00:00Z');
  const hitsInLastHour = (run, index, date) => {
    const cut = date + 'T15:00:00.000Z';
    const rules = evaluateFortuneRules('ziwei', 'day', run.facts.filter(fact => fact.method === 'ziwei'));
    const reviewed = rules.find(rule => rule.knowledgeId === fortuneKnowledge.ziwei.rules[index].knowledgeId);
    return reviewed.required.map(query => query.hits.some(fact => fact.activeFrom === cut));
  };
  const common = submitted('2026-01-01');
  assert.deepEqual(hitsInLastHour(common, 36, '2026-01-01'), [true, false]);
  assert.equal(ruleResult(common, 36).windows[0].endExclusive, '2026-01-01T15:00:00.000Z');
  assert.deepEqual(hitsInLastHour(common, 43, '2026-01-01'), [true, true]);
  assert.ok(ruleResult(common, 43).windows.some(window => window.endExclusive === '2026-01-01T16:00:00.000Z'));
  const split = submitted('2026-01-27');
  assert.deepEqual(hitsInLastHour(split, 38, '2026-01-27'), [false, false]);
  assert.ok(ruleResult(split, 38).windows.every(window => window.endExclusive <= '2026-01-27T15:00:00.000Z'));
  const lunarYearEnd = submitted('2026-02-16');
  assert.deepEqual(hitsInLastHour(lunarYearEnd, 43, '2026-02-16'), [false, false]);
  assert.ok(!lunarYearEnd.facts.some(fact => fact.factType === 'yun_daily_reading' && fact.activeFrom >= '2026-02-16T15:00:00.000Z'));
  const { input } = buildFortuneModelContext(common, interpretFortune(common, requestForFortuneRun(common), 'yun-clock-day'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /午夜换日的流日候选/u);
  assert.match(prompt, /二十三点换日的流日候选/u);
  assert.doesNotMatch(prompt, /sourceDayClock|dayMonthBasisAgreed/u);
});

test('reviewed source queries reach SQLite and generic or other-author facts cannot replace them', () => {
  const week = calculate('week', { weekStartDate: '2026-02-23' });
  const month = calculate('month', { year: 2026, month: 2 });
  assert.equal(ruleResult(month, 29).status, 'partial');
  for (const [date, indices] of [['2026-01-01', [36, 37, 43]], ['2026-01-04', [46]]]) {
    const day = submitBirth('day', { date }, date + 'T03:00:00Z');
    const changed = structuredClone(day);
    changed.facts.filter(f => f.factType.startsWith('yun_')).forEach(f => { f.normalizedPayload.profile = 'ling-doujun-jie-month-civil-day-v1'; });
    for (const index of indices) {
      assert.equal(ruleResult(day, index).status, 'matched', String(index));
      assert.equal(ruleResult(week, index).status, 'not_applicable');
      assert.deepEqual(ruleResult(changed, index).sourceFactIds, []);
    }
  }
});

test('each of the twenty-one source mappings is reachable from a real chart and its effective day or month', () => {
  // These are synthesized algorithm samples, not the author's original people.
  const cases = [
    [29, '1990-05-05', '女', 6, '2026-01-19'], [30, '1990-05-05', '女', 6, '2017-04-26'],
    [31, '1990-05-05', '女', 6, '2020-06-21'], [32, '2000-01-01', '男', 6, '2014-01-31'],
    [33, '1990-05-05', '女', 6, '2026-01-19'], [34, '1963-01-15', '男', 6, '2014-10-24'],
    [35, '1973-07-15', '女', 9, '2014-09-24'], [36, '1990-05-05', '女', 6, '2026-01-01'],
    [37, '1990-05-05', '女', 6, '2026-01-01'], [38, '1990-05-05', '女', 6, '2014-05-03'],
    [39, '1976-07-12', '女', 2, '2003-11-27'], [40, '1990-05-05', '女', 6, '2026-01-05'],
    [41, '1990-05-05', '女', 6, '2026-02-01'], [42, '1990-05-05', '女', 6, '2026-01-01'],
    [43, '1990-05-05', '女', 6, '2026-01-01'], [44, '1990-05-05', '女', 6, '2026-01-09'],
    [45, '1990-05-05', '女', 6, '2025-08-02'], [46, '1990-05-05', '女', 6, '2026-01-04'],
    [47, '1963-03-15', '女', 0, '2014-10-01'], [48, '1983-11-08', '女', 6, '2025-05-30'],
    [49, '1942-05-20', '女', 8, '2015-11-26'],
  ];
  const cache = new Map();
  for (const [index, dateStr, gender, timeIndex, date] of cases) {
    const period = fortuneKnowledge.ziwei.rules[index].period;
    const key = [dateStr, gender, timeIndex, period, period === 'month' ? date.slice(0, 7) : date].join(':');
    let run = cache.get(key);
    if (!run) {
      const chart = snapshot(); chart.ziwei.rawResult = [astro.withOptions({ dateStr, gender, timeIndex, fixLeap: true, config }).toJSON()];
      run = calculate(period, period === 'month' ? { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) } : { date }, chart);
      validateFortuneFacts(run); cache.set(key, run);
    }
    const matched = ruleResult(run, index);
    assert.equal(matched.status, completedYunRules.has(index) || [30, 49].includes(index) ? 'matched' : 'partial', String(index));
    if (index === 49) assert.equal(matched.matchedSourceExcerpt, '流月流日流時');
    assert.ok(matched.windows.length && matched.sourceFactIds.length);
    assert.ok(matched.sourceFactIds.every(id => run.facts.find(f => f.factId === id)?.factType.startsWith('yun_')));
    if (index === 35) for (const id of matched.sourceFactIds) {
      const p = run.facts.find(f => f.factId === id).normalizedPayload;
      assert.equal(p.yearlyAtDecadeCareer, true);
      assert.deepEqual(p.sunJiScopesAtYearLife, ['decadal', 'yearly', 'minor', 'monthly']);
    }
  }
});

test('the annual wealth-property rule checks only the two actual endpoints of the overlaid annual axis', () => {
  const positive = submitBirth('month', { year: 2020, month: 6 }, '2020-06-22T04:00:00Z');
  const match = ruleResult(positive, 31);
  assert.equal(match.status, 'partial');
  const data = positive.facts.find(fact => match.sourceFactIds.includes(fact.factId)).normalizedPayload;
  assert.equal(data.area, 'year-axis');
  assert.deepEqual(data.positions.map(row => [row.yearlyName, row.branch]), [['财帛', '申'], ['福德', '寅']]);
  assert.ok(data.positions[0].transfers.some(row => row.sourceScope === 'yearly' && row.star === '天府' && row.kind === '科'));
  assert.ok(data.positions[0].transfers.some(row => row.sourceScope === 'monthly' && row.star === '紫微' && row.kind === '权'));
  assert.ok(data.positions[0].finance.some(row => row.star === '天府'));
  assert.equal(data.noRecordedTabooOrSha, true);
  const prompt = formatFortuneFactAudit(buildFortuneModelContext(positive,
    interpretFortune(positive, requestForFortuneRun(positive), 'yun-annual-axis')).input);
  assert.match(prompt, /流年轴线的财帛在申宫/u);
  assert.match(prompt, /流年轴线的福德在寅宫/u);

  const excluded = submitBirth('month', { year: 2019, month: 8 }, '2019-08-02T04:00:00Z');
  const at = '2019-08-02T04:00:00.000Z';
  const offAxis = excluded.facts.find(fact => fact.factType === 'yun_palace_condition' && fact.scope === 'monthly'
    && fact.activeFrom <= at && at < fact.activeTo && fact.normalizedPayload.flowName === '命宫');
  assert.deepEqual(offAxis.normalizedPayload.yearAxisEvidence.map(row => [row.yearlyName, row.branch]), [['子女', '申'], ['田宅', '寅']]);
  assert.ok(offAxis.normalizedPayload.surroundingPositiveScopes.includes('yearly'));
  assert.deepEqual(offAxis.normalizedPayload.yearAxisPositiveScopes, ['monthly']);
  assert.ok(!ruleResult(excluded, 31).windows.some(window => window.start <= at && at < window.endExclusive));
});

test('2014 solar Ji requires both complete ninth-month intervals from the same archived chart', () => {
  const natal = { dateStr: '1973-07-15', timeIndex: 9, gender: '女' };
  const expectedMonths = [
    [false, '2014-09-23T16:00:00.000Z', '2014-10-23T16:00:00.000Z'],
    [true, '2014-10-23T16:00:00.000Z', '2014-11-21T16:00:00.000Z'],
  ];
  const views = [
    [9, [['2014-09-23T16:00:00.000Z', '2014-09-30T16:00:00.000Z']]],
    [10, [['2014-09-30T16:00:00.000Z', '2014-10-23T15:00:00.000Z'], ['2014-10-23T16:00:00.000Z', '2014-10-31T16:00:00.000Z']]],
    [11, [['2014-10-31T16:00:00.000Z', '2014-11-21T15:00:00.000Z']]],
  ];
  for (const [month, windows] of views) {
    const run = submitBirth('month', { year: 2014, month }, windows[0][0], natal);
    const match = ruleResult(run, 35);
    assert.equal(match.status, 'matched');
    assert.deepEqual(match.windows, windows.map(([start, endExclusive]) => ({ start, endExclusive })));
    const facts = run.facts.filter(fact => match.sourceFactIds.includes(fact.factId));
    assert.equal(facts.length, windows.length);
    for (const { factType, normalizedPayload: payload } of facts) {
      assert.equal(factType, 'yun_sun_ji_pair');
      assert.equal(payload.sunJiNinthPairVerified, true);
      const pair = payload.sunJiNinthPair;
      assert.equal(pair.lunarYear, 2014);
      assert.equal(pair.occurrenceCount, 5);
      assert.deepEqual(pair.upper.map(row => row.sourceScope), ['decadal', 'yearly', 'minor']);
      assert.ok([...pair.upper, ...pair.months.map(row => row.monthly)].every(row =>
        row.star === '太阳' && row.branch === pair.yearLifeBranch && row.sourceStem === '甲'));
      assert.deepEqual(pair.months.map(row => [row.leap, row.start, row.end]), expectedMonths);
      assert.deepEqual(pair.months.map(row => row.monthPillar), ['甲戌', '甲戌']);
      assert.notEqual(pair.months[0].monthLifeBranch, pair.months[1].monthLifeBranch);
      assert.ok(pair.months.every(row => ['decadal', 'yearly', 'minor', 'monthly'].every(scope => row.scopes.includes(scope))));
    }
    if (month === 10) {
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'sun-ji-pair'));
      const audit = formatFortuneFactAudit(input);
      assert.match(audit, /常九月，月干支甲戌/u);
      assert.match(audit, /闰九月，月干支甲戌/u);
      assert.match(formatFortunePrompt(input), /農曆九月及閏九月/u);
      assert.doesNotMatch(formatFortunePrompt(input), /sunJiNinthPair|流年命宫都叠大限官禄/u);
    }
  }

  const window = yunSunJiCaseWindow();
  const archive = astro.withOptions({ ...natal, fixLeap: true, config });
  const decade = archive.horoscope('2014-09-24', 6).decadal;
  const rows = buildYunZiweiWindow(window, 'month', archive.toJSON(), [{ ...window, branch: decade.earthlyBranch, stem: decade.heavenlyStem }]).rows;
  assert.ok(yunSunJiCaseEvidence(rows, window));
  assert.equal(yunSunJiCaseEvidence(rows.slice(0, 1), window), undefined);
  const [normal, leap] = rows;
  assert.equal(yunSunJiCaseEvidence([normal, { ...leap, minorStem: '乙' }], window), undefined);
  const monthly = leap.contacts.find(c => c.sourceScope === 'monthly' && c.star === '太阳' && c.kind === '忌');
  assert.ok(monthly);
  assert.equal(yunSunJiCaseEvidence([normal, { ...leap, contacts: [...leap.contacts, monthly] }], window), undefined);
  assert.equal(yunSunJiCaseEvidence([normal, { ...leap, contacts: leap.contacts.filter(c => c !== monthly) }], window), undefined);

  const contrast = submitBirth('month', { year: 2024, month: 10 }, '2024-10-08T04:00:00Z',
    { dateStr: '1968-04-15', timeIndex: 11, gender: '女' });
  const single = contrast.facts.find(fact => fact.factType === 'yun_time_segment' && fact.scope === 'monthly'
    && fact.normalizedPayload.yearlyAtDecadeCareer === true && fact.normalizedPayload.sunJiScopesAtYearLife.length >= 4);
  assert.ok(single);
  assert.equal(single.normalizedPayload.sunJiNinthPairVerified, false);
  assert.deepEqual(ruleResult(contrast, 35).windows, []);
});

test('monthly wealth and property require an actual unaffected finance star in the same seat', () => {
  const contrasts = [
    [32, 2033, { dateStr: '1990-05-05', timeIndex: 6, gender: '女' }, ['minor'], []],
    [33, 2015, { dateStr: '1976-07-12', timeIndex: 2, gender: '女' }, ['yearly', 'minor'],
      [{ star: '天机', intrinsic: false, wealthPalaceScopes: [], luScopes: ['minor'] }]],
  ];
  for (const [index, year, birth, scopes, expectedSupport] of contrasts) {
    const at = year + '-07-15T04:00:00.000Z';
    const run = submitBirth('month', { year, month: 7 }, at, birth);
    const fact = run.facts.find(row => row.factType === 'yun_month_finance_support' && row.activeFrom <= at && at < row.activeTo
      && row.normalizedPayload.sourceScope === 'yearly');
    assert.ok(fact);
    const data = fact.normalizedPayload;
    assert.equal(data[index === 32 ? 'atWealth' : 'atProperty'], true);
    assert.deepEqual(data.localUpperWealthJi.map(row => [row.sourceScope, row.star]), scopes.map(scope => [scope, '太阴']));
    assert.deepEqual(data.localUpperClearWealthStars, []);
    assert.deepEqual(data.monthlyFinanceSupport, expectedSupport);
    assert.equal(ruleResult(run, index).windows.some(window => window.start <= at && at < window.endExclusive), Boolean(expectedSupport.length));
  }

  const positives = [
    [32, 2024, 10, { dateStr: '1960-02-15', timeIndex: 0, gender: '女' }, '武曲', '天府'],
    [33, 2025, 4, { dateStr: '1960-04-15', timeIndex: 3, gender: '女' }, '太阴', '禄存'],
  ];
  for (const [index, year, month, birth, taboo, supporting] of positives) {
    const monthPart = String(month).padStart(2, '0');
    const retained = submitBirth('month', { year, month }, year + '-' + monthPart + '-15T04:00:00Z', birth);
    const match = ruleResult(retained, index);
    assert.equal(match.status, 'matched');
    const fact = retained.facts.find(row => match.sourceFactIds.includes(row.factId)
      && row.normalizedPayload.localUpperWealthJi.some(change => change.star === taboo));
    assert.ok(fact);
    assert.deepEqual(fact.normalizedPayload.localUpperClearWealthStars, [supporting]);
    const description = describeFortuneFact({ method: 'ziwei', type: fact.factType, data: fact.normalizedPayload }, String);
    assert.deepEqual(fact.normalizedPayload.monthlyFinanceSupport.map(row => row.star), [supporting]);
    assert.ok(description.includes(supporting + '在同宫符合财星条件'));
    assert.ok(!description.includes(taboo + '在同宫符合财星条件'));
  }
});

test('ordinary monthly charts reach the wealth prompt and stop at the disputed lunar month boundary', () => {
  const run = submitBirth('month', { year: 2026, month: 3 }, '2026-03-02T04:00:00Z',
    { dateStr: '1988-04-18', timeIndex: 4, gender: '男' });
  const match = ruleResult(run, 32);
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.windows, [{ start: '2026-02-28T16:00:00.000Z', endExclusive: '2026-03-18T15:00:00.000Z' }]);
  const evidence = run.facts.find(fact => match.sourceFactIds.includes(fact.factId)).normalizedPayload;
  assert.equal(evidence.natalName, '财帛');
  assert.ok(evidence.monthlyFinanceSupport.every(row => !row.intrinsic && row.wealthPalaceScopes.includes('natal')));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'monthly-finance-model'));
  assert.ok(input.sections.find(section => section.id === 'wealth').findings.some(finding => finding.knowledgeId === match.knowledgeId));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /财帛宫提供资源主题/u);
  assert.doesNotMatch(prompt, /monthlyFinanceSupport|F\d+|天同化禄/u);
});

test('daily finance uses the affected star itself and preserves the independent same-palace Lu Cun branch', () => {
  for (const [index, date, star] of [[40, '2019-08-05', '武曲'], [41, '2019-06-18', '天同'], [44, '2019-01-03', '太阳']]) {
    const run = submitBirth('day', { date }, date + 'T04:00:00Z');
    const subject = run.facts.find(fact => fact.factType === 'yun_transformation_contact' && fact.scope === 'daily'
      && fact.normalizedPayload.sourceDayClock === 'agreed' && fact.normalizedPayload.sourceScope === 'daily'
      && fact.normalizedPayload.star === star && fact.normalizedPayload.kind !== '忌');
    assert.ok(subject);
    assert.equal(subject.normalizedPayload.dailyFinanceRecipientClear, false);
    assert.deepEqual(subject.normalizedPayload.localDailyFinanceStars.find(row => row.star === star)?.jiScopes, ['monthly']);
    assert.equal(ruleResult(run, index).status, 'not_matched', date);
  }
  const birth = { dateStr: '1976-07-12', timeIndex: 2, gender: '女' };
  for (const [date, star, basis] of [['2019-01-08', '天机', 'recipient'], ['2019-03-12', '右弼', 'recipient'], ['2026-01-14', '右弼', 'lu-cun']]) {
    const run = submitBirth('day', { date }, date + 'T04:00:00Z', birth);
    const match = ruleResult(run, 44);
    assert.equal(match.status, 'matched');
    const evidence = run.facts.find(fact => match.sourceFactIds.includes(fact.factId)
      && fact.normalizedPayload.receivingContacts.some(row => row.star === star)).normalizedPayload;
    assert.equal(evidence.financeBasis, basis);
    if (date === '2019-01-08') assert.ok(evidence.localFinanceRoles.some(row => row.star === '太阴' && !row.clearForDay));
    if (date === '2019-03-12') assert.deepEqual(evidence.financeRole.wealthPalaceScopes, ['monthly']);
    if (basis === 'lu-cun') {
      assert.equal(evidence.financeRole, undefined);
      assert.ok(evidence.localStars.includes('禄存'));
    }
  }
  const date = '2026-08-31';
  const run = submitBirth('day', { date }, date + 'T04:00:00Z');
  const work = ruleResult(run, 41);
  assert.equal(work.status, 'matched');
  const qualified = run.facts.find(fact => work.sourceFactIds.includes(fact.factId)
    && fact.normalizedPayload.receivingContacts.some(row => row.star === '天同' && row.kind === '权')).normalizedPayload;
  assert.equal(qualified.financeRole.intrinsic, false);
  assert.ok(qualified.financeRole.luScopes.includes('monthly') && !qualified.financeRole.luScopes.includes('daily'));
});

test('a non-finance recipient in natal property qualifies only when the named Di Jie shares its seat', () => {
  const birth = { dateStr: '1983-02-15', timeIndex: 9, gender: '女' }, date = '2026-01-02';
  const run = submitBirth('day', { date }, date + 'T04:00:00Z', birth);
  const hit = ruleResult(run, 47);
  assert.equal(hit.status, 'matched');
  const proof = run.facts.find(row => hit.sourceFactIds.includes(row.factId) && row.normalizedPayload.financeBasis === 'di-jie').normalizedPayload;
  assert.equal(proof.natalName, '田宅');
  assert.equal(proof.branch, '申');
  assert.equal(proof.financeRole, undefined);
  assert.deepEqual(proof.receivingContacts.map(row => [row.star, row.kind]), [['廉贞', '忌']]);
  assert.ok(proof.localStars.includes('地劫'));
  const frame = agreedFrame(date, astro.withOptions({ ...birth, fixLeap: true, config }).toJSON());
  const palaces = frame.palaces.map(palace => palace.branch === proof.branch ? { ...palace, hasDiJie: false } : palace);
  assert.ok(!yunDailyReadings({ ...frame, palaces }).some(row => row.reading === 'day-ji-at-property'));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'property-dijie'));
  assert.ok(input.sections.find(section => section.id === 'wealth').findings.some(row => row.knowledgeId === hit.knowledgeId));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /地劫仅作为并见条件/u);
  assert.doesNotMatch(prompt, /financeRole|廉贞化忌|F\d+/u);
});

test('the monthly financial rule counts affected stars once and permits two stars in one palace', () => {
  const input = { periodType: 'month', targetPeriod: { year: 2017, month: 4 }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse('2017-04-27T04:00:00Z');
  const archived = { snapshotId: 'yun-finance-area', chart: snapshot() };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, archived)));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), 'yun-finance-area', archived);
  validateFortuneFacts(run);
  const hit = ruleResult(run, 30);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: '2017-04-25T16:00:00.000Z', endExclusive: '2017-04-30T16:00:00.000Z' }]);
  const { normalizedPayload: area } = run.facts.find(fact => hit.sourceFactIds.includes(fact.factId));
  assert.deepEqual(area.affectedFinance.map(({ sourceScope, star, branch }) => [sourceScope, star, branch]),
    [['monthly', '太阴', '酉'], ['yearly', '巨门', '亥']]);
  assert.ok(area.positions.some(seat => seat.branch === '未' && seat.sha.includes('天空')));
  const { input: modelInput } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'yun-finance-area-report'));
  const audit = formatFortuneFactAudit(modelInput), prompt = formatFortunePrompt(modelInput);
  assert.match(audit, /流月所发的太阴化忌在酉宫/u);
  assert.match(audit, /流年所发的巨门化忌在亥宫/u);
  assert.match(prompt, /分别作用于两颗不同财星/u);
  assert.doesNotMatch(prompt, /affectedFinance|shaCount|流月所发的太阴化忌在酉宫|\b[FE]\d+\b/u);
  const unguarded = structuredClone(run);
  unguarded.facts.find(fact => hit.sourceFactIds.includes(fact.factId)).normalizedPayload.shaCount = 0;
  assert.deepEqual(ruleResult(unguarded, 30).sourceFactIds, []);

  const samePalace = submitBirth('month', { year: 2015, month: 3 }, '2015-03-15T04:00:00.000Z',
    { dateStr: '1976-07-12', timeIndex: 2, gender: '女' });
  const together = ruleResult(samePalace, 30);
  assert.equal(together.status, 'matched');
  const sameSeat = samePalace.facts.find(fact => together.sourceFactIds.includes(fact.factId));
  assert.deepEqual(sameSeat.normalizedPayload.affectedFinance.map(({ star, branch }) => [star, branch]),
    [['太阴', '申'], ['天机', '申']]);

  const counter = submitBirth('month', { year: 2015, month: 9 }, '2015-09-15T04:00:00.000Z');
  const bothJi = counter.facts.find(fact => fact.factType === 'yun_month_finance_area'
    && fact.normalizedPayload.area === 'life-area' && fact.activeFrom === '2015-09-12T16:00:00.000Z');
  assert.deepEqual(bothJi.normalizedPayload.affectedFinance.map(({ star, sourceScope }) => [star, sourceScope]),
    [['太阴', 'yearly'], ['太阴', 'monthly']]);
  assert.equal(bothJi.normalizedPayload.affectedFinanceCount, 1);
  assert.ok(!ruleResult(counter, 30).sourceFactIds.includes(bothJi.factId));
});

test('Yun confirms distinct clear life-area and annual-axis month paths with independently located Ji', () => {
  const cases = [
    { index: 29, birth: { dateStr: '1998-09-06', timeIndex: 7, gender: '女' }, year: 2024, month: 10,
      area: 'life-area', start: '2024-10-02T16:00:00.000Z', end: '2024-10-31T15:00:00.000Z', counts: [3, 3, 3],
      statement: /四宫合计同时见流年与流月的禄、权、科/u, other: /两端分别有财星实际受正向支持/u },
    { index: 31, birth: { dateStr: '1990-05-05', timeIndex: 8, gender: '女' }, year: 2044, month: 11,
      area: 'year-axis', start: '2044-10-31T16:00:00.000Z', end: '2044-11-18T15:00:00.000Z', counts: [2, 2, 2],
      statement: /两端分别有财星实际受正向支持/u, other: /四宫合计同时见流年与流月的禄、权、科/u },
  ];
  for (const { index, birth, year, month, area, start, end, counts, statement, other } of cases) {
    const run = submitBirth('month', { year, month }, start, birth);
    const result = ruleResult(run, index);
    assert.equal(result.status, 'matched');
    assert.deepEqual(result.windows, [{ start, endExclusive: end }]);
    const fact = run.facts.find(fact => result.sourceFactIds.includes(fact.factId));
    const data = fact.normalizedPayload;
    assert.equal(data.area, area);
    assert.deepEqual([data.annualPositiveKindCount, data.monthlyPositiveKindCount, data.clearFinanceSupportStarCount], counts);
    assert.equal(data.noRecordedTabooOrSha, true);
    if (area === 'year-axis') assert.equal(data.clearFinanceSupportSeatCount, 2);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'yun-clear-area'));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, statement);
    assert.doesNotMatch(prompt, other);
    assert.doesNotMatch(prompt, /clearFinanceSupportStarCount|annualPositiveKindCount|\b[FE]\d+\b/u);
    const uncertain = { ...fact, normalizedPayload: { ...data, noRecordedTabooOrSha: undefined } };
    const missing = ruleResult({ ...run, facts: [uncertain] }, index);
    assert.equal(missing.status, 'partial');
    const [frame] = build(span(start, end), 'month', astro.withOptions({ ...birth, fixLeap: true, config }).toJSON()).rows;
    const unavailable = { ...frame, contacts: frame.contacts.filter(contact => contact.kind !== '忌' || contact.sourceScope !== 'yearly') };
    assert.equal(yunMonthlyFinanceAreas(unavailable).find(row => row.area === area).noRecordedTabooOrSha, undefined);
  }
});

test('monthly finance confirms the supported life area and annual axis when verified taboo and Sha occupy different seats', () => {
  const cases = [
    { index: 29, area: 'life-area', birthDate: '1990-05-05', timeIndex: 6, year: 2027, month: 7,
      at: '2027-07-04T04:00:00.000Z', start: '2027-07-03T16:00:00.000Z', end: '2027-07-31T16:00:00.000Z',
      taboo: ['亥'], sha: ['未', '酉'], qualifies: true },
    { index: 29, area: 'life-area', birthDate: '1990-05-05', timeIndex: 3, year: 2006, month: 2,
      at: '2006-02-28T04:00:00.000Z', commonSeat: '未', qualifies: false },
    { index: 31, area: 'year-axis', birthDate: '1988-02-26', timeIndex: 3, year: 2007, month: 1,
      at: '2007-01-19T04:00:00.000Z', start: '2007-01-18T16:00:00.000Z', end: '2007-01-31T16:00:00.000Z',
      taboo: ['未'], sha: ['丑'], qualifies: true },
    { index: 31, area: 'year-axis', birthDate: '1976-07-12', timeIndex: 6, year: 2046, month: 3,
      at: '2046-03-08T04:00:00.000Z', commonSeat: '辰', qualifies: false },
  ];
  for (const example of cases) {
    const { area, index, birthDate, timeIndex, year, month, at, qualifies } = example;
    const birth = { dateStr: birthDate, timeIndex, gender: '女' };
    const run = submitBirth('month', { year, month }, at, birth);
    const fact = run.facts.find(row => row.factType === 'yun_month_finance_area' && row.normalizedPayload.area === area
      && row.activeFrom <= at && at < row.activeTo);
    assert.ok(fact, at);
    const data = fact.normalizedPayload;
    assert.equal(data.separatedTabooAndSha, qualifies);
    assert.equal(data.completeShaLocations, true);
    assert.equal(data.noRecordedTabooOrSha, false);
    assert.ok(data.annualPositiveKindCount >= (area === 'life-area' ? 3 : 2));
    assert.ok(data.monthlyPositiveKindCount >= (area === 'life-area' ? 3 : 2));
    const isolated = { ...run, facts: [fact] };
    const result = ruleResult(isolated, index);
    if (!qualifies) {
      assert.equal(result.status, 'partial');
      assert.ok(data.tabooShaSameSeat.some(row => row.branch === example.commonSeat));
      continue;
    }
    assert.deepEqual(data.positions.filter(row => row.transfers.some(contact => contact.kind === '忌')).map(row => row.branch), example.taboo);
    assert.deepEqual(data.positions.filter(row => row.sha.length > 0).map(row => row.branch), example.sha);
    assert.deepEqual(data.tabooShaSameSeat, []);
    assert.equal(result.status, 'matched');
    assert.deepEqual(result.windows, [{ start: example.start, endExclusive: example.end }]);
    assert.deepEqual(result.sourceFactIds, [fact.factId]);
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'yun-separated-finance'));
    assert.match(formatFortuneFactAudit(input), /已核化忌与本命煞曜均见于该区域，但分守不同宫位/u);
    assert.match(formatFortunePrompt(input), /忌曜与煞曜分宫|轴上有忌曜和煞曜，各在不同宫/u);
    assert.doesNotMatch(formatFortunePrompt(input), /separatedTabooAndSha|均见于该区域|\b[FE]\d+\b/u);
    const missing = { ...fact, normalizedPayload: { ...data, separatedTabooAndSha: undefined } };
    assert.equal(ruleResult({ ...run, facts: [missing] }, index).status, 'partial');
    const [frame] = build(span(example.start, example.end), 'month', astro.withOptions({ ...birth, fixLeap: true, config }).toJSON()).rows;
    const unknown = { ...frame, contacts: frame.contacts.filter(contact => contact.kind !== '忌' || contact.sourceScope !== 'yearly') };
    assert.equal(yunMonthlyFinanceAreas(unknown).find(row => row.area === area).separatedTabooAndSha, undefined);
  }
});

test('monthly finance distinguishes a single verified taboo-or-Sha category in the life area and annual axis', () => {
  const cases = [
    { index: 29, area: 'life-area', birth: ['1976-07-12', 6], period: [2024, 10],
      start: '2024-10-02T16:00:00.000Z', end: '2024-10-31T15:00:00.000Z', taboo: [], sha: ['巳'] },
    { index: 29, area: 'life-area', birth: ['1990-05-05', 0], period: [2032, 1],
      start: '2032-01-12T16:00:00.000Z', end: '2032-01-31T16:00:00.000Z', taboo: ['辰'], sha: [] },
    { index: 31, area: 'year-axis', birth: ['1990-05-05', 6], period: [2012, 1],
      start: '2012-01-22T16:00:00.000Z', end: '2012-01-31T16:00:00.000Z', taboo: [], sha: ['未'] },
    { index: 31, area: 'year-axis', birth: ['1990-05-05', 0], period: [2016, 12],
      start: '2016-12-28T16:00:00.000Z', end: '2016-12-31T16:00:00.000Z', taboo: ['戌'], sha: [] },
  ];
  for (const example of cases) {
    const [year, month] = example.period, [dateStr, timeIndex] = example.birth;
    const { area, index, start, end } = example, birth = { dateStr, timeIndex, gender: '女' };
    const at = new Date(Date.parse(start) + 2 * 3600000).toISOString();
    const run = submitBirth('month', { year, month }, at, birth);
    const fact = run.facts.find(other => other.factType === 'yun_month_finance_area'
      && other.activeFrom === start && other.normalizedPayload.area === area);
    assert.ok(fact, start);
    const data = fact.normalizedPayload;
    assert.equal(data.completeShaLocations, true, start);
    assert.equal(data.onlyTabooOrOnlySha, true, start);
    assert.deepEqual([data.separatedTabooAndSha, data.noRecordedTabooOrSha, data.tabooShaSameSeat], [false, false, []], start);
    assert.deepEqual(data.positions.filter(row => row.transfers.some(contact => contact.kind === '忌')).map(row => row.branch), example.taboo);
    assert.deepEqual(data.positions.filter(row => row.sha.length > 0).map(row => row.branch), example.sha);
    const scoped = { ...run, facts: [fact] }, hit = ruleResult(scoped, index);
    assert.equal(hit.status, 'matched', start);
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start, endExclusive: end }]);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'yun-only-taboo-or-sha'));
    assert.match(formatFortunePrompt(input), index === 29 ? /流月之命宮/u : /財福線、子田線/u);
    assert.doesNotMatch(formatFortunePrompt(input), /onlyTabooOrOnlySha|忌煞宫位[子丑寅卯辰巳午未申酉戌亥]|\b[FE]\d+\b/u);

    const [frame] = build(span(start, end), 'month', astro.withOptions({ ...birth, fixLeap: true, config }).toJSON()).rows;
    const incompleteTaboos = { ...frame, contacts: frame.contacts.filter(contact => contact.kind !== '忌' || contact.sourceScope !== 'yearly') };
    const incompleteSha = { ...frame, palaces: frame.palaces.map(palace => ({
      ...palace, localFinanceShaStars: palace.localFinanceShaStars.filter(star => star !== '火星'),
    })) };
    for (const incomplete of [incompleteTaboos, incompleteSha]) {
      const payload = yunMonthlyFinanceAreas(incomplete).find(row => row.area === area);
      assert.equal(payload.onlyTabooOrOnlySha, undefined, start);
      assert.notEqual(ruleResult({ ...scoped, facts: [{ ...fact, normalizedPayload: { ...data, ...payload } }] }, index).status, 'matched');
    }
  }
});

test('annual finance and property axes keep repeated genuine emitter layers as one recipient with seated Sha', () => {
  const cases = [
    { birth: ['1990-05-05', 6], period: [2010, 8], start: '2010-08-09T16:00:00.000Z', end: '2010-08-31T16:00:00.000Z',
      branch: '巳', yearlyName: '田宅', star: '太阳', stem: '甲', scope: 'minor', sha: '地劫' },
    { birth: ['1988-02-26', 3], period: [2007, 7], start: '2007-07-13T16:00:00.000Z', end: '2007-07-31T16:00:00.000Z',
      branch: '丑', yearlyName: '福德', star: '巨门', stem: '丁', scope: 'yearly', sha: '铃星' },
    { birth: ['2025-08-08', 6], period: [2038, 9], start: '2038-09-28T16:00:00.000Z', end: '2038-09-30T16:00:00.000Z',
      branch: '酉', yearlyName: '田宅', star: '武曲', stem: '壬', scope: 'minor', sha: '火星', nominal: true },
  ];
  for (const example of cases) {
    const { birth: [dateStr, timeIndex], period: [year, month], start, end, branch, yearlyName, star, stem, scope, sha, nominal = false } = example;
    const birth = { dateStr, timeIndex, gender: '女', fixLeap: !nominal };
    const at = new Date(Date.parse(start) + 2 * 3600000).toISOString();
    const run = submitBirth('month', { year, month }, at, birth);
    const fact = run.facts.find(other => other.factType === 'yun_month_finance_area'
      && other.activeFrom === start && other.normalizedPayload.area === 'year-axis');
    assert.ok(fact, start);
    const data = fact.normalizedPayload;
    assert.equal(data.yearAxisTabooShaCandidate, nominal ? undefined : false, start);
    assert.equal(data.yearAxisRepeatedTabooShaCandidate, true, start);
    assert.ok(data.affectedFinanceCount <= 1, start);
    assert.deepEqual(data.yearAxisRepeatedTabooShaWitnesses, [{
      branch, yearlyName, sha: [sha],
      monthTaboo: { star, sourceScope: 'monthly', sourceStem: stem, kind: '忌' },
      upperTaboos: [{ star, sourceScope: scope, sourceStem: stem, kind: '忌' }],
    }]);
    const scoped = { ...run, facts: [fact] }, hit = ruleResult(scoped, 30);
    assert.equal(hit.status, 'matched', start);
    assert.equal(hit.matchedSourceExcerpt, '多流年（小限）、流月忌煞同座');
    assert.deepEqual(hit.windows, [{ start, endExclusive: end }]);
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'yun-axis-repeated-taboo'));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /多流年（小限）、流月忌煞同座/u);
    assert.doesNotMatch(prompt, /yearAxisRepeatedTabooShaWitnesses|田宅巳宫|福德丑宫|田宅酉宫|birthMonthLayerProof/u);

    const rawChart = astro.withOptions({ ...birth, config }).toJSON();
    const [frame] = build(span(start, end), 'month', rawChart).rows;
    const wrongSeat = { ...frame, contacts: frame.contacts.map(contact =>
      contact.sourceScope === scope && contact.kind === '忌' ? { ...contact, branch: branch === '巳' ? '亥' : '未' } : contact) };
    const missingLayer = { ...frame, contacts: frame.contacts.filter(contact => contact.sourceScope !== scope || contact.kind !== '忌') };
    const missingSha = { ...frame, palaces: frame.palaces.map(palace => ({ ...palace,
      localFinanceShaStars: palace.localFinanceShaStars.filter(name => name !== sha),
    })) };
    for (const [changed, expected] of [[wrongSeat, nominal ? undefined : false], [missingLayer, undefined], [missingSha, undefined]]) {
      const payload = yunMonthlyFinanceAreas(changed).find(row => row.area === 'year-axis');
      assert.equal(payload.yearAxisRepeatedTabooShaCandidate, expected, start);
      assert.notEqual(ruleResult({ ...scoped, facts: [{ ...fact, normalizedPayload: { ...data, ...payload } }] }, 30).status, 'matched');
    }
    if (nominal) {
      const { birthMonthLayerProof, ...withoutProof } = data;
      assert.equal(birthMonthLayerProof, yunZiweiPolicy.nominalLeapBirthLayerProof);
      assert.deepEqual(data.unverifiedShaLocations, ['天空']);
      assert.equal(ruleResult({ ...scoped, facts: [{ ...fact, normalizedPayload: withoutProof }] }, 30).status, 'unknown');
      const wrongLayer = structuredClone(rawChart);
      const seat = wrongLayer.palaces.find(palace => palace.earthlyBranch === branch);
      const position = seat.minorStars.findIndex(row => row.name === sha);
      assert.ok(position >= 0, sha);
      seat.adjectiveStars.push(seat.minorStars.splice(position, 1)[0]);
      assert.equal(build(span(start, end), 'month', wrongLayer).status, 'unavailable');
    }
  }
});

test('annual property-axis monthly harm requires two actual taboos and Sha guarding the same seat', () => {
  const birth = { dateStr: '1976-07-12', timeIndex: 2, gender: '女' };
  const run = submitBirth('month', { year: 2023, month: 2 }, '2023-02-15T04:00:00.000Z', birth);
  const result = ruleResult(run, 30);
  const cutoff = '2023-02-19T15:00:00.000Z';
  assert.equal(result.status, 'matched');
  assert.equal(result.matchedSourceExcerpt, '多流年（小限）、流月忌煞同座');
  assert.deepEqual(result.windows, [{ start: '2023-01-31T16:00:00.000Z', endExclusive: cutoff }]);
  const area = run.facts.find(fact => result.sourceFactIds.includes(fact.factId));
  const data = area.normalizedPayload;
  assert.equal(data.area, 'year-axis');
  assert.equal(data.affectedFinanceCount, 0);
  assert.equal(data.yearAxisTabooShaCandidate, true);
  assert.deepEqual(data.yearAxisTabooShaWitnesses, [{
    branch: '午', yearlyName: '田宅', sha: ['擎羊'],
    monthTaboo: { star: '太阳', sourceScope: 'monthly', sourceStem: '甲', kind: '忌' },
    upperTaboos: [{ star: '文曲', sourceScope: 'minor', sourceStem: '己', kind: '忌' }],
  }]);
  const nextMonth = '2023-02-19T16:00:00.000Z';
  assert.ok(run.facts.some(fact => fact.factType === area.factType && fact.activeFrom === nextMonth));
  assert.ok(!run.facts.some(fact => fact.factType === area.factType && fact.activeFrom >= cutoff && result.sourceFactIds.includes(fact.factId)));

  const month = build(span(area.activeFrom, cutoff), 'month', astro.withOptions({ ...birth, fixLeap: true, config }).toJSON()).rows[0];
  const displaced = { ...month, contacts: month.contacts.map(contact => contact.sourceScope === 'minor' && contact.kind === '忌'
    ? { ...contact, branch: '子' } : contact) };
  assert.equal(yunMonthlyFinanceAreas(displaced).find(row => row.area === 'year-axis').yearAxisTabooShaCandidate, false);
  const repeated = { ...month, contacts: month.contacts.map(contact => contact.sourceScope === 'minor' && contact.kind === '忌'
    ? { ...contact, star: '太阳' } : contact) };
  assert.equal(yunMonthlyFinanceAreas(repeated).find(row => row.area === 'year-axis').yearAxisTabooShaCandidate, false);
  const wrongLayer = snapshot();
  const natal = astro.withOptions({ ...birth, fixLeap: true, config }).toJSON();
  wrongLayer.ziwei.rawResult = [natal];
  const samePalace = natal.palaces.find(palace => palace.earthlyBranch === '午');
  const misplaced = samePalace.minorStars.find(row => row.name === '擎羊');
  assert.ok(misplaced);
  samePalace.minorStars = samePalace.minorStars.filter(row => row !== misplaced);
  samePalace.adjectiveStars.push(misplaced);
  const wrongRun = submitChart('month', { year: 2023, month: 2 }, '2023-02-15T04:00:00.000Z', wrongLayer);
  const wrongArea = wrongRun.facts.find(fact => fact.factType === area.factType && fact.activeFrom === area.activeFrom
    && fact.normalizedPayload.area === 'year-axis');
  assert.ok(wrongArea);
  assert.equal(wrongArea.normalizedPayload.completeShaLocations, false);
  assert.equal(wrongArea.normalizedPayload.yearAxisTabooShaCandidate, undefined);
  assert.deepEqual(wrongArea.normalizedPayload.yearAxisTabooShaWitnesses, []);
  assert.ok(wrongArea.normalizedPayload.positions.every(row => !row.sha.includes('擎羊')));
  assert.equal(ruleResult({ ...wrongRun, facts: [wrongArea] }, 30).status, 'unknown');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'yun-axis-taboo'));
  const evidence = /流年田宅午宫，小限文曲化忌与流月太阳化忌、擎羊同守/u;
  assert.match(formatFortuneFactAudit(input), evidence);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /轴线上同一宫有流月化忌，另有流年或小限化忌作用于另一颗星/u);
  assert.doesNotMatch(prompt, evidence);
  assert.doesNotMatch(prompt, /yearAxisTabooShaWitnesses/u);
});

test('monthly finance accepts actual annual Quan Ke and independently verified minor Lu without replacing monthly positives', () => {
  const birth = { dateStr: '1965-09-15', timeIndex: 3, gender: '女' };
  const run = submitBirth('month', { year: 2020, month: 9 }, '2020-09-10T04:00:00.000Z', birth);
  const start = '2020-08-31T16:00:00.000Z', end = '2020-09-16T15:00:00.000Z';
  const area = run.facts.find(fact => fact.factType === 'yun_month_finance_area' && fact.activeFrom === start
    && fact.normalizedPayload.area === 'life-area');
  assert.ok(area);
  const data = area.normalizedPayload;
  assert.equal(data.annualQuanKeWithMinorLu, true);
  assert.deepEqual([data.annualPositiveKindCount, data.monthlyPositiveKindCount, data.clearFinanceSupportStarCount, data.noRecordedTabooOrSha],
    [2, 3, 5, true]);
  const deposited = data.positions.find(seat => seat.branch === '亥').transfers;
  assert.ok(deposited.some(row => row.sourceScope === 'minor' && row.kind === '禄' && row.star === '贪狼'));
  assert.ok(deposited.some(row => row.sourceScope === 'monthly' && row.kind === '禄' && row.star === '廉贞'));
  const hit = ruleResult(run, 29);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start, endExclusive: end }]);
  const later = run.facts.find(fact => fact.factType === area.factType && fact.normalizedPayload.area === 'life-area'
    && fact.activeFrom >= end);
  assert.ok(later);
  assert.notEqual(ruleResult({ ...run, facts: [later] }, 29).status, 'matched');
  const frame = build(span(start, end), 'month', astro.withOptions({ ...birth, fixLeap: true, config }).toJSON()).rows[0];
  const outside = frame.palaces.find(seat => !data.positions.some(position => position.branch === seat.branch)).branch;
  const withoutMinor = { ...frame, contacts: frame.contacts.map(row => row.sourceScope === 'minor' && row.kind === '禄'
    ? { ...row, branch: outside } : row) };
  assert.equal(yunMonthlyFinanceAreas(withoutMinor).find(row => row.area === 'life-area').annualQuanKeWithMinorLu, false);

  const separated = submitBirth('month', { year: 2003, month: 5 }, '2003-05-15T05:00:00.000Z', birth);
  const [open, close] = ['2003-04-30T16:00:00.000Z', '2003-05-30T15:00:00.000Z'];
  const split = separated.facts.find(fact => fact.factType === area.factType && fact.activeFrom === open
    && fact.normalizedPayload.area === 'life-area');
  const supported = split.normalizedPayload;
  assert.deepEqual([supported.annualQuanKeWithMinorLu, supported.monthlyPositiveKindCount, supported.clearFinanceSupportStarCount,
    supported.separatedTabooAndSha, supported.noRecordedTabooOrSha], [true, 3, 3, true, false]);
  assert.deepEqual(supported.tabooShaSameSeat, []);
  assert.deepEqual(supported.positions.filter(seat => seat.transfers.some(contact => contact.kind === '忌')).map(seat => seat.branch), ['子']);
  assert.deepEqual(supported.positions.filter(seat => seat.sha.length).map(seat => seat.branch), ['寅', '午']);
  const separatedMonth = { ...separated, facts: [split] };
  assert.deepEqual(ruleResult(separatedMonth, 29).windows, [{ start: open, endExclusive: close }]);
  assert.equal(ruleResult(separatedMonth, 29).status, 'matched');
  const splitInput = buildFortuneModelContext(separatedMonth,
    interpretFortune(separatedMonth, requestForFortuneRun(separatedMonth), 'yun-mixed-separated')).input;
  assert.match(formatFortunePrompt(splitInput), /化忌及本命六煞各有实位而分宫/u);
  assert.doesNotMatch(formatFortunePrompt(splitInput), /annualQuanKeWithMinorLu|分守不同宫位|巨门|[子寅午]宫/u);
  const missing = { ...split, normalizedPayload: { ...supported, separatedTabooAndSha: undefined } };
  assert.equal(ruleResult({ ...separated, facts: [missing] }, 29).status, 'partial');
  const lastDay = submitBirth('day', { date: '2003-05-30' }, '2003-05-30T04:00:00.000Z', birth);
  const clipped = lastDay.facts.find(fact => fact.factType === area.factType && fact.normalizedPayload.area === 'life-area');
  assert.deepEqual([clipped.activeFrom, clipped.activeTo], ['2003-05-29T16:00:00.000Z', close]);
  assert.equal(clipped.normalizedPayload.separatedTabooAndSha, true);
  assert.equal(clipped.normalizedPayload.annualQuanKeWithMinorLu, true);
  assert.deepEqual(ruleResult(lastDay, 29).windows, []);
  const late = submitBirth('day', { date: '2003-05-31' }, '2003-05-31T04:00:00.000Z', birth);
  const nextDay = late.facts.find(fact => fact.factType === area.factType && fact.normalizedPayload.area === 'life-area');
  assert.equal(nextDay.normalizedPayload.annualQuanKeWithMinorLu, false);

  const blocked = submitBirth('month', { year: 2013, month: 5 }, '2013-05-18T04:00:00.000Z',
    { dateStr: '1990-05-05', timeIndex: 4, gender: '女' });
  const bad = blocked.facts.find(fact => fact.factType === area.factType && fact.normalizedPayload.annualQuanKeWithMinorLu);
  assert.ok(bad);
  assert.equal(bad.normalizedPayload.noRecordedTabooOrSha, false);
  assert.equal(bad.normalizedPayload.separatedTabooAndSha, false);
  assert.equal(bad.normalizedPayload.monthlyPositiveKindCount, 3);
  assert.ok(bad.normalizedPayload.tabooShaSameSeat.some(row => row.branch === '巳' && row.sha.includes('火星')));
  assert.equal(ruleResult({ ...blocked, facts: [bad] }, 29).status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'yun-minor-lu-support'));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /流年实际见化权、化科，小限实际见化禄/u);
  assert.doesNotMatch(prompt, /贪狼|annualQuanKeWithMinorLu/u);
});

test('monthly finance can verify two clean year and month beneficiaries on the actual annual axis overlap', () => {
  const birth = { dateStr: '1980-03-05', timeIndex: 10, gender: '女' };
  const query = { year: 1992, month: 12 }, at = '1992-12-15T05:00:00.000Z';
  const run = submitBirth('month', query, at, birth), index = 31;
  const start = '1992-11-30T16:00:00.000Z', endExclusive = '1992-12-23T15:00:00.000Z';
  const axis = fact => fact.factType === 'yun_month_finance_area' && fact.normalizedPayload.area === 'year-axis';
  const fact = run.facts.find(row => axis(row) && row.activeFrom === start);
  assert.ok(fact);
  const data = fact.normalizedPayload, field = 'yearAxisLifeSeatFinanceSupportCandidate';
  assert.deepEqual([data[field], data.clearFinanceSupportSeatCount, data.clearFinanceCount, data.noRecordedTabooOrSha], [true, 1, 3, true]);
  assert.deepEqual(data.positions.map(({ branch, yearlyName }) => [branch, yearlyName]), [['辰', '财帛'], ['戌', '福德']]);
  assert.deepEqual(data.yearAxisLifeSeatFinanceSupportWitness, { branch: '辰', contacts: ['yearly', 'monthly'].flatMap(sourceScope => [
    { star: '天梁', sourceScope, sourceStem: '壬', kind: '禄' }, { star: '左辅', sourceScope, sourceStem: '壬', kind: '科' },
  ]) });
  const scoped = { ...run, facts: [fact] }, hit = ruleResult(scoped, index);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '財福線、子田線');
  assert.deepEqual(hit.windows, [{ start, endExclusive }]);
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  const withoutAlignment = { ...fact, normalizedPayload: { ...data, [field]: false } };
  assert.equal(ruleResult({ ...run, facts: [withoutAlignment] }, index).status, 'partial');
  const next = run.facts.find(row => axis(row) && row.activeFrom >= endExclusive);
  assert.ok(next);
  assert.equal(next.normalizedPayload[field], false);
  assert.notEqual(ruleResult({ ...run, facts: [next] }, index).status, 'matched');
  const day = submitBirth('day', { date: '1992-12-23' }, '1992-12-23T05:00:00.000Z', birth);
  const onDay = day.facts.find(axis);
  assert.equal(onDay.normalizedPayload[field], true);
  assert.deepEqual([onDay.activeFrom, onDay.activeTo], ['1992-12-22T16:00:00.000Z', endExclusive]);
  assert.deepEqual(ruleResult(day, index).windows, []);
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'yun-annual-axis-actual-overlap'));
  assert.match(formatFortuneFactAudit(input), /流月命实际叠在辰宫，轴线两端只在该宫同时核到年月吉化直接助财星/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /流月命实际叠在流年财福轴或子田轴的一端/u);
  assert.doesNotMatch(prompt, /yearAxisLifeSeatFinanceSupport|辰宫|天梁|左辅|\b[FE]\d+\b/u);
});

test('the month wealth example binds the beneficiary to the actual wealth seat and separately excludes named life obstacles', () => {
  const cases = [
    { month: 2, date: '2026-02-20', birth: { dateStr: '1990-05-05', timeIndex: 0, gender: '女' },
      life: '卯', wealth: '亥', star: '武曲', kind: '权', dijie: false, ji: undefined },
    { month: 10, date: '2026-10-17', birth: { dateStr: '1990-05-05', timeIndex: 0, gender: '女' },
      life: '亥', wealth: '未', star: '右弼', kind: '科', dijie: true, ji: undefined },
    { month: 6, date: '2026-06-21', birth: { dateStr: '1984-03-15', timeIndex: 2, gender: '女' },
      life: '亥', wealth: '未', star: '破军', kind: '权', dijie: false, ji: '廉贞' },
  ];
  const investmentMatch = run => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === 'fortune-entry-865');
  for (const { month, date, birth, life, wealth, star, kind, dijie, ji } of cases) {
    const at = date + 'T04:00:00.000Z';
    const run = submitBirth('month', { year: 2026, month }, at, birth);
    const fact = run.facts.find(fact => fact.factType === 'yun_month_finance_area'
      && fact.normalizedPayload.area === 'life-area' && fact.activeFrom <= at && at < fact.activeTo);
    const data = fact.normalizedPayload;
    const proof = data.investmentExamples;
    assert.equal(data.monthWealthSupportWithUnobstructedLife, !dijie && !ji);
    assert.deepEqual([proof.lifeBranch, proof.wealthBranch, proof.lifeDijie], [life, wealth, dijie]);
    assert.equal(proof.annualJiLocated, true);
    assert.deepEqual(proof.lifeAnnualFinanceJi.map(row => row.star), ji ? [ji] : []);
    assert.ok(proof.wealthSeatSupport.some(row => row.star === star && row.kind === kind && row.branch === wealth
      && row.financeRole.star === star && row.sourceScope === 'monthly'));
    const applicableMonth = { ...run, facts: run.facts.filter(row => row.factType !== 'yun_month_finance_area' || row.factId === fact.factId) };
    const outcome = investmentMatch(applicableMonth);
    if (dijie || ji) {
      assert.equal(outcome.status, 'not_matched');
      assert.deepEqual(outcome.sourceFactIds, []);
      continue;
    }
    assert.equal(outcome.status, 'matched');
    assert.deepEqual(outcome.sourceFactIds, [fact.factId]);
    assert.deepEqual(outcome.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const report = interpretFortune(applicableMonth, requestForFortuneRun(applicableMonth), 'yun-investment-month');
    const { input } = buildFortuneModelContext(applicableMonth, report);
    assert.ok(input.sections.find(section => section.id === 'wealth').findings.some(row => row.knowledgeId === outcome.knowledgeId));
    const missing = structuredClone(applicableMonth);
    const missingEvidence = missing.facts.find(row => row.factId === fact.factId).normalizedPayload;
    delete missingEvidence.monthWealthSupportWithUnobstructedLife;
    missingEvidence.investmentExamples.annualJiLocated = false;
    assert.equal(investmentMatch(missing).status, 'unknown');
  }
  const raw = astro.withOptions({ ...cases[0].birth, fixLeap: true, config }).toJSON();
  const [frame] = build(span('2026-02-20T04:00:00Z', '2026-02-20T05:00:00Z'), 'month', raw).rows;
  const read = row => yunMonthlyFinanceAreas(row).find(area => area.area === 'life-area');
  const annualJi = contact => contact.sourceScope === 'yearly' && contact.kind === '忌';
  assert.equal(read(frame).monthWealthSupportWithUnobstructedLife, true);
  assert.equal(read({ ...frame, contacts: frame.contacts.filter(contact => !annualJi(contact)) }).monthWealthSupportWithUnobstructedLife, undefined);
  const noDijie = frame.palaces.map(seat => ({
    ...seat, localFinanceShaStars: seat.localFinanceShaStars.filter(star => star !== '地劫'),
  }));
  assert.equal(read({ ...frame, palaces: noDijie }).monthWealthSupportWithUnobstructedLife, undefined);
});

test('the distinct Lu Cun example keeps clear four-palace evidence, a known obstacle, and a missing archive distinct', () => {
  const input = { year: 2026, month: 3 }, date = '2026-03-20T04:00:00.000Z';
  const moonChart = snapshot();
  moonChart.ziwei.rawResult = [astro.withOptions({ dateStr: '1990-05-05', timeIndex: 8, gender: '女', fixLeap: true, config }).toJSON()];
  const find = (run, at) => run.facts.find(fact => fact.factType === 'yun_month_finance_area'
    && fact.normalizedPayload.area === 'life-area' && fact.activeFrom <= at && at < fact.activeTo);
  const completeRun = calculate('month', input, moonChart);
  const data = find(completeRun, date).normalizedPayload;
  assert.equal(data.monthWealthLucunWithClearArea, true);
  assert.equal(data.investmentExamples.wealthBranch, '申');
  assert.ok(data.investmentExamples.wealthSeatLucun && data.investmentExamples.companionFinance.length);
  assert.deepEqual(data.investmentExamples.areaTaboos, []);
  assert.equal(data.shaCount, 0);
  assert.equal(data.completeShaLocations, true);
  assert.equal(data.noRecordedTabooOrSha, true);

  const unknown = structuredClone(moonChart);
  const palace = unknown.ziwei.rawResult[0].palaces.find(row => row.adjectiveStars.some(star => star.name === '天空'));
  const misplaced = palace.adjectiveStars.find(star => star.name === '天空');
  palace.adjectiveStars = palace.adjectiveStars.filter(star => star !== misplaced);
  palace.minorStars.push(misplaced);
  const incompleteRun = calculate('month', input, unknown);
  const uncertain = find(incompleteRun, date).normalizedPayload;
  assert.equal(uncertain.investmentExamples.wealthSeatLucun, true);
  assert.equal(uncertain.completeShaLocations, false);
  assert.equal(uncertain.shaCount, undefined);
  assert.equal(uncertain.noRecordedTabooOrSha, undefined);
  assert.equal(uncertain.monthWealthLucunWithClearArea, undefined);
  for (const [run, unknownSha] of [[completeRun, false], [incompleteRun, true]]) {
    const scoped = { ...run, facts: [find(run, date)] };
    const report = interpretFortune(scoped, requestForFortuneRun(scoped), 'yun-month-sha-count');
    const { input: modelInput } = buildFortuneModelContext(scoped, report);
    const audit = formatFortuneFactAudit(modelInput), prompt = formatFortunePrompt(modelInput);
    assert.equal(audit.includes('区域核到0种归档本命煞曜'), !unknownSha);
    assert.equal(audit.includes('未见已核煞曜，归档煞位未核齐'), unknownSha);
    assert.doesNotMatch(audit, /undefined种归档本命煞曜/u);
    assert.doesNotMatch(prompt, /区域核到0种归档本命煞曜|未见已核煞曜，归档煞位未核齐|shaCount|completeShaLocations/u);
  }

  const blocked = submitBirth('month', { year: 2026, month: 11 }, '2026-11-15T04:00:00.000Z',
    { dateStr: '1990-05-05', timeIndex: 0, gender: '女' });
  const negative = find(blocked, '2026-11-15T04:00:00.000Z').normalizedPayload;
  assert.equal(negative.investmentExamples.wealthSeatLucun, true);
  assert.equal(negative.monthWealthLucunWithClearArea, false);
  assert.ok(negative.investmentExamples.areaTaboos.length || negative.shaCount);
});

test('minor Lu alone cannot qualify a star on the yearly children-property axis', () => {
  const at = '2026-12-15T04:00:00.000Z';
  const run = submitBirth('month', { year: 2026, month: 12 }, at, { dateStr: '1997-04-19', timeIndex: 7, gender: '女' });
  const fact = run.facts.find(fact => fact.factType === 'yun_month_finance_area' && fact.normalizedPayload.area === 'year-axis'
    && fact.activeFrom <= at && at < fact.activeTo);
  const data = fact.normalizedPayload;
  assert.deepEqual(data.positiveScopes, ['yearly', 'monthly']);
  assert.equal(data.financeCount, 1);
  assert.deepEqual(data.positions[1].minorContacts, [{ star: '天梁', sourceScope: 'minor', sourceStem: '壬', kind: '禄' }]);
  assert.deepEqual(data.favorableFinanceContacts.map(row => [row.star, row.branch, row.sourceScope]), [['太阳', '卯', 'monthly']]);
  assert.ok(!ruleResult(run, 31).sourceFactIds.includes(fact.factId));

  const mixed = submitBirth('month', { year: 2026, month: 12 }, at, { dateStr: '1990-05-05', timeIndex: 2, gender: '女' });
  const mixedFact = mixed.facts.find(fact => fact.factType === 'yun_month_finance_area' && fact.normalizedPayload.area === 'year-axis'
    && fact.activeFrom <= at && at < fact.activeTo).normalizedPayload;
  assert.ok(mixedFact.favorableFinanceContacts.some(row => row.star === '天同' && row.sourceScope === 'yearly' && row.kind === '禄'));
  assert.deepEqual(mixedFact.tabooShaSameSeat, [{ branch: '卯',
    taboo: [{ star: '天同', sourceScope: 'monthly', sourceStem: '庚', kind: '忌' }], sha: ['火星'] }]);
});

test('a named Tiankong in the property palace counts, while Dikong in the same seat does not substitute', () => {
  const chart = snapshot();
  chart.ziwei.rawResult = [astro.withOptions({ dateStr: '1976-07-12', timeIndex: 2, gender: '女', fixLeap: true, config }).toJSON()];
  const input = { year: 2022, month: 7 }, at = '2022-07-19T04:00:00Z';
  const run = submitChart('month', input, at, chart);
  const match = ruleResult(run, 34);
  const fact = run.facts.find(fact => match.sourceFactIds.includes(fact.factId) && fact.normalizedPayload.branch === '巳');
  assert.equal(match.status, 'partial');
  assert.equal(fact.factType, 'yun_month_property_contact');
  assert.deepEqual(fact.normalizedPayload.propertyScopes, ['yearly']);
  assert.deepEqual(fact.normalizedPayload.shaWitnesses, [{ star: '天空', layer: 'natal', branch: '巳', relation: '同宫' }]);
  assert.deepEqual(fact.normalizedPayload.recipientFinance, { intrinsic: true, wealthPalaceScopes: [], luScopes: [] });
  assert.equal(fact.normalizedPayload.star, '武曲');
  for (const archiveChange of ['other-star', 'wrong-layer']) {
    const alternative = structuredClone(chart);
    const palace = alternative.ziwei.rawResult[0].palaces.find(palace => palace.earthlyBranch === '巳');
    const star = palace.adjectiveStars.find(star => star.name === '天空');
    if (archiveChange === 'other-star') star.name = '地空';
    else {
      palace.adjectiveStars = palace.adjectiveStars.filter(row => row !== star);
      palace.minorStars.push(star);
    }
    const excluded = submitChart('month', input, at, alternative);
    const replaced = excluded.facts.find(row => row.factType === 'yun_month_property_contact' && row.activeFrom === fact.activeFrom
      && row.normalizedPayload.branch === '巳' && row.normalizedPayload.star === '武曲' && row.normalizedPayload.kind === '忌');
    assert.deepEqual(replaced.normalizedPayload.shaWitnesses, []);
    assert.deepEqual(replaced.normalizedPayload.missingShaPlacements, [{ star: '天空', layer: 'natal' }]);
    assert.equal(replaced.normalizedPayload.shaWitnessCount, undefined);
    assert.equal(ruleResult(excluded, 34).status, 'unknown');
    assert.ok(!ruleResult(excluded, 34).sourceFactIds.includes(replaced.factId));
  }
});

test('the property palace can host both monthly Lu and monthly Ji on distinct stars without a natal wealth star or Dijie', () => {
  const chart = snapshot();
  chart.ziwei.rawResult = [astro.withOptions({ dateStr: '1975-07-12', timeIndex: 4, gender: '女', fixLeap: true, config }).toJSON()];
  const run = calculate('day', { date: '2014-07-05' }, chart);
  const match = ruleResult(run, 48);
  assert.equal(match.status, 'matched');
  const { normalizedPayload: property } = run.facts.find(fact => match.sourceFactIds.includes(fact.factId));
  assert.equal(property.branch, '午');
  assert.deepEqual(property.receivingContacts.map(row => [row.sourceScope, row.star, row.kind]), [['monthly', '文昌', '忌']]);
  assert.ok(!property.localStars.includes('地劫'));
  assert.ok(property.localFinanceRoles.some(row => row.star === '巨门' && !row.intrinsic && row.luScopes.includes('monthly')));
  const row = agreedFrame('2014-07-05', chart.ziwei.rawResult[0]);
  const onlyDailyLu = row.contacts.map(contact => contact.branch === property.branch && contact.kind === '禄'
    ? { ...contact, sourceScope: 'daily' } : contact);
  const withoutWealthSeat = row.palaces.map(palace => palace.branch === property.branch ? { ...palace, monthlyName: '官禄' } : palace);
  const contrast = yunDailyReadings({ ...row, decadeLifeBranch: undefined, palaces: withoutWealthSeat, contacts: onlyDailyLu });
  assert.ok(!contrast.some(reading => reading.reading === 'month-ji-at-property' && reading.branch === property.branch));
});

test('a companion wealth star can support the second house while the daily life retains its own Wuqu Lu', () => {
  const chart = snapshot();
  chart.ziwei.rawResult = [astro.withOptions({ dateStr: '2000-01-01', gender: '男', timeIndex: 6, fixLeap: true, config }).toJSON()];
  const run = calculate('day', { date: '2014-05-20' }, chart), match = ruleResult(run, 38);
  assert.equal(match.status, 'matched');
  const p = run.facts.find(fact => match.sourceFactIds.includes(fact.factId)).normalizedPayload;
  assert.equal(p.lifeSupport.branch, '寅');
  assert.deepEqual(p.lifeSupport.receivingContacts.map(row => [row.star, row.kind]), [['武曲', '禄']]);
  assert.equal(p.branch, '戌');
  assert.equal(p.dailyName, '财帛');
  assert.deepEqual(p.receivingContacts.map(row => [row.star, row.kind]), [['文曲', '科']]);
  assert.ok(p.localFinanceRoles.some(row => row.star === '天府' && row.intrinsic && row.clearForDay));
  const frame = agreedFrame('2014-05-20', chart.ziwei.rawResult[0]);
  const withoutLife = frame.contacts.filter(contact => !(contact.branch === frame.lifeBranch
    && contact.sourceScope === 'monthly' && contact.star === '武曲' && contact.kind === '禄'));
  assert.ok(!yunDailyReadings({ ...frame, contacts: withoutLife }).some(row => row.reading === 'wuqu-life-and-wealth'));
});

test('the finance axis checks real and independently qualified stars on each side in SQLite', () => {
  const date = '2015-08-03', input = { periodType: 'day', targetPeriod: { date }, displayTimezone: 'Asia/Shanghai' };
  const asOf = Date.parse(date + 'T04:00:00Z'), archived = { snapshotId: 'yun-finance-axis', chart: snapshot() };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, archived)));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), 'yun-finance-axis', archived);
  validateFortuneFacts(run);
  const match = ruleResult(run, 39);
  assert.equal(match.status, 'matched');
  const side = run.facts.find(fact => match.sourceFactIds.includes(fact.factId)).normalizedPayload;
  assert.equal(side.dailyName, '福德');
  assert.equal(side.branch, '亥');
  assert.equal(side.overlappingNatalWealth, false);
  assert.deepEqual(side.receivingContacts.map(row => [row.sourceScope, row.star, row.kind]), [
    ['monthly', '巨门', '权'], ['daily', '巨门', '禄'],
  ]);
  const context = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'yun-finance-axis-report'));
  const prompt = formatFortuneFactAudit(context.input);
  assert.match(prompt, /流日为福德.*巨门化权.*巨门化禄/u);
  assert.doesNotMatch(prompt, /dailyFinanceAxisSide|fortune_only/u);
  const frame = agreedFrame(date), wealthBranch = frame.palaces.find(palace => palace.dailyName === '财帛').branch;
  const scattered = frame.contacts.map(contact => contact.branch === side.branch && contact.sourceScope === 'daily'
    ? { ...contact, branch: wealthBranch } : contact);
  assert.ok(!yunDailyReadings({ ...frame, contacts: scattered }).some(row => row.reading === 'life-and-finance-axis' && row.branch === side.branch));

  const old = submitBirth('day', { date: '2014-08-06' }, '2014-08-06T04:00:00Z', { dateStr: '2000-01-01', gender: '男', timeIndex: 6 });
  const crossLayer = ruleResult(old, 39);
  assert.equal(crossLayer.status, 'matched');
  const roleFacts = old.facts.find(fact => crossLayer.sourceFactIds.includes(fact.factId)).normalizedPayload.localFinanceRoles;
  assert.ok(roleFacts.some(row => row.star === '武曲' && !row.clearForDay && row.jiScopes.includes('monthly')));
  assert.ok(roleFacts.some(row => row.star === '左辅' && row.clearForDay && row.wealthPalaceScopes.includes('natal')));

  const other = submitBirth('day', { date: '2003-11-27' }, '2003-11-27T04:00:00Z', { dateStr: '1976-07-12', gender: '女', timeIndex: 2 });
  const otherMatch = ruleResult(other, 39);
  assert.equal(otherMatch.status, 'matched');
  const overlaid = other.facts.find(fact => otherMatch.sourceFactIds.includes(fact.factId)).normalizedPayload;
  assert.equal(overlaid.overlappingNatalWealth, true);
  assert.equal(overlaid.natalName, '财帛');
  assert.equal(overlaid.dailyName, '财帛');
  assert.equal(overlaid.branch, '丑');
  assert.ok(overlaid.localFinanceRoles.some(row => row.star === '廉贞' && row.clearForDay
    && row.luScopes.includes('monthly') && row.luScopes.includes('daily')));
});

test('Jumen Ji keeps the broader archives and relations for inspection without matching the exact rule', () => {
  const chart = snapshot();
  chart.ziwei.rawResult = [astro.withOptions({ dateStr: '2000-01-01', gender: '男', timeIndex: 6, fixLeap: true, config }).toJSON()];
  const run = calculate('month', { year: 2017, month: 6 }, chart), match = ruleResult(run, 49);
  assert.equal(match.status, 'not_matched');
  assert.deepEqual(match.sourceFactIds, []);
  const fact = run.facts.find(fact => fact.factType === 'yun_month_property_contact'
    && fact.normalizedPayload.propertyReading === 'jumen-taboo' && fact.normalizedPayload.monthlyName === '田宅');
  assert.ok(fact);
  assert.equal(fact.normalizedPayload.monthlyName, '田宅');
  assert.equal(fact.normalizedPayload.branch, '丑');
  assert.deepEqual(fact.normalizedPayload.propertyScopes, ['monthly']);
  assert.equal(fact.normalizedPayload.shaWitnessCount, 3);
  assert.deepEqual(fact.normalizedPayload.shaWitnesses, [
    { star: '天刑', layer: 'natal', branch: '未', relation: '对宫' },
    { star: '擎羊', layer: 'natal', branch: '未', relation: '对宫' },
    { star: '大耗', layer: 'boshi', branch: '酉', relation: '三合' },
    { star: '大耗', layer: 'suiqian', branch: '酉', relation: '三合' },
  ]);
  const description = describeFortuneFact({ method: 'ziwei', scope: 'monthly', type: fact.factType, data: fact.normalizedPayload }, String);
  assert.match(description, /博士系大耗在酉宫.*三合/u);
  assert.match(description, /岁前系大耗在酉宫.*三合/u);
  assert.doesNotMatch(description, /propertyShaContacts|shaWitnesses/u);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'yun-property-contact-report'));
  assert.ok(!input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === match.knowledgeId));

  const nextWindow = calculate('month', { year: 2017, month: 7 }, chart);
  const nextMatch = ruleResult(nextWindow, 49);
  const verifiedEnd = '2017-07-22T15:00:00.000Z', civilEnd = '2017-07-22T16:00:00.000Z';
  assert.deepEqual(nextMatch.windows, []);
  assert.ok(nextWindow.facts.some(fact => fact.factType === 'yun_month_property_contact' && fact.activeTo === verifiedEnd
    && fact.normalizedPayload.propertyReading === 'jumen-taboo'));
  assert.ok(nextWindow.facts.some(fact => fact.factType === 'yun_transformation_contact' && fact.activeTo === civilEnd
    && fact.normalizedPayload.sourceScope === 'monthly' && fact.normalizedPayload.star === '巨门'
    && fact.normalizedPayload.kind === '忌'));

  const alternative = snapshot();
  alternative.ziwei.rawResult = [astro.withOptions({ dateStr: '1963-01-15', gender: '女', timeIndex: 3, fixLeap: true, config }).toJSON()];
  const unsupported = calculate('month', { year: 2014, month: 3 }, alternative);
  const far = unsupported.facts.find(fact => fact.factType === 'yun_month_property_contact' && fact.scope === 'monthly'
    && fact.normalizedPayload.star === '巨门' && fact.normalizedPayload.kind === '忌'
    && fact.normalizedPayload.sourceScope === 'monthly' && fact.normalizedPayload.natalName === '田宅');
  assert.deepEqual(far.normalizedPayload.shaWitnesses, []);
  assert.equal(far.normalizedPayload.shaWitnessCount, 0);
  assert.ok(!ruleResult(unsupported, 49).sourceFactIds.includes(far.factId));
});

test('Jumen Ji retains the exact three named stars in one overlaid property seat', () => {
  const chartAt = (dateStr, timeIndex = 8) => {
    const chart = snapshot();
    chart.ziwei.rawResult = [astro.withOptions({ dateStr, gender: '女', timeIndex, fixLeap: true, config }).toJSON()];
    return chart;
  };
  const contactOn = (chart, date) => {
    const start = Date.parse(date + 'T04:00:00Z');
    const civil = new Date(start);
    const run = submitChart('month', { year: civil.getUTCFullYear(), month: civil.getUTCMonth() + 1 }, date + 'T04:00:00Z', chart);
    const fact = run.facts.find(row => row.factType === 'yun_month_property_contact'
      && row.normalizedPayload.propertyReading === 'jumen-taboo'
      && Date.parse(row.activeFrom) <= start && start < Date.parse(row.activeTo));
    assert.ok(fact);
    return { run, fact, match: ruleResult(run, 49) };
  };
  const chart = chartAt('1942-05-20');
  const positive = contactOn(chart, '2015-11-26');
  const same = positive.fact.normalizedPayload;
  assert.deepEqual([same.star, same.kind, same.sourceStem, same.sourceScope, same.branch], ['巨门', '忌', '丁', 'monthly', '子']);
  assert.deepEqual(same.propertyScopes, ['natal', 'monthly']);
  assert.deepEqual(same.shaWitnesses, [
    { star: '天刑', layer: 'natal', branch: '子', relation: '同宫' },
    { star: '擎羊', layer: 'natal', branch: '子', relation: '同宫' },
    { star: '大耗', layer: 'suiqian', branch: '子', relation: '同宫' },
  ]);
  assert.equal(same.jumenOverlaidPropertyShaSameSeat, true);
  assert.equal(same.jumenMonthlyPropertyShaSameSeat, true);
  assert.equal(same.propertyShaPlacementProof, yunZiweiPolicy.propertySha);
  assert.equal(positive.match.status, 'matched');
  assert.equal(positive.match.matchedSourceExcerpt, '流月流日流時');
  assert.deepEqual(positive.match.sourceFactIds, [positive.fact.factId]);
  const archivedFact = { ...positive.fact, normalizedPayload: { ...same, jumenMonthlyPropertyShaSameSeat: undefined } };
  assert.equal(ruleResult({ ...positive.run, facts: [archivedFact] }, 49).status, 'matched');
  assert.ok(positive.match.windows.some(window => window.start === '2015-11-11T16:00:00.000Z'
    && window.endExclusive === '2015-11-30T16:00:00.000Z'));
  const positiveDecember = contactOn(chart, '2015-12-09');
  const verifiedEnd = '2015-12-10T15:00:00.000Z';
  assert.ok(positiveDecember.match.windows.some(window => window.endExclusive === verifiedEnd));
  const report = interpretFortune(positive.run, requestForFortuneRun(positive.run), 'yun-property-same-seat');
  const { input } = buildFortuneModelContext(positive.run, report);
  assert.ok(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === positive.match.knowledgeId));

  const sharedChart = chartAt('1942-05-20', 9);
  const monthlyOnly = contactOn(sharedChart, '2008-05-15');
  assert.deepEqual(monthlyOnly.fact.normalizedPayload.propertyScopes, ['monthly']);
  assert.equal(monthlyOnly.fact.normalizedPayload.jumenOverlaidPropertyShaSameSeat, false);
  assert.equal(monthlyOnly.fact.normalizedPayload.jumenMonthlyPropertyShaSameSeat, true);
  assert.deepEqual(monthlyOnly.fact.normalizedPayload.shaWitnesses, same.shaWitnesses);
  assert.equal(monthlyOnly.match.status, 'matched');
  assert.deepEqual(monthlyOnly.match.windows, [{ start: monthlyOnly.fact.activeFrom, endExclusive: monthlyOnly.fact.activeTo }]);
  const monthlyModel = buildFortuneModelContext(monthlyOnly.run,
    interpretFortune(monthlyOnly.run, requestForFortuneRun(monthlyOnly.run), 'yun-month-only')).input;
  assert.match(formatFortuneFactAudit(monthlyModel), /天刑、擎羊、大耗都与流月田宅里的巨门化忌实际同宫/u);
  assert.match(formatFortuneFactAudit(monthlyModel), /天刑复算生月，擎羊复算生年干，两类大耗分别核位/u);
  assert.match(formatFortunePrompt(monthlyModel), /流月流日流時/u);
  assert.doesNotMatch(formatFortunePrompt(monthlyModel), /jumenMonthlyPropertyShaSameSeat|都与流月田宅里的巨门化忌实际同宫/u);

  const upperRun = submitChart('month', { year: 2015, month: 11 }, '2015-11-15T04:00:00Z', sharedChart);
  const upper = ruleResult(upperRun, 34);
  const upperFact = upperRun.facts.find(row => upper.sourceFactIds.includes(row.factId) && row.normalizedPayload.branch === '戌');
  assert.equal(upper.status, 'partial');
  assert.equal(upper.matchedSourceExcerpt, undefined);
  const p = upperFact.normalizedPayload;
  assert.deepEqual([p.sourceScope, p.star, p.kind, p.propertyScopes], ['yearly', '太阴', '忌', ['yearly']]);
  assert.deepEqual(p.shaWitnesses.map(row => [row.star, row.branch, row.relation]), [['陀罗', '戌', '同宫'], ['火星', '戌', '同宫']]);
  assert.equal(p.recipientFinance.intrinsic, true);
  const wrongLayerChart = structuredClone(sharedChart);
  const palace = wrongLayerChart.ziwei.rawResult[0].palaces.find(row => row.earthlyBranch === '戌');
  const fire = palace.minorStars.find(row => row.name === '火星');
  palace.minorStars = palace.minorStars.filter(row => row !== fire);
  palace.adjectiveStars.push(fire);
  const changed = submitChart('month', { year: 2015, month: 11 }, '2015-11-15T04:00:00Z', wrongLayerChart);
  const oneVerified = ruleResult(changed, 34);
  assert.equal(oneVerified.status, 'partial');
  assert.ok(changed.facts.some(row => oneVerified.sourceFactIds.includes(row.factId) && row.normalizedPayload.shaWitnessCount === 1));

  const natalOnlyRun = contactOn(chart, '2013-05-24');
  const natalOnly = natalOnlyRun.fact.normalizedPayload;
  assert.deepEqual(natalOnly.propertyScopes, ['natal']);
  assert.deepEqual(natalOnly.shaWitnesses, same.shaWitnesses);
  assert.equal(natalOnly.jumenOverlaidPropertyShaSameSeat, false);
  assert.deepEqual(natalOnlyRun.match.windows, []);

  const twoStarsRun = contactOn(chartAt('1940-02-26'), '2020-11-29');
  const twoStarsOnly = twoStarsRun.fact.normalizedPayload;
  assert.deepEqual(twoStarsOnly.propertyScopes, ['natal', 'monthly']);
  assert.deepEqual(twoStarsOnly.shaWitnesses.map(row => row.star), ['天刑', '擎羊']);
  assert.deepEqual(twoStarsOnly.missingShaPlacements, []);
  assert.equal(twoStarsOnly.jumenOverlaidPropertyShaSameSeat, false);
  assert.deepEqual(twoStarsRun.match.windows, []);

  const unsupportedSeatChart = chartAt('1942-04-20', 7);
  const originalSeat = contactOn(unsupportedSeatChart, '1990-11-20');
  const originalPayload = originalSeat.fact.normalizedPayload;
  assert.equal(originalPayload.branch, '子');
  assert.deepEqual(originalPayload.shaWitnesses.map(row => row.star), ['擎羊', '大耗']);
  assert.equal(originalSeat.match.status, 'not_matched');
  const palaces = unsupportedSeatChart.ziwei.rawResult[0].palaces;
  const from = palaces.find(palace => palace.adjectiveStars.some(row => row.name === '天刑'));
  assert.equal(from.earthlyBranch, '亥');
  const wrongSeat = palaces.find(palace => palace.earthlyBranch === originalPayload.branch);
  wrongSeat.adjectiveStars.push(from.adjectiveStars.splice(from.adjectiveStars.findIndex(row => row.name === '天刑'), 1)[0]);
  const misplacedTianxing = contactOn(unsupportedSeatChart, '1990-11-20');
  assert.deepEqual(misplacedTianxing.fact.normalizedPayload.missingShaPlacements, [{ star: '天刑', layer: 'natal' }]);
  assert.equal(misplacedTianxing.match.status, 'unknown');
  assert.equal(misplacedTianxing.match.windows.length, 0);

  for (const [key, layer] of [['boshi12', 'boshi'], ['suiqian12', 'suiqian']]) {
    const wrongSeatChart = chartAt('1940-02-26');
    const palaces = wrongSeatChart.ziwei.rawResult[0].palaces;
    const expected = palaces.find(palace => palace[key] === '大耗');
    const target = palaces.find(palace => palace.earthlyBranch === twoStarsOnly.branch);
    assert.notEqual(expected, target);
    [expected[key], target[key]] = [target[key], expected[key]];
    const misplaced = contactOn(wrongSeatChart, '2020-11-29');
    const p = misplaced.fact.normalizedPayload;
    assert.deepEqual(p.shaWitnesses.map(row => row.star), ['天刑', '擎羊']);
    assert.deepEqual(p.missingShaPlacements, [{ star: '大耗', layer }]);
    assert.equal(p.jumenMonthlyPropertyShaSameSeat, undefined);
    assert.equal(misplaced.match.status, 'unknown');
    assert.deepEqual(misplaced.match.windows, []);
  }

  for (const archiveChange of ['missing-star', 'wrong-layer']) {
    const changed = structuredClone(chart);
    const palace = changed.ziwei.rawResult[0].palaces.find(row => row.earthlyBranch === '子');
    const star = palace.adjectiveStars.find(row => row.name === '天刑');
    palace.adjectiveStars = palace.adjectiveStars.filter(row => row !== star);
    if (archiveChange === 'wrong-layer') palace.majorStars.push(star);
    const missingRun = contactOn(changed, '2015-11-26');
    const missing = missingRun.fact.normalizedPayload;
    assert.deepEqual(missing.missingShaPlacements, [{ star: '天刑', layer: 'natal' }]);
    assert.equal(missing.jumenOverlaidPropertyShaSameSeat, undefined);
    assert.equal(missingRun.match.status, 'unknown');
    assert.deepEqual(missingRun.match.windows, []);
  }
});

test('two Ji in separate palaces cannot replace the same daily-life palace required by the double-Ji source', () => {
  const date = '2025-08-02', contrast = '2025-08-14';
  const run = submitBirth('day', { date }, date + 'T04:00:00Z');
  const match = ruleResult(run, 45);
  assert.equal(match.status, 'matched');
  const witness = run.facts.find(row => match.sourceFactIds.includes(row.factId)).normalizedPayload;
  assert.deepEqual(witness.financeScopes, ['monthly']);
  assert.deepEqual(witness.receivingContacts.map(row => [row.sourceScope, row.star, row.kind]), [
    ['monthly', '贪狼', '忌'], ['daily', '贪狼', '忌'],
  ]);
  const changed = submitBirth('day', { date: contrast }, contrast + 'T04:00:00Z');
  const contacts = changed.facts.filter(({ factType, scope, normalizedPayload: p }) => factType === 'yun_transformation_contact'
    && scope === 'daily' && p.sourceDayClock === 'agreed' && p.kind === '忌' && ['monthly', 'daily'].includes(p.sourceScope));
  assert.deepEqual(contacts.map(({ normalizedPayload: p }) => [p.sourceScope, p.branch, p.dailyName, p.monthlyName]), [
    ['monthly', '戌', '命宫', '财帛'], ['daily', '酉', '兄弟', '疾厄'],
  ]);
  assert.deepEqual(ruleResult(changed, 45).windows, []);
});

test('same-seat monthly support and contrary contact retain named evidence while the matching source reaches the wealth prompt', () => {
  const date = '2026-01-01';
  const run = submitBirth('day', { date }, date + 'T04:00:00Z');
  const combination = ruleResult(run, 42);
  assert.equal(combination.status, 'matched');
  const proof = run.facts.find(row => combination.sourceFactIds.includes(row.factId));
  const evidence = proof.normalizedPayload;
  assert.deepEqual(evidence.financeScopes, ['natal']);
  assert.deepEqual(evidence.receivingContacts.map(row => [row.sourceScope, row.star, row.kind]), [
    ['monthly', '右弼', '科'], ['daily', '天机', '禄'],
  ]);
  assert.ok(!evidence.localStars.some(star => ['紫微', '天府', '武曲', '太阴', '禄存'].includes(star)));
  assert.ok(evidence.localContacts.some(row => row.sourceScope === 'monthly' && row.star === '天机' && row.kind === '忌'));
  assert.ok(evidence.monthlyContext.natalName);
  const audit = describeFortuneFact({ method: 'ziwei', type: proof.factType, data: evidence }, String);
  assert.match(audit, /流月为.*流日为命宫/u);
  assert.match(audit, /同处还见反向四化/u);
  const actualFinance = ruleResult(run, 43);
  const placements = run.facts.filter(row => actualFinance.sourceFactIds.includes(row.factId))
    .flatMap(row => row.normalizedPayload.financeScopes);
  assert.ok(placements.includes('natal') && placements.includes('daily'));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'daily-finance-report'));
  const wealth = input.sections.find(section => section.id === 'wealth');
  assert.ok(wealth.findings.some(row => row.knowledgeId === combination.knowledgeId));
  assert.ok(wealth.findings.some(row => row.knowledgeId === actualFinance.knowledgeId));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /同题财帛宫由月干与日干分别产生同向支持/u);
  assert.doesNotMatch(prompt, /receivingContacts|F\d+|右弼化科/u);
});

test('every old Yun source entry has reviewed atomic conditions, exact source hashes and explicit unresolved premises', () => {
  const library = fortuneKnowledge.ziwei;
  assert.equal(library.rules.filter(r => !r.queries.length).length, 0);
  for (let i = 29; i <= 49; i++) {
    const r = library.rules[i], e = library.entries.find(e => e.id === r.knowledgeId);
    assert.ok(r.queries.length);
    for (const query of r.queries) {
      assert.ok(query.factType.startsWith('yun_'));
      if (i <= 31 || i === 34) {
        assert.deepEqual(new Set(query.anyOf.map(choice => choice.profile)),
          new Set([yunZiweiPolicy.profile, yunZiweiPolicy.nominalLeapBirthFinanceProfile]));
        assert.ok(query.anyOf.filter(choice => choice.profile === yunZiweiPolicy.nominalLeapBirthFinanceProfile)
          .every(choice => choice.birthMonthLayerProof === yunZiweiPolicy.nominalLeapBirthLayerProof));
      } else {
        assert.equal(query.where.profile, yunZiweiPolicy.profile);
      }
    }
    assert.equal(r.unresolved.length === 0, completedYunRules.has(i)); assert.equal(r.review.sourcePassageId, e.source.passage_id);
    assert.equal(r.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: e.evidence, conditions: e.conditions })).digest('hex'));
  }
  assert.ok(library.rules[45].queries.every(q => q.where.localWealthCount === undefined));
  const pair = library.rules[35].queries[0];
  assert.equal(pair.factType, 'yun_sun_ji_pair');
  assert.equal(pair.where.sunJiOccurrenceCount, 5);
});

test('Yun calculation facts have a Chinese audit description and only confirmed daily windows reach model findings', () => {
  const run = submitBirth('day', { date: '2026-01-01' }, '2026-01-01T03:00:00Z');
  const report = interpretFortune(run, requestForFortuneRun(run), 'yun-prompt');
  const { input, knowledge } = buildFortuneModelContext(run, report), prompt = formatFortuneFactAudit(input);
  const yunTime = run.facts.find(fact => fact.factType === 'yun_time_segment' && fact.scope === 'monthly');
  const description = describeFortuneFact({ method: 'ziwei', scope: 'monthly', type: yunTime.factType, data: yunTime.normalizedPayload }, String);
  assert.match(description, /农历月取干/u); assert.match(description, /只保留禄忌/u);
  assert.match(prompt, /紫微雲/u); assert.match(prompt, /仍待同源核验/u);
  for (const forbidden of ['yun-official', 'minorLifeBranch', 'sourceScope', 'allLayersReady', 'sunJiScopesAtYearLife', 'yun-real-run', 'yun-snapshot']) assert.ok(!prompt.includes(forbidden), forbidden);
  const unresolved = new Set(fortuneKnowledge.ziwei.rules.filter(rule => rule.unresolved.length).map(rule => rule.knowledgeId));
  const findings = input.sections.flatMap(s => s.findings)
    .filter(finding => finding.method === 'ziwei' && finding.knowledgeId.includes('yun-'));
  assert.ok(findings.length);
  for (const finding of findings) {
    const match = knowledge.byMethod.ziwei.find(row => row.knowledgeId === finding.knowledgeId);
    assert.equal(match.status, 'matched');
    if (unresolved.has(finding.knowledgeId)) assert.ok(match.matchedConditions?.length || match.confirmedBranches?.length);
    assert.deepEqual(finding.windows, match.windows);
  }
  const week = calculate('week', { weekStartDate: '2026-02-23' });
  const weekly = buildFortuneModelContext(week, interpretFortune(week, requestForFortuneRun(week), 'yun-week-prompt'));
  assert.ok(!weekly.input.sections.some(section => section.findings.some(finding => finding.knowledgeId.includes('yun-'))));
  const unknown = snapshot(); unknown.timeKnown = false;
  const uncertainRun = calculate('day', { date: '2026-02-17' }, unknown);
  assert.ok(!buildFortuneModelContext(uncertainRun, interpretFortune(uncertainRun, requestForFortuneRun(uncertainRun), 'unknown-yun')).input.facts.some(f => f.type.startsWith('yun_')));
});
