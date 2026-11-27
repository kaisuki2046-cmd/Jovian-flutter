import { lillyDomicileRuler } from '../../control/lilly-houses.mjs';
import { lillyAspectAngles } from './lilly-aspects.mjs';
import { classicalExaltationSigns, ptolemyDignitySign, ptolemyEssentialClaims } from './ptolemy-fortune.mjs';
import { easternOrCulminatingLongitude } from './ptolemy-fortune-angles.mjs';

const planets = Object.keys(classicalExaltationSigns);
const benefics = ['Jupiter', 'Venus'];
const malefics = ['Saturn', 'Mars'];
const signClasses = {
  watery: [3, 7, 11],
  solid: [1, 4, 7, 10],
  solstitial_or_equinoxial: [0, 3, 6, 9],
  human_form: [2, 5, 6, 10],
  terrestrial: [0, 1, 4, 7, 8, 9],
};
const essential = ['domicile', 'exaltation', 'triplicity', 'term'];
const travelBodies = ['Sun', 'Moon', 'Mars', 'fortune'];
const referenceAxes = { ascendant: 'western_geometry_ascendant', mc: 'western_geometry_midheaven' };
const basisFact = (planet, body, basis) => ({ kind: 'western_ptolemy_travel_governance', planet, body, basis });
const comparisonFact = (planet, body, claims, own, houseRank) =>
  ({ kind: 'western_ptolemy_travel_comparison', planet, body, claims, own, houseRank });
const aspectFact = (first, second, aspect) => ({ kind: 'western_ptolemy_travel_aspect', first, second, aspect });
const longitudeFact = ({ body, longitude }) => ({ kind: 'planet_longitude', planet: body, longitude });
const houseFact = ({ body, house }) => ({ kind: 'western_profile_planet_house', profile: 'regiomontanus', planet: body, house });
const houseRank = house => [1, 10].includes(house) ? 4 : [4, 7].includes(house) ? 3 : [2, 5, 8, 11].includes(house) ? 2 : 1;
const arc = value => ((value + 180) % 360 + 360) % 360 - 180;

export function isPtolemyTravelGovernanceFact(fact) {
  if (!planets.includes(fact.planet)) return false;
  if (fact.kind === 'western_ptolemy_travel_governance') return [...essential, 'aspect'].includes(fact.basis)
    && ([...planets, 'fortune'].includes(fact.body) || Object.hasOwn(referenceAxes, fact.body));
  if (fact.kind === 'western_ptolemy_travel_domain') return travelBodies.includes(fact.body) && ['action', 'body', 'dignity'].includes(fact.domain);
  if (fact.kind === 'western_ptolemy_travel_priority') {
    if (!travelBodies.includes(fact.body) || typeof fact.selected !== 'boolean') return false;
    return fact.method === 'aspect_precision' ? Number.isFinite(fact.value) && fact.value >= 0 && fact.value <= 3
      : fact.method === 'essential_dignity' && Number.isInteger(fact.value) && fact.value >= 0 && fact.value <= 4;
  }
  if (![...planets, 'fortune'].includes(fact.body)) return false;
  if (fact.kind === 'western_ptolemy_travel_dominance') return [...benefics, ...malefics].includes(fact.planet);
  return fact.kind === 'western_ptolemy_travel_comparison'
    && [fact.claims, fact.own, fact.houseRank].every(Number.isInteger)
    && fact.claims >= 1 && fact.claims <= 5 && fact.own >= 0 && fact.own <= 4 && fact.houseRank >= 1 && fact.houseRank <= 4;
}

function contact(first, second, aspectBetween) {
  const separation = Math.abs(first.longitude - second.longitude);
  if (first.sign === second.sign && Math.min(separation, 360 - separation) <= 3) return 'conjunction';
  return aspectBetween(first, second);
}

function mercuryProof(positions, pair, aspectBetween) {
  const mercury = positions.get('Mercury');
  const contacts = pair.map(planet => contact(mercury, positions.get(planet), aspectBetween));
  if (!contacts.every(Boolean) || !contacts.includes('conjunction')) return [];
  return [longitudeFact(mercury), ...pair.map((planet, index) => aspectFact('Mercury', planet, contacts[index]))];
}

function pairGovernsLights(lights, pair) {
  return lights.every(({ rulers }) => rulers.length === 1) && pair.every(planet =>
    lights.some(({ rulers }) => rulers[0].planet === planet));
}

const pointLongitudeProof = point => Object.hasOwn(referenceAxes, point.body) ? { kind: referenceAxes[point.body], longitude: point.longitude }
  : point.body === 'fortune' ? { kind: 'western_ptolemy_fortune_point', longitude: point.longitude } : longitudeFact(point);

