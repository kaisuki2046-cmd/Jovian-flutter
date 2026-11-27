import * as LunarPackage from 'lunar-javascript';
import type { DestinyChartSnapshot } from '../../destiny';

type Natal = DestinyChartSnapshot['ziwei']['rawResult'][number];
type Palace = Natal['palaces'][number];
const branches = '子丑寅卯辰巳午未申酉戌亥', stems = '甲乙丙丁戊己庚辛壬癸';
const mod = (value: number) => (value % 12 + 12) % 12;
export const quanshuMajorStarNames = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
const nanyangMajorOffsets = [
  { anchor: '紫微', offsets: { 紫微: 0, 天机: -1, 太阳: -3, 武曲: -4, 天同: -5, 廉贞: -8 } },
  { anchor: '天府', offsets: { 天府: 0, 太阴: 1, 贪狼: 2, 巨门: 3, 天相: 4, 天梁: 5, 七杀: 6, 破军: 10 } },
] as const;
const allStars = (palace: Palace) => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
export const quanshuZiweiPolicy = {
  profile: 'quanshu-limits-source-v1', table: 'quanshu-recorded-ren-tianfu-ke-v1',
  brightness: 'quanshu-volume3-explicit-cells-v2-firebell',
  tianxing: 'quanshu-tianxing-month-four-seats-v1',
  natalBasis: 'compatible-archive-with-recomputed-life-lu-yang-tuo',
  leapPolicy: 'volume-two-leap-as-next-month-when-archive-agrees',
  calendar: 'native-lunar-new-year-and-civil-midnight',
} as const;
const table = [
  ['廉贞', '破军', '武曲', '太阳'], ['天机', '天梁', '紫微', '太阴'],
  ['天同', '天机', '文昌', '廉贞'], ['太阴', '天同', '天机', '巨门'],
  ['贪狼', '太阴', '右弼', '天机'], ['武曲', '贪狼', '天梁', '文曲'],
  ['太阳', '武曲', '太阴', '天同'], ['巨门', '太阳', '文曲', '文昌'],
  ['天梁', '紫微', '天府', '武曲'], ['破军', '巨门', '太阴', '贪狼'],
];
// Only the explicitly printed cells of volume III. Blank cells stay unknown;
// the default engine's brightness must not silently complete this source table.
const qualities: Record<string, Record<string, string>> = {
  紫微: { 庙: '丑未午', 旺: '寅申卯酉巳亥', 平: '子' },
  天府: { 庙: '子丑未寅辰戌', 旺: '午酉', 地: '卯巳申亥' },
  天相: { 庙: '子午丑寅申', 地: '辰戌巳亥未', 陷: '卯酉' },
  天梁: { 庙: '子午寅卯辰戌', 旺: '丑未', 地: '酉', 陷: '申巳亥' },
  天同: { 庙: '巳亥', 旺: '子申', 陷: '午' },
  天机: { 庙: '子午', 旺: '辰酉', 陷: '丑未' },
  太阳: { 庙: '卯', 旺: '寅辰巳午', 陷: '子' },
  太阴: { 庙: '亥子丑', 旺: '寅酉戌', 陷: '卯辰巳' },
  文昌: { 庙: '巳酉丑', 地: '申子辰', 陷: '寅午戌' },
  文曲: { 庙: '巳酉丑', 地: '申子辰', 陷: '寅午戌' },
  武曲: { 庙: '辰戌丑未', 旺: '子午', 平: '巳亥' },
  贪狼: { 庙: '辰戌丑未', 旺: '子午', 陷: '巳亥' },
  廉贞: { 庙: '寅申', 利: '辰戌丑未', 陷: '巳亥' },
  巨门: { 庙: '寅申卯酉', 旺: '子午巳亥', 陷: '辰戌' },
  七杀: { 庙: '辰戌丑未寅申', 旺: '子午卯酉', 平: '巳亥' },
  破军: { 庙: '子午', 旺: '辰戌丑未', 陷: '卯酉' },
  擎羊: { 庙: '辰戌丑未', 陷: '子午卯酉' },
  陀罗: { 庙: '辰戌丑未', 陷: '寅申巳亥' },
  火星: { 庙: '寅午戌', 地: '巳酉丑', 陷: '申子辰' },
  铃星: { 庙: '寅午戌', 地: '巳酉丑', 陷: '申子辰' },
};
export function quanshuBrightness(star: string, branch: string) {
  if (branch.length !== 1 || !branches.includes(branch)) throw new RangeError('Invalid source branch');
  return Object.entries(qualities[star] ?? {}).find(([, positions]) => positions.includes(branch))?.[0];
}

