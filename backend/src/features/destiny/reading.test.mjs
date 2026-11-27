import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { register } from 'node:module';
import { birthPlaces, birthTimeFromParts, daysInMonth, isBirthDate, isBirthTime, unknownBirthTime } from './model/birth-profile.ts';
import { birthInstants, localClock } from './control/birth-clock.ts';

// Use the same extensionless TypeScript imports Metro resolves in the app.
register('data:text/javascript,' + encodeURIComponent(`
  export function resolve(specifier, context, next) {
    if (['/control/local-reading.ts', '/control/manual-subject.ts', '/control/account-report.ts', '/model/account-birth-profile.ts', '/control/useBirthForm.ts', '/model/birth-places.ts', '/requests/report.ts', '/requests/archive.ts']
      .some((path) => context.parentURL?.endsWith(path)) && specifier.startsWith('.')) {
      return next(specifier + '.ts', context);
    }
    return next(specifier, context);
  }
`), import.meta.url);
const { restoreArchivedBaZiRows, runReading } = await import('./control/local-reading.ts');
const { calculateManualSubjectChart } = await import('./control/manual-subject.ts');
const { toDestinyArchive, toDestinyArchiveWithSnapshot } = await import('./control/account-report.ts');
const { accountBirthProfileFromDraft, completeAccountBirthProfile, readAccountBirthProfile } =
  await import('./model/account-birth-profile.ts');
const { saveDestinyArchive } = await import('./requests/archive.ts');
const { RequestError } = await import('../../shared/http/client.ts');
const { calculateBaZi, calculateWestern, calculateZiwei, ziweiTimeIndex } = await import('./control/charts.ts');
const { birthPlaceCatalog, findBirthPlace } = await import('./model/birth-places.ts');
const { validateBirthForm } = await import('./control/useBirthForm.ts');
const reportBaseUrl = process.env.EXPO_PUBLIC_DESTINY_API_BASE_URL;
process.env.EXPO_PUBLIC_DESTINY_API_BASE_URL = 'http://127.0.0.1:8788';
const { buildReportRequest, requestReport } = await import('./requests/report.ts');
if (reportBaseUrl === undefined) delete process.env.EXPO_PUBLIC_DESTINY_API_BASE_URL;
else process.env.EXPO_PUBLIC_DESTINY_API_BASE_URL = reportBaseUrl;

const known = { timeKnown: true, hour: 12, minute: 0 };

test('single-page submission checks all four fields and requires both hour and minute', () => {
  const incomplete = { date: null, time: null, place: null, gender: null };
  assert.deepEqual(Object.keys(validateBirthForm(incomplete)), ['date', 'time', 'place', 'gender']);
  const profile = { date: { year: 2000, month: 2, day: 29 }, time: known, place: birthPlaces[3], gender: 'female' };
  assert.deepEqual(validateBirthForm(profile), {});
  assert.deepEqual(validateBirthForm({ ...profile, gender: 'male' }), {});
  assert.deepEqual(validateBirthForm({ ...profile, gender: 'other' }), { gender: '请选择性别。' });
  for (const time of [unknownBirthTime, birthTimeFromParts(9, null), birthTimeFromParts(null, 7), birthTimeFromParts(24, 0)]) {
    assert.deepEqual(validateBirthForm({ ...profile, time }), { time: '请选择并确认出生的小时和分钟。' });
  }
  assert.deepEqual(Object.keys(validateBirthForm({ ...profile, date: { year: 2001, month: 2, day: 29 }, time: null })), ['date', 'time']);
});

test('resolves expanded locations by administrative code and still accepts old place IDs', async () => {
  assert.equal(new Set(birthPlaceCatalog.filter((place) => place.countryCode === 'CN').map((place) => place.region)).size, 31);
  assert.equal(new Set(birthPlaceCatalog.map((place) => place.id)).size, birthPlaceCatalog.length);
  assert.equal(findBirthPlace('1795565'), birthPlaces[3]);
  assert.equal(findBirthPlace('CN-440307'), birthPlaces[4]);
  assert.equal(findBirthPlace('CN-110105').region, '北京市');
  assert.equal(findBirthPlace('CN-220104').city, '长春市');
  const place = findBirthPlace('CN-510107');
  assert.equal(place.district, '武侯区');
  assert.equal(place.timeZone, 'Asia/Shanghai');
  const profile = { date: { year: 2000, month: 2, day: 29 }, time: known, place, gender: 'female' };
  const reading = await runReading(profile, new AbortController().signal, () => {});
  assert.equal(reading.profile.place, place);
  assert.ok(reading.charts.every((chart) => chart.rawResult.length > 0));
});

