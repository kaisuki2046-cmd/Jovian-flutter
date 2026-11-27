import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueSiblingsProfile = 'ziwei-xingjue-siblings-v1';
const prefix = 'ziwei-v3-xingjue-048-p';
const palace = '兄弟';
const scope = 'origin';
const starAt = (seat, star) => ({ kind: 'palace_star', palace: seat, star, scope });
const same = (...stars) => stars.map(star => starAt(palace, star));
const at = (branch, ...stars) => [{ kind: 'palace_branch', palace, branch }, ...same(...stars)];
const majorCount = count => ({ kind: 'palace_main_count', palace, count });
const coreCount = count => ({ kind: 'palace_core_star_count', palace, count });
const changeAt = (seat, change) => ({ kind: 'palace_mutagen', palace: seat, change, scope });
const sectorChange = change => ({ kind: 'palace_sector_mutagen', palace, change });
const localChange = change => [changeAt(palace, change), sectorChange(change)];
const starChange = (star, change) => ({ kind: 'star_mutagen', palace, star, change, scope });
const sector = (...stars) => stars.map(star => ({ kind: 'palace_sector_star', palace, star }));
const brightness = (star, value) => ({ kind: 'palace_brightness', palace, star, scope, brightness: value });
const related = (seat, relation, ...stars) => [{ kind: 'palace_relation', anchor: palace, target: seat, relation },
  ...stars.map(star => starAt(seat, star))];
const neighbor = (seat, ...stars) => related(seat, 'adjacent', ...stars);
const external = [['仆役', 'opposite'], ['田宅', 'trine'], ['疾厄', 'trine']];
const outsideTogether = (...stars) => external.map(([seat, relation]) => related(seat, relation, ...stars));
const outwardLuAndQuan = external.flatMap(([luSeat, luRelation]) => external.map(([quanSeat, quanRelation]) => [
  ...related(luSeat, luRelation), changeAt(luSeat, '禄'),
  ...related(quanSeat, quanRelation), changeAt(quanSeat, '权'),
]));
const maoJumen = at('卯', '巨门', '天机');