export function quanshuVerifiedMajorPositions(archiveMajor: (star: string) => string | undefined) {
  const ziwei = archiveMajor('紫微'), tianfu = archiveMajor('天府');
  // 明刊〈安天府图〉先校验紫府轴，〈安南北斗诸星诀〉给出两组固定步数。
  const anchorAgreement = ziwei !== undefined && tianfu === branches[mod(4 - branches.indexOf(ziwei))];
  const positions = new Map<string, string | undefined>();
  for (const { anchor, offsets } of nanyangMajorOffsets) {
    const origin = anchorAgreement ? archiveMajor(anchor) : undefined;
    for (const [star, offset] of Object.entries(offsets)) {
      const expected = origin === undefined ? undefined : branches[mod(branches.indexOf(origin) + offset)];
      positions.set(star, archiveMajor(star) === expected ? expected : undefined);
    }
  }
  return positions;
}

const sharedIdlePalaces: Readonly<Record<string, string | undefined>> = {
  紫微: '子辰亥', 天相: '辰戌', 七杀: '辰亥', 天梁: '酉', 天机: '巳', 破军: '巳申', 武曲: '申',
};

export function quanshuIdlePalace(star: string, branch: string) {
  if (branch.length !== 1 || !branches.includes(branch)) throw new RangeError('Invalid source branch');
  if (star === '贪狼') return { volumeTwo: '寅辰'.includes(branch), mingEdition: '寅申'.includes(branch) };
  // The Ming transcription prints 己酉 for Tianliang. 己 is not a branch.
  if (star === '天梁' && branch === '巳') return { volumeTwo: true, mingEdition: undefined };
  const listed = sharedIdlePalaces[star]?.includes(branch) === true;
  return { volumeTwo: listed, mingEdition: listed };
}

export function quanshuTransformations(stem: string) {
  const row = stem.length === 1 ? table[stems.indexOf(stem)] : undefined;
  if (!row) throw new RangeError('Unknown Quanshu transformation stem');
  return row.map((star, index) => ({ star, kind: ['禄', '权', '科', '忌'][index] }));
}

export function quanshuMingTabooStar(stem: string) {
  // 南阳堂卷三「庚日武同相」以天相受忌。三卷录文另用天同。
  return stem === '庚' ? '天相' : quanshuTransformations(stem).find(row => row.kind === '忌')!.star;
}

export function quanshuLuYangTuo(stem: string) {
  if (stem.length !== 1 || !stems.includes(stem)) throw new RangeError('Unknown source stem');
  const index = branches.indexOf('寅卯巳午巳午申酉亥子'[stems.indexOf(stem)]);
  return { lucunBranch: branches[index], qingyangBranch: branches[mod(index + 1)], tuoluoBranch: branches[mod(index - 1)] };
}

export function quanshuMinorLimit(birthYearBranch: string, gender: string, ordinal: number) {
  if (birthYearBranch.length !== 1 || !branches.includes(birthYearBranch) || !Number.isInteger(ordinal) || ordinal < 1) return undefined;
  const direction = gender === '男' ? 1 : gender === '女' ? -1 : undefined;
  if (direction === undefined) return undefined;
  // The four groups start at 戌 (申子辰), 未 (巳酉丑), 辰 (寅午戌), and 丑 (亥卯未).
  const startBranch = '戌未辰丑'[branches.indexOf(birthYearBranch) % 4];
  const branch = branches[mod(branches.indexOf(startBranch) + direction * (ordinal - 1))];
  return { startBranch, branch, ordinal, direction: direction === 1 ? '顺行' : '逆行' };
}

