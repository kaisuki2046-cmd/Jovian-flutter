import { chartVersions, methods, normalizeFacts } from './catalog.mjs';
import { isWesternTimeFact } from '../../control/charts.ts';
import { parseChenHuangjiKeSteps } from '../../model/tieban-ke.ts';
import { lillyHouseFacts } from '../../control/lilly-houses.mjs';
import { analyzeConfirmedBaZi, baziDayMasterStrengthConsensus } from './bazi-claim-facts.mjs';
import { lookupBaziHistoricalCases, lookupWesternHistoricalCases, lookupZiweiHistoricalCases } from './claims.mjs';
import { catalogDirectory, catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext } from './matching.mjs';
import { layers, reportTopics } from './topics.mjs';
import { parseTiebanTableQuery } from './tieban-fourteen-tables.mjs';
import { isTiebanBookAnnualAge, parseChenKinshipSequence } from './tieban.mjs';
import { parseTiebanKunjiFacts } from './tieban-kunji.mjs';
import { ptolemyParentTexts } from './ptolemy-parents.mjs';
import { isLillyParentDerivedInput } from './lilly-parent-derived-role.mjs';

export function parseChartQueries(value = [], { timeKnown = true, birthOnlyTieban = false } = {}) {
  if (!Array.isArray(value) || value.length > methods.length) return null;
  const seen = new Set();
  const queries = [];
  for (const query of value) {
    if (!query || !methods.includes(query.method) || seen.has(query.method)
      || query.rulesetVersion !== chartVersions[query.method].rulesetVersion
      || !Array.isArray(query.confirmedFacts) || query.confirmedFacts.length > 256) return null;
    const { method, rulesetVersion, chartScope = 'natal', confirmedAbsentFacts, tradition, birthYear } = query;
    const { tiebanFourteenTable, tiebanBookAnnualAge, tiebanChenHuangjiKe, tiebanChenKinshipSequence, tiebanKunjiFacts }
      = birthOnlyTieban ? {} : query;
    const { ptolemyParentAttendanceText, lillyParentDerivedFigure } = query;
    const fourteenTable = tiebanFourteenTable === undefined ? null : parseTiebanTableQuery(tiebanFourteenTable);
    const chenKe = parseChenHuangjiKeSteps(tiebanChenHuangjiKe);
    const kinshipSequence = parseChenKinshipSequence(tiebanChenKinshipSequence);
    const kunji = parseTiebanKunjiFacts(tiebanKunjiFacts);
    if (confirmedAbsentFacts && (!Array.isArray(confirmedAbsentFacts) || confirmedAbsentFacts.length > 256)
      || tradition !== undefined && (typeof tradition !== 'string' || !tradition.trim())
      || birthYear !== undefined && (method !== 'bazi' || !Number.isInteger(birthYear) || birthYear < 1 || birthYear > 9999)
      || tiebanFourteenTable !== undefined && (!fourteenTable || method !== 'bazi' || chartScope !== 'natal')
      || tiebanBookAnnualAge !== undefined && (!isTiebanBookAnnualAge(tiebanBookAnnualAge) || method !== 'bazi' || chartScope !== 'natal')
      || tiebanChenHuangjiKe !== undefined && (!chenKe || method !== 'bazi' || chartScope !== 'natal')
      || tiebanChenKinshipSequence !== undefined && (!kinshipSequence || method !== 'bazi' || chartScope !== 'natal')
      || tiebanKunjiFacts !== undefined && (!kunji || method !== 'bazi' || chartScope !== 'natal')
      || ptolemyParentAttendanceText !== undefined && (method !== 'western' || chartScope !== 'natal'
        || !ptolemyParentTexts.includes(ptolemyParentAttendanceText))
      || lillyParentDerivedFigure !== undefined && (method !== 'western' || chartScope !== 'natal'
        || !isLillyParentDerivedInput(lillyParentDerivedFigure))) return null;
    try {
      const chart = chartContext(method, query.confirmedFacts, confirmedAbsentFacts, chartScope);
      const usable = (facts) => timeKnown ? facts : facts.filter((fact) =>
        !['natal_daylight', 'natal_ziwei_hour', 'natal_ziwei_time_band', 'ziwei_daozang_input',
          'ziwei_decadal_range', 'bazi_decadal_range'].includes(fact.kind)
        && (method !== 'bazi' || fact.position !== 'hour')
        && (method !== 'ziwei' || !(fact.kind.startsWith('palace_')
          || ['body_palace', 'star_mutagen', 'natal_ziwei_bureau', 'natal_ziwei_life_phase',
            'ziwei_grade', 'ziwei_life_body_clash', 'ziwei_eight_seats'].includes(fact.kind)
          || fact.kind.startsWith('daozang_')))
        && (method !== 'western' || !isWesternTimeFact(fact)));
      let present = usable(chart.present);
      let absent = usable(confirmedAbsentFacts ?? []);
      const genders = new Set(present.filter(fact => fact.kind === 'natal_gender').map(fact => fact.gender));
      if (genders.size > 1) present = present.filter(fact => fact.kind !== 'natal_gender');
      if (method === 'ziwei') {
        // Derived edition-specific values are only calculated inside lookup;
        // neither a supplied value nor a supplied absence is proof.
        const isDerived = fact => ['palace_source_brightness', 'palace_confirmed_body_seat', 'palace_changsheng_phase',
          'palace_life_trines_without_auspicious_mutagens', 'palace_life_without_natal_ji', 'palace_sector_mutagen',
          'palace_sector_benefic_majority',
          'palace_life_without_trine_auspicious_mutagens',
          'ziwei_confirmed_natal_layout'].includes(fact.kind);
        present = present.filter(fact => !isDerived(fact));
        absent = absent.filter(fact => !isDerived(fact));
      }
      if (method === 'bazi') {
        const isDerived = fact => ['day_master_strength', 'bazi_stem_placement_count'].includes(fact.kind);
        present = present.filter(fact => !isDerived(fact));
        absent = absent.filter(fact => !isDerived(fact));
        const complete = analyzeConfirmedBaZi(present);
        const strength = complete?.L2.assessments.dayMasterStrength;
        present.push(...normalizeFacts('bazi', strength
          ? [{ kind: 'day_master_strength', result: strength.result, profile: strength.method }]
          : baziDayMasterStrengthConsensus(present)));
      }
      if (method === 'western') {
        const isDerived = fact => fact.kind.startsWith('western_lilly_') || fact.kind.startsWith('western_ptolemy_book_one_')
          || fact.kind.startsWith('western_ptolemy_fixed_star_') || fact.kind.startsWith('western_ptolemy_travel_')
          || fact.kind.startsWith('western_ptolemy_siblings_')
          || ['western_cardano_dignity', 'western_ptolemy_parent'].includes(fact.kind);
        present = present.filter(fact => !isDerived(fact));
        absent = absent.filter(fact => !isDerived(fact));
        present.push(...normalizeFacts('western', lillyHouseFacts(present)));
      }
      if (present.length > 256) return null;
      queries.push({ method, rulesetVersion, confirmedFacts: present, chartScope,
        ...(timeKnown && chartScope === 'natal' && birthYear !== undefined && { birthYear }),
        ...(timeKnown && tiebanBookAnnualAge !== undefined && { tiebanBookAnnualAge }),
        ...(timeKnown && chenKe && { tiebanChenHuangjiKe: chenKe }),
        ...(timeKnown && kinshipSequence && { tiebanChenKinshipSequence: kinshipSequence }),
        ...(timeKnown && kunji && { tiebanKunjiFacts: kunji }),
        ...(timeKnown && fourteenTable && { tiebanFourteenTable: fourteenTable }),
        ...(ptolemyParentAttendanceText && { ptolemyParentAttendanceText }),
        ...(timeKnown && lillyParentDerivedFigure && { lillyParentDerivedFigure: { ...lillyParentDerivedFigure } }),
        ...(confirmedAbsentFacts && { confirmedAbsentFacts: absent }), ...(tradition && { tradition }) });
    } catch {
      return null;
    }
    seen.add(method);
  }
  return queries;
}

