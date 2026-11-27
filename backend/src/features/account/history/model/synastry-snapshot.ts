import type { DestinyChartSnapshot } from '../../../destiny';

export type SynastryPillarPosition = 'year' | 'month' | 'day' | 'hour';
type Planet = DestinyChartSnapshot['western']['rawResult'][number]['positions'][number]['planet'];
type ChartVersion = { engineName: string; engineVersion: string; rulesetVersion: string };
type BirthContext = NonNullable<DestinyChartSnapshot['birthContext']>;
type LuckContext = NonNullable<DestinyChartSnapshot['bazi']['rawResult'][number]['luckContext']>;
type UnavailableChart = ChartVersion & {
  status: 'unavailable';
  reason: 'not_calculated' | 'ambiguous_time' | 'unsupported_ruleset';
};
type Pillar = {
  position: SynastryPillarPosition;
  stem: string | null;
  branch: string | null;
  hiddenStems: string[] | null;
  shenSha: { name: string; sourcePillars: SynastryPillarPosition[] }[];
  shenShaComplete: boolean;
};
type BaZiChart = UnavailableChart | (ChartVersion & { status: 'complete' | 'partial'; pillars: Pillar[]; luckContext?: LuckContext });
type ZiweiStar = { name: string; mutagen?: string; mutagenOrigin?: 'birth_year'; brightness?: string; brightnessProfile?: string };
type ZiweiChart = UnavailableChart | (ChartVersion & {
  status: 'complete';
  lifePalaceBranch: string;
  bodyPalaceBranch: string;
  palaces: {
    name: string;
    earthlyBranch: string;
    heavenlyStem?: string;
    stemTransformations?: readonly { marker: '禄' | '权' | '科' | '忌'; star: string }[];
    majorStars: ZiweiStar[];
    minorStars: ZiweiStar[];
    adjectiveStars: ZiweiStar[];
  }[];
});
type WesternSigns = ChartVersion & {
  zodiac: 'tropical';
  houseSystem: 'whole-sign';
};
type WesternChart = UnavailableChart | (WesternSigns & {
  status: 'complete';
  positions: { planet: Planet; longitude: number }[];
  ascendant: number;
  midheaven: number;
  houses: number[];
}) | (WesternSigns & { status: 'partial'; positions: { planet: Planet; signIndex: number }[] });

type ArchiveReference = { archiveId: string; calculatedAt: string };
export type SynastryChartSnapshot = ArchiveReference & {
  snapshotId: string;
  schemaVersion: 1;
  timeKnown: boolean;
  samplingVersion: string;
  birthContext?: BirthContext;
  bazi: BaZiChart;
  ziwei: ZiweiChart;
  western: WesternChart;
};
export type SynastrySnapshotResult =
  | { status: 'no_archive' }
  | ({ status: 'missing_snapshot' } & ArchiveReference)
  | { status: 'available'; snapshot: SynastryChartSnapshot };
