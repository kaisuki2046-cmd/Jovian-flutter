export const aiPermissions = {
  'destiny.cloud_interpretation': '命理在线解读',
  'fortune.cloud_interpretation': '运势在线解读',
  'synastry.cloud_interpretation': '合盘在线解读',
  'divination.cloud_assistance': '算事问题理解与在线解读',
} as const;

export type AiPermission = keyof typeof aiPermissions;
export const aiPermissionPurposes = Object.keys(aiPermissions) as AiPermission[];
export const requiredAgreementIds = ['privacy', 'terms'] as const;
export type AgreementId = (typeof requiredAgreementIds)[number] | 'ai';

export type AgreementVersion = {
  id: AgreementId;
  version: string;
  hash: string;
  state: 'preview' | 'published';
  title: string;
  sections: { title: string; text: string }[];
};
export type AgreementCatalog = Record<AgreementId, AgreementVersion>;
export type SignInAcceptance = {
  agreed: true;
  agreements: Pick<AgreementVersion, 'id' | 'version' | 'hash'>[];
};

export function signInAcceptance(catalog: AgreementCatalog): SignInAcceptance {
  return { agreed: true, agreements: requiredAgreementIds.map((id) => {
    const { version, hash } = catalog[id];
    return { id, version, hash };
  }) };
}

type AgreementDecision = {
  agreementId: AgreementId;
  version: string;
  purpose: AiPermission | '';
  agreed: boolean;
  decidedAt: number;
  source: string;
};

export type AgreementState = {
  requiredAccepted: boolean;
  permissions: Record<AiPermission, boolean>;
  decisions: AgreementDecision[];
};

export function allAiPermissionsGranted(state: AgreementState) {
  return aiPermissionPurposes.every(purpose => state.permissions[purpose]);
}

export function parseAgreement(value: unknown): AgreementVersion {
  const entry = value as Partial<AgreementVersion> | null;
  if (!entry || (entry.id !== 'privacy' && entry.id !== 'terms' && entry.id !== 'ai') ||
      typeof entry.version !== 'string' || typeof entry.hash !== 'string' ||
      (entry.state !== 'preview' && entry.state !== 'published') || typeof entry.title !== 'string' ||
      !Array.isArray(entry.sections) || !entry.sections.every((section) =>
        typeof section?.title === 'string' && typeof section?.text === 'string')) {
    throw new Error('Invalid agreement document');
  }
  return entry as AgreementVersion;
}

export function parseAgreementCatalog(value: unknown) {
  const documents = (value as { documents?: unknown } | null)?.documents;
  if (!Array.isArray(documents)) throw new Error('Invalid agreement catalog');
  const entries = documents.map(parseAgreement);
  const privacy = entries.find(({ id }) => id === 'privacy');
  const terms = entries.find(({ id }) => id === 'terms');
  const ai = entries.find(({ id }) => id === 'ai');
  if (!privacy || !terms || !ai) throw new Error('Incomplete agreement catalog');
  return { privacy, terms, ai };
}

export function parseAgreementState(value: unknown): AgreementState {
  const state = value as Partial<AgreementState> | null;
  if (!state || typeof state.requiredAccepted !== 'boolean' || !state.permissions ||
      Object.keys(aiPermissions).some((key) => typeof state.permissions?.[key as AiPermission] !== 'boolean') ||
      !Array.isArray(state.decisions) || !state.decisions.every((item) =>
        item && ['privacy', 'terms', 'ai'].includes(item.agreementId) && typeof item.version === 'string' &&
        typeof item.agreed === 'boolean' && Number.isSafeInteger(item.decidedAt) && typeof item.source === 'string' &&
        (item.purpose === '' || Object.hasOwn(aiPermissions, item.purpose)))) {
    throw new Error('Invalid agreement state');
  }
  return state as AgreementState;
}
