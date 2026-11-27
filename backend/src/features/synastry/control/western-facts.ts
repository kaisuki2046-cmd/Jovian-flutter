import type { ChartFacts, Evidence } from '../model/comparison';

type Chart = Extract<ChartFacts['western'], { status: 'complete' }>;
type Western = Exclude<ChartFacts['western'], { status: 'unavailable' }>;
type Planet = Chart['positions'][number]['planet'];
export const planetLabels = {
  Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星',
  Jupiter: '木星', Saturn: '土星', Uranus: '天王星', Neptune: '海王星', Pluto: '冥王星',
} as const;
export const normalize = (angle: number) => ((angle % 360) + 360) % 360;
export const signIndex = (longitude: number) => Math.floor(normalize(longitude) / 30);
export const angularDistance = (a: number, b: number) => Math.abs(normalize(a - b + 180) - 180);
export const signAspect = (first: number, second: number) => angularDistance(first * 30, second * 30);
export const aspectComparisonEpsilon = 1e-9;
const aspects = [[0, 6, '合相'], [60, 4, '六合相'], [90, 5, '四分相'], [120, 5, '三分相'], [180, 6, '对分相']] as const;
const rulers: readonly Planet[] = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
export const rulership = 'traditional-domicile-v1';
export const traditionalSignRuler = (sign: number) => rulers[sign];

const canonicalLongitude = (longitude: number) => longitude >= 0 && longitude < 360 ? longitude : normalize(longitude);

function uniqueMeasurements<T extends { planet: Planet }>(positions: readonly T[], read: (item: T) => number | undefined) {
  const byPlanet = new Map<Planet, number | null>();
  for (const item of positions) {
    if (!Object.hasOwn(planetLabels, item.planet)) continue;
    const value = read(item);
    if (value === undefined) continue;
    const previous = byPlanet.get(item.planet);
    byPlanet.set(item.planet, previous === undefined || previous === value ? value : null);
  }
  return [...byPlanet].flatMap(([planet, value]) => value === null ? [] : [{ planet, value }]);
}

export function knownLongitudes(chart: Chart): Chart {
  const positions = uniqueMeasurements(chart.positions, ({ longitude }) => Number.isFinite(longitude) ? canonicalLongitude(longitude) : undefined)
    .map(({ planet, value }) => ({ planet, longitude: value }));
  const { ascendant, midheaven } = chart;
  return { ...chart, positions,
    ascendant: Number.isFinite(ascendant) ? canonicalLongitude(ascendant) : ascendant,
    midheaven: Number.isFinite(midheaven) ? canonicalLongitude(midheaven) : midheaven };
}

export function knownSigns(chart: Western) {
  return chart.status === 'complete'
    ? new Map(knownLongitudes(chart).positions.map(({ planet, longitude }) => [planet, signIndex(longitude)]))
    : new Map(uniqueMeasurements(chart.positions, ({ signIndex }) => Number.isInteger(signIndex) && signIndex >= 0 && signIndex < 12
      ? signIndex : undefined).map(({ planet, value }) => [planet, value]));
}

export function measureLongitudes(first: number, second: number) {
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  const firstLongitude = canonicalLongitude(first);
  const secondLongitude = canonicalLongitude(second);
  return { firstLongitude, secondLongitude, degrees: angularDistance(firstLongitude, secondLongitude) };
}

export function findAspect(first: number, second: number) {
  const measurement = measureLongitudes(first, second);
  if (!measurement) return null;
  const { firstLongitude, secondLongitude, degrees } = measurement;
  const match = aspects.find(([angle, orb]) => Math.abs(degrees - angle) <= orb + aspectComparisonEpsilon);
  if (!match) return null;
  const [angle, orb, label] = match;
  const deviation = Math.abs(degrees - angle);
  return { label, firstLongitude, secondLongitude, facts: { degrees, deviation, angle, orb } };
}

