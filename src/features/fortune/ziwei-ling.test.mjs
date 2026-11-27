import assert from 'node:assert/strict';
import test from 'node:test';
import { astro } from 'iztro';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';

const { buildLingZiweiWindow, lingDoujun, lingTaiyinBrightness, lingTransformations, lingZiweiPolicy } = await import('./control/ziwei-ling.ts');
const { nextSolarBoundary } = await import('./control/fortune-preview.ts');
const { calculateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { evaluateFortuneRules, fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const config = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current' };
const natal = astro.withOptions({ dateStr: '1990-05-05', timeIndex: 6, gender: '女', fixLeap: true, config }).toJSON();
const span = (start, end) => ({ start: Date.parse(start), end: Date.parse(end) });
const chart = () => ({ timeKnown: true, bazi: { rawResult: [] }, western: { rawResult: [] },
  ziwei: { engineName: 'iztro', engineVersion: '2.6.5', rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1', rawResult: [structuredClone(natal)] } });
const decades = window => [{ ...window, stem: '己', branch: '卯' }];
const profile = (window, period = 'week', base = natal, ranges = decades(window)) => buildLingZiweiWindow(window, period, base, ranges);
const ruleAt = index => fortuneKnowledge.ziwei.rules[index];
const calculate = date => {
  const params = { periodType: 'day', displayTimezone: 'Asia/Shanghai', targetPeriod: { date } };
  const time = buildFactTimeContext(params, Date.parse(date + 'T04:00:00Z'), 'server');
  return calculateFortuneFacts(params, time, 'ling-real-run', { snapshotId: 'ling-snapshot', chart: chart() });
};

function annualRun(dateStr, timeIndex, archivedTaiyinBrightness, year = 2026, archiveChanges = {}) {
  const candidate = astro.withOptions({ dateStr, timeIndex, gender: '男', fixLeap: true, config }).toJSON();
  if (archivedTaiyinBrightness) {
    const taiyin = candidate.palaces.flatMap(palace => palace.majorStars).find(star => star.name === '太阴');
    taiyin.brightness = archivedTaiyinBrightness;
  }
  for (const [name, misplaced] of [[archiveChanges.duplicate, false], [archiveChanges.moveToMinor, true]]) {
    if (!name) continue;
    const seat = candidate.palaces.find(palace => palace.majorStars.some(star => star.name === name));
    const star = seat.majorStars.find(row => row.name === name);
    if (misplaced) {
      seat.majorStars = seat.majorStars.filter(row => row !== star);
      seat.minorStars.push(star);
    } else {
      seat.majorStars.push({ ...star });
    }
  }
  for (const [layer, relocation] of [['minorStars', archiveChanges.relocateMinor], ['adjectiveStars', archiveChanges.relocateAdjective]]) {
    if (!relocation) continue;
    const [name, branch] = relocation;
    const origin = candidate.palaces.find(palace => palace[layer].some(star => star.name === name));
    const [star] = origin[layer].splice(origin[layer].findIndex(row => row.name === name), 1);
    candidate.palaces.find(palace => palace.earthlyBranch === branch)[layer].push(star);
  }
  if (archiveChanges.birthDate) {
    const changedDay = astro.withOptions({ dateStr: archiveChanges.birthDate, timeIndex, gender: '男', fixLeap: true, config }).toJSON();
    candidate.solarDate = changedDay.solarDate;
    candidate.rawDates.lunarDate = changedDay.rawDates.lunarDate;
  }
  const snapshot = chart();
  snapshot.ziwei.rawResult = [candidate];
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const asOf = Date.UTC(year, 5, 1, 4);
  const reference = { snapshotId: 'ling-annual-snapshot', profileId: 'ling-annual-profile', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, reference)));
  return bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), 'ling-' + dateStr, reference);
}

const annualMatch = (run, suffix) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId.endsWith('ling-annual-v1-annual-' + suffix + '-001'));
const annualLife = (run, scope, year = 2026) => run.facts.find(fact => fact.factType === 'ling_palace_condition' && fact.scope === scope
  && fact.normalizedPayload.flowName === '命宫' && fact.normalizedPayload.lunarYear === year);

function submittedDay(date, dateStr, timeIndex, editNatal) {
  const snapshot = chart();
  const hour = String(timeIndex * 2).padStart(2, '0');
  snapshot.birthContext = { precision: 'minute', birthInstant: new Date(dateStr + 'T' + hour + ':00:00+08:00').toISOString(),
    latitude: 39.9042, longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const natal = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config }).toJSON();
  editNatal?.(natal);
  snapshot.ziwei.rawResult = [natal];
  const input = { periodType: 'day', displayTimezone: 'Asia/Shanghai', targetPeriod: { date } };
  const asOf = Date.parse(date + 'T04:00:00Z');
  const reference = { snapshotId: 'ling-day-' + date, chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, reference)));
  return bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), reference.snapshotId, reference);
}

test('2027 annual transformations match all forty-eight named palaces on verified charts', () => {
  const cases = [
    ['1997-03-15', 6, '巳未亥未'],
    ['1993-05-15', 2, '辰申子午'],
    ['1994-10-10', 7, '卯酉丑巳'],
    ['1994-10-10', 5, '寅戌寅辰'],
    ['1994-10-10', 9, '丑亥卯卯'],
    ['1994-10-10', 1, '子子辰寅'],
    ['1997-03-15', 2, '亥丑巳丑'],
    ['1994-10-10', 3, '戌寅午子'],
    ['1990-05-05', 2, '酉卯未亥'],
    ['1993-05-15', 8, '申辰申戌'],
    ['1997-03-15', 10, '未巳酉酉'],
    ['1995-12-12', 2, '午午戌申'],
  ];
  const branches = '未午巳辰卯寅丑子亥戌酉申';
  const stars = ['太阴', '天同', '天机', '巨门'];
  const kinds = ['禄', '权', '科', '忌'];
  const lookup = run => matchFortuneKnowledge(run).byMethod.ziwei.filter(row =>
    row.status === 'matched' && /^fortune-entry-(2409|24[1-4]\d|245[0-6])$/u.test(row.knowledgeId));
  const witnessed = new Set();
  for (const [date, hour, expectedBranches] of cases) {
    const run = annualRun(date, hour, null, 2027);
    const rows = lookup(run);
    const expectedIds = [...expectedBranches].map((branch, index) =>
      'fortune-entry-' + (2409 + 12 * index + branches.indexOf(branch)));
    assert.deepEqual(rows.map(row => row.knowledgeId).sort(), expectedIds.slice().sort(), date + '/' + hour);
    for (const row of rows) {
      witnessed.add(row.knowledgeId);
      const starIndex = expectedIds.indexOf(row.knowledgeId);
      const [fact] = run.facts.filter(item => row.sourceFactIds.includes(item.factId));
      assert.equal(fact.factType, 'ling_year_major_transformation');
      const { star, kind, branch, sourceScope, sourceStem, lunarYear } = fact.normalizedPayload;
      assert.deepEqual([star, kind, branch, sourceScope, sourceStem, lunarYear],
        [stars[starIndex], kinds[starIndex], expectedBranches[starIndex], 'yearly', '丁', 2027]);
      assert.equal(row.windows[0].start, '2027-02-05T16:00:00.000Z');
    }
  }
  assert.equal(witnessed.size, 48);
  const [date, hour] = cases[0];
  const next = annualRun(date, hour, null, 2028);
  const nextRows = lookup(next);
  assert.equal(nextRows.length, 4);
  assert.ok(nextRows.every(row => row.windows.at(-1).endExclusive === '2028-01-25T16:00:00.000Z'));
  assert.equal(lookup(annualRun(date, hour, null, 2026)).length, 0);
  assert.equal(lookup(annualRun(date, hour, null, 2087)).length, 0);
  const shifted = annualRun(date, hour, null, 2027, { moveToMinor: '太阴' });
  const shiftedRows = lookup(shifted);
  assert.equal(shiftedRows.some(row => row.knowledgeId === 'fortune-entry-2411'), false);
  assert.ok(shiftedRows.some(row => row.knowledgeId === 'fortune-entry-2421'));
});

const dayLife = run => run.facts.find(fact => fact.factType === 'ling_palace_condition' && fact.scope === 'daily'
  && fact.normalizedPayload.flowName === '命宫');
const dayMatch = (run, passage) => matchFortuneKnowledge(run).byMethod.ziwei
  .find(row => row.knowledgeId.endsWith('ling-daily-v1-example-' + passage + '-001'));
const dayPrompt = run => formatFortuneFactAudit(buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-day')).input);

test('the annual life examples match only independently verified occupants and transformations', () => {
  const cases = [
    [2312, 1, 2017, '酉', 'yearLifeVerifiedStars', '文昌'],
    [2313, 1, 2025, '巳', 'yearLifeVerifiedStars', '文曲'],
    [2314, 1, 2017, '酉', 'yearLifeVerifiedStars', '右弼'],
    [2315, 2, 2032, '子', 'yearLifeFinanceKinds', '忌'],
    [2316, 1, 2017, '酉', 'yearLifeFinanceKinds', '禄'],
    [2317, 6, 2025, '巳', 'yearLifeVoidPairVerified', true],
    [2318, 3, 2024, '辰', 'natalTianfuYearLifeZiwei', true],
  ];
  const cached = new Map();
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === 'fortune-entry-' + id);
  for (const [id, hour, year, branch, field, expected] of cases) {
    const key = hour + '/' + year;
    if (!cached.has(key)) cached.set(key, annualRun('1993-03-07', hour, undefined, year));
    const run = cached.get(key);
    const match = lookup(run, id);
    assert.equal(match.status, 'matched', 'entry ' + id);
    const witness = annualLife(run, 'yearly', year);
    assert.ok(match.sourceFactIds.includes(witness.factId));
    const data = witness.normalizedPayload;
    assert.equal(data.branch, branch);
    if (typeof expected === 'boolean') assert.equal(data[field], expected);
    else assert.ok(data[field].includes(expected));
    const wrong = { ...witness, normalizedPayload: { ...data, [field]: Array.isArray(data[field]) ? [] : false } };
    assert.equal(lookup({ ...run, facts: [wrong] }, id).status, 'not_matched');
  }
  const comingYear = annualRun('1993-03-07', 1, undefined, 2018);
  const next = annualLife(comingYear, 'yearly', 2018);
  assert.notEqual(next.normalizedPayload.branch, '酉');
  assert.ok(!lookup(comingYear, 2312).sourceFactIds.includes(next.factId));
});

