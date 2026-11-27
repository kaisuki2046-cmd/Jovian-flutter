import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueLifeBodyProfile = 'ziwei-xingjue-life-body-v1';
const prefix = 'ziwei-v3-xingjue-047-p';
const life = '命宫';
const scope = 'origin';
const seats = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
const bodySeats = ['命宫', '夫妻', '财帛', '迁移', '官禄', '福德'];
const starAt = (palace, star) => ({ kind: 'palace_star', palace, star, scope });
const same = (palace, ...stars) => stars.map(star => starAt(palace, star));
const sector = (palace, ...stars) => stars.map(star => ({ kind: 'palace_sector_star', palace, star }));
const branchAt = (palace, branch) => ({ kind: 'palace_branch', palace, branch });
const at = (palace, branch, ...stars) => [branchAt(palace, branch), ...same(palace, ...stars)];
const body = palace => ({ kind: 'palace_confirmed_body_seat', palace });
const phase = (palace, phase) => ({ kind: 'palace_changsheng_phase', palace, phase });
const count = (palace, count) => ({ kind: 'palace_main_count', palace, count });
const bureau = bureau => ({ kind: 'natal_ziwei_bureau', bureau });
const nayin = element => ({ kind: 'natal_year_nayin_element', element });
const starChange = (palace, star, change) => ({ kind: 'star_mutagen', palace, star, change, scope });
const localChange = (palace, change) => [
  { kind: 'palace_mutagen', palace, change, scope }, { kind: 'palace_sector_mutagen', palace, change },
];
const atRelated = (anchor, target, relation, ...stars) => [
  { kind: 'palace_relation', anchor, target, relation }, ...same(target, ...stars),
];
const outward = [['迁移', 'opposite'], ['财帛', 'trine'], ['官禄', 'trine']];
const benevolent = '左辅 右弼 文昌 文曲 天魁 天钺 禄存'.split(' ');
const outwardBenefics = outward.flatMap(([seat, relation]) => benevolent.map(star => atRelated(life, seat, relation, star)));
const intercept = [...'甲乙丙丁戊己庚辛壬癸'].map((stem, i) => [
  { kind: 'natal_year_stem', stem }, branchAt(life, '申午辰寅子'[i % 5]),
]);
const otherBodySeats = bodySeats.filter(seat => seat !== life);
const atLifeOrBody = (pattern, additionalSeats = otherBodySeats) => [
  pattern(life),
  ...additionalSeats.map(seat => [body(seat), ...pattern(seat)]),
];
const atBody = (pattern, possibleSeats = bodySeats) => possibleSeats.map(seat => [body(seat), ...pattern(seat)]);
const atLifeOrBodyPhases = (phases, without = []) => [
  ...phases.map(value => ({ required: [phase(life, value)], mustBeAbsent: same(life, ...without) })),
  ...otherBodySeats.map(seat => ({
    required: [body(seat)], mustBeAbsent: same(seat, ...without),
    anyOf: phases.map(value => [phase(seat, value)]),
  })),
];
const flanks = (seat, a, b) => {
  const index = seats.indexOf(seat);
  const left = seats[(index + 11) % 12], right = seats[(index + 1) % 12];
  return [[...atRelated(seat, left, 'adjacent', a), ...atRelated(seat, right, 'adjacent', b)],
    [...atRelated(seat, left, 'adjacent', b), ...atRelated(seat, right, 'adjacent', a)]];
};
const lifeSectorWithZuoYou = [life, '财帛', '官禄'];

const litFromOutside = (seat, stars) => ({ required: sector(seat, '太阳', '太阴', ...stars), mustBeAbsent: same(seat, '太阳', '太阴') });
const withOutsideLuminaries = stars => [
  litFromOutside(life, stars),
  ...bodySeats.filter(seat => seat !== life).map(seat => {
    const input = litFromOutside(seat, stars);
    return { ...input, required: [body(seat), ...input.required] };
  }),
];

