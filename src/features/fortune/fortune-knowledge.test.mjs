import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'node:module';
import './server/knowledge/runtime.mjs';
import { formatFortunePrompt } from './control/fortune-prompt.mjs';

register('./server/resolve-fortune.mjs', import.meta.url);
const { calculateFortuneFacts, factPolicies } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { luAnnualDailyTwistCase, luMonthDayTwist } = await import('./control/bazi-source-context.ts');
const methods = ['bazi', 'ziwei', 'western'];

function scenario(periodType = 'day') {
  const input = { periodType, displayTimezone: 'Asia/Shanghai' };
  const time = buildFactTimeContext(input, Date.parse('2026-11-06T02:00:00Z'), 'server');
  const run = calculateFortuneFacts(input, time, 'knowledge-run', { snapshotId: 'source-chart' });
  run.facts = [];
  run.rawFacts = [];
  for (const method of methods) run.methods[method] = { status: 'completed', warnings: [] };
  function add(method, factType, payload, options = {}) {
    const policy = factPolicies[method];
    const factId = method + ':' + run.facts.length;
    const rawFactId = 'raw:' + factId;
    run.rawFacts.push({ method, rawFactId, payload });
    run.facts.push({
      factId, calculationRunId: run.calculationRunId, natalChartSnapshotId: run.natalChartSnapshotId,
      method, factType, scope: 'daily', periodType, subjectIds: [method + ':candidate:0'],
      activeFrom: time.displayWindow.instantRange.startInstant,
      activeTo: time.displayWindow.instantRange.endInstantExclusive,
      sourceFactIds: [rawFactId], sourceEngine: policy.engine, engineVersion: policy.version,
      rulesetVersion: policy.rules, timeZone: policy.timeZone,
      timePrecision: 'range', completeness: 'complete', warnings: [], normalizedPayload: payload, ...options,
    });
    return factId;
  }
  return { run, add };
}
const entryResult = (run, method, index) => matchFortuneKnowledge(run).byMethod[method][index];

test('all three methods have independent versioned rule coverage', () => {
  assert.deepEqual(methods.map(method => fortuneKnowledge[method].entries.length), [435, 214, 1747]);
  assert.equal(new Set(methods.map(method => fortuneKnowledge[method].version)).size, methods.length);
  for (const method of methods) {
    const library = fortuneKnowledge[method];
    assert.equal(library.rules.length, library.entries.length);
    assert.deepEqual(library.rules.map(rule => rule.knowledgeId), library.entries.map(entry => entry.id));
  }
});

