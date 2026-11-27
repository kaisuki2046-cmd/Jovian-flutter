import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, rmdirSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { calculateBaZi, calculateWestern, calculateZiwei } from '../../control/charts.ts';
import { birthPlaces, unknownBirthTime } from '../../model/birth-profile.ts';
import { chartKeywords, chartFacts, chartVersions, normalizeFacts } from './catalog.mjs';
import { claimChartContext } from './claims.mjs';
import { buildCatalog, catalogFile, exportCatalog, lookupInterpretations, catalogForDirectory } from './database.mjs';
import { entries } from './entries.mjs';
import { pilotRules } from './rules/pilot.mjs';
import { eventExpansion } from './rules/events.mjs';
import { chartContext, evaluateRule, normalizeRuleInput } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { layers, reportTopics } from './topics.mjs';
register('data:text/javascript,' + encodeURIComponent(`
  export function resolve(specifier, context, next) {
    if (specifier.startsWith('.') &&
      ['/local-reading.ts', '/birth-places.ts', '/requests/report.ts']
        .some((file) => context.parentURL?.endsWith(file))) {
      return next(specifier + '.ts', context);
    }
    return next(specifier, context);
  }
`), import.meta.url);

const { runReading } = await import('../../control/local-reading.ts');
const { buildReportRequest } = await import('../../requests/report.ts');

const combinations = entries.filter(({ id }) => /^review-(?:bazi-(?:stem|mark)-link|ziwei-axis|western-placement)/u.test(id)
  || id === 'review-western-aspect-mercury-venus-conjunction');

function temporaryDirectory(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-dual-layer-'));
  context.after(() => {
    rmSync(join(directory, catalogFile), { force: true });
    rmdirSync(directory);
  });
  return directory;
}

function queryFor(method, confirmedFacts) {
  return { method, rulesetVersion: chartVersions[method].rulesetVersion, confirmedFacts };
}

