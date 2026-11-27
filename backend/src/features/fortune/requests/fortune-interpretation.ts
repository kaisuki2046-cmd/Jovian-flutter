import { Platform } from 'react-native';
import { createHttpClient } from '../../../shared/http/client';
import type { FortuneFactSubmission } from '../control/fortune-fact-submission';
import type { FortuneFactInput } from '../model/fortune-facts';
import { fortuneReportSections, type FortunePublishedReport } from '../model/interpretation';

const baseUrl = process.env.EXPO_PUBLIC_FORTUNE_TIME_BASE_URL;
const client = createHttpClient({ baseUrl, timeoutMs: 185000 });
const factClient = createHttpClient({ baseUrl, timeoutMs: 185000,
  async transport(url, init) {
    const body = init?.body;
    if (typeof body !== 'string' || body.length < 256 * 1024 || typeof CompressionStream !== 'function') return fetch(url, init);
    const compressed = new Blob([body]).stream().pipeThrough(new CompressionStream('gzip'));
    const payload = await new Response(compressed).blob();
    const headers = new Headers(init?.headers);
    headers.set('Content-Encoding', 'gzip');
    return fetch(url, { ...init, headers, body: payload });
  },
});
const auth = { credentials: 'include' } as const;
export const fortuneInterpretationAvailable = Boolean(baseUrl) && Platform.OS === 'web';

export function requestSavedFortuneInterpretation(expectedOwnerId: string, snapshotId: string, periodType: string,
  displayTimezone: string, windowStart: number, signal: AbortSignal) {
  return client.request('/fortune/reports/latest', { ...auth, signal,
    query: { expectedOwnerId, snapshotId, periodType, displayTimezone, windowStart },
    parse(value: unknown) {
      if (value === null) return null;
      const report = value as FortunePublishedReport;
      if (!report || report.natalChartSnapshotId !== snapshotId || report.periodType !== periodType
        || !/^[a-f\d]{64}$/u.test(report.calculationRunId) || !/^[a-f\d]{64}$/u.test(report.reportId)
        || !Array.isArray(report.sections) || report.sections.length !== fortuneReportSections.length
        || !fortuneReportSections.every(({ id }, index) => report.sections[index]?.sectionId === id
          && typeof report.sections[index]?.summary === 'string' && report.sections[index].summary.trim())) throw new Error('Invalid saved fortune');
      return report;
    } });
}

export function requestFortuneCalculation(input: FortuneFactInput, owner: string, snapshotId: string,
  factBatch: FortuneFactSubmission, signal: AbortSignal) {
  return factClient.request('/fortune/calculate', {
    ...auth, method: 'POST', signal, body: { ...input, expectedOwnerId: owner, snapshotId, factBatch },
    parse(value: unknown) {
      const id = (value as { reportId?: unknown } | null)?.reportId;
      if (typeof id !== 'string' || !/^[a-f\d]{64}$/u.test(id)) throw new Error('Invalid fortune calculation ID');
      return id;
    },
  });
}
export function requestFortuneInterpretation(periodType: FortuneFactInput['periodType'], owner: string, snapshotId: string,
  calculationRunId: string, signal: AbortSignal) {
  return client.request('/fortune/interpret', {
    ...auth, method: 'POST', signal, body: { calculationRunId, expectedOwnerId: owner, language: 'zh-CN' },
    parse(value: unknown) {
      const report = value as FortunePublishedReport | null;
      if (!report || report.calculationRunId !== calculationRunId || report.natalChartSnapshotId !== snapshotId
        || report.periodType !== periodType || typeof report.reportId !== 'string'
        || !Array.isArray(report.sections) || report.sections.length !== fortuneReportSections.length
        || !fortuneReportSections.every(({ id }, index) => report.sections[index]?.sectionId === id
          && typeof report.sections[index]?.summary === 'string' && report.sections[index].summary.trim())) {
        throw new Error('Invalid fortune interpretation');
      }
      return report;
    },
  });
}