test('daily Tianxiang and Tanlang use a verified major-star seat and the source day layer', () => {
  const submit = (date, edit) => submittedDay(date, '1990-05-05', 6, edit);
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === 'fortune-entry-' + id);
  const migration = submit('2026-10-07');
  const tianxiang = lookup(migration, 2233);
  assert.equal(tianxiang.status, 'matched');
  const [seat] = migration.facts.filter(fact => tianxiang.sourceFactIds.includes(fact.factId));
  assert.equal(seat.normalizedPayload.flowName, '迁移');
  assert.ok(seat.normalizedPayload.dailyVerifiedMajorStars.includes('天相'));
  assert.deepEqual(tianxiang.windows, [{ start: seat.activeFrom, endExclusive: seat.activeTo }]);
  assert.equal(lookup(submit('2026-10-09'), 2233).status, 'not_matched');
  const duplicate = submit('2026-10-07', natal => {
    const palace = natal.palaces.find(palace => palace.majorStars.some(star => star.name === '天相'));
    palace.majorStars.push(structuredClone(palace.majorStars.find(star => star.name === '天相')));
  });
  assert.notEqual(lookup(duplicate, 2233).status, 'matched');

  const daily = submit('2026-09-01');
  const tanlang = lookup(daily, 2234);
  assert.equal(tanlang.status, 'matched');
  const [contact] = daily.facts.filter(fact => tanlang.sourceFactIds.includes(fact.factId));
  assert.deepEqual([contact.normalizedPayload.star, contact.normalizedPayload.kind, contact.normalizedPayload.flowName,
    contact.normalizedPayload.sourceScope, contact.normalizedPayload.sourceDayAgreed], ['贪狼', '禄', '命宫', 'daily', true]);
  assert.deepEqual(tanlang.windows, [{ start: contact.activeFrom, endExclusive: contact.activeTo }]);
  assert.equal(lookup(submit('2026-09-21'), 2234).status, 'not_matched');
  const monthly = submit('2026-10-15');
  assert.ok(monthly.facts.some(fact => fact.factType === 'ling_transformation_contact' && fact.scope === 'daily'
    && fact.normalizedPayload.star === '贪狼' && fact.normalizedPayload.kind === '禄'
    && fact.normalizedPayload.sourceScope === 'monthly' && fact.normalizedPayload.flowName === '命宫'));
  assert.equal(lookup(monthly, 2234).status, 'not_matched');
});

test('five source daily examples require their own verified stars in the named day palaces', () => {
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === 'fortune-entry-' + id);
  const cases = [
    [2255, '1990-05-05', 6, 15, 16, '迁移', '破军'],
    [2256, '1985-02-20', 3, 13, 14, '迁移', '七杀', '擎羊'],
    [2257, '1990-05-05', 6, 10, 11, '命宫', undefined, '火星'],
    [2258, '1990-05-05', 6, 12, 13, '命宫', undefined, '铃星'],
    [2259, '1990-05-05', 6, 14, 15, '福德', '天梁'],
  ];
  for (const [id, birth, hour, day, next, flowName, major, auxiliary] of cases) {
    const date = '2026-11-' + day;
    const run = submittedDay(date, birth, hour);
    const predicted = lookup(run, id);
    assert.equal(predicted.status, 'matched');
    const [seat] = run.facts.filter(fact => predicted.sourceFactIds.includes(fact.factId));
    assert.equal(seat.normalizedPayload.flowName, flowName);
    assert.equal(seat.normalizedPayload.sourceDayAgreed, true);
    if (major) assert.ok(seat.normalizedPayload.dailyVerifiedMajorStars.includes(major));
    if (auxiliary) assert.ok(seat.normalizedPayload.dailyVerifiedAuxiliaryStars.includes(auxiliary));
    assert.deepEqual(predicted.windows, [{ start: seat.activeFrom, endExclusive: '2026-11-' + day + 'T15:00:00.000Z' }]);
    assert.equal(lookup(submittedDay('2026-11-' + next, birth, hour), id).status, 'not_matched');

    if (auxiliary) {
      const invalid = submittedDay(date, birth, hour, natal => {
        const palace = natal.palaces.find(p => p.minorStars.some(star => star.name === auxiliary));
        const i = palace.minorStars.findIndex(star => star.name === auxiliary);
        palace.adjectiveStars.push(...palace.minorStars.splice(i, 1));
      });
      assert.notEqual(lookup(invalid, id).status, 'matched');
    }
  }
});

test('the author table has all ten stems and preserves both Geng Ji stars without changing the native chart', () => {
  assert.deepEqual(lingTransformations('庚'), [
    { star: '太阳', kind: '禄' }, { star: '武曲', kind: '权' }, { star: '太阴', kind: '科' },
    { star: '天同', kind: '忌' }, { star: '天相', kind: '忌' },
  ]);
  assert.deepEqual(lingTransformations('己').map(row => row.star), ['武曲', '贪狼', '天梁', '文曲']);
  assert.equal([...'甲乙丙丁戊己庚辛壬癸'].flatMap(lingTransformations).length, 41);
  assert.throws(() => lingTransformations('unknown'), RangeError);
  const before = structuredClone(natal);
  profile(span('2026-11-18T00:00:00Z', '2026-11-19T00:00:00Z'));
  assert.deepEqual(natal, before);
  assert.deepEqual(astro.withOptions({ dateStr: '1990-05-05', timeIndex: 6, gender: '女', fixLeap: true, config }).toJSON(), before);
});

test('Doujun uses inclusive reverse month and forward birth hour with wraparound', () => {
  assert.equal(lingDoujun('酉', 1, '子'), '酉');
  assert.equal(lingDoujun('酉', 4, '午'), '子');
  assert.equal(lingDoujun('未', 4, '午'), '戌');
  assert.throws(() => lingDoujun('未', 13, '午'), RangeError);
});

test('the author Qingming example changes month transformations at the exact Jie while the lunar palace stays fixed', () => {
  const boundary = nextSolarBoundary(Date.parse('2015-04-01T00:00:00Z'));
  assert.equal(boundary.name, '清明');
  assert.ok(new Date(boundary.time).toISOString().startsWith('2015-04-05'));
  const window = { start: boundary.time - 60_000, end: boundary.time + 60_000 };
  const result = profile(window, 'month');
  assert.equal(result.status, 'ready');
  const months = result.rows.filter(row => row.scope === 'monthly');
  assert.deepEqual(months.map(row => row.sourceStem), ['己', '庚']);
  assert.deepEqual(months.map(row => row.lifeBranch), ['亥', '亥']);
  assert.deepEqual(months.map(row => row.lunarMonth), [2, 2]);
  assert.equal(months[0].end, boundary.time);
  assert.equal(months[1].start, boundary.time);
  assert.equal(months[0].monthJie, undefined);
  assert.equal(months[1].monthJie.name, '清明');
  assert.equal(months[1].monthJie.beforeStem, '己');
  assert.equal(months[1].monthJie.at, new Date(boundary.time).toISOString());
  assert.deepEqual(months[1].monthJie.beforeTransformations.map(row => row.star), ['武曲', '贪狼', '天梁', '文曲']);
  assert.deepEqual(months.map(row => row.contacts.filter(contact => contact.sourceScope === 'monthly').length), [4, 5]);
  assert.ok(months.every(row => row.contacts.every(contact => contact.placements.length === 1)));
  const atStart = profile({ start: boundary.time, end: window.end }, 'month').rows.find(row => row.scope === 'monthly');
  assert.deepEqual(atStart.monthJie, months[1].monthJie);
  const afterStart = profile({ start: boundary.time + 1, end: window.end }, 'month').rows.find(row => row.scope === 'monthly');
  assert.ok(afterStart.ready);
  assert.equal(afterStart.monthJie, undefined);
  const noDecade = profile(window, 'month', natal, []).rows.filter(row => row.scope === 'monthly');
  assert.equal(noDecade[1].ready, false);
  assert.deepEqual(noDecade[1].monthJie, months[1].monthJie);
  const duplicated = structuredClone(natal);
  const wenquPalace = duplicated.palaces.find(palace => palace.minorStars.some(star => star.name === '文曲'));
  const wenqu = wenquPalace.minorStars.find(star => star.name === '文曲');
  wenquPalace.minorStars.push(structuredClone(wenqu));
  assert.equal(profile(window, 'month', duplicated).rows.filter(row => row.scope === 'monthly')[1].monthJie, undefined);
});

