import type { DestinyChartSnapshot } from '../../destiny';

type Natal = DestinyChartSnapshot['ziwei']['rawResult'][number];
const branches = '子丑寅卯辰巳午未申酉戌亥';
const birthGroups = [
  { years: '寅午戌', quanshu: '丑卯', jielan: '丑卯' }, { years: '申子辰', quanshu: '寅戌', jielan: '寅戌' },
  { years: '巳酉丑', quanshu: '卯戌', jielan: '戌卯' }, { years: '亥卯未', quanshu: '酉戌', jielan: '酉戌' },
];
export const jielanFireBellProfile = 'jielan-named-firebell-hour-v1';
export const quanshuFixedFireBellProfile = 'quanshu-nanyangtang-fixed-firebell-v1';
export const archivedFireBellPlacementProof = 'quanshu-archive-firebell-helper-layer-v1';

function birthGroup(birthYearBranch: string) {
  if (birthYearBranch.length !== 1 || !branches.includes(birthYearBranch)) throw new RangeError('Invalid fire/bell birth-year branch');
  return birthGroups.find(row => row.years.includes(birthYearBranch))!;
}

function namedPair(pair: string) {
  return [{ star: '火星', branch: pair[0] }, { star: '铃星', branch: pair[1] }] as const;
}

export function quanshuFireBellAnchors(birthYearBranch: string) {
  const group = birthGroup(birthYearBranch);
  // The transcription gives an unordered pair. Names and the hour walk use the archive engine's rule.
  return { birthGroup: group.years, sourcePair: [...group.quanshu], engineNamedAnchors: namedPair(group.quanshu) };
}

export function readQuanshuArchivedFireBell(natal: Natal, birthYearBranch: string, birthHour: string) {
  const anchors = quanshuFireBellAnchors(birthYearBranch);
  // Nanyangtang volume VI charts show these named seats even for births outside the Zi hour.
  const quanshuFixedFireBell = anchors.engineNamedAnchors;
  if (birthHour.length !== 1 || !branches.includes(birthHour)) throw new RangeError('Invalid fire/bell birth-hour branch');
  const hour = branches.indexOf(birthHour);
  const advanceFromZi = (rows: ReturnType<typeof namedPair>) => rows.map(row => ({ ...row,
    branch: branches[(branches.indexOf(row.branch) + hour) % 12] }));
  const archivedFireBell = advanceFromZi(anchors.engineNamedAnchors);
  const jielanAnchors = namedPair(birthGroup(birthYearBranch).jielan);
  const jielanFireBell = advanceFromZi(jielanAnchors);
  const verifiedArchivedFireBell = archivedFireBell.map(({ star, branch }) => {
    const positions = natal.palaces.flatMap(palace => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars]
      .filter(row => row.name === star).map(() => palace.earthlyBranch));
    const inMinorLayer = natal.palaces.find(palace => palace.earthlyBranch === branch)?.minorStars.some(row => row.name === star);
    return { star, branch: positions.length === 1 && positions[0] === branch && inMinorLayer ? branch : undefined };
  });
  const inconsistentStar = verifiedArchivedFireBell.find(row => row.branch === undefined)?.star;
  return { anchors, archivedFireBell, verifiedArchivedFireBell, inconsistentStar, jielanAnchors, jielanFireBell, quanshuFixedFireBell };
}
