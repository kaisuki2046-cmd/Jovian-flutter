import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { compileLillyParentDerivedSource, lillyParentDerivedProfile } from './lilly-parent-derived-role.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-parent-role-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-parent-role-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const place = { latitude: 39.9, longitude: 116.4 };
const facts = hour => chartFacts.western(calculateWestern(Date.UTC(2021, 2, 20, hour), place));
const idOf = number => `astro-lilly-v3-merchant-p${number}-001`;
const parentIds = new Set([110, 111, 112, 113].map(idOf));
const query = (confirmedFacts, lillyParentDerivedFigure, options = {}) => ({
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
  confirmedFacts, tradition: 'Christian Astrology', lillyParentDerivedFigure, ...options,
});
const parentHits = parsed => lookupInterpretations(directory, parsed, catalog).filter(row => parentIds.has(row.id));

test('the four p.753 selections match native charts, SQLite, explanations and report materials', () => {
  for (const [hour, sect, parent, planet, number] of [
    [4, 'day', 'father', 'Sun', 110], [16, 'night', 'father', 'Saturn', 111],
    [4, 'day', 'mother', 'Venus', 112], [16, 'night', 'mother', 'Moon', 113],
  ]) {
    const [parsed] = parseChartQueries([query(facts(hour), { birthOrder: 1, parent })]);
    const id = idOf(number);
    const expected = { kind: 'western_lilly_parent_derived_role', sect, parent, planet };
    assert.deepEqual(parentHits(parsed).map(row => row.id), [id]);
    const chart = { ...chartContext('western', parsed.confirmedFacts), lillyParentDerivedFigure: parsed.lillyParentDerivedFigure };
    const detail = explainClaim(id, 'western', chart, parsed.tradition, catalog);
    assert.equal(detail.matched, true);
    assert.ok(detail.matchedConditions.required.some(fact => factText(fact) === factText(expected)));
    assert.match(detail.calculationNote, /753.*位置圈、极高与派生宫头/u);
    const material = buildReportMaterials(lookup([parsed]));
    const row = catalog.get(id);
    assert.equal(row.compiler, lillyParentDerivedProfile);
    assert.ok(material.includes(factText(expected)));
    assert.ok(material.includes(row.claim.evidence.original_text));
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 另版';
    assert.equal(compileLillyParentDerivedSource(changed).reason, 'source_review_required');
  }
});

test('the parent role needs a confirmed first birth and sufficient natal chart evidence', () => {
  const natal = facts(4);
  const input = { birthOrder: 1, parent: 'father' };
  const forged = { kind: 'western_lilly_parent_derived_role', sect: 'day', parent: 'father', planet: 'Sun' };
  for (const [candidate, options] of [
    [query([...natal, forged])],
    [query(natal, { ...input, birthOrder: 2 })],
    [query(natal.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Sun'), input)],
    [query(natal.filter(fact => fact.kind !== 'western_profile_cusp_longitude' || fact.house !== 12), input)],
    [query([...natal, { kind: 'western_sect', sect: 'night' }], input)],
    [query(natal, input, { tradition: 'Tetrabiblos' })],
    [query(natal, input), { timeKnown: false }],
  ]) {
    const [parsed] = parseChartQueries([candidate], options);
    assert.deepEqual(parentHits(parsed), []);
    assert.equal(parsed.confirmedFacts.some(fact => fact.kind === forged.kind), false);
    if (options?.timeKnown === false) assert.equal(parsed.lillyParentDerivedFigure, undefined);
  }
  for (const invalid of [null, { birthOrder: '1', parent: 'father' }, { ...input, parent: 'parent' }, { ...input, extra: true }]) {
    assert.equal(parseChartQueries([query(natal, invalid)]), null);
  }
  assert.equal(parseChartQueries([query(natal, input, { chartScope: 'annual' })]), null);
  assert.equal(parseChartQueries([query([], input, { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion })]), null);
});
