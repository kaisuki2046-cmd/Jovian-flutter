import { buildFactTimeContext, utcRange } from '../fact-time-context';
import { westernOrbPolicy, westernSearchPolicy } from '../solar-transits';
import { ziweiFlowConfig } from '../ziwei-flows';
import { progressionPolicy } from '../western-progressions';
import { lingZiweiPolicy } from '../ziwei-ling';
import { westernHousePolicy } from '../western-houses';
import { baziSourceContextPolicy } from '../bazi-source-context';
import { quanshuZiweiPolicy } from '../ziwei-quanshu';
import { quanshuKillerEchoPolicy } from '../ziwei-killer-echo';
import { quanshuLimitChapterPolicy } from '../ziwei-limit-chapter';
import { quanshuTransformLimitPolicy } from '../ziwei-transform-limits';
import { quanshuLimitCombinationPolicy } from '../ziwei-limit-combinations';
import { quanshuAnnualShaPolicy } from '../ziwei-annual-sha';
import { quanshuLiteraryLimitsPolicy } from '../ziwei-literary-limits';
import { quanshuLimitBranchesPolicy } from '../ziwei-limit-branches';
import { quanshuLimitTimingPolicy } from '../ziwei-limit-timing';
import { quanshuYearAndLimitsPolicy } from '../ziwei-year-and-limits';
import { quanshuLimitVerseContactPolicy } from '../ziwei-limit-verse-contacts';
import { quanshuSolarWuPoPolicy } from '../ziwei-solar-wu-po-limits';
import { quanshuXingJiTigerPolicy } from '../ziwei-xing-ji-tiger';
import { quanshuYearEncountersPolicy } from '../ziwei-year-encounters';
import { quanshuBodyLimitEncounterPolicy } from '../ziwei-body-limit-encounters';
import { quanshuShangShiLimitPolicy } from '../ziwei-shangshi-limits';
import { ptolemyTimePolicy } from '../ptolemy-times';
import { westernTimeLinksPolicy } from '../western-time-links';
import { sepharialLunationPolicy } from '../sepharial-lunation';
import { yunZiweiPolicy } from '../ziwei-yun';
import { leoSourcePolicy } from '../leo-source-context';
import { leoLunarConditionPolicy } from '../leo-lunar-conditions';
import { leoNatalAspectPolicy } from '../leo-natal-aspects';
import { leoJupiterHousePolicy, leoNatalTransitPolicy } from '../leo-transit-natal';
import { quanshuKongJiePolicy } from '../ziwei-kongjie';
import { quanshuKongJieLimitPolicy } from '../ziwei-kongjie-limits';
import { baziAnnualLuckPolicy } from '../bazi-annual-luck';
import { smthSealHurtingPolicy } from '../bazi-smth-seal-hurting';
import { smthOfficerMixPolicy } from '../bazi-smth-officer-mix';
import { leoLunarHousePolicy } from '../leo-lunar-houses';
import { quanshuSupportPolicy } from '../ziwei-source-support';
import { baziSchoolPolicy } from '../bazi-school';
import { baziSchoolExamPolicy } from '../bazi-school-exam';
import { fateClearBaziPolicy } from '../bazi-fateclear';
import { baziMinorLuckPolicy } from '../bazi-minor-luck';
import { lillyReturnPolicy, lillySeventhReturnPolicy } from '../lilly-returns';
import { zpqzLuckPolicy, zpqzRootPairingPolicy } from '../bazi-zpqz';
import { quanshuYearPolicy } from '../ziwei-source-year';
import { quanshuDoujunMonthPolicy } from '../ziwei-doujun-months';
import { quanshuFireBellPolicy } from '../ziwei-firebell';
import { leoAscendantPolicy } from '../leo-ascendant';
import { baziAnnualRelationPolicy } from '../bazi-annual-relations';
import { luRootlessDayPolicy } from '../bazi-lu-rootless';
import { smthMonthCasePolicy } from '../bazi-smth-month-cases';
import { smthHourBladePolicy } from '../bazi-smth-hour-blade';
import { smthMonthDutyPolicy } from '../bazi-smth-month-duty';
import { quanshuBodyLimitPolicy } from '../ziwei-body-limits';
import { heindelSourcePolicy } from '../heindel-source-context';
import { zpqzMovingPolicy } from '../bazi-zpqz-relations';
import { zpqzStemPolicy } from '../bazi-zpqz-stems';
import { zpqzMonthPolicy } from '../bazi-zpqz-month';
import { zpqzSealFoodPolicy } from '../bazi-zpqz-seal-food';
import { quanshuHorseVoidPolicy } from '../ziwei-horse-voids';
import { quanshuTigerPolicy } from '../ziwei-tiger-layers';
import { quanshuYangTabooPolicy } from '../ziwei-yang-taboos';
import { leoJupiterLuminaryPolicy } from '../leo-jupiter-luminaries';
import { heindelJupiterRepeatPolicy } from '../heindel-jupiter-repeats';
import { zpqzFoodKillerPolicy } from '../bazi-zpqz-food-killer';
import { zpqzKillerOrderPolicy } from '../bazi-zpqz-killer-order';
import { zpqzWealthPolicy } from '../bazi-zpqz-wealth';
import { zpqzOfficerPolicy } from '../bazi-zpqz-officer';
import type { AuthorizedFortuneInput, FortuneFactInput, FortuneFactRecord, Method, MethodStatus } from '../../model/fortune-facts';
export const factLayerVersion = 'fortune-calculation-fact-layer-v1.612';
export const factPolicies = {
  bazi: { engine: 'lunar-javascript', version: '1.7.8', rules: 'fortune-bazi-layers-beijing-sect2-v2',
    timeZone: 'Asia/Shanghai', boundary: '立春换年、十二节换月、23:00换日', provisionalStartSect: 2,
    luckSelectionPolicy: 'archived-table-recomputed-sect2-v1', rootPolicy: 'same-element-hidden-qi-v1',
    sourceContextPolicy: baziSourceContextPolicy, luRootlessDayPolicy, smthMonthCasePolicy, smthHourBladePolicy,
    annualLuckPolicy: baziAnnualLuckPolicy, smthMonthDutyPolicy, smthSealHurtingPolicy, smthOfficerMixPolicy,
    schoolPolicy: baziSchoolPolicy, schoolExamPolicy: baziSchoolExamPolicy, fateClearPolicy: fateClearBaziPolicy,
    minorLuckPolicy: baziMinorLuckPolicy, zpqzLuckPolicy, zpqzRootPairingPolicy, zpqzMovingPolicy, zpqzStemPolicy, zpqzMonthPolicy, zpqzSealFoodPolicy, zpqzFoodKillerPolicy, zpqzKillerOrderPolicy, zpqzWealthPolicy, zpqzOfficerPolicy, annualRelationPolicy: baziAnnualRelationPolicy },
  ziwei: { engine: 'iztro', version: '2.6.5', rules: 'standard-new-year-leap-split-late-zi-current-v1',
    timeZone: 'Asia/Shanghai', boundary: '农历新年、北京午夜、闰月第十六日', config: ziweiFlowConfig,
    sourceProfiles: [lingZiweiPolicy, quanshuZiweiPolicy, yunZiweiPolicy, quanshuKongJiePolicy, quanshuSupportPolicy, quanshuYearPolicy, quanshuDoujunMonthPolicy, quanshuFireBellPolicy, quanshuBodyLimitPolicy, quanshuHorseVoidPolicy, quanshuTigerPolicy, quanshuYangTabooPolicy, quanshuKillerEchoPolicy, quanshuLimitChapterPolicy, quanshuTransformLimitPolicy, quanshuLimitCombinationPolicy, quanshuAnnualShaPolicy, quanshuLiteraryLimitsPolicy, quanshuLimitBranchesPolicy, quanshuLimitTimingPolicy, quanshuYearAndLimitsPolicy, quanshuShangShiLimitPolicy, quanshuKongJieLimitPolicy, quanshuLimitVerseContactPolicy, quanshuSolarWuPoPolicy, quanshuXingJiTigerPolicy, quanshuYearEncountersPolicy, quanshuBodyLimitEncounterPolicy] },
  western: { engine: 'astronomy-engine', version: '2.1.19', rules: 'fortune-western-calculation-v2',
    timeZone: 'UTC', zodiac: 'tropical', coordinateFrame: 'geocentric apparent ecliptic of date',
    houseSystem: 'whole-sign', orbPolicy: westernOrbPolicy, searchPolicy: westernSearchPolicy, progressionPolicy,
    sourceHousePolicy: westernHousePolicy, sourceTimePolicies: [ptolemyTimePolicy, westernTimeLinksPolicy, sepharialLunationPolicy],
    sourceContextPolicy: leoSourcePolicy, lunarConditionPolicy: leoLunarConditionPolicy, leoNatalAspectPolicy, leoNatalTransitPolicy, leoJupiterHousePolicy,
    lunarHousePolicy: leoLunarHousePolicy, ascendantPolicy: leoAscendantPolicy, lillyReturnPolicy, lillySeventhReturnPolicy,
    heindelSourcePolicy, leoJupiterLuminaryPolicy, heindelJupiterRepeatPolicy, timePrecision: 'second' },
  almanac: { engine: 'lunar-javascript', version: '1.7.8', rules: 'fortune-almanac-beijing-noon-v1',
    timeZone: 'Asia/Shanghai' },
} as const;
export type Window = { start: number; end: number };
export type Context = ReturnType<typeof buildFactTimeContext>;
export type RawRecord = { rawFactId: string; method: Method; payload: unknown };
export type Status = { status: MethodStatus; warnings: string[]; nativeWindow?: unknown };
type RecordInput = Pick<FortuneFactRecord, 'scope' | 'factType' | 'subjectIds' | 'normalizedPayload'>
  & Partial<Pick<FortuneFactRecord, 'timePrecision' | 'parentSignalId' | 'exactInstant' | 'completeness' | 'warnings'>>;
