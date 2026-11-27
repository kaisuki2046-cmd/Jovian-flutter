import { baziInteractions, baziStemControls, baziStemFeeds, describeBaZiPillar } from './bazi-calculation';

export const zpqzLuckPolicy = 'zpqz-hidden-roots-luck-atomic-v1';
export const zpqzRootPairingPolicy = 'zpqz-cross-layer-root-pairing-v3';
const layers = ['year', 'month', 'day', 'hour'] as const;
type Natal = Record<typeof layers[number], string>;
const unique = <T,>(values: T[]) => [...new Set(values)];
// Only roles stated in the cited chapter. Engine hidden-stem order is not a
// strength score, and no full twelve-branch source table is inferred from it.
const sourceRoles: Record<string, Record<string, string>> = {
  寅: { 甲: '当旺之气', 丙: '方生之气', 戊: '寄生之气' },
  辰: { 戊: '土之本气', 乙: '春之余气', 癸: '水之墓' },
  亥: { 壬: '壬禄之根', 甲: '甲长生之根' },
};
const groups = [
  { kind: '三合', values: '申子辰' }, { kind: '三合', values: '亥卯未' },
  { kind: '三合', values: '寅午戌' }, { kind: '三合', values: '巳酉丑' },
  { kind: '三会', values: '亥子丑' }, { kind: '三会', values: '寅卯辰' },
  { kind: '三会', values: '巳午未' }, { kind: '三会', values: '申酉戌' },
];
const sourceMeetingByLuckBranch: Readonly<Partial<Record<string, { natalBranch: string; group: string }>>> = {
  寅: { natalBranch: '午', group: '寅午戌' }, 戌: { natalBranch: '午', group: '寅午戌' },
  卯: { natalBranch: '未', group: '亥卯未' }, 未: { natalBranch: '卯', group: '亥卯未' },
};
// Chapter 28 compares only these three native Wu positions in its fire example.
const fireMeetingNatalWeights: Readonly<Partial<Record<string, string>>> = { year: '较重', day: '次之', hour: '较缓' };
const fireMeetingTargetSeats: Readonly<Partial<Record<string, string>>> = { 辛: '酉', 庚: '申' };
// The November memorial records Zhao acting in the capacity cited in chapter 27.
export const zpqzZhaoMemorialDay = {
  start: Date.parse('1929-11-21T00:00:00+08:00'),
  end: Date.parse('1929-11-22T00:00:00+08:00'),
};
// Shen Bao identifies the event on July 24, while the government record files the next-day telegram.
export const zpqzZhaoAnnualGengDay = {
  start: Date.parse('1930-07-24T00:00:00+08:00'),
  end: Date.parse('1930-07-25T00:00:00+08:00'),
};
const zhaoNatalSequence = '丁亥乙巳丁酉甲辰';
const zhaoBirthHour = {
  start: Date.parse('1887-06-01T07:00:00+08:00'),
  end: Date.parse('1887-06-01T09:00:00+08:00'),
};

export function zpqzZhaoAnnualGengCheck(natal: Natal, annualPillar: string) {
  if (annualPillar !== '庚午' || layers.map(position => natal[position]).join('') !== zhaoNatalSequence) return undefined;
  const month = { position: 'month', pillar: natal.month, stem: natal.month[0] };
  const hour = { position: 'hour', pillar: natal.hour, stem: natal.hour[0] };
  const pairs = baziInteractions([{ id: month.position, pillar: month.pillar }, { id: 'annual', pillar: annualPillar }]).pairs;
  return pairs.some(pair => pair.kind === '天干五合') && baziStemControls(annualPillar[0], hour.stem)
    ? { annualPillar, combinesMonthYi: month, controlsHourJia: hour } : undefined;
}

export function zpqzSealReturnBranch(luckBranch: string) {
  return luckBranch === '寅' ? '申' : luckBranch === '卯' ? '酉' : undefined;
}

