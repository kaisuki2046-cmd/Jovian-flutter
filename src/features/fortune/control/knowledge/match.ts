import type { calculateFortuneFacts } from '../fortune-facts';
import { eligibleFacts, requestForFortuneRun } from '../fortune-interpretation';
import { isFortuneMethodEnabled, type FortuneFactRecord } from '../../model/fortune-facts';
import type { KnowledgeMethod, KnowledgeQuery, KnowledgeMatch } from '../../model/fortune-knowledge';
import { evaluateFortuneRules, type EvaluatedKnowledgeExclusion, type EvaluatedKnowledgeRule, type FortuneKnowledgeLibrary } from './catalog';
import { buildDisplayWindow } from '../period-window';
import { evaluateFortunePredicate } from './predicate.mjs';

export const knowledgeMatcherVersion = 'fortune-knowledge-matcher-v15';
export const knowledgeMethods = ['bazi', 'ziwei', 'western'] as const;

function applicable(fact: FortuneFactRecord, query: KnowledgeQuery) {
  return fact.factType === query.factType && (!query.scope || fact.scope === query.scope)
    && (!query.scopes || query.scopes.includes(fact.scope));
}
function evaluateFixtureQuery(facts: FortuneFactRecord[], query: KnowledgeQuery, isExclusion = false): EvaluatedKnowledgeExclusion {
  const candidates = facts.filter(fact => applicable(fact, query));
  const hits: FortuneFactRecord[] = [], uncertainFacts: FortuneFactRecord[] = [], nonExcludingFacts: FortuneFactRecord[] = [];
  let unknown = !candidates.length;
  for (const fact of candidates) {
    const result = evaluateFortunePredicate(fact, query);
    if (result === true) hits.push(fact);
    else if (result === undefined) {
      unknown = true;
      if (isExclusion) uncertainFacts.push(fact);
    } else if (isExclusion) nonExcludingFacts.push(fact);
  }
  return { condition: JSON.stringify(query), hits, unknown,
    ...(isExclusion && unknown ? { uncertainFacts, nonExcludingFacts } : {}) };
}

// Explicit in-memory libraries are fixtures. The service always uses SQLite.
function evaluateFixture(library: FortuneKnowledgeLibrary, period: string, facts: FortuneFactRecord[]): EvaluatedKnowledgeRule[] {
  const entries = new Map(library.entries.map(entry => [entry.id, entry]));
  return library.rules.map(rule => {
    const entry = entries.get(rule.knowledgeId)!;
    const reportTopic = entry.reportTopic ?? (entry.category.topic === '财富' ? 'wealth'
      : entry.category.topic === '爱情' ? 'romance' : 'overall');
    const active = rule.period === period && rule.queries.length > 0;
    const confirmations = Array.isArray(rule.confirmedWhen) ? rule.confirmedWhen : rule.confirmedWhen ? [rule.confirmedWhen] : [];
    return { knowledgeId: rule.knowledgeId, reportTopic, period: rule.period,
      queryCount: rule.queries.length, unresolved: rule.unresolved,
      sourceConditions: rule.sourceConditions,
      required: active ? rule.queries.map(query => evaluateFixtureQuery(facts, query)) : [],
      exclusions: active ? (rule.unless ?? []).map(query => evaluateFixtureQuery(facts, query, true)) : [],
      confirmations: active ? confirmations.map(query => ({ ...evaluateFixtureQuery(facts, query),
        sourceConditions: query.sourceConditions, sourceExcerpt: query.sourceExcerpt })) : [] };
  });
}

type MatchWindow = KnowledgeMatch['windows'][number];
function mergeWindows(spans: MatchWindow[]) {
  const result: MatchWindow[] = [];
  for (const window of spans.toSorted((a, b) => a.start.localeCompare(b.start))) {
    const last = result.at(-1);
    if (last && window.start <= last.endExclusive) {
      if (window.endExclusive > last.endExclusive) last.endExclusive = window.endExclusive;
    } else result.push({ ...window });
  }
  return result;
}

function subtractWindows(windows: MatchWindow[], excluded: MatchWindow[]) {
  return excluded.reduce((ranges, cut) => ranges.flatMap(range => {
    if (cut.endExclusive <= range.start || range.endExclusive <= cut.start) return [range];
    return [
      ...(range.start < cut.start ? [{ start: range.start, endExclusive: cut.start }] : []),
      ...(cut.endExclusive < range.endExclusive ? [{ start: cut.endExclusive, endExclusive: range.endExclusive }] : []),
    ];
  }), windows);
}

function commonWindows(groups: FortuneFactRecord[][], run: ReturnType<typeof calculateFortuneFacts>, daily: boolean) {
  let windows = [{ start: run.time.displayWindow.instantRange.startInstant,
    endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }];
  for (const group of groups) {
    windows = mergeWindows(windows.flatMap(window => group.flatMap(fact => {
      const day = daily && fact.exactInstant ? buildDisplayWindow(Date.parse(fact.exactInstant), 'day',
        { timeZone: run.time.displayWindow.timezone }) : undefined;
      const start = [window.start, fact.activeFrom, ...(day ? [new Date(day.start).toISOString()] : [])].sort().at(-1)!;
      const endExclusive = [window.endExclusive, fact.activeTo, ...(day ? [new Date(day.end).toISOString()] : [])].sort()[0];
      return start < endExclusive ? [{ start, endExclusive }] : [];
    })));
  }
  return windows;
}

