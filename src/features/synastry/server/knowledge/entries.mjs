import catalogue from './synastry-knowledge.json' with { type: 'json' };
import { summarySections, summarySystems } from '../../model/summary.ts';

const hasKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const text = (value) => typeof value === 'string' && Boolean(value.trim());
const optionalText = (value) => value === null || text(value);
const topics = summarySections.map(({ type }) => type);

export function validateEntries(entries) {
  if (!Array.isArray(entries)) throw new Error('The synastry catalogue must be an array.');
  const ids = new Set();
  const passages = new Set();
  for (const entry of entries) {
    if (!hasKeys(entry, ['id', 'source', 'category', 'originalText', 'matchConditions', 'modernInterpretation'])) {
      throw new Error(`Invalid synastry entry fields for ${entry?.id}.`);
    }
    const { id, source, category, originalText, matchConditions, modernInterpretation } = entry;
    const { original, formatted } = matchConditions ?? {};
    const validFormat = formatted?.status === 'ready'
      ? hasKeys(formatted, ['status', 'alternatives']) && Array.isArray(formatted.alternatives)
        && formatted.alternatives.length > 0 && original?.length > 0 && text(originalText) && text(modernInterpretation)
      : formatted?.status === 'unresolved' && hasKeys(formatted, ['status', 'required', 'reason'])
        && text(formatted.reason) && Array.isArray(formatted.required) && formatted.required.length > 0
        && formatted.required.every((row) => hasKeys(row, ['subject', 'criterion']) && text(row.subject) && text(row.criterion));
    if (!Number.isSafeInteger(id) || id <= 0 || ids.has(id)
      || !hasKeys(source, ['book', 'locator', 'url']) || !text(source.book) || !text(source.locator)
      || !(source.url === null || text(source.url) && /^https?:\/\//iu.test(source.url) && URL.canParse(source.url))
      || !hasKeys(category, ['method', 'topic', 'contentType']) || !summarySystems.includes(category.method)
      || !topics.includes(category.topic) || !['personality', 'fact'].includes(category.contentType)
      || !optionalText(originalText) || !optionalText(modernInterpretation)
      || !hasKeys(matchConditions, ['original', 'formatted']) || !Array.isArray(original) || !original.every(text) || !validFormat) {
      throw new Error(`Incomplete or duplicate synastry entry ${id}.`);
    }
    if (originalText !== null) {
      const passage = [source.book, source.locator, originalText].map((value) => value.normalize('NFKC').trim());
      const key = JSON.stringify(passage);
      if (passages.has(key)) throw new Error(`Duplicate original passage at entry ${id}.`);
      passages.add(key);
    }
    ids.add(id);
  }
  return entries;
}

export const sourceEntries = validateEntries(catalogue);
