import { lillyDomicileRuler } from '../../control/lilly-houses.mjs';
import { lillyAspect, lillyAspectAngles, lillyOrbTables } from './lilly-aspects.mjs';
import { estateMalefics as malefics, lillyEstatePressureFacts } from './lilly-family-estate.mjs';

export const familyAssessmentNames = [
  'father_all_impeded', 'fourth_benefics_supported', 'fourth_dispositor_afflicted',
  'day_estate_unrestrained', 'night_estate_unrestrained',
  'mother_severely_afflicted', 'venus_approaching_combustion', 'venus_retrograde_separating',
  'moon_fortunate',
];
export const estateSupportPlaces = ['second_house', 'fourth_house', 'fourth_house_ruler'];
export const familyBenefics = ['Jupiter', 'Venus'];
export const familyConfiguration = selector => ({ kind: 'western_lilly_family_configuration', selector });
export const familyAssessment = (selector, table) => ({ kind: 'western_lilly_family_assessment', selector, table });
export const fourthPriority = planet => ({ kind: 'western_lilly_family_fourth_priority', planet });
export const estateSupport = (planet, place, sect, table) => ({ kind: 'western_lilly_family_estate_support', planet, place, sect, table });
export const strongerParent = (parent, table) => ({ kind: 'western_lilly_family_stronger_parent', parent, table });

const hard = ['conjunction', 'square', 'opposition'];
const supportive = ['conjunction', 'friendly'];
const honors = ['domicile', 'exaltation', 'triplicity', 'term', 'face'];
const weaknesses = ['detriment', 'fall'];
const cadent = [3, 6, 9, 12];
const combustionDistance = 8.5;

function hasUniqueDignityLeader(planet, others, dignity) {
  const compared = [...honors, ...weaknesses];
  const state = body => compared.map(name => {
    const matches = dignity(body, name);
    return matches === undefined ? null : Number(matches) * (weaknesses.includes(name) ? -1 : 1);
  });
  const leader = state(planet);
  if (leader.includes(null)) return false;
  return others.every(body => {
    const candidate = state(body);
    return !candidate.includes(null) && leader.every((rank, index) => rank >= candidate[index])
      && leader.some((rank, index) => rank > candidate[index]);
  });
}

function solarMotion(facts, known, planet) {
  if (!known.has(planet)) return null;
  const speeds = new Set(facts.filter(fact => fact.kind === 'planet_hourly_motion' && fact.planet === planet).map(fact => fact.signedDegrees));
  const directions = new Set(facts.filter(fact => fact.kind === 'planet_motion' && fact.planet === planet).map(fact => fact.motion));
  const [speed] = speeds;
  const direction = speed < 0 ? 'retrograde' : 'direct';
  if (speeds.size !== 1 || !Number.isFinite(speed) || Math.abs(speed) < 1e-7 || Math.abs(speed) > 1
    || directions.size && (directions.size !== 1 || !directions.has(direction))) return null;
  return { ...known.get(planet), speed };
}

function venusSolarPhase(facts, known) {
  const sun = solarMotion(facts, known, 'Sun');
  const venus = solarMotion(facts, known, 'Venus');
  if (!sun || !venus || sun.speed <= 0 || sun.sign !== venus.sign) return {};
  const difference = venus.longitude - sun.longitude;
  const relative = venus.speed - sun.speed;
  const distance = Math.abs(difference);
  const approaching = difference * relative < 0;
  const hoursToCombustion = (distance - combustionDistance) / Math.abs(relative);
  return {
    approachingCombustion: approaching && hoursToCombustion >= 0 && hoursToCombustion <= 24
      && [sun, venus].every(({ longitude, speed, sign }) => Math.floor((longitude + speed * hoursToCombustion) / 30) === sign),
    retrogradeSeparating: venus.speed < 0 && difference * relative > 0 && distance >= 0.1,
  };
}

