import type { ChartFacts, Evidence } from '../model/comparison';
import { axes, findAspect, houseRulers, knownLongitudes, measureLongitudes, normalize, planetLabels, signIndex } from './western-facts';

type Chart = Extract<ChartFacts['western'], { status: 'complete' }>;
const elements = ['火', '土', '风', '水'];
const modalities = ['基本', '固定', '变动'];
const variant = 'short-arc-ecliptic-midpoint-v1';
const supported = (chart: ChartFacts['western']): chart is Chart =>
  chart.status === 'complete' && chart.rulesetVersion === 'tropical-whole-sign-v1'
  && chart.zodiac === 'tropical' && chart.houseSystem === 'whole-sign';

export function compositeMidpoint(first: number, second: number) {
  const measurement = measureLongitudes(first, second);
  if (!measurement) return null;
  const { firstLongitude, secondLongitude, degrees: separation } = measurement;
  const delta = normalize(secondLongitude - firstLongitude + 180) - 180;
  const ambiguous = Math.abs(separation - 180) <= 1e-9;
  const midpoint = normalize(firstLongitude + delta / 2);
  const longitude = ambiguous ? Math.min(midpoint, normalize(midpoint + 180)) : midpoint;
  return { longitude, alternateLongitude: normalize(longitude + 180), separation, status: ambiguous ? 'ambiguous' : 'unique' };
}

function natal(chart: Chart, person: 'A' | 'B'): Evidence[] {
  const evidence: Evidence[] = [];
  const direction = person === 'A' ? 'self_a' : 'self_b';
  const valid = chart.positions;
  for (const { planet, longitude } of valid) {
    const sign = signIndex(longitude);
    evidence.push({ rule: 'western-natal-placement', direction,
      sources: [`${person} ${planetLabels[planet]}`, `${person} 本命`], observation: '本人星座、元素、模式与整宫位置',
      facts: { person, planet, longitude, sign, element: elements[sign % 4], modality: modalities[sign % 3],
        ...(Number.isFinite(chart.ascendant) ? { house: (sign - signIndex(chart.ascendant) + 12) % 12 + 1 } : {}) } });
  }
  for (const { axis, longitude } of axes(chart)) {
    evidence.push({ rule: 'western-natal-axis', direction, sources: [`${person} ${axis}`, `${person} 本命`],
      observation: '本人角轴', facts: { person, axis, longitude, sign: signIndex(longitude) } });
  }
  for (const { house, sign, planet, longitude } of houseRulers(chart)) {
    evidence.push({ rule: 'western-natal-house-ruler', direction,
      sources: [`${person} 第${house}宫`, `${person} 宫主星 ${planetLabels[planet]}`],
      observation: '本人传统宫主星与落宫', facts: { person, house, sign, ruler: planet, longitude,
        rulerHouse: (signIndex(longitude) - signIndex(chart.ascendant) + 12) % 12 + 1, rulership: 'traditional-domicile-v1' } });
  }
  for (let left = 0; left < valid.length; left++) {
    for (let right = left + 1; right < valid.length; right++) {
      const first = valid[left];
      const second = valid[right];
      const aspect = findAspect(first.longitude, second.longitude);
      if (!aspect) continue;
      evidence.push({ rule: 'western-natal-aspect', direction,
        sources: [`${person} ${planetLabels[first.planet]}`, `${person} ${planetLabels[second.planet]}`],
        observation: `本人相位 · ${aspect.label}`, facts: { person, first: first.planet, second: second.planet,
          firstLongitude: aspect.firstLongitude, secondLongitude: aspect.secondLongitude, ...aspect.facts } });
    }
  }
  for (const [dimension, labels] of [['element', elements], ['modality', modalities]] as const) {
    for (const [index, label] of labels.entries()) {
      evidence.push({ rule: 'western-natal-distribution', direction, sources: [`${person} 本命星座`, `${person} 等权计数`],
        observation: `本人${label}分布`, facts: { person, dimension, label, total: valid.length, weighting: 'equal-body-count-v1',
          count: valid.filter(({ longitude }) => signIndex(longitude) % labels.length === index).length } });
    }
  }
  return evidence;
}

