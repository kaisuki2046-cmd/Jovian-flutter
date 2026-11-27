import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyChatHistory, parseChatHistory, searchChatHistory, serializeChatHistory, threadTitle } from './chat-history.ts';

test('restores separate chats, including a newly opened empty chat, with titles taken from real messages', () => {
  const first = { id: 'original', updatedAt: 1, title: '第一次聊天', messages: [{ id: 1, kind: 'user', text: '第一次聊天' }] };
  const second = { id: 'second', updatedAt: 2, title: '问候', messages: [{ id: 1, kind: 'user', text: '问候' },
    { id: 2, kind: 'guidance', text: 'Welcome to Jovian Ring' }] };
  const history = { ...emptyChatHistory(), activeId: 'new-empty', threads: [first, second] };
  const restored = parseChatHistory(serializeChatHistory(history));
  assert.deepEqual(restored, history);
  assert.deepEqual(searchChatHistory(restored.threads, 'welcome'), [second]);
  assert.deepEqual(searchChatHistory(restored.threads, ''), [second, first]);
  assert.equal(threadTitle([{ kind: 'guidance', text: '提示' }, { kind: 'user', text: '实际问题\n第二行' }]), '实际问题 第二行');
});

test('keeps the local attachment label and makes the attachment name searchable after reload', () => {
  const attachment = { id: 'attachment-1', kind: 'file', name: '笔记.txt', mimeType: 'text/plain', file: new File(['a'], '笔记.txt') };
  const messages = [{ id: 1, kind: 'user', text: '', attachments: [attachment] }];
  const history = { ...emptyChatHistory(), threads: [{ id: 'original', updatedAt: 1, messages }] };
  const restored = parseChatHistory(serializeChatHistory(history));
  assert.equal(threadTitle(messages), '笔记.txt');
  assert.equal(searchChatHistory(restored.threads, '笔记').length, 1);
  assert.equal(restored.threads[0].messages[0].attachments[0].file, undefined);
  assert.ok(attachment.file instanceof File);
});
