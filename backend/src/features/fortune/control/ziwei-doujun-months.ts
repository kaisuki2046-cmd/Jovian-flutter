import * as LunarPackage from 'lunar-javascript';
import { lunarAtBeijing } from './fortune-calendar';
import { quanshuZiweiBirthAnchor } from './ziwei-birth-major-anchor';
import { quanshuFixedFireBellProfile, readQuanshuArchivedFireBell } from './ziwei-firebell-positions';
import { quanshuLifeBureau } from './ziwei-growth-stages';
import { quanshuKongJiePositions } from './ziwei-kongjie';
import { quanshuVerifiedBoshiPosition } from './ziwei-kongjie-limits';
import { quanshuBrightness, quanshuLuYangTuo, quanshuMingTabooStar, quanshuPalaceRelation, quanshuTransformations,
  quanshuVerifiedMajorPositions, readQuanshuNatal } from './ziwei-quanshu';
import { quanshuAuxiliaryPositions } from './ziwei-source-support';
import { quanshuDoujunPosition } from './ziwei-source-year';

type Natal = Parameters<typeof readQuanshuNatal>[0];
type NatalBasis = Extract<ReturnType<typeof readQuanshuNatal>, { status: 'ready' }>;
type Window = { start: number; end: number };
type PositionedStar = { star: string; branch: string };
const branches = '子丑寅卯辰巳午未申酉戌亥', stems = '甲乙丙丁戊己庚辛壬癸';
const day = 86_400_000;
const lunar = LunarPackage as unknown as {
  Lunar: { fromYmd(year: number, month: number, day: number): { getSolar(): { toYmd(): string } } };
  LunarYear: { fromYear(year: number): { getLeapMonth(): number } };
  LunarMonth: { fromYm(year: number, month: number): { getDayCount(): number } };
};
// Palace chapters name these stars in temple. Their seats come from the
// corresponding star entries in Volume II.
const templeSupportSeats: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  财帛: { 太阳: '卯', 太阴: '子丑寅酉戌亥' },
  官禄: { 天机: '子午', 太阳: '卯', 太阴: '子丑寅酉戌亥' },
};
const tiantongTianliang = { seats: '寅申', stars: ['天同', '天梁'] } as const;
const lianzhenTianxiang = { seats: '子午', stars: ['廉贞', '天相'] } as const;
const namedPairGuards: Readonly<Record<string, readonly { seats: string; stars: readonly [string, string] }[]>> = {
  财帛: [tiantongTianliang],
  官禄: [tiantongTianliang, { seats: '辰戌', stars: ['天机', '天梁'] }],
};
const mod = (value: number) => (value % 12 + 12) % 12;
export const quanshuDoujunMonthPolicy = {
  profile: 'quanshu-doujun-month-from-first-month-v1',
  progression: 'quanshu-first-month-jielan-forward-one-palace-per-month',
  calendar: 'beijing-civil-midnight-at-lunar-month-start',
  leap: 'source-next-month-for-compatible-leap-birth; flow-leap-continuation-unresolved',
  branches: 'named-support-sha-hao-and-ji-contacts-checked-separately',
  templeSupport: 'named-volume-two-temple-major-uniquely-guarding-its-actual-monthly-theme-palace',
  favorableTransforms: 'wuqu-guarding-wealth-and-receiving-lu-quan-ke-or-temple-wuqu-guarding-career-and-meeting-one-stem-group',
  jumenTianji: 'nanyang-ziwei-tianfu-relative-seats-checked-against-the-archive-and-the-month-doujun',
  adversityProof: 'quanshu-doujun-natal-adversity-placements-v1',
} as const;

function contacts(focus: string, positions: readonly PositionedStar[]) {
  return positions.flatMap(row => {
    const relation = quanshuPalaceRelation(focus, row.branch);
    return relation === '其他' ? [] : [{ ...row, relation }];
  });
}

type Contacts = ReturnType<typeof contacts>;
function hasContacts(groups: (Contacts | undefined)[]) {
  return groups.some(rows => rows?.length) ? true : groups.includes(undefined) ? undefined : false;
}

function sourcePalaces(natal: Natal, lifeIndex: number) {
  const themes = [{ natalName: '财帛', index: mod(lifeIndex + 8) }, { natalName: '官禄', index: mod(lifeIndex + 4) }];
  return themes.every(({ natalName, index }) => {
    const named = natal.palaces.filter(p => p.name === natalName);
    return named.length === 1 && named[0].index === index;
  });
}

