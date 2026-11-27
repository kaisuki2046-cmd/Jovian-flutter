import { baziInteractions, baziStemFeeds, describeBaZiPillar } from './bazi-calculation';
import { baziZpqzLuckContext } from './bazi-zpqz';

const layers = ['year', 'month', 'day', 'hour'] as const;
type Natal = Record<typeof layers[number], string>;
const stems = '甲乙丙丁戊己庚辛壬癸';
const fivePairs = ['甲己', '乙庚', '丙辛', '丁壬', '戊癸'];
const elements = ['木', '火', '土', '金', '水'];
const wealth = ['正财', '偏财'], seals = ['正印', '偏印'];
const unique = <T,>(values: T[]) => [...new Set(values)];
const combines = (a: string, b: string) => fivePairs.some(pair => pair === a + b || pair === b + a);
const controls = (a: string, b: string) => elements.indexOf(a) >= 0 && (elements.indexOf(a) + 2) % 5 === elements.indexOf(b);
export const zpqzStemPolicy = {
  profile: 'zpqz-stem-order-targets-atomic-v1',
  scope: 'same-natal-candidate-and-verified-luck-stage',
  order: 'natal-year-month-day-hour; moving-stem-has-no-invented-fifth-column',
  targets: 'explicit-exposed-stem-and-its-ten-god; day-master-contact-separate',
  pairing: 'five-combination-geometry-not-successful-removal-or-transformation',
  roots: 'same-element-hidden-qi-not-effective-strength',
} as const;
export const zpqzPrintedStemCases = [
  { id: 'zeng-wealth-seal', pillars: ['乙未', '甲申', '丙申', '庚寅'] },
  { id: 'yi-ji-adjacent', pillars: ['乙未', '己卯', '庚寅', '辛巳'] },
  { id: 'li-robbery-kill', pillars: ['庚寅', '乙酉', '甲子', '戊辰'] },
  { id: 'jia-ji-ding-between', pillars: ['甲子', '丁卯', '己亥', '戊辰'] },
  { id: 'wu-gui-yi-between', pillars: ['癸巳', '壬戌', '乙巳', '戊寅'] },
] as const;

