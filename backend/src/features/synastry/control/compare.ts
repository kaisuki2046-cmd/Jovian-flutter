import { LunarUtil } from 'lunar-javascript';
import type { ChartFacts, ComparisonSection, ComparisonSubject, Direction, Evidence } from '../model/comparison';
import { comparisonRulesVersion } from '../model/comparison';
import { branchOppositions, branchUnions, compareBaZiDetails, pillarLabels as pillars } from './bazi-facts';
import { compareZiweiDetails, knownPalaces } from './ziwei-facts';
import { compareClassicalPlaces, compareWesternDetails, findAspect, knownLongitudes, knownSigns, measureLongitudes,
  planetLabels as planets, signIndex as sign } from './western-facts';
import { enrichComparison } from './enrich-comparison';

export { comparisonRulesVersion } from '../model/comparison';

export function hasUnknownBirthTime(chart: ChartFacts | (ChartFacts & { timeKnown: boolean })) {
  return ('timeKnown' in chart && chart.timeKnown === false)
    || chart.bazi.status === 'partial' || chart.western.status === 'partial'
    || [chart.bazi, chart.ziwei, chart.western].some((section) =>
      section.status === 'unavailable' && section.reason === 'ambiguous_time');
}

const elements = ['木', '火', '土', '金', '水'];
const stems = '甲乙丙丁戊己庚辛壬癸';
const zodiac = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
type CompleteZiwei = Extract<ChartFacts['ziwei'], { status: 'complete' }>;
type CompleteWestern = Extract<ChartFacts['western'], { status: 'complete' }>;

function compareBaZi(a: ChartFacts['bazi'], b: ChartFacts['bazi']): ComparisonSection {
  const section: ComparisonSection = { system: 'bazi', versions: [a.rulesetVersion, b.rulesetVersion], evidence: [], coverage: 'complete' };
  if (a.status === 'unavailable' || b.status === 'unavailable') {
    return { ...section, coverage: 'unavailable', limitation: '至少一方没有可用的八字盘面。' };
  }
  if (a.rulesetVersion !== b.rulesetVersion) {
    return { ...section, coverage: 'unavailable', limitation: '双方八字排盘口径不同，请按同一版本重算。' };
  }
  if ([a, b].some(({ status, pillars }) => status === 'partial'
    || new Set(pillars.filter(({ stem, branch }) => stem && branch).map(({ position }) => position)).size !== 4)) {
    section.coverage = 'limited';
    section.limitation = '只比较双方已确认的干支。';
  }
  const aStem = a.pillars.find(({ position }) => position === 'day')?.stem;
  const bStem = b.pillars.find(({ position }) => position === 'day')?.stem;
  const aElement = aStem ? Math.floor(stems.indexOf(aStem) / 2) : -1;
  const bElement = bStem ? Math.floor(stems.indexOf(bStem) / 2) : -1;
  if (aStem && bStem && aElement >= 0 && bElement >= 0) {
    const delta = (bElement - aElement + 5) % 5;
    const relations = ['双方同五行', 'A 方五行生 B 方', 'A 方五行克 B 方', 'B 方五行克 A 方', 'B 方五行生 A 方'];
    const directions: Direction[] = ['mutual', 'a_to_b', 'a_to_b', 'b_to_a', 'b_to_a'];
    section.evidence.push({ rule: 'day-stem-elements', direction: directions[delta],
      sources: [`A 日干 ${aStem}（${elements[aElement]}）`, `B 日干 ${bStem}（${elements[bElement]}）`],
      observation: relations[delta], facts: { aStem, bStem, relation: delta } });
    for (const [observed, reference, from, to, direction] of [
      [aStem, bStem, 'A', 'B', 'a_to_b'], [bStem, aStem, 'B', 'A', 'b_to_a'],
    ] as const) {
      const label = LunarUtil.SHI_SHEN[reference + observed];
      if (label) section.evidence.push({ rule: 'relative-ten-god', direction,
        sources: [`${from} 日干 ${observed}`, `${to} 日干 ${reference}`],
        observation: `相对十神 · ${label}`, facts: { observed, reference, label } });
    }
  }
  for (const left of a.pillars) {
    for (const right of b.pillars) {
      const aBranch = left.branch;
      const bBranch = right.branch;
      if (!aBranch || !bBranch) continue;
      if ((left.position === 'year' && right.position === 'month')
        || (left.position === 'month' && right.position === 'year')) {
        section.evidence.push({ rule: 'bazi-cross-year-month', direction: 'mutual',
          sources: [`A ${pillars[left.position]} ${aBranch}`, `B ${pillars[right.position]} ${bBranch}`],
          observation: '双方年月地支对照',
          facts: { aBranch, bBranch, aPosition: left.position, bPosition: right.position } });
      }
      if (aBranch === bBranch) continue;
      const matches = (pair: string) => pair.includes(aBranch) && pair.includes(bBranch);
      const union = branchUnions.some(matches);
      if (!union && !branchOppositions.some(matches)) continue;
      section.evidence.push({ rule: union ? 'branch-union' : 'branch-opposition', direction: 'mutual',
        sources: [`A ${pillars[left.position]} ${left.branch}`, `B ${pillars[right.position]} ${right.branch}`],
        observation: union ? '地支六合' : '地支六冲',
        facts: { aBranch, bBranch, aPosition: left.position, bPosition: right.position } });
    }
  }
  const details = compareBaZiDetails(a, b);
  section.evidence.push(...details.evidence);
  const unknownMarkers = [a, b].some(({ pillars }) => pillars.some((pillar) => !pillar.shenShaComplete));
  section.unavailableRules = [
    ...(!details.strengthAvailable ? ['day-master-strength-context', 'cross-pillar-ten-god'] : []),
    ...(unknownMarkers ? ['cross-branch-natal-marker'] : []),
  ];
  section.coverageNotes = [
    ...(!details.strengthAvailable ? ['需要双方完整四柱与藏干，才能完整对照日主强弱和十神条件。'] : []),
    ...(unknownMarkers ? ['部分本命神煞缺少已确认的标记。'] : []),
  ];
  return section;
}

