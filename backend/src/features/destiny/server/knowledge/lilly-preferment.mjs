import { createHash } from 'node:crypto';
import { lillyCusps, lillyHouse, lillyHouseRuleset } from '../../control/lilly-houses.mjs';
import { zodiacNames } from '../../control/charts.ts';
import { lillyAspect } from './lilly-aspects.mjs';
import { lillyCoangleFacts } from './lilly-coangles.mjs';
import { westernFixedStarProfile } from '../../control/western-fixed-stars.mjs';
import { lillyDignityProfile } from './lilly-dignities.mjs';
import { lillyNodeLongitudes } from './lilly-nodes.mjs';
import { lillyReceptionFacts } from './lilly-receptions.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const lillyPrefermentProfile = 'lilly-1647-preferment-configurations-v1';
const prefix = 'astro-lilly-v3-preferment-p';
const seven = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const lights = seven.slice(0, 2);
const planets = seven.slice(2);
const angles = [1, 4, 7, 10];
const cadent = [3, 6, 9, 12];
const distributionHouses = { angular: angles, succedent: [2, 5, 11], eighth_or_cadent: [8, ...cadent] };
export const lillyPrefermentDistributions = Object.keys(distributionHouses);
export const lillyPrefermentRoles = ['luminary', 'midheaven_ruler', 'tenth_house_occupant'];
const highDignities = ['domicile', 'exaltation', 'mutual'];
const lowerDignities = ['triplicity', 'term', 'face'];
const debilitations = ['peregrine', 'detriment', 'fall'];
export const lillyPrefermentDignities = [...highDignities, ...lowerDignities, ...debilitations];
// The six entries printed together in Book III p.616. This selection
// retains the book's joint first-or-second magnitude category.
export const lillyPrefermentRoyalStars = ['oculus_taurus', 'spica_virgo', 'hercules', 'lucida_lancis', 'cor_leonis', 'cor_scorpii'];
export const lillyTenthHouseStars = ['cor_leonis', 'arcturus', 'betelgeuse', 'capella'];
const tenthHouseCompanions = ['Sun', 'Jupiter', 'Moon'];
const royalHouses = [1, 10];
const closeCuspReview = '先接恒星视黄经与第一或第十宫头同整度的情况。第615页未注明的近宫头范围仍待核。';
const coangleReview = '已接入几何事件与出生时刻均在一恒星度内的共角。原书未给的其余时间距离及其他共角读法仍待核。';
const tenthCompanionReview = '先接恒星与行星同黄经整度且同在十宫的情况。第621页未给的其余相伴范围仍待核。';
const kinglyReview = '先接第一条的射手日金支和狮子木星配白羊火星支。狮子日金与木火对应度数的末支仍待核。';
const nodeSigns = [0, 4, 8, 11, 3];
const fire = [0, 4, 8].map(index => zodiacNames[index]);
const sign = (planet, index) => ({ kind: 'planet_sign', planet, sign: zodiacNames[index] });
const confirmedSign = (planet, index) => ({
  kind: 'western_lilly_preferment_sign', planet, sign: zodiacNames[index],
});
const kinglyBodies = ['Sun', 'Venus', 'Jupiter', 'Mars'];
const house = (planet, number) => ({ kind: 'western_lilly_planet_house', planet, house: number });
const cusp = (planet, number) => ({ kind: 'western_lilly_preferment_cusp', planet, house: number });
const nodeAtMc = planet => ({ kind: 'western_lilly_preferment_node_mc', planet });
const selection = (planet, role) => ({ kind: 'western_lilly_preferment_role', planet, role });
const witness = (table, planet, light) => ({ kind: 'western_lilly_preferment_witness', table, planet, light });
const distribution = (table, group) => ({ kind: 'western_lilly_preferment_distribution', table, group });
const grade = (table, dignity) => ({ kind: 'western_lilly_preferment_grade', table, dignity });
const starContact = (table, star) => ({ kind: 'western_lilly_preferment_royal_contact', table, star });
const starCusp = (star, house) => ({ kind: 'western_lilly_preferment_royal_cusp', star, house });
const tenthStar = (star, planet) => ({ kind: 'western_lilly_preferment_tenth_star', star, planet });
const friendlySupport = (table, planet) => ({ kind: 'western_lilly_preferment_friendly_support', table, planet });
const noLightSupport = table => ({ kind: 'western_lilly_preferment_no_light_support', table });
const exactExaltation = planet => ({ kind: 'western_lilly_preferment_exaltation_degree', planet });
const evidenceFact = (fact, planet) => ({ ...fact, kind: fact.kind + '_body', planet });
const ruleset = { kind: 'western_lilly_ruleset', ruleset: lillyHouseRuleset };
const allCadent = { kind: 'western_lilly_preferment_all_cadent' };
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const contact = (table, first, second, aspect = 'conjunction') =>
  ({ kind: 'western_lilly_aspect', table, first, second, aspect, matches: true });