// Qing manuscript, pp. 146–148. Only verified natal conditions may
// supply source passages to the report.
const reviewed = new Map([
  ['593-001', ['fb112dae53ca41d82d8eacf1c3086c7648f499084d41d9693e809e7a16cbea52',
    [null, [{ required: same('贪狼'), anyOf: [same('禄存'), localChange('禄')] }]],
  ]],
  ['594-001', ['d6c123f6e008fb41451c31e7a62de79cf743fb1cb9822bf0ab1f39ce21e2e9a4',
    [null, [{ required: same('文昌', '文曲'), mustBeAbsent: same('陀罗') }]],
  ]],
  ['596-001', ['e3fd18b4ee5f3e2b3d02b635067086bffbd8bfadb0eac8ef49ec0d9a244040ea',
    ['於兄弟宮遇之而化祿、則兄弟相愛', [[...at('子', '天机'), starChange('天机', '禄'), ...localChange('禄')]]],
  ]],
  ['597-001', ['558d095c226a572b8ce31b20bb4067a5cd2a35943b02bd9065c594d8c3ac9a28',
    [null, [at('酉', '擎羊', '地劫')]],
  ]],
  ['599-001', ['a17ffd4e5a7ce21e41292ea126c0cd14748f88b6d6378adb4cb3ed6197be0178',
    ['兄弟午地太陽主有三人、必有貴者二人', [at('午', '太阳')]],
  ]],
  ['601-001', ['0fe2cd5c15d9e4cab5947ef60009ddf6b2810116ccfae8e5c197a28928ca1f2a',
    [null, [same('紫微', '贪狼', '天钺')]],
  ]],
  ['603-001', ['a17940c933f46adecd3a75d13036a7a0d6f68ba6641f22f226fcdfe68a84301c',
    [null, outsideTogether('武曲', '七杀')],
  ]],
  ['604-001', ['22ee66826fcfb95f4e97e61f4cc7210dedf0ed910c3de7194f9093b189cb04e2',
    [null, [same('巨门', '擎羊')]],
  ]],
  ['605-001', ['de6a6bfffdfcb450fdfeb122a1d5d2514dcd11350dc65cae2a69ebc1226b78b1',
    [null, [[...same('擎羊'), ...localChange('忌'), ...sector('太阳', '太阴', '文昌', '文曲')]]],
  ]],
  ['606-001', ['12e9918cc44bea0fa281b515e7fa9c9441cc7965136bc1ec1ec71e1993bed64f',
    [null, [[...same('天同', '地劫'), brightness('天同', '陷')]]],
  ]],
  ['1315-001', ['3ef8e5933db5f7483817c46d396373e3a325c672afd75c2eaa693741ea8b3ed4',
    ['兄弟宮卯上巨機、和睦', [maoJumen]],
    ['得化祿龍池尤相愛', [[...maoJumen, ...same('龙池'), ...localChange('禄')]]],
  ]],
  ['1316-001', ['00565a63c12a17a6c035d0bc1749940219e53110af0e3bc5143fa4e6c3c141bc',
    [null, [{
      required: same('巨门'),
      anyOf: ['庙', '旺', '得'].flatMap(value => ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存']
        .map(star => [brightness('巨门', value), ...same(star)])),
    }]],
  ]],
  ['1318-001', ['d0303539985d7adc404222e0d7baed0a4d8370ba4e6eb42acaeaa91b4b27d787',
    ['丑宮貞七陀姚齊聚於兄弟宮者無兄弟', [at('丑', '廉贞', '七杀', '陀罗', '天姚')]],
  ]],
  ['1319-001', ['8383d9393a18994c4e322ddab7bfe5a738624cd818191194635fe38adad69eec',
    [null, [[...at('子', '地劫'), majorCount(0), coreCount(1)]]],
  ]],
  ['1321-001', ['09378ff95db928be785eecf354ccb248da7243db7776213ba6fef0ecd0bccc34',
    [null, [{ required: [...same('贪狼', '武曲'), ...neighbor('命宫', '太阳'), ...neighbor('夫妻', '太阴')],
      anyOf: [['天魁', '天钺'], ['天钺', '天魁']].map(([here, there]) => [
        ...same(here), ...related('仆役', 'opposite', there),
      ]) }]],
  ]],
  ['1322-001', ['0d64f52cb6d4731a74fde71695d38f5ab9b333283a30e97bd06e560342ed59d7',
    ['兄弟宮天同主五人', [{ required: same('天同'), mustBeAbsent: same('陀罗') }]],
    ['陀羅同位尅、二人', [same('天同', '陀罗')]],
  ]],
  ['1323-001', ['e85be46de726c7186b5dd63480e8f44ba24765e30718080748132657a0cf5196',
    [null, [at('酉', '巨门', '天机')]],
  ]],
  ['1325-001', ['adf31d5f1bba7d21c699b7f6c66b9eda451b4f30b0177f4b330848e9098b36fb',
    [null, [{
      required: [...same('文昌', '文曲'), ...sector('天府', '天相'), sectorChange('禄'), sectorChange('权')],
      mustBeAbsent: same('天府', '天相'),
      anyOf: outwardLuAndQuan,
    }]],
  ]],
  ['1326-001', ['f5d07c7c5a615274463c18e9a8318012b2ee86859fa9a12854bfc24e4d4e62de',
    ['辰戌宮兄弟、機星坐守、姊妹昆弟二三人', [...'辰戌'].map(branch => at(branch, '天机'))],
    ['若三奇中一星同居、則有貴者二人', [...'辰戌'].map(branch => ({
      required: at(branch, '天机'), anyOf: [...'禄权科'].map(localChange),
    }))],
  ]],
  ['1327-001', ['b67f862b3c2d1cc18150a4836015729a089f412ac9c63d4a0e1a6e2a86ae80f5',
    [null, [...'辰戌'].map(branch => at(branch, '破军'))],
  ]],
  ['1328-001', ['e62bf8528f005029de1cc180dd2b1b133d6d569be4848aed37cfd1844f1477f5',
    [null, [same('天机', '禄存')]],
  ]],
  ['1329-001', ['38706ff7faea7d077c821ba09321c74dffb3c9d84d96f41a77c72180bce7f1a3',
    ['兄弟宮雖有文曲魁星、若與貞破同宮', [same('文曲', '天魁', '廉贞', '破军')]],
  ]],
  ['1330-001', ['3a975cf82d52400895ef2659ae847c6be70de1bbed2bd0f677588f52a6735f96',
    [null, [same('武曲', '七杀', '火星')]],
  ]],
  ['1331-001', ['d5daca7244e8580462d098bdf3d6ca55d9e6f6635b656f32cb5e3730cc64482e',
    ['兄弟宮貪羊鈴不美', [same('贪狼', '擎羊', '铃星')]],
    ['雖化祿、未免不和傷尅之災', [[...same('贪狼', '擎羊', '铃星'), ...localChange('禄')]]],
  ]],
  ['1333-001', ['bda8a0abf113babf61fbdee4ddf5e57117e61b939bb26fe04321c365f60902ce',
    [null, [at('寅', '天机', '太阴', '铃星')]],
  ]],
  ['1334-001', ['9a8f88ecf3d0851947d8c8a49d1d09c015e8118451259f15ed1a5299e4bcc521',
    [null, [{
      required: [...at('寅', '武曲', '天相', '禄存', '天马'), ...sector('紫微', '天府'), sectorChange('禄'), sectorChange('权')],
      mustBeAbsent: same('紫微', '天府'),
      anyOf: outwardLuAndQuan,
    }]],
  ]],
  ['1335-001', ['763472078705ab7049cd82fa8342e731163191e7ce6ce6e225dae2ca3ba42687',
    ['兄弟天相巳亥地、主有五人', [...'巳亥'].map(branch => at(branch, '天相'))],
    ['兼有魁鉞會照者、有貴兄弟', [...'巳亥'].map(branch => ({
      required: [...at(branch, '天相'), ...sector('天魁', '天钺')], mustBeAbsent: same('天魁', '天钺'),
    }))],
    ['卯酉宮則三人', [...'卯酉'].map(branch => at(branch, '天相'))],
  ]],
  ['1337-001', ['9fb83cb16420247a91fe1e462632d32612df4bde146e61784bc7d1d348460b6d',
    [null, [...'丑未'].map(branch => at(branch, '紫微', '龙池', '凤阁'))],
  ]],
  ['1338-001', ['ec4294b7c58e4f00d8992112e6dc01004c3bd3c39a5e96b3755d293ca871cbac',
    [null, [same('巨门', '地劫')]],
  ]],
]);

export function compileXingjueSiblings(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [hash, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== hash || passages.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》兄弟篇的原文、出处或条件有变化，须重新核对。' };
  }
  const branches = passages.map(([text, groups]) => ({
    text, conditionCompiler: xingjueSiblingsProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group)),
  }));
  if (!branches[0].text) return { compiler: xingjueSiblingsProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》兄弟篇已核盘式与分句匹配', branches };
}
