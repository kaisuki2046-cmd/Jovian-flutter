import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueCareerProfile = 'ziwei-xingjue-career-v1';
const prefix = 'ziwei-v3-xingjue-055-p';
const career = '官禄';
const otherPalaces = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '田宅', '福德', '父母'];
const benefics = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'];
const malefics = ['擎羊', '陀罗', '火星', '铃星'];
const scope = 'origin';
const at = (palace, ...names) => names.map(star => ({ kind: 'palace_star', palace, star, scope }));
const same = (...names) => at(career, ...names);
const seat = (palace, branch) => ({ kind: 'palace_branch', palace, branch });
const inCareer = (branch, ...names) => [seat(career, branch), ...same(...names)];
const link = (target, relation) => ({ kind: 'palace_relation', anchor: career, target, relation });
const sector = (...names) => names.map(star => ({ kind: 'palace_sector_star', palace: career, star }));
const trine = star => ({ kind: 'palace_trine_star', palace: career, star });
const year = stem => ({ kind: 'natal_year_stem', stem });
const birthBranch = branch => ({ kind: 'natal_year_branch', branch });
const bureau = bureau => ({ kind: 'natal_ziwei_bureau', bureau });
const brightnessAt = (palace, star, brightness) => ({ kind: 'palace_brightness', palace, star, scope, brightness });
const bright = (star, brightness) => brightnessAt(career, star, brightness);
const boshi = star => ({ kind: 'palace_boshi_star', palace: career, star });
const suiqian = star => ({ kind: 'palace_suiqian_star', palace: career, star });
const solo = { kind: 'palace_main_count', palace: career, count: 1 };

const starChange = (star, change) => ({ kind: 'star_mutagen', palace: career, star, change, scope });
const changeAt = (palace, change) => [
  { kind: 'palace_mutagen', palace, change, scope },
  { kind: 'palace_sector_mutagen', palace, change },
];
const beneficCount = count => ({ kind: 'palace_sector_benefic_count', palace: career, count });
const trineBeneficPairs = benefics.flatMap((first, index) =>
  benefics.slice(index + 1).map(other => [trine(first), trine(other)]));
const maleficPairs = malefics.flatMap((first, index) =>
  malefics.slice(index + 1).map(other => sector(first, other)));
const lifeBeneficPairs = benefics.flatMap((first, index) =>
  benefics.slice(index + 1).map(other => at('命宫', first, other)));
const withTrineBenefics = required => ({ required, anyOf: trineBeneficPairs });
const withManyBenefics = required => ({ required, anyOf: [2, 3, 4, 5, 6].map(count => [beneficCount(count)]) });
const trineBell = levels => ['命宫', '财帛'].flatMap(target =>
  levels.map(level => [link(target, 'trine'), ...at(target, '铃星'), brightnessAt(target, '铃星', level)]));

const flanked = (lowerBranch, lowerStar, upperBranch, upperStar) => [
  seat('田宅', lowerBranch), ...at('田宅', lowerStar), link('田宅', 'adjacent'),
  seat('仆役', upperBranch), ...at('仆役', upperStar), link('仆役', 'adjacent'),
];

