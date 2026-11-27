import { accountClient, accountRequest } from '../../client';
import { parsePhoneChallenge, type PhoneProof } from './phone';
import { isWeb, readNativeToken } from '../model/session-token';

const path = '/account/auth/password-reset/';

export function requestRecoveryCode(phone: string) {
  return accountClient.request(path + 'code', {
    ...accountRequest(), method: 'POST', body: { phone }, parse: parsePhoneChallenge,
  });
}

export function verifyRecoveryCode(body: PhoneProof) {
  return accountClient.request(path + 'verify', {
    ...accountRequest(), method: 'POST', body,
    parse(response) {
      const { resetToken } = response as { resetToken?: unknown };
      if (typeof resetToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(resetToken)) {
        throw new Error('Invalid password recovery token.');
      }
      return resetToken;
    },
  });
}

export async function resetPassword(body: { phone: string; resetToken: string; newPassword: string }) {
  return accountClient.request(path + 'complete', {
    ...accountRequest(!isWeb && Boolean(await readNativeToken())), method: 'POST', body, response: 'empty',
  });
}
