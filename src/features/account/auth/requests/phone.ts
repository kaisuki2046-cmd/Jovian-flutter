import { accountClient, accountRequest } from '../../client';

export type PhonePurpose = 'login' | 'bind';
export type PhoneChallenge = { challengeId: string; expiresIn: number; delivery?: 'local-inbox' };
export type PhoneProof = { phone: string; challengeId: string; code: string };
export type PhoneBindingProof = PhoneProof & ({ password: string } | { currentChallengeId: string; currentCode: string });

function parsePhone(value: unknown) {
  const { phone } = value as { phone?: unknown };
  if (phone !== null && typeof phone !== 'string') throw new Error('Invalid bound phone.');
  return phone;
}

export function requestPhoneCode(purpose: PhonePurpose | 'bind-current', phone: string) {
  return issuePhoneCode(purpose, { phone });
}

export function requestPasswordSetupCode() {
  return issuePhoneCode('password-setup', {});
}

function issuePhoneCode(purpose: PhonePurpose | 'bind-current' | 'password-setup', body: { phone?: string }) {
  return accountClient.request('/account/auth/phone/' + purpose + '/code', {
    ...accountRequest(purpose !== 'login'), method: 'POST', body,
    parse: parsePhoneChallenge,
  });
}

export function parsePhoneChallenge(value: unknown): PhoneChallenge {
  const { challengeId, expiresIn, delivery } = value as Partial<PhoneChallenge>;
  if (typeof challengeId !== 'string' || typeof expiresIn !== 'number') throw new Error('Invalid phone challenge.');
  return { challengeId, expiresIn, delivery: delivery === 'local-inbox' ? delivery : undefined };
}

export function requestBoundPhone(signal?: AbortSignal) {
  return accountClient.request('/account/auth/phone', { ...accountRequest(true), signal, parse: parsePhone });
}

export function requestBindPhone(body: PhoneBindingProof) {
  return accountClient.request('/account/auth/phone/bind', {
    ...accountRequest(true), method: 'POST', body, parse: parsePhone,
  });
}
