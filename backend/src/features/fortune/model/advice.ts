import type { KnowledgeMethod } from './fortune-knowledge';

export type FortuneAdviceGroup = { kind: '数字' | '饰品' | '颜色'; items: {
  method: KnowledgeMethod; theme: string; reason: string;
  options: string[]; knowledgeId: string; source: string; limitations: string[];
}[] };

export type FortuneAdvice = {
  version: 1; calculationRunId: string; snapshotId: string; periodType: string;
  groups: FortuneAdviceGroup[];
};

export type FortuneAdviceOption = { id: string; label: string };
export type FortuneAdviceOptionGroup = FortuneAdviceOption & { method: KnowledgeMethod; options: FortuneAdviceOption[] };
export type FortuneSelectedAdvice = { version: 1; optionId: string; groups: FortuneAdviceGroup[] };
