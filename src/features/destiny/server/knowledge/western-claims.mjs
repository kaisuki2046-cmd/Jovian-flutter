import { zodiacNames } from '../../control/charts.ts';
import { normalizeRuleInput } from './matching.mjs';
import { lillyHouseRuleset } from '../../control/lilly-houses.mjs';
import { isLillyAspectSelector, lillyAspectNames, lillyAspectPhases, lillyHouseClasses } from './lilly-aspects.mjs';
import { compileLillyBookOneAspects } from './lilly-book-one-aspects.mjs';
import { compileLillyBookThreeRoles } from './lilly-book-three-roles.mjs';
import { lillyDignityProfile, lillyDignityNames } from './lilly-dignities.mjs';
import { isLillyReceptionSelector, lillyReceptionNames } from './lilly-receptions.mjs';
import { lillyProfessionProfile, lillyProfessionBodies } from './lilly-profession.mjs';
import { compileLillyProfessionSource } from './lilly-profession-sources.mjs';
import { compileLillyPrefermentSource } from './lilly-preferment.mjs';
import { compileLillyMannersSource, lillyMannersUsesOrbs } from './lilly-manners.mjs';
import { compileLillyTemperamentSource, lillyTemperamentUsesOrbs } from './lilly-temperament.mjs';
import { compileLillyMerchantCase } from './lilly-merchant-case.mjs';
import { compileLillyParentDerivedSource } from './lilly-parent-derived-role.mjs';
import { compileLillyFamilySource } from './lilly-family.mjs';
import { compileLillyWealthDuration } from './lilly-wealth-duration.mjs';
import { compileLillyFortuneWitness } from './lilly-fortune-witnesses.mjs';
import { compilePtolemyFortune } from './ptolemy-fortune.mjs';
import { compileCardanoFortune } from './cardano-fortune.mjs';
import { compilePtolemyBookOne } from './ptolemy-book-one.mjs';
import { compilePtolemyFixedStars } from './ptolemy-fixed-stars.mjs';
import { compilePtolemyTravel } from './ptolemy-travel.mjs';
import { compilePtolemySiblings } from './ptolemy-siblings.mjs';
import { lillySignClassProfile, lillySignClasses, lillySignSelectors } from './lilly-sign-classes.mjs';
import { lillySolarProfile, lillyMotionProfile, isLillySolarSelector, isLillyMotionSelector, lillySolarStates, lillyMotionStates } from './lilly-solar-motion.mjs';
import { lillySourceCompositeAlternatives, lillySourceGroupAlternatives, lillyCompositeSourceDisposition } from './lilly-source-composites.mjs';
import { lillyFortuneProfile } from './lilly-fortune.mjs';
import { cardanoDignityCondition, cardanoDignityProfile, cardanoDignitySourceMatches, isCardanoDignitySource } from './cardano-dignity.mjs';
import { isLillyTravelSource, lillyTravelCondition, lillyTravelProfile, lillyTravelSourceMatches } from './lilly-travel.mjs';
import { isLillySiblingsSource, lillySiblingsCondition, lillySiblingsProfile, lillySiblingsSourceMatches } from './lilly-siblings.mjs';
import { isLillyWealthSourcesSource, lillyWealthSourcesCondition, lillyWealthSourcesProfile, lillyWealthSourcesSourceMatches } from './lilly-wealth-sources.mjs';
import { isLillyChildrenSource, lillyChildrenAlternatives, lillyChildrenCondition, lillyChildrenProfile, lillyChildrenSourceMatches } from './lilly-children.mjs';
import { isLillyWitSource, lillyWitAlternatives, lillyWitCondition, lillyWitProfile, lillyWitSourceMatches } from './lilly-wit.mjs';
import { isLillyEnemiesSource, lillyEnemiesCondition, lillyEnemiesProfile, lillyEnemiesSourceMatches, lillyEnemyUsesOrbs } from './lilly-enemies.mjs';
import { isLillyFriendsSource, lillyFriendsAlternatives, lillyFriendsCondition, lillyFriendsGroupAlternatives,
  lillyFriendsProfile, lillyFriendsSourceMatches } from './lilly-friends.mjs';
import { isLillyNinthHouseSource, lillyNinthHouseCondition, lillyNinthHouseProfile, lillyNinthHouseReview, lillyNinthHouseSourceMatches,
  lillyNinthHouseUsesOrbs } from './lilly-ninth-house.mjs';
