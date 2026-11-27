import { withSignInAgreement } from './sign-in-fixture.mjs';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createAccountHandler } from './handler.mjs';
import { createTencentSmsDelivery, loadLocalAuthProvider, loadTencentSmsDelivery } from './auth-provider.mjs';
import { openAccountStore } from '../storage/account-store.mjs';

const origin = 'http://localhost:8081';
const password = 'first password with 20 characters';
const newPassword = 'eight888';
const registration = { email: ' Test@Example.test ', password, displayName: '原始昵称' };

async function withServer(store, run, now, deliverPhoneCode, providerNamespace = 'test', handlerOptions = {}) {
  const emailCodes = new Map();
  const authProvider = providerNamespace ? {
    namespace: providerNamespace,
    deliverCode({ recipient, code }) { emailCodes.set(recipient, code); },
    exchangeSocial({ authorizationCode }) {
      if (authorizationCode === 'verified-test-code') return { subject: 'fixture', displayName: 'Provider fixture' };
    },
  } : undefined;
  const server = createServer(createAccountHandler({
    store, webOrigin: origin, now, deliverPhoneCode, authProvider, phoneCodesEnabled: Boolean(deliverPhoneCode),
    ...handlerOptions,
  }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const send = (path, { method = 'GET', body, headers } = {}) => fetch(base + '/account' + path, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(withSignInAgreement(path, body)),
  });
  try {
    async function emailProof(email, headers) {
      const response = await send('/auth/register/code', { method: 'POST', body: { email }, headers });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.developmentCode, undefined);
      return { challengeId: body.challengeId, code: emailCodes.get(email.trim().toLowerCase()) };
    }
    await run(send, emailProof);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('capabilities expose only a configured loopback simulation and require no session', async () => {
  const store = openAccountStore(':memory:');
  try {
    for (const namespace of [false, 'test', 'local']) {
      await withServer(store, async (send) => {
        const response = await send('/auth/capabilities');
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('set-cookie'), null);
        assert.deepEqual(await response.json(), {
          localSocialProviders: namespace === 'local' ? ['wechat', 'qq'] : [],
          emailRegistrationCodeRequired: true,
          phoneRegistrationWithoutCode: false,
          emailRegistrationAvailable: Boolean(namespace),
          phoneCodesAvailable: false,
        });
        assert.equal((await send('/auth/capabilities', { headers: { Origin: 'https://other.example.test' } })).status, 403);
      }, undefined, undefined, namespace);
    }
  } finally {
    store.close();
  }
});

test('production advertises only configured code channels and does not open local registration', async () => {
  const store = openAccountStore(':memory:');
  const headers = { 'X-App-Client': 'native' };
  const phone = '+8613800138000';
  const delivered = new Map();
  const production = { webOrigin: 'https://app.example.test' };
  try {
    const virtual = await loadLocalAuthProvider({ host: '127.0.0.1', webOrigin: origin, environment: 'production',
      providerUrl: new URL('data:text/javascript,throw%20new%20Error()') });
    assert.equal(virtual, undefined);
    await withServer(store, async (send) => {
      const capabilities = await (await send('/auth/capabilities')).json();
      assert.equal(capabilities.emailRegistrationAvailable, false);
      assert.equal(capabilities.phoneCodesAvailable, false);
      assert.equal((await send('/auth/register/code', { method: 'POST', headers, body: registration })).status, 503);
      assert.equal((await send('/auth/phone/login/code', { method: 'POST', headers, body: { phone } })).status, 503);
    }, undefined, undefined, false, production);
    await withServer(store, async (send) => {
      const capabilities = await (await send('/auth/capabilities')).json();
      assert.equal(capabilities.emailRegistrationAvailable, true);
      assert.equal(capabilities.phoneCodesAvailable, true);
      assert.equal(capabilities.phoneRegistrationWithoutCode, false);
      const register = (body) => send('/auth/register', { method: 'POST', headers, body });
      assert.equal((await register({ ...registration, email: undefined, phone })).status, 400);
      const issue = () => send('/auth/register/code', { method: 'POST', headers, body: registration });
      const issued = await issue();
      assert.equal(issued.status, 200);
      const { challengeId } = await issued.json();
      assert.equal((await issue()).status, 429);
      const code = delivered.get('test@example.test');
      assert.equal((await register({ ...registration, challengeId, code: code === '000000' ? '000001' : '000000' })).status, 422);
      assert.equal((await register({ ...registration, challengeId, code })).status, 201);
      assert.equal((await register({ ...registration, challengeId, code })).status, 410);
    }, undefined, () => {}, false, {
      ...production, deliverEmailCode({ recipient, code }) { delivered.set(recipient, code); },
    });
  } finally {
    store.close();
  }
});

test('Tencent SMS adapter verifies delivery status and target before issuing a usable challenge', async () => {
  const phone = '+8613800138000';
  let statuses = [{ Code: 'Ok', PhoneNumber: phone }];
  const delivery = createTencentSmsDelivery({ async SendSms(input) {
    assert.deepEqual(input, { PhoneNumberSet: [phone], SmsSdkAppId: 'app', SignName: 'sign', TemplateId: 'template',
      TemplateParamSet: ['123456'] });
    return { SendStatusSet: statuses };
  } }, { appId: 'app', signName: 'sign', templateId: 'template' });
  await delivery({ phone, code: '123456' });
  for (const rejected of [undefined, [], [{ Code: 'FailedOperation', PhoneNumber: phone }], [{ Code: 'Ok', PhoneNumber: '+1000' }]]) {
    statuses = rejected;
    await assert.rejects(delivery({ phone, code: '123456' }), /rejected delivery/);
  }
  await assert.rejects(loadTencentSmsDelivery({ APP_PHONE_CODES: 'tencent' }), /Incomplete/);
});

test('local email registration works without a provider and preserves the sign-in rules', async () => {
  const store = openAccountStore(':memory:');
  const browser = { Origin: origin };
  const native = { 'X-App-Client': 'native' };
  try {
    await withServer(store, async (send) => {
      const capabilities = await (await send('/auth/capabilities')).json();
      assert.equal(capabilities.emailRegistrationCodeRequired, false);
      const register = (body, headers = browser) => send('/auth/register', { method: 'POST', body, headers });
      assert.equal((await register({ ...registration, acceptance: null })).status, 428);
      assert.equal((await register({ ...registration, password: '1234567' })).status, 400);
      assert.equal((await register(registration, { Origin: 'https://other.example.test' })).status, 403);

      const created = await register(registration);
      assert.equal(created.status, 201);
      const cookie = created.headers.get('set-cookie').split(';')[0];
      const { user } = await created.json();
      assert.equal(user.email, 'test@example.test');
      assert.match(user.uid, /^[1-9]\d{7}$/);
      assert.equal((await send('/session', { headers: { ...browser, Cookie: cookie } })).status, 200);
      assert.equal((await register({ ...registration, displayName: 'Another nickname' })).status, 409);
      assert.equal((await register({ ...registration, email: 'another@example.test' })).status, 409);

      const login = await send('/auth/login', {
        method: 'POST', headers: native, body: { email: registration.email, password },
      });
      assert.equal(login.status, 200);
      const signedIn = await login.json();
      assert.equal(signedIn.user.id, user.id);
      assert.match(signedIn.token, /^[A-Za-z0-9_-]{43}$/);
    }, undefined, undefined, false, { allowUnverifiedRegistration: true });
  } finally {
    store.close();
  }
});

test('email registration still requires proof on a non-local web origin', async () => {
  const store = openAccountStore(':memory:');
  try {
    await withServer(store, async (send) => {
      const capabilities = await (await send('/auth/capabilities')).json();
      assert.equal(capabilities.emailRegistrationCodeRequired, true);
      assert.equal(capabilities.phoneRegistrationWithoutCode, false);
      assert.equal((await send('/auth/register', {
        method: 'POST', headers: { 'X-App-Client': 'native' }, body: registration,
      })).status, 400);
      assert.equal((await send('/auth/register', {
        method: 'POST', headers: { 'X-App-Client': 'native' },
        body: { phone: '13800138000', displayName: 'Phone fixture', password },
      })).status, 400);
    }, undefined, undefined, 'test', {
      webOrigin: 'https://app.example.test', allowUnverifiedRegistration: true,
    });
  } finally {
    store.close();
  }
});

test('phone registration uses a password until the account owner verifies the number', async () => {
  const store = openAccountStore(':memory:');
  const delivered = new Map();
  const native = { 'X-App-Client': 'native' };
  const data = { phone: '138 0013 8000', displayName: 'Phone fixture', password };
  const number = '+8613800138000';
  let time = Date.now();
  try {
    await withServer(store, async (send) => {
      const post = (path, body, headers = native) => send(path, { method: 'POST', body, headers });
      assert.equal((await (await send('/auth/capabilities')).json()).phoneRegistrationWithoutCode, true);
      assert.equal((await post('/auth/register', { ...data, phone: 'phone' })).status, 400);
      assert.equal((await post('/auth/register', { ...data, email: 'other@example.test' })).status, 400);
      const created = await post('/auth/register', data);
      assert.equal(created.status, 201);
      const account = await created.json();
      assert.equal(account.user.email, null);
      assert.match(account.user.uid, /^[1-9]\d{7}$/);
      assert.equal((await post('/auth/register', { ...data, phone: number, displayName: 'Duplicate fixture' })).status, 409);
      const login = await post('/auth/login', { phone: number, password });
      assert.equal(login.status, 200);
      assert.equal((await login.json()).user.id, account.user.id);
      const owner = { ...native, Authorization: 'Bearer ' + account.token };
      assert.deepEqual(await (await send('/auth/phone', { headers: owner })).json(), { phone: null });

      async function proof(route, purpose, headers = native) {
        const result = await post(route, { phone: number }, headers);
        assert.equal(result.status, 200);
        return { phone: number, challengeId: (await result.json()).challengeId, code: delivered.get(purpose) };
      }
      const otp = await proof('/auth/phone/login/code', 'login');
      assert.equal((await post('/auth/phone/login', otp)).status, 409);
      const reset = await proof('/auth/password-reset/code', 'password-reset');
      assert.equal((await post('/auth/password-reset/verify', reset)).status, 422);

      const binding = await proof('/auth/phone/bind/code', 'bind', owner);
      assert.equal((await post('/auth/phone/bind', { ...binding, password: 'incorrect' }, owner)).status, 412);
      assert.equal((await post('/auth/phone/bind', { ...binding, password }, owner)).status, 200);
      assert.deepEqual(await (await send('/auth/phone', { headers: owner })).json(), { phone: number });
      time += 31_000;
      const verifiedLogin = await post('/auth/phone/login', await proof('/auth/phone/login/code', 'login'));
      assert.equal(verifiedLogin.status, 200);
      assert.equal((await verifiedLogin.json()).user.id, account.user.id);
    }, () => time, ({ purpose, code }) => delivered.set(purpose, code), false, { allowUnverifiedRegistration: true });
  } finally {
    store.close();
  }
});

test('identity verification status is member-only with submission left disabled', async () => {
  const store = openAccountStore(':memory:');
  const path = '/auth/identity-verification';
  const native = { 'X-App-Client': 'native' };
  const bearer = (token) => ({ ...native, Authorization: 'Bearer ' + token });
  try {
    await withServer(store, async (send, emailProof) => {
      assert.equal((await send(path, { headers: native })).status, 401);
      assert.equal((await send(path, { method: 'POST', headers: native, body: {} })).status, 401);
      const guestResponse = await send('/auth/guest', { method: 'POST', headers: native, body: {} });
      assert.equal(guestResponse.status, 201);
      const { token: guest } = await guestResponse.json();
      assert.equal((await send(path, { headers: bearer(guest) })).status, 401);
      assert.equal((await send(path, { method: 'POST', headers: bearer(guest), body: {} })).status, 401);

      const registered = await send('/auth/register', { method: 'POST', headers: native,
        body: { ...registration, ...await emailProof(registration.email, native) } });
      assert.equal(registered.status, 201);
      const { token } = await registered.json();
      const status = await send(path, { headers: bearer(token) });
      assert.equal(status.status, 200);
      assert.equal(status.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await status.json(), { status: 'not_enabled' });
      const submission = await send(path, { method: 'POST', headers: bearer(token), body: {} });
      assert.equal(submission.status, 503);
      assert.deepEqual(await submission.json(), { code: 'IDENTITY_VERIFICATION_NOT_ENABLED' });
    });
  } finally {
    store.close();
  }
});

test('browser registration and private profile persist across a server restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'app-account-'));
  const path = join(directory, 'test.sqlite');
  let store = openAccountStore(path);
  let cookie;
  let uid;
  try {
    await withServer(store, async (send, emailProof) => {
      assert.equal((await send('/session')).status, 401);
      const crossOrigin = await send('/auth/register', {
        method: 'POST', body: registration, headers: { Origin: 'https://other.example.test' },
      });
      assert.equal(crossOrigin.status, 403);
      const proof = await emailProof(registration.email, { Origin: origin });
      assert.equal((await send('/auth/register', {
        method: 'POST', body: { ...registration, ...proof, password: newPassword.slice(1) }, headers: { Origin: origin },
      })).status, 400);
      const registered = await send('/auth/register', {
        method: 'POST', body: { ...registration, ...proof }, headers: { Origin: origin },
      });
      assert.equal(registered.status, 201);
      assert.equal(registered.headers.get('access-control-allow-credentials'), 'true');
      const setCookie = registered.headers.get('set-cookie');
      assert.match(setCookie, /HttpOnly; SameSite=Strict/);
      cookie = setCookie.split(';')[0];
      const body = await registered.json();
      assert.equal(body.user.email, 'test@example.test');
      assert.equal(body.user.displayName, registration.displayName);
      assert.deepEqual(Object.keys(body), ['user']);
      assert.deepEqual(Object.keys(body.user).sort(), ['bio', 'displayName', 'email', 'hasPassword', 'id', 'uid']);
      uid = body.user.uid;
      assert.match(uid, /^[1-9]\d{7}$/);
      assert.equal(body.user.hasPassword, true);
      assert.notEqual(store.getByEmail('test@example.test').password_hash, password);
      assert.equal((await send('/auth/register', {
        method: 'POST', body: { ...registration, ...proof }, headers: { Origin: origin },
      })).status, 410);
      const headers = { Origin: origin, Cookie: cookie };
      const otherAccount = await send('/auth/register', {
        method: 'POST', body: { ...registration, email: 'other@example.test', displayName: '另一位用户',
          ...await emailProof('other@example.test', { Origin: origin }) },
        headers: { Origin: origin },
      });
      assert.equal(otherAccount.status, 201);
      const otherCookie = otherAccount.headers.get('set-cookie').split(';')[0];
      const { user: other } = await otherAccount.json();
      const update = await send('/profile', {
        method: 'PATCH', body: { displayName: ' 新昵称 ', bio: ' 新简介 ', userId: other.id }, headers,
      });
      assert.equal(update.status, 200);
      const { user: updated } = await update.json();
      assert.equal(updated.displayName, '新昵称');
      assert.equal(updated.uid, uid);
      const untouched = await send('/session', { headers: { Origin: origin, Cookie: otherCookie } });
      assert.equal((await untouched.json()).user.displayName, '另一位用户');
      assert.equal((await send('/profile', {
        method: 'PATCH', body: { displayName: '冒用', bio: '' }, headers: { Cookie: cookie },
      })).status, 403);
    });

    store.close();
    store = undefined;
    store = openAccountStore(path);
    await withServer(store, async (send) => {
      const headers = { Origin: origin, Cookie: cookie };
      const restored = await send('/session', { headers });
      assert.equal(restored.status, 200);
      const { user: restoredUser } = await restored.json();
      assert.equal(restoredUser.bio, '新简介');
      assert.equal(restoredUser.uid, uid);
      const logout = await send('/auth/logout', { method: 'POST', headers });
      assert.equal(logout.status, 204);
      assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
      assert.equal((await send('/session', { headers })).status, 401);
    });
  } finally {
    store?.close();
    await rm(path, { force: true });
    await rmdir(directory);
  }
});