test('Sepharial exact transits use the original planets and natal targets', () => {
  const { run, add } = scenario('year');
  const byId = () => matchFortuneKnowledge(run).byMethod.western;
  const entry = (suffix, matches) => matches.find(match => match.knowledgeId.endsWith(suffix));
  const at = { scope: 'transit', exactInstant: '2026-09-10T18:40:38.768Z' };
  const retrograde = { slowTransit: true, transitMotion: 'retrograde', aspectType: 'conjunction' };
  const station = { slowTransit: true, exactConjunction: true };
  add('western', 'aspect_exact', { ...retrograde, transitBody: 'Pluto', natalTargetId: 'Sun' }, at);
  add('western', 'aspect_exact', { ...retrograde, transitBody: 'Saturn', natalTargetId: 'IC' }, at);
  add('western', 'station_natal_contact', { ...station, transitBody: 'Pluto', natalTargetId: 'MC' }, at);
  add('western', 'station_natal_contact', { ...station, transitBody: 'Neptune', natalTargetId: 'Venus' }, at);
  add('western', 'aspect_exact', { ...retrograde, transitBody: 'Saturn', natalTargetId: 'Venus' }, { ...at, scope: 'progressed' });
  add('western', 'aspect_exact', { ...retrograde, transitBody: 'Uranus', natalTargetId: 'Venus', aspectType: 'square' }, at);
  const ids = ['sepharial-v4-transit-p002-001', 'sepharial-v4-transit-p002-002',
    'sepharial-v4-transit-p001-001', 'sepharial-v4-transit-p001-002'];
  const excluded = byId();
  for (const id of ids) assert.equal(entry(id, excluded).status, 'not_matched');

  const accepted = [
    add('western', 'aspect_exact', { ...retrograde, transitBody: 'Saturn', natalTargetId: 'Sun' }, at),
    add('western', 'station_natal_contact', { ...station, transitBody: 'Uranus', natalTargetId: 'MC' }, at),
    add('western', 'aspect_exact', { transitBody: 'Saturn', natalTargetId: 'Venus', aspectType: 'conjunction' }, at),
    add('western', 'aspect_exact', { transitBody: 'Uranus', natalTargetId: 'Venus', aspectType: 'conjunction' }, at),
  ];
  add('western', 'aspect_interval', { transitBody: 'Saturn', natalTargetId: 'Moon', aspectType: 'conjunction' }, at);
  add('western', 'aspect_interval', { transitBody: 'Pluto', natalTargetId: 'MC', aspectType: 'conjunction' }, at);
  const matches = byId();
  for (const [index, id] of ids.entries()) {
    assert.equal(entry(id, matches).status, 'matched');
    assert.deepEqual(entry(id, matches).sourceFactIds, [accepted[index]]);
  }
  for (const suffix of ['astrologyskill-v1-transit-p001-001', 'astrologyskill-v1-transit-p002-001']) {
    assert.equal(entry(suffix, matches).status, 'unsupported');
    assert.deepEqual(entry(suffix, matches).sourceFactIds, []);
  }
});

test('source predicates cannot match from another method or from incomplete or incompatible facts', () => {
  const { run, add } = scenario('year');
  const example = { profile: 'smth-annual-column-relations-v1', natalDay: '癸巳', yearPillar: '丁亥',
    dayControlsYear: true, dayBranchClash: true };
  const scope = { scope: 'yearly' };
  add('western', 'annual_column_relations', example, scope);
  add('bazi', 'calendar_pattern', { guiSiDingHai: true }, scope);
  assert.equal(entryResult(run, 'bazi', 4).status, 'unknown');
  const id = add('bazi', 'annual_column_relations', example, scope);
  const fact = run.facts.find(fact => fact.factId === id);
  fact.normalizedPayload = { ...example, dayControlsYear: false };
  assert.equal(entryResult(run, 'bazi', 4).status, 'not_matched');
  fact.normalizedPayload = { ...example, dayBranchClash: false };
  assert.equal(entryResult(run, 'bazi', 4).status, 'not_matched');
  fact.normalizedPayload = example;
  assert.equal(entryResult(run, 'bazi', 4).status, 'matched');
  assert.deepEqual(entryResult(run, 'bazi', 4).sourceFactIds, [id]);
  run.facts.find(fact => fact.factId === id).completeness = 'partial';
  assert.equal(entryResult(run, 'bazi', 4).status, 'unknown');
  run.facts.find(fact => fact.factId === id).completeness = 'complete';
  run.facts.find(fact => fact.factId === id).engineVersion = 'other';
  assert.equal(entryResult(run, 'bazi', 4).status, 'unknown');
});

test('SQLite matching preserves the full audit and weekly time windows of the reference matcher', () => {
  const libraries = { ...fortuneKnowledge };
  for (const period of ['day', 'week', 'month', 'year']) {
    const { run, add } = scenario(period);
    const middle = new Date((run.time.window.start + run.time.window.end) / 2).toISOString();
    add('bazi', 'calendar_pattern', luMonthDayTwist('庚申', '辛未'),
      { activeTo: middle });
    add('bazi', 'pillar_relation', { kind: '六冲', members: ['flow:month', 'natal:day'] }, { activeFrom: middle });
    add('western', 'calendar_pattern', {});
    add('ziwei', 'layer_overlap', {}, { completeness: 'partial' });
    assert.deepEqual(matchFortuneKnowledge(run), matchFortuneKnowledge(run, libraries), period);
  }
});

