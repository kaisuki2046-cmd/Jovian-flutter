import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import './server/knowledge/runtime.mjs';
import { formatFortunePrompt } from './control/fortune-prompt.mjs';

const { evaluateFortuneRules } = await import('./control/knowledge/catalog.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { readTransitLongitude } = await import('./control/solar-transits.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');

const catalog = JSON.parse(readFileSync(new URL('./model/knowledge/fortune_knowledge.json', import.meta.url), 'utf8'));
const periods = { day: 460, week: 500, month: 391, year: 11 };

test('all modern entries without original conditions retain their source records and supply no SQLite predicates', () => {
  for (const [period, count] of Object.entries(periods)) {
    const drafts = catalog[period].filter(({ id }) => id >= 867 && id <= 2228);
    assert.equal(drafts.length, count);
    const indexed = new Map(evaluateFortuneRules('western', period, []).map(rule => [rule.knowledgeId, rule]));
    for (const draft of drafts) {
      const { status, original, formatted } = draft.matchConditions;
      assert.equal(status, 'unmapped', String(draft.id));
      assert.equal(draft.originalText, null);
      assert.deepEqual(original, []);
      assert.ok(formatted.queries.length && formatted.unresolved.length);
      const rule = indexed.get('fortune-entry-' + draft.id);
      assert.equal(rule.queryCount, 0);
      assert.deepEqual(rule.required, []);
    }
  }
});

test('the unsupported weekly material stays out of reports even when the real chart meets its draft condition', () => {
  const at = Date.UTC(2026, 10, 5, 12);
  const input = { periodType: 'week', displayTimezone: 'UTC', targetPeriod: { weekStartDate: '2026-11-02' } };
  const solarLongitude = readTransitLongitude('Sun', at);
  const ascendant = ((Math.floor(solarLongitude / 30) + 11) % 12) * 30 + 15;
  const chart = { timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] },
    western: { engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1',
      rawResult: [{ ascendant, midheaven: 0, positions: [] }] } };
  const reference = { snapshotId: 'source-review-fixture', chart };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, at, reference)));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, at), reference.snapshotId, reference);
  const witness = run.facts.find(fact => fact.factType === 'house_interval' && fact.completeness === 'complete'
    && fact.normalizedPayload.transitBody === 'Sun' && fact.normalizedPayload.natalHouse === 2);
  assert.ok(witness);
  assert.ok(Date.parse(witness.activeTo) - Date.parse(witness.activeFrom) >= 72 * 3_600_000);
  const outcome = matchFortuneKnowledge(run).byMethod.western.find(rule => rule.knowledgeId === 'fortune-entry-1045');
  assert.equal(outcome.status, 'unsupported');
  const report = interpretFortune(run, requestForFortuneRun(run), 'source-review-fixture');
  const { input: modelInput } = buildFortuneModelContext(run, report);
  assert.ok(modelInput.sections.every(section => section.findings.length === 0));
  assert.doesNotMatch(formatFortunePrompt(modelInput), /过境太阳停留于本命第2宫/u);
});