test('validates Gregorian leap years, future dates and explicit unknown time', () => {
  const today = new Date(2025, 1, 1);
  assert.equal(daysInMonth(1900, 2), 28);
  assert.equal(daysInMonth(2000, 2), 29);
  assert.ok(isBirthDate({ year: 2000, month: 2, day: 29 }, today));
  assert.ok(!isBirthDate({ year: 1900, month: 2, day: 29 }, today));
  assert.ok(!isBirthDate({ year: 2025, month: 2, day: 2 }, today));
  assert.ok(isBirthTime(unknownBirthTime));
  assert.ok(!isBirthTime({ timeKnown: false, hour: 0, minute: 0 }));
  assert.ok(!isBirthTime({ timeKnown: true, hour: 24, minute: 0 }));
});

test('only a verified district contributes a classical region to the report query', async () => {
  const date = { year: 2024, month: 5, day: 9 };
  const signal = new AbortController().signal;
  for (const [id, expected] of [
    ['CN-410302', '豫'], ['CN-140110', '冀'], ['CN-321002', '扬'],
    ['CN-320303', '徐'], ['CN-610104', '雍'], ['CN-410181', null],
  ]) {
    const place = findBirthPlace(id);
    assert.ok(place);
    const reading = await runReading({ date, time: known, place, gender: 'male' }, signal, () => {});
    const request = buildReportRequest(reading);
    for (const { method, confirmedFacts } of request.chartQueries) {
      const region = confirmedFacts.filter(({ kind }) => kind === 'natal_classical_region');
      assert.deepEqual(region, expected && method !== 'western' ? [{ kind: 'natal_classical_region', zone: expected }] : []);
    }
    assert.ok(!JSON.stringify(request).includes(place.id));
  }
});

test('exact account birth profiles can be confirmed while older incomplete times remain editable', () => {
  const fields = { birthDate: '2000-02-29', birthPlace: '广东省 深圳市 龙岗区', gender: 'female' };
  const exact = { ...fields, birthTime: '09:07' };
  const profile = completeAccountBirthProfile(exact);
  assert.deepEqual(profile.date, { year: 2000, month: 2, day: 29 });
  assert.deepEqual(profile.time, birthTimeFromParts(9, 7));
  const canonicalName = '中国 · 广东省 · 深圳市 · 龙岗区';
  assert.deepEqual(accountBirthProfileFromDraft(profile), { ...exact, birthPlace: canonicalName });
  assert.equal(completeAccountBirthProfile({ ...exact, birthPlace: canonicalName }).place.id, profile.place.id);

  for (const [birthTime, hour, minute] of [['09:??', 9, null], ['??:07', null, 7], ['', null, null]]) {
    const saved = { ...fields, birthTime };
    assert.equal(completeAccountBirthProfile(saved), null);
    assert.deepEqual(readAccountBirthProfile(saved).time, birthTimeFromParts(hour, minute));
  }
});

test('account drafts retain known fields but require review of invalid dates, time, gender, and ambiguous places', () => {
  const fields = { birthDate: '2000-02-29', birthTime: '??:07', birthPlace: '朝阳区', gender: 'other' };
  const draft = readAccountBirthProfile(fields);
  assert.deepEqual(draft.date, { year: 2000, month: 2, day: 29 });
  assert.deepEqual(draft.time, birthTimeFromParts(null, 7));
  assert.equal(draft.place, undefined);
  assert.equal(draft.gender, undefined);
  assert.equal(completeAccountBirthProfile(fields), null);
  assert.equal(readAccountBirthProfile({ ...fields, birthDate: '2001-02-29' }).date, undefined);
  assert.equal(readAccountBirthProfile({ ...fields, birthTime: '24:01' }).time, undefined);
  assert.equal(readAccountBirthProfile({ ...fields, birthPlace: '北京市' }).place?.id, '1816670');
  assert.equal(readAccountBirthProfile({ ...fields, birthPlace: '北京市 朝阳区' }).place?.district, '朝阳区');
});