test('a SQLite confirmation refines the same candidate and keeps a separate broader return window', () => {
  const { run, add } = scenario('year');
  const { startInstant: start, endInstantExclusive: end } = run.time.displayWindow.instantRange;
  const handoff = '2026-08-17T02:31:06.960Z';
  const payload = { profile: 'lilly-return-source-pairs-v3-radical-place', pair: 'venus-mercury',
    returnEpochBasis: 'natal-sun-ephemeris', radicalPlaceCandidate: true, returnLocalFrame: 'lilly-revolution-local-regiomontanus-v1',
    returnHorizonContrast: 'different-configuration', returnVenusAtLeastWorkedFortitude: true, returnHouse: 10 };
  const broad = add('western', 'lilly_return_context', { ...payload, radicalPlaceMinuteState: 'different_printed_minutes' },
    { scope: 'yearly', activeTo: handoff });
  add('western', 'lilly_return_context', { ...payload, pair: 'jupiter-mercury', radicalPlaceMinuteState: 'same_printed_minute' },
    { scope: 'yearly', activeTo: handoff });
  const result = () => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('lilly-v3-return-p003'));
  assert.equal(result().status, 'partial');
  assert.deepEqual(result().sourceFactIds, [broad]);
  const exact = add('western', 'lilly_return_context', { ...payload, radicalPlaceMinuteState: 'same_printed_minute' },
    { scope: 'yearly', activeFrom: handoff });
  const match = result();
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.sourceFactIds, [exact]);
  assert.deepEqual(match.windows, [{ start: handoff, endExclusive: end }]);
  assert.deepEqual(match.candidateWindows, [{ start, endExclusive: handoff }]);
  assert.match(match.matchedConditions[0], /太阳回归金星与本命水星同座同角分/u);
  assert.ok(match.unresolvedConditions.length);
  assert.deepEqual(matchFortuneKnowledge(run, { ...fortuneKnowledge }), matchFortuneKnowledge(run));
  const exclusionStart = '2026-11-01T00:00:00.000Z';
  add('western', 'test_exclusion', { active: true }, { scope: 'yearly', activeFrom: exclusionStart });
  const library = fortuneKnowledge.western;
  const rules = library.rules.map(row => row.knowledgeId === match.knowledgeId
    ? { ...row, unless: [{ factType: 'test_exclusion', scope: 'yearly', where: { active: true } }] } : row);
  const clipped = matchFortuneKnowledge(run, { ...fortuneKnowledge, western: { ...library, rules } })
    .byMethod.western.find(row => row.knowledgeId === match.knowledgeId);
  assert.equal(clipped.status, 'matched');
  assert.deepEqual(clipped.windows, [{ start: handoff, endExclusive: exclusionStart }]);
  assert.deepEqual(clipped.candidateWindows, [{ start, endExclusive: handoff }]);
});

test('SQLite retains a confirmed return when another return window has an unknown exclusion', () => {
  const { run, add } = scenario('year');
  const { startInstant: start, endInstantExclusive: end } = run.time.displayWindow.instantRange;
  const handoff = '2026-08-17T02:31:06.960Z', overlapEnd = '2026-09-01T00:00:00.000Z';
  const payload = { profile: 'lilly-return-source-pairs-v3-radical-place', pair: 'venus-mercury',
    returnEpochBasis: 'natal-sun-ephemeris', radicalPlaceCandidate: true, returnLocalFrame: 'lilly-revolution-local-regiomontanus-v1',
    radicalPlaceMinuteState: 'same_printed_minute', returnVenusAtLeastWorkedFortitude: true, returnHouse: 10 };
  const addReturn = (fields, activeFrom, activeTo) =>
    add('western', 'lilly_return_context', { ...payload, ...fields }, { scope: 'yearly', activeFrom, activeTo });
  const read = libraries => matchFortuneKnowledge(run, libraries).byMethod.western.find(row => row.knowledgeId.includes('lilly-v3-return-p003'));
  addReturn({}, start, handoff);
  assert.equal(read().status, 'unknown');

  const confirmed = addReturn({ returnHorizonContrast: 'different-configuration' }, handoff, end);
  const later = read();
  assert.equal(later.status, 'matched');
  assert.deepEqual(later.windows, [{ start: handoff, endExclusive: end }]);
  assert.deepEqual(later.sourceFactIds, [confirmed]);
  assert.deepEqual(later.candidateWindows, [{ start, endExclusive: handoff }]);

  addReturn({}, handoff, overlapEnd);
  const clipped = read();
  assert.equal(clipped.status, 'matched');
  assert.deepEqual(clipped.windows, [{ start: overlapEnd, endExclusive: end }]);
  assert.deepEqual(clipped.candidateWindows, [{ start, endExclusive: overlapEnd }]);
  assert.deepEqual(clipped, read({ ...fortuneKnowledge }));

  addReturn({ returnHorizonContrast: 'radix-below-return-above' }, overlapEnd, end);
  assert.equal(read().status, 'unknown');
  assert.deepEqual(read().windows, [{ start, endExclusive: overlapEnd }]);
});

