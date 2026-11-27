export type AndroidAppVersion = {
  applicationId: string;
  versionCode: number;
  versionName: string;
};

export type AndroidRelease = AndroidAppVersion & {
  notes: string[];
  downloadUrl: string;
};

export type AndroidReleaseResponse = { release: AndroidRelease | null };

export function androidDownloadOrigin(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password &&
        url.pathname === '/' && !url.search && !url.hash) return url.origin;
  } catch {
    return undefined;
  }
}

export function parseAndroidReleaseResponse(value: unknown, trustedOrigin: string | undefined): AndroidReleaseResponse {
  if (!value || typeof value !== 'object' || !('release' in value)) throw new Error('Invalid update response');
  if (value.release === null) return { release: null };
  const release = value.release as Partial<AndroidRelease> | undefined;
  if (!release || typeof release.applicationId !== 'string' ||
      !/^[a-zA-Z]\w*(?:\.[a-zA-Z]\w*)+$/.test(release.applicationId) ||
      typeof release.versionCode !== 'number' || !Number.isSafeInteger(release.versionCode) || release.versionCode < 1 ||
      typeof release.versionName !== 'string' || !release.versionName.trim() || release.versionName.length > 64 ||
      !Array.isArray(release.notes) || release.notes.length < 1 || release.notes.length > 12 ||
      !release.notes.every(note => typeof note === 'string' && !!note.trim() && note.length <= 400) ||
      typeof release.downloadUrl !== 'string' || release.downloadUrl.length > 2048) {
    throw new Error('Invalid Android release');
  }
  const url = new URL(release.downloadUrl);
  if (!trustedOrigin || url.origin !== trustedOrigin || url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Untrusted Android download URL');
  }
  return { release: {
    applicationId: release.applicationId,
    versionName: release.versionName.trim(),
    versionCode: release.versionCode,
    notes: release.notes.map(note => note.trim()),
    downloadUrl: url.href,
  } };
}
