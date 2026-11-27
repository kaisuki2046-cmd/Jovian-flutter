import { validateFortuneFacts, factLayerVersion, factPolicies } from './fortune-facts';
import type { calculateFortuneFacts } from './fortune-facts';
import { isFortuneMethodEnabled, type FortuneFactRecord } from '../model/fortune-facts';
import { topicTitles, type AtomicRule, type CatalogItem, type Condition, type Direction, type InterpretationPreferences,
  type FortuneGeneratedSection, type Method, type Predicate, type Rulebook, type Topic, type TopicMapping, type Window } from '../model/interpretation';
import { builtinFortuneRulebook } from './interpretation-rules';
import { canUse, unsafeLanguage, validCatalog, type RuleMode } from './interpretation-registry';
import type { KnowledgeMatch, KnowledgeMethod } from '../model/fortune-knowledge';

type FactRun = ReturnType<typeof calculateFortuneFacts>;
type Request = {
  calculationRunId: string; natalChartSnapshotId?: string; profileId?: string;
  periodType: FactRun['time']['displayWindow']['periodType'];
  displayWindow: Window & { timezone: string };
  preferences?: InterpretationPreferences;
};
type Candidate = {
  candidateId: string; calculationRunId: string; periodType: Request['periodType'];
  method: Method; tradition: string; ruleId: string; ruleVersion: string; interpretationKey: string;
  sourceIds: string[]; sourceFactIds: string[]; anchorFactId: string; group: string;
  direction: Direction; summary: string; activeWindow: Window;
  requiredConditionsMet: string[]; supportingConditionsMet: string[]; inhibitingConditionsMet: string[];
  excluded: boolean; exclusionReasons: string[]; limitations: string[]; priority: number;
};
type Evidence = {
  evidenceId: string; topicId: Topic; method: Method; sourceFactIds: string[]; candidateIds: string[];
  ruleIds: string[]; mappingIds: string[]; sourceIds: string[]; direction: Direction; activeWindow: Window;
  strength: TopicMapping['strength']; interpretationKey: string; summary: string; group: string;
  counterConditions: string[]; conditionsMet: string[]; limitations: string[]; weight: number;
};
type Conflict = {
  conflictId: string; topicId: Topic; conflictType: 'direction' | 'time' | 'condition' | 'method_semantics' | 'data';
  evidenceIds: string[]; affectedWindow?: Window;
  resolution: 'preserve_both' | 'split_by_time' | 'exclude_unreliable' | 'downgrade_to_mixed';
  explanation: string;
};
type TopicJudgment = {
  topicId: Topic; title: string; direction: Direction;
  consensus: 'multi_method_aligned' | 'two_method_aligned' | 'single_method'
    | 'mixed_signals' | 'conflicted' | 'insufficient_evidence';
  summary: string; evidenceIds: string[]; conflictIds: string[]; activeWindow: Window; rank: number;
};
type Action = {
  item: CatalogItem; ruleId: string; ruleVersion: string; topicId: Topic; evidenceIds: string[];
  activeWindow: Window; text: string; sourceIds: string[]; sourceFactIds: string[];
  conditionsMet: string[]; rationale: string; limitations: string[];
  source: 'personal_interpretation';
};
const ontologyVersion = 'fortune-topic-ontology-v1';
const conflictVersion = 'fortune-conflicts-v1';
const aggregationVersion = 'fortune-period-aggregation-v1';
const contentVersion = 'fortune-template-zh-v1';
const phaseLabels = { year: '年度', month: '月内', week: '周内', day: '今日' } as const;
const strengthRank = { weak: 0, conditional: 1, direct: 2 };
const unique = <T>(items: T[]) => [...new Set(items)];
const intersects = (a: Window, b: Window) => a.start < b.endExclusive && b.start < a.endExclusive;
const interval = (fact: FortuneFactRecord) => ({ start: fact.activeFrom, endExclusive: fact.activeTo });
const conditionInterval = (fact: FortuneFactRecord) => fact.exactInstant
  ? { start: fact.exactInstant, endExclusive: new Date(Date.parse(fact.exactInstant) + 1).toISOString() }
  : interval(fact);