test('SQLite keeps independent source conditions on their own branch windows and emits only the routes that matched', () => {
  const { run, add } = scenario('year');
  const { startInstant: start, endInstantExclusive: end } = run.time.displayWindow.instantRange;
  const from = '2026-04-01T00:00:00.000Z', handoff = '2026-06-01T00:00:00.000Z', to = '2026-08-01T00:00:00.000Z';
  const payload = { profile: 'quanshu-cry-void-doujun-year-encounters-v1', limitPlacementProof: 'quanshu-bureau-and-source-minor-v1',
    kuXuPlacementProof: 'quanshu-kuxu-birth-year-adjective-layer-v1', ready: true,
    cryMourningNanyangProfile: 'quanshu-nanyangtang-cry-mourning-cases-v1' };
  const fact = (fields, activeFrom, activeTo) => add('ziwei', 'quanshu_year_encounters', { ...payload, ...fields },
    { scope: 'yearly', activeFrom, activeTo });
  fact({ cryMourningCandidate: true }, start, end);
  fact({ ready: false, cryMourningNanyangLifeCandidate: true }, start, from);
  const minor = fact({ cryMourningNanyangMinorCandidate: true }, from, handoff);
  const find = evaluated => evaluated.byMethod.ziwei.find(row => row.knowledgeId.includes('quanshu-interpretation-expansion-p052'));
  const lone = find(matchFortuneKnowledge(run));
  assert.deepEqual(lone.sourceFactIds, [minor]);
  assert.match(lone.matchedConditions[0], /流年丧门实守复算的小限/u);
  assert.equal(lone.confirmedBranches, undefined);
  const life = fact({ cryMourningNanyangLifeCandidate: true }, handoff, to);
  const match = find(matchFortuneKnowledge(run));
  assert.deepEqual(match, find(matchFortuneKnowledge(run, { ...fortuneKnowledge })));
  assert.deepEqual(match.windows, [{ start: from, endExclusive: to }]);
  assert.deepEqual(match.confirmedBranches.map(({ sourceFactIds, windows }) => [sourceFactIds, windows]), [
    [[minor], [{ start: from, endExclusive: handoff }]], [[life], [{ start: handoff, endExclusive: to }]],
  ]);
  assert.deepEqual(match.candidateWindows, [{ start, endExclusive: from }, { start: to, endExclusive: end }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'confirmed-branches'));
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === match.knowledgeId);
  assert.deepEqual(finding?.conditions, []);
  assert.deepEqual(finding.confirmedBranches.map(({ windows }) => windows), match.confirmedBranches.map(branch => branch.windows));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /命中分支：[^\n]+流年丧门实守复算的小限/u);
  assert.match(prompt, /命中分支：[^\n]+本命天哭实守命宫/u);
  assert.doesNotMatch(prompt, /cryMourningNanyang|2026-04-01|2026-06-01|\bF\d+\b/u);
});

