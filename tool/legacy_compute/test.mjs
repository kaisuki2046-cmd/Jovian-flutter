import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire, registerHooks } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { frontendRoot, legacyRoot } from './paths.mjs';

const dependencies = resolve(process.env.JOVIAN_LEGACY_NODE_ROOT ?? legacyRoot);
const browserDependencies = resolve(process.env.JOVIAN_BROWSER_TEST_ROOT ?? dependencies);
const { chromium } = createRequire(join(browserDependencies, 'package.json'))('playwright-core');
const worker = await readFile(join(frontendRoot, 'web', 'legacy-compute.js'));
const nativeRunner = pathToFileURL(join(frontendRoot, 'tool', 'legacy_compute', 'native_assets', 'legacy-compute.html')).href;
const testOutput = join(frontendRoot, '.dart_tool', 'legacy_compute');
await mkdir(testOutput, { recursive: true });
const testBridgePath = join(testOutput, 'bridge-test.js');
execFileSync(process.env.JOVIAN_DART_EXECUTABLE ?? 'dart', [
  'compile', 'js', 'tool/legacy_compute/bridge_test.dart', '-o', testBridgePath,
], { cwd: frontendRoot, stdio: 'inherit' });
const testBridge = await readFile(testBridgePath);

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && !extname(specifier) && error.code === 'ERR_MODULE_NOT_FOUND') {
      return next(specifier + '.ts', context);
    }
    if (error.code === 'ERR_MODULE_NOT_FOUND' && /^(lunar-javascript|astronomy-engine|iztro)(?:\/|$)/u.test(specifier)) {
      return next(specifier, { ...context, parentURL: pathToFileURL(join(dependencies, 'package.json')).href });
    }
    throw error;
  }
} });

const source = (path) => import(pathToFileURL(join(legacyRoot, 'src', 'features', path)));
const { runReading } = await source('destiny/control/local-reading.ts');
const { toDestinyArchiveWithSnapshot } = await source('destiny/control/account-report.ts');
const { buildReportRequest } = await source('destiny/requests/report.ts');
const { calculateManualSubjectChart } = await source('destiny/control/manual-subject.ts');
const { findBirthPlace } = await source('destiny/model/birth-places.ts');
const { compareCharts } = await source('synastry/control/compare.ts');
const { adaptInterpretationFacts } = await source('synastry/control/interpretation-fact-adapter.ts');
const { prepareSynastrySummary } = await source('synastry/control/summary.ts');
const { buildAlmanacDay } = await source('fortune/control/almanac.ts');
const { calculateFortuneCalendar } = await source('fortune/control/fortune-calendar.ts');
const { buildFortunePreview, readNatalDay } = await source('fortune/control/fortune-preview.ts');
const { buildFortuneFactSubmission } = await source('fortune/control/fortune-fact-submission.ts');
const { archiveFortuneReport, fortuneArchiveContext } = await source('fortune/control/report-archive.ts');
const { lillyReturnLocationTarget } = await source('fortune/control/lilly-returns.ts');
const { readClientFactTime, bindClientFortuneRun } = await source('fortune/server/client-facts.mjs');

const server = createServer((request, response) => {
  if (request.url === '/preview/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      .end('<!doctype html><title>Worker test</title><script src="./bridge-test.js"></script>');
  } else if (request.url === '/preview/legacy-compute.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript' }).end(worker);
  } else if (request.url === '/preview/bridge-test.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript' }).end(testBridge);
  } else response.writeHead(404).end();
});
await new Promise((done, fail) => server.once('error', fail).listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;

function normalize(value) {
  return JSON.parse(JSON.stringify(value, (key, item) => key === 'calculatedAt' ? '(time)' : item));
}

function assertParity(actualValue, expectedValue) {
  function compare(actual, expected, path) {
    if (typeof actual === 'number' && typeof expected === 'number') {
      // JS engines can differ by a few ULPs on astronomical trigonometry.
      assert.ok(Math.abs(actual - expected) < 1e-9, `${path}: ${actual} vs ${expected}`);
    } else if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
      assert.equal(Array.isArray(actual), Array.isArray(expected), path);
      assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), path);
      for (const key of Object.keys(expected)) compare(actual[key], expected[key], path + '.' + key);
    } else {
      assert.equal(actual, expected, path);
    }
  }
  compare(normalize(actualValue), normalize(expectedValue), 'result');
}

