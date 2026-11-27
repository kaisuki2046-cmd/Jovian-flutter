import { createHash } from 'node:crypto';
import { lillyDomicileRuler } from '../../control/lilly-houses.mjs';
import { lillyProfessionBodies } from './lilly-profession.mjs';
const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const classical = 'sun moon mercury venus mars jupiter saturn'.split(' ');
const houses = Array.from({ length: 12 }, (_, i) => i + 1);
const atom = (fact, equals) => ({ fact, equals });
const house = (body, placedIn) => atom(`chart.planets.${body}.house`, placedIn);
const motionPhase = (first, second, phase) => atom(`profiles.lilly.aspect_phase.${first}.${second}.${phase}`, true);
const signClass = (selector, classification) => atom(`profiles.lilly.sign_classes.${selector}.${classification}`, true);
const spouseCountSignClasses = new Map([
  ['moon_in_fruitful_sign', signClass('moon', 'fruitful')],
  ['seventh_cusp_fruitful', signClass('house_7_cusp', 'fruitful')],
  ['seventh_lord_fruitful_or_common', signClass('house_7_ruler', 'fruitful_or_common')],
]);
const luminaryApplications = {
  'profiles.lilly.wealth.luminaries_apply_to_angular_planets': 'angular',
  'profiles.lilly.wealth.luminaries_apply_to_cadent_planets': 'cadent',
};
const separatingRulers = {
  'profiles.lilly.friends.house_11_ruler_separates_from_ascendant_ruler': ['house_11_ruler', 'house_1_ruler', 'separating'],
  'profiles.lilly.friendship.tenth_lord_retrograde_and_separating_from_ascendant_lord': ['house_10_ruler', 'house_1_ruler', 'retrograde_separating'],
  'profiles.lilly.friendship.ascendant_lord_retrograde_and_separating_from_tenth_lord': ['house_1_ruler', 'house_10_ruler', 'retrograde_separating'],
};
const northNodeSign = sign => atom('chart.planets.north_node.sign', sign);
const northNodeFriendshipSigns = {
  'profiles.lilly.friends.testimonies.north_node_favourable_signs': 'gemini pisces cancer taurus libra leo'.split(' '),
  'profiles.lilly.friends.testimonies.north_node_mixed_signs': 'sagittarius scorpio capricorn aquarius aries virgo'.split(' '),
};
const regio = atom('chart.house_system', 'regiomontanus');
const wealthDurability = atom('context.lilly_wealth_method', 'cxvii_durability');
const peregrine = (body, matches) => atom(`profiles.lilly.essential_dignities.${body}.peregrine`, matches);
const lordFour = body => atom('profiles.lilly.rulers.house_4', body);
const fourthLordInTwelfth = atom('profiles.lilly.ruler_houses.house_4', 12);
const sharedWealthRulerConditions = [
  regio,
  wealthDurability,
  atom('profiles.lilly.wealth.durability.second_house_occupants_checked', true),
  atom('profiles.lilly.wealth.durability.second_house_contains_planets', false),
  atom('profiles.lilly.wealth.durability.active_candidate_rules_second_house', true),
  atom('profiles.lilly.wealth.durability.active_candidate_disposes_lot_of_fortune', true),
];

const sameGroup = (actual, expected) => actual.length === expected.length && expected.every(({ fact, equals }) =>
  actual.some(condition => condition.fact === fact && condition.equals === equals));