import { isPtolemyParentsSource, ptolemyParentsCondition, ptolemyParentsProfile, ptolemyParentsSourceMatches } from './ptolemy-parents.mjs';

const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const planets = 'Sun Moon Mercury Venus Mars Jupiter Saturn Uranus Neptune Pluto'.split(' ');
const fortuneSelectors = new Map([
  ['profiles.lilly.part_of_fortune.house', 'lot'],
  ['chart.points.fortune.house', 'lot'],
  ['profiles.lilly.wealth.fortune_ruler_house', 'ruler'],
]);

export function westernClaimConvention(claim) {
  if (isCardanoDignitySource(claim)) return cardanoDignityProfile;
  if (isPtolemyParentsSource(claim)) return ptolemyParentsProfile;
  if (isLillyTravelSource(claim)) return lillyTravelProfile;
  if (isLillySiblingsSource(claim)) return lillySiblingsProfile;
  if (isLillyWealthSourcesSource(claim)) return lillyWealthSourcesProfile;
  if (isLillyChildrenSource(claim)) return lillyChildrenProfile;
  if (isLillyWitSource(claim)) return lillyWitProfile;
  if (isLillyEnemiesSource(claim)) return lillyEnemiesProfile;
  if (isLillyFriendsSource(claim)) return lillyFriendsProfile;
  if (isLillyNinthHouseSource(claim)) return lillyNinthHouseProfile;
  return claim.source?.book === 'Christian Astrology' ? 'lilly' : 'geometric';
}
const phaseFact = fact => fact && ['western_lilly_aspect_phase', 'western_lilly_luminary_application'].includes(fact.kind);
export const usesLillyAspectTable = fact => ['western_lilly_aspect', 'western_lilly_travel',
  'western_lilly_preferment_witness', 'western_lilly_preferment_distribution', 'western_lilly_preferment_grade',
  'western_lilly_preferment_royal_contact', 'western_lilly_preferment_friendly_support',
  'western_lilly_preferment_no_light_support'].includes(fact?.kind) || phaseFact(fact)
  || (fact?.kind === 'western_lilly_friend_condition' && fact.condition === 'afflicted')
  || fact?.kind === 'western_lilly_enemies' && lillyEnemyUsesOrbs(fact.selector)
  || fact?.kind === 'western_lilly_ninth_house' && lillyNinthHouseUsesOrbs(fact.selector)
  || fact?.kind === 'western_lilly_manners' && lillyMannersUsesOrbs(fact.selector)
  || fact?.kind === 'western_lilly_temperament' && lillyTemperamentUsesOrbs(fact.selector);

