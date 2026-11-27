import { createHash } from 'node:crypto';
import { lillyCusps, lillyHouseRuleset } from '../../control/lilly-houses.mjs';
import { lillyAspect, lillyAspectFacts, lillyOrbTables } from './lilly-aspects.mjs';
import { lillyDignityBodies, lillyDignityProfile } from './lilly-dignities.mjs';
import { lillyEnemyOppositions } from './lilly-enemies.mjs';
import { lillyReceptionFacts } from './lilly-receptions.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const lillyBookThreeRolesProfile = 'lilly-1647-servants-and-enemies-v1';
export const lillyBookThreeRoleKind = 'western_lilly_book_three_role';
const digests = new Map([
  ['enemies-p006', '3394ace27e2edfecdbdd087a0844196fdd6ca56b702d56d192438224c534f4e0'],
  ['health-servants-p002', '2d6c08491e5b7cc197adb1203672f8f70be198d14213b6fc77681de6a535c358'],
  ['health-servants-p003', '0315c397246c8893cb91164235181c001b1bb3a219bb21bb7d062dda21113cdd'],
  ['health-servants-p005', '98fb84c147bb95f2e24c9b6710a0ab4a6aa893190f59e837747a7c0675c75be4'],
  ['health-servants-p007', '220dc52c41041ab03c9e7dfb7de57a53195e0515808f246d8ba1c6638ff71f98'],
  ['health-servants-p008', '6227a644447da70a3908950aabfda1b7d7cb2466b295c26b45525fb305d79ba2'],
  ['enemies-p019', '7834e618e5d122e66d3b227ed8412f8ef02247518b5255e3e5153b22196d6dea'],
  ['enemies-p020', 'cb04f16c1e7af7e5b6ae85986832f7ce07fe0c6f79e7df3fdec028d71ec1873e'],
  ['enemies-p147', 'a4f8535e5566e22383189580bfdb34c9032bd26484d6f32d5dc6c6c80838c8ab'],
  ['enemies-p148', '9c44edd9d953a1c3bd2e5a085f791382dea225f59f5548ce62d8853b74b5a99b'],
  ['enemies-p149', '1a3e9bad4b4597176287d538872eca6a4f661dc66e7f9f1c5ffbdb8011bb13c5'],
  ['enemies-p150', '5363831c4558eb912a29a1ab9b68510a02df42b16f9f5909fe263e8c3e563a24'],
  ['enemies-p152', '120ad5cf9f06f5f426d3361cfbd2b606422139acf37877b3b078eee4252af750'],
  ['enemies-p153', 'ff6908e140826ceda2e14fb9faa3dddd36ea0ffc7acd46b76eb6056b6c90fdbe'],
  ['enemies-p155', 'e6b00cbfd6d176d1ffeb3757407ca0f039c4455c825270b7d9d7855dc6066922'],
  ['enemies-p156', '10b268ce06ab3169226d85aa0e16f20a1f7730246113e05635604c2ae498a78a'],
  ['enemies-p157', '474a71f8b27b13594e5fddd3066700115b45e17b56b58c1a19d7302532f58610'],
  ['enemies-p158', 'ae6c10a3f88715c08a52cfbf9fe5cc3ba0f0fb32db497c429e945e73809659bc'],
]);
const historical = new Set(['enemies-p147', 'enemies-p148', 'enemies-p149', 'enemies-p150', 'enemies-p152',
  'enemies-p153', 'enemies-p155', 'enemies-p156', 'enemies-p157', 'enemies-p158']);
const scorePassages = new Set(['enemies-p006', 'enemies-p020', 'enemies-p155', 'enemies-p156', 'enemies-p158',
  'health-servants-p002', 'health-servants-p003', 'health-servants-p005', 'health-servants-p007']);
const benefics = ['Venus', 'Jupiter'], malefics = ['Mars', 'Saturn'];
const angular = [1, 4, 7, 10];
const positiveDignities = ['domicile', 'exaltation', 'triplicity', 'term', 'face'];
const selector = passage => ({ kind: lillyBookThreeRoleKind, passage });
export const isLillyBookThreeRole = passage => digests.has(passage);
export const isLillyBookThreeOrdinaryRole = fact => fact.kind === lillyBookThreeRoleKind && !historical.has(fact.passage);
export const lillyBookThreeNeedsScores = fact => fact.kind === lillyBookThreeRoleKind && scorePassages.has(fact.passage);

