import { baziPillars, isBaZiPillar } from '../../control/charts.ts';
import { parseChenHuangjiKeSteps } from '../../model/tieban-ke.ts';
import { compatibleBaZiLiteralFacts } from './bazi-literal-conditions.mjs';
import { confirmedBaZiDecadalPeriods } from './bazi-decadal-periods.mjs';
import { tiebanKunjiCalculation, tiebanKunjiParentSeries, tiebanKunjiParentSeriesProfile, tiebanKunjiParentSeriesTextConflicts,
  tiebanKunjiProfile, tiebanKunjiTextConflicts } from './tieban-kunji.mjs';

export const tiebanProfile = 'muxuan-taixuan-base-v1';
export const taiXuanFormsProfile = 'muxuan-taixuan-forms-v1';
export const huangjiProfile = 'muxuan-huangji-base-v1';
export const dayHexagramProfile = 'muxuan-day-hexagram-v1';
export const heluoProfile = 'muxuan-heluo-v1';
export const tiebanDecadalProfile = 'muxuan-decadal-base-v1';
export const tiebanBookAnnualProfile = 'muxuan-book-annual-reconstruction-v1';
export const tianyuanYearProfile = 'zhuo-tianyuan-year-series-v1';
export const tianyuanNetworkProfile = 'zhuo-tianyuan-number-network-v1';
export const tianyuanNetworkRelatedProfile = 'zhuo-tianyuan-network-related-v1';
export const chenHeluoLinesProfile = 'chen-nineteen-methods-heluo-lines-v1';
export const chenHeluoNajiaProfile = 'chen-nineteen-methods-heluo-najia-v1';
export const chenHeluoTotalsProfile = 'chen-nineteen-methods-heluo-totals-v1';
export const chenHuangjiStemProfile = 'chen-nineteen-methods-huangji-stems-v1';
export const chenHuangjiKeProfile = 'chen-nineteen-methods-huangji-ke-v1';
export const chenRangeTrigramProfile = 'chen-nineteen-methods-range-trigrams-v1';
export const chenRangeLineProfile = 'chen-nineteen-methods-range-lines-v1';
export const guanFrontBackProfile = 'guan-front-back-hexagrams-v1';
export const chenKinshipTablesProfile = 'chen-nineteen-methods-kinship-tables-v1';
export const chenKinshipKeProfile = 'chen-nineteen-methods-kinship-ke-v1';
export const chenKinshipSequenceProfile = 'chen-nineteen-methods-kinship-sequence-v1';
export const chenStemSequenceProfile = 'chen-nineteen-methods-stem-sequence-v1';
export const chenPillarLinesProfile = 'chen-nineteen-methods-pillar-lines-v1';
export const chenDayLinesProfile = 'chen-nineteen-methods-day-lines-v1';
export const chenPillarNajiaProfile = 'chen-nineteen-methods-pillar-najia-v1';
export const chenDayNajiaProfile = 'chen-nineteen-methods-day-najia-v1';
export const chenDecadalProfile = 'chen-nineteen-methods-decadal-v1';
export const chenAnnualProfile = 'chen-nineteen-methods-annual-v1';
const jsonEdition = 'muxuan-json';
export const tiebanFourteenEdition = 'muxuan-fourteen-table-csv';
const taiXuan = new Map(['巳亥', '戊癸辰戌', '丁壬卯酉', '丙辛寅申', '乙庚丑未', '甲己子午']
  .flatMap((group, index) => [...group].map(character => [character, index + 4])));
const earlierOrder = ' 乾兑离震巽坎艮坤';
const laterOrder = ' 坎坤震巽 乾兑艮离';
// Lines are listed from the bottom of each trigram.
const lines = { 乾: '111', 兑: '110', 离: '101', 震: '100', 巽: '011', 坎: '010', 艮: '001', 坤: '000' };
const trigramByLines = new Map(Object.entries(lines).map(([name, pattern]) => [pattern, name]));
// 乾集 §§5,14,20. The supplied edition places 卯 in 乾 and 申 in 艮.
const dayStemTrigrams = { 甲: '乾', 乙: '坤', 丙: '艮', 丁: '兑', 戊: '坎', 己: '离', 庚: '震', 辛: '巽', 壬: '乾', 癸: '坤' };
const dayBranchTrigrams = { 子: '坎', 丑: '坤', 寅: '震', 卯: '乾', 辰: '兑', 巳: '离', 午: '离', 未: '艮', 申: '艮', 酉: '乾', 戌: '巽', 亥: '坎' };
const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';
const zodiacAnimals = '鼠牛虎兔龙蛇马羊猴鸡狗猪';
const heluoBranches = [[1, 6], [5, 10], [3, 8], [3, 8], [5, 10], [2, 7],
  [2, 7], [5, 10], [4, 9], [4, 9], [5, 10], [1, 6]];
// 乾集 §26：甲己乙庚四，丙辛六，丁壬戊癸三。
const decadalStemNumbers = [4, 4, 6, 3, 3, 4, 4, 6, 3, 3];
const chenAnnualStemPairs = ['甲己', '乙庚', '丁壬', '戊癸', '丙辛'];
const stemNumber = stem => decadalStemNumbers[stems.indexOf(stem)];
const branchLifeNumber = branch => heluoBranches[branches.indexOf(branch)][0];
export const isTiebanBookAnnualAge = age => Number.isInteger(age) && age >= 1 && age <= 100;
const solarMidpoints = ['冬至', '大寒', '雨水', '春分', '谷雨', '小满', '夏至', '大暑', '处暑', '秋分', '霜降', '小雪'];
const najia = {
  乾: ['甲子', '甲寅', '甲辰', '壬午', '壬申', '壬戌'],
  兑: ['丁巳', '丁卯', '丁丑', '丁亥', '丁酉', '丁未'],
  离: ['己卯', '己丑', '己亥', '己酉', '己未', '己巳'],
  震: ['庚子', '庚寅', '庚辰', '庚午', '庚申', '庚戌'],
  巽: ['辛丑', '辛亥', '辛酉', '辛未', '辛巳', '辛卯'],
  坎: ['戊寅', '戊辰', '戊午', '戊申', '戊戌', '戊子'],
  艮: ['丙辰', '丙午', '丙申', '丙戌', '丙子', '丙寅'],
  坤: ['乙未', '乙巳', '乙卯', '癸丑', '癸亥', '癸酉'],
};
const pillarSum = ([stem, branch]) => taiXuan.get(stem) + taiXuan.get(branch);
const earlierTrigram = sum => earlierOrder[sum % 8 || 8];
// 第七法 lists an earlier order in the hint but these later trigrams in
// the worked chart. Use only the sums explicitly paired with a trigram there.
const chenRangeLineTrigrams = new Map([[12, '巽'], [13, '震'], [17, '离']]);

