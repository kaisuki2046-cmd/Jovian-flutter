import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chartVersions } from './catalog.mjs';
import { chartScopes, normalizeRuleInput } from './matching.mjs';
import { cleanModernInterpretation } from './report-evidence.mjs';
import { reportTopics } from './topics.mjs';

export const reportKnowledgeFiles = ['report-knowledge.json', 'report-knowledge-ids.json', 'report-knowledge.schema.json'];
const ruleKinds = new Set(['chart', 'historicalCase', 'historicalReference']);
const activeKinds = new Set([...ruleKinds, 'tiebanSelector']);
const inactiveKinds = new Set(['calculationReference', 'unmapped', 'skipped']);
const topics = new Set(Object.values(reportTopics));
const text = value => typeof value === 'string' && value.trim().length > 0;
const sourceIdOf = key => key.split('#', 1)[0];

export function readReportKnowledge(directory) {
  const read = file => JSON.parse(readFileSync(join(directory, file), 'utf8').replace(/^\uFEFF/u, ''));
  const [entriesFile, idsFile] = reportKnowledgeFiles;
  const entries = read(entriesFile);
  const mapping = read(idsFile);
  if (!Array.isArray(entries) || !entries.length || !mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    throw new Error('Invalid unified report knowledge or ID map.');
  }
  const keys = new Map();
  for (const [key, id] of Object.entries(mapping)) {
    if (!text(sourceIdOf(key)) || !Number.isSafeInteger(id) || id < 1 || keys.has(id)) {
      throw new Error('Invalid or duplicate unified knowledge ID: ' + id);
    }
    keys.set(id, key);
  }
  const bySource = new Map();
  for (const entry of entries) {
    const { id, source, category, originalText, modernInterpretation, matchConditions: match } = entry;
    const key = keys.get(id);
    const kind = match?.formatted?.kind;
    if (!key || !source || !text(source.book) || !text(source.locator) || !(source.url === null || text(source.url))
      || !category || !Object.hasOwn(chartVersions, category.method) || !topics.has(category.topic)
      || !['personality', 'fact'].includes(category.contentType)
      || !(originalText === null || text(originalText)) || !(modernInterpretation === null || text(modernInterpretation))
      || !(match?.status === true && activeKinds.has(kind) || match?.status === false && inactiveKinds.has(kind))
      || !Array.isArray(match.original) || !match.original.every(text) || !Array.isArray(match.formatted.alternatives)
      || ruleKinds.has(kind) !== Boolean(match.formatted.alternatives.length)) {
      throw new Error('Invalid unified knowledge record: ' + id);
    }
    keys.delete(id);
    const sourceId = sourceIdOf(key);
    if (!bySource.has(sourceId)) bySource.set(sourceId, []);
    bySource.get(sourceId).push({ ...entry, key });
  }
  if (keys.size) throw new Error('Unified ID map refers to an absent record: ' + keys.keys().next().value);
  return bySource;
}

export function reportKnowledgeEvidence(entry, source = {}, modernInterpretation = entry.modernInterpretation) {
  return {
    knowledgeId: entry.id, source: { ...source, ...entry.source },
    originalText: entry.originalText, modernInterpretation,
  };
}

export function reportKnowledgeAlternatives(entry) {
  const { category: { method }, matchConditions: { formatted } } = entry;
  if (!chartScopes.includes(formatted.chartScope) || formatted.rulesetVersion !== chartVersions[method].rulesetVersion
    || !text(formatted.tradition)) {
    throw new Error('Unsupported chart profile for unified knowledge record: ' + entry.id);
  }
  return formatted.alternatives.map(({ input, compiler, decadalAnchor }) => ({
    input: normalizeRuleInput(method, { ...input, required: [...(formatted.commonRequired ?? []), ...(input.required ?? [])] }),
    ...(compiler && { compiler }), ...(decadalAnchor && { decadalAnchor }),
  }));
}

function claimCategory({ category }) {
  return { topic: category.topic, type: category.contentType === 'personality' ? '性格' : '事件' };
}

