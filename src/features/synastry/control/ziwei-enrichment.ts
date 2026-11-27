import type { ChartFacts, Evidence } from '../model/comparison';
import { compareZiweiDetails, knownPalaces, palaceAtOffset, palaceSectors } from './ziwei-facts';

type Chart = Extract<ChartFacts['ziwei'], { status: 'complete' }>;
const allStars = (palace: Chart['palaces'][number]) => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];

function natal(chart: Chart, person: 'A' | 'B'): Evidence[] {
  const direction = person === 'A' ? 'self_a' : 'self_b';
  const evidence: Evidence[] = [];
  const byBranch = knownPalaces(chart);
  for (const palace of byBranch.values()) {
    const { name: source, earthlyBranch: branch } = palace;
    const sources = [`${person} ${source} ${branch}`, `${person} 本命`] as const;
    const brightness = allStars(palace).flatMap(star =>
      star.brightness && star.brightnessProfile ? [star.name + '（' + star.brightness + '）'] : []);
    evidence.push({ rule: 'ziwei-natal-palace', direction, sources, observation: '本人宫位与原盘星曜',
      facts: { person, palace: source, branch, majorStars: palace.majorStars.map(({ name }) => name).join('、'),
        minorStars: palace.minorStars.map(({ name }) => name).join('、'),
        adjectiveStars: palace.adjectiveStars.map(({ name }) => name).join('、'),
        lifePalace: Number(branch === chart.lifePalaceBranch), bodyPalace: Number(branch === chart.bodyPalaceBranch),
        ...(brightness.length && { starBrightness: brightness.join('、') }) } });
    for (const star of allStars(palace)) {
      if (star.mutagen) evidence.push({ rule: 'ziwei-natal-transformation', direction, sources,
        observation: '本人原盘四化标记',
        facts: { person, palace: source, branch, star: star.name, marker: star.mutagen,
          ...(star.mutagenOrigin && { mutagenOrigin: star.mutagenOrigin }) } });
    }
    const opposite = palaceAtOffset(palace, byBranch, 6);
    if (palace.majorStars.length === 0 && opposite) {
      evidence.push({ rule: 'ziwei-empty-palace-context', direction,
        sources: [sources[0], `${person} ${opposite.name} ${opposite.earthlyBranch}`],
        observation: '本宫无主星，对宫主星仅作独立参照，不搬入本宫',
        facts: { person, source, sourceBranch: branch, majorCount: 0, target: opposite.name,
          targetBranch: opposite.earthlyBranch, targetMajorStars: opposite.majorStars.map(({ name }) => name).join('、') } });
    }
    const previous = palaceAtOffset(palace, byBranch, -1);
    const next = palaceAtOffset(palace, byBranch, 1);
    if (previous && next) evidence.push({ rule: 'ziwei-adjacent-palace-context', direction,
      sources: [`${person} ${previous.name} ${previous.earthlyBranch}`, `${person} ${next.name} ${next.earthlyBranch}`],
      observation: '目标宫两侧相邻宫位的原盘星曜，不直接判定夹格',
      facts: { person, palace: source, branch, previousPalace: previous.name, previousBranch: previous.earthlyBranch,
        previousStars: allStars(previous).map(({ name }) => name).join('、'), nextPalace: next.name,
        nextBranch: next.earthlyBranch, nextStars: allStars(next).map(({ name }) => name).join('、') } });
    for (const { target, geometry } of palaceSectors(palace, byBranch, [0, 4, 8, 6])) {
      evidence.push({ rule: 'ziwei-natal-sector', direction, sources: [sources[0], `${person} ${target.name} ${target.earthlyBranch}`],
        observation: `本人三方四正 · ${geometry.relation}`,
        facts: { person, source, target: target.name, ...geometry,
          sourceStars: allStars(palace).map(({ name }) => name).join('、'),
          targetStars: allStars(target).map(({ name }) => name).join('、') } });
    }
  }
  for (const { facts } of compareZiweiDetails(chart, chart, person).evidence) {
    if (!Object.hasOwn(facts, 'heavenlyStem')) continue;
    evidence.push({ rule: 'ziwei-natal-flight', direction, sources: [`${person} ${facts.source}`, `${person} ${facts.nativeLanding}`],
      observation: '本人宫干飞化与落宫',
      facts: { person, source: facts.source, sourceBranch: facts.sourceBranch, heavenlyStem: facts.heavenlyStem,
        star: facts.star, marker: facts.marker, target: facts.nativeLanding, targetBranch: facts.branch } });
    if (facts.source !== facts.nativeLanding) continue;
    const palace = typeof facts.sourceBranch === 'string' ? byBranch.get(facts.sourceBranch) : undefined;
    if (!palace) continue;
    evidence.push({ rule: 'ziwei-palace-self-transformation', direction,
      sources: [`${person} ${palace.name} 宫干${facts.heavenlyStem}`, `${person} ${palace.name} ${facts.star}`],
      observation: '宫干四化表所指星曜就在本宫', facts: { person, palace: palace.name, branch: palace.earthlyBranch,
        heavenlyStem: facts.heavenlyStem, star: facts.star, marker: facts.marker } });
    const native = allStars(palace).find(({ name }) => name === facts.star);
    if (native?.mutagen) evidence.push({ rule: 'ziwei-native-self-transformation-coexistence', direction,
      sources: [`${person} ${palace.name} 本命标记`, `${person} ${palace.name} 宫干自化`],
      observation: '同星原盘四化标记与宫干自化并存，来源分别保留',
      facts: { person, palace: palace.name, branch: palace.earthlyBranch, star: facts.star,
        natalMarker: native.mutagen, flightMarker: facts.marker, heavenlyStem: facts.heavenlyStem,
        ...(native.mutagenOrigin && { mutagenOrigin: native.mutagenOrigin }) } });
  }
  return evidence;
}

