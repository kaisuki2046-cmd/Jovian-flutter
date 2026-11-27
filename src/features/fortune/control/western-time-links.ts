import { SearchMoonPhase } from 'astronomy-engine';
import type { FortuneFactRecord } from '../model/fortune-facts';
import { readTransitLongitude } from './solar-transits';

const day = 86_400_000;
export const westernTimeLinksPolicy = {
  version: 'western-source-time-links-v1', lunation: 'actual-new-moon-until-next-new-moon',
  lunationPrecision: 'nearest-second-canonical-boundary',
  overlap: 'same-natal-target-and-intersecting-complete-intervals-no-nature-or-direction-inference',
} as const;
export function buildLunationWindows(window: { start: number; end: number }) {
  if (!Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end) || window.start >= window.end
    || window.end - window.start > 368 * day) throw new RangeError('Invalid lunation window');
  const firstRoot = SearchMoonPhase(0, new Date(window.start - 32 * day), 35)?.date.getTime();
  if (firstRoot === undefined || firstRoot > window.start) throw new Error('Missing preceding lunation');
  let first: number = Math.round(firstRoot / 1_000) * 1_000;
  const rows = [];
  for (let count = 0; first < window.end; count++) {
    if (count > 15) throw new Error('Invalid lunation sequence');
    const found = SearchMoonPhase(0, new Date(first + day), 35)?.date.getTime();
    const next: number | undefined = found === undefined ? undefined : Math.round(found / 1_000) * 1_000;
    if (next === undefined || next <= first || next - first > 32 * day) throw new Error('Missing following lunation');
    const start = Math.max(window.start, first), end = Math.min(window.end, next);
    if (start < end) rows.push({ start, end, newMoonAt: first, nextNewMoonAt: next,
      longitude: readTransitLongitude('Sun', first), zodiac: 'tropical',
      startsBeforeQuery: first < window.start, endsAfterQuery: next > window.end });
    first = next;
  }
  return rows;
}

export function westernProgressionTransitOverlaps(facts: FortuneFactRecord[]) {
  const progressed = facts.filter(f => f.method === 'western' && f.factType === 'progressed_aspect' && f.scope === 'progressed' && f.completeness === 'complete');
  const transits = facts.filter(f => f.method === 'western' && f.factType === 'aspect_interval' && f.scope === 'transit' && f.completeness === 'complete');
  return progressed.flatMap(first => {
    const p = first.normalizedPayload as Record<string, unknown>;
    if (!first.calculationRunId || !first.natalChartSnapshotId || p.kind !== 'secondary' || p.targetKind !== 'natal'
      || p.zodiac !== 'tropical' || typeof p.natalTargetId !== 'string') return [];
    return transits.flatMap(second => {
      const t = second.normalizedPayload as Record<string, unknown>;
      if (t.natalTargetId !== p.natalTargetId || t.zodiac !== p.zodiac || !['planet', 'angle'].includes(String(t.natalTargetType))
        || first.calculationRunId !== second.calculationRunId || first.natalChartSnapshotId !== second.natalChartSnapshotId
        || first.profileId !== second.profileId || first.periodType !== second.periodType) return [];
      const start = Math.max(Date.parse(first.activeFrom), Date.parse(second.activeFrom));
      const end = Math.min(Date.parse(first.activeTo), Date.parse(second.activeTo));
      if (!(start < end)) return [];
      return [{ start, end, progressedBody: p.progressedBody, progressedAspectType: p.aspectType,
        transitBody: t.transitBody, transitAspectType: t.aspectType, natalTargetId: p.natalTargetId,
        progressionFactId: first.factId, transitFactId: second.factId,
        sourceFactIds: [...new Set([...first.sourceFactIds, ...second.sourceFactIds])],
        overlapOnly: true, kind: 'secondary', zodiac: 'tropical' }];
    });
  });
}