test('email registration needs a fresh proof for the same address', async () => {
  const store = openAccountStore(':memory:');
  let now = Date.now();
  const headers = { 'X-App-Client': 'native' };
  try {
    await withServer(store, async (send, emailProof) => {
      const post = (path, body) => send(path, { method: 'POST', headers, body });
      assert.equal((await post('/auth/register', registration)).status, 400);
      const proof = await emailProof(registration.email, headers);
      assert.match(proof.code, /^\d{6}$/);
      assert.equal((await post('/auth/register', { ...registration, ...proof, email: 'other@example.test' })).status, 410);
      assert.equal((await post('/auth/register', { ...registration, ...proof, code: proof.code === '000000' ? '000001' : '000000' })).status, 422);
      now += 300_001;
      assert.equal((await post('/auth/register', { ...registration, ...proof })).status, 410);
      const valid = await emailProof(registration.email, headers);
      assert.equal((await post('/auth/register', { ...registration, ...valid })).status, 201);
      now += 31_000;
      const duplicate = await emailProof(registration.email, headers);
      assert.equal((await post('/auth/register', { ...registration, ...duplicate })).status, 409);
    }, () => now);
    await withServer(store, async (send) => {
      const post = (path, body) => send(path, { method: 'POST', headers, body });
      for (const [route, body] of [
        ['/auth/register/code', { email: registration.email }],
        ['/auth/register', registration],
        ['/auth/phone/login/code', { phone: '13800138000' }],
        ['/auth/social/wechat', {}],
        ['/auth/social/qq', {}],
      ]) {
        const response = await post(route, body);
        assert.equal(response.status, 503);
        assert.equal((await response.json()).code, 'AUTH_PROVIDER_UNAVAILABLE');
      }
      assert.equal((await post('/auth/login', { email: registration.email, password })).status, 200);
    }, undefined, undefined, false);
  } finally {
    store.close();
  }
});