test('the civil daily palace and stem retain midnight and separately mark the disputed late Zi hour', () => {
  const window = span('2015-04-05T14:00:00Z', '2015-04-05T17:00:00Z');
  const days = profile(window).rows.filter(row => row.scope === 'daily');
  assert.deepEqual(days.map(day => [day.sourceStem, day.sourceDayAgreed, new Date(day.end).toISOString()]), [
    ['辛', true, '2015-04-05T15:00:00.000Z'],
    ['辛', false, '2015-04-05T16:00:00.000Z'],
    ['壬', true, '2015-04-05T17:00:00.000Z'],
  ]);
  assert.equal(days[0].lifeBranch, days[1].lifeBranch);
  assert.notEqual(days[1].lifeBranch, days[2].lifeBranch);
  const current = profile(span('2015-04-05T15:15:00Z', '2015-04-05T15:45:00Z')).rows.filter(row => row.scope === 'daily');
  assert.equal(current.length, 1);
  assert.equal(current[0].sourceStem, '辛');
  assert.equal(current[0].sourceDayAgreed, false);
});

test('the last regular month before insertion is usable through its last day and the leap and following months remain gated', () => {
  const startLeap = Date.parse('2025-07-24T16:00:00Z');
  const result = profile({ start: startLeap - 3_600_000, end: startLeap + 3_600_000 });
  const months = result.rows.filter(row => row.scope === 'monthly');
  const days = result.rows.filter(row => row.scope === 'daily');
  for (const rows of [months, days]) {
    assert.equal(rows.length, 2);
    assert.equal(rows[0].end, startLeap);
    assert.equal(rows[1].start, startLeap);
    assert.deepEqual(rows.map(row => [row.lunarMonth, row.lunarMonthIsLeap, row.calendarReady, row.ready]),
      [[6, false, true, true], [6, true, false, false]]);
  }
  assert.equal(months[0].lifeBranch, '丑');
  assert.equal(days[0].lifeBranch, '午');
  assert.equal(days[0].lunarDay, 30);
  assert.equal(days[1].lunarDay, 1);
  const after = profile(span('2025-09-02T00:00:00Z', '2025-09-02T01:00:00Z')).rows.find(row => row.scope === 'daily');
  assert.equal(after.lunarMonthIsLeap, false);
  assert.equal(after.calendarReady, false);
  assert.match(after.reason, /闰月后/u);
  const reset = profile(span('2026-02-17T00:00:00Z', '2026-02-17T01:00:00Z')).rows.find(row => row.scope === 'daily');
  assert.equal(reset.lunarMonth, 1);
  assert.equal(reset.ready, true);
});

test('real July 2025 client facts recover the Ling month and day rules and require the same-palace Jie witness for the month rule', () => {
  const input = { periodType: 'month', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2025, month: 7 } };
  const asOf = Date.parse('2025-07-12T04:00:00Z');
  const archived = { snapshotId: 'ling-july-2025', chart: chart() };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, archived)));
  const bound = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), 'ling-july-2025', archived);
  const monthRule = run => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId.endsWith('ling-cycle-v1-month-p001-001'));
  const match = monthRule(bound);
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.windows, [{ start: '2025-07-06T20:04:59.000Z', endExclusive: '2025-07-24T16:00:00.000Z' }]);
  const [hitId] = match.sourceFactIds;
  const hit = bound.facts.find(fact => fact.factId === hitId).normalizedPayload;
  assert.equal(hit.monthJie.name, '小暑');
  assert.equal(hit.monthJie.beforeStem, '壬');
  assert.equal(hit.sourceStem, '癸');
  assert.equal(hit.lunarMonth, 6);
  assert.equal(hit.lifeBranch, '丑');
  const empty = structuredClone(bound);
  for (const fact of empty.facts.filter(fact => fact.factType === 'ling_time_segment')) fact.normalizedPayload.samePalaceJieChangedStem = false;
  assert.deepEqual(monthRule(empty).sourceFactIds, []);
  const report = interpretFortune(bound, requestForFortuneRun(bound), 'ling-july-report');
  const prompt = formatFortuneFactAudit(buildFortuneModelContext(bound, report).input);
  assert.match(prompt, /小暑于.*交节，流月命宫仍在丑宫，月干由壬换为癸/u);
  assert.doesNotMatch(prompt, /samePalaceJieChangedStem|beforeTransformations/u);
  const dayRule = date => matchFortuneKnowledge(calculate(date)).byMethod.ziwei.find(row => row.knowledgeId.endsWith('ling-boundary-v1-day-p001-001'));
  assert.equal(dayRule('2025-07-24').status, 'matched');
  assert.equal(dayRule('2025-07-24').windows.at(-1).endExclusive, '2025-07-24T15:00:00.000Z');
  assert.deepEqual(dayRule('2025-07-25').sourceFactIds, []);
});

test('unresolved leap calendars, missing birth basis, duplicate palaces and overlapping decades never become ready', () => {
  const window = span('2025-08-01T00:00:00Z', '2025-08-02T00:00:00Z');
  const leap = profile(window);
  assert.ok(leap.rows.filter(row => ['monthly', 'daily'].includes(row.scope)).every(row => !row.ready && !row.calendarReady));
  assert.ok(leap.warnings.some(warning => warning.includes('闰月')));
  const bornLeap = structuredClone(natal); bornLeap.rawDates.lunarDate.isLeap = true;
  const normal = span('2026-11-18T00:00:00Z', '2026-11-19T00:00:00Z');
  assert.ok(profile(normal, 'day', bornLeap).rows.filter(row => row.scope === 'daily').every(row => !row.ready));
  const missing = structuredClone(natal); delete missing.rawDates;
  assert.equal(profile(normal, 'day', missing).status, 'unavailable');
  const duplicate = structuredClone(natal); duplicate.palaces[1].earthlyBranch = duplicate.palaces[0].earthlyBranch;
  assert.equal(profile(normal, 'day', duplicate).status, 'unavailable');
  const shifted = structuredClone(natal); [shifted.palaces[0].index, shifted.palaces[1].index] = [shifted.palaces[1].index, shifted.palaces[0].index];
  assert.equal(profile(normal, 'day', shifted).status, 'unavailable');
  const duplicateStar = structuredClone(natal);
  const originalPalace = duplicateStar.palaces.find(palace => palace.majorStars.some(star => star.name === '天相'));
  duplicateStar.palaces.find(palace => palace !== originalPalace).majorStars.push(structuredClone(originalPalace.majorStars.find(star => star.name === '天相')));
  assert.ok(profile(normal, 'day', duplicateStar).rows.every(row => !row.ready));
  assert.ok(profile(normal, 'day', natal, [...decades(normal), ...decades(normal)]).rows.every(row => !row.ready));
});

test('upper layers keep their own stems and exact cutoffs instead of using the target palace stem', () => {
  const window = span('2026-11-18T00:00:00Z', '2026-11-19T00:00:00Z'), middle = (window.start + window.end) / 2;
  const result = profile(window, 'day', natal, [{ start: window.start, end: middle, stem: '己', branch: '卯' },
    { start: middle, end: window.end, stem: '庚', branch: '辰' }]);
  const days = result.rows.filter(row => row.scope === 'daily');
  assert.ok(days.some(row => row.end === middle && row.contacts.some(contact => contact.sourceScope === 'decadal' && contact.sourceStem === '己')));
  assert.ok(days.some(row => row.start === middle && row.contacts.some(contact => contact.sourceScope === 'decadal'
    && contact.sourceStem === '庚' && contact.star === '天相' && contact.kind === '忌')));
  assert.ok(days.every(row => row.contacts.some(contact => contact.sourceScope === 'natal' && contact.sourceStem === '庚')));
  assert.ok(result.rows.filter(row => row.scope === 'decadal').every(row => row.contacts.every(contact => ['natal', 'decadal'].includes(contact.sourceScope))));
});

test('real source facts reach SQLite predicates and Chinese context, while generic transformations cannot stand in for this profile', () => {
  const search = profile(span('2026-03-18T16:00:00Z', '2026-03-19T16:00:00Z'));
  const hit = search.rows.find(row => row.scope === 'daily' && row.contacts.some(contact => contact.star === '武曲'
    && contact.kind === '忌' && contact.placements.some(palace => row.lifeAreaBranches.includes(palace.branch))));
  assert.ok(hit, 'the known 2026-03-19 Wuqu Ji day must remain reachable');
  const date = new Date(hit.start + 8 * 3_600_000).toISOString().slice(0, 10);
  const run = calculate(date);
  const results = matchFortuneKnowledge(run).byMethod.ziwei;
  const match = results.find(row => row.knowledgeId === ruleAt(25).knowledgeId);
  assert.equal(match.status, 'matched');
  assert.equal(match.windows.at(-1).endExclusive, date + 'T15:00:00.000Z');
  assert.ok(match.sourceFactIds.every(id => run.facts.find(fact => fact.factId === id).normalizedPayload.sourceScope === 'daily'));
  const context = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-prompt'));
  const prompt = formatFortuneFactAudit(context.input);
  assert.match(prompt, /单独采用令东来/u);
  assert.match(prompt, /武曲化忌/u);
  assert.ok(!/ling-doujun|tableVersion|sourceScope|inLifeArea|rawDates|palaceIndex/u.test(prompt));
  assert.ok(context.input.sections.find(section => section.id === 'wealth').findings.some(finding => finding.knowledgeId === match.knowledgeId));
  assert.match(formatFortunePrompt(context.input), /可能出现小额费用/u);
  const upperOnly = structuredClone(run);
  upperOnly.facts = upperOnly.facts.filter(fact => !match.sourceFactIds.includes(fact.factId));
  assert.deepEqual(matchFortuneKnowledge(upperOnly).byMethod.ziwei.find(row => row.knowledgeId === match.knowledgeId).sourceFactIds, []);
  const generic = structuredClone(run); generic.facts = generic.facts.filter(fact => !fact.factType.startsWith('ling_'));
  assert.equal(matchFortuneKnowledge(generic).byMethod.ziwei.find(row => row.knowledgeId === ruleAt(25).knowledgeId).status, 'unknown');
  const ambiguous = structuredClone(run); ambiguous.methods.ziwei.warnings.push('候选盘分别保留');
  assert.equal(matchFortuneKnowledge(ambiguous).byMethod.ziwei.find(row => row.knowledgeId === ruleAt(25).knowledgeId).status, 'unknown');
});

