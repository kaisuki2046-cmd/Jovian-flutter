import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
import { lillyCusps, lillyDomicileRuler, lillyHouseRuleset, lillyInterceptedSigns } from '../../control/lilly-houses.mjs';
import { westernFixedStarNames, westernFixedStarProfile } from '../../control/western-fixed-stars.mjs';
import { lillyAspect, lillyOrbTables } from './lilly-aspects.mjs';
import { lillyDignityBodies, lillyDignityNames } from './lilly-dignities.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const lillyMannersProfile = 'lilly-1647-manners-testimonies-v1';
const prefix = 'astro-lilly-v3-manners-p';
const sourceNumber = id => id?.startsWith(prefix) && id.endsWith('-001') ? id.slice(prefix.length, -4) : null;
// Reviewed Christian Astrology III, pp.535–538. Each digest keeps the source
// wording, parsed conditions and evidence tied to the same period and locus.
const reviewed = new Map([
  ['004', '87c84d782382dbe4d09d20dffb6a7e42205546687693b633455a9abb7839aa93'],
  ['006', '4bc087e4863de4ebe75de7f8d183505a4b1f7b84c2eb43b6ed3db48fb294495b'],
  ['007', 'fd9b4b1a9d55e02f9a931a3f47c7c8e375a2cf60610633a867a1add8b62ac0ca'],
  ['009', 'f29413745fb51cbe5b5b080341591ba1b1981ca90799cdf435f2e02cd8ab3ea6'],
  ['010', '16659b6801bf631d08981951775b089cab877b09ff2ad5929b937fcbd461e1ea'],
  ['011', 'be096e60b124eaf57ddb1cbdbb93042ddebfa8f8fedafd7df430c8c41d777e40'],
  ['012', 'cf08268d22b2b3b389b90392030128156086771b248111845438053b08144b6a'],
  ['013', '4a1b43e80705e479599597c85105488aa2d7927eaee32061fcf12adf149e2f1a'],
  ['019', 'db7b72ba504f8d8439f47bfda2117cf623281f5d1f6ea5847d7e94c01f97da21'],
  ['020', '38cddbad56a011566ed746a0140f999b379ee128a4795078925543b23c0284f4'],
  ['021', '3f429cefd1bfbe30d08c87197299488edfcf497bef24311f407e2c80991c4011'],
  ['022', 'a78699278ecf17bd93787b34229ad52be978c5aa03a38d899a8694d35b5dd461'],
  ['023', '4dc1adee634a341da955cde478455fdbdf981663d3393940a818c5592157b8ff'],
  ['024', '693666a8124f4298f490f4549d93aeed30259ebde09bc5874b3c2e8124fb55d8'],
  ['025', '2d4dc961d9ba9a8260edb863fcdefa9d6d25c68edd4fb72f55c334ce38b3bb84'],
  ['026', '0588295ed5cb748b9c1ceccf20998d140d654ba130904555ccfb93dd517f04c8'],
  ['027', '17ced620f0ea408dbf1dd6ddb7ea7cdad286290434397999a69957b90ed1cb6b'],
  ['028', 'b26b999261d39e36073944b86b9d934d4bf76c711d41ebbb99be7564f21be1b9'],
  ['029', '523e6ee0530d83e69c9bc80f9a44d9a56a479724e0d97ae48dde9f57e4d006f3'],
  ['030', 'd16189a9e0f879b49e6fb1776aa8be07a2255403a402b9a97e6065ca9cfef5c3'],
  ['031', '36a279cfde46b3614c3f53ab65c2f6b642b933a7c596f544e3d12d1309f7f766'],
  ['032', '911985d3c6cf6b38e2deb9351d866b42b8af609182079f4bbdbe501531404cca'],
  ['033', '65e3d10f986e18090caa9447765f468198934dea4eb1f32a52ff4188847d3db9'],
  ['034', '3f7f8fdf1d3b690b119e6cb14d94c27fa2a1c32e8a1199fed3af3b79d789cfb2'],
  ['035', '5ceba95f18e7e77eed7007237a64b7e25d03c78dc36813af8fe09f290554b3ab'],
  ['036', '367f03cf1f908fe670a2a63c2bbc5fed85a69ad5829486167bb337dc61047390'],
  ['077', '31eec0b23cbd2a6f3748c4a8aae29b1dc7940d84aa25044d26a16ce8c19f42d4'],
  ['078', '0874a8526e31c1672fd452c722e59c153e73f43a641f63399dd8309ff05d9293'],
  ['079', '99ef656c59baac6b843fe789095f707776bc9a5340a875ee443739f569f7fc6f'],
  ['080', '4dc070bf08aa6f606057a0bc9033cdaa5783c3a083d4360ef3718b12e2c808f7'],
  ['081', 'b48139d4a13f1f85712c87db6f44380ca657d3bf89c862865e5ad35f800c2f47'],
  ['086', '5806094e38a8b4360ee10115f1a4cfca3dda751da14fbc38f11ab92decca9f27'],
  ['088', '8e5dd98799abf0fd680ba2069c19eff321b3bd029be0e96d9d5fef3db3cef080'],
  ['094', '25c5ce888bba7e54a0f9e9481c3f7b0ed6e2b21674b71e445cf3f0d32440fd18'],
]);