// Qing manuscript, pp. 141–146. Palace evidence for a body clause stays
// attached to its confirmed physical seat throughout matching.
const reviewed = new Map([
  ['574-001', ['8c027f99f524adff1f20f29c6a912586795fa483e549c83e3ff4dc5362853d0a',
    [null, atLifeOrBody(seat => sector(seat, '紫微', '天府', '左辅', '右弼', '三台', '八座', '台辅'), ['财帛', '官禄'])],
  ]],
  ['575-001', ['37321bfd9ff95d8265f2833ce3402537dd2d8213637b698e7517f2c4371e8bc4',
    [null, withOutsideLuminaries(['龙池', '凤阁', '天才'])],
  ]],
  ['576-001', ['03caf6413ba291e7e3f022a1ba9df62f4e23efb97d64d1a0e45799601fc1ce7a',
    [null, [same(life, '地空', '地劫')]],
  ]],
  ['577-001', ['6d35e70a8a6b08fd3a2c453434cb05da430f5e83a64457fe81b647755e978525',
    [null, [{
      required: sector(life, '擎羊', '陀罗', '地空', '地劫'),
      mustBeAbsent: same(life, '擎羊', '陀罗', '地空', '地劫'),
      anyOf: benevolent.map(star => same(life, star)),
    }]],
  ]],
  ['578-001', ['3eae9881cabe1bb672a560d7e18362ce9165bc8f7aa78a42e779340d8b52bff4',
    ['命坐巳亥地貞貪', [...'巳亥'].map(branch => at(life, branch, '廉贞', '贪狼'))],
  ]],
  ['580-001', ['f19ec3704fd5b629dc49b5aa312108f0fb46f059b7892b1b2b13757dfe213bbe',
    ['居生旺則富貴可致', atLifeOrBodyPhases(['长生', '帝旺'], ['地空', '地劫'])],
  ]],
  ['581-001', ['a6bf013994f61e4563a0fd620b93d696972a2699012f67a943a1f64c46329a70',
    [null, atLifeOrBody(seat => same(seat, '文昌', '文曲'), ['迁移'])],
  ]],
  ['582-001', ['8a50bb21c8a806175bb71f89f911de3b6652c6889edf40bfa40337f01cf0a382',
    [null, [[body('财帛'), bureau('水二局'), nayin('水'), ...same('财帛', '右弼', '文曲')]]],
  ]],
  ['583-001', ['c5bc640b49efa8fcf8803cc1c708e6ec879ff6bc2e388ad4a09170dc3b772d05',
    [null, [[body(life), ...at(life, '寅', '禄存', '天马')]]],
  ]],
  ['584-001', ['89a1df95bde029014561e9e678d2c911b1fa3774b931c5fc21d1cdb34e27ed77',
    [null, [[...at(life, '丑', '天魁'), ...atRelated(life, '迁移', 'opposite', '天钺')]]],
  ]],
  ['585-001', ['c4143f4b65cef800834916d884c87b7edbd32dc14ff5d4e964bc68ca49a56d30',
    [null, [[...at(life, '午', '紫微'), count(life, 1)]]],
  ]],
  ['587-001', ['a857fbf8599a7297205551804d1ca191abcb690f2d729c5ab01d84a567e6e0ae',
    [null, [{
      required: [body('财帛'), ...sector(life, '天机', '天梁', '左辅', '右弼', '龙池', '凤阁'), ...atRelated(life, '财帛', 'trine')],
      anyOf: [...'辰戌'].map(branch => at(life, branch)),
    }]],
  ]],
  ['588-001', ['53240206a40ec66c04fb58a5bafef7246390cb7edfe59457f97a19b85865d467',
    ['身命坐寅得巨門右弼紅鸞坐守', atLifeOrBody(seat => at(seat, '寅', '巨门', '右弼', '红鸾'), ['财帛'])],
  ]],
  ['589-001', ['505d2de58bd71342e18b04bdef4ccf09bdd1da1544228d12f31f656d535334a8',
    [null, atLifeOrBody(seat => same(seat, '地劫', '天姚'), ['夫妻'])],
  ]],
  ['590-001', ['c095cf8d3c301d9d3c9dc68df69fc12148b7fdaf612dba6d4c8364e3882f27d3',
    [null, [[body(life), ...same(life, '禄存', '天马', '封诰')]]],
  ]],
  ['591-001', ['344536ce386244e01b1052f9e69e75885a9155e06b12e161b5061b0b7bd1d533',
    [null, [{ required: [...same(life, '贪狼', '地空', '截路'), phase(life, '绝')], anyOf: intercept }]],
  ]],
  ['592-001', ['917a072b60b1a6c85d741f9f48a82ab2dca6c051bc65b778125f3d1f40627f89',
    [null, atBody(seat => at(seat, '辰', '七杀'))],
  ]],
  ['1290-001', ['5bf2322ed189de86381d520d6730ee7f356eefab42360ca2bdbef27215964f46',
    ['閣馬居命必作黃閣元臣', [same(life, '凤阁', '天马')]],
  ]],
  ['1291-001', ['e8377f92300ad66ff7d92724848921d7eda39b3ff9f21019a9992c2108040d96',
    [null, atLifeOrBody(seat => [phase(seat, '养')])],
  ]],
  ['1292-001', ['28da876cb9c5e997853e53f3672336772467e8c1be82bbcbb7155794d6c8ab88',
    ['身命坐衰病者', atLifeOrBodyPhases(['衰', '病'])],
    ['坐死者', atLifeOrBodyPhases(['死'])],
  ]],
  ['1293-001', ['1087ba34f1c2711ae49ae978be31f25de68d9bb5d20e5a2a5e1721d1fec22156',
    [null, atLifeOrBody(seat => sector(seat, '太阳', '太阴', '文昌', '文曲'))],
  ]],
  ['1296-001', ['7443d1be2b5d47edc9154104873389524480dab3538cbc6f86aeaa91e3d4be9b',
    [null, [at(life, '寅', '武曲', '天相', '陀罗', '火星')]],
  ]],
  ['1297-001', ['b9a22af2e686f4b91de2da5ddb1a2a5782ffe08b346ba0be85e3f803be9efec5',
    ['命宮雙祿同守、身宮日月同居、千百中難得', atBody(seat => [
      ...same(life, '禄存'), ...localChange(life, '禄'), ...same(seat, '太阳', '太阴'),
    ], ['夫妻', '财帛', '福德'])],
    ['況日月台座同宮、加有台甫來會、必入黃閣調元', [[
      body('福德'), ...same(life, '禄存'), ...localChange(life, '禄'), ...same('福德', '太阳', '太阴', '三台', '八座'),
      ...atRelated('福德', '财帛', 'opposite', '台辅'),
    ]]],
  ]],
  ['1298-001', ['4ceeed4d7c621ecc6fbca83d3feee342cd920580e4eb0784209921af4857fe79',
    ['命宮天相昌曲科並守', [[...same(life, '天相', '文昌', '文曲'), ...localChange(life, '科')]]],
  ]],
  ['1299-001', ['5e099c513b99d1d7086178ec1f8674c2d850e79a203db8e53bfc5caa8a03c42c',
    ['命宮天相右弼同守為君子', [same(life, '天相', '右弼')]],
    ['空刧七殺同臨為小人', [same(life, '地空', '地劫', '七杀')]],
  ]],
  ['1304-001', ['d658382081f33cce563bfb9add43da50eb3b480a6afdb72e3bb25e795e10fd73',
    [null, [{
      required: [...at(life, '丑'), branchAt('财帛', '酉'), branchAt('官禄', '巳'),
        ...localChange(life, '禄'), ...atRelated(life, '财帛', 'trine'), ...atRelated(life, '官禄', 'trine')],
      anyOf: [[...same('财帛', '文昌'), ...same('官禄', '文曲')], [...same('财帛', '文曲'), ...same('官禄', '文昌')]]
        .flatMap(group => [
          [...group, ...localChange('财帛', '科'), ...localChange('官禄', '权')],
          [...group, ...localChange('财帛', '权'), ...localChange('官禄', '科')],
        ]),
    }]],
  ]],
  ['1307-001', ['2cb50597c701dcdd159586866411eddbc178568c073f0b095c1d16ebc2a73d6c',
    ['命坐亥地、太陽化忌', [[...at(life, '亥', '太阳'), ...localChange(life, '忌'), starChange(life, '太阳', '忌')]]],
  ]],
  ['1308-001', ['2a3652862e467077ca0770997f8c85c0e0582fc0610e6d5aadc19d3bbd759fce',
    ['身命坐寅、武相祿存科池才坐守', [[body('夫妻'), ...at('夫妻', '寅', '武曲', '天相', '禄存', '龙池', '天才'), ...localChange('夫妻', '科')]]],
  ]],
  ['1309-001', ['0e3309be68d543535eaf65c47ecf2b67c2ae5678f852a62b39001b5c45d302b4',
    ['身命子地、貪狼鳳閣天貴天壽坐守', [at(life, '子', '贪狼', '凤阁', '天贵', '天寿')]],
  ]],
  ['1310-001', ['45d14520ee8737b725ff139d539165f12c5fe1eb3388bea1b0947808aa9ea863',
    [null, [{ required: at(life, '辰', '武曲', '文昌'), anyOf: outwardBenefics }]],
  ]],
  ['1312-001', ['3bc67830756ec4b5b53dc6014b711b0e79769fcde5c06e7dbe1bea5da56626b9',
    ['身命官宮得紫府輔弼', lifeSectorWithZuoYou.map(seat => [
      body(seat), ...sector(life, '紫微', '天府', '左辅', '右弼'),
      ...(seat === life ? [] : atRelated(life, seat, 'trine')),
    ])],
  ]],
  ['1313-001', ['a372e024381d5aecbcab2f2db2286394cb3b46ba8d9b7d39d237c0a36cad1b47',
    [null, [life, '财帛'].map(seat => ({
      required: [...same(seat, '巨门'), ...(seat === life ? [] : [body(seat)])],
      anyOf: flanks(seat, '廉贞', '天姚'),
    }))],
  ]],
  ['1314-001', ['0ea2052f33ba1b02131277addf9489110fa7845fd25fb22a38989bdad67ddf0b',
    ['身宮遇空刧四殺', atBody(seat => sector(seat, '地空', '地劫', '擎羊', '陀罗', '火星', '铃星'), [life, '夫妻', '官禄'])],
  ]],
]);

export function compileXingjueLifeBody(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [hash, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== hash || passages.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》身命篇的原文、出处或条件有变化，须重新核对。' };
  }
  const branches = passages.map(([text, groups]) => ({
    text, conditionCompiler: xingjueLifeBodyProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group)),
  }));
  if (!branches[0].text) return { compiler: xingjueLifeBodyProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》身命篇已核盘式与分句匹配', branches };
}
