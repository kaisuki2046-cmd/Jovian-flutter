import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { Body, Ecliptic, GeoVector, SunPosition } from 'astronomy-engine';
import { astro } from 'iztro';
import { Solar } from 'lunar-javascript';
import { createAccountArchiveLoader, createFortuneFactHandler, createFortuneRepository, hashFortuneValue } from './server/fact-service.mjs';
import { createFortuneInterpretationHandler } from './server/interpretation-service.mjs';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';

const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { calculateFortuneFacts, factLayerVersion, factPolicies, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { interpretFortune, requestForFortuneRun, validateInterpretation } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { buildSolarReturnPositions, readTransitLongitude } = await import('./control/solar-transits.ts');
const { evaluateFortuneRules } = await import('./control/knowledge/catalog.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');

const owner = '00000000-0000-0000-0000-000000000001';
const stranger = '00000000-0000-0000-0000-000000000002';
const snapshotId = 'a'.repeat(64);
const config = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current' };
const natalDate = Solar.fromYmdHms(1990, 5, 5, 12, 0, 0).getLunar();
const venusAt = Date.parse('2026-10-03T04:00:00Z');
const venus = Ecliptic(GeoVector(Body.Venus, new Date(venusAt), true)).elon;
const natalChart = {
  version: 1, timeKnown: true, samplingVersion: 'fixture',
  bazi: { engineName: 'lunar-javascript', engineVersion: '1.7.8', rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1',
    rawResult: [{ utc: '1990-05-05T04:00:00Z', year: natalDate.getYearInGanZhiExact(), month: natalDate.getMonthInGanZhiExact(),
      day: natalDate.getDayInGanZhiExact(), hour: natalDate.getTimeInGanZhi(), tenGods: {}, shenSha: {} }] },
  ziwei: { engineName: 'iztro', engineVersion: '2.6.5', rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1',
    rawResult: [astro.withOptions({ dateStr: '1990-05-05', timeIndex: 6, gender: '女', fixLeap: true, config }).toJSON()] },
  western: { engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1',
    rawResult: [{ ascendant: SunPosition(new Date(venusAt)).elon, midheaven: 0, positions: [{ planet: 'Venus', longitude: venus }] }] },
};
const input = (periodType, displayTimezone = 'Asia/Shanghai', targetPeriod) => ({ periodType, displayTimezone, targetPeriod });
const run = (params, date, chart = natalChart) => {
  const time = buildFactTimeContext(params, Date.parse(date), 'server');
  return calculateFortuneFacts(params, time, 'fixed-run', { snapshotId, chart });
};
const isMethod = (method, type) => fact => fact.method === method && fact.factType === type;

test('extended facts preserve independent method groups, full natal context and timed solar returns', () => {
  const chart = structuredClone(natalChart);
  chart.western.rawResult[0].positions.push({ planet: 'Sun', longitude: SunPosition(new Date('1990-05-05T04:00:00Z')).elon });
  const result = run(input('day'), '2026-11-06T12:00:00Z', chart);
  validateFortuneFacts(result);
  for (const method of ['bazi', 'ziwei', 'western', 'almanac']) {
    assert.deepEqual(result.factGroups[method].factIds, result.facts.filter(fact => fact.method === method).map(fact => fact.factId));
    assert.deepEqual(result.factGroups[method].rawFactIds,
      result.rawFacts.filter(fact => fact.method === method).map(fact => fact.rawFactId));
  }
  assert.ok(result.facts.some(fact => isMethod('bazi', 'natal_structure')(fact)
    && fact.normalizedPayload.pillars.length === 4 && fact.normalizedPayload.usefulElements === 'undetermined'));
  for (const scope of ['yearly', 'monthly', 'daily']) {
    assert.ok(result.facts.some(fact => isMethod('bazi', 'layer_pillar')(fact) && fact.scope === scope));
  }
  assert.ok(result.facts.some(fact => isMethod('ziwei', 'time_segment')(fact) && fact.scope === 'minor'));
  const palace = result.facts.find(fact => isMethod('ziwei', 'palace_star_structure')(fact)
    && fact.normalizedPayload.stars.some(star => star.brightness));
  assert.ok(palace && palace.normalizedPayload.surrounding.length === 4);
  assert.ok(result.facts.some(isMethod('ziwei', 'layer_overlap')));
  assert.ok(result.facts.some(isMethod('western', 'natal_position')));
  const returns = result.facts.filter(isMethod('western', 'solar_return'));
  assert.equal(returns.length, 1);
  const payload = returns[0].normalizedPayload;
  const angle = Math.abs(SunPosition(new Date(payload.returnAt)).elon - payload.natalSunLongitude);
  assert.ok(Math.min(angle, 360 - angle) < 0.000001);
  assert.equal(payload.bodies.length, 10);
  assert.ok(payload.returnAt < returns[0].activeFrom);
  assert.equal(payload.returnAngles, 'unavailable');
  const boundary = buildSolarReturnPositions({ start: Date.parse('2026-01-01T00:00:00Z'),
    end: Date.parse('2027-01-01T00:00:00Z') }, chart.western);
  assert.equal(boundary.length, 2);
  assert.equal(boundary[0].end, boundary[1].start);
});

test('resolves historical period independently of server clock and honors civil DST', () => {
  const params = input('day', 'America/New_York', { date: '2026-03-08' });
  const asOf = Date.parse('2026-11-01T12:00:00Z');
  const time = buildFactTimeContext(params, asOf, 'server');
  assert.equal(time.displayWindow.localStart, '2026-03-08');
  assert.equal(time.displayWindow.localEndExclusive, '2026-03-09');
  assert.equal(time.window.end - time.window.start, 23 * 3_600_000);
  assert.equal(time.serverAsOfUtc, new Date(asOf).toISOString());
  assert.equal(time.referenceAt, time.window.start);
  assert.throws(() => buildFactTimeContext(input('day', 'Pacific/Apia', { date: '2011-12-30' }), asOf, 'server'), RangeError);
  assert.throws(() => buildFactTimeContext(input('week', 'Asia/Shanghai', { weekStartDate: '2026-11-03' }), asOf, 'server'), RangeError);
});

test('a weekly snapshot calculates only Western facts, retaining their raw origins and full week window', () => {
  const params = input('week', 'America/Los_Angeles', { weekStartDate: '2026-11-02' });
  const date = '2026-11-06T12:00:00Z';
  const result = run(params, date);
  for (const method of ['bazi', 'ziwei', 'almanac']) {
    assert.deepEqual(result.methods[method], { status: 'not_supported', warnings: [] });
    assert.deepEqual(result.factGroups[method], { factIds: [], rawFactIds: [] });
  }
  assert.equal(result.methods.western.status, 'partial');
  assert.equal(result.methods.western.nativeWindow.progression.status, 'inconsistent_natal');
  assert.deepEqual(result, run(params, date));
  validateFortuneFacts(result);
  assert.equal(result.time.displayWindow.localStart, '2026-11-02');
  assert.equal(result.time.displayWindow.localEndExclusive, '2026-11-09');
  assert.ok(result.facts.length > 0 && result.facts.every(item => item.method === 'western'));
  assert.ok(result.rawFacts.length > 0 && result.rawFacts.every(item => item.method === 'western'));
  const bad = { ...result, facts: [{ ...result.facts[0], sourceFactIds: ['missing'] }] };
  assert.throws(() => validateFortuneFacts(bad));
});

test('Ziwei year starts at lunar new year, and official leap month parts are assigned to separate windows', () => {
  const result = run(input('month', 'Asia/Shanghai', { year: 2025, month: 8 }), '2026-01-02T00:00:00Z');
  const months = result.facts.filter(fact => isMethod('ziwei', 'time_segment')(fact) && fact.scope === 'monthly');
  const leap = months.filter(item => item.normalizedPayload.leap);
  assert.deepEqual(leap.map(item => item.normalizedPayload.monthPart), ['first', 'second']);
  assert.deepEqual(leap[0].normalizedPayload.dayRange, [1, 15]);
  assert.equal(leap[0].activeTo, leap[1].activeFrom);
  const year = run(input('year', 'Asia/Shanghai', { year: 2026 }), '2026-01-01T00:00:00Z');
  assert.equal(year.methods.ziwei.status, 'completed');
  const annual = year.facts.filter(fact => fact.method === 'ziwei' && fact.scope === 'yearly' && fact.factType === 'time_segment');
  assert.equal(annual[1].activeFrom, '2026-02-16T16:00:00.000Z');
  const baZiYear = year.facts.filter(isMethod('bazi', 'time_segment'));
  assert.ok(baZiYear.some(fact => fact.normalizedPayload.boundary.includes('立春')));
  assert.notEqual(baZiYear[1].activeFrom, annual[1].activeFrom);
});

test('retains two exact retrograde contacts under one parent and isolates uncertain natal angles and houses', () => {
  const chart = { ...natalChart, timeKnown: false };
  const result = run(input('month'), '2026-10-05T12:00:00Z', chart);
  const matches = result.facts.filter(fact => isMethod('western', 'aspect_exact')(fact)
    && fact.normalizedPayload.transitBody === 'Venus' && fact.normalizedPayload.natalTargetId === 'Venus'
    && fact.normalizedPayload.exactAngle === 0);
  assert.equal(matches.length, 2);
  assert.equal(matches[0].parentSignalId, matches[1].parentSignalId);
  assert.deepEqual(matches.map(item => item.normalizedPayload.passIndex), [1, 2]);
  assert.deepEqual(matches.map(item => item.normalizedPayload.direction), ['direct', 'retrograde']);
  assert.ok(matches.every(item => item.normalizedPayload.orb < 1e-6));
  const secondDay = matches[1].exactInstant.slice(0, 10);
  const clipped = run(input('day', 'UTC', { date: secondDay }), '2026-10-05T12:00:00Z', chart);
  const clippedPass = clipped.facts.find(fact => fact.exactInstant === matches[1].exactInstant
    && fact.normalizedPayload.transitBody === 'Venus' && fact.normalizedPayload.natalTargetId === 'Venus');
  assert.equal(clippedPass.parentSignalId, matches[1].parentSignalId);
  assert.equal(clippedPass.normalizedPayload.passIndex, 2);
  assert.ok(result.facts.some(fact => isMethod('western', 'aspect_interval')(fact)
    && fact.subjectIds[0] !== fact.subjectIds[1]));
  assert.equal(result.methods.western.status, 'partial');
  assert.ok(result.facts.filter(fact => fact.method === 'western').every(fact => (
    !fact.subjectIds.some(id => ['ASC', 'MC', 'DSC', 'IC'].includes(id)) && fact.factType !== 'house_interval')));
});

test('a slow-planet return pass preserves its real closed loop across separate orbs, years and a day query', () => {
  const birthAt = Date.parse('1990-05-14T04:00:00Z');
  const sun = SunPosition(new Date(birthAt)).elon;
  const chart = { ...natalChart, timeKnown: false, western: { ...natalChart.western,
    rawResult: [{ julianDay: birthAt / 86_400_000 + 2440587.5, positions: [{ planet: 'Sun', longitude: sun }] }] } };
  const archive = { snapshotId, chart };
  const submit = (parameters, at) => {
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, at, archive)));
    return bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, at), snapshotId, archive);
  };
  const annual = year => submit(input('year', 'UTC', { year }), Date.UTC(year, 0, 1));
  const sameContact = ({ factType, normalizedPayload: p }) => factType === 'aspect_exact'
    && p.transitBody === 'Jupiter' && p.natalTargetId === 'Sun' && p.aspectType === 'sextile' && p.transitLongitude > 0 && p.transitLongitude < 180;
  const [first, reverse] = annual(2025).facts.filter(sameContact);
  const fullYear = annual(2026);
  const [last] = fullYear.facts.filter(sameContact);
  const [dayPass] = submit(input('day', 'UTC', { date: '2026-05-26' }), Date.UTC(2026, 4, 26)).facts.filter(sameContact);
  assert.ok(first && reverse && last && dayPass);
  assert.notEqual(first.parentSignalId, last.parentSignalId);
  assert.equal(last.normalizedPayload.passIndex, 1);
  assert.deepEqual([first, reverse, last, dayPass].map(fact => fact.normalizedPayload.retrogradeLoopPassIndex), [1, 2, 3, 3]);
  const expected = ['2025-10-06T14:50:53.364Z', '2025-12-17T11:14:36.978Z', '2026-05-26T20:13:04.073Z'];
  for (const [index, fact] of [first, reverse, last].entries()) {
    assert.ok(Math.abs(Date.parse(fact.exactInstant) - Date.parse(expected[index])) < 1000);
    assert.ok(Math.abs(readTransitLongitude('Jupiter', Date.parse(fact.exactInstant)) - (sun + 60)) < 1e-7);
  }
  assert.equal(dayPass.exactInstant, last.exactInstant);
  const loop = last.normalizedPayload.retrogradeLoop;
  assert.deepEqual(loop.passes.map(pass => pass.direction), ['direct', 'retrograde', 'direct']);
  assert.deepEqual(loop.passes.map(pass => pass.at), [first, reverse, last].map(fact => fact.exactInstant));
  assert.deepEqual(loop.turns.map(turn => turn.directionAfter), ['direct', 'retrograde', 'direct', 'retrograde']);
  assert.deepEqual(dayPass.normalizedPayload.retrogradeLoop, loop);

  const assess = facts => evaluateFortuneRules('western', 'year', facts).find(row =>
    row.knowledgeId.includes('-astrologyskill-v1-transit-p003-')).required[0];
  assert.deepEqual(assess([first, reverse, last]).hits, [reverse, last]);
  assert.deepEqual(assess([{ ...last, normalizedPayload: { ...last.normalizedPayload, retrogradeLoopPassIndex: undefined } }]).hits, []);
  assert.deepEqual(assess([{ ...reverse, normalizedPayload: { ...reverse.normalizedPayload,
    retrogradeLoopPassIndex: undefined, passIndex: 2, retrogradeLoop: undefined } }]).hits, []);
  assert.deepEqual(assess([{ ...last, normalizedPayload: { ...last.normalizedPayload, transitMotion: 'retrograde' } }]).hits, []);
  const adjacent = submit(input('day', 'UTC', { date: '2026-05-25' }), Date.UTC(2026, 4, 25));
  assert.ok(!adjacent.facts.some(sameContact));

  const isolated = { ...fullYear, facts: [last] };
  const { input: model } = buildFortuneModelContext(isolated,
    interpretFortune(isolated, requestForFortuneRun(isolated), snapshotId), snapshotId);
  assert.match(formatFortuneFactAudit(model), /这是同一顺逆回环的第3次精确经过/u);
  const provider = formatFortunePrompt(model);
  assert.doesNotMatch(provider, /retrogradeLoop|顺行过点于|2025-10-06[T ]14:50:53|2025-12-17[T ]11:14:36|2026-05-26[T ]20:13:04/u);
});