test('Ling communication and busy-day interpretations require the actual daily transformation and source palace', () => {
  const cases = [
    ['2026-04-13', 'p002', '巨门', '命宫', '丁', '整体互动'],
    ['2026-04-23', 'p002', '巨门', '迁移', '丁', '外部场合'],
    ['2026-04-02', 'p003', '廉贞', '命宫', '丙', '余裕较少'],
    ['2026-02-18', 'p003', '贪狼', '命宫', '癸', '余裕较少'],
  ];
  for (const [date, passage, star, palace, stem, reading] of cases) {
    const run = submittedDay(date, '1990-05-05', 6);
    const match = dayMatch(run, passage);
    assert.equal(match.status, 'matched', date);
    assert.equal(match.windows.at(-1).endExclusive, date + 'T15:00:00.000Z');
    const evidence = run.facts.filter(fact => match.sourceFactIds.includes(fact.factId));
    for (const { normalizedPayload: fact } of evidence) {
      assert.deepEqual([fact.sourceScope, fact.star, fact.flowName, fact.sourceStem], ['daily', star, palace, stem]);
    }
    const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-daily-source'));
    assert.ok(formatFortunePrompt(model.input).includes(reading), date);
    for (const change of [{ sourceScope: 'monthly' }, { flowName: '财帛' }, { sourceDayAgreed: false }]) {
      const altered = structuredClone(run);
      for (const fact of altered.facts.filter(fact => match.sourceFactIds.includes(fact.factId))) {
        Object.assign(fact.normalizedPayload, change);
      }
      assert.deepEqual(dayMatch(altered, passage).sourceFactIds, []);
    }
  }
});

test('Ling p004 separates joint void learning from the same-day auspicious creative context', () => {
  const cases = [
    ['1990-01-27', 0, '2026-02-22', '亥', ['地空', '地劫'], ['天钺'], true],
    ['1990-01-27', 1, '2026-02-20', '戌', ['地空'], ['左辅', '右弼'], false],
    ['1981-03-03', 0, '2026-02-22', '亥', ['地空', '地劫'], [], false],
  ];
  for (const [birth, hour, date, branch, voidStars, helpers, expected] of cases) {
    const run = submittedDay(date, birth, hour), fact = dayLife(run), p = fact.normalizedPayload;
    assert.equal(p.branch, branch);
    assert.deepEqual(p.dailyStudySupport.voidsAtLife, voidStars.map(star => ({ star, branch })));
    assert.deepEqual(p.dailyStudySupport.support.map(row => row.star), helpers);
    assert.ok(p.dailyStudySupport.transformations.length > 0);
    assert.equal(p.dailyStudySupportedCandidate, expected);
    const jointLearning = voidStars.length === 2;
    assert.equal(p.dailyLearningVoidPairAtLife, jointLearning);
    const match = dayMatch(run, 'p004');
    assert.equal(match.status, jointLearning ? 'matched' : 'not_matched');
    if (jointLearning) {
      assert.deepEqual(match.sourceFactIds, [fact.factId]);
      assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      assert.equal(fact.activeTo, date + 'T15:00:00.000Z');
      const late = run.facts.find(row => row.factType === 'ling_palace_condition' && row.scope === 'daily'
        && row.normalizedPayload.flowName === '命宫' && row.normalizedPayload.sourceDayAgreed === false);
      assert.equal(late.normalizedPayload.dailyLearningVoidPairAtLife, true);
      assert.equal(dayMatch({ ...run, facts: [late] }, 'p004').status, 'not_matched');
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-study'));
      assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === match.knowledgeId));
      assert.match(formatFortuneFactAudit(input), /地空、地劫均实守亥宫的流日命宫，供学习与思考分支审阅/u);
      const message = formatFortunePrompt(input);
      assert.match(message, /可参考在该日安排学习、思考和整理所需的安静时段/u);
      assert.equal(/若当天有创作安排，可参考这一段/u.test(message), expected);
      assert.doesNotMatch(message, /供学习与思考分支审阅|dailyLearningVoidPairAtLife|dailyStudySupportedCandidate|\b[FE]\d+\b/u);
    }
    const prompt = dayPrompt(run);
    if (expected) {
      assert.match(prompt, /地空、地劫均实守亥宫的流日命宫.*具名吉星有未宫天钺/u);
      assert.match(prompt, /流日丁干所发太阴化禄在亥宫/u);
    } else {
      assert.doesNotMatch(prompt, /同一日命三方四正的具名吉星/u);
    }
    assert.doesNotMatch(prompt, /dailyStudySupport|voidsAtLife/u);
  }
});

test('Ling p004 excludes other palaces and retains uncertainty when a co-seated void star is absent or duplicated', () => {
  const next = submittedDay('2026-02-23', '1981-03-03', 0), nextLife = dayLife(next);
  assert.equal(nextLife.normalizedPayload.dailyLearningVoidPairAtLife, false);
  assert.equal(nextLife.normalizedPayload.dailyStudySupport, undefined);
  assert.equal(dayMatch(next, 'p004').status, 'not_matched');
  const spanOfStudy = span('2026-02-22T13:00:00Z', '2026-02-22T14:00:00Z');
  const n = astro.withOptions({ dateStr: '1981-03-03', timeIndex: 0, gender: '女', fixLeap: true, config }).toJSON();
  const current = profile(spanOfStudy, 'day', n).rows.find(row => row.scope === 'daily');
  assert.equal(current.lifeConditions.dailyLearningVoidPairAtLife, true);
  const missing = structuredClone(n);
  for (const palace of missing.palaces) for (const field of ['majorStars', 'minorStars', 'adjectiveStars']) {
    palace[field] = palace[field].filter(star => star.name !== '地劫');
  }
  const duplicate = structuredClone(n);
  const robbery = duplicate.palaces.flatMap(palace => [...palace.minorStars, ...palace.adjectiveStars]).find(star => star.name === '地劫');
  duplicate.palaces.find(palace => palace.earthlyBranch === '子').minorStars.push(robbery);
  const relocated = structuredClone(n);
  const oldSeat = relocated.palaces.find(palace => palace.earthlyBranch === '亥');
  const oldRobbery = oldSeat.minorStars.find(star => star.name === '地劫');
  oldSeat.minorStars = oldSeat.minorStars.filter(star => star.name !== '地劫');
  relocated.palaces.find(palace => palace.earthlyBranch === '子').minorStars.push(oldRobbery);
  for (const natal of [missing, duplicate, relocated]) {
    const row = profile(spanOfStudy, 'day', natal).rows.find(row => row.scope === 'daily');
    assert.equal(row.ready, true);
    assert.deepEqual(row.lifeConditions.dailyStudySupport.voidsAtLife, [{ star: '地空', branch: '亥' }]);
    assert.equal(row.lifeConditions.dailyLearningVoidPairAtLife, undefined);
  }
});

test('Ling p004 keeps known learning and creative evidence when unrelated transformations are incomplete', () => {
  const sample = ['2026-02-22', '1990-01-27', 0];
  const absent = (...missing) => chart => {
    for (const palace of chart.palaces) for (const layer of ['majorStars', 'minorStars', 'adjectiveStars']) {
      palace[layer] = palace[layer].filter(row => !missing.includes(row.name));
    }
  };
  const missingUnrelated = submittedDay(...sample, absent('天相'));
  const missingHelper = submittedDay(...sample, absent('天相', '天钺'));
  for (const [run, creative] of [[missingUnrelated, true], [missingHelper, undefined]]) {
    const fact = dayLife(run), p = fact.normalizedPayload;
    assert.equal(p.ready, false);
    assert.equal(fact.completeness, 'complete');
    assert.equal(p.dailyLearningPlacementProof, lingZiweiPolicy.dailyLearningPlacementProof);
    assert.equal(p.dailyLearningVoidPairAtLife, true);
    assert.equal(p.dailyStudySupportedCandidate, creative);
    const result = dayMatch(run, 'p004');
    assert.equal(result.status, 'matched');
    assert.deepEqual(result.sourceFactIds, [fact.factId]);
    assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: sample[0] + 'T15:00:00.000Z' }]);
    const exact = evaluateFortuneRules('ziwei', 'day', [fact]).find(row => row.knowledgeId === result.knowledgeId)
      .confirmations.find(row => row.condition.includes('dailyStudySupportedCandidate'));
    assert.deepEqual([exact.hits.length, exact.unknown], creative ? [1, false] : [0, true]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-study-incomplete'));
    const audit = formatFortuneFactAudit(input);
    assert.match(audit, /日命空劫已单独核位，其余盘层仍待核/u);
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /可参考在该日安排学习、思考和整理所需的安静时段/u);
    assert.equal(/若当天有创作安排，可参考这一段/u.test(prompt), creative === true);
    assert.doesNotMatch(prompt, /dailyLearningPlacementProof|未宫天钺/u);
  }
  const missingSkyNatal = astro.withOptions({ dateStr: sample[1], timeIndex: sample[2], gender: '女', fixLeap: true, config }).toJSON();
  absent('地空')(missingSkyNatal);
  const missingSky = profile(span('2026-02-22T13:00:00Z', '2026-02-22T14:00:00Z'), 'day', missingSkyNatal)
    .rows.find(row => row.scope === 'daily');
  assert.deepEqual(missingSky.lifeConditions.dailyStudySupport.voidsAtLife, [{ star: '地劫', branch: '亥' }]);
  assert.equal(missingSky.lifeConditions.dailyLearningVoidPairAtLife, undefined);
  assert.equal(missingSky.lifeConditions.dailyStudySupportedCandidate, undefined);
});

