import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { birthPlaces, unknownBirthTime } from '../../model/birth-profile.ts';
import { generateReport, parseInput } from '../report.mjs';
import { claimChartContext, explainClaim, pendingClaimConditions } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup } from './report-lookup.mjs';
import { compileXingjuePalacePatterns, xingjuePalacePatternsProfile } from './xingjue-palace-patterns.mjs';
import { compileXingjueSamePalace, xingjueSamePalaceProfile } from './xingjue-same-palace.mjs';

register('data:text/javascript,' + encodeURIComponent(`
  export function resolve(specifier, context, next) {
    if (specifier.startsWith('.') && ['/local-reading.ts', '/birth-places.ts', '/requests/report.ts']
        .some(file => context.parentURL?.endsWith(file))) {
      return next(specifier + '.ts', context);
    }
    return next(specifier, context);
  }
`), import.meta.url);
const { runReading } = await import('../../control/local-reading.ts');
const { buildReportRequest } = await import('../../requests/report.ts');

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-152-witnesses.json', import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-palace-patterns-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-xingjue-palace-patterns-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const place = birthPlaces.find(({ id }) => id === '1816670');
const daylightId = 'ziwei-v1-xingjue-044-p177-001';
const careerId = 'ziwei-v1-xingjue-044-p1040-001';
const phaseId = 'ziwei-v1-xingjue-048-p1046-001';
const fireId = 'ziwei-v1-xingjue-048-p1048-001';
const flankId = 'ziwei-v1-xingjue-053-p1001-001';
const signature = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const proofKey = (id, signature) => JSON.stringify([id, signature]);

async function request(profile) {
  const signal = new AbortController().signal;
  const reading = await runReading({ ...profile, place }, signal, () => {});
  const parsed = parseInput(buildReportRequest(reading));
  assert.ok(parsed);
  const query = parsed.chartQueries.find(q => q.method === 'ziwei');
  if (profile.time.timeKnown) assert.ok(query);
  return { parsed, query, signal };
}

function sample(id) {
  const row = fixture.witnesses.find(row => row.proofs.some(proof => proof.id === id));
  assert.ok(row, id);
  return row.profile;
}

