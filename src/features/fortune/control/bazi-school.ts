import { baziElementRelation, baziInteractions, baziNatalVoidSources, describeBaZiPillar, smthNaYinBirthBranches } from './bazi-calculation';
import { smthStemGrowthBranches } from './bazi-annual-luck';
import { minorLuckOrdinal } from './bazi-minor-luck';
import { lunarAtBeijing } from './fortune-calendar';
import { civilClockEpoch } from './period-window';

const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
const layers = ['year', 'month', 'day', 'hour'] as const;
const schoolEntryPhases: Partial<Record<number, string>> = { 0: '长生', 1: '沐浴', 7: '死' };
const namedNobleSchools: Partial<Record<string, readonly string[]>> = { 己酉: ['丙子', '庚子'], 壬午: ['辛卯'] };
type Natal = Record<typeof layers[number], string>;
export const baziSchoolPolicy = {
  profile: 'smth-school-alternatives-atomic-v1',
  source: 'volume03-school-separate-four-birth-palaces-nayin-and-day-stem',
  dayPhase: 'volume2-ten-stem-birth-and-independent-engine-comparison',
  age: 'elapsed-civil-birthdays-at-exact-luck-start-not-source-five-seven',
  entry: 'smth-school-exact-entry-five-seven-age-comparisons-v2',
  effect: 'geometry-and-directed-controls-do-not-establish-damage-or-scholastic-outcome',
} as const;

function validPillar(pillar: string) {
  return typeof pillar === 'string' && pillar.length === 2 && stems.includes(pillar[0]) && branches.includes(pillar[1])
    && stems.indexOf(pillar[0]) % 2 === branches.indexOf(pillar[1]) % 2;
}

// An observed absence requires every relevant birth position. Unknown birth
// hours cannot supply either an absent school or an uninjured school.
function absence(positions: string[], allKnown: boolean) { return positions.length ? false : allKnown ? true : undefined; }

export function schoolEntryAge(birthAt: number, entryAt: number, timeZone?: string) {
  if (!Number.isSafeInteger(birthAt) || !Number.isSafeInteger(entryAt) || entryAt < birthAt) return undefined;
  const wallTime = (at: number) => timeZone
    ? civilClockEpoch(at, timeZone) + ((at % 1_000 + 1_000) % 1_000)
    : at + 8 * 3_600_000;
  let birth: Date, entry: Date;
  try {
    birth = new Date(wallTime(birthAt));
    entry = new Date(wallTime(entryAt));
  } catch {
    return undefined;
  }
  if (!Number.isFinite(birth.getTime()) || !Number.isFinite(entry.getTime())) return undefined;
  const years = entry.getUTCFullYear() - birth.getUTCFullYear();
  // Explicit civil comparison only: leap-day anniversaries roll into March 1.
  // This does not choose the source's ordinal-age or "five-seven" convention.
  const anniversary = new Date(birth);
  anniversary.setUTCFullYear(entry.getUTCFullYear());
  return years - Number(entry.getTime() < anniversary.getTime());
}

export function schoolLuckEntryAges(birthAt: number, entryAt: number, timeZone?: string) {
  const civilYears = schoolEntryAge(birthAt, entryAt, timeZone);
  if (civilYears === undefined) return undefined;
  const liChunOrdinal = minorLuckOrdinal(birthAt, entryAt)?.ordinal;
  if (liChunOrdinal === undefined) return undefined;
  const lunarOrdinal = lunarAtBeijing(entryAt).getYear() - lunarAtBeijing(birthAt).getYear() + 1;
  return { civilYears, civilClock: timeZone ? 'birthplace' : 'beijing', liChunOrdinal, lunarOrdinal };
}

