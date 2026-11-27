import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createDeepSeekSummary, createSummaryServer } from './summary.mjs';
import { openPassageCatalog } from './knowledge/claims-sqlite.mjs';
import { sourceEntries, validateEntries } from './knowledge/entries.mjs';
import { buildSummaryMaterials } from './prompt-materials.mjs';
import { comparisonRulesVersion } from '../model/comparison.ts';

const { collectEntryEvidence } = await import('./match-evidence.mjs');
const { compareClassicalPlaces, compareWesternDetails } = await import('../control/western-facts.ts');
const { compareCharts } = await import('../control/compare.ts');
const { prepareSynastrySummary } = await import('../control/summary.ts');

const baziId = 1002;
const exchangeId = 1008;
const fourPlacesId = 1010;
const spousePalaceId = 1004;
const bazi = sourceEntries.find(({ id }) => id === baziId);
const baziVersion = 'utc8-jie-local-civil-late-zi-next-v1';
const westernVersion = 'tropical-whole-sign-v1';
const yearMonthHarm = { system: 'bazi', rule: 'branch-harm', direction: 'mutual',
  observation: 'PRIVATE-OBSERVATION', sources: ['PRIVATE-A', 'PRIVATE-B'],
  facts: { aBranch: '子', bBranch: '未', aPosition: 'year', bPosition: 'month' },
  chartRulesets: [baziVersion, baziVersion] };
const request = (facts) => ({ rulesVersion: comparisonRulesVersion, facts });

function withCatalog(run, options) {
  const catalog = openPassageCatalog(':memory:', options);
  try { return run(catalog); } finally { catalog.close(); }
}

function western(sun, moon, ascendant) {
  return { positions: [{ planet: 'Sun', longitude: sun }, { planet: 'Moon', longitude: moon }], ascendant };
}

const compare = (a, b) => compareClassicalPlaces(a, b)
  .map((evidence) => ({ ...evidence, system: 'western', chartRulesets: [westernVersion, westernVersion] }));