function compareZiwei(a: ChartFacts['ziwei'], b: ChartFacts['ziwei']): ComparisonSection {
  const section: ComparisonSection = { system: 'ziwei', versions: [a.rulesetVersion, b.rulesetVersion], evidence: [], coverage: 'complete' };
  if (a.status !== 'complete' || b.status !== 'complete') {
    return { ...section, coverage: 'unavailable', limitation: '双方均有可确定的十二宫盘时，才能按地支对照宫位。' };
  }
  if (a.rulesetVersion !== b.rulesetVersion) {
    return { ...section, coverage: 'unavailable', limitation: '双方紫微安星口径不同，请按同一版本重算。' };
  }
  const aPalaces = knownPalaces(a);
  const bPalaces = knownPalaces(b);
  if (aPalaces.size !== 12 || bPalaces.size !== 12) {
    section.coverage = 'limited';
    section.limitation = '仅对照双方可唯一定位的紫微宫位。';
  }

  function mapPalaces(source: CompleteZiwei, sourcePalaces: ReturnType<typeof knownPalaces>,
    targetPalaces: ReturnType<typeof knownPalaces>, from: 'A' | 'B', to: 'A' | 'B') {
    const direction = from === 'A' ? 'a_to_b' : 'b_to_a';
    const evidence: Evidence[] = [];
    for (const [name, branch] of [['命宫', source.lifePalaceBranch], ['身宫', source.bodyPalaceBranch]]) {
      const match = sourcePalaces.has(branch) ? targetPalaces.get(branch) : undefined;
      if (!match) continue;
      evidence.push({ rule: 'ziwei-palace-by-branch', direction,
        sources: [`${from} ${name} · ${branch}`, `${to} ${match.name} · ${match.earthlyBranch}`],
        observation: '按宫位地支对照', facts: { source: name, target: match.name, branch } });
    }
    for (const palace of sourcePalaces.values()) {
      const match = targetPalaces.get(palace.earthlyBranch);
      if (!match) continue;
      for (const star of [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars]) {
        if (!star.mutagen) continue;
        evidence.push({ rule: 'ziwei-transformation-by-branch', direction,
          sources: [`${from} ${palace.name} · ${star.name}`, `${to} ${match.name} · ${match.earthlyBranch}`],
          observation: `原盘标记：化${star.mutagen}`,
          facts: { source: palace.name, target: match.name, branch: palace.earthlyBranch, star: star.name, marker: star.mutagen } });
      }
    }
    return evidence;
  }

  section.evidence.push(...mapPalaces(a, aPalaces, bPalaces, 'A', 'B'), ...mapPalaces(b, bPalaces, aPalaces, 'B', 'A'));
  const left = compareZiweiDetails(a, b, 'A');
  const right = compareZiweiDetails(b, a, 'B');
  section.evidence.push(...left.evidence, ...right.evidence);
  if (!left.flightsAvailable || !right.flightsAvailable) {
    section.unavailableRules = ['ziwei-palace-stem-flight-overlay'];
    section.coverageNotes = ['部分或全部宫干飞化落点暂不可用，需完整宫干、同口径四化及星曜落点。'];
  }
  return section;
}

