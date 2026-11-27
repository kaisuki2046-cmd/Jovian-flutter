import { baziColumnRoles, baziInteractions, baziStemControls, baziStemFeeds, type BaziColumnRole } from './bazi-calculation';
import { smthLuNextBranch, smthSeasonalPowers } from './bazi-annual-luck';
import { smthMonthDuty } from './bazi-smth-month-duty';

const natalColumns = ['year', 'month', 'day', 'hour'] as const;
type Natal = Record<typeof natalColumns[number], string>;
type Luck = { status: 'confirmed'; pillar: string } | { status: 'before_luck' | 'unavailable' };

export const smthSealHurtingPolicy = {
  profile: 'smth-seal-hurting-officer-v1',
  calendar: 'same-natal-candidate-and-beijing-solar-year-with-confirmed-luck-intersection',
  placement: 'distinguish-exposed-main-qi-and-other-hidden; month-secondary-root-must-be-exposed',
  officerSupport: 'own-branch-main-qi-or-natal-month-main-qi-or-smth-printed-month-officer-exposed',
  blade: 'day-stem-lu-next-branch-and-same-window-visible-or-main-qi-killer-candidates',
  wealthPeer: 'smth-hurting-built-lu-peer-wealth-path-v1',
  sealOfficerReview: 'smth-seal-officer-directed-positions-v1',
  outcome: 'geometric-candidates-only; no-strength-usefulness-or-rescue-decision',
} as const;

const seal = (god: string | undefined) => god === '正印' || god === '偏印';
const wealth = (god: string | undefined) => god === '正财' || god === '偏财';
const peer = (god: string | undefined) => god === '比肩' || god === '劫财';
const visibleOrMain = (role: BaziColumnRole) => role.placement !== 'other_hidden';
const officerOrKiller = (role: BaziColumnRole) => role.god === '正官' || role.god === '七杀';
// 《三命通会》卷五〈论正官〉列出的月建官星，须核同干支藏干透。
const smthOfficerMonthSeats: Readonly<Record<string, string>> = {
  甲: '酉', 乙: '申巳', 丙: '子', 丁: '亥', 戊: '卯', 己: '寅', 庚: '午', 辛: '寅巳', 壬: '午未丑', 癸: '辰巳戌',
};
// The printed month-branch cases specify the natal seat of the officer.
const namedHiddenMonthCases = [
  { caseId: 'yi-si-geng-shen', dayMaster: '乙', monthBranch: '巳', hour: '甲申',
    hurtStem: '丙', officerStem: '庚', officerPlacement: 'main_qi', movingPillar: '庚申' },
  { caseId: 'bing-wu-gui-chou', dayMaster: '丙', monthBranch: '午', hour: '戊子',
    hurtStem: '己', officerStem: '癸', officerPlacement: 'main_qi', movingPillar: '癸丑' },
  { caseId: 'bing-wu-gui-chou', dayMaster: '丙', monthBranch: '午', hour: '癸巳',
    hurtStem: '己', officerStem: '癸', officerPlacement: 'stem', movingPillar: '癸丑' },
] as const;
type MonthDuty = ReturnType<typeof smthMonthDuty>;

