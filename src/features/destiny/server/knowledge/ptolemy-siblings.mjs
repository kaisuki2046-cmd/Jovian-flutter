import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
import { lillyDomicileRuler } from '../../control/lilly-houses.mjs';
import { lillyDignityBodies } from './lilly-dignities.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { normalizeRuleInput } from './matching.mjs';
import { ptolemyDisjunctSigns } from './ptolemy-book-one.mjs';
import { easternOrCulminatingLongitude } from './ptolemy-fortune-angles.mjs';

export const ptolemySiblingsProfile = 'ptolemy-iii-siblings-witnesses-v1';
const kind = 'western_ptolemy_siblings_source';
const reviewed = new Map([
  [1, '5c9ad3af95f452f9e82974fcf96d5779ca84dc11dddcad8ba444f62788e8850f'],
  [2, '61ade0ddec6ebeb825e359947b61b1dca7572913b79b1134697ebe59c397db86'],
  [3, '29032469ea607e8f8c4b60b18df39bf2d08b59be96d79faaf3eea4a1a2749a88'],
  [4, 'afc5a07f9b7719c29638f3897f4b10551b124db483030ed445b49ad186a2fc0e'],
  [5, '68940df1435526e270bc4f6427ffb9164771981d767efc9af565cefd94962603'],
  [7, '193dc97f876c51394fd01685f5fec2e2d03dd7a266704d9c60b5adcba2bb457c'],
  [13, 'bae781c194fc6b0aa2bf3fcf93fb6e958f6fbfbaf2c21f20717d939514a5c4eb'],
  [14, 'ad39d8ba27325213e04b8f9e56530de1da65e8883d6b89fca1c49d92c2e08a98'],
  [15, '23c58ded2a6dc95514378b8fe18390b8e4c9095331eff842efcbb35d3b799330'],
  [16, 'f5302b740cdc1dd2c30ed9e40a65b65d2be82025a4ac0c7eb4a15db8964681d7'],
  [17, 'daa63f57cccf6a53b6f0407244bc84756ba7702a1ec8b82b460a9cee5e938aca'],
  [18, 'da4f21f42edb230401f5d70c4389b994e492d1c8e3e77a07b35017a80cc14f6a'],
  [19, 'fa10bd5ffffbda6b8b66cc292f6ae645aa7acf1b5c47133e32abd6e32c890e5b'],
  [20, '86e9ae4f5400046445b17c31c6557d289d1a6fa23a41ca70d3f84b4693889002'],
  [22, 'ed744aac398b81e5086554634ec4e10c4c06849cf88399124bbde121629f2d77'],
  [23, '304060ebecd6a7a2b098a16062edaeb977cb42759f3401b61f9a568cfc7a9ba4'],
  [24, '46f32adbbeb6481157e4f48ad61c3fe55b2e113de8610f27e43606dcff20fa94'],
  [36, '64c5534cc958b1ac99efa89202c9f3ae2bba9bb455b57b887d55c152a79919ed'],
]);
const ashmand = new Set([17, 18, 19, 20]);
const benefics = ['Jupiter', 'Venus'], malefics = ['Mars', 'Saturn'];
const axes = ['ascendant', 'ic', 'descendant', 'mc'];
const axisRegions = ['east', 'north', 'west', 'south'];
const axisHouses = [1, 4, 7, 10];
const aspects = { 2: 'sextile', 3: 'square', 4: 'trine', 6: 'opposition' };
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const wrap = value => ((value % 360) + 360) % 360;
const toSign = longitude => Math.floor(longitude / 30);
const steps = (first, second) => (second - first + 12) % 12;
const distance = (first, second) => Math.min(steps(first, second), steps(second, first));
const harmonious = (first, second) => [2, 4].includes(distance(first, second));
const signFact = ({ planet, sign }) => ({ kind: 'planet_sign', planet, sign: zodiacNames[sign] });
const relation = (planet, target, sign, relation) =>
  ({ kind: 'western_ptolemy_siblings_contact', planet, target, sign: zodiacNames[sign], relation });
const selected = number => ({ kind, number });
export const isPtolemySiblingsSourceNumber = number => reviewed.has(number);

export function compilePtolemySiblings(claim) {
  const number = Number(/^astro-ptolemy-v3-siblings-p(\d{3})-001$/u.exec(claim.id)?.[1]);
  if (!reviewed.has(number)) return undefined;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== reviewed.get(number)) {
    return { reason: 'source_review_required', reviewNote: '《四书》兄弟姐妹篇的出处、原文或条件有变，须重新核对。' };
  }
  return { compiler: ptolemySiblingsProfile, matchScope: 'historical_aphorism',
    inputs: [normalizeRuleInput('western', { required: [selected(number), tropical] })],
    ...(!ashmand.has(number) && number !== 36 && { remainingAlternatives: 1 }) };
}

