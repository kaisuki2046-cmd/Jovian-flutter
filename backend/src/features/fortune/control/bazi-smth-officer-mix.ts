import { baziColumnRoles, describeBaZiPillar, type BaziColumnRole } from './bazi-calculation';

const columns = ['year', 'month', 'day', 'hour'] as const;
type Natal = Record<typeof columns[number], string>;
type Luck = { status: 'confirmed'; pillar: string } | { status: 'before_luck' | 'unavailable' };
type OfficerKind = '正官' | '七杀';
const prosperous = ['长生', '临官', '帝旺'];

export const smthOfficerMixPolicy = {
  profile: 'smth-volume-seven-officer-mix-v1',
  archive: 'explicit-bazi-luck-gender-with-unique-recomputed-schedule-and-birth-clock',
  positions: 'four-natal-columns-with-exact-stem-placements; moving-stem-or-branch-main-qi',
  prosperity: 'month-or-hour-only-growth-phase-candidate; not-an-effect-or-use-decision',
} as const;

function controlsDayMaster(role: BaziColumnRole): role is BaziColumnRole & { god: OfficerKind } {
  return role.god === '正官' || role.god === '七杀';
}

export function baziSmthOfficerMix(natal: Natal, yearPillar: string, luck: Luck, archivedGender?: 'male' | 'female',
  priorLuckPillar?: string) {
  const profile = smthOfficerMixPolicy.profile;
  if (archivedGender !== 'female') return { profile, verifiedFemaleArchive: archivedGender === 'male' ? false : undefined };

  const dayMaster = natal.day[0];
  const native = columns.flatMap(column => baziColumnRoles(column, natal[column], dayMaster)).filter(controlsDayMaster);
  const kinds = new Set(native.map(row => row.god));
  const natalKind = kinds.size === 1 ? native[0].god : undefined;
  const natalPattern = natalKind === '正官' ? 'officer_only' : natalKind === '七杀' ? 'killer_only' : kinds.size ? 'mixed' : 'absent';
  const phaseEvidence = [...new Set(native.map(row => row.stem))].map(stem => {
    const positions = columns.map(column => ({ column, pillar: natal[column], phase: describeBaZiPillar(natal[column], stem).phase }));
    const monthPhase = positions.find(row => row.column === 'month')?.phase;
    const hourPhase = positions.find(row => row.column === 'hour')?.phase;
    const monthSupport = monthPhase !== undefined && prosperous.includes(monthPhase);
    const hourOnlySupport = hourPhase !== undefined && prosperous.includes(hourPhase)
      && native.some(row => row.column === 'hour' && row.stem === stem)
      && !positions.some(row => row.column !== 'hour' && row.phase !== undefined && prosperous.includes(row.phase));
    return { stem, positions, monthSupport, hourOnlySupport };
  });

  const moving = [...baziColumnRoles('annual', yearPillar, dayMaster),
    ...(luck.status === 'confirmed' ? baziColumnRoles('decadal', luck.pillar, dayMaster) : [])].filter(controlsDayMaster);
  const sameKind = moving.filter(row => row.god === natalKind && row.placement !== 'other_hidden');
  const differentKind = moving.filter(row => natalKind && row.god !== natalKind);
  const openDifferentKind = differentKind.filter(row => row.placement !== 'other_hidden');
  // 卷十〈看命口诀〉具名午入未之火气和子入丑之水气。仅复核实际相接两运。
  const transitionBranches = luck.status === 'confirmed' && priorLuckPillar ? priorLuckPillar[1] + luck.pillar[1] : undefined;
  const sourceRemainderStem = transitionBranches === '午未' ? '丁' : transitionBranches === '子丑' ? '癸' : undefined;
  const sourceRemainderRole = sourceRemainderStem && differentKind.find(row => row.column === 'decadal'
    && row.placement === 'other_hidden' && row.stem === sourceRemainderStem);
  const continuedSeasonOfficer = priorLuckPillar && sourceRemainderRole ? { priorLuckPillar, role: sourceRemainderRole } : undefined;
  const natalSeats = new Set(native.map(row => row.column));
  const natalVisibleSeats = new Set(native.filter(row => row.placement !== 'other_hidden').map(row => row.column));
  const singleNatalSeat = natalSeats.size === 1 && natalVisibleSeats.size === 1;
  const twoOfficerSeatsWithoutKiller = luck.status === 'unavailable' ? undefined
    : natalKind === '正官' && singleNatalSeat
      && sameKind.length > 0 && new Set(moving.map(row => row.column)).size === 1 && differentKind.length === 0;
  const fixedAuthorityCount = luck.status === 'confirmed' && moving.length === 0;
  const soleOfficerSeatWithoutKiller = luck.status === 'unavailable' ? undefined
    : fixedAuthorityCount && natalKind === '正官' && singleNatalSeat;
  const soleKillerSeatWithoutOfficer = luck.status === 'unavailable' ? undefined
    : fixedAuthorityCount && natalKind === '七杀' && singleNatalSeat;
  const twoNatalOfficerSeatsWithoutKiller = luck.status === 'unavailable' ? undefined
    : fixedAuthorityCount && natalKind === '正官' && natalSeats.size === 2 && natalVisibleSeats.size === 2;
  const multiplePureNatalKillerSeats = luck.status === 'unavailable' ? undefined
    : luck.status === 'confirmed' && natalKind === '七杀' && natalVisibleSeats.size >= 2 && differentKind.length === 0;

  return { profile, verifiedFemaleArchive: true, dayMaster, yearPillar, luckStatus: luck.status,
    luckPillar: luck.status === 'confirmed' ? luck.pillar : undefined, natalPattern, natalKind, nativePositions: native, phaseEvidence,
    natalProsperityCandidate: Boolean(natalKind && phaseEvidence.some(row => row.monthSupport || row.hourOnlySupport)),
    sameKind, differentKind, annualOppositeCandidate: openDifferentKind.some(row => row.column === 'annual'),
    luckOppositeCandidate: luck.status === 'unavailable' ? undefined : openDifferentKind.some(row => row.column === 'decadal'),
    luckSeasonRemainderOpposite: luck.status === 'unavailable' ? undefined : Boolean(continuedSeasonOfficer),
    continuedSeasonOfficer,
    twoOfficerSeatsWithoutKiller, soleOfficerSeatWithoutKiller, soleKillerSeatWithoutOfficer,
    twoNatalOfficerSeatsWithoutKiller, multiplePureNatalKillerSeats,
    useVerified: false, effectiveMixVerified: false,
  };
}