const lunar = LunarPackage as unknown as {
  Lunar: { fromYmd(year: number, month: number, day: number): { getSolar(): { toYmd(): string } } };
  LunarMonth: { fromYm(year: number, month: number): { getDayCount(): number } | null };
};

export function quanshuLunarMonthDays(year: number, signedMonth: number) {
  return lunar.LunarMonth.fromYm(year, signedMonth)?.getDayCount();
}

function verifyLeapBirthDate(natal: Natal) {
  const { lunarYear, lunarMonth, lunarDay } = natal.rawDates.lunarDate;
  if (lunarYear < 1 || lunarYear > 9998 || lunarMonth === 12 || !Number.isInteger(lunarDay) || lunarDay < 1
    || typeof natal.solarDate !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}$/u.test(natal.solarDate)) return false;
  try {
    const monthDays = quanshuLunarMonthDays(lunarYear, -lunarMonth);
    if (monthDays === undefined || lunarDay > monthDays) return false;
    const solarDate = lunar.Lunar.fromYmd(lunarYear, -lunarMonth, lunarDay).getSolar().toYmd();
    return solarDate.split('-').map(Number).join('-') === natal.solarDate.split('-').map(Number).join('-');
  } catch { return false; }
}

export function readQuanshuNatal(natal: Natal) {
  const date = natal.rawDates?.lunarDate, chinese = natal.rawDates?.chineseDate;
  if (!date || !Number.isInteger(date.lunarYear) || !Number.isInteger(date.lunarMonth) || date.lunarMonth < 1 || date.lunarMonth > 12
    || typeof date.isLeap !== 'boolean' || !Array.isArray(natal.palaces) || natal.palaces.length !== 12
    || new Set(natal.palaces.map(p => p.index)).size !== 12 || new Set(natal.palaces.map(p => p.earthlyBranch)).size !== 12
    || natal.palaces.some(p => !Number.isInteger(p.index) || p.index < 0 || p.index > 11 || p.earthlyBranch.length !== 1
      || branches[mod(p.index + 2)] !== p.earthlyBranch
      || ![p.majorStars, p.minorStars, p.adjectiveStars].every(Array.isArray))) return { status: 'unavailable' } as const;
  if (date.isLeap && !verifyLeapBirthDate(natal)) return { status: 'unsupported_leap' } as const;
  const birthStem = chinese?.yearly?.[0], birthHour = chinese?.hourly?.[1];
  if (!birthStem || !birthHour || birthStem.length !== 1 || birthHour.length !== 1 || !stems.includes(birthStem)
    || !branches.includes(birthHour) || stems[((date.lunarYear - 4) % 10 + 10) % 10] !== birthStem) return { status: 'unavailable' } as const;
  const birthMonth = date.lunarMonth + Number(date.isLeap);
  const monthIndex = 2 + birthMonth - 1, hourIndex = branches.indexOf(birthHour);
  const lifeBranch = branches[mod(monthIndex - hourIndex)];
  const life = natal.palaces.filter(p => p.name === '命宫'), migration = natal.palaces.filter(p => p.name === '迁移');
  if (life.length !== 1 || migration.length !== 1 || life[0].earthlyBranch !== lifeBranch
    || migration[0].earthlyBranch !== branches[mod(branches.indexOf(lifeBranch) + 6)]) {
    return { status: date.isLeap ? 'unsupported_leap' : 'inconsistent_life' } as const;
  }
  if (date.isLeap) {
    const bodyBranch = branches[mod(monthIndex + hourIndex)], body = natal.palaces.filter(p => p.isBodyPalace === true);
    if (natal.palaces.some(p => typeof p.isBodyPalace !== 'boolean') || body.length !== 1
      || body[0].earthlyBranch !== bodyBranch || natal.earthlyBranchOfBodyPalace !== bodyBranch
      || natal.earthlyBranchOfSoulPalace !== lifeBranch || chinese?.yearly?.[1] !== branches[mod(date.lunarYear - 4)]) {
      return { status: 'unsupported_leap' } as const;
    }
  }
  const sourceStars = quanshuLuYangTuo(birthStem);
  for (const [star, branch] of [['禄存', sourceStars.lucunBranch], ['擎羊', sourceStars.qingyangBranch], ['陀罗', sourceStars.tuoluoBranch]]) {
    const placements = natal.palaces.flatMap(p => allStars(p).filter(s => s.name === star).map(() => p.earthlyBranch));
    if (placements.length !== 1 || placements[0] !== branch) return { status: 'inconsistent_lu_yang_tuo' } as const;
  }
  return { status: 'ready', birthStem, birthMonth, birthHour,
    birthLeapMonth: date.isLeap ? date.lunarMonth : undefined,
    birthMonthBasis: date.isLeap ? 'quanshu-leap-next-month' : 'regular-month',
    lifeBranch, migrationBranch: migration[0].earthlyBranch,
    birthYear: date.lunarYear, lifeIndex: life[0].index, ...sourceStars } as const;
}
export const quanshuPalaceRelation = (from: string, to: string) => {
  const distance = mod(branches.indexOf(to) - branches.indexOf(from));
  return distance === 0 ? '守' : distance === 6 ? '冲' : distance === 4 || distance === 8 ? '三合' : '其他';
};

