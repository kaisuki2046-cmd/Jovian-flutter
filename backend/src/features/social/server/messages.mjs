const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const noncePattern = /^[A-Za-z0-9_-]{22}$/;
const inboxCursor = /^([01])\.(\d{1,16})\.([a-f0-9-]{36})$/;
const positiveInteger = /^\d{1,16}$/;
const uid = /^[1-9]\d{7}$/;
const maxMedia = 5 * 1024 * 1024;
const maxPayload = Math.ceil(maxMedia / 3) * 4 + 8192;
const mediaTypes = {
  image: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  video: new Set(['video/mp4', 'video/webm', 'video/quicktime']),
  audio: new Set(['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg']),
  file: new Set(['application/octet-stream']),
};

export function createMessageControl({ relationships, publicFields, findUserByUid, findUsersByNickname, now, fail, limit }) {
  const store = relationships.messages;
  const isId = value => typeof value === 'string' && uuid.test(value);
  const isNonce = value => typeof value === 'string' && noncePattern.test(value);
  const isSequence = value => Number.isSafeInteger(value) && value > 0;
  const nameFor = id => {
    const profile = publicFields(id);
    return profile?.displayName ?? (profile?.uid ? `UID ${profile.uid}` : null);
  };

  function presentThread({ id, kind, title, peerId, pinned, updatedAt, preview, previewKind, unread, matchText, matchId }) {
    return {
      id, kind, title: kind === 'direct' ? nameFor(peerId) : title,
      pinned: pinned === 1, updatedAt, preview, previewKind, unread, matchText, matchId,
    };
  }

  function presentMessage({ id, senderId, body, createdAt, mediaKind, mediaName, mediaType, mediaSize, replySenderId, replyBody, replyKind }) {
    return {
      id, senderId, senderName: nameFor(senderId), body, createdAt,
      attachment: mediaKind ? { kind: mediaKind, name: mediaName, type: mediaType, size: mediaSize } : null,
      reply: replySenderId ? { name: nameFor(replySenderId), body: replyBody, kind: replyKind } : null,
    };
  }

  function readMedia(value) {
    if (value == null) return null;
    const { kind, name, type, data } = value;
    if (typeof kind !== 'string' || !Object.hasOwn(mediaTypes, kind) || !mediaTypes[kind].has(type) ||
        typeof name !== 'string' || name.trim() === '' || [...name].length > 120 ||
        /[\u0000-\u001f\u007f/\\]/u.test(name) || ['.', '..'].includes(name) ||
        typeof data !== 'string' || data.length > Math.ceil(maxMedia / 3) * 4 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) fail(400);
    const bytes = Buffer.from(data, 'base64');
    if (!bytes.length || bytes.length > maxMedia || bytes.toString('base64') !== data) fail(400);
    return { kind, name, type, bytes };
  }

  return async function conversationRequest(route, url, viewer, readInput, requireCurrentAccount) {
    if (route === 'GET /social/conversations') {
      limit('social-inbox:' + viewer, 180);
      const query = (url.searchParams.get('q') ?? '').trim();
      const cursor = url.searchParams.get('before');
      const parsed = cursor === null ? null : inboxCursor.exec(cursor);
      if ([...query].length > 80 || (cursor !== null && (!parsed || !isId(parsed[3]) ||
          !Number.isSafeInteger(Number(parsed[2]))))) fail(400);
      const target = uid.test(query) ? findUserByUid(query) : null;
      const contacts = query ? (target ? [target] : findUsersByNickname(query))
        .filter(id => nameFor(id)?.toLowerCase() === query.toLowerCase() || publicFields(id)?.uid === query) : [];
      const { items, next } = store.list(viewer, {
        pin: parsed === null ? 2 : Number(parsed[1]),
        time: parsed === null ? Number.MAX_SAFE_INTEGER : Number(parsed[2]),
        before: parsed?.[3] ?? '',
        unreadOnly: Number(url.searchParams.get('unread') === '1'),
        query, contacts,
      });
      return { items: items.map(presentThread), next };
    }
    if (route === 'POST /social/conversations') {
      limit('social-open-thread:' + viewer, 30);
      const input = await readInput();
      requireCurrentAccount();
      const group = input.title !== undefined;
      const title = group && typeof input.title === 'string' ? input.title.trim() : null;
      const targets = group ? input.members : [input.id];
      if (group && (!title || [...title].length > 48 || !isNonce(input.nonce))) fail(400);
      if (!Array.isArray(targets) || targets.length < (group ? 2 : 1) || targets.length > 19 ||
          new Set(targets).size !== targets.length || targets.some(id => !isId(id) || id === viewer)) fail(400);
      if (targets.some(id => !relationships.available(viewer, id) || !publicFields(id))) fail(404);
      const id = store.start(viewer, targets, title, group ? input.nonce : null, now());
      return { thread: presentThread(store.summary(viewer, id)) };
    }

    const match = /^(GET|POST) \/social\/conversations\/([a-f0-9-]{36})\/(messages|read|pin|members|attachment)(?:\/(\d{1,16}))?$/.exec(route);
    if (!match || !isId(match[2]) || !store.membership(viewer, match[2])) fail(404);
    const [, method, thread, action, attachmentId] = match;
    if (method === 'GET') {
      limit('social-thread-read:' + viewer, 240);
      if (action === 'attachment' && isSequence(Number(attachmentId))) {
        const attachment = store.attachment(viewer, thread, Number(attachmentId));
        if (!attachment) fail(404);
        return { data: Buffer.from(attachment.bytes).toString('base64') };
      }
      if (attachmentId !== undefined) fail(404);
      if (action === 'members') {
        return { items: store.members(viewer, thread).map(({ id }) => ({ id, name: nameFor(id) })) };
      }
      if (action !== 'messages') fail(404);
      const cursor = url.searchParams.get('before');
      if (cursor !== null && (!positiveInteger.test(cursor) || !isSequence(Number(cursor)))) fail(400);
      const { items, next } = store.messages(viewer, thread, cursor === null ? Number.MAX_SAFE_INTEGER : Number(cursor));
      return { items: items.map(presentMessage), next: next?.toString() };
    }

    if (attachmentId !== undefined || !['messages', 'read', 'pin'].includes(action)) fail(404);
    limit('social-thread-' + action + ':' + viewer, action === 'read' ? 240 : 90);
    const input = action === 'messages' ? await readInput(maxPayload) : await readInput();
    requireCurrentAccount();
    if (!store.membership(viewer, thread)) fail(404);
    if (action === 'read') {
      if (!isSequence(input.through)) fail(400);
      if (!store.markRead(viewer, thread, input.through)) fail(404);
      return {};
    }
    if (action === 'pin') {
      if (typeof input.pinned !== 'boolean') fail(400);
      store.setPinned(viewer, thread, input.pinned);
      return { pinned: input.pinned };
    }
    const body = typeof input.body === 'string' ? input.body.trim() : '';
    const replyTo = input.replyTo ?? null;
    if (!isNonce(input.nonce) || [...body].length > 1500 || (replyTo !== null && !isSequence(replyTo))) fail(400);
    const media = readMedia(input.attachment);
    if (!body && media === null) fail(400);
    const saved = store.send(viewer, thread, { body, nonce: input.nonce, replyTo, media }, now());
    if (!saved) fail(404);
    return { message: presentMessage(saved) };
  };
}
