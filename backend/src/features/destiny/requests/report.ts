import { createHttpClient, RequestError } from '../../../shared/http/client';
import { chartFacts, classicalBirthRegion, isWesternTimeFact } from '../control/charts';
import type { Reading } from '../control/local-reading';

const baseUrl = process.env.EXPO_PUBLIC_DESTINY_API_BASE_URL;
const clientOptions = { baseUrl, timeoutMs: 185_000 };
const client = createHttpClient(clientOptions);

export const reportServiceConfigured = Boolean(baseUrl);

function sharedFacts<T>(scenarios: T[][]) {
  const [first = [], ...others] = scenarios;
  const candidates = new Map(first.map((fact) => [JSON.stringify(fact), fact]));
  for (const scenario of others) {
    const keys = new Set(scenario.map((fact) => JSON.stringify(fact)));
    for (const key of candidates.keys()) if (!keys.has(key)) candidates.delete(key);
    if (!candidates.size) break;
  }
  return [...candidates.values()];
}

export function buildReportRequest(reading: Reading) {
  const [bazi, ziwei, western] = reading.charts;
  const { timeKnown } = reading.profile.time;
  const gender = reading.profile.gender === 'male' ? '男' : reading.profile.gender === 'female' ? '女' : undefined;
  const sects = new Set(western.rawResult.map(({ sect }) => sect));
  const [sect] = sects;
  const daylight = timeKnown && sects.size === 1 && sect ? [{ kind: 'natal_daylight', sect }] : [];
  const zone = classicalBirthRegion(reading.profile.place);
  const birthplace = zone ? [{ kind: 'natal_classical_region', zone }] : [];
  const chartQueries = [
    { method: bazi.method, rulesetVersion: bazi.rulesetVersion, ...(timeKnown && { birthYear: reading.profile.date.year }),
      confirmedFacts: sharedFacts(bazi.rawResult.map((chart) => {
      const facts = [...chartFacts.bazi(chart), ...daylight, ...birthplace, ...(gender ? [{ kind: 'natal_gender', gender }] : [])];
      const assessments = chart.analysis?.L2.assessments;
      if (!assessments) return facts;
      const { dayMasterStrength, fiveElementStrength } = assessments;
      const temperament = fiveElementStrength.temperament;
      return [...facts, { kind: 'day_master_strength', result: dayMasterStrength.result, profile: dayMasterStrength.method },
        ...(temperament?.indicators.map(({ element, classification }) =>
          ({ kind: 'bazi_element_temperament', element, classification, profile: temperament.method })) ?? [])];
    })) },
    { method: ziwei.method, rulesetVersion: ziwei.rulesetVersion,
      confirmedFacts: sharedFacts(ziwei.rawResult.map((chart) => [...chartFacts.ziwei(chart), ...daylight, ...birthplace])) },
    { method: western.method, rulesetVersion: western.rulesetVersion,
      confirmedFacts: [...sharedFacts(western.rawResult.map(chartFacts.western)), ...(gender ? [{ kind: 'natal_gender', gender }] : [])]
      .filter((fact) => timeKnown || !isWesternTimeFact(fact)) },
  ].filter(({ confirmedFacts }) => confirmedFacts.length);
  return { timeKnown, chartQueries };
}

export async function requestReport(reading: Reading, signal: AbortSignal, access?: {
  credentials?: 'include'; headers?: Record<string, string>; transport: typeof fetch;
}) {
  if (!reportServiceConfigured) throw new Error('解读服务暂未配置。');
  const body = buildReportRequest(reading);
  if (!body.chartQueries.length) throw new Error('盘面资料不足，无法生成报告。');
  const service = access ? createHttpClient({ ...clientOptions, transport: access.transport }) : client;
  const report = await service.request('/destiny/report', {
    credentials: access?.credentials, headers: access?.headers, method: 'POST', signal, body,
    parse(value: unknown) {
      const draft = value as { report?: unknown } | null;
      if (!draft || (draft.report !== null && typeof draft.report !== 'string')) {
        throw new Error('Invalid report response.');
      }
      return draft.report;
    },
  }).catch((error: unknown) => {
    if (signal.aborted || error instanceof RequestError && (error.status === 428 || error.status === 401)) throw error;
    throw new Error('暂时无法连接解读服务，请重试。');
  });
  if (!report?.trim()) throw new Error('解读服务未生成报告，请重试。');
  return report;
}
