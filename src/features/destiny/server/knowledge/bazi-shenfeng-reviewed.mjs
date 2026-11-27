import { createHash } from 'node:crypto';
import { LunarUtil } from 'lunar-javascript';
import { baziStemPhase } from '../../control/charts.ts';
import { normalizeRuleInput } from './matching.mjs';
import { balance, branchAt, stemAt, vigor, weak } from './qtbj-counted-passages.mjs';

export const shenfengReviewedProfile = 'bazi-shenfeng-reviewed-configurations-v1';
const prefix = 'muxuan-v1-';
const strong = { kind: 'day_master_strength', result: '偏强', profile: 'monthly-weighted-strength-v1' };
const structure = name => ({ kind: 'bazi_ten_god_structure', name });
const configuration = name => ({ kind: 'bazi_natal_configuration', name });
const tenGodCount = (tenGod, count) => ({ kind: 'bazi_ten_god_count', tenGod, count });
const pillarAt = (position, ganZhi) => ({ kind: 'pillar', position, ganZhi });
const gender = gender => ({ kind: 'natal_gender', gender });
export const shenfengSpringWoodWithFire = configuration('甲乙日生寅卯月且天干见火');
export const shenfengLayeredSealWithOfficer = configuration('月支本气生身且年时见印并见正官');
export const shenfengOutputWithoutOfficer = configuration('月令本气伤官且原局无正官');
const labels = {
  vaultWealth: '四库月藏财同干透出',
  voidWealth: '正财所在柱落日旬空亡',
  yearOwl: '年柱见偏印且全局见食神',
  singleHourKilling: '四柱仅时干透一七杀',
  layeredSeal: '月支本气生身且年时见印无官杀',
  foodBeforeKilling: '月支有食神且时干透七杀',
  haiWoodTrine: '亥月四支齐见亥卯未',
  exposedKillingHiddenOfficer: '七杀透干而正官只藏支',
  exposedOfficerHiddenKilling: '正官透干而七杀只藏支',
  jiaBladeCombines: '甲日庚杀透干且卯中乙合庚',
  renBladeCombines: '壬日时干戊杀见癸干相合',
  officerWithCombinedKilling: '甲日卯时乙合所透庚且正官同见',
  monthKilling: '月柱七杀透干或居月令本气',
  hourKilling: '时干透七杀',
  horaryFood: '时干七杀且年干月干或月支本气见食神',
  horaryBlade: '甲日时干庚或壬日时干戊且岁月有相合刃神',
  rootlessKilling: '庚日时干丙无生旺库根且原局无财',
  rootedKillingWithWealth: '庚日时干丙见寅午戌三合及财星',
  cleanMonthOfficer: '月令见正官且四支无冲刑破害',
  hourOfficer: '时干透正官或时支本气为正官',
  monthLu: '日干临官在月支',
  bladeWithKilling: '阳日月令见刃且七杀透干',
  outputWithWealth: '月令本气伤官且原局见财',
  outputWithoutWealth: '月令本气伤官且原局无财',
  concealedMonthOfficer: '月支本气正官且四干无正官透出',
  repeatedEarth: '至少三柱见土且至少两干透土',
  repeatedWealth: '至少两柱见透藏财星',
  undamagedOfficerSeal: '原局官印无破且四支无冲刑破害',
  visibleFoodAtLu: '原书所列甲乙日透食神并见食神禄支',
  foodAtLuWithoutOfficerOrClash: '食神透干见禄且无正官与支刑冲',
  outputMonth: '月支本气为伤官',
  noOfficerAndKilling: '原局四柱无透藏官杀',
  properOfficerInVoid: '正官所在柱落日旬空亡',
  killingInVoid: '七杀所在柱落日旬空亡',
  virtualYearOfficer: '年干正官且月干及月支本气无正官',
};
const blades = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
const pillarNames = { year: '年', month: '月', day: '日', hour: '时' };
const pillarOutput = position => configuration(pillarNames[position] + '柱见透藏伤官');

