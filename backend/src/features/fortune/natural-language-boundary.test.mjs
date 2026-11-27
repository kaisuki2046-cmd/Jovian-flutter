import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import test from 'node:test';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
import { createFortuneDeepSeek } from './server/deepseek-expression.mjs';
import { ensureFortuneKnowledgeDatabase, knowledgeSourceDirectory,
  openFortuneKnowledgeDatabase } from './storage/knowledge/database.mjs';

const start = '2026-11-02T00:00:00.000Z', endExclusive = '2026-11-03T00:00:00.000Z';
function inputFixture() {
  const facts = [
    { ref: 'F1', method: 'bazi', type: 'ten_god', data: { dayMaster: '甲', stem: '己', tenGod: '正财' } },
    { ref: 'F2', method: 'ziwei', type: 'palace_mapping', data: { flowName: '命宫', natalName: '官禄宫' } },
    { ref: 'F3', method: 'western', type: 'aspect_interval', data: { transitBody: 'Saturn', natalTargetId: 'Moon', aspectType: 'square', orb: 2 } },
  ].map(fact => ({ ...fact, scope: 'daily', start, endExclusive }));
  const finding = { method: 'bazi', conditions: ['已核验的组合条件'], originalText: '独立原文标记。', note: '独立现代释义标记。',
    factRefs: facts.map(fact => fact.ref) };
  return { period: 'day', window: { start, endExclusive, timezone: 'Asia/Shanghai' }, facts,
    sections: [{ id: 'overall', findings: [finding] }] };
}

test('a finding cannot survive with only part of its cited facts translated', () => {
  for (const omitted of ['unknown type', 'missing reference']) {
    const input = inputFixture();
    if (omitted === 'unknown type') input.facts[2].type = 'future_machine_fact';
    else input.facts.pop();
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, /天干十神为正财/u);
    assert.ok(!prompt.includes('独立原文标记') && !prompt.includes('独立现代释义标记'));
    assert.match(prompt, /暂无条件完整成立且有可引用事实的资料/u);
  }
  const prompt = formatFortuneFactAudit(inputFixture());
  assert.match(prompt, /独立原文标记/u);
  for (const phrase of ['天干十神为正财', '本期命宫落在本命官禄宫', '土星与本命月亮形成四分相']) assert.ok(prompt.includes(phrase));
});

