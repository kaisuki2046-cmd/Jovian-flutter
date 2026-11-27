import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const key = 'app.account.session';

export const isWeb = Platform.OS === 'web';

export async function readNativeToken() {
  return isWeb ? undefined : (await SecureStore.getItemAsync(key)) ?? undefined;
}

export async function saveNativeToken(token: string) {
  await SecureStore.setItemAsync(key, token);
}

export async function clearNativeToken() {
  if (!isWeb) await SecureStore.deleteItemAsync(key);
}