function mutualTrigrams(upper, lower) {
  const hexagram = lines[lower] + lines[upper];
  return [trigramByLines.get(hexagram.slice(2, 5)), trigramByLines.get(hexagram.slice(1, 4))];
}

function clausePrefix(upperNumber) {
  // The supplied 八卦加则 implementation uses 1 when adding 6 gives 10.
  const thousands = (upperNumber + 6) % 10 || 1;
  return 1000 * thousands + 100 * upperNumber;
}

function baseNumber(axis, order, upper, lower, prefixFor = clausePrefix) {
  const [mutualUpper, mutualLower] = mutualTrigrams(upper, lower);
  const clauseId = prefixFor(order.indexOf(upper))
    + 10 * order.indexOf(mutualUpper) + order.indexOf(mutualLower);
  return { axis, clauseId, upper, lower, mutualUpper, mutualLower };
}

function najiaSum(trigram, side) {
  const pillars = side === 'upper' ? najia[trigram].slice(3) : najia[trigram].slice(0, 3);
  // 遇十不用 drops only a line whose complete stem/branch sum equals ten.
  return pillars.map(pillarSum).filter(value => value !== 10).reduce((total, value) => total + value, 0);
}

function chenLineNumber(upper, lower) {
  const yang = [...(lines[upper] + lines[lower])].filter(line => line === '1').length;
  const yin = 6 - yang;
  // Each polarity starts at 30 and counts up by 30 independently.
  const lineTotal = 15 * (yang * (yang + 1) + yin * (yin + 1));
  return { clauseId: 1000 * laterOrder.indexOf(upper) + lineTotal - laterOrder.indexOf(lower),
    upper, lower, lineTotal };
}

function rangeLineOffsets(axis, rangeLineBase, step) {
  return [1, 2, 3, 4].map(index => {
    const lineOffset = step * index;
    return { axis, clauseId: rangeLineBase + lineOffset, rangeLineBase, lineOffset };
  });
}

function chenRangeLineNumbers([year, month, day, hour]) {
  const pairs = [
    ['year_month', year, month, 96],
    ['day_hour', day, hour, -96],
  ];
  const candidates = pairs.flatMap(([pair, upperSum, lowerSum, step]) => {
    const upper = chenRangeLineTrigrams.get(upperSum), lower = chenRangeLineTrigrams.get(lowerSum);
    if (!upper || !lower) return [];
    const base = chenLineNumber(upper, lower);
    return [
      { axis: `chen_range_lines_${pair}_base`, ...base, upperSum, lowerSum },
      ...rangeLineOffsets(`chen_range_lines_${pair}_offset`, base.clauseId, step),
    ];
  });
  return {
    profile: chenRangeLineProfile, libraryEdition: jsonEdition, candidates,
    ...(candidates.length < 10 && { status: candidates.length ? 'partial' : 'unavailable', reason: 'unverified_range_trigram' }),
  };
}

function guanFrontBackNumbers(sums) {
  // 《铁版神数入门诀窍秘笈》印页 115–116. The valid pillars give
  // 9–18. Subtract eight once, or drop ten from the original sum
  // when the result is five or ten, which have no Later Heaven trigram.
  const [year, month, day, hour] = sums.map(sum => {
    const reduced = sum - 8;
    return laterOrder[reduced === 5 || reduced === 10 ? sum - 10 : reduced];
  });
  const front = chenLineNumber(year, month).clauseId;
  const back = chenLineNumber(day, hour).clauseId;
  return {
    profile: guanFrontBackProfile, libraryEdition: jsonEdition,
    candidates: [
      ...rangeLineOffsets('guan_front_hexagram', front, 96),
      ...rangeLineOffsets('guan_back_hexagram', back, -96),
    ],
  };
}

function chenNajiaNumber(upper, lower) {
  const upperTotal = najiaSum(upper, 'upper'), lowerTotal = najiaSum(lower, 'lower');
  return { clauseId: 100 * upperTotal + lowerTotal, upper, lower, upperTotal, lowerTotal };
}

function chenPillarCalculations(pillars, gender) {
  // Methods 8 through 11 all take the stem as upper and the branch as lower.
  const paired = pillars.map(([stem, branch], index) => ({
    position: baziPillars[index], upper: dayStemTrigrams[stem], lower: dayBranchTrigrams[branch],
  }));
  const lineCandidates = paired.map(({ position, upper, lower }) =>
    ({ axis: `chen_pillar_lines_${position}`, ...chenLineNumber(upper, lower) }));
  const najiaCandidates = paired.map(({ position, upper, lower }) =>
    ({ axis: `chen_pillar_najia_${position}`, ...chenNajiaNumber(upper, lower) }));
  // Method 9 uses the same day number as Method 8, then gives four
  // numbers in each direction. The printed count of eight excludes the base.
  const dayLineBase = lineCandidates[2].clauseId;
  const dayLineCandidates = [1, -1].flatMap(direction =>
    Array.from({ length: 4 }, (_, index) => {
      const lineOffset = 96 * (index + 1) * direction;
      return { axis: direction === 1 ? 'chen_day_lines_plus' : 'chen_day_lines_minus',
        clauseId: dayLineBase + lineOffset, dayLineBase, lineOffset };
    }));
  const day = najiaCandidates[2];
  // Method 11 allows a single 96 offset. The supplement gives its
  // direction by natal year stem polarity and gender for a natal chart.
  const forward = (stems.indexOf(pillars[0][0]) % 2 === 0) === (gender === '男');
  const offset = forward ? 96 : -96;
  return [
    { profile: chenPillarLinesProfile, libraryEdition: jsonEdition, candidates: lineCandidates },
    { profile: chenDayLinesProfile, libraryEdition: jsonEdition, candidates: dayLineCandidates },
    { profile: chenPillarNajiaProfile, libraryEdition: jsonEdition, candidates: najiaCandidates },
    { profile: chenDayNajiaProfile, libraryEdition: jsonEdition, candidates: [
      { ...day, axis: 'chen_day_najia_base' },
      { axis: forward ? 'chen_day_najia_next' : 'chen_day_najia_previous', clauseId: day.clauseId + offset },
    ] },
  ];
}