const partile = (first, second, aspect = 'trine') => ({ kind: 'western_lilly_partile_aspect', first, second, aspect });
const pairs = (a, b, c) => [[a, b], [a, c], [b, c]];
const throughTables = build => ['main', 'other'].flatMap(build);
const sunOnMc = (table, moonInTaurus = false) => fire.map(sign => [
  ruleset, cusp('Sun', 10), { kind: 'planet_sign', planet: 'Sun', sign },
  contact(table, 'sun', 'moon', 'any'),
  ...(moonInTaurus ? [{ kind: 'planet_sign', planet: 'Moon', sign: zodiacNames[1] }] : []),
]);
const mcLuminaryGroups = table => [['day', 'Sun'], ['night', 'Moon']].map(([sect, planet]) => [
  ruleset, { kind: 'western_sect', sect }, cusp(planet, 10), friendlySupport(table, planet),
]);
const kinglyGroups = [
  ...throughTables(table => [[ruleset, cusp('Sun', 10), confirmedSign('Sun', 8),
    confirmedSign('Venus', 8), contact(table, 'sun', 'venus')]]),
  ...[0, 4, 8].map(index => [ruleset, cusp('Sun', 10), confirmedSign('Sun', index),
    confirmedSign('Jupiter', 4), confirmedSign('Mars', 0)]),
];
const nodeGroups = planet => nodeSigns.map(index => [ruleset, sign(planet, index), nodeAtMc(planet)]);
const selectionGroups = (role, bodies = seven) => bodies.map(planet => [ruleset, selection(planet, role)]);
const distributionGroups = group => throughTables(table => [[ruleset, distribution(table, group)]]);
const gradeGroups = dignities => throughTables(table => dignities.map(dignity => [ruleset, grade(table, dignity)]));
const starGroups = stars => throughTables(table => stars.map(star => [ruleset, starContact(table, star)]));
const starCuspGroups = stars => stars.flatMap(star => royalHouses.map(house => [ruleset, starCusp(star, house)]));
const coangleGroups = (stars, planets, angles = ['ascendant', 'mc']) => stars.flatMap(star =>
  planets.flatMap(planet => angles.map(angle => [ruleset, { kind: 'western_lilly_preferment_coangle', star, planet, angle }])));
const noMaleficAffliction = table => lights.flatMap(light => ['mars', 'saturn'].flatMap(malefic =>
  ['conjunction', 'square', 'opposition'].map(aspect => ({
    ...contact(table, light.toLowerCase(), malefic, aspect), matches: false,
  }))));
// In the supported birth years, the inner planets' ecliptic longitude
// separations from the Sun do not reach the moiety of even the sextile.
const witnessPlanets = light => light === 'Moon' ? planets : planets.slice(2);

