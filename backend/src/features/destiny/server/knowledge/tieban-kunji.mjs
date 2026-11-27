import { isBaZiPillar } from '../../control/charts.ts';

export const tiebanKunjiProfile = 'muxuan-kunji-known-kinship-v1';
export const tiebanKunjiParentSeriesProfile = 'guan-kunji-parent-series-v1';
const branches = '子丑寅卯辰巳午未申酉戌亥';
const stems = '甲乙丙丁戊己庚辛壬癸';
const animals = '鼠牛虎兔龙蛇马羊猴鸡狗猪';
const counts = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const fields = ['fatherBranch', 'motherBranch', 'sonBranches', 'daughterBranches', 'brotherCount', 'marriages', 'teacherPillar', 'calibrationAge'];
const validBranch = value => typeof value === 'string' && value.length === 1 && branches.includes(value);
const validPillar = value => typeof value === 'string' && isBaZiPillar(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function parseTiebanKunjiFacts(value) {
  if (!object(value) || !Object.keys(value).length || Object.keys(value).some(field => !fields.includes(field))) return null;
  const { fatherBranch, motherBranch, sonBranches, daughterBranches, brotherCount, marriages, teacherPillar, calibrationAge } = value;
  const validChildren = group => Array.isArray(group) && group.length >= 1 && group.length <= 12 && group.every(validBranch);
  if (fatherBranch !== undefined && !validBranch(fatherBranch)
    || motherBranch !== undefined && !validBranch(motherBranch)
    || sonBranches !== undefined && !validChildren(sonBranches)
    || daughterBranches !== undefined && !validChildren(daughterBranches)
    || brotherCount !== undefined && (!Number.isInteger(brotherCount) || brotherCount < 1 || brotherCount > 12)
    || teacherPillar !== undefined && !validPillar(teacherPillar)
    || calibrationAge !== undefined && (!Number.isSafeInteger(calibrationAge) || calibrationAge < 1
      || fatherBranch === undefined && motherBranch === undefined)) return null;
  if (marriages !== undefined && (!Array.isArray(marriages) || !marriages.length || marriages.length > 4
    || marriages.some(item => !object(item) || Object.keys(item).length !== 2
      || !Object.hasOwn(item, 'order') || !Object.hasOwn(item, 'pillar')
      || !Number.isInteger(item.order) || item.order < 1 || item.order > 4 || !validPillar(item.pillar))
    || new Set(marriages.map(item => item.order)).size !== marriages.length)) return null;
  const parsed = {
    ...(fatherBranch !== undefined && { fatherBranch }),
    ...(motherBranch !== undefined && { motherBranch }),
    ...(sonBranches !== undefined && { sonBranches: [...new Set(sonBranches)] }),
    ...(daughterBranches !== undefined && { daughterBranches: [...new Set(daughterBranches)] }),
    ...(brotherCount !== undefined && { brotherCount }),
    ...(calibrationAge !== undefined && { calibrationAge }),
    ...(marriages !== undefined && { marriages: marriages.map(({ order, pillar }) => ({ order, pillar })) }),
    ...(teacherPillar !== undefined && { teacherPillar }),
  };
  return Object.keys(parsed).length ? parsed : null;
}

// 坤集密数总表, 宫甲流度表 and the supplied grid cross-check.
// Use the corrected father and mother numbers without changing clause text.
const parentNumbers = {
  father: [9003, 9053, 9103, 9163, 9203, 9253, 9303, 9353, 9403, 9453, 9503, 9553],
  mother: [9605, 9655, 9705, 9755, 9805, 9855, 9905, 9955, 10005, 10055, 10105, 10175],
};
const pillarGridBases = {
  wife: 9767, second_wife: 9818, fourth_wife: 12002,
  husband: 10363, second_husband: 12406, third_husband: 11126,
  same_couple: 11003, teacher: 11045,
};
const marriageTables = {
  男: ['wife', 'second_wife', 'third_wife', 'fourth_wife'],
  女: ['husband', 'second_husband', 'third_husband'],
};

function pillarNumber(table, pillar) {
  // The second-husband grid is displaced by one slot in the supplied text.
  // Preserve the printed opening numbers for the starting cells.
  if (table === 'second_husband' && pillar === '甲子') return 12396;
  if (table === 'second_husband' && pillar === '丙子') return 12406;
  const [stem, branch] = pillar;
  return pillarGridBases[table] + 50 * branches.indexOf(branch) + 10 * Math.floor(stems.indexOf(stem) / 2);
}

export function tiebanKunjiCalculation(value, birthYearPillar, gender) {
  const facts = parseTiebanKunjiFacts(value);
  if (!facts) return null;
  const { fatherBranch, motherBranch, sonBranches, daughterBranches, brotherCount, marriages = [], teacherPillar } = facts;
  const candidates = [];
  const add = (table, key, clauseId) => candidates.push({
    axis: 'kunji_known_kinship', clauseId, requiresSelection: true, kinshipFact: { table, key },
  });
  if (fatherBranch) add('father', fatherBranch, parentNumbers.father[branches.indexOf(fatherBranch)]);
  if (motherBranch) add('mother', motherBranch, parentNumbers.mother[branches.indexOf(motherBranch)]);
  if (fatherBranch && fatherBranch === motherBranch) add('same_parents', fatherBranch, 9024 + 120 * branches.indexOf(fatherBranch));
  for (const branch of sonBranches ?? []) add('son', branch, 12123 + 10 * branches.indexOf(branch));
  for (const branch of daughterBranches ?? []) add('daughter', branch, 12243 + 10 * branches.indexOf(branch));
  if (brotherCount !== undefined) add('brothers', brotherCount, 9853 + 10 * brotherCount);
  if (teacherPillar) add('teacher', teacherPillar, pillarNumber('teacher', teacherPillar));
  let unavailable = false;
  for (const { order, pillar } of marriages) {
    const table = marriageTables[gender][order - 1];
    if (!table) {
      unavailable = true;
      continue;
    }
    if (table === 'third_wife') {
      add(table, pillar[1], 10622 + 10 * branches.indexOf(pillar[1]));
    } else {
      add(table, pillar, pillarNumber(table, pillar));
    }
    if (order === 1 && pillar === birthYearPillar) add('same_couple', pillar, pillarNumber('same_couple', pillar));
  }
  return {
    profile: tiebanKunjiProfile, libraryEdition: 'muxuan-json', candidates,
    ...(unavailable && { status: candidates.length ? 'partial' : 'unavailable', reason: 'kinship_table_unavailable' }),
  };
}

export function tiebanKunjiParentSeries({ candidates, libraryEdition }, calibrationAge) {
  // 《铁版神数入门诀窍秘笈》乾、坤宫甲流度考六亲：each known parent starts a separate series.
  const parents = candidates.filter(({ kinshipFact }) => ['father', 'mother'].includes(kinshipFact.table));
  if (!parents.length) return null;
  return {
    profile: tiebanKunjiParentSeriesProfile, libraryEdition,
    candidates: parents.flatMap(({ clauseId: baseClauseId, kinshipFact }) =>
      [1, 2, 3, 4].map(step => ({
        axis: 'kunji_parent_series', clauseId: baseClauseId + 96 * step, requiresSelection: true,
        parentSeries: { ...kinshipFact, baseClauseId, step },
        ...(calibrationAge !== undefined && { annualLookupAge: calibrationAge }),
      }))),
  };
}

export function tiebanKunjiParentSeriesTextConflicts(candidate, claim) {
  // The book describes 9645 as a longevity entry in the father-You example.
  // The supplied JSON instead labels it as the mother's birth pillar.
  return candidate.parentSeries.baseClauseId === 9453 && candidate.parentSeries.step === 2
    && /^母命/u.test(claim.evidence.original_text.trim().replace(/^[（(]\d+[）)]\s*/u, ''));
}

const pillarPatterns = {
  wife: '妻命(?:生于)?',
  second_wife: '再(?:娶|配)',
  fourth_wife: '四(?:娶|配)',
  husband: '夫命',
  second_husband: '(?:再嫁|二嫁|重嫁|再配|嫁夫)',
  third_husband: '(?:三嫁|主嫁|主有|嫁)',
  same_couple: '夫妻(?:同)?',
  teacher: '师命',
};

export function tiebanKunjiTextConflicts({ table, key }, claim) {
  const text = claim.evidence.original_text.trim().replace(/^[（(]\d+[）)]\s*/u, '');
  if (Object.hasOwn(pillarPatterns, table)) return !new RegExp(pillarPatterns[table] + key, 'u').test(text);
  if (table === 'brothers') return !text.startsWith('兄弟' + counts[key - 1] + '人');
  const animal = animals[branches.indexOf(key)];
  const label = animal === '狗' ? '[狗犬]' : animal;
  switch (table) {
    case 'father': return !new RegExp('^父(?:命|年)' + label + '年', 'u').test(text);
    case 'mother': return !new RegExp('^母命' + label + '年', 'u').test(text);
    case 'same_parents': return !new RegExp('^父母(?:全|同|俱)属' + label, 'u').test(text);
    case 'son': return !new RegExp('^子属' + label, 'u').test(text);
    case 'daughter': return !new RegExp('^女属' + label, 'u').test(text);
    case 'third_wife': return !new RegExp('三妻' + label + '命|三娶' + label + '命|又一妻，' + label + '命', 'u').test(text)
      && !(key === '申' && text === '连刑玉人，申命犯克。');
    default: return true;
  }
}
