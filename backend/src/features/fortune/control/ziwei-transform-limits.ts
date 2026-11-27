import { describeBaZiPillar } from './bazi-calculation';
import { quanshuZiweiBirthAnchor, quanshuZiweiBirthAnchorProof } from './ziwei-birth-major-anchor';
import { readQuanshuBodyNatal } from './ziwei-body-limits';
import { quanshuFireBellCondition } from './ziwei-firebell';
import { quanshuFireBellAnchors, quanshuFixedFireBellProfile } from './ziwei-firebell-positions';
import { quanshuDecadalVerification, quanshuLifeBureau, quanshuLimitPlacementProof, quanshuPalaceStem } from './ziwei-growth-stages';
import { quanshuKongJiePositions } from './ziwei-kongjie';
import { quanshuVerifiedBoshiPosition } from './ziwei-kongjie-limits';
import { quanshuBrightness, quanshuLuYangTuo, quanshuMinorLimit, quanshuPalaceRelation, quanshuTransformations, quanshuVerifiedMajorPositions, readQuanshuNatal } from './ziwei-quanshu';
import { quanshuShangShiCondition } from './ziwei-source-year';
import { quanshuAuxiliaryPositions } from './ziwei-source-support';

type Natal = Parameters<typeof readQuanshuNatal>[0];
type Frame = { lunarYear: number; yearIndex: number; decadalIndex?: number; minorIndex?: number };
type Layer = 'natal' | 'yearly' | 'decadal' | 'minor';
const branches = '子丑寅卯辰巳午未申酉戌亥', stems = '甲乙丙丁戊己庚辛壬癸';
const visible = ['守', '冲', '三合'];
const aspects = ['冲', '三合'];
const any = (states: (boolean | undefined)[]) => states.includes(true) ? true
  : !states.length || states.includes(undefined) ? undefined : false;
const all = (states: (boolean | undefined)[]) => states.includes(false) ? false : states.includes(undefined) ? undefined : true;
const volumeTwoTabooCases: Readonly<Partial<Record<string, { relief: string; fallen?: string; birthStem?: string }>>> = {
  天同: { relief: '戌', birthStem: '丁' },
  巨门: { relief: '辰', birthStem: '辛' },
  太阳: { relief: '寅卯辰巳午', fallen: '子丑戌亥' },
  太阴: { relief: '酉戌亥子', fallen: '卯辰巳午' },
};
const listedSeat = (positions?: string, branch?: string) => positions === undefined ? false : branch === undefined ? undefined : positions.includes(branch);

export const quanshuTransformLimitPolicy = {
  profile: 'quanshu-transform-limits-v1',
  scope: 'same-candidate-and-half-open-year-limit-intersection',
  table: 'separate-natal-year-and-limit-palace-stem-candidates',
  relation: 'same-seat-and-explicit-geometry-no-mixed-stem-triples',
  luGathering: 'named-helper-pair-or-same-emitter-ke-quan-and-distinct-natal-yang-tuo-or-fire-taboo',
  tianjiLu: 'actual-tianji-guard-with-natal-ke-quan-and-separate-hua-lu-or-lucun',
  tianjiNatalLucunPlacement: 'quanshu-native-minor-lucun-v1',
  tianjiAside: 'actual-opposition-or-trine-with-jumen-and-a-same-layer-yang-tuo-pair',
  mixedSha: 'quanshu-quan-lu-ji-named-contact-palaces-v3',
  namedShaLayers: 'quanshu-transform-native-blade-envoy-layers-v1',
  tabooCases: 'volume-two-named-relief-birth-stems-and-fallen-luminaries-at-actual-limit',
  lianzhenWater: 'quanshu-hai-lianzhen-with-natal-year-nayin-water-v1',
  quanAspect: 'same-contact-palace-within-decadal-opposition-or-trine',
  tabooFollowup: 'quanshu-taboo-followup-same-emitters-and-named-positions-v2',
  natalLuminaryJi: 'quanshu-ming-natal-luminary-ji-v1',
} as const;

