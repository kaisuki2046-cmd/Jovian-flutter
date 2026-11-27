import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueChildrenProfile = 'ziwei-xingjue-children-v1';
const prefix = 'ziwei-v3-xingjue-050-p';
const palace = '子女';
const scope = 'origin';
const starAt = (seat, star) => ({ kind: 'palace_star', palace: seat, star, scope });
const same = (...stars) => stars.map(star => starAt(palace, star));
const branchAt = (seat, branch) => ({ kind: 'palace_branch', palace: seat, branch });
const at = (branch, ...stars) => [branchAt(palace, branch), ...same(...stars)];
const mainCount = count => ({ kind: 'palace_main_count', palace, count });
const phase = value => ({ kind: 'palace_changsheng_phase', palace, phase: value });
const bureau = value => ({ kind: 'natal_ziwei_bureau', bureau: value });
const nayin = element => ({ kind: 'natal_year_nayin_element', element });
const boshi = (seat, star) => ({ kind: 'palace_boshi_star', palace: seat, star });
const suiqian = (seat, star) => ({ kind: 'palace_suiqian_star', palace: seat, star });
const changeAt = (seat, change) => ({ kind: 'palace_mutagen', palace: seat, change, scope });
const sectorChange = (seat, change) => ({ kind: 'palace_sector_mutagen', palace: seat, change });
const localChange = (change, seat = palace) => [changeAt(seat, change), sectorChange(seat, change)];
const starChange = (star, change) => ({ kind: 'star_mutagen', palace, star, change, scope });
const sector = (...stars) => stars.map(star => ({ kind: 'palace_sector_star', palace, star }));
const relation = (target, relation) => ({ kind: 'palace_relation', anchor: palace, target, relation });
const atRelated = (seat, path, star) => [relation(seat, path), starAt(seat, star)];
const external = [['田宅', 'opposite'], ['仆役', 'trine'], ['父母', 'trine']];
const flankSeats = [['夫妻', '财帛'], ['财帛', '夫妻']];
const flanks = (a, b) => flankSeats.map(([first, second]) => [...atRelated(first, 'adjacent', a), ...atRelated(second, 'adjacent', b)]);
const outside = (stars, chartFacts) => ({
  required: [...chartFacts, ...sector(...stars)], mustBeAbsent: same(...stars),
});
const outwardLu = [
  ...external.map(([seat, path]) => atRelated(seat, path, '禄存')),
  ...external.map(([seat, path]) => [relation(seat, path), changeAt(seat, '禄'), sectorChange(palace, '禄')]),
];
const nobleOpposition = [['天魁', '天钺'], ['天钺', '天魁']].map(([here, there]) =>
  [...same(here), ...atRelated('田宅', 'opposite', there)]);
const intercept = [...'甲乙丙丁戊己庚辛壬癸'].map((stem, index) => [
  { kind: 'natal_year_stem', stem }, branchAt(palace, '申午辰寅子'[index % 5]),
]);
const outerBenefics = external.flatMap(([seat, path]) => '左辅 右弼 文昌 文曲 天魁 天钺 禄存'.split(' ')
  .map(star => atRelated(seat, path, star)));
