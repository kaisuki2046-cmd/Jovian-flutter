import { createHash } from 'node:crypto';
import { previewConsentDocuments } from './agreements/model/preview-consent-documents.mjs';

const agreementIds = ['terms', 'privacy', 'ai'];

export const aiConsentPurposes = [
  'destiny.cloud_interpretation',
  'fortune.cloud_interpretation',
  'synastry.cloud_interpretation',
  'divination.cloud_assistance',
];

export function createAgreementCatalog(published) {
  return agreementIds.map((id) => {
    const state = published ? 'published' : 'preview';
    const source = published ? published[id] : { ...previewConsentDocuments[id], version: '0.1.2-preview' };
    if (!source || typeof source.version !== 'string' || !/^[a-zA-Z0-9.-]{1,50}$/.test(source.version) ||
        typeof source.title !== 'string' || !source.title.trim() || !Array.isArray(source.sections) ||
        !source.sections.length || !source.sections.every((section) => typeof section?.title === 'string' &&
          section.title.trim() && typeof section.text === 'string' && section.text.trim())) {
      throw new Error('Invalid agreement catalog entry: ' + id);
    }
    const { title, version } = source;
    const sections = source.sections.map(({ title, text }) => ({ title, text }));
    if (published && (/preview|draft/i.test(version) ||
        [title, ...sections.flatMap(({ title, text }) => [title, text])].some((text) => text.includes('【待填')))) {
      throw new Error('Replace preview content before publishing ' + id);
    }
    const hash = createHash('sha256').update(JSON.stringify({ title, sections })).digest('hex');
    return { id, version, hash, title, sections, state };
  });
}
