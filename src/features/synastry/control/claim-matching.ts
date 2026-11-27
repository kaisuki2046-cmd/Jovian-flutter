import type { CombinationRule } from '../model/interpretation-combinations';
import type { KnowledgeAtom, RelationshipType, RelationshipVariant } from '../model/interpretation';
import { factTypeId } from '../model/interpretation-facts';
import { comparisonDirections } from '../model/algorithm-profiles';
import { evaluateFactInput, factInputs, type FactInput, type FactQuery } from './fact-matching';

type Requirement = FactInput & { variantId: string; pending: boolean };
type Binding = { first: number; second: number; fields: Record<string, string> };
type RequirementGroup = { required: Requirement[]; bindings: Binding[] };
export type FactProgram<R extends FactInput = FactInput> = { required: R[]; bindings: Binding[]; relations: 'same_direction'[] };
export type ClaimInput = {
  id: string;
  relationship: RelationshipType;
  required: Requirement[];
  bindings: Binding[];
  relations: 'same_direction'[];
  allowSharedFact: boolean;
  combination?: CombinationRule;
};
type Catalog = {
  atoms: ReadonlyMap<string, KnowledgeAtom>;
  variants: ReadonlyMap<string, RelationshipVariant>;
};

export function claimInputsForScene(atom: KnowledgeAtom, scene: RelationshipVariant): ClaimInput[] {
  if (atom.reviewStatus === 'deprecated' || scene.reviewStatus === 'deprecated') return [];
  const pending = atom.reviewStatus !== 'approved' || scene.reviewStatus !== 'approved';
  const variantId = scene.id;
  const related = atom.relatedFacts ?? [];
  const additional = related.map(({ system, factRule, ruleVersions, chartRulesets, conditions, exclusions }): Requirement => ({
    type: factTypeId(system, factRule), ruleVersions, chartRulesets, conditions, exclusions: exclusions.map((item) => [item]),
    variantId, pending,
  }));
  const bindings = related.flatMap(({ sameParameters }, index) => sameParameters
    ? [{ first: 0, second: index + 1, fields: sameParameters }] : []);
  return factInputs(atom, scene).map((item) => ({ id: scene.id, relationship: scene.relationshipType,
    required: [{ ...item, variantId, pending }, ...additional], bindings, relations: [], allowSharedFact: false }));
}

export function compileClaimInputs(catalog: Catalog, combinations: readonly CombinationRule[]) {
  const inputs: ClaimInput[] = [];
  const byAtom = new Map<string, RequirementGroup[]>();
  for (const scene of catalog.variants.values()) {
    const atom = catalog.atoms.get(scene.knowledgeId);
    if (!atom) continue;
    const groups = claimInputsForScene(atom, scene);
    const key = `${atom.id}:${scene.relationshipType}`;
    byAtom.set(key, [...(byAtom.get(key) ?? []), ...groups]);
    inputs.push(...groups);
  }
  for (const combination of combinations) {
    if (combination.reviewStatus === 'deprecated') continue;
    for (const relationship of combination.relationshipTypes) {
      const prerequisites = combination.requiredKnowledgeIds.map((id) => byAtom.get(`${id}:${relationship}`) ?? []);
      const alternatives = prerequisites.reduce<RequirementGroup[]>((branches, group) =>
        branches.flatMap((branch) => group.map(({ required, bindings }) => {
          const offset = branch.required.length;
          return { required: [...branch.required, ...required], bindings: [...branch.bindings,
            ...bindings.map(({ first, second, fields }) => ({ first: first + offset, second: second + offset, fields }))] };
        })), [{ required: [], bindings: [] }]);
      for (const group of alternatives) inputs.push({ id: `${combination.id}:${relationship}`, relationship, ...group,
        relations: combination.conditions, allowSharedFact: combination.interaction === 'duplicate_or_dependent', combination });
    }
  }
  return inputs;
}

