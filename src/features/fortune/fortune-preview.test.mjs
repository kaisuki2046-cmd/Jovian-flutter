import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';

register('data:text/javascript,' + encodeURIComponent(`export function resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/control/fortune-preview.ts') && ['./fortune-calendar', './period-window'].includes(specifier)
      || context.parentURL?.endsWith('/control/almanac.ts') && specifier === './fortune-calendar') {
    return next(specifier + '.ts', context);
  }
  return next(specifier, context);
}`), import.meta.url);

const { buildDisplayWindow, buildFortunePreview, readNatalDay } = await import('./control/fortune-preview.ts');
const { createFortuneTimeHandler } = await import('./server/index.mjs');
const { buildAlmanacDay } = await import('./control/almanac.ts');
process.env.TZ = 'Asia/Shanghai';

test('builds complete day, week, month, and year windows from the same device instant', () => {
  const instant = Date.parse('2026-11-11T14:45:00+08:00');
  const expected = {
    day: ['2026-11-11', '2026-11-12'],
    week: ['2026-11-09', '2026-11-16'],
    month: ['2026-11-01', '2026-12-01'],
    year: ['2026-01-01', '2027-01-01'],
  };
  for (const [period, [start, end]] of Object.entries(expected)) {
    assert.deepEqual(buildDisplayWindow(instant, period), {
      start: Date.parse(start + 'T00:00:00+08:00'), end: Date.parse(end + 'T00:00:00+08:00'),
    });
  }
});

test('computes the week directly across a Jie boundary and late Zi transitions', () => {
  const input = Date.parse('2026-11-07T18:00:00+08:00');
  const preview = buildFortunePreview(input, 'week');
  const boundary = preview.events.find(({ reason }) => reason === '立冬交节');
  assert.ok(boundary);
  assert.equal(boundary.month, '己亥');
  assert.equal(preview.events[0].month, '戊戌');
  assert.equal(preview.events.filter(({ reason }) => reason === '换日').length, 7);
  assert.ok(preview.events.every(({ at }) => at >= preview.window.start && at < preview.window.end));
});

test('uses the confirmed archived natal day stem, including records with unknown birth time', () => {
  const report = { timeKnown: false, charts: [{ method: 'bazi', rows: [{ label: '日柱', value: '丁丑\n天干十神 日主' }] }] };
  const natal = readNatalDay(report);
  assert.deepEqual(natal, { pillar: '丁丑', timeKnown: false });
  const input = Date.parse('2026-11-11T14:45:00+08:00');
  assert.equal(buildFortunePreview(input, 'day', natal).current.tenGod, '食神');
  assert.equal(buildFortunePreview(input, 'day').current.tenGod, undefined);
  report.charts[0].rows[0].value = '随时刻变化';
  assert.equal(readNatalDay(report), null);
});

test('uses local civil boundaries across a daylight-saving transition', () => {
  process.env.TZ = 'America/New_York';
  try {
    const instant = Date.parse('2026-03-08T16:00:00Z');
    const window = buildDisplayWindow(instant, 'day');
    assert.equal(new Date(window.start).toISOString(), '2026-03-08T05:00:00.000Z');
    assert.equal(new Date(window.end).toISOString(), '2026-03-09T04:00:00.000Z');
  } finally { process.env.TZ = 'Asia/Shanghai'; }
});

test('uses the requested IANA zone independently of machine TZ for every period', () => {
  const instant = Date.parse('2027-01-01T00:30:00Z');
  const display = { timeZone: 'America/New_York' };
  const expected = {
    day: ['2026-12-31', '2027-01-01'],
    week: ['2026-12-28', '2027-01-04'],
    month: ['2026-12-01', '2027-01-01'],
    year: ['2026-01-01', '2027-01-01'],
  };
  for (const [period, [start, end]] of Object.entries(expected)) {
    assert.deepEqual(buildDisplayWindow(instant, period, display), {
      start: Date.parse(start + 'T05:00:00Z'), end: Date.parse(end + 'T05:00:00Z'),
    });
  }
  assert.equal(buildDisplayWindow(instant, 'week', { ...display, weekStartsOn: 0 }).start,
    Date.parse('2026-12-27T05:00:00Z'));
  assert.throws(() => buildDisplayWindow(instant, 'day', { timeZone: 'Invalid/Place' }), RangeError);
  assert.throws(() => buildDisplayWindow(instant, 'day', { timeZone: '+08:00' }), RangeError);
  assert.throws(() => buildDisplayWindow(instant, 'week', { ...display, weekStartsOn: 7 }), RangeError);
});

