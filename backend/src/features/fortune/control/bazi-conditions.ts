import { baziInteractions, describeBaZiPillar, describeBaZiStem } from './bazi-calculation';

const positions = ['year', 'month', 'day', 'hour'] as const;
const stems = '甲乙丙丁戊己庚辛壬癸';
const tenGods = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
const unique = <T,>(values: T[]) => [...new Set(values)];
type Pillars = Record<typeof positions[number], string>;

// Observable structure only. Presence, roots and month qi do not establish a
// pattern, strength, usefulness, successful transformation or rescue.
export function baziNatalConditions(natal: Pillars, timeKnown: boolean) {
  const pillars = positions.filter(layer => layer !== 'hour' || timeKnown)
    .map(layer => ({ layer, ...describeBaZiPillar(natal[layer], natal.day[0]) }));
  const exposed = pillars.filter(pillar => pillar.layer !== 'day');
  const hidden = pillars.flatMap(pillar => pillar.hiddenStems);
  const presentTenGods = unique([...exposed.map(pillar => pillar.tenGod!), ...hidden.map(item => item.tenGod!)]);
  const stemConditions = [...stems].map(stem => {
    const detail = describeBaZiStem(stem, natal.day[0]);
    const exposurePositions = exposed.filter(pillar => pillar.stem === stem).map(pillar => pillar.layer);
    // This named policy counts same-element hidden stems, including residual qi.
    // It records a root, without asserting that its qi is strong or undamaged.
    const rootPositions = pillars.filter(pillar => pillar.hiddenStems.some(item => item.element === detail.stemElement))
      .map(pillar => pillar.layer);
    return { stem, tenGod: detail.tenGod!, exposed: exposurePositions.length ? true : timeKnown ? false : undefined,
      hidden: hidden.some(item => item.stem === stem) ? true : timeKnown ? false : undefined,
      rooted: rootPositions.length ? true : timeKnown ? false : undefined, exposurePositions, rootPositions };
  });
  return { dayMaster: natal.day[0], yearPillar: natal.year, monthPillar: natal.month, dayPillar: natal.day,
    ...(timeKnown ? { hourPillar: natal.hour, hourBranch: natal.hour[1] } : {}),
    yearBranch: natal.year[1], monthBranch: natal.month[1], dayBranch: natal.day[1], timeKnown,
    exposedStems: unique(exposed.map(pillar => pillar.stem)), hiddenStems: unique(hidden.map(item => item.stem)),
    exposedTenGods: unique(exposed.map(pillar => pillar.tenGod!)), hiddenTenGods: unique(hidden.map(item => item.tenGod!)),
    presentTenGods, absentTenGods: timeKnown ? tenGods.filter(god => !presentTenGods.includes(god)) : undefined,
    branches: pillars.map(pillar => pillar.branch),
    repeatedBranches: unique(pillars.filter(pillar => pillars.filter(other => other.branch === pillar.branch).length > 1).map(pillar => pillar.branch)),
    singleBranches: timeKnown ? pillars.filter(pillar => pillars.filter(other => other.branch === pillar.branch).length === 1).map(pillar => pillar.branch) : undefined,
    monthMainQi: pillars[1].hiddenStems[0]?.stem,
    monthMainQiTenGod: pillars[1].hiddenStems[0]?.tenGod,
    monthHiddenTenGods: pillars[1].hiddenStems.map(item => item.tenGod!),
    rootPolicy: 'same-element-hidden-qi-v1', stemConditions };
}

export function baziLuckConditions(pillar: string, dayMaster: string, natal: ReturnType<typeof baziNatalConditions>, annualPillar?: string) {
  const detail = describeBaZiPillar(pillar, dayMaster);
  const native = positions.flatMap(layer => {
    const value = natal[`${layer}Pillar`];
    return value ? [{ id: layer, pillar: value }] : [];
  });
  const pairs = (value: string) => baziInteractions([...native, { id: 'moving', pillar: value }]).pairs
    .filter(relation => relation.members.includes('moving'));
  const movingPairs = pairs(pillar);
  const movingGroups = baziInteractions([...native, { id: 'moving', pillar }]).groups
    .filter(relation => relation.byBranch.flat().includes('moving'));
  const locations = (relations: typeof movingPairs, kind: string) => relations.filter(relation => relation.kind === kind)
    .flatMap(relation => relation.members.filter(member => member !== 'moving'));
  const clashedNatalPositions = locations(movingPairs, '六冲');
  return { stem: detail.stem, branch: detail.branch, tenGod: detail.tenGod,
    hiddenTenGods: detail.hiddenStems.map(item => item.tenGod!), mainQiTenGod: detail.hiddenStems[0]?.tenGod,
    stemRootedInLuckBranch: detail.hiddenStems.some(item => item.element === detail.stemElement),
    stemRootedInNatal: natal.stemConditions.find(item => item.stem === detail.stem)?.rooted,
    revealsNatalHiddenStem: detail.stem !== dayMaster && natal.hiddenStems.includes(detail.stem) && !natal.exposedStems.includes(detail.stem)
      ? true : natal.timeKnown ? false : undefined,
    stemCombinesNatalPositions: locations(movingPairs, '天干五合'), clashedNatalPositions,
    annualJointClashPositions: annualPillar ? locations(pairs(annualPillar), '六冲').filter(layer => clashedNatalPositions.includes(layer)) : undefined,
    branchInteractionKinds: unique([...movingPairs.filter(relation => relation.kind !== '天干五合' && relation.kind !== '天干四冲').map(relation => relation.kind),
      ...movingGroups.map(relation => relation.kind)]),
    branchDirection: ['寅卯辰', '巳午未', '申酉戌', '亥子丑'].findIndex(group => group.includes(detail.branch)),
    rootPolicy: natal.rootPolicy };
}