function pointsFrom(facts) {
  return new Map(lillyDignityBodies.flatMap(planet => {
    const confirmed = lillyPlanetPosition(facts, planet);
    return confirmed ? [[planet, { planet, ...confirmed }]] : [];
  }));
}

function placesFrom(facts, positions, number) {
  const sects = new Set(facts.filter(f => f.kind === 'western_sect').map(f => f.sect));
  const sect = sects.size === 1 ? [...sects][0] : null;
  const mother = sect === 'day' ? positions.get('Venus') : sect === 'night' ? positions.get('Moon') : null;
  const mc = easternOrCulminatingLongitude(facts, 'mc');
  const culmination = mc === null ? null : { basis: 'mc', sign: toSign(mc),
    proof: [{ kind: 'western_geometry_midheaven', longitude: mc }] };
  const maternal = mother ? { basis: mother.planet.toLowerCase(), sign: mother.sign,
    proof: [{ kind: 'western_sect', sect }, signFact(mother)] } : null;
  let anchors;
  if (number === 17) anchors = [culmination];
  else if (number === 18 || number === 19) anchors = [sect === (number === 18 ? 'day' : 'night') ? maternal : null];
  else if (number === 20) anchors = [culmination, maternal];
  else {
    anchors = culmination && maternal && culmination.sign === maternal.sign
      ? [{ basis: 'shared', sign: culmination.sign, proof: [...culmination.proof, ...maternal.proof] }] : [];
  }
  return anchors.filter(Boolean).flatMap(anchor => [false, true].map(following => {
    const sign = (anchor.sign + Number(following)) % 12;
    return { sign, proof: [{ kind: 'western_ptolemy_siblings_place', basis: anchor.basis, sign: zodiacNames[sign], following }, ...anchor.proof] };
  }));
}

const givingPlanets = (positions, place) => benefics.map(planet => positions.get(planet)).filter(point => point && aspects[distance(point.sign, place)]);
const giverProof = (point, place) =>
  [signFact(point), relation(point.planet, 'place', place, aspects[distance(point.sign, place)])];

function obstructs(point, place) {
  const offset = steps(point.sign, place);
  return offset === 3 ? 'overcomes' : offset === 6 ? 'opposition' : null;
}

function angularOpposition(facts, mars, place) {
  if (!Number.isFinite(mars?.longitude) || distance(mars.sign, place) !== 6) return [];
  const asc = easternOrCulminatingLongitude(facts, 'ascendant'), mc = easternOrCulminatingLongitude(facts, 'mc');
  const longitudes = [asc, mc === null ? null : wrap(mc + 180), asc === null ? null : wrap(asc + 180), mc];
  return longitudes.flatMap((angle, i) => {
    const opposite = longitudes[(i + 2) % 4];
    if (!Number.isFinite(angle) || !Number.isFinite(opposite) || toSign(opposite) !== place) return [];
    const error = Math.min(wrap(mars.longitude - angle), wrap(angle - mars.longitude));
    const conflicts = [i, (i + 2) % 4].some(index => facts.some(f =>
      f.kind === 'angle_sign' && f.angle === axes[index] && f.sign !== zodiacNames[toSign(longitudes[index])]
      || f.kind === 'western_profile_cusp_longitude' && f.profile === 'regiomontanus' && f.house === axisHouses[index]
        && Math.min(wrap(f.longitude - longitudes[index]), wrap(longitudes[index] - f.longitude)) > 1e-8));
    if (error > 1 || conflicts) return [];
    return [[signFact(mars), relation('Mars', 'place', place, 'opposition'),
      { kind: 'planet_longitude', planet: 'Mars', longitude: mars.longitude },
      { kind: 'western_ptolemy_book_one_region', planet: 'Mars', region: axisRegions[i], longitude: angle, distance: error }]];
  });
}