// Everything in this object concerns one natal candidate and one luck stage.
// Variants stay separate; no generic Wen-chang star substitutes for Xue-tang.
export function baziSchoolContext(natal: Natal, timeKnown: boolean, luckPillar: string) {
  const present = layers.filter(layer => layer !== 'hour' || timeKnown);
  if (![...present.map(layer => natal[layer]), luckPillar].every(validPillar)) throw new RangeError('Invalid school pillars');
  const dayMaster = natal.day[0];
  const pillars = present.map(layer => ({ id: layer as string, pillar: natal[layer] }));
  const nobleSchoolPillars = namedNobleSchools[natal.year] ?? [];
  const nobleSchoolWitnesses = present.filter(position => (position === 'day' || position === 'hour')
    && nobleSchoolPillars.includes(natal[position])).map(position => ({ position, pillar: natal[position] }));
  const hasNamedNobleSchool = nobleSchoolWitnesses.length > 0 ? true : timeKnown || !nobleSchoolPillars.length ? false : undefined;
  const fourBirthPositions = present.filter(layer => '寅申巳亥'.includes(natal[layer][1]));
  const yearNaYin = describeBaZiPillar(natal.year).naYin;
  const yearNaYinElement = yearNaYin?.slice(-1), yearNaYinSchoolBranch = smthNaYinBirthBranches[yearNaYinElement ?? ''];
  const naYinPositions = present.filter(layer => natal[layer][1] === yearNaYinSchoolBranch);
  const sameNaYinPositions = naYinPositions.filter(layer => describeBaZiPillar(natal[layer]).naYin?.endsWith(yearNaYinElement!));
  const dayStart = [...branches].find(branch => describeBaZiPillar(stems[branches.indexOf(branch) % 2] + branch, dayMaster).phase === '长生')!;
  const dayMonthHourPositions = (['month', ...(timeKnown ? ['hour'] : [])] as (keyof Natal)[]).filter(layer => natal[layer][1] === dayStart);
  const standardLuck = describeBaZiPillar(luckPillar, dayMaster);
  const directSourceDayStart = smthStemGrowthBranches(dayMaster).birth;
  const step = (branches.indexOf(luckPillar[1]) - branches.indexOf(directSourceDayStart))
    * (stems.indexOf(dayMaster) % 2 === 0 ? 1 : -1);
  const sourceLuckPhase = schoolEntryPhases[(step + 12) % 12];
  const daySourcePositions = (['month', ...(timeKnown ? ['hour'] : [])] as (keyof Natal)[])
    .filter(layer => natal[layer][1] === directSourceDayStart);
  const dayLongevityAbsent = absence(present.filter(layer => natal[layer][1] === directSourceDayStart), timeKnown);
  const fourBirthAbsent = absence(fourBirthPositions, timeKnown);
  const naYinAbsent = absence(naYinPositions, timeKnown);
  const daySourceAbsent = absence(daySourcePositions, timeKnown);
  const sourceSchoolAbsenceCandidate = [fourBirthAbsent, naYinAbsent, daySourceAbsent].includes(true) ? true
    : timeKnown ? false : undefined;
  const luckSchoolRelations = sourceLuckPhase === '长生'
    ? baziInteractions([{ id: 'luck', pillar: luckPillar }, ...pillars]) : undefined;
  const luckSchoolContacts = luckSchoolRelations
    ? luckSchoolRelations.pairs
      .filter(row => row.members[0] === 'luck' && ['六冲', '六破', '相刑'].includes(row.kind))
      .map(row => ({ kind: row.kind, position: row.members[1], pillar: natal[row.members[1] as keyof Natal] }))
    : [];
  const luckSchoolChecks = luckSchoolRelations && {
    natalColumnsComplete: timeKnown,
    voidSources: baziNatalVoidSources(natal, standardLuck.branch),
    controls: pillars.flatMap(row => {
      // Luck is the first column of this relation list, so only  后克前  here
      // means that the named natal position controls the actual luck pillar.
      const parts: string[] = luckSchoolRelations.elemental.filter(edge => edge.from === 'luck'
        && edge.to === row.id && edge.kind === '后克前').map(edge => edge.part);
      const natalNaYinElement = describeBaZiPillar(row.pillar).naYin?.slice(-1);
      if (natalNaYinElement && standardLuck.naYin
        && baziElementRelation(natalNaYinElement, standardLuck.naYin.slice(-1)) === '前克后') parts.push('nayin');
      return parts.length ? [{ position: row.id, pillar: row.pillar, parts }] : [];
    }),
  };
  const hasClashOrBreak = luckSchoolContacts.some(row => row.kind === '六冲' || row.kind === '六破');
  const hasSelfPunishment = luckSchoolContacts.some(row => row.kind === '相刑' && row.pillar[1] === standardLuck.branch);
  const sourceLuckSchoolClashOrBreak = hasClashOrBreak ? true : timeKnown || sourceLuckPhase !== '长生' ? false : undefined;
  const sourceLuckSchoolSelfPunishment = hasSelfPunishment ? true : timeKnown || sourceLuckPhase !== '长生' ? false : undefined;
  const checkedSchoolAbsenceAtLongevity = sourceLuckPhase === '长生' && !'戊己'.includes(dayMaster)
    && dayStart === directSourceDayStart && fourBirthAbsent === true && naYinAbsent === true && daySourceAbsent === true
    && dayLongevityAbsent === true && hasNamedNobleSchool === false && !luckSchoolContacts.length && luckSchoolChecks?.voidSources.length === 0
    && luckSchoolChecks.controls.length === 0;
  const witnesses = [
    ...fourBirthPositions.map(position => ({ variant: 'four_birth_palaces', position })),
    ...naYinPositions.map(position => ({ variant: 'year_nayin_birth', position })),
    ...dayMonthHourPositions.map(position => ({ variant: 'day_month_hour_comparison', position })),
  ].map(witness => {
    const target = witness.position, targetPillar = natal[target];
    const others = [...pillars.filter(p => p.id !== target), { id: 'luck', pillar: luckPillar }];
    const relations = baziInteractions([{ id: target, pillar: targetPillar }, ...others]);
    const controls = relations.elemental.filter(r => r.part === 'stem' && (r.kind === '前克后' || r.kind === '后克前'))
      .map(r => ({ from: r.kind === '前克后' ? r.from : r.to, to: r.kind === '前克后' ? r.to : r.from }))
      .filter(r => r.to === target);
    const elementOrder = '木火土金水', targetElement = describeBaZiPillar(targetPillar).naYin?.slice(-1);
    const naYinControls = others.filter(other => {
      const from = describeBaZiPillar(other.pillar).naYin?.slice(-1);
      return from && targetElement && (elementOrder.indexOf(targetElement) - elementOrder.indexOf(from) + 5) % 5 === 2;
    }).map(other => other.id);
    return { ...witness, pillar: targetPillar,
      natalYearVoid: describeBaZiPillar(natal.year).voidBranches.includes(targetPillar[1]),
      natalDayVoid: describeBaZiPillar(natal.day).voidBranches.includes(targetPillar[1]),
      branchContacts: relations.pairs.filter(r => r.members.includes(target) && ['六冲', '六破', '相刑'].includes(r.kind))
        .map(r => ({ kind: r.kind, other: r.members.find(id => id !== target)! })),
      stemControls: controls.map(r => r.from), naYinControls };
  });
  return { profile: baziSchoolPolicy.profile, dayMaster, timeKnown, luckPillar,
    fourBirthPositions, fourBirthAbsent,
    yearNaYin, yearNaYinElement, yearNaYinSchoolBranch, naYinPositions, sameNaYinPositions,
    naYinAbsent,
    standardDayStartBranch: dayStart, standardDayMonthHourPositions: dayMonthHourPositions,
    standardDayMonthHourAbsent: absence(dayMonthHourPositions, timeKnown),
    directSourceDayStart, directSourceDayStartAgrees: directSourceDayStart ? dayStart === directSourceDayStart : undefined,
    daySourcePositions, daySourceAbsent, dayLongevityAbsent, sourceSchoolAbsenceCandidate, hasNamedNobleSchool, nobleSchoolWitnesses,
    sourceLuckAtDayStart: sourceLuckPhase === '长生', sourceLuckPhase, luckSchoolContacts, sourceLuckSchoolClashOrBreak,
    sourceLuckSchoolSelfPunishment, luckSchoolChecks, checkedSchoolAbsenceAtLongevity,
    standardLuckPhase: standardLuck.phase,
    luckAtYearNaYinBirth: luckPillar[1] === yearNaYinSchoolBranch,
    witnesses, injuryEffect: 'unresolved-source-void-basis-strength-and-rescue',
  };
}
