import { withSignInAgreement } from './sign-in-fixture.mjs';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { openAccountStore } from '../storage/account-store.mjs';
import { createAccountHandler } from './handler.mjs';

async function withAccount(run) {
  let time = Date.now();
  const store = openAccountStore(':memory:');
  let emailCode;
  const server = createServer(createAccountHandler({
    store, webOrigin: 'http://localhost:8081', now: () => time,
    deliverPhoneCode: ({ code }) => ({ developmentCode: code }),
    authProvider: { deliverCode({ code }) { emailCode = code; } },
  }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/account';
  const send = (path, body, token, method = body === undefined ? 'GET' : 'POST') => fetch(base + path, {
    method,
    headers: {
      'X-App-Client': 'native',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(withSignInAgreement(path, body)),
  });
  try {
    async function emailProof(email) {
      const response = await send('/auth/register/code', { email });
      assert.equal(response.status, 200);
      const { challengeId } = await response.json();
      return { challengeId, code: emailCode };
    }
    await run({ send, store, emailProof, advance: (milliseconds) => { time += milliseconds; } });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    store.close();
  }
}

async function getProof(send, path, phone) {
  const response = await send(path, { phone });
  assert.equal(response.status, 200);
  const { challengeId, developmentCode } = await response.json();
  return { phone, challengeId, code: developmentCode };
}

const phoneA = '+8613700137000';
const phoneB = '+8613600136000';
const oldPassword = 'old password for this account';
const newPassword = 'new password for this account';

test('phone sign-in reports whether it created an account, after valid proof only', async () => {
  await withAccount(async ({ send, store, advance }) => {
    const proof = await getProof(send, '/auth/phone/login/code', phoneA);
    const wrong = proof.code === '000000' ? '000001' : '000000';
    assert.equal((await send('/auth/phone/login', { ...proof, code: wrong })).status, 422);
    assert.equal(store.getByPhone(phoneA), undefined);
    const responses = await Promise.all([send('/auth/phone/login', proof), send('/auth/phone/login', proof)]);
    assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 410]);
    const created = await responses.find(({ status }) => status === 201).json();
    assert.equal(created.result, 'created');
    assert.equal(created.user.nicknameRequired, true);
    advance(31_000);
    const existing = await send('/auth/phone/login', await getProof(send, '/auth/phone/login/code', phoneA));
    assert.equal(existing.status, 200);
    const result = await existing.json();
    assert.equal(result.result, 'signed-in');
    assert.equal(result.user.id, created.user.id);
    assert.equal(result.user.nicknameRequired, true);
    const saved = await send('/profile', { displayName: '手机账号昵称', bio: '', expectedOwnerId: created.user.id }, result.token, 'PATCH');
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).user.nicknameRequired, undefined);
    assert.equal(store.getByPhone(phoneA).display_name, '手机账号昵称');
    assert.equal((await (await send('/session', undefined, result.token)).json()).user.nicknameRequired, undefined);
    const expired = await getProof(send, '/auth/phone/login/code', phoneB);
    advance(300_001);
    assert.equal((await send('/auth/phone/login', expired)).status, 410);
    assert.equal(store.getByPhone(phoneB), undefined);
  });
});

test('preview matches public projection and never returns hidden values', async () => {
  await withAccount(async ({ send }) => {
    const owner = await (await send('/auth/phone/login', await getProof(send, '/auth/phone/login/code', phoneA))).json();
    const viewer = await (await send('/auth/phone/login', await getProof(send, '/auth/phone/login/code', phoneB))).json();
    const fields = { birthDate: '2000-01-01', birthTime: '', birthPlace: '保密地点', gender: 'female' };
    const visibility = { birthDate: true, birthTime: true, birthPlace: false, gender: false };
    const publicPath = '/reading-profile/visible/' + owner.user.id;
    assert.equal((await send('/reading-profile/preview')).status, 401);
    assert.equal((await send(publicPath)).status, 401);
    assert.equal((await send('/reading-profile', { ...fields, visibility }, owner.token, 'PATCH')).status, 200);
    const preview = await (await send('/reading-profile/preview', undefined, owner.token)).json();
    assert.deepEqual(preview, { visible: { birthDate: fields.birthDate }, filled: ['birthDate', 'birthPlace', 'gender'] });
    assert.deepEqual(await (await send(publicPath, undefined, viewer.token)).json(), { visible: preview.visible });
    await send('/reading-profile', { ...fields, visibility: { ...visibility, birthDate: false } }, owner.token, 'PATCH');
    assert.deepEqual(await (await send(publicPath, undefined, viewer.token)).json(), { visible: {} });
    assert.deepEqual((await (await send('/reading-profile/preview', undefined, owner.token)).json()).visible, {});
  });
});