function newClaim(sourceId, entry) {
  const { source, matchConditions, originalText, modernInterpretation } = entry;
  return {
    id: sourceId, title: originalText ?? modernInterpretation ?? source.locator,
    source: { ...source, section: source.locator },
    category: { ...claimCategory(entry), tags: [] },
    evidence: { original_text: originalText ?? '', context: null },
    interpretation: { classical_meaning: modernInterpretation ?? '', limitations: [] },
    conditions: { original: matchConditions.original, normalized: [], uncertain: [], excluded: [] },
  };
}

const groupKey = (compiler, anchor) => JSON.stringify([compiler ?? null, anchor ?? null]);
const inputKey = input => JSON.stringify(input);
const normalizedPassage = value => value?.normalize('NFC').replace(/[\s。！？；，、.!?;]+$/u, '');

function orderInputs(inputs, previous = []) {
  if (previous.length < 2) return inputs;
  const positions = new Map();
  for (const [index, input] of previous.entries()) {
    const key = inputKey(input);
    if (!positions.has(key)) positions.set(key, []);
    positions.get(key).push(index);
  }
  return inputs.map(input => ({ input, position: positions.get(inputKey(input))?.shift() ?? Infinity }))
    .sort((a, b) => a.position - b.position).map(({ input }) => input);
}

function compileBranch(entry, template, compiler, decadalAnchor, inputs, prior) {
  const old = prior?.branch;
  const usable = entry.originalText !== null || entry.modernInterpretation !== null;
  // The source may include a conclusion outside an already reviewed sub-passage.
  // Keep that review only when its complete rule group is still present.
  const reviewed = usable && old && (old.interpretationOrigin === 'reviewed' || decadalAnchor);
  const modern = reviewed
    ? old.modernInterpretation?.replace(/。相关盘面包括.*$/su, '。') ?? null : entry.modernInterpretation;
  const promptEvidence = reportKnowledgeEvidence(entry, template.claim.source, modern);
  if (reviewed && entry.originalText !== null && normalizedPassage(old.text) !== normalizedPassage(entry.originalText)) {
    promptEvidence.originalText = old.text;
  }
  const text = old?.text ?? entry.originalText ?? (entry.matchConditions.original.join('。') || entry.source.locator);
  const fromEntry = normalizedPassage(text) === normalizedPassage(entry.originalText)
    ? cleanModernInterpretation(text, entry.modernInterpretation) : null;
  const modernInterpretation = old?.modernInterpretation ?? fromEntry;
  const { sourceChartScope } = entry.matchConditions.formatted;
  return {
    ordinal: prior?.index ?? Infinity,
    branch: {
      text,
      modernInterpretation,
      interpretationOrigin: modernInterpretation ? (old?.modernInterpretation ? old.interpretationOrigin : 'source') : 'untranslated',
      inputs: orderInputs(inputs, old?.inputs),
      ...(compiler && { conditionCompiler: compiler }), ...(decadalAnchor && { decadalAnchor }),
      ...(sourceChartScope && { sourceChartScope }), promptEvidence,
    },
  };
}

function compileBranches(entries, template) {
  const previous = template.branches;
  const oldGroups = previous.map((branch, index) => ({
    branch, index, key: groupKey(branch.conditionCompiler, branch.decadalAnchor),
    inputs: new Set(branch.inputs.map(inputKey)),
  }));
  const groups = entries.flatMap(entry => {
    const { formatted } = entry.matchConditions;
    const alternatives = new Map();
    for (const { input, compiler = formatted.compiler, decadalAnchor } of reportKnowledgeAlternatives(entry)) {
      const key = groupKey(compiler, decadalAnchor);
      if (!alternatives.has(key)) alternatives.set(key, { compiler, decadalAnchor, inputs: [] });
      alternatives.get(key).inputs.push(input);
    }
    return [...alternatives].flatMap(([key, { compiler, decadalAnchor, inputs }]) => {
      const remaining = new Map(inputs.map(input => [inputKey(input), input]));
      const covered = oldGroups.filter(group => group.key === key && [...group.inputs].every(value => remaining.has(value)));
      const sameGroup = covered.filter(group => group.inputs.size === remaining.size);
      const exactPassage = sameGroup.find(({ branch }) =>
        normalizedPassage(branch.text) === normalizedPassage(entry.originalText));
      const prior = exactPassage ?? (sameGroup.length === 1 ? sameGroup[0] : undefined);
      if (prior || sameGroup.length > 1) return [compileBranch(entry, template, compiler, decadalAnchor, inputs, prior)];
      const parts = [];
      for (const group of covered) {
        const part = [...group.inputs].map(value => remaining.get(value));
        if (part.some(value => !value)) continue;
        parts.push(compileBranch(entry, template, compiler, decadalAnchor, part, group));
        for (const value of group.inputs) remaining.delete(value);
      }
      if (remaining.size) parts.push(compileBranch(entry, template, compiler, decadalAnchor, [...remaining.values()]));
      return parts;
    });
  });
  return groups.sort((a, b) => a.ordinal - b.ordinal).map(({ branch }) => branch);
}

