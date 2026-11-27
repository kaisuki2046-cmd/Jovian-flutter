import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueTianjiProfile = 'ziwei-xingjue-tianji-v1';
const prefix = 'ziwei-v2-xingjue-006-p';
const life = '命宫';
const seats = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
const bodySeats = ['夫妻', '财帛', '迁移', '官禄', '福德'];
const branchAt = (palace, branch) => ({ kind: 'palace_branch', palace, branch });
const starAt = (palace, star) => ({ kind: 'palace_star', palace, star, scope: 'origin' });
const same = (palace, ...stars) => stars.map(star => starAt(palace, star));
const at = (palace, branch, ...stars) => [branchAt(palace, branch), ...same(palace, ...stars)];
const change = (palace, star, change) => ({ kind: 'star_mutagen', palace, star, change, scope: 'origin' });
const sectorStar = (palace, star) => ({ kind: 'palace_sector_star', palace, star });
const sectorChange = (palace, change) => ({ kind: 'palace_sector_mutagen', palace, change });
const realBody = palace => ({ kind: 'palace_confirmed_body_seat', palace });
const solo = palace => ({ kind: 'palace_main_count', palace, count: 1 });
const relate = (anchor, target, relation) => ({ kind: 'palace_relation', anchor, target, relation });

function flank(palace, first, second) {
  const index = seats.indexOf(palace);
  const previous = seats[(index + seats.length - 1) % seats.length];
  const next = seats[(index + 1) % seats.length];
  return [relate(palace, previous, 'adjacent'), relate(palace, next, 'adjacent'),
    starAt(previous, first), starAt(next, second)];
}
function atLifeOrBody(pattern) {
  return [pattern(life), ...bodySeats.map(palace => [realBody(palace), ...pattern(palace)])];
}
function outside(palace, required, stars) {
  return { required: [...required, ...stars.map(star => sectorStar(palace, star))],
    mustBeAbsent: same(palace, ...stars) };
}

const tianji = palace => same(palace, '天机');
const tianjiMoon = palace => same(palace, '天机', '太阴');
const tianjiTianliang = (palace, branch) => at(palace, branch, '天机', '天梁');

// The imported chapter label is reused in other volumes. Bind these passages
// to the actual Tianji section on pp. 78–79 of the Qing manuscript.
const patterns = new Map([
  ['260-001', ['5fa2df16581855c2d122e6c3634d3e1a2ff503565db91a11311b9d1f5a2ddc90', null, atLifeOrBody(tianji)]],
  ['261-001', ['f45c1fa333492e102ff53e6aeda2593498626ea4fddaf16160a25d35399ca189', null, atLifeOrBody(palace => [...tianji(palace), sectorStar(palace, '天梁')])]],
  ['262-001', ['2f9b313f18a5bff0dc977200780b63e9fd1419099cdd356d7fa81dacaaecd41e', '且值昌曲照夾者主文章聲名振世', [
    outside(life, tianjiMoon(life), ['文昌', '文曲']),
    ...['财帛', '官禄'].map(palace => outside(palace, [realBody(palace), ...tianjiMoon(palace)], ['文昌', '文曲'])),
  ]]],
  ['263-001', ['71d284cae9bf5abcd88c380d591a91d175da858f9ec31c71ca4f2ad4ae13b430', '有文藝', [outside(life, [
    ...at(life, '子', '天机'), solo(life), relate(life, '迁移', 'opposite'), ...same('迁移', '巨门', '文曲'),
  ], ['文昌'])]]],
  ['265-001', ['c31def0af2e99cb5de8090a6c9ee62415d0b90e18999a21847a8d7dc2e55edd2', '遇天刑、一生困窮憂愁', [
    [...at(life, '子', '天机', '天刑'), solo(life)],
    [...at('福德', '子', '天机', '天刑'), solo('福德')],
  ]]],
  ['267-001', ['6810890d902a2faecda467f61b25aadfe130d7dd911046bf9efdbb7706ddbd88', null, seats.flatMap(palace => ['辰', '戌'].map(branch => [
    ...tianjiTianliang(palace, branch), sectorChange(palace, '权'), sectorChange(palace, '禄'),
  ]))]],
  ['270-001', ['c278037ea1661d733cc2dea089bc20de48e599c30753b16814c6b9b02bd1ac4a', '天機與地空及天姚同居', [[realBody('夫妻'), ...at('夫妻', '子', '天机', '地空', '天姚')]]]],
  ['804-001', ['61b9ad03dbab71a1bdede7a81959f77a0ffd33fc1c58ea7f88483d4009a2d77a', '寅申機月雖云福輕、例得紫府夾', seats.flatMap(palace => [
    [...at(palace, '寅', '天机', '太阴'), ...flank(palace, '紫微', '天府')],
    [...at(palace, '申', '天机', '太阴'), ...flank(palace, '紫微', '天府')],
  ])]],
  ['806-001', ['c2d7ce9911c50be3a9ef3c1cd52457b580154dd0f617fbbc92f6d715d66d4323', '亥宮天機合祿者貴', seats.flatMap(palace => [
    at(palace, '亥', '天机', '禄存'),
    [...at(palace, '亥', '天机'), change(palace, '天机', '禄'), sectorChange(palace, '禄')],
  ])]],
  ['807-001', ['1205b0f5e323905f6d79b3b59f38a994898461a82e6e2d642f9be4db27080fd0', null, seats.map(palace => [
    ...at(palace, '寅', '天机', '太阴', '禄存'), ...flank(palace, '紫微', '天府'), ...flank(palace, '擎羊', '陀罗'),
  ])]],
  ['810-001', ['6eb000d03721918343e6469eef9a5ddab4b4b4976cb6ef29c74021083f4d16c4', '辰上機梁遇青龍極吉', seats.map(palace => [
    ...tianjiTianliang(palace, '辰'), { kind: 'palace_boshi_star', palace, star: '青龙' },
  ])]],
  ['1074-001', ['5ee0b40b3e5ab4b435ce7856c429d3f1fac453cb9a0e81ef5ba5f5d074071d9d', null, atLifeOrBody(tianji)]],
]);

export const xingjueTianjiRepeatedPassages = new Map([
  [prefix + '260-001', { id: prefix + '1074-001' }],
]);

export function compileXingjueTianji(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const pattern = patterns.get(claim.id.slice(prefix.length));
  if (!pattern) return undefined;
  const [digest, text, groups] = pattern;
  const { source, conditions, evidence } = claim;
  const currentDigest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (currentDigest !== digest || text && !evidence.original_text.includes(text)) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》卷二天机条的原文、出处或条件有变化，须重新核对。' };
  }
  const inputs = groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group));
  if (!text) return { compiler: xingjueTianjiProfile, inputs };
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》卷二天机条已核盘式匹配',
    branches: [{ text, conditionCompiler: xingjueTianjiProfile, inputs }] };
}