function smthPeerWealth(natal: Natal, native: BaziColumnRole[], moving: BaziColumnRole[],
  natalHurt: BaziColumnRole[], luckPeers: BaziColumnRole[], duty: MonthDuty, verifiedFemale: boolean) {
  const dayMaster = natal.day[0];
  const builtLuMonth = natal.month[1] === smthLuNextBranch(dayMaster).luBranch;
  const decadalRoles = moving.filter(row => row.column === 'decadal');
  const targets = [...native, ...decadalRoles].filter(row => wealth(row.god) && visibleOrMain(row));
  const monthSecondaryHurt = natalHurt.filter(row => row.column === 'month' && row.placement === 'other_hidden');
  const hurtingSources = natalHurt.filter(row => row.placement === 'stem'
    || (row.column === 'month' && (row.placement === 'main_qi' || row.stem === duty?.slot?.stem)));
  const peerWealthPaths = targets.flatMap(target => {
    const peers = luckPeers.filter(row => baziStemControls(row.stem, target.stem));
    return peers.length ? [{ target, peers, hurtingSources: target.column === 'decadal' ? []
      : hurtingSources.filter(source => baziStemFeeds(source.stem, target.stem)) }] : [];
  });
  const officers = [...native, ...moving].filter(row => visibleOrMain(row) && officerOrKiller(row));
  const competingControls = peerWealthPaths.length ? luckPeers.flatMap(peer => {
    const targets = peerWealthPaths.filter(row => row.peers.includes(peer)).map(row => row.target);
    const controls = officers.filter(row => baziStemControls(row.stem, peer.stem));
    return targets.length && controls.length ? [{ peer, officers: controls, targets }] : [];
  }) : [];
  const onlyHiddenWealth = !targets.length && [...native, ...decadalRoles].some(row => wealth(row.god));
  const hurtingPeerWealthCandidate = peerWealthPaths.some(row => row.hurtingSources.length)
    ? true : monthSecondaryHurt.length && !hurtingSources.length && peerWealthPaths.length ? undefined : false;
  // 三命通会卷七论女命明载此四柱伤官用财，原局无庚根仍可核同一处财。
  const namedHurtingWealthUse = verifiedFemale
    && natal.year === '癸未' && natal.month === '乙卯' && natal.day === '庚子' && natal.hour === '庚辰'
    && peerWealthPaths.some(({ target, hurtingSources }) => target.column === 'month' && target.stem === '乙'
      && hurtingSources.some(source => source.column === 'year' && source.stem === '癸' && source.placement === 'stem'));
  const builtLuNoWealthOfficerWithPeer = builtLuMonth && !native.some(row => wealth(row.god) || officerOrKiller(row))
    && luckPeers.some(visibleOrMain);
  const builtLuSourceNoWealthOrOfficer = builtLuNoWealthOfficerWithPeer
    && ['甲寅', '乙卯'].includes(dayMaster + natal.month[1])
    && !moving.some(row => wealth(row.god) || officerOrKiller(row));
  return { wealthPeerProfile: smthSealHurtingPolicy.wealthPeer, builtLuMonth, hurtingPeerWealthCandidate,
    namedHurtingWealthUse, builtLuNoWealthOfficerWithPeer, builtLuSourceNoWealthOrOfficer,
    builtLuPeerWealthCandidate: peerWealthPaths.length > 0 ? true : onlyHiddenWealth && luckPeers.length ? undefined : false,
    monthHurtDutyDay: hurtingSources.some(row => row.placement === 'other_hidden') ? duty?.elapsedDay : undefined,
    peerWealthPaths, peerOfficerControls: competingControls };
}

const sourceMainQiSealMonths: Partial<Record<string, string>> = { 水: '亥子', 木: '寅卯', 火: '巳午', 金: '申酉' };

