import { maxReportSectionLength, maxReportTextLength } from '../../../../shared/content-limits.mjs';

export const readingKinds = ['fortune', 'synastry'];
const text = (value, max) => typeof value === 'string' && value.trim() && value.length <= max;
const id = value => typeof value === 'string' && /^[a-f\d]{64}$/u.test(value);

export function parseReadingArchive(value) {
  if (!value || value.version !== 1 || !readingKinds.includes(value.kind)
    || !text(value.title, 240) || !text(value.contextKey, 512)
    || typeof value.calculatedAt !== 'string' || !Number.isFinite(Date.parse(value.calculatedAt))
    || new Date(value.calculatedAt).toISOString() !== value.calculatedAt
    || !Array.isArray(value.sections) || value.sections.length !== (value.kind === 'fortune' ? 3 : 4)) return;
  const keys = value.kind === 'fortune' ? ['overall', 'wealth', 'romance'] : ['family', 'friendship', 'romance', 'collaboration'];
  const sections = [];
  for (const [index, section] of value.sections.entries()) {
    if (!section || section.id !== keys[index] || !text(section.title, 240) || !text(section.body, maxReportSectionLength)) return;
    sections.push({ id: section.id, title: section.title, body: section.body });
  }
  if (sections.reduce((size, section) => size + section.body.length, 0) > maxReportTextLength) return;
  let context = {};
  if (value.kind === 'fortune') {
    const c = value.context;
    if (!c || !id(c.snapshotId) || !id(c.reportId) || !id(c.calculationRunId)
      || !['day', 'week', 'month', 'year'].includes(c.periodType) || !text(c.displayTimezone, 120)
      || !Number.isSafeInteger(c.windowStart) || !Number.isSafeInteger(c.windowEnd) || c.windowEnd <= c.windowStart) return;
    try { new Intl.DateTimeFormat('en', { timeZone: c.displayTimezone }); } catch { return; }
    context = { snapshotId: c.snapshotId, reportId: c.reportId, calculationRunId: c.calculationRunId,
      periodType: c.periodType, displayTimezone: c.displayTimezone, windowStart: c.windowStart, windowEnd: c.windowEnd };
  }
  return { version: 1, kind: value.kind, title: value.title, contextKey: value.contextKey,
    calculatedAt: value.calculatedAt, sections, context };
}