test('uses birthplace offsets, rejects DST gaps and ambiguous precise times, and samples both folds', () => {
  const spring = { year: 2024, month: 3, day: 10 };
  const fall = { year: 2024, month: 11, day: 3 };
  const zone = 'America/New_York';
  assert.deepEqual(birthInstants(spring, known, zone).map((ms) => new Date(ms).toISOString()), ['2024-03-10T16:00:00.000Z']);
  assert.throws(() => birthInstants(spring, { ...known, hour: 2, minute: 30 }, zone), /没有符合该输入的当地时刻/);
  assert.throws(() => birthInstants(fall, { ...known, hour: 1, minute: 30 }, zone), /出现了两次/);
  assert.equal(birthInstants(spring, unknownBirthTime, zone).length, 47);
  assert.equal(birthInstants(fall, unknownBirthTime, zone).length, 51);
  assert.equal(birthInstants({ year: 1990, month: 7, day: 1 }, known, 'Asia/Shanghai')[0], Date.UTC(1990, 6, 1, 3));
});

test('preserves the known wheel value and restricts partial samples to matching times', () => {
  const hourOnly = birthTimeFromParts(14, null);
  const minuteOnly = birthTimeFromParts(null, 17);
  const date = { year: 2024, month: 4, day: 10 };
  const zone = 'Asia/Shanghai';
  const wallClock = localClock(zone);
  assert.deepEqual(hourOnly, { timeKnown: false, hour: 14, minute: null });
  assert.deepEqual(minuteOnly, { timeKnown: false, hour: null, minute: 17 });
  assert.deepEqual(birthTimeFromParts(null, null), unknownBirthTime);
  assert.ok(isBirthTime(hourOnly) && isBirthTime(minuteOnly));
  const hourSamples = birthInstants(date, hourOnly, zone).map((instant) => new Date(wallClock(instant)));
  const minuteSamples = birthInstants(date, minuteOnly, zone).map((instant) => new Date(wallClock(instant)));
  assert.equal(hourSamples.length, 13);
  assert.equal(minuteSamples.length, 24);
  assert.ok(hourSamples.every((sample) => sample.getUTCHours() === 14));
  assert.ok(minuteSamples.every((sample) => sample.getUTCMinutes() === 17));
});

