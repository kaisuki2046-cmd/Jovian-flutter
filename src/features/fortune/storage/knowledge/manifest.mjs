import { createHash } from 'node:crypto';

export const knowledgeMethods = ['bazi', 'ziwei', 'western'];
export const knowledgeManifestFile = 'fortune_knowledge.json';

const topicLabels = { overall: '综合', wealth: '财富', romance: '爱情' };
export const knowledgePeriods = ['year', 'month', 'week', 'day', 'hour'];
const hourBases = ['shichen', 'clockHour'];
const scopes = ['natal', 'decadal', 'minor', 'yearly', 'monthly', 'daily', 'hourly', 'transit', 'progressed', 'almanac'];
const pillars = new Set(Array.from({ length: 60 }, (_, index) =>
  '甲乙丙丁戊己庚辛壬癸'[index % 10] + '子丑寅卯辰巳午未申酉戌亥'[index % 12]));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmptyText = value => typeof value === 'string' && value.trim().length > 0;
const nullableText = value => value === null || typeof value === 'string';
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string');
const stringOrNumber = value => typeof value === 'string' || Number.isFinite(value);
const validPillarSequence = value => typeof value === 'string' && value.length === 8
  && [0, 2, 4, 6].every(offset => pillars.has(value.slice(offset, offset + 2)));

export const digest = value => createHash('sha256').update(value).digest('hex');
export const runtimeId = entry => entry.legacyId ?? 'fortune-entry-' + entry.id;
export const runtimeTopic = (topic, legacyTopic) => legacyTopic ?? topicLabels[topic];

// Keep historical identifiers and source metadata available to reports and archived runs.
export function toRuntimeKnowledgeEntry(entry) {
  const { legacy, source, category, originalText, matchConditions, modernInterpretation, advice } = entry;
  const id = runtimeId(entry);
  return {
    id,
    title: legacy?.title ?? source.locator,
    category: { kind: category.contentType, topic: runtimeTopic(category.topic, legacy?.topic), tags: legacy?.tags ?? [] },
    source: {
      book: source.book,
      author: legacy?.source?.author ?? null,
      edition: legacy?.source?.edition ?? '',
      volume: legacy?.source?.volume ?? null,
      chapter: legacy?.source?.chapter ?? '',
      section: legacy?.source?.section ?? null,
      url: source.url ?? '',
      passage_id: legacy?.source?.passage_id ?? source.locator,
    },
    evidence: { original_text: originalText ?? '', context: legacy?.context ?? '' },
    conditions: {
      original: matchConditions.original,
      normalized: legacy?.normalized ?? matchConditions.original,
      uncertain: legacy?.uncertain ?? [],
      excluded: legacy?.excluded ?? [],
    },
    interpretation: {
      classical_meaning: modernInterpretation ?? '',
      limitations: legacy?.limitations ?? [],
      ...(advice ? { advice: { kind: advice.kind, options: advice.options, basis: advice.basis } } : {}),
    },
    reportTopic: category.topic,
  };
}

function validFilter(fields) {
  return isObject(fields) && Object.values(fields).every(value => {
    if (stringOrNumber(value) || typeof value === 'boolean') return true;
    if (!isObject(value)) return false;
    const operators = Object.keys(value);
    if (operators.length !== 1) return false;
    const [operator] = operators;
    const argument = value[operator];
    if (operator === 'includes') return stringOrNumber(argument);
    if (operator === 'gte') return Number.isFinite(argument);
    return ['includesAll', 'includesAny', 'oneOf'].includes(operator) && Array.isArray(argument)
      && argument.length > 0 && argument.every(stringOrNumber);
  });
}

function validQuery(query) {
  return isObject(query) && nonEmptyText(query.factType) && validFilter(query.where)
    && (query.minimumDurationHours === undefined
      || Number.isFinite(query.minimumDurationHours) && query.minimumDurationHours > 0)
    && (query.scope === undefined || scopes.includes(query.scope))
    && (query.scopes === undefined || Array.isArray(query.scopes) && query.scopes.length > 0
      && query.scopes.every(scope => scopes.includes(scope)))
    && (query.anyOf === undefined || Array.isArray(query.anyOf) && query.anyOf.length > 0 && query.anyOf.every(validFilter));
}

