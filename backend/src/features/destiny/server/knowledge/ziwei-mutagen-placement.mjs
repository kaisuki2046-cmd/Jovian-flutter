import { createHash } from 'node:crypto';
import { chartVersions } from '../../control/charts.ts';

export const ziweiMutagenPlacementProfile = 'iztro-2.6.5-natal-mutagen-placement-v1';
const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥', changes = '禄权科忌';
// iztro 2.6.5 lib/data/heavenlyStems.js, default algorithm. This finite check
// rejects incompatible source premises; it never adds positive chart facts.
export const defaultZiweiMutagens = Object.freeze([
  ['廉贞', '破军', '武曲', '太阳'], ['天机', '天梁', '紫微', '太阴'],
  ['天同', '天机', '文昌', '廉贞'], ['太阴', '天同', '天机', '巨门'],
  ['贪狼', '太阴', '右弼', '天机'], ['武曲', '贪狼', '天梁', '文曲'],
  ['太阳', '武曲', '太阴', '天同'], ['巨门', '太阳', '文曲', '文昌'],
  ['天梁', '紫微', '左辅', '武曲'], ['破军', '巨门', '太阴', '贪狼'],
].map(row => Object.freeze(row)));
export function compatibleZiweiNatalMutagens(facts) {
  if (chartVersions.ziwei.engineVersion !== '2.6.5'
    || chartVersions.ziwei.rulesetVersion !== 'standard-new-year-leap-split-late-zi-current-v1') throw new Error('Review Ziwei natal mutagen placement after an engine change.');
  return Array.from({ length: 60 }, (_, year) => year).some(year => facts.every(fact => {
    if (fact.kind === 'natal_year_stem') return fact.stem === stems[year % 10];
    if (fact.kind === 'natal_year_branch') return fact.branch === branches[year % 12];
    if (fact.kind === 'star_mutagen' && fact.scope === 'origin') return defaultZiweiMutagens[year % 10][changes.indexOf(fact.change)] === fact.star;
    return true;
  }));
}
const namedStars = '紫微|天机|太阳|武曲|天同|廉贞|天府|太阴|贪狼|巨门|天相|天梁|七杀|破军|文昌|文曲|左辅|右弼';
const namedPlacement = new RegExp(`(?:${namedStars})化[禄权科忌](?:居|在|守)[\\p{Script=Han}]+|(?:${namedStars})[在居守][\\p{Script=Han}]+(?:且|并)化[禄权科忌]`, 'u');
export const hasZiweiMutagenPlacementSyntax = claim => claim.conditions.normalized.some(text => namedPlacement.test(text));

const boundedSources = new Map([
  ['ziwei-v2-jielan-072-p002-002', '6fcebce981fc85af8a8abe8b69b4e7e846f6e07a6127bcf2f6ab1c905a41447b'],
  ['ziwei-v4-jielan-203-p002-001', '4f72877c4732374b4eccaed0c81e04c44b712d6bb4167c6e1bd120672a86e51e'],
]);
export function ziweiMutagenSourceDisposition(claim) {
  if (!boundedSources.has(claim.id)) return undefined;
  const digest = createHash('sha256').update(JSON.stringify({ source: claim.source, conditions: claim.conditions, evidence: claim.evidence })).digest('hex');
  return digest === boundedSources.get(claim.id);
}
export function ziweiMutagenSourceConditions(claim) {
  return claim.id === 'ziwei-v4-jielan-203-p002-001' && ziweiMutagenSourceDisposition(claim) === true
    ? ['太阳化忌居寅卯辰巳或太阴化忌居酉戌亥子', '按本篇各自的地支表'] : null;
}
export function ziweiMutagenEditorialCondition(claim, text) {
  return ziweiMutagenSourceDisposition(claim) === true
    && (claim.id === 'ziwei-v2-jielan-072-p002-002' && text === '按本篇水乡克火'
      || claim.id === 'ziwei-v4-jielan-203-p002-001' && text === '按本篇各自的地支表');
}