function compareWestern(left: ChartFacts['western'], right: ChartFacts['western']): ComparisonSection {
  const section: ComparisonSection = { system: 'western', versions: [left.rulesetVersion, right.rulesetVersion], evidence: [], coverage: 'complete' };
  if (left.status === 'unavailable' || right.status === 'unavailable') {
    return { ...section, coverage: 'unavailable', limitation: '至少一方没有可用的西方星盘。' };
  }
  if (left.rulesetVersion !== right.rulesetVersion || left.zodiac !== right.zodiac || left.houseSystem !== right.houseSystem) {
    return { ...section, coverage: 'unavailable', limitation: '双方西占的黄道、宫制或排盘规则不同。' };
  }
  if (left.status !== 'complete' || right.status !== 'complete') {
    section.coverage = 'limited';
    section.limitation = '出生时刻不完整，仅对照已确认的天体星座。';
    const rightSigns = knownSigns(right);
    for (const [planet, aSign] of knownSigns(left)) {
      const bSign = rightSigns.get(planet);
      if (bSign === undefined) continue;
      const name = planets[planet];
      section.evidence.push({ rule: 'western-signs', direction: 'mutual',
        sources: [`A ${name} · ${zodiac[aSign]}`, `B ${name} · ${zodiac[bSign]}`], observation: '星座对照',
        facts: { planet, aSign, bSign } });
    }
    return section;
  }
  const a = knownLongitudes(left);
  const b = knownLongitudes(right);
  if ([a, b].some(({ positions }) => positions.length !== Object.keys(planets).length)) {
    section.coverage = 'limited';
    section.limitation = '仅对照盘面中可确认唯一黄经的天体。';
  }

  function overlays(source: CompleteWestern, target: CompleteWestern, from: 'A' | 'B', to: 'A' | 'B'): Evidence[] {
    if (!Number.isFinite(target.ascendant)) return [];
    return source.positions.map(({ planet, longitude }) => {
      const house = (sign(longitude) - sign(target.ascendant) + 12) % 12 + 1;
      return { rule: 'western-whole-sign-overlay', direction: from === 'A' ? 'a_to_b' : 'b_to_a',
        sources: [`${from} ${planets[planet]} · ${longitude.toFixed(2)}°`, `${to} 第 ${house} 宫`],
        observation: '热带黄道整宫制落宫', facts: { planet, longitude, house, targetAscendant: target.ascendant } };
    });
  }

  for (const left of a.positions) {
    const right = b.positions.find(({ planet }) => planet === left.planet);
    if (!right) continue;
    const measurement = measureLongitudes(left.longitude, right.longitude);
    if (!measurement) continue;
    const { firstLongitude, secondLongitude, degrees } = measurement;
    const name = planets[left.planet];
    section.evidence.push({ rule: 'western-matching-planet-angle', direction: 'mutual',
      sources: [`A ${name} · ${left.longitude.toFixed(2)}°`, `B ${name} · ${right.longitude.toFixed(2)}°`],
      observation: `同名天体角距 ${degrees.toFixed(2)}°`,
      facts: { planet: left.planet, aLongitude: firstLongitude, bLongitude: secondLongitude, degrees } });
  }
  for (const left of a.positions) {
    for (const right of b.positions) {
      const match = findAspect(left.longitude, right.longitude);
      if (!match) continue;
      const { degrees, deviation, orb } = match.facts;
      const sources = [`A ${planets[left.planet]} · ${left.longitude.toFixed(2)}°`, `B ${planets[right.planet]} · ${right.longitude.toFixed(2)}°`] as const;
      const facts = { aPlanet: left.planet, bPlanet: right.planet, aLongitude: match.firstLongitude,
        bLongitude: match.secondLongitude, ...match.facts };
      section.evidence.push({ rule: 'western-cross-aspect', direction: 'mutual',
        sources,
        observation: `${match.label} · 角距 ${degrees.toFixed(2)}° · 偏差 ${deviation.toFixed(2)}° / 容许 ${orb}°`,
        facts });
      const sunSide = left.planet === 'Sun' && right.planet === 'Saturn' ? 'A'
        : left.planet === 'Saturn' && right.planet === 'Sun' ? 'B' : null;
      if (sunSide && match.facts.angle === 0) {
        section.evidence.push({ rule: 'western-sun-saturn-contact', direction: sunSide === 'A' ? 'a_to_b' : 'b_to_a',
          sources, observation: `${sunSide} 方太阳合相对方土星`, facts });
      }
    }
  }
  section.evidence.push(...overlays(a, b, 'A', 'B'), ...overlays(b, a, 'B', 'A'));
  section.evidence.push(...compareClassicalPlaces(a, b));
  const details = compareWesternDetails(a, b);
  section.evidence.push(...details.evidence);
  section.unavailableRules = [
    ...(!details.axesAvailable ? ['western-planet-to-axis', 'western-axis-aspect'] : []),
    ...(!details.rulersAvailable ? ['western-house-ruler-overlay', 'western-house-ruler-aspect', 'western-ruler-to-ruler'] : []),
    ...(!Number.isFinite(a.ascendant) || !Number.isFinite(b.ascendant) ? ['western-whole-sign-overlay'] : []),
  ];
  section.coverageNotes = [
    ...(!details.axesAvailable ? ['部分轴点缺少有效坐标。'] : []),
    ...(!details.rulersAvailable ? ['部分宫主星缺少有效坐标。'] : []),
  ];
  return section;
}

export function compareCharts(a: ComparisonSubject, b: ComparisonSubject) {
  if (b.mode === 'account_owner' || a.mode === 'invited_account'
    || (a.mode === 'manual_subject' && b.mode !== 'manual_subject')) {
    throw new Error('请选择本人盘面及一份对方盘面。');
  }
  if (a.chart === b.chart || ('snapshotId' in a.chart && 'snapshotId' in b.chart
    && a.chart.snapshotId === b.chart.snapshotId)) {
    throw new Error('请分别选择 A 方和 B 方盘面。');
  }
  return {
    rulesVersion: comparisonRulesVersion, a, b,
    sections: enrichComparison(a.chart, b.chart, [
      compareBaZi(a.chart.bazi, b.chart.bazi), compareZiwei(a.chart.ziwei, b.chart.ziwei),
      compareWestern(a.chart.western, b.chart.western)]),
  };
}
