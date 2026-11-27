import { createHash } from 'node:crypto';
import { lillyCusps, lillyDomicileRuler, lillyInterceptedSignRulers } from '../../control/lilly-houses.mjs';
import { lillyDignityBodies } from './lilly-dignities.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { lillyAspect, lillyOrbTables } from './lilly-aspects.mjs';

export const lillyFriendsProfile = 'lilly-1647-friendship-significators-v1';
// Christian Astrology III, pp.634–636, own-nativity testimonies.
const reviewed = new Map([
  ['astro-lilly-v3-friends-p002-001', '1313279fa265939df7d086f54a1e0e9ed0e9345e2265306ad1d020b09457c6d4'],
  ['astro-lilly-v3-friends-p011-001', '2f5939643e9d5d56f1f75874d587f26186831e11caf63fe66a0fdc2fc3febfd9'],
  ['astro-lilly-v3-friends-p014-001', 'e3b5106b8c1c1526aef26d1755948f6bec6be935a7634a995539704259328112'],
  ['astro-lilly-v3-friends-p015-001', 'b869b3224f822cdb058ca3c8118b7677a1acf6d3557c283230a7ff59312ebb30'],
  ['astro-lilly-v3-friends-p016-001', '96a85a3f5c76d01d0c8bf163d2abb590cde4450af63afb88d21b20b97b0eb21c'],
  ['astro-lilly-v3-friends-p017-001', 'b0b4c709555dd421ac36f5e7a6763914255b3626e1794edbd374a0caa3075756'],
  ['astro-lilly-v3-friends-p024-001', '26902a69130a2e09adaa1c74d64c09c392e7d20151c2ee194f9b587372d1ed96'],
  ['astro-lilly-v3-friends-p025-001', '96b6f9ce0810a397c73420f2d4d5c601ae2f891cd3b64ad612bb12d595bf3ed2'],
  ['astro-lilly-v3-friends-p026-001', 'ca535feb6e656bae8fbf49a2e2de19126b17b6e039cfa810c97d1038c73ca5d5'],
  ['astro-lilly-v3-friends-p027-001', 'fcc8711ea166a05f44ee6fdf7fcf22fcd3bf885b6880b939de722a5b3593bacf'],
  ['astro-lilly-v3-friends-p028-001', 'fe499a70ec6de615ce71bdea0ffa1ee07ad3f4acd6240befa0d19ecdb73f5e96'],
  ['astro-lilly-v3-friends-p029-001', '7500860922698680d1ce0de714a910b9ef841a8d5eca5305b5e347f1c03d974d'],
  ['astro-lilly-v3-friends-p030-001', '520fda699fbd7de6f6c39d406d33bffdc06263c6044d81bb35ac32d78d843cc4'],
  ['astro-lilly-v3-friends-p041-001', 'd4d4a3de8c00752f08806c639779235079904b7ac4b9c32b77646258a6032e51'],
]);
export const isLillyFriendsSource = ({ id }) => reviewed.has(id);

export function lillyFriendsSourceMatches({ id, source, conditions, evidence }) {
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  return reviewed.get(id) === digest;
}

export const lillyFriendHouses = [1, 11];
export const lillyFriendRoles = ['occupant', 'cusp_ruler', 'intercepted_ruler'];
const atom = (fact, equals) => ({ fact: 'profiles.lilly.' + fact, equals });
const friend = (planet, house, role) => ({ kind: 'western_lilly_friend_significator', planet, house, role });
const benefics = ['Jupiter', 'Venus'];
const malefics = ['Saturn', 'Mars'];
const neutralPlanets = ['Sun', 'Moon', 'Mercury'];
const testimonyPlanets = { fortified: benefics, weak: malefics, dignified: [...malefics, ...neutralPlanets],
  afflicted: [...benefics, ...neutralPlanets] };
const chapterConditions = {
  jupiter_or_venus_afflicted: ['afflicted', benefics],
  strong_saturn_or_mars_in_friendship_houses: ['dignified', malefics],
  weak_saturn_or_mars_in_friendship_houses: ['weak', malefics],
  neutral_significator_well_dignified: ['dignified', neutralPlanets],
  neutral_significator_ill_affected: ['afflicted', neutralPlanets],
};

export function isLillyFriendCondition({ planet, condition, table }) {
  return Object.hasOwn(testimonyPlanets, condition) && testimonyPlanets[condition].includes(planet)
    && (table === 'main' || (condition === 'afflicted' && table === 'other'));
}

const conditionFact = (planet, condition, table = 'main') => ({ kind: 'western_lilly_friend_condition', planet, condition, table });

