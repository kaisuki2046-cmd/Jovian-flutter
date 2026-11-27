import { jielanFlowShaBranches, quanshuBodyLimitEncounterPolicy } from './ziwei-body-limit-encounters';
import { quanshuBrightness, quanshuMinorLimit, quanshuPalaceRelation, quanshuTransformations, quanshuVerifiedMajorPositions,
  type quanshuAnnualContext } from './ziwei-quanshu';
import { readQuanshuSupportNatal } from './ziwei-source-support';

type Natal = Parameters<typeof quanshuAnnualContext>[0];
type AnnualContext = ReturnType<typeof quanshuAnnualContext>;
type LimitIndices = { decadalIndex?: number; minorIndex?: number };
const branches = '子丑寅卯辰巳午未申酉戌亥';
const zodiacBranch = (year: number) => branches[((year - 4) % 12 + 12) % 12];

export const quanshuKillerEchoPolicy = {
  profile: 'quanshu-killer-echo-life-year-v1',
  anchor: 'natal-life-and-two-trines-with-annual-yang-tuo-both-off-palace',
  verse: 'same-annual-and-two-limit-fragment-around-native-qisha-with-a-guarding-limit',
  grades: 'volume3-explicit-source-table-does-not-resolve-prose-fallen-clause',
  taboo: 'birth-stem-and-annual-stem-extension-candidate-separated',
  support: 'named-stars-tested-around-life-and-killer-without-rescue-score',
} as const;

