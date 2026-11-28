import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { hashPassword } from '../auth/model/password.mjs';
import { tokenHash } from '../auth/model/session-secret.mjs';
import { createAccountPermissionReader, requireModelPermission } from '../server-entry.mjs';
import { openAccountStore } from '../storage/account-store.mjs';
import { createAccountHandler } from './handler.mjs';
import { eraseDivinationAccount } from '../../divination/server-entry.mjs';
import { eraseFortuneAccount } from '../../fortune/server-entry.mjs';
import { withSignInAgreement } from './sign-in-fixture.mjs';

const a = '00000000-0000-4000-8000-00000000000a';
const b = '00000000-0000-4000-8000-00000000000b';
const c = '00000000-0000-4000-8000-00000000000c';
const origin = 'http://localhost:8081';
const testPassword = 'only-for-isolated-tests';
const proof = ({ id, version, hash }) => ({ id, version, hash });
const summary = (followers = 0, following = 0, discoverable = false) => ({ followers, following, discoverable });

function addUser(store, id, password = {}) {
  const secret = randomBytes(32).toString('base64url');
  const now = Date.now();
  store.register({ id, email: id + '@example.invalid', displayName: 'Fixture ' + id.at(-1), salt: null, passwordHash: null, ...password,
    tokenHash: tokenHash(secret), expiresAt: now + 60_000, now });
  return secret;
}

