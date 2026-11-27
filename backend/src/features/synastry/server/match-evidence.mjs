import { algorithmDefinitions, algorithmDirections, comparisonDirections, enrichmentVersion } from '../model/algorithm-profiles.ts';
import { comparisonRulesVersion } from '../model/comparison.ts';
import { factTypeId, identifyInterpretationFact, registeredFactFields } from '../model/interpretation-facts.ts';
import { isSummaryFactText, isSummaryFactValue, summarySystems } from '../model/summary.ts';
import { createClaimContext, evaluateFactProgram } from '../control/claim-matching.ts';
import { remainingMethodRequirements } from '../control/method-runtime.ts';
import { methodLibrary, methodRefsForFact } from '../control/method-knowledge.ts';
import { isConsistentMatchingFact } from './matching/fact-integrity.mjs';

const requestFields = new Set(['rulesVersion', 'facts']);
const factFields = new Set(['system', 'rule', 'direction', 'observation', 'sources', 'facts', 'chartRulesets']);
const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
const compatibleShape = (value, fields) => record(value) && Object.keys(value).every((key) => fields.has(key));

export function parseSummaryFacts(input) {
  if (!compatibleShape(input, requestFields) || input.rulesVersion !== comparisonRulesVersion
    || !Array.isArray(input.facts)) return null;
  const chartFacts = [];
  const identities = new Map();
  const versionsBySystem = new Map();
  for (const item of input.facts) {
    if (!compatibleShape(item, factFields)) return null;
    const { system, rule, direction, observation, sources, facts, chartRulesets } = item;
    if (!summarySystems.includes(system) || typeof rule !== 'string' || !comparisonDirections.includes(direction)
      || !record(facts) || !isSummaryFactText(observation)
      || !Array.isArray(sources) || sources.length !== 2 || !sources.every(isSummaryFactText)
      || !Array.isArray(chartRulesets) || chartRulesets.length !== 2
      || !chartRulesets.every((version) => isSummaryFactText(version) && version.trim())) return null;
    const fields = registeredFactFields(system, rule);
    if (!fields || !Object.entries(facts).every(([key, value]) =>
      fields.includes(key) && isSummaryFactValue(value))) return null;
    const definition = algorithmDefinitions.find((entry) => entry.system === system && entry.rule === rule);
    if (definition && !algorithmDirections(definition).includes(direction)) return null;
    const versions = versionsBySystem.get(system);
    if (versions && (versions[0] !== chartRulesets[0] || versions[1] !== chartRulesets[1])) return null;
    versionsBySystem.set(system, chartRulesets);

    const { id, identity } = identifyInterpretationFact(factTypeId(system, rule), direction, sources, facts);
    if (identities.has(id)) {
      if (identities.get(id) !== identity) return null;
      continue;
    }
    identities.set(id, identity);
    chartFacts.push({ id, system, rule, direction, observation, sources, facts, chartRulesets,
      scope: definition?.scope ?? 'cross', layer: rule.includes('composite') ? 'composite' : 'natal',
      ruleVersion: definition ? enrichmentVersion : comparisonRulesVersion,
      methodRefs: methodRefsForFact(system, rule),
      ...(definition ? { calculationProfileId: enrichmentVersion + ':' + rule, limitations: [definition.limitation] } : {}) });
  }
  return chartFacts;
}

export function collectEntryEvidence(input, knowledge) {
  const chartFacts = parseSummaryFacts(input);
  if (!chartFacts) return null;
  const context = createClaimContext(chartFacts.filter(isConsistentMatchingFact)
    .map((fact) => ({ ...fact, factId: fact.id, parameters: fact.facts })));
  const hits = [];
  const loaded = new Map();
  for (const { entryId, conditionIndex, program } of knowledge.candidatePrograms(context.keys)) {
    const witnesses = evaluateFactProgram(program, context);
    if (!witnesses) continue;
    if (!loaded.has(entryId)) loaded.set(entryId, knowledge.getClaim(entryId));
    const sourceEntry = loaded.get(entryId);
    const entry = {
      id: entryId, conditionIndex, source: sourceEntry.source,
      topic: sourceEntry.category.topic, contentType: sourceEntry.category.contentType,
      scores: knowledge.scoring.forMatch(entryId, conditionIndex),
      interpretation: sourceEntry.modernInterpretation,
      originalText: sourceEntry.originalText,
      originalConditions: sourceEntry.matchConditions.original,
      proofs: witnesses.map(({ factId, system, direction, observation, sources }, index) => ({
        factId, system, direction, observation, sources,
        conditions: program.required[index].conditions, exclusions: program.required[index].exclusions,
      })),
      consistentMeasurements: program.bindings.length > 0,
    };
    hits.push(entry);
  }
  return { hits, chartFacts, methods: summaryFactMethods(chartFacts) };
}

function summaryFactMethods(chartFacts) {
  const usedMethods = new Set(chartFacts.flatMap(({ methodRefs }) => methodRefs));
  const methods = methodLibrary.methodLibrary.methods.filter(({ methodId }) => usedMethods.has(methodId))
    .map((method) => ({
      methodId: method.methodId, name: method.name, procedure: method.procedure, expectedOutputs: method.expectedOutputs,
      limitations: method.limitations, remainingRequirements: remainingMethodRequirements(method), sourceRefs: method.sourceRefs,
      locator: method.locator,
      computedRules: [...new Set(chartFacts.filter(({ methodRefs }) => methodRefs.includes(method.methodId)).map(({ system, rule }) => system + ':' + rule))],
    }));
  return methods;
}