test('social accounts use verified provider subjects and keep separate identities', async () => {
  const store = openAccountStore(':memory:');
  const headers = { 'X-App-Client': 'native' };
  try {
    await withServer(store, async (send) => {
      const login = (provider, body) => send('/auth/social/' + provider, { method: 'POST', headers, body });
      assert.equal((await login('wechat', { subject: 'fixture' })).status, 401);
      const proof = { authorizationCode: 'verified-test-code' };
      const first = await login('wechat', proof);
      assert.equal(first.status, 201);
      const { user, token } = await first.json();
      assert.equal(user.nicknameRequired, true);
      const second = await login('wechat', proof);
      assert.equal(second.status, 200);
      const returning = (await second.json()).user;
      assert.equal(returning.id, user.id);
      assert.equal(returning.nicknameRequired, true);
      const qq = await login('qq', proof);
      assert.equal(qq.status, 201);
      const qqAccount = await qq.json();
      assert.notEqual(qqAccount.user.id, user.id);
      assert.equal(qqAccount.user.nicknameRequired, true);
      const bearer = (secret) => ({ ...headers, Authorization: 'Bearer ' + secret });
      const session = await send('/session', { headers: bearer(token) });
      const signedIn = (await session.json()).user;
      assert.equal(signedIn.socialProvider, 'wechat');
      assert.equal(signedIn.nicknameRequired, true);
      const saveName = (secret, owner, displayName) => send('/profile', { headers: bearer(secret), method: 'PATCH',
        body: { displayName, bio: '', expectedOwnerId: owner } });
      assert.equal((await saveName(qqAccount.token, user.id, '错误账户')).status, 403);
      const saved = await saveName(token, user.id, '星光');
      assert.equal(saved.status, 200);
      assert.equal((await saved.json()).user.nicknameRequired, undefined);
      assert.equal((await saveName(qqAccount.token, qqAccount.user.id, ' 星光 ')).status, 409);
      assert.equal((await (await send('/session', { headers: bearer(qqAccount.token) })).json()).user.nicknameRequired, true);
      assert.equal((await saveName(qqAccount.token, qqAccount.user.id, '远星')).status, 200);
      const reopened = (await (await login('wechat', proof)).json()).user;
      assert.equal(reopened.displayName, '星光');
      assert.equal(reopened.nicknameRequired, undefined);
      assert.deepEqual(store.findUsersByNickname('星光'), [user.id]);
      assert.deepEqual(store.findUsersByNickname('远星'), [qqAccount.user.id]);
    });
  } finally {
    store.close();
  }
});

