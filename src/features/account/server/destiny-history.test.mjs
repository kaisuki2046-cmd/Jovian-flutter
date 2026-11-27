import { withSignInAgreement } from './sign-in-fixture.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createDestinyHistoryControl } from '../history/control/server-destiny-history.mjs';
import { parseDestinyArchive } from '../history/model/destiny-archive.mjs';
import { tokenHash } from '../auth/model/session-secret.mjs';
import { openAccountStore } from '../storage/account-store.mjs';
import { createAccountHandler } from './handler.mjs';
import { Readable } from 'node:stream';
import { maxReportBodyBytes, maxReportDetailLength, maxReportTextLength } from '../../../shared/content-limits.mjs';

const origin = 'http://localhost:8081';
const ttl = 7 * 24 * 60 * 60 * 1000;
const history = '/destiny-history';
const guestRoute = '/auth/guest';
const native = { 'X-App-Client': 'native' };
const bearer = (token) => ({ ...native, Authorization: 'Bearer ' + token });
const expected = (ownerId) => '?expectedOwnerId=' + ownerId;

function reportAt(time = 0) {
  return {
    version: 1, calculatedAt: new Date(Date.UTC(2026, 10, 10) + time).toISOString(),
    timeKnown: false, mode: 'local', overview: '测试报告',
    charts: ['bazi', 'ziwei', 'western'].map((method) => ({
      method, engine: 'fixture 1', note: '出生时刻未确定', rows: [{ label: '稳定字段', value: '摘要' }],
    })),
  };
}

