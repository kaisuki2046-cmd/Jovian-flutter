import { factText, relationText } from './chart-facts-text.mjs';
import { branchInterpretation, claimEvidence, cleanModernInterpretation, legacyEvidence } from './knowledge/report-evidence.mjs';
import { ptolemyTermProfile } from './knowledge/ptolemy-terms.mjs';
import { ptolemyClassificationProfile } from './knowledge/ptolemy-classifications.mjs';
import { lillyFortitudeProfile } from './knowledge/lilly-fortitudes.mjs';
import { lillyAspectReferenceProfile } from './knowledge/lilly-aspect-references.mjs';
import { lillyPrintedDignityProfile } from './knowledge/lilly-dignity-references.mjs';
import { lillyMannersRepeatedPassages } from './knowledge/lilly-manners.mjs';
import { jielanGusuiRepeatedPassages } from './knowledge/ziwei-jielan-gusui.mjs';
import { jielanPalaceRepeatedPassages } from './knowledge/ziwei-source-passages.mjs';
import { guanceluRepeatedPassages } from './knowledge/ziwei-guancelu.mjs';
import { xingjueChildrenRepeatedPassages } from './knowledge/xingjue-children.mjs';
import { xingjueHealthProfile } from './knowledge/xingjue-health.mjs';
import { xingjueFemaleProfile } from './knowledge/xingjue-female.mjs';
import { blindPalaceProfile } from './knowledge/bazi-blind-palace.mjs';
import { shenfengRepeatedPassages, shenfengReviewedProfile } from './knowledge/bazi-shenfeng-reviewed.mjs';
import { xingjuePalaceConfigurationProfile } from './knowledge/xingjue-palace-configurations.mjs';
import { xingjueSpouseConfigurationProfile, xingjueSpouseRepeatedPassages } from './knowledge/xingjue-spouse.mjs';
import { xingjueTianjiRepeatedPassages } from './knowledge/xingjue-tianji.mjs';
import { xingjueWealthRepeatedPassages } from './knowledge/xingjue-wealth.mjs';
import { xingjueSunMoonRepeatedPassages } from './knowledge/xingjue-natal-stars.mjs';
import { chenAnnualProfile, chenDayLinesProfile, chenDayNajiaProfile, chenDecadalProfile, chenHeluoLinesProfile,
  chenHeluoNajiaProfile, chenHeluoTotalsProfile, chenHuangjiStemProfile, chenPillarLinesProfile, chenPillarNajiaProfile, chenRangeTrigramProfile,
  chenRangeLineProfile, chenStemSequenceProfile, guanFrontBackProfile,
  taiXuanFormsProfile, tiebanBookAnnualProfile, tianyuanNetworkProfile, tianyuanYearProfile } from './knowledge/tieban.mjs';
export { factText } from './chart-facts-text.mjs';

