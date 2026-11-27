import { accountClient, accountRequest, anonymousAccountClient } from '../../client';
import { aiPermissionPurposes, parseAgreement, parseAgreementCatalog, parseAgreementState, signInAcceptance,
  type AgreementCatalog, type AgreementId, type AgreementVersion, type AiPermission } from '../model/agreements';

const path = '/account/agreements';

export function requestAgreementCatalog(signal?: AbortSignal) {
  return anonymousAccountClient.request(path + '/catalog', { signal, parse: parseAgreementCatalog });
}

export function requestAgreementState(signal?: AbortSignal) {
  return accountClient.request(path, { ...accountRequest(true), signal, parse: parseAgreementState });
}

export function requestAgreementVersion(id: AgreementId, version: string, signal?: AbortSignal) {
  return accountClient.request(`${path}/${id}/${encodeURIComponent(version)}`, {
    ...accountRequest(true), signal, parse: parseAgreement,
  });
}

export function acceptRequiredAgreements(catalog: AgreementCatalog, signal?: AbortSignal) {
  const { agreements } = signInAcceptance(catalog);
  return accountClient.request(path + '/confirmation', {
    ...accountRequest(true), signal, method: 'POST', body: { agreements, source: 'sign-in' }, parse: parseAgreementState,
  });
}

export function chooseAiPermission(document: AgreementVersion, purpose: AiPermission, agreed: boolean, signal?: AbortSignal,
  source: 'settings' | 'first-use' = 'settings') {
  return accountClient.request(path + '/permission', {
    ...accountRequest(true), signal, method: 'POST',
    body: { version: document.version, hash: document.hash, purpose, agreed, source },
    parse: parseAgreementState,
  });
}

export async function grantAllAiPermissions(document: AgreementVersion, source: 'settings' | 'first-use', signal?: AbortSignal) {
  await Promise.allSettled(aiPermissionPurposes.map(purpose => chooseAiPermission(document, purpose, true, signal, source)));
  // Individual writes can finish in either order or partially fail. Display the stored result.
  return requestAgreementState(signal);
}