test('runs three chart stages and prepares report facts and archive rows', async () => {
  const stages = [];
  const profile = { date: { year: 2006, month: 4, day: 10 }, time: known, place: birthPlaces[3], gender: 'female' };
  const signal = new AbortController().signal;
  const exact = await runReading(profile, signal, (stage) => stages.push(stage));
  const partial = await runReading({ ...profile, time: unknownBirthTime }, signal, () => {});
  assert.deepEqual(stages, ['validating', 'normalizing', 'bazi', 'ziwei', 'western']);
  assert.deepEqual(exact.charts.map(({ rawResult }) => rawResult.length), [1, 1, 1]);
  assert.deepEqual(partial.charts.map(({ rawResult }) => rawResult.length), [49, 13, 49]);
  assert.ok(partial.charts.every(({ timeCompleteness }) => timeCompleteness === 'partial'));
  const partialHour = partial.charts[0].summary.find(({ label }) => label === '时柱');
  assert.equal(partialHour.value, '随时刻变化');
  assert.deepEqual(partialHour.details, ['天干十神 随时刻变化', '藏干十神 随时刻变化', '神煞 其余随时刻变化']);
  assert.equal(partial.charts[1].summary.palaces, null);
  assert.equal(partial.charts[2].summary.exact, null);
  const overview = 'API 返回的测试报告';
  const exactArchive = toDestinyArchive(exact, overview);
  const partialArchive = toDestinyArchive(partial, overview);
  const archivedPillars = exactArchive.charts[0].rows;
  assert.deepEqual(restoreArchivedBaZiRows(archivedPillars), exact.charts[0].summary);
  const withoutHour = archivedPillars.map((row) => row.label === '时柱' ? { ...row, value: '随时刻变化' } : row);
  const restored = restoreArchivedBaZiRows(withoutHour);
  assert.deepEqual(restored.slice(0, 3), exact.charts[0].summary.slice(0, 3));
  assert.deepEqual(restored[3].details, ['天干十神 归档资料不足', '藏干十神 归档资料不足', '神煞 归档资料不足']);
  assert.deepEqual(restoreArchivedBaZiRows([{ label: '年柱', value: '甲子\n天干十神 旧记录' }]),
    [{ label: '年柱', value: '甲子', details: ['天干十神 旧记录'] }]);
  for (const [reading, archive] of [[exact, exactArchive], [partial, partialArchive]]) {
    assert.equal(archive.overview, overview);
    assert.equal(archive.mode, 'deepseek');
    assert.ok(!Object.hasOwn(reading, 'report'));
    assert.equal(Object.hasOwn(archive, 'sections'), false);
    assert.deepEqual(archive.charts.map(({ method }) => method), ['bazi', 'ziwei', 'western']);
    assert.deepEqual(archive.charts[0].rows.map(({ label, value }) => ({ label, value: value.split('\n')[0] })),
      reading.charts[0].summary.map(({ label, value }) => ({ label, value })));
    assert.equal(archive.charts[1].rows.length, reading === exact ? 13 : 1);
    assert.deepEqual(archive.charts[1].rows[0], { label: '生年纳音', value: '丙戌 · 屋上土' });
    assert.equal(archive.charts[2].rows.length, 10);
  }
  assert.ok(exactArchive.charts[2].rows.every(({ value }) => value.includes('宫')));
  assert.ok(exactArchive.charts[1].rows.some(({ value }) => /左辅（[庙旺平闲陷]）/u.test(value)));
  assert.ok(exactArchive.charts[1].rows.some(({ value }) => /右弼（[庙旺平闲陷]）/u.test(value)));
  assert.ok(partialArchive.charts[1].note.includes('时刻未完全确定'));
  assert.ok(partialArchive.charts[2].rows.every(({ value }) => !value.includes('宫')));
  assert.doesNotMatch(JSON.stringify(exactArchive), /CN-440307|Asia\/Shanghai|birthDate/);
  const exactRequest = buildReportRequest(exact);
  const partialRequest = buildReportRequest(partial);
  assert.deepEqual(Object.keys(exactRequest).sort(), ['chartQueries', 'timeKnown']);
  assert.deepEqual(exactRequest.chartQueries.map(({ method }) => method), ['bazi', 'ziwei', 'western']);
  assert.ok(exactRequest.chartQueries[0].confirmedFacts.some((fact) => fact.kind === 'pillar' && fact.position === 'hour'));
  const partialFacts = partialRequest.chartQueries.find(({ method }) => method === 'bazi').confirmedFacts;
  assert.ok(partialFacts.some((fact) => fact.kind === 'pillar' && fact.position === 'month'));
  assert.ok(!partialFacts.some((fact) => fact.kind === 'pillar' && fact.position === 'hour'));
  assert.doesNotMatch(JSON.stringify(exactRequest), /CN-440307|Asia\/Shanghai|2006-04-10|birthDate/);
});

