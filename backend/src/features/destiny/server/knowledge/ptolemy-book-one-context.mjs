import { zodiacNames } from '../../control/charts.ts';
import { easternOrCulminatingLongitude } from './ptolemy-fortune-angles.mjs';

const predominant = { Sun: 'heat', Moon: 'moisture', Mars: 'dryness', Saturn: 'cold', Jupiter: 'heat', Venus: 'moisture' };
const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const seasons = { spring: 'moisture', summer: 'heat', autumn: 'dryness', winter: 'cold' };
const regions = { east: 'dryness', north: 'cold', west: 'moisture', south: 'heat' };
const opposites = { heat: 'cold', cold: 'heat', moisture: 'dryness', dryness: 'moisture' };
const quadrants = ['sign_ic_asc', 'sign_west_ic', 'sign_mc_west', 'sign_asc_mc'];
const winds = ['winds_north', 'winds_south', 'winds_east', 'winds_west'];
const turn = angle => (angle + 360) % 360;
const angleTolerance = 1;
const reviewed = new Map();

function chapter(number, records, needsTropical = false) {
  for (const [passage, hash, ...selectors] of records) {
    reviewed.set(`astro-ptolemy-v1-chapter-${number}-p${String(passage).padStart(3, '0')}-001`,
      { hash, selectors, needsTropical });
  }
}
chapter(4, [
  [1, '6a6f5a5ef58d9369cad39b66c95784337370a3d1a63cbdc3fab3eefc55b2d8c3', 'quality_sun'],
  [2, 'e3704aba198451a50f1bc4f6c3a6fd7ff6ca3d4cc459bc4b132f6192273c89af', 'quality_moon'],
  [3, '9622b76a90cb52579f2fe628a0c515c765a9ef246405877c756a61e0c9514c0b', 'quality_saturn'],
  [4, '269eda1bf2ccdb1367006cce35056d4143a1ae6f0f9458163cc8d1b6a1c2dbe2', 'quality_mars'],
  [5, '3e59205b095348d4795445b77310cc37e12e3ae6baa99570d6b2910ef0ecc913', 'quality_jupiter'],
  [6, '9b520adc6dc2110a1f7d323807b1754b316f622aa2251995b5ca06aaef916f44', 'quality_venus'],
  [7, '88c3d1733733bf9a60bb3bdc734c423f99115ff0c274ba16017871456b7b8445', 'quality_mercury'],
  [8, '017f98c55ebd9bc8819e28b61585acf9b11c14ebbb7254ce06a7da7e30b4772e', 'luminary_quality'],
]);
chapter(10, [
  [1, 'bab7099d54cedbdee79f97529f4d42736fddeed1aea6cce090ad9bae4a716ce8', 'spring'],
  [2, 'f19c95eedff3a771c0c0668c4321188a227a86347a265d9b7b8c124dc0e99fdf', 'summer'],
  [3, '0dd95b9cd6d403aada4093a44ded023adf01c7c6862016a75a2b87d03d4cf711', 'autumn'],
  [4, '5ab0ddec68fbd1fea6e269a2bcf871cb5e72f1feb20194f0cc528ceaf19ca8c1', 'winter'],
  [5, 'd863c167ba5d6d950b244d449458e5dcc58ece440a85ee77f12e57c52717afc7', 'east'],
  [6, '4741bf24799cf11b847da667b6f5bc50707bc2a15ba0ba7d961f2298b12ba13c', 'south'],
  [7, '18f778ee51e74db9c1a2d02cc55fce2989d1a5a823edb3b08bb8e449760e8fef', 'west'],
  [8, '6266a35ad6e574303bfe12af195ce3b4620e82278c33427165f1fe04bce1140a', 'north'],
  [9, '5498aa446676b24fc60bdf4d6789a6c3ec4e43e81a04b928a98402e017e090e7', 'akin_quality'],
  [10, 'f913c9aee4fbde8e57cf007acb04f1fbd80974f11ce6fc37d63cb1803d6d6907', 'opposed_quality'],
], true);
chapter(12, [
  [3, '9e86a3377ae74e8b728c9132396bb1f86c9cd84484bf81c9f6856f7a75685af4', 'rising_even'],
  [4, '519eb9df76c02dab16ce86e0d44e57afa9f7e3a34e074873d00f14a3fa2dab23', 'rising_odd'],
  [5, 'a9c43f07e9f84d6b8a5459dfe372c36b8b3d4e5cb5da818b70a32f45ebf41506', 'sign_asc_mc', 'sign_west_ic'],
  [6, 'b4c81cc8c740f6a1c20ef69624604752c089bbdc411fdd88ce7b721d66faa6a6', 'sign_mc_west', 'sign_ic_asc'],
], true);
chapter(17, [
  [9, '034ccd46b4e2d1791d14315302d2940f0fc6769a7d284084ed0a702b7924d0da', 'solar_half'],
  [10, 'b2f3bfc968b086515a84b39bc7c4fa9382d5e5d2fac7d9743b6c98da24edb8ea', 'lunar_half'],
], true);
chapter(18, [
  [9, '926ffd4f1edfe1468115e7c7d97acda2fa50e72207b0a79d1fa415711918b2a0', 'winds_north'],
  [10, '7fe0bdd935a021e98c8ab039f0239a2681e1bde40b41392425280a49c18c22c8', 'winds_south'],
  [11, '66f68531b7b692b59d60a4da0d17f63426cd84f683bf1244f7dafbeb0bb96542', 'winds_east'],
  [12, 'd1b73cde5ba64e32edb5fb43117c3c44f65a6dbbfd81c423722b410092084c19', 'winds_west'],
  [13, '45ead46519aeef9caa8506bce53c82ac0f8b616dbc454cac9b4b53258121ceb9', 'winds_east'],
], true);
const witnesses = new Set([...reviewed.values()].flatMap(spec => spec.selectors));

