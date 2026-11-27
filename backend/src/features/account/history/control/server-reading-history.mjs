import { createHash } from 'node:crypto';
import { fail } from '../../control/account-failure.mjs';
import { parseReadingArchive, readingKinds } from '../model/reading-archive.mjs';

export function createReadingHistoryControl({ store, now, limit }) {
  const validId = value => typeof value === 'string' && /^[a-f\d]{64}$/u.test(value);
  function owner(token, expected, kind) {
    const identity = store.getArchiveIdentity(token, now());
    if (!identity) fail(401);
    if (expected !== identity.id) fail(403);
    if (!readingKinds.includes(kind)) fail(400);
    return identity;
  }
  return {
    async save(token, read) {
      if (!store.getArchiveIdentity(token, now())) fail(401);
      const { expectedOwnerId, report: input } = await read();
      const identity = owner(token, expectedOwnerId, input?.kind);
      limit('reading-archive:' + identity.id, 60);
      const report = parseReadingArchive(input);
      if (!report) fail(400);
      const serialized = JSON.stringify(report);
      const id = createHash('sha256').update(serialized).digest('hex');
      const record = store.saveReadingArchive(identity, token, now(), id, report, serialized);
      if (!record) fail(401);
      return record;
    },
    get(token, query, id) {
      const identity = owner(token, query.get('expectedOwnerId'), query.get('kind'));
      const kind = query.get('kind');
      if (id === 'latest') {
        const key = query.get('contextKey');
        if (key !== null && (!key.trim() || key.length > 512)) fail(400);
        return store.latestReadingArchive(identity, kind, key) ?? null;
      }
      if (id !== undefined) {
        if (!validId(id)) fail(400);
        const record = store.getReadingArchive(identity, kind, id);
        if (!record) fail(404);
        return record;
      }
      const before = query.get('before');
      if (before !== null && !validId(before)) fail(400);
      const rows = store.listReadingArchives(identity, kind, before);
      if (!rows) fail(404);
      const entries = rows.slice(0, 20);
      return { entries, nextCursor: rows.length > 20 ? entries[19].id : null };
    },
  };
}
