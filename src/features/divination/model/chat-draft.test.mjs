import assert from 'node:assert/strict';
import test from 'node:test';
import { attachmentId, attachmentKind, emptyChatDraft, hasDraftContent, removeFromDraft, sameChatDraft } from './chat-draft.ts';

const photo = { id: attachmentId(), kind: 'image', name: '星图.png', uri: 'file:///photos/example.png' };
const note = { id: attachmentId(), kind: 'file', name: '笔记.txt', file: new File(['example'], '笔记.txt') };

test('attachment-only drafts are sendable and removing the final attachment restores the empty state', () => {
  const initial = emptyChatDraft();
  const selected = { ...initial, text: '  ', attachments: [note] };
  assert.equal(hasDraftContent(initial), false);
  assert.equal(hasDraftContent(selected), true);
  assert.equal(hasDraftContent(removeFromDraft(selected, note.id)), false);
  assert.equal(selected.attachments[0].file, note.file);
});

test('removing one pending attachment preserves the caption and remaining original files', () => {
  const draft = { text: '和你分享', attachments: [photo, note] };
  const remaining = removeFromDraft(draft, photo.id);
  assert.equal(remaining.text, draft.text);
  assert.deepEqual(remaining.attachments, [note]);
  assert.equal(remaining.attachments[0], note);
  assert.equal(draft.attachments.length, 2);
  assert.equal(hasDraftContent(removeFromDraft(remaining, note.id)), true);
});

test('a retry matches the same caption and ordered attachment identities, including files that share a name', () => {
  const draft = { text: '你好', attachments: [photo, note] };
  assert.equal(sameChatDraft(draft, { text: ' 你好 ', attachments: [photo, note] }), true);
  assert.equal(sameChatDraft(draft, { ...draft, text: '新问题' }), false);
  assert.equal(sameChatDraft(draft, { ...draft, attachments: [note, photo] }), false);
  assert.equal(sameChatDraft(draft, removeFromDraft(draft, photo.id)), false);
  assert.equal(sameChatDraft(draft, { ...draft, attachments: [photo, { ...note, id: attachmentId() }] }), false);
});

test('picking a photo through the file picker uses the available MIME type or filename extension', () => {
  assert.equal(attachmentKind('image/jpeg', '相片'), 'image');
  assert.equal(attachmentKind('application/octet-stream', '相片.HEIC'), 'image');
  assert.equal(attachmentKind('', 'photo.PNG'), 'image');
  assert.equal(attachmentKind('application/pdf', 'notes.pdf'), 'file');
  assert.equal(attachmentKind('text/plain', 'notes.png'), 'file');
});
