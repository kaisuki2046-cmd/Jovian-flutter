import assert from 'node:assert/strict';
import test from 'node:test';
import { Body, Ecliptic, EquatorFromVector, GeoVector, RotateVector, Rotation_EQJ_EQD, SunPosition } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';

const { anglesFromFrame } = await import('./control/western-houses.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { getFortuneKnowledgeEntry } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { progressionEpoch } = await import('./control/western-progressions.ts');
const { buildLeoLunarConditions } = await import('./control/leo-lunar-conditions.ts');

const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

function longitude(planet, instant) {
  const at = new Date(instant);
  return planet === 'Sun' ? SunPosition(at).elon : Ecliptic(GeoVector(Body[planet], at, true)).elon;
}

function monthlyRun(birthDate, month, withHouseFrame = true, birthTime = '04:00:00') {
  const birth = Date.parse(`${birthDate}T${birthTime}.000Z`);
  const chart = { timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] }, western: {
    engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1', rawResult: [{
      julianDay: birth / 86_400_000 + 2440587.5,
      ...(withHouseFrame ? anglesFromFrame(0, 0, 23.44) : {}),
      positions: planets.map(planet => ({ planet, longitude: longitude(planet, birth) })),
    }],
  } };
  const parameters = { periodType: 'month', targetPeriod: { year: 2026, month }, displayTimezone: 'UTC' };
  const now = Date.UTC(2026, month - 1, 15);
  const reference = { snapshotId: `leo-monthly-relationship-${birthDate}-${month}`, chart };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, reference)));
  return bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
}

function checkExactPoint(birthDate, target, degrees, point, at) {
  assert.equal(point.exactInstant, at);
  const birth = Date.parse(`${birthDate}T04:00:00.000Z`);
  const moving = longitude('Moon', progressionEpoch(birth, Date.parse(at)));
  const separation = Math.abs((moving - longitude(target, birth) + 540) % 360 - 180);
  assert.ok(Math.abs(separation - degrees) < 0.00001);
}

function verifyNoFinding(run, result, preferences) {
  const report = interpretFortune(run, requestForFortuneRun(run, preferences), 'leo-monthly-relationship-premises');
  const { input } = buildFortuneModelContext(run, report);
  const meaning = getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning;
  assert.ok(!input.sections.some(section => section.findings.some(row => row.knowledgeId === result.knowledgeId)));
  assert.ok(!formatFortunePrompt(input).includes(meaning));
}

// Leo describes the additional directions and the still-unobserved actual circumstances separately.
// https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=129
// https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=145
const cases = [
  { passage: 'p212', target: 'Uranus', aspect: 'quincunx', degrees: 150, nature: 'favourable',
    birth: '1971-10-03', month: 1, nearMonth: 2, exactAt: '2026-01-25T16:35:45.081Z',
    isolated: { birth: '1973-12-06', month: 8, nature: 'none' } },
  { passage: 'p221', target: 'Venus', aspect: 'sesquiquadrate', degrees: 135, nature: 'adverse',
    birth: '1958-02-20', month: 9, nearMonth: 8, exactAt: '2026-09-02T23:09:42.605Z',
    isolated: { birth: '1957-10-23', month: 9, nature: 'favourable' } },
  { passage: 'p223', target: 'Venus', aspect: 'opposition', degrees: 180, nature: 'adverse',
    birth: '1959-09-03', month: 10, nearMonth: 9, exactAt: '2026-10-08T11:26:35.764Z',
    isolated: { birth: '1958-11-12', month: 7, nature: 'none' } },
];