function tianyuanPillarNumber([stem, branch]) {
  // 卓宏，《新玄機》221〈鐵版神數第一數〉. The stem supplies the upper
  // trigram, unlike the direct day-pillar method in 演算法式 §4.
  const upper = dayStemTrigrams[stem], lower = dayBranchTrigrams[branch];
  const lineSum = pillars => pillars.reduce((sum, [, branch]) => sum + 30 * (Math.floor(branches.indexOf(branch) / 2) + 1), 0);
  const upperTotal = lineSum(najia[upper].slice(3));
  const lowerTotal = lineSum(najia[lower].slice(0, 3));
  const clauseId = 1000 * laterOrder.indexOf(upper) + upperTotal + lowerTotal + laterOrder.indexOf(lower);
  return { clauseId, upper, lower, upperTotal, lowerTotal };
}

const tianyuanRelatedNumbers = first => Array.from({ length: 6 }, (_, index) => first + 96 * (index + 1));

function tianyuanYearNumbers(first) {
  return {
    profile: tianyuanYearProfile, libraryEdition: jsonEdition,
    candidates: [
      { axis: 'tianyuan_year_first', ...first },
      ...tianyuanRelatedNumbers(first.clauseId).map(clauseId => ({ axis: 'tianyuan_year_related', clauseId })),
    ],
  };
}

function tianyuanNetworkNumbers(pillarNumbers) {
  // 卓宏，《新玄機》223〈陳堯寬老師講鐵版命運之網〉. The horizontal
  // rows copy the mapped digits. 酉 pairs with 乾 (6), as in both articles.
  const digits = pillarNumbers.map(({ upper, lower }) => [laterOrder.indexOf(upper), laterOrder.indexOf(lower)]);
  const copiedNumber = (axis, digits) => ({ axis, clauseId: Number(digits.join('')), digits });
  return { profile: tianyuanNetworkProfile, libraryEdition: jsonEdition, candidates: [
    copiedNumber('tianyuan_horizontal_stems', digits.map(([stem]) => stem)),
    copiedNumber('tianyuan_horizontal_branches', digits.map(([, branch]) => branch)),
    copiedNumber('tianyuan_horizontal_year_month', digits.slice(0, 2).flat()),
    copiedNumber('tianyuan_horizontal_day_hour', digits.slice(2).flat()),
    ...['month', 'day', 'hour'].map((position, index) => ({ axis: `tianyuan_${position}_first`, ...pillarNumbers[index + 1] })),
  ] };
}

function tianyuanNetworkRelatedNumbers(roots) {
  // Issue 221 gives eight roots with six related numbers each, but prints
  // the +96 sequence only for the year pillar. Issue 223 identifies the other roots.
  return {
    profile: tianyuanNetworkRelatedProfile,
    libraryEdition: jsonEdition,
    status: 'partial',
    reason: 'related_offset_inferred',
    candidates: roots.flatMap(({ axis: rootAxis, clauseId: initialNumber }) =>
      tianyuanRelatedNumbers(initialNumber).map((clauseId, index) => ({
        axis: 'tianyuan_network_related', rootAxis, initialNumber, additionStep: index + 1,
        clauseId, requiresSelection: true,
      }))),
  };
}

function tianyuanSourceTextConflicts(profile, clauseId, claim) {
  // In 卓宏's printed series, 6825 concerns a nephew (猶子). The
  // imported JSON version instead describes an only son (獨子).
  return (profile === tianyuanYearProfile || profile === tianyuanNetworkRelatedProfile) && clauseId === 6825
    && Boolean(claim && /[独獨]子/u.test(claim.evidence.original_text));
}

function dayHexagramNumbers([dayStem, dayBranch], yearTrigram, monthTrigram) {
  const dayUpper = najiaSum(dayBranchTrigrams[dayBranch], 'upper');
  const dayLower = najiaSum(dayStemTrigrams[dayStem], 'lower');
  const prefix = clausePrefix(earlierOrder.indexOf(monthTrigram));
  const earlierDigits = (upper, lower) => 10 * earlierOrder.indexOf(upper) + earlierOrder.indexOf(lower);
  const [mutualUpper, mutualLower] = mutualTrigrams(yearTrigram, monthTrigram);
  // 演算法式 §4 lists the direct 日柱 number and five distinct 年月 forms.
  return [
    { axis: 'day_hexagram', clauseId: 100 * dayUpper + dayLower },
    { axis: 'year_month_upper_najia', clauseId: prefix + najiaSum(yearTrigram, 'upper') },
    { axis: 'year_month_lower_najia', clauseId: prefix + najiaSum(monthTrigram, 'lower') },
    { axis: 'year_month_original', clauseId: prefix + earlierDigits(yearTrigram, monthTrigram) },
    { axis: 'year_month_mutual', clauseId: prefix + earlierDigits(mutualUpper, mutualLower) },
    { axis: 'year_month_swapped', clauseId: prefix + earlierDigits(monthTrigram, yearTrigram) },
  ];
}

// Reverse each of the two separate pillar sums. A sum of 10 reverses
// to 1, while a one-digit sum stays unchanged.
function reversedSum(number) {
  return number < 10 ? number : 10 * (number % 10) + Math.floor(number / 10);
}

function chenHuangjiStemNumbers(pillars, yuanHui, yunShi) {
  // Method 4(1) uses the same five additions for both of the Huangji bases.
  const [year, month, day, hour] = pillars.map(([stem]) => taiXuan.get(stem));
  const additions = [
    ['base', 0], ['month', 100 * month], ['day', 10 * day],
    ['hour', hour], ['day_hour', 10 * day + hour],
  ];
  return {
    profile: chenHuangjiStemProfile, libraryEdition: jsonEdition,
    candidates: [['yuan_hui', yuanHui], ['yun_shi', yunShi]].flatMap(([form, base]) =>
      additions.map(([step, offset]) => ({
        axis: `chen_huangji_${form}_${step}`, clauseId: base + 1000 * year + offset,
      }))),
  };
}

