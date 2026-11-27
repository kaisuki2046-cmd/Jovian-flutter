import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpClient, RequestError } from './client.ts';

const baseUrl = 'https://api.example.test/v1';
const isKind = (kind) => (error) => error instanceof RequestError && error.kind === kind;

test('builds a request under the API prefix and parses the module response', async () => {
  const client = createHttpClient({
    baseUrl,
    getAccessToken: async () => 'token',
    transport: async (url, options) => {
      assert.equal(url, 'https://api.example.test/v1/readings?theme=%E6%9C%88+%26&size=0&saved=false');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.get('authorization'), 'Bearer token');
      assert.equal(options.headers.get('content-type'), 'application/json');
      assert.equal(options.body, '{"date":"2026-11-09"}');
      assert.equal(options.redirect, 'error');
      assert.equal(options.credentials, 'omit');
      return Response.json({ id: 'example' });
    },
  });

  const id = await client.request('/readings', {
    method: 'POST',
    body: { date: '2026-11-09' },
    query: { theme: '月 &', size: 0, saved: false, ignored: null },
    authenticated: true,
    parse(body) {
      assert.equal(typeof body.id, 'string');
      return body.id;
    },
  });
  assert.equal(id, 'example');
});

test('does not attach a token to public requests and supports empty responses', async () => {
  const client = createHttpClient({
    baseUrl,
    getAccessToken: () => assert.fail('public requests should not ask for a token'),
    transport: async (_, options) => {
      assert.equal(options.headers.has('authorization'), false);
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(await client.request('/example', { method: 'DELETE', response: 'empty' }), undefined);
});

test('only includes browser cookies when the caller opts in', async () => {
  const client = createHttpClient({
    baseUrl,
    transport: async (_, options) => {
      assert.equal(options.credentials, 'include');
      return new Response(null, { status: 204 });
    },
  });
  await client.request('/session', { credentials: 'include', response: 'empty' });
});

test('rejects invalid configuration, unsafe paths, and missing credentials before transport', async () => {
  const transport = async () => assert.fail('should not send a request');
  const client = createHttpClient({ baseUrl, transport });
  await assert.rejects(createHttpClient({ transport }).request('/example', { response: 'empty' }), isKind('configuration'));
  await assert.rejects(client.request('//elsewhere.test/example', { response: 'empty' }), isKind('request'));
  await assert.rejects(client.request('/%2e%2e/example', { response: 'empty' }), isKind('request'));
  await assert.rejects(client.request('/example', { body: {}, response: 'empty' }), isKind('request'));
  await assert.rejects(client.request('/example', { authenticated: true, response: 'empty' }), isKind('auth'));
});

test('reports network, HTTP and invalid response errors distinctly', async () => {
  const network = createHttpClient({ baseUrl, transport: async () => { throw new TypeError('offline'); } });
  await assert.rejects(network.request('/example', { response: 'empty' }), isKind('network'));

  const http = createHttpClient({
    baseUrl,
    transport: async () => new Response(null, { status: 403, headers: { 'x-request-id': 'trace-id' } }),
  });
  await assert.rejects(http.request('/example', { response: 'empty' }), {
    name: 'RequestError', kind: 'http', status: 403, requestId: 'trace-id',
  });

  const json = createHttpClient({ baseUrl, transport: async () => new Response('invalid JSON') });
  await assert.rejects(json.request('/example', { parse: (body) => body }), isKind('response'));
});

test('distinguishes deadline expiry from cancellation during transport', async () => {
  let transportSignal;
  const client = createHttpClient({
    baseUrl,
    timeoutMs: 15,
    transport: (_, { signal }) => {
      transportSignal = signal;
      return new Promise(() => {});
    },
  });
  await assert.rejects(client.request('/example', { response: 'empty' }), isKind('timeout'));
  assert.equal(transportSignal.aborted, true);

  const caller = new AbortController();
  const pending = client.request('/example', { response: 'empty', signal: caller.signal });
  caller.abort();
  await assert.rejects(pending, isKind('cancelled'));
  assert.equal(transportSignal.aborted, true);
});

test('does not send a request when the caller aborts during token lookup', async () => {
  let completeToken;
  let sent = false;
  const client = createHttpClient({
    baseUrl,
    getAccessToken: () => new Promise((resolve) => { completeToken = resolve; }),
    transport: async () => {
      sent = true;
      return new Response(null, { status: 204 });
    },
  });

  const caller = new AbortController();
  const pending = client.request('/example', { authenticated: true, response: 'empty', signal: caller.signal });
  caller.abort();
  await assert.rejects(pending, isKind('cancelled'));
  completeToken('late-token');
  await new Promise(setImmediate);
  assert.equal(sent, false);
});
