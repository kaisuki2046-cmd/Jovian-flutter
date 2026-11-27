import assert from 'node:assert/strict';
import test from 'node:test';
import { Body, Ecliptic, EquatorFromVector, GeoVector, RotateVector, Rotation_EQJ_EQD, SunPosition } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';

const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { anglesFromFrame, calculateHouseCusps, zodiacalHouse } = await import('./control/western-houses.ts');
const { readLeoSignRuler } = await import('./control/leo-rulership.ts');
const { evaluateFortuneRules, getFortuneKnowledgeEntry } = await import('./control/knowledge/catalog.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { buildLeoSolarLunarPhases, buildLeoSolarPhases } = await import('./control/leo-solar-phases.ts');
const { progressionEpoch, progressionPolicy, scanProgressionLongitudePair } = await import('./control/western-progressions.ts');

const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const angles = { conjunction: 0, semisextile: 30, semisquare: 45, sextile: 60, square: 90, trine: 120,
  sesquiquadrate: 135, quincunx: 150, opposition: 180 };
const phases = { 'applying-year': -1, 'formation-year': 0, 'separating-year': 1 };
const year = { start: Date.UTC(2026, 0, 1), end: Date.UTC(2027, 0, 1) };

function longitude(body, at) {
  const date = new Date(at);
  return body === 'Sun' ? SunPosition(date).elon : Ecliptic(GeoVector(Body[body], date, true)).elon;
}

function submit(birth, targetYear = 2026, armc = 0, latitude = 0) {
  const birthAt = Date.parse(birth + 'T00:00:00Z');
  const parameters = { periodType: 'year', targetPeriod: { year: targetYear }, displayTimezone: 'UTC' };
  const now = Date.UTC(targetYear, 5, 15);
  const reference = { snapshotId: `leo-solar-phase-${birth}-${targetYear}-${armc}-${latitude}`, chart: {
    timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] }, western: {
      engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1', rawResult: [{
        julianDay: birthAt / 86_400_000 + 2440587.5, ...anglesFromFrame(armc, latitude, 23.44),
        positions: planets.map(planet => ({ planet, longitude: longitude(planet, birthAt) })),
      }],
    },
  } };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, reference)));
  const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
  return { run, birthAt };
}

function birthdayAtYear(birthAt, civilYear) {
  const birthday = new Date(birthAt);
  const month = birthday.getUTCMonth(), day = birthday.getUTCDate();
  const supportedDay = Math.min(day, new Date(Date.UTC(civilYear, month + 1, 0)).getUTCDate());
  return Date.UTC(civilYear, month, supportedDay);
}

function phaseBounds(birthAt, formationAt, phase) {
  let formationYear = new Date(formationAt).getUTCFullYear();
  if (formationAt < birthdayAtYear(birthAt, formationYear)) formationYear--;
  const civilYear = formationYear + phases[phase];
  return { start: birthdayAtYear(birthAt, civilYear), end: birthdayAtYear(birthAt, civilYear + 1) };
}

test('p225 keeps the real onset, peak, and natal-to-progressed transition with measured lunar support separate', () => {
  const isRule = row => row.knowledgeId.includes('-p225-');
  const isGeometry = p => p.progressedBody === 'Sun' && p.natalTargetId === 'Jupiter' && p.aspectType === 'conjunction';
  const cases = [['1967-05-26', 2026, ['applying-year', 'formation-year']], ['1945-06-27', 2026, ['natal-to-progressed']],
    ['1967-05-26', 2024, []], ['1946-07-26', 2026, ['formation-year', 'separating-year']]];
  for (const [birth, targetYear, expectedPhases] of cases) {
    const { run, birthAt } = submit(birth, targetYear);
    const result = matchFortuneKnowledge(run).byMethod.western.find(isRule);
    const directions = run.facts.filter(row => result.sourceFactIds.includes(row.factId));
    assert.equal(result.status, expectedPhases.length ? 'matched' : 'not_matched', birth);
    assert.deepEqual(directions.map(row => row.normalizedPayload.phase), expectedPhases, birth);
    for (const direction of directions) {
      const p = direction.normalizedPayload;
      assert.equal(direction.factType, 'leo_solar_phase');
      assert.equal(p.natalJupiterAfflictionChecked, true);
      const formed = progressionEpoch(birthAt, Date.parse(p.formationAt));
      const opposed = p.targetKind === 'natal' ? birthAt : formed;
      const difference = Math.abs((longitude('Sun', formed) - longitude('Jupiter', opposed) + 540) % 360 - 180);
      assert.ok(difference < 0.00001, birth);
      if (p.phase === 'natal-to-progressed') {
        assert.equal(p.targetKind, 'progressed');
        const natalFormation = progressionEpoch(birthAt, Date.parse(p.natalFormationAt));
        const natalDifference = Math.abs((longitude('Sun', natalFormation) - longitude('Jupiter', birthAt) + 540) % 360 - 180);
        assert.ok(natalDifference < 0.00001 && p.natalFormationAt < direction.activeFrom && direction.activeTo < p.formationAt);
      }
    }
    if (targetYear !== 2026 || birth === '1945-06-27') continue;
    const peak = directions.find(row => row.normalizedPayload.phase === 'formation-year');
    assert.deepEqual(peak.normalizedPayload.natalJupiterAfflictionContacts, []);
    const inPhase = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_solar_lunar_phase' && isGeometry(p)
      && p.formationAt === peak.normalizedPayload.formationAt && p.phase === 'formation-year' && p.targetKind === 'natal');
    const strengthened = inPhase.filter(row => row.normalizedPayload.lunarQualification === 'strengthened');
    if (birth === '1967-05-26') {
      const expectedAt = '2026-05-26T19:03:52.141Z';
      assert.equal(peak.normalizedPayload.formationAt, expectedAt);
      assert.ok(inPhase.some(row => row.activeFrom <= expectedAt && expectedAt < row.activeTo
        && row.normalizedPayload.lunarQualification === undefined));
      assert.deepEqual(strengthened, []);
      continue;
    }
    const moonSupportAt = '2026-04-03T00:00:00.000Z';
    assert.ok(strengthened.some(({ activeFrom, activeTo, normalizedPayload: p }) => activeFrom <= moonSupportAt && moonSupportAt < activeTo
      && p.contacts.some(row => row.target === 'Saturn' && row.aspectType === 'sextile')));
    assert.ok(strengthened.every(({ activeFrom, activeTo, normalizedPayload: p }) =>
      peak.activeFrom <= activeFrom && activeTo <= peak.activeTo && p.sameLayerLunarState === 'all_favourable'
      && p.natalJupiterAfflictionContacts.length === 0));
  }
});

const groups = [
  { birth: '1979-05-26', rules: [
    { passage: 'p249', target: 'Moon', aspects: ['semisquare'], layers: ['natal'] },
    { passage: 'p254', target: 'Moon', aspects: ['quincunx'], layers: ['progressed'] },
    { passage: 'p264', target: 'Neptune', aspects: ['quincunx'], layers: ['natal', 'progressed'] },
  ] },
  { birth: '1941-05-24', rules: [
    { passage: 'p258', target: 'Neptune', aspects: ['semisextile'], layers: ['natal'] },
  ] },
  { birth: '1984-09-11', rules: [
    { passage: 'p260', target: 'Neptune', aspects: ['sextile'], layers: ['natal', 'progressed'] },
  ] },
  { birth: '1957-09-23', rules: [
    { passage: 'p227', target: 'Jupiter', aspects: ['semisquare'], layers: ['progressed'] },
    { passage: 'p228', target: 'Jupiter', aspects: ['sextile'], layers: ['natal'] },
    { passage: 'p251', target: 'Moon', aspects: ['square'], layers: ['progressed'] },
    { passage: 'p267', target: 'Saturn', aspects: ['conjunction'], layers: ['natal'] },
    { passage: 'p282', target: 'Uranus', aspects: ['trine'], layers: ['natal'] },
    { passage: 'p288', target: 'Venus', aspects: ['semisextile'], layers: ['natal'] },
  ] },
  { birth: '1963-09-01', rules: [
    { passage: 'p232', target: 'Jupiter', aspects: ['quincunx'], layers: ['progressed'] },
    { passage: 'p253', target: 'Moon', aspects: ['sesquiquadrate'], layers: ['progressed'] },
    { passage: 'p255', target: 'Moon', aspects: ['opposition'], layers: ['progressed'] },
    { passage: 'p280', target: 'Uranus', aspects: ['sextile'], layers: ['progressed'] },
    { passage: 'p290', target: 'Venus', aspects: ['sextile'], layers: ['natal'] },
  ] },
  { birth: '1948-01-23', rules: [
    { passage: 'p230', target: 'Jupiter', aspects: ['trine'], layers: ['natal'] },
    { passage: 'p240', target: 'Mars', aspects: ['trine'], layers: ['progressed'] },
    { passage: 'p241', target: 'Mars', aspects: ['sesquiquadrate'], layers: ['natal'] },
    { passage: 'p272', target: 'Saturn', aspects: ['trine'], layers: ['natal'] },
    { passage: 'p289', target: 'Venus', aspects: ['semisquare', 'square'], layers: ['natal'] },
    { passage: 'p247', target: 'Moon', aspects: ['conjunction'], layers: ['progressed'] },
  ] },
  { birth: '2002-10-15', rules: [
    { passage: 'p229', target: 'Jupiter', aspects: ['square'], layers: ['natal', 'progressed'] },
    { passage: 'p250', target: 'Moon', aspects: ['sextile'], layers: ['progressed'] },
    { passage: 'p273', target: 'Saturn', aspects: ['sesquiquadrate'], layers: ['natal', 'progressed'] },
    { passage: 'p287', target: 'Venus', aspects: ['conjunction'], layers: ['natal'] },
    { passage: 'p236', target: 'Mars', aspects: ['semisextile'], layers: ['progressed'] },
  ] },
  { birth: '1969-01-23', rules: [
    { passage: 'p233', target: 'Jupiter', aspects: ['opposition'], layers: ['progressed'] },
    { passage: 'p246', target: 'Mercury', aspects: ['semisquare', 'square'], layers: ['natal'] },
    { passage: 'p285', target: 'Uranus', aspects: ['opposition'], layers: ['progressed'] },
  ] },
  { birth: '1939-04-01', rules: [
    { passage: 'p242', target: 'Mars', aspects: ['quincunx'], layers: ['progressed'],
      phaseTypes: ['applying-year', 'formation-year'] },
    { passage: 'p243', target: 'Mars', aspects: ['opposition'], layers: ['natal'] },
    { passage: 'p279', target: 'Uranus', aspects: ['semisquare'], layers: ['progressed'] },
  ] },
  { birth: '1960-10-01', rules: [
    { passage: 'p242', target: 'Mars', aspects: ['quincunx'], layers: [], phaseTypes: ['natal-to-progressed'] },
  ] },
  { birth: '1930-12-29', rules: [
    { passage: 'p277', target: 'Uranus', aspects: ['conjunction'], layers: ['natal'],
      phaseTypes: ['separating-year', 'natal-to-progressed'] },
  ] },
  { birth: '1939-12-01', rules: [
    { passage: 'p235', target: 'Mars', aspects: ['conjunction'], layers: ['natal'] },
    { passage: 'p238', target: 'Mars', aspects: ['sextile'], layers: ['progressed'] },
  ] },
  { birth: '1947-03-07', rules: [
    { passage: 'p239', target: 'Mars', aspects: ['square'], layers: ['natal'] },
    { passage: 'p270', target: 'Saturn', aspects: ['sextile'], layers: ['natal', 'progressed'] },
    { passage: 'p291', target: 'Venus', aspects: ['trine'], layers: ['natal'] },
  ] },
  { birth: '1928-12-03', rules: [
    { passage: 'p271', target: 'Saturn', aspects: ['square'], layers: ['natal'] },
  ] },
  { birth: '1944-01-02', rules: [
    { passage: 'p265', target: 'Neptune', aspects: ['opposition'], layers: ['natal', 'progressed'] },
  ] },
  { birth: '1935-10-25', rules: [
    { passage: 'p263', target: 'Neptune', aspects: ['sesquiquadrate'], layers: ['natal', 'progressed'] },
    { passage: 'p281', target: 'Uranus', aspects: ['square'], layers: ['natal', 'progressed'] },
  ] },
  { birth: '1939-09-19', rules: [
    { passage: 'p261', target: 'Neptune', aspects: ['square'], layers: ['natal'] },
    { passage: 'p284', target: 'Uranus', aspects: ['quincunx'], layers: ['natal'] },
  ] },
  { birth: '1946-08-26', rules: [
    { passage: 'p259', target: 'Neptune', aspects: ['semisquare'], layers: ['natal'] },
  ] },
];

