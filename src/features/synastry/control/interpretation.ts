import { relationshipTypes, themeLabels, type Condition, type InterpretationQuery, type KnowledgeAtom,
  type MatchStatus, type RelationshipType, type RelationshipVariant, type SourceReference } from '../model/interpretation';
import { factPatternId, factTypeId, registeredFactFields } from '../model/interpretation-facts';
import { evaluateInterpretationConditions, evaluateFactInput, type FactQuery } from './fact-matching';
import { claimInputsForScene, createClaimContext, evaluateClaimInput } from './claim-matching';
export { evaluateInterpretationConditions } from './fact-matching';

type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const list = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const populated = (value: unknown): value is string[] => list(value) && value.length > 0;
const oneOf = (value: unknown, values: readonly string[]) => typeof value === 'string' && values.includes(value);
const field = (value: unknown): value is string => value === 'direction'
  || typeof value === 'string' && /^facts\.[A-Za-z][A-Za-z0-9]*$/.test(value);
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const scalar = (value: unknown) => numeric(value) || typeof value === 'boolean' || text(value);
const systems = ['bazi', 'ziwei', 'western'];
const polarities = ['supportive', 'challenging', 'mixed', 'neutral'];
const reviewStates = ['draft', 'in_review', 'approved', 'deprecated'];
const sourceTypes = ['product_derived', 'classical_text', 'modern_book', 'school_material', 'website',
  'open_source_dataset', 'expert_review'];
const usableRights = ['project_original', 'permissive', 'public_domain', 'commercial_permission'];
const dateValid = (value: unknown): value is string => {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(value);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
};
const normalizeAlias = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

function condition(value: unknown): value is Condition {
  if (!object(value) || !text(value.id) || !field(value.field) || !text(value.description)
    || typeof value.required !== 'boolean') return false;
  const { operator, expected, expectedField } = value;
  if (operator === 'gte' || operator === 'lte') {
    return expectedField === undefined ? numeric(expected) : expected === undefined && field(expectedField);
  }
  if (expectedField !== undefined) return false;
  if (operator === 'exists') return expected === undefined;
  if (operator === 'eq' || operator === 'neq') return scalar(expected);
  if (operator === 'contains' || operator === 'member' || operator === 'not_member') return text(expected);
  return (operator === 'in' || operator === 'not_in') && Array.isArray(expected) && expected.length > 0
    && expected.every(scalar);
}

function source(value: unknown): value is SourceReference {
  return object(value) && text(value.id) && text(value.title) && text(value.locator)
    && ['author', 'edition', 'chapter', 'page'].every((key) => value[key] === undefined || text(value[key]))
    && (value.url === undefined || text(value.url) && /^https?:\/\/[^\s]+$/i.test(value.url))
    && (value.accessedAt === undefined || dateValid(value.accessedAt))
    && oneOf(value.type, sourceTypes)
    && oneOf(value.rights, [...usableRights, 'citation_only', 'unknown', 'restricted'])
    && (oneOf(value.usage, ['metadata_only', 'none'])
      || oneOf(value.rights, usableRights) && oneOf(value.usage, ['derived_rule', 'short_quote']));
}

export function validReview(value: RecordValue, sourceIds: string[], sources: ReadonlyMap<string, SourceReference>) {
  if (!oneOf(value.reviewStatus, reviewStates) || !text(value.version)) return false;
  if (value.reviewStatus !== 'approved') return true;
  const review = value.review;
  return object(review) && text(review.reviewer) && text(review.reference) && dateValid(review.date)
    && sourceIds.some((id) => sources.get(id)?.usage === 'derived_rule');
}

function validateFactConditions(value: RecordValue, system: KnowledgeAtom['system'], rule: string, id: string) {
  if (!Array.isArray(value.conditions) || !Array.isArray(value.exclusions)) return false;
  const conditions = [...value.conditions, ...value.exclusions];
  if (!conditions.every(condition)) return false;
  const fields = registeredFactFields(system, rule);
  if (!fields) throw new TypeError(`Unknown interpretation fact type in ${id}.`);
  for (const item of conditions) {
    const paths = [item.field, ...('expectedField' in item ? [item.expectedField] : [])];
    for (const path of paths) {
      if (path !== 'direction' && !fields.includes(path.slice('facts.'.length))) {
        throw new TypeError(`Unknown condition field ${path} in ${id}.`);
      }
    }
  }
  return new Set(conditions.map((item) => item.id)).size === conditions.length;
}