// Christian Astrology III, pp. 615–620. Each entry pins the particular
// source transcription so an edit to its evidence cannot inherit the rule.
const reviewed = new Map([
  ['007-001', ['9a4cf62e4c3cf0f3acda0c49789508e7a095807725cc0499ae1c62d079f44248', [],
    coangleGroups(['caput_algol'], ['Sun', 'Jupiter', 'Moon'], ['mc']), coangleReview]],
  ['008-001', ['f6e7d0e307ccd40301b18359f4c4b7a616f26b6d3ca85e0ff339d017ef40846c', [],
    coangleGroups(['oculus_taurus', 'cor_scorpii'], ['Sun', 'Moon']), coangleReview]],
  ['009-001', ['0bc9b1803715eb87c8af40a713f9029963726fbf31af72b948796c14e0135933', [], lillyTenthHouseStars.flatMap(star =>
    tenthHouseCompanions.map(planet => [ruleset, tenthStar(star, planet)])), tenthCompanionReview]],
  ['010-001', ['d9ccfd390cee969976e8aa809b23b356e18c6a34845225b2412b38fd4617aaa9', [],
    coangleGroups(['sirius', 'procyon'], ['Sun']), coangleReview]],
  ['012-001', ['ce6f521c24bf7273741a2f9dba69beac97d822e0bb18b533c6919de527b3f083', [], gradeGroups(highDignities)]],
  ['013-001', ['7d7c8104a94d508ac321c4e60a9423b8cd99c1780adaa66ad5c74e0eeae7ca13', [], gradeGroups(lowerDignities)]],
  ['014-001', ['5656c0ee48fb31439ce62314fe3704ffef82b33e5956e390fd3e77b0dff83e70', seven, gradeGroups(debilitations)]],
  ['016-001', ['249185465bd95392b93078d64b9de66e8709d579d344746a279974d722bb9e2e', ['Sun', 'Moon', 'Mars', 'Saturn'],
    throughTables(table => [[ruleset, ...lights.map(exactExaltation), ...noMaleficAffliction(table)]])]],
  ['018-001', ['db152850599fcb940c8a4c82b8810958ac3a76b5a170319ecd04e23f558e379b', [], throughTables(mcLuminaryGroups)]],
  ['020-001', ['c240d8f3e0d552e933a0d5f11b30d1b278b4bfb9fd3cd28884438deab519822f', [], kinglyGroups, kinglyReview]],
  ['025-001', ['e1fa67ee03eab3a3fe280e1b5a1f7872be74b57f5b25aa90e8b0e318f36f7fb9', ['Sun', 'Jupiter', 'Moon'],
    [[tropical, ...pairs('sun', 'jupiter', 'moon').map(([a, b]) => partile(a, b))]]]],
  ['029-001', ['004ae52443875e21ef9342e5837198bb6cb18a00a416ce73ac9c610747336d6f', ['Moon', 'Sun'],
    [[ruleset, sign('Moon', 1), sign('Sun', 4), cusp('Moon', 1)]]]],
  ['031-001', ['0d2aba00673807b9bd2f1e3d2ddf6439ec5b3cbcafbf6eb58ae7cde2ef98f4c9', ['Moon', 'Jupiter'],
    throughTables(table => [1, 10].map(h => [
      ruleset, sign('Moon', 3), sign('Jupiter', 3), house('Moon', h), house('Jupiter', h), contact(table, 'moon', 'jupiter'),
    ]))]],
  ['036-001', ['a616802e8dd083a64ce9ef205deb9a6f3175dd183d42bbac0dddd1a6aa17b8f9', [], starGroups(['oculus_taurus'])]],
  ['037-001', ['c20dea3a1389ab59cd3c05e6d6cd4564fac357ed92fc34a3a7510915e4d743aa', [], starGroups(['spica_virgo'])]],
  ['038-001', ['90d9f47a52bd8ac0cf90f76b27e360a4ec103a797cdf10395abf738e741037ce', [], starGroups(['hercules'])]],
  ['039-001', ['15aa8ea705bb20aa98d9e8c52abafeddab1a606ec28c077e267c96474ffcafe9', [], starGroups(['lucida_lancis'])]],
  ['040-001', ['56adc0a1a7d9efcc77bafc1ed5925c52105e1e47e1fe92ea8073559da642190c', [], starGroups(['cor_leonis'])]],
  ['041-001', ['c608f3c82ac8a3e92cec77095d9460a9c60dcfd3606ba56840f02b7a01e8bc83', [], starGroups(['cor_scorpii'])]],
  ['042-001', ['56c28561a30035f03574f0877d77ffcbe5c4115f76b60b6e1262a9535622e161', [], starCuspGroups(['spica_virgo']), closeCuspReview]],
  ['045-001', ['82b581298e815076fce4f30b7e94647bf4b5911cd49d2a8f4378c46a06b72a2d', ['Mars'],
    [[ruleset, { kind: 'western_lilly_house_ruler', house: 1, planet: 'Mars' }, cusp('Mars', 10)]]]],
  ['050-001', ['dbb0067274e67a401cf23937f10c33b85174a488b82b52bb26ed6774f2626e1c', seven, [[ruleset, allCadent]]]],
  ['051-001', ['41d63d617d6fbf1ad7aed637ca3fe291b813a7d627ddaf049fd895321b565ac0', ['Sun', 'Moon', 'Venus', 'Jupiter'],
    throughTables(table => [[ruleset, noLightSupport(table)]])]],
  ['055-001', ['b6a23ab4e5b6c8887787d539c095e445c83f507d52ce63ab2d3903cce96173cf', ['Sun', 'Moon'], throughTables(table => sunOnMc(table))]],
  ['056-001', ['6224f820f8f69ed09d1fa5404a61cb3651d5a1ded31a65fb443ac89521ba8dfd', ['Sun', 'Moon'], throughTables(table => sunOnMc(table, true))]],
  ['057-001', ['a1fd0a4282a3b81caa723f98e9b524c3292cb79a30d8a0dbf0944bf7ed13fecd', ['Jupiter', 'Venus', 'Moon'], [
    ...throughTables(table => [[ruleset, ...pairs('jupiter', 'venus', 'moon').map(([a, b]) => contact(table, a, b))]]),
    [ruleset, ...pairs('jupiter', 'venus', 'moon').map(([a, b]) => partile(a, b))],
  ]]],
  ['058-001', ['53ab652ee9aa29bee7f5a78cd4a8dbe29590ef693d1ffc746b6c9ab0e7c1c4df', ['Jupiter', 'Venus'],
    throughTables(table => angles.map(h => [ruleset, house('Jupiter', h), house('Venus', h), contact(table, 'jupiter', 'venus')]))]],
  ['059-001', ['4ce4fbf0cf77a951f4c8416219f198dc8c428b5a83c205c4a014a271d94aa0a9', ['Jupiter'], nodeGroups('Jupiter')]],
  ['060-001', ['519a86785f6f66f36fb88661b7b5ed409d444de56c1957210d6cebc500964814', ['Moon'], nodeGroups('Moon')]],
  ['062-001', ['d818bdfd0fead340ebc37881ea57691bd64805cc3d3ba0df08b2f1f1baafa92c', ['Sun', 'Venus', 'Moon'],
    [[ruleset, house('Moon', 1), partile('sun', 'venus', 'conjunction')]]]],
  ['091-001', ['79dd7ef2df5ec238aa469bc702e995ea3655f55a83f20e55f8a843853b6171e2', seven, distributionGroups('angular')]],
  ['092-001', ['2524ccd14545e138cbeafe8d4326212460cff1ce0f0d753e867373b28de96f0b', seven, distributionGroups('succedent')]],
  ['093-001', ['e6e1b9137700839f06de1fb39274e8ed3a4af02451085d34a89a000c95c10872', seven, distributionGroups('eighth_or_cadent')]],
  ['098-001', ['a4fec6b646f9d215a97d48077f92bbb8da22d357b0039b2ec30274fb18ff2d01', [], selectionGroups('luminary', lights)]],
  ['099-001', ['814aaf2ffa7f1fa706740d7ebc32bd229782339254862fd9d60eb94e667a54c9', [], throughTables(table => lights.flatMap(light =>
    witnessPlanets(light).map(planet => [ruleset, witness(table, planet, light)])))]],
  ['100-001', ['df917a91bbb050efe60222687fe3ad9ed0a471fb2a4974895360a9ddebbd4249', [], selectionGroups('midheaven_ruler')]],
  ['101-001', ['443b74f8125914ce7b2a88a6772126db731f0aab75774ee7b78dda78be6557ad', [], selectionGroups('tenth_house_occupant')]],
  ['102-001', ['acc39f61f4ce544eef7abe5057a0312cfcb1a14f0c4bd2a78de169171efb4f89', [], starCuspGroups(lillyPrefermentRoyalStars), closeCuspReview]],
  ['103-001', ['a847fb62aba7edce36280af4e76a4d4722bf0c8c616d814a20b8eedf5c272ba2', [], starGroups(lillyPrefermentRoyalStars)]],
  ['124-001', ['ee824564952f8964cdb2346102aba78e7ebdc5eb412695293dd6048db7f87f12', ['Sun', 'Moon'], throughTables(table => sunOnMc(table, true))]],
]);

