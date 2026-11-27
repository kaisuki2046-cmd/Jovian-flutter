import type { DestinyArchive } from '../../account';
import { ziweiAssistantBrightnessLabel } from './charts';
import { createDestinyChartSnapshot, type DestinyChartSnapshot } from '../model/chart-snapshot';
import type { Reading } from './local-reading';

export function toDestinyArchive(reading: Reading, overview: string): DestinyArchive {
  const [bazi, ziwei, western] = reading.charts;
  const uncertainPalaces = ziwei.summary && !ziwei.summary.palaces;
  return {
    version: 1, calculatedAt: reading.calculatedAt, timeKnown: reading.profile.time.timeKnown, mode: 'deepseek',
    overview,
    charts: [
      { method: bazi.method, engine: bazi.engineName, note: bazi.warning,
        rows: bazi.summary?.map(({ label, value, details }) => ({
          label,
          value: [value, ...(details ?? [])].join('\n'),
        })) ?? [] },
      { method: ziwei.method, engine: ziwei.engineName,
        note: ziwei.warning ?? (uncertainPalaces ? '出生时刻未完全确定，十二宫和星曜随时辰变化。' : undefined),
        rows: ziwei.summary ? [
          { label: '生年纳音', value: ziwei.summary.yearPillar + ' · ' + ziwei.summary.yearNaYin },
          ...(ziwei.summary.palaces ?? []).map(({ name, earthlyBranch, majorStars, minorStars }) => {
            const assistants = minorStars.map(ziweiAssistantBrightnessLabel).filter(Boolean);
            return {
              label: name,
              value: [earthlyBranch, majorStars.map(({ name: star }) => star).join('、') || '无主星', ...assistants].join(' · '),
            };
          }),
        ] : [] },
      { method: western.method, engine: western.engineName, note: western.warning,
        rows: western.summary?.positions.map(({ label, sign, house }) => ({
          label, value: house === null ? sign : `${sign} · 第${house}宫`,
        })) ?? [] },
    ],
  };
}

export type DestinyArchiveWithSnapshot = DestinyArchive & { chartSnapshot: DestinyChartSnapshot };

export function toDestinyArchiveWithSnapshot(reading: Reading, overview: string): DestinyArchiveWithSnapshot {
  return { ...toDestinyArchive(reading, overview), chartSnapshot: createDestinyChartSnapshot(reading) };
}
