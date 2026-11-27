import { baziInteractions, baziStemControls, baziStemFeeds, describeBaZiPillar } from './bazi-calculation';
import { baziZpqzSealFood, zpqzColumnStemCheck, zpqzHurtWealthCases } from './bazi-zpqz-seal-food';
import { baziZpqzStemOrder } from './bazi-zpqz-stems';
import { zpqzMonthPositions } from './bazi-zpqz-month';

type Natal = { year: string; month: string; day: string; hour: string };
const layers = ['year', 'month', 'day', 'hour'] as const, elements = '木火土金水';
export const zpqzKillerOrderPolicy = {
  profile: 'zpqz-killer-clearing-helper-order-v1',
  contacts: 'actual-visible-and-concealed-gods-not-effective-clearing',
  blade: 'five-yang-lu-plus-one-coordinates-month-only-pattern; Zhao-hour-not-month',
  variants: 'literal-JiaHu-and-BingHai-retained-as-invalid-not-repaired',
  order: 'native-four-columns-with-day-master; moving-stem-has-no-fifth-column',
} as const;
export const zpqzKillerOrderCases = [
  { id: 'noble', name: '一贵造', pillars: ['乙亥', '乙酉', '乙卯', '丁丑'] },
  { id: 'tuotuo', name: '脱丞相取运图', pillars: ['壬辰', '甲辰', '丙戌', '戊戌'] },
  { id: 'he', name: '何参政', pillars: ['丙寅', '戊戌', '壬戌', '辛丑'] },
  { id: 'zhou', name: '周丞相', pillars: ['戊戌', '甲子', '丁未', '庚戌'] },
  { id: 'liu-previous', name: '刘运使前章', pillars: ['甲申', '乙亥', '丙戌', '庚寅'] },
  { id: 'yue', name: '岳统制', pillars: ['癸卯', '丁巳', '庚寅', '庚辰'] },
  { id: 'shen', name: '沈郎中', pillars: ['丙子', '甲午', '辛亥', '辛卯'] },
  { id: 'zhao', name: '赵员外', pillars: ['戊辰', '甲寅', '戊寅', '戊午'] },
  ...zpqzHurtWealthCases,
  { id: 'hurt-officer', name: '丞相伤官用官例', pillars: ['戊申', '甲子', '庚午', '丁丑'] },
  { id: 'converted-wealth', name: '另论财旺生官例', pillars: ['甲子', '壬申', '己亥', '辛未'] },
  { id: 'zheng', name: '郑丞相', pillars: ['丙申', '己亥', '辛未', '己亥'] },
] as const;
export const zpqzKillerOrderVariants = [
  { id: 'tuotuo-prose', pillars: ['壬辰', '甲胡', '丙戌', '戊戌'], validPillars: false,
    issue: '前章散文录甲胡，取运图另录甲辰；甲胡不是可计算月柱，两个录文不静默合并' },
  { id: 'liu-luck-diagram', pillars: ['甲申', '乙亥', '丙亥', '庚寅'], validPillars: false,
    issue: '取运图录丙亥，前章另录丙戌且后文说寅戌；丙亥不属六十甲子，不改为已核生日' },
] as const;

