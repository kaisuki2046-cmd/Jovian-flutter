import { createHash } from 'node:crypto';
import { lillyCusps, lillyDomicileRuler, lillyInterceptedSignRulers } from '../../control/lilly-houses.mjs';
import { lillyDignityBodies } from './lilly-dignities.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';

export const lillyWealthSourcesProfile = 'lilly-1647-second-house-wealth-sources-v1';
const prefix = 'astro-lilly-v3-wealth-';
const reviewed = {
  'level-p018': '8b2f37f337db63a0bdebb6d76f41a6885a39972bf430319763a4f129dfc1a761',
  'level-p019': '5990deaa7328cdd548815d8abb7a4853eeb163cce35546bb8e063fee8c4530f7',
  'level-p020': '3444400c0d9c2173e73ce16961d356c77d54781660d44b106b9de1a61f3f5d5b',
  'level-p021': '2bbc57733494bafd5073973cc808f96e1b7de10e08c049029f7b0723803fd51d',
  'level-p022': '673e09713f272b42c04e938b7d503afc3c0db114ce8c7c688850c3593e068704',
  'level-p023': '4c5ac4d715ddeb3ead251117ff9f46c3c3ad45ebb0b06bba4698ef18c5d0b264',
  'level-p024': 'd453d42d0a5bafee6a3377934e09de97ece29e026d669966212ab45a44d19e9c',
  'level-p028': '9b248217ee4ee831e375efc5537171ff1ba7c3f32984874073dc8eebb14788a6',
  'sources-p003': 'a5fec5d343cd87ef6880b2b5acc2cd55526e8ec649ed07c1df5a5f15b6514721',
  'sources-p004': '70e58fd4c3d034a5251cead96d4fe3a094ddd7c92b54c03e9f8d75eacc057aab',
  'sources-p005': 'f200124222dab55a7dbabfe1b67fd6c39b07befda7bbec287d1e83de576fddd7',
  'sources-p006': 'be19652d48b55de62d6e1a5092d803d4ac7bf37c550e84c27ea2665affb2ea54',
  'sources-p007': '0c80291dc167b7a8d574706ed9c3d43b23524e28a81a08d6a64e93ba85178a86',
  'sources-p008': 'ffd23f5cf20dd074d58e7b6c72f432583ff891bcde079f98d8bc3ebd2f53877c',
  'sources-p009': '1a42b4e21f79de9257b4d6323ad05ad76186734a989eb9ec456394ca6ec096b4',
  'sources-p010': 'f5657ee509a5249231431c8b3e5c6931f748be4d0d7ee1ee4dd89a80bca566d6',
  'sources-p011': '43e54c561f25340e2e6699fdabffbf7e0fe3469cbf162fb842fa184d20d52068',
  'sources-p012': 'fb215878976e0f17a6152b6a71d402fdaecf06c4262d15d02769049faf843786',
  'sources-p013': 'e1efd855adc31628b612c2b26500368af4eb7925081f37a0790056ac83ceefb7',
  'sources-p014': '4381bd16e693e74f60283c00a21098e869d45014a31477bf23e7a2c22320dbea',
  'sources-p016': '2ae7547ec73e01958c425cd1d5790a81cd4e6f15d0290cc52e1576344b26a772',
  'sources-p017': '95b8def6987e408dd431edb00ea203132db9d4822f4b951e1e446202e56f65cd',
  'sources-p018': '13296ea7e4dc923d6b9957cad88ba92f615bbc510817dfaa69ec52c518357ac2',
  'sources-p019': 'e819033d212a49b252f7d038c5f82478982d713f94b230f7b4b93d1a1fcdaed9',
  'sources-p020': '7abbca535ff611bc93a9deb1890b904da3c8657bfc52c83e96edcde59d616339',
  'sources-p021': '57095643d5d4deb494489b6a330609f888b82740da15bc8a0f1ad51286b8fdf8',
  'sources-p022': 'f7b1e1580c623527b873301ae82e7d7e9e08ea15dfb7f775f08d1cb4cf12c070',
  'sources-p023': '3de045fc4a6cb81c80b52bb690a24bac3dd0777a5ab54b3f69bcc5629e6e6a52',
  'sources-p024': 'f8eb9787bfdfa402931a4e03145244142aff45d8b92369e3dbdc55d8ca41a84a',
  'sources-p025': '97b801f9d25255656a7e4612e3665991f010a404efa5f8589d78a5854174af75',
  'sources-p026': 'b72a9d1bf6433adf203fd4b04f636a2e4068ef4293de73056ac53844fe2e9ae9',
  'sources-p035': '564cb9a2102ae793d73c3060167f97d59e2c68e72824ce8fe8e87a014c7de105',
  'sources-p036': '478c57d40779b2ff16dda15a00ba432911579dcbc8bc2ffcf2464e19fde0365f',
  'sources-p037': 'fa16ce0e91f9bbaa649b35d88daedb5106d50381d4ea07f96b65f9460fc7cdcf',
  'sources-p038': 'a5e73ec185df8e90d30b858075c1436a49a5f929f9966d4026b69f553375d34c',
  'sources-p039': '405c3d6f6002e1c953d0b8b67d9dd86f54aa65f4dd1cf4e580caae98915a8838',
  'sources-p040': 'de312b11b598dbc7ad6fe572604b5a1e2a459d78f2bbd872ea9b0290503b9fff',
  'sources-p041': '8b4a958ad81df06b8614c879816c30abd06d174a43059245858759bb67541994',
};
const sourceKey = id => typeof id === 'string' && id.startsWith(prefix) && id.endsWith('-001') ? id.slice(prefix.length, -4) : '';
export const isLillyWealthSourcesSource = claim => Object.hasOwn(reviewed, sourceKey(claim.id));

