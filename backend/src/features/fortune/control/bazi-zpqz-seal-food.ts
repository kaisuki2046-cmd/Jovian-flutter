import { baziInteractions, baziStemControls, baziStemFeeds, describeBaZiPillar } from './bazi-calculation';
import { baziZpqzStemOrder } from './bazi-zpqz-stems';

const layers = ['year', 'month', 'day', 'hour'] as const;
type Natal = Record<typeof layers[number], string>;
type Component = { position: string; pillar: string; stem: string; god: string; element: string; kind: string };
const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥', elements = '木火土金水';
const sealGods = ['正印', '偏印'], outputGods = ['食神', '伤官'], wealthGods = ['正财', '偏财'];
const sourceHeavySealCases = new Set(['zhang', 'zhu', 'li', 'mao', 'wang', 'niu', 'jia-ji-seal', 'lin-sen-you', 'lin-sen-shen']);
const valid = (p: string) => typeof p === 'string' && p.length === 2 && stems.includes(p[0]) && branches.includes(p[1])
  && stems.indexOf(p[0]) % 2 === branches.indexOf(p[1]) % 2;
export const zpqzSealFoodPolicy = {
  profile: 'zpqz-seal-output-exposure-targets-v1',
  generalRemedy: 'zpqz-general-remedy-premises-v1',
  source: 'volume4-visible-concealed-output-rescue-and-seal-luck-diagrams',
  contacts: 'named-stem-elements-and-column-geometry-not-effective-protection',
  roots: 'same-element-hidden-qi-with-exact-stem-separated-not-weighted',
  visibility: 'no-exposed-output-not-no-hidden-output; Mao-hidden-food-and-wealth-explicit',
  diagrams: 'literal-columns-with-separate-year-month-day-hour-stem-consistency',
} as const;
export const zpqzFanSealPillars = ['丁丑', '壬寅', '己巳', '丙寅'] as const;
export const zpqzWuSealPillars = ['丁亥', '丙午', '壬寅', '己酉'] as const;
export const zpqzHurtWealthCases = [
  { id: 'wealth-heavy', name: '都统制财印例', pillars: ['丁酉', '己酉', '戊子', '壬子'] },
  { id: 'seal-heavy', name: '丞相财印例', pillars: ['壬戌', '己酉', '戊午', '丁巳'] },
] as const;
export const zpqzSealFoodCases = [
  { id: 'zhang', name: '张参政', pillars: ['丙寅', '戊戌', '辛酉', '戊子'] },
  { id: 'zhu', name: '朱尚书', pillars: ['丙戌', '戊戌', '辛未', '壬辰'] },
  { id: 'linhuai', name: '临淮侯', pillars: ['乙亥', '己卯', '丁酉', '壬寅'] },
  { id: 'li', name: '李状元', pillars: ['戊戌', '乙卯', '丙午', '己亥'] },
  { id: 'mao', name: '毛状元', pillars: ['己巳', '癸酉', '癸未', '庚申'] },
  { id: 'ma', name: '马参政', pillars: ['壬寅', '戊申', '壬辰', '壬寅'] },
  { id: 'wang', name: '汪侍郎', pillars: ['辛酉', '丙申', '壬申', '辛亥'] },
  { id: 'wealth-seal', name: '某富翁子', pillars: ['庚申', '丙寅', '丙申', '乙未'] },
  { id: 'officer-killer-seal', name: '官杀印例', pillars: ['辛亥', '庚子', '甲辰', '乙亥'] },
  { id: 'cold-bing', name: '湿木丙火例', pillars: ['壬子', '癸卯', '丙子', '己亥'] },
  { id: 'niu', name: '牛监薄', pillars: ['庚寅', '乙酉', '癸亥', '丙辰'] },
  { id: 'jia-ji-seal', name: '甲己合原图', pillars: ['己未', '甲戌', '辛未', '癸巳'] },
  { id: 'light-seal-wealth', name: '财旺煞印弱原图', pillars: ['庚戌', '戊子', '甲戌', '乙亥'] },
  { id: 'lin-sen-you', name: '林森酉时图', pillars: ['戊辰', '甲寅', '丁卯', '己酉'] },
  { id: 'lin-sen-shen', name: '林森申时异文', pillars: ['戊辰', '甲寅', '丁卯', '戊申'] },
  { id: 'wealthy-son-wu-yin', name: '浙西富翁子戊寅异文', pillars: ['庚申', '戊寅', '丙申', '乙未'] },
] as const;

// A consistency check of stem pairing, not a recovered historical birthday.
// Preserve the transcription even if a check fails; do not repair its column.
export function zpqzColumnStemCheck(pillars: readonly string[]) {
  if (pillars.length !== 4 || pillars.some(p => !valid(p))) throw new RangeError('Invalid source diagram');
  const [year, month, day, hour] = pillars;
  const monthOffset = (branches.indexOf(month[1]) - 2 + 12) % 12;
  const expectedMonthStem = stems[(stems.indexOf(year[0]) % 5 * 2 + 2 + monthOffset) % 10];
  const expectedHourStem = stems[(stems.indexOf(day[0]) % 5 * 2 + branches.indexOf(hour[1])) % 10];
  return { yearMonthCompatible: month[0] === expectedMonthStem, expectedMonthStem,
    dayHourCompatible: hour[0] === expectedHourStem, expectedHourStem };
}

