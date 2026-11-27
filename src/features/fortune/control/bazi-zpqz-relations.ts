import { baziInteractions, baziStemControls, baziStemFeeds, describeBaZiPillar, describeBaZiStem } from './bazi-calculation';
import { baziZpqzLuckContext } from './bazi-zpqz';
import { baziZpqzStemBranch, zpqzStemBranchPolicy } from './bazi-zpqz-stem-branch';
import { lunarAtBeijing } from './fortune-calendar';

const positions = ['year', 'month', 'day', 'hour'] as const;
type Natal = Record<typeof positions[number], string> & { utc?: string };
const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
const classes = [{ kind: '四生', values: '寅申巳亥' }, { kind: '四正', values: '子午卯酉' }, { kind: '四库', values: '辰戌丑未' }];
const directions = [{ name: '东方', values: '寅卯辰', element: '木' }, { name: '南方', values: '巳午未', element: '火' },
  { name: '西方', values: '申酉戌', element: '金' }, { name: '北方', values: '亥子丑', element: '水' }];
const printedDirectionExamples = [
  { label: '原文干支同类对照', pillars: ['庚申', '辛酉', '甲寅', '乙卯'] },
  { label: '原文木火同气对照', pillars: ['甲午', '乙未', '丙寅', '丁卯'] },
  { label: '原文金水同气对照', pillars: ['庚子', '辛丑', '壬申', '癸酉'] },
  { label: '原文运干本支无根例', pillars: ['丙子', '丙申', '庚寅', '辛卯'] },
];
const clash = (a: string, b: string) => branches.indexOf(a) >= 0 && (branches.indexOf(a) + 6) % 12 === branches.indexOf(b);
const unique = <T,>(items: T[]) => [...new Set(items)];
const dayMs = 86_400_000;
export const zpqzMovingPolicy = {
  profile: 'zpqz-moving-root-clash-atomic-v1',
  source: 'zpqz-1936-interpretation-p002,p024,p032-p042,p046-p053',
  stemBranch: zpqzStemBranchPolicy,
  quantities: 'natal-column-multiplicity; unknown-hour-not-zero',
  links: 'same-candidate-same-luck-stage-same-annual-fragment',
  root: 'same-element-hidden-qi-with-exact-stem-separated; not-effective-strength',
  sourceRelations: 'witnesses-not-resolved-clash-combination-transformation-or-usefulness',
} as const;

export function zpqzChenBirthTiming(utc: string) {
  const birthAt = Date.parse(utc);
  if (!Number.isSafeInteger(birthAt)) return undefined;
  const lunar = lunarAtBeijing(birthAt);
  const previous = lunar.getPrevJie();
  if (lunar.getMonthInGanZhiExact()[1] !== '辰' || !previous) return undefined;
  const start = Date.parse(previous.getSolar().toYmdHms().replace(' ', 'T') + '+08:00');
  if (!Number.isSafeInteger(start) || start > birthAt) return undefined;
  const elapsed = birthAt - start;
  const elapsedDay = Math.floor(elapsed / dayMs) + 1;
  const tableDutyStem = elapsedDay <= 9 ? '乙' : elapsedDay <= 12 ? '癸' : elapsedDay <= 30 ? '戊' : undefined;
  return { qingmingAt: new Date(start).toISOString(), elapsedDay, tableDutyStem,
    tableYiOnDuty: tableDutyStem === '乙', proseYiOnDuty: elapsedDay <= 12 };
}