test('serializes complete chart snapshots with full precision and preserves uncertain scenarios', async () => {
  const profile = {
    date: { year: 2024, month: 11, day: 3 }, place: birthPlaces[5], gender: 'female',
  };
  for (const time of [birthTimeFromParts(12, 30), unknownBirthTime]) {
    const reading = await runReading({ ...profile, time }, new AbortController().signal, () => {});
    const archive = toDestinyArchiveWithSnapshot(reading, '测试正文');
    const { chartSnapshot, ...display } = JSON.parse(JSON.stringify(archive));
    assert.deepEqual(display, JSON.parse(JSON.stringify(toDestinyArchive(reading, '测试正文'))));
    assert.equal(chartSnapshot.timeKnown, time.timeKnown);
    assert.equal(chartSnapshot.samplingVersion, reading.versions.sampling);
    for (const chart of reading.charts) {
      assert.equal(chartSnapshot[chart.method].rulesetVersion, chart.rulesetVersion);
      assert.deepEqual(chartSnapshot[chart.method].rawResult, JSON.parse(JSON.stringify(chart.rawResult)));
    }
    const [western] = chartSnapshot.western.rawResult;
    const venus = western.positions.find(({ planet }) => planet === 'Venus');
    assert.ok(Number.isFinite(venus.longitude) && !Number.isInteger(venus.longitude));
    const [ziwei] = chartSnapshot.ziwei.rawResult;
    assert.equal(ziwei.palaces.length, 12);
    assert.deepEqual(ziwei.palaces.flatMap(({ majorStars, minorStars }) => [...majorStars, ...minorStars])
      .map(({ mutagen }) => mutagen).filter(Boolean).sort(), ['忌', '权', '禄', '科']);
    if (time.timeKnown) {
      assert.equal(chartSnapshot.western.rawResult.length, 1);
      const [bazi] = chartSnapshot.bazi.rawResult;
      assert.equal(bazi.analysis.calculationVersion, 'natal-l1-l2-v2');
      assert.equal(bazi.analysis.pillars.day, bazi.day);
    } else {
      assert.equal(chartSnapshot.western.rawResult.length, 51);
      assert.equal(chartSnapshot.ziwei.rawResult.length, 13);
      assert.ok(chartSnapshot.bazi.rawResult.every((candidate) => !Object.hasOwn(candidate, 'analysis')));
    }
    assert.ok(Buffer.byteLength(JSON.stringify(archive)) < 512 * 1024);
  }
});

test('sends the full archive and confirms only snapshots acknowledged by the account service', async () => {
  const profile = {
    date: { year: 2024, month: 11, day: 3 }, place: birthPlaces[5], gender: 'female', time: birthTimeFromParts(12, 30),
  };
  const signal = new AbortController().signal;
  const reading = await runReading(profile, signal, () => {});
  const report = toDestinyArchiveWithSnapshot(reading, '测试正文');
  const entry = { id: 'a'.repeat(64), savedAt: 123, calculatedAt: report.calculatedAt, title: '命盘记录' };
  const calls = [];
  const send = (response) => async (ownerId, body, requestSignal) => {
    assert.equal(ownerId, 'account-owner');
    assert.equal(requestSignal, signal);
    calls.push(body);
    return response(body);
  };

  const full = await saveDestinyArchive(send(() => ({ ...entry, chartSnapshotSaved: true })), 'account-owner', report, signal);
  assert.deepEqual(calls, [report]);
  assert.equal(full.snapshotSaved, true);
  assert.deepEqual(full.record.report.chartSnapshot, report.chartSnapshot);

  const legacy = await saveDestinyArchive(send(() => entry), 'account-owner', report, signal);
  assert.equal(legacy.snapshotSaved, false);
  assert.ok(!Object.hasOwn(legacy.record.report, 'chartSnapshot'));

  calls.length = 0;
  const summary = await saveDestinyArchive(send((body) => {
    if (Object.hasOwn(body, 'chartSnapshot')) throw new RequestError('http', 'Too large', 413);
    return entry;
  }), 'account-owner', report, signal);
  assert.deepEqual(calls, [report, toDestinyArchive(reading, '测试正文')]);
  assert.equal(summary.snapshotSaved, false);
  assert.deepEqual(summary.record.report, legacy.record.report);

  calls.length = 0;
  const unauthorized = new RequestError('http', 'Forbidden', 403);
  await assert.rejects(saveDestinyArchive(send(() => { throw unauthorized; }), 'account-owner', report, signal), unauthorized);
  assert.deepEqual(calls, [report]);
});