// 月支正财格 lists these day stems and months. Use the same passage's
// "身居临官地旺" form with the day master actually sitting on its own phase.
const properWealthMonths = [
  ['甲寅', '午'], ['乙卯', '巳'], ['丙午', '酉'], ['丁巳', '申'], ['戊午', '子'],
  ['己巳', '亥'], ['庚申', '卯'], ['辛酉', '寅'], ['壬子', '午'], ['癸亥', '巳'],
].map(([day, month]) => [pillarAt('day', day), branchAt('month', month)]);
const dedicatedWealth = [
  [stemAt('day', '甲'), pillarAt('hour', '己巳')],
  ...[['庚辛', '寅卯'], ['壬癸', '巳午'], ['丙丁', '申酉'], ['戊己', '亥子']].flatMap(([days, hours]) =>
    [...days].flatMap(day => [...hours].map(hour => [stemAt('day', day), branchAt('hour', hour)]))),
];
const pairedWealthOfficer = ['壬午', '癸巳'].map(ganZhi => pillarAt('day', ganZhi));
const strongFireWithMetal = [...'丙丁'].map(day => [stemAt('day', day), strong, { kind: 'bazi_natal_element', element: '金' }]);
const weakWithWealth = [[weak, vigor('财星')]];
const officerPlacement = [
  ['露杀藏官', [[configuration(labels.exposedKillingHiddenOfficer)]]],
  ['露官藏杀', [[configuration(labels.exposedOfficerHiddenKilling)]]],
];
const maleOutputWithWealth = [[gender('男'), configuration(labels.outputWithWealth)]];
const femaleOutputWithoutOfficer = [[gender('女'), shenfengOutputWithoutOfficer]];
const femaleOutputWithWealthAndSeal = [[gender('女'), configuration(labels.outputWithWealth),
  vigor('财星'), structure('印绶护身')]];
const cleanMonthOfficer = ['甲酉', '乙申', '乙巳', '丙子', '丁亥']
  .map(([day, month]) => [stemAt('day', day), branchAt('month', month), configuration(labels.cleanMonthOfficer)]);
const strongWithPeers = [2, 3, 4].map(count => [strong, vigor('比劫'), tenGodCount('比劫', count)]);
const lightWealthStrongPeers = [['甲乙', '土'], ['丙丁', '金'], ['戊己', '水'], ['庚辛', '木'], ['壬癸', '火']]
  .flatMap(([stems, element]) => [...stems].map(day => [stemAt('day', day), strong, balance(element, '少量'), vigor('比劫')]));
const autumnMetalHeavyEarth = [...'庚辛'].flatMap(day => [...'申酉戌'].map(month => [
  stemAt('day', day), branchAt('month', month), configuration(labels.repeatedEarth),
]));
const wealthyWeakWithSeal = [weak, configuration(labels.repeatedWealth), vigor('财星'), structure('印绶护身')];
const officerSealWithoutDamage = [[configuration(labels.undamagedOfficerSeal), structure('官印相生'), structure('印绶护身')]];
const wealthGeneratesOfficer = [strong, vigor('财星'), structure('财官相生')];

