import { lillyCusps, lillyHouse } from '../../control/lilly-houses.mjs';
import { signIndex, trueLunarNodeProfile, zodiacNames } from '../../control/charts.ts';

export const lunarNodes = ['north_node', 'south_node'];

export function lillyNodeLongitudes(facts) {
  const longitudes = new Set(facts.filter(fact => fact.kind === 'western_true_node_longitude' && fact.profile === trueLunarNodeProfile)
    .map(fact => fact.longitude));
  const [north] = longitudes;
  if (longitudes.size !== 1 || !Number.isFinite(north) || north < 0 || north >= 360) return [];
  return lunarNodes.map((node, index) => ({ node, longitude: (north + index * 180) % 360 }));
}

export function lillyNodeFacts(facts) {
  const cusps = lillyCusps(facts);
  if (!cusps) return [];
  return lillyNodeLongitudes(facts).flatMap(({ node, longitude }) => {
    const house = lillyHouse(longitude, cusps);
    return house === null ? [] : [
      { kind: 'western_lilly_node_house', node, house },
      { kind: 'western_lilly_node_sign', node, sign: zodiacNames[signIndex(longitude)] },
    ];
  });
}
