import { baziColumnRoles, baziInteractions, baziStemControls, baziStemFeeds, describeBaZiPillar, describeBaZiStem,
  smthHeavenVirtue, smthHeavenVirtueTaboo, smthHorseBranch, smthMoonVirtueRule, type BaziColumnRole } from './bazi-calculation';
import { smthLuNextBranch, smthSeasonalPowers } from './bazi-annual-luck';
import { schoolExamNobleSeason, smthTianyiBranches } from './bazi-school-exam';
import { smthBirthMonthGeneral, smthMonthDuty } from './bazi-smth-month-duty';
import { lunarAtBeijing, lunarAtCivilClock } from './fortune-calendar';
import { civilClockEpoch } from './period-window';
import type { DestinyChartSnapshot } from '../../destiny';

const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
const sexagenary = Array.from({ length: 60 }, (_, index) => stems[index % 10] + branches[index % 12]);
// 卷五〈论正官〉的十个日干所列正气月建。
const officerMonths = ['酉', '申巳', '子', '亥', '卯', '寅', '午', '寅巳', '午未丑', '辰巳戌'];
const positions = ['year', 'month', 'day', 'hour'] as const;
type Position = typeof positions[number];
type Natal = Record<Position, string>;
type Luck = { status: 'confirmed'; pillar: string } | { status: 'before_luck' | 'unavailable' };
type WitnessPillar = { position: string; pillar: string };
export const baziAnnualRelationPolicy = {
  profile: 'smth-annual-column-relations-v1', calendar: 'beijing-li-chun-year-and-actual-luck-boundaries',
  pairing: 'annual-to-one-natal-or-confirmed-luck-column',
  orientation: 'natal-stem-first-annual-stem-second-no-universal-yang-weight',
  combineDetails: 'smth-volume-two-year-combines-v10',
  jiaWuRescue: 'smth-volume-two-jia-wu-rescue-v5',
  presence: 'exposed-versus-hidden-and-whole-gengshen-pillar-kept-separate',
  unknown: 'unknown-hour-or-unconfirmed-luck-never-counted-absent',
  outcome: 'witnesses-not-effective-restraint-rescue-transformations-or-personal-events',
} as const;
function validPillar(value: string) {
  return typeof value === 'string' && value.length === 2 && stems.includes(value[0]) && branches.includes(value[1])
    && stems.indexOf(value[0]) % 2 === branches.indexOf(value[1]) % 2;
}
const cycleIndex = (pillar: string) => sexagenary.indexOf(pillar);
const xunHead = (index: number) => sexagenary[Math.floor(index / 10) * 10];
const knownPresence = (count: number, complete: boolean) => count > 0 ? true : complete ? false : undefined;

function fivePositionContact(pillar: string, reference: string, offset: 5 | -5) {
  const referenceTarget = sexagenary[(cycleIndex(reference) + offset + 60) % 60];
  if (pillar[1] !== referenceTarget[1]) return undefined;
  return { reference, referenceTarget, pillar, role: offset === 5 ? 'house' : 'tomb',
    match: pillar === referenceTarget ? 'whole-pillar' : 'same-branch' } as const;
}

function smthVirtueRestriction(taboo: string, index: 0 | 1, pillars: WitnessPillar[], complete: boolean) {
  const positions = pillars.filter(row => row.pillar[index] === taboo).map(row => row.position);
  return { taboo, positions, status: positions.length ? 'listed-counter-present'
    : complete ? 'listed-counter-absent' : 'coverage-unverified' } as const;
}

function smthNatalOfficerEvidence(natal: Natal, roles: BaziColumnRole[], natalPairs: ReturnType<typeof baziInteractions>['pairs']) {
  const exposedOfficers = roles.filter(row => row.god === '正官' && row.placement === 'stem');
  const exposedKillers = roles.filter(row => row.god === '七杀' && row.placement === 'stem');
  const wealth = roles.filter(row => row.god === '正财' || row.god === '偏财');
  const seals = roles.filter(row => row.god === '正印' || row.god === '偏印');
  const hurting = roles.filter(row => row.god === '伤官');
  const monthBranch = natal.month[1];
  return exposedOfficers.map(officer => ({
    officer, monthBranch, sourceOfficerMonth: officerMonths[stems.indexOf(natal.day[0])].includes(monthBranch),
    monthRoot: roles.find(row => row.column === 'month' && row.stem === officer.stem && row.placement !== 'stem'),
    wealthToOfficer: wealth.filter(row => baziStemFeeds(row.stem, officer.stem)),
    officerToSeals: seals.filter(row => baziStemFeeds(officer.stem, row.stem)),
    hurtingControls: hurting.filter(row => baziStemControls(row.stem, officer.stem)).map(role => ({
      role, atHourPhase: describeBaZiPillar(natal.hour, role.stem).phase,
      restrainingSeals: seals.filter(seal => baziStemControls(seal.stem, role.stem)),
    })),
    officerAtHourPhase: describeBaZiPillar(natal.hour, officer.stem).phase,
    exposedKillers,
    officerCombines: natalPairs.filter(row => row.kind === '天干五合' && row.members.includes(officer.column)),
  }));
}

