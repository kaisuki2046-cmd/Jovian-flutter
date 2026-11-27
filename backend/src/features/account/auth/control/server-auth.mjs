import { randomBytes, randomUUID } from 'node:crypto';
import { fail } from '../../control/account-failure.mjs';
import { profileInput, publicProfile } from '../../profile/model/profile.mjs';
import { sessionSeconds, tokenHash } from '../model/session-secret.mjs';
import { hashPassword, verifyPassword } from '../model/password.mjs';
import { maxPasswordLength, minPasswordLength } from '../model/password-policy.mjs';
import { createVerificationCodes } from './verification-codes.mjs';
import { normalizeEmail, normalizePhone } from '../model/credential-identifier.mjs';

const attemptWindow = 15 * 60 * 1000;

function credentialInput(body, registering) {
  const password = passwordInput(body.password, registering);
  if (body.phone !== undefined) {
    const phone = normalizePhone(body.phone);
    if (!phone || body.email !== undefined) fail(400);
    return { phone, password };
  }
  return { email: requireEmail(body.email), password };
}

function requireEmail(value) {
  const email = normalizeEmail(value);
  if (!email) fail(400);
  return email;
}

function passwordInput(value, isNew = false) {
  if (typeof value !== 'string') fail(400);
  const length = Array.from(value).length;
  if (length < (isNew ? minPasswordLength : 1) || length > maxPasswordLength) fail(400);
  return value;
}

function phoneProof(scope, id, code) {
  if (typeof id !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code)) fail(400);
  return { scope, id, code };
}

function outcome(status, body) {
  return { status, body };
}

