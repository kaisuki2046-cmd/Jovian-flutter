import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueFemaleProfile = 'ziwei-xingjue-female-chapter-v1';
const prefix = 'ziwei-v3-xingjue-059-p';
const scope = 'origin';
const life = '命宫';
const female = { kind: 'natal_gender', gender: '女' };
const layout = { kind: 'ziwei_confirmed_natal_layout' };
const bodyPalaces = ['命宫', '夫妻', '财帛', '迁移', '官禄', '福德'];
const kin = ['夫妻', '子女'];
const at = (palace, ...stars) => stars.map(star => ({ kind: 'palace_star', palace, star, scope }));
const branchAt = (palace, branch) => ({ kind: 'palace_branch', palace, branch });
const brightness = (palace, star, brightness) => ({ kind: 'palace_brightness', palace, star, brightness, scope });
const phase = (palace, phase) => ({ kind: 'palace_changsheng_phase', palace, phase });
const bodySeat = palace => [{ kind: 'palace_confirmed_body_seat', palace }];
const sector = (palace, star) => ({ kind: 'palace_sector_star', palace, star });
const sectorMany = (palace, stars) => stars.map(star => sector(palace, star));
const trine = (palace, star) => ({ kind: 'palace_trine_star', palace, star });
const sectorChange = (palace, change) => ({ kind: 'palace_sector_mutagen', palace, change });
const ownChange = (palace, star, change) => ({ kind: 'star_mutagen', palace, star, change, scope });
const localChange = (palace, change) => [{ kind: 'palace_mutagen', palace, change, scope }, sectorChange(palace, change)];
const lifeAndBody = [[life, false], ...bodyPalaces.slice(1).map(palace => [palace, true])];
const lifeBodyAndFude = [[life, false], ['福德', false], ['官禄', true]];
const fireAndWaterSeats = [
  [life, false, '亥子丑午未'], ['夫妻', false, '亥子丑午未'], ['子女', false, '亥子丑午未'], ['福德', false, '亥子丑午未'],
  ['财帛', true, '亥子丑午未'], ['迁移', true, '亥子午'], ['官禄', true, '亥'],
];
const growthLiterarySeats = [[life, false], ['迁移', true]];
const kinLights = palace => [...at(palace, '太阳', '太阴'), phase(palace, '帝旺')];
const supportedAid = [['武曲', '天府'], ['贪狼', '紫微'], ['七杀', '紫微']];
const assignVoids = (palace, lifeStar, bodyStar) => [...at(life, lifeStar), ...at(palace, bodyStar), ...bodySeat(palace)];
const splitVoids = [
  ...bodyPalaces.slice(1).map(palace => assignVoids(palace, '地空', '地劫')),
  assignVoids('迁移', '地劫', '地空'),
];

