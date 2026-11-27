import { aiConsentPurposes, createAgreementCatalog } from '../../compliance/server-entry.mjs';
import { fail } from './account-failure.mjs';

const requiredIds = ['privacy', 'terms'];
const validSources = new Set(['first-use', 'settings', 'feature']);

export function createAgreementControl({ store, now, publishedAgreements, limit }) {
  const documents = createAgreementCatalog(publishedAgreements);
  store.seedAgreements(documents);
  const byId = new Map(documents.map((document) => [document.id, document]));

  function owner(token) {
    const identity = store.getArchiveIdentity(token, now());
    if (!identity) fail(401);
    return identity;
  }

  function hasRequired(identity) {
    return requiredIds.every((id) => store.hasAgreement(identity, byId.get(id), ''));
  }

  function state(identity) {
    return {
      requiredAccepted: hasRequired(identity),
      permissions: Object.fromEntries(aiConsentPurposes.map((purpose) =>
        [purpose, store.hasAgreement(identity, byId.get('ai'), purpose)])),
      decisions: store.getAgreementHistory(identity),
    };
  }

  function assertVersion(proof, document, conflict = 409) {
    if (proof?.version !== document.version || proof?.hash !== document.hash) fail(conflict);
  }

  function requiredDecisions(agreements, conflict) {
    if (!Array.isArray(agreements) || agreements.length !== requiredIds.length) fail(400);
    return requiredIds.map((id) => {
      const document = byId.get(id);
      assertVersion(agreements.find((proof) => proof?.id === id), document, conflict);
      return { document, purpose: '', agreed: true };
    });
  }

  return {
    catalog: () => ({ documents }),
    state: (token) => state(owner(token)),
    isConfirmed: (identity) => hasRequired(identity),
    validateSignIn(acceptance) {
      if (acceptance?.agreed !== true) fail(428);
      return requiredDecisions(acceptance.agreements, 412);
    },
    recordSignIn(token, decisions) {
      store.saveAgreementDecisions(owner(token), decisions, now(), 'sign-in');
    },
    version(token, id, version) {
      const identity = owner(token);
      if (!store.getAgreementHistory(identity).some((row) => row.agreementId === id && row.version === version)) fail(404);
      return store.getAgreementVersion(id, version);
    },
    permission(token, purpose) {
      if (!aiConsentPurposes.includes(purpose)) fail(400);
      const identity = owner(token);
      return { allowed: hasRequired(identity) && store.hasAgreement(identity, byId.get('ai'), purpose), identity };
    },
    async acceptRequired({ token, readInput }) {
      const identity = owner(token);
      limit('required-agreements:' + identity.id, 40);
      const { agreements, source } = await readInput();
      if (!['first-use', 'settings', 'sign-in'].includes(source)) fail(400);
      const decisions = requiredDecisions(agreements);
      const current = owner(token);
      if (current.id !== identity.id || current.kind !== identity.kind) fail(401);
      store.saveAgreementDecisions(current, decisions, now(), source);
      return state(current);
    },
    async choosePermission({ token, readInput }) {
      const identity = owner(token);
      limit('purpose-agreement:' + identity.id, 60);
      const body = await readInput();
      if (!aiConsentPurposes.includes(body.purpose) || typeof body.agreed !== 'boolean' ||
          !validSources.has(body.source)) fail(400);
      const document = byId.get('ai');
      assertVersion(body, document);
      const current = owner(token);
      if (current.id !== identity.id || current.kind !== identity.kind) fail(401);
      if (body.agreed && !hasRequired(current)) fail(403);
      store.saveAgreementDecisions(current, [{ document, purpose: body.purpose, agreed: body.agreed }], now(), body.source);
      return state(current);
    },
  };
}