test('unregistered imported interpretation entries stay unsupported until machine rules are registered', () => {
  const { run } = scenario('year');
  // Inject the state of a genuinely new source. Do not tie this protection to
  // the shrinking number of currently unregistered production entries.
  const libraries = Object.fromEntries(methods.map(method => {
    const library = fortuneKnowledge[method];
    const target = library.rules.find(rule => rule.period === 'year');
    return [method, { ...library, rules: library.rules.map(rule => rule !== target ? rule : {
      knowledgeId: rule.knowledgeId, period: rule.period, queries: [], unresolved: ['尚未登记经核验的机器匹配规则。'],
    }) }];
  }));
  const matches = matchFortuneKnowledge(run, libraries);
  let pending = 0;
  for (const method of methods) {
    const library = libraries[method];
    library.rules.forEach((rule, index) => {
      if (rule.unresolved[0] !== '尚未登记经核验的机器匹配规则。') return;
      pending++;
      assert.equal(matches.byMethod[method][index].status, rule.period === 'year' ? 'unsupported' : 'not_applicable');
    });
  }
  assert.equal(pending, methods.length);
});

test('FateClear monthly clash verifies the full-chart relationship and retains the unresolved directional reading', () => {
  const { run, add } = scenario('month');
  add('bazi', 'pillar_relation', { kind: '六冲', members: ['flow:month', 'natal:day'] }, { scope: 'monthly' });
  assert.equal(entryResult(run, 'bazi', 28).status, 'unknown');
  const facts = { profile: 'fateclear-branch-and-example-v1', layer: 'month',
    clock: 'beijing-instant-solar-term-month', clashedColumns: ['day'], clashReviewProfile: 'fateclear-direct-clash-role-and-combination-v1' };
  add('bazi', 'fateclear_bazi_context', facts, { scope: 'monthly' });
  assert.equal(entryResult(run, 'bazi', 28).status, 'unknown');
  facts.dayClashReviewed = true;
  assert.equal(entryResult(run, 'bazi', 28).status, 'unknown');
  facts.monthDayClashGeometryVerified = true;
  assert.equal(entryResult(run, 'bazi', 28).status, 'unknown');
  facts.monthDayClashNatalCombinationsChecked = true;
  const match = entryResult(run, 'bazi', 28);
  assert.equal(match.status, 'partial');
  assert.ok(match.unresolvedConditions.length);
  const report = interpretFortune(run, requestForFortuneRun(run), 'partial-source');
  const { input } = buildFortuneModelContext(run, report);
  assert.ok(input.sections.every(section => section.findings.every(finding => finding.knowledgeId !== match.knowledgeId)));
  assert.ok(input.methods.bazi.incompleteConditions.some(entry => entry.knowledgeId === match.knowledgeId));
});

test('Leo grouped longitude-or-parallel queries require their source profile, date equator and one-degree magnitude policy, independent of hemisphere', () => {
  const { run, add } = scenario('year');
  const payload = { kind: 'secondary', progressionPolicy: 'secondary-utc-calendar-month-v1', zodiac: 'tropical',
    targetKind: 'natal', progressedBody: 'Sun', natalTargetId: 'Mercury', aspectType: 'parallel',
    profile: 'leo-1906-source-context-v1', allowedOrb: 1, parallelComparison: 'absolute-declination-north-south-not-required',
    coordinate: 'natal_equatorial_declination', sameHemisphere: false,
    lunarProfile: 'leo-1906-lunar-conditions-v1', lunarLinkedBodies: ['Mercury'] };
  add('western', 'leo_lunar_condition', payload, { scope: 'progressed' });
  const result = () => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('interpretation-p245-'));
  assert.equal(result().status, 'not_matched');
  payload.coordinate = 'equatorial_declination_of_date';
  assert.equal(result().status, 'matched');
  payload.allowedOrb = 0.25;
  assert.equal(result().status, 'not_matched');
  payload.allowedOrb = 1;
  payload.coordinate = 'ecliptic_longitude';
  assert.equal(result().status, 'not_matched');
  payload.aspectType = 'conjunction';
  assert.equal(result().status, 'matched');
  payload.lunarLinkedBodies = ['Mars'];
  assert.equal(result().status, 'matched');
  delete payload.lunarLinkedBodies;
  assert.equal(result().status, 'matched');
});