for (const { passage, target, aspect, degrees, nature, birth, month, nearMonth, exactAt, isolated } of cases) {
  test(`${passage} verifies its exact lunar contact and the concurrent direction in the same layer`, () => {
    const resultFor = run => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes(`-${passage}-`));
    const isContact = ({ normalizedPayload: data }) => data.progressedBody === 'Moon' && data.natalTargetId === target
      && data.aspectType === aspect && data.targetKind === 'natal' && data.coordinate === 'ecliptic_longitude';
    const contexts = run => run.facts.filter(fact => fact.factType === 'leo_lunar_condition' && isContact(fact));

    const run = monthlyRun(birth, month);
    const positive = resultFor(run);
    assert.equal(positive.status, 'matched');
    assert.deepEqual(positive.unresolvedConditions, []);
    const witness = contexts(run).find(fact => positive.sourceFactIds.includes(fact.factId));
    assert.ok(witness);
    assert.equal(witness.normalizedPayload.directionSupportState, nature);
    assert.equal(witness.normalizedPayload.monthlyLunarHasExact, true);
    assert.ok(witness.normalizedPayload.supportingDirections.some(row => row.targetKind === 'natal' && row.nature === nature));
    assert.ok(witness.activeFrom <= exactAt && exactAt < witness.activeTo);
    const point = run.facts.find(fact => fact.factType === 'leo_lunar_exact_observation' && isContact(fact)
      && fact.parentSignalId === witness.parentSignalId);
    assert.ok(point?.normalizedPayload.observed);
    checkExactPoint(birth, target, degrees, point, exactAt);
    if (passage === 'p212') {
      assert.equal(witness.activeFrom, point.exactInstant);
      assert.ok(Date.parse(witness.activeTo) - Date.parse(point.exactInstant) <= 1_000);
      assert.ok(positive.windows.some(row => row.start === witness.activeFrom && row.endExclusive === witness.activeTo));
    } else {
      assert.equal(witness.normalizedPayload.monthlyLunarQualification, 'strengthened');
    }

    const nearby = monthlyRun(birth, nearMonth);
    const nearbyFacts = contexts(nearby);
    assert.ok(nearbyFacts.some(fact => fact.normalizedPayload.directionSupportState === nature));
    assert.ok(nearbyFacts.every(fact => fact.normalizedPayload.monthlyLunarHasExact === false));
    assert.equal(resultFor(nearby).status, 'not_matched');

    const isolatedRun = monthlyRun(isolated.birth, isolated.month);
    const isolatedPoint = contexts(isolatedRun).find(({ normalizedPayload: data }) => data.monthlyLunarHasExact
      && data.directionSupportState === isolated.nature);
    assert.ok(isolatedPoint);
    const isolatedMatch = resultFor(isolatedRun);
    assert.equal(isolatedMatch.status, 'matched');
    if (passage === 'p212') {
      assert.ok(isolatedMatch.sourceFactIds.includes(isolatedPoint.factId));
      for (const [monthlyLunarHasExact, expected] of [[false, 'not_matched'], [undefined, 'unknown']]) {
        const updated = { ...isolatedPoint, normalizedPayload: { ...isolatedPoint.normalizedPayload, monthlyLunarHasExact } };
        assert.equal(resultFor({ ...isolatedRun, facts: [updated] }).status, expected);
      }
      assert.ok(contexts(isolatedRun).filter(fact => !fact.normalizedPayload.monthlyLunarHasExact)
        .every(fact => !isolatedMatch.sourceFactIds.includes(fact.factId)));
    } else {
      assert.equal(isolatedPoint.normalizedPayload.monthlyLunarQualification, 'base');
    }
  });
}

