import { buildZiweiFactWindow } from '../ziwei-flows';
import { utcRange } from '../fact-time-context';
import { ziweiPalaceConditions } from '../ziwei-conditions';
import { buildLingZiweiWindow, lingZiweiPolicy } from '../ziwei-ling';
import { quanshuAnnualContext, quanshuLimitPhase, quanshuPalaceCondition, quanshuTianxingCondition } from '../ziwei-quanshu';
import { buildYunZiweiWindow, yunDailyReadings, yunMonthlyFinanceAreas, yunSunJiCaseEvidence, yunSunJiCaseWindow, yunZiweiPolicy } from '../ziwei-yun';
import { quanshuKongJieCondition, quanshuKongJiePolicy } from '../ziwei-kongjie';
import { quanshuKongJieLimits, quanshuKongJieLimitPolicy } from '../ziwei-kongjie-limits';
import { bindQuanshuSupportScopes, quanshuMingGroupsFromVerifiedLimits, quanshuSupportCondition, quanshuSupportPolicy } from '../ziwei-source-support';
import { bindQuanshuYearScopes, quanshuDoujunCondition, quanshuKuXuCondition, quanshuShangShiCondition, quanshuYearPolicy } from '../ziwei-source-year';
import { buildQuanshuDoujunMonths, quanshuDoujunMonthPolicy } from '../ziwei-doujun-months';
import { quanshuFireBellCondition, quanshuFireBellPolicy } from '../ziwei-firebell';
import { quanshuBodyLimitCondition, quanshuBodyLimitPolicy } from '../ziwei-body-limits';
import { quanshuHorseVoidCondition, quanshuHorseVoidPolicy } from '../ziwei-horse-voids';
import { quanshuTigerCondition, quanshuTigerPolicy } from '../ziwei-tiger-layers';
import { quanshuYangTabooCondition, quanshuYangTabooPolicy } from '../ziwei-yang-taboos';
import { quanshuKillerEcho, quanshuKillerEchoPolicy } from '../ziwei-killer-echo';
import { quanshuLateZiStart, quanshuLimitChapter, quanshuLimitChapterPolicy } from '../ziwei-limit-chapter';
import { quanshuTransformLimits, quanshuTransformLimitPolicy } from '../ziwei-transform-limits';
import { quanshuLimitCombinations, quanshuLimitCombinationPolicy } from '../ziwei-limit-combinations';
import { quanshuAnnualSha, quanshuAnnualShaPolicy } from '../ziwei-annual-sha';
import { quanshuLiteraryLimits, quanshuLiteraryLimitsPolicy } from '../ziwei-literary-limits';
import { quanshuLimitBranches, quanshuLimitBranchesPolicy } from '../ziwei-limit-branches';
import { quanshuLimitTiming, quanshuLimitTimingPolicy } from '../ziwei-limit-timing';
import { quanshuTimedBody, quanshuTimedLianzhen, quanshuTimedLimitFactType, quanshuTimedPo, quanshuTimedSupport, quanshuTimedTianji,
  quanshuTimedBell, quanshuTimedTempleChangQu, quanshuTimedTong, quanshuTimedWu } from '../ziwei-timed-limit-conditions';