function verifiedLongitude(facts, planet) {
  const positions = new Set(facts.filter(fact => fact.kind === 'planet_longitude' && fact.planet === planet)
    .map(fact => fact.longitude));
  if (positions.size !== 1) return null;
  const [longitude] = positions;
  const sign = zodiacNames[Math.floor(longitude / 30)];
  if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360
    || facts.some(fact => fact.kind === 'planet_sign' && fact.planet === planet && fact.sign !== sign)) return null;
  return longitude;
}

export function consistentLillyPrefermentSource(id, facts) {
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  const spec = reviewed.get(id.slice(prefix.length));
  return zodiacs.size === 1 && zodiacs.has('tropical')
    && spec?.[1].every(planet => verifiedLongitude(facts, planet) !== null);
}

export function lillyPrefermentFacts(facts, houses, dignities = [], cellsAt) {
  const cusps = lillyCusps(facts);
  if (!cusps) return [];
  const longitudes = new Map(seven.map(planet => [planet, verifiedLongitude(facts, planet)]));
  const contacts = [['Moon', 1], ['Moon', 10], ['Mars', 10], ['Sun', 10]].flatMap(([planet, number]) => {
    const longitude = longitudes.get(planet);
    return longitude !== null && Math.floor(longitude) === Math.floor(cusps[number - 1]) ? [cusp(planet, number)] : [];
  });
  const placements = new Map(houses.filter(fact => fact.kind === 'western_lilly_planet_house'
    && longitudes.get(fact.planet) !== null).map(fact => [fact.planet, fact.house]));
  if (seven.every(planet => cadent.includes(placements.get(planet)))) contacts.push(allCadent);
  // Book I p.104 gives the Sun 19 Aries and the Moon 3 Taurus.
  if (Math.floor(longitudes.get('Sun') ?? -1) === 19) contacts.push(exactExaltation('Sun'));
  if (Math.floor(longitudes.get('Moon') ?? -1) === 33) contacts.push(exactExaltation('Moon'));
  const kinglySigns = kinglyBodies.filter(planet => longitudes.get(planet) !== null)
    .map(planet => confirmedSign(planet, Math.floor(longitudes.get(planet) / 30)));
  const { selected, possibleByTable } = selectionFacts(houses, longitudes, placements);
  return [...contacts, ...kinglySigns, ...northNodeAtMc(facts, longitudes, cusps[9]), ...selected,
    ...dignityEvidence(facts, longitudes, selected, possibleByTable, dignities, cellsAt),
    ...royalEvidence(facts, longitudes, selected, cusps), ...lillyCoangleFacts(facts, cusps, longitudes),
    ...tenthHouseStarFacts(facts, cusps, longitudes, placements), ...luminarySupportFacts(facts, longitudes, placements, contacts)];
}

