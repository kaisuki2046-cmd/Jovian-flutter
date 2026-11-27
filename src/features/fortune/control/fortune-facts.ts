import { buildAlmanacDay } from './almanac';
import { isoUtc } from './fact-time-context';
import { createWriter, factPolicies, factLayerVersion, type Writer, type Context, type RawRecord, type Status } from './facts/context';
import { baziFacts } from './facts/bazi';
import { ziweiFacts } from './facts/ziwei';
import { westernFacts } from './facts/western';
import { isFortuneMethodEnabled, type AuthorizedFortuneInput, type FortuneFactInput, type FortuneFactRecord,
  type FortuneReturnLocation, type Method } from '../model/fortune-facts';
export { factPolicies, factLayerVersion } from './facts/context';
function almanacFacts(writer: Writer, time: Context): Status {
  if (time.displayWindow.periodType !== 'day') return { status: 'unavailable', warnings: ['通用黄历按天提供'] };
  let partial = false;
  for (let at = time.window.start; at < time.window.end;) {
    const date = buildAlmanacDay(at);
    const end = Math.min(Date.parse(date.date + 'T00:00:00+08:00') + 86_400_000, time.window.end);
    writer.add({ start: at, end }, { scope: 'almanac', factType: 'general_almanac', subjectIds: [date.date],
      completeness: date.completeness, normalizedPayload: date }, writer.raw(date));
    if (date.completeness !== 'complete') partial = true;
    at = end;
  }
  return { status: partial ? 'partial' : 'completed', warnings: [] };
}

export function validateFortuneFacts(run: { time: Context; facts: FortuneFactRecord[]; rawFacts: RawRecord[] }) {
  const sources = new Map(run.rawFacts.map(item => [item.rawFactId, item.method]));
  if (sources.size !== run.rawFacts.length) throw new Error('Duplicate raw fact ID');
  const facts = new Set<string>();
  const groups = new Map<string, { method: Method; subjectIds: string }>();
  for (const item of run.facts) {
    const start = Date.parse(item.activeFrom);
    const end = Date.parse(item.activeTo);
    if (facts.has(item.factId) || !(run.time.window.start <= start && start < end && end <= run.time.window.end)
      || !item.subjectIds.length || isoUtc(start) !== item.activeFrom || isoUtc(end) !== item.activeTo
      || !item.sourceFactIds.length || item.sourceFactIds.some(id => sources.get(id) !== item.method)
      || !item.sourceEngine || !item.engineVersion || !item.rulesetVersion || !item.timeZone) throw new Error('Invalid fortune fact');
    if (item.exactInstant !== undefined) {
      const exact = Date.parse(item.exactInstant);
      if (!(start <= exact && exact < end) || isoUtc(exact) !== item.exactInstant) {
        throw new Error('Fortune event outside fact interval');
      }
    }
    if (item.parentSignalId) {
      const subjectIds = JSON.stringify(item.subjectIds);
      const parent = groups.get(item.parentSignalId);
      if (parent && (parent.method !== item.method || parent.subjectIds !== subjectIds)) {
        throw new Error('Fortune signal combines distinct subjects');
      }
      groups.set(item.parentSignalId, { method: item.method, subjectIds });
    }
    facts.add(item.factId);
  }
}

export function calculateFortuneFacts(input: FortuneFactInput, time: Context, runId: string,
  reference?: AuthorizedFortuneInput, returnLocation?: FortuneReturnLocation) {
  const results = { bazi: baziFacts, ziwei: ziweiFacts, western: westernFacts, almanac: almanacFacts };
  const methods = {} as Record<Method, Status>;
  const facts: FortuneFactRecord[] = [];
  const rawFacts: RawRecord[] = [];
  for (const method of Object.keys(results) as Method[]) {
    if (!isFortuneMethodEnabled(time.displayWindow.periodType, method)) {
      methods[method] = { status: 'not_supported', warnings: [] };
      continue;
    }
    const writer = createWriter(method, input, reference, runId);
    try {
      methods[method] = results[method](writer, time, reference, returnLocation);
      validateFortuneFacts({ time, facts: writer.facts, rawFacts: writer.rawFacts });
      facts.push(...writer.facts);
      rawFacts.push(...writer.rawFacts);
    } catch {
      methods[method] = { status: 'failed', warnings: ['术数计算或事实校验失败'] };
    }
  }
  return { version: factLayerVersion, calculationRunId: runId, time, methods, facts, rawFacts,
    factGroups: Object.fromEntries((Object.keys(results) as Method[]).map(method =>
      [method, { factIds: facts.filter(fact => fact.method === method).map(fact => fact.factId),
        rawFactIds: rawFacts.filter(fact => fact.method === method).map(fact => fact.rawFactId) }])),
    natalChartSnapshotId: reference?.snapshotId, profileId: reference?.profileId, birthProfileVersion: reference?.profileVersion,
    archivedAt: reference?.createdAt, engines: factPolicies };
}