export function compareClassicalPlaces(a: Chart, b: Chart): Evidence[] {
  const luminaries = (chart: Chart) => ({
    Sun: chart.positions.find(({ planet }) => planet === 'Sun')?.longitude,
    Moon: chart.positions.find(({ planet }) => planet === 'Moon')?.longitude,
  });
  const left = luminaries(a);
  const right = luminaries(b);
  const evidence: Evidence[] = [];
  for (const [aBody, bBody] of [['Sun', 'Moon'], ['Moon', 'Sun']] as const) {
    const first = left[aBody];
    const second = right[bBody];
    if (first === undefined || second === undefined) continue;
    const aSign = signIndex(first);
    const bSign = signIndex(second);
    evidence.push({ rule: 'western-luminary-sign-aspect', direction: 'mutual',
      sources: ['A ' + planetLabels[aBody], 'B ' + planetLabels[bBody]], observation: '双盘日月星座角距',
      facts: { aBody, bBody, aSign, bSign, angle: signAspect(aSign, bSign) } });
  }
  const ascending = measureLongitudes(a.ascendant, b.ascendant);
  if (!ascending) return evidence;
  const aAscSign = signIndex(ascending.firstLongitude);
  const bAscSign = signIndex(ascending.secondLongitude);
  evidence.push({ rule: 'western-ascendant-sign-comparison', direction: 'mutual', observation: '双方上升星座对照',
    sources: ['A 上升点', 'B 上升点'], facts: { aLongitude: ascending.firstLongitude, bLongitude: ascending.secondLongitude,
      aAscSign, bAscSign, sameSign: Number(aAscSign === bAscSign) } });

  if (left.Sun === undefined || left.Moon === undefined || right.Sun === undefined || right.Moon === undefined) return evidence;
  // Tetrabiblos IV.2 and III.10 use the same directed Sun-to-Moon arc by day and by night.
  const aFortune = normalize(a.ascendant + left.Moon - left.Sun);
  const bFortune = normalize(b.ascendant + right.Moon - right.Sun);
  const aSunSign = signIndex(left.Sun);
  const bSunSign = signIndex(right.Sun);
  const aMoonSign = signIndex(left.Moon);
  const bMoonSign = signIndex(right.Moon);
  const aFortuneSign = signIndex(aFortune);
  const bFortuneSign = signIndex(bFortune);
  const sameSignCount = [[aSunSign, bSunSign], [aMoonSign, bMoonSign], [aAscSign, bAscSign], [aFortuneSign, bFortuneSign]]
    .filter(([first, second]) => first === second).length;
  evidence.push({ rule: 'western-four-places-by-sign', direction: 'mutual', observation: '双盘日月、上升及福点的星座对照',
    sources: ['A 日月、上升及福点', 'B 日月、上升及福点'],
    facts: { aSunSign, bSunSign, aMoonSign, bMoonSign, aAscSign, bAscSign, aFortuneSign, bFortuneSign, sameSignCount } });
  return evidence;
}

export function axes(chart: Chart) {
  return [
    { axis: 'ASC', label: '上升点', longitude: chart.ascendant },
    { axis: 'DSC', label: '下降点', longitude: Number.isFinite(chart.ascendant) ? normalize(chart.ascendant + 180) : NaN },
    { axis: 'MC', label: '天顶', longitude: chart.midheaven },
    { axis: 'IC', label: '天底', longitude: Number.isFinite(chart.midheaven) ? normalize(chart.midheaven + 180) : NaN },
  ].filter(({ longitude }) => Number.isFinite(longitude));
}

export function houseRulers(chart: Chart) {
  if (!Number.isFinite(chart.ascendant)) return [];
  return Array.from({ length: 12 }, (_, index) => {
    const sign = (signIndex(chart.ascendant) + index) % 12;
    const planet = traditionalSignRuler(sign);
    return { house: index + 1, sign, planet, longitude: chart.positions.find((position) => position.planet === planet)?.longitude };
  }).filter((item): item is typeof item & { longitude: number } => Number.isFinite(item.longitude));
}

