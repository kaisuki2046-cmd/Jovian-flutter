import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Body, Ecliptic, GeoVector, SunPosition } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact } from './control/fortune-prompt.mjs';
const { lillyPlanetConditions, lillySolarCondition, lillyAccidentalPolicy } = await import('./control/lilly-accidental.ts');
const { lillyApplicationSequence } = await import('./control/lilly-application.ts');
const { lillyEssentialDignities } = await import('./control/lilly-essential.ts');
const { buildLillyReturnContext } = await import('./control/lilly-returns.ts');
const { buildSolarReturnPositions } = await import('./control/solar-transits.ts');
const ref = JSON.parse(readFileSync(new URL('./model/fixtures/lilly-conditions-reference.json', import.meta.url)));
const sourceTable = JSON.parse(readFileSync(new URL('./model/fixtures/lilly-essential-reference.json', import.meta.url)));
const arc = n => ((n + 540) % 360 + 360) % 360 - 180;
const defaults = { Sun: [100,1], Moon: [220,13.2], Mercury: [80,1.3], Venus: [50,1.1], Mars: [15,0.5], Jupiter: [260,0.1], Saturn: [300,0.03] };
// Synthetic relation examples below test the printed rules, not historical
// charts. The separate ephemeris test exercises a real common epoch.
const epoch = (changes = {}) => Object.entries({ ...defaults, ...changes }).map(([body, [longitude, speed]]) => ({ body, longitude, speed }));
const solar = (longitude, sunLongitude = 10, body = 'Mercury', speed = 1) => lillySolarCondition(
  { body, longitude, speed }, { body: 'Sun', longitude: sunLongitude, speed: 1 });

test('same-sign combustion, cazimi and beam distances retain their separate exact cutoffs, without misclassifying Sun or cross-sign near contacts', () => {
  assert.equal(ref.profile, lillyAccidentalPolicy.profile);
  assert.equal(solar(10 + 17/60).condition, 'cazimi');
  assert.equal(solar(10 + 17/60 + 1e-7).condition, 'combust');
  assert.equal(solar(18.5).condition, 'combust'); assert.equal(solar(18.5 + 1e-7).condition, 'under_beams');
  assert.equal(solar(27 - 1e-7).condition, 'under_beams'); assert.equal(solar(27).condition, 'free_of_beams');
  const near = solar(10.1); assert.equal(near.withinCombustionDistance, true); assert.equal(near.withinBeamDistance, true); assert.equal(near.condition, 'cazimi');
  assert.equal(solar(0.1,359.9).condition, 'cross_sign_cazimi_unresolved');
  assert.equal(solar(7,359).condition, 'under_beams'); assert.equal(solar(7,359).sameSign, false);
  assert.equal(solar(10,10,'Sun').condition, 'not_applicable');
  assert.throws(() => solar(360)); assert.throws(() => solar(10,10,'Pluto'));
});

test('the printed ten-degree combustion example remains a recorded conflict and does not widen the eight-and-half-degree definition', () => {
  const example = ref.solar.exampleConflict, actual = solar(example.jupiter, example.sun, 'Jupiter', 0.1);
  assert.equal(actual.condition, example.definitionResult); assert.equal(actual.withinCombustionDistance, false);
  assert.equal(actual.definitionExampleConflict, true);
  const closing = solar(18,10,'Jupiter',0.1), opening = solar(18,10,'Mercury',1.5);
  assert.equal(closing.relativePhase, 'closing'); assert.equal(opening.relativePhase, 'opening');
});

test('both printed orb columns use the sum of half each orb and retain the source Venus-Saturn example plus column-dependent counterexamples', () => {
  const example = ref.platickExample;
  const data = lillyPlanetConditions('Venus', epoch({ Venus: [example.venus,1], Saturn: [example.saturn,0.03] }));
  const contact = data.contacts.find(row => row.otherBody === 'Saturn' && row.aspectType === example.aspect);
  assert.equal(contact.error, example.error); assert.equal(contact.mainOrb, example.mainMoietySum); assert.equal(contact.alternateOrb, example.alternateMoietySum);
  assert.equal(contact.orbAgreement, 'both_columns');
  const different = lillyPlanetConditions('Venus', epoch({ Venus: [40,1], Saturn: [168.5,0.03] })).contacts.find(row => row.otherBody === 'Saturn');
  assert.equal(different.inMainOrb, true); assert.equal(different.inAlternateOrb, false); assert.equal(different.orbAgreement, 'column_dependent');
  assert.ok(!lillyPlanetConditions('Venus', epoch({ Venus: [40,1], Saturn: [169.00001,0.03] })).contacts.some(row => row.otherBody === 'Saturn'));
  for (const [first, orb] of Object.entries(ref.mainOrbs)) for (const [second, otherOrb] of Object.entries(ref.mainOrbs)) {
    if (first === second) continue;
    const changes = { [first]: [1,1], [second]: [61,0.5] };
    const row = lillyPlanetConditions(first, epoch(changes)).contacts.find(row => row.otherBody === second && row.aspectType === 'sextile');
    assert.equal(row.mainOrb, (orb + otherOrb)/2); assert.equal(row.alternateOrb, (ref.alternateOrbs[first] + ref.alternateOrbs[second])/2);
  }
});

