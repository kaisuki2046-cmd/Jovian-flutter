import { readFileSync } from 'node:fs';
import { chartVersions } from './catalog.mjs';
import { entries } from './entries.mjs';
import { chartScopes, normalizeRuleInput } from './matching.mjs';
import { reportKnowledgeAlternatives, reportKnowledgeEvidence } from './report-knowledge-source.mjs';

export const legacySourceIds = new Set(entries.map(({ id }) => id));

function sourceRecord(source, tradition) {
  for (const key of ['id', 'passageId', 'title', 'locator', 'author', 'edition']) {
    if (!source[key]?.trim()) throw new Error('Incomplete source reference: ' + key);
  }
  const urls = source.alternateUrl ? [source.url, source.alternateUrl] : [source.url];
  if (urls.some(url => !['https:', 'http:'].includes(new URL(url).protocol))) throw new Error('Invalid source URL.');
  return JSON.stringify({ ...source, tradition, basisType: tradition.includes('现代') ? 'modern_interpretation' : 'source_passage' });
}

// The caller clears the previous catalog and owns the transaction for both rule sets.
export function writeLegacyCatalog(db, knowledge) {
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const provenance = db.prepare('INSERT INTO rule_provenance VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const rules = { personality: db.prepare('INSERT INTO personality_rule VALUES (?, ?, ?, ?)'),
    events: db.prepare('INSERT INTO event_rule VALUES (?, ?, ?, ?)') };
  const conditionsSeen = new Set();
  for (const { id, method, layer, tradition, entry, reference, source, input, applicability,
    schemaVersion, sourceRefs, sourceCondition, verification } of entries) {
    const active = knowledge?.get(id)?.filter(row => row.matchConditions.status) ?? [];
    if (active.length > 1) throw new Error('Multiple unified records for legacy rule: ' + id);
    const [canonical] = active;
    if (knowledge && !canonical) continue;
    const formatted = canonical?.matchConditions.formatted;
    const ruleset = formatted?.rulesetVersion ?? chartVersions[method].rulesetVersion;
    const scope = formatted?.chartScope ?? applicability?.chartScope ?? 'natal';
    if (!chartScopes.includes(scope) || applicability && applicability.calculationProfile !== ruleset) throw new Error('Invalid rule applicability: ' + id);
    const adapted = canonical ? reportKnowledgeAlternatives(canonical) : [{ input: normalizeRuleInput(method, input) }];
    if (adapted.length !== 1 || formatted && (formatted.kind !== 'chart' || canonical.category.method !== method
      || adapted[0].compiler || adapted[0].decadalAnchor)) throw new Error('Invalid unified legacy rule: ' + id);
    const conditions = JSON.stringify(adapted[0].input);
    const catalogLayer = canonical ? canonical.category.contentType === 'personality' ? 'personality' : 'events' : layer;
    const catalogTradition = formatted?.tradition ?? tradition;
    const key = JSON.stringify([method, catalogLayer, catalogTradition, scope, conditions]);
    if (conditionsSeen.has(key)) throw new Error('Duplicate rule conditions: ' + id);
    conditionsSeen.add(key);
    provenance.run(id, method, ruleset, scope, conditions, JSON.stringify({ schemaVersion, sourceRefs, sourceCondition, verification,
      ...(canonical && { promptEvidence: reportKnowledgeEvidence(canonical, source) }) }),
      sourceRecord(source, catalogTradition), reference.basis, reference.limit, reference.originalTopic);
    rules[catalogLayer].run(id, JSON.stringify(entry.keywords), entry.reading, canonical?.category.topic ?? entry.topic);
  }
  const collision = db.prepare('SELECT c.id FROM claim_entry c JOIN rule_provenance r ON r.id = c.id LIMIT 1').get();
  if (collision) throw new Error('Duplicate ID across legacy rules and Claims: ' + collision.id);
  db.exec(readFileSync(new URL('./unified-schema.sql', import.meta.url), 'utf8'));
}