function smthMonthGeneralNatalSupports(natal: Natal, birthAt: number) {
  const dayStem = natal.day[0];
  const roles = positions.flatMap(position => baziColumnRoles(position, natal[position], dayStem));
  const officers = roles.filter(role => role.god === '正官' || role.god === '七杀');
  const nobleSeason = schoolExamNobleSeason(birthAt)?.season;
  const { chosenNobleBranch } = smthTianyiBranches(dayStem, nobleSeason);
  const { luBranch } = smthLuNextBranch(dayStem);
  const horseBranch = smthHorseBranch(natal.year[1])!;
  const atBranch = (branch: string) => positions.filter(position => natal[position][1] === branch);
  const tianyiPositions = chosenNobleBranch ? atBranch(chosenNobleBranch) : undefined;
  const luPositions = atBranch(luBranch), horsePositions = atBranch(horseBranch);
  const natalPairs = baziInteractions(positions.map(position => ({ id: position, pillar: natal[position] }))).pairs;
  const natalContacts = natalPairs.filter(row => ['六合', '六冲', '六破', '相刑'].includes(row.kind));
  const voidReferences = (['year', 'day'] as const).map(position => ({
    position, details: describeBaZiPillar(natal[position]),
  }));
  const supportPositions = [...new Set([...(tianyiPositions ?? []), ...luPositions, ...horsePositions])];
  const branchSupportDetails = supportPositions.map(position => {
    const pillar = natal[position];
    const voidSources = voidReferences.filter(row => row.details.voidBranches.includes(pillar[1]))
      .map(row => ({ position: row.position, xun: row.details.xun }));
    const contacts = natalContacts.filter(row => row.members.includes(position));
    return { position, pillar, voidSources, contacts,
      voidHasCombination: voidSources.length > 0 && contacts.some(row => row.kind === '六合') };
  });
  return {
    officers, nobleSeason, tianyiBranch: chosenNobleBranch, tianyiPositions,
    luBranch, luPositions, horseBranch, horsePositions,
    tianyiHorsePositions: tianyiPositions?.filter(position => horsePositions.includes(position)),
    officerEvidence: smthNatalOfficerEvidence(natal, roles, natalPairs),
    branchSupportDetails,
    hasAllNamedPositions: tianyiPositions && tianyiPositions.length > 0 && luPositions.length > 0 && horsePositions.length > 0
      && officers.some(row => row.god === '正官' && row.placement === 'stem'),
  };
}