function chenHuangjiKeNumbers(pillars, yuanHui, yunShi, steps) {
  const [year, month, day, hour] = pillars.map(pillar => [...pillar].map(part => taiXuan.get(part)));
  const candidates = [['yearMonth', yuanHui], ['dayHour', yunShi]].flatMap(([group, sum]) => {
    const keSteps = steps[group];
    if (keSteps === undefined) return [];
    const initialNumber = sum + 1_000 * year[0];
    const base = initialNumber + 30 * keSteps;
    const dayNumber = base + 10 * day[0] + day[1];
    return [
      base, base + 100 * month[0], base + 100 * month[1],
      dayNumber, dayNumber + hour[0], dayNumber + hour[0] + hour[1],
    ].map((rawClauseId, index) => ({
      axis: group === 'yearMonth' ? 'chen_huangji_ke_year_month' : 'chen_huangji_ke_day_hour',
      calculationStep: index + 1, keSteps, initialNumber, rawClauseId,
      clauseId: rawClauseId <= 13_000 ? rawClauseId : 1_001 + (rawClauseId - 1_001) % 12_000,
      requiresSelection: true,
    }));
  });
  return { profile: chenHuangjiKeProfile, libraryEdition: jsonEdition, candidates };
}

function chenClausePrefix(upperNumber) {
  // Follow Chen's "discard ten" literally. For upper 震, keep the leading zero
  // and let the catalog return a miss for a number outside its range.
  return 1000 * ((upperNumber + 6) % 10) + 100 * upperNumber;
}

function chenRangeTrigramNumbers([year, , day], sums) {
  const [yearTrigram, monthTrigram, dayTrigram, hourTrigram] = sums.map(earlierTrigram);
  // Method 5 puts the second pillar of each pair above the first. Method 6
  // repeats the year/month mutual-trigram number as its first ke candidate.
  const pairs = [
    ['year_month', year, monthTrigram, yearTrigram],
    ['day_hour', day, hourTrigram, dayTrigram],
  ];
  return {
    profile: chenRangeTrigramProfile, libraryEdition: jsonEdition,
    candidates: pairs.flatMap(([axis, [stem, branch], upper, lower]) => {
      const prefix = chenClausePrefix(earlierOrder.indexOf(upper));
      return [
        { axis: `chen_range_${axis}_stem_branch`, clauseId: prefix + 10 * taiXuan.get(stem) + taiXuan.get(branch), upper, lower },
        baseNumber(`chen_range_${axis}_mutual`, earlierOrder, upper, lower, chenClausePrefix),
      ];
    }),
  };
}

// Method 3, pp. 5–8, gives one number table per pillar in the worked chart.
// The supplied 宫甲流度表 identifies the 金宫 as 夫 and corrects the
// swapped child headings. The numerical entries remain those of the scan.
const chenKinshipTables = [
  { pillar: 'year', upperDigit: 1, lowerDigit: 4, rows: [['父', 9003, 50], ['母', 9605, 50]] },
  { pillar: 'month', upperDigit: 4, lowerDigit: 3, rows: [['兄', 10340, 10], ['弟', 11014, 10], ['姐', 11164, 10], ['妹', 11284, 10]] },
  { pillar: 'day', upperDigit: 1, lowerDigit: 9, rows: [['妻', 9767, 50], ['夫', 10363, 50]] },
  { pillar: 'hour', upperDigit: 4, lowerDigit: 6, rows: [['子', 12123, 10], ['女', 12243, 10]] },
];

function chenKinshipTableNumbers(pillars) {
  const reduce = number => number === 10 ? 1 : number % 10;
  const verifiedTables = chenKinshipTables.filter(({ upperDigit, lowerDigit }, index) => {
    const [stem, branch] = pillars[index];
    const stemValue = laterOrder.indexOf(dayStemTrigrams[stem]);
    const [growth, completion] = heluoBranches[branches.indexOf(branch)];
    const [upperBranchValue, lowerBranchValue] = index < 2 ? [completion, growth] : [growth, completion];
    // The center can only move to 艮、坤、离 or 兑, which cannot turn a
    // 5 into any of the documented pillar coordinates (day lower is never 5).
    return reduce(stemValue + upperBranchValue) === upperDigit && reduce(lowerBranchValue) === lowerDigit;
  });
  if (!verifiedTables.length) return null;
  const candidates = verifiedTables.flatMap(({ pillar, upperDigit, lowerDigit, rows }) =>
    rows.flatMap(([relative, base, step]) => [...branches].map((branch, order) => ({
      axis: 'chen_kinship_table',
      clauseId: base + step * order,
      requiresSelection: true,
      kinshipTable: { pillar, relative, branch, upper: laterOrder[upperDigit], lower: laterOrder[lowerDigit] },
    }))));
  return {
    profile: chenKinshipTablesProfile, libraryEdition: jsonEdition, candidates,
    ...(verifiedTables.length < chenKinshipTables.length && { status: 'partial', reason: 'kinship_table_unverified' }),
  };
}

const kinshipZodiacPrefixes = {
  父: ['父命', '父年'], 母: ['母命'], 兄: ['兄属'], 弟: ['弟属'],
  姐: ['姊属', '姐属'], 妹: ['妹属'], 子: ['子属'], 女: ['女属'],
};

function chenKinshipTableSourceConflicts(table, claim) {
  if (!table || !claim) return false;
  const { relative, branch } = table;
  const text = claim.evidence.original_text.trim();
  if (relative === '妻' || relative === '夫') {
    return ![...stems].some(stem => text.startsWith(relative + '命' + stem + branch));
  }
  const animal = zodiacAnimals[branches.indexOf(branch)];
  const labels = animal === '狗' ? ['狗', '犬'] : [animal];
  const suffix = relative === '父' || relative === '母' ? '年' : '';
  return !kinshipZodiacPrefixes[relative].some(prefix => labels.some(label => text.startsWith(prefix + label + suffix)));
}

