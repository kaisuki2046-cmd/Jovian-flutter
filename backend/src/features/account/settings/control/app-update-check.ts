import type { AndroidAppVersion, AndroidRelease, AndroidReleaseResponse } from '../model/app-update';

export type AppUpdateResult =
  | { status: 'current' | 'unpublished' | 'failed' }
  | { status: 'available'; release: AndroidRelease; show: boolean };

const checkIntervalMs = 15 * 60_000;

export function createAppUpdateCheck(current: AndroidAppVersion, readLatest: () => Promise<AndroidReleaseResponse>, now = Date.now) {
  const offeredVersions = new Set<number>();
  let lastAutomaticCheck: number | undefined;
  let pending: Promise<AndroidReleaseResponse> | undefined;

  return async function check(manual: boolean): Promise<AppUpdateResult | undefined> {
    if (!manual) {
      const time = now();
      if (lastAutomaticCheck !== undefined && time - lastAutomaticCheck < checkIntervalMs) return;
      lastAutomaticCheck = time;
    }

    pending ??= Promise.resolve().then(readLatest).finally(() => { pending = undefined; });
    let latest: AndroidReleaseResponse;
    try {
      latest = await pending;
    } catch {
      return { status: 'failed' };
    }
    const { release } = latest;
    if (!release || release.applicationId !== current.applicationId) return { status: 'unpublished' };
    if (release.versionCode <= current.versionCode) return { status: 'current' };

    const show = manual || !offeredVersions.has(release.versionCode);
    offeredVersions.add(release.versionCode);
    return { status: 'available', release, show };
  };
}