// The Qing manuscript's chapter supplies the gender scope. The report receives
// the matching chart phrases while the original folios retain the surrounding assessments.
const reviewed = new Map([
  ['779-001', ['dec5b9ff85fa4ccac50bbaeffb4cc071034e765fbdc48676a8a72f60c44ab2af',
    ['寅申機月', [...'寅申'].map(z => [...at(life, '天机', '太阴'), branchAt(life, z)])],
  ]],
  ['781-001', ['7aa202187687db6a68e1ba9cf57e6894ec63f8662ed7dab072c1743551b312f7',
    ['太陰科星會文曲', kin.flatMap(palace => ['庙','旺'].map(value => [
      ...at(palace, '太阴'), brightness(palace, '太阴', value), ownChange(palace, '太阴', '科'), ...localChange(palace, '科'), sector(palace, '文曲'),
    ]))],
  ]],
  ['782-001', ['4007f7598ab6782deffb29e886db66cbf531c47789eb5e10fd9994ff0e244988',
    ['命有紫府輔相', [[
      ...bodySeat('官禄'), ...at('官禄', '左辅', '天相'), ...sectorMany(life, ['紫微', '天府', '左辅', '天相']),
    ]]],
  ]],
  ['788-001', ['6f372761aa8e8f3b396aa8dd38c8a3820010023bf7a8acd0d646e661df6a2c69',
    ['田宮帝祿', [at('田宅', '紫微', '禄存')]],
  ]],
  ['1662-001', ['a94bed5ce830192a75bc8cde5c877842285a6a6dfffbf7b8e978810ee3cce09a',
    ['若與天同相遇', [['巳','申'],['亥','寅']].map(([first, second]) => [
      ...at(life, '廉贞'), branchAt(life, first), ...at('田宅', '天同'), branchAt('田宅', second), layout,
    ])],
  ]],
  ['1663-001', ['8f945c133d1a4f4d9c62aee0dfb14dc6f68dd440185d8bada7eb23edc2b224d2',
    ['天機巨門天梁太陰', [[...at(life, '天机'), ...sectorMany(life, ['巨门', '天梁', '太阴'])]]],
  ]],
  ['1664-001', ['8a667f0130493f1cc2c16e1587bac4e75f30552fd0aec7dc6937ab16fe45071d',
    ['七殺火星居在水火鄉者', fireAndWaterSeats.flatMap(([palace, isBody, branches]) => [...branches].map(z => [
      ...(isBody ? bodySeat(palace) : []), branchAt(palace, z), ...at(palace, '七杀', '火星'),
    ]))],
  ]],
  ['1665-001', ['c4b3009d14f2ac84bf453f5656cf3e25865c83922c5a239a6ec4356344de11a8',
    ['夫子二宮、逢日月於生旺地', kin.map(kinLights)],
    ['與文星科星相會者', ['文昌', '文曲'].map(star => [
      ...kinLights('子女'), sector('子女', star), sectorChange('子女', '科'),
    ])],
  ]],
  ['1666-001', ['9db24d79c85b9f7ef7d847495c20a867cc1d2f4a935f8e62e45a59dd27870935',
    ['武曲在命、七殺在福、貪狼在身宮者', [[
      ...at(life, '武曲'), ...at('福德', '七杀'), ...at('夫妻', '贪狼'), ...bodySeat('夫妻'),
    ]]],
  ]],
  ['1667-001', ['28a3e7c60a595b93cc3386a1176d0c09f05a4672e8f3382588e3bb6e946f7a1c',
    ['太陰旺地入廟遇火星科星於夫子宮者', kin.flatMap(palace => ['庙','旺'].map(value => [
      ...at(palace, '太阴', '火星'), brightness(palace, '太阴', value), sectorChange(palace, '科'),
    ]))],
  ]],
  ['1668-001', ['70d32f8f9f6fa1d269db684accb05dc158f76a781dc8e8174868b1eac73e6918',
    ['身命福宮雖有武貪殺中一星、若紫府輔中二星同臨、又有福貴同照者', lifeBodyAndFude.flatMap(([palace,isBody]) =>
      supportedAid.map(([principal, aid]) => [
        ...(isBody ? bodySeat(palace) : []), ...at(palace, principal, aid, '左辅'), sector(palace, '天福'),
      ]))],
  ]],
  ['1671-001', ['25df64d4d72a11598969498e20b6b5efe2b989b898d69c3547ff136ab5b2ecef',
    ['兩祿', lifeAndBody.map(([palace,isBody]) => [
      ...(isBody ? bodySeat(palace) : []), ...at(palace, '禄存'), ...localChange(palace, '禄'),
    ])],
  ]],
  ['1673-001', ['52aa3267ba3e59183b63fd7daa23211fb41fc345a81cb0bf131c04d1a2e99b37',
    ['空刧迭身命', splitVoids],
    ['於衰死鄉', ['夫妻', '福德'].flatMap(palace => [['衰', '死'], ['死', '衰']].map(([first, second]) => [
      ...assignVoids(palace, '地空', '地劫'), phase(life, first), phase(palace, second),
    ]))],
  ]],
  ['1676-001', ['a899a9414ea3b721439c8ca5342095e2babe1115720710fe64186ccd781cdaff',
    ['昌曲得生旺地', growthLiterarySeats.map(([palace,isBody]) => [
      ...(isBody ? bodySeat(palace) : []), ...at(palace, '文昌', '文曲'), phase(palace,'帝旺'),
    ])],
    ['坐死絕地', growthLiterarySeats.map(([palace, isBody]) => [
      ...(isBody ? bodySeat(palace) : []), ...at(palace, '文昌', '文曲'), phase(palace, '死'),
    ])],
  ]],
  ['1679-001', ['5aec44356aa901b88c98a02b50d87bb70caf97528d1aa82976a48f6a1c8a5d59',
    ['武曲在夫宮者', [at('夫妻', '武曲')]],
  ]],
  ['1684-001', ['74b5940b50f112cf20b350c5a72f8b1c861e95db7350c5453524e837a36b39c6',
    ['女命以府相為主、落空', [['天府', '天相'], ['天相', '天府']].flatMap(([here, there]) =>
      ['地空', '天空', '旬空', '空亡'].map(voidStar => [
        ...at(life, here, voidStar), { kind: 'palace_main_count', palace: life, count: 1 }, trine(life, there),
      ]))],
  ]],
]);

export function compileXingjueFemale(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [digest, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== digest || passages.some(([text]) => !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》女命篇的原文、出处或条件有变化，须重新核对。' };
  }
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》女命篇已核盘面分句匹配',
    branches: passages.map(([text, groups]) => ({
      text, conditionCompiler: xingjueFemaleProfile,
      inputs: groups.map(required => normalizeRuleInput('ziwei', { required: [female, ...required] })),
    })) };
}