const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const stars = new Map([
  ['004', 'caput_algol'], ['006', 'oculus_taurus'], ['007', 'capella'], ['009', 'procyon'],
  ['010', 'hercules'], ['011', 'cor_leonis'], ['012', 'cor_scorpii'], ['013', 'spica_virgo'],
]);
const specificStars = new Map([
  ['019', ['spica_virgo', 'Mercury']], ['020', ['spica_virgo', 'Saturn']], ['021', ['spica_virgo', 'Mars']],
  ['034', ['oculus_taurus', 'Moon']], ['078', ['oculus_taurus', 'Saturn']],
]);
const planetLabels = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星' };
const roleContact = (star, role) => `star.${star}.${role}`;
const explicitSelectors = new Map([
  ['035', ['selected_by_moon', 'selected_by_mercury']],
  ['036', ['selected_ascendant_ruler']],
  ['077', [roleContact('caput_algol', 'significator')]],
  ['079', ['same_candidate_conjoins_moon_and_mercury']],
  ['080', ['ascending_sign_candidate', 'intercepted_sign_candidate']],
  ['081', ['participating_essential_dignity']],
  ['086', ['mercury_one_partner']],
  ['088', ['mercury_domicile_lord']],
  ['094', ['moon_with_aldebaran_in_first']],
]);
const unresolvedSelection = '已采用上升或一宫截夺座中的五曜，以及完整盘面可确认的合相或上升主候选。特殊光体与末两步选星继续待复核。';
const reviewNotes = new Map([
  ...[...stars.keys(), ...specificStars.keys(), '077', '094'].map(number =>
    [number, '恒星接触采用同一黄道整度，原句的其他相伴范围继续待复核。']),
  ['009', '按原书其他章节同名星体校为南河三。此页九度与书中另外两处二十度左右的印载有别，按现时天文黄经复算接触。其他相伴范围待核。'],
  ...signs.map((_, i) => [String(i + 22).padStart(3, '0'), unresolvedSelection]),
  ['080', '已核上升座及第一宫截夺座内的五曜。日月作为主要指征所需的特别强势判据另待复核。'],
  ['081', unresolvedSelection],
  ['088', '目前查无合相时的异星庙主。原书所涉其他尊贵优先关系继续待复核。'],
]);

export const lillyMannersReview = id => reviewNotes.get(sourceNumber(id));
export const lillyMannersRepeatedPassages = [['astro-lilly-v3-manners-p077-001', { id: 'astro-lilly-v3-manners-p004-001' }]];