test('native bearer sessions can change passwords, revoke other devices and expire', async () => {
  const store = openAccountStore(':memory:');
  let now = Date.now();
  const native = { 'X-App-Client': 'native' };
  const bearer = (token) => ({ ...native, Authorization: 'Bearer ' + token });
  try {
    await withServer(store, async (send, emailProof) => {
      const initialPassword = 'start888';
      const register = await send('/auth/register', { method: 'POST',
        body: { ...registration, password: initialPassword, ...await emailProof(registration.email, native) }, headers: native });
      assert.equal(register.status, 201);
      assert.equal(register.headers.get('set-cookie'), null);
      const first = (await register.json()).token;
      const login = async (secret) => send('/auth/login', {
        method: 'POST', body: { email: registration.email, password: secret }, headers: native,
      });
      assert.equal((await login('wrong')).status, 401);
      const secondLogin = await login(initialPassword);
      assert.equal(secondLogin.status, 200);
      const second = (await secondLogin.json()).token;
      assert.equal((await send('/auth/password', {
        method: 'POST', body: { currentPassword: initialPassword, newPassword: newPassword.slice(1) }, headers: bearer(first),
      })).status, 400);
      const changed = await send('/auth/password', {
        method: 'POST', body: { currentPassword: initialPassword, newPassword }, headers: bearer(first),
      });
      assert.equal(changed.status, 204);
      assert.equal((await send('/session', { headers: bearer(first) })).status, 200);
      assert.equal((await send('/session', { headers: bearer(second) })).status, 401);
      assert.equal((await login(initialPassword)).status, 401);
      assert.equal((await login(newPassword)).status, 200);
      now += 7 * 24 * 60 * 60 * 1000;
      assert.equal((await send('/session', { headers: bearer(first) })).status, 401);
    }, () => now);
  } finally {
    store.close();
  }
});