for (const { birth, rules } of groups) {
  test(`Leo solar phases carry source materials for ${birth}`, () => {
    const { run, birthAt } = submit(birth);
    const matches = matchFortuneKnowledge(run).byMethod.western;
    const report = interpretFortune(run, requestForFortuneRun(run), 'leo-solar-phase');
    const { input } = buildFortuneModelContext(run, report);
    const prompt = formatFortunePrompt(input);
    for (const { passage, target, aspects, layers, phaseTypes } of rules) {
      const isRule = row => row.knowledgeId.includes('-' + passage + '-');
      const match = matches.find(isRule);
      assert.equal(match.status, 'matched', passage);
      assert.deepEqual(match.unresolvedConditions, []);
      const evidence = run.facts.filter(fact => match.sourceFactIds.includes(fact.factId));
      const birthdayEvidence = evidence.filter(row => row.normalizedPayload.phase !== 'natal-to-progressed');
      assert.deepEqual([...new Set(birthdayEvidence.map(row => row.normalizedPayload.targetKind))].sort(), layers, passage);
      if (phaseTypes) assert.deepEqual(evidence.map(row => row.normalizedPayload.phase).sort(), [...phaseTypes].sort(), passage);
      for (const fact of evidence) {
        const p = fact.normalizedPayload;
        assert.equal(fact.factType, 'leo_solar_phase');
        assert.equal(p.observed, true);
        assert.equal(p.natalTargetId, target);
        assert.ok(aspects.includes(p.aspectType), passage);
        const exactAt = Date.parse(p.formationAt), epoch = progressionEpoch(birthAt, exactAt);
        const solar = longitude('Sun', epoch);
        const targetAt = longitude(target, p.targetKind === 'natal' ? birthAt : epoch);
        const separation = Math.abs((solar - targetAt + 540) % 360 - 180);
        assert.ok(Math.abs(separation - angles[p.aspectType]) < 0.00001, passage);
        if (phaseTypes && p.phase === 'natal-to-progressed') {
          const earlier = longitude('Sun', progressionEpoch(birthAt, Date.parse(p.natalFormationAt))) - longitude(target, birthAt);
          assert.ok(Math.abs((earlier - (solar - targetAt) + 540) % 360 - 180) < 0.00001, passage);
          assert.ok(p.natalFormationAt < fact.activeFrom && fact.activeTo < p.formationAt, passage);
        }
        const bounds = p.phase === 'natal-to-progressed'
          ? { start: phaseBounds(birthAt, Date.parse(p.natalFormationAt), 'separating-year').end,
            end: phaseBounds(birthAt, exactAt, 'applying-year').start }
          : phaseBounds(birthAt, exactAt, p.phase);
        assert.equal(Date.parse(p.phaseStart), bounds.start, passage);
        assert.equal(Date.parse(p.phaseEnd), bounds.end, passage);
        assert.equal(Date.parse(fact.activeFrom), Math.max(year.start, bounds.start));
        assert.equal(Date.parse(fact.activeTo), Math.min(year.end, bounds.end));
        assert.ok(!prompt.includes(p.formationAt), passage);
      }
      const wrongTimeKey = { ...evidence[0], normalizedPayload: { ...evidence[0].normalizedPayload, yearBoundary: 'civil-year-start' } };
      const evaluation = evaluateFortuneRules('western', 'year', [wrongTimeKey]).find(isRule);
      assert.deepEqual([evaluation.required[0].hits.length, evaluation.required[0].unknown], [0, false]);
      assert.ok(prompt.includes(getFortuneKnowledgeEntry(match.knowledgeId).interpretation.classical_meaning), passage);
      if (passage === 'p242') assert.match(prompt, /本人或家人已有不适时/u);
      if (passage === 'p277') assert.match(prompt, /如果本人有意改变，生活也在调整/u);
    }
    assert.doesNotMatch(prompt, /成相前一生日年|leo_solar_phase|phaseStart|formationAt/u);
  });
}

test('the minimum three birthday years clip at real anniversaries and exclude more distant windows', () => {
  const birthAt = Date.parse('1957-09-23T00:00:00Z');
  const natal = [{ body: 'Jupiter', longitude: longitude('Jupiter', birthAt) }];
  const phasesFor = window => buildLeoSolarPhases(window, birthAt, natal)
    .filter(row => row.targetKind === 'natal' && row.aspectType === 'sextile');
  const actual = phasesFor(year)[0];
  assert.ok(actual);
  const exactYear = phaseBounds(birthAt, actual.formationAt, 'formation-year');
  const nextAnniversary = new Date(exactYear.start).getUTCFullYear();
  for (const [offset, label] of [[-2, undefined], [-1, 'applying-year'], [0, 'formation-year'],
    [1, 'separating-year'], [2, undefined]]) {
    const start = birthdayAtYear(birthAt, nextAnniversary + offset);
    const end = birthdayAtYear(birthAt, nextAnniversary + offset + 1);
    const rows = phasesFor({ start, end });
    assert.deepEqual(rows.map(row => row.phase), label ? [label] : []);
    if (label) {
      assert.deepEqual(rows.map(row => [row.start, row.end]), [[start, end]]);
      assert.ok(Math.abs(rows[0].formationAt - actual.formationAt) < 2000);
    }
  }
});

test('p242 and p277 require a verified birthday phase and reject ordinary near bands alone', () => {
  const window = civilYear => ({ start: Date.UTC(civilYear, 0, 1), end: Date.UTC(civilYear + 1, 0, 1) });
  const cases = [
    { passage: 'p242', birth: '1939-04-01', body: 'Mars', aspect: 'quincunx', layer: 'progressed', nearYear: 2025, outsideYear: 2029 },
    { passage: 'p277', birth: '1930-12-29', body: 'Uranus', aspect: 'conjunction', layer: 'natal', nearYear: 2026, outsideYear: 2022 },
  ];
  for (const { passage, birth, body, aspect, layer, nearYear, outsideYear } of cases) {
    const born = Date.parse(birth + 'T00:00:00Z');
    const birthLongitude = longitude(body, born);
    const natal = [{ body, longitude: birthLongitude }];
    const signedDifference = time => {
      const epoch = progressionEpoch(born, time);
      return longitude('Sun', epoch) - (layer === 'natal' ? birthLongitude : longitude(body, epoch));
    };
    const near = scanProgressionLongitudePair(window(nearYear), signedDifference, 0)
      .find(row => row.aspectType === aspect && row.exactTimes.length === 0);
    assert.ok(near, passage);
    const resultFor = facts => evaluateFortuneRules('western', 'year', facts)
      .find(row => row.knowledgeId.includes('-' + passage + '-')).required[0];
    const normalizedPayload = { progressedBody: 'Sun', natalTargetId: body, aspectType: near.aspectType,
      targetKind: layer, coordinate: 'ecliptic_longitude' };
    assert.equal(resultFor([{ factType: 'leo_progressed_aspect', scope: 'progressed', completeness: 'complete',
      normalizedPayload }]).hits.length, 0, passage);
    assert.ok(buildLeoSolarPhases(window(nearYear), born, natal).some(row => row.aspectType === aspect && row.targetKind === layer), passage);
    assert.ok(!buildLeoSolarPhases(window(outsideYear), born, natal).some(row => row.aspectType === aspect), passage);
  }
});

test('p274 verifies the actual Saturn quincunx in each chart and keeps Moon context conditional', () => {
  const birth = '1940-07-12';
  const { run, birthAt } = submit(birth);
  const isRule = row => row.knowledgeId.includes('-p274-');
  const matches = matchFortuneKnowledge(run).byMethod.western.find(isRule);
  assert.equal(matches.status, 'matched');
  const isQuincunx = p => p.progressedBody === 'Sun' && p.natalTargetId === 'Saturn' && p.aspectType === 'quincunx';
  const actual = run.facts.filter(row => row.factType === 'leo_solar_phase' && isQuincunx(row.normalizedPayload));
  assert.deepEqual([...new Set(actual.map(({ normalizedPayload: p }) => `${p.targetKind}:${p.phase}`))].sort(),
    ['natal:applying-year', 'natal:formation-year', 'progressed:applying-year', 'progressed:formation-year']);
  const byParent = new Map(actual.map(row => [`${row.parentSignalId}:${row.normalizedPayload.phase}`, row]));
  const assessment = evaluateFortuneRules('western', 'year', run.facts).find(isRule);
  const hits = assessment.required[0].hits;
  assert.ok(hits.length && hits.every(row => row.factType === 'leo_solar_lunar_phase'));
  assert.deepEqual(matches.sourceFactIds, hits.map(row => row.factId));
  for (const row of hits) {
    const p = row.normalizedPayload;
    const parent = byParent.get(`${row.parentSignalId}:${p.phase}`);
    assert.ok(parent && parent.activeFrom <= row.activeFrom && row.activeTo <= parent.activeTo);
    assert.equal(p.lunarQualification, undefined);
    assert.equal(p.observed, true);
    assert.equal(p.hasExactSaturnLunarFamilyContext, false);
    assert.deepEqual(p.saturnLunarFamilyContextContacts, []);
    const realEpoch = progressionEpoch(birthAt, Date.parse(p.formationAt));
    const faster = longitude('Sun', realEpoch), slower = longitude('Saturn', p.targetKind === 'natal' ? birthAt : realEpoch);
    assert.ok(Math.abs(Math.abs((faster - slower + 540) % 360 - 180) - 150) < 0.00001);
  }
  assert.ok(hits.some(({ normalizedPayload: p }) => p.contacts.some(contact => contact.target === 'Saturn')));
  assert.ok(hits.some(({ normalizedPayload: p }) => !p.contacts.some(contact => contact.target === 'Saturn')));
  const bare = hits.find(({ normalizedPayload: p }) => !p.contacts.some(contact => contact.target === 'Saturn'));
  const required = changes => evaluateFortuneRules('western', 'year', [{ ...bare,
    normalizedPayload: { ...bare.normalizedPayload, ...changes } }]).find(isRule).required[0];
  assert.deepEqual(required({}).hits, [bare]);
  for (const changes of [{ observed: false }, { phase: 'natal-to-progressed' }, { targetKind: 'other' }]) {
    const { hits: rejected, unknown } = required(changes);
    assert.deepEqual([rejected.length, unknown], [0, false]);
  }
  const unverifiedPhase = required({ phase: undefined });
  assert.deepEqual([unverifiedPhase.hits.length, unverifiedPhase.unknown], [0, true]);
  const outside = { start: Date.UTC(2024, 0, 1), end: Date.UTC(2025, 0, 1) };
  assert.ok(buildLeoSolarPhases(outside, birthAt, [{ body: 'Saturn', longitude: longitude('Saturn', birthAt) }])
    .every(phase => phase.aspectType !== 'quincunx'));
  const confirmation = changes => evaluateFortuneRules('western', 'year', [{ ...bare,
    normalizedPayload: { ...bare.normalizedPayload, ...changes } }]).find(isRule).confirmations[0];
  assert.equal(confirmation({ phase: 'formation-year' }).hits.length, 1);
  assert.equal(confirmation({ phase: 'applying-year' }).hits.length, 1);
  assert.equal(confirmation({ phase: 'separating-year' }).hits.length, 1);
  assert.equal(confirmation({ phase: 'natal-to-progressed' }).hits.length, 0);
  assert.equal(confirmation({ phase: undefined }).unknown, true);
  assert.equal(confirmation({ phase: 'formation-year', targetKind: 'other' }).hits.length, 0);
  const raw = run.facts.filter(row => row.factType === 'leo_lunar_condition' && isQuincunx(row.normalizedPayload));
  assert.ok(raw.length);
  const oldOnly = evaluateFortuneRules('western', 'year', raw).find(isRule).required[0];
  assert.deepEqual(oldOnly.hits, []);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-p274-conditional'));
  const auditedScope = '同层月相仅作同期背景，实际影响仍需结合本人和亲友的情况';
  assert.ok(formatFortuneFactAudit(input).includes(auditedScope));
  const provider = formatFortunePrompt(input);
  assert.match(provider, /三段都只参考原书所述较弱、可能并不明显的背景。亲友方面须另核同期月相/u);
  assert.match(provider, /It is a rather weak aspect, however/u);
  assert.doesNotMatch(provider, /there is danger of a loss by death under this influence|同层月相仅作同期背景/u);
});

