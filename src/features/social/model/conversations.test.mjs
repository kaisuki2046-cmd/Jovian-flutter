import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';

register('data:text/javascript,' + encodeURIComponent(`
  export function resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/social/model/conversations.ts') && specifier === './demo-friends') {
      return next('./demo-friends.ts', context);
    }
    return next(specifier, context);
  }
`), import.meta.url);

const { appendMessage, buildInboxRows, createDemoConversations, findConversations, parseDemoConversations, werewolfGame, withWerewolfGame } =
  await import('./conversations.ts');

test('hydrates all eight demo conversations, including the unread count and shared report', () => {
  const items = createDemoConversations();
  assert.equal(items.length, 8);
  const friend = items.find(item => item.id === 'spring_h');
  assert.equal(friend.unread, 2);
  assert.equal(friend.thread.length, 10);
  assert.equal(friend.thread.find(message => message.kind === 'report').report, 'all');
});

test('search finds names, older messages and reports while contacts only contain friends', () => {
  const items = createDemoConversations();
  const group = { id: 'group-test', kind: 'group', name: '星盘', unread: 0, thread: [] };
  assert.equal(findConversations(items, '佳木斯', false)[0].id, 'mimi_planet');
  assert.equal(findConversations(items, '想跟你聊聊新计划', false)[0].id, 'spring_h');
  assert.equal(findConversations(items, '个人综合分析', false)[0].id, 'spring_h');
  assert.deepEqual(findConversations([...items, group], '星盘', true).filter(item => item.kind === 'group'), []);
  assert.equal(findConversations(items, '罗', false)[0].kind, 'stranger');
  assert.equal(findConversations(items, '', true).some(item => item.id === 'sora_c'), false);
});

test('orders older demo labels and real timestamps together, with the latest conversation first', () => {
  const items = createDemoConversations();
  assert.deepEqual(findConversations(items, '', false).map(item => item.name), [
    '刘', '黄', '罗', '束', '佳木斯男性', '殷', '于', '张',
  ]);

  const updated = items.map(item => item.name === '张'
    ? appendMessage(item, { kind: 'text', text: '新消息' }, Date.parse('2026-11-21T08:00:00+08:00'))
    : item);
  const restored = parseDemoConversations(JSON.stringify(updated));
  assert.equal(findConversations(restored, '', false)[0].name, '张');
  assert.equal(items[0].name, '束');
});

test('sorts inbox folders by the time of their latest contained chat', () => {
  const items = withWerewolfGame(createDemoConversations());
  const initial = buildInboxRows(findConversations(items, '', false), '');
  assert.equal(initial[0].item.name, '刘');
  assert.equal(initial[2].kind, 'strangers');
  assert.equal(initial.at(-1).kind, 'games');

  const groupActivity = Date.parse('2026-11-20T15:00:00+08:00');
  const updated = items.map(item => item.id === werewolfGame.id
    ? appendMessage(item, { kind: 'text', text: '到时见' }, groupActivity) : item);
  assert.equal(buildInboxRows(findConversations(updated, '', false), '')[0].kind, 'games');
  assert.deepEqual(buildInboxRows([], '丰兴广场').map(row => row.kind), ['games']);
});

test('sorts contacts by name even when another contact has a newer message', () => {
  const items = createDemoConversations();
  const updated = items.map(item => item.name === '张'
    ? appendMessage(item, { kind: 'text', text: '新消息' }, Date.parse('2026-11-21T08:00:00+08:00'))
    : item);
  updated.push(
    { id: 'zoe', kind: 'friend', name: 'Zoe', unread: 0, thread: [] },
    { id: 'alice', kind: 'friend', name: 'Alice', unread: 0, thread: [] },
  );
  const names = findConversations(updated, '', true).map(item => item.name);
  assert.deepEqual(names.filter(name => /\p{Script=Han}/u.test(name)), ['黄', '佳木斯男性', '刘', '束', '殷', '于', '张']);
  assert.deepEqual(names.filter(name => /^[a-z]/i.test(name)), ['Alice', 'Zoe']);
});

test('moves the saved demo stranger without replacing messages or unread state', () => {
  const initial = createDemoConversations().find(item => item.id === 'sora_c');
  const saved = appendMessage({ ...initial, kind: 'friend', unread: 1 }, { kind: 'text', text: '已有的本地消息' }, 1000);
  const [item] = parseDemoConversations(JSON.stringify([saved]));
  assert.equal(item.kind, 'stranger');
  assert.deepEqual(item.thread, saved.thread);
  assert.equal(item.unread, 1);
});

test('adds the Werewolf group to existing demo data with seven friends and keeps its saved chat', () => {
  const saved = parseDemoConversations(JSON.stringify(createDemoConversations()));
  const hydrated = withWerewolfGame(saved);
  const group = hydrated.find(item => item.id === werewolfGame.id);
  assert.equal(group.name, '11：23 狼人杀局');
  assert.equal(group.kind, 'group');
  assert.equal(group.members.length + 1, 8);
  assert.deepEqual(group.members, saved.filter(item => item.kind === 'friend').map(item => item.id));
  const sent = appendMessage(group, { kind: 'text', text: '到时见' }, 1000);
  const restored = withWerewolfGame(parseDemoConversations(JSON.stringify([...saved, sent])));
  assert.deepEqual(restored.filter(item => item.id === werewolfGame.id), [sent]);
  assert.equal(findConversations(restored, '狼人杀', false)[0].id, group.id);
});

test('saved messages preserve their order and use unique keys after the thread reaches its limit', () => {
  const initial = createDemoConversations()[0];
  let item = initial;
  for (let count = 0; count < 100; count++) {
    item = appendMessage(item, { kind: 'text', text: '本地消息 ' + count }, 1000);
  }
  assert.equal(initial.thread.length, 3);
  assert.equal(item.thread.length, 90);
  assert.equal(new Set(item.thread.map(message => message.id)).size, 90);
  assert.equal(item.thread.at(-1).text, '本地消息 99');
  assert.deepEqual(parseDemoConversations(JSON.stringify([item])), [JSON.parse(JSON.stringify(item))]);
  assert.throws(() => parseDemoConversations(JSON.stringify([{ ...item, thread: [{}] }])));
});