test('birth data stays private until selected and other viewers receive only the visible projection', async () => {
  const store = openAccountStore(':memory:');
  const native = { 'X-App-Client': 'native' };
  const bearer = (token) => ({ ...native, Authorization: 'Bearer ' + token });
  const fields = { birthDate: '2000-02-29', birthTime: '06:23', birthPlace: '南京', gender: 'female' };
  const visibility = { birthDate: false, birthTime: false, birthPlace: false, gender: false };
  try {
    await withServer(store, async (send, emailProof) => {
      async function register(email) {
        const response = await send('/auth/register', { method: 'POST',
          body: { ...registration, email, displayName: email.split('@')[0], ...await emailProof(email, native) }, headers: native });
        assert.equal(response.status, 201);
        return response.json();
      }
      const owner = await register('reader@example.test');
      const viewer = await register('viewer@example.test');
      const headers = bearer(owner.token);
      const viewerHeaders = bearer(viewer.token);
      const initial = await (await send('/reading-profile', { headers })).json();
      assert.deepEqual(initial.reading.visibility, visibility);
      assert.deepEqual(initial.visible, {});
      const save = (body) => send('/reading-profile', { method: 'PATCH', body, headers });
      assert.equal((await save({ ...fields, birthDate: '2001-02-29', visibility })).status, 400);
      const saved = await save({ ...fields, visibility: { ...visibility, birthPlace: true, gender: true }, userId: viewer.user.id });
      assert.equal(saved.status, 200);
      const ownerView = await saved.json();
      assert.equal(ownerView.reading.birthTime, '06:23');
      assert.deepEqual(ownerView.visible, { birthPlace: '南京', gender: 'female' });
      const path = '/reading-profile/visible/' + owner.user.id;
      assert.equal((await send(path, { headers: native })).status, 401);
      assert.deepEqual(await (await send(path, { headers: viewerHeaders })).json(), { visible: ownerView.visible });
      assert.equal(store.getReadingProfile(owner.user.id).birthDate, '2000-02-29');
      assert.equal(store.getReadingProfile(viewer.user.id), undefined);
      await save({ ...fields, visibility });
      assert.deepEqual(await (await send(path, { headers: viewerHeaders })).json(), { visible: {} });
    });
  } finally {
    store.close();
  }
});

