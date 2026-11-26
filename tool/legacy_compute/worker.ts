import { toDestinyArchiveWithSnapshot } from '../../../src/features/destiny/control/account-report';
import { runReading } from '../../../src/features/destiny/control/local-reading';
import { calculateManualSubjectChart } from '../../../src/features/destiny/control/manual-subject';
import type { BirthProfile } from '../../../src/features/destiny/model/birth-profile';
import { buildReportRequest } from '../../../src/features/destiny/requests/report';
import { buildFortuneFactSubmission } from '../../../src/features/fortune/control/fortune-fact-submission';
import type { AuthorizedFortuneInput, FortuneFactInput, FortuneReturnLocation } from '../../../src/features/fortune/model/fortune-facts';
import { compareCharts, hasUnknownBirthTime } from '../../../src/features/synastry/control/compare';
import { adaptInterpretationFacts } from '../../../src/features/synastry/control/interpretation-fact-adapter';
import { prepareSynastrySummary } from '../../../src/features/synastry/control/summary';
import type { ComparisonSubject } from '../../../src/features/synastry/model/comparison';

type Operation =
  | { name: 'calculateDestiny' | 'calculateManualSubjectChart'; profile: BirthProfile }
  | { name: 'compareSynastry'; a: ComparisonSubject; b: ComparisonSubject }
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