const tiebanAxes = {
  earlier: '先天基数', later: '后天基数', yuan_hui: '皇极元会基数', yun_shi: '皇极运世基数',
  earlier_mutual: '太玄先天互卦式', earlier_transformed: '太玄先天变卦式', earlier_transformed_mutual: '太玄先天变互式',
  later_mutual: '太玄后天互卦式', later_transformed: '太玄后天变卦式', later_transformed_mutual: '太玄后天变互式',
  day_hexagram: '日柱配卦纳数', year_month_upper_najia: '年月变卦·本卦上卦纳数', year_month_lower_najia: '年月变卦·本卦下卦纳数',
  year_month_original: '年月变卦·本卦卦数', year_month_mutual: '年月变卦·本卦互卦数', year_month_swapped: '年月变卦·变卦卦数',
  heluo_earlier: '河洛先天基数', heluo_later: '河洛后天基数',
  chen_heluo_totals: '陈氏河洛天地数编号',
  tianyuan_year_first: '田园年柱首号', tianyuan_year_related: '田园年柱关联号',
  tianyuan_horizontal_stems: '田园四干横排号', tianyuan_horizontal_branches: '田园四支横排号',
  tianyuan_horizontal_year_month: '田园年月干支横排号', tianyuan_horizontal_day_hour: '田园日时干支横排号',
  tianyuan_month_first: '田园月柱首号', tianyuan_day_first: '田园日柱首号', tianyuan_hour_first: '田园时柱首号',
  chen_heluo_lines_earlier: '陈氏第一法先天卦爻数', chen_heluo_lines_earlier_plus: '陈氏第一法先天卦爻数加取号',
  chen_heluo_lines_later: '陈氏第一法后天卦爻数', chen_heluo_lines_later_minus: '陈氏第一法后天卦爻数减取号',
  chen_heluo_najia_earlier: '陈氏第二法先天卦纳甲', chen_heluo_najia_earlier_plus: '陈氏第二法先天卦纳甲加取号',
  chen_heluo_najia_earlier_minus: '陈氏第二法先天卦纳甲减取号',
  chen_heluo_najia_later: '陈氏第二法后天卦纳甲', chen_heluo_najia_later_plus: '陈氏第二法后天卦纳甲加取号',
  chen_heluo_najia_later_minus: '陈氏第二法后天卦纳甲减取号',
  chen_huangji_yuan_hui_base: '陈氏第四法元会加年干', chen_huangji_yun_shi_base: '陈氏第四法运世加年干',
  chen_huangji_yuan_hui_month: '陈氏第四法元会加年月干', chen_huangji_yun_shi_month: '陈氏第四法运世加年月干',
  chen_huangji_yuan_hui_day: '陈氏第四法元会加年日干', chen_huangji_yun_shi_day: '陈氏第四法运世加年日干',
  chen_huangji_yuan_hui_hour: '陈氏第四法元会加年时干', chen_huangji_yun_shi_hour: '陈氏第四法运世加年时干',
  chen_huangji_yuan_hui_day_hour: '陈氏第四法元会加年日时干', chen_huangji_yun_shi_day_hour: '陈氏第四法运世加年日时干',
  chen_range_year_month_stem_branch: '陈氏第五法年月干支取号', chen_range_year_month_mutual: '陈氏第五法年月互卦取号',
  chen_range_day_hour_stem_branch: '陈氏第五法日时干支取号', chen_range_day_hour_mutual: '陈氏第五法日时互卦取号',
  chen_range_lines_year_month_base: '陈氏第七法年月爻数基号', chen_range_lines_year_month_offset: '陈氏第七法年月加96取号',
  chen_range_lines_day_hour_base: '陈氏第七法日时爻数基号', chen_range_lines_day_hour_offset: '陈氏第七法日时减96取号',
  guan_front_hexagram: '关氏前卦加96取号', guan_back_hexagram: '关氏后卦减96取号',
  chen_stem_sequence_base: '陈氏第十二法四柱基数', chen_stem_sequence_first_addition: '陈氏第十二法首个加96候选号',
  chen_pillar_lines_year: '陈氏第八法年柱爻数', chen_pillar_lines_month: '陈氏第八法月柱爻数',
  chen_pillar_lines_day: '陈氏第八法日柱爻数', chen_pillar_lines_hour: '陈氏第八法时柱爻数',
  chen_day_lines_plus: '陈氏第九法日柱爻数加取号', chen_day_lines_minus: '陈氏第九法日柱爻数减取号',
  chen_pillar_najia_year: '陈氏第十法年柱纳甲', chen_pillar_najia_month: '陈氏第十法月柱纳甲',
  chen_pillar_najia_day: '陈氏第十法日柱纳甲', chen_pillar_najia_hour: '陈氏第十法时柱纳甲',
  chen_day_najia_base: '陈氏第十一法日柱基数', chen_day_najia_next: '陈氏第十一法日柱顺取号',
  chen_day_najia_previous: '陈氏第十一法日柱逆取号',
  decadal: '大运基数', book_annual: '书传流年推算编号',
  chen_decadal_growth: '陈氏第十三法大运生数', chen_decadal_completion: '陈氏第十三法大运成数',
  chen_annual: '陈氏第十四法流年编号',
  fourteen_personality: '十四表性格', fourteen_career: '十四表才能前程', fourteen_wealth: '十四表财运', fourteen_siblings: '十四表兄弟',
  fourteen_annual: '十四表流年原号', fourteen_annual_corrected: '十四表流年校正号',
};
const chenPillarProfiles = new Set([chenPillarLinesProfile, chenDayLinesProfile, chenPillarNajiaProfile, chenDayNajiaProfile]);

