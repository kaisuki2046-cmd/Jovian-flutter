import { createHash } from 'node:crypto';
import { earthlyBranches } from './dictionaries.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const guanceluCaseProfile = 'guancelu-documented-natal-case-v1';
export const guanceluCaseNote = '按原书生年干支、农历月日、时支和复核星位对照古籍命例。有性别依据的条目另核性别。';
const prefix = 'ziwei-v1-guancelu-001-p';
const place = (palace, branch, ...stars) => [
  { kind: 'palace_branch', palace, branch },
  ...stars.map(star => ({ kind: 'palace_star', palace, star, scope: 'origin' })),
];
const body = palace => ({ kind: 'palace_confirmed_body_seat', palace });
const relation = (anchor, target, relation) => ({ kind: 'palace_relation', anchor, target, relation });
const noMajors = palace => ({ kind: 'palace_main_count', palace, count: 0 });
const change = (palace, star, change) => ({ kind: 'star_mutagen', palace, star, change, scope: 'origin' });

// Birth data come from the same printed example as the passage. The witness
// positions constrain case retrieval independently of the narrative outcome.
const examples = [
  { birth: ['甲戌', 1, 23, '卯', '男'], base: [
    ...place('命宫', '亥', '天同'), ...place('迁移', '巳', '天梁'), body('迁移'),
    ...place('官禄', '卯', '擎羊'),
  ], records: [
    ['003', '6f1692c697a17b32d91418fbac7b6ba01491b5bf007b21bd3262938ce0662f38'],
    ['120', '06e54e4159dafbacda4bb952bb4ca2d464ff8a0468790f0d05a671773538b375'],
  ] },
  { birth: ['庚子', 3, 14, '子'], base: [...place('命宫', '辰', '太阳'), body('命宫')], records: [
    ['026', '29cc4e7c33043e13f98a5bcdeb29b9438c12f179aac14570d8627d2b70ad754c'],
    ['123', '23fc1fbf4e1690ac472d599dbd0bd2728cdd2da1569a681357674d3dc47d0efe'],
  ] },
  { birth: ['甲申', 5, 13, '未'], base: [...place('命宫', '亥', '紫微', '七杀')], records: [
    ['034', '154a29a22faea114d98c13ea32c3577399ce6a7f060a7e46a9e46499444c4c8a'],
  ] },
  { birth: ['丁亥', 2, 4, '未', '男'], base: [...place('命宫', '申', '天同', '天梁')], records: [
    ['066', 'b48a540b6a203215d9bfcba3789d7ebb442c39f5cdbadee643fe2b7a1362f675'],
    ['172', 'cc1b2a2a2f9cd7c5566ffa672d8007c835bc329809cb6df21f417cd193826114', [
      ...place('迁移', '寅'), ...place('仆役', '丑', '紫微'), ...place('疾厄', '卯', '天府'),
      relation('迁移', '仆役', 'adjacent'), relation('迁移', '疾厄', 'adjacent'),
    ]],
  ] },
  { birth: ['乙未', 5, 13, '申'], base: [
    ...place('命宫', '戌', '天府'), ...place('官禄', '寅', '武曲', '天相'), body('官禄'),
  ], records: [
    ['078', 'bee26d39a229b06a435162a47402575ba27c0eeddcca09a526b8f12e62f9f7cf', [
      ...place('父母', '亥', '太阴'), ...place('仆役', '卯', '太阳', '禄存'),
      ...place('疾厄', '巳', '天马'), relation('父母', '仆役', 'trine'), relation('父母', '疾厄', 'opposite'),
    ]],
  ] },
  { birth: ['辛亥', 12, 10, '巳', '女'], base: [
    ...place('命宫', '申', '陀罗'), noMajors('命宫'), ...place('夫妻', '午', '地空'), body('夫妻'), noMajors('夫妻'),
  ], records: [
    ['084', 'e17b0afc6087b2b13345418418ffdb2ea722cfece5fbfbb0ee747e65490fc1ac', [
      ...place('迁移', '寅', '火星'), ...place('官禄', '子', '咸池', '天姚'), ...place('福德', '戌', '擎羊'),
      relation('命宫', '迁移', 'opposite'), relation('夫妻', '迁移', 'trine'),
      relation('夫妻', '官禄', 'opposite'), relation('夫妻', '福德', 'trine'),
    ]],
    ['189', '7fc9b26d4b10b6765ce93303bd36b2d221546d6e33f03e67c7f744ac2e3ddc2b'],
  ] },
  { birth: ['己未', 3, 1, '戌'], base: [...place('命宫', '午', '紫微', '左辅', '禄存')], records: [
    ['092', '40851ffb6d71316799acb34f36e94dbd98745d632dd72bc590eb585989fd1e25', place('兄弟', '巳', '陀罗', '天马')],
    ['190', 'f2db93765af432f94c9496603870922e340bb7a2d6ac6fe1d8bf78b669c8a0ba', place('迁移', '子', '文昌')],
  ] },
  { birth: ['壬午', 2, 2, '亥'], base: [
    ...place('夫妻', '寅', '武曲', '天相'), body('夫妻'), change('夫妻', '武曲', '忌'),
  ], records: [
    ['094', '5cca66d4a228976fabe93f633c243c3c5be17d757d223040ca46e287970a3d49'],
  ] },
  { birth: ['己未', 11, 15, '酉', '男'], base: [
    ...place('命宫', '卯', '天府'), ...place('迁移', '酉', '武曲', '七杀'), body('迁移'),
    ...place('夫妻', '丑', '紫微', '破军', '文曲'), change('夫妻', '文曲', '忌'),
  ], records: [
    ['114', '67cddede398276cac2e0b408a46b8821c2c62d71f20f489bdc97f6360418ca87'],
    ['196', '0f7c525d47fad3afc11014664eb66e84cbcd55d78d5af394bac3427d1181059b'],
  ] },
  { birth: ['甲午', 2, 27, '戌'], base: [...place('命宫', '巳', '天同'), ...place('官禄', '酉', '天机', '巨门')], records: [
    ['133', '7ccf453cb8d7c9e63301233c8abc61bdbb925e2c32583d22e9e92b18cb35adb5', place('田宅', '申', '贪狼')],
    ['134', 'dc9a39ca912f206c18bf0b4c3daef5173d8a0b6355544d1d27aa3a4b1dbb2a07', [
      ...place('父母', '午', '天府'), ...place('兄弟', '辰', '破军'),
      ...place('仆役', '戌', '紫微', '天相'), relation('兄弟', '仆役', 'opposite'),
    ]],
  ] },
  { birth: ['壬午', 5, 24, '未'], base: [...place('财帛', '未', '紫微', '破军')], records: [
    ['138', '3cab98e082f0cdf88dac45d2ba6091562f35217c2cd8d78f0adfe79c78b185ba'],
  ] },
  { birth: ['己丑', 11, 8, '戌'], base: [
    ...place('子女', '亥', '廉贞', '贪狼'), ...place('财帛', '戌', '太阴', '寡宿'),
    body('财帛'), relation('子女', '财帛', 'adjacent'),
  ], records: [
    ['150', '78f56546ec85961c26893d7045f70ee7e7940a19b70b21f2940f531047b73c5c'],
  ] },
  { birth: ['丁巳', 9, 22, '丑', '女'], base: [
    ...place('命宫', '酉', '文昌', '天姚'), ...place('迁移', '卯', '紫微', '贪狼'),
    relation('命宫', '迁移', 'opposite'), ...place('福德', '亥', '武曲', '破军', '铃星', '天马'), body('福德'),
  ], records: [
    ['158', '7f5775dbdacb4fed005b17170e97ea154cef5137202ccef21c8fd9d6974907fe'],
  ] },
  { birth: ['壬辰', 8, 20, '酉', '男'], base: [...place('命宫', '子', '巨门', '擎羊')], records: [
    ['164', 'a48494b24849aad1837741f6eb7467225e79e2e7720e29e19e90590f36ac92c9', [
      ...place('子女', '酉', '天府', '咸池'), { kind: 'palace_core_star_count', palace: '子女', count: 1 },
      ...place('田宅', '卯', '武曲'), change('田宅', '武曲', '忌'), relation('子女', '田宅', 'opposite'),
    ]],
    ['165', 'dbac8078d180c99d680b0d4164a3df1c636627a8faae876ce6dcd85bc3c8c83f', [
      ...place('兄弟', '亥', '廉贞', '贪狼', '禄存'), ...place('疾厄', '未', '紫微', '破军'),
      change('疾厄', '紫微', '权'), relation('兄弟', '疾厄', 'trine'),
    ]],
  ] },
  { birth: ['己未', 12, 5, '寅', '男'], base: [
    ...place('命宫', '亥', '右弼'), ...place('官禄', '卯', '天府', '左辅'), body('官禄'),
  ], records: [
    ['191', 'd5dc74d71cd652cbe1eb5fce5380d58e8f06bce3ff893010b010b60f2417e27d', place('疾厄', '午', '巨门', '禄存')],
    ['192', '88ac1a7d8261a7da4f13a8004201ca9b239c9a6e04f8fed18af5a4693f1b6fa8', place('父母', '子', '天机')],
    ['193', '08a72a458dd886cb0b0da67dd94b511133a644262e31aa5c85bd739a99b417ee', place('父母', '子', '天姚', '咸池')],
    ['194', '9dcf00b6300a6c05833a09dfd725aa74f5583d9ef328e2a5d5959ca79876f8da', [...place('疾厄', '午', '文曲'), change('疾厄', '文曲', '忌')]],
  ] },
];

