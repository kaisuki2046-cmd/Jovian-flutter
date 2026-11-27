const userId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const publicUid = /^[1-9]\d{7}$/;
const cursorPattern = /^(\d{1,16})\.([a-f0-9-]{36})$/;
const reportReasons = new Set(['harassment', 'impersonation', 'spam', 'other']);
const reportDecisions = new Set(['resolved', 'dismissed']);

function receipt({ id, reason, status, createdAt, reviewedAt, conclusion }) {
  return { id, reason, status, createdAt, reviewedAt, conclusion };
}

export function createRelationshipControl({ store, publicFields, findUserByUid, findUsersByNickname, now, fail, limit,
  canModerate = () => false }) {
  function visibleCard(viewer, target, search = false) {
    if (search && viewer !== target && !store.isDiscoverable(target)) return;
    if (!store.available(viewer, target)) return;
    const profile = publicFields(target);
    if (profile) return { id: target, ...profile, ...store.count(target), ...store.relation(viewer, target) };
  }

  function card(viewer, target, search = false) {
    const profile = visibleCard(viewer, target, search);
    if (!profile) fail(404);
    return profile;
  }

  function targetId(viewer, target) {
    if (typeof target !== 'string' || !userId.test(target) || target === viewer) fail(400);
    return target;
  }

  function pageCursor(url) {
    const before = url.searchParams.get('before');
    if (before === null) return [Number.MAX_SAFE_INTEGER, ''];
    const parsed = cursorPattern.exec(before);
    if (!parsed || !Number.isSafeInteger(Number(parsed[1])) || !userId.test(parsed[2])) fail(400);
    return [Number(parsed[1]), parsed[2]];
  }

  return async function socialRequest(route, url, viewer, readInput, requireCurrentAccount) {
    if (route === 'GET /social/me') {
      return { ...store.count(viewer), discoverable: store.isDiscoverable(viewer) };
    }
    if (route === 'GET /social/search') {
      limit('social-search:' + viewer, 80);
      const uid = url.searchParams.get('uid');
      const legacyId = url.searchParams.get('id');
      const nickname = url.searchParams.get('nickname');
      if (nickname !== null) {
        const name = nickname.trim();
        if (uid !== null || legacyId !== null || !name || Array.from(name).length > 40) fail(400);
        const items = [];
        for (const target of findUsersByNickname(name)) {
          const profile = visibleCard(viewer, target, true);
          if (profile?.displayName) items.push(profile);
          if (items.length === 20) break;
        }
        return { items };
      }
      if (uid ? !publicUid.test(uid) : !userId.test(legacyId ?? '')) fail(400);
      const target = uid ? findUserByUid(uid) : legacyId;
      if (!target) fail(404);
      return card(viewer, target, true);
    }
    if (route === 'GET /social/blocks') return {
      items: store.listBlocks(viewer).map(({ id }) => ({ id, uid: publicFields(id)?.uid })),
    };
    if (route === 'GET /social/followers' || route === 'GET /social/following') {
      const direction = route.slice('GET /social/'.length);
      const result = store.list(viewer, direction, ...pageCursor(url));
      return { items: result.items.map(({ id }) => card(viewer, id)), next: result.next };
    }
    if (route === 'GET /social/notifications/summary') return { unread: store.unread(viewer), canModerate: canModerate(viewer) };
    if (route === 'GET /social/notifications') {
      const { items, next } = store.notifications(viewer, ...pageCursor(url));
      return { unread: store.unread(viewer), next, items: items.map(({ id, actorId, createdAt, readAt }) =>
        ({ id, createdAt, readAt, actor: visibleCard(viewer, actorId) })) };
    }
    if (route === 'GET /social/reports') {
      const { items, next } = store.reports(viewer, ...pageCursor(url));
      return { items: items.map(receipt), next };
    }
    if (route === 'GET /social/moderation/reports') {
      if (!canModerate(viewer)) fail(403);
      return store.pendingReports(...pageCursor(url));
    }
    const profile = /^GET \/social\/profiles\/([a-f0-9-]{36})$/.exec(route);
    if (profile) {
      limit('social-profile:' + viewer, 120);
      if (!userId.test(profile[1])) fail(400);
      return card(viewer, profile[1]);
    }
    if (!['POST /social/discoverability', 'POST /social/follows', 'POST /social/blocks', 'POST /social/reports',
      'POST /social/notifications/read', 'POST /social/moderation/reports'].includes(route)) {
      fail(404);
    }
    if (route === 'POST /social/moderation/reports' && !canModerate(viewer)) fail(403);
    limit('social-change:' + viewer, 80);
    const input = await readInput();
    requireCurrentAccount();
    if (route === 'POST /social/notifications/read') {
      const id = input.id;
      if (id === undefined ? input.all !== true : typeof id !== 'string' || !userId.test(id) || input.all !== undefined) fail(400);
      if (!store.readNotifications(viewer, id, now())) fail(404);
      return { unread: store.unread(viewer) };
    }
    if (route === 'POST /social/moderation/reports') {
      const { id, status, conclusion } = input;
      if (typeof id !== 'string' || !userId.test(id) || !reportDecisions.has(status) ||
          typeof conclusion !== 'string' || !conclusion.trim() || [...conclusion].length > 400) fail(400);
      const item = store.review(id, viewer, status, conclusion.trim(), now());
      if (item === undefined) fail(404);
      if (item === null) fail(409);
      if (item === false) fail(403);
      return receipt(item);
    }
    if (route === 'POST /social/discoverability') {
      if (typeof input.allowed !== 'boolean') fail(400);
      store.setDiscoverable(viewer, input.allowed);
      return { discoverable: input.allowed };
    }
    const target = targetId(viewer, input.id);
    if (route === 'POST /social/follows') {
      if (typeof input.active !== 'boolean') fail(400);
      card(viewer, target);
      if (!store.follow(viewer, target, input.active, now())) fail(404);
      return { ...store.relation(viewer, target), ...store.count(target) };
    }
    if (route === 'POST /social/blocks') {
      if (typeof input.active !== 'boolean') fail(400);
      if (input.active) {
        card(viewer, target);
        store.block(viewer, target);
      } else {
        store.unblock(viewer, target);
      }
      return { blocked: input.active };
    }
    limit('social-report:' + viewer, 8);
    const detail = input.detail ?? '';
    if (!reportReasons.has(input.reason) || typeof detail !== 'string' || [...detail].length > 400) fail(400);
    const existing = store.reportForPair(viewer, target);
    if (existing) return { accepted: true, report: receipt(existing) };
    // A user can report someone they blocked, without restoring visibility.
    if (!store.listBlocks(viewer).some(({ id }) => id === target)) card(viewer, target);
    return { accepted: true, report: receipt(store.report(viewer, target, input.reason, detail.trim(), now())) };
  };
}