function readPositions(natal: Natal, basis: NatalBasis) {
  const voids = quanshuKongJiePositions(natal);
  const positions = new Map<string, { branch: string; group: 'majorStars' | 'minorStars' | 'adjectiveStars' } | undefined>();
  for (const palace of natal.palaces) for (const group of ['majorStars', 'minorStars', 'adjectiveStars'] as const) {
    for (const star of palace[group]) positions.set(star.name, positions.has(star.name) ? undefined : { branch: palace.earthlyBranch, group });
  }
  const archiveMajor = (star: string) => {
    const position = positions.get(star);
    return position?.group === 'majorStars' ? position.branch : undefined;
  };
  const verifiedMajors = quanshuVerifiedMajorPositions(archiveMajor);
  const expectedZiwei = quanshuZiweiBirthAnchor(natal, quanshuLifeBureau(natal, basis).verifiedLifeBureau);
  const archivedZiwei = verifiedMajors.get('紫微');
  const ziweiBirthAnchorVerified = expectedZiwei === undefined || archivedZiwei === undefined ? undefined : expectedZiwei === archivedZiwei;
  const major = (star: string) => ziweiBirthAnchorVerified === true ? verifiedMajors.get(star) : undefined;
  const knownMinor = (star: string, branch: string) => {
    const archive = positions.get(star);
    return archive?.group === 'minorStars' && archive.branch === branch ? branch : undefined;
  };
  const { named, noblePair } = quanshuAuxiliaryPositions(basis.birthMonth, basis.birthHour, basis.birthStem);
  const verifiedAuxiliary = new Map(named.map(({ star, branch }) => [star, knownMinor(star, branch)]));
  const verifiedNobles = noblePair.map(branch => ({ star: '魁钺组',
    branch: ['天魁', '天钺'].filter(star => knownMinor(star, branch) !== undefined).length === 1 ? branch : undefined }));
  const ziwei = major('紫微'), tianfu = major('天府');
  const jumen = major('巨门'), tianji = major('天机');
  const jumenTianji = ziwei && tianfu && jumen && tianji ? [
    { star: '巨门', branch: jumen, anchor: '天府', anchorBranch: tianfu },
    { star: '天机', branch: tianji, anchor: '紫微', anchorBranch: ziwei },
  ] : undefined;
  const { archivedFireBell, inconsistentStar, quanshuFixedFireBell } = readQuanshuArchivedFireBell(natal,
    natal.rawDates.chineseDate.yearly[1], natal.rawDates.chineseDate.hourly[1]);
  // An unavailable placement leaves only its own support evidence unknown.
  const namedSupport = [
    { star: '紫微', branch: ziwei }, { star: '天府', branch: tianfu },
    ...Array.from(verifiedAuxiliary, ([star, branch]) => ({ star, branch })),
    ...verifiedNobles,
    { star: '禄存', branch: knownMinor('禄存', basis.lucunBranch) },
  ];
  const verifiedSupport = namedSupport.filter((row): row is PositionedStar => row.branch !== undefined);
  const natalSha = [{ star: '擎羊', branch: basis.qingyangBranch }, { star: '陀罗', branch: basis.tuoluoBranch }]
    .filter(({ star, branch }) => knownMinor(star, branch));
  const sky = voids.ready ? voids.skyBranch : 'verifiedSkyBranch' in voids ? voids.verifiedSkyBranch : undefined;
  const robbery = voids.ready ? voids.robberyBranch : 'verifiedRobberyBranch' in voids ? voids.verifiedRobberyBranch : undefined;
  const verifiedVoids = [...(sky ? [{ star: '天空', branch: sky }] : []), ...(robbery ? [{ star: '地劫', branch: robbery }] : [])];
  const suiqianHao = natal.palaces.filter(p => p.suiqian12 === '大耗');
  // The engine's natal annual cycle names the birth year's opposite seat Dahao.
  // This verifies the product layer, independently of the historical Boshi placement.
  const suiqianHaoBranch = branches[mod(basis.birthYear - 4 + 6)];
  return {
    support: verifiedSupport,
    supportIncomplete: namedSupport.length !== verifiedSupport.length,
    wenqu: verifiedAuxiliary.get('文曲'),
    voids: verifiedVoids, voidsIncomplete: !voids.ready,
    natalSha, natalShaIncomplete: natalSha.length !== 2,
    fireBell: inconsistentStar ? undefined : archivedFireBell, quanshuFixedFireBell,
    major, ziweiBirthAnchorVerified,
    jumenTianji,
    boshiHao: quanshuVerifiedBoshiPosition(natal, basis.birthStem, '大耗'),
    suiqianHao: suiqianHao.length === 1 && suiqianHao[0].earthlyBranch === suiqianHaoBranch ? suiqianHaoBranch : undefined,
    transformations(stem: string) {
      return quanshuTransformations(stem).map(row => {
        const branch = major(row.star) ?? verifiedAuxiliary.get(row.star);
        return { ...row, branch };
      });
    },
  };
}