test('p212 shares a contemporaneous solar opposition only with the same target Uranus', () => {
  const fixtures = [
    ['1945-09-18', 1, 'progressed', '2026-01-11T21:04:12.136Z', true],
    ['1945-09-18', 3, 'natal', '2026-03-10T18:44:33.962Z', false],
    ['1956-11-19', 10, 'natal', '2026-10-10T12:32:53.254Z', true],
    ['1956-11-19', 8, 'progressed', '2026-08-05T23:00:34.167Z', false],
  ];
  for (const [date, month, layer, exact, shared] of fixtures) {
    const run = monthlyRun(date, month);
    const relation = (p, body, aspect) => p.progressedBody === body && p.natalTargetId === 'Uranus' && p.aspectType === aspect;
    const point = run.facts.find(({ factType, activeFrom, normalizedPayload: p }) => factType === 'leo_lunar_exact_observation'
      && relation(p, 'Moon', 'quincunx') && p.targetKind === layer && activeFrom === exact);
    const base = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: p }) => factType === 'leo_lunar_condition'
      && relation(p, 'Moon', 'quincunx') && p.targetKind === layer && activeFrom <= exact && exact < activeTo && p.monthlyLunarHasExact);
    assert.ok(point && base);
    const solar = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: p }) => factType === 'leo_progressed_aspect'
      && relation(p, 'Sun', 'opposition') && (p.targetKind === layer) === shared && activeFrom <= exact && exact < activeTo);
    assert.ok(solar);
    const born = Date.parse(`${date}T04:00:00Z`), at = Math.round(progressionEpoch(born, Date.parse(exact)));
    const separation = (moving, targetLayer) => Math.abs((longitude(moving, at)
      - longitude('Uranus', targetLayer === 'natal' ? born : at) + 540) % 360 - 180);
    assert.ok(Math.abs(separation('Moon', layer) - 150) < 1e-6);
    assert.ok(Math.abs(separation('Sun', solar.normalizedPayload.targetKind) - 180) < 1);
    const p = base.normalizedPayload;
    assert.equal(p.hasConcurrentUranianSensitivityDirection, shared, exact);
    assert.deepEqual(p.concurrentUranianSensitivityDirection, shared
      ? { body: 'Sun', target: 'Uranus', targetKind: layer, aspectType: 'opposition' } : undefined);
    const isolate = { ...base, normalizedPayload: { ...p, directionSupportState: 'none' } };
    const result = matchFortuneKnowledge({ ...run, facts: [isolate] }).byMethod.western.find(row => row.knowledgeId.includes('-p212-'));
    assert.equal(result.status, 'matched', exact);
    assert.ok(result.sourceFactIds.includes(base.factId));
    if (shared) {
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-p212-opposition'));
      const prose = /月天精确成相时，次限太阳正在与同一(?:次限|本命)天王星/u;
      assert.match(formatFortuneFactAudit(input), prose);
      const provider = formatFortunePrompt(input);
      assert.doesNotMatch(provider, prose);
      assert.ok(provider.includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning));
    }
  }
});

test('p212 uses the exact half-open overlap, not a solar band ending at the lunar contact', () => {
  const contact = { start: 0, end: 2_000, progressedBody: 'Moon', natalTargetId: 'Uranus', targetKind: 'natal',
    aspectType: 'quincunx', coordinate: 'ecliptic_longitude', exactTimes: [1_000] };
  const solar = { progressedBody: 'Sun', natalTargetId: 'Uranus', targetKind: 'natal', aspectType: 'opposition', exactTimes: [] };
  for (const [start, end, hit] of [[500, 1_000, false], [1_001, 1_500, false], [1_000, 1_500, true]]) {
    const rows = buildLeoLunarConditions([contact, { ...solar, start, end }]).filter(row => row.base === contact);
    const formation = rows.find(row => row.monthlyThemeEvidence.hasExact);
    assert.equal(formation.hasConcurrentUranianSensitivityDirection, hit);
    assert.ok(rows.filter(row => !row.monthlyThemeEvidence.hasExact).every(row => !row.hasConcurrentUranianSensitivityDirection));
  }
});

