import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { normalizeRuleInput } from './matching.mjs';
import { isPtolemyContextFact, isPtolemyContextWitness, ptolemyContextSource, recordPtolemyContext } from './ptolemy-book-one-context.mjs';
import { isPtolemyBookOneConditionFact, isPtolemyBookOneConditionWitness, ptolemyBookOneConditionSource,
  recordPtolemyBookOneConditions } from './ptolemy-book-one-conditions.mjs';

export const ptolemyBookOneProfile = 'ptolemy-robbins-1940-book-one-witnesses-v1';
const nature = { Sun: 'masculine_nature', Moon: 'feminine_nature', Mercury: 'common_nature', Venus: 'feminine_nature',
  Mars: 'masculine_nature', Jupiter: 'masculine_nature', Saturn: 'masculine_nature' };
const bodies = Object.keys(nature);
const phases = ['waxing_first', 'waxing_second', 'waning_first', 'waning_second'];
const wholeSignAspects = new Map([[2, 'sextile'], [3, 'square'], [4, 'trine'], [6, 'opposition']]);
// House numbers follow ecliptic order. The trial uses the native 3D quadrants.
const quadrants = ['ic_asc', 'west_ic', 'mc_west', 'asc_mc'];
const phaseBoundary = 1e-9;
const wrap = angle => (angle + 360) % 360;
const selector = witness => ({ kind: 'western_ptolemy_book_one_selector', witness });
const orbit = (planet, elongation) => ({ kind: 'western_ptolemy_book_one_elongation', planet, elongation });
const compared = (first, second, firstSign, secondSign, steps) => ({ kind: 'western_ptolemy_book_one_pair', first, second,
  firstSign: zodiacNames[firstSign], secondSign: zodiacNames[secondSign], steps });
const reflection = (first, second, axis, anchor, steps) => ({ kind: 'western_ptolemy_book_one_reflection', first, second, axis,
  anchorSign: zodiacNames[anchor], steps });

const reviewed = new Map();
function chapter(number, records, needsTropical = false) {
  for (const [passage, hash, ...selectors] of records) {
    reviewed.set(`astro-ptolemy-v1-chapter-${number}-p${String(passage).padStart(3, '0')}-001`,
      { hash, selectors, needsTropical });
  }
}
chapter(6, [
  [1, '94193b28b500038e9623da3a0fee8ba411cac69046fa2ff0d3b50f64d966100f', 'masculine_nature'],
  [2, 'f03012a78314d195443190a7e4874c03edc5ced8f49732905f91d9ec6578677a', 'feminine_nature'],
  [3, '1f77b6dd081b6bec81b1801f95aa9950b486be4ec808168226381075f951de19', 'common_nature'],
  [4, 'd818d36f4218a9ef6bd45efc706293c3f9fdbf98158579f164295671594ff247', 'morning'],
  [5, '8b1314b3c48caf71633836bd3335a82802ac55eb284f46f01ff177629bead889', 'evening'],
  [6, '917bd0dde4dcd3df8bfa32f8be8d4f706a28fda391bd480522d40d5ba4e7541a', 'asc_mc', 'west_ic'],
  [7, 'edc4956fb889c274c9db93842f1ca82c3928f5e8355a33813baec5691e5cd4c0', 'mc_west', 'ic_asc'],
]);
chapter(7, [
  [3, 'aab80a3ca0471a8b17c0712574193ad923d8c8699deb14a8bab63b5e6b5265c1', 'mercury_day'],
  [4, 'f52fd30df48c33a79d2ab904e875105ee7cee6b9c6bb7126850dcef324c3b05c', 'mercury_night'],
  [5, 'be9ad5df4a3a783c6736abbb9ca0e604ddbc6924320f9954548f4f3bdb09c3e1', 'saturn_day'],
  [6, 'be2bed34ecda91f61e1da738442fdb1f0f12c79c401f57ddd0e8d2b900c41fd4', 'mars_night'],
]);
chapter(8, [
  [1, '21f75cab99341e6bbf0073734b78c236edc8b7605388b16699816cc5d1deed66', 'waxing_first'],
  [2, '1f35a0d70a66815b7927516e92574f5643863cd8413ba256e8714f2280966655', 'waxing_second'],
  [3, '3968d7762b78eb5cc99bf34db12e51bf866e756475bd0061147bd7e7e04dd926', 'waning_first'],
  [4, 'decedd178121c51b9628be1057085a0f545f6a039fbfbddcd2366ce34764f972', 'waning_second'],
]);
chapter(13, [
  [1, '1150dd6149bc3f6e9fe34987da9cf07de302972539a4491f8c641d238a976ed7', 'sextile'],
  [2, 'fdcb37fc339648c75d2598b3a59e85025b7d6c9978fb9516a30b9c2e74246a2c', 'square'],
  [3, '4435709f2850c5c6109e28dcffaf672531d65039e61df99891a7c338e59869a6', 'trine'],
  [4, '7738e3c5fce86f9a78ed989af5a3d250fb949cc55800c9e68df768a3812e0afe', 'opposition'],
], true);
chapter(14, [
  [1, 'ce0ed6c26f9fd64432aee7746429923c660f0186aa1d02b44cf142e75ee1567b', 'equinox'],
  [2, '486906444804ff2dfa13b1f875d77767316d8f05038794dbb5f66e25c29d9464', 'commanding'],
  [3, '099f03f1ae85a5c1c2b70a596f62b15d7e5c897f403778ff7f426a541d4cc922', 'obeying'],
], true);
chapter(15, [
  [1, 'a35235cba251e102e9d058d9e5a7ba31e5961d9fe848b85d6f824fe91c789fe3', 'solstice'],
], true);
chapter(16, [
  [1, '96e7741bc0f3d2d4f6ec1ae64b790f512fad3f0bea57c411ca520fec59a34662', 'disjunct_one', 'disjunct_five'],
], true);
const witnesses = new Set([...reviewed.values()].flatMap(spec => spec.selectors));
const partialWitnesses = new Set(['waning_second', 'east', 'south', 'west', 'north', 'akin_quality', 'opposed_quality',
  'sign_asc_mc', 'sign_west_ic', 'sign_mc_west', 'sign_ic_asc']);

