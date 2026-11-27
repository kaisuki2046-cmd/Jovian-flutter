import { readFile } from 'node:fs/promises';
import { androidDownloadOrigin, parseAndroidReleaseResponse } from '../settings/model/app-update.ts';

export function createAndroidReleaseReader({ file, downloadOrigin } = {}) {
  const trustedOrigin = androidDownloadOrigin(downloadOrigin);
  return async function readAndroidRelease() {
    if (!file) return { release: null };
    if (!trustedOrigin) return undefined;
    try {
      const json = JSON.parse(await readFile(file, 'utf8'));
      return parseAndroidReleaseResponse(json, trustedOrigin);
    } catch (error) {
      // The manifest can contain a private download URL. Log only the error category.
      console.error('Android release manifest unavailable', error.code ?? error.name);
      return undefined;
    }
  };
}
