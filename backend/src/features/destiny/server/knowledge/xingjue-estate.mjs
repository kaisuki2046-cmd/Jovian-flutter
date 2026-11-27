import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueEstateProfile = 'ziwei-xingjue-estate-v1';
const prefix = 'ziwei-v3-xingjue-056-p';
const estate = '田宅', wealth = '财帛';
const verifiedOutsideJiPalaces = ['命宫', '兄弟', '夫妻', wealth, '疾厄', '迁移', '仆役', '官禄', '福德', '父母'];
const scope = 'origin';
const at = (palace, ...names) => names.map(star => ({ kind: 'palace_star', palace, star, scope }));
const same = (...names) => at(estate, ...names);
const inEstate = (branch, ...names) => [{ kind: 'palace_branch', palace: estate, branch }, ...same(...names)];
const sector = (...names) => names.map(star => ({ kind: 'palace_sector_star', palace: estate, star }));
const opposite = (anchor, target) => ({ kind: 'palace_relation', anchor, target, relation: 'opposite' });
const adjacent = (target, star) => [
  { kind: 'palace_relation', anchor: estate, target, relation: 'adjacent' },
  ...at(target, star),
];
const changeAt = (palace, change) => [
  { kind: 'palace_mutagen', palace, change, scope },
  { kind: 'palace_sector_mutagen', palace, change },
];
const brightness = (star, value) => ({ kind: 'palace_brightness', palace: estate, star, brightness: value, scope });
const singleCoreStar = { kind: 'palace_core_star_count', palace: estate, count: 1 };
const moonSunInVoid = inEstate('丑', '太阳', '太阴', '旬空');
const treasuryWithAssistant = same('左辅', '天府');
const mainCount = count => ({ kind: 'palace_main_count', palace: estate, count });
const branchAt = (palace, branch) => ({ kind: 'palace_branch', palace, branch });
const phase = (palace, phase) => ({ kind: 'palace_changsheng_phase', palace, phase });
const sectorChange = (palace, change) => ({ kind: 'palace_sector_mutagen', palace, change });
const ownChange = (palace, star, change) => ({ kind: 'star_mutagen', palace, star, change, scope });
const oppositeChildren = [opposite(estate, '子女')];
const ziEstateWithTongYin = inEstate('子', '天同', '太阴');
const estateWithCutoffBell = same('截路', '铃星', '天姚');
const chenPojunWithAssistant = inEstate('辰', '破军', '右弼');
const waterGenerationAndBureau = [
  { kind: 'natal_year_nayin_element', element: '水' }, { kind: 'natal_ziwei_bureau', bureau: '水二局' },
];
const longLifeTreasury = [
  ...inEstate('寅', '紫微', '天府', '禄存', '天马'), phase(estate, '长生'),
];
const waterTreasury = (palace, branch) => [
  branchAt(palace, branch), ...at(palace, '天府', '禄存'),
];
const treasuryInWater = [estate, wealth].flatMap(palace => [...'亥子'].map(branch => waterTreasury(palace, branch)));
const liangWealth = [...same('天梁'), mainCount(1), brightness('天梁', '旺'), sectorChange(estate, '禄')];
const purpleWithLuAndHorse = [...same('紫微'), ...sector('禄存', '天马')];
const trinePalace = target => ({ kind: 'palace_relation', anchor: estate, target, relation: 'trine' });
const tanLianVoidSeats = [
  ['巳', ['地空', '旬空', '天空', '空亡']],
  ['亥', ['地空', '旬空', '天空']],
];