function overlap(a: Window, b: Window): Window {
  return { start: a.start > b.start ? a.start : b.start, endExclusive: a.endExclusive < b.endExclusive ? a.endExclusive : b.endExclusive };
}
function field(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((entry, key) =>
    entry !== null && typeof entry === 'object' && Object.hasOwn(entry, key)
      ? (entry as Record<string, unknown>)[key] : undefined, value);
}
function matches(fact: FortuneFactRecord, predicates: Predicate[]) {
  return predicates.every(item => {
    const value = field(fact, item.field);
    if ('eq' in item) return value === item.eq;
    if ('oneOf' in item) return item.oneOf.some(option => option === value);
    if ('includes' in item) return Array.isArray(value) && value.includes(item.includes);
    return typeof value === 'number' && value <= item.lte;
  });
}
function candidateSubject(fact: FortuneFactRecord) {
  return fact.subjectIds.find(id => id.startsWith(fact.method + ':candidate:'));
}
function relations(condition: Condition, anchor: FortuneFactRecord, candidates: FortuneFactRecord[], window: Window,
  allowPartial: boolean) {
  const choices = condition.factType ? candidates : [anchor];
  return choices.filter(fact => fact.method === anchor.method
    && (!condition.factType || (fact.factType === condition.factType && fact.factId !== anchor.factId))
    && (allowPartial || fact.completeness === 'complete')
    && (!condition.sameScope || fact.scope === anchor.scope) && intersects(conditionInterval(fact), window)
    && (condition.sharedSubject === undefined || (condition.sharedSubject === 'candidate'
      ? Boolean(candidateSubject(anchor)) && candidateSubject(anchor) === candidateSubject(fact)
      : anchor.subjectIds.includes(condition.sharedSubject) && fact.subjectIds.includes(condition.sharedSubject)))
    && matches(fact, condition.where)
    && (!condition.link || (() => {
      const left = field(fact, condition.link.field);
      const right = field(anchor, condition.link.from);
      return right !== undefined && (condition.link.operator === 'eq' ? left === right : Array.isArray(left) && left.includes(right));
    })()));
}

export function eligibleFacts(run: FactRun, request: Request) {
  const window = request.displayWindow;
  const display = run.time.displayWindow;
  if (run.version !== factLayerVersion || run.calculationRunId !== request.calculationRunId
    || run.natalChartSnapshotId !== request.natalChartSnapshotId || run.profileId !== request.profileId
    || display.periodType !== request.periodType || display.timezone !== window.timezone
    || display.instantRange.startInstant !== window.start || display.instantRange.endInstantExclusive !== window.endExclusive) {
    throw new Error('Interpretation input does not match calculation snapshot');
  }
  validateFortuneFacts(run);
  const subjects = new Map<Method, Set<string>>();
  for (const fact of run.facts) {
    if (fact.method === 'almanac' || !isFortuneMethodEnabled(request.periodType, fact.method)) continue;
    const id = candidateSubject(fact);
    const ids = subjects.get(fact.method) ?? new Set();
    if (id) ids.add(id);
    subjects.set(fact.method, ids);
  }
  const incompatible = new Set<Method>();
  const inWindow = run.facts.filter(fact => {
    if (fact.method === 'almanac' || !isFortuneMethodEnabled(request.periodType, fact.method)
      || !run.natalChartSnapshotId || fact.completeness === 'unavailable') return false;
    const method = run.methods[fact.method];
    if (!['completed', 'completed_with_warnings', 'partial'].includes(method.status)) return false;
    const policy = factPolicies[fact.method];
    if (fact.calculationRunId !== request.calculationRunId || fact.natalChartSnapshotId !== request.natalChartSnapshotId
      || fact.profileId !== request.profileId || fact.periodType !== request.periodType
      || fact.engineVersion !== policy.version || fact.sourceEngine !== policy.engine || fact.rulesetVersion !== policy.rules) {
      incompatible.add(fact.method);
      return false;
    }
    const isCandidate = Boolean(candidateSubject(fact));
    return intersects(interval(fact), window) && (!fact.exactInstant
      || (window.start <= fact.exactInstant && fact.exactInstant < window.endExclusive))
      && !(isCandidate && fact.method === 'ziwei' && method.warnings.includes('候选盘分别保留'));
  });
  const compatible: FortuneFactRecord[] = [];
  const candidateTenGods = new Map<string, FortuneFactRecord[]>();
  for (const fact of inWindow) {
    const method = fact.method as Method;
    if (incompatible.has(method)) continue;
    if (!candidateSubject(fact) || (subjects.get(method)?.size ?? 0) <= 1) {
      compatible.push(fact);
    } else if (method === 'bazi' && fact.factType === 'ten_god' && fact.completeness === 'complete') {
      const [dayMaster, stem, tenGod] = ['dayMaster', 'stem', 'tenGod']
        .map(key => field(fact, 'normalizedPayload.' + key));
      if (![dayMaster, stem, tenGod].every(value => typeof value === 'string' && value.length > 0)) continue;
      const key = JSON.stringify([fact.scope, fact.activeFrom, fact.activeTo, dayMaster, stem, tenGod]);
      const group = candidateTenGods.get(key) ?? [];
      group.push(fact);
      candidateTenGods.set(key, group);
    }
  }
  const agreedTenGods = [...candidateTenGods.values()]
    .filter(group => new Set(group.map(candidateSubject)).size === subjects.get('bazi')?.size);
  return { compatible, incompatible, subjects, agreedTenGods };
}

