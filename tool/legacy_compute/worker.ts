import { toDestinyArchiveWithSnapshot } from 'jovian-legacy/features/destiny/control/account-report';
import { runReading } from 'jovian-legacy/features/destiny/control/local-reading';
import { calculateManualSubjectChart } from 'jovian-legacy/features/destiny/control/manual-subject';
import type { BirthProfile } from 'jovian-legacy/features/destiny/model/birth-profile';
import { buildReportRequest } from 'jovian-legacy/features/destiny/requests/report';
import { buildAlmanacDay } from 'jovian-legacy/features/fortune/control/almanac';
import { calculateFortuneCalendar } from 'jovian-legacy/features/fortune/control/fortune-calendar';
import { buildFortuneFactSubmission } from 'jovian-legacy/features/fortune/control/fortune-fact-submission';
import { buildFortunePreview, readNatalDay, type PreviewPeriod } from 'jovian-legacy/features/fortune/control/fortune-preview';
import { lillyReturnLocationTarget } from 'jovian-legacy/features/fortune/control/lilly-returns';
import { archiveFortuneReport, fortuneArchiveContext } from 'jovian-legacy/features/fortune/control/report-archive';
import type { FortuneReference } from 'jovian-legacy/features/fortune/model/fortune-calendar';
import type { AuthorizedFortuneInput, FortuneFactInput, FortuneReturnLocation } from 'jovian-legacy/features/fortune/model/fortune-facts';
import type { FortunePublishedReport } from 'jovian-legacy/features/fortune/model/interpretation';
import { compareCharts, hasUnknownBirthTime } from 'jovian-legacy/features/synastry/control/compare';
import { adaptInterpretationFacts } from 'jovian-legacy/features/synastry/control/interpretation-fact-adapter';
import { prepareSynastrySummary } from 'jovian-legacy/features/synastry/control/summary';
import type { ComparisonSubject } from 'jovian-legacy/features/synastry/model/comparison';
import { destinyPresentation } from './destiny-presentation';

type Operation =
  | { name: 'calculateDestiny' | 'calculateManualSubjectChart'; profile: BirthProfile }
  | { name: 'compareSynastry'; a: ComparisonSubject; b: ComparisonSubject }
  | { name: 'previewFortune'; asOf: number; period: PreviewPeriod; timeZone: string;
      archive?: Parameters<typeof readNatalDay>[0] }
  | { name: 'queryFortuneCalendar'; reference: FortuneReference }
  | { name: 'prepareFortunePeriod'; input: FortuneFactInput; asOf: number; archive: AuthorizedFortuneInput }
  | { name: 'archiveFortuneReport'; report: FortunePublishedReport; input: FortuneFactInput; asOf: number }
  | { name: 'buildFortuneFactSubmission'; input: FortuneFactInput; asOf: number;
      archive: AuthorizedFortuneInput; returnLocation?: FortuneReturnLocation };

type WorkerChannel = {
  addEventListener(type: 'message', listener: (event: MessageEvent<string>) => void): void;
  postMessage(message: string): void;
};

const worker = globalThis as unknown as WorkerChannel;
const send = (message: object) => worker.postMessage(JSON.stringify(message));

async function run(operation: Operation) {
  switch (operation.name) {
    case 'calculateDestiny': {
      const reading = await runReading(operation.profile, new AbortController().signal,
        (stage) => send({ stage }));
      return {
        reading,
        archive: toDestinyArchiveWithSnapshot(reading, ''),
        reportRequest: buildReportRequest(reading),
        presentation: destinyPresentation(reading.charts),
      };
    }
    case 'calculateManualSubjectChart':
      return calculateManualSubjectChart(operation.profile);
    case 'compareSynastry': {
      if (hasUnknownBirthTime(operation.a.chart) || hasUnknownBirthTime(operation.b.chart)) {
        throw new Error('请补齐两方出生时刻。');
      }
      const comparison = compareCharts(operation.a, operation.b);
      return {
        comparison: { rulesVersion: comparison.rulesVersion, sections: comparison.sections },
        facts: adaptInterpretationFacts(comparison),
        summaryRequest: prepareSynastrySummary(comparison),
      };
    }
    case 'buildFortuneFactSubmission':
      return buildFortuneFactSubmission(operation.input, operation.asOf, operation.archive, operation.returnLocation);
    case 'previewFortune': {
      const { asOf, period, timeZone, archive } = operation;
      const natal = archive ? readNatalDay(archive) : null;
      const preview = buildFortunePreview(asOf, period, natal, { timeZone });
      return { preview, almanac: period === 'day' ? buildAlmanacDay(asOf) : null };
    }
    case 'queryFortuneCalendar':
      return { calendar: calculateFortuneCalendar(operation.reference) };
    case 'prepareFortunePeriod': {
      const { input, asOf, archive } = operation;
      const context = fortuneArchiveContext(input, asOf, archive.snapshotId);
      const date = new Intl.DateTimeFormat('sv-SE', {
        timeZone: input.displayTimezone, calendar: 'gregory', numberingSystem: 'latn',
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
      const returnAt = input.periodType === 'year' && archive.chart
        ? lillyReturnLocationTarget(context.window, archive.chart) : undefined;
      return { ...context, lastDate: date.format(context.window.end - 1), returnAt };
    }
    case 'archiveFortuneReport':
      return archiveFortuneReport(operation.report, operation.input, operation.asOf);
  }
  throw new Error('不支持的本机计算类型。');
}

worker.addEventListener('message', async ({ data }) => {
  try {
    send({ result: await run(JSON.parse(data) as Operation) });
  } catch (error) {
    send({ error: error instanceof Error ? error.message : '本机计算失败，请重试。' });
  }
});
