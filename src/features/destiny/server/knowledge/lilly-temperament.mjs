import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
import { lillyCusps, lillyHouseRuleset } from '../../control/lilly-houses.mjs';
import { lillyAspect, lillyOrbTables } from './lilly-aspects.mjs';
import { lillyDignityBodies } from './lilly-dignities.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const lillyTemperamentProfile = 'lilly-1647-temperament-witnesses-v1';
const prefix = 'astro-lilly-v3-manners-p';
const sourceNumber = id => id?.startsWith(prefix) && id.endsWith('-001') ? id.slice(prefix.length, -4) : null;
// Christian Astrology III, pp.533–534. Match the reviewed local transcription.
const reviewed = new Map([
  ['041', '71f7152063f0791605152b4e038f13b3a09e582801b3aefff8a4846ab6384956'],
  ['042', '23ba3e411edd9d58f9fe9625d53ddc7d147cd44d54c9cdaa2711fcdef9da93d9'],
  ['043', 'e1894b79f69a1f1229b051cad6892bd514123aa58781362c6616e4eaeb0e8190'],
  ['044', '7034cee68bb9a4f9f8780105dfa5e552ce03d704e6582a78cf3dce7f906f6ccd'],
  ['045', 'c9f23d4234686f7586c20f602c5fa1a585c1f2d27585aff96eba16d92bc85242'],
  ['046', 'a249f75cc2d85244369cc434b7473c1f1c1a89cf6fd2dd9a3539df701ea0e5ae'],
  ['047', 'ffced9bc8b26eeb38c4267fad6a6f929359efbdac2d18a4a04b18b14f5877e11'],
  ['048', '975427a574deb1df0caceec46086ba67e55a9edb6697c4d6074d1371755c3a1a'],
  ['049', '4d5f7edf245cc4b0ec5b5a31699e6e633540626c003dd6469b17c25f968ca95d'],
  ['050', '3ca200971632ff53c15e4c7ee1193a17389b908a841e5cb7bfbb298e97ac0a1a'],
  ['051', '50788b78075b8e098132b32d2c9d68004ac1ee9dead0a2f4d5906e5e2daee51f'],
  ['052', 'fd9b0f5d423195be8293bdf9f30a7f8371706f410b5a3d160b04b5b5b7cefd68'],
  ['053', 'dc5e666fb43875f9e8a41a664bfd550bf6290cad51659ea9bf78d064f4aadc85'],
  ['054', '2e8cbcb2e52ff0520e34fb086bacab7545603fdbe2c342aa5574d683f5bfc324'],
  ['055', 'ca53f06da5118271abc53600bc87be4eba74901ce166a972f2abc609a400238e'],
  ['056', 'c4fad4567e8d9d388a7d5fc9611a428b6cc3db8266bb10eed2f348fd855c48ef'],
  ['057', '45872eac373448bb9637d104e2245e4cc2fb4409c05190e45d3853fda5ac15ff'],
  ['058', 'b16e46e84a191f5e5e82f7ad00b43039c06bdc0ca2c5f79a3510f98014c8118c'],
  ['059', 'c797ebd8d50e40b78ced43c3efb57308a74638e090284aefaa6205bec81867a9'],
  ['060', 'f1a3bc925b448940fe5b1b976b50f85d4eb2601213b30e664103ed10db159489'],
  ['061', '319ac1f99584e35b8d5cf069cdc36912b1da6f092bd372b287951a68a43366df'],
  ['062', '4bda7f7d2819885596b8b5ba840d50e67b4a5cf5b726038568f84423a12ffb78'],
  ['063', 'a2bedd224eeedd71c7ffabb7711be9d4c26e6dcbefbbc6804f62ff30ef4cf0da'],
  ['064', '9a7eb99068ab5dd3807e8a69ad5852bf049f002bc806235f315d00dbdde4f70f'],
  ['065', '482b50853b3d07c433cb95a0b22476ed39586c327d75f09e8fb1252bc6067796'],
  ['066', '21f7534e66fc1461db3c7263eb0b96b608a38c8fcbbffc24756b973c09118fb1'],
  ['067', '1845fd4120c8e4b9b72e17d630049a0b213d0b275530501025e44324e33ee05e'],
  ['068', '4a1f1b60179ade09f27d4031de575a876bf156f9ec2d5ec3aa630686441b9af7'],
  ['076', 'c0b40f79a8efcd963f6c8fde49e67ce450e1dca7cb2ba5bce45f901e7a7d1673'],
  ['104', '4c2feeb23e8a4a12a195e868ffc86a3f7fa9ecc8a103a556ecdef9262b73c9cf'],
  ['105', '0700f2bcdf9e3ccc96f523cd3a975e4a906e3daa9d757cfdfd12937bd3aaaefc'],
  ['106', '7dc6d4c9e16c680b6f930ce3e349e99245fe06592370e74703a222b641462e7f'],
]);
const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const solarPhases = ['oriental', 'occidental'];
const lunarPhases = ['new_to_first_quarter', 'first_quarter_to_full', 'full_to_last_quarter', 'last_quarter_to_new'];
const countedPlanets = ['Saturn', 'Jupiter', 'Mars', 'Venus', 'Mercury'];
const labels = { Saturn: '土星', Jupiter: '木星', Mars: '火星', Venus: '金星', Mercury: '水星' };
const phaseLabel = ['新月至上弦', '上弦至满月', '满月至下弦', '下弦至新月'];
const malefics = ['Saturn', 'Mars'];
const maleficSelector = (planet, target) => `hard_ray.${planet.toLowerCase()}.${target}`;
const solarSelector = (planet, phase) => `planet_phase.${planet.toLowerCase()}.${phase}`;
const firstHouseObjects = ['planet', 'north_node', 'south_node'];
const hardRays = ['square', 'opposition'];
const wholeDegreeRays = [60, 90, 120, 180];