function slicesFor(anchor: FortuneFactRecord, related: FortuneFactRecord[], window: Window, conditions: Condition[],
  allowPartial: boolean) {
  const cuts = new Set([window.start, window.endExclusive]);
  for (const condition of conditions) {
    for (const fact of relations(condition, anchor, related, window, allowPartial)) {
      const active = overlap(conditionInterval(fact), window);
      cuts.add(active.start);
      cuts.add(active.endExclusive);
    }
  }
  const bounds = [...cuts].sort();
  return bounds.slice(1).map((endExclusive, index) => ({ start: bounds[index], endExclusive }));
}

function evaluateRule(rule: AtomicRule, anchor: FortuneFactRecord, related: FortuneFactRecord[], request: Request) {
  const window = overlap(conditionInterval(anchor), request.displayWindow);
  const conditions = [...rule.required, ...rule.supporting, ...rule.inhibiting, ...rule.exclusions];
  return slicesFor(anchor, related, window, conditions, rule.allowPartial)
    .map(slice => evaluateSlice(rule, anchor, related, request, slice));
}

function evaluateSlice(rule: AtomicRule, anchor: FortuneFactRecord, related: FortuneFactRecord[], request: Request, window: Window) {
  const used: string[] = [anchor.factId];
  const requiredConditionsMet: string[] = [];
  const exclusionReasons: string[] = [];
  for (const condition of rule.required) {
    const match = relations(condition, anchor, related, window, rule.allowPartial)
      .sort((a, b) => a.activeFrom.localeCompare(b.activeFrom) || a.factId.localeCompare(b.factId))[0];
    if (!match) { exclusionReasons.push('缺少条件 ' + condition.id); continue; }
    requiredConditionsMet.push(condition.id);
    used.push(match.factId);
  }
  function test(conditions: Condition[]) {
    return conditions.flatMap(condition => {
      const hits = relations(condition, anchor, related, window, rule.allowPartial);
      if (!hits.length) return [];
      used.push(...hits.map(fact => fact.factId));
      return [condition.id];
    });
  }
  exclusionReasons.push(...test(rule.exclusions).map(id => '排除条件 ' + id));
  const supportingConditionsMet = test(rule.supporting);
  const inhibitingConditionsMet = test(rule.inhibiting);
  const candidate: Candidate = {
    candidateId: rule.ruleId + ':' + anchor.factId + ':' + window.start,
    calculationRunId: request.calculationRunId, periodType: request.periodType,
    ruleId: rule.ruleId, ruleVersion: rule.version, method: rule.method, tradition: rule.tradition, sourceIds: rule.sourceIds,
    interpretationKey: rule.meaning.key, direction: rule.meaning.direction, summary: rule.meaning.summary,
    sourceFactIds: unique(used), anchorFactId: anchor.factId, group: anchor.parentSignalId ?? (
      anchor.method === 'bazi' ? anchor.sourceFactIds.join('|') : anchor.sourceFactIds[0]),
    activeWindow: window, requiredConditionsMet, supportingConditionsMet, inhibitingConditionsMet,
    excluded: exclusionReasons.length > 0, exclusionReasons, limitations: unique([...rule.limitations, ...anchor.warnings]),
    priority: rule.priority,
  };
  return candidate;
}

function weight(candidate: Candidate, fact: FortuneFactRecord, period: Request['periodType'], referenceAt: number) {
  const duration = Date.parse(candidate.activeWindow.endExclusive) - Date.parse(candidate.activeWindow.start);
  const days = duration / 86_400_000;
  const slow = field(fact, 'normalizedPayload.slowTransit') === true;
  const active = Date.parse(candidate.activeWindow.start) <= referenceAt && referenceAt < Date.parse(candidate.activeWindow.endExclusive);
  const timing = period === 'year' ? (fact.scope === 'decadal' || fact.scope === 'yearly' ? 3 : slow && days >= 30 ? 2 : 0)
    : period === 'month' ? (fact.scope === 'monthly' || days >= 5 ? 2 : fact.exactInstant ? 1 : 0)
    : period === 'week' ? (days >= 3 ? 2 : days >= 1 ? 1 : 0)
    : active ? 2 : Date.parse(candidate.activeWindow.start) >= referenceAt ? 1 : 0;
  return candidate.priority + timing;
}

