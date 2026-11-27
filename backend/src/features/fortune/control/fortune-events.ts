import type { calculateFortuneFacts } from './fortune-facts';
import type { FortuneFactRecord } from '../model/fortune-facts';

export const fortuneEventVersion = 'fortune-event-timeline-v1';

export function buildFortuneEvents(run: ReturnType<typeof calculateFortuneFacts>, facts: FortuneFactRecord[]) {
  const events = new Map<string, {
    eventId: string; method: FortuneFactRecord['method']; scope: FortuneFactRecord['scope'];
    identityScope: 'native' | 'window'; start: string; endExclusive: string;
    factIds: string[]; exactTimes: string[]; changes: string[];
  }>();
  for (const fact of facts) {
    const payload = fact.normalizedPayload as Record<string, unknown> | null;
    const returnAt = fact.factType === 'solar_return' && payload?.returnAt;
    // Knowing one exact point does not recover the native extent of a window-
    // clipped parent event. Keep its identity scoped to this query window.
    const native = fact.parentSignalId?.includes(':clipped:') ? undefined
      : (fact.method === 'western' && fact.parentSignalId ? fact.parentSignalId : undefined) || returnAt || fact.exactInstant;
    const identity = fact.parentSignalId || native;
    const key = JSON.stringify([run.natalChartSnapshotId, fact.method, fact.rulesetVersion,
      fact.subjectIds, identity || [fact.factType, fact.scope, fact.activeFrom, fact.activeTo, payload]]);
    const event = events.get(key) ?? {
      eventId: key, method: fact.method, scope: fact.scope, identityScope: native ? 'native' : 'window',
      start: fact.activeFrom, endExclusive: fact.activeTo, factIds: [], exactTimes: [], changes: [],
    };
    event.start = event.start < fact.activeFrom ? event.start : fact.activeFrom;
    event.endExclusive = event.endExclusive > fact.activeTo ? event.endExclusive : fact.activeTo;
    event.factIds.push(fact.factId);
    if (fact.exactInstant && !event.exactTimes.includes(fact.exactInstant)) event.exactTimes.push(fact.exactInstant);
    if (payload?.ingressInstant) event.changes.push(String(payload.ingressInstant));
    if (payload?.egressInstant) event.changes.push(String(payload.egressInstant));
    events.set(key, event);
  }
  return [...events.values()].map(event => ({ ...event, exactTimes: event.exactTimes.sort(),
    changes: [...new Set(event.changes)].sort(),
    phase: event.exactTimes.length || event.changes.length ? 'trigger' as const : 'continuing' as const,
  })).sort((a, b) => a.start.localeCompare(b.start) || a.eventId.localeCompare(b.eventId));
}