// Source digest pins the supplied extract. Review of the named passages was
// made against the distinct text of 神峰通考, so only the verified clause is quoted.
const reviewed = new Map([
  ['f011-p00090-001', ['f29c6f884f1b9d2979c0b6676141157ad8bae57a6a747657e2c2385dd6926e30',
    ['多财杀', [[stemAt('day', '乙'), branchAt('month', '戌'), vigor('财星'), vigor('七杀')]]],
  ]],
  ['f011-p00142-001', ['b3ce44dd681bdca553dbaf848a288a2735fbba6d22787dcc7444b971d95d04dc',
    ['财杀真', [['壬', '甲'], ['甲', '壬']].map(([year, hour]) =>
      [stemAt('day', '戊'), branchAt('month', '亥'), stemAt('year', year), stemAt('hour', hour)])],
  ]],
  ['f011-p00155-001', ['de179cfd946988de77a94946b6e4ccd6e41371171bdcb17f4d40d06549ba9900',
    ['杀相逢', [[stemAt('day', '己'), branchAt('month', '未'), vigor('七杀')]]],
  ]],
  ['f011-p00223-001', ['af0ad72f94f95504972beb85fd28d1e7cae141a2566dbe083296c2e2886818f5',
    ['杀星强', [[stemAt('day', '癸'), branchAt('month', '未'), vigor('七杀')]]],
  ]],
  ['f006-p00076-001', ['d1144f334735b86cf1b3db84d6085da8f0faa0c2bc617274399473bb8b44e0ce',
    ['身强杀浅', [[strong, configuration(labels.singleHourKilling)]]],
  ]],
  ['f006-p00082-001', ['91cc045eaf9c41f95d71e87c20f12e073ef22b8a8d2433149d3f8f1a65708355',
    ['庚辛日生申酉戌月，土重重', autumnMetalHeavyEarth],
  ]],
  ['f007-p00044-001', ['8338a2743d316d8bb0e685e76a77effb71e1c11cb72c53533ff58351d5b9afd9',
    ['财星当令或透干，日主有气', properWealthMonths],
  ]],
  ['f007-p00048-001', ['bacbd08be83a93f443e2b7ec6e407da37f4621b4490ed8f90f9626f346a43679',
    ['定因财旺生官', [wealthGeneratesOfficer]],
  ]],
  ['f007-p00050-001', ['bb52ce4ba529f3372e58ee80aaa3ecbf78bfb3876fbeb78889a1e1250346ddbf',
    ['丙丁日干身旺，见庚辛金', strongFireWithMetal],
  ]],
  ['f007-p00056-001', ['805f0820f081bdc9398459de660d79b7cfa492d6b890172b95e4e17a470fd63b',
    ['日时秀气见财星专位（甲日己巳时、庚辛日寅卯时、壬癸日巳午时、丙丁日申酉时、戊己日亥子时）', dedicatedWealth],
  ]],
  ['f007-p00058-001', ['7506ac796b1c6fbcc4903bd97bb48b516d86e42d62cd4b9735f52458d9e37754',
    ['壬午癸巳二日', pairedWealthOfficer.map(day => [day])],
    ['喜生秋冬通金水月气', pairedWealthOfficer.flatMap(day => [...'申酉亥子'].map(branch => [day, branchAt('month', branch)]))],
    ['生亥月最喜亥卯未伤官木局', pairedWealthOfficer.map(day => [day, configuration(labels.haiWoodTrine)])],
  ]],
  ['f007-p00059-001', ['62b33e026845b4c587cb613d0769ecffc812350d0fe9d7a0990f6be916690525',
    ['透出库中何物方定用神（透财作杂气财官）', [[configuration(labels.vaultWealth)]]],
  ]],
  ['f007-p00066-001', ['76895ec2da05a5ab343c6df5bedb22aa61f5530a4cb64b489e595ecd286b8d8a',
    ['财旺而日主弱', weakWithWealth],
  ]],
  ['f007-p00067-001', ['70d1c68f5b2a40fe7a3cbe92057f9c52eedf6d8e0ea4219e49f423e9e425b50f',
    ['身弱逢财太旺', [[weak, configuration(labels.repeatedWealth), { ...vigor('财星'), strength: '过盛' }]]],
  ]],
  ['f007-p00069-001', ['4072c964b5c94cb92c9f39a15d45c58c8c126dbe7494fa13d4af1019deef7f28',
    ['财轻而比肩劫财重', lightWealthStrongPeers],
  ]],
  ['f007-p00070-001', ['cc172f2ea41fd65747d7d5e3f84a028786b176afe187c1b9ea79b279890141f4',
    ['财星坐空亡之地', [[configuration(labels.voidWealth)]]],
  ]],
  ['f007-p00071-001', ['e88161efeb61c89e484202e68d10b845eaacb61ab73dfaf60a0e24d776809eb6',
    ['甲寅乙卯之类干支同气', ['甲寅', '乙卯'].map(ganZhi => [pillarAt('day', ganZhi)])],
  ]],
  ['f007-p00072-001', ['143442159a6f6120dc80ccfa017692f0fb450bfd7265002c4082e802103e32cf',
    ['身旺比劫重重', strongWithPeers],
  ]],
  ['f007-p00081-001', ['9768b40e5ea2f8614b8745f482e55c48d7fb72b4af643401e93267615e6ddbad',
    ['财多身弱有印绶相生', [wealthyWeakWithSeal]],
  ]],
  ['f007-p00082-001', ['566ed58f64b3afb9af3b09e2b611cfd1e6bb73ee9ca4483b5d1615456157bd71',
    ['伤官格见财星', [[configuration(labels.outputWithWealth)]]],
  ]],
  ['f009-p00072-001', ['cd37431a19b93ccf8757e8ee4422bf136cf5e01069824519418054f91a0a4611',
    ['枭神在年柱（祖位）', [[configuration(labels.yearOwl)]]],
  ]],
  ['f009-p00049-001', ['25c91d3588b373ed04c2ae77568cc46e7fe6f623be204eee4b95836a83f47ced',
    ['财旺印生', femaleOutputWithWealthAndSeal],
  ]],
  ['f009-p00071-001', ['be1d520492a2289548bca20b862a798b73fcfb30f168f42d5afdd4de21684829',
    ...Object.entries(pillarNames).map(([position, name]) => [name + '带伤官', [[pillarOutput(position)]]]),
  ]],
  ['f009-p00080-001', ['cd2ee309481b4ebfbfc25ce45b62434858f890eb37866aa3f7fa13182b9478f4',
    ['时柱偏官，岁月有食神制或刃合', [
      [configuration(labels.horaryFood)], [configuration(labels.horaryBlade)],
    ]],
  ]],
  ['f009-p00081-001', ['2017adbab7bc85f408ebea7baee32f13181935e59eaf7152a1a98a49192538a7',
    ['时上一位杀星', [[configuration(labels.singleHourKilling)]]],
  ]],
  ['f009-p00083-001', ['db958d114ce71f45acb95dbb887c968680d5365377ea2133ba6cff15bfc553ae',
    ['印绶重重无官星', [[configuration(labels.layeredSeal)]]],
  ]],
  ['f009-p00091-001', ['04aaf6f5078126077c7caa7ed4a6497de2e249f354233733334036d633ab7761',
    ['官印双全无刑冲破害', officerSealWithoutDamage],
  ]],
  ['f009-p00092-001', ['08f75c7b90a433de02ea84f365719c65bd592e4c909381c5608d4e95caaf41f6',
    ['伤官格配印', [[configuration(labels.outputMonth), weak, structure('印绶护身')]]],
  ]],
  ['f009-p00093-001', ['c6e160c40fcbb9e0e7a995a8ac298f771136b7f94cc5f534950aec51b50880e9',
    ['食神当令或透干、日干自旺', [...'甲乙'].map(day =>
      [stemAt('day', day), strong, configuration(labels.visibleFoodAtLu)])],
  ]],
  ['f009-p00094-001', ['71c4108a887ebbce52fa0d1e6cf765cb4d57fcd180d3d3f1a9e41268a95c5b74',
    ['印绶重重无官星', [[configuration(labels.layeredSeal)]]],
  ]],
  ['f009-p00095-001', ['f776b07ae8dd90d57dd400ab4b7574f8209af632032a170701ded480331b5248',
    ['有食伤秀气而无官星', ['食神', '伤官'].map(group => [vigor(group), configuration(labels.noOfficerAndKilling)])],
  ]],
  ['f009-p00096-001', ['57b52cd14fb3acfd6124cbef6e9a3124ef10d62f04ca004ef920c99b8be5e0ee',
    ['官星七煞落空亡', [[configuration(labels.properOfficerInVoid)], [configuration(labels.killingInVoid)]]],
  ]],
  ['f009-p00123-001', ['91a11eec0a150b11fefeeb4f62f1cbcf6f47de6847c2d3db31143738f1eb5f18',
    ['财旺而日主弱', weakWithWealth],
  ]],
  ['f009-p00125-001', ['3c62ec319a81fc4e904221c192298177b76621c954c8c4fc3fbc6f0e3c3b35b0',
    ['丙丁身旺见庚辛金', strongFireWithMetal],
  ]],
  ['f009-p00128-001', ['4c6cc04ab54657a697510baafdaa97b09290f3a3f640f3f695fee4b8f1c7e9e3',
    ['伤官格无财星', [[strong, shenfengOutputWithoutOfficer, configuration(labels.outputWithoutWealth)]]],
  ]],
  ['f009-p00129-001', ['689741ae8b8bebf17eb1e02667d05c724910b029ff2b48241904b152dfce894e',
    ['有官有印无破', officerSealWithoutDamage],
  ]],
  ['f011-p00050-001', ['9833994dbc075a5d58a9d08a7a595f45d9e6cccfc207ffe8d9a845c47b7bf2b0',
    ['身旺比劫重', strongWithPeers],
  ]],
  ['f011-p00051-001', ['31ff19afd9cfb759b7840e396a22967845084880baf36900cd37065d1ee90ca8',
    ['比劫逢枭食', [[vigor('比劫'), structure('枭印夺食')]]],
  ]],
  ['f011-p00052-001', ['5f1feeebc4f5243198a975566036d01ffdd17b9701112fb540b1d995052e5602',
    ['伤官四柱见', [[tenGodCount('伤官', 4)]]],
  ]],
  ['f011-p00053-001', ['47a687c9af59c12183f3e63a070ce57e17e8f313953797327091a1bc0865fcb3',
    ['财旺暗生官', [[vigor('财星'), structure('财官相生'), configuration(labels.concealedMonthOfficer)]]],
  ]],
  ['f013-p00050-001', ['12df31e65201b0bb30d5ab3d9e109cb249947c4f60e128f99ed51ecf562294ae',
    ['食居先、杀居后', [[configuration(labels.foodBeforeKilling)]]],
  ]],
  ['f013-p00051-001', ['664c4d307a8c345618fc3bbb79cfe55bb1f17f88ff754a6a81424e7cf4bd2750',
    ['偏官有食神制伏', [[configuration(labels.monthKilling), structure('食神制杀')]]],
  ]],
  ['f013-p00054-001', ['2363cb970459769278e82377db2c26dd713498b3a14883cbc20d9dbd92cb6754',
    ['杀一位、制神二三', [2, 3].map(count => [
      configuration(labels.singleHourKilling), tenGodCount('食伤', count), structure('食神制杀'),
    ])],
  ]],
  ['f013-p00069-001', ['befc9c0225894d8f74af614f70b8c8fdf6842a1fd2ba3cc817a535cb9ab41e44',
    ['羊刃合杀', [[configuration(labels.jiaBladeCombines)], [configuration(labels.renBladeCombines)]]],
  ]],
  ['f013-p00077-001', ['b2747d01c4bd1a88e6ed212dbb1add05ca443cda52016b32431a932ca7505828',
    ['时上一点杀星，日干生旺', [[configuration(labels.singleHourKilling), strong]]],
  ]],
  ['f013-p00078-001', ['79671e65d55aba29acb4e4e5096bd7f3a4d36c56848ffdd405cea972af737d4f',
    ['日干弱、时上杀旺', [[configuration(labels.hourKilling), weak, vigor('七杀')]]],
  ]],
  ['f013-p00081-001', ['b07b84740f4a5859b3ed0813719c19c5289c967ae1c1d252cb579da863028c18',
    ['时杀虚露无根、无财生', [[configuration(labels.rootlessKilling)]]],
    ['时杀多根', [[configuration(labels.rootedKillingWithWealth)]]],
  ]],
  ['f013-p00108-001', ['230ad91cebc6049896ed234d5064c9ee2825cc5b09867e5ae6eec4a882475838',
    ...officerPlacement,
  ]],
  ['f013-p00109-001', ['4a6ce85b4488e6977bf88f49c8ca1a5244b7904d9c47069007fb4b6f354c0fb5',
    ['官星七杀交差', [[configuration(labels.officerWithCombinedKilling)]]],
  ]],
  ['f013-p00153-001', ['54576a5c823a281532ecaa73cca99bf71bfe39e2632d9864c5e6dd510e799b13',
    ['七杀有制化为偏官', ['食神制杀', '杀印相生'].map(name =>
      [configuration(labels.singleHourKilling), structure(name)])],
  ]],
  ['f015-p00047-001', ['80f93fad974f1ac9b5d98b17aacb630e6261958dbe0a00c6da475886f0af00db',
    ['火土伤官', [...'丙丁'].map(day => [stemAt('day', day), shenfengOutputWithoutOfficer])],
  ]],
  ['f015-p00063-001', ['d5cfca0639f8a50184bc90cf8b06fe0f6fe99ab0e195b7b53d8cb85049bc6062',
    ['甲乙生寅卯月见火', [[shenfengSpringWoodWithFire]]],
  ]],
  ['f015-p00087-001', ['ad3dd3124c3cbcc017580e329b80b6974ba0fcf903581adaebc131f4f5690e73',
    ['食神不喜见官星并刑冲', [...'甲乙'].map(day =>
      [stemAt('day', day), strong, configuration(labels.foodAtLuWithoutOfficerOrClash)])],
  ]],
  ['f015-p00092-001', ['009efd80017da928badac734ac2b891591a039142c0028753668330849d4f8fd',
    ['一位七杀被两三位食神制', [2, 3].map(count => [
      configuration(labels.singleHourKilling), tenGodCount('食神', count), structure('食神制杀'),
    ])],
  ]],
  ['f015-p00100-001', ['2df0cf5d64121ccb20db99cf4bbbdc9afc8640c443304a44a590477671a6e9b6',
    ['四柱不见官星', [[shenfengOutputWithoutOfficer]]],
  ]],
  ['f015-p00106-001', ['4ead318c28243c6bdbe5cbc382fcf2efc3afc89f13babf791ac936ba9e093801',
    ['女命伤官不见官', femaleOutputWithoutOfficer],
  ]],
  ['f015-p00113-001', ['09abf1f5299b5ecf45eb33a594efa3c7c24a8175a1df003ca4e2c5495d6cc24e',
    ['男命伤官格见财', maleOutputWithWealth],
  ]],
  ['f015-p00114-001', ['e8a4045d8302c5d7384bef540c73932dd0495cbe2776de7ded70b60e97ae46da',
    ['财旺印生', femaleOutputWithWealthAndSeal],
  ]],
  ['f015-p00117-001', ['22376a09f3bc2d6b714feca3e055cce007bbf8a83b0d33b3630705a43437f8da',
    ['伤官无财又比劫重', [[configuration(labels.outputWithoutWealth), vigor('比劫')]]],
  ]],
  ['f015-p00132-001', ['b7d8994f06f08c6857022e1624a51e35f1bf786338bc3a287645a559ad5ea569',
    ['伤官格', [[configuration(labels.outputMonth)]]],
  ]],
  ['f015-p00136-001', ['6afbb80e9c53b0b299182aaa77a62313813d12f9061968a40f59a530a5a69bf3',
    ['有财', maleOutputWithWealth],
  ]],
  ['f015-p00137-001', ['654eeabbf6a8bfd5fc981cd455d7671e616c961b1fa9a6702ff1bd7e558ab4f3',
    ['不见官', femaleOutputWithoutOfficer],
    ['有财印', femaleOutputWithWealthAndSeal],
  ]],
  ['f016-p00060-001', ['b2ee2e890c31f55be60a7df497d7622dbf33313f49ef2f7b96f2e359fcaa03b8',
    ['甲己化土', [...'辰戌丑未'].map(month => [branchAt('month', month),
      { kind: 'bazi_day_stem_transformation', stem: '甲', partner: '己', element: '土' }])],
  ]],
  ['f016-p00083-001', ['a81d56fa2cc284104fa735916be64fb531dce49eb9d06a3a65cdcb7dba1c817b',
    ['年上虚官', [[configuration(labels.virtualYearOfficer)]]],
  ]],
  ['f016-p00100-001', ['29f38bbe4e11366fc3197e85ec110651eb471adc7773cbd7eecc026c69605c04',
    ['时柱癸酉、乙丑、己巳之一', ['癸酉', '乙丑', '己巳'].map(hour => [stemAt('day', '甲'), strong, pillarAt('hour', hour)])],
  ]],
  ['f017-p00040-001', ['9635660be25b99a3f349b10971c2bca318ba8424ad232ff5324c8fe12b721d17',
    ['伤官伤尽', [[shenfengOutputWithoutOfficer]]],
  ]],
  ['f018-p00059-001', ['f9e164d2da0e0fac668470a3f5a1686240fe0cb858e5c74521679a4b9259ca1f',
    ['日主衰弱', Object.entries(blades).map(([day, hour]) => [stemAt('day', day), weak, branchAt('hour', hour)])],
  ]],
  ['f018-p00072-001', ['deb665590efcb9c32e5eb11d778643cde4b2b9a6ba682971254c116dc70b8f16',
    ['羊刃极喜偏官', [[configuration(labels.bladeWithKilling), strong]]],
  ]],
  ['f018-p00093-001', ['b085f28a658c4282d92e789a167fea3c19d9f9b3d61ab5ee3d8c86526bdcb80a',
    ['财轻身强', lightWealthStrongPeers],
  ]],
  ['f018-p00118-001', ['807277e3a08a72b08a89e12a5c051d87bcb4b5ccb55cf5e174b8bf4b385d1465',
    ['月令建禄', [[configuration(labels.monthLu)]]],
  ]],
  ['f019-p00059-001', ['a9370586410a0f078f528ac9b151d2024e2dc3f8258c8af0fbaf0d36cdbd54ff',
    ['月生日干，年时俱有印绶（重重生气）', [[shenfengLayeredSealWithOfficer]]],
  ]],
  ['f019-p00058-001', ['b3935fb27c2d73751e953c8059796b3143843f68b50055b4dc5c873246da0cc4',
    ['财多身弱', [wealthyWeakWithSeal]],
    ['带官鬼，有印绶相生', [[weak, structure('杀印相生'), structure('印绶护身')]]],
  ]],
  ['f020-p00044-001', ['2b0af663b2c0c8b45518b448f1a5d368f18a009f4803ebe659b363dca147f012',
    ['正气官星月上推', cleanMonthOfficer],
  ]],
  ['f020-p00046-001', ['695e40901df442cd1aa1ee7b915606bb05cfe984e83cf5ef7ce44fd1e8d0d440',
    ['时柱见正官星', [[configuration(labels.hourOfficer)]]],
  ]],
  ['f020-p00066-001', ['e9b1859d36f77167ca8163e836f3c985a86922ca3acbe6df16e52fb75f3b878d',
    ...officerPlacement,
  ]],
  ['f020-p00067-001', ['75588c31e7a83cdad6cbced92fe2aeb3a37957ed034c6a61e5074fbfea444123',
    ['官杀混杂遇合神化解', [[configuration(labels.officerWithCombinedKilling)]]],
  ]],
  ['f020-p00076-001', ['fbc5656f6e5c330405501b83ea33c6ab6bae9413e751fa20e7e9f123ec127ec7',
    ['比肩劫财多', [2, 3, 4].map(count => [
      vigor('比劫'), tenGodCount('比劫', count), structure('财官相生'), structure('官印相生'),
    ])],
  ]],
  ['f020-p00091-001', ['4da3c97bb6d4d36d77325610af70f4c01d43a44b2990b4778f9c0bbe2249cb83',
    ['财星旺、官星得生', [wealthGeneratesOfficer]],
    ['癸坐巳为财官逢寅财旺', [[pillarAt('day', '癸巳'), branchAt('year', '寅'), branchAt('month', '巳'), vigor('财星')]]],
  ]],
]);

