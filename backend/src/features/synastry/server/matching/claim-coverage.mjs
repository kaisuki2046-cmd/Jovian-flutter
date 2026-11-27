import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { openPassageCatalog } from '../knowledge/claims-sqlite.mjs';

const { compareCharts } = await import('../../control/compare.ts');
const { prepareSynastrySummary } = await import('../../control/summary.ts');
const { collectEntryEvidence } = await import('../match-evidence.mjs');
const { isConsistentMatchingFact } = await import('./fact-integrity.mjs');

export function auditPassageCoverage(charts, pairs) {
  const catalog = openPassageCatalog(':memory:');
  try {
    const declared = new Map(catalog.entries.filter(({ matchConditions }) => matchConditions.formatted.status === 'ready')
      .map(({ id, category, matchConditions }) => [id, { category, originalConditions: matchConditions.original }]));
    const programs = Map.groupBy(catalog.programs, ({ entryId }) => entryId);
    const supported = new Set();
    const witnesses = {};
    const alternativeWitnesses = new Map();
    let calculatedFacts = 0;
    let inconsistentFacts = 0;
    for (const { a, b } of pairs) {
      if (!charts[a] || !charts[b] || a === b) throw new Error('Invalid two-chart witness pair.');
      const comparison = compareCharts({ mode: 'manual_subject', chart: charts[a] }, { mode: 'manual_subject', chart: charts[b] });
      const result = collectEntryEvidence(prepareSynastrySummary(comparison), catalog);
      if (!result) throw new Error('Calculated facts do not satisfy the request contract.');
      calculatedFacts += result.chartFacts.length;
      for (const fact of result.chartFacts) {
        const { system, rule, facts } = fact;
        if (!isConsistentMatchingFact(fact)) inconsistentFacts++;
        for (const name of Object.keys(facts)) supported.add(`${system}:${rule}:facts.${name}`);
      }
      for (const { id: entryId, conditionIndex, proofs } of result.hits) {
        const witness = { a, b, entryId, directions: proofs.map(({ direction }) => direction) };
        witnesses[entryId] ??= witness;
        const key = JSON.stringify([entryId, conditionIndex]);
        if (!alternativeWitnesses.has(key)) alternativeWitnesses.set(key, witness);
      }
    }
    const missing = [...declared].filter(([id]) => !Object.hasOwn(witnesses, id)).map(([entryId, row]) => {
      const alternatives = programs.get(entryId) ?? [];
      const fields = [...new Set(alternatives.flatMap(({ program }) => program.required.flatMap(({ type, conditions, exclusions }) =>
        [...conditions, ...exclusions.flat()].filter(({ required }) => required)
          .flatMap(({ field, expectedField }) => [field, expectedField].filter((key) => key?.startsWith('facts.'))
            .map((key) => type + ':' + key)))))];
      return { entryId, ...row, unseenFields: fields.filter((key) => !supported.has(key)) };
    });
    const missingAlternatives = catalog.programs.filter(({ entryId, conditionIndex }) =>
      !alternativeWitnesses.has(JSON.stringify([entryId, conditionIndex]))).map(({ entryId, conditionIndex }) =>
      ({ entryId, conditionIndex }));
    return { pairs: pairs.length, calculatedFacts, inconsistentFacts, total: declared.size,
      observed: Object.keys(witnesses).length, missing, witnesses, alternateConditions: catalog.programs.length,
      observedAlternatives: alternativeWitnesses.size, missingAlternatives,
      pendingSourceEntries: catalog.stats().unresolved };
  } finally { catalog.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , chartsPath, pairsPath, outputPath] = process.argv;
  if (!chartsPath || !pairsPath || !outputPath) throw new Error('Provide chart snapshots, witness pairs and an output path.');
  const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
  const input = read(pairsPath);
  const pairs = Array.isArray(input) ? input : Object.values(input.sceneWitnesses);
  const unique = new Map(pairs.flatMap(({ a, b }) => [
    [JSON.stringify([a, b]), { a, b }], [JSON.stringify([b, a]), { a: b, b: a }],
  ]));
  const report = auditPassageCoverage(read(chartsPath), [...unique.values()]);
  writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pairs: report.pairs, calculatedFacts: report.calculatedFacts, total: report.total,
    observed: report.observed, missing: report.missing.length, inconsistentFacts: report.inconsistentFacts,
    alternateConditions: report.alternateConditions, observedAlternatives: report.observedAlternatives }));
  if (report.missing.length || report.inconsistentFacts || report.missingAlternatives.length) process.exitCode = 1;
}
