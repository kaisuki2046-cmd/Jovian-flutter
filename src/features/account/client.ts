import { createHttpClient } from '../../shared/http/client';
import { isWeb, readNativeToken } from './auth/model/session-token';

const accountBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || (__DEV__ && isWeb ? 'http://localhost:8787' : undefined);
export const accountClient = createHttpClient({
  baseUrl: accountBaseUrl,
  getAccessToken: readNativeToken,
});

export const anonymousAccountClient = createHttpClient({
  baseUrl: accountBaseUrl,
  transport: (url, init) => fetch(url, { ...init, credentials: 'omit' }),
});

export function accountRequest(needsSession = false) {
  return isWeb
    ? { credentials: 'include' as const }
    : { headers: { 'X-App-Client': 'native' }, authenticated: needsSession };
}