test('all three printed applications have closing geometry, but reversals, zero rates and out-of-sign configurations are not guaranteed perfection', () => {
  for (const ex of ref.applicationExamples) {
    const row = lillyPlanetConditions(ex.subject, epoch({ [ex.subject]: [ex.subjectLongitude,ex.subjectSpeed], [ex.other]: [ex.otherLongitude,ex.otherSpeed] }))
      .contacts.find(row => row.otherBody === ex.other && row.aspectType === 'conjunction');
    assert.equal(row.phase, 'closing');
  }
  const opening = lillyPlanetConditions('Mercury', epoch({ Mercury:[5,0.1], Mars:[10,0.5] })).contacts.find(row => row.otherBody === 'Mars');
  assert.equal(opening.phase, 'opening');
  const still = lillyPlanetConditions('Mercury', epoch({ Mercury:[5,0.5], Mars:[10,0.5] })).contacts.find(row => row.otherBody === 'Mars');
  assert.equal(still.phase, 'instantaneous_rate_zero');
  const cross = lillyPlanetConditions('Mercury', epoch({ Mercury:[29,1], Mars:[31,0.5] })).contacts.find(row => row.otherBody === 'Mars');
  assert.equal(cross.signAspectMatches, false); assert.ok(!('willPerfect' in cross)); assert.ok(!('partill' in cross));
});

test('initial application can perfect in sign or reach a sign boundary first', () => {
  const day = 86_400_000;
  const linear = (subject, other, angle) => lillyApplicationSequence(0, subject, other, angle, (body, at) => {
    const position = body === subject.body ? subject : other;
    return { longitude: position.longitude + position.speed * at / day, speed: position.speed };
  });
  const exact = linear({ body: 'Venus', longitude: 7, speed: 1 }, { body: 'Jupiter', longitude: 10, speed: 0.1 }, 0);
  assert.equal(exact.status, 'exact');
  assert.ok(Math.abs(Date.parse(exact.eventAt) - 3 / 0.9 * day) <= 1_000);
  assert.equal(exact.applyingRetrogradeStation, undefined);
  const exit = linear({ body: 'Venus', longitude: 27, speed: 2 }, { body: 'Saturn', longitude: 119, speed: 1 }, 90);
  assert.equal(exit.status, 'sign_exit');
  assert.equal(Date.parse(exit.eventAt), day);
  const simultaneous = linear({ body: 'Venus', longitude: 28, speed: 1 }, { body: 'Saturn', longitude: 119, speed: 0.5 }, 90);
  assert.equal(simultaneous.status, 'ordering_unresolved');
});

test('relative approach can stop before the initially applying planet turns retrograde', () => {
  const day = 86_400_000;
  const read = (body, at) => {
    const t = at / day;
    if (body === 'Saturn') return { longitude: 12 + 0.05 * t, speed: 0.05 };
    if (t <= 4) return { longitude: 7 + t - 0.25 * t * t, speed: 1 - 0.5 * t };
    return { longitude: ((7 - (t - 4)) % 360 + 360) % 360, speed: -1 };
  };
  const result = lillyApplicationSequence(0, { body: 'Mars', ...read('Mars', 0) },
    { body: 'Saturn', ...read('Saturn', 0) }, 0, read);
  assert.equal(result.status, 'sign_exit');
  assert.ok(Math.abs(Date.parse(result.lossOfApproachAt) - 1.9 * day) <= 1_000);
  assert.equal(result.applyingRetrogradeStation.body, 'Mars');
  assert.ok(Math.abs(Date.parse(result.applyingRetrogradeStation.at) - 2 * day) <= 1_000);
  assert.ok(Date.parse(result.applyingRetrogradeStation.at) < Date.parse(result.eventAt));
});

