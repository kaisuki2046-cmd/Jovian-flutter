import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
import { lillyHouseRuleset } from '../../control/lilly-houses.mjs';
import { lillyDignityBodies, lillyDignityProfile } from './lilly-dignities.mjs';
import { lillyProfessionBodies, lillyProfessionCondition, lillyProfessionPartileComparison, lillyProfessionProfile,
  lillyProfessionSelected, lillyProfessionSole, lillyProfessionStepFact, lillyProfessionTenthHouse } from './lilly-profession.mjs';
import { lillyProfessionAccountFact } from './lilly-profession-rising.mjs';
import { lillySolarProfile } from './lilly-solar-motion.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const lillyProfessionSourcesProfile = 'lilly-1647-profession-configurations-v1';
export const lillyProfessionSelectionProfile = 'lilly-1647-profession-selection-evidence-v1';
export const lillyProfessionWitnessProfile = 'lilly-1647-profession-modifiers-v1';
export const lillyProfessionDispositionProfile = 'lilly-1647-profession-dispositions-v1';
const prefix = 'astro-lilly-v3-profession-';
const tables = ['main', 'other'];
const configured = ['conjunction', 'any'];
const friendly = ['friendly'];
const rays = ['any'];
const hard = ['square', 'opposition'];
const bodilyOrHard = ['conjunction', ...hard];
const bodilyOrFriendly = ['conjunction', ...friendly];
const members = (...planets) => planets.map(planet => ({
  kind: 'western_lilly_profession_ruler', planet, role: 'member', matches: true, profile: lillyProfessionProfile,
}));
const aspect = (table, first, second, type) => ({ kind: 'western_lilly_aspect', table, first, second, aspect: type, matches: true });
const partile = (first, second, aspect) => ({ kind: 'western_lilly_partile_aspect', first: first.toLowerCase(), second: second.toLowerCase(), aspect });
const inSign = (planet, sign) => ({ kind: 'planet_sign', planet, sign });
const innerPairInSign = sign => [inSign('Mercury', sign), inSign('Venus', sign)];
const solarState = (selector, condition, matches = true) =>
  ({ kind: 'western_lilly_solar_state', selector, condition, matches, profile: lillySolarProfile });
const dignity = (planet, name, matches = true) => ({
  kind: 'western_lilly_dignity', planet, dignity: name, matches, profile: lillyDignityProfile,
});
const houseOf = (planet, house) => ({ kind: 'western_lilly_planet_house', planet, house });

export function consistentLillyProfessionSource(id, facts) {
  const requiredMotion = {
    'p015-001': 'direct', 'p041-001': 'direct', 'p042-001': 'direct', 'p064-001': 'retrograde',
  }[id.slice(prefix.length)];
  return !requiredMotion || !facts.some(fact =>
    fact.kind === 'planet_motion' && fact.planet === 'Mercury' && fact.motion !== requiredMotion);
}

function contact(planets, ...relationships) {
  return table => [{
    required: members(...planets),
    anyOf: contactGroups(table, relationships),
  }];
}

function contactGroups(table, relationships) {
  return relationships.reduce((groups, [from, to, aspects]) =>
    groups.flatMap(group => aspects.map(type => [...group, aspect(table, from, to, type)])), [[]]);
}

function mercurySunWith(...relationships) {
  return table => {
    const solarConditions = [
      [solarState('mercury', 'cazimi')],
      [solarState('mercury', 'combust', false),
        { kind: 'western_lilly_dignity', planet: 'Mercury', dignity: 'peregrine', matches: false, profile: lillyDignityProfile }],
    ];
    return [{
      required: [
        ...members('Mercury'), aspect(table, 'mercury', 'sun', 'conjunction'),
        { kind: 'planet_motion', planet: 'Mercury', motion: 'direct' },
      ],
      anyOf: solarConditions.flatMap(branch =>
        contactGroups(table, relationships).map(group => [...branch, ...group])),
    }];
  };
}

