import { baziInteractions, baziStemControls, baziStemFeeds, describeBaZiPillar } from './bazi-calculation';
import { baziZpqzSealFood, zpqzColumnStemCheck } from './bazi-zpqz-seal-food';
import { baziZpqzStemOrder } from './bazi-zpqz-stems';

const layers = ['year', 'month', 'day', 'hour'] as const, elements = '木火土金水';
type Natal = Record<typeof layers[number], string>;
export const zpqzWealthPolicy = {
  profile: 'zpqz-wealth-visible-food-seal-and-killer-targets-v1',
  scope: 'one-natal-candidate-and-uniquely-verified-whole-luck-stage',
  visibility: 'food-and-seal-both-exposed-not-merely-hidden; killer-and-seal-both-exposed',
  effects: 'named-generation-control-and-five-pairs-not-successful-rescue-or-transformation',
  variants: 'Pingjiang-prose-RenShen-vs-diagram-RenChen; Zhao-earlier-three-pillars-not-repaired',
} as const;
export const zpqzWealthCases = [
  { id: 'ge', name: '葛参政', pillars: ['壬申', '壬子', '戊午', '乙卯'] },
  { id: 'yang', name: '杨侍郎', pillars: ['壬寅', '壬寅', '庚辰', '辛巳'] },
  { id: 'wu', name: '吴榜眼', pillars: ['庚戌', '戊子', '戊子', '丙辰'] },
  { id: 'pingjiang', name: '平江伯取运图', pillars: ['壬辰', '乙巳', '癸巳', '辛酉'] },
  { id: 'wang', name: '汪学士', pillars: ['甲子', '辛未', '辛酉', '壬辰'] },
  { id: 'mao', name: '毛状元财杀例', pillars: ['乙酉', '庚辰', '甲午', '戊辰'] },
  { id: 'li', name: '李御史', pillars: ['庚辰', '戊子', '戊寅', '甲寅'] },
  { id: 'zhao', name: '赵侍郎取运图', pillars: ['乙丑', '丁亥', '己亥', '乙亥'] },
] as const;
export const zpqzWealthVariants = [
  { id: 'pingjiang-prose', pillars: ['壬申', '乙巳', '癸巳', '辛酉'], validPillars: true,
    issue: '平江伯两处图均录壬辰，前章评注另说年有壬申；分别留存，不把申辰互换为同一已核原图' },
  { id: 'zhao-earlier-prose', pillars: ['乙丑', '丁亥', '乙亥'], validPillars: false,
    issue: '前章赵例仅录三柱，取运图另列乙丑丁亥己亥乙亥；不向三柱录文静默补己亥为已核四柱' },
] as const;