test('phone challenges are single-use, expire, and rebind removes the old login method', async () => {
  const store = openAccountStore(':memory:');
  let now = Date.now();
  const native = { 'X-App-Client': 'native' };
  const bearer = (token) => ({ ...native, Authorization: 'Bearer ' + token });
  const firstPhone = '13800138000';
  const secondPhone = '+8613900139000';
  try {
    await withServer(store, async (send, emailProof) => {
      const post = (path, body, headers = native) => send(path, { method: 'POST', body, headers });
      const registered = await post('/auth/register', { ...registration, ...await emailProof(registration.email, native) });
      const owner = await registered.json();
      const headers = bearer(owner.token);
      async function issue(purpose, phone, auth) {
        const response = await post('/auth/phone/' + purpose + '/code', { phone }, auth);
        assert.equal(response.status, 200);
        const { developmentCode, challengeId } = await response.json();
        assert.match(developmentCode, /^\d{6}$/);
        return { phone, code: developmentCode, challengeId };
      }
      assert.equal((await post('/auth/phone/bind/code', { phone: firstPhone })).status, 401);
      const binding = await issue('bind', firstPhone, headers);
      assert.equal((await post('/auth/phone/bind', { ...binding, password: 'wrong' }, headers)).status, 412);
      const bound = await post('/auth/phone/bind', { ...binding, password }, headers);
      assert.deepEqual(await bound.json(), { phone: '+8613800138000' });
      const passwordLogin = await post('/auth/login', { phone: '+86 13800138000', password });
      assert.equal(passwordLogin.status, 200);
      assert.equal((await passwordLogin.json()).user.id, owner.user.id);
      assert.equal((await post('/auth/login', { phone: firstPhone, password: 'wrong' })).status, 401);

      const firstLogin = await issue('login', '+8613800138000');
      assert.equal((await post('/auth/phone/login/code', { phone: firstPhone })).status, 429);
      const wrongCode = firstLogin.code === '000000' ? '000001' : '000000';
      assert.equal((await post('/auth/phone/login', { ...firstLogin, code: wrongCode })).status, 422);
      const response = await post('/auth/phone/login', firstLogin);
      assert.equal(response.status, 200);
      const otherSession = (await response.json()).token;
      assert.equal((await post('/auth/phone/login', firstLogin)).status, 410);

      now += 30_001;
      const stale = await issue('login', firstPhone);
      const rebinding = await issue('bind', secondPhone, headers);
      assert.equal((await post('/auth/phone/bind', { ...rebinding, password }, headers)).status, 200);
      assert.equal((await send('/session', { headers: bearer(otherSession) })).status, 401);
      assert.equal((await post('/auth/phone/login', stale)).status, 410);
      assert.equal((await post('/auth/login', { phone: firstPhone, password })).status, 401);
      assert.equal((await post('/auth/login', { phone: secondPhone, password })).status, 200);
      const newLogin = await issue('login', secondPhone);
      assert.equal((await post('/auth/phone/login', newLogin)).status, 200);
      now += 30_001;
      const expiring = await issue('login', secondPhone);
      now += 301_000;
      assert.equal((await post('/auth/phone/login', expiring)).status, 410);
    }, () => now, ({ code }) => ({ developmentCode: code }));

    let delivered;
    await withServer(store, async (send) => {
      const requestCode = (phone) => send('/auth/phone/login/code', { method: 'POST', body: { phone }, headers: native });
      const unbound = await requestCode(firstPhone);
      assert.equal(unbound.status, 200);
      assert.deepEqual(Object.keys(await unbound.json()), ['challengeId', 'expiresIn']);
      assert.equal(delivered.phone, '+8613800138000');
      const bound = await requestCode(secondPhone);
      assert.equal(bound.status, 200);
      assert.deepEqual(Object.keys(await bound.json()), ['challengeId', 'expiresIn']);
      assert.equal(delivered.phone, secondPhone);
    }, () => now, (message) => { delivered = message; });

    await withServer(store, async (send) => {
      assert.equal((await send('/auth/phone/login/code', { method: 'POST', body: { phone: secondPhone }, headers: native })).status, 503);
    });
  } finally {
    store.close();
  }
});

