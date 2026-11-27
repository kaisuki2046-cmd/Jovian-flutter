import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueFudeProfile = 'ziwei-xingjue-fude-v1';
const prefix = 'ziwei-v3-xingjue-057-p';
const palace = '福德';
const scope = 'origin';
const starAt = (palace, star) => ({ kind: 'palace_star', palace, star, scope });
const same = (...names) => names.map(star => starAt(palace, star));
const atBranch = (branch, ...names) => [{ kind: 'palace_branch', palace, branch }, ...same(...names)];
const sector = (...names) => names.map(star => ({ kind: 'palace_sector_star', palace, star }));
const sectorChange = change => ({ kind: 'palace_sector_mutagen', palace, change });
const localChange = change => [{ kind: 'palace_mutagen', palace, change, scope }, sectorChange(change)];
const brightness = (star, brightness) => ({ kind: 'palace_brightness', palace, star, scope, brightness });
const adjacent = (target, star) => [
  { kind: 'palace_relation', anchor: palace, target, relation: 'adjacent' },
  starAt(target, star),
];
const ziweiTianxiangWithDijie = [...same('紫微', '天相'), ...sector('地劫')];
const mainCount = (palace, count) => ({ kind: 'palace_main_count', palace, count });
const trineSources = ['夫妻', '迁移'];
const trineSupport = ['禄存', '天同', '天梁', '天相', '左辅', '右弼'];
const related = (target, relation) => ({ kind: 'palace_relation', anchor: palace, target, relation });
const waterBureau = { kind: 'natal_ziwei_bureau', bureau: '水二局' };
// When the actual body is in Spouse or Travel, Zuo Fu's monthly placement
// is on the opposite branch parity and cannot be in that body's sector.
const bodySeatsOutsideFude = ['命宫', '财帛', '官禄'];
const bodySeats = [...bodySeatsOutsideFude, '夫妻', '迁移', '福德'];
const bodySeat = palace => ({ kind: 'palace_confirmed_body_seat', palace });
const majorStrong = palace => ({ kind: 'palace_major_state', palace, state: '庙旺' });
const coreCount = count => ({ kind: 'palace_core_star_count', palace, count });
const allStarCount = count => ({ kind: 'palace_origin_star_count', palace, count });
const starChange = (palace, star, change) => ({ kind: 'star_mutagen', palace, star, change, scope });
const natalChange = (palace, change) => ({ kind: 'palace_mutagen', palace, change, scope });
const trine = (...stars) => stars.map(star => ({ kind: 'palace_trine_star', palace, star }));
const sixMalefics = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];
const fudeAxis = [palace, ...trineSources, '财帛'];
const sectorClearOfAfflictions = {
  required: [{ kind: 'palace_sector_six_malefic_count', palace, count: 0 }],
  mustBeAbsent: fudeAxis.flatMap(target => [starAt(target, '廉贞'), natalChange(target, '忌')]),
};
const maoBodyFude = [...atBranch('卯', '擎羊', '文昌', '天刑'), bodySeat(palace)];
const oxLights = atBranch('丑', '太阳', '太阴');
const mainSolo = star => [...same(star), mainCount(palace, 1)];
const supportedQisha = palace => [
  waterBureau, mainCount(palace, 1), starAt(palace, '七杀'),
  ...['左辅', '右弼'].map(star => ({ kind: 'palace_sector_star', palace, star })),
];