function topicEvidence(candidates: Candidate[], anchors: Map<string, FortuneFactRecord>, book: Rulebook,
  request: Request, mode: RuleMode, referenceAt: number, byMethod: Map<string, FortuneFactRecord[]>) {
  const byKey = new Map<string, Evidence[]>();
  const byMeaning = new Map<string, TopicMapping[]>();
  for (const mapping of book.mappings) {
    if (!canUse(mapping, book, mode)) continue;
    const key = mapping.method + ':' + mapping.interpretationKey;
    const entries = byMeaning.get(key) ?? [];
    entries.push(mapping);
    byMeaning.set(key, entries);
  }
  for (const candidate of candidates) {
    if (candidate.excluded) continue;
    const anchor = anchors.get(candidate.anchorFactId)!;
    for (const mapping of byMeaning.get(candidate.method + ':' + candidate.interpretationKey) ?? []) {
      if (!mapping.allowedDirections.includes(candidate.direction)
        || (request.preferences?.enabledTopics && !request.preferences.enabledTopics.includes(mapping.topicId))) continue;
      const related = byMethod.get(candidate.method) ?? [];
      const required = mapping.required ?? [];
      const excluded = mapping.excluded ?? [];
      for (const window of slicesFor(anchor, related, candidate.activeWindow, [...required, ...excluded], false)) {
        const requiredFacts = required.map(condition => relations(condition, anchor, related, window, false)[0]);
        if (requiredFacts.some(fact => !fact)
          || excluded.some(condition => relations(condition, anchor, related, window, false).length)) continue;
        const direction = candidate.inhibitingConditionsMet.length && candidate.direction !== 'neutral' ? 'mixed' : candidate.direction;
        const score = weight({ ...candidate, activeWindow: window }, anchor, request.periodType, referenceAt)
          + strengthRank[mapping.strength];
        const conditions = [...candidate.requiredConditionsMet, ...candidate.supportingConditionsMet, ...required.map(item => item.id)];
        const sourceFactIds = unique([...candidate.sourceFactIds, ...requiredFacts.map(item => item.factId)]);
        const key = JSON.stringify([mapping.topicId, candidate.method, candidate.group, candidate.interpretationKey,
          direction, mapping.strength, conditions]);
        const group = byKey.get(key) ?? [];
        group.push({ evidenceId: 'e:' + candidate.candidateId + ':' + mapping.mappingId + ':' + window.start,
          topicId: mapping.topicId, method: candidate.method, candidateIds: [candidate.candidateId],
          interpretationKey: candidate.interpretationKey, group: candidate.group, ruleIds: [candidate.ruleId], sourceFactIds,
          mappingIds: [mapping.mappingId], sourceIds: unique([...candidate.sourceIds, ...mapping.sourceIds]),
          direction, activeWindow: window, strength: mapping.strength, summary: candidate.summary, conditionsMet: conditions,
          counterConditions: candidate.inhibitingConditionsMet, limitations: candidate.limitations, weight: score });
        byKey.set(key, group);
      }
    }
  }
  return [...byKey.values()].flatMap(mergeEvidenceIntervals);
}

function mergeEvidenceIntervals(group: Evidence[]) {
  const result: Evidence[] = [];
  for (const item of group.sort((a, b) => a.activeWindow.start.localeCompare(b.activeWindow.start))) {
    const previous = result.at(-1);
    if (!previous || previous.activeWindow.endExclusive < item.activeWindow.start) {
      result.push(item);
      continue;
    }
    previous.activeWindow.endExclusive = [previous.activeWindow.endExclusive, item.activeWindow.endExclusive].sort()[1];
    if (strengthRank[item.strength] > strengthRank[previous.strength]) previous.strength = item.strength;
    previous.weight = Math.max(previous.weight, item.weight);
    for (const key of ['sourceFactIds', 'candidateIds', 'mappingIds', 'sourceIds', 'conditionsMet',
      'counterConditions', 'limitations'] as const) previous[key] = unique([...previous[key], ...item[key]]);
  }
  return result;
}