test('Ling p004 distinguishes the verified creative supports from coincident mislayered stars', () => {
  const sample = ['2026-02-22', '1990-01-27', 0];
  const wrongLayer = (name, layer) => natal => {
    const seat = natal.palaces.find(palace => palace[layer].some(star => star.name === name));
    const [star] = seat[layer].splice(seat[layer].findIndex(row => row.name === name), 1);
    seat.adjectiveStars.push(star);
  };
  const invalidHelper = submittedDay(...sample, wrongLayer('天钺', 'minorStars'));
  const helper = dayLife(invalidHelper).normalizedPayload;
  assert.equal(helper.dailyStudySupportPlacementProof, lingZiweiPolicy.dailyStudySupportPlacementProof);
  assert.equal(helper.dailyLearningVoidPairAtLife, true);
  assert.equal(helper.dailyStudySupportedCandidate, undefined);
  assert.deepEqual(helper.dailyStudySupport.support, []);
  assert.ok(helper.dailyStudySupport.transformations.some(row => row.star === '太阴' && row.sourceScope === 'daily'));
  assert.equal(dayMatch(invalidHelper, 'p004').status, 'matched');
  const helperContext = buildFortuneModelContext(invalidHelper,
    interpretFortune(invalidHelper, requestForFortuneRun(invalidHelper), 'ling-study-mislayered-helper'));
  const message = formatFortunePrompt(helperContext.input);
  assert.match(message, /可参考在该日安排学习、思考和整理所需的安静时段/u);
  assert.doesNotMatch(message, /若当天有创作安排|未宫天钺/u);

  const invalidRecipient = submittedDay(...sample, wrongLayer('太阴', 'majorStars'));
  const recipient = dayLife(invalidRecipient).normalizedPayload;
  assert.deepEqual(recipient.dailyStudySupport.support, [{ star: '天钺', branch: '未' }]);
  assert.ok(recipient.dailyStudySupport.transformations.every(row => row.star !== '太阴'));
  assert.equal(dayMatch(invalidRecipient, 'p004').status, 'matched');
});

test('Ling p004 excludes same-palace Wuqu Ke and Ziwei Ke from auspicious support on the void palace', () => {
  for (const [birth, date, star, stem] of [
    ['1980-02-15', '2026-05-30', '武曲', '甲'],
    ['1980-04-15', '2026-05-21', '紫微', '乙'],
  ]) {
    const run = submittedDay(date, birth, 0), payload = dayLife(run).normalizedPayload;
    const { voidsAtLife, transformations, voidKe } = payload.dailyStudySupport;
    assert.deepEqual(voidsAtLife, [{ star: '地空', branch: '亥' }, { star: '地劫', branch: '亥' }]);
    assert.ok(voidKe.some(item => item.star === star && item.sourceScope === 'daily' && item.sourceStem === stem && item.branch === '亥'));
    assert.ok(transformations.every(item => !(item.star === star && item.kind === '科' && item.branch === '亥')));
    assert.match(dayPrompt(run), new RegExp('亥宫的' + star + '化科与空劫同宫', 'u'));
  }
});

test('Ling p005 joins the actual daily Lu palace with a different peach star by same palace, trine or opposition', () => {
  const cases = [
    ['1990-01-27', '2026-03-01', 0, '午', ['廉贞', '甲', '戌', []]],
    ['1990-01-27', '2026-05-24', 0, '辰', ['贪狼', '戊', '子', []]],
    ['1990-01-27', '2026-03-21', 7, '辰', ['廉贞', '甲', '申', [['贪狼', '寅', '对宫']]]],
    ['1990-01-27', '2026-02-23', 0, '子', ['贪狼', '戊', '子', []]],
    ['1990-01-27', '2026-02-19', 0, '申', ['廉贞', '甲', '戌', []]],
    ['1990-01-27', '2026-06-05', 0, '辰', undefined],
    ['1990-01-27', '2026-02-19', 7, '卯', ['廉贞', '甲', '申', [['贪狼', '寅', '对宫']]]],
    ['1990-01-27', '2026-02-23', 7, '未', ['贪狼', '戊', '寅', [['廉贞', '申', '对宫'], ['沐浴', '戌', '三合']]]],
    ['1993-03-15', '2026-02-23', 4, '卯', ['贪狼', '戊', '午', [
      ['红鸾', '午', '同宫'], ['天喜', '子', '对宫'], ['天姚', '寅', '三合'], ['咸池', '午', '同宫'],
    ]]],
  ];
  for (const [birth, date, hour, branch, lu] of cases) {
    const run = submittedDay(date, birth, hour), fact = dayLife(run), p = fact.normalizedPayload;
    assert.equal(p.branch, branch);
    const witness = p.dailyPeachLu;
    assert.deepEqual(witness && [witness.star, witness.sourceStem, witness.branch,
      witness.companions.map(row => [row.star, row.branch, row.relation])], lu, date);
    if (witness) assert.equal(witness.sourceScope, 'daily');
    if (date === '2026-02-19' || date === '2026-06-05') {
      const contact = run.facts.find(f => f.factType === 'ling_transformation_contact' && f.scope === 'daily'
        && f.normalizedPayload.star === '廉贞' && f.normalizedPayload.kind === '禄');
      assert.deepEqual([contact.normalizedPayload.sourceScope, contact.normalizedPayload.inLifeArea],
        date === '2026-02-19' ? ['daily', false] : ['monthly', true]);
    }
    const expected = Boolean(lu?.[3].length);
    assert.equal(p.dailyPeachLuCandidate, expected);
    const match = dayMatch(run, 'p005');
    assert.equal(match.status, expected ? 'matched' : 'not_matched');
    const prompt = dayPrompt(run);
    if (expected) {
      assert.deepEqual(match.sourceFactIds, [fact.factId]);
      assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      assert.ok(prompt.includes('流日' + witness.sourceStem + '干使' + witness.star + '化禄，受化星在' + witness.branch + '宫，与'));
      if (witness.companions.some(row => row.star === '沐浴')) assert.match(prompt, /戌宫归档沐浴成三合/u);
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-romance'));
      assert.match(formatFortunePrompt(input), /社交互动、相识或接触增多/u);
    }
    assert.doesNotMatch(prompt, /dailyPeachLu|sourceScope/u);
  }
});

test('Ling p001 treats day-stem Tianji Ji and the verified Liang-Ma star pair as independent movement branches', () => {
  for (const [birth, hour, date, reason, evidence] of [
    ['1990-01-27', 0, '2026-04-04', '天机化忌', { tianjiJi: { star: '天机', kind: '忌', sourceScope: 'daily', sourceStem: '戊', branch: '巳' } }],
    ['1981-03-03', 0, '2026-02-22', '梁马飘荡', { liangMa: { tianliangBranch: '亥', horseBranch: '亥', relation: '同宫' } }],
    ['1988-04-18', 4, '2026-02-23', '梁马飘荡', { liangMa: { tianliangBranch: '申', horseBranch: '寅', relation: '对宫' } }],
  ]) {
    const run = submittedDay(date, birth, hour), fact = dayLife(run);
    assert.deepEqual(fact.normalizedPayload.dailyTravelReasons, [reason]);
    assert.deepEqual(JSON.parse(JSON.stringify(fact.normalizedPayload.dailyTravelEvidence)), evidence);
    const match = dayMatch(run, 'p001');
    assert.equal(match.status, 'matched');
    assert.deepEqual(match.sourceFactIds, [fact.factId]);
    assert.equal(match.windows.at(-1).endExclusive, date + 'T15:00:00.000Z');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-travel'));
    assert.match(formatFortunePrompt(input), /天梁与天马的同宫、对宫结构/u);
  }
  const adjacent = submittedDay('2026-02-21', '1981-03-03', 0);
  assert.equal(dayLife(adjacent).normalizedPayload.dailyTravelEvidence?.liangMa, undefined);
  assert.notEqual(dayMatch(adjacent, 'p001').status, 'matched');
  const misplacedHorse = submittedDay('2026-02-22', '1981-03-03', 0, natal => {
    const original = natal.palaces.find(seat => seat.earthlyBranch === '亥');
    const horse = original.minorStars.find(star => star.name === '天马');
    assert.ok(horse);
    original.minorStars = original.minorStars.filter(star => star !== horse);
    natal.palaces.find(seat => seat.earthlyBranch === '巳').minorStars.push(horse);
  });
  assert.equal(dayLife(misplacedHorse).normalizedPayload.dailyTravelEvidence?.liangMa, undefined);
  assert.notEqual(dayMatch(misplacedHorse, 'p001').status, 'matched');
});

