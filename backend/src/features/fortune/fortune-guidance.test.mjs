import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
import { Body, Ecliptic, GeoVector, SearchMoonPhase, SunPosition } from 'astronomy-engine';
import { astro } from 'iztro';
import { Solar } from 'lunar-javascript';

register('data:text/javascript,' + encodeURIComponent(`export function resolve(specifier, context, next) {
  const supported = ['./fortune-calendar', './fortune-preview', './period-window', './solar-transits'];
  return next(context.parentURL?.endsWith('.ts') && supported.includes(specifier) ? specifier + '.ts' : specifier, context);
}`), import.meta.url);

const { buildFortunePreview } = await import('./control/fortune-preview.ts');
const { buildPeriodAnalysis } = await import('./control/period-analysis.ts');
const { buildZiweiFlows, readZiweiCalculation } = await import('./control/ziwei-flows.ts');
const { buildPlanetaryTransits, buildWesternCalculation, planetLabels } = await import('./control/solar-transits.ts');
const { buildFortuneGuidance, rankFortuneTopics } = await import('./control/fortune-guidance.ts');
const { buildBaZiCalculation, baziInteractions } = await import('./control/bazi-calculation.ts');
const { lunarAtBeijing } = await import('./control/fortune-calendar.ts');

const instant = Date.parse('2026-11-06T18:00:00+08:00');
const hour = 3_600_000;
const zone = { timeZone: 'Asia/Shanghai' };
const natal = { pillar: '丙子', timeKnown: true };
const options = {
  dateStr: '1990-05-05', timeIndex: 6, gender: '女', fixLeap: true, language: 'zh-CN',
  config: { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current', algorithm: 'default' },
};
const westernTemplate = { engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1' };

const astrolabe = astro.withOptions(options);
const archived = JSON.parse(JSON.stringify(astrolabe.toJSON()));
const snapshot = {
  timeKnown: true, ziwei: {
    engineName: 'iztro', engineVersion: '2.6.5', rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1',
    rawResult: [archived],
  },
};

function longitude(planet, at) {
  const time = new Date(at);
  return planet === 'Sun' ? SunPosition(time).elon : Ecliptic(GeoVector(Body[planet], time, true)).elon;
}

test('reuses serialized Ziwei palaces in all four windows and restores library context', () => {
  const before = JSON.stringify(snapshot);
  const config = astro.getConfig();
  const language = astro.getLanguage();
  astro.config({ horoscopeDivide: 'exact', language: 'en-US' });
  try {
    for (const [period, scale] of [['day', 'daily'], ['week', 'daily'], ['month', 'monthly'], ['year', 'yearly']]) {
      const { window } = buildFortunePreview(instant, period, natal, zone);
      const result = buildZiweiFlows(window, period, snapshot);
      assert.equal(result.status, 'ready');
      assert.equal(result.scale, scale);
      assert.equal(result.intervals[0].start, window.start);
      assert.equal(result.intervals.at(-1).end, window.end);
      for (const [index, item] of result.intervals.entries()) {
        assert.equal(item.start, result.intervals[index - 1]?.end ?? window.start);
        const date = new Date(item.start + 8 * hour).toISOString().slice(0, 10);
        const engine = astrolabe.horoscope(date, 6);
        assert.equal(item.flow.palace, archived.palaces[engine[scale].index].name);
        assert.deepEqual(item.flow.transformations, engine[scale].mutagen);
        assert.equal(item.decadal.palace, archived.palaces[engine.decadal.index].name);
      }
      if (period === 'year') {
        const boundary = Date.parse('2026-02-17T00:00:00+08:00');
        assert.deepEqual(result.intervals.map(item => item.start), [window.start, boundary]);
        assert.equal(result.intervals[0].end, boundary);
      }
    }
    assert.equal(JSON.stringify(snapshot), before);
    assert.equal(astro.getConfig().horoscopeDivide, 'exact');
    assert.equal(astro.getLanguage(), 'en-US');
  } finally {
    astro.config(config);
    astro.setLanguage(language);
  }
});

test('clips Ziwei days to display windows and rejects uncertain or mismatched snapshots', () => {
  const midnight = Date.parse('2026-11-07T00:00:00+08:00');
  const window = { start: midnight - 3 * hour, end: midnight + 4 * hour };
  const result = buildZiweiFlows(window, 'day', snapshot);
  assert.deepEqual(result.intervals.map(({ start, end }) => [start, end]), [
    [window.start, midnight], [midnight, window.end],
  ]);
  assert.equal(buildZiweiFlows(window, 'day').status, 'missing');
  assert.equal(buildZiweiFlows(window, 'day', { ...snapshot, timeKnown: false }).status, 'uncertain');
  assert.equal(buildZiweiFlows(window, 'day', {
    ...snapshot, ziwei: { ...snapshot.ziwei, engineVersion: 'old' },
  }).status, 'unsupported');
});

test('computes real Moon and retrograde Venus contacts while isolating unstable natal bodies', () => {
  const at = Date.parse('2026-10-25T12:13:25.000Z');
  const positions = ['Moon', 'Venus'].map(planet => ({ planet, longitude: longitude(planet, at) }));
  const western = { ...westernTemplate, rawResult: [
    { positions: [...positions, { planet: 'Mars', longitude: 0 }] },
    { positions: [...positions, { planet: 'Mars', longitude: 0.1 }] },
  ] };
  const result = buildPlanetaryTransits({ start: at, end: at + 10 * hour }, western);
  assert.deepEqual(result.events.map(item => [item.planet, item.at, item.direction]), [
    ['Moon', at, 'direct'], ['Venus', at, 'retrograde'],
  ]);
  assert.equal(result.bodies.find(item => item.planet === 'Mars').status, 'uncertain');
  assert.equal(buildPlanetaryTransits({ start: at - 10 * hour, end: at }, western).events.length, 0);
});

test('retains both crossings near a Venus station', () => {
  const at = Date.parse('2026-10-03T04:00:00Z');
  const western = { ...westernTemplate, rawResult: [{ positions: [{ planet: 'Venus', longitude: longitude('Venus', at) }] }] };
  const result = buildPlanetaryTransits({ start: at - 6 * hour, end: at + 36 * hour }, western);
  assert.deepEqual(result.events.map(item => item.direction), ['direct', 'retrograde']);
  assert.equal(result.events[0].at, at);
  assert.ok(Math.abs(result.events[1].transitLongitude - result.events[1].natalLongitude) < 1e-8);
});

test('ranks evidence by distinct methods and keeps opposing signals traceable', () => {
  const evidence = (sourceId, method, tone, topic = 'relationships') => ({
    sourceId, method, tone, topic, ruleId: 'fixture-v1', start: instant, fact: sourceId,
  });
  const ranking = rankFortuneTopics([
    evidence('same-system-older', 'bazi', 'support', 'finance'),
    evidence('same-system-newer', 'bazi', 'support', 'finance'),
    evidence('a', 'bazi', 'support'), evidence('b', 'western', 'caution'),
  ]);
  assert.deepEqual(ranking.map(item => [item.topic, item.methods.length]), [['relationships', 2], ['finance', 1]]);
  assert.equal(ranking[0].tone, 'mixed');
  assert.deepEqual(ranking[0].evidence.map(item => item.sourceId), ['a', 'b']);
});

test('feeds the three real adapters into ranking and bases every recommendation on live or upcoming evidence', () => {
  const report = buildFortunePreview(instant, 'week', natal, zone);
  const positions = Object.keys(planetLabels).map(planet => ({ planet, longitude: longitude(planet, instant + hour) }));
  const bazi = buildPeriodAnalysis(report, 'week', natal);
  const ziwei = buildZiweiFlows(report.window, 'week', snapshot);
  const western = buildPlanetaryTransits(report.window, { ...westernTemplate, rawResult: [{ positions }] });
  assert.ok(western.bodies.every(item => item.status === 'ready'));
  assert.equal(western.events.filter(item => item.angle === 0 && Math.abs(item.at - (instant + hour)) <= 1).length, 10);
  const result = buildFortuneGuidance(instant, bazi, ziwei, western);
  assert.deepEqual(new Set(result.ranked.flatMap(item => item.methods)), new Set(['bazi', 'ziwei', 'western']));
  assert.equal(result.ranked.find(item => item.topic === 'relationships').methods.length, 3);
  assert.ok(result.advice.length > 0);
  for (const recommendation of result.advice) {
    assert.deepEqual(recommendation.items.map(item => item.kind), ['yi', 'ji', 'habit']);
    assert.ok(recommendation.items.every(item => item.ruleId.includes(recommendation.topic)));
    assert.ok(recommendation.evidence.every(item =>
      item.sourceId && item.ruleId && (item.end ? item.end > instant : item.start >= instant)));
  }
  assert.equal(buildFortuneGuidance(report.window.end, bazi, ziwei, western).advice.length, 0);
  const baziOnly = buildFortuneGuidance(instant, bazi, { status: 'missing' }, { status: 'missing' });
  assert.ok(baziOnly.ranked.length > 0);
  assert.ok(baziOnly.ranked.every(item => item.methods.length === 1 && item.methods.includes('bazi')));
  const empty = buildFortuneGuidance(instant, null, { status: 'missing' }, { status: 'unsupported' });
  assert.deepEqual([empty.ranked, empty.advice], [[], []]);
});

test('calculates all four BaZi timelines down to the active late-Zi hour and preserves candidate-specific outputs', () => {
  const clock = Solar.fromYmdHms(1990, 5, 5, 12, 0, 0).getLunar();
  const utc = '1990-05-05T04:00:00.000Z';
  const raw = {
    utc, year: clock.getYearInGanZhiExact(), month: clock.getMonthInGanZhiExact(),
    day: clock.getDayInGanZhiExact(), hour: clock.getTimeInGanZhi(), tenGods: {}, shenSha: {},
  };
  const archivedBazi = {
    bazi: { engineName: 'lunar-javascript', engineVersion: '1.7.8', rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1',
      rawResult: [raw, { ...raw, hour: '甲子' }] },
  };
  const lateZi = Date.parse('2026-11-06T23:00:00+08:00');
  const window = { start: lateZi - hour, end: lateZi + 5 * hour };
  const result = buildBaZiCalculation(window, lateZi, archivedBazi);
  assert.equal(result.stableNatal.hour, undefined);
  assert.equal(result.stableNatal.day, raw.day);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.timelines.day[1].start, lateZi);
  for (const item of result.timelines.hour) {
    assert.equal(item.pillar, lunarAtBeijing(item.start).getTimeInGanZhi());
  }
  for (const data of Object.values(result.timelines)) {
    assert.equal(data[0].start, window.start);
    assert.equal(data.at(-1).end, window.end);
    data.slice(1).forEach((item, index) => assert.equal(item.start, data[index].end));
  }
  const exact = result.current.layers.hour;
  assert.ok(exact.naYin && exact.xun && exact.voidBranches && exact.phase);
  assert.ok(exact.hiddenStems.every(item => item.tenGod && item.element));
  assert.ok(exact.shenSha.every(item => item.sources.length > 0));
  assert.equal(result.pillarReference.length, 60);
  assert.equal(result.pillarReference.find(item => item.pillar === exact.pillar).byDayMaster[0].phase, exact.phase);
  assert.equal(result.candidates[0].natal, raw);
  assert.deepEqual(new Set(result.candidates[0].directions.map(item => item.direction)), new Set(['forward', 'backward']));
  for (const route of result.candidates[0].directions) {
    const fromEngine = clock.getEightChar().getYun(route.genderBasis === '男' ? 1 : 0, 2);
    assert.equal(route.start, Date.parse(fromEngine.getStartSolar().toYmdHms().replace(' ', 'T') + '+08:00'));
    assert.equal(route.stages[1].pillar.pillar, fromEngine.getDaYun(2)[1].getGanZhi());
    assert.equal(route.stages[1].years[0].minor, fromEngine.getDaYun(2)[1].getXiaoYun()[0].getGanZhi());
    assert.ok(route.stages.slice(1).every(stage => stage.years.every(year => year.months.length === 12)));
  }
  assert.equal(buildBaZiCalculation(window, lateZi, undefined, { pillar: raw.day }).natalStatus, 'legacy-day');
  assert.equal(buildBaZiCalculation(window, lateZi).current.layers.hour.tenGod, undefined);
});

test('retains simultaneous BaZi relationships and identifies all members of three-branch patterns', () => {
  const result = baziInteractions([
    { id: 'a', pillar: '甲子' }, { id: 'b', pillar: '戊申' }, { id: 'c', pillar: '戊辰' },
    { id: 'd', pillar: '己丑' }, { id: 'e', pillar: '甲寅' }, { id: 'f', pillar: '己亥' },
  ]);
  assert.ok(result.pairs.some(item => item.kind === '天干五合' && item.members.join() === 'a,d'));
  assert.ok(result.pairs.some(item => item.kind === '六合' && item.members.join() === 'a,d'));
  assert.ok(result.pairs.some(item => item.kind === '六破' && item.members.join() === 'e,f'));
  assert.deepEqual(result.groups.find(item => item.kind === '三合').byBranch, [['b'], ['a'], ['c']]);
  assert.ok(result.elemental.some(item => item.part === 'stem' && item.from === 'a' && item.to === 'b'
    && item.kind === '前克后'));
});

test('restores every Ziwei scope with palace overlays, natal transformations and leap-month subdivisions', () => {
  const other = astro.withOptions({ ...options, timeIndex: 7 }).toJSON();
  const uncertain = { ...snapshot, timeKnown: false, ziwei: { ...snapshot.ziwei, rawResult: [archived, other] } };
  const late = Date.parse('2025-08-06T23:15:00+08:00');
  const result = readZiweiCalculation(late, uncertain);
  assert.equal(result.status, 'ready');
  assert.equal(result.timeIndex, 12);
  assert.equal(result.candidates.length, 2);
  const available = result.candidates[0];
  assert.equal(available.status, 'ready');
  const engine = astrolabe.horoscope('2025-08-06', 12);
  for (const [key, scope] of Object.entries(available.scopes)) {
    assert.equal(scope.index, engine[key].index);
    assert.deepEqual(scope.palaceNames, engine[key].palaceNames);
    assert.deepEqual(scope.mutagen, engine[key].mutagen);
    assert.equal(scope.palaces.length, 12);
    assert.ok(scope.transformations.every(item => item.kind && item.star));
  }
  assert.deepEqual(available.scopes.yearly.yearlyDecStar, engine.yearly.yearlyDecStar);
  assert.equal(available.decades.length, 12);
  assert.deepEqual(available.yearMonths.filter(item => item.isLeapMonth).map(item => item.part), ['first', 'second']);
  assert.equal(readZiweiCalculation(late + hour, uncertain).date, '2025-08-07');
  assert.doesNotMatch(JSON.stringify(result), /"astrolabe"/u);
});

test('builds cross-body, axis and current house geometry from stable or explicitly selected natal candidates', () => {
  const at = Date.parse('2026-10-25T12:13:25.000Z');
  const window = { start: at - 8 * hour, end: at + 9 * hour };
  const sun = longitude('Sun', at);
  const moon = longitude('Moon', at);
  const first = { ascendant: sun, midheaven: moon, positions: [{ planet: 'Venus', longitude: moon }] };
  const second = { ...first, ascendant: (sun + 90) % 360 };
  const chart = { ...westernTemplate, rawResult: [first, second] };
  const stable = buildWesternCalculation(window, at, chart, undefined, { anglesReliable: true });
  assert.equal(stable.sky.length, 10);
  assert.ok(stable.sky.every(item => item.distanceAu > 0 && Number.isFinite(item.longitudeSpeedDegPerDay)));
  assert.equal(stable.sky.find(item => item.planet === 'Venus').direction, 'retrograde');
  assert.equal(stable.timelineTargets.some(item => item.id === 'ASC' || item.id === 'DSC'), false);
  assert.ok(stable.timelineTargets.some(item => item.id === 'MC'));
  assert.ok(stable.candidates[0].transits.find(item => item.planet === 'Sun').house === 1);
  const crossed = stable.natalContacts.find(item => item.planet === 'Moon' && item.target === 'Venus');
  const conjunction = crossed.aspects.find(item => item.angle === 0);
  assert.ok(conjunction.exact.some(item => Math.abs(item.at - at) <= 1));
  assert.ok(conjunction.orbWindows.some(item => item.start <= at && at < item.end));
  assert.ok(stable.skyAspects.length > 0);
  const selected = buildWesternCalculation(window, at, chart, 0, { anglesReliable: true });
  assert.ok(selected.natalContacts.some(item => item.planet === 'Sun' && item.target === 'ASC'));
  assert.throws(() => buildWesternCalculation(window, at, chart, 99), RangeError);
  const skyOnly = buildWesternCalculation(window, at);
  assert.equal(skyOnly.natalContacts.length, 0);
  assert.equal(skyOnly.natalStatus, 'missing');
  assert.deepEqual(skyOnly.sky, stable.sky);
});

test('uses the four selected windows for complete timelines, lunar phases and whole-sign ingresses', () => {
  const start = Date.parse('2026-01-01T00:00:00+08:00');
  const chart = { ...westernTemplate, rawResult: [{ ascendant: 92, positions: [] }] };
  for (const period of ['day', 'week', 'month', 'year']) {
    const { window } = buildFortunePreview(start, period, null, zone);
    const bazi = buildBaZiCalculation(window, start);
    for (const intervals of Object.values(bazi.timelines)) {
      assert.equal(intervals[0].start, window.start);
      assert.equal(intervals.at(-1).end, window.end);
    }
    const western = buildWesternCalculation(window, start, chart);
    assert.ok(western.moon.phases.every(item => window.start <= item.at && item.at < window.end));
    if (period !== 'year') continue;
    assert.equal(bazi.timelines.month.length, 13);
    assert.equal(western.motion.find(item => item.planet === 'Sun').ingresses.length, 12);
    const sun = western.candidates[0].transits.find(item => item.planet === 'Sun');
    assert.equal(new Set(sun.houseIngresses.map(item => item.house)).size, 12);
    const firstNewMoon = western.moon.phases.find(item => item.angle === 0);
    const engineNewMoon = SearchMoonPhase(0, new Date(window.start), 35);
    assert.ok(Math.abs(firstNewMoon.at - engineNewMoon.date.getTime()) < 1_000);
  }
});
