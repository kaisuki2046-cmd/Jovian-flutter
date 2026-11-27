import { createHash } from 'node:crypto';
import { baziStemPhase } from '../../control/charts.ts';
import { normalizeRuleInput } from './matching.mjs';

export const baziClassicalStructureProfile = 'bazi-yuanhai-ziping-structures-v1';
const labels = {
  bothVirtues: '原局天德及月德俱见',
  virtuesAndSeal: '天德月德俱见且印星实见',
  hourLuWithOfficer: '日禄在时支且年月见正官',
  yiShenUnbroken: '乙日申月且四支无冲破',
  bingXinYou: '丙日逢辛酉月',
  xinSi: '辛日逢巳月丙火本气',
  jiaSpringTigerRabbit: '甲日生于春月且四支寅卯各一',
  foodRootedWealth: '月令食神本气且财透有同干根',
  foodHiddenHurtingShown: '月令食神伏藏且伤官透干',
  foodMixedWealth: '月令食神本气且正偏财皆透并有财根',
  foodKillingSeal: '月令食神伏藏且杀印同透、财未出库',
  foodSingleKilling: '月令食神本气且单露七杀、无印财未出库',
  metalWaterFoodKilling: '金水食神当令且七杀透干、财印未透',
  foodBetweenWealthAndKilling: '月令食神本气、年透财月透食时透七杀',
  spacedWealthAndSeal: '月令正官无刑冲破害、月印时财隔日干',
  metalWaterHurtingWithOfficer: '金水伤官当令、财印官各透而伤官不透',
  rootlessWealth: '四柱各见财、财当令且日主无根无官杀',
  rootlessKilling: '四柱各见七杀、杀当令且日主无根无印食伤',
  woodFireYinMonth: '寅月透甲及丙丁之一且原局无金水',
  rootedKillingAndWealth: '卯月甲日、庚杀与财实透通根、无癸',
  gengWealthWithPeer: '卯月庚日无金根、四柱见财而独透一庚比肩',
};
export { labels as baziClassicalStructureNames };

const configuration = name => ({ kind: 'bazi_natal_configuration', name });
const strong = { kind: 'day_master_strength', result: '偏强', profile: 'monthly-weighted-strength-v1' };
const vigorous = group => ({ kind: 'bazi_ten_god_strength', group, profile: 'anchored-weighted-ten-god-v1', strength: '旺' });
const structure = name => ({ kind: 'bazi_ten_god_structure', name });