test('Ling paperwork uses actual daily Xin Wenchang Ji and retains the source examples as conditional readings', () => {
  const run = submittedDay('2026-02-26', '1990-01-27', 0);
  const knowledgeId = ruleAt(26).knowledgeId;
  const lookup = candidate => matchFortuneKnowledge(candidate).byMethod.ziwei.find(row => row.knowledgeId === knowledgeId);
  const match = lookup(run);
  assert.equal(match.status, 'matched');
  assert.ok(match.sourceFactIds.length);
  const altered = structuredClone(run);
  for (const id of match.sourceFactIds) {
    const fact = altered.facts.find(row => row.factId === id).normalizedPayload;
    assert.deepEqual([fact.sourceScope, fact.sourceStem, fact.star, fact.kind], ['daily', '辛', '文昌', '忌']);
    fact.sourceScope = 'monthly';
  }
  assert.deepEqual(lookup(altered).sourceFactIds, []);
  const wrongStarSeat = submittedDay('2026-02-26', '1990-01-27', 0, natal => {
    const original = natal.palaces.find(seat => seat.minorStars.some(star => star.name === '文昌'));
    const star = original.minorStars.find(row => row.name === '文昌');
    original.minorStars = original.minorStars.filter(row => row !== star);
    natal.palaces.find(seat => seat.earthlyBranch !== original.earthlyBranch).minorStars.push(star);
  });
  assert.notEqual(lookup(wrongStarSeat).status, 'matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-paperwork'));
  assert.match(formatFortunePrompt(input), /涉及文书、证件或合约事项时/u);
});

test('each revised source has a reviewed profile query and each daily predicate checks the agreed day', () => {
  for (let index = 18; index <= 28; index++) {
    const rule = ruleAt(index);
    assert.ok(rule.queries.length && rule.review?.mappedConditions.length);
    assert.ok(rule.queries.every(query => query.where.profile === lingZiweiPolicy.profile && query.where.tableVersion === lingZiweiPolicy.table));
    if (rule.period === 'day') assert.ok(rule.queries.every(query => query.where.sourceDayAgreed === true));
  }
});

test('Taiyin uses the author’s printed twelve grades, including Xu temple and You prosperous', () => {
  assert.deepEqual([...'子丑寅卯辰巳午未申酉戌亥'].map(lingTaiyinBrightness), [...'庙庙陷陷陷陷陷陷旺旺庙庙']);
  assert.equal(lingTaiyinBrightness(''), undefined);
  assert.equal(lingTaiyinBrightness('寅卯'), undefined);
});

test('one literary star and one annual transformation in the real annual life area can reach SQLite', () => {
  const run = annualRun('1993-03-15', 4);
  const fact = annualLife(run, 'yearly');
  assert.ok(fact);
  const p = fact.normalizedPayload;
  assert.deepEqual(p.yearLifeAreaWritingStars, [{ star: '文昌', branch: '午' }]);
  assert.deepEqual(p.yearLifeAreaLiteraryTransforms, [{ star: '文昌', kind: '科', sourceScope: 'yearly', sourceStem: '丙', branch: '午' }]);
  assert.deepEqual(p.yearLifeAreaAnnualLiteraryKinds, ['科']);
  const match = annualMatch(run, 'p001');
  assert.equal(match.status, 'partial');
  assert.ok(match.sourceFactIds.includes(fact.factId));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-yearly-literary'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /流年命宫三方四正内有流年丙干所发文昌化科，受化星在午宫/u);
  assert.doesNotMatch(prompt, /yearLifeAreaLiterary|sourceScope|ling-annual-v1-annual-p001/u);
});

test('Ling confirms both named literary stars with the actual annual Ke and Quan only after the year changes', () => {
  const run = annualRun('1993-03-07', 8);
  const fact = annualLife(run, 'yearly');
  const p = fact.normalizedPayload;
  const result = annualMatch(run, 'p001');
  assert.equal(p.natalLiteraryPlacementProof, 'ling-wenchang-wenqu-birth-hour-v1');
  assert.deepEqual(p.yearLifeAreaWritingStars, [{ star: '文昌', branch: '寅' }, { star: '文曲', branch: '子' }]);
  assert.deepEqual(p.yearLifeAreaLiteraryTransforms.filter(row => row.sourceScope === 'yearly').map(row => [row.star, row.kind, row.branch]),
    [['天机', '权', '子'], ['文昌', '科', '寅']]);
  assert.deepEqual(p.yearLifeAreaAnnualLiteraryKinds, ['权', '科']);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: '2026-02-16T16:00:00.000Z', endExclusive: '2026-12-31T16:00:00.000Z' }]);
  const upperOnly = { ...fact, normalizedPayload: { ...p, yearLifeAreaAnnualLiteraryKinds: ['权'] } };
  assert.equal(annualMatch({ ...run, facts: [upperOnly] }, 'p001').status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-yearly-literary-pair'));
  const message = formatFortunePrompt(input);
  assert.match(message, /同一区域还实见由流年天干所发的化科、化权/u);
  assert.doesNotMatch(message, /yearLifeAreaAnnualLiteraryKinds|\b[FE]\d+\b/u);

  const archive = astro.withOptions({ dateStr: '1993-03-07', timeIndex: 8, gender: '男', fixLeap: true, config }).toJSON();
  const noDecade = profile(span(fact.activeFrom, fact.activeTo), 'year', archive, []).rows.find(row => row.scope === 'yearly');
  assert.equal(noDecade.ready, false);
  assert.equal(noDecade.lifeConditions.yearLifeLiteraryPairVerified, true);
  assert.ok(noDecade.lifeConditions.yearLifeAreaLiteraryTransforms.every(row => row.sourceScope === 'yearly'));
  const independent = { ...fact, normalizedPayload: { ...p, ...noDecade.lifeConditions, ready: noDecade.ready } };
  const onlyYear = annualMatch({ ...run, facts: [independent] }, 'p001');
  assert.equal(onlyYear.status, 'matched');
  assert.deepEqual(onlyYear.windows, result.windows);
  const stale = { ...fact, normalizedPayload: { ...p, natalLiteraryPlacementProof: undefined } };
  assert.equal(annualMatch({ ...run, facts: [stale] }, 'p001').status, 'unknown');

  const displaced = annualRun('1993-03-07', 8, undefined, 2026, { relocateMinor: ['文昌', '戌'] });
  const wrongFact = annualLife(displaced, 'yearly'), wrong = wrongFact.normalizedPayload;
  assert.ok(wrong.surroundingStarNames.includes('文昌'));
  assert.deepEqual(wrong.yearLifeAreaWritingStarNames, ['文曲']);
  assert.deepEqual(wrong.yearLifeAreaAnnualLiteraryKinds, ['权']);
  assert.equal(annualMatch({ ...displaced, facts: [wrongFact] }, 'p001').status, 'partial');
});

test('the annual literary pair keeps its real window even if an unrelated natal recipient is duplicated', () => {
  const run = annualRun('1993-03-07', 8, undefined, 2026, { duplicate: '破军' });
  const fact = annualLife(run, 'yearly'), data = fact.normalizedPayload;
  assert.equal(data.ready, false);
  assert.equal(fact.completeness, 'complete');
  assert.equal(data.yearLifeLiteraryPairVerified, true);
  assert.ok(data.yearLifeAreaLiteraryTransforms.every(row => row.sourceScope === 'yearly'));
  assert.equal(data.natalHongluanProof, undefined);
  const hit = annualMatch(run, 'p001');
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: '2026-02-16T16:00:00.000Z', endExclusive: '2026-12-31T16:00:00.000Z' }]);

  const unclear = annualRun('1993-03-07', 8, undefined, 2026, { duplicate: '天机' });
  const unclearFact = annualLife(unclear, 'yearly');
  assert.equal(unclearFact.completeness, 'partial');
  assert.equal(unclearFact.normalizedPayload.yearLifeLiteraryPairVerified, undefined);
  assert.equal(annualMatch({ ...unclear, facts: [unclearFact] }, 'p001').status, 'unknown');
  const wrongLayer = annualRun('1993-03-07', 8, undefined, 2026, { moveToMinor: '天机' });
  const wrongLayerFact = annualLife(wrongLayer, 'yearly');
  assert.deepEqual(wrongLayerFact.normalizedPayload.yearLifeAreaAnnualLiteraryKinds, ['科']);
  assert.equal(annualMatch({ ...wrongLayer, facts: [wrongLayerFact] }, 'p001').status, 'partial');

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-annual-literary-pair-only'));
  assert.match(formatFortuneFactAudit(input), /年命四正内的昌曲与流年科权已单独核位，其余盘层仍待核/u);
  const message = formatFortunePrompt(input);
  assert.match(message, /文书之喜/u);
  assert.doesNotMatch(message, /yearLifeLiteraryPairVerified|其余盘层仍待核|流年命宫三方四正内有流年丙干所发/u);
});

