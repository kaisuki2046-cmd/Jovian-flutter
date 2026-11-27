import { baziColumnRoles, baziInteractions, describeBaZiStem } from './bazi-calculation';

const columns = ['year', 'month', 'day', 'hour'] as const;
const elements = ['木', '火', '土', '金', '水'];
const unitsPerPoint = 60;
const totalUnits = 7 * unitsPerPoint;
const elementTotalUnits = totalUnits + unitsPerPoint;
const stemUnits = { year: 30, month: 60, day: 0, hour: 60 };
const branchUnits = { year: 30, month: 120, day: 60, hour: 60 };
const hiddenShares = [[1], [2 / 3, 1 / 3], [0.6, 0.3, 0.1]];
const groupedElements: Readonly<Record<string, string>> = {
  申子辰: '水', 亥卯未: '木', 寅午戌: '火', 巳酉丑: '金',
  亥子丑: '水', 寅卯辰: '木', 巳午未: '火', 申酉戌: '金',
};
// Primary entries explicitly identified in FateClear's climate article.
const publishedClimatePrimaries: Readonly<Partial<Record<string, string>>> = {
  戊丑: '火', 丙未: '水', 丙子: '水', 丁子: '木', 壬子: '土',
};
type Natal = Record<typeof columns[number], string>;

export const fateClearBalancePolicy = {
  profile: 'fateclear-published-example-base-balance-v2',
  weights: 'seven-points-no-day-stem-hidden-shares-reconstructed-from-published-numeric-examples',
  direction: 'month-command-with-clash-and-group-exceptions-then-exact-balance',
  tongGuan: 'fateclear-published-eight-point-tong-guan-v1',
  climate: 'fateclear-published-primary-climate-v1',
} as const;

function showPoints(units: number) {
  return Math.round(units * 100 / unitsPerPoint) / 100;
}

function tongGuanEvidence(units: Record<string, number>, dayElement: string) {
  // The article's percentages add one point for the day stem, which the strength ledger omits.
  const elementalUnits = { ...units, [dayElement]: units[dayElement] + unitsPerPoint };
  const share = (amount: number) => Math.round(amount * 1000 / elementTotalUnits) / 10;
  const proportions = Object.fromEntries(elements.map(element => [element, share(elementalUnits[element])]));
  const routes = elements.flatMap((controlling, index) => {
    const controlled = elements[(index + 2) % elements.length];
    const bridge = elements[(index + 1) % elements.length];
    const controllerUnits = elementalUnits[controlling], controlledUnits = elementalUnits[controlled];
    if (controllerUnits * 100 < 30 * elementTotalUnits || controlledUnits * 100 < 30 * elementTotalUnits
      || (controllerUnits + controlledUnits) * 100 < 62 * elementTotalUnits) return [];
    return [{ controlling, controlled, bridge }];
  });
  return { proportions, routes };
}

