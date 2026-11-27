import type { Review, Rulebook } from '../model/interpretation';
import { builtinFortuneRulebook } from './interpretation-rules';

const validStatus = ['draft', 'in_review', 'approved', 'deprecated'];
const validUse = ['internal_research', 'rule_derivation', 'commercial_distribution'];
const validLicense = ['public_domain_verified', 'licensed', 'open_license', 'unknown', 'permission_required'];
const licensed = new Set(validLicense.slice(0, 3));
const validMethod = ['bazi', 'ziwei', 'western'];
const validPeriods = ['day', 'week', 'month', 'year'];
const directions = ['neutral', 'supportive', 'challenging', 'mixed'];
export const unsafeLanguage = /必定|必婚|必升|一定会(?:发财|结婚|生病|升职|死亡)|稳赚|保证收益|保你|祛病|确诊|替代治疗|停药|必须购买|保证改运|血光之灾|(?:买入|卖出)(?:某|该|一只)?(?:股票|基金|证券)/u;

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const list = (value: unknown, test: (item: unknown) => boolean): boolean => Array.isArray(value) && value.every(test);
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid rulebook object');
  return value as Record<string, unknown>;
}
const path = (field: unknown) => typeof field === 'string'
  && /^(?:normalizedPayload(?:\.[a-zA-Z][a-zA-Z\d]*)+|subjectIds|scope)$/u.test(field);
const scalar = (value: unknown) => typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value);

function predicate(value: unknown) {
  const entry = object(value);
  const op = Object.keys(entry).find(key => key !== 'field');
  if (Object.keys(entry).length !== 2 || !path(entry.field)) return false;
  if (op === 'eq' || op === 'includes') return scalar(entry[op]);
  if (op === 'oneOf') return list(entry[op], scalar) && (entry[op] as unknown[]).length > 0;
  return op === 'lte' && Number.isFinite(entry[op]);
}

function condition(value: unknown) {
  const entry = object(value);
  if (!text(entry.id) || !list(entry.where, predicate) || (!text(entry.factType) && entry.factType !== undefined)
    || (!text(entry.sharedSubject) && entry.sharedSubject !== undefined)
    || (entry.sameScope !== undefined && typeof entry.sameScope !== 'boolean')) return false;
  if (!entry.link) return true;
  const link = object(entry.link);
  return path(link.field) && path(link.from) && (link.operator === 'eq' || link.operator === 'includes');
}

export type RuleMode = 'production' | 'preview';

export function canUse(review: Review, book: Rulebook, mode: RuleMode) {
  if (book === builtinFortuneRulebook) return review.reviewStatus !== 'deprecated';
  const approved = review.reviewStatus === 'approved';
  if (!approved && (mode !== 'preview' || review.reviewStatus === 'deprecated')) return false;
  if (approved && (!review.reviewer?.trim() || !review.reviewedAt || !Number.isFinite(Date.parse(review.reviewedAt)))) return false;
  return review.sourceIds.length > 0 && review.sourceIds.every(id => book.sources.some(source =>
    source.sourceId === id && (approved
      ? licensed.has(source.licenseStatus) && source.allowedUse !== 'internal_research'
      : source.licenseStatus !== 'permission_required')));
}

export function validCatalog(item: Rulebook['catalog'][number]) {
  if (!item.safetyTags.length || unsafeLanguage.test([item.title, item.usage, item.symbolism, item.frame, item.material,
    ...Object.values(item.periodUsage ?? {})].join(' '))) return false;
  if (item.category === 'accessory') return text(item.material) && text(item.symbolism);
  if (item.category === 'color') return text(item.symbolism);
  if (item.category === 'direction') return text(item.frame);
  return true;
}

