import { quanshuBrightness, quanshuLunarMonthDays, quanshuLuYangTuo, quanshuMinorLimit, readQuanshuNatal } from './ziwei-quanshu';
import { quanshuFourFlying } from './ziwei-kongjie';
import { quanshuFireBellAnchors } from './ziwei-firebell';
import type { quanshuDoujunCondition } from './ziwei-source-year';

const branches = '子丑寅卯辰巳午未申酉戌亥', stems = '甲乙丙丁戊己庚辛壬癸';
const mod = (n: number) => (n % 12 + 12) % 12;
const relation = (from: string | undefined, to: string | undefined) => {
  if (from === undefined || to === undefined) return undefined;
  const distance = mod(branches.indexOf(to) - branches.indexOf(from));
  return distance === 0 ? '守' : distance === 6 ? '冲' : [4, 8].includes(distance) ? '三合'
    : [1, 11].includes(distance) ? '邻宫' : '其他';
};
export const quanshuTigerPolicy = {
  profile: 'quanshu-tiger-annual-native-layers-v1',
  annual: 'volume2-four-flying-tiger-is-sui-plus8-not-annual-life-local',
  natalTiger: 'iztro-suiqian12-birth-year-product-only-not-proven-original-layer',
  moon: 'volume1-answer-explicit-seats-separate-from-volume3-brightness',
  principalSeats: 'volume2-star-sequence-verified-against-unique-natal-ziwei-and-tianfu',
  moonCalendar: 'imperial-liuren-calendar-day-labels-with-real-lunar-month-end',
  bell: 'unique-archive-and-product-hour-check-only-source-hour-unverified',
  minor: 'volume2-birth-year-start-male-forward-female-backward-lunar-year-one',
  contact: 'same-opposite-trine-adjacent-other-separated-no-invented-encounter-range',
  calendar: 'native-lunar-new-year-and-civil-midnight',
} as const;

export function quanshuMoonAnswerSeat(branch: string) {
  if (branch.length !== 1 || !branches.includes(branch)) throw new RangeError('Invalid Moon source branch');
  return { branch, answerGrade: '卯辰巳午未'.includes(branch) ? '陷地' : '酉戌亥子丑'.includes(branch) ? '得垣' : undefined,
    volume2Grade: '子丑寅酉戌亥'.includes(branch) ? '庙' : '卯辰巳午'.includes(branch) ? '陷' : '利',
    volume3Grade: quanshuBrightness('太阴', branch) };
}

type Args = Parameters<typeof quanshuDoujunCondition>;
const moonCalendarPoints: Readonly<Partial<Record<number, string>>> = { 1: '朔', 8: '上弦', 15: '望', 23: '下弦' };
function birthMoonCalendar(date: Args[0]['rawDates']['lunarDate']) {
  const { lunarYear, lunarMonth, lunarDay, isLeap } = date;
  const monthDays = quanshuLunarMonthDays(lunarYear, isLeap ? -lunarMonth : lunarMonth);
  if (monthDays === undefined || !Number.isInteger(lunarDay) || lunarDay < 1 || lunarDay > monthDays) return undefined;
  return { lunarMonth, lunarDay, isLeap, monthDays, point: lunarDay === monthDays ? '晦' : moonCalendarPoints[lunarDay] };
}

