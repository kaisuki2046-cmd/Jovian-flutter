import { buildFactTimeContext } from './fact-time-context';
import { extractFortuneAdviceThemes } from './fortune-advice-themes';
import { calculateFortuneFacts } from './fortune-facts';
import { clientFortuneRunId, type AuthorizedFortuneInput, type FortuneFactInput, type FortuneReturnLocation } from '../model/fortune-facts';

export function buildFortuneFactSubmission(input: FortuneFactInput, asOf: number, archive: AuthorizedFortuneInput,
  returnLocation?: FortuneReturnLocation) {
  if (!archive.chart) throw new Error('Missing fortune chart');
  const time = buildFactTimeContext(input, asOf, 'client');
  const run = calculateFortuneFacts(input, time, clientFortuneRunId, archive, returnLocation);
  return {
    version: run.version,
    asOfUtc: time.asOfUtc,
    window: time.window,
    methods: Object.fromEntries(Object.entries(run.methods).map(([method, { status, warnings }]) =>
      [method, { status, warnings }])),
    facts: run.facts.map(({ calculationRunId: _, profileId: _profile, natalChartSnapshotId: _snapshot, periodType: _period, ...fact }) => fact),
    adviceThemes: input.periodType === 'week' ? {} : extractFortuneAdviceThemes(archive.chart),
  };
}

export type FortuneFactSubmission = ReturnType<typeof buildFortuneFactSubmission>;
