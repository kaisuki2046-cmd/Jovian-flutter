import { lillyAspect, lillyOrbTables, lillyPartileDistance } from './lilly-aspects.mjs';

export const estateMalefics = ['Mars', 'Saturn'];
export const estatePressurePaths = ['second_ruler', 'fourth_house_and_ruler'];
export const estatePressure = (planet, path, table) => ({ kind: 'western_lilly_family_estate_pressure', planet, path, table });
const hard = ['conjunction', 'square', 'opposition'];
const hardRays = [90, 180];

function cuspContact(point, cusp, angles) {
  return point && Number.isFinite(cusp) && angles.includes(lillyPartileDistance(point.longitude, cusp));
}

export function lillyEstatePressureFacts(known, placements, rulers, cusps, sect, weak) {
  const results = [];
  const second = cusps?.[1], fourth = cusps?.[3];
  const sun = known.get('Sun'), mars = known.get('Mars');
  if (hardRays.some(angle => cuspContact(sun, second, [angle]) && cuspContact(mars, second, [angle]))) {
    results.push({ kind: 'western_lilly_family_configuration', selector: 'estate_sun_mars_rays_second' });
  }
  if (sect !== 'night') return results;

  const secondRuler = rulers.get(2), fourthRuler = rulers.get(4);
  const houseAfflicted = (house, cusp) => estateMalefics.some(planet =>
    placements.get(planet) === house || cuspContact(known.get(planet), cusp, [0, ...hardRays]));
  if (!secondRuler || !known.has(secondRuler) || !weak(secondRuler) || !houseAfflicted(2, second)) return results;
  const fourthAfflicted = fourthRuler && known.has(fourthRuler) && houseAfflicted(4, fourth);
  for (const table of Object.keys(lillyOrbTables)) {
    const afflictedBy = (planet, target) => hard.some(name =>
      lillyAspect(known.get(planet)?.longitude, known.get(target)?.longitude, planet.toLowerCase(), target.toLowerCase(), name, table) === true);
    for (const planet of estateMalefics) {
      if (!afflictedBy(planet, 'Moon')) continue;
      if (afflictedBy(planet, secondRuler)) results.push(estatePressure(planet, 'second_ruler', table));
      if (fourthAfflicted && estateMalefics.some(body => afflictedBy(body, fourthRuler))) {
        results.push(estatePressure(planet, 'fourth_house_and_ruler', table));
      }
    }
  }
  return results;
}
