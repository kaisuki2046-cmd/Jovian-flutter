import { describeBaZiPillar } from './bazi-calculation';
import { quanshuLimitPhase, quanshuLunarMidnight, type readQuanshuNatal } from './ziwei-quanshu';

type Natal = Parameters<typeof readQuanshuNatal>[0];
type Basis = Extract<ReturnType<typeof readQuanshuNatal>, { status: 'ready' }>;
const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';
const bureaus: Readonly<Partial<Record<string, string>>> = { 水: '水二局', 木: '木三局', 金: '金四局', 土: '土五局', 火: '火六局' };
const decadalStartAges: Readonly<Partial<Record<string, number>>> = { 水二局: 2, 木三局: 3, 金四局: 4, 土五局: 5, 火六局: 6 };
const growthOrigins: Readonly<Partial<Record<string, string>>> = { 水二局: '申', 木三局: '亥', 金四局: '巳', 土五局: '申', 火六局: '寅' };
const phases = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
export const quanshuGrowthProfile = 'quanshu-volume-two-bureau-growth-by-gender-v1';
export const quanshuLimitPlacementProof = 'quanshu-bureau-and-source-minor-v1';

export function quanshuPalaceStem(basis: Basis, palaceIndex: number) {
  // 卷二起五行寅例，先定寅宫干，再沿本命宫序进位。
  return stems[(2 + 2 * (stems.indexOf(basis.birthStem) % 5) + palaceIndex) % 10];
}

export function quanshuLifeBureau(natal: Natal, basis: Basis) {
  const palace = natal.palaces.find(row => row.index === basis.lifeIndex);
  const expectedStem = quanshuPalaceStem(basis, basis.lifeIndex);
  const lifePalacePillar = palace?.heavenlyStem === expectedStem ? expectedStem + basis.lifeBranch : undefined;
  const lifePalaceNaYin = lifePalacePillar ? describeBaZiPillar(lifePalacePillar).naYin : undefined;
  const bureau = lifePalaceNaYin && bureaus[lifePalaceNaYin.slice(-1)];
  return { lifePalacePillar, lifePalaceNaYin,
    verifiedLifeBureau: bureau === natal.fiveElementsClass ? bureau : undefined };
}

export function quanshuDecadalVerification(natal: Natal, basis: Basis, decadal: Natal['palaces'][number] | undefined,
  lunarYear: number, verifiedLifeBureau = quanshuLifeBureau(natal, basis).verifiedLifeBureau) {
  if (!decadal) return undefined;
  const nominalAge = lunarYear - basis.birthYear + 1;
  const firstAge = verifiedLifeBureau ? decadalStartAges[verifiedLifeBureau] : undefined;
  const ordinal = firstAge === undefined || !['男', '女'].includes(natal.gender)
    ? undefined : Math.floor((nominalAge - firstAge) / 10);
  const forward = '甲丙戊庚壬'.includes(basis.birthStem) === (natal.gender === '男');
  // 《捷览》〈定大限诀〉从已核命宫与局数起岁，阳男阴女顺排，十年一宫。
  const verified = firstAge === undefined || ordinal === undefined ? undefined
    : ordinal >= 0 && ordinal < 12
      && decadal.index === (basis.lifeIndex + (forward ? ordinal : -ordinal) + 12) % 12
      && decadal.decadal?.range?.[0] === firstAge + 10 * ordinal
      && quanshuLimitPhase(natal, decadal.index, nominalAge, quanshuLunarMidnight(lunarYear, 1)).ready;
  return { branch: decadal.earthlyBranch, verified };
}

export function quanshuGrowthAtBranch(bureau: string, gender: string, branch: string) {
  const origin = growthOrigins[bureau];
  if (!origin || !['男', '女'].includes(gender) || branch.length !== 1 || !branches.includes(branch)) return undefined;
  const direction = gender === '男' ? 1 : -1;
  const offset = direction * (branches.indexOf(branch) - branches.indexOf(origin));
  return { profile: quanshuGrowthProfile, bureau, origin, direction: direction === 1 ? '顺排' : '逆排',
    branch, phase: phases[(offset + 12) % 12] } as const;
}