test('the two printed prohibitions require the faster third body to perfect both contacts before the original conjunction', () => {
  const day = 86_400_000;
  const read = (positions, body, at) => {
    const { longitude, speed } = positions.find(p => p.body === body);
    return { longitude: (longitude + speed * at / day) % 360, speed };
  };
  for (const [sun, saturn, kind, aspectType, targetDay] of [[6, 12, 'bodily_prohibition', 'conjunction', 6 / 0.95],
    [65, 15, 'aspectual_prohibition', 'sextile', 10 / 0.95]]) {
    const positions = epoch({ Sun: [sun,1], Mars: [7,0.5], Saturn: [saturn,0.05] });
    const conditions = lillyPlanetConditions('Saturn', positions, undefined, { at:0, read: (body, at) => read(positions, body, at) });
    const original = conditions.contacts.find(row => row.otherBody === 'Mars' && row.aspectType === 'conjunction');
    const hit = original.interpositions.find(row => row.thirdBody === 'Sun');
    assert.equal(hit.kind, kind);
    assert.equal(hit.aspectType, aspectType);
    assert.equal(hit.applyingBody, 'Mars');
    assert.equal(hit.receivingBody, 'Saturn');
    assert.ok(Date.parse(hit.applyingContactAt) < Date.parse(hit.receivingContactAt));
    assert.ok(Date.parse(hit.receivingContactAt) < Date.parse(original.application.eventAt));
    assert.ok(Math.abs(Date.parse(hit.receivingContactAt) - targetDay * day) <= 1_000);
  }
  const positions = epoch({ Sun: [9,1], Mars: [7,0.5], Saturn: [12,0.05] });
  const conditions = lillyPlanetConditions('Saturn', positions, undefined, { at:0, read: (body, at) => read(positions, body, at) });
  const original = conditions.contacts.find(row => row.otherBody === 'Mars' && row.aspectType === 'conjunction');
  assert.equal(original.application.status, 'exact');
  assert.ok(!original.interpositions?.some(row => row.thirdBody === 'Sun'));
});

test('frustration requires the slower planet to conjoin a third before the original applying planet arrives', () => {
  const day = 86_400_000;
  const check = mercurySpeed => {
    const positions = epoch({ Mercury: [10,mercurySpeed], Mars: [12,0.5], Jupiter: [13,0.1] });
    const read = (body, at) => {
      const { longitude, speed } = positions.find(p => p.body === body);
      return { longitude: (longitude + speed * at / day) % 360, speed };
    };
    return lillyPlanetConditions('Mercury', positions, undefined, { at:0, read }).contacts
      .find(row => row.otherBody === 'Mars' && row.aspectType === 'conjunction');
  };
  const original = check(1.1), hit = original.interpositions.find(row => row.thirdBody === 'Jupiter');
  assert.equal(hit.kind, 'frustration');
  assert.equal(hit.applyingBody, 'Mercury');
  assert.equal(hit.receivingBody, 'Mars');
  assert.equal(hit.applyingContactAt, undefined);
  assert.ok(Math.abs(Date.parse(hit.receivingContactAt) - 2.5 * day) <= 1_000);
  assert.ok(Date.parse(hit.receivingContactAt) < Date.parse(original.application.eventAt));
  assert.ok(!check(1.4).interpositions?.some(row => row.thirdBody === 'Jupiter'));
  assert.ok(!check(1.3).interpositions?.some(row => row.thirdBody === 'Jupiter'));
});

test('source mean motions stay in degrees per day and the separate slow-Moon threshold never changes actual motion into retrograde', () => {
  for (const [body, seconds] of Object.entries(ref.meanMotionArcseconds)) {
    const value = lillyPlanetConditions(body, epoch({ [body]: [defaults[body][0],seconds/3600] }));
    assert.equal(value.sourceMeanSpeed, seconds/3600); assert.equal(value.magnitudeComparedToMean, 'equal');
    assert.equal(value.directFortitudeApplicable, !['Sun','Moon'].includes(body));
  }
  const moon = lillyPlanetConditions('Moon', epoch({ Moon:[220,13.17] }));
  assert.equal(moon.motion, 'direct'); assert.equal(moon.magnitudeComparedToMean, 'slower'); assert.equal(moon.moonBelowPrintedSlowThreshold, false);
  assert.equal(lillyPlanetConditions('Moon', epoch({ Moon:[220,13.1] })).moonBelowPrintedSlowThreshold, true);
  const reverse = lillyPlanetConditions('Mercury', epoch({ Mercury:[80,-2] }));
  assert.equal(reverse.motion, 'retrograde'); assert.equal(reverse.magnitudeComparedToMean, 'faster'); assert.ok(!('wellAffected' in reverse));
  assert.equal(lillyPlanetConditions('Mercury', epoch({ Mercury:[80,0] })).motion, 'instantaneous_rate_zero');
  assert.equal(lillyPlanetConditions('Moon', epoch({ Moon:[110,13], Sun:[100,1] })).moonLight, 'increasing');
  assert.equal(lillyPlanetConditions('Moon', epoch({ Moon:[90,13], Sun:[100,1] })).moonLight, 'decreasing');
});