// Reviewed against the Qing manuscript of Xingjue, printed pp. 180–187.
const reviewed = new Map([
  ['752-001', ['ba3f9956d29c9b0b1ae4d16fde20b3c8e02d1ab73b9306e94132cf99fe83ce0e',
    [null, [[...same('天府', '左辅'), { kind: 'natal_ziwei_bureau', bureau: '金四局' }]]],
  ]],
  ['753-001', ['d8af20a8da6ed708d7efe405acad909a82915c11de5c293b0c6f0b4fb72e1986',
    [null, [same('天同', '天梁')]],
  ]],
  ['754-001', ['e692be3afce1c2e6e2ecbd4708769ce92314f36fd351ea0181d538fb880972a3',
    [null, same('破军', '火星', '铃星').map(fact => ({
      required: same('禄存', '天马'), mustBeAbsent: [fact],
    }))],
  ]],
  ['757-001', ['6aa642174e0701f44779f788a30b4501c2a59d4262af7ee56cced7cdc35546ce',
    [null, [same('禄存')]],
  ]],
  ['766-001', ['c02b01d7a048565dc747f623352650cfbfa8ab4ef7270983cc8d1153dc8ba478',
    [null, [[...same('天府'), ...sector('禄存')], [...same('天府'), sectorChange('禄')]]],
  ]],
  ['767-001', ['a98d6f9749c8d67dd42c1c38d24ff170b2b889614b490830ee5b7fc071e6a46d',
    ['天同地刧同位', [same('天同', '地劫')]],
  ]],
  ['768-001', ['2baad01610155443c1249e94a4b7e356bbf87fd9dbf728ff1456d79e82ad3e10',
    [null, [[...atBranch('未', '文昌', '文曲', '天梁', '龙池', '凤阁'), ...localChange('科')]]],
  ]],
  ['769-001', ['949c942bcf18ca7fd061eadb4737f25f389344071ca0e7ba638d3ff9bb988fb9',
    ['七殺空劫同守福宮', [same('七杀', '地空', '地劫')]],
  ]],
  ['1588-001', ['2c478aae0a35dfcfdd547e2794801b93497a5efbd22a2187f1b3cf2896eb6fed',
    ['武破空刧同居福宮', [same('武曲', '破军', '地空', '地劫')]],
  ]],
  ['1589-001', ['31ab94a11159063046db2a516ba5591a62c744501029197cbb8d4e9aa8cc2dac',
    [null, [{
      required: [mainCount(palace, 0), ...adjacent('田宅', '天府'), ...adjacent('父母', '紫微'),
        ...trineSources.map(target => ({ kind: 'palace_relation', anchor: palace, target, relation: 'trine' }))],
      anyOf: [1, 2].flatMap(first => [1, 2].map(second =>
        [mainCount(trineSources[0], first), mainCount(trineSources[1], second)])),
    }]],
  ]],
  ['1591-001', ['557026a3ca329ad7efdef3d7b699285d36ec42e564290cdd0241c1b7ca9930a7',
    ['福宮廉貞文昌同守者福薄多厄', [{ required: same('廉贞', '文昌'), mustBeAbsent: same('天相') }]],
    ['而若天相同入者救其危', [same('廉贞', '文昌', '天相')]],
  ]],
  ['1592-001', ['3909603771be86baa66a5fbdd5041dd5d5cf862e5b2c61f388a735427b63b0e5',
    [null, [[...same('天梁', '文曲', '禄存'), ...localChange('禄')]]],
  ]],
  ['1593-001', ['40e93c503e4ed658d457f0e76e60b821fd6d62f9119be1d66b937f699c10026e',
    ['而若有天同則忌不能為害', [[...same('天同'), ...localChange('忌')]]],
  ]],
  ['1595-001', ['1701df825e316e9ceb6e270b6927a717b10f99aa5d702d89c964e0f2ce080836',
    ['而若水局得輔弼合、則金生水、土生金', [
      supportedQisha(palace),
      ...bodySeatsOutsideFude.map(body => [...supportedQisha(body), { kind: 'palace_confirmed_body_seat', palace: body }]),
    ]],
  ]],
  ['1597-001', ['053697eee9560ecfd7ed1b41d31c19c2358226dcc0e9f81f75a31bbe3d70208f',
    [null, [[...same('天同', '天梁'), ...localChange('禄')]]],
  ]],
  ['1598-001', ['8c9187ae8f4184c1cce35b6e6f79b9c486f23fa967aeea7958b92eeb234904ab',
    ['無會若福宮居子午遇破軍則化福勝貴', [...'子午'].map(branch => ({
      required: [...atBranch(branch, '破军'), ...trineSources.map(target => related(target, 'trine'))],
      mustBeAbsent: trineSupport.map(star => ({ kind: 'palace_trine_star', palace, star })),
    }))],
  ]],
  ['1601-001', ['c4ccc1f5df073f8fbeb65a3372f9e2afe8b422fa935d0f12ba8ffc31b4d1daf4',
    ['武曲坐守、平生辛勤、先難後易', [same('武曲')]],
  ]],
  ['1602-001', ['c386c6f97b968bdc270977784f3b3463708ac7ed5ca7a580f247c2a8459603b0',
    ['太陽坐守入廟、一生榮快', [[...same('太阳'), brightness('太阳', '庙')]]],
    ['太陰坐守、其貴如太陽', [same('太阴')]],
  ]],
  ['1604-001', ['6700157124ed4af11eda483f5077e8db99e81ec7656b3df5b6b86762a650a86a',
    ['羊刃一生勞心', [same('擎羊')]],
    ['陀羅一生勞心勤力', [same('陀罗')]],
  ]],
  ['1605-001', ['3e7bc7681ea3bee1f8e29afb3377edb0799eda9526237b6501a1686cdadd9839',
    ['天鈴勞碌', [same('铃星')]],
  ]],
  ['1608-001', ['5c844698de75f1633fe47b7b5e506407a0eab71fab72ec85af72afdbab8b0204',
    ['無梁祿而廉貞兼守七陀、姚星相合、福薄', [{
      required: same('廉贞', '七杀', '陀罗'),
      anyOf: trineSources.map(target => [
        { kind: 'palace_relation', anchor: palace, target, relation: 'trine' }, starAt(target, '天姚'),
      ]),
      mustBeAbsent: [...same('天梁', '禄存'), { kind: 'palace_mutagen', palace, scope, change: '禄' }],
    }]],
  ]],
  ['1612-001', ['c04a3320750ed8366a1234040b95dfd17a156ef4e33647bb6fedcb91f5a4cb2c',
    ['若與地刧相會、則為破格', sector('天刑', '天马').map(fact => ({
      required: ziweiTianxiangWithDijie, mustBeAbsent: [fact],
    }))],
    ['若遇刑刧馬反為吉早發', [[...ziweiTianxiangWithDijie, ...sector('天刑', '天马')]]],
  ]],
  ['1615-001', ['353925602929c9df80ef44d872c659574dc7e0d2499550b895990e17140fc514',
    ['福宮卯地右弼地空同居', [atBranch('卯', '右弼', '地空')]],
  ]],
  ['1616-001', ['f48e7414aee723e79d70289cec5b3f6c4475e9e7e0e64269c19f1c24e2592a5d',
    ['福宮子地天梁得日月科權昌曲俱照者為吉', [[
      ...atBranch('子', '天梁'), ...sector('太阳', '太阴', '文昌', '文曲'), sectorChange('科'), sectorChange('权'),
    ]]],
  ]],
  ['1624-001', ['7b362a8a62ab3bc6526d5344b824a3ee01887a05b8608f60f2ce819ab8dc7b89',
    [null, [
      [...same('文曲', '禄存'), ...sector('武曲', '破军')],
      [...same('文曲'), ...localChange('禄'), ...sector('武曲', '破军')],
    ]],
  ]],
  ['1625-001', ['9c6008cfc5cf56b6f5f12eb50d1af5ce536aec02034c0c917dfe9b9cdfa71db0',
    [null, [sector('紫微', '天府', '禄存', '天马')]],
  ]],
  ['1626-001', ['c61d4af3fa99fb07ef5ab2477a0fd3e68ebea9233a9851b8586c8a44b157793f',
    ['同梁夾七殺於福宮', [[...same('七杀'), ...adjacent('田宅', '天同'), ...adjacent('父母', '天梁')]]],
  ]],
  ['1630-001', ['42bc86ac90de41bf8dc4fa5f43bb0702a9b88cdd04e491252540a96f14af6e4e',
    ['福宮子地同月得梁祿朝', [{
      required: atBranch('子', '天同', '太阴'),
      anyOf: trineSources.map(target => [
        { kind: 'palace_relation', anchor: palace, target, relation: 'trine' }, starAt(target, '天梁'),
        { kind: 'star_mutagen', palace: target, scope, star: '天梁', change: '禄' },
      ]),
    }]],
  ]],
  ['1632-001', ['037ed8ab1c346c642540b7f0bb600917ca8c5d6d33e6667135a9fefbb85d1db8',
    ['天相輔弼天鉞同居福宮、台座夾之', [['三台', '八座'], ['八座', '三台']].map(([first, second]) => [
      ...same('天相', '左辅', '右弼', '天钺'), ...adjacent('田宅', first), ...adjacent('父母', second),
    ])],
  ]],
  ['1633-001', ['76377a1b74fbf98111f29f309bf422a37d7aabd1aa92d9ea5af8cb16b330015a',
    ['福宮紫相不宜與姚同居', [same('紫微', '天相', '天姚')]],
  ]],
  ['1634-001', ['6869a1d210f2e61aa4d89ebef5f202734de15706c4ed8b9e91625d3344262db0',
    ['福宮紫相與壽星合者、雖有刑姚等惡星、能享壽福', [[
      ...same('紫微', '天相', '天寿'), ...sector('天刑', '天姚'),
    ]]],
  ]],
  ['749-001', ['3717fbc233701e7eb457efb76f0e93091169379177e5abaa563ecf54b2a92627',
    ['身命旺而福宮無殺', bodySeats.map(body => ({
      required: [...sectorClearOfAfflictions.required, bodySeat(body), majorStrong('命宫'), ...(body === '命宫' ? [] : [majorStrong(body)])],
      mustBeAbsent: sectorClearOfAfflictions.mustBeAbsent,
    }))],
  ]],
  ['750-001', ['4c95f6603c9a9ee8a6e52482eb4893bc29ef40df4cf143e8d75a45487158c480',
    ['福宮居亥地、太陽單守巳地、化忌來沖者、所謂忌沖陽精', [[...atBranch('亥'), related('财帛', 'opposite'),
      { kind: 'palace_branch', palace: '财帛', branch: '巳' }, starAt('财帛', '太阳'), mainCount('财帛', 1),
      starChange('财帛', '太阳', '忌'), sectorChange('忌')]]],
  ]],
  ['751-001', ['3cc85bad0c60d18cb5bf8c28ab24a0816fe7276942d02887dadfa5bcded62a4b',
    [null, [same('天同')]],
  ]],
  ['755-001', ['6dcce1f296a03126c090f353c40547c59eddecaea8609dd936e1ebf2015bc0f9',
    ['左輔文曲台池同入', [atBranch('辰', '天同', '左辅', '文曲', '三台', '龙池')]],
  ]],
  ['758-001', ['4c3bdc037edef6a1920d202901f3b4f403b7bae46f24ce6179974684f24e0159',
    ['福宮貞七陀鈴', [[...same('廉贞', '七杀'), ...sector('陀罗', '铃星')]]],
  ]],
  ['759-001', ['3f55fea854c7111e5927cc79bb17d78b50866054e3298a62a9187c4c8ee43ee5',
    ['福宮寅地祿馬池閣', [[...atBranch('寅', '禄存', '天马'), ...sector('龙池', '凤阁')]]],
  ]],
  ['760-001', ['ade93656de7f90b91acf9309aaceb8b8c15c56efc855bf48e00ec6589093c7a6',
    ['酉地文曲單守福宮至貴無雙', [[...atBranch('酉', '文曲'), coreCount(1)]]],
  ]],
  ['761-001', ['238bb4e98f269501a2824d6c12306455ad5013d10ce867b08114bbcfc426f9e6',
    ['福宮雖無正星三台', [[...same('三台'), mainCount(palace, 0), allStarCount(1)]]],
  ]],
  ['763-001', ['bab99533945624d515757dd2269149df09b03eb7949b5abbc380b2bdb41cf703',
    ['陀火及忌、則皆不福。', [[...oxLights, ...sector('陀罗', '火星'), sectorChange('忌')]]],
  ]],
  ['764-001', ['02e4ed899abbd5271af3bfad7b9f9704d91121af932cfa91b41b3348c4f3164d',
    ['福宮貪狼單守', [mainSolo('贪狼')]],
  ]],
  ['765-001', ['d79583fcb89397630226f78edfa0d7d070098069c56e5b1c90ae39dd1ef76cea',
    ['福宮天府輔弼', [same('天府', '左辅', '右弼')]],
  ]],
  ['1587-001', ['f2cdb3ad3e5e896ef5b3b32010e90a2914d36ba3c897656df684ab9ff439df3a',
    ['病符官符守福', [[
      { kind: 'palace_boshi_star', palace, star: '病符' }, { kind: 'palace_suiqian_star', palace, star: '官符' },
    ]]],
  ]],
  ['1596-001', ['cc63d0f04728df8a2b4de3b0c493115ea1ff95735d97eb6c6fed13e86f24ecb6',
    ['卯地身福宮羊昌天刑甚不宜', [maoBodyFude]],
    ['而若水局則羊昌金生局', [[...maoBodyFude, waterBureau]]],
  ]],
  ['1599-001', ['2c56f5caad0b1d173f3632621b864b961555bc8bd4e54cef0fb2f7b549f3b140',
    ['福宮天府封誥坐臨、右弼相合、財印文星拱者多慶福', [[
      ...same('天府', '封诰'), ...trine('右弼', '武曲', '天相', '文昌'),
    ]]],
  ]],
  ['1603-001', ['fd82bef3898d5a7e19b02d1c9b15a23c13e2cfc459c0ce0717c2ba97380290dd',
    ['七殺入廟', [[...same('七杀'), brightness('七杀', '庙')]]],
  ]],
  ['1609-001', ['7e8c779fea8524466777ac266fdd9ad560bffcf1ce42dcc96f6da2e8cfa8c66e',
    ['福宮空刧陀羅相合、忌鈴相照', [[...sector('地空', '地劫', '陀罗'),
      related('迁移', 'trine'), starAt('迁移', '铃星'), natalChange('迁移', '忌'), sectorChange('忌')]]],
  ]],
  ['1611-001', ['dd8de1dc8e4caf72d5e3af75942c0849f4a75f5784d29a6b34e77338dd741981',
    ['福宮巳地天機單守、雖與鈴星相居', [[...atBranch('巳', '天机', '铃星'), mainCount(palace, 1)]]],
  ]],
  ['1613-001', ['8eb27e028bfc6d005fd80209dabcdf9298a492664635e6afe454dd567189c02f',
    ['福宮文昌單守', [[...same('文昌'), coreCount(1)]]],
  ]],
  ['1614-001', ['bb0cb6a9e66b8fba0b5fb0e5487f129e840637b153dde29868ed462ca11c0596',
    ['福宮火星單守', [[...same('火星'), coreCount(1)]]],
  ]],
  ['1620-001', ['d2c64778aa9b80f913269ba67915f6c216f97fb2620904e0dd5c592053da8287',
    ['辰福巨門', [atBranch('辰', '巨门')]],
  ]],
  ['1628-001', ['1e2d431913e66cada02ea9a487b96fe0d6ffb6f0351e3a6829baad2c21a8b9f3',
    ['福宮雖有凶星、若有同梁紫微輔弼中一星合會', sixMalefics.map(star => ({
      required: same(star), anyOf: ['天同', '天梁', '紫微', '左辅', '右弼'].map(good => sector(good)),
    }))],
  ]],
  ['1635-001', ['dac3d5518f86f8c4cd0d1f0f4de5e86eba9daac3dd04c22c278713ff7cc92fb5',
    ['福宮日月權鉞', [[...same('太阳', '太阴', '天钺'), starChange(palace, '太阴', '权')]]],
  ]],
  ['1636-001', ['9b3f0619e9e73781bb301203feb794d2fc769713381343a03a1b26707ee3511e',
    ['子地福宮則破昌皆得地', [[...atBranch('子', '破军', '文昌'), brightness('破军', '庙'), brightness('文昌', '得')]]],
  ]],
]);

export function compileXingjueFude(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [hash, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== hash || passages.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》福德篇的原文、出处或条件有变化，须重新核对。' };
  }
  const branches = passages.map(([text, groups]) => ({
    text,
    conditionCompiler: xingjueFudeProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group)),
  }));
  if (!branches[0].text) return { compiler: xingjueFudeProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》福德篇已核盘式与分句匹配', branches };
}