const marsWithMercuryAndSun = [['mars', 'mercury', configured], ['mars', 'sun', configured]];
const moonApplies = (...signs) => table => signs.map(sign => ({
  required: [
    ...members('Mercury'), inSign('Moon', sign),
    { kind: 'western_lilly_aspect_phase', table, first: 'moon', second: 'mercury', phase: 'applying_friendly_or_conjunction' },
  ],
}));

// Identifiers and digests pin the reviewed source, conditions, and evidence.
// The joint clauses keep every named relationship in one orb table.
const reviewed = new Map([
  ['012-001', ['2ed1ca101d3db286ce6c074744f0a93608a6d5060c991ea2e98771a1bd777288',
    contact(['Mercury', 'Mars'], ['jupiter', 'mercury', friendly], ['jupiter', 'mars', friendly])]],
  ['013-001', ['95b3e686df536260c273ee109ffbe973cf6bfe4da21198a4f02eeaa7a794a8a6',
    contact(['Mercury'], ['mercury', 'saturn', configured])]],
  ['015-001', ['3833370fa80e9e983535692846a11ea2905d02799de4f3aa5843d097d87d03b0', mercurySunWith()]],
  ['016-001', ['8c61301c2b850760a436113343207511d13a20bd823004262555baa796972e6e',
    contact(['Venus'], ['venus', 'saturn', configured])]],
  ['017-001', ['bba8535481d0dfe8cab818b6a8c50a5f5c6c0f6d43a8a8399ea9d79ebe0912c4',
    contact(['Venus'], ['venus', 'jupiter', configured])]],
  ['019-001', ['c120a0d70d443304339c96c8f97eb499b89ad1dc371cc56b1e4b30a2881e75a0',
    contact(['Mars'], ['mars', 'saturn', bodilyOrHard])]],
  ['021-001', ['73d86ccfdf68613417d6b6487bb117d176ec831bb5064d4f6f4e714e5d2f2d72',
    contact(['Mars'], ['mars', 'sun', bodilyOrFriendly])]],
  ['022-001', ['2fa2a729af70654aad82fbc0fc276f3d3f66776a5493b1af1ea0e37c9c6b0383',
    contact(['Mars'], ['mars', 'moon', configured], ['saturn', 'mars', configured], ['saturn', 'moon', configured])]],
  ['023-001', ['7176aec81045afc124135117344287e748eba02520bb725395487e150357a6ad',
    table => [{
      required: members('Mercury', 'Venus'),
      anyOf: ['mercury', 'venus'].map(planet => [aspect(table, 'saturn', planet, 'any')]),
    }]]],
  ['025-001', ['a71eba873656472245c94c6d2284ab4557ddc08621bde5eeb64c3d56f70c3f7b',
    contact(['Mars', 'Venus'], ['saturn', 'mars', configured], ['saturn', 'venus', configured])]],
  ['026-001', ['db09df719fbb713af56dbff41e2792720658154270c55c5e2cb1efa38b7a7380',
    contact(['Mars', 'Venus'], ['jupiter', 'mars', configured], ['jupiter', 'venus', configured])]],
  ['040-001', ['00615b0f1923485d42c1a46f760842bf214a2d032819505b24f037f192db8a6e',
    contact(['Mercury'], ['mercury', 'mars', configured])]],
  ['041-001', ['ec3b4c3e0ba9371c3679114a0e1b5caa342f30ecf16aa55669d91d8c19e98e20', mercurySunWith(...marsWithMercuryAndSun)]],
  ['042-001', ['8e242c38be57d7f04405cfc77b36df34e76465a7e7cd72de24e356ba221d609d', mercurySunWith(...marsWithMercuryAndSun,
    ['saturn', 'mercury', rays], ['saturn', 'sun', rays], ['saturn', 'mars', rays])]],
  ['044-001', ['1f71a53678240b25f612d76e9fb19c658b8c708d7845093351f3e270c21664d5',
    moonApplies('金牛座', '摩羯座', '巨蟹座')]],
  ['045-001', ['efd865ae8cdfd0b8c6bdc083c5df477a77af5fd7a8172652716103502af97a4a',
    moonApplies('处女座', '天蝎座')]],
  ['046-001', ['e51322e9ad8bc5253fd3e6508c5b16d94667102236e86573772a92a9d69ed35a',
    moonApplies('白羊座', '狮子座', '天秤座')]],
  ['047-001', ['a2620f1a86edc097cec25057e5294b6c8ed3791acfd3d6ed17a2038a9a21b8f4',
    moonApplies('射手座', '双鱼座')]],
  ['050-001', ['07844c18cd02bc266e3a25290f8bbaa184c6d75fc3cbcaad7df9d4e4e817d157', () => [{
    required: members('Venus'),
    anyOf: ['domicile', 'exaltation', 'triplicity', 'term', 'face'].map(reception => [{
      kind: 'western_lilly_reception', first: 'sun', second: 'venus',
      reception, matches: true, profile: lillyDignityProfile,
    }]),
  }]]],
  ['056-001', ['545fe2eca2a93331f7aa515e5a2b35672888212f8b276ea012c95133f0afb508',
    contact(['Mars'], ['mars', 'sun', hard])]],
  ['057-001', ['842fc32a7e68b5fd0ffd2b2f2b8e129356dd79e829444cb6901e3de2197a68cc',
    contact(['Mars'], ['mars', 'moon', configured])]],
  ['058-001', ['0821c9b445bebafcfc03ee51bb52721cdcaf7b7b02d22b23b83512265236c72b',
    () => ['金牛座', '天秤座'].map(sign => ({ required: [...members('Mercury', 'Venus'), ...innerPairInSign(sign)] }))]],
  ['064-001', ['7128b0613e87eff8522433b7194f688f5877fac979b7ea8a9620a3f28d5e9996',
    table => [{
      required: [
        ...members('Mercury', 'Venus'), aspect(table, 'mercury', 'venus', 'conjunction'),
        { kind: 'planet_motion', planet: 'Mercury', motion: 'retrograde' },
      ],
      anyOf: zodiacNames.map(innerPairInSign),
    }]]],
  ['065-001', ['7e7f49794a1933be2e138ae0f81c960160fda2941a1b4e40ff914389e0523ff3',
    contact(['Mercury', 'Venus'], ['mercury', 'venus', configured], ['mars', 'mercury', rays], ['mars', 'venus', rays])]],
  ['067-001', ['96f740bb5e2b453e5e2eb7fc76ec145324030bab1d1df122d07add2bfbe1e4f2',
    contact(['Mars', 'Mercury'], ['saturn', 'mars', configured], ['saturn', 'mercury', configured])]],
  ['068-001', ['03e74c0d52bf7740bd40ea0817d51cad0549db22f34a5d7d62e2a5a1b28663e2',
    contact(['Mercury', 'Mars'], ['jupiter', 'mercury', hard], ['jupiter', 'mars', hard])]],
  ['076-001', ['2775c930b5bb1ac396bac8cdb376fc40dedb9a0b87df58c80b060433f0c83259',
    contact(['Mars'], ['sun', 'mars', rays])]],
  ['078-001', ['2fc8dc69b132fd3ea7b43e9f9b24c9ae297fcad893d6f2e3f37f2bc376ddfd02',
    () => lillyProfessionBodies.map(planet => ({
      required: [
        { ...members(planet)[0], role: 'sole' },
        ...tables.flatMap(table => lillyProfessionBodies.filter(other => other !== planet).map(other =>
          ({ ...aspect(table, planet.toLowerCase(), other.toLowerCase(), 'any'), matches: false }))),
      ],
    })), 3]],
]);