let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE,
    args: ['--disable-background-networking'],
  });
  const context = await browser.newContext();
  const externalRequests = [];
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    externalRequests.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto(origin + '/preview/');
  const ask = (operation) => page.evaluate((request) => new Promise((complete, fail) => {
    const worker = new Worker(new URL('./legacy-compute.js', document.baseURI));
    const stages = [];
    const timer = setTimeout(() => {
      worker.terminate();
      fail(new Error('Worker result timed out'));
    }, 180_000);
    function finish(callback, value) {
      clearTimeout(timer);
      worker.terminate();
      callback(value);
    }
    worker.onmessage = ({ data }) => {
      const { stage, result, error } = JSON.parse(data);
      if (stage) stages.push(stage);
      else finish(complete, { stages, result, error });
    };
    worker.onerror = ({ message }) => finish(fail, new Error(message));
    worker.postMessage(JSON.stringify(request));
  }), operation);

  const a = {
    date: { year: 1990, month: 7, day: 1 }, time: { timeKnown: true, hour: 12, minute: 0 },
    gender: 'female', place: findBirthPlace('1796236'),
  };
  const b = {
    ...a, date: { year: 1992, month: 4, day: 8 }, time: { timeKnown: true, hour: 8, minute: 30 },
    gender: 'male', place: findBirthPlace('1816670'),
  };
  const progress = [];
  const reading = await runReading(a, new AbortController().signal, (stage) => progress.push(stage));
  const archive = toDestinyArchiveWithSnapshot(reading, '');
  const result = await ask({ name: 'calculateDestiny', profile: a });
  const { presentation, ...legacy } = result.result;
  assertParity(legacy, { reading, archive, reportRequest: buildReportRequest(reading) });
  assert.equal(presentation.bazi.length, 7);
  assert.deepEqual(presentation.ziwei.palaces.map(({ branch }) => branch),
    reading.charts[1].summary.palaces.map(({ earthlyBranch }) => earthlyBranch));
  assert.equal(presentation.western.wheel.ascendant, reading.charts[2].summary.exact.ascendant);
  assert.deepEqual(presentation.western.wheel.houses.map(({ longitude }) => longitude),
    reading.charts[2].summary.exact.houses);
  const partial = await ask({name: 'calculateDestiny', profile: { ...a, time: { timeKnown: false, hour: null, minute: null } }});
  assert.equal(partial.result.presentation.western.wheel, null);
  assert.ok(!partial.result.presentation.ziwei.palaces);
  assert.deepEqual(result.stages, progress);
  const restore = { name: 'restoreDestinyPresentation', snapshot: archive.chartSnapshot };
  const restored = await ask(restore);
  assert.deepEqual(restored.stages, [], 'Opening an archive must not start a calculation');
  assertParity(restored.result, presentation);
  assert.deepEqual((await ask({
    name: restore.name, snapshot: partial.result.archive.chartSnapshot,
  })).result, {});
  const sparse = structuredClone(archive.chartSnapshot);
  sparse.bazi.rawResult[0].analysis = {};
  delete sparse.ziwei.rawResult[0].palaces[0].heavenlyStem;
  assertParity((await ask({ ...restore, snapshot: sparse })).result, {
    western: presentation.western,
  });
  const dartResult = await page.evaluate(async (profile) =>
    JSON.parse(await window.runBrowserComputeTest(JSON.stringify(profile))), a);
  assert.equal(dartResult.available, true);
  assert.equal(dartResult.cancellation, 'cancelled');
  assert.deepEqual(dartResult.stages, progress);
  assertParity(dartResult.result, result.result);
  assertParity(dartResult.restored, presentation);

  const chartA = await calculateManualSubjectChart(a);
  const chartB = await calculateManualSubjectChart(b);
  assertParity((await ask({ name: 'calculateManualSubjectChart', profile: b })).result, chartB);
  const subjects = { a: { mode: 'manual_subject', chart: chartA }, b: { mode: 'manual_subject', chart: chartB } };
  const comparison = compareCharts(subjects.a, subjects.b);
  const { rulesVersion, sections } = comparison;
  const fact = await ask({ name: 'compareSynastry', ...subjects });
  assertParity(fact.result, {
    comparison: { rulesVersion, sections },
    facts: adaptInterpretationFacts(comparison),
    summaryRequest: prepareSynastrySummary(comparison),
  });

  const fortune = {
    input: { periodType: 'day', displayTimezone: 'Asia/Shanghai' },
    asOf: Date.UTC(2026, 9, 8, 1, 30), archive: { snapshotId: 'fixture', chart: archive.chartSnapshot },
  };
  const batch = await ask({ name: 'buildFortuneFactSubmission', ...fortune });
  assertParity(batch.result, buildFortuneFactSubmission(fortune.input, fortune.asOf, fortune.archive));
  assert.ok(batch.result.facts.length > 0);
  const time = readClientFactTime(fortune.input, batch.result, fortune.asOf);
  const bound = bindClientFortuneRun(fortune.input, batch.result, time, 'fixture-run', fortune.archive);
  assert.equal(bound.facts.length, batch.result.facts.length);

  const calendarOperations = [
    { name: 'queryFortuneCalendar', reference: { date: '2026-11-10', time: '23:40' } },
    { name: 'queryFortuneCalendar', reference: { date: '2026-02-30', time: '12:00' } },
  ];
  const previewOperations = [
    { name: 'previewFortune', asOf: Date.UTC(2026, 10, 1, 9, 30), period: 'day',
      timeZone: 'America/Los_Angeles', archive },
    { name: 'previewFortune', asOf: Date.UTC(2026, 10, 1, 9, 30), period: 'week',
      timeZone: 'America/Los_Angeles', archive: { ...archive, chartSnapshot: {
        timeKnown: false, bazi: { rawResult: [{ day: '丁丑' }, { day: '甲子' }] },
      } } },
  ];
  for (const { name, reference } of calendarOperations) {
    assertParity((await ask({ name, reference })).result, { calendar: calculateFortuneCalendar(reference) });
  }
  for (const request of previewOperations) {
    const { asOf, period, timeZone, archive } = request;
    const result = (await ask(request)).result;
    assertParity(result, {
      preview: buildFortunePreview(asOf, period, readNatalDay(archive), { timeZone }),
      almanac: period === 'day' ? buildAlmanacDay(asOf) : null,
    });
    if (period === 'day') {
      assert.equal(result.preview.window.end - result.preview.window.start, 25 * 60 * 60 * 1000);
      assert.ok(result.preview.current.tenGod);
    } else {
      assert.equal('tenGod' in result.preview.current, false);
    }
  }
  const flutterFortune = await page.evaluate(async ({ preview, reference }) =>
    JSON.parse(await window.runBrowserFortuneTest(JSON.stringify({ preview, reference }))),
  { preview: previewOperations[0], reference: calendarOperations[0].reference });
  assertParity(flutterFortune.preview, (await ask(previewOperations[0])).result);
  assertParity(flutterFortune.calendar, (await ask(calendarOperations[0])).result);

  for (const periodType of ['day', 'week', 'month', 'year']) {
    const input = { periodType, displayTimezone: 'America/Los_Angeles' };
    const asOf = Date.UTC(2026, 10, 1, 9, 30);
    const prepared = (await ask({ name: 'prepareFortunePeriod', input, asOf, archive: fortune.archive })).result;
    const expected = fortuneArchiveContext(input, asOf, fortune.archive.snapshotId);
    const lastDate = new Intl.DateTimeFormat('sv-SE', { timeZone: input.displayTimezone,
      calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(expected.window.end - 1);
    const returnAt = periodType === 'year' ? lillyReturnLocationTarget(expected.window, fortune.archive.chart) : undefined;
    assertParity(prepared, { ...expected, lastDate, returnAt });
    const report = {
      reportId: 'a'.repeat(64), calculationRunId: 'b'.repeat(64), natalChartSnapshotId: fortune.archive.snapshotId,
      periodType, sections: ['overall', 'wealth', 'romance'].map(sectionId => ({ sectionId, summary: '用于核对归档格式。' })),
    };
    const result = (await ask({ name: 'archiveFortuneReport', report, input, asOf })).result;
    assert.match(result.calculatedAt, /^\d{4}-\d{2}-\d{2}T.*Z$/u);
    const expectedArchive = archiveFortuneReport(report, input, asOf);
    assertParity(result, { ...expectedArchive, calculatedAt: result.calculatedAt });
  }

  const invalid = await ask({ name: 'calculateDestiny', profile: { ...a, date: { ...a.date, month: 13 } } });
  assert.equal(invalid.error, '请核对出生日期、时间和性别。');

  // Use the exact generated native asset as a file, without the Web app server.
  const nativeContext = await browser.newContext();
  const nativeRequests = [];
  await nativeContext.route('**/*', (route) => {
    const url = route.request().url();
    if (url === nativeRunner) return route.continue();
    nativeRequests.push(url);
    return route.abort();
  });
  const native = await nativeContext.newPage();
  await native.addInitScript(() => {
    window.JovianCompute = { postMessage(value) {
      if (value === 'ready') window.jovianReady = true;
      else window.jovianReply?.(value);
    } };
  });
  await native.goto(nativeRunner);
  await native.waitForFunction(() => window.jovianReady === true);
  const askNative = (request) => native.evaluate((encoded) => new Promise((done, fail) => {
    const runner = window.jovianNativeCompute;
    const stages = [];
    let buffer = '';
    let pieces = 0;
    const timer = setTimeout(() => fail(new Error('Local native asset timed out')), 180_000);
    window.jovianReply = (part) => {
      buffer += part.slice(1);
      pieces++;
      if (part[0] === '0') return;
      const { stage, result, error } = JSON.parse(buffer);
      buffer = '';
      if (stage) stages.push(stage);
      else {
        clearTimeout(timer);
        runner.close();
        done({ stages, result, error, pieces });
      }
    };
    for (let offset = 0; offset < encoded.length; offset += 48 * 1024) {
      runner.append(encoded.slice(offset, offset + 48 * 1024));
    }
    runner.run();
  }), Buffer.from(JSON.stringify(request), 'utf8').toString('base64'));

  const nativeReading = await askNative({ name: 'calculateDestiny', profile: a });
  assert.deepEqual(nativeReading.stages, progress);
  assertParity(nativeReading.result, result.result);
  assertParity((await askNative(restore)).result, presentation);
  const nativePartial = await askNative({ name: 'calculateDestiny', profile: {
    ...a, time: { timeKnown: false, hour: null, minute: null },
  } });
  assertParity(nativePartial.result, partial.result);
  assert.ok(nativePartial.pieces > progress.length + 1, 'Large candidates use more than one bridge message');
  assertParity((await askNative({ name: 'compareSynastry', ...subjects })).result, fact.result);
  assertParity((await askNative({ name: 'buildFortuneFactSubmission', ...fortune })).result, batch.result);
  for (const operation of [...previewOperations, ...calendarOperations]) {
    assertParity((await askNative(operation)).result, (await ask(operation)).result);
  }
  assert.equal((await askNative({ name: 'not_supported' })).error, '不支持的本机计算类型。');
  assert.deepEqual(nativeRequests, []);
  await nativeContext.close();
  assert.deepEqual(externalRequests, []);
  console.log('Chrome parity: Dart Web bridge, native file worker, long replies, natal reading, manual chart, synastry, fortune and no external requests.');
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