export function baziZpqzWealth(natal: Natal, timeKnown: boolean, luckPillar: string) {
  const base = baziZpqzSealFood(natal, timeKnown, luckPillar), order = baziZpqzStemOrder(natal, timeKnown, luckPillar);
  const all = base.gods.flatMap(row => [...row.exposedRows, ...row.hiddenRows]);
  const by = (names: string[]) => all.filter(row => names.includes(row.god));
  const seen = (yes: boolean) => yes ? true : timeKnown ? false : undefined;
  const present = (names: string[]) => seen(by(names).length > 0);
  const exposed = (names: string[]) => seen(by(names).some(row => row.kind === '透干'));
  const contact = (from: typeof all, to: typeof all) => from.flatMap(a => to.map(b => ({ from: a, to: b,
    columnDistance: Math.abs(a.index - b.index), bothExposed: a.kind === '透干' && b.kind === '透干',
    between: base.natalPillars.filter(row => Math.min(a.index, b.index) < layers.indexOf(row.position as typeof layers[number])
      && layers.indexOf(row.position as typeof layers[number]) < Math.max(a.index, b.index)),
  })));
  const food = by(['食神']), hurt = by(['伤官']), output = [...food, ...hurt], wealth = by(['正财', '偏财']);
  const seals = by(['正印', '偏印']), officers = by(['正官']), killers = by(['七杀']);
  const day = describeBaZiPillar(natal.day, base.dayMaster);
  const dayRow = { position: 'day', index: 2, pillar: natal.day, branch: day.branch, stem: day.stem, god: '日元', element: day.stemElement, kind: '日干' };
  const luck = describeBaZiPillar(luckPillar, base.dayMaster);
  const movingRows = [{ position: 'decadal', pillar: luckPillar, stem: luck.stem, god: luck.tenGod!, element: luck.stemElement, kind: '运干' },
    ...luck.hiddenStems.map(h => ({ position: 'decadal', pillar: luckPillar, stem: h.stem, god: h.tenGod!, element: h.element, kind: '运支藏干' }))];
  const movingContacts = movingRows.flatMap(from => [...all, dayRow].flatMap(to => {
    const step = (elements.indexOf(to.element) - elements.indexOf(from.element) + 5) % 5;
    return step === 1 || step === 2 ? [{ from, to, relation: step === 1 ? '生' : '克' }] : [];
  }));
  const natalMovingContacts = all.flatMap(from => movingRows.flatMap(to => {
    const step = (elements.indexOf(to.element) - elements.indexOf(from.element) + 5) % 5;
    return step === 1 || step === 2 ? [{ from, to, relation: step === 1 ? '生' : '克' }] : [];
  }));
  const killPairs = order.natalFivePairs.flatMap(pair => {
    const target = [pair.first, pair.second].find(row => row.tenGod === '七杀');
    return target && !pair.involvesDayMaster ? [{ ...pair, target, helper: target === pair.first ? pair.second : pair.first }] : [];
  });
  const native = base.natalPillars.map(row => ({ id: row.position, pillar: row.pillar }));
  const relations = baziInteractions([...native, { id: 'decadal', pillar: luckPillar }]);
  const branchGroups = ['寅午戌', '巳酉丑', '申子辰'].map(values => {
    const members = [...values].map(branch => ({ branch, natalPositions: native.filter(row => row.pillar[1] === branch).map(row => row.id),
      luckPresent: luck.branch === branch }));
    const complete = members.every(row => row.natalPositions.length || row.luckPresent);
    return { values, members, complete: seen(complete), nativeComplete: seen(members.every(row => row.natalPositions.length)),
      missingKnownBranches: members.filter(row => !row.natalPositions.length && !row.luckPresent).map(row => row.branch) };
  });
  const printedCases = zpqzWealthCases.map(c => ({ ...c, stemCheck: zpqzColumnStemCheck(c.pillars),
    matches: layers.every((key, i) => key === 'hour' && !timeKnown || natal[key] === c.pillars[i]) ? timeKnown ? true : undefined : false }));
  const monthWealth = wealth.filter(row => row.position === 'month' && row.kind === '支藏');
  const monthOfficerLinks = contact(monthWealth, officers);
  const monthFoodLinks = contact(food, monthWealth);
  const monthHurtLinks = contact(hurt, monthWealth);
  const leadingLuck = monthWealth.length ? movingRows.slice(0, 2) : [];
  const movingWealth = leadingLuck.filter(row => ['正财', '偏财'].includes(row.god));
  const movingOfficer = leadingLuck.filter(row => row.god === '正官');
  const movingFood = leadingLuck.filter(row => row.god === '食神');
  const supportDay = (moving: typeof movingRows[number]) => {
    if (moving.element === dayRow.element) return [{ moving, day: dayRow, relation: '同五行' }];
    return movingContacts.some(link => link.from === moving && link.to === dayRow && link.relation === '生')
      ? [{ moving, day: dayRow, relation: '生' }] : [];
  };
  const supportsDay = leadingLuck.flatMap(supportDay);
  const wealthFeedsOfficer = monthOfficerLinks.length ? movingContacts.filter(link =>
    movingWealth.includes(link.from) && officers.includes(link.to) && link.relation === '生') : [];
  const monthWealthFeedsOfficerLuck = monthOfficerLinks.length ? natalMovingContacts.filter(link =>
    monthWealth.includes(link.from) && movingOfficer.includes(link.to) && link.relation === '生') : [];
  const sealProtectsOfficer = monthOfficerLinks.length ? leadingLuck.filter(row => ['食神', '伤官'].includes(row.god)).flatMap(output => {
    const wealthOfficerLinks = monthOfficerLinks.filter(link => baziStemControls(output.stem, link.to.stem));
    const protectors = natalMovingContacts.filter(link => link.to === output && link.relation === '克'
      && link.from.kind === '透干' && seals.includes(link.from)).map(link => link.from);
    return wealthOfficerLinks.length && protectors.length
      ? [{ output, targets: [...new Set(wealthOfficerLinks.map(link => link.to))], protectors, wealthOfficerLinks }] : [];
  }) : [];
  const natalOutputOfficerPaths = monthOfficerLinks.length ? output.flatMap(natalOutput => {
    const officersAtRisk = monthOfficerLinks.filter(link => baziStemControls(natalOutput.stem, link.to.stem));
    if (!officersAtRisk.length) return [];
    const movingSeals = movingContacts.filter(link => leadingLuck.includes(link.from) && ['正印', '偏印'].includes(link.from.god)
      && link.to === natalOutput && link.relation === '克').map(link => link.from);
    const controlledKillers = natalMovingContacts.filter(link => link.from === natalOutput && leadingLuck.includes(link.to)
      && link.to.god === '七杀' && link.relation === '克').map(link => link.to);
    return [{ output: natalOutput, officersAtRisk, movingSeals, controlledKillers }];
  }) : [];
  const foodLuckFeedsMonthWealth = monthFoodLinks.length ? movingContacts.filter(link =>
    movingFood.includes(link.from) && monthWealth.includes(link.to) && link.relation === '生') : [];
  const foodFeedsWealthLuck = monthFoodLinks.length ? natalMovingContacts.filter(link =>
    food.includes(link.from) && movingWealth.includes(link.to) && link.relation === '生') : [];
  const hurtLuckFeedsMonthFoodWealth = monthFoodLinks.length ? movingContacts.filter(link => leadingLuck.includes(link.from)
    && link.from.god === '伤官' && monthFoodLinks.some(path => path.to === link.to) && link.relation === '生') : [];
  const foodWealthControlsKiller = monthFoodLinks.length ? natalMovingContacts.filter(link => output.includes(link.from)
    && leadingLuck.includes(link.to) && link.to.god === '七杀' && link.relation === '克') : [];
  const foodWealthInterference = monthFoodLinks.map(path => ({
    ...path,
    movingOfficerCombinations: base.movingFivePairs.filter(pair => movingRows[0].god === '正官' && path.from.kind === '透干'
      && pair.target.position === path.from.position && pair.target.stem === path.from.stem),
    movingSeals: movingContacts.filter(link => leadingLuck.includes(link.from) && ['正印', '偏印'].includes(link.from.god)
      && link.to === path.from && link.relation === '克').map(link => link.from),
  })).filter(path => path.movingOfficerCombinations.length || path.movingSeals.length);
  const matches = (id: string) => printedCases.some(row => row.id === id && row.matches === true);
  const ge = matches('ge');
  const geSourceOfficer = ge ? monthOfficerLinks.find(path => path.from.stem === '癸' && path.to.position === 'hour'
    && path.to.kind === '透干' && path.to.stem === '乙') : undefined;
  const geDaySeal = geSourceOfficer ? seals.find(seal => seal.position === 'day' && seal.kind === '支藏'
    && seal.stem === '丁' && baziStemFeeds(seal.stem, dayRow.stem)) : undefined;
  const geStrongBodyWealth = geSourceOfficer && geDaySeal
    ? { wealth: geSourceOfficer.from, officer: geSourceOfficer.to, seal: geDaySeal, day: dayRow } : undefined;
  // 卷五判此原图由月伤化财而生官，并另提印助。分别核当步运支传印及运干克原官。
  const convertedWealthOfficer = base.convertedWealthPrintedExample === true ? monthOfficerLinks.find(path =>
    path.from.stem === '壬' && path.from.stem === natal.month[0] && path.to.position === 'year' && path.to.kind === '透干'
    && path.to.stem === '甲' && baziStemFeeds(path.from.stem, path.to.stem)) : undefined;
  const convertedWealthSeal = convertedWealthOfficer ? supportsDay.find(path => path.moving === movingRows[1]
    && ['正印', '偏印'].includes(path.moving.god) && path.relation === '生') : undefined;
  const convertedWealthBranchSeal = convertedWealthOfficer && convertedWealthSeal ? {
    wealth: convertedWealthOfficer.from, officer: convertedWealthOfficer.to, seal: convertedWealthSeal.moving,
    day: convertedWealthSeal.day,
    officerPressure: movingContacts.find(link => link.from === movingRows[0] && ['食神', '伤官'].includes(link.from.god)
      && link.to === convertedWealthOfficer.to && link.relation === '克')?.from,
  } : undefined;
  // 卷三认定伍朝枢财官太旺而身弱，卷四指定时酉为印。核实际运辛透出同一印。
  const wuChaoshu = timeKnown && natal.year === '丁亥' && natal.month === '丙午' && natal.day === '壬寅' && natal.hour === '己酉';
  const wuChaoshuOfficer = wuChaoshu ? monthOfficerLinks.find(path => path.from.stem === '丁'
    && path.to.position === 'hour' && path.to.kind === '透干' && path.to.stem === '己'
    && baziStemFeeds(path.from.stem, path.to.stem)) : undefined;
  const wuChaoshuRoot = wuChaoshuOfficer ? all.find(row => row.position === 'year' && row.kind === '支藏'
    && row.branch === '亥' && row.stem === dayRow.stem) : undefined;
  const wuChaoshuNatalSeal = wuChaoshuOfficer ? seals.find(row => row.position === 'hour' && row.kind === '支藏' && row.stem === '辛') : undefined;
  const wuChaoshuNatalSupport = wuChaoshuOfficer && wuChaoshuRoot && wuChaoshuNatalSeal ? {
    wealth: wuChaoshuOfficer.from, officer: wuChaoshuOfficer.to, root: wuChaoshuRoot, natalSeal: wuChaoshuNatalSeal, day: dayRow,
  } : undefined;
  const wuChaoshuMovingSeal = wuChaoshuNatalSeal ? supportsDay.find(path => path.moving === movingRows[0]
    && path.moving.stem === wuChaoshuNatalSeal.stem && path.relation === '生') : undefined;
  const wuChaoshuSealLuck = wuChaoshuNatalSupport && wuChaoshuMovingSeal
    ? { ...wuChaoshuNatalSupport, movingSeal: wuChaoshuMovingSeal.moving } : undefined;
  const wuChaoshuLuLuck = wuChaoshuNatalSupport && luckPillar === '己亥' && wuChaoshuNatalSupport.root.branch === luck.branch
    && wuChaoshuNatalSupport.root.stem === movingRows[1].stem
    ? { ...wuChaoshuNatalSupport, movingLu: movingRows[1], movingOfficer: movingRows[0] } : undefined;
  const geOfficerComparison = ge && ['甲寅', '乙卯'].includes(luckPillar) ? monthOfficerLinks.flatMap(path => {
    if (path.to.kind !== '透干') return [];
    return natalMovingContacts.filter(link => link.from === path.from && link.to === movingRows[0] && link.relation === '生')
      .map(link => ({ monthWealth: path.from, originalOfficer: path.to, movingAuthority: link.to,
        movingBranchAuthority: movingRows.slice(1).filter(row => ['正官', '七杀'].includes(row.god)) }));
  }) : undefined;
  const fire = branchGroups.find(group => group.values === '寅午戌')!;
  // 赵知府原评不取寅印，按财官太轻读。两实际运干仍各按官、杀本位留证。
  const zhaoPrefect = base.zhaoSourceMonthSealNotTaken === true;
  const zhaoPrefectWealth = zhaoPrefect ? wealth.find(row => row.position === 'month' && row.kind === '透干' && row.stem === '庚') : undefined;
  const zhaoPrefectOfficer = zhaoPrefectWealth ? officers.find(row => row.position === 'hour' && row.kind === '透干'
    && row.stem === '癸' && baziStemFeeds(zhaoPrefectWealth.stem, row.stem)) : undefined;
  const zhaoPrefectLuck = zhaoPrefectWealth && zhaoPrefectOfficer ? {
    wealth: zhaoPrefectWealth, officer: zhaoPrefectOfficer, day: dayRow, fire,
    matchingOfficer: luckPillar === '癸巳' && movingRows[0].stem === zhaoPrefectOfficer.stem
      && natalMovingContacts.some(link => link.from === zhaoPrefectWealth && link.to === movingRows[0] && link.relation === '生')
      ? movingRows[0] : undefined,
    killerAtBlade: luckPillar === '壬辰' && movingRows[0].god === '七杀' && baziStemControls(movingRows[0].stem, dayRow.stem)
      ? movingRows[0] : undefined,
  } : undefined;
  const geClash = ge && luckPillar === '甲寅' && fire.members.some(row => row.branch === '午' && row.natalPositions.includes('day'))
    ? relations.pairs.find(pair => pair.kind === '六冲' && pair.members.includes('month') && pair.members.includes('day')) : undefined;
  const geYinWu = geClash && { fire, clash: geClash, killer: movingRows[0], branchSupport: movingRows.slice(1).flatMap(supportDay) };
  const concurrentWealthOfficer = monthOfficerLinks.some(path => path.to.kind === '透干'
    && wealthFeedsOfficer.some(link => link.to === path.to)
    && monthWealthFeedsOfficerLuck.some(link => link.from === path.from && link.to.stem === path.to.stem));
  const foodWealthNamedBalanced = matches('yang');
  const exposedMonthFood = monthFoodLinks.filter(path => path.from.kind === '透干');
  const exposedFoodFeedsMovingWealth = foodFeedsWealthLuck.filter(link => exposedMonthFood.some(path => path.from === link.from));
  const foodSealSupportsDay = !foodWealthNamedBalanced && exposedMonthFood.length > 0
    && supportsDay.some(path => path.relation === '生' && ['正印', '偏印'].includes(path.moving.god));
  const foodFeedsMonthAndMovingWealth = !foodWealthNamedBalanced && exposedFoodFeedsMovingWealth.some(link =>
    !foodWealthInterference.some(path => path.from === link.from));
  const foodLuckFeedsSameMonthWealth = timeKnown && !foodWealthNamedBalanced && foodLuckFeedsMonthWealth.some(link =>
    exposedMonthFood.some(path => path.to === link.to && !foodWealthInterference.some(other => other.from === path.from))
    && !seals.some(seal => baziStemControls(seal.stem, link.from.stem))
    && !movingRows.some(seal => ['正印', '偏印'].includes(seal.god) && baziStemControls(seal.stem, link.from.stem))
    && (link.from.kind !== '运干' || !base.movingFivePairs.length));
  const yangReviewedFoodWealth = foodWealthNamedBalanced && ['癸卯', '甲辰', '乙巳'].includes(luckPillar)
    && ['year', 'month'].every(position => exposedFoodFeedsMovingWealth.some(link => link.from.position === position
      && link.from.stem === '壬'));
  const yangCounter = foodWealthNamedBalanced && luckPillar === '丙午'
    ? foodWealthControlsKiller.filter(link => link.to === movingRows[0]) : [];
  const yangInterferenceMode = foodWealthNamedBalanced && luckPillar === '丁未' ? 'officer-joins-food'
    : foodWealthNamedBalanced && luckPillar === '戊申' ? 'seal-controls-food' : undefined;
  const yangInterferencePaths = !yangInterferenceMode ? [] : foodWealthInterference.filter(path =>
    path.from.kind === '透干' && path.from.stem === '壬' && ['year', 'month'].includes(path.from.position)
      && path.to.position === 'month' && path.to.stem === '甲'
      && (yangInterferenceMode === 'officer-joins-food' ? path.movingOfficerCombinations.some(pair => pair.moving.stem === '丁')
        : path.movingSeals.includes(movingRows[0])));
  const yangFoodSourceInterference = yangInterferenceMode && new Set(yangInterferencePaths.map(path => path.from.position)).size === 2
    ? { mode: yangInterferenceMode, paths: yangInterferencePaths } : undefined;
  const foodSealPairs = contact(food.filter(row => row.kind === '透干'), seals.filter(row => row.kind === '透干'));
  const monthFoodSealPaths = foodSealPairs.flatMap(pair => {
    const monthWealth = monthFoodLinks.filter(link => link.from === pair.from).map(link => link.to);
    if (!monthWealth.length) return [];
    return [{
      food: pair.from, seal: pair.to, monthWealth, columnDistance: pair.columnDistance,
      incomingFood: foodLuckFeedsMonthWealth.filter(link => monthWealth.includes(link.to)),
      incomingWealthFedByFood: foodFeedsWealthLuck.filter(link => link.from === pair.from),
      officerCombinations: base.movingFivePairs.filter(link => movingRows[0].god === '正官'
        && link.target.position === pair.from.position && link.target.stem === pair.from.stem),
      killerFeedsSeal: movingContacts.filter(link => leadingLuck.includes(link.from) && link.from.god === '七杀'
        && link.to === pair.to && link.relation === '生'),
      incomingWealthControlsSeal: movingContacts.filter(link => movingWealth.includes(link.from)
        && link.to === pair.to && link.relation === '克'),
    }];
  });
  const wuFoodSeal = matches('wu'), pingjiangFoodSeal = matches('pingjiang');
  const wuFoodSealSource = wuFoodSeal ? monthFoodSealPaths.find(path => path.food.position === 'year'
    && path.food.stem === '庚' && path.seal.position === 'hour' && path.seal.stem === '丙') : undefined;
  const wuFoodSealSourceContrast = wuFoodSealSource ? {
    monthFood: wuFoodSealSource.food, monthWealth: wuFoodSealSource.monthWealth, seal: wuFoodSealSource.seal, day: dayRow,
  } : undefined;
  const wuWoodFeedsSeal = wuFoodSeal && ['庚寅', '辛卯'].includes(luckPillar)
    && !luck.hiddenStems.some(row => row.element === luck.stemElement) ? movingContacts.filter(link =>
      link.from === movingRows[1] && link.relation === '生' && link.to.position === 'hour' && link.to.stem === '丙'
      && monthFoodSealPaths.some(path => path.seal === link.to)) : [];
  const wuKillerFeedsSeal = wuFoodSeal && luckPillar === '甲午' ? monthFoodSealPaths.flatMap(path =>
    path.killerFeedsSeal.filter(link => link.from === movingRows[0] && link.to.position === 'hour' && link.to.stem === '丙')) : [];
  const pingjiangFoodSealComparison = pingjiangFoodSeal && monthFoodSealPaths.length ? {
    natalMonthWealthFeedsAuthority: monthOfficerLinks.filter(link => link.to.kind === '支藏'
      && ['month', 'day'].includes(link.to.position)),
    monthWealthFeedsMovingAuthority: natalMovingContacts.filter(link => monthWealth.includes(link.from)
      && leadingLuck.includes(link.to) && ['正官', '七杀'].includes(link.to.god) && link.relation === '生'),
    movingSealsSupportingDay: supportsDay.filter(link => link.relation === '生'),
    chenYou: relations.pairs.find(pair => pair.kind === '六合' && pair.members.includes('year') && pair.members.includes('hour')
      && pair.values === '辰酉'),
    siYou: native.filter(row => row.pillar[1] === '巳').map(row => row.id),
  } : undefined;
  const pingjiangSourceWealth = pingjiangFoodSealComparison && ['丙午', '丁未'].includes(luckPillar) ? monthFoodSealPaths.flatMap(path => {
    const originalWealth = path.monthWealth.find(row => row.stem === '丙');
    const wealthLink = path.incomingWealthFedByFood.find(link => link.to === movingRows[0] && baziStemFeeds(path.food.stem, link.to.stem));
    const originalOfficer = wealthLink && officers.find(row => row.position === 'month' && row.kind === '支藏' && row.stem === '戊'
      && baziStemFeeds(wealthLink.to.stem, row.stem));
    return originalWealth && wealthLink && originalOfficer ? [{ food: path.food, seal: path.seal, originalWealth,
      movingWealth: wealthLink.to, originalOfficer }] : [];
  }) : [];
  const hurtingFeedsWealth = monthHurtLinks.length ? [
    ...movingContacts.filter(link => leadingLuck.includes(link.from) && ['食神', '伤官'].includes(link.from.god)
      && monthWealth.includes(link.to) && link.relation === '生'),
    ...natalMovingContacts.filter(link => hurt.includes(link.from) && movingWealth.includes(link.to) && link.relation === '生'),
  ] : [];
  const companionOutputContacts = contact(by(['比肩', '劫财']), output);
  const companionFeedsHurt = companionOutputContacts.filter(link => monthHurtLinks.some(path => path.from === link.to));
  const sealControlsHurt = base.sealOutputContacts.filter(link => monthHurtLinks.some(path => path.from === link.to));
  const hurtInterference = monthHurtLinks.map(path => ({
    ...path,
    movingKillerCombinations: base.movingFivePairs.filter(pair => movingRows[0].god === '七杀' && path.from.kind === '透干'
      && pair.target.position === path.from.position && pair.target.stem === path.from.stem),
    movingOfficerCombinations: base.movingFivePairs.filter(pair => movingRows[0].god === '正官'
      && companionFeedsHurt.some(link => link.to === path.from && link.from.kind === '透干'
        && pair.target.position === link.from.position && pair.target.stem === link.from.stem)),
    movingSeals: movingContacts.filter(link => leadingLuck.includes(link.from) && ['正印', '偏印'].includes(link.from.god)
      && link.relation === '克' && link.to === path.from).map(link => link.from),
  })).filter(path => path.movingKillerCombinations.length || path.movingOfficerCombinations.length || path.movingSeals.length);
  const wangInterference = matches('wang') ? base.movingFivePairs.filter(pair =>
    (luckPillar === '丙子' && pair.target.stem === '辛') || (luckPillar === '丁丑' && pair.target.tenGod === '伤官')) : [];
  const wangBranchRelations = matches('wang') ? relations.pairs.filter(pair =>
    (pair.kind === '六害' && pair.members.includes('year') && pair.members.includes('month'))
    || (pair.kind === '六合' && pair.members.includes('day') && pair.members.includes('hour'))) : [];
  const wangReviewedHurt = wangBranchRelations.some(pair => pair.kind === '六合' && pair.values === '酉辰')
    && wangBranchRelations.some(pair => pair.kind === '六害' && pair.values === '子未') ? monthHurtLinks.flatMap(path => {
      if (path.from.position !== 'hour' || path.from.kind !== '透干' || path.from.stem !== '壬' || path.to.stem !== '乙') return [];
      const companion = companionFeedsHurt.find(link => link.to === path.from && link.from.position === 'month'
        && link.from.kind === '透干' && link.from.stem === '辛');
      const natalWealth = wealth.find(row => row.position === 'year' && row.kind === '透干' && row.stem === '甲');
      return companion && natalWealth ? [{ companion: companion.from, hurt: path.from, monthWealth: path.to, natalWealth }] : [];
    }) : [];
  const wangReviewedWealth = ['甲戌', '乙亥'].includes(luckPillar) ? wangReviewedHurt.flatMap(path => {
    const link = hurtingFeedsWealth.find(link => link.from === path.hurt && link.to === movingRows[0]);
    return link ? [{ ...path, movingWealth: link.to }] : [];
  }) : [];
  const wangReviewedOutput = ['壬申', '癸酉'].includes(luckPillar) ? wangReviewedHurt.flatMap(path => {
    const link = hurtingFeedsWealth.find(link => link.from === movingRows[0] && link.to === path.monthWealth);
    return link ? [{ ...path, movingOutput: link.from }] : [];
  }) : [];
  // Compare the road director's seal route in the actual Jia-Zi stage from the printed four pillars.
  const roadDirectorSourceChart = timeKnown && native.map(row => row.pillar).join('') === '癸巳壬戌乙巳戊寅';
  const roadDirectorSeal = roadDirectorSourceChart && luckPillar === '甲子' ? supportsDay.find(path =>
    path.moving === movingRows[1] && path.moving.stem === '癸' && path.relation === '生') : undefined;
  const roadDirectorHurtSources = roadDirectorSeal ? monthHurtLinks.filter(path => path.from.kind === '支藏'
    && ['year', 'day'].includes(path.from.position) && path.from.stem === '丙' && path.to.stem === '戊'
    && baziStemFeeds(path.from.stem, path.to.stem)) : [];
  const roadDirectorNatalSeals = roadDirectorSeal ? seals.filter(row => row.kind === '透干'
    && ['year', 'month'].includes(row.position) && baziStemFeeds(row.stem, dayRow.stem)) : [];
  const roadDirectorReviewedSealSupport = roadDirectorSeal && roadDirectorHurtSources.length === 2
    && roadDirectorNatalSeals.length === 2 ? {
      hurtSources: roadDirectorHurtSources, natalSeals: roadDirectorNatalSeals, movingSeal: roadDirectorSeal,
    } : undefined;
  const treatedKillers = monthWealth.length ? killers.flatMap(killer => {
    const combinations = killPairs.filter(pair => killer.kind === '透干'
      && pair.target.position === killer.position && pair.target.stem === killer.stem);
    const controllers = output.filter(row => baziStemControls(row.stem, killer.stem));
    return combinations.length || controllers.length ? [{ killer, combinations, controllers, wealth: monthWealth }] : [];
  }) : [];
  const outputControlsTreatedKiller = movingContacts.filter(link => leadingLuck.includes(link.from)
    && ['食神', '伤官'].includes(link.from.god) && link.relation === '克'
    && treatedKillers.some(row => row.killer === link.to));
  const killerControlPressure = treatedKillers.flatMap(path => path.controllers.flatMap(controller => {
    const attacks = movingContacts.filter(link => leadingLuck.includes(link.from) && ['正印', '偏印'].includes(link.from.god)
      && link.relation === '克' && link.to === controller).map(link => link.from);
    const branchClashes = controller.kind === '支藏' ? relations.pairs.filter(pair =>
      pair.kind === '六冲' && pair.members.includes('decadal') && pair.members.includes(controller.position)) : [];
    return attacks.length || branchClashes.length ? [{ killer: path.killer, controller, attacks, branchClashes }] : [];
  }));
  const liBranchSeal = matches('li') && luckPillar === '甲午' ? movingContacts.filter(link =>
    link.from === movingRows[1] && link.relation === '克' && link.to.god === '食神'
    && treatedKillers.some(row => row.controllers.includes(link.to))) : [];
  const killerSealPairs = monthWealth.length
    ? contact(killers.filter(row => row.kind === '透干'), seals.filter(row => row.kind === '透干')) : [];
  const movingOutputWealthKillerSeal = killerSealPairs.flatMap(pair => movingContacts.filter(link => leadingLuck.includes(link.from)
    && ['食神', '伤官'].includes(link.from.god) && monthWealth.includes(link.to) && link.relation === '生'
    && baziStemFeeds(link.to.stem, pair.from.stem) && baziStemFeeds(pair.to.stem, dayRow.stem)).map(link => ({ output: link.from, monthWealth: link.to,
    killer: pair.from, seal: pair.to, day: dayRow })));
  const killerFeedsSealLuck = killerSealPairs.length ? natalMovingContacts.filter(link =>
    killerSealPairs.some(pair => pair.from === link.from) && link.relation === '生'
    && supportsDay.some(row => row.moving === link.to && row.relation === '生')) : [];
  const wealthControlsKillerSeal = killerSealPairs.length ? movingContacts.filter(link =>
    movingWealth.includes(link.from) && killerSealPairs.some(pair => pair.to === link.to) && link.relation === '克')
    .map(link => ({ ...link, alsoCombines: link.from === movingRows[0] && base.movingFivePairs.some(pair =>
      !pair.targetIsDayMaster && pair.target.position === link.to.position && pair.target.stem === link.to.stem) })) : [];
  const zhaoOfficerFeedsSeal = matches('zhao') && ['甲申', '乙酉'].includes(luckPillar) ? movingContacts.filter(link =>
    link.from === movingRows[0] && ['正官', '七杀'].includes(link.from.god)
    && killerSealPairs.some(pair => pair.to === link.to) && link.relation === '生') : [];
  const zhaoSealPairs = matches('zhao') ? killerSealPairs.filter(pair => pair.from.stem === '乙' && pair.to.position === 'month'
    && pair.to.stem === '丁' && baziStemFeeds(pair.from.stem, pair.to.stem) && baziStemFeeds(pair.to.stem, dayRow.stem)) : [];
  const zhaoGuiWeiSeal = luckPillar === '癸未' && zhaoSealPairs.length ? movingRows.slice(2).filter(row =>
    row.stem === '丁' && row.god === '偏印' && baziStemFeeds(row.stem, dayRow.stem)) : [];
  const zhaoRenWuCombinesSeal = luckPillar === '壬午' && zhaoSealPairs.length ? wealthControlsKillerSeal.filter(link =>
    link.from === movingRows[0] && link.alsoCombines && zhaoSealPairs.some(pair => pair.to === link.to)) : [];
  const wealthLuckRoutes = [
    monthOfficerLinks.length > 0 && supportsDay.length > 0 && 'officer-support',
    convertedWealthBranchSeal && !convertedWealthBranchSeal.officerPressure && 'converted-wealth-branch-seal',
    wuChaoshuSealLuck && 'wu-chaoshu-source-seal',
    wuChaoshuLuLuck && 'wu-chaoshu-source-lu',
    (wealthFeedsOfficer.length > 0 || monthWealthFeedsOfficerLuck.length > 0) && 'officer-luck',
    concurrentWealthOfficer && 'concurrent-wealth-officer',
    zhaoPrefectLuck?.matchingOfficer && 'zhao-weak-wealth-officer-luck',
    sealProtectsOfficer.length > 0 && 'seal-protects-officer',
    natalOutputOfficerPaths.some(path => path.movingSeals.length > 0) && 'moving-seal-controls-natal-output',
    natalOutputOfficerPaths.some(path => path.controlledKillers.length > 0) && 'officer-output-controls-moving-killer',
    monthFoodLinks.length > 0 && supportsDay.length > 0 && 'food-support',
    foodSealSupportsDay && 'food-seal-supports-day',
    (foodLuckFeedsMonthWealth.length > 0 || foodFeedsWealthLuck.length > 0) && 'food-feeds-wealth',
    foodFeedsMonthAndMovingWealth && 'food-feeds-month-and-moving-wealth',
    foodLuckFeedsSameMonthWealth && 'moving-food-feeds-same-month-wealth',
    yangReviewedFoodWealth && 'yang-reviewed-food-wealth',
    hurtLuckFeedsMonthFoodWealth.length > 0 && 'hurt-feeds-food-wealth',
    foodWealthControlsKiller.length > 0 && 'food-wealth-controls-killer',
    foodWealthInterference.length > 0 && 'food-wealth-interference',
    !wuFoodSeal && monthFoodSealPaths.some(path => path.incomingFood.length || path.incomingWealthFedByFood.length) && 'food-seal-wealth',
    !pingjiangFoodSeal && monthFoodSealPaths.length > 0 && supportsDay.length > 0 && 'food-seal-support',
    !pingjiangFoodSeal && monthFoodSealPaths.some(path => path.officerCombinations.length || path.killerFeedsSeal.length)
      && 'food-seal-authority',
    wuWoodFeedsSeal.length > 0 && 'wu-wood-feeds-seal',
    wuKillerFeedsSeal.length > 0 && 'wu-killer-feeds-seal',
    pingjiangSourceWealth.length > 0 && 'pingjiang-source-wealth',
    pingjiangFoodSealComparison && ['戊申', '己酉', '庚戌', '辛亥'].includes(luckPillar)
      && (pingjiangFoodSealComparison.monthWealthFeedsMovingAuthority.length || pingjiangFoodSealComparison.movingSealsSupportingDay.length)
      && 'pingjiang-food-seal-comparison',
    (hurtingFeedsWealth.length > 0 || monthHurtLinks.length > 0 && supportsDay.length > 0) && 'hurt-wealth-or-support',
    hurtInterference.length > 0 && 'hurt-wealth-interference',
    wangInterference.length > 0 && 'wang-hurt-interference',
    wangReviewedWealth.length > 0 && 'wang-reviewed-wealth',
    wangReviewedOutput.length > 0 && 'wang-reviewed-output',
    roadDirectorReviewedSealSupport && 'road-director-reviewed-seal-support',
    (outputControlsTreatedKiller.length > 0 || treatedKillers.length > 0 && supportsDay.some(row => row.relation === '同五行')) && 'treated-killer-luck',
    killerControlPressure.some(path => path.attacks.some(row => row.kind === '运干') || path.branchClashes.length > 0)
      && 'treated-killer-counterpressure',
    liBranchSeal.length > 0 && 'li-branch-seal',
    killerFeedsSealLuck.length > 0 && 'killer-feeds-seal-luck',
    wealthControlsKillerSeal.length > 0 && 'wealth-controls-killer-seal',
    movingOutputWealthKillerSeal.length > 0 && 'output-feeds-wealth-under-killer-seal',
    zhaoOfficerFeedsSeal.length > 0 && 'zhao-officer-feeds-seal',
    zhaoGuiWeiSeal.length > 0 && 'zhao-gui-wei-seal',
    zhaoRenWuCombinesSeal.length > 0 && 'zhao-ren-wu-combines-seal',
  ].filter(route => typeof route === 'string');
  const monthWealthLuck = monthWealth.length || zhaoPrefectLuck ? { monthOfficerLinks, monthFoodLinks, supportsDay,
    wealthFeedsOfficer, monthWealthFeedsOfficerLuck, sealProtectsOfficer, natalOutputOfficerPaths,
    foodLuckFeedsMonthWealth, foodFeedsWealthLuck, hurtLuckFeedsMonthFoodWealth, foodWealthControlsKiller,
    foodWealthInterference, foodWealthNamedBalanced, wuFoodSealSourceContrast, geOfficerComparison, geYinWu, geStrongBodyWealth,
    convertedWealthOfficer, convertedWealthBranchSeal, wuChaoshuNatalSupport, wuChaoshuSealLuck, wuChaoshuLuLuck, zhaoPrefectLuck,
    yangCounter, yangFoodSourceInterference } : undefined;
  const wealthRemedyLuck = monthWealth.length ? { monthWealth, monthFoodSealPaths, wuWoodFeedsSeal, wuKillerFeedsSeal,
    pingjiangFoodSealComparison, pingjiangSourceWealth,
    monthHurtLinks, hurtingFeedsWealth, companionFeedsHurt, sealControlsHurt, hurtInterference,
    wangInterference, wangBranchRelations, wangReviewedWealth, wangReviewedOutput, roadDirectorReviewedSealSupport,
    treatedKillers, outputControlsTreatedKiller, killerControlPressure, liBranchSeal,
    killerSealPairs, killerFeedsSealLuck, wealthControlsKillerSeal, movingOutputWealthKillerSeal,
    zhaoOfficerFeedsSeal, zhaoGuiWeiSeal, zhaoRenWuCombinesSeal } : undefined;
  return { profile: zpqzWealthPolicy.profile, timeKnown, dayMaster: base.dayMaster, natalPillars: base.natalPillars,
    monthHiddenGods: base.monthHiddenGods, monthWealthCandidate: base.monthWealthCandidate, gods: base.gods,
    foodPresent: present(['食神']), foodExposed: exposed(['食神']), hurtPresent: present(['伤官']),
    sealsPresent: base.sealsPresent, sealsExposed: base.sealsExposed, officerPresent: present(['正官']),
    killerPresent: present(['七杀']), killerExposed: exposed(['七杀']), wealthExposed: base.wealthExposed,
    wealthOfficerContacts: contact(wealth, officers), foodWealthContacts: contact(food, wealth), hurtWealthContacts: contact(hurt, wealth),
    companionOutputContacts, outputKillerContacts: contact(output, killers),
    sealOutputContacts: base.sealOutputContacts, wealthSealContacts: base.wealthSealContacts, killerSealContacts: contact(killers, seals),
    foodSealPairs,
    sealDayMasterContacts: contact(seals, [dayRow]), roots: base.roots, natalFivePairs: order.natalFivePairs,
    killPairs, killerTreatmentCandidate: seen(killPairs.length > 0 || output.length > 0 && killers.length > 0),
    movingRows, movingContacts, natalMovingContacts, movingFivePairs: base.movingFivePairs, branchGroups, wealthLuckRoutes, monthWealthLuck,
    foodWealthNamedBalanced, wuFoodSealSourceExcludesFoodRule: seen(Boolean(wuFoodSealSourceContrast)),
    geSourceStrongBodyWealth: seen(Boolean(geStrongBodyWealth)),
    sourceWealthTooStrongForLightRoute: seen(Boolean(geStrongBodyWealth || convertedWealthOfficer || wuChaoshuNatalSupport)),
    yangFoodSourceExcludesBenefit: timeKnown ? Boolean(yangFoodSourceInterference) : undefined,
    wealthRemedyLuck,
    natalRelationPairs: relations.pairs.filter(pair => !pair.members.includes('decadal')),
    movingRelationPairs: relations.pairs.filter(pair => pair.members.includes('decadal')),
    printedCases, natalPillarSequence: timeKnown ? native.map(row => row.pillar).join('') : undefined,
    sourceVariants: zpqzWealthVariants, luckPillar, luckTenGod: base.luckTenGod, luckBranchMainQiGod: base.luckBranchMainQiGod,
    strengthVerified: false, transformationVerified: false, protectionVerified: false, climateVerified: false };
}