export function reviewedFortuneRuleHash(entry) {
  const { review: _review, ...conditions } = entry.matchConditions.formatted;
  return digest(JSON.stringify({ category: entry.category, conditions }));
}

function validateSourceReview(entry, review) {
  const { id, source, evidence, conditions } = toRuntimeKnowledgeEntry(entry);
  if (!isObject(review) || review.sourcePassageId !== source.passage_id
    || review.sourceHash !== digest(JSON.stringify({ evidence, conditions }))
    || !strings(review.mappedConditions) || !review.mappedConditions.length) {
    throw new Error('Fortune rule source review is stale: ' + id);
  }
  if (review.ruleHash !== undefined && review.ruleHash !== reviewedFortuneRuleHash(entry)) {
    throw new Error('Fortune reviewed rule conditions changed: ' + id);
  }
  const { printedLuck, additionalSourceExcerpts } = review;
  if (additionalSourceExcerpts !== undefined && (!nonEmptyText(entry.source.url) || !Array.isArray(additionalSourceExcerpts)
    || !additionalSourceExcerpts.length || !additionalSourceExcerpts.every(nonEmptyText))) {
    throw new Error('Invalid fortune knowledge additional source excerpts: ' + id);
  }
  if (printedLuck !== undefined && (!Array.isArray(printedLuck) || !printedLuck.length
    || printedLuck.some(row => !isObject(row) || !nonEmptyText(row.name) || !nonEmptyText(row.premise)
      || !validPillarSequence(row.natalPillarSequence) || !Array.isArray(row.periods) || !row.periods.length
      || row.periods.some(period => !isObject(period) || !nonEmptyText(period.assessment)
        || !Array.isArray(period.pillars) || !period.pillars.length
        || period.pillars.some(value => !pillars.has(value)))))) {
    throw new Error('Invalid printed luck review: ' + id);
  }
}

function validateEntry(entry) {
  const { id, legacyId, legacy, source, category, originalText, matchConditions, modernInterpretation, advice } = entry ?? {};
  if (!Number.isSafeInteger(id) || id < 1 || (legacyId !== undefined && !nonEmptyText(legacyId))
    || !isObject(source) || !nonEmptyText(source.book) || !nonEmptyText(source.locator) || !nullableText(source.url)
    || !isObject(category) || !knowledgeMethods.includes(category.method) || !Object.hasOwn(topicLabels, category.topic)
    || !['解读', '建议'].includes(category.contentType)
    || !(knowledgePeriods.includes(category.period) || category.contentType === '建议' && category.period === null)
    || (category.period === 'hour' ? !hourBases.includes(category.hourBasis) : category.hourBasis !== undefined)
    || !nullableText(originalText) || !nullableText(modernInterpretation) || !isObject(matchConditions)
    || !strings(matchConditions.original)) {
    throw new Error('Invalid fortune knowledge entry: ' + id);
  }
  if (legacy !== undefined && (!isObject(legacy)
    || ['title', 'topic', 'context'].some(key => legacy[key] !== undefined && typeof legacy[key] !== 'string')
    || ['tags', 'normalized', 'uncertain', 'excluded', 'limitations']
      .some(key => legacy[key] !== undefined && !strings(legacy[key]))
    || legacy.source !== undefined && (!isObject(legacy.source) || !Object.values(legacy.source).every(nullableText)))) {
    throw new Error('Invalid fortune knowledge legacy metadata: ' + id);
  }
  if (category.contentType === '建议' ? !isObject(advice) || !['数字', '饰品', '颜色'].includes(advice.kind)
    || !Array.isArray(advice.options) || !advice.options.length || !advice.options.every(nonEmptyText)
    || typeof advice.basis !== 'string' : advice !== undefined) {
    throw new Error('Invalid fortune knowledge advice: ' + id);
  }
  const { status, formatted } = matchConditions;
  if (!isObject(formatted) || !Array.isArray(formatted.queries) || !Array.isArray(formatted.unless)
    || !strings(formatted.unresolved)) throw new Error('Invalid fortune knowledge rule: ' + id);
  if (!['mapped', 'unmapped'].includes(status)
    || (status === 'mapped' && (category.contentType !== '解读' || !formatted.queries.length))) {
    throw new Error('Invalid fortune knowledge rule status: ' + id);
  }
  if (status === 'mapped' && (!nonEmptyText(originalText) || !matchConditions.original.some(nonEmptyText))) {
    throw new Error('Fortune mapped rule requires original text and conditions: ' + id);
  }
  if (![...formatted.queries, ...formatted.unless].every(validQuery)) {
    throw new Error('Invalid fortune knowledge query: ' + id);
  }
  if (formatted.sourceConditions !== undefined && (status !== 'mapped' || formatted.unresolved.length
    || !Array.isArray(formatted.sourceConditions) || !formatted.sourceConditions.length
    || !formatted.sourceConditions.every(nonEmptyText))) {
    throw new Error('Invalid fortune knowledge source conditions: ' + id);
  }
  if (formatted.review !== undefined) validateSourceReview(entry, formatted.review);
  if (formatted.confirmedWhen !== undefined) {
    const branches = Array.isArray(formatted.confirmedWhen) ? formatted.confirmedWhen : [formatted.confirmedWhen];
    if (category.contentType !== '解读' || !branches.length
      || !branches.every(branch => validQuery(branch) && Array.isArray(branch.sourceConditions)
        && branch.sourceConditions.length > 0 && branch.sourceConditions.every(nonEmptyText))) {
      throw new Error('Invalid fortune knowledge confirmation: ' + id);
    }
    if (branches.some(branch => branch.sourceExcerpt !== undefined) && !branches.every(branch =>
      nonEmptyText(branch.sourceExcerpt) && (entry.originalText?.includes(branch.sourceExcerpt)
        || formatted.review?.additionalSourceExcerpts?.includes(branch.sourceExcerpt)))) {
      throw new Error('Invalid fortune knowledge confirmation excerpt: ' + id);
    }
  }
}