const purpleTreasuryFlanks = [
  ['寅', '丑', '卯'], ['申', '未', '酉'],
].flatMap(([branch, lower, upper]) => [
  ['紫微', '天府'], ['天府', '紫微'],
].map(([lowerStar, upperStar]) => [
  ...inCareer(branch, '天贵'), ...sector('天官'), ...flanked(lower, lowerStar, upper, upperStar),
]));
const opposedMoonAndSun = [
  ...inCareer('亥', '太阴'), seat('财帛', '卯'), ...at('财帛', '太阳'), link('财帛', 'trine'),
  seat('夫妻', '巳'), link('夫妻', 'opposite'),
];
const yinSunJumen = [...inCareer('寅', '巨门', '太阳', '三台', '天官'), suiqian('龙德')];
const oxCareerFlanks = [
  ...inCareer('丑', '贪狼', '武曲', '恩光'),
  seat('田宅', '子'), ...at('田宅', '天同', '太阴', '凤阁'), link('田宅', 'adjacent'),
  seat('仆役', '寅'), ...at('仆役', '巨门', '太阳', '龙池'), link('仆役', 'adjacent'),
];
const phase = phase => ({ kind: 'palace_changsheng_phase', palace: career, phase });
const bodySeat = palace => ({ kind: 'palace_confirmed_body_seat', palace });
const noMajors = { kind: 'palace_main_count', palace: career, count: 0 };
const facingNobles = [['天魁', '天钺'], ['天钺', '天魁']].map(([here, there]) => [
  ...same(here), ...at('夫妻', there), link('夫妻', 'opposite'),
]);
const oppositePair = (palace, branch, ...names) => [seat(palace, branch), ...at(palace, ...names), link(palace, 'opposite')];
const luMaAndGallery = [...same('天马'), trine('凤阁'), ...sector('禄存')];
const oxLights = inCareer('丑', '太阳', '太阴');
const oxLightsKeLu = [...oxLights, starChange('太阳', '禄'), starChange('太阴', '科'),
  ...changeAt(career, '科'), ...changeAt(career, '禄')];
const greenDragonAndWhiteTiger = [boshi('青龙'), suiqian('白虎')];
const shenCareerArmy = [
  ...inCareer('申', '七杀', '右弼', '三台'), ...oppositePair('夫妻', '寅', '紫微', '天府', '禄存', '天马'),
  ...flanked('未', '天梁', '酉', '天同'),
];
const suiqianAt = (palace, star) => ({ kind: 'palace_suiqian_star', palace, star });
const wealthSealLuMa = ['武曲', '天相', '禄存', '天马', '龙池', '凤阁'];
const brightGiantAndPunishment = [...same('巨门', '天刑'), bright('巨门', '旺')];
const emptyCareerWithAssistants = [noMajors, ...sector('紫微', '天相', '左辅', '右弼')];
const haiCareerLianTan = [...inCareer('亥', '贪狼', '廉贞'), bright('贪狼', '陷'), bright('廉贞', '陷')];

