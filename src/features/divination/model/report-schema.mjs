import { maxReportSectionLength } from '../../../shared/content-limits.mjs';

/** @param {unknown} value */
function readText(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxReportSectionLength) {
    throw new TypeError('Invalid report text.');
  }
  return value.trim();
}

/** @param {unknown} value @returns {import('./report').DivinationReport} */
export function parseDivinationReport(value) {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid report.');
  const report = /** @type {Record<string, unknown>} */ (value);
  if (Object.keys(report).length !== 3 || !Array.isArray(report.nextSteps)
      || report.nextSteps.length < 1 || report.nextSteps.length > 3) {
    throw new TypeError('Invalid report sections.');
  }
  return {
    answer: readText(report.answer),
    explanation: readText(report.explanation),
    nextSteps: report.nextSteps.map(readText),
  };
}
