import { westernStationaryHourlyLimit, zodiacNames } from '../../control/charts.ts';
import { lillyAspectAngles, lillyPartileDistance } from './lilly-aspects.mjs';

const malefics = ['Mars', 'Saturn'];
const benefics = ['Jupiter', 'Venus'];
export const birthCompanions = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
export const obliqueBirthSigns = [9, 10, 11, 0, 1, 2].map(index => zodiacNames[index]);
export const longBirthSigns = zodiacNames.filter(sign => !obliqueBirthSigns.includes(sign));
export const difficultBirthRays = malefics.flatMap(planet => ['square', 'opposition'].map(aspect => ({ planet, aspect })));
export const easyBirthRays = benefics.flatMap(planet => ['sextile', 'square', 'trine', 'opposition'].map(aspect => ({ planet, aspect })));
const ascendantRays = [...difficultBirthRays, ...easyBirthRays];

export const birthAscendant = sign => ({ kind: 'western_lilly_family_birth_ascendant', sign });
export const birthAscendantRay = ({ planet, aspect }) => ({ kind: 'western_lilly_family_birth_ascendant_ray', planet, aspect });
export const birthAttendantMotion = (planet, motion) => ({ kind: 'western_lilly_family_birth_motion', planet, motion });

export function isLillyFamilyBirthFact(fact) {
  switch (fact.kind) {
    case 'western_lilly_family_birth_ascendant': return zodiacNames.includes(fact.sign);
    case 'western_lilly_family_birth_ascendant_ray':
      return ascendantRays.some(({ planet, aspect }) => fact.planet === planet && fact.aspect === aspect);
    case 'western_lilly_family_birth_motion':
      return birthCompanions.includes(fact.planet) && ['retrograde', 'stationary'].includes(fact.motion);
    default: return false;
  }
}

export function lillyFamilyBirthFacts(facts, known, ascendant) {
  if (!Number.isFinite(ascendant)) return [];
  const results = [birthAscendant(zodiacNames[Math.floor(ascendant / 30)])];
  for (const ray of ascendantRays) {
    const position = known.get(ray.planet);
    if (position && lillyPartileDistance(position.longitude, ascendant) === lillyAspectAngles[ray.aspect]) {
      results.push(birthAscendantRay(ray));
    }
  }

  if (!obliqueBirthSigns.includes(zodiacNames[known.get('Moon')?.sign])) return results;
  for (const planet of birthCompanions) {
    if (!known.has(planet)) continue;
    const speeds = new Set(facts.filter(fact => fact.kind === 'planet_hourly_motion' && fact.planet === planet).map(fact => fact.signedDegrees));
    const [speed] = speeds;
    if (speeds.size !== 1 || !Number.isFinite(speed) || Math.abs(speed) > 1) continue;
    const motion = Math.abs(speed) < westernStationaryHourlyLimit ? 'stationary' : speed < 0 ? 'retrograde' : 'direct';
    const declarations = new Set(facts.filter(fact => fact.kind === 'planet_motion' && fact.planet === planet).map(fact => fact.motion));
    if (motion !== 'direct' && (!declarations.size || declarations.size === 1 && declarations.has(motion))) {
      results.push(birthAttendantMotion(planet, motion));
    }
  }
  return results;
}
