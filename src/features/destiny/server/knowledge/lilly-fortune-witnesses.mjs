import { createHash } from 'node:crypto';
import { lillyHouseRuleset } from '../../control/lilly-houses.mjs';
import { lillyAspectAngles, lillyPartileDistance } from './lilly-aspects.mjs';
import { lillyDignityBodies } from './lilly-dignities.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const lillyFortuneWitnessProfile = 'lilly-1647-fortune-testimonies-552-553-v1';
const fixedSects = { Sun: 'day', Jupiter: 'day', Saturn: 'day', Moon: 'night', Venus: 'night', Mars: 'night' };
const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const malefics = ['Saturn', 'Mars'];
const aspects = ['sextile', 'trine'];
const targets = ['lot', 'ruler'];
const governor = planet => ({ kind: 'western_lilly_fortune_governor', planet });
const testimony = (planet, sect, target, aspect) => ({ kind: 'western_lilly_fortune_testimony', planet, sect, target, aspect });
const dominion = planet => ({ kind: 'western_lilly_fortune_malefic_dominion', planet });

export function isLillyFortuneWitnessFact(fact) {
  if (!lillyDignityBodies.includes(fact.planet)) return false;
  if (fact.kind === 'western_lilly_fortune_governor') return true;
  if (fact.kind === 'western_lilly_fortune_malefic_dominion') return malefics.includes(fact.planet);
  return fact.kind === 'western_lilly_fortune_testimony' && targets.includes(fact.target) && aspects.includes(fact.aspect)
    && (fact.planet === 'Mercury' ? ['day', 'night'].includes(fact.sect) : fixedSects[fact.planet] === fact.sect);
}

export function lillyFortuneWitnessFacts(facts, fortune, solar, cellsAt) {
  if (!fortune) return [];
  const { longitude, ruler } = fortune;
  const rulerLongitude = lillyPlanetPosition(facts, ruler)?.longitude;
  if (!Number.isFinite(rulerLongitude)) return [];

  const witnesses = [governor(ruler)];
  const lotCells = malefics.includes(ruler) && cellsAt?.(signs[Math.floor(longitude / 30)], Math.floor(longitude % 30));
  if (lotCells && lotCells.some(cell => cell.dimension === 'domicile' && cell.body === ruler.toLowerCase())
    && lotCells.some(cell => cell.dimension === 'term' && cell.body === ruler.toLowerCase())) {
    witnesses.push(dominion(ruler));
  }

  // The quoted Ptolemy text uses sect. Mercury's solar phase is measurable.
  // A conjunction or opposition to the Sun leaves this classification open.
  const mercury = solar.find(fact => fact.selector === 'mercury' && fact.matches
    && ['oriental', 'occidental'].includes(fact.condition));
  const mercurySect = mercury && (mercury.condition === 'oriental' ? 'day' : 'night');
  const sects = { ...fixedSects, Mercury: mercurySect };
  const sect = sects[ruler];
  if (!sect) return witnesses;
  for (const planet of lillyDignityBodies) {
    if (planet === ruler || sects[planet] !== sect) continue;
    const position = lillyPlanetPosition(facts, planet)?.longitude;
    if (!Number.isFinite(position)) continue;
    for (const [target, reference] of [['lot', longitude], ['ruler', rulerLongitude]]) {
      const separation = lillyPartileDistance(position, reference);
      const aspect = aspects.find(name => lillyAspectAngles[name] === separation);
      if (aspect) witnesses.push(testimony(planet, sect, target, aspect));
    }
  }
  return witnesses;
}

const testimonyGroups = () => targets.flatMap(target => aspects.map(aspect => ({
  required: [],
  anyOf: lillyDignityBodies.flatMap(planet => (planet === 'Mercury' ? ['day', 'night'] : [fixedSects[planet]])
    .map(sect => [testimony(planet, sect, target, aspect)])),
})));
const reviewed = new Map([
  ['duration-p011', ['d4f935f839334ca963fa44d11715b1ce4f67cec27260f0b14e5c29752a70740e', testimonyGroups]],
  ['duration-p012', ['f3e8979a844ce129f33925aa655ea0a846293da492304315f91c6ab887898219', () =>
    malefics.map(planet => ({ required: [dominion(planet)] }))]],
  ...[
    ['Saturn', 'd2d1e1a4dddeda47e394fefe4dd93e167894bcdff43fb38923addf77e82a4c22'],
    ['Jupiter', '33f2089ae8baf898b8d5920863edb2e78fa482a6b5ca894b92363ca7d78a4405'],
    ['Mars', '137704e7f11ef181e1f1956e56eab5681f9740b442c08f348db3967ecfd347d8'],
    ['Venus', '32363cec1c4c9437870f74d3a65ed9e2ec234e985cd178a7bc6daed0056ca8b9'],
    ['Mercury', '2fa775e8be0dbcb6ebdc2ab6beef83b0150a6ecc6626836769617a1e4e16e7d8'],
  ].map(([planet, digest], index) => ['sources-p0' + (30 + index), [digest, () => [{ required: [governor(planet)] }]]]),
]);

export function compileLillyFortuneWitness(claim) {
  const key = /^astro-lilly-v3-wealth-((?:duration|sources)-p\d{3})-001$/u.exec(claim.id)?.[1];
  const spec = reviewed.get(key);
  if (!spec) return undefined;
  const [expected, groups] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== expected) return { reason: 'source_review_required', reviewNote: '莉莉所引福点条文有改动，须重新复核。' };
  const inputs = groups().map(group => normalizeRuleInput('western', {
    ...group, required: [{ kind: 'western_lilly_ruleset', ruleset: lillyHouseRuleset }, ...group.required],
  }));
  return { compiler: lillyFortuneWitnessProfile, inputs, remainingAlternatives: 1 };
}

export function lillyFortuneWitnessProof(conditions, observed) {
  const matched = [conditions.required, ...conditions.alternatives].flat();
  if (matched.some(fact => fact.kind === 'western_lilly_fortune_governor')) return conditions;
  const ruler = observed.find(fact => fact.kind === 'western_lilly_fortune_governor');
  return ruler ? { ...conditions, required: [...conditions.required, ruler] } : conditions;
}
