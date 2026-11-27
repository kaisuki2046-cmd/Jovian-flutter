import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';

register('data:text/javascript,' + encodeURIComponent(`export function resolve(specifier, context, next) {
  return next(specifier === '../model/chat-draft' ? specifier + '.ts' : specifier, context);
}`), import.meta.url);
const { pickChatAttachments } = await import('./pick-chat-attachments.web.ts');

function pickerDOM(t) {
  const input = Object.assign(new EventTarget(), {
    files: [], oncancel: null, click() {}, remove() { this.removed = true; },
  });
  const window = Object.assign(new EventTarget(), { clearTimeout });
  const document = { createElement: () => input, body: { append() {} } };
  for (const [key, value] of Object.entries({ window, document })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  return input;
}

test('cancel closes the picker with no selected attachments', async t => {
  const input = pickerDOM(t);
  const pending = pickChatAttachments('image');
  assert.equal(input.accept, 'image/*');
  input.dispatchEvent(new Event('cancel'));
  assert.deepEqual(await pending, []);
  assert.equal(input.removed, true);
});

test('a mixed selection returns the original local file objects in order without reading their contents', async t => {
  const input = pickerDOM(t);
  const photo = new File(['image'], 'sample.png', { type: 'image/png' });
  const note = new File(['example'], 'note.txt', { type: 'text/plain' });
  for (const file of [photo, note]) {
    for (const method of ['arrayBuffer', 'text', 'stream']) t.mock.method(file, method, () => assert.fail('File contents were read.'));
  }
  const selected = pickChatAttachments('file');
  assert.equal(input.multiple, true);
  input.files = [photo, note];
  input.dispatchEvent(new Event('change'));
  const items = await selected;
  assert.deepEqual(items.map(item => [item.kind, item.name]), [['image', 'sample.png'], ['file', 'note.txt']]);
  assert.equal(items[0].file, photo);
  assert.equal(items[1].file, note);
  assert.equal(input.removed, true);
});
