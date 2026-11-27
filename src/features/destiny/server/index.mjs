import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createReportLookup } from './knowledge/report-lookup.mjs';
import { createDeepSeek, defaultDeepSeekModel, generateReport, parseInput } from './report.mjs';
import { maxReportBodyBytes } from '../../../shared/content-limits.mjs';
import { createAccountPermissionReader, ModelPermissionError, requireModelPermission } from '../../account/server-entry.mjs';

const route = '/destiny/report';
const maxBodyBytes = maxReportBodyBytes;
const reportTiebanOptions = { birthOnlyTieban: true };

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error('Body exceeds limit.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createDestinyServer({
  apiKey, model = defaultDeepSeekModel, lookup = createReportLookup(undefined, undefined, reportTiebanOptions),
  complete, allowedOrigins = [], readPermission,
} = {}) {
  const origins = new Set(allowedOrigins);
  const run = complete ?? (apiKey ? createDeepSeek({ apiKey, model }) : null);
  let active = 0;
  const attempts = new Map();
  return createServer({ requestTimeout: 12_000, headersTimeout: 8_000 }, async (request, response) => {
    function send(status, value) {
      if (response.destroyed || response.writableEnded) return;
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(value));
    }
    const origin = request.headers.origin;
    if (origin) {
      if (!origins.has(origin) && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/u.test(origin)) {
        return send(403, { error: 'Origin is not allowed.' });
      }
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Vary', 'Origin');
    }
    if (request.url !== route) return send(404, { error: 'Unknown route.' });
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, X-Account-Session' });
      return response.end();
    }
    if (request.method !== 'POST') return send(405, { error: 'Use POST.' });
    if (!run) return send(503, { error: 'Report generation is not configured.' });
    if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
      return send(415, { error: 'Use application/json.' });
    }
    if (Number(request.headers['content-length']) > maxBodyBytes) return send(413, { error: 'Request too large.' });
    const now = Date.now();
    for (const [address, item] of attempts) if (now - item.start >= 60_000) attempts.delete(address);
    const address = request.socket.remoteAddress;
    const limit = attempts.get(address) ?? { start: now, count: 0 };
    if (active >= 3 || limit.count >= 6 || attempts.size >= 512 && !attempts.has(address)) {
      return send(429, { error: 'Try again later.' });
    }
    attempts.set(address, { ...limit, count: limit.count + 1 });
    active++;
    const controller = new AbortController();
    response.once('close', () => controller.abort());
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(180_000)]);
    try {
      let input;
      try {
        input = parseInput(await readJson(request), reportTiebanOptions);
      } catch {
        return send(400, { error: 'Invalid request body.' });
      }
      if (!input) return send(422, { error: 'Invalid report data.' });
      const guardedComplete = readPermission ? async (...args) => {
        await requireModelPermission(readPermission, request.headers, 'destiny.cloud_interpretation');
        return run(...args);
      } : run;
      const result = await generateReport(input, { lookup, complete: guardedComplete, signal });
      return send(200, result);
    } catch (error) {
      if (error instanceof ModelPermissionError) return send(error.status, { error: error.message });
      return send(502, { error: 'Could not generate report.' });
    } finally {
      active--;
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const keyFile = process.env.DEEPSEEK_API_KEY_FILE?.trim();
  if (!apiKey && keyFile) {
    try {
      apiKey = readFileSync(keyFile, 'utf8').trim();
    } catch {
      throw new Error('Could not read DEEPSEEK_API_KEY_FILE.');
    }
    if (!apiKey || /\s/u.test(apiKey)) throw new Error('DEEPSEEK_API_KEY_FILE must contain one key.');
  }
  const model = process.env.DESTINY_DEEPSEEK_MODEL?.trim() || defaultDeepSeekModel;
  createDestinyServer({
    apiKey, model,
    readPermission: createAccountPermissionReader(),
    allowedOrigins: process.env.DESTINY_ALLOWED_ORIGINS?.split(',').map((item) => item.trim()).filter(Boolean),
  }).listen(Number(process.env.DESTINY_PORT ?? 8788), process.env.DESTINY_HOST ?? '127.0.0.1', () => {
    console.log('Destiny report service is ready (' + model + ').');
  });
}