const reviewed = new Map([
  ['yhzp-v2-c002-p034-001', ['33b5ff3c95ad9e49ed58673fb1957f7992ddc9aaabf24e43b0c4a491a6f94dea', null,
    [strong, vigorous('财星'), structure('财官相生')]]],
  ['yhzp-v2-c002-p077-001', ['84517d41d714392d57a6ae21095d95bd1cb1b58616cd38c7d110a3fc9c005b26', null,
    [configuration(labels.virtuesAndSeal)]]],
  ['yhzp-v2-c002-p100-101', ['1d27672ed33b81cc4e5a5b7f2b6b30dc2d39bdd6396f528981b992aa6133e556', "若見官星，則剝祿矣",
    [configuration(labels.hourLuWithOfficer)]]],
  ['yhzp-v2-c002-p118-101', ['091794937dcc65cc19973286ca2a2e2bc052f938cfefaac9fb65c4ecb107d32e', null,
    [configuration(labels.bothVirtues)]]],
  ['yhzp-v2-c002-p137-001', ['757c44475702eef5df2a230de6a1fae767143b5aa390bdf849dbe4c1e1f87411', "乙逢庚旺，常存仁義之風。",
    [configuration(labels.yiShenUnbroken)]]],
  ['yhzp-v2-c002-p139-001', ['d694abb6231df5a5d9560d67840bfb7d25c0cc9a60edf24e6200294c952cfe75', "丙合辛生，鎮掌威權之職。",
    [configuration(labels.bingXinYou)], [configuration(labels.xinSi)]]],
  ['yhzp-v2-c002-p149-101', ['faa73d99b407e89e33c089efd2c8d93679c4aebfb992e847c3e4af764bebda4b', "甲曰：生居春月，柱逢寅卯二重。温良性格定慈心",
    [configuration(labels.jiaSpringTigerRabbit)]]],
  ['zpzq-v1-c038-p001-001', ['168ce3e2df19499bd2621e13b57e1d9b0b7c7927a255bd15c77ab3680ac46e70', '财要有根，不必偏正叠出',
    [configuration(labels.foodRootedWealth)]]],
  ['zpzq-v1-c038-p004-001', ['06ffd744deb7265d5db1cac10a458855b9740e6d78b314b9cc164ebff9593dfb', null,
    [configuration(labels.foodHiddenHurtingShown)]]],
  ['zpzq-v1-c038-p005-201', ['44c27319ce4d830031cfb47082d1d55387acba1c3d72e28627fa8d5fb1745ec0', null,
    [configuration(labels.foodMixedWealth)]]],
  ['zpzq-v1-c038-p009-001', ['16414e0148b3997248a61772df01a7d4a23a4a4f1a476673515f0a0f098507c3', "若不用财而就煞印，最为威权显赫。",
    [configuration(labels.foodKillingSeal), structure('杀印相生')]]],
  ['zpzq-v1-c038-p010-201', ['2244973de7c51b9f31d0785338117617b162b422104bee4d7a332ce973c98341', "若无印绶而单露偏官，只要无财，亦为贵格",
    [configuration(labels.foodSingleKilling), structure('食神制杀')]]],
  ['zpzq-v1-c038-p012-001', ['df23568e9eb38ff8b9b83199f0fe6e7411612063916969dbbc1b9e42d51ce7cd', "若金水食神而用煞，贵而且秀",
    [configuration(labels.metalWaterFoodKilling), structure('食神制杀')]]],
  ['zpzq-v1-c038-p018-001', ['02a6d6ae89c443d204380634b383253cac6ddfbf79fa638fbcb9e62e71c16e34', null,
    [configuration(labels.foodBetweenWealthAndKilling)]]],
  ['zpzq-v1-c032-p002-001', ['734adc725ab6cc9eff3e6cde5d59c140ae6178cbc7743b1b4615429f81d3757a', "以财印并透者论之，两不相碍，其贵也大。",
    [configuration(labels.spacedWealthAndSeal)]]],
  ['zpzq-v1-c042-p015-201', ['9ba37c3ca614c2a7a6e510ccb5101242d2998a7cb2f7889caaaaab59686433c1', "有伤官用官者，他格不用，金水独宜，然要财印为辅，不可伤官并透。",
    [configuration(labels.metalWaterHurtingWithOfficer)]]],
  ['zpzq-v1-c048-p013-001', ['831669f9270c9072688ed5db22e817ba529ae1d1b01936c491184e360fdf3bbf', "四柱皆财而身无气，舍而从之，格成大贵。",
    [configuration(labels.rootlessWealth)]]],
  ['zpzq-v1-c048-p014-201', ['aa787b0a9b0d8496f99be3bb29614ac2b57a2f4b38e03db87572dca6e2964401', "有弃命从煞者，四柱皆煞，而日主无根，舍而从之，格成大贵。",
    [configuration(labels.rootlessKilling)]]],
  ['dtsjy-v1-c025-p002-001', ['cc703a1a90fb0067bc573abc89025d64cda5642e645881dd08cdb78e7fdcb227', "則真神得用，不爲忌神所害",
    [configuration(labels.woodFireYinMonth)]]],
  ['qtbj-v2-c004-p007-001', ['cd7f94c33d649b6efd48b3d66913973c64d2e005631758d4b37c8e58e7998ecd', '庚金得所，名阳刃驾杀',
    [configuration(labels.rootedKillingAndWealth)]]],
  ['qtbj-v5-c068-p003-101', ['ed4b9d592e2470e6b6451715e496a48c8468501cc284fa2a41fa0f5d6520e8d5', '若见一比，又主孤贫。',
    [configuration(labels.gengWealthWithPeer)]]],
]);

