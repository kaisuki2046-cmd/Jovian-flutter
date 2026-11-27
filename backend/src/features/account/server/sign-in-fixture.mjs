import { createAgreementCatalog } from '../../compliance/server-entry.mjs';

const agreements = createAgreementCatalog().filter(({ id }) => id === 'terms' || id === 'privacy')
  .map(({ id, version, hash }) => ({ id, version, hash }));

export function withSignInAgreement(path, body) {
  const requiresAgreement = /^(?:\/account)?\/auth\/(?:login|register|guest|phone\/login|social\/(?:wechat|qq))$/.test(path);
  return requiresAgreement ? { acceptance: { agreed: true, agreements }, ...body } : body;
}
