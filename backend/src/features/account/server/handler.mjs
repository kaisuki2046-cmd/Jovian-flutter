import { AccountError, fail } from '../control/account-failure.mjs';
import { createAuthControl } from '../auth/control/server-auth.mjs';
import { sessionSeconds, tokenHash } from '../auth/model/session-secret.mjs';
import { createProfileControl } from '../profile/control/server-profile.mjs';
import { createReadingProfileControl } from '../reading-profile/control/server-reading-profile.mjs';
import { createDestinyHistoryControl } from '../history/control/server-destiny-history.mjs';
import { createReadingHistoryControl } from '../history/control/server-reading-history.mjs';
import { createAgreementControl } from '../control/server-agreements.mjs';
import { createDeletionControl } from '../control/server-deletion.mjs';
import { createPrivacyRequestControl } from '../control/server-privacy-requests.mjs';
import { maxReportBodyBytes } from '../../../shared/content-limits.mjs';
import { createRelationshipControl } from '../../social/server-entry.mjs';
import { profileForVisitor } from '../profile/model/profile.mjs';

const maxBody = 4096;
const maxArchiveBody = maxReportBodyBytes;
const destinyHistoryPath = '/account/destiny-history';
const chartSnapshotPrefix = '/account/chart-snapshots/';
const synastrySnapshotPrefix = '/account/synastry-chart-snapshots/';

async function readBody(request, limit = maxBody) {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers['content-type'] ?? '')) fail(415);
  if (Number(request.headers['content-length']) > limit) fail(413);
  let total = 0;
  const chunks = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    total += chunk.length;
    if (total > limit) fail(413);
    chunks.push(chunk);
  }
  try {
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (result && typeof result === 'object' && !Array.isArray(result)) return result;
  } catch {
    fail(400);
  }
  return fail(400);
}

function reply(response, status, body) {
  if (body === undefined) {
    response.writeHead(status).end();
  } else {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(body));
  }
}

function requestMode(request, allowedOrigin) {
  const origin = request.headers.origin;
  if (origin && origin !== allowedOrigin) fail(403);
  if (!origin && request.headers['x-app-client'] === 'native') return 'native';
  if (origin || request.method === 'GET') return 'web';
  return fail(403);
}

function requestToken(request, mode, cookieName) {
  if (mode === 'native') {
    return /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization ?? '')?.[1];
  }
  const cookie = (request.headers.cookie ?? '').split(';').find((part) => part.trimStart().startsWith(cookieName + '='));
  return cookie?.trim().slice(cookieName.length + 1);
}

