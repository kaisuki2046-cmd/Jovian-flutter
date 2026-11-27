import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueParentsProfile = 'ziwei-xingjue-parents-v1';
const prefix = 'ziwei-v3-xingjue-058-p';
const palace = '父母';
const scope = 'origin';
const starAt = (seat, star) => ({ kind: 'palace_star', palace: seat, star, scope });
const same = (...stars) => stars.map(star => starAt(palace, star));
const at = (branch, ...stars) => [{ kind: 'palace_branch', palace, branch }, ...same(...stars)];
const majorCount = count => ({ kind: 'palace_main_count', palace, count });
const coreCount = count => ({ kind: 'palace_core_star_count', palace, count });
const phase = value => ({ kind: 'palace_changsheng_phase', palace, phase: value });
const suiqian = star => ({ kind: 'palace_suiqian_star', palace, star });
const localChange = change => [
  { kind: 'palace_mutagen', palace, change, scope }, { kind: 'palace_sector_mutagen', palace, change },
];
const related = (seat, relation, ...stars) => [{ kind: 'palace_relation', anchor: palace, target: seat, relation },
  ...stars.map(star => starAt(seat, star))];
const neighbor = (seat, ...stars) => related(seat, 'adjacent', ...stars);
const external = [['疾厄', 'opposite'], ['子女', 'trine'], ['仆役', 'trine']];
const luminance = (seat, star, brightness) => ({ kind: 'palace_brightness', palace: seat, star, scope, brightness });
const litFrom = star => external.flatMap(([seat, relation]) => ['庙', '旺'].map(brightness => [
  ...related(seat, relation, star), luminance(seat, star, brightness),
]));
const illuminatedLuminaries = litFrom('太阳').flatMap(sun => litFrom('太阴').map(moon => [...sun, ...moon]));

