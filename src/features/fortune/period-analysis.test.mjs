import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
import { SunPosition } from 'astronomy-engine';
import { branchRelation, buildPeriodAnalysis } from './control/period-analysis.ts';
import { buildSolarTransits } from './control/solar-transits.ts';

register('data:text/javascript,' + encodeURIComponent(`export function resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/control/fortune-preview.ts') && ['./fortune-calendar', './period-window'].includes(specifier)) {
    return next(specifier + '.ts', context);
  }
  return next(specifier, context);
}`), import.meta.url);

const { buildFortunePreview } = await import('./control/fortune-preview.ts');
const display = { timeZone: 'Asia/Shanghai' };
const instant = Date.parse('2026-11-06T18:00:00+08:00');
const natal = { pillar: '丙子', timeKnown: false };

test('finds evidenced BaZi intervals directly across all four selected windows', () => {
  for (const [period, expectedScale] of [['day', 'day'], ['week', 'day'], ['month', 'month'], ['year', 'year']]) {
    const preview = buildFortunePreview(instant, period, natal, display);
    const analysis = buildPeriodAnalysis(preview, period, natal);
    assert.equal(analysis.scale, expectedScale);
    assert.equal(analysis.intervals[0].start, preview.window.start);
    assert.equal(analysis.intervals.at(-1).end, preview.window.end);
    for (const [index, item] of analysis.intervals.entries()) {
      assert.equal(item.start, index ? analysis.intervals[index - 1].end : preview.window.start);
      assert.ok(item.start < item.end);
      assert.match(item.rule, new RegExp('bazi-' + expectedScale));
    }
    assert.ok(analysis.wealth.every(item => ['正财', '偏财'].includes(item.tenGod)));
    assert.ok(analysis.relationships.every(item => ['六合', '六冲'].includes(item.relationship)));
    if (period === 'week') {
      assert.equal(analysis.intervals.length, 8);
      assert.ok(analysis.wealth.length > 0);
      assert.ok(analysis.intervals.some(item => item.end <= instant));
    }
  }
  assert.equal(buildPeriodAnalysis(buildFortunePreview(instant, 'day', null, display), 'day', null), null);
});

test('keeps 六合 and 六冲 distinct and order independent', () => {
  for (const [kind, pairs] of [
    ['六合', ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未']],
    ['六冲', ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥']],
  ]) {
    for (const [a, b] of pairs) {
      assert.equal(branchRelation(a, b), kind);
      assert.equal(branchRelation(b, a), kind);
    }
  }
  assert.equal(branchRelation('子', '子'), undefined);
});

function western(...longitudes) {
  return {
    engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1',
    rawResult: longitudes.map(longitude => ({ positions: [{ planet: 'Sun', longitude }] })),
  };
}

test('finds both directions of solar aspects over a year, including the zodiac wrap', () => {
  const start = Date.parse('2026-01-01T00:00:00Z');
  const end = Date.parse('2027-01-01T00:00:00Z');
  const result = buildSolarTransits({ start, end }, western(0));
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.events.map(event => event.angle).sort((a, b) => a - b), [0, 60, 60, 90, 90, 120, 120, 180]);
  const equinox = result.events.find(event => event.angle === 0);
  assert.match(new Date(equinox.at).toISOString(), /^2026-03-20T14:/);
  for (const [index, event] of result.events.entries()) {
    const longitude = SunPosition(new Date(event.at)).elon;
    const separation = Math.min(longitude, 360 - longitude);
    assert.ok(Math.abs(separation - event.angle) < 0.000001);
    assert.ok(event.at >= start && event.at < end);
    if (index) assert.ok(event.at > result.events[index - 1].at);
  }
});

test('includes a solar event at the start of a window and excludes the end', () => {
  const edge = Date.parse('2026-03-20T12:00:00Z');
  const chart = western(SunPosition(new Date(edge)).elon);
  assert.deepEqual(buildSolarTransits({ start: edge - 3_600_000, end: edge }, chart).events, []);
  const result = buildSolarTransits({ start: edge, end: edge + 3_600_000 }, chart);
  assert.deepEqual(result.events.map(item => item.at), [edge]);
});

test('does not infer exact solar events from conflicting candidates or another chart engine', () => {
  const window = { start: instant, end: instant + 86_400_000 };
  assert.equal(buildSolarTransits(window).status, 'missing');
  assert.equal(buildSolarTransits(window, western(180, 180.1)).status, 'uncertain');
  assert.equal(buildSolarTransits(window, { ...western(180), engineVersion: 'old' }).status, 'unsupported');
  assert.equal(buildSolarTransits({ start: instant, end: instant }, western(180)).status, 'failed');
});