function specificity({ required, alternatives, relations, measurements }) {
  const alternativeSize = Math.max(0, ...alternatives.map((group) => group.length));
  return required.length + alternativeSize + relations.length + measurements.length;
}

export function createReportLookup(directory = catalogDirectory, catalog = catalogForDirectory(directory), { birthOnlyTieban = false } = {}) {
  return (queries = []) => {
    if (!queries.length) return [];
    const ranked = queries.flatMap((query) => lookupInterpretations(directory, query, catalog))
      .sort((a, b) => specificity(b.matchedConditions) - specificity(a.matchedConditions) || a.id.localeCompare(b.id));
    const western = queries.filter(query => query.method === 'western' && (query.chartScope ?? 'natal') === 'natal');
    const calculationReferences = western
      .flatMap(query => catalog.calculationReferences(query.confirmedFacts, query.tradition));
    const bazi = queries.find(query => query.method === 'bazi' && (query.chartScope ?? 'natal') === 'natal'
      && query.rulesetVersion === chartVersions.bazi.rulesetVersion);
    const ziwei = queries.find(query => query.method === 'ziwei' && (query.chartScope ?? 'natal') === 'natal'
      && query.rulesetVersion === chartVersions.ziwei.rulesetVersion);
    const tieban = bazi && (!bazi.tradition || bazi.tradition === '铁板神数') && (birthOnlyTieban
      ? catalog.tiebanBirthMatches(bazi.confirmedFacts, bazi.birthYear)
      : catalog.tiebanMatches(
        bazi.confirmedFacts, bazi.birthYear, bazi.tiebanFourteenTable, bazi.tiebanBookAnnualAge,
        bazi.tiebanChenHuangjiKe, bazi.tiebanChenKinshipSequence, bazi.tiebanKunjiFacts));
    const caseReferences = [
      ...(bazi ? lookupBaziHistoricalCases(
        chartContext('bazi', bazi.confirmedFacts, bazi.confirmedAbsentFacts), bazi.tradition, catalog,
      ) : []),
      ...(ziwei ? lookupZiweiHistoricalCases(
        chartContext('ziwei', ziwei.confirmedFacts, ziwei.confirmedAbsentFacts), ziwei.tradition, catalog,
      ) : []),
      ...western.filter(query => query.rulesetVersion === chartVersions.western.rulesetVersion).flatMap(query => lookupWesternHistoricalCases(
        chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts), query.tradition, catalog,
      )),
    ];
    return Object.entries(reportTopics).map(([topicId, topic]) => ({
      topicId, topic,
      ...(topicId === 'overall' && calculationReferences.length ? { calculationReferences } : {}),
      ...(topicId === 'overall' && tieban ? { tieban } : {}),
      ...(caseReferences.some(match => match.topic === topic) && { caseReferences: caseReferences.filter(match => match.topic === topic) }),
      ...Object.fromEntries(layers.map((layer) => [
        layer, ranked.filter((hit) => hit.layer === layer && hit.topic === topic),
      ])),
    }));
  };
}
