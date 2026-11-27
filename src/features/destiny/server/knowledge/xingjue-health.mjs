import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueHealthProfile = 'ziwei-xingjue-health-palace-v1';
const prefix = 'ziwei-v3-xingjue-052-p';
const palace = '疾厄', scope = 'origin';
const at = (palace, ...stars) => stars.map(star => ({ kind: 'palace_star', palace, star, scope }));
const same = (...stars) => at(palace, ...stars);
const seat = (palace, branch) => ({ kind: 'palace_branch', palace, branch });
const atBranch = (branch, ...stars) => [seat(palace, branch), ...same(...stars)];
const link = (target, relation) => ({ kind: 'palace_relation', anchor: palace, target, relation });
const sector = (...stars) => stars.map(star => ({ kind: 'palace_sector_star', palace, star }));
const trine = star => ({ kind: 'palace_trine_star', palace, star });
const sectorChange = change => ({ kind: 'palace_sector_mutagen', palace, change });
const localChange = change => [{ kind: 'palace_mutagen', palace, change, scope }, sectorChange(change)];
const ownChange = (star, change) => ({ kind: 'star_mutagen', palace, star, change, scope });
const bright = (star, brightness) => ({ kind: 'palace_brightness', palace, star, brightness, scope });
const bodySeat = palace => ({ kind: 'palace_confirmed_body_seat', palace });
const bureau = bureau => ({ kind: 'natal_ziwei_bureau', bureau });
const phase = (palace, phase) => ({ kind: 'palace_changsheng_phase', palace, phase });
const boshi = (palace, star) => ({ kind: 'palace_boshi_star', palace, star });
const suiqian = (palace, star) => ({ kind: 'palace_suiqian_star', palace, star });
const layout = { kind: 'ziwei_confirmed_natal_layout' };
const singleMajor = { kind: 'palace_main_count', palace, count: 1 };
const noMajor = { kind: 'palace_main_count', palace, count: 0 };
const fourMalefics = ['擎羊', '陀罗', '火星', '铃星'];
const witnessedMaleficCounts = [
  ['命宫', [2, 3, 4]], ['夫妻', [2, 3]], ['财帛', [2, 3, 4]],
  ['迁移', [2, 3, 4]], ['官禄', [2, 3]], ['福德', [2, 3]],
];
const siTongWithLiang = [
  ...atBranch('巳', '天同'), singleMajor, layout,
  seat('夫妻', '申'), ...at('夫妻', '贪狼'), phase('夫妻', '长生'),
  seat('父母', '亥'), ...at('父母', '天梁'), link('父母', 'opposite'),
];
const waterPunishmentAndBell = [...same('天刑', '铃星'), bureau('水二局'),
  { kind: 'natal_year_nayin_element', element: '水' }];
const growingTongLiang = [...same('天同', '天梁'), phase(palace, '长生')];
const swordOnHorse = [...atBranch('午', '擎羊'), { kind: 'natal_ziwei_hour', branch: '午' }];

