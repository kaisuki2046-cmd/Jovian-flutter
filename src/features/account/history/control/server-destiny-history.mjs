import { createHash } from 'node:crypto';
import { fail } from '../../control/account-failure.mjs';
import { parseDestinyArchive } from '../model/destiny-archive.mjs';
import { projectSynastrySnapshot } from '../model/synastry-projection.mjs';

const archiveIdPattern = /^[\da-f]{64}$/u;
const ownerIdPattern = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/u;

export function createDestinyHistoryControl({ store, now, limit }) {
  function requireOwner(token, expectedOwnerId) {
    const owner = store.getArchiveIdentity(token, now());
    if (!owner) fail(401);
    if (typeof expectedOwnerId !== 'string' || !ownerIdPattern.test(expectedOwnerId)) fail(400);
    if (expectedOwnerId !== owner.id) fail(403);
    return owner;
  }

  function findRecord(owner, id) {
    if (id === undefined) return store.getLatestDestinyArchive(owner);
    if (!archiveIdPattern.test(id)) fail(400);
    const record = store.getDestinyArchive(owner, id);
    if (!record) fail(404);
    return record;
  }

  return {
    async save(token, readInput) {
      const initial = store.getArchiveIdentity(token, now());
      if (!initial) fail(401);
      limit('destiny-archive:' + initial.id, 60);
      const { expectedOwnerId, report: input } = await readInput();
      const owner = requireOwner(token, expectedOwnerId);
      const report = parseDestinyArchive(input);
      if (!report) fail(400);
      const serialized = JSON.stringify(report);
      // Preserve the existing V1 identifier for reports previously saved with an empty sections array.
      const { charts, chartSnapshot, ...meta } = report;
      const id = createHash('sha256').update(JSON.stringify({
        ...meta, sections: [], charts, ...(chartSnapshot && { chartSnapshot }),
      })).digest('hex');
      const entry = store.saveDestinyArchive(owner, token, now(), id, report, serialized);
      if (!entry) fail(401);
      return report.chartSnapshot ? { ...entry, chartSnapshotSaved: true } : entry;
    },
    latest(token, expectedOwnerId) {
      const owner = requireOwner(token, expectedOwnerId);
      return store.getLatestDestinyArchive(owner) ?? null;
    },
    list(token, expectedOwnerId, before) {
      const owner = requireOwner(token, expectedOwnerId);
      if (before !== null && !archiveIdPattern.test(before)) fail(400);
      const rows = store.listDestinyArchives(owner, before);
      if (!rows) fail(404);
      const entries = rows.slice(0, 20);
      return { entries, nextCursor: rows.length > 20 ? entries[19].id : null };
    },
    detail(token, expectedOwnerId, id) {
      const owner = requireOwner(token, expectedOwnerId);
      return findRecord(owner, id);
    },
    chartSnapshot(token, expectedOwnerId, id) {
      const record = findRecord(requireOwner(token, expectedOwnerId), id);
      if (!record) return { status: 'no_archive' };
      const { id: archiveId, calculatedAt, report: { chartSnapshot } } = record;
      return chartSnapshot
        ? { status: 'available', archiveId, calculatedAt, chartSnapshot }
        : { status: 'missing_snapshot', archiveId, calculatedAt };
    },
    synastrySnapshot(token, expectedOwnerId, id, includeCalculationContext) {
      const owner = requireOwner(token, expectedOwnerId);
      if (owner.kind !== 'member') fail(403);
      return projectSynastrySnapshot(findRecord(owner, id), includeCalculationContext);
    },
  };
}
