import { adviceElements, adviceLifeStars, adviceSigns } from '../control/fortune-advice-themes.ts';
import { buildFactTimeContext } from '../control/fact-time-context.ts';
import { factLayerVersion, factPolicies, validateFortuneFacts } from '../control/fortune-facts.ts';
import { clientFortuneRunId, isFortuneMethodEnabled } from '../model/fortune-facts.ts';

export const maxFortuneSubmissionBytes = 64 * 1024 * 1024;
const maxClockSkew = 15 * 60 * 1000;
const methods = Object.keys(factPolicies);
const methodStatuses = ['completed', 'completed_with_warnings', 'partial', 'unavailable', 'failed', 'not_supported'];
const scopes = ['natal', 'decadal', 'minor', 'yearly', 'monthly', 'daily', 'transit', 'progressed', 'almanac'];
const precisions = ['second', 'minute', 'day', 'range'];
const completeness = ['complete', 'partial', 'unavailable'];
const factKeys = ['factId', 'method', 'factType', 'scope', 'subjectIds', 'activeFrom', 'activeTo', 'exactInstant',
  'timePrecision', 'timeZone', 'sourceEngine', 'engineVersion', 'rulesetVersion', 'parentSignalId', 'sourceFactIds',
  'completeness', 'warnings', 'normalizedPayload'];
const batchKeys = ['version', 'asOfUtc', 'window', 'methods', 'facts', 'adviceThemes'];
const themeOptions = { element: adviceElements, sign: adviceSigns, lifeStar: adviceLifeStars };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOnly = (value, keys) => isObject(value) && Object.keys(value).every(key => keys.includes(key));
const nonEmptyString = value => typeof value === 'string' && value.length > 0;
const stringList = value => Array.isArray(value) && value.every(nonEmptyString);
const optionalString = value => value === undefined || nonEmptyString(value);
const invalid = (status = 400) => Object.assign(new Error('Invalid fortune fact submission'), { status });
const rawIdPatterns = Object.fromEntries(methods.map(method => [method, new RegExp('^' + clientFortuneRunId + ':' + method + ':raw:[0-9]+$', 'u')]));
const factIdPatterns = Object.fromEntries(methods.map(method => [method, new RegExp('^' + clientFortuneRunId + ':' + method + ':[0-9]+$', 'u')]));
const westernLinkFields = new Map([
  ['progression_transit_overlap', ['progressionFactId', 'transitFactId']],
  ['heindel_transit_context', ['transitFactId']],
  ['leo_jupiter_luminary_context', ['linkedTransitFactId']],
]);

function validateHeindelDateBasis(facts) {
  const contextTypes = ['heindel_progression_context', 'heindel_transit_context', 'heindel_direction_transit_overlap'];
  const contexts = facts.filter(fact => contextTypes.includes(fact.factType));
  if (!contexts.length) return;
  const progressions = contexts.filter(fact => fact.factType === 'heindel_progression_context');
  const [source] = progressions;
  const policy = factPolicies.western.heindelSourcePolicy;
  if (progressions.length !== 1 || source.scope !== 'progressed'
    || !policy.dateBases.includes(source.normalizedPayload.dateBasis)) throw invalid();
  for (const fact of contexts) {
    const p = fact.normalizedPayload;
    const profile = fact.factType === 'heindel_direction_transit_overlap' ? policy.directionProfile : policy.profile;
    if (fact.method !== 'western' || (fact !== source && fact.scope !== 'transit') || p.profile !== profile
      || p.sourceClockVerified !== false || p.dateBasis !== source.normalizedPayload.dateBasis
      || !fact.sourceFactIds.some(id => source.sourceFactIds.includes(id))) throw invalid();
  }
}