export function reportTiebanClaim(claim, formatted) {
  const { selector, chartScope, recordType, uncertain = [], excluded = [], natalInputs = [], triggerInputs = [] } = formatted;
  return { ...claim, source: { ...claim.source, material_type: 'supplied_tieban_clause' },
    conditions: { ...claim.conditions, uncertain, excluded, match: {
      ...claim.conditions.match, system: 'tieban', selector, chartScope, recordType, natalInputs, triggerInputs,
    } } };
}

function compileSource(template, entries) {
  const { claim } = template;
  const rules = entries.filter(({ matchConditions: { formatted } }) => ruleKinds.has(formatted.kind));
  const tieban = entries.find(({ matchConditions: { formatted } }) => formatted.kind === 'tiebanSelector');
  if (tieban) {
    const { formatted } = tieban.matchConditions;
    const { selector, chartScope, recordType, uncertain, excluded, natalInputs, triggerInputs } = formatted;
    return { ...template, tiebanMatch: { selector, chartScope, recordType, uncertain, excluded, natalInputs, triggerInputs },
      promptEvidence: { ...reportKnowledgeEvidence(tieban, claim.source), topic: tieban.category.topic } };
  }
  if (!rules.length) return { ...template, inputs: undefined, branches: [] };
  const [entry] = rules;
  const { formatted } = entry.matchConditions;
  if (entry.category.method !== template.method || rules.some(rule => rule.category.method !== template.method)) {
    throw new Error('Method mismatch for unified knowledge source: ' + claim.id);
  }
  if (rules.some(rule => rule.matchConditions.formatted.chartScope !== 'natal')) {
    throw new Error('Unsupported non-natal Claim matcher: ' + claim.id);
  }
  const category = claimCategory(entry);
  const priorCategory = template.category ?? claim.category;
  const categoryChanged = category.type !== priorCategory.type || category.topic !== priorCategory.topic;
  const common = { ...template, ...(categoryChanged && { category }), compiler: formatted.compiler,
    matchScope: formatted.matchScope ?? template.matchScope,
    reportTradition: formatted.tradition };
  if (rules.length === 1 && !template.branches.length
    && !formatted.alternatives.some(rule => rule.decadalAnchor || rule.compiler)) {
    return { ...common, branches: [],
      inputs: orderInputs(reportKnowledgeAlternatives(entry).map(({ input }) => input), template.inputs),
      promptEvidence: reportKnowledgeEvidence(entry, claim.source) };
  }
  return { ...common, compiler: undefined, inputs: undefined, branches: compileBranches(rules, template) };
}

export function compileReportKnowledge(templates, knowledge, legacySourceIds) {
  const existing = new Set(templates.map(({ claim }) => claim.id));
  const imported = templates.map(template => compileSource(template, knowledge.get(template.claim.id) ?? []));
  for (const [sourceId, entries] of knowledge) {
    if (existing.has(sourceId) || legacySourceIds.has(sourceId)) continue;
    const [entry] = entries;
    imported.push(compileSource({ method: entry.category.method, claim: newClaim(sourceId, entry), branches: [] }, entries));
  }
  return imported;
}