test('a verified unbound phone registers once and its account can rebind with both codes', async () => {
  const store = openAccountStore(':memory:');
  let now = Date.now();
  const native = { 'X-App-Client': 'native' };
  const firstPhone = '13700137000';
  const secondPhone = '13600136000';
  try {
    await withServer(store, async (send) => {
      const post = (path, body, headers = native) => send(path, { method: 'POST', body, headers });
      async function proof(purpose, phone, headers) {
        const result = await post('/auth/phone/' + purpose + '/code', { phone }, headers);
        assert.equal(result.status, 200);
        const { challengeId, developmentCode: code } = await result.json();
        return { phone, challengeId, code };
      }
      const first = await proof('login', firstPhone);
      assert.equal(store.getByPhone('+8613700137000'), undefined);
      const wrong = first.code === '000000' ? '000001' : '000000';
      assert.equal((await post('/auth/phone/login', { ...first, code: wrong })).status, 422);
      assert.equal(store.getByPhone('+8613700137000'), undefined);
      const attempts = await Promise.all([post('/auth/phone/login', first), post('/auth/phone/login', first)]);
      assert.deepEqual(attempts.map((response) => response.status).sort(), [201, 410]);
      const { user, token } = await attempts.find((response) => response.status === 201).json();
      assert.equal(user.email, null);
      assert.equal(user.hasPassword, false);
      const headers = { ...native, Authorization: 'Bearer ' + token };
      assert.deepEqual(await (await send('/auth/phone', { headers })).json(), { phone: '+8613700137000' });
      assert.equal((await post('/auth/login', { phone: firstPhone, password })).status, 401);
      assert.equal((await post('/auth/phone/password-setup/code', {})).status, 401);
      const setupCode = await post('/auth/phone/password-setup/code', {}, headers);
      assert.equal(setupCode.status, 200);
      const { challengeId, developmentCode } = await setupCode.json();
      const incorrect = developmentCode === '000000' ? '000001' : '000000';
      assert.equal((await post('/auth/password', { challengeId, code: incorrect, newPassword: password }, headers)).status, 422);
      assert.equal((await post('/auth/password', { challengeId, code: developmentCode,
        newPassword: newPassword.slice(1) }, headers)).status, 400);
      const setup = await post('/auth/password', { challengeId, code: developmentCode, newPassword }, headers);
      assert.equal(setup.status, 200);
      assert.equal((await setup.json()).user.hasPassword, true);
      assert.equal((await post('/auth/phone/password-setup/code', {}, headers)).status, 409);
      const withPassword = await post('/auth/login', { phone: firstPhone, password: newPassword });
      assert.equal(withPassword.status, 200);
      assert.equal((await withPassword.json()).user.id, user.id);

      now += 30_001;
      const existing = await post('/auth/phone/login', await proof('login', firstPhone));
      assert.equal(existing.status, 200);
      assert.equal((await existing.json()).user.id, user.id);

      const current = await proof('bind-current', firstPhone, headers);
      const replacement = await proof('bind', secondPhone, headers);
      assert.equal((await post('/auth/phone/bind', replacement, headers)).status, 400);
      const wrongCurrent = current.code === '000000' ? '000001' : '000000';
      const binding = { ...replacement, currentChallengeId: current.challengeId, currentCode: wrongCurrent };
      assert.equal((await post('/auth/phone/bind', binding, headers)).status, 422);
      const rebound = await post('/auth/phone/bind', { ...binding, currentCode: current.code }, headers);
      assert.equal(rebound.status, 200);
      const signedIn = await post('/auth/phone/login', await proof('login', secondPhone));
      assert.equal(signedIn.status, 200);
      assert.equal((await signedIn.json()).user.id, user.id);
      now += 30_001;
      const oldNumber = await post('/auth/phone/login', await proof('login', firstPhone));
      assert.equal(oldNumber.status, 201);
      assert.notEqual((await oldNumber.json()).user.id, user.id);

      const resetPath = '/auth/password-reset/';
      const resetCode = await post(resetPath + 'code', { phone: secondPhone });
      assert.equal(resetCode.status, 200);
      const resetChallenge = await resetCode.json();
      const verified = await post(resetPath + 'verify', { phone: secondPhone,
        challengeId: resetChallenge.challengeId, code: resetChallenge.developmentCode });
      assert.equal(verified.status, 200);
      const { resetToken } = await verified.json();
      const reset = { phone: secondPhone, resetToken, newPassword: 'reset888' };
      assert.equal((await post(resetPath + 'complete', { ...reset, newPassword: reset.newPassword.slice(1) })).status, 400);
      assert.equal((await post(resetPath + 'complete', reset)).status, 204);
      assert.equal((await post('/auth/login', { phone: secondPhone, password: newPassword })).status, 401);
      assert.equal((await post('/auth/login', { phone: secondPhone, password: reset.newPassword })).status, 200);
    }, () => now, ({ code }) => ({ developmentCode: code }));
  } finally {
    store.close();
  }
});