export function tiebanSourceTextConflicts(profile, candidate, claim) {
  return tianyuanSourceTextConflicts(profile, candidate.clauseId, claim)
    || (profile === chenKinshipTablesProfile && chenKinshipTableSourceConflicts(candidate.kinshipTable, claim))
    || (profile === tiebanKunjiProfile && tiebanKunjiTextConflicts(candidate.kinshipFact, claim))
    || (profile === tiebanKunjiParentSeriesProfile && tiebanKunjiParentSeriesTextConflicts(candidate, claim));
}

const explicitCalibration = /方合|方中此刻|合此刻数|此刻(?:生人定)?不差|考[刻时時]/u;
const relative = '(?:父母|双亲|雙親|夫妻|[父母兄弟姊姐妹妻夫子女](?:亲|親)?)';
const zodiac = '[鼠牛虎兔龙龍蛇马馬羊猴鸡雞狗犬猪豬]';
const birthYearMark = `(?:[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]|[金木水火土]|${zodiac})`;
const relativeFacts = [
  zodiac, '同庚|同年生|同日生|生日同日', '[大小][一二两兩三四五六七八九十百廿卅0-9]+[岁歲]',
  `(?:命|年|生年|生[于於]|[纳納]音|同?[属屬])(?:[属屬]|生[于於])?${birthYearMark}`,
];
const relativeBirth = new RegExp(`${relative}(?:${relativeFacts.join('|')})`, 'u');

// The source catalog also contains calibration clauses with no structured prerequisite.
export function tiebanNeedsExtraFacts(originalText) {
  return explicitCalibration.test(originalText) || relativeBirth.test(originalText);
}

const chenKinshipBaseSteps = 6;
const chenKinshipOffsets = [
  [1327, -1543, 5017, 133, -97, 23, -41, 571, 1147, -2237],
  [1327, -1543, 5017, 133, -97, 23, -41, -463, 1713, 1147, -2237],
];

export function parseChenKinshipSequence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['series', 'baseStep', 'steps'].includes(key))) return null;
  const { series, baseStep, steps } = value;
  if (series !== 1 && series !== 2 || !Number.isInteger(baseStep) || baseStep < 0 || baseStep > chenKinshipBaseSteps) return null;
  const offsets = chenKinshipOffsets[series - 1];
  if (!Array.isArray(steps) || !steps.length || steps.length > offsets.length + 1) return null;
  let position = 0;
  const parsed = [];
  let total = 0;
  for (const step of steps) {
    if (!step || typeof step !== 'object' || Array.isArray(step)
      || Object.keys(step).some(key => !['offset', 'multiplier', 'age'].includes(key))) return null;
    const { offset, multiplier, age } = step;
    position = offsets.indexOf(offset, position);
    if (position < 0 || !Number.isSafeInteger(multiplier) || multiplier < 1
      || age !== undefined && !isTiebanBookAnnualAge(age)) return null;
    const shift = offset * multiplier;
    total += shift;
    // Leave room for the calculated starting number on either side of the
    // safe integer boundary. Out-of-catalog clause numbers still round-trip.
    if (!Number.isSafeInteger(shift) || Math.abs(total) > Number.MAX_SAFE_INTEGER - 20_000) return null;
    parsed.push({ offset, multiplier, ...(age !== undefined && { age }) });
  }
  return { series, baseStep, steps: parsed };
}

function chenKinshipKeNumbers(yearTrigram, monthTrigram) {
  // Method 18 gives this base for male charts and prints the first six 1327 offsets.
  const base = baseNumber('chen_kinship_ke', earlierOrder, monthTrigram, yearTrigram, chenClausePrefix);
  return {
    profile: chenKinshipKeProfile, libraryEdition: jsonEdition,
    candidates: Array.from({ length: chenKinshipBaseSteps + 1 }, (_, additionStep) => ({
      ...base,
      clauseId: base.clauseId + 1327 * additionStep,
      additionStep,
      requiresSelection: true,
    })),
  };
}

function chenKinshipSequenceNumbers(calibration, { series, baseStep, steps }) {
  const baseClauseId = calibration.candidates[baseStep].clauseId;
  let clauseId = baseClauseId;
  const candidates = steps.map(({ offset, multiplier, age }, index) => {
    const previousClauseId = clauseId;
    clauseId += offset * multiplier;
    return {
      axis: 'chen_kinship_sequence',
      clauseId,
      ...(age !== undefined && { age }),
      requiresSelection: true,
      kinshipSequence: { series, baseStep, baseClauseId, step: index + 1, previousClauseId, offset, multiplier },
    };
  });
  return { profile: chenKinshipSequenceProfile, libraryEdition: jsonEdition, candidates };
}

function chenStemSequenceNumbers([year, month, day, hour]) {
  // 陈鼎龙《铁版神数十九法秘解》第20页 lists 25 additions of 96.
  // The marks for selecting individual candidates belong to the worked chart.
  const table = '癸甲丙戊庚壬乙丁己辛';
  const base = Number([month, day, hour, year].map(([stem]) => table.indexOf(stem)).join(''));
  const furtherCandidates = Array.from({ length: 24 }, (_, index) => {
    const additionStep = index + 2;
    return {
      axis: 'chen_stem_sequence_further_addition', clauseId: base + 96 * additionStep,
      additionStep, requiresSelection: true,
    };
  });
  return {
    profile: chenStemSequenceProfile, libraryEdition: jsonEdition,
    candidates: [
      { axis: 'chen_stem_sequence_base', clauseId: base },
      { axis: 'chen_stem_sequence_first_addition', clauseId: base + 96 },
      ...furtherCandidates,
    ],
  };
}

const modulo = (value, base) => ((value % base) + base) % base;

function matchingCivilYear(birthYear, yearPillar, monthBranch) {
  if (!Number.isInteger(birthYear) || birthYear < 1 || birthYear > 9999) return false;
  const code = year => stems[modulo(year - 1984, 10)] + branches[modulo(year - 1984, 12)];
  // The civil year can already have advanced while the pillar still uses
  // the preceding year's cycle before 立春 (during 子 or 丑 months).
  return code(birthYear) === yearPillar || ('子丑'.includes(monthBranch) && code(birthYear - 1) === yearPillar);
}