export function westernClaimCondition({ fact, equals }, profile = 'whole_sign', convention = 'geometric', aspectTable = 'main') {
  if (convention === cardanoDignityProfile) return cardanoDignityCondition(fact, equals);
  if (convention === ptolemyParentsProfile && fact !== 'chart.sect') return ptolemyParentsCondition(fact, equals);
  if (convention === lillyTravelProfile) {
    const travel = lillyTravelCondition(fact, equals, aspectTable);
    if (travel) return travel;
    convention = 'lilly';
  }
  if (convention === lillySiblingsProfile) {
    const siblings = profile === 'regiomontanus' && lillySiblingsCondition(fact, equals);
    if (siblings) return siblings;
    convention = 'lilly';
  }
  if (convention === lillyWealthSourcesProfile) {
    const wealth = lillyWealthSourcesCondition(fact, equals);
    if (wealth) return wealth;
    convention = 'lilly';
  }
  if (convention === lillyChildrenProfile) {
    const children = profile === 'regiomontanus' && lillyChildrenCondition(fact, equals);
    if (children) return children;
    convention = 'lilly';
  }
  if (convention === lillyWitProfile) {
    const wit = lillyWitCondition(fact, equals, aspectTable);
    if (wit) return wit;
    convention = 'lilly';
  }
  if (convention === lillyEnemiesProfile) {
    const testimony = profile === 'regiomontanus' && lillyEnemiesCondition(fact, equals, aspectTable);
    if (testimony) return testimony;
    convention = 'lilly';
  }
  if (convention === lillyFriendsProfile) {
    const friend = profile === 'regiomontanus' && lillyFriendsCondition(fact, equals, aspectTable);
    if (friend) return friend;
    convention = 'lilly';
  }
  if (convention === lillyNinthHouseProfile) {
    const testimony = lillyNinthHouseCondition(fact, equals, aspectTable);
    if (testimony) return testimony;
    convention = 'lilly';
  }
  if (convention === 'lilly' && profile === 'regiomontanus') {
    if (fact === 'profiles.lilly.honour.ascendant_lord_house_class' && lillyHouseClasses.includes(equals)) {
      return { kind: 'western_lilly_ruler_house_class', house: 1, houseClass: equals };
    }
    const phase = /^profiles\.lilly\.aspect_phase\.([a-z0-9_]+)\.([a-z0-9_]+)\.([a-z_]+)$/u.exec(fact);
    if (phase && equals === true && [phase[1], phase[2]].every(isLillyAspectSelector) && lillyAspectPhases.includes(phase[3])) {
      return { kind: 'western_lilly_aspect_phase', table: aspectTable, first: phase[1], second: phase[2], phase: phase[3] };
    }
    const luminary = /^profiles\.lilly\.wealth\.durability\.(sun|moon)_applying_planet_house_class$/u.exec(fact);
    if (luminary && ['angular', 'cadent'].includes(equals)) {
      return { kind: 'western_lilly_luminary_application', table: aspectTable, luminary: luminary[1], houseClass: equals };
    }
  }
  if (convention === 'lilly' && profile === 'regiomontanus' && fact === 'profiles.lilly.wealth.durability.empty_second_shared_ruler' && equals === true) {
    return { kind: 'western_lilly_empty_second_shared_ruler' };
  }
  const fortune = fortuneSelectors.get(fact);
  if (convention === 'lilly' && profile === 'regiomontanus' && fortune && Number.isInteger(equals) && equals >= 1 && equals <= 12) {
    return { kind: 'western_lilly_fortune_house', selector: fortune, house: equals, profile: lillyFortuneProfile };
  }
  if (convention === 'lilly' && fact === 'profiles.lilly.general_fortune.essentially_dignified_planet_count'
    && Number.isInteger(equals) && equals >= 0 && equals <= 7) {
    return { kind: 'western_lilly_dignified_count', count: equals, profile: lillyDignityProfile };
  }
  const position = /^profiles\.lilly\.positions\.([a-z]+)\.([a-z_]+)$/u.exec(fact);
  const aliases = {
    'profiles.lilly.wit.mercury_combust': ['mercury', 'combust'],
    'profiles.lilly.wit.mercury_under_sun_beams': ['mercury', 'under_beams'],
    'profiles.lilly.honour.kingly_geniture.venus_cazimi': ['venus', 'cazimi'],
    'profiles.lilly.merchant_case.venus_cazimi': ['venus', 'cazimi'],
    'profiles.lilly.merchant_case.mercury_combust': ['mercury', 'combust'],
    'profiles.lilly.manners.luminary_modifiers.moon_combust': ['moon', 'combust'],
    'profiles.lilly.health.mercury_combust': ['mercury', 'combust'],
    'profiles.lilly.health.saturn_combust': ['saturn', 'combust'],
    'profiles.lilly.lifespan.ascendant_lord_combust': ['house_1_ruler', 'combust'],
    'profiles.lilly.children.testimonies.fifth_ruler_combust': ['house_5_ruler', 'combust'],
    'profiles.lilly.siblings.relationship.house_2_ruler_combust': ['house_2_ruler', 'combust'],
  }[fact];
  const [stateSelector, solarCondition] = aliases ?? (position ? [position[1], { under_sun_beams: 'under_beams' }[position[2]] ?? position[2]] : []);
  if (convention === 'lilly' && typeof equals === 'boolean' && isLillySolarSelector(stateSelector) && lillySolarStates.includes(solarCondition)
    && (!stateSelector.startsWith('house_') || profile === 'regiomontanus')) {
    return { kind: 'western_lilly_solar_state', selector: stateSelector, condition: solarCondition, matches: equals, profile: lillySolarProfile };
  }
  if (convention === 'lilly' && typeof equals === 'boolean' && position && isLillyMotionSelector(position[1]) && lillyMotionStates.includes(position[2])) {
    return { kind: 'western_lilly_speed_state', selector: position[1], condition: position[2], matches: equals, profile: lillyMotionProfile };
  }
  const signClass = /^profiles\.lilly\.sign_classes\.([a-z0-9_]+)\.([a-z_]+)$/u.exec(fact);
  const namedClass = {
    'profiles.lilly.friends.house_11_cusp_sign_mode': 'house_11_cusp',
    'profiles.lilly.marriage.concord.venus_sign_class': 'venus',
    'profiles.lilly.women_marriage.counts.seventh_cusp_sign_class': 'house_7_cusp',
    'profiles.lilly.women_marriage.counts.seventh_ruler_sign_class': 'house_7_ruler',
    'profiles.lilly.women_marriage.counts.sun_sign_class': 'sun',
    'profiles.lilly.women_marriage.counts.venus_sign_class': 'venus',
    'profiles.lilly.women_marriage.counts.venus_dispositor_sign_class': 'venus_dispositor',
  }[fact];
  const selectedDispositor = fact === 'profiles.lilly.women_marriage.counts.venus_dispositor_selected';
  const classSelector = signClass?.[1] ?? namedClass ?? (selectedDispositor ? 'venus_dispositor' : null);
  const classification = signClass?.[2] ?? (namedClass ? equals : selectedDispositor ? 'selected' : null);
  if (convention === 'lilly' && lillySignSelectors.includes(classSelector) && lillySignClasses.includes(classification)
    && (namedClass || typeof equals === 'boolean') && (!classSelector.startsWith('house_') || profile === 'regiomontanus')) {
    return { kind: 'western_lilly_sign_class', selector: classSelector, classification, matches: namedClass ? true : equals, profile: lillySignClassProfile };
  }
  const profession = /^profiles\.lilly\.profession_rulers\.(mercury|venus|mars)$/u.exec(fact);
  const professionPlanet = lillyProfessionBodies.find(planet => planet.toLowerCase() === (profession?.[1] ?? equals));
  if (convention === 'lilly' && professionPlanet && (profession && typeof equals === 'boolean' || fact === 'profiles.lilly.sole_profession_ruler')) {
    return { kind: 'western_lilly_profession_ruler', planet: professionPlanet, role: profession ? 'member' : 'sole',
      matches: profession ? equals : true, profile: lillyProfessionProfile };
  }
  const reception = /^profiles\.lilly\.receptions\.([a-z0-9_]+)\.([a-z0-9_]+)\.([a-z_]+)$/u.exec(fact);
  if (convention === 'lilly' && reception && [reception[1], reception[2]].every(isLillyReceptionSelector)
    && lillyReceptionNames.includes(reception[3]) && typeof equals === 'boolean'
    && (profile === 'regiomontanus' || ![reception[1], reception[2]].some(selector => selector.startsWith('house_')))) {
    return { kind: 'western_lilly_reception', first: reception[1], second: reception[2], reception: reception[3], matches: equals, profile: lillyDignityProfile };
  }
  const dignity = /^profiles\.lilly\.essential_dignities\.([a-z]+)\.([a-z]+)$/u.exec(fact);
  const dignityPlanet = dignity && planets.slice(0, 7).find(planet => planet.toLowerCase() === dignity[1]);
  if (convention === 'lilly' && dignityPlanet && lillyDignityNames.includes(dignity[2]) && typeof equals === 'boolean') {
    return { kind: 'western_lilly_dignity', planet: dignityPlanet, dignity: dignity[2], matches: equals, profile: lillyDignityProfile };
  }
  const contact = /^profiles\.lilly\.aspects\.([a-z0-9_]+)\.([a-z0-9_]+)\.([a-z_]+)$/u.exec(fact);
  if (convention === 'lilly' && contact && isLillyAspectSelector(contact[1]) && isLillyAspectSelector(contact[2])
    && lillyAspectNames.includes(contact[3]) && typeof equals === 'boolean'
    && (profile === 'regiomontanus' || ![contact[1], contact[2]].some(selector => selector.endsWith('_ruler')))) {
    return { kind: 'western_lilly_aspect', table: aspectTable, first: contact[1], second: contact[2], aspect: contact[3], matches: equals };
  }
  if (fact === 'chart.zodiac' && equals === 'tropical') return { kind: 'western_zodiac', zodiac: equals };
  if (fact === 'chart.house_system' && equals === 'whole_sign') return { kind: 'western_house_system', houseSystem: equals };
  if (fact === 'chart.house_system' && equals === 'regiomontanus') return convention === 'lilly'
    ? { kind: 'western_lilly_ruleset', ruleset: lillyHouseRuleset } : { kind: 'western_profile_system', profile: equals };
  if (fact === 'context.historical_marriage_branch' && ['male', 'female'].includes(equals)) return { kind: 'natal_gender', gender: equals === 'male' ? '男' : '女' };
  if (convention === 'lilly' && profile === 'regiomontanus') {
    const rulerHouse = /^profiles\.lilly\.ruler_houses\.house_(\d+)$/u.exec(fact);
    const house = Number(rulerHouse?.[1]);
    if (rulerHouse && house >= 1 && house <= 12 && Number.isInteger(equals) && equals >= 1 && equals <= 12) {
      return { kind: 'western_lilly_ruler_house', house, placedIn: equals };
    }
    const ruler = /^profiles\.lilly\.(?:rulers\.house_(\d+)|house_rulers\.house_(\d+)\.([a-z]+))$/u.exec(fact);
    const sourcePlanet = ruler?.[1] ? equals : equals === true ? ruler?.[3] : null;
    const planet = planets.slice(0, 7).find(planet => planet.toLowerCase() === sourcePlanet);
    const rulerOf = Number(ruler?.[1] ?? ruler?.[2]);
    if (planet && rulerOf >= 1 && rulerOf <= 12) return { kind: 'western_lilly_house_ruler', house: rulerOf, planet };
  }
  if (fact === 'chart.sect' && ['day', 'night'].includes(equals)) return { kind: 'western_sect', sect: equals };
  const rawAngle = /^chart\.angles\.(ascendant|asc|desc|mc)\.sign$/u.exec(fact)?.[1];
  const angle = rawAngle === 'asc' ? 'ascendant' : rawAngle === 'desc' ? 'descendant' : rawAngle;
  const sign = zodiacNames[signs.indexOf(equals)];
  const lunarNode = /^chart\.planets\.(north_node|south_node)\.(sign|house)$/u.exec(fact);
  if (convention === 'lilly' && profile === 'regiomontanus' && lunarNode) {
    const [, node, field] = lunarNode;
    if (field === 'sign' && sign) return { kind: 'western_lilly_node_sign', node, sign };
    if (field === 'house' && Number.isInteger(equals) && equals >= 1 && equals <= 12) return { kind: 'western_lilly_node_house', node, house: equals };
  }
  if (convention === 'lilly' && profile === 'regiomontanus' && fact === 'profiles.lilly.honour.confirmed_ascendant_ruler_sign' && sign) {
    return { kind: 'western_lilly_ascendant_ruler_sign', sign };
  }
  if (angle && sign) return { kind: 'angle_sign', angle, sign };
  const cusp = /^chart\.houses\.house_(\d+)\.cusp_sign$/u.exec(fact);
  if (cusp && sign && Number(cusp[1]) >= 1 && Number(cusp[1]) <= 12) return profile === 'regiomontanus'
    ? { kind: 'western_profile_house_sign', profile, house: Number(cusp[1]), sign }
    : { kind: 'house_sign', house: Number(cusp[1]), sign };
  const parts = /^chart\.planets\.([a-z]+)\.(sign|house|motion)$/u.exec(fact);
  const planet = parts && planets.find((value) => value.toLowerCase() === parts[1]);
  if (planet && parts[2] === 'sign' && sign) return { kind: 'planet_sign', planet, sign };
  if (planet && parts[2] === 'house' && Number.isInteger(equals) && equals >= 1 && equals <= 12) {
    return profile === 'regiomontanus' ? convention === 'lilly'
      ? { kind: 'western_lilly_planet_house', planet, house: equals }
      : { kind: 'western_profile_planet_house', profile, planet, house: equals }
      : { kind: 'planet_house', planet, house: equals };
  }
  if (planet && parts[2] === 'motion' && ['direct', 'retrograde', 'stationary'].includes(equals)) return { kind: 'planet_motion', planet, motion: equals };
  return null;
}

