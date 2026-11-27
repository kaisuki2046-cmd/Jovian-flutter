import type { ComparisonCoverage } from '../model/comparison';
import { relationshipTypes, themeLabels, type EvidenceStatus, type InterpretationFact, type InterpretationResult,
  type Polarity, type RelationshipType, type System, type ThemeId } from '../model/interpretation';
import { retrieveInterpretations, type InterpretationRepository } from './interpretation';
import { adaptInterpretationFacts, type ComparisonResult } from './interpretation-fact-adapter';
import { matchCombinations, type CombinationCatalog } from './interpretation-combinations';
import { assessMethods } from './method-runtime';
import { createClaimContext } from './claim-matching';

export const relationshipRulesVersion = 'synastry-relationship-v6';
type RelationshipCoverage = 'complete' | 'limited' | 'insufficient_data';
type Match = ReturnType<typeof retrieveInterpretations>['matches'][number];

type RelationshipEvidence = InterpretationFact & {
  factId: string;
  polarity: Polarity;
  relationshipType: RelationshipType;
  themeId: ThemeId;
  theme: string;
  interpretation: string;
  knowledge: Match['knowledge'];
  references: Match['sources'];
  manifestations: Match['scene']['manifestations'];
  trace: Match['trace'];
};
type EvidenceGroup = { status: EvidenceStatus; items: RelationshipEvidence[] };
const isReferenceKnowledge = (id: string) => id.startsWith('REF:') || id.startsWith('ALG:');
type Preview = { id: string; system: System; relationshipType: RelationshipType; theme: ThemeId;
  interpretation: string; observation: string; positions: InterpretationFact['sources']; direction: InterpretationFact['direction'] };

function explain(fact: InterpretationFact, { knowledge, scene, sources, trace }: Match) {
  const result: InterpretationResult = {
    resultId: `${fact.id}:${scene.id}:${knowledge.version}:${scene.version}`,
    factId: fact.id, factTypeId: fact.factTypeId, factPatternId: fact.factPatternId, system: fact.system,
    relationshipType: trace.relationship, themeId: scene.theme, polarity: scene.polarity,
    knowledgeId: knowledge.id, knowledgeVersion: knowledge.version, catalogVersion: trace.catalogVersion,
    ...(knowledge.sourceClaimId && { sourceClaimId: knowledge.sourceClaimId }),
    variantId: scene.id, variantVersion: scene.version, schoolId: knowledge.schoolId,
    ruleVersion: fact.ruleVersion, reviewStatus: 'approved', matchStatus: trace.status,
    coreMeaning: knowledge.coreMeaning, traditionalRationale: knowledge.rationale, relationshipInterpretation: scene.interpretation,
    possibleManifestations: scene.manifestations, practicalGuidance: scene.practicalGuidance,
    limitations: [...new Set([...fact.limitations, ...knowledge.limitations, ...scene.limitations])],
    mitigatingFactors: knowledge.mitigatingFactors, aggravatingFactors: knowledge.aggravatingFactors,
    sourceRefs: sources, reasoningSteps: knowledge.reasoning, conditionResults: trace.conditions ?? [],
    exclusionResults: trace.exclusions ?? [], chartRefs: fact.chartRefs,
  };
  const evidence: RelationshipEvidence = {
    ...fact, id: result.resultId, factId: result.factId,
    polarity: result.polarity, relationshipType: result.relationshipType, themeId: result.themeId,
    theme: themeLabels[scene.theme], interpretation: scene.interpretation, manifestations: scene.manifestations,
    knowledge, references: sources, trace, limitations: result.limitations,
  };
  return { evidence, result };
}

