import { createHash } from 'node:crypto';
import { baziPillars, shenShaFromKnownBaZiPillars, isBaZiPillar } from '../../control/charts.ts';
import { compatibleBaZiLiteralFacts } from './bazi-literal-conditions.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const baziShenShaPlacementProfile = 'natal-shensha-v1-source-placements-v1';
export const shenShaPlacementNames = Object.freeze({
  horseVoid: '本命驿马与空亡同柱', canopyVoid: '本命华盖与空亡同柱', wifeHorse: '本命驿马落日支妻宫',
  mutualHorses: '本命年支与日支互为驿马',
});
const coordinateKinds = ['pillar', 'stem', 'branch'];
// Reuse the real chart engine's year/day anchors, including its rule that a
// source pillar does not supply its own 空亡、驿马、华盖. Client flags are not proof.
function verifiedShenShaPlacements(facts) {
  const coordinates = facts.filter(fact => coordinateKinds.includes(fact.kind));
  if (!compatibleBaZiLiteralFacts(coordinates)) return [];
  const pillars = {}, knownBranches = {};
  for (const position of baziPillars) {
    const selected = coordinates.filter(fact => fact.position === position);
    const stems = new Set(selected.flatMap(fact => fact.kind === 'pillar' ? [fact.ganZhi[0]] : fact.kind === 'stem' ? [fact.stem] : []));
    const branches = new Set(selected.flatMap(fact => fact.kind === 'pillar' ? [fact.ganZhi[1]] : fact.kind === 'branch' ? [fact.branch] : []));
    if (branches.size === 1) knownBranches[position] = [...branches][0];
    if (stems.size === 1 && branches.size === 1) {
      const value = [...stems][0] + [...branches][0];
      if (!isBaZiPillar(value)) return [];
      pillars[position] = value;
    }
  }
  if (!pillars.year && !pillars.day && !knownBranches.year && !knownBranches.day) return [];
  return baziPillars.map(position => ({
    position, ganZhi: pillars[position], branch: knownBranches[position],
    shenSha: shenShaFromKnownBaZiPillars(pillars, position, knownBranches) ?? [],
  }));
}

function placementEvidence(placements) {
  return placements.flatMap(placement => {
    const { position, shenSha } = placement;
    const has = name => shenSha.some(hit => hit.name === name);
    const names = [
      ...(has('驿马') && has('空亡') ? [shenShaPlacementNames.horseVoid] : []),
      ...(has('华盖') && has('空亡') ? [shenShaPlacementNames.canopyVoid] : []),
      ...(position === 'day' && has('驿马') ? [shenShaPlacementNames.wifeHorse] : []),
    ];
    return names.map(name => ({ name, ...placement }));
  });
}
export function baziShenShaPlacementEvidence(facts) {
  return placementEvidence(verifiedShenShaPlacements(facts));
}
export function baziShenShaPlacementFacts(facts) {
  const placements = verifiedShenShaPlacements(facts);
  const names = new Set(placementEvidence(placements).map(row => row.name));
  const hasHorseFrom = (position, source) => placements.find(row => row.position === position)
    ?.shenSha.some(hit => hit.name === '驿马' && hit.sourcePillars.includes(source));
  if (hasHorseFrom('year', 'day') && hasHorseFrom('day', 'year')) names.add(shenShaPlacementNames.mutualHorses);
  return [...names].map(name => ({ kind: 'bazi_natal_configuration', name }));
}

const sources = new Map([
  ['yhzp-v3-c087-p006-003', {
    hash: '0df30b03103463478ace209d4643a99ff4d8f3b02d8d5e85f45951f087870b5e',
    name: shenShaPlacementNames.mutualHorses, text: '交馳驛馬，别土離鄉',
    condition: '取年支与日支分别起驿马，实际互为马位',
    coordinates: ['寅申', '申寅', '巳亥', '亥巳'].map(([year, day]) => [
      { kind: 'branch', position: 'year', branch: year }, { kind: 'branch', position: 'day', branch: day },
    ]),
  }],
  ['yhzp-v3-c131-p002-001', { hash: 'f80c0d875b572102c393af255009c844699287ebb07804d51043e03e357ce93a', name: shenShaPlacementNames.wifeHorse }],
  ['yhzp-v3-c131-p002-004', { hash: 'd05916a88ed3599719db1db006bd432bbb6d3825065475934084b772c78c87f8', name: shenShaPlacementNames.horseVoid }],
  ['yhzp-v3-c137-p009-002', { hash: '5cb67aef28a293e3f01246b3bde1a0d8bb316ac7b74fdcb61fb9a55e058a6d41', name: shenShaPlacementNames.canopyVoid }],
  ['yhzp-v4-c040-p006-001', { hash: 'e7e6237f48578e7cbcbc16da4d8488771fdc0dec2e0f1847c2ba3260bdb28aa5', name: shenShaPlacementNames.canopyVoid, text: '華蓋逢空，偏宜僧道' }],
]);
function reviewedSource(claim) {
  const spec = sources.get(claim.id);
  if (!spec) return undefined;
  const hash = createHash('sha256').update(JSON.stringify({ source: claim.source, conditions: claim.conditions, evidence: claim.evidence })).digest('hex');
  return hash === spec.hash ? spec : null;
}
const input = (name, coordinates = []) => normalizeRuleInput('bazi', {
  required: [{ kind: 'bazi_natal_configuration', name }, ...coordinates],
});
export function compileBaziShenShaPlacementSource(claim) {
  const spec = reviewedSource(claim);
  if (spec === undefined) return undefined;
  if (!spec) return { reason: 'source_review_required', reviewNote: '本条神煞落柱转换所据出处、条件或原句已变化，须重新核对，不沿用旧映射。' };
  return spec.text ? { reason: 'unmapped_condition', condition: spec.condition ?? '仅华盖逢空分句接入，学堂遇贵的取法仍待核' }
    : { inputs: [input(spec.name)], compiler: baziShenShaPlacementProfile };
}
export function baziShenShaPlacementPassages(claim) {
  const spec = reviewedSource(claim);
  return spec?.text && claim.evidence.original_text.includes(spec.text)
    ? [{ text: spec.text, inputs: (spec.coordinates ?? [[]]).map(coordinates => input(spec.name, coordinates)),
      conditionCompiler: baziShenShaPlacementProfile }] : [];
}
