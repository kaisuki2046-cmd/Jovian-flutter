import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const ziweiSourceExclusionProfile = 'ziwei-source-exclusions-v1';
const fourMalefics = ['擎羊', '陀罗', '火星', '铃星'];
export const ziweiSectorExclusionStars = [...fourMalefics, '地空', '地劫'];

const reviewed = new Map([
  ['ziwei-v2-fuqigong-p101011-002', {
    hash: '3c4add4b4c713adb1f62ffbe71441faeba77d490bc1d0a319fa7589ecde9a4ea',
    palaces: ['夫妻'], stars: ['巨门', '太阳'], count: 0,
  }],
  ['ziwei-v2-c013-p101014-003', {
    hash: 'ec2207c4fe99d70c711a454da0563a5e7eb4b6e6228cb5f619cd1a8d32ab9bb3',
    palaces: ['父母'], stars: ['太阴', '太阳'], count: 0,
  }],
  ['ziwei-v2-c011-p101013-003', {
    hash: '0ef6cd0a180f075c29af3e0b1339bb28a7314791bc182f5cd6ed4b2d121d40f1',
    palaces: ['田宅'], stars: ['天梁', '天机'], sectorAbsent: true,
  }],
  ['ziwei-v2-guanlugong-p008-002', {
    hash: 'ed57354f87f5fc305ef16fd1e3c21b3c410626b4f0083c3be340cc3bdb7f2c51',
    palaces: ['官禄'], stars: ['天府'], level: '庙', passages: [{ text: '天府入庙文武皆吉' }],
  }],
  ['ziwei-v3-xingjue-032-p1263-001', {
    hash: 'b357797bdf2f50094026b128604e97a1eaa32212be38a2b17f85ddc6772ee391',
    palaces: ['财帛', '田宅'], stars: ['红鸾'], localAbsent: true,
  }],
  ['ziwei-v3-xingjue-049-p621-001', {
    hash: '34cd2d3fe97abde5e72c9b9bd4996ddce2cd659904066a73e03579c4bab45cb0',
    palaces: ['夫妻'], stars: ['武曲', '破军'], branch: '巳', passages: [{ text: '妻宮巳地武破、相剋不和' }, { text: '加四殺中二殺者不和', count: 2 }],
  }],
]);

export function compileZiweiSourceExclusions(claim) {
  const spec = reviewed.get(claim.id);
  if (!spec) return undefined;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== spec.hash) return { reason: 'source_review_required', reviewNote: '排除及计数口径所据原文或条件变化，须重新核对。' };

  const { palaces, stars, level, branch, localAbsent, sectorAbsent, passages } = spec;
  const compile = ({ count }) => palaces.map(palace => {
    const starFact = star => ({ kind: 'palace_star', palace, star, scope: 'origin' });
    const required = stars.map(starFact);
    if (level) required.push({ kind: 'palace_brightness', palace, star: stars[0], scope: 'origin', brightness: level });
    if (branch) required.push({ kind: 'palace_branch', palace, branch });
    if (count !== undefined) required.push({ kind: 'palace_sector_malefic_count', palace, count });
    const mustBeAbsent = [
      ...(localAbsent ? fourMalefics.map(starFact) : []),
      ...(sectorAbsent ? ziweiSectorExclusionStars.map(star => ({ kind: 'palace_sector_star', palace, star })) : []),
    ];
    return normalizeRuleInput('ziwei', { required, mustBeAbsent });
  });

  if (!passages) return { compiler: ziweiSourceExclusionProfile, inputs: compile(spec) };
  return {
    reason: 'unmapped_condition',
    condition: '按原文已核条件提供独立分句',
    branches: passages.map(({ text, count }) => ({ text, conditionCompiler: ziweiSourceExclusionProfile, inputs: compile({ count }) })),
  };
}
