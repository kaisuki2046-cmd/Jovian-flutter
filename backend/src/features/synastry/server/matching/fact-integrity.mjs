import { aspectComparisonEpsilon, findAspect, measureLongitudes, planetLabels, rulership, signAspect, signIndex, traditionalSignRuler } from '../../control/western-facts.ts';
import { algorithmDefinitions, algorithmDirections } from '../../model/algorithm-profiles.ts';
import { isConsistentBaziFact } from './bazi-fact-integrity.mjs';
import { isConsistentWesternFact } from './western-fact-integrity.mjs';
import { isConsistentZiweiFact } from './ziwei-fact-integrity.mjs';

const aspectLongitudes = {
  'western-cross-aspect': ['aLongitude', 'bLongitude'],
  'western-sun-saturn-contact': ['aLongitude', 'bLongitude'],
  'western-axis-aspect': ['aLongitude', 'bLongitude'],
  'western-planet-to-axis': ['longitude', 'axisLongitude'],
  'western-house-ruler-aspect': ['longitude', 'targetLongitude'],
  'western-ruler-to-ruler': ['aLongitude', 'bLongitude'],
};
const sameAngle = (value, expected) => Number.isFinite(value) && Math.abs(value - expected) <= aspectComparisonEpsilon;
const validSign = (value) => Number.isInteger(value) && value >= 0 && value < 12;
const validHouse = (value) => Number.isInteger(value) && value >= 1 && value <= 12;
const validBranch = (value) => typeof value === 'string' && value.length === 1 && '子丑寅卯辰巳午未申酉戌亥'.includes(value);
const luminaries = new Set(['Sun', 'Moon']);
const aspectToleranceFields = [['deviation', 'orb'], ['nativeDeviation', 'nativeOrb'], ['crossDeviation', 'crossOrb']];
const algorithmProfiles = new Map(algorithmDefinitions.map((definition) => {
  const required = definition.requiredFields.split(' ');
  return [definition.system + ':' + definition.rule, { required, directions: algorithmDirections(definition),
    tolerances: aspectToleranceFields.filter((fields) => fields.every((field) => required.includes(field))) }];
}));

export function isConsistentMatchingFact(fact) {
  const { system, rule, direction, facts } = fact;
  const profile = algorithmProfiles.get(system + ':' + rule);
  if (profile && (!profile.directions.includes(direction) || !profile.required.every((field) => Object.hasOwn(facts, field))
    || !profile.tolerances.every(([field, limit]) => Number.isFinite(facts[field]) && facts[field] >= 0
      && Number.isFinite(facts[limit]) && facts[limit] >= 0 && facts[field] <= facts[limit] + aspectComparisonEpsilon))) return false;
  if (system === 'bazi' && rule === 'bazi-cross-year-month') {
    return direction === 'mutual' && validBranch(facts.aBranch) && validBranch(facts.bBranch)
      && (facts.aPosition === 'year' && facts.bPosition === 'month' || facts.aPosition === 'month' && facts.bPosition === 'year');
  }
  if (system === 'bazi') return isConsistentBaziFact(fact);
  if (system === 'ziwei') return isConsistentZiweiFact(fact);
  if (system !== 'western') return true;
  if (!isConsistentWesternFact(fact)) return false;
  if (rule === 'western-whole-sign-overlay') {
    const { planet, longitude, house, targetAscendant } = facts;
    return (direction === 'a_to_b' || direction === 'b_to_a') && Object.hasOwn(planetLabels, planet)
      && Number.isFinite(longitude) && Number.isFinite(targetAscendant)
      && house === (signIndex(longitude) - signIndex(targetAscendant) + 12) % 12 + 1;
  }
  if (rule === 'western-sun-saturn-contact' && (facts.angle !== 0
    || !(direction === 'a_to_b' && facts.aPlanet === 'Sun' && facts.bPlanet === 'Saturn'
      || direction === 'b_to_a' && facts.aPlanet === 'Saturn' && facts.bPlanet === 'Sun'))) return false;
  if (rule === 'western-ruler-to-ruler' && (direction !== 'mutual' || facts.rulership !== rulership
    || !validHouse(facts.aHouse) || !validHouse(facts.bHouse) || !validSign(facts.aSign) || !validSign(facts.bSign)
    || facts.aRuler !== traditionalSignRuler(facts.aSign) || facts.bRuler !== traditionalSignRuler(facts.bSign))) return false;
  if (rule === 'western-luminary-sign-aspect') {
    return luminaries.has(facts.aBody) && luminaries.has(facts.bBody) && facts.aBody !== facts.bBody
      && validSign(facts.aSign) && validSign(facts.bSign) && facts.angle === signAspect(facts.aSign, facts.bSign);
  }
  if (rule === 'western-ascendant-sign-comparison') {
    const { aLongitude, bLongitude, aAscSign, bAscSign, sameSign } = facts;
    return direction === 'mutual' && Number.isFinite(aLongitude) && Number.isFinite(bLongitude)
      && aAscSign === signIndex(aLongitude) && bAscSign === signIndex(bLongitude) && sameSign === Number(aAscSign === bAscSign);
  }
  if (rule === 'western-four-places-by-sign') {
    const pairs = ['Sun', 'Moon', 'Asc', 'Fortune'].map((part) => [facts['a' + part + 'Sign'], facts['b' + part + 'Sign']]);
    return pairs.flat().every(validSign) && facts.sameSignCount === pairs.filter(([a, b]) => a === b).length;
  }
  if (rule === 'western-matching-planet-angle') {
    const measured = measureLongitudes(facts.aLongitude, facts.bLongitude);
    return Boolean(measured && sameAngle(facts.degrees, measured.degrees));
  }
  if (!Object.hasOwn(aspectLongitudes, rule)) return true;
  const [first, second] = aspectLongitudes[rule];
  const expected = findAspect(facts[first], facts[second])?.facts;
  if (!expected) return false;
  return facts.angle === expected.angle && sameAngle(facts.degrees, expected.degrees)
    && sameAngle(facts.deviation, expected.deviation)
    && Number.isFinite(facts.orb) && facts.orb >= 0
    && facts.orb <= expected.orb + aspectComparisonEpsilon;
}
