import { lillyDignityBodies } from './lilly-dignities.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { lillyWealthHistoryFacts, strongestWealthCandidate, wealthScore } from './lilly-wealth-history.mjs';

export const wealthPrincipalBases = ['sole_occupant', 'strongest_occupant', 'shared_ruler'];
export const wealthStrengths = ['powerful', 'weak', 'moderate'];
export const wealthPrincipal = (planet, basis) => ({ kind: 'western_lilly_wealth_principal', planet, basis });
export const wealthStrength = (planet, strength) => ({ kind: 'western_lilly_wealth_strength', planet, strength });
const adverseRows = new Set(['006', '007', '017', '028', '033', '034', '035', '038', '041']);
const seriousAdversity = sourceId => adverseRows.has(sourceId.slice(-7, -4));

export function lillyWealthPrincipalFacts(facts, houses, fortune, dignities, readFortitudeRanges, { historical = false } = {}) {
  if (!readFortitudeRanges) return [];
  const placements = new Map(houses.filter(fact => fact.kind === 'western_lilly_planet_house').map(({ planet, house }) => [planet, house]));
  if (!lillyDignityBodies.every(planet => placements.has(planet) && Number.isFinite(lillyPlanetPosition(facts, planet)?.longitude))) return [];

  const occupants = lillyDignityBodies.filter(planet => placements.get(planet) === 2);
  const secondRuler = houses.find(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === 2)?.planet;
  const holds = (planet, names) => dignities.some(fact => fact.kind === 'western_lilly_dignity'
    && fact.planet === planet && fact.matches && names.includes(fact.dignity));
  const single = occupants[0];
  const qualified = occupants.length !== 1 || ['Mars', 'Saturn'].includes(single)
    || holds(single, ['domicile', 'exaltation', 'triplicity', 'term', 'face']);
  const eligible = !qualified ? [] : occupants.length ? occupants : secondRuler && secondRuler === fortune?.ruler ? [secondRuler] : [];
  const members = historical && secondRuler && fortune ? [...new Set([secondRuler, fortune.ruler, ...occupants])] : [];
  if (!eligible.length && !members.length) return [];

  const ranges = readFortitudeRanges();
  const selected = strongestWealthCandidate(eligible, ranges);
  const historicalFacts = members.length ? lillyWealthHistoryFacts(facts, members, placements, ranges, selected) : [];
  if (!selected) return historicalFacts;
  const basis = occupants.length > 1 ? 'strongest_occupant' : occupants.length === 1 ? 'sole_occupant' : 'shared_ruler';
  const result = [wealthPrincipal(selected, basis), ...eligible.map(planet => {
    const { min, max } = ranges.get(planet);
    return wealthScore(planet, min, max);
  })];
  const { min, max, confirmedFactors, unresolvedSources } = ranges.get(selected);
  const serious = confirmedFactors.some(({ sourceId }) => seriousAdversity(sourceId));
  if (min > 0 && holds(selected, ['domicile', 'exaltation']) && !serious && !unresolvedSources.some(seriousAdversity)) {
    result.push(wealthStrength(selected, 'powerful'));
  } else if (max < 0 && serious) {
    result.push(wealthStrength(selected, 'weak'));
  } else if (min === 0 && max === 0 && confirmedFactors.some(row => row.points > 0)
    && confirmedFactors.some(row => row.points < 0)) {
    result.push(wealthStrength(selected, 'moderate'));
  }
  const currentKeys = new Set(result.map(fact => JSON.stringify(fact)));
  return [...result, ...historicalFacts.filter(fact => !currentKeys.has(JSON.stringify(fact)))];
}

export function lillyWealthPrincipalProof(conditions, observed) {
  const matched = [conditions.required, ...conditions.alternatives].flat();
  const principal = matched.find(fact => fact.kind === 'western_lilly_wealth_principal');
  const grade = matched.find(fact => fact.kind === 'western_lilly_wealth_strength');
  if (!principal && !grade) return conditions;
  const active = principal ?? observed.find(fact => fact.kind === 'western_lilly_wealth_principal' && fact.planet === grade.planet);
  const occupants = active?.basis === 'strongest_occupant'
    ? new Set(observed.filter(fact => fact.kind === 'western_lilly_planet_house' && fact.house === 2).map(fact => fact.planet)) : null;
  const explanatory = observed.filter(fact => fact.kind === 'western_lilly_wealth_score'
    && (occupants ? occupants.has(fact.planet) : fact.planet === active?.planet));
  if (!principal && active) explanatory.push(active);
  return { ...conditions, required: [...conditions.required, ...explanatory] };
}