function winterToSummer(facts, monthBranch) {
  const month = branches.indexOf(monthBranch);
  const precedingMidpoint = modulo(month - 1, 12);
  const values = new Set(facts.filter(fact => fact.kind === 'bazi_previous_qi').map(fact => fact.term));
  if (values.size > 1) return null;
  if (values.size === 1) {
    const midpoint = solarMidpoints.indexOf([...values][0]);
    return midpoint === month || midpoint === precedingMidpoint ? midpoint < 6 : null;
  }
  if (month === 0 || month === 6) return null;
  return month < 6;
}

function yuanTangPosition(upper, lower, hour, gender, facts, monthBranch) {
  const original = [...(lines[lower] + lines[upper])];
  const yang = [], yin = [];
  original.forEach((line, index) => (line === '1' ? yang : yin).push(index));
  if (yang.length === 3) return (hour < 6 ? yang : yin)[hour % 3];
  if (yang.length === 0 || yang.length === 6) {
    const rising = (hour < 6 ? 0 : 3) + hour % 3;
    const qian = yang.length === 6;
    if (qian === (gender === '男')) return rising;
    const season = winterToSummer(facts, monthBranch);
    if (season === null) return null;
    return season === qian ? 5 - rising : rising;
  }

  const yangMinority = yang.length < 3;
  const minority = yangMinority ? yang : yin;
  const majority = yangMinority ? yin : yang;
  const offset = (hour + (yangMinority ? 0 : 6)) % 12;
  if (offset < 2) return minority[offset % minority.length];
  if (minority.length === 1) return majority[(offset - 2) % 5];
  // The supplied notes leave the return order of the doubled two-line cases
  // unverified against the individual hour examples. Keep those hours pending.
  if (offset < 4) return null;
  return majority[(offset - 4) % 4];
}

function yuanTangSpecialMonth(upper, lower, position, monthBranch) {
  const yangMonth = branches.indexOf(monthBranch) % 2 === 0;
  return upper === '坎' && '坎震艮'.includes(lower)
    && ((position === 4 && !yangMonth) || (position === 5 && yangMonth));
}

function transformedTrigrams(upper, lower, position, exchange = true) {
  // If the trigrams exchange places, the Yuan Tang line moves with its trigram.
  const transformed = [...(exchange ? lines[upper] + lines[lower] : lines[lower] + lines[upper])];
  const changedLine = exchange ? (position + 3) % 6 : position;
  transformed[changedLine] = transformed[changedLine] === '1' ? '0' : '1';
  return [trigramByLines.get(transformed.slice(3).join('')), trigramByLines.get(transformed.slice(0, 3).join(''))];
}

function taiXuanForms(earlier, later, position, monthBranch) {
  // 《乾集》§16 exchanges the trigrams alone in these natal cases.
  const exchangeOnly = yuanTangSpecialMonth(earlier.upper, earlier.lower, position, monthBranch);
  // yansuan.py applies the Yuan Tang from the year/month hexagram to both axes.
  const candidates = [[earlier, earlierOrder], [later, laterOrder]].flatMap(([{ axis, upper, lower }, order]) => {
    const mutual = baseNumber(axis + '_mutual', order, ...mutualTrigrams(upper, lower));
    if (position === null) return [mutual];
    const transformed = order === earlierOrder && exchangeOnly ? [lower, upper] : transformedTrigrams(upper, lower, position);
    const yuanTangLine = position + 1;
    return [
      mutual,
      { ...baseNumber(axis + '_transformed', order, ...transformed), yuanTangLine },
      { ...baseNumber(axis + '_transformed_mutual', order, ...mutualTrigrams(...transformed)), yuanTangLine },
    ];
  });
  return { profile: taiXuanFormsProfile, libraryEdition: jsonEdition, candidates,
    ...(position === null && { status: 'partial', reason: 'yuantang_unconfirmed' }) };
}

function heluoTotals(pillars) {
  let heavenTotal = 0, earthTotal = 0;
  for (const [stem, branch] of pillars) {
    const stemValue = laterOrder.indexOf(dayStemTrigrams[stem]);
    for (const value of [stemValue, ...heluoBranches[branches.indexOf(branch)]]) {
      if (value % 2 === 1) heavenTotal += value;
      else earthTotal += value;
    }
  }
  return { heavenTotal, earthTotal };
}

function heluoHexagrams(pillars, gender, facts, birthYear, { heavenTotal, earthTotal }) {
  const [yearPillar, monthPillar, , hourPillar] = pillars;
  const monthBranch = monthPillar[1];
  const reduce = (value, limit) => {
    const rest = value > limit ? value - limit : value;
    return rest % 10 || Math.floor(rest / 10);
  };
  const heavenAbove = '甲丙戊庚壬'.includes(yearPillar[0]) === (gender === '男');
  const heavenDigit = reduce(heavenTotal, 25), earthDigit = reduce(earthTotal, 30);
  let center;
  if (heavenDigit === 5 || earthDigit === 5) {
    if (!matchingCivilYear(birthYear, yearPillar, monthBranch)) return null;
    const yuan = modulo(Math.floor((birthYear - 1864) / 60), 3);
    const gen = yuan === 1 ? heavenAbove : gender === '男';
    center = yuan === 2 ? (gender === '男' ? '离' : '兑') : (gen ? '艮' : '坤');
  }
  const trigram = digit => digit === 5 ? center : laterOrder[digit];
  const [upper, lower] = (heavenAbove ? [heavenDigit, earthDigit] : [earthDigit, heavenDigit]).map(trigram);
  if (!upper || !lower) return null;
  const position = yuanTangPosition(upper, lower, branches.indexOf(hourPillar[1]), gender, facts, monthBranch);
  // 《河洛理數推命術》pp. 19–22 instead flips the line in its original seat.
  const exchange = !yuanTangSpecialMonth(upper, lower, position, monthBranch);
  return { earlier: [upper, lower], later: position === null ? null : transformedTrigrams(upper, lower, position, exchange), position };
}

