import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

const positions = ['year', 'month', 'day', 'hour'];
export const stemAt = (position, stem) => ({ kind: 'stem', position, stem });
export const branchAt = (position, branch) => ({ kind: 'branch', position, branch });
export const count = (stem, placement, count) => ({ kind: 'bazi_stem_placement_count', stem, placement, count });
export const missing = stem => count(stem, 'any', 0);
export const quantity = (stem, placement, min, max = ['visible', 'non_day'].includes(placement) ? 3 : 4) =>
  Array.from({ length: max - min + 1 }, (_, index) => [count(stem, placement, min + index)]);
export const shown = stem => quantity(stem, 'visible', 1);
export const seen = stem => quantity(stem, 'any', 1);
export const multiple = stem => quantity(stem, 'any', 2);
export const balance = (element, band) => ({ kind: 'bazi_element_balance', element, band, profile: 'weighted-element-balance-v1' });
export const heavy = element => ['旺', '过盛'].map(band => [balance(element, band)]);
export const light = element => ['弱', '少量'].map(band => [balance(element, band)]);
export const vigor = group => ({ kind: 'bazi_ten_god_strength', group, profile: 'anchored-weighted-ten-god-v1', strength: '旺' });
export const weak = { kind: 'day_master_strength', result: '偏弱', profile: 'monthly-weighted-strength-v1' };
export const godColumns = (tenGod, min, max = 4) => Array.from({ length: max - min + 1 }, (_, index) => [
  { kind: 'bazi_ten_god_count', tenGod, count: min + index },
]);
export const daylight = sect => ({ kind: 'natal_daylight', sect });

export function trine(names, month) {
  const slots = positions.filter(position => !month || position !== 'month');
  return [...names].filter(branch => branch !== month).reduce((groups, branch) =>
    groups.flatMap(group => slots.filter(position => group.every(f => f.position !== position))
      .map(position => [...group, branchAt(position, branch)])), [[]]);
}

export function pattern(dayStems, months, required, ...alternatives) {
  const anyOf = alternatives.length ? alternatives.reduce((groups, choices) =>
    groups.flatMap(group => choices.map(choice => [...group, ...choice])), [[]]) : [];
  return [...dayStems].flatMap(day => (months ? [...months] : [null]).map(month => ({
    required: [stemAt('day', day), ...(month ? [branchAt('month', month)] : []), ...required],
    anyOf,
  })));
}

export function compileQtbjCountedPassages(claim, reviewed, profile, chapters, changedSourceNote) {
  if (!claim.id.startsWith('qtbj-')) return undefined;
  const spec = reviewed.get(claim.id.slice(5));
  if (!spec) return undefined;
  const [expected, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  const containsUnverifiedExcerpt = passages.some(([text, , { fromContext = false } = {}]) => {
    const excerptSource = fromContext ? evidence.context : evidence.original_text;
    return text && (typeof excerptSource !== 'string' || !excerptSource.includes(text));
  });
  if (digest !== expected || containsUnverifiedExcerpt) {
    return { reason: 'source_review_required', reviewNote: changedSourceNote };
  }
  const branches = passages.map(([text, groups]) => ({
    text,
    conditionCompiler: profile,
    inputs: groups.map(group => normalizeRuleInput('bazi', group)),
  }));
  if (branches[0].text === null) return { compiler: profile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: `按《穷通宝鉴》${chapters}已核分句取材`, branches };
}