// Known source aggregates expand into ordinary AND/OR conditions, preserving
// the original include-group index. False ORs become an AND of false values;
// exclusions use the same expansion before the usual De Morgan compilation.
export function westernClaimConditionAlternatives(condition, convention = 'geometric', group = []) {
  const { fact, equals } = condition;
  if (convention === lillyChildrenProfile) return lillyChildrenAlternatives(condition, group) ?? [[condition]];
  if (convention === lillyWitProfile) return lillyWitAlternatives(condition) ?? [[condition]];
  if (convention === lillyFriendsProfile) return lillyFriendsAlternatives(condition) ?? [[condition]];
  if (convention !== 'lilly') return [[condition]];
  const sourceComposite = lillySourceCompositeAlternatives(condition, group);
  if (sourceComposite) return sourceComposite;
  const atom = (fact, equals = true) => ({ fact: 'profiles.lilly.' + fact, equals });
  const professionClass = /^profiles\.lilly\.profession_ruler_sign_classes\.([a-z_]+)$/u.exec(fact);
  const professionClassification = { movable: 'movable', human: 'human', quadrupedal: 'profession_quadrupedal',
    fire_element: 'fire', earth_element: 'earth', air_element: 'air', water_element: 'water' }[professionClass?.[1]];
  if (professionClassification && typeof equals === 'boolean') {
    const conjunctions = lillyProfessionBodies.map(body => [
      atom('profession_rulers.' + body.toLowerCase()), atom(`sign_classes.${body.toLowerCase()}.${professionClassification}`),
    ]);
    // Existential over actual selected members. Negating it must disprove
    // EACH member-and-class pair, rather than merely one candidate.
    return equals ? conjunctions : conjunctions.reduce((groups, pair) => groups.flatMap(first =>
      pair.map(fact => [...first, { ...fact, equals: false }])), [[]]);
  }
  const or = alternatives => typeof equals !== 'boolean' ? [[condition]] : equals
    ? alternatives.map(fact => [atom(fact)]) : [alternatives.map(fact => atom(fact, false))];
  const and = conditions => typeof equals !== 'boolean' ? [[condition]] : equals ? [conditions]
    : conditions.map(condition => [{ ...condition, equals: !condition.equals }]);
  if (fact === 'profiles.lilly.religion.saturn_has_own_dignity' && typeof equals === 'boolean') {
    return [[atom('essential_dignities.saturn.peregrine', !equals)]];
  }
  if (fact === 'profiles.lilly.marriage.venus_aphorisms.oriental_dignified') {
    return and([atom('positions.venus.oriental'), atom('essential_dignities.venus.peregrine', false)]);
  }
  if (fact === 'profiles.lilly.marriage.appearance.venus_saturn_in_saturn_terms') {
    // The original attachment of "in Saturn's terms" remains unresolved.
    // Both bodies in those terms is common positive evidence under the
    // competing readings, not a definition of the whole source predicate.
    // Its negation cannot be obtained by negating this sufficient condition.
    return equals === true ? [[atom('essential_dignities.saturn.term'), atom('receptions.saturn.venus.term')]] : [[condition]];
  }
  const travelDomicile = {
    'profiles.lilly.travel.moon_in_mercury_domicile': 'receptions.mercury.moon.domicile',
    'profiles.lilly.travel.mercury_in_moon_domicile': 'receptions.moon.mercury.domicile',
  }[fact];
  if (travelDomicile && typeof equals === 'boolean') return [[atom(travelDomicile, equals)]];
  if (fact === 'profiles.lilly.mines.house_4_ruler_mutually_received_by_light_or_its_dispositor') {
    return or(['sun', 'sun_dispositor', 'moon', 'moon_dispositor'].map(role => `receptions.house_4_ruler.${role}.mutual`));
  }
  if (fact === 'profiles.lilly.mines.house_4_ruler_mutual_reception_with'
    && ['sun', 'sun_dispositor', 'moon', 'moon_dispositor'].includes(equals)) {
    return [[atom(`receptions.house_4_ruler.${equals}.mutual`)]];
  }
  if (fact === 'profiles.lilly.siblings.relationship.house_1_and_3_rulers_in_mutual_reception' && typeof equals === 'boolean') {
    return [[atom('receptions.house_1_ruler.house_3_ruler.mutual', equals)]];
  }
  if (fact === 'profiles.lilly.travel.sun_to_moon_or_mercury.domicile') {
    return or(['receptions.moon.sun.domicile', 'receptions.mercury.sun.domicile']);
  }
  if (fact === 'profiles.lilly.travel.sun_to_moon_or_mercury.conjunction') {
    return or(['aspects.sun.moon.conjunction', 'aspects.sun.mercury.conjunction']);
  }
  const familyAspect = /^profiles\.lilly\.family\.house_4_and_ascendant_rulers\.(trine|sextile)$/u.exec(fact);
  if (familyAspect && typeof equals === 'boolean') return [[atom(`aspects.house_4_ruler.house_1_ruler.${familyAspect[1]}`, equals)]];
  return [[condition]];
}