export function fateClearBaseBalance(natal: Natal) {
  const dayStem = natal.day[0], dayElement = describeBaZiStem(dayStem).stemElement;
  const dayIndex = elements.indexOf(dayElement);
  const sealElement = elements[(dayIndex + 4) % elements.length];
  const supportingElements = [dayElement, sealElement];
  const restrainingElements = elements.filter(element => !supportingElements.includes(element));
  const positions = columns.map(column => ({ id: column, pillar: natal[column] }));
  const roles = positions.flatMap(({ id, pillar }) => baziColumnRoles(id, pillar, dayStem));
  const units = Object.fromEntries(elements.map(element => [element, 0]));
  const hidden = roles.filter(role => role.placement !== 'stem');
  for (const column of columns) {
    const branch = hidden.filter(role => role.column === column);
    branch.forEach((role, index) => { units[role.element] += Math.round(branchUnits[column] * hiddenShares[branch.length - 1][index]); });
    const exposed = roles.find(role => role.column === column && role.placement === 'stem');
    if (exposed) units[exposed.element] += stemUnits[column];
  }

  const support = units[dayElement] + units[sealElement];
  const monthMain = hidden.find(row => row.column === 'month' && row.placement === 'main_qi');
  const monthSupports = monthMain !== undefined && supportingElements.includes(monthMain.element);
  const rootColumns = hidden.filter(row => row.placement === 'main_qi' && row.element === dayElement).map(row => row.column);
  const sealExposed = roles.some(row => row.placement === 'stem' && row.element === sealElement);
  const relation = baziInteractions(positions);
  const completeGroups = relation.groups.filter(row => row.kind === '三合' || row.kind === '三会');
  const monthClashPositions = relation.pairs.filter(row => row.kind === '六冲' && row.members.includes('month'))
    .flatMap(row => row.members.filter(id => id !== 'month'));
  const monthClashWithoutOtherRoot = monthClashPositions.length > 0 && !rootColumns.some(id => id !== 'month');
  const restrainingMonthGroups = completeGroups.flatMap(row => {
    const element = groupedElements[row.values];
    return restrainingElements.includes(element) && row.byBranch.some(ids => ids.includes('month'))
      ? [{ kind: row.kind, branches: row.values, element, positions: row.byBranch }] : [];
  });
  const monthOverridesScore = monthSupports && !monthClashWithoutOtherRoot && !restrainingMonthGroups.length;
  const scores = Object.values(units).sort((a, b) => b - a);
  const [leadingExternal, nextExternal] = [...restrainingElements].sort((a, b) => units[b] - units[a]);
  const leadingExternalGroup = completeGroups.some(row => groupedElements[row.values] === leadingExternal);
  // 1955 年原书从杀例在复算分表恰为半数，边界保留作候选。
  const followCheck = support * 100 <= totalUnits * 35 && !rootColumns.length && !sealExposed
    && units[leadingExternal] > units[nextExternal] && (units[leadingExternal] * 2 >= totalUnits || leadingExternalGroup);
  // 两气成象须有日主参与。即使计入日干本身的一分，仍在两行之后便可排除。
  const dayCanJoinLeadingPair = units[dayElement] + unitsPerPoint >= scores[1];
  const concentrated = dayCanJoinLeadingPair && (scores[0] + scores[1]) * 100 >= totalUnits * 80;
  // The source treats adjacent Jia/Ji combinations in Wei or Xu separately.
  const earthPairs = ['未', '戌'].includes(natal.month[1]) ? relation.pairs.filter(row => row.kind === '天干五合'
    && ['甲己', '己甲'].includes(row.values) && row.members.includes('day') && row.members.some(column => column === 'month' || column === 'hour')
    && !roles.some(role => role.element === '木' && (role.placement === 'main_qi'
      || (role.placement === 'stem' && !row.members.includes(role.column))))) : [];
  const earthTransformation = earthPairs.length === 1 ? { pair: earthPairs[0].values,
    partner: earthPairs[0].members.find(column => column !== 'day'), monthBranch: natal.month[1] } : undefined;
  const review = [followCheck && 'possible-following', concentrated && 'concentrated-elements',
    earthPairs.length > 0 && 'possible-earth-transformation'].filter(Boolean);
  const strengthBasis = review.length ? undefined : monthOverridesScore ? 'month-command'
    : support * 2 === totalUnits ? 'equal-scores' : 'scores';
  const strength = strengthBasis === 'month-command' ? 'strong'
    : strengthBasis === 'scores' ? (support * 2 > totalUnits ? 'strong' : 'weak') : undefined;
  return { profile: fateClearBalancePolicy.profile,
    primaryClimate: publishedClimatePrimaries[dayStem + natal.month[1]],
    scores: Object.fromEntries(elements.map(element => [element, showPoints(units[element])])),
    support: showPoints(support), restraint: showPoints(totalUnits - support),
    monthMain: monthMain?.stem, monthSupports, monthClashPositions, monthClashWithoutOtherRoot, restrainingMonthGroups,
    rootColumns, sealExposed, review, strength, strengthBasis, earthTransformation,
    tongGuan: tongGuanEvidence(units, dayElement),
    aligned: strength === 'strong' ? restrainingElements : strength === 'weak' ? supportingElements : undefined,
    opposed: strength === 'strong' ? supportingElements : strength === 'weak' ? restrainingElements : undefined,
  };
}
