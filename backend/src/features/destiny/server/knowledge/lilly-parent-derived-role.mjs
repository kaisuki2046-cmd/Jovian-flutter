import { createHash } from 'node:crypto';
import { lillyHouseRuleset } from '../../control/lilly-houses.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const lillyParentDerivedProfile = 'lilly-1647-p753-parent-figure-selection-v1';
export const lillyParentDerivedNote = '按莉莉卷三第 753 页，须明确首生子女及所查父母角色，再依本命昼夜选取起点星。本条计算选星，位置圈、极高与派生宫头需另行核定。';
const parents = ['father', 'mother'];
const names = { father: '父亲', mother: '母亲', Sun: '太阳', Saturn: '土星', Venus: '金星', Moon: '月亮' };
const selection = {
  day: { father: 'Sun', mother: 'Venus' },
  night: { father: 'Saturn', mother: 'Moon' },
};
const reviewed = new Map([
  ['astro-lilly-v3-merchant-p110-001', ['ae725ca4ec08ffa7501aa514ac75eadf557ec047883638cbc6ed58fdbb3f8b63', 'day', 'father']],
  ['astro-lilly-v3-merchant-p111-001', ['6856e82d202ddb26dfddd904bdebb1cda3c069269bc056743aff085a0ca06a67', 'night', 'father']],
  ['astro-lilly-v3-merchant-p112-001', ['966826ae755ef91024374925b24f0e058e81b2631d467abafd7436b25c600f2f', 'day', 'mother']],
  ['astro-lilly-v3-merchant-p113-001', ['36bac21dc2a0ce440e54fa486eda90d54259261beafb5801419704b261e866fb', 'night', 'mother']],
]);
const ruleset = { kind: 'western_lilly_ruleset', ruleset: lillyHouseRuleset };
const parentFact = (sect, parent, planet) => ({ kind: 'western_lilly_parent_derived_role', sect, parent, planet });

export function isLillyParentDerivedInput(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2
    && Object.hasOwn(value, 'birthOrder') && Number.isSafeInteger(value.birthOrder) && value.birthOrder > 0
    && Object.hasOwn(value, 'parent') && parents.includes(value.parent);
}

export const isLillyParentDerivedFact = (sect, parent, planet) =>
  Object.hasOwn(selection, sect) && parents.includes(parent) && selection[sect][parent] === planet;
export const lillyParentDerivedFactText = ({ sect, parent, planet }) =>
  `首生子女的${sect === 'day' ? '昼' : '夜'}盘取${names[planet]}为${names[parent]}派生图的起点星`;

export function compileLillyParentDerivedSource(claim) {
  const spec = reviewed.get(claim.id);
  if (!spec) return undefined;
  const [expected, sect, parent] = spec;
  const { source, conditions, evidence } = claim;
  if (createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex') !== expected) {
    return { reason: 'source_review_required', reviewNote: '莉莉父母派生图选星条文的原文、条件或版本已变化，须重新核对第 753 页。' };
  }
  return { compiler: lillyParentDerivedProfile, inputs: [normalizeRuleInput('western', {
    required: [ruleset, parentFact(sect, parent, selection[sect][parent])],
  })] };
}

export function lillyParentDerivedFacts(raw, houses, input) {
  if (!isLillyParentDerivedInput(input) || input.birthOrder !== 1
    || !houses.some(fact => fact.kind === ruleset.kind && fact.ruleset === ruleset.ruleset)) return [];
  const zodiacs = new Set(raw.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  const sects = new Set(raw.filter(fact => fact.kind === 'western_sect').map(fact => fact.sect));
  const [sect] = sects;
  if (zodiacs.size !== 1 || !zodiacs.has('tropical') || sects.size !== 1 || !Object.hasOwn(selection, sect)) return [];
  const { parent } = input;
  const planet = selection[sect][parent];
  if (!Number.isFinite(lillyPlanetPosition(raw, planet)?.longitude)) return [];
  return [parentFact(sect, parent, planet)];
}
