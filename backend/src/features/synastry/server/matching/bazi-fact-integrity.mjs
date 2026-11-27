import { LunarUtil } from 'lunar-javascript';
import { branchBreaks, branchPunishments, branchUnions, groups, hasBranchHarm, pillarLabels, stemPairs } from '../../control/bazi-facts.ts';

const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';
const elements = '木火土金水';
const monthRelations = ['peer', 'output', 'wealth', 'officer', 'resource'];
const elementDirections = ['mutual', 'a_to_b', 'a_to_b', 'b_to_a', 'b_to_a'];
const markerPillars = new Set(['year', 'day', 'year,day']);

const validPosition = (value) => typeof value === 'string' && Object.hasOwn(pillarLabels, value);
const validSymbol = (value, symbols) => typeof value === 'string' && value.length === 1 && symbols.includes(value);
const validBranch = (value) => validSymbol(value, branches);
const stemElement = (value) => validSymbol(value, stems) ? Math.floor(stems.indexOf(value) / 2) : -1;
const isDirectional = (direction) => direction === 'a_to_b' || direction === 'b_to_a';
const findPair = (pairs, a, b) => pairs.find((pair) => pair === a + b || pair === b + a);
const list = (value) => typeof value !== 'string' ? null : value ? value.split(',') : [];

function consistentTenGod(direction, { observed, reference, label }) {
  return isDirectional(direction) && stemElement(observed) >= 0 && stemElement(reference) >= 0
    && LunarUtil.SHI_SHEN[reference + observed] === label;
}

function consistentBranchPair(rule, direction, { aBranch, bBranch, aPosition, bPosition, kind }) {
  if (!validBranch(aBranch) || !validBranch(bBranch) || !validPosition(aPosition) || !validPosition(bPosition)) return false;
  if (rule === 'branch-punishment') {
    const forward = branchPunishments.includes(aBranch + bBranch);
    const reverse = branchPunishments.includes(bBranch + aBranch);
    if (!forward && !reverse) return false;
    const expectedDirection = forward && reverse ? 'mutual' : forward ? 'a_to_b' : 'b_to_a';
    const expectedKind = aBranch === bBranch ? 'self' : expectedDirection === 'mutual' ? 'mutual' : 'directed';
    return direction === expectedDirection && kind === expectedKind;
  }
  if (direction !== 'mutual') return false;
  if (rule === 'branch-harm') return hasBranchHarm(aBranch, bBranch);
  return Boolean(findPair(rule === 'branch-union' ? branchUnions : branchBreaks, aBranch, bBranch));
}

function consistentGroupMembers(group, memberBranches, memberPositions) {
  const positions = list(memberPositions);
  return typeof memberBranches === 'string' && memberBranches.length > 0
    && positions?.length === memberBranches.length && new Set(positions).size === positions.length
    && positions.every(validPosition) && [...memberBranches].every((branch) => group.includes(branch));
}

function consistentBranchGroup(direction, { kind, combination, element, formation, aBranches, bBranches, aPositions, bPositions }) {
  if (direction !== 'mutual' || typeof combination !== 'string') return false;
  const group = groups.find((candidate) => candidate.element === element && (
    (candidate.kind === kind && candidate.branches === combination)
    || (kind === '半合' && candidate.kind === '三合'
      && [candidate.branches.slice(0, 2), candidate.branches.slice(1)].includes(combination))
  ));
  if (!group || !consistentGroupMembers(combination, aBranches, aPositions)
    || !consistentGroupMembers(combination, bBranches, bPositions)) return false;
  const completeIn = (value) => [...combination].every((branch) => value.includes(branch));
  if (!completeIn(aBranches + bBranches)) return false;
  return completeIn(aBranches) || completeIn(bBranches) ? formation === 'also_natal'
    : formation === 'cross_only' || formation === 'unknown';
}

function consistentStrengthSide(facts, side) {
  const dayElement = stemElement(facts[side + 'DayStem']);
  const monthBranch = facts[side + 'MonthBranch'];
  if (dayElement < 0 || facts[side + 'DayElement'] !== elements[dayElement] || !validBranch(monthBranch)) return false;
  const [monthMainStem] = LunarUtil.ZHI_HIDE_GAN[monthBranch];
  const monthRelation = monthRelations[(stemElement(monthMainStem) - dayElement + 5) % 5];
  if (facts[side + 'MonthMainStem'] !== monthMainStem || facts[side + 'MonthRelation'] !== monthRelation) return false;

  const roots = list(facts[side + 'RootPositions']);
  const support = list(facts[side + 'VisibleSupportPositions']);
  if (!roots || !support || roots.length !== facts[side + 'RootCount'] || support.length !== facts[side + 'VisibleSupportCount']
    || new Set(support).size !== support.length || !support.every((position) => validPosition(position) && position !== 'day')) return false;
  const entries = roots.map((root) => root.split(':'));
  if (!entries.every(([position, rank, extra]) => validPosition(position) && ['1', '2', '3'].includes(rank) && extra === undefined)
    || new Set(entries.map(([position]) => position)).size !== entries.length
    || entries.filter(([, rank]) => rank === '1').length !== facts[side + 'MainQiRoots']) return false;
  const monthRoot = LunarUtil.ZHI_HIDE_GAN[monthBranch].findIndex((stem) => stemElement(stem) === dayElement) + 1;
  const recordedMonthRoot = entries.find(([position]) => position === 'month')?.[1];
  return monthRoot === Number(recordedMonthRoot ?? 0);
}

export function isConsistentBaziFact({ rule, direction, facts }) {
  switch (rule) {
    case 'relative-ten-god':
      return consistentTenGod(direction, facts);
    case 'cross-pillar-ten-god':
      return consistentTenGod(direction, facts) && validPosition(facts.position)
        && (facts.layer === 'visible' && facts.rank === 0 || facts.layer === 'hidden' && [1, 2, 3].includes(facts.rank));
    case 'branch-union':
    case 'branch-harm':
    case 'branch-break':
    case 'branch-punishment':
      return consistentBranchPair(rule, direction, facts);
    case 'stem-combination': {
      const { aStem, bStem, aPosition, bPosition, pair, combinationElement } = facts;
      if (direction !== 'mutual' || stemElement(aStem) < 0 || stemElement(bStem) < 0
        || !validPosition(aPosition) || !validPosition(bPosition)) return false;
      const actualPair = findPair(stemPairs, aStem, bStem);
      return Boolean(actualPair && pair === actualPair && combinationElement === '土金水木火'[stemPairs.indexOf(actualPair)]);
    }
    case 'branch-group':
      return consistentBranchGroup(direction, facts);
    case 'cross-branch-natal-marker':
      return isDirectional(direction) && validBranch(facts.branch) && validPosition(facts.sourcePosition)
        && validPosition(facts.targetPosition) && markerPillars.has(facts.sourcePillars);
    case 'day-stem-elements': {
      const from = stemElement(facts.aStem);
      const to = stemElement(facts.bStem);
      if (from < 0 || to < 0) return false;
      const relation = (to - from + 5) % 5;
      return facts.relation === relation && direction === elementDirections[relation];
    }
    case 'day-master-strength-context':
      return direction === 'mutual' && consistentStrengthSide(facts, 'a') && consistentStrengthSide(facts, 'b');
    default:
      return true;
  }
}