import { quanshuYearAndLimits, quanshuYearAndLimitsPolicy } from '../ziwei-year-and-limits';
import { quanshuLimitVerseContacts, quanshuLimitVerseContactPolicy } from '../ziwei-limit-verse-contacts';
import { quanshuSolarWuPoLimits, quanshuSolarWuPoPolicy } from '../ziwei-solar-wu-po-limits';
import { quanshuXingJiTiger, quanshuXingJiTigerPolicy } from '../ziwei-xing-ji-tiger';
import { quanshuYearEncounters, quanshuYearEncountersPolicy } from '../ziwei-year-encounters';
import { quanshuBodyLimitEncounters, quanshuBodyLimitEncounterPolicy } from '../ziwei-body-limit-encounters';
import { quanshuShangShiLimits, quanshuShangShiLimitPolicy } from '../ziwei-shangshi-limits';
import type { AuthorizedFortuneInput } from '../../model/fortune-facts';
import { factPolicies, type Writer, type Context, type Status } from './context';
export function ziweiFacts(writer: Writer, time: Context, reference?: AuthorizedFortuneInput): Status {
  const result = buildZiweiFactWindow(time.window, time.displayWindow.periodType, reference?.chart);
  const candidates = 'candidates' in result ? result.candidates : undefined;
  const nativeWindow = { config: result.config, policy: factPolicies.ziwei,
    segments: Object.fromEntries(Object.entries(result.segments).map(([scope, items]) =>
      [scope, items.map(({ start, end, ...rest }) => ({ ...rest, ...utcRange(start, end) }))])),
    decadalByCandidate: candidates?.flatMap(candidate => candidate.status === 'ready'
      ? [{ candidateId: candidate.candidateId, intervals: candidate.scopes.filter(item => item.scope === 'decadal')
        .map(item => ({ ...utcRange(item.start, item.end), palaceIndex: item.output.index })) }] : []) };
  if (!candidates) return { status: result.status === 'missing' ? 'unavailable' : 'not_supported',
    nativeWindow, warnings: [result.status === 'missing' ? '缺少紫微本命盘' : '紫微版本不兼容'] };
  let incomplete = false;
  const profileWarnings = new Set<string>();
  const yearOpenings = new Map<number, ReturnType<typeof buildZiweiFactWindow>>();
  const yunCaseWindow = time.displayWindow.periodType === 'month' ? yunSunJiCaseWindow() : undefined;
  const yunCaseComparison = yunCaseWindow && time.window.start < yunCaseWindow.end && yunCaseWindow.start < time.window.end
    ? buildZiweiFactWindow(yunCaseWindow, 'year', reference?.chart) : undefined;
  for (const candidate of candidates) {
    if (candidate.status !== 'ready') { incomplete = true; continue; }
    const basis = 'ziwei:candidate:' + candidate.candidateId;
    const natal = reference!.chart!.ziwei.rawResult[candidate.candidateId];
    const raw = writer.raw({ natal: reference?.chart?.ziwei.rawResult[candidate.candidateId], config: result.config });
    const displayPeriod = time.displayWindow.periodType;
    const canBindLimitHalves = reference?.chart?.timeKnown === true && candidates.length === 1 && displayPeriod === 'year';
    const doujunMonths = buildQuanshuDoujunMonths(time.window, natal);
    if (displayPeriod === 'month') {
      for (const row of doujunMonths) {
        const source = writer.raw({ policy: quanshuDoujunMonthPolicy, calculation: row });
        writer.add(row, { scope: 'monthly', factType: 'quanshu_doujun_month',
          subjectIds: row.data.ready ? [basis, 'palace:' + row.data.palaceIndex] : [basis],
          completeness: row.data.ready ? 'complete' : 'partial', normalizedPayload: row.data }, source, raw);
        if (!row.data.ready) {
          incomplete = true;
          profileWarnings.add('《全书》斗君月段的闰月取法或本命依据未核实');
        }
      }
    }
    for (const item of candidate.natalTransformations) writer.add(time.window, {
      scope: 'natal', factType: 'transformation', subjectIds: [basis, item.star],
      normalizedPayload: { ...item, transformationTableVersion: result.natalRules },
    }, raw);
    for (const item of candidate.scopes) {
      const { output, scope } = item;
      const source = writer.raw(item);
      if (scope === 'yearly') {
        const context = quanshuAnnualContext(natal, item.lunarYear, output.heavenlyStem);
        writer.add(item, { scope, factType: 'quanshu_annual_context', subjectIds: [basis],
          completeness: context.ready ? 'complete' : 'partial', normalizedPayload: context,
        }, source, raw);
        if (!context.ready) {
          incomplete = true;
          profileWarnings.add('《全书》本命布宫或禄羊陀依据不一致，未作为确定事实');
        }
      }
      if (scope === 'decadal') {
        const phase = quanshuLimitPhase(natal, output.index, item.age, item.start);
        if (!phase.ready) incomplete = true;
        writer.add(item, { scope, factType: 'quanshu_limit_phase', subjectIds: [basis],
          completeness: phase.ready ? 'complete' : 'partial', normalizedPayload: phase,
        }, source, raw);
      }
      if (scope === 'decadal' || scope === 'minor') {
        const condition = quanshuTianxingCondition(natal, output.index);
        writer.add(item, { scope, factType: 'quanshu_tianxing_condition', subjectIds: [basis, 'palace:' + output.index],
          completeness: condition.ready ? 'complete' : 'partial', normalizedPayload: condition }, source, raw);
        if (!condition.ready) {
          incomplete = true;
          profileWarnings.add('《全书》天刑生月安星或本命依据未核实，未作为确定二限条件');
        }
      }
      const palaceCompleteness = output.palaces.length === 12 && output.index >= 0
        && (scope !== 'monthly' || item.monthPart !== undefined)
        && output.palaces.every(palace => palace.flowName) ? 'complete' : 'partial';
      if (palaceCompleteness === 'partial') incomplete = true;
      writer.add(item, { scope, factType: 'time_segment', subjectIds: [basis], completeness: palaceCompleteness,
        normalizedPayload: { date: item.date, lunarYear: item.lunarYear, lunarMonth: item.lunarMonth,
          lunarDay: item.lunarDay, leap: item.leap, monthPart: item.monthPart, dayRange: item.dayRange,
          boundary: item.boundary, nominalAge: item.age, lifePalaceIndex: output.index,
          stem: output.heavenlyStem, branch: output.earthlyBranch, timeZone: 'Asia/Shanghai' },
      }, source);
      for (const palace of output.palaces) {
        const condition = quanshuPalaceCondition(natal, palace.index, palace.flowName);
        writer.add(item, { scope, factType: 'quanshu_palace_condition', subjectIds: [basis, 'palace:' + palace.index],
          completeness: condition.ready && !condition.unlocatedTransformationStars?.length ? palaceCompleteness : 'partial',
          normalizedPayload: condition }, source, raw);
        writer.add(item, {
          scope, factType: 'palace_condition', subjectIds: [basis, 'palace:' + palace.index],
          completeness: palaceCompleteness,
          normalizedPayload: ziweiPalaceConditions(palace, output.palaces, output.transformations),
        }, source, raw);
        writer.add(item, {
          scope, factType: 'palace_mapping', subjectIds: [basis, 'palace:' + palace.index],
          completeness: palaceCompleteness, normalizedPayload: palace,
        }, source, raw);
        const area = [palace.index, palace.oppositeIndex, ...palace.triadIndices];
        writer.add(item, {
          scope, factType: 'palace_star_structure', subjectIds: [basis, 'palace:' + palace.index],
          completeness: palaceCompleteness,
          normalizedPayload: { index: palace.index, flowName: palace.flowName, natalName: palace.natalName,
            stars: palace.natalStars, movingStarIds: palace.movingStarIds ?? [],
            surrounding: output.palaces.filter(p => area.includes(p.index)).map(p =>
              ({ index: p.index, natalName: p.natalName, flowName: p.flowName, stars: p.natalStars,
                movingStarIds: p.movingStarIds ?? [] })),
            transformations: output.transformations.filter(t => t.natalPalaceIndices.some(index => area.includes(index))),
            tableVersion: result.natalRules, transformationStem: output.heavenlyStem,
            calendarPolicy: factPolicies.ziwei.boundary },
        }, source, raw);
      }
      for (const transformation of output.transformations) writer.add(item, {
        scope, factType: 'transformation', subjectIds: [basis, transformation.star],
        completeness: transformation.natalPalaceIndices.length ? palaceCompleteness : 'partial',
        normalizedPayload: { ...transformation, transformationTableVersion: result.natalRules,
          sourcePalaceStem: output.heavenlyStem,
          placements: output.palaces.filter(palace => transformation.natalPalaceIndices.includes(palace.index)) },
      }, source, raw);
    }
    // A decade may be merged across Lunar New Year by the native limit layer.
    // Annual flying stars must instead bind to each intersecting lunar year.
    for (const item of candidate.scopes.filter(s => ['decadal', 'minor', 'yearly'].includes(s.scope))) {
      for (const year of candidate.scopes.filter(s => s.scope === 'yearly')) {
        const start = Math.max(item.start, year.start), end = Math.min(item.end, year.end);
        if (start >= end) continue;
        const condition = quanshuKongJieCondition(natal, item.output.index, year.lunarYear);
        const source = writer.raw({ policy: quanshuKongJiePolicy, limit: item, annual: year, calculation: condition });
        writer.add({ start, end }, { scope: item.scope, factType: 'quanshu_kongjie_condition',
          subjectIds: [basis, 'palace:' + item.output.index],
          completeness: condition.ready ? 'complete' : 'partial', normalizedPayload: condition }, source, raw);
        if (!condition.ready) {
          incomplete = true;
          profileWarnings.add('《全书》空劫时支重算与归档位置未核实，不以现代同名天空代替');
        }
      }
    }
    const timedSupportInputs: { interval: ReturnType<typeof bindQuanshuSupportScopes>[number];
      condition: ReturnType<typeof quanshuSupportCondition>; scope: 'decadal' | 'minor'; source: string }[] = [];
    for (const interval of bindQuanshuSupportScopes(candidate.scopes)) {
      const condition = quanshuSupportCondition(natal, interval.focus.output.index, interval.year.output.index,
        interval.year.lunarYear, interval.focus.scope as 'decadal' | 'minor' | 'yearly', interval.other?.output.index);
      const source = writer.raw({ policy: quanshuSupportPolicy, interval, calculation: condition });
      writer.add(interval, { scope: interval.focus.scope as 'decadal' | 'minor' | 'yearly', factType: 'quanshu_support_condition',
        subjectIds: [basis, 'palace:' + interval.focus.output.index], completeness: condition.ready ? 'complete' : 'partial',
        normalizedPayload: condition }, source, raw);
      const { scope } = interval.focus;
      if (canBindLimitHalves && (scope === 'decadal' || scope === 'minor')) timedSupportInputs.push({ interval, condition, scope, source });
      if (!condition.ready) {
        incomplete = true;
        profileWarnings.add('《全书》昌曲辅弼或岁限共同依据未核，不借默认星位作为确定扶救');
      }
    }
    const sourceYearIntervals = bindQuanshuYearScopes(candidate.scopes);
    for (const interval of sourceYearIntervals) {
      const args = [natal, interval.focus.output.index, interval.year.output.index, interval.year.lunarYear,
        interval.focus.scope as 'decadal' | 'minor' | 'yearly', interval.decadal?.output.index, interval.minor?.output.index] as const;
      for (const [factType, calculate] of [
        ['quanshu_doujun_context', quanshuDoujunCondition], ['quanshu_kuxu_condition', quanshuKuXuCondition],
        ['quanshu_shangshi_condition', quanshuShangShiCondition],
        ['quanshu_firebell_context', quanshuFireBellCondition],
        ['quanshu_body_limit_context', quanshuBodyLimitCondition],
        ['quanshu_horse_void_context', quanshuHorseVoidCondition],
        ['quanshu_tiger_layer_context', quanshuTigerCondition],
        ['quanshu_yang_taboo_context', quanshuYangTabooCondition],
      ] as const) {
        const condition = (factType === 'quanshu_firebell_context' || factType === 'quanshu_horse_void_context') && interval.focus.scope === 'yearly'
          ? calculate(...args, interval.year.output.palaces)
          : calculate(...args);
        const yearStart = 'yearStart' in condition ? condition.yearStart : undefined;
        const queryIncludesNewYear = yearStart ? time.window.start <= Date.parse(yearStart) && Date.parse(yearStart) < time.window.end : undefined;
        const monthTimeline = yearStart && displayPeriod === 'year' && interval.focus.scope === 'yearly'
          ? doujunMonths.flatMap(month => {
            const start = Math.max(month.start, interval.start), end = Math.min(month.end, interval.end);
            if (start >= end || month.data.lunarYear !== interval.year.lunarYear) return [];
            const { lunarMonth, leap, ready } = month.data;
            return [{ ...utcRange(start, end), lunarMonth, leap, ready,
              ...(month.data.ready ? { branch: month.data.branch, natalName: month.data.natalName } : {}) }];
          }) : undefined;
        const source = writer.raw({ policy: factType === 'quanshu_firebell_context' ? quanshuFireBellPolicy
          : factType === 'quanshu_body_limit_context' ? quanshuBodyLimitPolicy
          : factType === 'quanshu_horse_void_context' ? quanshuHorseVoidPolicy
          : factType === 'quanshu_tiger_layer_context' ? quanshuTigerPolicy
          : factType === 'quanshu_yang_taboo_context' ? quanshuYangTabooPolicy : quanshuYearPolicy, interval, calculation: condition, monthTimeline });
        writer.add(interval, { scope: interval.focus.scope as 'decadal' | 'minor' | 'yearly', factType,
          subjectIds: [basis, 'palace:' + interval.focus.output.index], completeness: condition.ready ? 'complete' : 'partial',
          normalizedPayload: { ...condition, ...(yearStart ? { queryIncludesNewYear, monthTimeline } : {}) } }, source, raw);
        if (!condition.ready) {
          incomplete = true;
          profileWarnings.add(factType === 'quanshu_yang_taboo_context' ? '《全书》擎羊与本生忌候选的共同依据未核，不据宫名补造全盘强弱'
            : factType === 'quanshu_tiger_layer_context' ? '《全书》白虎与岁限共同依据未核，不跨层补作加临条件'
            : factType === 'quanshu_horse_void_context' ? '《全书》本命天马或岁限共同依据未核，不用任意空星补作来源条件'
            : factType === 'quanshu_body_limit_context' ? '《全书》身命独立定位或岁限共同依据未核，不作为确定来源条件'
            : '《全书》斗君、哭虚、伤使或火铃的本条依据未核，不作为确定来源条件');
        }
      }
    }
    const productDays = candidate.scopes.filter(item => item.scope === 'daily');
    for (const interval of sourceYearIntervals.filter(item => item.focus.scope === 'yearly')) {
      const frame = { lunarYear: interval.year.lunarYear, age: interval.year.age, yearIndex: interval.year.output.index,
        decadalIndex: interval.decadal?.output.index, minorIndex: interval.minor?.output.index, windowEnd: time.window.end };
      const writeChapter = (start: number, end: number, scope: 'yearly' | 'daily', monthIndex?: number, dayIndex?: number) => {
        const anchors = { ...frame, at: start, monthIndex, dayIndex, dayEnd: scope === 'daily' ? end : undefined };
        const condition = quanshuLimitChapter(natal, anchors);
        const source = writer.raw({ policy: quanshuLimitChapterPolicy, anchors, start, end });
        if (!condition.ready) {
          writer.add({ start, end }, { scope, factType: 'quanshu_limit_chapter', subjectIds: [basis],
            completeness: 'partial', normalizedPayload: condition }, source, raw);
          return;
        }
        const { jielanHourlyWitnesses, ...normalizedPayload } = condition;
        writer.add({ start, end }, { scope, factType: 'quanshu_limit_chapter', subjectIds: [basis],
          normalizedPayload }, source, raw);
        for (const { start, end, ...jielanHourWitness } of jielanHourlyWitnesses) {
          writer.add({ start, end }, { scope, factType: 'quanshu_limit_chapter', subjectIds: [basis],
            normalizedPayload: { ready: true, profile: condition.profile, lunarYear: condition.lunarYear,
              starPlacementProof: condition.starPlacementProof, limitPlacementProof: condition.limitPlacementProof,
              jielanHourVerified: true, jielanHourProfile: quanshuLimitChapterPolicy.jielanHour, jielanHourWitness,
            } }, source, raw);
        }
        if (scope === 'yearly' && end - start >= 1_000 && Date.parse(condition.stageEnd ?? '') === end
          && (condition.exitNamedGuards === true || condition.exitMingFewNamedSupportsCandidate === true
            || condition.exitMingFourHelpersCandidate === true)) {
          writer.add({ start: end - 1_000, end }, {
            scope, factType: 'quanshu_limit_chapter', subjectIds: [basis],
            normalizedPayload: { ...normalizedPayload,
              exitVerifiedNamedSupportAtBoundary: condition.exitNamedGuards === true || undefined,
              exitVerifiedFewNamedSupportsAtBoundary: condition.exitMingFewNamedSupportsCandidate === true || undefined,
              exitVerifiedMingFourHelpersAtBoundary: condition.exitMingFourHelpersCandidate === true || undefined },
          }, source, raw);
        }
      };
      if (displayPeriod === 'year') {
        writeChapter(interval.start, interval.end, 'yearly');
        const yearOutput = interval.year.output;
        const annual = quanshuAnnualContext(natal, frame.lunarYear, yearOutput.heavenlyStem);
        const migration = yearOutput.palaces.filter(row => row.flowName === '迁移');
        const limitBranches = quanshuLimitBranches(natal, frame);
        const annualSha = quanshuAnnualSha(natal, annual, yearOutput.earthlyBranch, migration.length === 1 ? migration[0].branch : undefined, limitBranches);
        const echo = quanshuKillerEcho(natal, annual, yearOutput.earthlyBranch, frame);
        if (!echo.ready) {
          incomplete = true;
          profileWarnings.add('《全书》七杀重逢所需的本命七杀或生年、流年宫位未核实');
        }
        const transformations = quanshuTransformLimits(natal, frame);
        const yearAndLimits = reference?.chart?.timeKnown === true && candidates.length === 1
          ? quanshuYearAndLimits(natal, limitBranches, annual) : { ready: false } as const;
        const encounters = quanshuYearEncounters(natal, limitBranches, interval, doujunMonths, firstInstant => {
          let opening = yearOpenings.get(firstInstant);
          if (!opening) {
            opening = buildZiweiFactWindow({ start: firstInstant, end: firstInstant + 1 }, 'year', reference?.chart);
            yearOpenings.set(firstInstant, opening);
          }
          const source = 'candidates' in opening ? opening.candidates?.find(row => row.candidateId === candidate.candidateId) : undefined;
          if (source?.status !== 'ready') return undefined;
          const annual = source.scopes.find(row => row.scope === 'yearly');
          if (!annual) return undefined;
          return { lunarYear: annual.lunarYear, annualBranch: annual.output.earthlyBranch,
            decadalBranch: source.scopes.find(row => row.scope === 'decadal')?.output.earthlyBranch,
            minorBranch: source.scopes.find(row => row.scope === 'minor')?.output.earthlyBranch };
        }, reference?.chart?.timeKnown === true && candidates.length === 1);
        const { monthlyReviews, ...yearEncounters } = encounters.ready ? encounters : { ...encounters, monthlyReviews: [] };
        const verse = quanshuLimitVerseContacts(limitBranches);
        const solarWuPo = quanshuSolarWuPoLimits(limitBranches, transformations);
        const xingJiTiger = quanshuXingJiTiger(natal, frame.yearIndex, limitBranches);
        const bodyLimits = quanshuBodyLimitEncounters(natal, frame.yearIndex, limitBranches);
        const annualSources = new Map<string, string>();
        for (const [factType, policy, condition] of [
          ['quanshu_killer_echo', quanshuKillerEchoPolicy, echo],
          ['quanshu_annual_sha', quanshuAnnualShaPolicy, annualSha],
          ['quanshu_transform_limits', quanshuTransformLimitPolicy, transformations],
          ['quanshu_limit_combinations', quanshuLimitCombinationPolicy, quanshuLimitCombinations(natal, frame)],
          ['quanshu_literary_limits', quanshuLiteraryLimitsPolicy, quanshuLiteraryLimits(natal, transformations, interval.year.output.palaces)],
          ['quanshu_limit_branches', quanshuLimitBranchesPolicy, limitBranches],
          ['quanshu_year_and_limits', quanshuYearAndLimitsPolicy, yearAndLimits],
          ['quanshu_shangshi_limits', quanshuShangShiLimitPolicy, quanshuShangShiLimits(limitBranches)],
          ['quanshu_kongjie_limits', quanshuKongJieLimitPolicy, quanshuKongJieLimits(natal, limitBranches)],
          ['quanshu_limit_verse_contacts', quanshuLimitVerseContactPolicy, verse],
          ['quanshu_solar_wu_po_limits', quanshuSolarWuPoPolicy, solarWuPo],
          ['quanshu_xing_ji_tiger', quanshuXingJiTigerPolicy, xingJiTiger],
          ['quanshu_body_limit_encounters', quanshuBodyLimitEncounterPolicy, bodyLimits],
        ] as const) {
          const source = writer.raw({ policy, interval });
          if (canBindLimitHalves) annualSources.set(factType, source);
          writer.add(interval, { scope: 'yearly', factType, subjectIds: [basis],
            completeness: condition.ready ? 'complete' : 'partial', normalizedPayload: condition }, source, raw);
        }
        if (canBindLimitHalves) {
          const missingSupport = timedSupportInputs.some(row => !row.condition.ready
            && row.interval.year.lunarYear === interval.year.lunarYear);
          const independentSupport = missingSupport && limitBranches.ready ? quanshuMingGroupsFromVerifiedLimits(limitBranches) : undefined;
          for (const timing of quanshuLimitTiming(natal, limitBranches, interval, frame)) {
            const source = writer.raw({ policy: quanshuLimitTimingPolicy, interval, frame, calculation: timing });
            writer.add(timing, { scope: 'yearly', factType: 'quanshu_limit_star_timing', subjectIds: [basis],
              normalizedPayload: timing.data }, source, raw);
            const annualConditions = [
              ...(solarWuPo.ready ? [quanshuTimedWu(timing.data, solarWuPo), quanshuTimedPo(timing.data, solarWuPo)] : []),
              ...(bodyLimits.ready ? quanshuTimedBody(timing.data, bodyLimits) : []),
              ...(verse.ready ? [quanshuTimedTong(timing.data, verse), quanshuTimedBell(timing.data, verse)] : []),
              quanshuTimedLianzhen(timing.data, xingJiTiger),
              quanshuTimedTianji(timing.data, transformations),
            ];
            for (const normalizedPayload of annualConditions) {
              writer.add(timing, { scope: 'yearly', factType: quanshuTimedLimitFactType, subjectIds: [basis],
                normalizedPayload }, source, annualSources.get(normalizedPayload.sourceFactType)!, raw);
            }
            if (limitBranches.ready) {
              for (const normalizedPayload of quanshuTimedTempleChangQu(timing.data, limitBranches)) {
                writer.add(timing, { scope: 'yearly', factType: 'quanshu_limit_branches', subjectIds: [basis],
                  normalizedPayload }, source, annualSources.get(normalizedPayload.sourceFactType)!, raw);
              }
            }
            for (const row of timedSupportInputs) {
              if (row.interval.year.lunarYear !== timing.data.lunarYear) continue;
              const start = Math.max(timing.start, row.interval.start), end = Math.min(timing.end, row.interval.end);
              if (start >= end) continue;
              const { index } = row.interval.focus.output;
              const palace = natal.palaces.find(palace => palace.index === index);
              if (!palace) continue;
              for (const normalizedPayload of quanshuTimedSupport(timing.data, row.condition, row.scope, palace.earthlyBranch, independentSupport)) {
                writer.add({ start, end }, { scope: row.scope, factType: quanshuTimedLimitFactType,
                  subjectIds: [basis, 'palace:' + index], normalizedPayload }, source, row.source, raw);
              }
            }
          }
        }
        const yearSource = writer.raw({ policy: quanshuYearEncountersPolicy, interval });
        writer.add(interval, { scope: 'yearly', factType: 'quanshu_year_encounters', subjectIds: [basis],
          completeness: yearEncounters.ready ? 'complete' : 'partial', normalizedPayload: yearEncounters }, yearSource, raw);
        for (const month of monthlyReviews) {
          const source = writer.raw({ profile: quanshuYearEncountersPolicy.monthReview, lunarMonth: month.data.lunarMonth,
            nativeStart: month.data.nativeStart, nativeEnd: month.data.nativeEnd, branch: month.data.branch });
          writer.add(month, { scope: 'monthly', factType: 'quanshu_doujun_year_month',
            subjectIds: [basis, 'palace:' + month.data.palaceIndex], normalizedPayload: month.data }, source, yearSource, raw);
        }
      }
      for (const day of productDays) for (const month of doujunMonths) {
        if (month.data.lunarYear !== interval.year.lunarYear || day.lunarYear !== interval.year.lunarYear) continue;
        const start = Math.max(interval.start, day.start, month.start), end = Math.min(interval.end, day.end, month.end);
        if (start >= end) continue;
        const monthIndex = month.data.ready ? month.data.palaceIndex : undefined;
        const lateZi = quanshuLateZiStart(start);
        if (monthIndex !== undefined && start < lateZi && lateZi < end) {
          writeChapter(start, lateZi, 'daily', monthIndex, day.output.index);
          writeChapter(lateZi, end, 'daily', monthIndex, day.output.index);
        } else writeChapter(start, end, 'daily', monthIndex, day.output.index);
      }
    }
    const activeScopes = candidate.scopes;
    for (let i = 0; i < activeScopes.length; i += 1) {
      const first = activeScopes[i];
      for (const second of activeScopes.slice(i + 1)) {
        const start = Math.max(first.start, second.start);
        const end = Math.min(first.end, second.end);
        if (start >= end || first.scope === second.scope) continue;
        const source = writer.raw({ first, second });
        writer.add({ start, end }, { scope: first.scope, factType: 'layer_overlap', subjectIds: [basis],
          normalizedPayload: {
            firstScope: first.scope, secondScope: second.scope,
            firstIndex: first.output.index, secondIndex: second.output.index,
            samePalace: first.output.index === second.output.index,
            opposite: (first.output.index + 6) % 12 === second.output.index,
            firstOnSecond: second.output.palaces.find(p => p.index === first.output.index)?.flowName,
            secondOnFirst: first.output.palaces.find(p => p.index === second.output.index)?.flowName,
          },
        }, source, raw);
      }
    }
    const yunDecades = (scopes: typeof candidate.scopes) => scopes.filter(item => item.scope === 'decadal')
      .map(item => ({ start: item.start, end: item.end, stem: item.output.heavenlyStem, branch: item.output.earthlyBranch }));
    const yun = buildYunZiweiWindow(time.window, time.displayWindow.periodType, natal, yunDecades(candidate.scopes));
    const yunCaseCandidate = yunCaseComparison && 'candidates' in yunCaseComparison
      ? yunCaseComparison.candidates.find(item => item.candidateId === candidate.candidateId) : undefined;
    const yunCaseEvidence = yunCaseWindow && yunCaseCandidate?.status === 'ready'
      ? yunSunJiCaseEvidence(buildYunZiweiWindow(yunCaseWindow, 'month', natal, yunDecades(yunCaseCandidate.scopes)).rows, yunCaseWindow)
      : undefined;
    yun.warnings.forEach(warning => profileWarnings.add(warning));
    if (yun.status !== 'ready') incomplete = true;
    for (const row of yun.rows) {
      const { palaces, contacts, financeMonthEnd, start: _start, end: _end, ...common } = row;
      const nominalLeapBirth = row.birthMonthBasis === 'nominal-intercalary-month';
      const sourceCase = !nominalLeapBirth && yunCaseWindow && row.scope === 'monthly'
        && row.lunarYear === yunCaseWindow.lunarYear && row.lunarMonth === 9;
      const pairedSunJi = sourceCase ? yunCaseEvidence : undefined;
      const source = writer.raw({ policy: yunZiweiPolicy, calculation: row, sunJiNinthPair: pairedSunJi });
      const timeEvidence = row.scope === 'monthly' ? { ...common, sunJiNinthPairVerified: Boolean(pairedSunJi), sunJiNinthPair: pairedSunJi } : common;
      if (!nominalLeapBirth) writer.add(row, { scope: row.scope, factType: 'yun_time_segment', subjectIds: [basis], normalizedPayload: timeEvidence }, source, raw);
      const verifiedMonth = financeMonthEnd !== undefined && row.start < financeMonthEnd
        ? { start: row.start, end: Math.min(row.end, financeMonthEnd) } : undefined;
      if (verifiedMonth) {
        for (const area of yunMonthlyFinanceAreas(row)) writer.add(verifiedMonth, {
          scope: 'monthly', factType: 'yun_month_finance_area', subjectIds: [basis, 'branch:' + area.branch, area.area],
          normalizedPayload: { profile: row.profile, ...area },
        }, source, raw);
        if (pairedSunJi) writer.add(verifiedMonth, { scope: 'monthly', factType: 'yun_sun_ji_pair',
          subjectIds: [basis, '太阳', 'branch:' + pairedSunJi.yearLifeBranch],
          normalizedPayload: { ...timeEvidence, sunJiOccurrenceCount: pairedSunJi.occurrenceCount },
        }, source, raw);
      }
      if (!nominalLeapBirth) {
        for (const reading of yunDailyReadings(row)) writer.add(row, { scope: 'daily', factType: 'yun_daily_reading',
          subjectIds: [basis, 'palace:' + reading.palaceIndex, ...new Set(reading.receivingContacts.map(contact => contact.star))],
          normalizedPayload: { ...common, ...reading } }, source, raw);
        for (const palace of palaces) writer.add(row, { scope: row.scope, factType: 'yun_palace_condition',
          subjectIds: [basis, 'palace:' + palace.palaceIndex], normalizedPayload: { ...common, ...palace } }, source, raw);
      }
      for (const { monthlyFinanceSupport, monthlyPropertyContact, ...contact } of contacts) {
        const subjectIds = [basis, contact.star, 'palace:' + contact.palaceIndex];
        const normalizedPayload = { ...common, ...contact };
        if (!nominalLeapBirth) writer.add(row, { scope: row.scope, factType: 'yun_transformation_contact',
          subjectIds, normalizedPayload }, source, raw);
        if (verifiedMonth && contact.verifiedMajorSeat && contact.flowName === '命宫' && contact.sourceScope === 'yearly') {
          const { branch, natalName, yearlyName, star, kind, sourceScope, sourceStem } = contact;
          writer.add(verifiedMonth, { scope: 'monthly', factType: 'yun_month_annual_major_contact',
            subjectIds, normalizedPayload: { profile: row.profile, tableVersion: row.tableVersion,
              branch, natalName, yearlyName, star, kind, sourceScope, sourceStem } }, source, raw);
        }
        if (verifiedMonth && contact.verifiedMajorSeat && contact.flowName === '命宫' && contact.intrinsicWealthStar
          && ['yearly', 'minor'].includes(contact.sourceScope)) {
          const { branch, natalName, yearlyName, star, kind, sourceScope, sourceStem, atWealth, atProperty } = contact;
          writer.add(verifiedMonth, { scope: 'monthly', factType: 'yun_month_wealth_star_contact', subjectIds,
            normalizedPayload: { profile: row.profile, tableVersion: row.tableVersion, branch, natalName, yearlyName,
              star, kind, sourceScope, sourceStem, atWealth, atProperty } }, source, raw);
        }
        if (verifiedMonth && contact.verifiedMajorSeat && contact.verifiedDiJieAtSeat && contact.flowName === '命宫'
          && contact.kind === '忌' && (contact.sourceScope === 'yearly' || contact.sourceScope === 'minor')) {
          const { branch, natalName, yearlyName, star, sourceScope, sourceStem, atWealth, atProperty } = contact;
          writer.add(verifiedMonth, { scope: 'monthly', factType: 'yun_month_di_jie_contact', subjectIds,
            normalizedPayload: { profile: row.profile, tableVersion: row.tableVersion, branch, natalName, yearlyName,
              star, sourceScope, sourceStem, atWealth, atProperty } }, source, raw);
        }
        if (!nominalLeapBirth && monthlyFinanceSupport && verifiedMonth) {
          writer.add(verifiedMonth, { scope: 'monthly', factType: 'yun_month_finance_support',
            subjectIds, normalizedPayload: { ...normalizedPayload, monthlyFinanceSupport,
              monthlyFinanceSupportCount: monthlyFinanceSupport.length } }, source, raw);
        }
        if (verifiedMonth && monthlyPropertyContact && (!nominalLeapBirth || monthlyPropertyContact.propertyReading === 'upper-taboo')) {
          const { branch, natalName, yearlyName, monthlyName, star, kind, sourceScope, sourceStem } = contact;
          writer.add(verifiedMonth, { scope: 'monthly', factType: 'yun_month_property_contact', subjectIds,
            normalizedPayload: { profile: row.profile, branch, natalName, yearlyName, monthlyName, star, kind, sourceScope,
              sourceStem, ...monthlyPropertyContact, ...(row.birthMonthLayerProof && { birthMonthLayerProof: row.birthMonthLayerProof }) } }, source, raw);
        }
      }
    }
    const ling = buildLingZiweiWindow(time.window, time.displayWindow.periodType, natal,
      candidate.scopes.filter(item => item.scope === 'decadal')
        .map(item => ({ start: item.start, end: item.end, stem: item.output.heavenlyStem, branch: item.output.earthlyBranch })));
    ling.warnings.forEach(warning => profileWarnings.add('令东来口径：' + warning));
    if (ling.status !== 'ready') incomplete = true;
    for (const row of ling.rows) {
      const source = writer.raw({ policy: lingZiweiPolicy, calculation: row });
      const common = { profile: row.profile, tableVersion: row.tableVersion, ready: row.ready,
        calendarReady: row.calendarReady, sourceStem: row.sourceStem,
        lifeBranch: row.lifeBranch, lunarYear: row.lunarYear, lunarMonth: row.lunarMonth, lunarDay: row.lunarDay,
        sourceDayAgreed: row.sourceDayAgreed };
      const completeness = row.ready ? 'complete' : 'partial';
      writer.add(row, { scope: row.scope, factType: 'ling_time_segment', subjectIds: [basis],
        completeness: row.monthJie ? 'complete' : completeness,
        warnings: row.reason ? [row.reason] : [], normalizedPayload: { ...common, boundary: lingZiweiPolicy.dayBoundary,
          monthPolicy: lingZiweiPolicy.monthBoundary, lifePalaceIndex: row.palaces.find(p => p.flowName === '命宫')?.palaceIndex,
          lunarMonthIsLeap: row.lunarMonthIsLeap, monthJie: row.monthJie, samePalaceJieChangedStem: Boolean(row.monthJie),
          transformationCount: row.contacts.filter(contact => contact.sourceScope === row.scope).length } }, source, raw);
      for (const palace of row.palaces) {
        const areaBranches = [palace.branch, ...[4, 6, 8].map(distance => '子丑寅卯辰巳午未申酉戌亥'[
          ('子丑寅卯辰巳午未申酉戌亥'.indexOf(palace.branch) + distance) % 12])];
        const contacts = row.contacts.filter(contact => contact.placements.some(p => p.palaceIndex === palace.palaceIndex));
        const surrounding = row.palaces.filter(p => areaBranches.includes(p.branch));
        const lifeConditions = palace.flowName === '命宫' ? row.lifeConditions : undefined;
        const verifiedLiteraryPair = lifeConditions && 'yearLifeLiteraryPairVerified' in lifeConditions
          && (lifeConditions.yearLifeLiteraryPairVerified || lifeConditions.yearLifeExamStructureVerified || lifeConditions.yearLifeExamKeWithNoblesVerified);
        const verifiedRomancePair = lifeConditions && (('yearLifeRomancePairVerified' in lifeConditions
          && lifeConditions.yearLifeRomancePairVerified) || ('decadeLifeTaiyinWenchangVerified' in lifeConditions
          && lifeConditions.decadeLifeTaiyinWenchangVerified));
        const verifiedDailyStudy = row.sourceDayAgreed === true && lifeConditions && 'dailyLearningVoidPairAtLife' in lifeConditions
          && lifeConditions.dailyLearningVoidPairAtLife === true;
        writer.add(row, { scope: row.scope, factType: 'ling_palace_condition', subjectIds: [basis, 'palace:' + palace.palaceIndex],
          completeness: verifiedLiteraryPair || verifiedRomancePair || verifiedDailyStudy ? 'complete' : completeness, normalizedPayload: { ...common, ...palace,
            ...lifeConditions,
            localTransformations: contacts.map(contact => contact.sourceScope + ':' + contact.kind + ':' + contact.star),
            surroundingStarNames: [...new Set(surrounding.flatMap(p => p.localStarNames))],
            surroundingTransformationKinds: [...new Set(row.contacts.filter(contact => contact.placements.some(p => areaBranches.includes(p.branch)))
              .map(contact => contact.kind))] } }, source, raw);
      }
      for (const contact of row.contacts) for (const palace of contact.placements) {
        const subjectIds = [basis, contact.star, 'palace:' + palace.palaceIndex];
        const { star, kind, sourceScope, sourceStem } = contact;
        writer.add(row, { scope: row.scope, factType: 'ling_transformation_contact', subjectIds,
          completeness: contact.located ? completeness : 'partial', normalizedPayload: { ...common, ...palace,
            star, kind, sourceScope, sourceStem, located: contact.located,
            inLifeArea: row.lifeAreaBranches.includes(palace.branch) },
        }, source, raw);
        if (contact.verifiedYearlyMajorRecipient) writer.add(row, {
          scope: 'yearly', factType: 'ling_year_major_transformation', subjectIds,
          normalizedPayload: { profile: row.profile, tableVersion: row.tableVersion, lifeBranch: row.lifeBranch,
            lunarYear: row.lunarYear, branch: palace.branch, flowName: palace.flowName, star, kind, sourceScope, sourceStem },
        }, source, raw);
      }
    }
  }
  if (result.status === 'failed') return { status: 'failed', nativeWindow, warnings: ['紫微候选计算失败'] };
  const uncertain = reference?.chart?.timeKnown !== true || candidates.length > 1;
  return { status: incomplete || uncertain ? 'partial' : 'completed', nativeWindow,
    warnings: [...(incomplete ? ['部分流限或来源计算口径不可用'] : []), ...profileWarnings,
      ...(uncertain ? ['候选盘分别保留'] : [])] };
}