export function ptolemyContextSource(id) {
  return reviewed.get(id);
}

export function isPtolemyContextWitness(value) {
  return witnesses.has(value);
}

export function isPtolemyContextFact(fact) {
  if (!bodies.includes(fact.planet)) return false;
  const validDegree = degree => Number.isFinite(degree) && degree >= 0 && degree < 360;
  switch (fact.kind) {
    case 'western_ptolemy_book_one_region':
      return Object.hasOwn(regions, fact.region) && validDegree(fact.longitude)
        && Number.isFinite(fact.distance) && fact.distance >= 0 && fact.distance <= angleTolerance;
    case 'western_ptolemy_book_one_sign_offset':
      return [fact.sign, fact.anchorSign].every(sign => zodiacNames.includes(sign))
        && Number.isInteger(fact.steps) && fact.steps >= 0 && fact.steps < 12;
    case 'western_ptolemy_book_one_sign_quadrant':
      return zodiacNames.includes(fact.sign) && quadrants.includes(fact.quadrant)
        && validDegree(fact.start) && validDegree(fact.end) && fact.start !== fact.end;
    case 'western_ptolemy_book_one_quality':
      return (Object.hasOwn(seasons, fact.context) || Object.hasOwn(regions, fact.context))
        && fact.quality === predominant[fact.planet] && fact.quality !== undefined
        && fact.contextQuality === (seasons[fact.context] ?? regions[fact.context])
        && [fact.quality, opposites[fact.quality]].includes(fact.contextQuality);
    default: return false;
  }
}

function opposite(facts, angle, longitude) {
  if (!Number.isFinite(longitude)) return null;
  const value = turn(longitude + 180);
  const house = angle === 'descendant' ? 7 : 4;
  const conflict = facts.some(fact => fact.kind === 'angle_sign' && fact.angle === angle
      && fact.sign !== zodiacNames[Math.floor(value / 30)]
    || fact.kind === 'western_profile_cusp_longitude' && fact.profile === 'regiomontanus' && fact.house === house
      && Math.min(turn(fact.longitude - value), turn(value - fact.longitude)) > 1e-8);
  return conflict ? null : value;
}

function qualityComparison(record, planet, context, contextQuality, ...proof) {
  const quality = predominant[planet];
  if (quality === contextQuality || opposites[quality] === contextQuality) {
    record(quality === contextQuality ? 'akin_quality' : 'opposed_quality',
      { kind: 'western_ptolemy_book_one_quality', planet, context, quality, contextQuality }, ...proof);
  }
}

// I.12 describes whole signs in the historical quadrants. A sign split
// across an angle is outside this supported comparison.
function completeSignQuadrant(axes, sign) {
  if (!axes.every(Number.isFinite)) return -1;
  const spans = axes.map((start, index) => turn(axes[(index + 1) % 4] - start));
  if (spans.some(span => span <= 0 || span >= 180)) return -1;
  return axes.findIndex((start, index) => turn(sign * 30 - start) + 30 <= spans[index] + 1e-9);
}

export function recordPtolemyContext(facts, positions, tropical, record) {
  for (const [planet, position] of positions) {
    record('quality_' + planet.toLowerCase(), { kind: 'planet_sign', planet, sign: zodiacNames[position.sign] });
  }
  if (!tropical) return;
  const ascendant = easternOrCulminatingLongitude(facts, 'ascendant');
  const mc = easternOrCulminatingLongitude(facts, 'mc');
  const axes = [ascendant, opposite(facts, 'ic', mc), opposite(facts, 'descendant', ascendant), mc];
  const sun = positions.get('Sun');
  const season = sun && Object.keys(seasons)[Math.floor(sun.sign / 3)];
  const solarSign = sun && { kind: 'planet_sign', planet: 'Sun', sign: zodiacNames[sun.sign] };
  if (season) record(season, solarSign);
  for (const [planet, { sign, longitude }] of positions) {
    const label = { kind: 'planet_sign', planet, sign: zodiacNames[sign] };
    record(sign >= 4 && sign <= 9 ? 'solar_half' : 'lunar_half', label);
    record(winds[sign % 4], label);
    if (season) qualityComparison(record, planet, season, seasons[season], solarSign, label);
    if (Number.isFinite(ascendant)) {
      const anchor = Math.floor(ascendant / 30), steps = (sign - anchor + 12) % 12;
      record(steps % 2 === 0 ? 'rising_even' : 'rising_odd', { kind: 'western_ptolemy_book_one_sign_offset',
        planet, sign: label.sign, anchorSign: zodiacNames[anchor], steps });
    }
    const quadrant = completeSignQuadrant(axes, sign);
    if (quadrant >= 0) record(quadrants[quadrant], { kind: 'western_ptolemy_book_one_sign_quadrant',
      planet, sign: label.sign, quadrant: quadrants[quadrant], start: axes[quadrant], end: axes[(quadrant + 1) % 4] });
    if (!Number.isFinite(longitude)) continue;
    for (const [index, region] of Object.keys(regions).entries()) {
      const axis = axes[index];
      if (!Number.isFinite(axis)) continue;
      const distance = Math.min(turn(longitude - axis), turn(axis - longitude));
      if (distance > angleTolerance) continue;
      const evidence = { kind: 'western_ptolemy_book_one_region', planet, region, longitude: axis, distance };
      const coordinate = { kind: 'planet_longitude', planet, longitude };
      record(region, evidence, coordinate);
      qualityComparison(record, planet, region, regions[region], evidence, coordinate);
    }
  }
}
