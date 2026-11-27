import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Body, Ecliptic, GeoVector, MakeTime, RotateVector, Rotation_EQD_ECT, SunPosition, Vector } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit } from './control/fortune-prompt.mjs';
const { linkMcTenthIntervals, scanCircularRegions, zodiacalHouse } = await import('./control/western-houses.ts');
const { readTransitLongitude } = await import('./control/solar-transits.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { buildFortuneEvents } = await import('./control/fortune-events.ts');
const ref = JSON.parse(readFileSync(new URL('./model/fixtures/leo-mc-tenth-reference.json', import.meta.url)));
const day = 86400000, rad = Math.PI / 180, birthAt = Date.parse(ref.testChart.birthAt);
const norm = x => (x % 360 + 360) % 360, arc = x => norm(x + 180) - 180;
const cusps = Array.from({ length: 12 }, (_, i) => i * 30);
function chart(armc = ref.testChart.armc, latitude = ref.testChart.latitude) {
  // Independent Cartesian plane intersections; production recovers and solves
  // the house frame from angles with a different spherical implementation.
  const time = MakeTime(new Date(birthAt)), rotate = Rotation_EQD_ECT(time), theta = armc * rad, phi = latitude * rad;
  const east = RotateVector(rotate, new Vector(-Math.sin(theta), Math.cos(theta), 0, time));
  const zenith = RotateVector(rotate, new Vector(Math.cos(phi) * Math.cos(theta), Math.cos(phi) * Math.sin(theta), Math.sin(phi), time));
  const meridian = RotateVector(rotate, new Vector(Math.cos(theta), Math.sin(theta), 0, time));
  const intersection = (normal, toward) => {
    let x = normal.y, y = -normal.x;
    if (x * toward.x + y * toward.y < 0) { x = -x; y = -y; }
    return norm(Math.atan2(y, x) / rad);
  };
  const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  return { timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] }, western: {
    engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1', rawResult: [{
      julianDay: birthAt / day + 2440587.5, ascendant: intersection(zenith, east), midheaven: intersection(east, meridian),
      positions: bodies.map(planet => ({ planet, longitude: planet === 'Sun' ? SunPosition(new Date(birthAt)).elon
        : Ecliptic(GeoVector(Body[planet], new Date(birthAt), true)).elon })),
    }] } };
}
function calculate(snapshot = chart(), year = 2025) {
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const time = buildFactTimeContext(input, Date.parse('2026-11-19T03:00:00Z'), 'server');
  return calculateFortuneFacts(input, time, 'mc-tenth-run', { snapshotId: 'mc-tenth-snapshot', chart: snapshot });
}
const rule = fortuneKnowledge.western.rules[3];
const result = run => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId === rule.knowledgeId);
const specific = run => run.facts.filter(f => f.factType === 'leo_mc_tenth_contact');
const cache = new Map();
const realRun = year => {
  if (!cache.has(year)) cache.set(year, calculate(chart(), year));
  return cache.get(year);
};

test('direct entry and retrograde exit link only to the adjoining tenth interval; an eleventh cusp is not the MC', () => {
  const window = { start: 0, end: 3 * day };
  for (const [read, role, motion] of [[at => 269 + at / day, 'entering', 'direct'], [at => 271 - at / day, 'leaving', 'retrograde']]) {
    const scan = scanCircularRegions(window, read, cusps, day), linked = linkMcTenthIntervals(window, cusps, scan);
    assert.equal(linked.length, 1); assert.equal(linked[0].linkedMcInWindow, true);
    assert.deepEqual(linked[0].mcContacts, [{ at: day, role, motion }]);
    assert.equal(linked[0][role === 'entering' ? 'start' : 'end'], day);
  }
  const other = scanCircularRegions(window, at => 301 - at / day, cusps, day);
  const linked = linkMcTenthIntervals(window, cusps, other);
  assert.equal(linked[0].inTenth, true); assert.equal(linked[0].linkedMcInWindow, false);
});

test('a station touching MC from inside X is an exact contact but not a crossing; a ninth-house-only touch has no tenth interval', () => {
  const window = { start: 0, end: 4 * day };
  for (const sign of [1, -1]) {
    const scan = scanCircularRegions(window, at => 270 + sign * (at / day - 2) ** 2, cusps, day, [2 * day]);
    assert.equal(scan.crossings.length, 0); assert.equal(scan.touches.length, 1);
    const linked = linkMcTenthIntervals(window, cusps, scan);
    assert.equal(linked[0].linkedMcInWindow, sign === 1);
    if (sign === 1) assert.deepEqual(linked[0].mcContacts, [{ at: 2 * day, motion: 'stationary', role: 'touching' }]);
    else assert.equal(linked[0].inTenth, false);
  }
});

test('query-end contacts are excluded and an exact contact at the next query start is retained without inventing a full event extent', () => {
  const read = at => 269 + at / day;
  const first = { start: 0, end: day }, next = { start: day, end: 2 * day };
  const a = linkMcTenthIntervals(first, cusps, scanCircularRegions(first, read, cusps, day / 2));
  assert.equal(a[0].linkedMcInWindow, false);
  const b = linkMcTenthIntervals(next, cusps, scanCircularRegions(next, read, cusps, day / 2));
  assert.equal(b[0].linkedMcInWindow, true); assert.equal(b[0].mcContacts[0].at, day);
  assert.equal(b[0].clippedStart, false); assert.equal(b[0].clippedEnd, true);
});

