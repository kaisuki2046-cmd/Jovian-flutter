import { smthLuNextBranch } from './bazi-annual-luck';
import { baziColumnRoles, baziInteractions, baziStemControls, describeBaZiPillar, smthHeavenVirtue, smthHeavenVirtueStemRule, smthMoonVirtueRule } from './bazi-calculation';
import { baziNatalConditions } from './bazi-conditions';

const layers = ['year', 'month', 'day', 'hour'] as const;
const monthBranches = '寅卯辰巳午未申酉戌亥子丑';
type Natal = Record<typeof layers[number], string>;
type Luck = { status: 'confirmed'; pillar: string } | { status: 'before_luck' | 'unavailable' };

export const smthHourBladePolicy = {
  profile: 'smth-volume-five-hour-blade-v1', publishedHour: '乙卯',
  blade: 'jia-day-lu-next-branch-and-known-hour-branch',
  virtues: 'birth-month-stem-lists-with-separate-directional-readings',
} as const;

export function smthHourBlade(natal: Natal, year: string, luck: Luck) {
  const { profile, publishedHour } = smthHourBladePolicy;
  const dayMaster = natal.day[0];
  const yearBranch = year[1];
  const stage = luck.status === 'confirmed' ? { id: 'decadal', pillar: luck.pillar } : undefined;
  const luckBranch = stage?.pillar[1];
  const namedYearContact = year === '己酉' || ['亥', '未', '戌'].includes(yearBranch);
  const yearRepeatsBlade = year === '乙卯' || year === '丁卯';
  if (dayMaster !== '甲' || (!namedYearContact && !yearRepeatsBlade && (!luckBranch || !['酉', '亥', '未', '戌'].includes(luckBranch)))
    || natal.hour[1] !== smthLuNextBranch(dayMaster).bladeBranch) {
    return { profile, yearClashesHourBlade: false, yearHourBladeCombinationCandidate: false, verifiedSingleLayerContact: 'none',
      verifiedSamePillarBladeRepetition: false };
  }
  const native = layers.map(layer => ({ id: 'natal:' + layer, pillar: natal[layer] }));
  const activeYear = { id: 'flow:year', pillar: year };
  const blade = native.find(row => row.id === 'natal:hour')!;
  const hourContacts = (pairs: ReturnType<typeof baziInteractions>['pairs']) => pairs
    .filter(row => ['六合', '六冲'].includes(row.kind) && row.members.includes(blade.id));
  const natalRelationships = baziInteractions(native);
  const natalContacts = hourContacts(natalRelationships.pairs);
  const natalWoodGroup = natalRelationships.groups.find(row => row.values === '亥卯未' && row.byBranch[1].includes(blade.id))?.byBranch;
  const yearContacts = hourContacts(baziInteractions([blade, activeYear]).pairs);
  const yearClashesHourBlade = year === '己酉' && yearContacts.some(row => row.kind === '六冲');
  const yearSixCombination = yearContacts.find(row => row.kind === '六合');
  const yearHalfWoodContact = yearBranch === '亥' || yearBranch === '未' ? {
    members: [blade.id, 'flow:year'], kind: '半合', values: yearBranch === '亥' ? '亥卯' : '卯未',
  } : undefined;
  const yearWoodGroup = yearHalfWoodContact ? baziInteractions(stage ? [...native, activeYear, stage] : [...native, activeYear]).groups
    .find(row => row.values === '亥卯未' && row.byBranch[1].includes(blade.id)
      && row.byBranch.some(columns => columns.includes('flow:year')))?.byBranch : undefined;
  const yearHourBladeCombinationCandidate = Boolean(yearSixCombination || yearHalfWoodContact);
  const withLuck = stage ? baziInteractions([...native, stage]) : undefined;
  const luckContacts = withLuck && hourContacts(withLuck.pairs).filter(row => row.members.includes('decadal'));
  const luckHalfWoodContact = luckBranch === '亥' || luckBranch === '未' ? {
    members: [blade.id, 'decadal'], kind: '半合', values: luckBranch === '亥' ? '亥卯' : '卯未',
  } : undefined;
  const luckWoodGroup = withLuck?.groups.find(row => row.values === '亥卯未' && row.byBranch[1].includes(blade.id)
    && (row.byBranch[0].includes('decadal') || row.byBranch[2].includes('decadal')))?.byBranch;
  const repeated = luckContacts ? luckContacts.length > 0 || Boolean(luckHalfWoodContact)
    : luck.status === 'before_luck' ? false : undefined;

  const jiaShenException = natal.day === '甲申' && natal.hour === '丁卯';
  // 歲運併臨 requires the same full pillar, and 六甲真羊刃 names 乙卯 and 丁卯.
  const verifiedSamePillarBladeRepetition = luck.status === 'unavailable' ? undefined
    : natal.hour === '丁卯' && !jiaShenException && yearRepeatsBlade && stage?.pillar === year;
  const fullLuckContact = Boolean(luckContacts?.length || luckWoodGroup);
  const verifiedJiYouAndLuckContact = luck.status === 'unavailable' ? undefined
    : natal.hour === '丁卯' && !jiaShenException && yearClashesHourBlade && fullLuckContact;
  const yearWoodCompanion = yearBranch === '亥' ? yearWoodGroup?.[2] : yearWoodGroup?.[0];
  const annualCombination = yearSixCombination ? 'six-combination'
    : yearWoodCompanion?.some(column => column.startsWith('natal:')) ? 'wood-group' : undefined;
  const verifiedAnnualCombineAndLuckContact = natal.hour === '丁卯' && !jiaShenException && fullLuckContact
    ? annualCombination : undefined;
  let verifiedSingleLayerContact: 'none' | 'annual' | 'luck' = 'none';
  if (stage && natal.hour === '丁卯' && !jiaShenException && (natalContacts.length || natalWoodGroup)) {
    if ((yearClashesHourBlade || yearSixCombination || yearWoodGroup) && repeated === false) {
      verifiedSingleLayerContact = 'annual';
    } else if (yearBranch !== '酉' && !namedYearContact && fullLuckContact) {
      verifiedSingleLayerContact = 'luck';
    }
  }
  if (!namedYearContact && !yearRepeatsBlade && verifiedSingleLayerContact !== 'luck') {
    return { profile, yearClashesHourBlade, yearHourBladeCombinationCandidate, verifiedSingleLayerContact,
      verifiedSamePillarBladeRepetition: false };
  }
  const monthBranch = natal.month[1];
  const by = (index: number, value: string) => native.filter(row => row.pillar[index] === value).map(row => row.id);
  const { trigram: heavenTrigram, readings } = smthHeavenVirtue(monthBranch);
  const heavenVirtue = readings.map(row => ({ ...row, positions: by(row.basis === 'stem' ? 0 : 1, row.value) }));
  const moonVirtueRule = smthMoonVirtueRule(monthBranch)!;
  const moonVirtue = moonVirtueRule.stem;
  const pardonDay = ['戊寅', '甲午', '戊申', '甲子'][Math.floor(monthBranches.indexOf(monthBranch) / 3)];
  const dayRootPositions = baziNatalConditions(natal, true).stemConditions.find(row => row.stem === dayMaster)!.rootPositions;
  const details = native.map(row => ({ ...describeBaZiPillar(row.pillar, dayMaster), position: row.id }));
  const [, month, day, hour] = details;
  const directHeavenRule = smthHeavenVirtueStemRule(monthBranch);
  const dayVirtueWitness = directHeavenRule?.stem === day.stem && moonVirtue === day.stem
    && directHeavenRule.taboo === moonVirtueRule.taboo ? {
      monthBranch, dayPillar: day.pillar, hourPillar: hour.pillar, stem: day.stem, tabooStem: directHeavenRule.taboo,
      tabooPillars: [...native, activeYear, ...(stage ? [stage] : [])].filter(row => row.pillar[0] === directHeavenRule.taboo),
      hourObstructions: [
        ...natalRelationships.pairs.filter(row => row.members.includes(day.position) && row.members.includes(hour.position)
          && ['天干四冲', '六冲', '相刑', '六破'].includes(row.kind)).map(row => row.kind),
        ...natalRelationships.elemental.filter(row => row.from === day.position && row.to === hour.position && row.kind.includes('克'))
          .map(row => row.kind),
      ],
    } : undefined;
  const verifiedUnopposedDayVirtuesWithHourBlade = luck.status === 'unavailable' ? undefined : Boolean(dayVirtueWitness
    && !dayVirtueWitness.tabooPillars.length && !dayVirtueWitness.hourObstructions.length
    && (verifiedJiYouAndLuckContact || verifiedAnnualCombineAndLuckContact || verifiedSamePillarBladeRepetition));
  const seals = ['正印', '偏印'];
  const dayQiScreen = {
    dayPhase: day.phase,
    listedDepletedPhase: ['死', '绝', '衰', '病', '沐浴'].includes(day.phase ?? ''),
    monthPillar: month.pillar, monthPhase: month.phase, monthMainQi: month.hiddenStems[0],
    monthHiddenSupport: month.hiddenStems.filter(row => row.element === day.stemElement || seals.includes(row.tenGod ?? '')),
    exposedSeals: details.filter(row => seals.includes(row.tenGod ?? '')).map(({ position, pillar, stem, tenGod }) =>
      ({ position, pillar, stem, tenGod })),
    hiddenSeals: details.flatMap(({ position, pillar, hiddenStems }) => hiddenStems.filter(row => seals.includes(row.tenGod ?? ''))
      .map(row => ({ position, pillar, ...row }))),
  };
  const verifiedBladeContact = verifiedJiYouAndLuckContact === true || Boolean(verifiedAnnualCombineAndLuckContact)
    || verifiedSamePillarBladeRepetition === true || verifiedSingleLayerContact !== 'none';
  const hourPeer = hour.hiddenStems[0];
  const depletedDayBladeWithWealth = stage && verifiedBladeContact && dayQiScreen.listedDepletedPhase
    && month.stemElement !== day.stemElement && !dayQiScreen.monthHiddenSupport.length
    && !dayQiScreen.exposedSeals.length && !dayQiScreen.hiddenSeals.length
    && ![...baziColumnRoles('annual', year, dayMaster), ...baziColumnRoles('decadal', stage.pillar, dayMaster)]
      .some(row => seals.includes(row.god ?? '')) && hourPeer?.stem === '乙'
    ? layers.flatMap(column => baziColumnRoles(column, natal[column], dayMaster)).filter(row =>
      row.placement !== 'other_hidden' && ['正财', '偏财'].includes(row.god ?? '') && baziStemControls(hourPeer.stem, row.stem)) : [];
  const exceptionStemPair = jiaShenException ? {
    day: { position: day.position, pillar: day.pillar, ...day.hiddenStems.find(row => row.stem === '庚')! },
    hour: { position: hour.position, pillar: hour.pillar, ...hour.hiddenStems.find(row => row.stem === '乙')! },
    hourOutput: { position: hour.position, pillar: hour.pillar, stem: hour.stem, tenGod: hour.tenGod },
  } : undefined;

  return { profile, publishedHour, dayMaster, natalDay: natal.day, actualHour: blade.pillar, year, monthBranch,
    yearClashesHourBlade, yearHourBladeCombinationCandidate, yearSixCombination, yearHalfWoodContact, yearWoodGroup,
    yearRepeatsBlade, verifiedSamePillarBladeRepetition,
    jiaShenException, exceptionStemPair, dayQiScreen, exceptionWealthPositions: jiaShenException
      ? native.filter(row => '戊己'.includes(row.pillar[0])).map(row => row.id) : undefined,
    natalContacts, natalWoodGroup, luckStatus: luck.status, luckPillar: stage?.pillar, luckContacts, luckHalfWoodContact,
    luckWoodGroup, repeated, verifiedJiYouAndLuckContact, verifiedAnnualCombineAndLuckContact, verifiedSingleLayerContact,
    dayRootPositions, heavenTrigram, heavenVirtue, moonVirtue, moonVirtuePositions: by(0, moonVirtue),
    dayVirtueWitness, verifiedUnopposedDayVirtuesWithHourBlade, depletedDayBladeWealthTargets: depletedDayBladeWithWealth,
    verifiedDepletedDayBladeWithWealth: stage ? depletedDayBladeWithWealth.length > 0 : undefined,
    pardonDay, pardonDayObserved: natal.day === pardonDay };
}