function governanceProof({ point, rulers }, selected = rulers) {
  return [pointLongitudeProof(point), ...selected.flatMap(({ planet, candidate, bases, aspect }) => [
    longitudeFact(candidate), ...bases.map(basis => basisFact(planet, point.body, basis)),
    ...(aspect ? [aspectFact(planet, point.body, aspect)] : []),
  ])];
}

function assessWitnesses(assessment, record) {
  const { point, proof, ranking } = assessment;
  const witnesses = ranking.filter(({ planet, aspect }) => aspect && [...benefics, ...malefics].includes(planet));
  if (!witnesses.some(({ planet }) => benefics.includes(planet)) || !witnesses.some(({ planet }) => malefics.includes(planet))
    || witnesses.some(({ candidate }) => !candidate.house)) return;
  // Only the unambiguous branch is compiled: one witness has more claims at
  // this place, and no rival is better in familiarities or mundane placement.
  const winner = witnesses.find(candidate => witnesses.every(rival => rival === candidate
    || (candidate.bases.length > rival.bases.length && candidate.own.length >= rival.own.length
      && houseRank(candidate.candidate.house) >= houseRank(rival.candidate.house))));
  if (!winner) return;
  const evidence = [...proof, { kind: 'western_ptolemy_travel_dominance', planet: winner.planet, body: point.body },
    ...governanceProof(assessment, witnesses), ...witnesses.flatMap(row => [
      houseFact(row.candidate), ...row.own.map(basis => basisFact(row.planet, row.planet, basis)),
      comparisonFact(row.planet, point.body, row.bases.length, row.own.length, houseRank(row.candidate.house)),
    ])];
  record('robbins_mixed_dominance', ...evidence);
  record(benefics.includes(winner.planet) ? 'robbins_benefic_dominance' : 'robbins_malefic_dominance', ...evidence);
}

export function travelDignityAssessment(facts, positions, dignitiesAt, aspectBetween) {
  const sects = new Set(facts.filter(fact => fact.kind === 'western_sect').map(fact => fact.sect));
  const [sect] = sects;
  if (!dignitiesAt || sects.size !== 1 || !['day', 'night'].includes(sect)
    || !planets.every(planet => Number.isFinite(positions.get(planet)?.longitude))) return null;
  const lowerPlanets = planets.map(planet => planet.toLowerCase());
  const table = new Map();
  const at = point => {
    const degree = Math.floor(point.longitude % 30), key = point.sign * 30 + degree;
    if (!table.has(key)) {
      const cells = dignitiesAt(ptolemyDignitySign(point.sign), degree, sect);
      const valid = lowerPlanets.includes(cells?.term) && cells.triplicity?.length
        && cells.triplicity.every(planet => lowerPlanets.includes(planet));
      table.set(key, valid ? cells : null);
    }
    return table.get(key);
  };
  if ([...positions.values()].some(point => !at(point))) return null;
  const own = new Map([...positions.values()].map(point => [point.body, ptolemyEssentialClaims(point.body, point, at(point))]));
  function assess(point, proof = []) {
    const cells = at(point);
    if (!cells) return null;
    const ranking = [...positions].map(([planet, candidate]) => {
      const aspect = planet === point.body ? undefined : aspectBetween(candidate, point);
      const bases = ptolemyEssentialClaims(planet, point, cells);
      if (aspect) bases.push('aspect');
      return { planet, candidate, bases, aspect, own: own.get(planet) };
    });
    const maximum = Math.max(...ranking.map(({ bases }) => bases.length));
    return { point, proof, ranking, rulers: ranking.filter(({ bases }) => bases.length === maximum) };
  }
  return { assess, own, sectProof: { kind: 'western_sect', sect } };
}

function recordDomainGovernance(facts, lights, active, assess, record) {
  const chartAxis = body => {
    const longitude = easternOrCulminatingLongitude(facts, body);
    return Number.isFinite(longitude) ? assess({ body, longitude, sign: Math.floor(longitude / 30) }) : null;
  };
  const domains = [
    ['action', [chartAxis('mc')]],
    ['body', [chartAxis('ascendant'), lights.find(({ point }) => point.body === 'Moon')]],
    ['dignity', [lights.find(({ point }) => point.body === 'Sun')]],
  ];
  for (const [domain, landmarks] of domains) {
    if (!landmarks.every(landmark => landmark?.rulers.length === 1)) continue;
    const planet = landmarks[0].rulers[0].planet;
    if (!landmarks.every(landmark => landmark.rulers[0].planet === planet)) continue;
    for (const place of active) {
      if (place.rulers.length !== 1 || place.rulers[0].planet !== planet
        || landmarks.some(({ point }) => point.body === place.point.body)) continue;
      record('robbins_' + domain + '_connection', ...place.proof, ...governanceProof(place), ...landmarks.flatMap(row => governanceProof(row)),
        { kind: 'western_ptolemy_travel_domain', planet, body: place.point.body, domain });
    }
  }
}