test('manual synastry projects versioned calculation context and exact facts without the original form', async () => {
  const date = { year: 2000, month: 1, day: 15 };
  const place = birthPlaces[0];
  const chart = await calculateManualSubjectChart({ date, time: known, place, gender: 'female' });
  assert.deepEqual(Object.keys(chart).sort(), ['bazi', 'birthContext', 'calculatedAt', 'western', 'ziwei']);
  const birthInstant = new Date(Date.UTC(date.year, date.month - 1, date.day, 4)).toISOString();
  assert.deepEqual(chart.birthContext, { precision: 'minute', birthInstant,
    latitude: place.latitude, longitude: place.longitude, timeZone: place.timeZone, clockVersion: 'gregory-iana-intl-v1' });
  const { periods, gender } = chart.bazi.luckContext;
  assert.equal(gender, 'female');
  assert.equal(periods.length, 10);
  assert.ok(periods.every(({ start, endExclusive }, index) => start < endExclusive
    && (!index || periods[index - 1].endExclusive === start)));
  assert.equal(chart.bazi.status, 'complete');
  assert.equal(chart.bazi.pillars.length, 4);
  assert.ok(chart.bazi.pillars.every(({ stem, branch, hiddenStems }) => stem && branch && hiddenStems.length));
  assert.equal(chart.ziwei.status, 'complete');
  assert.equal(chart.ziwei.palaces.length, 12);
  assert.equal(chart.ziwei.lifePalaceBranch, chart.ziwei.palaces.find(({ name }) => name === '命宫').earthlyBranch);
  const rawZiwei = calculateZiwei({ date, time: known, place, gender: 'female' }, 6);
  assert.ok(rawZiwei.palaces.every(({ stemTransformations }) => stemTransformations?.length === 4));
  assert.deepEqual(chart.ziwei.palaces.map(({ heavenlyStem, stemTransformations }) => ({ heavenlyStem, stemTransformations })),
    rawZiwei.palaces.map(({ heavenlyStem, stemTransformations }) => ({ heavenlyStem, stemTransformations })));
  assert.ok(chart.ziwei.palaces.some(({ majorStars, minorStars }) =>
    [...majorStars, ...minorStars].some(({ mutagenOrigin }) => mutagenOrigin === 'birth_year')));
  assert.ok(chart.ziwei.palaces.some(({ majorStars }) => majorStars.some(({ brightness, brightnessProfile }) => brightness && brightnessProfile)));
  assert.equal(chart.western.status, 'complete');
  assert.equal(chart.western.houses.length, 12);
  const raw = calculateWestern(Date.UTC(date.year, date.month - 1, date.day, 4), place);
  assert.deepEqual(chart.western.positions, raw.positions.map(({ planet, longitude }) => ({ planet, longitude })));
  assert.doesNotMatch(JSON.stringify(chart), /julianDay|"utc"|"rawResult"|"date"|"place"/);
});

test('manual synastry keeps only stable facts when the time is unknown and supports cancellation', async () => {
  const profile = {
    date: { year: 2000, month: 1, day: 15 }, place: birthPlaces[0], gender: 'female', time: unknownBirthTime,
  };
  const chart = await calculateManualSubjectChart(profile);
  assert.equal(chart.birthContext, undefined);
  assert.equal(chart.bazi.luckContext, undefined);
  assert.equal(chart.bazi.status, 'partial');
  assert.equal(chart.bazi.pillars.find(({ position }) => position === 'hour').branch, null);
  assert.equal(chart.ziwei.status, 'unavailable');
  assert.equal(chart.ziwei.reason, 'ambiguous_time');
  assert.equal(chart.western.status, 'partial');
  assert.ok(chart.western.positions.some(({ planet }) => planet === 'Sun'));
  assert.ok(chart.western.positions.every(({ signIndex }) => Number.isInteger(signIndex)));
  assert.doesNotMatch(JSON.stringify(chart.western), /"longitude"|"houses"|"ascendant"|"midheaven"/);

  const withKnownHour = await calculateManualSubjectChart({ ...profile, time: birthTimeFromParts(12, null) });
  assert.equal(withKnownHour.ziwei.status, 'complete');
  assert.equal(withKnownHour.western.status, 'partial');
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(calculateManualSubjectChart(profile, controller.signal), /已取消测算/);
});

