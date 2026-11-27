import { describeBaZiStem } from './bazi-calculation';
import { lunarAtBeijing } from './fortune-calendar';
import { nextSolarBoundary } from './fortune-preview';

type Schedule = readonly (readonly [name: string, days: number])[];

const chapterSchedule: Record<string, Schedule> = {
  寅: [['艮土', 5], ['丙', 5], ['甲', 20]], 卯: [['甲', 7], ['乙', 23]],
  辰: [['乙', 7], ['壬', 5], ['戊', 18]], 巳: [['戊', 7], ['庚', 5], ['丙', 18]],
  午: [['丙', 7], ['丁', 23]], 未: [['丁', 7], ['甲', 5], ['己', 18]],
  申: [['坤土', 5], ['壬', 5], ['庚', 20]], 酉: [['庚', 7], ['辛', 23]],
  戌: [['辛', 7], ['丙', 5], ['戊', 18]], 亥: [['戊', 5], ['甲', 5], ['壬', 20]],
  子: [['壬', 7], ['癸', 23]], 丑: [['癸', 7], ['庚', 5], ['己', 18]],
};

// Preserve the transcription's printed order and day counts. These rows are
// comparisons for the same branch, not a second chronological schedule.
const jadeWellAllocations: Record<string, Schedule> = {
  寅: [['己', 7], ['丙', 5], ['甲', 18]], 卯: [['乙', 18], ['甲', 9], ['癸', 3]],
  辰: [['戊', 18], ['乙', 9], ['癸', 3]], 巳: [['丙', 18], ['戊', 7], ['庚', 5]],
  午: [['丁', 18], ['丙', 9], ['乙', 3]], 未: [['己', 18], ['乙', 5], ['丁', 7]],
  申: [['庚', 17], ['己', 7], ['戊', 3], ['壬', 3]], 酉: [['辛', 20], ['庚', 7], ['丁', 5]],
  戌: [['戊', 18], ['辛', 7], ['丁', 5]], 亥: [['壬', 18], ['甲', 5], ['戊', 7]],
  子: [['癸', 18], ['壬', 5], ['辛', 3]], 丑: [['己', 18], ['癸', 7], ['辛', 5]],
};

const termNames: Record<string, string> = {
  寅: '立春', 卯: '惊蛰', 辰: '清明', 巳: '立夏', 午: '芒种', 未: '小暑',
  申: '立秋', 酉: '白露', 戌: '寒露', 亥: '立冬', 子: '大雪', 丑: '小寒',
};
const dayMs = 86_400_000;
export const smthMonthDutyPolicy = 'smth-volume-two-month-duty-elapsed-jie-v1';

const middleTerms = ['雨水', '春分', '谷雨', '小满', '夏至', '大暑', '处暑', '秋分', '霜降', '小雪', '冬至', '大寒'];
const monthGenerals = '亥戌酉申未午巳辰卯寅丑子';

export function smthBirthMonthGeneral(birthAt: number, monthBranch: string) {
  if (!Number.isSafeInteger(birthAt) || !Object.hasOwn(termNames, monthBranch)) return undefined;
  const lunar = lunarAtBeijing(birthAt);
  if (lunar.getMonthInGanZhiExact()[1] !== monthBranch) return undefined;
  // In the installed engine a Qi has the same solar instant accessor as a Jie.
  const previous = lunar.getPrevQi(false) as { getName(): string; getSolar(): { toYmdHms(): string } } | null;
  if (!previous) return undefined;
  const middleTerm = previous.getName();
  const actualBranch = monthGenerals[middleTerms.indexOf(middleTerm)];
  const expectedBranch = monthGenerals['寅卯辰巳午未申酉戌亥子丑'.indexOf(monthBranch)];
  const start = Date.parse(previous.getSolar().toYmdHms().replace(' ', 'T') + '+08:00');
  if (!actualBranch || !(start <= birthAt)) return undefined;
  return { middleTerm, start: new Date(start).toISOString(), actualBranch, expectedBranch,
    matchesHeavenVirtueGeneral: actualBranch === expectedBranch };
}

function dutyLabel(name: string, printedDays: number, dayStem: string) {
  if (name.length !== 1) return { label: name, element: '土', printedDays };
  const { stem, stemElement, tenGod } = describeBaZiStem(name, dayStem);
  return { label: stem + stemElement, element: stemElement, stem, tenGod, printedDays };
}

export function smthMonthDuty(birthAt: number, monthBranch: string, dayStem: string) {
  if (!Number.isSafeInteger(birthAt) || !Object.hasOwn(chapterSchedule, monthBranch)) return undefined;
  const local = lunarAtBeijing(birthAt);
  if (local.getMonthInGanZhiExact()[1] !== monthBranch) return undefined;
  const previous = local.getPrevJie();
  if (!previous) return undefined;
  const start = Date.parse(previous.getSolar().toYmdHms().replace(' ', 'T') + '+08:00');
  const next = nextSolarBoundary(birthAt);
  if (!(start <= birthAt && birthAt < next.time)) return undefined;

  let cursor = start;
  const slots = chapterSchedule[monthBranch].flatMap(([name, printedDays]) => {
    const slotStart = cursor;
    cursor += printedDays * dayMs;
    const slotEnd = Math.min(cursor, next.time);
    return slotStart < slotEnd ? [{ ...dutyLabel(name, printedDays, dayStem), start: new Date(slotStart).toISOString(),
      end: new Date(slotEnd).toISOString() }] : [];
  });
  const slot = slots.find(row => Date.parse(row.start) <= birthAt && birthAt < Date.parse(row.end));
  const jadeWell = jadeWellAllocations[monthBranch].map(([name, days]) => dutyLabel(name, days, dayStem));
  return { profile: smthMonthDutyPolicy, startTerm: termNames[monthBranch], endTerm: next.name,
    start: new Date(start).toISOString(), end: new Date(next.time).toISOString(),
    elapsedDay: Math.floor((birthAt - start) / dayMs) + 1, slots, slot, outsidePrintedDays: birthAt >= cursor,
    jadeWell, jadeWellPrintedTotal: jadeWell.reduce((total, row) => total + row.printedDays, 0) };
}