function validateLillySeventhReturn(facts, time) {
  const comparisons = facts.filter(fact => fact.factType === 'lilly_return_seventh_context');
  if (!comparisons.length) return;
  const [fact] = comparisons;
  const p = fact.normalizedPayload;
  const returnEnd = Date.parse(p.returnEnd);
  const { profile, zodiac, houseSystem } = factPolicies.western.lillySeventhReturnPolicy;
  const position = value => Number.isFinite(value) && value >= 0 && value < 360;
  const returns = facts.filter(row => row.method === 'western' && row.factType === 'solar_return' && row.scope === 'yearly'
    && time.window.start <= Date.parse(row.normalizedPayload.returnAt) && Date.parse(row.normalizedPayload.returnAt) < time.window.end);
  const [source] = returns;
  if (comparisons.length !== 1 || returns.length !== 1 || time.displayWindow.periodType !== 'year' || fact.method !== 'western'
    || fact.scope !== 'yearly' || fact.completeness !== 'complete' || source.completeness !== 'complete'
    || !hasOnly(p, ['profile', 'zodiac', 'houseSystem', 'natalSeventhLongitude', 'returnAscendant', 'sameSign', 'returnAt', 'returnEnd'])
    || p.profile !== profile || p.zodiac !== zodiac || p.houseSystem !== houseSystem
    || !position(p.natalSeventhLongitude) || !position(p.returnAscendant)
    || p.sameSign !== (Math.floor(p.natalSeventhLongitude / 30) === Math.floor(p.returnAscendant / 30))
    || p.returnAt !== fact.activeFrom || p.returnAt !== source.normalizedPayload.returnAt || !(Date.parse(p.returnAt) < returnEnd)
    || new Date(returnEnd).toISOString() !== p.returnEnd || p.returnEnd !== source.normalizedPayload.returnEnd
    || fact.activeFrom !== source.activeFrom || fact.activeTo !== source.activeTo
    || fact.activeTo !== new Date(Math.min(time.window.end, returnEnd)).toISOString()
    || !fact.sourceFactIds.some(id => source.sourceFactIds.includes(id))) throw invalid();
}

