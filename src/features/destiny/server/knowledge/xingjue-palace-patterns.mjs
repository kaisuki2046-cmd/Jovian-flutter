import { createHash } from 'node:crypto';
import { LunarUtil } from 'lunar-javascript';
import { normalizeRuleInput } from './matching.mjs';

export const xingjuePalacePatternsProfile = 'ziwei-xingjue-palace-patterns-v1';

const life = '命宫';
const career = '官禄';
const travel = '迁移';
const sunMoonTravelId = 'ziwei-v1-xingjue-048-p1050-001';
const same = (palace, ...stars) => stars.map(star => ({ kind: 'palace_star', palace, star, scope: 'origin' }));
const branchAt = (palace, branch) => ({ kind: 'palace_branch', palace, branch });
const relate = (anchor, target, relation) => ({ kind: 'palace_relation', anchor, target, relation });
const phase = (palace, phase) => ({ kind: 'palace_changsheng_phase', palace, phase });
const natalChangeAt = (palace, change) => [
  { kind: 'palace_mutagen', palace, change, scope: 'origin' },
  { kind: 'palace_sector_mutagen', palace, change },
];

const fireYears = LunarUtil.JIA_ZI.filter(year => LunarUtil.NAYIN[year]?.endsWith('火')).map(([stem, branch]) => [
  { kind: 'natal_year_stem', stem }, { kind: 'natal_year_branch', branch },
]);
const goodStars = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'];

// Read the two sides of a named flank separately and let the natal
// transformation calculation establish the carrier in each seat.
const authorityAndFortuneFlank = ['父母', '兄弟'].map((authority, index, adjacent) => {
  const fortune = adjacent[1 - index];
  return [
    ...natalChangeAt(life, '科'),
    relate(life, authority, 'adjacent'), ...natalChangeAt(authority, '权'),
    relate(life, fortune, 'adjacent'), ...natalChangeAt(fortune, '禄'),
  ];
});

const reviewed = new Map([
  ['ziwei-v1-xingjue-048-p1046-001', ['b396ce7eab0250380677f90a53dd9b8ddc97f4772de5b90f6f7922bda614fbea', [{
    required: [phase(career, '胎')],
    anyOf: goodStars.flatMap((first, index) => goodStars.slice(index + 1).map(second => same(career, first, second))),
  }]]],
  ['ziwei-v1-xingjue-048-p1048-001', ['1a179363d568c613ef65612a68b662c419fc01e486125901b72ecc82f872275a', [{
    required: [...same(life, '陀罗'), relate(life, travel, 'opposite'), ...same(travel, '火星')],
    anyOf: fireYears,
  }]]],
  ['ziwei-v1-xingjue-048-p1049-001', ['d9d4966b6f6c3f3f0b37f614e53941244835ca9d60558196d14b99a9b8dee049', [{
    required: [
      branchAt(life, '戌'), ...same(life, '擎羊', '天刑'),
      relate(life, travel, 'opposite'), branchAt(travel, '辰'), ...same(travel, '天机', '天梁'),
    ],
  }]]],
  [sunMoonTravelId, ['68330b3f4ad5937f92658ac804aad9a6c0504461d79e4d582749675c60ac3707', [{
    required: [
      branchAt(travel, '丑'), ...same(travel, '太阳', '太阴'),
      { kind: 'natal_ziwei_bureau', bureau: '火六局' },
    ],
    anyOf: fireYears.flatMap(year => ['天魁', '天钺'].map(star => [...year, ...same(travel, star)])),
  }]]],
  ['ziwei-v1-xingjue-053-p1001-001', ['a42bb79616bddf14b1d378be477bfb2c33ae84627a9e9bfe679d1296eaec6ead',
    authorityAndFortuneFlank.map(required => ({ required })),
  ]],
]);

export function compileXingjuePalacePatterns(claim) {
  const spec = reviewed.get(claim.id);
  if (!spec) return undefined;
  const [expected, groups] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== expected) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》杂格或庙享格的出处、原文或条件有变化，须重新核对。' };
  }
  return {
    compiler: xingjuePalacePatternsProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', group)),
    ...(claim.id === sunMoonTravelId && { remainingAlternatives: 1 }),
  };
}
