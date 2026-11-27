import { lunarAtCivilClock } from './fortune-calendar';
import { quanshuVerifiedMajorPositions, type readQuanshuNatal } from './ziwei-quanshu';

type Natal = Parameters<typeof readQuanshuNatal>[0];
const branches = '子丑寅卯辰巳午未申酉戌亥';
const bureauNumbers: Readonly<Partial<Record<string, number>>> = { 水二局: 2, 木三局: 3, 金四局: 4, 土五局: 5, 火六局: 6 };
export const quanshuZiweiBirthAnchorProof = 'quanshu-natal-ziwei-bureau-lunar-day-v1';

export function verifiedLunarBirthDay(natal: Natal) {
  const solar = /^(\d{4})-(\d{1,2})-(\d{1,2})$/u.exec(natal.solarDate);
  if (!solar) return undefined;
  const [year, month, day] = solar.slice(1).map(Number);
  const civilDay = new Date(Date.UTC(year, month - 1, day));
  if (civilDay.getUTCFullYear() !== year || civilDay.getUTCMonth() + 1 !== month || civilDay.getUTCDate() !== day) return undefined;
  const lunar = lunarAtCivilClock(civilDay.getTime()) as ReturnType<typeof lunarAtCivilClock> & { getMonth(): number; getDay(): number };
  const archive = natal.rawDates.lunarDate;
  return lunar.getYear() === archive.lunarYear && lunar.getMonth() === (archive.isLeap ? -archive.lunarMonth : archive.lunarMonth)
    && lunar.getDay() === archive.lunarDay ? archive.lunarDay : undefined;
}

export function quanshuZiweiBirthAnchor(natal: Natal, verifiedLifeBureau?: string) {
  const bureau = verifiedLifeBureau ? bureauNumbers[verifiedLifeBureau] : undefined;
  if (bureau === undefined) return undefined;
  const day = verifiedLunarBirthDay(natal);
  if (day === undefined) return undefined;
  // 五局起紫微以生日线定位。从寅计商数，补数奇退偶进。
  const quotient = Math.ceil(day / bureau), remainder = quotient * bureau - day;
  const fromYin = quotient - 1 + (remainder % 2 === 0 ? remainder : -remainder);
  return branches[(branches.indexOf('寅') + fromYin + 12) % 12];
}

export function quanshuBirthAnchoredMajorPositions(natal: Natal, verifiedLifeBureau: string | undefined,
  archiveMajor: Parameters<typeof quanshuVerifiedMajorPositions>[0]) {
  const positions = quanshuVerifiedMajorPositions(archiveMajor);
  const expected = quanshuZiweiBirthAnchor(natal, verifiedLifeBureau), archived = positions.get('紫微');
  const ziweiBirthAnchorVerified = expected === undefined || archived === undefined ? undefined : archived === expected;
  return { positions: ziweiBirthAnchorVerified === true ? positions : new Map<string, string | undefined>(), ziweiBirthAnchorVerified };
}
