import { createHash } from 'node:crypto';
import { lillyCusps } from '../../control/lilly-houses.mjs';
import { lillyDignityProfile } from './lilly-dignities.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';

export const lillySiblingsProfile = 'lilly-1647-siblings-testimonies-v1';
const prefix = 'astro-lilly-v3-siblings-';
const reviewed = {
  p003: 'b92a5e1192ba008d475953c8998a357cf0d69d771aee6401fdca95130df5e6c4',
  p012: 'ec67a269521190714ed2919db6b7fb5a1c8c69cf11c3809c231facf06e340c82',
  p013: '652dc9b8fb6bcad42e2e2e89fa1d392ef30d2d702f898b06c629da42f888165a',
  p014: 'a72889fff3a490f1dcf504bc824cc25ef1d19b6708fa516cd37fde3b39a526dd',
  p015: '28e12cddd6a085ba343a4fd7c0b08bd6c25d369fae5bc32f55fc86e9395bc081',
  p016: '7701a27ba9e36c73ddccb368f496c6be07f78ea5d54f9be1dde431553378f6f3',
  p017: '726fd5e3a655118286918e46a5c5c56ea10a2a90eeb83480bdabeb6ccf7c141e',
  p018: '6b76ef575335fd07e29694e1a8ff576e848b50d257c98a53511aff034b96a328',
  p019: '7be486fa1a9acbec34862ffab613e6e5a3af31ad41d2c1a308615dfcf44ce4fb',
  p020: '583c9e1e026543b2fa0c4405c45b0e2036045a8dff8d113dee8e6d56b171b43e',
  p021: '7dc7d053aac2a7d8777f9c1e2d4af83851a2fab55ba25f1832a72f201a28689c',
  p022: 'ff7894ddfe2c1a41ba0a3a019e7c8bbafbf91c973294edbc32f3fd807949f3b5',
  p023: '8e6d1a031b53ca0617ad80b2c82ce760efd4ca7f933c6f624138446c475c2567',
  p024: '64f736d763fdb920c61cb655866a090d399e9a4c3b72420da8150eeae66c6439',
  p025: '079e45a4f4f143a0655d9ec6b07936c9f20085f2fc4ce8bc9f340857fb14c1cf',
  p026: '9f3f9ec2391c1e7a1622a92706dc36626676a87306097251816f1e3ff51d2a2e',
  p027: '58b553a4c786a5ff1550ac2efba39788ae959f3d5163ce03275abecb149106d7',
  p028: 'd9e00dff299433fea7778a117fbbaed1ce06b13099e42a1e3a17f956882e4f14',
  p029: '593cef4084858fc132c8fec9c0dfc82c88eb5b1180f2d3e0f04fb8bd96a0b85d',
  p030: '6829ffae1f1f40aa0d466c2a8a92d9a685d77005a1edafaac897ca724ef54775',
  p032: 'c5fc20b0072d0416dace4f4f176bcaeb9a5ec2eb2e179123e21ad4c63b451738',
  p037: '3d5dbe470700ada037692ba3eb40e496d5811580a947ee00f7b3dca5ea7024d2',
  p038: 'be6d6c841aaaf61334791b7bb8c2de79a49623441696956e3b672caf941b05d9',
};

const sourceKey = id => id?.startsWith(prefix) && id.endsWith('-001') ? id.slice(prefix.length, -4) : '';
export const isLillySiblingsSource = claim => Object.hasOwn(reviewed, sourceKey(claim.id));

export function lillySiblingsSourceMatches(claim) {
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify([source, conditions, evidence])).digest('hex');
  return reviewed[sourceKey(claim.id)] === digest;
}

const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const bodies = 'Jupiter Venus Saturn Mars Sun Moon'.split(' ');
const angularBodies = ['Saturn', 'Sun'];
// The explicitly named groups in Book III pp.565–566. The five qualified
// signs are still classifiable, but do not prove either joint condition.
const signGroups = { prolific: [3, 7, 8, 11], barren: [2, 4, 5] };
const jointSelectors = ['house_3_cusp_prolific', 'house_3_ruler_prolific', 'house_3_cusp_barren', 'house_3_ruler_barren'];
export const lillySiblingsSelectors = new Set([
  ...signs.map(sign => 'sign.' + sign),
  ...[...bodies.map(body => body.toLowerCase()), 'south_node'].map(body => 'planet.' + body),
  ...jointSelectors, ...angularBodies.map(body => 'angular.' + body.toLowerCase()),
]);
const siblingFact = selector => ({ kind: 'western_lilly_siblings', selector });

export function lillySiblingsCondition(fact, equals) {
  const chapter = 'profiles.lilly.siblings.';
  let selector;
  if (fact === chapter + 'classification.active_sign') selector = 'sign.' + equals;
  if (fact === chapter + 'classification.active_planet') selector = 'planet.' + equals;
  if (equals === true) {
    const joint = fact.startsWith(chapter) && fact.slice(chapter.length);
    if (jointSelectors.includes(joint)) selector = joint;
    for (const planet of angularBodies) {
      const body = planet.toLowerCase();
      if (fact === 'profiles.lilly.positions.' + body + '.angular') selector = 'angular.' + body;
      if (fact === chapter + 'birth_order.' + body + '_in_essential_dignity') {
        return { kind: 'western_lilly_dignity', planet, dignity: 'peregrine', matches: false, profile: lillyDignityProfile };
      }
    }
  }
  return lillySiblingsSelectors.has(selector) ? siblingFact(selector) : null;
}

export function lillySiblingsFacts(facts, houses, nodes) {
  const zodiacs = new Set(facts.filter(f => f.kind === 'western_zodiac').map(f => f.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const cusps = lillyCusps(facts);
  if (!cusps) return [];
  const ruler = houses.find(f => f.kind === 'western_lilly_house_ruler' && f.house === 3)?.planet;
  const placements = houses.filter(f => f.kind === 'western_lilly_planet_house');
  const occupants = placements.filter(f => f.house === 3).map(f => f.planet);
  const selected = new Set(['Mars', 'Moon', ...occupants]);
  if (ruler) selected.add(ruler);
  const positions = new Map([...new Set([...selected, ...angularBodies])].map(planet => [planet, lillyPlanetPosition(facts, planet)]));
  const cuspSign = Math.floor(cusps[2] / 30);
  const selectors = new Set(['sign.' + signs[cuspSign]]);
  for (const planet of selected) {
    const position = positions.get(planet);
    if (!position) continue;
    selectors.add('sign.' + signs[position.sign]);
    if (bodies.includes(planet)) selectors.add('planet.' + planet.toLowerCase());
  }
  if (nodes.some(f => f.kind === 'western_lilly_node_house' && f.node === 'south_node' && f.house === 3)) {
    selectors.add('planet.south_node');
  }
  // Read the ruler in the parallel sense of the house sign at p.568:
  // look up the sign the ruler actually occupies using this chapter's list.
  for (const [classification, members] of Object.entries(signGroups)) {
    if (members.includes(cuspSign)) selectors.add('house_3_cusp_' + classification);
    if (members.includes(positions.get(ruler)?.sign)) selectors.add('house_3_ruler_' + classification);
  }
  for (const { planet, house } of placements) {
    if (angularBodies.includes(planet) && positions.get(planet) && [1, 4, 7, 10].includes(house)) {
      selectors.add('angular.' + planet.toLowerCase());
    }
  }
  return [...selectors].map(siblingFact);
}