const stepGroups = (step, ...states) => lillyProfessionBodies.flatMap(planet =>
  states.map(state => ({ required: [lillyProfessionStepFact(planet, step, state)] })));
const accountGroups = (...bases) => lillyProfessionBodies.flatMap(planet =>
  bases.map(basis => ({ required: [lillyProfessionAccountFact(planet, basis)] })));
const reviewedSelection = new Map([
  ['005-001', ['16b59bdfb4a9a88ac3f9c2535f8d7961e95d96a4a42f8aa7cd9857eaff0cbfb9',
    () => [3, 4, 5].flatMap(step => stepGroups(step, 'selected'))]],
  ['006-001', ['617b8876aba5a2686c2721d3f4aa8f30fd229f7ba846ea0dd211819a99a2d72c', () => [{
    required: [lillyProfessionTenthHouse],
    anyOf: Array.from({ length: 12 }, (_, index) => [{ kind: 'western_lilly_ruler_house', house: 10, placedIn: index + 1 }]),
  }]]],
  ['013-001', ['53181367dfe69d41f24b309e310ed814f1241f3e2790b284114f7755708e6e2f', () => lillyProfessionBodies.flatMap(planet =>
    [1, 7, 10].map(house => ({
      required: [lillyProfessionStepFact(planet, 1, 'qualifies'), { kind: 'western_lilly_planet_house', planet, house }],
    })))]],
  ['014-001', ['1ab03075fd37a05a030ce7d80330c7fc95e7a813434ec1ab312d449318c939ce', () => stepGroups(2, 'qualifies')]],
  ['015-001', ['db5c35217b830c3348426686bdf0a64f90fe2d507dda34a35f6a014877b03315', () => stepGroups(2, 'peregrine', 'fall')]],
  ['016-001', ['b0d1f4961c1c5f73efc4bdd9d78410d701fb59a7e1d00ee7ed2447023af5f3d8', () => stepGroups(3, 'candidate')]],
  ['017-001', ['d0c7140025c39e9b96569c4bdbe069c26fb5642559eb6944bfc93afd85d4f101', () => [{ required: [lillyProfessionPartileComparison] }]]],
  ['018-001', ['8baf90f047867f4390618b93ab48ec6335be1e10a2f8ea24cf1cfdc352c9da76', () => stepGroups(4, 'qualifies')]],
  ['019-001', ['054a4991dd537bcb6713a5eaedbe63eccd41d8c66ead08a167a947a34916c658', () => stepGroups(4, 'afflicted')]],
  ['020-001', ['79e62644baff8075934d92956d31aec83acdfbc7738c893245d55861842d8c7a', () => stepGroups(5, 'selected'), 1]],
  ['021-001', ['acd0e4d42f300892103ff31d2381d63c38c7afb47f62beb43117c6761692406e',
    () => accountGroups('both_lord', 'both_placed'), 1]],
  ['022-001', ['c401cb09935d0293acc09fe989868576dba5219812e05937f1059ef31ae72f6c',
    () => accountGroups('morning_only', 'midheaven_lord_only', 'midheaven_placed_only'), 1]],
]);

