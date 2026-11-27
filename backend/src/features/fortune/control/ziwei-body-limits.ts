import { quanshuBrightness, quanshuTransformations, quanshuTianxingCondition, readQuanshuNatal } from './ziwei-quanshu';
import { quanshuFireBellCondition } from './ziwei-firebell';
import type { quanshuDoujunCondition } from './ziwei-source-year';

type Args = Parameters<typeof quanshuDoujunCondition>;
type Natal = Args[0];
const branches = '子丑寅卯辰巳午未申酉戌亥', stems = '甲乙丙丁戊己庚辛壬癸';
const majors = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
const mod = (n: number) => (n % 12 + 12) % 12;
const all = (p: Natal['palaces'][number]) => [...p.majorStars, ...p.minorStars, ...p.adjectiveStars];
const relation = (focus: string, target: string) => {
  const distance = mod(branches.indexOf(target) - branches.indexOf(focus));
  return distance === 0 ? '守' : distance === 6 ? '冲' : [4, 8].includes(distance) ? '三合' : [1, 11].includes(distance) ? '邻宫' : '其他';
};
export const quanshuBodyLimitPolicy = {
  profile: 'quanshu-body-life-limits-atomic-v1', placement: 'volume2-birth-month-clockwise-birth-hour-clockwise-body-counterclockwise-life',
  geometry: 'one-candidate-all-annual-decadal-minor-boundaries-no-same-palace-shortcut',
  transformations: 'birth-stem-source-table-and-explicit-annual-extension-candidate-kept-separate',
  sha: 'source-yang-tuo-and-archive-product-firebell-candidates-not-complete-source-sha-set',
  interpretation: 'xing-ji-blade-identities-and-effective-rescue-not-inferred',
} as const;

export function quanshuBodyLifePositions(month: number, hour: string) {
  if (!Number.isInteger(month) || month < 1 || month > 12 || hour.length !== 1 || !branches.includes(hour)) throw new RangeError('Invalid source body/life basis');
  const monthStop = mod(2 + month - 1), step = branches.indexOf(hour);
  return { monthStop: branches[monthStop], lifeBranch: branches[mod(monthStop - step)], bodyBranch: branches[mod(monthStop + step)] };
}

export function readQuanshuBodyNatal(natal: Natal) {
  const basis = readQuanshuNatal(natal);
  if (basis.status !== 'ready') return { ready: false, reason: basis.status } as const;
  const { birthMonth, birthHour } = basis;
  const calculated = quanshuBodyLifePositions(birthMonth, birthHour), flagged = natal.palaces.filter(p => p.isBodyPalace === true);
  if (natal.palaces.some(p => typeof p.isBodyPalace !== 'boolean') || flagged.length !== 1
    || flagged[0].earthlyBranch !== calculated.bodyBranch || natal.earthlyBranchOfBodyPalace !== calculated.bodyBranch
    || natal.earthlyBranchOfSoulPalace !== calculated.lifeBranch || basis.lifeBranch !== calculated.lifeBranch) {
    return { ready: false, reason: 'inconsistent_body_life_archive' } as const;
  }
  const positions = majors.flatMap(star => natal.palaces.flatMap(p => all(p).filter(s => s.name === star).map(() => ({ star, branch: p.earthlyBranch, index: p.index }))));
  if (majors.some(star => positions.filter(p => p.star === star).length !== 1)) return { ready: false, reason: 'incomplete_major_positions' } as const;
  return { ready: true, basis, birthMonth, birthHour, ...calculated, bodyIndex: flagged[0].index,
    bodyNatalName: flagged[0].name, mainPositions: positions } as const;
}