function directional(source: Chart, target: Chart, from: 'A' | 'B'): Evidence[] {
  const to = from === 'A' ? 'B' : 'A';
  const direction = from === 'A' ? 'a_to_b' : 'b_to_a';
  const evidence: Evidence[] = [];
  const targetAxes = axes(target);
  for (const { planet, longitude } of source.positions) {
    for (const axis of targetAxes) {
      const match = findAspect(longitude, axis.longitude);
      if (!match) continue;
      evidence.push({ rule: 'western-planet-to-axis', direction,
        sources: [`${from} ${planetLabels[planet]} · ${longitude.toFixed(2)}°`, `${to} ${axis.label} · ${axis.longitude.toFixed(2)}°`],
        observation: `天体与轴点 · ${match.label}`,
        facts: { planet, axis: axis.axis, longitude: match.firstLongitude, axisLongitude: match.secondLongitude, ...match.facts } });
    }
  }
  for (const { house, planet, longitude, sign } of houseRulers(source)) {
    const label = `${from} 第 ${house} 宫主 ${planetLabels[planet]}`;
    if (Number.isFinite(target.ascendant)) {
      const targetHouse = (signIndex(longitude) - signIndex(target.ascendant) + 12) % 12 + 1;
      evidence.push({ rule: 'western-house-ruler-overlay', direction,
        sources: [label, `${to} 第 ${targetHouse} 宫`], observation: '传统宫主星跨盘落宫',
        facts: { house, sign, ruler: planet, longitude, targetHouse, targetAscendant: target.ascendant, rulership } });
    }
    for (const other of target.positions) {
      const match = findAspect(longitude, other.longitude);
      if (!match) continue;
      evidence.push({ rule: 'western-house-ruler-aspect', direction,
        sources: [label, `${to} ${planetLabels[other.planet]}`], observation: `宫主星与天体 · ${match.label}`,
        facts: { house, sign, ruler: planet, longitude: match.firstLongitude, targetPlanet: other.planet,
          targetLongitude: match.secondLongitude, rulership, ...match.facts } });
    }
  }
  return evidence;
}

export function compareWesternDetails(a: Chart, b: Chart) {
  const aAxes = axes(a);
  const bAxes = axes(b);
  const aRulers = houseRulers(a);
  const bRulers = houseRulers(b);
  const evidence = [...directional(a, b, 'A'), ...directional(b, a, 'B')];
  for (const left of aAxes) {
    for (const right of bAxes) {
      const match = findAspect(left.longitude, right.longitude);
      if (!match) continue;
      evidence.push({ rule: 'western-axis-aspect', direction: 'mutual',
        sources: [`A ${left.label} · ${left.longitude.toFixed(2)}°`, `B ${right.label} · ${right.longitude.toFixed(2)}°`],
        observation: `双方轴点 · ${match.label}`,
        facts: { aAxis: left.axis, bAxis: right.axis, aLongitude: match.firstLongitude, bLongitude: match.secondLongitude, ...match.facts } });
    }
  }
  for (const left of aRulers) {
    for (const right of bRulers) {
      const match = findAspect(left.longitude, right.longitude);
      if (!match) continue;
      evidence.push({ rule: 'western-ruler-to-ruler', direction: 'mutual',
        sources: [`A 第 ${left.house} 宫主 ${planetLabels[left.planet]}`, `B 第 ${right.house} 宫主 ${planetLabels[right.planet]}`],
        observation: `双方宫主星 · ${match.label}`,
        facts: { aHouse: left.house, bHouse: right.house, aSign: left.sign, bSign: right.sign,
          aRuler: left.planet, bRuler: right.planet, aLongitude: match.firstLongitude, bLongitude: match.secondLongitude, rulership, ...match.facts } });
    }
  }
  return { evidence, axesAvailable: aAxes.length === 4 && bAxes.length === 4,
    rulersAvailable: aRulers.length === 12 && bRulers.length === 12 };
}
