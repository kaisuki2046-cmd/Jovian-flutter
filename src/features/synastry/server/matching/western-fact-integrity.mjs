import { planetLabels, rulership, signIndex, traditionalSignRuler } from '../../control/western-facts.ts';

const axes = new Set(['ASC', 'DSC', 'MC', 'IC']);
const isPlanet = (planet) => typeof planet === 'string' && Object.hasOwn(planetLabels, planet);
const isDirectional = (direction) => direction === 'a_to_b' || direction === 'b_to_a';

function isTraditionalHouseRuler({ house, sign, ruler, rulership: scheme }) {
  return Number.isInteger(house) && house >= 1 && house <= 12
    && Number.isInteger(sign) && sign >= 0 && sign < 12
    && scheme === rulership && ruler === traditionalSignRuler(sign);
}

export function isConsistentWesternFact({ rule, direction, facts }) {
  switch (rule) {
    case 'western-cross-aspect':
      return direction === 'mutual' && isPlanet(facts.aPlanet) && isPlanet(facts.bPlanet);
    case 'western-matching-planet-angle':
      return direction === 'mutual' && isPlanet(facts.planet);
    case 'western-axis-aspect':
      return direction === 'mutual' && axes.has(facts.aAxis) && axes.has(facts.bAxis);
    case 'western-planet-to-axis':
      return isDirectional(direction) && isPlanet(facts.planet) && axes.has(facts.axis);
    case 'western-house-ruler-overlay': {
      const { longitude, targetAscendant, targetHouse } = facts;
      return isDirectional(direction) && isTraditionalHouseRuler(facts)
        && Number.isFinite(longitude) && Number.isFinite(targetAscendant)
        && targetHouse === (signIndex(longitude) - signIndex(targetAscendant) + 12) % 12 + 1;
    }
    case 'western-house-ruler-aspect':
      return isDirectional(direction) && isTraditionalHouseRuler(facts) && isPlanet(facts.targetPlanet);
    default:
      return true;
  }
}
