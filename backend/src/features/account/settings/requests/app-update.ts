import { createHttpClient } from '../../../../shared/http/client';
import { androidDownloadOrigin, parseAndroidReleaseResponse } from '../model/app-update';

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const downloadOrigin = androidDownloadOrigin(process.env.EXPO_PUBLIC_ANDROID_UPDATE_DOWNLOAD_ORIGIN);
const client = createHttpClient({ baseUrl, timeoutMs: 5_000 });

function hasTrustedApiOrigin(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '10.0.2.2', '[::1]'].includes(url.hostname));
  } catch {
    return false;
  }
}

export const androidUpdateCheckConfigured = Boolean(downloadOrigin) && hasTrustedApiOrigin(baseUrl);

export function requestAndroidRelease() {
  if (!androidUpdateCheckConfigured) throw new Error('Android update check is not configured');
  return client.request('/app-updates/android/latest', {
    parse: value => parseAndroidReleaseResponse(value, downloadOrigin),
  });
}