const modifier = (body, types, recipients = lillyProfessionBodies) => () => recipients.map(planet => ({
  required: [lillyProfessionSelected(planet)],
  anyOf: types.map(type => [partile(body, planet, type)]),
}));
const maleficWitness = (...bodies) => table => lillyProfessionBodies.filter(planet => !bodies.includes(planet)).map(planet => ({
  required: [lillyProfessionSelected(planet)],
  anyOf: contactGroups(table, bodies.map(body => [body.toLowerCase(), planet.toLowerCase(), bodilyOrHard])),
}));
const joinedSignificators = () => lillyProfessionBodies.flatMap((first, index) =>
  lillyProfessionBodies.slice(index + 1).map(second => ({
    required: [lillyProfessionSelected(first), lillyProfessionSelected(second), partile(first, second, 'conjunction')],
  })));
const reviewedWitnesses = new Map([
  ['001-001', ['5bf684d16f0194e2b8bac6bc09a058e35ee059a970e118cc7e9d4f8e342cdd98', () => [{
    required: [lillyProfessionSelected('Mercury'), partile('Mars', 'Mercury', 'trine')],
    anyOf: Array.from({ length: 12 }, (_, index) => [{ kind: 'western_lilly_planet_house', planet: 'Mars', house: index + 1 }]),
  }], 1]],
  ['033-001', ['6f49c12552df2104f5dc54dde2c2952def38ac59e8dcf514941a57131b826789', joinedSignificators, 1]],
  ['034-001', ['79cee6b37cfb5da4efa69c16e7c9fba6b5eedd9b086d5e2998acf06e7f33ec40', modifier('Jupiter', ['trine']), 1]],
  ['035-001', ['cf143690f7129bbdeb7c3311311153abf8e7182b238b6f50a925b3fbf9de0c8f', modifier('Saturn', bodilyOrHard), 1]],
  ['036-001', ['fbbdcfa155ec239db4ac23210d144cd8eb3f754765497e648cfe470b116d09ae', modifier('Sun', ['trine'], ['Mars']), 1]],
  ['037-001', ['47d01da013afa2ea766d732227cfcc49c390faf4580112d653e1fe253f4bb31a', modifier('Moon', ['trine']), 1]],
  ['072-001', ['1bffb16407694fae177b84c0451d56f1f4562ba875a5587a16117464e43da924', maleficWitness('Saturn')]],
  ['073-001', ['a93c88e39513fe2c7662f9d41d87b02cc170ef076a9d60e62fa53062b049a8ae', maleficWitness('Mars')]],
  ['074-001', ['3b8226f061645621d8bcf819573d03e5ca7ec2881a1233d65f8e56b505713c4c', maleficWitness('Saturn', 'Mars')]],
]);