test('p274 keeps exact same-layer weak lunar Saturn steadiness separate from the stronger context', () => {
  const cases = [
    ['1940-07-12', 'quincunx', 150, [
      ['natal', 'applying-year', '2026-06-08T11:54:24Z'],
      ['progressed', 'applying-year', '2026-06-21T03:11:25Z'],
    ]],
    ['1955-01-31', 'semisextile', 30, [
      ['natal', 'separating-year', '2026-09-04T03:35:54Z'],
    ]],
  ];
  const isRule = row => row.knowledgeId.includes('-p274-');
  for (const [birth, aspect, angle, expected] of cases) {
    const { run, birthAt } = submit(birth);
    const facts = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_solar_lunar_phase'
      && p.progressedBody === 'Sun' && p.natalTargetId === 'Saturn' && p.aspectType === 'quincunx');
    const weak = facts.filter(row => row.normalizedPayload.hasExactSaturnLunarWeakSteadinessContext);
    const matches = slices => matchFortuneKnowledge({ ...run, facts: slices }).byMethod.western.find(isRule);
    const confirmsWeak = row => row.confirmedBranches?.some(branch => /较弱的沉着/u.test(branch.conditions.join(' ')));
    for (const [layer, phase, approximate] of expected) {
      const hit = weak.find(({ activeFrom, normalizedPayload: p }) => p.targetKind === layer && p.phase === phase
        && Math.abs(Date.parse(activeFrom) - Date.parse(approximate)) < 1_000);
      assert.ok(hit, `${birth} ${layer} ${phase}`);
      const p = hit.normalizedPayload;
      assert.deepEqual(p.saturnLunarWeakSteadinessContacts,
        [{ target: 'Saturn', aspectType: aspect, exactAt: hit.activeFrom }]);
      assert.equal(p.hasExactSaturnLunarSteadinessContext, false);
      assert.equal(p.hasExactSaturnLunarFamilyContext, false);
      const at = Date.parse(hit.activeFrom);
      assert.equal(Date.parse(hit.activeTo) - at, 1_000);
      const epoch = progressionEpoch(birthAt, at);
      const separation = Math.abs((longitude('Moon', epoch) - longitude('Saturn', layer === 'natal' ? birthAt : epoch) + 540) % 360 - 180);
      assert.ok(Math.abs(separation - angle) < 0.00001);
      assert.ok(confirmsWeak(matches([hit])));
      for (const when of [at - 1, at + 1_000]) {
        const adjacent = facts.find(row => row.parentSignalId === hit.parentSignalId
          && Date.parse(row.activeFrom) <= when && when < Date.parse(row.activeTo));
        assert.ok(adjacent && adjacent.normalizedPayload.hasExactSaturnLunarWeakSteadinessContext === false);
        assert.ok(!confirmsWeak(matches([adjacent])));
      }
      for (const other of facts.filter(row => row.normalizedPayload.targetKind !== layer
        && row.activeFrom <= hit.activeFrom && hit.activeFrom < row.activeTo)) {
        assert.equal(other.normalizedPayload.hasExactSaturnLunarWeakSteadinessContext, false);
        assert.ok(!confirmsWeak(matches([other])));
      }
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-p274-weak-steadiness'));
    const audit = /同段同层次限月亮[^。]*供原书所述较弱的沉着与节制参考/u;
    assert.match(formatFortuneFactAudit(input), audit);
    const provider = formatFortunePrompt(input);
    assert.match(provider, /较弱的沉着/u);
    assert.doesNotMatch(provider, audit);
    assert.doesNotMatch(provider, /saturnLunarWeakSteadinessContacts|hasExactSaturnLunarWeakSteadinessContext|there is danger of a loss by death/u);
  }
});

test('p274 confirms family context when the exact Moon–Saturn contact also occupies its own eighth house', () => {
  const { run, birthAt } = submit('1940-07-12', 2027, 300);
  const rule = row => row.knowledgeId.includes('-p274-');
  const houseCondition = row => row.sourceConditions.some(condition => condition.includes('同层月亮实在第八宫'));
  const evaluated = evaluateFortuneRules('western', 'year', run.facts).find(rule);
  const houseBranch = evaluated.confirmations.find(houseCondition);
  assert.equal(houseBranch.hits.length, 1);
  const [hit] = houseBranch.hits;
  assert.equal(hit.normalizedPayload.targetKind, 'natal');
  assert.equal(hit.normalizedPayload.phase, 'formation-year');
  assert.equal(hit.activeFrom, '2027-07-10T02:23:41.741Z');
  assert.equal(Date.parse(hit.activeTo) - Date.parse(hit.activeFrom), 1_000);
  const exactAt = Date.parse(hit.activeFrom);
  const moonLongitude = longitude('Moon', progressionEpoch(birthAt, exactAt));
  const cusps = calculateHouseCusps(300, 0, 23.44, 'placidus');
  assert.equal(cusps.status, 'ready');
  assert.equal(zodiacalHouse(moonLongitude, cusps.cusps), 8);
  assert.ok(Math.abs(Math.abs((moonLongitude - longitude('Saturn', birthAt) + 540) % 360 - 180) - 135) < 0.00001);

  const alternatives = evaluated.required[0].hits;
  const wrongHouse = alternatives.find(fact => fact.normalizedPayload.targetKind === 'progressed'
    && fact.normalizedPayload.hasExactSaturnLunarFamilyContext);
  assert.ok(wrongHouse);
  assert.equal(wrongHouse.normalizedPayload.hasExactSaturnLunarEighthHouseContext, false);
  const housesAt = (at, layer) => run.facts.filter(fact => fact.factType === 'leo_lunar_house_context'
    && fact.normalizedPayload.targetKind === layer && fact.activeFrom <= at && at < fact.activeTo);
  assert.deepEqual(housesAt(wrongHouse.activeFrom, 'progressed').map(fact => fact.normalizedPayload.house), [6]);
  const neighbors = alternatives.filter(fact => fact.parentSignalId === hit.parentSignalId
    && (fact.activeTo === hit.activeFrom || fact.activeFrom === hit.activeTo));
  assert.equal(neighbors.length, 2);
  assert.ok(neighbors.every(fact => fact.normalizedPayload.hasExactSaturnLunarEighthHouseContext === false));

  const report = interpretFortune(run, requestForFortuneRun(run), 'leo-p274-eighth-house');
  const { input } = buildFortuneModelContext(run, report);
  const localEvidence = '该家事真点的次限月亮同时实际位于同层第八宫';
  assert.ok(formatFortuneFactAudit(input).includes(localEvidence));
  const provider = formatFortunePrompt(input);
  assert.ok(provider.includes('且成相时同层月亮实在第八宫'));
  assert.doesNotMatch(provider, /该家事真点的次限月亮|hasExactSaturnLunarEighthHouseContext|there is danger of a loss by death|2027-07-10T02:23:41/u);
});

