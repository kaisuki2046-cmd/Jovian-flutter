import { writeFileSync } from 'node:fs';
import { calculateBaZi, calculateWestern, calculateZiwei, chartFacts, chartVersions, ziweiTimeIndex } from '../control/charts.ts';
import { createReportLookup, parseChartQueries } from './knowledge/report-lookup.mjs';
import { collectReportMaterials } from './report-materials.mjs';
import { rawReportScores, reportEvidenceKey } from './report-ranking.mjs';

// Synthetic reference panel. Balance the 24 civil hours and both birth branches;
// spread local dates from 1900 through 2024 and vary the chart location.
const sampleSize = 96;
const locations = [
  { latitude: 39.9042, longitude: 116.4074, offset: 8 },
  { latitude: 22.3193, longitude: 114.1694, offset: 8 },
  { latitude: 35.6762, longitude: 139.6503, offset: 9 },
  { latitude: 51.5072, longitude: -0.1276, offset: 0 },
  { latitude: 40.7128, longitude: -74.006, offset: -5 },
  { latitude: -33.8688, longitude: 151.2093, offset: 10 },
];
const dayMs = 86_400_000;
const start = Date.UTC(1900, 0, 1);
const days = (Date.UTC(2025, 0, 1) - start) / dayMs;
let state = 0x4b617a69;
function random() {
  state = (Math.imul(1664525, state) + 1013904223) >>> 0;
  return state / 2 ** 32;
}

const lookup = createReportLookup(undefined, undefined, { birthOnlyTieban: true });
const hits = new Map();
const panel = [];
for (let index = 0; index < sampleSize; index++) {
  const dateStart = start + dayMs * Math.floor(days * (index + random()) / sampleSize);
  const local = new Date(dateStart);
  const hour = index * 5 % 24;
  const minute = Math.floor(random() * 60);
  const place = locations[(index * 5 + Math.floor(index / 6)) % locations.length];
  const wallTime = dateStart + (hour * 60 + minute) * 60_000;
  const instant = wallTime - place.offset * 3_600_000;
  const gender = Math.floor(index / 24) % 2 ? 'female' : 'male';
  const date = { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() };
  const genderFact = { kind: 'natal_gender', gender: gender === 'male' ? '男' : '女' };
  const western = calculateWestern(instant, place);
  const daylight = western.sect ? [{ kind: 'natal_daylight', sect: western.sect }] : [];
  const facts = {
    bazi: [...chartFacts.bazi(calculateBaZi(instant, wallTime, gender)), ...daylight, genderFact],
    ziwei: [...chartFacts.ziwei(calculateZiwei({ date, time: { timeKnown: true, hour, minute }, place, gender }, ziweiTimeIndex(wallTime))), ...daylight],
    western: [...chartFacts.western(western), genderFact],
  };
  const input = Object.entries(facts).map(([method, confirmedFacts]) => ({
    method, confirmedFacts: [...new Map(confirmedFacts.map(fact => [JSON.stringify(fact), fact])).values()],
    rulesetVersion: chartVersions[method].rulesetVersion,
    ...(method === 'bazi' && { birthYear: date.year }),
  }));
  const queries = parseChartQueries(input);
  if (!queries) throw new Error(`Invalid synthetic report chart at index ${index}: ${input.filter(query => !parseChartQueries([query]))
    .map(query => query.method + ' ' + query.confirmedFacts.length).join(', ')}`);
  const entries = collectReportMaterials(lookup(queries), { combineAliases: false, forPrompt: true }).flatMap(block => block.entries);
  panel.push(entries.map(({ kind, id, knowledgeId, branch, conditions, originalText, modernInterpretation, source, originalKind }) =>
    ({ kind, id, knowledgeId, branch: branch && { text: branch.text }, conditions, originalText, modernInterpretation, source, originalKind })));
  for (const key of new Set(entries.map(reportEvidenceKey))) hits.set(key, (hits.get(key) ?? 0) + 1);
  if ((index + 1) % 24 === 0) console.log('Calibrated charts: ' + (index + 1));
}

const ordered = entries => [...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
const calibration = { sampleSize, hits: Object.fromEntries(ordered(hits)) };
const counts = [new Map(), new Map(), new Map()];
const described = new Set();
for (const entries of panel) for (const entry of entries) {
  const key = reportEvidenceKey(entry);
  const alreadyDescribed = described.has(key);
  described.add(key);
  rawReportScores(entry, calibration).forEach((value, dimension) => {
    if (dimension && alreadyDescribed) return;
    const histogram = counts[dimension];
    histogram.set(value, (histogram.get(value) ?? 0) + 1);
  });
}
calibration.distributions = counts.map(ordered);
const lines = [
  '{', `  "sampleSize": ${sampleSize},`, '  "hits": {',
  Object.entries(calibration.hits).map(([key, count]) => `    ${JSON.stringify(key)}: ${count}`).join(',\n'),
  '  },', '  "distributions": [',
  calibration.distributions.map(rows => '    [\n' + rows.map(row => '      ' + JSON.stringify(row)).join(',\n') + '\n    ]').join(',\n'),
  '  ]', '}', '',
];
writeFileSync(new URL('./report-ranking-calibration.json', import.meta.url), lines.join('\n'));
console.log(`Recorded ${hits.size} distinct materials across ${sampleSize} charts.`);