export function isPtolemyBookOneFact(fact) {
  switch (fact.kind) {
    case 'western_ptolemy_book_one_selector': return witnesses.has(fact.witness) || isPtolemyContextWitness(fact.witness)
      || isPtolemyBookOneConditionWitness(fact.witness);
    case 'western_ptolemy_book_one_elongation': return bodies.includes(fact.planet) && fact.planet !== 'Sun'
      && Number.isFinite(fact.elongation) && fact.elongation >= 0 && fact.elongation < 360;
    case 'western_ptolemy_book_one_pair': return bodies.includes(fact.first) && bodies.includes(fact.second)
      && fact.first !== fact.second && zodiacNames.includes(fact.firstSign) && zodiacNames.includes(fact.secondSign)
      && Number.isInteger(fact.steps) && fact.steps >= 1 && fact.steps <= 6;
    case 'western_ptolemy_book_one_reflection': return bodies.includes(fact.first) && bodies.includes(fact.second)
      && fact.first !== fact.second && ['equinox', 'solstice'].includes(fact.axis)
      && (fact.axis === 'equinox' ? ['白羊座', '天秤座'] : ['巨蟹座', '摩羯座']).includes(fact.anchorSign)
      && Number.isInteger(fact.steps) && fact.steps >= 1 && fact.steps <= 3;
    default: return isPtolemyContextFact(fact) || isPtolemyBookOneConditionFact(fact);
  }
}

export function compilePtolemyBookOne(claim) {
  const spec = reviewed.get(claim.id) ?? ptolemyContextSource(claim.id) ?? ptolemyBookOneConditionSource(claim.id);
  if (!spec) return undefined;
  const { source, conditions, evidence } = claim;
  const hash = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (hash !== spec.hash) return { reason: 'source_review_required', reviewNote: '《四书》卷一原文、出处或取证条件有变，须重新复核。' };
  const input = witness => normalizeRuleInput('western', { required: [
    ...(spec.needsTropical ? [{ kind: 'western_zodiac', zodiac: 'tropical' }] : []), selector(witness),
  ] });
  return { compiler: ptolemyBookOneProfile, inputs: spec.selectors.map(input), matchScope: 'historical_aphorism',
    ...((spec.partial || spec.selectors.some(witness => partialWitnesses.has(witness))) && { remainingAlternatives: 1 }) };
}

export const ptolemyBookOneRequiresDignities = id => ptolemyBookOneConditionSource(id)?.selectors.includes('two_familiarities') === true;

const positionProof = (planet, { longitude, sign }) => Number.isFinite(longitude)
  ? { kind: 'planet_longitude', planet, longitude }
  : { kind: 'planet_sign', planet, sign: zodiacNames[sign] };
const signDistance = (a, b) => {
  const gap = Math.abs(a - b);
  return Math.min(gap, 12 - gap);
};

export function ptolemyDisjunctSigns(first, second) {
  return [1, 5].includes(signDistance(first, second)) && ![0, 6].includes((first + second) % 12);
}

