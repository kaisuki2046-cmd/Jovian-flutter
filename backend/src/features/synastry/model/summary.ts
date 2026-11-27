import type { RelationshipType, System } from './interpretation';
import type { Direction } from './comparison';

export type SynastrySummary = Partial<Record<RelationshipType, string>>;
export type SynastrySummaryFact = {
  system: System;
  rule: string;
  direction: Direction;
  observation: string;
  sources: readonly [string, string];
  facts: Record<string, string | number>;
  chartRulesets: readonly [string, string];
};

export type SynastrySummaryRequest = { rulesVersion: string; facts: SynastrySummaryFact[] };

export const summarySystems = ['bazi', 'ziwei', 'western'] as const;

export function isSummaryFactText(value: unknown): value is string {
  return typeof value === 'string' && !/\p{Cc}/u.test(value);
}

export function isSummaryFactValue(value: unknown): value is string | number {
  return typeof value === 'number' ? Number.isFinite(value) : isSummaryFactText(value);
}

export const summarySections = [
  { type: 'family', label: '亲情' },
  { type: 'friendship', label: '友情' },
  { type: 'romance', label: '爱情' },
  { type: 'collaboration', label: '合作' },
] as const;