const coreText = {
  selected_by_moon: '确认上升座及第一宫无候选后，取与月亮合相的行星为性情指征',
  selected_by_mercury: '确认上升座及第一宫无候选后，取与水星合相的行星为性情指征',
  selected_ascendant_ruler: '上升及合相候选均已排除，实际第一宫主受其庙主照见',
  same_candidate_conjoins_moon_and_mercury: '上升座及第一宫空缺，另有同一颗行星同时与月亮和水星成合相',
  ascending_sign_candidate: '上升星座内有作为性情指征的古典行星',
  intercepted_sign_candidate: '第一宫内的完整截夺星座中有作为性情指征的古典行星',
  participating_essential_dignity: '另有一颗古典星体在已选性情指征的实际黄道度位具有本质尊贵',
  mercury_one_partner: '在其余古典星体均已核实的盘面中，水星仅与一颗古典星体成合相',
  mercury_domicile_lord: '已确认水星与其他六颗古典星体均无合相，且其所在星座的传统庙主是另一颗古典星体',
  moon_with_aldebaran_in_first: '月亮实际落第一宫，且与毕宿五的热带视黄经处于同一度位',
};
export const lillyMannersTestimonies = {
  ...coreText,
  ...Object.fromEntries(signs.map((sign, i) => ['sign.' + sign, '已选性情指征处于' + zodiacNames[i]])),
  ...Object.fromEntries([...stars.values()].flatMap(star => [
    [roleContact(star, 'significator'), '已选性情指征与' + westernFixedStarNames[star] + '处于同一黄道度位'],
    [roleContact(star, 'ascendant_ruler'), '实际第一宫主与' + westernFixedStarNames[star] + '处于同一黄道度位'],
  ])),
  ...Object.fromEntries([...specificStars.values()].map(([star, planet]) =>
    [roleContact(star, planet), planetLabels[planet] + '与' + westernFixedStarNames[star] + '处于同一黄道度位'])),
};

const aspectIndependent = new Set(['ascending_sign_candidate', 'intercepted_sign_candidate', 'moon_with_aldebaran_in_first']);
export const lillyMannersUsesOrbs = selector => Object.hasOwn(lillyMannersTestimonies, selector) && !aspectIndependent.has(selector)
  && (!selector.startsWith('star.') || selector.endsWith('.significator'));
const testimony = (selector, table = 'main') => ({ kind: 'western_lilly_manners', table, selector });
const rulesetFact = { kind: 'western_lilly_ruleset', ruleset: lillyHouseRuleset };

export function compileLillyMannersSource(claim) {
  const number = sourceNumber(claim.id);
  if (!reviewed.has(number)) return undefined;
  const { source, conditions, evidence } = claim;
  if (reviewed.get(number) !== createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex')) {
    return { reason: 'source_review_required', reviewNote: '莉莉性情篇条文所据版本、条件或证据已变，须重新复核。' };
  }
  const star = stars.get(number);
  const specific = specificStars.get(number);
  const sign = signs[Number(number) - 22];
  const selectors = star ? [roleContact(star, 'significator'), roleContact(star, 'ascendant_ruler')]
    : specific ? [roleContact(...specific)] : sign ? ['sign.' + sign] : explicitSelectors.get(number);
  const inputs = selectors.flatMap(selector => (lillyMannersUsesOrbs(selector) ? Object.keys(lillyOrbTables) : ['main']).map(table =>
    normalizeRuleInput('western', { required: [testimony(selector, table), ...(specific ? [] : [rulesetFact])] })));
  const reviewNote = lillyMannersReview(claim.id);
  return { compiler: lillyMannersProfile, inputs, ...(reviewNote && { reviewNote, remainingAlternatives: 1 }) };
}

const periodPlanets = lillyDignityBodies.filter(planet => !['Sun', 'Moon'].includes(planet));
const catalogStars = [...new Set([...stars.values(), ...[...specificStars.values()].map(([star]) => star)])];
const positiveDignities = lillyDignityNames.slice(0, 5);
const validLongitude = value => Number.isFinite(value) && value >= 0 && value < 360;
const signOf = longitude => Math.floor(longitude / 30);

