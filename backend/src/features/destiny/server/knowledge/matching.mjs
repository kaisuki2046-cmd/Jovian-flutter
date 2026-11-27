import { normalizeFacts } from './catalog.mjs';
import { ziweiScopes, earthlyBranches } from './dictionaries.mjs';

export const chartScopes = ['natal', 'decade', 'annual', 'monthly', 'daily', 'hourly'];
const palaceDistances = { same_palace: [0], opposite_palace: [6], trine_palaces: [4, 8] };
const opposingBranches = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
const factKey = (fact) => JSON.stringify(fact);
const includesAll = (facts, index) => facts.every((fact) => index.has(factKey(fact)));

export function normalizeRuleInput(method, input) {
  const group = (facts) => normalizeFacts(method, facts).sort((a, b) => factKey(a).localeCompare(factKey(b)));
  const { required, mustBeAbsent = [], anyOf = [], relations = [], thresholds = [] } = input;
  if (!required?.length || anyOf.some((facts) => !facts.length)) throw new Error('A rule needs nonempty fact conditions.');
  const checks = relations.map(({ type, first, second }) => {
    const supported = (method === 'ziwei' && Object.hasOwn(palaceDistances, type) && first.kind === 'palace_star' && second.kind === 'palace_star')
      || (method === 'bazi' && type === 'branch_opposition' && first.kind === 'branch' && second.kind === 'branch');
    if (!supported) throw new Error('Unsupported relation: ' + type);
    const [a, b] = normalizeFacts(method, [first, second]);
    return { type, first: a, second: b };
  });
  const ranges = thresholds.map(({ fact, min, max }) => {
    const [selector] = normalizeFacts(method, [{ ...fact, orb: 0 }]);
    if (selector.kind !== 'aspect_orb' || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || min > max || max > 6) {
      throw new Error('Invalid aspect orb threshold.');
    }
    const { orb, ...shape } = selector;
    return { fact: shape, min, max };
  });
  return { required: group(required), mustBeAbsent: group(mustBeAbsent), anyOf: anyOf.map(group), relations: checks, thresholds: ranges };
}

export function chartContext(method, facts, absent = [], scope = 'natal') {
  const present = normalizeFacts(method, facts);
  const knownAbsent = normalizeFacts(method, absent);
  const presentKeys = new Set(present.map(factKey));
  if (knownAbsent.some((fact) => presentKeys.has(factKey(fact)))) {
    throw new TypeError('A fact cannot be both confirmed present and absent.');
  }
  if (!chartScopes.includes(scope)) throw new TypeError('Invalid chart scope.');
  if (method === 'ziwei' && [...present, ...knownAbsent].some((fact) =>
    fact.scope !== undefined && ziweiScopes[fact.scope] !== scope)) {
    throw new TypeError('Ziwei fact scope conflicts with the chart scope.');
  }
  return { present, presentKeys, absentKeys: new Set(knownAbsent.map(factKey)), scope };
}

function matchesRelation({ type, first, second }, chart) {
  if (!includesAll([first, second], chart.presentKeys)) return false;
  if (type === 'branch_opposition') {
    return first.position !== second.position &&
      opposingBranches.some((pair) => pair.includes(first.branch) && first.branch !== second.branch && pair.includes(second.branch));
  }
  if (first.scope !== second.scope) return false;
  if (type === 'same_palace') return first.palace === second.palace && first.star !== second.star;
  const branchIndex = (palace) => {
    const branches = chart.present.filter((fact) => fact.kind === 'palace_branch' && fact.palace === palace);
    return branches.length === 1 ? earthlyBranches.indexOf(branches[0].branch) : -1;
  };
  const a = branchIndex(first.palace);
  const b = branchIndex(second.palace);
  return a >= 0 && b >= 0 && palaceDistances[type].includes((a - b + 12) % 12);
}

export function evaluateRule(input, scope, chart) {
  if (scope !== chart.scope) return { matched: false, reason: 'scope' };
  if (!includesAll(input.required, chart.presentKeys)) return { matched: false, reason: 'required' };
  if (!includesAll(input.mustBeAbsent, chart.absentKeys)) return { matched: false, reason: 'exclusion_unconfirmed' };
  const matchedAlternatives = input.anyOf.filter((facts) => includesAll(facts, chart.presentKeys));
  if (input.anyOf.length && !matchedAlternatives.length) return { matched: false, reason: 'anyOf' };
  if (!input.relations.every((relation) => matchesRelation(relation, chart))) return { matched: false, reason: 'relations' };
  const measures = input.thresholds.map(({ fact, min, max }) => chart.present.find((value) =>
    Object.entries(fact).every(([field, expected]) => value[field] === expected) && value.orb >= min && value.orb <= max));
  if (measures.some((fact) => !fact)) return { matched: false, reason: 'thresholds' };
  return { matched: true, conditions: {
    required: input.required, alternatives: matchedAlternatives, absent: input.mustBeAbsent,
    relations: input.relations, measurements: measures,
  } };
}
