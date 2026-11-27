import { baziInteractions, buildBaZiCalculation, describeBaZiPillar } from '../bazi-calculation';
import { baziLuckConditions, baziNatalConditions } from '../bazi-conditions';
import { baziDailyBranchContext, baziLuckTransitions, baziSourceContext, baziWorkTimingContext, luAnnualDailyTwistCase,
  luAnnualTwistDayRange, luMonthDayTwist } from '../bazi-source-context';
import { baziAnnualLuckContext, baziSmthFoundation, baziSmthTaiSuiContext } from '../bazi-annual-luck';
import { annualRelationNatalClockReady, baziAnnualColumnRelations } from '../bazi-annual-relations';
import { luRootlessDayCase, luRootlessDayRange } from '../bazi-lu-rootless';
import { baziSmthSealHurting } from '../bazi-smth-seal-hurting';
import { baziSmthOfficerMix } from '../bazi-smth-officer-mix';
import { smthHourBlade } from '../bazi-smth-hour-blade';
import { smthDayVirtueMonth, smthDragonBackMonth, smthFireAssemblyMonth, smthTaiSuiClashMonth } from '../bazi-smth-month-cases';
import { baziSchoolContext, baziSchoolPolicy, schoolEntryAge, schoolLuckEntryAges } from '../bazi-school';
import { baziSchoolExamContext } from '../bazi-school-exam';
import { fateClearBranchContext, fateClearJieMonth, fateClearMonthlyExample, fateClearPeriodReading, fateClearSolarBirth,
  repeatedMonthStemTheme } from '../bazi-fateclear';
import { fateClearSolarDays } from '../bazi-apparent-solar-time';
import { baziMinorLuckContext, baziMinorLuckPolicy, minorLuckCalendarAgreement, minorLuckOrdinal, smthMinorLuckAgreement, smthMinorLuckVariants,
  smthMinorMajorLuckHistory } from '../bazi-minor-luck';
import { baziZpqzLuckContext, zpqzRootPairingPolicy, zpqzZhaoAnnualGengCheck, zpqzZhaoAnnualGengDay, zpqzZhaoMemorialDay } from '../bazi-zpqz';
import { baziZpqzMovingRelations } from '../bazi-zpqz-relations';
import { baziZpqzStemOrder } from '../bazi-zpqz-stems';
import { baziZpqzMonthCommand } from '../bazi-zpqz-month';
import { baziZpqzSealFood } from '../bazi-zpqz-seal-food';
import { baziZpqzFoodKiller } from '../bazi-zpqz-food-killer';
import { baziZpqzKillerOrder } from '../bazi-zpqz-killer-order';
import { baziZpqzWealth } from '../bazi-zpqz-wealth';
import { baziZpqzOfficer } from '../bazi-zpqz-officer';
import { utcRange } from '../fact-time-context';
import { fortuneReferenceFields, lunarAtBeijing } from '../fortune-calendar';
import type { AuthorizedFortuneInput } from '../../model/fortune-facts';
import { factPolicies, type Writer, type Context, type Status } from './context';
const baziLayers = { year: ['year'], month: ['year', 'month'],
  week: ['year', 'month', 'day'], day: ['year', 'month', 'day'] } as const;
const baziScope = { year: 'yearly', month: 'monthly', day: 'daily' } as const;
const baziRelation = {
  天干五合: 'stem_combine', 天干四冲: 'stem_clash', 六合: 'branch_combine', 六冲: 'branch_clash',
  相刑: 'branch_punishment', 三刑: 'branch_punishment', 六害: 'branch_harm', 六破: 'branch_break',
  三合: 'three_combinations', 三会: 'three_meetings', 同柱: 'same_pillar',
} as Record<string, string>;