test('uses the API report and rejects an empty response or failed request', async (context) => {
  const signal = new AbortController().signal;
  const profile = { date: { year: 2006, month: 4, day: 10 }, time: known, place: birthPlaces[3], gender: 'female' };
  const reading = await runReading(profile, signal, () => {});
  const report = '\n# 综合\n' + 'API 返回的测试报告。'.repeat(120) + '\n';
  const transport = context.mock.method(globalThis, 'fetch', async () => Response.json({ report }));
  assert.equal(await requestReport(reading, signal), report);
  assert.deepEqual(JSON.parse(transport.mock.calls[0].arguments[1].body), buildReportRequest(reading));
  transport.mock.mockImplementation(async () => Response.json({ report, tieban: { additionalCalculations: [{
    profile: 'muxuan-book-annual-reconstruction-v1', results: [{ age: 24, clauseId: 7648, status: 'matched' }],
  }] } }));
  assert.equal(await requestReport(reading, signal), report);
  transport.mock.mockImplementation(async () => Response.json({ report: null }));
  await assert.rejects(requestReport(reading, signal), /未生成报告/);
  transport.mock.mockImplementation(async () => { throw new Error('Network unavailable'); });
  await assert.rejects(requestReport(reading, signal), /无法连接解读服务/);
});

test('BaZi uses the absolute Li Chun boundary and advances the local day at late Zi', () => {
  const london = localClock('Europe/London');
  // HKO 2024 almanac places Li Chun at 16:27 UTC+8, or 08:27 UTC.
  const before = Date.UTC(2024, 1, 4, 8, 26);
  const after = Date.UTC(2024, 1, 4, 8, 28);
  assert.deepEqual([calculateBaZi(before, london(before)).year, calculateBaZi(after, london(after)).year], ['癸卯', '甲辰']);
  assert.deepEqual([calculateBaZi(before, london(before)).month, calculateBaZi(after, london(after)).month], ['乙丑', '丙寅']);
  const term = Date.UTC(2024, 1, 4, 8, 27, 7);
  const tenthDay = term + 10 * 86_400_000;
  const xun = (time) => calculateBaZi(time, london(time)).solarMonthXun;
  assert.deepEqual([xun(term - 1000), xun(term), xun(tenthDay - 1000), xun(tenthDay)], [null, 'early', 'early', null]);
  const natal = (time) => calculateBaZi(time + 300 * 86_400_000, london(time + 300 * 86_400_000));
  assert.deepEqual([natal(before).fetalMonthPillar, natal(after).fetalMonthPillar], ['乙丑', '丙寅']);
  const qi = (time) => calculateBaZi(time, london(time)).previousQi;
  assert.deepEqual([qi(Date.UTC(2024, 1, 18)), qi(Date.UTC(2024, 1, 20))], ['大寒', '雨水']);
  const lateZi = Date.UTC(1988, 1, 15, 23, 30);
  const { year, month, day, hour, tenGods, shenSha } = calculateBaZi(lateZi - 8 * 3_600_000, lateZi);
  // The upstream EightChar regression fixture uses sect 1.
  assert.deepEqual({ year, month, day, hour }, { year: '戊辰', month: '甲寅', day: '辛丑', hour: '戊子' });
  assert.deepEqual(tenGods.day, {
    heavenlyStem: '日主', hiddenStems: [{ stem: '己', tenGod: '偏印' }, { stem: '癸', tenGod: '食神' }, { stem: '辛', tenGod: '比肩' }],
  });
  assert.equal(tenGods.month.heavenlyStem, '正财');
  assert.deepEqual(shenSha.month, [{ name: '驿马', sourcePillars: ['year'] }, { name: '天乙贵人', sourcePillars: ['day'] }]);
  assert.deepEqual(shenSha.year, [{ name: '空亡', sourcePillars: ['day'] }]);
  assert.equal(ziweiTimeIndex(lateZi), 12);
  assert.equal(ziweiTimeIndex(Date.UTC(1988, 1, 16, 0, 30)), 0);
});

