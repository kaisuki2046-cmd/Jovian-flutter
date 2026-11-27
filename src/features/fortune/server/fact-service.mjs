import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fortuneDeletionMarker } from '../server-entry.mjs';
import { link, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { register } from 'node:module';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';

register('./resolve-fortune.mjs', import.meta.url);
const { calculateFortuneFacts, factLayerVersion, factPolicies } = await import('../control/fortune-facts.ts');
const { bindClientFortuneRun, maxFortuneSubmissionBytes, readClientFactTime } = await import('./client-facts.mjs');

const ownerPattern = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/u;
const idPattern = /^[\da-f]{64}$/u;
const decompress = promisify(gunzip);

export function hashFortuneValue(value) {
  const serialized = JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  return createHash('sha256').update(serialized).digest('hex');
}

export function createFortuneRepository(directory) {
  const root = resolve(directory);
  function path(id, prefix) {
    if (!idPattern.test(id)) throw new RangeError('Invalid fortune report ID');
    return join(root, prefix + id + '.json');
  }
  async function get(id, prefix = '') {
    try {
      return JSON.parse(await readFile(path(id, prefix), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }
  async function put(record, id = record.calculationRunId, prefix = '') {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const tmp = join(root, randomUUID() + '.tmp');
    try {
      await writeFile(tmp, JSON.stringify(record), { flag: 'wx', mode: 0o600 });
      const marker = typeof record.ownerId === 'string' && fortuneDeletionMarker(root, record.ownerId);
      if (marker && existsSync(marker)) throw httpError(401);
      const target = path(id, prefix);
      await link(tmp, target);
      if (marker && existsSync(marker)) {
        await unlink(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
        throw httpError(401);
      }
      return record;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      return await get(id, prefix);
    } finally {
      await unlink(tmp).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }
  async function latestInterpretation({ ownerId, snapshotId, periodType, displayTimezone, windowStart, policyHash }) {
    let names;
    try { names = await readdir(root); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    let latest = null;
    let latestAt = -Infinity;
    for (const name of names) {
      const match = /^interpretation-([a-f\d]{64})\.json$/u.exec(name);
      if (!match) continue;
      const interpretation = await get(match[1], 'interpretation-');
      if (interpretation?.ownerId !== ownerId || (policyHash && interpretation.policyHash !== policyHash)) continue;
      const calculation = await get(interpretation.calculationRunId);
      if (calculation?.ownerId !== ownerId || calculation.natalChartSnapshotId !== snapshotId
        || calculation.input.periodType !== periodType || calculation.time.displayTimezone !== displayTimezone
        || calculation.time.window.start !== windowStart
        || !['cloud_llm', 'no_matching_knowledge'].includes(interpretation.report.generationMode)) continue;
      const at = Date.parse(calculation.createdAt ?? calculation.time.asOfUtc);
      if (at > latestAt) { latestAt = at; latest = interpretation; }
    }
    return latest;
  }
  return { get: id => get(id), put: record => put(record), latestInterpretation,
    getAdvice: id => get(id, 'advice-'),
    putAdvice: record => put(record, record.adviceId, 'advice-'),
    getInterpretation: id => get(id, 'interpretation-'),
    putInterpretation: record => put(record, record.interpretationRunId, 'interpretation-') };
}

function httpError(status) {
  return Object.assign(new Error('Fortune request failed'), { status });
}

export function createAccountArchiveLoader(baseUrl, fetcher = fetch) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('Invalid account service URL');
  }
  return async ({ ownerId, snapshotId, headers }) => {
    if (!headers.cookie && !headers.authorization) throw httpError(401);
    const path = new URL('/account/chart-snapshots/' + snapshotId, base);
    path.searchParams.set('expectedOwnerId', ownerId);
    const credentials = new Headers();
    if (headers.cookie) credentials.set('Cookie', headers.cookie);
    else if (headers.authorization) {
      credentials.set('Authorization', headers.authorization);
      credentials.set('X-App-Client', 'native');
    }
    const response = await fetcher(path, { headers: credentials, signal: AbortSignal.timeout(5000), redirect: 'error' });
    if ([401, 403, 404].includes(response.status)) throw httpError(response.status);
    if (!response.ok) throw httpError(502);
    const value = await response.json();
    if (value?.archiveId !== snapshotId) throw httpError(502);
    if (value.status === 'missing_snapshot') throw httpError(409);
    if (value.status !== 'available' || !value.chartSnapshot) throw httpError(502);
    return { snapshotId, createdAt: value.calculatedAt, chart: value.chartSnapshot };
  };
}

async function readRequest(request) {
  const encoding = request.headers['content-encoding'] ?? 'identity';
  if (encoding !== 'identity' && encoding !== 'gzip') throw httpError(415);
  const limit = encoding === 'gzip' ? 8 * 1024 * 1024 : maxFortuneSubmissionBytes;
  if (Number(request.headers['content-length']) > limit) throw httpError(413);
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size <= limit) chunks.push(bytes);
  }
  if (size > limit) throw httpError(413);
  let data = Buffer.concat(chunks);
  if (encoding === 'gzip') {
    try { data = await decompress(data, { maxOutputLength: maxFortuneSubmissionBytes }); }
    catch (error) { throw httpError(error.code === 'ERR_BUFFER_TOO_LARGE' ? 413 : 400); }
  }
  let value;
  try { value = JSON.parse(data.toString('utf8')); } catch { throw httpError(400); }
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key =>
      !['expectedOwnerId', 'snapshotId', 'periodType', 'displayTimezone', 'weekStartsOn', 'targetPeriod', 'factBatch'].includes(key))
    || typeof value.expectedOwnerId !== 'string' || !ownerPattern.test(value.expectedOwnerId)
    || typeof value.snapshotId !== 'string' || !idPattern.test(value.snapshotId)
    || (value.targetPeriod !== undefined && (!value.targetPeriod || typeof value.targetPeriod !== 'object'
      || Array.isArray(value.targetPeriod)))) throw httpError(400);
  return value;
}

export function createFortuneFactHandler({ repository, loadArchive, now = Date.now, webOrigin = 'http://localhost:8081' }) {
  const timeZoneDatabaseVersion = process.versions.tz;
  const configHash = hashFortuneValue({ factLayerVersion, factPolicies, timeZoneDatabaseVersion });
  const respond = (response, status, value) => response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  }).end(JSON.stringify(value));
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
      const url = new URL(request.url, 'http://localhost');
      const match = /^\/fortune\/reports\/([\da-f]{64})\/(facts|replay)$/u.exec(url.pathname);
      if (!match && url.pathname !== '/fortune/calculate') { response.writeHead(404).end(); return; }
      const method = match?.[2] === 'facts' ? 'GET' : 'POST';
      if (request.method === 'OPTIONS') {
        response.writeHead(204, { 'Access-Control-Allow-Methods': method,
          'Access-Control-Allow-Headers': 'Content-Type, Content-Encoding, Authorization' }).end();
        return;
      }
      if (request.method !== method) { response.writeHead(405, { Allow: method }).end(); return; }
      if (!loadArchive || !repository) throw httpError(503);
      if (match) {
        const ownerId = url.searchParams.get('expectedOwnerId');
        if (!ownerId || !ownerPattern.test(ownerId)) throw httpError(400);
        const record = await repository.get(match[1]);
        if (!record || record.ownerId !== ownerId) throw httpError(404);
        const reference = await loadArchive({ ownerId, snapshotId: record.input.snapshotId, headers: request.headers });
        if (reference.snapshotId !== record.input.snapshotId) throw httpError(502);
        const { ownerId: _, input, ...run } = record;
        if (match[2] === 'replay') {
          if (run.calculationSource === 'client') {
            const { inputHash, outputHash, configHash, timeZoneDatabaseVersion, status, createdAt, ...submitted } = run;
            if (hashFortuneValue(submitted) !== outputHash) throw httpError(409);
            respond(response, 200, { reportId: record.calculationRunId, verified: true, outputHash });
            return;
          }
          const { snapshotId: _snapshot, ...params } = input;
          if (record.configHash !== configHash
            || hashFortuneValue({ ownerId, reference, input: params, time: record.time, configHash }) !== record.inputHash) {
            throw httpError(409);
          }
          const replay = calculateFortuneFacts(params, record.time, record.calculationRunId, reference);
          if (hashFortuneValue(replay) !== record.outputHash) throw httpError(409);
          respond(response, 200, { reportId: record.calculationRunId, verified: true, outputHash: record.outputHash });
          return;
        }
        respond(response, 200, run);
        return;
      }
      const { expectedOwnerId: ownerId, snapshotId, factBatch, ...input } = await readRequest(request);
      if (url.search) throw httpError(400);
      const receivedAt = now();
      const time = readClientFactTime(input, factBatch, receivedAt);
      const reference = await loadArchive({ ownerId, snapshotId, headers: request.headers });
      if (reference.snapshotId !== snapshotId) throw httpError(502);
      const inputHash = hashFortuneValue({ ownerId, snapshotId, input, factBatch, configHash });
      let record = await repository.get(inputHash);
      if (!record) {
        const result = bindClientFortuneRun(input, factBatch, time, inputHash, reference);
        const personal = ['bazi', 'ziwei', 'western'].map(method => result.methods[method].status);
        const status = personal.every(item => item === 'completed') ? 'completed'
          : personal.some(item => item === 'completed') ? 'completed_with_warnings' : 'partial';
        const outputHash = hashFortuneValue(result);
        record = await repository.put({ ...result, ownerId, input: { ...input, snapshotId },
          inputHash, outputHash, configHash, timeZoneDatabaseVersion, status, createdAt: new Date(receivedAt).toISOString() });
      }
      const methods = Object.fromEntries(Object.entries(record.methods).map(([key, { status, warnings }]) =>
        [key, { status, warnings }]));
      respond(response, 200, { reportId: record.calculationRunId, status: record.status, methods });
    } catch (error) {
      respond(response, error.status ?? 500, { error: 'fortune_request_failed' });
    }
  };
}