// Qing manuscript, pp. 187–190. A fragment keeps its source antecedents
// even where a later qualification in the same passage is unresolved.
const reviewed = new Map([
  ['773-001', ['06dd1327deee8c527add8500a1ccf64c9b69c65643ce59a86e6f4a9083879672',
    ['天梁單守父母宮', [[...same('天梁'), majorCount(1)]]],
  ]],
  ['774-001', ['7d739a3fae137c6bd1f3802c5e9d34381715acfff42b7b293949b35172494373',
    ['父母宮亥地文曲單守', [[...at('亥', '文曲'), majorCount(0), coreCount(1)]]],
  ]],
  ['817-001', ['3091c55d5753b9b12e67e5f24ec2c25dfe84be4b0e7ba2878acc1aa617372320',
    ['天相單守宮', [[...same('天相'), majorCount(1)]]],
  ]],
  ['818-001', ['0ef79add1fc8c60e3d60f150e980347b16c7c17b45e31c39abfc20123dca92f3',
    ['孤辰同居則先剋父', [[...same('天梁', '孤辰'), majorCount(1), phase('绝')]]],
  ]],
  ['820-001', ['cbf1a5f498787d1b80133f887751be13c8fc71299db9eb3d6b0b7b4b205db256',
    [null, [same('地空', '地劫')]],
  ]],
  ['822-001', ['657345d05e80ba8a88ef03916af1c9486c67dea0b06c5b3f4716575101a5316d',
    [null, [same('天同', '巨门')]],
  ]],
  ['823-001', ['7b865435c60df526da444ca2b1ef6645495b6939a1f9ff46124ee5e318062438',
    ['巳地父母宮天府', [at('巳', '天府')]],
  ]],
  ['824-001', ['430eafe5afda3d1162ec07f5c9c238d51acd13031986bd4e5c16e92a4c8d0ec2',
    [null, [[...same('地劫'), suiqian('白虎')]]],
  ]],
  ['825-001', ['8c08179fac799b96ddfc3e7286a3757224b619504fc162081abd5d11f2ed4d90',
    [null, [{ required: same('天梁'), anyOf: illuminatedLuminaries }]],
  ]],
  ['826-001', ['5940d87930345ac21efa61da2af26c84d94f04bc9d48dde9454c5550fd6564b2',
    [null, [['左辅', '右弼'], ['右弼', '左辅']].map(([sunSide, moonSide]) => [
      ...same('贪狼', '武曲'), phase('养'), ...neighbor('福德', '太阳', sunSide),
      ...neighbor('命宫', '太阴', moonSide),
    ])],
  ]],
  ['1638-001', ['75e9016802d90866cf3fc1d53754a42a234fa36d0e6a7eb456ab2f94fd0d1681',
    ['未地父母宮地空陀羅、若不落旬路空、則反不克親', [{
      required: at('未', '地空', '陀罗'), mustBeAbsent: same('旬空', '截路'),
    }]],
  ]],
  ['1639-001', ['02312bc54414244ea4d122b34902ce21c14398529ab2c30f6719e1c514c8c224',
    ['文昌單守宮', [[...same('文昌'), majorCount(0), coreCount(1)]]],
  ]],
  ['1640-001', ['3e1bb602da24badbb4fcf885d8a6e1f57aaa1ab83702cb787813a70ff267e855',
    [null, [at('卯', '擎羊', '红鸾')]],
  ]],
  ['1641-001', ['746cc4d725412078b95bdb8056f96e32690d90c7c7dfb8061f28494f824fcc8e',
    ['雖有紫微破刧姚同居、早剋', [same('紫微', '破军', '地劫', '天姚')]],
  ]],
  ['1643-001', ['60a5fb3bcd7cad97811b9fcec25ee4ebebc9367821bd88b48a2bda24f9eb6896',
    ['紫府同居者亦榮養', [same('紫微', '天府')]],
  ]],
  ['1644-001', ['1add0845bbcec7430de616846b992f1a081ea2e8043db11518d45fa822c39f60',
    ['父母寅地七殺長生者、父母享壽', [[...at('寅', '七杀'), phase('长生')]]],
  ]],
  ['1646-001', ['e46f989ff67a621e2acec63dd2634494d51818039f92df4eb309286897706440',
    [null, [at('寅', '破军', '文昌')]],
  ]],
  ['1647-001', ['50141f358348fc83caba360ac4130692b828761605cb95722235653b8829dc7c',
    ['加值羊刃同居則先剋父', [at('卯', '紫微', '贪狼', '擎羊')]],
  ]],
  ['1648-001', ['6751936b002df39f68af4b9b764df4eace7d7744008837dcaf0ed707d4de2f94',
    ['父母宮戌地破曲', [at('戌', '破军', '文曲')]],
  ]],
  ['1649-001', ['ec059d88b918a923d62fcb4e10fc49b6e241120f7e62fcdc9339a539bec8c6f1',
    [null, [at('巳', '天梁', '陀罗', '火星', '天马')]],
  ]],
  ['1650-001', ['f11d0d4df58ac31c932bd6a032adf91a470091683fad17aa3f760e3cf8829622',
    ['父母宮巳地巨門雖坐生鄉', [[...at('巳', '巨门'), phase('长生')]]],
  ]],
  ['1652-001', ['c0807f41533673297a09d5ed01ac4ef21c183720e6fb2fc8ae9192362f6ac40d',
    [null, [[...neighbor('福德', '地空', '火星'), ...neighbor('命宫', '地劫', '七杀')],
      [...neighbor('命宫', '地空', '火星'), ...neighbor('福德', '地劫', '七杀')]]],
  ]],
  ['1653-001', ['824293a7675f715c21c830450df8cf323bd257bde0de6897c45204d4d6c3c4d8',
    [null, [[...same('天魁'), phase('死')]]],
  ]],
  ['1654-001', ['2b6aff08966e23ca070dd7e64b02b71dfe3d955d81c4138e0f57f69bcc6a9cae',
    [null, [[...at('卯', '擎羊'), majorCount(0), coreCount(1)]]],
  ]],
  ['1659-001', ['388620fee1bec138e8e85af58e82a952b20da62013bc307d0428f4db6effa5ba',
    [null, [...'巳亥'].map(branch => ({
      required: at(branch, '廉贞', '贪狼'), anyOf: [same('禄存'), localChange('禄')],
    }))],
  ]],
]);

export function compileXingjueParents(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [hash, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== hash || passages.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》父母篇的原文、出处或条件有变化，须重新核对。' };
  }
  const branches = passages.map(([text, groups]) => ({
    text, conditionCompiler: xingjueParentsProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group)),
  }));
  if (!branches[0].text) return { compiler: xingjueParentsProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》父母篇已核盘式与分句匹配', branches };
}