export function readRulebook(value: unknown, topicIds: string[]): Rulebook {
  const book = object(value);
  const unique = (entries: unknown, key: string, test: (item: Record<string, unknown>) => boolean) => {
    const ids = new Set<string>();
    return list(entries, value => {
      const item = object(value);
      const id = item[key];
      if (!text(id) || ids.has(id) || !test(item)) return false;
      ids.add(id);
      return true;
    });
  };
  if (!['version', 'mappingVersion', 'actionVersion', 'catalogVersion'].every(key => text(book[key]))
    || !unique(book.sources, 'sourceId', item => text(item.title) && text(item.locator)
      && ['research_note', 'expert_review', 'classical_text', 'official_documentation'].includes(String(item.type))
      && validUse.includes(String(item.allowedUse)) && validLicense.includes(String(item.licenseStatus)))) {
    throw new Error('Invalid interpretation sources');
  }
  const sourceIds = new Set((book.sources as Rulebook['sources']).map(item => item.sourceId));
  const review = (entry: Record<string, unknown>) => validStatus.includes(String(entry.reviewStatus))
    && list(entry.sourceIds, id => text(id) && sourceIds.has(id)) && (entry.sourceIds as unknown[]).length > 0
    && (entry.reviewStatus !== 'approved' || (text(entry.reviewer) && text(entry.reviewedAt)
      && Number.isFinite(Date.parse(entry.reviewedAt))));
  const period = (item: unknown) => validPeriods.includes(String(item));
  const topic = (item: unknown) => topicIds.includes(String(item)) && item !== 'overall';
  if (!unique(book.rules, 'ruleId', item => {
    const meaning = object(item.meaning);
    return review(item) && text(item.version) && text(item.tradition) && validMethod.includes(String(item.method))
      && list(item.factTypes, text) && (item.factTypes as unknown[]).length > 0 && list(item.periods, period)
      && (item.scopes === undefined || list(item.scopes, scope => ['natal', 'decadal', 'minor', 'yearly', 'monthly', 'daily', 'transit', 'progressed'].includes(String(scope))))
      && Number.isFinite(item.priority) && typeof item.allowPartial === 'boolean'
      && list(item.trigger, predicate) && ['required', 'supporting', 'inhibiting', 'exclusions'].every(key => list(item[key], condition))
      && text(meaning.key) && text(meaning.summary) && !unsafeLanguage.test(meaning.summary)
      && directions.includes(String(meaning.direction)) && list(item.limitations, text);
  })) throw new Error('Invalid atomic interpretation rule');
  const keys = new Set((book.rules as Rulebook['rules']).map(rule => rule.method + ':' + rule.meaning.key));
  if (!unique(book.mappings, 'mappingId', item => review(item) && text(item.version)
    && keys.has(item.method + ':' + item.interpretationKey) && topic(item.topicId)
    && ['direct', 'conditional', 'weak'].includes(String(item.strength))
    && (item.required === undefined || list(item.required, condition)) && (item.excluded === undefined || list(item.excluded, condition))
    && list(item.allowedDirections, value => directions.includes(String(value))))) throw new Error('Invalid topic mapping');
  const categories = ['yi', 'ji', 'accessory', 'color', 'direction', 'environment', 'behavior', 'ritual'];
  if (!unique(book.catalog, 'itemId', item => review(item) && categories.includes(String(item.category))
    && ['free', 'low', 'optional_purchase'].includes(String(item.costLevel)) && text(item.title) && text(item.usage)
    && list(item.safetyTags, text) && (item.periodUsage === undefined || Object.entries(object(item.periodUsage))
      .every(([key, value]) => period(key) && text(value))) && validCatalog(item as Rulebook['catalog'][number]))) {
    throw new Error('Invalid recommendation catalog');
  }
  const catalog = new Set((book.catalog as Rulebook['catalog']).map(item => item.itemId));
  if (!unique(book.actions, 'ruleId', item => review(item) && text(item.version) && topic(item.topicId)
    && text(item.itemId) && catalog.has(item.itemId) && text(item.rationale) && !unsafeLanguage.test(item.rationale)
    && (item.required === undefined || list(item.required, condition))
    && (item.exclusions === undefined || list(item.exclusions, condition))
    && list(item.interpretationKeys, text) && list(item.applicablePeriods, period) && list(item.limitations, text))) {
    throw new Error('Invalid action rule');
  }
  return value as Rulebook;
}
