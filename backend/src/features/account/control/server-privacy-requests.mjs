import { fail } from './account-failure.mjs';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const prefix = '/account/privacy-requests';

function receipt({ ownerId, ...item }) {
  return item;
}

function cursor(url) {
  const before = url.searchParams.get('before');
  if (before === null) return [Number.MAX_SAFE_INTEGER, ''];
  const parsed = /^(\d{1,16})\.(.+)$/.exec(before);
  if (!parsed || !Number.isSafeInteger(Number(parsed[1])) || !uuid.test(parsed[2])) fail(400);
  return [Number(parsed[1]), parsed[2]];
}

export function createPrivacyRequestControl({ store, now, limit, reviewerIds }) {
  const reviewers = new Set(reviewerIds);
  return async function privacyRequest(route, url, userId, readInput, requireCurrentAccount) {
    const canReview = reviewers.has(userId);
    if (route === 'GET ' + prefix) {
      const { items, next } = store.list(userId, ...cursor(url));
      return { items: items.map(receipt), next, canReview };
    }
    if (route === 'GET ' + prefix + '/review') {
      if (!canReview) fail(403);
      return store.queue(...cursor(url));
    }
    if (route !== 'POST ' + prefix && route !== 'POST ' + prefix + '/review') fail(404);
    if (route.endsWith('/review') && !canReview) fail(403);
    limit('privacy-request:' + userId, 20);
    const input = await readInput();
    requireCurrentAccount();
    if (route === 'POST ' + prefix) {
      const { kind, detail } = input;
      if (!['access_copy', 'correction'].includes(kind) || typeof detail !== 'string' ||
          [...detail].length > 600 || (kind === 'correction' && !detail.trim())) fail(400);
      return receipt(store.submit(userId, kind, detail.trim(), now()));
    }
    const { id, conclusion } = input;
    if (typeof id !== 'string' || !uuid.test(id) || typeof conclusion !== 'string' ||
        !conclusion.trim() || [...conclusion].length > 600) fail(400);
    const result = store.review(id, userId, conclusion.trim(), now());
    if (result === undefined) fail(404);
    if (result === false) fail(403);
    if (result === null) fail(409);
    return receipt(result);
  };
}
