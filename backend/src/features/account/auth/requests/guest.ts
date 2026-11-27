import { RequestError } from '../../../../shared/http/client';
import { accountClient, accountRequest } from '../../client';
import { parseGuestSession } from '../model/archive-identity';
import { isWeb, readNativeToken, saveNativeToken } from '../model/session-token';
import type { SignInAcceptance } from '../../settings/model/agreements';

const path = '/account/auth/guest';

export async function requestGuestSession(signal?: AbortSignal) {
  if (!isWeb && !await readNativeToken()) return null;
  try {
    return await accountClient.request(path, { ...accountRequest(true), signal, parse: parseGuestSession });
  } catch (error) {
    if (error instanceof RequestError && error.status === 401) return null;
    throw error;
  }
}

export async function requestEnterGuest(acceptance: SignInAcceptance) {
  const hasToken = !isWeb && Boolean(await readNativeToken());
  const { guest, token } = await accountClient.request(path, {
    ...accountRequest(hasToken),
    method: 'POST',
    body: { acceptance },
    parse(response) {
      const guest = parseGuestSession(response);
      const { token } = response as { token?: unknown };
      if (!isWeb && (token === undefined ? !hasToken : typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token))) {
        throw new Error('Invalid guest credential.');
      }
      return { guest, token };
    },
  });
  if (!isWeb && typeof token === 'string') await saveNativeToken(token);
  return guest;
}
