import { baziZpqzSealFood, zpqzColumnStemCheck } from './bazi-zpqz-seal-food';
import { baziZpqzStemOrder } from './bazi-zpqz-stems';
import { matchZpqzPrintedLuck, type PrintedLuckReading } from './bazi-zpqz-printed-luck';
import { baziInteractions, baziStemControls, baziStemFeeds, describeBaZiPillar } from './bazi-calculation';
import { zpqzMonthPositions } from './bazi-zpqz-month';
import { lunarAtBeijing } from './fortune-calendar';

type Natal = { year: string; month: string; day: string; hour: string; utc?: string };
export const zpqzFoodKillerPolicy = {
  profile: 'zpqz-food-killer-no-seal-and-climate-candidates-v1',
  noSeal: 'all-known-visible-and-concealed-seals; unknown-hour-not-absence',
  roots: 'exact-stem-and-same-element-separated-not-effective-source-root',
  climate: 'calendar-and-element-witnesses-not-hot-cold-or-strength-judgment',
  contacts: 'named-food-wealth-killer-endpoints-not-effective-control-or-remedy',
  printedLuck: 'chapter-38-original-reading-only-at-exact-four-columns-and-named-luck-pillar',
} as const;
export const zpqzFoodKillerCases = [
  { id: 'liang', name: '梁丞相', pillars: ['丁未', '癸卯', '癸亥', '癸丑'] },
  { id: 'xie', name: '谢阁老', pillars: ['己未', '壬申', '戊子', '庚申'] },
  { id: 'shen', name: '沈路分', pillars: ['丁亥', '癸卯', '癸卯', '甲寅'] },
  { id: 'gong', name: '龚知县', pillars: ['甲午', '丁卯', '癸丑', '丙辰'] },
  { id: 'chang', name: '常国公', pillars: ['辛卯', '辛卯', '癸酉', '己未'] },
  { id: 'hu', name: '胡会元', pillars: ['戊戌', '壬戌', '丙子', '戊戌'] },
  { id: 'liu', name: '刘提督', pillars: ['癸酉', '辛酉', '己卯', '乙亥'] },
  { id: 'li', name: '李君', pillars: ['戊戌', '己未', '丙子', '庚寅'] },
  { id: 'wealth-rescue', name: '透财解印例', pillars: ['己亥', '丙寅', '甲寅', '壬申'] },
  { id: 'shu', name: '舒尚书', pillars: ['丁亥', '壬子', '辛巳', '丁酉'] },
  { id: 'qian', name: '钱参政', pillars: ['丙午', '癸巳', '甲子', '丙寅'] },
  { id: 'huang', name: '黄都督', pillars: ['己未', '己巳', '甲寅', '丙寅'] },
] as const;

type PrintedCaseId = typeof zpqzFoodKillerCases[number]['id'];
const printedLuckReadings: Readonly<Partial<Record<PrintedCaseId, PrintedLuckReading>>> = {
  liang: { premise: '按身强、食旺与财透论', periods: [
    { pillars: ['戊戌'], assessment: '列作有波折的一运' },
  ] },
  xie: { premise: '同章归为身重食旺，明透庚食有申位', periods: [
    { pillars: ['己巳', '戊辰'], assessment: '列作原例帮身的运步' },
  ] },
  gong: { premise: '按身轻、食轻而财重论，取帮身', periods: [
    { pillars: ['壬申', '癸酉'], assessment: '列作原例较得助的运步' },
  ] },
  hu: { premise: '按食神制杀偏过论', periods: [
    { pillars: ['癸亥', '甲子', '乙丑'], assessment: '列作原例官杀成分相助的运步' },
    { pillars: ['丙寅', '丁卯'], assessment: '列作劫印助身的运步' },
    { pillars: ['戊辰'], assessment: '列作加重土势的取忌运步' },
  ] },
  liu: { premise: '按身弱而同时受月食泄与原局七杀克论', periods: [
    { pillars: ['己未', '戊午', '丁巳', '丙辰'], assessment: '列作原例印绶与比劫助身的运步' },
  ] },
  li: { premise: '按丙火日、土食伤太重而带印论', periods: [
    { pillars: ['庚申', '辛酉'], assessment: '列作财承土气的有利运步' },
    { pillars: ['壬戌', '癸亥', '甲子', '乙丑'], assessment: '按原评官杀水克丙的方向核对实际水气' },
  ] },
  qian: { premise: '以癸印得禄为调候条件', periods: [
    { pillars: ['丙申', '丁酉'], assessment: '列作原例适宜的运步' },
    { pillars: ['戊戌'], assessment: '列作土财可能损及水印的运步' },
  ] },
  huang: { premise: '以夏木原局无印而仍可取运印劫论', periods: [
    { pillars: ['乙丑', '甲子', '癸亥', '壬戌'], assessment: '列作原例印劫助身的运步，实际干支分别核位' },
  ] },
  shu: { premise: '按冬金水寒、取火调候论', periods: [
    { pillars: ['己酉', '戊申'], assessment: '作为印劫运的平常对照' },
    { pillars: ['丁未', '丙午'], assessment: '列作原例最相宜的火运' },
    { pillars: ['乙巳', '甲辰'], assessment: '列作原例相宜的运步' },
  ] },
};
const sourceVariants: Readonly<Partial<Record<PrintedCaseId, string>>> = {
  shen: '论食神列丁亥、癸卯、癸卯、甲寅，取运篇另录丁亥、癸卯、甲寅、甲寅且评语仍说癸水；两处柱序并存',
  xie: '论食神列己未、壬申、戊子、庚申，取运篇一处末柱列戊申，评注又写庚辰时；另版取运篇列庚申，分别保留盘式和评语异文',
  'wealth-rescue': '论食神的一处录文称丙水食神。按实际盘面，甲日透丙为火食神',
  shu: '取运篇一处录文称乙巳、甲辰为三运；保留所列两柱与数量异文',
};