export function baziZpqzKillerOrder(natal: Natal, timeKnown: boolean, luckPillar: string) {
  const base = baziZpqzSealFood(natal, timeKnown, luckPillar), order = baziZpqzStemOrder(natal, timeKnown, luckPillar);
  const rows = base.gods.flatMap(row => [...row.exposedRows, ...row.hiddenRows]);
  const role = (names: string[]) => rows.filter(row => names.includes(row.god));
  const food = role(['食神']), hurt = role(['伤官']), seals = role(['正印', '偏印']), wealth = role(['正财', '偏财']);
  const officers = role(['正官']), killers = role(['七杀']);
  const seen = (value: boolean) => value ? true : timeKnown ? false : undefined;
  const not = (value: boolean | undefined) => value === undefined ? undefined : !value;
  const present = (names: string[]) => seen(role(names).length > 0);
  const contacts = (from: typeof rows, to: typeof rows) => from.flatMap(a => to.map(b => ({ from: a, to: b,
    columnDistance: Math.abs(a.index - b.index), bothExposed: a.kind === '透干' && b.kind === '透干',
    between: base.natalPillars.filter(p => Math.min(a.index, b.index) < layers.indexOf(p.position as typeof layers[number])
      && layers.indexOf(p.position as typeof layers[number]) < Math.max(a.index, b.index)),
  })));
  const day = describeBaZiPillar(natal.day, base.dayMaster);
  const dayWitness = { position: 'day', index: 2, pillar: natal.day, stem: day.stem, branch: day.branch, god: '日元', element: day.stemElement, kind: '日干' };
  const clearingPairs = order.natalFivePairs.flatMap(pair => {
    if (pair.involvesDayMaster) return [];
    const target = [pair.first, pair.second].find(row => ['正官', '七杀'].includes(row.tenGod!));
    return target ? [{ ...pair, target, helper: pair.first === target ? pair.second : pair.first }] : [];
  });
  const moving = { position: 'decadal', ...describeBaZiPillar(luckPillar, base.dayMaster) };
  const movingAttacksClearingHelpers = clearingPairs.filter(pair => (elements.indexOf(moving.stemElement) + 2) % 5 === elements.indexOf(pair.helper.element))
    .map(pair => ({ moving, helper: pair.helper, target: pair.target, natalPair: pair }));
  const coordinates = zpqzMonthPositions(base.dayMaster, natal.month[1]);
  const native = base.natalPillars.map(row => ({ id: row.position, pillar: row.pillar }));
  const relations = baziInteractions([...native, { id: 'decadal', pillar: luckPillar }]);
  const visible = base.natalPillars.map(row => {
    const pillar = describeBaZiPillar(row.pillar, base.dayMaster);
    return { position: row.position, ...pillar, god: row.position === 'day' ? '日元' : pillar.tenGod,
      kind: row.position === 'day' ? '日干' : '透干' };
  });
  const printedCases = zpqzKillerOrderCases.map(c => ({ ...c, stemCheck: zpqzColumnStemCheck(c.pillars),
    matches: layers.every((position, i) => position === 'hour' && !timeKnown || natal[position] === c.pillars[i]) ? timeKnown ? true : undefined : false }));
  const matches = (id: string) => printedCases.some(row => row.id === id && row.matches === true);
  const atSameStem = (first: { position: string; stem: string }, second: typeof first) =>
    first.position === second.position && first.stem === second.stem;
  const luck = base.remedyMovingComponents.slice(0, 2).map((row, i) => i === 0 ? row : { ...row, kind: '运支本气' });
  const luckOf = (...gods: string[]) => luck.filter(row => gods.includes(row.god));
  const luckOutput = luckOf('食神', '伤官'), luckSeal = luckOf('正印', '偏印'), luckWealth = luckOf('正财', '偏财');
  const luckAuthority = luckOf('正官', '七杀');
  const luckSupport = luckOf('比肩', '劫财', '正印', '偏印').filter(row => row.element === dayWitness.element || baziStemFeeds(row.stem, dayWitness.stem));
  const monthKillers = killers.filter(row => row.position === 'month' && row.kind === '支藏');
  const foodKiller = base.foodKillerContacts.filter(link => monthKillers.includes(link.to)
    && baziStemFeeds(dayWitness.stem, link.from.stem) && baziStemControls(link.to.stem, dayWitness.stem))
    .map(({ from: output, to: killer }) => ({
      output, killer,
      outputLuck: luckOutput.filter(row => baziStemControls(row.stem, killer.stem)),
      wealthLuck: luckWealth.filter(row => baziStemFeeds(row.stem, killer.stem)),
      killerLuck: luckOf('七杀').filter(row => baziStemControls(output.stem, row.stem) && baziStemControls(row.stem, dayWitness.stem)),
      sealLuck: luckSeal.filter(row => baziStemControls(row.stem, output.stem)),
      foodCombines: output.kind === '透干' ? order.movingFivePairs.filter(pair => atSameStem(pair.target, output)) : [],
    }));
  const incomingOfficer = luckOf('正官').filter(row => baziStemControls(row.stem, dayWitness.stem));
  const noble = matches('noble');
  const nobleFood = noble ? foodKiller.find(path => path.output.position === 'hour' && path.output.kind === '透干' && path.output.stem === '丁') : undefined;
  const movingHidden = base.remedyMovingComponents.slice(1);
  const nobleFoodLuck = nobleFood ? {
    combinesFood: luckPillar === '壬午' ? nobleFood.foodCombines : [],
    foodRootInLuck: movingHidden.filter(row => row.stem === nobleFood.output.stem),
    killerRootInLuck: movingHidden.filter(row => row.stem === nobleFood.killer.stem),
    metalWaterStemRoots: ['金', '水'].includes(moving.stemElement) ? {
      stem: moving.stem, sameElement: movingHidden.filter(row => row.element === moving.stemElement),
    } : undefined,
    metalGroup: relations.groups.find(group => luckPillar === '辛巳' && group.kind === '三合' && group.values === '巳酉丑'
      && group.byBranch[0].includes('decadal') && group.byBranch[1].includes('month') && group.byBranch[2].includes('hour')),
    metalPair: relations.pairs.find(pair => luckPillar === '庚辰' && pair.kind === '六合' && pair.members.includes('month') && pair.members.includes('decadal')),
    combinesWood: order.movingFivePairs.filter(pair => luckPillar === '庚辰' && pair.target.stem === '乙'),
  } : undefined;
  const nobleSourceFoodKillerWarning = nobleFoodLuck?.combinesFood.some(pair => pair.target.position === 'hour') ? 'ren-combines-food'
    : nobleFoodLuck?.metalGroup ? 'si-supports-killer'
      : nobleFoodLuck?.metalPair && nobleFoodLuck.combinesWood.some(pair => pair.target.position === 'month') ? 'geng-chen-joins' : timeKnown ? 'none' : undefined;
  const nobleWeiFood = nobleFood && luckPillar === '癸未'
    ? nobleFoodLuck?.foodRootInLuck.find(row => row.stem === '丁' && row.god === '食神') : undefined;
  const nobleSouthernFoodRoot = nobleFood && nobleWeiFood && nobleFoodLuck?.metalWaterStemRoots?.sameElement.length === 0
    && baziStemControls(nobleWeiFood.stem, nobleFood.killer.stem) ? {
      food: nobleFood.output, killer: nobleFood.killer, root: nobleWeiFood, luckStem: luck[0],
      sealControlsFood: baziStemControls(luck[0].stem, nobleFood.output.stem),
      hourClash: relations.pairs.find(pair => pair.kind === '六冲' && pair.members.includes('decadal') && pair.members.includes('hour')),
    } : undefined;
  const he = matches('he');
  const foodBodySupport = noble || he ? [] : luckSupport;
  const dayRoots = order.roots.find(row => row.stem === dayWitness.stem)?.roots.filter(root => root.position !== 'decadal') ?? [];
  const hasRootedFoodPeerSupport = dayRoots.filter(root => root.exactStem).length === 1
    && !base.remedyMovingComponents.some(row => row.god === '正官')
    && foodBodySupport.some(row => row.god === '比肩' && row.stem === dayWitness.stem)
    && foodKiller.some(path => path.output.kind === '透干' && path.foodCombines.length === 0
      && !base.remedyMovingComponents.some(row => ['正印', '偏印'].includes(row.god)
        && baziStemControls(row.stem, path.output.stem)));
  const killerFoodMatched = !he && !noble && foodKiller.length > 0 && (foodBodySupport.length > 0 || incomingOfficer.length > 0
    || foodKiller.some(path => path.outputLuck.length || path.wealthLuck.length || path.killerLuck.length || path.sealLuck.length || path.foodCombines.length));

  const tuo = matches('tuotuo');
  const sealKillers = tuo ? killers.filter(row => row.position === 'year' && row.kind === '透干' && row.stem === '壬') : monthKillers;
  const killerSeal = sealKillers.flatMap(killer => seals.filter(seal => baziStemFeeds(killer.stem, seal.stem)
    && baziStemFeeds(seal.stem, dayWitness.stem) && (!tuo || seal.position === 'month' && seal.kind === '透干' && seal.stem === '甲'))
    .map(seal => ({ killer, seal,
      hurtLuck: luckOf('伤官').filter(row => baziStemControls(seal.stem, row.stem)),
      wealthLuck: luckWealth.filter(row => baziStemControls(row.stem, seal.stem)),
      authorityLuck: luckAuthority.filter(row => baziStemFeeds(row.stem, seal.stem)),
      sealLuck: luckSeal.filter(row => baziStemFeeds(killer.stem, row.stem) && baziStemFeeds(row.stem, dayWitness.stem)),
      peerLuck: luckSupport.filter(row => row.element === dayWitness.element),
      combinesSeal: seal.kind === '透干' ? order.movingFivePairs.filter(pair => pair.moving.tenGod === '伤官' && atSameStem(pair.target, seal)) : [],
    })));
  const killerSealMatched = monthKillers.length > 0 && killerSeal.some(path =>
    path.hurtLuck.length || path.wealthLuck.length || path.authorityLuck.length || path.sealLuck.length || path.peerLuck.length || path.combinesSeal.length);
  const printedTuoSealMatched = tuo && killerSeal.length > 0 && ['乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑'].includes(luckPillar);
  const tuoPath = printedTuoSealMatched ? killerSeal[0] : undefined;
  const tuoSealContext = tuoPath ? {
    combinesKiller: order.movingFivePairs.filter(pair => atSameStem(pair.target, tuoPath.killer)),
    killer: tuoPath.killer, seal: tuoPath.seal,
  } : undefined;
  const hePath = he ? killerSeal.find(path => path.killer.stem === '戊' && path.seal.position === 'hour'
    && path.seal.kind === '透干' && path.seal.stem === '辛') : undefined;
  const heExposedKiller = hePath && killers.find(row => row.position === 'month' && row.kind === '透干' && atSameStem(row, hePath.killer));
  const heWealth = hePath && wealth.find(row => row.position === 'year' && row.kind === '透干' && row.stem === '丙'
    && baziStemFeeds(row.stem, hePath.killer.stem));
  const heSeparation = heWealth && hePath && order.wealthSealPairs.find(pair =>
    atSameStem(pair.wealth, heWealth) && atSameStem(pair.seal, hePath.seal));
  const heSealContext = hePath && heExposedKiller && heWealth && heSeparation ? {
    wealth: heWealth, killer: hePath.killer, exposedKiller: heExposedKiller, seal: hePath.seal, between: heSeparation.between,
    movingSameSeal: base.remedyMovingComponents.filter(row => row.stem === hePath.seal.stem),
  } : undefined;
  const printedHeSealMatched = Boolean(heSealContext && ['庚子', '辛丑', '壬寅', '癸卯', '甲辰'].includes(luckPillar));
  const commentarySealPaths = he ? killerSeal.filter(path => path === hePath) : killerSeal;
  const killerSealHurtCommentary = timeKnown ? commentarySealPaths.flatMap(({ killer, seal, hurtLuck, combinesSeal }) =>
    hurtLuck.filter(hurt => baziStemFeeds(dayWitness.stem, hurt.stem)).map(hurt => ({
      killer, seal, day: dayWitness, hurt,
      joinsSeal: hurt.kind === '运干' && combinesSeal.some(pair => pair.moving.stem === hurt.stem),
    }))) : [];

  const exposedWealth = wealth.filter(row => row.kind === '透干');
  const exposedSeals = seals.filter(row => row.kind === '透干');
  const foodAndHurt = [...food, ...hurt];
  const zhou = matches('zhou');
  const remedyLuck = zhou ? [...luck, ...base.remedyMovingComponents.slice(2)] : luck;
  const wealthRemedies = monthKillers.flatMap(killer => foodAndHurt.filter(output => baziStemFeeds(dayWitness.stem, output.stem)
    && baziStemControls(output.stem, killer.stem) && baziStemControls(killer.stem, dayWitness.stem))
    .flatMap(output => exposedSeals.filter(seal => baziStemControls(seal.stem, output.stem)).flatMap(seal =>
      exposedWealth.filter(money => baziStemControls(money.stem, seal.stem)).map(money => ({ killer, output, seal, wealth: money,
        wealthLuck: remedyLuck.filter(row => ['正财', '偏财'].includes(row.god) && baziStemControls(row.stem, seal.stem)),
        outputLuck: remedyLuck.filter(row => ['食神', '伤官'].includes(row.god) && baziStemFeeds(row.stem, money.stem)),
        killerLuck: luckOf('七杀').filter(row => row.kind === '运干' && baziStemFeeds(money.stem, row.stem) && baziStemControls(output.stem, row.stem)),
        hiddenKillerLuck: zhou ? movingHidden.filter(row => row.god === '七杀' && baziStemFeeds(money.stem, row.stem)
          && baziStemControls(output.stem, row.stem)) : [],
        peerLuck: luckOf('劫财').filter(row => baziStemControls(row.stem, money.stem)),
        sealLuck: luckSeal.filter(row => baziStemControls(row.stem, output.stem)),
      })))));
  const wealthNourishes = monthKillers.flatMap(killer => exposedWealth.filter(money => baziStemFeeds(money.stem, killer.stem))
    .flatMap(money => foodAndHurt.filter(output => baziStemFeeds(output.stem, money.stem)).map(output => ({ killer, wealth: money, output }))));
  const killerWealthMatched = wealthRemedies.some(path => {
    const heSourceKeepsSeal = heSealContext && atSameStem(path.wealth, heSealContext.wealth)
      && atSameStem(path.seal, heSealContext.seal);
    return !heSourceKeepsSeal && (path.wealthLuck.length || path.outputLuck.length || path.killerLuck.length
      || path.peerLuck.length || path.sealLuck.length);
  });
  const hasZhouSourceWealthRemedy = zhou && ['戊辰', '己巳'].includes(luckPillar)
    && ['year', 'day', 'hour'].every(position => dayRoots.some(root => root.position === position && root.exactStem))
    && wealthRemedies.some(path => path.wealth.position === 'hour' && path.wealth.stem === '庚'
      && path.seal.position === 'month' && path.seal.stem === '甲'
      && path.output.kind === '透干' && path.output.position === 'year' && path.output.stem === '戊'
      && path.killer.position === 'month' && path.killer.stem === '癸'
      && path.outputLuck.some(row => row.kind === '运干')
      && wealthNourishes.some(other => other.wealth === path.wealth && other.output === path.output && other.killer === path.killer));

  const yue = matches('yue'), shen = matches('shen');
  const exposedOfficers = officers.filter(row => row.kind === '透干');
  const targetsOf = (god: string) => god === '正官' ? monthKillers : officers;
  const combinedClearing = !yue && !shen && monthKillers.length ? clearingPairs.flatMap(pair => targetsOf(pair.target.tenGod!)
    .map(retained => ({ target: pair.target, helper: pair.helper, retained, via: 'combine' as const }))) : [];
  const hurtClearing = yue || shen ? [] : monthKillers.flatMap(retained => exposedOfficers.flatMap(target =>
    hurt.filter(helper => helper.kind === '透干' && baziStemControls(helper.stem, target.stem))
      .map(helper => ({ target, helper, retained, via: 'hurt-controls-officer' as const }))));
  const clearingPaths = [...combinedClearing, ...hurtClearing].map(({ target, helper, retained, via }) => {
    const killer = retained.god === '七杀' ? retained : target;
    const originalControls = foodAndHurt.filter(row => baziStemControls(row.stem, killer.stem)).map(output => ({
      output, killer,
      attack: luck.filter(row => baziStemControls(row.stem, output.stem)),
      feeds: luck.filter(row => baziStemFeeds(row.stem, output.stem)),
      combines: output.kind === '透干' ? order.movingFivePairs.filter(combination => atSameStem(combination.target, output)) : [],
    }));
    return { target, helper, retained, via, originalControls,
      checksHelper: luck.filter(row => baziStemControls(row.stem, helper.stem)),
      combinesHelper: order.movingFivePairs.filter(combination => atSameStem(combination.target, helper)),
      checksRetained: luckOutput.filter(row => baziStemControls(row.stem, retained.stem)),
      checksKiller: retained.god === '正官' ? luckOutput.filter(row => baziStemControls(row.stem, killer.stem)) : [],
    };
  });
  const monthClashes = relations.pairs.filter(pair => pair.kind === '六冲' && pair.members.includes('month') && !pair.members.includes('decadal'));
  const clashClearing = yue || shen || base.monthHiddenGods[0] !== '七杀' ? [] : monthClashes.flatMap(clash => {
    const helper = native.find(row => row.id !== 'month' && clash.members.includes(row.id))!;
    const touchesHelper = relations.pairs.filter(pair => ['六合', '六冲'].includes(pair.kind)
      && pair.members.includes('decadal') && pair.members.includes(helper.id));
    return monthKillers.flatMap(killer => exposedOfficers.map(officer => ({
      clash, helper: { position: helper.id, pillar: helper.pillar }, killer, officer, touchesHelper,
      officerMonthRoots: order.roots.find(row => row.stem === officer.stem)?.roots.filter(root => root.position === 'month') ?? [],
      checksKiller: luckOutput.filter(row => baziStemControls(row.stem, killer.stem)),
      checksOfficer: luckOutput.filter(row => baziStemControls(row.stem, officer.stem)),
    })));
  });
  const yueRegulator = yue ? hurt.find(row => row.position === 'year' && row.kind === '透干' && row.stem === '癸') : undefined;
  const namedKiller = (yue || shen) ? monthKillers[0] : undefined;
  const namedOfficer = (yue || shen) ? officers.find(row => row.position === (yue ? 'month' : 'year') && row.kind === '透干') : undefined;
  const namedSharedRoot = namedOfficer && namedKiller && namedOfficer.element === namedKiller.element
    ? order.roots.find(row => row.stem === namedOfficer.stem && row.stemPositions.includes(namedOfficer.position))
      ?.roots.find(root => root.position === namedKiller.position && root.pillar === namedKiller.pillar && !root.exactStem)
    : undefined;
  const yueAttack = yueRegulator ? luck.filter(row => baziStemControls(row.stem, yueRegulator.stem)) : [];
  const namedClearing = namedKiller && namedOfficer && namedSharedRoot ? {
    yue, killer: namedKiller, officer: namedOfficer, sharedRoot: namedSharedRoot, yueRegulator, yueAttack,
    yueConcealedAttack: yueRegulator ? base.remedyMovingComponents.slice(2).filter(row => baziStemControls(row.stem, yueRegulator.stem)) : [],
    yueChecksOfficer: yueRegulator && baziStemControls(yueRegulator.stem, namedOfficer.stem),
    yueWater: yue ? luck.filter(row => baziStemControls(row.stem, namedKiller.stem) && row.element === '水') : [],
    yueFeedsRegulator: yueRegulator ? luck.filter(row => baziStemFeeds(row.stem, yueRegulator.stem)) : [],
    shenClash: shen ? relations.pairs.find(pair => pair.kind === '六冲' && pair.members.includes('year') && pair.members.includes('month')) : undefined,
    shenSupport: shen ? luckSupport : [],
  } : undefined;
  const yueStage = namedClearing?.yueChecksOfficer === true
    && (['乙卯', '甲寅', '癸丑', '壬子', '辛亥'].includes(luckPillar) || yueAttack.length > 0);
  const hasYueSourceRegulatorSupport = namedClearing?.yueChecksOfficer === true && namedClearing.yueWater.length > 0
    && !yueAttack.length && ['壬子', '辛亥'].includes(luckPillar);
  const yueRegulatesSourceKiller = namedClearing?.yueChecksOfficer === true
    && namedClearing.yueRegulator && baziStemControls(namedClearing.yueRegulator.stem, namedClearing.killer.stem);
  const hasYueSourceRegulatorUnharmedInWood = seen(Boolean(yueRegulatesSourceKiller
    && ['乙卯', '甲寅'].includes(luckPillar) && luck.every(row => row.element === '木') && !yueAttack.length));
  const hasYueSourceRegulatorPressureFromLuckStem = seen(Boolean(yueRegulatesSourceKiller
    && yueAttack.some(row => row.kind === '运干' && ['戊', '己'].includes(row.stem))));
  const yueGuiChouRoot = namedClearing && yueRegulatesSourceKiller && luckPillar === '癸丑'
    && luck[0].stem === namedClearing.yueRegulator?.stem && baziStemControls(luck[0].stem, namedClearing.killer.stem)
    ? movingHidden.find(row => row.stem === '癸') : undefined;
  const yueGuiChouEarth = yueGuiChouRoot && yueAttack.find(row => row.kind === '运支本气' && row.stem === '己');
  const yueGuiChouRegulatorRoot = yueGuiChouRoot && yueGuiChouEarth && namedClearing?.yueRegulator ? {
    regulator: namedClearing.yueRegulator, killer: namedClearing.killer, movingWater: luck[0], waterRoot: yueGuiChouRoot,
    movingEarth: yueGuiChouEarth,
  } : undefined;
  const shenStage = namedClearing?.shenClash !== undefined && ['丙申', '丁酉', '戊戌', '己亥'].includes(luckPillar) && luckSupport.length > 0;
  const shenSourceBodySupport = shenStage && dayRoots.length === 0 && namedClearing ? (() => {
    const branchPeer = ['丙申', '丁酉'].includes(luckPillar) ? luckSupport.find(row =>
      row.kind === '运支本气' && (row.god === '比肩' || row.god === '劫财')) : undefined;
    const stemSeal = ['戊戌', '己亥'].includes(luckPillar) ? luckSeal.find(row =>
      row.kind === '运干' && row.stem === luckPillar[0] && baziStemFeeds(row.stem, dayWitness.stem)) : undefined;
    const component = branchPeer ?? stemSeal;
    if (component) return { component, day: dayWitness, officer: namedClearing.officer, killer: namedClearing.killer,
      sharedRoot: namedClearing.sharedRoot, basis: branchPeer ? 'branch-peer' : 'stem-seal' };
  })() : undefined;
  const hasShenSourceFoodKillerSupport = seen(shenSourceBodySupport?.basis === 'branch-peer' && foodKiller.some(({ output, killer }) =>
    output.position === 'year' && output.kind === '支藏' && output.stem === '癸'
    && atSameStem(killer, shenSourceBodySupport.killer)));
  const killerClearingMatched = yueStage || shenStage || clearingPaths.some(path => luckSupport.length > 0
    || path.checksHelper.length || path.combinesHelper.length || path.checksRetained.length || path.checksKiller.length
    || path.originalControls.some(row => row.attack.length || row.feeds.length || row.combines.length))
    || clashClearing.some(path => luckSupport.length > 0 || path.touchesHelper.length || path.checksKiller.length || path.checksOfficer.length);

  const zhao = matches('zhao');
  const bladePosition = base.natalPillars.find(row => row.position === (zhao ? 'hour' : 'month') && row.pillar[1] === coordinates.bladeBranch);
  const bladePeers = bladePosition ? role(['劫财']).filter(row => row.position === bladePosition.position && row.kind === '支藏') : [];
  const movingBladePeers = luckPillar[1] === coordinates.bladeBranch
    ? movingHidden.filter(row => bladePeers.some(peer => peer.stem === row.stem)) : [];
  const authorityChecksBlade = luckAuthority.flatMap(moving => bladePeers.filter(peer => baziStemControls(moving.stem, peer.stem))
    .map(peer => ({ moving, peer })));
  const unrestrainedKillers = timeKnown && !food.length && bladePosition ? (zhao ? monthKillers : killers)
    .filter(killer => baziStemControls(killer.stem, dayWitness.stem) && !hurt.some(output => baziStemControls(output.stem, killer.stem))) : [];
  const bladeKillerPaths = unrestrainedKillers.map(killer => ({
    killer,
    check: luckOutput.filter(row => baziStemControls(row.stem, killer.stem)),
    feed: luckWealth.filter(row => baziStemFeeds(row.stem, killer.stem)),
    nativeSeals: seals.filter(seal => baziStemFeeds(killer.stem, seal.stem) && baziStemFeeds(seal.stem, dayWitness.stem)),
    branchMetalChecks: zhao ? movingHidden.filter(row => row.element === '金' && baziStemControls(row.stem, killer.stem)) : [],
  }));
  const arrivingKiller = luckOf('七杀').filter(row => baziStemControls(row.stem, dayWitness.stem));
  const monthKiller = !zhao && bladeKillerPaths.find(path =>
    path.killer.position === 'month' && path.killer.kind === '透干');
  const monthBlade = monthKiller && bladePeers.find(peer => baziStemControls(monthKiller.killer.stem, peer.stem));
  const monthBladeKillerSealCounterchecks = monthKiller && monthBlade ? monthKiller.check.flatMap(output => {
    const seals = monthKiller.nativeSeals.filter(seal => seal.kind === '透干' && baziStemControls(seal.stem, output.stem));
    return seals.length ? [{ blade: monthBlade, killer: monthKiller.killer, output, seals }] : [];
  }) : [];
  const zhaoMetalControlsKiller = zhao && bladeKillerPaths.some(path => path.check.some(row =>
    row.kind === '运干' && ['庚', '辛'].includes(row.stem)));
  const zhaoOfficerPressure = zhao && luckPillar === '乙卯' && authorityChecksBlade.some(({ moving, peer }) =>
    moving.stem === '乙' && incomingOfficer.includes(moving) && peer.position === 'hour' && peer.stem === '己');
  const zhaoMovingMetal = zhaoMetalControlsKiller && ['庚申', '辛酉'].includes(luckPillar) && bladeKillerPaths.some(path =>
    path.killer.stem === '甲' && path.check.some(row => row.kind === '运干' && row.stem === luckPillar[0])
    && path.branchMetalChecks.some(row => row.stem === luckPillar[0]));
  const zhaoSupportingLuck = zhao && ['丙辰', '丁巳', '戊午', '己未'].includes(luckPillar) && luckSupport.length > 0;
  const zhaoSourceBladeAuthorityRoute = zhaoOfficerPressure ? 'yi-mao-officer-pressure'
    : zhaoMovingMetal ? 'moving-metal-checks-killer' : zhaoSupportingLuck && bladeKillerPaths.length ? 'supporting-seal-peer' : timeKnown ? 'none' : undefined;
  const killerBladeMatched = !zhao && bladeKillerPaths.length > 0 && (luckSupport.length > 0 || movingBladePeers.length > 0
    || arrivingKiller.length > 0 || incomingOfficer.length > 0 || bladeKillerPaths.some(path => path.check.length || path.feed.length));

  const monthHurt = hurt.filter(row => row.position === 'month' && row.kind === '支藏');
  const hurtWealthLinks = monthHurt.flatMap(output => wealth.filter(money => baziStemFeeds(output.stem, money.stem))
    .map(money => ({ output, wealth: money })));
  const dualCase = matches('wealth-heavy') ? 'wealth-heavy' : matches('seal-heavy') ? 'seal-heavy' : undefined;
  const dualLuck = dualCase ? [...luck, ...base.remedyMovingComponents.slice(2)] : luck;
  const hurtDualPaths = hurtWealthLinks.flatMap(link => seals.filter(seal =>
    (link.wealth.kind === '透干' || seal.kind === '透干') && baziStemFeeds(seal.stem, dayWitness.stem)).map(seal => {
    const { wealth: money, output } = link;
    const { columnDistance, between } = contacts([money], [seal])[0];
    const nativeCombination = order.natalFivePairs.find(pair => [pair.first, pair.second].some(row => atSameStem(row, money))
      && [pair.first, pair.second].some(row => atSameStem(row, seal)));
    return { ...link, seal, columnDistance, between,
      nativeCombination: money.kind === '透干' && seal.kind === '透干' ? nativeCombination : undefined,
      sealLuck: dualLuck.filter(row => ['正印', '偏印'].includes(row.god) && baziStemFeeds(row.stem, dayWitness.stem)),
      wealthLuck: dualLuck.filter(row => ['正财', '偏财'].includes(row.god) && baziStemFeeds(output.stem, row.stem) && baziStemControls(row.stem, seal.stem)),
      authorityLuck: dualLuck.filter(row => ['正官', '七杀'].includes(row.god) && baziStemFeeds(money.stem, row.stem) && baziStemFeeds(row.stem, seal.stem)),
    };
  }));
  const hurtDualMatched = dualCase !== 'seal-heavy' && hurtDualPaths.some(path => path.sealLuck.length || path.authorityLuck.length);
  const namedDualPair = dualCase ? hurtDualPaths.find(path => path.wealth.kind === '透干' && path.seal.kind === '透干') : undefined;
  const hasHurtDualSourceRelief = Boolean(namedDualPair && namedDualPair.columnDistance === 3
    && (dualCase === 'wealth-heavy' && ['丁未', '丙午'].includes(luckPillar) && namedDualPair.sealLuck.length
      || dualCase === 'seal-heavy' && ['辛亥', '壬子', '癸丑'].includes(luckPillar) && namedDualPair.wealthLuck.length));
  const sourceAuthorityReading = dualCase === 'wealth-heavy' && ['乙巳', '甲辰'].includes(luckPillar) ? 'supports-seal'
    : dualCase === 'seal-heavy' && luckPillar === '甲寅' ? 'diverts-wealth' : undefined;
  const sourceAuthority = namedDualPair && sourceAuthorityReading
    && namedDualPair.wealth.stem === '壬' && namedDualPair.seal.stem === '丁'
    && namedDualPair.authorityLuck.some(row => row.kind === '运干') ? {
      reading: sourceAuthorityReading,
      wealth: namedDualPair.wealth, authority: namedDualPair.authorityLuck, seal: namedDualPair.seal,
      between: namedDualPair.between,
    } : undefined;
  const dualRoots = namedDualPair ? {
    wealth: namedDualPair.wealth,
    seal: namedDualPair.seal,
    wealthRoots: order.roots.find(row => row.stem === namedDualPair.wealth.stem)?.roots ?? [],
    sealRoots: order.roots.find(row => row.stem === namedDualPair.seal.stem)?.roots ?? [],
  } : undefined;

  const { convertedWealthPrintedExample } = base;
  const convertedWealthMembers = convertedWealthPrintedExample === true ? [...'申子辰'].map(branch => ({
    branch, positions: native.filter(row => row.pillar[1] === branch).map(row => row.id),
  })) : undefined;
  const hurtOfficerCase = matches('hurt-officer');
  const hurtOfficerLuckComponents = [...luck, ...base.remedyMovingComponents.slice(2)];
  const hurtOfficerPaths = base.hurtExposed === false ? officers.filter(row => row.kind === '透干').flatMap(officer => monthHurt.flatMap(output => {
    const moneyLinks = hurtWealthLinks.filter(link => link.output === output && baziStemFeeds(link.wealth.stem, officer.stem));
    const protectingSeals = seals.filter(seal => baziStemFeeds(officer.stem, seal.stem) && baziStemControls(seal.stem, output.stem)
      && baziStemFeeds(seal.stem, dayWitness.stem));
    if (!moneyLinks.length && !protectingSeals.length) return [];
    const officerRoots = order.roots.find(row => row.stem === officer.stem)?.roots ?? [];
    const natalRootClashes = relations.pairs.filter(pair => pair.kind === '六冲' && !pair.members.includes('decadal')
      && pair.members.includes(output.position) && officerRoots.some(root => root.exactStem && pair.members.includes(root.position)));
    const visibleSupports = order.wealthSealPairs.filter(pair => moneyLinks.some(link => atSameStem(link.wealth, pair.wealth))
      && protectingSeals.some(seal => atSameStem(seal, pair.seal)));
    return [{ output, officer, moneyLinks, protectingSeals, officerRoots, natalRootClashes, visibleSupports,
      wealthLuck: hurtOfficerLuckComponents.filter(row => ['正财', '偏财'].includes(row.god)
        && baziStemFeeds(output.stem, row.stem) && baziStemFeeds(row.stem, officer.stem)),
      sealLuck: hurtOfficerLuckComponents.filter(row => ['正印', '偏印'].includes(row.god) && baziStemFeeds(officer.stem, row.stem)
        && baziStemControls(row.stem, output.stem) && baziStemFeeds(row.stem, dayWitness.stem)),
      outputLuck: hurtOfficerLuckComponents.filter(row => ['食神', '伤官'].includes(row.god)
        && baziStemControls(row.stem, officer.stem)).map(moving => ({
        moving, moneyLinks: moneyLinks.filter(link => baziStemFeeds(moving.stem, link.wealth.stem)),
        protectingSeals: protectingSeals.filter(seal => baziStemControls(seal.stem, moving.stem)),
      })),
      winterWaterWithFire: dayWitness.element === '金' && '亥子丑'.includes(natal.month[1]) && output.element === '水' && officer.element === '火',
      namedWuOfficer: hurtOfficerCase && luckPillar === '庚午' && luck[1].kind === '运支本气' && luck[1].stem === officer.stem ? luck[1] : undefined,
    }];
  })) : [];
  const zheng = matches('zheng');
  const zhengOfficer = zheng ? hurtOfficerPaths.find(path => path.officer.position === 'year' && path.officer.stem === '丙'
    && path.output.position === 'month' && path.output.stem === '壬' && path.winterWaterWithFire) : undefined;
  const zhengNativeWealth = zhengOfficer?.moneyLinks.filter(({ wealth }) => wealth.kind === '支藏'
    && ['亥', '未'].includes(wealth.branch)).map(({ wealth }) => wealth) ?? [];
  const zhengNativeSeals = zhengOfficer?.protectingSeals.filter(row => row.stem === '己'
    && (row.kind === '透干' && (row.position === 'month' || row.position === 'hour')
      || row.kind === '支藏' && row.position === 'day' && row.branch === '未')) ?? [];
  const zhengLuck = zhengOfficer && zhengNativeWealth.length ? {
    officer: zhengOfficer.officer, nativeWealth: zhengNativeWealth, nativeSeals: zhengNativeSeals,
    wealth: zhengOfficer.wealthLuck.filter(row => row.kind === '运干' || row.kind === '运支本气'),
    southernFireRoots: '巳午未'.includes(moving.branch) ? hurtOfficerLuckComponents.slice(1).filter(row => row.element === '火') : [],
  } : undefined;
  const zhengReviewed = zhengLuck && !native.some(row => row.pillar[1] === '卯') && zhengNativeSeals.length === 3
    && ['month', 'hour'].every(position => zhengNativeWealth.some(row => row.position === position && row.stem === '甲' && row.branch === '亥'))
    && zhengNativeWealth.some(row => row.position === 'day' && row.stem === '乙' && row.branch === '未')
    && zhengNativeWealth.every(wealth => zhengNativeSeals.every(seal => baziStemControls(wealth.stem, seal.stem)));
  const zhengHurtOfficerReviewedRoutes = zhengLuck && zhengReviewed ? [
    ['壬寅', '癸卯'].includes(luckPillar) && zhengLuck.wealth.some(row => row.kind === '运支本气') && 'branch-wealth',
    ['甲辰', '乙巳'].includes(luckPillar) && zhengLuck.wealth.some(row => row.kind === '运干') && 'stem-wealth',
    ['乙巳', '丙午', '丁未'].includes(luckPillar) && zhengLuck.southernFireRoots.length && 'southern-fire',
  ].filter((route): route is string => typeof route === 'string') : timeKnown ? [] : undefined;
  const hurtOfficerMatched = zheng ? Boolean(zhengLuck && (zhengLuck.wealth.length || zhengLuck.southernFireRoots.length))
    : hurtOfficerPaths.some(path => path.wealthLuck.length || path.sealLuck.length || path.outputLuck.length || path.namedWuOfficer);
  const sourceOfficerPath = hurtOfficerCase ? hurtOfficerPaths.find(path =>
    path.officer.position === 'hour' && path.officer.stem === '丁' && path.output.position === 'month' && path.output.stem === '癸'
    && path.winterWaterWithFire) : undefined;
  const sourceOfficerWealth = sourceOfficerPath?.moneyLinks.find(({ wealth }) => wealth.position === 'month'
    && wealth.stem === '甲' && wealth.kind === '透干')?.wealth;
  const sourceOfficerSeal = sourceOfficerPath?.protectingSeals.find(row => row.position === 'year' && row.stem === '戊' && row.kind === '透干');
  const officerRoot = sourceOfficerPath?.officerRoots.find(root => root.position === 'day' && root.pillar === '庚午' && root.exactStem);
  const officerTakingRoute = ['丙寅', '丁卯'].includes(luckPillar) ? 'wealth-feeds-officer'
    : ['戊辰', '己巳'].includes(luckPillar) ? 'seal-protects-officer'
    : luckPillar === '庚午' ? 'officer-root-in-luck' : undefined;
  const sourceOfficerComponents = sourceOfficerPath && (
    officerTakingRoute === 'wealth-feeds-officer' ? sourceOfficerPath.wealthLuck
    : officerTakingRoute === 'seal-protects-officer' ? sourceOfficerPath.sealLuck
    : officerTakingRoute === 'officer-root-in-luck' && sourceOfficerPath.namedWuOfficer ? [sourceOfficerPath.namedWuOfficer]
    : []
  );
  const sourceTakingOfficer = sourceOfficerPath && sourceOfficerWealth && sourceOfficerSeal
    && officerRoot && officerTakingRoute && sourceOfficerComponents?.length ? {
    route: officerTakingRoute,
    officer: sourceOfficerPath.officer, output: sourceOfficerPath.output, officerRoot,
    wealth: sourceOfficerWealth, seal: sourceOfficerSeal,
    moving: sourceOfficerComponents,
  } : undefined;
  return { profile: zpqzKillerOrderPolicy.profile, timeKnown, dayMaster: base.dayMaster, natalPillars: base.natalPillars,
    natalPillarSequence: base.natalPillarSequence,
    monthHiddenGods: base.monthHiddenGods, monthKillerCandidate: base.monthHiddenGods.includes('七杀'), monthHurtCandidate: base.monthHiddenGods.includes('伤官'),
    gods: base.gods, foodPresent: seen(food.length > 0), foodAbsent: not(seen(food.length > 0)), hurtAbsent: not(seen(hurt.length > 0)),
    wealthPresent: base.wealthPresent, wealthExposed: base.wealthExposed, sealsPresent: base.sealsPresent, sealsExposed: base.sealsExposed,
    officerPresent: seen(officers.length > 0), killerPresent: seen(killers.length > 0), hasWealthOrSeal: present(['正财', '偏财', '正印', '偏印']),
    officerExposed: base.officerExposed, hurtExposed: base.hurtExposed, officerAndKillerExposed: base.officerAndKillerExposed,
    foodKillerContacts: contacts([...food, ...hurt], killers), outputOfficerContacts: contacts([...food, ...hurt], officers),
    killerSealContacts: contacts(killers, seals), wealthSealContacts: contacts(wealth, seals),
    wealthOfficerKillerContacts: contacts(wealth, [...officers, ...killers]), sealOutputContacts: contacts(seals, [...food, ...hurt]),
    sealDayMasterContacts: contacts(seals, [dayWitness]), roots: order.roots, wealthSealPairs: order.wealthSealPairs,
    natalFivePairs: order.natalFivePairs, clearingPairs, movingFivePairs: order.movingFivePairs, movingAttacksClearingHelpers,
    natalRelationPairs: relations.pairs.filter(pair => !pair.members.includes('decadal')), movingRelationPairs: relations.pairs.filter(pair => pair.members.includes('decadal')),
    generationChainPairs: visible.slice(0, -1).map((from, i) => ({ from, to: visible[i + 1],
      generates: (elements.indexOf(from.stemElement) + 1) % 5 === elements.indexOf(visible[i + 1].stemElement) })),
    luPlusOneBranch: coordinates.bladeBranch, luPlusOnePositions: base.natalPillars.filter(row => row.pillar[1] === coordinates.bladeBranch),
    monthYangBlade: coordinates.atYangBlade,
    killerFoodMatched, hasRootedFoodPeerSupport, nobleSourceFoodKillerWarning, hasNobleSourceSouthernFoodRoot: seen(Boolean(nobleSouthernFoodRoot)),
    killerSealMatched, printedTuoSealMatched, printedHeSealMatched,
    killerWealthMatched, hasZhouSourceWealthRemedy, liuSourceKillerNotTaken: seen(matches('liu-previous')),
    killerClearingMatched, hasYueSourceRegulatorSupport, hasYueSourceRegulatorUnharmedInWood, hasYueSourceRegulatorPressureFromLuckStem,
    hasYueSourceGuiChouRegulatorRoot: seen(Boolean(yueGuiChouRegulatorRoot)),
    hasShenSourceBodySupport: seen(Boolean(shenSourceBodySupport)), hasShenSourceFoodKillerSupport, killerBladeMatched, zhaoSourceBladeAuthorityRoute,
    hasMonthBladeKillerSealCountercheck: monthBladeKillerSealCounterchecks.length > 0,
    hasKillerSealHurtCommentary: killerSealHurtCommentary.length > 0,
    killerFoodLuck: foodKiller.length ? { paths: foodKiller, day: dayWitness, dayRoots, luckSupport, foodBodySupport, incomingOfficer,
      nobleFoodLuck, nobleSouthernFoodRoot } : undefined,
    killerSealLuck: killerSeal.length ? { paths: killerSeal, day: dayWitness, heSealContext, tuoSealContext, killerSealHurtCommentary } : undefined,
    killerWealthLuck: wealthRemedies.length || wealthNourishes.length ? { wealthRemedies, wealthNourishes, zhouDayRoots: zhou ? dayRoots : undefined } : undefined,
    killerClearingLuck: clearingPaths.length || namedClearing || clashClearing.length
      ? { paths: clearingPaths, namedClearing, clashClearing, luckSupport, shenSourceBodySupport, yueGuiChouRegulatorRoot } : undefined,
    killerBladeLuck: bladeKillerPaths.length ? { paths: bladeKillerPaths, bladePosition, monthYangBlade: coordinates.atYangBlade,
      bladePeers, movingBladePeers, authorityChecksBlade, zhao, zhaoMetalControlsKiller, luckSupport, arrivingKiller,
      incomingOfficer, nativeOfficers: officers, monthBladeKillerSealCounterchecks } : undefined,
    hurtDualMatched, hasHurtDualSourceAuthority: Boolean(sourceAuthority), hasHurtDualSourceRelief,
    hurtDualLuck: hurtDualPaths.length ? { paths: hurtDualPaths, dualCase, dualRoots, sourceAuthority } : undefined,
    hurtOfficerMatched, hasHurtOfficerSourceTakingOfficer: Boolean(sourceTakingOfficer), zhengHurtOfficerReviewedRoutes,
    hurtOfficerLuck: hurtOfficerPaths.length || convertedWealthMembers
      ? { paths: hurtOfficerPaths, convertedWealthMembers, sourceTakingOfficer, zhengLuck } : undefined,
    printedCases, convertedWealthPrintedExample,
    sourceVariants: zpqzKillerOrderVariants, luckPillar, luckTenGod: base.luckTenGod, luckBranchMainQiGod: base.luckBranchMainQiGod,
    strengthVerified: false, clearingVerified: false, remedyVerified: false, climateVerified: false };
}
