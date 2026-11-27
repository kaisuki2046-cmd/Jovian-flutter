import { genderLabels, isBirthDate, isBirthTime } from '../model/birth-profile';
import { findBirthPlace } from '../model/birth-places';
import type { BirthProfile } from '../model/birth-profile';
import type { BirthCalculationContext } from '../model/chart-snapshot';
import type { CalculationStage, ChartResult, Method } from '../model/reading';
import { birthClockVersion, birthInstants, localClock, samplingVersion } from './birth-clock';
import { analyzeBaZi } from './bazi-analysis';
import { baziPillarLabels, baziPillars, calculateBaZi, calculateWestern, calculateZiwei, chartVersions, detailsFromKnownBaZiPillars, isBaZiPillar, signIndex, zodiacNames, ziweiTimeIndex } from './charts';

function stable(values: string[]) {
  return values.length && values.every((value) => value === values[0]) ? values[0] : '随时刻变化';
}

function formatHiddenStems(hiddenStems: readonly { stem: string; tenGod: string }[]) {
  return hiddenStems.map(({ stem, tenGod }) => stem + ' ' + tenGod).join('、');
}

function formatBaZiDetails(heavenlyStem: string, hiddenStems: string, shenSha: string) {
  return ['天干十神 ' + heavenlyStem, '藏干十神 ' + hiddenStems, '神煞 ' + (shenSha || '无命中')];
}

export function restoreArchivedBaZiRows(rows: readonly { label: string; value: string }[]) {
  const values = rows.map(({ label, value }) => {
    const [ganZhi, ...savedDetails] = value.split('\n').map((line) => line.trim());
    return { label, ganZhi, savedDetails: savedDetails.filter(Boolean),
      position: baziPillars.find((position) => baziPillarLabels[position] === label) };
  });
  const pillars: Partial<Record<typeof baziPillars[number], string>> = {};
  for (const { position, ganZhi } of values) {
    if (position && isBaZiPillar(ganZhi)) pillars[position] = ganZhi;
  }

  const unknown = '归档资料不足';
  return values.map(({ label, ganZhi, savedDetails, position }) => {
    if (savedDetails.length || !position) return { label, value: ganZhi, details: savedDetails };
    const { tenGods, shenSha } = detailsFromKnownBaZiPillars(pillars, position);
    return { label, value: ganZhi, details: formatBaZiDetails(tenGods?.heavenlyStem ?? unknown,
      tenGods ? formatHiddenStems(tenGods.hiddenStems) : unknown,
      shenSha ? shenSha.map(({ name }) => name).join('、') : unknown) };
  });
}

function summarizeBaZi(results: readonly ReturnType<typeof calculateBaZi>[]) {
  return baziPillars.map((position) => {
    const value = stable(results.map((result) => result[position]));
    const heavenlyStem = stable(results.map(({ tenGods }) => tenGods[position].heavenlyStem));
    const hiddenStems = stable(results.map(({ tenGods }) => formatHiddenStems(tenGods[position].hiddenStems)));
    const hits = results.map(({ shenSha }) => shenSha[position].map(({ name }) => name));
    const shared = hits[0].filter((name) => hits.every((names) => names.includes(name)));
    const varies = hits.some((names) => names.length !== shared.length);
    const shenSha = [...shared, ...(varies ? ['其余随时刻变化'] : [])].join('、');
    return {
      label: baziPillarLabels[position], value,
      details: formatBaZiDetails(heavenlyStem, hiddenStems, shenSha),
    };
  });
}

