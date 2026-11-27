const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';
const modulo = (value, length) => (value % length + length) % length;

// All supplied periods must agree with the natal month, direction and a
// single start age. Missing ranges are left missing.
export function confirmedBaZiDecadalPeriods([year, month], gender, facts) {
  const ranges = facts.filter(fact => fact.kind === 'bazi_decadal_range');
  if (!ranges.length) return null;
  const forward = (stems.indexOf(year[0]) % 2 === 0) === (gender === '男');
  const direction = forward ? 1 : -1;
  const steps = new Map(Array.from({ length: 10 }, (_, index) => {
    const shift = (index + 1) * direction;
    const stem = stems[modulo(stems.indexOf(month[0]) + shift, 10)];
    const branch = branches[modulo(branches.indexOf(month[1]) + shift, 12)];
    return [stem + branch, index];
  }));
  const firstAges = new Set();
  const unique = new Map();
  for (const { ganZhi, startAge, endAge } of ranges) {
    const index = steps.get(ganZhi);
    if (index === undefined) return null;
    const firstAge = startAge - index * 10;
    if (!Number.isInteger(firstAge) || firstAge < 1 || endAge !== startAge + 9) return null;
    firstAges.add(firstAge);
    unique.set(index, { ganZhi, startAge, endAge, ageBasis: '虚岁' });
  }
  if (firstAges.size !== 1) return null;
  return { firstAge: firstAges.values().next().value, forward,
    periods: [...unique.values()].sort((a, b) => a.startAge - b.startAge) };
}

export function selectBaZiDecadalPeriods(sequence, anchor) {
  if (!sequence || (anchor.forward !== undefined && sequence.forward !== anchor.forward)) return [];
  const { stems, branches: branchNames, ganZhis, ageRange } = anchor;
  const selected = sequence.periods.filter(({ ganZhi }) =>
    (!stems || stems.includes(ganZhi[0])) && (!branchNames || branchNames.includes(ganZhi[1]))
    && (!ganZhis || ganZhis.includes(ganZhi)));
  if (!ageRange) return selected;
  return selected.flatMap(period => {
    const startAge = Math.max(period.startAge, ageRange.startAge);
    const endAge = Math.min(period.endAge, ageRange.endAge);
    return startAge <= endAge ? [{ ...period, applicableAgeRange: { startAge, endAge } }] : [];
  });
}
