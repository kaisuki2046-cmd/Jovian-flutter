import type { FortuneFactRecord, Scope } from './fortune-facts';
import type { PreviewPeriod } from '../control/period-window';

export type Method = Exclude<FortuneFactRecord['method'], 'almanac'>;
export type ReviewStatus = 'draft' | 'in_review' | 'approved' | 'deprecated';
export type Direction = 'supportive' | 'challenging' | 'mixed' | 'neutral';
export const topicTitles = {
  overall: '综合运势', wealth: '财运', regular_income: '固定收入', windfall: '临时机会',
  spending: '消费与支出', investment_risk: '风险复核', cooperation: '合作与分工', romance: '桃花与亲密互动',
  social_opportunity: '社交机会', relationship_communication: '关系沟通', relationship_stability: '关系稳定',
  career: '事业', learning: '学习', action: '行动与安排', family: '家庭', health_routine: '生活节奏',
  emotional_state: '情绪与感受', rest: '休息', change: '变化与调整',
} as const;
export type Topic = keyof typeof topicTitles;
export const fortuneReportSections = [
  { id: 'overall', title: '综合运势' },
  { id: 'wealth', title: '财运' },
  { id: 'romance', title: '桃花运' },
] as const;
export type FortuneGeneratedSection = {
  sectionId: typeof fortuneReportSections[number]['id']; summary: string; factIds: string[];
};
export type FortunePublishedReport = {
  reportId: string; calculationRunId: string; natalChartSnapshotId?: string;
  periodType: PreviewPeriod; sections: Omit<FortuneGeneratedSection, 'factIds'>[];
};
export type Relationship = 'single' | 'dating' | 'relationship' | 'married' | 'prefer_not_to_say';
export type InterpretationPreferences = { relationshipStatus?: Relationship; enabledTopics?: Topic[] };
export type Window = { start: string; endExclusive: string };
type Scalar = string | number | boolean;
export type Predicate =
  | { field: string; eq: Scalar }
  | { field: string; oneOf: Scalar[] }
  | { field: string; includes: Scalar }
  | { field: string; lte: number };
export type Condition = {
  id: string; factType?: string; where: Predicate[]; sharedSubject?: string; sameScope?: boolean;
  link?: { field: string; from: string; operator: 'eq' | 'includes' };
};
export type Review = { reviewStatus: ReviewStatus; reviewer?: string; reviewedAt?: string; sourceIds: string[] };
export type InterpretationSource = {
  sourceId: string; title: string; type: 'research_note' | 'expert_review' | 'classical_text' | 'official_documentation';
  licenseStatus: 'public_domain_verified' | 'licensed' | 'open_license' | 'permission_required' | 'unknown';
  allowedUse: 'internal_research' | 'rule_derivation' | 'commercial_distribution';
  locator: string;
};
export type AtomicRule = Review & {
  ruleId: string; version: string; method: Method; tradition: string;
  factTypes: string[]; scopes?: Scope[]; periods: PreviewPeriod[]; allowPartial: boolean;
  trigger: Predicate[]; required: Condition[]; supporting: Condition[]; inhibiting: Condition[]; exclusions: Condition[];
  meaning: { key: string; direction: Direction; summary: string };
  limitations: string[]; priority: number;
};
export type TopicMapping = Review & {
  mappingId: string; version: string; method: Method; interpretationKey: string; topicId: Topic;
  strength: 'direct' | 'conditional' | 'weak'; allowedDirections: Direction[];
  required?: Condition[]; excluded?: Condition[];
};
export type ActionCategory = 'yi' | 'ji' | 'accessory' | 'color' | 'direction' | 'environment' | 'behavior' | 'ritual';
export type CatalogItem = Review & {
  itemId: string; category: ActionCategory; title: string; usage: string;
  periodUsage?: Partial<Record<PreviewPeriod, string>>;
  symbolism?: string; frame?: string; material?: string;
  costLevel: 'free' | 'low' | 'optional_purchase'; safetyTags: string[];
};
export type ActionRule = Review & {
  ruleId: string; version: string; topicId: Topic; interpretationKeys: string[]; itemId: string;
  applicablePeriods: PreviewPeriod[]; rationale: string; limitations: string[];
  required?: Condition[]; exclusions?: Condition[];
};
export type Rulebook = {
  version: string; mappingVersion: string; actionVersion: string; catalogVersion: string;
  sources: InterpretationSource[]; rules: AtomicRule[]; mappings: TopicMapping[]; actions: ActionRule[]; catalog: CatalogItem[];
};
