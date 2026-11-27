import assert from 'node:assert/strict';
import { mkdtempSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { chartKeywords, chartVersions } from './catalog.mjs';
import { buildCatalog, catalogFile, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule, normalizeRuleInput } from './matching.mjs';
import { parseChartQueries } from './report-lookup.mjs';

const id = 'alan-leo-1899-sun-capricorn';
const capricorn = { kind: 'planet_sign', planet: 'Sun', sign: '摩羯座' };
const moon = { kind: 'planet_sign', planet: 'Moon', sign: '狮子座' };
const query = { method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: [capricorn] };
const hasRule = (rows) => rows.some((row) => row.id === id);

function temporaryCatalog(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-rule-catalog-'));
  context.after(() => {
    rmSync(join(directory, catalogFile), { force: true });
    rmdirSync(directory);
  });
  buildCatalog(directory);
  return directory;
}

test('rebuilding an old catalog removes status metadata and keeps matching provenance', (context) => {
  const directory = temporaryCatalog(context);
  const db = new DatabaseSync(join(directory, catalogFile));
  try {
    db.exec(`
      ALTER TABLE rule_provenance RENAME TO rule_review;
      ALTER TABLE rule_review ADD COLUMN review_status TEXT NOT NULL DEFAULT 'source_verified';
      ALTER TABLE rule_review ADD COLUMN rights_status TEXT NOT NULL DEFAULT 'research_only';
    `);
    buildCatalog(directory);
    assert.ok(!db.prepare("SELECT name FROM sqlite_schema WHERE name = 'rule_review'").get());
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    const match = lookupInterpretations(directory, query).find((row) => row.id === id);
    assert.equal(match.source.title, 'Astrology for All');
    assert.ok(match.limit);
    assert.deepEqual(lookupInterpretations(directory, { ...query, rulesetVersion: 'unknown' }), []);
  } finally {
    db.close();
  }
});

test('excluded keywords require confirmed absence and reject contradictory facts', (context) => {
  const directory = temporaryCatalog(context);
  const db = new DatabaseSync(join(directory, catalogFile));
  try {
    db.prepare("UPDATE rule_provenance SET input_json = json_set(input_json, '$.mustBeAbsent', json(?)) WHERE id = ?")
      .run(JSON.stringify([moon]), id);
    assert.ok(!hasRule(lookupInterpretations(directory, query)));
    assert.ok(!hasRule(lookupInterpretations(directory, { ...query, confirmedFacts: [capricorn, moon] })));
    const absent = { ...query, confirmedAbsentFacts: [moon] };
    assert.ok(hasRule(lookupInterpretations(directory, absent)));
    assert.throws(() => lookupInterpretations(directory, { ...absent, confirmedFacts: [capricorn, moon] }),
      /both confirmed present and absent/u);
  } finally {
    db.close();
  }
});

test('numeric keywords cannot be supplied as text to match a structured chart field', () => {
  assert.deepEqual(chartKeywords('western', [{ kind: 'planet_house', planet: 'Jupiter', house: 9 }]),
    ['western:planet_house:Jupiter:9']);
  assert.throws(() => chartKeywords('western', [{ kind: 'planet_house', planet: 'Jupiter', house: '9' }]),
    /Invalid fields/u);
});

test('Siku branches require one confirmed month, even when the index keywords are edited', (context) => {
  const directory = temporaryCatalog(context);
  const ruleId = 'pilot-sanming-v8-甲辰-辛未-辰戌丑未';
  const baseFacts = [
    { kind: 'pillar', position: 'day', ganZhi: '甲辰' },
    { kind: 'pillar', position: 'hour', ganZhi: '辛未' },
  ];
  const db = new DatabaseSync(join(directory, catalogFile));
  try {
    db.prepare('UPDATE event_rule SET keywords = ? WHERE id = ?').run('["故意修改的索引词"]', ruleId);
  } finally {
    db.close();
  }
  const match = (branch) => lookupInterpretations(directory, {
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion,
    confirmedFacts: [...baseFacts, { kind: 'branch', position: 'month', branch }],
  }).find((row) => row.id === ruleId);
  assert.equal(match('戌').matchedConditions.alternatives[0][0].branch, '戌');
  assert.equal(match('丑').id, ruleId);
  assert.equal(match('卯'), undefined);
});

test('Ziwei relations require the same scope and confirmed palace distance', () => {
  const first = { kind: 'palace_star', palace: '命宫', star: '紫微', scope: 'origin' };
  const second = { kind: 'palace_star', palace: '迁移', star: '破军', scope: 'origin' };
  const input = normalizeRuleInput('ziwei', { required: [first], relations: [{ type: 'opposite_palace', first, second }] });
  const matches = (branch) => evaluateRule(input, 'natal', chartContext('ziwei', [
    first, second, { kind: 'palace_branch', palace: '命宫', branch: '子' },
    { kind: 'palace_branch', palace: '迁移', branch },
  ]));
  assert.ok(matches('午').matched);
  assert.equal(matches('未').reason, 'relations');
  assert.throws(() => chartContext('ziwei', [first, { ...second, scope: 'yearly' }]), /scope conflicts/u);
  assert.equal(evaluateRule(input, 'annual', chartContext('ziwei', [first])).reason, 'scope');
});

test('orb thresholds include the boundary and require an actual measurement', () => {
  const aspect = { kind: 'aspect', first: 'Venus', second: 'Mars', aspect: '四分' };
  const fact = { ...aspect, kind: 'aspect_orb' };
  const input = normalizeRuleInput('western', { required: [aspect], thresholds: [{ fact, min: 0, max: 3 }] });
  const run = (facts) => evaluateRule(input, 'natal', chartContext('western', facts));
  assert.ok(run([aspect, { ...fact, orb: 3 }]).matched);
  assert.equal(run([aspect, { ...fact, orb: 3.01 }]).reason, 'thresholds');
  assert.equal(run([aspect]).reason, 'thresholds');
});

test('incomplete birth times admit confirmed Western signs and omit house facts', () => {
  const house = { kind: 'planet_house', planet: 'Sun', house: 2 };
  const supplied = { ...query, confirmedFacts: [capricorn, house] };
  assert.deepEqual(parseChartQueries([supplied], { timeKnown: false })[0].confirmedFacts, [capricorn]);
  assert.deepEqual(parseChartQueries([supplied], { timeKnown: true })[0].confirmedFacts, [capricorn, house]);
});