export const jielanDignityProfile = 'jielan-volume-two-individual-star-dignity-v1';
const jielanFallenPalaces = { 破军: '卯酉辰戌', 文曲: '寅午戌' };

export function jielanFallenAt(star: keyof typeof jielanFallenPalaces, branch?: string) {
  return branch === undefined ? undefined : branch.length === 1 && jielanFallenPalaces[star].includes(branch);
}

export function quanshuAnnualContext(natal: Natal, lunarYear: number, annualStem: string) {
  const basis = readQuanshuNatal(natal);
  if (basis.status !== 'ready') return { ready: false, reason: basis.status } as const;
  if (!Number.isInteger(lunarYear) || stems[((lunarYear - 4) % 10 + 10) % 10] !== annualStem) return { ready: false, reason: 'inconsistent_annual_stem' } as const;
  const annual = quanshuLuYangTuo(annualStem);
  return { ...basis, profile: quanshuZiweiPolicy.profile, ready: true, lunarYear,
    annualStem, annualLucunBranch: annual.lucunBranch, annualQingyangBranch: annual.qingyangBranch,
    annualTuoluoBranch: annual.tuoluoBranch,
    annualQingyangLifeRelation: quanshuPalaceRelation(basis.lifeBranch, annual.qingyangBranch),
    annualTuoluoLifeRelation: quanshuPalaceRelation(basis.lifeBranch, annual.tuoluoBranch),
    natalTriadMajorStars: natal.palaces.filter(p => [basis.lifeIndex, mod(basis.lifeIndex + 4), mod(basis.lifeIndex + 8)].includes(p.index))
      .flatMap(p => p.majorStars.map(s => s.name)),
  } as const;
}

