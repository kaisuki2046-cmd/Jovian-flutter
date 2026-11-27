import { createContentScorer } from './content-specificity.mjs';
import { describeScores, percentileScale } from './score-percentiles.mjs';

const sourcePriorities = [
  { "priority": 100, "titles": ["三命通会", "三命通會"], "ids": ["SOURCE-BAZI-CLASSIC"] },
  { "priority": 95, "titles": ["紫微斗数全书"] },
  { "priority": 95, "titles": ["Christian Astrology"] },
  { "priority": 95, "titles": ["Tetrabiblos"], "ids": ["SOURCE-TRADITIONAL-RULERS", "SOURCE-WEST-ASPECTS"] },
  { "priority": 90, "titles": ["钦定协纪辨方书", "欽定協紀辨方書"] },
  { "priority": 90, "titles": ["神峰通考"] },
  { "priority": 90, "titles": ["紫微斗数捷览"] },
  { "priority": 85, "titles": ["A New and Complete Illustration of the Celestial Science of Astrology"] },
  { "priority": 80, "titles": ["Problems We All Face"] },
  { "priority": 80, "titles": ["The Guide to Astrology"] },
  { "priority": 65, "titles": ["Cafe Astrology"] },
  { "priority": 55, "titles": ["紫微斗数入门与术语"], "ids": ["SOURCE-IZTRO-TERMS"] },
  { "priority": 40, "ids": ["SOURCE-SYNASTRY-METHODS-V2"] },
  { "priority": 20, "ids": ["SOURCE-L0"] },
  { "priority": 10, "ids": ["SOURCE-PRODUCT"] }
];

const normalizeTitle = (title) => title?.normalize('NFKC').trim().toLowerCase();
const sourceScale = percentileScale(sourcePriorities.map(({ priority }) => priority));
const sourceProfiles = sourcePriorities.map(({ priority, ids = [], titles = [] }) => ({ ids, titles, anchor: priority,
  score: Math.round((priority * 0.85 + sourceScale(priority) * 0.15) * 100) / 100 }));
const priorityById = new Map(sourceProfiles.flatMap((profile) => profile.ids.map((id) => [id, profile])));
const priorityByTitle = new Map(sourceProfiles.flatMap((profile) => profile.titles.map((title) => [normalizeTitle(title), profile])));
const projectSources = new Set(['SOURCE-L0', 'SOURCE-PRODUCT']);

export function sourceCredibility(sources) {
  const primary = sources.find(({ id }) => !projectSources.has(id)) ?? sources[0];
  const profile = primary && (priorityById.get(primary.id) ?? priorityByTitle.get(normalizeTitle(primary.title)));
  return { score: profile?.score ?? 0, sourceId: primary?.id ?? null,
    title: profile?.titles[0] ?? primary?.title ?? null, anchor: profile?.anchor ?? null, configured: Boolean(profile) };
}

function conditionWeight({ field, operator, expected, expectedField, required }) {
  if (!required || field === 'direction' || operator === 'exists') return 0;
  if (operator === 'eq') return 4;
  if (operator === 'in') return Math.max(1, 5 - new Set(expected).size);
  if (operator === 'contains' || operator === 'member' || operator === 'not_member') return 2;
  if (operator === 'gte' || operator === 'lte') {
    if (operator === 'gte' && expected === 0) return 0;
    if (expectedField) return 1;
    if (operator === 'lte' && expected >= 0 && /(?:orb|deviation)$/iu.test(field)) return 2 + Math.round(9 / (1 + expected)) / 16;
    return 2;
  }
  return 1;
}

const predicateKey = ({ field, operator, expected, expectedField }) => JSON.stringify([field, operator,
  Array.isArray(expected) ? [...new Set(expected)].sort() : expected, expectedField]);
const exclusionKey = (group) => group.map(predicateKey).sort();
const substantiveExclusion = (group) => group.length && group.every(({ required }) => required)
  && group.some(({ field }) => field !== 'direction');

export function conditionStrength(entry) {
  const fields = new Map();
  const factIds = new Set();
  for (const proof of entry.proofs) {
    factIds.add(proof.factId);
    for (const condition of proof.conditions) {
      const key = JSON.stringify([proof.factId, condition.field]);
      fields.set(key, Math.max(fields.get(key) ?? 0, conditionWeight(condition)));
    }
    for (const group of proof.exclusions.filter(substantiveExclusion)) {
      fields.set(JSON.stringify([proof.factId, exclusionKey(group)]), 1);
    }
  }
  return 2 * Math.max(0, factIds.size - 1) + Number(Boolean(entry.consistentMeasurements))
    + [...fields.values()].reduce((sum, value) => sum + value, 0);
}

function measureProgram(input) {
  const proofs = input.required.map((requirement, index) => ({ ...requirement,
    factId: input.allowSharedFact ? requirement.type : String(index) }));
  const raw = conditionStrength({ proofs, consistentMeasurements: input.bindings.length > 0 });
  const signature = JSON.stringify([raw, input.bindings.length, proofs.map(({ type, conditions, exclusions }) => [type,
    [...new Set(conditions.filter(conditionWeight).map(predicateKey))].sort(),
    exclusions.filter(substantiveExclusion).map((group) => JSON.stringify(exclusionKey(group))).sort()])]);
  return { raw, signature };
}

export function createEntryScoring({ entries, programs }) {
  const rawByProgram = new Map();
  const byEntry = new Map();
  for (const { entryId, conditionIndex, program } of programs) {
    const { raw, signature } = measureProgram(program);
    rawByProgram.set(signature, raw);
    const values = byEntry.get(entryId) ?? [];
    values[conditionIndex] = raw;
    byEntry.set(entryId, values);
  }
  const conditionScale = percentileScale(rawByProgram.values());
  const texts = entries
    .filter(({ id, modernInterpretation }) => byEntry.has(id) && modernInterpretation !== null)
    .map(({ modernInterpretation }) => modernInterpretation);
  const content = createContentScorer(texts);
  const scores = new Map();
  for (const { id, category: { method, topic, contentType }, matchConditions, source, modernInterpretation: text } of entries) {
    const credibility = sourceCredibility([{ title: source.book }]);
    const score = text === null ? { score: 0, features: [] } : content.evaluate(text);
    const conditionByAlternative = (byEntry.get(id) ?? []).map(conditionScale);
    scores.set(id, { id, method, topic, contentType, status: matchConditions.formatted.status,
      text, source: credibility, contentFeatures: score.features,
      scores: { condition: conditionByAlternative.length ? Math.min(...conditionByAlternative) : 0,
        content: score.score, source: credibility.score },
      conditionByAlternative,
      conditionMax: conditionByAlternative.length ? Math.max(...conditionByAlternative) : 0,
      conditionScored: conditionByAlternative.length > 0 });
  }
  return {
    forMatch(id, conditionIndex) {
      const { scores: axes, conditionByAlternative } = scores.get(id);
      return { ...axes, condition: conditionByAlternative[conditionIndex] };
    },
    audit() {
      const rows = [...scores.values()];
      return { entries: rows, calibration: { uniqueConditionPrograms: rawByProgram.size,
        distinctContents: content.sampleSize }, distribution: Object.fromEntries(['condition', 'content', 'source'].map((axis) =>
        [axis, describeScores(rows.map(({ scores }) => scores[axis]))])) };
    },
  };
}