export function lillySourceGroupAlternatives(group) {
  if (sameGroup(group, sharedWealthRulerConditions)) {
    return [[regio, atom('profiles.lilly.wealth.durability.empty_second_shared_ruler', true)]];
  }
  if (sameGroup(group, [regio, wealthDurability, atom('profiles.lilly.wealth.durability.active_candidate_house', 2),
    atom('profiles.lilly.wealth.durability.active_candidate_essentially_dignified', true)])) {
    return classical.map(body => [regio, house(body, 2), peregrine(body, false)]);
  }
  for (const body of ['saturn', 'mars', 'sun']) {
    if (sameGroup(group, [regio, wealthDurability, house(body, 2)])) return [[regio, house(body, 2)]];
  }
  if (sameGroup(group, [regio, house('saturn', 3), atom('profiles.lilly.siblings.relationship.saturn_peregrine', true)])) {
    return [[regio, house('saturn', 3), peregrine('saturn', true)]];
  }
  if (sameGroup(group, [regio, house('sun', 12), atom('profiles.lilly.family.sun_peregrine', true)])) {
    return [[regio, house('sun', 12), peregrine('sun', true)]];
  }
  if (sameGroup(group, [regio, fourthLordInTwelfth, atom('profiles.lilly.family.house_4_ruler_peregrine', true)])) {
    return classical.map(body => [regio, lordFour(body), house(body, 12), peregrine(body, true)]);
  }
  if (sameGroup(group, [regio, house('saturn', 12), fourthLordInTwelfth,
    atom('profiles.lilly.family_estate.saturn_with_distinct_house_4_ruler', true),
    atom('profiles.lilly.family_estate.saturn_and_house_4_ruler_both_peregrine', true)])) {
    return classical.filter(body => body !== 'saturn').map(body => [
      regio, house('saturn', 12), peregrine('saturn', true), lordFour(body), house(body, 12), peregrine(body, true),
    ]);
  }
  return null;
}
// Keep each body's identity through the existential. Its negation must
// disprove every eligible body's membership; unknown is not a negative.
function anyInHouses(bodies, selected, matches) {
  if (matches) return bodies.flatMap(body => selected.map(placedIn => [house(body, placedIn)]));
  return bodies.reduce((groups, body) => groups.flatMap(first => houses.filter(h => !selected.includes(h)).map(h => [...first, house(body, h)])), [[]]);
}
export function lillySourceCompositeAlternatives({ fact, equals }, group = []) {
  if (equals === true && Object.hasOwn(luminaryApplications, fact)) {
    return [['sun', 'moon'].map(body => atom(`profiles.lilly.wealth.durability.${body}_applying_planet_house_class`, luminaryApplications[fact]))];
  }
  if (equals === true && Object.hasOwn(separatingRulers, fact)) return [[motionPhase(...separatingRulers[fact])]];
  if (fact === 'profiles.lilly.family.mercury_applies_to_malefic_in_fixed_sign' && equals === true) {
    return ['mars', 'saturn'].flatMap(body => ['taurus', 'leo', 'scorpio', 'aquarius'].map(sign => [
      motionPhase('mercury', body, 'applying'), atom(`chart.planets.${body}.sign`, sign),
    ]));
  }
  if (fact === 'profiles.lilly.honour.ascendant_lord_applies_to_planet_in_own_exaltation' && equals === true) {
    return classical.map(body => [motionPhase('house_1_ruler', body, 'applying'),
      atom(`profiles.lilly.essential_dignities.${body}.exaltation`, true)]);
  }
  const spouseCount = /^profiles\.lilly\.marriage\.spouse_count\.([a-z_]+)$/u.exec(fact)?.[1];
  if (spouseCount && equals === true) {
    const classification = {
      moon_applies_to_planet_in_common_sign: 'common',
      moon_applies_to_planet_in_fruitful_or_bicorporeal_sign: 'fruitful_or_common',
    }[spouseCount];
    if (classification) return classical.filter(body => body !== 'moon').map(body => [
      motionPhase('moon', body, 'applying'), signClass(body, classification),
    ]);
    if (spouseCountSignClasses.has(spouseCount)) return [[spouseCountSignClasses.get(spouseCount)]];
  }
  const bicorporeal = /^profiles\.lilly\.women_marriage\.counts\.(sun|mars)_bicorporeal$/u.exec(fact);
  if (bicorporeal && equals === true) return [[signClass(bicorporeal[1], 'common')]];
  if (fact === 'profiles.lilly.religion_dreams.north_node_house' && [3, 9].includes(equals)) {
    return [[house('north_node', equals)]];
  }
  if (equals === true && Object.hasOwn(northNodeFriendshipSigns, fact)) {
    // Direct occupants are confirmed; selection through an aspect to the
    // eleventh or its ruler remains an unsupported source alternative.
    return [...[1, 11].flatMap(placedIn => northNodeFriendshipSigns[fact].map(sign =>
      [house('north_node', placedIn), northNodeSign(sign)])), [atom(fact, equals)]];
  }
  if (fact === 'profiles.lilly.friendship.south_node_active_friendship_significator' && equals === true) {
    return [[house('south_node', 1)], [house('south_node', 11)], [atom(fact, equals)]];
  }
  const witnessFact = 'profiles.lilly.religion_dreams.active_religion_witness';
  const aspectWitness = 'profiles.lilly.religion_dreams.active_witness_';
  if (fact === witnessFact || fact.startsWith(aspectWitness)) {
    const witnesses = group.filter(condition => condition.fact === witnessFact);
    if (witnesses.length !== 1) return null;
    const witness = witnesses[0].equals;
    if (!['sun', 'moon', 'mercury', 'fortune'].includes(witness)) return null;
    const placement = witness === 'fortune' ? 'chart.points.fortune.house' : `chart.planets.${witness}.house`;
    const anchors = group.filter(condition => condition.fact === placement);
    if (anchors.length !== 1 || ![3, 9].includes(anchors[0].equals)) return null;
    // The role label identifies the same body already required by the house
    // condition. Each aspect must therefore also use that specific body.
    if (fact === witnessFact) return [[anchors[0]]];
    if (equals !== true || witness === 'fortune') return null;
    const contacts = {
      [aspectWitness + 'benefic_aspect']: { bodies: ['jupiter', 'venus'], type: 'friendly' },
      [aspectWitness + 'malefic_aspect']: { bodies: ['saturn', 'mars'], type: 'any' },
    }[fact];
    return contacts?.bodies.map(body => [witness === 'sun' && body === 'venus'
      // Keep the source alternative pending. The other table's sextile
      // starts at 49°, and the first table has no verified natal witness.
      ? atom(fact, equals) : atom(`profiles.lilly.aspects.${witness}.${body}.${contacts.type}`, true)]) ?? null;
  }
  if (fact === 'profiles.lilly.profession.active_significator_sign' && signs.includes(equals)) return lillyProfessionBodies.map(body => [
    atom('profiles.lilly.profession_rulers.' + body.toLowerCase(), true), atom('chart.planets.' + body.toLowerCase() + '.sign', equals)]);
  if (typeof equals !== 'boolean') return null;
  if (fact === 'profiles.lilly.honour.benefic_occupies_house_10' && equals) return anyInHouses(['jupiter', 'venus'], [10], true);
  if (fact === 'profiles.lilly.honour.ascendant_ruler_in_ascending_sign' && equals) return signs.map((sign, index) => {
    const ruler = lillyDomicileRuler(index * 30).toLowerCase();
    return [atom('chart.houses.house_1.cusp_sign', sign), atom('profiles.lilly.rulers.house_1', ruler),
      atom('profiles.lilly.honour.confirmed_ascendant_ruler_sign', sign)];
  });
  if (fact === 'profiles.lilly.wealth.fortune_ruler_aspected_by_ascendant_ruler') {
    return [[atom('profiles.lilly.aspects.house_1_ruler.fortune_ruler.any', equals)]];
  }
  if (fact === 'profiles.lilly.marriage_male.house_7_ruler_is_benefic') return (equals ? ['jupiter', 'venus'] : classical.filter(body => !['jupiter', 'venus'].includes(body)))
    .map(body => [atom('profiles.lilly.rulers.house_7', body)]);
  if (fact === 'profiles.lilly.marriage_male.benefic_occupies_house_7') return anyInHouses(['jupiter', 'venus'], [7], equals);
  if (fact === 'profiles.lilly.friends.testimonies.benefic_in_listed_friendship_house') return anyInHouses(['jupiter', 'venus'], [1, 5, 7, 9, 11], equals);
  if (fact === 'profiles.lilly.servants.benefic_in_sixth_or_twelfth') return anyInHouses(['jupiter', 'venus'], [6, 12], equals);
  if (fact === 'profiles.lilly.religion_dreams.malefic_in_9') return anyInHouses(['saturn', 'mars'], [9], equals);
  if (fact === 'profiles.lilly.children.testimonies.venus_asc_jupiter_seventh') return equals ? [[house('venus', 1), house('jupiter', 7)]]
    : [...houses.filter(h => h !== 1).map(h => [house('venus', h)]), ...houses.filter(h => h !== 7).map(h => [house('jupiter', h)])];
  return null;
}
const reviewed = new Map([
  ['astro-lilly-v3-spouse-description-p004-001', '173d562be5df6b2a3abc594d60b5fa4a872ef36688564fe2360a6e5beed21f1a'],
  ['astro-lilly-v3-spouse-description-p006-001', '2b0bffbad3773513561fc774dad41811ad6698f8983c0ebabad8d8e9207a84c9'],
  ['astro-lilly-v3-friends-p018-001', 'ef933551b86d8e2d2f6de78cb1c48e4629e6a6856a1988f0ba1d0cd46e7c961e'],
  ['astro-lilly-v3-health-servants-p006-001', 'a949b793a05b6bc66201527abc17b44373a3fbd0c059eb52501a1fbc4d034893'],
  ['astro-lilly-v3-children-p009-001', '90bdcc9843e75406356fe2e193428fc0618607cd3820cdaeb79cd740d0e7deb0'],
  ['astro-lilly-v3-religion-dreams-p011-001', '01845bbf7c84aa79680f025342d5d460e9b0ac2f77d619db30904c743227492f'],
  ['astro-lilly-v3-profession-p031-001', '06f63cdca96899b43e38659867358721ceb25bc65642891425e5999adc277b91'],
  ['astro-lilly-v3-profession-p032-001', '2bb3f99fac5ffe3e6cc07413c931950821bbad613c8643ef4554970da6a2f902'],
]);
const reviewedFortune = new Map([
  ['astro-lilly-v3-women-marriage-p005-001', '7438293f137985a425baac1c84ea981c31986e2d9eb845013066764affdc63a5'],
  ['astro-lilly-v3-spouse-origin-p002-001', '3af047c1fa5f3689b4bfc49e6c17cca78c63731b58bf22c699962bdc85263c63'],
  ['astro-lilly-v3-wealth-means-p005-001', 'c1865e62cb0e6b49116e37b6a4b3db4068b77bcdeae8c31b0a20e16ab71da27f'],
  ['astro-lilly-v3-religion-dreams-p019-001', 'd543164af63011ab4ecd2ad1805de1f3d4f9dd0be4247e8b11b8b08eb2aba286'],
  ['astro-lilly-v3-religion-dreams-p020-001', '3b44b9de8840b9ed97ce1e80f4a34e256baf9a99cdb84d2afb94358cdfff9ae9'],
  ['astro-lilly-v3-religion-dreams-p021-001', 'f65110f4637dd73e7b7ea0b4168ba7f9ae4b10d06f9d50f64b96728b1ce91e23'],
]);
const reviewedRulers = new Map([
  ['astro-lilly-v3-preferment-p004-001', 'dd1f803d4dfbebca7d983b80ba3cba965e4375d092a427277c26f79b135f6c92'],
  ['astro-lilly-v3-preferment-p034-001', '2926e026540b578211449cbf5aa0d919860bc7fef136f6ebde82056e4e649dee'],
  ['astro-lilly-v3-wealth-duration-p015-001', '1553b3fb94ffd91fa187ea234f4f573d717898cc5cb6326ec6905b683c86e5b8'],
]);
const reviewedHouseDignity = new Map([
  ['astro-lilly-v3-wealth-duration-p013-001', '252b002730c479595d48a1b7ea40c4186acaaff1fe060629537f3c2e16492ed7'],
  ['astro-lilly-v3-wealth-duration-p017-001', 'f86e89795237e5d65a7f01b3cb4bed3823a9941e240c83fd196ac33acba72ccf'],
  ['astro-lilly-v3-wealth-duration-p018-001', '06d600915d392c5ed0705ca0ae8ca0b81a692057f1540a829d52a38156dd657e'],
  ['astro-lilly-v3-wealth-duration-p019-001', '2bfd2aabe8c2bbf9ba88515a11ebefd274690b2a4a6a6d0e15f7211b380d47d9'],
  ['astro-lilly-v3-relatives-p006-001', '8379fac2b2f5adf4abbc515b6430fa347699a56c1033b59cd93df0fcb0514a83'],
  ['astro-lilly-v3-family-p019-001', '40184d8b24349f4fb75bc1a05ec7c73cea97735f49db78379f3e0bc50fa04dbd'],
  ['astro-lilly-v3-family-p007-001', '180ecf311f5bfaa9046b01a37d9ab3c4b5253b194a9f9ad675e367d8498a023f'],
]);
const reviewedNodes = new Map([
  ['astro-lilly-v3-relatives-p008-001', 'eef22efd1f2b0cab464ba3109a81b5acf6c30837d341f86a763a1511f5cda326'],
  ['astro-lilly-v3-relatives-p014-001', 'c3bb928371314fcaa200773a345b71eedd576ab5e82757de9ec371df0d22c512'],
  ['astro-lilly-v3-health-servants-p012-001', 'b5d9063467e7f96a2fa22754ed053fbd61455cd625272a365d717c9fd073da63'],
  ['astro-lilly-v3-friends-p012-001', '4c2ecab15ae909799f10b398937cb20961020bcebdc3f634813dec179933299f'],
  ['astro-lilly-v3-friends-p013-001', 'ea09e070a110ac349f135290f5958528b93a084df4796003470dd227d6228cc1'],
  ['astro-lilly-v3-friends-p040-001', '94b697d6cdeebff2d8e9e8f1638f4adf83621e0ebd17ff08853cf4720697a8ba'],
  ['astro-lilly-v3-religion-dreams-p004-001', '8bd8b005d68e8691f059535d45ddc2b74e2b9454aad4c697dc592df12ae34110'],
]);
const reviewedPhase = new Map([
  ['astro-lilly-v3-wealth-duration-p006-001', 'cdf5d22c71d618cd92ddbfd2dc9918a9140268218c748e9541e28cb44672c2c8'],
  ['astro-lilly-v3-wealth-duration-p007-001', '14d9542fd2ab66c0d559cf9c5c78ec836b06128ce6c501ed9d83868cf286cc90'],
  ['astro-lilly-v3-friends-p020-001', 'bd552445ebd18cc502b092b8a014ccc720f1dbc00c74d698f2eab3a33dd2780b'],
  ['astro-lilly-v3-friends-p043-001', '13fcf1500e1bf618db59f01b95bfa837ad90b3c34dc8fb6dd6b7192ce7bf4214'],
  ['astro-lilly-v3-friends-p044-001', 'ee9dd4211c74769816bfa6fc3ddcc3d31bf1c5827d57171c32176e2e8601a213'],
  ['astro-lilly-v3-health-servants-p009-001', 'cc47ee2776976dbff58d6bae0ce766959152e1f3fdc6fd0ab61e6c72b3af9a91'],
  ['astro-lilly-v3-preferment-p046-001', 'e7a804daa2e3399b1754b4a6c2159cb8daeb9daac803e566f0fbcf192c963167'],
  ['astro-lilly-v3-preferment-p047-001', '2c4117ab35aaa1717f0ec02269ed38d99ef08f23746efa2fdf460a8e8b627c9e'],
]);
const reviewedMarriageSigns = new Map([
  ['astro-lilly-v3-spouse-count-p012-001', 'd18c16aa2e9a73a0f98ad1c368e47b6a79d69ce940cb5fd9d9c051b9cd4f53c2'],
  ['astro-lilly-v3-spouse-count-p013-001', '207c8524f5c7df4a29a93187cad2536040eedcfc41b4e0f212171947bbf4d60d'],
  ['astro-lilly-v3-spouse-count-p014-001', '22504e98ea9693237a0885e626962b7d7d65438d442555ae6f352507e1aeee9f'],
  ['astro-lilly-v3-women-marriage-p017-001', '998db6ac9eac79fa5ee8b538c4d4af67b33812ffae6daef9a0b5c52ccc8133aa'],
]);
export function lillyCompositeSourceDisposition(claim) {
  const reviewedHash = reviewed.get(claim.id) ?? reviewedFortune.get(claim.id) ?? reviewedRulers.get(claim.id)
    ?? reviewedHouseDignity.get(claim.id) ?? reviewedNodes.get(claim.id) ?? reviewedPhase.get(claim.id) ?? reviewedMarriageSigns.get(claim.id);
  if (!reviewedHash) return undefined;
  const hash = createHash('sha256').update(JSON.stringify({ source: claim.source, conditions: claim.conditions, evidence: claim.evidence })).digest('hex');
  return hash === reviewedHash;
}
export const isReviewedLillyComposite = id => reviewed.has(id);
export const isReviewedLillyFortune = id => reviewedFortune.has(id);
export const isReviewedLillyHouseDignity = id => reviewedHouseDignity.has(id);
export const isReviewedLillyMarriageSigns = id => reviewedMarriageSigns.has(id);