export function quanshuTransformLimits(natal: Natal, frame: Frame) {
  const basis = readQuanshuNatal(natal);
  const ordinal = frame.lunarYear - 4;
  const annual = natal.palaces.find(row => row.index === frame.yearIndex);
  if (basis.status !== 'ready' || natal.rawDates.chineseDate.yearly[1] !== branches[((basis.birthYear - 4) % 12 + 12) % 12]
    || !Number.isInteger(frame.lunarYear) || frame.lunarYear < 1 || frame.lunarYear > 9998
    || annual?.earthlyBranch !== branches[(ordinal % 12 + 12) % 12]) return { ready: false } as const;
  const { earthlyBranch: annualBranch } = annual;
  const annualStem = stems[(ordinal % 10 + 10) % 10];
  const birthYearPillar = basis.birthStem + natal.rawDates.chineseDate.yearly[1];
  const birthYearNaYin = describeBaZiPillar(birthYearPillar).naYin;
  const { lifePalacePillar, lifePalaceNaYin, verifiedLifeBureau } = quanshuLifeBureau(natal, basis);
  const decade = natal.palaces.find(row => row.index === frame.decadalIndex);
  const minor = natal.palaces.find(row => row.index === frame.minorIndex);
  if ((frame.decadalIndex !== undefined && !decade) || (frame.minorIndex !== undefined && !minor)) return { ready: false } as const;
  const sourceDecadal = quanshuDecadalVerification(natal, basis, decade, frame.lunarYear, verifiedLifeBureau);
  const sourceDecadalVerified = sourceDecadal?.verified === true;
  const sourceMinor = quanshuMinorLimit(birthYearPillar[1], natal.gender, frame.lunarYear - basis.birthYear + 1);
  const sourceMinorVerified = sourceMinor && minor ? sourceMinor.branch === minor.earthlyBranch : undefined;
  const unique = (positions: string[]) => positions.length === 1 ? positions[0] : undefined;
  const archive = new Map<string, { branch: string; layer: 'majorStars' | 'minorStars' | 'adjectiveStars' } | undefined>();
  for (const palace of natal.palaces) for (const layer of ['majorStars', 'minorStars', 'adjectiveStars'] as const) {
    for (const { name } of palace[layer]) archive.set(name, archive.has(name) ? undefined : { branch: palace.earthlyBranch, layer });
  }
  const verifiedMajors = quanshuVerifiedMajorPositions(star => {
    const row = archive.get(star);
    return row?.layer === 'majorStars' ? row.branch : undefined;
  });
  const aux = quanshuAuxiliaryPositions(basis.birthMonth, basis.birthHour, basis.birthStem);
  const verifiedAuxiliary = new Map(aux.named.map(({ star, branch }) => {
    const row = archive.get(star);
    return [star, row?.layer === 'minorStars' && row.branch === branch ? branch : undefined] as const;
  }));
  const locate = (star: string) => {
    return verifiedMajors.get(star) ?? verifiedAuxiliary.get(star);
  };
  const verifiedPalaceStem = (palace: Natal['palaces'][number]) => {
    const expected = quanshuPalaceStem(basis, palace.index);
    return palace.heavenlyStem === expected ? expected : undefined;
  };
  const emitters: { layer: Layer; stem?: string }[] = [{ layer: 'natal', stem: basis.birthStem }, { layer: 'yearly', stem: annualStem }];
  if (decade && sourceDecadalVerified) emitters.push({ layer: 'decadal', stem: verifiedPalaceStem(decade) });
  if (minor && sourceMinorVerified === true) emitters.push({ layer: 'minor', stem: verifiedPalaceStem(minor) });
  const changes = emitters.map(({ layer, stem }) => ({ layer, stem,
    stars: stem?.length === 1 && stems.includes(stem)
      ? quanshuTransformations(stem).map(row => ({ ...row, branch: locate(row.star) })) : [] }));
  const voids = quanshuKongJiePositions(natal);
  const ancientSky = voids.ready ? voids.skyBranch : 'verifiedSkyBranch' in voids ? voids.verifiedSkyBranch : undefined;
  const robbery = voids.ready ? voids.robberyBranch : 'verifiedRobberyBranch' in voids ? voids.verifiedRobberyBranch : undefined;
  const sourceHourVoids = [{ star: '古天空', branch: ancientSky }, { star: '地劫', branch: robbery }];
  const firebell = quanshuFireBellCondition(natal, annual.index, annual.index, frame.lunarYear, 'yearly', decade?.index, minor?.index);
  const assistant = quanshuShangShiCondition(natal, annual.index, annual.index, frame.lunarYear, 'yearly', decade?.index, minor?.index);
  const annualSha = quanshuLuYangTuo(annualStem);
  const natalYangTuo = [{ star: '擎羊', branch: basis.qingyangBranch }, { star: '陀罗', branch: basis.tuoluoBranch }]
    .map(({ star, branch }) => {
      const stored = archive.get(star);
      return { star, branch: stored?.layer === 'minorStars' && stored.branch === branch ? branch : undefined };
    });
  const [nativeYang] = natalYangTuo;
  const envoyBranch = assistant.ready ? assistant.positions.find(s => s.star === '天使')?.branch : undefined;
  const verifiedEnvoy = archive.get('天使')?.layer === 'adjectiveStars' ? envoyBranch : undefined;
  const suiqianHao = unique(natal.palaces.filter(p => p.suiqian12 === '大耗').map(p => p.earthlyBranch));
  const verifiedSuiqianHao = suiqianHao && quanshuPalaceRelation(birthYearPillar[1], suiqianHao) === '冲' ? suiqianHao : undefined;
  const hazards = [...natalYangTuo,
    { star: '流年擎羊', branch: annualSha.qingyangBranch }, { star: '流年陀罗', branch: annualSha.tuoluoBranch },
    ...sourceHourVoids,
    { star: '归档火星', branch: firebell.ready ? firebell.archivedFireBell.find(s => s.star === '火星')?.branch : undefined },
    { star: '归档铃星', branch: firebell.ready ? firebell.archivedFireBell.find(s => s.star === '铃星')?.branch : undefined },
    { star: '天使', branch: verifiedEnvoy },
    { star: '博士系大耗', branch: quanshuVerifiedBoshiPosition(natal, basis.birthStem, '大耗') },
    { star: '岁前大耗', branch: verifiedSuiqianHao }];
  const helperPairs = [
    ...[['紫微', '天府'], ['文昌', '文曲'], ['左辅', '右弼']].map(stars => ({
      label: stars.join(''), members: stars.map(star => ({ star, branch: locate(star) })),
    })),
    { label: '魁钺组', members: aux.noblePair.map(branch => ({ star: '魁钺组', branch })) },
  ];
  const helpers = helperPairs.filter(pair => pair.label !== '魁钺组').flatMap(pair => pair.members);
  const troubleGroup = hazards.filter(row => !['归档火星', '归档铃星'].includes(row.star));
  const annualYangTuo = hazards.filter(row => ['流年擎羊', '流年陀罗'].includes(row.star));
  const annualYang = annualYangTuo.find(row => row.star === '流年擎羊')!;
  const archivedFireBell = hazards.filter(row => ['归档火星', '归档铃星'].includes(row.star));
  const natalFourSha = [...natalYangTuo, ...archivedFireBell];
  const archivedFire = archivedFireBell.find(row => row.star === '归档火星')!;
  const jielanFire = firebell.ready ? firebell.jielanFireBell.find(row => row.star === '火星')?.branch : undefined;
  const quanshuFixedFireBell = quanshuFireBellAnchors(birthYearPillar[1]).engineNamedAnchors;
  const [{ branch: fixedFire }, fixedBell] = quanshuFixedFireBell;
  const mingYangWithBell = fixedBell.branch !== basis.qingyangBranch ? false
    : nativeYang.branch === undefined ? undefined : true;
  const nativeMixedGroup = hazards.filter(row => ['擎羊', '归档火星', '归档铃星', '古天空'].includes(row.star));
  const tianjiSeat = locate('天机');
  const jumenSeat = locate('巨门');
  const archivedLucun = archive.get('禄存');
  const verifiedNatalLucun = archivedLucun?.layer === 'minorStars' && archivedLucun.branch === basis.lucunBranch
    ? archivedLucun.branch : undefined;
  const decadalBranch = decade?.earthlyBranch, minorBranch = minor?.earthlyBranch;
  const tripleSeat = decadalBranch && minorBranch ? decadalBranch === annualBranch && minorBranch === annualBranch : undefined;
  const verifiedTripleSeat = all([
    sourceDecadalVerified ? decadalBranch === annualBranch : undefined,
    sourceMinorVerified === true ? minorBranch === annualBranch : undefined,
  ]);
  const chartCategory = ['女', '男'].includes(natal.gender) ? natal.gender : undefined;
  const selections = [decade && { layer: 'decadal', branch: decadalBranch! }, minor && { layer: 'minor', branch: minorBranch! }]
    .flatMap(seat => seat ? [seat] : []);
  const seats = selections.map(seat => {
    const tabooSeat = seat.layer === 'decadal' && verifiedTripleSeat === true;
    const related = (branch?: string) => branch && quanshuPalaceRelation(seat.branch, branch);
    const matches = (branch: string | undefined, area: readonly string[]) => {
      const relation = related(branch);
      return relation === undefined ? undefined : area.includes(relation);
    };
    const presence = (rows: { branch?: string }[], area: readonly string[]) => any(rows.map(row => matches(row.branch, area)));
    const wholePair = (rows: { branch?: string }[]) => all(rows.map(row => matches(row.branch, visible)));
    const supportPairs = helperPairs.map(pair => ({ label: pair.label,
      stars: pair.members.map(row => ({ ...row, relation: related(row.branch) })),
      present: all([wholePair(pair.members), presence(pair.members, ['守'])]),
    }));
    const visibleTrouble = presence(troubleGroup, visible);
    const natalMixedGuard = presence(nativeMixedGroup, ['守']);
    const annualYangGuard = matches(annualYang.branch, ['守']);
    const natalMixedContacts = nativeMixedGroup.map(row => ({ ...row, relation: related(row.branch) }));
    const namedMixedContacts = natalMixedContacts.filter(row => row.relation && visible.includes(row.relation));
    const natalMixedPair = namedMixedContacts.length >= 2 ? true
      : namedMixedContacts.length + natalMixedContacts.filter(row => row.relation === undefined).length >= 2 ? undefined : false;
    const annualYangRelation = related(annualYang.branch);
    const annualYangCoStars = natalMixedContacts.filter(row => row.star !== '擎羊');
    const annualYangMixedAspect = all([matches(annualYang.branch, aspects), any(annualYangCoStars.map(row =>
      row.branch === undefined ? undefined : row.branch === annualYang.branch))]);
    const archivedFireSeen = matches(archivedFire.branch, visible);
    const jielanFireSeen = matches(jielanFire, visible);
    const namedSupportSeen = any(supportPairs.map(row => row.present));
    const nativeYangTuoSeen = wholePair(natalYangTuo), yearYangTuoSeen = wholePair(annualYangTuo);
    const tianjiAtLimit = matches(tianjiSeat, ['守']);
    const tianjiAspect = all([matches(tianjiSeat, ['冲', '三合']), matches(jumenSeat, visible)]);
    const tianjiNatalYangTuo = all([tianjiAspect, nativeYangTuoSeen]);
    const tianjiYearYangTuo = all([tianjiAspect, yearYangTuoSeen]);
    const groups = changes.map(group => {
      const stars = group.stars.map(row => ({ ...row, relation: related(row.branch) }));
      const reads = (kind: string, area: readonly string[]) => matches(stars.find(star => star.kind === kind)?.branch, area);
      const lu = reads('禄', ['守']);
      const ji = reads('忌', ['守']);
      const jiLuQuan = all([ji, lu, reads('权', ['守'])]);
      const jiNatalShaGuard = all([jiLuQuan, natalMixedGuard]);
      const jiYearYangGuard = all([jiLuQuan, annualYangGuard]);
      const jiNatalShaPair = all([jiLuQuan, natalMixedPair]);
      const jiYearYangMixedAspect = all([jiLuQuan, annualYangMixedAspect]);
      const jiYearYangMixedWitnesses = jiYearYangMixedAspect === true
        ? [{ ...annualYang, relation: annualYangRelation }, ...annualYangCoStars.filter(row => row.branch === annualYang.branch)]
        : undefined;
      const tabooStar = stars.find(row => row.kind === '忌');
      const tabooCase = tabooStar && volumeTwoTabooCases[tabooStar.star];
      const reliefBirthStem = tabooCase?.birthStem;
      const jiVolumeTwoRelief = tabooStar && all([ji, listedSeat(tabooCase?.relief, tabooStar.branch),
        reliefBirthStem === undefined || basis.birthStem === reliefBirthStem]);
      const jiVolumeTwoBirthStemRelief = reliefBirthStem === undefined ? false : jiVolumeTwoRelief;
      const jiVolumeTwoFallen = tabooStar && all([ji, listedSeat(tabooCase?.fallen, tabooStar.branch)]);
      const tabooGrade = tabooStar?.branch ? quanshuBrightness(tabooStar.star, tabooStar.branch) : undefined;
      const mixedTabooSummaryGrade = jiLuQuan === true ? tabooGrade : undefined;
      const jiVolumeTwoTemple = all([ji, tabooGrade === undefined ? undefined : tabooGrade === '庙']);
      const jiLianzhenHaiWaterYear = all([ji, tabooStar && tabooStar.star === '廉贞',
        tabooStar?.branch === undefined ? undefined : tabooStar.branch === '亥',
        birthYearNaYin === undefined ? undefined : birthYearNaYin.endsWith('水')]);
      const quanSha = all([reads('权', ['守']), visibleTrouble]);
      const quan = stars.find(star => star.kind === '权');
      const quanAspectSha = seat.layer !== 'decadal' || quan?.relation === undefined ? undefined : aspects.includes(quan.relation)
        ? any(troubleGroup.map(row => row.branch === undefined ? undefined : row.branch === quan.branch)) : false;
      const quanAspectHazards = quanAspectSha === true
        ? troubleGroup.filter(row => row.branch === quan?.branch).map(row => ({ ...row, relation: quan?.relation })) : undefined;
      const tabooBenefics = tabooSeat && ji === true ? stars.filter(row => row.kind !== '忌') : undefined;
      const keQuanVisible = all([reads('科', visible), reads('权', visible)]);
      const tianjiKeQuan = all([tianjiAtLimit, keQuanVisible]);
      const tianjiSanHua = all([tianjiKeQuan, reads('禄', visible)]);
      const lucunBranch = group.layer === 'natal' ? verifiedNatalLucun : group.layer === 'yearly' ? annualSha.lucunBranch : undefined;
      const tianjiLucun = lucunBranch === undefined ? undefined : { star: group.layer === 'natal' ? '本命禄存' : '流年禄存',
        branch: lucunBranch, relation: related(lucunBranch) };
      const tianjiLucunKeQuan = tianjiLucun && all([tianjiKeQuan, matches(tianjiLucun.branch, visible)]);
      const luKeQuan = all([lu, keQuanVisible]);
      const luSupportPair = all([lu, namedSupportSeen]);
      const luNatalYangTuo = all([lu, nativeYangTuoSeen]);
      const luFireTaboo = all([lu, archivedFireSeen, reads('忌', visible)]);
      const luJielanFireTaboo = all([lu, jielanFireSeen, reads('忌', visible)]);
      const luQuanshuFixedFireTaboo = group.layer === 'natal'
        ? all([lu, matches(fixedFire, visible), reads('忌', visible),
          seat.layer === 'decadal' || sourceMinorVerified === true ? true : undefined])
        : undefined;
      const jiMingYangBellAspect = group.layer === 'natal'
        ? all([jiLuQuan, mingYangWithBell, matches(fixedBell.branch, aspects),
          seat.layer === 'decadal' || sourceMinorVerified === true ? true : undefined])
        : undefined;
      const jiMingYangBellAspectWitnesses = jiMingYangBellAspect === true
        ? [{ ...nativeYang, relation: related(nativeYang.branch) },
          { ...fixedBell, relation: related(fixedBell.branch) }] : undefined;
      return { layer: group.layer, stem: group.stem, stars,
        lu, ji, jiLuQuan, jiSha: any([jiNatalShaGuard, jiYearYangGuard, jiNatalShaPair, jiYearYangMixedAspect]),
        jiMingYangBellAspect, jiMingYangBellAspectWitnesses,
        jiNatalShaGuard, jiYearYangGuard, jiNatalShaPair, jiYearYangMixedAspect, jiYearYangMixedWitnesses, mixedTabooSummaryGrade,
        jiVolumeTwoRelief, jiVolumeTwoBirthStemRelief, jiVolumeTwoFallen, jiVolumeTwoTemple, jiLianzhenHaiWaterYear,
        reliefBirthStem: jiVolumeTwoRelief === true ? reliefBirthStem : undefined,
        quanSha, quanAspectSha, quanAspectHazards, tabooBenefics, tianjiSanHua, tianjiLucun, tianjiLucunKeQuan,
        luKeQuan, luSupportPair, luNatalYangTuo,
        luFireTaboo, luJielanFireTaboo, luQuanshuFixedFireTaboo };
    });
    const natalTabooBenefics = groups.find(group => group.layer === 'natal')?.tabooBenefics;
    const tabooHelperPairs = supportPairs.filter(pair => pair.label !== '魁钺组');
    const tabooFollowup = tabooSeat && groups.some(group => group.ji === true) ? {
      fourSha: natalFourSha.map(row => ({ ...row, relation: related(row.branch) })),
      fourShaGuard: all(natalFourSha.map(row => matches(row.branch, ['守']))),
      fourShaVisible: wholePair(natalFourSha),
      yangFireBellSky: natalMixedContacts,
      yangFireBellSkyGuard: all(nativeMixedGroup.map(row => matches(row.branch, ['守']))),
      yangFireBellSkyVisible: wholePair(nativeMixedGroup),
      helperPairs: tabooHelperPairs.map(({ label, stars }) => ({
        label, stars, guards: all(stars.map(row => matches(row.branch, ['守']))), visible: wholePair(stars),
      })),
      natalAssembly: natalTabooBenefics ? {
        beneficsGuard: all(natalTabooBenefics.map(row => matches(row.branch, ['守']))),
        beneficsVisible: wholePair(natalTabooBenefics),
        helpersVisible: all(tabooHelperPairs.map(pair => wholePair(pair.stars))),
      } : undefined,
    } : undefined;
    const mixedTabooContext = groups.some(group => group.jiLuQuan === true) ? {
      namedPositions: natalMixedContacts,
      allNamedGuard: all(natalMixedContacts.map(row => matches(row.branch, ['守']))),
      allNamedVisible: wholePair(natalMixedContacts),
      sourceHourVoidContacts: sourceHourVoids.map(row => ({ ...row, relation: related(row.branch) })),
      bothSourceHourVoidsOutside: all(sourceHourVoids.map(({ branch }) => {
        const seen = matches(branch, visible);
        return seen === undefined ? undefined : !seen;
      })),
      modernSkyPositions: voids.ready ? voids.modernSkyBranches.map(branch => ({
        star: '今法天空', branch, relation: related(branch),
      })) : undefined,
      helperPairs: supportPairs.filter(pair => ['紫微天府', '文昌文曲'].includes(pair.label)),
    } : undefined;
    return { ...seat, groups, supportPairs, namedMixedContacts, hazards: hazards.map(row => ({ ...row, relation: related(row.branch) })),
      helpers: helpers.map(row => ({ ...row, relation: related(row.branch) })),
      tabooFollowup, mixedTabooContext, jielanFire: { branch: jielanFire, relation: related(jielanFire) },
      quanshuFixedFire: { branch: fixedFire, relation: related(fixedFire) },
      tianjiNatalYangTuo, tianjiYearYangTuo, tianji: { star: '天机', branch: tianjiSeat, relation: related(tianjiSeat) },
      jumen: { star: '巨门', branch: jumenSeat, relation: related(jumenSeat) } };
  });
  const minorSeat = seats.find(seat => seat.layer === 'minor'), decadeSeat = seats.find(seat => seat.layer === 'decadal');
  const verifiedDecadeSeat = sourceDecadalVerified ? decadeSeat : undefined;
  const rawNatalAtDecade = decadeSeat?.groups.find(row => row.layer === 'natal');
  const natalAtDecade = sourceDecadalVerified ? rawNatalAtDecade : undefined;
  const natalQuanAtDecade = natalAtDecade?.stars.find(row => row.kind === '权');
  // The Ming edition calls 破军 化耗. This reading requires a distinct Quan recipient at the same seat.
  const pojunBranch = locate('破军');
  const decadalNatalQuanPojunHaoCandidate = all([
    natalQuanAtDecade === undefined ? undefined : natalQuanAtDecade.star !== '破军',
    natalQuanAtDecade?.branch && pojunBranch ? natalQuanAtDecade.branch === pojunBranch : undefined,
    natalQuanAtDecade?.relation === undefined ? undefined : visible.includes(natalQuanAtDecade.relation),
  ]);
  const decadalNatalQuanPojunHaoWitness = decadalNatalQuanPojunHaoCandidate === true ? {
    stem: basis.birthStem, quanStar: natalQuanAtDecade?.star, branch: pojunBranch,
    decadalBranch, relation: natalQuanAtDecade?.relation,
  } : undefined;
  // 〈问天伤天使〉另称「限至大耗号天伤」，其本命位在奴仆宫。
  const tianshang = archive.get('天伤');
  const servant = natal.palaces.find(palace => palace.index === (basis.lifeIndex + 5) % 12);
  const tianshangBranch = tianshang?.layer === 'adjectiveStars' && servant?.name === '仆役'
    && tianshang.branch === servant.earthlyBranch ? tianshang.branch : undefined;
  const decadalNatalQuanTianShangHaoCandidate = all([
    natalQuanAtDecade?.branch && tianshangBranch ? natalQuanAtDecade.branch === tianshangBranch : undefined,
    natalQuanAtDecade?.relation === undefined ? undefined : visible.includes(natalQuanAtDecade.relation),
  ]);
  const decadalNatalQuanTianShangHaoWitness = decadalNatalQuanTianShangHaoCandidate === true ? {
    stem: basis.birthStem, quanStar: natalQuanAtDecade?.star, branch: tianshangBranch,
    decadalBranch, relation: natalQuanAtDecade?.relation,
  } : undefined;
  // Both named interpretations of 耗 reach the same real decade together with
  // the two blades, envoy, and both verified old void stars.
  const quanNamedAssembly = [...natalYangTuo, { star: '破军', branch: pojunBranch },
    { star: '天伤', branch: tianshangBranch }, { star: '天使', branch: verifiedEnvoy },
    { star: '古天空', branch: ancientSky }, { star: '地劫', branch: robbery }].map(row => ({
    ...row, relation: verifiedDecadeSeat && row.branch ? quanshuPalaceRelation(verifiedDecadeSeat.branch, row.branch) : undefined,
  }));
  const natalQuanGuardsDecade = natalQuanAtDecade?.relation === undefined ? undefined : natalQuanAtDecade.relation === '守';
  const reachesDecade = ({ relation }: typeof quanNamedAssembly[number]) =>
    relation === undefined ? undefined : visible.includes(relation);
  const decadalNatalQuanNamedAssemblyCandidate = all([
    natalQuanGuardsDecade, natalQuanAtDecade && natalQuanAtDecade.star !== '破军', ...quanNamedAssembly.map(reachesDecade),
  ]);
  const shangShiAssembly = quanNamedAssembly.filter(row => row.star !== '破军');
  const decadalNatalQuanShangShiAssemblyCandidate = all([natalQuanGuardsDecade,
    decadalNatalQuanNamedAssemblyCandidate !== true, ...shangShiAssembly.map(reachesDecade)]);
  const pojunAssembly = quanNamedAssembly.filter(row => row.star !== '天伤');
  const decadalNatalQuanPojunAssemblyCandidate = all([natalQuanGuardsDecade,
    natalQuanAtDecade && natalQuanAtDecade.star !== '破军', decadalNatalQuanNamedAssemblyCandidate !== true,
    ...pojunAssembly.map(reachesDecade)]);
  const decadalNatalQuanNamedAssemblyWitness = decadalNatalQuanNamedAssemblyCandidate === true ? {
    stem: basis.birthStem, quanStar: natalQuanAtDecade?.star, decadalBranch: verifiedDecadeSeat?.branch,
    companions: quanNamedAssembly,
  } : undefined;
  const decadalNatalQuanShangShiAssemblyWitness = decadalNatalQuanShangShiAssemblyCandidate === true ? {
    stem: basis.birthStem, quanStar: natalQuanAtDecade?.star, decadalBranch: verifiedDecadeSeat?.branch,
    companions: shangShiAssembly,
  } : undefined;
  const decadalNatalQuanPojunAssemblyWitness = decadalNatalQuanPojunAssemblyCandidate === true ? {
    stem: basis.birthStem, quanStar: natalQuanAtDecade?.star, decadalBranch: verifiedDecadeSeat?.branch,
    companions: pojunAssembly,
  } : undefined;
  const eitherVerifiedLimit = (select: (seat: typeof seats[number]) => boolean | undefined) => any([
    verifiedDecadeSeat && select(verifiedDecadeSeat),
    sourceMinorVerified === true && minorSeat ? select(minorSeat) : undefined,
  ]);
  const natalLuminaryJiRelief = (birthStem: '甲' | '乙') => all([basis.birthStem === birthStem,
    eitherVerifiedLimit(seat => seat.groups.find(row => row.layer === 'natal')?.jiVolumeTwoRelief),
  ]);
  const sunNatalJiReliefGuard = natalLuminaryJiRelief('甲');
  const moonNatalJiReliefGuard = natalLuminaryJiRelief('乙');
  const natalLuminaryNeedsBirthAnchor = sunNatalJiReliefGuard === true || moonNatalJiReliefGuard === true;
  const natalQuanNeedsBirthAnchor = decadalNatalQuanNamedAssemblyCandidate === true
    || decadalNatalQuanShangShiAssemblyCandidate === true || decadalNatalQuanPojunAssemblyCandidate === true;
  const expectedZiwei = natalLuminaryNeedsBirthAnchor || natalQuanNeedsBirthAnchor
    ? quanshuZiweiBirthAnchor(natal, verifiedLifeBureau) : undefined;
  const birthAnchorProof = expectedZiwei !== undefined && expectedZiwei === verifiedMajors.get('紫微')
    ? quanshuZiweiBirthAnchorProof : undefined;
  const natalLuminaryJiBirthAnchorProof = natalLuminaryNeedsBirthAnchor ? birthAnchorProof : undefined;
  const decadalNatalQuanBirthAnchorProof = natalQuanNeedsBirthAnchor ? birthAnchorProof : undefined;
  const natalLianzhenHaiBothWaterGuard = all([basis.birthStem === '丙',
    verifiedLifeBureau === undefined ? undefined : verifiedLifeBureau === '水二局',
    eitherVerifiedLimit(seat => seat.groups.find(row => row.layer === 'natal')?.jiLianzhenHaiWaterYear),
  ]);
  const femaleChart = chartCategory === undefined ? undefined : chartCategory === '女';
  const natalTransformStars = changes.find(row => row.layer === 'natal')!.stars;
  const natalLu = natalTransformStars.find(row => row.kind === '禄')!;
  const natalLuKeQuan = natalTransformStars.filter(row => row.kind !== '忌');
  const careerIndex = (basis.lifeIndex + 4) % 12;
  const career = natal.palaces.filter(row => row.name === '官禄');
  const verifiedCareer = career.length === 1 && career[0].index === careerIndex ? career[0].earthlyBranch : undefined;
  const isCareer = decade && (decade.index !== careerIndex ? false : verifiedCareer === undefined ? undefined : true);
  const isLife = decadalBranch === undefined ? undefined : decadalBranch === basis.lifeBranch;
  const body = decadalBranch !== undefined && !isLife && !isCareer ? readQuanshuBodyNatal(natal) : undefined;
  const isBody = body?.ready === true ? body.bodyBranch === decadalBranch : undefined;
  const femaleVerifiedDoubleGuardAtNamedPalace = all([femaleChart, any([isLife, isCareer, isBody]),
    sourceDecadalVerified ? true : undefined,
    sourceMinorVerified === true && decadalBranch !== undefined ? minorBranch === decadalBranch : undefined,
  ]);
  const femaleNatalLuKeQuanDoubleGuardCandidate = all([femaleVerifiedDoubleGuardAtNamedPalace,
    ...natalLuKeQuan.map(row => row.branch === undefined || decadalBranch === undefined ? undefined : row.branch === decadalBranch),
  ]);
  const namedPalace = isLife ? '命宫' : isCareer ? '官禄' : '身宫';
  const femaleNatalLuKeQuanDoubleGuardWitness = femaleNatalLuKeQuanDoubleGuardCandidate === true
    ? { branch: decadalBranch, palace: namedPalace, stem: basis.birthStem, stars: natalLuKeQuan } : undefined;
  const natalJi = natalAtDecade?.stars.find(row => row.kind === '忌');
  const namedLuSha = [...natalYangTuo, { star: '火星', branch: fixedFire }].map(row => ({ ...row,
    relation: row.branch && verifiedDecadeSeat ? quanshuPalaceRelation(verifiedDecadeSeat.branch, row.branch) : undefined }));
  const namedLuOpposition = any([...namedLuSha, natalJi].map(row => row?.relation === undefined ? undefined : row.relation === '冲'));
  const femaleNatalLuNamedShaDoubleGuardCandidate = all([femaleVerifiedDoubleGuardAtNamedPalace,
    natalAtDecade?.luNatalYangTuo, natalAtDecade?.luQuanshuFixedFireTaboo, namedLuOpposition]);
  const femaleNatalLuNamedShaDoubleGuardWitness = femaleNatalLuNamedShaDoubleGuardCandidate === true ? {
    branch: decadalBranch, palace: namedPalace, stem: basis.birthStem, lu: natalLu,
    ji: natalJi, sha: namedLuSha,
  } : undefined;
  const femaleNatalLuCunCoGuardCandidate = all([femaleChart,
    natalLu.branch === undefined ? undefined : natalLu.branch === basis.lucunBranch,
    verifiedNatalLucun === undefined ? undefined : true,
    eitherVerifiedLimit(seat => seat.branch === basis.lucunBranch)]);
  const femaleNatalLuCunCoGuards = femaleNatalLuCunCoGuardCandidate === true
    ? seats.filter(seat => (seat.layer === 'decadal' ? sourceDecadalVerified : sourceMinorVerified === true)
      && seat.branch === basis.lucunBranch)
      .map(seat => ({ scope: seat.layer, branch: seat.branch, stem: basis.birthStem, star: natalLu.star })) : [];
  return { ready: true, profile: quanshuTransformLimitPolicy.profile, lunarYear: frame.lunarYear, annualStem, annualBranch,
    namedShaLayerProof: quanshuTransformLimitPolicy.namedShaLayers,
    limitPlacementProof: quanshuLimitPlacementProof, decadalBranch, minorBranch, sourceDecadal,
    sourceMinor: sourceMinor && { ...sourceMinor, verified: sourceMinorVerified }, chartCategory, seats, tripleSeat,
    birthYearPillar, birthYearNaYin, lifePalacePillar, lifePalaceNaYin, verifiedLifeBureau,
    minorLuCandidate: any(minorSeat?.groups.map(row => row.lu) ?? []),
    minorNatalLuGuard: sourceMinorVerified === true ? minorSeat?.groups.find(row => row.layer === 'natal')?.lu : undefined,
    decadalQuanShaCandidate: any(verifiedDecadeSeat?.groups.map(row => row.quanSha) ?? []),
    decadalQuanAspectShaCandidate: any(verifiedDecadeSeat?.groups.map(row => row.quanAspectSha) ?? []),
    decadalNatalQuanSha: natalAtDecade?.quanSha,
    decadalNatalQuanAspectSha: natalAtDecade?.quanAspectSha,
    decadalNatalQuanPojunHaoCandidate, decadalNatalQuanPojunHaoWitness,
    decadalNatalQuanTianShangHaoCandidate, decadalNatalQuanTianShangHaoWitness,
    decadalNatalQuanNamedAssemblyCandidate, decadalNatalQuanNamedAssemblyWitness, decadalNatalQuanBirthAnchorProof,
    decadalNatalQuanShangShiAssemblyCandidate, decadalNatalQuanShangShiAssemblyWitness,
    decadalNatalQuanPojunAssemblyCandidate, decadalNatalQuanPojunAssemblyWitness,
    tripleTabooCandidate: all([verifiedTripleSeat, any(verifiedDecadeSeat?.groups.map(row => row.ji) ?? [])]),
    tripleNatalJiGuard: all([tripleSeat, rawNatalAtDecade?.ji]),
    tripleNatalJiVerifiedGuard: all([verifiedTripleSeat, natalAtDecade?.ji]),
    tabooFollowupProfile: verifiedDecadeSeat?.tabooFollowup ? quanshuTransformLimitPolicy.tabooFollowup : undefined,
    femaleLuSupportCandidate: all([femaleChart, eitherVerifiedLimit(seat => any(seat.groups.flatMap(row => [row.luKeQuan, row.luSupportPair])))]),
    femaleLuShaCandidate: all([femaleChart, eitherVerifiedLimit(seat => any(seat.groups.flatMap(row => [row.luNatalYangTuo, row.luFireTaboo])))]),
    jielanFireBellProfile: firebell.ready ? firebell.jielanFireBellProfile : undefined,
    femaleLuJielanFireTabooCandidate: all([femaleChart, eitherVerifiedLimit(seat => any(seat.groups.map(row => row.luJielanFireTaboo)))]),
    quanshuFixedFireBellProfile, quanshuFixedFireBell,
    femaleLuQuanshuFixedFireTabooCandidate: all([femaleChart, eitherVerifiedLimit(seat =>
      seat.groups.find(row => row.layer === 'natal')?.luQuanshuFixedFireTaboo)]),
    femaleNatalLuCunCoGuardCandidate, femaleNatalLuCunCoGuards,
    femaleNatalLuKeQuanDoubleGuardCandidate, femaleNatalLuKeQuanDoubleGuardWitness,
    femaleNatalLuNamedShaDoubleGuardCandidate, femaleNatalLuNamedShaDoubleGuardWitness,
    tianjiSanHuaCandidate: eitherVerifiedLimit(seat => any(seat.groups.map(row => row.tianjiSanHua))),
    tianjiNatalSanHuaCandidate: eitherVerifiedLimit(seat => seat.groups.find(row => row.layer === 'natal')?.tianjiSanHua),
    tianjiNatalLucunKeQuanCandidate: eitherVerifiedLimit(seat => seat.groups.find(row => row.layer === 'natal')?.tianjiLucunKeQuan),
    tianjiNatalLucunPlacementProof: verifiedNatalLucun === undefined ? undefined : quanshuTransformLimitPolicy.tianjiNatalLucunPlacement,
    tianjiYearLucunKeQuanCandidate: eitherVerifiedLimit(seat => seat.groups.find(row => row.layer === 'yearly')?.tianjiLucunKeQuan),
    tianjiShaAspectCandidate: eitherVerifiedLimit(seat => any([seat.tianjiNatalYangTuo, seat.tianjiYearYangTuo])),
    sameSourceQuanLuJiShaCandidate: eitherVerifiedLimit(seat => any(seat.groups.map(row => row.jiSha))),
    natalQuanLuJiShaAtLimit: eitherVerifiedLimit(seat => seat.groups.find(row => row.layer === 'natal')?.jiSha),
    natalQuanLuJiMingYangBellAspectAtLimit: eitherVerifiedLimit(seat => seat.groups.find(row => row.layer === 'natal')?.jiMingYangBellAspect),
    natalLuminaryJiProfile: quanshuTransformLimitPolicy.natalLuminaryJi,
    natalLuminaryJiBirthAnchorProof,
    sunNatalJiReliefGuard, moonNatalJiReliefGuard,
    volumeTwoNamedBirthStemJiReliefCandidate: eitherVerifiedLimit(seat => any(seat.groups.map(row => row.jiVolumeTwoBirthStemRelief))),
    volumeTwoTabooReliefAtLimitCandidate: eitherVerifiedLimit(seat => any(seat.groups.map(row => row.jiVolumeTwoRelief))),
    volumeTwoTabooFallenAtLimitCandidate: eitherVerifiedLimit(seat => any(seat.groups.map(row => row.jiVolumeTwoFallen))),
    volumeTwoTabooTempleAtLimitCandidate: eitherVerifiedLimit(seat => any(seat.groups.map(row => row.jiVolumeTwoTemple))),
    lianzhenWaterProfile: quanshuTransformLimitPolicy.lianzhenWater,
    lianzhenHaiWaterYearAtLimitCandidate: eitherVerifiedLimit(seat => any(seat.groups.map(row => row.jiLianzhenHaiWaterYear))),
    natalLianzhenHaiBothWaterGuard,
    mixedShaProfile: quanshuTransformLimitPolicy.mixedSha,
  } as const;
}
