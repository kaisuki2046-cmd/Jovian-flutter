import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const ziweiGusuiProfile = 'ziwei-gusui-annotation-v1';
const prefix = 'ziwei-v3-jielan-123-p001-';
const life = '命宫';
const scope = 'origin';
const stemAt = stem => ({ kind: 'natal_year_stem', stem });
const hourAt = branch => ({ kind: 'natal_ziwei_hour', branch });
const station = (palace, branch, ...stars) => [
  ...(branch ? [{ kind: 'palace_branch', palace, branch }] : []),
  ...stars.map(star => ({ kind: 'palace_star', palace, star, scope })),
];
const natal = (branch, ...stars) => station(life, branch, ...stars);
const linked = (target, relation, branch, ...stars) => [
  ...station(target, branch, ...stars), { kind: 'palace_relation', anchor: life, target, relation },
];
const opposite = (branch, ...stars) => linked('迁移', 'opposite', branch, ...stars);
const brightnessAt = (star, brightness) => ({ kind: 'palace_brightness', palace: life, star, scope, brightness });
const mutagenAt = (palace, star, change) => ({ kind: 'star_mutagen', palace, star, change, scope });
const sector = (...stars) => stars.map(star => ({ kind: 'palace_sector_star', palace: life, star }));
const lunarGroup = (branch, sunPalace, sunBranch, moonPalace, moonBranch) => [
  ...natal(branch), ...linked(sunPalace, 'trine', sunBranch, '太阳'), ...linked(moonPalace, 'trine', moonBranch, '太阴'),
];
const passage = (text, ...groups) => ({ text, groups });
const full = (...groups) => passage(undefined, ...groups);