test('new registrations and profile renames reject nicknames already in use', async () => {
  const store = openAccountStore(':memory:');
  const native = { 'X-App-Client': 'native' };
  try {
    await withServer(store, async (send, emailProof) => {
      async function register(email, displayName) {
        return send('/auth/register', { method: 'POST', headers: native,
          body: { ...registration, email, displayName, ...await emailProof(email, native) } });
      }
      assert.equal((await register('first@example.test', '  Orion  ')).status, 201);
      assert.equal((await register('duplicate@example.test', 'orion')).status, 409);
      assert.equal(store.getByEmail('duplicate@example.test'), undefined);
      const created = await register('second@example.test', '另一个昵称');
      assert.equal(created.status, 201);
      const { user, token } = await created.json();
      const rename = (displayName) => send('/profile', { method: 'PATCH', body: { displayName, bio: '' },
        headers: { ...native, Authorization: 'Bearer ' + token } });
      assert.equal((await rename(' ORION ')).status, 409);
      assert.equal(store.getProfile(user.id).display_name, '另一个昵称');
      const saved = await rename('新昵称');
      assert.equal(saved.status, 200);
      assert.equal((await saved.json()).user.uid, user.uid);
      assert.deepEqual(store.findUsersByNickname('新昵称'), [user.id]);
    });
    const defaults = [
      store.startPhoneSession({ phone: '+12025550101', newId: 'phone-a', tokenHash: 'a', expiresAt: 10, now: 1 }),
      store.startPhoneSession({ phone: '+12025550102', newId: 'phone-b', tokenHash: 'b', expiresAt: 10, now: 1 }),
      store.startSocialSession({ namespace: 'test', provider: 'wechat', subject: 'fake',
        newId: 'social-a', tokenHash: 'c', expiresAt: 10, now: 1 }),
    ];
    assert.equal(new Set(defaults.map(({ user }) => user.display_name)).size, defaults.length);
  } finally {
    store.close();
  }
});

test('the migration preserves legacy accounts, active sessions and bound phone numbers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'app-account-legacy-'));
  const path = join(directory, 'legacy.sqlite');
  try {
    const legacy = new DatabaseSync(path);
    try {
      legacy.exec(`
        CREATE TABLE account_users (
          id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
          bio TEXT NOT NULL DEFAULT '', password_salt TEXT NOT NULL, password_hash TEXT NOT NULL
        );
        CREATE TABLE account_sessions (
          token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL
        );
        CREATE TABLE account_phones (
          user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE, phone TEXT NOT NULL UNIQUE
        );
        CREATE TABLE account_reading_profiles (
          user_id TEXT PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE, data TEXT NOT NULL
        );
        INSERT INTO account_users VALUES ('legacy-id', 'legacy@example.test', '旧用户', '简介', 'salt', 'hash');
        INSERT INTO account_users VALUES ('legacy-duplicate', 'other@example.test', '旧用户', '', 'salt', 'hash');
        INSERT INTO account_sessions VALUES ('legacy-session', 'legacy-id', 999999);
        INSERT INTO account_phones VALUES ('legacy-id', '+8613800138000');
        INSERT INTO account_reading_profiles VALUES ('legacy-id', '{"birthDate":"2000-01-01"}');
      `);
    } finally {
      legacy.close();
    }
    const store = openAccountStore(path);
    try {
      assert.equal(store.getBySession('legacy-session', 1).email, 'legacy@example.test');
      const legacyPhoneUser = store.getByPhone('+8613800138000');
      assert.equal(legacyPhoneUser.id, 'legacy-id');
      assert.equal(legacyPhoneUser.nickname_pending, 0);
      assert.deepEqual(store.findUsersByNickname('旧用户'), ['legacy-duplicate', 'legacy-id']);
      assert.equal(store.updateProfile('legacy-id', 'legacy-session', 1, { displayName: '旧用户', bio: '可继续编辑' }).bio, '可继续编辑');
      const legacyUid = store.getPublicUid(legacyPhoneUser.id);
      assert.match(legacyUid, /^[1-9]\d{7}$/);
      assert.equal(store.findUserByUid(legacyUid), legacyPhoneUser.id);
      assert.equal(store.getReadingProfile('legacy-id').birthDate, '2000-01-01');
      const signedIn = store.startPhoneSession({
        phone: '+8613900139000', newId: 'new-user', tokenHash: 'new-session', now: 1, expiresAt: 999999,
      });
      assert.equal(signedIn.created, true);
      assert.equal(signedIn.user.nickname_pending, 1);
      assert.equal(store.getBySession('new-session', 1).email, null);
    } finally {
      store.close();
    }
  } finally {
    await rm(path, { force: true });
    await rmdir(directory);
  }
});
