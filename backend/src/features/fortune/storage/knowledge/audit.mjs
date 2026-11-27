import { pathToFileURL } from 'node:url';
import { knowledgePeriods } from './manifest.mjs';
import { ensureFortuneKnowledgeDatabase, knowledgeMethods, openFortuneKnowledgeDatabase } from './database.mjs';

// Report executable coverage, not merely how many rows have been registered.
export function auditFortuneKnowledge(database) {
  const canonicalSources = database.interpretationSources();
  const entries = knowledgeMethods.flatMap(method => {
    const library = database.library(method);
    const sources = new Map(library.entries.map(entry => [entry.id, entry]));
    return library.rules.map(rule => {
      const mapped = rule.queries.length > 0;
      const { title, source } = sources.get(rule.knowledgeId);
      const { id, locator } = canonicalSources.get(rule.knowledgeId);
      return { method, knowledgeId: rule.knowledgeId, id, title, period: rule.period,
        source: { book: source.book, locator, url: source.url },
        ...(rule.hourBasis ? { hourBasis: rule.hourBasis } : {}),
        status: mapped ? 'mapped' : 'unmapped',
        state: !mapped ? 'unsupported' : rule.unresolved.length ? 'partial' : 'complete',
        factTypes: [...new Set(rule.queries.map(query => query.factType))],
        ...(rule.confirmedWhen ? { hasConfirmedRoute: true } : {}),
        remainingConditions: rule.unresolved,
        sourceReviewed: Boolean(rule.review),
      };
    });
  });
  const count = rows => ({ entries: rows.length,
    complete: rows.filter(row => row.state === 'complete').length,
    partial: rows.filter(row => row.state === 'partial').length,
    unsupported: rows.filter(row => row.state === 'unsupported').length,
  });
  const adviceRows = database.adviceCoverage();
  const advice = {
    summary: Object.fromEntries(['entries', 'available', 'unsupported'].map(key =>
      [key, adviceRows.reduce((sum, row) => sum + row[key], 0)])),
    byMethod: Object.fromEntries(adviceRows.map(({ method, ...counts }) => [method, counts])),
  };
  return {
    advice, summary: count(entries), entries,
    byMethod: Object.fromEntries(knowledgeMethods.map(method => [method, count(entries.filter(entry => entry.method === method))])),
    byPeriod: Object.fromEntries(knowledgePeriods.map(period => [period, count(entries.filter(entry => entry.period === period))])),
  };
}

export function groupRemainingFortuneRules(entries, { bySource = false, sameFacts = false } = {}) {
  const groups = new Map();
  for (const entry of entries) {
    if (entry.state === 'complete') continue;
    const factTypes = entry.factTypes.toSorted();
    const { id, knowledgeId, title, period, source, state, remainingConditions, hasConfirmedRoute } = entry;
    const grouping = bySource ? {
      book: source.book,
      document: source.url?.split('#', 1)[0] ?? source.locator.split(' · ').slice(0, 3).join(' · '),
      ...(sameFacts ? { factTypes } : {}),
    } : { factTypes };
    const key = JSON.stringify([entry.method, grouping]);
    if (!groups.has(key)) groups.set(key, { method: entry.method, ...grouping, knowledgeIds: [], rules: [] });
    const group = groups.get(key);
    group.knowledgeIds.push(knowledgeId);
    group.rules.push({ id, knowledgeId, title, period, source, state, remainingConditions,
      ...(bySource ? { factTypes } : {}),
      ...(hasConfirmedRoute ? { hasConfirmedRoute } : {}) });
  }
  return Array.from(groups.values(), group => ({ ...group, count: group.knowledgeIds.length,
    ...(bySource ? { withoutConfirmedRoute: group.rules.filter(rule => !rule.hasConfirmedRoute).length } : {}),
  }))
    .sort((left, right) => right.count - left.count);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const database = openFortuneKnowledgeDatabase(ensureFortuneKnowledgeDatabase());
  try {
    const audit = auditFortuneKnowledge(database);
    const { entries, ...summary } = audit;
    const queue = process.argv.includes('--queue');
    const bySource = queue || process.argv.includes('--source-batches');
    let output = process.argv.includes('--summary') ? summary : audit;
    if (bySource || process.argv.includes('--groups')) {
      const groups = groupRemainingFortuneRules(entries, { bySource, sameFacts: queue });
      output = { ...summary, groups: queue ? groups.map(({ rules, knowledgeIds, ...group }) =>
        ({ ...group, ids: rules.map(rule => rule.id) })) : groups };
    }
    console.log(JSON.stringify(output, null, 2));
  } finally { database.close(); }
}