export function createAuthControl({ store, authProvider, deliverPhoneCode, deliverEmailCode, phoneCodesEnabled, localRegistration, now }) {
  const attempts = new Map();
  let nextSweep = 0;
  let activeDerivations = 0;
  const localDelivery = authProvider?.deliverCode;
  const deliver = deliverEmailCode || localDelivery;
  const phoneDelivery = phoneCodesEnabled && (deliverPhoneCode || (localDelivery &&
    ((message) => localDelivery({ ...message, channel: 'sms' }))));
  const phoneCodes = createVerificationCodes({
    deliver: phoneDelivery && (({ recipient, ...message }) => phoneDelivery({ ...message, recipient, phone: recipient })),
    now,
  });
  const emailCodes = createVerificationCodes({
    deliver: deliver && ((message) => deliver({ ...message, channel: 'email' })), now,
  });
  const recoveries = new Map();

  function limit(key, maximum) {
    const time = now();
    if (time >= nextSweep) {
      for (const [id, attempt] of attempts) {
        if (attempt.until <= time) attempts.delete(id);
      }
      nextSweep = time + 60_000;
    }
    let attempt = attempts.get(key);
    if (!attempt || attempt.until <= time) {
      if (attempts.size >= 10_000) fail(429);
      attempt = { count: 0, until: time + attemptWindow };
      attempts.set(key, attempt);
    }
    if (attempt.count >= maximum) fail(429);
    attempt.count += 1;
  }

  async function withDerivation(run) {
    if (activeDerivations >= 2) fail(429);
    activeDerivations += 1;
    try {
      return await run();
    } finally {
      activeDerivations -= 1;
    }
  }

  function ownerProfile(user) {
    const socialProvider = store.getSocialProvider(user.id);
    return { ...publicProfile(user), uid: store.getPublicUid(user.id),
      ...(socialProvider ? { socialProvider } : {}), ...(user.nickname_pending === 1 ? { nicknameRequired: true } : {}) };
  }

  function sessionOutcome(previousToken, secret, user, status, result) {
    if (previousToken) {
      store.revokeSession(previousToken);
      store.revokeGuest(previousToken);
    }
    return { status, secret, body: { user: ownerProfile(user), ...(result ? { result } : {}) } };
  }

  function requireSession(token) {
    const user = token && store.getBySession(token, now());
    if (!user) fail(401);
    return user;
  }

  function logout(token) {
    if (token) {
      store.revokeSession(token);
      store.revokeGuest(token);
    }
    return { status: 204, clearSession: true };
  }

  function restoreGuest(token) {
    const guest = store.getGuest(token, now());
    if (!guest) fail(401);
    return guest;
  }

  function enterGuest(token, ip) {
    const time = now();
    if (token && store.getBySession(token, time)) fail(409);
    const existing = store.getGuest(token, time);
    if (existing) return outcome(200, existing);
    limit('guest-session-ip:' + ip, 30);
    store.purgeGuests(time);
    const secret = randomBytes(32).toString('base64url');
    const guest = store.startGuest({ id: randomUUID(), token: tokenHash(secret), expiresAt: time + sessionSeconds * 1000 });
    return { status: 201, secret, body: guest };
  }

  async function issueRegistrationCode({ ip, readInput }) {
    if (!deliver) fail(503);
    limit('email-code-ip:' + ip, 30);
    const email = requireEmail((await readInput()).email);
    limit('email-code:' + email, 12);
    const result = await emailCodes.issue(email, email, 'email-register');
    if (result.status !== 200) fail(result.status);
    const { challengeId, expiresIn, delivery } = result.body;
    return outcome(200, { challengeId, expiresIn, ...(delivery ? { delivery } : {}) });
  }

  async function socialLogin(provider, { ip, token, readInput }) {
    if (!authProvider?.exchangeSocial) fail(503);
    limit('social-ip:' + ip, 30);
    const { authorizationCode } = await readInput();
    if (authorizationCode !== undefined &&
        (typeof authorizationCode !== 'string' || authorizationCode.length < 1 || authorizationCode.length > 1024)) fail(400);
    let identity;
    try {
      identity = await authProvider.exchangeSocial({ provider, authorizationCode });
    } catch {
      fail(503);
    }
    if (!identity) fail(401);
    if (typeof identity.subject !== 'string' || !identity.subject || identity.subject.length > 255) fail(503);
    const secret = randomBytes(32).toString('base64url');
    const time = now();
    const result = store.startSocialSession({
      namespace: authProvider.namespace, provider, subject: identity.subject, newId: randomUUID(),
      tokenHash: tokenHash(secret), expiresAt: time + sessionSeconds * 1000, now: time,
    });
    return sessionOutcome(token, secret, result.user, result.created ? 201 : 200, result.created ? 'created' : 'signed-in');
  }

  async function authenticate(registering, { ip, token, readInput }) {
    limit('auth-ip:' + ip, 30);
    const body = await readInput();
    const { email, phone, password } = credentialInput(body, registering);
    const hasProof = body.challengeId !== undefined || body.code !== undefined;
    if (registering && phone && (!localRegistration || hasProof)) fail(400);
    const requiresEmailCode = registering && !phone && (!localRegistration || hasProof);
    if (requiresEmailCode && !deliver) fail(503);
    limit(phone ? 'auth-phone:' + phone : 'auth-email:' + email, 10);
    const secret = randomBytes(32).toString('base64url');
    const digest = tokenHash(secret);
    let user;
    if (registering) {
      const profile = profileInput({ displayName: body.displayName, bio: '' });
      if (!profile) fail(400);
      const credentials = await withDerivation(() => {
        if (requiresEmailCode) {
          const proof = phoneProof(email, body.challengeId, body.code);
          const verified = emailCodes.consume(proof);
          if (verified.status !== 200) fail(verified.status);
        }
        return hashPassword(password);
      });
      const time = now();
      user = store.register({
        id: randomUUID(), email: email ?? null, phone, displayName: profile.displayName, ...credentials,
        tokenHash: digest, expiresAt: time + sessionSeconds * 1000, now: time,
      });
      if (!user) fail(409);
    } else {
      user = phone ? store.getByPasswordPhone(phone) : store.getByEmail(email);
      if (!await withDerivation(() => verifyPassword(password, user))) fail(401);
      const time = now();
      if (!store.createSession(user, digest, time + sessionSeconds * 1000, time, phone)) fail(401);
    }
    return sessionOutcome(token, secret, user, registering ? 201 : 200);
  }

  async function recoverPassword(action, { ip, token, readInput }) {
    if (!phoneDelivery) fail(503);
    limit('reset-ip:' + ip, 40);
    const body = await readInput();
    const phone = normalizePhone(body.phone);
    if (!phone) fail(400);
    limit('reset-phone:' + phone, 20);
    const scope = 'password-reset:' + phone;
    if (action === 'code') {
      const result = await phoneCodes.issue(scope, phone, 'password-reset', store.getByPhone(phone)?.id);
      if (result.status !== 200) fail(result.status);
      return outcome(200, result.body);
    }
    const user = store.getByPhone(phone);
    if (action === 'verify') {
      const proof = phoneProof(scope, body.challengeId, body.code);
      const verified = phoneCodes.consume(proof);
      if (verified.status !== 200) fail(verified.status);
      if (!user || user.id !== verified.subject) fail(422);
      const time = now();
      for (const [number, grant] of recoveries) {
        if (grant.expiresAt <= time) recoveries.delete(number);
      }
      if (!recoveries.has(phone) && recoveries.size >= 5000) fail(429);
      const secret = randomBytes(32).toString('base64url');
      recoveries.set(phone, { digest: tokenHash(secret), userId: user.id, passwordHash: user.password_hash, expiresAt: time + 300_000 });
      return outcome(200, { resetToken: secret });
    }
    const password = passwordInput(body.newPassword, true);
    const grant = recoveries.get(phone);
    if (typeof body.resetToken !== 'string' || !grant || grant.expiresAt <= now() ||
        tokenHash(body.resetToken) !== grant.digest || user?.id !== grant.userId || user.password_hash !== grant.passwordHash) fail(410);
    const credentials = await withDerivation(() => {
      recoveries.delete(phone);
      return hashPassword(password);
    });
    if (grant.expiresAt <= now() || !store.resetPassword(user, phone, credentials.salt, credentials.passwordHash)) fail(410);
    return { status: 204, clearSession: !store.getGuest(token, now()) };
  }

  async function phoneAction(purpose, issue, { ip, token, readInput }) {
    if (!phoneDelivery) fail(503);
    const currentCode = purpose === 'bind-current';
    const setupCode = purpose === 'password-setup';
    if ((currentCode || setupCode) && !issue) fail(404);
    const binding = purpose !== 'login';
    const owner = binding && token && store.getBySession(token, now());
    if (binding && !owner) fail(401);
    limit('phone-ip:' + ip, 40);
    const currentPhone = owner && owner.email === null ? store.getPhone(owner.id) : null;
    const usesPassword = owner && (owner.email !== null || (!currentPhone && owner.password_hash));
    if (owner && !usesPassword && !currentPhone) fail(403);
    if (setupCode && owner.password_hash) fail(409);
    const body = await readInput();
    const phone = setupCode ? currentPhone : normalizePhone(body.phone);
    if (!phone) fail(400);
    if (currentCode && (!currentPhone || currentPhone !== phone)) fail(400);
    limit('phone:' + purpose + ':' + phone, 20);
    const scope = [purpose, phone, binding ? token : ''].join(':');
    if (issue) {
      const subject = binding ? owner.id : store.getByPhone(phone)?.id;
      const result = await phoneCodes.issue(scope, phone, purpose, subject);
      if (result.status !== 200) fail(result.status);
      return outcome(200, result.body);
    }
    const proof = phoneProof(scope, body.challengeId, body.code);
    if (binding) {
      limit('phone-bind:' + owner.id, 8);
      let verification;
      if (usesPassword) {
        const password = passwordInput(body.password);
        if (!await withDerivation(() => verifyPassword(password, owner))) fail(412);
        verification = phoneCodes.consume(proof);
      } else {
        if (!currentPhone || currentPhone === phone) fail(400);
        const current = phoneProof(['bind-current', currentPhone, token].join(':'), body.currentChallengeId, body.currentCode);
        verification = phoneCodes.consume(proof, current);
      }
      if (verification.status !== 200) fail(verification.status);
      const result = store.bindPhone(owner, token, now(), phone, currentPhone);
      if (result === 'taken') fail(409);
      if (result === 'expired') fail(401);
      return outcome(200, { phone });
    }
    const verification = phoneCodes.consume(proof);
    if (verification.status !== 200) fail(verification.status);
    const secret = randomBytes(32).toString('base64url');
    const time = now();
    const result = store.startPhoneSession({
      phone, expectedUserId: verification.subject, newId: randomUUID(),
      tokenHash: tokenHash(secret), expiresAt: time + sessionSeconds * 1000, now: time,
    });
    if (result === 'password-required') fail(409);
    if (!result) fail(410);
    return sessionOutcome(token, secret, result.user, result.created ? 201 : 200, result.created ? 'created' : 'signed-in');
  }

  async function changePassword(user, { token, readInput }) {
    limit('password:' + user.id, 8);
    const body = await readInput();
    const nextPassword = passwordInput(body.newPassword, true);
    const currentPhone = user.password_hash ? null : store.getPhone(user.id);
    if (!user.password_hash && !currentPhone) fail(403);
    const credentials = await withDerivation(async () => {
      if (user.password_hash) {
        const password = passwordInput(body.currentPassword);
        if (password === nextPassword) fail(400);
        if (!await verifyPassword(password, user)) fail(422);
      } else {
        const proof = phoneProof(['password-setup', currentPhone, token].join(':'), body.challengeId, body.code);
        const verification = phoneCodes.consume(proof);
        if (verification.status !== 200) fail(verification.status);
      }
      return hashPassword(nextPassword);
    });
    if (!store.changePassword(user, token, now(), credentials.salt, credentials.passwordHash, currentPhone)) fail(401);
    if (currentPhone) return outcome(200, { user: ownerProfile({ ...user, password_hash: credentials.passwordHash }) });
    return outcome(204);
  }

  function deletionMethod(user) {
    if (user.password_hash) return 'password';
    if (store.getPhone(user.id)) return 'phone';
    const provider = store.getSocialProvider(user.id);
    if (!provider) return null;
    return authProvider?.namespace === 'local' ? 'local-social' : provider;
  }

  async function issueDeletionCode(user, { token, ip }) {
    if (deletionMethod(user) !== 'phone') fail(409);
    const phone = store.getPhone(user.id);
    limit('deletion-code-ip:' + ip, 12);
    limit('deletion-code:' + user.id, 5);
    const scope = ['account-deletion', phone, token].join(':');
    const result = await phoneCodes.issue(scope, phone, 'account-deletion', user.id);
    if (result.status !== 200) fail(result.status);
    const { challengeId, expiresIn, delivery } = result.body;
    return outcome(200, { challengeId, expiresIn, ...(delivery ? { delivery } : {}) });
  }

  async function verifyDeletion(user, token, body) {
    limit('account-deletion:' + user.id, 8);
    const method = deletionMethod(user);
    if (method === 'password') {
      const password = passwordInput(body.password);
      if (!await withDerivation(() => verifyPassword(password, user))) fail(422);
      const current = requireSession(token);
      if (current.id !== user.id || current.password_hash !== user.password_hash) fail(401);
    } else if (method === 'phone') {
      const scope = ['account-deletion', store.getPhone(user.id), token].join(':');
      const verification = phoneCodes.consume(phoneProof(scope, body.challengeId, body.code));
      if (verification.status !== 200) fail(verification.status);
      if (verification.subject !== user.id) fail(422);
    } else if (method && authProvider?.exchangeSocial) {
      const provider = store.getSocialProvider(user.id);
      const demo = method === 'local-social';
      const code = body.authorizationCode;
      if (demo ? body.simulateSocial !== true : (typeof code !== 'string' || !code || code.length > 1024)) fail(400);
      let identity;
      try {
        identity = await authProvider.exchangeSocial({ provider, authorizationCode: demo ? undefined : code });
      } catch {
        fail(503);
      }
      if (typeof identity?.subject !== 'string' ||
          !store.matchesSocialIdentity(user.id, authProvider.namespace, provider, identity.subject)) fail(422);
    } else {
      fail(503);
    }
  }

  return { authenticate, issueRegistrationCode, socialLogin, recoverPassword, phoneAction, enterGuest, restoreGuest, limit,
    changePassword, deletionMethod, issueDeletionCode, verifyDeletion, requireSession, ownerProfile, logout,
    emailRegistrationAvailable: Boolean(localRegistration || deliver),
    phoneCodesAvailable: Boolean(phoneDelivery),
    getPhone: (user) => store.getPhone(user.id) };
}