function smthSealWealthReview(dayMaster: string, monthSeals: BaziColumnRole[], monthSealCandidates: BaziColumnRole[], native: BaziColumnRole[],
  moving: BaziColumnRole[], movingWealth: BaziColumnRole[], luckPeers: BaziColumnRole[], luckStatus: Luck['status'], duty: MonthDuty,
  groups: ReturnType<typeof baziInteractions>['groups']) {
  const luckKnown = luckStatus !== 'unavailable';
  const dutySeal = monthSeals.find(row => row.placement === 'other_hidden' && row.stem === duty?.slot?.stem);
  const targets = dutySeal && !monthSealCandidates.includes(dutySeal) ? [...monthSealCandidates, dutySeal] : monthSealCandidates;
  const nativeWealth = native.filter(row => wealth(row.god) && visibleOrMain(row));
  const nativePeers = native.filter(row => row.god === '比肩' && visibleOrMain(row));
  const roles = [...native, ...moving];
  const officers = roles.filter(row => visibleOrMain(row) && officerOrKiller(row));
  const sealLuckWealthAssemblies = targets.length ? groups.flatMap(group => {
    if (group.kind !== '三合') return [];
    const positions = group.byBranch.map(columns => columns.filter(column => column !== 'annual'));
    if (!positions.every(columns => columns.length) || !positions.some(columns => columns.length === 1 && columns[0] === 'decadal')) return [];
    const peak = [...native, ...moving].find(row => positions[1].includes(row.column) && row.placement === 'main_qi' && wealth(row.god));
    const affectedSeals = peak ? targets.filter(row => baziStemControls(peak.stem, row.stem)) : [];
    return peak && affectedSeals.length ? [{ branches: group.values, positions, peak, affectedSeals }] : [];
  }) : [];
  const sealWealthPaths = targets.map(target => {
    const arrivingWealth = movingWealth.filter(row => baziStemControls(row.stem, target.stem));
    const natalWealth = nativeWealth.filter(row => baziStemControls(row.stem, target.stem));
    const feedingOfficers = officers.filter(row => baziStemFeeds(row.stem, target.stem));
    return {
      target,
      dutyDay: target === dutySeal ? duty?.elapsedDay : undefined,
      arrivingWealth,
      natalYearHourWealth: natalWealth.filter(row => row.column === 'year' || row.column === 'hour'),
      feedingOfficers,
      wealthOfficerRelays: [...natalWealth, ...arrivingWealth].flatMap(wealth => feedingOfficers
        .filter(officer => baziStemFeeds(wealth.stem, officer.stem)).map(officer => ({ wealth, officer }))),
      arrivingWealthWithNativePeers: arrivingWealth.flatMap(wealth => {
        const peers = nativePeers.filter(row => baziStemControls(row.stem, wealth.stem));
        return peers.length ? [{ wealth, peers }] : [];
      }),
      nativeWealthWithLuckPeers: natalWealth.flatMap(wealth => {
        const peers = luckPeers.filter(row => baziStemControls(row.stem, wealth.stem));
        return peers.length ? [{ wealth, peers }] : [];
      }),
    };
  });
  const sealSourceSiDutyEarthWealthPaths = '庚辛'.includes(dayMaster) && dutySeal?.pillar[1] === '巳'
    && dutySeal.stem === '戊' ? sealWealthPaths.flatMap(path => {
      if (path.target !== dutySeal) return [];
      const arrivingWealth = path.arrivingWealth.filter(row => row.placement === 'main_qi' && row.element === '木');
      return arrivingWealth.length ? [{ ...path, arrivingWealth }] : [];
    }) : [];
  const unknownMovingWealth = moving.some(row => wealth(row.god) && row.placement === 'other_hidden');
  const sealWealthPathCandidate = sealWealthPaths.some(row => row.arrivingWealth.length)
    ? true : !monthSeals.length || (luckKnown && !unknownMovingWealth && (!movingWealth.length || targets.length > 0)) ? false : undefined;
  const sealNativeWealthReliefCandidate = luckKnown
    ? sealWealthPaths.some(row => row.nativeWealthWithLuckPeers.length > 0) : undefined;
  const sourceSealPaths = sealWealthPaths.filter(({ target }) => target.placement === 'main_qi'
    && !roles.some(row => officerOrKiller(row) && baziStemFeeds(row.stem, target.stem)));
  const wealthWithoutPeer = (target: BaziColumnRole) => !roles.some(row => visibleOrMain(row) && peer(row.god)
    && baziStemControls(row.stem, target.stem));
  const wealthLandPaths = native.some(row => row.placement === 'stem' && wealth(row.god)) ? []
    : sourceSealPaths.filter(({ target }) => sourceMainQiSealMonths[target.element]?.includes(target.pillar[1]));
  const isWealthLand = (column: 'annual' | 'decadal') => wealthLandPaths.some(({ arrivingWealth }) =>
    arrivingWealth.some(row => row.column === column && row.placement === 'main_qi' && wealthWithoutPeer(row)));
  const sealSourceWealthLand = isWealthLand('decadal');
  const sealSourceAnnualWealthLand = luckStatus === 'confirmed' ? isWealthLand('annual') : undefined;
  const namedLandPositions = dayMaster === '乙' && luckStatus === 'confirmed' ? roles.filter(row =>
    (row.column === 'hour' || row.column === 'decadal') && row.placement === 'main_qi' && '卯辰巳'.includes(row.pillar[1])) : [];
  const sealNamedLandAnnualWealthPaths = namedLandPositions.length ? sourceSealPaths.flatMap(({ target, arrivingWealth }) => {
    if (target.element !== '水' || !'亥子'.includes(target.pillar[1])) return [];
    const annualWealth = arrivingWealth.filter(row => row.column === 'annual' && wealthWithoutPeer(row));
    return annualWealth.length ? [{ target, namedLandPositions, annualWealth }] : [];
  }) : [];
  // 「歲時」 reads the natal year and hour here. 偏印 is a separate source reading.
  const sealSourceNatalVisibleWealthPaths = luckStatus === 'confirmed' ? sourceSealPaths.flatMap(({ target, natalYearHourWealth }) => {
    if (target.god !== '正印') return [];
    const wealth = natalYearHourWealth.filter(row => row.placement === 'stem' && wealthWithoutPeer(row));
    return wealth.length ? [{ target, wealth }] : [];
  }) : [];
  return { sealWealthPathCandidate, sealNativeWealthReliefCandidate, sealWealthPaths, sealLuckWealthAssemblies,
    sealSourceWealthLand, sealSourceAnnualWealthLand, sealSourceNatalVisibleWealthPaths,
    sealNamedLandAnnualWealthPaths,
    sealSourceSiDutyEarthWealthPaths,
    sealSourceSiDutyEarthWealth: luckStatus === 'confirmed' ? sealSourceSiDutyEarthWealthPaths.length > 0 : undefined,
    sealSourceNamedLandAnnualWealth: luckStatus === 'confirmed' ? sealNamedLandAnnualWealthPaths.length > 0 : undefined,
    sealSourceNatalVisibleWealth: luckKnown ? sealSourceNatalVisibleWealthPaths.length > 0 : undefined,
    sealLuckWealthAssemblyCandidate: luckKnown ? sealLuckWealthAssemblies.length > 0 : undefined };
}

