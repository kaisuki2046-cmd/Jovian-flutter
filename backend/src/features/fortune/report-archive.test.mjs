import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
register('./server/resolve-fortune.mjs', import.meta.url);
const { fortuneArchiveContext, archiveFortuneReport, restoreFortuneReport } = await import('./control/report-archive.ts');

test('report lookup is stable within each period and isolates snapshots, periods, time zones and boundaries', () => {
  const at = Date.parse('2026-11-18T03:00:00Z');
  const snapshotId = 'a'.repeat(64);
  for (const periodType of ['day', 'week', 'month', 'year']) {
    const input = { periodType, displayTimezone: 'Asia/Shanghai' };
    const first = fortuneArchiveContext(input, at, snapshotId);
    assert.equal(first.key, fortuneArchiveContext(input, at + 3_600_000, snapshotId).key);
    assert.notEqual(first.key, fortuneArchiveContext(input, first.window.end, snapshotId).key);
    assert.notEqual(first.key, fortuneArchiveContext(input, at, 'b'.repeat(64)).key);
    assert.notEqual(first.key, fortuneArchiveContext({ ...input, displayTimezone: 'UTC' }, at, snapshotId).key);
    const report = { reportId: 'b'.repeat(64), calculationRunId: 'c'.repeat(64), natalChartSnapshotId: snapshotId,
      periodType, sections: ['overall', 'wealth', 'romance'].map(sectionId => ({ sectionId, summary: '完整正文。'.repeat(80) })) };
    const archive = archiveFortuneReport(report, input, at);
    assert.deepEqual(restoreFortuneReport(archive), report);
    assert.equal(archive.context.windowStart, first.window.start);
    assert.equal(archive.contextKey, first.key);
  }
});