function buildTopics(evidence: Evidence[], incompatible: Set<Method>) {
  const conflicts: Conflict[] = [];
  const topics: TopicJudgment[] = [];
  for (const topicId of Object.keys(topicTitles) as Topic[]) {
    const entries = evidence.filter(item => item.topicId === topicId).sort((a, b) => b.weight - a.weight);
    const strong = entries.filter(item => item.strength !== 'weak' && item.conditionsMet.length > 0 && item.sourceFactIds.length > 1);
    if (!strong.length) continue;
    const focal = strong[0];
    const strongIds = new Set(strong.map(item => item.evidenceId));
    const counter = strong.filter(item => item.direction !== 'neutral');
    const support = counter.filter(item => item.direction === 'supportive');
    const challenge = counter.filter(item => item.direction === 'challenging');
    const mixed = counter.filter(item => item.direction === 'mixed');
    const conflictIds: string[] = [];
    function addConflict(conflictType: Conflict['conflictType'], ids: string[], resolution: Conflict['resolution'],
      explanation: string, affectedWindow?: Window) {
      const conflictId = topicId + ':' + conflictType;
      conflictIds.push(conflictId);
      conflicts.push({ conflictId, topicId, conflictType, resolution, explanation, evidenceIds: ids, affectedWindow });
    }
    const pairs = support.flatMap(left => challenge.map(right => ({ left, right })));
    const concurrent = pairs.find(({ left, right }) => intersects(left.activeWindow, right.activeWindow));
    if (pairs.length) {
      const { left, right } = concurrent ?? pairs[0];
      addConflict(concurrent ? 'direction' : 'time', [left.evidenceId, right.evidenceId],
        concurrent ? 'preserve_both' : 'split_by_time',
        concurrent ? '同一时段存在方向相反的线索。' : '方向不同的线索在不同时间段有效。',
        concurrent ? overlap(left.activeWindow, right.activeWindow) : undefined);
    }
    const inhibited = entries.filter(item => item.counterConditions.length);
    if (inhibited.length) addConflict('condition', inhibited.slice(0, 4).map(item => item.evidenceId),
      'downgrade_to_mixed', '存在需要一并考虑的反向条件。');
    const methods = new Set(strong.map(item => item.method));
    const competing = pairs.length > 0 || mixed.length > 0;
    const direction: Direction = competing ? 'mixed' : support.length ? 'supportive' : challenge.length ? 'challenging' : 'neutral';
    const directions = direction === 'supportive' ? support : direction === 'challenging' ? challenge : [];
    const aligned = new Set(directions.filter(item => strongIds.has(item.evidenceId)
      && intersects(item.activeWindow, focal.activeWindow)).map(item => item.method));
    if (!competing && methods.size > 1 && aligned.size < 2) {
      addConflict('method_semantics', strong.slice(0, 4).map(item => item.evidenceId), 'preserve_both',
        '不同术数提供了各自的观察角度。');
    }
    if (incompatible.size) addConflict('data', [focal.evidenceId], 'exclude_unreliable',
      '版本或归档不一致的事实已排除。');
    const consensus = concurrent ? 'conflicted' : competing ? 'mixed_signals' : aligned.size >= 3 ? 'multi_method_aligned'
      : aligned.size === 2 ? 'two_method_aligned' : methods.size === 1 ? 'single_method' : 'mixed_signals';
    const bySignal = new Map<string, Evidence>();
    const keep = [...strong, ...counter, ...entries];
    for (const item of keep) {
      const key = item.method + ':' + item.group + ':' + item.direction;
      if (!bySignal.has(key)) bySignal.set(key, item);
    }
    const evidenceIds = unique([...conflicts.filter(item => item.topicId === topicId).flatMap(item => item.evidenceIds),
      ...[...bySignal.values()].slice(0, 8).map(item => item.evidenceId)]);
    const summary = concurrent ? focal.summary + ' 同一时段也有需要留意的反向线索。'
      : pairs.length ? focal.summary + ' 相关线索分布在不同阶段。'
      : mixed.length ? focal.summary + ' 安排时可同时考虑已见的限制。' : focal.summary;
    topics.push({ topicId, title: topicTitles[topicId], direction, consensus, summary, evidenceIds,
      conflictIds, activeWindow: focal.activeWindow, rank: focal.weight });
  }
  return { topics: topics.sort((a, b) => b.rank - a.rank || a.topicId.localeCompare(b.topicId)), conflicts };
}

