import { westernStationaryHourlyLimit, zodiacNames } from '../../control/charts.ts';
import { lillyAspectAngles } from './lilly-aspects.mjs';

const bodies = ['Saturn', 'Jupiter'];
const upper = ['ascendant', 'mc'];
const configurations = ['upper', 'mc_west'];
const witnesses = ['positions', 'bicorporeal', 'moon_applying', 'moon_separating'];
const aspects = ['sextile', 'square', 'trine', 'opposition'];
const directedRays = aspects.flatMap(aspect => {
  const degrees = lillyAspectAngles[aspect];
  return (aspect === 'opposition' ? [degrees] : [degrees, 360 - degrees]).map(angle => ({ angle, aspect }));
});
const arc = value => ((value + 180) % 360 + 360) % 360 - 180;
export const inheritance = (configuration, evidence) => ({ kind: 'western_ptolemy_fortune_inheritance', configuration, evidence });
const placement = (planet, angle) => ({ kind: 'western_ptolemy_fortune_angle', planet, angle });
const moonRay = (aspect, phase) => ({ kind: 'western_ptolemy_fortune_moon_ray', aspect, phase });

export function isPtolemyFortuneAngleFact(fact) {
  if (fact.kind === 'western_ptolemy_fortune_inheritance') return configurations.includes(fact.configuration) && witnesses.includes(fact.evidence);
  if (fact.kind === 'western_ptolemy_fortune_angle') return bodies.includes(fact.planet)
    && [...upper, 'descendant'].includes(fact.angle);
  return fact.kind === 'western_ptolemy_fortune_moon_ray' && aspects.includes(fact.aspect) && ['applying', 'separating'].includes(fact.phase);
}

export function easternOrCulminatingLongitude(facts, angle) {
  // Older charts also carry the same ecliptic angle as the relevant cusp.
  const rawKind = angle === 'ascendant' ? 'western_geometry_ascendant' : 'western_geometry_midheaven';
  const house = angle === 'ascendant' ? 1 : 10;
  const direct = new Set(facts.filter(fact => fact.kind === rawKind).map(fact => fact.longitude));
  const cusps = new Set(facts.filter(fact => fact.kind === 'western_profile_cusp_longitude'
    && fact.profile === 'regiomontanus' && fact.house === house).map(fact => fact.longitude));
  const [cusp] = cusps, [longitude] = direct.size ? direct : cusps;
  if (direct.size > 1 || cusps.size > 1 || !Number.isFinite(longitude) || longitude < 0 || longitude >= 360
    || cusps.size && (!Number.isFinite(cusp) || Math.abs(arc(cusp - longitude)) > 1e-8)
    || facts.some(fact => fact.kind === 'angle_sign' && fact.angle === angle
      && fact.sign !== zodiacNames[Math.floor(longitude / 30)])) return null;
  return longitude;
}

export function confirmedHourlyMotion(facts, planet) {
  const values = new Set(facts.filter(fact => fact.kind === 'planet_hourly_motion' && fact.planet === planet).map(fact => fact.signedDegrees));
  const [speed] = values;
  if (values.size !== 1 || !Number.isFinite(speed) || Math.abs(speed) > 1) return null;
  const labels = new Set(facts.filter(fact => fact.kind === 'planet_motion' && fact.planet === planet).map(fact => fact.motion));
  const direction = Math.abs(speed) < westernStationaryHourlyLimit ? 'stationary' : speed > 0 ? 'direct' : 'retrograde';
  return !labels.size || labels.size === 1 && labels.has(direction) ? speed : null;
}

export function ptolemyLunarRay(facts, moonLongitude, jupiterLongitude) {
  const lunar = confirmedHourlyMotion(facts, 'Moon'), jovian = confirmedHourlyMotion(facts, 'Jupiter');
  if (lunar === null || jovian === null || lunar <= 0 || lunar - jovian <= westernStationaryHourlyLimit) return null;
  const separation = moonLongitude - jupiterLongitude;
  for (const { angle, aspect } of directedRays) {
    const degrees = arc(separation - angle);
    // I.24 requires a short interval. Three degrees is the supported close-ray case.
    if (Math.abs(degrees) > 1e-9 && Math.abs(degrees) <= 3) return moonRay(aspect, degrees < 0 ? 'applying' : 'separating');
  }
  return null;
}

export function ptolemyInheritanceFacts(facts, positions, ascendant) {
  const jupiter = positions.get('Jupiter'), saturn = positions.get('Saturn');
  const midheaven = easternOrCulminatingLongitude(facts, 'mc');
  if (midheaven === null) return [];
  const east = Math.floor(ascendant / 30), mc = Math.floor(midheaven / 30), west = (east + 6) % 12;
  const upperPair = saturn.sign === mc && jupiter.sign === east ? ['mc', 'ascendant']
    : saturn.sign === east && jupiter.sign === mc ? ['ascendant', 'mc'] : null;
  const westPair = saturn.sign === mc && jupiter.sign === west
    && !facts.some(fact => fact.kind === 'angle_sign' && fact.angle === 'descendant' && fact.sign !== zodiacNames[west]);
  if (!upperPair && !westPair) return [];
  const configuration = upperPair ? 'upper' : 'mc_west';
  const [saturnAngle, jupiterAngle] = upperPair ?? ['mc', 'descendant'];
  const found = [inheritance(configuration, 'positions'), placement('Saturn', saturnAngle), placement('Jupiter', jupiterAngle)];
  if ([2, 5, 8, 11].includes(jupiter.sign)) found.push(inheritance(configuration, 'bicorporeal'));
  const ray = ptolemyLunarRay(facts, positions.get('Moon').longitude, jupiter.longitude);
  if (ray) found.push(ray, inheritance(configuration, ray.phase === 'applying' ? 'moon_applying' : 'moon_separating'));
  return found;
}
