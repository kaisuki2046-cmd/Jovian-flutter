import { fortuneNoMatchSummaries } from '../control/fortune-prompt.mjs';
import { hashFortuneValue } from './fact-service.mjs';
import './knowledge/runtime.mjs';

const { interpretFortune, requestForFortuneRun } = await import('../control/fortune-interpretation.ts');
const { buildFortuneModelContext, parseFortuneModelSections, publishFortuneReport } = await import('../control/fortune-model-context.ts');
const { fortuneKnowledge, getFortuneAdviceHash, listFortuneAdviceOptions } = await import('../control/knowledge/catalog.ts');
const { knowledgeMatcherVersion } = await import('../control/knowledge/match.ts');
const { fortuneEventVersion } = await import('../control/fortune-events.ts');
const { readRulebook, canUse } = await import('../control/interpretation-registry.ts');
const { builtinFortuneRulebook: book } = await import('../control/interpretation-rules.ts');
const { fortuneReportSections, topicTitles } = await import('../model/interpretation.ts');
const { buildFortuneAdvice, buildFortuneSelectedAdvice } = await import('../control/fortune-advice.ts');
const { extractFortuneAdviceThemes } = await import('../control/fortune-advice-themes.ts');
const topicIds = Object.keys(topicTitles);
const relationships = ['single', 'dating', 'relationship', 'married', 'prefer_not_to_say'];
const id = /^[\da-f]{64}$/u;
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/u;
const adviceOptionsPath = '/fortune/advice/options';
const adviceOptionPath = /^\/fortune\/advice\/options\/([a-z0-9](?:[a-z0-9-]{0,70}[a-z0-9])?)$/u;
const fail = (status) => Object.assign(new Error('Interpretation request failed'), { status });

export function isFortuneInterpretationRoute(url) {
  const pathname = url?.split('?')[0];
  return pathname === '/fortune/interpret' || pathname === '/fortune/rules/status'
    || pathname === '/fortune/reports/latest' || pathname === adviceOptionsPath || adviceOptionPath.test(pathname)
    || /^\/fortune\/advice\/[a-f\d]{64}$/u.test(pathname)
    || /^\/fortune\/(?:interpretations|reports)\/[\da-f]{64}$/u.test(pathname);
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const value of request) {
    const bytes = Buffer.from(value);
    size += bytes.length;
    if (size <= 16_384) chunks.push(bytes);
  }
  if (size > 16_384) throw fail(413);
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail(400); }
  if (!body || Array.isArray(body) || typeof body !== 'object'
    || Object.keys(body).some(key => !['calculationRunId', 'expectedOwnerId', 'preferences', 'language'].includes(key))
    || typeof body.calculationRunId !== 'string' || !id.test(body.calculationRunId)
    || typeof body.expectedOwnerId !== 'string' || !uuid.test(body.expectedOwnerId)
    || (body.language !== undefined && body.language !== 'zh-CN')) throw fail(400);
  const preferences = body.preferences;
  if (preferences !== undefined && (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)
    || Object.keys(preferences).some(key => !['relationshipStatus', 'enabledTopics'].includes(key))
    || (preferences.relationshipStatus !== undefined && !relationships.includes(preferences.relationshipStatus))
    || (preferences.enabledTopics !== undefined && (!Array.isArray(preferences.enabledTopics)
      || !preferences.enabledTopics.every(topic => topicIds.includes(topic) && topic !== 'overall'))))) throw fail(400);
  if (!preferences) return body;
  return { ...body, preferences: {
    relationshipStatus: preferences.relationshipStatus,
    enabledTopics: preferences.enabledTopics === undefined ? undefined : [...new Set(preferences.enabledTopics)].sort(),
  } };
}

