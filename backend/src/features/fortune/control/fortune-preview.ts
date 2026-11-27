import { LunarUtil } from 'lunar-javascript';
import type { DestinyArchive } from '../../account';
import type { DestinyChartSnapshot } from '../../destiny';
import { lunarAtBeijing } from './fortune-calendar';
import { buildDisplayWindow, type DisplayTime, type PreviewPeriod } from './period-window';

export { buildDisplayWindow, type PreviewPeriod } from './period-window';
export type NatalDay = { pillar: string; timeKnown: boolean };

const hourMs = 3_600_000;
const dayMs = 24 * hourMs;
const beijingOffsetMs = 8 * hourMs;
const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';

export function readNatalDay(report: DestinyArchive & { chartSnapshot?: DestinyChartSnapshot }): NatalDay | null {
  const snapshot = report.chartSnapshot;
  if (snapshot?.bazi.rawResult.length) {
    return readSnapshotNatalDay(snapshot);
  }
  const rows = report.charts.find(({ method }) => method === 'bazi')?.rows ?? [];
  const days = rows.filter(({ label }) => label === '日柱');
  if (days.length !== 1) return null;
  const pillar = days[0].value.split(/\r?\n/u)[0].trim();
  return isPillar(pillar) ? { pillar, timeKnown: report.timeKnown } : null;
}

export function readSnapshotNatalDay(snapshot: { timeKnown: boolean; bazi: { rawResult: readonly ({ day?: string } | null)[] } }): NatalDay | null {
  const candidates = snapshot.bazi.rawResult;
  const pillar = candidates[0]?.day;
  return isPillar(pillar) && candidates.every((candidate) => candidate?.day === pillar)
    ? { pillar, timeKnown: snapshot.timeKnown } : null;
}

function isPillar(pillar: unknown): pillar is string {
  if (typeof pillar !== 'string' || pillar.length !== 2) return false;
  const stem = stems.indexOf(pillar[0]);
  const branch = branches.indexOf(pillar[1]);
  return stem >= 0 && branch >= 0 && stem % 2 === branch % 2;
}

export function nextSolarBoundary(at: number) {
  const lunar = lunarAtBeijing(at);
  const terms = lunar as typeof lunar & {
    getNextJie(): { getName(): string; getSolar(): { toYmdHms(): string } };
  };
  const term = terms.getNextJie();
  const time = Date.parse(term.getSolar().toYmdHms().replace(' ', 'T') + '+08:00');
  if (!(time > at)) throw new Error('Invalid solar term boundary');
  return { time, name: term.getName() };
}

function previewFact(at: number, reason: string, period: PreviewPeriod, natal: NatalDay | null) {
  const lunar = lunarAtBeijing(at);
  const year = lunar.getYearInGanZhiExact();
  const month = lunar.getMonthInGanZhiExact();
  const day = lunar.getDayInGanZhiExact();
  const pillar = period === 'year' ? year : period === 'month' ? month : day;
  return { at, reason, year, month, day,
    tenGod: natal ? LunarUtil.SHI_SHEN[natal.pillar[0] + pillar[0]] : undefined };
}

export function buildFortunePreview(asOf: number, period: PreviewPeriod, natal: NatalDay | null = null, display?: DisplayTime) {
  const window = buildDisplayWindow(asOf, period, display);
  const boundaries = new Map<number, string>([[window.start, '周期起点']]);
  for (let term = nextSolarBoundary(window.start); term.time < window.end; term = nextSolarBoundary(term.time)) {
    boundaries.set(term.time, term.name + '交节');
  }
  if (period === 'day' || period === 'week') {
    // Align with the natal engine's late-Zi day boundary in the stated calculation timezone.
    const offset = beijingOffsetMs + hourMs;
    const first = (Math.floor((window.start + offset) / dayMs) + 1) * dayMs - offset;
    for (let at = first; at < window.end; at += dayMs) {
      boundaries.set(at, boundaries.has(at) ? boundaries.get(at) + ' · 换日' : '换日');
    }
  }
  return {
    window,
    current: previewFact(asOf, '参考时刻', period, natal),
    events: [...boundaries.entries()].sort(([a], [b]) => a - b)
      .map(([at, reason]) => previewFact(at, reason, period, natal)),
  };
}