test('all required facts must coexist in the same interval', () => {
  const { run, add } = scenario('year');
  const middle = new Date((run.time.window.start + run.time.window.end) / 2).toISOString();
  const [entry] = fortuneKnowledge.ziwei.entries;
  const library = { ...fortuneKnowledge.ziwei, entries: [entry], rules: [{ knowledgeId: entry.id, period: 'year',
    queries: ['decadal', 'minor', 'yearly'].map(scope => ({ factType: 'time_segment', scope, where: {} })), unresolved: [] }] };
  const result = () => matchFortuneKnowledge(run, { ...fortuneKnowledge, ziwei: library }).byMethod.ziwei[0];
  add('ziwei', 'time_segment', {}, { scope: 'decadal', activeTo: middle });
  add('ziwei', 'time_segment', {}, { scope: 'minor', activeFrom: middle });
  add('ziwei', 'time_segment', {}, { scope: 'yearly' });
  assert.equal(result().status, 'not_matched');
  run.facts[0].activeTo = run.time.displayWindow.instantRange.endInstantExclusive;
  const match = result();
  assert.equal(match.status, 'matched');
  assert.equal(match.windows[0].start, middle);
});

test('a daily exact transit is matched to its own local civil day and carries the real library source to the prompt', () => {
  const { run, add } = scenario('day');
  const payload = { transitBody: 'Mars', natalTargetId: 'ASC', aspectType: 'conjunction' };
  add('western', 'aspect_exact', payload, { scope: 'progressed', exactInstant: '2026-11-05T23:00:00.000Z' });
  assert.notEqual(entryResult(run, 'western', 19).status, 'matched');
  add('western', 'aspect_exact', payload,
    { scope: 'transit', exactInstant: '2026-11-05T23:00:00.000Z' });
  const match = entryResult(run, 'western', 19);
  assert.equal(match.status, 'matched');
  assert.deepEqual(match.windows, [{ start: '2026-11-05T16:00:00.000Z', endExclusive: '2026-11-06T16:00:00.000Z' }]);
  const report = interpretFortune(run, requestForFortuneRun(run), 'source-to-model');
  const { input } = buildFortuneModelContext(run, report);
  const finding = input.sections[0].findings.find(finding => finding.knowledgeId === match.knowledgeId);
  assert.equal(finding.note, fortuneKnowledge.western.entries[19].interpretation.classical_meaning);
  assert.doesNotMatch(finding.note, /更有行动力/u);
  assert.equal(finding.originalText, fortuneKnowledge.western.entries[19].evidence.original_text);
  assert.equal(finding.source.book, 'Christian Astrology');
  assert.equal(finding.factRefs.length, 1);
  assert.ok(input.facts.some(fact => fact.ref === finding.factRefs[0] && fact.exactAt));
});

test('the weekly matcher uses weekly rules and keeps a matching weekly fact in its original window', () => {
  const { run, add } = scenario('week');
  add('western', 'aspect_exact', { transitBody: 'Mars', natalTargetId: 'ASC', aspectType: 'conjunction' },
    { scope: 'transit', exactInstant: '2026-11-05T23:00:00.000Z' });
  const { rules, entries, version } = fortuneKnowledge.western;
  const dayRule = rules[19];
  assert.equal(entryResult(run, 'western', 19).status, 'not_applicable');
  const report = interpretFortune(run, requestForFortuneRun(run), 'weekly-without-a-daily-rule');
  const { input } = buildFortuneModelContext(run, report);
  assert.ok(input.sections.every(section => section.findings.every(finding => finding.knowledgeId !== dayRule.knowledgeId)));

  const weekRule = { ...dayRule, period: 'week', knowledgeId: 'weekly-fixture' };
  const libraries = { ...fortuneKnowledge, western: {
    version, entries: [entries[19], { ...entries[19], id: weekRule.knowledgeId }], rules: [dayRule, weekRule],
  } };
  const [daily, weekly] = matchFortuneKnowledge(run, libraries).byMethod.western;
  assert.equal(daily.status, 'not_applicable');
  assert.equal(weekly.status, 'matched');
  assert.deepEqual(weekly.windows, [{ start: run.facts[0].activeFrom, endExclusive: run.facts[0].activeTo }]);
});

