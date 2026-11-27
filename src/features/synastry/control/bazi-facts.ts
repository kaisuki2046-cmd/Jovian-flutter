import { LunarUtil } from 'lunar-javascript';
import type { ChartFacts, Direction, Evidence } from '../model/comparison';

type BaZi = Exclude<ChartFacts['bazi'], { status: 'unavailable' }>;
type Pillar = BaZi['pillars'][number];
export const pillarLabels = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' } as const;
const stems = '甲乙丙丁戊己庚辛壬癸';
const elements = ['木', '火', '土', '金', '水'];
const stemElement = (stem: string | null) => typeof stem === 'string' && stem.length === 1 ? Math.floor(stems.indexOf(stem) / 2) : -1;

export function knownHiddenStems({ branch, hiddenStems }: Pillar) {
  const ordered = branch?.length === 1 ? LunarUtil.ZHI_HIDE_GAN[branch] : undefined;
  return ordered && Array.isArray(hiddenStems)
    ? ordered.flatMap((stem, index) => hiddenStems.includes(stem) ? [{ stem, rank: index + 1 }] : [])
    : [];
}

function fullPillar(pillar: Pillar) {
  const { position, stem, branch } = pillar;
  if (!stem || stemElement(stem) < 0 || !branch || branch.length !== 1) return null;
  const expected = LunarUtil.ZHI_HIDE_GAN[branch];
  const hidden = knownHiddenStems(pillar).map((item) => item.stem);
  return expected?.length && pillar.hiddenStems?.length === expected.length && hidden.length === expected.length
    ? { position, stem, branch, hidden } : null;
}
export const stemPairs = ['甲己', '乙庚', '丙辛', '丁壬', '戊癸'];
export const branchUnions = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'];
export const branchOppositions = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
const stemPairElements = ['土', '金', '水', '木', '火'];
const stemClashes = ['甲庚', '乙辛', '丙壬', '丁癸'];
const harms = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'];
export const hasBranchHarm = (a: string, b: string) => harms.includes(a + b) || harms.includes(b + a);
export const branchBreaks = ['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌'];
export const branchPunishments = ['寅巳', '巳申', '申寅', '丑戌', '戌未', '未丑', '子卯', '卯子', '辰辰', '午午', '酉酉', '亥亥'];
export const groups = [
  { kind: '三合', branches: '申子辰', element: '水' }, { kind: '三合', branches: '亥卯未', element: '木' },
  { kind: '三合', branches: '寅午戌', element: '火' }, { kind: '三合', branches: '巳酉丑', element: '金' },
  { kind: '三会', branches: '寅卯辰', element: '木' }, { kind: '三会', branches: '巳午未', element: '火' },
  { kind: '三会', branches: '申酉戌', element: '金' }, { kind: '三会', branches: '亥子丑', element: '水' },
  { kind: '三刑', branches: '寅巳申', element: '' }, { kind: '三刑', branches: '丑戌未', element: '' },
];

function pairIndex(pairs: readonly string[], a: string, b: string) {
  return pairs.findIndex((pair) => pair === a + b || pair === b + a);
}