export function parseFortuneKnowledgeManifest(bytes) {
  const manifest = JSON.parse(bytes);
  const invalid = () => new Error('Invalid fortune knowledge source: ' + knowledgeManifestFile);
  if (!isObject(manifest) || !Array.isArray(manifest.adviceGroups)) throw invalid();
  let entries;
  if (manifest.schemaVersion === 1 && Object.keys(manifest).length === 3 && Array.isArray(manifest.entries)) {
    entries = manifest.entries;
  } else {
    const collections = [...knowledgePeriods, 'advice'];
    if (manifest.schemaVersion !== 2 || Object.keys(manifest).length !== collections.length + 2
      || !collections.every(key => Array.isArray(manifest[key]))) throw invalid();
    entries = collections.flatMap(key => manifest[key].map(entry => {
      const category = entry?.category;
      const correctCollection = key === 'advice' ? category?.contentType === '建议'
        : category?.contentType === '解读' && category.period === key;
      if (!correctCollection) throw new Error('Invalid fortune knowledge collection: ' + key + ' / ' + entry?.id);
      return entry;
    })).sort((first, second) => first.id - second.id);
  }
  if (!entries.length) throw invalid();
  const ids = new Set();
  const runtimeIds = new Set();
  for (const entry of entries) {
    validateEntry(entry);
    const compatibleId = runtimeId(entry);
    if (ids.has(entry.id) || runtimeIds.has(compatibleId)) throw new Error('Invalid fortune knowledge entry: duplicate ID ' + entry.id);
    ids.add(entry.id);
    runtimeIds.add(compatibleId);
  }
  return { schemaVersion: manifest.schemaVersion, entries, adviceGroups: manifest.adviceGroups };
}

export function interpretationRule(entry) {
  const { status, formatted: { queries, unless, unresolved, review, confirmedWhen, sourceConditions } } = entry.matchConditions;
  const mapped = status === 'mapped';
  return {
    mapped,
    payload: {
      knowledgeId: runtimeId(entry),
      period: entry.category.period,
      ...(entry.category.hourBasis ? { hourBasis: entry.category.hourBasis } : {}),
      queries: mapped ? queries : [],
      ...(mapped && unless.length ? { unless } : {}),
      ...(mapped && confirmedWhen ? { confirmedWhen } : {}),
      ...(sourceConditions ? { sourceConditions } : {}),
      unresolved: mapped || unresolved.length ? unresolved : ['机器匹配规则尚未接入。',
        ...(entry.legacy ? [...(entry.legacy.normalized ?? []), ...(entry.legacy.uncertain ?? [])] : entry.matchConditions.original)],
      ...(review ? { review } : {}),
    },
  };
}