export function lillyWealthSourcesSourceMatches({ id, source, conditions, evidence }) {
  const digest = createHash('sha256').update(JSON.stringify([source, conditions, evidence])).digest('hex');
  return reviewed[sourceKey(id)] === digest;
}

const elements = ['fire', 'earth', 'air', 'water'];
const qualities = { benefic: ['Jupiter', 'Venus'], malefic: ['Saturn', 'Mars'] };
const selection = 'profiles.lilly.wealth.selection.';
const roles = ['second_house_ruler', 'intercepted_sign_ruler', 'fortune_lot', 'fortune_lot_ruler', 'jupiter', 'second_house_window_planet'];
const roleConditions = new Map([
  ...roles.map(role => [selection + 'roles.' + role, 'role.' + role]),
  [selection + 'second_house_contains_intercepted_sign', 'role.intercepted_sign_ruler'],
  [selection + 'active_object_is_planet', 'role.second_house_window_planet'],
  [selection + 'active_planet_in_second_house_five_degree_window', 'role.second_house_window_planet'],
  [selection + 'compared_planets_both_in_second_house_window', 'nearer_cusp'],
  [selection + 'active_planet_nearer_second_cusp_than_comparison', 'nearer_cusp'],
  [selection + 'population_finalized', 'complete'],
  [selection + 'active_significator_confirmed', 'has_planet'],
  ...lillyDignityBodies.map(body => ['profiles.lilly.wealth.significators.' + body.toLowerCase(), 'planet.' + body.toLowerCase()]),
  ...elements.map(element => ['profiles.lilly.wealth.significators_in_elements.' + element, 'element.' + element]),
  ...Array.from({ length: 12 }, (_, index) => {
    const house = index + 1;
    return ['profiles.lilly.wealth_source.has_significator_in_house_' + house, 'house.' + house];
  }),
]);
export const lillyWealthSourcesSelectors = new Set([
  'second_house_method', ...roleConditions.values(), ...Object.keys(qualities).map(quality => 'nature.' + quality),
]);
const wealthFact = selector => ({ kind: 'western_lilly_wealth_source', selector });

export function lillyWealthSourcesCondition(fact, equals) {
  if (fact === 'context.lilly_wealth_significator_method' && equals === 'lilly_book_iii_second_house') return wealthFact('second_house_method');
  if (fact === selection + 'active_significator_nature' && Object.hasOwn(qualities, equals)) return wealthFact('nature.' + equals);
  return equals === true && roleConditions.has(fact) ? wealthFact(roleConditions.get(fact)) : null;
}

const arc = (from, to) => ((to - from) + 360) % 360;

export function lillyWealthSourcesFacts(facts, houses, fortune) {
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const cusps = lillyCusps(facts);
  if (!cusps) return [];
  const second = cusps[1];
  const positions = new Map(lillyDignityBodies.map(body => [body, lillyPlanetPosition(facts, body)]));
  const placements = new Map(houses.filter(f => f.kind === 'western_lilly_planet_house').map(f => [f.planet, f.house]));
  const active = new Set();
  const selectors = new Set(['second_house_method']);
  const select = (role, body) => {
    if (!positions.get(body)) return;
    selectors.add('role.' + role);
    active.add(body);
  };
  select('second_house_ruler', lillyDomicileRuler(second));
  for (const planet of lillyInterceptedSignRulers(cusps, 2)) select('intercepted_sign_ruler', planet);
  if (fortune) {
    selectors.add('role.fortune_lot');
    select('fortune_lot_ruler', fortune.ruler);
  }
  select('jupiter', 'Jupiter');

  const distances = [];
  for (const [body, position] of positions) {
    if (!position || placements.get(body) !== 2) continue;
    select('second_house_window_planet', body);
    const distance = arc(second, position.longitude);
    distances.push(Math.min(distance, 360 - distance));
  }
  if (distances.length > 1 && Math.min(...distances) < Math.max(...distances)) selectors.add('nearer_cusp');
  if (fortune && [...positions.values()].every(position => position && position.longitude !== null)) selectors.add('complete');
  if (active.size) selectors.add('has_planet');
  for (const [nature, members] of Object.entries(qualities)) {
    if (members.some(body => active.has(body))) selectors.add('nature.' + nature);
  }
  for (const body of active) {
    const { sign } = positions.get(body);
    selectors.add('planet.' + body.toLowerCase());
    selectors.add('element.' + elements[sign % 4]);
    if (placements.has(body)) selectors.add('house.' + placements.get(body));
  }
  return [...selectors].map(wealthFact);
}