async function withRoute(t, options) {
  const server = createSummaryServer(options);
  t.after(() => server.close());
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return (body) => fetch('http://127.0.0.1:' + server.address().port + '/synastry/summary', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('stores every entry with its own text, source, original and formatted conditions and modern interpretation', () => withCatalog((catalog) => {
  assert.equal(catalog.stats().entries, sourceEntries.length);
  assert.ok(catalog.stats().ready > 0);
  for (const entry of sourceEntries) {
    assert.deepEqual(catalog.getClaim(entry.id), entry);
    assert.ok(Number.isSafeInteger(entry.id));
    assert.deepEqual(Object.keys(entry), ['id', 'source', 'category', 'originalText', 'matchConditions', 'modernInterpretation']);
  }
  assert.throws(() => validateEntries([{ ...bazi, matchConditions: { ...bazi.matchConditions, original: [] } }]), /Incomplete/);
  assert.throws(() => validateEntries([{ ...bazi, category: { ...bazi.category, topic: ['family'] } }]), /Incomplete/);
  assert.throws(() => validateEntries([{ ...bazi, priorityScores: {} }]), /Invalid synastry entry fields/);
  assert.throws(() => validateEntries([bazi, { ...bazi, id: 9010 }]), /Duplicate original passage/);
  const scores = catalog.scoring.audit();
  assert.equal(scores.entries.length, sourceEntries.length);
  assert.ok(scores.entries.every(({ scores: axes }) => Object.values(axes).every(Number.isFinite)));
}));

test('retains unresolved source conditions without turning them into executable candidates', () => withCatalog((catalog) => {
  const pending = sourceEntries.filter(({ matchConditions }) => matchConditions.formatted.status === 'unresolved');
  assert.ok(pending.some(({ category }) => category.method === 'ziwei'));
  assert.equal(catalog.stats().unresolved.length, pending.length);
  for (const entry of pending) {
    assert.ok(entry.matchConditions.formatted.required.length);
    assert.deepEqual(catalog.getClaim(entry.id), entry);
    assert.ok(!catalog.programs.some(({ entryId }) => entryId === entry.id));
  }
  const incomplete = { ...pending[0], source: { ...pending[0].source, url: null }, originalText: null, modernInterpretation: null };
  withCatalog((partial) => {
    assert.deepEqual(partial.getClaim(incomplete.id), incomplete);
    assert.deepEqual(partial.candidatePrograms([]), []);
    assert.equal(partial.scoring.audit().entries[0].scores.content, 0);
  }, { entries: [incomplete] });
}));

test('adding unresolved passages leaves executable content scores unchanged', () => {
  const ready = sourceEntries.filter((entry) => entry.matchConditions.formatted.status === 'ready');
  const pending = sourceEntries.find((entry) => entry.matchConditions.formatted.status === 'unresolved');
  const readyScores = (catalog) => catalog.scoring.audit().entries
    .filter(({ status }) => status === 'ready').map(({ id, scores }) => [id, scores.content]);
  const baseline = withCatalog(readyScores, { entries: ready });
  const expanded = withCatalog(readyScores, { entries: [...ready, pending] });
  assert.deepEqual(expanded, baseline);
});

test('Ziwei four-star exclusion requires a complete group from the same natal spouse palace', () => withCatalog((catalog) => {
  const version = 'standard-new-year-leap-split-late-zi-current-v1';
  const sectors = [
    [0, '夫妻', '寅', '同支', '太阳、巨门'],
    [4, '福德', '午', '顺四支三合', '天机'],
    [6, '官禄', '申', '对宫', '太阴'],
    [8, '迁移', '戌', '逆四支三合', '天梁'],
  ].map(([offset, target, targetBranch, relation, targetStars]) => ({
    system: 'ziwei', rule: 'ziwei-natal-sector', direction: 'self_a',
    observation: '本人三方四正', sources: ['A 夫妻', 'A ' + target], chartRulesets: [version, version],
    facts: { person: 'A', source: '夫妻', sourceBranch: '寅', offset, target, targetBranch, relation,
      sourceStars: '太阳、巨门', targetStars },
  }));
  const matched = (facts) => collectEntryEvidence(request(facts), catalog).hits.some(({ id }) => id === 1130);
  const changeTrine = (change) => sectors.map((sector, index) => index === 1
    ? { ...sector, facts: { ...sector.facts, ...change } } : sector);
  assert.equal(matched(sectors), true);
  assert.equal(matched(sectors.slice(0, 3)), false);
  assert.equal(matched(changeTrine({ targetStars: '天机、铃星' })), false);
  assert.equal(matched(changeTrine({ sourceBranch: '丑', targetBranch: '巳' })), false);
  assert.equal(matched(changeTrine({ targetStars: 0 })), false);
}, { entries: sourceEntries.filter(({ id }) => id === 1130) }));

test('matches the traditional year-to-month exception in both orientations and requires a real six-harm pair', () => withCatalog((catalog) => {
  const hits = (fact) => collectEntryEvidence(request([fact]), catalog).hits;
  const originalClaim = (fact) => hits(fact).find(({ id }) => id === baziId);
  assert.equal(originalClaim(yearMonthHarm)?.conditionIndex, 0);
  assert.equal(originalClaim({ ...yearMonthHarm, facts: { ...yearMonthHarm.facts, aPosition: 'month', bPosition: 'year' } })?.conditionIndex, 1);
  assert.equal(originalClaim({ ...yearMonthHarm, facts: { ...yearMonthHarm.facts, bPosition: 'day' } }), undefined);
  assert.deepEqual(hits({ ...yearMonthHarm, facts: { ...yearMonthHarm.facts, bBranch: '午' } }), []);
  const { aPosition, ...partial } = yearMonthHarm.facts;
  assert.deepEqual(hits({ ...yearMonthHarm, facts: partial }), []);
}));

test('requires both exchanged luminary conditions and checks the supplied sign angle against the actual signs', () => withCatalog((catalog) => {
  const facts = compare(western(5, 95, 310), western(36, 65, 313));
  assert.equal(facts.filter(({ rule }) => rule === 'western-luminary-sign-aspect').length, 2);
  const hits = (facts) => collectEntryEvidence(request(facts), catalog).hits;
  assert.equal(hits(facts).find(({ id }) => id === exchangeId).proofs.length, 2);
  assert.ok(!hits(facts.slice(0, 1)).some(({ id }) => id === exchangeId));
  const [first, second] = facts;
  assert.ok(!hits([{ ...first, facts: { ...first.facts, angle: 120 } }, second]).some(({ id }) => id === exchangeId));
}));

test('calculates both Lots of Fortune for the four-place entry and rejects a fabricated same-sign count', () => withCatalog((catalog) => {
  const [fact] = compare(western(5, 100, 310), western(7, 104, 313)).filter(({ rule }) => rule === 'western-four-places-by-sign');
  assert.deepEqual(fact.facts, { aSunSign: 0, bSunSign: 0, aMoonSign: 3, bMoonSign: 3,
    aAscSign: 10, bAscSign: 10, aFortuneSign: 1, bFortuneSign: 1, sameSignCount: 4 });
  const hits = (fact) => collectEntryEvidence(request([fact]), catalog).hits;
  assert.equal(hits(fact)[0].id, fourPlacesId);
  assert.deepEqual(hits({ ...fact, facts: { ...fact.facts, bFortuneSign: 2 } }), []);
  assert.ok(!compare(western(5, 100, NaN), western(7, 104, 313)).some(({ rule }) => rule === fact.rule));
}));

test('assigns a single friendship topic for same-sign ascendants', () => withCatalog((catalog) => {
  const fromAscendants = (a, b) => compare({ positions: [], ascendant: a }, { positions: [], ascendant: b });
  const find = (facts) => collectEntryEvidence(request(facts), catalog).hits
    .find(({ id }) => id === 1013);
  const facts = fromAscendants(0.1, 29.9);
  const result = find(facts);
  assert.equal(result.topic, 'friendship');
  assert.equal(result.proofs[0].direction, 'mutual');
  assert.equal(find(fromAscendants(359.99, 0.01)), undefined);
  assert.equal(find(fromAscendants(0.1, NaN)), undefined);
  const [fact] = facts;
  assert.equal(find([{ ...fact, facts: { ...fact.facts, bLongitude: 30 } }]), undefined);
}));

test('selects the friendship entry only for actual traditional ascendant rulers in the listed aspects', () => withCatalog((catalog) => {
  const pair = (secondLongitude) => compareWesternDetails({ ascendant: 5, positions: [{ planet: 'Mars', longitude: 12 }] },
    { ascendant: 35, positions: [{ planet: 'Venus', longitude: secondLongitude }] }).evidence
    .filter(({ rule }) => rule === 'western-ruler-to-ruler')
    .map((fact) => ({ ...fact, system: 'western', chartRulesets: [westernVersion, westernVersion] }));
  const id = 1011;
  const hasHit = (facts) => collectEntryEvidence(request(facts), catalog).hits.some((entry) => entry.id === id);
  for (const secondLongitude of [14, 71, 133]) assert.ok(hasHit(pair(secondLongitude)));
  assert.ok(!hasHit(pair(102)));
  const [firstHouses] = pair(14).filter(({ facts }) => facts.aHouse === 1 && facts.bHouse === 1);
  assert.ok(!hasHit([{ ...firstHouses, facts: { ...firstHouses.facts, bRuler: 'Jupiter' } }]));
}));

test('matches the cooperation entry for a Mars–Saturn opposition in either chart order', () => withCatalog((catalog) => {
  const fact = { system: 'western', rule: 'western-cross-aspect', direction: 'mutual', observation: '对分相',
    sources: ['A 火星', 'B 土星'], chartRulesets: [westernVersion, westernVersion],
    facts: { aPlanet: 'Mars', bPlanet: 'Saturn', aLongitude: 12, bLongitude: 192,
      degrees: 180, angle: 180, deviation: 0, orb: 6 } };
  const hit = (input) => collectEntryEvidence(request([input]), catalog).hits
    .find(({ id }) => id === 1012);
  assert.equal(hit(fact).topic, 'collaboration');
  assert.equal(hit(fact).conditionIndex, 0);
  assert.equal(hit({ ...fact, facts: { ...fact.facts, aPlanet: 'Saturn', bPlanet: 'Mars' } }).conditionIndex, 1);
  assert.equal(hit({ ...fact, facts: { ...fact.facts, bLongitude: 201 } }), undefined);
}));

test('validates whole-sign placements before selecting family or cooperation interpretations', () => withCatalog((catalog) => {
  const version = { status: 'complete', rulesetVersion: westernVersion, zodiac: 'tropical', houseSystem: 'whole-sign' };
  const a = { mode: 'manual_subject', chart: { bazi: { status: 'unavailable' }, ziwei: { status: 'unavailable' },
    western: { ...version, ascendant: 30, positions: [{ planet: 'Moon', longitude: 90 }, { planet: 'Sun', longitude: 150 }] } } };
  const b = { ...a, chart: { ...a.chart, western: { ...version, ascendant: 0, positions: [] } } };
  const find = (facts) => collectEntryEvidence(request(facts), catalog).hits.filter(({ id }) => id === 2001 || id === 2002);
  const facts = prepareSynastrySummary(compareCharts(a, b)).facts;
  assert.deepEqual(find(facts).map(({ id, topic }) => [id, topic]), [[2001, 'family'], [2002, 'collaboration']]);
  const moon = facts.find(({ rule, facts }) => rule === 'western-whole-sign-overlay' && facts.planet === 'Moon');
  assert.deepEqual(find([{ ...moon, facts: { ...moon.facts, targetAscendant: 30 } }]), []);
}));

test('reversing a Sun–Saturn conjunction preserves its entry ID and reverses the prompt direction', async (t) => {
  const subject = (sun, saturn) => ({ mode: 'manual_subject', chart: {
    bazi: { status: 'unavailable' }, ziwei: { status: 'unavailable' },
    western: { status: 'complete', rulesetVersion: westernVersion,
      positions: [{ planet: 'Sun', longitude: sun }, { planet: 'Saturn', longitude: saturn }] },
  } });
  const first = subject(358, 260);
  const second = subject(100, 1);
  const send = await withRoute(t, { complete: (materials) => ({
    prompt: buildSummaryMaterials(materials),
    ...Object.fromEntries(['family', 'friendship', 'romance', 'collaboration'].map((type) =>
      [type, materials[type].basis.map(({ id, direction }) => ({ id, direction }))])),
  }) });
  const contract = (a, b) => prepareSynastrySummary(compareCharts(a, b));
  const forward = contract(first, second);
  const reverse = contract(second, first);
  for (const [body, direction, label] of [[forward, 'a_to_b', 'A方作用于B方'], [reverse, 'b_to_a', 'B方作用于A方']]) {
    const response = await send(body);
    assert.equal(response.status, 200);
    const { friendship, prompt } = await response.json();
    const original = sourceEntries.find(({ id }) => id === 1001);
    assert.deepEqual(friendship.find(({ id }) => id === original.id), { id: original.id, direction });
    assert.ok(prompt.includes('- ' + label + '｜相处表现\n  现代解读：' + original.modernInterpretation));
    assert.doesNotMatch(prompt, /358|260|aLongitude|Edwin Raphael/u);
  }
  const conjunction = forward.facts.find(({ rule }) => rule === 'western-sun-saturn-contact');
  for (const fabricated of [
    { ...conjunction, direction: 'b_to_a' },
    { ...conjunction, facts: { ...conjunction.facts, aLongitude: 150 } },
  ]) {
    const response = await send(request([fabricated]));
    assert.deepEqual((await response.json()).friendship, []);
  }
});

test('Ziwei checks both stars in the same natal spouse palace using exact star names', () => withCatalog((catalog) => {
  const fact = { system: 'ziwei', rule: 'ziwei-natal-palace', direction: 'self_a', observation: '夫妻宫',
    sources: ['A 夫妻', 'A 本命'], chartRulesets: ['standard-new-year-leap-split-late-zi-current-v1', 'standard-new-year-leap-split-late-zi-current-v1'],
    facts: { person: 'A', palace: '夫妻', branch: '寅', majorStars: '武曲、破军', minorStars: '文昌、禄存',
      adjectiveStars: '', lifePalace: 0, bodyPalace: 0 } };
  const hits = (facts) => collectEntryEvidence(request(facts), catalog).hits.filter(({ id }) => id === spousePalaceId);
  assert.equal(hits([fact])[0].id, spousePalaceId);
  assert.deepEqual(hits([{ ...fact, facts: { ...fact.facts, minorStars: '文昌旁注' } }]), []);
  assert.deepEqual(hits([{ ...fact, facts: { ...fact.facts, minorStars: '' } },
    { ...fact, facts: { ...fact.facts, palace: '命宫' } }]), []);
  const { branch, ...partial } = fact.facts;
  assert.deepEqual(hits([{ ...fact, facts: partial }]), []);
}));

test('the production route sends source materials and keeps raw chart data out of the four-part report prompt', async (t) => {
  const answer = { family: '证据不足', friendship: '证据不足', romance: '示例结果', collaboration: '证据不足' };
  let sent;
  let fail = false;
  const complete = createDeepSeekSummary({ apiKey: 'local-fixture', async transport(_url, { body }) {
    if (fail) return new Response(null, { status: 429 });
    sent = JSON.parse(body);
    return Response.json({ choices: [{ message: { content: JSON.stringify(answer) } }] });
  } });
  const send = await withRoute(t, { complete });
  const rejected = await send({ ...request([]), entryIds: [baziId] });
  assert.equal(rejected.status, 422);
  const response = await send(request([yearMonthHarm, yearMonthHarm]));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), answer);
  assert.equal(Object.hasOwn(sent, 'max_tokens'), false);
  assert.equal(sent.messages[0].role, 'system');
  assert.match(sent.messages[0].content, /先读原文命中条件[^\n]+最终解读以现代解读为准/u);
  assert.match(sent.messages[0].content, /简要说明依据怎样支持结论/u);
  assert.equal(sent.messages[1].role, 'user');
  const material = sent.messages[1].content;
  assert.ok(material.includes('现代解读：' + bazi.modernInterpretation));
  assert.ok(material.includes('原文：' + JSON.stringify(bazi.originalText)));
  assert.ok(material.includes('原文命中条件：' + JSON.stringify(bazi.matchConditions.original)));
  assert.ok(!material.includes(bazi.source.book));
  assert.doesNotMatch(material, /PRIVATE-|bazi-xjbf|aPosition/u);
  const archived = sourceEntries.find(({ source }) => source.locator.endsWith('BAZI:branch-harm:year-month'));
  assert.ok(material.includes(archived.modernInterpretation));
  assert.equal([...material.matchAll(/本类暂无命中解读。/gu)].length, 2);
  const westernFacts = compare(western(5, 95, 310), western(183, 185, 313));
  assert.equal((await send(request(westernFacts))).status, 200);
  assert.match(sent.messages[1].content, /事件倾向\n  现代解读：托勒密在婚姻一节/u);
  const boilerplate = /关系观察线索|其他盘面事实校对|现实是否分开由实际相处情况决定/u;
  for (const { content } of sent.messages) assert.doesNotMatch(content, boilerplate);
  for (const entry of sourceEntries) assert.doesNotMatch(entry.modernInterpretation ?? '', boilerplate);
  fail = true;
  assert.equal((await send(request([yearMonthHarm]))).status, 502);
});