export function baziZpqzSealFood(natal: Natal, timeKnown: boolean, luckPillar: string) {
  if (layers.filter(p => p !== 'hour' || timeKnown).some(p => !valid(natal[p])) || !valid(luckPillar)) throw new RangeError('Invalid seal-output pillars');
  const native = layers.flatMap((position, index) => position === 'hour' && !timeKnown ? []
    : [{ position: position as string, index, ...describeBaZiPillar(natal[position], natal.day[0]) }]);
  const luck = describeBaZiPillar(luckPillar, natal.day[0]), exposed = native.filter(p => p.position !== 'day');
  const witness = (p: typeof native[number]) => ({ position: p.position, index: p.index, pillar: p.pillar, stem: p.stem,
    branch: p.branch, god: p.tenGod!, element: p.stemElement, kind: '透干' });
  const seen = (yes: boolean) => yes ? true : timeKnown ? false : undefined;
  const visibleRows = exposed.map(witness), hiddenRows = native.flatMap(p => p.hiddenStems.map(h => ({
    position: p.position, index: p.index, pillar: p.pillar, branch: p.branch, stem: h.stem, god: h.tenGod!, element: h.element, kind: '支藏',
  })));
  const gods = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'].map(god => ({
    god, exposed: seen(visibleRows.some(r => r.god === god)), hidden: seen(hiddenRows.some(r => r.god === god)),
    exposedRows: visibleRows.filter(r => r.god === god), hiddenRows: hiddenRows.filter(r => r.god === god),
  }));
  const anyExposed = (group: string[]) => seen(visibleRows.some(r => group.includes(r.god)));
  const anyHidden = (group: string[]) => seen(hiddenRows.some(r => group.includes(r.god)));
  const present = (group: string[]) => seen([...visibleRows, ...hiddenRows].some(r => group.includes(r.god)));
  const all = [...visibleRows, ...hiddenRows];
  const contacts = (fromGods: string[], toGods: string[], step: number) => all.filter(r => fromGods.includes(r.god)).flatMap(from =>
    all.filter(to => toGods.includes(to.god) && (elements.indexOf(from.element) + step) % 5 === elements.indexOf(to.element)).map(to => ({
      from, to, columnDistance: Math.abs(from.index - to.index), bothExposed: from.kind === '透干' && to.kind === '透干',
      between: native.filter(p => Math.min(from.index, to.index) < p.index && p.index < Math.max(from.index, to.index))
        .map(p => ({ position: p.position, pillar: p.pillar, stem: p.stem })),
    })));
  const sealsPresent = present(sealGods);
  const sealsExposed = anyExposed(sealGods), sealsHidden = anyHidden(sealGods), hurtExposed = anyExposed(['伤官']), hurtHidden = anyHidden(['伤官']);
  const outputsExposed = anyExposed(outputGods), foodHidden = anyHidden(['食神']);
  const conjunction = (...values: (boolean | undefined)[]) => values.includes(false) ? false : values.includes(undefined) ? undefined : true;
  const not = (value: boolean | undefined) => value === undefined ? undefined : !value;
  const stemOrder = baziZpqzStemOrder(natal, timeKnown, luckPillar);
  // 卷四赵知府原评：寅午一合，印化为劫，以月庚财生时癸官。
  const zhaoSourceMonthSealNotTaken = seen(stemOrder.natalPillarSequence === '丙午庚寅丙午癸巳');
  // 卷二：甲乙生申酉，干有比印、年日时支亦通根比印时，失时而不弱。
  const autumnWood = timeKnown && '甲乙'.includes(natal.day[0]) && '申酉'.includes(natal.month[1]);
  const autumnWoodRoots = autumnWood ? hiddenRows.filter(root => root.position !== 'month'
    && (root.element === '木' || root.element === '水')
    && !native.some(row => Math.abs(branches.indexOf(row.branch) - branches.indexOf(root.branch)) === 6)) : [];
  const rootedAutumnWoodStems = autumnWood ? visibleRows.flatMap(stem => {
    if ((stem.element !== '木' && stem.element !== '水')
      || stemOrder.natalFivePairs.some(pair => pair.first.position === stem.position || pair.second.position === stem.position)) return [];
    const roots = autumnWoodRoots.filter(root => root.stem === stem.stem);
    return roots.length ? [{ stem, roots }] : [];
  }) : [];
  const autumnWoodSupport = ['year', 'day', 'hour'].every(position => autumnWoodRoots.some(root => root.position === position))
    && rootedAutumnWoodStems.some(row => row.stem.element === '木') && rootedAutumnWoodStems.some(row => row.stem.element === '水')
    ? { roots: autumnWoodRoots, stems: rootedAutumnWoodStems } : undefined;
  const nativeStem = (stem: string) => seen(exposed.some(p => p.stem === stem));
  const shenZiChen = [...'申子辰'].map(branch => ({ branch, natalPositions: native.filter(p => p.branch === branch).map(p => p.position), luckPresent: luck.branch === branch }));
  const groupComplete = shenZiChen.every(r => r.natalPositions.length || r.luckPresent) ? true : timeKnown ? false : undefined;
  const nativeGroupComplete = shenZiChen.every(r => r.natalPositions.length) ? true : timeKnown ? false : undefined;
  const month = native.find(p => p.position === 'month')!;
  const day = native.find(p => p.position === 'day')!;
  const dayComponent = { position: 'day', pillar: day.pillar, stem: day.stem, god: '日元', element: day.stemElement, kind: '日干' };
  const remedyMovingComponents = [{ position: 'decadal', pillar: luckPillar, stem: luck.stem, god: luck.tenGod!, element: luck.stemElement, kind: '运干' },
    ...luck.hiddenStems.map(h => ({ position: 'decadal', pillar: luckPillar, stem: h.stem, god: h.tenGod!, element: h.element, kind: '运支藏干' }))];
  const directedContacts = (from: Component[], to: Component[]) => from.flatMap(a => to.flatMap(b => {
    const step = (elements.indexOf(b.element) - elements.indexOf(a.element) + 5) % 5;
    return step === 1 || step === 2 ? [{ from: a, to: b, relation: step === 1 ? '生' : '克' }] : [];
  }));
  const liSkeleton = conjunction(natal.day === '丙午' && natal.month === '乙卯', nativeStem('戊'), nativeStem('己'));
  const maoSkeleton = conjunction(natal.day[0] === '癸' && natal.month[1] === '酉', nativeStem('己'), nativeStem('庚'), not(outputsExposed));
  const maSkeleton = conjunction(natal.day[0] === '壬' && natal.month[1] === '申', nativeStem('戊'), seen(native.some(p => p.branch === '辰')));
  const printedCases = zpqzSealFoodCases.map(c => ({ ...c, stemCheck: zpqzColumnStemCheck(c.pillars),
    matches: layers.every((position, i) => position === 'hour' && !timeKnown || natal[position] === c.pillars[i])
      ? timeKnown ? true : undefined : false }));
  const matches = (id: string) => printedCases.some(row => row.id === id && row.matches === true);
  const namedHeavySeal = printedCases.some(row => row.matches === true && sourceHeavySealCases.has(row.id));
  const wealthySonVariant = matches('wealthy-son-wu-yin');
  const namedLightSeal = matches('light-seal-wealth') || wealthySonVariant;
  const remedyMovingContacts = directedContacts(remedyMovingComponents, [...all, dayComponent]);
  const remedyNatalContacts = directedContacts(all, remedyMovingComponents);
  const [movingStem, mainQi] = remedyMovingComponents;
  const leadingLuck = remedyMovingComponents.slice(0, 2);
  const movingWealth = leadingLuck.filter(row => wealthGods.includes(row.god));
  const monthSeals = hiddenRows.filter(row => row.position === 'month' && sealGods.includes(row.god));
  const officers = visibleRows.filter(row => row.god === '正官');
  const sealOutputContacts = contacts(sealGods, outputGods, 2);
  const wealthSealContacts = contacts(wealthGods, sealGods, 2);
  const sealDayContacts = directedContacts(all.filter(row => sealGods.includes(row.god)), [dayComponent]);
  const generates = (links: ReturnType<typeof directedContacts>, from: Component, to: Component) =>
    links.some(link => link.from === from && link.to === to && link.relation === '生');
  const controls = (links: ReturnType<typeof directedContacts>, from: Component, to: Component) =>
    links.some(link => link.from === from && link.to === to && link.relation === '克');
  const wealthControlling = (seal: Component) => movingWealth.filter(row => controls(remedyMovingContacts, row, seal));
  const originalSealPositions = sealDayContacts.map(link => link.from);
  const arrivingRobbery = leadingLuck.filter(row => row.god === '劫财');
  const robberyAgainstSealWealth = timeKnown && originalSealPositions.length ? arrivingRobbery.map(robbery => ({
    robbery, seals: originalSealPositions,
    natalWealthPaths: wealthSealContacts.filter(link => originalSealPositions.includes(link.to) && controls(remedyMovingContacts, robbery, link.from))
      .map(link => ({ wealth: link.from, seal: link.to })),
    movingWealthPaths: movingWealth.flatMap(wealth => baziStemControls(robbery.stem, wealth.stem)
      ? originalSealPositions.filter(seal => controls(remedyMovingContacts, wealth, seal)).map(seal => ({ wealth, seal })) : []),
  })) : [];
  const wuSourceWealthTooStrong = timeKnown && layers.every((position, index) => natal[position] === zpqzWuSealPillars[index]);
  const hasWuSourceRobberyProtectingSeal = wuSourceWealthTooStrong && robberyAgainstSealWealth.some(({ robbery, natalWealthPaths }) =>
    robbery.kind === '运干' && robbery.stem === '癸' && natalWealthPaths.some(({ wealth, seal }) =>
      wealth.kind === '透干' && ['year', 'month'].includes(wealth.position)
      && seal.position === 'hour' && seal.kind === '支藏' && seal.stem === '辛'));
  const changSourceSealInUse = stemOrder.natalPillarSequence === '辛卯辛卯癸酉己未';
  const changSourceRobberyProtectingSeal = timeKnown ? changSourceSealInUse && luckPillar === '丁亥'
    && robberyAgainstSealWealth.some(({ robbery, natalWealthPaths }) => robbery === mainQi && robbery.stem === '壬'
      && ['year', 'month'].every(position => natalWealthPaths.some(({ wealth, seal }) => wealth.position === 'hour'
        && wealth.kind === '支藏' && wealth.stem === '丁' && seal.position === position && seal.kind === '透干' && seal.stem === '辛')))
    : undefined;
  const wealthPressesHurtSeal = timeKnown && movingWealth.length ? sealOutputContacts.flatMap(({ from: seal, to: hurt }) => {
    if (hurt.god !== '伤官' || !originalSealPositions.includes(seal)) return [];
    const wealth = wealthControlling(seal).filter(moving => generates(remedyNatalContacts, hurt, moving));
    return wealth.length ? [{ hurt, seal, wealth, monthHurt: hurt.position === 'month' && hurt.kind === '支藏' }] : [];
  }) : [];
  const liEarthOutputSourceDiagram = stemOrder.natalPillarSequence === '戊戌己未丙子庚寅';
  const liEarthOutputSourceWealth = liEarthOutputSourceDiagram
    && ['庚申', '辛酉'].includes(luckPillar)
    && wealthPressesHurtSeal.some(path => path.hurt.position === 'month' && path.hurt.kind === '透干' && path.hurt.stem === '己'
      && path.seal.position === 'hour' && path.seal.kind === '支藏' && path.seal.stem === '甲'
      && path.wealth.includes(movingStem) && path.wealth.includes(mainQi));
  // Xu and Lin assign opposing uses to the same exposed seal and wealth in the Zhou chart.
  const zhouSourceDiagram = stemOrder.natalPillarSequence === '戊戌甲子丁未庚戌';
  const zhouRobbery = zhouSourceDiagram ? (luckPillar === '丙寅' ? movingStem : luckPillar === '己巳' ? mainQi : undefined) : undefined;
  const zhouRobberyPair = zhouRobbery?.stem === '丙' ? robberyAgainstSealWealth.find(row => row.robbery === zhouRobbery)
    ?.natalWealthPaths.find(({ wealth, seal }) => wealth.position === 'hour' && wealth.kind === '透干' && wealth.stem === '庚'
      && seal.position === 'month' && seal.kind === '透干' && seal.stem === '甲') : undefined;
  const zhouSourceRobberyDispute = zhouRobbery && zhouRobberyPair ? { robbery: zhouRobbery, ...zhouRobberyPair } : undefined;
  const zhouWealthOutput = zhouSourceDiagram && luckPillar === '庚午' ? wealthPressesHurtSeal.find(path =>
    path.hurt.position === 'year' && path.hurt.kind === '透干' && path.hurt.stem === '戊'
    && path.seal.position === 'month' && path.seal.kind === '透干' && path.seal.stem === '甲'
    && path.wealth.includes(movingStem)) : undefined;
  const zhouSourceWealthOutput = zhouWealthOutput ? { hurt: zhouWealthOutput.hurt, wealth: movingStem, seal: zhouWealthOutput.seal } : undefined;
  const qianSourceSealInUse = stemOrder.natalPillarSequence === '丙午癸巳甲子丙寅';
  const qianWealthSeal = qianSourceSealInUse && luckPillar === '戊戌' ? wealthPressesHurtSeal.find(path =>
    path.hurt.position === 'year' && path.hurt.kind === '支藏' && path.hurt.stem === '丁'
    && path.seal.position === 'month' && path.seal.kind === '透干' && path.seal.stem === '癸'
    && path.wealth.includes(movingStem) && path.wealth.includes(mainQi)) : undefined;
  const qianSealRoot = qianWealthSeal && hiddenRows.find(row => row.position === 'day' && row.stem === qianWealthSeal.seal.stem);
  const qianWealthSealCombination = qianWealthSeal && stemOrder.movingFivePairs.find(pair =>
    pair.moving.stem === movingStem.stem && pair.target.position === qianWealthSeal.seal.position
    && pair.target.stem === qianWealthSeal.seal.stem);
  const qianSourceWealthSealPressure = qianWealthSeal && qianSealRoot && qianWealthSealCombination
    ? { ...qianWealthSeal, root: qianSealRoot, combination: qianWealthSealCombination } : undefined;
  const hasQianSourceWealthSealPressure = seen(Boolean(qianSourceWealthSealPressure));
  const boluoSourceSealInUse = natal.year === '壬申' && natal.month === '丙午' && natal.day === '甲午'
    ? timeKnown ? natal.hour === '壬申' : undefined
    : false;
  const boluoWealthHitsBothExposedSeals = (wealth: Component) =>
    ['year', 'hour'].every(position => wealthPressesHurtSeal.some(path => path.monthHurt && path.hurt.stem === '丁'
      && path.seal.position === position && path.seal.kind === '透干' && path.seal.stem === '壬'
      && path.wealth.includes(wealth)));
  const boluoSourceXuWealthPressure = boluoSourceSealInUse === true && luckPillar === '庚戌' && mainQi.stem === '戊'
    && boluoWealthHitsBothExposedSeals(mainQi);
  const fanSourceSealInUse = layers.every((position, index) =>
    position === 'hour' && !timeKnown || natal[position] === zpqzFanSealPillars[index]) ? timeKnown ? true : undefined : false;
  const arrivingSeals = leadingLuck.filter(row => sealGods.includes(row.god) && generates(remedyMovingContacts, row, dayComponent));
  const arrivingOfficers = leadingLuck.filter(row => ['正官', '七杀'].includes(row.god));
  const monthOfficers = hiddenRows.filter(row => row.position === 'month' && row.god === '正官');
  const exceptionLuck = leadingLuck.filter(row => ['比肩', '劫财', '伤官'].includes(row.god));
  const officerHurtGuards = timeKnown ? sealOutputContacts.flatMap(({ from: seal, to: hurt }) => {
    if (hurt.god !== '伤官') return [];
    return [...officers, ...monthOfficers].filter(officer => baziStemControls(hurt.stem, officer.stem)).map(officer => ({ seal, hurt, officer }));
  }) : [];
  const exposedOfficerWealthSeal = exceptionLuck.length ? officerHurtGuards.flatMap(guard => {
    if (guard.officer.kind !== '透干' || !baziStemFeeds(guard.officer.stem, guard.seal.stem)) return [];
    const wealth = wealthSealContacts.filter(link => link.to === guard.seal && baziStemFeeds(link.from.stem, guard.officer.stem))
      .map(link => ({ source: link.from, between: link.between, bothExposed: link.bothExposed }));
    const moving = exceptionLuck.map(component => ({ component,
      checksOfficer: controls(remedyMovingContacts, component, guard.officer),
      checksWealth: wealth.filter(link => controls(remedyMovingContacts, component, link.source)).map(link => link.source),
      sameElementAsDay: component.element === dayComponent.element,
    }));
    return wealth.length ? [{ ...guard, wealth, moving }] : [];
  }) : [];
  const convertedWealthPrintedExample = natal.year === '甲子' && natal.month === '壬申' && natal.day === '己亥'
    ? timeKnown ? natal.hour === '辛未' : undefined
    : false;
  const namedHurtingOfficerPeerEvidence = timeKnown && stemOrder.natalPillarSequence === '戊申甲子庚午丁丑' && luckPillar === '庚午'
    ? exposedOfficerWealthSeal.find(path => path.seal.position === 'year' && path.seal.stem === '戊' && path.seal.kind === '透干'
      && path.hurt.position === 'month' && path.hurt.stem === '癸' && path.officer.position === 'hour' && path.officer.stem === '丁'
      && path.wealth.some(({ source }) => source.position === 'month' && source.stem === '甲' && source.kind === '透干')
      && path.moving.some(({ component }) => component.kind === '运干' && component.god === '比肩'))
    : undefined;
  const sealHiddenHurtExposed = hurtExposed === true && sealsExposed === false;
  const sealExposedHurtHidden = sealsExposed === true && hurtExposed === false;
  const monthOfficerSealLuck = officerHurtGuards.flatMap(guard => {
    if (!monthOfficers.includes(guard.officer)) return [];
    const exposedSeal = sealExposedHurtHidden && guard.seal.kind === '透干' && guard.hurt.kind === '支藏';
    const hiddenSeal = sealHiddenHurtExposed && guard.seal.kind === '支藏' && guard.hurt.kind === '透干';
    if (!exposedSeal && !hiddenSeal) return [];
    const officersFeedingSeal = arrivingOfficers.filter(row => generates(remedyMovingContacts, row, guard.seal));
    const sealsFacingHurt = arrivingSeals.filter(row => controls(remedyMovingContacts, row, guard.hurt));
    const wealthFacingSeal = hiddenSeal ? wealthControlling(guard.seal) : [];
    return officersFeedingSeal.length || sealsFacingHurt.length || wealthFacingSeal.length
      ? [{ ...guard, exposedSeal, officersFeedingSeal, sealsFacingHurt, wealthFacingSeal }] : [];
  });
  const officerSealExposureRoutes = [
    monthOfficerSealLuck.some(path => path.exposedSeal && path.officersFeedingSeal.length > 0) && 'shown-seal-hidden-hurt-authority',
    monthOfficerSealLuck.some(path => !path.exposedSeal && path.officersFeedingSeal.length > 0) && 'shown-hurt-hidden-seal-authority',
    monthOfficerSealLuck.some(path => !path.exposedSeal && path.wealthFacingSeal.length > 0) && 'shown-hurt-hidden-seal-wealth',
  ].filter(route => typeof route === 'string');
  const monthWealth = hiddenRows.filter(row => row.position === 'month' && wealthGods.includes(row.god));
  const originalHiddenFood = hiddenRows.filter(row => row.god === '食神');
  const originalExposedOutput = visibleRows.filter(row => outputGods.includes(row.god));
  // Xu uses the seal in the Sun diagram and treats the exposed killer as unrooted.
  const sunSourceShape = timeKnown && stemOrder.natalPillarSequence === '乙丑辛巳己巳庚午';
  const sunSeal = sunSourceShape ? monthSeals.find(row => row.stem === '丙' && originalSealPositions.includes(row)) : undefined;
  const sunKiller = sunSeal && !hiddenRows.some(row => row.element === '木')
    ? visibleRows.find(row => row.position === 'year' && row.stem === '乙' && row.god === '七杀') : undefined;
  const sunOutput = sunKiller ? originalExposedOutput.find(row => row.position === 'hour' && row.stem === '庚') : undefined;
  const sunJiaOfficerCombination = sunOutput && luckPillar === '甲戌' && movingStem.god === '正官'
    ? stemOrder.movingFivePairs.find(pair => pair.moving.stem === '甲' && pair.targetIsDayMaster && pair.target.stem === '己')
    : undefined;
  const sunSourceSealReview = sunSeal && sunKiller && sunOutput ? {
    seal: sunSeal, killer: sunKiller, output: sunOutput,
    movingWealth: wealthControlling(sunSeal).map(wealth => ({
      wealth, fedByOutput: originalExposedOutput.filter(row => generates(remedyNatalContacts, row, wealth)),
    })),
    jiaOfficerCombination: sunJiaOfficerCombination,
  } : undefined;
  const foodKillerSourceReading = timeKnown && sealsPresent === false ? (
    stemOrder.natalPillarSequence === '癸酉辛酉己卯乙亥' ? 'liu-weak-day'
    : stemOrder.natalPillarSequence === '戊戌壬戌丙子戊戌' ? 'hu-overcontrol'
    : undefined
  ) : undefined;
  const liuSealComponents = foodKillerSourceReading === 'liu-weak-day' && ['己未', '戊午', '丁巳', '丙辰'].includes(luckPillar)
    ? remedyMovingComponents.filter(row => sealGods.includes(row.god) && generates(remedyMovingContacts, row, dayComponent))
    : [];
  const supportedSecondarySeals = remedyMovingComponents.slice(2).filter(row => sealGods.includes(row.god)
    && baziStemFeeds(movingStem.stem, row.stem) && generates(remedyMovingContacts, row, dayComponent));
  const wealthKillerContacts = contacts(wealthGods, ['七杀'], 1);
  const liuSourceWealthSeparation = foodKillerSourceReading === 'liu-weak-day' ? wealthKillerContacts.find(link =>
    link.bothExposed && link.from.position === 'year' && link.from.stem === '癸'
    && link.to.position === 'hour' && link.to.stem === '乙'
    && link.between.map(row => row.stem).join('') === '辛己') : undefined;
  const foodKillerContacts = contacts(['食神'], ['七杀'], 2);
  const foodKillerRemedyPaths = timeKnown ? foodKillerContacts.flatMap(({ from: food, to: killer }) => {
    const monthFoodWithExposedKiller = food.position === 'month' && food.kind === '支藏' && killer.kind === '透干';
    const monthKillerWithFood = killer.position === 'month' && killer.kind === '支藏';
    if (!monthFoodWithExposedKiller && !monthKillerWithFood) return [];
    const sealChecksFood = (seal: Component) => controls(remedyMovingContacts, seal, food) && generates(remedyNatalContacts, killer, seal);
    const sealsFacingFood = arrivingSeals.filter(sealChecksFood);
    const seals = monthFoodWithExposedKiller ? sealsFacingFood : [];
    const secondarySeals = monthFoodWithExposedKiller ? supportedSecondarySeals.filter(sealChecksFood)
      .map(seal => ({ source: movingStem, seal })) : [];
    const liuSourceSeals = monthFoodWithExposedKiller && food.stem === '辛' && killer.position === 'hour' && killer.stem === '乙'
      ? liuSealComponents.filter(sealChecksFood) : [];
    const owls = monthKillerWithFood ? sealsFacingFood.filter(seal => seal.god === '偏印') : [];
    const outputs = monthFoodWithExposedKiller ? leadingLuck.filter(row => outputGods.includes(row.god) && controls(remedyMovingContacts, row, killer)) : [];
    const wealth = monthFoodWithExposedKiller ? movingWealth.filter(row => generates(remedyNatalContacts, food, row)
      && generates(remedyMovingContacts, row, killer)) : [];
    if (!(seals.length || secondarySeals.length || owls.length || outputs.length || wealth.length || liuSourceSeals.length)) return [];
    const monthComponent = monthFoodWithExposedKiller ? food : killer;
    const hiddenIndex = month.hiddenStems.findIndex(row => row.stem === monthComponent.stem);
    const monthSource = { role: monthComponent.god, stem: monthComponent.stem,
      hiddenOrder: hiddenIndex + 1, mainQi: hiddenIndex === 0,
      exposedSameStem: visibleRows.filter(row => row.stem === monthComponent.stem) };
    return [{ food, killer, monthSource, seals, secondarySeals, owls, outputs, wealth, liuSourceSeals }];
  }) : [];
  const rootedFoodKillerPaths = sealsPresent === false && present(['正官']) === false
    && !remedyMovingComponents.some(row => sealGods.includes(row.god))
    && hiddenRows.some(row => row.stem === day.stem)
    ? foodKillerRemedyPaths.filter(path => path.monthSource.role === '食神' && path.monthSource.mainQi
      && hiddenRows.some(root => root.stem === path.killer.stem))
    : [];
  const hasRootedFoodKillerOutput = rootedFoodKillerPaths.some(path => path.outputs.length > 0);
  const hasRootedFoodKillerWealth = rootedFoodKillerPaths.some(path => path.wealth.length > 0);
  const foodKillerRemedyRoutes = [
    foodKillerRemedyPaths.some(path => path.seals.length > 0) && 'seal-checks-food',
    foodKillerRemedyPaths.some(path => path.secondarySeals.length > 0) && 'stem-feeds-secondary-seal',
    foodKillerRemedyPaths.some(path => path.outputs.length > 0) && 'output-checks-killer',
    foodKillerRemedyPaths.some(path => path.wealth.length > 0) && 'wealth-feeds-killer',
    foodKillerRemedyPaths.some(path => path.owls.length > 0) && 'owl-checks-month-killer-food',
  ].filter(route => typeof route === 'string');
  const wealthWithArrivingKiller = timeKnown && (originalHiddenFood.length || originalExposedOutput.length) ? monthWealth.flatMap(wealth => {
    const hiddenFoodFeedingWealth = originalHiddenFood.filter(food => baziStemFeeds(food.stem, wealth.stem));
    return arrivingOfficers.filter(killer => killer.god === '七杀' && generates(remedyNatalContacts, wealth, killer)
      && controls(remedyMovingContacts, killer, dayComponent)).map(killer => ({ wealth, killer, hiddenFoodFeedingWealth,
      hiddenFoodFacingKiller: originalHiddenFood.filter(food => controls(remedyNatalContacts, food, killer)),
      exposedOutputFacingKiller: originalExposedOutput.filter(output => controls(remedyNatalContacts, output, killer)),
    }));
  }) : [];
  const officerToMonthSeal = directedContacts(officers, monthSeals).filter(link => link.relation === '生');
  const wealthControlsMonthSeal = monthSeals.flatMap(seal => wealthControlling(seal).map(moving => ({ from: moving, to: seal })));
  const dayFeedsMovingOutput = monthSeals.length ? directedContacts([dayComponent],
    leadingLuck.filter(row => outputGods.includes(row.god))).filter(link => link.relation === '生') : [];
  const officerMonthSealRelays = officerToMonthSeal.filter(link => sealDayContacts.some(reach => reach.from === link.to && reach.relation === '生'))
    .map(link => ({ officer: link.from, seal: link.to, day: dayComponent,
      incomingWealth: wealthControlsMonthSeal.filter(hit => hit.to === link.to).map(hit => hit.from),
      incomingOutput: dayFeedsMovingOutput.map(hit => hit.to) }));
  const zhangOutput = matches('zhang') ? hiddenRows.find(row => row.position === 'hour' && row.stem === '癸' && row.god === '食神') : undefined;
  const zhangDayRoot = zhangOutput && hiddenRows.find(row => row.position === 'day' && row.stem === dayComponent.stem
    && baziStemFeeds(row.stem, zhangOutput.stem));
  const zhangSourceOutputInsteadOfSeal = timeKnown ? Boolean(zhangDayRoot) : undefined;
  const zhangPeer = !!zhangDayRoot && luckPillar === '辛丑' && movingStem.god === '比肩';
  const zhangReviewedOutput = !!zhangDayRoot && ['己亥', '庚子', '辛丑', '壬寅', '癸卯', '甲辰'].includes(luckPillar);
  const zhangReviewedRelays = zhangReviewedOutput ? officerMonthSealRelays.filter(path =>
    path.officer.position === 'year' && path.officer.stem === '丙' && path.seal.stem === '戊') : [];
  const zhangReviewedWealth = zhangReviewedRelays.some(path => path.incomingWealth.length > 0);
  const hasZhangReviewedPeerSupport = seen(zhangPeer && zhangReviewedRelays.length > 0);
  const zhangReviewedOutputSupport = ['己亥', '庚子'].includes(luckPillar)
    && zhangReviewedRelays.some(path => path.incomingOutput.includes(mainQi));
  const zhangNativeFire = zhangOutput && visibleRows.find(row => row.position === 'year' && row.stem === '丙');
  const zhangWarmth = zhangNativeFire ? {
    natalFire: zhangNativeFire,
    month: { position: month.position, pillar: month.pillar, branch: month.branch },
    movingFire: leadingLuck.filter(row => row.element === '火'),
  } : undefined;
  const exposedGuards = monthSeals.length ? sealOutputContacts.filter(link => link.bothExposed)
    .flatMap(link => directedContacts([link.to], officers).filter(pressure => pressure.relation === '克')
      .map(pressure => ({ seal: link.from, hurt: link.to, officer: pressure.to, between: link.between }))) : [];
  const wealthControlsGuard = exposedGuards.flatMap(guard => wealthControlling(guard.seal).map(moving => ({
    ...guard, moving, hurtFeedsWealth: generates(remedyNatalContacts, guard.hurt, moving),
    wealthFeedsOfficer: generates(remedyMovingContacts, moving, guard.officer),
  })));
  const zhuNamedHeavyGuard = matches('zhu');
  const linhuaiNamedGuard = matches('linhuai');
  const zhuGuardRoots = zhuNamedHeavyGuard ? exposedGuards.map(guard => ({
    seal: guard.seal,
    roots: hiddenRows.filter(row => row.element === guard.seal.element),
  })) : [];
  const zhuChecksMovingOutput = zhuNamedHeavyGuard && ['己亥', '庚子'].includes(luckPillar) ? exposedGuards.filter(guard =>
    outputGods.includes(mainQi.god) && controls(remedyNatalContacts, guard.seal, mainQi)
    && controls(remedyMovingContacts, mainQi, guard.officer)).map(guard => ({ ...guard, moving: mainQi })) : [];
  const linhuaiGuard = linhuaiNamedGuard && exposedGuards.find(guard => guard.seal.position === 'year'
    && guard.hurt.god === '食神' && guard.officer.position === 'hour');
  const linhuaiSealRoots = linhuaiGuard ? hiddenRows.filter(row => row.element === linhuaiGuard.seal.element
    && (row.position === 'year' && row.branch === '亥'
      || row.position === 'month' && row.branch === '卯' || row.position === 'hour' && row.branch === '寅')) : [];
  const linhuaiSourceSealStanding = linhuaiGuard && linhuaiGuard.seal.stem === '乙' && linhuaiSealRoots.length === 3
    ? { seal: linhuaiGuard.seal, roots: linhuaiSealRoots } : undefined;
  const linhuaiGuardComparison = linhuaiGuard ? {
    ...linhuaiGuard, sealOfficerDistance: native.findIndex(row => row.position === linhuaiGuard.officer.position) - linhuaiGuard.seal.index,
    sourceSealStanding: linhuaiSourceSealStanding,
    movingOutputAtOfficer: leadingLuck.filter(row => outputGods.includes(row.god) && controls(remedyMovingContacts, row, linhuaiGuard.officer)),
    movingAuthorityAtSeal: arrivingOfficers.filter(row => generates(remedyMovingContacts, row, linhuaiGuard.seal)),
    movingSealAtFood: arrivingSeals.filter(row => controls(remedyMovingContacts, row, linhuaiGuard.hurt)),
    chouYou: luck.branch === '丑' ? {
      day: day.pillar, luck: luckPillar,
      hiddenWealth: remedyMovingComponents.filter(row => row.kind === '运支藏干' && wealthGods.includes(row.god)),
      missingSi: !native.some(row => row.branch === '巳'),
      maoYouClash: baziInteractions(native.map(row => ({ id: row.position, pillar: row.pillar }))).pairs.find(pair =>
        pair.kind === '六冲' && pair.members.includes('month') && pair.members.includes('day')),
    } : undefined,
  } : undefined;
  const liMonthSeal = liSkeleton === true ? monthSeals.find(row => row.stem === '乙') : undefined;
  const liExposedSeal = liSkeleton === true ? visibleRows.find(row => row.position === 'month' && row.stem === '乙') : undefined;
  const liDayBlade = liSkeleton === true ? hiddenRows.find(row => row.position === 'day' && row.stem === '丁' && row.god === '劫财') : undefined;
  const liWaterLuck = liSkeleton === true && movingStem.element === '水';
  const liSourceDiagram = printedCases.find(row => row.id === 'li');
  const liNamedChart = liSourceDiagram?.matches === true;
  const liLuck = liMonthSeal && liExposedSeal && liDayBlade ? {
    monthSeal: liMonthSeal, exposedSeal: liExposedSeal, dayBlade: liDayBlade,
    sourceDiagramExact: liSourceDiagram?.matches,
    originalOutput: directedContacts([dayComponent], visibleRows.filter(row => outputGods.includes(row.god)))
      .filter(link => link.relation === '生'),
    dayFeedsMovingOutput,
    outputFeedsMovingWealth: remedyNatalContacts.filter(link => link.from.kind === '透干' && outputGods.includes(link.from.god)
      && movingWealth.includes(link.to) && link.relation === '生'),
    wealthAtMonthSeal: wealthControlling(liMonthSeal),
    movingFire: leadingLuck.filter(row => row.element === dayComponent.element),
    movingOtherFire: liNamedChart ? remedyMovingComponents.slice(2).filter(row => row.element === dayComponent.element) : undefined,
    fireGroup: [...'寅午戌'].map(branch => ({ branch, natalPositions: native.filter(row => row.branch === branch).map(row => row.position),
      inLuck: luck.branch === branch })),
    guiFoodPairs: stemOrder.movingFivePairs.filter(pair => luck.stem === '癸' && !pair.targetIsDayMaster
      && pair.target.stem === '戊' && pair.target.tenGod === '食神').flatMap(pair =>
      visibleRows.filter(row => row.position === pair.target.position && row.stem === pair.target.stem).map(food => ({
        pair, food, foodControlsGui: controls(remedyNatalContacts, food, movingStem),
        guiControlsDay: controls(remedyMovingContacts, movingStem, dayComponent),
        foodEarthRoots: hiddenRows.filter(row => row.element === food.element).map(root => ({ ...root, sameStem: root.stem === food.stem })),
      }))),
    renFeedsSeal: luck.stem === '壬' ? remedyMovingContacts.filter(link => link.from === movingStem
      && (link.to === liExposedSeal || link.to === liMonthSeal) && link.relation === '生') : [],
    renControlsDay: luck.stem === '壬' && controls(remedyMovingContacts, movingStem, dayComponent),
    renRoots: luck.stem === '壬' ? luck.hiddenStems.filter(row => row.element === movingStem.element).map(row => row.stem) : [],
    waterRootWitnesses: liWaterLuck ? [...hiddenRows, ...remedyMovingComponents.slice(1)].filter(row => row.element === movingStem.element)
      .map(root => ({ root, sameStem: root.stem === movingStem.stem })) : [],
    bladeClashes: liWaterLuck ? baziInteractions([...native.map(row => ({ id: row.position, pillar: row.pillar })),
      { id: 'decadal', pillar: luckPillar }]).pairs.filter(pair =>
      pair.kind === '六冲' && pair.members.includes('day') && pair.values.includes('午')) : [],
  } : undefined;
  const killerSealChains = (killers: Component[], seals: Component[]) => directedContacts(killers, seals)
    .filter(link => link.relation === '生').map(link => ({ killer: link.from, seal: link.to }));
  const supportingRobberies = arrivingRobbery.filter(row => row.element === dayComponent.element);
  const incomingBodySupport = [...arrivingSeals, ...supportingRobberies];
  const killerSealStructure = timeKnown && (arrivingOfficers.length || incomingBodySupport.length) ? sealDayContacts.flatMap(({ from: seal }) => {
    const killers = all.filter(row => row.god === '七杀' && baziStemControls(row.stem, dayComponent.stem) && baziStemFeeds(row.stem, seal.stem));
    return killers.length ? [{ killers, seal }] : [];
  }) : [];
  const killerSealPressure = killerSealStructure.flatMap(chain => {
    const moving = arrivingOfficers.filter(row => generates(remedyMovingContacts, row, chain.seal) && controls(remedyMovingContacts, row, dayComponent));
    return moving.length ? [{ ...chain, moving }] : [];
  });
  // Xu uses the metal and water luck periods in the Xia diagram for summer moisture.
  const xiaMonthSeal = stemOrder.natalPillarSequence === '壬寅丁未丙寅壬辰'
    ? monthSeals.find(row => row.stem === '乙') : undefined;
  const xiaWaterRoot = xiaMonthSeal && hiddenRows.find(row => row.position === 'hour' && row.stem === '癸');
  const xiaWealth = xiaMonthSeal && ['庚戌', '辛亥'].includes(luckPillar) ? wealthPressesHurtSeal.find(path =>
    path.monthHurt && path.hurt.stem === '己' && path.seal === xiaMonthSeal && path.wealth.includes(movingStem)) : undefined;
  const xiaAuthority = xiaMonthSeal && ['辛亥', '壬子', '癸丑'].includes(luckPillar) ? killerSealPressure.find(path =>
    path.seal === xiaMonthSeal && path.killers.some(row => row.kind === '透干' && row.stem === '壬')) : undefined;
  const xiaSourceWealthAuthority = xiaMonthSeal && xiaWaterRoot && (xiaWealth || xiaAuthority) ? {
    monthSeal: xiaMonthSeal, waterRoot: xiaWaterRoot, dingRenPairs: stemOrder.natalFivePairs,
    wealthPressure: xiaWealth, authorityPressure: xiaAuthority,
  } : undefined;
  const xiaSourceFavorsArrivingWealth = seen(Boolean(xiaSourceWealthAuthority?.wealthPressure));
  const xiaSourceFavorsArrivingAuthority = seen(Boolean(xiaSourceWealthAuthority?.authorityPressure));
  const maSourceStrongDayLightSeal = timeKnown ? matches('ma') : undefined;
  const maoSourceAuthorityToExposedSeal = timeKnown ? matches('mao') && killerSealPressure.some(({ seal }) =>
    seal.position === 'hour' && seal.kind === '透干' && seal.stem === '庚') : undefined;
  const boluoSourceAuthorityFeedsSeal = timeKnown ? boluoSourceSealInUse === true && killerSealPressure.some(({ seal, moving }) =>
    seal.stem === '壬' && seal.kind === '透干' && moving.some(row => row.kind === '运干'
      ? row.stem === '庚' || row.stem === '辛'
      : luck.branch === '申' || luck.branch === '酉')) : undefined;
  const boluoSourceXuWesternWealthAndSeal = seen(boluoSourceSealInUse === true && ['戊申', '己酉'].includes(luckPillar)
    && boluoWealthHitsBothExposedSeals(movingStem) && ['year', 'hour'].every(position => killerSealPressure.some(({ seal, moving }) =>
      seal.position === position && seal.stem === '壬' && seal.kind === '透干' && moving.includes(mainQi))));
  const changSourceAuthoritySealCompatible = timeKnown ? changSourceSealInUse && ['己丑', '戊子'].includes(luckPillar)
    && ['year', 'month'].every(position => killerSealPressure.some(({ seal, killers, moving }) =>
      seal.position === position && seal.kind === '透干' && seal.stem === '辛'
      && killers.some(row => row.position === 'hour' && row.kind === '透干' && row.stem === '己') && moving.includes(movingStem)))
    : undefined;
  const heSourceAuthoritySeal = timeKnown && stemOrder.natalPillarSequence === '丙寅戊戌壬戌辛丑' && ['辛丑', '甲辰'].includes(luckPillar)
    ? killerSealPressure.flatMap(({ seal, killers, moving }) => {
      const killer = killers.find(row => row.position === 'month' && row.kind === '透干' && row.stem === '戊');
      if (!killer || seal.position !== 'hour' || seal.kind !== '透干' || seal.stem !== '辛' || !moving.includes(mainQi)) return [];
      return [{ killer, seal, incomingAuthority: mainQi, day: dayComponent }];
    })[0] : undefined;
  const killerSealSupport = killerSealStructure.length ? incomingBodySupport : [];
  const killerSealSupportPaths = killerSealSupport.length ? killerSealStructure.flatMap(({ killers, seal }) => killers
    .filter(killer => killer.kind === '透干').flatMap(killer => {
      const movingSeals = arrivingSeals.filter(row => generates(remedyNatalContacts, killer, row));
      return movingSeals.length || supportingRobberies.length ? [{ killer, seal, day: dayComponent, movingSeals,
        movingRobberies: supportingRobberies }] : [];
    })) : [];
  const wealthCutsKillerSeal = (chains: ReturnType<typeof killerSealChains>) => chains.flatMap(chain =>
    wealthControlling(chain.seal).filter(moving => generates(remedyMovingContacts, moving, chain.killer)).map(moving => ({ ...chain, moving })));
  const exposedKillerSealChains = timeKnown && monthSeals.length && outputsExposed === false
    ? killerSealChains(visibleRows.filter(row => row.god === '七杀'), visibleRows.filter(row => sealGods.includes(row.god)))
      .filter(chain => baziStemControls(chain.killer.stem, dayComponent.stem) && generates(sealDayContacts, chain.seal, dayComponent))
    : [];
  const exposedKillerSealLuck = exposedKillerSealChains.map(chain => ({
    ...chain, day: dayComponent,
    wealth: wealthControlling(chain.seal).filter(row => generates(remedyMovingContacts, row, chain.killer)),
    authority: arrivingOfficers.filter(row => generates(remedyMovingContacts, row, chain.seal)
      && controls(remedyMovingContacts, row, dayComponent)),
    foodCheckedBySeal: leadingLuck.filter(row => outputGods.includes(row.god)
      && controls(remedyNatalContacts, chain.seal, row) && controls(remedyMovingContacts, row, chain.killer)),
    originalHiddenWealth: wealthSealContacts.filter(link => link.from.kind === '支藏' && link.to === chain.seal
      && baziStemFeeds(link.from.stem, chain.killer.stem)).map(link => link.from),
  }));
  const maSealChains = maSkeleton === true ? killerSealChains(visibleRows.filter(row => row.stem === '戊'), monthSeals.filter(row => row.stem === '庚'))
    .filter(chain => generates(sealDayContacts, chain.seal, dayComponent)) : [];
  const maWealth = wealthCutsKillerSeal(maSealChains);
  const maZi = maSealChains.length > 0 && luck.branch === '子' && groupComplete === true && nativeGroupComplete === false;
  const maOriginalOutput = maSealChains.length ? all.filter(row => outputGods.includes(row.god) && baziStemFeeds(dayComponent.stem, row.stem)) : [];
  const maLuck = maSealChains.length ? {
    day: dayComponent, originalOutput: maOriginalOutput, movingOutput: dayFeedsMovingOutput.map(link => link.to),
    peersWithOriginalOutput: maOriginalOutput.length ? leadingLuck.filter(row => row.element === dayComponent.element) : [],
    nativeWater: hiddenRows.filter(row => row.element === dayComponent.element).map(root => ({ root, sameStem: root.stem === dayComponent.stem })),
  } : undefined;
  const nativeWealthToMonthSeal = wealthSealContacts.filter(link => monthSeals.includes(link.to));
  const lightSealWealthContrast = matches('light-seal-wealth') ? nativeWealthToMonthSeal.flatMap(({ from: wealth, to: seal }) => {
    if (wealth.position !== 'month' || wealth.kind !== '透干') return [];
    const robbery = visibleRows.find(row => row.position === 'hour' && row.god === '劫财' && baziStemControls(row.stem, wealth.stem));
    const killer = visibleRows.find(row => row.position === 'year' && row.god === '七杀' && baziStemFeeds(row.stem, seal.stem));
    return robbery && killer ? [{ robbery, wealth, killer, seal, incomingWealth: wealthControlling(seal) }] : [];
  }) : undefined;
  const hasLightSealSourceWealthPressure = seen(lightSealWealthContrast?.some(path => path.incomingWealth.length > 0) === true);
  const peerChecksWealth = nativeWealthToMonthSeal.flatMap(link => leadingLuck
    .filter(moving => (moving.god === '比肩' || moving.god === '劫财') && controls(remedyMovingContacts, moving, link.from))
    .map(moving => ({ moving, wealth: link.from, seal: link.to })));
  const robberyChecksWealth = peerChecksWealth.filter(row => row.moving.god === '劫财');
  const companionChecksWealth = peerChecksWealth.filter(row => row.moving.god === '比肩');
  const sealsHelpWithWealth = nativeWealthToMonthSeal.length ? arrivingSeals.map(moving => ({
    moving, day: dayComponent, pressures: nativeWealthToMonthSeal.filter(link => controls(remedyNatalContacts, link.from, moving)),
  })) : [];
  const wealthFeedsLuckOfficer = nativeWealthToMonthSeal.flatMap(link => arrivingOfficers.filter(moving =>
    generates(remedyNatalContacts, link.from, moving) && generates(remedyMovingContacts, moving, link.to))
    .map(moving => ({ wealth: link.from, moving, seal: link.to })));
  const nativeSealColumns = [...new Set(originalSealPositions.map(row => row.position))];
  const movingOutputFeedsWealth = nativeWealthToMonthSeal.flatMap(link => leadingLuck.filter(moving =>
    outputGods.includes(moving.god) && generates(remedyMovingContacts, moving, link.from))
    .map(moving => ({ moving, wealth: link.from, seal: link.to })));
  const multipleSealWealthPaths = nativeSealColumns.length >= 2 ? nativeWealthToMonthSeal.map(link => ({
    wealth: link.from, seal: link.to,
    movingWealth: wealthControlsMonthSeal.filter(row => row.to === link.to).map(row => row.from),
    movingOutput: movingOutputFeedsWealth.filter(row => row.wealth === link.from && row.seal === link.to).map(row => row.moving),
  })).filter(path => path.movingWealth.length || path.movingOutput.length) : [];
  const linSenVariant = matches('lin-sen-you') ? '酉时' : matches('lin-sen-shen') ? '申时异文' : undefined;
  const sealDiagramRelations = linSenVariant || wealthySonVariant ? baziInteractions(native.map(row => ({ id: row.position, pillar: row.pillar }))) : undefined;
  const easternMeeting = sealDiagramRelations?.groups.find(row => row.kind === '三会' && row.values === '寅卯辰');
  const clash = linSenVariant && sealDiagramRelations?.pairs.find(row => row.kind === '六冲' && row.members.includes('hour')
    && row.members.includes(linSenVariant === '酉时' ? 'day' : 'month'));
  const linSenWealth = linSenVariant && nativeWealthToMonthSeal.find(({ from, to }) =>
    from.position === 'hour' && from.kind === '支藏' && from.stem === (linSenVariant === '酉时' ? '辛' : '庚') && to.stem === '甲');
  const linSenExposedSeal = linSenVariant && visibleRows.find(row => row.position === 'month' && row.stem === '甲');
  const linSenSealComparison = linSenVariant && easternMeeting && clash && linSenWealth && linSenExposedSeal ? {
    variant: linSenVariant, easternMeeting, clash, wealth: linSenWealth.from, seal: linSenWealth.to, exposedSeal: linSenExposedSeal,
    incomingWealth: wealthControlling(linSenWealth.to),
  } : undefined;
  const wealthySonMonthSeal = wealthySonVariant && monthSeals.find(row => row.stem === '甲');
  const wealthySonClashes = wealthySonVariant ? sealDiagramRelations?.pairs.filter(row => row.kind === '六冲'
    && row.members.includes('month') && (row.values === '申寅' || row.values === '寅申')) ?? [] : [];
  const wealthySonYiGeng = wealthySonVariant && stemOrder.natalFivePairs.find(row => row.first.position === 'year'
    && row.first.stem === '庚' && row.second.position === 'hour' && row.second.stem === '乙');
  const wealthySonMaoSeal = wealthySonVariant && luckPillar === '己卯'
    ? arrivingSeals.find(row => row.kind === '运支藏干' && row.stem === '乙') : undefined;
  const wealthySonMovingWealth = wealthySonMonthSeal && ['庚辰', '辛巳'].includes(luckPillar) ? wealthControlling(wealthySonMonthSeal) : [];
  const wealthySonSealComparison = wealthySonMonthSeal && wealthySonYiGeng && wealthySonClashes.length === 2
    && (wealthySonMaoSeal || wealthySonMovingWealth.length) ? {
      seal: wealthySonMonthSeal, clashes: wealthySonClashes, yiGeng: wealthySonYiGeng,
      hiddenPeers: hiddenRows.filter(row => row.god === '比肩' || row.god === '劫财'),
      incomingSeal: wealthySonMaoSeal, incomingWealth: wealthySonMovingWealth,
    } : undefined;
  const luckStemRoots = luck.hiddenStems.filter(row => row.element === luck.stemElement).map(row => row.stem);
  const wangNamedLightWealth = matches('wang');
  const wangBingXin = wangNamedLightWealth ? {
    pairs: stemOrder.natalFivePairs.filter(({ first, second }) =>
      first.position === 'year' && first.stem === '辛' && second.position === 'month' && second.stem === '丙'
      || first.position === 'month' && first.stem === '丙' && second.position === 'hour' && second.stem === '辛'),
    southeastLuck: ['乙未', '甲午', '癸巳'].includes(luckPillar)
      ? remedyMovingComponents.filter(row => row.element === '木' || row.element === '火') : [],
  } : undefined;
  const wangSiWealth = wangNamedLightWealth && luckPillar === '癸巳' && mainQi.stem === '丙' && !luckStemRoots.length ? mainQi : undefined;
  const wangChenRoot = wangNamedLightWealth && luckPillar === '壬辰' && luckStemRoots.includes('癸') ? '癸' : undefined;
  const wangNativeWealth = wangNamedLightWealth ? nativeWealthToMonthSeal.find(({ from, to }) =>
    from.position === 'month' && from.kind === '透干' && from.stem === '丙' && to.stem === '庚') : undefined;
  const wangWoodLuck = wangNativeWealth && ['辛卯', '庚寅'].includes(luckPillar) && mainQi.element === '木'
    && !luckStemRoots.length && baziStemFeeds(mainQi.stem, wangNativeWealth.from.stem) ? mainQi : undefined;
  const wangWoodRelief = wangWoodLuck && wangNativeWealth
    ? { output: wangWoodLuck, wealth: wangNativeWealth.from, seal: wangNativeWealth.to } : undefined;
  const wangYiWeiWealth = wangNativeWealth && luckPillar === '乙未' && mainQi.stem === '己'
    ? remedyMovingComponents.slice(2).find(row => row.stem === '丁' && baziStemFeeds(movingStem.stem, row.stem)
      && controls(remedyMovingContacts, row, wangNativeWealth.to)) : undefined;
  const wangYiWeiRelief = wangYiWeiWealth && wangNativeWealth
    ? { output: movingStem, wealth: wangYiWeiWealth, seal: wangNativeWealth.to, branchMainQi: mainQi } : undefined;
  const wangSoutheast = wangBingXin && (luckPillar === '癸巳' ? Boolean(wangSiWealth)
    : wangBingXin.southeastLuck.some(row => row.element === '木') && wangBingXin.southeastLuck.some(row => row.element === '火'));
  const wangSourceWealthReduction = wangNativeWealth && wangSoutheast && wealthControlling(wangNativeWealth.to).includes(mainQi)
    && (luckPillar === '甲午' && mainQi.stem === '丁' && baziStemFeeds(movingStem.stem, mainQi.stem) || wangSiWealth === mainQi)
    ? { moving: mainQi, seal: wangNativeWealth.to, originalWealth: wangNativeWealth.from } : undefined;
  const natalKillers = visibleRows.filter(row => row.god === '七杀');
  const authoritySealPaths = monthSeals.length && officers.length && natalKillers.length ? originalSealPositions.flatMap(seal => {
    const feedingOfficers = officers.filter(row => baziStemFeeds(row.stem, seal.stem));
    const feedingKillers = natalKillers.filter(row => baziStemFeeds(row.stem, seal.stem));
    if (!feedingOfficers.length || !feedingKillers.length) return [];
    return [{
      seal, day: dayComponent, officers: feedingOfficers, killers: feedingKillers,
      moving: arrivingOfficers.filter(row => generates(remedyMovingContacts, row, seal)),
      movingWealth: wealthControlling(seal).map(wealth => ({
        wealth, feeds: [...feedingOfficers, ...feedingKillers].filter(row => generates(remedyMovingContacts, wealth, row)),
      })).filter(row => row.feeds.length),
    }];
  }) : [];
  const natalAuthoritySeal = authoritySealPaths.filter(path => path.seal.kind === '透干');
  const hasUnopposedAuthorityToExposedSeal = timeKnown ? natalAuthoritySeal.some(path =>
    path.moving.length > 0 && !remedyMovingComponents.some(row => wealthGods.includes(row.god)
      && controls(remedyMovingContacts, row, path.seal))) : undefined;
  const natalAuthorityCombinations = monthSeals.length && officers.length && natalKillers.length ? stemOrder.natalKillPairs : [];
  const jiaChenMonthPaths = matches('officer-killer-seal') ? authoritySealPaths.filter(path =>
    path.seal.position === 'month' && path.seal.kind === '支藏') : [];
  const jiaChenOutputPath = originalExposedOutput.length === 0 && !hiddenRows.some(row => outputGods.includes(row.god))
    ? jiaChenMonthPaths.find(path => path.seal.stem === '癸'
      && path.officers.some(row => row.position === 'year' && row.stem === '辛')
      && path.killers.some(row => row.position === 'month' && row.stem === '庚'))
    : undefined;
  const jiaChenOutputLuck = jiaChenOutputPath ? dayFeedsMovingOutput.map(({ from: day, to: output }) => ({
    day, output, seal: jiaChenOutputPath.seal,
    checksAuthority: [...jiaChenOutputPath.officers, ...jiaChenOutputPath.killers]
      .filter(authority => controls(remedyMovingContacts, output, authority)),
    movingAuthorityToSameSeal: jiaChenOutputPath.moving,
  })) : [];
  const jiaChenSupportingBranch = jiaChenOutputPath
    && (mainQi.element === dayComponent.element || generates(remedyMovingContacts, mainQi, dayComponent)) ? {
      day: dayComponent, seal: jiaChenOutputPath.seal, branchQi: mainQi,
      assistingStems: leadingLuck.filter(row => row.kind === '运干'
        && (row.element === dayComponent.element || generates(remedyMovingContacts, row, dayComponent))),
      competingWealth: jiaChenOutputPath.movingWealth.map(row => row.wealth),
      competingAuthority: jiaChenOutputPath.moving,
    } : undefined;
  const jiaChenAuthorityComparison = jiaChenMonthPaths.length ? {
    monthPaths: jiaChenMonthPaths,
    wuXu: luckPillar === '戊戌',
    outputLuck: jiaChenOutputLuck,
    supportingBranch: jiaChenSupportingBranch,
  } : undefined;
  const jiaChenWealthPressesMonthSeal = jiaChenOutputPath?.movingWealth.some(({ feeds }) =>
    feeds.some(row => row.god === '正官') && feeds.some(row => row.god === '七杀'));
  const coldBingMonthPath = matches('cold-bing') ? authoritySealPaths.find(({ seal }) =>
    seal.position === 'month' && seal.kind === '支藏' && seal.stem === '乙') : undefined;
  const coldBingSourceSealInUse = timeKnown ? Boolean(coldBingMonthPath) : undefined;
  const coldBingSealComparison = coldBingMonthPath ? {
    ...coldBingMonthPath,
    fireRoots: hiddenRows.filter(row => row.element === dayComponent.element),
    nativeControl: all.filter(row => row.position === 'hour' && row.kind === '透干' && row.stem === '己'
      && [...coldBingMonthPath.officers, ...coldBingMonthPath.killers].every(authority => baziStemControls(row.stem, authority.stem))),
    movingStemControl: ['戊', '己'].includes(movingStem.stem)
      && [...coldBingMonthPath.officers, ...coldBingMonthPath.killers].every(authority => baziStemControls(movingStem.stem, authority.stem))
      ? movingStem : undefined,
    movingAuthorityPressure: coldBingMonthPath.moving.filter(row => controls(remedyMovingContacts, row, dayComponent)),
    movingWealthPressure: coldBingMonthPath.movingWealth.filter(({ feeds }) =>
      feeds.some(row => row.god === '正官') && feeds.some(row => row.god === '七杀')),
  } : undefined;
  const coldBingBranchAuthorityWithWealth = timeKnown ? luckPillar === '辛亥'
    && coldBingSealComparison?.movingAuthorityPressure.includes(mainQi) === true
    && coldBingSealComparison.movingWealthPressure.some(path => path.wealth === movingStem) : undefined;
  const niuNamedHeavySeal = matches('niu');
  const dayFeedsOriginalOutput = monthSeals.length && (wealthControlsMonthSeal.length || niuNamedHeavySeal)
    ? directedContacts([dayComponent], all.filter(row => outputGods.includes(row.god))).filter(link => link.relation === '生') : [];
  const outputWealthSealPaths = dayFeedsOriginalOutput.flatMap(fromDay => wealthControlsMonthSeal
    .filter(link => generates(remedyNatalContacts, fromDay.to, link.from))
    .map(link => ({ day: fromDay.from, output: fromDay.to, wealth: link.from, seal: link.to })));
  const exposedOutputWealthToMonthSeal = outputWealthSealPaths.filter(path => path.output.kind === '透干'
    && path.seal.stem === month.hiddenStems[0]?.stem);
  const hasGuardOutputWealthToSeal = wealthControlsGuard.some(guard => guard.hurtFeedsWealth && guard.wealthFeedsOfficer
    && exposedOutputWealthToMonthSeal.some(path => path.output === guard.hurt && path.wealth === guard.moving));
  const niuWealth = niuNamedHeavySeal && visibleRows.find(row => row.position === 'hour' && row.stem === '丙');
  const niuSeal = niuNamedHeavySeal && visibleRows.find(row => row.position === 'year' && row.stem === '庚');
  const niuLuck = niuWealth && niuSeal ? {
    foodWealth: directedContacts(visibleRows.filter(row => row.position === 'month' && row.stem === '乙'), [niuWealth])
      .filter(link => link.relation === '生'),
    yiGeng: stemOrder.natalFivePairs.find(pair => [pair.first.stem, pair.second.stem].sort().join('') === '乙庚'),
    wealthRoots: hiddenRows.filter(row => row.position === 'year' && row.element === niuWealth.element)
      .map(root => ({ source: niuWealth, root, sameStem: root.stem === niuWealth.stem })),
    sealRoots: monthSeals.filter(row => row.element === niuSeal.element)
      .map(root => ({ source: niuSeal, root, sameStem: root.stem === niuSeal.stem })),
    peerRoots: ['亥', '子', '丑'].includes(luck.branch) ? remedyMovingComponents.slice(1).filter(row => row.element === dayComponent.element) : [],
    seals: arrivingSeals,
    incomingWealth: outputWealthSealPaths.filter(path => path.output.position === 'month' && path.output.kind === '透干'),
  } : undefined;
  const niuContrast = niuLuck && niuLuck.foodWealth.length > 0 && (
    ['戊子', '己丑'].includes(luckPillar) && niuLuck.peerRoots.length > 0
    || luckPillar === '丁亥' && niuLuck.peerRoots.length > 0 && niuLuck.incomingWealth.length > 0
    || ['庚寅', '辛卯'].includes(luckPillar) && niuLuck.seals.length > 0 && dayFeedsMovingOutput.some(link => link.to === mainQi));
  const hasNiuSourceFoodWealthReducingHeavySeal = seen(Boolean(niuLuck && luckPillar === '丁亥'
    && niuLuck.incomingWealth.some(path => path.output.stem === '乙' && path.output.god === '食神'
      && path.wealth === movingStem && path.wealth.stem === '丁' && path.seal.stem === '辛')));
  const sourceHurtWealthCase = timeKnown ? zpqzHurtWealthCases.find(row => row.pillars.join('') === stemOrder.natalPillarSequence) : undefined;
  const sourceHurtWealthPair = sourceHurtWealthCase ? wealthSealContacts.find(pair => pair.bothExposed
    && pair.from.stem === '壬' && pair.to.stem === '丁' && pair.between.length === 2) : undefined;
  const chancellorSourceWealth = sourceHurtWealthCase?.id === 'seal-heavy' && sourceHurtWealthPair
    && ['辛亥', '壬子', '癸丑'].includes(luckPillar) ? wealthControlling(sourceHurtWealthPair.to) : [];
  const sourceHurtWealthSeal = sourceHurtWealthCase && sourceHurtWealthPair ? {
    name: sourceHurtWealthCase.name,
    role: sourceHurtWealthCase.id === 'wealth-heavy' ? 'separated' : 'remedy',
    wealth: sourceHurtWealthPair.from,
    seal: sourceHurtWealthPair.to,
    between: sourceHurtWealthPair.between,
    robberies: robberyAgainstSealWealth.filter(row => row.natalWealthPaths.some(path =>
      path.wealth === sourceHurtWealthPair.from && path.seal === sourceHurtWealthPair.to)).map(row => row.robbery),
    printedSupport: sourceHurtWealthCase.id === 'wealth-heavy' && luckPillar === '丁未'
      ? remedyMovingComponents.filter(row => row.stem === '丁')
      : sourceHurtWealthCase.id === 'seal-heavy' && luckPillar === '癸丑'
        ? remedyMovingComponents.filter(row => row.stem === '癸') : chancellorSourceWealth,
  } : undefined;
  const wealthHeavySourceHurtSealPressure = timeKnown ? sourceHurtWealthSeal?.role === 'separated' && luckPillar === '癸卯'
    && movingStem.stem === '癸' && wealthPressesHurtSeal.some(path => path.monthHurt && path.hurt.stem === '辛'
      && path.seal === sourceHurtWealthSeal.seal && path.wealth.includes(movingStem)) : undefined;
  const hasChancellorSourceRobberyToUsedWealth = sourceHurtWealthSeal?.role === 'remedy' && luckPillar === '癸丑'
    && robberyAgainstSealWealth.some(({ robbery, natalWealthPaths, movingWealthPaths }) => robbery === mainQi
      && natalWealthPaths.some(path => path.wealth === sourceHurtWealthSeal.wealth && path.seal === sourceHurtWealthSeal.seal)
      && movingWealthPaths.some(path => path.wealth === movingStem && path.seal === sourceHurtWealthSeal.seal));
  const sourceWealthRole = !timeKnown ? undefined : sourceHurtWealthSeal?.role
    ?? (linSenSealComparison || wangNamedLightWealth || niuNamedHeavySeal ? 'remedy'
      : namedLightSeal || wuSourceWealthTooStrong || changSourceSealInUse ? 'disease' : 'undetermined');
  // The printed natal reading remains the same when the live luck pillar changes.
  const sourceHurtSealUse = !timeKnown ? undefined : liEarthOutputSourceDiagram ? 'not-used'
    : sourceWealthRole === 'remedy' ? 'reduce-seal'
    : boluoSourceSealInUse || fanSourceSealInUse || qianSourceSealInUse || coldBingSourceSealInUse || matches('light-seal-wealth') ? 'used'
    : 'undetermined';
  const sealLuckRoutes = [
    !zhangDayRoot && !zhuNamedHeavyGuard && !linhuaiNamedGuard && !jiaChenOutputPath && !coldBingMonthPath
      && officerMonthSealRelays.some(path => path.incomingWealth.length || path.incomingOutput.length) && 'officer-seal-wealth-output',
    zhangReviewedOutput && 'zhang-reviewed-output',
    wealthControlsGuard.length > 0 && 'wealth-controls-guard',
    zhuChecksMovingOutput.length > 0 && 'zhu-seal-checks-output',
    liLuck && (liLuck.dayFeedsMovingOutput.length > 0 || liLuck.outputFeedsMovingWealth.length > 0) && 'li-wealth-output',
    liNamedChart && liLuck && liLuck.movingFire.length > 0 && 'li-named-fire',
    liLuck && liLuck.guiFoodPairs.some(row => row.foodControlsGui && row.guiControlsDay) && 'li-gui-combines-food',
    liLuck && liLuck.renFeedsSeal.length > 0 && liLuck.renControlsDay && 'li-ren-feeds-seal',
    anyExposed(wealthGods) === false && exposedKillerSealLuck.some(chain => chain.wealth.length > 0)
      && 'wealth-cuts-exposed-killer-seal',
    anyExposed(wealthGods) === false && exposedKillerSealLuck.some(chain => chain.authority.length > 0 || chain.foodCheckedBySeal.length > 0)
      && 'authority-or-output-with-exposed-killer-seal',
    maWealth.length > 0 && 'ma-wealth-cuts-month-seal',
    maZi && 'ma-zi-completes',
    maLuck && (maLuck.movingOutput.length || maLuck.peersWithOriginalOutput.length) && 'ma-output-or-peer',
    !namedHeavySeal && (robberyChecksWealth.length > 0 || sealsHelpWithWealth.length > 0 || wealthFeedsLuckOfficer.length > 0)
      && 'robbery-seal-or-authority-against-wealth',
    !namedHeavySeal && !wealthySonMovingWealth.length && companionChecksWealth.length > 0 && 'companion-checks-natal-wealth',
    wealthySonSealComparison?.incomingSeal && 'wealthy-son-mao-helps-seal',
    wealthySonSealComparison && wealthySonSealComparison.incomingWealth.length > 0 && 'wealthy-son-wealth-presses-light-seal',
    !namedLightSeal && multipleSealWealthPaths.length > 0 && 'wealth-reaches-multiple-seals',
    linSenSealComparison && linSenSealComparison.incomingWealth.length > 0 && 'lin-sen-wealth-reduces-heavy-seal',
    (wangChenRoot || wangWoodLuck || wangSoutheast) && 'wang-luck-contrast',
    (wangWoodLuck || wangSoutheast) && 'wang-wealth-relief',
    natalAuthoritySeal.some(row => row.moving.length) && 'officer-killer-feed-exposed-seal',
    natalAuthoritySeal.some(row => row.movingWealth.length) && 'wealth-presses-exposed-authority-seal',
    jiaChenWealthPressesMonthSeal && (jiaChenAuthorityComparison?.wuXu
      ? 'jia-chen-wu-xu-hidden-seal' : 'jia-chen-wealth-presses-month-seal'),
    jiaChenOutputLuck.length > 0 && 'jia-chen-output-drains-day',
    jiaChenSupportingBranch && !jiaChenSupportingBranch.competingWealth.length
      && !jiaChenSupportingBranch.competingAuthority.length && 'jia-chen-supporting-branch',
    coldBingSealComparison && coldBingSealComparison.movingAuthorityPressure.length > 0 && 'cold-bing-hidden-seal-authority',
    coldBingSealComparison && coldBingSealComparison.movingWealthPressure.length > 0 && 'cold-bing-hidden-seal-wealth',
    !namedHeavySeal && !linhuaiSourceSealStanding && !namedLightSeal && !maSourceStrongDayLightSeal
      && !coldBingMonthPath && !fanSourceSealInUse
      && outputWealthSealPaths.length > 0 && 'wealth-presses-seal-with-output',
    niuContrast && 'niu-luck-contrast',
  ].filter(route => typeof route === 'string');
  return { profile: zpqzSealFoodPolicy.profile, timeKnown, dayMaster: natal.day[0], monthPillar: natal.month, monthBranch: natal.month[1],
    sourceDecisionProfile: zpqzSealFoodPolicy.generalRemedy,
    natalPillarSequence: stemOrder.natalPillarSequence, zhaoSourceMonthSealNotTaken,
    dayPillar: natal.day, natalPillars: native.map(p => ({ position: p.position, pillar: p.pillar })), gods, monthHiddenGods: month.hiddenStems.map(h => h.tenGod!),
    monthSealCandidate: month.hiddenStems.some(h => sealGods.includes(h.tenGod!)), monthOfficerCandidate: month.hiddenStems.some(h => h.tenGod === '正官'),
    monthWealthCandidate: month.hiddenStems.some(h => wealthGods.includes(h.tenGod!)),
    monthFoodCandidate: month.hiddenStems.some(h => h.tenGod === '食神'), monthKillerCandidate: month.hiddenStems.some(h => h.tenGod === '七杀'),
    monthHurtCandidate: month.hiddenStems.some(h => h.tenGod === '伤官'), foodPresent: present(['食神']), hurtPresent: present(['伤官']),
    killerPresent: present(['七杀']), killerExposed: anyExposed(['七杀']),
    sealsPresent, sealsExposed, sealsHidden, officerExposed: anyExposed(['正官']), hurtExposed, hurtHidden, foodHidden, outputsExposed,
    wealthPresent: present(wealthGods), wealthExposed: anyExposed(wealthGods), wealthHidden: anyHidden(wealthGods),
    sealExposedHurtOnlyHidden: conjunction(sealsExposed, hurtHidden, not(hurtExposed)),
    hurtExposedSealOnlyHidden: conjunction(hurtExposed, sealsHidden, not(sealsExposed)),
    hiddenFoodNoExposedOutputs: conjunction(foodHidden, not(outputsExposed)),
    exposedOfficerAndHurt: conjunction(anyExposed(['正官']), hurtExposed),
    exposedOfficerAndOutput: conjunction(anyExposed(['正官']), outputsExposed), hasOutput: present(outputGods),
    officerAndKillerPresent: conjunction(present(['正官']), present(['七杀'])),
    officerAndKillerExposed: conjunction(anyExposed(['正官']), anyExposed(['七杀'])),
    liSkeleton, maoSkeleton, maSkeleton, sealLuckRoutes, namedHeavySeal, namedLightSeal, sourceWealthRole, sourceHurtWealthSeal, sourceHurtSealUse,
    hasChancellorSourceRobberyToUsedWealth,
    hasChancellorSourceWealthSupport: timeKnown ? chancellorSourceWealth.length > 0 : undefined,
    hasWangSourceWealthReducingHeavySeal: timeKnown ? Boolean(wangSourceWealthReduction) : undefined,
    hasWangSourceYiWeiWoodFire: seen(Boolean(wangYiWeiRelief)), hasWangSourceWoodFeedingWealth: seen(Boolean(wangWoodRelief)),
    hasNiuSourceFoodWealthReducingHeavySeal,
    sunSourceSealReview, sunSourceSealInUse: seen(Boolean(sunSourceSealReview)),
    sunSourceJiaOfficerCombinesDay: seen(Boolean(sunJiaOfficerCombination)),
    maSourceStrongDayLightSeal, maoSourceAuthorityToExposedSeal, boluoSourceAuthorityFeedsSeal,
    zhuNamedHeavyGuard, linhuaiGuardComparison, jiaChenAuthorityComparison, coldBingSealComparison, coldBingSourceSealInUse,
    coldBingBranchAuthorityWithWealth,
    linhuaiChouWealthComparison: Boolean(linhuaiGuardComparison?.chouYou),
    linhuaiSourceSealStrong: timeKnown ? Boolean(linhuaiSourceSealStanding) : undefined,
    sealLuckEvidence: monthSeals.length ? { officerToMonthSeal, wealthControlsMonthSeal, dayFeedsMovingOutput, zhangOutput, zhangPeer, wealthControlsGuard,
      officerMonthSealRelays, zhangDayRoot, zhangWarmth, zhuGuardRoots, zhuChecksMovingOutput, liLuck, exposedKillerSealLuck, maSealChains,
      maWealth, maZi, maLuck, robberyChecksWealth, companionChecksWealth, sealsHelpWithWealth, wealthFeedsLuckOfficer,
      originalSealPositions, nativeSealColumns, movingOutputFeedsWealth, multipleSealWealthPaths, wangNamedLightWealth, lightSealWealthContrast,
      linSenSealComparison, wealthySonSealComparison,
      wangBingXin, wangSiWealth, wangChenRoot, wangWoodLuck, wangWoodRelief, wangYiWeiRelief, wangSourceWealthReduction,
      natalAuthoritySeal, natalAuthorityCombinations,
      dayFeedsOriginalOutput, outputWealthSealPaths, niuLuck } : undefined,
    sealOutputContacts, wealthSealContacts,
    officerSealContacts: contacts(['正官', '七杀'], sealGods, 1), roots: stemOrder.roots,
    companionWealthContacts: contacts(['比肩', '劫财'], wealthGods, 2), foodKillerContacts, foodKillerRemedyPaths, foodKillerRemedyRoutes,
    hasRootedFoodKillerOutput, hasRootedFoodKillerWealth,
    foodKillerSourceReading, liuSourceWealthSeparation,
    foodKillerLiuSeal: Boolean(liuSourceWealthSeparation && foodKillerRemedyPaths.some(path => path.liuSourceSeals.length > 0)),
    foodKillerNamedStrongExcluded: timeKnown ? Boolean(foodKillerSourceReading) : undefined,
    outputWealthContacts: contacts(outputGods, wealthGods, 1), wealthKillerContacts,
    sealDayContacts, remedyMovingComponents,
    robberyAgainstSealWealth, hasRobberyWithSeal: robberyAgainstSealWealth.length > 0,
    hasRobberyAgainstNatalSealWealth: robberyAgainstSealWealth.some(path => path.natalWealthPaths.length > 0),
    hasGuardOutputWealthToSeal, hasExposedOutputWealthToMonthSeal: exposedOutputWealthToMonthSeal.length > 0,
    hasZhangReviewedWealth: seen(zhangReviewedWealth), hasZhangReviewedOutputSupport: seen(zhangReviewedOutputSupport),
    hasZhangReviewedPeerSupport, zhangSourceOutputInsteadOfSeal, hasLightSealSourceWealthPressure,
    hasWuSourceRobberyProtectingSeal, changSourceRobberyProtectingSeal, changSourceAuthoritySealCompatible,
    heSourceAuthoritySealCompatible: seen(Boolean(heSourceAuthoritySeal)), heSourceAuthoritySeal,
    autumnWoodSourceNotWeak: timeKnown ? Boolean(autumnWoodSupport) : undefined, autumnWoodSupport,
    wealthPressesHurtSeal, hasWealthPressingHurtSeal: wealthPressesHurtSeal.length > 0, liEarthOutputSourceWealth,
    zhouSourceRobberyDispute, hasZhouSourceRobberyDispute: seen(Boolean(zhouSourceRobberyDispute)),
    zhouSourceWealthOutput, hasZhouSourceWealthOutput: seen(Boolean(zhouSourceWealthOutput)),
    xiaSourceWealthAuthority, xiaSourceFavorsArrivingWealth, xiaSourceFavorsArrivingAuthority,
    qianSourceWealthSealPressure, hasQianSourceWealthSealPressure,
    boluoSourceSealInUse, fanSourceSealInUse, wealthHeavySourceHurtSealPressure,
    boluoSourceXuWealthPressure, boluoSourceXuWesternWealthAndSeal,
    hasUnopposedAuthorityToExposedSeal,
    hasWealthPressingMonthHurtSeal: wealthPressesHurtSeal.some(path => path.monthHurt),
    exposedOfficerWealthSeal, hasExposedOfficerWealthSeal: exposedOfficerWealthSeal.length > 0, convertedWealthPrintedExample,
    namedHurtingOfficerPeer: Boolean(namedHurtingOfficerPeerEvidence), namedHurtingOfficerPeerEvidence,
    monthOfficerSealLuck, officerSealExposureRoutes,
    hasAuthorityFeedingExposedGuard: officerSealExposureRoutes.includes('shown-seal-hidden-hurt-authority'),
    killerSealPressure, hasKillerSealPressure: killerSealPressure.length > 0, killerSealSupport, killerSealSupportPaths,
    wealthWithArrivingKiller, hasHiddenFoodWealthKillerPath: outputsExposed === false && wealthWithArrivingKiller.some(path => path.hiddenFoodFeedingWealth.length > 0),
    remedyMovingContacts, remedyNatalContacts,
    movingFivePairs: stemOrder.movingFivePairs, liGuiCombinesExposedFood: luck.stem === '癸' && stemOrder.movingFivePairs.some(p => !p.targetIsDayMaster && p.target.stem === '戊' && p.target.tenGod === '食神'),
    shenZiChen, groupComplete, nativeGroupComplete,
    groupCompletedByLuck: groupComplete === false || nativeGroupComplete === true ? false : groupComplete === true && nativeGroupComplete === false ? true : undefined,
    printedCases,
    luckPillar, luckStem: luck.stem, luckBranch: luck.branch, luckTenGod: luck.tenGod,
    luckBranchMainQiGod: luck.hiddenStems[0]?.tenGod, protectionVerified: false, strengthVerified: false,
    visibilityInterpretationVerified: false, transformationVerified: false };
}
