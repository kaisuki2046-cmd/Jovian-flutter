import type { FortuneFactRecord } from './fortune-facts';
import type { PreviewPeriod } from '../control/period-window';

export type KnowledgeMethod = 'bazi' | 'ziwei' | 'western';
export type KnowledgeTopic = 'overall' | 'wealth' | 'romance';
export type KnowledgePeriod = PreviewPeriod | 'hour';
export type KnowledgeHourBasis = 'shichen' | 'clockHour';
type KnowledgeAdvice = { kind: '数字' | '颜色' | '饰品'; options: string[]; basis: string };

export type FortuneKnowledgeEntry = {
  id: string; title: string; reportTopic?: KnowledgeTopic; category: { kind?: string; topic: string; tags: string[] };
  source: { book: string; author: string | null; edition: string; passage_id: string; url: string; [key: string]: unknown };
  evidence: { original_text: string; context: string };
  conditions: { original: string[]; normalized: string[]; excluded: string[]; uncertain: string[] };
  interpretation: { classical_meaning: string; limitations: string[];
    advice?: KnowledgeAdvice };
};
export type KnowledgeFilter = Record<string, string | boolean | number | { includes?: string | number;
  includesAll?: (string | number)[]; includesAny?: (string | number)[];
  oneOf?: (string | number)[]; gte?: number }>;
type KnowledgeScope = FortuneFactRecord['scope'] | 'hourly';
export type KnowledgeQuery = {
  factType: string; scope?: KnowledgeScope; scopes?: KnowledgeScope[]; minimumDurationHours?: number;
  where: KnowledgeFilter; anyOf?: KnowledgeFilter[];
};
type KnowledgeConfirmation = KnowledgeQuery & { sourceConditions: string[]; sourceExcerpt?: string };
export type KnowledgePrintedLuck = {
  name: string;
  natalPillarSequence: string;
  premise: string;
  periods: { pillars: string[]; assessment: string }[];
};
type KnowledgeConditions = {
  queries: KnowledgeQuery[]; unresolved: string[];
  unless?: KnowledgeQuery[];
  sourceConditions?: string[];
  confirmedWhen?: KnowledgeConfirmation | KnowledgeConfirmation[];
  review?: { sourcePassageId: string; sourceHash: string; ruleHash?: string; mappedConditions: string[]; supportingSources?: string[];
    printedLuck?: KnowledgePrintedLuck[];
    additionalSourceExcerpts?: string[];
    sourceCorrections?: { normalizedTextConflict: string[]; basis: string; sourceURL: string; originalJSONPreserved: boolean } };
};
type KnowledgeTiming = { period: 'hour'; hourBasis: KnowledgeHourBasis }
  | { period: Exclude<KnowledgePeriod, 'hour'>; hourBasis?: never };
export type KnowledgeRule = { knowledgeId: string } & KnowledgeTiming & KnowledgeConditions;

type KnowledgeSourceCategory = { method: KnowledgeMethod; topic: KnowledgeTopic };
export type FortuneKnowledgeSourceEntry = {
  id: number;
  source: { book: string; locator: string; url: string | null };
  originalText: string | null;
  matchConditions: { status: 'mapped' | 'unmapped'; original: string[];
    formatted: KnowledgeConditions & { unless: KnowledgeQuery[] } };
  modernInterpretation: string | null;
  legacyId?: string;
} & (
  | { category: KnowledgeSourceCategory & KnowledgeTiming & { contentType: '解读' }; advice?: never }
  | { category: KnowledgeSourceCategory & (KnowledgeTiming | { period: null; hourBasis?: never }) & { contentType: '建议' };
    advice: KnowledgeAdvice }
);
type KnowledgeWindow = { start: string; endExclusive: string };
export type KnowledgeMatch = {
  knowledgeId: string; method: KnowledgeMethod; sectionId: KnowledgeTopic;
  status: 'matched' | 'partial' | 'unknown' | 'excluded' | 'not_matched' | 'unsupported' | 'not_applicable';
  sourceFactIds: string[]; windows: KnowledgeWindow[];
  candidateWindows?: KnowledgeWindow[];
  candidateFactIds?: string[];
  matchedConditions?: string[];
  confirmedBranches?: { conditions: string[]; windows: KnowledgeWindow[]; sourceFactIds: string[] }[];
  matchedSourceExcerpt?: string;
  missingConditions: string[]; unresolvedConditions: string[];
};
