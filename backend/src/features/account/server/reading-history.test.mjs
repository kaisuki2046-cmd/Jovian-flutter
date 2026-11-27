import { withSignInAgreement } from './sign-in-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { openAccountStore } from '../storage/account-store.mjs';
import { createAccountHandler } from './handler.mjs';

function request(store) {
  const handler = createAccountHandler({ store, webOrigin: 'http://localhost:8084', now: Date.now,
    authProvider: { namespace: 'archive-test', async exchangeSocial({ authorizationCode }) {
      return { subject: authorizationCode, displayName: '虚构测试账号' };
    } } });
  return async (path, token, body) => {
    const input = Object.assign(Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(withSignInAgreement(path, body)))]), {
      url: '/account' + path, method: body === undefined ? 'GET' : 'POST', socket: { remoteAddress: '127.0.0.1' },
      headers: { 'x-app-client': 'native', authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    });
    let status, result;
    await handler(input, { setHeader() {}, writeHead(code) { status = code; return this; }, end(value) { result = value ? JSON.parse(value) : undefined; } });
    return { status, body: result };
  };
}
function report(kind, index = 0) {
  const keys = kind === 'fortune' ? ['overall', 'wealth', 'romance'] : ['family', 'friendship', 'romance', 'collaboration'];
  return { version: 1, kind, title: '完整解读 ' + index, contextKey: 'test-context:' + index,
    calculatedAt: new Date(Date.UTC(2026, 10, 18, 0, index)).toISOString(),
    sections: keys.map(id => ({ id, title: id, body: '原始解读正文包含全部内容。'.repeat(50) })),
    context: kind === 'fortune' ? { snapshotId: 'a'.repeat(64), reportId: 'b'.repeat(64), calculationRunId: 'c'.repeat(64),
      periodType: 'month', displayTimezone: 'Asia/Shanghai', windowStart: 1, windowEnd: 2 } : {} };
}

test('private fortune and synastry archives survive restart, deduplicate, paginate, and retain full text', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'app-reading-history-'));
  const path = join(directory, 'account.sqlite');
  let store = openAccountStore(path);
  try {
    let send = request(store);
    const member = (await send('/auth/social/qq', '', { authorizationCode: 'synthetic-owner' })).body;
    const other = (await send('/auth/social/qq', '', { authorizationCode: 'synthetic-other' })).body;
    const owner = member.user.id;
    const query = kind => '?expectedOwnerId=' + owner + '&kind=' + kind;
    const save = data => send('/reading-history', member.token, { expectedOwnerId: owner, report: data });
    assert.deepEqual(await send('/reading-history/latest' + query('fortune'), member.token), { status: 200, body: null });
    const fortune = report('fortune');
    const first = await save(fortune);
    assert.equal(first.status, 200);
    assert.deepEqual(first.body.report, fortune);
    assert.equal((await save(fortune)).body.id, first.body.id);
    for (let index = 1; index <= 21; index++) assert.equal((await save(report('fortune', index))).status, 200);
    const synastry = await save(report('synastry'));
    assert.equal(synastry.status, 200);
    const page = (await send('/reading-history' + query('fortune'), member.token)).body;
    assert.equal(page.entries.length, 20);
    assert.ok(page.nextCursor);
    const next = (await send('/reading-history' + query('fortune') + '&before=' + page.nextCursor, member.token)).body;
    assert.equal(next.entries.length, 2);
    assert.equal((await send('/reading-history/' + first.body.id + query('fortune'), other.token)).status, 403);
    assert.equal((await send('/reading-history/' + first.body.id + '?kind=fortune&expectedOwnerId=' + other.user.id, other.token)).status, 404);
    assert.equal((await send('/reading-history/' + first.body.id + query('synastry'), member.token)).status, 404);
    assert.equal((await save({ ...fortune, sections: [] })).status, 400);
    store.close(); store = openAccountStore(path); send = request(store);
    assert.deepEqual((await send('/reading-history/latest' + query('fortune') + '&contextKey=test-context%3A0', member.token)).body.report, fortune);
    assert.deepEqual((await send('/reading-history/latest' + query('synastry'), member.token)).body.report, synastry.body.report);
    await send('/auth/logout', member.token, {});
    assert.equal((await send('/reading-history' + query('fortune'), member.token)).status, 401);
    const restored = (await send('/auth/social/qq', '', { authorizationCode: 'synthetic-owner' })).body;
    assert.equal((await send('/reading-history/' + first.body.id + query('fortune'), restored.token)).body.id, first.body.id);
    const guest = (await send('/auth/guest', '', {})).body;
    assert.equal((await send('/reading-history', guest.token, { expectedOwnerId: guest.id, report: fortune })).status, 200);
    await send('/auth/logout', guest.token, {});
    assert.equal((await send('/reading-history?kind=fortune&expectedOwnerId=' + guest.id, guest.token)).status, 401);
    assert.equal(store.getReadingArchive({ kind: 'guest', id: guest.id }, 'fortune', first.body.id), undefined);
  } finally { store.close(); await rm(directory, { recursive: true, force: true }); }
});