test('Ziwei assigns natal assistant brightness for every branch and uses the lunar-year boundary for NaYin', () => {
  const chartOn = (year, month, day) => calculateZiwei({ date: { year, month, day }, gender: 'male' }, 2);
  const brightness = { 左辅: new Map(), 右弼: new Map() };
  const end = Date.UTC(2025, 0, 29);
  for (let utc = Date.UTC(2024, 1, 10); utc < end; utc += 14 * 86400000) {
    const day = new Date(utc);
    const chart = chartOn(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate());
    for (const { earthlyBranch, minorStars } of chart.palaces) {
      for (const star of minorStars) if (Object.hasOwn(brightness, star.name)) {
        assert.equal(star.scope, 'origin');
        brightness[star.name].set(earthlyBranch, star.brightness);
      }
    }
  }
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  assert.deepEqual(branches.map((branch) => brightness.左辅.get(branch)), [...'旺庙庙陷庙平旺庙平陷庙闲']);
  assert.deepEqual(branches.map((branch) => brightness.右弼.get(branch)), [...'庙庙旺陷庙平旺庙闲陷庙平']);
  for (const [year, month, day, pillar, naYin] of [
    [1973, 10, 13, '癸丑', '桑柘木'], [2024, 2, 6, '癸卯', '金箔金'], [2024, 2, 10, '甲辰', '覆灯火'],
  ]) {
    const chart = chartOn(year, month, day);
    assert.deepEqual([chart.yearPillar, chart.yearNaYin], [pillar, naYin]);
  }
});

test('Ziwei keeps the original leap date and changes palace placement at the day-15 split', () => {
  const profile = { date: { year: 2023, month: 4, day: 5 }, time: known, place: birthPlaces[3], gender: 'female' };
  const first = calculateZiwei(profile, 6);
  const second = calculateZiwei({ ...profile, date: { ...profile.date, day: 6 } }, 6);
  assert.deepEqual(first.rawDates.lunarDate, { lunarYear: 2023, lunarMonth: 2, lunarDay: 15, isLeap: true });
  assert.deepEqual(second.rawDates.lunarDate, { lunarYear: 2023, lunarMonth: 2, lunarDay: 16, isLeap: true });
  assert.equal(first.earthlyBranchOfSoulPalace, '酉');
  assert.equal(second.earthlyBranchOfSoulPalace, '戌');
  assert.equal(second.palaces.length, 12);
  assert.equal(second.palaces.find(({ name }) => name === '命宫').majorStars[0].mutagen, '权');
  assert.equal(calculateZiwei({ ...profile, gender: 'other' }, 6), null);
});

test('Western chart agrees with the USNO March equinox and assigns whole-sign houses', () => {
  const instant = Date.UTC(2024, 2, 20, 3, 6);
  const chart = calculateWestern(instant, birthPlaces[6]);
  assert.equal(chart.positions.length, 10);
  assert.equal(chart.houses.length, 12);
  const sunLongitude = chart.positions[0].longitude;
  assert.ok(Math.min(sunLongitude, 360 - sunLongitude) < 0.02);
  assert.equal(chart.houses[0], Math.floor(chart.ascendant / 30) * 30);
  assert.equal(chart.houses[chart.positions[0].house - 1], Math.floor(sunLongitude / 30) * 30);
  assert.notEqual(chart.ascendant, calculateWestern(instant, birthPlaces[3]).ascendant);
  assert.ok(chart.aspects.every(({ orb }) => orb >= 0 && orb <= 6));
});

test('unsupported Ziwei gender still returns BaZi and Western charts', async () => {
  const stages = [];
  const profile = { date: { year: 2006, month: 4, day: 10 }, time: known, place: birthPlaces[3], gender: 'other' };
  const result = await runReading(profile, new AbortController().signal, (stage) => stages.push(stage));
  assert.deepEqual(result.charts.map(({ rawResult }) => rawResult.length), [1, 0, 1]);
  assert.match(result.charts[1].warning, /紫微/);
  assert.ok(!stages.includes('ziwei'));
});

test('omits an unstable sun sign and cancels without advancing chart stages', async () => {
  const controller = new AbortController();
  const profile = { date: { year: 2024, month: 3, day: 20 }, time: unknownBirthTime, place: birthPlaces[3], gender: 'female' };
  const reading = await runReading(profile, controller.signal, () => {});
  const western = buildReportRequest(reading).chartQueries.find(({ method }) => method === 'western');
  assert.ok(!western.confirmedFacts.some(({ kind, planet }) => kind === 'planet_sign' && planet === 'Sun'));
  const stages = [];
  await assert.rejects(runReading(profile, controller.signal, (stage) => {
    stages.push(stage);
    controller.abort();
  }), /取消/);
  assert.deepEqual(stages, ['validating']);
});
