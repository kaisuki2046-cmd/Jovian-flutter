import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
import { chatOwnerKey } from './chat-owner.ts';

const web = 'data:text/javascript,export const Platform = { OS: "web" };';
const secureStore = 'data:text/javascript,export function getItemAsync() { throw new Error("Unexpected native read"); } export function setItemAsync() { throw new Error("Unexpected native write"); } export function deleteItemAsync() { throw new Error("Unexpected native delete"); }';
register('data:text/javascript,' + encodeURIComponent(`export function resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/task-session.ts')) {
    if (specifier === 'react-native') return next(${JSON.stringify(web)}, context);
    if (specifier === 'expo-secure-store') return next(${JSON.stringify(secureStore)}, context);
  }
  return next(specifier === './chat-owner' ? specifier + '.ts' : specifier, context);
}`), import.meta.url);

const history = await import('./history-storage.web.ts');
const recovery = await import('./task-session.ts');
const first = chatOwnerKey({ kind: 'member', id: 'A/customer.1' });
const second = chatOwnerKey({ kind: 'member', id: 'B/customer.2' });
const guest = chatOwnerKey({ kind: 'guest', id: 'A/customer.1' });

function memoryStorage() {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key) };
}

function setGlobal(t, key, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, value });
  t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
}

test('history files use distinct valid keys for each member and guest', (t) => {
  const localStorage = memoryStorage();
  localStorage.setItem('jovian.divination.history.v1', 'unowned chat');
  setGlobal(t, 'window', { localStorage });
  assert.match(first, /^[\w.-]+$/u);
  assert.notEqual(first, chatOwnerKey({ kind: 'member', id: 'a/customer.1' }));
  assert.equal(chatOwnerKey(null), null);
  assert.equal(history.readHistoryStorage(first), null);
  history.writeHistoryStorage(first, 'member A chat');
  history.writeHistoryStorage(second, 'member B chat');
  assert.equal(history.readHistoryStorage(guest), null);
  assert.equal(history.readHistoryStorage(second), 'member B chat');
  assert.equal(history.readHistoryStorage(first), 'member A chat');
  assert.equal(localStorage.getItem('jovian.divination.history.v1'), 'unowned chat');
});

test('account changes isolate queued ritual writes and recovery even when chat IDs match', async (t) => {
  const sessionStorage = memoryStorage();
  sessionStorage.setItem('jovian.divination.active-tarot.v1', 'unowned token');
  setGlobal(t, 'sessionStorage', sessionStorage);
  const chatId = 'original';
  const task = token => ({ latest: 1, tokens: { 1: token } });
  const ritual = token => ({ token, action: { toss: { step: 0, actionId: 'action' } } });
  assert.equal(await recovery.readTaskRecovery(first, chatId), null);
  await Promise.all([recovery.writeTaskRecovery(first, chatId, task('member-a')),
    recovery.writePendingRitual(first, chatId, ritual('member-a')),
    recovery.writeTaskRecovery(second, chatId, task('member-b')),
    recovery.writeTaskRecovery(null, chatId, task('no-owner'))]);
  assert.deepEqual(await recovery.readTaskRecovery(second, chatId), task('member-b'));
  assert.equal(await recovery.readPendingRitual(second, chatId), null);
  assert.equal(await recovery.readTaskRecovery(guest, chatId), null);
  assert.equal(await recovery.readTaskRecovery(null, chatId), null);
  assert.deepEqual(await recovery.readTaskRecovery(first, chatId), task('member-a'));
  assert.deepEqual(await recovery.readPendingRitual(first, chatId), ritual('member-a'));
});