test('profile page preview matches the visitor view and keeps private values and settings out of it', async () => {
  await withAccount(async ({ send, emailProof }) => {
    const password = 'a password for the profile owner';
    const email = 'private@example.test';
    const owner = await (await send('/auth/register', { email, password, displayName: 'Owner', ...await emailProof(email) })).json();
    const viewer = await (await send('/auth/phone/login', await getProof(send, '/auth/phone/login/code', phoneB))).json();
    const previewPath = '/profile/preview';
    const visitorPath = '/profile/visible/' + owner.user.id;
    const preview = async () => (await send(previewPath, undefined, owner.token)).json();
    const visit = async () => (await send(visitorPath, undefined, viewer.token)).json();
    assert.equal((await send(previewPath)).status, 401);
    assert.equal((await send(visitorPath)).status, 401);
    assert.deepEqual(await visit(), { profile: { reading: {} } });
    const nameOnly = { displayName: true, bio: false };
    assert.equal((await send('/profile', { displayName: 'Public name', bio: 'Private bio', visibility: nameOnly }, owner.token, 'PATCH')).status, 200);
    const birth = { birthDate: '2001-04-05', birthTime: '', birthPlace: 'Private place', gender: '' };
    const birthVisibility = { birthDate: true, birthTime: true, birthPlace: false, gender: false };
    assert.equal((await send('/reading-profile', { ...birth, visibility: birthVisibility }, owner.token, 'PATCH')).status, 200);
    const profile = { displayName: 'Public name', reading: { birthDate: birth.birthDate } };
    assert.deepEqual(await preview(), { profile, visibility: { ...nameOnly, ...birthVisibility } });
    assert.deepEqual(await visit(), { profile });
    assert.equal((await send('/profile', { displayName: 'New name', bio: 'Private bio' }, owner.token, 'PATCH')).status, 200);
    assert.equal((await visit()).profile.displayName, 'New name');
    const bioOnly = { displayName: false, bio: true };
    const result = await send('/profile', { displayName: 'New name', bio: 'Now public', visibility: bioOnly }, owner.token, 'PATCH');
    assert.equal(result.status, 200);
    assert.deepEqual((await result.json()).user.visibility, bioOnly);
    assert.deepEqual(await visit(), { profile: { bio: 'Now public', reading: profile.reading } });
  });
});

test('password reset separates purposes, expires, preserves aborted accounts and revokes sessions', async () => {
  await withAccount(async ({ send, store, advance }) => {
    const signIn = async (phone) => (await send('/auth/phone/login', await getProof(send, '/auth/phone/login/code', phone))).json();
    const accountA = await signIn(phoneA);
    const accountB = await signIn(phoneB);
    const setup = await (await send('/auth/phone/password-setup/code', {}, accountA.token)).json();
    assert.equal((await send('/auth/password', {
      challengeId: setup.challengeId, code: setup.developmentCode, newPassword: oldPassword,
    }, accountA.token)).status, 200);
    const second = await (await send('/auth/login', { phone: phoneA, password: oldPassword })).json();
    const beforeA = store.getByPhone(phoneA).password_hash;
    const beforeB = store.getByPhone(phoneB).password_hash;
    const verify = (proof) => send('/auth/password-reset/verify', proof);
    const complete = (phone, resetToken) => send('/auth/password-reset/complete', { phone, resetToken, newPassword });
    const unbound = '+8613500135000';
    const unboundProof = await getProof(send, '/auth/password-reset/code', unbound);
    assert.equal((await verify(unboundProof)).status, 422);
    assert.equal(store.getByPhone(unbound), undefined);
    advance(31_000);
    const login = await getProof(send, '/auth/phone/login/code', phoneA);
    assert.equal((await verify(login)).status, 410);
    const expired = await getProof(send, '/auth/password-reset/code', phoneA);
    advance(300_001);
    assert.equal((await verify(expired)).status, 410);
    const proof = await getProof(send, '/auth/password-reset/code', phoneA);
    assert.equal((await verify({ ...proof, phone: phoneB })).status, 410);
    const wrong = proof.code === '000000' ? '000001' : '000000';
    assert.equal((await verify({ ...proof, code: wrong })).status, 422);
    const interrupted = await (await verify(proof)).json();
    assert.equal((await verify(proof)).status, 410);
    assert.equal(store.getByPhone(phoneA).password_hash, beforeA);
    advance(300_001);
    assert.equal((await complete(phoneA, interrupted.resetToken)).status, 410);
    const fresh = await getProof(send, '/auth/password-reset/code', phoneA);
    const { resetToken } = await (await verify(fresh)).json();
    assert.equal((await complete(phoneB, resetToken)).status, 410);
    assert.equal((await complete(phoneA, resetToken)).status, 204);
    assert.equal((await complete(phoneA, resetToken)).status, 410);
    assert.equal(store.getByPhone(phoneB).password_hash, beforeB);
    assert.equal((await send('/session', undefined, accountA.token)).status, 401);
    assert.equal((await send('/session', undefined, second.token)).status, 401);
    assert.equal((await send('/session', undefined, accountB.token)).status, 200);
    assert.equal((await send('/auth/login', { phone: phoneA, password: oldPassword })).status, 401);
    assert.equal((await send('/auth/login', { phone: phoneA, password: newPassword })).status, 200);
  });
});
