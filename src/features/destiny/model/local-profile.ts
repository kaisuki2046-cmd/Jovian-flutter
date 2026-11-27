import * as SecureStore from 'expo-secure-store';
import { genderLabels, isBirthDate, isBirthTime } from './birth-profile';
import { findBirthPlace } from './birth-places';
import type { BirthProfile } from './birth-profile';

const profileKey = (ownerId: string) => 'destiny.birth-profile.v1.' + ownerId;

export async function readLocalProfile(ownerId: string | null): Promise<{ supported: boolean; profile: BirthProfile | null }> {
  const supported = !!ownerId && /^[A-Za-z0-9._-]+$/.test(ownerId) && await SecureStore.isAvailableAsync();
  if (!supported || !ownerId) return { supported, profile: null };
  const raw = await SecureStore.getItemAsync(profileKey(ownerId));
  if (!raw) return { supported, profile: null };
  try {
    const saved = JSON.parse(raw) as Partial<BirthProfile> | null;
    const place = findBirthPlace(saved?.place?.id);
    if (saved?.date && isBirthDate(saved.date) && isBirthTime(saved.time ?? null)
      && saved.time && saved.gender && Object.hasOwn(genderLabels, saved.gender) && place) {
      return { supported, profile: { date: saved.date, time: saved.time, place, gender: saved.gender } };
    }
  } catch {
    // An invalid or older snapshot is ignored so users can enter a new profile.
  }
  return { supported, profile: null };
}

export function saveLocalProfile(ownerId: string, profile: BirthProfile) {
  return SecureStore.setItemAsync(profileKey(ownerId), JSON.stringify(profile));
}

export function removeLocalProfile(ownerId: string) {
  return SecureStore.deleteItemAsync(profileKey(ownerId));
}