export function quanshuKillerEcho(natal: Natal, annual: AnnualContext, annualBranch: string, limits?: LimitIndices) {
  if (annual.ready !== true) return { ready: false, reason: 'unverified_annual_frame' } as const;
  const birthYearBranch = zodiacBranch(annual.birthYear);
  if (birthYearBranch !== natal.rawDates.chineseDate.yearly[1] || annualBranch !== zodiacBranch(annual.lunarYear)) {
    return { ready: false, reason: 'inconsistent_year_branch' } as const;
  }
  const uniqueBranch = (star: string, includeMinor = false) => {
    const placements = natal.palaces.flatMap(palace => (['majorStars', 'minorStars', 'adjectiveStars'] as const)
      .flatMap(layer => palace[layer].filter(row => row.name === star).map(() => ({ branch: palace.earthlyBranch, layer }))));
    const placement = placements.length === 1 ? placements[0] : undefined;
    return placement?.layer === 'majorStars' || includeMinor && placement?.layer === 'minorStars' ? placement.branch : undefined;
  };
  const killerBranch = quanshuVerifiedMajorPositions(uniqueBranch).get('七杀');
  if (!killerBranch) return { ready: false, reason: 'unverified_killer_position' } as const;

  const { lifeBranch, annualQingyangBranch, annualTuoluoBranch } = annual;
  const at = (branch: string) => ({
    lifeRelation: quanshuPalaceRelation(lifeBranch, branch),
    killerRelation: quanshuPalaceRelation(killerBranch, branch),
    annualRelation: quanshuPalaceRelation(annualBranch, branch),
  });
  const positioned = (star: string, branch: string | undefined) => ({
    star, branch, ...(branch ? at(branch) : {}),
  });
  const yang = positioned('擎羊', annualQingyangBranch);
  const tuo = positioned('陀罗', annualTuoluoBranch);
  const offPalace = (relation?: string) => relation === '冲' || relation === '三合';
  const jointAnnualContact = yang.lifeRelation === '冲' && tuo.lifeRelation === '三合'
    || tuo.lifeRelation === '冲' && yang.lifeRelation === '三合';
  const killerLifeRelation = at(killerBranch).lifeRelation;
  const limitBranch = (index?: number) => natal.palaces.find(palace => palace.index === index)?.earthlyBranch;
  const sourceMinor = quanshuMinorLimit(birthYearBranch, natal.gender, annual.lunarYear - annual.birthYear + 1);
  const archiveMinor = limitBranch(limits?.minorIndex);
  const sourceMinorVerified = sourceMinor && archiveMinor ? archiveMinor === sourceMinor.branch : undefined;
  const verseSeats = ([['yearly', annualBranch], ['decadal', limitBranch(limits?.decadalIndex)],
    ['minor', sourceMinorVerified === true ? archiveMinor : undefined]] as const).map(([scope, branch]) => ({
    scope, branch, killerRelation: branch ? at(branch).killerRelation : undefined,
  }));
  const versePlacements = verseSeats.map(row => row.killerRelation);
  const supportedNatal = killerLifeRelation === '守' || killerLifeRelation === '三合';
  const annualBladesAtKiller = offPalace(yang.killerRelation) && offPalace(tuo.killerRelation);
  const actualLimitEchoCandidate = !supportedNatal || !annualBladesAtKiller || versePlacements.includes('其他') ? false
    : versePlacements.includes(undefined) ? undefined : verseSeats.slice(1).some(row => row.killerRelation === '守');
  const flowQishaBranches = jielanFlowShaBranches(annualBranch);
  const verifiedSeats = verseSeats.slice(1);
  const qishaGuards = verifiedSeats.filter(row => row.killerRelation === '守');
  const sourceJiaGui = annual.birthStem === '甲' && annual.annualStem === '癸' && annual.tuoluoBranch === '丑'
    && annualQingyangBranch === annual.tuoluoBranch && ['守', '冲', '三合'].includes(yang.lifeRelation ?? '')
    && supportedNatal && flowQishaBranches?.includes(killerBranch) === true;
  const jielanJiaGuiKillerEchoCandidate = sourceJiaGui && (qishaGuards.length > 0 ? true
    : verifiedSeats.some(row => row.killerRelation === undefined) ? undefined : false);
  const sheepInMaoYou = (branch: string) => '卯酉'.includes(branch);
  const taboo = (stem: string, layer: 'natal' | 'annual_candidate') => {
    const { star } = quanshuTransformations(stem).find(row => row.kind === '忌')!;
    const branch = uniqueBranch(star, true);
    return { ...positioned(star, branch), layer, stem,
      atAnnualQingyang: branch ? branch === annualQingyangBranch : undefined,
      atAnnualTuoluo: branch ? branch === annualTuoluoBranch : undefined };
  };
  const support = readQuanshuSupportNatal(natal);
  const auxiliaryPositions = support.ready ? support.sourcePositions
    .filter(row => ['左辅', '右弼', '文昌', '文曲', '魁钺组'].includes(row.star))
    .map(row => positioned(row.star, row.branch)) : undefined;

  return {
    ready: true, profile: quanshuKillerEchoPolicy.profile, lunarYear: annual.lunarYear, annualStem: annual.annualStem,
    annualBranch, lifeBranch, birthYearBranch, birthHour: natal.rawDates.chineseDate.hourly[1],
    killerBranch, killerLifeRelation, killerSourceSeatVerified: true, killerGrade: quanshuBrightness('七杀', killerBranch),
    annualYangTuo: [
      { ...yang, grade: quanshuBrightness(yang.star, annualQingyangBranch) },
      { ...tuo, grade: quanshuBrightness(tuo.star, annualTuoluoBranch) },
    ],
    jointAnnualContact, verseSeats, actualLimitEchoCandidate, natalQingyangBranch: annual.qingyangBranch,
    sourceMinor: sourceMinor && { ...sourceMinor, verified: sourceMinorVerified },
    jielanFlowShaProfile: quanshuBodyLimitEncounterPolicy.jielanFlowSha,
    jielanJiaGuiKillerEchoCandidate,
    jielanJiaGuiKillerEchoWitness: jielanJiaGuiKillerEchoCandidate === true ? {
      birthStem: annual.birthStem, annualStem: annual.annualStem, lifeBranch, killerBranch,
      sharedShaBranch: annualQingyangBranch, shaLifeRelation: yang.lifeRelation,
      flowQishaBranches, guards: qishaGuards.map(({ scope, branch }) => ({ scope, branch })),
    } : undefined,
    natalQingyangInMaoYou: sheepInMaoYou(annual.qingyangBranch),
    annualQingyangInMaoYou: sheepInMaoYou(annualQingyangBranch), lifeInMaoYou: sheepInMaoYou(lifeBranch),
    tabooPositions: [taboo(annual.birthStem, 'natal'), taboo(annual.annualStem, 'annual_candidate')],
    rescuePositions: [
      positioned('紫微', uniqueBranch('紫微')), positioned('天相', uniqueBranch('天相')),
      { ...positioned('禄存', annual.lucunBranch), layer: 'natal' },
      { ...positioned('禄存', annual.annualLucunBranch), layer: 'annual' },
    ],
    auxiliaryPositions,
  } as const;
}