function validateLillyLocatedPairs(facts, time) {
  const returns = facts.filter(fact => fact.factType === 'solar_return');
  const sources = returns.filter(fact => fact.normalizedPayload.returnLocalFrame !== undefined);
  const pairs = facts.filter(fact => {
    const p = fact.normalizedPayload;
    return fact.factType === 'lilly_return_context' && (p.returnLocation === 'provided' || p.returnLocalFrame !== undefined
      || p.returnAngles === 'regiomontanus_verified' || p.returnHouse !== undefined || p.saturnMidheavenState !== undefined
      || p.saturnMidheavenApproachStatus !== undefined || p.saturnMidheavenDistanceRange !== undefined
      || p.returnSignification !== undefined);
  });
  if (!sources.length && !pairs.length) return;
  const [source] = sources;
  const returnPolicy = factPolicies.western.lillyReturnPolicy;
  const currentReturns = returns.filter(fact => {
    const at = Date.parse(fact.normalizedPayload.returnAt);
    return time.window.start <= at && at < time.window.end;
  });
  if (sources.length !== 1 || time.displayWindow.periodType !== 'year' || source.method !== 'western'
    || source.scope !== 'yearly' || source.completeness !== 'complete' || currentReturns.length !== 1
    || currentReturns[0] !== source) throw invalid();
  const s = source.normalizedPayload;
  const epoch = Date.parse(s.returnAt), epochEnd = Date.parse(s.returnEnd);
  if (s.returnLocalFrame !== returnPolicy.localFrame || s.returnAngles !== 'regiomontanus_verified'
    || s.houseSystem !== 'regiomontanus' || s.zodiac !== 'tropical' || !Array.isArray(s.bodies)
    || !['within-five-before', 'outside-five-before', 'boundary'].includes(s.saturnMidheavenApproachStatus)
    || s.returnAt !== source.activeFrom || !(time.window.start <= epoch && epoch < time.window.end && epoch < epochEnd)
    || source.activeTo !== new Date(Math.min(time.window.end, epochEnd)).toISOString()) throw invalid();
  const bodiesByPair = new Map([['saturn-self', ['Saturn', 'Saturn']], ['jupiter-mercury', ['Jupiter', 'Mercury']],
    ['venus-mercury', ['Venus', 'Mercury']], ['moon-self', ['Moon', 'Moon']]]);
  const seen = new Set();
  for (const fact of pairs) {
    const p = fact.normalizedPayload;
    const [body, target] = bodiesByPair.get(p.pair) ?? [];
    const positions = s.bodies.filter(row => row?.planet === body);
    const house = p.returnHouse;
    const hasHouse = Number.isInteger(house) && 1 <= house && house <= 12;
    const houseKind = !hasHouse ? undefined : [1, 4, 7, 10].includes(house) ? 'angular'
      : [2, 5, 8, 11].includes(house) ? 'succedent' : 'cadent';
    const saturnMidheaven = body !== 'Saturn' ? undefined : !hasHouse ? 'house-boundary' : house === 10 ? 'tenth-house' : 'other-house';
    const signification = p.returnSignification;
    if (signification !== undefined && (!hasOnly(signification, ['profile', 'body', 'returnHouse', 'natalRuledHouses'])
      || !['Saturn', 'Venus', 'Moon'].includes(body) || signification.profile !== returnPolicy.returnSignification
      || signification.body !== body || !hasHouse || signification.returnHouse !== house || p.natalHouseSystem !== 'regiomontanus'
      || !Array.isArray(signification.natalRuledHouses)
      || !signification.natalRuledHouses.every((value, index, values) => Number.isInteger(value) && 1 <= value && value <= 12
        && (index === 0 || values[index - 1] < value)))) throw invalid();
    const approach = p.saturnMidheavenApproachStatus;
    const distances = p.saturnMidheavenDistanceRange;
    if (body === 'Saturn') {
      if (approach !== s.saturnMidheavenApproachStatus || !Array.isArray(distances) || distances.length !== 2
        || !distances.every(value => Number.isFinite(value) && -180 <= value && value < 180) || distances[0] > distances[1]
        || approach === 'within-five-before' && (house !== 9 || distances[0] <= 0
          || distances[1] > returnPolicy.midheavenApproachDegrees)) throw invalid();
    } else if (approach !== undefined || distances !== undefined) throw invalid();
    if (!body || seen.has(p.pair) || fact.method !== 'western' || fact.scope !== 'yearly' || fact.completeness !== 'complete'
      || p.profile !== returnPolicy.profile || p.zodiac !== 'tropical' || p.returnLocalFrame !== returnPolicy.localFrame
      || p.returnAngles !== 'regiomontanus_verified' || p.returnLocation !== 'provided'
      || !['day', 'night', 'unavailable'].includes(p.returnSect)
      || p.returningEssential?.body !== body || p.returningConditions?.body !== body
      || p.returningEssential.sect !== (p.returnSect === 'unavailable' ? undefined : p.returnSect)
      || p.returnBody !== body || p.natalTargetId !== target || positions.length !== 1
      || p.returningLongitude !== positions[0].longitude || !Number.isFinite(p.returningLongitude)
      || p.returningLongitude < 0 || p.returningLongitude >= 360
      || (house !== undefined && !hasHouse) || p.returningConditions?.house !== house || p.returningConditions?.houseKind !== houseKind
      || p.saturnMidheavenState !== saturnMidheaven
      || p.returnAt !== s.returnAt || p.returnEnd !== s.returnEnd || fact.activeFrom !== source.activeFrom || fact.activeTo !== source.activeTo
      || !fact.sourceFactIds.some(id => source.sourceFactIds.includes(id))) throw invalid();
    seen.add(p.pair);
  }
}

export function readClientFactTime(input, batch, receivedAt) {
  if (!hasOnly(batch, batchKeys) || batch.version !== factLayerVersion || !nonEmptyString(batch.asOfUtc)
    || !Array.isArray(batch.facts) || !hasOnly(batch.window, ['start', 'end'])
    || !hasOnly(batch.methods, methods) || !hasOnly(batch.adviceThemes, Object.keys(themeOptions))) throw invalid();
  const asOf = Date.parse(batch.asOfUtc);
  if (!Number.isFinite(asOf) || new Date(asOf).toISOString() !== batch.asOfUtc) throw invalid();
  if (Math.abs(receivedAt - asOf) > maxClockSkew) throw invalid(409);
  let time;
  try { time = buildFactTimeContext(input, asOf, 'client'); } catch { throw invalid(); }
  if (time.window.start !== batch.window.start || time.window.end !== batch.window.end) throw invalid(409);
  return time;
}