export type Writer = ReturnType<typeof createWriter>;

export function createWriter(method: Method, input: FortuneFactInput, reference: AuthorizedFortuneInput | undefined, runId: string) {
  const rawFacts: RawRecord[] = [];
  const facts: FortuneFactRecord[] = [];
  const policy = factPolicies[method];
  const raw = (payload: unknown) => {
    const id = runId + ':' + method + ':raw:' + rawFacts.length;
    rawFacts.push({ rawFactId: id, method, payload });
    return id;
  };
  function add(range: Window, record: RecordInput, ...sourceFactIds: string[]) {
    const { startInstant, endInstantExclusive } = utcRange(range.start, range.end);
    facts.push({
      factId: runId + ':' + method + ':' + facts.length, calculationRunId: runId,
      profileId: method === 'almanac' ? undefined : reference?.profileId,
      natalChartSnapshotId: method === 'almanac' ? undefined : reference?.snapshotId,
      periodType: input.periodType, method, activeFrom: startInstant, activeTo: endInstantExclusive,
      timePrecision: 'range', timeZone: policy.timeZone, sourceEngine: policy.engine,
      engineVersion: policy.version, rulesetVersion: policy.rules,
      completeness: 'complete', warnings: [], ...record, sourceFactIds,
    });
  }
  return { raw, add, facts, rawFacts };
}