export function conditionsText(conditions = {}) {
  const pieces = [...(conditions.required ?? []).map(factText)];
  if (conditions.absent?.length) pieces.push('不见：' + conditions.absent.map(factText).join('、'));
  if (conditions.alternatives?.length) pieces.push('已满足组合：' + conditions.alternatives
    .map(group => group.map(factText).join('且')).join('；'));
  pieces.push(...(conditions.relations ?? []).map(relationText));
  pieces.push(...(conditions.measurements ?? []).map(factText));
  const periods = conditions.decadalPeriods ?? (conditions.decadalPeriod ? [conditions.decadalPeriod] : []);
  for (const period of periods) {
    const { startAge, endAge } = period.applicableAgeRange ?? period;
    const ages = startAge === endAge ? startAge : `${startAge}至${endAge}`;
    pieces.push(`适用${ages}虚岁${period.ganZhi ?? period.palace ?? ''}运限`);
  }
  return [...new Set(pieces)].join('；');
}

function hitEvidence(rule) {
  const material = rule.claim ? claimEvidence(rule.claim) : legacyEvidence(rule);
  return rule.matchedBranches?.length ? rule.matchedBranches.map(branch => ({
    source: material.source,
    originalText: branch.text,
    ...(!Object.hasOwn(branch, 'modernInterpretation') ? branchInterpretation(rule.claim, branch) : {
      modernInterpretation: branch.modernInterpretation, interpretationOrigin: branch.interpretationOrigin,
    }),
    conditions: branch.matchedConditions,
    matchedRuleConditions: branch.matchedRuleConditions,
    promptEvidence: branch.promptEvidence,
    branch,
  })) : [{ ...material, conditions: rule.matchedConditions, matchedRuleConditions: rule.matchedRuleConditions, promptEvidence: rule.promptEvidence }];
}

function interpretationText({ modernInterpretation, interpretationOrigin }) {
  return interpretationOrigin === 'derived'
    ? modernInterpretation?.replace(/。相关盘面包括.*$/su, '。') : modernInterpretation;
}

function promptEvidenceText(material) {
  if (!material) return material;
  return { ...material, modernInterpretation: cleanModernInterpretation(material.originalText, material.modernInterpretation) };
}

function evidenceText({ originalText, modernInterpretation, originalKind }, originalLabel = '原文/依据') {
  return [
    originalText && `${originalLabel}：${originalText}`,
    modernInterpretation && `现代解读：${modernInterpretation}`,
    originalText && originalKind === 'rule_basis' && '原文性质：资料库规则编写依据',
  ].filter(Boolean).join('\n');
}

const hasEvidence = material => material?.originalText || material?.modernInterpretation;

function promptConditionsText({ matchedRuleConditions, conditions }) {
  const groups = new Set((matchedRuleConditions ?? [conditions]).flatMap(group => {
    if (!group) return [];
    const { required, absent, alternatives, relations, measurements } = group;
    const text = conditionsText({ required, absent, alternatives, relations, measurements });
    return text ? [text] : [];
  }));
  const items = [...groups];
  return items.length > 1 ? items.map(text => `（${text}）`).join(' 或 ') : items[0];
}

