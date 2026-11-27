import { Body, Ecliptic, GeoMoonState, GeoVector, MakeTime, RotateVector, Rotation_EQD_ECT, Rotation_EQJ_ECT, SiderealTime, SunPosition, Vector } from 'astronomy-engine';
import { astro, util } from 'iztro';
import { LunarUtil, Solar } from 'lunar-javascript';
import type { BirthPlace, BirthProfile } from '../model/birth-profile';
import type { Method } from '../model/reading';
import { regiomontanusCusps, regiomontanusHouse } from './regiomontanus.mjs';
import { lillyHouseFacts } from './lilly-houses.mjs';
import { westernAngularStars, westernFixedStarLongitudes, westernFixedStarProfile, westernGeometryPlanets } from './western-fixed-stars.mjs';

export const chartVersions = {
  bazi: { engineName: 'lunar-javascript', engineVersion: '1.7.8', rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1' },
  ziwei: { engineName: 'iztro', engineVersion: '2.6.5', rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1' },
  western: { engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1' },
} satisfies Record<Method, { engineName: string; engineVersion: string; rulesetVersion: string }>;

function lunarAt(clock: Date) {
  return Solar.fromYmdHms(clock.getUTCFullYear(), clock.getUTCMonth() + 1, clock.getUTCDate(),
    clock.getUTCHours(), clock.getUTCMinutes(), clock.getUTCSeconds()).getLunar();
}

export const baziPillarLabels = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' } as const;
export const baziPillars = Object.keys(baziPillarLabels) as (keyof typeof baziPillarLabels)[];

// These district codes cover the historic city sites expressly identified by their gazetteers.
const classicalRegions = new Map([
  ['410302', '豫'], ['410303', '豫'], ['410304', '豫'], ['140110', '冀'], ['321002', '扬'],
  ['320303', '徐'], ['610104', '雍'],
]);
export function classicalBirthRegion(place: BirthPlace | null) {
  return place?.countryCode === 'CN' && place.adminCode ? classicalRegions.get(place.adminCode) : undefined;
}
type Pillar = typeof baziPillars[number];
type FourPillars = Record<Pillar, string>;
type ShenSha = '天乙贵人' | '文昌贵人' | '禄神' | '驿马' | '将星' | '华盖' | '桃花' | '空亡';
type ShenShaHit = { name: ShenSha; sourcePillars: Pillar[] };
type PillarTenGods = { heavenlyStem: string; hiddenStems: { stem: string; tenGod: string }[] };

const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';
const noblemanBranches = ['丑未', '子申', '亥酉', '亥酉', '丑未', '子申', '丑未', '寅午', '巳卯', '巳卯'];
const wenChangBranches = '巳午申酉申酉亥子寅卯';
const luBranches = '寅卯巳午巳午申酉亥子';
export function baziNoblemanBranches(stem: string) {
  return noblemanBranches[stems.indexOf(stem)] ?? '';
}

const branchGroups = [
  { group: '申子辰', horse: '寅', general: '子', canopy: '辰', peach: '酉' },
  { group: '寅午戌', horse: '申', general: '午', canopy: '戌', peach: '卯' },
  { group: '巳酉丑', horse: '亥', general: '酉', canopy: '丑', peach: '午' },
  { group: '亥卯未', horse: '巳', general: '卯', canopy: '未', peach: '子' },
];

function shenShaForPillar(pillars: Partial<Pick<FourPillars, 'year' | 'day'>>, target: Pillar, targetBranch: string,
  knownBranches: Partial<Record<Pillar, string>> = {}): ShenShaHit[] {
  const matches = new Map<ShenSha, Pillar[]>();

  function match(name: ShenSha, source: Pillar, branches: string) {
    if (!branches.includes(targetBranch)) return;
    const existing = matches.get(name);
    if (existing) existing.push(source);
    else matches.set(name, [source]);
  }

  for (const source of ['year', 'day'] as const) {
    const sourcePillar = pillars[source];
    const branch = sourcePillar?.[1] ?? knownBranches[source];
    if (sourcePillar) {
      const stem = sourcePillar[0], stemIndex = stems.indexOf(stem);
      match('天乙贵人', source, baziNoblemanBranches(stem));
      match('文昌贵人', source, wenChangBranches[stemIndex]);
    }
    if (source === target) continue;
    if (sourcePillar) match('空亡', source, LunarUtil.getXunKong(sourcePillar));
    if (!branch) continue;
    const group = branchGroups.find(({ group }) => group.includes(branch))!;
    match('驿马', source, group.horse);
    match('将星', source, group.general);
    match('华盖', source, group.canopy);
    match('桃花', source, group.peach);
  }
  if (pillars.day) match('禄神', 'day', luBranches[stems.indexOf(pillars.day[0])]);
  return [...matches].map(([name, sourcePillars]) => ({ name, sourcePillars }));
}

function tenGodsForPillar(dayStem: string, position: Pillar, value: string): PillarTenGods {
  const [stem, branch] = value;
  return {
    heavenlyStem: position === 'day' ? '日主' : LunarUtil.SHI_SHEN[dayStem + stem],
    hiddenStems: LunarUtil.ZHI_HIDE_GAN[branch].map((hidden) => ({ stem: hidden, tenGod: LunarUtil.SHI_SHEN[dayStem + hidden] })),
  };
}

export function isBaZiPillar(value: string) {
  if (typeof value !== 'string' || value.length !== 2) return false;
  const stem = stems.indexOf(value[0]);
  const branch = branches.indexOf(value[1]);
  return stem >= 0 && branch >= 0 && stem % 2 === branch % 2;
}

export function detailsFromKnownBaZiPillars(pillars: Partial<FourPillars>, position: Pillar) {
  const { year, day } = pillars;
  const value = pillars[position];
  return {
    tenGods: day && value ? tenGodsForPillar(day[0], position, value) : undefined,
    shenSha: year && day && value ? shenShaForPillar({ year, day }, position, value[1]) : undefined,
  };
}

// Positive evidence from available source pillars only. This does not declare
// the list complete when year/day is unknown, nor create an absent target.
export function shenShaFromKnownBaZiPillars(pillars: Partial<FourPillars>, position: Pillar,
  knownBranches: Partial<Record<Pillar, string>> = {}) {
  const targetBranch = pillars[position]?.[1] ?? knownBranches[position];
  if (!targetBranch || (!pillars.year && !pillars.day && !knownBranches.year && !knownBranches.day)
    || !Object.values(pillars).every(isBaZiPillar)
    || Object.entries(knownBranches).some(([key, branch]) => !branch || branch.length !== 1 || !branches.includes(branch)
      || pillars[key as Pillar] && pillars[key as Pillar]![1] !== branch)) return undefined;
  return shenShaForPillar(pillars, position, targetBranch, knownBranches);
}

export function describeBaZiPillars(pillars: FourPillars) {
  const dayStem = pillars.day[0];
  const tenGods = {} as Record<Pillar, PillarTenGods>;
  const shenSha = {} as Record<Pillar, ShenShaHit[]>;
  for (const position of baziPillars) {
    tenGods[position] = tenGodsForPillar(dayStem, position, pillars[position]);
    shenSha[position] = shenShaForPillar(pillars, position, pillars[position][1]);
  }
  return { ...pillars, tenGods, shenSha, shenShaRulesetVersion: 'natal-shensha-v1' };
}

export function calculateBaZi(instant: number, wallTime: number, gender?: BirthProfile['gender']) {
  // Jie timestamps in lunar-javascript use UTC+8. The day and hour pillars
  // use the birthplace's civil clock, including its historical offset.
  const termTime = instant + 8 * 3_600_000;
  const terms = lunarAt(new Date(termTime));
  const local = lunarAt(new Date(wallTime));
  const previousJie = terms.getPrevJie()?.getSolar().toYmdHms();
  const elapsedDays = previousJie ? (termTime - Date.parse(previousJie.replace(' ', 'T') + 'Z')) / 86_400_000 : NaN;
  const solarMonthXun = elapsedDays >= 0 && elapsedDays < 10 ? 'early' : null;
  const previousQi = terms.getPrevQi()?.getName();
  // 《三命通会》卷二另取生前三百日所在之月，用同一交节口径定月柱。
  const fetalMonthPillar = lunarAt(new Date(termTime - 300 * 86_400_000)).getMonthInGanZhiExact();
  // 用同一交节时钟起运。分钟折算法每三天折一岁，略过起运前的占位项。
  const yun = gender === 'male' || gender === 'female'
    ? terms.getEightChar().getYun(gender === 'male' ? 1 : 0, 2) : undefined;
  const startSolar = yun?.getStartSolar();
  const luckPeriods = yun?.getDaYun(11).slice(1)
    .map((period) => ({ ganZhi: period.getGanZhi(), startAge: period.getStartAge(), endAge: period.getEndAge() })) ?? [];
  const luckContext = yun && startSolar && (gender === 'male' || gender === 'female') ? {
    profile: 'lunar-javascript-beijing-jie-sect2-v1' as const,
    gender,
    direction: (yun.isForward() ? 'forward' : 'backward') as 'forward' | 'backward',
    periods: luckPeriods.map((period, index) => {
      const boundary = (years: number) =>
        new Date(startSolar.nextYear(years).toYmdHms().replace(' ', 'T') + '+08:00').toISOString();
      return { ...period, start: boundary(index * 10), endExclusive: boundary((index + 1) * 10) };
    }),
  } : undefined;
  return { ...describeBaZiPillars({ year: terms.getYearInGanZhiExact(), month: terms.getMonthInGanZhiExact(),
    day: local.getDayInGanZhiExact(), hour: local.getTimeInGanZhi() }), solarMonthXun, previousQi, fetalMonthPillar, luckPeriods,
    ...(luckContext && { luckContext }) };
}

export function lunarBirthDate({ year, month, day }: BirthProfile['date']) {
  const lunar = Solar.fromYmdHms(year, month, day, 12, 0, 0).getLunar();
  const lunarMonth = lunar.getMonth();
  return { lunarMonth: Math.abs(lunarMonth), lunarDay: lunar.getDay(), leap: lunarMonth < 0 };
}

export function ziweiTimeIndex(wallTime: number) {
  return Math.floor((new Date(wallTime).getUTCHours() + 1) / 2);
}

// 中州派紫微斗数讲义 · 正曜辅佐曜诸星庙陷总表。
type ZiweiBrightness = NonNullable<ReturnType<typeof astro.withOptions>['palaces'][number]['minorStars'][number]['brightness']> | '闲';
const ziweiBrightnessProfile = 'iztro-2.6.5-default-with-zhongzhou-assistants-v1';
const ziweiAssistantBrightness: Record<'左辅' | '右弼', Readonly<Partial<Record<string, ZiweiBrightness>>>> = {
  左辅: { 子: '旺', 丑: '庙', 寅: '庙', 卯: '陷', 辰: '庙', 巳: '平', 午: '旺', 未: '庙', 申: '平', 酉: '陷', 戌: '庙', 亥: '闲' },
  右弼: { 子: '庙', 丑: '庙', 寅: '旺', 卯: '陷', 辰: '庙', 巳: '平', 午: '旺', 未: '庙', 申: '闲', 酉: '陷', 戌: '庙', 亥: '平' },
};

export function ziweiAssistantBrightnessLabel(star: { name: string; brightness?: string }) {
  return star.brightness && Object.hasOwn(ziweiAssistantBrightness, star.name)
    ? star.name + '（' + star.brightness + '）' : undefined;
}

export function calculateZiwei(profile: BirthProfile, timeIndex: number) {
  if (profile.gender === 'other') return null;
  const { year, month, day } = profile.date;
  const dateStr = [year, month, day].map((part) => String(part).padStart(2, '0')).join('-');
  const chart = astro.withOptions({
    dateStr, timeIndex, gender: profile.gender, fixLeap: true, language: 'zh-CN',
    config: { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current', algorithm: 'default' },
  }).toJSON();
  const markers = ['禄', '权', '科', '忌'] as const;
  const placements = chart.palaces.flatMap(({ majorStars, minorStars, adjectiveStars }) =>
    [...new Set([...majorStars, ...minorStars, ...adjectiveStars].map(({ name }) => name))]);
  const yearPillar = chart.rawDates.chineseDate.yearly.join('');
  const birthYearTargets = util.getMutagensByHeavenlyStem(chart.rawDates.chineseDate.yearly[0]);
  function withStarProvenance<T extends { name: string; brightness?: string; mutagen?: string }>(star: T) {
    const birthYearMarker = markers[birthYearTargets.findIndex((name) => name === star.name)];
    return {
      ...star,
      ...(star.brightness && { brightnessProfile: ziweiBrightnessProfile }),
      ...(birthYearMarker && star.mutagen === birthYearMarker && { mutagenOrigin: 'birth_year' as const }),
    };
  }
  const time = profile.time;
  const sameHour = time?.timeKnown && Math.floor((time.hour + 1) / 2) % 12 === timeIndex % 12;
  const natalTimeBand = sameHour ? ['early', 'middle', 'late'][Math.floor(((time.hour * 60 + time.minute + 60) % 120) / 40)] : null;
  return {
    ...chart, yearPillar, yearNaYin: LunarUtil.NAYIN[yearPillar] ?? null, natalHourIndex: timeIndex % 12, natalTimeBand,
    palaces: chart.palaces.map((palace) => {
      const targets = util.getMutagensByHeavenlyStem(palace.heavenlyStem);
      const stemTransformations = markers.map((marker, index) => ({ marker, star: targets[index] }));
      const hasUniqueLandings = targets.length === markers.length
        && stemTransformations.every(({ star }) => placements.filter((name) => name === star).length === 1);
      return {
        ...palace,
        ...(hasUniqueLandings ? { stemTransformations } : {}),
        majorStars: palace.majorStars.map(withStarProvenance),
        adjectiveStars: palace.adjectiveStars.map(withStarProvenance),
        minorStars: palace.minorStars.map((star) => {
          if (star.name !== '左辅' && star.name !== '右弼') return star;
          const brightness = ziweiAssistantBrightness[star.name][palace.earthlyBranch];
          return brightness ? { ...star, brightness } : star;
        }).map(withStarProvenance),
      };
    }),
  };
}

const planetNames = {
  Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星',
  Jupiter: '木星', Saturn: '土星', Uranus: '天王星', Neptune: '海王星', Pluto: '冥王星',
} as const;
const planets = Object.keys(planetNames) as (keyof typeof planetNames)[];
const aspects = [[0, '合相'], [60, '六分相'], [90, '四分相'], [120, '三分相'], [180, '对分相']] as const;
const aspectOrb = 6;
const radians = Math.PI / 180;
const normalize = (degrees: number) => (degrees % 360 + 360) % 360;
export const zodiacNames = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'];
export const signIndex = (longitude: number) => Math.floor(normalize(longitude) / 30);
export const trueLunarNodeProfile = 'astronomy-engine-osculating-node-ect-v1';
export const westernStationaryHourlyLimit = 1e-7;
export const isWesternTimeFact = ({ kind }: { kind: string }) =>
  kind === 'planet_house' || kind === 'house_sign' || kind === 'angle_sign' || kind === 'western_sect'
  || kind === 'planet_longitude' || kind === 'planet_daily_motion' || kind === 'planet_hourly_motion' || kind === 'western_true_node_longitude'
  || kind === 'western_fixed_star_longitude' || kind === 'western_cardano_dignity' || kind === 'western_ptolemy_parent'
  || kind.startsWith('western_geometry_') || kind.startsWith('western_profile_') || kind.startsWith('western_lilly_');

export function baziStemPhase(stem: string, branch: string) {
  const direction = stems.indexOf(stem) % 2 === 0 ? 1 : -1;
  return LunarUtil.CHANG_SHENG[(LunarUtil.CHANG_SHENG_OFFSET[stem] + direction * branches.indexOf(branch) + 12) % 12];
}

// Each adapter describes one calculated chart. Report callers intersect facts across time scenarios.
export const chartFacts = {
  bazi: (chart: ReturnType<typeof describeBaZiPillars>
    & Partial<Pick<ReturnType<typeof calculateBaZi>, 'solarMonthXun' | 'previousQi' | 'fetalMonthPillar' | 'luckPeriods'>>) => [
    ...(chart.solarMonthXun ? [{ kind: 'bazi_solar_month_xun', band: chart.solarMonthXun }] : []),
    ...(chart.previousQi ? [{ kind: 'bazi_previous_qi', term: chart.previousQi }] : []),
    ...(chart.fetalMonthPillar ? [{ kind: 'bazi_fetal_month', ganZhi: chart.fetalMonthPillar }] : []),
    ...(chart.luckPeriods ?? []).map((period) => ({ kind: 'bazi_decadal_range', ...period })),
    ...baziPillars.flatMap((position) => [
      { kind: 'pillar', position, ganZhi: chart[position] },
      { kind: 'stem', position, stem: chart[position][0] },
      { kind: 'branch', position, branch: chart[position][1] },
      { kind: 'pillar_xun', position, head: LunarUtil.getXun(chart[position]) },
      { kind: 'day_stem_phase', position, phase: baziStemPhase(chart.day[0], chart[position][1]) },
      { kind: 'stem_ten_god', position, tenGod: chart.tenGods[position].heavenlyStem },
      ...(LunarUtil.NAYIN[chart[position]] ? [{ kind: 'pillar_nayin', position, name: LunarUtil.NAYIN[chart[position]] }] : []),
      ...chart.tenGods[position].hiddenStems.map(({ stem, tenGod }) => ({ kind: 'hidden_ten_god', position, stem, tenGod })),
      ...chart.tenGods[position].hiddenStems.map(({ tenGod }) => ({ kind: 'branch_ten_god', position, tenGod })),
      { kind: 'branch_main_ten_god', position, tenGod: chart.tenGods[position].hiddenStems[0].tenGod },
      ...chart.shenSha[position].map(({ name }) => ({ kind: 'shen_sha', position, name })),
    ]),
  ],
  ziwei: (chart: NonNullable<ReturnType<typeof calculateZiwei>>) => [
    { kind: 'natal_gender', gender: chart.gender },
    { kind: 'natal_year_stem', stem: chart.yearPillar[0] },
    { kind: 'natal_year_branch', branch: chart.yearPillar[1] },
    ...(chart.yearNaYin ? [{ kind: 'natal_year_nayin_element', element: chart.yearNaYin.slice(-1) }] : []),
    { kind: 'natal_ziwei_bureau', bureau: chart.fiveElementsClass },
    ...chart.palaces.filter(({ name, changsheng12 }) => name === '命宫' && changsheng12)
      .map(({ changsheng12 }) => ({ kind: 'natal_ziwei_life_phase', phase: changsheng12 })),
    { kind: 'natal_lunar_month', month: chart.rawDates.lunarDate.lunarMonth, leap: chart.rawDates.lunarDate.isLeap },
    ...(Number.isInteger(chart.natalHourIndex) ? [{ kind: 'ziwei_daozang_input', yearBranch: chart.yearPillar[1],
      month: chart.rawDates.lunarDate.lunarMonth, day: chart.rawDates.lunarDate.lunarDay,
      hour: chart.natalHourIndex, leap: chart.rawDates.lunarDate.isLeap },
    { kind: 'natal_ziwei_hour', branch: branches[chart.natalHourIndex] }] : []),
    ...(chart.natalTimeBand ? [{ kind: 'natal_ziwei_time_band', branch: branches[chart.natalHourIndex], band: chart.natalTimeBand }] : []),
    ...chart.palaces.flatMap(({ name: anchor, earthlyBranch }) => chart.palaces.flatMap(({ name: target, earthlyBranch: other }) => {
      const distance = (branches.indexOf(other) - branches.indexOf(earthlyBranch) + 12) % 12;
      const relation = distance === 6 ? 'opposite' : distance === 4 || distance === 8 ? 'trine' : distance === 1 || distance === 11 ? 'adjacent' : null;
      return relation ? [{ kind: 'palace_relation', anchor, target, relation }] : [];
    })),
    ...chart.palaces.flatMap(({ name: palace, earthlyBranch, majorStars, minorStars, adjectiveStars, isBodyPalace,
      boshi12, suiqian12, jiangqian12, decadal }) => [
      { kind: 'palace_branch', palace, branch: earthlyBranch },
      { kind: 'ziwei_decadal_range', palace, startAge: decadal.range[0], endAge: decadal.range[1] },
      { kind: 'palace_main_count', palace, count: majorStars.length },
      { kind: 'palace_origin_star_count', palace, count: new Set([...majorStars, ...minorStars, ...adjectiveStars]
        .filter(({ scope }) => scope === 'origin').map(({ name }) => name)).size },
      ...(boshi12 ? [{ kind: 'palace_boshi_star', palace, star: boshi12 }] : []),
      ...(suiqian12 ? [{ kind: 'palace_suiqian_star', palace, star: suiqian12 }] : []),
      ...(jiangqian12 ? [{ kind: 'palace_jiangqian_star', palace, star: jiangqian12 }] : []),
      ...(isBodyPalace ? [{ kind: 'body_palace', palace }] : []),
      ...[...majorStars, ...minorStars, ...adjectiveStars].flatMap(({ name: star, scope, mutagen, brightness }) => [
        { kind: 'palace_star', palace, star, scope },
        ...(mutagen ? [{ kind: 'palace_mutagen', palace, change: mutagen, scope }] : []),
        ...(mutagen ? [{ kind: 'star_mutagen', palace, star, change: mutagen, scope }] : []),
        ...(brightness ? [{ kind: 'palace_brightness', palace, star, scope, brightness }] : []),
      ]),
    ]),
  ],
  western: (chart: ReturnType<typeof calculateWestern>) => {
    const facts = [
    { kind: 'western_zodiac', zodiac: 'tropical' },
    { kind: 'western_house_system', houseSystem: 'whole_sign' },
    ...(Number.isFinite(chart.ascendant) ? [{ kind: 'western_geometry_ascendant', longitude: chart.ascendant }] : []),
    ...(Number.isFinite(chart.midheaven) ? [{ kind: 'western_geometry_midheaven', longitude: chart.midheaven }] : []),
    ...(Number.isFinite(chart.trueNorthNodeLongitude)
      ? [{ kind: 'western_true_node_longitude', profile: trueLunarNodeProfile, longitude: chart.trueNorthNodeLongitude }] : []),
    ...(chart.fixedStarLongitudes ?? []).map(({ star, longitude }) =>
      ({ kind: 'western_fixed_star_longitude', profile: westernFixedStarProfile, star, longitude })),
    ...(Number.isFinite(chart.trueObliquity) && chart.regiomontanus ? [
      { kind: 'western_geometry_obliquity', obliquity: chart.trueObliquity },
      ...chart.positions.filter(({ planet, latitude }) => westernGeometryPlanets.includes(planet) && Number.isFinite(latitude))
        .map(({ planet, latitude }) => ({ kind: 'western_geometry_planet_latitude', planet, latitude })),
      ...(chart.fixedStarLongitudes ?? []).filter(({ star, latitude }) => westernAngularStars.includes(star) && Number.isFinite(latitude))
        .map(({ star, latitude }) => ({ kind: 'western_geometry_star_latitude', star, latitude, profile: westernFixedStarProfile })),
    ] : []),
    ...(chart.regiomontanus?.rulesetVersion === 'regiomontanus-3d-v1' ? [
      { kind: 'western_profile_system', profile: 'regiomontanus' },
      ...chart.regiomontanus.houses.map((longitude, index) => ({ kind: 'western_profile_house_sign', profile: 'regiomontanus',
        house: index + 1, sign: zodiacNames[signIndex(longitude)] })),
      ...chart.regiomontanus.houses.map((longitude, index) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus',
        house: index + 1, longitude })),
      ...chart.regiomontanus.positions.map(({ planet, house }) => ({ kind: 'western_profile_planet_house', profile: 'regiomontanus', planet, house })),
    ] : []),
    ...(chart.sect ? [{ kind: 'western_sect', sect: chart.sect }] : []),
    { kind: 'angle_sign', angle: 'ascendant', sign: zodiacNames[signIndex(chart.ascendant)] },
    { kind: 'angle_sign', angle: 'mc', sign: zodiacNames[signIndex(chart.midheaven)] },
    { kind: 'angle_sign', angle: 'descendant', sign: zodiacNames[signIndex(chart.ascendant + 180)] },
    ...chart.houses.map((longitude, index) => ({ kind: 'house_sign', house: index + 1, sign: zodiacNames[signIndex(longitude)] })),
    ...chart.positions.flatMap(({ planet, longitude, house }) => [
      { kind: 'planet_longitude', planet, longitude },
      { kind: 'planet_sign', planet, sign: zodiacNames[signIndex(longitude)] },
      { kind: 'planet_house', planet, house },
      ...(chart.motion?.find(item => item.planet === planet)?.motion
        ? [{ kind: 'planet_motion', planet, motion: chart.motion.find(item => item.planet === planet)!.motion }] : []),
      ...(Number.isFinite(chart.motion?.find(item => item.planet === planet)?.signedDailyDegrees)
        ? [{ kind: 'planet_daily_motion', planet, signedDegrees: chart.motion.find(item => item.planet === planet)!.signedDailyDegrees }] : []),
      ...(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].includes(planet)
        && Number.isFinite(chart.motion?.find(item => item.planet === planet)?.degreesPerDay)
        ? [{ kind: 'planet_hourly_motion', planet, signedDegrees: chart.motion.find(item => item.planet === planet)!.degreesPerDay / 24 }] : []),
      ...(['Moon', 'Mars'].includes(planet)
        && Number.isFinite(chart.motion?.find(item => item.planet === planet)?.signedHourlyLatitudeDegrees)
        ? [{ kind: 'western_geometry_planet_latitude_motion', planet,
          signedDegrees: chart.motion.find(item => item.planet === planet)!.signedHourlyLatitudeDegrees }] : []),
    ]),
    ...chart.aspects.flatMap(({ first, second, name: aspect, orb }) => [
      { kind: 'aspect', first, second, aspect },
      { kind: 'aspect_orb', first, second, aspect, orb },
    ]),
    ];
    return [...facts, ...lillyHouseFacts(facts)];
  },
};

function trueNorthNode(time: ReturnType<typeof MakeTime>) {
  const { x, y, z, vx, vy, vz } = GeoMoonState(time);
  // The instantaneous orbital normal is r × v. Ecliptic north × this normal
  // points toward the ascending crossing, in the ecliptic of date.
  const normal = RotateVector(Rotation_EQJ_ECT(time), new Vector(y * vz - z * vy, z * vx - x * vz, x * vy - y * vx, time));
  return normalize(Math.atan2(normal.x, -normal.y) / radians);
}

export function calculateWestern(instant: number, place: Pick<BirthPlace, 'latitude' | 'longitude'>) {
  const date = new Date(instant);
  const time = MakeTime(date);
  const rotation = Rotation_EQD_ECT(time);
  const theta = (SiderealTime(time) * 15 + place.longitude) * radians;
  const latitude = place.latitude * radians;
  const rotate = (x: number, y: number, z: number) => RotateVector(rotation, new Vector(x, y, z, time));
  const meridian = rotate(Math.cos(theta), Math.sin(theta), 0);
  const east = rotate(-Math.sin(theta), Math.cos(theta), 0);
  const zenith = rotate(Math.cos(latitude) * Math.cos(theta), Math.cos(latitude) * Math.sin(theta), Math.sin(latitude));
  const pole = rotate(0, 0, 1);

  function intersection(normal: Vector, toward: Vector) {
    // Choose the intersection pointing east (Ascendant) or toward upper culmination (MC).
    const x = normal.y;
    const y = -normal.x;
    if (Math.hypot(x, y) < 1e-10) throw new Error('无法计算该地点的黄道轴线。');
    const direction = x * toward.x + y * toward.y;
    return normalize(Math.atan2(y, x) / radians + (direction < 0 ? 180 : 0));
  }

  const ascendant = intersection(zenith, east);
  const midheaven = intersection(east, meridian);
  const positions = planets.map((planet) => {
    const coordinates = planet === 'Sun' ? SunPosition(time) : Ecliptic(GeoVector(Body[planet], time, true));
    return { planet, label: planetNames[planet], longitude: coordinates.elon, latitude: coordinates.elat,
      house: (signIndex(coordinates.elon) - signIndex(ascendant) + 12) % 12 + 1 };
  });
  const [sun] = positions;
  // Signed central difference in tropical longitude, with circular wraparound.
  const motion = planets.map(planet => {
    const coordinatesAt = (offset: number) => planet === 'Sun' ? SunPosition(MakeTime(new Date(instant + offset)))
      : Ecliptic(GeoVector(Body[planet], MakeTime(new Date(instant + offset)), true));
    const before = coordinatesAt(-1_800_000), after = coordinatesAt(1_800_000);
    const longitudeAt = (offset: number) => coordinatesAt(offset).elon;
    const speed = normalize(after.elon - before.elon + 180) - 180;
    // A historical daily-motion comparison uses a full 24-hour displacement,
    // not the existing one-hour instantaneous derivative scaled by 24.
    const signedDailyDegrees = normalize(longitudeAt(43_200_000) - longitudeAt(-43_200_000) + 180) - 180;
    return { planet, motion: Math.abs(speed) < westernStationaryHourlyLimit ? 'stationary' : speed < 0 ? 'retrograde' : 'direct',
      degreesPerDay: speed * 24, signedDailyDegrees, signedHourlyLatitudeDegrees: after.elat - before.elat };
  });
  const sunLongitude = sun.longitude * radians;
  const sunLatitude = sun.latitude * radians;
  const solarAltitudeSine = zenith.x * Math.cos(sunLatitude) * Math.cos(sunLongitude)
    + zenith.y * Math.cos(sunLatitude) * Math.sin(sunLongitude) + zenith.z * Math.sin(sunLatitude);
  const regioCusps = regiomontanusCusps(theta, latitude, rotate);
  const basis = [rotate(1, 0, 0), rotate(0, 1, 0), rotate(0, 0, 1)];
  const regioPositions = regioCusps ? positions.flatMap(({ planet, longitude, latitude: planetLatitude }) => {
    const lon = longitude * radians, lat = planetLatitude * radians;
    const [x, y, z] = basis.map(axis => axis.x * Math.cos(lat) * Math.cos(lon)
      + axis.y * Math.cos(lat) * Math.sin(lon) + axis.z * Math.sin(lat));
    const house = regiomontanusHouse({ x, y, z }, theta, latitude);
    return house === null ? [] : [{ planet, house }];
  }) : [];
  const regiomontanus = regioCusps && regioPositions.length === positions.length
    ? { rulesetVersion: 'regiomontanus-3d-v1', houses: regioCusps, positions: regioPositions } : undefined;
  return {
    julianDay: time.ut + 2451545, ascendant, midheaven, positions, motion, trueNorthNodeLongitude: trueNorthNode(time),
    fixedStarLongitudes: westernFixedStarLongitudes(time),
    trueObliquity: Math.atan2(pole.y, pole.z) / radians,
    ...(regiomontanus && { regiomontanus }),
    sect: solarAltitudeSine > 1e-10 ? 'day' : solarAltitudeSine < -1e-10 ? 'night' : null,
    houses: Array.from({ length: 12 }, (_, index) => (signIndex(ascendant) + index) % 12 * 30),
    aspects: positions.flatMap((first, index) => positions.slice(index + 1).flatMap((second) => {
      const separation = Math.abs(normalize(first.longitude - second.longitude + 180) - 180);
      return aspects.filter(([angle]) => Math.abs(separation - angle) <= aspectOrb)
        .map(([angle, name]) => ({ first: first.planet, second: second.planet, name, orb: Math.abs(separation - angle) }));
    })),
  };
}