function individualActions(topics: TopicJudgment[], evidence: Evidence[], window: Window, reference: string,
  period: Request['periodType'], mode: RuleMode, book: Rulebook, anchors: Map<string, FortuneFactRecord>,
  byMethod: Map<string, FortuneFactRecord[]>, relationship?: InterpretationPreferences['relationshipStatus']) {
  const actions: Action[] = [];
  const seen = new Set<string>();
  const evidenceById = new Map(evidence.map(item => [item.evidenceId, item]));
  for (const rule of book.actions) {
    if (!rule.applicablePeriods.includes(period) || !canUse(rule, book, mode)) continue;
    const topic = topics.find(item => item.topicId === rule.topicId);
    const item = book.catalog.find(item => item.itemId === rule.itemId);
    if (!topic || !item || !canUse(item, book, mode) || !validCatalog(item) || seen.has(item.itemId)) continue;
    const matches = topic.evidenceIds.map(id => evidenceById.get(id)!).filter(item => item.strength !== 'weak'
      && item.conditionsMet.length && item.sourceFactIds.length > 1 && rule.interpretationKeys.includes(item.interpretationKey)
      && item.activeWindow.endExclusive > reference);
    const required = rule.required ?? [];
    const exclusions = rule.exclusions ?? [];
    if (['accessory', 'color', 'direction'].includes(item.category) && !required.length) continue;
    const qualified = matches.flatMap(basis => {
      const anchor = anchors.get(basis.sourceFactIds[0])!;
      const relevant = byMethod.get(basis.method) ?? [];
      const overlapWindow = overlap(basis.activeWindow, { ...window, start: reference });
      return slicesFor(anchor, relevant, overlapWindow, [...required, ...exclusions], false).flatMap(activeWindow => {
        const facts = required.map(condition => relations(condition, anchor, relevant, activeWindow, false)[0]);
        if (facts.some(fact => !fact) || exclusions.some(condition => relations(condition, anchor, relevant, activeWindow, false).length)) return [];
        return [{ basis, activeWindow, facts }];
      });
    })[0];
    if (!qualified) continue;
    const { basis, activeWindow, facts } = qualified;
    const prefix = topic.topicId === 'romance' && item.category === 'yi'
      ? { single: '如果你愿意结识新人，', dating: '如果正在约会，', relationship: '如果已有伴侣，',
        married: '如果有共同的家庭安排，', prefer_not_to_say: '' }[relationship ?? 'prefer_not_to_say'] : '';
    seen.add(item.itemId);
    actions.push({ item, topicId: topic.topicId, ruleId: rule.ruleId, ruleVersion: rule.version,
      evidenceIds: [basis.evidenceId], activeWindow, text: prefix + (item.periodUsage?.[period] ?? item.usage),
      rationale: rule.rationale, sourceIds: unique([...rule.sourceIds, ...item.sourceIds]), limitations: rule.limitations,
      sourceFactIds: unique([...basis.sourceFactIds, ...facts.map(fact => fact.factId)]),
      conditionsMet: unique([...basis.conditionsMet, ...required.map(item => item.id)]),
      source: 'personal_interpretation' });
  }
  return actions;
}

function timeEvents(facts: FortuneFactRecord[], evidence: Evidence[], topics: TopicJudgment[], period: Request['periodType'],
  window: Window, timezone: string) {
  const active = new Set(topics.flatMap(topic => topic.evidenceIds));
  const byGroup = new Map<string, Evidence[]>();
  const byAnchor = new Map<string, Evidence[]>();
  for (const item of evidence) {
    if (!active.has(item.evidenceId)) continue;
    const group = byGroup.get(item.group) ?? [];
    group.push(item);
    byGroup.set(item.group, group);
    for (const id of item.sourceFactIds) {
      const entries = byAnchor.get(id) ?? [];
      entries.push(item);
      byAnchor.set(id, entries);
    }
  }
  const format = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, month: '2-digit', day: '2-digit', year: 'numeric' });
  const events = facts.flatMap(fact => {
    const related = byAnchor.get(fact.factId) ?? byGroup.get(fact.parentSignalId ?? '');
    if (!related?.length) return [];
    const pass = field(fact, 'normalizedPayload.passIndex');
    const entered = field(fact, 'normalizedPayload.ingressInstant');
    const left = field(fact, 'normalizedPayload.egressInstant');
    const records = [
      { at: fact.exactInstant, kind: typeof pass === 'number' && pass > 1 ? 'repeated_pass' : 'exact_event' },
      { at: entered, kind: 'transition' }, { at: left, kind: 'transition' },
      { at: ['bazi', 'ziwei'].includes(fact.method) && fact.activeFrom !== window.start ? fact.activeFrom : undefined,
        kind: 'transition' },
    ];
    return records.flatMap(({ at, kind }) => {
      if (typeof at !== 'string' || at < window.start || at >= window.endExclusive) return [];
      const relevant = related.filter(item => item.activeWindow.start <= at && (at < item.activeWindow.endExclusive
        || (kind === 'transition' && at === item.activeWindow.endExclusive)));
      if (!relevant.length) return [];
      return [{ at, kind, passIndex: typeof pass === 'number' ? pass : undefined, factId: fact.factId,
        evidenceIds: unique(relevant.map(item => item.evidenceId)), topicIds: unique(relevant.map(item => item.topicId)),
        parentSignalId: fact.parentSignalId, weight: Math.max(...relevant.map(item => item.weight)) }];
    });
  });
  const keys = new Set<string>();
  return events.sort((a, b) => b.weight - a.weight || a.at.localeCompare(b.at)).filter(item => {
    const key = [item.parentSignalId ?? item.topicIds.join(','), item.kind, item.at].join('|');
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  }).slice(0, { year: 24, month: 18, week: 12, day: 8 }[period]).sort((a, b) => a.at.localeCompare(b.at)).map(item => {
    const date = format.format(Date.parse(item.at));
    const day = Number(date.slice(-2));
    const phase = period === 'year' ? date.slice(0, 7) : period === 'month' ? day <= 10 ? '上旬' : day <= 20 ? '中旬' : '下旬' : date;
    return { ...item, phase };
  });
}