export function compileLillyBookThreeRoles(claim) {
  const passage = /^astro-lilly-v3-((?:enemies|health-servants)-p\d{3})-001$/u.exec(claim.id)?.[1];
  if (!digests.has(passage)) return undefined;
  const { source, conditions, evidence } = claim;
  const hash = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (hash !== digests.get(passage)) return { reason: 'source_review_required', reviewNote: '莉莉卷三条目的出处、条件或原文有改动，须重新核对。' };
  return {
    compiler: lillyBookThreeRolesProfile,
    inputs: [normalizeRuleInput('western', { required: [selector(passage), { kind: 'western_lilly_ruleset', ruleset: lillyHouseRuleset }] })],
    ...(historical.has(passage) && { matchScope: 'historical_aphorism' }),
    ...(['enemies-p020', 'enemies-p158'].includes(passage) && { remainingAlternatives: 1 }),
  };
}

function roleChart(raw, houses, dignities, readScores) {
  const points = new Map(lillyDignityBodies.map(planet => [planet, lillyPlanetPosition(raw, planet)])
    .filter(([, point]) => Number.isFinite(point?.longitude)));
  const placements = new Map(houses.filter(f => f.kind === 'western_lilly_planet_house' && points.has(f.planet))
    .map(f => [f.planet, f]));
  const rulers = new Map(houses.filter(f => f.kind === 'western_lilly_house_ruler').map(f => [f.house, f]));
  const occupants = (...numbers) => [...placements.values()].filter(f => numbers.includes(f.house)).map(f => f.planet);
  const score = planet => planet && readScores?.().get(planet);
  const house = planet => placements.get(planet)?.house;
  const ruler = number => rulers.get(number)?.planet;
  const longitude = planet => ({ kind: 'planet_longitude', planet, longitude: points.get(planet).longitude });
  const explainScore = planet => ({ kind: 'western_lilly_wealth_score', planet, min: score(planet).min, max: score(planet).max });
  const rowsAt = planet => dignities.filter(f => f.planet === planet && f.matches && positiveDignities.includes(f.dignity));
  const fixedActors = [...new Set([ruler(7), ruler(12), ...occupants(7, 12)])].filter(planet => points.has(planet));
  const positions = new Map([...points].map(([planet, point]) => [planet, point.longitude]));
  const aspects = (first, second, aspect) => ['main', 'other'].flatMap(table =>
    lillyAspect(positions.get(first), positions.get(second), first?.toLowerCase(), second?.toLowerCase(), aspect, table) === true
      ? [{ kind: 'western_lilly_aspect', first: first.toLowerCase(), second: second.toLowerCase(), aspect, table, matches: true }] : []);
  return { points, positions, placements, rulers, occupants, score, house, ruler, longitude, explainScore, rowsAt, fixedActors, aspects };
}

function householdEvidence(passage, raw, chart) {
  const { points, placements, rulers, occupants, score, house, ruler, longitude, explainScore, rowsAt, aspects } = chart;
  const sixth = ruler(6), first = ruler(1);
  const members = [...new Set([sixth, 'Mercury', ...occupants(6)])];
  if (passage === 'health-servants-p002' || passage === 'health-servants-p007') {
    if (placements.size !== lillyDignityBodies.length) return [];
    const favorable = passage.endsWith('p002');
    const matched = members.filter(planet => favorable ? benefics.includes(planet) || score(planet)?.min > 0
      : malefics.includes(planet) && score(planet)?.max < 0);
    if (matched.length * 2 <= members.length) return [];
    return [rulers.get(6), ...members.map(planet => placements.get(planet)),
      ...matched.flatMap(planet => score(planet) ? [explainScore(planet)] : [])];
  }
  if (passage === 'health-servants-p003') {
    return angular.includes(house(sixth)) && score(sixth)?.min > 0 ? [rulers.get(6), placements.get(sixth), explainScore(sixth)] : [];
  }
  if (passage === 'health-servants-p005') {
    if (![10, 1, 6, 12].includes(house('Mercury')) || !(score('Mercury')?.min > 0) || points.get('Jupiter')?.sign % 3 === 1) return [];
    const req = Object.keys(lillyOrbTables).map(table =>
      ({ kind: 'western_lilly_aspect_phase', table, first: 'mercury', second: 'jupiter', phase: 'applying' }));
    const phases = lillyAspectFacts(raw, req);
    return phases.length ? [placements.get('Mercury'), explainScore('Mercury'), longitude('Jupiter'), ...phases] : [];
  }
  return members.filter(planet => malefics.includes(planet)).flatMap(planet => {
    const dignity = rowsAt(planet), good = aspects(planet, first, 'friendly');
    return dignity.length && good.length ? [rulers.get(1), rulers.get(6), placements.get(planet), ...dignity, ...good] : [];
  });
}