test('p274 and p275 record only exact same-layer Moon–Saturn family context', () => {
  const samples = [
    ['p274', '1940-07-12', 2027, 'matched', 'quincunx', [
      ['natal', 'formation-year', 'sesquiquadrate', '2027-07-10T02:23:41.741Z'],
      ['progressed', 'separating-year', 'sesquiquadrate', '2027-07-21T13:10:48.083Z'],
    ]],
    ['p275', '1927-02-20', 2026, 'matched', 'opposition', [
      ['natal', 'separating-year', 'opposition', '2026-12-02T18:21:23.093Z'],
    ]],
  ];
  for (const [passage, birth, targetYear, status, solarAspect, expected] of samples) {
    const { run, birthAt } = submit(birth, targetYear);
    const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes(`-${passage}-`));
    assert.equal(result.status, status, passage);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), `leo-${passage}-saturn-family`));
    const audit = formatFortuneFactAudit(input), provider = formatFortunePrompt(input);
    const auditTail = '供原书所述家事主题参考';
    assert.ok(audit.includes(auditTail), passage);
    assert.ok(!provider.includes(auditTail), passage);
    assert.doesNotMatch(provider, /saturnLunarFamilyContextContacts|hasExactSaturnLunarFamilyContext/u);
    assert.equal(provider.includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning), status === 'matched');
    if (passage === 'p274') {
      assert.equal(result.confirmedBranches.length, 2);
      assert.match(provider, /It is a rather weak aspect, however/u);
      assert.match(provider, /any of those connected with him, the family circle, etc\./u);
      assert.doesNotMatch(provider, /if the lunar directions indicate it/u);
    }
    const hits = passage === 'p274' ? evaluateFortuneRules('western', 'year', run.facts)
      .find(row => row.knowledgeId === result.knowledgeId).required[0].hits
      : run.facts.filter(row => result.sourceFactIds.includes(row.factId));
    assert.ok(hits.length);
    const witnessed = hits.flatMap(row => {
      const p = row.normalizedPayload;
      assert.equal(row.factType, 'leo_solar_lunar_phase');
      assert.equal(p.aspectType, solarAspect);
      assert.equal(p.hasExactSaturnLunarFamilyContext, p.saturnLunarFamilyContextContacts.length > 0);
      return p.saturnLunarFamilyContextContacts.map(contact => ({ row, p, contact }));
    });
    assert.equal(witnessed.length, expected.length);
    for (const [layer, phase, aspectType, date] of expected) {
      const { row, contact } = witnessed.find(({ p }) => p.targetKind === layer && p.phase === phase);
      assert.deepEqual([contact.target, contact.aspectType], ['Saturn', aspectType]);
      assert.ok(Math.abs(Date.parse(contact.exactAt) - Date.parse(date)) < 1_000);
      assert.ok(row.activeFrom <= contact.exactAt && contact.exactAt < row.activeTo);
      const epoch = progressionEpoch(birthAt, Date.parse(contact.exactAt));
      const delta = longitude('Moon', epoch) - longitude('Saturn', layer === 'natal' ? birthAt : epoch);
      assert.ok(Math.abs(Math.abs((delta + 540) % 360 - 180) - angles[aspectType]) < 0.00001);
      const exactPhrase = '同段同层次限月亮对' + (layer === 'natal' ? '本命' : '同图次限') + '土星精确形成'
        + (aspectType === 'sesquiquadrate' ? '倍半刑相' : '对分相');
      assert.ok(audit.includes(exactPhrase), `${passage} ${layer} ${aspectType}`);
      assert.ok(!provider.includes(exactPhrase) && !provider.includes(contact.exactAt), passage);
      const wrongLayer = hits.filter(other => other.normalizedPayload.targetKind !== layer
        && other.activeFrom <= contact.exactAt && contact.exactAt < other.activeTo);
      assert.ok(wrongLayer.every(other => other.normalizedPayload.hasExactSaturnLunarFamilyContext === false));
      if (passage === 'p274') {
        const familyScope = /月亮真点所在片段可参考家事背景[^。]*已知处于困难中的亲友/u;
        assert.ok(wrongLayer.length, date);
        assert.equal(row.activeFrom, contact.exactAt);
        assert.equal(Date.parse(row.activeTo) - Date.parse(row.activeFrom), 1_000);
        const isolate = row => matchFortuneKnowledge({ ...run, facts: [row] }).byMethod.western
          .find(match => match.knowledgeId === result.knowledgeId);
        const familyCheck = rows => evaluateFortuneRules('western', 'year', rows)
          .find(match => match.knowledgeId === result.knowledgeId).confirmations[1];
        assert.deepEqual(familyCheck([row]).hits, [row]);
        assert.deepEqual(familyCheck(wrongLayer).hits, []);
        const neighbours = hits.filter(other => other.parentSignalId === row.parentSignalId
          && other.normalizedPayload.phase === phase && (other.activeTo === row.activeFrom || other.activeFrom === row.activeTo));
        assert.equal(neighbours.length, 2);
        assert.deepEqual(familyCheck(neighbours).hits, []);
        assert.match(provider, familyScope);
        assert.doesNotMatch(provider, /there is danger of a loss by death under this influence/u);
        if (phase === 'separating-year') {
          const qualified = isolate(row);
          assert.equal(qualified.status, 'matched');
          assert.deepEqual(qualified.windows, [{ start: row.activeFrom, endExclusive: row.activeTo }]);
          assert.ok(qualified.confirmedBranches.some(branch => familyScope.test(branch.conditions.join(' '))));
          assert.match(qualified.matchedSourceExcerpt, /any of those connected with him, the family circle, etc\./u);
          for (const comparison of [...neighbours, ...wrongLayer.filter(other => other.normalizedPayload.phase !== 'formation-year')]) {
            const plain = isolate(comparison);
            assert.equal(plain.status, 'matched');
            assert.match(plain.matchedSourceExcerpt, /It is a rather weak aspect/u);
            assert.doesNotMatch(plain.matchedSourceExcerpt, /the family circle/u);
          }
        }
      }
    }
    assert.ok(hits.some(({ normalizedPayload: p }) => p.contacts.some(contact => contact.nature === 'adverse')
      && !p.hasExactSaturnLunarFamilyContext));
  }
});

test('p274 confirms family context on the overlap with a same-layer lunar Saturn parallel band', () => {
  const { run, birthAt } = submit('1968-10-01', 2014);
  const isRule = row => row.knowledgeId.includes('-p274-');
  const family = evaluateFortuneRules('western', 'year', run.facts).find(isRule).required[0].hits;
  const at = Date.parse('2014-02-01T00:00:00Z');
  const active = time => family.find(row => row.normalizedPayload.targetKind === 'natal'
    && Date.parse(row.activeFrom) <= time && time < Date.parse(row.activeTo));
  const p = active(at)?.normalizedPayload;
  assert.equal(p?.hasSaturnLunarFamilyParallelContext, true);
  assert.equal(p?.hasExactSaturnLunarFamilyContext, false);
  assert.deepEqual(p?.saturnLunarFamilyParallelContact, {
    aspectType: 'parallel', coordinate: 'equatorial_declination_of_date', target: 'Saturn', targetKind: 'natal', allowedOrb: 1,
  });
  const declination = (body, instant) => {
    const date = new Date(instant), vector = GeoVector(Body[body], date, true);
    return EquatorFromVector(RotateVector(Rotation_EQJ_EQD(date), vector)).dec;
  };
  const difference = Math.abs(Math.abs(declination('Moon', Math.round(progressionEpoch(birthAt, at))))
    - Math.abs(declination('Saturn', birthAt)));
  assert.ok(0.25 < difference && difference < 1);
  const unsupported = active(Date.parse('2014-05-15T00:00:00Z'));
  assert.ok(unsupported && unsupported.normalizedPayload.hasSaturnLunarFamilyParallelContext === false);
  assert.equal(unsupported.normalizedPayload.saturnLunarFamilyParallelContact, undefined);
  const evidence = '日土梅花处于已核生日年阶段，次限月亮与同一层的土星也处于原书一度绝对赤纬平行带';
  const check = row => evaluateFortuneRules('western', 'year', [row]).find(isRule).confirmations
    .find(confirmation => confirmation.sourceConditions?.some(condition => condition.includes(evidence)));
  assert.deepEqual(check(active(at)).hits, [active(at)]);
  assert.deepEqual(check(unsupported).hits, []);
  const phase = { start: 10, end: 30, targetKind: 'natal', natalTargetId: 'Saturn', aspectType: 'quincunx' };
  const band = { start: 0, end: 20, progressedBody: 'Moon', natalTargetId: 'Saturn', targetKind: 'natal',
    aspectType: 'parallel', coordinate: 'equatorial_declination_of_date', allowedOrb: 1, exactTimes: [] };
  const review = (candidate, targetKind = 'natal') => buildLeoSolarLunarPhases([{ ...phase, targetKind }], [candidate])
    .filter(row => row.hasSaturnLunarFamilyParallelContext).map(row => [row.start, row.end]);
  assert.deepEqual(review(band), [[10, 20]]);
  for (const wrong of [{ targetKind: 'progressed' }, { allowedOrb: 0.25 }, { coordinate: 'ecliptic_longitude' },
    { start: 0, end: 10 }, { start: 30, end: 40 }]) assert.deepEqual(review({ ...band, ...wrong }), []);
  assert.deepEqual(review({ ...band, targetKind: 'progressed' }, 'progressed'), [[10, 20]]);
  assert.deepEqual(review(band, 'progressed'), []);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-p274-parallel-family'));
  assert.match(formatFortuneFactAudit(input), /同段同层次限月亮与本命土星在原书一度内实见赤纬平行，可参考家事背景/u);
  const provider = formatFortunePrompt(input);
  assert.ok(provider.includes(evidence));
  assert.doesNotMatch(provider, /saturnLunarFamilyParallelContact|hasSaturnLunarFamilyParallelContext|同段同层次限月亮与本命土星|there is danger of a loss by death/u);
});

test('p274 confirms the same progressed Moon and Saturn during the applying year without a declination equality', () => {
  const { run, birthAt } = submit('1928-03-29', 2026);
  const isRule = row => row.knowledgeId.includes('-p274-');
  const family = evaluateFortuneRules('western', 'year', run.facts).find(isRule).required[0].hits;
  const active = at => family.find(row => row.normalizedPayload.targetKind === 'progressed'
    && row.normalizedPayload.phase === 'applying-year' && row.activeFrom <= at && at < row.activeTo);
  const when = '2026-11-18T04:57:16.579Z', hit = active(when);
  assert.equal(hit?.normalizedPayload.hasSaturnLunarFamilyParallelContext, true);
  assert.equal(hit.normalizedPayload.hasExactSaturnLunarFamilyContext, false);
  assert.equal(hit.normalizedPayload.saturnLunarFamilyParallelContact.targetKind, 'progressed');
  const dec = (body, when) => {
    const date = new Date(Math.round(progressionEpoch(birthAt, Date.parse(when))));
    return Math.abs(EquatorFromVector(RotateVector(Rotation_EQJ_EQD(date), GeoVector(Body[body], date, true))).dec);
  };
  const difference = Math.abs(dec('Moon', when) - dec('Saturn', when));
  assert.ok(0.6 < difference && difference < 0.65);
  const parallel = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
    && activeFrom <= when && when < activeTo && p.targetKind === 'progressed'
    && p.progressedBody === 'Moon' && p.natalTargetId === 'Saturn' && p.aspectType === 'parallel');
  assert.ok(parallel);
  assert.ok(!run.facts.some(row => row.factType === 'leo_progressed_aspect_exact'
    && row.parentSignalId === parallel.parentSignalId));
  const isolate = fact => matchFortuneKnowledge({ ...run, facts: [fact] }).byMethod.western.find(isRule);
  const result = isolate(hit);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: hit.activeFrom, endExclusive: hit.activeTo }]);
  assert.ok(result.confirmedBranches.some(branch => /重合日期可参考家事背景[^。]*已知处于困难中的亲友/u.test(branch.conditions.join(' '))));
  const earlier = active('2026-08-01T00:00:00Z');
  assert.ok(earlier && earlier.normalizedPayload.hasSaturnLunarFamilyParallelContext === false);
  const plain = isolate(earlier);
  assert.equal(plain.status, 'matched');
  assert.match(plain.matchedSourceExcerpt, /It is a rather weak aspect/u);
  assert.doesNotMatch(plain.matchedSourceExcerpt, /the family circle/u);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-p274-progressed-family'));
  const prose = /同段同层次限月亮与同图次限土星在原书一度内实见赤纬平行，可参考家事背景/u;
  assert.match(formatFortuneFactAudit(input), prose);
  assert.doesNotMatch(formatFortunePrompt(input), prose);
  const steadinessAt = '2026-12-22T18:34:55.862Z';
  const steadiness = family.find(row => row.normalizedPayload.hasExactSaturnLunarSteadinessContext
    && row.normalizedPayload.targetKind === 'progressed' && row.normalizedPayload.phase === 'applying-year');
  assert.ok(steadiness);
  const checked = steadiness.normalizedPayload.saturnLunarSteadinessContacts;
  assert.equal(checked.length, 1);
  assert.deepEqual([checked[0].target, checked[0].aspectType], ['Saturn', 'sextile']);
  assert.ok(Math.abs(Date.parse(checked[0].exactAt) - Date.parse(steadinessAt)) < 1_000);
  assert.equal(steadiness.activeFrom, checked[0].exactAt);
  assert.equal(Date.parse(steadiness.activeTo) - Date.parse(steadiness.activeFrom), 1_000);
  const epoch = progressionEpoch(birthAt, Date.parse(checked[0].exactAt));
  const delta = Math.abs((longitude('Moon', epoch) - longitude('Saturn', epoch) + 540) % 360 - 180);
  assert.ok(Math.abs(delta - 60) < 0.00001);
  const steadyBranch = rows => evaluateFortuneRules('western', 'year', rows).find(isRule).confirmations
    .find(row => row.sourceExcerpt === 'that steadfastness and perseverance which Saturn gives');
  assert.deepEqual(steadyBranch([steadiness]).hits, [steadiness]);
  assert.deepEqual(steadyBranch([hit, earlier]).hits, []);
  const neighbours = family.filter(row => row.parentSignalId === steadiness.parentSignalId
    && (row.activeTo === steadiness.activeFrom || row.activeFrom === steadiness.activeTo));
  assert.equal(neighbours.length, 2);
  assert.deepEqual(steadyBranch(neighbours).hits, []);
  const steadinessAudit = /同段同层次限月亮对同图次限土星精确形成六合相[^。]*可参考原书所述稳定与坚持/u;
  assert.match(formatFortuneFactAudit(input), steadinessAudit);
  const provider = formatFortunePrompt(input);
  assert.match(provider, /that steadfastness and perseverance which Saturn gives/u);
  assert.match(provider, /若当事人愿意协调推进与节制，可把这段用来练习稳定与坚持/u);
  assert.doesNotMatch(provider, steadinessAudit);
  assert.doesNotMatch(provider, /saturnLunarSteadinessContacts|hasExactSaturnLunarSteadinessContext|there is danger of a loss by death/u);
});