export function baziZpqzStemOrder(natal: Natal, timeKnown: boolean, luckPillar: string, annualPillar?: string) {
  const native = layers.flatMap((position, index) => position === 'hour' && !timeKnown ? []
    : [{ position: position as string, index, ...describeBaZiPillar(natal[position], natal.day[0]) }]);
  const luck = { position: 'decadal', ...describeBaZiPillar(luckPillar, natal.day[0]) };
  const dayYang = stems.indexOf(natal.day[0]) % 2 === 0;
  const month = native.find(row => row.position === 'month')!;
  const exposed = native.filter(row => row.position !== 'day');
  const witness = (row: typeof luck) => ({ position: row.position, pillar: row.pillar, stem: row.stem,
    branch: row.branch, tenGod: row.tenGod, element: row.stemElement });
  const pairGeometry = (first: typeof native[number], second: typeof native[number]) => {
    const left = Math.min(first.index, second.index), right = Math.max(first.index, second.index);
    const between = native.filter(row => left < row.index && row.index < right).map(witness);
    return { first: witness(first), second: witness(second), distance: right - left,
      adjacent: right - left === 1, between, involvesDayMaster: first.position === 'day' || second.position === 'day' };
  };
  const natalFivePairs = native.flatMap((first, i) => native.slice(i + 1).filter(second => combines(first.stem, second.stem))
    .map(second => pairGeometry(first, second)));
  const wealthSealPairs = exposed.flatMap((first, i) => exposed.slice(i + 1).filter(second =>
    wealth.includes(first.tenGod!) && seals.includes(second.tenGod!) || seals.includes(first.tenGod!) && wealth.includes(second.tenGod!))
    .map(second => ({ ...pairGeometry(first, second),
      wealth: witness(wealth.includes(first.tenGod!) ? first : second), seal: witness(seals.includes(first.tenGod!) ? first : second) })));
  const movingFivePairs = native.filter(target => combines(luck.stem, target.stem)).map(target => ({
    moving: witness(luck), target: witness(target), targetIsDayMaster: target.position === 'day',
    // A moving stem has no natal column: don't put it next to the hour stem
    // or pretend that a natal intervening stem blocks it by simple distance.
    natalOrderKnownOnly: true,
    nativeSameAsMoving: native.filter(row => row.stem === luck.stem).map(witness),
    nativeSameAsTarget: native.filter(row => row.position !== target.position && row.stem === target.stem).map(witness),
    natalOtherFiveContacts: native.filter(row => row.position !== target.position && combines(row.stem, target.stem)).map(witness),
  }));
  const soleMovingPair = movingFivePairs.length === 1 && !movingFivePairs[0].natalOtherFiveContacts.length
    ? movingFivePairs[0] : undefined;
  const haiRen = timeKnown && month.branch === '亥' && ['丙', '丁'].includes(natal.day[0])
    ? month.hiddenStems.find(row => row.stem === '壬') : undefined;
  const exposedRen = haiRen ? exposed.filter(row => row.stem === haiRen.stem).map(witness) : [];
  const renCombinations = movingFivePairs.filter(row => exposedRen.some(ren => ren.position === row.target.position));
  const hurtOfficerLinks = haiRen?.tenGod === '正官' ? exposed.flatMap(hurt => {
    if (hurt.stem !== '戊' || hurt.tenGod !== '伤官') return [];
    const movingJoin = movingFivePairs.find(pair => pair.target.position === hurt.position);
    return exposedRen.filter(ren => controls(hurt.stemElement, ren.element)).map(officer => ({ hurt: witness(hurt), officer,
      movingCombinesHurt: Boolean(movingJoin), natalHurtPartners: movingJoin?.natalOtherFiveContacts,
    }));
  }) : [];
  let haiStemRoute = 'none';
  if (exposedRen.length && haiRen) {
    if (luck.stem === '丙') haiStemRoute = haiRen.tenGod === '七杀' ? 'bing-companion' : 'ding-robbery';
    else if (luck.stem === '丁' && renCombinations.length) {
      haiStemRoute = haiRen.tenGod === '七杀' ? 'bing-joins-killer' : 'ding-joins-officer';
    } else if (luck.stem === '壬' && hurtOfficerLinks.length) haiStemRoute = 'ren-repeats-officer-under-hurt';
    else if (luck.stem === '癸' && hurtOfficerLinks.some(row => row.movingCombinesHurt)) haiStemRoute = 'gui-joins-hurting';
  }
  const haiStemComparison = haiStemRoute !== 'none' && haiRen ? {
    route: haiStemRoute,
    monthRen: { pillar: month.pillar, stem: haiRen.stem, tenGod: haiRen.tenGod },
    exposedRen, moving: witness(luck), renCombinations: renCombinations.map(row => ({
      target: row.target,
      natalCombinations: natalFivePairs.filter(pair => [pair.first.position, pair.second.position].includes(row.target.position)),
    })),
    hurtOfficerLinks,
  } : undefined;
  const monthSeals = month.hiddenStems.flatMap((row, index) => seals.includes(row.tenGod!) ? [{
    ...witness(month), stem: row.stem, tenGod: row.tenGod, element: row.element, hiddenOrder: index + 1, mainQi: index === 0,
    exposedSeats: exposed.filter(stem => stem.stem === row.stem).map(witness),
  }] : []);
  const primaryMonthStem = month.hiddenStems[0];
  const monthPrimary = { stem: primaryMonthStem.stem, tenGod: primaryMonthStem.tenGod,
    exposedSeats: exposed.filter(row => row.stem === primaryMonthStem.stem).map(witness) };
  const woodMeeting = timeKnown && natal.day[0] === '丁' && month.branch === '亥' && monthSeals.length > 0
    ? [...'亥卯未'].map(branch => ({ branch, positions: native.filter(row => row.branch === branch).map(witness) })) : undefined;
  const sealOfficerJoins = timeKnown ? movingFivePairs.flatMap(pair => {
    if (pair.targetIsDayMaster || pair.target.tenGod !== '正官') return [];
    const seals = monthSeals.filter(seal => baziStemFeeds(pair.target.stem, seal.stem)).map(seal => ({
      ...seal,
      supportLevel: seal.mainQi ? 'primary-seal'
        : seal.exposedSeats.length ? 'residual-seal-exposed' : 'residual-seal-only',
    }));
    if (!seals.length) return [];
    const example = natal.day[0] === '甲' && month.branch === '子' && pair.target.stem === '辛' && luck.stem === '丙' ? 'jia-zi-bing'
      : natal.day[0] === '丙' && month.branch === '卯' && pair.target.stem === '癸' && luck.stem === '戊' ? 'bing-mao-wu' : undefined;
    const officerRoots = [...native, luck].flatMap(row => row.hiddenStems.flatMap((hidden, index) =>
      hidden.element === pair.target.element ? [{ ...witness(row), stem: hidden.stem, tenGod: hidden.tenGod,
        element: hidden.element, exactStem: hidden.stem === pair.target.stem, hiddenOrder: index + 1 }] : []));
    const otherExposedAuthorities = exposed.filter(row => row.position !== pair.target.position
      && (row.tenGod === '正官' || row.tenGod === '七杀')).map(witness);
    return [{ moving: pair.moving, officer: pair.target, monthSeals: seals, monthPrimary, woodMeeting, example,
      officerRoots, otherExposedAuthorities }];
  }) : [];
  const sealOfficerJoinMonthRoutes = timeKnown ? [...new Set(sealOfficerJoins.flatMap(join =>
    join.monthSeals.map(seal => seal.supportLevel)))] : undefined;
  // Xu distinguishes an external Yi from removing the Geng officer of a Yi day.
  // Restrict the source's exception to the explicitly repeated natal month Yi.
  const sealOfficerSourceRetained = timeKnown ? natal.day[0] === '乙' && month.stem === '乙' && luck.stem === '乙'
    && sealOfficerJoins.some(join => join.officer.stem === '庚' && join.monthSeals.some(seal => seal.mainQi))
    : undefined;
  const sealOfficerPrimaryJoin = soleMovingPair ? sealOfficerJoins.find(join => join.monthSeals.some(seal => seal.mainQi)) : undefined;
  const sealOfficerPrimaryExample = sealOfficerPrimaryJoin?.example;
  const unrootedOfficerJoin = sealOfficerPrimaryJoin && !sealOfficerPrimaryJoin.officerRoots.length
    && !sealOfficerPrimaryJoin.otherExposedAuthorities.length;
  const sealOfficerNoRootExample = unrootedOfficerJoin ? sealOfficerPrimaryExample : undefined;
  const sealOfficerSourceUnrootedJoin = timeKnown ? Boolean(unrootedOfficerJoin && !sealOfficerPrimaryExample) : undefined;
  // The mixed qi chapter reads a single exposed hidden stem separately from a meeting of the month branch.
  const exposedMonthQi = month.hiddenStems.filter(row => exposed.some(seat => seat.stem === row.stem));
  const soleOfficerJoin = soleMovingPair ? sealOfficerJoins[0] : undefined;
  const singleResidualSeal = soleOfficerJoin && !soleOfficerJoin.officerRoots.length && !soleOfficerJoin.otherExposedAuthorities.length
    && '辰戌丑未'.includes(month.branch) && exposedMonthQi.length === 1 ? soleOfficerJoin.monthSeals.find(seal =>
      seal.supportLevel === 'residual-seal-exposed' && seal.stem === exposedMonthQi[0].stem) : undefined;
  const residualMonthInteractions = singleResidualSeal && annualPillar ? baziInteractions([
    ...native.map(row => ({ id: row.position, pillar: row.pillar })),
    { id: 'decadal', pillar: luck.pillar }, { id: 'annual', pillar: annualPillar },
  ]) : undefined;
  const sealOfficerSingleResidual = soleOfficerJoin && singleResidualSeal && residualMonthInteractions ? {
    seal: singleResidualSeal, officer: soleOfficerJoin.officer, moving: soleOfficerJoin.moving,
    monthPairs: residualMonthInteractions.pairs.filter(pair => pair.members.includes('month')
      && (pair.kind === '六冲' || pair.kind === '六合')),
    monthGroups: residualMonthInteractions.groups.filter(group => group.kind !== '三刑'
      && group.byBranch.some(positions => positions.includes('month'))),
  } : undefined;
  const sealOfficerSingleResidualJoin = timeKnown && annualPillar ? Boolean(sealOfficerSingleResidual
    && !sealOfficerSingleResidual.monthPairs.length && !sealOfficerSingleResidual.monthGroups.length) : undefined;
  const yearWuJoin = timeKnown && natal.day[0] === '甲' && natal.year === '戊辰' && month.pillar === '辛酉' && luck.stem === '癸'
    ? movingFivePairs.find(pair => pair.target.position === 'year' && pair.target.tenGod === '偏财') : undefined;
  const guiWithYearWu = yearWuJoin && baziStemFeeds(yearWuJoin.target.stem, month.stem) && baziStemFeeds(month.stem, luck.stem) ? {
    wealth: yearWuJoin.target, officer: witness(month), seal: yearWuJoin.moving,
    nativeExposedGui: exposed.filter(row => row.stem === '癸').map(witness),
    waterRoots: [...native, luck].flatMap(row => row.hiddenStems.flatMap((hidden, index) => hidden.element === '水'
      ? [{ ...witness(row), stem: hidden.stem, tenGod: hidden.tenGod, element: hidden.element, exactStem: hidden.stem === '癸',
        role: row.branch === '辰' ? '水库' : row.branch === '丑' ? '水余气' : index === 0 ? '本气' : '其他藏气' }] : [])),
  } : undefined;
  const guiOwnLuckWaterRoots = guiWithYearWu?.waterRoots.filter(root => root.position === 'decadal');
  const guiOwnLuckWaterRoot = guiOwnLuckWaterRoots === undefined ? undefined
    : guiOwnLuckWaterRoots.some(root => root.exactStem) ? 'exact-stem'
    : guiOwnLuckWaterRoots.length ? 'same-element' : 'absent';
  const guiJoinsHurt = haiStemRoute === 'gui-joins-hurting';
  const guiRootRelations = guiWithYearWu || guiJoinsHurt
    ? baziInteractions([...native, luck].map(row => ({ id: row.position, pillar: row.pillar }))) : undefined;
  const guiWaterRootClashes = guiRootRelations && guiWithYearWu ? guiRootRelations.pairs
    .filter(pair => pair.kind === '六冲' && pair.members.some(position => guiWithYearWu.waterRoots.some(root => root.position === position)))
    .map(pair => pair.members.map(position => witness(position === 'decadal' ? luck : native.find(row => row.position === position)!))) : [];
  const guiOnlySourceLightRoots = guiWithYearWu ? luck.pillar === '癸丑' && soleMovingPair === yearWuJoin
    && guiWithYearWu.waterRoots.length === 2 && guiWithYearWu.waterRoots.every(root => root.exactStem
      && (root.position === 'year' && root.role === '水库' || root.position === 'decadal' && root.role === '水余气')) : undefined;
  const guiUnopposedLightRoots = guiWithYearWu ? guiOnlySourceLightRoots === true && !guiWaterRootClashes.length : undefined;
  const guiAllLightRootsClashed = guiWithYearWu ? guiOnlySourceLightRoots === true
    && [['year', 'day'], ['decadal', 'hour']].every(positions => guiWaterRootClashes.some(pair =>
      positions.every(position => pair.some(column => column.position === position))))
    : undefined;
  const guiZiLuRoots = guiRootRelations && guiWithYearWu ? guiWithYearWu.waterRoots
    .filter(root => root.branch === '子' && root.exactStem && root.role === '本气').map(root => ({
      root,
      relations: guiRootRelations.pairs.filter(pair => ['六合', '六冲', '六害', '六破', '相刑'].includes(pair.kind)
        && pair.members.includes(root.position)),
    })) : [];
  const guiNorthGroup = guiRootRelations?.groups.find(group => group.kind === '三会' && group.values === '亥子丑');
  const guiNorthernWaterAssembly = guiNorthGroup && guiWithYearWu ? guiNorthGroup.byBranch.flat()
    .flatMap(position => guiWithYearWu.waterRoots.filter(root => root.position === position)) : undefined;
  const guiTrine = guiRootRelations?.groups.find(group => group.kind === '三合' && group.values === '申子辰');
  const guiShenZiChenAssembly = guiTrine && guiWithYearWu ? guiTrine.byBranch.flat()
    .flatMap(position => guiWithYearWu.waterRoots.filter(root => root.position === position)) : undefined;
  const haiGuiMetalSources = guiJoinsHurt ? native.filter(row =>
    row.stemElement === '金' || row.hiddenStems[0]?.element === '金').map(witness) : [];
  const haiGuiColdWaterOpposition = guiJoinsHurt && guiNorthGroup && haiGuiMetalSources.length
    && !exposed.some(row => row.stemElement === '火')
    && ![...native, luck].some(row => row.hiddenStems.some(hidden => hidden.element === '火')) ? {
      waterPositions: guiNorthGroup.byBranch.flat().map(position => witness(position === 'decadal' ? luck
        : native.find(row => row.position === position)!)),
      natalMetalSources: haiGuiMetalSources,
    } : undefined;
  const haiGuiFireRoots = guiJoinsHurt ? [...native, luck].flatMap(row => row.hiddenStems.filter(stem => stem.element === '火')
    .map(stem => ({ ...witness(row), stem: stem.stem, element: stem.element, tenGod: stem.tenGod }))) : [];
  const haiGuiAnnual = haiGuiFireRoots.length && annualPillar
    ? { position: 'annual', ...describeBaZiPillar(annualPillar, natal.day[0]) } : undefined;
  const haiGuiRootColumns = haiGuiFireRoots.length ? [...native, luck, ...(haiGuiAnnual ? [haiGuiAnnual] : [])] : [];
  const haiGuiRootPairs = haiGuiAnnual
    ? baziInteractions(haiGuiRootColumns.map(row => ({ id: row.position, pillar: row.pillar }))).pairs : guiRootRelations?.pairs ?? [];
  const haiGuiFireRootClashes = haiGuiFireRoots.flatMap(root => haiGuiRootPairs.flatMap(pair => {
    if (pair.kind !== '六冲' || !['寅申', '申寅', '巳亥', '亥巳'].includes(pair.values)
      || !pair.members.includes(root.position)) return [];
    const opponent = haiGuiRootColumns.find(row => row.position !== root.position && pair.members.includes(row.position));
    return opponent ? [{ root, opposing: witness(opponent) }] : [];
  }));
  const haiGuiYearHourLink = guiJoinsHurt ? hurtOfficerLinks.find(row => row.movingCombinesHurt
    && [row.hurt.position, row.officer.position].includes('year')
    && [row.hurt.position, row.officer.position].includes('hour')) : undefined;
  const haiGuiRootedLink = haiGuiYearHourLink && haiGuiFireRoots.length
    ? { ...haiGuiYearHourLink, fireRoots: haiGuiFireRoots, fireRootClashes: haiGuiFireRootClashes } : undefined;
  const natalKillPairs = natalFivePairs.flatMap(pair => {
    const rows = [pair.first, pair.second], kill = rows.find(row => row.tenGod === '七杀');
    const combiner = rows.find(row => ['劫财', '伤官'].includes(row.tenGod!));
    return kill && combiner && !pair.involvesDayMaster ? [{ ...pair, kill, combiner }] : [];
  });
  const movingAttacksKillCombiners = natalKillPairs.filter(pair => controls(luck.stemElement, pair.combiner.element))
    .map(pair => ({ moving: witness(luck), combiner: pair.combiner, kill: pair.kill }));
  const monthOfficerStem = month.hiddenStems.find(row => row.tenGod === '正官');
  const monthOfficer = monthOfficerStem && { position: 'month', pillar: month.pillar, stem: monthOfficerStem.stem,
    exposedSeats: exposed.filter(row => row.stem === monthOfficerStem.stem).map(witness) };
  const officerKillPairs = monthOfficer ? natalKillPairs.filter(pair => pair.combiner.tenGod === (dayYang ? '劫财' : '伤官')) : [];
  const sameKillerInLuck = officerKillPairs.map(pair => ({ pair,
    exposed: luck.stem === pair.kill.stem && luck.tenGod === '七杀' ? witness(luck) : undefined,
    hidden: luck.hiddenStems.flatMap((row, index) => row.stem === pair.kill.stem && row.tenGod === '七杀'
      ? [{ stem: row.stem, mainQi: index === 0 }] : []),
    movingCombinations: movingFivePairs.filter(contact => contact.target.position === pair.combiner.position
      && contact.moving.stem === pair.kill.stem),
  })).filter(row => row.exposed || row.hidden.length);
  const luckComponents = [{ ...witness(luck), placement: '运干' }, ...luck.hiddenStems.map((row, index) => ({
    position: luck.position, pillar: luck.pillar, stem: row.stem, tenGod: row.tenGod, element: row.element,
    placement: index === 0 ? '运支本气' : '运支其他藏干',
  }))];
  const luckSealAgainstCombiner = (dayYang ? [] : officerKillPairs).flatMap(pair => luckComponents
    .filter(row => seals.includes(row.tenGod!) && controls(row.element, pair.combiner.element))
    .map(seal => ({ seal, pair, nativeWealth: exposed.filter(row => wealth.includes(row.tenGod!)
      && controls(row.stemElement, seal.element)).map(witness) })));
  const leadingSealsAgainstCombiner = luckSealAgainstCombiner.filter(row => row.seal.placement !== '运支其他藏干');
  const supportedSecondaryOwls = luckSealAgainstCombiner.filter(row => row.seal.placement === '运支其他藏干'
    && row.seal.tenGod === '偏印' && baziStemFeeds(luck.stem, row.seal.stem));
  const unopposedOwls = officerKillPairs.length === 1 && monthOfficer?.stem === primaryMonthStem.stem
    ? leadingSealsAgainstCombiner.filter(row => row.pair.adjacent && row.seal.tenGod === '偏印' && row.nativeWealth.length === 0) : [];
  const directOwlAgainstHurt = timeKnown ? unopposedOwls.some(row => row.seal.placement === '运干') : undefined;
  const branchOwl = unopposedOwls.find(row => row.seal.placement === '运支本气');
  const meetingBranches = branchOwl && ({ 水: '申子辰', 木: '亥卯未', 火: '寅午戌', 金: '巳酉丑' } as Record<string, string>)[branchOwl.seal.element];
  const branchOwlMeeting = branchOwl && meetingBranches?.includes(luck.branch) && timeKnown && annualPillar
    && !native.some(row => row.branch === luck.branch) ? (() => {
    const center = meetingBranches[1];
    const natalMembers = native.filter(row => meetingBranches.includes(row.branch));
    if (!natalMembers.length || (luck.branch !== center && !natalMembers.some(row => row.branch === center))) return undefined;
    const annual = { position: 'annual', ...describeBaZiPillar(annualPillar, natal.day[0]) };
    const active = [...native, luck, annual];
    const selected = new Set([luck.position, 'month', branchOwl.pair.combiner.position, branchOwl.pair.kill.position,
      ...natalMembers.map(row => row.position)]);
    const clashes = baziInteractions(active.map(row => ({ id: row.position, pillar: row.pillar }))).pairs
      .filter(pair => pair.kind === '六冲' && pair.members.some(position => selected.has(position)))
      .map(pair => ({ ...pair, members: pair.members.map(position => witness(active.find(row => row.position === position)!)) }));
    return { ...branchOwl, meeting: { branches: meetingBranches, center, natalMembers: natalMembers.map(witness), moving: witness(luck), clashes } };
  })() : undefined;
  const branchOwlMeetingAgainstHurt = timeKnown && annualPillar ? Boolean(branchOwlMeeting && !branchOwlMeeting.meeting.clashes.length) : undefined;
  const killerReexposed = sameKillerInLuck.some(row => row.exposed);
  const killCombinationRoutes = [
    dayYang && killerReexposed && 'robbery-killer-reexposed',
    !dayYang && killerReexposed && 'hurt-killer-reexposed',
    leadingSealsAgainstCombiner.length > 0 && 'seal-controls-hurting-combiner',
    leadingSealsAgainstCombiner.some(row => row.seal.tenGod === '偏印') && 'owl-controls-hurting-combiner',
    supportedSecondaryOwls.length > 0 && 'supported-secondary-owl-controls-hurting-combiner',
  ].filter(route => typeof route === 'string');
  const officerKillLuck = monthOfficer && officerKillPairs.length
    ? { monthOfficer, sameKillerInLuck, luckSealAgainstCombiner, supportedSecondaryOwls, branchOwlMeeting } : undefined;
  const stemLayout = baziZpqzLuckContext(natal, timeKnown, luckPillar);
  const wuOfficer = natal.day[0] === '壬' && natal.month[1] === '午' && luck.stem === '己'
    ? stemLayout.hiddenActivations.find(row => row.position === 'month' && row.stem === '己' && row.tenGod === '正官') : undefined;
  const foodTargets = wuOfficer ? movingFivePairs.filter(pair => pair.target.stem === '甲' && pair.target.tenGod === '食神'
    && !pair.targetIsDayMaster && controls(pair.target.element, pair.moving.element)) : [];
  const dingWealth = foodTargets.length ? exposed.filter(row => row.stem === '丁' && row.tenGod === '正财') : [];
  const foodWealthLinks = foodTargets.flatMap(pair => dingWealth
    .filter(wealth => baziStemFeeds(pair.target.stem, wealth.stem))
    .map(wealth => ({
      food: pair.target, wealth: witness(wealth),
      wealthDayCombinations: natalFivePairs.filter(contact => contact.involvesDayMaster
        && (contact.first.position === wealth.position || contact.second.position === wealth.position)),
    })));
  const wuOfficerFoodWealth = wuOfficer && {
    officer: wuOfficer, moving: witness(luck),
    foodCheckingOfficer: foodTargets.map(pair => pair.target),
    foodWealthLinks,
  };
  const combiningNatalTenGods = unique(movingFivePairs.filter(pair => !pair.targetIsDayMaster).map(pair => pair.target.tenGod!));
  const allGods = unique([...exposed.map(row => row.tenGod!), ...native.flatMap(row => row.hiddenStems.map(hidden => hidden.tenGod!))]);
  const yiJiPairs = exposed.flatMap((first, i) => exposed.slice(i + 1).filter(second => [first.stem, second.stem].sort().join('') === ['乙', '己'].sort().join(''))
    .map(second => pairGeometry(first, second)));
  const jiaGengBingBridges = wealthSealPairs.filter(pair => [pair.first.stem, pair.second.stem].includes('甲')
    && [pair.first.stem, pair.second.stem].includes('庚') && pair.between.some(row => row.stem === '丙'));
  const printedCases = zpqzPrintedStemCases.map(example => ({ id: example.id,
    matches: layers.every((position, i) => position === 'hour' && !timeKnown || natal[position] === example.pillars[i])
      ? timeKnown ? true : undefined : false }));
  const primaryLuck = luckComponents.slice(0, 2);
  const incomingOutputs = primaryLuck.filter(row => ['食神', '伤官'].includes(row.tenGod!));
  const monthlyWealthPairs = timeKnown ? wealthSealPairs.flatMap(pair => {
    const monthRoot = month.hiddenStems.find(row => row.stem === pair.wealth.stem && wealth.includes(row.tenGod!));
    if (!monthRoot) return [];
    const monthWealth = { ...witness(month), stem: monthRoot.stem, tenGod: monthRoot.tenGod, element: monthRoot.element,
      placement: monthRoot === month.hiddenStems[0] ? '月支本气' : '月支其他藏干' };
    const authorityBridges = primaryLuck.filter(row => ['正官', '七杀'].includes(row.tenGod!)
      && baziStemFeeds(pair.wealth.stem, row.stem) && baziStemFeeds(row.stem, pair.seal.stem)).map(authority => ({
      authority, checkedBy: incomingOutputs.filter(output => controls(output.element, authority.element)),
    }));
    const supportingSeals = primaryLuck.filter(row => seals.includes(row.tenGod!) && baziStemFeeds(row.stem, natal.day[0]))
      .map(seal => ({ seal, controlledByWealth: controls(pair.wealth.element, seal.element) }));
    return [{ wealth: pair.wealth, seal: pair.seal, monthWealth, adjacent: pair.adjacent, between: pair.between,
      authorityBridges, supportingSeals }];
  }) : [];
  const adjacentWealthSealPairs = monthlyWealthPairs.filter(pair => pair.adjacent);
  const separatedWealthSealPaths = monthlyWealthPairs.filter(pair => pair.between.some(row => row.position === 'day'))
    .map(pair => ({ ...pair, competingAdjacentPairs: adjacentWealthSealPairs.map(({ wealth, seal }) => ({ wealth, seal })) }));
  const yiJiWealthSealPaths = natal.day[0] === '庚' ? adjacentWealthSealPairs.filter(pair => pair.wealth.stem === '乙' && pair.seal.stem === '己')
    .map(pair => ({ ...pair,
      supportiveRobbery: primaryLuck.filter(row => row.tenGod === '劫财' && controls(row.element, pair.wealth.element)),
      outputFeedsWealth: incomingOutputs.filter(row => baziStemFeeds(row.stem, pair.wealth.stem)),
      wealthControlsSeal: primaryLuck.filter(row => wealth.includes(row.tenGod!) && controls(row.element, pair.seal.element)),
    })) : [];
  const zengMatches = printedCases.some(row => row.id === 'zeng-wealth-seal' && row.matches === true);
  const zengSiSupport = zengMatches && luckPillar === '辛巳'
    ? primaryLuck.find(row => row.placement === '运支本气' && row.stem === natal.day[0] && row.tenGod === '比肩') : undefined;
  const zengGengChen = zengMatches && luckPillar === '庚辰' ? luckComponents : undefined;
  const zengWealthSealRoots = zengMatches ? [
    { role: '丙长生', stem: '丙', positions: native.filter(row => row.branch === '寅' && row.hiddenStems.some(hidden => hidden.stem === '丙')).map(witness) },
    { role: '甲禄', stem: '甲', positions: native.filter(row => row.branch === '寅' && row.hiddenStems.some(hidden => hidden.stem === '甲')).map(witness) },
    { role: '庚禄', stem: '庚', positions: native.filter(row => row.branch === '申' && row.hiddenStems.some(hidden => hidden.stem === '庚')).map(witness) },
  ] : [];
  const wealthSealLuck = { separatedWealthSealPaths, yiJiWealthSealPaths, zengSiSupport, zengGengChen, zengWealthSealRoots };
  return {
    profile: zpqzStemPolicy.profile, timeKnown, dayMaster: natal.day[0], dayYang,
    natalYearPillar: natal.year, natalMonthPillar: natal.month, natalMonthBranch: natal.month[1],
    natalBranches: native.map(row => row.branch), natalPillars: native.map(witness),
    natalPillarSequence: timeKnown ? native.map(row => row.pillar).join('') : undefined,
    natalExposedStems: unique(exposed.map(row => row.stem)), natalExposedTenGods: unique(exposed.map(row => row.tenGod!)),
    natalPresentTenGods: allGods, natalMonthHiddenTenGods: month.hiddenStems.map(hidden => hidden.tenGod!),
    luckPillar, luckStem: luck.stem, luckTenGod: luck.tenGod, luckBranchMainQiGod: luck.hiddenStems[0]?.tenGod,
    natalFivePairs, movingFivePairs, combiningNatalTenGods, haiStemRoute, haiStemComparison, wuOfficerFoodWealth,
    sealOfficerJoins, hasSealOfficerJoin: sealOfficerJoins.length > 0, sealOfficerJoinMonthRoutes, sealOfficerPrimaryExample,
    sealOfficerNoRootExample, sealOfficerSourceUnrootedJoin, sealOfficerSingleResidual, sealOfficerSingleResidualJoin,
    sealOfficerSourceRetained,
    guiWithYearWu, guiWaterRootClashes, guiOwnLuckWaterRoot, guiUnopposedLightRoots, guiAllLightRootsClashed,
    hasGuiWithYearWu: Boolean(guiWithYearWu),
    guiZiLuRoots, guiNorthernWaterAssembly, hasGuiNorthernWaterAssembly: guiWithYearWu ? Boolean(guiNorthernWaterAssembly) : undefined,
    guiShenZiChenAssembly, hasGuiShenZiChenAssembly: guiWithYearWu ? Boolean(guiShenZiChenAssembly) : undefined,
    haiGuiColdWaterOpposition, hasHaiGuiColdWaterOpposition: guiJoinsHurt ? Boolean(haiGuiColdWaterOpposition) : undefined,
    haiGuiRootedLink, hasHaiGuiRootedLink: guiJoinsHurt
      ? Boolean(haiGuiRootedLink && soleMovingPair?.target.position === haiGuiRootedLink.hurt.position
        && haiGuiFireRoots.some(root => !haiGuiFireRootClashes.some(proof => proof.root.position === root.position))) : undefined,
    guiRootsOnlyStorageOrResidual: guiWithYearWu?.waterRoots.every(root => ['水库', '水余气'].includes(root.role)),
    hasNewWuOfficerFoodWealth: timeKnown ? Boolean(wuOfficer?.newlyExposedByLuck && foodWealthLinks.length) : undefined,
    movingFiveTargets: movingFivePairs.filter(pair => !pair.targetIsDayMaster).map(pair =>
      [pair.target.position, pair.target.stem, pair.target.tenGod].join(':')),
    wealthSealPairs, yiJiPairs, jiaGengBingBridges, natalKillPairs, movingAttacksKillCombiners, officerKillLuck, killCombinationRoutes,
    directOwlAgainstHurt, branchOwlMeetingAgainstHurt,
    wealthSealLuck,
    hasSeparatedWealthSealLuck: Boolean(zengSiSupport) || separatedWealthSealPaths.some(path =>
      !path.competingAdjacentPairs.length && (path.authorityBridges.length || path.supportingSeals.length)),
    hasYiJiWealthSealLuck: yiJiWealthSealPaths.some(path => path.supportiveRobbery.length || path.supportingSeals.length
      || path.authorityBridges.length || path.outputFeedsWealth.length || path.wealthControlsSeal.length),
    hasJiaGengBingBridge: jiaGengBingBridges.length ? true : timeKnown ? false : undefined,
    hasYiJiAdjacency: yiJiPairs.some(pair => pair.adjacent) ? true : timeKnown ? false : undefined,
    natalKillCombinerTenGods: unique(natalKillPairs.map(pair => pair.combiner.tenGod!)),
    hasMovingAttackOnKillCombiner: movingAttacksKillCombiners.length ? true : timeKnown ? false : undefined,
    roots: stemLayout.rootWitnesses, printedCases,
  };
}