export function compileBaziClassicalStructures(claim) {
  const spec = reviewed.get(claim.id);
  if (!spec) return undefined;
  const [expected, text, ...groups] = spec;
  const { source, conditions, evidence } = claim;
  const hash = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (hash !== expected || (text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '已核本命结构所据的原文、出处或条件有变化，须重新核对。' };
  }
  const inputs = groups.map(required => normalizeRuleInput('bazi', { required }));
  if (!text) return { compiler: baziClassicalStructureProfile, inputs };
  return { reason: 'unmapped_condition', condition: '按原书已复核的本命盘式取材',
    branches: [{ text, conditionCompiler: baziClassicalStructureProfile, inputs }] };
}

const isWealth = tenGod => ['正财', '偏财'].includes(tenGod);
const isSeal = tenGod => ['正印', '偏印'].includes(tenGod);

export function baziClassicalStructureFacts({ L1, L2 }, bothVirtues) {
  const [year, month, day, hour] = L1.pillars;
  const outer = [year, month, hour];
  const dayStem = day.stem.name;
  const monthMain = month.hiddenStems[0];
  const sealVisible = outer.some(pillar => isSeal(pillar.tenGod));
  const sealHidden = L1.pillars.some(pillar => pillar.hiddenStems.some(stem => isSeal(stem.tenGod)));
  const killingCount = outer.filter(pillar => pillar.tenGod === '七杀').length;
  const foodVisible = outer.some(pillar => pillar.tenGod === '食神');
  const foodMonth = monthMain.tenGod === '食神';
  const exposedWealth = outer.filter(pillar => isWealth(pillar.tenGod));
  const roots = new Set(L1.pillars.flatMap(pillar => pillar.hiddenStems.map(stem => stem.name)));
  const exposedStems = new Set(outer.map(pillar => pillar.stem.name));
  const rootedWealth = exposedWealth.some(wealth => roots.has(wealth.stem.name));
  // In the Hu and Chang examples, wealth is unexposed in the subsidiary
  // qi of a storage branch. Exposed, main-qi and other branch wealth block this reading.
  const wealthInUse = exposedWealth.length > 0 || L1.pillars.some(pillar =>
    pillar.hiddenStems.some((stem, index) => isWealth(stem.tenGod) && (index === 0 || !'辰戌丑未'.includes(pillar.branch.name))));
  const earlyOfficer = [year.tenGod, month.tenGod, monthMain.tenGod].includes('正官');
  const branchNames = L1.pillars.map(pillar => pillar.branch.name);
  const noClashOrBreak = !L2.stemBranchRelations.branches.some(relation =>
    relation.state === 'complete' && ['六冲', '相破'].includes(relation.type));
  const monthIsClear = !L2.stemBranchRelations.branches.some(({ state, type, positions }) =>
    state === 'complete' && positions.includes('month') && ['六冲', '六害', '相破', '相刑', '三刑', '自刑'].includes(type));
  const financeBindsSeal = L2.stemBranchRelations.stems.some(({ combination, positions }) =>
    combination === '五合' && positions.includes('month') && positions.includes('hour'));
  const hasGod = (...names) => L1.tenGodIndex.some(({ name, exposed, hidden }) =>
    names.includes(name) && (exposed.length > 0 || hidden.length > 0));
  const eachPillarHas = (...names) => L1.pillars.every(({ tenGod, hiddenStems }) =>
    names.includes(tenGod) || hiddenStems.some(stem => names.includes(stem.tenGod)));
  const wealthInFourPillars = eachPillarHas('正财', '偏财');
  const follows = L2.assessments.patterns.specialCandidates.从势
    && !outer.some(pillar => ['比肩', '劫财'].includes(pillar.tenGod));
  const noMetalOrWater = ![dayStem, ...exposedStems, ...roots].some(stem => '庚辛壬癸'.includes(stem));

  const conditions = {
    bothVirtues,
    virtuesAndSeal: bothVirtues && (sealVisible || sealHidden),
    hourLuWithOfficer: earlyOfficer && baziStemPhase(dayStem, hour.branch.name) === '临官',
    yiShenUnbroken: dayStem === '乙' && month.branch.name === '申' && noClashOrBreak,
    bingXinYou: dayStem === '丙' && month.ganZhi === '辛酉',
    xinSi: dayStem === '辛' && month.branch.name === '巳' && monthMain.name === '丙',
    jiaSpringTigerRabbit: dayStem === '甲' && '寅卯辰'.includes(month.branch.name)
      && ['寅', '卯'].every(branch => branchNames.filter(name => name === branch).length === 1),
    foodRootedWealth: foodMonth && rootedWealth,
    foodHiddenHurtingShown: foodMonth && !foodVisible && outer.some(pillar => pillar.tenGod === '伤官'),
    foodMixedWealth: foodMonth && rootedWealth
      && new Set(exposedWealth.map(pillar => pillar.tenGod)).size === 2,
    foodKillingSeal: foodMonth && !foodVisible && killingCount > 0 && sealVisible && !wealthInUse,
    foodSingleKilling: foodMonth && killingCount === 1 && !outer.some(pillar => pillar.tenGod === '正官')
      && !sealVisible && !sealHidden && !wealthInUse,
    metalWaterFoodKilling: foodMonth && '庚辛'.includes(dayStem) && killingCount > 0 && !sealVisible && !exposedWealth.length,
    foodBetweenWealthAndKilling: foodMonth && isWealth(year.tenGod) && month.tenGod === '食神' && hour.tenGod === '七杀',
    spacedWealthAndSeal: monthMain.tenGod === '正官' && monthIsClear
      && isSeal(month.tenGod) && isWealth(hour.tenGod) && !financeBindsSeal
      && !hasGod('七杀') && year.tenGod !== '伤官',
    metalWaterHurtingWithOfficer: '庚辛'.includes(dayStem) && month.branch.element === '水' && monthMain.tenGod === '伤官'
      && sealVisible && exposedWealth.length === 1 && outer.some(pillar => pillar.tenGod === '正官'),
    rootlessWealth: follows && isWealth(monthMain.tenGod) && wealthInFourPillars
      && !sealVisible && !hasGod('正官', '七杀'),
    rootlessKilling: follows && monthMain.tenGod === '七杀' && eachPillarHas('七杀')
      && !outer.some(pillar => pillar.tenGod === '正官') && !hasGod('食神', '伤官', '正印', '偏印'),
    woodFireYinMonth: month.branch.name === '寅' && noMetalOrWater
      && exposedStems.has('甲') && (exposedStems.has('丙') || exposedStems.has('丁')),
    rootedKillingAndWealth: dayStem === '甲' && month.branch.name === '卯' && rootedWealth
      && exposedStems.has('庚') && roots.has('庚') && !exposedStems.has('癸') && !roots.has('癸'),
    gengWealthWithPeer: dayStem === '庚' && month.branch.name === '卯' && wealthInFourPillars
      && !roots.has('庚') && !roots.has('辛') && !sealVisible && !hasGod('正官', '七杀')
      && ['甲', '乙'].every(stem => exposedStems.has(stem) || roots.has(stem))
      && outer.filter(({ stem }) => stem.name === '庚').length === 1 && !exposedStems.has('辛')
      && L2.assessments.dayMasterStrength.result === '偏弱',
  };
  return Object.entries(conditions).filter(([, passed]) => passed).map(([key]) => configuration(labels[key]));
}