export function lillyFamilyAssessments(facts, known, placements, rulers, sect, cohorts, dignities, complete, cusps) {
  const dignity = (planet, name) => dignities.find(fact => fact.planet === planet && fact.dignity === name)?.matches;
  const holds = (planet, names) => names.some(name => dignity(planet, name) === true);
  const cadency = planet => cadent.includes(placements.get(planet));
  const firm = planet => placements.has(planet) && !cadency(planet) && holds(planet, honors.slice(0, 2));
  const weak = planet => holds(planet, weaknesses) || (cadency(planet) && dignity(planet, 'peregrine') === true);
  const occupants = [...placements].filter(([, house]) => house === 4).map(([planet]) => planet);
  const father = cohorts.get('father');
  const mother = cohorts.get('mother');
  const fatherOnly = [...father.members].filter(planet => !mother.members.has(planet));
  const motherOnly = [...mother.members].filter(planet => !father.members.has(planet));
  const venusPhase = sect === 'day' ? venusSolarPhase(facts, known) : {};
  const evidence = lillyEstatePressureFacts(known, placements, rulers, cusps, sect, weak);
  const mixed = complete && [...father.members].some(firm) && [...father.members].some(weak);
  if (mixed) {
    evidence.push(familyConfiguration('father_mixed'));
    if (occupants.length >= 2) {
      const leader = occupants.find(planet => hasUniqueDignityLeader(planet, occupants.filter(body => body !== planet), dignity));
      if (leader) evidence.push(fourthPriority(leader));
    }
  }
  const baseRoles = [...cohorts.values()].flatMap(({ lord, light }) => [lord, light]);
  if (complete && baseRoles.every(cadency) && occupants.some(planet => malefics.includes(planet) && weak(planet))) {
    evidence.push(familyConfiguration('fourth_cadent_pressure'));
  }
  const fifth = rulers.get(5);
  if (!malefics.includes(fifth) && placements.get(fifth) === 4 && holds(fifth, weaknesses)
    && malefics.every(planet => placements.get(planet) === 4)) {
    evidence.push(familyConfiguration('estate_fifth_unfortunate'));
  }

  const beneficOccupants = familyBenefics.filter(planet => placements.get(planet) === 4);
  const dispositor = planet => lillyDomicileRuler(known.get(planet).longitude);
  const checked = new Set(beneficOccupants.flatMap(planet => [planet, dispositor(planet)]));
  for (const table of Object.keys(lillyOrbTables)) {
    const aspect = (first, second, type) => lillyAspect(known.get(first)?.longitude, known.get(second)?.longitude,
      first.toLowerCase(), second.toLowerCase(), type, table);
    const maleficContact = (body, planet) => body !== planet && hard.some(type => aspect(body, planet, type) === true);
    const afflicts = planet => malefics.some(body => maleficContact(body, planet));
    const clear = planet => malefics.every(body => body === planet || hard.every(type => aspect(body, planet, type) === false));
    const strengthened = planet => firm(planet) && clear(planet);
    const hindered = planet => weak(planet) && afflicts(planet);
    if (strengthened('Moon')) evidence.push(familyAssessment('moon_fortunate', table));
    if (complete && [...father.members].every(planet => weak(planet) && afflicts(planet))) {
      evidence.push(familyAssessment('father_all_impeded', table));
    }
    if (complete && [...mother.members].every(hindered) && weak('Moon')
      && malefics.every(body => maleficContact(body, 'Moon'))) {
      evidence.push(familyAssessment('mother_severely_afflicted', table));
    }
    if (complete && fatherOnly.length && motherOnly.length) {
      if (fatherOnly.every(strengthened) && motherOnly.every(hindered)) evidence.push(strongerParent('father', table));
      if (motherOnly.every(strengthened) && fatherOnly.every(hindered)) evidence.push(strongerParent('mother', table));
    }
    if (venusPhase.approachingCombustion && strengthened('Venus')) {
      evidence.push(familyAssessment('venus_approaching_combustion', table));
    }
    if (venusPhase.retrogradeSeparating && placements.has('Venus') && dignity('Venus', 'peregrine') === true
      && weak('Venus') && aspect('Sun', 'Venus', 'conjunction') === true) {
      evidence.push(familyAssessment('venus_retrograde_separating', table));
    }
    if (familyBenefics.every(planet => placements.has(planet)) && checked.size
      && [...checked].every(planet => placements.has(planet) && !cadency(planet) && holds(planet, honors)
        && malefics.every(body => body === planet || Object.keys(lillyAspectAngles).every(type => aspect(body, planet, type) === false)))) {
      evidence.push(familyAssessment('fourth_benefics_supported', table));
    }
    if (beneficOccupants.some(planet => afflicts(dispositor(planet)))) {
      evidence.push(familyAssessment('fourth_dispositor_afflicted', table));
    }
    if (!sect) continue;
    const luminary = sect === 'day' ? 'Sun' : 'Saturn';
    const estateLights = sect === 'day' ? ['Sun'] : ['Saturn', 'Moon'];
    const estateContacts = estateLights.map(light => familyBenefics.filter(planet =>
      supportive.some(type => aspect(planet, light, type) === true)));
    const participating = estateContacts.every(planets => planets.length) ? new Set(estateContacts.flat()) : [];
    for (const planet of participating) {
      const house = placements.get(planet);
      if (house === 2) evidence.push(estateSupport(planet, 'second_house', sect, table));
      if (house === 4) evidence.push(estateSupport(planet, 'fourth_house', sect, table));
      if (rulers.get(4) === planet) evidence.push(estateSupport(planet, 'fourth_house_ruler', sect, table));
    }
    if (hard.some(type => aspect('Mars', luminary, type) === true)
      && familyBenefics.every(planet => ['Mars', luminary].every(target =>
        supportive.every(type => aspect(planet, target, type) === false)))) {
      evidence.push(familyAssessment(sect === 'day' ? 'day_estate_unrestrained' : 'night_estate_unrestrained', table));
    }
  }
  return evidence;
}