export function westernClaimGroupAlternatives(group, convention = 'geometric') {
  const sourceGroups = convention === 'lilly' ? lillySourceGroupAlternatives(group)
    : convention === lillyFriendsProfile ? lillyFriendsGroupAlternatives(group) : null;
  if (sourceGroups) return sourceGroups;
  return group.reduce((groups, condition) => groups.flatMap(first =>
    westernClaimConditionAlternatives(condition, convention, group).map(second => [...new Set([...first, ...second])])), [[]]);
}

export function westernClaimGroup(group, fallback = 'whole_sign', convention = 'geometric', aspectTable = 'main') {
  const systems = [...new Set(group.filter(condition => condition.fact === 'chart.house_system').map(condition => condition.equals))];
  const profile = systems[0] ?? fallback;
  if (systems.length > 1 || !['whole_sign', 'regiomontanus'].includes(profile)) return null;
  return group.map(condition => westernClaimCondition(condition, profile, convention, aspectTable));
}

export function isWesternClaimMatch(match) {
  const groups = (value) => Array.isArray(value) && value.every((items) => Array.isArray(items) && items.length > 0
    && items.every((item) => typeof item?.fact === 'string' && item.fact.length && ['string', 'boolean', 'number'].includes(typeof item.equals)));
  return match?.version === 1 && ['ready', 'reference_only', 'review_required'].includes(match.status)
    && groups(match.include) && groups(match.exclude) && (match.reason === null || typeof match.reason === 'string');
}