export function quanshuTigerCondition(...args: Args) {
  const [natal, palaceIndex, annualIndex, lunarYear, scope, decadalIndex, minorIndex] = args;
  const basis = readQuanshuNatal(natal), focus = natal.palaces.find(p => p.index === palaceIndex);
  const annual = natal.palaces.find(p => p.index === annualIndex), decadal = natal.palaces.find(p => p.index === decadalIndex);
  const minor = natal.palaces.find(p => p.index === minorIndex);
  if (basis.status !== 'ready' || !focus || !annual || !Number.isInteger(lunarYear) || lunarYear < 1 || lunarYear > 9998
    || basis.birthYear < 1 || basis.birthYear > 9998
    || !['decadal', 'minor', 'yearly'].includes(scope)) return { ready: false, reason: 'unavailable_tiger_layer_basis' } as const;
  const birthYearBranch = branches[mod(basis.birthYear - 4)], annualBranch = branches[mod(lunarYear - 4)];
  if (natal.rawDates.chineseDate.yearly[1] !== birthYearBranch || annual.earthlyBranch !== annualBranch
    || decadalIndex !== undefined && !decadal || minorIndex !== undefined && !minor
    || scope === 'yearly' && palaceIndex !== annualIndex || scope === 'decadal' && palaceIndex !== decadalIndex
    || scope === 'minor' && palaceIndex !== minorIndex) return { ready: false, reason: 'inconsistent_tiger_layer_geometry' } as const;
  const all = (p: typeof focus) => [...p.majorStars, ...p.minorStars, ...p.adjectiveStars];
  const locations = (name: string) => natal.palaces.flatMap(p => all(p).filter(s => s.name === name).map(() => p.earthlyBranch));
  const uniqueMajor = (name: string) => {
    const found = locations(name);
    return found.length === 1 && natal.palaces.find(p => p.earthlyBranch === found[0])?.majorStars.some(row => row.name === name)
      ? found[0] : undefined;
  };
  const parentRows = natal.palaces.filter(p => p.name === '父母');
  const parent = parentRows.length === 1 && parentRows[0].index === mod(basis.lifeIndex + 1) ? parentRows[0] : undefined;
  const moonBranch = uniqueMajor('太阴'), lianzhenBranch = uniqueMajor('廉贞'), sevenKillBranch = uniqueMajor('七杀');
  const ziweiBranch = uniqueMajor('紫微'), tianfuBranch = uniqueMajor('天府');
  const principalAnchorsAgree = ziweiBranch !== undefined && tianfuBranch !== undefined
    ? tianfuBranch === branches[mod(4 - branches.indexOf(ziweiBranch))] : undefined;
  const seatProof = (archiveBranch: string | undefined, anchor: '紫微' | '天府', anchorBranch: string | undefined, steps: number) => {
    const expectedBranch = anchorBranch === undefined || principalAnchorsAgree !== true ? undefined
      : branches[mod(branches.indexOf(anchorBranch) + steps)];
    return { anchor, anchorBranch, archiveBranch, expectedBranch,
      verified: principalAnchorsAgree === false ? false
        : archiveBranch === undefined || expectedBranch === undefined ? undefined : archiveBranch === expectedBranch };
  };
  // 〈安南北斗诸星诀〉：太阴、七杀从天府顺一、六宫，廉贞从紫微逆八宫。
  const principalSeatProof = {
    moon: seatProof(moonBranch, '天府', tianfuBranch, 1),
    lianzhen: seatProof(lianzhenBranch, '紫微', ziweiBranch, -8),
    qisha: seatProof(sevenKillBranch, '天府', tianfuBranch, 6),
  };
  const relations = (branch: string | undefined) => ({ focusRelation: relation(focus.earthlyBranch, branch),
    lifeRelation: relation(basis.lifeBranch, branch), parentRelation: relation(parent?.earthlyBranch, branch),
    lianzhenRelation: relation(lianzhenBranch, branch), sevenKillRelation: relation(sevenKillBranch, branch) });
  const moonSeat = moonBranch === undefined ? undefined : quanshuMoonAnswerSeat(moonBranch);
  const parentMoonFallen = !parent || !moonSeat || principalSeatProof.moon.verified !== true ? undefined
    : moonBranch === parent.earthlyBranch && moonSeat.answerGrade === '陷地';
  const parentMoonCalendar = scope === 'yearly' && parentMoonFallen === true ? birthMoonCalendar(natal.rawDates.lunarDate) : undefined;
  const annualStem = stems[((lunarYear - 4) % 10 + 10) % 10], fourFlying = quanshuFourFlying(lunarYear);
  const whiteTigerBranch = fourFlying.placements.find(s => s.name === '白虎')!.branch;
  const sourceMinor = quanshuMinorLimit(birthYearBranch, natal.gender, lunarYear - basis.birthYear + 1);
  const sourceMinorVerified = sourceMinor && minor ? sourceMinor.branch === minor.earthlyBranch : undefined;
  const annualMinorAtLianzhen = principalSeatProof.lianzhen.verified !== true || !minor ? undefined
    : annualBranch === lianzhenBranch && minor.earthlyBranch === lianzhenBranch;
  const annualAtLianzhen = principalSeatProof.lianzhen.verified === true ? annualBranch === lianzhenBranch : undefined;
  const lianzhenAnnualTigerTrineCandidate = annualAtLianzhen === false ? false
    : sourceMinorVerified === true && annualMinorAtLianzhen !== undefined
      ? annualMinorAtLianzhen && relation(lianzhenBranch, whiteTigerBranch) === '三合' : undefined;
  const natalTigerBranches = natal.palaces.filter(p => p.suiqian12 === '白虎').map(p => p.earthlyBranch);
  const natalTigerExpected = quanshuFourFlying(basis.birthYear).placements.find(s => s.name === '白虎')!.branch;
  const natalTigerProductVerified = natalTigerBranches.length === 1 && natalTigerBranches[0] === natalTigerExpected;
  const bellAnchor = quanshuFireBellAnchors(birthYearBranch).engineNamedAnchors.find(s => s.star === '铃星')!.branch;
  const productBellExpected = branches[mod(branches.indexOf(bellAnchor) + branches.indexOf(natal.rawDates.chineseDate.hourly[1]))];
  const bellArchiveBranches = locations('铃星'), bellProductVerified = bellArchiveBranches.length === 1 && bellArchiveBranches[0] === productBellExpected;
  const scopeRelations = [{ scope: 'yearly', palace: annual }, { scope: 'decadal', palace: decadal }, { scope: 'minor', palace: minor }]
    .flatMap(row => row.palace ? [{ scope: row.scope, branch: row.palace.earthlyBranch, natalName: row.palace.name,
      ...relations(row.palace.earthlyBranch), tigerRelation: relation(row.palace.earthlyBranch, whiteTigerBranch) }] : []);
  return { ready: true, profile: quanshuTigerPolicy.profile, scope, lunarYear, branch: focus.earthlyBranch, natalName: focus.name,
    birthYearBranch, annualBranch, annualStem, natalLifeBranch: basis.lifeBranch,
    parentBranch: parent?.earthlyBranch, moon: moonSeat, parentMoonFallen, parentMoonCalendar, principalSeatProof, principalAnchorsAgree,
    mainStars: [{ star: '太阴', branch: moonBranch }, { star: '廉贞', branch: lianzhenBranch }, { star: '七杀', branch: sevenKillBranch }]
      .map(row => ({ ...row, known: row.branch !== undefined, ...relations(row.branch) })),
    sevenKillKnown: sevenKillBranch === undefined ? undefined : true,
    annualMinorAtLianzhen, lianzhenAnnualTigerTrineCandidate,
    sourceMinor: sourceMinor && { ...sourceMinor, verified: sourceMinorVerified },
    scopeRelations, annualTigerAtYear: whiteTigerBranch === annualBranch, annualTigerYearRelation: relation(annualBranch, whiteTigerBranch),
    fourFlying: fourFlying.placements.map(row => ({ ...row, ...relations(row.branch) })),
    natalTigerBranches, natalTigerExpected, natalTigerProductVerified, natalTigerSourceLayerVerified: false,
    natalTigerRelations: natalTigerProductVerified ? relations(natalTigerExpected) : undefined,
    yang: [{ layer: 'natal', branch: basis.qingyangBranch }, { layer: 'yearly', branch: quanshuLuYangTuo(annualStem).qingyangBranch }]
      .map(row => ({ ...row, ...relations(row.branch) })),
    bellArchiveBranches, bellProductVerified, bellSourceHourVerified: false,
    bellRelations: bellProductVerified ? relations(productBellExpected) : undefined,
    encounterRangeVerified: false, geometryOnly: true } as const;
}