export function quanshuBodyLimitCondition(...args: Args) {
  const [natal, palaceIndex, annualIndex, lunarYear, scope, decadalIndex, minorIndex] = args;
  const native = readQuanshuBodyNatal(natal), palace = natal.palaces.find(p => p.index === palaceIndex);
  const annual = natal.palaces.find(p => p.index === annualIndex), decadal = natal.palaces.find(p => p.index === decadalIndex), minor = natal.palaces.find(p => p.index === minorIndex);
  if (!native.ready || !palace || !annual || !Number.isInteger(lunarYear) || lunarYear < native.basis.birthYear || lunarYear > 9998
    || !['decadal', 'minor', 'yearly'].includes(scope)) return { ready: false, reason: 'unavailable_body_limit_basis' } as const;
  const annualBranch = branches[mod(lunarYear - 4)], annualStem = stems[((lunarYear - 4) % 10 + 10) % 10];
  if (annual.earthlyBranch !== annualBranch || (decadalIndex !== undefined && !decadal) || (minorIndex !== undefined && !minor)
    || scope === 'yearly' && palaceIndex !== annualIndex || scope === 'decadal' && palaceIndex !== decadalIndex
    || scope === 'minor' && palaceIndex !== minorIndex) return { ready: false, reason: 'inconsistent_body_limit_geometry' } as const;
  const locations = (star: string) => natal.palaces.flatMap(p => all(p).filter(s => s.name === star).map(() => p.earthlyBranch));
  const qisha = native.mainPositions.find(row => row.star === '七杀')!;
  const at = (branch: string) => ({ focusRelation: relation(palace.earthlyBranch, branch), lifeRelation: relation(native.lifeBranch, branch), bodyRelation: relation(native.bodyBranch, branch) });
  const firebell = quanshuFireBellCondition(...args);
  const shaPositions = [{ star: '擎羊', branch: native.basis.qingyangBranch, coordinateBasis: 'source' },
    { star: '陀罗', branch: native.basis.tuoluoBranch, coordinateBasis: 'source' },
    ...(firebell.ready ? firebell.archivedFireBell.map(row => ({ ...row, coordinateBasis: 'archive-product' })) : [])]
    .map(row => ({ ...row, ...at(row.branch) }));
  const present = (key: 'lifeRelation' | 'bodyRelation') => shaPositions.some(row => row[key] === '守') ? true : firebell.ready ? false : undefined;
  const tianxing = quanshuTianxingCondition(natal, palaceIndex);
  const transformations = (stem: string, layer: 'natal' | 'annual_candidate') => quanshuTransformations(stem).map(t => {
    const found = locations(t.star), branch = found.length === 1 ? found[0] : undefined;
    return { ...t, layer, stem, placed: branch !== undefined, branch, ...(branch ? at(branch) : {}),
      sourceStatus: layer === 'natal' ? 'birth-stem-explicit-source-table' : 'extension-candidate-not-verified-annual-rule' };
  });
  const rescuePositions = [...['紫微', '天相'].map(star => native.mainPositions.find(row => row.star === star)!),
    { star: '禄存', branch: native.basis.lucunBranch, index: natal.palaces.find(p => p.earthlyBranch === native.basis.lucunBranch)!.index }]
    .map(row => ({ star: row.star, branch: row.branch, ...at(row.branch) }));
  const layerContacts = [{ scope: 'yearly', palace: annual }, ...(decadal ? [{ scope: 'decadal', palace: decadal }] : []),
    ...(minor ? [{ scope: 'minor', palace: minor }] : [])].map(row => ({ scope: row.scope, branch: row.palace.earthlyBranch, natalName: row.palace.name,
      ...at(row.palace.earthlyBranch), qishaRelation: relation(row.palace.earthlyBranch, qisha.branch) }));
  return { ready: true, profile: quanshuBodyLimitPolicy.profile, birthMonth: native.birthMonth, birthHour: native.birthHour,
    scope, branch: palace.earthlyBranch, natalName: palace.name, lunarYear, annualStem, annualBranch,
    bodyBranch: native.bodyBranch, lifeBranch: native.lifeBranch, bodyNatalName: native.bodyNatalName,
    bodyLifeSame: native.bodyBranch === native.lifeBranch, layerContacts,
    decadalMinorSamePalace: decadal && minor ? decadal.index === minor.index : undefined,
    focusMainStars: native.mainPositions.filter(row => row.branch === palace.earthlyBranch).map(row => row.star),
    lifeMainStars: native.mainPositions.filter(row => row.branch === native.lifeBranch).map(row => row.star),
    bodyMainStars: native.mainPositions.filter(row => row.branch === native.bodyBranch).map(row => row.star),
    qishaBranch: qisha.branch, qishaAtLifeOrBody: [native.lifeBranch, native.bodyBranch].includes(qisha.branch),
    qishaGrade: quanshuBrightness('七杀', qisha.branch), qishaRelations: at(qisha.branch),
    shaPositions, lifeCandidateShaPresent: present('lifeRelation'), bodyCandidateShaPresent: present('bodyRelation'),
    firebellProductCoordinatesReady: firebell.ready, sourceFirebellHourVerified: false,
    tianxingReady: tianxing.ready, tianxingBranch: tianxing.ready ? tianxing.tianxingBranch : undefined,
    tianxingRelations: tianxing.ready ? at(tianxing.tianxingBranch) : undefined,
    transformations: [...transformations(native.basis.birthStem, 'natal'), ...transformations(annualStem, 'annual_candidate')],
    annualTransformationRuleVerified: false, rescuePositions, geometryOnly: true,
    calendarPolicy: 'native-lunar-new-year-and-civil-midnight' } as const;
}