// The verified source is the Qing copy, scanned pp. 177–180.
const reviewed = new Map([
  ['733-001', ['c88f2e8ce4acc7851748294b81759bcf4afdc1a61b3ca75d4dfcca7d7ea39114',
    [null, [same('禄存', '天贵')]],
  ]],
  ['735-001', ['52e9e6ff030947abd051ce93beb0c56ecd89639a3d561e18430542cc31230fc2',
    [null, [[...same('破军', '天姚'), brightness('破军', '陷')]]],
  ]],
  ['736-001', ['04eca6aaa93b62e14580968b7ac458b4b01063749d86742152d3e76432bcd42a',
    [null, [[...inEstate('戌', '天府'), ...changeAt(estate, '忌')]]],
  ]],
  ['739-001', ['b6d322c0ad0870805efb3c2a2fc44229aa823aeff9830cfd87fad23fd2053327',
    ['祿居田財極富', [estate, wealth].map(palace => ({ required: at(palace, '禄存'), mustBeAbsent: at(palace, '地劫') }))],
    ['而地劫同位', [estate, wealth].map(palace => at(palace, '禄存', '地劫'))],
  ]],
  ['741-001', ['11e56dfd0471be850a3b2faf4c25982a2c713668f486665a983996e7f1dc2a3b',
    [null, [inEstate('子', '天机', '地空')]],
  ]],
  ['742-001', ['3a223de82a76c487839a7d58e450681e2a9a03dc08abc283931ca86a0803ffd1',
    [null, [[...inEstate('申', '左辅'), singleCoreStar]]],
  ]],
  ['747-001', ['a2c8d478aff7f82be43892b1587ba34c72d1a39aee73f3f5bcee72848b11032c',
    [null, [estate, wealth].map(palace => at(palace, '地空', '破军'))],
  ]],
  ['811-001', ['4c74ef35cc7b366f0d1763ca5ebf336d609640c9635d1ebeaf3eed3a36abea08',
    [null, [...'丑未'].map(branch => inEstate(branch, '太阳', '太阴'))],
  ]],
  ['814-001', ['e977bbc2333a83bd46f1a028b29aaf0414ee66f65027420d56a56296072642cd',
    [null, [same('巨门')]],
  ]],
  ['815-001', ['2cdf7806d628ecbcf56680939c20b9c5dfa9f9453cec16b4a43f01013efd8ba6',
    [null, [inEstate('辰', '天府', '廉贞')]],
  ]],
  ['1566-001', ['649696fa6abc46c2854972f826d90df3781ef563ef324956cf34cc6582969857',
    ['丑田日月遇旬空、田宅豐咸', [{ required: moonSunInVoid, mustBeAbsent: sector('地劫') },
      ...verifiedOutsideJiPalaces.map(palace => [...moonSunInVoid, ...changeAt(palace, '忌')])]],
    ['而若化忌同居、地刧相會者、貧無田宅', [[...moonSunInVoid, ...changeAt(estate, '忌'), ...sector('地劫')]]],
  ]],
  ['1567-001', ['76fb49e89ff1520388853214cd7e6ca70a0c1082fad0f5b2fd2cb51e3d1144f8',
    [null, [...'卯酉'].map(branch => inEstate(branch, '天府', '擎羊'))],
  ]],
  ['1569-001', ['681873b4d85a8db6016bcbe94b67ff8ac56128dfcf540f4258289c7b7069cb81',
    [null, [[...sector('禄存', '天马'), ...same('地空', '地劫')]]],
  ]],
  ['1571-001', ['2974e0043a3ba0a9aad559108d2c1bcaf7e0c0983ee863f94d81863fff561be5',
    ['田宮貪狼、田宅破敗、或自置者吉', sector('擎羊', '火星').map(fact => ({ required: same('贪狼'), mustBeAbsent: [fact] }))],
    ['若殺破羊火來會、則因田宅起訟、有不測之事', [[...same('贪狼'), ...sector('七杀', '破军', '擎羊', '火星')]]],
  ]],
  ['1572-001', ['659b826ba4232b0f21fc439016b0806846da7986f3c87eb9f1e1825a873df56a',
    ['田財宮武曲權火同居、長生來照', [[estate, '子女', 'opposite'], [wealth, '官禄', 'trine']].map(([palace, target, relation]) => [
      ...at(palace, '武曲', '火星'), ...changeAt(palace, '权'),
      { kind: 'star_mutagen', palace, star: '武曲', change: '权', scope },
      { kind: 'palace_relation', anchor: palace, target, relation },
      { kind: 'palace_changsheng_phase', palace: target, phase: '长生' },
    ])],
  ]],
  ['1573-001', ['442cbc3f1495a9e9d7971330137875c62f5cc71e43c572dd81caee28c29ab4be',
    [null, [[
      ...inEstate('丑', '紫微', '陀罗', '天魁'), opposite(estate, '子女'), ...at('子女', '天相'),
      ...['武曲', '左辅', '右弼'].map(star => ({ kind: 'palace_trine_star', palace: estate, star })),
    ]]],
  ]],
  ['1575-001', ['39897821f02d031884cf8f134af9caee6698ec192c37d5d07178b64b0cd92235',
    ['未田羊刧刑得日月化祿朝、正祿合者、反自田宅', [[
      ...inEstate('未', '擎羊', '地劫', '天刑'),
      { kind: 'palace_branch', palace: '兄弟', branch: '卯' },
      { kind: 'palace_relation', anchor: estate, target: '兄弟', relation: 'trine' },
      ...at('兄弟', '太阴'), ...changeAt('兄弟', '禄'),
      { kind: 'star_mutagen', palace: '兄弟', star: '太阴', change: '禄', scope },
      { kind: 'palace_branch', palace: '福德', branch: '午' }, ...adjacent('福德', '禄存'),
    ]]],
  ]],
  ['1577-001', ['ddf380c007a7958e577612f8bdb98dec2260f2df22b57b571f9baa845b271634',
    ['輔弼夾於田宮、富厚', [
      [...adjacent('官禄', '左辅'), ...adjacent('福德', '右弼')],
      [...adjacent('官禄', '右弼'), ...adjacent('福德', '左辅')],
    ]],
    ['而貞七陀同守田、破敗', [same('廉贞', '七杀', '陀罗')]],
  ]],
  ['1578-001', ['f4f6373385caee7e2c2be7d1f7986b696e5bf932285002e9b25e9079d04abdd4',
    [null, [[...same('禄存'), ...at(wealth, '天府')]]],
  ]],
  ['1579-001', ['26943dff80ef08a46e63d2b971e25cccf7a76a3e8a02a2ae3f97651483fdd409',
    ['田宮卯羊與化忌合者', [[...inEstate('卯', '擎羊'), { kind: 'palace_sector_mutagen', palace: estate, change: '忌' }]]],
  ]],
  ['1580-001', ['adb0100dbf2b5f1e5c37efb2de2d65e29c567efa504f542112b4b14c1dfba0b7',
    [null, [[...inEstate('丑', '巨门', '陀罗'), ...sector('天刑', '天姚')]]],
  ]],
  ['1585-001', ['60801466e3bd9f3002e01489c8c7c8d1cd9b43e9e57927be37141a71468e6d8f',
    [null, [[...inEstate('丑', '天机', '地空'), ...sector('擎羊', '火星', '陀罗', '地劫')]]],
  ]],
  ['1586-001', ['37b9b4312d15b4ab6b1a151819d8679b7d6507fd02ba471b5b8f622d9f577a7e',
    ['田宮左府為美', [{ required: treasuryWithAssistant, mustBeAbsent: sector('擎羊', '地劫', '地空', '陀罗') }]],
    ['而與羊刧合者甚貧', [[...treasuryWithAssistant, ...sector('擎羊', '地劫')]]],
    ['空陀加會丐乞', [[...treasuryWithAssistant, ...sector('擎羊', '地劫', '地空', '陀罗')]]],
  ]],
  ['1588-001', ['fee5c20467484739e1673e0c18c5954e461e235928d80d4b678b498c2f153bff',
    [null, [[...same('廉贞', '七杀', '天姚'), ...changeAt(estate, '忌')]]],
  ]],
  ['1589-001', ['11dbd0980a2435a8513a59316b191ecb955f09743cfd9f8395c1465b9417480d',
    ['未田梁鈴權同守者、梁主祖業', [[...inEstate('未', '天梁', '铃星'), ...changeAt(estate, '权')]]],
  ]],
  ['1590-002', ['1717421a381c43fbd3d1ec2612102a2d03c0a176a77e89fc875053fb38110c99',
    ['田宮武破祖業不多', [same('武曲', '破军')]],
  ]],
  ['734-001', ['aaf281274d08a120a0293b3b51aad59641aebe035eee2085076a3d614f691ef0',
    [null, [...'子午'].map(branch => [...inEstate(branch, '破军'), mainCount(1), brightness('破军', '庙')])],
  ]],
  ['738-001', ['9f376fb99467dcc760aa0f3e11c377419b75a21f7d4c04320e640ea49973b134',
    ['破軍同居空劫值沖', [[...same('武曲', '破军'), ...oppositeChildren, ...at('子女', '地空', '地劫')]]],
  ]],
  ['740-001', ['1c1185808569ee85f38444261eb28cd5999052e7b40f6592e1c50fe8444f1abb',
    ['田宮紫微祿馬相合', [purpleWithLuAndHorse]],
    ['天府貪武化祿相照者田宅盛', [[
      ...inEstate('午', '紫微'), ...at('兄弟', '武曲', '禄存', '天马'), trinePalace('兄弟'),
      ...at('子女', '贪狼'), ...oppositeChildren,
      ...at('疾厄', '天府', '廉贞'), trinePalace('疾厄'), ...changeAt('疾厄', '禄'), ownChange('疾厄', '廉贞', '禄'),
    ]]],
  ]],
  ['743-001', ['6957b5c297e5f8d03627a0ae3da7c3a4e222a45ca14e93a34fcd8424fe84e00b',
    ['子田紫微單守', [[...inEstate('子', '紫微'), mainCount(1)]]],
    ['落旬路空', [[...inEstate('子', '紫微', '旬空', '截路'), mainCount(1)]]],
  ]],
  ['745-001', ['cdd88e8b87297d6e5844ca285a7eee7614e502c3bd55dae2fd2e03e9f51118b7',
    ['田宮武府同居化權', [[...same('武曲', '天府'), ...changeAt(estate, '权'), ownChange(estate, '武曲', '权')]]],
  ]],
  ['746-001', ['d68d24d800c958b02c2bfb6063373e062f25ddeee758d33d3fb98b0e6fb59bd0',
    ['田財宮若居寅申地、紫府祿馬坐長生鄉', [longLifeTreasury]],
    ['財印來會者', [[...longLifeTreasury, ...['武曲', '天相'].map(star => ({ kind: 'palace_trine_star', palace: estate, star }))]]],
  ]],
  ['748-001', ['b4fa873df222284301619d7f14168e8f17949880f79d8a6d0c990c3f523b04ca',
    ['田宮巳亥貪貞落空', tanLianVoidSeats.flatMap(([branch, voids]) => voids.map(star => inEstate(branch, '廉贞', '贪狼', star)))],
  ]],
  ['812-001', ['fd72dcf2f73da5c0ecde8170bc4d9c9983680e6b150d683b86f511543fab46dd',
    ['田宅地空鈴星天空', [same('地空', '铃星', '天空')]],
  ]],
  ['813-001', ['7f695f375957ac38e7672a83be3d22602479e802283e910b38d8fb14a0d7b412',
    ['田宅武曲財星為主', [[...same('武曲'), mainCount(1)]]],
  ]],
  ['1563-001', ['4ecd91ba7542785615f1b154ea5cd518b49a9b9d9042fb10e556678be66ae29d',
    ['子田天同水、太陰水', [ziEstateWithTongYin]],
    ['化祿土與午地正祿相照', [[
      ...ziEstateWithTongYin, ...changeAt(estate, '禄'), ownChange(estate, '太阴', '禄'),
      ...oppositeChildren, branchAt('子女', '午'), ...at('子女', '禄存'),
    ]]],
  ]],
  ['1564-001', ['9f59da8688d4c71aea04023de01e2879fce17ede731306c1996905fac8259f1e',
    ['田宮落在路空、鈴姚同宮者、田宅不成', [estateWithCutoffBell]],
  ]],
  ['1565-001', ['1b8b465195e44cf7337448b7043d80b264399ef44f83bcee57068a58b03ee76f',
    ['辰地破軍右弼', [chenPojunWithAssistant]],
    ['而水生水局人則有良田美宅', [[...chenPojunWithAssistant, ...waterGenerationAndBureau]]],
  ]],
  ['1568-001', ['8e8f4a503191b4606c09d7fe447e1ffea74d4e56ce20468d3b63554627c4c024',
    ['天府祿存同守田財宮於水鄉者', treasuryInWater],
    ['兼有刑刧等星則相克不和、田財不成', [[...waterTreasury(wealth, '子'), ...at(wealth, '天刑', '地劫')]]],
  ]],
  ['1576-001', ['5c1cd8fdd59ad52789a0e7d663d7bd7a81e521a76185ce8a05f6a4b4eb12fa6c',
    ['田宮天梁單守旺宮、合化祿', [liangWealth]],
  ]],
  ['1587-001', ['e0feff567f40cbf623217a310c2a0ebad0521189ca61fca4fa2694061a7b7b9f',
    ['田宮雖有武曲財星、破軍同居', [same('武曲', '破军')]],
    ['空刧值沖貞殺刑陀交沖', [[
      ...same('武曲', '破军'), ...oppositeChildren, ...at('子女', '地空', '地劫'),
      ...sector('廉贞', '七杀', '天刑', '陀罗'),
    ]]],
  ]],
]);

export function compileXingjueEstate(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [hash, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== hash || passages.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》田宅篇的原文、出处或条件有变化，须重新核对。' };
  }
  const branches = passages.map(([text, groups]) => ({
    text,
    conditionCompiler: xingjueEstateProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group)),
  }));
  if (!branches[0].text) return { compiler: xingjueEstateProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》田宅篇已核盘式与分句匹配', branches };
}
