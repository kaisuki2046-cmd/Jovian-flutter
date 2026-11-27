import type { RelationshipType } from '../model/interpretation';
import type { RelationshipReport } from './relationship-report';

const instructions = [
  '仅使用本次证据组织这一类关系的说明，保留已提供的负向依据。',
  '所有判断引用 resultId 和 factId，保留适用条件及限制。',
  'none_found 表示已检查的覆盖范围内未检出依据；insufficient_data 表示无法判断。',
  '证据为空时只说明覆盖或资料状态。',
  '以 relationshipType 与 claims 输出结构化结果，每条判断包含 text、evidenceIds 和 factIds。',
  '引用组合关系时填写 combinationIds，并引用该组合的全部 evidenceIds。',
];

export function buildInterpretationContext(report: RelationshipReport, relationship: RelationshipType) {
  const bundle = report.relationships.find(({ type }) => type === relationship);
  if (!bundle) throw new TypeError('Unknown interpretation relationship.');
  const matching = report.interpretations.filter(({ relationshipType, reviewStatus, matchStatus }) =>
    relationshipType === relationship && reviewStatus === 'approved' && matchStatus === 'matched');
  const factsById = new Map(report.facts.map((fact) => [fact.id, fact]));
  const results = matching.map(({ chartRefs, ...result }) => {
    const fact = factsById.get(result.factId);
    if (!fact) throw new Error(`Missing matched fact ${result.factId}.`);
    return { ...result, evidenceId: result.resultId, direction: fact.direction, positions: fact.sources, parameters: fact.facts ?? {},
      chartRulesets: [chartRefs.a.rulesetVersion, chartRefs.b.rulesetVersion] };
  });
  const groups = {
    supportive: { status: bundle.positive.status, resultIds: bundle.positive.items.map(({ id }) => id) },
    challenging: { status: bundle.negative.status, resultIds: bundle.negative.items.map(({ id }) => id) },
    mixed: { status: bundle.mixedStatus, resultIds: bundle.mixed.map(({ id }) => id) },
    neutral: { status: bundle.neutralStatus, resultIds: bundle.neutral.map(({ id }) => id) },
  };
  const coverageGaps = {
    uncoveredFacts: bundle.gaps.uncoveredFactIds.length,
    insufficientFacts: bundle.gaps.insufficientFactIds.length,
    unavailableFactTypes: bundle.gaps.unavailableFactTypes.length,
    pendingKnowledge: bundle.gaps.pendingKnowledgeIds.length,
    pendingVariants: bundle.gaps.pendingVariantIds.length,
  };
  return { version: 'synastry-expression-context-v2', promptVersion: 'synastry-expression-prompt-v1',
    knowledgeVersion: report.knowledgeVersion, sourceVersion: report.sourceVersion, factSchemaVersion: report.factSchemaVersion,
    combinationRuleVersion: report.combinationRuleVersion,
    relationshipRulesVersion: report.version, relationship, coverage: bundle.coverage, groups, coverageGaps,
    instructions: [...instructions], results, combinations: bundle.combinations };
}

export type InterpretationContext = ReturnType<typeof buildInterpretationContext>;

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const ids = (value: unknown): value is string[] => Array.isArray(value)
  && value.every((id) => typeof id === 'string' && id.length > 0) && new Set(value).size === value.length;
const envelopeFields = new Set(['relationshipType', 'claims']);
const claimFields = new Set(['text', 'evidenceIds', 'factIds', 'combinationIds']);

export function validateInterpretationOutput(input: unknown, context: InterpretationContext) {
  if (!record(input) || Object.keys(input).some((key) => !envelopeFields.has(key))
    || input.relationshipType !== context.relationship || !Array.isArray(input.claims)) {
    return { valid: false, errors: ['invalid_relationship_or_claims'] };
  }
  const evidence = new Map(context.results.map((result) => [result.evidenceId, result]));
  const combinations = new Map(context.combinations.map((item) => [item.combinationId, item]));
  const cited = new Set<string>();
  const errors: string[] = [];
  input.claims.forEach((claim: unknown, index) => {
    if (!record(claim) || Object.keys(claim).some((key) => !claimFields.has(key)) || typeof claim.text !== 'string' || !claim.text.trim()
      || !ids(claim.evidenceIds) || !claim.evidenceIds.length || !ids(claim.factIds)
      || !(claim.combinationIds === undefined || ids(claim.combinationIds))) {
      errors.push(`invalid_claim:${index}`);
      return;
    }
    const evidenceIds = claim.evidenceIds;
    const matched = evidenceIds.map((id) => evidence.get(id));
    if (matched.some((item) => !item)) { errors.push(`unknown_evidence:${index}`); return; }
    const factIds = new Set(matched.map((item) => item!.factId));
    if (claim.factIds.length !== factIds.size || !claim.factIds.every((id) => factIds.has(id))) {
      errors.push(`invalid_fact_reference:${index}`);
      return;
    }
    if (claim.combinationIds?.some((id) => {
      const combination = combinations.get(id);
      return !combination || !combination.evidenceIds.every((id) => evidenceIds.includes(id));
    })) {
      errors.push(`invalid_combination_reference:${index}`);
      return;
    }
    evidenceIds.forEach((id) => cited.add(id));
  });
  for (const result of context.results) {
    if (result.polarity === 'challenging' && !cited.has(result.evidenceId)) errors.push(`omitted_challenging:${result.evidenceId}`);
  }
  return { valid: errors.length === 0, errors };
}
