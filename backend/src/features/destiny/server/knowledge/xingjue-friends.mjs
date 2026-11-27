import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueFriendsProfile = 'ziwei-xingjue-friends-v1';
const prefix = 'ziwei-v3-xingjue-054-p';
const palace = '仆役';
const scope = 'origin';
const starAt = (seat, star) => ({ kind: 'palace_star', palace: seat, star, scope });
const same = (...stars) => stars.map(star => starAt(palace, star));
const at = (branch, ...stars) => [{ kind: 'palace_branch', palace, branch }, ...same(...stars)];
const sectorChange = (seat, change) => ({ kind: 'palace_sector_mutagen', palace: seat, change });
const changeAt = (seat, change) => ({ kind: 'palace_mutagen', palace: seat, change, scope });
const localChange = change => [changeAt(palace, change), sectorChange(palace, change)];
const starChange = (star, change) => ({ kind: 'star_mutagen', palace, star, change, scope });
const phase = value => ({ kind: 'palace_changsheng_phase', palace, phase: value });
const bureau = value => ({ kind: 'natal_ziwei_bureau', bureau: value });
const nayin = element => ({ kind: 'natal_year_nayin_element', element });
const inSector = (seat, relation, ...stars) => [{ kind: 'palace_relation', anchor: palace, target: seat, relation },
  ...stars.map(star => starAt(seat, star))];
const external = [['兄弟', 'opposite'], ['子女', 'trine'], ['父母', 'trine']];
const luminariesFromOutside = external.flatMap(([sunSeat, sunRelation]) => external.map(([moonSeat, moonRelation]) => [
  ...inSector(sunSeat, sunRelation, '太阳'), ...inSector(moonSeat, moonRelation, '太阴'),
]));

// Qing manuscript, pp. 168–169. Relationship to the anchor is kept
// distinct from the identity of the stars on each verified natal seat.
const reviewed = new Map([
  ['699-001', ['69608e79709be38d38fafbe800a5a00d480496b8de113da766ff3e0443ee539a',
    [null, [{ required: [...same('禄存'), ...localChange('忌')], anyOf: luminariesFromOutside }]],
  ]],
  ['700-001', ['8746e745fd16571f7b5c4a0941e8575f1f515b570a1e6fb1417392305033992f',
    ["奴宮紫羊同宮", [at('午', '紫微', '擎羊')]],
  ]],
  ['701-001', ['684eda6a70b373433ace54800d1576db9d60005f7b3da262e2a5ee8c9163a512',
    ["奴宮子地天梁坐守", [[...at('子', '天梁'), bureau('火六局'), nayin('土')]]],
  ]],
  ['702-001', ['e31499f21645a53b591cf8e325143959f412ecbaeccfe600f89641d98cee70a8',
    [null, [at('申', '武曲', '天相')]],
  ]],
  ['1500-001', ['ea704d587219091f213c7d1eb4a10209210b2acc549625a58c41dd24a0e35d9a',
    [null, [[...at('寅', '巨门', '太阳'), phase('长生')]]],
  ]],
  ['1501-001', ['aad62a42e3c6ab9ba39f691466d2808cde2eeb70db35b79d57751eec473ef40a',
    [null, [[...at('卯', '太阴', '火星', '天姚'), bureau('火六局'), nayin('火')]]],
  ]],
  ['1502-001', ['bab769c80cb84c3b794b78d99f9adabf33d7808b77edabf9af6b832de0d5548a',
    ['奴宮得天同化祿', [[...same('天同'), starChange('天同', '禄'), ...localChange('禄')]]],
  ]],
  ['1503-001', ['7e9a898843f168cfb9217207133207c2d6cdf0bdd955102520b54416113a116b',
    ['奴宮空虛無正星、對宮日月羊刃', [[{ kind: 'palace_main_count', palace, count: 0 },
      ...inSector('兄弟', 'opposite', '太阳', '太阴', '擎羊')]]],
  ]],
  ['1504-001', ['211825589aa8f1a0d1ca9c2ad5e6d9bc138971c7c82bfba852f21feda1e09610',
    [null, [at('午', '贪狼', '火星')]],
  ]],
  ['1505-001', ['65f02ca27441cc6cbb8b8efe31271369d9612a09ca83b112fabb3d78b0c9c3e0',
    [null, [at('巳', '天机', '地空', '地劫')]],
  ]],
  ['1506-001', ['6806ff09de75bb86800c19df35b0c5316ca9a94d4fcdf7593329433226581f0b',
    [null, [[...at('辰', '七杀', '擎羊'), phase('帝旺')]]],
  ]],
  ['1507-001', ['5809aff7208e3d0207495f612f6827fc1ed7901b1afbd9d6e2746468459c7d5e',
    [null, [same('禄存', '天马')]],
  ]],
  ['1508-001', ['4d32b8672a4d30920a1d7f450db0daf177429498a9452bb2cc0302ecda407515',
    [null, ['紫微', '破军'].map(star => [...at('丑', '紫微', '破军'), starChange(star, '权'), ...localChange('权')])],
  ]],
  ['1509-001', ['532b2e0408f6715589e239a428316b92ca1a88a85150c265f984a41bfaebda41',
    [null, [same('天同', '蜚廉')]],
  ]],
  ['1510-001', ['862685bafaa843b4cbb6e25ceb9bdd3c66873df46d84786a47b11ef06f56c25f',
    [null, [[...same('武曲', '七杀', '天刑'), ...localChange('忌')]]],
  ]],
]);

export function compileXingjueFriends(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [hash, [text, groups]] = spec;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== hash || (text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》仆役篇的原文、出处或条件有变化，须重新核对。' };
  }
  const inputs = groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group));
  if (!text) return { compiler: xingjueFriendsProfile, inputs };
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》仆役篇已核盘式与分句匹配',
    branches: [{ text, conditionCompiler: xingjueFriendsProfile, inputs }] };
}