function catalogStarLongitudes(facts, stars) {
  const points = facts.filter(fact => fact.kind === 'western_fixed_star_longitude' && fact.profile === westernFixedStarProfile);
  return stars.flatMap(star => {
    const positions = new Set(points.filter(fact => fact.star === star).map(fact => fact.longitude));
    const [longitude] = positions;
    return positions.size === 1 && Number.isFinite(longitude) && longitude >= 0 && longitude < 360 ? [{ star, longitude }] : [];
  });
}

function tenthHouseStarFacts(facts, cusps, longitudes, placements) {
  return catalogStarLongitudes(facts, lillyTenthHouseStars).flatMap(({ star, longitude }) => {
    if (lillyHouse(longitude, cusps) !== 10) return [];
    return tenthHouseCompanions.filter(planet => placements.get(planet) === 10
      && Math.floor(longitudes.get(planet)) === Math.floor(longitude)).map(planet => tenthStar(star, planet));
  });
}

function luminarySupportFacts(facts, longitudes, placements, contacts) {
  const sects = new Set(facts.filter(fact => fact.kind === 'western_sect').map(fact => fact.sect));
  const sectLight = sects.size === 1 ? (sects.has('day') ? 'Sun' : 'Moon') : null;
  const atMc = sectLight && contacts.some(fact => fact.kind === 'western_lilly_preferment_cusp' && fact.planet === sectLight && fact.house === 10);
  const outsideAnglesAndMasculineSigns = lights.every(light => placements.has(light)
    && !angles.includes(placements.get(light)) && Math.floor(longitudes.get(light) / 30) % 2 === 1);
  const aspect = (first, second, type, table) => lillyAspect(longitudes.get(first), longitudes.get(second),
    first.toLowerCase(), second.toLowerCase(), type, table);
  return throughTables(table => {
    const evidence = [];
    if (atMc) {
      const benevolent = seven.filter(planet => planet !== sectLight && aspect(sectLight, planet, 'friendly', table) === true);
      if (benevolent.length >= 2) evidence.push(friendlySupport(table, sectLight));
    }
    if (outsideAnglesAndMasculineSigns
      && lights.every(light => ['Jupiter', 'Venus'].every(planet => aspect(light, planet, 'conjunction', table) === false))) {
      evidence.push(noLightSupport(table));
    }
    return evidence;
  });
}