test('the fact matrix includes all ten natal planets, verified ASC and MC, and whole-sign housing', () => {
  const start = Date.parse('2026-11-06T00:00:00Z');
  const moon = Ecliptic(GeoVector(Body.Moon, new Date(start), true)).elon;
  const targets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  const western = { ...natalChart.western, rawResult: [{ ascendant: moon, midheaven: moon,
    positions: targets.map(planet => ({ planet, longitude: moon })) }] };
  const result = run(input('day', 'UTC'), '2026-11-06T12:00:00Z', { ...natalChart, western });
  const conjunctions = result.facts.filter(fact => isMethod('western', 'aspect_exact')(fact)
    && fact.normalizedPayload.transitBody === 'Moon' && fact.normalizedPayload.aspectType === 'conjunction');
  assert.deepEqual(new Set(conjunctions.map(fact => fact.normalizedPayload.natalTargetId)), new Set([...targets, 'ASC', 'MC']));
  assert.ok(conjunctions.every(item => Date.parse(item.exactInstant) === start));
  assert.ok(conjunctions.find(item => item.subjectIds.includes('MC')).normalizedPayload.allowedOrb === 3);
  assert.ok(conjunctions.find(item => item.subjectIds.includes('Sun')).normalizedPayload.allowedOrb === 4);
  assert.ok(result.facts.some(isMethod('western', 'house_interval')));
});