function recordPair(record, [first, a], [second, b]) {
  const steps = signDistance(a.sign, b.sign);
  if (!steps) return;
  const pair = compared(first, second, a.sign, b.sign, steps);
  const axisIndex = (a.sign + b.sign) % 12;
  const aspect = wholeSignAspects.get(steps);
  if (aspect) {
    record(aspect, pair);
    const luminaries = ['Sun', 'Moon'];
    if (luminaries.includes(first) !== luminaries.includes(second)) record('luminary_quality', pair);
  }
  // Robbins notes 80 and 83 give the pairs counted from the signs themselves.
  if (ptolemyDisjunctSigns(a.sign, b.sign)) {
    record(steps === 1 ? 'disjunct_one' : 'disjunct_five', pair);
  }
  if (axisIndex !== 0 && axisIndex !== 6) return;
  const axis = axisIndex === 0 ? 'equinox' : 'solstice';
  const anchors = axis === 'equinox' ? [0, 6] : [3, 9];
  const nearest = Math.min(...anchors.map(anchor => signDistance(a.sign, anchor)));
  const detail = (subject, object) => anchors.filter(anchor => signDistance(a.sign, anchor) === nearest)
    .map(anchor => reflection(subject, object, axis, anchor, nearest));
  record(axis, pair, ...detail(first, second));
  if (axis === 'equinox') {
    record(a.sign < 6 ? 'commanding' : 'obeying', pair, ...detail(first, second));
    record(b.sign < 6 ? 'commanding' : 'obeying', compared(second, first, b.sign, a.sign, steps), ...detail(second, first));
  }
}

function bookOneEvidence(facts, dignitiesAt) {
  const evidence = new Map();
  const record = (name, ...proof) => {
    if (!evidence.has(name)) evidence.set(name, []);
    evidence.get(name).push(...proof);
  };
  const positions = new Map(bodies.map(planet => [planet, lillyPlanetPosition(facts, planet)]).filter(([, p]) => p));
  const sun = positions.get('Sun')?.longitude;
  const sects = new Set(facts.filter(fact => fact.kind === 'western_sect').map(fact => fact.sect));
  const chartSect = sects.size === 1 ? [...sects][0] : null;
  const geo = facts.some(fact => fact.kind === 'western_profile_system' && fact.profile === 'regiomontanus');
  for (const [planet, position] of positions) {
    const coordinates = positionProof(planet, position);
    record(nature[planet], coordinates);
    if ((planet === 'Saturn' && chartSect === 'day') || (planet === 'Mars' && chartSect === 'night')) {
      record(planet === 'Saturn' ? 'saturn_day' : 'mars_night', coordinates, { kind: 'western_sect', sect: chartSect });
    }
    if (geo) {
      const houses = new Set(facts.filter(fact => fact.kind === 'western_profile_planet_house' && fact.planet === planet
        && fact.profile === 'regiomontanus').map(fact => fact.house));
      const [house] = houses;
      if (houses.size === 1 && Number.isInteger(house) && house >= 1 && house <= 12) {
        record(quadrants[Math.floor((house - 1) / 3)],
          { kind: 'western_profile_planet_house', profile: 'regiomontanus', planet, house });
      }
    }
    if (planet === 'Sun' || ![sun, position.longitude].every(Number.isFinite)) continue;
    const elongation = wrap(position.longitude - sun);
    const detail = [positionProof('Sun', positions.get('Sun')), coordinates, orbit(planet, elongation)];
    if ([0, 180, 360].every(boundary => Math.abs(elongation - boundary) > phaseBoundary)) {
      const beforeSun = elongation > 180;
      record(beforeSun ? 'morning' : 'evening', ...detail);
      if (planet === 'Mercury') record(beforeSun ? 'mercury_day' : 'mercury_night', ...detail);
    }
    if (planet === 'Moon' && [0, 90, 180, 270, 360].every(boundary => Math.abs(elongation - boundary) > phaseBoundary)) {
      record(phases[Math.floor(elongation / 90)], ...detail);
    }
  }
  const zodiac = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  const tropical = zodiac.size === 1 && zodiac.has('tropical');
  if (tropical) {
    const entries = [...positions];
    for (let i = 0; i < entries.length; i++) {
      for (const second of entries.slice(i + 1)) recordPair(record, entries[i], second);
    }
    recordPtolemyBookOneConditions(facts, positions, dignitiesAt, record);
  }
  recordPtolemyContext(facts, positions, tropical, record);
  return evidence;
}

export function ptolemyBookOneFacts(facts, dignitiesAt) {
  return [...bookOneEvidence(facts, dignitiesAt).keys()].map(selector);
}

export function ptolemyBookOneProof(conditions, facts, dignitiesAt) {
  const observed = bookOneEvidence(facts, dignitiesAt);
  const proof = [conditions.required, ...conditions.alternatives].flat()
    .filter(fact => fact.kind === 'western_ptolemy_book_one_selector').flatMap(({ witness }) => observed.get(witness) ?? []);
  return { ...conditions, required: [...new Map([...conditions.required, ...proof].map(fact => [JSON.stringify(fact), fact])).values()] };
}