// Each reviewed passage uses the spelling of the pinned Qing manuscript transcription.
const reviewed = new Map([
  ['704-001', ['ac39e0594dd565e21c5c519b32f3d1423ac38ce3418a81ca89c1513d31790378',
    [null, [{ required: sector('天魁', '天钺', '龙池', '凤阁'), mustBeAbsent: sector('火星', '铃星') }]],
  ]],
  ['705-001', ['884a21dea49943c089ab3b4d004f82525b34cb63c9890349c45c772c5d5f2e6b',
    [null, [withTrineBenefics([...same('天府'), solo])]],
  ]],
  ['706-001', ['38891795fa54b1cea61e9e309680e3fe912fe3030dbccfc8b3f44b3b7e72afcd',
    [null, [same('文曲', '天官', '天贵')]],
  ]],
  ['707-001', ['4c9e1a25b984f049ebac03401454ada2a7711768f0fa57291a73d267dfb6f9b8',
    [null, [[...same('擎羊'), ...changeAt(career, '权')]]],
  ]],
  ['710-001', ['b53e2f780e62c80a11ebac3485f74cb98b2298f0679a93a8405493776f20764b',
    ['官宮居在辰地、貪火同塗者宜發', [{
      required: inCareer('辰', '贪狼', '火星'),
      anyOf: otherPalaces.map(palace => changeAt(palace, '忌')),
    }]],
    ['而若化忌同宮則不發。', [[...inCareer('辰', '贪狼', '火星'), ...changeAt(career, '忌')]]],
  ]],
  ['719-001', ['15172b36e80de23c564e24ff6cdbf27f796ceaf2abdff5ccb295559cabc098db',
    ['官宮辰地殺昌火星', [{
      required: inCareer('辰', '七杀'),
      anyOf: [[...same('文昌'), trine('火星')], [...same('火星'), trine('文昌')]],
    }]],
  ]],
  ['723-001', ['aa5b2cf58c5347560e15b33cdd2d8e5a274ee155fec8efdc9ceed7128599885c',
    [null, [...'寅申'].map(branch => inCareer(branch, '紫微', '天府', '禄存'))],
  ]],
  ['725-001', ['cd6d7a938f4859d677bb7685ad50d51238d36449bce0fb8fe300280734b42db5',
    [null, [[...inCareer('午', '太阳'), year('甲'), ...changeAt(career, '忌'), starChange('太阳', '忌')]]],
  ]],
  ['730-001', ['22090cf0a66715d712191dc2ac33c78225de6b42dcb09593d3b3288fe9793494',
    [null, [...'卯酉'].map(branch => [...inCareer(branch, '武曲', '七杀', '三台'), ...sector('天魁', '天钺')])],
  ]],
  ['731-001', ['c52f5b398c349bdc134381cf3283b6aa9ea686c432be313b379500480df9cba0',
    ['戌宮刑火', [inCareer('戌', '天刑', '火星')]],
  ]],
  ['732-001', ['858e3b507fdabf72957e01064cf28945135ab896d83e7a16058d79fb3f26e7ae',
    [null, [[...same('天官'), boshi('青龙')]]],
  ]],
  ['1511-001', ['272e3e33e5c82ed5664d5af99b768c88fc0dddfa48b7232b64be45c294102d52',
    [null, [[...same('廉贞', '七杀'), ...sector('天刑')]]],
  ]],
  ['1512-001', ['42c35567844f552091948d14572b390dddedc72775c10e5d9673f6453a663ca2',
    [null, same('旬空', '截路', '空亡').map(fact => ({ required: [fact], anyOf: lifeBeneficPairs }))],
  ]],
  ['1513-001', ['330fd8daa446f697e67b4809697c912024474ee981b1c52869050e0835514845',
    [null, [[...same('太阳', '文昌', '火星'), bureau('火六局')]]],
  ]],
  ['1514-001', ['756bfe5bf679f284d4fe02246132de3189f61556e9318e993de95efd02ff8b46',
    ['又得巳地祿存直照者、科慶俱為振耀', [{
      required: [...opposedMoonAndSun, ...at('夫妻', '禄存')],
      mustBeAbsent: at('夫妻', '地空', '地劫'),
    }]],
    ['若巳地空刧來沖則不達、只作承蔭末官', [[...opposedMoonAndSun, ...at('夫妻', '地空', '地劫')]]],
  ]],
  ['1516-001', ['99c51ac8aa26fcaea30eba9fc479c13eae51056a3a6d30dc70fabf3efc9060c7',
    [null, ['水二局', '火六局'].map(value => [...same('巨门', '地空'), bureau(value)])],
  ]],
  ['1518-001', ['d05fa5e7126bb5f5efa08931437474136e8407728f2672755f9006f74cb14667',
    ['官宮有貪狼、合宮有鈴星得地者、是謂貪火相遇、名位煥發',
      [{ required: same('贪狼'), anyOf: trineBell(['庙', '得', '利']) }]],
    ['雖非入廟、貪鈴兼得魁鉞則發達',
      [{ required: [...same('贪狼'), ...sector('天魁', '天钺')], anyOf: trineBell(['得', '利']) }]],
  ]],
  ['1520-001', ['20e5de2934072ab560480bf471049ac13f55d5064512505d535cebf9ff8db932',
    ['官宮丑地貪武同守、而中有恩光、寅地巨日龍池、子地同月鳳閣來夾者至貴', [oxCareerFlanks]],
    ['且寅地為長生、子地有化祿、則是謂生夾官、官祿夾、至貴格', [[
      ...oxCareerFlanks, { kind: 'palace_changsheng_phase', palace: '仆役', phase: '长生' },
      ...changeAt('田宅', '禄'), { kind: 'star_mutagen', palace: '田宅', star: '天同', change: '禄', scope },
    ]]],
  ]],
  ['1524-001', ['15e27793ef14f310fb521eab821ad272a0cb7ccee799a368c66e9d26c24d2a38',
    [null, [[...inCareer('辰', '太阳', '天贵'), solo, birthBranch('戌'),
      seat('夫妻', '戌'), ...at('夫妻', '太阴'), link('夫妻', 'opposite')]]],
  ]],
  ['1525-001', ['e480e5de269a39fc04ee06b2fdb3e425153bb8b6fa11b0ef25af1ef393054a08',
    [null, [[...inCareer('辰', '太阳', '天贵'), ...flanked('卯', '天魁', '巳', '天钺')]]],
  ]],
  ['1527-001', ['0982dac79374a4c4aff0c3ed40e650cd984e08e218990af2ca450180fc6eb213',
    [null, [{
      required: [...same('文曲'), ...sector('天梁', '文昌', '天魁', '天钺', '太阳', '太阴'),
        ...['权', '禄'].map(change => ({ kind: 'palace_sector_mutagen', palace: career, change }))],
      mustBeAbsent: [...same('天魁', '天钺', '太阳', '太阴'),
        ...['权', '禄'].map(change => ({ kind: 'palace_mutagen', palace: career, scope, change }))],
    }]],
  ]],
  ['1532-001', ['e8e87a83df389c90027a9c5bf867cb6816dc99fa301a65bfbf6eaefc401f3b03',
    ['天貴在官、天官來合者、千不得一', [[...same('天贵'), ...sector('天官')]]],
    ['又紫府夾者至貴', purpleTreasuryFlanks],
  ]],
  ['1535-001', ['7c41991b5ce22ba96fcc463ad232ec23a8b74811ce21350fee1fa49b76d0a9f7',
    [null, [withTrineBenefics(inCareer('子', '天机'))]],
  ]],
  ['1536-001', ['8f7c2af55a1aa5b11febd94b583630979aae2cb12064ee854af9e603e5161d5a',
    [null, [...'丑未'].map(branch => inCareer(branch, '紫微', '破军'))],
  ]],
  ['1537-001', ['2b53b11032b902a83a82d6291a741cf5f4531f41a35a8c4d17605c3d6dc3b72b',
    [null, [withTrineBenefics(same('破军'))]],
  ]],
  ['1538-001', ['df3bb23a53801b70cf28958d08a972604ee965215d60a66b7b2d47f63369e19d',
    [null, [inCareer('子', '廉贞', '天相')]],
  ]],
  ['1541-001', ['f3372e4ccd73bb8a7c15031579c4a7ddcdc2230425183c4e91d248435a79cc43',
    ['官宮巳地月、辛苦失職', [[...inCareer('巳', '太阴'), bright('太阴', '陷'), beneficCount(0)]]],
    ['三方吉拱則蔭仕雜職', [{
      required: [...inCareer('巳', '太阴'), bright('太阴', '陷')],
      anyOf: benefics.map(star => [trine(star)]),
    }]],
  ]],
  ['1542-001', ['59a43315cb305bc8b7b6b0028e0e00af5584027195075cf074bd4392accd2c82',
    [null, [...'寅申'].map(branch => withManyBenefics(inCareer(branch, '巨门', '太阳')))],
  ]],
  ['1544-001', ['73fc15373508a01e584c08b98c665dace6c1cd6beb827fa5cf6d30378038b57e',
    ['官宮子地貪狼與右弼水同居', [[...inCareer('子', '贪狼', '右弼'), bureau('水二局')]]],
  ]],
  ['1545-001', ['2097dcd52e1953dd031da4ab0687c64f531499cd6102cd1db70d77c46fc38087',
    ['午官天梁遇天刑者、若火局人則刑火生梁土、梁又入廟、故官位順成', [[
      ...inCareer('午', '天梁', '天刑'), bright('天梁', '庙'), bureau('火六局'),
    ]]],
  ]],
  ['1546-001', ['80ebc15113a5490f76b237ddfa832c745633c09fb0828d077ea114874fee3133',
    [null, [[...inCareer('寅', '禄存', '天马', '旬空'), ...flanked('丑', '陀罗', '卯', '擎羊')]]],
  ]],
  ['1548-001', ['5d0d16a79871d100999d8dd0f1380daf785f79b2110d454628b432f527aa06a4',
    ['午地官宮紫微火星遇天空若易發', [inCareer('午', '紫微', '火星', '天空')]],
  ]],
  ['1549-001', ['961df6b4069987e68a51a16522aa9195b023ae1343158a2e62a9def166acd617',
    ['官宮巳亥機忌同居、遇諸殺者亦為工匠', [...'巳亥'].map(branch => ({
      required: [...inCareer(branch, '天机'), year('戊'), ...changeAt(career, '忌'), starChange('天机', '忌')],
      anyOf: maleficPairs,
    }))],
  ]],
  ['1551-001', ['582f294fb3d92fd7f238729a8a60b79f4a16f30fe3183a4fe979682d5b34ff9d',
    [null, [withManyBenefics([...changeAt(career, '禄'), ...sector('禄存')])]],
  ]],
  ['1553-001', ['200ee812cb3ba8d72ec72235efec5a675e7661e113e0cf5ce9527efc4b27e492',
    [null, [[...inCareer('未', '天府', '天官'), ...flanked('午', '太阳', '申', '太阴')]]],
  ]],
  ['1556-001', ['6c45312eb504ce2a44dcd1348023f752d5c4202b77ec6933f909ae1aae467f75',
    [null, [[...inCareer('未', '贪狼', '武曲'), ...flanked('午', '太阴', '申', '太阳')]]],
  ]],
  ['1560-001', ['af794b7d76bb8d87a82bc1b250ce3f6e59245ee2293d288a74a4133d6bf4507f',
    [null, [...'辰戌丑未'].map(branch => [...inCareer(branch, '贪狼', '三台'), bright('贪狼', '庙')])],
  ]],
  ['1562-001', ['a105cc46bc3cced307255b4709f96b83cf49e0be935808823f7c819ce1a0edaf',
    ['寅宮巨日與三台同位又得官貴龍德者', [yinSunJumen]],
  ]],
  ['1563-001', ['14bbb44057b26c39cf7446ff34d2eca027d2b4d329e1bf47ff5c1c0d90282021',
    [null, [[...inCareer('巳', '太阴'), bright('太阴', '陷')]]],
  ]],
  ['709-001', ['920ba182fc67a1b9cb7a5dd4058bf9df5f9ea9e520718ab4af4c87645ab0bef8',
    ['官宮輔弼雖坐守、若落在旬路空', ['旬空', '空亡'].map(empty => same('左辅', '右弼', empty))],
  ]],
  ['712-001', ['2cda9368135bab83dfde5714d074c1b3fc3cf2bfad848ee1349ddce31b74e3b6',
    ['官宮四正祿存閣馬', [luMaAndGallery]],
  ]],
  ['713-001', ['1a36ad492c2a62c244a5e0acaa0ff2604870f799aae604d98d9e5153d93c66a0',
    ['巳宮天府文曲祿存同居', [inCareer('巳', '天府', '文曲', '禄存')]],
  ]],
  ['714-001', ['0257b636bc7ebff0a3d4df811059540af2f9d72aeccce94cf01fe369d604742d',
    ['官宮反背太陰失地', [[...inCareer('辰', '太阴'), bright('太阴', '陷'),
      ...oppositePair('夫妻', '戌', '太阳')]]],
  ]],
  ['715-001', ['92a6a19d229d19ea8f3b7d85b6293b3e98c257823faf7ea74692997afc8c7407',
    ['官宮龍虎日月', [
      [...greenDragonAndWhiteTiger, ...sector('太阳', '太阴')],
      ...['命宫', '财帛', '夫妻'].map(target => [boshi('青龙'), suiqianAt(target, '白虎'),
        link(target, target === '夫妻' ? 'opposite' : 'trine'), ...sector('太阳', '太阴')]),
    ]],
  ]],
  ['717-001', ['da40cc7ea99edbe7f3a621202d87daa9a801fe738df0a2cc09aa2c1d432c40b9',
    ['紫府朝元者榮貴', [[trine('紫微'), trine('天府')]]],
  ]],
  ['718-001', ['b3060c0b845ce19f1e0c0f03a492de12d874e700f7b73feaf2d77e3e04e90138',
    ['官宮吉集', [[{ kind: 'palace_sector_benefic_majority', palace: career }]]],
  ]],
  ['720-001', ['5d1d10cbe2bc0144a296f368f1a2a91392c4009b8595cade50070833b6bc03d4',
    ['午地官宮太陽文昌右弼化祿封誥', [[...inCareer('午', '太阳', '文昌', '右弼', '封诰'),
      ...changeAt(career, '禄'), starChange('太阳', '禄')]]],
  ]],
  ['721-001', ['568438d12a90a97619a6868fdade66325234619be6129cf2efa22daabfa52dee',
    ['丑地官宮日月同守、科祿同居', [oxLightsKeLu]],
    ['化權合者至奇', [[...oxLightsKeLu, seat('田宅', '子'), link('田宅', 'adjacent'), ...at('田宅', '武曲'),
      ...changeAt('田宅', '权'), { kind: 'star_mutagen', palace: '田宅', star: '武曲', change: '权', scope }]]],
  ]],
  ['722-001', ['1c5a3ab407e4e4a48a0aae2291adf5e8383c2e704932a1651585d749d376fcea',
    ['亥宮貪貞雖是陷地', [haiCareerLianTan]],
    ['若正祿官貴', [[...haiCareerLianTan, ...oppositePair('夫妻', '巳', '禄存', '天官')]]],
  ]],
  ['724-001', ['19d87d46efe9369b88c9bcf0451e1e5a1538af23ee160ddd1d4e53b25117c21a',
    ['財印祿馬池閣照拱官宮', [{ required: sector(...wealthSealLuMa), mustBeAbsent: same(...wealthSealLuMa) }]],
  ]],
  ['726-001', ['7d554626fe7b11ca4405b5346e430a4d0e5a5e5659c31f0b6ad0efa59b0425e3',
    ['官宮坐貴向貴、府相朝垣', facingNobles.map(nobles => [...nobles, trine('天府'), trine('天相')])],
  ]],
  ['727-001', ['8d4c8f5e1f79a0c1d2185e547d25f9cb29857605aedd692bfb5fb37f9e3867f1',
    ['官宮坐貴向貴', facingNobles.map(nobles => [...nobles, boshi('奏书')])],
  ]],
  ['728-001', ['25737a79ee9a692aa8894d2536a5b1a96fcae9a0debb3835eb14306c8a8a964e',
    ['丑未官宮日月同居、坐貴向貴', [...'丑未'].map((branch, index) =>
      [...inCareer(branch, '太阳', '太阴'), ...facingNobles[index]])],
  ]],
  ['729-001', ['cd2febbd5b51eb30c3a77a2e7a69afc30627af34ebc86465b7b41c479109e016',
    ['官宮生地、祿馬三台與紫七合', [[phase('长生'), ...sector('禄存', '天马', '三台', '紫微', '七杀')]]],
  ]],
  ['1515-001', ['7500aa8f376e4b7ee0351ea267ba116d17d8b614ad5caa74c4af50e7ccd4e726',
    ['官宮破軍雖不美、若長生化祿坐守', [[...same('破军'), phase('长生'), ...changeAt(career, '禄'), starChange('破军', '禄')]]],
  ]],
  ['1517-001', ['ba012542f073f33c3e9d4b7f226efe5b2df3f14d2f4aefbb26b4086b75238c48',
    ['午地官巨門祿存同入、火局人最宜逢之', [[...inCareer('午', '巨门', '禄存'), bureau('火六局')]]],
  ]],
  ['1519-001', ['77947f1f4b3180cd3be6a95808b2a0d260fb155ef9be10fc15c4ec9d6fb4a5c8',
    ['巨門天刑旺地守官', [brightGiantAndPunishment]],
  ]],
  ['1526-001', ['5c11022d0d42ef0c717a42eb2b886138d1d4553beff938d1df62b1ee351c3b77',
    ['官居生方、紫府同宮', [[phase('长生'), ...same('紫微', '天府')]]],
  ]],
  ['1529-001', ['9219c0245e7fd33a39eb392ec5e8bd8f8f99daf2977e0d98cae280c9cc4ec422',
    ['官宮巳地貪貞雖不美', [[...inCareer('巳', '廉贞', '贪狼'), bright('廉贞', '陷'), bright('贪狼', '陷')]]],
  ]],
  ['1530-001', ['041eae6e172d7fe7618df630771b30691260d649e96a56b612552f6973e00e13',
    ['亥官月曲同居', [inCareer('亥', '太阴', '文曲')]],
  ]],
  ['1533-001', ['9d623426f2c729f729444e05883b676f179338332d1479f6e724cb9ae0c018f7',
    ['官雖無正星、得帝相輔弼相合', [emptyCareerWithAssistants]],
  ]],
  ['1539-001', ['4b50b0eb85278c17816792c4fa2f4f8bb7fc70eaf167cd48cb20661256d5ac4d',
    ['官宮鳳閣與祿馬照應身命', ['命宫', '财帛', '夫妻'].map(body => [
      ...same('凤阁', '禄存', '天马'), link('命宫', 'trine'), bodySeat(body),
      ...(body === '命宫' ? [] : [link(body, body === '夫妻' ? 'opposite' : 'trine')]),
    ])],
  ]],
  ['1540-001', ['c1a80cd44afae046c6ff468669b3f4e77f3b1a3cb013cb8176a9c76a4c607055',
    ['龍虎與貪火鈴合者', [[...greenDragonAndWhiteTiger, ...same('贪狼'), ...sector('火星', '铃星')]]],
  ]],
  ['1543-001', ['939359325c72426aadcf8592021c3183eecd152baedf2e16ad7ae580bc28444e',
    ['紫微官宮落空', ['旬空', '截路', '空亡', '地空'].map(empty => same('紫微', empty))],
  ]],
  ['1547-001', ['3cb68bf645fe3a08dfc06e6fb8e0c1b6637265fe0b5fa37874b5c5a545c4377a',
    ['官宮坐丑地、日月同臨', [oxLights]],
  ]],
  ['1552-001', ['3dcbf4852e75bb5f8f21cfb42f9f9564e3db7d7b775d7a40defc8534cedfb0d9',
    ['寅宮文曲閣馬為美', [[...inCareer('寅', '文曲', '天马'), trine('凤阁')]]],
  ]],
  ['1554-001', ['99ac9caf52be1bf19ca519cc63b8dc42e58a8d40d0788e6f596c8776b4829f8f',
    ['官宮右弼祿馬八座封誥坐生方', [[...same('右弼', '禄存', '天马', '八座', '封诰'), phase('长生')]]],
  ]],
  ['1555-001', ['7517959d949fb71bd34933597cf15e8c79ebc5a4b46812adda412bb1bfa43baf',
    ['官宮午紫與台輔同守帝旺之鄉', [[...inCareer('午', '紫微', '台辅'), phase('帝旺')]]],
  ]],
  ['1557-001', ['533f27418564fc7fd850c0de71ee49978b3ba0670fbceb452a9e880d971d6405',
    ['午宮月同坐、雖非得地', [[...inCareer('午', '太阴', '天同'), bright('太阴', '不'), bright('天同', '陷')]]],
  ]],
  ['1558-001', ['f15fbe5544b0eb324cce2ca6286278af941776388acf910f258201bcc671d689',
    ['兩台居官與奏書會為文官', [[...same('三台', '台辅'), boshi('奏书')]]],
    ['與將軍會為武官', [[...same('三台', '台辅'), boshi('将军')]]],
  ]],
  ['1559-001', ['9cb8e90254524515b8fbd564305c99d15e575ab8506a8355bd3a71e4d2fcb1c1',
    ['申宮七殺右弼三台得寅地紫府祿馬朝垣、同梁來夾為貴', [shenCareerArmy]],
  ]],
]);

export function compileXingjueCareer(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [hash, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== hash || passages.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》官禄篇的原文、出处或条件有变化，须重新核对。' };
  }
  const branches = passages.map(([text, groups]) => ({
    text,
    conditionCompiler: xingjueCareerProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group)),
  }));
  if (!branches[0].text) return { compiler: xingjueCareerProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》官禄篇已核盘式与分句匹配', branches };
}