export function baziFacts(writer: Writer, time: Context, reference?: AuthorizedFortuneInput): Status {
  const { window, referenceAt, displayWindow } = time;
  const chart = reference?.chart;
  const result = buildBaZiCalculation(window, referenceAt, chart);
  const layers = baziLayers[displayWindow.periodType];
  const effectiveLayer = layers.at(-1)!;
  const nativeClock = chart?.birthContext;
  const fateClearClock = nativeClock && chart.timeKnown && effectiveLayer !== 'year'
    && Number.isFinite(nativeClock.longitude) && Math.abs(nativeClock.longitude) <= 180 ? nativeClock : undefined;
  const solarDays = effectiveLayer === 'day' && fateClearClock ? fateClearSolarDays(window, fateClearClock.longitude) : [];
  const jieMonths = effectiveLayer === 'month' ? new Map(result.timelines.month.map(interval =>
    [interval.pillar, fateClearJieMonth(interval.start)])) : undefined;
  const cuts = new Set([window.start, window.end]);
  for (const layer of layers) for (const item of result.timelines[layer]) cuts.add(item.start);
  for (const { directions } of result.candidates) for (const direction of directions) {
    for (const stage of direction.stages) if (stage.start > window.start && stage.start < window.end) cuts.add(stage.start);
  }
  const native = result.candidates.map(candidate => {
    const id = writer.raw({ rawChart: candidate.natal, startDirections: candidate.directions });
    const verifiedClock = annualRelationNatalClockReady(candidate.natal, chart?.timeKnown === true);
    const sourceClockReady = nativeClock
      ? annualRelationNatalClockReady(candidate.natal, chart?.timeKnown === true, nativeClock) : verifiedClock;
    const solarNatal = fateClearClock && sourceClockReady
      ? fateClearSolarBirth(candidate.natal.utc, fateClearClock.longitude) : undefined;
    const solarBirthRef = solarNatal && fateClearClock
      ? [writer.raw({ solarNatal, longitude: fateClearClock.longitude })] : [];
    return { candidate, id, solarNatal, solarBirthRef, verifiedClock, sourceClockReady };
  });
  for (const { candidate, id, solarNatal, solarBirthRef } of native) {
    const basis = 'bazi:candidate:' + candidate.candidateId;
    for (const transition of baziLuckTransitions(window, candidate.directions)) writer.add({
      start: transition.at, end: Math.min(window.end, transition.at + 1_000),
    }, { scope: 'decadal', factType: 'luck_transition', subjectIds: [basis, 'decadal'],
      exactInstant: new Date(transition.at).toISOString(), timePrecision: 'second',
      completeness: transition.confirmed ? 'complete' : 'partial',
      warnings: transition.confirmed ? [] : ['正式起运方案未核验，交运仅为候选'],
      normalizedPayload: transition }, id);
    const pillars = candidate.natalPillars.filter(item => item.layer !== 'hour' || chart?.timeKnown);
    const { stemConditions, ...structure } = baziNatalConditions(candidate.natal, chart?.timeKnown === true);
    writer.add(window, { scope: 'natal', factType: 'natal_conditions',
      subjectIds: ['bazi:candidate:' + candidate.candidateId], normalizedPayload: structure }, id);
    for (const stem of stemConditions) writer.add(window, { scope: 'natal', factType: 'stem_condition',
      subjectIds: ['bazi:candidate:' + candidate.candidateId, 'stem:' + stem.stem],
      normalizedPayload: { ...stem, rootPolicy: structure.rootPolicy } }, id);
    writer.add(window, { scope: 'natal', factType: 'natal_structure',
      subjectIds: ['bazi:candidate:' + candidate.candidateId],
      normalizedPayload: { pillars, dayMaster: candidate.natal.day[0],
        roots: pillars.filter(item => item.hiddenStems.some(hidden => hidden.element === pillars.find(p => p.layer === 'day')?.stemElement))
          .map(item => item.layer),
        timeKnown: chart?.timeKnown === true, strength: 'undetermined', usefulElements: 'undetermined' },
    }, id);
    if (solarDays.length && fateClearClock && solarNatal) {
      const natal = solarNatal;
      const direction = natal.year === candidate.natal.year && natal.month === candidate.natal.month
        ? candidate.directions.find(row => row.confirmed) : undefined;
      const calendarCuts = [...result.timelines.year, ...result.timelines.month, ...(direction?.stages ?? [])].map(row => row.start);
      for (const solarDay of solarDays) {
        const start = Math.max(solarDay.start, Date.parse(natal.utc));
        if (start >= solarDay.end) continue;
        const cuts = [...new Set([start, ...calendarCuts.filter(at => start < at && at < solarDay.end), solarDay.end])].sort((a, b) => a - b);
        const apparentDay = utcRange(solarDay.solarStart, solarDay.solarEnd);
        const solarRaw = writer.raw({ apparentDay, solarDate: solarDay.solarDate, pillar: solarDay.pillar });
        for (let index = 1; index < cuts.length; index += 1) {
          const range = { start: cuts[index - 1], end: cuts[index] };
          const year = result.timelines.year.find(row => row.start <= range.start && range.start < row.end)!;
          const month = result.timelines.month.find(row => row.start <= range.start && range.start < row.end)!;
          const stage = direction?.stages.find(row => row.start <= range.start && range.start < row.end);
          const luck = stage?.pillar && direction ? { pillar: stage.pillar.pillar, genderBasis: direction.genderBasis } : undefined;
          const reading = fateClearPeriodReading(natal, year.pillar, month.pillar, luck, solarDay);
          writer.add(range, { scope: 'daily', factType: 'fateclear_bazi_context', subjectIds: [basis, 'flow:day'],
            normalizedPayload: { ...fateClearBranchContext(natal, true, 'day', solarDay.pillar, reading),
              ...reading, apparentDay, solarDate: solarDay.solarDate },
          }, solarRaw, id, ...solarBirthRef);
        }
      }
    }
  }
  const boundaries = [...cuts].sort((a, b) => a - b);
  const segments = [];
  const continuous = new Map<string, { start: number; end: number }>();
  const scope = baziScope[effectiveLayer];
  for (let index = 1; index < boundaries.length; index += 1) {
    const range = { start: boundaries[index - 1], end: boundaries[index] };
    const flows = layers.map(layer => {
      const interval = result.timelines[layer].find(item => item.start <= range.start && range.start < item.end)!;
      return { layer, pillar: interval.pillar, boundary: interval.start === range.start ? interval.boundary : undefined };
    });
    const segment = { ...utcRange(range.start, range.end), flows, baziTimezone: factPolicies.bazi.timeZone,
      displayTimezone: time.displayTimezone,
      boundary: flows.map(flow => flow.boundary).filter(Boolean), policyVersion: factPolicies.bazi.rules };
    segments.push(segment);
    const raw = writer.raw(segment);
    writer.add(range, { scope, factType: 'time_segment', subjectIds: flows.map(item => item.layer),
      normalizedPayload: segment }, raw);
    const year = flows.find(flow => flow.layer === 'year')?.pillar;
    const civilYear = scope === 'yearly' ? Number(fortuneReferenceFields(range.start).date.slice(0, 4)) : undefined;
    // July always falls on the new side of the local Li Chun boundary.
    const annualYear = civilYear === undefined ? undefined
      : lunarAtBeijing(Date.UTC(civilYear, 6, 1)).getYearInGanZhiExact() === year ? civilYear : civilYear - 1;
    const month = flows.find(flow => flow.layer === 'month')?.pillar;
    const jieMonth = month ? jieMonths?.get(month) : undefined;
    const day = flows.find(flow => flow.layer === 'day')?.pillar;
    const annualTwistCaseRange = day ? luAnnualTwistDayRange(range) : undefined;
    const rootlessCaseRange = day ? luRootlessDayRange(range) : undefined;
    if (month && day) writer.add(range, { scope: 'daily', factType: 'calendar_pattern', subjectIds: ['flow:month', 'flow:day'],
      normalizedPayload: luMonthDayTwist(month, day),
    }, raw);
    for (const { candidate, id, solarNatal, solarBirthRef, verifiedClock, sourceClockReady } of native) {
      const basis = 'bazi:candidate:' + candidate.candidateId;
      const current = flows.at(-1)!;
      const moving = 'flow:' + current.layer;
      const facts = describeBaZiPillar(current.pillar, candidate.natal.day[0]);
      const nativePillars = (['year', 'month', 'day', 'hour'] as const)
        .filter(layer => layer !== 'hour' || chart?.timeKnown)
        .map(layer => ({ id: 'natal:' + layer, pillar: candidate.natal[layer] }));
      const shared = [...nativePillars, ...flows.map(item => ({ id: 'flow:' + item.layer, pillar: item.pillar }))];
      const interactions = baziInteractions(shared);
      for (const flow of flows) writer.add(range, {
        scope: baziScope[flow.layer], factType: 'layer_pillar', subjectIds: [basis, 'flow:' + flow.layer],
        normalizedPayload: { layer: flow.layer, ...describeBaZiPillar(flow.pillar, candidate.natal.day[0]),
          natalPillars: nativePillars, calendarPolicy: factPolicies.bazi.rules },
      }, raw, id);
      writer.add(range, { scope, factType: 'source_layer_context', subjectIds: [basis],
        normalizedPayload: baziSourceContext(candidate.natal, chart?.timeKnown === true, flows),
      }, raw, id);
      const start = Math.max(range.start, Date.parse(candidate.natal.utc));
      if (sourceClockReady && jieMonth && jieMonth.monthPillar === month && jieMonth.annualPillar === year
        && jieMonth.start <= start && start < range.end && range.end <= jieMonth.end) {
        const { natal } = candidate;
        const clashedNatalPositions = interactions.pairs.filter(row =>
          row.kind === '六冲' && row.members.includes('flow:month'))
          .flatMap(row => row.members.filter(position => position === 'natal:day' || position === 'natal:year'));
        writer.add({ start, end: range.end }, { scope: 'monthly', factType: 'bazi_jie_month_context',
          subjectIds: [basis, 'flow:year', 'flow:month', 'natal:year', 'natal:day'],
          normalizedPayload: {
            monthPillar: month, annualPillar: year, jieStartDate: fortuneReferenceFields(jieMonth.start).date,
            dayMaster: natal.day[0], monthTenGod: facts.tenGod,
            natalDayBranch: natal.day[1], natalYearBranch: natal.year[1], clashedNatalPositions,
          },
        }, raw, id);
      }
      const confirmed = candidate.directions.filter(direction => direction.confirmed);
      const verifiedFourPillars = chart?.timeKnown === true && sourceClockReady;
      const selected = confirmed.length === 1 ? confirmed[0] : undefined;
      const timingStage = selected?.stages.find(item => item.start <= range.start && range.start < item.end);
      const timing = timingStage?.pillar && year && month
        ? baziWorkTimingContext(candidate.natal, chart?.timeKnown === true, timingStage.pillar.pillar, year, month, day)
        : undefined;
      const reviewDay = scope === 'daily' && day && month && sourceClockReady && start < range.end;
      const dayStage = reviewDay && verifiedFourPillars ? selected?.stages.find(item => item.start <= start && start < item.end) : undefined;
      const dayLuck = dayStage?.pillar?.pillar;
      const dayLuckInputs = dayLuck ? [...shared, { id: 'decadal', pillar: dayLuck }] : undefined;
      const dayLuckInteractions = dayLuckInputs && baziInteractions(dayLuckInputs);
      if (reviewDay) {
        const contact = baziDailyBranchContext(candidate.natal, chart?.timeKnown === true, day, month,
          dayLuckInteractions ?? interactions, year, dayLuck, timingStage === dayStage ? timing : undefined);
        const positions = new Set(['flow:day', ...contact.contacts.map(row => row.target), ...contact.completedGroups.flatMap(row => row.positions.flat())]);
        const workContact = contact.workMonthBranchConfirmed || contact.workRepeatedBranchConfirmed;
        if (workContact) positions.add('flow:year');
        if (contact.workRepeatedBranchConfirmed) positions.add('flow:month');
        if (workContact || contact.repeatedContacts.some(row => row.background.some(item => item.layer === 'decadal'))) {
          positions.add('decadal');
        }
        writer.add({ start, end: range.end }, { scope, factType: 'daily_branch_context',
          subjectIds: [basis, ...positions],
          normalizedPayload: contact,
        }, raw, id);
      }
      for (const relation of interactions.pairs) writer.add(range, {
        scope, factType: 'pillar_relation', subjectIds: [basis, ...relation.members],
        normalizedPayload: { ...relation, pillars: shared.filter(item => relation.members.includes(item.id)) },
      }, raw, id);
      writer.add(range, { scope, factType: 'ten_god', subjectIds: [basis, 'natal:day', moving],
        normalizedPayload: { dayMaster: candidate.natal.day[0], stem: facts.stem, tenGod: facts.tenGod } }, raw, id);
      for (const item of facts.hiddenStems) writer.add(range, {
        scope, factType: 'hidden_stem_ten_god', subjectIds: [basis, 'natal:day', moving],
        normalizedPayload: { dayMaster: candidate.natal.day[0], branch: facts.branch, ...item },
      }, raw, id);
      function relations(inputs: typeof shared, compared: ReturnType<typeof baziInteractions>,
        luck?: { genderBasis: string; direction: string; confirmed: boolean }) {
        const hasLuck = (ids: string[]) => luck ? ids.includes('decadal') : true;
        const emit = (kind: string, ids: string[], payload: object) => {
          const pillars = inputs.filter(item => ids.includes(item.id));
          const identity = JSON.stringify([basis, kind, pillars, luck?.genderBasis]);
          const previous = continuous.get(identity);
          const signalStart = previous?.end === range.start ? previous.start : range.start;
          continuous.set(identity, { start: signalStart, end: range.end });
          writer.add(range, { scope, factType: kind, subjectIds: [basis, ...ids],
            parentSignalId: 'bazi:' + identity + ':' + signalStart,
            completeness: luck && !luck.confirmed ? 'partial' : 'complete',
            warnings: luck && !luck.confirmed ? ['大运为条件推算，尚未确认正式起运口径'] : [],
            normalizedPayload: { ...payload, pillars,
              ruleId: 'fortune-bazi-' + kind + '-v1', conditionsMet: ['干支模式匹配'],
              unresolvedConditions: ['合化条件未计算'], luck } }, raw, id);
        };
        for (const item of compared.pairs) if (item.members.includes(moving) && hasLuck(item.members)) {
          emit(baziRelation[item.kind], item.members, item);
        }
        for (const item of compared.groups) {
          const ids = item.byBranch.flat();
          if (ids.includes(moving) && hasLuck(ids)) emit(baziRelation[item.kind], ids, item);
        }
        for (const item of compared.elemental) {
          const ids = [item.from, item.to];
          if (!ids.includes(moving) || !hasLuck(ids) || item.kind === '同五行') continue;
          emit(item.kind.includes('克') ? 'controlling' : 'generating', ids, item);
        }
      }
      relations(shared, interactions);
      if (verifiedFourPillars && year && month && day && start < range.end) {
        const stage = dayStage;
        const luck = stage?.pillar ? { pillar: stage.pillar.pillar, start: stage.start, end: stage.end } : undefined;
        const birthTimeZone = nativeClock?.timeZone ?? factPolicies.bazi.timeZone;
        const twistRange = annualTwistCaseRange && start < annualTwistCaseRange.end
          ? { start: Math.max(start, annualTwistCaseRange.start), end: annualTwistCaseRange.end } : undefined;
        writer.add(twistRange ?? { start, end: range.end }, { scope: 'daily', factType: 'lu_annual_daily_twist',
          subjectIds: [basis, 'natal:day', 'natal:hour', 'flow:year', 'flow:month', 'flow:day'],
          normalizedPayload: luAnnualDailyTwistCase(candidate.natal, birthTimeZone, year, month, day, luck?.pillar, twistRange !== undefined),
        }, raw, id);
        if (rootlessCaseRange && start < rootlessCaseRange.end) writer.add({ ...rootlessCaseRange,
          start: Math.max(start, rootlessCaseRange.start) }, { scope: 'daily', factType: 'lu_rootless_day_case',
          subjectIds: [basis, 'natal:day', 'decadal', 'flow:year', 'flow:month', 'flow:day'],
          normalizedPayload: luRootlessDayCase(candidate.natal, birthTimeZone, year, month, day, luck),
        }, raw, id);
      }
      if (scope === 'monthly' && year && month && (verifiedClock || solarNatal)) {
        const natal = solarNatal ?? candidate.natal;
        const stage = selected?.stages.find(item => item.start <= range.start && range.start < item.end && item.pillar);
        const luck = stage?.pillar && selected && natal.year === candidate.natal.year && natal.month === candidate.natal.month
          ? { pillar: stage.pillar.pillar, genderBasis: selected.genderBasis } : undefined;
        const reading = fateClearPeriodReading(natal, year, month, luck);
        const monthlyLayerOrderVerified = jieMonth && jieMonth.annualPillar === year && jieMonth.monthPillar === month
          && jieMonth.start <= range.start && range.end <= jieMonth.end
          && luck && stage && range.end <= stage.end ? true : undefined;
        const repeatedTheme = monthlyLayerOrderVerified && jieMonth && stage
          ? repeatedMonthStemTheme(natal.day[0], jieMonth, stage.start) : undefined;
        writer.add(range, { scope, factType: 'fateclear_bazi_context', subjectIds: [basis, moving],
          normalizedPayload: { ...fateClearBranchContext(natal, chart?.timeKnown === true, 'month', month, reading),
            ...fateClearMonthlyExample(natal, chart?.timeKnown === true, year, month, luck),
            jieMonth, monthlyLayerOrderVerified, flowAnnualStem: year[0],
            repeatedMonthStemTheme: repeatedTheme?.theme, previousJieMonthPillar: repeatedTheme?.previousMonthPillar,
            ...reading },
        }, raw, id, ...solarBirthRef);
      }
      if (scope === 'monthly' && verifiedFourPillars && year && month && start < range.end) {
        const stage = selected?.stages.find(row => row.start <= start && start < row.end);
        const luck = stage?.pillar ? { pillar: stage.pillar.pillar, start: stage.start, end: stage.end } : undefined;
        writer.add({ start, end: range.end }, { scope, factType: 'smth_tai_sui_clash_month',
          subjectIds: [basis, 'natal:day', 'natal:hour', 'decadal', 'flow:year', 'flow:month'],
          normalizedPayload: smthTaiSuiClashMonth(candidate.natal, year, month, luck),
        }, raw, id);
        writer.add({ start, end: range.end }, { scope, factType: 'smth_fire_assembly_month',
          subjectIds: [basis, 'natal:month', 'decadal', 'flow:year', 'flow:month'],
          normalizedPayload: smthFireAssemblyMonth(candidate.natal, year, month, luck),
        }, raw, id);
        writer.add({ start, end: range.end }, { scope, factType: 'smth_dragon_back_month',
          subjectIds: [basis, 'natal:day', 'flow:year', 'flow:month'],
          normalizedPayload: smthDragonBackMonth(candidate.natal, year, month),
        }, raw, id);
        const dayVirtueMonths = smthDayVirtueMonth(candidate.natal, year, month, { start, end: range.end }, luck, nativeClock?.timeZone);
        for (const { start: monthStart, end: monthEnd, payload } of dayVirtueMonths) {
          writer.add({ start: monthStart, end: monthEnd }, { scope, factType: 'smth_day_virtue_month',
            subjectIds: [basis, 'natal:day', 'natal:hour', 'decadal', 'flow:year', 'flow:month'], normalizedPayload: payload,
          }, raw, id);
        }
      }
      if (year && (sourceClockReady || scope === 'yearly')) {
        const stage = selected?.stages.find(item => item.start <= start && start < item.end);
        const luck = stage?.pillar ? { status: 'confirmed' as const, pillar: stage.pillar.pillar }
          : stage ? { status: 'before_luck' as const } : { status: 'unavailable' as const };
        if (start < range.end) {
          const stageRange = stage ? { stageStart: new Date(stage.start).toISOString(), stageEnd: new Date(stage.end).toISOString() } : {};
          if (sourceClockReady) writer.add({ start, end: range.end }, {
            scope: 'yearly', factType: 'annual_column_relations', subjectIds: [basis, 'flow:year'],
            normalizedPayload: { ...baziAnnualColumnRelations(candidate.natal, chart?.timeKnown === true, year, luck), annualYear, ...stageRange },
          }, raw, id);
          if (scope === 'yearly' && sourceClockReady) {
            writer.add({ start, end: range.end }, {
              scope: 'yearly', factType: 'school_exam_context', subjectIds: [basis, 'flow:year'],
              normalizedPayload: { ...baziSchoolExamContext(candidate.natal, chart?.timeKnown === true, year,
                luck.status === 'confirmed' ? luck.pillar : undefined), ...stageRange },
            }, raw, id);
          }
          if (scope === 'yearly' && verifiedClock) {
            writer.add({ start, end: range.end }, {
              scope: 'yearly', factType: 'smth_seal_hurting_context', subjectIds: [basis, 'flow:year'],
              normalizedPayload: {
                ...baziSmthSealHurting(candidate.natal, chart?.timeKnown === true, year, luck, verifiedFourPillars, selected?.genderBasis === '女'),
                ...stageRange,
              },
            }, raw, id);
          }
          if (scope === 'yearly' && verifiedFourPillars) writer.add({ start, end: range.end }, {
            scope: 'yearly', factType: 'smth_hour_blade', subjectIds: [basis, 'natal:hour', 'flow:year'],
            normalizedPayload: { ...smthHourBlade(candidate.natal, year, luck), ...stageRange },
          }, raw, id);
          if (scope === 'yearly') {
            const gender = sourceClockReady && selected ? candidate.natal.luckContext?.gender : undefined;
            const priorLuckPillar = stage?.pillar
              ? selected?.stages.find(item => item.end === stage.start)?.pillar?.pillar : undefined;
            writer.add({ start, end: range.end }, {
              scope: 'yearly', factType: 'smth_officer_mix_context', subjectIds: [basis, 'flow:year'],
              normalizedPayload: baziSmthOfficerMix(candidate.natal, year, luck, gender, priorLuckPillar),
            }, raw, id);
          }
        }
      }
      for (const direction of confirmed.length ? confirmed : candidate.directions) {
        const stage = direction === selected ? timingStage : direction.stages.find(item => item.start <= range.start && range.start < item.end);
        if (direction === selected && timing && timingStage) {
          writer.add(range, { scope, factType: 'work_timing_context', subjectIds: [basis, 'decadal', moving],
            normalizedPayload: { ...timing, stageStart: new Date(timingStage.start).toISOString(), stageEnd: new Date(timingStage.end).toISOString() },
          }, raw, id);
        }
        const minorAge = minorLuckOrdinal(Date.parse(candidate.natal.utc), range.start);
        if (stage && year && minorAge?.yearPillar === year) {
          const verifiedMinorContext = verifiedFourPillars && direction === selected;
          const majorLuckHistory = verifiedMinorContext && stage.pillar
            ? smthMinorMajorLuckHistory(candidate.natal, year, stage.pillar.pillar, direction.stages
              .flatMap(item => item.index < stage.index && item.pillar ? [{ pillar: item.pillar.pillar, start: item.start }] : []))
            : undefined;
          const minors = smthMinorLuckVariants(candidate.natal.year, chart?.timeKnown ? candidate.natal.hour : undefined,
            direction.genderBasis, minorAge.ordinal).map(variant => ({
              ...baziMinorLuckContext(candidate.natal, chart?.timeKnown === true, year, stage.pillar?.pillar ?? undefined, variant),
              p245MatchProfile: verifiedMinorContext ? baziMinorLuckPolicy.p245 : undefined,
              majorLuckHistory, majorLuckHistoryProfile: majorLuckHistory?.profile,
              majorLuckWeakBases: majorLuckHistory?.weakBases,
              majorLuckAdverseCases: majorLuckHistory?.adverseCases,
              majorLuckFavorableBases: majorLuckHistory?.favorableBases,
              majorLuckNaYinRelation: majorLuckHistory?.majorLuckNaYin?.relation,
              majorLuckPolarityCondition: majorLuckHistory?.majorLuckPolarity?.condition,
              ...minorAge, confirmed: direction.confirmed,
              stageStart: new Date(stage.start).toISOString(), stageEnd: new Date(stage.end).toISOString(),
            }));
          for (const minor of minors) writer.add(range, {
            scope: 'minor', factType: 'minor_luck_context', subjectIds: [basis, minor.variant],
            completeness: direction.confirmed ? 'complete' : 'partial',
            warnings: ['小运计龄日界与来源方法选择尚未核定，仅按明示候选政策计算',
              ...(direction.confirmed ? [] : ['起运表未唯一核验，小运方向及身份依据仅为候选'])],
            normalizedPayload: minor,
          }, raw, id);
          if (scope === 'yearly' && majorLuckHistory) {
            const agreement = smthMinorLuckAgreement(minors, majorLuckHistory);
            const agreedWindow = agreement.harm.length || agreement.lu.length || agreement.namedHarm || agreement.minorOnlyHarm
              || agreement.stemGrowth || agreement.directNoble
              ? minorLuckCalendarAgreement(Date.parse(candidate.natal.utc), minorAge.ordinal, range) : undefined;
            if (agreedWindow) writer.add(agreedWindow, {
              scope: 'minor', factType: 'minor_luck_context', subjectIds: [basis, minors[0].variant],
              normalizedPayload: { ...minors[0], allMinorMethodsSameNatalHarm: agreement.harm.length > 0,
                allMinorMethodsSameNatalMinorOnlyHarm: Boolean(agreement.minorOnlyHarm?.length),
                allMinorMethodsSameLu: agreement.lu.length > 0,
                allMinorMethodsSameDirectNoble: Boolean(agreement.directNoble?.length),
                allMinorMethodsNamedFavorableHarm: agreement.namedHarm?.sourceCase,
                allMinorMethodsStemGrowthPhases: [...new Set(agreement.stemGrowth?.map(row => row.kind))],
                p245Agreement: agreement },
            }, raw, id);
          }
        }
        if (stage?.pillar) writer.add(range, {
          scope: 'decadal', factType: 'zpqz_officer_context', subjectIds: [basis, 'decadal'],
          completeness: direction.confirmed ? 'complete' : 'partial',
          warnings: direction.confirmed ? [] : ['大运尚未唯一核验，正官财印及制护对象仅作候选'],
          normalizedPayload: { ...baziZpqzOfficer(candidate.natal, chart?.timeKnown === true, stage.pillar.pillar),
            confirmed: direction.confirmed, stageStart: new Date(stage.start).toISOString(), stageEnd: new Date(stage.end).toISOString() },
        }, raw, id);
        if (stage?.pillar) writer.add(range, {
          scope: 'decadal', factType: 'zpqz_wealth_context', subjectIds: [basis, 'decadal'],
          completeness: direction.confirmed ? 'complete' : 'partial',
          warnings: direction.confirmed ? [] : ['大运尚未唯一核验，财格透藏及作用对象仅作候选'],
          normalizedPayload: { ...baziZpqzWealth(candidate.natal, chart?.timeKnown === true, stage.pillar.pillar),
            confirmed: direction.confirmed, stageStart: new Date(stage.start).toISOString(), stageEnd: new Date(stage.end).toISOString() },
        }, raw, id);
        if (stage?.pillar) writer.add(range, {
          scope: 'decadal', factType: 'zpqz_killer_order_context', subjectIds: [basis, 'decadal'],
          completeness: direction.confirmed ? 'complete' : 'partial',
          warnings: direction.confirmed ? [] : ['大运尚未唯一核验，偏官伤官取运仅作候选'],
          normalizedPayload: { ...baziZpqzKillerOrder(candidate.natal, chart?.timeKnown === true, stage.pillar.pillar),
            confirmed: direction.confirmed, stageStart: new Date(stage.start).toISOString(), stageEnd: new Date(stage.end).toISOString() },
        }, raw, id);
        if (stage?.pillar) writer.add(range, {
          scope: 'decadal', factType: 'zpqz_food_killer_context', subjectIds: [basis, 'decadal'],
          completeness: direction.confirmed ? 'complete' : 'partial',
          warnings: direction.confirmed ? [] : ['大运尚未唯一核验，食神带杀条件仅作候选'],
          normalizedPayload: { ...baziZpqzFoodKiller(candidate.natal, chart?.timeKnown === true, stage.pillar.pillar),
            confirmed: direction.confirmed, stageStart: new Date(stage.start).toISOString(), stageEnd: new Date(stage.end).toISOString() },
        }, raw, id);
        if (stage?.pillar) writer.add(range, {
          scope: 'decadal', factType: 'zpqz_seal_food_context', subjectIds: [basis, 'decadal'],
          completeness: direction.confirmed ? 'complete' : 'partial',
          warnings: direction.confirmed ? [] : ['大运尚未唯一核验，印食透藏不能作为正式运条件'],
          normalizedPayload: { ...baziZpqzSealFood(candidate.natal, chart?.timeKnown === true, stage.pillar.pillar),
            confirmed: direction.confirmed, stageStart: new Date(stage.start).toISOString(), stageEnd: new Date(stage.end).toISOString() },
        }, raw, id);
        if (stage?.pillar) writer.add(range, {
          scope: 'decadal', factType: 'zpqz_month_command', subjectIds: [basis, 'decadal'],
          completeness: direction.confirmed ? 'complete' : 'partial',
          warnings: direction.confirmed ? [] : ['大运尚未唯一核验，月令与透藏不能作为正式运条件'],
          normalizedPayload: { ...baziZpqzMonthCommand(candidate.natal, chart?.timeKnown === true, stage.pillar.pillar),
            confirmed: direction.confirmed, stageStart: new Date(stage.start).toISOString(), stageEnd: new Date(stage.end).toISOString() },
        }, raw, id);
        if (stage?.pillar) writer.add(range, {
          scope: 'decadal', factType: 'zpqz_stem_order', subjectIds: [basis, 'decadal'],
          completeness: direction.confirmed ? 'complete' : 'partial',
          warnings: direction.confirmed ? [] : ['大运尚未唯一核验，不能将合的柱序和对象作为正式运条件'],
          normalizedPayload: { ...baziZpqzStemOrder(candidate.natal, chart?.timeKnown === true, stage.pillar.pillar, year),
            confirmed: direction.confirmed, stageStart: new Date(stage.start).toISOString(), stageEnd: new Date(stage.end).toISOString() },
        }, raw, id);
        if (stage?.pillar && year) writer.add(range, {
          scope: 'decadal', factType: 'zpqz_moving_relations', subjectIds: [basis, 'decadal', 'flow:year'],
          completeness: direction.confirmed ? 'complete' : 'partial',
          warnings: direction.confirmed ? [] : ['起运表未唯一核验，不能把来源冲合背景当正式大运'],
          normalizedPayload: { ...baziZpqzMovingRelations(candidate.natal, chart?.timeKnown === true, stage.pillar.pillar, year),
            sourceNatalAndLuckVerified: verifiedFourPillars && direction === selected ? true : undefined,
            confirmed: direction.confirmed, stageStart: new Date(stage.start).toISOString(), stageEnd: new Date(stage.end).toISOString() },
        }, raw, id);
        if (stage?.pillar) {
          const luckContext = baziZpqzLuckContext(candidate.natal, chart?.timeKnown === true, stage.pillar.pillar);
          const luckPayload = { ...luckContext,
            rootPairingProfile: verifiedFourPillars && direction === selected ? zpqzRootPairingPolicy : undefined,
            confirmed: direction.confirmed, stageStart: new Date(stage.start).toISOString(), stageEnd: new Date(stage.end).toISOString() };
          writer.add(range, {
            scope: 'decadal', factType: 'zpqz_luck_context', subjectIds: [basis, 'decadal'],
            completeness: direction.confirmed ? 'complete' : 'partial',
            warnings: ['本来源五年作用的起止尚未核定，当前只记录同段结构',
              ...(direction.confirmed ? [] : ['正式起运方案未唯一核验，仅为候选'])],
            normalizedPayload: luckPayload,
          }, raw, id);
          if (scope === 'yearly' && luckContext.zhaoXinChouPrintedMeeting && verifiedFourPillars && direction === selected) {
            const geng = year && zpqzZhaoAnnualGengCheck(candidate.natal, year);
            const historicalDays = [{ time: zpqzZhaoMemorialDay, evidence: { zhaoDocumentedXinChouDay: true } },
              ...(geng ? [{ time: zpqzZhaoAnnualGengDay, evidence: { zhaoDocumentedAnnualGengDay: true, zhaoAnnualGengCheck: geng } }] : [])];
            for (const { time, evidence } of historicalDays) {
              const documented = { start: Math.max(range.start, time.start), end: Math.min(range.end, time.end) };
              if (documented.start < documented.end) writer.add(documented, {
                scope: 'decadal', factType: 'zpqz_luck_context', subjectIds: [basis, 'decadal'],
                normalizedPayload: { ...luckPayload, ...evidence },
              }, raw, id);
            }
          }
        }
        if (stage?.pillar) {
          const school = baziSchoolContext(candidate.natal, chart?.timeKnown === true, stage.pillar.pillar);
          const birthAt = Date.parse(candidate.natal.utc), stageStart = new Date(stage.start).toISOString();
          const entryTimeZone = nativeClock && sourceClockReady ? nativeClock.timeZone : undefined;
          writer.add(range, {
            scope: 'decadal', factType: 'school_context', subjectIds: [basis, 'decadal'],
            completeness: direction.confirmed ? 'complete' : 'partial',
            warnings: direction.confirmed ? [] : ['正式起运方案未唯一核验，学堂与运段关系仅为候选'],
            normalizedPayload: { ...school, confirmed: direction.confirmed, stageStart, stageEnd: new Date(stage.end).toISOString(),
              entryCompletedCivilYears: schoolEntryAge(birthAt, stage.start, entryTimeZone),
              entryCivilClock: entryTimeZone ? 'birthplace' : 'beijing' },
          }, raw, id);
          if (scope === 'yearly' && verifiedFourPillars && direction === selected && range.start === stage.start) {
            const ages = schoolLuckEntryAges(birthAt, stage.start, entryTimeZone);
            if (ages) writer.add({ start: stage.start, end: Math.min(range.end, stage.start + 1_000) }, {
              scope: 'decadal', factType: 'school_entry_context', subjectIds: [basis, 'natal:day', 'decadal'],
              exactInstant: stageStart, timePrecision: 'second',
              normalizedPayload: { profile: baziSchoolPolicy.entry, confirmed: true, dayMaster: school.dayMaster,
                directSourceDayStart: school.directSourceDayStart, luckPillar: school.luckPillar,
                sourceLuckAtDayStart: school.sourceLuckAtDayStart, sourceSchoolAbsenceCandidate: school.sourceSchoolAbsenceCandidate,
                sourceLuckPhase: school.sourceLuckPhase, dayLongevityAbsent: school.dayLongevityAbsent,
                luckSchoolContacts: school.luckSchoolContacts, sourceLuckSchoolClashOrBreak: school.sourceLuckSchoolClashOrBreak,
                sourceLuckSchoolSelfPunishment: school.sourceLuckSchoolSelfPunishment,
                luckSchoolChecks: school.luckSchoolChecks, hasNamedNobleSchool: school.hasNamedNobleSchool,
                nobleSchoolWitnesses: school.nobleSchoolWitnesses,
                schoolEntryAgreement: school.checkedSchoolAbsenceAtLongevity
                  && [ages.civilYears, ages.liChunOrdinal, ages.lunarOrdinal].every(age => age === 5 || age === 7),
                ...ages },
            }, raw, id);
          }
        }
        if (stage?.pillar && year) writer.add(range, {
          scope: 'yearly', factType: 'annual_luck_context', subjectIds: [basis, 'decadal'],
          completeness: direction.confirmed ? 'complete' : 'partial',
          warnings: direction.confirmed ? [] : ['正式起运方案未唯一核验，岁运关系仅为候选'],
          normalizedPayload: { ...baziAnnualLuckContext(candidate.natal, chart?.timeKnown === true, year, stage.pillar.pillar,
            scope === 'yearly' && verifiedFourPillars && direction === selected),
            ...(scope === 'yearly' && verifiedFourPillars && direction === selected ? {
              ...baziSmthFoundation(candidate.natal, stage.pillar.pillar),
              ...baziSmthTaiSuiContext(candidate.natal, year, stage.pillar.pillar),
            } : {}),
            confirmed: direction.confirmed, selectionPolicy: direction.selectionPolicy,
            stageStart: new Date(stage.start).toISOString(), stageEnd: new Date(stage.end).toISOString() },
        }, raw, id);
        if (stage?.pillar) writer.add(range, {
          scope: 'decadal', factType: 'luck_conditions', subjectIds: [basis, 'decadal'],
          completeness: direction.confirmed ? 'complete' : 'partial',
          warnings: direction.confirmed ? [] : ['上游大运表未与唯一重算方案一致'],
          normalizedPayload: { ...baziLuckConditions(stage.pillar.pillar, candidate.natal.day[0],
            baziNatalConditions(candidate.natal, chart?.timeKnown === true), year), confirmed: direction.confirmed,
            pillar: stage.pillar.pillar, selectionPolicy: direction.selectionPolicy,
            stageStart: new Date(stage.start).toISOString(), stageEnd: new Date(stage.end).toISOString() },
        }, raw, id);
        if (stage?.pillar) writer.add(range, {
          scope: 'decadal', factType: 'luck_pillar', subjectIds: [basis, 'decadal'],
          completeness: direction.confirmed ? 'complete' : 'partial',
          warnings: direction.confirmed ? [] : ['出生性别与起运口径未从上游确认，分别保留顺逆方案'],
          normalizedPayload: { ...stage.pillar, genderBasis: direction.genderBasis, direction: direction.direction,
            confirmed: direction.confirmed, selectionPolicy: direction.selectionPolicy,
            stageStart: new Date(stage.start).toISOString(), stageEnd: new Date(stage.end).toISOString(),
            startAge: stage.startAge, endAge: stage.endAge,
            minorYears: stage.years.filter(item => item.year >= Number(segment.startInstant.slice(0, 4)) - 1
              && item.year <= Number(segment.endInstantExclusive.slice(0, 4)) + 1)
              .map(({ year, minor }) => ({ year, pillar: minor })) },
        }, raw, id);
        if (stage?.pillar) {
          const usesDayStage = direction === selected && stage === dayStage;
          const inputs = (usesDayStage && dayLuckInputs) || [...shared, { id: 'decadal', pillar: stage.pillar.pillar }];
          const compared = (usesDayStage && dayLuckInteractions) || baziInteractions(inputs);
          relations(inputs, compared,
            { genderBasis: direction.genderBasis, direction: direction.direction, confirmed: direction.confirmed });
        }
      }
    }
  }
  return { status: result.natalStatus === 'unsupported' ? 'not_supported' : 'partial',
    nativeWindow: { segments, policy: factPolicies.bazi },
    warnings: native.length ? ['身强弱、取用及合化救应条件待确认',
      ...(!native.every(({ candidate }) => candidate.directions.some(direction => direction.confirmed)) ? ['正式起运方案未与上游大运表核验一致'] : []),
      ...(!chart?.timeKnown ? ['出生时刻未确认'] : [])]
      : ['缺少兼容本命盘，已保留流柱区间'] };
}