export function createAccountHandler({ store, webOrigin, authProvider, deliverPhoneCode, deliverEmailCode, phoneCodesEnabled = true,
  isolateLocalSession = false, allowUnverifiedRegistration = false, publishedAgreements, eraseReadings = () => {},
  moderatorIds = [], privacyReviewerIds = [], now = Date.now }) {
  const origin = new URL(webOrigin);
  const secure = origin.protocol === 'https:';
  const localPort = isolateLocalSession && !secure && origin.hostname === 'localhost' && origin.port;
  const cookieName = secure ? '__Host-app_session' : localPort ? 'app_session_' + localPort : 'app_session';
  const localWeb = !secure && ['localhost', '127.0.0.1'].includes(origin.hostname);
  const localSocialProviders = localWeb
    && authProvider?.namespace === 'local' && typeof authProvider.exchangeSocial === 'function' ? ['wechat', 'qq'] : [];
  const localRegistration = localWeb && allowUnverifiedRegistration;
  const auth = createAuthControl({ store, authProvider, deliverPhoneCode, deliverEmailCode, phoneCodesEnabled, localRegistration, now });
  const moderators = new Set(moderatorIds);
  const profile = createProfileControl({ store, now, ownerProfile: auth.ownerProfile });
  const reading = createReadingProfileControl({ store, now });
  const history = createDestinyHistoryControl({ store, now, limit: auth.limit });
  const readingHistory = createReadingHistoryControl({ store, now, limit: auth.limit });
  const agreements = createAgreementControl({ store, now, publishedAgreements, limit: auth.limit });
  const deletion = createDeletionControl({ store, auth, now, eraseReadings });
  const privacyRequests = createPrivacyRequestControl({ store: store.privacyRequests, now, limit: auth.limit, reviewerIds: privacyReviewerIds });
  const social = createRelationshipControl({
    store: store.social, now, fail, limit: auth.limit,
    canModerate: (id) => moderators.has(id),
    findUserByUid: store.findUserByUid,
    findUsersByNickname: store.findUsersByNickname,
    publicFields(id) {
      const record = store.getProfile(id);
      return record ? { ...profileForVisitor(record), uid: store.getPublicUid(id) } : undefined;
    },
  });
  deletion.retryPending();

  function setCookie(response, value, maxAge) {
    const attributes = '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAge + (secure ? '; Secure' : '');
    response.setHeader('Set-Cookie', cookieName + '=' + value + attributes);
  }

  function sendOutcome(response, mode, { status, body, secret, clearSession }) {
    if (mode === 'web') {
      if (secret) setCookie(response, secret, sessionSeconds);
      else if (clearSession) setCookie(response, '', 0);
    }
    return reply(response, status, secret && mode === 'native' ? { ...body, token: secret } : body);
  }

  const handle = async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Vary', 'Origin');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.headers.origin === webOrigin) {
      response.setHeader('Access-Control-Allow-Origin', webOrigin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    try {
      if (request.method === 'OPTIONS' && request.headers.origin === webOrigin) {
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return reply(response, 204);
      }
      const mode = requestMode(request, webOrigin);
      const token = tokenHash(requestToken(request, mode, cookieName));
      const url = new URL(request.url, 'http://localhost');
      const path = url.pathname;
      const route = request.method + ' ' + path;
      const input = { ip: request.socket.remoteAddress, token, readInput: () => readBody(request) };
      const send = (outcome) => sendOutcome(response, mode, outcome);
      async function signIn(start) {
        const body = await input.readInput();
        const decisions = agreements.validateSignIn(body.acceptance);
        const outcome = await start({ ...input, readInput: () => body });
        try {
          agreements.recordSignIn(outcome.secret ? tokenHash(outcome.secret) : token, decisions);
        } catch (error) {
          if (outcome.secret) auth.logout(tokenHash(outcome.secret));
          throw error;
        }
        return send(outcome);
      }

      if (route === 'GET /account/auth/capabilities') {
        return reply(response, 200, {
          localSocialProviders, emailRegistrationCodeRequired: !localRegistration, phoneRegistrationWithoutCode: localRegistration,
          emailRegistrationAvailable: auth.emailRegistrationAvailable, phoneCodesAvailable: auth.phoneCodesAvailable,
        });
      }
      if (route === 'GET /account/agreements/catalog') return reply(response, 200, agreements.catalog());
      if (route === 'GET /account/agreements') return reply(response, 200, agreements.state(token));
      if (route === 'GET /account/agreements/permission') {
        return reply(response, 200, agreements.permission(token, url.searchParams.get('purpose')));
      }
      if (route === 'POST /account/agreements/confirmation') {
        return reply(response, 200, await agreements.acceptRequired(input));
      }
      if (route === 'POST /account/agreements/permission') {
        return reply(response, 200, await agreements.choosePermission(input));
      }
      const agreementVersion = /^GET \/account\/agreements\/(terms|privacy|ai)\/([A-Za-z0-9.-]{1,50})$/.exec(route);
      if (agreementVersion) return reply(response, 200, agreements.version(token, agreementVersion[1], agreementVersion[2]));
      if (route === 'GET /account/deletion') return reply(response, 200, deletion.prepare(token));
      if (route === 'POST /account/deletion/code') return send(await deletion.issueCode(input));
      if (route === 'POST /account/deletion') {
        return send(await deletion.submit({ ...input, readInput: () => readBody(request, 16_384) }));
      }
      if (route === 'POST /account/deletion/status') return reply(response, 200, await deletion.status(input));
      const isSocial = path.startsWith('/social/');
      if (isSocial || path === '/account/privacy-requests' || path === '/account/privacy-requests/review') {
        const user = auth.requireSession(token);
        const requireCurrentAccount = () => {
          if (auth.requireSession(token).id !== user.id) fail(401);
          if (!agreements.isConfirmed({ kind: 'member', id: user.id })) fail(428);
        };
        requireCurrentAccount();
        const run = isSocial ? social : privacyRequests;
        return reply(response, 200, await run(route, url, user.id,
          isSocial ? (limit) => readBody(request, limit) : input.readInput, requireCurrentAccount));
      }
      if (route === 'GET /account/auth/guest') return reply(response, 200, auth.restoreGuest(token));
      if (route === 'POST /account/auth/guest') {
        return await signIn(() => auth.enterGuest(token, input.ip));
      }
      if (route === 'POST ' + destinyHistoryPath) {
        return reply(response, 200, await history.save(token, () => readBody(request, maxArchiveBody)));
      }
      if (route === 'POST /account/reading-history') {
        return reply(response, 200, await readingHistory.save(token, () => readBody(request, maxArchiveBody)));
      }
      if (request.method === 'GET' && (path === '/account/reading-history' || path.startsWith('/account/reading-history/'))) {
        return reply(response, 200, readingHistory.get(token, url.searchParams,
          path === '/account/reading-history' ? undefined : path.slice('/account/reading-history/'.length)));
      }
      if (request.method === 'GET' && path.startsWith(chartSnapshotPrefix)) {
        const version = path.slice(chartSnapshotPrefix.length);
        return reply(response, 200, history.chartSnapshot(token, url.searchParams.get('expectedOwnerId'),
          version === 'latest' ? undefined : version));
      }
      if (request.method === 'GET' && path.startsWith(synastrySnapshotPrefix)) {
        const version = path.slice(synastrySnapshotPrefix.length);
        return reply(response, 200, history.synastrySnapshot(token, url.searchParams.get('expectedOwnerId'),
          version === 'latest' ? undefined : version, url.searchParams.get('calculationContext') === '1'));
      }
      if (request.method === 'GET' && (path === destinyHistoryPath || path.startsWith(destinyHistoryPath + '/'))) {
        const expectedOwnerId = url.searchParams.get('expectedOwnerId');
        if (path === destinyHistoryPath) return reply(response, 200, history.list(token, expectedOwnerId, url.searchParams.get('before')));
        const id = path.slice(destinyHistoryPath.length + 1);
        return reply(response, 200, id === 'latest' ? history.latest(token, expectedOwnerId) : history.detail(token, expectedOwnerId, id));
      }

      if (route === 'POST /account/auth/register/code') return send(await auth.issueRegistrationCode(input));
      const socialRoute = /^POST \/account\/auth\/social\/(wechat|qq)$/.exec(route);
      if (socialRoute) return await signIn((verified) => auth.socialLogin(socialRoute[1], verified));
      if (route === 'POST /account/auth/register' || route === 'POST /account/auth/login') {
        return await signIn((verified) => auth.authenticate(route.endsWith('/register'), verified));
      }
      if (route === 'POST /account/auth/logout') return send(auth.logout(token));

      const recoveryRoute = /^POST \/account\/auth\/password-reset\/(code|verify|complete)$/.exec(route);
      if (recoveryRoute) return send(await auth.recoverPassword(recoveryRoute[1], input));
      const phoneRoute = /^POST \/account\/auth\/phone\/(login|bind|bind-current|password-setup)(\/code)?$/.exec(route);
      if (phoneRoute) {
        if (phoneRoute[1] === 'login' && !phoneRoute[2]) {
          return await signIn((verified) => auth.phoneAction('login', false, verified));
        }
        return send(await auth.phoneAction(phoneRoute[1], Boolean(phoneRoute[2]), input));
      }

      const visibleRoute = /^GET \/account\/reading-profile\/visible\/([\da-f-]{36})$/.exec(route);
      const visitorRoute = /^GET \/account\/profile\/visible\/([\da-f-]{36})$/.exec(route);
      const ownPreview = route === 'GET /account/profile/preview';
      if (!visibleRoute && !visitorRoute && !ownPreview && ![
        'GET /account/session', 'PATCH /account/profile', 'POST /account/auth/password',
        'GET /account/auth/identity-verification', 'POST /account/auth/identity-verification',
        'GET /account/auth/phone', 'GET /account/reading-profile', 'PATCH /account/reading-profile',
        'GET /account/reading-profile/preview', 'GET /account/reading-profile/wheel-defaults',
        'GET /account/reading-profile/birth-profile', 'PATCH /account/reading-profile/birth-profile',
      ].includes(route)) fail(404);
      const user = auth.requireSession(token);
      if ((visitorRoute || visibleRoute) && store.social.isBlocked(user.id, (visitorRoute ?? visibleRoute)[1])) fail(404);
      if (route === 'GET /account/session') return reply(response, 200, { user: auth.ownerProfile(user) });
      if (route === 'GET /account/auth/identity-verification') return reply(response, 200, { status: 'not_enabled' });
      if (route === 'POST /account/auth/identity-verification') {
        request.resume();
        return reply(response, 503, { code: 'IDENTITY_VERIFICATION_NOT_ENABLED' });
      }
      if (route === 'GET /account/auth/phone') return reply(response, 200, { phone: auth.getPhone(user) });
      if (ownPreview || visitorRoute) return reply(response, 200, profile.preview(user, visitorRoute?.[1]));
      if (visibleRoute) return reply(response, 200, reading.visible(visibleRoute[1]));
      if (route === 'GET /account/reading-profile/preview') return reply(response, 200, reading.preview(user.id));
      if (route === 'GET /account/reading-profile/wheel-defaults') return reply(response, 200, reading.wheelDefaults(user.id));
      if (route === 'GET /account/reading-profile/birth-profile') {
        return reply(response, 200, reading.birthProfile(user.id, url.searchParams.get('expectedOwnerId'), url.searchParams.get('fields')));
      }
      if (route === 'PATCH /account/reading-profile/birth-profile') {
        return reply(response, 200, reading.confirmBirthProfile(user.id, token, await input.readInput()));
      }
      if (route === 'GET /account/reading-profile') return reply(response, 200, reading.owner(user.id));
      if (route === 'PATCH /account/reading-profile') {
        return reply(response, 200, reading.update(user.id, token, await input.readInput()));
      }
      if (route === 'PATCH /account/profile') {
        return reply(response, 200, profile.update(user.id, token, await input.readInput()));
      }
      return send(await auth.changePassword(user, input));
    } catch (error) {
      if (!(error instanceof AccountError)) console.error('Account request failed', error.name);
      const status = error instanceof AccountError ? error.status : 500;
      if (status === 413) {
        request.resume();
        response.setHeader('Connection', 'close');
      }
      reply(response, status, { status, ...(status === 503 ? { code: 'AUTH_PROVIDER_UNAVAILABLE' } : {}) });
    }
  };
  handle.retryPendingDeletions = deletion.retryPending;
  return handle;
}