test('p274 binds the named domestic Moon conjunction to the correct Saturn and true second in both layers', () => {
  const { run, birthAt } = submit('1928-01-30', 2026);
  const isRule = row => row.knowledgeId.includes('-p274-');
  const evaluation = evaluateFortuneRules('western', 'year', run.facts).find(isRule);
  const byRule = evaluation.required[0].hits;
  const contactFacts = byRule.flatMap(row => row.normalizedPayload.saturnLunarFamilyContextContacts
    .filter(contact => contact.aspectType === 'conjunction').map(contact => ({ row, contact })));
  assert.equal(contactFacts.length, 2);
  for (const [layer, phase, expectedAt] of [
    ['natal', 'formation-year', '2026-08-26T21:14:49.563Z'],
    ['progressed', 'applying-year', '2026-10-12T11:33:09.954Z'],
  ]) {
    const { row, contact } = contactFacts.find(({ row }) => row.normalizedPayload.targetKind === layer);
    assert.equal(row.normalizedPayload.phase, phase);
    assert.equal(contact.target, 'Saturn');
    const at = Date.parse(contact.exactAt);
    assert.ok(Math.abs(at - Date.parse(expectedAt)) < 1_000);
    assert.equal(row.activeFrom, contact.exactAt);
    assert.equal(Date.parse(row.activeTo) - at, 1_000);
    const epoch = progressionEpoch(birthAt, at);
    const saturnEpoch = layer === 'natal' ? birthAt : epoch;
    const delta = Math.abs((longitude('Moon', epoch) - longitude('Saturn', saturnEpoch) + 540) % 360 - 180);
    assert.ok(delta < 0.00001);
    const familyConfirmation = rows => evaluateFortuneRules('western', 'year', rows).find(isRule).confirmations[1];
    assert.deepEqual(familyConfirmation([row]).hits, [row]);
    const neighbours = byRule.filter(other => other.parentSignalId === row.parentSignalId
      && (other.activeTo === row.activeFrom || other.activeFrom === row.activeTo));
    const oppositeLayer = byRule.filter(other => other.normalizedPayload.targetKind !== layer
      && other.activeFrom <= contact.exactAt && contact.exactAt < other.activeTo);
    assert.equal(neighbours.length, 2);
    assert.ok(oppositeLayer.length > 0);
    assert.deepEqual(familyConfirmation([...neighbours, ...oppositeLayer]).hits, []);
  }
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-p274-conjunction'));
  const audit = formatFortuneFactAudit(input);
  const provider = formatFortunePrompt(input);
  const local = /同段同层次限月亮对(?:本命|同图次限)土星精确形成合相/u;
  assert.match(audit, local);
  assert.doesNotMatch(provider, local);
  assert.doesNotMatch(provider, /there is danger of a loss by death|saturnLunarFamilyContextContacts/u);
});

test('p262 classifies only concurrent directions of its own chart and keeps unclassified contacts visible', () => {
  const phase = { start: 0, end: 10, phaseStart: 0, phaseEnd: 10, formationAt: 5,
    phase: 'formation-year', natalTargetId: 'Neptune', aspectType: 'trine', targetKind: 'natal' };
  const direction = (start, end, progressedBody, natalTargetId, aspectType, targetKind = 'natal') =>
    ({ start, end, progressedBody, natalTargetId, aspectType, targetKind });
  const rows = buildLeoSolarLunarPhases([phase], [
    direction(0, 6, 'Venus', 'Jupiter', 'sextile'),
    direction(4, 8, 'Mars', 'Saturn', 'square'),
    direction(2, 6, 'Mars', 'Neptune', 'quincunx'),
    direction(0, 10, 'Sun', 'Neptune', 'trine'),
    direction(0, 10, 'Venus', 'Jupiter', 'sextile', 'progressed'),
    direction(0, 10, 'Moon', 'Mars', 'square'),
  ]);
  assert.deepEqual(rows.map(row => [row.start, row.end, row.directionSupportState, row.hasUnreviewedOtherDirection]), [
    [0, 2, 'favourable', false], [2, 4, 'favourable', true], [4, 6, 'mixed', true],
    [6, 8, 'adverse', false], [8, 10, 'none', false],
  ]);
  assert.equal(rows[2].sameLayerLunarState, 'all_adverse');
  assert.deepEqual(rows[2].supportingDirections.map(row => [row.body, row.target, row.passage]),
    [['Venus', 'Jupiter', 'p296'], ['Mars', 'Saturn', 'p061']]);
  const wide = { ...phase, end: 10_000, phaseEnd: 10_000 };
  const support = { ...direction(0, 10_000, 'Sun', 'Jupiter', 'sextile', 'progressed'),
    coordinate: 'ecliptic_longitude', exactTimes: [2_000, 4_000, 7_000, wide.end] };
  const passes = buildLeoSolarLunarPhases([wide], [support,
    direction(4_000, 5_000, 'Sun', 'Saturn', 'square', 'progressed'),
    direction(7_000, 8_000, 'Mars', 'Neptune', 'quincunx'),
  ]);
  assert.deepEqual(passes.filter(row => row.neptuneTrineSupportType === 'cross-layer-solar')
    .map(row => [row.start, row.end]), [[2_000, 3_000]]);
  assert.ok(passes.every(row => row.directionSupportState === 'none'));
  const simultaneous = buildLeoSolarLunarPhases([wide], [support,
    { ...direction(0, 10_000, 'Moon', 'Neptune', 'sextile'), coordinate: 'ecliptic_longitude', exactTimes: [2_000] },
  ]).find(row => row.start === 2_000);
  assert.equal(simultaneous.neptuneTrineSupportType, 'lunar-sextile');
  assert.equal(simultaneous.hasExactNeptuneTrineCrossLayerSolarSupport, true);
  const lunarContact = (start, end, target, aspect, targetKind = 'natal') =>
    ({ ...direction(start, end, 'Moon', target, aspect, targetKind), coordinate: 'ecliptic_longitude',
      exactTimes: target === 'Neptune' ? [start] : [] });
  const mixedMoon = buildLeoSolarLunarPhases([wide], [
    lunarContact(1_000, 3_000, 'Neptune', 'sextile'), lunarContact(4_000, 6_000, 'Neptune', 'trine'),
    lunarContact(1_000, 3_000, 'Venus', 'trine'), lunarContact(1_000, 3_000, 'Saturn', 'square'),
    lunarContact(4_000, 6_000, 'Saturn', 'square', 'progressed'),
  ]);
  const mixed = mixedMoon.find(row => row.start === 1_000);
  assert.deepEqual([mixed.sameLayerLunarState, mixed.lunarAdverseTargets, mixed.neptuneTrineSupportType],
    ['mixed', ['Saturn'], 'none']);
  assert.equal(mixed.hasAdverseNeptuneTrineMoonContact, true);
  assert.equal(mixed.neptuneTrineLunarSupportContacts[0].aspectType, 'sextile');
  const local = describeFortuneFact({ method: 'western', type: 'leo_solar_lunar_phase',
    data: { ...mixed, profile: 'leo-1906-solar-lunar-phases-v1' } }, String);
  assert.match(local, /同层另有已核偏难月相，月海真点仅供核对/u);
  assert.doesNotMatch(local, /供诗乐与信念主题参考/u);
  const otherLayer = mixedMoon.find(row => row.start === 4_000);
  assert.deepEqual([otherLayer.lunarAdverseTargets, otherLayer.neptuneTrineSupportType], [[], 'lunar-trine']);
  assert.equal(otherLayer.hasAdverseNeptuneTrineMoonContact, false);
});

test('p262 admits an actual same-layer lunar support second for the original nonfinancial themes', () => {
  const { run, birthAt } = submit('1969-05-23', 2027);
  const isRule = row => row.knowledgeId.includes('-p262-');
  const result = matchFortuneKnowledge(run).byMethod.western.find(isRule);
  const rows = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_solar_lunar_phase'
    && p.progressedBody === 'Sun' && p.natalTargetId === 'Neptune' && p.aspectType === 'trine');
  const point = rows.find(({ normalizedPayload: p }) => p.targetKind === 'progressed' && p.neptuneTrineSupportType === 'lunar-sextile');
  assert.ok(point);
  const p = point.normalizedPayload;
  const at = Date.parse(point.activeFrom);
  assert.ok(Math.abs(at - Date.parse('2027-04-18T09:09:31.838Z')) < 1_000);
  assert.equal(Date.parse(point.activeTo), at + 1_000);
  assert.equal(p.phase, 'separating-year');
  assert.equal(p.directionSupportState, 'none');
  assert.equal(p.hasUnreviewedOtherDirection, true);
  assert.equal(p.hasNatalNeptuneDevotionalContact, true);
  assert.deepEqual(p.neptuneTrineLunarSupportContacts,
    [{ target: 'Neptune', aspectType: 'sextile', exactAt: point.activeFrom }]);
  assert.equal(result.status, 'partial');
  assert.ok(result.sourceFactIds.includes(point.factId));
  const epoch = progressionEpoch(birthAt, at);
  const separation = Math.abs((longitude('Moon', epoch) - longitude('Neptune', epoch) + 540) % 360 - 180);
  assert.ok(Math.abs(separation - 60) < 0.00001);
  const solarEpoch = progressionEpoch(birthAt, Date.parse(p.formationAt));
  const solarSeparation = Math.abs((longitude('Sun', solarEpoch) - longitude('Neptune', solarEpoch) + 540) % 360 - 180);
  assert.ok(Math.abs(solarSeparation - 120) < 0.00001);
  for (const time of [at - 1, at + 1_000]) {
    const nearby = rows.find(row => row.normalizedPayload.targetKind === p.targetKind
      && Date.parse(row.activeFrom) <= time && time < Date.parse(row.activeTo));
    assert.equal(nearby?.normalizedPayload.neptuneTrineSupportType, 'none');
    assert.ok(!result.sourceFactIds.includes(nearby.factId));
  }
  const oppositeLayer = rows.filter(row => row.normalizedPayload.targetKind === 'natal'
    && row.activeFrom <= point.activeFrom && point.activeFrom < row.activeTo);
  assert.ok(oppositeLayer.length && oppositeLayer.every(row => row.normalizedPayload.neptuneTrineLunarSupportContacts.length === 0));
  const assess = changes => evaluateFortuneRules('western', 'year', [{ ...point, normalizedPayload: { ...p, ...changes } }])
    .find(isRule).required[0];
  const neutral = { hasNatalNeptuneDevotionalContact: false, hasNatalNeptuneCreativeTestimony: false,
    hasNatalMercuryVenusArtisticContact: false, hasNatalSunNeptuneCreativeContact: false };
  assert.deepEqual(assess({ ...neutral, natalFinancialState: 'support', hasNatalFinancialRulerAffliction: false }).hits, []);
  assert.equal(assess({ ...neutral, hasNatalNeptuneCreativeTestimony: true }).hits.length, 1);
  assert.deepEqual(assess({ ...neutral, hasNatalNeptuneCreativeTestimony: true, neptuneTrineSupportType: 'lunar-trine' }).hits, []);
  assert.deepEqual(assess({ directionSupportState: 'mixed' }).hits, []);
  assert.equal(assess({ neptuneTrineSupportType: undefined }).unknown, true);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-p262-lunar'));
  const audit = '同段同层次限月亮对同图次限海王星精确形成六合相';
  const local = formatFortuneFactAudit(input);
  const provider = formatFortunePrompt(input);
  assert.ok(local.includes(audit) && local.includes('供诗乐与信念主题参考'));
  assert.ok(!provider.includes(audit));
  assert.doesNotMatch(provider, /neptuneTrineLunarSupportContacts|neptuneTrineSupportType/u);
});