// The reviewed quotations stop at natal configurations. The surrounding
// symptom, lifespan and treatment statements stay in the source record.
const reviewed = new Map([
  ['670-001', ['28aea696eb52cd69e7a04037a93b7446c3d7928730d0044f04ddfc28dbeeb504',
    ['疾宮天府坐守生方', [[...same('天府'), phase(palace, '长生')]]],
  ]],
  ['671-001', ['9264cce2ab9fd4dea1f3bd034d03905c263f0ec39baae4a59f11f61701df5d3e',
    ['化祿天壽同宮', fourMalefics.map(star => [...same('天寿', star), ...localChange('禄')])],
  ]],
  ['673-001', ['2d77162bcacea1a0db1c8f7eb141940837449a10bdb864952249c912858b7da9',
    ['貪居疾宮同梁相遇', [['巳', '申'], ['亥', '寅']].map(([branch, paired]) => [
      ...atBranch(branch, '贪狼'), seat('夫妻', paired), ...at('夫妻', '天同', '天梁'), layout,
    ])],
  ]],
  ['674-001', ['3c1b17db257fedce82b92d791b04651e1757b7b3bd45f78a44039d69063812f1',
    ['天相單守紅鸞同居', [[...same('天相', '红鸾'), singleMajor]]],
  ]],
  ['676-001', ['2f3dac670016699e5c9146fbc2eb3d1cd6738d4761c24a24bb6bb5c61431dae6',
    ['七殺天刑居旺地', [[...atBranch('午', '七杀', '天刑'), bright('七杀', '旺')]]],
  ]],
  ['677-001', ['f9840b50673f5d81fc1782f57814871927041bae42a95266c2f80a9b751c2216',
    ['丑疾同巨羊火', [[...atBranch('丑', '天同', '巨门'), ...sector('擎羊', '火星')]]],
  ]],
  ['678-001', ['c4c1cca76a7710e1addf84c82662aab050870eed20cb58bd256d6f2235007908',
    ['疾宮同弼同居', [same('天同', '右弼')]],
    ['雖陷地與地刧同室', [[...same('天同', '右弼', '地劫'), bright('天同', '陷')]]],
  ]],
  ['679-001', ['009663f7ad5042afba90cc98cc3660595ee4b6abb00ae8e8a1cafa777b6949bc',
    ['紫相青龍同居疾宮', [[...same('紫微', '天相'), boshi(palace, '青龙')]]],
  ]],
  ['680-001', ['f05be46dbb84f24256fe7dfbca6f6c846b1206eb70ebcaa7628270fc6ab99350',
    ['疾宮紫破與祿壽同垣', [[...same('紫微', '破军', '天寿'), ...localChange('禄'), ownChange('破军', '禄')]]],
  ]],
  ['682-001', ['c5dacd5e6bad205f0bd09e0f3c88cdb37fdb8e76a49478346968c461bc812b66',
    ['巨門天馬遇陀羅', [[...same('巨门', '天马', '陀罗'), boshi(palace, '力士')]]],
  ]],
  ['1446-001', ['746362d08ae6a33aa8f326b7c22ffc887cb437db3e0080e2fecb78d3ca2896ca',
    ['厄宮有相鉞同守', witnessedMaleficCounts.map(([target, counts]) => ({
      required: [...same('天相', '天钺'), ...(target === '命宫' ? [] : [bodySeat(target)])],
      anyOf: counts.map(count => [{ kind: 'palace_sector_malefic_count', palace: target, count }]),
    }))],
  ]],
  ['1447-001', ['8caa41f4a5a884815e6b0a133d711a1ce167c48a96d9103d07fcdbcd2c3684be',
    ['厄宮巳地太陽祿存同守', [atBranch('巳', '太阳', '禄存')]],
  ]],
  ['1448-001', ['0f69fef5686cee030ea3acce86abf4e00dfa180729e10b6dfd826b09c48330a8',
    ['厄宮馬頭帶釖', [swordOnHorse]],
    ['而若木局人得天同水相救', [[...swordOnHorse, bureau('木三局'), trine('天同')]]],
  ]],
  ['1449-001', ['45419121dba46d9592b434694cf30a70ca1433e3c8b0c800865c70350b0248ee',
    ['厄宮空刧刑忌逢者', [[...sector('地空', '地劫', '天刑'), sectorChange('忌')]]],
  ]],
  ['1450-001', ['33a32e5600ea69c87cda3543c455acaf9f912ddf0871c757440af2ccec2bc36a',
    ['金局人疾宮武曲金、天相水、左輔土同入', [[...same('武曲', '天相', '左辅'), bureau('金四局')]]],
  ]],
  ['1451-001', ['1c557a1f0c8c7aa3e8ac2ea35eef157a18467bb2c721487209dfcd9add208437',
    ['貞七與鈴同入', [same('廉贞', '七杀', '铃星')]],
    ['而若與化祿同居', [[...same('廉贞', '七杀', '铃星'), ...localChange('禄')]]],
  ]],
  ['1452-001', ['d2c689959787ad975429ecacbcef2a7a946bbf4f0aac3fc3cfbf50f29305074a',
    ['厄宮辰戌破軍', [...'辰戌'].map(branch => atBranch(branch, '破军'))],
  ]],
  ['1453-001', ['bd3543edf30fe696925499b624a99ec31daa7e0d8db5c5caa84a3f1610453500',
    ['曲梁同守', [same('文曲', '天梁')]],
    ['權馬同居', [[...same('文曲', '天梁', '天马'), ...localChange('权'), ownChange('天梁', '权')]]],
  ]],
  ['1454-001', ['910677840a253a85c13feb579dc7c5f0d74668968df6071fbb0a26ba953a4eb1',
    ['申疾貪星坐生方', [[...atBranch('申', '贪狼'), phase(palace, '长生')]]],
  ]],
  ['1455-001', ['0b58ba8ab0976ee23b7b874de6043b00d726032cba1861507d83d91c282a8fb5',
    ['疾宮破軍地空鈴星', [same('破军', '地空', '铃星')]],
  ]],
  ['1456-001', ['6902dbface935df3586c2e959f4b78b8fbf26282c21a45fdef67a1d50bc789eb',
    ['天府單守疾宮', [[...same('天府'), singleMajor]]],
    ['而若坐死絕地、與陀相合、七刑來沖', [...'死绝'].map(state => [
      ...same('天府'), singleMajor, phase(palace, state), ...sector('陀罗'),
      ...at('父母', '七杀', '天刑'), link('父母', 'opposite'),
    ])],
  ]],
  ['1458-001', ['cb690c74967e246bcf1fe08d7e07971b4c4dcd5aa09290d1dc7d351fa66835d6',
    ['巳宮疾、天同單守、申地長生貪狼相合、亥地天梁相照', [siTongWithLiang]],
    ['又有祿存化祿間一星來會', [[
      ...siTongWithLiang, sectorChange('禄'), ...at('兄弟', '天机'),
      { kind: 'star_mutagen', palace: '兄弟', star: '天机', change: '禄', scope },
    ]]],
  ]],
  ['1459-001', ['e9989b06db30d7855ba35d1ed96bba23d8a995cee01a9ab50812883e230da222',
    ['疾宮刑鈴、水生水局人', [waterPunishmentAndBell]],
    ['府相合照', [[...waterPunishmentAndBell, trine('天府'), trine('天相')]]],
  ]],
  ['1460-001', ['560d3b67ad329ae7c1c438a48fef9b983b3ed23e58440a9ecbd1798d4f4bdb98',
    ['疾宮坐生方、同梁並守', [growingTongLiang]],
  ]],
  ['1461-001', ['69c07d97bc76e770a5a58b9117ffe053c511cbc3f695c7e4d6e2c9e1078ef9dc',
    ['疾宮雖有壽、若土局生人、巨門為疾宮主星', [[...same('巨门', '天寿'), bureau('土五局')]]],
  ]],
  ['1462-001', ['772bf2579d2f712f2152d24737d384f6af174ef4cf905d45f97d986570f53973',
    ['祿馬同宮', [same('禄存', '天马')]],
    ['閣馬同宮', [same('凤阁', '天马')]],
    ['科閣同宮', [[...same('凤阁'), ...localChange('科')]]],
    ['武相同宮', [same('武曲', '天相')]],
  ]],
  ['1463-001', ['5b5ba742ba2ea87283b381d2637b44329c6c0a5fcb53bbd6d150c0fc6bd3b39e',
    ['疾宮紫貪八座官貴', [same('紫微', '贪狼', '八座', '天官')]],
    ['權星同臨', [[
      ...same('紫微', '贪狼', '八座', '天官'), ...localChange('权'), ownChange('贪狼', '权'),
    ]]],
  ]],
  ['1464-001', ['bf6d18faf3627042bb1f71cd4b83a6b436c5a7dbee1d5cf7123328c115b74947',
    ['疾宮天相池閣', [same('天相', '龙池', '凤阁')]],
  ]],
  ['1465-001', ['d17f4c2cfac39f5fa0ee30ed6c265aec147dd0e939f9f828b150091bade84083',
    ['申疾武曲', [atBranch('申', '武曲')]],
    ['加以天相同位', [atBranch('申', '武曲', '天相')]],
  ]],
  ['1466-001', ['071d53f8737666ffa7aaca5479a26a07030e99881272511ade4d3dd0ffd5c8d5',
    ['戌地貞與鸞同居', [atBranch('戌', '廉贞', '红鸾')]],
    ['若天府天貴同垣', [atBranch('戌', '廉贞', '红鸾', '天府', '天贵')]],
  ]],
  ['1467-001', ['7e27785cbffb5cd9a3424f510e08116de00bee75eb10c1d9bc1c2ed90bbe11a7',
    ['疾宮空虛坐病鄉', [[noMajor, phase(palace, '病')]]],
    ['羊刧沖拱', [[noMajor, phase(palace, '病'), ...sector('擎羊', '地劫')]]],
  ]],
  ['1468-001', ['e44c05401227bcb4e72014b688482e44d9728523ca9b33a1e947a3a94d04fd2e',
    ['巳疾鈴貪貞同居', [atBranch('巳', '铃星', '贪狼', '廉贞')]],
    ['空刧夾者', [[
      ...atBranch('巳', '铃星', '贪狼', '廉贞'), ...at('财帛', '地劫'), ...at('迁移', '地空'),
      link('财帛', 'adjacent'), link('迁移', 'adjacent'),
    ]]],
  ]],
  ['1471-001', ['d4677d7c7e3ea5a1e6c32a945c7732bf742636a38587bc3f573f044801ca435f',
    ['疾宮巳亥貪貞', [...'巳亥'].map(branch => atBranch(branch, '贪狼', '廉贞'))],
    ['而若雙祿同居為元央格', [[...atBranch('巳', '贪狼', '廉贞', '禄存'), ...localChange('禄'), ownChange('贪狼', '禄')]]],
  ]],
  ['1472-001', ['8f4bfeae3fe0b5d5d69ad86df15b37e47ab395094521d288b115408d379f30e1',
    ['大小耗在疾宮', [['大耗', '小耗'], ['小耗', '大耗']].map(([first, second]) => [boshi(palace, first), suiqian(palace, second)])],
  ]],
  ['1473-001', ['13c73553b515a86d2a40ff2193a34f0fd2c52bc9838500df1be4bc1f6055b335',
    ['同梁文曲同守疾宮', [same('天同', '天梁', '文曲')]],
  ]],
  ['1475-001', ['bb47b5dd330636f2291445fb95860deda61407921c4190550a2a4d25d9843c8d',
    ['青龍龍德居疾宮', [[boshi(palace, '青龙'), suiqian(palace, '龙德')]]],
  ]],
]);

export function compileXingjueHealth(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [digest, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== digest || passages.some(([text]) => !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》疾厄篇的原文、出处或条件有变化，须重新核对。' };
  }
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》疾厄篇已核盘面分句匹配',
    branches: passages.map(([text, groups]) => ({
      text, conditionCompiler: xingjueHealthProfile,
      inputs: groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group)),
    })) };
}
