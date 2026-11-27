import { quanshuBrightness } from './ziwei-quanshu';

const branches = '子丑寅卯辰巳午未申酉戌亥';
// Volume II's explicit per-star paragraphs. Do not fill its unprinted cells
// from the summary table in volume III or the archive engine's brightness.
const seats: Record<string, (string | undefined)[]> = {
  太阳: ['陷', '陷', '旺', '庙', '旺', '旺', '旺', '得地', '得地', '和平', '陷', '陷'],
  武曲: ['旺', '庙', '得地', '利益', '庙', '和平', '旺', '庙', '得地', '利益', '庙', '和平'],
  破军: ['庙', '旺', '得地', '陷', '旺', undefined, '庙', '旺', '得地', '陷', '旺', undefined],
};
export const quanshuVersePolicy = {
  profile: 'quanshu-sun-wuqu-pojun-verse-v1',
  brightness: 'volume2-explicit-star-paragraphs-separate-from-volume3-summary',
  solarPhase: 'volume1-yuchan-explicit-seats-not-poem-darkness-definition',
  contacts: 'same-opposite-trine-adjacent-separate-no-fixed-encounter-range',
  limits: 'one-actual-focus-and-partner-at-same-time-not-both-required-to-meet-star',
  transformations: 'natal-source-table-only-no-implied-annual-or-limit-emitter',
} as const;

export function quanshuVerseSeat(star: string, branch: string) {
  if (!seats[star] || branch.length !== 1 || !branches.includes(branch)) throw new RangeError('Invalid Quanshu verse seat');
  const verseGrade = seats[star][branches.indexOf(branch)], summaryGrade = quanshuBrightness(star, branch);
  const solarPhase = star === '太阳' ? [
    { seats: '寅卯', name: '初升' }, { seats: '辰巳', name: '升殿' }, { seats: '午', name: '中天' },
    { seats: '未申', name: '偏垣' }, { seats: '酉', name: '西没' }, { seats: '戌亥子', name: '失辉' },
  ].find(row => row.seats.includes(branch))?.name : undefined;
  return { star, branch, verseGrade, summaryGrade, solarPhase,
    gradeAgreement: verseGrade !== undefined && summaryGrade !== undefined ? verseGrade === summaryGrade : undefined };
}