export function enrichWestern(left: ChartFacts['western'], right: ChartFacts['western']): Evidence[] {
  const a = supported(left) ? knownLongitudes(left) : null;
  const b = supported(right) ? knownLongitudes(right) : null;
  const aNatal = a ? natal(a, 'A') : [];
  const bNatal = b ? natal(b, 'B') : [];
  const evidence = [...aNatal, ...bNatal];
  if (!a || !b) return evidence;
  for (const [source, native, person] of [[b, aNatal, 'A'], [a, bNatal, 'B']] as const) {
    const direction = person === 'A' ? 'b_to_a' : 'a_to_b';
    for (const aspect of native.filter(({ rule }) => rule === 'western-natal-aspect')) {
      const facts = aspect.facts;
      for (const [nativePlanet, nativeOther, longitude] of [[facts.first, facts.second, facts.firstLongitude],
        [facts.second, facts.first, facts.secondLongitude]] as const) {
        for (const incoming of source.positions) {
          const contact = findAspect(incoming.longitude, Number(longitude));
          if (!contact) continue;
          evidence.push({ rule: 'western-natal-activation', direction,
            sources: [`${person === 'A' ? 'B' : 'A'} ${planetLabels[incoming.planet]}`, `${person} ${nativePlanet}—${nativeOther}本命相位`],
            observation: '外来星体接触已有本命相位的一端',
            facts: { nativePlanet, nativeOther, incomingPlanet: incoming.planet,
              nativeAngle: facts.angle, nativeDeviation: facts.deviation, nativeOrb: facts.orb,
              crossAngle: contact.facts.angle, crossDeviation: contact.facts.deviation, crossOrb: contact.facts.orb } });
        }
      }
    }
  }
  const midpoints = a.positions.flatMap((left) => {
    const right = b.positions.find(({ planet }) => planet === left.planet);
    const midpoint = right && compositeMidpoint(left.longitude, right.longitude);
    if (!right || !midpoint) return [];
    return [{ planet: left.planet, aLongitude: left.longitude, bLongitude: right.longitude,
      ...midpoint }];
  });
  for (const midpoint of midpoints) {
    evidence.push({ rule: 'western-composite-midpoint', direction: 'whole',
      sources: [`A ${planetLabels[midpoint.planet]}`, `B ${planetLabels[midpoint.planet]}`],
      observation: midpoint.status === 'ambiguous' ? '组合中点180度歧义，两分支并列' : '关系整体短弧组合星位',
      facts: { ...midpoint, variant } });
  }
  const unique = midpoints.filter(({ status }) => status === 'unique');
  for (let left = 0; left < unique.length; left++) {
    for (let right = left + 1; right < unique.length; right++) {
      const first = unique[left];
      const second = unique[right];
      const aspect = findAspect(first.longitude, second.longitude);
      if (!aspect) continue;
      evidence.push({ rule: 'western-composite-aspect', direction: 'whole',
        sources: [`关系整体 ${planetLabels[first.planet]}`, `关系整体 ${planetLabels[second.planet]}`],
        observation: `组合星位相位 · ${aspect.label}`,
        facts: { first: first.planet, second: second.planet, firstLongitude: aspect.firstLongitude, secondLongitude: aspect.secondLongitude,
          ...aspect.facts, variant } });
    }
  }
  for (const [chart, person] of [[a, 'A'], [b, 'B']] as const) {
    for (const natal of chart.positions) {
      for (const composite of unique) {
        const aspect = findAspect(natal.longitude, composite.longitude);
        if (!aspect) continue;
        evidence.push({ rule: 'western-composite-natal-aspect', direction: person === 'A' ? 'self_a' : 'self_b',
          sources: [`关系整体 ${planetLabels[composite.planet]}`, `${person} ${planetLabels[natal.planet]}`],
          observation: `关系整体星位与本人本命相位 · ${aspect.label}`,
          facts: { person, natalPlanet: natal.planet, compositePlanet: composite.planet,
            natalLongitude: aspect.firstLongitude, compositeLongitude: aspect.secondLongitude, ...aspect.facts, variant } });
      }
    }
  }
  return evidence;
}