function qualifiedPlanets(selected, table, longitudes) {
  return [...new Set(selected.filter(fact => fact.kind === 'western_lilly_preferment_role'
    || fact.kind === 'western_lilly_preferment_witness' && fact.table === table)
    .map(fact => fact.planet).filter(planet => longitudes.get(planet) !== null))];
}

function dignityEvidence(facts, longitudes, selected, possibleByTable, dignities, cellsAt) {
  if (!cellsAt || !dignities.length) return [];
  const valid = seven.filter(planet => longitudes.get(planet) !== null).map(planet => planet.toLowerCase());
  const requested = valid.flatMap(first => valid.filter(second => first < second).map(second =>
    ({ kind: 'western_lilly_reception', first, second, reception: 'mutual', profile: lillyDignityProfile })));
  const receptions = lillyReceptionFacts(facts, requested, cellsAt);
  return throughTables(table => {
    const definite = qualifiedPlanets(selected, table, longitudes);
    const possible = possibleByTable.get(table);
    return definite.flatMap(planet => {
      const body = planet.toLowerCase();
      const states = new Map(dignities.filter(fact => fact.planet === planet).map(fact => [fact.dignity, fact.matches]));
      const mutual = new Map(receptions.filter(fact => [fact.first, fact.second].includes(body))
        .map(({ first, second, matches }) => [first === body ? second : first, matches]));
      const own = highDignities.slice(0, 2);
      const strong = own.filter(name => states.get(name) === true);
      if (definite.some(other => mutual.get(other.toLowerCase()) === true)) strong.push('mutual');
      const noReception = possible && [...possible].every(other => other === planet || mutual.get(other.toLowerCase()) === false);
      const moderate = noReception && own.every(name => states.get(name) === false)
        ? lowerDignities.filter(name => states.get(name) === true) : [];
      const weak = noReception ? debilitations.filter(name => states.get(name) === true) : [];
      return [...strong, ...moderate, ...weak].flatMap(dignity => {
        const proof = grade(table, dignity);
        return [proof, evidenceFact(proof, planet)];
      });
    });
  });
}

