import { readQuanshuNatal } from './ziwei-quanshu';

type Natal = Parameters<typeof readQuanshuNatal>[0];
const branches = '子丑寅卯辰巳午未申酉戌亥';
const mod = (value: number) => (value % 12 + 12) % 12;
const stars = (palace: Natal['palaces'][number]) => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];

export const quanshuKongJiePolicy = {
  profile: 'quanshu-kongjie-hour-four-flying-v1',
  placement: 'hai-zi-forward-jie-backward-kong',
  archiveNames: { sourceSky: '地空', sourceRobbery: '地劫' },
  annual: 'sui-plus2-mourning-minus2-visitor-opposites-tiger-official',
  calendar: 'product-native-lunar-new-year-and-civil-midnight',
  interpretation: 'source-rescue-contact-and-annual-sha-still-unresolved',
} as const;

// Read the source's birth-hour rule independently. A name alone, or a modern
// 天空 at a convenient palace, is never sufficient to establish the identity.
export function quanshuKongJiePositions(natal: Natal) {
  const basis = readQuanshuNatal(natal);
  if (basis.status !== 'ready') return { ready: false, reason: basis.status } as const;
  const birthHour = natal.rawDates.chineseDate.hourly[1], hour = branches.indexOf(birthHour);
  const skyBranch = branches[mod(11 - hour)], robberyBranch = branches[mod(11 + hour)];
  const placementVerified = (name: string, branch: string) => {
    const placements = natal.palaces.flatMap(p => stars(p).filter(s => s.name === name).map(() => p.earthlyBranch));
    return placements.length === 1 && placements[0] === branch
      && natal.palaces.find(p => p.earthlyBranch === branch)?.minorStars.some(row => row.name === name) === true;
  };
  const skyVerified = placementVerified('地空', skyBranch);
  const robberyVerified = placementVerified('地劫', robberyBranch);
  if (!skyVerified) return { ready: false, reason: 'inconsistent_地空',
    verifiedRobberyBranch: robberyVerified ? robberyBranch : undefined } as const;
  if (!robberyVerified) return { ready: false, reason: 'inconsistent_地劫', verifiedSkyBranch: skyBranch } as const;
  return { ready: true, birthHour, skyBranch, robberyBranch,
    modernSkyBranches: natal.palaces.flatMap(p => stars(p).filter(s => s.name === '天空').map(() => p.earthlyBranch)),
    skyRobberyTogether: skyBranch === robberyBranch } as const;
}

// Volume II's four flying stars. Preserve the printed 官府 spelling; its
// coordinate agreement with modern annual 官符 is not a universal name alias.
export function quanshuFourFlying(lunarYear: number) {
  if (!Number.isInteger(lunarYear) || lunarYear < 1 || lunarYear > 9999) throw new RangeError('Invalid source lunar year');
  const year = mod(lunarYear - 4);
  return { lunarYear, yearBranch: branches[year], placements: [
    { name: '丧门', branch: branches[mod(year + 2)] }, { name: '吊客', branch: branches[mod(year - 2)] },
    { name: '白虎', branch: branches[mod(year + 8)] }, { name: '官府', branch: branches[mod(year + 4)] },
  ] };
}

export function quanshuKongJieCondition(natal: Natal, palaceIndex: number, lunarYear: number) {
  const basis = quanshuKongJiePositions(natal), palace = natal.palaces.find(p => p.index === palaceIndex);
  if (!basis.ready || !palace) return { ready: false, reason: !basis.ready ? basis.reason : 'missing_limit_palace' } as const;
  if (!Number.isInteger(lunarYear) || lunarYear < 1 || lunarYear > 9999) return { ready: false, reason: 'invalid_lunar_year' } as const;
  const annual = quanshuFourFlying(lunarYear), branch = palace.earthlyBranch, index = branches.indexOf(branch);
  return { ...basis, profile: quanshuKongJiePolicy.profile, palaceIndex, branch, natalName: palace.name,
    localSourceVoids: [ ...(branch === basis.skyBranch ? ['天空'] : []), ...(branch === basis.robberyBranch ? ['地劫'] : []) ],
    archivedMajorStarNames: palace.majorStars.map(s => s.name),
    ...annual,
    annualAtPalace: annual.placements.filter(s => s.branch === branch).map(s => s.name),
    annualOpposite: annual.placements.filter(s => s.branch === branches[mod(index + 6)]).map(s => s.name),
    annualTriad: annual.placements.filter(s => [branches[mod(index + 4)], branches[mod(index + 8)]].includes(s.branch)).map(s => s.name),
    calendarPolicy: quanshuKongJiePolicy.calendar,
  } as const;
}