test('mutual house and exaltation receptions are independent structures, not automatic rescue or cancellation of a fall', () => {
  const byHouse = lillyPlanetConditions('Venus', epoch({ Venus:[1,1], Mars:[181,0.5] }));
  assert.ok(byHouse.receptions.some(r => r.otherBody === 'Mars' && r.mutualHouse));
  const byExaltation = lillyPlanetConditions('Sun', epoch({ Sun:[181,1], Saturn:[1,0.03] }));
  assert.ok(byExaltation.receptions.some(r => r.otherBody === 'Saturn' && r.mutualExaltation));
  assert.equal(lillyEssentialDignities('Sun',181).fall, true);
  assert.ok(!('rescued' in byExaltation)); assert.ok(!('score' in byExaltation));
});

test('Lilly p112 triplicity uses same-chart sect and term uses both exact bounds; face is tracked independently', () => {
  const pair = (otherBody, changes, sect) => lillyPlanetConditions('Venus', epoch(changes), undefined, undefined, sect)
    .receptions.find(row => row.otherBody === otherBody);
  const triplicity = { Venus: [24, 1], Sun: [50, 1] };
  assert.equal(pair('Sun', triplicity, 'day').mutualTriplicity, true);
  assert.notEqual(pair('Sun', triplicity, 'night')?.mutualTriplicity, true);
  const unknown = pair('Sun', triplicity);
  assert.equal(unknown.mutualTriplicity, undefined);
  assert.deepEqual(unknown.triplicityBySect, { day: true, night: false });

  const terms = { Venus: [24, 1], Mars: [76, 0.5] };
  const byTerm = pair('Mars', terms);
  assert.equal(byTerm.mutualTerm, true);
  assert.equal(byTerm.mutualFace, false);
  assert.notEqual(pair('Mars', { ...terms, Venus: [20, 1] })?.mutualTerm, true);
  const disputed = pair('Mars', { ...terms, Mars: [80.5, 0.5] });
  assert.equal(disputed.mutualTerm, undefined);
  assert.equal(disputed.termVariantUnresolved, true);
  assert.equal(pair('Mars', { Venus: [75, 1], Mars: [165, 0.5] }).mutualFace, true);

  const conditions = lillyPlanetConditions('Venus', epoch({ ...triplicity, Mars: [76, 0.5] }));
  const phrase = describeFortuneFact({ method: 'western', type: 'lilly_return_context', data: {
    profile: 'lilly-return-source-pairs-v3-radical-place', returnBody: 'Venus', natalTargetId: 'Mercury', returningConditions: conditions,
  } }, String);
  assert.match(phrase, /与本图太阳的三分互容仅在昼盘成立，本图昼夜待核/u);
  assert.match(phrase, /与本图火星有界互容/u);
  assert.doesNotMatch(phrase, /triplicityBySect|termVariantUnresolved|receptionProfile/u);
});

test('the printed same-sign body-between example remains distinct from uncalculated besiegement configurations and natal house categories', () => {
  const changes = { Saturn:[15,0.03], Mars:[10,0.5], Venus:[13,1] };
  assert.equal(lillyPlanetConditions('Venus',epoch(changes),1).besiegement.between,true);
  assert.equal(lillyPlanetConditions('Venus',epoch({ ...changes,Venus:[18,1] }),8).besiegement.between,false);
  assert.equal(lillyPlanetConditions('Venus',epoch({ ...changes,Venus:[40,1] })).besiegement.status,'other_configurations_unresolved');
  assert.equal(lillyPlanetConditions('Saturn',epoch(changes)).besiegement.status,'not_applicable');
  for (const [house,kind] of [[1,'angular'],[4,'angular'],[7,'angular'],[10,'angular'],[2,'succedent'],[8,'succedent'],[12,'cadent']]) assert.equal(lillyPlanetConditions('Venus',epoch(changes),house).houseKind,kind);
  assert.throws(() => lillyPlanetConditions('Venus',epoch(changes),13));
  assert.throws(() => lillyPlanetConditions('Venus',epoch(changes).slice(1)));
  const duplicate = epoch(changes); duplicate[0] = { ...duplicate[1] }; assert.throws(() => lillyPlanetConditions('Venus',duplicate));
});

