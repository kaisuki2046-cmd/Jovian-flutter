const rounded = (value) => Math.round(value * 100) / 100;

// Equal observations share the midpoint of their ranks. The observed end tiers
// anchor the scale, and new values interpolate between adjacent observed tiers.
export function percentileScale(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let rank = 0;
  const tiers = [...counts].sort(([a], [b]) => a - b).map(([value, count]) => {
    const midpoint = rank + (count - 1) / 2;
    rank += count;
    return { value, midpoint };
  });
  const first = tiers[0];
  const last = tiers.at(-1);
  if (!first || first === last) return () => 50;
  const observed = new Map(tiers.map(({ value, midpoint }) => [value, (midpoint - first.midpoint) * 100 / (last.midpoint - first.midpoint)]));
  return (value) => {
    if (observed.has(value)) return rounded(observed.get(value));
    if (value <= first.value) return 0;
    if (value >= last.value) return 100;
    const upper = tiers.findIndex((tier) => tier.value > value);
    const left = tiers[upper - 1].value;
    const right = tiers[upper].value;
    return rounded(observed.get(left) + (observed.get(right) - observed.get(left)) * (value - left) / (right - left));
  };
}

export function describeScores(scores) {
  const sorted = [...scores].sort((a, b) => a - b);
  const quantile = (p) => {
    const rank = (sorted.length - 1) * p;
    const lower = Math.floor(rank);
    return sorted.length ? rounded(sorted[lower] + (sorted[Math.ceil(rank)] - sorted[lower]) * (rank - lower)) : null;
  };
  const hist = Array(10).fill(0);
  for (const score of sorted) hist[Math.min(9, Math.floor(score / 10))]++;
  return { count: sorted.length, distinct: new Set(sorted).size, min: quantile(0), p10: quantile(0.1),
    p25: quantile(0.25), median: quantile(0.5), p75: quantile(0.75), p90: quantile(0.9), max: quantile(1),
    scoreBands: Object.fromEntries(hist.map((n, i) => [`${i * 10}–${i === 9 ? '100' : `<${(i + 1) * 10}`}`, n])) };
}