test('the actual provider request never serializes the chart context or arbitrary data fields', async () => {
  const input = inputFixture();
  const failSerialization = () => { throw new Error('Machine context must not be serialized'); };
  input.toJSON = failSerialization;
  for (const fact of input.facts) fact.data.toJSON = failSerialization;
  input.facts[0].data.rawChart = { secret: 'private-chart-marker', toJSON: failSerialization };
  const finding = input.sections[0].findings[0];
  finding.source = { url: 'https://private-source.invalid', toJSON: failSerialization };
  finding.knowledgeId = 'private-knowledge-marker';
  finding.query = { normalizedPayload: true, toJSON: failSerialization };
  for (const key of ['facts', 'events', 'methods']) Object.defineProperty(input, key, { get: failSerialization });
  const provider = createFortuneDeepSeek({ apiKey: 'test-key', transport: async (_, options) => {
    const request = JSON.parse(options.body);
    const prompt = request.messages[1].content;
    assert.equal(prompt, formatFortunePrompt(input));
    assert.throws(() => JSON.parse(prompt));
    assert.doesNotMatch(prompt, /\b[FE]\d+\b|private-|rawChart|normalizedPayload|knowledgeId/u);
    assert.match(prompt, /命中条件：已核验的组合条件/u);
    assert.match(prompt, /原文：独立原文标记/u);
    assert.match(prompt, /现代释义：独立现代释义标记/u);
    assert.equal(request.response_format.type, 'json_object');
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(input);
});

test('complete matches reach the model even when some supporting facts cannot appear in the local audit', async context => {
  const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
  const { calculateFortuneFacts, factPolicies } = await import('./control/fortune-facts.ts');
  const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
  const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
  const { installFortuneKnowledgeReader } = await import('./control/knowledge/catalog.ts');
  const sourceName = 'fortune_knowledge.json';
  const catalog = JSON.parse(readFileSync(join(knowledgeSourceDirectory, sourceName), 'utf8'));
  const periods = ['year', 'month', 'week', 'day', 'hour'];
  const rule = { queries: [{ factType: 'ten_god', where: { tenGod: '正财' } }], unless: [], unresolved: [] };
  const entry = {
    id: Math.max(...[...periods, 'advice'].flatMap(period => catalog[period].map(row => row.id))) + 1,
    source: { book: '测试资料', locator: '测试篇目', url: null },
    category: { method: 'bazi', topic: 'wealth', period: 'day', contentType: '解读' },
    originalText: '原文',
    matchConditions: { status: 'mapped', original: ['正财结构已确认'], formatted: rule },
    modernInterpretation: '现代释义',
    legacy: { topic: '综合' },
  };
  for (const period of periods) catalog[period] = catalog[period].filter(row => row.category.method !== 'bazi');
  catalog.day.push(entry);
  const root = mkdtempSync(join(tmpdir(), 'fortune-prompt-'));
  const sourceDirectory = join(root, 'sources');
  const directory = join(root, 'database');
  let reader;
  context.after(() => {
    reader?.close();
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + 'fortune-prompt-'));
    rmSync(root, { recursive: true, force: true });
  });
  mkdirSync(sourceDirectory);
  function installFixture() {
    writeFileSync(join(sourceDirectory, sourceName), JSON.stringify(catalog));
    reader?.close();
    reader = openFortuneKnowledgeDatabase(ensureFortuneKnowledgeDatabase({ sourceDirectory, directory }));
    installFortuneKnowledgeReader(reader);
  }
  installFixture();
  const request = { periodType: 'day', displayTimezone: 'UTC' };
  const time = buildFactTimeContext(request, Date.parse(start), 'server');
  const run = { ...calculateFortuneFacts(request, time, 'b'.repeat(64), { snapshotId: 'a'.repeat(64) }), facts: [], rawFacts: [] };
  run.methods.bazi = { status: 'completed', warnings: [] };
  const policy = factPolicies.bazi;
  run.facts = [...'甲乙丙丁戊己'].map((stem, index) => ({ factId: 'fact:' + index,
    calculationRunId: run.calculationRunId, natalChartSnapshotId: 'a'.repeat(64), periodType: 'day', method: 'bazi',
    factType: 'ten_god', scope: 'daily', activeFrom: start, activeTo: endExclusive,
    subjectIds: ['bazi:candidate:0', 'natal:day', 'flow:day'], timePrecision: 'range', timeZone: policy.timeZone,
    sourceEngine: policy.engine, engineVersion: policy.version, rulesetVersion: policy.rules, completeness: 'complete',
    warnings: [], normalizedPayload: { dayMaster: '甲', stem, tenGod: '正财' }, sourceFactIds: ['raw:' + index] }));
  run.rawFacts = run.facts.map((fact, index) => ({ rawFactId: 'raw:' + index, method: 'bazi', payload: fact.normalizedPayload }));
  const report = interpretFortune(run, requestForFortuneRun(run), 'test-report');
  let result = buildFortuneModelContext(run, report);
  const finding = result.input.sections.find(section => section.id === 'wealth').findings[0];
  assert.ok(finding);
  assert.equal(finding.factRefs.length, 6);
  const audit = formatFortuneFactAudit(result.input);
  assert.match(audit, /对应事实：F1、F2、F3、F4、F5、F6/u);
  const prompt = formatFortunePrompt(result.input);
  assert.match(prompt, /命中条件：正财结构已确认/u);
  assert.doesNotMatch(prompt, /对应事实|\bF\d+\b/u);
  rule.queries.push({ factType: 'future_machine_fact', where: { confirmed: true } });
  installFixture();
  run.facts.push({ ...run.facts[0], factId: 'future', factType: 'future_machine_fact', normalizedPayload: { confirmed: true } });
  result = buildFortuneModelContext(run, report);
  const match = result.knowledge.byMethod.bazi.find(item => item.knowledgeId === finding.knowledgeId);
  assert.equal(match.status, 'matched');
  assert.ok(match.sourceFactIds.includes('future'));
  assert.deepEqual(result.factIdsBySection.get('wealth'), match.sourceFactIds);
  const retained = result.input.sections.find(section => section.id === 'wealth').findings[0];
  assert.equal(retained.knowledgeId, finding.knowledgeId);
  assert.deepEqual(retained.factRefs, []);
  assert.doesNotMatch(formatFortuneFactAudit(result.input), /命中条件：正财结构已确认/u);
  assert.match(formatFortunePrompt(result.input), /命中条件：正财结构已确认/u);
  assert.doesNotMatch(formatFortunePrompt(result.input), /future_machine_fact|对应事实/u);
});
