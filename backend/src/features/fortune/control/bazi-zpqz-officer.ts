import { baziStemControls, baziStemFeeds, describeBaZiPillar } from './bazi-calculation';
import { baziZpqzWealth } from './bazi-zpqz-wealth';
import { zpqzColumnStemCheck, zpqzFanSealPillars, zpqzWuSealPillars } from './bazi-zpqz-seal-food';
import { zpqzMonthPositions } from './bazi-zpqz-month';
import { matchZpqzPrintedLuck, type PrintedLuckReading } from './bazi-zpqz-printed-luck';

const layers = ['year', 'month', 'day', 'hour'] as const;
type Natal = Record<typeof layers[number], string>;
export const zpqzOfficerPolicy = {
  profile: 'zpqz-officer-wealth-seal-output-targets-v1',
  sharedGeometry: 'reuse-wealth-composition-coordinates-not-its-pattern-or-source-appraisals',
  exposure: 'wealth-and-seal-both-exposed-does-not-require-officer-exposed; Xue-officer-hidden',
  hiddenCombinations: 'actual-two-hidden-stems-not-a-branch-six-combination-or-effective-transformation',
  source: 'Xue-two-Xu-comments-and-Zaqi-WuJia-variant-not-repaired',
  printedLuck: 'chapter-32-exact-four-columns-and-verified-pillar-with-prose-and-table-variants',
} as const;
export const zpqzOfficerCases = [
  { id: 'xue', name: '薛相公', pillars: ['甲申', '壬申', '乙巳', '戊寅'] },
  { id: 'zaqi', name: '杂气正官取运图', pillars: ['壬戌', '丁未', '戊申', '乙卯'] },
  { id: 'jin', name: '金状元', pillars: ['乙卯', '丁亥', '丁未', '庚戌'] },
  { id: 'xuan', name: '宣参国', pillars: ['己卯', '辛未', '壬寅', '辛亥'] },
  { id: 'fan', name: '范太傅', pillars: zpqzFanSealPillars },
] as const;
type PrintedCaseId = typeof zpqzOfficerCases[number]['id'];
const printedLuckReadings: Readonly<Partial<Record<PrintedCaseId, PrintedLuckReading>>> = {
  xue: { premise: '以身稍轻、财印隔位论', periods: [
    { pillars: ['癸酉'], assessment: '依酉支七杀记为泄财生印的对照' },
    { pillars: ['甲戌'], assessment: '同时留存戌运财旺而印未损、戌运财星破印两处判语' },
    { pillars: ['乙亥'], assessment: '并列印地方向与亥支冲动的提醒' },
    { pillars: ['戊寅'], assessment: '作为原局与运支的两寅冲官对照' },
  ] },
  zaqi: { premise: '以日元旺而官稍轻论', periods: [
    { pillars: ['辛亥', '壬子'], assessment: '按运表整柱核位，对照正文亥子财地的助官判语' },
  ] },
  jin: { premise: '按身旺印重、取财损印论', periods: [
    { pillars: ['乙酉', '甲申'], assessment: '列入先行的申酉财地' },
    { pillars: ['癸未'], assessment: '对照癸未以后转南方的原文，运干癸杀与未支藏气分别留位' },
    { pillars: ['壬午'], assessment: '列作南方运见壬官而泄财生印的对照' },
  ] },
  xuan: { premise: '以辛印制伤并助身论', periods: [
    { pillars: ['己巳', '戊辰'], assessment: '列作官杀生辛印的运步' },
    { pillars: ['丁卯'], assessment: '留存评注对运干丁财损辛印的提醒，原文的干支分管时点仍待核' },
  ] },
};
export const zpqzOfficerVariants = [
  { id: 'zaqi-earlier-prose', pillars: ['壬戌', '丁未', '戊甲', '乙卯'], validPillars: false,
    issue: '论正官散文日柱录戊甲，取运图另录戊申；戊甲不是有效干支，不将两处默改为同一已核生日。前章评注另称巳申一合，而取运图无巳，不向图中补巳' },
] as const;
export const zpqzOfficerCounterfactual = { id: 'xue-ji-you-year', name: '薛例反设己酉年',
  pillars: ['己酉', '壬申', '乙巳', '戊寅'], historicalNatal: false } as const;