const select = new Map([
  ...malefics.flatMap(planet => ['ascendant', 'moon'].map(target => maleficSelector(planet, target)))
    .map((selector, i) => [41 + i, [selector]]),
  ...countedPlanets.flatMap(planet => solarPhases.map(phase => solarSelector(planet, phase)))
    .map((selector, i) => [45 + i, [selector]]),
  ...lunarPhases.map((phase, i) => [55 + i, ['moon_phase.' + phase]]),
  [59, ['first.north_node']], [60, ['first.south_node']],
  ...[0, 1, 2, 3].map(i => [61 + i, signs.slice(i * 3, (i + 1) * 3).map(sign => 'sun_season.' + sign)]),
  ...[0, 1, 2, 3].map(i => [65 + i, signs.filter((_, j) => j % 4 === i).map(sign => 'witness_sign.' + sign)]),
  [76, ['moon_in_first_double_weight']],
  [104, firstHouseObjects.map(kind => 'first.' + kind)],
  [105, ['partile_ray_to_ascendant']],
  [106, ['ray_to_moon_within_mediety']],
]);

const reviewedPartial = new Map([
  ['041', '按土星与实际上升点的整度刑冲取证，原书案例所取较宽上升相位继续复核。'],
  ['043', '按火星与实际上升点的整度刑冲取证，原书案例所取较宽上升相位继续复核。'],
  ...[45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 65, 66, 67, 68].map(number =>
    [String(number).padStart(3, '0'), '本条采用上升主、第一宫实落、上升整度相位及月亮容许度内照见等已核角色。命局主星和全局计权继续复核。']),
]);
export const lillyTemperamentReview = id => reviewedPartial.get(sourceNumber(id));

export const lillyTemperamentWitnesses = {
  'first.planet': '第一宫实落古典行星，计作莉莉气质篇取证项',
  'first.north_node': '瞬时月北交点位于第一宫，计作莉莉气质篇取证项',
  'first.south_node': '瞬时月南交点位于第一宫，计作莉莉气质篇取证项',
  moon_in_first_double_weight: '月亮实落第一宫，符合原书把月亮见证计为两份的条件',
  partile_ray_to_ascendant: '古典行星按同一黄道整度与实际上升点成六合、刑、拱或冲',
  ray_to_moon_within_mediety: '古典行星照见月亮，角度差在两星各自半容许度之和以内',
  ...Object.fromEntries(malefics.flatMap(planet => [
    [maleficSelector(planet, 'ascendant'), labels[planet] + '与实际上升点成整度刑相或冲相'],
    [maleficSelector(planet, 'moon'), labels[planet] + '在该套容许度内刑冲月亮'],
  ])),
  ...Object.fromEntries(countedPlanets.flatMap(planet => solarPhases.map(phase =>
    [solarSelector(planet, phase), labels[planet] + '具气质篇所列取证角色，相对太阳为' + (phase === 'oriental' ? '东方行' : '西方行')]))),
  ...Object.fromEntries(lunarPhases.map((phase, i) => ['moon_phase.' + phase, '月亮处于' + phaseLabel[i] + '阶段'])),
  ...Object.fromEntries(signs.flatMap((sign, i) => [
    ['sun_season.' + sign, '以太阳所在的' + zodiacNames[i] + '确定该季节见证'],
    ['witness_sign.' + sign, '上升、月亮或已核实的气质取证星体位于' + zodiacNames[i]],
  ])),
};

export const lillyTemperamentUsesOrbs = selector => typeof selector === 'string' && (
  selector.startsWith('planet_phase.') || selector.startsWith('witness_sign.')
  || /^hard_ray\.(mars|saturn)\.moon$/u.test(selector) || selector === 'ray_to_moon_within_mediety');
const witness = (selector, table = 'main') => ({ kind: 'western_lilly_temperament', table, selector });