function summerYiSolsticeTiming(utc: string | undefined, month: string) {
  const birthAt = Date.parse(utc ?? '');
  if (!Number.isSafeInteger(birthAt)) return undefined;
  const lunar = lunarAtBeijing(birthAt);
  if (lunar.getMonthInGanZhiExact() !== month) return undefined;
  const terms = (lunar as typeof lunar & { getJieQiTable(): Record<string, { toYmdHms(): string }> }).getJieQiTable();
  const solsticeAt = Date.parse((terms['夏至']?.toYmdHms() ?? '').replace(' ', 'T') + '+08:00');
  if (!Number.isSafeInteger(solsticeAt)) return undefined;
  return { phase: birthAt < solsticeAt ? 'before-solstice' : 'at-or-after-solstice',
    birthAt: new Date(birthAt).toISOString(), solsticeAt: new Date(solsticeAt).toISOString() } as const;
}

export function baziZpqzFoodKiller(natal: Natal, timeKnown: boolean, luckPillar: string) {
  const base = baziZpqzSealFood(natal, timeKnown, luckPillar), order = baziZpqzStemOrder(natal, timeKnown, luckPillar);
  const god = (name: string) => base.gods.find(row => row.god === name)!;
  const seen = (value: boolean) => value ? true : timeKnown ? false : undefined;
  const conjunction = (...values: (boolean | undefined)[]) => values.includes(false) ? false : values.includes(undefined) ? undefined : true;
  const not = (value: boolean | undefined) => value === undefined ? undefined : !value;
  const role = (names: string[]) => base.gods.filter(row => names.includes(row.god)).flatMap(row => [...row.exposedRows, ...row.hiddenRows]);
  const foodRows = role(['食神']), hurtRows = role(['伤官']), wealthRows = role(['正财', '偏财']), sealRows = role(['正印', '偏印']), killerRows = role(['七杀']);
  const outputRows = [...foodRows, ...hurtRows];
  const contacts = (from: typeof foodRows, to: typeof foodRows, label: string) => from.flatMap(a => to.map(b => ({
    from: a, to: b, label, columnDistance: Math.abs(a.index - b.index), bothExposed: a.kind === '透干' && b.kind === '透干',
    between: base.natalPillars.filter(p => Math.min(a.index, b.index) < ['year', 'month', 'day', 'hour'].indexOf(p.position)
      && ['year', 'month', 'day', 'hour'].indexOf(p.position) < Math.max(a.index, b.index)),
  })));
  const monthFoodCandidate = base.monthHiddenGods.includes('食神'), killerPresent = seen(killerRows.length > 0);
  const noSeal = not(base.sealsPresent), summerWood = ['甲', '乙'].includes(base.dayMaster) && ['巳', '午', '未'].includes(base.monthBranch);
  const natalWoodMembers = [...'亥卯未'].map(branch => ({ branch,
    natalPositions: base.natalPillars.filter(p => p.pillar[1] === branch).map(p => p.position), luckPresent: luckPillar[1] === branch }));
  const printedCases = zpqzFoodKillerCases.map(c => ({ ...c, stemCheck: zpqzColumnStemCheck(c.pillars),
    matches: (['year', 'month', 'day', 'hour'] as const).every((position, i) => position === 'hour' && !timeKnown || natal[position] === c.pillars[i])
      ? timeKnown ? true : undefined : false }));
  const matches = (id: PrintedCaseId) => printedCases.some(row => row.id === id && row.matches === true);
  const printedLuck = matchZpqzPrintedLuck(printedCases, printedLuckReadings, luckPillar);
  const monthFood = foodRows.filter(row => row.position === 'month' && row.kind === '支藏');
  const monthFoodWealth = contacts(monthFood, wealthRows, '月令食神生财');
  const foodWealthPairs = contacts(outputRows, wealthRows, '食伤生财');
  const movingContacts = base.remedyMovingContacts, natalContacts = base.remedyNatalContacts;
  const { stemElement } = describeBaZiPillar(natal.day);
  const day = { position: 'day', pillar: natal.day, kind: '日干', stem: base.dayMaster, god: '日元', element: stemElement };
  const noSealKiller = noSeal === true ? contacts(monthFood.filter(row => baziStemFeeds(day.stem, row.stem)),
    killerRows.filter(row => baziStemControls(row.stem, day.stem)), '月令食神制杀') : [];
  const [movingStem, mainQi] = base.remedyMovingComponents;
  const leading = base.remedyMovingComponents.slice(0, 2);
  const outputLuck = leading.filter(row => ['食神', '伤官'].includes(row.god));
  const sealLuck = leading.filter(row => ['正印', '偏印'].includes(row.god));
  const wealthLuck = leading.filter(row => ['正财', '偏财'].includes(row.god));
  const feedsDay = (moving: typeof movingStem) => movingContacts.some(link => link.from === moving && link.to.kind === '日干' && link.relation === '生');
  const daySupport = base.remedyMovingComponents.flatMap(moving => moving.element === day.element ? [{ moving, day, relation: '同五行' }]
    : feedsDay(moving) ? [{ moving, day, relation: '生' }] : []);
  const supportsDay = daySupport.filter(link => leading.includes(link.moving));
  const luckOutputFeedsWealth = movingContacts.filter(link => outputLuck.includes(link.from) && link.relation === '生'
    && monthFoodWealth.some(row => row.to === link.to));
  const monthFoodFeedsLuckWealth = natalContacts.filter(link => wealthLuck.includes(link.to) && link.relation === '生'
    && monthFoodWealth.some(row => row.from === link.from));
  const authorityPressure = god('食神').exposed === true ? movingContacts.filter(link => leading.includes(link.from)
    && ['正官', '七杀'].includes(link.from.god) && link.to.kind === '日干' && link.relation === '克') : [];
  const liangContrast = matches('liang') && luckPillar === '戊戌' && natalWoodMembers.every(row => row.natalPositions.length)
    && leading.every(row => row.god === '正官');
  const liangFoodWealth = matches('liang') && natalWoodMembers.every(row => row.natalPositions.length)
    && (luckOutputFeedsWealth.some(({ from, to }) => from.element === '木' && to.position === 'year' && to.stem === '丁')
      || monthFoodFeedsLuckWealth.some(({ from, to }) => from.stem === '乙' && to.element === '火'));
  const natalRenDingWealthPairs = order.natalFivePairs.filter(pair => [pair.first, pair.second].some(row => row.stem === '壬')
    && [pair.first, pair.second].some(row => row.stem === '丁' && ['正财', '偏财'].includes(row.tenGod!)));
  const liangNatalRen = timeKnown && natal.year === '丁未' && natal.month === '癸卯'
    && natal.day === '癸亥' && natal.hour === '壬子' && natalWoodMembers.every(row => row.natalPositions.length)
    ? natalRenDingWealthPairs.find(pair => [pair.first, pair.second].some(row => row.position === 'hour' && row.stem === '壬')
      && [pair.first, pair.second].some(row => row.position === 'year' && row.stem === '丁')) : undefined;
  // The source's natal Ren counterfactual changes the reading of Fire wealth.
  // A separate leading seal or peer still needs its own support review.
  const liangSourceRenCounterfactual = liangNatalRen ? {
    natalWealthCombination: liangNatalRen, woodMembers: natalWoodMembers, movingDaySupport: supportsDay,
    fireWealth: monthFoodFeedsLuckWealth.filter(({ from, to }) => from.stem === '乙' && to.element === '火'),
  } : undefined;
  const hasLiangSourceRenCounterfactualFireWealth = seen(Boolean(liangSourceRenCounterfactual?.fireWealth.length && !supportsDay.length));
  const sourceBodyHeavy = matches('liang') || matches('xie');
  const sharedOutputWealth = foodWealthPairs.filter(link => monthFoodWealth.some(row => row.to === link.to));
  const sealChecksOutput = movingContacts.filter(link => sealLuck.includes(link.from) && link.relation === '克'
    && sharedOutputWealth.some(path => path.from === link.to));
  const robberyChecksWealth = movingContacts.filter(link => leading.includes(link.from) && link.from.god === '劫财'
    && link.relation === '克' && monthFoodWealth.some(row => row.to === link.to));
  const xieFood = matches('xie') ? foodRows.find(row => row.position === 'hour' && row.kind === '透干') : undefined;
  const xieWealth = xieFood && monthFoodWealth.find(link => link.to.position === 'month' && link.to.kind === '透干'
    && link.to.stem === '壬' && baziStemFeeds(xieFood.stem, link.to.stem))?.to;
  const xieLuck = xieFood && xieWealth ? {
    food: xieFood, wealth: xieWealth,
    foodRoots: foodRows.filter(row => row.kind === '支藏' && row.stem === xieFood.stem && row.branch === '申'),
    wealthRoots: wealthRows.filter(row => row.kind === '支藏' && row.stem === xieWealth.stem && row.branch === '申'),
    waterMembers: base.shenZiChen,
    // The printed water pairing and a later Chen completing membership are separate observations.
    chenArrives: base.groupCompletedByLuck === true,
    namedSupport: ['己巳', '戊辰'].includes(luckPillar)
      ? daySupport.map(link => link.moving) : [],
  } : undefined;
  const shenLuck = matches('shen') ? {
    renCombinesDing: luckPillar[0] === '壬' ? order.movingFivePairs.filter(pair => pair.target.stem === '丁' && pair.target.position === 'year') : [],
    guiChecksDing: luckPillar[0] === '癸' ? movingContacts.filter(link => link.from === movingStem && link.relation === '克'
      && link.to.position === 'year' && link.to.kind === '透干' && link.to.stem === '丁') : [],
    northWater: ['亥', '子', '丑'].includes(luckPillar[1]) ? base.remedyMovingComponents.slice(1).filter(row => row.element === day.element) : [],
    branchSeal: sealLuck.includes(mainQi) && feedsDay(mainQi) ? mainQi : undefined,
    nativeWaterRoot: role(['劫财']).find(row => row.position === 'year' && row.kind === '支藏' && row.stem === '壬'),
  } : undefined;
  const shenContrast = shenLuck && (shenLuck.renCombinesDing.length || shenLuck.guiChecksDing.length || shenLuck.northWater.length || shenLuck.branchSeal);
  const gongSupport = matches('gong') && ['壬申', '癸酉'].includes(luckPillar) ? supportsDay : [];
  const shenFood = shenContrast ? monthFoodWealth.find(link => link.from.stem === '乙' && link.to.position === 'year'
    && link.to.stem === '丁' && link.to.kind === '透干') : undefined;
  const shenHurt = shenFood && sharedOutputWealth.find(link => link.to === shenFood.to && link.from.position === 'hour'
    && link.from.stem === '甲' && link.from.kind === '透干');
  const shenSourceFoodBody = shenFood && shenHurt && shenLuck?.nativeWaterRoot ? {
    day, food: shenFood.from, hurt: shenHurt.from, wealth: shenFood.to, ...shenLuck,
    woodMembers: natalWoodMembers.filter(member => member.natalPositions.length > 0),
  } : undefined;
  const gongFood = gongSupport.length ? monthFoodWealth.find(link => link.from.stem === '乙' && link.to.position === 'month'
    && link.to.stem === '丁' && link.to.kind === '透干') : undefined;
  const gongWealth = gongFood && monthFoodWealth.find(link => link.from === gongFood.from && link.to.position === 'hour'
    && link.to.stem === '丙' && link.to.kind === '透干')?.to;
  const gongSourceFoodBody = gongFood && gongWealth && gongSupport.some(link => link.moving === movingStem && link.relation === '同五行')
    && gongSupport.some(link => link.moving === mainQi && link.relation === '生') ? {
      day, food: gongFood.from, wealth: [gongFood.to, gongWealth],
      movingSupport: gongSupport,
      waterRoots: order.roots.find(row => row.stem === day.stem)?.roots.filter(row => row.position !== 'decadal') ?? [],
    } : undefined;
  // In these printed charts Xu explicitly reads either heavy food or a light day master.
  const foodSealRemedySourceExcluded = timeKnown ? sourceBodyHeavy || matches('shen') || matches('gong') : undefined;
  const sameNatalKiller = (row: typeof movingContacts[number]['to']) => noSealKiller.some(pair => pair.to === row);
  const outputChecksKiller = movingContacts.filter(link => outputLuck.includes(link.from) && link.relation === '克' && sameNatalKiller(link.to));
  const wealthFeedsKiller = movingContacts.filter(link => wealthLuck.includes(link.from) && link.relation === '生' && sameNatalKiller(link.to));
  const sealRescues = noSealKiller.flatMap(({ from: food, to: killer }) => base.remedyMovingComponents.filter(moving =>
    ['正印', '偏印'].includes(moving.god) &&
    feedsDay(moving) && natalContacts.some(link => link.from === killer && link.to === moving && link.relation === '生')
    && movingContacts.some(link => link.from === moving && link.to === food && link.relation === '克'))
    .map(moving => ({ food, killer, moving, day })));
  const sealRescue = sealRescues.filter(row => leading.includes(row.moving));
  const secondarySealRescue = sealRescues.filter(row => !leading.includes(row.moving));
  const huOvercontrol = matches('hu'), liuWeakDay = matches('liu');
  // 徐注以四丙申为火不通根的身弱例。只在同一完整四柱留这项判断。
  const rootlessBingShenSource = timeKnown && noSealKiller.length > 0 && base.natalPillars.every(row => row.pillar === '丙申')
    ? { day, monthFood: noSealKiller[0].from, killerSeats: noSealKiller.map(row => row.to) } : undefined;
  const bingShenReviewedSealAid = rootlessBingShenSource ? sealRescue.filter(row => row.killer.position === 'month'
    && row.killer.kind === '支藏' && row.killer.stem === '壬') : undefined;
  const huEarth = huOvercontrol && luckPillar === '戊辰' && noSealKiller.length && leading.every(row => row.element === '土') ? leading : [];
  const huAuthority = huOvercontrol && ['癸亥', '甲子', '乙丑'].includes(luckPillar)
    ? noSealKiller.flatMap(({ from: food, to: killer }) => movingContacts.filter(link => link.to.kind === '日干'
      && link.relation === '克' && link.from.element === killer.element && ['正官', '七杀'].includes(link.from.god))
      .map(link => ({ food, killer, moving: link.from, day }))) : [];
  const huSealRescues = huOvercontrol ? sealRescue.filter(({ food, killer }) => food.stem === '戊'
    && killer.position === 'month' && killer.kind === '透干' && killer.stem === '壬') : [];
  const huSealTriplet = ['丙寅', '丁卯'].includes(luckPillar) && supportsDay.some(link => link.moving === movingStem && link.relation === '同五行')
    ? huSealRescues.find(({ moving }) => moving === mainQi) : undefined;
  const huStemSealTriplet = ['甲子', '乙丑'].includes(luckPillar)
    ? huSealRescues.find(({ moving }) => moving === movingStem) : undefined;
  const huReviewedLuck = huAuthority.length > 0 || huEarth.length > 0 || huSealTriplet !== undefined;
  const liuPair = liuWeakDay && base.liuSourceWealthSeparation && printedLuck.printedLuckCaseIds.includes('liu')
    ? noSealKiller.find(({ from, to }) => from.stem === '辛' && to.position === 'hour' && to.kind === '透干' && to.stem === '乙') : undefined;
  const liuSupport = liuPair ? daySupport : [];
  const liuSourceSupport = liuPair && liuSupport.length ? { food: liuPair.from, killer: liuPair.to, day,
    wealthSeparation: base.liuSourceWealthSeparation } : undefined;
  const fireOutputs = outputRows.filter(row => row.element === '火');
  const waterSeals = sealRows.filter(row => row.element === '水');
  const summerWater = summerWood ? movingContacts.filter(link => sealLuck.includes(link.from) && link.from.element === '水'
    && fireOutputs.some(row => row === link.to) && link.relation === '克' && feedsDay(link.from))
    .map(link => ({ moving: link.from, fire: link.to, day })) : [];
  // 卷首按甲木列全巳午或寅午戌、明透丙丁，另列坐辰湿土。
  const summerBranches = timeKnown && base.dayMaster === '甲' && summerWater.length
    ? base.natalPillars.map(row => row.pillar[1]) : [];
  const fireFormation = summerBranches.includes('巳') && summerBranches.includes('午') && summerBranches.every(branch => '巳午'.includes(branch))
    ? 'si-wu' : [...'寅午戌'].every(branch => summerBranches.includes(branch)) ? 'yin-wu-xu' : undefined;
  const exposedSummerFire = fireFormation ? fireOutputs.filter(row => row.kind === '透干') : [];
  const summerFireSource = fireFormation && exposedSummerFire.length ? {
    formation: fireFormation,
    members: base.natalPillars.filter(row => (fireFormation === 'si-wu' ? '巳午' : '寅午戌').includes(row.pillar[1])),
    exposedFire: exposedSummerFire,
    hasBothFireStems: [...'丙丁'].every(stem => exposedSummerFire.some(row => row.stem === stem)),
    dampChenDay: natal.day === '甲辰' ? { position: 'day', pillar: natal.day } : undefined,
  } : undefined;
  const summerJiaReviewedWaterSeal = summerFireSource?.hasBothFireStems && !summerFireSource.dampChenDay && waterSeals.length
    ? sealLuck.filter(moving => exposedSummerFire.every(fire => summerWater.some(link => link.moving === moving && link.fire === fire)))
    : [];
  const printedSummerYi = timeKnown && natal.year === '丁丑' && natal.month === '丙午' && natal.day === '乙卯' && natal.hour === '丁亥';
  const summerYiGui = printedSummerYi ? waterSeals.find(row => row.position === 'year' && row.kind === '支藏' && row.stem === '癸') : undefined;
  const summerYiRen = printedSummerYi ? waterSeals.find(row => row.position === 'hour' && row.kind === '支藏' && row.stem === '壬') : undefined;
  const summerYiXin = summerYiGui ? killerRows.find(row => row.position === summerYiGui.position
    && row.kind === '支藏' && row.stem === '辛' && baziStemFeeds(row.stem, summerYiGui.stem)) : undefined;
  const summerYiFire = summerYiGui ? fireOutputs.filter(row => row.kind === '透干') : [];
  const summerYiReviewedWaterSeal = summerYiGui && summerYiRen && summerYiXin && movingStem.stem === summerYiGui.stem
    && summerYiFire.every(fire => summerWater.some(link => link.moving === movingStem && link.fire === fire))
    ? { gui: summerYiGui, ren: summerYiRen, xin: summerYiXin, moving: movingStem, fire: summerYiFire, day } : undefined;
  // 五月乙木以火局和有根的癸核调候。这里只确认实支和同柱辛癸，保留财克与冲位。
  const summerYiFireMembers = timeKnown && base.dayMaster === '乙' && base.monthBranch === '午' && movingStem.stem === '癸'
    ? base.natalPillars.filter(row => '寅午戌'.includes(row.pillar[1])) : [];
  const summerYiExposedFire = summerYiFireMembers.length === 3 ? fireOutputs.filter(row => row.kind === '透干') : [];
  const summerYiFireTrine = new Set(summerYiFireMembers.map(row => row.pillar[1])).size === 3
    && summerYiExposedFire.some(row => row.stem === '丙')
    && summerYiExposedFire.every(fire => summerWater.some(link => link.moving === movingStem && link.fire === fire));
  const summerYiFireTrineRoots = summerYiFireTrine ? waterSeals.filter(gui => gui.stem === '癸' && gui.kind === '支藏')
    .flatMap(gui => killerRows.filter(xin => xin.stem === '辛' && xin.kind === '支藏' && xin.position === gui.position
      && baziStemFeeds(xin.stem, gui.stem)).map(xin => ({ gui, xin }))) : [];
  const summerYiSolstice = summerYiFireTrineRoots.length ? summerYiSolsticeTiming(natal.utc, natal.month) : undefined;
  const summerYiFireFormationWaterEvidence = summerYiFireTrineRoots.length ? {
    fireMembers: summerYiFireMembers, fire: summerYiExposedFire, roots: summerYiFireTrineRoots, moving: movingStem, day,
    solarTerm: summerYiSolstice,
    opposingEarth: wealthRows.filter(row => row.kind === '透干' && baziStemControls(row.stem, movingStem.stem)),
    clashes: baziInteractions([...base.natalPillars.map(row => ({ id: row.position, pillar: row.pillar })), { id: 'decadal', pillar: luckPillar }])
      .pairs.filter(pair => pair.kind === '六冲'),
  } : undefined;
  const hasSummerYiFireFormationWaterSeal = seen(Boolean(summerYiFireFormationWaterEvidence
    && !summerYiFireFormationWaterEvidence.opposingEarth.length && !summerYiFireFormationWaterEvidence.clashes.length));
  const qianGui = matches('qian') ? waterSeals.find(row => row.stem === '癸' && row.kind === '透干') : undefined;
  const qianLuBranch = qianGui ? zpqzMonthPositions(qianGui.stem, base.monthBranch).luBranch : undefined;
  const qianLu = qianGui && waterSeals.find(row => row.kind === '支藏' && row.stem === qianGui.stem && row.pillar[1] === qianLuBranch);
  const qianLuck = qianGui && qianLu ? {
    seal: qianGui, lu: qianLu,
    branchFeedsSeal: ['丙申', '丁酉'].includes(luckPillar) && movingContacts.some(link => link.from === mainQi
      && link.to === qianGui && link.relation === '生') ? mainQi : undefined,
    wealthAttacksSeal: luckPillar === '戊戌' && movingContacts.some(link => link.from === movingStem
      && link.to === qianGui && link.relation === '克') ? movingStem : undefined,
    wealthCombinesSeal: luckPillar === '戊戌' && order.movingFivePairs.some(pair => pair.target.position === qianGui.position
      && pair.target.stem === qianGui.stem && !pair.targetIsDayMaster),
  } : undefined;
  const huangSupport = matches('huang') && noSeal === true && ['乙丑', '甲子', '癸亥', '壬戌'].includes(luckPillar) ? supportsDay : [];
  const liSeal = printedLuck.printedLuckCaseIds.includes('li') ? sealRows.find(row => row.position === 'hour' && row.kind === '支藏' && row.stem === '甲') : undefined;
  const liEarth = liSeal ? outputRows.filter(row => row.element === '土' && ['year', 'month'].includes(row.position)) : [];
  const liWealth = natalContacts.filter(link => liEarth.some(row => row === link.from)
    && wealthLuck.includes(link.to) && link.relation === '生');
  const liAuthority = liSeal ? movingContacts.filter(link => link.from.element === '水' && link.to.kind === '日干'
    && link.relation === '克') : [];
  const liLuck = liSeal && (liWealth.length || liAuthority.length) ? { seal: liSeal, day, earthFeedsWealth: liWealth,
    waterChecksDay: liAuthority, fireRoots: role(['比肩', '劫财']).filter(row => row.kind === '支藏'
      && ['戌', '未', '寅'].includes(row.branch)) } : undefined;
  const exposedWealthAgainstSeal = base.wealthSealContacts.filter(pair => pair.from.kind === '透干');
  const movingAuthority = leading.filter(row => ['正官', '七杀'].includes(row.god));
  const foodSealWealth = base.sealOutputContacts.filter(link => monthFood.some(food => food === link.to)).flatMap(link => {
    const exposedFood = foodRows.filter(row => row.kind === '透干' && row.stem === link.to.stem);
    const movingAuthorityCombinesFood = movingAuthority.includes(movingStem) ? exposedFood.filter(food =>
      order.movingFivePairs.some(pair => food.position === pair.target.position && food.stem === pair.target.stem))
      .map(target => ({ moving: movingStem, target })) : [];
    const movingSealChecksExposedFood = movingContacts.filter(contact => sealLuck.includes(contact.from)
      && exposedFood.some(food => food === contact.to) && contact.relation === '克');
    const wealthCheckingSeal = movingContacts.filter(contact => contact.to === link.from && contact.relation === '克'
      && ['正财', '偏财'].includes(contact.from.god)).map(contact => contact.from);
    return exposedWealthAgainstSeal.filter(pair => pair.to === link.from).map(pair => ({
      food: link.to, seal: link.from, wealth: pair.from,
      exposedFood, movingAuthorityCombinesFood, movingSealChecksExposedFood,
      wealthRoots: order.roots.find(row => row.stem === pair.from.stem)?.roots ?? [],
      movingWealth: wealthCheckingSeal.filter(moving => leading.includes(moving)),
      secondaryWealth: link.from.kind === '透干' && exposedFood.length
        ? wealthCheckingSeal.filter(moving => !leading.includes(moving)) : [],
      movingOutput: outputLuck.filter(moving => movingContacts.some(contact => contact.from === moving
        && contact.to === pair.from && contact.relation === '生')),
      movingSeal: sealLuck.filter(moving => movingContacts.some(contact => contact.from === moving
        && contact.to === link.to && contact.relation === '克')),
      movingAuthority: movingAuthority.filter(moving => movingContacts.some(contact => contact.from === moving
        && contact.to === link.from && contact.relation === '生')),
    }));
  });
  const reviewedWealthRemedy = matches('wealth-rescue') ? foodSealWealth.find(path =>
    path.food.position === 'month' && path.food.stem === '丙'
    && path.exposedFood.some(row => row.position === 'month')
    && path.seal.position === 'hour' && path.seal.kind === '透干' && path.seal.stem === '壬'
    && path.wealth.position === 'year' && path.wealth.stem === '己') : undefined;
  const wealthRemedyReviewedActions = [
    reviewedWealthRemedy?.movingWealth.length && 'wealth-checks-seal',
    reviewedWealthRemedy?.movingOutput.length && 'output-feeds-wealth',
    reviewedWealthRemedy?.movingSealChecksExposedFood.length && 'seal-checks-food',
    reviewedWealthRemedy?.movingAuthority.length && 'authority-feeds-seal',
  ].filter(action => typeof action === 'string');
  // 論食神: 己丑、丙寅、甲子、戊辰 is the printed counterexample where food is exposed and wealth does not harm seal.
  const printedFoodSealSeparate = natal.year === '己丑' && natal.month === '丙寅' && natal.day === '甲子'
    ? timeKnown ? natal.hour === '戊辰' : undefined
    : false;
  const foodSealSourceComparison = printedFoodSealSeparate ? {
    id: 'printed-wealth-seal-separate',
    food: foodRows.find(row => row.position === 'month' && row.kind === '透干' && row.stem === '丙'),
    seal: sealRows.find(row => row.position === 'day' && row.kind === '支藏' && row.stem === '癸'),
    wealth: wealthRows.filter(row => row.kind === '透干' && (row.position === 'year' || row.position === 'hour'))
      .sort((a, b) => a.index - b.index),
  } : undefined;
  const winterMetalWaterFoodCandidate = ['庚', '辛'].includes(base.dayMaster) && ['亥', '子', '丑'].includes(base.monthBranch)
    && monthFood.some(row => row.element === '水');
  const winterFire = winterMetalWaterFoodCandidate ? killerRows.filter(row => row.element === '火') : [];
  const shuFireStage = matches('shu') && ['丁未', '丙午', '乙巳', '甲辰'].includes(luckPillar);
  const winterMoving = shuFireStage ? base.remedyMovingComponents : leading;
  const winterWealth = winterMoving.filter(row => ['正财', '偏财'].includes(row.god));
  const winterWealthFeedsFire = movingContacts.filter(link => winterWealth.includes(link.from)
    && winterFire.some(row => row === link.to) && link.relation === '生');
  const winterFireLuck = winterFire.length ? movingContacts.filter(link => winterMoving.includes(link.from) && link.from.element === '火'
    && ['正官', '七杀'].includes(link.from.god) && link.to.kind === '日干' && link.relation === '克')
    .map(link => ({ fire: link.from, day, waterChecks: natalContacts.filter(contact => contact.to === link.from
      && monthFood.some(row => row === contact.from) && contact.relation === '克').map(contact => contact.from),
    movingWealth: winterWealth.filter(wealth => baziStemFeeds(wealth.stem, link.from.stem)) }))
    .filter(row => row.waterChecks.length > 0) : [];
  const shuSealPeer = matches('shu') && ['己酉', '戊申'].includes(luckPillar) && sealLuck.includes(movingStem)
    && mainQi.element === day.element ? supportsDay : [];
  const foodLuckRoutes = [
    (supportsDay.length > 0 || luckOutputFeedsWealth.length > 0 || monthFoodFeedsLuckWealth.length > 0 || authorityPressure.length > 0)
      && monthFoodWealth.length > 0 && 'food-wealth-or-support',
    liangContrast && 'liang-authority-contrast',
    liangFoodWealth && 'liang-reviewed-food-wealth',
    xieLuck && xieLuck.namedSupport.length > 0 && 'xie-body-support',
    !sourceBodyHeavy && sealChecksOutput.length > 0 && 'seal-checks-wealth-feeding-output',
    !sourceBodyHeavy && robberyChecksWealth.length > 0 && 'robbery-checks-food-fed-wealth',
    shenSourceFoodBody && 'shen-stem-branch-contrast',
    gongSourceFoodBody && 'gong-support',
    noSealKiller.length > 0 && supportsDay.length > 0 && 'food-killer-support',
    liuSupport.length > 0 && 'liu-weak-day-support',
    outputChecksKiller.length > 0 && 'output-checks-killer',
    wealthFeedsKiller.length > 0 && 'wealth-feeds-killer',
    !huOvercontrol && wealthFeedsKiller.length > 0 && 'wealth-remedies-overcontrol',
    sealRescue.length > 0 && 'seal-contacts-food-killer-and-day',
    secondarySealRescue.length > 0 && 'secondary-seal-contacts-food-killer-and-day',
    huAuthority.length > 0 && 'hu-authority-contrast',
    huEarth.length > 0 && 'hu-earth-contrast',
    huSealTriplet && 'hu-fire-wood-support',
    huReviewedLuck && 'hu-reviewed-luck',
    summerWater.length > 0 && 'summer-water-to-wood-and-fire',
    qianLuck && (qianLuck.branchFeedsSeal || qianLuck.wealthAttacksSeal) && 'qian-seal-contrast',
    huangSupport.length > 0 && 'huang-support-without-native-seal',
    liLuck && 'li-overheavy-earth-contrast',
    foodSealWealth.some(row => row.movingWealth.length || row.movingOutput.length) && 'wealth-reaches-food-controlling-seal',
    foodSealWealth.some(row => row.secondaryWealth.length) && 'secondary-wealth-reaches-food-controlling-seal',
    foodSealWealth.some(row => row.movingSeal.length || row.movingAuthority.length) && 'seal-or-authority-against-food-remedy',
    (winterWealthFeedsFire.length > 0 || winterFireLuck.length > 0) && 'winter-wealth-or-fire',
    shuSealPeer.length > 0 && 'shu-seal-peer-contrast',
  ].filter(route => typeof route === 'string');
  const foodLuckPaths = monthFood.length ? { monthFoodWealth, supportsDay, luckOutputFeedsWealth, monthFoodFeedsLuckWealth, authorityPressure,
    liangContrast, liangSourceRenCounterfactual, sourceBodyHeavy, xieLuck, sealChecksOutput, robberyChecksWealth, shenLuck, gongSupport,
    shenSourceFoodBody, gongSourceFoodBody, noSealKiller, outputChecksKiller,
    wealthFeedsKiller, sealRescue, secondarySealRescue, huEarth, huAuthority, huSealTriplet, huStemSealTriplet, liuSupport, liuSourceSupport,
    foodKillerDay: noSealKiller.length ? day : undefined, huOvercontrol, liuWeakDay,
    rootlessBingShenSource, bingShenReviewedSealAid } : undefined;
  return { profile: zpqzFoodKillerPolicy.profile, timeKnown, dayMaster: base.dayMaster, natalPillars: base.natalPillars,
    monthHiddenGods: base.monthHiddenGods, monthFoodCandidate, foodRows, hurtRows, wealthRows, sealRows, killerRows,
    foodExposed: god('食神').exposed, hurtExposed: god('伤官').exposed, wealthPresent: base.wealthPresent,
    wealthExposed: base.wealthExposed, sealsPresent: base.sealsPresent, noSeal, killerPresent,
    foodKillerNoSeal: conjunction(monthFoodCandidate, killerPresent, noSeal),
    hasMonthFoodChecksExposedKiller: seen(noSealKiller.some(pair => pair.to.kind === '透干')),
    hasLiangSourceRenCounterfactualFireWealth,
    strongFoodKillerExcluded: huOvercontrol || liuWeakDay || Boolean(rootlessBingShenSource),
    hasRootedFoodKillerOutput: base.hasRootedFoodKillerOutput,
    hasRootedFoodKillerWealth: base.hasRootedFoodKillerWealth,
    wealthRemedyReviewedActions: timeKnown ? wealthRemedyReviewedActions : undefined, foodSealRemedySourceExcluded,
    namedHuEarthWarning: timeKnown ? huEarth.length > 0 : undefined,
    hasHuStemSealTriplet: seen(Boolean(huStemSealTriplet)),
    namedLiuWeakDay: timeKnown ? liuWeakDay : undefined,
    foodLuckRoutes, foodLuckPaths,
    foodWealthPairs, foodKillerPairs: contacts(outputRows, killerRows, '食伤制杀'),
    wealthKillerPairs: contacts(wealthRows, killerRows, '财生杀'), sealOutputPairs: base.sealOutputContacts,
    roots: order.roots, natalFivePairs: order.natalFivePairs, movingFivePairs: order.movingFivePairs,
    natalRenDingWealthPairs,
    summerWood, fireOutputPresent: seen(outputRows.some(row => row.element === '火')),
    hasSummerJiaReviewedWaterSeal: seen(summerJiaReviewedWaterSeal.length > 0),
    hasSummerYiReviewedWaterSeal: seen(Boolean(summerYiReviewedWaterSeal)),
    hasSummerYiFireFormationWaterSeal,
    summerYiFireFormationSolsticePhase: hasSummerYiFireFormationWaterSeal ? summerYiSolstice?.phase ?? 'unverified' : undefined,
    winterMetalWaterFoodCandidate,
    foodClimateEvidence: { summerWater, summerFireSource, summerJiaReviewedWaterSeal, summerYiReviewedWaterSeal, summerYiFireFormationWaterEvidence,
      nativeWaterSeals: summerWood ? waterSeals : [],
      qianLuck, huangSupport, liLuck,
      foodSealWealth, foodSealSourceComparison, winterWealthFeedsFire, winterFireLuck, shuSealPeer },
    printedFoodSealSeparate,
    natalWoodMembers,
    woodCompleteNatal: seen(natalWoodMembers.every(row => row.natalPositions.length > 0)),
    woodCompleteWithLuck: seen(natalWoodMembers.every(row => row.natalPositions.length > 0 || row.luckPresent)),
    printedCases, ...printedLuck,
    sourceVariants: printedCases.flatMap(row => {
      const variant = sourceVariants[row.id];
      return row.matches && variant ? [variant] : [];
    }),
    luckPillar, luckTenGod: base.luckTenGod, luckBranchMainQiGod: base.luckBranchMainQiGod,
    strengthVerified: false, remedyVerified: false, climateVerified: false, transformationVerified: false };
}
