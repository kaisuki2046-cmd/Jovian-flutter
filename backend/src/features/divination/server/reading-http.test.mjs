
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createReadingServer } from './http.mjs';
import { createReadingTaskService } from './reading-tasks.mjs';
import { maxReportBodyBytes } from '../../../shared/content-limits.mjs';

const question = '这台旧钢琴还适合继续修吗？';
const focus = '梳理继续维修旧钢琴前要确认的条件。';
const origin = 'http://localhost:8114';

async function startServer(path, options) {
  const tasks = createReadingTaskService(path, options);
  const hosts = new Set();
  const server = createReadingServer({ tasks, hosts, origins: new Set([origin]) });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const host = '127.0.0.1:' + server.address().port;
  hosts.add(host);
  return {
    host,
    request: (path, init = {}) => fetch('http://' + host + '/reading' + path, init),
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function call(server, path, { data, token, status = 200, headers = {} } = {}) {
  const response = await server.request(path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...headers,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  assert.equal(response.status, status, path);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return response.json();
}

async function start(server, method) {
  return call(server, '', { status: 201, data: { method, question, focus } });
}

test('HTTP validation, request boundaries, local clarification and provider fallback', async () => {
  let calls = 0;
  const server = await startServer(':memory:', { understand: async (_, signal) => {
    calls++;
    assert.ok(signal instanceof AbortSignal);
    throw new DOMException('simulated timeout', 'TimeoutError');
  } });
  try {
    const preflight = await server.request('/understand', { method: 'OPTIONS', headers: { Origin: origin } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    await call(server, '/understand', { data: { question }, headers: { Origin: 'https://outside.example' }, status: 403 });
    // Fetch replaces the Host header; send this case through Node's HTTP client.
    await new Promise((resolve, reject) => {
      const request = httpRequest('http://' + server.host + '/reading', { headers: { Host: 'outside.example' } }, (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      });
      request.on('error', reject);
      request.end();
    }).then((status) => assert.equal(status, 403));
    await call(server, '/understand', { data: { question }, headers: { 'Content-Type': 'text/plain' }, status: 415 });
    await call(server, '/understand', { data: { question: 'x'.repeat(maxReportBodyBytes) }, status: 413 });
    const invalidJson = await server.request('/understand', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
    });
    assert.equal(invalidJson.status, 400);
    assert.equal((await invalidJson.json()).error, 'invalid_json');

    const vague = await call(server, '/understand', { data: { question: '我想用梅花易数' } });
    assert.ok(vague.clarification);
    assert.equal(calls, 0);
    const valid = await call(server, '/understand', { data: { question } });
    assert.equal(valid.source, 'local');
    assert.equal(valid.clarification, '');
    assert.equal(calls, 1);
    await call(server, '', { status: 400, data: { question: '我想用梅花易数', focus, method: 'meihua' } });
    await call(server, '', { status: 400, data: { question: '帮我预测炒股能赚多少钱', focus, method: 'tarot' } });
    await call(server, '', { status: 400, data: { question, focus, method: 'unknown' } });
    await call(server, '', { status: 401 });
    await call(server, '', { token: 'A'.repeat(43), status: 404 });
  } finally {
    await server.close();
  }
});

test('Tarot HTTP keeps hidden faces private and binds report and follow-ups to one draw', async () => {
  const fixed = Date.UTC(2026, 0, 1, 12);
  const server = await startServer(':memory:', { random: () => 0, now: () => fixed });
  try {
    const { token, task } = await start(server, 'tarot');
    assert.equal(task.stage, 'shuffle');
    assert.equal(task.slotCount, 0);
    await call(server, '/toss', { token, data: { step: 0 }, status: 409 });
    await call(server, '/cut', { token, data: { point: 19 }, status: 409 });
    const shuffled = await call(server, '/shuffle', { token, data: {} });
    assert.equal(shuffled.deck, undefined);
    const cut = await call(server, '/cut', { token, data: { point: 39 } });
    assert.equal(cut.stage, 'draw');
    assert.equal(cut.slotCount, 9);
    assert.equal(cut.cut, 39);
    assert.equal(cut.picking, undefined);
    await call(server, '/report', { token, data: {}, status: 409 });
    const first = await call(server, '/pick', { token, data: { step: 0, slot: 4 } });
    assert.equal(first.draw, undefined);
    assert.deepEqual(await call(server, '/pick', { token, data: { step: 0, slot: 4 } }), first);
    await call(server, '/pick', { token, data: { step: 1, slot: 2 } });
    const complete = await call(server, '/pick', { token, data: { step: 2, slot: 0 } });
    assert.equal(complete.resolvedAt, new Date(fixed).toISOString());
    assert.equal(complete.ruleVersion, 'rws-three-card-v1');
    assert.deepEqual(complete.selectedSlots, [4, 2, 0]);
    assert.equal(new Set(complete.draw.cards.map(({ card }) => card.id)).size, 3);
    assert.ok(complete.draw.cards.every(({ orientation }) => orientation === 'upright'));
    assert.deepEqual(complete.evidence.map(({ id }) => id), complete.draw.cards.map(({ card, orientation, position }) =>
      position + ':' + card.id + ':' + orientation));
    const initial = await call(server, '/report', { token, data: {} });
    assert.deepEqual(await call(server, '/report', { token, data: {} }), initial);
    assert.equal(initial.report.schemaVersion, 1);
    assert.equal(initial.report.method, 'tarot');
    assert.equal(initial.report.source, 'local');
    await call(server, '/follow-up', { token, data: { step: 0, question: '这只股票会涨吗？' }, status: 400 });
    const follow = { step: 0, question: '为什么要先核实？' };
    const updated = await call(server, '/follow-up', { token, data: follow });
    assert.deepEqual(await call(server, '/follow-up', { token, data: follow }), updated);
    await call(server, '/follow-up', { token, data: { ...follow, question: '什么时候？' }, status: 409 });
    assert.deepEqual(updated.draw, complete.draw);
    assert.deepEqual(updated.evidence, complete.evidence);
    assert.deepEqual(updated.followUps[0].report.evidenceIds, [complete.evidence[1].id]);
  } finally {
    await server.close();
  }
});

test('Liu Yao survives server restart without consuming any extra random values', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jovian-reading-http-'));
  const path = join(directory, 'test.sqlite');
  let n = 0;
  let clock = Date.UTC(2026, 0, 1);
  const inputs = [[3, 3, 3], [2, 3, 3], [2, 2, 3], [2, 2, 2], [2, 2, 3], [2, 3, 3]];
  const expected = inputs.flat();
  const options = { now: () => clock, random: () => expected[n++] === 2 ? 0.1 : 0.9 };
  let server = await startServer(path, options);
  try {
    const { token } = await start(server, 'liuyao');
    await call(server, '/toss', { token, data: { step: 1 }, status: 409 });
    for (let step = 0; step < 2; step++) await call(server, '/toss', { token, data: { step } });
    await server.close();
    server = await startServer(path, options);
    const resumed = await call(server, '', { token });
    assert.deepEqual(resumed.tosses, inputs.slice(0, 2));
    assert.deepEqual(await call(server, '/toss', { token, data: { step: 1 } }), resumed);
    for (let step = 2; step < 6; step++) await call(server, '/toss', { token, data: { step } });
    const cast = await call(server, '', { token });
    assert.equal(n, 18);
    assert.deepEqual(cast.tosses, inputs);
    assert.deepEqual(cast.result.moving, [1, 4]);
    assert.deepEqual(cast.result.primary.yangLines, [true, false, true, false, true, false]);
    assert.deepEqual(cast.result.changed.yangLines, [false, false, true, true, true, false]);
    const report = await call(server, '/report', { token, data: {} });
    assert.ok(report.report.evidenceIds.every((id) => id.startsWith('liuyao:v1:')));
    const follow = await call(server, '/follow-up', { token, data: { step: 0, question: '这个卦是怎么算的？' } });
    assert.deepEqual(follow.result, cast.result);
    assert.deepEqual(follow.evidence, cast.evidence);
    assert.equal(n, 18);
    clock += 24 * 60 * 60 * 1000;
    await call(server, '', { token, status: 404 });
  } finally {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('Meihua uses only validated numbers and does not accept a replacement cast', async () => {
  let n = 0;
  const server = await startServer(':memory:', { random: () => { n++; return 0; } });
  try {
    const { token } = await start(server, 'meihua');
    for (const invalid of [[0, 8, 14], [8, 8, '14'], [8, 8, 14.5], [8, 8, 1000], [8, 8]]) {
      await call(server, '/numbers', { token, data: { numbers: invalid }, status: 400 });
    }
    await call(server, '/toss', { token, data: { step: 0 }, status: 409 });
    const numbers = [8, 8, 14];
    const cast = await call(server, '/numbers', { token, data: { numbers, result: { moving: 2 } } });
    assert.deepEqual(cast.result.inputs, numbers);
    assert.equal(cast.result.primary.upper, '坤');
    assert.equal(cast.result.primary.lower, '坤');
    assert.equal(cast.result.moving, 6);
    assert.deepEqual(cast.result.changed.yangLines, [false, false, false, false, false, true]);
    assert.deepEqual(await call(server, '/numbers', { token, data: { numbers } }), cast);
    await call(server, '/numbers', { token, data: { numbers: [8, 8, 15] }, status: 409 });
    const report = await call(server, '/report', { token, data: {} });
    assert.ok(report.report.evidenceIds.every((id) => id.startsWith('meihua:v1:')));
    assert.match(report.evidence[1].plain, /用变卦中间四爻/);
    const follow = await call(server, '/follow-up', { token, data: { step: 0, question: '怎么看互卦？' } });
    assert.deepEqual(follow.result, cast.result);
    assert.deepEqual(follow.evidence, cast.evidence);
    assert.equal(n, 0);
  } finally {
    await server.close();
  }
});

test('old Tarot sessions retain their draw and questions, replacing old free-text reports', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jovian-reading-legacy-'));
  const path = join(directory, 'test.sqlite');
  const server = await startServer(path, { random: () => 0.9 });
  try {
    const { token } = await start(server, 'tarot');
    await call(server, '/shuffle', { token, data: {} });
    await call(server, '/cut', { token, data: { point: 19 } });
    for (let step = 0; step < 3; step++) await call(server, '/pick', { token, data: { step, slot: step } });
    const complete = await call(server, '', { token });
    const digest = createHash('sha256').update(token).digest('hex');
    const db = new DatabaseSync(path);
    try {
      const { payload } = db.prepare('SELECT payload FROM tarot_sessions WHERE token_hash = ?').get(digest);
      const { question, focus, stage, cut, picking, draw, documents } = JSON.parse(payload);
      const old = { source: 'model', answer: 'untrusted old prose' };
      const legacy = { question, focus, stage, cut, picking, draw, evidence: documents, report: old,
        followUps: [{ question: '下一步可以做什么？', report: old }] };
      db.prepare('UPDATE tarot_sessions SET payload = ? WHERE token_hash = ?').run(JSON.stringify(legacy), digest);
    } finally {
      db.close();
    }
    const resumed = await call(server, '', { token });
    assert.deepEqual(resumed.draw, complete.draw);
    assert.deepEqual(resumed.evidence, complete.evidence);
    assert.equal(resumed.report.source, 'local');
    assert.equal(resumed.followUps[0].question, '下一步可以做什么？');
    assert.equal(resumed.followUps[0].report.source, 'local');
    assert.doesNotMatch(JSON.stringify(resumed), /untrusted old prose/);
  } finally {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }
});


function randomForCombined(scores) {
  const coins = scores.flatMap((score) => [
    ...Array(score - 6).fill(0.75), ...Array(9 - score).fill(0.25),
  ]);
  let calls = 0;
  return {
    random: () => {
      const index = calls++;
      if (index < 86) return 0.25; // 77 shuffles and 9 orientations.
      assert.ok(index - 86 < coins.length, 'Unexpected additional random draw.');
      return coins[index - 86];
    },
    count: () => calls,
  };
}

async function prepareCombined(server) {
  const { token, task } = await start(server, 'combined');
  assert.equal(task.stage, 'shuffle');
  assert.deepEqual(task.calculationRules, {
    tarot: 'rws-three-card-v1', liuyao: 'three-coin-v1', meihua: 'first-three-liuyao-lines-v1',
  });
  await call(server, '/report', { token, data: {}, status: 409 });
  await call(server, '/toss', { token, data: { step: 0 }, status: 409 });
  await call(server, '/numbers', { token, data: { numbers: [6, 7, 8] }, status: 409 });
  await call(server, '/shuffle', { token, data: {} });
  const cut = await call(server, '/cut', { token, data: { point: 39 } });
  assert.equal(cut.slotCount, 9);
  assert.equal(cut.deck, undefined);
  assert.equal(cut.picking, undefined);
  assert.equal(cut.draw, undefined);
  for (const [step, slot] of [0, 2, 8].entries()) {
    const picked = await call(server, '/pick', { token, data: { step, slot } });
    if (step < 2) {
      assert.equal(picked.stage, 'draw');
      assert.equal(picked.draw, undefined);
    } else {
      assert.equal(picked.stage, 'cast');
      assert.deepEqual(picked.draw.cards.map((card) => [card.slot, card.orientation]), [[0, 'upright'], [2, 'upright'], [8, 'upright']]);
      assert.equal(new Set(picked.draw.cards.map(({ card }) => card.id)).size, 3);
    }
  }
  return token;
}

async function tossCombined(server, token, startStep = 0, stopStep = 6) {
  let task;
  for (let step = startStep; step < stopStep; step++) {
    const data = { step };
    task = await call(server, '/toss', { token, data });
    assert.deepEqual(await call(server, '/toss', { token, data }), task);
    assert.equal(task.tosses.length, step + 1);
  }
  return task;
}

test('combined HTTP restores legacy charts and local follow-ups', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jovian-combined-'));
  const path = join(directory, 'test.sqlite');
  const rng = randomForCombined([6, 7, 8, 9, 7, 8]);
  const serverOptions = { random: rng.random };
  let server = await startServer(path, serverOptions);
  try {
    const token = await prepareCombined(server);
    const partial = await tossCombined(server, token, 0, 3);
    await server.close();
    server = await startServer(path, serverOptions);
    assert.deepEqual(await call(server, '', { token }), partial);

    const resolved = await tossCombined(server, token, 3);
    assert.equal(resolved.stage, 'reading');
    assert.deepEqual(resolved.results.liuyao.lines.map(({ value }) => value), [6, 7, 8, 9, 7, 8]);
    assert.deepEqual(resolved.results.liuyao.moving, [1, 4]);
    assert.equal(resolved.results.liuyao.primary.name, '泽水困');
    assert.equal(resolved.results.liuyao.changed.name, '水泽节');
    const { meihua, meihuaInputSource } = resolved.results;
    assert.equal(meihuaInputSource, 'liuyao-first-three-lines');
    assert.deepEqual(meihua.inputs, [6, 7, 8]);
    assert.equal(meihua.primary.name, '水山蹇');
    assert.equal(meihua.moving, 3);
    assert.equal(meihua.changed.name, '水地比');
    assert.equal(meihua.nuclear.name, '火水未济');
    assert.equal(resolved.evidence.length, 7);
    assert.equal(rng.count(), 104);

    const complete = await call(server, '/report', { token, data: {} });
    assert.deepEqual(complete.results, resolved.results);
    assert.equal(complete.report.source, 'local');

    const data = { step: 0, question: '怎么看梅花易数的依据？' };
    const followUp = await call(server, '/follow-up', { token, data });
    assert.deepEqual(followUp.results, complete.results);
    assert.deepEqual(followUp.draw, complete.draw);
    assert.equal(followUp.followUps[0].question, data.question);
    assert.ok(followUp.followUps[0].report.evidenceIds.every((id) => id.startsWith('meihua:')));
    assert.deepEqual(await call(server, '/follow-up', { token, data }), followUp);
    await server.close();
    server = await startServer(path, serverOptions);
    assert.deepEqual(await call(server, '', { token }), followUp);
    assert.deepEqual(await call(server, '/report', { token, data: {} }), followUp);
    assert.equal(rng.count(), 104);
  } finally {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('later Liu Yao tosses change its chart but leave Meihua unchanged, with no API configured', async () => {
  const read = async (scores) => {
    const server = await startServer(':memory:', { random: randomForCombined(scores).random });
    try {
      const token = await prepareCombined(server);
      await tossCombined(server, token);
      return await call(server, '/report', { token, data: {} });
    } finally {
      await server.close();
    }
  };
  const [first, second] = await Promise.all([read([6, 7, 8, 9, 7, 8]), read([6, 7, 8, 6, 6, 6])]);
  assert.deepEqual(first.results.meihua, second.results.meihua);
  assert.deepEqual(second.results.meihua.inputs, [6, 7, 8]);
  assert.equal(second.results.liuyao.primary.name, '地水师');
  assert.equal(second.results.liuyao.changed.name, '天泽履');
  assert.equal(second.report.source, 'local');
  assert.match(second.report.explanation, /塔罗｜.+六爻｜.+梅花易数｜/s);
});
