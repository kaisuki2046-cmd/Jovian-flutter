import { baziInteractions, baziStemControls, baziStemFeeds, describeBaZiPillar } from './bazi-calculation';
import { zpqzMonthPositions } from './bazi-zpqz-month';
import { zpqzSealReturnBranch } from './bazi-zpqz';

const positions = ['year', 'month', 'day', 'hour'] as const, elements = '木火土金水';
const metalRootBranches: Readonly<Record<string, string>> = { 辛: '酉', 庚: '申' };
const sourceRootlessPillars = new Set(['庚寅', '庚午', '丙子', '丙申']);
const sourceGeneratingPillars = new Set(['庚辰', '辛丑', '丙寅', '丁卯']);
type Natal = Record<typeof positions[number], string>;
export const zpqzStemBranchPolicy = {
  profile: 'zpqz-stem-branch-components-and-exact-return-clashes-v1',
  scope: 'one-natal-and-luck-stage; annual-fragment-preserved-by-parent-fact',
  contacts: 'actual-visible-and-hidden-components-not-effective-remedy-or-branch-transformation',
  returnClash: 'Shen-Yin-or-You-Mao-must-be-the-same-pair; Wei-is-a-separate-source-branch',
  fire: 'Wu-hidden-Ding-Ji-and-real-Yin-Wu-Xu-members-not-a-guessed-complete-fire-frame',
} as const;

