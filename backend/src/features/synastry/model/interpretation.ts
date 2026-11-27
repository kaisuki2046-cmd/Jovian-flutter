import type { ComparisonSection, ComparisonSubject, Direction, Evidence } from './comparison';

export const relationshipTypes = ['family', 'friendship', 'romance', 'collaboration'] as const;
export type RelationshipType = typeof relationshipTypes[number];
export const themeLabels = {
  support: '支持与帮助', communication: '沟通方式', emotional_exchange: '情感互动',
  attraction: '吸引与亲近', trust: '信任与可靠性', values: '价值观', daily_rhythm: '日常节奏',
  responsibility: '责任与分工', boundaries: '边界与自主', decision_making: '决策方式',
  resource_coordination: '资源与利益', conflict_resolution: '冲突处理', long_term_stability: '长期相处',
} as const;
export type ThemeId = keyof typeof themeLabels;
export type Polarity = 'supportive' | 'challenging' | 'mixed' | 'neutral';
export type ReviewStatus = 'draft' | 'in_review' | 'approved' | 'deprecated';
export type System = ComparisonSection['system'];
type Scalar = string | number | boolean;

export type Condition = {
  id: string;
  field: string;
  description: string;
  required: boolean;
} & (
  | { operator: 'exists' }
  | { operator: 'eq' | 'neq'; expected: Scalar }
  | { operator: 'in' | 'not_in'; expected: Scalar[] }
  | { operator: 'contains' | 'member' | 'not_member'; expected: string }
  | ({ operator: 'gte' | 'lte' } & ({ expected: number } | { expectedField: string }))
);

export type SourceReference = {
  id: string;
  type: 'product_derived' | 'classical_text' | 'modern_book' | 'school_material' | 'website' | 'open_source_dataset' | 'expert_review';
  title: string;
  locator: string;
  author?: string;
  edition?: string;
  chapter?: string;
  page?: string;
  url?: string;
  accessedAt?: string;
  rights: 'project_original' | 'permissive' | 'public_domain' | 'commercial_permission' | 'citation_only' | 'unknown' | 'restricted';
  usage: 'derived_rule' | 'short_quote' | 'metadata_only' | 'none';
};

export type ReviewDecision = { reviewer: string; date: string; reference: string };
export type ReviewedRecord = {
  reviewStatus: ReviewStatus;
  review?: ReviewDecision;
  version: string;
};

export type KnowledgeAtom = ReviewedRecord & {
  id: string;
  sourceClaimId?: string;
  methodRefs?: string[];
  system: System;
  factRule: string;
  factIds?: string[];
  factPatternId?: string;
  aliases?: string[];
  ruleVersions: string[];
  schoolId: string;
  chartRulesets?: string[];
  coreMeaning: string;
  rationale: string;
  originalText?: string;
  relatedFacts?: {
    system: System;
    factRule: string;
    ruleVersions: string[];
    chartRulesets?: string[];
    conditions: Condition[];
    exclusions: Condition[];
    sameParameters?: Record<string, string>;
  }[];
  sourceConditions?: {
    original: string[];
    normalized: string[];
    uncertain: string[];
    excluded: string[];
    context?: string;
    excerpt?: string;
    include: Condition[][];
    exclude: Condition[][];
    pending?: string;
  };
  conditions: Condition[];
  exclusions: Condition[];
  mitigatingFactors: string[];
  aggravatingFactors: string[];
  limitations: string[];
  sourceIds: string[];
  reasoning: { conditionIds: string[]; meaning: string; sourceIds: string[] }[];
  createdAt: string;
  updatedAt: string;
};

export type RelationshipVariant = ReviewedRecord & {
  id: string;
  knowledgeId: string;
  relationshipType: RelationshipType;
  theme: ThemeId;
  polarity: Polarity;
  interpretation: string;
  preview?: true;
  manifestations: string[];
  practicalGuidance: string[];
  limitations: string[];
  conditions: Condition[];
  exclusions: Condition[];
  sourceIds: string[];
};

export type InterpretationQuery = {
  factId: string;
  rule: string;
  system: System;
  parameters: Readonly<Record<string, string | number>>;
  direction: Direction;
  ruleVersion: string;
  chartRulesets: readonly [string, string];
  requestedRelationships: readonly RelationshipType[];
  requestedThemes?: readonly ThemeId[];
  requestedSchools?: readonly string[];
};

export type MatchStatus = 'matched' | 'no_knowledge_entry' | 'unsupported_relationship' | 'condition_not_met'
  | 'insufficient_fact_data' | 'incompatible_version' | 'pending_review' | 'deprecated'
  | 'unsupported_theme' | 'unsupported_school';

export type InterpretationChartReference = {
  mode: ComparisonSubject['mode'];
  snapshotId?: string;
  calculatedAt: string;
  engineName: string;
  engineVersion: string;
  rulesetVersion: string;
};

export type InterpretationFact = Evidence & {
  id: string;
  factTypeId: string;
  factPatternId?: string;
  system: System;
  ruleVersion: string;
  chartRefs: { a: InterpretationChartReference; b: InterpretationChartReference };
  limitations: string[];
};

export type EvidenceStatus = 'present' | 'none_found' | 'insufficient_data';

export type InterpretationResult = {
  resultId: string;
  factId: string;
  factTypeId: string;
  factPatternId?: string;
  system: System;
  relationshipType: RelationshipType;
  themeId: ThemeId;
  polarity: Polarity;
  knowledgeId: string;
  sourceClaimId?: string;
  knowledgeVersion: string;
  variantId: string;
  variantVersion: string;
  schoolId: string;
  catalogVersion: string;
  ruleVersion: string;
  reviewStatus: 'approved';
  matchStatus: 'matched';
  coreMeaning: string;
  traditionalRationale: string;
  relationshipInterpretation: string;
  possibleManifestations: string[];
  practicalGuidance: string[];
  limitations: string[];
  mitigatingFactors: string[];
  aggravatingFactors: string[];
  sourceRefs: SourceReference[];
  reasoningSteps: KnowledgeAtom['reasoning'];
  conditionResults: { id: string; description: string; status: 'passed' | 'failed' | 'missing' }[];
  exclusionResults: { id: string; description: string; status: 'passed' | 'failed' | 'missing' }[];
  chartRefs: InterpretationFact['chartRefs'];
};
