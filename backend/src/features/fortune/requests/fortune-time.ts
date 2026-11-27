import { createHttpClient } from '../../../shared/http/client';

const baseUrl = process.env.EXPO_PUBLIC_FORTUNE_TIME_BASE_URL;
const client = createHttpClient({ baseUrl, timeoutMs: 3000 });

export const fortuneTimeConfigured = Boolean(baseUrl);

export function requestFortuneTime(signal: AbortSignal) {
  return client.request('/fortune/time', {
    signal,
    parse(value: unknown) {
      const utc = (value as { asOfUtc?: unknown } | null)?.asOfUtc;
      if (typeof utc !== 'string') throw new Error('Missing server time');
      const time = Date.parse(utc);
      if (!Number.isFinite(time) || new Date(time).toISOString() !== utc) throw new Error('Invalid UTC server time');
      return time;
    },
  });
}
