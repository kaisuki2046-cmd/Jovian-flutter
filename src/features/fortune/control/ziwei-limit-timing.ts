import type { quanshuLimitBranches } from './ziwei-limit-branches';
import { quanshuLimitPlacementProof } from './ziwei-growth-stages';
import { quanshuLimitPhase, quanshuLunarMidnight } from './ziwei-quanshu';

type Natal = Parameters<typeof quanshuLimitPhase>[0];
type Limits = ReturnType<typeof quanshuLimitBranches>;
type Window = { start: number; end: number };
type Half = 'first' | 'second';
type Scope = 'decadal' | 'minor';

export const quanshuLimitTimingPolicy = {
  profile: 'quanshu-north-south-limit-halves-v1',
  decadal: 'sixth-native-lunar-year-new-year',
  minor: 'first-day-of-regular-lunar-month-seven-with-leap-month-in-its-namesake-half',
  verifiedSeats: 'nanyang-birth-day-ziwei-anchor-major-sequence-and-source-hour-chang-qu',
  stars: {
    七杀: '南斗', 破军: '北斗', 武曲: '北斗', 贪狼: '北斗',
    天同: '南斗', 廉贞: '北斗', 天梁: '南斗', 文曲: '北斗', 天机: '南斗', 文昌: '南斗',
  },
} as const;
type Star = keyof typeof quanshuLimitTimingPolicy.stars;

export function quanshuLimitTiming(natal: Natal, limits: Limits, window: Window,
  frame: { age: number; decadalIndex?: number }) {
  if (!limits.ready) return [];
  const { lunarYear, decadalBranch, minorBranch, principalPositions, birthAnchoredMajorBranches, ziweiBirthAnchorVerified } = limits;
  const decade = frame.decadalIndex === undefined ? undefined : quanshuLimitPhase(natal, frame.decadalIndex, frame.age, window.start);
  const decadalMidpoint = decade?.ready && decade.branch === decadalBranch ? Date.parse(decade.midpoint) : undefined;
  const minorMidpoint = minorBranch === undefined ? undefined : quanshuLunarMidnight(lunarYear, 7);
  const layers: { scope: Scope; branch?: string; midpoint?: number }[] = [
    { scope: 'decadal', branch: decadalBranch, midpoint: decadalMidpoint },
    { scope: 'minor', branch: minorBranch, midpoint: minorMidpoint },
  ];
  const cutoffs = layers.flatMap(({ midpoint }) => midpoint !== undefined && window.start < midpoint && midpoint < window.end
    ? [midpoint] : []);
  const edges = [...new Set([window.start, ...cutoffs, window.end])].sort((a, b) => a - b);
  const starBranch = (star: string) => principalPositions.find(row => row.star === star)?.branch;
  const roster = Object.keys(quanshuLimitTimingPolicy.stars) as Star[];
  const verifiedBranches = new Map(roster.map(star => [star,
    star === '文曲' || star === '文昌' ? starBranch(star) : birthAnchoredMajorBranches[star]]));
  const unverifiedTimingStars = roster.filter(star => verifiedBranches.get(star) === undefined);
  return edges.slice(0, -1).map((start, index) => {
    const end = edges[index + 1];
    const halves = layers.map(({ scope, branch, midpoint }) => ({
      scope, branch, midpoint: midpoint === undefined ? undefined : new Date(midpoint).toISOString(),
      half: midpoint === undefined ? undefined : start < midpoint ? 'first' as const : 'second' as const,
    }));
    const verifiedSeats = halves.map(layer => {
      const proof = layer.scope === 'decadal' ? limits.sourceDecadal : limits.sourceMinor;
      return proof?.verified === true && proof.branch === layer.branch ? layer : { ...layer, branch: undefined };
    });
    const starAtHalf = (star: Star, branch: string | undefined, seats = halves) => {
      const group = quanshuLimitTimingPolicy.stars[star];
      const activeHalf: Half = group === '北斗' ? 'first' : 'second';
      const guards = seats.filter(layer => branch !== undefined && layer.branch === branch);
      const matches = guards.filter(layer => layer.half === activeHalf);
      const candidate = matches.length > 0 ? true
        : branch === undefined || seats.some(layer => layer.branch === undefined || (layer.branch === branch && layer.half === undefined))
          ? undefined : false;
      return { star, group, branch,
        activeScopes: matches.map(layer => layer.scope), candidate };
    };
    const verifiedAtHalf = (star: Star) => starAtHalf(star, verifiedBranches.get(star), verifiedSeats);
    const qisha = starAtHalf('七杀', starBranch('七杀')), pojun = starAtHalf('破军', starBranch('破军'));
    const verifiedQisha = verifiedAtHalf('七杀'), verifiedPojun = verifiedAtHalf('破军');
    const { qishaBranch, tianfuBranch, relation: qishaTianfuRelation } = limits.qishaTianfu;
    const qishaTianfuActiveCandidate = verifiedQisha.candidate === false || (qishaTianfuRelation !== undefined && qishaTianfuRelation !== '冲')
      ? false : verifiedQisha.candidate === true && qishaTianfuRelation === '冲' ? true : undefined;
    const qishaTianfuActiveWitness = qishaTianfuActiveCandidate === true ? {
      qishaBranch, tianfuBranch, guardScopes: verifiedQisha.activeScopes,
    } : undefined;
    const wuqu = verifiedAtHalf('武曲'), tanlang = verifiedAtHalf('贪狼');
    const tiantong = verifiedAtHalf('天同'), lianzhen = verifiedAtHalf('廉贞');
    const tianliang = verifiedAtHalf('天梁'), wenqu = verifiedAtHalf('文曲');
    const tianji = verifiedAtHalf('天机');
    return { start, end, data: { profile: quanshuLimitTimingPolicy.profile, lunarYear, halves, qisha, pojun,
      qishaPhaseCandidate: qisha.candidate, pojunPhaseCandidate: pojun.candidate,
      limitPlacementProof: quanshuLimitPlacementProof, starPlacementProof: limits.starPlacementProof,
      sourceDecadalVerified: limits.sourceDecadal?.verified,
      sourceMinorVerified: limits.sourceMinor?.verified, ziweiBirthAnchorVerified, unverifiedTimingStars,
      verifiedStarTimings: [verifiedQisha, verifiedPojun, wuqu, tanlang, tiantong, lianzhen, tianliang, wenqu, tianji,
        verifiedAtHalf('文昌')],
      qishaVerifiedPhaseCandidate: verifiedQisha.candidate, wuquPhaseCandidate: wuqu.candidate, tanlangPhaseCandidate: tanlang.candidate,
      qishaTianfuActiveCandidate, qishaTianfuActiveWitness,
      tiantongPhaseCandidate: tiantong.candidate, lianzhenPhaseCandidate: lianzhen.candidate, tianjiPhaseCandidate: tianji.candidate,
      tianliangPhaseCandidate: tianliang.candidate, wenquPhaseCandidate: wenqu.candidate } };
  });
}