function atom(value: unknown, sources: Map<string, SourceReference>): value is KnowledgeAtom {
  if (!object(value) || !text(value.id) || !oneOf(value.system, systems) || !text(value.factRule)
    || !populated(value.ruleVersions) || !text(value.schoolId)
    || !dateValid(value.createdAt) || !dateValid(value.updatedAt) || value.createdAt > value.updatedAt
    || (value.aliases !== undefined && !populated(value.aliases))
    || !text(value.coreMeaning) || !text(value.rationale)
    || !list(value.mitigatingFactors) || !list(value.aggravatingFactors) || !populated(value.limitations)
    || !populated(value.sourceIds) || !value.sourceIds.every((id) => sources.has(id))
    || (value.chartRulesets !== undefined && !populated(value.chartRulesets))) return false;
  const system = value.system as KnowledgeAtom['system'];
  const rule = value.factRule;
  if (!validateFactConditions(value, system, rule, value.id)) return false;
  if (value.relatedFacts !== undefined && (!Array.isArray(value.relatedFacts) || !value.relatedFacts.every((related) => {
    if (!object(related) || !oneOf(related.system, systems) || !text(related.factRule) || !populated(related.ruleVersions)
      || (related.chartRulesets !== undefined && !populated(related.chartRulesets))) return false;
    const relatedSystem = related.system as KnowledgeAtom['system'];
    const relatedFields = registeredFactFields(relatedSystem, related.factRule);
    const primaryFields = registeredFactFields(system, rule);
    return validateFactConditions(related, relatedSystem, related.factRule, String(value.id))
      && (related.sameParameters === undefined || object(related.sameParameters) && Object.keys(related.sameParameters).length > 0
        && Object.entries(related.sameParameters).every(([field, primary]) =>
          text(primary) && relatedFields?.includes(field) && primaryFields?.includes(primary)));
  }))) return false;
  if (value.factIds !== undefined) {
    const prefix = `${factTypeId(system, rule)}:`;
    if (!populated(value.factIds) || new Set(value.factIds).size !== value.factIds.length
      || value.factIds.some((id) => !id.startsWith(prefix) || !/^[0-9a-f]{16}$/.test(id.slice(prefix.length)))) return false;
  }
  if (value.factPatternId !== undefined) {
    if (!text(value.factPatternId)) return false;
    const equalFields = Object.fromEntries((value.conditions as Condition[])
      .filter((item): item is Condition & { operator: 'eq' } => condition(item) && item.operator === 'eq' && item.required)
      .map(({ field, expected }) => [field.slice('facts.'.length), expected]));
    if (factPatternId({ system, rule: value.factRule, parameters: equalFields }) !== value.factPatternId) return false;
  }
  const conditionIds = new Set([...(value.conditions as Condition[]), ...(value.exclusions as Condition[])].map(({ id }) => id));
  const sourceIds = value.sourceIds;
  if (!Array.isArray(value.reasoning) || !value.reasoning.length
    || !value.reasoning.every((step) => object(step) && text(step.meaning)
      && list(step.conditionIds) && step.conditionIds.every((id) => conditionIds.has(id))
      && populated(step.sourceIds) && step.sourceIds.every((id) => sourceIds.includes(id)))) return false;
  return validReview(value, sourceIds, sources);
}

function variant(value: unknown, parent: KnowledgeAtom, sources: Map<string, SourceReference>): value is RelationshipVariant {
  if (!object(value) || !text(value.id) || !oneOf(value.relationshipType, relationshipTypes)
    || !text(value.theme) || !Object.hasOwn(themeLabels, value.theme) || !oneOf(value.polarity, polarities)
    || !text(value.interpretation) || (value.preview !== undefined && value.preview !== true)
    || !populated(value.manifestations) || !list(value.practicalGuidance)
    || !list(value.limitations) || !populated(value.sourceIds) || !value.sourceIds.every((id) => sources.has(id))
    || !validReview(value, value.sourceIds, sources) || !validateFactConditions(value, parent.system, parent.factRule, value.id)) return false;
  const allConditions = [...parent.conditions, ...parent.exclusions,
    ...(value.conditions as Condition[]), ...(value.exclusions as Condition[])];
  return new Set(allConditions.map(({ id }) => id)).size === allConditions.length;
}