export function bindClientFortuneRun(input, batch, time, calculationRunId, reference) {
  const factGroups = Object.fromEntries(methods.map(method => [method, { factIds: [], rawFactIds: [] }]));
  for (const method of methods) {
    const status = batch.methods[method];
    if (!hasOnly(status, ['status', 'warnings']) || !methodStatuses.includes(status.status) || !stringList(status.warnings)) {
      throw invalid();
    }
    if (!isFortuneMethodEnabled(input.periodType, method) && status.status !== 'not_supported') throw invalid();
  }
  for (const [key, value] of Object.entries(batch.adviceThemes)) {
    if (!themeOptions[key].includes(value)) throw invalid();
  }
  const rebaseId = id => calculationRunId + id.slice(clientFortuneRunId.length);
  const submittedIds = new Set(batch.facts.map(fact => fact?.factId));
  const sources = new Map();
  const facts = batch.facts.map(fact => {
    if (!hasOnly(fact, factKeys) || !methods.includes(fact.method) || !isFortuneMethodEnabled(input.periodType, fact.method)
      || !nonEmptyString(fact.factId)
      || !factIdPatterns[fact.method].test(fact.factId) || !nonEmptyString(fact.factType)
      || !scopes.includes(fact.scope) || (fact.method === 'almanac') !== (fact.scope === 'almanac')
      || !nonEmptyString(fact.activeFrom) || !nonEmptyString(fact.activeTo) || !optionalString(fact.exactInstant)
      || !optionalString(fact.parentSignalId) || !stringList(fact.subjectIds) || !precisions.includes(fact.timePrecision)
      || !completeness.includes(fact.completeness) || !isObject(fact.normalizedPayload) || !stringList(fact.warnings)
      || !stringList(fact.sourceFactIds) || !fact.sourceFactIds.every(id => rawIdPatterns[fact.method].test(id))) throw invalid();
    const { method } = fact;
    const policy = factPolicies[method];
    if (fact.sourceEngine !== policy.engine || fact.engineVersion !== policy.version || fact.rulesetVersion !== policy.rules
      || fact.timeZone !== policy.timeZone) throw invalid();
    const factId = rebaseId(fact.factId);
    factGroups[method].factIds.push(factId);
    const sourceFactIds = fact.sourceFactIds.map(rebaseId);
    for (const rawFactId of sourceFactIds) {
      if (sources.has(rawFactId)) continue;
      sources.set(rawFactId, { rawFactId, method });
      factGroups[method].rawFactIds.push(rawFactId);
    }
    const linkFields = method === 'western' ? westernLinkFields.get(fact.factType) : undefined;
    const normalizedPayload = linkFields ? { ...fact.normalizedPayload } : fact.normalizedPayload;
    for (const field of linkFields ?? []) {
      const id = normalizedPayload[field];
      if (typeof id !== 'string' || !factIdPatterns.western.test(id) || !submittedIds.has(id)) throw invalid();
      normalizedPayload[field] = rebaseId(id);
    }
    if (method === 'western' && fact.factType === 'progression_transit_overlap') {
      if (!stringList(normalizedPayload.sourceFactIds)
        || !normalizedPayload.sourceFactIds.every(id => fact.sourceFactIds.includes(id))) throw invalid();
      normalizedPayload.sourceFactIds = normalizedPayload.sourceFactIds.map(rebaseId);
    }
    return { ...fact, factId, sourceFactIds, normalizedPayload, calculationRunId, periodType: input.periodType,
      ...(method === 'almanac' ? {} : { natalChartSnapshotId: reference.snapshotId, profileId: reference.profileId }) };
  });
  const rawFacts = [...sources.values()];
  try { validateFortuneFacts({ time, facts, rawFacts }); } catch { throw invalid(); }
  validateHeindelDateBasis(facts);
  validateLillySeventhReturn(facts, time);
  validateLillyLocatedPairs(facts, time);
  return { version: factLayerVersion, calculationRunId, calculationSource: 'client', time, methods: batch.methods,
    facts, rawFacts, factGroups, adviceThemes: input.periodType === 'week' ? {} : batch.adviceThemes, natalChartSnapshotId: reference.snapshotId,
    profileId: reference.profileId, birthProfileVersion: reference.profileVersion, archivedAt: reference.createdAt, engines: factPolicies };
}