export function travelGovernance(facts, positions, places, assessment, aspectBetween, record) {
  const { assess, own, sectProof } = assessment;
  const lights = ['Sun', 'Moon'].map(body => assess(positions.get(body)));
  const active = places.map(({ position, proof }) => assess(position, proof));
  if (active.some(row => !row)) return;
  const historicalRecord = (witness, ...proof) => record(witness, sectProof, ...proof);
  const lightProof = lights.flatMap(row => governanceProof(row));
  if (pairGovernsLights(lights, benefics)) {
    const ruledPlaces = benefics.map(planet => active.find(row => row.rulers.some(ruler => ruler.planet === planet)));
    if (ruledPlaces.every(Boolean)) {
      const evidence = [...lightProof, ...ruledPlaces.flatMap((row, index) => [
        ...row.proof, ...governanceProof(row, row.rulers.filter(({ planet }) => planet === benefics[index])),
      ])];
      historicalRecord('robbins_jupiter_venus', ...evidence);
      const joined = mercuryProof(positions, benefics, aspectBetween);
      if (joined.length) historicalRecord('robbins_mercury_with_benefics', ...evidence, ...joined);
    }
  }

  if (pairGovernsLights(lights, malefics)) {
    const evidence = [...places[0].proof, ...lightProof];
    const [saturn, mars] = malefics.map(planet => positions.get(planet));
    historicalRecord('robbins_saturn_mars', ...evidence);
    for (const [name, members] of Object.entries(signClasses)) {
      if ([saturn, mars].every(planet => members.includes(planet.sign))) historicalRecord('robbins_saturn_mars_' + name, ...evidence);
    }
    if (aspectBetween(saturn, mars) === 'opposition') {
      historicalRecord('robbins_saturn_mars_opposed', ...evidence, aspectFact('Saturn', 'Mars', 'opposition'));
    }
    const joined = mercuryProof(positions, malefics, aspectBetween);
    if (joined.length) historicalRecord('robbins_mercury_with_malefics', ...evidence, ...joined);
  }

  const fortune = active.find(({ point }) => point.body === 'fortune');
  if (fortune) {
    const planet = lillyDomicileRuler(fortune.point.longitude);
    const propertyPlace = active.find(({ point, rulers }) => point.body !== 'fortune' && rulers.length === 1 && rulers[0].planet === planet);
    if (propertyPlace && own.get(planet).length >= 2) {
      historicalRecord('robbins_property_connection', ...propertyPlace.proof, ...governanceProof(propertyPlace), ...fortune.proof,
        { kind: 'western_ptolemy_travel_ruler', body: 'fortune', planet }, ...own.get(planet).map(basis => basisFact(planet, planet, basis)));
    }
  }
  recordDomainGovernance(facts, lights, active, assess, historicalRecord);
  for (const entry of active) assessWitnesses(entry, historicalRecord);
}

function strictWinner(rows, metric, better) {
  if (rows.length < 2) return undefined;
  return rows.find(row => rows.every(other => row === other || better(metric(row), metric(other))));
}

export function recordCardanoTravelPriority(positions, places, assessment, aspectBetween, record) {
  if (!planets.every(planet => Number.isFinite(positions.get(planet)?.longitude))) return;
  for (const { position, proof } of places) {
    const { body } = position;
    const rays = [...positions.values()].flatMap(candidate => {
      if (candidate.body === body) return [];
      const aspect = aspectBetween(candidate, position);
      if (!aspect) return [];
      const distance = Math.abs(Math.abs(arc(candidate.longitude - position.longitude)) - lillyAspectAngles[aspect]);
      return distance <= 3 ? [{ candidate, aspect, distance }] : [];
    });
    const closest = strictWinner(rays, ray => ray.distance, (a, b) => b - a > 1e-8);
    const priority = (planet, method, value, selected) => ({ kind: 'western_ptolemy_travel_priority', planet, body, method, value, selected });
    if (closest) {
      record('cardano_priority_aspect', ...proof, pointLongitudeProof(position), ...rays.flatMap(ray => [
        aspectFact(ray.candidate.body, body, ray.aspect), longitudeFact(ray.candidate),
        priority(ray.candidate.body, 'aspect_precision', ray.distance, ray === closest),
      ]));
    }
    const ranked = assessment?.assess(position, proof);
    if (!ranked) continue;
    const candidates = ranked.ranking.filter(row => row.bases.length);
    const dignities = row => row.bases.length - Number(Boolean(row.aspect));
    const strongest = strictWinner(candidates, dignities, (a, b) => a > b);
    if (strongest) {
      record('cardano_priority_dignity', ...proof, assessment.sectProof, ...governanceProof(ranked, candidates),
        ...candidates.map(row => priority(row.planet, 'essential_dignity', dignities(row), row === strongest)));
    }
  }
}