async function withServer(store, now, run) {
  const authProvider = {
    namespace: 'test',
    async exchangeSocial({ authorizationCode }) {
      if (authorizationCode) return { subject: authorizationCode, displayName: '测试会员' };
    },
  };
  const server = createServer(createAccountHandler({ store, webOrigin: origin, now, authProvider }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/account';
  const send = (path, headers = native, body, method = body === undefined ? 'GET' : 'POST') =>
    fetch(base + path, {
      method, headers: { ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(withSignInAgreement(path, body)),
    });
  try {
    await run(send);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('archives long reports above the former body limit without truncation and retains ownership and size checks', async () => {
  const store = openAccountStore(':memory:');
  try {
    await withServer(store, Date.now, async (send) => {
      const guest = await json(await send(guestRoute, native, {}), 201);
      const headers = bearer(guest.token);
      const report = reportAt();
      report.overview = '完整报告。'.repeat(16_000);
      report.charts[0].rows = Array.from({ length: 12 }, (_, index) => ({
        label: '盘面 ' + index, value: '字'.repeat(maxReportDetailLength),
      }));
      const body = { expectedOwnerId: guest.id, report };
      assert.ok(Buffer.byteLength(JSON.stringify(body)) > 512 * 1024);
      const saved = await json(await send(history, headers, body));
      const replay = await json(await send(history + '/' + saved.id + expected(guest.id), headers));
      assert.deepEqual(replay.report, report);
      const other = await json(await send(guestRoute, native, {}), 201);
      assert.equal((await send(history + '/' + saved.id + expected(guest.id), bearer(other.token))).status, 403);
      assert.equal((await send(history, headers, { ...body, report: { ...report,
        overview: '字'.repeat(maxReportTextLength + 1) } })).status, 400);
      const request = Object.assign(Readable.from([Buffer.from('{}')]), {
        url: '/account' + history, method: 'POST', socket: { remoteAddress: '127.0.0.1' },
        headers: { 'x-app-client': 'native', authorization: 'Bearer ' + guest.token,
          'content-type': 'application/json', 'content-length': String(maxReportBodyBytes + 1) },
      });
      let status;
      await createAccountHandler({ store, webOrigin: origin, now: Date.now })(request, {
        setHeader() {}, writeHead(code) { status = code; return this; }, end() {},
      });
      assert.equal(status, 413);
    });
  } finally { store.close(); }
});

async function json(response, status = 200) {
  assert.equal(response.status, status);
  return response.json();
}

test('legacy archived headings and paragraphs survive history reads with their original IDs', async () => {
  const store = openAccountStore(':memory:');
  const time = Date.now();
  try {
    await withServer(store, () => time, async (send) => {
      const guest = await json(await send(guestRoute, native, {}), 201);
      const headers = bearer(guest.token);
      const owner = { kind: 'guest', id: guest.id };
      const suffix = expected(guest.id);
      const { charts, ...meta } = reportAt();
      const seed = report => {
        const serialized = JSON.stringify(report);
        const id = createHash('sha256').update(serialized).digest('hex');
        const entry = store.saveDestinyArchive(owner, tokenHash(guest.token), time, id, report, serialized);
        assert.ok(entry);
        return entry;
      };
      const empty = seed({ ...meta, sections: [], charts });
      assert.deepEqual(await json(await send(history, headers, { expectedOwnerId: guest.id, report: reportAt() })), empty);
      const paragraphs = ['第一段', '字'.repeat(20_000), '第三段'];
      const overview = '字'.repeat(maxReportTextLength);
      const saved = seed({ ...meta, overview,
        sections: [{ title: '阶段', angle: '总体', uncertain: true, paragraphs, evidence: [] }], charts,
      });
      const latest = await json(await send(history + '/latest' + suffix, headers));
      assert.deepEqual(latest, await json(await send(history + '/' + saved.id + suffix, headers)));
      assert.equal(latest.id, saved.id);
      assert.deepEqual(latest.report, { ...reportAt(), overview: [overview, '## 阶段', ...paragraphs].join('\n\n') });
      assert.deepEqual(JSON.parse(JSON.stringify(parseDestinyArchive(latest.report, { readingHistory: true }))), latest.report);
      const legacyInput = { ...reportAt(), sections: [{ title: '综合', angle: '总体', uncertain: false,
        paragraphs: ['一', '二', '三'], evidence: [] }] };
      const converted = await json(await send(history, headers, { expectedOwnerId: guest.id, report: legacyInput }));
      const convertedReport = await json(await send(history + '/' + converted.id + suffix, headers));
      assert.deepEqual(convertedReport.report, { ...reportAt(), overview: '测试报告\n\n## 综合\n\n一\n\n二\n\n三' });
    });
  } finally { store.close(); }
});

test('member archive replay is private, paginates ties, and uses the latest save', async () => {
  const store = openAccountStore(':memory:');
  const time = Date.now();
  try {
    await withServer(store, () => time, async (send) => {
      const owner = await json(await send('/auth/social/wechat', native, { authorizationCode: 'member-a' }), 201);
      const other = await json(await send('/auth/social/wechat', native, { authorizationCode: 'member-b' }), 201);
      const headers = bearer(owner.token);
      const id = owner.user.id;
      const suffix = expected(id);
      const latest = history + '/latest' + suffix;
      assert.equal(await json(await send(latest, headers)), null);
      assert.equal((await send(latest, bearer(other.token))).status, 403);
      assert.equal((await send(history, headers)).status, 400);
      assert.equal((await send(history, headers, { expectedOwnerId: other.user.id, report: reportAt() })).status, 403);
      assert.equal((await send(history, headers, { expectedOwnerId: id, report: { ...reportAt(), charts: [] } })).status, 400);
      const save = async (report) => json(await send(history, headers, { expectedOwnerId: id, report }));
      const first = await save({ ...reportAt(), birthPlace: '不应归档的额外字段' });
      assert.deepEqual(await save(reportAt()), first);
      let last;
      for (let offset = 1; offset <= 20; offset++) last = await save(reportAt(offset));
      assert.notEqual(last.id, first.id);
      assert.deepEqual(await json(await send(latest, headers)), { ...last, report: reportAt(20) });
      assert.deepEqual((await json(await send(history + '/' + first.id + suffix, headers))).report, reportAt());
      const firstPage = await json(await send(history + suffix, headers));
      const secondPage = await json(await send(history + suffix + '&before=' + firstPage.nextCursor, headers));
      assert.equal(firstPage.entries.length, 20);
      assert.deepEqual(secondPage, { entries: [first], nextCursor: null });
      assert.equal((await send(history + '/' + first.id + expected(other.user.id), bearer(other.token))).status, 404);
      assert.equal((await send(history + expected(other.user.id) + '&before=' + first.id, bearer(other.token))).status, 404);

      const reading = { birthDate: '2000-02-29', birthTime: '', birthPlace: '私人出生地', gender: 'other',
        visibility: { birthDate: false, birthTime: false, birthPlace: false, gender: false } };
      assert.equal((await send('/reading-profile', headers, reading, 'PATCH')).status, 200);
      assert.deepEqual(await json(await send('/reading-profile/wheel-defaults', headers)), { birthDate: reading.birthDate, birthTime: '' });
      assert.deepEqual(await json(await send('/reading-profile/wheel-defaults', bearer(other.token))), { birthDate: '', birthTime: '' });

      const anotherDevice = await json(await send('/auth/social/wechat', native, { authorizationCode: 'member-a' }));
      assert.equal(anotherDevice.user.id, id);
      assert.equal((await json(await send(latest, bearer(anotherDevice.token)))).id, last.id);
    });
  } finally {
    store.close();
  }
});

test('guest archives survive restart with the same cookie or bearer and expire with the session', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'app-guest-archive-'));
  const path = join(dir, 'account.sqlite');
  let store = openAccountStore(path);
  let time = Date.now();
  let guest;
  let cookie;
  let phoneGuest;
  let saved;
  try {
    await withServer(store, () => time, async (send) => {
      const web = await send(guestRoute, { Origin: origin }, {});
      assert.match(web.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Max-Age=604800/);
      cookie = { Origin: origin, Cookie: web.headers.get('set-cookie').split(';')[0] };
      guest = await json(web, 201);
      assert.equal(guest.expiresAt, time + ttl);
      assert.equal(guest.token, undefined);
      assert.deepEqual(await json(await send(guestRoute, cookie, {})), guest);
      const latest = history + '/latest' + expected(guest.id);
      assert.equal(await json(await send(latest, cookie)), null);
      assert.equal((await send('/session', cookie)).status, 401);
      assert.equal((await send('/reading-profile/wheel-defaults', cookie)).status, 401);
      saved = await json(await send(history, cookie, { expectedOwnerId: guest.id, report: reportAt() }));
      phoneGuest = await json(await send(guestRoute, native, {}), 201);
      assert.notEqual(phoneGuest.id, guest.id);
      assert.equal((await send(latest, bearer(phoneGuest.token))).status, 403);
      assert.equal((await send(history + '/' + saved.id + expected(phoneGuest.id), bearer(phoneGuest.token))).status, 404);
      assert.equal((await send(history, bearer(phoneGuest.token), { expectedOwnerId: guest.id, report: reportAt() })).status, 403);
      await json(await send(history, bearer(phoneGuest.token), { expectedOwnerId: phoneGuest.id, report: reportAt(2) }));
    });
    store.close();
    store = openAccountStore(path);
    await withServer(store, () => time, async (send) => {
      assert.deepEqual(await json(await send(guestRoute, cookie)), guest);
      const latest = history + '/latest' + expected(guest.id);
      assert.deepEqual(await json(await send(latest, cookie)), { ...saved, report: reportAt() });
      const nativeArchive = await json(await send(history + '/latest' + expected(phoneGuest.id), bearer(phoneGuest.token)));
      assert.deepEqual(nativeArchive.report, reportAt(2));
      time = guest.expiresAt;
      assert.equal((await send(guestRoute, cookie)).status, 401);
      assert.equal((await send(latest, cookie)).status, 401);
      store.purgeGuests(time);
      assert.equal(store.getLatestDestinyArchive({ kind: 'guest', id: guest.id }), undefined);
      assert.equal(store.getLatestDestinyArchive({ kind: 'guest', id: phoneGuest.id }), undefined);
    });
  } finally {
    store.close();
    await rm(path, { force: true });
    await rmdir(dir);
  }
});

test('switching identities or exiting revokes guest archives and rejects an in-flight save', async () => {
  const store = openAccountStore(':memory:');
  try {
    await withServer(store, Date.now, async (send) => {
      const guest = await json(await send(guestRoute, native, {}), 201);
      const headers = bearer(guest.token);
      const body = { expectedOwnerId: guest.id, report: reportAt() };
      const saved = await json(await send(history, headers, body));
      const control = createDestinyHistoryControl({ store, now: Date.now, limit() {} });
      let finishRead;
      const pending = control.save(tokenHash(guest.token), () => new Promise((resolve) => { finishRead = resolve; }));
      const member = await json(await send('/auth/social/wechat', headers, { authorizationCode: 'new-member' }), 201);
      finishRead(body);
      await assert.rejects(pending, { status: 401 });
      assert.equal((await send(guestRoute, headers)).status, 401);
      assert.equal(store.getDestinyArchive({ kind: 'guest', id: guest.id }, saved.id), undefined);
      assert.equal((await send(history, bearer(member.token), body)).status, 403);
      assert.equal(await json(await send(history + '/latest' + expected(member.user.id), bearer(member.token))), null);
      assert.equal((await send(guestRoute, bearer(member.token), {})).status, 409);

      const separate = await json(await send(guestRoute, native, {}), 201);
      const separateHeaders = bearer(separate.token);
      await json(await send(history, separateHeaders, { expectedOwnerId: separate.id, report: reportAt() }));
      assert.equal((await send('/auth/logout', separateHeaders, {})).status, 204);
      assert.equal((await send(guestRoute, separateHeaders)).status, 401);
      assert.equal(store.getLatestDestinyArchive({ kind: 'guest', id: separate.id }), undefined);
    });
  } finally {
    store.close();
  }
});
