import { westernStationaryHourlyLimit } from '../../control/charts.ts';
import { lillyMotionFacts, lillySolarFacts } from './lilly-solar-motion.mjs';

export const wealthQuarterBases = ['strongest', 'majority'];
export const wealthMotionWitnesses = ['oriental', 'occidental', 'retrograde', 'direct_swift'];
export const wealthLuminaryRoles = ['neither', 'both'];
export const wealthQuarter = (quarter, basis) => ({ kind: 'western_lilly_wealth_quarter', quarter, basis });
export const wealthMotionWitness = (planet, motion) => ({ kind: 'western_lilly_wealth_timing_motion', planet, motion });
export const wealthSaturnTestimony = luminaries => ({ kind: 'western_lilly_wealth_saturn', luminaries });
export const wealthScore = (planet, min, max) => ({ kind: 'western_lilly_wealth_score', planet, min, max });
const wealthPlacement = (planet, house) => ({ kind: 'western_lilly_wealth_participant', planet, house });
const quarterOf = house => 4 - Math.floor((house - 1) / 3);

export function strongestWealthCandidate(planets, ranges) {
  return planets.every(planet => ranges.has(planet)) ? planets.find(planet => planets.every(other =>
    other === planet || ranges.get(planet).min > ranges.get(other).max)) : undefined;
}

function confirmedMotion(facts, planet) {
  const speeds = new Set(facts.filter(fact => fact.kind === 'planet_hourly_motion' && fact.planet === planet)
    .map(fact => fact.signedDegrees));
  const [speed] = speeds;
  if (speeds.size !== 1 || !Number.isFinite(speed) || Math.abs(speed) > 1 || Math.abs(speed) < westernStationaryHourlyLimit) return null;
  const motion = speed < 0 ? 'retrograde' : 'direct';
  const declared = new Set(facts.filter(fact => fact.kind === 'planet_motion' && fact.planet === planet).map(fact => fact.motion));
  return !declared.size || declared.size === 1 && declared.has(motion) ? motion : null;
}

export function lillyWealthHistoryFacts(facts, members, placements, ranges, principal) {
  const witnesses = members.map(planet => wealthPlacement(planet, placements.get(planet)));
  const strongest = strongestWealthCandidate(members, ranges);
  if (strongest) {
    witnesses.push(wealthQuarter(quarterOf(placements.get(strongest)), 'strongest'));
    for (const [planet, { min, max }] of ranges) {
      if (members.includes(planet)) witnesses.push(wealthScore(planet, min, max));
    }
  }
  const majority = [1, 2, 3, 4].find(quarter =>
    members.length > 1 && members.filter(planet => quarterOf(placements.get(planet)) === quarter).length > members.length / 2);
  if (majority) witnesses.push(wealthQuarter(majority, 'majority'));

  const solar = lillySolarFacts(facts), speeds = lillyMotionFacts(facts);
  for (const planet of members) {
    const selector = planet.toLowerCase();
    for (const orientation of ['oriental', 'occidental']) {
      if (solar.some(fact => fact.selector === selector && fact.condition === orientation && fact.matches)) {
        witnesses.push(wealthMotionWitness(planet, orientation));
      }
    }
    const motion = confirmedMotion(facts, planet);
    if (motion === 'retrograde' && !['Sun', 'Moon'].includes(planet)) witnesses.push(wealthMotionWitness(planet, 'retrograde'));
    if (motion === 'direct' && speeds.some(fact => fact.selector === selector && fact.condition === 'swift' && fact.matches)) {
      witnesses.push(wealthMotionWitness(planet, 'direct_swift'));
    }
  }
  if (principal === 'Saturn' && members.includes('Sun') === members.includes('Moon')) {
    witnesses.push(wealthSaturnTestimony(members.includes('Sun') ? 'both' : 'neither'));
  }
  return witnesses;
}

export function lillyWealthHistoryProof(conditions, observed) {
  const matched = [conditions.required, ...conditions.alternatives].flat();
  const quarter = matched.some(fact => fact.kind === 'western_lilly_wealth_quarter');
  const motion = matched.filter(fact => fact.kind === 'western_lilly_wealth_timing_motion');
  const saturn = matched.some(fact => fact.kind === 'western_lilly_wealth_saturn');
  if (!quarter && !motion.length && !saturn) return conditions;
  const evidence = observed.filter(fact => (fact.kind === 'western_lilly_wealth_participant'
    && (quarter || saturn || motion.some(witness => witness.planet === fact.planet)))
    || quarter && ['western_lilly_wealth_quarter', 'western_lilly_wealth_score'].includes(fact.kind)
    || saturn && fact.kind === 'western_lilly_wealth_principal');
  const keys = new Set(matched.map(fact => JSON.stringify(fact)));
  return { ...conditions, required: [...conditions.required, ...evidence.filter(fact => !keys.has(JSON.stringify(fact)))] };
}