export function createFortuneInterpretationHandler({ repository, loadArchive,
  webOrigin = 'http://localhost:8081', expression, readPermission }) {
  readRulebook(book, topicIds);
  const expressionConfig = expression && { provider: 'deepseek', model: expression.model, version: expression.version };
  const policyHash = hashFortuneValue({ book, knowledge: fortuneKnowledge, knowledgeMatcherVersion, fortuneEventVersion,
    builtin: true,
    engine: 'fortune-interpretation-v1.4', expression: expressionConfig });
  const inFlight = new Map();
  const enabled = entries => entries.filter(entry => canUse(entry, book, 'production'));
  const approved = entries => enabled(entries).filter(entry => entry.reviewStatus === 'approved').length;
  const rulesStatus = {
    version: book.version, mappingVersion: book.mappingVersion, catalogVersion: book.catalogVersion,
    enabledRules: enabled(book.rules).length,
    enabledMappings: enabled(book.mappings).length,
    enabledActions: enabled(book.actions).length,
    approvedRules: approved(book.rules),
    approvedMappings: approved(book.mappings),
    approvedActions: approved(book.actions),
    expression: expressionConfig ?? { provider: 'unavailable' },
    knowledge: Object.fromEntries(Object.entries(fortuneKnowledge).map(([method, library]) =>
      [method, { version: library.version, entries: library.entries.length,
        fullyMapped: library.rules.filter(rule => rule.queries.length && !rule.unresolved.length).length }])),
  };
  const respond = (response, status, value) => response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  }).end(JSON.stringify(value));
  async function authorizedRecord(calculationRunId, ownerId, headers) {
    const record = await repository.get(calculationRunId);
    if (!record || record.ownerId !== ownerId) throw fail(404);
    const reference = await loadArchive({ ownerId, snapshotId: record.natalChartSnapshotId, headers });
    if (reference.snapshotId !== record.natalChartSnapshotId) throw fail(502);
    return { record, reference };
  }
  async function saveInterpretation(calculation, interpretationRunId, ownerId, preferences, headers) {
    const base = interpretFortune(calculation, requestForFortuneRun(calculation, preferences), interpretationRunId);
    const { input, references, knowledge, factIdsBySection } = buildFortuneModelContext(calculation, base);
    const record = { interpretationRunId, ownerId, calculationRunId: calculation.calculationRunId, policyHash, preferences };
    const report = { ...base, knowledgeMatches: knowledge };
    const emptySections = new Set(input.sections.filter(section => section.findings.length === 0).map(section => section.id));
    if (emptySections.size === fortuneReportSections.length) {
      const modelSections = fortuneReportSections.map(({ id: sectionId }) => ({
        sectionId, summary: fortuneNoMatchSummaries[sectionId], factIds: [],
      }));
      return repository.putInterpretation({ ...record,
        report: { ...report, modelSections, generationMode: 'no_matching_knowledge' } });
    }
    if (!expression) throw fail(503);
    async function express(previous) {
      if (readPermission) await requireModelPermission(readPermission, headers, 'fortune.cloud_interpretation', ownerId);
      return expression.interpret(input, previous);
    }
    let modelSections;
    try {
      const output = await express();
      try {
        modelSections = parseFortuneModelSections(output, factIdsBySection);
      } catch {
        // Retry a malformed model response once; validation still gates persistence.
        modelSections = parseFortuneModelSections(await express(true), factIdsBySection);
      }
    } catch (error) {
      if (error instanceof ModelPermissionError) throw error;
      throw fail(502);
    }
    modelSections = modelSections.map(section => emptySections.has(section.sectionId)
      ? { ...section, summary: fortuneNoMatchSummaries[section.sectionId] } : section);
    return repository.putInterpretation({ ...record, modelInput: input, modelReferences: Object.fromEntries(references),
      report: { ...report, modelSections, generationMode: 'cloud_llm' } });
  }
  function sendReport(response, record) {
    const published = publishFortuneReport(record.report);
    if (!published) throw fail(404);
    respond(response, 200, published);
  }
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Vary', 'Origin');
    const origin = request.headers.origin;
    if (origin && origin !== webOrigin) { response.writeHead(403).end(); return; }
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    try {
      if (!isFortuneInterpretationRoute(request.url)) { response.writeHead(404).end(); return; }
      const url = new URL(request.url, 'http://localhost');
      const method = url.pathname === '/fortune/interpret' ? 'POST' : 'GET';
      if (request.method === 'OPTIONS') {
        response.writeHead(204, { 'Access-Control-Allow-Methods': method,
          'Access-Control-Allow-Headers': 'Content-Type, Authorization' }).end();
        return;
      }
      if (request.method !== method) { response.writeHead(405, { Allow: method }).end(); return; }
      if (url.pathname === '/fortune/rules/status') {
        respond(response, 200, rulesStatus);
        return;
      }
      if (url.pathname === adviceOptionsPath) {
        if (url.search) throw fail(400);
        respond(response, 200, listFortuneAdviceOptions());
        return;
      }
      const selectedAdvice = adviceOptionPath.exec(url.pathname);
      if (selectedAdvice) {
        if (url.search) throw fail(400);
        const advice = buildFortuneSelectedAdvice(selectedAdvice[1]);
        if (!advice) throw fail(404);
        respond(response, 200, advice);
        return;
      }
      if (url.pathname.startsWith('/fortune/advice/')) {
        const ownerId = url.searchParams.get('expectedOwnerId');
        if (!ownerId || !uuid.test(ownerId)) throw fail(400);
        const calculationRunId = url.pathname.split('/').at(-1);
        const { record: calculation, reference } = await authorizedRecord(calculationRunId, ownerId, request.headers);
        const cacheId = hashFortuneValue({ kind: 'fortune-advice-v3', calculationRunId, catalog: getFortuneAdviceHash() });
        let cached = await repository.getAdvice(cacheId);
        if (!cached) {
          const themes = calculation.adviceThemes ?? extractFortuneAdviceThemes(reference.chart);
          const report = buildFortuneAdvice(calculationRunId, calculation.natalChartSnapshotId, calculation.time.displayWindow.periodType, themes);
          cached = await repository.putAdvice({ adviceId: cacheId, ownerId, report });
        }
        respond(response, 200, cached.report);
        return;
      }
      if (url.pathname === '/fortune/reports/latest') {
        const ownerId = url.searchParams.get('expectedOwnerId');
        const snapshotId = url.searchParams.get('snapshotId');
        const periodType = url.searchParams.get('periodType');
        const displayTimezone = url.searchParams.get('displayTimezone');
        const windowStart = Number(url.searchParams.get('windowStart'));
        if (!ownerId || !uuid.test(ownerId) || !snapshotId || !id.test(snapshotId)
          || !['day', 'week', 'month', 'year'].includes(periodType) || !displayTimezone
          || !url.searchParams.has('windowStart') || !Number.isSafeInteger(windowStart)) throw fail(400);
        await loadArchive({ ownerId, snapshotId, headers: request.headers });
        const record = await repository.latestInterpretation({ ownerId, snapshotId, periodType, displayTimezone, windowStart, policyHash });
        if (!record) { respond(response, 200, null); return; }
        sendReport(response, record);
        return;
      }
      if (method === 'GET') {
        const ownerId = url.searchParams.get('expectedOwnerId');
        if (!ownerId || !uuid.test(ownerId)) throw fail(400);
        const record = await repository.getInterpretation(url.pathname.split('/').at(-1));
        if (!record || record.ownerId !== ownerId) throw fail(404);
        await authorizedRecord(record.calculationRunId, ownerId, request.headers);
        sendReport(response, record);
        return;
      }
      if (url.search) throw fail(400);
      const { calculationRunId, expectedOwnerId: ownerId, language = 'zh-CN', preferences } = await readBody(request);
      const { record: calculation } = await authorizedRecord(calculationRunId, ownerId, request.headers);
      const interpretationRunId = hashFortuneValue({ calculationRunId, outputHash: calculation.outputHash,
        policyHash, language, preferences });
      let record = await repository.getInterpretation(interpretationRunId);
      if (!record) {
        let pending = inFlight.get(interpretationRunId);
        if (!pending) {
          pending = saveInterpretation(calculation, interpretationRunId, ownerId, preferences, request.headers)
            .finally(() => inFlight.delete(interpretationRunId));
          inFlight.set(interpretationRunId, pending);
        }
        record = await pending;
      }
      sendReport(response, record);
    } catch (error) {
      respond(response, error.status ?? 500, { error: 'fortune_interpretation_failed' });
    }
  };
}
import { ModelPermissionError, requireModelPermission } from '../../account/server-entry.mjs';
