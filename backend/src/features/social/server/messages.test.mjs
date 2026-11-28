import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createRelationshipControl } from './relationships.mjs';
import { createRelationshipStore } from './relationships-store.mjs';

const alice = '10000000-0000-0000-0000-000000000001';
const bob = '20000000-0000-0000-0000-000000000002';
const other = '30000000-0000-0000-0000-000000000003';
const profiles = new Map([
  [alice, { uid: '10000001', displayName: '测试账号甲' }],
  [bob, { uid: '10000002', displayName: '测试账号乙' }],
  [other, { uid: '10000003', displayName: '测试账号丙' }],
]);
const makeNonce = number => String(number).padStart(22, '0');

function fixture(testContext) {
  const db = new DatabaseSync(':memory:');
  testContext.after(() => db.close());
  db.exec('PRAGMA foreign_keys = ON; CREATE TABLE account_users (id TEXT PRIMARY KEY);');
  for (const id of profiles.keys()) db.prepare('INSERT INTO account_users VALUES (?)').run(id);
  const store = createRelationshipStore(db, run => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const value = run();
      db.exec('COMMIT');
      return value;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
  for (const id of profiles.keys()) store.setDiscoverable(id, true);
  const handler = createRelationshipControl({
    store,
    publicFields: id => profiles.get(id),
    findUserByUid: uid => [...profiles].find(([, profile]) => profile.uid === uid)?.[0],
    findUsersByNickname: name => [...profiles].filter(([, profile]) => profile.displayName === name).map(([id]) => id),
    now: () => 1800000000000,
    limit() {},
    fail(status) { throw Object.assign(new Error(String(status)), { status }); },
  });
  const call = (viewer, path, input, readInput = async () => input) => {
    const url = new URL(path, 'http://localhost');
    const route = (input === undefined ? 'GET ' : 'POST ') + url.pathname;
    return handler(route, url, viewer, readInput, () => {});
  };
  return { call, db };
}

test('private chats are idempotent and store independent read and pin state', async t => {
  const { call, db } = fixture(t);
  assert.equal((await call(alice, '/social/notifications/summary')).conversations, true);
  const { thread } = await call(alice, '/social/conversations', { id: bob });
  assert.equal((await call(bob, '/social/conversations', { id: alice })).thread.id, thread.id);
  const route = '/social/conversations/' + thread.id;
  const request = { body: '第一条测试消息', nonce: makeNonce(1) };
  const { message } = await call(alice, route + '/messages', request);
  assert.equal((await call(alice, route + '/messages', request)).message.id, message.id);
  assert.equal((await call(bob, route + '/messages')).items.length, 1);
  assert.equal((await call(bob, '/social/conversations?unread=1')).items[0].unread, 1);
  assert.equal((await call(bob, '/social/conversations?q=测试消息')).items[0].matchText, request.body);
  assert.equal((await call(bob, '/social/conversations?q=10000001')).items[0].id, thread.id);
  await assert.rejects(call(other, route + '/messages'), { status: 404 });
  await assert.rejects(call(other, route + '/read', { through: message.id }), { status: 404 });
  await assert.rejects(call(bob, route + '/read', { through: message.id + 1 }), { status: 404 });
  await call(bob, route + '/read', { through: message.id });
  assert.deepEqual((await call(bob, '/social/conversations?unread=1')).items, []);
  await call(bob, route + '/pin', { pinned: true });
  assert.equal((await call(bob, '/social/conversations')).items[0].pinned, true);
  assert.equal((await call(alice, '/social/conversations')).items[0].pinned, false);
  await call(bob, '/social/blocks', { id: alice, active: true });
  assert.deepEqual((await call(alice, '/social/conversations')).items, []);
  await assert.rejects(call(alice, route + '/messages', { body: '无法送达', nonce: makeNonce(2) }), { status: 404 });
  db.prepare('DELETE FROM account_users WHERE id = ?').run(alice);
  assert.equal(db.prepare('SELECT count(*) AS count FROM social_messages').get().count, 0);
});

test('group members can retrieve attachments and replies with the same block rules', async t => {
  const { call } = fixture(t);
  const group = { title: '测试群聊', members: [bob, other], nonce: makeNonce(1) };
  const { thread } = await call(alice, '/social/conversations', group);
  assert.equal((await call(alice, '/social/conversations', group)).thread.id, thread.id);
  const route = '/social/conversations/' + thread.id;
  assert.equal((await call(other, route + '/members')).items.length, 3);
  const payload = Buffer.alloc(4500, 4).toString('base64');
  const input = { nonce: makeNonce(2), attachment: { kind: 'file', name: 'sample.dat',
    type: 'application/octet-stream', data: payload } };
  const { message } = await call(alice, route + '/messages', input, async limit => {
    assert.ok(limit > payload.length);
    return input;
  });
  const files = await call(other, route + '/attachment/' + message.id);
  assert.equal(files.data, payload);
  assert.equal(message.attachment.size, 4500);
  const { message: reply } = await call(bob, route + '/messages', {
    body: '已收到', nonce: makeNonce(1), replyTo: message.id,
  });
  assert.equal(reply.reply.kind, 'file');
  await call(bob, '/social/blocks', { id: alice, active: true });
  const visible = (await call(bob, route + '/messages')).items;
  assert.deepEqual(visible.map(item => [item.id, item.reply]), [[reply.id, null]]);
  await assert.rejects(call(bob, route + '/attachment/' + message.id), { status: 404 });
  assert.equal((await call(other, '/social/conversations?q=sample.dat')).items[0].matchText, 'sample.dat');
});
