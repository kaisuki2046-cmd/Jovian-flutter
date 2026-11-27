import { DatabaseSync } from 'node:sqlite';
import { setTimeout as wait } from 'node:timers/promises';
import { corpus } from './corpus.mjs';

function terms(value) {
  const words = value.toLowerCase().match(/[a-z0-9]+|[\p{Script=Han}]+/gu) ?? [];
  return new Set(words.flatMap((word) => /\p{Script=Han}/u.test(word) && word.length > 1
    ? Array.from({ length: word.length - 1 }, (_, index) => word.slice(index, index + 2))
    : [word]));
}

const indexed = corpus.map((entry) => ({ entry, terms: terms(entry.tags + ' ' + entry.text) }));

export function createRetriever({ embeddingUrl, extensionPath, transport = fetch } = {}) {
  let distance;
  if (embeddingUrl || extensionPath) {
    if (!embeddingUrl || !extensionPath) throw new Error('Configure both local BGE-M3 and sqlite-vec.');
    const endpoint = new URL(embeddingUrl);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)
      || !['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
      throw new Error('The embedding service must run on loopback.');
    }
    const db = new DatabaseSync(':memory:', { allowExtension: true });
    db.loadExtension(extensionPath);
    db.enableLoadExtension(false);
    distance = db.prepare('SELECT vec_distance_cosine(?, ?) AS distance');
  }

  async function embed(input, signal) {
    const response = await transport(embeddingUrl, {
      method: 'POST', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'BAAI/bge-m3', input }),
    });
    if (!response.ok) throw new Error('Local embedding service failed.');
    const { data } = await response.json();
    if (!Array.isArray(data) || data.length !== input.length) throw new Error('Invalid embedding response.');
    const sorted = [...data].sort((a, b) => a.index - b.index);
    return sorted.map(({ index, embedding }, expected) => {
      if (index !== expected || !Array.isArray(embedding) || embedding.length !== 1024
        || !embedding.every(Number.isFinite) || !embedding.some((value) => value !== 0)) {
        throw new Error('Invalid BGE-M3 embedding.');
      }
      return Buffer.from(new Float32Array(embedding).buffer);
    });
  }

  let corpusIndex;
  return async function retrieve(sections, signal) {
    const queries = sections.map((section) => section.topicName + ' ' + section.angle + ' ' +
      section.evidence.map(({ text }) => text).join(' '));
    let vectors;
    let corpusVectors;
    if (distance) {
      try {
        corpusIndex ??= embed(corpus.map(({ tags, text }) => tags + ' ' + text), AbortSignal.timeout(90_000))
          .catch((error) => { corpusIndex = undefined; throw error; });
        const waitLimit = new AbortController();
        try {
          corpusVectors = await Promise.race([corpusIndex, wait(8_000, undefined, {
            signal: AbortSignal.any([signal, waitLimit.signal]), ref: false,
          })]);
        } finally {
          waitLimit.abort();
        }
        if (corpusVectors) vectors = await embed(queries, AbortSignal.any([signal, AbortSignal.timeout(8_000)]));
      } catch {
        if (signal.aborted) signal.throwIfAborted();
      }
    }
    const results = sections.map((section, queryIndex) => {
      const query = terms(queries[queryIndex]);
      const methods = new Set(section.evidence.map(({ method }) => method));
      const ranked = indexed.flatMap(({ entry, terms: entryTerms }, index) => {
        if (entry.topic !== section.topicId || !methods.has(entry.method)) return [];
        const lexical = [...query].filter((term) => entryTerms.has(term)).length / Math.max(1, query.size);
        const semantic = vectors ? 1 - distance.get(vectors[queryIndex], corpusVectors[index]).distance : 0;
        return [{ entry, score: lexical + Math.max(0, semantic) * 0.7 }];
      }).sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
      return { topicId: section.topicId, knowledge: ranked.slice(0, 3).map(({ entry: { id, text } }) => ({ id, text })) };
    });
    return { results, mode: vectors ? 'hybrid' : 'local-keyword' };
  };
}