function crossPillars(a: BaZi, b: BaZi): Evidence[] {
  const evidence: Evidence[] = [];
  const fullBranches = [a, b].every(({ pillars }) => pillars.length === 4 && pillars.every(({ branch }) => branch));
  for (const left of a.pillars) {
    for (const right of b.pillars) {
      const positions = { aPosition: left.position, bPosition: right.position };
      if (left.stem && right.stem) {
        const sources = [`A ${pillarLabels[left.position]} ${left.stem}`, `B ${pillarLabels[right.position]} ${right.stem}`] as const;
        const combine = pairIndex(stemPairs, left.stem, right.stem);
        const facts = { ...positions, aStem: left.stem, bStem: right.stem };
        if (combine >= 0) evidence.push({ rule: 'stem-combination', direction: 'mutual', sources,
          observation: `天干五合（${stemPairElements[combine]}为配对五行）`,
          facts: { ...facts, pair: stemPairs[combine], combinationElement: stemPairElements[combine] } });
        if (pairIndex(stemClashes, left.stem, right.stem) >= 0) {
          evidence.push({ rule: 'stem-clash', direction: 'mutual', sources, observation: '天干相冲', facts });
        }
      }
      if (!left.branch || !right.branch) continue;
      const [aBranch, bBranch] = [left.branch, right.branch];
      const sources = [`A ${pillarLabels[left.position]} ${aBranch}`, `B ${pillarLabels[right.position]} ${bBranch}`] as const;
      const facts = { ...positions, aBranch, bBranch };
      for (const [rule, label, pairs] of [['branch-harm', '地支六害', harms], ['branch-break', '地支六破', branchBreaks]] as const) {
        if (pairIndex(pairs, aBranch, bBranch) >= 0) evidence.push({ rule, direction: 'mutual', sources, observation: label, facts });
      }
      const forward = branchPunishments.includes(aBranch + bBranch);
      const reverse = branchPunishments.includes(bBranch + aBranch);
      if (forward || reverse) {
        evidence.push({ rule: 'branch-punishment', direction: forward && reverse ? 'mutual' : forward ? 'a_to_b' : 'b_to_a',
          sources, observation: aBranch === bBranch ? '同支自刑对应' : '地支相刑',
          facts: { ...facts, kind: aBranch === bBranch ? 'self' : aBranch + bBranch === '子卯' || aBranch + bBranch === '卯子' ? 'mutual' : 'directed' } });
      }
    }
  }
  for (const { kind, branches, element } of groups) {
    const candidates = kind === '三合' ? [branches, branches[0] + branches[1], branches[1] + branches[2]] : [branches];
    for (const combination of candidates) {
      const involved = (chart: BaZi) => chart.pillars.filter(({ branch }) => branch && combination.includes(branch));
      const left = involved(a);
      const right = involved(b);
      if (!left.length || !right.length
        || ![...combination].every((branch) => [...left, ...right].some((pillar) => pillar.branch === branch))) continue;
      const format = (items: typeof left) => items.map(({ position, branch }) => `${pillarLabels[position]} ${branch}`).join('、');
      const complete = combination === branches;
      const label = complete ? kind : '半合';
      const alsoNatal = [left, right].some((items) => [...combination].every((branch) =>
        items.some((pillar) => pillar.branch === branch)));
      evidence.push({ rule: 'branch-group', direction: 'mutual', sources: [`A ${format(left)}`, `B ${format(right)}`],
        observation: `地支${label}组合 · ${combination}`,
        facts: { kind: label, combination, element, formation: alsoNatal ? 'also_natal' : fullBranches ? 'cross_only' : 'unknown',
          aBranches: left.map(({ branch }) => branch).join(''),
          bBranches: right.map(({ branch }) => branch).join(''), aPositions: left.map(({ position }) => position).join(','),
          bPositions: right.map(({ position }) => position).join(',') } });
      if (complete) break;
    }
  }
  return evidence;
}

function natalMarkerOverlays(source: BaZi, target: BaZi, from: 'A' | 'B'): Evidence[] {
  const to = from === 'A' ? 'B' : 'A';
  const direction = from === 'A' ? 'a_to_b' : 'b_to_a';
  return source.pillars.flatMap(({ position, branch, shenSha }) => {
    if (!branch || !shenSha.length) return [];
    return target.pillars.filter((item) => item.branch === branch).flatMap((item) =>
      shenSha.map(({ name, sourcePillars }) => ({
        rule: 'cross-branch-natal-marker', direction,
        sources: [`${from} ${pillarLabels[position]} ${branch} · ${name}`, `${to} ${pillarLabels[item.position]} ${branch}`] as const,
        observation: '本命神煞同支对照',
        facts: { name, branch, sourcePosition: position, targetPosition: item.position, sourcePillars: sourcePillars.join(',') },
      })));
  });
}

function tenGods(source: BaZi, target: BaZi, from: 'A' | 'B'): Evidence[] {
  const reference = target.pillars.find(({ position }) => position === 'day')?.stem;
  if (!reference) return [];
  const to = from === 'A' ? 'B' : 'A';
  const direction = from === 'A' ? 'a_to_b' : 'b_to_a';
  return source.pillars.flatMap((pillar) => {
    const { position, stem, branch } = pillar;
    const candidates = [
      ...(stem ? [{ observed: stem, layer: 'visible', rank: 0 }] : []),
      ...knownHiddenStems(pillar).map(({ stem: observed, rank }) => ({ observed, layer: 'hidden', rank })),
    ];
    return candidates.flatMap(({ observed, layer, rank }) => {
      const label = LunarUtil.SHI_SHEN[reference + observed];
      const location = layer === 'hidden' ? `${branch ?? ''}藏${observed}` : observed;
      return label ? [{ rule: 'cross-pillar-ten-god', direction, observation: `跨盘柱位十神 · ${label}`,
        sources: [`${from} ${pillarLabels[position]} ${location}`, `${to} 日干 ${reference}`] as const,
        facts: { position, observed, reference, label, layer, rank } }] : [];
    });
  });
}