function royalEvidence(facts, longitudes, selected, cusps) {
  const stars = catalogStarLongitudes(facts, lillyPrefermentRoyalStars);
  const onCusps = stars.flatMap(({ star, longitude }) => royalHouses
    .filter(house => Math.floor(longitude) === Math.floor(cusps[house - 1])).map(house => starCusp(star, house)));
  const accompanying = throughTables(table => {
    const planets = qualifiedPlanets(selected, table, longitudes);
    return stars.flatMap(({ star, longitude }) => planets.flatMap(planet => {
      const gap = Math.abs(longitude - longitudes.get(planet));
      const proof = starContact(table, star);
      return Math.min(gap, 360 - gap) <= 5 + 1e-10 ? [proof, evidenceFact(proof, planet)] : [];
    }));
  });
  return [...onCusps, ...accompanying];
}

export function lillyPrefermentConditions(conditions, observed) {
  const keys = new Set([conditions.required, ...conditions.alternatives].flat().filter(({ kind }) =>
    ['western_lilly_preferment_grade', 'western_lilly_preferment_royal_contact'].includes(kind)).map(fact => JSON.stringify(fact)));
  if (!keys.size) return conditions;
  const measurements = observed.filter(fact => {
    if (!['western_lilly_preferment_grade_body', 'western_lilly_preferment_royal_contact_body'].includes(fact.kind)) return false;
    const { kind, planet, ...fields } = fact;
    return keys.has(JSON.stringify({ kind: kind.slice(0, -'_body'.length), ...fields }));
  });
  return { ...conditions, measurements: [...conditions.measurements, ...measurements] };
}

function northNodeAtMc(facts, longitudes, mc) {
  const [north] = lillyNodeLongitudes(facts);
  if (!north) return [];
  const sign = Math.floor(north.longitude / 30);
  const near = (a, b) => {
    const gap = Math.abs(a - b);
    return Math.min(gap, 360 - gap) <= 1 + 1e-10;
  };
  return ['Jupiter', 'Moon'].flatMap(planet => {
    const longitude = longitudes.get(planet);
    if (longitude === null || !nodeSigns.includes(sign) || Math.floor(longitude / 30) !== sign
      || !near(north.longitude, longitude) || !near(mc, longitude) || !near(mc, north.longitude)) return [];
    // The text specifies a one-degree pairing; require at least one body
    // on the ecliptic degree of the cusp as well as proximity for both.
    return [longitude, north.longitude].some(position => Math.floor(position) === Math.floor(mc)) ? [nodeAtMc(planet)] : [];
  });
}

function selectionFacts(houses, longitudes, placements) {
  const mcLord = houses.find(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === 10)?.planet;
  const occupants = seven.filter(planet => placements.get(planet) === 10);
  const roles = [
    ...lights.filter(light => longitudes.get(light) !== null).map(light => selection(light, 'luminary')),
    ...(mcLord ? [selection(mcLord, 'midheaven_ruler')] : []),
    ...occupants.map(planet => selection(planet, 'tenth_house_occupant')),
  ];
  const complete = mcLord && seven.every(planet => placements.has(planet));
  const possibleByTable = new Map();
  const selected = [...roles, ...throughTables(table => {
    const possibleSignificators = new Set([...lights, mcLord, ...occupants]);
    const evidence = [];
    for (const light of lights) {
      for (const planet of planets) {
        const position = longitudes.get(planet), lightPosition = longitudes.get(light);
        if (position === null || lightPosition === null) continue;
        const sees = lillyAspect(position, lightPosition, planet.toLowerCase(), light.toLowerCase(), 'any', table);
        if (sees && witnessPlanets(light).includes(planet)) evidence.push(witness(table, planet, light));
        // A bodily conjunction remains ambiguous for "behold". Aggregates
        // must still hold if its planet is included under the broader reading.
        if (sees !== false) possibleSignificators.add(planet);
      }
    }
    if (complete) {
      possibleByTable.set(table, possibleSignificators);
      for (const [group, permitted] of Object.entries(distributionHouses)) {
        if ([...possibleSignificators].every(planet => permitted.includes(placements.get(planet)))) {
          evidence.push(distribution(table, group));
        }
      }
    }
    return evidence;
  })];
  return { selected, possibleByTable };
}