function rulerAndFortune(giver, place, positions, number, lot) {
  const ruler = positions.get(lillyDomicileRuler(place * 30));
  if (!ruler || ruler.planet === giver.planet) return [];
  const adverse = ptolemyDisjunctSigns(giver.sign, ruler.sign) || distance(giver.sign, ruler.sign) === 6;
  if (number === 5 ? !adverse : !harmonious(giver.sign, ruler.sign)) return [];
  const config = [signFact(ruler), relation(giver.planet, ruler.planet, ruler.sign,
    aspects[distance(giver.sign, ruler.sign)] ?? 'disjunct')];
  if (number === 13 && (!lot || !harmonious(giver.sign, toSign(lot.longitude)))) return [];
  return [[...giverProof(giver, place), ...config, ...(number === 13
    ? [lot, relation(giver.planet, 'fortune', toSign(lot.longitude), aspects[distance(giver.sign, toSign(lot.longitude))])] : [])]];
}

function mundaneGender(facts, giver, number) {
  if (!Number.isFinite(giver.longitude) || !facts.some(f => f.kind === 'western_profile_system' && f.profile === 'regiomontanus')) return null;
  const houses = facts.filter(f => f.kind === 'western_profile_planet_house' && f.profile === 'regiomontanus' && f.planet === giver.planet);
  const distinct = new Set(houses.map(f => f.house));
  if (distinct.size !== 1 || !Number.isInteger(houses[0].house) || houses[0].house < 1 || houses[0].house > 12) return null;
  const east = [4, 5, 6, 10, 11, 12].includes(houses[0].house);
  return east === (number === 15) ? houses[0] : null;
}

function witnessesAt(facts, positions, place, lot, number) {
  if ([1, 17, 18, 19].includes(number)) return [[]];
  const givers = givingPlanets(positions, place);
  const maleficPositions = malefics.map(planet => positions.get(planet)).filter(Boolean);
  if (number === 2) return givers.map(giver => giverProof(giver, place));
  if (number === 3 || number === 7) {
    const sun = positions.get('Sun'), solarRelation = sun && obstructs(sun, place);
    if (number === 7 && !solarRelation) return [];
    return maleficPositions.flatMap(point => {
      const witness = obstructs(point, place);
      return witness ? [[signFact(point), relation(point.planet, 'place', place, witness), ...(number === 7
        ? [signFact(sun), relation('Sun', 'place', place, solarRelation)] : [])]] : [];
    });
  }
  if ([4, 5, 13].includes(number)) return givers.flatMap(giver => rulerAndFortune(giver, place, positions, number, lot));
  if (number === 14) return givers.map(giver => [...giverProof(giver, place), { kind: 'western_ptolemy_siblings_form',
    planet: giver.planet, form: giver.sign % 3 === 2 ? 'bicorporeal' : 'single_figure' }]);
  if (number === 15 || number === 16) return givers.flatMap(giver => {
    const house = mundaneGender(facts, giver, number);
    return house ? [[...giverProof(giver, place), house]] : [];
  });
  if (number === 20) {
    if (givers.length !== 2) return [];
    const [first, second] = givers;
    const separation = distance(first.sign, second.sign);
    return ptolemyDisjunctSigns(first.sign, second.sign) || separation === 6 ? [[...givers.flatMap(giver => giverProof(giver, place)),
      relation(first.planet, second.planet, second.sign, separation === 6 ? 'opposition' : 'disjunct')]] : [];
  }
  if (number === 22) return angularOpposition(facts, positions.get('Mars'), place);
  return givers.flatMap(giver => maleficPositions.flatMap(point => {
    const qualifies = number === 23 ? obstructs(point, giver.sign) === 'overcomes' : steps(giver.sign, point.sign) === 1;
    return qualifies ? [[...giverProof(giver, place), signFact(point),
      relation(point.planet, giver.planet, giver.sign, number === 23 ? 'overcomes' : 'following')]] : [];
  }));
}

function siblingEvidence(facts, lot, number) {
  const zodiacs = new Set(facts.filter(f => f.kind === 'western_zodiac').map(f => f.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const positions = pointsFrom(facts);
  if (number === 36) return positions.has('Mercury') ? [[signFact(positions.get('Mercury'))]] : [];
  return placesFrom(facts, positions, number).flatMap(({ sign, proof }) =>
    witnessesAt(facts, positions, sign, lot, number).map(witness => [...proof, ...witness]));
}

export function ptolemySiblingFacts(facts, requested, lot) {
  return requested.filter(f => f.kind === kind && reviewed.has(f.number) && siblingEvidence(facts, lot, f.number).length);
}

export function ptolemySiblingProof(conditions, observed) {
  const { number } = conditions.required.find(f => f.kind === kind);
  const lot = observed.find(f => f.kind === 'western_ptolemy_fortune_point');
  const alternatives = siblingEvidence(observed, lot, number);
  return { ...conditions, alternatives };
}