export function createInterpretationRepository(input: unknown) {
  if (!object(input) || !text(input.version) || !Array.isArray(input.sources)
    || !Array.isArray(input.atoms) || !Array.isArray(input.variants)) {
    throw new TypeError('Invalid interpretation catalog.');
  }
  const sources = new Map<string, SourceReference>();
  for (const item of input.sources) {
    if (!source(item) || sources.has(item.id)) throw new TypeError('Invalid or duplicate interpretation source.');
    sources.set(item.id, item);
  }
  const atoms = new Map<string, KnowledgeAtom>();
  const byFact = new Map<string, KnowledgeAtom[]>();
  const byAlias = new Map<string, KnowledgeAtom[]>();
  for (const item of input.atoms) {
    if (!atom(item, sources) || atoms.has(item.id)) {
      throw new TypeError(`Invalid or duplicate interpretation entry ${object(item) ? String(item.id) : ''}.`);
    }
    atoms.set(item.id, item);
    const key = factTypeId(item.system, item.factRule);
    const entries = byFact.get(key) ?? [];
    entries.push(item);
    byFact.set(key, entries);
    for (const alias of new Set(item.aliases?.map(normalizeAlias) ?? [])) {
      const hits = byAlias.get(alias) ?? [];
      hits.push(item);
      byAlias.set(alias, hits);
    }
  }
  const variants = new Map<string, RelationshipVariant>();
  const variantsByAtom = new Map<string, RelationshipVariant[]>();
  for (const item of input.variants) {
    const parent = object(item) && text(item.knowledgeId) ? atoms.get(item.knowledgeId) : undefined;
    if (!parent || !variant(item, parent, sources) || variants.has(item.id)) {
      throw new TypeError(`Invalid or duplicate relationship variant ${object(item) ? String(item.id) : ''}.`);
    }
    variants.set(item.id, item);
    const related = variantsByAtom.get(parent.id) ?? [];
    related.push(item);
    variantsByAtom.set(parent.id, related);
  }
  const sourceVersion = text(input.sourceVersion) ? input.sourceVersion : input.version;
  const palaceIndex = new Map<string, KnowledgeAtom[]>();
  const palaceRule = 'ziwei:ziwei-cross-palace-sector';
  const palaceFallback: KnowledgeAtom[] = [];
  for (const atom of byFact.get(palaceRule) ?? []) {
    const choices = (items: Condition[], path: string) => {
      const item = items.find((value) => value.required && value.field === path);
      return item?.operator === 'eq' ? [item.expected] : item?.operator === 'in' ? item.expected : [];
    };
    const branches = (atom.sourceConditions?.include ?? [[]]).map((group) => {
      const items = [...group, ...atom.conditions];
      return [choices(items, 'facts.source'), choices(items, 'facts.target')];
    });
    if (!branches.length || branches.some(([left, right]) => !left.length || !right.length) || atom.factIds) {
      palaceFallback.push(atom);
      continue;
    }
    const keys = new Set(branches.flatMap(([left, right]) => left.flatMap((a) => right.map((b) => JSON.stringify([a, b])))));
    for (const key of keys) {
      const bucket = palaceIndex.get(key) ?? [];
      bucket.push(atom);
      palaceIndex.set(key, bucket);
    }
  }
  const reader: InterpretationMatchReader = {
    version: input.version,
    candidateAtoms({ system, rule, parameters: { source, target } }) {
      const typeId = factTypeId(system, rule);
      return typeId === palaceRule && typeof source === 'string' && typeof target === 'string'
        ? [...(palaceIndex.get(JSON.stringify([source, target])) ?? []), ...palaceFallback]
        : byFact.get(typeId) ?? [];
    },
    scenesFor(atomId, relationship) {
      return variantsByAtom.get(atomId)?.filter((item) => item.relationshipType === relationship) ?? [];
    },
    getSource(id) { return sources.get(id); },
  };
  return { ...reader, sourceVersion, sources, atoms, byFact, byAlias, variants, variantsByAtom, palaceIndex, palaceFallback };
}

type InterpretationMatchReader = {
  version: string;
  candidateAtoms(query: InterpretationQuery): readonly KnowledgeAtom[];
  scenesFor(atomId: string, relationship: RelationshipType): readonly RelationshipVariant[];
  getSource(id: string): SourceReference | undefined;
};
export type InterpretationRepository = ReturnType<typeof createInterpretationRepository>;

export function searchInterpretationAliases(alias: string, repository: InterpretationRepository) {
  return (repository.byAlias.get(normalizeAlias(alias)) ?? []).map(({ id, system, factRule, reviewStatus }) => ({
    knowledgeId: id, factTypeId: factTypeId(system, factRule), reviewStatus,
  }));
}

export type InterpretationTrace = {
  relationship: RelationshipType;
  factId: string;
  factTypeId: string;
  factPatternId?: string;
  ruleVersion: string;
  status: MatchStatus;
  knowledgeId?: string;
  knowledgeVersion?: string;
  variantId?: string;
  variantVersion?: string;
  schoolId?: string;
  selector?: 'fact_id' | 'fact_type' | 'fact_pattern';
  catalogVersion: string;
  conditions?: ReturnType<typeof evaluateInterpretationConditions>;
  exclusions?: ReturnType<typeof evaluateInterpretationConditions>;
};

