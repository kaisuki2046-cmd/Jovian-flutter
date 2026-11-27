import { chartVersions } from '../../control/charts.ts';

export const ziweiNatalPlacementProfile = 'iztro-2.6.5-natal-year-placement-v1';
const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';
const palaces = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
const lu = '寅卯巳午巳午申酉亥子';
const mod = n => (n % 12 + 12) % 12;
const changshengStart = { 水二局: '申', 木三局: '亥', 金四局: '巳', 土五局: '申', 火六局: '寅' };
const phases = '长生 沐浴 冠带 临官 帝旺 衰 病 死 墓 绝 胎 养'.split(' ');

// The installed chart profile follows iztro's getchangsheng12. Verify the
// transmitted life-palace phase before using its cycle at other natal seats.
export function ziweiPalaceChangshengFacts(facts, branchAt, scope) {
  if (scope !== 'natal') return [];
  const unique = (kind, field) => {
    const values = new Set(facts.filter(fact => fact.kind === kind).map(fact => fact[field]));
    return values.size === 1 ? values.values().next().value : null;
  };
  const gender = unique('natal_gender', 'gender');
  const stem = stems.indexOf(unique('natal_year_stem', 'stem'));
  const yearBranch = branches.indexOf(unique('natal_year_branch', 'branch'));
  const start = changshengStart[unique('natal_ziwei_bureau', 'bureau')];
  const lifeBranch = branchAt('命宫');
  const lifeIndex = branches.indexOf(lifeBranch);
  if (!gender || !start || lifeIndex < 0 || stem < 0 || yearBranch < 0 || stem % 2 !== yearBranch % 2) return [];

  const forward = (gender === '男') === (yearBranch % 2 === 0);
  const direction = forward ? 1 : -1;
  const startIndex = branches.indexOf(start);
  const phaseAt = branch => phases[mod((branches.indexOf(branch) - startIndex) * direction)];
  if (unique('natal_ziwei_life_phase', 'phase') !== phaseAt(lifeBranch)) return [];

  const placements = palaces.flatMap((palace, index) => {
    const branch = branches[mod(lifeIndex - index)];
    return branchAt(palace) === branch ? [{ kind: 'palace_changsheng_phase', palace, phase: phaseAt(branch) }] : [];
  });
  const hourBranch = unique('natal_ziwei_hour', 'branch');
  if ([...branches].includes(hourBranch)) {
    placements.push({ kind: 'natal_ziwei_hour_phase', phase: phaseAt(hourBranch) });
  }
  return placements;
}

// A feasibility check, never a source of positive runtime facts. These are
// iztro 2.6.5 star/location.js getLuYangTuoMaIndex's year-based placements.
// Enumerate the 60 LEGAL year pillars; arbitrary stem/branch cross-products
// would incorrectly make 辰/戌 birth years compatible with 四库擎羊.
export function compatibleZiweiNatalPlacement(facts) {
  if (chartVersions.ziwei.engineVersion !== '2.6.5'
    || chartVersions.ziwei.rulesetVersion !== 'standard-new-year-leap-split-late-zi-current-v1') {
    throw new Error('Review Ziwei natal year placement profile after an engine change.');
  }
  facts = facts.filter(f => ['natal_year_stem', 'natal_year_branch', 'palace_branch'].includes(f.kind)
    || f.kind === 'palace_star' && f.scope === 'origin' && ['擎羊', '天马'].includes(f.star));
  return Array.from({ length: 60 }, (_, year) => ({ stem: stems[year % 10], branch: branches[year % 12] })).some(({ stem, branch }) => {
    if (facts.some(f => f.kind === 'natal_year_stem' && f.stem !== stem || f.kind === 'natal_year_branch' && f.branch !== branch)) return false;
    const qingyang = branches[mod(branches.indexOf(lu[stems.indexOf(stem)]) + 1)];
    const tianma = '寅亥申巳'[branches.indexOf(branch) % 4];
    return [...branches].some((_, life) => facts.every(f => {
      const index = palaces.indexOf(f.palace);
      const at = index < 0 ? null : branches[mod(life - index)];
      if (f.kind === 'palace_branch') return at === f.branch;
      if (f.kind === 'palace_star' && f.scope === 'origin' && ['擎羊', '天马'].includes(f.star)) return at === (f.star === '擎羊' ? qingyang : tianma);
      return true;
    }));
  });
}

export const hasZiweiNatalPlacementSyntax = claim => claim.conditions.normalized.some(text =>
  /年或.+年生|生年地支|在四[生墓库]宫位的/u.test(text));