const yinSolarJumen = at('寅', '巨门', '太阳');
const otherPalaces = ['命宫', '兄弟', '夫妻', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
const jiElsewhere = otherPalaces.map(seat => localChange('忌', seat));

// Qing manuscript, pp. 153–158. Preserve the known chart conditions
// and quote only the supported clause when the manuscript adds another.
const reviewed = new Map([
  ['632-001', ['b3bab161a678d85ca2b98b98a4a34732a5b81bb3194f864c5941188746dceb63',
    [null, [same('禄存', '旬空')]],
  ]],
  ['633-001', ['183fce2474348567c269fabdb020e9ff3e631b133eae4118683a2f4e85b8b677',
    [null, [sector('太阳', '太阴', '文昌', '文曲')]],
  ]],
  ['634-001', ['3441a64ca5fae5cd8e57f0c2f7ac2d7ad530b619491af35a9a0dc55e6bb37c26',
    [null, [[...at('酉', '天相'), bureau('水二局'), mainCount(1)]]],
  ]],
  ['635-001', ['c58557cb1b1d8b6dc5c5ab9fae5456d3bdd9e557fc29609f25f9627c4a9e2599',
    [null, [{ required: same('太阳', '太阴'),
      anyOf: ['死', '绝', '衰'].flatMap(value => outwardLu.map(group => [phase(value), ...group])),
    }]],
  ]],
  ['636-001', ['579d03a908212ee7658cd2e114ecae3587dfff6694e6a82b615dc5c9e96d22da',
    [null, [same('贪狼', '铃星')]],
  ]],
  ['638-001', ['01f1b439b441cf4dfe8b74a7c644910fc4025581ff447b3e82c407a373738a14',
    [null, [[...at('亥', '天同', '右弼'), bureau('水二局'), nayin('水'), ...sector('文昌')]]],
  ]],
  ['639-001', ['a22a152c3af5ed5cec9cbace8eac0007454e7d06d482af9e5700c24833b36dc3',
    [null, [[...at('戌'), ...sector('太阳', '太阴', '文昌', '文曲')]]],
  ]],
  ['640-001', ['54b14207dc2fa99e0aa1422566afeb73defe4e0687bda45356090fe660c9354f',
    [null, [sector('太阳', '太阴', '文昌', '文曲')]],
  ]],
  ['642-001', ['f111d1467a7b54553de860d6f957c55fa154a328a64e7355bddb8ef4afc364c2',
    [null, [[...same('贪狼'), boshi(palace, '青龙')]]],
  ]],
  ['645-001', ['6505307b5c7b7c824adfb9bb2613be2433d4f88466d0793984758b2771653163',
    ['子宮酉地貞破火星', [at('酉', '廉贞', '破军', '火星')]],
  ]],
  ['646-001', ['16ca3caba78ec05ed1e24d1a5e85e26412b4d7f7e1f99a9ce44135980b19b54f',
    ['未地天相輔弼同居', [at('未', '天相', '左辅', '右弼')]],
  ]],
  ['648-001', ['6d49af306037d17dfac1046da4af5d51a0f8a2c65ce5e323fc2bf75f10237e29',
    [null, flanks('左辅', '右弼').map(group => ({
      required: group, anyOf: ['天魁', '天钺'].map(star => same(star)),
    }))],
  ]],
  ['649-001', ['a976d925e515f89ee02a8634a2e3d732cbf5424bcc52ba261c11adc703368e2e',
    [null, [at('卯', '廉贞')]],
  ]],
  ['650-001', ['7e2eafa295cbdef227acc58578847384517266b3705a5c2d2ad95d7d98f1020b',
    [null, [[...same('火星'), phase('衰')]]],
  ]],
  ['651-001', ['14e7478d57d2d3b506d2a699558e37c492f80d048eebcc0db4c907ffa954e1d0',
    ['子宮日月與陀忌同宮者', [[...same('太阳', '太阴', '陀罗'), ...localChange('忌')]]],
  ]],
  ['652-001', ['3df7029b5c24085d1fedb3cc23c1bb42218c7e98e0ce0f5a07bb442ea76f8f83',
    [null, flanks('紫微', '天府').map(group => [phase('长生'), ...group])],
  ]],
  ['653-001', ['02abc06fd114d76fe43332e1185e10b56fb3fedfbc0b18aa1c493847dd25199b',
    [null, [at('卯', '天相')]],
  ]],
  ['1377-001', ['d54991412effc55c5b300482ace76f89204bab9c9b9a67170fb10ef5d021d6b4',
    ['子宮三合祿守亦無子', [{
      required: [{ kind: 'palace_trine_star', palace, star: '禄存' }],
      anyOf: '沐浴 冠带 临官 衰 病 死 墓 绝 胎 养'.split(' ').map(value => [phase(value)]),
    }]],
    ['而子宮若居生旺地則祿存雖臨無妨', [{ required: same('禄存'),
      anyOf: ['长生', '帝旺'].map(value => [phase(value)]),
    }]],
  ]],
  ['1378-001', ['0ac6aaf944458b5e826c9daa35b1986740d03ebe276e0c623d389df7ec0fbadc',
    [null, [[...at('午', '天机', '擎羊'), ...localChange('忌')]]],
  ]],
  ['1381-001', ['d9c7b0e02a10ae249cc8b52fe5aa2b812a8a5c0367af87a417dfb712b820c3f0',
    [null, [[...at('亥', '太阴', '铃星'), bureau('水二局'),
      branchAt('命宫', '寅'), starAt('命宫', '天相')]]],
  ]],
  ['1382-001', ['e366753ea456f817855c6611f8c60e658c1885a4e3c07ff14acd179d570821e0',
    [null, [outside(['紫微', '文昌', '文曲'], [...at('酉'), bureau('水二局')])]],
  ]],
  ['1383-001', ['4aa09bc3ea7cae1ef512e85455ec6c784b8b8df30cf694bb592e589a48792e79',
    ['子宮巳地、貪貞與地刧同居', [at('巳', '贪狼', '廉贞', '地劫')]],
  ]],
  ['1384-001', ['fc7461c49cb44164fef8a5abb2af255c071ed8439a248278b8b0b68e7e2af17d',
    [null, [[boshi(palace, '青龙'), suiqian(palace, '白虎')],
      ...flankSeats.map(([dragon, tiger]) => [relation(dragon, 'adjacent'), boshi(dragon, '青龙'),
        relation(tiger, 'adjacent'), suiqian(tiger, '白虎')])]],
  ]],
  ['1385-001', ['79626b526e6e1fda4ad5e7dc6d3ccb8a8e6072dbe0618edec1a0dd497021d37c',
    [null, [{ required: same('廉贞', '天相', '旬空', '截路'), anyOf: intercept }]],
  ]],
  ['1386-001', ['0a130832b652113f781ab9852d8f5fe702f318eaf6570dbafaadb29f7c6f3eed',
    ['子宮坐貴向貴', nobleOpposition],
  ]],
  ['1387-001', ['a24b4d1bccd8b1503b2ef2457050abeb773074bc3088d1bbc015137845d9f536',
    ['子宮化祿生貴子', [localChange('禄')]],
    ['魁鉞一星同居、貴子二人', [{ required: localChange('禄'), anyOf: ['天魁', '天钺'].map(star => same(star)) }]],
  ]],
  ['1388-001', ['7541626ecef20e8fb470536eb99878252d4c4f8c300ebaffb791ce5609775252',
    ['死絕鄉則有子一、子亦貴', [[...at('巳', '太阳'), starChange('太阳', '权'), ...localChange('权'), phase('绝')]]],
  ]],
  ['1390-001', ['8466dda47b7ceca9fff872902289136c3376bc395ff9cbcfde77d7e7471fe20f',
    ['子宮廉貞入火鄉多子向貴', [...'巳午'].map(branch => at(branch, '廉贞'))],
  ]],
  ['1391-001', ['e6c41aad8a6c6ef4a8a5e1e3c24bb3df14defd19764fd9ae2129fbdd9a6090e3',
    [null, [{ required: same('地空', '铃星'), anyOf: outerBenefics }]],
  ]],
  ['1392-001', ['eee9bc84622990a15332528c240550c9ef207654a50625dd11bd2bf98660b0eb',
    [null, [{
      required: [...at('申', '廉贞'), ...sector('紫微', '天府', '天马'), sectorChange(palace, '禄')],
      mustBeAbsent: same('紫微', '天府', '天马'),
      anyOf: external.flatMap(([seat, path]) => [
        [...same('禄存'), relation(seat, path), changeAt(seat, '禄')],
        [...localChange('禄'), ...atRelated(seat, path, '禄存')],
      ]),
    }]],
  ]],
  ['1393-001', ['39113809cd0fd0b3f031ad632792f1fa5c2dbf1f3a23bd717e9c63a17cf9f295',
    ['寅地子宮巨日有七子', [{ required: yinSolarJumen, anyOf: jiElsewhere }]],
    ['而化忌同居則有三四子', [[...yinSolarJumen, ...localChange('忌')]]],
  ]],
  ['1394-001', ['875c16f2208e74f0e0b41af6eb4cc42871bf5e7f8010f12ec8743145042c2afc',
    [null, [[...at('酉', '禄存', '铃星'), phase('养')]]],
  ]],
  ['1395-001', ['5340068739689e5d81e50a8067c954a17b685d08341a94324a78f1005ad37377',
    ['子宮武破、遲得子且傷剋', [same('武曲', '破军')]],
    ['若有科權恩貴同居則貴子一人', [[...same('武曲', '破军', '恩光', '天贵'), ...localChange('科'), ...localChange('权')]]],
  ]],
  ['1396-001', ['e804f920548a7c6a134b926aa3d0deeb0585cdfae06e77a106b802e7d32311f0',
    ['無殺則有六七八人', [{ required: [...same('天同', '文昌'),
      { kind: 'palace_sector_six_malefic_count', palace, count: 0 }], anyOf: jiElsewhere }]],
    ['若忌星同居、則忌乃無子、故僅有三四人', [[...same('天同', '文昌'), ...localChange('忌')]]],
  ]],
  ['1400-001', ['771a148c9a41484e8fbd109c5e19f303e86983959a6cc07b57b22c128ca31511',
    ['子宮卯地貞破擎同居者多剋子', [at('卯', '廉贞', '破军', '擎羊')]],
  ]],
  ['1401-001', ['0a0208df0d7c84c0cc55c4a3d309db4690dd165dae93fc7e7bb7ce09769b6414',
    ['而若羊火七同居或拱合、則多女無男', [[...same('天府'), ...sector('擎羊', '火星', '七杀')]]],
  ]],
  ['1402-001', ['d96013d2d95bd60a3a4ffbbdd13ab4e56499081c67d3c95794ebad70a5f857fe',
    ['子宮天相得坐貴向貴格', nobleOpposition.map(group => [...same('天相'), ...group])],
  ]],
  ['1403-001', ['43962518320f80d941a5bb2058d63518338b9c9194595c02f057c32abb9b6927',
    ['而金生水局人為金生水之格、而破是水星、故有子', [[...at('戌', '破军'), nayin('金'), bureau('水二局')]]],
  ]],
  ['1405-001', ['1af33bc7c165ba4e131f3254b9bfd625c31bec4ee6c9abcc1b70b6c522e8d547',
    [null, [[...same('天相', '地空', '地劫'), bureau('火六局'), phase('绝')]]],
  ]],
  ['1406-001', ['7bb401a5234c1794bef3f172c5622a13238103c4ec5e7d5426c19e98ea589616',
    [null, [outside(['太阳', '太阴'], [mainCount(0), phase('胎')])]],
  ]],
  ['1408-001', ['018117a9ebad4147248802473823f7ee8c6445439b5c900482d47aa93bf984d6',
    [null, flanks('天魁', '天钺')],
  ]],
  ['1409-001', ['81bb04d3ebe6dddb764a279ca0b12d3569c5ef98c0036e822fd5fcfcbd6232ab',
    [null, [[...same('红鸾'), ...localChange('科')]]],
  ]],
  ['1410-001', ['643a8bc7da698a145392d8aa707135a4aeac206d6bcf32a942385420ab6b6ea5',
    ['丑地子宮貪武夾日月、多子且貴', [[...at('丑', '贪狼', '武曲'), ...atRelated('夫妻', 'adjacent', '太阳'),
      ...atRelated('财帛', 'adjacent', '太阴')]]],
  ]],
  ['1411-001', ['781db181cba6af085ee252f25540aa7170c362d44d51ff70dc9513ecc5731ba7',
    ['丑地子宮昌曲同守、化祿居旺遇青龍者、多子而貴', [[...at('丑', '文昌', '文曲'), ...localChange('禄'),
      phase('帝旺'), boshi(palace, '青龙')]]],
  ]],
  ['1412-001', ['09bfdcbeeb7fc83aa6b255b50e9929b35183947254562837f1f725a5611b1ccc',
    [null, [...'丑未'].map(branch => ({
      required: [...at(branch, '紫微', '破军'), ...localChange('权')],
      anyOf: ['紫微', '破军'].map(star => [starChange(star, '权')]),
    }))],
  ]],
]);

export const xingjueChildrenRepeatedPassages = new Map([
  [prefix + '640-001', { id: prefix + '633-001' }],
]);

export function compileXingjueChildren(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [hash, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== hash || passages.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》子息篇的原文、出处或条件有变化，须重新核对。' };
  }
  const branches = passages.map(([text, groups]) => ({
    text, conditionCompiler: xingjueChildrenProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group)),
  }));
  if (!branches[0].text) return { compiler: xingjueChildrenProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》子息篇已核盘式与分句匹配', branches };
}