const reviewed = new Map([
  [18, ['6e40907ac25004ecd403bb2e5ca01d627e621e0f959ef095f29b0c11f2e75815', full(
    ...[...'寅申'].map(branch => [...natal(branch, '紫微', '天府'), ...sector('左辅', '右弼', '天魁', '天钺')]),
  )]],
  [22, ['1174882fb5431af66ff16a247b979d4f1b7d1cede06bbc112ddab53571fb1d8d',
    passage('如命安丑宫，日月在未，安命未宫，日月在丑，谓之同临是也。', ...['丑未', '未丑'].map(([anchor, other]) => [
      ...natal(anchor), ...opposite(other, '太阳', '太阴'),
    ])),
    passage('秘云：日月同临论对宫，丙辛人遇福兴隆。', ...['丑未', '未丑'].flatMap(([anchor, other]) => [...'丙辛'].map(stem => [
      stemAt(stem), ...natal(anchor), ...opposite(other, '太阳', '太阴'),
    ]))),
  ]],
  [23, ['22ee0b68a35a2664fefa26cf8fbae940e86aff6249e623880d331523918b573a',
    passage('如丙生人次之', [stemAt('丙'), ...natal('卯', '巨门', '天机')]),
    passage('丁生人亦主平常', [stemAt('丁'), ...natal('卯', '巨门', '天机')]),
  ]],
  [29, ['480211453b4923b67c11cabbbd0406a3f72709304028d28a5d3e7acce1df054a',
    passage('如巳有日守垣，亥有巨者，上格。', [...natal('巳', '太阳'), ...opposite('亥', '巨门')]),
    passage('巳有巨者，下格。', [...natal('巳', '巨门'), ...opposite('亥', '太阳')]),
  ]],
  [31, ['53f67d82bb47e2793bbbb5312eb61ca5829e890c7f74380418f08286c6f45670',
    passage('丑宫安命，日巳月酉来朝，为并明', lunarGroup('丑', '官禄', '巳', '财帛', '酉')),
  ]],
  [32, ['55b2073bedb12e2caca680a5118acb6cffb2b1ad93abca29521926d7f267a1ac',
    passage('未宫安命，日卯月亥来朝，为明珠出海，定主财官双美。', lunarGroup('未', '财帛', '卯', '官禄', '亥')),
    passage('如辰日守命，戌月对照，戌月守命，辰日对照，亦主极贵。', [...natal('辰', '太阳'), ...opposite('戌', '太阴')],
      [...natal('戌', '太阴'), ...opposite('辰', '太阳')]),
  ]],
  [39, ['b9803bc89d41184b4c4c88de62fe5f01e71ce2efff7cb7f4ae0f055f95fc5cf0',
    passage('如酉安命，丑府巳相来朝，亦贵。', [
      ...natal('酉'), ...linked('官禄', 'trine', '丑', '天府'), ...linked('财帛', 'trine', '巳', '天相'),
    ]),
  ]],
  [40, ['552001554eb891fd7a6abba4e8b0ed018839562baf8581d62a0ae9995673d389',
    ...[['丁', '丁生人上格'], ['己', '己生人次之'], ['癸', '癸生人主富，又次也']].map(([stem, text]) =>
      passage(text, [stemAt(stem), ...natal('午', '天梁')])),
  ]],
  [41, ['81e5dd9193f2a30a1a7342efb7db71e688ead105f5434b5e51c96c41b3c78ffe',
    passage('午宫安命，二星同宫坐守，上格', natal('午', '天梁', '文曲')),
    passage('寅宫次之', natal('寅', '天梁', '文曲')),
    passage('或梁在午，曲在子拱冲者，亦官至二品。', [...natal('午', '天梁'), ...opposite('子', '文曲')]),
  ]],
  [42, ['588a31abe12084476f6d8aad36f2f899747db75071d5eced5f9c4685a14735a5', full([
    ...natal('戌', '擎羊', '火星'), brightnessAt('擎羊', '庙'), brightnessAt('火星', '庙'),
  ])]],
  [44, ['bce9bb28f8442c2248d65b4c40666f45e11cd47c0e3474d9cf216721e32e12d8', full([
    ...natal('申', '廉贞'), brightnessAt('廉贞', '庙'), { kind: 'palace_boshi_star', palace: life, star: '将军' },
  ])]],
  [46, ['c0f3b148220453ef60c92ec15f786cfb8f4cfb2557c2b111c24817abcdef3473',
    passage('辰戌二宫安命，值巨门失陷，主人作事颠置', ...[...'辰戌'].map(branch => [
      ...natal(branch, '巨门'), brightnessAt('巨门', '陷'),
    ])),
  ]],
  [49, ['94ab88bf9176c11aadf3f683603a14895efc607e32920c5b1288f72324cb2315',
    passage('禄存化禄及天马同守命宫是也', ...[['甲', '寅', '廉贞'], ['庚', '申', '太阳']].map(([stem, branch, star]) => [
      stemAt(stem), ...natal(branch, '禄存', '天马', star), mutagenAt(life, star, '禄'),
    ])),
  ]],
  [66, ['2884f45bc7ed590d54ab3e7e90d521bb830be3b04d8fa4f535368272af645683',
    passage('如甲生人，立命寅宫，甲禄到寅守命，亦作禄朝垣格。又如庚在申，乙在卯，辛在酉，此四位禄守命宫',
      ...['甲寅', '庚申', '乙卯', '辛酉'].map(([stem, branch]) => [stemAt(stem), ...natal(branch, '禄存')])),
  ]],
  [93, ['7eb090134f5733c921f67d5db012a49f8dadc641164661fd159c470a3c0beee8', {
    // Reversing this order would place 地空 in Life at both feasible hours (辰、戌).
    ...full([...linked('兄弟', 'adjacent', null, '文曲'), ...linked('父母', 'adjacent', null, '文昌')]),
    mustBeAbsent: natal(null, '地空', '地劫', '擎羊', '铃星'),
  }]],
  [100, ['59d6afc0445d952993b263c4dcc094a4f830e998149179f73bf3f5d227b124f6',
    passage('如身命自未至子遇太阴，必主富贵', ...[...'未申酉戌亥子'].flatMap(branch => [
      natal(branch, '太阴'), ...['夫妻', '财帛', '迁移', '官禄', '福德'].map(palace => [
        { kind: 'body_palace', palace }, ...station(palace, branch, '太阴'),
      ]),
    ])),
  ]],
  [101, ['225f51371a9f8b0aa875c2246e0aa6c7bcec8c9b4a06950a65546d2370216f85', full(
    // The two stars can share a palace only at 子 or 午 hour. In both hours the Body sits in Life.
    ...[life, '财帛', '福德'].map(palace => station(palace, null, '地空', '地劫')),
  )]],
  [103, ['858a233bff0efa04624a242caa89efd5ab406cd93824e39002cb6da87a6cbef6', full(
    ...[...'丑未'].map(branch => natal(branch, '武曲', '贪狼')),
  )]],
  [106, ['2032752094405ae85c3135bf617e539e55d0650cf56ef2466985a2137abfee00', full(natal(null, '左辅', '右弼'))]],
  [108, ['a569dc49a68c29102514b7ab44904d2e8fe49ea622c0bcf244831fb1d02edd7b', full([
    stemAt('甲'), ...natal('亥', '武曲'), mutagenAt(life, '武曲', '科'), ...station('田宅', '寅', '禄存'),
  ])]],
  [113, ['1f37c0150e9a1575deb98f45b117c4bed9a9b0b69d0cc61254140527503e3efe',
    passage('辰戌丑未安命，二星坐守是也。', ...[...'丑未'].map(branch => natal(branch, '左辅', '右弼'))),
    passage('或迁移、官禄、财帛三宫遇之，亦主终身福寿。', ...['迁移', '官禄', '财帛'].map(palace =>
      station(palace, null, '左辅', '右弼'))),
  ]],
  [119, ['3876dced975a11bbb15031b7b6c23402441bcb223d604a88e1bac359e5dbd314',
    passage('如命在亥，子时生人，命在巳，午时生人是也。', ...['亥子', '巳午'].map(([branch, hour]) => [
      hourAt(hour), ...natal(branch, '地空'),
    ])),
  ]],
  [124, ['3ce7ab7dbf96eca72ef52efba69913f508165773b89a684d73a16d5cdbf1a800', full([
    stemAt('甲'), ...natal('亥', '廉贞'), mutagenAt(life, '廉贞', '禄'), ...station('田宅', '寅', '禄存'),
  ])]],
]);

export function compileZiweiGusuiSources(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(Number(claim.id.slice(prefix.length)));
  if (!spec) return undefined;
  const [hash, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== hash) return { reason: 'source_review_required', reviewNote: '《斗数骨髓赋注解》原文、出处或条件已变，须重新核对。' };
  const branches = passages.map(({ text, groups, mustBeAbsent }) => ({
    text, conditionCompiler: ziweiGusuiProfile, inputs: groups.map(required => normalizeRuleInput('ziwei', { required, mustBeAbsent })),
  }));
  if (!branches[0].text) return { compiler: ziweiGusuiProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '按《斗数骨髓赋注解》已核分句匹配', branches };
}