test('same-book prose resolves named table cells while retaining original readings and the newly identified Gemini prose gap as unknown', () => {
  assert.deepEqual(sourceTable.proseResolution.saturn.taurusOrdinals,[23,24,25,26]);
  const taurus = lillyEssentialDignities('Saturn',53); assert.equal(taurus.inOwnTerm,true); assert.equal(taurus.termStatus,'prose_resolved');
  const libra = lillyEssentialDignities('Mercury',200); assert.equal(libra.tableTermLord,'Venus'); assert.equal(libra.termLord,'Mercury'); assert.equal(libra.inOwnTerm,true);
  const sagittarius = lillyEssentialDignities('Mercury',259.5); assert.equal(sagittarius.tableTermLord,'Saturn'); assert.equal(sagittarius.termEnd,20); assert.equal(sagittarius.inOwnTerm,true);
  const gap = lillyEssentialDignities('Venus',80.5); assert.equal(gap.termStatus,'source_variant'); assert.equal(gap.inOwnTerm,undefined); assert.equal(gap.hasEssentialDignity,undefined);
  assert.ok(gap.sourceDifferences.includes('gemini-venus-twenty-first-degree-gap'));
});

test('real return and natal conditions use their own ephemeris epochs, preserve unavailable houses and reject tampered speeds', () => {
  const at = Date.parse('1990-06-15T04:00:00Z'), planets = Object.keys(defaults);
  const read = (body,time) => body === 'Sun' ? SunPosition(new Date(time)).elon : Ecliptic(GeoVector(Body[body],new Date(time),true)).elon;
  const chart = { timeKnown:true,bazi:{rawResult:[]},ziwei:{rawResult:[]},western:{engineName:'astronomy-engine',engineVersion:'2.1.19',rulesetVersion:'tropical-whole-sign-v1',
    rawResult:[{julianDay:at/86400000+2440587.5,ascendant:NaN,midheaven:NaN,positions:planets.map(planet=>({planet,longitude:read(planet,at)}))}]} };
  const window = {start:Date.parse('2026-01-01T00:00:00Z'),end:Date.parse('2026-12-31T00:00:00Z')};
  const returns = buildSolarReturnPositions(window,chart.western), result = buildLillyReturnContext(window,chart,returns);
  assert.equal(result.contexts.length,8);
  for (const row of result.contexts) {
    const natalSpeed = arc(read(row.natalTargetId,at+600000)-read(row.natalTargetId,at-600000))*72;
    assert.ok(Math.abs(row.natalTargetConditions.speed-natalSpeed)<1e-9);
    assert.equal(row.returningConditions.body,row.returnBody); assert.equal(row.natalTargetConditions.body,row.natalTargetId);
    assert.equal(row.returningConditions.house,undefined); assert.equal(row.natalTargetConditions.house,undefined);
    assert.ok(Math.abs(row.returningConditions.speed-row.returnSpeed)<1e-9);
  }
  const changed = structuredClone(returns[0]); changed.bodies.find(p=>p.planet==='Venus').speed+=0.2;
  assert.equal(buildLillyReturnContext(window,chart,[changed]).contexts.length,0);
});

test('natural Chinese retains the two orb columns, source caveats and frame roles without emitting the underlying machine condition graph', () => {
  const value = lillyPlanetConditions('Venus',epoch({ Venus:[40,1],Saturn:[168.5,0.03] }));
  const rendered = describeFortuneFact({method:'western',type:'lilly_return_context',data:{profile:'lilly-return-source-pairs-v2-conditions',
    returnBody:'Venus',natalTargetId:'Mercury',returningLongitude:40,natalLongitude:42,returningConditions:value,
    returningEssential:lillyEssentialDignities('Venus',40)}},String);
  for(const phrase of ['仅在其中一列','8.5度燃烧定义','不保证以后成相']) {
    assert.ok(rendered.includes(phrase),phrase);
  }
  for(const field of ['returningConditions','sourceMeanSpeed','orbAgreement','lilly-accidental-source','otherBody'])assert.ok(!rendered.includes(field),field);
  assert.ok(!/[{}\[\]]/u.test(rendered));
});
