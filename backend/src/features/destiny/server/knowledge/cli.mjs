import { readFileSync } from 'node:fs';
import { calculateBaZi, calculateWestern, calculateZiwei } from '../../control/charts.ts';
import { chartFacts, chartVersions } from './catalog.mjs';
import { buildCatalog, catalogDirectory, exportCatalog, exportKnowledge, knowledgeCatalogStatus, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { claimsCatalogStatus, claimInventory, explainClaim, lookupWesternHistoricalCases } from './claims.mjs';
import { lillyMerchantCaseId, lillyMerchantPrintedChartFacts } from './lilly-merchant-case.mjs';
import { parseChartQueries } from './report-lookup.mjs';

const [command, inputFile, ruleId, ...options] = process.argv.slice(2);

function sampleQueries() {
  const place = { latitude: 39.907, longitude: 116.397 };
  const bazi = calculateBaZi(Date.UTC(2000, 7, 13, 16), Date.UTC(2000, 7, 14));
  const ziwei = calculateZiwei({ date: { year: 2000, month: 1, day: 15 }, place, gender: 'female' }, 3);
  const western = calculateWestern(Date.UTC(2000, 0, 15, 4), place);
  return Object.entries({ bazi, ziwei, western }).map(([method, chart]) => ({
    method, rulesetVersion: chartVersions[method].rulesetVersion, confirmedFacts: chartFacts[method](chart),
  }));
}

let result;
if (command === 'build' && !inputFile) {
  buildCatalog();
  result = knowledgeCatalogStatus();
} else if (command === 'status' && !inputFile) {
  result = knowledgeCatalogStatus();
} else if (command === 'export-all' && !inputFile) {
  result = exportKnowledge();
} else if (command === 'search') {
  result = exportKnowledge(catalogDirectory, { search: inputFile ?? '' });
} else if (command === 'claims-status' && !inputFile) {
  result = claimsCatalogStatus();
} else if (command === 'samples' && !inputFile) {
  result = sampleQueries().flatMap((query) => lookupInterpretations(catalogDirectory, query));
} else if (command === 'export' && !inputFile) {
  result = exportCatalog();
} else if (command === 'claims') {
  const search = inputFile?.normalize('NFKC').toLowerCase();
  result = claimInventory().filter(({ claim }) => !search || [
    claim.id, claim.title, claim.source.book, ...claim.category.tags, ...claim.conditions.normalized,
  ].some((value) => value.normalize('NFKC').toLowerCase().includes(search)));
} else if (command === 'lookup' && inputFile) {
  result = lookupInterpretations(catalogDirectory, JSON.parse(readFileSync(inputFile, 'utf8')));
} else if (command === 'historical-case' && inputFile === lillyMerchantCaseId && !ruleId) {
  result = lookupWesternHistoricalCases(chartContext('western', lillyMerchantPrintedChartFacts()), 'Christian Astrology');
} else if (command === 'explain' && inputFile && ruleId) {
  const historicalAphorism = options[0] === '--historical-aphorism';
  const birthBranch = /^--birth-branch=(male|female)$/u.exec(options[1] ?? '')?.[1];
  if (options.length && (!historicalAphorism || options.length > 2 || options.length === 2 && !birthBranch)) {
    throw new Error('Use --historical-aphorism [--birth-branch=male|female] with explain.');
  }
  const supplied = JSON.parse(readFileSync(inputFile, 'utf8'));
  const requiresTimeFiltering = supplied.method === 'ziwei' && supplied.timeKnown === false;
  const query = historicalAphorism || requiresTimeFiltering
    ? parseChartQueries([supplied], { timeKnown: supplied.timeKnown !== false })?.[0] : supplied;
  if (!query) throw new Error('Invalid chart query.');
  const rule = exportCatalog().find(({ id, promptEvidence }) => id === ruleId || String(promptEvidence?.knowledgeId) === ruleId);
  const chart = query.rulesetVersion === chartVersions[query.method]?.rulesetVersion
    ? { ...chartContext(query.method, query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope),
      ptolemyParentAttendanceText: query.ptolemyParentAttendanceText, lillyParentDerivedFigure: query.lillyParentDerivedFigure } : null;
  if (rule) {
    const applicable = chart && query.method === rule.method && (!query.tradition || query.tradition === rule.source.tradition);
    result = { id: rule.id, ...(rule.promptEvidence && { knowledgeId: rule.promptEvidence.knowledgeId }),
      source: rule.source, limit: rule.limit,
      ...(applicable ? evaluateRule(rule.input, rule.chartScope, chart) : { matched: false, reason: 'calculation_profile' }) };
  } else {
    result = explainClaim(ruleId, query.method, chart, query.tradition, undefined, { historicalAphorism, birthBranch });
    if (!result) throw new Error('Unknown rule: ' + ruleId);
    if (/^\d+$/u.test(ruleId)) result.knowledgeId = Number(ruleId);
  }
} else {
  throw new Error('Usage: cli.mjs (build | status | export-all | search [text] | claims-status | samples | export | claims [text] | lookup <input.json> | historical-case lilly_english_merchant | explain <input.json> <rule-id> [--historical-aphorism [--birth-branch=male|female]])');
}

console.log(JSON.stringify(result, null, 2));