test('p182 records the natal Jupiter–Neptune inner-life testimony only with an actual lunar contact', () => {
  const date = '1941-04-17', exact = '2026-10-25T13:27:39.265Z';
  const isContact = ({ normalizedPayload: p }) => p.progressedBody === 'Moon' && p.natalTargetId === 'Neptune'
    && p.aspectType === 'quincunx' && p.targetKind === 'natal';
  const resultFor = run => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-p182-'));
  const run = monthlyRun(date, 10, false);
  const result = resultFor(run);
  const point = run.facts.find(fact => fact.factType === 'leo_lunar_exact_observation' && isContact(fact));
  assert.ok(point && result.sourceFactIds.includes(point.factId));
  checkExactPoint(date, 'Neptune', 150, point, exact);
  assert.equal(result.status, 'matched');
  const p = point.normalizedPayload;
  assert.equal(p.hasLunarNeptuneTestimony, false);
  assert.equal(p.natalTargetHouse, undefined);
  assert.equal(p.natalNeptuneApproachingAscendant, undefined);
  assert.equal(p.hasLunarNeptuneDevotionalContact, true);
  assert.equal(p.hasNatalSunNeptuneCreativeContact, false);
  assert.ok(p.lunarNeptuneDevotionalContacts.some(row => row.first === 'Jupiter' && row.second === 'Neptune'
    && row.aspect === 'trine' && row.nature === 'favourable' && row.difference <= row.orb));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-p182-devotional'));
  const prose = /供核同作者所述的虔诚主题候选，个人信念仍待核/u;
  assert.match(formatFortuneFactAudit(input), prose);
  const provider = formatFortunePrompt(input);
  assert.doesNotMatch(provider, prose);
  assert.ok(provider.includes('须以当事人原有信念和实际感受为准'));
  assert.ok(input.sections.some(section => section.findings.some(finding => finding.knowledgeId === result.knowledgeId)));
  assert.ok(result.windows.some(window => window.start === point.exactInstant && window.endExclusive === point.activeTo));
  const wrongLayer = { ...point, normalizedPayload: { ...p, targetKind: 'transit' } };
  assert.equal(resultFor({ ...run, facts: [wrongLayer] }).status, 'not_matched');
  const near = monthlyRun(date, 9, false);
  assert.ok(near.facts.some(fact => fact.factType === 'leo_progressed_aspect' && isContact(fact)));
  assert.ok(!near.facts.some(fact => fact.factType === 'leo_lunar_exact_observation' && isContact(fact)));
  assert.equal(resultFor(near).status, 'not_matched');
});

test('p222 uses the precise geometry without houses and describes actual emotional investment as conditional', () => {
  const birth = '1960-06-24';
  const resultFor = run => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-p222-'));
  const isContact = ({ normalizedPayload: data }) => data.progressedBody === 'Moon' && data.natalTargetId === 'Venus'
    && data.aspectType === 'quincunx' && data.targetKind === 'natal' && data.coordinate === 'ecliptic_longitude';
  const run = monthlyRun(birth, 11, false);
  const result = resultFor(run);
  const point = run.facts.find(fact => fact.factType === 'leo_lunar_exact_observation' && isContact(fact)
    && result.sourceFactIds.includes(fact.factId));
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.unresolvedConditions, []);
  assert.ok(point?.normalizedPayload.observed);
  assert.ok(run.facts.some(fact => fact.factType === 'leo_lunar_condition' && isContact(fact)
    && fact.normalizedPayload.monthlyLunarHasExact && fact.normalizedPayload.monthlyLunarHasExactInOwnFrame === undefined));
  checkExactPoint(birth, 'Venus', 150, point, '2026-11-17T08:23:48.992Z');
  for (const preferences of [undefined, { relationshipStatus: 'dating' }, { relationshipStatus: 'relationship' }]) {
    const report = interpretFortune(run, requestForFortuneRun(run, preferences), 'leo-monthly-venus-quincunx');
    const { input } = buildFortuneModelContext(run, report);
    const prompt = formatFortunePrompt(input);
    assert.ok(input.sections.some(section => section.findings.some(row => row.knowledgeId === result.knowledgeId)));
    assert.match(prompt, /如果你已经在一段联系中投入感情/u);
    assert.match(prompt, /也可能没有值得留意的变化/u);
    assert.doesNotMatch(prompt, /relationshipStatus|leo_lunar_exact_observation/u);
  }

  const nearby = monthlyRun(birth, 12, false);
  assert.ok(nearby.facts.some(fact => fact.factType === 'leo_progressed_aspect' && isContact(fact)));
  assert.ok(!nearby.facts.some(fact => fact.factType === 'leo_lunar_exact_observation' && isContact(fact)));
  assert.equal(resultFor(nearby).status, 'not_matched');
});