const birthKinds = ['ziwei_daozang_input', 'natal_year_stem', 'natal_year_branch',
  'natal_lunar_month', 'natal_ziwei_hour', 'natal_gender'];

const reviewed = new Map(examples.flatMap(({ birth: [[stem, yearBranch], month, day, branch, gender], base, records }) => {
  const birthFacts = [
    { kind: 'ziwei_daozang_input', yearBranch, month, day, hour: earthlyBranches.indexOf(branch), leap: false },
    { kind: 'natal_year_stem', stem }, { kind: 'natal_year_branch', branch: yearBranch },
    { kind: 'natal_lunar_month', month, leap: false }, { kind: 'natal_ziwei_hour', branch },
    ...(gender ? [{ kind: 'natal_gender', gender }] : []),
    { kind: 'ziwei_confirmed_natal_layout' },
  ];
  return records.map(([id, hash, facts = []]) => [prefix + id + '-001', { hash, required: [...birthFacts, ...base, ...facts] }]);
}));

export function compileGuanceluHistoricalCase(claim) {
  const spec = reviewed.get(claim.id);
  if (!spec) return undefined;
  const { source, conditions, evidence } = claim;
  const hash = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (hash !== spec.hash) {
    return { reason: 'source_review_required', reviewNote: '《斗数观测录》命例的出处、生辰条件或引文已变，须重新核对。' };
  }
  return { compiler: guanceluCaseProfile, inputs: [normalizeRuleInput('ziwei', { required: spec.required })] };
}

export function supportsGuanceluCaseLookup(chart) {
  if (chart.scope !== 'natal') return false;
  const fields = birthKinds.map(kind => chart.present.filter(fact => fact.kind === kind));
  if (fields.some(items => items.length !== 1)) return false;
  const [[input], , [year], [month], [hour]] = fields;
  return input.yearBranch === year.branch && input.month === month.month
    && input.leap === month.leap && earthlyBranches[input.hour] === hour.branch;
}