export function baziZpqzOfficer(natal: Natal, timeKnown: boolean, luckPillar: string) {
  const shared = baziZpqzWealth(natal, timeKnown, luckPillar);
  const all = shared.gods.flatMap(row => [...row.exposedRows, ...row.hiddenRows]);
  const by = (names: string[]) => all.filter(row => names.includes(row.god));
  const seen = (yes: boolean) => yes ? true : timeKnown ? false : undefined;
  const officers = by(['正官']), outputs = by(['食神', '伤官']), seals = by(['正印', '偏印']);
  const wealth = by(['正财', '偏财']);
  const monthOfficerCandidate = shared.monthHiddenGods.includes('正官');
  const contacts = (from: typeof all, to: typeof all) => from.flatMap(a => to.map(b => ({ from: a, to: b,
    columnDistance: Math.abs(a.index - b.index), bothExposed: a.kind === '透干' && b.kind === '透干',
    between: shared.natalPillars.filter(row => Math.min(a.index, b.index) < layers.indexOf(row.position as typeof layers[number])
      && layers.indexOf(row.position as typeof layers[number]) < Math.max(a.index, b.index)),
  })));
  const hidden = all.filter(row => row.kind === '支藏'), fivePairs = ['甲己', '乙庚', '丙辛', '丁壬', '戊癸'];
  const hiddenFivePairs = hidden.flatMap((first, i) => hidden.slice(i + 1).filter(second => first.position !== second.position
    && fivePairs.some(pair => pair === first.stem + second.stem || pair === second.stem + first.stem))
    .map(second => ({ first, second, columnDistance: Math.abs(first.index - second.index) })));
  const officerPositions = new Set(officers.map(row => row.position));
  const officerBranchRelations = [...shared.natalRelationPairs, ...shared.movingRelationPairs]
    .filter(pair => pair.members.some(position => officerPositions.has(position)));
  const luBranch = zpqzMonthPositions(shared.dayMaster, natal.month[1]).luBranch;
  const threeCombinationGroups = ['亥卯未', '寅午戌', '巳酉丑', '申子辰'].map(values => {
    const members = [...values].map(branch => ({ branch, natalPositions: shared.natalPillars.filter(row => row.pillar[1] === branch).map(row => row.position),
      luckPresent: luckPillar[1] === branch }));
    return { values, members, nativeComplete: seen(members.every(row => row.natalPositions.length)),
      complete: seen(members.every(row => row.natalPositions.length || row.luckPresent)),
      missingKnownBranches: members.filter(row => !row.natalPositions.length && !row.luckPresent).map(row => row.branch) };
  });
  const day = { position: 'day', pillar: natal.day, stem: natal.day[0], god: '日元', kind: '日干' };
  const dayStemElement = describeBaZiPillar(natal.day).stemElement;
  const dayOutputContacts = outputs.map(to => ({ from: day, to }));
  const mainLuck = shared.movingRows.slice(0, 2);
  const movingSeals = mainLuck.filter(row => ['正印', '偏印'].includes(row.god));
  const wealthOfficerSealPaths = timeKnown && movingSeals.length ? shared.wealthOfficerContacts.flatMap(pair => {
    if (!baziStemFeeds(pair.from.stem, pair.to.stem)) return [];
    return movingSeals.filter(seal => shared.natalMovingContacts.some(link => link.from === pair.to && link.to === seal && link.relation === '生')
      && shared.natalMovingContacts.some(link => link.from === pair.from && link.to === seal && link.relation === '克'))
      .map(seal => ({ wealth: pair.from, officer: pair.to, seal,
        combines: seal.kind === '运干' && pair.from.kind === '透干' && shared.movingFivePairs.some(contact =>
          contact.target.position === pair.from.position && contact.target.stem === pair.from.stem),
      }));
  }) : [];
  const wealthFedOfficerUnderOutput = timeKnown ? shared.movingContacts.flatMap(link => {
    if (!mainLuck.includes(link.from) || !['食神', '伤官'].includes(link.from.god) || link.relation !== '克' || !officers.includes(link.to)) return [];
    const wealthSources = shared.wealthOfficerContacts.filter(pair => pair.to === link.to && baziStemFeeds(pair.from.stem, link.to.stem))
      .map(pair => ({ wealth: pair.from, fedByOutput: baziStemFeeds(link.from.stem, pair.from.stem) }));
    if (!wealthSources.length) return [];
    const sealsFacingOutput = shared.natalMovingContacts.filter(pair => pair.to === link.from && seals.includes(pair.from) && pair.relation === '克')
      .map(pair => pair.from);
    return [{ moving: link.from, officer: link.to, wealthSources, sealsFacingOutput }];
  }) : [];
  const leadingLuck = monthOfficerCandidate ? mainLuck : [];
  const officerLuck = leadingLuck.filter(row => ['正官', '七杀'].includes(row.god));
  const monthOfficerWealthPaths = timeKnown ? officers.filter(row => row.position === 'month' && row.kind === '支藏').flatMap(officer => {
    const nativeWealth = shared.wealthOfficerContacts.filter(link => link.to === officer && baziStemFeeds(link.from.stem, officer.stem))
      .map(link => link.from);
    if (!nativeWealth.length) return [];
    return [{
      officer, nativeWealth,
      movingWealth: shared.movingContacts.filter(link => leadingLuck.includes(link.from) && ['正财', '偏财'].includes(link.from.god)
        && link.to === officer && link.relation === '生').map(link => link.from),
      movingOfficer: officerLuck.filter(row => row.god === '正官' && row.stem === officer.stem),
      movingOutput: shared.movingContacts.filter(link => leadingLuck.includes(link.from) && ['食神', '伤官'].includes(link.from.god)
        && link.to === officer && link.relation === '克').map(link => link.from),
    }];
  }) : [];
  const dayFortuneSupport = {
    day,
    peers: leadingLuck.filter(row => ['比肩', '劫财'].includes(row.god) && row.element === dayStemElement),
    seals: movingSeals.filter(row => baziStemFeeds(row.stem, day.stem)),
    luSeat: luckPillar[1] === luBranch ? shared.movingRows.find(row => row.kind === '运支藏干' && row.stem === day.stem) : undefined,
  };
  const hasDayFortuneSupport = Boolean(dayFortuneSupport.luSeat || dayFortuneSupport.peers.length || dayFortuneSupport.seals.length);
  const officerWealthBodySupport = monthOfficerWealthPaths.length ? dayFortuneSupport : undefined;
  const wealthSupportingOfficerSeal = shared.wealthSealContacts.filter(pair => pair.bothExposed).flatMap(pair => officerLuck
    .filter(moving => shared.natalMovingContacts.some(link => link.from === pair.from && link.to === moving && link.relation === '生')
      && shared.movingContacts.some(link => link.from === moving && link.to === pair.to && link.relation === '生'))
    .map(moving => ({ wealth: pair.from, through: moving, seal: pair.to, between: pair.between,
      wealthControlsSeal: baziStemControls(pair.from.stem, pair.to.stem),
      sealFeedsDay: baziStemFeeds(pair.to.stem, day.stem),
      movingControlsDay: shared.movingContacts.some(link => link.from === moving && link.to.kind === '日干' && link.relation === '克'),
      combines: shared.natalRelationPairs.some(relation => relation.kind === '天干五合'
        && relation.members.includes(pair.from.position) && relation.members.includes(pair.to.position)) })));
  const exposedOfficers = officers.filter(row => row.kind === '透干');
  const movingAuthorityStem = officerLuck.find(row => row.kind === '运干');
  const officerExposureChecks = monthOfficerCandidate && timeKnown ? {
    combines: shared.movingFivePairs.filter(pair => exposedOfficers.some(row => row.position === pair.target.position && row.stem === pair.target.stem)),
    authority: movingAuthorityStem ? exposedOfficers.map(officer => ({ officer, moving: movingAuthorityStem,
      route: movingAuthorityStem.god === '七杀' ? '七杀同透' : '正官同干重见',
    })) : [],
  } : undefined;
  // 卷四另查合官、杂煞、重官。只把月藏官所对应的唯一原透官交给这三种反证。
  const [singleExposedOfficer] = exposedOfficers.length === 1 ? exposedOfficers : [];
  const monthVisibleOfficer = singleExposedOfficer && officers.find(row =>
    row.position === 'month' && row.kind === '支藏' && row.stem === singleExposedOfficer.stem);
  const monthOfficerExposureConflicts = singleExposedOfficer && monthVisibleOfficer && officerExposureChecks ? {
    monthOfficer: monthVisibleOfficer,
    exposedOfficer: singleExposedOfficer,
    authority: officerExposureChecks.authority.filter(row => row.officer === singleExposedOfficer),
    combinations: officerExposureChecks.combines.filter(row => row.target.position === singleExposedOfficer.position
      && row.target.stem === singleExposedOfficer.stem && row.moving.stem !== day.stem),
  } : undefined;
  const monthBranch = natal.month[1], luckBranch = luckPillar[1];
  const onlyHiddenMonthOfficer = timeKnown && officers.length === 1 && officers[0].position === 'month' && officers[0].kind === '支藏'
    && describeBaZiPillar(natal.month).hiddenStems[0]?.stem === officers[0].stem ? officers[0] : undefined;
  const directLuckMonthClash = onlyHiddenMonthOfficer && movingAuthorityStem?.stem === onlyHiddenMonthOfficer.stem
    ? shared.movingRelationPairs.find(pair => pair.kind === '六冲' && pair.members.includes('month')) : undefined;
  // The cited chapter separately guards a hidden officer against branch clashes.
  // Keep other combinations and alternate clash targets open for their own review.
  const competingBranchContact = directLuckMonthClash && (
    shared.natalRelationPairs.some(pair => pair.members.includes('month') && ['六合', '六冲'].includes(pair.kind))
    || shared.movingRelationPairs.some(pair => !pair.members.includes('month') && ['六合', '六冲', '相刑'].includes(pair.kind))
    || threeCombinationGroups.some(group => (group.values.includes(monthBranch) || group.values.includes(luckBranch))
      && group.members.some(member => ![monthBranch, luckBranch].includes(member.branch) && member.natalPositions.length)));
  const onlyHiddenMonthOfficerDirectLuckClash = onlyHiddenMonthOfficer && movingAuthorityStem && directLuckMonthClash
    && !competingBranchContact ? { officer: onlyHiddenMonthOfficer, movingOfficer: movingAuthorityStem, clash: directLuckMonthClash } : undefined;
  const luckWealthControlsSeal = shared.movingContacts.filter(link => leadingLuck.includes(link.from)
    && ['正财', '偏财'].includes(link.from.god) && ['正印', '偏印'].includes(link.to.god) && link.relation === '克');
  const luckOutputFeedsWealth = leadingLuck.filter(row => ['食神', '伤官'].includes(row.god)).map(output => ({
    day, output, wealth: [
      ...shared.movingContacts.filter(link => link.from === output && link.relation === '生'
        && wealth.includes(link.to)).map(link => link.to),
      ...shared.movingRows.filter(row => ['正财', '偏财'].includes(row.god) && baziStemFeeds(output.stem, row.stem)),
    ],
  }));
  const monthOfficerSealPaths = timeKnown ? officers.filter(row => row.position === 'month' && row.kind === '支藏')
    .flatMap(officer => seals.filter(seal => baziStemFeeds(officer.stem, seal.stem) && baziStemFeeds(seal.stem, day.stem))
      .map(seal => ({
        officer, seal, day,
        movingWealth: luckWealthControlsSeal.filter(link => link.to === seal).map(link => link.from),
      }))) : [];
  // The adjacent officer chapters keep the Li diagram's natal combination,
  // the independently usable seal luck, and a repeated killer separate.
  const liSourceShape = timeKnown && natal.year === '庚寅' && natal.month === '乙酉'
    && natal.day === '甲子' && natal.hour === '戊辰';
  const liNatalKiller = liSourceShape ? all.find(row => row.position === 'year' && row.kind === '透干'
    && row.stem === '庚' && row.god === '七杀') : undefined;
  const liPeer = liNatalKiller && all.find(row => row.position === 'month' && row.kind === '透干' && row.stem === '乙');
  const liNatalCombination = liPeer && shared.natalRelationPairs.find(pair => pair.kind === '天干五合'
    && pair.members.includes('year') && pair.members.includes('month'));
  const liNativeWaterGroup = liNatalCombination && threeCombinationGroups.find(group => group.values === '申子辰'
    && group.members.some(member => member.branch === '子' && member.natalPositions.includes('day'))
    && group.members.some(member => member.branch === '辰' && member.natalPositions.includes('hour')));
  const liSealPath = liNativeWaterGroup && monthOfficerSealPaths.find(path => path.officer.stem === '辛'
    && path.seal.position === 'day' && path.seal.kind === '支藏' && path.seal.stem === '癸');
  const liRepeatedKillerCombination = liSealPath && liNatalKiller && liPeer && luckPillar === '庚寅'
    && movingAuthorityStem?.god === '七杀' && movingAuthorityStem.stem === liNatalKiller.stem
    ? shared.movingFivePairs.find(pair => pair.target.position === liPeer.position && pair.target.stem === liPeer.stem
      && pair.moving.stem === movingAuthorityStem.stem) : undefined;
  const liIncomingSeal = liSealPath && ['丁亥', '戊子', '己丑'].includes(luckPillar)
    ? shared.movingRows.find(row => row.kind === '运支藏干' && row.stem === (luckPillar === '丁亥' ? '壬' : '癸')
      && baziStemFeeds(row.stem, day.stem)) : undefined;
  const liSourceOfficerSealReview = liNatalKiller && liPeer && liNatalCombination && liNativeWaterGroup && liSealPath ? {
    natalKiller: liNatalKiller, peer: liPeer, natalCombination: liNatalCombination,
    officer: liSealPath.officer, seal: liSealPath.seal, nativeWaterGroup: liNativeWaterGroup,
    repeatedKillerCombination: liRepeatedKillerCombination, incomingSeal: liIncomingSeal,
  } : undefined;
  const officerSealBodySupport = monthOfficerSealPaths.length ? dayFortuneSupport : undefined;
  const hasWuSourceOfficerSealSupport = timeKnown && hasDayFortuneSupport
    && layers.every((position, index) => natal[position] === zpqzWuSealPillars[index])
    && monthOfficerSealPaths.some(({ officer, seal }) =>
      officer.stem === '己' && seal.position === 'hour' && seal.kind === '支藏' && seal.stem === '辛');
  const luckSealControlsOutput = leadingLuck.filter(row => ['正印', '偏印'].includes(row.god)).flatMap(seal => {
    const dayLink = shared.movingContacts.find(link => link.from === seal && link.to.kind === '日干' && link.relation === '生');
    return dayLink ? shared.movingContacts.filter(link => link.from === seal && link.relation === '克'
      && outputs.includes(link.to)).map(link => ({ seal, output: link.to, day: dayLink.to })) : [];
  });
  const luckOfficerFeedsSeal = shared.movingContacts.filter(link => officerLuck.includes(link.from) && link.relation === '生'
    && seals.includes(link.to)).flatMap(link => shared.sealOutputContacts.filter(control => control.from === link.to)
    .map(control => ({ officer: link.from, seal: link.to, output: control.to })));
  const officerSealProtectionPaths = monthOfficerSealPaths.flatMap(path => shared.sealOutputContacts
    .filter(link => link.from === path.seal && baziStemControls(link.to.stem, path.officer.stem))
    .map(link => ({
      ...path, output: link.to,
      movingSeals: luckSealControlsOutput.filter(row => row.output === link.to).map(row => row.seal),
      movingAuthority: luckOfficerFeedsSeal.filter(row => row.seal === path.seal && row.output === link.to).map(row => row.officer),
    })));
  const overlappingSeals = monthOfficerCandidate && new Set(seals.map(row => row.position)).size >= 2 ? seals : [];
  const sealOverlapWealthPaths = overlappingSeals.length ? leadingLuck.flatMap(moving => {
    const affectedSeals = luckWealthControlsSeal.filter(link => link.from === moving && overlappingSeals.includes(link.to))
      .map(link => link.to);
    if (!affectedSeals.length) return [];
    return [{
      moving, affectedSeals,
      fedByOutput: outputs.filter(output => baziStemFeeds(day.stem, output.stem) && baziStemFeeds(output.stem, moving.stem)),
      stillFedByMovingAuthority: shared.movingContacts.filter(link => affectedSeals.includes(link.to)
        && officerLuck.includes(link.from) && link.relation === '生').map(link => ({ authority: link.from, seal: link.to })),
    }];
  }) : [];
  const officerLuckRoutes = [
    wealthSupportingOfficerSeal.length > 0 && 'wealth-officer-seal',
    luckWealthControlsSeal.length > 0 && 'wealth-controls-seal',
    luckOutputFeedsWealth.some(link => link.wealth.length > 0) && 'output-feeds-wealth',
    luckSealControlsOutput.length > 0 && 'seal-controls-output',
    luckOfficerFeedsSeal.length > 0 && 'officer-feeds-seal',
  ].filter(route => typeof route === 'string');
  const printedCases = zpqzOfficerCases.map(c => ({ ...c, stemCheck: zpqzColumnStemCheck(c.pillars),
    matches: layers.every((key, i) => key === 'hour' && !timeKnown || natal[key] === c.pillars[i]) ? timeKnown ? true : undefined : false }));
  const counterfactual = { ...zpqzOfficerCounterfactual, stemCheck: zpqzColumnStemCheck(zpqzOfficerCounterfactual.pillars),
    matches: layers.every((key, i) => key === 'hour' && !timeKnown || natal[key] === zpqzOfficerCounterfactual.pillars[i])
      ? timeKnown ? true : undefined : false };
  const counterfactualWealthSeal = counterfactual.matches === true && shared.movingRows[0].stem === '甲'
    ? shared.movingFivePairs.filter(pair => pair.target.position === 'year' && pair.target.stem === '己')
      .flatMap(pair => shared.wealthSealContacts.filter(contact => contact.bothExposed && contact.from.position === pair.target.position
        && contact.from.stem === pair.target.stem && contact.to.position === 'month' && baziStemControls(contact.from.stem, contact.to.stem))
        .map(contact => ({ moving: pair.moving, wealth: contact.from, seal: contact.to }))) : [];
  const officerWealthNamedWeak = printedCases.find(row => row.id === 'xue')?.matches;
  const isXue = officerWealthNamedWeak === true;
  const officerWealthNamedStrong = printedCases.some(row => row.id === 'zaqi' && row.matches === true);
  const zaqiCombinedBridges = officerWealthNamedStrong ? wealthSupportingOfficerSeal.filter(path => path.combines
    && path.wealth.position === 'year' && path.wealth.stem === '壬' && path.seal.position === 'month' && path.seal.stem === '丁') : [];
  const zaqiInactiveWealthSeal = zaqiCombinedBridges.length && zaqiCombinedBridges.length === wealthSupportingOfficerSeal.length ? {
    wealth: zaqiCombinedBridges[0].wealth, seal: zaqiCombinedBridges[0].seal,
    authorities: zaqiCombinedBridges.map(path => path.through),
  } : undefined;
  // Xu reads the Fan chart's originally exposed Ren wealth as converted through its natal Ding combination.
  const fanWealthConversion = printedCases.some(row => row.id === 'fan' && row.matches === true) ? (() => {
    const wealthStem = wealth.find(row => row.position === 'month' && row.kind === '透干' && row.stem === '壬');
    const joinedSeal = seals.find(row => row.position === 'year' && row.kind === '透干' && row.stem === '丁');
    const separateSeal = seals.find(row => row.position === 'hour' && row.kind === '透干' && row.stem === '丙');
    const officer = officers.find(row => row.position === 'month' && row.kind === '支藏' && row.stem === '甲');
    const join = shared.natalRelationPairs.find(pair => pair.kind === '天干五合'
      && pair.members.includes('year') && pair.members.includes('month'));
    if (wealthStem && joinedSeal && separateSeal && officer && join) {
      return { wealth: wealthStem, joinedSeal, separateSeal, officer, join,
        bridges: wealthSupportingOfficerSeal.filter(path => path.wealth === wealthStem) };
    }
  })() : undefined;
  const fanOfficerSealPath = fanWealthConversion && monthOfficerSealPaths.find(path =>
    path.officer === fanWealthConversion.officer && path.seal === fanWealthConversion.separateSeal);
  const fanMovingOutput = fanOfficerSealPath && ['辛丑', '庚子'].includes(luckPillar)
    && ['食神', '伤官'].includes(mainLuck[0].god) ? mainLuck[0] : undefined;
  const fanOriginalOutput = fanMovingOutput ? hidden.filter(row => row.stem === fanMovingOutput.stem) : [];
  const fanSourceSealChecksOutput = fanOfficerSealPath && fanMovingOutput && fanOriginalOutput.length
    && shared.movingContacts.some(link => link.from === fanMovingOutput && link.to === fanOfficerSealPath.officer && link.relation === '克')
    && shared.natalMovingContacts.some(link => link.from === fanOfficerSealPath.seal && link.to === fanMovingOutput && link.relation === '克')
    ? { officer: fanOfficerSealPath.officer, seal: fanOfficerSealPath.seal, output: fanMovingOutput, originalOutput: fanOriginalOutput }
    : undefined;
  // The same branch wealth has both directed contacts. Xu takes its support of the hidden officer in these two periods.
  const fanBranchWealth = fanOfficerSealPath && ['庚子', '己亥'].includes(luckPillar)
    && fanOfficerSealPath.movingWealth.includes(mainLuck[1])
    && monthOfficerWealthPaths.some(path => path.officer === fanOfficerSealPath.officer && path.movingWealth.includes(mainLuck[1]))
    ? { wealth: mainLuck[1], officer: fanOfficerSealPath.officer, seal: fanOfficerSealPath.seal } : undefined;
  const fanBranchWealthSupportsOfficer = seen(Boolean(fanBranchWealth));
  const fanMovingPeer = fanOfficerSealPath && ['己亥', '戊戌'].includes(luckPillar) && dayFortuneSupport.peers.includes(mainLuck[0]);
  const fanMovingSeal = fanOfficerSealPath && ['丁酉', '丙申'].includes(luckPillar) && dayFortuneSupport.seals.includes(mainLuck[0]);
  const fanOutputGroup = fanMovingSeal && luckPillar === '丁酉'
    ? threeCombinationGroups.find(group => group.values === '巳酉丑' && group.complete === true && group.nativeComplete === false)
    : undefined;
  const fanSourceYouOutputChallengesOfficer = fanOfficerSealPath && fanOutputGroup
    && mainLuck[1].stem === '辛' && shared.movingContacts.some(link =>
      link.from === mainLuck[1] && link.to === fanOfficerSealPath.officer && link.relation === '克')
    ? { officer: fanOfficerSealPath.officer, movingOutput: mainLuck[1], outputGroup: fanOutputGroup } : undefined;
  const fanSourceOfficerSealSupportRoute = fanMovingPeer ? 'peer' : fanOutputGroup ? 'ding-seal-with-output-group'
    : fanMovingSeal && luckPillar === '丙申' ? 'bing-seal' : undefined;
  const fanSourceOfficerSealSupport = fanOfficerSealPath && fanSourceOfficerSealSupportRoute
    ? { officer: fanOfficerSealPath.officer, seal: fanOfficerSealPath.seal, day, moving: mainLuck[0], outputGroup: fanOutputGroup }
    : undefined;
  const officerSealNamedStrong = printedCases.some(row => row.id === 'jin' && row.matches === true);
  const officerSealOutputNamedForRestraint = printedCases.some(row => row.id === 'xuan' && row.matches === true);
  const xueSourceNatalOfficerWealthRoots = isXue ? (() => {
    const path = monthOfficerWealthPaths.find(({ officer }) => officer.stem === '庚' && officer.pillar === '壬申');
    const nativeWealth = path?.nativeWealth.find(row => row.position === 'hour' && row.stem === '戊' && row.kind === '透干');
    if (!path || !nativeWealth) return;
    const rootsFor = (stem: string) => hidden.filter(row => row.stem === stem)
      .map(row => ({ ...row, phase: describeBaZiPillar(row.pillar, stem).phase }))
      .filter(row => row.phase === '长生' || row.phase === '临官');
    const officerRoots = rootsFor(path.officer.stem), wealthRoots = rootsFor(nativeWealth.stem);
    const hasBirthAndLu = (roots: typeof officerRoots) => roots.some(row => row.phase === '长生')
      && roots.some(row => row.phase === '临官');
    // Xu p.174 names both roots for each resource in this printed example.
    if (hasBirthAndLu(officerRoots) && hasBirthAndLu(wealthRoots)) {
      return { officer: path.officer, wealth: nativeWealth, officerRoots, wealthRoots };
    }
  })() : undefined;
  const xueSourceWealthOfficerSeal = xueSourceNatalOfficerWealthRoots && luckPillar === '癸酉' ? wealthSupportingOfficerSeal.find(path =>
    path.wealth.position === 'hour' && path.wealth.stem === '戊' && path.through.kind === '运支藏干'
    && path.through.stem === '辛' && path.through.god === '七杀' && path.seal.position === 'month'
    && path.seal.stem === '壬' && path.sealFeedsDay && path.between.some(row => row.position === 'day' && row.pillar === '乙巳'))
    : undefined;
  const xueOfficerSealPath = xueSourceNatalOfficerWealthRoots && monthOfficerSealPaths.find(({ officer, seal }) =>
    officer === xueSourceNatalOfficerWealthRoots.officer && seal.position === 'month' && seal.kind === '透干' && seal.stem === '壬');
  const xueMovingSeal = xueSourceWealthOfficerSeal && xueOfficerSealPath
    && officerSealBodySupport?.seals.find(row => row.kind === '运干' && row.stem === '癸');
  const xueSourceOfficerSealSupport = xueOfficerSealPath && xueMovingSeal ? { ...xueOfficerSealPath, movingSeal: xueMovingSeal } : undefined;
  const xueSourceBodySupport = xueSourceNatalOfficerWealthRoots ? (
    luckPillar === '甲戌' ? officerWealthBodySupport?.peers.find(row => row.kind === '运干' && row.stem === '甲')
    : luckPillar === '乙亥' ? officerWealthBodySupport?.seals.find(row => row.kind === '运支藏干' && row.stem === '壬')
    : undefined
  ) : undefined;
  const xueZiSeal = xueSourceNatalOfficerWealthRoots && luckPillar === '丙子'
    ? officerWealthBodySupport?.seals.find(row => row.kind === '运支藏干' && row.stem === '癸') : undefined;
  const xueSourceNorthernSealOutput = xueZiSeal ? monthOfficerWealthPaths.flatMap(({ officer, movingOutput }) =>
    officer.stem === '庚' ? movingOutput.filter(output => output.kind === '运干' && output.stem === '丙'
      && baziStemControls(xueZiSeal.stem, output.stem)).map(output => ({ seal: xueZiSeal, day, officer, output })) : [])[0]
    : undefined;
  const xueSourceChouNorthernSeal = xueSourceNatalOfficerWealthRoots && luckPillar === '丁丑' ? (() => {
    const [output, mainQi, ...otherHidden] = shared.movingRows;
    const seal = otherHidden.find(row => row.stem === '癸' && row.god === '偏印');
    if (seal && output.god === '食神' && mainQi.stem === '己' && baziStemFeeds(seal.stem, day.stem)) {
      return { seal, day, output, mainQi, officer: xueSourceNatalOfficerWealthRoots.officer };
    }
  })() : undefined;
  const xueHaiClashes = isXue && luckPillar === '乙亥' ? shared.movingRelationPairs.filter(pair => ['六冲', '六害'].includes(pair.kind)) : [];
  const xueHaiPeer = luckPillar === '乙亥' && xueSourceBodySupport
    ? officerSealBodySupport?.peers.find(row => row.kind === '运干' && row.stem === '乙') : undefined;
  const xueHaiSealPeer = xueSourceBodySupport && xueHaiPeer && xueHaiClashes.some(pair =>
    pair.kind === '六冲' && pair.members.includes('day')) && ['year', 'month'].every(position =>
    xueHaiClashes.some(pair => pair.kind === '六害' && pair.members.includes(position)))
    ? { route: 'yi-hai-seal-peer', moving: xueSourceBodySupport, peer: xueHaiPeer, clashes: xueHaiClashes } : undefined;
  const xueFurtherSupport = xueHaiSealPeer ?? (luckPillar === '甲戌' && xueSourceBodySupport
    ? { route: 'jia-xu-peer', moving: xueSourceBodySupport }
    : xueSourceNorthernSealOutput ? { route: 'bing-zi-seal', moving: xueSourceNorthernSealOutput.seal }
      : xueSourceChouNorthernSeal ? { route: 'ding-chou-hidden-seal', moving: xueSourceChouNorthernSeal.seal } : undefined);
  const xueSourceOfficerSealFurtherSupport = xueOfficerSealPath && xueFurtherSupport
    ? { ...xueOfficerSealPath, ...xueFurtherSupport } : undefined;
  const zaqiSourceOfficerAid = officerWealthNamedStrong && ['辛亥', '壬子'].includes(luckPillar)
    && officers.some(row => row.position === 'hour' && row.kind === '透干' && row.stem === '乙')
    ? monthOfficerWealthPaths.find(path => path.officer.pillar === '丁未' && path.officer.stem === '乙'
      && path.movingWealth.some(row => row.kind === '运支藏干' && row.stem === (luckPillar === '辛亥' ? '壬' : '癸')))
    : undefined;
  const xuanSealComparison = officerSealOutputNamedForRestraint && ['己巳', '戊辰', '丁卯'].includes(luckPillar) ? {
    woodGroup: threeCombinationGroups.find(row => row.values === '亥卯未'),
    yinHai: shared.natalRelationPairs.find(pair => pair.kind === '六合' && ['寅亥', '亥寅'].includes(pair.values)),
    xinSeals: overlappingSeals.filter(row => row.kind === '透干' && row.stem === '辛'),
  } : undefined;
  const xuanSourceShape = xuanSealComparison?.woodGroup?.nativeComplete && xuanSealComparison.yinHai
    && xuanSealComparison.xinSeals.length === 2 ? xuanSealComparison : undefined;
  const hasXuanSourceSealAid = seen(Boolean(xuanSourceShape && ['己巳', '戊辰'].includes(luckPillar)
    && xuanSourceShape.xinSeals.every(seal => officerSealProtectionPaths.some(path => path.seal === seal
      && path.movingAuthority.some(authority => authority.kind === '运干' && authority.stem === luckPillar[0])))));
  const hasXuanSourceWealthBreaksSeal = seen(Boolean(xuanSourceShape && luckPillar === '丁卯'
    && xuanSourceShape.xinSeals.every(seal => officerSealProtectionPaths.some(path => path.seal === seal
      && path.movingWealth.some(wealth => wealth.kind === '运干' && wealth.stem === '丁')))));
  const jinWealth = officerSealNamedStrong ? wealth.find(row => row.position === 'hour' && row.stem === '庚' && row.kind === '透干') : undefined;
  const jinSealComparison = jinWealth && ['乙酉', '甲申', '癸未', '壬午'].includes(luckPillar) ? {
    wealth: jinWealth,
    woodGroup: threeCombinationGroups.find(row => row.values === '亥卯未'),
    natalMetalRoots: hidden.filter(row => row.element === '金'),
    movingMetalRoots: shared.movingRows.filter(row => row.kind === '运支藏干' && row.element === '金'),
    jiaHiddenRoots: hidden.filter(row => row.stem === '甲'),
    southernBridges: ['癸未', '壬午'].includes(luckPillar)
      ? wealthSupportingOfficerSeal.filter(row => row.wealth === jinWealth) : [],
  } : undefined;
  const jinSourceWealthTrimsSeal = jinSealComparison?.woodGroup?.nativeComplete && ['乙酉', '甲申'].includes(luckPillar)
    ? jinSealComparison.movingMetalRoots.filter(wealth => luckWealthControlsSeal.some(link => link.from === wealth
      && link.to.position === 'year' && link.to.stem === '乙' && link.to.kind === '透干')
      && luckWealthControlsSeal.some(link => link.from === wealth
        && link.to.position === 'month' && link.to.stem === '甲' && link.to.kind === '支藏'))
    : [];
  const jinSourceOutputThroughWealth = sealOverlapWealthPaths.find(path =>
    jinSourceWealthTrimsSeal.includes(path.moving) && path.fedByOutput.some(output =>
      output.kind === '支藏' && (output.position === 'day' && output.stem === '己'
        || output.position === 'hour' && output.stem === '戊')));
  const hasJinSourceSealReinforcement = seen(Boolean(jinSealComparison?.woodGroup?.nativeComplete
    && jinSealComparison.southernBridges.some(path => path.through.kind === '运干' && path.through.stem === luckPillar[0]
      && path.seal.position === 'year' && path.seal.stem === '乙' && path.seal.kind === '透干')));
  const xueXuWealth = isXue && luckPillar === '甲戌' ? shared.movingContacts.filter(link => link.from.kind === '运支藏干'
    && link.from.stem === '戊' && link.to.position === 'month' && link.to.stem === '壬' && link.to.kind === '透干' && link.relation === '克')
    .map(link => ({ ...link, companionControlsWealth: baziStemControls(shared.movingRows[0].stem, link.from.stem) })) : [];
  const xueYinShenClashes = isXue && luckPillar === '戊寅' ? [...shared.natalRelationPairs, ...shared.movingRelationPairs]
    .filter(pair => pair.kind === '六冲' && ['寅申', '申寅'].includes(pair.values)) : [];
  return { profile: zpqzOfficerPolicy.profile, timeKnown, dayMaster: shared.dayMaster, natalPillars: shared.natalPillars,
    monthHiddenGods: shared.monthHiddenGods, monthOfficerCandidate, gods: shared.gods,
    officerPresent: shared.officerPresent, officerExposed: seen(officers.some(row => row.kind === '透干')),
    wealthPresent: seen(wealth.length > 0), wealthExposed: shared.wealthExposed,
    sealsPresent: shared.sealsPresent, sealsExposed: shared.sealsExposed,
    sealsAbsent: shared.sealsPresent === undefined ? undefined : !shared.sealsPresent, outputPresent: seen(outputs.length > 0),
    wealthOfficerContacts: shared.wealthOfficerContacts, officerSealContacts: contacts(officers, seals),
    wealthOfficerSealPaths, hasWealthOfficerSealPath: wealthOfficerSealPaths.length > 0,
    wealthFedOfficerUnderOutput, hasWealthFedOfficerUnderOutput: wealthFedOfficerUnderOutput.length > 0,
    outputOfficerContacts: contacts(outputs, officers), dayOutputContacts, sealOutputContacts: shared.sealOutputContacts,
    wealthSealContacts: shared.wealthSealContacts, sealDayMasterContacts: shared.sealDayMasterContacts,
    roots: shared.roots, movingRows: shared.movingRows, movingContacts: shared.movingContacts, natalMovingContacts: shared.natalMovingContacts,
    officerLuckRoutes, wealthSupportingOfficerSeal, officerExposureChecks, monthOfficerExposureConflicts,
    hasMonthOfficerVisibleLuckConflict: seen(Boolean(monthOfficerExposureConflicts
      && (monthOfficerExposureConflicts.authority.length || monthOfficerExposureConflicts.combinations.length))),
    onlyHiddenMonthOfficerDirectLuckClash, hasOnlyHiddenMonthOfficerDirectLuckClash: seen(Boolean(onlyHiddenMonthOfficerDirectLuckClash)),
    xueSourceNatalOfficerWealthRoots,
    xueSourceWealthOfficerSeal, hasXueSourceWealthOfficerSeal: Boolean(xueSourceWealthOfficerSeal),
    xueSourceOfficerSealSupport, hasXueSourceOfficerSealSupport: seen(Boolean(xueSourceOfficerSealSupport)),
    xueSourceOfficerSealFurtherSupport, xueSourceOfficerSealFurtherRoute: xueSourceOfficerSealFurtherSupport?.route,
    xueSourceBodySupport, hasXueSourceBodySupport: Boolean(xueSourceBodySupport),
    xueSourceNorthernSealOutput, hasXueSourceNorthernSealOutput: seen(Boolean(xueSourceNorthernSealOutput)),
    xueSourceChouNorthernSeal, hasXueSourceChouNorthernSeal: seen(Boolean(xueSourceChouNorthernSeal)),
    zaqiSourceOfficerAid, hasZaqiSourceOfficerAid: Boolean(zaqiSourceOfficerAid),
    zaqiInactiveWealthSeal, zaqiWealthSealSourceExcludesBridge: timeKnown ? Boolean(zaqiInactiveWealthSeal) : undefined,
    fanWealthConversion, fanWealthConvertedToOfficer: seen(Boolean(fanWealthConversion)),
    fanBranchWealth, fanBranchWealthSupportsOfficer, fanSourceOfficerSealSupport, fanSourceOfficerSealSupportRoute,
    fanSourceSealChecksOutput, hasFanSourceSealChecksOutput: seen(Boolean(fanSourceSealChecksOutput)),
    fanSourceYouOutputChallengesOfficer, hasFanSourceYouOutputChallengesOfficer: seen(Boolean(fanSourceYouOutputChallengesOfficer)),
    jinSourceWealthTrimsSeal, hasJinSourceWealthTrimsSeal: jinSourceWealthTrimsSeal.length > 0,
    jinSourceOutputThroughWealth, hasJinSourceOutputThroughWealth: seen(Boolean(jinSourceOutputThroughWealth)),
    hasJinSourceSealReinforcement,
    monthOfficerWealthPaths, officerWealthBodySupport, officerWealthNamedStrong, officerWealthNamedWeak,
    hasOfficerWealthBodySupport: Boolean(officerWealthBodySupport && hasDayFortuneSupport),
    hasOfficerWealthAid: monthOfficerWealthPaths.some(path => path.movingOfficer.length || path.movingWealth.length),
    monthOfficerSealPaths, officerSealBodySupport, officerSealNamedStrong, jinSealComparison,
    liSourceOfficerSealReview, hasLiSourceRepeatedKiller: seen(Boolean(liRepeatedKillerCombination)),
    hasLiSourceOfficerSealSupport: seen(Boolean(liIncomingSeal)),
    hasOfficerSealBodySupport: Boolean(officerSealBodySupport && hasDayFortuneSupport),
    hasWuSourceOfficerSealSupport,
    hasOfficerSealWealthOutput: monthOfficerSealPaths.length > 0 && (monthOfficerSealPaths.some(path => path.movingWealth.length)
      || luckOutputFeedsWealth.some(path => path.wealth.length)),
    luckWealthControlsSeal, luckOutputFeedsWealth, luckSealControlsOutput, luckOfficerFeedsSeal,
    officerSealProtectionPaths, sealOverlapWealthPaths, officerSealOutputNamedForRestraint, xuanSealComparison,
    hasXuanSourceSealAid, hasXuanSourceWealthBreaksSeal,
    hasOfficerSealProtection: officerSealProtectionPaths.some(path => path.movingSeals.length || path.movingAuthority.length),
    hasSealOverlapWealth: sealOverlapWealthPaths.length > 0,
    overlappingSeals, sealsOverlapAcrossColumns: seen(overlappingSeals.length > 0),
    natalFivePairs: shared.natalFivePairs, movingFivePairs: shared.movingFivePairs, hiddenFivePairs, officerBranchRelations,
    nativeRelations: shared.natalRelationPairs, movingRelations: shared.movingRelationPairs, threeCombinationGroups,
    luBranch, natalLuPositions: shared.natalPillars.filter(row => row.pillar[1] === luBranch), luckAtLu: luckPillar[1] === luBranch,
    printedCases, ...matchZpqzPrintedLuck(printedCases, printedLuckReadings, luckPillar),
    sourceVariants: zpqzOfficerVariants,
    counterfactual, counterfactualWealthSeal, hasCounterfactualWealthSeal: counterfactualWealthSeal.length > 0,
    xueXuWealth, xueHaiClashes, xueYinShenClashes,
    luckPillar, luckTenGod: describeBaZiPillar(luckPillar, shared.dayMaster).tenGod, luckBranchMainQiGod: shared.luckBranchMainQiGod,
    strengthVerified: false, protectionVerified: false, transformationVerified: false, effectTimingVerified: false };
}