test('Jupiter and Mars lunar parallels use the actual month range without an equal-declination point', () => {
  const birthDate = '1955-04-08', birth = Date.parse(birthDate + 'T00:00:00Z');
  const positive = monthlyRun(birthDate, 10, true, '00:00:00');
  const negative = monthlyRun('1963-10-01', 8, true, '00:00:00');
  const declination = (body, at) => {
    const date = new Date(at);
    return EquatorFromVector(RotateVector(Rotation_EQJ_EQD(date), GeoVector(Body[body], date, true))).dec;
  };
  for (const [passage, target, layer] of [['p154', 'Jupiter', 'natal'], ['p164', 'Mars', 'progressed']]) {
    const row = run => matchFortuneKnowledge(run).byMethod.western.find(result => result.knowledgeId.includes('-' + passage + '-'));
    const result = row(positive);
    assert.equal(result.status, 'matched', passage);
    const matchesPair = p => p.progressedBody === 'Moon' && p.natalTargetId === target && p.aspectType === 'parallel';
    const matchedFacts = positive.facts.filter(fact => result.sourceFactIds.includes(fact.factId));
    assert.deepEqual(matchedFacts.map(fact => fact.normalizedPayload.targetKind), [layer], passage);
    for (const fact of matchedFacts) {
      assert.equal(fact.factType, 'leo_progressed_aspect', passage);
      assert.ok(matchesPair(fact.normalizedPayload), passage);
      const midpoint = (Date.parse(fact.activeFrom) + Date.parse(fact.activeTo)) / 2;
      const epoch = progressionEpoch(birth, midpoint), targetEpoch = layer === 'natal' ? birth : epoch;
      const difference = Math.abs(Math.abs(declination('Moon', epoch)) - Math.abs(declination(target, targetEpoch)));
      assert.ok(0 < difference && difference <= 1, passage);
    }
    assert.ok(!positive.facts.some(fact => fact.factType === 'leo_progressed_aspect_exact' && matchesPair(fact.normalizedPayload)), passage);
    assert.equal(row(negative).status, 'not_matched', passage);
  }
});

test('the Moon–Sun square enters the report on the actual point and strengthens only with same-layer adverse solar evidence', () => {
  const resultFor = run => matchFortuneKnowledge(run).byMethod.western.find(row => row.knowledgeId.includes('-p199-'));
  for (const [birth, month, expected, strengthened] of [
    ['1963-10-01', 9, 'base', false], ['1935-04-01', 4, 'strengthened', true],
  ]) {
    const run = monthlyRun(birth, month, true, '00:00:00'), result = resultFor(run);
    assert.equal(result.status, 'matched', birth);
    const facts = run.facts.filter(fact => result.sourceFactIds.includes(fact.factId));
    const witness = facts.find(fact => fact.normalizedPayload.monthlyLunarQualification === expected);
    assert.ok(witness, birth);
    assert.equal(witness.normalizedPayload.monthlyLunarHasExact, true);
    assert.equal(witness.normalizedPayload.sameLayerSolarDirectionState === 'adverse', strengthened);
    if (strengthened) assert.ok(witness.normalizedPayload.supportingDirections.some(direction =>
      direction.body === 'Sun' && direction.nature === 'adverse' && direction.targetKind === witness.normalizedPayload.targetKind));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-solar-square'));
    assert.equal(/精确月日刑相所在的同一盘层片段有已核偏难太阳推运/u.test(formatFortuneFactAudit(input)), strengthened);
    assert.ok(formatFortunePrompt(input).includes(getFortuneKnowledgeEntry(result.knowledgeId).interpretation.classical_meaning));
  }
  assert.equal(resultFor(monthlyRun('1963-10-01', 8, true, '00:00:00')).status, 'not_matched');
});
