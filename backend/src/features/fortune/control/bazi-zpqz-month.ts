import { baziInteractions, baziStemControls, baziStemFeeds, describeBaZiPillar, describeBaZiStem } from './bazi-calculation';
import { lunarAtBeijing } from './fortune-calendar';
import { nextSolarBoundary } from './fortune-preview';
import { zpqzPrintedStemCases } from './bazi-zpqz-stems';

const positions = ['year', 'month', 'day', 'hour'] as const;
type Natal = Record<typeof positions[number], string> & { utc?: string };
const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
const valid = (p: string) => typeof p === 'string' && p.length === 2 && stems.includes(p[0]) && branches.includes(p[1])
  && stems.indexOf(p[0]) % 2 === branches.indexOf(p[1]) % 2;
export const zpqzMonthPolicy = {
  profile: 'zpqz-month-command-exposure-atomic-v1',
  lu: 'smth-volume3-explicit-stem-lu-table-coordinate-only',
  blade: 'zpqz-five-yang-only-lu-plus1-and-natal-month-not-other-columns',
  jie: 'month-main-qi-robbery-candidate-not-full-pattern-selection',
  xin: 'jia-you-month-native-exposure-separate-from-moving-stem-and-branch-roots',
  gao: 'printed-four-columns-and-two-conflicting-fire-luck-comments-kept-separate',
  timing: 'same-candidate-uniquely-confirmed-luck-stage-no-strength-score',
} as const;
export const zpqzGaoColumns = ['庚子', '甲申', '庚子', '甲申'] as const;
const liOfficerColumns = zpqzPrintedStemCases.find(row => row.id === 'li-robbery-kill')!.pillars;

function shenMonthTiming(utc?: string) {
  const birthAt = Date.parse(utc ?? '');
  if (!Number.isSafeInteger(birthAt)) return undefined;
  const lunar = lunarAtBeijing(birthAt);
  if (lunar.getMonthInGanZhiExact()[1] !== '申') return undefined;
  const next = nextSolarBoundary(birthAt);
  const termTable = (lunar as typeof lunar & { getJieQiTable(): Record<string, { toYmdHms(): string }> }).getJieQiTable();
  const parse = (solar?: { toYmdHms(): string }) => Date.parse((solar?.toYmdHms() ?? '').replace(' ', 'T') + '+08:00');
  const start = parse(termTable['立秋']), middle = parse(termTable['处暑']);
  if (next.name !== '白露' || !(start <= birthAt && start < middle && middle < next.time)) return undefined;
  return { start: new Date(start).toISOString(), middle: new Date(middle).toISOString(), end: new Date(next.time).toISOString(),
    afterChuShu: birthAt >= middle };
}

export function zpqzMonthPositions(dayMaster: string, monthBranch: string) {
  if (dayMaster.length !== 1 || !stems.includes(dayMaster) || monthBranch.length !== 1 || !branches.includes(monthBranch)) throw new RangeError('Invalid month command basis');
  // Supplemental primary source gives the ten Lu coordinates. Do not import
  // its other blade schools: the target chapter explicitly admits five Yang.
  const luBranch = '寅卯巳午巳午申酉亥子'[stems.indexOf(dayMaster)], dayYang = stems.indexOf(dayMaster) % 2 === 0;
  const bladeBranch = dayYang ? branches[(branches.indexOf(luBranch) + 1) % 12] : undefined;
  return { dayMaster, monthBranch, dayYang, luBranch, bladeBranch, atLu: monthBranch === luBranch,
    atYangBlade: bladeBranch === undefined ? false : monthBranch === bladeBranch };
}

