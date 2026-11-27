import { createHttpClient } from '../../../shared/http/client';
import { modelAccountRequest, requestSameSiteModel } from '../../account';
import { summarySections, type SynastrySummary, type SynastrySummaryRequest } from '../model/summary';

const localBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location?.hostname);
const client = createHttpClient({
  baseUrl: process.env.EXPO_PUBLIC_SYNASTRY_API_BASE_URL || (localBrowser ? 'http://127.0.0.1:8794' : undefined),
  timeoutMs: 130_000,
  transport: (url, init) => requestSameSiteModel(url, init),
});

export async function requestSynastrySummary(body: SynastrySummaryRequest, signal: AbortSignal) {
  return client.request('/synastry/summary', {
    ...await modelAccountRequest(), method: 'POST', body, signal,
    parse(value: unknown): SynastrySummary {
      const result = value as Record<string, unknown> | null;
      return Object.fromEntries(summarySections.flatMap(({ type }) => {
        const text = result?.[type];
        return typeof text === 'string' ? [[type, text]] : [];
      }));
    },
  });
}