export function buildRelationshipReport(comparison: ComparisonResult, repository: InterpretationRepository,
  combinations: CombinationCatalog = { version: 'none', rules: [] }) {
  const { a, b, rulesVersion, sections } = comparison;
  const facts = adaptInterpretationFacts(comparison);
  const coverage = Object.fromEntries(sections.map(({ system, coverage }) => [system, coverage])) as Record<System, ComparisonCoverage>;
  const unavailable = new Set(sections.flatMap(({ system, unavailableRules }) =>
    (unavailableRules ?? []).map((rule) => `${system}:${rule}`)));
  const evidence: RelationshipEvidence[] = [];
  const interpretations: InterpretationResult[] = [];
  const pendingPreviews: Preview[] = [];
  const traces: ReturnType<typeof retrieveInterpretations>['traces'] = [];
  const queries = facts.map((fact) => ({ factId: fact.id, rule: fact.rule, system: fact.system, parameters: fact.facts ?? {},
    direction: fact.direction, ruleVersion: fact.ruleVersion,
    chartRulesets: [fact.chartRefs.a.rulesetVersion, fact.chartRefs.b.rulesetVersion] as const }));
  const context = createClaimContext(queries);
  for (const [index, fact] of facts.entries()) {
    const result = retrieveInterpretations({ ...queries[index],
      requestedRelationships: relationshipTypes,
    }, repository, context);
    for (const match of result.matches) {
      const explained = explain(fact, match);
      evidence.push(explained.evidence);
      interpretations.push(explained.result);
    }
    for (const { scene } of result.pendingMatches) {
      pendingPreviews.push({ id: scene.id, system: fact.system,
        relationshipType: scene.relationshipType, theme: scene.theme, interpretation: scene.interpretation,
        observation: fact.observation, positions: fact.sources, direction: fact.direction });
    }
    traces.push(...result.traces);
  }
  const factsById = new Map(facts.map((fact) => [fact.id, fact]));
  const relationships = relationshipTypes.map((type) => {
    const items = evidence.filter(({ relationshipType }) => relationshipType === type);
    const seen = new Set<string>();
    const scenePreviews = pendingPreviews.filter((item) => item.relationshipType === type);
    const previews = [...scenePreviews.filter(({ id }) => isReferenceKnowledge(id)),
      ...scenePreviews.filter(({ id }) => !isReferenceKnowledge(id))].filter((item) => {
      const key = `${item.id}:${item.direction}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const previewThemes = new Set<string>();
    const prioritized = previews.filter((item) => {
      const key = `${item.system}:${item.theme}`;
      if (previewThemes.has(key)) return false;
      previewThemes.add(key);
      return true;
    });
    const prioritizedItems = new Set(prioritized);
    const systemQueues = (['bazi', 'ziwei', 'western'] as const).map((system) =>
      [...prioritized, ...previews.filter((item) => !prioritizedItems.has(item))].filter((item) => item.system === system));
    const orderedPreviews = Array.from({ length: Math.max(...systemQueues.map(({ length }) => length)) }, (_, index) =>
      systemQueues.flatMap((queue) => queue[index] ? [queue[index]] : [])).flat();
    const eligible = [...repository.variants.values()].flatMap((scene) => {
      const atom = repository.atoms.get(scene.knowledgeId)!;
      return scene.relationshipType === type && scene.reviewStatus !== 'deprecated' && atom.reviewStatus !== 'deprecated'
        ? [{ atom, scene }] : [];
    });
    const live = eligible.filter(({ atom, scene }) =>
      atom.reviewStatus === 'approved' && scene.reviewStatus === 'approved' && atom.ruleVersions.includes(rulesVersion)
      && (!atom.chartRulesets || [a, b].every(({ chart }) => atom.chartRulesets!.includes(chart[atom.system].rulesetVersion))));
    const sceneTraces = traces.filter(({ relationship }) => relationship === type);
    const factIdsWithStatus = (matchStatus: typeof sceneTraces[number]['status']) =>
      [...new Set(sceneTraces.filter(({ status }) => status === matchStatus).map(({ factId }) => factId))];
    const gaps = {
      uncoveredFactIds: factIdsWithStatus('no_knowledge_entry'),
      insufficientFactIds: factIdsWithStatus('insufficient_fact_data'),
      unavailableFactTypes: [...new Set(live.map(({ atom: { system, factRule } }) => `${system}:${factRule}`)
        .filter((id) => unavailable.has(id)))],
      pendingKnowledgeIds: [...new Set(eligible.filter(({ atom }) => atom.reviewStatus !== 'approved').map(({ atom }) => atom.id))],
      pendingVariantIds: eligible.filter(({ scene }) => scene.reviewStatus !== 'approved').map(({ scene }) => scene.id),
    };
    const pending = gaps.pendingKnowledgeIds.length > 0 || gaps.pendingVariantIds.length > 0;
    const needsData = gaps.unavailableFactTypes.length > 0 || gaps.insufficientFactIds.length > 0;
    const complete = live.length > 0 && !pending && !needsData && gaps.uncoveredFactIds.length === 0 && live.length === eligible.length
      && live.every(({ atom }) => coverage[atom.system] === 'complete');
    const status: RelationshipCoverage = complete ? 'complete' : items.length ? 'limited' : 'insufficient_data';
    function group(polarity: Polarity): EvidenceGroup {
      const matches = items.filter((item) => item.polarity === polarity);
      const covered = complete && live.some(({ scene }) => scene.polarity === polarity);
      return { items: matches, status: matches.length ? 'present' : covered ? 'none_found' : 'insufficient_data' };
    }
    const positive = group('supportive');
    const negative = group('challenging');
    const mixed = items.filter(({ polarity }) => polarity === 'mixed');
    const neutral = items.filter(({ polarity }) => polarity === 'neutral');
    const themes = [...new Set(items.map(({ themeId }) => themeId))].map((themeId) => {
      const group = items.filter((item) => item.themeId === themeId);
      const supportive = group.filter(({ polarity }) => polarity === 'supportive');
      const challenging = group.filter(({ polarity }) => polarity === 'challenging');
      const conflict = supportive.length > 0 && challenging.length > 0;
      const crossSystemDisagreement = supportive.some((good) => challenging.some((bad) => good.system !== bad.system));
      const multipleSystems = new Set(group.map(({ system }) => system)).size > 1;
      const convergence = [supportive, challenging].some((set) => new Set(set.map(({ system }) => system)).size > 1);
      return { themeId, supportiveIds: supportive.map(({ id }) => id), challengingIds: challenging.map(({ id }) => id),
        mixedIds: group.filter(({ polarity }) => polarity === 'mixed').map(({ id }) => id), conflict,
        crossSystemAgreement: crossSystemDisagreement ? 'divergent' : convergence ? 'convergent'
          : multipleSystems ? 'partial' : 'unknown' };
    });
    const limitations = [
      ...new Set(sections.filter(({ system }) => eligible.some(({ atom }) => atom.system === system))
        .flatMap(({ limitation }) => limitation ? [limitation] : [])),
      ...(gaps.uncoveredFactIds.length ? ['部分盘面事实尚无解读条目。'] : []),
      ...(pending ? ['部分知识等待审核。'] : []),
      ...(needsData ? ['部分解读所需的盘面字段缺失。'] : []),
    ];
    const synthesis = positive.items.length && negative.items.length
      ? '正向和负向依据同时存在，可以分别查看它们对应的相处议题。'
      : items.length ? '结合实际相处，核对下列盘面提示。'
        : complete ? '已审核且适用的规则未命中本次盘面。' : '本次可用的已审核知识或盘面资料不足以形成解读。';
    return { type, coverage: status, positive, negative, mixed, neutral, mixedStatus: group('mixed').status,
      neutralStatus: group('neutral').status, gaps, themes, limitations, synthesis, previews: orderedPreviews,
      combinations: matchCombinations(type, interpretations, factsById, repository, combinations) };
  });
  return { version: relationshipRulesVersion, knowledgeVersion: repository.version, sourceVersion: repository.sourceVersion,
    factSchemaVersion: 'synastry-interpretation-fact-v1', combinationRuleVersion: combinations.version,
    participants: { a, b }, coverage, facts, evidence, interpretations, traces, relationships, methods: assessMethods(facts) };
}

export type RelationshipReport = ReturnType<typeof buildRelationshipReport>;