function heluoCalculations({ earlier, later, position }) {
  const stages = [
    { stage: 'earlier', trigrams: earlier },
    ...(later ? [{ stage: 'later', trigrams: later, yuanTangLine: position + 1 }] : []),
  ];
  const candidates = stages.map(({ stage, trigrams }) => baseNumber('heluo_' + stage, laterOrder, ...trigrams));
  const lineCandidates = stages.flatMap(({ stage, trigrams, yuanTangLine }) => {
    const base = chenLineNumber(...trigrams);
    const axis = 'chen_heluo_lines_' + stage;
    const evidence = yuanTangLine === undefined ? base : { ...base, yuanTangLine };
    // Method 1 takes one number forward from the earlier hexagram and
    // one backward from the transformed hexagram.
    const offset = stage === 'earlier' ? 96 : -96;
    return [
      { ...evidence, axis },
      { ...evidence, axis: axis + (offset > 0 ? '_plus' : '_minus'), clauseId: base.clauseId + offset },
    ];
  });
  const najiaCandidates = stages.flatMap(({ stage, trigrams, yuanTangLine }) => {
    const base = chenNajiaNumber(...trigrams);
    const axis = 'chen_heluo_najia_' + stage;
    const evidence = yuanTangLine === undefined ? base : { ...base, yuanTangLine };
    // Method 2 explicitly takes one offset in each direction from both bases.
    return [
      { ...evidence, axis },
      { ...evidence, axis: axis + '_plus', clauseId: base.clauseId + 96 },
      { ...evidence, axis: axis + '_minus', clauseId: base.clauseId - 96 },
    ];
  });
  const status = later ? {} : { status: 'partial', reason: 'yuantang_unconfirmed' };
  return [
    { profile: heluoProfile, libraryEdition: jsonEdition, candidates },
    { profile: chenHeluoLinesProfile, libraryEdition: jsonEdition, candidates: lineCandidates, ...status },
    { profile: chenHeluoNajiaProfile, libraryEdition: jsonEdition, candidates: najiaCandidates, ...status },
  ];
}

export function confirmedTiebanBirth(facts) {
  const genders = new Set(facts.filter(fact => fact.kind === 'natal_gender').map(fact => fact.gender));
  const [gender] = genders;
  if (genders.size !== 1 || !['男', '女'].includes(gender)) return null;
  const coordinates = facts.filter(fact => ['pillar', 'stem', 'branch'].includes(fact.kind));
  const pillars = baziPillars.map(position => {
    const values = new Set(coordinates.filter(fact => fact.kind === 'pillar' && fact.position === position)
      .map(fact => fact.ganZhi));
    return values.size === 1 ? [...values][0] : undefined;
  });
  if (pillars.some(pillar => !isBaZiPillar(pillar)) || !compatibleBaZiLiteralFacts(coordinates)) return null;
  return { gender, pillars };
}

function luckNumberPrefix([, month, day, hour], luckStem) {
  return 1000 * (stemNumber(month[0]) + stemNumber(luckStem)) + 100 * stemNumber(day[0]) + 10 * stemNumber(hour[0]);
}

function annualCalculations(pillars, periods, age) {
  if (!isTiebanBookAnnualAge(age)) return [];
  const [year, month, day, hour] = pillars;
  const beforeFirstLuck = periods ? age < periods.firstAge : false;
  const luckPillar = beforeFirstLuck ? month
    : periods?.periods.find(({ startAge, endAge }) => startAge <= age && age <= endAge)?.ganZhi;
  if (!luckPillar) return [tiebanBookAnnualProfile, chenAnnualProfile].map(profile => ({
    profile, libraryEdition: jsonEdition, status: 'unavailable', reason: 'missing_confirmed_decadal_range', candidates: [],
  }));
  // The supplied §27 reconstruction starts at the natal year pillar, then advances one step per stated age.
  const ganZhi = stems[modulo(stems.indexOf(year[0]) + age - 1, 10)] + branches[modulo(branches.indexOf(year[1]) + age - 1, 12)];
  const [annualStem, annualBranch] = ganZhi;
  const bookNumber = luckNumberPrefix(pillars, luckPillar[0]) + stemNumber(annualStem) + branchLifeNumber(annualBranch);
  // 陈鼎龙《铁版神数十九法秘解》第十四法: the natal month stem
  // and annual stem take the same paired value, as in the 5352 example.
  const combined = chenAnnualStemPairs.findIndex(pair => month[0] !== annualStem
    && pair.includes(month[0]) && pair.includes(annualStem)) + 1;
  const [growth, completion] = heluoBranches[branches.indexOf(annualBranch)];
  const chenNumber = 1000 * ((combined || stemNumber(month[0])) + (beforeFirstLuck ? 0 : stemNumber(luckPillar[0])))
    + 100 * stemNumber(day[0]) + 10 * stemNumber(hour[0]) + (combined || stemNumber(annualStem)) + growth + completion;
  return [
    { profile: tiebanBookAnnualProfile, libraryEdition: jsonEdition, candidates: [
      { axis: 'book_annual', clauseId: bookNumber, age, annualPeriod: { ganZhi, luckPillar, beforeFirstLuck } },
    ] },
    { profile: chenAnnualProfile, libraryEdition: jsonEdition, candidates: [
      { axis: 'chen_annual', clauseId: chenNumber, age,
        annualPeriod: { ganZhi, ...(beforeFirstLuck ? {} : { luckPillar }), beforeFirstLuck,
          ...(combined && { stemCombination: { monthStem: month[0], annualStem, number: combined } }) } },
    ] },
  ];
}