export function baziZpqzMonthCommand(natal: Natal, timeKnown: boolean, luckPillar: string) {
  if (positions.filter(p => p !== 'hour' || timeKnown).some(p => !valid(natal[p])) || !valid(luckPillar)) throw new RangeError('Invalid month command pillars');
  const month = zpqzMonthPositions(natal.day[0], natal.month[1]);
  const native = positions.filter(p => p !== 'hour' || timeKnown).map(position => ({ position: position as string, ...describeBaZiPillar(natal[position], month.dayMaster) }));
  const natalPillarSequence = timeKnown ? native.map(row => row.pillar).join('') : undefined;
  const luck = { position: 'decadal', ...describeBaZiPillar(luckPillar, month.dayMaster) }, exposed = native.filter(p => p.position !== 'day');
  const hidden = native.flatMap(p => p.hiddenStems.map(row => ({ position: p.position, branch: p.branch, ...row })));
  const seen = (yes: boolean) => yes ? true : timeKnown ? false : undefined;
  const witness = (p: typeof luck) => ({ position: p.position, pillar: p.pillar, stem: p.stem, branch: p.branch });
  const godWitness = (god: string) => {
    const exposedRows = exposed.filter(p => p.tenGod === god), hiddenRows = hidden.filter(p => p.tenGod === god);
    return { god, exposed: seen(!!exposedRows.length), present: seen(!!exposedRows.length || !!hiddenRows.length),
      exposedPositions: exposedRows.map(witness), hiddenPositions: hiddenRows };
  };
  const godWitnesses = ['正官', '七杀', '食神', '伤官', '正财', '偏财'].map(godWitness);
  const xinExposedRows = exposed.filter(p => p.stem === '辛'), xinHiddenRows = hidden.filter(p => p.stem === '辛');
  const xinExposed = seen(!!xinExposedRows.length), xinHidden = seen(!!xinHiddenRows.length);
  const roots = (stem: string) => {
    const element = describeBaZiStem(stem, month.dayMaster).stemElement;
    return [...native, luck].flatMap(p => {
      const members = p.hiddenStems.filter(h => h.element === element);
      return members.length ? [{ ...witness(p), exactStem: members.some(h => h.stem === stem), stems: members.map(h => h.stem) }] : [];
    });
  };
  const jiaYouMonth = month.dayMaster === '甲' && month.monthBranch === '酉';
  const xinRoots = roots('辛');
  const xinNewlyExposedByLuck = luck.stem !== '辛' || xinExposed === true || xinHidden === false ? false
    : xinExposed === false && xinHidden === true ? true : undefined;
  const nativeFireWitnesses = native.flatMap(p => [
    ...(p.stemElement === '火' ? [{ ...witness(p), kind: '透干', fireStem: p.stem }] : []),
    ...p.hiddenStems.filter(h => h.element === '火').map(h => ({ ...witness(p), kind: '支藏', fireStem: h.stem })),
  ]);
  const fireAbsent = nativeFireWitnesses.length ? false : timeKnown ? true : undefined;
  const monthPillar = native[1];
  const monthMainQi = monthPillar.hiddenStems[0];
  const mainQiJieCandidate = monthMainQi?.tenGod === '劫财';
  const monthLuJieCandidate = month.atLu || month.atYangBlade || mainQiJieCandidate;
  const isWealth = (god?: string) => god === '正财' || god === '偏财';
  const isSeal = (god?: string) => god === '正印' || god === '偏印';
  const isPeer = (god?: string) => god === '比肩' || god === '劫财';
  const isAuthority = (god?: string) => god === '正官' || god === '七杀';
  const luckMainQi = luck.hiddenStems[0];
  const youOfficer = jiaYouMonth && timeKnown && monthMainQi.stem === '辛' && monthMainQi.tenGod === '正官'
    ? { ...witness(monthPillar), stem: monthMainQi.stem, god: monthMainQi.tenGod } : undefined;
  const youOfficerBranchRoot = youOfficer && ['申', '酉'].includes(luck.branch) && luckMainQi.element === monthMainQi.element
    ? { ...witness(luck), stem: luckMainQi.stem, god: luckMainQi.tenGod, exactStem: luckMainQi.stem === youOfficer.stem } : undefined;
  const youOfficerStemRoute = !youOfficer ? undefined
    : luck.stem === '庚' && luck.tenGod === '七杀' ? 'geng-killer'
    : luck.stem === '辛' && luck.tenGod === '正官' ? xinNewlyExposedByLuck === true ? 'xin-new-exposure' : 'xin-repeat' : undefined;
  const youOfficerRoutes = [youOfficerBranchRoot && 'branch-root', youOfficerStemRoute].filter(route => typeof route === 'string');
  const youOfficerInteractions = youOfficer && youOfficerRoutes.length
    ? baziInteractions([...native, luck].map(row => ({ id: row.position, pillar: row.pillar }))) : undefined;
  const youOfficerPairs = youOfficerInteractions?.pairs ?? [];
  const columnWitness = (id: string) => witness(id === 'decadal' ? luck : native.find(row => row.position === id)!);
  const rootClashPairs = youOfficerPairs.filter(pair => pair.kind === '六冲');
  const xinExactRootsClash = xinRoots.some(root => root.exactStem && rootClashPairs.some(pair => pair.members.includes(root.position)));
  const stemJoins = youOfficerPairs.filter(pair => pair.kind === '天干五合');
  const movingStemJoins = stemJoins.some(pair => pair.members.includes('decadal'));
  const natalXinJoins = stemJoins.some(pair => xinExposedRows.some(row => pair.members.includes(row.position)));
  const nativeGeng = exposed.filter(row => row.stem === '庚');
  const youOfficerClashes = rootClashPairs.filter(pair => pair.members.includes('month')
    || youOfficerBranchRoot && pair.members.includes('decadal')).map(pair => pair.members.map(columnWitness));
  const xinFirstExposureUnopposed = timeKnown ? youOfficerStemRoute === 'xin-new-exposure'
    && !nativeGeng.length && !xinExactRootsClash && !movingStemJoins : undefined;
  const liuJoinsOfficer = natal.year === '癸未' && natal.month === '辛酉' && natal.day === '甲申' && natal.hour === '丙寅'
    ? youOfficerPairs.find(pair => pair.kind === '天干五合' && pair.members.includes('month') && pair.members.includes('hour'))
    : undefined;
  const liuDayMetal = liuJoinsOfficer ? hidden.find(row => row.position === 'day' && row.stem === '庚') : undefined;
  const liuHourFire = liuJoinsOfficer ? hidden.find(row => row.position === 'hour' && row.stem === '丙') : undefined;
  const liuSourceOfficerStrength = liuJoinsOfficer && youOfficer && liuDayMetal && liuHourFire ? {
    monthOfficer: youOfficer,
    officerStem: witness(monthPillar),
    fireStem: columnWitness('hour'),
    stemJoin: liuJoinsOfficer,
    between: columnWitness('day'),
    dayMetal: liuDayMetal,
    hourFire: liuHourFire,
  } : undefined;
  const youOfficerUnopposedShenRoot = timeKnown ? Boolean(xinExposed && youOfficerBranchRoot?.branch === '申'
    && !liuSourceOfficerStrength && !xinExactRootsClash && !natalXinJoins && !youOfficerClashes.length) : undefined;
  const youOfficerStemContactsClear = xinExposed && !liuSourceOfficerStrength
    && !xinExactRootsClash && !natalXinJoins && !movingStemJoins;
  const youOfficerDistinctMovingStem = youOfficerStemContactsClear && !nativeGeng.length
    && (youOfficerStemRoute === 'geng-killer' || youOfficerStemRoute === 'xin-repeat') ? youOfficerStemRoute : undefined;
  const youOfficerRepeatedXinWithNatalGeng = timeKnown ? Boolean(youOfficerStemContactsClear && nativeGeng.length
    && youOfficerStemRoute === 'xin-repeat') : undefined;
  const youOfficerRepeatedGengWithNatalXin = timeKnown ? Boolean(youOfficerStemContactsClear && nativeGeng.length
    && youOfficerStemRoute === 'geng-killer') : undefined;
  const yearMonthYiGengJoin = stemJoins.find(pair => pair.values === '庚乙'
    && pair.members.includes('year') && pair.members.includes('month'));
  const liSourceKillerJoin = youOfficerStemRoute === 'xin-new-exposure' && luckPillar === '辛卯'
    && positions.every((key, index) => natal[key] === liOfficerColumns[index])
    ? yearMonthYiGengJoin : undefined;
  const liSourceMonthClash = liSourceKillerJoin ? rootClashPairs.find(pair => pair.members.includes('month') && pair.members.includes('decadal')) : undefined;
  const liSourceSeals = liSourceMonthClash ? hidden.filter(row => ['day', 'hour'].includes(row.position) && row.stem === '癸'
    && isSeal(row.tenGod) && baziStemFeeds('庚', row.stem) && baziStemFeeds(row.stem, month.dayMaster)) : [];
  const liSourceXinExposureComparison = liSourceKillerJoin && liSourceMonthClash && liSourceSeals.length === 2 ? {
    natalKiller: columnWitness('year'), partner: columnWitness('month'), join: liSourceKillerJoin,
    natalSeals: liSourceSeals, monthClash: liSourceMonthClash,
  } : undefined;
  // 《造化元钥评注》八月甲木另有参政图，时丁与〈论正官〉取印的李图不同。
  const namedFirstXin = youOfficerStemRoute === 'xin-new-exposure' && !nativeGeng.length;
  const taishouSeal = youOfficer && natalPillarSequence === '乙未乙酉甲子丁卯' && ['辛巳', '庚辰'].includes(luckPillar)
    ? hidden.find(row => row.position === 'day' && row.stem === '癸' && isSeal(row.tenGod)) : undefined;
  const xiaolianMovingJoin = namedFirstXin && natalPillarSequence === '丙戌丁酉甲寅丁卯' && luckPillar === '辛丑'
    ? stemJoins.find(pair => pair.members.includes('year') && pair.members.includes('decadal')) : undefined;
  const xiaolianLuckRoot = xiaolianMovingJoin
    ? xinRoots.find(row => row.position === 'decadal' && row.exactStem) : undefined;
  const xiaolianSourceMetalWater = youOfficer && natalPillarSequence === '丙戌丁酉甲寅丁卯'
    && luckPillar === '庚子' && youOfficerStemRoute === 'geng-killer' && luckMainQi.stem === '癸' ? {
      officer: youOfficer, movingMetal: witness(luck),
      movingWater: { ...witness(luck), stem: luckMainQi.stem, god: luckMainQi.tenGod },
      nativeFire: exposed.filter(row => baziStemControls(row.stem, youOfficer.stem) && baziStemControls(luckMainQi.stem, row.stem))
        .map(witness),
    } : undefined;
  const canzhengSourceOfficer = natalPillarSequence === '庚寅乙酉甲子丁卯' && yearMonthYiGengJoin
    && ['庚寅', '辛卯'].includes(luckPillar) ? {
      natalKiller: columnWitness('year'), partner: columnWitness('month'), hourHurt: columnWitness('hour'),
      join: yearMonthYiGengJoin,
      monthClashes: rootClashPairs.filter(pair => pair.members.includes('month')),
      movingJoin: stemJoins.find(pair => pair.members.includes('month') && pair.members.includes('decadal')),
    } : undefined;
  const youOfficerNamedFirstXin = taishouSeal && namedFirstXin && !movingStemJoins ? 'taishou-use-officer'
    : xiaolianLuckRoot ? 'xiaolian-officer-overcontrolled'
      : canzhengSourceOfficer && youOfficerStemRoute === 'xin-new-exposure' && !movingStemJoins
        ? 'canzheng-officer-killer-favourable' : undefined;
  const namedFirstXinEvidence = youOfficerNamedFirstXin ? {
    source: youOfficerNamedFirstXin,
    daySeal: taishouSeal, movingOfficerRoot: xiaolianLuckRoot, movingJoin: xiaolianMovingJoin,
    natalFire: exposed.filter(row => row.stemElement === '火' && baziStemControls(row.stem, '辛')).map(witness),
  } : undefined;
  const youOfficerContext = youOfficer && youOfficerRoutes.length ? {
    monthOfficer: youOfficer, branchRoot: youOfficerBranchRoot,
    movingStem: youOfficerStemRoute ? { ...witness(luck), god: luck.tenGod, route: youOfficerStemRoute } : undefined,
    nativeKillerExposures: nativeGeng.map(witness),
    newExposureSeats: xinNewlyExposedByLuck === true ? native.filter(row => row.hiddenStems.some(hidden => hidden.stem === '辛'))
      .map(row => ({ ...witness(row), stem: '辛' })) : [],
    rootClashes: youOfficerClashes,
    liuSourceOfficerStrength, liSourceXinExposureComparison, namedFirstXinEvidence, canzhengSourceOfficer, xiaolianSourceMetalWater,
    taishouSourceDaySeal: taishouSeal,
    rootReview: xinRoots.map(root => ({ ...root,
      seat: root.branch === '酉' ? 'xin-you-lu' : root.branch === '丑' ? 'metal-storehouse'
        : root.branch === '戌' ? 'metal-residual' : 'other-metal-root',
      opposingColumns: rootClashPairs.filter(pair => pair.members.includes(root.position))
        .map(pair => columnWitness(pair.members.find(id => id !== root.position)!)),
    })),
    exposureReview: [...exposed, luck].filter(row => row.stem === '辛' || row.stem === '庚').map(row => ({
      ...witness(row), god: row.tenGod,
      combiningColumns: youOfficerPairs.filter(pair => pair.kind === '天干五合' && pair.members.includes(row.position))
        .map(pair => columnWitness(pair.members.find(id => id !== row.position)!)),
    })),
    metalFormations: (youOfficerInteractions?.groups ?? []).filter(group => ['巳酉丑', '申酉戌'].includes(group.values))
      .map(group => ({ kind: group.kind, branches: group.values,
        nativeComplete: group.byBranch.every(members => members.some(position => position !== 'decadal')),
        members: group.byBranch.map(members => members.map(columnWitness)),
      })),
    natalContacts: [...exposed.map(row => ({ ...witness(row), god: row.tenGod, kind: '透干' })),
      ...hidden.map(row => ({ ...columnWitness(row.position), stem: row.stem, god: row.tenGod, kind: '支藏' }))].flatMap(row => {
      if (isWealth(row.god) && baziStemFeeds(row.stem, youOfficer.stem)) return [{ source: row, relation: '生' }];
      if ((row.god === '食神' || row.god === '伤官') && baziStemControls(row.stem, youOfficer.stem)) return [{ source: row, relation: '克' }];
      return [];
    }),
  } : undefined;
  const luckComponents = [{ stem: luck.stem, god: luck.tenGod, kind: '运干' },
    { stem: luckMainQi.stem, god: luckMainQi.tenGod, kind: '运支首藏' }];
  const otherLuckComponents = luck.hiddenStems.slice(1).map(row => ({ stem: row.stem, god: row.tenGod, kind: '运支余藏' }));
  const luckWealth = luckComponents.filter(row => isWealth(row.god));
  const monthPeers = hidden.filter(row => row.position === 'month' && isPeer(row.tenGod));
  const isOutput = (god?: string) => god === '食神' || god === '伤官';
  const movingOutput = luckComponents.filter(row => isOutput(row.god));
  const componentsFrom = (rows: typeof godWitnesses) => rows.flatMap(row => [
    ...row.exposedPositions.map(value => ({ ...value, god: row.god, kind: '明透' })),
    ...row.hiddenPositions.map(value => ({ ...value, god: row.god, kind: '支藏' })),
  ]);
  const natalComponents = (include: (god?: string) => boolean) => componentsFrom(godWitnesses.filter(row => include(row.god)));
  const natalOutputs = natalComponents(isOutput);
  const wealthBridges = (arrivals: typeof luckComponents) => monthPeers.flatMap(peer => natalOutputs
    .filter(output => baziStemFeeds(peer.stem, output.stem)).flatMap(output => arrivals
      .filter(money => baziStemFeeds(output.stem, money.stem)).map(movingWealth => ({ peer, output, movingWealth }))));
  const bridgePaths = monthLuJieCandidate ? wealthBridges(luckWealth) : [];
  const bladeSecondaryBridges = month.atYangBlade ? wealthBridges(otherLuckComponents.filter(row => isWealth(row.god))) : [];
  const wealthBridge = bridgePaths.length ? { monthPeers, natalOutputs, luckWealth, paths: bridgePaths } : undefined;
  const nativeWealthRoots = bridgePaths.length || bladeSecondaryBridges.length ? natalComponents(isWealth).map(wealth => ({
    wealth, rootPositions: roots(wealth.stem).filter(root => root.position !== 'decadal'),
  })) : [];
  const withNativeWealth = (paths: typeof bridgePaths) => paths.flatMap(path => nativeWealthRoots
    .filter(row => baziStemFeeds(path.output.stem, row.wealth.stem)).map(row => ({ ...path, ...row })));
  const nativeWealthBridgePaths = withNativeWealth(bridgePaths);
  const bladeWealthPaths = month.atYangBlade ? [...nativeWealthBridgePaths, ...withNativeWealth(bladeSecondaryBridges)]
    .filter(path => path.peer.tenGod === '劫财'
      && baziStemControls(path.peer.stem, path.wealth.stem) && baziStemControls(path.peer.stem, path.movingWealth.stem)) : [];

  const monthBlade = month.atYangBlade && timeKnown
    ? monthPeers.find(row => row.tenGod === '劫财') : undefined;
  const natalForRelations = native.map(row => ({ id: row.position, pillar: row.pillar }));
  const bladeInteractions = monthBlade
    ? baziInteractions([...natalForRelations, { id: 'decadal', pillar: luckPillar }]) : undefined;
  const bladePairs = bladeInteractions?.pairs ?? [];
  const bladeClashes = bladePairs.filter(pair => pair.kind === '六冲');
  const bladeAuthorityPaths = monthBlade ? natalComponents(isAuthority).filter(target => baziStemControls(target.stem, monthBlade.stem))
    .map(authority => ({
      blade: monthBlade, authority, authorityRoots: roots(authority.stem).filter(row => row.position !== 'decadal'),
      movingWealth: luckWealth.filter(row => baziStemFeeds(row.stem, authority.stem)),
      movingPeer: luckComponents.filter(row => isPeer(row.god)),
      movingSeal: luckComponents.filter(row => isSeal(row.god) && baziStemFeeds(authority.stem, row.stem)
        && baziStemFeeds(row.stem, monthBlade.stem)),
      movingOutput: authority.god === '七杀' ? movingOutput.filter(row => baziStemControls(row.stem, authority.stem)) : [],
    })) : [];
  const exposedBlades = monthBlade ? exposed.filter(row => row.stem === monthBlade.stem) : [];
  const exposedBlade = exposedBlades.length === 1 ? witness(exposedBlades[0]) : undefined;
  const exposedKillers = exposedBlade ? exposed.filter(row => row.tenGod === '七杀') : [];
  const exposedKiller = exposedKillers.length === 1 ? witness(exposedKillers[0]) : undefined;
  const bladeKiller = exposedKiller ? bladeAuthorityPaths.find(({ authority }) =>
    authority.kind === '明透' && authority.position === exposedKiller.position) : undefined;
  const bladeKillerJoin = exposedBlade && exposedKiller && bladeKiller
    && baziInteractions([exposedBlade, exposedKiller].map(row => ({ id: row.position, pillar: row.pillar })))
      .pairs.some(pair => pair.kind === '天干五合')
    ? { blade: bladeKiller.blade, exposedBlade, killer: bladeKiller.authority } : undefined;
  const onlyJoinedKiller = (paths: typeof bladeAuthorityPaths) => paths.length > 0
    && paths.every(path => path.authority === bladeKillerJoin?.killer);
  const monthLu = month.atLu && timeKnown ? monthPeers.find(row => row.stem === month.dayMaster) : undefined;
  const luOfficerTargets = monthLu && movingOutput.length ? natalComponents(god => god === '正官')
    .filter(authority => baziStemControls(authority.stem, monthLu.stem))
    .map(authority => ({ route: '建禄', seat: monthLu, authority,
      authorityRoots: roots(authority.stem).filter(row => row.position !== 'decadal'),
      outputs: movingOutput.filter(row => baziStemControls(row.stem, authority.stem)) })) : [];
  const bladeTargets = bladeAuthorityPaths.filter(path => path.movingOutput.length > 0);
  const bladeWealthTargets = bladeAuthorityPaths.filter(path => path.movingWealth.length > 0);
  const authorityOutputTargets = [
    ...bladeTargets.map(path => ({ route: '阳刃', seat: path.blade, authority: path.authority,
      authorityRoots: path.authorityRoots, outputs: path.movingOutput })),
    ...luOfficerTargets,
  ];
  const originalSeals = authorityOutputTargets.length ? componentsFrom(['正印', '偏印'].map(godWitness)) : [];
  const movingSeals = luckComponents.filter(row => isSeal(row.god));
  const movingSecondarySeals = otherLuckComponents.filter(row => isSeal(row.god));
  const authorityOutputPaths = authorityOutputTargets.flatMap(({ outputs, ...target }) => outputs.map(output => ({
    ...target, output,
    originalSealsCheckingOutput: originalSeals.filter(row => baziStemControls(row.stem, output.stem)),
    movingSealsCheckingOutput: (target.route === '阳刃' ? [...movingSeals, ...movingSecondarySeals] : movingSeals)
      .filter(row => baziStemControls(row.stem, output.stem)),
  })));
  const rootedExposedBladeAuthority = (path: Pick<typeof bladeAuthorityPaths[number], 'authority' | 'authorityRoots'>) =>
    path.authority.kind === '明透' && path.authority !== bladeKillerJoin?.killer
      && path.authorityRoots.some(root => root.exactStem);
  const fourGrowthRootClashes = bladeClashes.filter(pair => /[寅申巳亥]/u.test(pair.values));
  const hasUnopposedBladeRoot = (path: Pick<typeof bladeAuthorityPaths[number], 'authority' | 'authorityRoots'>) =>
    rootedExposedBladeAuthority(path) && path.authorityRoots.some(root => root.exactStem
      && !fourGrowthRootClashes.some(pair => pair.members.includes(root.position)));
  const unopposedBladeOutputPaths = authorityOutputPaths.filter(path => path.route === '阳刃' && hasUnopposedBladeRoot(path)
    && path.originalSealsCheckingOutput.length === 0 && path.movingSealsCheckingOutput.length === 0);
  const hasRootedBladeKillerUnderUnopposedOutput = unopposedBladeOutputPaths.some(path => path.output.kind === '运干');
  const hasBladeKillerWithUnopposedBranchOutput = seen(unopposedBladeOutputPaths.some(path => path.output.kind === '运支首藏'
    && !bladeClashes.some(pair => pair.members.includes('month') || pair.members.includes('decadal'))
    && !bladePairs.some(pair => pair.kind === '天干五合' && pair.members.includes(path.authority.position))));

  const strongBladeSourceChart = natalPillarSequence === '丙寅甲午丙申壬辰';
  // 〈论阳刃〉另注明岳武穆原图刃旺煞轻、财印为佐。保留岁运几何，区分刃轻一式。
  const yueBladeAuthority = natalPillarSequence === '癸未乙卯甲子己巳' ? bladeAuthorityPaths.find(path =>
    path.blade.stem === '乙' && path.authority.position === 'hour' && path.authority.kind === '支藏'
    && path.authority.stem === '庚' && path.authority.god === '七杀') : undefined;
  const yueNatalSeals = yueBladeAuthority?.movingWealth.length ? componentsFrom(['正印', '偏印'].map(godWitness)) : [];
  const bladeYueSourceComparison = yueBladeAuthority ? {
    ...yueBladeAuthority,
    wealthControlsSeals: yueBladeAuthority.movingWealth.flatMap(wealth => yueNatalSeals
      .filter(seal => baziStemControls(wealth.stem, seal.stem)).map(seal => ({ wealth, seal }))),
    outputWithOriginalSeal: authorityOutputPaths.filter(path => path.authority === yueBladeAuthority.authority
      && path.originalSealsCheckingOutput.length > 0),
    movingWoodTrine: bladeInteractions?.groups.find(group => group.kind === '三合' && group.values === '亥卯未'
      && group.byBranch.some(positions => positions.includes('decadal'))),
    movingClashAtKiller: bladeClashes.find(pair => pair.members.includes('decadal') && pair.members.includes('hour')),
  } : undefined;
  // The clash chapter calls the year Xin weak against the strong killer in this exact diagram.
  const qianlongSourceShape = natalPillarSequence === '辛卯丁酉庚午丙子';
  const qianlongKiller = qianlongSourceShape ? bladeAuthorityPaths.find(({ authority, blade }) =>
    blade.stem === '辛' && authority.position === 'hour' && authority.stem === '丙' && authority.kind === '明透') : undefined;
  const qianlongOfficer = qianlongKiller && bladeAuthorityPaths.find(({ authority }) =>
    authority.position === 'month' && authority.kind === '明透' && authority.stem === '丁');
  const qianlongWoodClash = qianlongOfficer && bladeClashes.find(pair => pair.members.includes('year') && pair.members.includes('month'));
  const qianlongFireClash = qianlongOfficer && bladeClashes.find(pair => pair.members.includes('day') && pair.members.includes('hour'));
  const bladeQianlongSourceComparison = qianlongKiller && qianlongOfficer && qianlongWoodClash && qianlongFireClash
    && exposedBlade?.position === 'year' && exposedBlade.stem === '辛'
    && baziStemControls(qianlongOfficer.authority.stem, exposedBlade.stem) ? {
      blade: qianlongKiller.blade, exposedRobbery: exposedBlade,
      officer: qianlongOfficer.authority, killer: qianlongKiller.authority,
      woodClash: qianlongWoodClash, fireClash: qianlongFireClash,
      movingPeer: qianlongKiller.movingPeer,
      movingSeal: qianlongKiller.movingSeal,
      movingWealth: [...new Set([...qianlongKiller.movingWealth, ...qianlongOfficer.movingWealth])],
    } : undefined;
  const hasReviewedStrongBladeWealthPath = seen(strongBladeSourceChart
    && ['丙申', '丁酉'].includes(luckPillar)
    && bladeWealthTargets.some(path => rootedExposedBladeAuthority(path) && path.blade.stem === '丁'
      && path.authority.position === 'hour' && path.authority.stem === '壬'
      && path.authorityRoots.some(root => root.position === 'day' && root.exactStem)
      && path.movingWealth.some(row => row.kind === '运支首藏')));
  const hasRootedBladeAuthorityFromBranchWealth = hasReviewedStrongBladeWealthPath === true
    || bladeWealthTargets.some(path => hasUnopposedBladeRoot(path) && path.movingWealth.some(row => row.kind === '运支首藏'));
  // 卷四〈论喜忌干支有别〉另列庚辰、辛丑金得土生，按同一运柱核其支干。
  const hasBladeAuthorityFromSupportedStemWealth = seen(!isWealth(luckMainQi?.tenGod)
    && baziStemFeeds(luckMainQi?.stem, luck.stem)
    && !bladeClashes.some(pair => pair.members.includes('month') || pair.members.includes('decadal'))
    && bladeWealthTargets.some(path => hasUnopposedBladeRoot(path)
      && path.movingWealth.some(row => row.kind === '运干')
      && !bladePairs.some(pair => pair.kind === '天干五合'
        && (pair.members.includes('decadal') || pair.members.includes(path.authority.position)))));
  const officers = exposed.filter(row => row.tenGod === '正官');
  const killers = exposed.filter(row => row.tenGod === '七杀');
  const hasExposedAuthority = officers.length > 0 && killers.length > 0;
  const bladeSealNamedNotStrong = natalPillarSequence === '辛丑甲午丙申壬辰';
  const namedBladeOutputPaths = bladeSealNamedNotStrong && ['己丑', '戊子'].includes(luckPillar)
    ? authorityOutputPaths.filter(path => path.route === '阳刃' && path.authority.position === 'hour'
      && path.authority.kind === '明透' && path.authority.stem === '壬'
      && path.originalSealsCheckingOutput.some(seal => seal.position === 'month' && seal.kind === '明透' && seal.stem === '甲'))
    : [];
  const bladeKillerSourceComparison = namedBladeOutputPaths.length ? {
    paths: namedBladeOutputPaths,
    monthClash: luck.branch === '子' ? baziInteractions([...natalForRelations, { id: 'decadal', pillar: luckPillar }]).pairs
      .find(pair => pair.kind === '六冲' && pair.members.includes('month') && pair.members.includes('decadal')) : undefined,
  } : undefined;
  const hasPrintedBladeStageMonthClash = seen(Boolean(bladeKillerSourceComparison?.monthClash));
  const printedBladeAuthority = bladeSealNamedNotStrong
    ? bladeAuthorityPaths.find(path => path.authority.position === 'hour' && path.authority.kind === '明透'
      && path.authority.stem === '壬' && path.blade.stem === '丁'
      && path.authorityRoots.some(root => root.position === 'day' && root.branch === '申' && root.exactStem)) : undefined;
  const printedBladeSeal = printedBladeAuthority && componentsFrom(['正印', '偏印'].map(godWitness)).find(row => row.position === 'month'
    && row.kind === '明透' && row.stem === '甲' && baziStemFeeds(printedBladeAuthority.authority.stem, row.stem)
    && baziStemFeeds(row.stem, printedBladeAuthority.blade.stem));
  const printedBladeLuck = printedBladeAuthority && printedBladeSeal ? {
    authority: ['癸巳', '壬辰'].includes(luckPillar) ? luckComponents.filter(row => isAuthority(row.god)
      && baziStemFeeds(row.stem, printedBladeSeal.stem)) : [],
    unrootedWealth: ['辛卯', '庚寅'].includes(luckPillar) && !luck.hiddenStems.some(row => row.element === luck.stemElement)
      ? printedBladeAuthority.movingWealth.filter(row => row.kind === '运干') : [],
    outputsCheckedBySeal: luckPillar === '己丑' ? namedBladeOutputPaths.filter(path =>
      path.authority.position === printedBladeAuthority.authority.position && path.authority.stem === printedBladeAuthority.authority.stem)
      .map(path => path.output) : [],
  } : undefined;
  const bladePrintedSupportRoute = printedBladeLuck?.authority.length ? 'incoming-authority-to-seal'
    : printedBladeLuck?.unrootedWealth.length ? 'unrooted-wealth-to-killer-to-seal'
    : printedBladeLuck?.outputsCheckedBySeal.length ? 'seal-checks-incoming-output' : undefined;
  const bladePrintedSupport = bladePrintedSupportRoute && printedBladeAuthority && printedBladeSeal && printedBladeLuck ? {
    route: bladePrintedSupportRoute, killer: printedBladeAuthority.authority,
    killerRoots: printedBladeAuthority.authorityRoots, seal: printedBladeSeal,
    blade: printedBladeAuthority.blade, ...printedBladeLuck,
  } : undefined;
  const pressuredHiddenOfficer = natalPillarSequence === '戊子戊午丙辰戊戌'
    ? bladeAuthorityPaths.find(path => path.authority.position === 'year' && path.authority.kind === '支藏'
      && path.authority.stem === '癸') : undefined;
  const bladeFoodPressure = pressuredHiddenOfficer ? natalOutputs.filter(row => row.kind === '明透'
    && row.stem === '戊' && baziStemControls(row.stem, pressuredHiddenOfficer.authority.stem)) : [];
  const bladeFoodReliefComparison = pressuredHiddenOfficer && bladeFoodPressure.length === 3 ? {
    officer: pressuredHiddenOfficer.authority, blade: pressuredHiddenOfficer.blade, outputs: bladeFoodPressure,
    sealsCheckingOutput: luckComponents.filter(row => isSeal(row.god) && baziStemFeeds(row.stem, pressuredHiddenOfficer.blade.stem)
      && bladeFoodPressure.every(output => baziStemControls(row.stem, output.stem))),
  } : undefined;
  // Xu keeps natal Bing as the killer and uses the hour Ren to join the exposed month officer.
  const clearingJoin = natalPillarSequence === '丙戌丁酉庚申壬午' ? bladePairs.find(pair => pair.kind === '天干五合'
    && pair.members.includes('month') && pair.members.includes('hour')) : undefined;
  const clearingBladePath = clearingJoin && bladeAuthorityPaths.find(path =>
    path.authority.kind === '明透' && path.authority.position === 'year' && path.authority.stem === '丙');
  const clearingOfficer = clearingBladePath && natalComponents(isAuthority).find(row =>
    row.kind === '明透' && row.position === 'month' && row.stem === '丁');
  const clearingHelper = clearingBladePath && natalOutputs.find(row =>
    row.kind === '明透' && row.position === 'hour' && row.stem === '壬');
  const clearingOutput = clearingBladePath && ['壬寅', '癸卯'].includes(luckPillar)
    ? clearingBladePath.movingOutput.find(row => row.kind === '运干') : undefined;
  const clearingWealth = clearingOutput && clearingBladePath
    ? clearingBladePath.movingWealth.find(row => row.kind === '运支首藏') : undefined;
  const clearingSeal = clearingHelper && ['戊戌', '己亥'].includes(luckPillar)
    ? movingSeals.find(row => row.kind === '运干' && baziStemControls(row.stem, clearingHelper.stem)) : undefined;
  const bladeClearingSourceComparison = clearingJoin && clearingBladePath && clearingOfficer && clearingHelper
    && (clearingOutput || clearingSeal) ? {
      authority: clearingBladePath.authority, blade: clearingBladePath.blade, officer: clearingOfficer, helper: clearingHelper,
      join: clearingJoin, output: clearingOutput, wealth: clearingWealth, seal: clearingSeal,
    } : undefined;
  const heshenWealthPaths = natalPillarSequence === '庚午乙酉庚午壬午' && luckPillar === '庚寅'
    ? bladeAuthorityPaths.filter(path => path.blade.stem === '辛' && path.authority.kind === '支藏'
      && path.authority.stem === '丁' && path.authority.branch === '午'
      && path.movingWealth.some(row => row.kind === '运支首藏' && row.stem === '甲')) : [];
  const bladeWealthSourceComparison = heshenWealthPaths.length ? {
    paths: heshenWealthPaths, movingYin: witness(luck), natalWu: native.filter(row => row.branch === '午').map(witness),
  } : undefined;
  const jiaBladeGeng = natalPillarSequence === '甲寅庚午戊申甲寅' && ['壬申', '癸酉'].includes(luckPillar)
    ? natalOutputs.find(row => row.position === 'month' && row.kind === '明透' && row.stem === '庚') : undefined;
  const jiaBladeOutputPaths = jiaBladeGeng ? authorityOutputPaths.filter(path => path.route === '阳刃'
    && path.authority.kind === '明透' && path.authority.stem === '甲' && ['year', 'hour'].includes(path.authority.position)
    && path.output.kind === '运支首藏' && baziStemControls(jiaBladeGeng.stem, path.authority.stem)) : [];
  const bladeKillerJiaComparison = jiaBladeGeng && jiaBladeOutputPaths.length ? {
    paths: jiaBladeOutputPaths, originalMetal: jiaBladeGeng, moving: witness(luck),
    movingWater: luckComponents.find(row => row.kind === '运干' && ['壬', '癸'].includes(row.stem)),
    natalFireMembers: native.filter(row => row.position === 'year' || row.position === 'month').map(witness),
    monthFireSeal: hidden.find(row => row.position === 'month' && row.stem === '丁' && isSeal(row.tenGod)),
    natalShenWater: hidden.find(row => row.position === 'day' && row.branch === '申' && row.stem === '壬'),
    shenClashes: baziInteractions([...natalForRelations, { id: 'decadal', pillar: luckPillar }]).pairs
      .filter(pair => pair.kind === '六冲' && pair.members.some(position => position === 'day' || position === 'decadal')),
  } : undefined;
  const bladeKillerNamedNotStrong = bladeSealNamedNotStrong || Boolean(bladeKillerJiaComparison);
  const muBladeOfficer = natalPillarSequence === '甲午癸酉庚寅戊寅'
    ? bladeAuthorityPaths.find(path => path.authority.position === 'year' && path.authority.kind === '支藏'
      && path.authority.stem === '丁' && path.blade.stem === '辛') : undefined;
  const muBladeOutput = muBladeOfficer ? authorityOutputPaths.filter(path => path.route === '阳刃'
    && path.authority.stem === '丙' && ['day', 'hour'].includes(path.authority.position)) : [];
  const bladeKillerMuOfficerComparison = muBladeOfficer && muBladeOutput.length ? {
    authority: muBladeOfficer.authority, blade: muBladeOfficer.blade, outputPaths: muBladeOutput,
    officerPressure: movingOutput.filter(output => baziStemControls(output.stem, muBladeOfficer.authority.stem)),
    officerClash: bladeClashes.find(pair => pair.members.includes('decadal') && pair.members.includes(muBladeOfficer.authority.position)),
  } : undefined;
  const jinOfficerCase = natalPillarSequence === '庚戌戊子癸酉癸亥' && ['庚寅', '辛卯', '壬辰'].includes(luckPillar);
  const liOfficerCase = natalPillarSequence === '丁酉丙午丁巳壬寅' && ['己亥', '戊戌'].includes(luckPillar);
  const luOfficerSourceRoute = jinOfficerCase ? 'jin-printed-protection'
    : liOfficerCase ? luckPillar === '己亥' ? 'li-ji-hai-neutral' : 'li-wu-xu-pressure' : undefined;
  const luOfficerSourcePaths = luOfficerSourceRoute
    ? authorityOutputPaths.filter(path => path.route === '建禄' && path.authority.kind === '明透'
      && (jinOfficerCase ? path.authority.position === 'month' && path.authority.stem === '戊'
        && path.originalSealsCheckingOutput.some(seal => seal.position === 'year' && seal.kind === '明透' && seal.stem === '庚')
        : path.authority.position === 'hour' && path.authority.stem === '壬'))
    : [];
  const liOfficer = liOfficerCase ? luOfficerSourcePaths[0]?.authority : undefined;
  const luOfficerSourceComparison = luOfficerSourceRoute ? {
    route: luOfficerSourceRoute, paths: luOfficerSourcePaths,
    wealthToOfficer: liOfficer ? { officer: liOfficer,
      sources: natalComponents(isWealth).filter(row => row.kind === '支藏'
        && (row.position === 'year' && row.branch === '酉' || row.position === 'day' && row.branch === '巳')
        && baziStemFeeds(row.stem, liOfficer.stem)) } : undefined,
  } : undefined;
  const luOfficerSourceExcludesRisk = Boolean(luOfficerSourceComparison?.paths.length && (jinOfficerCase || luckPillar === '己亥'));
  const namedLuOfficerRisk = luOfficerSourceRoute === 'li-wu-xu-pressure'
    && luOfficerSourcePaths.some(path => path.output.kind === '运干' && path.output.stem === '戊');
  const bladeWealthExample = natalPillarSequence === '甲申丙子壬寅辛亥' && bladeWealthPaths.length ? {
    yinHai: baziInteractions(natalForRelations).pairs.find(pair => pair.kind === '六合'
      && pair.members.includes('day') && pair.members.includes('hour')),
    shenZiChen: [...'申子辰'].map(branch => ({ branch, positions: native.filter(row => row.branch === branch).map(row => row.position) })),
  } : undefined;
  const wuSourcePaths = natalPillarSequence === '戊子戊午戊戌戊午'
    ? bladeWealthPaths.filter(path => path.rootPositions.length > 0) : [];
  const wuSourceBridge = wuSourcePaths.length && wuSourcePaths.every(({ output, wealth }) =>
    output.position === 'day' && output.branch === '戌' && output.stem === '辛' && output.kind === '支藏'
      && wealth.position === 'year' && wealth.branch === '子' && wealth.stem === '癸') ? wuSourcePaths[0] : undefined;
  const bladeWealthBridgeSourceComparison = wuSourceBridge ? {
    output: wuSourceBridge.output, wealth: wuSourceBridge.wealth, natalBranches: native.map(witness),
  } : undefined;
  const nativePairs = monthLuJieCandidate && hasExposedAuthority ? baziInteractions(natalForRelations)
    .pairs.filter(pair => pair.kind === '天干五合' && !pair.members.includes('day')) : [];
  const luJieLuck = [...luckComponents, ...otherLuckComponents];
  const peerLuck = luJieLuck.filter(row => row.god === '比肩' && row.stem === month.dayMaster);
  const luJieWealth = luJieLuck.filter(row => isWealth(row.god));
  const sealsSupportingDay = luJieLuck.filter(row => isSeal(row.god) && baziStemFeeds(row.stem, month.dayMaster));
  const luJiePressure = luJieLuck.filter(row => isAuthority(row.god) && baziStemControls(row.stem, month.dayMaster));
  const luJieAuthorityPaths = monthLuJieCandidate && hasExposedAuthority ? killers.flatMap(killer => {
    const combinations = nativePairs.filter(pair => pair.members.includes(killer.position)).map(pair => ({
      pair, helper: witness(exposed.find(row => row.position !== killer.position && pair.members.includes(row.position))!),
    }));
    const controls = natalOutputs.filter(row => baziStemControls(row.stem, killer.stem));
    if (!combinations.length && !controls.length) return [];
    const killerRoots = roots(killer.stem);
    const outputLuck = luJieLuck.filter(row => isOutput(row.god) && baziStemControls(row.stem, killer.stem));
    return officers.map(officer => ({
      killer: witness(killer), officer: witness(officer), combinations, controls, killerRoots, outputLuck, peerLuck,
      sealsSupportingDay,
      sealsCheckingOutput: controls.flatMap(output => luJieLuck.filter(row => isSeal(row.god)
        && baziStemControls(row.stem, output.stem)).map(seal => ({ output, seal }))),
      outputAlsoChecksOfficer: outputLuck.filter(row => baziStemControls(row.stem, officer.stem)),
      wealthFeedsKiller: luJieWealth.filter(row => baziStemFeeds(row.stem, killer.stem)),
      wealthFeedsOfficer: luJieWealth.filter(row => baziStemFeeds(row.stem, officer.stem)),
      authorityPressure: luJiePressure,
    }));
  }) : [];
  const namedSealChecksFood = natalPillarSequence === '辛亥庚寅甲申丙寅' && luckPillar === '戊子'
    && luJieAuthorityPaths.some(path => path.killer.position === 'month' && path.killer.stem === '庚'
      && path.sealsCheckingOutput.some(({ output, seal }) => output.position === 'hour' && output.kind === '明透' && output.stem === '丙'
        && seal.kind === '运支首藏' && seal.stem === '癸'));
  const luJieAuthorityMatched = luJieAuthorityPaths.some(path => path.outputLuck.length || path.peerLuck.length
    || path.sealsSupportingDay.length || path.sealsCheckingOutput.length || path.wealthFeedsKiller.length
    || path.wealthFeedsOfficer.length || path.authorityPressure.length);

  const luJieOutputPaths = monthLuJieCandidate ? natalOutputs.flatMap(output => {
    const feedingPeers = monthPeers.filter(row => baziStemFeeds(row.stem, output.stem));
    if (!feedingPeers.length) return [];
    const outputRoots = roots(output.stem).filter(root => root.position !== 'decadal');
    const movingSeal = luJieLuck.filter(row => isSeal(row.god) && baziStemControls(row.stem, output.stem)
      && baziStemFeeds(row.stem, month.dayMaster));
    const movingWealth = luJieWealth.filter(row => baziStemFeeds(output.stem, row.stem));
    const movingAuthority = luJieLuck.filter(row => (row.god === '七杀' || row.god === '正官' && row.kind === '运干')
      && baziStemControls(row.stem, month.dayMaster) && baziStemControls(output.stem, row.stem));
    return [{ output, feedingPeers, outputRoots, movingSeal, movingWealth, movingAuthority }];
  }) : [];

  const zhangOutputCase = natalPillarSequence === '甲子丙寅甲子丙寅';
  const metalWaterOutputCase = natalPillarSequence === '癸卯庚申庚子庚辰';
  const zhangOutputCaseEvidence = zhangOutputCase ? {
    natalZiSeals: hidden.filter(row => row.branch === '子' && row.stem === '癸' && isSeal(row.tenGod)),
    natalFoodRoots: roots('丙').filter(row => row.position !== 'decadal' && row.exactStem),
    gengKiller: luckPillar === '庚午' && luJieOutputPaths.some(path => path.movingAuthority.some(row => row.kind === '运干' && row.stem === '庚')),
    gengRoots: luckPillar === '庚午' ? roots('庚') : [],
    xinOutputPairs: luckPillar === '辛未' ? baziInteractions([...natalForRelations, { id: 'decadal', pillar: luckPillar }]).pairs
      .filter(pair => pair.kind === '天干五合' && pair.members.includes('decadal')
        && luJieOutputPaths.some(path => path.output.kind === '明透' && path.output.stem === '丙' && pair.members.includes(path.output.position))) : [],
    renShenAuthoritySeal: luckPillar === '壬申' && luJieOutputPaths.some(path => path.movingSeal.some(row => row.kind === '运干' && row.stem === '壬')
      && path.movingAuthority.some(row => row.kind === '运支首藏' && row.stem === '庚')),
  } : undefined;
  const metalWaterOutputCaseEvidence = metalWaterOutputCase && fireAbsent === true ? {
    waterGroup: baziInteractions(natalForRelations).groups.find(group => group.kind === '三合' && group.values === '申子辰'),
    natalWealthLinks: luJieOutputPaths.filter(path => path.output.kind === '明透').flatMap(path => natalComponents(isWealth)
      .filter(wealth => baziStemFeeds(path.output.stem, wealth.stem)).map(wealth => ({ output: path.output, wealth }))),
    fireAuthority: luJiePressure.filter(row => row.stem === '丙' || row.stem === '丁'),
  } : undefined;
  const metalWaterSealRelief = luckPillar === '己未' && metalWaterOutputCaseEvidence?.waterGroup
    && metalWaterOutputCaseEvidence.natalWealthLinks.length ? luJieOutputPaths.flatMap(({ output, movingSeal }) =>
      output.position === 'year' && output.kind === '明透' && output.stem === '癸'
        ? movingSeal.filter(seal => seal.stem === '己' && seal.kind !== '运支余藏').map(seal => ({ output, seal })) : []) : [];
  const namedZhangOutput = zhangOutputCaseEvidence?.gengKiller === true && zhangOutputCaseEvidence.gengRoots.length === 0
    || Boolean(zhangOutputCaseEvidence?.xinOutputPairs.length);
  const namedFireAuthority = luckPillar === '丁巳' && Boolean(metalWaterOutputCaseEvidence?.waterGroup)
    && metalWaterOutputCaseEvidence?.fireAuthority.some(row => row.kind === '运干' && row.stem === '丁') === true
    && metalWaterOutputCaseEvidence.fireAuthority.some(row => row.kind === '运支首藏' && row.stem === '丙');
  const luJieOutputMatched = namedZhangOutput || namedFireAuthority || luJieOutputPaths.some(path => path.movingSeal.length > 0);
  const has = (god: string) => godWitnesses.find(row => row.god === god)!.present;
  const any = (gods: string[]) => gods.some(god => has(god) === true) ? true : timeKnown ? false : undefined;
  const natalZiShen = ['子', '申'].map(branch => ({ branch, positions: native.filter(p => p.branch === branch).map(p => p.position) }));
  const hasZiShen = natalZiShen.every(row => row.positions.length) ? true : timeKnown ? false : undefined;
  const gaoSameColumns = timeKnown ? positions.every((position, i) => natal[position] === zpqzGaoColumns[i]) : undefined;
  const gaoBase = month.dayMaster === '庚' && month.monthBranch === '申' && hasZiShen === true && fireAbsent === true;
  const gaoContext = gaoBase ? {
    birthTiming: shenMonthTiming(natal.utc),
    waterSeats: ['子', '申', '辰'].map(branch => ({ branch, positions: native.filter(row => row.branch === branch).map(witness) })),
    shenMetalAndWater: hidden.filter(row => row.branch === '申' && ['庚', '壬'].includes(row.stem)),
    ziWater: hidden.filter(row => row.branch === '子' && row.stem === '癸'),
    fireAuthority: luckComponents.filter(row => ['丙', '丁'].includes(row.stem) && isAuthority(row.god)
      && baziStemControls(row.stem, month.dayMaster)),
    minorFire: luck.hiddenStems.slice(1).filter(row => row.element === '火' && isAuthority(row.tenGod)),
    metalAndWater: luckComponents.filter(row => ['庚', '辛', '壬', '癸'].includes(row.stem)),
    soil: luckComponents.filter(row => ['戊', '己'].includes(row.stem)),
  } : undefined;
  const gaoSoilReturns = gaoContext?.soil.length ? exposed.filter(row => row.stem === '甲').flatMap(wood =>
    gaoContext.soil.filter(soil => baziStemControls(wood.stem, soil.stem)).map(soil => ({
      wood: witness(wood), soil, woodRoots: roots(wood.stem).filter(row => row.position !== 'decadal'),
      combinesMovingStem: soil.kind === '运干' && baziInteractions([witness(wood), witness(luck)]
        .map(row => ({ id: row.position, pillar: row.pillar }))).pairs.some(row => row.kind === '天干五合'),
    }))) : [];
  return { profile: zpqzMonthPolicy.profile, timeKnown, ...month,
    natalPillars: native.map(witness), natalPillarSequence,
    monthMainQi: monthMainQi?.stem, monthMainQiGod: monthMainQi?.tenGod,
    mainQiJieCandidate, monthLuJieCandidate, wealthBridge,
    wealthBridgeCandidate: !monthLuJieCandidate || !monthPeers.length || !luckWealth.length ? false : seen(!!wealthBridge),
    nativeWealthBridgePaths, hasNativeWealthBridge: nativeWealthBridgePaths.length > 0,
    bladeWealthMatched: bladeWealthPaths.some(path => path.rootPositions.length > 0), bladeWealthPaths, bladeWealthExample,
    bladeWealthBridgeSourceComparison, bladeWealthSourceExcludesBridge: timeKnown ? Boolean(bladeWealthBridgeSourceComparison) : undefined,
    bladeAuthorityPaths, hasBladeAuthorityWealth: bladeWealthTargets.length > 0, hasRootedBladeAuthorityFromBranchWealth,
    hasBladeAuthorityFromSupportedStemWealth,
    bladeFourGrowthRootClashes: fourGrowthRootClashes.filter(pair => bladeAuthorityPaths.some(path =>
      path.authorityRoots.some(root => root.exactStem && pair.members.includes(root.position)))),
    hasBladeKillerWithUnopposedBranchOutput,
    hasReviewedStrongBladeWealthPath,
    bladeKillerJoin,
    bladeAuthorityWealthOnlyJoinedKiller: timeKnown ? onlyJoinedKiller(bladeWealthTargets) : undefined,
    bladeOutputOnlyJoinedKiller: timeKnown ? onlyJoinedKiller(bladeTargets) : undefined,
    bladeWealthSourceComparison,
    bladeWealthSourceExcludesBenefit: seen(Boolean(bladeWealthSourceComparison || bladeSealNamedNotStrong || bladeClearingSourceComparison?.wealth)),
    hasBladeAuthoritySupport: bladeAuthorityPaths.some(row => row.movingPeer.length > 0 || row.movingSeal.length > 0),
    bladePrintedSupport, bladePrintedSupportRoute,
    bladeFoodReliefComparison, bladeSupportStrongSource: timeKnown ? strongBladeSourceChart : undefined,
    bladeSupportDifferentRationale: seen(Boolean(bladeFoodReliefComparison || strongBladeSourceChart
      || bladeClearingSourceComparison?.seal || bladeYueSourceComparison)),
    bladeYueSourceComparison, bladeQianlongSourceComparison,
    hasQianlongSourceBladeSupport: seen(Boolean(bladeQianlongSourceComparison
      && (bladeQianlongSourceComparison.movingPeer.length || bladeQianlongSourceComparison.movingSeal.length))),
    qianlongSourceBladeWealthNotSuitable: seen(Boolean(bladeQianlongSourceComparison?.movingWealth.length)),
    authorityOutputPaths, bladeKillerNamedNotStrong, bladeKillerSourceComparison, hasPrintedBladeStageMonthClash, bladeKillerJiaComparison,
    bladeKillerMuOfficerComparison, bladeKillerSourceUsesOfficer: timeKnown ? Boolean(muBladeOfficer) : undefined,
    bladeClearingSourceComparison, bladeKillerSourceAllowsRestraint: seen(Boolean(bladeClearingSourceComparison?.output)),
    hasBladeKillerOutput: authorityOutputPaths.some(row => row.route === '阳刃'), hasRootedBladeKillerUnderUnopposedOutput,
    luOfficerSourceComparison, luOfficerSourceExcludesRisk, namedLuOfficerRisk,
    hasLuOfficerOutput: authorityOutputPaths.some(row => row.route === '建禄'),
    luJieAuthorityMatched, luJieAuthorityPaths, namedSealChecksFood,
    luJieOutputMatched, luJieOutputPaths,
    zhangOutputCaseEvidence, metalWaterOutputCaseEvidence, metalWaterSealRelief,
    metalWaterSealReliefMatched: metalWaterSealRelief.length > 0,
    monthHidesPeer: native.find(p => p.position === 'month')!.hiddenStems.some(h => h.tenGod === '比肩'),
    monthJieIdentityVerified: false, fullPatternVerified: false,
    godWitnesses, hasOfficer: has('正官'), hasKiller: has('七杀'), hasOfficerOrKiller: any(['正官', '七杀']),
    hasFoodHurt: any(['食神', '伤官']), exposedOfficerAndKiller: seen(hasExposedAuthority),
    jiaYouMonth, xinExposed, xinHidden, youOfficerRoutes, youOfficerContext, xinFirstExposureUnopposed,
    youOfficerUnopposedShenRoot, youOfficerDistinctMovingStem, youOfficerRepeatedXinWithNatalGeng,
    youOfficerRepeatedGengWithNatalXin, youOfficerNamedFirstXin,
    youOfficerSourceBenefitsMetal: timeKnown ? Boolean(taishouSeal || xiaolianLuckRoot || xiaolianSourceMetalWater?.nativeFire.length
      || canzhengSourceOfficer) : undefined,
    youOfficerSourceExcludesNewClearExposure: timeKnown ? Boolean(liSourceXinExposureComparison) : undefined,
    liuSourceOfficerStrong: timeKnown ? Boolean(liuSourceOfficerStrength) : undefined,
    xinExposedPositions: xinExposedRows.map(witness), xinHiddenPositions: xinHiddenRows,
    xinNewlyExposedByLuck,
    xinRoots, dayMasterRoots: roots(month.dayMaster),
    luckPillar, luckStem: luck.stem, luckBranch: luck.branch, luckTenGod: luck.tenGod,
    luckHiddenStems: luck.hiddenStems, luckBranchMainQi: luckMainQi?.stem, luckBranchMainQiGod: luckMainQi?.tenGod,
    luckFireStem: luck.stemElement === '火', luckFireBranch: '巳午'.includes(luck.branch),
    fireMovementCandidate: luck.stemElement === '火' || '巳午'.includes(luck.branch),
    nativeFireWitnesses, fireAbsent, natalZiShen, hasZiShen, gaoSameColumns,
    gaoContext, gaoSoilReturns, hasGaoFireAuthority: Boolean(gaoContext?.fireAuthority.length),
    gaoPrintedColumns: [...zpqzGaoColumns], gaoFireCommentConflict: true,
    strengthVerified: false, transformationVerified: false };
}