test('splits the Ziwei decade only at the relevant age transition', () => {
  const natal = natalChart.ziwei.rawResult[0];
  const decadal = [...natal.palaces].sort((a, b) => a.decadal.range[0] - b.decadal.range[0])[1];
  const year = natal.rawDates.lunarDate.lunarYear + decadal.decadal.range[0] - 1;
  const result = run(input('year', 'Asia/Shanghai', { year }), '2026-01-02T00:00:00Z');
  const windows = result.facts.filter(fact => isMethod('ziwei', 'time_segment')(fact) && fact.scope === 'decadal');
  assert.equal(windows.length, 2);
  assert.equal(windows[0].activeTo, windows[1].activeFrom);
  assert.equal(windows[1].normalizedPayload.nominalAge, decadal.decadal.range[0]);
  assert.equal(windows[1].normalizedPayload.lifePalaceIndex, decadal.index);
});

test('missing or incompatible methods do not prevent independent facts or inherit personal routes into almanac', () => {
  const chart = { ...natalChart, bazi: { ...natalChart.bazi, engineVersion: 'wrong' },
    ziwei: { ...natalChart.ziwei, rawResult: [] } };
  const result = run(input('day', 'America/Los_Angeles'), '2026-11-15T15:00:00Z', chart);
  assert.equal(result.methods.bazi.status, 'not_supported');
  assert.equal(result.methods.ziwei.status, 'unavailable');
  assert.equal(result.methods.western.status, 'partial');
  assert.equal(result.methods.western.nativeWindow.progression.status, 'missing_clock');
  assert.ok(result.facts.some(isMethod('western', 'aspect_interval')), 'existing transits remain available without a valid progression clock');
  const almanac = result.facts.filter(isMethod('almanac', 'general_almanac'));
  assert.equal(almanac.length, 2);
  assert.ok(almanac.every(fact => !fact.natalChartSnapshotId && !fact.profileId));
});