test('the report caps and ranks independent entries after matching', async (t) => {
  const entries = Array.from({ length: 45 }, (_, index) => {
    const entry = structuredClone(bazi);
    const marker = String(index).padStart(2, '0');
    entry.id = 9001 + index;
    entry.source.locator = '测试段落 ' + marker;
    entry.modernInterpretation = '候选词条 ' + marker + '。';
    if (index === 44) entry.matchConditions.formatted.alternatives[0][0].equal.aBranch = '子';
    if (index === 43) entry.source.book = '三命通会';
    if (index === 42) entry.modernInterpretation = '遇到临时改约时，约定回复时间，写下双方均可参加的时段。';
    return entry;
  });
  let selected;
  const send = await withRoute(t, { catalog: { entries }, complete(material) {
    selected = material.romance.basis;
    return {};
  } });
  assert.equal((await send(request([yearMonthHarm]))).status, 200);
  assert.equal(selected.length, 30);
  assert.deepEqual(selected.slice(0, 3).map(({ id }) => id), [9045, 9043, 9044]);
});

test('rebuilds the old cache into a flat index and refreshes revised source records', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'synastry-knowledge-'));
  const path = join(directory, 'knowledge.sqlite');
  t.after(() => {
    rmSync(path, { force: true });
    rmdirSync(directory);
  });
  const old = new DatabaseSync(path);
  old.exec(`CREATE TABLE claim_catalog_meta (id INTEGER, version TEXT, fingerprint TEXT);
    INSERT INTO claim_catalog_meta VALUES(1,'6.0.0','old');
    CREATE TABLE claim_entry (id TEXT PRIMARY KEY);
    INSERT INTO claim_entry VALUES('bazi-xjbf-v36-year-month-harm');
    CREATE TABLE claim_alternative (entry_id TEXT REFERENCES claim_entry(id));
    INSERT INTO claim_alternative VALUES('bazi-xjbf-v36-year-month-harm');
    CREATE TABLE claim_branch (id TEXT);`);
  old.close();
  const first = openPassageCatalog(path);
  assert.equal(first.getClaim(baziId).originalText, bazi.originalText);
  first.close();
  const migrated = new DatabaseSync(path, { readOnly: true });
  try {
    assert.equal(migrated.prepare("SELECT count(*) AS total FROM sqlite_master WHERE name IN ('atoms', 'variants', 'claim_branch', 'claim_application')").get().total, 0);
    assert.equal(migrated.prepare('SELECT count(*) AS total FROM claim_entry').get().total, sourceEntries.length);
    assert.equal(migrated.prepare('SELECT typeof(id) AS type FROM claim_entry LIMIT 1').get().type, 'integer');
    assert.deepEqual(migrated.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { migrated.close(); }
  const updated = sourceEntries.map((entry) => entry.id === baziId ? { ...entry, modernInterpretation: '修订的现代释义。' } : entry);
  const second = openPassageCatalog(path, { entries: updated });
  try { assert.equal(second.getClaim(baziId).modernInterpretation, '修订的现代释义。'); } finally { second.close(); }
});
