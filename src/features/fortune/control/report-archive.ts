import type { ReadingArchive } from '../../account';
import type { FortuneFactInput } from '../model/fortune-facts';
import { fortuneReportSections, type FortunePublishedReport } from '../model/interpretation';
import { buildFactTimeContext } from './fact-time-context';

export function fortuneArchiveContext(input: FortuneFactInput, at: number, snapshotId: string) {
  const time = buildFactTimeContext(input, at, 'preview');
  const localDate = time.displayWindow.localStart;
  const targetPeriod = input.periodType === 'day' ? { date: localDate }
    : input.periodType === 'week' ? { weekStartDate: localDate }
      : { year: Number(localDate.slice(0, 4)), ...(input.periodType === 'month' ? { month: Number(localDate.slice(5, 7)) } : {}) };
  return { key: JSON.stringify([snapshotId, input.periodType, input.displayTimezone, time.window.start]),
    window: time.window, targetPeriod, localDate };
}
export function archiveFortuneReport(report: FortunePublishedReport, input: FortuneFactInput, at: number): ReadingArchive {
  if (!report.natalChartSnapshotId) throw new Error('Missing fortune snapshot');
  const context = fortuneArchiveContext(input, at, report.natalChartSnapshotId);
  const periodLabel = { day: '日运势', week: '周运势', month: '月运势', year: '年运势' }[report.periodType];
  return { version: 1, kind: 'fortune', title: context.localDate + ' · ' + periodLabel,
    contextKey: context.key, calculatedAt: new Date().toISOString(),
    context: { snapshotId: report.natalChartSnapshotId, periodType: report.periodType,
      displayTimezone: input.displayTimezone, windowStart: context.window.start, windowEnd: context.window.end,
      reportId: report.reportId, calculationRunId: report.calculationRunId },
    sections: fortuneReportSections.map(({ id, title }, index) => ({ id, title, body: report.sections[index].summary })) };
}
export function restoreFortuneReport(archive: ReadingArchive): FortunePublishedReport {
  const { context } = archive;
  if (archive.kind !== 'fortune' || !context.reportId || !context.calculationRunId || !context.snapshotId || !context.periodType) throw new Error('Invalid fortune archive');
  return { reportId: context.reportId, calculationRunId: context.calculationRunId,
    natalChartSnapshotId: context.snapshotId, periodType: context.periodType,
    sections: fortuneReportSections.map(({ id }) => {
      const section = archive.sections.find(section => section.id === id);
      if (!section) throw new Error('Missing fortune section');
      return { sectionId: id, summary: section.body };
    }) };
}
