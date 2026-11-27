import { clearDeletedReadingHistory } from '../../../divination';
import { clearDeletedBirthProfile } from '../../../destiny';
import { clearMemberDemoStorage } from '../../../social';
import { readDeviceSetting, writeDeviceSetting } from '../../settings/model/device-storage';
import { profileStorageKey } from '../../settings/model/preferences';
import { isWeb } from '../model/session-token';

export type SavedDeletion = { receipt: string; ownerId: string; cacheCleared?: boolean };
const storageKey = 'jovian.account.deletion-receipt.v1';

export async function readSavedDeletion(): Promise<SavedDeletion | null> {
  const stored = await readDeviceSetting(storageKey);
  if (!stored) return null;
  const value = JSON.parse(stored) as Partial<SavedDeletion> | null;
  if (!value?.receipt || !/^[A-Za-z0-9_-]{43}$/.test(value.receipt) ||
      !value.ownerId || !/^[a-f0-9-]{36}$/.test(value.ownerId)) return null;
  return { receipt: value.receipt, ownerId: value.ownerId, cacheCleared: value.cacheCleared === true };
}

export function saveDeletion(input: SavedDeletion | null) {
  return writeDeviceSetting(storageKey, input ? JSON.stringify(input) : null);
}

export async function clearDeletedMemberCache(id: string) {
  const settings = ['avatar', 'cover', 'profile-details'] as const;
  await Promise.all([
    clearDeletedReadingHistory(id),
    ...(!isWeb ? [clearDeletedBirthProfile(id)] : []),
    ...settings.map((key) => writeDeviceSetting(profileStorageKey('member:' + id, key), null)),
  ]);
  clearMemberDemoStorage(id);
}
