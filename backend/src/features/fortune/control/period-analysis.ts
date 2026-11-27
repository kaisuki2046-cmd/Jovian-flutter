import { LunarUtil } from 'lunar-javascript';
import type { buildFortunePreview, NatalDay, PreviewPeriod } from './fortune-preview';

type Preview = ReturnType<typeof buildFortunePreview>;
type Signal = {
  id: string;
  rule: string;
  start: number;
  end: number;
  pillar: string;
  tenGod?: string;
  relationship?: '六合' | '六冲';
};

export const periodAnalysisVersion = 'fortune-bazi-period-evidence-v1';

const combinations = new Set(['丑子', '亥寅', '卯戌', '辰酉', '巳申', '午未']);
const oppositions = new Set(['午子', '丑未', '寅申', '卯酉', '戌辰', '亥巳']);

export function branchRelation(natal: string | undefined, period: string): Signal['relationship'] {
  if (!natal) return;
  const pair = [natal, period].sort().join('');
  if (combinations.has(pair)) return '六合';
  if (oppositions.has(pair)) return '六冲';
}

export function buildPeriodAnalysis(preview: Preview, period: PreviewPeriod, natal: NatalDay | null) {
  if (!natal) return null;
  const scale = period === 'year' ? 'year' : period === 'month' ? 'month' : 'day';
  const intervals: Signal[] = [];
  for (const [index, event] of preview.events.entries()) {
    const end = preview.events[index + 1]?.at ?? preview.window.end;
    const pillar = event[scale];
    const previous = intervals.at(-1);
    if (previous?.pillar === pillar && previous.end === event.at) {
      previous.end = end;
      continue;
    }
    intervals.push({
      id: `bazi:${scale}:${event.at}`, rule: `bazi-${scale}-stem-branch-v1`,
      start: event.at, end, pillar, tenGod: LunarUtil.SHI_SHEN[natal.pillar[0] + pillar[0]],
      relationship: branchRelation(natal.pillar[1], pillar[1]),
    });
  }
  const wealth = intervals.filter(({ tenGod }) => tenGod === '正财' || tenGod === '偏财');
  const relationships = intervals.filter(({ relationship }) => relationship !== undefined);
  return { version: periodAnalysisVersion, scale, natalPillar: natal.pillar, intervals, wealth, relationships };
}