test('legacy and new rules retain both layers, all topics and exact provenance', (context) => {
  const directory = temporaryDirectory(context);
  const counts = buildCatalog(directory);
  assert.equal(counts.reduce((sum, { records }) => sum + records, 0), 3032 + eventExpansion.length);
  assert.deepEqual(readdirSync(directory), [catalogFile]);
  assert.equal(counts.length, 10);
  assert.equal(new Set(combinations.map(({ entry }) => entry.reading)).size, 2277);
  assert.deepEqual(buildCatalog(directory), counts);

  const rows = new Map(exportCatalog(directory).map((row) => [row.id, row]));
  assert.equal(rows.size, 3032 + eventExpansion.length);
  for (const { id, method, layer, input, entry, reference, source } of entries) {
    const row = rows.get(id);
    assert.equal(row.layer, layer);
    assert.deepEqual(row.keywords, entry.keywords);
    assert.equal(row.topic, entry.topic);
    assert.equal(row.reading, entry.reading);
    assert.equal(row.basis, reference.basis);
    assert.equal(row.limit, reference.limit);
    assert.equal(row.source.passageId, source.passageId);
    assert.ok(['source_passage', 'modern_interpretation'].includes(row.source.basisType));
    assert.ok(row.source.title.trim() && row.source.locator.trim());
    assert.equal(new URL(row.source.url).href, new URL(source.url).href);
    assert.equal(row.source.alternateUrl, source.alternateUrl);
    const query = { ...queryFor(method, [...input.required, ...(input.anyOf?.[0] ?? [])]), confirmedAbsentFacts: input.mustBeAbsent };
    assert.ok(lookupInterpretations(directory, query).some((hit) => hit.id === id), id);
    const incomplete = { ...query, confirmedFacts: query.confirmedFacts.slice(1) };
    assert.ok(!lookupInterpretations(directory, incomplete).some((hit) => hit.id === id), id);
  }
  const db = new DatabaseSync(join(directory, catalogFile), { readOnly: true });
  try {
    assert.equal(Object.values(db.prepare('PRAGMA quick_check').get())[0], 'ok');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

test('the nine sourced Jianlu month and hour combinations can occur in actual BaZi results', () => {
  const jianlu = entries.filter(({ id }) => id.startsWith('review-bazi-jianlu'));
  assert.equal(jianlu.length, 9);
  for (const { id, input } of jianlu) {
    const month = '丑寅卯辰巳午未申酉戌亥子'.indexOf(input.required[0].branch);
    const hour = '子丑寅卯辰巳午未申酉戌亥'.indexOf(input.required[2].ganZhi[1]) * 2;
    const dayOfMonth = Array.from({ length: 12 }, (_, index) => index + 8).find((day) => {
      const wallTime = Date.UTC(2024, month, day, hour);
      const facts = new Set(chartFacts.bazi(calculateBaZi(wallTime - 8 * 3_600_000, wallTime))
        .map((fact) => JSON.stringify(fact)));
      return input.required.every((fact) => facts.has(JSON.stringify(fact)));
    });
    assert.ok(dayOfMonth, 'Unreachable BaZi condition: ' + id);
  }
});

test('a complete BaZi chart verifies Great Nobleman absence from its pillars', () => {
  const wallTime = Date.UTC(1912, 0, 10, 10);
  const facts = chartFacts.bazi(calculateBaZi(wallTime - 8 * 3_600_000, wallTime));
  const nobleman = { kind: 'shen_sha', position: 'day', name: '天乙贵人' };
  const key = JSON.stringify(nobleman);
  assert.ok(!facts.some((fact) => fact.kind === 'shen_sha' && fact.name === '天乙贵人'));
  const complete = claimChartContext('bazi', chartContext('bazi', [...facts, nobleman]));
  assert.ok(complete.absentKeys.has(key));
  assert.ok(!complete.presentKeys.has(key));
  const partial = claimChartContext('bazi', chartContext('bazi', facts.filter(({ kind, position }) =>
    kind !== 'pillar' || position !== 'hour')));
  assert.ok(!partial.absentKeys.has(key));
});

function randomSequence(seed) {
  let state = seed;
  return (limit) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor(state / 0x100000000 * limit);
  };
}

test('every sourced expansion rule has a matching chart from the actual engines', () => {
  const remaining = new Map([...pilotRules, ...eventExpansion]
    .map(({ id, method, input }) => [id, { method, input: normalizeRuleInput(method, input) }]));
  const observe = (method, raw) => {
    const chart = chartContext(method, chartFacts[method](raw));
    for (const [id, rule] of remaining) {
      if (method === rule.method && evaluateRule(rule.input, 'natal', chart).matched) remaining.delete(id);
    }
  };
  const year = 365 * 24 * 3_600_000;
  const dayLength = 24 * 3_600_000;
  const start = Date.UTC(1969, 0, 1);
  for (let date = start; date < start + 36 * year && [...remaining.values()].some(({ method }) => method === 'bazi'); date += dayLength) {
    for (const hour of [0, 2, 4, 6, 12, 14, 18, 22]) {
      const wallTime = date + hour * 3_600_000;
      observe('bazi', calculateBaZi(wallTime - 8 * 3_600_000, wallTime));
    }
  }
  const next = randomSequence(0x20261116);
  for (let index = 0; index < 2400 && remaining.size; index++) {
    if ([...remaining.values()].some(({ method }) => method === 'ziwei')) {
      const date = { year: 1950 + next(75), month: 1 + next(12), day: 1 + next(28) };
      observe('ziwei', calculateZiwei({ date, gender: 'female' }, next(12)));
    }
    if (index < 3 * 365 && [...remaining.values()].some(({ method }) => method === 'western')) {
      observe('western', calculateWestern(start + index * dayLength, { latitude: 0, longitude: 0 }));
    }
  }
  assert.deepEqual([...remaining.keys()], []);
});

function matchObservedFacts(method) {
  const byFact = new Map();
  const remaining = new Set();
  for (const { id, input } of combinations.filter((entry) => entry.method === method)) {
    const [first, ...rest] = normalizeFacts(method, input.required).map((fact) => JSON.stringify(fact));
    if (!byFact.has(first)) byFact.set(first, new Map());
    byFact.get(first).set(id, rest);
    remaining.add(id);
  }
  return {
    remaining,
    observe(facts) {
      const keys = new Set(normalizeFacts(method, facts).map((fact) => JSON.stringify(fact)));
      for (const key of keys) {
        const candidates = byFact.get(key);
        if (!candidates) continue;
        for (const [id, required] of candidates) {
          if (!required.every((fact) => keys.has(fact))) continue;
          candidates.delete(id);
          remaining.delete(id);
        }
        if (!candidates.size) byFact.delete(key);
      }
    },
  };
}

test('all 2,277 new combinations occur in actual output from the three chart engines', () => {
  const bazi = matchObservedFacts('bazi');
  const ziwei = matchObservedFacts('ziwei');
  const western = matchObservedFacts('western');
  const next = randomSequence(0x738a3191);
  for (let index = 0; index < 8000 && (bazi.remaining.size || ziwei.remaining.size); index++) {
    const date = { year: 1925 + next(100), month: 1 + next(12), day: 1 + next(28) };
    const timeIndex = next(12);
    const wallTime = Date.UTC(date.year, date.month - 1, date.day, timeIndex * 2);
    if (bazi.remaining.size) {
      bazi.observe(chartFacts.bazi(calculateBaZi(wallTime - 8 * 3_600_000, wallTime)));
    }
    if (ziwei.remaining.size) {
      const chart = calculateZiwei({ date, gender: index % 2 ? 'male' : 'female' }, timeIndex);
      ziwei.observe(chartFacts.ziwei(chart));
    }
  }
  const seenPlacements = new Set();
  const week = 7 * 24 * 3_600_000;
  // A geocentric sign persists while the local house changes with longitude.
  for (let instant = Date.UTC(1930, 0, 1); instant < Date.UTC(2025, 0, 1) && western.remaining.size; instant += week) {
    const facts = chartFacts.western(calculateWestern(instant, { latitude: 0, longitude: 0 }));
    western.observe(facts);
    const newPlacements = facts.filter(({ kind }) => kind === 'planet_sign')
      .map(({ planet, sign }) => planet + ':' + sign).filter((placement) => !seenPlacements.has(placement));
    if (!newPlacements.length) continue;
    for (const placement of newPlacements) seenPlacements.add(placement);
    for (let longitude = -180; longitude < 180; longitude += 10) {
      western.observe(chartFacts.western(calculateWestern(instant, { latitude: 0, longitude })));
    }
  }
  for (const { remaining } of [bazi, ziwei, western]) assert.deepEqual([...remaining], []);
});

function syntheticProfiles() {
  const next = randomSequence(0x20261111);
  const places = [birthPlaces[0], birthPlaces.at(-1), birthPlaces.at(-2)];
  return Array.from({ length: 168 }, (_, index) => {
    const date = { year: 1940 + next(85), month: 1 + next(12), day: 1 + next(25) };
    const hour = next(24);
    const minute = next(60);
    const time = index < 144 ? { timeKnown: true, hour, minute }
      : index < 156 ? unknownBirthTime
      : index < 162 ? { timeKnown: false, hour, minute: null }
      : { timeKnown: false, hour: null, minute };
    const place = index < 144 && date.month !== 3 && date.month !== 10 && date.month !== 11
      ? places[index % places.length] : places[0];
    return { date, time, place, gender: next(2) ? 'male' : 'female' };
  });
}

test('actual chart requests produce only confirmed matches and track coverage of both layers', async (context) => {
  const directory = temporaryDirectory(context);
  const lookup = createReportLookup(directory);
  const calculationCatalog = catalogForDirectory(directory);
  const calculationFacts = ['western_lilly_aspect', 'western_lilly_partile_aspect', 'western_lilly_aspect_phase',
    'western_lilly_luminary_application', 'western_lilly_reception'].flatMap(kind => calculationCatalog.factsByKind(kind));
  const dignityCells = new Map(), ptolemyCells = new Map();
  const dignityAt = (sign, degree) => {
    const key = sign + '/' + degree;
    if (!dignityCells.has(key)) dignityCells.set(key, calculationCatalog.lillyDignityCells(sign, degree));
    return dignityCells.get(key);
  };
  const ptolemyDignitiesAt = (sign, degree, sect) => {
    const key = sign + '/' + degree + '/' + sect;
    if (!ptolemyCells.has(key)) ptolemyCells.set(key, calculationCatalog.ptolemyFortuneDignities(sign, degree, sect));
    return ptolemyCells.get(key);
  };
  const fortitudes = calculationCatalog.lillyFortitudeRows();
  const topics = Object.entries(reportTopics);
  const stats = Object.fromEntries(layers.map((layer) => [
    layer, Object.fromEntries(topics.map(([id]) => [id, 0])),
  ]));
  const exact = {
    samples: 0, anyEvent: 0, allEvents: 0, allBoth: 0,
    events: Object.fromEntries(topics.map(([id]) => [id, 0])),
  };
  let reports = 0;
  for (const profile of syntheticProfiles()) {
    const reading = await runReading(profile, new AbortController().signal, () => {});
    const request = buildReportRequest(reading);
    const queries = parseChartQueries(request.chartQueries);
    assert.ok(queries);
    if (!queries.length) continue;
    const claimKeywords = new Set(queries.flatMap(({ method, confirmedFacts, chartScope }) =>
      chartKeywords(method, claimChartContext(method, chartContext(method, confirmedFacts, [], chartScope),
        method === 'western' ? calculationFacts : [],
        dignityAt, () => fortitudes, { ptolemyDignitiesAt }).present)));
    const chartFactKeywords = new Set(queries.flatMap(({ method, confirmedFacts }) => chartKeywords(method, confirmedFacts)));
    const picked = lookup(queries);
    assert.deepEqual(picked.map(({ topicId, topic }) => [topicId, topic]), topics);
    const hasHits = picked.some(({ personality, events }) => personality.length || events.length);
    if (profile.time.timeKnown) {
      assert.ok(hasHits);
      exact.samples++;
      exact.anyEvent += Number(picked.some(({ events }) => events.length));
      exact.allEvents += Number(picked.every(({ events }) => events.length));
      exact.allBoth += Number(picked.every(({ personality, events }) => personality.length && events.length));
      for (const { topicId, events } of picked) exact.events[topicId] += Number(events.length > 0);
    }
    reports += Number(hasHits);
    for (const { topicId, ...topic } of picked) {
      for (const layer of layers) {
        stats[layer][topicId] += Number(topic[layer].length > 0);
        for (const hit of topic[layer]) {
          const keywords = hit.claim ? claimKeywords : chartFactKeywords;
          assert.deepEqual(hit.keywords.filter((keyword) => !keywords.has(keyword)), [], hit.id);
          assert.ok(hit.source.locator);
        }
      }
    }
  }
  assert.ok(reports >= 144);
  for (const layer of layers) {
    for (const [topic, count] of Object.entries(stats[layer])) assert.ok(count > 0, layer + '/' + topic);
  }
  assert.ok(exact.events.love > 8 && exact.events.study > 10, 'New event rules should improve both priority themes.');
  context.diagnostic(JSON.stringify({ reports, stats, exact }));
});
