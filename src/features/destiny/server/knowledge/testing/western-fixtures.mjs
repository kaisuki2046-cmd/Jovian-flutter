import assert from 'node:assert/strict';
import { trueLunarNodeProfile } from '../../../control/charts.ts';
import { lillyHouse } from '../../../control/lilly-houses.mjs';

const signs = '白羊座 金牛座 双子座 巨蟹座 狮子座 处女座 天秤座 天蝎座 射手座 摩羯座 水瓶座 双鱼座'.split(' ');
const lords = 'Mars Venus Mercury Moon Sun Mercury Venus Mars Jupiter Saturn Saturn Jupiter'.split(' ');
const wrap = value => ((value % 360) + 360) % 360;

// Numerical fixture builder only. Tests submit observable cusp/planet degrees;
// they cannot make a derived Lilly assertion count as a confirmed calculation.
export function westernFactsForInput({ required }) {
  for (let start = 0; start < 360; start += 30) {
    const cusps = Array.from({ length: 12 }, (_, index) => wrap(start + index * 30));
    if (required.some(fact => fact.kind === 'western_profile_house_sign' && signs[cusps[fact.house - 1] / 30] !== fact.sign)) continue;
    const lordAt = house => lords[cusps[house - 1] / 30];
    if (required.some(fact => fact.kind === 'western_lilly_house_ruler' && lordAt(fact.house) !== fact.planet)) continue;
    const locations = new Map();
    let invalid = false;
    for (const fact of required) {
      if (!['western_lilly_ruler_house', 'western_lilly_planet_house'].includes(fact.kind)) continue;
      const planet = fact.planet ?? lordAt(fact.house);
      const house = fact.placedIn ?? fact.house;
      if (locations.has(planet) && locations.get(planet) !== house) invalid = true;
      locations.set(planet, house);
    }
    if (invalid) continue;
    const longitudes = new Map();
    for (const [planet, house] of locations) {
      const sign = required.find(fact => fact.kind === 'planet_sign' && fact.planet === planet)?.sign;
      const longitude = [0.1, 1, 4, 5, 10, 15, 20, 25, 29].map(offset => wrap(cusps[house - 1] - 5 + offset))
        .find(longitude => !sign || signs[Math.floor(longitude / 30)] === sign);
      if (longitude === undefined) { invalid = true; break; }
      longitudes.set(planet, longitude);
    }
    if (invalid) continue;
    // Independent p.104 numerical examples in Aries (middle of each bound).
    // These supply observable degrees, never a trusted derived dignity flag.
    const termPoints = { Jupiter: 2, Venus: 10, Mercury: 17, Mars: 23, Saturn: 27 };
    for (const fact of required.filter(fact => fact.kind === 'western_lilly_dignity' && fact.dignity === 'term' && fact.matches)) {
      assert.ok(Number.isFinite(termPoints[fact.planet]), 'No numerical term fixture for ' + fact.planet);
      if (!longitudes.has(fact.planet)) longitudes.set(fact.planet, termPoints[fact.planet]);
    }
    for (const fact of required.filter(fact => fact.kind === 'western_lilly_reception' && fact.reception === 'term' && fact.matches)) {
      const receiver = fact.first[0].toUpperCase() + fact.first.slice(1), guest = fact.second[0].toUpperCase() + fact.second.slice(1);
      assert.ok(Number.isFinite(termPoints[receiver]), 'No numerical receiver fixture for ' + fact.first);
      if (!longitudes.has(guest)) longitudes.set(guest, termPoints[receiver]);
    }
    for (const fact of required.filter(fact => fact.kind === 'western_lilly_aspect')) {
      const body = selector => selector.startsWith('house_') ? lordAt(Number(/^house_(\d+)_ruler$/u.exec(selector)[1]))
        : selector[0].toUpperCase() + selector.slice(1);
      const first = body(fact.first), second = body(fact.second);
      if (first === second && fact.matches) { invalid = true; break; }
      const angle = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180, friendly: 60, any: 60 }[fact.aspect];
      assert.ok(Number.isFinite(angle), 'Unsupported aspect in numerical fixture: ' + fact.aspect);
      if (!longitudes.has(first)) longitudes.set(first, 15);
      // For unspecified absence, conjunction would be ambiguous. Thirty degrees
      // lies outside all five moieties, rather than asserting a derived flag.
      if (!longitudes.has(second)) longitudes.set(second, wrap(longitudes.get(first) + (fact.matches ? angle : fact.aspect === 'any' ? 30 : angle === 0 ? 180 : 0)));
    }
    if (invalid) continue;
    const nodes = required.filter(fact => ['western_lilly_node_house', 'western_lilly_node_sign'].includes(fact.kind));
    const north = nodes.length ? Array.from({ length: 360 }, (_, degree) => degree + 0.5).find(value => nodes.every(fact => {
      const longitude = wrap(value + (fact.node === 'south_node' ? 180 : 0));
      return fact.kind === 'western_lilly_node_house' ? lillyHouse(longitude, cusps) === fact.house
        : signs[Math.floor(longitude / 30)] === fact.sign;
    })) : undefined;
    if (nodes.length && north === undefined) continue;
    return [
      ...required.filter(fact => !fact.kind.startsWith('western_lilly_')),
      { kind: 'western_zodiac', zodiac: 'tropical' },
      { kind: 'western_profile_system', profile: 'regiomontanus' },
      ...cusps.map((longitude, index) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude })),
      ...[...longitudes].map(([planet, longitude]) => ({ kind: 'planet_longitude', planet, longitude })),
      ...(north === undefined ? [] : [{ kind: 'western_true_node_longitude', profile: trueLunarNodeProfile, longitude: north }]),
    ];
  }
  assert.fail('No internally consistent numerical fixture for ' + JSON.stringify(required));
}