test('p262 keeps a real Jupiter sextile as evidence when a concurrent Venus–Mars opposition blocks the financial branch', () => {
  const { run, birthAt } = submit('1969-05-23');
  const isRule = row => row.knowledgeId.includes('-p262-');
  const phaseRows = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_solar_lunar_phase'
    && p.progressedBody === 'Sun' && p.natalTargetId === 'Neptune' && p.aspectType === 'trine');
  const point = phaseRows.find(({ normalizedPayload: p }) =>
    p.targetKind === 'progressed' && p.neptuneTrineSupportType === 'cross-layer-solar');
  assert.ok(point);
  const p = point.normalizedPayload;
  const at = Date.parse(point.activeFrom);
  assert.ok(Math.abs(at - Date.parse('2026-05-06T00:03:54.338Z')) < 1_000);
  assert.equal(Date.parse(point.activeTo), at + 1_000);
  assert.equal(p.phase, 'formation-year');
  assert.deepEqual([p.directionSupportState, p.hasUnreviewedOtherDirection, p.natalFinancialState, p.hasNatalFinancialRulerAffliction],
    ['none', false, 'support', false]);
  assert.equal(p.hasNeptuneTrineVenusMarsOpposition, true);
  assert.deepEqual(p.neptuneTrineCrossLayerSolarContacts, [{ body: 'Sun', target: 'Jupiter', targetKind: 'natal',
    aspectType: 'sextile', nature: 'favourable', passage: 'p228', exactAt: point.activeFrom }]);
  const epoch = progressionEpoch(birthAt, at);
  const separation = targetAt => Math.abs((longitude('Sun', epoch) - longitude('Jupiter', targetAt) + 540) % 360 - 180);
  assert.ok(Math.abs(separation(birthAt) - 60) < 0.00001);
  assert.ok(Math.abs(separation(epoch) - 60) > 1);
  const venusMars = Math.abs((longitude('Venus', epoch) - longitude('Mars', birthAt) + 540) % 360 - 180);
  assert.ok(Math.abs(venusMars - 180) <= progressionPolicy.longitudeOrb);
  const formationEpoch = progressionEpoch(birthAt, Date.parse(p.formationAt));
  const neptune = Math.abs((longitude('Sun', formationEpoch) - longitude('Neptune', formationEpoch) + 540) % 360 - 180);
  assert.ok(Math.abs(neptune - 120) < 0.00001);
  const result = matchFortuneKnowledge(run).byMethod.western.find(isRule);
  assert.equal(result.status, 'partial');
  assert.ok(!result.sourceFactIds.includes(point.factId));
  const moonBoundary = '2026-07-20T20:28:39.031Z';
  const natalMajor = phaseRows.filter(({ normalizedPayload: p }) =>
    p.targetKind === 'natal' && p.neptuneTrineSupportType === 'major');
  const before = natalMajor.find(row => row.activeTo === moonBoundary);
  const blocked = natalMajor.find(row => row.activeFrom === moonBoundary);
  assert.ok(before && blocked);
  assert.deepEqual([before, blocked].map(({ normalizedPayload: p }) =>
    [p.sameLayerLunarState, p.hasAdverseNeptuneTrineMoonContact, p.natalFinancialState, p.hasNatalFinancialRulerAffliction]), [
    ['all_favourable', false, 'support', false],
    ['mixed', true, 'support', false],
  ]);
  const saturnEpoch = progressionEpoch(birthAt, Date.parse(moonBoundary));
  const moonSaturnAngle = Math.abs((longitude('Moon', saturnEpoch) - longitude('Saturn', birthAt) + 540) % 360 - 180);
  assert.ok(Math.abs(Math.abs(moonSaturnAngle - 135) - progressionPolicy.longitudeOrb) < 0.00001);
  assert.ok(result.sourceFactIds.includes(before.factId));
  assert.ok(!result.sourceFactIds.includes(blocked.factId));
  const blockedRequired = changes => evaluateFortuneRules('western', 'year', [
    { ...blocked, normalizedPayload: { ...blocked.normalizedPayload, ...changes } },
  ]).find(isRule).required[0];
  assert.deepEqual([blockedRequired({}).hits.length, blockedRequired({}).unknown], [0, false]);
  // Keeping the rest of this real mixed slice unchanged shows that the former gate would have admitted it.
  assert.equal(blockedRequired({ hasAdverseNeptuneTrineMoonContact: false }).hits.length, 1);
  assert.equal(blockedRequired({ hasAdverseNeptuneTrineMoonContact: undefined }).unknown, true);
  for (const time of [at - 1, at + 1_000]) {
    const neighbor = phaseRows.find(row => row.normalizedPayload.targetKind === 'progressed'
      && Date.parse(row.activeFrom) <= time && time < Date.parse(row.activeTo));
    assert.equal(neighbor?.normalizedPayload.neptuneTrineSupportType, 'none');
    assert.ok(!result.sourceFactIds.includes(neighbor.factId));
  }
  const assess = changes => evaluateFortuneRules('western', 'year', [{ ...point,
    normalizedPayload: { ...p, hasNeptuneTrineVenusMarsOpposition: false, ...changes } }])
    .find(isRule).required[0];
  assert.equal(assess({}).hits.length, 1);
  assert.equal(assess({ hasNeptuneTrineVenusMarsOpposition: true }).hits.length, 0);
  assert.equal(assess({ hasNeptuneTrineVenusMarsOpposition: undefined }).unknown, true);
  assert.equal(assess({ hasNatalFinancialRulerAffliction: true }).hits.length, 0);
  assert.equal(assess({ natalFinancialState: 'mixed' }).hits.length, 0);
  assert.equal(assess({ hasExactNeptuneTrineCrossLayerSolarSupport: false }).hits.length, 0);
  assert.equal(assess({ hasAdverseNeptuneTrineMoonContact: true }).hits.length, 0);
  assert.equal(assess({ hasUnreviewedOtherDirection: true }).hits.length, 0);
  assert.equal(assess({ directionSupportState: 'adverse' }).hits.length, 0);
  const pending = assess({ hasUnreviewedOtherDirection: undefined });
  assert.deepEqual([pending.hits.length, pending.unknown], [0, true]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-p262-cross-layer'));
  const audit = '同一移动太阳在另一盘层精确六合木星，此真点仅供核对';
  const financeObstacle = '同期次限金星对冲本命火星，原书另列财务阻力';
  const blockedAudit = '同层已见偏难月相，本片段只保留同期推运供核对';
  const local = formatFortuneFactAudit(input);
  assert.ok(local.includes(audit) && local.includes(financeObstacle) && local.includes(blockedAudit));
  const provider = formatFortunePrompt(input);
  assert.ok(!provider.includes(audit));
  assert.ok(!provider.includes(blockedAudit));
  assert.ok(!provider.includes(financeObstacle));
  assert.doesNotMatch(provider, /hasExactNeptuneTrineCrossLayerSolarSupport|neptuneTrineCrossLayerSolarContacts|hasAdverseNeptuneTrineMoonContact|hasNeptuneTrineVenusMarsOpposition/u);
});

test('p262 screens a verified natal second-ruler affliction to a planet in the twelfth only for finances', () => {
  const passage = row => row.knowledgeId.includes('-p262-');
  const instant = '2026-10-19T00:00:00.000Z';
  const latitude = 15;
  const artisticConditions = {
    hasNatalNeptuneCreativeTestimony: false, hasNatalNeptuneDevotionalContact: false,
    hasNatalMercuryVenusArtisticContact: false, hasNatalSunNeptuneCreativeContact: false,
  };
  const cases = [];
  for (const [armc, house] of [[26, 12], [27, 11]]) {
    const { run, birthAt } = submit('1950-03-23', 2026, armc, latitude);
    const fact = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: p }) =>
      factType === 'leo_solar_lunar_phase' && p.natalTargetId === 'Neptune' && p.aspectType === 'trine'
      && p.targetKind === 'natal' && activeFrom <= instant && instant < activeTo);
    assert.ok(fact);
    const p = fact.normalizedPayload;
    const actual = calculateHouseCusps(armc, latitude, 23.44, 'placidus');
    assert.equal(actual.status, 'ready');
    assert.equal(readLeoSignRuler(Math.floor(actual.cusps[1] / 30)), 'Sun');
    assert.equal(zodiacalHouse(longitude('Uranus', birthAt), actual.cusps), house);
    const natalSquare = Math.abs(Math.abs((longitude('Sun', birthAt) - longitude('Uranus', birthAt) + 540) % 360 - 180) - 90);
    assert.ok(natalSquare > 0.78 && natalSquare < 0.79);
    const context = p.natalFinancialContext;
    assert.deepEqual(context.anchors, [{ body: 'Saturn', house: 2 }]);
    assert.ok(p.supportingDirections.length > 0
      && p.supportingDirections.every(({ targetKind, nature }) => targetKind === 'natal' && nature === 'favourable'));
    assert.deepEqual([p.natalFinancialState, p.hasNatalFinancialRulerAffliction, p.neptuneTrineSupportType,
      p.hasAdverseNeptuneTrineMoonContact, p.hasNeptuneTrineVenusMarsOpposition, p.hasUnreviewedOtherDirection],
    ['support', false, 'major', false, false, true]);
    const blocked = house === 12;
    assert.equal(p.hasNatalSecondRulerTwelfthHouseAffliction, blocked);
    const witnesses = context.secondRulerTwelfthHouseAfflictions;
    assert.deepEqual(witnesses.map(({ difference, ...geometry }) => geometry), blocked
      ? [{ ruler: 'Sun', afflicted: 'Uranus', house: 12, aspect: 'square', orb: 8 }] : []);
    if (blocked) assert.ok(Math.abs(witnesses[0].difference - natalSquare) < 1e-7);
    const from = changes => evaluateFortuneRules('western', 'year', [{
      ...fact, normalizedPayload: { ...p, ...artisticConditions, ...changes },
    }]).find(passage).required[0];
    assert.equal(from({}).hits.length, Number(!blocked));
    assert.equal(from({ hasNatalSecondRulerTwelfthHouseAffliction: false }).hits.length, 1);
    assert.deepEqual([from({ hasNatalSecondRulerTwelfthHouseAffliction: undefined }).hits.length,
      from({ hasNatalSecondRulerTwelfthHouseAffliction: undefined }).unknown], [0, true]);
    const isolated = { ...run, facts: [fact] };
    assert.ok(matchFortuneKnowledge(isolated).byMethod.western.find(passage).sourceFactIds.includes(fact.factId));
    const report = interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-p262-financial-counterevidence');
    const { input } = buildFortuneModelContext(isolated, report);
    const financialCounterevidence = /本命第二宫主太阳与实居第十二宫的天王星形成.*原书另列财务阻力/u;
    assert.equal(financialCounterevidence.test(formatFortuneFactAudit(input)), blocked);
    assert.doesNotMatch(formatFortunePrompt(input), /本命第二宫主太阳与实居第十二宫|hasNatalSecondRulerTwelfthHouseAffliction/u);
    cases.push([fact.activeFrom, fact.activeTo, p.formationAt, p.supportingDirections]);
  }
  assert.deepEqual(cases[0], cases[1]);
});

