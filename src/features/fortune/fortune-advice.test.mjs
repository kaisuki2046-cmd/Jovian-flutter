import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { createFortuneRepository } from './server/fact-service.mjs';
import { createFortuneInterpretationHandler, isFortuneInterpretationRoute } from './server/interpretation-service.mjs';
const { buildFortuneAdvice } = await import('./control/fortune-advice.ts');
const { adviceElements, adviceLifeStars, adviceSigns, extractFortuneAdviceThemes } = await import('./control/fortune-advice-themes.ts');
const { fortuneAdviceKnowledge, fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const owner = '00000000-0000-0000-0000-000000000001';
const snapshotId = 'a'.repeat(64), calculationRunId = 'b'.repeat(64);
const chart = { timeKnown: true,
  bazi: { rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1', rawResult: [{ day: '甲子' }] },
  western: { rulesetVersion: 'tropical-whole-sign-v1', rawResult: [{ positions: [{ planet: 'Sun', longitude: 285 }] }] },
  ziwei: { rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1', rawResult: [{ palaces: [{ name: '命宫', majorStars: [{ name: '紫微' }] }] }] } };

test('new advice entries remain independent of the existing interpretation matcher', () => {
  assert.deepEqual(Object.values(fortuneKnowledge).map(library => library.entries.length), [435, 214, 1747]);
  assert.deepEqual(Object.values(fortuneAdviceKnowledge).map(rows => rows.length), [30, 14, 184]);
  const themes = extractFortuneAdviceThemes(chart);
  assert.ok(buildFortuneAdvice(calculationRunId, snapshotId, 'week', themes).groups.every(group => !group.items.length));
  const report = buildFortuneAdvice(calculationRunId, snapshotId, 'day', themes);
  assert.deepEqual(report.groups.map(group => group.kind), ['数字', '饰品', '颜色']);
  assert.deepEqual(report.groups[0].items.find(item => item.method === 'bazi').options, ['3', '8']);
  assert.ok(report.groups[1].items.some(item => item.method === 'western'));
  assert.ok(report.groups[2].items.some(item => item.theme === '紫微'));
  assert.ok(report.groups.every(group => group.items.every(item => item.source && item.reason && item.limitations.length)));
  const uncertain = { ...chart, timeKnown: false,
    bazi: { ...chart.bazi, rawResult: [{ day: '甲子' }, { day: '丙寅' }] },
    western: { ...chart.western, rawResult: [{ positions: [{ planet: 'Sun', longitude: 285 }] }, { positions: [{ planet: 'Sun', longitude: 315 }] }] } };
  assert.ok(buildFortuneAdvice(calculationRunId, snapshotId, 'day', extractFortuneAdviceThemes(uncertain)).groups.every(group => !group.items.length));
  const unsupported = Object.fromEntries(Object.entries(chart).map(([key, value]) => [key, key === 'timeKnown' ? value : { ...value, rulesetVersion: 'unsupported' }]));
  assert.ok(buildFortuneAdvice(calculationRunId, snapshotId, 'day', extractFortuneAdviceThemes(unsupported)).groups.every(group => !group.items.length));
});

test('the original natal option space still returns the same 38 eligible advice entries', () => {
  const catalogue = new Set();
  for (const [field, values, count] of [
    ['element', adviceElements, 15], ['sign', adviceSigns, 10], ['lifeStar', adviceLifeStars, 13],
  ]) {
    const ids = new Set(values.flatMap(value => buildFortuneAdvice(calculationRunId, snapshotId, 'day', { [field]: value })
      .groups.flatMap(group => group.items.map(item => item.knowledgeId))));
    assert.equal(ids.size, count);
    for (const entryId of ids) {
      assert.doesNotMatch(entryId, /houtian|c777|agrippa|shuogua|ling-2022-v1-colour-p002/u);
      catalogue.add(entryId);
    }
  }
  assert.equal(catalogue.size, 38);
});

test('every source-specific advice entry is reachable through the public theme API with exact source and options', async () => {
  const handler = createFortuneInterpretationHandler({
    loadArchive: () => assert.fail('Theme advice does not load an account archive'),
    repository: { get: () => assert.fail('Theme advice does not load a calculation') },
    expression: { model: 'fixture', version: 'fixture', interpret: () => assert.fail('Theme advice does not call the model') },
  });
  const path = '/fortune/advice/options';
  async function call(url, method = 'GET', headers = {}) {
    const request = Object.assign(Readable.from([]), { method, url, headers });
    let status, body;
    await handler(request, { setHeader() {}, writeHead(code) { status = code; return this; },
      end(value) { if (value) body = JSON.parse(value); } });
    return { status, body };
  }
  const expected = new Map(Object.entries(fortuneAdviceKnowledge)
    .flatMap(([method, entries]) => entries.map(entry => [entry.id, { method, entry }])));
  const catalog = JSON.parse(await readFile(new URL('./model/knowledge/fortune_knowledge.json', import.meta.url), 'utf8'));
  const sourceById = new Map(catalog.advice.map(entry => [entry.id, entry]));
  const themeEntries = new Map(catalog.adviceGroups.flatMap(group => group.themes.map(theme =>
    [theme.id, new Set(theme.entryIds.map(id => sourceById.get(id).legacyId))])));
  const index = await call(path);
  assert.equal(index.status, 200);
  assert.equal(index.body.length, 17);
  assert.equal(isFortuneInterpretationRoute(path), true);
  const seen = new Set();
  for (const group of index.body) for (const option of group.options) {
    const route = path + '/' + option.id;
    assert.equal(isFortuneInterpretationRoute(route), true);
    const response = await call(route);
    assert.equal(response.status, 200);
    assert.equal(response.body.optionId, option.id);
    assert.deepEqual(Object.keys(response.body).sort(), ['groups', 'optionId', 'version']);
    assert.ok(response.body.groups.some(section => section.items.length));
    assert.deepEqual(new Set(response.body.groups.flatMap(section => section.items.map(item => item.knowledgeId))),
      themeEntries.get(option.id));
    for (const section of response.body.groups) for (const item of section.items) {
      assert.ok(!seen.has(item.knowledgeId));
      seen.add(item.knowledgeId);
      const { method, entry } = expected.get(item.knowledgeId);
      assert.equal(item.method, group.method);
      assert.equal(item.method, method);
      assert.equal(item.theme, option.label);
      assert.equal(section.kind, entry.interpretation.advice.kind);
      assert.deepEqual(item.options, entry.interpretation.advice.options);
      assert.deepEqual(item.limitations, [...entry.interpretation.limitations, ...entry.conditions.uncertain]);
      assert.equal(item.source, entry.source.book + ' · ' + (entry.source.section ?? entry.source.passage_id));
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  const sources = await Promise.all(['777-king-r15', '777-queen-r15', '777-emperor-r15', '777-empress-r15']
    .map(option => call(path + '/' + option)));
  assert.ok(sources.every(({ body }) => body.groups[2].items[0].theme === '白羊座'));
  assert.equal(new Set(sources.map(({ body }) => body.groups[2].items[0].source)).size, 4);
  assert.equal((await call(path + '/unknown-theme')).status, 404);
  assert.equal((await call(path + '?snapshotId=ignored')).status, 400);
  assert.equal((await call(path, 'POST')).status, 405);
  assert.equal((await call(path, 'GET', { origin: 'http://unrelated.invalid' })).status, 403);
});

test('advice endpoint authorizes the calculation and caches separately without a model call', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fortune-advice-'));
  try {
    const repository = createFortuneRepository(directory);
    await repository.put({ calculationRunId, ownerId: owner, natalChartSnapshotId: snapshotId,
      time: { displayWindow: { periodType: 'day' } } });
    let modelCalls = 0;
    const handler = createFortuneInterpretationHandler({ repository,
      loadArchive: ({ headers }) => { if (!headers.authorization) throw Object.assign(new Error('Denied'), { status: 401 }); return { snapshotId, chart }; },
      expression: { model: 'fixture', version: 'fixture', interpret() { modelCalls++; throw new Error('Must not call'); } } });
    async function call(expectedOwnerId = owner, auth = true) {
      const request = Object.assign(Readable.from([]), { method: 'GET', url: '/fortune/advice/' + calculationRunId + '?expectedOwnerId=' + expectedOwnerId,
        headers: auth ? { authorization: 'Bearer fixture' } : {} });
      let status, body;
      await handler(request, { setHeader() {}, writeHead(code) { status = code; return this; }, end(value) { body = JSON.parse(value); } });
      return { status, body };
    }
    const first = await call(); assert.equal(first.status, 200);
    assert.deepEqual(await call(), first);
    assert.equal((await call(owner, false)).status, 401);
    assert.equal((await call('00000000-0000-0000-0000-000000000002')).status, 404);
    assert.equal(modelCalls, 0);
    assert.equal(await repository.getInterpretation(first.body.calculationRunId), null);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