export function baziZpqzMovingRelations(natal: Natal, timeKnown: boolean, luckPillar: string, annualPillar: string) {
  const context = baziZpqzLuckContext(natal, timeKnown, luckPillar);
  const native = positions.filter(position => position !== 'hour' || timeKnown)
    .map(position => ({ position: position as string, ...describeBaZiPillar(natal[position], natal.day[0]) }));
  const luck = { position: 'decadal', ...describeBaZiPillar(luckPillar, natal.day[0]) };
  const annual = { position: 'annual', ...describeBaZiPillar(annualPillar, natal.day[0]) };
  const witness = (row: typeof luck) => ({ position: row.position, pillar: row.pillar, stem: row.stem, branch: row.branch });
  const hiddenRoles = (row: typeof luck, stems: string[]) => row.hiddenStems.flatMap((hidden, index) =>
    stems.includes(hidden.stem) ? [{ stem: hidden.stem, tenGod: hidden.tenGod, mainQi: index === 0 }] : []);
  const hiddenWitness = (row: typeof luck, stem: string) => {
    const hidden = row.hiddenStems.find(value => value.stem === stem);
    return hidden ? { ...witness(row), stem: hidden.stem, tenGod: hidden.tenGod } : undefined;
  };
  const count = (branch: string) => ({ branch, positions: native.filter(row => row.branch === branch).map(row => row.position),
    knownCount: native.filter(row => row.branch === branch).length,
    totalCount: timeKnown ? native.filter(row => row.branch === branch).length : undefined });
  const branchCounts = branches.map(count);
  const shen = count('申'), yin = count('寅');
  const exactTwoShenOneYin = timeKnown ? shen.totalCount === 2 && yin.totalCount === 1 : undefined;
  const rooted = (stem: string, rows: typeof native) => {
    const element = describeBaZiStem(stem, natal.day[0]).stemElement;
    return rows.flatMap(row => row.hiddenStems.some(hidden => hidden.element === element) ? [{
      ...witness(row), exactStem: row.hiddenStems.some(hidden => hidden.stem === stem),
      hiddenStems: row.hiddenStems.filter(hidden => hidden.element === element).map(hidden => hidden.stem),
    }] : []);
  };
  const movingClashes = native.filter(row => clash(luck.branch, row.branch)).map(row => ({
    natal: witness(row), luck: witness(luck), annual: clash(annual.branch, row.branch) ? witness(annual) : undefined,
    annualAlsoClashes: clash(annual.branch, row.branch), isMonthCommand: row.position === 'month',
    textUrgency: ['year', 'month'].includes(row.position) ? '急' : '缓',
    sourceLayer: 'branch' as const, branchClass: classes.find(group => group.values.includes(row.branch))!.kind,
    luckBranchClass: classes.find(group => group.values.includes(luck.branch))!.kind,
  }));
  const annualJointClashTargets = movingClashes.filter(row => row.annualAlsoClashes).map(row => row.natal.position);
  // The reviewer chose wealth for Zhang's chart and named this favorable part of its luck sequence.
  const isZhangChart = timeKnown && positions.map(position => natal[position]).join('') === '丙寅戊戌辛酉戊子';
  const hasZhangReviewedWealthMonthClash = timeKnown ? isZhangChart
    && luck.pillar === '甲辰' && annualJointClashTargets.includes('month') : undefined;
  const hasZhangReviewedWealthDayClash = timeKnown ? isZhangChart && luck.pillar === '癸卯'
    && luck.hiddenStems[0]?.stem === '乙' && baziStemControls('乙', native[1].stem)
    && annualJointClashTargets.includes('day') : undefined;
  const nativeClashes = baziInteractions(native.map(row => ({ id: row.position, pillar: row.pillar }))).pairs
    .filter(pair => pair.kind === '六冲').map(pair => ({ kind: pair.kind,
      members: pair.members.map(position => witness(native.find(row => row.position === position)!)) }));
  const groupMembers = (values: string) => [...values].map(branch => ({ branch,
    natalPositions: native.filter(row => row.branch === branch).map(row => row.position), luckPresent: luck.branch === branch }));
  const groups = ['巳酉丑', '亥卯未', '申子辰', '寅午戌'].map(values => {
    const members = groupMembers(values), missing = members.filter(row => !row.natalPositions.length && !row.luckPresent).map(row => row.branch);
    const natalComplete = members.every(row => row.natalPositions.length);
    return { values, members, natalComplete: natalComplete ? true : timeKnown ? false : undefined,
      completeWithLuck: !missing.length ? true : timeKnown ? false : undefined,
      missingInKnownPositions: missing, completedByLuck: !missing.length && !natalComplete ? timeKnown ? true : undefined : false };
  });
  // Four edges are possible when two natal Shen face a natal Yin and the
  // moving Yin. Enumerate the TWO bijections; don't silently choose a unique
  // pairing or count all four edges as four independent original examples.
  const natalShens = native.filter(row => row.branch === '申');
  const natalYin = native.find(row => row.branch === '寅');
  const twoClashPairings = exactTwoShenOneYin && natalYin && luck.branch === '寅' ? [0, 1].map(index => {
    const yins = [natalYin, luck];
    return { pairs: natalShens.map((row, i) => ({
      shen: witness(row), yin: witness(yins[(i + index) % 2]),
    })) };
  }) : [];
  const nonDay = native.filter(row => row.position !== 'day');
  const natalYinJia = exactTwoShenOneYin && natalYin ? hiddenWitness(natalYin, '甲') : undefined;
  const luckYinJia = exactTwoShenOneYin && luck.branch === '寅' ? hiddenWitness(luck, '甲') : undefined;
  const nativeGeng = natalYinJia ? natalShens.flatMap(row => {
    const hiddenGeng = hiddenWitness(row, '庚');
    return hiddenGeng && baziStemControls(hiddenGeng.stem, natalYinJia.stem) ? [hiddenGeng] : [];
  }) : [];
  const shenYinClashComparison = natalYinJia && nativeGeng.length === 2 ? {
    natalYinJia, luckYinJia, nativeGeng,
    onlyAnnualYin: !luckYinJia && annual.branch === '寅' ? witness(annual) : undefined,
  } : undefined;
  const hasShenYinClashPairings = Boolean(shenYinClashComparison && luckYinJia && twoClashPairings.length === 2
    && nativeGeng.every(row => baziStemControls(row.stem, luckYinJia.stem)));
  const shenYinOfficerContext = natal.day[0] === '乙' && shenYinClashComparison ? {
    natalYinJia, luckYinJia, nativeOfficerGeng: nativeGeng,
    exposedOfficers: nonDay.filter(row => row.stem === '庚').map(witness),
    betweenOfficers: native.slice(native.indexOf(natalShens[0]) + 1, native.indexOf(natalShens[1])).map(witness),
    onlyAnnualYin: shenYinClashComparison.onlyAnnualYin,
  } : undefined;
  const hasShenYinOfficerPairings = Boolean(shenYinOfficerContext && hasShenYinClashPairings);
  // 卷四所载康例另以本命年午与运午分冲日时两子，幅度不按四条边累计。
  const kangMovingClashes = timeKnown && luck.pillar === '戊午' && context.kangExposureContext
    ? movingClashes.filter(row => row.natal.position === 'day' || row.natal.position === 'hour') : [];
  const kangNatalClashes = kangMovingClashes.length === 2 ? nativeClashes.filter(row => row.members[0].position === 'year'
    && kangMovingClashes.some(arrival => arrival.natal.position === row.members[1].position)) : [];
  const kangDoubleClash = kangNatalClashes.length === 2 && context.kangExposureContext ? {
    killer: context.kangExposureContext.natalKiller,
    natalClashes: kangNatalClashes,
    movingClashes: kangMovingClashes,
    alternativePairings: kangNatalClashes.map(({ members: [wu, zi] }) => [
      { wu, zi },
      ...kangMovingClashes.filter(row => row.natal.position !== zi.position).map(row => ({ wu: row.luck, zi: row.natal })),
    ]),
  } : undefined;
  const ren = nonDay.filter(row => row.stem === '壬').map(witness);
  const stemSubstituteMeeting = (rows: typeof native, branches: string, center: string, stems: string) => {
    const outside = [...branches].filter(branch => branch !== center);
    if (rows.some(row => row.branch === center) || !outside.every(branch => rows.some(row => row.branch === branch))) return undefined;
    if (![...stems].every(stem => nonDay.some(row => row.stem === stem))) return undefined;
    return { branches, center, outerMembers: rows.filter(row => outside.includes(row.branch)).map(witness),
      exposedStems: nonDay.filter(row => stems.includes(row.stem)).map(witness) };
  };
  const renNativeRoots = rooted('壬', native);
  const renLuckRoots = rooted('壬', [luck]);
  const renRootsConfinedToChen = timeKnown ? renNativeRoots.length > 0 && renNativeRoots.every(row => row.branch === '辰') : undefined;
  const monthRenRoot = renNativeRoots.find(row => row.position === 'month');
  const incomingRenRoot = renLuckRoots[0];
  const renRootDetail = (pillar: typeof luck, root: (typeof renNativeRoots)[number]) => ({
    ...root, renPhase: describeBaZiPillar(root.pillar, '壬').phase, hiddenRoles: hiddenRoles(pillar, root.hiddenStems),
  });
  const dingChenOfficerRootArrival = renRootsConfinedToChen && natal.day[0] === '丁' && ren.length
    && monthRenRoot?.branch === '辰' && incomingRenRoot && ['申', '子'].includes(luck.branch) ? {
      natal: renRootDetail(native[1], monthRenRoot), arriving: renRootDetail(luck, incomingRenRoot),
      incomingClashes: movingClashes.map(row => row.natal),
    } : undefined;
  const outsideChenRoots = renNativeRoots.filter(row => row.branch !== '辰');
  const outsideChenRoot = outsideChenRoots.length === 1 ? outsideChenRoots[0] : undefined;
  const shenColumn = outsideChenRoot?.branch === '申' && outsideChenRoot.exactStem
    ? native.find(row => row.position === outsideChenRoot.position) : undefined;
  const dingChenZiRootComparison = timeKnown && natal.day[0] === '丁' && ren.length && monthRenRoot?.branch === '辰'
    && shenColumn && outsideChenRoot && incomingRenRoot && luck.branch === '子' && luck.hiddenStems[0]?.stem === '癸' ? {
      natal: renRootDetail(native[1], monthRenRoot), originalShen: renRootDetail(shenColumn, outsideChenRoot),
      arriving: renRootDetail(luck, incomingRenRoot),
      annualClash: clash(annual.branch, shenColumn.branch) ? witness(annual) : undefined,
      incomingClashes: movingClashes.map(row => row.natal),
    } : undefined;
  const ziColumn = outsideChenRoot?.branch === '子' && outsideChenRoot.hiddenStems.includes('癸')
    ? native.find(row => row.position === outsideChenRoot.position) : undefined;
  const dingChenShenRootComparison = timeKnown && natal.day[0] === '丁' && ren.length && monthRenRoot?.branch === '辰'
    && ziColumn && outsideChenRoot && incomingRenRoot?.exactStem && luck.branch === '申' ? {
      natal: renRootDetail(native[1], monthRenRoot), originalZi: renRootDetail(ziColumn, outsideChenRoot),
      arriving: renRootDetail(luck, incomingRenRoot),
      annualClash: clash(annual.branch, ziColumn.branch) ? witness(annual) : undefined,
      incomingClashes: movingClashes.map(row => row.natal),
    } : undefined;
  const haiColumn = outsideChenRoot?.branch === '亥' && outsideChenRoot.exactStem
    ? native.find(row => row.position === outsideChenRoot.position) : undefined;
  const dingChenHaiRootComparison = timeKnown && natal.day[0] === '丁' && ren.length && monthRenRoot?.branch === '辰'
    && haiColumn && outsideChenRoot && incomingRenRoot && luck.branch === '子' && luck.hiddenStems[0]?.stem === '癸' ? {
      natal: renRootDetail(native[1], monthRenRoot), originalHai: renRootDetail(haiColumn, outsideChenRoot),
      arriving: renRootDetail(luck, incomingRenRoot), annualClash: clash(annual.branch, haiColumn.branch) ? witness(annual) : undefined,
      incomingClashes: movingClashes.map(row => row.natal),
    } : undefined;
  // 卷四分四生冲与四正随局。排查申长生根受原局或当岁寅冲且未见同段会合。
  const checkShenRootClash = dingChenOfficerRootArrival && luck.branch === '申' && movingClashes.length <= 1;
  const shenRootClash = checkShenRootClash ? movingClashes[0] : undefined;
  const annualShenRootClash = checkShenRootClash && clash(annual.branch, luck.branch)
    ? { annual: witness(annual), luck: witness(luck) } : undefined;
  const activeRootColumns = shenRootClash || annualShenRootClash ? [...native, luck, annual] : [];
  const rootRelations = activeRootColumns.length ? baziInteractions(activeRootColumns.map(row => ({ id: row.position, pillar: row.pillar }))) : undefined;
  const isShenClashEnd = (position: string) => position === 'decadal' || position === shenRootClash?.natal.position
    || (position === 'annual' && annualShenRootClash !== undefined);
  const shenRootOpposition = rootRelations ? {
    clash: shenRootClash,
    annualClash: annualShenRootClash,
    combinations: rootRelations.pairs.filter(pair => pair.kind === '六合' && pair.members.some(isShenClashEnd)),
    meetings: rootRelations.groups.filter(group => group.byBranch.some(members => members.some(isShenClashEnd))),
    middleBranches: activeRootColumns.filter(row => row.branch === '午' || row.branch === '子').map(witness),
    stemSubstituteMeeting: stemSubstituteMeeting(activeRootColumns, '申子辰', '子', '壬癸'),
  } : undefined;
  const water = groups.find(row => row.values === '申子辰')!;
  const waterNativeAssociates = unique(water.members.filter(row => row.branch !== '辰' && row.natalPositions.length).map(row => row.branch));
  const waterHidden = context.hiddenActivations.filter(row => ['壬', '癸'].includes(row.stem));
  const waterGroupHidden = waterHidden.filter(row => ['申', '子', '辰'].includes(row.branch));
  const waterSealExposures = waterGroupHidden.filter(row => row.luckStemSame);
  const newWaterSealExposure = timeKnown ? waterSealExposures.some(row => row.newlyExposedByLuck === true) : undefined;
  const yiChenSealCase = timeKnown && natal.day[0] === '乙' && natal.month[1] === '辰' && waterNativeAssociates.length > 0;
  const waterSealExposureRoute = yiChenSealCase && newWaterSealExposure ? luck.stem === '壬' ? 'ren-from-shen' : 'gui-from-zi-chen' : 'none';
  const sealQi = ({ position, pillar, stem, tenGod }: typeof waterGroupHidden[number]) => ({ position, pillar, stem, tenGod,
    mainQi: native.find(row => row.position === position)?.hiddenStems[0]?.stem === stem });
  const yiChenVisibleSeals = yiChenSealCase ? nonDay.filter(row => ['壬', '癸'].includes(row.stem))
    .map(row => ({ ...witness(row), tenGod: row.tenGod })) : [];
  const sealKinds = (rows: Array<{ tenGod?: string }>) => ['正印', '偏印'].filter(kind => rows.some(row => row.tenGod === kind));
  const yiChenNativeSeals = yiChenSealCase ? {
    group: waterGroupHidden.map(sealQi),
    outsideGroup: waterHidden.filter(row => !['申', '子', '辰'].includes(row.branch)).map(sealQi),
    visible: yiChenVisibleSeals,
    nativeWaterGroup: { complete: water.natalComplete, members: water.members.map(({ branch, natalPositions }) => ({ branch, natalPositions })),
      missingBranches: water.members.filter(row => !row.natalPositions.length).map(row => row.branch) },
    groupKinds: sealKinds(waterGroupHidden), natalKinds: sealKinds([...waterHidden, ...yiChenVisibleSeals]),
    newExposure: newWaterSealExposure ? { incoming: { ...witness(luck), tenGod: luck.tenGod },
      sourceColumns: waterSealExposures.filter(row => row.newlyExposedByLuck === true).map(sealQi),
      otherExposed: yiChenVisibleSeals.filter(row => row.stem !== luck.stem) } : undefined,
  } : undefined;
  const waterSealPromotionReady = timeKnown ? Boolean(yiChenNativeSeals?.newExposure && yiChenNativeSeals.natalKinds.length === 2) : undefined;
  const youExample = {
    natalJia: natal.day[0] === '甲', natalYouPositions: count('酉').positions, movingMao: luck.branch === '卯',
    natalSiPositions: count('巳').positions, natalChouPositions: count('丑').positions,
    natalHaiPositions: count('亥').positions, natalWeiPositions: count('未').positions,
    natalChenPositions: count('辰').positions, natalXuPositions: count('戌').positions,
  };
  const checksYouRelief = timeKnown && youExample.natalJia && natal.month[1] === '酉' && youExample.movingMao;
  const clashingYou = checksYouRelief ? movingClashes.filter(row => row.natal.branch === '酉').map(row => row.natal) : [];
  // The cited chapter leaves the clash active when another group takes the
  // same 六合 partner. Record complete natal competition and annual additions
  // independently so an annual branch cannot stand in for a natal member.
  const youLiuheRoutes = checksYouRelief ? [
    { positions: youExample.natalChenPositions, partner: '辰', rivalValues: '申子辰', center: '子', rivalStems: '壬癸', lu: '亥' },
    { positions: youExample.natalXuPositions, partner: '戌', rivalValues: '寅午戌', center: '午', rivalStems: '丙丁', lu: '巳' },
  ].flatMap(({ positions, partner, rivalValues, center, rivalStems, lu }) => {
    if (!positions.length) return [];
    const rival = groups.find(row => row.values === rivalValues)!;
    const missing = rival.members.filter(row => !row.natalPositions.length);
    const luMembers = native.filter(row => row.branch === lu).map(witness);
    const natalRivalLuMeeting = missing.length === 1 && missing[0].branch === center && luMembers.length ? {
      branches: rivalValues, center, outerMembers: native.filter(row => row.branch !== center && rivalValues.includes(row.branch)).map(witness),
      luMembers,
    } : undefined;
    // The Zhao diagram illustrates how one Chen joining one of two You can restore the Mao–You clash.
    const sharedChenClash = partner === '辰' && positions.length === 1 && clashingYou.length === 2
      ? { partner: witness(native.find(row => row.position === positions[0])!), targets: clashingYou }
      : undefined;
    return [{ partner, positions, rivalValues, rivalMembers: rival.members, natalRivalComplete: rival.natalComplete === true,
      natalRivalHalf: missing.length === 1 && rival.members.some(row => row.branch === center && row.natalPositions.length > 0),
      natalRivalStemMeeting: stemSubstituteMeeting(native, rivalValues, center, rivalStems),
      natalRivalLuMeeting,
      annualCompletesRival: missing.length === 1 && missing[0].branch === annual.branch,
      natalPartnerClashes: nativeClashes.filter(pair => pair.members.some(row => positions.includes(row.position))),
      annualPartnerClashes: native.filter(row => positions.includes(row.position) && clash(annual.branch, row.branch)).map(witness),
      sharedChenClash,
    }];
  }) : undefined;
  const youClashReliefRoutes: string[] = [];
  if (youLiuheRoutes) {
    if (youExample.natalSiPositions.length) youClashReliefRoutes.push('si-you');
    if (youExample.natalHaiPositions.length || youExample.natalWeiPositions.length) youClashReliefRoutes.push('mao-wood');
    for (const route of youLiuheRoutes) {
      if (!route.natalRivalComplete && !route.sharedChenClash) youClashReliefRoutes.push(route.partner === '辰' ? 'chen-you' : 'mao-xu');
    }
  }
  const youSourceRelief = checksYouRelief ? {
    month: witness(native[1]),
    luck: witness(luck),
    nativeSi: native.filter(row => row.branch === '巳').map(witness),
    nativeChou: native.filter(row => row.branch === '丑').map(witness),
    textYearWood: ['亥', '未'].includes(native[0].branch) ? witness(native[0]) : undefined,
    annotatedNativeWood: native.filter(row => ['亥', '未'].includes(row.branch)).map(witness),
  } : undefined;
  // The cited clash chapter distinguishes the isolated Si–You pair separated by Yin.
  const youSiMeetingSeparatedByYin = youSourceRelief?.nativeSi.length === 1 && !youSourceRelief.nativeChou.length
      && native[2].branch === '寅' && native[3].branch === '巳'
    ? { month: youSourceRelief.month, intervening: witness(native[2]), si: youSourceRelief.nativeSi[0] }
    : undefined;
  const annotatedWoodGroup = youSourceRelief && groups.find(row => row.values === '亥卯未')!;
  const nativeHalfMeetingPartner = annotatedWoodGroup?.missingInKnownPositions.length === 1
    ? youSourceRelief?.annotatedNativeWood[0]?.branch : undefined;
  const youSourceReliefRoutes = youSourceRelief ? [
    youSourceRelief.nativeSi.length > 0 && 'natal-si-you',
    youSourceRelief.nativeSi.length > 0 && youSourceRelief.nativeChou.length > 0 && 'natal-si-you-chou',
    youSourceRelief.textYearWood && 'year-hai-wei-meets-luck',
    annotatedWoodGroup?.completeWithLuck && 'hai-mao-wei-in-natal-and-luck',
    annotatedWoodGroup?.missingInKnownPositions.length === 1 && annotatedWoodGroup.missingInKnownPositions[0] === annual.branch
      && 'hai-mao-wei-annual-supplement',
  ].filter(route => typeof route === 'string') : [];
  const noOtherYouMeetingClash = (branches: string) => {
    const members = native.filter(row => branches.includes(row.branch));
    const positions = new Set(members.map(row => row.position));
    return !nativeClashes.some(pair => pair.members.some(row => positions.has(row.position)))
      && !members.some(row => clash(annual.branch, row.branch)) && !clash(annual.branch, luck.branch);
  };
  const youSourceMeetingRoutes = timeKnown ? youSourceRelief && clashingYou.length === 1 ? [
    youSourceRelief.nativeSi.length > 0 && youSourceRelief.nativeChou.length > 0
      && noOtherYouMeetingClash('巳酉丑') && 'natal-si-you-chou',
    youSourceRelief.nativeSi.length === 1 && !youSourceRelief.nativeChou.length && annual.branch !== '丑'
      && !youSiMeetingSeparatedByYin && noOtherYouMeetingClash('巳酉') && 'natal-si-with-month-you',
    annotatedWoodGroup?.completedByLuck && noOtherYouMeetingClash('亥未酉') && 'luck-hai-mao-wei',
    nativeHalfMeetingPartner === '亥' && noOtherYouMeetingClash('亥未酉') && 'luck-mao-with-natal-hai',
    nativeHalfMeetingPartner === '未' && noOtherYouMeetingClash('亥未酉') && 'luck-mao-with-natal-wei',
  ].filter(route => typeof route === 'string') : [] : undefined;
  const youSourceLiuheRoutes = timeKnown ? (youLiuheRoutes ?? []).flatMap(route => {
    const [partnerPosition] = route.positions;
    const partner = route.partner;
    if (clashingYou.length !== 1 || route.positions.length !== 1 || route.natalRivalComplete || route.natalRivalHalf
      || route.natalRivalStemMeeting || route.natalRivalLuMeeting
      || (route.rivalValues + '卯酉').includes(annual.branch) || !noOtherYouMeetingClash('酉' + partner)) return [];
    // The Chen and You are both natal placements. Accept the two adjacent
    // columns beside the month. The incoming luck branch has no natal column.
    if (partner === '辰') return ['year', 'day'].includes(partnerPosition) ? ['chen-you'] : [];
    return ['mao-xu'];
  }) : undefined;
  const luckStemNativeRoots = rooted(luck.stem, native), luckStemOwnRoots = rooted(luck.stem, [luck]);
  const stemBranch = baziZpqzStemBranch(natal, timeKnown, luckPillar);
  const movingStemClashes = stemBranch.branchRelations.filter(pair => pair.kind === '天干四冲'
    && pair.members.some(row => row.position === 'decadal')).map(pair => ({
    natal: witness(native.find(row => pair.members.some(member => member.position === row.position))!),
    luck: witness(luck), sourceLayer: 'stem' as const,
  }));
  const annualClashesAt = (targetPositions: string[]) => targetPositions.flatMap(position => {
    const target = position === 'decadal' ? luck : native.find(row => row.position === position);
    return target && clash(annual.branch, target.branch) ? [{ target: witness(target), annual: witness(annual) }] : [];
  });
  const annualFireMeetingClashes = annualClashesAt([...new Set(stemBranch.fireMeetingPaths
    .flatMap(path => [path.wuFire.position, path.root.position, 'decadal']))]);
  const fireMeetingPaths = stemBranch.fireMeetingPaths.map(path => ({
    ...path, annualClashes: annualFireMeetingClashes.filter(({ target }) =>
      [path.root.position, path.wuFire.position, 'decadal'].includes(target.position)),
  }));
  const { dingYouSiWealth, dingYouZiChain } = stemBranch;
  const groupWitnesses = (values: string) => {
    const group = groups.find(row => row.values === values)!;
    const members = [...native, luck].filter(row => values.includes(row.branch));
    const hasMember = (position: string) => members.some(row => row.position === position);
    const competingClashes = [
      ...nativeClashes.filter(row => row.members.some(member => hasMember(member.position))),
      ...movingClashes.filter(row => hasMember('decadal') || hasMember(row.natal.position))
        .map(row => ({ kind: '六冲', members: [row.natal, row.luck] })),
    ];
    const missingBranches = group.missingInKnownPositions;
    return { values, members: members.map(witness), natalComplete: group.natalComplete,
      completedByLuck: group.completedByLuck, missingBranches, competingClashes,
      annualClashes: annualClashesAt(members.map(row => row.position)),
      annualMissingMember: timeKnown && missingBranches.length === 1 && missingBranches[0] === annual.branch
        ? witness(annual) : undefined,
    };
  };
  const fireMeetingGroupWitnesses = stemBranch.fireMeetingPaths.length ? groupWitnesses('寅午戌') : undefined;
  const fireMeetingStatus = fireMeetingGroupWitnesses && (
    fireMeetingGroupWitnesses.natalComplete ? 'natal-complete'
    : fireMeetingGroupWitnesses.completedByLuck ? 'luck-completes'
    : fireMeetingGroupWitnesses.annualMissingMember ? 'annual-supplement'
    : 'incomplete'
  );
  const fireMeetingSourcePaths = fireMeetingStatus === 'luck-completes' ? fireMeetingPaths.flatMap(path => {
    const partnerBranch = luck.branch === '寅' ? '戌' : '寅';
    const wuIndex = native.findIndex(row => row.position === path.wuFire.position);
    return native.flatMap((partner, index) => {
      if (partner.branch !== partnerBranch) return [];
      const yinPosition = luck.branch === '寅' ? 'decadal' : partner.position;
      const selected = new Set([path.target.position, path.root.position, path.wuFire.position, partner.position, 'decadal']);
      const competingClashes = stemBranch.branchRelations.filter(pair => pair.kind === '六冲'
        && pair.members.some(row => selected.has(row.position)));
      const shenRootClash = path.root.branch === '申' ? competingClashes.find(pair =>
        pair.members.some(row => row.position === path.root.position)
        && pair.members.some(row => row.position === yinPosition)) : undefined;
      return [{ target: path.target, root: path.root, wuFire: path.wuFire, partner: witness(partner), movingFire: path.movingFire,
        betweenStemAndWu: path.betweenStemAndWu, betweenRootAndWu: path.betweenRootAndWu,
        betweenWuAndPartner: native.slice(Math.min(wuIndex, index) + 1, Math.max(wuIndex, index)).map(witness),
        competingClashes, annualClashes: annualClashesAt([...selected]), shenRootClash,
        shenRootClashSource: shenRootClash ? yinPosition === 'decadal' ? 'luck-yin' : 'natal-yin' : undefined }];
    });
  }) : [];
  const fireMeetingUnopposedXin = timeKnown ? fireMeetingSourcePaths.some(path => path.target.stem === '辛'
    && path.betweenStemAndWu.length <= 1 && path.betweenRootAndWu.length <= 1 && path.betweenWuAndPartner.length <= 1
    && !path.competingClashes.length && !path.annualClashes.length) : undefined;
  const fireMeetingWithMonthlyGeng = timeKnown ? fireMeetingSourcePaths.some(path => path.target.stem === '庚'
    && path.root.position === 'month' && path.shenRootClash !== undefined
    && path.competingClashes.length === 1 && !path.annualClashes.length
    && path.betweenStemAndWu.length <= 1 && path.betweenRootAndWu.length <= 1 && path.betweenWuAndPartner.length <= 1) : undefined;
  // Judge the natal and luck pair on its own layers even when the annual branch supplies the third seat.
  const unopposedFireHalfPaths = fireMeetingGroupWitnesses?.missingBranches.length === 1
    && !native.some(row => row.branch === luck.branch)
    ? fireMeetingPaths.filter(path => {
      const positions = [path.target.position, path.root.position, path.wuFire.position, 'decadal'];
      return path.betweenStemAndWu.length <= 1 && path.betweenRootAndWu.length <= 1
        && !stemBranch.branchRelations.some(pair => pair.kind === '六冲' && pair.members.some(row => positions.includes(row.position)))
        && !annualClashesAt(positions).length;
    }) : [];
  const fireHalfMeetingTargetStems = [...new Set(unopposedFireHalfPaths.filter(path => path.root.position === 'month')
    .map(path => path.target.stem))];
  const fireHalfYearXinSamePillar = timeKnown ? unopposedFireHalfPaths.some(path =>
    path.target.stem === '辛' && path.target.position === 'year' && path.root.position === 'year') : undefined;
  const fireMeetingMonthShenClashes = [...new Set(fireMeetingSourcePaths.filter(path => path.root.position === 'month')
    .flatMap(path => path.shenRootClashSource ? [path.shenRootClashSource] : []))];
  const direction = directions.find(row => row.values.includes(luck.branch))!;
  const printedDirectionExample = printedDirectionExamples.find(row => row.pillars.includes(luckPillar))?.label;
  const directionRootContext = timeKnown && (!luckStemOwnRoots.length || printedDirectionExample) ? {
    example: printedDirectionExample,
    stemElement: luck.stemElement, branchMainQi: luck.hiddenStems[0],
    branchFeedsStem: stemBranch.luckPillarElementLinks.filter(row => row.from.kind === '运支藏干' && row.relation === '生').map(row => row.from),
    stemFeedsBranch: stemBranch.luckPillarElementLinks.filter(row => row.to.kind === '运支藏干' && row.relation === '生').map(row => row.to),
    natalSources: stemBranch.natalComponentContacts.filter(row => row.to.kind === '运干' && row.relation === '生').map(row => row.from),
    natalDayFeedsStem: baziStemFeeds(natal.day[0], luck.stem),
  } : undefined;
  const renHaiOfficer = context.renHaiOfficerContext;
  const returnOutput = renHaiOfficer?.woodContacts.find(row => row.position === 'decadal');
  const renHaiReturnContacts = renHaiOfficer && returnOutput ? stemBranch.returnClashes.flatMap(pair => {
    const sealStem = pair.natal.branch === '申' ? '庚' : '辛';
    const seal = pair.natal.hiddenStems.find(row => row.stem === sealStem);
    if (!seal || !baziStemControls(seal.stem, returnOutput.stem)) return [];
    return [{ seal: { position: pair.natal.position, pillar: pair.natal.pillar, branch: pair.natal.branch, stem: seal.stem, tenGod: seal.tenGod },
      output: returnOutput, monthLu: renHaiOfficer.monthLu }];
  }) : [];
  const chenBirthTiming = timeKnown && natal.utc && (dingChenOfficerRootArrival || yiChenNativeSeals || stemBranch.chenOfficerGuard)
    ? zpqzChenBirthTiming(natal.utc) : undefined;
  const guard = stemBranch.chenOfficerGuard;
  const chenMonthClashes = dingChenOfficerRootArrival || dingChenZiRootComparison || dingChenShenRootComparison || dingChenHaiRootComparison
    || yiChenNativeSeals || guard ? {
    month: witness(native[1]),
    opposing: [...native.filter(row => row.position !== 'month'), luck, annual]
      .filter(row => clash(row.branch, native[1].branch)).map(witness),
  } : undefined;
  const dingChenUnopposedRootArrival = timeKnown ? Boolean(dingChenOfficerRootArrival
    && !dingChenOfficerRootArrival.incomingClashes.length && !clash(annual.branch, luck.branch)
    && chenMonthClashes?.opposing.length === 0) : undefined;
  const dingChenZiArrivalWithAnnualShenClash = timeKnown ? Boolean(dingChenZiRootComparison?.annualClash
    && !dingChenZiRootComparison.incomingClashes.length && !clash(annual.branch, luck.branch)
    && chenMonthClashes?.opposing.length === 0) : undefined;
  const dingChenShenArrivalWithAnnualZiClash = timeKnown ? Boolean(dingChenShenRootComparison?.annualClash
    && !dingChenShenRootComparison.incomingClashes.length && !clash(annual.branch, luck.branch)
    && chenMonthClashes?.opposing.length === 0) : undefined;
  const dingChenZiArrivalWithAnnualHaiClash = timeKnown ? Boolean(dingChenHaiRootComparison?.annualClash
    && !dingChenHaiRootComparison.incomingClashes.length && !clash(annual.branch, luck.branch)
    && chenMonthClashes?.opposing.length === 0) : undefined;
  const monthMainQi = native[1].hiddenStems[0]?.stem;
  const chenOfficerGuard = guard && { ...guard,
    monthSeal: { ...guard.monthSeal, mainQi: guard.monthSeal.stem === monthMainQi },
    monthHurt: { ...guard.monthHurt, mainQi: guard.monthHurt.stem === monthMainQi },
    sealRoots: rooted('甲', native),
    monthHurtExposure: context.hiddenActivations.find(row => row.position === 'month' && row.stem === '戊'),
    birthTiming: chenBirthTiming,
  };
  const fireNatalFrame = natal.day[0] === '丙' && natal.month[1] === '子' && natal.year[1] === '亥';
  const yearWater = fireNatalFrame && native[0].hiddenStems[0]?.stem === '壬' ? hiddenWitness(native[0], '壬') : undefined;
  const monthCommand = fireNatalFrame && native[1].hiddenStems[0]?.stem === '癸' ? hiddenWitness(native[1], '癸') : undefined;
  const coldWaterSeasonBasis = yearWater && monthCommand ? { yearWater, monthCommand } : undefined;
  const fireNatalWater = coldWaterSeasonBasis ? [coldWaterSeasonBasis.yearWater, coldWaterSeasonBasis.monthCommand] : [];
  const movingSameFireStem = ['丙', '丁'].includes(luck.stem);
  const movingSiWuBranch = ['巳', '午'].includes(luck.branch);
  const fireStemSupport = coldWaterSeasonBasis && movingSameFireStem ? { ...witness(luck), tenGod: luck.tenGod } : undefined;
  const fireContacts = movingClashes.filter(row => row.natal.position === 'year' || row.natal.position === 'month');
  const fireBranchContact = coldWaterSeasonBasis && movingSiWuBranch
    ? fireContacts.find(row => row.natal.branch === (luck.branch === '巳' ? '亥' : '子')) : undefined;
  const clashingWaterHidden = fireBranchContact && fireNatalWater.find(row => row.position === fireBranchContact.natal.position);
  const fireHidden = fireBranchContact && hiddenWitness(luck, luck.branch === '巳' ? '丙' : '丁');
  const coldWaterFireContact = clashingWaterHidden && fireHidden && baziStemControls(clashingWaterHidden.stem, fireHidden.stem)
    ? { waterHidden: clashingWaterHidden, fireHidden } : undefined;
  return {
    ...stemBranch, chenOfficerGuard, chenMonthClashes, fireMeetingPaths, annualFireMeetingClashes, fireMeetingGroupWitnesses,
    fireMeetingStatus, fireMeetingSourcePaths, fireMeetingUnopposedXin, fireMeetingWithMonthlyGeng, fireMeetingMonthShenClashes,
    fireHalfMeetingTargetStems, fireHalfYearXinSamePillar,
    dingYouSiWealth: dingYouSiWealth && { ...dingYouSiWealth,
      groupWitnesses: groupWitnesses('巳酉丑'),
      annualEndpointClashes: annualClashesAt([dingYouSiWealth.youWealth.position, dingYouSiWealth.siGeng.position]) },
    dingYouZiChain: dingYouZiChain && { ...dingYouZiChain,
      groupWitnesses: groupWitnesses('申子辰'),
      annualEndpointClashes: annualClashesAt([dingYouZiChain.chenWu.position, dingYouZiChain.youWealth.position, dingYouZiChain.luckZiGui.position]) },
    profile: zpqzMovingPolicy.profile, timeKnown, dayMaster: natal.day[0], natalYearBranch: natal.year[1], natalMonthBranch: natal.month[1],
    natalPillars: native.map(witness), luckPillar, luckStem: luck.stem, luckBranch: luck.branch, luckTenGod: luck.tenGod,
    annualPillar, annualStem: annual.stem, annualBranch: annual.branch,
    natalBranches: native.map(row => row.branch), branchCounts, exactTwoShenOneYin, twoClashPairings, movingClashes, movingStemClashes, nativeClashes,
    shenYinClashComparison, hasShenYinClashPairings, shenYinOfficerContext, hasShenYinOfficerPairings,
    kangDoubleClash, hasKangDoubleClash: Boolean(kangDoubleClash),
    hasMovingClash: movingClashes.length ? true : timeKnown ? false : undefined,
    movingClashMethodReady: timeKnown ? movingClashes.length > 0 : undefined,
    hasMovingMonthClash: movingClashes.some(row => row.isMonthCommand),
    hasAnnualJointClash: annualJointClashTargets.length ? true : timeKnown ? false : undefined,
    annualJointClashTargets,
    hasZhangReviewedWealthMonthClash, hasZhangReviewedWealthDayClash,
    direction, directionRootContext,
    hasRootlessDirectionWitness: Boolean(directionRootContext && !luckStemOwnRoots.length),
    luckStemNativeRoots, luckStemOwnRoots, luckStemRootedInOwnBranch: !!luckStemOwnRoots.length,
    luckStemRootedInNatal: luckStemNativeRoots.length ? true : timeKnown ? false : undefined,
    rootPolicy: zpqzMovingPolicy.root, groups, woodMissingBranches: context.woodMissingBranches,
    renHaiOfficerRoute: context.renHaiOfficerRoute, renHaiReturnContacts, hasRenHaiReturnContact: renHaiReturnContacts.length > 0,
    // The branch main qi establishes the source's winter frame, without computing a strength score.
    fireExample: { natalFrame: fireNatalFrame, movingSameFireStem, movingSiWuBranch,
      contacts: fireContacts, natalWater: fireNatalWater, coldWaterSeasonBasis, stemSupport: fireStemSupport, coldWaterFireContact },
    hasColdWaterSeasonBasis: Boolean(coldWaterSeasonBasis),
    hasFireSourceStem: Boolean(fireStemSupport), hasFireSourceBranch: Boolean(coldWaterFireContact),
    youExample: { ...youExample, liuheRoutes: youLiuheRoutes },
    youSourceRelief, youSiMeetingSeparatedByYin, youSourceReliefRoutes, youSourceMeetingRoutes, youSourceLiuheRoutes,
    youClashReliefCandidate: youLiuheRoutes && youClashReliefRoutes.length > 0, youClashReliefRoutes,
    renExposures: ren, renExposed: ren.length ? true : timeKnown ? false : undefined, chenStorehousePositions: count('辰').positions,
    renRootsWithLuck: [...renNativeRoots, ...renLuckRoots], renRootsConfinedToChen,
    dingChenOfficerRootArrival: dingChenOfficerRootArrival && { ...dingChenOfficerRootArrival, birthTiming: chenBirthTiming },
    hasDingChenOfficerRootArrival: Boolean(dingChenOfficerRootArrival), dingChenUnopposedRootArrival,
    dingChenZiRootComparison, dingChenZiArrivalWithAnnualShenClash,
    dingChenShenRootComparison, dingChenShenArrivalWithAnnualZiClash,
    dingChenHaiRootComparison, dingChenZiArrivalWithAnnualHaiClash,
    shenRootOpposition,
    dingChenRootClashUnsupported: timeKnown ? Boolean(shenRootOpposition && !shenRootOpposition.combinations.length
      && !shenRootOpposition.meetings.length && !shenRootOpposition.middleBranches.length && !shenRootOpposition.stemSubstituteMeeting) : undefined,
    waterNativeAssociates, waterSealExposures, newWaterSealExposure, waterSealExposureRoute, waterSealPromotionReady,
    yiChenNativeSeals: yiChenNativeSeals && { ...yiChenNativeSeals, birthTiming: chenBirthTiming },
    hiddenActivations: context.hiddenActivations, rootWitnesses: context.rootWitnesses,
    requiredSourceEffectStillUnknown: true,
  };
}