export function enrichZiwei(a: ChartFacts, b: ChartFacts): Evidence[] {
  const evidence = [
    ...(a.ziwei.status === 'complete' ? natal(a.ziwei, 'A') : []),
    ...(b.ziwei.status === 'complete' ? natal(b.ziwei, 'B') : []),
  ];
  for (const [source, target, person] of [[a, b, 'A'], [b, a, 'B']] as const) {
    const direction = person === 'A' ? 'a_to_b' : 'b_to_a';
    if (target.ziwei.status !== 'complete') continue;
    const byBranch = knownPalaces(target.ziwei);
    if (source.ziwei.status === 'complete' && source.ziwei.rulesetVersion === target.ziwei.rulesetVersion) {
      for (const palace of knownPalaces(source.ziwei).values()) {
        const receiving = byBranch.get(palace.earthlyBranch);
        if (!receiving) continue;
        for (const [category, stars] of [['major', palace.majorStars], ['minor', palace.minorStars],
          ['adjective', palace.adjectiveStars]] as const) {
          for (const star of stars) evidence.push({ rule: 'ziwei-star-overlay', direction,
            sources: [`${person} ${palace.name} ${star.name}`, `${person === 'A' ? 'B' : 'A'} ${receiving.name}`],
            observation: '星曜原盘位置与接收方同支宫位',
            facts: { source: palace.name, target: receiving.name, branch: palace.earthlyBranch,
              star: star.name, category, ...(star.mutagen ? { marker: star.mutagen } : {}) } });
        }
      }
    }
    const year = source.bazi.status !== 'unavailable'
      ? source.bazi.pillars.find(({ position }) => position === 'year') : undefined;
    const landing = year?.branch ? byBranch.get(year.branch) : undefined;
    if (year?.stem && year.branch && landing) {
      evidence.push({ rule: 'ziwei-birth-year-overlay', direction,
        sources: [`${person} 八字年柱 ${year.stem}${year.branch}`, `${person === 'A' ? 'B' : 'A'} ${landing.name}`],
        observation: '对方年支在接收方盘内定位',
        facts: { yearStem: year.stem, yearBranch: year.branch, target: landing.name, projectionAnchor: 'confirmed-bazi-year-branch' } });
    }
  }
  return evidence;
}
