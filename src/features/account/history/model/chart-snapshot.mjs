import { maxReportDetailLength } from '../../../../shared/content-limits.mjs';

export const pillarPositions = ['year', 'month', 'day', 'hour'];
export const westernPlanets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
export const westernRuleset = 'tropical-whole-sign-v1';
const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 120) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const optionalText = (value) => value === undefined || (typeof value === 'string' && value.length <= 120);
const stem = (value) => typeof value === 'string' && value.length === 1 && stems.includes(value);
const branch = (value) => typeof value === 'string' && value.length === 1 && branches.includes(value);
const degree = (value) => Number.isFinite(value) && value >= 0 && value < 360;
const planet = (value) => westernPlanets.includes(value);
const boundedArray = (value, max, validate) => Array.isArray(value) && value.length <= max && value.every(validate);
const unique = (values) => new Set(values).size === values.length;
const timestamp = (value) => typeof value === 'string' && value.length === 24 && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;

function parseBirthContext(value, snapshot) {
  if (!snapshot.timeKnown || !object(value)) return;
  const { precision, birthInstant, latitude, longitude, timeZone, clockVersion } = value;
  if (precision !== 'minute' || !timestamp(birthInstant) || clockVersion !== 'gregory-iana-intl-v1'
    || !Number.isFinite(latitude) || Math.abs(latitude) > 90
    || !Number.isFinite(longitude) || Math.abs(longitude) > 180 || !text(timeZone)
    || /^[+-]/u.test(timeZone) || ![snapshot.bazi, snapshot.western].every(({ rawResult }) =>
      rawResult.every(({ utc }) => utc === birthInstant))) return;
  try { new Intl.DateTimeFormat('en', { timeZone }); } catch { return; }
  return { precision, birthInstant, latitude, longitude, timeZone, clockVersion };
}

function validLuckContext(chart, timeKnown) {
  return chart.rawResult.every(({ luckContext, luckPeriods, utc }) => {
    if (luckContext === undefined) return true;
    if (!timeKnown || !object(luckContext) || luckContext.profile !== 'lunar-javascript-beijing-jie-sect2-v1'
      || !['female', 'male'].includes(luckContext.gender) || !['forward', 'backward'].includes(luckContext.direction)
      || !Array.isArray(luckPeriods) || luckPeriods.length !== 10
      || !Array.isArray(luckContext.periods) || luckContext.periods.length !== 10) return false;
    return luckContext.periods.every((period, index, periods) => {
      if (!object(period) || !object(luckPeriods[index])) return false;
      const { ganZhi, startAge, endAge, start, endExclusive } = period;
      return typeof ganZhi === 'string' && ganZhi.length === 2 && stem(ganZhi[0]) && branch(ganZhi[1])
        && Number.isInteger(startAge) && startAge >= 0 && Number.isInteger(endAge) && endAge === startAge + 9
        && ganZhi === luckPeriods[index].ganZhi && startAge === luckPeriods[index].startAge && endAge === luckPeriods[index].endAge
        && timestamp(start) && timestamp(endExclusive) && endExclusive > start
        && (index ? start === periods[index - 1].endExclusive : start >= utc);
    });
  });
}

// Keep the original JSON values, including engine-specific fields and numeric precision.
function isBoundedJson(value, depth = 0) {
  if (depth > 32) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'object' && Object.values(value).every((item) => isBoundedJson(item, depth + 1));
}

function isBaZiCandidate(value) {
  return object(value) && timestamp(value.utc) && text(value.shenShaRulesetVersion)
    && object(value.tenGods) && object(value.shenSha) && pillarPositions.every((position) => {
      const ganZhi = value[position];
      const gods = value.tenGods[position];
      const hits = value.shenSha[position];
      return typeof ganZhi === 'string' && ganZhi.length === 2 && stem(ganZhi[0]) && branch(ganZhi[1])
        && stems.indexOf(ganZhi[0]) % 2 === branches.indexOf(ganZhi[1]) % 2
        && object(gods) && text(gods.heavenlyStem)
        && boundedArray(gods.hiddenStems, 3, (item) => object(item) && stem(item.stem) && text(item.tenGod))
        && gods.hiddenStems.length > 0
        && boundedArray(hits, 32, (hit) => object(hit) && text(hit.name)
          && boundedArray(hit.sourcePillars, 4, (source) => pillarPositions.includes(source))
          && hit.sourcePillars.length > 0 && unique(hit.sourcePillars))
        && unique(hits.map(({ name }) => name));
    });
}