export function requestForFortuneRun(run: FactRun, preferences?: InterpretationPreferences): Request {
  const { periodType, timezone, instantRange } = run.time.displayWindow;
  return { calculationRunId: run.calculationRunId, profileId: run.profileId, natalChartSnapshotId: run.natalChartSnapshotId,
    periodType, displayWindow: { start: instantRange.startInstant, endExclusive: instantRange.endInstantExclusive, timezone },
    preferences };
}

export function interpretFortune(run: FactRun, request: Request, interpretationRunId: string,
  { mode = 'production', book = builtinFortuneRulebook }: { mode?: RuleMode; book?: Rulebook } = {}) {
  const { compatible, incompatible, subjects, agreedTenGods } = eligibleFacts(run, request);
  const builtin = book === builtinFortuneRulebook;
  const rules = new Map<string, AtomicRule[]>();
  for (const definition of book.rules) {
    if (!canUse(definition, book, mode) || !definition.periods.includes(request.periodType)) continue;
    for (const type of definition.factTypes) {
      const key = definition.method + ':' + type;
      rules.set(key, [...(rules.get(key) ?? []), definition]);
    }
  }
  const byMethod = new Map<string, FortuneFactRecord[]>();
  for (const fact of compatible) {
    const list = byMethod.get(fact.method) ?? [];
    list.push(fact);
    byMethod.set(fact.method, list);
  }
  const anchors = new Map(compatible.map(fact => [fact.factId, fact]));
  const candidates = compatible.flatMap(fact => (rules.get(fact.method + ':' + fact.factType) ?? [])
    .filter(rule => (fact.completeness === 'complete' || rule.allowPartial)
      && (!rule.scopes || rule.scopes.includes(fact.scope)) && matches(fact, rule.trigger))
    .flatMap(rule => evaluateRule(rule, fact, byMethod.get(fact.method) ?? [], request)));
  if (builtin) {
    for (const [anchor, ...agreeing] of agreedTenGods) {
      anchors.set(anchor.factId, anchor);
      for (const rule of rules.get('bazi:ten_god') ?? []) {
        if (!rule.ruleId.startsWith('focus.') || !matches(anchor, rule.trigger)) continue;
        candidates.push(...evaluateRule(rule, anchor, [], request).map(candidate => ({
          ...candidate, sourceFactIds: [...candidate.sourceFactIds, ...agreeing.map(fact => fact.factId)],
        })));
      }
    }
  }
  const evidence = topicEvidence(candidates, anchors, book, request, mode, run.time.referenceAt, byMethod);
  const { topics, conflicts } = buildTopics(evidence, incompatible);
  if (builtin && !topics.length) {
    const focus = evidence.filter(item => item.interpretationKey.startsWith('focus.'))
      .sort((left, right) => right.weight - left.weight || left.activeWindow.start.localeCompare(right.activeWindow.start))[0];
    if (focus) {
      topics.push({ topicId: focus.topicId, title: topicTitles[focus.topicId], direction: 'neutral',
        consensus: 'single_method', summary: focus.summary, evidenceIds: [focus.evidenceId], conflictIds: [],
        activeWindow: focus.activeWindow, rank: focus.weight });
    }
  }
  const effective = new Date(run.time.referenceAt).toISOString();
  const actions = individualActions(topics, evidence, request.displayWindow, effective, request.periodType, mode, book,
    anchors, byMethod, request.preferences?.relationshipStatus);
  const wealth = topics.filter(item => ['wealth', 'regular_income', 'windfall', 'spending', 'investment_risk'].includes(item.topicId));
  const romance = topics.find(item => item.topicId === 'romance');
  const overallTopics = topics.slice(0, 3);
  const overallIds = unique(overallTopics.flatMap(item => item.evidenceIds));
  const groups = new Set(evidence.filter(item => overallIds.includes(item.evidenceId) && item.strength !== 'weak').map(item => item.group));
  const limitations = [
    ...[...subjects].filter(([, ids]) => ids.size > 1).map(([method]) => method + ' 含多个候选，省略候选专属判断。'),
    ...(['bazi', 'ziwei', 'western'] as const).filter(method => isFortuneMethodEnabled(request.periodType, method))
      .flatMap(method => run.methods[method].warnings),
    ...[...incompatible].map(method => method + ' 的事实版本或归档引用不一致。'),
  ];
  const report = {
    reportId: interpretationRunId, interpretationRunId, calculationRunId: run.calculationRunId,
    profileId: run.profileId, natalChartSnapshotId: run.natalChartSnapshotId, periodType: request.periodType,
    displayWindow: request.displayWindow, topics, conflicts, candidates, evidence,
    modelSections: undefined as FortuneGeneratedSection[] | undefined,
    knowledgeMatches: undefined as { version: string; byMethod: Record<KnowledgeMethod, KnowledgeMatch[]> } | undefined,
    overall: overallTopics.length >= 2 && groups.size >= 2 ? {
      direction: (overallTopics.some(item => item.direction === 'mixed')
        || (overallTopics.some(item => item.direction === 'supportive') && overallTopics.some(item => item.direction === 'challenging')))
        ? 'mixed' as const : 'neutral' as const,
      headline: phaseLabels[request.periodType] + '关注重点',
      summary: overallTopics.map(item => item.title + '。' + item.summary).join(' '),
      keywords: overallTopics.map(item => item.title), evidenceIds: overallIds, limitations,
    } : undefined,
    wealth: wealth.length ? { topicIds: wealth.map(item => item.topicId), evidenceIds: unique(wealth.flatMap(item => item.evidenceIds)) } : undefined,
    romance: romance ? { ...romance, relationshipStatus: request.preferences?.relationshipStatus } : undefined,
    personalYi: actions.filter(action => action.item.category === 'yi'),
    personalJi: actions.filter(action => action.item.category === 'ji'),
    remedies: actions.filter(action => action.item.category !== 'yi' && action.item.category !== 'ji'),
    keyTimeEvents: timeEvents(compatible, evidence, topics, request.periodType, request.displayWindow, request.displayWindow.timezone),
    generalAlmanac: run.facts.filter(fact =>
      isFortuneMethodEnabled(request.periodType, 'almanac') && fact.method === 'almanac' && fact.factType === 'general_almanac')
      .map(fact => ({ source: 'general_almanac' as const, factId: fact.factId, activeWindow: interval(fact),
        completeness: fact.completeness, payload: fact.normalizedPayload })),
    limitations: unique(limitations), ruleSetVersions: { book: book.version }, topicOntologyVersion: ontologyVersion,
    mappingVersion: book.mappingVersion, conflictPolicyVersion: conflictVersion, periodAggregationVersion: aggregationVersion,
    adviceCatalogVersion: book.actionVersion, remedyCatalogVersion: book.catalogVersion, contentVersion,
    generationMode: 'local_template' as 'local_template' | 'cloud_llm' | 'no_matching_knowledge',
    qualityStatus: limitations.length ? 'passed_with_warnings' as const : 'passed' as const,
    generatedAt: run.time.asOfUtc, ruleMode: mode,
  };
  validateInterpretation(report, run);
  return report;
}

