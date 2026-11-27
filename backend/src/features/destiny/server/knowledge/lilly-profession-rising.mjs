import { westernGeometryPlanets } from '../../control/western-fixed-stars.mjs';
import { lillyAspect, lillyOrbTables } from './lilly-aspects.mjs';
import { lillyHorizonRisePhases } from './lilly-coangles.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';

export const lillyProfessionBodies = ['Mercury', 'Venus', 'Mars'];
export const lillyProfessionAccountBases = [
  'both_lord', 'both_placed', 'morning_only', 'midheaven_lord_only', 'midheaven_placed_only',
];
export const lillyProfessionAccountFact = (planet, basis) => ({ kind: 'western_lilly_profession_account', planet, basis });
const epsilon = 1e-8;
const cycle = value => (value % 360 + 360) % 360;
const earlier = (solar, body) => {
  const gap = cycle(solar - body);
  if (gap < epsilon || 360 - gap < epsilon || Math.abs(gap - 180) < epsilon) return null;
  return gap < 180;
};

export function lillyProfessionRising(facts, cusps) {
  const longitudes = new Map(westernGeometryPlanets.map(planet => [planet, lillyPlanetPosition(facts, planet)?.longitude]));
  const phases = lillyHorizonRisePhases(facts, cusps, longitudes);
  const sun = phases.get('Sun'), sunLongitude = longitudes.get('Sun');
  const beforeSun = planet => {
    const phase = phases.get(planet);
    if (!Number.isFinite(sun) || !Number.isFinite(phase)) return null;
    const geometric = earlier(sun, phase), zodiacal = earlier(sunLongitude, longitudes.get(planet));
    return geometric === zodiacal ? geometric : null;
  };
  return { longitudes, phases, beforeSun };
}

export function lillyFirstMoverCandidate(rising) {
  const ranked = lillyProfessionBodies.map(planet => [planet, rising.beforeSun(planet)]);
  if (ranked.some(([, precedes]) => precedes === null)) return undefined;
  const candidates = ranked.filter(([, precedes]) => precedes);
  // p.625 gives no ordering when several candidates precede the Sun.
  return candidates.length === 1 ? candidates[0][0] : undefined;
}

function lillyMidheavenMoon(planet, longitude, moon) {
  if (planet === 'Moon') return false;
  const outcomes = Object.keys(lillyOrbTables).map(table =>
    ['sextile', 'square', 'trine', 'opposition'].some(aspect =>
      lillyAspect(longitude, moon, planet.toLowerCase(), 'moon', aspect, table) === true));
  return outcomes[0] === outcomes[1] ? outcomes[0] : null;
}

export function lillyProfessionPtolemyAccountFacts(rising, midheavenLord, houseOf) {
  const { longitudes, phases, beforeSun } = rising;
  if (!midheavenLord || westernGeometryPlanets.some(planet => !Number.isFinite(phases.get(planet)))) return [];
  const sun = phases.get('Sun');
  const candidates = westernGeometryPlanets.filter(planet => planet !== 'Sun')
    .map(planet => ({ planet, gap: cycle(sun - phases.get(planet)) }))
    .sort((a, b) => a.gap - b.gap);
  const [nearest, next] = candidates;
  // Only positive evidence, with all possible intervening bodies accounted for.
  if (!lillyProfessionBodies.includes(nearest.planet) || beforeSun(nearest.planet) !== true
    || next.gap - nearest.gap <= epsilon) return [];
  const moon = longitudes.get('Moon');
  const midheaven = planet => {
    const lord = planet === midheavenLord, placed = houseOf.get(planet) === 10;
    const qualifies = (lord || placed) && lillyMidheavenMoon(planet, longitudes.get(planet), moon);
    return { lord, placed, qualifies };
  };
  const morning = midheaven(nearest.planet);
  if (morning.qualifies === null) return [];
  if (morning.qualifies) return [
    ...(morning.lord ? [lillyProfessionAccountFact(nearest.planet, 'both_lord')] : []),
    ...(morning.placed ? [lillyProfessionAccountFact(nearest.planet, 'both_placed')] : []),
  ];
  return [
    lillyProfessionAccountFact(nearest.planet, 'morning_only'),
    ...lillyProfessionBodies.filter(planet => planet !== nearest.planet).flatMap(planet => {
      const { lord, placed, qualifies } = midheaven(planet);
      if (qualifies !== true) return [];
      return [
        ...(lord ? [lillyProfessionAccountFact(planet, 'midheaven_lord_only')] : []),
        ...(placed ? [lillyProfessionAccountFact(planet, 'midheaven_placed_only')] : []),
      ];
    }),
  ];
}