function isZiweiCandidate(value) {
  const star = (item) => object(item) && text(item.name) && optionalText(item.mutagen)
    && (item.brightnessProfile === undefined || (text(item.brightnessProfile) && text(item.brightness)))
    && (item.mutagenOrigin === undefined || (item.mutagenOrigin === 'birth_year' && ['禄', '权', '科', '忌'].includes(item.mutagen)));
  const validPalaces = object(value) && Number.isInteger(value.timeIndex) && value.timeIndex >= 0 && value.timeIndex <= 12
    && boundedArray(value.palaces, 12, (palace) => object(palace) && text(palace.name) && branch(palace.earthlyBranch)
      && typeof palace.isBodyPalace === 'boolean'
      && boundedArray(palace.majorStars, 64, star) && boundedArray(palace.minorStars, 64, star)
      && boundedArray(palace.adjectiveStars, 64, star))
    && value.palaces.length === 12
    && unique(value.palaces.map(({ earthlyBranch }) => earthlyBranch))
    && value.palaces.filter(({ name }) => name === '命宫').length === 1
    && value.palaces.filter(({ isBodyPalace }) => isBodyPalace).length === 1;
  if (!validPalaces) return false;
  const markers = ['禄', '权', '科', '忌'];
  const placements = value.palaces.flatMap(({ majorStars, minorStars, adjectiveStars }) =>
    [...new Set([...majorStars, ...minorStars, ...adjectiveStars].map(({ name }) => name))]);
  return value.palaces.every(({ heavenlyStem, stemTransformations }) => stemTransformations === undefined
    || (stem(heavenlyStem) && boundedArray(stemTransformations, markers.length, (item) =>
      object(item) && markers.includes(item.marker) && text(item.star)
        && placements.filter((name) => name === item.star).length === 1)
      && stemTransformations.length === markers.length
      && unique(stemTransformations.map(({ marker }) => marker))));
}

function isWesternCandidate(value) {
  return object(value) && timestamp(value.utc) && Number.isFinite(value.julianDay)
    && degree(value.ascendant) && degree(value.midheaven)
    && boundedArray(value.positions, 10, (position) => object(position) && planet(position.planet)
      && degree(position.longitude) && Number.isFinite(position.latitude) && Math.abs(position.latitude) <= 90
      && Number.isInteger(position.house) && position.house >= 1 && position.house <= 12)
    && value.positions.length === westernPlanets.length && unique(value.positions.map(({ planet }) => planet))
    && boundedArray(value.houses, 12, degree) && value.houses.length === 12
    && boundedArray(value.aspects, 90, (aspect) => object(aspect) && planet(aspect.first) && planet(aspect.second)
      && text(aspect.name) && Number.isFinite(aspect.orb) && aspect.orb >= 0);
}

function isChart(value, limit, validate, key) {
  return object(value) && text(value.engineName) && text(value.engineVersion) && text(value.rulesetVersion)
    && (value.warning === undefined || text(value.warning, maxReportDetailLength))
    && boundedArray(value.rawResult, limit, validate)
    && (value.rawResult.length > 0 || value.warning !== undefined)
    && unique(value.rawResult.map((item) => item[key]));
}

export function parseChartSnapshot(value, timeKnown) {
  if (!object(value) || value.version !== 1 || value.timeKnown !== timeKnown || !text(value.samplingVersion)
    || !isChart(value.bazi, timeKnown ? 1 : 128, isBaZiCandidate, 'utc')
    || !isChart(value.ziwei, timeKnown ? 1 : 13, isZiweiCandidate, 'timeIndex')
    || !isChart(value.western, timeKnown ? 1 : 128, isWesternCandidate, 'utc')
    || ![value.bazi, value.ziwei, value.western].some(({ rawResult }) => rawResult.length > 0)
    || !validLuckContext(value.bazi, timeKnown) || !isBoundedJson(value)) return;
  const birthContext = value.birthContext === undefined ? undefined : parseBirthContext(value.birthContext, value);
  if (value.birthContext !== undefined && !birthContext) return;
  const { version, samplingVersion, bazi, ziwei, western } = value;
  return { version, timeKnown, samplingVersion, bazi, ziwei, western, ...(birthContext && { birthContext }) };
}