function call(handler, url, method = 'GET', body, headers = {}) {
  const chunks = body === undefined ? [] : [Buffer.isBuffer(body) ? body : JSON.stringify(body)];
  const request = Object.assign(Readable.from(chunks), { url, method, headers });
  return new Promise(resolve => {
    let status;
    const response = {
      setHeader() {},
      writeHead(next) { status = next; return response; },
      end(text) { resolve({ status, body: text ? JSON.parse(text) : undefined }); },
    };
    void handler(request, response);
  });
}

test('production accepts four periods of client facts, checks authorization, and matches without the account chart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jovian-fortune-facts-'));
  try {
    const repository = createFortuneRepository(directory);
    let now = Date.parse('2026-11-06T12:00:00Z');
    const headers = { authorization: 'Bearer fixture' };
    const loadArchive = ({ ownerId, snapshotId: requested, headers }) => {
      if (headers.authorization !== 'Bearer fixture' || ownerId !== owner || requested !== snapshotId) {
        throw Object.assign(new Error('Denied'), { status: 403 });
      }
      return { snapshotId, profileId: 'test-profile', profileVersion: '1',
        get chart() { assert.fail('The service must not look up the chart to use client facts'); } };
    };
    const handler = createFortuneFactHandler({ repository, now: () => now, loadArchive });
    let modelInput;
    const interpretation = createFortuneInterpretationHandler({ repository, loadArchive, expression: {
      model: 'fixture', version: 'fixture',
      async interpret(value) {
        modelInput = value;
        return { sections: ['overall', 'wealth', 'romance'].map(sectionId =>
          ({ sectionId, summary: '本期宜根据可确认的线索整理自己的安排。' })) };
      },
    } });
    const submit = (body, session = headers) => call(handler, '/fortune/calculate', 'POST', body, session);
    const storedIds = [];
    for (const period of ['day', 'week', 'month', 'year']) {
      const params = input(period);
      const factBatch = buildFortuneFactSubmission(params, now, { snapshotId, chart: natalChart });
      assert.ok(!Object.hasOwn(factBatch, 'rawFacts') && !Object.hasOwn(factBatch, 'chart'));
      const body = { ...params, expectedOwnerId: owner, snapshotId, factBatch };
      const gzip = { ...headers, 'content-encoding': 'gzip' };
      const response = period === 'year' ? await submit(gzipSync(JSON.stringify(body)), gzip) : await submit(body);
      assert.equal(response.status, 200, period);
      const id = response.body.reportId;
      storedIds.push(id);
      const stored = await repository.get(id);
      assert.equal(stored.facts.length, factBatch.facts.length);
      assert.equal(stored.time.clockSource, 'client');
      assert.equal(stored.time.asOfUtc, factBatch.asOfUtc);
      assert.equal(stored.natalChartSnapshotId, snapshotId);
      assert.ok(stored.rawFacts.every(row => !Object.hasOwn(row, 'payload')));
      if (period === 'day' || period === 'week') {
        modelInput = undefined;
        const responseReport = await call(interpretation, '/fortune/interpret', 'POST',
          { expectedOwnerId: owner, calculationRunId: id }, headers);
        assert.equal(responseReport.status, 200);
        assert.equal(responseReport.body.periodType, period);
        const local = run(params, factBatch.asOfUtc);
        const expected = buildFortuneModelContext(local, interpretFortune(local, requestForFortuneRun(local), 'fixture')).input;
        if (period === 'week' && expected.sections.every(section => section.findings.length === 0)) {
          assert.equal(modelInput, undefined);
          assert.ok(responseReport.body.sections.every(({ summary }) => /本期暂无足够资料/u.test(summary)));
        } else {
          assert.equal(JSON.stringify(modelInput.facts), JSON.stringify(expected.facts));
          assert.deepEqual(modelInput.methods, expected.methods);
        }
      }
      if (period !== 'week') continue;
      assert.deepEqual(stored.adviceThemes, {});
      assert.ok(stored.facts.length && stored.facts.every(item => item.method === 'western'));
      const borrowed = buildFortuneFactSubmission(input('day'), now, { snapshotId, chart: natalChart })
        .facts.find(item => item.method === 'bazi');
      assert.ok(borrowed);
      assert.equal((await submit({ ...body, factBatch: { ...factBatch, facts: [...factBatch.facts, borrowed] } })).status, 400);
      assert.equal((await submit(body)).body.reportId, id);
      assert.equal((await submit(gzipSync(JSON.stringify(body)), gzip)).body.reportId, id);
      assert.equal((await submit(Buffer.from('invalid gzip'), gzip)).status, 400);
      assert.equal((await submit(body, { ...headers, 'content-encoding': 'other' })).status, 415);
      assert.equal((await submit(body, {})).status, 403);
      assert.equal((await submit({ ...body, factBatch: undefined })).status, 400);
      assert.equal((await submit({ ...body, factBatch: { ...factBatch, version: 'old' } })).status, 400);
      assert.equal((await submit({ ...body, factBatch: { ...factBatch, window: { ...factBatch.window, end: 0 } } })).status, 409);
      const badFact = { ...factBatch.facts[0], activeTo: '2099-01-01T00:00:00.000Z' };
      assert.equal((await submit({ ...body, factBatch: { ...factBatch, facts: [badFact] } })).status, 400);
      const badSource = { ...factBatch.facts[0], sourceFactIds: ['client:other:raw:0'] };
      assert.equal((await submit({ ...body, factBatch: { ...factBatch, facts: [badSource] } })).status, 400);
      const advice = await call(interpretation, '/fortune/advice/' + id + '?expectedOwnerId=' + owner, 'GET', undefined, headers);
      assert.equal(advice.status, 200);
      assert.ok(advice.body.groups.every(group => !group.items.length));
    }
    assert.deepEqual((await readdir(directory)).filter(name => /^[a-f0-9]{64}\.json$/u.test(name)).sort(),
      storedIds.map(id => id + '.json').sort());
    const id = storedIds[0];
    const route = '/fortune/reports/' + id;
    assert.equal((await call(handler, route + '/facts?expectedOwnerId=' + stranger, 'GET', undefined, headers)).status, 404);
    assert.equal((await call(handler, route + '/facts?expectedOwnerId=' + owner)).status, 403);
    const stored = (await call(handler, route + '/facts?expectedOwnerId=' + owner, 'GET', undefined, headers)).body;
    now += 3_600_000;
    const replay = await call(handler, route + '/replay?expectedOwnerId=' + owner, 'POST', undefined, headers);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.outputHash, stored.outputHash);
    assert.equal((await repository.put({ calculationRunId: id, outputHash: 'different' })).outputHash, stored.outputHash);
    const recordPath = join(directory, id + '.json');
    const record = JSON.parse(await readFile(recordPath, 'utf8'));
    await writeFile(recordPath, JSON.stringify({ ...record, adviceThemes: {} }));
    assert.equal((await call(handler, route + '/replay?expectedOwnerId=' + owner, 'POST', undefined, headers)).status, 409);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('reports calculated before the client migration still read and replay with their original inputs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jovian-fortune-legacy-'));
  try {
    const repository = createFortuneRepository(directory);
    const params = input('day');
    const time = buildFactTimeContext(params, Date.parse('2026-11-06T12:00:00Z'), 'server');
    const reference = { snapshotId, chart: natalChart };
    const configHash = hashFortuneValue({ factLayerVersion, factPolicies, timeZoneDatabaseVersion: process.versions.tz });
    const inputHash = hashFortuneValue({ ownerId: owner, reference, input: params, time, configHash });
    const result = calculateFortuneFacts(params, time, inputHash, reference);
    await repository.put({ ...result, ownerId: owner, input: { ...params, snapshotId }, configHash, inputHash,
      outputHash: hashFortuneValue(result) });
    const handler = createFortuneFactHandler({ repository, loadArchive: () => reference });
    const route = '/fortune/reports/' + inputHash;
    const facts = await call(handler, route + '/facts?expectedOwnerId=' + owner);
    assert.equal(facts.status, 200);
    assert.ok(facts.body.rawFacts.some(fact => Object.hasOwn(fact, 'payload')));
    assert.equal((await call(handler, route + '/replay?expectedOwnerId=' + owner, 'POST')).status, 200);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('account loader passes the session to the account snapshot route', async () => {
  const load = createAccountArchiveLoader('http://127.0.0.1:8787', async (url, options) => {
    assert.equal(url.pathname, '/account/chart-snapshots/' + snapshotId);
    assert.equal(url.searchParams.get('expectedOwnerId'), owner);
    assert.equal(options.headers.get('Authorization'), 'Bearer fixture');
    assert.equal(options.headers.get('X-App-Client'), 'native');
    return Response.json({ status: 'available', archiveId: snapshotId, chartSnapshot: natalChart });
  });
  await assert.rejects(() => load({ ownerId: owner, snapshotId, headers: {} }), { status: 401 });
  assert.equal((await load({ ownerId: owner, snapshotId, headers: { authorization: 'Bearer fixture' } })).chart.version, 1);
});

test('all four periods produce personal interpretation from a real calculation snapshot', () => {
  for (const period of ['day', 'week', 'month', 'year']) {
    const calculation = run(input(period), '2026-11-06T12:00:00Z');
    const result = interpretFortune(calculation, requestForFortuneRun(calculation), 'real-facts-' + period);
    assert.ok(result.topics.length > 0, period);
    const { input: prompt } = buildFortuneModelContext(calculation, result);
    assert.deepEqual(prompt.sections.map(section => section.title), ['综合运势', '财运', '桃花运'], period);
    assert.ok(prompt.facts.length > 0, period);
    if (period === 'week') {
      assert.ok(result.candidates.length && result.candidates.every(item => item.method === 'western'));
      assert.deepEqual(Object.keys(prompt.methods), ['western']);
    }
    validateInterpretation(result, calculation);
  }
});

test('an unknown birth time only contributes a BaZi focus when all chart candidates agree', () => {
  const first = natalChart.bazi.rawResult[0];
  const second = { ...first, utc: '1990-05-05T06:00:00Z', hour: '己未' };
  const chart = { ...natalChart, timeKnown: false, ziwei: undefined, western: undefined,
    bazi: { ...natalChart.bazi, rawResult: [first, second] } };
  const calculation = run(input('day'), '2026-11-06T12:00:00Z', chart);
  const result = interpretFortune(calculation, requestForFortuneRun(calculation), 'unknown-time');
  assert.equal(result.topics.length, 1);
  const focus = result.evidence.find(item => item.evidenceId === result.topics[0].evidenceIds[0]);
  assert.ok(focus.interpretationKey.startsWith('focus.bazi.'));
  assert.ok(focus.sourceFactIds.length >= 2);
  validateInterpretation(result, calculation);

  chart.bazi.rawResult[1] = { ...second, day: first.day[0] === '乙' ? '甲子' : '乙丑' };
  const different = run(input('day'), '2026-11-06T12:00:00Z', chart);
  const fallback = interpretFortune(different, requestForFortuneRun(different), 'conflicting-candidates');
  assert.deepEqual(fallback.topics, []);
  assert.deepEqual(buildFortuneModelContext(different, fallback).input.facts, []);
});