export function baziZpqzStemBranch(natal: Natal, timeKnown: boolean, luckPillar: string) {
  const native = positions.flatMap((position, index) => position === 'hour' && !timeKnown ? []
    : [{ position: position as string, index, ...describeBaZiPillar(natal[position], natal.day[0]) }]);
  const luck = describeBaZiPillar(luckPillar, natal.day[0]);
  const seen = (yes: boolean) => yes ? true : timeKnown ? false : undefined;
  const exposed = native.filter(row => row.position !== 'day').map(row => ({ position: row.position, index: row.index,
    pillar: row.pillar, stem: row.stem, branch: row.branch, god: row.tenGod!, element: row.stemElement, kind: '透干' }));
  const hidden = native.flatMap(row => row.hiddenStems.map(h => ({ position: row.position, index: row.index,
    pillar: row.pillar, branch: row.branch, stem: h.stem, god: h.tenGod!, element: h.element, kind: '支藏' })));
  const day = native.find(row => row.position === 'day')!;
  const dayRow = { position: 'day', index: 2, pillar: day.pillar, stem: day.stem, branch: day.branch, god: '日元', element: day.stemElement, kind: '日干' };
  const movingRows = [{ position: 'decadal', pillar: luckPillar, stem: luck.stem, branch: luck.branch, god: luck.tenGod!, element: luck.stemElement, kind: '运干' },
    ...luck.hiddenStems.map(h => ({ position: 'decadal', pillar: luckPillar, stem: h.stem, branch: luck.branch, god: h.tenGod!, element: h.element, kind: '运支藏干' }))];
  const [movingStem, ...luckHidden] = movingRows;
  const relation = (a: string, b: string) => { const step = (elements.indexOf(b) - elements.indexOf(a) + 5) % 5;
    return step === 0 ? '同五行' : step === 1 ? '生' : step === 2 ? '克' : undefined; };
  const movingComponentContacts = movingRows.flatMap(from => [...exposed, ...hidden, dayRow].flatMap(to => {
    const kind = relation(from.element, to.element); return kind ? [{ from, to, relation: kind }] : [];
  }));
  const natalComponentContacts = [...exposed, ...hidden].flatMap(from => movingRows.flatMap(to => {
    const kind = relation(from.element, to.element); return kind ? [{ from, to, relation: kind }] : [];
  }));
  const wuOpportunity = day.stem === '丁' && natal.month[1] === '辰' && luck.stem === '戊';
  const monthSeal = wuOpportunity ? hidden.find(row => row.position === 'month' && row.stem === '乙' && row.god === '偏印') : undefined;
  const monthHurt = wuOpportunity ? hidden.find(row => row.position === 'month' && row.stem === '戊' && row.god === '伤官') : undefined;
  const sealToHurt = wuOpportunity ? natalComponentContacts.filter(link => link.to === movingStem && link.relation === '克'
    && link.from.kind === '透干' && link.from.stem === '甲' && link.from.god === '正印') : [];
  const hurtToOfficer = wuOpportunity ? movingComponentContacts.filter(link => link.from === movingStem && link.relation === '克'
    && link.to.kind === '透干' && link.to.stem === '壬' && link.to.god === '正官') : [];
  const chenOfficerGuard = monthSeal && monthHurt && sealToHurt.length && hurtToOfficer.length
    ? { monthSeal, monthHurt, movingHurt: movingStem, sealToHurt, hurtToOfficer } : undefined;
  const luckPillarElementLinks = luckHidden.flatMap(hidden => {
    const toStem = relation(hidden.element, movingStem.element), fromStem = relation(movingStem.element, hidden.element);
    return [...(toStem ? [{ from: hidden, to: movingStem, relation: toStem }] : []),
      ...(fromStem ? [{ from: movingStem, to: hidden, relation: fromStem }] : [])];
  });
  const interactions = baziInteractions([...native.map(row => ({ id: row.position, pillar: row.pillar })), { id: 'decadal', pillar: luckPillar }]);
  const branchRelations = interactions.pairs.map(pair => ({ kind: pair.kind, members: pair.members.map(position => position === 'decadal'
    ? { position, pillar: luckPillar, branch: luck.branch } : { position, pillar: native.find(row => row.position === position)!.pillar,
      branch: native.find(row => row.position === position)!.branch }) }));
  const clashesAt = (...positions: string[]) => branchRelations.filter(pair => pair.kind === '六冲'
    && pair.members.some(member => positions.includes(member.position)));
  const year = native[0], month = native[1];
  const dayLuBranch = zpqzMonthPositions(day.stem, month.branch).luBranch;
  const wuMaoOfficer = timeKnown && day.stem === '戊' && month.branch === '卯' && ['子', '丑'].includes(year.branch)
    ? hidden.find(row => row.position === 'month' && row.stem === '乙' && row.god === '正官') : undefined;
  const shenRen = luck.branch === '申' ? luckHidden.find(row => row.stem === '壬') : undefined;
  const ziGui = year.branch === '子' ? hidden.find(row => row.position === 'year' && row.stem === '癸') : undefined;
  const youXin = luck.branch === '酉' ? luckHidden.find(row => row.stem === '辛' && row.god === '伤官') : undefined;
  const chouXin = year.branch === '丑' ? hidden.find(row => row.position === 'year' && row.stem === '辛') : undefined;
  let wuMaoBranchRoute = 'none';
  if (wuMaoOfficer) {
    if (ziGui && shenRen && [ziGui, shenRen].every(row => baziStemFeeds(row.stem, wuMaoOfficer.stem))) wuMaoBranchRoute = 'zi-shen-water';
    else if (ziGui && youXin && baziStemControls(youXin.stem, wuMaoOfficer.stem)) wuMaoBranchRoute = 'zi-you-officer';
    else if (chouXin && luck.branch === '申') wuMaoBranchRoute = 'chou-shen-birth';
    else if (chouXin && youXin) wuMaoBranchRoute = 'chou-you-metal';
  }
  const ziYearRoute = wuMaoBranchRoute === 'zi-shen-water' || wuMaoBranchRoute === 'zi-you-officer';
  const routeNatalPosition = wuMaoBranchRoute === 'zi-shen-water' ? 'year' : 'month';
  const hasPosition = (pair: typeof branchRelations[number], position: string) => pair.members.some(row => row.position === position);
  const natalYearMonthPunishment = ziYearRoute ? branchRelations.find(pair => pair.kind === '相刑'
    && hasPosition(pair, 'year') && hasPosition(pair, 'month')) : undefined;
  const natalMonthDayCombine = ziYearRoute ? branchRelations.find(pair => pair.kind === '六合'
    && hasPosition(pair, 'month') && hasPosition(pair, 'day')) : undefined;
  const hour = native.find(row => row.position === 'hour');
  const natalHourFireBranch = natalMonthDayCombine && hour && '寅午'.includes(hour.branch)
    ? { pillar: hour.pillar, branch: hour.branch } : undefined;
  const branchReview = ziYearRoute ? {
    natalYearMonthPunishment,
    natalMonthDayCombine,
    natalHourFireBranch,
    otherEndpointClashes: branchRelations.filter(pair => pair.kind === '六冲'
      && hasPosition(pair, routeNatalPosition) !== hasPosition(pair, 'decadal')),
    endpointCombinations: branchRelations.filter(pair => pair.kind === '六合'
      && (hasPosition(pair, routeNatalPosition) || hasPosition(pair, 'decadal'))),
  } : undefined;
  const wuMaoLuckContext = wuMaoOfficer && wuMaoBranchRoute !== 'none' ? {
    route: wuMaoBranchRoute, yearPillar: year.pillar, monthOfficer: wuMaoOfficer,
    exposedOfficers: exposed.filter(row => row.stem === '乙' && row.god === '正官'),
    birthPhase: wuMaoBranchRoute === 'chou-shen-birth'
      ? { text: '长生', engine: describeBaZiPillar(luckPillar, '戊').phase } : undefined,
    supports: wuMaoBranchRoute === 'zi-shen-water' ? [ziGui, shenRen] : [],
    hurts: wuMaoBranchRoute === 'zi-you-officer' ? [youXin] : wuMaoBranchRoute === 'chou-you-metal' ? [chouXin, youXin] : [],
    branchReview,
  } : undefined;
  const youWealth = timeKnown && day.stem === '丁' && month.branch === '酉'
    ? hidden.find(row => row.position === 'month' && row.stem === '辛' && row.god === '偏财') : undefined;
  const wuDing = luckHidden.find(row => row.stem === '丁');
  const wuJi = luckHidden.find(row => row.stem === '己');
  const dingYouWuContacts = youWealth && luck.branch === '午' && dayLuBranch === luck.branch
    && wuDing?.god === '比肩' && wuJi?.god === '食神'
    && baziStemControls(wuDing.stem, youWealth.stem) && baziStemFeeds(wuJi.stem, youWealth.stem)
    ? { youWealth, wuDing, wuJi } : undefined;
  const siGeng = youWealth && luck.branch === '巳' ? luckHidden.find(row => row.stem === '庚' && row.god === '正财') : undefined;
  const dingYouSiWealth = youWealth && siGeng ? {
    youWealth, siGeng,
    natalGroupWealth: hidden.filter(row => ['巳', '酉', '丑'].includes(row.branch) && ['正财', '偏财'].includes(row.god)),
    competingClashes: clashesAt(youWealth.position, siGeng.position),
  } : undefined;
  const chenYouCombination = youWealth && year.branch === '辰' && luck.branch === '子'
    ? branchRelations.find(pair => pair.kind === '六合' && hasPosition(pair, 'year') && hasPosition(pair, 'month'))
    : undefined;
  const chenWu = chenYouCombination ? hidden.find(row => row.position === 'year' && row.stem === '戊') : undefined;
  const luckZiGui = chenYouCombination ? luckHidden.find(row => row.stem === '癸' && row.god === '七杀') : undefined;
  const dingYouZiChain = chenYouCombination && chenWu && youWealth && luckZiGui && baziStemFeeds(chenWu.stem, youWealth.stem)
    && baziStemFeeds(youWealth.stem, luckZiGui.stem) ? { chenWu, youWealth, luckZiGui, chenYouCombination,
      competingClashes: clashesAt(chenWu.position, youWealth.position, luckZiGui.position) } : undefined;
  const sourcePillarExample = sourceRootlessPillars.has(luckPillar) ? { kind: 'rootless' } as const
    : sourceGeneratingPillars.has(luckPillar) ? { kind: 'generating',
      generatingStems: luckPillarElementLinks.filter(link => link.from.kind === '运支藏干' && link.relation === '生')
        .map(link => link.from.stem) } as const : undefined;
  const dingHaiGui = day.stem === '丁' && natal.month[1] === '亥' && luck.stem === '癸';
  const renOfficers = dingHaiGui ? exposed.filter(row => row.stem === '壬') : [];
  const wuTargets = renOfficers.length ? exposed.filter(row => row.stem === '戊' && interactions.pairs.some(pair =>
    pair.kind === '天干五合' && pair.members.includes('decadal') && pair.members.includes(row.position))) : [];
  const officerHurtCombination = wuTargets.length ? { officers: renOfficers, hurtTargets: wuTargets } : undefined;
  const exposedXin = day.stem === '甲' && natal.month[1] === '酉' && ['申', '酉'].includes(luck.branch)
    ? exposed.filter(row => row.stem === '辛') : [];
  const xinRootsInLuck = exposedXin.length ? { officers: exposedXin,
    metalStems: luck.hiddenStems.filter(row => row.element === '金').map(row => row.stem) } : undefined;
  const returnBranch = zpqzSealReturnBranch(luck.branch);
  const returnClashes = native.filter(row => row.branch === returnBranch)
    .map(row => ({ natal: { position: row.position, pillar: row.pillar, branch: row.branch, hiddenStems: row.hiddenStems },
      moving: { position: 'decadal', pillar: luckPillar, branch: luck.branch } }));
  const wuPillars = native.filter(row => row.branch === '午');
  const columnsBetween = (one: number, other: number) => native
    .filter(row => Math.min(one, other) < row.index && row.index < Math.max(one, other))
    .map(row => ({ position: row.position, pillar: row.pillar }));
  const fireTargetLayouts = exposed.filter(row => ['庚', '辛'].includes(row.stem)).flatMap(target => {
    const namedRoots = hidden.filter(row => row.branch === metalRootBranches[target.stem] && row.stem === target.stem);
    return wuPillars.map(wu => ({ target, namedRoots, wu: { position: wu.position, pillar: wu.pillar, branch: wu.branch, hiddenStems: wu.hiddenStems },
      columnDistance: Math.abs(target.index - wu.index), sameColumn: target.index === wu.index,
      between: columnsBetween(target.index, wu.index) }));
  });
  const movingMeetingFire = timeKnown && day.stem === '甲' && ['寅', '戌'].includes(luck.branch)
    ? luckHidden.find(row => row.element === '火') : undefined;
  const fireMeetingPaths = movingMeetingFire ? fireTargetLayouts.filter(layout => !layout.sameColumn
    && baziStemControls(movingMeetingFire.stem, layout.target.stem)).flatMap(layout => {
    const wuFire = hidden.find(row => row.position === layout.wu.position && row.stem === '丁');
    if (!wuFire || !baziStemControls(wuFire.stem, layout.target.stem)) return [];
    return layout.namedRoots.map(root => ({
      target: layout.target, root, wuFire, movingFire: movingMeetingFire,
      stemColumnDistance: layout.columnDistance,
      betweenStemAndWu: layout.between,
      rootColumnDistance: Math.abs(root.index - wuFire.index),
      betweenRootAndWu: columnsBetween(root.index, wuFire.index),
      rootClashes: clashesAt(root.position), wuClashes: clashesAt(wuFire.position), movingClashes: clashesAt('decadal'),
    }));
  }) : [];
  const fireMeetingTargetStems = [...new Set(fireMeetingPaths.map(row => row.target.stem))];
  const concealedXinNeighbors = timeKnown && day.stem === '甲' && !exposed.some(row => row.stem === '辛')
    ? hidden.filter(row => row.branch === '酉' && row.stem === '辛').flatMap(you => hidden
      .filter(wu => wu.branch === '午' && wu.stem === '丁' && Math.abs(you.index - wu.index) === 1
        && baziStemControls(wu.stem, you.stem)).map(wu => ({ you, wu }))) : [];
  const stemLuCoordinates = exposed.map(row => ({ ...row, luBranch: zpqzMonthPositions(row.stem, natal.month[1]).luBranch,
    luckAtLu: luck.branch === zpqzMonthPositions(row.stem, natal.month[1]).luBranch }));
  const jia = day.stem === '甲';
  const [mainQi] = luckHidden;
  const jiWealth = jia ? exposed.filter(row => row.stem === '己') : [];
  const youOfficers = jia ? hidden.filter(row => row.branch === '酉' && row.stem === '辛') : [];
  const exposedXinOfficers = jia ? exposed.filter(row => row.stem === '辛') : [];
  const jiaOfficerTargets = [...youOfficers, ...exposedXinOfficers];
  const jiAtLu = stemLuCoordinates.filter(row => jia && row.stem === '己' && row.luckAtLu);
  const combinesMovingStem = (row: { position: string; kind: string }) => row.kind === '透干'
    && interactions.pairs.some(pair => pair.kind === '天干五合' && pair.members.includes('decadal') && pair.members.includes(row.position));
  const jiaWuWealthLu = luck.branch === '午' && youOfficers.length && jiAtLu.length && wuDing && wuJi
    ? { officers: youOfficers, exposedOfficers: exposedXinOfficers, wealthAtLu: jiAtLu, hurtHidden: wuDing, wealthHidden: wuJi,
      wealthFeedsOfficer: jiAtLu.flatMap(wealth => youOfficers.filter(officer => baziStemFeeds(wealth.stem, officer.stem))
        .map(officer => ({ wealth, officer }))),
      hiddenHurtControls: movingComponentContacts.filter(link => link.from === wuDing && link.relation === '克'
        && jiaOfficerTargets.includes(link.to)),
    } : undefined;
  const jiaDingOfficerHurt = timeKnown && luck.stem === '丁' && youOfficers.length && jiWealth.length ? {
    wealth: jiWealth,
    controls: movingComponentContacts.filter(link => link.from === movingStem && link.relation === '克'
      && jiaOfficerTargets.includes(link.to)),
  } : undefined;

  const jiaWealthAttacks = jiWealth.length && ['甲', '乙'].includes(luck.stem)
    ? movingComponentContacts.filter(link => link.from === movingStem && link.relation === '克' && jiWealth.includes(link.to))
      .map(link => ({ ...link, combines: combinesMovingStem(link.to) })) : [];
  const jiaWealthStem = jiaWealthAttacks.length ? {
    attacks: jiaWealthAttacks,
    officerControls: natalComponentContacts.filter(link => exposedXinOfficers.includes(link.from)
      && link.to === movingStem && link.relation === '克'),
    outputBridges: movingComponentContacts.filter(link => link.from === movingStem && link.relation === '生'
      && link.to.kind === '透干' && ['食神', '伤官'].includes(link.to.god)).flatMap(link =>
      jiaWealthAttacks.filter(attack => relation(link.to.element, attack.to.element) === '生').map(attack => ({
        from: movingStem, through: link.to, wealth: attack.to,
      }))),
  } : undefined;
  const jiaWealthBranch = jiWealth.length && ['寅', '卯'].includes(luck.branch)
    && movingComponentContacts.some(link => link.from === mainQi && link.to === dayRow && link.relation === '同五行')
    ? { mainQi, wealth: jiWealth, concealedYouOfficers: exposedXinOfficers.length ? [] : youOfficers } : undefined;

  const guiSeals = jia ? [...exposed, ...hidden].filter(row => row.stem === '癸') : [];
  const jiaSealStem = guiSeals.length && ['戊', '己'].includes(luck.stem) ? movingComponentContacts.filter(link =>
    link.from === movingStem && link.relation === '克' && guiSeals.includes(link.to)).map(link => ({ ...link,
    combines: combinesMovingStem(link.to),
  })) : [];
  const jiaSealStorehouse = guiSeals.length && ['辰', '戌', '丑', '未'].includes(luck.branch)
    ? { seals: guiSeals, hidden: luckHidden, contacts: movingComponentContacts.filter(link => link.from.kind === '运支藏干'
      && guiSeals.includes(link.to)) } : undefined;
  const jiaLuckRoutes = [jiaWuWealthLu && 'wu-wealth-lu', jiaDingOfficerHurt && 'ding-officer-hurt',
    jiaWealthStem && 'wealth-stem', jiaWealthBranch && 'wealth-branch',
    jiaSealStem.length > 0 && 'seal-stem', jiaSealStorehouse && 'seal-storehouse'].filter(route => typeof route === 'string');
  return { stemBranchProfile: zpqzStemBranchPolicy.profile,
    natalExposedStems: [...new Set(exposed.map(row => row.stem))], natalPresentStems: [...new Set([...exposed, ...hidden].map(row => row.stem))],
    exposedComponents: exposed, hiddenComponents: hidden, movingComponents: movingRows, movingComponentContacts, natalComponentContacts,
    luckPillarElementLinks, branchRelations, returnClashes, hasMatchingSealReturnClash: seen(returnClashes.length > 0),
    sourcePillarExample, officerHurtCombination, xinRootsInLuck,
    hasSourceStemBranchExample: seen(Boolean(sourcePillarExample || officerHurtCombination || xinRootsInLuck)),
    chenOfficerGuard, hasChenOfficerGuard: seen(Boolean(chenOfficerGuard)),
    jiaLuckRoutes, jiaWuWealthLu, jiaDingOfficerHurt, jiaWealthStem, jiaWealthBranch, jiaSealStem, jiaSealStorehouse,
    fireTargetLayouts, fireMeetingTargetStems, fireMeetingPaths, concealedXinNeighbors,
    stemLuCoordinates, dayLuBranch, luckAtDayLu: luck.branch === dayLuBranch, luckBranchMainQiGod: luck.hiddenStems[0]?.tenGod,
    wuMaoBranchRoute, wuMaoLuckContext, dingYouZiChain, hasDingYouZiChain: Boolean(dingYouZiChain),
    dingYouWuContacts, hasDingYouWuContacts: Boolean(dingYouWuContacts),
    dingYouSiWealth, hasDingYouSiWealth: Boolean(dingYouSiWealth),
    stemBranchEffectsVerified: false };
}