export function baziZpqzLuckContext(natal: Natal & { utc?: string }, timeKnown: boolean, luckPillar: string) {
  const native = layers.filter(layer => layer !== 'hour' || timeKnown)
    .map(layer => ({ position: layer as string, ...describeBaZiPillar(natal[layer], natal.day[0]) }));
  const luck = { position: 'decadal', ...describeBaZiPillar(luckPillar, natal.day[0]) };
  const all = [...native, luck];
  const exposed = native.filter(pillar => pillar.position !== 'day');
  const witness = (pillar: typeof luck) => ({ position: pillar.position, pillar: pillar.pillar, branch: pillar.branch });
  const hiddenActivations = native.flatMap(pillar => pillar.hiddenStems.map((hidden, index) => ({
    ...witness(pillar), stem: hidden.stem, tenGod: hidden.tenGod, hiddenOrder: index + 1,
    sourceRole: sourceRoles[pillar.branch]?.[hidden.stem],
    natalExposurePositions: exposed.filter(row => row.stem === hidden.stem).map(row => row.position),
    dayMasterSameStem: hidden.stem === natal.day[0], luckStemSame: hidden.stem === luck.stem,
    newlyExposedByLuck: hidden.stem === luck.stem && hidden.stem !== natal.day[0]
      && !exposed.some(row => row.stem === hidden.stem) ? timeKnown ? true : undefined : false,
  })));
  const newlyExposed = hiddenActivations.filter(row => row.newlyExposedByLuck === true);
  const newExposureOrigins = unique(newlyExposed.map(row => row.position === 'month' ? 'month-command' : 'other-natal'));
  const jiaOfficerSeats = natal.day[0] === '甲' ? native.filter(row => row.branch === '酉').map(witness) : [];
  const sourceNewExposures = newlyExposed.flatMap(row => {
    const monthCommand = row.position === 'month';
    let namedExample: 'jia-you-wu' | 'jia-you-ding' | 'ren-wu-ji' | undefined;
    if (jiaOfficerSeats.length && row.branch === '辰' && row.stem === '戊') namedExample = 'jia-you-wu';
    if (jiaOfficerSeats.length && '午未'.includes(row.branch) && row.stem === '丁') namedExample = 'jia-you-ding';
    if (natal.day[0] === '壬' && row.branch === '午' && row.stem === '己') namedExample = 'ren-wu-ji';
    if (!monthCommand && !namedExample) return [];
    return [{ position: row.position, pillar: row.pillar, branch: row.branch, stem: row.stem, tenGod: row.tenGod,
      monthCommand, namedExample, officerSeats: namedExample?.startsWith('jia-you-') ? jiaOfficerSeats : [] }];
  });
  const rootWitnesses = unique(all.map(row => row.stem)).map(stem => ({ stem,
    stemPositions: all.filter(row => row.stem === stem).map(row => row.position),
    roots: all.flatMap(pillar => {
      const exact = pillar.hiddenStems.find(hidden => hidden.stem === stem);
      const sameElement = pillar.hiddenStems.some(hidden => hidden.element === all.find(row => row.stem === stem)!.stemElement);
      return sameElement ? [{ ...witness(pillar), exactStem: !!exact,
        sourceRole: exact ? sourceRoles[pillar.branch]?.[stem] : undefined }] : [];
    }),
  }));
  const compareRoot = (stemRow: typeof luck, branchRow: typeof luck) => {
    const sameElementStems = branchRow.hiddenStems.filter(hidden => hidden.element === stemRow.stemElement).map(hidden => hidden.stem);
    const exact = sameElementStems.includes(stemRow.stem);
    // Chapter 28 expressly counts 卯 and 未 as 甲 roots despite their 乙.
    const namedJiaRoot = stemRow.stem === '甲' && '寅亥卯未'.includes(branchRow.branch);
    return { stem: stemRow.stem, stemPosition: stemRow.position, ...witness(branchRow), exact, namedJiaRoot,
      sameElementStems, role: sourceRoles[branchRow.branch]?.[stemRow.stem] };
  };
  const rootComparisons = native.map(row => ({ ...witness(row), natalStemInLuck: compareRoot(row, luck), luckStemInNatal: compareRoot(luck, row) }));
  const crossLayerRoots = [...rootComparisons.map(row => row.natalStemInLuck), ...rootComparisons.map(row => row.luckStemInNatal)]
    .filter(row => row.exact || row.namedJiaRoot).map(({ stem, stemPosition, position, pillar, branch, exact, role }) =>
      ({ stem, stemPosition, position, pillar, branch, exact, role }));
  const crossLayerRootReview = timeKnown ? {
    columns: rootComparisons,
    luckHiddenExposures: luck.hiddenStems.map(({ stem }) => ({ stem, natalStemPositions: native.filter(row => row.stem === stem).map(row => row.position),
      alreadyInLuckStem: luck.stem === stem })),
  } : undefined;
  const haiStemPositions = (stem: string) => all.filter(row => row.stem === stem).map(row => row.position);
  const haiRoles = all.filter(row => row.branch === '亥' && crossLayerRoots.some(root => root.position === row.position))
    .map(row => ({ ...witness(row), renPositions: haiStemPositions('壬'), jiaPositions: haiStemPositions('甲') }));
  const sourceRootOrders = all.flatMap(row => {
    if (!['寅', '辰'].includes(row.branch) || !crossLayerRoots.some(root => root.position === row.position)) return [];
    const members = Object.entries(sourceRoles[row.branch]).map(([stem, role]) => ({
      stem, role, stemPositions: all.filter(holder => holder.stem === stem).map(holder => holder.position),
      pairedStemPositions: crossLayerRoots.filter(root => root.position === row.position && root.stem === stem && root.exact)
        .map(root => root.stemPosition),
    }));
    return [{ ...witness(row), members }];
  });
  const natalSequence = timeKnown ? native.map(row => row.pillar).join('') : undefined;
  const birthAt = Date.parse(natal.utc ?? '');
  const zhaoXinChouNatalExposure = timeKnown && natalSequence === zhaoNatalSequence && luck.pillar === '辛丑'
    && birthAt >= zhaoBirthHour.start && birthAt < zhaoBirthHour.end
    && newlyExposed.some(row => row.position === 'day' && row.stem === '辛' && row.branch === '酉');
  const rootChoiceExample = natalSequence === '甲寅丙寅庚寅戊寅' ? 'four-yin'
    : natalSequence === '戊辰甲寅壬戌丙午' ? 'shi-zai-cun' : undefined;
  const rootChoice = rootChoiceExample ? {
    example: rootChoiceExample,
    yinSeats: native.filter(row => row.branch === '寅').map(witness),
    visibleYinStems: ['甲', '丙', '戊'].map(stem => ({
      stem, positions: exposed.filter(row => row.stem === stem).map(witness),
    })),
    natalFireMembers: [...'寅午戌'].map(branch => ({ branch, positions: native.filter(row => row.branch === branch).map(witness) })),
    arrivingWu: rootChoiceExample === 'four-yin' && luck.branch === '午' ? witness(luck) : undefined,
  } : undefined;
  const interactions = baziInteractions(all.map(row => ({ id: row.position, pillar: row.pillar })));
  const luckPairs = interactions.pairs.filter(pair => pair.members.includes('decadal'))
    .map(pair => ({ kind: pair.kind, members: pair.members.map(position => witness(all.find(row => row.position === position)!)) }));
  const yinLuckJoinsMonthHai = luck.branch === '寅' && luckPairs.some(pair => pair.kind === '六合'
    && pair.members.some(row => row.position === 'month' && row.branch === '亥'));
  const returnBranch = zpqzSealReturnBranch(luck.branch);
  const sealReturnPairs = luckPairs.filter(pair => pair.kind === '六冲'
    && pair.members.some(row => row.position !== 'decadal' && row.branch === returnBranch));
  const groupWitnesses = groups.filter(group => group.values.includes(luck.branch)).map(group => {
    const members = [...group.values].map(branch => ({ branch,
      natalPositions: native.filter(row => row.branch === branch).map(row => row.position),
      luckPresent: luck.branch === branch }));
    const missingBranches = members.filter(row => !row.natalPositions.length && !row.luckPresent).map(row => row.branch);
    const nativeComplete = members.every(row => row.natalPositions.length);
    return { ...group, members, missingBranches, nativeComplete,
      complete: !missingBranches.length ? true : timeKnown ? false : undefined,
      completedByLuck: !missingBranches.length && !nativeComplete ? timeKnown ? true : undefined : false };
  });
  const wood = groupWitnesses.find(row => row.kind === '三合' && row.values === '亥卯未');
  const zhaoXinChouPrintedMeeting = zhaoXinChouNatalExposure
    && groupWitnesses.some(row => row.values === '巳酉丑' && row.completedByLuck === true);
  const jiAtWei = luck.branch === '未' && luck.hiddenStems[0]?.stem === '己';
  const month = native[1];
  const jiOfficers = timeKnown && natal.day[0] === '壬' && month.branch === '亥'
    ? exposed.filter(row => row.stem === '己').map(witness) : [];
  let renHaiOfficerRoute: 'yin-hai' | 'mao-hai' | 'wei-completes' | 'wei-incomplete' | 'wei-native-complete' | 'none' | undefined
    = timeKnown ? 'none' : undefined;
  if (jiOfficers.length) {
    if (yinLuckJoinsMonthHai) renHaiOfficerRoute = 'yin-hai';
    else if (luck.branch === '卯' && wood) renHaiOfficerRoute = 'mao-hai';
    else if (jiAtWei && wood?.completedByLuck) renHaiOfficerRoute = 'wei-completes';
    else if (jiAtWei && wood?.missingBranches.includes('卯')) renHaiOfficerRoute = 'wei-incomplete';
    else if (jiAtWei && wood?.nativeComplete) renHaiOfficerRoute = 'wei-native-complete';
  }
  const renHaiOfficerContext = renHaiOfficerRoute && renHaiOfficerRoute !== 'none' ? {
    monthLu: witness(month), jiOfficers,
    weiHollow: renHaiOfficerRoute === 'wei-incomplete' ? {
      pair: [witness(month), witness(luck)], missingBranch: '卯' as const,
      monthRoot: month.hiddenStems.find(hidden => hidden.stem === '壬'),
      incomingOfficerRoot: luck.hiddenStems[0],
    } : undefined,
    officerRoots: all.flatMap(row => {
      const index = row.hiddenStems.findIndex(hidden => hidden.stem === '己');
      return index < 0 ? [] : [{ ...witness(row), mainQi: index === 0 }];
    }),
    woodContacts: all.filter(row => row.position === 'month' || row.position === 'decadal'
      || renHaiOfficerRoute !== 'yin-hai' && ['卯', '未'].includes(row.branch))
      .flatMap(row => row.hiddenStems.filter(hidden => hidden.element === '木' && baziStemControls(hidden.stem, '己'))
        .map(hidden => ({ ...witness(row), stem: hidden.stem, tenGod: hidden.tenGod }))),
  } : undefined;
  const renHaiYinWoodContact = timeKnown && renHaiOfficerRoute === 'yin-hai'
    && luck.hiddenStems[0]?.stem === '甲'
    && renHaiOfficerContext?.woodContacts.some(row => row.position === 'decadal' && row.stem === '甲' && row.tenGod === '食神')
    && !all.some(row => ['庚', '辛'].includes(row.stem))
    && !interactions.pairs.some(pair => ['六冲', '六破', '相刑', '六合'].includes(pair.kind)
      && (pair.members.includes('month') || pair.members.includes('decadal'))
      // The same 寅–亥 pair carries both 六合 and 六破 in the shared table.
      && !(pair.members.includes('month') && pair.members.includes('decadal')));
  const woodMemberPositions = new Set(wood?.members.flatMap(member =>
    member.luckPresent ? [...member.natalPositions, 'decadal'] : member.natalPositions));
  const renHaiMaoWoodContact = timeKnown && renHaiOfficerRoute === 'mao-hai' && wood?.completedByLuck === true
    && renHaiOfficerContext?.woodContacts.some(row => row.position === 'decadal' && row.stem === '乙' && row.tenGod === '伤官')
    && !all.some(row => ['庚', '辛'].includes(row.stem))
    && !interactions.pairs.some(pair => ['六冲', '六破', '相刑', '六合'].includes(pair.kind)
      && pair.members.some(position => woodMemberPositions.has(position)));
  const sourceMeeting = sourceMeetingByLuckBranch[luck.branch];
  const meetingGroup = sourceMeeting && groupWitnesses.find(row => row.values === sourceMeeting.group);
  const fireControlTargets = meetingGroup?.values === '寅午戌' && natal.day[0] === '甲'
    ? exposed.flatMap(row => {
      const targetBranch = fireMeetingTargetSeats[row.stem];
      if (!targetBranch || !baziStemControls('丁', row.stem)) return [];
      const rootSeats = native.filter(root => root.branch === targetBranch).map(witness);
      return rootSeats.length ? [{ ...witness(row), stem: row.stem, tenGod: row.stem === '辛' ? '正官' : '七杀', rootSeats }] : [];
    })
    : [];
  const sourceTwoBranchMeetings = sourceMeeting && meetingGroup ? native.filter(row => row.branch === sourceMeeting.natalBranch).map(row => ({
    natal: witness(row), luck: witness(luck), group: meetingGroup.values,
    missingBranches: timeKnown ? meetingGroup.missingBranches : undefined,
    luckAddsBranch: timeKnown ? !native.some(pillar => pillar.branch === luck.branch) : undefined,
    sourceFireWeight: meetingGroup.values === '寅午戌' ? fireMeetingNatalWeights[row.position] : undefined,
    fireControlTargets: fireControlTargets.filter(target => target.position !== row.position),
  })) : [];
  const kangJiExposure = natalSequence === '戊午乙卯壬子庚子'
    ? sourceNewExposures.find(row => row.position === 'year' && row.namedExample === 'ren-wu-ji') : undefined;
  const kangExposureContext = natalSequence === '戊午乙卯壬子庚子' && (kangJiExposure || ['午', '未'].includes(luck.branch)) ? {
    natalWu: hiddenActivations.filter(row => row.position === 'year' && ['丁', '己'].includes(row.stem)),
    natalKiller: { ...witness(native[0]), stem: native[0].stem, tenGod: native[0].tenGod },
    jiExposure: kangJiExposure,
    jiControls: kangJiExposure ? hiddenActivations.filter(row => row.branch === '子' && baziStemControls('己', row.stem)) : [],
    wuClashes: luck.branch === '午' ? luckPairs.filter(pair => pair.kind === '六冲') : [],
    maoWeiMeetings: luck.branch === '未' ? sourceTwoBranchMeetings : [],
  } : undefined;
  const yaoWealth = natalSequence === '丁丑丁未丁酉丁未'
    ? hiddenActivations.find(row => row.position === 'day' && row.stem === '辛') : undefined;
  const yaoFood = yaoWealth ? hiddenActivations.filter(row => row.tenGod === '食神' && baziStemFeeds(row.stem, yaoWealth.stem)) : [];
  const yaoMaoSeal = luck.branch === '卯' ? luck.hiddenStems.find(row => row.stem === '乙') : undefined;
  const yaoExposureContext = yaoWealth && ['巳', '卯'].includes(luck.branch) ? {
    wealth: yaoWealth, food: yaoFood,
    metalGroup: groupWitnesses.find(row => row.values === '巳酉丑'),
    siWealth: luck.branch === '巳' ? luck.hiddenStems.find(row => row.stem === '庚') : undefined,
    maoSeal: yaoMaoSeal,
    maoControls: yaoMaoSeal ? yaoFood.filter(row => baziStemControls(yaoMaoSeal.stem, row.stem)) : [],
    maoWeiMeetings: luck.branch === '卯' ? sourceTwoBranchMeetings : [],
    maoClashes: luck.branch === '卯' ? luckPairs.filter(pair => pair.kind === '六冲') : [],
  } : undefined;
  return {
    profile: zpqzLuckPolicy, timeKnown, dayMaster: natal.day[0], natalMonthBranch: natal.month[1],
    natalExposedStems: unique(exposed.map(row => row.stem)), luckPillar, luckStem: luck.stem, luckBranch: luck.branch,
    luckHiddenStems: luck.hiddenStems, hiddenActivations, rootWitnesses, luckPairs, groupWitnesses,
    newExposureOrigins, sourceNewExposures, kangExposureContext, yaoExposureContext, zhaoXinChouPrintedMeeting,
    sourceExposureProfile: 'zpqz-month-and-named-exposure-v2',
    yinLuckJoinsMonthHai, sealReturnPairs,
    hasMatchingSealReturnClash: sealReturnPairs.length > 0 ? true : timeKnown ? false : undefined,
    crossLayerRoots, crossLayerRootReview, crossLayerRootReviewComplete: Boolean(crossLayerRootReview), haiRoles, sourceRootOrders, rootChoice,
    hasPrintedYinWuComparison: Boolean(rootChoice?.arrivingWu),
    hasCrossLayerRoot: crossLayerRoots.length ? true : timeKnown ? false : undefined,
    hasNewlyExposedStem: newlyExposed.length ? true : timeKnown ? false : undefined,
    hasLuckCombination: luckPairs.some(row => row.kind === '六合') || groupWitnesses.some(row => row.completedByLuck === true)
      ? true : timeKnown ? false : undefined,
    sourceTwoBranchMeetings, sourceMeetingProfile: 'zpqz-two-branch-meeting-locators-v3',
    hasSourceTwoBranchMeeting: sourceTwoBranchMeetings.length ? true : timeKnown ? false : undefined,
    woodComplete: wood?.complete, woodCompletedByLuck: wood?.completedByLuck,
    woodMissingBranches: timeKnown ? wood?.missingBranches : undefined,
    jiAtWei, renHaiOfficerRoute, renHaiOfficerContext,
    renHaiYinWoodContact: timeKnown ? renHaiYinWoodContact === true : undefined,
    renHaiMaoWoodContact: timeKnown ? renHaiMaoWoodContact === true : undefined,
    // Geometry may persist throughout this stage; the source's five-year
    // EFFECT is not claimed to last ten years or assigned an invented half.
    effectTiming: 'source-five-year-unresolved',
  };
}