export const shenfengRepeatedPassages = new Map([
  [prefix + 'f020-p00096-001', { id: prefix + 'f009-p00048-001', text: '运入官杀旺地' }],
  [prefix + 'f009-p00123-001', { id: prefix + 'f007-p00066-001' }],
  [prefix + 'f009-p00125-001', { id: prefix + 'f007-p00050-001' }],
  [prefix + 'f009-p00094-001', { id: prefix + 'f009-p00083-001' }],
  [prefix + 'f009-p00049-001', { id: prefix + 'f015-p00114-001' }],
  [prefix + 'f009-p00129-001', { id: prefix + 'f009-p00091-001' }],
  [prefix + 'f007-p00072-001', { id: prefix + 'f011-p00050-001' }],
  [prefix + 'f015-p00136-001', { id: prefix + 'f015-p00113-001' }],
  [prefix + 'f018-p00093-001', { id: prefix + 'f007-p00069-001' }],
  [prefix + 'f020-p00066-001', { id: prefix + 'f013-p00108-001' }],
  [prefix + 'f020-p00067-001', { id: prefix + 'f013-p00109-001' }],
]);

export function compileShenfengReviewed(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [expected, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const actual = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (actual !== expected || passages.some(([text]) => !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《神峰通考》已核条目的出处、原文或条件有变化，须重新核对。' };
  }
  const branches = passages.map(([text, groups]) => ({ text, conditionCompiler: shenfengReviewedProfile,
    inputs: groups.map(required => normalizeRuleInput('bazi', { required })),
  }));
  return { reason: 'unmapped_condition', condition: '《神峰通考》资料包的已核本命分句', branches };
}

const wealth = god => god === '正财' || god === '偏财';
const seal = god => god === '正印' || god === '偏印';
const officer = god => god === '正官' || god === '七杀';
const has = (pillar, predicate) => predicate(pillar.tenGod) || pillar.hiddenStems.some(({ tenGod }) => predicate(tenGod));
const hasBranch = (pillars, branch) => pillars.some(pillar => pillar.branch.name === branch);
const anchoredFood = pillar => pillar.tenGod === '食神' || (pillar.position === 'month' && pillar.hiddenStems[0].tenGod === '食神');

function shenfengKillingConfigurations(pillars) {
  const [year, month, day, hour] = pillars;
  const visible = god => pillars.some(pillar => pillar.tenGod === god);
  const hidden = god => pillars.some(pillar => pillar.hiddenStems.some(({ tenGod }) => tenGod === god));
  const matches = [];
  const exposedOfficer = visible('正官');
  const exposedKilling = visible('七杀');
  if (exposedKilling && !exposedOfficer && hidden('正官')) matches.push(labels.exposedKillingHiddenOfficer);
  if (exposedOfficer && !exposedKilling && hidden('七杀')) matches.push(labels.exposedOfficerHiddenKilling);
  if (month.tenGod === '七杀' || month.hiddenStems[0].tenGod === '七杀') matches.push(labels.monthKilling);

  // The book gives 甲日 with 卯中乙 meeting 庚 and 壬日 with a visible 癸 meeting 戊时干.
  const jiaBlade = day.stem.name === '甲' && exposedKilling && hasBranch(pillars, '卯');
  const renBlade = day.stem.name === '壬' && hour.tenGod === '七杀' && visible('劫财');
  if (jiaBlade) matches.push(labels.jiaBladeCombines);
  if (renBlade) matches.push(labels.renBladeCombines);
  if (jiaBlade && hour.branch.name === '卯' && (exposedOfficer || hidden('正官'))) {
    matches.push(labels.officerWithCombinedKilling);
  }

  if (hour.tenGod !== '七杀') return matches;
  matches.push(labels.hourKilling);
  if ([year, month].some(anchoredFood)) matches.push(labels.horaryFood);
  if ((jiaBlade && hasBranch([year, month], '卯')) || renBlade) matches.push(labels.horaryBlade);
  // 四言独步注 lists the roots for 庚日 using 丙: 寅 (growth), 巳午 (vigor), 戌 (vault).
  if (day.stem.name === '庚') {
    const hasWealth = pillars.some(pillar => has(pillar, wealth));
    if (!hasWealth && !pillars.some(({ branch }) => '寅巳午戌'.includes(branch.name))) {
      matches.push(labels.rootlessKilling);
    }
    if (hasWealth && [...'寅午戌'].every(branch => hasBranch(pillars, branch))) {
      matches.push(labels.rootedKillingWithWealth);
    }
  }
  return matches;
}

export function shenfengReviewedFacts(pillars, analysis) {
  const [year, month, day, hour] = pillars;
  const occurrence = tenGod => pillars.flatMap(pillar => [
    ...(pillar.tenGod === tenGod ? [pillar.position] : []),
    ...pillar.hiddenStems.filter(hidden => hidden.tenGod === tenGod).map(() => pillar.position),
  ]);
  const voids = LunarUtil.getXunKong(day.ganZhi);
  const [onlyKilling, secondKilling] = occurrence('七杀');
  const matches = [];
  if ('辰戌丑未'.includes(month.branch.name) && month.hiddenStems.some(({ name, tenGod }) =>
    wealth(tenGod) && pillars.some(pillar => pillar.tenGod === tenGod && pillar.stem.name === name))) matches.push(labels.vaultWealth);
  if (pillars.some(pillar => voids.includes(pillar.branch.name) && has(pillar, god => god === '正财'))) matches.push(labels.voidWealth);
  if (pillars.some(pillar => voids.includes(pillar.branch.name) && has(pillar, god => god === '正官'))) matches.push(labels.properOfficerInVoid);
  if (pillars.some(pillar => voids.includes(pillar.branch.name) && has(pillar, god => god === '七杀'))) matches.push(labels.killingInVoid);
  if (has(year, god => god === '偏印') && occurrence('食神').length) matches.push(labels.yearOwl);
  if (pillars.filter(pillar => pillar.stem.element === '土').length >= 2
    && pillars.filter(pillar => pillar.stem.element === '土' || pillar.hiddenStems.some(({ element }) => element === '土')).length >= 3) {
    matches.push(labels.repeatedEarth);
  }
  if (pillars.filter(pillar => has(pillar, wealth)).length >= 2) matches.push(labels.repeatedWealth);
  if (onlyKilling === 'hour' && !secondKilling && hour.tenGod === '七杀') matches.push(labels.singleHourKilling);
  if (month.hiddenStems.some(({ tenGod }) => tenGod === '食神') && hour.tenGod === '七杀') matches.push(labels.foodBeforeKilling);
  if (month.branch.name === '亥' && [...'卯未'].every(branch => pillars.some(pillar => pillar.branch.name === branch))) {
    matches.push(labels.haiWoodTrine);
  }
  return [...matches.map(configuration), ...shenfengKillingConfigurations(pillars).map(configuration),
    ...shenfengOfficerAndOutputFacts(pillars, analysis)];
}

function shenfengOfficerAndOutputFacts(pillars, { stemBranchRelations, tenGodStructures }) {
  const [year, month, day, hour] = pillars;
  const dayStem = day.stem.name, monthBranch = month.branch.name;
  const monthMain = month.hiddenStems[0].tenGod;
  const properOfficer = god => god === '正官';
  const visibleOfficer = pillars.some(pillar => properOfficer(pillar.tenGod));
  const hasOfficer = pillars.some(pillar => has(pillar, properOfficer));
  const hasWealth = pillars.some(pillar => has(pillar, wealth));
  const completeRelations = stemBranchRelations.branches.filter(({ state }) => state === 'complete').map(({ type }) => type);
  const clashes = completeRelations.some(type => ['六冲', '六害', '相破', '相刑', '自刑', '三刑'].includes(type));
  const supports = name => tenGodStructures.some(rule => rule.name === name && rule.formation.supported);
  const matches = [];
  if (!clashes && (properOfficer(monthMain) || (dayStem === '乙' && monthBranch === '巳' && visibleOfficer))) {
    matches.push(configuration(labels.cleanMonthOfficer));
  }
  if (properOfficer(monthMain) && !visibleOfficer) matches.push(configuration(labels.concealedMonthOfficer));
  if (properOfficer(year.tenGod) && !properOfficer(monthMain)
    && [month, hour].every(pillar => !properOfficer(pillar.tenGod))) matches.push(configuration(labels.virtualYearOfficer));
  if (!pillars.some(pillar => has(pillar, officer))) matches.push(configuration(labels.noOfficerAndKilling));
  if (!clashes && !supports('伤官见官') && !supports('财星破印')) matches.push(configuration(labels.undamagedOfficerSeal));
  if (properOfficer(hour.tenGod) || properOfficer(hour.hiddenStems[0].tenGod)) matches.push(configuration(labels.hourOfficer));
  if (baziStemPhase(dayStem, monthBranch) === '临官') matches.push(configuration(labels.monthLu));
  if (blades[dayStem] === monthBranch && pillars.some(pillar => pillar.tenGod === '七杀')) {
    matches.push(configuration(labels.bladeWithKilling));
  }
  if (seal(monthMain) && has(year, seal) && has(hour, seal)) {
    if (hasOfficer) matches.push(shenfengLayeredSealWithOfficer);
    else if (!pillars.some(pillar => has(pillar, officer))) matches.push(configuration(labels.layeredSeal));
  }
  if (monthMain === '伤官') {
    matches.push(configuration(labels.outputMonth));
    if (!hasOfficer) matches.push(shenfengOutputWithoutOfficer);
    matches.push(configuration(hasWealth ? labels.outputWithWealth : labels.outputWithoutWealth));
  }
  if ('甲乙'.includes(dayStem) && '寅卯'.includes(monthBranch) && pillars.some(pillar => pillar.stem.element === '火')) {
    matches.push(shenfengSpringWoodWithFire);
  }
  const foodLu = { 甲: '巳', 乙: '午' }[dayStem];
  if (foodLu && hasBranch(pillars, foodLu) && pillars.some(pillar => pillar.tenGod === '食神')) {
    matches.push(configuration(labels.visibleFoodAtLu));
    if (!hasOfficer && !completeRelations.some(type => ['六冲', '相刑', '自刑', '三刑'].includes(type))) {
      matches.push(configuration(labels.foodAtLuWithoutOfficerOrClash));
    }
  }
  for (const pillar of pillars) {
    if (has(pillar, god => god === '伤官')) matches.push(pillarOutput(pillar.position));
  }
  return matches;
}