export function retrieveInterpretations(query: InterpretationQuery, repository: InterpretationMatchReader,
  comparisonContext?: ReturnType<typeof createClaimContext<FactQuery>>) {
  if (!text(query.factId) || !query.requestedRelationships.every((type) => relationshipTypes.includes(type))) {
    throw new TypeError('Invalid interpretation query.');
  }
  const typeId = factTypeId(query.system, query.rule);
  const pattern = factPatternId(query);
  const typeCandidates = repository.candidateAtoms(query);
  const exact = typeCandidates.filter((item) => item.factIds?.includes(query.factId));
  const reusable = typeCandidates.filter((item) => !item.factIds);
  const patterned = pattern ? reusable.filter((item) => item.factPatternId === pattern) : [];
  const general = reusable.filter((item) => !pattern || !item.factPatternId);
  const candidates = [...exact, ...patterned, ...general];
  const traces: InterpretationTrace[] = [];
  const matches: {
    trace: InterpretationTrace & { status: 'matched' };
    knowledge: KnowledgeAtom;
    scene: RelationshipVariant;
    sources: SourceReference[];
  }[] = [];
  const pendingMatches: { trace: InterpretationTrace; knowledge: KnowledgeAtom; scene: RelationshipVariant }[] = [];
  for (const relationship of new Set(query.requestedRelationships)) {
    const base = { relationship, factId: query.factId, factTypeId: typeId, factPatternId: pattern,
      ruleVersion: query.ruleVersion, catalogVersion: repository.version };
    if (!candidates.length) traces.push({ ...base, status: 'no_knowledge_entry' });
    for (const knowledge of candidates) {
      const selector = knowledge.factIds ? 'fact_id' as const
        : knowledge.factPatternId ? 'fact_pattern' as const : 'fact_type' as const;
      const context = { ...base, knowledgeId: knowledge.id, knowledgeVersion: knowledge.version, selector, schoolId: knowledge.schoolId };
      const scenes = repository.scenesFor(knowledge.id, relationship);
      if (!scenes.length) { traces.push({ ...context, status: 'unsupported_relationship' }); continue; }
      if (query.requestedSchools && !query.requestedSchools.includes(knowledge.schoolId)) {
        traces.push({ ...context, status: 'unsupported_school' });
        continue;
      }
      if (knowledge.reviewStatus === 'deprecated') { traces.push({ ...context, status: 'deprecated' }); continue; }
      if (!knowledge.ruleVersions.includes(query.ruleVersion)
        || knowledge.chartRulesets && !query.chartRulesets.every((version) => knowledge.chartRulesets!.includes(version))) {
        traces.push({ ...context, status: 'incompatible_version' });
        continue;
      }
      for (const scene of scenes) {
        const related = { ...context, variantId: scene.id, variantVersion: scene.version };
        if (scene.reviewStatus === 'deprecated') { traces.push({ ...related, status: 'deprecated' }); continue; }
        if (query.requestedThemes && !query.requestedThemes.includes(scene.theme)) {
          traces.push({ ...related, status: 'unsupported_theme' });
          continue;
        }
        const inputs = claimInputsForScene(knowledge, scene);
        let evaluation;
        for (const input of inputs) {
          const primary = evaluateFactInput(input.required[0], query);
          const current = primary.status === 'matched' && input.required.length > 1
            && (!comparisonContext || !evaluateClaimInput<FactQuery>(input, comparisonContext, query))
            ? { ...primary, status: 'insufficient_fact_data' as const } : primary;
          if (!evaluation || current.status !== 'condition_not_met') evaluation = current;
          if (current.status === 'matched') break;
        }
        const { status: outcome, conditions, exclusions } = evaluation ?? { status: 'insufficient_fact_data' };
        const status: MatchStatus = outcome === 'matched' && (knowledge.reviewStatus !== 'approved' || scene.reviewStatus !== 'approved')
          ? 'pending_review' : outcome;
        const trace = { ...related, conditions, exclusions, status };
        traces.push(trace);
        if (status === 'pending_review') pendingMatches.push({ trace, knowledge, scene });
        if (status === 'matched') {
          const sourceIds = [...new Set([...knowledge.sourceIds, ...scene.sourceIds])];
          matches.push({ trace: { ...trace, status }, knowledge, scene, sources: sourceIds.map((id) => repository.getSource(id)!) });
        }
      }
    }
  }
  return { matches, pendingMatches, traces };
}
