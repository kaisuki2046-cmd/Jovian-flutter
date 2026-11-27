import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const ziweiChangshengSourceProfile = 'ziwei-changsheng-source-v1';
const palaces = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
const bodySeats = ['命宫', '夫妻', '财帛', '迁移', '官禄', '福德'];
const phasesOutsideJue = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '胎', '养'];
const female = { kind: 'natal_gender', gender: '女' };
const phase = (palace, phase) => ({ kind: 'palace_changsheng_phase', palace, phase });
const at = (palace, ...names) => names.map(star => ({ kind: 'palace_star', palace, star, scope: 'origin' }));
const seat = (palace, branch, ...names) => [{ kind: 'palace_branch', palace, branch }, ...at(palace, ...names)];
const sector = (palace, ...names) => names.map(star => ({ kind: 'palace_sector_star', palace, star }));
const inPhases = (palace, values, required) => ({ required, anyOf: values.map(value => [phase(palace, value)]) });
const horseInJue = palaces.map(palace => [...at(palace, '天马'), phase(palace, '绝')]);
const horseWithTuo = palaces.map(palace => at(palace, '天马', '陀罗'));
// The current bureau and natal-star tables permit both stars at Jue only at these seats.
const luAndHorseInJuePalaces = ['夫妻', '子女', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
const yinEstate = [...seat('田宅', '寅'), ...sector('田宅', '武曲', '天相', '文曲', '陀罗')];
const haiParents = [...seat('父母', '亥', '天相', '天魁'), phase('父母', '长生')];
const yinWealthInJue = [
  ...seat('财帛', '寅', '巨门', '太阳', '地空', '天姚'), phase('财帛', '绝'),
  { kind: 'palace_suiqian_star', palace: '财帛', star: '白虎' },
];

// Each reviewed line retains the source wording and its exact matched conditions.
const reviewed = new Map([
  ['ziwei-v1-xingjue-008-p035-001', ['a5e66e2daf9edd56d04b1b967e4725a4d43ae225b5fd5f639d48bf6a63a5d90e',
    [null, bodySeats.map(palace => inPhases(palace, ['长生', '帝旺'], [{ kind: 'palace_confirmed_body_seat', palace }]))],
  ]],
  ['ziwei-v2-xingjue-009-p1081-001', ['ea62b4fcae225de393a5a35b1b344c719db6052bf111ad5e61257d0aee61a052',
    [null, [[...seat('命宫', '未', '天同', '巨门', '火星'), phase('命宫', '衰')]]],
  ]],
  ['ziwei-v2-xingjue-015-p350-001', ['0efd07a9c1f5322366666fd8f25a7d8e140afd56af80ffcbf752cd1cc8f6348b',
    ['命坐衰落絕死地與七殺合者甚危', [inPhases('命宫', ['衰', '死', '绝'], at('命宫', '七杀'))]],
    ['福宮值者亦然', [inPhases('福德', ['衰', '死', '绝'], at('福德', '七杀'))]],
  ]],
  ['ziwei-v2-xingjue-021-p406-001', ['0d35fa731af968179d1aff61a3fa49e6bb16e2e7e40c207a82d92e8c0baf798a',
    ['居絕地者死馬也', horseInJue],
    ['遇陀羅者謂之折足馬', horseWithTuo],
  ]],
  ['ziwei-v2-xingjue-021-p1156-001', ['3dee6357229ce0dd5a02993e788675e29b9954f7056169057832e02cd1eeb6e9',
    [null, luAndHorseInJuePalaces.map(palace => [...at(palace, '天马', '禄存'), phase(palace, '绝')])],
  ]],
  ['ziwei-v3-xingjue-048-p598-001', ['d7c91dabd5339a7ee3f3c469e1191d2cd00755ddc8b61d59b155be0916be04d0',
    [null, [[...at('兄弟', '文曲', '禄存'), phase('兄弟', '长生')]]],
  ]],
  ['ziwei-v3-xingjue-049-p1365-001', ['88302b7df13fd97a0b124c99f7643a6677047ef6385b3fdb2b91ce3da77d2966',
    [null, [[...at('夫妻', '天机', '太阴'), phase('夫妻', '长生')]]],
  ]],
  ['ziwei-v3-xingjue-050-p1376-001', ['1de0037475418ccc5c5f96b9ca807e43738bceb2f8086a146846fca28341d115',
    ['子宮在生旺胎地最貴', ['长生', '帝旺', '胎'].map(value => [phase('子女', value)])],
    ['沐浴雖非吉神而獨宜子宮', [[phase('子女', '沐浴')]]],
  ]],
  ['ziwei-v3-xingjue-051-p665-001', ['38582f93f6a913dc8c7e7bf7ce972b9f6c77acef2fc6df9368963bbc0b850bc8',
    ['寅財巨日雖好、地空姚星與白虎同居絕地者、財帛不聚', [yinWealthInJue]],
    ['加值大耗、蕩盡財產', [[...yinWealthInJue, { kind: 'palace_boshi_star', palace: '财帛', star: '大耗' }]]],
  ]],
  ['ziwei-v3-xingjue-056-p1574-001', ['2f7ca93cf8812480256c4e3b35136322750bc2342915c2c07070a7a374c461ae',
    ['若坐病逢力士則非', [[...yinEstate, phase('田宅', '病'), { kind: 'palace_boshi_star', palace: '田宅', star: '力士' }]]],
  ]],
  ['ziwei-v3-xingjue-057-p771-001', ['f88b9e0d79fb282c6775060c42439d9e8d7c3c1ef7ad60240214aad06ba15ce9',
    [null, [[phase('福德', '绝'), ...sector('福德', '天同', '天梁', '左辅', '右弼')]]],
  ]],
  ['ziwei-v3-xingjue-058-p821-001', ['68594c028471c6a2460e2d5a0eb91173bbbfce3ac70684c2d5e113735c150289',
    [null, sector('父母', '地空', '地劫', '擎羊', '火星', '铃星').map(fact => ({ required: haiParents, mustBeAbsent: [fact] }))],
  ]],
  ['ziwei-v3-xingjue-059-p1675-001', ['375d32c08a964462fa9cc29a811a55e502ef81d398021ac192c0b35310b6dc14',
    ['寅申同梁福宮最宜婦命', [...'寅申'].map(branch => inPhases('福德', phasesOutsideJue, [...seat('福德', branch, '天同', '天梁'), female]))],
  ]],
  ['ziwei-v4-jielan-192-p002-003', ['e8d47a6c59104b87643075e493472d90a259b60a365b8108bdde29490de9f216',
    ['居绝地，谓之死马。', horseInJue],
    ['遇陀罗，谓之折足马。', horseWithTuo],
  ]],
]);

export function compileZiweiChangshengSource(claim) {
  const spec = reviewed.get(claim.id);
  if (!spec) return undefined;
  const [hash, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== hash || passages.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '长生十二神条文的原文、出处或条件有变化，须重新核对。' };
  }
  const branches = passages.map(([text, groups]) => ({
    text,
    conditionCompiler: ziweiChangshengSourceProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group)),
  }));
  if (!branches[0].text) return { compiler: ziweiChangshengSourceProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '按已校读的本命长生十二神原句取证', branches };
}
