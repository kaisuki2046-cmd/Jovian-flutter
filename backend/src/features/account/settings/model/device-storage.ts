import { getItemAsync, setItemAsync, deleteItemAsync } from 'expo-secure-store';
import { Platform } from 'react-native';
import { parsePreferences, type Preferences } from './preferences';

const preferenceKey = 'jovian.preferences.v1';
export async function readDeviceSetting(key: string) {
  return Platform.OS === 'web' ? globalThis.localStorage.getItem(key) : getItemAsync(key);
}
export async function writeDeviceSetting(key: string, value: string | null) {
  if (Platform.OS === 'web') {
    if (value === null) globalThis.localStorage.removeItem(key);
    else globalThis.localStorage.setItem(key, value);
  } else if (value === null) await deleteItemAsync(key);
  else await setItemAsync(key, value);
}
export async function loadPreferences() {
  const stored = await readDeviceSetting(preferenceKey);
  return parsePreferences(stored ? JSON.parse(stored) : null);
}
export async function savePreferences(preferences: Preferences) {
  await writeDeviceSetting(preferenceKey, JSON.stringify(preferences));
}
