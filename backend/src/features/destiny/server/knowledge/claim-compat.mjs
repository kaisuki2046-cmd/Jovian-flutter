import { normalizeRuleInput } from './matching.mjs';
import { createHash } from 'node:crypto';
import { compatibleBaZiLiteralFacts } from './bazi-literal-conditions.mjs';
import { lillyMerchantCaseProfile } from './lilly-merchant-case.mjs';
import { guanceluCaseProfile } from './ziwei-guancelu-cases.mjs';

export const baziHistoricalCaseProfile = 'bazi-historical-case-v1';
export const isHistoricalClaimCompiler = compiler =>
  [baziHistoricalCaseProfile, lillyMerchantCaseProfile, guanceluCaseProfile].includes(compiler);

const baziCaseVariants = new Map([
  ['zpzq-v1-c036-p007-701', {
    digest: '558b1ab589ab745cddd3bdc8dcd53cd89361895d015031621ef3f3d3908e8771',
    pillars: ['戊戌', '乙卯', '丙午', '己亥'],
    edition: '国家图书馆藏《渊海子平·子平真诠》第2卷',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/NLC416-13jh002326-46443_%E6%B7%B5%E6%B5%B7%E5%AD%90%E5%B9%B3_%E5%AD%90%E5%B9%B3%E7%9C%9F%E8%A9%AE_%E7%AC%AC2%E5%8D%B7.pdf',
    note: '底本录乙亥时。国家图书馆藏本《论印绶》录己亥，与丙日起亥时相符。按该异本四柱对照。',
  }],
  ['zpzq-v1-c048-p012-701', {
    digest: '5e97f402c44832b271524674929b94975e563c16c98728ea4795c6c38279437a',
    pillars: ['己酉', '辛未', '癸未', '庚申'],
    edition: '国家图书馆藏《子平真诠》附命式图',
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/NLC416-11jh010455-35296_%E5%AD%90%E5%B9%B3%E7%9C%9F%E8%A9%AE.pdf',
    note: '底本录癸未月。国家图书馆藏本附命式图录辛未，与己年起未月相符。按该异本四柱对照。',
  }],
]);

export function reviewedBaziCaseCitation(claim) {
  const variant = baziCaseVariants.get(claim.id);
  return variant && {
    source: { ...claim.source, edition: variant.edition, url: variant.url },
    comparisonNote: variant.note,
  };
}

// Git may convert LF/CRLF on checkout. Hash the same UTF-8 text on every platform.
export function claimCatalogDigest(content) {
  return createHash('sha256').update(String(content).replace(/^\uFEFF/u, '').replace(/\r\n/gu, '\n')).digest('hex');
}

// Newer Ziwei catalogs attach source sections as structured evidence. They are
// searchable source material, never executable instructions or chart facts.
export function claimContextText(context) {
  if (typeof context === 'string') return context;
  if (context === null || context === undefined) return '';
  if (!Array.isArray(context.sections)) return '';
  return context.sections.flatMap(section => typeof section?.text === 'string' ? [section.text] : []).join('\n');
}
export function isClaimContext(context) {
  return context === null || typeof context === 'string'
    || Boolean(context && typeof context === 'object' && Array.isArray(context.sections)
      && context.sections.every(section => section && typeof section.text === 'string'));
}
export function compileBaziMachineMatch(match) {
  if (!match || match.version !== 'destiny-experience-v1') return null;
  if (match.status !== 'ready') return null;
  if (match.system && match.system !== 'bazi') return { reason: 'different_calculation_system' };
  if (match.chartScope !== 'natal' || match.recordType !== 'general_rule'
    || !Array.isArray(match.triggerInputs) || match.triggerInputs.length
    || !Array.isArray(match.requirements) || match.requirements.length
    || !Array.isArray(match.natalInputs) || !match.natalInputs.length) return { reason: 'unsupported_machine_requirements' };
  try { return { inputs: match.natalInputs.map(input => normalizeRuleInput('bazi', input)), compiler: 'supplied-natal-inputs-v1' }; }
  catch { return { reason: 'unsupported_machine_facts' }; }
}

export function compileBaziHistoricalCase(claim) {
  const { source, conditions, evidence } = claim;
  const { match } = conditions;
  const variant = baziCaseVariants.get(claim.id);
  if (variant && variant.digest !== createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex')) {
    return { reason: 'source_review_required', reviewNote: '原命例的出处、原文或条件已变，需重新核对并确认异本。' };
  }
  if (match?.recordType !== 'case' || match.version !== 'destiny-experience-v1' || match.chartScope !== 'natal'
    || match.system && match.system !== 'bazi' || !Array.isArray(match.requirements)
    || (!variant && (match.status !== 'ready' || match.requirements.length))
    || !Array.isArray(match.triggerInputs) || match.triggerInputs.length || !match.natalInputs?.length
    || claim.conditions.excluded.length) return { reason: 'historical_case' };
  if (claim.id === 'smth-v3-palaces-meng-p049-601') return {
    reason: 'historical_case',
    reviewNote: '原例另指定甲寅胎元。按现行生前三百日取胎月的算法，已排得的同柱例未复现甲寅，保留原条件待核。',
  };
  try {
    const sourceInputs = variant ? [{ required: ['year', 'month', 'day', 'hour'].map((position, index) => ({
      kind: 'pillar', position, ganZhi: variant.pillars[index],
    })) }] : match.natalInputs;
    const inputs = sourceInputs.map(input => normalizeRuleInput('bazi', input));
    const complete = ({ required, anyOf, mustBeAbsent, relations, thresholds }) => {
      const pillars = required.filter(fact => fact.kind === 'pillar');
      const qualifiers = required.filter(fact => fact.kind !== 'pillar');
      return pillars.length === 4 && new Set(pillars.map(fact => fact.position)).size === 4
        && qualifiers.every(fact => ['natal_gender', 'bazi_fetal_month'].includes(fact.kind))
        && qualifiers.length === new Set(qualifiers.map(fact => fact.kind)).size
        && !anyOf.length && !mustBeAbsent.length && !relations.length && !thresholds.length
        && compatibleBaZiLiteralFacts(pillars);
    };
    if (inputs.every(complete)) return {
      compiler: baziHistoricalCaseProfile, inputs, ...(variant && { reviewNote: variant.note }),
    };
  } catch {
    return { reason: 'unsupported_machine_facts' };
  }
  return { reason: 'historical_case', reviewNote: '古籍命例需有一组可复现的完整四柱，以及可核验的原例附加条件。' };
}
