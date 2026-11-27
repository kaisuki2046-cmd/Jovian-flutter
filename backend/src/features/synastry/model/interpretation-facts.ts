import type { InterpretationQuery, System } from './interpretation';
import { algorithmDefinitions } from './algorithm-profiles';

const branchPair = 'aBranch bBranch aPosition bPosition';
const stemPair = 'aStem bStem aPosition bPosition';
const strength = 'aMonthRelation bMonthRelation aRootCount bRootCount aMainQiRoots bMainQiRoots aVisibleSupportCount bVisibleSupportCount';
const aspect = 'angle degrees deviation orb';
const longitudes = 'aLongitude bLongitude';

// A registry of fields emitted by compare.ts and the three *-facts.ts files.
export const factFields = {
  bazi: {
    'bazi-cross-year-month': branchPair,
    'branch-union': branchPair, 'branch-opposition': branchPair,
    'branch-harm': branchPair, 'branch-break': branchPair,
    'branch-punishment': `${branchPair} kind`,
    'branch-group': `kind combination element formation aBranches bBranches aPositions bPositions ${strength}`,
    'day-stem-elements': 'aStem bStem relation',
    'relative-ten-god': 'observed reference label',
    'stem-combination': `${stemPair} pair combinationElement ${strength}`,
    'stem-clash': `${stemPair} ${strength}`,
    'cross-pillar-ten-god': 'position observed reference label layer rank',
    'cross-branch-natal-marker': 'name branch sourcePosition targetPosition sourcePillars',
    'day-master-strength-context': `${strength} aDayStem bDayStem aDayElement bDayElement aMonthBranch bMonthBranch aMonthMainStem bMonthMainStem aRootPositions bRootPositions aVisibleSupportPositions bVisibleSupportPositions`,
  },
  ziwei: {
    'ziwei-palace-by-branch': 'source target branch',
    'ziwei-transformation-by-branch': 'source target branch star marker',
    'ziwei-cross-palace-sector': 'source target sourceBranch targetBranch relation offset sourceMajorStars targetMajorStars sourceMinorStars targetMinorStars',
    'ziwei-palace-stem-flight-overlay': 'source sourceBranch heavenlyStem marker star nativeLanding branch target',
  },
  western: {
    'western-signs': 'planet aSign bSign',
    'western-luminary-sign-aspect': 'aBody bBody aSign bSign angle',
    'western-ascendant-sign-comparison': `${longitudes} aAscSign bAscSign sameSign`,
    'western-four-places-by-sign': 'aSunSign bSunSign aMoonSign bMoonSign aAscSign bAscSign aFortuneSign bFortuneSign sameSignCount',
    'western-whole-sign-overlay': 'planet longitude house targetAscendant',
    'western-matching-planet-angle': `planet degrees ${longitudes}`,
    'western-cross-aspect': `aPlanet bPlanet ${longitudes} ${aspect}`,
    'western-sun-saturn-contact': `aPlanet bPlanet ${longitudes} ${aspect}`,
    'western-planet-to-axis': `planet axis longitude axisLongitude ${aspect}`,
    'western-axis-aspect': `aAxis bAxis ${longitudes} ${aspect}`,
    'western-house-ruler-overlay': 'house sign ruler longitude targetHouse targetAscendant rulership',
    'western-house-ruler-aspect': `house sign ruler longitude targetPlanet targetLongitude rulership ${aspect}`,
    'western-ruler-to-ruler': `aHouse bHouse aSign bSign aRuler bRuler ${longitudes} rulership ${aspect}`,
  },
};

export function registeredFactFields(system: System, rule: string) {
  const rules: Readonly<Record<string, string>> = factFields[system];
  const fields = rules && Object.hasOwn(rules, rule) ? rules[rule]
    : algorithmDefinitions.find((item) => item.system === system && item.rule === rule)?.fields;
  return fields?.split(' ');
}

export function factTypeId(system: System, rule: string) {
  return `${system}:${rule}`;
}

// FNV-1a/64 over UTF-16 code units. The ID identifies a fact, not either participant.
export function identifyInterpretationFact(typeId: string, direction: string, sources: readonly string[],
  facts: Readonly<Record<string, string | number>>) {
  const values = Object.entries(facts).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const identity = JSON.stringify([typeId, direction, sources, values]);
  let hash = 14695981039346656037n;
  for (let index = 0; index < identity.length; index++) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(identity.charCodeAt(index))) * 1099511628211n);
  }
  return { identity, id: `${typeId}:${hash.toString(16).padStart(16, '0')}` };
}

export function factPatternId({ system, rule, parameters }: Pick<InterpretationQuery, 'system' | 'rule'>
  & { parameters: Readonly<Record<string, unknown>> }) {
  const type = factTypeId(system, rule);
  if (type === 'western:western-cross-aspect') {
    const { aPlanet, bPlanet, angle } = parameters;
    if (typeof aPlanet === 'string' && typeof bPlanet === 'string' && typeof angle === 'number') {
      return `${type}:${aPlanet}:${bPlanet}:${angle}`;
    }
  }
  return undefined;
}
