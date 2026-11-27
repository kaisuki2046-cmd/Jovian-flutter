import type { FortuneKnowledgeEntry, FortuneKnowledgeSourceEntry, KnowledgeHourBasis, KnowledgeMethod,
  KnowledgePrintedLuck, KnowledgeRule, KnowledgeTopic } from '../../model/fortune-knowledge';
import type { FortuneFactRecord } from '../../model/fortune-facts';
import type { FortuneAdviceOptionGroup } from '../../model/advice';
import type { FortuneAdviceThemes } from '../fortune-advice-themes';

export type FortuneKnowledgeLibrary = { version: string; entries: FortuneKnowledgeEntry[]; rules: KnowledgeRule[] };
export type EvaluatedKnowledgeQuery = { condition: string; hits: FortuneFactRecord[]; unknown: boolean };
export type EvaluatedKnowledgeExclusion = EvaluatedKnowledgeQuery & {
  uncertainFacts?: FortuneFactRecord[];
  nonExcludingFacts?: FortuneFactRecord[];
};
export type EvaluatedKnowledgeRule = {
  knowledgeId: string;
  reportTopic: KnowledgeTopic;
  period: KnowledgeRule['period'];
  hourBasis?: KnowledgeHourBasis;
  queryCount: number;
  unresolved: string[];
  sourceConditions?: string[];
  required: EvaluatedKnowledgeQuery[];
  exclusions: EvaluatedKnowledgeExclusion[];
  confirmations: (EvaluatedKnowledgeQuery & { sourceConditions: string[]; sourceExcerpt?: string })[];
};
export type FortuneAdviceMatch = { method: KnowledgeMethod; theme: string; entry: FortuneKnowledgeEntry };
export type FortuneKnowledgeReader = {
  version(method: KnowledgeMethod): string;
  library(method: KnowledgeMethod): FortuneKnowledgeLibrary;
  advice(method: KnowledgeMethod): FortuneKnowledgeEntry[];
  adviceOptions(): FortuneAdviceOptionGroup[];
  matchSelectedAdvice(id: string): FortuneAdviceMatch[];
  matchNatalAdvice(field: keyof FortuneAdviceThemes, value: string): FortuneAdviceMatch[];
  adviceHash(): string;
  entry(id: string): FortuneKnowledgeEntry | undefined;
  canonicalEntry(id: number): FortuneKnowledgeSourceEntry | undefined;
  printedLuck(id: string): KnowledgePrintedLuck[];
  evaluateRules(method: KnowledgeMethod, period: KnowledgeRule['period'], facts: FortuneFactRecord[],
    hourBasis?: KnowledgeHourBasis): EvaluatedKnowledgeRule[];
};
// The server installs its SQLite reader; Expo never imports Node storage.
let reader: FortuneKnowledgeReader | undefined;
export function installFortuneKnowledgeReader(value: FortuneKnowledgeReader) { reader = value; }
function database() {
  if (!reader) throw new Error('Fortune SQLite knowledge reader is not initialized. Use the fortune server.');
  return reader;
}
const methods = ['bazi', 'ziwei', 'western'] as const;
export function getFortuneKnowledgeEntry(id: string) { return database().entry(id); }
export function getFortunePrintedLuck(id: string) { return database().printedLuck(id); }
export function getFortuneKnowledgeVersion(method: KnowledgeMethod) { return database().version(method); }
export function evaluateFortuneRules(method: KnowledgeMethod, period: KnowledgeRule['period'], facts: FortuneFactRecord[],
  hourBasis?: KnowledgeHourBasis) {
  return database().evaluateRules(method, period, facts, hourBasis);
}
export function listFortuneAdviceOptions() { return database().adviceOptions(); }
export function matchFortuneAdviceOption(id: string) { return database().matchSelectedAdvice(id); }
export function matchFortuneNatalAdvice(field: keyof FortuneAdviceThemes, value: string) {
  return database().matchNatalAdvice(field, value);
}
export function getFortuneAdviceHash() { return database().adviceHash(); }
export const fortuneKnowledge = Object.defineProperties({}, Object.fromEntries(methods.map(method =>
  [method, { enumerable: true, get: () => database().library(method) }]))) as Record<KnowledgeMethod, FortuneKnowledgeLibrary>;
export const fortuneAdviceKnowledge = Object.defineProperties({}, Object.fromEntries(methods.map(method =>
  [method, { enumerable: true, get: () => database().advice(method) }]))) as Record<KnowledgeMethod, FortuneKnowledgeEntry[]>;