export function compileLillyPrefermentSource(claim) {
  if (typeof claim.id !== 'string' || !claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [expected, , groups, pendingReview] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== expected) {
    return { reason: 'source_review_required', reviewNote: '莉莉名望篇条文的出处、条件或证据已变化，须重新复核。' };
  }
  return {
    compiler: lillyPrefermentProfile,
    inputs: groups.map(required => normalizeRuleInput('western', { required })),
    ...(pendingReview && { remainingAlternatives: 1, reviewNote: pendingReview }),
  };
}

export function lillyPrefermentExplanation(id) {
  const number = Number(id.slice(prefix.length, prefix.length + 3));
  if (number === 9) return '按莉莉前五度判宫核恒星与日、月或木星同在十宫，并要求两点的视黄经处于同一整度。原书未量化的其余相伴范围仍待核。';
  if (number === 18) return '日盘取太阳，夜盘取月亮。该光体与实际第十宫头同一黄经整度，并在同一套容许度内与至少两颗不同星曜成六合或拱相。';
  if (number === 20) return '先核太阳与实际十宫头同整度。射手日金支查合相。另一支查火象太阳、狮子木星和白羊火星。原书第一条的对应度数末支仍待核。';
  if (number === 51) return '先各自查日月的出生落宫和星座。二者均在角宫外且处阴性座时，再逐一排除两光体与木星或金星的合相。';
  if ([56, 124].includes(number)) return '按莉莉名望篇核火象太阳与实际十宫头同整度并照见金牛月亮。两条资料取自同一格言，只作一项见证。';
  if ([7, 8, 10].includes(number)) return '按莉莉名望篇检查出生地点的几何事件。用恒星和行星的出生时刻视黄道坐标计算东侧升起或上中天。两事件互相及各自与出生时刻的距离均须不超过一恒星度，约四分钟。';
  if ([12, 13, 14].includes(number)) return '先确认实际入选的名望指征，再按莉莉尊贵表求本质尊贵。互容须两颗已入选的星相互位于对方尊贵。没有互容的分支须核齐七曜，并逐一排除其余可能入选者与该指征的互容。';
  if (number === 16) return '太阳白羊十九度、月亮金牛三度用原书擢升整度；同一套容许度内逐组排除火星、土星与两光体的合相、刑和冲。';
  if ([36, 37, 38, 39, 40, 41, 103].includes(number)) return '按名望篇，已选行星指征与第616页所列恒星的出生时刻视黄经距离须在五度以内。计权条的三项见证只适用于符合该原书条件的相伴关系。';
  if ([42, 102].includes(number)) return '按名望篇选取恒星指征。本次用出生时刻视黄经与第一或第十宫头同一整度的情况取证。原书所说近宫头的其余范围仍待核。';
  if ([59, 60].includes(number)) return '按莉莉名望篇核已确认的真北交点与行星同座、彼此相距一度以内。两点各离实际第十宫头不超过一度，至少一点与宫头处于同一黄经整度。';
  if ([91, 92, 93].includes(number)) return '按莉莉名望篇核齐七曜，再取日月、照见日月的行星、十宫庙主及十宫内星。同一颗星重复出现只计一次。分组需在合相是否计入照见的两种读法下都成立。恒星另取证，第八宫归入原书单列的分支。';
  if ([98, 99, 100, 101].includes(number)) return '按莉莉名望篇原列顺序取日月及照见它们的行星，优先看太阳，另查第十宫传统庙主与实际落十宫的行星。照见取半容许度内的六合、刑、拱或冲。此处提供盘面取证材料，历史官爵仍须结合来源语境。';
  return '按莉莉名望篇核对本命盘。宫头接触按同一黄经整度核实，落宫按宫头前五度判定，精确拱相与合相核对应整度。古书中的官爵和身份为历史取象，报告只引用已满足的盘面见证。';
}