export function lillyFriendsGroupAlternatives(group) {
  const fortified = group.find(({ fact, equals }) => equals === true
    && /^profiles\.lilly\.friends\.planet_fortified_under_chapter\.(jupiter|venus)$/u.test(fact));
  if (fortified) {
    return [group.map(item => item === fortified ? atom('friends.condition.fortified', item.fact.split('.').at(-1)) : item), group];
  }
  const prefix = 'profiles.lilly.friends.testimonies.';
  const chapter = group.find(({ fact, equals }) => equals === true && fact.startsWith(prefix)
    && Object.hasOwn(chapterConditions, fact.slice(prefix.length)));
  if (chapter) {
    const [condition, planets] = chapterConditions[chapter.fact.slice(prefix.length)];
    const required = group.filter(item => item !== chapter);
    return [...planets.flatMap(body => lillyFriendHouses.map(house => [
      ...required, { fact: 'chart.planets.' + body.toLowerCase() + '.house', equals: house },
      atom('friends.condition.' + condition, body.toLowerCase()),
    ])), group];
  }
  const selected = group.find(condition => condition.fact === 'profiles.lilly.friendship.active_malefic_peregrine' && condition.equals === true);
  const classified = group.find(condition => condition.fact === 'profiles.lilly.friendship.same_active_malefic_sign_class'
    && ['movable', 'common'].includes(condition.equals));
  if (!selected || !classified) return null;
  const required = group.filter(condition => condition !== selected && condition !== classified);
  const occupants = ['mars', 'saturn'].flatMap(planet => lillyFriendHouses.map(house => [
    ...required, { fact: 'chart.planets.' + planet + '.house', equals: house },
    atom('essential_dignities.' + planet + '.peregrine', true),
    atom(`sign_classes.${planet}.${classified.equals}`, true),
  ]));
  // The chapter also looks at aspects to house 11 and its ruler. The original
  // aggregate still needs those selection routes, so retain a pending group.
  return [...occupants, group];
}

export function lillyFriendsAlternatives({ fact, equals }) {
  const significator = /^profiles\.lilly\.friends\.significators\.([a-z]+)$/u.exec(fact)?.[1];
  if (equals !== true || !lillyDignityBodies.some(planet => planet.toLowerCase() === significator)) return null;
  return lillyFriendHouses.flatMap(house => lillyFriendRoles.map(role => [atom(`friends.role.${house}.${role}`, significator)]));
}

export function lillyFriendsCondition(fact, equals, aspectTable = 'main') {
  const [, house, role] = /^profiles\.lilly\.friends\.role\.(1|11)\.([a-z_]+)$/u.exec(fact) ?? [];
  const planet = lillyDignityBodies.find(body => body.toLowerCase() === equals);
  const [, condition] = /^profiles\.lilly\.friends\.condition\.([a-z_]+)$/u.exec(fact) ?? [];
  if (condition) {
    const testimony = conditionFact(planet, condition, condition === 'afflicted' ? aspectTable : 'main');
    return isLillyFriendCondition(testimony) ? testimony : null;
  }
  return planet && lillyFriendRoles.includes(role) ? friend(planet, Number(house), role) : null;
}

export function lillyFriendsFacts(chart, houses, dignities, readFortitudeRanges) {
  const zodiacs = new Set(chart.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const cusps = lillyCusps(chart);
  if (!cusps) return [];
  const placements = houses.filter(fact => fact.kind === 'western_lilly_planet_house' && lillyFriendHouses.includes(fact.house)
    && Number.isFinite(lillyPlanetPosition(chart, fact.planet)?.longitude));
  const conditionFacts = placements.flatMap(({ planet }) => {
    const holds = names => dignities.some(fact => fact.planet === planet && names.includes(fact.dignity) && fact.matches === true);
    const dignified = holds(['domicile', 'exaltation']);
    const debilitated = holds(['detriment', 'fall']);
    const facts = [];
    if (dignified && testimonyPlanets.dignified.includes(planet)) facts.push(conditionFact(planet, 'dignified'));
    if (dignified && benefics.includes(planet) && readFortitudeRanges?.().get(planet)?.min > 0) {
      facts.push(conditionFact(planet, 'fortified'));
    }
    if (debilitated && malefics.includes(planet) && readFortitudeRanges?.().get(planet)?.max < 0) {
      facts.push(conditionFact(planet, 'weak'));
    }
    if (debilitated && testimonyPlanets.afflicted.includes(planet)) {
      const { longitude } = lillyPlanetPosition(chart, planet);
      for (const table of Object.keys(lillyOrbTables)) {
        const afflicted = malefics.some(malefic => {
          const other = lillyPlanetPosition(chart, malefic);
          return other && ['square', 'opposition'].some(aspect => lillyAspect(longitude, other.longitude,
            planet.toLowerCase(), malefic.toLowerCase(), aspect, table) === true);
        });
        if (afflicted) facts.push(conditionFact(planet, 'afflicted', table));
      }
    }
    return facts;
  });
  return [
    ...conditionFacts,
    ...placements.map(({ planet, house }) => friend(planet, house, 'occupant')),
    ...lillyFriendHouses.flatMap(house => [
      friend(lillyDomicileRuler(cusps[house - 1]), house, 'cusp_ruler'),
      ...lillyInterceptedSignRulers(cusps, house).map(planet => friend(planet, house, 'intercepted_ruler')),
    ]),
  ];
}