// Layer geometry is from the explicitly named product calendar. The source's
// natal transformation table and explicit quality cells are computed separately.
export function quanshuPalaceCondition(natal: Natal, palaceIndex: number, flowName: string) {
  const basis = readQuanshuNatal(natal), palace = natal.palaces.find(p => p.index === palaceIndex);
  if (basis.status !== 'ready' || !palace) return { ready: false, reason: basis.status } as const;
  const placements = quanshuTransformations(basis.birthStem).map(t => ({ ...t,
    indices: natal.palaces.filter(p => [...p.majorStars, ...p.minorStars].some(s => s.name === t.star)).map(p => p.index) }));
  const area = [palace.index, mod(palace.index + 4), mod(palace.index + 6), mod(palace.index + 8)];
  const names = allStars(palace).map(s => s.name);
  const graded = names.filter(name => qualities[name]).map(star => ({ star, grade: quanshuBrightness(star, palace.earthlyBranch) }));
  return { profile: quanshuZiweiPolicy.profile, tableVersion: quanshuZiweiPolicy.table, ready: true,
    branch: palace.earthlyBranch, palaceIndex, flowName, natalName: palace.name,
    localStarNames: names, surroundingStarNames: [...new Set(natal.palaces.filter(p => area.includes(p.index)).flatMap(p => allStars(p).map(s => s.name)))],
    sourceQualities: graded, sourceTempleStars: graded.filter(s => s.grade === '庙').map(s => s.star),
    sourceFallenStars: graded.filter(s => s.grade === '陷').map(s => s.star),
    sourceFallenCount: graded.filter(s => s.grade === '陷').length,
    unknownQualityStars: graded.filter(s => !s.grade).map(s => s.star),
    nativeMaleficNames: names.filter(name => ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'].includes(name)),
    localNatalTransformationKinds: placements.filter(t => t.indices.length === 1 && t.indices[0] === palaceIndex).map(t => t.kind),
    localNatalTransformations: placements.filter(t => t.indices.length === 1 && t.indices[0] === palaceIndex).map(t => t.kind + ':' + t.star),
    surroundingNatalTransformations: placements.filter(t => t.indices.length === 1 && area.includes(t.indices[0])).map(t => t.kind + ':' + t.star),
    unlocatedTransformationStars: placements.filter(t => t.indices.length !== 1).map(t => t.star),
    majorStarNames: names.filter(name => quanshuMajorStarNames.includes(name)),
    calendarPolicy: quanshuZiweiPolicy.calendar,
  } as const;
}

// Volume I's Tianxing answer and its immediately following verse are one
// passage: the listed 寅卯酉戌 seats locate its 入庙 exception. This does not
// extend volume III's brightness table or label every unlisted seat as 陷.
// Volume II independently places the natal star at 酉 + (birth month - 1).
export function quanshuTianxingCondition(natal: Natal, palaceIndex: number) {
  const basis = readQuanshuNatal(natal), palace = natal.palaces.find(p => p.index === palaceIndex);
  if (basis.status !== 'ready' || !palace) return { ready: false, reason: basis.status === 'ready' ? 'missing_limit_palace' : basis.status } as const;
  const { birthMonth } = basis;
  const tianxingBranch = branches[mod(9 + birthMonth - 1)];
  const placements = natal.palaces.flatMap(row => allStars(row).filter(star => star.name === '天刑').map(() => row));
  if (placements.length !== 1 || placements[0].earthlyBranch !== tianxingBranch
    || !placements[0].adjectiveStars.some(star => star.name === '天刑')) {
    return { ready: false, reason: 'inconsistent_tianxing' } as const;
  }
  return { ready: true, profile: quanshuZiweiPolicy.tianxing, tianxingPlacementProof: 'quanshu-tianxing-birth-month-adjective-layer-v1', birthMonth,
    branch: palace.earthlyBranch, palaceIndex, natalName: palace.name,
    tianxingBranch, inLimit: palace.earthlyBranch === tianxingBranch,
    templeListed: '寅卯酉戌'.includes(tianxingBranch), calendarPolicy: quanshuZiweiPolicy.calendar } as const;
}
export function quanshuLunarMidnight(year: number, month: number) {
  return Date.parse(lunar.Lunar.fromYmd(year, month, 1).getSolar().toYmd() + 'T00:00:00+08:00');
}

export function quanshuLimitPhase(natal: Natal, palaceIndex: number, nominalAge: number, at: number) {
  const basis = readQuanshuNatal(natal), palace = natal.palaces.find(p => p.index === palaceIndex);
  const range = palace?.decadal?.range;
  if (basis.status !== 'ready' || !range || range.length !== 2 || !range.every(Number.isInteger)
    || range[1] - range[0] !== 9 || !(range[0] <= nominalAge && nominalAge <= range[1])) return { ready: false } as const;
  const startYear = basis.birthYear + range[0] - 1;
  const start = quanshuLunarMidnight(startYear, 1), end = quanshuLunarMidnight(startYear + 10, 1);
  if (!(start <= at && at < end)) return { ready: false } as const;
  return { ready: true, profile: quanshuZiweiPolicy.profile, branch: palace!.earthlyBranch, palaceIndex, nominalAge,
    startAge: range[0], endAge: range[1], stageStart: new Date(start).toISOString(), stageEnd: new Date(end).toISOString(),
    midpoint: new Date(quanshuLunarMidnight(startYear + 5, 1)).toISOString(),
    calendarPolicy: quanshuZiweiPolicy.calendar };
}