test('Ling verifies separate exam support from Chang Qu, San Tai, Ba Zuo and a verified annual Ke directly opposite life', () => {
  const run = annualRun('1993-03-12', 10);
  const prior = annualLife(run, 'yearly', 2025);
  const fact = annualLife(run, 'yearly', 2026);
  assert.equal(prior.activeTo, '2026-02-16T16:00:00.000Z');
  assert.equal(fact.activeFrom, prior.activeTo);
  const proof = fact.normalizedPayload;
  assert.equal(proof.branch, '午');
  assert.deepEqual(proof.yearLifeAreaAnnualLiteraryKinds, ['科']);
  assert.equal(proof.yearLifeLiteraryPairVerified, false);
  assert.equal(proof.yearLifeExamStructureVerified, true);
  assert.deepEqual(proof.yearLifeExamStars, [{ star: '三台', branch: '子' }, { star: '八座', branch: '寅' }]);
  assert.deepEqual(proof.yearLifeExamKeOpposition, { star: '文昌', kind: '科', sourceScope: 'yearly', sourceStem: '丙', branch: '子' });
  assert.notEqual(annualMatch({ ...run, facts: [prior] }, 'p001').status, 'matched');
  const matched = annualMatch(run, 'p001');
  assert.equal(matched.status, 'matched');
  assert.deepEqual(matched.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.deepEqual(matched.sourceFactIds, [fact.factId]);

  const displaced = annualRun('1993-03-12', 10, undefined, 2026, { relocateAdjective: ['三台', '戌'] });
  const wrong = annualLife(displaced, 'yearly');
  assert.ok(wrong.normalizedPayload.surroundingStarNames.includes('三台'));
  assert.equal(wrong.normalizedPayload.yearLifeExamStructureVerified, false);
  assert.equal(annualMatch({ ...displaced, facts: [wrong] }, 'p001').status, 'partial');

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-writing-exams'));
  assert.match(formatFortuneFactAudit(input), /流年命宫三方四正内，三台在子宫/u);
  assert.match(formatFortuneFactAudit(input), /流年文昌化科落在流年命宫对宫的子位/u);
  const message = formatFortunePrompt(input);
  assert.match(message, /若当年确有驾照等考试安排/u);
  assert.doesNotMatch(message, /yearLifeExamStructureVerified|三台在子宫/u);
});

test('Ling keeps independent annual Ke with the four verified literary and noble stars', () => {
  const birthDate = '1988-02-07', timeIndex = 5, year = 2025;
  const run = annualRun(birthDate, timeIndex, undefined, year);
  const life = annualLife(run, 'yearly', year);
  assert.ok(life);
  const p = life.normalizedPayload;
  assert.deepEqual(p.yearLifeAreaWritingStars, [{ star: '文昌', branch: '巳' }, { star: '文曲', branch: '酉' }]);
  assert.deepEqual(p.yearLifeNobles, [{ star: '天魁', branch: '亥' }, { star: '天钺', branch: '酉' }]);
  assert.deepEqual(p.yearLifeAreaAnnualLiteraryKinds, ['科']);
  assert.equal(p.yearLifeExamStructureVerified, false);
  assert.equal(p.yearLifeExamKeWithNoblesVerified, true);
  const scoped = { ...run, facts: [life] };
  const hit = annualMatch(scoped, 'p001');
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '文书之喜');
  assert.equal(hit.windows[0].start, '2025-01-28T16:00:00.000Z');
  assert.equal(hit.windows[0].endExclusive, life.activeTo);
  const before = run.facts.filter(fact => fact.factType === life.factType && fact.scope === 'yearly' && fact.activeTo <= life.activeFrom);
  assert.ok(before.length);
  assert.notEqual(annualMatch({ ...run, facts: before }, 'p001').status, 'matched');

  const misplaced = annualRun(birthDate, timeIndex, undefined, year, { relocateMinor: ['天钺', '丑'] });
  const moved = annualLife(misplaced, 'yearly', year);
  assert.ok(moved);
  assert.deepEqual(moved.normalizedPayload.yearLifeNobles, [{ star: '天魁', branch: '亥' }]);
  assert.equal(moved.normalizedPayload.yearLifeExamKeWithNoblesVerified, false);
  assert.notEqual(annualMatch({ ...misplaced, facts: [moved] }, 'p001').status, 'matched');
  const missingLayer = annualRun(birthDate, timeIndex, undefined, year, { duplicate: '巨门' });
  const independent = annualLife(missingLayer, 'yearly', year);
  assert.ok(independent);
  assert.equal(independent.normalizedPayload.ready, false);
  assert.equal(annualMatch({ ...missingLayer, facts: [independent] }, 'p001').status, 'matched');

  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'ling-noble-literary'));
  const audit = formatFortuneFactAudit(input), prompt = formatFortunePrompt(input);
  assert.match(audit, /天魁在亥宫/u);
  assert.match(audit, /天钺在酉宫/u);
  assert.match(prompt, /本命天魁、天钺。同一区域实见当年天干所发的化科/u);
  assert.doesNotMatch(prompt, /天魁在亥宫|天钺在酉宫|yearLifeExamKeWithNoblesVerified/u);
});

test('author-grade Taiyin and separately placed Wenchang coincide with a real annual Ke and natal Hongluan', () => {
  const run = annualRun('1993-05-15', 4, '陷');
  const d = annualLife(run, 'decadal'), y = annualLife(run, 'yearly');
  assert.ok(d && y);
  const p = d.normalizedPayload;
  assert.deepEqual([p.taiyinBranch, p.taiyinBrightness, p.wenchangBranch, p.taiyinWenchangInLifeArea, p.taiyinBirthDaylight],
    ['戌', '庙', '午', true, 'day']);
  assert.equal(p.wenchangInAuthorBrightPalace, false);
  assert.equal(y.normalizedPayload.wenchangInAuthorBrightPalace, false);
  assert.equal(y.normalizedPayload.wenchangHaiTempleInAuthorStarNotes, false);
  assert.equal(y.normalizedPayload.natalHongluanBranch, '午');
  assert.deepEqual(y.normalizedPayload.natalHongluanProof, { expectedBranch: '午', archivedBranch: '午', verified: true });
  assert.deepEqual(y.normalizedPayload.yearLifeKeScopes, ['yearly']);
  assert.equal(y.normalizedPayload.taiyinWenchangCoGuardDecadeLife, false);
  const match = annualMatch(run, 'p002');
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.windows, [{ start: '2026-02-16T16:00:00.000Z', endExclusive: '2026-12-31T16:00:00.000Z' }]);
  assert.ok([d.factId, y.factId].every(id => match.sourceFactIds.includes(id)));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-yearly-red'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /太阴在戌宫，依作者原表为庙，文昌在午宫/u);
  assert.match(prompt, /流年命宫走到本命红鸾所在宫/u);
  assert.doesNotMatch(prompt, /natalHongluan|taiyinTable|ling-annual-v1-annual-p002/u);
  const message = formatFortunePrompt(input);
  assert.doesNotMatch(message, /大限太阴文昌有力且流年科鸾相会|太阴在戌宫|taiyinWenchangCoGuardDecadeLife|结婚生子/u);

  const earlierDecade = { ...d, activeFrom: run.time.displayWindow.instantRange.startInstant, activeTo: y.activeFrom };
  assert.equal(annualMatch({ ...run, facts: [earlierDecade, y] }, 'p002').status, 'not_matched');

  const outside = structuredClone(run);
  annualLife(outside, 'yearly').normalizedPayload.yearLifeKeScopes = [];
  assert.equal(annualMatch(outside, 'p002').status, 'not_matched');
  const missing = structuredClone(run);
  delete annualLife(missing, 'yearly').normalizedPayload.natalHongluanInYearLife;
  assert.equal(annualMatch(missing, 'p002').status, 'unknown');
});