async function start(t, store, options = {}) {
  const server = createServer(createAccountHandler({ store, webOrigin: origin, ...options }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = 'http://127.0.0.1:' + server.address().port;
  function as(secret, web = false) {
    return async (path, body, method = 'POST') => {
      const headers = web ? { Origin: origin, ...(secret ? { Cookie: 'app_session=' + secret } : {}) }
        : { 'X-App-Client': 'native', ...(secret ? { Authorization: 'Bearer ' + secret } : {}) };
      const response = await fetch(baseUrl + path, body === undefined ? { headers } : {
        method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() };
    };
  }
  const { data: { documents } } = await as()('/account/agreements/catalog');
  const agreements = documents.filter(({ id }) => id !== 'ai').map(proof);
  const cloud = documents.find(({ id }) => id === 'ai');
  const confirm = (call) => call('/account/agreements/confirmation', { source: 'first-use', agreements });
  return { as, baseUrl, confirm, agreements, cloud };
}

test('confirmation versions are immutable, scoped to identity, and independent of revocable AI permissions', async (t) => {
  const store = openAccountStore(':memory:');
  t.after(() => store.close());
  const tokenA = addUser(store, a);
  const { as, confirm, agreements, cloud, baseUrl } = await start(t, store);
  const alice = as(tokenA, true);
  const anonymous = as();
  const { data: guest } = await anonymous('/account/auth/guest', withSignInAgreement('/auth/guest', {}));
  const visitor = as(guest.token);
  assert.equal((await anonymous('/account/agreements')).status, 401);
  assert.equal((await alice('/account/agreements/confirmation', {
    source: 'first-use', agreements: [{ ...agreements[0], hash: 'wrong' }, agreements[1]],
  })).status, 409);
  assert.equal((await confirm(visitor)).data.requiredAccepted, true);
  assert.equal((await alice('/account/agreements')).data.requiredAccepted, false);
  assert.equal((await confirm(alice)).data.requiredAccepted, true);
  assert.equal((await confirm(alice)).data.decisions.length, 2);
  assert.equal((await alice('/account/agreements/terms/' + agreements.find(({ id }) => id === 'terms').version)).status, 200);
  const reader = createAccountPermissionReader({ baseUrl });
  const credentials = { origin, cookie: 'app_session=' + tokenA };
  const purpose = 'destiny.cloud_interpretation';
  await assert.rejects(requireModelPermission(reader, credentials, purpose), { status: 428 });
  const permission = (agreed) => alice('/account/agreements/permission', { ...proof(cloud), source: 'settings', purpose, agreed });
  assert.equal((await permission(true)).data.permissions[purpose], true);
  assert.deepEqual(await requireModelPermission(reader, credentials, purpose), { id: a, kind: 'member' });
  await assert.rejects(requireModelPermission(reader, credentials, 'synastry.cloud_interpretation'), { status: 428 });
  assert.equal((await permission(false)).data.permissions[purpose], false);
  await assert.rejects(requireModelPermission(reader, credentials, purpose), { status: 428 });
  assert.equal((await permission(false)).data.decisions.length, 4);
  assert.throws(() => store.seedAgreements([{ ...cloud, hash: 'altered' }]), /new agreement version/);
});

test('two accounts can follow, follow back, unfollow, report, block, and read only their own lists', async (t) => {
  const store = openAccountStore(':memory:');
  t.after(() => store.close());
  const tokenA = addUser(store, a);
  const tokenB = addUser(store, b);
  const { as, confirm } = await start(t, store);
  const alice = as(tokenA, true);
  const bob = as(tokenB);
  assert.equal((await as()('/social/me')).status, 401);
  assert.equal((await alice('/social/me')).status, 428);
  assert.equal((await confirm(alice)).status, 200);
  assert.equal((await confirm(bob)).status, 200);
  assert.deepEqual((await alice('/social/me')).data, summary());
  assert.equal((await alice('/social/search?id=' + b)).status, 404);
  const byNickname = '/social/search?nickname=' + encodeURIComponent(' fixture b ');
  assert.deepEqual((await alice(byNickname)).data, { items: [] });
  assert.equal((await bob('/social/discoverability', { allowed: true })).data.discoverable, true);
  const { data: { user: { uid } } } = await bob('/account/session');
  assert.match(uid, /^[1-9]\d{7}$/);
  assert.notEqual((await alice('/account/session')).data.user.uid, uid);
  const found = (await alice('/social/search?uid=' + uid)).data;
  assert.deepEqual(found, { id: b, uid, follows: false, followedBy: false, followers: 0, following: 0 });
  assert.deepEqual((await alice(byNickname)).data, { items: [] });
  assert.equal((await bob('/account/profile', {
    displayName: 'Fixture b', bio: 'private introduction', visibility: { displayName: true, bio: false },
  }, 'PATCH')).status, 200);
  assert.deepEqual((await alice(byNickname)).data, { items: [{ ...found, displayName: 'Fixture b' }] });
  assert.deepEqual((await alice('/social/search?nickname=Fixture')).data, { items: [] });
  assert.equal((await alice('/social/search?nickname=Fixture&uid=' + uid)).status, 400);
  assert.equal((await as()(byNickname)).status, 401);
  assert.equal((await bob('/social/discoverability', { allowed: false })).status, 200);
  assert.deepEqual((await alice(byNickname)).data, { items: [] });
  assert.equal((await bob('/social/discoverability', { allowed: true })).status, 200);
  assert.equal((await alice('/social/follows', { id: a, active: true })).status, 400);
  assert.equal((await alice('/social/follows', { id: b, active: true })).data.follows, true);
  assert.equal((await alice('/social/follows', { id: b, active: true })).data.followers, 1);
  assert.deepEqual((await alice('/social/me')).data, summary(0, 1));
  assert.deepEqual((await bob('/social/me')).data, summary(1, 0, true));
  assert.equal((await alice('/social/followers?userId=' + b)).data.items.length, 0);
  assert.equal((await bob('/social/followers')).data.items[0].id, a);
  assert.equal((await bob('/social/follows', { id: a, active: true })).data.followedBy, true);
  assert.equal((await alice('/social/profiles/' + b)).data.followedBy, true);
  assert.equal((await alice('/social/follows', { id: b, active: false })).data.follows, false);
  assert.equal((await bob('/social/followers')).data.items.length, 0);
  assert.equal((await bob('/social/reports', { id: a, reason: 'spam' })).data.accepted, true);
  assert.equal((await bob('/social/blocks', { id: a, active: true })).data.blocked, true);
  assert.deepEqual((await alice('/social/me')).data, summary());
  assert.equal((await alice('/social/search?id=' + b)).status, 404);
  assert.deepEqual((await alice(byNickname)).data, { items: [] });
  assert.equal((await alice('/account/profile/visible/' + b)).status, 404);
  assert.equal((await alice('/social/follows', { id: b, active: true })).status, 404);
  assert.deepEqual((await bob('/social/blocks')).data.items, [{ id: a, uid: (await alice('/account/session')).data.user.uid }]);
  assert.equal((await bob('/social/blocks', { id: a, active: false })).data.blocked, false);
  assert.equal((await alice('/social/search?id=' + b)).status, 200);
  assert.equal((await bob('/social/following')).data.items.length, 0);
});

test('sign-in requires explicit consent to the current versions before validating credentials', async (t) => {
  const store = openAccountStore(':memory:');
  t.after(() => store.close());
  const routes = ['/account/auth/login', '/account/auth/register', '/account/auth/social/wechat',
    '/account/auth/phone/login', '/account/auth/guest'];
  const { as, agreements } = await start(t, store);
  for (const route of routes) {
    assert.equal((await as()(route, {})).status, 428, route);
    assert.equal((await as()(route, { acceptance: { agreed: false, agreements } })).status, 428, route);
    const stale = [{ ...agreements[0], hash: 'stale' }, agreements[1]];
    assert.equal((await as()(route, { acceptance: { agreed: true, agreements: stale } })).status, 412, route);
  }
  const { status, data: guest } = await as()('/account/auth/guest', { acceptance: { agreed: true, agreements } });
  assert.equal(status, 201);
  const row = (await as(guest.token)('/account/agreements')).data;
  assert.equal(row.requiredAccepted, true);
  assert.equal(row.decisions.length, 2);
  assert.ok(row.decisions.every(({ source }) => source === 'sign-in'));
});

test('new follower notifications are deduplicated and scoped, and reports close only through an authorized reviewer', async (t) => {
  const store = openAccountStore(':memory:');
  t.after(() => store.close());
  const tokens = [a, b, c].map((id) => addUser(store, id));
  const { as, confirm } = await start(t, store, { moderatorIds: [c] });
  const [alice, bob, operator] = tokens.map((token, index) => as(token, index === 0));
  await Promise.all([alice, bob, operator].map(confirm));
  await bob('/social/discoverability', { allowed: true });
  assert.equal((await alice('/social/profiles/' + b)).status, 200);
  const follow = (active) => alice('/social/follows', { id: b, active });
  const simultaneous = await Promise.all([follow(true), follow(true)]);
  assert.deepEqual(simultaneous.map(({ data }) => data.followers), [1, 1]);
  const notificationPath = '/social/notifications';
  const readPath = notificationPath + '/read';
  const summaryPath = notificationPath + '/summary';
  const inbox = (await bob(notificationPath)).data;
  assert.equal(inbox.items.length, 1);
  assert.equal(inbox.items[0].actor.id, a);
  assert.deepEqual((await bob(summaryPath)).data, { unread: 1, canModerate: false, conversations: true });
  assert.deepEqual((await operator(summaryPath)).data, { unread: 0, canModerate: true, conversations: true });
  assert.equal((await alice(readPath, { id: inbox.items[0].id })).status, 404);
  assert.equal((await bob(readPath, { id: inbox.items[0].id })).data.unread, 0);
  assert.ok((await bob(notificationPath)).data.items[0].readAt);
  await follow(false);
  assert.equal((await bob(notificationPath)).data.items[0].actor, undefined);
  await follow(true);
  assert.equal((await bob(notificationPath)).data.items.length, 1);
  assert.equal((await bob(summaryPath)).data.unread, 0);
  await bob('/social/follows', { id: a, active: true });
  assert.equal((await alice(summaryPath)).data.unread, 1);
  assert.equal((await alice(readPath, { all: true })).data.unread, 0);
  const reportPath = '/social/reports';
  const queue = '/social/moderation/reports';
  const report = (await alice(reportPath, { id: b, reason: 'harassment', detail: 'report detail' })).data.report;
  assert.equal(report.status, 'pending');
  assert.equal((await alice(reportPath, { id: b, reason: 'spam' })).data.report.id, report.id);
  assert.deepEqual((await bob(reportPath)).data, { items: [] });
  assert.equal((await bob(queue)).status, 403);
  const close = { id: report.id, status: 'resolved', conclusion: 'Processed' };
  assert.equal((await alice(queue, close)).status, 403);
  assert.equal((await operator(queue)).data.items[0].detail, 'report detail');
  assert.equal((await operator(queue, close)).status, 200);
  assert.equal((await operator(queue, close)).status, 409);
  const receipt = (await alice(reportPath)).data.items[0];
  assert.equal(receipt.conclusion, 'Processed');
  assert.ok(receipt.reviewedAt);
  assert.equal(receipt.reviewerId, undefined);
  assert.equal((await alice('/social/blocks', { id: b, active: true })).status, 200);
  assert.equal((await bob(notificationPath)).data.items.length, 0);
  assert.equal((await alice(notificationPath)).data.items.length, 0);
  assert.equal((await alice(reportPath, { id: b, reason: 'spam' })).data.report.id, report.id);
  assert.equal((await alice('/social/profiles/' + b)).status, 404);
  assert.equal((await alice('/social/blocks', { id: b, active: false })).status, 200);
  assert.equal((await alice('/social/profiles/' + b)).data.follows, false);
  await follow(true);
  assert.equal((await bob(notificationPath)).data.items.length, 0);
});

test('privacy requests and their review queue enforce separate account permissions', async (t) => {
  const store = openAccountStore(':memory:');
  t.after(() => store.close());
  const tokens = [a, b, c].map((id) => addUser(store, id));
  const { as, confirm } = await start(t, store, { moderatorIds: [b], privacyReviewerIds: [c] });
  const [alice, bob, reviewer] = tokens.map((token) => as(token));
  await Promise.all([alice, bob, reviewer].map(confirm));
  const path = '/account/privacy-requests';
  const queue = path + '/review';
  assert.equal((await alice(path, { kind: 'correction', detail: ' ' })).status, 400);
  const submitted = (await alice(path, { kind: 'correction', detail: 'Correct basic profile' })).data;
  assert.equal((await alice(path, { kind: 'correction', detail: 'Duplicate' })).data.id, submitted.id);
  assert.equal((await alice(path, { kind: 'access_copy', detail: '' })).status, 200);
  assert.deepEqual((await bob(path)).data, { items: [], canReview: false });
  assert.equal((await bob(queue)).status, 403);
  assert.equal((await reviewer(path)).data.canReview, true);
  assert.equal((await reviewer(queue)).data.items.length, 2);
  const result = { id: submitted.id, conclusion: 'Corrected' };
  assert.equal((await alice(queue, result)).status, 403);
  assert.equal((await reviewer(queue, result)).data.conclusion, 'Corrected');
  assert.equal((await reviewer(queue, result)).status, 409);
  const receipt = (await alice(path)).data.items.find(({ id }) => id === submitted.id);
  assert.ok(receipt.reviewedAt);
  assert.equal(receipt.ownerId, undefined);
  assert.equal(receipt.reviewerId, undefined);
});

test('an upgrade keeps old follows and reports without backfilling notifications, and new alerts paginate timestamp ties', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'jovian-social-upgrade-'));
  const path = join(directory, 'account.sqlite');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const before = openAccountStore(path);
  addUser(before, a);
  addUser(before, b);
  before.close();
  const db = new DatabaseSync(path);
  db.exec('DROP TABLE social_follower_notifications; DROP TABLE social_report_cases;');
  db.prepare('INSERT INTO social_follows VALUES (?, ?, ?)').run(a, b, 1);
  db.prepare('INSERT INTO social_reports (reporter_id, target_id, reason, detail, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(a, b, 'spam', 'legacy report', 1);
  db.close();
  const store = openAccountStore(path);
  try {
    assert.equal(store.social.count(b).followers, 1);
    assert.equal(store.social.unread(b), 0);
    assert.equal(store.social.reportForPair(a, b).detail, 'legacy report');
    store.social.setDiscoverable(b, true);
    for (let index = 1; index <= 32; index += 1) {
      const id = '11111111-1111-4111-8111-' + String(index).padStart(12, '0');
      store.register({ id, email: id + '@example.invalid', displayName: 'New follower ' + index,
        salt: null, passwordHash: null, now: 1, tokenHash: id, expiresAt: 1000 });
      assert.equal(store.social.follow(id, b, true, 100), true);
    }
    const first = store.social.notifications(b, Number.MAX_SAFE_INTEGER, '');
    assert.equal(first.items.length, 30);
    const [time, id] = first.next.split('.');
    const rest = store.social.notifications(b, Number(time), id);
    assert.equal(rest.items.length, 2);
    assert.equal(rest.next, undefined);
    assert.equal(new Set([...first.items, ...rest.items].map(({ id }) => id)).size, 32);
  } finally {
    store.close();
  }
});

test('reauthenticated deletion revokes sessions, cascades owned archives and clears only owned model data', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'jovian-deletion-test-'));
  const dbPath = join(directory, 'account.sqlite');
  const readingPath = join(directory, 'reading.sqlite');
  const store = openAccountStore(dbPath);
  t.after(async () => { store.close(); await rm(directory, { recursive: true, force: true }); });
  const tokenA = addUser(store, a, await hashPassword(testPassword));
  const tokenB = addUser(store, b);
  const digest = value => createHash('sha256').update(value).digest('hex');
  const legacy = randomBytes(32).toString('base64url');
  const reading = new DatabaseSync(readingPath);
  reading.exec(`CREATE TABLE tarot_sessions (token_hash TEXT PRIMARY KEY, expires INTEGER, payload TEXT);
    CREATE TABLE reading_session_owners (token_hash TEXT PRIMARY KEY REFERENCES tarot_sessions(token_hash) ON DELETE CASCADE,
      owner_key TEXT NOT NULL);`);
  const add = reading.prepare("INSERT INTO tarot_sessions VALUES (?, 0, 'isolated')");
  const bind = reading.prepare('INSERT INTO reading_session_owners VALUES (?, ?)');
  add.run('a'); bind.run('a', digest('member:' + a));
  add.run('b'); bind.run('b', digest('member:' + b));
  add.run(digest(legacy));
  reading.close();
  const fortune = join(directory, 'a'.repeat(64) + '.json');
  const unrelated = join(directory, 'b'.repeat(64) + '.json');
  await writeFile(fortune, JSON.stringify({ ownerId: a }));
  await writeFile(unrelated, JSON.stringify({ ownerId: b }));
  const archive = { kind: 'fortune', contextKey: 'test', calculatedAt: new Date().toISOString(), title: 'Test' };
  store.saveReadingArchive({ kind: 'member', id: a }, tokenHash(tokenA), Date.now(), 'test-a', archive, JSON.stringify(archive));
  const { as, confirm } = await start(t, store, { eraseReadings(owner, hashes) {
    eraseDivinationAccount(owner, hashes, [readingPath]);
    eraseFortuneAccount(owner, [directory]);
  } });
  const alice = as(tokenA, true);
  const bob = as(tokenB);
  await confirm(alice);
  await confirm(bob);
  await bob('/social/discoverability', { allowed: true });
  await alice('/social/follows', { id: b, active: true });
  assert.equal((await bob('/social/notifications/summary')).data.unread, 1);
  await alice('/account/privacy-requests', { kind: 'access_copy', detail: '' });
  const { data: { receipt, method } } = await alice('/account/deletion');
  assert.equal(method, 'password');
  assert.equal((await alice('/account/deletion', { receipt, confirm: true, password: 'wrong' })).status, 422);
  assert.equal((await alice('/account/session')).status, 200);
  const result = await alice('/account/deletion', { receipt, confirm: true, password: testPassword, legacyReadingTokens: [legacy] });
  assert.equal(result.data.status, 'completed');
  assert.equal((await alice('/account/session')).status, 401);
  assert.equal((await as()('/account/deletion/status', { receipt })).data.status, 'completed');
  assert.deepEqual((await bob('/social/me')).data, summary(0, 0, true));
  assert.equal((await bob('/social/notifications')).data.items.length, 0);
  assert.equal(store.privacyRequests.list(a, Number.MAX_SAFE_INTEGER, '').items.length, 0);
  assert.equal(store.latestReadingArchive({ kind: 'member', id: a }, 'fortune', null), undefined);
  const check = new DatabaseSync(readingPath);
  assert.deepEqual(check.prepare('SELECT token_hash FROM tarot_sessions').all().map(({ token_hash }) => token_hash), ['b']);
  check.close();
  await assert.rejects(readFile(fortune), { code: 'ENOENT' });
  assert.equal(JSON.parse(await readFile(unrelated, 'utf8')).ownerId, b);
});