// Apply the calculations from 演算法式 to the same validated four pillars.
export function tiebanBaseNumbers(facts, birthYear, bookAnnualAge, chenKeSteps, chenKinshipSequence, kunjiFacts) {
  const birth = confirmedTiebanBirth(facts);
  if (!birth) return null;
  const { gender, pillars } = birth;
  const sums = pillars.map(pillarSum);
  const later = number => {
    const digit = number % 10;
    if (digit === 0 || digit === 5) return gender === '男' ? '艮' : '坤';
    return laterOrder[digit];
  };
  const [year, month, day, hour] = sums;
  const yuanHui = 100 * year + month;
  const yunShi = 100 * reversedSum(day) + reversedSum(hour);
  const keSteps = parseChenHuangjiKeSteps(chenKeSteps);
  const yearTrigram = earlierTrigram(year), monthTrigram = earlierTrigram(month);
  const earlierBase = baseNumber('earlier', earlierOrder, yearTrigram, monthTrigram);
  const laterBase = baseNumber('later', laterOrder, later(day), later(hour));
  const yuanTang = yuanTangPosition(yearTrigram, monthTrigram, branches.indexOf(pillars[3][1]), gender, facts, pillars[1][1]);
  const totals = heluoTotals(pillars);
  const heluo = heluoHexagrams(pillars, gender, facts, birthYear, totals);
  const tianyuanNumbers = pillars.map(tianyuanPillarNumber);
  const tianyuanNetwork = tianyuanNetworkNumbers(tianyuanNumbers);
  const kinshipTableNumbers = chenKinshipTableNumbers(pillars);
  const kinshipKe = gender === '男' ? chenKinshipKeNumbers(yearTrigram, monthTrigram) : null;
  const kinshipSequence = kinshipKe ? parseChenKinshipSequence(chenKinshipSequence) : null;
  const kunji = tiebanKunjiCalculation(kunjiFacts, pillars[0], gender);
  const kunjiParentSeries = kunji && tiebanKunjiParentSeries(kunji, kunjiFacts.calibrationAge);
  const periods = confirmedBaZiDecadalPeriods(pillars, gender, facts);
  const decadal = [], chenDecadal = [];
  for (const decadalPeriod of periods?.periods ?? []) {
    const [stem, branch] = decadalPeriod.ganZhi;
    const base = luckNumberPrefix(pillars, stem) + stemNumber(pillars[0][0]);
    const [growth, completion] = heluoBranches[branches.indexOf(branch)];
    decadal.push({ axis: 'decadal', clauseId: base + growth, decadalPeriod });
    // 陈鼎龙《铁版神数十九法秘解》第十三法 lists both branch values
    // for each luck pillar, including when the units carry into the tens.
    chenDecadal.push(
      { axis: 'chen_decadal_growth', clauseId: base + growth, decadalPeriod },
      { axis: 'chen_decadal_completion', clauseId: base + completion, decadalPeriod },
    );
  }
  return {
    profile: tiebanProfile, libraryEdition: jsonEdition, gender, sums,
    candidates: [earlierBase, laterBase],
    additionalCalculations: [
      { profile: huangjiProfile, libraryEdition: jsonEdition, candidates: [
        { axis: 'yuan_hui', clauseId: yuanHui },
        { axis: 'yun_shi', clauseId: yunShi },
      ] },
      { profile: dayHexagramProfile, libraryEdition: jsonEdition, candidates: dayHexagramNumbers(pillars[2], yearTrigram, monthTrigram) },
      ...(heluo ? heluoCalculations(heluo) : []),
      // Methods 1 and 2 both print 2634 beside the raw odd sum 26 and even sum 34.
      { profile: chenHeluoTotalsProfile, libraryEdition: jsonEdition, candidates: [
        { axis: 'chen_heluo_totals', clauseId: 100 * totals.heavenTotal + totals.earthTotal, heluoTotals: totals },
      ] },
      ...(decadal.length ? [{ profile: tiebanDecadalProfile, libraryEdition: jsonEdition, candidates: decadal }] : []),
      ...annualCalculations(pillars, periods, bookAnnualAge),
      taiXuanForms(earlierBase, laterBase, yuanTang, pillars[1][1]),
      tianyuanYearNumbers(tianyuanNumbers[0]),
      tianyuanNetwork,
      tianyuanNetworkRelatedNumbers(tianyuanNetwork.candidates),
      ...chenPillarCalculations(pillars, gender),
      ...(chenDecadal.length ? [{ profile: chenDecadalProfile, libraryEdition: jsonEdition, candidates: chenDecadal }] : []),
      chenHuangjiStemNumbers(pillars, yuanHui, yunShi),
      ...(keSteps ? [chenHuangjiKeNumbers(pillars, yuanHui, yunShi, keSteps)] : []),
      chenRangeTrigramNumbers(pillars, sums),
      chenRangeLineNumbers(sums),
      guanFrontBackNumbers(sums),
      ...(kinshipTableNumbers ? [kinshipTableNumbers] : []),
      ...(kinshipKe ? [kinshipKe] : []),
      ...(kinshipSequence ? [chenKinshipSequenceNumbers(kinshipKe, kinshipSequence)] : []),
      ...(kunji ? [kunji] : []),
      ...(kunjiParentSeries ? [kunjiParentSeries] : []),
      chenStemSequenceNumbers(pillars),
    ],
  };
}

export function tiebanSelector(claim) {
  const match = claim.conditions.match;
  if (match?.system !== 'tieban') return null;
  const selector = match.selector;
  if (claim.source.material_type !== 'supplied_tieban_clause' || selector?.kind !== 'tieban_clause_id'
    || !['natal', 'annual'].includes(match.chartScope)
    || ![jsonEdition, tiebanFourteenEdition].includes(selector.libraryEdition)
    || !Array.isArray(selector.clauseIds) || !selector.clauseIds.length
    || selector.clauseIds.some(id => !Number.isInteger(id) || id < 1001 || id > 13000)
    || !Array.isArray(selector.ages) || selector.ages.some(age => !Number.isInteger(age) || age < 1)
    || (selector.libraryEdition === jsonEdition ? ![0, 1, 2].includes(selector.genderCode) : selector.genderCode !== null)) {
    throw new Error('Invalid Tieban selector: ' + claim.id);
  }
  return selector;
}

export function tiebanMissReason(claim, gender, age) {
  if (!claim) return 'not_in_catalog';
  const { match, excluded, uncertain } = claim.conditions;
  const { chartScope, selector } = match;
  if (chartScope !== (age === undefined ? 'natal' : 'annual')) return 'scope_mismatch';
  if (age === undefined && selector.ages.length) return 'age_required';
  if (age !== undefined && !selector.ages.includes(age)) return 'age_mismatch';
  const hasChartInputs = [...match.natalInputs, ...match.triggerInputs]
    .some(input => Object.values(input).some(conditions => !Array.isArray(conditions) || conditions.length));
  if (match.recordType !== 'general_rule' || excluded.length || uncertain.length || hasChartInputs) return 'source_requirements';
  const genderCode = gender === '男' ? 1 : 2;
  if (selector.genderCode !== null && selector.genderCode !== 0 && selector.genderCode !== genderCode) return 'gender_mismatch';
  return null;
}