export function collectReportMaterials(references, { combineAliases = true, forPrompt = false } = {}) {
  const blocks = [];
  const rules = references.flatMap(({ personality, events }) => [...personality, ...events]);
  const records = new Map(rules.map(rule => [rule, hitEvidence(rule).map(material => ({ rule, material, aliases: [] }))]));
  const byId = new Map(rules.map(rule => [rule.id, records.get(rule)]));
  for (const [aliasId, { id, text }] of combineAliases ? [
    ...jielanGusuiRepeatedPassages, ...jielanPalaceRepeatedPassages, ...guanceluRepeatedPassages, ...xingjueChildrenRepeatedPassages,
    ...xingjueSpouseRepeatedPassages, ...xingjueTianjiRepeatedPassages, ...xingjueWealthRepeatedPassages,
    ...xingjueSunMoonRepeatedPassages, ...lillyMannersRepeatedPassages, ...shenfengRepeatedPassages,
  ] : []) {
    const original = byId.get(id);
    if (!original) continue;
    for (const alias of byId.get(aliasId) ?? []) {
      const excerpt = alias.material.originalText;
      if (text && excerpt !== text) continue;
      const target = original.find(row => !row.duplicate && row.material.originalText === excerpt
        && row.material.originalKind === alias.material.originalKind);
      if (!target || alias.duplicate) continue;
      target.aliases.push(alias, ...alias.aliases);
      alias.duplicate = true;
    }
  }
  const tieban = references.find(reference => reference.tieban)?.tieban;
  const tiebanMatches = new Map();
  for (const calculation of tieban ? [tieban, ...(tieban.additionalCalculations ?? [])] : []) {
    for (const { axis, clauseId, status, claim, promptEvidence, age, decadalPeriod, annualPeriod, yuanTangLine, dayLineBase,
      rangeLineBase, lineOffset, requiresSelection, heluoTotals } of calculation.results) {
      if (status !== 'matched' || requiresSelection) continue;
      if (!tiebanMatches.has(claim.id)) tiebanMatches.set(claim.id, { claim, promptEvidence, numbers: [], edition: calculation.libraryEdition,
        decadal: false, bookAnnual: false, taiXuanForms: false, tianyuan: false, tianyuanNetwork: false,
        chenDecadal: false, chenAnnual: false,
        chenPillars: false, chenHeluo: false, chenHeluoTotals: false, chenHuangji: false, chenRange: false,
        chenRangeLine: false, chenStemSequence: false, guanFrontBack: false });
      if (forPrompt) continue;
      const entry = tiebanMatches.get(claim.id);
      entry.decadal ||= Boolean(decadalPeriod);
      entry.bookAnnual ||= calculation.profile === tiebanBookAnnualProfile;
      entry.taiXuanForms ||= calculation.profile === taiXuanFormsProfile;
      entry.tianyuan ||= calculation.profile === tianyuanYearProfile;
      entry.tianyuanNetwork ||= calculation.profile === tianyuanNetworkProfile;
      entry.chenDecadal ||= calculation.profile === chenDecadalProfile;
      entry.chenAnnual ||= calculation.profile === chenAnnualProfile;
      entry.chenPillars ||= chenPillarProfiles.has(calculation.profile);
      entry.chenHeluo ||= calculation.profile === chenHeluoLinesProfile || calculation.profile === chenHeluoNajiaProfile;
      entry.chenHeluoTotals ||= calculation.profile === chenHeluoTotalsProfile;
      entry.chenHuangji ||= calculation.profile === chenHuangjiStemProfile;
      entry.chenRange ||= calculation.profile === chenRangeTrigramProfile;
      entry.chenRangeLine ||= calculation.profile === chenRangeLineProfile;
      entry.chenStemSequence ||= calculation.profile === chenStemSequenceProfile;
      entry.guanFrontBack ||= calculation.profile === guanFrontBackProfile;
      const combination = annualPeriod?.stemCombination;
      const qualifier = annualPeriod
        ? `（${age}虚岁，${annualPeriod.ganZhi}，${!annualPeriod.luckPillar ? '尚未交运'
          : `${annualPeriod.beforeFirstLuck ? '以月柱代运' : '大运'}${annualPeriod.luckPillar}`}${
          combination ? `，月干${combination.monthStem}与流年干${combination.annualStem}合数${combination.number}` : ''}）`
        : decadalPeriod
        ? `（${decadalPeriod.ganZhi}运，排盘${decadalPeriod.startAge}–${decadalPeriod.endAge}虚岁）`
        : age !== undefined ? `（表列${age}岁）` : yuanTangLine !== undefined ? `（元堂第${yuanTangLine}爻）`
          : lineOffset !== undefined ? `（基数${rangeLineBase ?? dayLineBase}${lineOffset > 0 ? '加' : '减'}${Math.abs(lineOffset)}）`
          : heluoTotals ? `（天数${heluoTotals.heavenTotal}、地数${heluoTotals.earthTotal}）`
          : axis === 'earlier' || axis === 'later' ? '（太玄）' : '';
      const label = `${tiebanAxes[axis]} ${clauseId}${qualifier}`;
      entry.numbers.push(label);
    }
  }
  for (const { topicId, topic, personality, events, calculationReferences = [], caseReferences = [] } of references) {
    const entries = [];
    const addEvidence = (kind, id, evidence, details, render) => entries.push({
      kind, id, ...evidence, ...details, render,
    });
    const addLookup = (id, lookup, notice, render) => addEvidence('lookup', id, {}, {
      source: lookup.reportEvidence?.[0]?.source, notice,
    }, render);
    for (const rule of [...personality, ...events]) {
      const claim = rule.claim;
      const branches = rule.matchedBranches;
      const useLimits = !branches?.some(branch =>
        [xingjueHealthProfile, xingjueFemaleProfile, xingjueSpouseConfigurationProfile,
          xingjuePalaceConfigurationProfile, blindPalaceProfile, shenfengReviewedProfile].includes(branch.conditionCompiler));
      for (const { material, aliases, duplicate } of records.get(rule)) {
        if (duplicate) continue;
        if (forPrompt) {
          const decadal = Boolean(material.conditions?.decadalPeriods?.length || material.conditions?.decadalPeriod);
          const evidence = promptEvidenceText(material.promptEvidence ?? { ...material, modernInterpretation: interpretationText(material) });
          if (!hasEvidence(evidence)) continue;
          addEvidence('rule', rule.id, evidence, {
            rule, conditions: material.conditions, branch: material.branch, deduplicationKey: JSON.stringify([
              evidence.originalKind, evidence.originalText, evidence.modernInterpretation, decadal,
            ]),
          }, () => {
            const match = promptConditionsText(material);
            return [
              evidenceText(evidence, '原文'),
              match && `命中条件：${match}`,
              decadal && '原条目适用范围：仅适用于所匹配的大运阶段。',
            ].filter(Boolean).join('\n');
          });
          continue;
        }
        const limitations = useLimits ? [...new Set([...(claim?.interpretation.limitations ?? (rule.limit ? [rule.limit] : [])),
          ...aliases.flatMap(({ rule: alias }) => alias.claim?.interpretation.limitations ?? (alias.limit ? [alias.limit] : []))])].filter(Boolean) : [];
        const match = conditionsText(material.conditions);
        const sameText = new Set(aliases.map(({ rule: alias, material: other }) => {
          const conditions = conditionsText(other.conditions);
          const differentReading = other.modernInterpretation !== material.modernInterpretation;
          if (!differentReading && conditions === match && alias.calculationNote === rule.calculationNote) return '';
          return ['同一原文的另一条匹配',
            differentReading && `现代解读：${other.modernInterpretation}`,
            `命中条件：${conditions}`, alias.calculationNote && `计算口径：${alias.calculationNote}`].filter(Boolean).join('\n');
        }));
        addEvidence('rule', rule.id, material, {
          rule, deduplicationKey: JSON.stringify([
            material.originalKind, material.originalText, material.modernInterpretation, match, rule.calculationNote, limitations,
          ]),
        }, () => [
          evidenceText(material),
          `命中条件：${match}`,
          rule.calculationNote && `计算口径：${rule.calculationNote}`,
          ...sameText,
          limitations.length && `原资料使用边界：${limitations.join('；')}`,
        ].filter(Boolean).join('\n'));
      }
    }
    for (const reference of caseReferences) {
      const { id, matchedConditions, claim, reportEvidence, calculationNote, comparisonNote, referenceType } = reference;
      const material = reportEvidence ?? (claim && claimEvidence(claim));
      if (forPrompt) {
        const heading = referenceType === 'ziwei' ? '古籍紫微命例对照' : claim ? '古籍印盘对照' : '古籍四柱对照';
        const match = referenceType === 'ziwei' ? '原例所需的生辰条件与紫微盘式已核对。'
          : claim ? '星位和宫头满足原例印盘的对照条件。' : '四柱与原例相符，并满足原例所需的附加条件。';
        const evidence = promptEvidenceText(reference.promptEvidence ?? material);
        if (hasEvidence(evidence)) addEvidence('case', id, evidence, { caseReference: reference, conditions: matchedConditions },
          () => `${heading}\n${evidenceText(evidence, '原文')}\n命中条件：${match}`);
        continue;
      }
      addEvidence('case', id, material ?? {}, {
        caseReference: reference, conditions: matchedConditions, source: material?.source ?? reference.source,
        notice: claim ? calculationNote : undefined,
      }, () => {
        const excerpt = material ? evidenceText(material) + '\n' : '';
        if (referenceType === 'ziwei') {
          const required = matchedConditions.required.filter(fact => fact.kind !== 'ziwei_daozang_input');
          const birth = matchedConditions.required.find(fact => fact.kind === 'ziwei_daozang_input');
          return `古籍紫微命例对照\n${excerpt}同盘依据 ${conditionsText({ ...matchedConditions, required })}；农历${birth.day}日\n${calculationNote}`;
        }
        if (claim) {
          const notes = [comparisonNote, ...claim.interpretation.limitations].filter(Boolean).join('；');
          return `古籍印盘对照·${claim.title}\n${evidenceText(material)}${notes ? '\n对照说明 ' + notes : ''}`;
        }
        return `古籍四柱对照\n${excerpt}同柱依据 ${conditionsText(matchedConditions)}${calculationNote ? '\n复排说明 ' + calculationNote : ''}${comparisonNote ? '\n异文说明 ' + comparisonNote : ''}`;
      });
    }
    for (const { claim, promptEvidence, numbers, edition, decadal, bookAnnual, taiXuanForms, tianyuan, tianyuanNetwork, chenDecadal, chenAnnual,
      chenPillars, chenHeluo, chenHeluoTotals, chenHuangji, chenRange, chenRangeLine, chenStemSequence, guanFrontBack } of tiebanMatches.values()) {
      if ((forPrompt ? promptEvidence?.topic ?? claim.category.topic : claim.category.topic) !== topic) continue;
      const material = claimEvidence(claim);
      if (forPrompt) {
        const evidence = promptEvidenceText(promptEvidence ?? material);
        if (hasEvidence(evidence)) addEvidence('tieban', claim.id, evidence, {}, () =>
          `铁板神数条文参考\n${evidenceText(evidence, '原文')}\n命中条件：本地起数命中，并已核对条文的适用条件。`);
        continue;
      }
      const limits = claim.interpretation.limitations;
      const fourteen = edition === 'muxuan-fourteen-table-csv';
      const version = fourteen ? '沐玄十四表 CSV 版' : '沐玄 JSON 版';
      const methodNote = bookAnnual ? '流年编号采用复原口径，千位保留大运天干。条文只用于所选岁数，缺少流年命例可供核对。'
        : fourteen ? '使用明确的求测时柱。原号与校正号属于同一套算法，表列岁数仅用于对应原表，CSV 未提供性别码。'
        : decadal ? '大运基数按排盘所列运限计算，所引 JSON 条文没有逐岁标注。排盘的运限年龄仅说明编号怎么算出。'
          : '这些编号由同一组四柱按所列方法计算。';
      const formsNote = taiXuanForms ? '太玄互卦、变卦和变互取数按八式复算，同一组例盘缺少逐式对应编号。' : '';
      const tianyuanNote = tianyuan ? '田园年柱的关联号从首号起每次加九十六。' : '';
      const tianyuanNetworkNote = tianyuanNetwork ? '田园横排与月、日、时柱首号按配卦和取数次序复算。' : '';
      const chenNote = chenDecadal ? '大运生数、成数按同一步大运分别计算，用于查询相应条文。' : '';
      const chenAnnualNote = chenAnnual ? '流年编号按原表复算，取材限于所选虚岁。' : '';
      const chenPillarsNote = chenPillars ? '陈氏第八至十一法分四柱取数。' : '';
      const chenHeluoNote = chenHeluo ? '河洛爻数和纳甲编号按已确认的元堂化后天卦计算。' : '';
      const chenHeluoTotalsNote = chenHeluoTotals ? '天地数编号以奇数合计乘一百加偶数合计。' : '';
      const chenHuangjiNote = chenHuangji ? '元会、运世的天干加数按未考刻的四柱算式取号。' : '';
      const chenRangeNote = chenRange ? '分别用年月、日时取卦，年月互卦也可复算第六法初刻候选号。' : '';
      const chenRangeLineNote = chenRangeLine ? '爻数只取例盘验证的配卦，年月依次加九十六，日时依次减九十六。' : '';
      const chenStemSequenceNote = chenStemSequence ? '四柱基数和首个加取号的取用标记随例盘记录。' : '';
      const guanFrontBackNote = guanFrontBack ? '前后变卦取号，年月加九十六四次，日时减九十六四次。' : '';
      addEvidence('tieban', claim.id, material, {}, () => `铁板神数起数参考（${version}）：${numbers.join('、')}\n${evidenceText(material, '原文')}\n使用边界：${methodNote}${formsNote}${tianyuanNote}${tianyuanNetworkNote}${chenNote}${chenAnnualNote}${chenPillarsNote}${chenHeluoNote}${chenHeluoTotalsNote}${chenHuangjiNote}${chenRangeNote}${chenRangeLineNote}${chenStemSequenceNote}${guanFrontBackNote}考刻尚未确认，亲属、年龄和事件仅作引用，不可写成命主已发生的事实或确定预测。多种起数都引用同一条文时只计一次。${limits.length ? '\n原资料使用边界：' + limits.join('；') : ''}`);
    }
    if (forPrompt) {
      if (entries.length) blocks.push({ topicId, topic, entries });
      continue;
    }
    const terms = calculationReferences.filter(reference => reference.role === 'term_ruler_lookup' && reference.profile === ptolemyTermProfile);
    const classifications = calculationReferences.filter(reference => reference.role === 'classification_lookup' && reference.profile === ptolemyClassificationProfile);
    const fortitudes = calculationReferences.filter(reference => reference.role === 'fortitude_lookup' && reference.profile === lillyFortitudeProfile);
    const aspectReferences = calculationReferences.filter(reference => reference.role === 'aspect_orb_lookup' && reference.profile === lillyAspectReferenceProfile);
    const printedDignities = calculationReferences.filter(reference => reference.profile === lillyPrintedDignityProfile);
    if (printedDignities.length) {
      const names = { sun: '太阳', moon: '月亮', mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星',
        north_node: '北交点', south_node: '南交点' };
      const labels = { diurnal: '昼庙 D', nocturnal: '夜庙 N', both: '日月单庙 ND' };
      const notice = '莉莉庙座栏标与表列擢升度。D、N、ND 是庙座栏标。';
      for (const row of printedDignities) {
        const { role, signName, label, ruler, body, degree, matchesDegree, matchesSign } = row;
        if (role === 'domicile_label_lookup') {
          addLookup(`lilly-domicile:${signName}:${ruler}`, row, notice, () => `盘面所见星座的庙主及栏标　${signName} ${names[ruler]} ${labels[label]}`);
        } else if (role === 'printed_exaltation_lookup' && matchesSign) {
          addLookup(`lilly-exaltation:${body}:${signName}`, row, notice,
            () => `${names[body]}在${signName}，原表擢升点 ${degree}°，${matchesDegree === undefined ? '盘面仅确认落座'
              : matchesDegree ? '盘面同整度' : '盘面同座、整度有别'}`);
        }
      }
    }
    if (aspectReferences.length) {
      const names = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星' };
      const aspects = { conjunction: '合相', sextile: '六合', square: '四分', trine: '三分', opposition: '对冲' };
      const motion = { both_direct: '双顺行渐入', opposite_motion: '顺逆相向渐入' };
      const labels = { main: '首栏', other: '另列' };
      const notice = '莉莉相位计算依据。各栏分别用两星全容许度的一半之和，仅作盘面计算参考。';
      for (const row of aspectReferences) {
        const { first, second, aspect, deviation, columns } = row;
        addLookup(`lilly-aspect:${first}:${second}:${aspect}`, row, notice,
          () => `${names[first]}与${names[second]}${aspects[aspect]}，偏离精确角 ${Number(deviation.toFixed(3))}°。`
            + columns.map(({ table, limit, matched, phase }) => `${labels[table]} ${limit}° ${matched ? '范围内' : '范围外'}${phase ? '，' + motion[phase] : ''}`).join('，'));
      }
    }
    if (fortitudes.length) {
      const names = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星' };
      const notice = '莉莉原表强弱计分。逐星列出已确认项。恒星分项按出生时刻的热带视黄经核对。';
      for (const row of fortitudes) {
        const { planet, factors } = row;
        addLookup(`lilly-fortitude:${planet}`, row, notice, () => `${names[planet]}：${factors.map(({ label, points }) =>
          `${label} ${points > 0 ? '+' : ''}${points}分`).join('、')}`);
      }
    }
    if (classifications.length) {
      const names = { sun: '太阳', moon: '月亮', mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星',
        beneficent: '吉性', maleficent: '凶性', common: '兼性', diurnal: '昼派', nocturnal: '夜派', solstitial: '至点', equinoctial: '分点', solid: '固定', bicorporeal: '双体', masculine: '历史阳性', feminine: '历史阴性' };
      const dimensions = { planet_nature: '星体自然类别', planet_sect_affinity: '固定昼夜归属', sign_mode: '星座类别', sign_polarity: '星座阴阳术语', triplicity_rulers: '三分组主星' };
      const notice = '托勒密分类查表结果。分类不独立形成性格或事件结论，也不与莉莉类别混用；月亮在托勒密自然类别列吉性，水星的可变昼夜派别未据此补定。固定昼夜归属不是本命昼夜判断，历史阴阳术语不对应人的性别或优劣。';
      for (const row of classifications) {
        addLookup(`ptolemy-classification:${row.planet}:${row.sign ?? ''}`, row, notice,
          () => `${names[row.planet.toLowerCase()]}${row.sign ? '在' + row.sign : ''}：`
            + row.classifications.map(item => `${dimensions[item.dimension]}=${item.values.map(value => names[value] ?? '未定义').join('、')}`
              + (item.sect === 'both' ? '' : `（${item.sect === 'day' ? '昼盘' : '夜盘'}）`)).join('；'));
      }
    }
    if (terms.length) {
      const names = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星' };
      const systems = { egyptian_common: '埃及通行界', ptolemy_manuscript: '古抄本印表界', chaldaean: '迦勒底界' };
      const notice = '界主查表结果：各方案独立读取，不横借条件；这些是星体位置对应的表值，不独立形成性格或事件结论。';
      const sects = { day: '昼盘', night: '夜盘', consensus: '昼夜未定且结果一致' };
      for (const row of terms) {
        const { planet, sign, degree, system, sect, ruler, start, end } = row;
        addLookup(`ptolemy-term:${planet}:${sign}:${system}:${sect ?? ''}:${start}`, row, notice,
          () => `${names[planet]}在${sign}约${Math.floor(degree * 10000) / 10000}°：${systems[system]}`
            + (system === 'chaldaean' ? `（${sects[sect]}）` : '') + `=${names[ruler]}[${start}°, ${end}°)`);
      }
    }
    const citedCalculations = calculationReferences
      .filter(reference => reference.role !== 'printed_exaltation_lookup' || reference.matchesSign)
      .flatMap(reference => reference.reportEvidence ?? []);
    for (const material of new Map(citedCalculations.map(row => [row.id, row])).values()) {
      addEvidence('calculation', material.id, material, {}, () => `古籍计算资料\n${evidenceText(material)}`);
    }
    if (entries.length) blocks.push({ topicId, topic, entries });
  }
  return blocks;
}

export function renderReportMaterials(blocks) {
  return blocks.filter(({ entries }) => entries.length).map(({ topic, entries }) => {
    const paragraphs = entries.flatMap(({ notice, render }) => [notice, render()].filter(Boolean));
    return `【${topic}】\n${[...new Set(paragraphs)].join('\n\n')}`;
  }).join('\n\n');
}

export function buildReportMaterials(references) {
  return renderReportMaterials(collectReportMaterials(references));
}
