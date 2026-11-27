import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyProfileDetails, parsePreferences, parseProfileDetails, profileStorageKey, signatureLimit } from './preferences.ts';

test('old, missing and invalid preference data falls back to the existing light Chinese interface', () => {
  for (const value of [null, undefined, [], 1, { appearance: 'sepia', language: 'fr' }])
    assert.deepEqual(parsePreferences(value), { appearance: 'light', language: 'zh' });
  assert.deepEqual(parsePreferences({ appearance: 'system', language: 'en' }), { appearance: 'system', language: 'en' });
  assert.deepEqual(parsePreferences({ appearance: 'dark' }), { appearance: 'dark', language: 'zh' });
});
test('profile keys keep members and guest identities separate and retain the existing avatar key', () => {
  const owners = ['member:123', 'guest:123', 'local-guest', 'member:a:b', 'member:a-b', '一束'];
  const keys = owners.flatMap(owner => ['avatar', 'cover', 'profile-details'].map(kind => profileStorageKey(owner, kind)));
  assert.equal(new Set(keys).size, owners.length * 3);
  assert.equal(profileStorageKey('guest:123', 'avatar'), 'jovian.avatar.v1.67-75-65-73-74-3a-31-32-33');
  for (const key of keys) assert.match(key, /^[a-zA-Z0-9._-]+$/);
});
test('signature and several tags restore together and tolerate missing or invalid local fields', () => {
  assert.deepEqual(parseProfileDetails(null), emptyProfileDetails);
  const draft = { signature: ' 写点喜欢的事 ', tags: { zodiac: '白羊座', personality: 'ISFP', interests: ' 摄影 ' } };
  assert.deepEqual(parseProfileDetails(JSON.parse(JSON.stringify(draft))), {
    signature: '写点喜欢的事', tags: { zodiac: '白羊座', personality: 'ISFP', interests: '摄影' },
  });
  const invalid = parseProfileDetails({ signature: '🌙'.repeat(signatureLimit + 1), tags: { zodiac: 1 } });
  assert.equal(invalid.signature, '🌙'.repeat(signatureLimit));
  assert.deepEqual(invalid.tags, emptyProfileDetails.tags);
});