function smthJiaWuRescue(natal: Natal, witnesses: WitnessPillar[], hiddenGui: WitnessPillar[], complete: boolean,
  interactions: ReturnType<typeof baziInteractions>, groups: ReturnType<typeof baziInteractions>['groups']) {
  const byPosition = new Map(witnesses.map(row => [row.position, row]));
  const stemControls = interactions.elemental.flatMap(row => {
    if (row.part !== 'stem') return [];
    if (row.kind === '前克后') return [{ source: row.from, target: row.to }];
    if (row.kind === '后克前') return [{ source: row.to, target: row.from }];
    return [];
  });
  const stemCombines = interactions.pairs.filter(row => row.kind === '天干五合');
  const branchClashes = interactions.pairs.filter(row => row.kind === '六冲');
  const hiddenMetalRoots = witnesses.flatMap(holder => describeBaZiPillar(holder.pillar).hiddenStems
    .flatMap((root, index) => root.element === '金' ? [{
      ...holder, stem: root.stem, mainQi: index === 0,
      clashes: branchClashes.filter(row => row.members.includes(holder.position)),
    }] : []));
  const metalControls = stemControls.flatMap(({ source, target }) => {
    const holder = byPosition.get(source);
    if (target !== 'day' || !holder || !'庚辛'.includes(holder.pillar[0])) return [];
    const otherCombines = stemCombines.filter(pair => pair.members.includes(source)).flatMap(pair => {
      const partner = byPosition.get(pair.members.find(position => position !== source) ?? '');
      return partner ? [partner] : [];
    });
    return [{ ...holder, target, fireControls: stemControls.flatMap(link => {
      const fire = byPosition.get(link.source);
      return link.target === source && fire && '丙丁'.includes(fire.pillar[0]) ? [fire] : [];
    }), otherCombines }];
  });
  const guiPairs = stemCombines.filter(row => /^(戊癸|癸戊)$/u.test(row.values));
  const guiCombines = witnesses.filter(row => row.pillar[0] === '癸'
    && guiPairs.some(pair => pair.members.includes(row.position) && pair.members.includes('annual')))
    .map(holder => ({
      ...holder, target: 'annual',
      otherWuPositions: guiPairs.filter(pair => pair.members.includes(holder.position) && !pair.members.includes('annual'))
        .flatMap(pair => pair.members.filter(position => position !== holder.position)),
      branchClashes: branchClashes.filter(row => row.members.includes(holder.position) || row.members.includes('annual')),
    }));
  const dualDirectWitnesses = metalControls.length > 0 && guiCombines.length > 0;
  const guiCompetingPositions = guiCombines.length > 1 ? guiCombines.map(row => row.position) : [];
  const directPathsWithoutStemCounters = metalControls.some(row => !row.fireControls.length && !row.otherCombines.length)
    && guiCombines.length === 1 && !guiCombines[0].otherWuPositions.length;
  const allMetalRootsClashed = complete && hiddenMetalRoots.length > 0
    && hiddenMetalRoots.every(root => root.clashes.length > 0);
  const jiaWuDualWitnessState = !dualDirectWitnesses ? 'not-observed'
    : !directPathsWithoutStemCounters ? 'with-countercontact'
      : guiCombines[0].branchClashes.length > 0 ? 'with-gui-branch-clash'
        : allMetalRootsClashed ? 'with-metal-root-clash'
          : complete ? 'verified-without-listed-counters' : 'coverage-unverified';
  const metalWithoutListedCounters = metalControls.filter(row => !row.fireControls.length && !row.otherCombines.length
    && !branchClashes.some(clash => clash.members.includes(row.position)));
  const namedNatalMetal = metalWithoutListedCounters.some(row => row.pillar === '庚申' && row.position !== 'luck');
  const namedMovingMetal = metalWithoutListedCounters.some(row => row.pillar === '庚申' && row.position === 'luck');
  const jiaWuNamedRescuePair = complete
    ? namedNatalMetal && jiaWuDualWitnessState === 'verified-without-listed-counters' : undefined;
  const monthBranch = natal.month[1];
  const extraWood = witnesses.filter(row => row.position !== 'day' && row.position !== 'luck' && '甲乙'.includes(row.pillar[0])
    && stemControls.some(link => link.source === row.position && link.target === 'annual'));
  const fireAssembly = groups.find(row => row.kind === '三合' && row.values === '寅午戌');
  const natalFireMembers = fireAssembly?.byBranch.map(holders => holders.filter(position => position !== 'luck'));
  const woodClause = '寅卯亥未'.includes(monthBranch) && extraWood.length ? {
    monthBranch, extraWood,
    exposedFire: witnesses.filter(row => row.position !== 'luck' && '丙丁'.includes(row.pillar[0])),
    natalFireMembers: natalFireMembers?.every(holders => holders.length > 0) ? natalFireMembers : undefined,
  } : undefined;
  // The assembly language belongs to the separate natal repeated-wood clause.
  // A Jia day cannot occupy a Yin branch of the metal group, and the required natal month is outside that group.
  const fireCandidate = Boolean(woodClause?.exposedFire.length && woodClause.natalFireMembers);
  const soleWitnessPath = !complete || fireCandidate ? undefined
    : namedNatalMetal && !guiCombines.length && !hiddenGui.length ? 'named-metal-only'
      : guiCombines.length === 1 && !guiCombines[0].otherWuPositions.length && !guiCombines[0].branchClashes.length
        && !metalControls.length && !hiddenMetalRoots.length ? 'gui-only' : undefined;
  const jiaWuMovingMetalWitness = complete && namedMovingMetal && !namedNatalMetal && !fireCandidate
    ? jiaWuDualWitnessState === 'verified-without-listed-counters' ? 'moving-metal-with-gui'
      : !guiCombines.length && !hiddenGui.length ? 'moving-metal-only' : undefined
    : undefined;
  const namedXinMetal = metalWithoutListedCounters.some(row => row.pillar === '辛酉');
  const jiaWuRootedXinWitness = complete && !namedNatalMetal && !namedMovingMetal && !fireCandidate && namedXinMetal
    ? jiaWuDualWitnessState === 'verified-without-listed-counters' ? 'metal-with-gui'
      : !guiCombines.length && !hiddenGui.length ? 'metal-only' : undefined
    : undefined;
  const crossColumnLuRoot = complete && witnesses.some(row => row.position === 'luck') && !fireCandidate
    && !namedNatalMetal && !namedMovingMetal && !namedXinMetal && metalWithoutListedCounters.some(metal => {
      const stem = metal.pillar[0], { luBranch } = smthLuNextBranch(stem);
      return hiddenMetalRoots.some(root => root.position !== metal.position && root.stem === stem && root.mainQi
        && root.pillar[1] === luBranch && root.clashes.length === 0);
    });
  const jiaWuCrossColumnMetalWitness = crossColumnLuRoot
    ? jiaWuDualWitnessState === 'verified-without-listed-counters' ? 'metal-with-gui'
      : !guiCombines.length && !hiddenGui.length ? 'metal-only' : undefined
    : undefined;
  // Volume two names Si as Geng's growth position separately from Shen Lu.
  const gengGrowthRoots = complete && witnesses.some(row => row.position === 'luck') && !fireCandidate
    && !namedNatalMetal && !namedMovingMetal && !namedXinMetal && !crossColumnLuRoot
    && jiaWuDualWitnessState === 'verified-without-listed-counters'
    ? metalWithoutListedCounters.filter(metal => metal.pillar[0] === '庚').flatMap(metal => hiddenMetalRoots
      .filter(root => root.position !== metal.position && root.stem === '庚' && root.pillar[1] === '巳' && !root.clashes.length)
      .map(root => ({ metal, root })))
    : [];
  const jiaWuGrowingGengMetalWitness = gengGrowthRoots.length ? 'metal-with-gui' : undefined;
  const observed = metalControls.length > 0 || guiCombines.length > 0 || fireCandidate;
  return {
    jiaWuRescueProfile: baziAnnualRelationPolicy.jiaWuRescue,
    jiaWuRescueCandidate: observed ? true : complete && !hiddenGui.length ? false : undefined,
    jiaWuDualWitnessState,
    jiaWuNamedRescuePair,
    jiaWuSoleWitnessPath: soleWitnessPath, jiaWuMovingMetalWitness, jiaWuRootedXinWitness, jiaWuCrossColumnMetalWitness,
    jiaWuGrowingGengMetalWitness,
    jiaWuRescue: {
      metalControls,
      metalRootReview: metalControls.map(({ position, pillar }) => {
        const metalStem = pillar[0], { luBranch } = smthLuNextBranch(metalStem);
        return { position, pillar, luBranch, roots: hiddenMetalRoots.map(root => ({
          ...root, sameStem: root.stem === metalStem,
        })) };
      }),
      gengGrowthRoots, guiCombines, guiCompetingPositions, woodClause, fireCandidate,
    },
  };
}