test('real 2025 ephemerides preserve both MC entry and retrograde exit with one adjoining Placidus X interval', () => {
  const run = realRun(2025); validateFortuneFacts(run);
  const facts = specific(run).filter(f => f.normalizedPayload.linkedMcInWindow);
  assert.equal(facts.length, 1);
  const fact = facts[0], p = fact.normalizedPayload;
  assert.equal(p.profile, ref.profile); assert.equal(p.houseSystem, 'placidus'); assert.equal(p.mcContacts.length, 2);
  assert.deepEqual(p.mcContacts.map(c => c.role), ['entering', 'leaving']);
  assert.deepEqual(p.mcContacts.map(c => c.motion), ['direct', 'retrograde']);
  assert.equal(fact.activeFrom, p.mcContacts[0].at); assert.equal(fact.activeTo, p.mcContacts[1].at);
  const house = run.facts.find(f => f.factType === 'natal_house_cusps' && f.normalizedPayload.houseSystem === 'placidus').normalizedPayload.cusps;
  for (const contact of p.mcContacts) {
    const at = Date.parse(contact.at);
    assert.ok(Math.abs(arc(readTransitLongitude('Saturn', at) - p.mcLongitude)) < 0.00002);
    const before = zodiacalHouse(readTransitLongitude('Saturn', at - 60000), house);
    const after = zodiacalHouse(readTransitLongitude('Saturn', at + 60000), house);
    assert.deepEqual([before, after], contact.role === 'entering' ? [9, 10] : [10, 9]);
  }
  const match = result(run); assert.equal(match.status, 'matched');
  assert.deepEqual(match.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const event = buildFortuneEvents(run, [fact])[0];
  assert.equal(event.identityScope, 'window');
  assert.equal(event.phase, 'trigger');
  assert.deepEqual(event.changes, p.mcContacts.map(contact => contact.at));
  assert.deepEqual(event.exactTimes, [p.mcContacts[0].at]);
});

test('the next real entry is a new year-specific contact; a subsequent year with X background alone is not a new MC trigger', () => {
  const reentry = realRun(2026); assert.equal(result(reentry).status, 'matched');
  const contact = specific(reentry).find(f => f.normalizedPayload.linkedMcInWindow);
  assert.ok(contact); assert.equal(contact.normalizedPayload.mcContacts[0].role, 'entering');
  assert.equal(contact.normalizedPayload.clippedEnd, true);
  const background = realRun(2027); assert.ok(specific(background).some(f => f.normalizedPayload.inTenth));
  assert.ok(specific(background).every(f => !f.normalizedPayload.linkedMcInWindow));
  assert.equal(result(background).status, 'not_matched');
});

test('generic house and unrelated MC aspects cannot substitute for the source-bound contact, nor can a wrong system or unknown link', () => {
  const generic = structuredClone(realRun(2025)); generic.facts = generic.facts.filter(f => f.factType !== 'leo_mc_tenth_contact');
  assert.ok(generic.facts.some(f => f.factType === 'traditional_house_interval' && f.normalizedPayload.natalHouse === 10));
  assert.equal(result(generic).status, 'unknown');
  for (const [key, value] of [['houseSystem', 'whole-sign'], ['profile', 'other-source'], ['inTenth', false], ['linkedMcInWindow', false]]) {
    const run = structuredClone(realRun(2025)); specific(run).forEach(f => { f.normalizedPayload[key] = value; });
    assert.equal(result(run).status, 'not_matched', key);
  }
  const missing = structuredClone(realRun(2025)); specific(missing).forEach(f => { delete f.normalizedPayload.linkedMcInWindow; });
  assert.equal(result(missing).status, 'unknown');
});

test('uncertain, incompatible, conflicting or circumpolar geometry cannot be completed with whole-sign fallback', () => {
  for (const alter of [c => { c.timeKnown = false; }, c => { c.western.engineVersion = 'other'; },
    c => { c.western.rawResult.push(structuredClone(c.western.rawResult[0])); },
    c => { c.western.rawResult[0].positions[0].longitude += 20; }]) {
    const snapshot = chart(); alter(snapshot); assert.equal(result(calculate(snapshot)).status, 'unknown');
  }
  const polar = calculate(chart(0, 80));
  assert.equal(result(polar).status, 'unknown'); assert.equal(specific(polar).length, 0);
});

test('the complete source match reaches Chinese input with distinct MC moments, real interval and conditional response branches', () => {
  const run = realRun(2025), { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'mc-tenth-prompt'));
  assert.ok(input.sections.flatMap(s => s.findings).some(f => f.knowledgeId === rule.knowledgeId));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /原文：great responsibilities/u);
  assert.match(prompt, /逆行精确经过本命天顶/u); assert.match(prompt, /离开第十宫，不能写成新进入/u);
  assert.match(prompt, /不从命盘给用户判人格层次/u);
  for (const forbidden of ['leo_mc_tenth_contact', 'linkedMcInWindow', 'mcContacts', 'mc-tenth-run', 'armc', 'latitude', 'https://']) assert.ok(!prompt.includes(forbidden), forbidden);
});

test('source review keeps the unchanged original hash, both response branches and the independently inspected PDF page', () => {
  const e = fortuneKnowledge.western.entries.find(e => e.id === rule.knowledgeId);
  assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: e.evidence, conditions: e.conditions })).digest('hex'));
  assert.equal(rule.unresolved.length, 0); assert.equal(rule.queries[0].where.linkedMcInWindow, true);
  assert.match(rule.review.mappedConditions.join(), /逆行离开/u);
  assert.match(rule.review.mappedConditions.join(), /停驻触及/u);
  assert.match(rule.review.mappedConditions.join(), /回应分支/u);
  assert.equal(rule.review.supportingSources[0], ref.source.url);
  assert.equal(e.source.section, 'p. 195，SATURN，天顶与第十宫');
});