export function strengthContext(chart: BaZi) {
  if (chart.status !== 'complete' || chart.pillars.length !== 4) return null;
  const pillars = chart.pillars.map(fullPillar);
  if (!pillars.every((pillar) => pillar !== null)) return null;
  const positions = new Set(pillars.map(({ position }) => position));
  if (!Object.keys(pillarLabels).every((position) => positions.has(position as Pillar['position']))) return null;
  const dayStem = pillars.find(({ position }) => position === 'day')!.stem;
  const month = pillars.find(({ position }) => position === 'month')!;
  const dayElement = stemElement(dayStem);
  const monthMainStem = month.hidden[0];
  const elementRelation = (stem: string) => (stemElement(stem) - dayElement + 5) % 5;
  const monthRelation = ['peer', 'output', 'wealth', 'officer', 'resource'][elementRelation(monthMainStem)];
  const roots = pillars.flatMap(({ position, hidden }) => {
    const rank = hidden.findIndex((stem) => stemElement(stem) === dayElement);
    return rank >= 0 ? [{ position, rank: rank + 1 }] : [];
  });
  const visible = pillars.filter(({ position, stem }) => position !== 'day' && [0, 4].includes(elementRelation(stem)));
  return { dayStem, dayElement: elements[dayElement], monthBranch: month.branch, monthMainStem, monthRelation,
    rootCount: roots.length, mainQiRoots: roots.filter(({ rank }) => rank === 1).length,
    rootPositions: roots.map(({ position, rank }) => `${position}:${rank}`).join(','),
    visibleSupportCount: visible.length, visibleSupportPositions: visible.map(({ position }) => position).join(',') };
}

export function compareBaZiDetails(a: BaZi, b: BaZi) {
  const evidence = [...crossPillars(a, b), ...tenGods(a, b, 'A'), ...tenGods(b, a, 'B'),
    ...natalMarkerOverlays(a, b, 'A'), ...natalMarkerOverlays(b, a, 'B')];
  const left = strengthContext(a);
  const right = strengthContext(b);
  if (left && right) {
    const describe = (facts: typeof left) => `日主 ${facts.dayStem} · 月支 ${facts.monthBranch} · 通根 ${facts.rootCount} 柱 · 透出比印 ${facts.visibleSupportCount} 柱`;
    evidence.push({ rule: 'day-master-strength-context', direction: 'mutual',
      sources: [`A ${describe(left)}`, `B ${describe(right)}`], observation: '日主强弱观察条件',
      facts: { aDayStem: left.dayStem, bDayStem: right.dayStem, aDayElement: left.dayElement, bDayElement: right.dayElement,
        aMonthBranch: left.monthBranch, bMonthBranch: right.monthBranch, aMonthMainStem: left.monthMainStem, bMonthMainStem: right.monthMainStem,
        aMonthRelation: left.monthRelation, bMonthRelation: right.monthRelation, aRootCount: left.rootCount, bRootCount: right.rootCount,
        aMainQiRoots: left.mainQiRoots, bMainQiRoots: right.mainQiRoots, aRootPositions: left.rootPositions, bRootPositions: right.rootPositions,
        aVisibleSupportCount: left.visibleSupportCount, bVisibleSupportCount: right.visibleSupportCount,
        aVisibleSupportPositions: left.visibleSupportPositions, bVisibleSupportPositions: right.visibleSupportPositions } });
    for (const item of evidence) {
      if (!['stem-combination', 'stem-clash', 'branch-group'].includes(item.rule)) continue;
      item.facts = { ...item.facts, aMonthRelation: left.monthRelation, bMonthRelation: right.monthRelation,
        aRootCount: left.rootCount, bRootCount: right.rootCount,
        aMainQiRoots: left.mainQiRoots, bMainQiRoots: right.mainQiRoots,
        aVisibleSupportCount: left.visibleSupportCount, bVisibleSupportCount: right.visibleSupportCount };
    }
  }
  return { evidence, strengthAvailable: Boolean(left && right) };
}