export function buildQuanshuDoujunMonths(window: Window, natal: Natal) {
  const basis = readQuanshuNatal(natal);
  const natalReady = basis.status === 'ready' && sourcePalaces(natal, basis.lifeIndex)
    && natal.rawDates.chineseDate.yearly[1] === branches[mod(basis.birthYear - 4)];
  const positions = natalReady ? readPositions(natal, basis) : undefined;
  const rows = [];
  let start = window.start;
  while (start < window.end) {
    const date = lunarAtBeijing(start) as ReturnType<typeof lunarAtBeijing> & { getYear(): number; getMonth(): number };
    const lunarYear = date.getYear(), signedMonth = date.getMonth(), lunarMonth = Math.abs(signedMonth);
    const leapMonth = lunar.LunarYear.fromYear(lunarYear).getLeapMonth();
    const nativeStart = Date.parse(lunar.Lunar.fromYmd(lunarYear, signedMonth, 1).getSolar().toYmd() + 'T00:00:00+08:00');
    const nativeEnd = nativeStart + lunar.LunarMonth.fromYm(lunarYear, signedMonth).getDayCount() * day;
    if (!Number.isFinite(nativeEnd) || nativeStart > start || nativeEnd <= start) throw new Error('Invalid Doujun lunar month');
    const end = Math.min(window.end, nativeEnd);
    const common = { profile: quanshuDoujunMonthPolicy.profile, lunarYear, lunarMonth, leap: signedMonth < 0,
      nativeStart: new Date(nativeStart).toISOString(), nativeEnd: new Date(nativeEnd).toISOString() };
    if (!positions || !natalReady || (leapMonth > 0 && (signedMonth < 0 || lunarMonth > leapMonth))) {
      const reason = !natalReady ? (basis.status === 'unsupported_leap' ? 'birth_leap' : 'natal_basis') : 'flow_leap';
      rows.push({ start, end, data: { ...common, ready: false, reason } } as const);
    } else {
      const { birthMonth, birthMonthBasis, birthLeapMonth } = basis;
      const { annualBranch, doujunBranch } = quanshuDoujunPosition(lunarYear, birthMonth, basis.birthHour);
      const branch = branches[mod(branches.indexOf(doujunBranch) + lunarMonth - 1)];
      const palace = natal.palaces.find(p => p.earthlyBranch === branch)!;
      const annualStem = stems[((lunarYear - 4) % 10 + 10) % 10];
      const annual = quanshuLuYangTuo(annualStem);
      const supportContacts = contacts(branch, positions.support);
      const jumenTianjiSameSeatCandidate = ['财帛', '官禄'].includes(palace.name) && '卯酉'.includes(branch)
        && positions.jumenTianji?.every(row => row.branch === branch);
      // The Ming palace chapters separately list these two-star same-seat cases.
      const namedPair = namedPairGuards[palace.name]?.find(row => row.seats.includes(branch));
      const verifyPairGuard = (pair?: { stars: readonly [string, string] }) => {
        if (!pair) return false;
        const seats = pair.stars.map(positions.major);
        return seats.some(seat => seat !== undefined && seat !== branch) ? false : seats.includes(undefined) ? undefined : true;
      };
      const namedPairGuardCandidate = verifyPairGuard(namedPair);
      const templeGuardChecks = Object.entries(templeSupportSeats[palace.name] ?? {})
        .filter(([, seats]) => seats.includes(branch)).map(([star]) => ({ star, branch: positions.major(star) }));
      const templeSupportContacts = templeGuardChecks.filter(row => row.branch === branch)
        .map(row => ({ star: row.star, branch, grade: '庙', relation: '守' }));
      const templeTianji = templeGuardChecks.find(row => row.star === '天机');
      const careerTianjiWenqu = templeTianji?.branch === branch && positions.wenqu
        ? contacts(branch, [{ star: '文曲', branch: positions.wenqu }])[0] : undefined;
      const careerTianjiWenquCandidate = !templeTianji || templeTianji.branch !== undefined && templeTianji.branch !== branch
        ? false : templeTianji.branch === undefined || positions.wenqu === undefined ? undefined : Boolean(careerTianjiWenqu);
      const wealthNamedChecks = palace.name === '财帛' ? [
        ...('寅申'.includes(branch) ? [{ star: '廉贞', chapterSeats: '寅申' }] : []),
        ...('子午辰戌'.includes(branch) ? [{ star: '破军', chapterSeats: '子午'.includes(branch) ? '子午' : '辰戌' }] : []),
      ].map(check => ({ ...check, actual: positions.major(check.star) })) : [];
      const wealthNamedGuards = wealthNamedChecks.filter(check => check.actual === branch)
        .map(({ star, chapterSeats }) => ({ star, branch, chapterSeats }));
      const annualLucunContacts = contacts(branch, [{ star: '禄存', branch: annual.lucunBranch }]);
      const changes = [
        { layer: 'natal', stem: basis.birthStem, stars: positions.transformations(basis.birthStem) },
        { layer: 'yearly', stem: annualStem, stars: positions.transformations(annualStem) },
      ] as const;
      const jiContact = ({ star, branch: seat }: { star: string; branch?: string }) =>
        seat === undefined ? undefined : contacts(branch, [{ star, branch: seat }]);
      const jiContacts = (stars: typeof changes[number]['stars']) => jiContact(stars.find(row => row.kind === '忌')!);
      const wuqu = positions.major('武曲');
      const wuquGuard = wuqu === undefined ? undefined : wuqu === branch;
      const wealthWuquChanges = palace.name === '财帛' ? changes.flatMap(({ layer, stem, stars }) =>
        stars.filter(row => row.star === '武曲' && row.kind !== '忌').map(({ kind }) => ({ layer, stem, kind }))) : [];
      const wealthWuquFavorableCandidate = wealthWuquChanges.length ? wuquGuard : false;
      const wealthWuquJi = palace.name === '财帛' && wuquGuard === true ? changes.flatMap(({ layer, stem, stars }) =>
        stars.filter(row => row.star === '武曲' && row.kind === '忌').map(({ kind }) => ({ layer, stem, kind }))) : [];
      // The Volume II Wuqu entry and the Volume III grade table agree on these temple seats.
      const careerWuquTemple = palace.name === '官禄' && quanshuBrightness('武曲', branch) === '庙' ? wuquGuard : false;
      const careerCheck = careerWuquTemple === false ? [] : changes.map(({ layer, stem, stars }) => {
        const favorable = stars.filter(row => row.kind !== '忌').map(row => ({ ...row,
          relation: row.branch === undefined ? undefined : quanshuPalaceRelation(branch, row.branch) }));
        const candidate = favorable.some(row => row.relation === '其他') ? false
          : careerWuquTemple === undefined || favorable.some(row => row.relation === undefined) ? undefined : true;
        return { layer, stem, candidate, stars: favorable };
      });
      const knownVoids = contacts(branch, positions.voids);
      const voidContacts = knownVoids.length || !positions.voidsIncomplete ? knownVoids : undefined;
      const knownNatalSha = contacts(branch, positions.natalSha);
      const natalShaContacts = knownNatalSha.length || !positions.natalShaIncomplete ? knownNatalSha : undefined;
      const annualShaContacts = contacts(branch, [{ star: '擎羊', branch: annual.qingyangBranch }, { star: '陀罗', branch: annual.tuoluoBranch }]);
      const careerTempleYang = palace.name === '官禄' && positions.natalSha.some(row => row.star === '擎羊' && row.branch === branch)
        && quanshuBrightness('擎羊', branch) === '庙';
      const careerTempleYangSupport = careerTempleYang ? supportContacts.filter(contact => contact.relation === '守') : undefined;
      const archivedFireBellContacts = positions.fireBell && contacts(branch, positions.fireBell);
      const mingFixedFireBellContacts = contacts(branch, positions.quanshuFixedFireBell);
      const careerTianjiClear = (fireBell: Contacts | undefined) => careerTianjiWenquCandidate !== true
        ? careerTianjiWenquCandidate : knownNatalSha.length || fireBell?.length ? false
          : positions.natalShaIncomplete || fireBell === undefined ? undefined : true;
      const careerTianjiArchiveClearCandidate = careerTianjiClear(archivedFireBellContacts);
      const careerTianjiMingClearCandidate = careerTianjiClear(mingFixedFireBellContacts);
      // The Ming career chapter gives the favorable Tian Tong case independently of the following pairings.
      const careerTiantong = palace.name === '官禄' && quanshuBrightness('天同', branch) === '庙';
      const careerTiantongBranch = careerTiantong ? positions.major('天同') : undefined;
      const careerTiantongMingShaContacts = careerTiantongBranch === branch
        ? [...knownNatalSha, ...mingFixedFireBellContacts] : undefined;
      const careerTiantongMingClearCandidate = !careerTiantong ? false : careerTiantongBranch === undefined ? undefined
        : careerTiantongBranch !== branch || careerTiantongMingShaContacts?.length ? false
          : positions.natalShaIncomplete ? undefined : true;
      const boshiHaoContacts = positions.boshiHao ? contacts(branch, [{ star: '大耗', branch: positions.boshiHao }]) : undefined;
      const suiqianHaoContacts = positions.suiqianHao ? contacts(branch, [{ star: '大耗', branch: positions.suiqianHao }]) : undefined;
      const natalJiContacts = jiContacts(changes[0].stars), annualJiContacts = jiContacts(changes[1].stars);
      const mingGengTaboo = quanshuMingTabooStar('庚');
      const mingGengJiContacts = basis.birthStem === '庚' || annualStem === '庚'
        ? jiContact({ star: mingGengTaboo, branch: positions.major(mingGengTaboo) }) : undefined;
      const mingNatalGengJiContacts = basis.birthStem === '庚' ? mingGengJiContacts : undefined;
      const mingAnnualGengJiContacts = annualStem === '庚' ? mingGengJiContacts : undefined;
      const hao = [{ label: '本命博士十二神大耗', rows: boshiHaoContacts }, { label: '本命岁前大耗', rows: suiqianHaoContacts }];
      const ji = [{ label: '生年干化忌', rows: natalJiContacts }, { label: '流年干化忌', rows: annualJiContacts }];
      // Distinguish an unobstructed Ming case from both mixed and incompletely checked cases.
      const mingAdversityGroups = [natalShaContacts, mingFixedFireBellContacts, voidContacts, annualShaContacts,
        basis.birthStem === '庚' ? mingNatalGengJiContacts : natalJiContacts,
        annualStem === '庚' ? mingAnnualGengJiContacts : annualJiContacts];
      const mingDoujunAdversityCandidate = hasContacts(mingAdversityGroups);
      const mingAdversityIncludingHao = hasContacts([...mingAdversityGroups, boshiHaoContacts, suiqianHaoContacts]);
      const mingLuminaryAdversity = palace.name === '财帛' ? mingAdversityIncludingHao : mingDoujunAdversityCandidate;
      function clearTempleLuminary(star: '太阳' | '太阴') {
        const guard = templeGuardChecks.find(row => row.star === star);
        if (!guard || guard.branch !== undefined && guard.branch !== branch || mingLuminaryAdversity === true) return false;
        return guard.branch === undefined || mingLuminaryAdversity === undefined ? undefined : true;
      }
      const wealthTiantongTianliangMingClearCandidate = palace.name !== '财帛' || namedPairGuardCandidate === false
        || mingAdversityIncludingHao === true ? false : namedPairGuardCandidate === undefined || mingAdversityIncludingHao === undefined
          ? undefined : true;
      const tianfu = positions.major('天府'), tianfuGrade = quanshuBrightness('天府', branch);
      const tianfuNamedSeat = palace.name === '财帛' || palace.name === '官禄' && tianfuGrade === '庙';
      const mingTianfuClearCandidate = !tianfuNamedSeat || mingAdversityIncludingHao === true
        || tianfu !== undefined && tianfu !== branch ? false
          : tianfu === undefined || mingAdversityIncludingHao === undefined ? undefined : true;
      // The Lianzhen–Tianxiang same-seat clause applies in each named palace. Keep it separate from Tong–Liang.
      const lianzhenTianxiangGuard = verifyPairGuard(['财帛', '官禄'].includes(palace.name)
        && lianzhenTianxiang.seats.includes(branch) ? lianzhenTianxiang : undefined);
      const mingLianzhenTianxiangClearCandidate = lianzhenTianxiangGuard === false || mingAdversityIncludingHao === true ? false
        : lianzhenTianxiangGuard === undefined || mingAdversityIncludingHao === undefined ? undefined : true;
      const voidHaoJiTogether = palace.name === '财帛' ? knownVoids.flatMap(voidStar => {
        const haoLabels = hao.filter(group => group.rows?.some(row => row.branch === voidStar.branch)).map(group => group.label);
        const jiStars = ji.flatMap(group => (group.rows ?? []).filter(row => row.branch === voidStar.branch)
          .map(row => ({ label: group.label, star: row.star })));
        return haoLabels.length && jiStars.length ? [{ ...voidStar, haoLabels, jiStars }] : [];
      }) : [];
      rows.push({ start, end, data: { ...common, ready: true, birthMonth, birthMonthBasis, birthLeapMonth,
        natalAdversityProof: quanshuDoujunMonthPolicy.adversityProof,
        annualBranch, doujunBranch, branch, natalName: palace.name, ziweiBirthAnchorVerified: positions.ziweiBirthAnchorVerified,
        palaceIndex: palace.index, supportContacts, voidContacts, voidContactsComplete: !positions.voidsIncomplete,
        natalShaContacts, natalShaContactsComplete: !positions.natalShaIncomplete, annualShaContacts, archivedFireBellContacts,
        mingDoujunAdversityCandidate,
        mingSolarTempleClearCandidate: clearTempleLuminary('太阳'),
        mingLunarTempleClearCandidate: clearTempleLuminary('太阴'),
        boshiHaoContacts, suiqianHaoContacts, natalJiContacts, annualJiContacts, mingNatalGengJiContacts, mingAnnualGengJiContacts,
        supportCandidate: hasContacts([supportContacts, positions.supportIncomplete ? undefined : []]),
        annualLucunContacts, annualLucunCandidate: annualLucunContacts.length > 0,
        jumenTianjiSameSeatCandidate,
        jumenTianjiSameSeatWitness: jumenTianjiSameSeatCandidate === true ? { branch, stars: positions.jumenTianji } : undefined,
        namedPairGuardCandidate,
        namedPairGuardWitness: namedPairGuardCandidate === true && namedPair ? { branch, stars: namedPair.stars } : undefined,
        wealthTiantongTianliangMingClearCandidate,
        mingTianfuClearCandidate,
        mingTianfuClearWitness: mingTianfuClearCandidate === true ? { star: '天府', branch, grade: tianfuGrade } : undefined,
        mingLianzhenTianxiangClearCandidate,
        mingLianzhenTianxiangClearWitness: mingLianzhenTianxiangClearCandidate === true
          ? { branch, stars: lianzhenTianxiang.stars } : undefined,
        wealthNamedGuardCandidate: wealthNamedGuards.length > 0 ? true
          : wealthNamedChecks.some(check => check.actual === undefined) ? undefined : false,
        wealthNamedGuards,
        wealthWuquFavorableCandidate, wealthWuquChanges: wealthWuquFavorableCandidate === true ? wealthWuquChanges : [], wealthWuquJi,
        careerWuquLuQuanKeCandidate: careerCheck.some(row => row.candidate === true) ? true
          : careerCheck.some(row => row.candidate === undefined) ? undefined : false,
        careerWuquGroups: careerCheck.filter(row => row.candidate === true).map(({ layer, stem, stars }) => ({ layer, stem, stars })),
        careerTianjiWenquCandidate,
        careerTianjiWenqu,
        quanshuFixedFireBellProfile,
        careerTianjiArchiveClearCandidate, careerTianjiMingClearCandidate,
        careerTianjiCounter: careerTianjiWenqu ? {
          natalYangTuo: natalShaContacts, annualYangTuo: annualShaContacts, archivedFireBell: archivedFireBellContacts,
          mingFixedFireBell: mingFixedFireBellContacts,
        } : undefined,
        careerTiantongMingClearCandidate, careerTiantongMingShaContacts,
        careerTiantongMingClearWitness: careerTiantongMingClearCandidate === true ? { star: '天同', branch, grade: '庙' } : undefined,
        careerTempleYangSupport,
        templeSupportContacts,
        templeSupportCandidate: templeSupportContacts.length > 0 ? true
          : templeGuardChecks.some(row => row.branch === undefined) ? undefined : false,
        shaCandidate: hasContacts([voidContacts, natalShaContacts, annualShaContacts, archivedFireBellContacts]),
        haoCandidate: hasContacts(hao.map(group => group.rows)),
        jiCandidate: hasContacts(ji.map(group => group.rows)),
        voidHaoJiTogether,
      } } as const);
    }
    start = end;
  }
  return rows;
}