export type FortuneInterpretationReport = ReturnType<typeof interpretFortune>;

export function validateInterpretation(report: FortuneInterpretationReport, run: FactRun) {
  const ids = new Set(run.facts.filter(item => item.method !== 'almanac').map(item => item.factId));
  const evidenceById = new Map(report.evidence.map(item => [item.evidenceId, item]));
  const candidateById = new Map(report.candidates.map(item => [item.candidateId, item]));
  const validRange = (window: Window) => report.displayWindow.start <= window.start
    && window.start < window.endExclusive && window.endExclusive <= report.displayWindow.endExclusive;
  const validIds = (values: string[]) => values.length > 0 && values.every(id => evidenceById.has(id));
  if (candidateById.size !== report.candidates.length || evidenceById.size !== report.evidence.length
    || report.candidates.some(item => !validRange(item.activeWindow) || !item.sourceFactIds.every(id => ids.has(id)))
    || report.evidence.some(item => !validRange(item.activeWindow) || !item.sourceFactIds.length
      || !item.sourceFactIds.every(id => ids.has(id)) || !item.candidateIds.every(id => candidateById.get(id)?.excluded === false))
    || report.topics.some(item => !validRange(item.activeWindow) || !validIds(item.evidenceIds) || unsafeLanguage.test(item.summary))
    || (report.overall && (!validIds(report.overall.evidenceIds) || unsafeLanguage.test(report.overall.summary)))
    || [...report.personalYi, ...report.personalJi, ...report.remedies].some(item =>
      !validCatalog(item.item) || !validIds(item.evidenceIds) || unsafeLanguage.test(item.text) || !validRange(item.activeWindow)
      || !item.sourceFactIds.length || !item.sourceFactIds.every(id => ids.has(id))
      || item.evidenceIds.some(id => evidenceById.get(id)?.topicId !== item.topicId))
    || report.keyTimeEvents.some(item => !ids.has(item.factId) || !validIds(item.evidenceIds)
      || item.at < report.displayWindow.start || item.at >= report.displayWindow.endExclusive)) {
    throw new Error('Interpretation quality check failed');
  }
}
