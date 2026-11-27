import type { DestinyChartSnapshot } from '../../destiny';
import type { PreviewPeriod } from '../control/period-window';

export const clientFortuneRunId = 'client';

export type Method = 'bazi' | 'ziwei' | 'western' | 'almanac';
export function isFortuneMethodEnabled(period: PreviewPeriod, method: Method) {
  return period !== 'week' || method === 'western';
}

export type MethodStatus = 'completed' | 'completed_with_warnings' | 'partial' | 'unavailable' | 'failed' | 'not_supported';
export type Precision = 'second' | 'minute' | 'day' | 'range';
export type Scope = 'natal' | 'decadal' | 'minor' | 'yearly' | 'monthly' | 'daily' | 'transit' | 'progressed' | 'almanac';
export type InstantRange = { startInstant: string; endInstantExclusive: string };
export type FortuneFactInput = {
  periodType: PreviewPeriod;
  displayTimezone: string;
  weekStartsOn?: number;
  targetPeriod?: { year?: number; month?: number; weekStartDate?: string; date?: string };
};
export type FortuneReturnLocation = { returnAt: number; latitude: number; longitude: number };
export type AuthorizedFortuneInput = {
  snapshotId: string;
  profileId?: string;
  profileVersion?: string;
  createdAt?: string;
  chart?: DestinyChartSnapshot;
};
export type FortuneFactRecord = {
  factId: string;
  calculationRunId: string;
  profileId?: string;
  natalChartSnapshotId?: string;
  periodType: PreviewPeriod;
  method: Method;
  factType: string;
  scope: Scope;
  subjectIds: string[];
  activeFrom: string;
  activeTo: string;
  exactInstant?: string;
  timePrecision: Precision;
  timeZone: string;
  sourceEngine: string;
  engineVersion: string;
  rulesetVersion: string;
  parentSignalId?: string;
  sourceFactIds: string[];
  completeness: 'complete' | 'partial' | 'unavailable';
  warnings: string[];
  normalizedPayload: unknown;
};
