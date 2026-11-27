import { zodiacNames } from '../../control/charts.ts';
import { lillyCusps, lillyDomicileRuler, lillyHouse } from '../../control/lilly-houses.mjs';

export const lillyFortuneProfile = 'lilly-1647-fortune-v1';

function planetLongitude(facts, planet) {
  const coordinates = new Set(facts.filter(fact => fact.kind === 'planet_longitude' && fact.planet === planet)
    .map(fact => fact.longitude));
  const [longitude] = coordinates;
  if (coordinates.size !== 1 || !Number.isFinite(longitude) || longitude < 0 || longitude >= 360) return null;
  return facts.some(fact => fact.kind === 'planet_sign' && fact.planet === planet
    && fact.sign !== zodiacNames[Math.floor(longitude / 30)]) ? null : longitude;
}

export function lillyFortune(facts) {
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return null;
  const cusps = lillyCusps(facts);
  if (!cusps || facts.some(fact => fact.kind === 'angle_sign' && fact.angle === 'ascendant'
    && fact.sign !== zodiacNames[Math.floor(cusps[0] / 30)])) return null;
  const sun = planetLongitude(facts, 'Sun');
  const moon = planetLongitude(facts, 'Moon');
  if (sun === null || moon === null) return null;
  // Christian Astrology (1647), p.143: the same directed arc in both sects.
  const longitude = (cusps[0] + moon - sun + 360) % 360;
  const ruler = lillyDomicileRuler(longitude);
  const placed = planetLongitude(facts, ruler);
  return { longitude, house: lillyHouse(longitude, cusps), ruler, rulerHouse: placed === null ? null : lillyHouse(placed, cusps) };
}

export function lillyFortuneFacts(fortune) {
  if (!fortune) return [];
  const placements = [['lot', fortune.house], ['ruler', fortune.rulerHouse]];
  return placements.flatMap(([selector, house]) => house === null ? []
    : [{ kind: 'western_lilly_fortune_house', selector, house, profile: lillyFortuneProfile }]);
}

export function lillySharedRulerFacts(fortune, houses, raw) {
  if (!fortune || !houses.some(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === 2 && fact.planet === fortune.ruler)) return [];
  const classical = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  const empty = classical.every(planet => planetLongitude(raw, planet) !== null
    && houses.some(fact => fact.kind === 'western_lilly_planet_house' && fact.planet === planet && fact.house !== 2));
  return empty ? [{ kind: 'western_lilly_empty_second_shared_ruler' }] : [];
}

export function lillyAscendantRulerFacts(houses, raw) {
  const lord = houses.find(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === 1);
  if (!lord) return [];
  const longitude = planetLongitude(raw, lord.planet);
  return longitude === null ? [] : [{ kind: 'western_lilly_ascendant_ruler_sign', sign: zodiacNames[Math.floor(longitude / 30)] }];
}