// Recompute only our source qualification, without changing another business's
// archive or dropping existing bazi facts when this source cannot be qualified.
export function annualRelationNatalClockReady(natal: Natal & { utc: string }, timeKnown: boolean,
  clock?: DestinyChartSnapshot['birthContext']) {
  const at = Date.parse(natal.utc);
  if (!Number.isFinite(at) || !positions.filter(p => p !== 'hour' || timeKnown).every(p => validPillar(natal[p]))) return false;
  const lunar = lunarAtBeijing(at);
  if (clock) {
    if (!timeKnown || clock.precision !== 'minute' || clock.clockVersion !== 'gregory-iana-intl-v1' || Date.parse(clock.birthInstant) !== at) return false;
    try {
      const local = lunarAtCivilClock(civilClockEpoch(at, clock.timeZone));
      return natal.year === lunar.getYearInGanZhiExact() && natal.month === lunar.getMonthInGanZhiExact()
        && natal.day === local.getDayInGanZhiExact() && natal.hour === local.getTimeInGanZhi();
    } catch {
      return false;
    }
  }
  return natal.year === lunar.getYearInGanZhiExact() && natal.month === lunar.getMonthInGanZhiExact()
    && natal.day === lunar.getDayInGanZhiExact() && (!timeKnown || natal.hour === lunar.getTimeInGanZhi());
}