test('p262 checks personal and financial branches against separate natal evidence and the same timing', () => {
  const { run, birthAt } = submit('1931-02-24', 1993);
  const isRule = row => row.knowledgeId.includes('-p262-');
  const rows = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'leo_solar_lunar_phase'
    && p.progressedBody === 'Sun' && p.natalTargetId === 'Neptune' && p.aspectType === 'trine' && p.targetKind === 'natal');
  const at = instant => rows.find(row => row.activeFrom <= instant && instant < row.activeTo);
  const samples = [['1993-01-10T00:00:00.000Z', true], ['1993-02-20T00:00:00.000Z', false]];
  const separation = (body, first, target, second) => Math.abs((longitude(body, first) - longitude(target, second) + 540) % 360 - 180);
  const match = fact => matchFortuneKnowledge({ ...run, facts: [fact] }).byMethod.western.find(isRule);
  const financialExcerpt = 'unless the aspects at birth preclude such good fortune';
  for (const [instant, blocked] of samples) {
    const row = at(instant);
    assert.ok(row, instant);
    const p = row.normalizedPayload;
    assert.deepEqual([p.directionSupportState, p.neptuneTrineSupportType, p.hasUnreviewedOtherDirection,
      p.hasAdverseNeptuneTrineMoonContact, p.hasOppositeLayerNeptuneTrineAdverseContact,
      p.hasOppositeLayerNeptuneTrineUnreviewedContact],
    ['favourable', 'major', false, false, false, blocked], instant);
    assert.ok(['none', 'all_favourable'].includes(p.sameLayerLunarState));
    assert.deepEqual(p.supportingDirections, [{ body: 'Mercury', target: 'Jupiter', targetKind: 'natal',
      aspectType: 'sextile', nature: 'favourable', passage: 'p080' }]);
    const epoch = progressionEpoch(birthAt, Date.parse(instant));
    assert.ok(Math.abs(separation('Mercury', epoch, 'Jupiter', birthAt) - 60) < 1);
    assert.equal(Math.abs(separation('Moon', epoch, 'Saturn', epoch) - 150) <= progressionPolicy.longitudeOrb, blocked);
    const formation = progressionEpoch(birthAt, Date.parse(p.formationAt));
    assert.ok(Math.abs(separation('Sun', formation, 'Neptune', birthAt) - 120) < 0.00001);
    const result = match(row);
    assert.equal(result.status, blocked ? 'partial' : 'matched', instant);
    assert.deepEqual([p.natalFinancialState, p.hasNatalFinancialRulerAffliction, p.hasNatalSecondRulerTwelfthHouseAffliction,
      p.hasNeptuneTrineVenusMarsOpposition], ['support', false, false, false]);
    assert.equal(result.matchedSourceExcerpt?.includes(financialExcerpt) ?? false, !blocked);
    const qualifiedFinance = result.confirmedBranches?.find(branch => branch.conditions.some(condition => condition.includes('财务支持相位')));
    if (!blocked) {
      assert.deepEqual(qualifiedFinance?.windows, [{ start: row.activeFrom, endExclusive: row.activeTo }]);
      assert.ok(p.natalFinancialContext.financialTestimonies.some(({ first, body, aspect, involvesSecondOrTenthRuler }) =>
        first === 'Venus' && body === 'Moon' && aspect === 'trine' && involvesSecondOrTenthRuler));
      assert.ok(Math.abs(separation('Venus', birthAt, 'Moon', birthAt) - 120) < 8);
      for (const changes of [{ natalFinancialState: 'none' }, { natalFinancialState: 'mixed' },
        { hasNeptuneTrineVenusMarsOpposition: true }, { hasNatalSecondRulerTwelfthHouseAffliction: true },
        { hasNatalFinancialRulerAffliction: undefined }]) {
        const adjusted = match({ ...row, normalizedPayload: { ...p, ...changes } });
        assert.equal(adjusted.status, 'matched');
        assert.ok(!adjusted.matchedSourceExcerpt.includes(financialExcerpt));
      }
    }
    const { input } = buildFortuneModelContext({ ...run, facts: [row] },
      interpretFortune({ ...run, facts: [row] }, requestForFortuneRun(run), 'leo-p262-personal-themes'));
    const provider = formatFortunePrompt(input);
    assert.equal(/若本人确在从事诗歌或音乐，可参考原书所述的创作灵感/u.test(provider), !blocked);
    assert.equal(/若已有信念实践，可参考投入和体会/u.test(provider), !blocked);
    assert.doesNotMatch(provider, /Riches and favours|hasOppositeLayerNeptuneTrine(Adverse|Unreviewed)Contact|natalFinancialState/u);
    if (blocked) continue;
    assert.deepEqual(result.windows, [{ start: row.activeFrom, endExclusive: row.activeTo }]);
    const evaluate = changes => evaluateFortuneRules('western', 'year', [{ ...row,
      normalizedPayload: { ...p, ...changes } }]).find(isRule).confirmations[0];
    assert.equal(evaluate({ sameLayerLunarState: 'conditional' }).hits.length, 0);
    assert.equal(evaluate({ hasUnreviewedOtherDirection: true }).hits.length, 0);
    assert.equal(evaluate({ hasOppositeLayerNeptuneTrineAdverseContact: undefined }).unknown, true);
    assert.equal(evaluate({ hasOppositeLayerNeptuneTrineAdverseContact: true }).hits.length, 0);
    assert.equal(evaluate({ hasOppositeLayerNeptuneTrineUnreviewedContact: undefined }).unknown, true);
    assert.equal(evaluate({ hasOppositeLayerNeptuneTrineUnreviewedContact: true }).hits.length, 0);
  }
  const lastUnreviewed = at('1993-01-10T00:00:00.000Z');
  const firstTestedClear = at(lastUnreviewed.activeTo);
  assert.equal(lastUnreviewed.activeTo, '1993-02-16T09:29:30.886Z');
  assert.equal(firstTestedClear.normalizedPayload.hasOppositeLayerNeptuneTrineUnreviewedContact, false);

  const alternative = submit('1931-02-24', 1993, 30, 15).run;
  const mixed = alternative.facts.find(({ factType, normalizedPayload: p, activeFrom, activeTo }) =>
    factType === 'leo_solar_lunar_phase' && p.progressedBody === 'Sun' && p.natalTargetId === 'Neptune'
    && p.aspectType === 'trine' && p.targetKind === 'natal' && activeFrom === firstTestedClear.activeFrom && activeTo === firstTestedClear.activeTo);
  assert.ok(mixed);
  assert.equal(mixed.normalizedPayload.natalFinancialState, 'mixed');
  assert.ok(mixed.normalizedPayload.natalFinancialContext.financialTestimonies.some(({ first, body, aspect }) =>
    first === 'Neptune' && body === 'Sun' && aspect === 'opposition'));
  const independent = matchFortuneKnowledge({ ...alternative, facts: [mixed] }).byMethod.western.find(isRule);
  assert.equal(independent.status, 'matched');
  assert.match(independent.matchedSourceExcerpt, /more spiritually inclined/u);
  assert.ok(!independent.matchedSourceExcerpt.includes(financialExcerpt));
});

test('a Jupiter arc follows two real contacts of the same oriented square across years and enters the report', () => {
  const { run, birthAt } = submit('1939-04-01');
  const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-p229-'));
  assert.equal(result.status, 'matched');
  const evidence = run.facts.filter(fact => result.sourceFactIds.includes(fact.factId));
  assert.ok(evidence.length > 0);
  const [row] = evidence;
  const p = row.normalizedPayload;
  assert.equal(p.phase, 'natal-to-progressed');
  assert.equal(p.targetKind, 'progressed');
  assert.deepEqual([row.activeFrom, row.activeTo], ['2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z']);
  assert.deepEqual([p.phaseStart, p.phaseEnd], ['2014-04-01T00:00:00.000Z', '2028-04-01T00:00:00.000Z']);
  const first = progressionEpoch(birthAt, Date.parse(p.natalFormationAt));
  const second = progressionEpoch(birthAt, Date.parse(p.formationAt));
  const signedSeparation = (first, second) => (first - second + 540) % 360 - 180;
  const natalContact = signedSeparation(longitude('Sun', first), longitude('Jupiter', birthAt));
  const progressedContact = signedSeparation(longitude('Sun', second), longitude('Jupiter', second));
  assert.ok(Math.abs(Math.abs(natalContact) - 90) < 0.00001);
  assert.ok(Math.abs(natalContact - progressedContact) < 0.00001);
  for (const bound of [p.phaseStart, p.phaseEnd]) {
    const start = Date.parse(bound), end = start + 86_400_000;
    const natal = [{ body: 'Jupiter', longitude: longitude('Jupiter', birthAt) }];
    const segment = (from, to) => buildLeoSolarPhases({ start: from, end: to }, birthAt, natal)
      .filter(row => row.aspectType === 'square').map(row => row.phase);
    const before = segment(start - 86_400_000, start);
    const after = segment(start, end);
    assert.deepEqual([before, after], bound === p.phaseStart ? [['separating-year'], ['natal-to-progressed']]
      : [['natal-to-progressed'], ['applying-year']]);
  }
  const report = interpretFortune(run, requestForFortuneRun(run), 'leo-solar-bridge');
  const { input } = buildFortuneModelContext(run, report);
  const audit = formatFortuneFactAudit(input), provider = formatFortunePrompt(input);
  assert.match(audit, /正接续至对同图次限木星的同一相位/u);
  assert.ok(provider.includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning));
  assert.doesNotMatch(provider, /正接续至|natalFormationAt|2012-04-16/u);
});