const debilitations = planet => ['detriment', 'fall'].map(name => dignity(planet, name));
const venusSaturnAffected = types => table => [{
  required: [lillyProfessionSelected('Venus')],
  anyOf: types.flatMap(type => ['Venus', 'Saturn'].flatMap(planet =>
    [...debilitations(planet), solarState(planet.toLowerCase(), 'combust')].map(weakness =>
      [aspect(table, 'venus', 'saturn', type), weakness]))),
}];
const oppressedCadent = table => ['Mercury', 'Venus'].map(planet => ({
  required: [lillyProfessionSelected(planet)],
  anyOf: [3, 6, 9, 12].flatMap(house => debilitations(planet).flatMap(weakness =>
    contactGroups(table, ['saturn', 'mars'].map(body => [body, planet.toLowerCase(), bodilyOrHard]))
      .map(contacts => [houseOf(planet, house), weakness, ...contacts]))),
}));
const strongAngular = planet => lillyProfessionCondition(planet, 'strong_angular');
const noMajorDignity = planet => ['domicile', 'exaltation'].map(name => dignity(planet, name, false));
const bothDebilitated = (first, second) => debilitations(first).flatMap(a => debilitations(second).map(b => [a, b]));
const innerPair = ['Mercury', 'Venus'];
const mercuryVenusProfession = [
  innerPair.map(lillyProfessionSelected),
  ...innerPair.map(planet => [
    lillyProfessionSelected(planet), partile('Mercury', 'Venus', 'conjunction'),
  ]),
  ...innerPair.flatMap((morning, index) => ['midheaven_lord_only', 'midheaven_placed_only'].map(basis => [
    lillyProfessionAccountFact(morning, 'morning_only'),
    lillyProfessionAccountFact(innerPair[1 - index], basis),
  ])),
];
const withJupiterInHouse = (...houses) => table => houses.map(house => ({
  required: [
    ...['Jupiter', ...innerPair].map(planet => houseOf(planet, house)),
    ...innerPair.map(planet => aspect(table, 'jupiter', planet.toLowerCase(), 'conjunction')),
  ],
  anyOf: mercuryVenusProfession,
}));
const jupiterMoonWitnesses = table => {
  const relationships = ['jupiter', 'moon'].flatMap(body => innerPair.map(planet => [
    body, planet.toLowerCase(), bodilyOrFriendly,
  ]));
  const contacts = contactGroups(table, relationships);
  return [{ required: [], anyOf: mercuryVenusProfession.flatMap(group => contacts.map(pair => [...group, ...pair])) }];
};
const exactFriendlyComparison = () => lillyProfessionBodies.map(planet => {
  const witnesses = lillyDignityBodies.filter(body => body !== planet);
  return {
    required: [lillyProfessionSelected(planet)],
    anyOf: witnesses.flatMap(trine => witnesses.filter(body => body !== trine).map(sextile => [
      partile(trine, planet, 'trine'), partile(sextile, planet, 'sextile'),
    ])),
  };
});
const mercuryMarsMoon = ['Mercury', 'Mars', 'Moon'];
const debilitatedConjunction = table => [{
  required: [
    ...mercuryMarsMoon.flatMap(noMajorDignity),
    aspect(table, 'mars', 'mercury', 'conjunction'), aspect(table, 'mars', 'moon', 'conjunction'),
    aspect(table, 'mercury', 'moon', 'conjunction'),
  ],
  anyOf: ['Mercury', 'Mars'].flatMap(planet => mercuryMarsMoon.flatMap(body =>
    debilitations(body).map(weakness => [lillyProfessionSelected(planet), weakness]))),
}];
const marsVenusWeak = table => {
  const contacts = ['saturn', 'mars'].flatMap(body =>
    contactGroups(table, [['saturn', 'mars', bodilyOrHard], [body, 'venus', bodilyOrHard]]));
  return [{
    required: ['Mars', 'Venus'].map(lillyProfessionSelected),
    anyOf: bothDebilitated('Mars', 'Venus').flatMap(weakness => contacts.map(group => [...weakness, ...group])),
  }];
};
const reviewedDispositions = new Map([
  ['003-001', ['d20a4c6a6f3a651b4d1dbec456f82aea1e0db9a0a1beeade769e1a218f80c1b7',
    () => lillyProfessionBodies.map(planet => ({
      required: [lillyProfessionSelected(planet), strongAngular(planet), solarState(planet.toLowerCase(), 'oriental'),
        lillyProfessionCondition(planet, 'clear_partile_malefics')],
    })), 1]],
  ['018-001', ['a4da0311c7e4c5938943ab6f23b99e659c13c89a4ec1aea4aaa028853eebfff3',
    () => ['combust', 'cazimi'].map(state => ({
      required: [solarState('venus', state)],
      anyOf: [[lillyProfessionSelected('Venus')], ...[1, 7, 10].map(house => [houseOf('Venus', house), dignity('Venus', 'peregrine', false)])],
    })), 1]],
  ['020-001', ['7e91f34624afcbfe3dde8d7e44ac55ab0844ff74ee757dff502b366051c95601',
    table => [{ required: [lillyProfessionSelected('Mars'), strongAngular('Mars'), strongAngular('Jupiter'),
      aspect(table, 'mars', 'jupiter', 'friendly')] }], 1]],
  ['024-001', ['b5f6381fecf24b188a3883a142fcc129525c6116238f7570f24ed7da3f043bf6',
    () => [{ required: ['Mercury', 'Mars'].flatMap(planet => [lillyProfessionSelected(planet), strongAngular(planet)]) }], 1]],
  ['049-001', ['7723936af32a7dfcc87c77c29c9ddcf3232ebe64331a4a5a929d7cb7dd4a9947', venusSaturnAffected(configured), 1]],
  ['052-001', ['5825ecf7a02a9338fa367c1b968b327ca3cb99ca8ed522134adf9ad786eab018', () => [{
    required: [
      lillyProfessionSole('Mars'), strongAngular('Mars'), lillyProfessionCondition('Mars', 'clear_partile_malefics'),
      solarState('mars', 'free_of_beams'), { kind: 'planet_motion', planet: 'Mars', motion: 'direct' },
    ],
  }], 1]],
  ['053-001', ['47f908e493a50772cd762d2e920514ccc9f6e18e9482274ab5355d41acd48d15', () => [{
    required: [lillyProfessionSole('Mars'), ...noMajorDignity('Mars'), dignity('Mars', 'detriment', false), dignity('Mars', 'fall', false)],
    anyOf: ['triplicity', 'term', 'face'].map(name => [dignity('Mars', name)]),
  }], 1]],
  ['054-001', ['f212a48cb22372d5a3199cb4431a351fe49d88a81a8ca8ee54b09afc80e99b20', () => [{
    required: [lillyProfessionSole('Mars'), dignity('Mars', 'peregrine')],
    anyOf: debilitations('Mars').map(weakness => [weakness]),
  }], 1]],
  ['055-001', ['0d78da90b1edbb97384176e60174c9688e8bce53e1b3bc8a233f55d7ebb9448e',
    table => [{ required: [lillyProfessionSelected('Mars')], anyOf: hard.map(type => [aspect(table, 'mars', 'jupiter', type)]) }], 1]],
  ['059-001', ['927bc8fd992ef698eae291c3b5e132d96d08c0b2f26fa305ad32a026b40d9b4b', withJupiterInHouse(3, 5, 11), 1]],
  ['060-001', ['fd9f8955e5f1b46ee0779c24f60c533a378154847094c538e6779e82f95b17cd', withJupiterInHouse(9), 1]],
  ['061-001', ['94cd7f0f8db0712221e85c55c215d3bb0ecdbd8794afa648655f5e68e6a336a0', withJupiterInHouse(12), 1]],
  ['062-001', ['134784d4bc3d4ca98bfb549e6fcba93bf462c6e8d314272d3da3d0a3cde3a3e5', jupiterMoonWitnesses, 1]],
  ['063-001', ['7fb08ef7486b543cbbf48db958ab39d7ae24daa2024c6904905c30343f1b1e96',
    () => ['Mercury', 'Venus'].map(planet => ({
      required: [lillyProfessionSelected(planet), lillyProfessionCondition('Jupiter', 'with_north_node'), partile('Jupiter', planet, 'trine')],
    })), 1]],
  ['066-001', ['c5d3718cc3b3f341035660b25181e26d2e650d27e55ddb2490037f50b8982cf0', () => [{
    required: ['Mercury', 'Mars'].map(lillyProfessionSelected), anyOf: bothDebilitated('Mercury', 'Mars'),
  }], 1]],
  ['069-001', ['429bacfae27e9789d67a2a865aed0d1c94b24378952007958cc3b8919f5223a2', debilitatedConjunction, 1]],
  ['070-001', ['8dded10be62da561d87023b582e3fea7a6edd0115989ec773040224c11cf63b8', marsVenusWeak, 1]],
  ['071-001', ['547f064f80e9dccafbddec0bc07fdd1cb17f5ece9debaefca9e523450defb1d1', oppressedCadent, 1]],
  ['075-001', ['c8ff97bc1a6dd791efe18343904f7cfcb104a0da7b197f37491c16f0a86be0bb', exactFriendlyComparison, 1]],
  ['077-001', ['bc83971b2183e7ee67a2a38d34019c5980e81aab89b4ddb8ef035c7c894362f6', venusSaturnAffected(rays), 1]],
]);

