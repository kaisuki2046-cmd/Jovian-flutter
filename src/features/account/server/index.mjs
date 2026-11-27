import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openAccountStore } from '../storage/account-store.mjs';
import { createAccountHandler } from './handler.mjs';
import { createAndroidReleaseReader } from './android-release.mjs';
import { loadEmailDelivery, loadLocalAuthProvider, loadTencentSmsDelivery } from './auth-provider.mjs';
import { eraseDivinationAccount } from '../../divination/server-entry.mjs';
import { eraseFortuneAccount } from '../../fortune/server-entry.mjs';

const host = process.env.APP_ACCOUNT_HOST ?? '127.0.0.1';
const port = Number(process.env.APP_ACCOUNT_PORT ?? 8787);
const webOrigin = new URL(process.env.APP_WEB_ORIGIN ?? 'http://localhost:8081').origin;
const database = resolve(process.env.APP_ACCOUNT_DB ?? '.local/account.sqlite');
const providerPath = process.env.APP_LOCAL_AUTH_PROVIDER_PATH?.trim();
const agreementsPath = process.env.APP_AGREEMENTS_FILE?.trim();
const publishedAgreements = agreementsPath ? JSON.parse(readFileSync(resolve(agreementsPath), 'utf8')) : undefined;
const authProvider = await loadLocalAuthProvider({
  host, webOrigin, environment: process.env.NODE_ENV,
  providerUrl: providerPath ? pathToFileURL(resolve(providerPath)) : undefined,
});
const deliverEmailCode = await loadEmailDelivery(process.env.APP_EMAIL_CODE_ADAPTER?.trim());
const deliverPhoneCode = await loadTencentSmsDelivery(process.env);
function authorizedAccounts(key) {
  const ids = (process.env[key] ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  if (ids.some((id) => !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))) {
    throw new Error(key + ' must contain internal account UUIDs');
  }
  return ids;
}

mkdirSync(dirname(database), { recursive: true });
const store = openAccountStore(database);
store.purgeGuests(Date.now());
const handler = createAccountHandler({
  store, webOrigin,
  publishedAgreements,
  readAndroidRelease: createAndroidReleaseReader({
    file: process.env.APP_ANDROID_RELEASE_FILE?.trim(),
    downloadOrigin: process.env.ANDROID_UPDATE_DOWNLOAD_ORIGIN,
  }),
  eraseReadings(userId, legacyTokens) {
    eraseDivinationAccount(userId, legacyTokens);
    eraseFortuneAccount(userId);
  },
  isolateLocalSession: process.env.APP_ACCOUNT_ISOLATE_WEB_SESSION === '1',
  allowUnverifiedRegistration: process.env.NODE_ENV !== 'production' && host === '127.0.0.1',
  moderatorIds: authorizedAccounts('APP_SOCIAL_MODERATOR_IDS'),
  privacyReviewerIds: authorizedAccounts('APP_PRIVACY_REVIEWER_IDS'),
  authProvider, deliverEmailCode, deliverPhoneCode,
  phoneCodesEnabled: Boolean(deliverPhoneCode) || (process.env.APP_PHONE_CODES ?? (authProvider ? 'local' : 'off')) === 'local',
});
const guestCleanup = setInterval(() => store.purgeGuests(Date.now()), 60 * 60 * 1000);
const deletionRetry = setInterval(handler.retryPendingDeletions, 60_000);
guestCleanup.unref();
deletionRetry.unref();
const server = createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, handler);
server.listen(port, host, () => console.log(`app account API listening on http://${host}:${port}`));
server.on('close', () => {
  clearInterval(guestCleanup);
  clearInterval(deletionRetry);
  store.close();
});