test('missing fields stay unknown and ambiguous candidates never combine into a library hit', () => {
  const { run, add } = scenario('day');
  const monthDay = luMonthDayTwist('甲子', '乙亥');
  add('bazi', 'calendar_pattern', { firstDegree: monthDay.firstDegree }, { subjectIds: ['flow:month', 'flow:day'] });
  assert.equal(entryResult(run, 'bazi', 39).status, 'unknown');
  run.facts[0].normalizedPayload = monthDay;
  assert.equal(entryResult(run, 'bazi', 39).status, 'matched');
  const natal = { year: '己未', month: '庚午', day: '庚申', hour: '丙戌', utc: '1919-07-07T12:00:00.000Z' };
  const caseGeometry = luAnnualDailyTwistCase(natal, 'Asia/Shanghai', '辛未', '戊戌', '乙亥', '癸亥', true);
  add('bazi', 'lu_annual_daily_twist', { ...caseGeometry, hasPublishedLuck: undefined });
  assert.equal(entryResult(run, 'bazi', 40).status, 'unknown');
  run.facts[1].normalizedPayload = caseGeometry;
  assert.equal(entryResult(run, 'bazi', 40).status, 'matched');
  add('bazi', 'lu_annual_daily_twist', { ...caseGeometry, matchesPublishedGeometry: false },
    { subjectIds: ['bazi:candidate:1'] });
  assert.equal(entryResult(run, 'bazi', 40).status, 'unknown');
  assert.equal(entryResult(run, 'bazi', 39).status, 'matched');
});

const { buildFortuneEvents } = await import('./control/fortune-events.ts');

test('a shared native event keeps one identity across views and repeated citations', () => {
  const { run, add } = scenario('week');
  add('western', 'aspect_interval', { transitBody: 'Venus', natalTargetId: 'Moon' },
    { scope: 'transit', parentSignalId: 'venus-moon-native-episode' });
  add('western', 'aspect_exact', { transitBody: 'Venus', natalTargetId: 'Moon' },
    { scope: 'transit', parentSignalId: 'venus-moon-native-episode', exactInstant: '2026-11-06T02:00:00.000Z' });
  const events = buildFortuneEvents(run, run.facts);
  assert.equal(events.length, 1);
  assert.equal(events[0].factIds.length, 2);
  assert.equal(events[0].phase, 'trigger');
  const daily = structuredClone(run);
  daily.facts = daily.facts.map(fact => ({ ...fact, activeFrom: '2026-11-05T16:00:00.000Z',
    activeTo: '2026-11-06T16:00:00.000Z' }));
  assert.equal(buildFortuneEvents(daily, daily.facts)[0].eventId, events[0].eventId);
});

test('counterconditions subtract only the overlapping time, and missing counterconditions stay unknown', () => {
  const { run, add } = scenario('day');
  add('bazi', 'calendar_pattern', luMonthDayTwist('甲子', '乙亥'));
  const libraries = { ...fortuneKnowledge };
  const result = () => matchFortuneKnowledge(run, libraries).byMethod.bazi[39];
  const rule = libraries.bazi.rules[39];
  const original = rule.unless;
  try {
    rule.unless = [{ factType: 'test_counter', where: { active: true } }];
    assert.equal(result().status, 'unknown');
    const middle = new Date((run.time.window.start + run.time.window.end) / 2).toISOString();
    add('bazi', 'test_counter', { active: true }, { activeFrom: middle });
    const match = result();
    assert.equal(match.status, 'matched');
    assert.equal(match.windows[0].endExclusive, middle);
    run.facts[1].activeFrom = run.time.displayWindow.instantRange.startInstant;
    assert.equal(result().status, 'excluded');
  } finally {
    if (original) rule.unless = original;
    else delete rule.unless;
  }
});