test('Ling confirms the same-period decadal Taiyin and Hai Wenchang under the separate author star notes', () => {
  const year = 1998, run = annualRun('1985-11-07', 11, undefined, year);
  const d = annualLife(run, 'decadal', year), y = annualLife(run, 'yearly', year);
  const dp = d.normalizedPayload, yp = y.normalizedPayload;
  assert.deepEqual([dp.branch, dp.taiyinBranch, dp.wenchangBranch, dp.taiyinBrightness], ['亥', '亥', '亥', '庙']);
  assert.equal(dp.wenchangInAuthorBrightPalace, false);
  assert.equal(dp.wenchangHaiTempleInAuthorStarNotes, true);
  assert.equal(yp.wenchangHaiTempleInAuthorStarNotes, true);
  assert.equal(yp.taiyinWenchangCoGuardDecadeLife, true);
  assert.deepEqual([yp.branch, yp.natalHongluanBranch, yp.yearLifeKeScopes], ['寅', '寅', ['yearly']]);
  assert.ok(yp.yearLifeAreaLiteraryTransforms.some(row => row.star === '右弼' && row.kind === '科' && row.sourceStem === '戊' && row.branch === '寅'));
  const match = annualMatch(run, 'p002');
  assert.equal(match.status, 'matched');
  assert.equal(match.matchedSourceExcerpt, '化科、红鸾');
  assert.deepEqual(match.windows, [{ start: '1998-01-27T16:00:00.000Z', endExclusive: '1998-12-31T16:00:00.000Z' }]);
  assert.ok([d.factId, y.factId].every(id => match.sourceFactIds.includes(id)));
  const otherStem = { ...y, normalizedPayload: { ...yp, yearLifeKeScopes: ['natal'] } };
  assert.equal(annualMatch({ ...run, facts: [d, otherStem] }, 'p002').status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-yearly-red-pair'));
  const message = formatFortunePrompt(input);
  assert.match(message, /化科、红鸾/u);
  assert.doesNotMatch(message, /太阴在亥宫|wenchangHaiTempleInAuthorStarNotes|taiyinWenchangCoGuardDecadeLife|natalHongluanProof|\b[FE]\d+\b/u);
  assert.equal(dp.natalLiteraryPlacementProof, 'ling-wenchang-wenqu-birth-hour-v1');
  for (const stale of [d, y]) {
    const facts = [d, y].map(fact => fact === stale
      ? { ...fact, normalizedPayload: { ...fact.normalizedPayload, natalLiteraryPlacementProof: undefined } } : fact);
    assert.equal(annualMatch({ ...run, facts }, 'p002').status, 'unknown');
  }
  const displaced = annualRun('1985-11-07', 11, undefined, year, { relocateMinor: ['文昌', '卯'] });
  const wrongDecade = annualLife(displaced, 'decadal', year), retainedYear = annualLife(displaced, 'yearly', year);
  assert.ok(wrongDecade.normalizedPayload.surroundingStarNames.includes('文昌'));
  assert.equal(wrongDecade.normalizedPayload.taiyinWenchangInLifeArea, undefined);
  assert.equal(wrongDecade.normalizedPayload.wenchangInAuthorBrightPalace, undefined);
  assert.equal(retainedYear.normalizedPayload.yearLifeRomancePairVerified, true);
  assert.equal(retainedYear.normalizedPayload.wenchangInAuthorBrightPalace, undefined);
  assert.equal(retainedYear.normalizedPayload.wenchangHaiTempleInAuthorStarNotes, undefined);
  assert.equal(retainedYear.normalizedPayload.taiyinWenchangCoGuardDecadeLife, undefined);
  assert.equal(annualMatch({ ...displaced, facts: [wrongDecade, retainedYear] }, 'p002').status, 'unknown');
});

test('the Ling romance conditions keep their own interval when an unrelated natal transformation is duplicated', () => {
  const run = annualRun('1993-05-15', 4, undefined, 2026, { duplicate: '破军' });
  const d = annualLife(run, 'decadal'), y = annualLife(run, 'yearly');
  assert.ok(d && y);
  for (const fact of [d, y]) {
    assert.equal(fact.normalizedPayload.ready, false);
    assert.equal(fact.completeness, 'complete');
  }
  assert.equal(d.normalizedPayload.decadeLifeTaiyinWenchangVerified, true);
  assert.equal(y.normalizedPayload.yearLifeRomancePairVerified, true);
  assert.deepEqual(y.normalizedPayload.yearLifeKeScopes, ['yearly']);
  const result = annualMatch({ ...run, facts: [d, y] }, 'p002');
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.windows, [{ start: '2026-02-16T16:00:00.000Z', endExclusive: '2026-12-31T16:00:00.000Z' }]);
  assert.ok([d.factId, y.factId].every(id => result.sourceFactIds.includes(id)));
  assert.equal(annualMatch({ ...run, facts: [y] }, 'p002').status, 'unknown');
  const withoutProof = { ...y, normalizedPayload: { ...y.normalizedPayload, yearLifeRomancePairVerified: undefined } };
  assert.equal(annualMatch({ ...run, facts: [d, withoutProof] }, 'p002').status, 'unknown');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-romance-independent'));
  const message = formatFortunePrompt(input);
  assert.doesNotMatch(message, /两星可以在该范围的不同宫|yearLifeRomancePairVerified|decadeLifeTaiyinWenchangVerified|太阴在戌宫/u);
});

test('Ling confirms both Wenchang and Taiyin author brightness on verified shared and separate seats', () => {
  for (const { birthDate, timeIndex, year, seats, yearSeat, yearKe, coGuard } of [
    { birthDate: '1986-06-10', timeIndex: 9, year: 2033, seats: ['丑', '丑', '丑', '庙'],
      yearSeat: '丑', yearKe: '太阴', coGuard: true },
    { birthDate: '1985-09-09', timeIndex: 5, year: 2034, seats: ['亥', '亥', '巳', '庙'],
      yearSeat: '寅', yearKe: '武曲', coGuard: false },
  ]) {
    const run = annualRun(birthDate, timeIndex, undefined, year);
    const d = annualLife(run, 'decadal', year), y = annualLife(run, 'yearly', year);
    const dp = d.normalizedPayload, yp = y.normalizedPayload;
    assert.deepEqual([dp.branch, dp.taiyinBranch, dp.wenchangBranch, dp.taiyinBrightness], seats);
    for (const payload of [dp, yp]) {
      assert.equal(payload.lingAnnualMajorBirthAnchorProof, 'quanshu-natal-ziwei-bureau-lunar-day-v1');
      assert.equal(payload.wenchangInAuthorBrightPalace, true);
      assert.equal(payload.wenchangBrightnessProfile, 'ling-wenchang-temple-or-prosperous-six-palaces-v1');
    }
    assert.equal(yp.taiyinWenchangCoGuardDecadeLife, coGuard);
    assert.deepEqual([yp.branch, yp.natalHongluanBranch], [yearSeat, yearSeat]);
    assert.ok(yp.yearLifeKeScopes.includes('yearly'));
    assert.ok(yp.yearLifeAreaLiteraryTransforms.some(row => row.star === yearKe && row.kind === '科'
      && row.sourceScope === 'yearly' && row.branch === yearSeat));
    const match = annualMatch(run, 'p002');
    assert.equal(match.status, 'matched');
    assert.deepEqual(match.windows, [{ start: y.activeFrom, endExclusive: y.activeTo }]);
    assert.ok([d.factId, y.factId].every(id => match.sourceFactIds.includes(id)));
    const old = { ...y, normalizedPayload: { ...yp, wenchangBrightnessProfile: undefined } };
    assert.equal(annualMatch({ ...run, facts: [d, old] }, 'p002').status, 'partial');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ling-romance-brightness'));
    const message = formatFortunePrompt(input);
    assert.match(message, /太阴、文昌均在作者所列庙旺宫位/u);
    assert.doesNotMatch(message, /wenchangInAuthorBrightPalace|wenchangBrightnessProfile|文昌在[丑巳]宫/u);
  }

  const shifted = annualRun('1986-06-10', 9, undefined, 2033, { birthDate: '1986-06-11' });
  const shiftedDecade = annualLife(shifted, 'decadal', 2033).normalizedPayload;
  const shiftedYear = annualLife(shifted, 'yearly', 2033).normalizedPayload;
  assert.equal(shiftedDecade.branch, '丑');
  assert.equal(shiftedDecade.taiyinBranch, undefined);
  assert.equal(shiftedYear.lingAnnualMajorBirthAnchorProof, undefined);
  assert.equal(shiftedYear.natalHongluanInYearLife, true);
  assert.deepEqual(shiftedYear.yearLifeKeScopes, ['natal', 'decadal']);
  assert.notEqual(annualMatch(shifted, 'p002').status, 'matched');
});

test('a mislocated archived Hongluan and duplicate transformation recipient do not qualify yearly conditions', () => {
  const window = span('2026-06-01T00:00:00Z', '2026-06-02T00:00:00Z');
  const natal = astro.withOptions({ dateStr: '1993-05-15', timeIndex: 4, gender: '男', fixLeap: true, config }).toJSON();
  const archive = structuredClone(natal);
  const oldSeat = archive.palaces.find(palace => palace.earthlyBranch === '午');
  const hongluan = oldSeat.adjectiveStars.find(star => star.name === '红鸾');
  assert.ok(hongluan);
  oldSeat.adjectiveStars = oldSeat.adjectiveStars.filter(star => star.name !== '红鸾');
  archive.palaces.find(palace => palace.earthlyBranch === '未').adjectiveStars.push(hongluan);
  const wrong = profile(window, 'year', archive).rows.find(row => row.scope === 'yearly');
  assert.deepEqual(wrong.lifeConditions.natalHongluanProof, { expectedBranch: '午', archivedBranch: '未', verified: false });
  assert.equal(wrong.lifeConditions.natalHongluanInYearLife, undefined);

  const wrongLayer = structuredClone(natal);
  const sameSeat = wrongLayer.palaces.find(palace => palace.earthlyBranch === '午');
  sameSeat.adjectiveStars = sameSeat.adjectiveStars.filter(star => star.name !== '红鸾');
  sameSeat.minorStars.push(hongluan);
  const misplaced = profile(window, 'year', wrongLayer).rows.find(row => row.scope === 'yearly');
  assert.deepEqual(misplaced.lifeConditions.natalHongluanProof, { expectedBranch: '午', archivedBranch: '午', verified: false });
  assert.equal(misplaced.lifeConditions.natalHongluanInYearLife, undefined);

  const receiver = natal.palaces.find(palace => palace.minorStars.some(star => star.name === '文昌'));
  receiver.minorStars.push(structuredClone(receiver.minorStars.find(star => star.name === '文昌')));
  const duplicate = profile(window, 'year', natal).rows.find(row => row.scope === 'yearly');
  assert.equal(duplicate.contacts.find(contact => contact.sourceScope === 'yearly' && contact.star === '文昌').located, false);
  assert.equal(duplicate.lifeConditions, undefined);
});

test('Ling annual Taiyin and Wenchang require the matching archived star layers', () => {
  const wrongTaiyin = annualRun('1993-05-15', 4, '庙', 2026, { moveToMinor: '太阴' });
  assert.equal(annualLife(wrongTaiyin, 'decadal').normalizedPayload.taiyinWenchangInLifeArea, undefined);
  assert.notEqual(annualMatch(wrongTaiyin, 'p002').status, 'matched');
});

test('an in-area Taiyin in the author’s fallen palace rejects the annual pair despite its archived brightness', () => {
  const run = annualRun('1993-07-15', 2, '庙');
  const d = annualLife(run, 'decadal').normalizedPayload, y = annualLife(run, 'yearly').normalizedPayload;
  assert.equal(d.taiyinWenchangInLifeArea, true);
  assert.equal(d.taiyinBrightness, '陷');
  assert.equal(y.natalHongluanInYearLife, true);
  assert.deepEqual(y.yearLifeKeScopes, ['natal']);
  assert.equal(annualMatch(run, 'p002').status, 'not_matched');
});
