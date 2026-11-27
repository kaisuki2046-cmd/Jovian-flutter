import { applicationId, nativeApplicationVersion, nativeBuildVersion } from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type { AndroidAppVersion } from './app-update';

const expoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const versionCode = Number(nativeBuildVersion);

export const displayAppVersion = (!expoGo && nativeApplicationVersion) || Constants.expoConfig?.version;
export const installedAndroidVersion: AndroidAppVersion | undefined =
  Platform.OS === 'android' && !expoGo && applicationId && nativeApplicationVersion &&
  Number.isSafeInteger(versionCode) && versionCode > 0
    ? { applicationId, versionName: nativeApplicationVersion, versionCode }
    : undefined;