export function compileLillyProfessionSource(claim) {
  if (typeof claim.id !== 'string' || !claim.id.startsWith(prefix)) return undefined;
  const suffix = claim.id.slice(prefix.length);
  const isSelection = suffix.startsWith('method-p');
  const witness = suffix.startsWith('p') ? reviewedWitnesses.get(suffix.slice(1)) : undefined;
  const disposition = suffix.startsWith('p') ? reviewedDispositions.get(suffix.slice(1)) : undefined;
  const spec = isSelection ? reviewedSelection.get(suffix.slice('method-p'.length)) :
    suffix.startsWith('p') ? disposition ?? witness ?? reviewed.get(suffix.slice(1)) : undefined;
  if (!spec) return undefined;
  const [expectedDigest, buildGroups, remainingAlternatives] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== expectedDigest) {
    return { reason: 'source_review_required', reviewNote: '莉莉职业篇条文的出处、证据或条件已变化，须重新复核。' };
  }
  const inputs = tables.flatMap(table => buildGroups(table).map(({ required, anyOf }) => normalizeRuleInput('western', {
    required: [{ kind: 'western_lilly_ruleset', ruleset: lillyHouseRuleset }, ...required], anyOf,
  })));
  return {
    compiler: isSelection ? lillyProfessionSelectionProfile : disposition ? lillyProfessionDispositionProfile
      : witness ? lillyProfessionWitnessProfile : lillyProfessionSourcesProfile,
    inputs: [...new Map(inputs.map(input => [JSON.stringify(input), input])).values()],
    ...(remainingAlternatives && { remainingAlternatives }),
  };
}