export function baziSmthSealHurting(natal: Natal & { utc?: string }, timeKnown: boolean, yearPillar: string, luck: Luck,
  reviewSource = false, verifiedFemale = false) {
  const dayMaster = natal.day[0];
  const natalPillars = natalColumns.filter(column => column !== 'hour' || timeKnown).map(column => ({ column, pillar: natal[column] }));
  const annual = { column: 'annual' as const, pillar: yearPillar };
  const decadal = luck.status === 'confirmed' ? { column: 'decadal' as const, pillar: luck.pillar } : undefined;
  const movingPillars = decadal ? [annual, decadal] : [annual];
  const native = natalPillars.flatMap(p => baziColumnRoles(p.column, p.pillar, dayMaster));
  const moving = movingPillars.flatMap(p => baziColumnRoles(p.column, p.pillar, dayMaster));
  const known = (present: boolean, complete: boolean) => present ? true : complete ? false : undefined;
  const luckKnown = luck.status !== 'unavailable';

  const monthSeals = native.filter(row => row.column === 'month' && row.placement !== 'stem' && seal(row.god));
  const monthSealExposures = native.filter(stem => stem.placement === 'stem' && monthSeals.some(row => row.stem === stem.stem));
  const monthSealCandidates = monthSeals.filter(row => row.placement === 'main_qi' || monthSealExposures.some(stem => stem.stem === row.stem));
  const monthSealCandidate = known(monthSealCandidates.length > 0, timeKnown || !monthSeals.length);
  const natalYearHourWealth = native.filter(row => (row.column === 'year' || row.column === 'hour') && wealth(row.god));
  const movingWealth = moving.filter(row => wealth(row.god) && visibleOrMain(row));

  const natalHurt = native.filter(row => row.god === '伤官');
  const natalOfficers = native.filter(row => row.god === '正官');
  const monthMainQi = native.find(row => row.column === 'month' && row.placement === 'main_qi');
  const monthlyStrongElement = reviewSource && timeKnown
    ? smthSeasonalPowers(natal.month[1]).find(row => row.power === '旺')?.element : undefined;
  const printedMonthOfficer = reviewSource && smthOfficerMonthSeats[dayMaster]?.includes(natal.month[1])
    ? natalOfficers.find(row => row.column === 'month' && row.placement === 'other_hidden') : undefined;
  const officerArrivals = moving.filter(row => row.god === '正官' && visibleOrMain(row));
  const supportedOfficers = officerArrivals.flatMap(officer => {
    const branchSupport = officer.placement === 'stem' && moving.find(row => row.column === officer.column
      && row.placement === 'main_qi' && row.element === officer.element);
    const monthSupport = monthMainQi?.element === officer.element ? monthMainQi : undefined;
    const sourceMonthOfficer = officer.placement === 'stem' && printedMonthOfficer?.stem === officer.stem
      ? printedMonthOfficer : undefined;
    const seasonalOfficerRoot = officer.placement === 'stem' && monthlyStrongElement === officer.element
      ? moving.find(row => row.column === officer.column && row.stem === officer.stem && row.placement === 'other_hidden') : undefined;
    return branchSupport || monthSupport || sourceMonthOfficer || seasonalOfficerRoot
      ? [{ officer, branchSupport: branchSupport || undefined, monthSupport, sourceMonthOfficer, seasonalOfficerRoot }] : [];
  });
  const relations = baziInteractions([...natalPillars, ...movingPillars].map(p => ({ id: p.column, pillar: p.pillar })));
  const damagePairs = relations.pairs.filter(row => ['相刑', '六冲', '六破', '六害'].includes(row.kind));
  const damageGroups = relations.groups.filter(row => row.kind === '三刑');
  const supportedColumns = [...new Set(supportedOfficers.map(row => row.officer.column))];
  const damageAt = (officerColumn: BaziColumnRole['column']) => [
    ...damagePairs.filter(row => row.members.includes(officerColumn)).map(row => ({ ...row, officerColumn })),
    ...damageGroups.filter(row => row.byBranch.some(columns => columns.includes(officerColumn)))
      .map(row => ({ kind: row.kind, values: row.values, byBranch: row.byBranch, officerColumn })),
  ];
  const officerDamage = supportedColumns.flatMap(damageAt);
  const bladeBranch = smthLuNextBranch(dayMaster).bladeBranch;
  const movingBlades = movingPillars.filter(p => p.pillar[1] === bladeBranch);
  const killers = [...native, ...moving].filter(row => row.god === '七杀' && visibleOrMain(row));

  const natalWealth = native.filter(row => wealth(row.god) && visibleOrMain(row));
  const natalRoots = native.filter(row => row.stem === dayMaster && row.placement !== 'stem');
  const luckPeerRoles = moving.filter(row => row.column === 'decadal' && peer(row.god));
  const luckPeers = luckPeerRoles.filter(row => visibleOrMain(row)
    || native.some(stem => stem.placement === 'stem' && stem.stem === row.stem));

  const sourceReady = reviewSource && timeKnown;
  // 卷六〈建禄不富〉明列此原图的壬寅运，来财、原透戊和寅巳相刑各留位置。
  const builtLuSourceChart = sourceReady && decadal?.pillar === '壬寅'
    && [natal.year, natal.month, natal.day, natal.hour].join('') === '丁巳丙午己未戊辰';
  const builtLuSourcePeer = builtLuSourceChart ? native.find(row => row.column === 'hour' && row.placement === 'stem'
    && row.god === '劫财' && row.stem === '戊') : undefined;
  const builtLuSourceWealth = builtLuSourceChart ? moving.find(row => row.column === 'decadal' && row.placement === 'stem'
    && wealth(row.god) && row.stem === '壬') : undefined;
  const builtLuSourcePunishment = builtLuSourceChart ? damagePairs.find(row => row.kind === '相刑'
    && row.members.includes('year') && row.members.includes('decadal')) : undefined;
  const builtLuNamedWealthPressure = builtLuSourcePeer && builtLuSourceWealth && builtLuSourcePunishment
    && baziStemControls(builtLuSourcePeer.stem, builtLuSourceWealth.stem) ? {
      peer: builtLuSourcePeer, wealth: builtLuSourceWealth, punishment: builtLuSourcePunishment,
    } : undefined;
  const duty = sourceReady && natal.utc && [...monthSeals, ...natalHurt]
    .some(row => row.column === 'month' && row.placement === 'other_hidden')
    ? smthMonthDuty(Date.parse(natal.utc), natal.month[1], dayMaster) : undefined;
  const movingKillers = sourceReady && movingBlades.length ? killers.filter(killer =>
    (killer.column === 'annual' || killer.column === 'decadal') && baziStemControls(killer.stem, dayMaster)) : [];
  const sealsControllingHurt = (hurt: BaziColumnRole) => [...native, ...moving].filter(row => seal(row.god)
    && (visibleOrMain(row) || (row.column === 'month' && row.stem === duty?.slot?.stem))
    && baziStemControls(row.stem, hurt.stem));
  const autumnXinOfficer = dayMaster === '甲' && natal.month[1] === '酉'
    && monthMainQi?.stem === '辛' && !damagePairs.some(row => row.kind === '六冲' && row.members.includes('month'))
    ? monthMainQi : undefined;
  const hurtOfficerPaths = sourceReady ? natalHurt.flatMap(hurt => {
    const nativeTargets = natalOfficers.filter(officer => baziStemControls(hurt.stem, officer.stem));
    if (!nativeTargets.length) return [];
    const arrivals = supportedOfficers.flatMap(({ officer, sourceMonthOfficer, seasonalOfficerRoot }) => {
      if (!baziStemControls(hurt.stem, officer.stem)) return [];
      const damage = officerDamage.filter(row => row.officerColumn === officer.column);
      return damage.length || movingKillers.length ? [{ officer, damage, movingKillers, sourceMonthOfficer, seasonalOfficerRoot }] : [];
    });
    if (!arrivals.length) return [];
    const competingSeals = sealsControllingHurt(hurt);
    // 卷五的秋月甲日例：丁临亥水，或午中丁伏在实际壬水透干下。
    const waterOnHurtPillar = autumnXinOfficer && hurt.stem === '丁' ? native.find(row => row.column === hurt.column && row.stem === '壬'
      && (hurt.placement === 'stem' && hurt.pillar[1] === '亥' && row.placement === 'main_qi'
        || hurt.placement === 'main_qi' && hurt.pillar[1] === '午' && row.placement === 'stem')) : undefined;
    const sourceExceptions = waterOnHurtPillar ? arrivals.filter(({ officer }) => officer.placement === 'stem' && officer.stem === '辛'
      && moving.some(root => root.column === officer.column && root.placement !== 'stem' && root.stem === officer.stem)) : [];
    return [{ hurt, nativeTargets, competingSeals, waterOnHurtPillar, sourceExceptions,
      arrivals: arrivals.filter(row => !sourceExceptions.includes(row)).map(row => ({ ...row,
        sealsFedByOfficer: competingSeals.filter(seal => baziStemFeeds(row.officer.stem, seal.stem)),
      })) }];
  }) : [];
  const hurtOfficerReview = hurtOfficerPaths.filter(row => row.arrivals.length).map(({ hurt, nativeTargets, competingSeals, arrivals }) =>
    ({ hurt, nativeTargets, competingSeals, arrivals }));
  const hurtOfficerSeasonalDamage = hurtOfficerReview.some(({ hurt, competingSeals, arrivals }) =>
    hurt.placement === 'stem' && !competingSeals.length && arrivals.some(({ officer, damage }) =>
      officer.placement === 'stem' && officer.element === monthlyStrongElement && damage.length > 0
      && moving.some(root => root.column === officer.column && root.placement !== 'stem' && root.stem === officer.stem)));
  // The printed Jia example uses Ding concealed in the birth month's Wu as the attacking stem.
  const hurtOfficerNamedWuXinYou = decadal && dayMaster === '甲' && natal.month[1] === '午' && natal.hour === '辛未'
    ? hurtOfficerReview.flatMap(({ hurt, nativeTargets, competingSeals, arrivals }) => {
      if (hurt.column !== 'month' || hurt.placement !== 'main_qi' || hurt.stem !== '丁' || competingSeals.length) return [];
      const natalOfficer = nativeTargets.find(row => row.column === 'hour' && row.placement === 'stem' && row.stem === '辛');
      if (!natalOfficer) return [];
      return arrivals.flatMap(({ officer, damage }) => {
        if (officer.placement !== 'stem' || officer.pillar !== '辛酉' || !damage.length) return [];
        const ownRoot = moving.find(row => row.column === officer.column && row.placement === 'main_qi' && row.stem === '辛');
        return ownRoot ? [{ hurt, natalOfficer, officer, ownRoot, damage }] : [];
      });
    }) : [];
  const namedCase = sourceReady && decadal ? namedHiddenMonthCases.find(row =>
    row.dayMaster === dayMaster && row.monthBranch === natal.month[1] && row.hour === natal.hour) : undefined;
  const hurtOfficerNamedHiddenMonthCases = namedCase ? natalHurt.flatMap(hurt => {
    if (hurt.column !== 'month' || hurt.placement === 'stem' || hurt.stem !== namedCase.hurtStem
      || sealsControllingHurt(hurt).length) return [];
    const natalOfficer = natalOfficers.find(row => row.column === 'hour' && row.stem === namedCase.officerStem
      && row.placement === namedCase.officerPlacement && baziStemControls(hurt.stem, row.stem));
    if (!natalOfficer) return [];
    return officerArrivals.flatMap(officer => {
      if (officer.placement !== 'stem' || officer.pillar !== namedCase.movingPillar || !baziStemControls(hurt.stem, officer.stem)) return [];
      const ownRoot = moving.find(row => row.column === officer.column && row.placement !== 'stem' && row.stem === officer.stem);
      const damage = damageAt(officer.column);
      return ownRoot && damage.length ? [{ caseId: namedCase.caseId, hurt, natalOfficer, officer, ownRoot, damage }] : [];
    });
  }) : [];
  const hurtOfficerSeasonalBladeKiller = decadal && '甲丙戊庚壬'.includes(dayMaster)
    ? hurtOfficerReview.flatMap(({ hurt, competingSeals, arrivals }) => {
      if (hurt.placement !== 'stem' || competingSeals.length) return [];
      return arrivals.filter(({ officer, movingKillers }) => officer.placement === 'stem'
        && officer.element === monthlyStrongElement && movingKillers.length > 0)
        .map(({ officer, movingKillers }) => ({ hurt, officer, blades: movingBlades, killers: movingKillers }));
    }) : [];
  const hurtOfficerSourceExceptions = hurtOfficerPaths.filter(row => row.sourceExceptions.length)
    .map(({ hurt, waterOnHurtPillar, sourceExceptions }) => ({ hurt, water: waterOnHurtPillar, monthOfficer: autumnXinOfficer, arrivals: sourceExceptions }));
  return { profile: smthSealHurtingPolicy.profile, dayMaster, timeKnown, natalPillars, yearPillar,
    ...(sourceReady && decadal ? smthPeerWealth(natal, native, moving, natalHurt, luckPeers, duty, verifiedFemale) : {}),
    builtLuNamedWealthPressure,
    builtLuNamedWealthPressureVerified: sourceReady && decadal ? Boolean(builtLuNamedWealthPressure) : undefined,
    ...(sourceReady ? { sealOfficerReviewProfile: smthSealHurtingPolicy.sealOfficerReview,
      ...smthSealWealthReview(dayMaster, monthSeals, monthSealCandidates, native, moving, movingWealth, luckPeers, luck.status, duty, relations.groups),
      hurtOfficerPathCandidate: known(hurtOfficerReview.length > 0 || hurtOfficerNamedHiddenMonthCases.length > 0, luckKnown),
      hurtOfficerSeasonalDamage: luckKnown ? hurtOfficerSeasonalDamage : undefined, hurtOfficerReview, hurtOfficerSourceExceptions,
      hurtOfficerNamedWuXinYou,
      hurtOfficerNamedWuXinYouDamage: luckKnown ? hurtOfficerNamedWuXinYou.length > 0 : undefined,
      hurtOfficerNamedHiddenMonthCases,
      hurtOfficerNamedYiSiGengShen: luckKnown ? hurtOfficerNamedHiddenMonthCases.some(row => row.caseId === 'yi-si-geng-shen') : undefined,
      hurtOfficerNamedBingWuGuiChou: luckKnown ? hurtOfficerNamedHiddenMonthCases.some(row => row.caseId === 'bing-wu-gui-chou') : undefined,
      hurtOfficerSeasonalBladeKiller,
      hurtOfficerSeasonalBladeKillerConfirmed: luckKnown ? hurtOfficerSeasonalBladeKiller.length > 0 : undefined,
    } : {}),
    luckStatus: luck.status, luckPillar: decadal?.pillar,
    monthSealCandidate, monthSealCandidates, monthSealExposures, natalYearHourWealth, movingWealth,
    annualWealthCandidate: movingWealth.some(row => row.column === 'annual'),
    luckWealthCandidate: known(movingWealth.some(row => row.column === 'decadal'), luckKnown),
    natalHurt, natalOfficers, natalHurtPresent: known(natalHurt.length > 0, timeKnown),
    natalOfficerPresent: known(natalOfficers.length > 0, timeKnown), officerArrivals, supportedOfficers, officerDamage,
    officerSupportCandidate: known(supportedOfficers.length > 0, luckKnown),
    officerDamageCandidate: known(officerDamage.length > 0, timeKnown && luckKnown),
    movingBlades, killers, bladeKillerCandidate: known(movingBlades.length > 0 && killers.length > 0, timeKnown && luckKnown),
    natalHurtExposedOrMonth: known(natalHurt.some(row => row.placement === 'stem' || row.column === 'month'), timeKnown),
    natalWealthCandidate: known(natalWealth.length > 0, timeKnown), natalWealth,
    dayMasterRootCandidate: known(natalRoots.length > 0, timeKnown), natalRoots,
    luckPeerCandidate: known(luckPeers.length > 0, luckKnown && (timeKnown || !luckPeerRoles.length)),
    luckPeers, strengthVerified: false, useVerified: false, protectionVerified: false,
  };
}
