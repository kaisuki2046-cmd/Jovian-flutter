import type { SynastryChartSnapshot } from '../../account';
import type { comparisonDirections, FactScope } from './algorithm-profiles';

export const comparisonRulesVersion = 'synastry-facts-v3';

export type ChartFacts = Pick<SynastryChartSnapshot, 'calculatedAt' | 'bazi' | 'ziwei' | 'western' | 'birthContext'>;
export type ComparisonSubject =
  | { mode: 'account_owner' | 'invited_account'; chart: SynastryChartSnapshot }
  | { mode: 'manual_subject'; chart: ChartFacts };

export type Direction = typeof comparisonDirections[number];
export type ComparisonCoverage = 'complete' | 'limited' | 'unavailable';
export type Evidence = {
  rule: string;
  direction: Direction;
  sources: readonly [string, string];
  observation: string;
  facts: Readonly<Record<string, string | number>>;
  ruleVersion?: string;
  scope?: FactScope;
  layer?: 'natal' | 'composite';
  calculationProfileId?: string;
  methodRefs?: string[];
  limitations?: string[];
};

export type ComparisonSection = {
  system: 'bazi' | 'ziwei' | 'western';
  versions: readonly [string, string];
  evidence: Evidence[];
  coverage: ComparisonCoverage;
  limitation?: string;
  coverageNotes?: readonly string[];
  unavailableRules?: readonly string[];
};