export function matchFortuneKnowledge(run: ReturnType<typeof calculateFortuneFacts>,
  libraries?: Record<KnowledgeMethod, FortuneKnowledgeLibrary>) {
  const { compatible } = eligibleFacts(run, requestForFortuneRun(run));
  const period = run.time.displayWindow.periodType;
  const result = {} as Record<KnowledgeMethod, KnowledgeMatch[]>;
  for (const method of knowledgeMethods) {
    const facts = compatible.filter(fact => fact.method === method);
    const rules = libraries ? evaluateFixture(libraries[method], period, facts) : evaluateFortuneRules(method, period, facts);
    result[method] = rules.map(rule => {
      const base = { knowledgeId: rule.knowledgeId, method, sectionId: rule.reportTopic,
        sourceFactIds: [], windows: [], missingConditions: [], unresolvedConditions: rule.unresolved } satisfies Omit<KnowledgeMatch, 'status'>;
      if (rule.period !== period || !isFortuneMethodEnabled(period, method)) return { ...base, status: 'not_applicable' };
      if (!rule.queryCount) return { ...base, status: 'unsupported' };
      if (rule.required.length !== rule.queryCount) throw new Error('Incomplete fortune rule index: ' + rule.knowledgeId);
      const groups = rule.required.map(({ hits }) => hits);
      const missing = rule.required.filter(({ hits }) => !hits.length);
      const missingConditions = missing.map(({ condition }) => condition);
      const unknown = missing.some(query => query.unknown);
      const disproved = missing.some(query => !query.unknown);
      const daily = rule.period === 'day';
      const windows = missingConditions.length ? [] : commonWindows(groups, run, daily);
      const counter = rule.exclusions.flatMap(query => query.hits)
        .map(fact => ({ start: fact.activeFrom, endExclusive: fact.activeTo }));
      const remaining = subtractWindows(windows, counter);
      // A missing exclusion verdict must not erase a disjoint window that has its own negative verdict.
      const unverified = mergeWindows(rule.exclusions.flatMap(query => !query.unknown || !remaining.length ? [] : [
        ...subtractWindows(remaining, commonWindows([query.nonExcludingFacts ?? []], run, daily)),
        ...commonWindows([query.uncertainFacts ?? []], run, daily),
      ]));
      const verifiedRemaining = subtractWindows(remaining, unverified);
      const status = disproved ? 'not_matched' : unknown ? 'unknown' : missingConditions.length || !windows.length ? 'not_matched'
        : !remaining.length ? 'excluded' : !verifiedRemaining.length ? 'unknown' : rule.unresolved.length ? 'partial' : 'matched';
      const idsForWindows = (facts: FortuneFactRecord[], spans: MatchWindow[]) => [...new Set(facts.filter(fact =>
        spans.some(window => fact.activeFrom < window.endExclusive && window.start < fact.activeTo)).map(fact => fact.factId))];
      if ((status === 'partial' || status === 'matched') && rule.confirmations.length) {
        const confirmed = rule.confirmations.flatMap(branch => {
          if (!branch.hits.length) return [];
          const ids = new Set(branch.hits.map(fact => fact.factId));
          // A branch must refine the same anchor fact that satisfied the base query.
          const branchGroups = [groups[0].filter(fact => ids.has(fact.factId)), ...groups.slice(1)];
          const spans = subtractWindows(commonWindows(branchGroups, run, daily), [...counter, ...unverified]);
          return spans.length ? [{ conditions: branch.sourceConditions, windows: spans,
            sourceFactIds: idsForWindows(branchGroups.flat(), spans), sourceExcerpt: branch.sourceExcerpt }] : [];
        });
        if (confirmed.length) {
          const verifiedWindows = mergeWindows(confirmed.flatMap(branch => branch.windows));
          const candidateWindows = subtractWindows(remaining, verifiedWindows);
          const confirmedIds = new Set(confirmed.flatMap(branch => branch.sourceFactIds));
          const candidateFactIds = idsForWindows(groups.flat(), remaining).filter(id => !confirmedIds.has(id));
          const excerpts = [...new Set(confirmed.flatMap(branch => branch.sourceExcerpt ?? []))];
          return { ...base, status: 'matched', windows: verifiedWindows,
            sourceFactIds: [...confirmedIds],
            ...(candidateFactIds.length ? { candidateFactIds } : {}),
            ...(confirmed.length === 1 ? { matchedConditions: confirmed[0].conditions }
              : { confirmedBranches: confirmed.map(({ sourceExcerpt: _excerpt, ...branch }) => branch) }),
            ...(excerpts.length ? { matchedSourceExcerpt: excerpts.join('\n') } : {}),
            ...(candidateWindows.length ? { candidateWindows } : { unresolvedConditions: [] }) };
        }
        if (status === 'matched') {
          return { ...base, status: 'unknown', sourceFactIds: idsForWindows(groups.flat(), remaining), windows: remaining };
        }
      }
      const hasUsableEvidence = status === 'matched' || status === 'partial';
      const effectiveWindows = hasUsableEvidence ? verifiedRemaining : remaining;
      const evidenceWindows = hasUsableEvidence && unverified.length ? effectiveWindows : windows;
      return { ...base, status, sourceFactIds: idsForWindows(groups.flat(), evidenceWindows), windows: effectiveWindows, missingConditions,
        ...(status === 'matched' && rule.sourceConditions ? { matchedConditions: rule.sourceConditions } : {}) };
    });
  }
  return { version: knowledgeMatcherVersion, byMethod: result };
}