test('outer-planet continuation also respects both exact endpoints and rejects a reversed order', () => {
  const directedArc = (solar, target) => (solar - target + 540) % 360 - 180;
  for (const [born, body, aspectType] of [['1938-03-05', 'Saturn', 'sextile'],
    ['1939-04-01', 'Uranus', 'semisquare'], ['1911-04-21', 'Neptune', 'semisextile']]) {
    const birthAt = Date.parse(born + 'T00:00:00Z'), natalLongitude = longitude(body, birthAt);
    const rows = buildLeoSolarPhases(year, birthAt, [{ body, longitude: natalLongitude }])
      .filter(row => row.phase === 'natal-to-progressed' && row.aspectType === aspectType);
    assert.equal(rows.length, 1, body);
    const [row] = rows;
    const first = progressionEpoch(birthAt, row.natalFormationAt), second = progressionEpoch(birthAt, row.formationAt);
    const natal = directedArc(longitude('Sun', first), natalLongitude);
    const progressed = directedArc(longitude('Sun', second), longitude(body, second));
    assert.ok(Math.abs(Math.abs(natal) - angles[aspectType]) < 0.00001, body);
    assert.ok(Math.abs(natal - progressed) < 0.00001, body);
    assert.ok(row.natalFormationAt < row.start && row.start < row.end && row.end < row.formationAt);
    assert.equal(row.phaseStart, phaseBounds(birthAt, row.natalFormationAt, 'separating-year').end, body);
    assert.equal(row.phaseEnd, phaseBounds(birthAt, row.formationAt, 'applying-year').start, body);
  }
  const birthAt = Date.parse('1910-09-18T00:00:00Z'), natal = longitude('Neptune', birthAt);
  const middle = progressionEpoch(birthAt, (year.start + year.end) / 2);
  const solar = longitude('Sun', middle), moving = longitude('Neptune', middle);
  assert.ok(Object.values(angles).some(angle => [angle, -angle].some(offset =>
    directedArc(solar, natal + offset) < 0 && directedArc(solar, moving + offset) > 0)));
  assert.ok(!buildLeoSolarPhases(year, birthAt, [{ body: 'Neptune', longitude: natal }])
    .some(row => row.phase === 'natal-to-progressed'));
});

test('Sun–Moon parallel uses the contemporaneous equator and allows opposite declination hemispheres', () => {
  const { run, birthAt } = submit('1963-09-01');
  const result = matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-p256-'));
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.unresolvedConditions, []);
  const evidence = run.facts.filter(fact => result.sourceFactIds.includes(fact.factId));
  assert.ok(evidence.length > 0);
  const declination = (body, at) => {
    const date = new Date(at), vector = GeoVector(Body[body], date, true);
    return EquatorFromVector(RotateVector(Rotation_EQJ_EQD(date), vector)).dec;
  };
  for (const row of evidence) {
    const p = row.normalizedPayload;
    assert.equal(p.aspectType, 'parallel');
    assert.equal(p.allowedOrb, 1);
    const middle = (Date.parse(row.activeFrom) + Date.parse(row.activeTo)) / 2;
    const epoch = progressionEpoch(birthAt, middle);
    const sun = declination('Sun', epoch), moon = declination('Moon', p.targetKind === 'natal' ? birthAt : epoch);
    assert.ok(Math.abs(Math.abs(sun) - Math.abs(moon)) <= 1);
  }
  const sample = Date.UTC(2026, 0, 18);
  assert.ok(evidence.some(row => row.normalizedPayload.targetKind === 'progressed'
    && Date.parse(row.activeFrom) <= sample && sample < Date.parse(row.activeTo)));
  const sampleEpoch = progressionEpoch(birthAt, sample);
  const sun = declination('Sun', sampleEpoch), moon = declination('Moon', sampleEpoch);
  assert.ok(sun * moon < 0);
  assert.ok(Math.abs(sun + moon) > 0.25 && Math.abs(sun + moon) < 1);
  const wrongOrb = { ...evidence[0], normalizedPayload: { ...evidence[0].normalizedPayload, allowedOrb: 0.25 } };
  const invalid = evaluateFortuneRules('western', 'year', [wrongOrb]).find(row => row.knowledgeId.includes('-p256-'));
  assert.deepEqual([invalid.required[0].hits.length, invalid.required[0].unknown], [0, false]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-solar-parallel'));
  assert.ok(formatFortunePrompt(input).includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning));
});

test('solar phases can sample the birth boundary and clamp non-leap anniversaries to February 28', () => {
  for (const born of ['2025-02-01', '1988-02-29']) {
    const birthAt = Date.parse(born + 'T00:00:00Z');
    const natal = ['Moon', 'Jupiter'].map(body => ({ body, longitude: longitude(body, birthAt) }));
    const rows = buildLeoSolarPhases(year, birthAt, natal).filter(row => row.phase !== 'natal-to-progressed');
    assert.ok(rows.length);
    for (const row of rows) {
      const bounds = phaseBounds(birthAt, row.formationAt, row.phase);
      assert.deepEqual([row.phaseStart, row.phaseEnd], [bounds.start, bounds.end]);
      assert.ok(row.phaseStart >= birthAt);
    }
  }
});

test('solar lunar qualifications split at each contact boundary and retain mixed, unknown and wrong-layer cases', () => {
  const phase = { start: 0, end: 100, phaseStart: -10, phaseEnd: 180, formationAt: 110,
    phase: 'applying-year', natalTargetId: 'Uranus', aspectType: 'sesquiquadrate', targetKind: 'natal' };
  const band = (start, end, natalTargetId, aspectType, targetKind = 'natal') =>
    ({ start, end, natalTargetId, aspectType, targetKind, progressedBody: 'Moon', coordinate: 'ecliptic_longitude' });
  const rows = buildLeoSolarLunarPhases([phase], [
    band(10, 40, 'Venus', 'trine'), band(20, 45, 'Saturn', 'square'), band(50, 70, 'Neptune', 'sextile'),
    band(45, 60, 'Venus', 'trine', 'progressed'), band(100, 120, 'Saturn', 'square'),
  ]);
  assert.deepEqual(rows.map(row => [row.start, row.end, row.sameLayerLunarState, row.lunarQualification]), [
    [0, 10, 'none', undefined],
    [10, 20, 'all_favourable', 'moderated'],
    [20, 40, 'mixed', undefined],
    [40, 45, 'all_adverse', 'strengthened'],
    [45, 50, 'none', undefined],
    [50, 70, 'conditional', undefined],
    [70, 100, 'none', undefined],
  ]);
  assert.deepEqual(rows[2].lunarFavourableTargets, ['Venus']);
  assert.deepEqual(rows[2].lunarAdverseTargets, ['Saturn']);

  const saturn = { ...phase, natalTargetId: 'Saturn', aspectType: 'semisquare' };
  const namedTargets = buildLeoSolarLunarPhases([saturn], [
    band(0, 15, 'Uranus', 'square'), band(15, 30, 'Saturn', 'square'), band(20, 25, 'Venus', 'trine'),
  ]);
  assert.deepEqual(namedTargets.map(row => [row.start, row.end, row.lunarQualification]), [
    [0, 15, undefined], [15, 20, 'strengthened'], [20, 25, 'strengthened'],
    [25, 30, 'strengthened'], [30, 100, undefined],
  ]);
  const moon = { ...phase, targetKind: 'progressed', natalTargetId: 'Moon', aspectType: 'trine' };
  const [mirror] = buildLeoSolarLunarPhases([moon], [
    band(0, 100, 'Sun', 'trine', 'progressed'), band(0, 100, 'Saturn', 'trine'),
  ]);
  assert.equal(mirror.sameLayerLunarState, 'none');
  assert.deepEqual(mirror.contacts, []);

  const saturnBackground = { ...saturn, aspectType: 'semisextile' };
  const solarDirections = [
    { ...band(10, 25, 'Saturn', 'semisextile'), progressedBody: 'Sun' },
    { ...band(15, 35, 'Venus', 'trine', 'progressed'), progressedBody: 'Sun' },
    { ...band(30, 45, 'Venus', 'trine'), progressedBody: 'Mercury' },
  ];
  assert.deepEqual(buildLeoSolarLunarPhases([saturnBackground], solarDirections)
    .map(row => [row.start, row.end, row.otherDirection?.body, row.sameLayerLunarState]), [
    [0, 30, undefined, 'none'], [30, 45, 'Mercury', 'none'], [45, 100, undefined, 'none'],
  ]);
});

const contextualGroups = [
  ['2002-10-15', ['p237', 'p248']],
  ['1939-12-01', ['p226']],
  ['1927-02-20', ['p252', 'p275']],
  ['1940-06-24', ['p231']],
  ['1952-09-13', ['p269', 'p283']],
  ['1950-03-08', ['p278']],
  ['1929-10-19', ['p268']],
];

for (const [born, passages] of contextualGroups) {
  test('solar lunar source rules for ' + born + ' preserve the base and actual same-layer contact intervals', () => {
    const { run } = submit(born);
    const results = matchFortuneKnowledge(run).byMethod.western;
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-lunar-phase'));
    const provider = formatFortunePrompt(input);
    const audit = formatFortuneFactAudit(input);
    for (const passage of passages) {
      const isRule = row => row.knowledgeId.includes('-' + passage + '-');
      const result = results.find(isRule);
      assert.equal(result.status, 'matched', passage);
      assert.deepEqual(result.unresolvedConditions, []);
      const evidence = run.facts.filter(fact => result.sourceFactIds.includes(fact.factId));
      assert.ok(evidence.some(row => passage === 'p268' ? row.normalizedPayload.lunarQualification === undefined
        : row.normalizedPayload.sameLayerLunarState === 'none'), passage);
      assert.ok(evidence.some(row => row.normalizedPayload.contacts.length), passage);
      if (passage === 'p226') assert.ok(evidence.every(row => row.normalizedPayload.phase === 'natal-to-progressed'));
      if (passage === 'p268') assert.ok(evidence.some(row => {
        const witness = row.normalizedPayload.otherDirection;
        return witness?.targetKind === row.normalizedPayload.targetKind && run.facts.some(fact =>
          fact.factType === 'leo_progressed_aspect' && fact.normalizedPayload.progressedBody === witness.body
          && fact.normalizedPayload.natalTargetId === witness.target && fact.normalizedPayload.targetKind === witness.targetKind
          && fact.normalizedPayload.aspectType === witness.aspectType && fact.activeFrom <= row.activeFrom && row.activeTo <= fact.activeTo);
      }));
      for (const row of evidence) {
        const p = row.normalizedPayload;
        assert.equal(row.factType, 'leo_solar_lunar_phase');
        assert.ok(p.phaseStart <= row.activeFrom && row.activeTo <= p.phaseEnd);
        assert.ok(run.facts.some(fact => fact.factType === 'leo_solar_phase'
          && fact.parentSignalId === row.parentSignalId && fact.normalizedPayload.phase === p.phase
          && fact.activeFrom <= row.activeFrom && row.activeTo <= fact.activeTo), passage);
        for (const contact of p.contacts) {
          assert.ok(run.facts.some(fact => fact.factType === 'leo_progressed_aspect'
            && fact.normalizedPayload.progressedBody === 'Moon' && fact.normalizedPayload.targetKind === p.targetKind
            && fact.normalizedPayload.natalTargetId === contact.target && fact.normalizedPayload.aspectType === contact.aspectType
            && fact.activeFrom <= row.activeFrom && row.activeTo <= fact.activeTo), passage);
        }
      }
      const altered = { ...evidence[0], normalizedPayload: { ...evidence[0].normalizedPayload, lunarProfile: 'unknown-lunar-policy' } };
      const wrongProfile = evaluateFortuneRules('western', 'year', [altered]).find(isRule);
      assert.deepEqual([wrongProfile.required[0].hits.length, wrongProfile.required[0].unknown], [0, false], passage);
      assert.ok(provider.includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning), passage);
    }
    assert.match(audit, /同层月相|没有同层月相/u);
    assert.doesNotMatch(provider, /leo_solar_lunar_phase|sameLayerLunarState|原书将这项同期月相视为/u);
  });
}
