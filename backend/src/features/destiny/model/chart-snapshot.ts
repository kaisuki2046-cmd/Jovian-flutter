import type { Reading } from '../control/local-reading';

type StoredChart<T extends Reading['charts'][number]> = Pick<T,
  'engineName' | 'engineVersion' | 'rulesetVersion' | 'rawResult' | 'warning'>;

export type BirthCalculationContext = {
  precision: 'minute';
  birthInstant: string;
  latitude: number;
  longitude: number;
  timeZone: string;
  clockVersion: typeof import('../control/birth-clock').birthClockVersion;
};

/** Original calculation results for an authorized consumer of a saved chart. */
export type DestinyChartSnapshot = {
  version: 1;
  timeKnown: boolean;
  samplingVersion: string;
  birthContext?: BirthCalculationContext;
  bazi: StoredChart<Reading['charts'][0]>;
  ziwei: StoredChart<Reading['charts'][1]>;
  western: StoredChart<Reading['charts'][2]>;
};

export function createDestinyChartSnapshot(reading: Reading): DestinyChartSnapshot {
  const [bazi, ziwei, western] = reading.charts;
  function store<T extends Reading['charts'][number]>({
    engineName, engineVersion, rulesetVersion, rawResult, warning,
  }: T): StoredChart<T> {
    return { engineName, engineVersion, rulesetVersion, rawResult, ...(warning ? { warning } : {}) };
  }

  return {
    version: 1,
    timeKnown: reading.profile.time.timeKnown,
    samplingVersion: reading.versions.sampling,
    ...(reading.birthContext && { birthContext: reading.birthContext }),
    bazi: store(bazi),
    ziwei: store(ziwei),
    western: store(western),
  };
}
