import { combinationInteractions, type CombinationResult, type CombinationRule } from '../model/interpretation-combinations';
import { relationshipTypes, themeLabels, type InterpretationFact, type InterpretationResult, type RelationshipType } from '../model/interpretation';
import { validReview, type InterpretationRepository } from './interpretation';
import { compileClaimInputs, createClaimContext, matchClaims, type ClaimInput } from './claim-matching';

const str = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const list = (value: unknown): value is string[] => Array.isArray(value)
  && value.every(str) && new Set(value).size === value.length;
const record = (value: unknown): value is Record<string, unknown> => value !== null
  && typeof value === 'object' && !Array.isArray(value);
const systems = ['bazi', 'ziwei', 'western'];

function validRule(value: unknown, repository: InterpretationRepository): value is CombinationRule {
  if (!record(value) || !str(value.id) || !str(value.explanation)
    || !list(value.requiredKnowledgeIds) || value.requiredKnowledgeIds.length < 2
    || !list(value.relationshipTypes) || !value.relationshipTypes.length
    || !value.relationshipTypes.every((type) => relationshipTypes.some((known) => known === type))
    || !list(value.themeIds) || !value.themeIds.length || !value.themeIds.every((id) => Object.hasOwn(themeLabels, id))
    || !combinationInteractions.some((item) => item === value.interaction)
    || !list(value.conditions) || value.conditions.some((value) => value !== 'same_direction')
    || !list(value.limitations) || !value.limitations.length
    || !list(value.sourceIds) || !value.sourceIds.length || !value.sourceIds.every((id) => repository.sources.has(id))
    || !validReview(value, value.sourceIds, repository.sources)) return false;
  const required = value.requiredKnowledgeIds;
  const requiredSystems = new Set(required.map((id) => repository.atoms.get(id)?.system));
  if (requiredSystems.has(undefined)) return false;
  const scope = value.systemScope;
  if (scope === 'cross_system' ? requiredSystems.size < 2
    : !list(scope) || !scope.length || scope.some((system) => !systems.includes(system))
      || [...requiredSystems].some((system) => !scope.includes(system!))) return false;
  return value.relationshipTypes.every((type) => required.every((id) =>
    repository.variantsByAtom.get(id)?.some(({ relationshipType }) => relationshipType === type)));
}

export function validateCombinationCatalog(input: unknown, repository: InterpretationRepository) {
  if (!record(input) || !str(input.version) || !Array.isArray(input.rules)) {
    throw new TypeError('Invalid combination catalog.');
  }
  const ids = new Set<string>();
  const rules = input.rules.map((rule: unknown) => {
    if (!validRule(rule, repository) || ids.has(rule.id)) {
      throw new TypeError(`Invalid or duplicate combination rule ${record(rule) ? String(rule.id) : ''}.`);
    }
    ids.add(rule.id);
    return rule;
  });
  return { version: input.version, rules };
}

export type CombinationCatalog = ReturnType<typeof validateCombinationCatalog>;

export function matchCombinations(relationship: RelationshipType, results: readonly InterpretationResult[],
  facts: ReadonlyMap<string, InterpretationFact>, repository: InterpretationRepository, combinations: CombinationCatalog) {
  const eligible = results.filter((item) => item.relationshipType === relationship);
  const resultsByWitness = new Map(eligible.map((item) => [item.variantId + ':' + item.factId, item.resultId]));
  const matchedAtoms = new Set(eligible.map((item) => item.knowledgeId));
  const rules = combinations.rules.filter((rule) => rule.reviewStatus === 'approved' && rule.relationshipTypes.includes(relationship)
    && rule.requiredKnowledgeIds.every((id) => matchedAtoms.has(id)));
  if (!rules.length) return [];
  const requiredAtoms = new Set(rules.flatMap((rule) => rule.requiredKnowledgeIds));
  const variants = new Map([...repository.variants].filter(([, scene]) => requiredAtoms.has(scene.knowledgeId)
    && scene.relationshipType === relationship));
  const inputs = compileClaimInputs({ atoms: repository.atoms, variants }, rules).filter((input) =>
    input.combination && input.relationship === relationship && input.required.every(({ pending }) => !pending));
  const context = createClaimContext([...facts.values()].map((fact) => ({ ...fact, factId: fact.id,
    parameters: fact.facts ?? {}, chartRulesets: [fact.chartRefs.a.rulesetVersion, fact.chartRefs.b.rulesetVersion] as const })));
  const matches = matchClaims(inputs, { ...context, candidates(input: ClaimInput['required'][number]) {
    return context.candidates(input).filter(({ factId }) => resultsByWitness.has(input.variantId + ':' + factId));
  } });
  return matches.map(({ input, facts }): CombinationResult => {
    const rule = input.combination!;
    return {
      combinationId: [rule.id, rule.version, relationship].join(':'), ruleId: rule.id, ruleVersion: rule.version,
      interaction: rule.interaction, relationshipType: relationship, themeIds: rule.themeIds,
      explanation: rule.explanation, limitations: rule.limitations,
      evidenceIds: facts.map(({ factId }, index) => resultsByWitness.get(input.required[index].variantId + ':' + factId)!),
      factIds: [...new Set(facts.map(({ factId }) => factId))],
      sourceRefs: rule.sourceIds.map((id) => repository.getSource(id)!),
    };
  });
}