async function collectCharts<T>(inputs: readonly number[], calculate: (input: number) => T, signal: AbortSignal) {
  const results: T[] = [];
  for (const input of inputs) {
    if (signal.aborted) throw new Error('已取消测算。');
    results.push(calculate(input));
    if (results.length % 8 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return results;
}

async function stage(signal: AbortSignal, update: (stage: CalculationStage) => void, current: CalculationStage) {
  if (signal.aborted) throw new Error('已取消测算。');
  update(current);
  // Yield to the UI before starting this stage, without holding back a completed result.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  if (signal.aborted) throw new Error('已取消测算。');
}

export async function runReading(profile: BirthProfile, signal: AbortSignal, update: (stage: CalculationStage) => void) {
  await stage(signal, update, 'validating');
  if (!isBirthDate(profile.date) || !isBirthTime(profile.time) || !Object.hasOwn(genderLabels, profile.gender)) {
    throw new Error('请核对出生日期、时间和性别。');
  }
  const place = findBirthPlace(profile.place.id);
  if (!place) throw new Error('请选择目录中收录的出生地点。');
  const snapshot = { ...profile, place };

  await stage(signal, update, 'normalizing');
  const instants = birthInstants(snapshot.date, snapshot.time, place.timeZone);
  const birthContext: BirthCalculationContext | undefined = snapshot.time.timeKnown && instants.length === 1 ? {
    precision: 'minute', birthInstant: new Date(instants[0]).toISOString(),
    latitude: place.latitude, longitude: place.longitude, timeZone: place.timeZone, clockVersion: birthClockVersion,
  } : undefined;
  const wallClock = localClock(place.timeZone);
  const timeCompleteness = snapshot.time.timeKnown ? 'complete' : 'partial';
  async function chart<T, S>(
    method: Method, inputs: readonly number[], calculate: (value: number) => T,
    summarize: (results: T[]) => S, unavailable?: string,
  ): Promise<ChartResult<T, S>> {
    if (!unavailable) await stage(signal, update, method);
    let rawResult: T[];
    try {
      rawResult = await collectCharts(inputs, calculate, signal);
    } catch (error) {
      if (signal.aborted) throw error;
      rawResult = [];
    }
    const warning = unavailable ?? (rawResult.length ? undefined : '本次无法计算该盘面。');
    return { method, ...chartVersions[method], timeCompleteness, rawResult,
      summary: rawResult.length ? summarize(rawResult) : null, warning };
  }

  const bazi = await chart('bazi', instants, (instant) => {
    const natal = calculateBaZi(instant, wallClock(instant), snapshot.time.timeKnown ? snapshot.gender : undefined);
    return { utc: new Date(instant).toISOString(), ...natal,
      ...(timeCompleteness === 'complete' && { analysis: analyzeBaZi(natal) }) };
  },
    summarizeBaZi);
  const ziwei = await chart('ziwei', snapshot.gender === 'other' ? [] : [...new Set(instants.map((instant) => ziweiTimeIndex(wallClock(instant))))],
    (index) => ({ timeIndex: index, ...calculateZiwei(snapshot, index)! }),
    (results) => ({
      lunarDate: stable(results.map(({ lunarDate }) => lunarDate)),
      className: stable(results.map(({ fiveElementsClass }) => fiveElementsClass)),
      yearPillar: stable(results.map(({ yearPillar }) => yearPillar)),
      yearNaYin: stable(results.map(({ yearNaYin }) => yearNaYin ?? '暂无')),
      palaces: results.length === 1 ? results[0].palaces : null,
    }), snapshot.gender === 'other' ? '紫微引擎需要选择男或女，本次保留其他盘面。' : undefined);
  const western = await chart('western', instants,
    (instant) => ({ utc: new Date(instant).toISOString(), ...calculateWestern(instant, place) }),
    (results) => ({
      positions: results[0].positions.map(({ planet, label, house }, index) => ({
        planet, label, sign: stable(results.map(({ positions }) => zodiacNames[signIndex(positions[index].longitude)])),
        house: snapshot.time.timeKnown ? house : null,
      })),
      exact: snapshot.time.timeKnown ? results[0] : null,
    }));
  if ([bazi, ziwei, western].every(({ rawResult }) => !rawResult.length)) {
    throw new Error('本次没有可用的盘面，请核对出生资料后重试。');
  }
  return { profile: snapshot, calculatedAt: new Date().toISOString(), birthContext, charts: [bazi, ziwei, western] as const,
    versions: { sampling: samplingVersion } };
}

export type Reading = Awaited<ReturnType<typeof runReading>>;
