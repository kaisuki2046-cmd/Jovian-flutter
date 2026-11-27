import { parseChartSnapshot } from './chart-snapshot.mjs';
import { maxReportTextLength, maxReportSectionLength, maxReportDetailLength } from '../../../../shared/content-limits.mjs';

const chartMethods = ['bazi', 'ziwei', 'western'];
const reportModes = ['local', 'hybrid', 'deepseek'];
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const legacySectionLimit = 4;
const legacyTitleLimit = 240;
const legacyParagraphCount = 3;
const maxArchivedOverviewLength = maxReportTextLength + legacySectionLimit *
  (legacyTitleLimit + 3 + legacyParagraphCount * (maxReportSectionLength + 2) + 2);

function legacyOverview(overview, sections) {
  if (sections === undefined) return overview;
  if (!Array.isArray(sections) || sections.length > legacySectionLimit) return;
  const blocks = [overview];
  for (const section of sections) {
    if (!section || !text(section.title, legacyTitleLimit) || !text(section.angle, maxReportDetailLength)
      || typeof section.uncertain !== 'boolean'
      || !Array.isArray(section.paragraphs) || section.paragraphs.length !== legacyParagraphCount
      || !section.paragraphs.every((paragraph) => text(paragraph, maxReportSectionLength))
      || !Array.isArray(section.evidence) || section.evidence.length > 3
      || !section.evidence.every((item) => text(item, maxReportDetailLength))) return;
    blocks.push('## ' + section.title, ...section.paragraphs);
  }
  return blocks.join('\n\n');
}

export function parseDestinyArchive(value, { readingHistory = false } = {}) {
  const overviewLimit = readingHistory ? maxArchivedOverviewLength : maxReportTextLength;
  if (!value || value.version !== 1 || !text(value.calculatedAt, 24) || typeof value.timeKnown !== 'boolean'
    || !reportModes.includes(value.mode) || !text(value.overview, overviewLimit)
    || !Array.isArray(value.charts) || value.charts.length !== chartMethods.length) return;
  const date = new Date(value.calculatedAt);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value.calculatedAt) return;
  // Retain the old displayed headings and prose when reading or accepting a V1 legacy payload.
  const overview = legacyOverview(value.overview, value.sections);
  if (!text(overview, overviewLimit)) return;
  const charts = [];
  for (const [index, chart] of value.charts.entries()) {
    if (!chart || chart.method !== chartMethods[index] || !text(chart.engine, 120)
      || chart.note !== undefined && !text(chart.note, maxReportDetailLength)
      || !Array.isArray(chart.rows) || chart.rows.length > 64) return;
    const rows = [];
    for (const row of chart.rows) {
      if (!row || !text(row.label, 240) || !text(row.value, maxReportDetailLength)) return;
      rows.push({ label: row.label, value: row.value });
    }
    charts.push({ method: chart.method, engine: chart.engine, note: chart.note, rows });
  }
  const chartSnapshot = value.chartSnapshot === undefined ? undefined : parseChartSnapshot(value.chartSnapshot, value.timeKnown);
  if (value.chartSnapshot !== undefined && !chartSnapshot) return;
  return { version: 1, calculatedAt: value.calculatedAt, timeKnown: value.timeKnown, mode: value.mode,
    overview, charts, ...(chartSnapshot ? { chartSnapshot } : {}) };
}