test('honors fall-back, midnight gaps, and skipped local dates', () => {
  for (const [instant, timeZone, start, end] of [
    ['2026-11-01T12:00:00Z', 'America/New_York', '2026-11-01T04:00:00Z', '2026-11-02T05:00:00Z'],
    ['2026-11-01T12:00:00Z', 'America/Havana', '2026-11-01T04:00:00Z', '2026-11-02T05:00:00Z'],
    ['2026-03-08T12:00:00Z', 'America/Havana', '2026-03-08T05:00:00Z', '2026-03-09T04:00:00Z'],
    ['2011-12-29T20:00:00Z', 'Pacific/Apia', '2011-12-29T10:00:00Z', '2011-12-30T10:00:00Z'],
  ]) {
    assert.deepEqual(buildDisplayWindow(Date.parse(instant), 'day', { timeZone }), {
      start: Date.parse(start), end: Date.parse(end),
    }, timeZone + ' ' + instant);
  }
});

test('general almanac follows the Beijing civil date independently of the personal display zone', () => {
  const instant = Date.parse('2026-11-11T16:00:00Z');
  const day = buildAlmanacDay(instant);
  assert.equal(day.date, '2026-11-12');
  assert.equal(day.timeZone, 'Asia/Shanghai');
  assert.equal(day.source, 'lunar-javascript@1.7.8');
  assert.match(day.dayPillar, /^..$/u);
  assert.ok(day.yi.length > 0);
  assert.ok(day.ji.length > 0);
  assert.ok(![...day.yi, ...day.ji].includes('无'));
  assert.deepEqual(buildAlmanacDay(instant + 60 * 60_000), day);
  assert.equal(buildAlmanacDay(instant - 1000).date, '2026-11-11');
});

test('uses consistent natal candidates ahead of the archive summary and rejects ambiguous candidates', () => {
  const report = {
    timeKnown: true,
    charts: [{ method: 'bazi', rows: [{ label: '日柱', value: '丁丑' }] }],
    chartSnapshot: { timeKnown: false, bazi: { rawResult: [{ day: '甲子' }, { day: '甲子' }] } },
  };
  assert.deepEqual(readNatalDay(report), { pillar: '甲子', timeKnown: false });
  report.chartSnapshot.bazi.rawResult[1].day = '丁丑';
  assert.equal(readNatalDay(report), null);
  report.chartSnapshot.bazi.rawResult = [null];
  assert.equal(readNatalDay(report), null);
  report.chartSnapshot.bazi.rawResult = [];
  assert.deepEqual(readNatalDay(report), { pillar: '丁丑', timeKnown: true });
});

test('returns uncached UTC time from the server and restricts the route and web origin', () => {
  const now = Date.parse('2026-11-12T04:30:15.123Z');
  const origin = 'http://localhost:18083';
  const handle = createFortuneTimeHandler({ now: () => now, webOrigin: origin });

  function request(url, method = 'GET', requestOrigin = origin) {
    const headers = {};
    const result = { headers };
    handle({ url, method, headers: { origin: requestOrigin } }, {
      setHeader(name, value) { headers[name] = value; },
      writeHead(status, moreHeaders) {
        result.status = status;
        Object.assign(headers, moreHeaders);
        return this;
      },
      end(body) { result.body = body; },
    });
    return result;
  }

  const ok = request('/fortune/time');
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['Cache-Control'], 'no-store');
  assert.equal(ok.headers['Access-Control-Allow-Origin'], origin);
  assert.deepEqual(JSON.parse(ok.body), { asOfUtc: new Date(now).toISOString() });
  assert.equal(request('/fortune/time', 'POST').status, 405);
  assert.equal(request('/fortune/time?asOfUtc=2000-01-01').status, 404);
  assert.equal(request('/fortune/time', 'GET', 'https://example.com').status, 403);
});