function sectLightEvidence(passage, raw, chart, dignityCellsAt) {
  const { score, house, placements, longitude, explainScore, aspects } = chart;
  const sects = new Set(raw.filter(f => f.kind === 'western_sect').map(f => f.sect));
  if (sects.size !== 1) return [];
  const [sect] = sects;
  const light = sect === 'day' ? 'Sun' : 'Moon';
  if (!house(light) || !house('Mars')) return [];
  const concrete = [placements.get(light), { kind: 'western_sect', sect }, longitude(light), longitude('Mars')];
  if (passage === 'enemies-p019') {
    if (house(light) === 8) return [];
    const requests = [...positiveDignities, 'mutual_domicile'].map(reception =>
      ({ kind: 'western_lilly_reception', profile: lillyDignityProfile, first: 'mars', second: light.toLowerCase(), reception }));
    const qualifying = lillyReceptionFacts(raw, requests, dignityCellsAt).filter(f => f.matches);
    return qualifying.length ? [...concrete, ...qualifying] : [];
  }
  const competitors = lillyDignityBodies.filter(planet => planet !== 'Mars');
  const mars = score('Mars');
  if (!mars || !competitors.every(planet => score(planet)?.max < mars.min)) return [];
  const conjunctions = aspects('Mars', light, 'conjunction');
  return conjunctions.length ? [...concrete, ...conjunctions, ...lillyDignityBodies.map(explainScore)] : [];
}

function enemyEvidence(passage, raw, chart, nodeFacts, dignityCellsAt) {
  const { fixedActors, positions, placements, rulers, occupants, house, score, explainScore } = chart;
  if (passage === 'enemies-p019' || passage === 'enemies-p020') return sectLightEvidence(passage, raw, chart, dignityCellsAt);
  if (passage === 'enemies-p147' || passage === 'enemies-p148') {
    const node = passage.endsWith('147') ? 'north_node' : 'south_node';
    return nodeFacts.filter(f => f.node === node && f.kind === 'western_lilly_node_sign');
  }
  if (passage === 'enemies-p150') return occupants(12).map(planet => placements.get(planet));
  if (passage === 'enemies-p155' || passage === 'enemies-p156') {
    const potent = passage.endsWith('155');
    return malefics.every(planet => house(planet) === 12 && (potent ? score(planet)?.min > 0 : score(planet)?.max < 0))
      ? malefics.flatMap(planet => [placements.get(planet), explainScore(planet)]) : [];
  }
  if (passage === 'enemies-p157') {
    const occupied = malefics.map(house);
    return occupied.includes(6) && occupied.includes(12) ? malefics.map(planet => placements.get(planet)) : [];
  }
  if (passage === 'enemies-p158') {
    const cusp = lillyCusps(raw)?.[11];
    const sign = Math.floor(cusp / 30);
    return [4, 8].includes(sign) ? occupants(12).filter(planet => chart.points.get(planet)?.sign === sign && score(planet)?.max < 0)
      .flatMap(planet => [placements.get(planet), chart.longitude(planet), explainScore(planet),
        { kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: 12, longitude: cusp }]) : [];
  }
  return ['main', 'other'].flatMap(table => {
    const oppositions = lillyEnemyOppositions(positions, table);
    const actors = [...new Set([...fixedActors, ...oppositions.map(f => f.planet)])];
    const evidence = (planet) => [placements.get(planet), ...[7, 12].map(number => rulers.get(number)).filter(f => f?.planet === planet),
      ...oppositions.filter(f => f.planet === planet).map(({ aspect }) => aspect)].filter(Boolean);
    if (passage === 'enemies-p149') {
      return [...occupants(7).map(planet => placements.get(planet)), ...oppositions.map(({ aspect }) => aspect)];
    }
    if (passage === 'enemies-p006') return actors.filter(planet => angular.includes(house(planet)) && score(planet)?.min > 0)
      .flatMap(planet => [...evidence(planet), explainScore(planet)]);
    const nature = passage === 'enemies-p152' ? benefics : malefics;
    return actors.filter(planet => nature.includes(planet)).flatMap(evidence);
  });
}

export function lillyBookThreeRoleEvidence(raw, requested, houses, nodeFacts, dignities, readScores, dignityCellsAt) {
  const result = new Map();
  const relevant = requested.filter(f => f.kind === lillyBookThreeRoleKind && isLillyBookThreeRole(f.passage));
  if (!relevant.length || new Set(raw.filter(f => f.kind === 'western_zodiac').map(f => f.zodiac)).size !== 1
    || !houses.some(f => f.kind === 'western_lilly_ruleset')) return result;
  const chart = roleChart(raw, houses, dignities, readScores);
  for (const { passage } of relevant) {
    const evidence = passage.startsWith('health-servants-') ? householdEvidence(passage, raw, chart)
      : enemyEvidence(passage, raw, chart, nodeFacts, dignityCellsAt);
    if (evidence.length) result.set(passage, [...new Map(evidence.map(f => [JSON.stringify(f), f])).values()]);
  }
  return result;
}

export const lillyBookThreeFacts = evidence => [...evidence.keys()].map(selector);
