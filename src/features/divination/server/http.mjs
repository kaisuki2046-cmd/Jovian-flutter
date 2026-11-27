import { createServer } from 'node:http';
import { ReadingTaskError } from './reading-tasks.mjs';
import { maxReportBodyBytes } from '../../../shared/content-limits.mjs';
import { ModelPermissionError } from '../../account/server-entry.mjs';

function send(response, status, body) {
  if (response.destroyed) return;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new ReadingTaskError(415, 'expected_json');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxReportBodyBytes) throw new ReadingTaskError(413, 'body_too_large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ReadingTaskError(400, 'invalid_json');
  }
}

export function createReadingServer({ tasks, hosts, origins, readPermission }) {
  const createCounts = new Map();
  const cleanup = setInterval(() => {
    createCounts.clear();
    tasks.clearExpired();
  }, 60_000);
  cleanup.unref();

  function countRequest(request) {
    const ip = request.socket.remoteAddress;
    const count = createCounts.get(ip) ?? 0;
    if (count >= 30) throw new ReadingTaskError(429, 'too_many_requests');
    createCounts.set(ip, count + 1);
  }

  const routes = {
    '/reading/shuffle': tasks.shuffle,
    '/reading/cut': tasks.cut,
    '/reading/pick': tasks.pick,
    '/reading/toss': tasks.toss,
    '/reading/numbers': tasks.numbers,
    '/reading/report': tasks.report,
    '/reading/follow-up': tasks.followUp,
  };

  const server = createServer({ headersTimeout: 5000, requestTimeout: 10000, connectionsCheckingInterval: 1000 }, async (request, response) => {
    if (!hosts.has(request.headers.host)) return send(response, 403, { error: 'host_not_allowed' });
    const origin = request.headers.origin;
    if (origin) {
      if (!origins.has(origin)) return send(response, 403, { error: 'origin_not_allowed' });
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Vary', 'Origin');
    }

    const { url, method } = request;
    if (url !== '/reading' && url !== '/reading/understand' && !Object.hasOwn(routes, url)) {
      return send(response, 404, { error: 'not_found' });
    }
    if (method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Account-Session',
      });
      response.end();
      return;
    }

    try {
      const token = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
      const access = readPermission && (() => readPermission(request.headers, 'divination.cloud_assistance'));
      const permit = access && (async (required) => {
        const { allowed, identity } = await access();
        if (token) tasks.checkOwner(token, identity);
        if (!allowed && required) throw new ModelPermissionError(428);
        return allowed;
      });
      if (access && token) tasks.checkOwner(token, (await access()).identity);
      if (method === 'GET' && url === '/reading') return send(response, 200, tasks.get(token));
      if (method !== 'POST') throw new ReadingTaskError(405, 'method_not_allowed');
      const input = await readJson(request);
      if (url === '/reading') {
        countRequest(request);
        return send(response, 201, tasks.start(input, access ? (await access()).identity : undefined));
      }
      if (url === '/reading/understand') {
        countRequest(request);
        return send(response, 200, await tasks.understandQuestion(input, permit));
      }
      return send(response, 200, await routes[url](token, input, permit));
    } catch (error) {
      if (error instanceof ReadingTaskError || error instanceof ModelPermissionError) send(response, error.status, { error: error.message });
      else send(response, 500, { error: 'reading_service_error' });
    }
  });

  server.on('close', () => { clearInterval(cleanup); tasks.close(); });
  return server;
}
