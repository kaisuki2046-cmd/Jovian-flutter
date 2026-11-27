import { longitudeHouse } from './regiomontanus.mjs';

export const lillyHouseRuleset = 'lilly-1647-longitude-five-degree-v1';
const signs = '白羊座 金牛座 双子座 巨蟹座 狮子座 处女座 天秤座 天蝎座 射手座 摩羯座 水瓶座 双鱼座'.split(' ');
// Lilly, Christian Astrology (1647), p.104, Houses of the Planets.
// These are domicile lords, not exaltation, term, triplicity or modern co-rulers.
const domicileLords = 'Mars Venus Mercury Moon Sun Mercury Venus Mars Jupiter Saturn Saturn Jupiter'.split(' ');
const classicalPlanets = new Set(domicileLords);
const normalize = value => ((value % 360) + 360) % 360;

// Book III pp.552,565 specifies the interval from five degrees before one
// cusp to five degrees before the next. This is a longitude judgement;
// it is deliberately distinct from a body's geometric 3D Regiomontanus house.
export function lillyHouse(longitude, cusps) {
  return longitudeHouse(longitude + 5, cusps);
}

export function lillyDomicileRuler(longitude) {
  return domicileLords[Math.floor(normalize(longitude) / 30)];
}

export function lillyInterceptedSigns(cusps, house) {
  const cusp = cusps[house - 1], next = cusps[house % 12];
  const width = normalize(next - cusp);
  const intercepted = [];
  // An intercepted sign lies completely inside the unshifted house arc.
  // The five-degree shift is used only to place planets in houses.
  for (let signStart = 0; signStart < 360; signStart += 30) {
    const offset = normalize(signStart - cusp);
    if (offset > 0 && offset + 30 <= width) intercepted.push(signStart / 30);
  }
  return intercepted;
}

export function lillyInterceptedSignRulers(cusps, house) {
  return [...new Set(lillyInterceptedSigns(cusps, house).map(index => lillyDomicileRuler(index * 30)))];
}

function uniqueRows(facts, kind, key, value) {
  const rows = new Map();
  for (const fact of facts.filter(fact => fact.kind === kind)) {
    const selector = fact[key];
    if (!rows.has(selector)) rows.set(selector, new Set());
    rows.get(selector).add(fact[value]);
  }
  return new Map([...rows].filter(([, values]) => values.size === 1).map(([selector, values]) => [selector, [...values][0]]));
}

export function lillyCusps(facts) {
  if (!facts.some(fact => fact.kind === 'western_zodiac' && fact.zodiac === 'tropical')
    || !facts.some(fact => fact.kind === 'western_profile_system' && fact.profile === 'regiomontanus')) return null;
  const rawCusps = facts.filter(fact => fact.kind === 'western_profile_cusp_longitude' && fact.profile === 'regiomontanus');
  const cuspMap = uniqueRows(rawCusps, 'western_profile_cusp_longitude', 'house', 'longitude');
  if (cuspMap.size !== 12) return null;
  const cusps = Array.from({ length: 12 }, (_, index) => cuspMap.get(index + 1));
  if (cusps.some(value => !Number.isFinite(value) || value < 0 || value >= 360) || lillyHouse(0, cusps) === null) return null;
  // A contradictory sign projection is not another candidate for this profile.
  if (facts.some(fact => fact.kind === 'western_profile_house_sign' && fact.profile === 'regiomontanus'
    && signs[Math.floor(cusps[fact.house - 1] / 30)] !== fact.sign)) return null;
  return cusps;
}

export function lillyHouseFacts(facts) {
  const cusps = lillyCusps(facts);
  if (!cusps) return [];
  const longitudes = uniqueRows(facts, 'planet_longitude', 'planet', 'longitude');
  const positions = new Map([...longitudes].filter(([planet, longitude]) => classicalPlanets.has(planet)
    && Number.isFinite(longitude) && longitude >= 0 && longitude < 360)
    .map(([planet, longitude]) => [planet, lillyHouse(longitude, cusps)]));
  const lords = cusps.map(lillyDomicileRuler);
  return [
    { kind: 'western_lilly_ruleset', ruleset: lillyHouseRuleset },
    ...lords.map((planet, index) => ({ kind: 'western_lilly_house_ruler', house: index + 1, planet })),
    ...[...positions].map(([planet, house]) => ({ kind: 'western_lilly_planet_house', planet, house })),
    ...lords.flatMap((planet, index) => positions.has(planet)
      ? [{ kind: 'western_lilly_ruler_house', house: index + 1, placedIn: positions.get(planet) }] : []),
  ];
}
