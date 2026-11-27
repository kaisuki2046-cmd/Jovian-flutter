import type { ChartFacts, Evidence } from '../model/comparison';

type Chart = Extract<ChartFacts['ziwei'], { status: 'complete' }>;
type Palace = Chart['palaces'][number];
export const ziweiBranches = '子丑寅卯辰巳午未申酉戌亥';
const sectorRelations = { 0: '同支', 4: '顺四支三合', 6: '对宫', 8: '逆四支三合' } as const;
type SectorOffset = keyof typeof sectorRelations;
const stars = (palace: Palace) => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
const branchIndex = (branch: string) => typeof branch === 'string' && branch.length === 1 ? ziweiBranches.indexOf(branch) : -1;

export function knownPalaces(chart: Chart) {
  const names = new Map<string, number>();
  const branches = new Map<string, number>();
  for (const { name, earthlyBranch } of chart.palaces) {
    names.set(name, (names.get(name) ?? 0) + 1);
    branches.set(earthlyBranch, (branches.get(earthlyBranch) ?? 0) + 1);
  }
  const result = new Map<string, Palace>();
  for (const palace of chart.palaces) {
    if (names.get(palace.name) !== 1 || branches.get(palace.earthlyBranch) !== 1 || branchIndex(palace.earthlyBranch) < 0
      || typeof palace.name !== 'string' || !palace.name.trim() || !Array.isArray(palace.majorStars)
      || !Array.isArray(palace.minorStars) || !Array.isArray(palace.adjectiveStars)) continue;
    result.set(palace.earthlyBranch, palace);
  }
  return result;
}

export function palaceAtOffset(source: Palace, targets: ReadonlyMap<string, Palace>, offset: number) {
  const index = branchIndex(source.earthlyBranch);
  return index < 0 ? undefined : targets.get(ziweiBranches[(index + offset + ziweiBranches.length) % ziweiBranches.length]);
}

export function palaceSectors(source: Palace, targets: ReadonlyMap<string, Palace>, offsets: readonly SectorOffset[]) {
  return offsets.flatMap((step) => {
    const target = palaceAtOffset(source, targets, step);
    if (!target) return [];
    const geometry = palaceSectorGeometry(source.earthlyBranch, target.earthlyBranch);
    return geometry ? [{ target, geometry }] : [];
  });
}

export function palaceSectorGeometry(sourceBranch: string, targetBranch: string) {
  const source = branchIndex(sourceBranch);
  const target = branchIndex(targetBranch);
  if (source < 0 || target < 0) return undefined;
  const offset = (target - source + ziweiBranches.length) % ziweiBranches.length;
  if (!Object.hasOwn(sectorRelations, offset)) return undefined;
  return { sourceBranch, targetBranch, offset, relation: sectorRelations[offset as SectorOffset] };
}

export function compareZiweiDetails(source: Chart, target: Chart, from: 'A' | 'B') {
  const to = from === 'A' ? 'B' : 'A';
  const direction = from === 'A' ? 'a_to_b' : 'b_to_a';
  const sourceByBranch = knownPalaces(source);
  const targetByBranch = knownPalaces(target);
  const nativeStars = new Map<string, Palace[]>();
  for (const palace of sourceByBranch.values()) {
    for (const name of new Set(stars(palace).map((star) => star.name))) {
      const matches = nativeStars.get(name) ?? [];
      matches.push(palace);
      nativeStars.set(name, matches);
    }
  }
  const evidence: Evidence[] = [];
  let flightsAvailable = sourceByBranch.size === ziweiBranches.length && targetByBranch.size === ziweiBranches.length;
  for (const palace of sourceByBranch.values()) {
    for (const { target: match, geometry } of palaceSectors(palace, targetByBranch, [0, 4, 6, 8])) {
      evidence.push({ rule: 'ziwei-cross-palace-sector', direction,
        sources: [`${from} ${palace.name} · ${palace.earthlyBranch}`, `${to} ${match.name} · ${match.earthlyBranch}`],
        observation: `三方四正对照 · ${geometry.relation}`,
        facts: { source: palace.name, target: match.name, ...geometry, sourceMajorStars: palace.majorStars.map(({ name }) => name).join('、'),
          targetMajorStars: match.majorStars.map(({ name }) => name).join('、'),
          sourceMinorStars: palace.minorStars.map(({ name }) => name).join('、'),
          targetMinorStars: match.minorStars.map(({ name }) => name).join('、') } });
    }
    const { heavenlyStem, stemTransformations } = palace;
    if (!heavenlyStem || !/^[甲乙丙丁戊己庚辛壬癸]$/.test(heavenlyStem)
      || stemTransformations?.length !== 4
      || !['禄', '权', '科', '忌'].every((marker) => stemTransformations.some((rule) => rule.marker === marker))) {
      flightsAvailable = false;
      continue;
    }
    for (const { marker, star } of stemTransformations) {
      const landings = nativeStars.get(star);
      const landing = landings?.length === 1 ? landings[0] : undefined;
      const match = landing && targetByBranch.get(landing.earthlyBranch);
      if (!landing || !match) { flightsAvailable = false; continue; }
      evidence.push({ rule: 'ziwei-palace-stem-flight-overlay', direction,
        sources: [`${from} ${palace.name}${heavenlyStem} · ${star}化${marker}入本盘${landing.name} ${landing.earthlyBranch}`,
          `${to} ${match.name} · ${match.earthlyBranch}`],
        observation: `宫干飞化落点对照 · ${star}化${marker}`,
        facts: { source: palace.name, sourceBranch: palace.earthlyBranch, heavenlyStem, marker, star,
          nativeLanding: landing.name, branch: landing.earthlyBranch, target: match.name } });
    }
  }
  return { evidence, flightsAvailable };
}
