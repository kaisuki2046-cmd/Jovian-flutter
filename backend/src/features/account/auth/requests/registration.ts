import { accountClient, accountRequest } from '../../client';
import { parsePhoneChallenge } from './phone';

export type PasswordRegistration = {
  displayName: string;
  password: string;
} & (
  | { email: string; phone?: never; challengeId?: string; code?: string }
  | { phone: string; email?: never; challengeId?: never; code?: never }
);

export function requestRegistrationCode(email: string) {
  return accountClient.request('/account/auth/register/code', {
    ...accountRequest(),
    method: 'POST',
    body: { email },
    parse: parsePhoneChallenge,
  });
}