export function lillyMannersFacts(chart, houses, cellsAt) {
  const zodiac = new Set(chart.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiac.size !== 1 || !zodiac.has('tropical')) return [];
  const positions = new Map(lillyDignityBodies.map(planet => [planet, lillyPlanetPosition(chart, planet)?.longitude])
    .filter(([, longitude]) => validLongitude(longitude)));
  const catalogLongitudes = new Map(catalogStars.map(star => {
    const values = new Set(chart.filter(fact => fact.kind === 'western_fixed_star_longitude' && fact.profile === westernFixedStarProfile
      && fact.star === star).map(fact => fact.longitude));
    const [longitude] = values;
    return [star, values.size === 1 && validLongitude(longitude) ? longitude : undefined];
  }));
  const contact = (star, planet) =>
    Math.floor(catalogLongitudes.get(star)) === Math.floor(positions.get(planet));
  const output = [];
  const emit = (condition, selector, table) => { if (condition) output.push(testimony(selector, table)); };
  for (const [star, planet] of specificStars.values()) emit(contact(star, planet), roleContact(star, planet));
  const cusps = lillyCusps(chart);
  if (!cusps) return output;
  const intercepted = lillyInterceptedSigns(cusps, 1);
  const ascendantSign = signOf(cusps[0]);
  const locatedInFirst = new Set(houses.filter(fact => fact.kind === 'western_lilly_planet_house' && fact.house === 1)
    .map(fact => fact.planet));
  const ascendantRuler = lillyDomicileRuler(cusps[0]);
  const inAscendingSign = planet => signOf(positions.get(planet)) === ascendantSign;
  const inInterceptedSign = planet => intercepted.includes(signOf(positions.get(planet)));
  const firstCandidates = periodPlanets.filter(planet => inAscendingSign(planet) || inInterceptedSign(planet));
  const verifiedVacancy = positions.size === lillyDignityBodies.length && !lillyDignityBodies.some(planet =>
    locatedInFirst.has(planet) || inAscendingSign(planet) || inInterceptedSign(planet));

  emit(firstCandidates.some(planet => inAscendingSign(planet)), 'ascending_sign_candidate');
  emit(firstCandidates.some(planet => inInterceptedSign(planet)), 'intercepted_sign_candidate');
  emit(locatedInFirst.has('Moon') && contact('oculus_taurus', 'Moon'), 'moon_with_aldebaran_in_first');
  for (const star of stars.values()) emit(contact(star, ascendantRuler), roleContact(star, 'ascendant_ruler'));

  const declaredSect = new Set(chart.filter(fact => fact.kind === 'western_sect').map(fact => fact.sect));
  const sects = declaredSect.size === 1 ? [...declaredSect] : ['day', 'night'];
  const hasParticipatingDignity = planet => {
    const longitude = positions.get(planet);
    const cells = cellsAt?.(signs[signOf(longitude)], Math.floor(longitude % 30)) ?? [];
    return cells.some(({ body, dimension, sect }) => planet.toLowerCase() !== body && positiveDignities.includes(dimension)
      && (sect === 'both' || sects.every(chartSect => chartSect === sect)));
  };
  for (const table of Object.keys(lillyOrbTables)) {
    const aspect = (first, second, name) => lillyAspect(positions.get(first), positions.get(second),
      first.toLowerCase(), second.toLowerCase(), name, table);
    const partnersOf = planet => lillyDignityBodies.filter(candidate => candidate !== planet
      && aspect(planet, candidate, 'conjunction') === true);
    const moonPartners = partnersOf('Moon'), mercuryPartners = partnersOf('Mercury');
    const noMercuryPartner = positions.size === lillyDignityBodies.length && !mercuryPartners.length;
    const dispositorAspects = verifiedVacancy && !moonPartners.length && noMercuryPartner
      && aspect(ascendantRuler, lillyDomicileRuler(positions.get(ascendantRuler)), 'any') === true;
    emit(verifiedVacancy && moonPartners.length > 0, 'selected_by_moon', table);
    emit(verifiedVacancy && mercuryPartners.length > 0, 'selected_by_mercury', table);
    emit(dispositorAspects, 'selected_ascendant_ruler', table);
    emit(verifiedVacancy && moonPartners.some(planet => mercuryPartners.includes(planet)), 'same_candidate_conjoins_moon_and_mercury', table);
    const active = new Set(!verifiedVacancy ? firstCandidates : dispositorAspects ? [ascendantRuler] : [...moonPartners, ...mercuryPartners]);
    if (active.has('Mercury')) {
      emit(positions.size === lillyDignityBodies.length && mercuryPartners.length === 1, 'mercury_one_partner', table);
      emit(noMercuryPartner && lillyDomicileRuler(positions.get('Mercury')) !== 'Mercury', 'mercury_domicile_lord', table);
    }
    for (const planet of active) emit(true, 'sign.' + signs[signOf(positions.get(planet))], table);
    emit([...active].some(hasParticipatingDignity), 'participating_essential_dignity', table);
    for (const star of stars.values()) emit([...active].some(planet => contact(star, planet)), roleContact(star, 'significator'), table);
  }
  return output;
}