export function compileWesternClaim(claim) {
  const merchant = compileLillyMerchantCase(claim);
  if (merchant) return merchant;
  const parentDerived = compileLillyParentDerivedSource(claim);
  if (parentDerived) return parentDerived;
  const family = compileLillyFamilySource(claim);
  if (family) return family;
  const wealthDuration = compileLillyWealthDuration(claim);
  if (wealthDuration) return wealthDuration;
  const fortuneWitness = compileLillyFortuneWitness(claim);
  if (fortuneWitness) return fortuneWitness;
  const lillyBookOne = compileLillyBookOneAspects(claim);
  if (lillyBookOne) return lillyBookOne;
  const lillyBookThree = compileLillyBookThreeRoles(claim);
  if (lillyBookThree) return lillyBookThree;
  const ptolemyFortune = compilePtolemyFortune(claim);
  if (ptolemyFortune) return ptolemyFortune;
  const cardanoFortune = compileCardanoFortune(claim);
  if (cardanoFortune) return cardanoFortune;
  const ptolemyBookOne = compilePtolemyBookOne(claim);
  if (ptolemyBookOne) return ptolemyBookOne;
  const ptolemyStars = compilePtolemyFixedStars(claim);
  if (ptolemyStars) return ptolemyStars;
  const ptolemyTravel = compilePtolemyTravel(claim);
  if (ptolemyTravel) return ptolemyTravel;
  const ptolemySiblings = compilePtolemySiblings(claim);
  if (ptolemySiblings) return ptolemySiblings;
  const manners = compileLillyMannersSource(claim);
  if (manners) return manners;
  const temperament = compileLillyTemperamentSource(claim);
  if (temperament) return temperament;
  const profession = compileLillyProfessionSource(claim);
  if (profession) return profession;
  const preferment = compileLillyPrefermentSource(claim);
  if (preferment) return preferment;
  if (isPtolemyParentsSource(claim) && !ptolemyParentsSourceMatches(claim)) {
    return { reason: 'source_review_required', reviewNote: '托勒密父母篇条文所据版本、条件或证据有变，须重新复核。' };
  }
  if (isCardanoDignitySource(claim) && !cardanoDignitySourceMatches(claim)) {
    return { reason: 'source_review_required', reviewNote: '卡尔达诺第四档条文所据原文、条件或出处已变，须重新复核。' };
  }
  if (isLillyTravelSource(claim) && !lillyTravelSourceMatches(claim)) {
    return { reason: 'source_review_required', reviewNote: '莉莉远行条文所据原文、条件或出处有变，须重新复核。' };
  }
  if (isLillySiblingsSource(claim) && !lillySiblingsSourceMatches(claim)) {
    return { reason: 'source_review_required', reviewNote: '莉莉手足篇条文所据原文、条件或出处有变，须重新复核。' };
  }
  if (isLillyWealthSourcesSource(claim) && !lillyWealthSourcesSourceMatches(claim)) {
    return { reason: 'source_review_required', reviewNote: '莉莉财富篇条文所据原文、条件或出处有变，须重新复核。' };
  }
  if (isLillyChildrenSource(claim) && !lillyChildrenSourceMatches(claim)) {
    return { reason: 'source_review_required', reviewNote: '莉莉第五宫篇条文所据原文、条件或出处有变，须重新复核。' };
  }
  if (isLillyWitSource(claim) && !lillyWitSourceMatches(claim)) {
    return { reason: 'source_review_required', reviewNote: '莉莉智识篇条文所据原文、条件或出处有变，须重新复核。' };
  }
  if (isLillyEnemiesSource(claim) && !lillyEnemiesSourceMatches(claim)) {
    return { reason: 'source_review_required', reviewNote: '莉莉对立关系篇条文所据原文、条件或出处有变，须重新复核。' };
  }
  if (isLillyFriendsSource(claim) && !lillyFriendsSourceMatches(claim)) {
    return { reason: 'source_review_required', reviewNote: '莉莉友伴篇条文所据原文、条件或出处有变，须重新复核。' };
  }
  if (isLillyNinthHouseSource(claim) && !lillyNinthHouseSourceMatches(claim)) {
    return { reason: 'source_review_required', reviewNote: '莉莉第九宫条文所据原文、条件或出处有变，须重新复核。' };
  }
  if (lillyCompositeSourceDisposition(claim) === false) return { reason: 'source_review_required', reviewNote: '本条组合所据原文、条件或出处已变化，须重新复核，不沿用旧展开。' };
  const { match, excluded } = claim.conditions;
  if (match.status === 'reference_only') return { reason: 'reference_only' };
  if (match.status === 'review_required') return { reason: 'source_review_required' };
  if (excluded.length) return { reason: 'unmapped_exclusions' };
  const convention = westernClaimConvention(claim);
  const excludedGroups = match.exclude.flatMap(group => westernClaimGroupAlternatives(group, convention));
  const groups = match.include.flatMap((group, sourceIndex) => {
    const alternatives = westernClaimGroupAlternatives(group, convention);
    const needsTable = [...alternatives.flat(), ...excludedGroups.flat()].some(condition =>
      usesLillyAspectTable(westernClaimCondition(condition, 'regiomontanus', convention)));
    return alternatives.flatMap(source => (needsTable ? ['main', 'other'] : ['main']).map(table => ({ source, sourceIndex, table,
      facts: westernClaimGroup(source, 'whole_sign', convention, table) })));
  });
  const supported = groups.filter(group => group.facts?.every(Boolean));
  if (!supported.length) return { reason: 'unsupported_calculation_profile' };
  const inputs = [];
  for (const { source, table, facts: required } of supported) {
    const profile = source.find(condition => condition.fact === 'chart.house_system')?.equals ?? 'whole_sign';
    const exclusions = excludedGroups.map(group => {
      if (group.some(condition => condition.fact === 'chart.house_system' && condition.equals !== profile)) return null;
      return westernClaimGroup(group, profile, convention, table);
    });
    if (exclusions.some(group => !group || group.some(fact => !fact))) return { reason: 'unmapped_exclusions' };
    // NOT (A AND B) is NOT A OR NOT B; all excluded groups must be disproved.
    const absentAlternatives = exclusions.reduce((groups, excludedGroup) =>
      groups.flatMap(first => excludedGroup.map(fact => [...first, fact])), [[]]);
    inputs.push(...absentAlternatives.map(mustBeAbsent => normalizeRuleInput('western', { required, mustBeAbsent })));
  }
  const covered = new Set(supported.filter(group => !match.include[group.sourceIndex]
    .some(condition => condition.fact === 'profiles.lilly.marriage.appearance.venus_saturn_in_saturn_terms')).map(group => group.sourceIndex));
  for (const group of groups) if (!group.facts?.every(Boolean)) covered.delete(group.sourceIndex);
  const reviewNote = convention === lillyNinthHouseProfile ? lillyNinthHouseReview(claim.id) : undefined;
  return {
    ...([cardanoDignityProfile, lillyTravelProfile, lillySiblingsProfile, lillyWealthSourcesProfile, lillyChildrenProfile, lillyWitProfile,
      lillyEnemiesProfile, lillyFriendsProfile, lillyNinthHouseProfile, ptolemyParentsProfile]
      .includes(convention) && { compiler: convention }),
    inputs: inputs.some(input => input.required.some(phaseFact))
      ? [...new Map(inputs.map(input => [JSON.stringify(input), input])).values()] : inputs,
    remainingAlternatives: match.include.length - covered.size + Number(Boolean(reviewNote)),
    ...(reviewNote && { reviewNote }),
  };
}