export function baziAnnualColumnRelations(natal: Natal & { utc?: string }, timeKnown: boolean, yearPillar: string, luck: Luck = { status: 'unavailable' }) {
  const knownPositions = positions.filter(p => p !== 'hour' || timeKnown);
  if (![...knownPositions.map(p => natal[p]), yearPillar, ...(luck.status === 'confirmed' ? [luck.pillar] : [])].every(validPillar)
    || !['confirmed', 'before_luck', 'unavailable'].includes(luck.status)) throw new RangeError('Invalid annual column relations');
  const year = describeBaZiPillar(yearPillar, natal.day[0]);
  const pairs = knownPositions.map(position => {
    const pillar = natal[position], compared = baziInteractions([{ id: 'natal', pillar }, { id: 'annual', pillar: yearPillar }]);
    const relations = compared.pairs.map(row => row.kind), stemElement = compared.elemental.find(row => row.part === 'stem')!;
    return { position, pillar, stemPair: pillar[0] + yearPillar[0], branchPair: pillar[1] + yearPillar[1], relations,
      stemCombine: relations.includes('天干五合'), branchCombine: relations.includes('六合'),
      bothCombine: relations.includes('天干五合') && relations.includes('六合'),
      natalStemControlsYear: stemElement.kind === '前克后', yearControlsNatalStem: stemElement.kind === '后克前',
      branchClash: relations.includes('六冲'), branchHarm: relations.includes('六害'), branchPunishment: relations.includes('相刑') };
  });
  const birthYear = pairs.find(pair => pair.position === 'year')!;
  const day = pairs.find(pair => pair.position === 'day')!, hour = pairs.find(pair => pair.position === 'hour');
  const [birthYearBranch, annualBranch] = birthYear.branchPair;
  const birthYearBranchRelations = birthYear.relations.filter(relation =>
    ['六合', '六冲', '六害', '六破', '相刑'].includes(relation));
  if (birthYearBranch === annualBranch) birthYearBranchRelations.push('同支');
  const sameColumnCombines = pairs.filter(pair => pair.bothCombine).map(pair => pair.position);
  const stemCombinePositions = pairs.filter(pair => pair.stemCombine).map(pair => pair.position);
  const branchCombinePositions = pairs.filter(pair => pair.branchCombine).map(pair => pair.position);
  const stemClashPositions = pairs.filter(pair => pair.relations.includes('天干四冲')).map(pair => pair.position);
  const branchClashPositions = pairs.filter(pair => pair.branchClash).map(pair => pair.position);
  const sameColumnDoubleClashPositions = branchClashPositions.filter(position => stemClashPositions.includes(position));
  const natalRepeatPositions = pairs.filter(pair => pair.pillar === yearPillar).map(pair => pair.position);
  const witnessPillars: WitnessPillar[] = [...knownPositions.map(position => ({ position, pillar: natal[position] })),
    ...(luck.status === 'confirmed' ? [{ position: 'luck', pillar: luck.pillar }] : [])];
  const exposedMetal = witnessPillars.filter(row => '庚辛'.includes(row.pillar[0])).map(row => ({ ...row, stem: row.pillar[0],
    // Positions containing metal roots are observable. Quantity is not strength.
    roots: witnessPillars.flatMap(root => describeBaZiPillar(root.pillar).hiddenStems.some(hidden => hidden.element === '金') ? [root.position] : []) }));
  const exposedGui = witnessPillars.filter(row => row.pillar[0] === '癸');
  const hiddenGui = witnessPillars.filter(row => describeBaZiPillar(row.pillar).hiddenStems.some(hidden => hidden.stem === '癸'));
  const allWitnessPositionsKnown = timeKnown && luck.status !== 'unavailable';
  const metalPresent = knownPresence(exposedMetal.length, allWitnessPositionsKnown), guiPresent = knownPresence(exposedGui.length, allWitnessPositionsKnown);
  const witnessBranch = metalPresent === true && guiPresent === true ? 'both-present'
    : metalPresent === true && guiPresent === false ? 'metal-only'
      : metalPresent === false && guiPresent === true ? 'gui-only'
        : metalPresent === false && guiPresent === false ? 'neither-present' : undefined;
  const all = [...witnessPillars, { position: 'annual', pillar: yearPillar }];
  const interactions = baziInteractions(all.map(row => ({ id: row.position, pillar: row.pillar })));
  const birthYearAnnualPunishmentGroups = birthYearBranch !== annualBranch
    ? interactions.groups.filter(group => group.kind === '三刑'
      && group.values.includes(birthYearBranch) && group.values.includes(annualBranch)
      && group.byBranch.every(members => members.some(position => position !== 'luck'))).map(group => group.values)
    : [];
  const luckRelations = interactions.pairs.filter(row => row.members.includes('luck') && row.members.includes('annual'));
  const luckStemCombine = luckRelations.some(row => row.kind === '天干五合');
  const luckBranchCombine = luckRelations.some(row => row.kind === '六合');
  const luckAnnualCombination = luck.status === 'confirmed'
    ? luckStemCombine && luckBranchCombine ? 'both' : luckStemCombine ? 'stem-only' : luckBranchCombine ? 'branch-only' : 'none'
    : undefined;
  const witnessGroups = baziInteractions(witnessPillars.map(row => ({ id: row.position, pillar: row.pillar }))).groups;
  const dayIndex = cycleIndex(natal.day), yearIndex = cycleIndex(yearPillar);
  const dayToYearSexagenarySteps = (yearIndex - dayIndex + 60) % 60;
  const yearToDaySexagenarySteps = (dayIndex - yearIndex + 60) % 60;
  const dayToYearBranchSteps = (branches.indexOf(yearPillar[1]) - branches.indexOf(natal.day[1]) + 12) % 12;
  const deathOrExtinction = (phase: string | undefined) => phase === '死' || phase === '绝';
  const friction = interactions.pairs.filter(row => ['相刑', '六害', '六破', '六冲'].includes(row.kind));
  const clashes = friction.filter(row => row.kind === '六冲');
  // A stem combination changes yin/yang parity; a six clash preserves it.
  // Record which other pillars clash with the year or the combining column.
  const annualClashes = clashes.filter(row => row.members.includes('annual'));
  const dayHouse = fivePositionContact(yearPillar, natal.day, 5);
  const hourTomb = hour && fivePositionContact(yearPillar, hour.pillar, -5);
  const dayHourHouseTomb = (position: string) => position === 'day' ? dayHouse : position === 'hour' ? hourTomb : undefined;
  const dayHourStemCombines = pairs.filter(pair => (pair.position === 'day' || pair.position === 'hour') && pair.stemCombine)
    .map(pair => {
      const participantPhase = pair.position === 'day' ? year.phase : describeBaZiPillar(yearPillar, pair.pillar[0]).phase;
      return {
        position: pair.position, pillar: pair.pillar, stemPair: pair.stemPair,
        positionWeight: pair.position === 'hour' ? 'heavier' : 'lighter',
        jiaJiWeight: pair.position !== 'day' ? undefined
          : pair.stemPair === '甲己' ? 'heavier' : pair.stemPair === '己甲' ? 'lighter' : undefined,
        ownHouseTomb: dayHourHouseTomb(pair.position),
        dayStemPhaseAtYearBranch: year.phase, participantStemPhaseAtYearBranch: participantPhase,
        annualClashes, combiningColumnClashes: clashes.filter(row => row.members.includes(pair.position)),
        yearClashAtDayStemDeathOrExtinction: annualClashes.length > 0 && deathOrExtinction(year.phase),
        yearClashAtParticipantDeathOrExtinction: annualClashes.length > 0 && deathOrExtinction(participantPhase),
      };
    });
  const monthDuty = dayHourStemCombines.length && timeKnown && natal.utc
    ? smthMonthDuty(Date.parse(natal.utc), natal.month[1], natal.day[0]) : undefined;
  const seasonalPowers = smthSeasonalPowers(natal.month[1]);
  const dutySlot = monthDuty?.slot;
  const dayHourMonthDutySeason = dutySlot && seasonalPowers.find(row => row.element === dutySlot.element);
  const dayHouseArrival = dayHourStemCombines.length ? dayHouse : undefined;
  // 辛丑本《总论岁运》以日、时取宅墓；以本命年柱作旁证的取法另记。
  const hourTombArrival = dayHourStemCombines.length ? hourTomb : undefined;
  const yearHouseTomb = (pillar: string) => fivePositionContact(pillar, natal.year, 5) ?? fivePositionContact(pillar, natal.year, -5);
  const annualHouseTomb = yearHouseTomb(yearPillar);
  const monthIndex = '寅卯辰巳午未申酉戌亥子丑'.indexOf(natal.month[1]);
  // 卷三〈论天月德〉壶中子支法：正月天德起亥、月德起未，各顺行一辰。
  const branchVirtues = [{ name: '天德', branch: branches[(11 + monthIndex) % 12] },
    { name: '月德', branch: branches[(7 + monthIndex) % 12] }];
  const { stem: moonVirtue, taboo: moonTaboo } = smthMoonVirtueRule(natal.month[1])!;
  const moonVirtueRestriction = smthVirtueRestriction(moonTaboo, 0, all, allWitnessPositionsKnown);
  const { readings: heavenVirtue } = smthHeavenVirtue(natal.month[1]);
  const heavenTaboo = smthHeavenVirtueTaboo(natal.month[1])!;
  const heavenVirtueRestriction = smthVirtueRestriction(heavenTaboo, stems.includes(heavenTaboo) ? 0 : 1, all, allWitnessPositionsKnown);
  const doubleCombinedPillars = witnessPillars.filter(pair => pair.position === 'luck'
    ? luckAnnualCombination === 'both' : sameColumnCombines.some(position => position === pair.position));
  const birthAt = doubleCombinedPillars.length && timeKnown && natal.utc ? Date.parse(natal.utc) : NaN;
  const birthMonthGeneral = smthBirthMonthGeneral(birthAt, natal.month[1]);
  const monthGeneralNatalSupports = birthMonthGeneral?.matchesHeavenVirtueGeneral
    ? smthMonthGeneralNatalSupports(natal, birthAt) : undefined;
  const doubleCombineDetails = doubleCombinedPillars.map(pair => {
    const directFriction = friction.filter(row => row.members.includes(pair.position) && row.members.includes('annual'));
    const punishmentSeason = directFriction.some(row => row.kind === '相刑') ? (() => {
      const participant = seasonalPowers.find(row => row.element === describeBaZiPillar(pair.pillar).branchElement)!;
      const annual = seasonalPowers.find(row => row.element === year.branchElement)!;
      const hasRestOrCaptive = [participant, annual].some(row => row.power === '休' || row.power === '囚');
      return { month: natal.month, participant, annual, hasRestOrCaptive };
    })() : undefined;
    const participantXun = xunHead(cycleIndex(pair.pillar));
    const participantAtMoonVirtue = pair.pillar[0] === moonVirtue, yearAtMoonVirtue = yearPillar[0] === moonVirtue;
    const heavenVirtuePositions = heavenVirtue.map(row => {
      const index = row.basis === 'stem' ? 0 : 1;
      const atParticipant = pair.pillar[index] === row.value, atAnnual = yearPillar[index] === row.value;
      return { ...row, atParticipant, atAnnual, restriction: atParticipant || atAnnual ? heavenVirtueRestriction : undefined };
    });
    return {
      position: pair.position, pillar: pair.pillar, moonVirtue,
      participantXun, annualXun: year.xun, sameXun: participantXun === year.xun,
      participantAtMoonVirtue, yearAtMoonVirtue,
      moonVirtueRestriction: participantAtMoonVirtue || yearAtMoonVirtue ? moonVirtueRestriction : undefined,
      natalHouseTomb: pair.position === 'day' || pair.position === 'hour' ? yearHouseTomb(pair.pillar) : undefined,
      ownHouseTomb: dayHourHouseTomb(pair.position),
      branchVirtues: branchVirtues.map(virtue => ({ ...virtue, atParticipant: pair.pillar[1] === virtue.branch,
        atAnnual: yearPillar[1] === virtue.branch })),
      heavenVirtue: heavenVirtuePositions,
      heavenVirtueMonthGeneral: birthMonthGeneral && heavenVirtuePositions.some(row => row.atParticipant || row.atAnnual)
        ? { ...birthMonthGeneral, printedFirstMonthExample: birthMonthGeneral.middleTerm === '雨水'
          && birthMonthGeneral.matchesHeavenVirtueGeneral && '丙丁'.includes(natal.day[0]),
          natalSupports: monthGeneralNatalSupports } : undefined,
      directFriction, punishmentSeason,
      // A contact with just one participant is separate from a direct contact.
      otherFriction: friction.filter(row => row.members.includes(pair.position) !== row.members.includes('annual')),
      punishments: interactions.groups.filter(row => row.kind === '三刑' && row.byBranch.some(members =>
        members.includes(pair.position) || members.includes('annual'))),
    };
  });
  const sourceDoubleCombines = doubleCombineDetails.filter(row => ['day', 'hour', 'luck'].includes(row.position)
    && !row.directFriction.length && !row.natalHouseTomb && !row.ownHouseTomb && !annualHouseTomb);
  const exactHouseTombCombines = doubleCombineDetails.filter(row => row.natalHouseTomb?.match === 'whole-pillar');
  const doubleWeakPunishmentCombines = doubleCombineDetails.filter(row => {
    const participant = row.punishmentSeason?.participant;
    if (participant?.power !== '休' && participant?.power !== '囚') return false;
    const naYinElement = describeBaZiPillar(row.pillar).naYin?.slice(-1);
    const naYinPower = seasonalPowers.find(season => season.element === naYinElement)?.power;
    return naYinPower === '休' || naYinPower === '囚';
  });
  return { profile: baziAnnualRelationPolicy.profile, timeKnown, dayMaster: natal.day[0], natalDay: natal.day,
    yearPillar, yearStem: yearPillar[0], yearTenGod: year.tenGod, yearMainQiTenGod: year.hiddenStems[0]?.tenGod,
    yearTenGodByNatalYearStem: describeBaZiStem(yearPillar[0], natal.year[0]).tenGod,
    pairs, stemCombinePositions, branchCombinePositions,
    stemClashPositions, branchClashPositions, sameColumnDoubleClashPositions, natalRepeatPositions,
    birthYearPillar: birthYear.pillar, birthYearBranchPair: birthYear.branchPair, birthYearBranchRelations,
    birthYearAnnualPunishmentGroups: birthYearAnnualPunishmentGroups.length || timeKnown ? birthYearAnnualPunishmentGroups : undefined,
    dayStemCombine: day.stemCombine, hourStemCombine: hour?.stemCombine,
    hasDayOrHourStemCombine: day.stemCombine || hour?.stemCombine ? true : timeKnown ? false : undefined,
    sameColumnCombines, hasSameColumnDoubleCombine: knownPresence(sameColumnCombines.length, timeKnown),
    dayControlsYear: day.natalStemControlsYear, yearControlsDay: day.yearControlsNatalStem, dayBranchClash: day.branchClash,
    hourControlsYear: hour?.natalStemControlsYear, yearControlsHour: hour?.yearControlsNatalStem,
    dayExample: day.stemPair === '甲己' ? 'day-jia-year-ji' : day.stemPair === '己甲' ? 'day-ji-year-jia' : undefined,
    dayToYearSexagenarySteps, yearToDaySexagenarySteps, dayToYearBranchSteps,
    combineDetailProfile: baziAnnualRelationPolicy.combineDetails,
    dayHourStemCombines, dayHourStemCombinePositions: dayHourStemCombines.length || timeKnown
      ? dayHourStemCombines.map(row => row.position) : undefined,
    fivePositionReferences: dayHourStemCombines.length ? {
      sexagenaryForward: dayToYearSexagenarySteps === 5, sexagenaryBackward: yearToDaySexagenarySteps === 5,
      branchForward: dayToYearBranchSteps === 5, branchBackward: dayToYearBranchSteps === 7,
    } : undefined,
    dayHouseArrival, hourTombArrival, annualHouseTomb,
    dayHourMonthDuty: monthDuty && { month: natal.month, elapsedDay: monthDuty.elapsedDay, label: monthDuty.slot?.label,
      stem: monthDuty.slot?.stem, outsidePrintedDays: monthDuty.outsidePrintedDays },
    dayHourMonthDutySeason,
    luckAnnualCombination,
    doubleCombineDetails, doubleCombineReviewedPositions: doubleCombineDetails.length || allWitnessPositionsKnown
      ? doubleCombineDetails.map(row => row.position) : undefined,
    sourceDoubleCombinePositions: sourceDoubleCombines.length || allWitnessPositionsKnown
      ? sourceDoubleCombines.map(row => row.position) : undefined,
    sourceExactHouseTombPositions: exactHouseTombCombines.length || timeKnown
      ? exactHouseTombCombines.map(row => row.position) : undefined,
    sourceDoubleWeakPunishmentPositions: doubleWeakPunishmentCombines.length || allWitnessPositionsKnown
      ? doubleWeakPunishmentCombines.map(row => row.position) : undefined,
    luckStatus: luck.status, luckPillar: luck.status === 'confirmed' ? luck.pillar : undefined,
    natalGengShenPositions: knownPositions.filter(p => natal[p] === '庚申'),
    luckGengShen: luck.status === 'confirmed' ? luck.pillar === '庚申' : luck.status === 'before_luck' ? false : undefined,
    exposedMetal, exposedGui, hiddenGui, metalPresent, guiPresent, witnessBranch,
    metalGroups: witnessGroups.filter(group => group.values === '巳酉丑').map(group => ({
      kind: group.kind, branches: group.values, byBranch: group.byBranch })),
    ...(natal.day[0] === '甲' && yearPillar[0] === '戊'
      ? smthJiaWuRescue(natal, witnessPillars, hiddenGui, allWitnessPositionsKnown, interactions, witnessGroups) : {}),
    sourceRelations: interactions.pairs,
    geometryOnly: true, rescueEffective: undefined, stemTransformation: undefined };
}