export function compileLillyTemperamentSource(claim) {
  const number = sourceNumber(claim.id);
  if (!reviewed.has(number)) return undefined;
  const { source, conditions, evidence } = claim;
  if (reviewed.get(number) !== createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex')) {
    return { reason: 'source_review_required', reviewNote: '莉莉气质篇条文所据版本、条件或证据已变，须重新复核。' };
  }
  const requiresHouses = conditions.match.include[0].some(({ fact }) => fact === 'chart.house_system');
  const ruleset = { kind: 'western_lilly_ruleset', ruleset: lillyHouseRuleset };
  const inputs = select.get(Number(number)).flatMap(selector => (lillyTemperamentUsesOrbs(selector) ? Object.keys(lillyOrbTables) : ['main'])
    .map(table => normalizeRuleInput('western', { required: [witness(selector, table), ...(requiresHouses ? [ruleset] : [])] })));
  const reviewNote = lillyTemperamentReview(claim.id);
  return { compiler: lillyTemperamentProfile, inputs, ...(reviewNote && { reviewNote, remainingAlternatives: 1 }) };
}

function partileRay(first, second, angles) {
  if (![first, second].every(Number.isFinite)) return false;
  const gap = Math.abs(Math.floor(first) - Math.floor(second));
  return angles.includes(Math.min(gap, 360 - gap));
}

export function lillyTemperamentFacts(chart, houses, nodes, solar) {
  const zodiacs = new Set(chart.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const positions = new Map(lillyDignityBodies.map(planet => [planet, lillyPlanetPosition(chart, planet)]).filter(([, point]) => point));
  const longitude = planet => positions.get(planet)?.longitude;
  const sun = positions.get('Sun'), moon = positions.get('Moon');
  const results = [];
  const emit = (condition, selector, table) => { if (condition) results.push(witness(selector, table)); };
  if (sun) emit(true, 'sun_season.' + signs[sun.sign]);
  if (Number.isFinite(sun?.longitude) && Number.isFinite(moon?.longitude)) {
    const elongation = ((moon.longitude - sun.longitude) + 360) % 360;
    emit(true, 'moon_phase.' + lunarPhases[Math.floor(elongation / 90)]);
  }
  const ascendant = lillyCusps(chart)?.[0];
  const ascendantRuler = houses.find(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === 1)?.planet;
  const firstOccupants = houses.filter(fact => fact.kind === 'western_lilly_planet_house' && fact.house === 1
    && Number.isFinite(longitude(fact.planet))).map(fact => fact.planet);
  const firstNodes = nodes.filter(fact => fact.kind === 'western_lilly_node_house' && fact.house === 1).map(fact => fact.node);
  const ascendantRays = lillyDignityBodies.filter(planet => partileRay(longitude(planet), ascendant, wholeDegreeRays));
  emit(firstOccupants.length > 0, 'first.planet');
  for (const node of firstNodes) emit(true, 'first.' + node);
  emit(firstOccupants.includes('Moon'), 'moon_in_first_double_weight');
  emit(ascendantRays.length > 0, 'partile_ray_to_ascendant');

  for (const planet of malefics) emit(partileRay(longitude(planet), ascendant, [90, 180]), maleficSelector(planet, 'ascendant'));

  const signsInFirst = nodes.filter(fact => fact.kind === 'western_lilly_node_sign' && firstNodes.includes(fact.node))
    .map(fact => zodiacNames.indexOf(fact.sign));
  const permanentSigns = [Number.isFinite(ascendant) ? Math.floor(ascendant / 30) : null, moon?.sign, ...signsInFirst];
  for (const table of Object.keys(lillyOrbTables)) {
    const rayToMoon = (planet, aspect) => lillyAspect(longitude(planet), longitude('Moon'), planet.toLowerCase(), 'moon', aspect, table);
    const moonWitnesses = lillyDignityBodies.filter(planet => planet !== 'Moon' && rayToMoon(planet, 'any') === true);
    emit(moonWitnesses.length > 0, 'ray_to_moon_within_mediety', table);
    for (const planet of malefics) emit(hardRays.some(aspect => rayToMoon(planet, aspect) === true), maleficSelector(planet, 'moon'), table);
    const activePlanets = new Set([ascendantRuler, ...firstOccupants, ...ascendantRays, ...moonWitnesses]);
    const activeSigns = new Set([...permanentSigns, ...[...activePlanets].map(planet => positions.get(planet)?.sign)]);
    for (const index of activeSigns) if (Number.isInteger(index) && signs[index]) emit(true, 'witness_sign.' + signs[index], table);
    for (const planet of countedPlanets) {
      if (!activePlanets.has(planet)) continue;
      const name = planet.toLowerCase();
      const phase = solar.find(fact => fact.selector === name && fact.matches === true && solarPhases.includes(fact.condition))?.condition;
      if (phase) emit(true, solarSelector(planet, phase), table);
    }
  }
  return results;
}