const chartFor = query => chartContext('ziwei', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (id, query) => explainClaim(id, 'ziwei', chartFor(query), undefined, catalog);
const factsWithout = (query, predicate) => ({
  ...query,
  confirmedFacts: query.confirmedFacts.filter(fact => !predicate(fact)),
});

test('every reviewed Xingjue pattern reaches the model materials through the normal birth report request', async () => {
  const ids = new Set(fixture.witnesses.flatMap(row => row.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  for (const id of ids) {
    const row = catalog.get(id);
    const sameChapter = id === daylightId || id === careerId;
    const compile = sameChapter ? compileXingjueSamePalace : compileXingjuePalacePatterns;
    assert.equal(row.compiler, sameChapter ? xingjueSamePalaceProfile : xingjuePalacePatternsProfile, id);
    const changed = structuredClone(row.claim);
    changed.conditions.original.push('异本');
    assert.equal(compile(changed).reason, 'source_review_required', id);
    for (const input of row.inputs) expected.set(proofKey(id, signature(input)), input);
  }
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const { profile, proofs } of fixture.witnesses) {
    const { parsed, query, signal } = await request(profile);
    const derived = claimChartContext('ziwei', chartFor(query));
    const output = await generateReport(parsed, {
      lookup, signal,
      complete({ references, materials }) {
        const hits = references.flatMap(topic => [...topic.personality, ...topic.events]);
        for (const { id, inputDigest } of proofs) {
          const detail = explain(id, query);
          assert.ok(detail.matched, id);
          assert.match(detail.calculationNote, /紫微星诀/u);
          const key = proofKey(id, inputDigest), input = expected.get(key);
          assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
          const hit = hits.find(reference => reference.id === id);
          assert.ok(hit, id);
          assert.ok(materials.includes(catalog.get(id).claim.evidence.original_text), id);
          seen.add(key);
        }
        return '测试报告';
      },
    });
    assert.equal(output.report, '测试报告');
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('Sunlight at the Thunder Gate uses the real birthplace horizon and requires a confirmed birth time', async () => {
  const profile = sample(daylightId);
  const { query } = await request(profile);
  assert.ok(explain(daylightId, query).matched);
  const { query: nightQuery } = await request(fixture.negative.night.profile);
  assert.ok(nightQuery.confirmedFacts.some(fact => fact.kind === 'natal_daylight' && fact.sect === 'night'));
  assert.ok(nightQuery.confirmedFacts.some(fact => fact.kind === 'palace_star' && fact.palace === '命宫' && fact.star === '太阳'));
  assert.ok(!explain(daylightId, nightQuery).matched);
  const contradictory = structuredClone(query);
  contradictory.confirmedFacts.push({ kind: 'natal_daylight', sect: 'night' });
  assert.ok(!explain(daylightId, contradictory).matched);
  const { query: partial } = await request({ ...profile, time: unknownBirthTime });
  if (partial) assert.ok(!explain(daylightId, partial).matched);
});

test('Pojun must be at the career seat with both named stars', async () => {
  const { query } = await request(sample(careerId));
  assert.ok(explain(careerId, query).matched);
  const missing = factsWithout(query, f => f.kind === 'palace_star' && f.palace === '官禄' && f.star === '铃星');
  assert.ok(!explain(careerId, missing).matched);
});

test('the career womb phase and fire birth are grounded in the natal chart', async () => {
  const { query: phaseQuery } = await request(sample(phaseId));
  assert.ok(explain(phaseId, phaseQuery).matched);
  const missingCycle = factsWithout(phaseQuery, f => f.kind === 'natal_ziwei_life_phase');
  missingCycle.confirmedFacts.push({ kind: 'palace_changsheng_phase', palace: '官禄', phase: '胎' });
  assert.ok(!explain(phaseId, missingCycle).matched);
  const { query: fireQuery } = await request(sample(fireId));
  assert.ok(explain(fireId, fireQuery).matched);
  const missingPillar = factsWithout(fireQuery, f => f.kind === 'natal_year_branch');
  assert.ok(!explain(fireId, missingPillar).matched);
  const missingOpposite = factsWithout(fireQuery, f => f.kind === 'palace_relation' && f.anchor === '命宫' && f.target === '迁移');
  assert.ok(!explain(fireId, missingOpposite).matched);
});

test('the travel pattern reports the verified Chou seat and records the Wei alternative as pending', async () => {
  const id = 'ziwei-v1-xingjue-048-p1050-001';
  const row = catalog.get(id);
  assert.equal(row.remainingAlternatives, 1);
  const pending = pendingClaimConditions({ catalog }).find(row => row.id === id);
  assert.match(pending?.reviewNote, /未位分支仍待核/u);
  assert.equal(row.inputs.length, 1);
  assert.ok(row.inputs[0].required.some(f => f.kind === 'palace_branch' && f.palace === '迁移' && f.branch === '丑'));
  const { query } = await request(sample(id));
  const detail = explain(id, query);
  assert.ok(detail.matched);
  assert.match(detail.calculationNote, /未位分支仍待核/u);
  const withoutNoble = factsWithout(query, f => f.kind === 'palace_star' && f.palace === '迁移'
    && ['天魁', '天钺'].includes(f.star));
  assert.ok(!explain(id, withoutNoble).matched);
});

test('both sides of the natal flank require real transformation carriers', async () => {
  const { query } = await request(sample(flankId));
  assert.ok(explain(flankId, query).matched);
  const noCarrier = factsWithout(query, f => f.kind === 'star_mutagen' && f.change === '禄');
  assert.ok(!explain(flankId, noCarrier).matched);
  const noAdjacent = factsWithout(query, f => f.kind === 'palace_relation' && f.anchor === '命宫' && f.target === '父母');
  assert.ok(!explain(flankId, noAdjacent).matched);
});