const factKey = (type: string, ...values: (string | number | boolean)[]) => JSON.stringify([type, ...values]);
function requiredKeys(input: FactInput) {
  return [factKey(input.type), ...input.conditions.flatMap((condition) => condition.required && condition.operator === 'eq'
    ? [factKey(input.type, condition.field, condition.expected)] : [])];
}

export function claimIndexKeys(input: FactProgram) {
  return [...new Set(input.required.flatMap(requiredKeys))];
}

export function createClaimContext<T extends FactQuery>(facts: readonly T[]) {
  const index = new Map<string, T[]>();
  for (const fact of facts) {
    const type = factTypeId(fact.system, fact.rule);
    for (const key of [factKey(type), factKey(type, 'direction', fact.direction),
      ...Object.entries(fact.parameters).map(([name, value]) => factKey(type, `facts.${name}`, value))]) {
      const bucket = index.get(key) ?? [];
      bucket.push(fact);
      index.set(key, bucket);
    }
  }
  return {
    keys: [...index.keys()],
    candidates(input: FactInput) {
      let narrowest: T[] | undefined;
      for (const key of requiredKeys(input)) {
        const bucket = index.get(key);
        if (!bucket) return [];
        if (!narrowest || bucket.length < narrowest.length) narrowest = bucket;
      }
      return (narrowest ?? []).filter((fact) => evaluateFactInput(input, fact).status === 'matched');
    },
  };
}

export function evaluateClaimInput<T extends FactQuery>(input: ClaimInput, context: { candidates(input: Requirement): T[] }, primary?: T) {
  const facts = evaluateFactProgram(input, context, primary, (fact, requirement) => input.allowSharedFact
    ? `${requirement.variantId}:${fact.factId}` : fact.factId);
  if (facts) return { input, facts, pendingReview: input.required.some(({ pending }) => pending)
    || Boolean(input.combination && input.combination.reviewStatus !== 'approved') };
}

export function evaluateFactProgram<T extends FactQuery, R extends FactInput>(
  input: FactProgram<R>, context: { candidates(input: R): T[] }, primary?: T,
  witnessKey: (fact: T, requirement: R) => string = (fact) => fact.factId,
) {
  const groups = input.required.map((requirement, slot) => slot === 0 && primary
    ? evaluateFactInput(requirement, primary).status === 'matched' ? [primary] : [] : context.candidates(requirement));
  if (groups.some((group) => !group.length)) return undefined;
  const directions = input.relations.includes('same_direction') ? comparisonDirections : [undefined];
  for (const direction of directions) {
    const assigned = new Set<string>();
    const selected: T[] = [];
    function bind(slot: number): boolean {
      if (slot === groups.length) return true;
      for (const fact of groups[slot]) {
        if (direction && fact.direction !== direction) continue;
        const key = witnessKey(fact, input.required[slot]);
        if (assigned.has(key) || input.bindings.some(({ first, second, fields }) => second === slot
          && Object.entries(fields).some(([field, primaryField]) => !Object.hasOwn(fact.parameters, field)
            || fact.parameters[field] !== selected[first].parameters[primaryField]))) continue;
        assigned.add(key);
        selected[slot] = fact;
        if (bind(slot + 1)) return true;
        assigned.delete(key);
      }
      return false;
    }
    if (bind(0)) return selected;
  }
  return undefined;
}

export function matchClaims<T extends FactQuery>(candidates: Iterable<ClaimInput>, context: { candidates(input: Requirement): T[] }) {
  const matches = new Map<string, NonNullable<ReturnType<typeof evaluateClaimInput<T>>>>();
  for (const input of candidates) {
    const previous = matches.get(input.id);
    if (previous && !previous.pendingReview) continue;
    const match = evaluateClaimInput(input, context);
    if (match && (!previous || !match.pendingReview)) matches.set(input.id, match);
  }
  return [...matches.values()];
}
