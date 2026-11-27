import { eligibleFacts, requestForFortuneRun, type FortuneInterpretationReport } from './fortune-interpretation';
import type { calculateFortuneFacts } from './fortune-facts';
import { isFortuneMethodEnabled, type FortuneFactRecord } from '../model/fortune-facts';
import { fortuneReportSections, type FortuneGeneratedSection, type FortunePublishedReport } from '../model/interpretation';
import { unsafeLanguage } from './interpretation-registry';
import { matchFortuneKnowledge, knowledgeMethods } from './knowledge/match';
import { getFortuneKnowledgeEntry, getFortuneKnowledgeVersion, getFortunePrintedLuck } from './knowledge/catalog';
import { buildFortuneEvents, fortuneEventVersion } from './fortune-events';
import { maxReportSectionLength } from '../../../shared/content-limits.mjs';

const promptFields: Readonly<Record<string, readonly string[]>> = {
  'bazi:zpqz_officer_context': ['profile', 'timeKnown', 'confirmed', 'dayMaster', 'natalPillars', 'monthHiddenGods', 'gods',
    'wealthOfficerContacts', 'officerSealContacts', 'outputOfficerContacts', 'dayOutputContacts', 'sealOutputContacts', 'wealthOfficerSealPaths', 'wealthFedOfficerUnderOutput',
    'wealthSealContacts', 'sealDayMasterContacts', 'roots', 'movingRows', 'movingContacts', 'natalMovingContacts',
    'wealthSupportingOfficerSeal', 'officerExposureChecks', 'hasMonthOfficerVisibleLuckConflict', 'monthOfficerWealthPaths', 'officerWealthBodySupport',
    'onlyHiddenMonthOfficerDirectLuckClash', 'fanSourceYouOutputChallengesOfficer', 'liSourceOfficerSealReview',
    'xueSourceWealthOfficerSeal', 'xueSourceBodySupport', 'xueSourceNatalOfficerWealthRoots', 'xueSourceChouNorthernSeal',
    'xueSourceOfficerSealFurtherSupport',
    'zaqiSourceOfficerAid', 'zaqiInactiveWealthSeal', 'fanWealthConversion', 'fanBranchWealth',
    'fanSourceOfficerSealSupport', 'fanSourceSealChecksOutput', 'jinSourceWealthTrimsSeal',
    'officerWealthNamedStrong', 'monthOfficerSealPaths', 'officerSealBodySupport', 'officerSealNamedStrong', 'jinSealComparison',
    'luckOutputFeedsWealth', 'luckSealControlsOutput', 'luckOfficerFeedsSeal', 'overlappingSeals',
    'officerSealProtectionPaths', 'sealOverlapWealthPaths', 'officerSealOutputNamedForRestraint', 'xuanSealComparison',
    'natalFivePairs', 'movingFivePairs', 'hiddenFivePairs', 'officerBranchRelations', 'nativeRelations', 'movingRelations',
    'threeCombinationGroups', 'luBranch', 'natalLuPositions', 'luckAtLu', 'printedCases', 'printedLuck', 'sourceVariants', 'counterfactual',
    'counterfactualWealthSeal', 'xueXuWealth', 'xueHaiClashes', 'xueYinShenClashes',
    'luckPillar', 'luckTenGod', 'luckBranchMainQiGod', 'strengthVerified', 'protectionVerified', 'transformationVerified',
    'effectTimingVerified', 'stageStart', 'stageEnd'],
  'bazi:zpqz_wealth_context': ['profile', 'timeKnown', 'confirmed', 'dayMaster', 'natalPillars', 'monthHiddenGods', 'gods',
    'wealthOfficerContacts', 'foodWealthContacts', 'hurtWealthContacts', 'companionOutputContacts', 'outputKillerContacts',
    'sealOutputContacts', 'wealthSealContacts', 'killerSealContacts', 'foodSealPairs', 'sealDayMasterContacts', 'roots',
    'natalFivePairs', 'killPairs', 'movingRows', 'movingContacts', 'natalMovingContacts', 'movingFivePairs', 'branchGroups', 'natalRelationPairs', 'movingRelationPairs',
    'monthWealthLuck', 'wealthRemedyLuck',
    'printedCases', 'sourceVariants', 'luckPillar', 'luckTenGod', 'luckBranchMainQiGod', 'strengthVerified',
    'transformationVerified', 'protectionVerified', 'climateVerified', 'stageStart', 'stageEnd'],
  'bazi:zpqz_killer_order_context': ['profile', 'timeKnown', 'confirmed', 'dayMaster', 'natalPillars', 'monthHiddenGods', 'gods',
    'foodAbsent', 'hurtAbsent', 'officerExposed', 'hurtExposed', 'officerAndKillerExposed', 'foodKillerContacts', 'outputOfficerContacts',
    'killerSealContacts', 'wealthSealContacts', 'wealthOfficerKillerContacts', 'sealOutputContacts', 'sealDayMasterContacts', 'roots',
    'wealthSealPairs', 'natalFivePairs', 'clearingPairs', 'movingFivePairs', 'movingAttacksClearingHelpers', 'natalRelationPairs',
    'movingRelationPairs', 'generationChainPairs', 'luPlusOneBranch', 'luPlusOnePositions', 'monthYangBlade', 'printedCases',
    'killerFoodLuck', 'killerSealLuck', 'killerWealthLuck', 'killerClearingLuck', 'killerBladeLuck', 'hurtDualLuck', 'hurtOfficerLuck',
    'sourceVariants', 'convertedWealthPrintedExample', 'luckPillar', 'luckTenGod', 'luckBranchMainQiGod', 'strengthVerified',
    'clearingVerified', 'remedyVerified', 'climateVerified', 'stageStart', 'stageEnd'],
  'bazi:zpqz_food_killer_context': ['profile', 'timeKnown', 'confirmed', 'dayMaster', 'natalPillars', 'monthHiddenGods',
    'foodRows', 'hurtRows', 'wealthRows', 'sealRows', 'killerRows', 'foodExposed', 'hurtExposed', 'noSeal', 'foodKillerNoSeal',
    'foodWealthPairs', 'foodKillerPairs', 'wealthKillerPairs', 'sealOutputPairs', 'roots', 'natalFivePairs', 'movingFivePairs',
    'foodLuckPaths', 'foodClimateEvidence', 'sourceVariants', 'namedHuEarthWarning', 'namedLiuWeakDay',
    'natalRenDingWealthPairs', 'summerWood', 'fireOutputPresent', 'winterMetalWaterFoodCandidate', 'natalWoodMembers',
    'woodCompleteNatal', 'woodCompleteWithLuck', 'printedCases', 'printedLuck', 'luckPillar', 'luckTenGod', 'luckBranchMainQiGod',
    'strengthVerified', 'remedyVerified', 'climateVerified', 'transformationVerified', 'stageStart', 'stageEnd'],
  'western:leo_jupiter_luminary_context': ['profile', 'zodiac', 'birthVerified', 'birthAt', 'clockSource', 'positions',
    'luminary', 'natalLongitude', 'natalDeclination', 'natalAspects', 'jupiterNatalPair', 'jupiterNatalAspectCandidates',
    'natalAspectProfile', 'transitBody', 'transitConjunction', 'transitKind', 'hasExactNatalJupiterTrine', 'natalTrineDifference',
    'hasReceivedNatalAspect', 'hasNatalJupiterAspect', 'natalJupiterLongitudePriority', 'natalAngularSameSignGroup',
    'stationTimingProfile', 'natalStation', 'repeatedMoonJupiterLongitude', 'repeatedProgressedJupiterToLuminary',
    'productOrb', 'episodeStart', 'enters', 'exits', 'exactPasses', 'exactPassDeclinations', 'hasExactInWindow', 'nativePassage', 'natalLuminaryStationWitnesses',
    'natalAspectOrbVerified', 'sourceMonthDurationVerified', 'directionsVerified', 'receivedNatalAspects',
    'repeatingDirections', 'directionsAtExactPasses'],
  'bazi:zpqz_seal_food_context': ['profile', 'timeKnown', 'confirmed', 'dayMaster', 'monthPillar', 'monthBranch', 'dayPillar', 'natalPillars',
    'gods', 'monthHiddenGods', 'sealsExposed', 'sealsHidden', 'hurtExposed', 'hurtHidden', 'foodHidden', 'outputsExposed',
    'wealthExposed', 'wealthHidden', 'sealExposedHurtOnlyHidden', 'hurtExposedSealOnlyHidden', 'hiddenFoodNoExposedOutputs',
    'liSkeleton', 'maoSkeleton', 'maSkeleton', 'sealOutputContacts', 'wealthSealContacts', 'officerSealContacts', 'roots', 'movingFivePairs',
    'sourceDecisionProfile', 'companionWealthContacts', 'foodKillerContacts', 'outputWealthContacts', 'wealthKillerContacts', 'sealDayContacts',
    'foodKillerRemedyPaths', 'foodKillerSourceReading', 'liuSourceWealthSeparation', 'robberyAgainstSealWealth', 'wealthPressesHurtSeal',
    'monthOfficerSealLuck', 'exposedOfficerWealthSeal', 'zhouSourceRobberyDispute', 'zhouSourceWealthOutput',
    'remedyMovingComponents', 'remedyMovingContacts', 'remedyNatalContacts', 'sealLuckEvidence', 'namedHeavySeal', 'sourceWealthRole', 'sourceHurtWealthSeal',
    'autumnWoodSourceNotWeak', 'autumnWoodSupport',
    'maSourceStrongDayLightSeal', 'maoSourceAuthorityToExposedSeal',
    'linhuaiGuardComparison', 'jiaChenAuthorityComparison', 'coldBingSealComparison', 'namedHurtingOfficerPeerEvidence',
    'zhangSourceOutputInsteadOfSeal', 'hasZhangReviewedPeerSupport', 'hasLightSealSourceWealthPressure',
    'qianSourceWealthSealPressure', 'hasQianSourceWealthSealPressure', 'sunSourceSealReview',
    'xiaSourceWealthAuthority', 'xiaSourceFavorsArrivingWealth', 'xiaSourceFavorsArrivingAuthority',
    'coldBingBranchAuthorityWithWealth', 'wealthHeavySourceHurtSealPressure', 'heSourceAuthoritySeal',
    'killerSealPressure', 'killerSealSupport', 'killerSealSupportPaths', 'wealthWithArrivingKiller', 'boluoSourceXuWesternWealthAndSeal',
    'liGuiCombinesExposedFood', 'shenZiChen', 'groupComplete', 'nativeGroupComplete', 'groupCompletedByLuck', 'printedCases',
    'luckPillar', 'luckStem', 'luckBranch', 'luckTenGod', 'luckBranchMainQiGod', 'protectionVerified', 'strengthVerified',
    'visibilityInterpretationVerified', 'transformationVerified', 'stageStart', 'stageEnd'],
  'bazi:zpqz_month_command': ['profile', 'timeKnown', 'confirmed', 'dayMaster', 'monthBranch', 'dayYang', 'luBranch', 'bladeBranch',
    'atLu', 'atYangBlade', 'natalPillars', 'monthMainQi', 'monthMainQiGod', 'mainQiJieCandidate', 'monthHidesPeer',
    'monthJieIdentityVerified', 'fullPatternVerified', 'godWitnesses', 'jiaYouMonth', 'xinExposed', 'xinHidden',
    'xinExposedPositions', 'xinHiddenPositions', 'xinNewlyExposedByLuck', 'xinRoots', 'dayMasterRoots', 'youOfficerContext',
    'luckPillar', 'luckStem', 'luckBranch', 'luckTenGod', 'luckHiddenStems', 'luckBranchMainQi', 'luckBranchMainQiGod', 'wealthBridge',
    'nativeWealthBridgePaths', 'bladeWealthPaths', 'bladeWealthMatched', 'bladeWealthExample', 'bladeAuthorityPaths', 'authorityOutputPaths', 'bladeKillerNamedNotStrong',
    'bladeKillerJoin', 'bladeAuthorityWealthOnlyJoinedKiller', 'bladeOutputOnlyJoinedKiller', 'bladeFourGrowthRootClashes',
    'bladeKillerSourceComparison', 'bladeKillerJiaComparison', 'bladeWealthSourceComparison', 'bladeWealthBridgeSourceComparison', 'luOfficerSourceComparison',
    'bladePrintedSupport', 'bladeFoodReliefComparison', 'bladeSupportStrongSource', 'bladeKillerMuOfficerComparison', 'bladeClearingSourceComparison',
    'bladeYueSourceComparison', 'bladeQianlongSourceComparison',
    'luJieAuthorityPaths', 'namedSealChecksFood',
    'luJieOutputPaths', 'zhangOutputCaseEvidence', 'metalWaterOutputCaseEvidence', 'metalWaterSealRelief',
    'luckFireStem', 'luckFireBranch', 'nativeFireWitnesses', 'fireAbsent', 'natalZiShen', 'hasZiShen', 'gaoSameColumns',
    'gaoPrintedColumns', 'gaoFireCommentConflict', 'gaoContext', 'gaoSoilReturns',
    'strengthVerified', 'transformationVerified', 'stageStart', 'stageEnd'],
  'ziwei:quanshu_yang_taboo_context': ['profile', 'ready', 'scope', 'lunarYear', 'branch', 'natalName', 'birthYearBranch', 'annualBranch',
    'natalLifeBranch', 'bodyBranch', 'yangBranch', 'yangGrade', 'yangInNet', 'yangFallen', 'focusRelation', 'lifeRelation', 'bodyRelation',
    'netMembers', 'birthBranchInTombsCandidate', 'mainPositionsReady', 'mainPositions', 'lifeMajorStars', 'focusMajorStars',
    'lifePalaceGroups', 'focusPalaceGroups', 'supportReady', 'supportPositions', 'birthTaboo', 'scopeRelations', 'scopePairCandidates',
    'listedTabooStars', 'allListedTabooStarsPositioned', 'sourceFireBellHourVerified', 'encounterRangeVerified', 'wholeChartStrengthVerified',
    'decadalYangRelation', 'minorYangRelation', 'additionalSha', 'yangNetVerifiedOpposedLimitCandidate', 'yangNetVerifiedBothOpposed',
    'yangNetVerifiedAcrossLimits', 'yangNetVerifiedAxes',
    'yangTombBirthGuardCandidate', 'yangTombLifeGuardCandidate', 'yangZiChangFuGuardCandidate', 'yangZiChangFuContacts',
    'lifeMajorGradeState', 'lifeMajorIdleEvidence', 'yangNetVolumeTwoIdleLifeCandidate', 'yangNetMingIdleLifeCandidate',
    'fallenYangGuardShaCandidate', 'fallenYangOpposedShaCandidate', 'fallenYangNatalJi', 'fallenYangAnnualYang',
    'fallenYangJielanFireJiCandidate', 'fallenYangJielanFireJiWitness',
    'mingXingAnProfile', 'fallenYangMingJumenGuardCandidate', 'fallenYangMingJumenWitness',
    'quanshuFixedFireBellProfile', 'fallenYangMingFixedSha', 'fallenYangMingFixedGuardCandidate', 'fallenYangMingFixedOpposedCandidate',
    'fallenYangNatalJiCandidate', 'fallenYangRepeatAnnualCandidate', 'natalHelpers', 'natalAdditionalHelpers', 'yearSha', 'matchingTabooSeats', 'matchingTabooPairs',
    'birthTabooWithThreeShaCandidate', 'namedTabooGuards', 'namedTabooWithThreeShaCandidate', 'palaceTable', 'supportedStrongPalaces', 'weakLimits',
    'namedMingFixedFireBellTabooCandidate', 'mingNamedTabooYearSha', 'mingNamedTabooGuards',
    'strongPalaceWeakLimitCandidate', 'strongPalaceFallenLimitCandidate', 'strongDignitySupports',
    'strongDignityWeakLimitCandidate', 'strongDignityFallenLimitCandidate'],
  'ziwei:quanshu_tiger_layer_context': ['profile', 'ready', 'scope', 'lunarYear', 'branch', 'natalName', 'birthYearBranch',
    'annualBranch', 'annualStem', 'natalLifeBranch', 'parentBranch', 'moon', 'parentMoonFallen', 'mainStars', 'principalSeatProof',
    'annualMinorAtLianzhen', 'sourceMinor', 'lianzhenAnnualTigerTrineCandidate', 'scopeRelations', 'annualTigerAtYear', 'annualTigerYearRelation', 'fourFlying',
    'natalTigerBranches', 'natalTigerProductVerified', 'natalTigerSourceLayerVerified', 'natalTigerRelations',
    'yang', 'bellArchiveBranches', 'bellProductVerified', 'bellSourceHourVerified', 'bellRelations', 'encounterRangeVerified'],
  'ziwei:quanshu_horse_void_context': ['profile', 'ready', 'scope', 'lunarYear', 'branch', 'natalName', 'birthYearBranch', 'yearPillar', 'xunHead',
    'horseBranch', 'natalHorseAtFocus', 'cutVoidPair', 'xunVoidPair', 'groups', 'archiveVoids', 'sourceSkyReady', 'sourceRobberyReady', 'sourceVoidPairReady', 'sourceVoids', 'modernSkyBranches',
    'mingNatalHorseProfile', 'mingHorseCutVoidGuardCandidate', 'mingHorseNativeVoidsGuardCandidate', 'mingHorseGuardScopes',
    'annualHorseCandidateBranch', 'annualHorseAtFocus', 'annualHorseRuleVerified', 'annualVoidCandidates', 'annualVoidRuleVerified',
    'scopeRelations', 'decadalMinorSamePalace', 'sourceMinor', 'sourceDecadal', 'companions', 'tianxingReady', 'xingShaSeatProof', 'tuoluoBranch', 'tuoluoHorseRelation', 'supportReady',
    'natalAuxiliary', 'flowChangRuleVerified', 'horseTianxingQishaCandidate', 'lifeHorseXingShaAtVerifiedLimit',
    'nonLifeHorseXingShaAtVerifiedDecade', 'horseCutVoidCandidate',
    'horseXunVoidCandidate', 'horseSkyVoidCandidate', 'horseTuoluoTogetherCandidate', 'horseAnnualTuoluoCandidate', 'flowTuoluoBranch', 'flowHorse',
    'horseDeadOrExtinctStageCandidate', 'horseGrowth', 'horseLuQishaXunVoidGuardCandidate',
    'flowHorseXingShaCandidate', 'flowHorseCutVoidCandidate', 'flowHorseXunVoidCandidate', 'flowHorseSkyVoidCandidate',
    'flowHorseNatalTuoluoCandidate', 'flowHorseAnnualTuoluoCandidate'],
  'bazi:zpqz_stem_order': ['profile', 'timeKnown', 'confirmed', 'dayMaster', 'dayYang', 'natalPillars', 'natalMonthPillar',
    'luckPillar', 'luckStem', 'luckTenGod', 'luckBranchMainQiGod', 'natalFivePairs', 'movingFivePairs', 'haiStemComparison', 'wuOfficerFoodWealth',
    'wealthSealPairs', 'yiJiPairs', 'jiaGengBingBridges', 'wealthSealLuck', 'hasSeparatedWealthSealLuck',
    'sealOfficerJoins', 'sealOfficerSourceUnrootedJoin', 'sealOfficerSourceRetained', 'sealOfficerSingleResidualJoin', 'sealOfficerSingleResidual', 'branchOwlMeetingAgainstHurt', 'guiWithYearWu', 'guiWaterRootClashes', 'guiZiLuRoots', 'guiNorthernWaterAssembly',
    'guiShenZiChenAssembly', 'guiRootsOnlyStorageOrResidual', 'guiOwnLuckWaterRoot', 'haiGuiColdWaterOpposition', 'haiGuiRootedLink',
    'natalKillPairs', 'movingAttacksKillCombiners', 'officerKillLuck', 'roots', 'printedCases', 'stageStart', 'stageEnd'],
  'bazi:zpqz_moving_relations': ['profile', 'timeKnown', 'confirmed', 'dayMaster', 'natalYearBranch', 'natalMonthBranch', 'natalPillars',
    'luckPillar', 'luckStem', 'luckBranch', 'luckTenGod', 'annualPillar', 'annualBranch', 'branchCounts', 'exactTwoShenOneYin', 'twoClashPairings',
    'shenYinClashComparison', 'shenYinOfficerContext', 'kangDoubleClash',
    'movingClashes', 'movingStemClashes', 'nativeClashes', 'direction', 'directionRootContext', 'luckStemNativeRoots', 'luckStemOwnRoots', 'luckStemRootedInOwnBranch', 'luckStemRootedInNatal',
    'groups', 'woodMissingBranches', 'fireExample', 'youExample', 'youSourceRelief', 'youSourceReliefRoutes', 'youSourceMeetingRoutes', 'youSiMeetingSeparatedByYin',
    'hasZhangReviewedWealthDayClash',
    'renExposures', 'chenStorehousePositions', 'renRootsWithLuck', 'renRootsConfinedToChen',
    'dingChenOfficerRootArrival', 'shenRootOpposition', 'dingChenRootClashUnsupported', 'dingChenZiArrivalWithAnnualShenClash', 'dingChenZiRootComparison',
    'dingChenShenArrivalWithAnnualZiClash', 'dingChenShenRootComparison',
    'dingChenZiArrivalWithAnnualHaiClash', 'dingChenHaiRootComparison',
    'waterNativeAssociates', 'waterSealExposures', 'yiChenNativeSeals',
    'stemBranchProfile', 'exposedComponents', 'hiddenComponents', 'movingComponents', 'movingComponentContacts', 'natalComponentContacts',
    'luckPillarElementLinks', 'branchRelations', 'returnClashes', 'renHaiReturnContacts', 'sourcePillarExample', 'officerHurtCombination', 'xinRootsInLuck',
    'fireTargetLayouts', 'fireMeetingPaths', 'annualFireMeetingClashes', 'fireMeetingGroupWitnesses', 'fireMeetingStatus',
    'fireHalfYearXinSamePillar', 'concealedXinNeighbors', 'chenOfficerGuard', 'chenMonthClashes',
    'jiaWuWealthLu', 'jiaDingOfficerHurt', 'jiaWealthStem', 'jiaWealthBranch', 'jiaSealStem', 'jiaSealStorehouse',
    'stemLuCoordinates', 'dayLuBranch', 'luckAtDayLu', 'stemBranchEffectsVerified', 'wuMaoLuckContext', 'dingYouZiChain',
    'dingYouWuContacts', 'dingYouSiWealth',
    'hiddenActivations', 'rootWitnesses', 'stageStart', 'stageEnd'],
  'western:heindel_progression_context': ['profile', 'dateBasis', 'sourceClockVerified', 'geometryOnly', 'sampleAt', 'natal', 'natalPairs', 'progressed', 'solar', 'lunar', 'lunations', 'activations', 'printedMinuteComparison'],
  'western:heindel_transit_context': ['profile', 'dateBasis', 'sourceClockVerified', 'geometryOnly', 'kind', 'transitBody', 'natalTargetId', 'natalLongitude',
    'aspectType', 'transitMotion', 'transitAllowedOrb', 'passIndex', 'solar', 'lunar', 'lunations', 'activations', 'solarActiveAtExact',
    'fellowshipTransitBandProfile', 'fellowshipTransitLunationProfile', 'transitLunationActivation',
    'fellowshipTransitLunationMonthProfile', 'lunationStartsBeforeWindow',
    'repeatProfile', 'jupiterRepeat', 'natalPowers', 'mercuryToSun', 'natalAspectEvidence', 'transitNature',
    'natalSunJupiterFinancialSupport', 'natalSunJupiterFinanceContact'],
  'western:heindel_transit_observation': ['profile', 'transitBody', 'natalTargetId', 'aspectType', 'transitMotion', 'observation'],
  'western:heindel_direction_transit_overlap': ['profile', 'dateBasis', 'transitBody', 'natalTargetId', 'aspectType', 'progressedBody',
    'directionNatalTargetId', 'directionAspectType', 'directionKind', 'angleOverlapProfile', 'allowedOrb', 'exactTimes', 'natureRelation', 'directionNature', 'transitNature',
    'directionCoordinate', 'directionDeclination', 'exactSaturnPass', 'natalSaturnAfflicted', 'fellowshipTransitBandProfile',
    'fellowshipJupiterTransitBandProfile', 'fellowshipJupiterMildTransitBandProfile', 'fellowshipSaturnTransitBandProfile', 'fellowshipUranusTransitBandProfile',
    'lunationActivationProfile', 'hasLunationActivation', 'lunationActivations', 'lunarDirectionActivation',
    'fellowshipTransitLunationProfile', 'transitLunationActivation', 'fellowshipTransitLunationMonthProfile', 'lunationStartsBeforeWindow'],
  'ziwei:quanshu_body_limit_context': ['profile', 'ready', 'scope', 'branch', 'natalName', 'birthMonth', 'birthHour', 'lunarYear', 'annualStem', 'annualBranch',
    'bodyBranch', 'lifeBranch', 'bodyNatalName', 'bodyLifeSame', 'layerContacts', 'decadalMinorSamePalace', 'focusMainStars', 'lifeMainStars', 'bodyMainStars',
    'qishaBranch', 'qishaAtLifeOrBody', 'qishaGrade', 'qishaRelations', 'shaPositions', 'lifeCandidateShaPresent', 'bodyCandidateShaPresent',
    'firebellProductCoordinatesReady', 'sourceFirebellHourVerified', 'tianxingReady', 'tianxingBranch', 'tianxingRelations', 'transformations',
    'annualTransformationRuleVerified', 'rescuePositions'],
  'bazi:annual_column_relations': ['profile', 'timeKnown', 'dayMaster', 'natalDay', 'yearPillar', 'yearStem', 'yearTenGod',
    'pairs', 'stemCombinePositions', 'branchCombinePositions', 'dayStemCombine', 'hourStemCombine', 'hasDayOrHourStemCombine',
    'dayHourStemCombines', 'fivePositionReferences', 'dayHouseArrival', 'hourTombArrival', 'annualHouseTomb', 'dayHourMonthDuty',
    'dayHourMonthDutySeason',
    'luckAnnualCombination', 'doubleCombineDetails',
    'sameColumnCombines', 'hasSameColumnDoubleCombine', 'dayControlsYear', 'dayBranchClash', 'dayToYearSexagenarySteps',
    'yearToDaySexagenarySteps', 'dayToYearBranchSteps', 'luckStatus', 'luckPillar', 'natalGengShenPositions', 'luckGengShen',
    'exposedMetal', 'exposedGui', 'hiddenGui', 'metalPresent', 'guiPresent', 'witnessBranch', 'metalGroups',
    'jiaWuRescue', 'jiaWuRescueCandidate', 'jiaWuDualWitnessState', 'sourceRelations', 'stageStart', 'stageEnd'],
  'bazi:smth_seal_hurting_context': ['profile', 'timeKnown', 'dayMaster', 'yearPillar', 'luckStatus', 'luckPillar',
    'monthSealCandidates', 'monthSealExposures', 'natalYearHourWealth', 'movingWealth', 'natalHurt', 'natalOfficers', 'supportedOfficers', 'officerDamage',
    'movingBlades', 'killers', 'natalWealth', 'natalRoots', 'luckPeers',
    'builtLuMonth', 'builtLuPeerWealthCandidate', 'hurtingPeerWealthCandidate', 'monthHurtDutyDay', 'peerWealthPaths', 'peerOfficerControls',
    'namedHurtingWealthUse', 'builtLuNoWealthOfficerWithPeer', 'builtLuSourceNoWealthOrOfficer', 'builtLuNamedWealthPressure',
    'sealWealthPaths', 'sealSourceWealthLand', 'sealSourceAnnualWealthLand', 'sealSourceNatalVisibleWealthPaths', 'sealLuckWealthAssemblies', 'sealSourceSiDutyEarthWealthPaths',
    'sealNamedLandAnnualWealthPaths',
    'hurtOfficerReview', 'hurtOfficerSourceExceptions', 'hurtOfficerSeasonalBladeKiller', 'hurtOfficerNamedWuXinYou', 'hurtOfficerNamedHiddenMonthCases'],
  'bazi:smth_officer_mix_context': ['profile', 'natalKind', 'nativePositions', 'phaseEvidence', 'sameKind', 'differentKind', 'twoOfficerSeatsWithoutKiller',
    'continuedSeasonOfficer', 'soleKillerSeatWithoutOfficer', 'soleOfficerSeatWithoutKiller', 'twoNatalOfficerSeatsWithoutKiller', 'multiplePureNatalKillerSeats'],
  'western:leo_ascendant_context': ['profile', 'zodiac', 'hierarchy', 'rulershipBasis', 'natalContextReady',
    'natalLongitude', 'natalSign', 'natalDecan', 'natalDecanSign', 'natalSignRuler', 'natalDecanRuler',
    'longitude', 'longitudeSampleAt', 'sign', 'decan', 'decanSign', 'signRuler', 'decanRuler', 'wholeSignApplies', 'decanModifier',
    'rulerPositions', 'natalSunHouse', 'dayChart', 'sunInIcDscArc', 'natalJupiterSeparations',
    'piscesNatalCondition', 'natalJupiterSupportive', 'natalJupiterHard', 'directions', 'natalHouseDirections',
    'natalFavourableDirectionTargets', 'progressedFavourableDirectionTargets', 'natalHousesWithClassifiedDirections',
    'natalHousesWithFavourableDirections',
    'natalMercuryUranusDirectionState', 'natalDirectionState', 'progressedDirectionState',
    'hasAdverseAscendantDirection', 'hasUnresolvedAscendantDirection', 'clippedStart', 'clippedEnd'],
  'ziwei:quanshu_firebell_context': ['profile', 'scope', 'branch', 'natalName', 'lunarYear', 'annualBranch', 'birthYearBranch', 'birthHour',
    'birthGroup', 'sourcePair', 'archivedFireBell', 'sourceHourRuleVerified', 'sourcePairEqualsArchive', 'localMainStars', 'sourceGradeRows',
    'quanshuFixedFireBellProfile', 'quanshuFixedFireBell', 'quanshuFixedFireAtFocus', 'quanshuFixedBellAtLife',
    'jielanAnchors', 'jielanFireBell', 'jielanFireAtFocus', 'jielanBellAtLife', 'natalHorseAtFocus', 'annualHorseAtFocus',
    'flowHorse', 'flowHorseArchiveFireCandidate', 'flowHorseJielanFireCandidate', 'flowHorseQuanshuFixedFireCandidate',
    'unknownSourceGradeStars', 'fourShaRelations', 'natalHorseVerified', 'natalHorseBranch', 'annualHorseCandidateBranch',
    'supportReady', 'sourceSupportRelations', 'natalLifeBranch', 'qingyangAtLife', 'bellArchiveAtLife', 'whiteTigerBranch', 'annualWhiteTigerAtLife',
    'verseProfile', 'verseReady', 'verseSubjects', 'verseOtherBranch', 'verseOtherScope'],
  'ziwei:quanshu_doujun_context': ['profile', 'lunarYear', 'scope', 'branch', 'natalName', 'annualStem', 'annualBranch',
    'decadalBranch', 'minorBranch', 'allThreeSamePalace', 'birthMonth', 'birthHour', 'birthMonthStop', 'doujunBranch',
    'birthMonthBasis', 'birthLeapMonth', 'yearStart', 'yearEnd', 'queryIncludesNewYear', 'doujunNatalName', 'archivedStars', 'sourceQualities', 'monthTimeline'],
  'ziwei:quanshu_doujun_month': ['profile', 'ready', 'lunarYear', 'lunarMonth', 'leap', 'annualBranch', 'doujunBranch',
    'birthMonth', 'birthMonthBasis', 'birthLeapMonth',
    'branch', 'natalName', 'nativeStart', 'nativeEnd', 'supportContacts', 'voidContacts', 'voidContactsComplete',
    'natalShaContacts', 'natalShaContactsComplete', 'archivedFireBellContacts',
    'boshiHaoContacts', 'suiqianHaoContacts', 'natalJiContacts', 'annualJiContacts', 'annualShaContacts', 'voidHaoJiTogether',
    'mingNatalGengJiContacts', 'mingAnnualGengJiContacts',
    'templeSupportContacts', 'annualLucunContacts', 'wealthWuquChanges', 'wealthWuquJi', 'wealthNamedGuards',
    'careerWuquGroups', 'careerTianjiWenqu', 'careerTempleYangSupport', 'careerTianjiCounter',
    'careerTianjiMingClearCandidate', 'careerTianjiArchiveClearCandidate',
    'careerTiantongMingClearWitness', 'careerTiantongMingShaContacts', 'mingTianfuClearWitness', 'mingLianzhenTianxiangClearWitness',
    'jumenTianjiSameSeatCandidate', 'jumenTianjiSameSeatWitness', 'namedPairGuardWitness'],
  'ziwei:quanshu_kuxu_condition': ['profile', 'lunarYear', 'scope', 'branch', 'natalName', 'annualStem', 'annualBranch',
    'decadalBranch', 'minorBranch', 'allThreeSamePalace', 'birthYearBranch', 'positions', 'exceptionSeat',
    'natalLuBranch', 'natalLuRelation', 'annualLuBranch', 'annualLuRelation', 'mourningBranch', 'mourningRelation'],
  'ziwei:quanshu_shangshi_condition': ['profile', 'lunarYear', 'scope', 'branch', 'natalName', 'annualStem', 'annualBranch',
    'decadalBranch', 'minorBranch', 'allThreeSamePalace', 'positions', 'majorPositionsVerified', 'localMajorStars',
    'archivedLocalStars', 'archivedOppositeStars'],
  'bazi:zpqz_luck_context': ['profile', 'timeKnown', 'dayMaster', 'natalMonthBranch', 'natalExposedStems',
    'luckPillar', 'luckBranch', 'luckHiddenStems', 'hiddenActivations', 'rootWitnesses', 'rootPairingProfile', 'crossLayerRoots', 'crossLayerRootReview', 'haiRoles', 'sourceRootOrders', 'rootChoice',
    'luckPairs', 'yinLuckJoinsMonthHai', 'sealReturnPairs', 'groupWitnesses', 'woodCompletedByLuck', 'woodMissingBranches', 'sourceTwoBranchMeetings',
    'sourceNewExposures', 'kangExposureContext', 'yaoExposureContext', 'renHaiOfficerRoute', 'renHaiOfficerContext', 'effectTiming', 'confirmed', 'stageStart', 'stageEnd',
    'zhaoAnnualGengCheck'],
  'western:lilly_return_context': ['profile', 'pair', 'birthAt', 'returnAt', 'returnEnd', 'returnEpochBasis', 'zodiac', 'returnBody', 'natalTargetId',
    'returningLongitude', 'natalLongitude', 'longitudeSeparation', 'sameSign', 'sameDegreeCell', 'mainOrb', 'alternateOrb',
    'placeComparison', 'radicalPlaceMinuteState', 'sourceOrbStatus', 'natalSect',
    'returnHorizonContrast',
    'natalSunAltitude', 'natalHouseSystem', 'natalTargetHouse', 'returnDirection', 'returnSpeed', 'returningEssential',
    'natalTargetEssential', 'returningConditions', 'natalTargetConditions', 'returningP115', 'returnVenusFortitude', 'returnVenusCazimiFortitude', 'returnVenusEighthFortitude',
    'natalTargetP115', 'natalMoonP745Balance', 'natalMoonDebility', 'natalMoonNocturnalDomicileFortitude', 'saturnMoonDispositionAtReturn',
    'natalMoonWorkedFortitude', 'natalMoonWorkedDebility', 'natalMoonNocturnalEssentialWitness', 'natalMoonNocturnalNonAngularDomicileWitness',
    'venusCuspVirtue', 'returnVenusCuspFortitude',
    'natalMoonCuspVirtue', 'natalMoonCuspDebility', 'natalMoonCuspFortitude',
    'returnSect', 'returnAngles', 'returnLocation', 'returnSignification', 'returnFortuneProfile', 'returnFortuneHouse',
    'returnAscendantDomicileProfile', 'returnAscendantHardAspect', 'returnAscendantNatalHouse', 'returnRisingSignMatchesNatalCuspHouse',
    'saturnMidheavenState', 'saturnMidheavenApproachStatus', 'saturnMidheavenDistanceRange', 'saturnCuspVirtue',
    'saturnSupportedReturnContact', 'saturnApplyingReturnWitness'],
  'western:lilly_return_seventh_context': ['profile', 'returnAt', 'returnEnd', 'zodiac', 'houseSystem', 'returnAscendant',
    'natalSeventhLongitude', 'sameSign'],
  'bazi:minor_luck_context': ['profile', 'variant', 'direction', 'timeKnown', 'dayMaster', 'annualPillar', 'minorPillar', 'luckPillar',
    'hasMajorLuck', 'annual', 'minor', 'dayLuBranch', 'yearLuBranch', 'yearHorseBranch', 'annualContacts', 'minorContacts',
    'jointNatalHarmTargets', 'threePunishments', 'birthYearLabel', 'yearLabel', 'ordinal', 'calendarVerified', 'confirmed', 'stageStart', 'stageEnd',
    'p245MatchProfile', 'harmEvidence', 'p245Agreement', 'commonStemSupport', 'commonHorseSupport', 'horseEvidence', 'yearHorseCombineBranch', 'nobleSeason',
    'majorLuckHistory', 'canopyReview', 'nobleCombinationReview', 'directNobleReview', 'moonVirtueReview',
    'heavenVirtueReview', 'heavenVirtueDirectionReview', 'hasSharedSourceSupport', 'hasSharedCanopySupport',
    'hasSharedNobleCombinationSupport', 'hasSharedMoonVirtueSupport', 'hasSharedHeavenVirtueSupport',
    'yanNobleCombinationReview', 'hasSharedYanNobleCombinationSupport'],
  'bazi:school_context': ['profile', 'dayMaster', 'timeKnown', 'luckPillar', 'fourBirthPositions', 'fourBirthAbsent',
    'yearNaYin', 'yearNaYinSchoolBranch', 'naYinPositions', 'sameNaYinPositions', 'naYinAbsent',
    'standardDayStartBranch', 'standardDayMonthHourPositions', 'standardDayMonthHourAbsent',
    'directSourceDayStart', 'directSourceDayStartAgrees', 'daySourcePositions', 'sourceLuckAtDayStart',
    'standardLuckPhase', 'luckAtYearNaYinBirth',
    'witnesses', 'confirmed', 'stageStart', 'stageEnd', 'entryCompletedCivilYears', 'entryCivilClock'],
  'bazi:school_entry_context': ['profile', 'dayMaster', 'directSourceDayStart', 'luckPillar',
    'civilYears', 'civilClock', 'liChunOrdinal', 'lunarOrdinal', 'sourceLuckPhase', 'dayLongevityAbsent',
    'luckSchoolContacts', 'sourceLuckSchoolClashOrBreak', 'sourceLuckSchoolSelfPunishment', 'luckSchoolChecks', 'nobleSchoolWitnesses'],
  'bazi:school_exam_context': ['profile', 'annualPillar', 'natalMonth', 'birthNayin', 'annualNayin', 'monthNayin',
    'monthRelations', 'monthElements', 'monthHarmonyCandidate', 'corroboratedMonthGeneration', 'verifiedMonthBranchCombination',
    'verifiedMonthStemCombination',
    'sealPillar', 'nayinStorehouseSeal', 'nayinSealVoidSources',
    'nayinSealVoidBoth', 'nayinSealVoidCombinations', 'nayinSealNamedPunishment', 'nayinSealSameElementPunishment', 'nayinSealNatalDamage',
    'dayStemSeal', 'annualStemTenGod',
    'monthBranchFriction', 'monthPairAssessment', 'monthGenerationDirection', 'birthBranch', 'documentedSupports', 'nayinOffice', 'examSupportRoutes',
    'annualStemLuBranch', 'annualFamilyLu', 'annualNobleGroup', 'corroboratedFamilyLuAtOffice', 'corroboratedNobleAtOffice',
    'season', 'seasonStart', 'luckPillar', 'confirmed', 'bases', 'examSupportCandidate', 'stageStart', 'stageEnd'],
  'bazi:fateclear_bazi_context': ['profile', 'layer', 'clock', 'timeKnown', 'dayMaster', 'movingPillar', 'movingBranch',
    'movingElement', 'movingMainQi', 'clashes', 'clashedColumns', 'movingCombinations', 'movingTrines', 'movingBranchDirection',
    'exampleVerified', 'exampleYear', 'exampleLuck', 'exampleReading', 'sourceReading', 'baseBalance', 'direction',
    'apparentDay', 'solarDate', 'dailyUsefulnessBasis', 'monthlyUsefulnessBasis', 'annualCoreClashes', 'annualCorePunishmentsAndHarms',
    'monthDayClashGeometryVerified', 'monthDayClashReview', 'publishedMonthDayClashReviewed', 'jieMonth', 'monthlyLayerOrderVerified'],
  'western:leo_natal_context': ['profile', 'bodies', 'ascendantSign', 'sunSign', 'sunHouse', 'sunAltitude', 'dayChart', 'houseStatus'],
  'western:leo_progressed_aspect': ['profile', 'progressedBody', 'natalTargetId', 'targetKind', 'targetLongitude',
    'targetDeclination', 'aspectType', 'allowedOrb', 'coordinate', 'progressedBodySign',
    'progressedLongitude', 'natalLongitude', 'progressedDeclination', 'natalDeclination', 'sameHemisphere',
    'natalBodySign', 'natalTargetSign', 'natalBodyHouse', 'natalTargetHouse', 'natalLongitudeSeparation', 'natalAbsoluteDeclinationDifference', 'houseStatus', 'pairRulershipProfile', 'rulership',
    'natalAspectProfile', 'natalMajorAspectContacts', 'natalPairAspects', 'natalAfflictionContacts', 'natalTargetAspectContacts',
    'hasVenusNeptuneSemisextileExact', 'natalVenusNeptuneAfflictionState',
    'natalFavourableContacts', 'conjunctionSign', 'natalNeptuneElevation', 'natalNeptuneBeforeAngularCusp', 'natalNeptuneSoleLuminaryContacts',
    'natalMarsNeptuneStrength', 'natalMarsUranusAfflictionFocus', 'natalMarsNeptuneElementMajorityWitness',
    'isMarsNeptuneConjunctionPoint', 'marsNeptuneCuspApproach', 'hasNatalMarsNeptuneCreativeAffliction', 'natalMarsNeptuneCreativeAfflictionContacts',
    'natalMercuryImpulsivenessContacts', 'natalMercuryNeptuneTestimonies', 'natalNeptuneArtContacts', 'natalNeptuneMinorAfflictionContacts',
    'mercuryNeptuneParallelBandObserved', 'natalNeptuneParallelAfflictionContacts', 'natalNeptuneParallelUnclassifiedContacts',
    'natalNeptuneParallelFavourableConjunctions', 'natalNeptuneParallelSupersededContacts', 'natalNeptuneParallelWeakAdverseContacts',
    'natalNeptuneParallelOverindulgenceContacts', 'natalNeptuneParallelWeakFavourableContacts', 'natalNeptuneParallelAdditionalAfflictionContacts',
    'natalVenusArtTestimonies', 'natalMercuryMentalTestimonies', 'natalDevotionalTestimonies',
    'natalMoonJupiterInvestment', 'natalMoonJupiterDevotion', 'hasMarsNeptuneConjunctionExact',
    'hasMercuryNeptuneSextileExact', 'natalNeptuneCreativeTestimonies', 'natalMercuryVenusArtisticContacts',
    'natalNeptuneJupiterArtisticContacts', 'hasSolarNeptuneExact',
    'solarNeptuneNatalEvidenceState',
    'natalNeptuneClosestComparableLuminaryContacts'],
  'western:leo_progressed_aspect_exact': ['profile', 'progressedBody', 'natalTargetId', 'targetKind', 'targetLongitude',
    'targetDeclination', 'aspectType', 'allowedOrb', 'coordinate', 'progressedBodySign',
    'progressedLongitude', 'natalLongitude', 'progressedDeclination', 'natalDeclination', 'sameHemisphere',
    'natalBodySign', 'natalTargetSign', 'natalBodyHouse', 'natalTargetHouse', 'natalLongitudeSeparation', 'houseStatus', 'pairRulershipProfile', 'rulership'],
  'western:leo_lunar_exact_observation': ['profile', 'progressedBody', 'natalTargetId', 'targetKind', 'aspectType',
    'progressedLongitude', 'targetLongitude', 'appendixDate', 'lunarNeptuneTestimonies', 'natalTargetHouse',
    'natalNeptuneApproachingAscendant', 'natalNeptuneAscendantApproach',
    'hasLunarNeptuneDevotionalContact', 'lunarNeptuneDevotionalContacts', 'natalSunNeptuneCreativeContacts'],
  'western:leo_mutual_exact_observation': ['profile', 'progressedBody', 'natalTargetId', 'targetKind', 'aspectType', 'natalMercuryNeptuneTestimonies', 'natalVenusNeptuneAfflictionState',
    'natalPairHarmonious', 'natalPairAspects', 'hasSoleNatalMercuryNeptuneContact', 'natalMercuryContactBodies',
    'natalVenusNeptuneLiteraryConjunction', 'natalVenusNeptuneVariableContact',
    'mercuryNeptuneArtisticBasis', 'hasMercuryNeptuneDevotionalBasis', 'natalTargetHouse'],
  'western:leo_solar_phase': ['profile', 'natalTargetId', 'targetKind', 'aspectType', 'phase', 'formationAt', 'natalFormationAt',
    'natalJupiterAfflictionChecked', 'natalJupiterAfflictionContacts', 'solarNeptuneNatalEvidenceState'],
  'western:leo_solar_lunar_phase': ['profile', 'natalTargetId', 'targetKind', 'aspectType', 'phase',
    'formationAt', 'sameLayerLunarState', 'lunarQualification', 'contacts', 'otherDirection',
    'hasExactSaturnLunarFamilyContext', 'saturnLunarFamilyContextContacts', 'saturnLunarFamilyParallelContact',
    'hasExactSaturnLunarEighthHouseContext',
    'saturnLunarSteadinessContacts', 'saturnLunarWeakSteadinessContacts',
    'supportingDirections', 'hasUnreviewedOtherDirection', 'natalFinancialContext', 'natalNeptuneCreativeTestimonies',
    'hasNatalNeptuneDevotionalContact', 'natalNeptuneDevotionalContacts', 'natalMercuryVenusArtisticContacts', 'natalSunNeptuneCreativeContacts',
    'neptuneTrineSupportType', 'neptuneTrineLunarSupportContacts', 'hasExactNeptuneTrineCrossLayerSolarSupport',
    'hasNeptuneTrineVenusMarsOpposition', 'hasNatalSecondRulerTwelfthHouseAffliction',
    'neptuneTrineCrossLayerSolarContacts', 'hasAdverseNeptuneTrineMoonContact'],
  'western:leo_lunar_contact': ['profile', 'progressedBody', 'natalTargetId', 'targetKind', 'aspectType',
    'lunarTargetId', 'lunarTargetKind', 'lunarAspectType', 'lunarExactTimes'],
  'western:leo_lunar_condition': ['lunarProfile', 'progressedBody', 'natalTargetId', 'targetKind', 'aspectType',
    'monthlyThemeEvidence', 'monthlyLunarMajorState', 'sameLayerSolarDirectionState', 'monthlyLunarQualification', 'concurrentSolarJupiterSquare',
    'mutualExactInSlice', 'hasUnreviewedMutualMajorDirection', 'unreviewedMutualMajorDirections', 'venusJupiterLunarLinkState',
    'venusJupiterEffectState', 'venusJupiterSupportScope',
    'contacts', 'natalState', 'progressedState', 'sameLayerLunarState', 'lunarFavourableTargets', 'lunarAdverseTargets',
    'hasCleanAdverseMoonNeptuneActivation', 'hasExactCleanMarsJupiterOtherAdverseMoon', 'exactCleanMarsJupiterOtherAdverseMoon',
    'hasExactCleanNeptuneLunarSesquiquadrate', 'exactCleanNeptuneLunarSesquiquadrate',
    'hasExactCleanNeptuneLunarSemisquare', 'exactCleanNeptuneLunarSemisquare',
    'hasMarsJupiterAdverseLunarParallelActivation', 'marsJupiterAdverseLunarParallelContacts',
    'mercuryNeptuneNatalSensitivityState', 'mercuryNeptuneLunarSupportState', 'mercuryBehindNeptune',
    'exactAdverseMoonToNatalEndpoint', 'exactAdverseMoonToProgressedEndpoint', 'exactFavourableMoonToNatalEndpoint',
    'exactFavourableMoonToProgressedEndpoint',
    'lunarLinkedBodies', 'exactLunarLinkedBodies', 'exactSolarEndpointContacts', 'exactSolarLinkedBodies', 'pairLuminaryLinksComplete',
    'exactUranianSensitivityDirection', 'luminaryLinks', 'adverseSequence', 'supportingDirections', 'otherDirection', 'lunarBridge', 'moonPosition',
    'hasConcurrentUranianSensitivityDirection', 'concurrentUranianSensitivityDirection', 'venusNeptuneSensitivityDirection',
    'progressedVenusNeptuneSensitivityDirection', 'moonNeptuneSensitivityDirection',
    'hasUranianMoonSolarActivation', 'hasUranianLunarParallelActivation', 'uranianLunarParallelActivation',
    'hasVenusUranusParallelAtFormation',
    'contraryScope', 'contraryDirections', 'unreviewedContraryDirections', 'contraryReviewState', 'natalOtherPlanetPairScope',
    'crossChartSupportState', 'crossChartDirections',
    'progressedOtherPlanetPairScope', 'progressedOtherPlanetContraryReviewState', 'progressedOtherPlanetContraryDirections', 'progressedOtherPlanetUnreviewedDirections',
    'speculationDirections', 'travelDirections',
    'correspondenceDirections', 'friendshipDirections', 'studyDirections', 'disputeDirections', 'natalMercuryImpulsivenessContacts',
    'metaphysicalDirections', 'uranianMetaphysicalMutualDirections', 'hasExactUranianMetaphysicalSolarDirection',
    'uranianMetaphysicalSolarDirection', 'hasExactUranianMetaphysicalMercuryDirection', 'uranianMetaphysicalMercuryDirection',
    'hasExactUranianMetaphysicalVenusDirection', 'uranianMetaphysicalVenusDirection',
    'hasExactUranianMetaphysicalMoonDirection', 'uranianMetaphysicalMoonDirection',
    'uranianMetaphysicalMoonHouse',
    'hasExactUranianMetaphysicalMoonConjunction', 'uranianMetaphysicalMoonConjunction',
    'hasExactUranianMetaphysicalMinorMoonDirection', 'uranianMetaphysicalMinorMoonDirection',
    'hasUranianMetaphysicalMercuryLunarWitness', 'uranianMetaphysicalMercuryLunarDirection',
    'relocationDirections', 'natalMercuryBroadStudyContacts',
    'natalMarsJupiterProminence', 'natalMarsJupiterDominantBody', 'natalMarsJupiterSquareRepeated',
    'natalMutualDomicileExchange', 'natalMutualDomicileSigns', 'marsSaturnParallelBandObserved', 'marsSaturnNatalBalanceBasis',
    'hasMarsSaturnReviewedMixedOrFavourableMoon', 'hasMarsSaturnAdverseLunarActivation', 'exactCleanMarsSaturnAdverseMoon', 'hasExactCleanMarsSaturnAdverseMoon',
    'hasMarsSaturnAdverseLunarParallelActivation', 'marsSaturnAdverseLunarParallelContacts', 'hasMarsSaturnTrineAtParallel',
    'natalAspectProfile', 'natalPairAspects', 'natalMajorAspectContacts', 'natalAfflictionContacts', 'natalFavourableContacts', 'natalAbilityContacts',
    'natalTargetHouse', 'mercuryNeptuneOffset', 'natalNeptuneElevation', 'natalNeptuneBeforeAngularCusp', 'natalNeptuneSoleLuminaryContacts',
    'natalBodyHouse', 'natalBodySign', 'natalMercuryDomicileAngular', 'natalMercuryAngularDominance',
    'favourableNatalNeptuneLunarContacts',
    'natalSolarContacts', 'progressedSolarContacts', 'natalSolarDignity', 'progressedSolarDignity', 'natalFinancialContext',
    'natalMoonJupiterPromise', 'hasCleanLunarJupiterSupport', 'directionSupportState'],
  'western:leo_solar_natal_contact': ['profile', 'natalTargetId', 'natalHouse', 'natalSign', 'natalLongitude', 'contactDeclinations',
    'isAscendantRuler', 'isAscendantDecanRuler', 'ascendantDecan',
    'isAscendantDwadashamshaRuler', 'ascendantDwadashamsha', 'isAngular', 'isSoleAngularBody', 'closestSolarAspects', 'risingDegreeAspects',
    'hasExactNatalSolarAspectInTenthHouse', 'exactNatalSolarAspectInTenthHouse',
    'hasUniqueClosestNatalSolarMajor', 'hasUniqueClosestNatalSolarMinor', 'soleSolarParallelAspect', 'soleSolarParallelCandidate',
    'soleSolarDualCoordinateContacts', 'soleSolarDualCoordinateCandidate',
    'angularCuspApproach', 'elevatedTenthCuspApproach', 'ruledHouses', 'natalAngularSameSignGroup',
    'natalAspectProfile', 'natalTargetAspectContacts', 'sameSignNatalBodies', 'qualifiedCandidate', 'soleLunarCandidate', 'soleLunarAspectContacts',
    'closestLunarCandidate', 'closestLunarAspectContacts', 'lunarParallelReplacements'],
  'western:leo_second_house_transit_context': ['profile', 'transitBody', 'financeBasis', 'secondRuler', 'tenthRuler',
    'financialAnchors', 'generalFinancialPairs', 'natalFinancialState', 'repeatingDirections',
    'natalSecondHouseMinorAfflictionContacts', 'hasNatalSecondHouseMinorAffliction', 'natalSecondHousePressureSources',
    'financialDirections', 'financialDirectionState', 'targetCrossings'],
  'western:leo_jupiter_house_ruler_context': ['profile', 'natalHouse', 'cuspSign', 'ascendantRuler', 'houseRuler',
    'ascendantRulerHouse', 'houseRulerHouse', 'natalAspects', 'activeDirections', 'sameRulerDirectionCandidate',
    'annualRulers', 'annualRulerDirectionCandidate'],
  'western:leo_lunar_ascendant_crossing': ['profile', 'targetKind', 'fromHouse', 'house', 'motion', 'annualFrameStart', 'annualFrameEnd',
    'natalMoonSign', 'natalMoonDignity', 'natalAspectProfile', 'natalMoonContacts', 'solarAtCrossing'],
  'western:leo_lunar_house_context': ['profile', 'house', 'targetKind', 'naturalSign', 'cuspSign', 'naturalSignBodies', 'natalHouseBodies',
    'natalMoon', 'dayChart', 'mercurySeparations', 'rulerPair', 'lunarAspects', 'solarAspects', 'mutualAspects',
    'natalAspectProfile', 'mercuryAfflictions', 'lunarAspectNatures', 'lunarExactAspectNatures', 'favourableNatalTargets',
    'hasFavourableNatalTargetWithoutAffliction', 'moonHasAdverseAspect',
    'annualFrameStart', 'annualFrameEnd', 'ninthRulers', 'clippedStart', 'clippedEnd',
    'literaryPlacements', 'domesticPlacements', 'relocationDirections', 'ninthVoyage',
    'attachmentDirections', 'speculationDirections', 'friendshipDirections',
    'secondFinance', 'eighthFinance', 'eighthOccultDirections', 'careerPlacements', 'careerDirections', 'familyDirections',
    'sixthServicePlacements', 'serviceDirections', 'twelfthPrivatePlacements', 'reflectionDirections'],
  'ziwei:yun_time_segment': ['profile', 'sourceStem', 'lifeBranch', 'lunarYear', 'lunarMonth', 'lunarDay', 'leap',
    'monthOrdinal', 'monthPillar', 'minorLifeBranch', 'minorStem', 'allLayersReady', 'sourceDayClock', 'dayMonthBasisAgreed',
    'sunJiNinthPairVerified', 'sunJiNinthPair'],
  'ziwei:yun_sun_ji_pair': ['profile', 'sourceStem', 'lifeBranch', 'lunarMonth', 'leap', 'monthPillar',
    'sunJiNinthPairVerified', 'sunJiNinthPair', 'sunJiOccurrenceCount'],
  'ziwei:yun_month_finance_area': ['profile', 'birthMonthBasis', 'unverifiedShaLocations', 'area', 'positions', 'affectedFinance', 'financeCount', 'clearFinanceCount',
    'affectedFinanceCount', 'positiveContactCount', 'tabooContactCount', 'shaCount', 'completeShaLocations', 'noRecordedTabooOrSha',
    'annualQuanKeWithMinorLu', 'separatedTabooAndSha', 'onlyTabooOrOnlySha', 'yearAxisRepeatedTabooShaWitnesses',
    'yearAxisLifeSeatFinanceSupportWitness',
    'monthWealthSupportWithUnobstructedLife', 'investmentExamples', 'favorableFinanceContacts', 'tabooShaSameSeat', 'yearAxisTabooShaWitnesses'],
  'ziwei:yun_month_property_contact': ['profile', 'propertyReading', 'propertyScopes', 'branch', 'natalName', 'yearlyName',
    'monthlyName', 'star', 'kind', 'sourceScope', 'sourceStem', 'shaWitnesses', 'missingShaPlacements',
    'shaWitnessCount', 'recipientFinance', 'jumenMonthlyPropertyShaSameSeat', 'jumenOverlaidPropertyShaSameSeat',
    'birthMonthLayerProof', 'propertyShaPlacementProof'],
  'ziwei:yun_palace_condition': ['profile', 'branch', 'flowName', 'natalName', 'yearlyName', 'monthlyName', 'dailyName',
    'localStarNames', 'localWealthStars', 'localTransformations', 'surroundingTransformations', 'surroundingWealthJi', 'surroundingFinanceSha',
    'surroundingYearMonthJiBranchCount', 'dailyFinanceAxisSide', 'localPositiveScopes', 'localDailyFinanceStars',
    'yearAxisEvidence', 'yearAxisPositiveScopes', 'yearAxisWealthCount', 'sourceDayClock', 'dayMonthBasisAgreed'],
  'ziwei:yun_transformation_contact': ['profile', 'sourceScope', 'sourceStem', 'star', 'kind', 'branch',
    'flowName', 'natalName', 'yearlyName', 'monthlyName', 'dailyName', 'intrinsicWealthStar', 'wealthByLu', 'isJi',
    'intrinsicWealthJi', 'localFinanceShaStars', 'hasDiJie', 'hasLuCun', 'localLuScopes', 'localDailyFinanceWealth', 'propertyShaContacts',
    'localDailyFinanceStars', 'dailyFinanceRecipientClear', 'localUpperWealthJi', 'localUpperClearWealthStars',
    'sourceDayClock', 'dayMonthBasisAgreed'],
  'ziwei:yun_month_finance_support': ['profile', 'sourceScope', 'sourceStem', 'star', 'kind',
    'branch', 'natalName', 'yearlyName', 'flowName', 'monthlyFinanceSupport'],
  'ziwei:yun_daily_reading': ['profile', 'reading', 'polarity', 'branch', 'natalName', 'monthlyName', 'dailyName',
    'receivingContacts', 'localContacts', 'localStars', 'localSha', 'financeScopes', 'monthlyContext', 'sourceDayClock',
    'financeBasis', 'financeRole', 'localFinanceRoles', 'lifeSupport', 'overlappingNatalWealth'],
  'bazi:ten_god': ['dayMaster', 'stem', 'tenGod'],
  'bazi:hidden_stem_ten_god': ['branch', 'stem', 'tenGod'],
  'bazi:natal_structure': ['pillars', 'dayMaster', 'roots', 'timeKnown', 'strength', 'usefulElements'],
  'bazi:layer_pillar': ['layer', 'pillar', 'tenGod', 'phase', 'hiddenStems', 'natalPillars', 'calendarPolicy'],
  'bazi:pillar_relation': ['kind', 'members', 'pillars'],
  'bazi:daily_branch_context': ['profile', 'dayClock', 'dayPillar', 'dayBranch', 'monthPillar', 'timeKnown',
    'contacts', 'repeatedContacts', 'completedGroups', 'workMonthBranchWitness', 'workRepeatedBranchWitnesses'],
  'bazi:calendar_pattern': ['profile', 'dayClock', 'first', 'second', 'stemStep', 'branchStep', 'firstDegree', 'stemWrap', 'branchWrap'],
  'bazi:lu_annual_daily_twist': ['profile', 'dayClock', 'yearTwist', 'dayTwist', 'month', 'luck', 'weiXu', 'haiShen',
    'matchesPublishedGeometry', 'sourceDate', 'hasPublishedLuck'],
  'bazi:lu_rootless_day_case': ['profile', 'natal', 'moving', 'renStemPositions', 'dingRen', 'chouXu', 'youXu',
    'yinShen', 'chouXuWei', 'archingColumns', 'stageStart', 'stageEnd', 'matchesPublishedGeometry',
    'sourceDate', 'sourceBranchHalf', 'branchHalfStartsAt'],
  'bazi:smth_dragon_back_month': ['profile', 'native', 'year', 'month', 'earthStems', 'earthMainQi', 'natalWaterMembers',
    'monthTenGod', 'matchesPublishedGeometry'],
  'bazi:smth_day_virtue_month': ['profile', 'monthBasis', 'dayVirtuePositions', 'bladeBranch', 'yearHourPunishment',
    'yearStemControlsHour', 'year', 'month', 'luck', 'sourceLuckWealthBlade', 'sourceAge', 'sourceAge38', 'stageStart', 'stageEnd', 'matchesPublishedGeometry'],
  'bazi:smth_tai_sui_clash_month': ['profile', 'natalYear', 'year', 'month', 'luck', 'punishment', 'dayStemControlsYear',
    'dayBranchControlsYear', 'luckYearStemCombine', 'yinHaiCombine', 'woodMembers', 'luckWoodOutput', 'fireMeeting', 'monthMainQi', 'matchesPublishedGeometry'],
  'bazi:smth_fire_assembly_month': ['profile', 'year', 'month', 'luck', 'natalMonth', 'natalFire', 'withFlowsFire', 'wuGui',
    'waterStems', 'waterHiddenStems', 'natalSiPositions', 'natalFireSeason', 'flowFireSeason', 'matchesPublishedGeometry'],
  'bazi:smth_hour_blade': ['profile', 'publishedHour', 'natalDay', 'actualHour', 'year', 'monthBranch', 'yearClashesHourBlade',
    'yearHourBladeCombinationCandidate', 'yearSixCombination', 'yearHalfWoodContact', 'yearWoodGroup',
    'jiaShenException', 'exceptionStemPair', 'exceptionWealthPositions', 'dayQiScreen', 'natalContacts', 'natalWoodGroup', 'luckStatus', 'luckPillar', 'luckContacts',
    'luckHalfWoodContact',
    'luckWoodGroup', 'repeated', 'verifiedSingleLayerContact', 'verifiedSamePillarBladeRepetition', 'dayRootPositions', 'heavenTrigram', 'heavenVirtue', 'moonVirtue', 'moonVirtuePositions',
    'pardonDay', 'pardonDayObserved', 'verifiedUnopposedDayVirtuesWithHourBlade', 'dayVirtueWitness', 'depletedDayBladeWealthTargets'],
  'bazi:natal_conditions': ['dayMaster', 'yearPillar', 'monthPillar', 'dayPillar', 'hourPillar', 'timeKnown',
    'exposedTenGods', 'hiddenTenGods', 'monthMainQi', 'monthMainQiTenGod'],
  'bazi:stem_condition': ['stem', 'tenGod', 'exposed', 'hidden', 'rooted', 'exposurePositions', 'rootPositions'],
  'bazi:luck_conditions': ['pillar', 'tenGod', 'mainQiTenGod', 'confirmed', 'stemRootedInLuckBranch',
    'stemRootedInNatal', 'branchDirection', 'stageStart', 'stageEnd'],
  'bazi:luck_pillar': ['pillar', 'tenGod', 'hiddenStems', 'direction', 'confirmed', 'stageStart', 'stageEnd'],
  'bazi:source_layer_context': ['dayMaster', 'timeKnown', 'natalYear', 'natalMonth', 'natalDay', 'natalHour',
    'year', 'month', 'day', 'yearTenGod', 'monthTenGod', 'dayTenGod', 'relations', 'firstDegreeTwists'],
  'bazi:luck_transition': ['fromPillar', 'toPillar', 'fromSeason', 'toSeason', 'sameSeason', 'forwardCorner', 'reverseCorner', 'stemWrap', 'confirmed'],
  'bazi:work_timing_context': ['profile', 'evidence', 'upperWorkTargets', 'upperOfficerTargets', 'repeatedByMonth',
    'monthlyCandidate', 'dailyCandidate', 'dayOfficer', 'dayOfficerGod', 'dayClashesBirthMonth', 'dayClashesFlowMonth', 'stageStart', 'stageEnd'],
  'bazi:annual_luck_context': ['profile', 'dayMaster', 'natalYear', 'natalMonth', 'natalDay', 'natalHour', 'timeKnown',
    'foundationProfile', 'foundation',
    'coincidentRoles', 'coincidentBlades', 'coincidentBladeReview', 'repeatYearContacts', 'repeatYearPunishments', 'repeatYearCompatibleCandidate', 'repeatYearContentionPositions',
    'repeatYearCombinationCandidate', 'repeatYearCombinationContentionPositions', 'repeatYearFullPillarCombinations',
    'repeatYearVerifiedLuckPillarCombination',
    'repeatYearStemGeneration', 'repeatYearLuckClashControls', 'repeatYearMutualContentionAt', 'repeatYearNatalRepeatedStrikeAt',
    'repeatYearNatalLuckStrikeWitness',
    'repeatYearExchanges', 'repeatYearMutualLuCandidate',
    'yearPillar', 'luckPillar', 'samePillar', 'sameStem', 'sameBranch', 'yearRepeatsNatalYear', 'yearTenGod', 'yearMainQiTenGod',
    'yearHiddenTenGods', 'luckTenGod', 'luckMainQiTenGod', 'luckHiddenTenGods', 'luckStemWealth', 'luckMainQiWealth', 'luckAnyHiddenWealth',
    'stemExceptionProfile', 'luckBranchWealthAbsent', 'natalWealthRoots', 'wealthRootStatus', 'luckWealthEvidence',
    'natalKillerPositions', 'natalOutputPositions',
    'natalKillerCombinations', 'singleKillerControlColumns', 'officerControlEvidence',
    'dayLuBranch', 'monthBuiltLu', 'dayBasisBladeBranch', 'yearBasisBladeBranch', 'yearAtDayBasisBlade', 'luckAtDayBasisBlade',
    'yearAtYearBasisBlade', 'luckAtYearBasisBlade', 'bladeBasisAgrees', 'yearLuckRelations', 'confirmed', 'stageStart', 'stageEnd'],
  'ziwei:palace_mapping': ['flowName', 'natalName', 'stem', 'branch'],
  'ziwei:palace_condition': ['flowName', 'natalName', 'branch', 'natalStarNames', 'movingStarNames',
    'oppositeStarNames', 'surroundingStarNames', 'localFlowTransformations', 'starBrightness', 'yearlySuiqianStar', 'yearlyJiangqianStar'],
  'ziwei:transformation': ['kind', 'star', 'sourcePalaceStem', 'natalPalaceIndices', 'transformationTableVersion'],
  'ziwei:time_segment': ['lifePalaceIndex', 'stem', 'branch', 'boundary', 'lunarMonth', 'lunarDay', 'leap'],
  'ziwei:palace_star_structure': ['index', 'flowName', 'natalName', 'stars', 'movingStarIds', 'surrounding', 'transformations', 'tableVersion', 'transformationStem'],
  'ziwei:layer_overlap': ['firstScope', 'secondScope', 'firstIndex', 'secondIndex', 'samePalace', 'opposite', 'firstOnSecond', 'secondOnFirst'],
  'ziwei:ling_time_segment': ['profile', 'sourceStem', 'lifeBranch', 'lunarYear', 'lunarMonth', 'lunarDay', 'transformationCount',
    'lunarMonthIsLeap', 'monthJie'],
  'ziwei:ling_palace_condition': ['profile', 'ready', 'branch', 'flowName', 'natalName', 'localStarNames', 'localTransformations', 'surroundingStarNames',
    'taiyinBrightness', 'taiyinBranch', 'wenchangBranch', 'taiyinBirthDaylight', 'taiyinWenchangInLifeArea',
    'yearLifeAreaWritingStars', 'yearLifeAreaLiteraryTransforms', 'yearLifeLiteraryPairVerified',
    'yearLifeExamStars', 'yearLifeExamKeOpposition', 'yearLifeExamStructureVerified', 'yearLifeNobles', 'yearLifeExamKeWithNoblesVerified',
    'natalHongluanInYearLife', 'natalHongluanProof',
    'dailyLearningVoidPairAtLife', 'dailyStudySupportedCandidate', 'dailyStudySupport', 'dailyPeachLuCandidate', 'dailyPeachLu', 'dailyTravelEvidence'],
  'ziwei:ling_transformation_contact': ['profile', 'sourceScope', 'sourceStem', 'star', 'kind', 'branch', 'flowName', 'natalName', 'inLifeArea'],
  'ziwei:quanshu_annual_context': ['birthStem', 'lifeBranch', 'migrationBranch', 'lucunBranch', 'qingyangBranch', 'tuoluoBranch',
    'annualStem', 'annualLucunBranch', 'annualQingyangBranch', 'annualTuoluoBranch', 'annualQingyangLifeRelation', 'annualTuoluoLifeRelation'],
  'ziwei:quanshu_killer_echo': ['profile', 'lunarYear', 'annualStem', 'annualBranch', 'lifeBranch', 'birthYearBranch', 'birthHour',
    'killerBranch', 'killerLifeRelation', 'killerGrade', 'annualYangTuo', 'jointAnnualContact', 'natalQingyangBranch', 'natalQingyangInMaoYou',
    'annualQingyangInMaoYou', 'lifeInMaoYou', 'tabooPositions', 'rescuePositions', 'auxiliaryPositions', 'verseSeats', 'sourceMinor', 'actualLimitEchoCandidate',
    'jielanJiaGuiKillerEchoCandidate', 'jielanJiaGuiKillerEchoWitness'],
  'ziwei:quanshu_limit_chapter': ['profile', 'lunarYear', 'annualStem', 'decadal', 'minor', 'yearly', 'monthly', 'daily',
    'sourceDecadal', 'cleanSeatCandidate', 'overlappingShaCandidate', 'dailyShaCandidate', 'stageStart', 'stageEnd', 'unverifiedMajorStars',
    'sourceSkyReady', 'sourceRobberyReady', 'unverifiedAuxiliaryStars',
    'cleanSeatMingFixedCandidate', 'overlappingMingFixedShaCandidate', 'overlappingMingAnnualBellCandidate',
    'overlappingMingNatalTabooAndMinorBellCandidate', 'overlappingMingNatalTabooWithAnnualShangShiCandidate',
    'overlappingAnnualSeatShaCandidate', 'dailyFlankedShaCandidate', 'flankWitnesses',
    'overlappingAnnualShangShiCandidate', 'annualShangShiGuards', 'overlappingAnnualFlyingShaCandidate', 'annualFlyingShaBranches',
    'overlappingMingFlyingShaWitness',
    'overlappingAnnualBoshiCandidate', 'overlappingMingAnnualBoshiCandidate', 'annualBoshiGuards',
    'dailyGuardedTabooCandidate', 'guardedTabooWitnesses',
    'jielanDailyShaCandidate', 'jielanDailyShaWitness', 'jielanDailyFireBellCandidate', 'jielanDailyFireBellWitness',
    'jielanHourWitness',
    'quanshuFixedFireBellProfile', 'mingOpeningShaCandidate', 'mingOpeningSha',
    'mingOpeningMinorNatalShaCandidate', 'mingOpeningMinorNatalShaWitness',
    'cleanSeatMingFourHelpersCandidate', 'cleanSeatMingFourHelpersWitness',
    'cleanSeatMingLucunHuaLuCandidate', 'cleanSeatMingLucunHuaLuWitness',
    'overlappingMingAnnualBladeAtDecadalCandidate',
    'exitInWindow', 'decadalMultipleSupportAtSeat', 'exitVerifiedNamedSupportAtBoundary', 'exitVerifiedFewNamedSupportsAtBoundary', 'exitVerifiedMingFourHelpersAtBoundary',
    'overlappingMingAnnualNatalShaGuardCandidate', 'overlappingMingAnnualNatalShaGuardWitness',
    'exitFallenWithoutNamedGuardCandidate', 'exitFallenWithoutNamedGuardWitness', 'lifeBranch', 'lifeReliefStars'],
  'ziwei:quanshu_transform_limits': ['profile', 'lunarYear', 'annualStem', 'annualBranch', 'decadalBranch', 'minorBranch',
    'chartCategory', 'seats', 'tripleTabooCandidate', 'minorLuCandidate', 'minorNatalLuGuard', 'sourceMinor', 'sourceDecadal',
    'tripleNatalJiVerifiedGuard', 'femaleLuQuanshuFixedFireTabooCandidate', 'femaleNatalLuCunCoGuards',
    'decadalQuanShaCandidate', 'decadalQuanAspectShaCandidate', 'decadalNatalQuanSha', 'decadalNatalQuanAspectSha',
    'decadalNatalQuanPojunHaoCandidate', 'decadalNatalQuanPojunHaoWitness',
    'decadalNatalQuanTianShangHaoCandidate', 'decadalNatalQuanTianShangHaoWitness',
    'decadalNatalQuanShangShiAssemblyCandidate', 'decadalNatalQuanShangShiAssemblyWitness',
    'decadalNatalQuanNamedAssemblyCandidate', 'decadalNatalQuanNamedAssemblyWitness',
    'femaleLuSupportCandidate', 'femaleLuShaCandidate', 'femaleLuJielanFireTabooCandidate',
    'tianjiSanHuaCandidate', 'tianjiNatalSanHuaCandidate', 'tianjiNatalLucunKeQuanCandidate', 'tianjiYearLucunKeQuanCandidate',
    'tianjiShaAspectCandidate', 'natalQuanLuJiShaAtLimit', 'sameSourceQuanLuJiShaCandidate',
    'quanshuFixedFireBellProfile', 'natalQuanLuJiMingYangBellAspectAtLimit',
    'volumeTwoTabooReliefAtLimitCandidate', 'volumeTwoTabooFallenAtLimitCandidate', 'volumeTwoTabooTempleAtLimitCandidate',
    'sunNatalJiReliefGuard', 'moonNatalJiReliefGuard', 'volumeTwoNamedBirthStemJiReliefCandidate',
    'lianzhenHaiWaterYearAtLimitCandidate', 'natalLianzhenHaiBothWaterGuard', 'birthYearPillar', 'birthYearNaYin', 'lifePalacePillar', 'lifePalaceNaYin', 'verifiedLifeBureau'],
  'ziwei:quanshu_limit_combinations': ['profile', 'lunarYear', 'decadalBranch', 'minorBranch', 'lifeBranch', 'bodyBranch',
    'sourceDecadal', 'sourceMinorVerified', 'mingXingQiuShaCandidate', 'mingXingQiuShaWitness',
    'mingBladeDarkDoubleGuardCandidate', 'mingBladeDarkDoubleGuardWitness',
    'mingTuoTanlangDoubleGuardCandidate', 'mingTuoTanlangDoubleGuardWitness',
    'fallenJumenDoubleGuardCandidate', 'fallenJumenDoubleGuardWitness',
    'fallenTanPoLianDoubleGuardWitnesses',
    'starPairs', 'majorContacts', 'tuoluoBranch', 'tuoLife', 'tuoBody', 'auxiliaryGroups', 'qingyangBranch', 'quanShaGroups',
    'quanshuFixedFireBellProfile', 'mingFixedBladeFireBellPairs', 'mingFixedBladeFireBellCandidate',
    'tanHaoGroups', 'splitMajorPairs', 'yangTuoCandidate', 'tuoHelperPairCandidate', 'yangQuanShaCandidate',
    'tanHaoAnnualCandidate', 'fourMajorsCandidate', 'splitMajorPairCandidate'],
  'ziwei:quanshu_annual_sha': ['profile', 'lunarYear', 'yearBranch', 'migrations', 'pojunCase', 'bellTigerCase',
    'pojunWangNativeHuaLuSupport', 'pojunWangNativeHuaLuWitness', 'pojunYearlyHuaLuContact',
    'migrationFireCandidate', 'migrationFireShaRepeatCandidate', 'migrationSharedFireShaRepeat', 'migrationSharedMingEarthShaRepeat', 'yearlyShaCandidate',
    'jielanBellTigerCandidate', 'tigerAtPojunLimitCandidate', 'unverifiedMajorStars',
    'quanshuFixedBellTigerCase', 'quanshuFixedBellTigerCandidate', 'fixedBellTigerZiweiGuard',
    'pojunJielanMinorFlowShaCandidate', 'pojunJielanMinorFlowShaWitness'],
  'ziwei:quanshu_literary_limits': ['profile', 'lunarYear', 'annualStem', 'annualBranch', 'decadalBranch', 'minorBranch',
    'chang', 'changGrade', 'changNanyangGrade', 'changContacts', 'sun', 'horse', 'limits', 'sourceMinor', 'lifeBranch', 'horseSplit', 'changThreeLayersCandidate',
    'changVerifiedTripleGuard', 'keChangVerifiedDoubleGuard', 'keChangVerifiedWitness',
    'keChangVerifiedSiblingLimitProfile', 'keChangVerifiedSiblingWitness', 'keChangVerifiedOpposedLimit', 'keChangVerifiedTrineLimit',
    'keChangMingGengProfile', 'keChangMingGengWitness', 'keChangMingGengDoubleGuard', 'keChangMingGengOpposedLimit', 'keChangMingGengTrineLimit',
    'sourceDecadal', 'keChangMingGengSharedLimitAspect', 'keChangMingGengSharedLimitAspectWitness',
    'keChangMingNatalDoubleGuardWithKeAspectWitness', 'keChangMingNatalKeAtDoubleGuardWithChangAspectWitness',
    'changQuanshuFixedAdverseCandidate', 'changQuanshuFixedTrineShaJiCandidate',
    'changAdverseCandidate', 'changTrineShaJiCandidate', 'keChangCandidate', 'keChangAspectCandidate',
    'keChangSharedAspectCandidate', 'keChangSplitAspectCandidate',
    'movingChangQuCandidate', 'movingChangQuAssistantCandidate', 'movingChangQuNamedTrinesCandidate',
    'movingChangQuNatalTransformCandidate', 'movingChangQuSourceSeatsCandidate',
    'movingChangQuLifeAndCommonMinorTrinesCandidate', 'movingChangQuCommonMinorTrineWitness',
    'movingChangQuBothLimitsTrineCandidate', 'movingChangQuBothLimitsTrineWitness', 'movingChangQuAnnualHuaLuTrineConfirmed',
    'movingChangQuMixedNamedTrinesCandidate', 'movingChangQuMixedNamedTrinesWitness',
    'horseChangCandidate', 'horseChangSplitCandidate', 'lumingChang', 'lumingHorseSplit',
    'lumingHorseChangCandidate', 'lumingHorseChangSplitCandidate', 'horseChangDoubleGuardAgreementCandidate', 'horseChangDoubleGuardAgreementWitness',
    'horseChangZiFuOpposedDoubleGuardCandidate', 'horseChangZiFuOpposedDoubleGuardWitness',
    'horseChangLumingDoubleGuardCandidate', 'horseChangLumingDoubleGuardWitness',
    'jielanAnnualChangProfile', 'horseChangJielanDoubleGuardCandidate', 'horseChangJielanDoubleGuardWitness'],
  'ziwei:quanshu_limit_branches': ['profile', 'lunarYear', 'annualBranch', 'decadalBranch', 'minorBranch', 'yearContacts', 'sourceDecadal',
    'relief', 'annualOppositionAdverse', 'seatEvidence', 'birthStem', 'decadalAtChenXu', 'minorAtChenXu', 'changQu', 'annualReliefCandidate',
    'annualOppositionProfile', 'sourceMinor', 'annualDoubleVerifiedOppositionCandidate', 'quanshuFixedFireBellProfile', 'annualMingFixedSha',
    'annualOpposedDecadalVerifiedFullReliefCandidate', 'annualMingFixedOppositionShaCandidate',
    'annualCrossGroupReliefCandidate', 'annualCrossGroupReliefWitnesses',
    'annualAdverseCandidate', 'annualSeatedReliefCandidate', 'annualSeatedAdverseCandidate', 'annualOpposedGuardCandidate', 'annualAdverseGuards',
    'annualTrineAdverseCandidate', 'annualTrineAdverseWitnesses', 'annualOpposedQishaCandidate', 'annualQishaBranch',
    'chenXuChangQuCandidate', 'chenXuBothLimitsCandidate', 'chenXuSplitChangQuCandidate', 'chenXuTempleCandidate', 'chenXuTempleAspectCandidate',
    'templeChangQuBothLimitsCandidate', 'mingChenXuNatalChangQuLifeCandidate', 'mingChenXuNatalChangQuLifeWitness',
    'threeVolumeJiChenXuNatalChangQuLifeCandidate', 'threeVolumeJiChenXuNatalChangQuLifeWitness',
    'wenquTempleDoubleGuardCandidate', 'wenchangTempleDoubleGuardCandidate', 'branch',
    'templeChangQuSplitDoubleGuardCandidate', 'templeChangQuSplitDoubleGuardWitness',
    'qishaTianfu', 'qishaTianfuAtLimitCandidate', 'qishaTianfuBothLimitsCandidate',
    'qishaAdverseAtLimitCandidate', 'qishaAdverseGuards'],
  'ziwei:quanshu_year_and_limits': ['profile', 'lunarYear', 'lifeBranch', 'annualBranch', 'guards', 'pairs',
    'annualOppositions', 'annualNamedStarContacts', 'independentGuardsReady', 'reviewedLimitContact',
    'annualOppositionProfile', 'sourceMinor', 'annualDoubleVerifiedOppositionCandidate',
    'annualFlowContacts', 'annualFlowOppositionCandidate', 'threeLayerTrineCandidate',
    'fallenWithAdverseAtAllThree', 'threeLayerFallenShangShiCandidate', 'threeLayerFallenShangShiWitnesses',
    'annualAtLife', 'lifeArea', 'guiLifeZiExample'],
  'ziwei:quanshu_shangshi_limits': ['profile', 'lunarYear', 'annualBranch', 'decadalBranch', 'minorBranch', 'tianshang', 'tianshi',
    'unverifiedMajorStars',
    'tianshangReliefCandidate', 'tianshangAdverseCandidate', 'tianshiReliefCandidate', 'tianshiAdverseCandidate',
    'tianshangCrossGroupReliefCandidate', 'tianshangAnnualFirePairCandidate', 'tianshiCrossGroupReliefCandidate', 'tianshiAnnualFirePairCandidate',
    'tianshangJielanFireCandidate', 'tianshiJielanFireCandidate', 'tianshiXuDiagramCandidate',
    'quanshuFixedFireBellProfile', 'tianshangQuanshuFixedFireCandidate', 'tianshiQuanshuFixedFireCandidate',
    'tianshangMingNatalFireYangDoubleGuardCandidate', 'tianshangMingNatalFireYangDoubleGuardWitness'],
  'ziwei:quanshu_kongjie_limits': ['profile', 'lunarYear', 'annualBranch', 'decadalBranch', 'minorBranch', 'skyBranch', 'robberyBranch',
    'sky', 'robbery', 'robberyLimits', 'sourceDecadal', 'sourceSkyReady', 'sourceRobberyReady',
    'sharedPalace', 'splitLimits', 'pairedSha', 'annualShaPositions', 'annualOfficial', 'boshiOfficial',
    'voidsBothActualLimitsGuardCandidate', 'voidsZiweiMaoYouSplitTrineWitness', 'robberyFourFlyingOfficialDoubleGuardCandidate',
    'mingBoshiOfficialProfile', 'robberyMingBoshiOfficialGuardCandidate', 'robberyMingBoshiOfficialScopes',
    'robberyVerifiedLimitScopes', 'robberyTaiSuiSkyCandidate',
    'robberyMingTaiSuiNatalShaDoubleGuardCandidate', 'robberyMingTaiSuiNatalShaDoubleGuardWitness',
    'knownLocalPrincipals', 'independentSupport', 'skyAllThreeAtSeat', 'pairedVoidsCandidate', 'robberyShaCandidate',
    'robberyAnnualOfficialCandidate', 'robberyBoshiOfficialCandidate', 'skySupportCandidate', 'voidPairRelation', 'voidAspectLimitsCandidate',
    'voidAspectWitnesses', 'taiSuiNamedSha', 'robberyTaiSuiShaCandidate', 'taiSuiFireBellEnvoy', 'robberyTaiSuiFireBellEnvoyCandidate',
    'quanshuFixedFireBellProfile', 'taiSuiQuanshuFixedFireBell', 'robberyTaiSuiQuanshuFixedFireBellCandidate',
    'voidMingFixedFourShaCandidate', 'voidMingFixedFourShaWitnesses', 'voidJielanFourShaCandidate', 'voidJielanFourShaWitnesses',
    'skySupportLimits', 'skyPartnerSupportCandidate', 'skyPartnerSupportWitnesses', 'lucunSupport', 'skyLuSupportCandidate',
    'skyPartnerLuSupportCandidate', 'skyPartnerLuSupportWitnesses', 'skyCoSeatedAssistantCandidate', 'skyCoSeatedAssistantWitness',
    'skyCoSeatedNobleCandidate', 'skyCoSeatedNobleWitness',
    'skyCoSeatedMingAuxiliaryNobleCandidate', 'skyCoSeatedMingAuxiliaryNobleWitness'],
  'ziwei:quanshu_limit_verse_contacts': ['profile', 'lunarYear', 'decadalBranch', 'minorBranch', 'sourceDecadal',
    'ji', 'jiGrade', 'jiQuestionSongTemple', 'jiSupport', 'jiTongChangQu', 'jiSha', 'jiBothLimitsAspect', 'jiBaseCandidate',
    'jiBothLimitsAspectCandidate', 'jiSupportCandidate', 'jiLiangTogetherCandidate', 'jiTongChangQuCandidate', 'jiFallenShaCandidate',
    'jiMingFixedFourShaCandidate', 'jiMingFixedSha',
    'xiang', 'xiangGrade', 'xiangGrowth', 'xiangSupport', 'xiangLianPo', 'xiangWuTan', 'xiangYangTuo', 'xiangFireBell',
    'xiangDoubleGuardCandidate', 'xiangIdleSeatCandidate', 'xiangIdleBothLimitsAspectCandidate', 'xiangGrowthAidCandidate', 'xiangTempleAidCandidate',
    'xiangFallenLianPoYangTuoCandidate', 'xiangFallenOpposedCandidate',
    'xiangQuanshuFixedFireBell', 'xiangFallenQuanshuFixedOpposedCandidate',
    'quanshuFixedFireBellProfile', 'xiangMingYangFireBellCandidate', 'xiangMingYangFireBellWitnesses',
    'xiangMingYangAtVerifiedLimitCandidate', 'xiangMingYangAtVerifiedLimitWitness',
    'tong', 'tongSourceGrade', 'tongSha', 'tongAnnualYangTuo', 'tongSupportCandidate', 'tongFallenOpposedCandidate', 'tongFallenAnnualOpposedCandidate',
    'tongVoids', 'tongJi', 'tongFallenVoidsOpposedCandidate', 'tongFallenJiOpposedCandidate',
    'yin', 'sunBranch', 'yinReverseSource', 'yinYangTuo', 'yinAnnualYangTuo', 'yinFireBell', 'yinAtVerifiedLimitCandidate', 'yinClearFireBellCandidate', 'yinPairedFireBellCandidate', 'yinSingleFireBellCandidate',
    'yinQuanshuFixedFireBell', 'yinQuanshuFixedClearFireBellCandidate', 'yinQuanshuFixedPairedFireBellCandidate', 'yinReverseQuanshuFixedFireBellCandidate',
    'yinMingDoubleGuardBothFireBellAspectsCandidate', 'yinMingDoubleGuardBothFireBellAspectsWitness',
    'yinMingSingleGuardWithoutFireBellCandidate', 'yinMingSingleGuardWithoutFireBellWitness',
    'yinReverseQuanshuFixedSplitLimitsCandidate', 'yinReverseQuanshuFixedSplitLimitsWitness',
    'yinReverseAnnualYangTuoCandidate',
    'yinVolumeThreeNativeTrineDoubleGuardCandidate', 'yinVolumeThreeNativeTrineDoubleGuardWitness',
    'yinReverseYangTuoCandidate', 'yinReverseFireBellCandidate', 'bell', 'bellTanlang', 'bellWuqu', 'bellSupport', 'bellSourceGrade',
    'bellWithoutNamedSupportCandidate', 'bellWithNamedSupportCandidate', 'bellTanlangAtLimitCandidate', 'bellTanlangAspectCandidate',
    'bellAdditionalAid', 'bellWithAdditionalAidCandidate',
    'bellDoubleLimitWithoutNamedSupportCandidate', 'bellTempleWuTanCandidate', 'bellTempleSupportPairCandidate', 'bellTempleSupportPairs',
    'bellTempleHelperGroupsCandidate', 'bellTempleFullSupportCandidate', 'jielanBell', 'jielanBellCandidate',
    'jielanBellWithoutNamedSupportCandidate', 'quanshuFixedBell', 'quanshuFixedBellCandidate',
    'quanshuFixedBellWithoutNamedSupportCandidate'],
  'ziwei:quanshu_solar_wu_po_limits': ['profile', 'lunarYear', 'decadalBranch', 'minorBranch', 'sourceDecadal', 'sourceMinor', 'sun', 'sunTaboos', 'sunHazards', 'sunDarkWitness', 'sunDarkCandidate',
    'sunDarkQuanshuFixedFireBell', 'sunDarkQuanshuFixedCandidate', 'sunMingDimPairDoubleGuard', 'sunDarkMingDoubleGuardWitness', 'sunMingBrightDoubleGuardWitness',
    'quanshuFixedFireBellProfile', 'sunMingFixedHazards', 'sunMingFixedHarmoniousCandidate', 'sunMingFixedTwoLimitAspectCandidate',
    'sunMingFixedFallenShaCandidate', 'sunMingFixedTabooShaCandidate',
    'sunHarmoniousCandidate', 'sunTwoLimitAspectCandidate', 'sunFallenShaCandidate', 'sunTabooShaCandidate', 'sunTabooShaSharedPalaces', 'wu', 'wuChang', 'wuAssistants',
    'wuTempleAtVerifiedLimitCandidate', 'wuTemplePlainCandidate', 'wuTempleChangCandidate', 'wuTempleChangNeighborCandidate',
    'wuTempleChangAssistantsCandidate', 'wuTempleChangFlankedCandidate',
    'wuQuanAtLimitCandidate', 'wuQuanWitnesses', 'wuQuanAssistedCandidate', 'wuNatalQuanAtActiveLimitCandidate',
    'po', 'poChang', 'poNobles', 'poHazards', 'poTempleAtVerifiedLimitCandidate', 'poTemplePlainCandidate', 'poTempleSupportCandidate', 'poTempleJoinedSupportCandidate',
    'poTempleBothNoblesCandidate', 'poTempleAdverseCandidate'],
  'ziwei:quanshu_xing_ji_tiger': ['profile', 'lunarYear', 'annualBranch', 'parents', 'lianzhen', 'qisha', 'layers',
    'tianxingBranch', 'tianxingAtLianzhen', 'tianxingAtQisha', 'annualTiger', 'natalTiger', 'bellBranch', 'qishaAtLife', 'qishaAtBody',
    'support', 'lianzhenAnnualTiger', 'lianzhenNatalTiger', 'parentMoonTigerCandidate', 'parentMoonSuiGuardTigerTrineCandidate',
    'parentMoonSuiTigerTrinesCandidate', 'parentMoonYearContactsCandidate', 'parentMoonNatalSameSeatCandidate', 'parentMoonEvidence', 'lianzhenNatalXingJiBladeCandidate',
    'lianzhenYearXingJiBladeCandidate', 'lianzhenAtSuiMinor', 'qishaTianxingJiCandidate', 'qishaAnnualBladeJiCandidate',
    'qishaSamePalaceAnnualJiBladeCandidate', 'qishaXingJiEvidence', 'principalSeatProof',
    'mingQishaNatalLucunSameSeatCandidate', 'mingQishaNatalLucunWitness',
    'mingQishaNatalLucunOffTaiSuiCandidate', 'mingQishaNatalLucunOffTaiSuiWitness',
    'qishaNatalBladeTigerCandidate', 'qishaYearBladeTigerCandidate', 'qishaBell',
    'qishaNatalBladeAspectTigerCandidate', 'qishaYearBladeAspectTigerCandidate', 'lifeBranch', 'bodyBranch', 'lifeContact', 'bodyContact',
    'nativeSha', 'nativeAdditionalSha', 'lifeBodyShaCandidate', 'lifeBodyAdditionalShaCandidate', 'jielanBell', 'qishaJielanBellTigerCandidate',
    'quanshuFixedFireBellProfile', 'lifeBodyMingFixedFireBell', 'lifeBodyMingFixedShaCandidate', 'lifeBodyMingFixedPairVerified',
    'quanshuFixedBell', 'qishaQuanshuFixedBellTigerCandidate', 'qishaQuanshuFixedNatalBladeTigerCandidate'],
  'ziwei:quanshu_year_encounters': ['profile', 'lunarYear', 'cries', 'mourningBranch', 'cryMourningCandidate',
    'cryMourningLimitContacts', 'cryMourningLimitAspectCandidate', 'cryMourningSplitLimitsCandidate', 'cryMourningSplitGuards',
    'cryMourningDadeSplitFourFlyingWitness', 'cryVoidDadeFlankedDecadalWitness',
    'cryMourningNanyangMinorCandidate', 'cryMourningNanyangLifeCandidate', 'cryMourningNanyangWitnesses',
    'cryMourningQuanjiProfile', 'cryMourningQuanjiLifeAspectCandidate', 'cryMourningQuanjiLifeWitness',
    'cryVoidTogetherCandidate', 'cryVoidSplitCandidate', 'cryVoidExceptionCandidate', 'cryVoidLuCandidate',
    'cryVoidBothStarsDoubleGuardCandidate', 'cryVoidBothStarsDoubleGuardWitness',
    'cryVoidLimitWitnesses', 'cryVoidSameLimitAspectCandidate', 'cryVoidOtherLimitAspectCandidate', 'cryVoidLuAspectCandidate',
    'yearLayers', 'doujunBranch', 'doujunSha', 'doujunAnnualSha', 'includesFirstInstant',
    'birthMonth', 'birthMonthBasis', 'birthLeapMonth',
    'doujunYearContrastCandidate', 'doujunYearAnnualShaCandidate',
    'quanshuFixedFireBellProfile', 'doujunMingYearContrastCandidate', 'doujunMingYearAnnualShaCandidate', 'mingDoujunSha'],
  'ziwei:quanshu_doujun_year_month': ['profile', 'lunarYear', 'lunarMonth', 'branch', 'support', 'sha', 'annualSha',
    'birthMonth', 'birthMonthBasis', 'birthLeapMonth',
    'natalShaReviewCandidate', 'annualShaReviewCandidate',
    'quanshuFixedFireBellProfile', 'mingSha', 'mingNatalShaReviewCandidate', 'mingAnnualShaReviewCandidate'],
  'ziwei:quanshu_body_limit_encounters': ['profile', 'lunarYear', 'tanlang', 'tianxingBranch', 'tanlangXing', 'taboos',
    'tanlangNatalXingJiCandidate', 'tanlangYearXingJiCandidate', 'qisha', 'qishaGrade', 'life', 'body',
    'ziweiBranch', 'qishaZiwei', 'lu', 'flowSha', 'qishaSeparateBodyLifeCandidate', 'qishaSharedBodyLifeCandidate',
    'qishaBodyLifeAspectCandidate', 'qishaBodyLifeAspectWitnesses',
    'qishaBodyLifeJielanMinorShaCandidate', 'qishaBodyLifeJielanMinorShaWitness', 'jielanShaBranches',
    'qishaBodyLifeRepeatCandidate', 'qishaPlainLimitCandidate', 'qishaImperialLuCandidate', 'qishaFlowShaCandidate',
    'annualTiger', 'qishaAnnualTigerGuardCandidate'],
  'ziwei:quanshu_palace_condition': ['branch', 'flowName', 'natalName', 'localStarNames', 'sourceQualities', 'unknownQualityStars',
    'localNatalTransformations', 'surroundingNatalTransformations'],
  'ziwei:quanshu_limit_phase': ['branch', 'startAge', 'endAge', 'nominalAge', 'stageStart', 'stageEnd'],
  'ziwei:quanshu_limit_star_timing': ['profile', 'lunarYear', 'halves', 'qisha', 'pojun', 'verifiedStarTimings',
    'unverifiedTimingStars', 'qishaTianfuActiveWitness', 'sourceDecadalVerified', 'sourceMinorVerified'],
  'ziwei:quanshu_timed_limit_condition': ['profile', 'star', 'starGroup', 'branch', 'guardScopes', 'activeInSourceHalf',
    'bellLimitWindows', 'bellPositiveSupportWitnesses', 'bellMingDoubleGuardAidWitness', 'bellMingDoubleGuardLiteraryAidWitness', 'quanshuFixedBellDoubleGuardWithLiteraryAidCandidate',
    'tianjiNatalSanHuaCandidate', 'tianjiNatalLucunKeQuanCandidate', 'tianjiShaAspectCandidate', 'tianjiSupportWitnesses', 'tianjiAspectWitnesses',
    'tianjiPlainOppositionCandidate', 'tianjiPlainOppositionWitnesses', 'tianjiDualTrineLimitCandidate', 'tianjiDualTrineLimitWitness',
    'tianjiMingNatalLucunKeQuanDoubleGuardCandidate', 'tianjiNatalShaOpposedCandidate',
    'jielanShaBranches', 'qishaJielanMinorFlowShaCandidate', 'tianliangJielanFireBellOpposedTrineCandidate', 'tianliangPlainGuardCandidate',
    'tianliangPlainMingClearDoubleGuardCandidate', 'tianliangPlainMingClearGuardCandidate', 'wenquPlainDoubleGuardCandidate',
    'wenquBrightMingDoubleGuardCandidate', 'wuNatalQuanAtActiveLimitCandidate',
    'wuNatalQuanMingChangQuAtActiveLimitCandidate', 'wuNatalQuanMingChangQuWitness',
    'tianliangJielanFireBellWitness', 'wenquJielanYinFallenCandidate', 'wenquJielanYinFallenWitness',
    'lianzhenNatalSelfJiAnnualBladeCandidate', 'lianzhenNatalSelfJiAnnualBladeWitness',
    'lianzhenNatalDoubleGuardActiveCandidate', 'lianzhenNatalDoubleGuardWitness',
    'lianzhenYearSelfJiBladeDoubleGuardCandidate', 'lianzhenYearSelfJiBladeDoubleGuardWitness',
    'lianzhenYearWenquJiBladeDoubleGuardCandidate', 'lianzhenYearWenquJiBladeDoubleGuardWitness',
    'lianzhenYearWenquJiOpposedDoubleGuardCandidate', 'lianzhenYearWenquJiOpposedDoubleGuardWitness',
    'tongFallenVoidsOpposedAtTaiSuiDoubleGuardCandidate', 'tongFallenVoidsOpposedAtTaiSuiDoubleGuardWitness',
    'tongFallenNatalJiOpposedAtTaiSuiDoubleGuardCandidate', 'tongFallenNatalJiOpposedAtTaiSuiDoubleGuardWitness',
    'wenquChapterFallenWeakLifeCandidate', 'wenquChapterFallenWeakLifeWitness',
    'qishaImperialLuBodyLifeConflictCandidate', 'qishaImperialLuBodyLifeConflictWitness',
    'tanlangMingNatalYangJiAspectCandidate', 'tanlangMingNatalYangJiAspectWitness',
    'tanlangMingNatalYangTuoJiCandidate', 'tanlangMingNatalYangTuoJiWitness',
    'tanlangMingXingJiAliasesCandidate', 'tanlangMingXingJiAliasesWitness',
    'wenquPlainGuardCandidate', 'wenquJielanChangQuGuardCandidate', 'wenquJielanChangQuGuardWitness',
    'wenquJielanChangQuSplitActiveCandidate', 'wenquJielanChangQuSplitActiveWitness',
    'wenquMingTongTrineDoubleGuardCandidate', 'wenquMingTongTrineDoubleGuardWitness',
    'wenquMingSeatedTongTrineAssistantsDoubleGuardCandidate', 'wenquMingSeatedTongTrineAssistantsDoubleGuardWitness',
    'wenquMingDistributedDoubleGuardCandidate', 'wenquMingDistributedDoubleGuardWitness',
    'tianliangMingTempleTrineDoubleGuardCandidate', 'tianliangMingTempleTrineDoubleGuardWitness',
    'tianliangMingTempleDistributedDoubleGuardCandidate', 'tianliangMingTempleDistributedDoubleGuardWitness',
    'wuTempleMingChangFuBiOpposedDoubleGuardCandidate', 'wuTempleMingChangFuBiOpposedDoubleGuardWitness',
    'poTempleMingChangTwoNoblesDistinctTrineDoubleGuardCandidate', 'poTempleMingChangTwoNoblesDistinctTrineDoubleGuardWitness',
    'poFallenMingBladeFireBellCandidate', 'poFallenMingBladeFireBellWitness',
    'poTempleMingNamedShaClearCandidate', 'poTempleMingJoinedSupportCandidate', 'poTempleMingHazards', 'poChang'],
  'ziwei:quanshu_tianxing_condition': ['profile', 'birthMonth', 'branch', 'natalName', 'tianxingBranch', 'inLimit', 'templeListed'],
  'ziwei:quanshu_kongjie_condition': ['profile', 'birthHour', 'branch', 'natalName', 'skyBranch', 'robberyBranch', 'modernSkyBranches',
    'skyRobberyTogether', 'localSourceVoids', 'archivedMajorStarNames', 'lunarYear', 'yearBranch', 'annualAtPalace', 'annualOpposite', 'annualTriad'],
  'ziwei:quanshu_support_condition': ['profile', 'birthStem', 'birthMonth', 'birthHour', 'scope', 'branch', 'natalName', 'lunarYear',
    'annualStem', 'annualBranch', 'annualRelation', 'annualLucunBranch', 'annualLucunRelation', 'otherScope', 'otherBranch', 'otherSamePalace',
    'otherAtChenXu', 'sourceLocalStars', 'sourceOppositeStars', 'sourceTrineStars', 'sourceAdjacentStars', 'decadalAreaStars',
    'sourceAuxiliaryQualities', 'noblePair', 'nobleArchiveBranches', 'nobleArchiveState', 'namedSupport',
    'propertySunCandidate', 'propertySunSplitAssistedCandidate', 'ziweiSupportCandidate', 'ziweiTrinePairCandidate',
    'twoLimitGuardProfile', 'propertySunDoubleFuBiGuard', 'ziweiDoubleFuBiGuard', 'ziweiMingFuXiangDoubleGuardCandidate', 'ziweiMingFuXiangSeatAndTrineDoubleGuardCandidate',
    'tianliangSupportCandidate', 'wenquSupportCandidate', 'wenquPairedLimitsCandidate',
    'tianliangTempleSupportCandidate', 'tianliangCombinedShaCandidate', 'tianliangQuanshuFixedCombinedShaCandidate',
    'ziweiThreeShaCandidate', 'wenquFallenCandidate', 'wenquChapterFallenCandidate'],
  'western:aspect_interval': ['transitBody', 'natalTargetType', 'natalTargetId', 'aspectType', 'orb'],
  'western:progressed_position': ['body', 'longitude', 'declination', 'natalLongitude', 'natalDeclination', 'zodiac', 'referenceAt'],
  'western:progressed_aspect': ['progressedBody', 'natalTargetId', 'targetKind', 'aspectType', 'allowedOrb', 'coordinate',
    'progressedLongitude', 'natalLongitude', 'progressedDeclination', 'natalDeclination', 'sameHemisphere', 'clippedStart', 'clippedEnd'],
  'western:progressed_aspect_exact': ['progressedBody', 'natalTargetId', 'targetKind', 'aspectType', 'allowedOrb', 'coordinate',
    'progressedLongitude', 'natalLongitude', 'progressedDeclination', 'natalDeclination', 'sameHemisphere', 'clippedStart', 'clippedEnd'],
  'western:house_interval': ['transitBody', 'natalHouse'],
  'western:natal_house_cusps': ['houseSystem', 'cusps'],
  'western:traditional_house_interval': ['transitBody', 'natalHouse', 'houseSystem'],
  'western:leo_mc_tenth_contact': ['profile', 'transitBody', 'inTenth', 'mcLongitude', 'mcContacts', 'linkedMcInWindow', 'clippedStart', 'clippedEnd'],
  'western:traditional_cusp_crossing': ['transitBody', 'house', 'cuspLongitude', 'transitMotion', 'houseSystem'],
  'western:sepharial_saturn_second_house': ['houseProfile', 'secondCuspLongitude', 'enteredThroughSecondCusp',
    'entryMotion', 'entryCusp', 'exitMotion', 'exitCusp'],
  'western:sepharial_jupiter_lunation': ['houseProfile', 'natalHouse', 'natalJupiterLongitude', 'newMoonLongitude',
    'exactConjunction', 'newMoonAt', 'nextNewMoonAt'],
  'western:progressed_ascendant': ['longitude', 'sign', 'decan'],
  'western:progressed_house': ['body', 'house', 'houseSystem'],
  'western:aspect_exact': ['transitBody', 'natalTargetType', 'natalTargetId', 'aspectType', 'passIndex', 'transitMotion',
    'retrogradeLoopPassIndex', 'retrogradeLoop'],
  'western:natal_position': ['body', 'longitude', 'zodiac', 'houseSystem', 'natalHouse'],
  'western:solar_return': ['returnAt', 'returnEnd', 'natalSunLongitude', 'bodies', 'zodiac', 'houseSystem', 'returnAngles', 'traditionalDignities'],
  'western:station_natal_contact': ['transitBody', 'natalTargetId', 'separation', 'exactConjunction', 'directionAfter', 'zodiac'],
  'western:new_moon_natal_contact': ['longitude', 'natalTargetId', 'natalLongitude', 'separation', 'exactConjunction', 'zodiac'],
  'western:ptolemy_time_place': ['origin', 'level', 'sign', 'ruler', 'annualSign', 'annualRuler', 'monthSign', 'monthlyRuler',
    'natalGovernors', 'completedYears', 'fullPeriodStart', 'fullPeriodEnd', 'primaryDirection'],
  'western:ptolemy_ingress_contact': ['origin', 'level', 'sign', 'ruler', 'annualSign', 'annualRuler', 'monthSign', 'monthlyRuler',
    'transitBody', 'transitSign', 'aspectType', 'sameAsAnnualLord', 'sameAsMonthlyLord', 'natalGovernors', 'natalRulership', 'natalOriginAspect',
    'natalOriginSignFamiliarity', 'natalTransitBodySign',
    'annualOriginAspect', 'monthlyOriginAspect', 'transitAnnualAspect', 'transitMonthlyAspect', 'transitNatalOriginAspect', 'annualTransitNatalOriginAspect',
    'annualClockComparisonProfile', 'annualClockAgreement',
    'subperiodClockComparisonProfile', 'subperiodClockAgreement',
    'planetSect', 'oppositeNatalSect', 'natalMercuryHorizon', 'sameNatalMercuryHorizonSect',
    'physicalIngressAt', 'timedPlaceIngressAt', 'enteredDuringTimedPlace', 'primaryDirection', 'sameAsPrimaryDirectionRuler', 'sameAsPrimaryTermRuler',
    'alternateManuscriptDaySign', 'dayManuscriptAgreement', 'dayManuscriptMoonContact', 'dayManuscriptPeriodStart', 'dayManuscriptPeriodEnd',
    'dayManuscriptEnteredDuringTimedPlace', 'dayManuscriptIngressAt', 'sameAsDailyLord',
    'sameAsNatalMaterialSignRuler', 'natalFortuneLordLuminaryContacts', 'termCoRulerIngress', 'authorTermLevel', 'term', 'primarySign',
    'egyptianTermRuler', 'authorNatalTermRuler', 'natalAuthorTermProfile', 'sameAsNatalAuthorTermRuler', 'termTableAgreement',
    'governsNatalOrigin', 'natalFortuneSaturnJupiterWitness', 'natalFortuneRulerConditions', 'hasNatalFortuneSameSectHarmoniousWitness'],
  'western:ptolemy_lunar_phase_contact': ['profile', 'origin', 'phase', 'moonSign', 'annualSign', 'annualAspect', 'monthSign', 'monthlyAspect',
    'solarSign', 'solarAnnualAspect', 'solarMonthlyAspect', 'natalOriginSign', 'annualRuler', 'monthlyRuler',
    'annualOriginAspect', 'monthlyOriginAspect', 'phaseIngressContacts', 'phaseCarryContacts', 'phaseTransitAspectContacts'],
  'western:lunation_window': ['newMoonAt', 'nextNewMoonAt', 'longitude', 'startsBeforeQuery', 'endsAfterQuery'],
  'western:sepharial_lunation_context': ['profile', 'exactNatalContact', 'exactNatalSupportAspect', 'natalLunationAspect',
    'natalLunationDeviation', 'newMoonAt', 'nextNewMoonAt', 'natalTarget',
    'natalHouse', 'longitude', 'separation', 'startsBeforeQuery', 'endsAfterQuery', 'primaryDirections',
    'sphericalPrimaryProfile', 'sphericalPrimaryDirections', 'solarDirections', 'transits', 'majorTransitPrecedence',
    'stationaryTransits', 'lunarDirections', 'lunarClock',
    'lunarDayInterpolation', 'annualProgressedLunarDirections', 'annualProgressedLunarDirectionProfile',
    'newMoonSignificatorProfile', 'newMoonSignificatorContacts'],
  'western:progression_transit_overlap': ['progressedBody', 'progressedAspectType', 'transitBody', 'transitAspectType', 'natalTargetId', 'overlapOnly'],
};

function projectFact(fact: FortuneFactRecord, date: Intl.DateTimeFormat) {
  const fields = promptFields[fact.method + ':' + fact.factType];
  const payload = fact.normalizedPayload as Record<string, unknown> | null;
  if (!fields || !payload || fact.completeness !== 'complete') return undefined;
  if (fact.method === 'western' && fact.factType === 'aspect_interval'
    && payload.natalTargetType !== 'planet' && payload.natalTargetType !== 'angle') return undefined;
  if (fact.factType === 'lilly_return_context' && payload.radicalPlaceCandidate === false) return undefined;
  if (fact.factType === 'work_timing_context'
    && payload[fact.scope === 'monthly' ? 'monthlyCandidate' : 'dailyCandidate'] !== true) return undefined;
  if (fact.factType === 'daily_branch_context' && payload.hasBranchContact !== true) return undefined;
  if (fact.factType === 'smth_hour_blade' && payload.yearClashesHourBlade !== true
    && payload.yearHourBladeCombinationCandidate !== true && payload.verifiedSingleLayerContact !== 'luck'
    && payload.verifiedSamePillarBladeRepetition !== true) return undefined;
  if (fact.factType === 'calendar_pattern' && payload.firstDegree !== true) return undefined;
  if (['lu_annual_daily_twist', 'lu_rootless_day_case', 'smth_dragon_back_month', 'smth_day_virtue_month',
    'smth_tai_sui_clash_month', 'smth_fire_assembly_month'].includes(fact.factType)
    && payload.matchesPublishedGeometry !== true) return undefined;
  if (fact.factType === 'fateclear_bazi_context' && payload.exampleVerified !== true && payload.profileReadingReady !== true
    && payload.balanceDirectionReady !== true && payload.monthlyLayerOrderVerified !== true
    && payload.monthUsefulYearOther !== true && payload.dayUsefulYearOther !== true
    && (!Array.isArray(payload.clashedColumns) || !payload.clashedColumns.some(column =>
      column === 'day' || (payload.layer === 'day' && column === 'year')))) return undefined;
  const data = Object.fromEntries(fields.flatMap(key => {
    const value = payload[key];
    return (value !== undefined)
      ? [[key, value]] : [];
  }));
  if (!Object.keys(data).length) return undefined;
  return { method: fact.method, type: fact.factType, scope: fact.scope,
    start: fact.activeFrom, endExclusive: fact.activeTo, exactAt: fact.exactInstant,
    localStart: date.format(Date.parse(fact.activeFrom)), data };
}

const reviewedBranchMeanings: Record<string, { excerpt: string | string[]; meaning: string }> = {
  'zpqz-1936-interpretation-p097': {
    excerpt: ['壬运合丁去食', '巳运会酉丑煞强', '庚辰合乙酉助煞'],
    meaning: '徐注的贵造原例按实际大运区分合食与助煞。一般根轻分支另按其适用条件取义。',
  },
  'zpqz-1936-interpretation-p101': {
    excerpt: ['乙卯官乡尚有碍', '庚辛制煞为不吉也', '印劫帮身之地'],
    meaning: '赵员外原例按徐注分别取官碍、制煞有碍及印劫帮身，以命中分支对应的运段为准。',
  },
  'quanshu-interpretation-expansion-p041': {
    excerpt: '若無正星，又值巨忌、羊火',
    meaning: '明刊天使章按实际岁限核众吉缓解及无正曜又见巨门忌、羊火的情形。后者可提示审慎处理纠纷与开支。',
  },
  'ziwei-quanshu-v3-archive-p081': { excerpt: '少者灾多', meaning: '旧限交接时，具名助曜与陷曜、煞曜按实际位置核对。助曜少的分支提示审慎安排。' },
  'zpqz-1936-interpretation-p077': { excerpt: '比劫運亦可行', meaning: '张参政原图按当步财、食伤或比劫各自的原评取义，以命中分支为准。' },
  'zpqz-1936-interpretation-p088': { excerpt: '印輕者亦不利見財', meaning: '原评所列印化煞案例在运财实际克月印时，提示轻印受财所损。' },
  'ziwei-quanshu-v2-archive-pojun-limit-p059': { excerpt: '杀凑陷宫防破耗',
    meaning: '原诀分别核入庙的支持条件和陷宫内同见具名煞星。陷宫一支可参考审慎安排支出和资源。' },
  'ziwei-quanshu-v2-archive-wuqu-limit-p059': { excerpt: '武曲临限化权星', meaning: '武曲入庙与生年化权实守各有条件。化权支可参考承接职责与主动安排，以对应时段为限。' },
  'quanshu-interpretation-expansion-p026': { excerpt: ['天机照限不安宁', '更遇羊陀并巨暗'],
    meaning: '科权禄同守及天机照限分别依实际限段取义。若照限又见羊陀与巨门，原书提示对安排多作审慎考虑。' },
  'quanshu-interpretation-expansion-p034': { excerpt: '文曲限遇廉陀羊，更兼命里星辰弱', meaning: '若命中廉陀羊会限与命宫弱曜一支，按原诀参考谨慎安排。左右、天同的助力依各自命中条件。' },
};

export function buildFortuneModelContext(run: ReturnType<typeof calculateFortuneFacts>, report: FortuneInterpretationReport) {
  const { compatible, agreedTenGods } = eligibleFacts(run, requestForFortuneRun(run));
  const knowledge = matchFortuneKnowledge(run);
  const matched = knowledgeMethods.flatMap(method => knowledge.byMethod[method].filter(item => item.status === 'matched'));
  const partialBazi = knowledge.byMethod.bazi.filter(item => item.status === 'partial');
  const baziWithEvidence = knowledge.byMethod.bazi.filter(item => item.status === 'matched' || item.status === 'partial');
  const priorityIds = new Set(matched.flatMap(item => item.sourceFactIds));
  const westernCandidateIds = new Set(knowledge.byMethod.western.filter(item => item.status === 'partial')
    .flatMap(item => item.sourceFactIds));
  const saturnQuincunxMatched = matched.some(row => row.knowledgeId.includes('-leo-1906-interpretation-p274-'));
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: report.displayWindow.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit' });
  const methods = knowledgeMethods.filter(method => isFortuneMethodEnabled(report.periodType, method));
  const permitted = [...compatible, ...agreedTenGods.map(([representative]) => representative)];
  const facts = methods.flatMap(method => {
    const seen = new Map<string, string>();
    const aliases = new Map<string, string>();
    const projected = permitted.filter(fact => fact.method === method)
      .sort((a, b) => Number(priorityIds.has(b.factId)) - Number(priorityIds.has(a.factId))
        || b.activeFrom.localeCompare(a.activeFrom))
      .flatMap(fact => {
        if (['leo_solar_phase', 'leo_solar_lunar_phase'].includes(fact.factType)
          && !priorityIds.has(fact.factId) && !westernCandidateIds.has(fact.factId)) {
          const data = fact.normalizedPayload as Record<string, unknown>;
          const saturnContext = saturnQuincunxMatched && data.natalTargetId === 'Saturn' && data.aspectType === 'quincunx'
            && (data.hasExactSaturnLunarFamilyContext === true || data.saturnLunarFamilyParallelContact
              || Array.isArray(data.saturnLunarSteadinessContacts) && data.saturnLunarSteadinessContacts.length > 0
              || Array.isArray(data.saturnLunarWeakSteadinessContacts) && data.saturnLunarWeakSteadinessContacts.length > 0);
          const blockedNeptuneMoon = data.hasAdverseNeptuneTrineMoonContact === true
            && (data.neptuneTrineSupportType === 'major' || data.hasExactNeptuneTrineCrossLayerSolarSupport === true
              || Array.isArray(data.neptuneTrineLunarSupportContacts) && data.neptuneTrineLunarSupportContacts.length > 0);
          const blockedNeptuneFinance = data.hasNeptuneTrineVenusMarsOpposition === true
            && data.hasExactNeptuneTrineCrossLayerSolarSupport === true;
          if (!saturnContext && !blockedNeptuneMoon && !blockedNeptuneFinance) return [];
        }
        if (fact.factType === 'leo_mutual_exact_observation' && !priorityIds.has(fact.factId)) {
          const data = fact.normalizedPayload as Record<string, unknown>;
          if (!westernCandidateIds.has(fact.factId)
            || !(data.hasNatalMercuryNeptuneTestimony === true || typeof data.natalVenusNeptuneAfflictionState === 'string')) return [];
        }
        if (fact.factType === 'leo_lunar_exact_observation' && !priorityIds.has(fact.factId)) {
          const data = fact.normalizedPayload as Record<string, unknown>;
          const risingNeptune = data.natalTargetId === 'Neptune' && data.aspectType === 'quincunx'
            && (data.natalTargetHouse === 1 || data.natalNeptuneApproachingAscendant === true);
          const hasNeptuneTestimony = data.hasLunarNeptuneTestimony === true || data.hasLunarNeptuneDevotionalContact === true
            || data.hasNatalSunNeptuneCreativeContact === true;
          if (!westernCandidateIds.has(fact.factId) || !(hasNeptuneTestimony || risingNeptune)) return [];
        }
        const entry = projectFact(fact, date);
        if (!entry) return [];
        if (['zpqz_wealth_context', 'zpqz_stem_order', 'zpqz_seal_food_context', 'zpqz_killer_order_context', 'zpqz_month_command'].includes(entry.type)
          && entry.data.confirmed === true && entry.data.timeKnown === true) {
          const sequence = (fact.normalizedPayload as Record<string, unknown>).natalPillarSequence;
          const pillar = entry.data.luckPillar;
          if (typeof sequence === 'string' && typeof pillar === 'string') {
            const readingIds = new Set(baziWithEvidence.filter(item => item.sourceFactIds.includes(fact.factId)).map(item => item.knowledgeId));
            if (entry.type === 'zpqz_month_command' && entry.data.bladeKillerSourceComparison) {
              readingIds.add('bazi-fortune-v1-year-general-zpqz-1936-interpretation-p010-001');
            }
            const officerComparison = entry.data.luOfficerSourceComparison as { paths?: unknown[] } | undefined;
            if (entry.type === 'zpqz_month_command' && officerComparison?.paths?.length) {
              readingIds.add('bazi-fortune-v1-year-general-zpqz-1936-interpretation-p020-001');
            }
            if (entry.type === 'zpqz_month_command' && (entry.data.zhangOutputCaseEvidence || entry.data.metalWaterOutputCaseEvidence)) {
              readingIds.add('bazi-fortune-v1-year-general-zpqz-1936-interpretation-p106-001');
            }
            const sealLuck = entry.data.sealLuckEvidence as { niuLuck?: unknown } | undefined;
            if (entry.type === 'zpqz_seal_food_context' && sealLuck?.niuLuck) {
              readingIds.add('bazi-fortune-v1-year-general-zpqz-1936-interpretation-p088-001');
            }
            if (entry.type === 'zpqz_wealth_context') {
              const cases = entry.data.printedCases as { id: string; matches: boolean }[] | undefined;
              for (const [id, passage] of [['ge', '065'], ['ge', '066'], ['pingjiang', '072'], ['wu', '073'], ['zhao', '076']]) {
                if (cases?.some(example => example.id === id && example.matches)) {
                  readingIds.add('bazi-fortune-v1-year-general-zpqz-1936-interpretation-p' + passage + '-001');
                }
              }
            }
            if (entry.type === 'zpqz_killer_order_context') {
              const food = entry.data.killerFoodLuck as { nobleFoodLuck?: unknown } | undefined;
              const blade = entry.data.killerBladeLuck as { zhao?: boolean } | undefined;
              const dual = entry.data.hurtDualLuck as { dualCase?: string } | undefined;
              if (food?.nobleFoodLuck) readingIds.add('bazi-fortune-v1-year-general-zpqz-1936-interpretation-p097-001');
              if (blade?.zhao === true) readingIds.add('bazi-fortune-v1-year-general-zpqz-1936-interpretation-p101-001');
              if (dual?.dualCase) readingIds.add('bazi-fortune-v1-year-general-zpqz-1936-interpretation-p102-001');
            }
            const readings = [...readingIds].flatMap(getFortunePrintedLuck).flatMap(row => {
                const period = row.natalPillarSequence === sequence && row.periods.find(value => value.pillars.includes(pillar));
                return period ? [{ name: row.name, premise: row.premise, assessment: period.assessment }] : [];
              });
            if (readings.length) entry.data.printedLuck = readings;
          }
        }
        const key = JSON.stringify(entry);
        const original = seen.get(key);
        if (original) { aliases.set(fact.factId, original); return []; }
        seen.set(key, fact.factId);
        return [{ factId: fact.factId, entry }];
      });
    const representatives = new Set(matched.filter(match => match.method === method).flatMap(match => {
      const fact = projected.find(fact => match.sourceFactIds.includes(fact.factId));
      return fact ? [fact.factId] : [];
    }));
    const baziContextIds = new Set(['zpqz_officer_context', 'zpqz_wealth_context', 'zpqz_killer_order_context', 'zpqz_food_killer_context', 'zpqz_seal_food_context', 'zpqz_month_command', 'luck_transition', 'source_layer_context', 'annual_luck_context', 'annual_column_relations', 'school_context', 'zpqz_luck_context', 'zpqz_moving_relations', 'zpqz_stem_order'].flatMap(type => {
      if (type === 'annual_column_relations') {
        const candidates = projected.filter(fact => fact.entry.type === type);
        // A civil year can contain two solar years and a real luck transition.
        // Preserve a representative of each computed source configuration.
        return candidates.filter((fact, index) => index === candidates.findIndex(other =>
          fact.entry.data.yearPillar === other.entry.data.yearPillar && fact.entry.data.luckPillar === other.entry.data.luckPillar
          && fact.entry.data.luckStatus === other.entry.data.luckStatus)).map(fact => fact.factId);
      }
      const fact = projected.find(fact => fact.entry.type === type);
      return fact ? [fact.factId] : [];
    }));
    const sourceBaziIds = new Set<string>();
    if (method === 'bazi') {
      const mixedOfficerControl = projected.find(({ entry: { type, data } }) => type === 'annual_luck_context'
        && data.confirmed === true && data.luckTenGod === '正官'
        && (data.officerControlEvidence as { mixedExposedControls?: unknown[] } | undefined)?.mixedExposedControls?.length);
      if (mixedOfficerControl) sourceBaziIds.add(mixedOfficerControl.factId);
      const partialIds = new Set(partialBazi.flatMap(item => item.sourceFactIds));
      const verifiedSourceIds = new Set(baziWithEvidence.filter(item => /fate-(month-v1-window-p00[12]|day-v1-mismatch-p001)-/u.test(item.knowledgeId)
        || item.knowledgeId.endsWith('-smth-v5-hurting-p003-002') || item.knowledgeId.endsWith('-smth-v6-built-lu-p002-001')
        || item.knowledgeId.endsWith('-smth-v5-seal-p004-001') || item.knowledgeId.endsWith('-smth-v7-female-natal-p002-001')
        || item.knowledgeId.endsWith('-smth-v5-yang-blade-p002-001'))
        .flatMap(item => item.sourceFactIds));
      const haiStemSource = baziWithEvidence.some(item => /^bazi-fortune-v1-year-general-zpqz-1936-interpretation-p0(?:29|30|31)-001$/.test(item.knowledgeId));
      const killerSealSource = partialBazi.some(item => item.knowledgeId === 'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p023-001');
      const rootDirectionSource = knowledge.byMethod.bazi.some(item =>
        item.knowledgeId === 'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p002-001'
        && (item.status === 'matched' || item.status === 'partial'));
      const namedExposureSource = partialBazi.some(item => item.knowledgeId === 'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p054-001');
      const annualJointClashIds = partialBazi.find(item => item.knowledgeId
        === 'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p038-001')?.sourceFactIds ?? [];
      for (const id of annualJointClashIds) sourceBaziIds.add(id);
      const kangClash = projected.find(({ entry }) => entry.type === 'zpqz_moving_relations'
        && entry.data.confirmed === true && entry.data.kangDoubleClash);
      if (kangClash) sourceBaziIds.add(kangClash.factId);
      const shenArrival = projected.find(({ entry, factId }) => entry.type === 'zpqz_moving_relations' && entry.data.dingChenShenArrivalWithAnnualZiClash === true
        && priorityIds.has(factId));
      if (shenArrival) sourceBaziIds.add(shenArrival.factId);
      for (const unsupported of [true, false]) {
        const rooted = projected.find(({ entry }) => entry.type === 'zpqz_moving_relations'
          && entry.data.confirmed === true && entry.data.shenRootOpposition && entry.data.dingChenRootClashUnsupported === unsupported);
        if (rooted) sourceBaziIds.add(rooted.factId);
      }
      if (baziWithEvidence.some(item => item.knowledgeId === 'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p040-001')) {
        const comparison = projected.find(({ entry }) => entry.type === 'zpqz_moving_relations' && entry.data.confirmed === true
          && entry.data.luckBranch !== '寅' && entry.data.shenYinClashComparison);
        if (comparison) sourceBaziIds.add(comparison.factId);
      }
      for (const field of ['natalRivalComplete', 'annualCompletesRival', 'annualPartnerClashes'] as const) {
        const witness = projected.find(({ entry }) => {
          if (entry.type !== 'zpqz_moving_relations' || entry.data.confirmed !== true) return false;
          const example = entry.data.youExample as { liuheRoutes?: Partial<Record<typeof field, boolean | unknown[]>>[] } | undefined;
          return Array.isArray(example?.liuheRoutes) && example.liuheRoutes.some(route => {
            const value = route[field];
            return value === true || Array.isArray(value) && value.length > 0;
          });
        });
        if (witness) sourceBaziIds.add(witness.factId);
      }
      const wealthSealIds = new Set(partialBazi.filter(item => /^bazi-fortune-v1-year-general-zpqz-1936-interpretation-p07[01]-001$/.test(item.knowledgeId))
        .flatMap(item => item.sourceFactIds));
      const killerOrderStageIds = new Set(partialBazi.filter(item => /^bazi-fortune-v1-year-general-zpqz-1936-interpretation-p(?:09[7-9]|10[0-25])-001$/.test(item.knowledgeId))
        .flatMap(item => item.sourceFactIds));
      const stageEvidence = new Map([
        ['zpqz_month_command', new Set(baziWithEvidence.filter(item => ['009', '010', '011', '017', '019', '020', '025', '026', '027', '028', '103', '104', '106'].some(passage => item.knowledgeId
          === 'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p' + passage + '-001')).flatMap(item => item.sourceFactIds))],
        ['zpqz_luck_context', new Set(partialBazi.filter(item => ['043', '044', '054'].some(passage => item.knowledgeId
          === 'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p' + passage + '-001')).flatMap(item => item.sourceFactIds))],
        ['zpqz_stem_order', new Set([...wealthSealIds, ...baziWithEvidence.filter(item => ['014', '021', '029', '030', '031', '045', '063', '064'].some(passage => item.knowledgeId
          === 'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p' + passage + '-001')).flatMap(item => item.sourceFactIds)])],
        ['zpqz_moving_relations', new Set(partialBazi.filter(item => ['002', '024', '032', '033', '034', '035', '036', '037', '039', '040', '041', '042', '046', '047', '049', '050', '051', '052', '053']
          .some(passage => item.knowledgeId === 'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p' + passage + '-001'))
          .flatMap(item => item.sourceFactIds))],
        ['zpqz_officer_context', new Set(baziWithEvidence.filter(item => ['012', '022', '056', '057', '058', '059', '060', '061', '062'].some(passage => item.knowledgeId
          === 'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p' + passage + '-001')).flatMap(item => item.sourceFactIds))],
        ['zpqz_wealth_context', new Set(baziWithEvidence.filter(item => ['065', '066', '067', '068', '069', '072', '073', '074', '075', '076']
          .some(passage => item.knowledgeId === 'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p' + passage + '-001'))
          .flatMap(item => item.sourceFactIds))],
        ['zpqz_killer_order_context', killerOrderStageIds],
        ['zpqz_seal_food_context', new Set(baziWithEvidence.filter(item => ['001', '003', '004', '005', '006', '007', '008', '013', '015', '016', '018', '023', '077', '078', '079', '080', '081', '082', '083', '084', '085', '086', '087', '088']
          .some(passage => item.knowledgeId === 'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p' + passage + '-001'))
          .flatMap(item => item.sourceFactIds))],
        ['zpqz_food_killer_context', new Set(baziWithEvidence.filter(item => ['089', '090', '091', '092', '093', '094', '095', '096']
          .some(passage => item.knowledgeId === 'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p' + passage + '-001'))
          .flatMap(item => item.sourceFactIds))],
      ]);
      const selectedStages = new Set<string>();
      for (const fact of projected) {
        const { data, type } = fact.entry;
        const haiComparison = haiStemSource && type === 'zpqz_stem_order' && data.confirmed === true && data.haiStemComparison;
        const supportingLuck = killerSealSource && type === 'zpqz_seal_food_context' && data.confirmed === true
          && Array.isArray(data.killerSealSupport) && data.killerSealSupport.length > 0;
        const directionComparison = rootDirectionSource && type === 'zpqz_moving_relations' && data.confirmed === true && data.directionRootContext;
        const gaoComparison = type === 'zpqz_month_command' && data.confirmed === true && data.gaoContext;
        const officerComparison = data.luOfficerSourceComparison as { paths?: unknown[] } | undefined;
        const youOfficer = data.youOfficerContext as { liSourceXinExposureComparison?: unknown } | undefined;
        const monthSourceComparison = type === 'zpqz_month_command' && data.confirmed === true
          && (data.bladeKillerSourceComparison || data.bladeKillerJiaComparison || data.bladeWealthSourceComparison
            || data.bladeWealthBridgeSourceComparison || officerComparison?.paths?.length || youOfficer?.liSourceXinExposureComparison
            || (data.bladeAuthorityWealthOnlyJoinedKiller === true || data.bladeOutputOnlyJoinedKiller === true) && data.bladeKillerJoin
            || data.bladePrintedSupport || data.bladeFoodReliefComparison || data.bladeSupportStrongSource || data.bladeKillerMuOfficerComparison
            || data.bladeClearingSourceComparison || data.bladeYueSourceComparison || data.bladeQianlongSourceComparison
            || data.bladeWealthMatched === false && Array.isArray(data.bladeWealthPaths) && data.bladeWealthPaths.length > 0
            || (data.zhangOutputCaseEvidence || data.metalWaterOutputCaseEvidence) && data.printedLuck);
        const exposureComparison = namedExposureSource && type === 'zpqz_luck_context' && data.confirmed === true
          && (data.kangExposureContext || data.yaoExposureContext);
        const sealLuck = data.sealLuckEvidence as { wealthySonSealComparison?: unknown; liLuck?: unknown; maLuck?: unknown;
          niuLuck?: unknown; lightSealWealthContrast?: unknown[] } | undefined;
        const sealRemedies = data.foodKillerRemedyPaths as { secondarySeals?: unknown[] }[] | undefined;
        const sealDiagramComparison = type === 'zpqz_seal_food_context' && data.confirmed === true
          && (data.linhuaiGuardComparison || data.jiaChenAuthorityComparison || data.coldBingSealComparison
            || data.zhouSourceRobberyDispute || data.zhouSourceWealthOutput || data.xiaSourceWealthAuthority || data.qianSourceWealthSealPressure
            || data.sunSourceSealReview
            || data.autumnWoodSourceNotWeak === true
            || data.maSourceStrongDayLightSeal === true || data.maoSourceAuthorityToExposedSeal === true
            || data.namedHurtingOfficerPeerEvidence || data.sourceHurtWealthSeal || data.liuSourceWealthSeparation
            || Array.isArray(sealRemedies) && sealRemedies.some(path => path?.secondarySeals?.length)
            || sealLuck?.wealthySonSealComparison || sealLuck?.liLuck || sealLuck?.maLuck || sealLuck?.lightSealWealthContrast?.length
            || sealLuck?.niuLuck && data.printedLuck);
        const wealthLuck = data.monthWealthLuck as { yangFoodSourceInterference?: unknown; geStrongBodyWealth?: unknown;
          convertedWealthOfficer?: unknown; wuChaoshuNatalSupport?: unknown } | undefined;
        const wealthDiagramComparison = type === 'zpqz_wealth_context' && data.confirmed === true
          && (data.printedLuck || wealthLuck?.yangFoodSourceInterference || wealthLuck?.geStrongBodyWealth
            || wealthLuck?.convertedWealthOfficer || wealthLuck?.wuChaoshuNatalSupport);
        const officerDiagramComparison = type === 'zpqz_officer_context' && data.confirmed === true
          && (data.zaqiInactiveWealthSeal || data.xuanSealComparison || data.fanWealthConversion
            || data.onlyHiddenMonthOfficerDirectLuckClash || data.fanSourceYouOutputChallengesOfficer || data.liSourceOfficerSealReview);
        const stemOrder = data.wealthSealLuck as { zengGengChen?: unknown[] } | undefined;
        const separatedWealthSeal = type === 'zpqz_stem_order' && data.confirmed === true
          && (data.hasSeparatedWealthSealLuck === true || stemOrder?.zengGengChen?.length || data.guiNorthernWaterAssembly);
        const foodClimate = data.foodClimateEvidence as { winterWealthFeedsFire?: unknown[]; winterFireLuck?: unknown[];
          foodSealSourceComparison?: unknown; summerFireSource?: unknown } | undefined;
        const foodLuck = data.foodLuckPaths as { rootlessBingShenSource?: unknown; liangContrast?: unknown; liangSourceRenCounterfactual?: unknown } | undefined;
        const foodDiagramComparison = type === 'zpqz_food_killer_context' && data.confirmed === true
          && (foodClimate?.winterWealthFeedsFire?.length || foodClimate?.winterFireLuck?.length
            || foodClimate?.foodSealSourceComparison || foodClimate?.summerFireSource || foodLuck?.rootlessBingShenSource
            || foodLuck?.liangContrast || foodLuck?.liangSourceRenCounterfactual);
        const officerLuck = data.hurtOfficerLuck as { zhengLuck?: unknown } | undefined;
        const clearingLuck = data.killerClearingLuck as { shenSourceBodySupport?: unknown; yueGuiChouRegulatorRoot?: unknown } | undefined;
        const killerFoodLuck = data.killerFoodLuck as { nobleFoodLuck?: unknown } | undefined;
        const killerBladeLuck = data.killerBladeLuck as { zhao?: boolean } | undefined;
        const hurtDualLuck = data.hurtDualLuck as { dualCase?: string } | undefined;
        const killerOrderDiagramComparison = type === 'zpqz_killer_order_context' && data.confirmed === true
          && (officerLuck?.zhengLuck || clearingLuck?.shenSourceBodySupport || clearingLuck?.yueGuiChouRegulatorRoot || killerFoodLuck?.nobleFoodLuck
            || killerBladeLuck?.zhao === true || hurtDualLuck?.dualCase);
        if ((!haiComparison && !supportingLuck && !directionComparison && !gaoComparison && !exposureComparison
          && !monthSourceComparison && !sealDiagramComparison && !wealthDiagramComparison && !officerDiagramComparison
          && !separatedWealthSeal && !foodDiagramComparison && !killerOrderDiagramComparison
          && !stageEvidence.get(type)?.has(fact.factId)) || typeof data.stageStart !== 'string') continue;
        if (type === 'zpqz_luck_context' && !exposureComparison && !data.renHaiOfficerContext && ![data.sourceTwoBranchMeetings, data.sourceNewExposures]
          .some(value => Array.isArray(value) && value.length)) continue;
        const stage = type + ':' + data.stageStart;
        const exactStageBoundary = (type === 'zpqz_month_command' || wealthSealIds.has(fact.factId) || sealDiagramComparison || wealthDiagramComparison
          || officerDiagramComparison || separatedWealthSeal
          || foodDiagramComparison || killerOrderDiagramComparison || killerOrderStageIds.has(fact.factId))
          && (fact.entry.start === data.stageStart || fact.entry.endExclusive === data.stageEnd);
        if (selectedStages.has(stage) && !exactStageBoundary) continue;
        selectedStages.add(stage);
        if (!baziContextIds.has(fact.factId)) sourceBaziIds.add(fact.factId);
      }
      for (const fact of projected) if (fact.entry.data.confirmed === true
        && Array.isArray(fact.entry.data.printedLuck) && fact.entry.data.printedLuck.length
        && (priorityIds.has(fact.factId) || partialIds.has(fact.factId)) && !baziContextIds.has(fact.factId)) {
        sourceBaziIds.add(fact.factId);
      }
      const hourBladeCandidates = new Set(knowledge.byMethod.bazi
        .find(item => item.knowledgeId.endsWith('smth-v5-yang-blade-p002-001'))?.candidateFactIds);
      for (const fact of projected) if (['smth_seal_hurting_context', 'smth_officer_mix_context', 'fateclear_bazi_context', 'minor_luck_context', 'school_exam_context', 'school_entry_context',
        'daily_branch_context', 'lu_annual_daily_twist', 'lu_rootless_day_case', 'smth_dragon_back_month',
        'smth_day_virtue_month', 'smth_tai_sui_clash_month', 'smth_fire_assembly_month', 'smth_hour_blade'].includes(fact.entry.type)
        && (partialIds.has(fact.factId) || verifiedSourceIds.has(fact.factId) || hourBladeCandidates.has(fact.factId)
          || fact.entry.type === 'smth_seal_hurting_context'
            && [fact.entry.data.hurtOfficerSourceExceptions, fact.entry.data.sealSourceSiDutyEarthWealthPaths,
              fact.entry.data.hurtOfficerNamedHiddenMonthCases].some(evidence => Array.isArray(evidence) && evidence.length > 0))) {
        sourceBaziIds.add(fact.factId);
      }
      for (const item of partialBazi) if (item.knowledgeId === 'bazi-fortune-v1-year-general-smth-v2-volume-p241-001'
        || item.knowledgeId === 'bazi-fortune-v1-year-wealth-smth-v2-volume-p267-004'
        || item.knowledgeId === 'bazi-fortune-v1-year-career-smth-v2-volume-p271-001'
        || item.knowledgeId === 'bazi-fortune-v1-year-wealth-smth-v2-volume-p271-002'
        || item.knowledgeId === 'bazi-fortune-v1-year-general-smth-v2-volume-p267-001'
        || item.knowledgeId === 'bazi-fortune-v1-year-general-smth-v2-volume-p267-003') {
        for (const id of item.sourceFactIds) sourceBaziIds.add(id);
      }
      const appliedRootReview = baziWithEvidence.find(item => item.knowledgeId === 'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p055-001');
      for (const id of appliedRootReview?.sourceFactIds ?? []) sourceBaziIds.add(id);
      const dayVirtue = baziWithEvidence.find(item => item.status === 'matched'
        && item.knowledgeId === 'bazi-fortune-v1-month-general-smth-v6-day-virtue-p002-001');
      if (dayVirtue) {
        const windows = [...dayVirtue.windows, ...(dayVirtue.candidateWindows ?? [])];
        for (const { factId, entry } of projected) if (entry.type === 'smth_day_virtue_month'
          && windows.some(window => entry.start < window.endExclusive && window.start < entry.endExclusive)) {
          sourceBaziIds.add(factId);
        }
      }
    }
    for (const candidate of ['monthHarmonyCandidate', 'examSupportCandidate', 'nayinSealVoidBoth']) {
      const fact = projected.find(fact => fact.entry.type === 'school_exam_context' && fact.entry.data[candidate] === true);
      if (fact) sourceBaziIds.add(fact.factId);
    }
    for (const kind of ['nayinSealNamedPunishment', 'nayinSealSameElementPunishment']) {
      const punishment = projected.find(fact => fact.entry.type === 'school_exam_context' && fact.entry.data[kind]);
      if (punishment) baziContextIds.add(punishment.factId);
    }
    const excludedSchoolEntries = new Set(knowledge.byMethod.bazi.filter(item => item.status === 'excluded'
      && item.knowledgeId.endsWith('-smth-v3-school-p008-001')).flatMap(item => item.sourceFactIds));
    for (const { factId, entry } of projected) {
      if (entry.type === 'school_entry_context' && (excludedSchoolEntries.has(factId)
        || ((entry.data.sourceLuckPhase === '沐浴' || entry.data.sourceLuckPhase === '死') && entry.data.dayLongevityAbsent === true
          && [entry.data.civilYears, entry.data.liChunOrdinal, entry.data.lunarOrdinal].some(age => age === 5 || age === 7)))) {
        sourceBaziIds.add(factId);
      }
    }
    for (const fact of projected) if (fact.entry.type === 'work_timing_context') baziContextIds.add(fact.factId);
    for (const variant of ['zuixing-hour-year-direction', 'fixed-bingyin-renshen', 'female-bingshen-opening-reading']) {
      const fact = projected.find(f => f.entry.type === 'minor_luck_context' && f.entry.data.variant === variant);
      if (fact) baziContextIds.add(fact.factId);
    }
    const yanNoblePair = projected.find(({ entry }) => entry.type === 'minor_luck_context'
      && Array.isArray(entry.data.yanNobleCombinationReview)
      && entry.data.yanNobleCombinationReview.some(row => row?.seats?.length === 2));
    if (yanNoblePair) baziContextIds.add(yanNoblePair.factId);
    const qualifiedAscendantMatches = knowledge.byMethod.western.filter(match => ['partial', 'matched'].includes(match.status)
      && /-leo-1906-interpretation-p(001|002|003|006|010|011|012|017|018|022|023|024|026|027|030)-/u.test(match.knowledgeId));
    const qualifiedAscendantIds = new Set(qualifiedAscendantMatches.flatMap(match => match.sourceFactIds));
    const ascendants = projected.filter(fact => fact.entry.type === 'leo_ascendant_context');
    const ascendant = ascendants.find(fact => qualifiedAscendantIds.has(fact.factId) && fact.entry.data.piscesNatalCondition === 'candidate')
      ?? ascendants.find(fact => qualifiedAscendantIds.has(fact.factId)) ?? ascendants[0];
    const hasDirectionState = (data: Record<string, unknown>, ...states: string[]) =>
      [data.natalDirectionState, data.progressedDirectionState].some(state => states.includes(String(state)));
    const ascendantDirections: Record<string, (data: Record<string, unknown>) => boolean> = {
      p001: data => ['favourable', 'adverse', 'mixed'].includes(String(data.natalMercuryUranusDirectionState)),
      p002: data => [data.natalFavourableDirectionTargets, data.progressedFavourableDirectionTargets]
        .some(targets => Array.isArray(targets) && targets.includes('Mercury')),
      p003: data => hasDirectionState(data, 'favourable', 'mixed'),
      p006: data => hasDirectionState(data, 'adverse'),
      p010: data => Array.isArray(data.natalHousesWithClassifiedDirections) && data.natalHousesWithClassifiedDirections.includes(10),
      p011: data => Array.isArray(data.natalHousesWithFavourableDirections) && data.natalHousesWithFavourableDirections.includes(2),
      p012: data => hasDirectionState(data, 'favourable', 'adverse', 'mixed'),
      p017: data => Array.isArray(data.natalHousesWithFavourableDirections) && data.natalHousesWithFavourableDirections.includes(5),
      p023: data => hasDirectionState(data, 'adverse'),
      p024: data => hasDirectionState(data, 'favourable'),
      p027: data => hasDirectionState(data, 'favourable'),
      p030: data => hasDirectionState(data, 'adverse'),
    };
    const ascendantDirectionRepresentatives = qualifiedAscendantMatches
      .map(match => {
        const passage = match.knowledgeId.split('-').at(-2) ?? '';
        const select = ascendantDirections[passage];
        if (!select && passage !== 'p018') return undefined;
        const choices = ascendants.filter(fact => match.sourceFactIds.includes(fact.factId));
        return (select && choices.find(fact => select(fact.entry.data))) ?? choices[0];
      });
    const houseRepresentatives = [...new Set([
      ascendant, ...ascendantDirectionRepresentatives, projected.find(fact => fact.entry.type === 'progressed_ascendant'),
      projected.find(fact => fact.entry.type === 'progressed_house'),
    ].filter(fact => fact !== undefined))];
    for (const frame of ['natal', 'progressed']) {
      const candidates = projected.filter(fact => fact.entry.type === 'leo_lunar_house_context' && fact.entry.data.targetKind === frame);
      const representative = frame === 'progressed'
        ? candidates.find(fact => [1, 3].includes(Number(fact.entry.data.house))) ?? candidates[0] : candidates[0];
      if (representative) houseRepresentatives.push(representative);
    }
    const progressionIds = new Set([...houseRepresentatives, ...projected.filter(fact => fact.entry.scope === 'progressed'
      && !houseRepresentatives.some(representative => representative.factId === fact.factId))
      .sort((a, b) => (2 * Number(b.entry.type.startsWith('leo_progressed_aspect')) + Number(b.entry.type.startsWith('progressed_aspect')))
        - (2 * Number(a.entry.type.startsWith('leo_progressed_aspect')) + Number(a.entry.type.startsWith('progressed_aspect'))))
      ].slice(0, 8).map(fact => fact.factId));
    const sourceIds = new Set(projected.filter(fact => fact.entry.type.startsWith('ling_'))
      .sort((a, b) => Number(b.entry.scope === 'daily') - Number(a.entry.scope === 'daily')
        || Number(b.entry.type === 'ling_transformation_contact') - Number(a.entry.type === 'ling_transformation_contact')
        || Number(b.entry.data.inLifeArea === true) - Number(a.entry.data.inLifeArea === true)
        || Number(b.entry.data.sourceScope === b.entry.scope) - Number(a.entry.data.sourceScope === a.entry.scope))
      .slice(0, 6).map(fact => fact.factId));
    for (const fact of projected) if (fact.entry.type === 'ling_time_segment' && fact.entry.data.monthJie) sourceIds.add(fact.factId);
    for (const fact of projected) if (fact.entry.type === 'ling_palace_condition'
      && (fact.entry.data.taiyinWenchangInLifeArea === true || Array.isArray(fact.entry.data.yearLifeAreaLiteraryTransforms)
        || fact.entry.data.dailyLearningVoidPairAtLife === true || fact.entry.data.dailyStudySupportedCandidate === true
        || fact.entry.data.dailyPeachLuCandidate === true)) {
      sourceIds.add(fact.factId);
    }
    const quanshuIds = new Set(['quanshu_yang_taboo_context', 'quanshu_tiger_layer_context', 'quanshu_horse_void_context', 'quanshu_body_limit_context', 'quanshu_annual_context', 'quanshu_limit_phase', 'quanshu_palace_condition', 'quanshu_tianxing_condition', 'quanshu_kongjie_condition', 'quanshu_support_condition', 'quanshu_doujun_context', 'quanshu_kuxu_condition', 'quanshu_shangshi_condition', 'quanshu_firebell_context'].flatMap(type => {
      const fact = projected.find(fact => fact.entry.type === type && (type !== 'quanshu_palace_condition' || fact.entry.data.flowName === '命宫'));
      return fact ? [fact.factId] : [];
    }));
    for (const fact of projected) if (fact.entry.type === 'quanshu_doujun_month'
      && ['财帛', '官禄'].includes(String(fact.entry.data.natalName))) quanshuIds.add(fact.factId);
    for (const fact of projected) if (fact.entry.type === 'quanshu_killer_echo'
      && (fact.entry.data.jielanJiaGuiKillerEchoCandidate === true || fact.entry.data.actualLimitEchoCandidate === true
        || (fact.entry.data.jointAnnualContact === true
        && ['守', '三合'].includes(String(fact.entry.data.killerLifeRelation))))) quanshuIds.add(fact.factId);
    const yearlyDoujun = projected.filter(f => f.entry.type === 'quanshu_doujun_context' && Array.isArray(f.entry.data.monthTimeline));
    for (const fact of yearlyDoujun) quanshuIds.add(fact.factId);
    const limitChapterIds = new Set<string>();
    const starTimingIds = new Set(knowledge.byMethod.ziwei.filter(row => ['partial', 'matched'].includes(row.status)
      && /-(?:interpretation-expansion-p0(?:01|33)|archive-pojun-limit-p059)-/u.test(row.knowledgeId))
      .flatMap(row => row.sourceFactIds));
    for (const fact of projected) if (fact.entry.type === 'quanshu_limit_star_timing' && starTimingIds.has(fact.factId)) {
      limitChapterIds.add(fact.factId);
    }
    const timedLimitIds = new Set(knowledge.byMethod.ziwei.filter(row => ['partial', 'matched'].includes(row.status))
      .flatMap(row => row.sourceFactIds));
    const bellSupport = projected.find(({ entry }) => entry.type === 'quanshu_timed_limit_condition'
      && Array.isArray(entry.data.bellPositiveSupportWitnesses) && entry.data.bellPositiveSupportWitnesses.length > 0);
    if (bellSupport) limitChapterIds.add(bellSupport.factId);
    const shownTimedStars = new Set<unknown>();
    for (const fact of projected) {
      if (fact.entry.type !== 'quanshu_timed_limit_condition' || !timedLimitIds.has(fact.factId)) continue;
      if (['qishaJielanMinorFlowShaCandidate', 'tianliangJielanFireBellOpposedTrineCandidate', 'tianliangPlainGuardCandidate', 'wenquJielanYinFallenCandidate',
        'lianzhenNatalSelfJiAnnualBladeCandidate', 'wenquChapterFallenWeakLifeCandidate', 'qishaImperialLuBodyLifeConflictCandidate',
        'tanlangMingNatalYangJiAspectCandidate', 'tanlangMingNatalYangTuoJiCandidate', 'tanlangMingXingJiAliasesCandidate',
        'wenquPlainGuardCandidate', 'poFallenMingBladeFireBellCandidate',
        'poTempleMingNamedShaClearCandidate', 'poTempleMingJoinedSupportCandidate',
        'wuTempleMingChangFuBiOpposedDoubleGuardCandidate', 'poTempleMingChangTwoNoblesDistinctTrineDoubleGuardCandidate',
        'tianjiNatalSanHuaCandidate', 'tianjiNatalLucunKeQuanCandidate', 'tianjiShaAspectCandidate', 'tianjiPlainOppositionCandidate',
        'tianjiDualTrineLimitCandidate', 'wenquJielanChangQuGuardCandidate', 'wenquJielanChangQuSplitActiveCandidate',
        'wenquBrightMingDoubleGuardCandidate', 'wuNatalQuanMingChangQuAtActiveLimitCandidate']
        .some(key => fact.entry.data[key] === true)) limitChapterIds.add(fact.factId);
      const { star } = fact.entry.data;
      if (shownTimedStars.has(star)) continue;
      shownTimedStars.add(star);
      limitChapterIds.add(fact.factId);
    }
    for (const fact of projected) if (fact.entry.type === 'quanshu_year_and_limits'
      && ['reviewedLimitContact', 'annualFlowOppositionCandidate', 'threeLayerTrineCandidate', 'annualAtLife',
        'annualDoubleVerifiedOppositionCandidate', 'threeLayerFallenShangShiCandidate']
        .some(key => fact.entry.data[key] === true)) limitChapterIds.add(fact.factId);
    for (const positive of ['cleanSeatCandidate', 'cleanSeatMingFixedCandidate', 'cleanSeatMingFourHelpersCandidate', 'cleanSeatMingLucunHuaLuCandidate', 'overlappingMingFixedShaCandidate',
      'overlappingShaCandidate', 'overlappingAnnualSeatShaCandidate',
      'overlappingAnnualShangShiCandidate', 'overlappingAnnualFlyingShaCandidate', 'overlappingAnnualBoshiCandidate',
      'overlappingMingAnnualBladeAtDecadalCandidate', 'overlappingMingAnnualBellCandidate', 'overlappingMingAnnualNatalShaGuardCandidate',
      'exitVerifiedMingFourHelpersAtBoundary', 'exitInWindow', 'exitVerifiedNamedSupportAtBoundary', 'exitVerifiedFewNamedSupportsAtBoundary', 'exitFallenWithoutNamedGuardCandidate', 'dailyShaCandidate', 'dailyFlankedShaCandidate', 'dailyGuardedTabooCandidate', 'mingOpeningShaCandidate', 'mingOpeningMinorNatalShaCandidate',
      'jielanDailyShaCandidate', 'jielanDailyFireBellCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_limit_chapter' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    const jielanLateZi = projected.find(({ entry }) => entry.type === 'quanshu_limit_chapter'
      && [entry.data.jielanDailyShaWitness, entry.data.jielanDailyFireBellWitness].some(witness =>
        (witness as { lateZiAlternative?: unknown } | undefined)?.lateZiAlternative));
    if (jielanLateZi) limitChapterIds.add(jielanLateZi.factId);
    const jielanHour = projected.find(({ entry }) => entry.type === 'quanshu_limit_chapter' && entry.data.jielanHourWitness);
    if (jielanHour) limitChapterIds.add(jielanHour.factId);
    const invalidDecadalLimit = projected.find(fact => fact.entry.type === 'quanshu_limit_chapter'
      && (fact.entry.data.sourceDecadal as { verified?: boolean } | undefined)?.verified === false);
    if (invalidDecadalLimit) limitChapterIds.add(invalidDecadalLimit.factId);
    for (const positive of ['minorNatalLuGuard', 'minorLuCandidate', 'decadalNatalQuanSha', 'decadalNatalQuanAspectSha',
      'decadalNatalQuanPojunHaoCandidate', 'decadalNatalQuanTianShangHaoCandidate',
      'decadalNatalQuanNamedAssemblyCandidate', 'decadalNatalQuanShangShiAssemblyCandidate', 'tripleNatalJiGuard',
      'tripleNatalJiVerifiedGuard', 'femaleLuQuanshuFixedFireTabooCandidate', 'femaleNatalLuCunCoGuardCandidate',
      'decadalQuanShaCandidate', 'decadalQuanAspectShaCandidate', 'tripleTabooCandidate',
      'femaleLuSupportCandidate', 'femaleLuShaCandidate', 'femaleLuJielanFireTabooCandidate', 'tianjiSanHuaCandidate',
      'tianjiNatalSanHuaCandidate', 'tianjiNatalLucunKeQuanCandidate', 'tianjiYearLucunKeQuanCandidate', 'tianjiShaAspectCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_transform_limits' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    for (const fact of projected) if (fact.entry.type === 'quanshu_transform_limits'
      && ['natalQuanLuJiShaAtLimit', 'sameSourceQuanLuJiShaCandidate', 'natalQuanLuJiMingYangBellAspectAtLimit',
        'volumeTwoTabooReliefAtLimitCandidate', 'volumeTwoTabooFallenAtLimitCandidate',
        'volumeTwoTabooTempleAtLimitCandidate', 'lianzhenHaiWaterYearAtLimitCandidate',
        'sunNatalJiReliefGuard', 'moonNatalJiReliefGuard', 'volumeTwoNamedBirthStemJiReliefCandidate']
        .some(key => fact.entry.data[key] === true)) limitChapterIds.add(fact.factId);
    const hourVoidExclusion = projected.find(({ entry }) => entry.type === 'quanshu_transform_limits'
      && Array.isArray(entry.data.seats) && entry.data.seats.some(seat => seat.mixedTabooContext?.bothSourceHourVoidsOutside === true
        && (seat.layer === 'decadal' && (entry.data.sourceDecadal as { verified?: boolean } | undefined)?.verified === true
          || seat.layer === 'minor' && (entry.data.sourceMinor as { verified?: boolean } | undefined)?.verified === true)));
    if (hourVoidExclusion) limitChapterIds.add(hourVoidExclusion.factId);
    for (const positive of ['yangTuoCandidate', 'tuoHelperPairCandidate', 'yangQuanShaCandidate', 'tanHaoAnnualCandidate', 'mingFixedBladeFireBellCandidate',
      'mingXingQiuShaCandidate', 'fourMajorsCandidate', 'splitMajorPairCandidate',
      'mingBladeDarkDoubleGuardCandidate', 'mingTuoTanlangDoubleGuardCandidate', 'fallenJumenDoubleGuardCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_limit_combinations' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    for (const positive of ['migrationFireCandidate', 'migrationFireShaRepeatCandidate', 'migrationSharedFireShaRepeat',
      'migrationSharedMingEarthShaRepeat', 'yearlyShaCandidate',
      'jielanBellTigerCandidate', 'tigerAtPojunLimitCandidate', 'quanshuFixedBellTigerCandidate', 'fixedBellTigerZiweiGuard',
      'pojunJielanMinorFlowShaCandidate', 'pojunWangNativeHuaLuSupport', 'pojunYearlyHuaLuContact']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_annual_sha' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    for (const positive of ['changThreeLayersCandidate', 'changAdverseCandidate', 'changTrineShaJiCandidate', 'keChangCandidate', 'keChangAspectCandidate',
      'changVerifiedTripleGuard', 'keChangVerifiedDoubleGuard', 'keChangVerifiedOpposedLimit', 'keChangVerifiedTrineLimit',
      'keChangMingGengDoubleGuard', 'keChangMingGengOpposedLimit', 'keChangMingGengTrineLimit',
      'changQuanshuFixedAdverseCandidate', 'changQuanshuFixedTrineShaJiCandidate',
      'keChangSharedAspectCandidate', 'keChangSplitAspectCandidate', 'keChangMingGengSharedLimitAspect',
      'movingChangQuCandidate', 'movingChangQuAssistantCandidate',
      'movingChangQuNamedTrinesCandidate', 'movingChangQuNatalTransformCandidate', 'movingChangQuSourceSeatsCandidate',
      'movingChangQuLifeAndCommonMinorTrinesCandidate', 'movingChangQuBothLimitsTrineCandidate', 'movingChangQuMixedNamedTrinesCandidate',
      'horseChangCandidate', 'horseChangSplitCandidate', 'lumingHorseChangCandidate', 'lumingHorseChangSplitCandidate',
      'horseChangDoubleGuardAgreementCandidate', 'horseChangJielanDoubleGuardCandidate', 'horseChangZiFuOpposedDoubleGuardCandidate',
      'horseChangLumingDoubleGuardCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_literary_limits' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    for (const positive of ['annualDoubleVerifiedOppositionCandidate', 'annualReliefCandidate', 'annualCrossGroupReliefCandidate',
      'annualAdverseCandidate', 'annualSeatedReliefCandidate', 'annualSeatedAdverseCandidate',
      'chenXuChangQuCandidate', 'chenXuBothLimitsCandidate', 'chenXuSplitChangQuCandidate', 'chenXuTempleCandidate', 'chenXuTempleAspectCandidate',
      'mingChenXuNatalChangQuLifeCandidate', 'threeVolumeJiChenXuNatalChangQuLifeCandidate',
      'templeChangQuBothLimitsCandidate', 'templeChangQuSplitDoubleGuardCandidate',
      'qishaTianfuAtLimitCandidate', 'qishaTianfuBothLimitsCandidate', 'qishaAdverseAtLimitCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_limit_branches' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    for (const fact of projected) if (fact.entry.type === 'quanshu_limit_branches'
      && [fact.entry.data.annualOpposedGuardCandidate, fact.entry.data.annualTrineAdverseCandidate,
        fact.entry.data.annualOpposedQishaCandidate, fact.entry.data.annualOpposedDecadalVerifiedFullReliefCandidate,
        fact.entry.data.annualMingFixedOppositionShaCandidate].includes(true)) limitChapterIds.add(fact.factId);
    for (const positive of ['tianshangReliefCandidate', 'tianshangAdverseCandidate', 'tianshiReliefCandidate', 'tianshiAdverseCandidate',
      'tianshangCrossGroupReliefCandidate', 'tianshangAnnualFirePairCandidate', 'tianshiCrossGroupReliefCandidate', 'tianshiAnnualFirePairCandidate',
      'tianshangJielanFireCandidate', 'tianshiJielanFireCandidate', 'tianshiXuDiagramCandidate', 'tianshangQuanshuFixedFireCandidate',
      'tianshiQuanshuFixedFireCandidate', 'tianshangMingNatalFireYangDoubleGuardCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_shangshi_limits' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    for (const positive of ['sharedPalace', 'splitLimits', 'voidAspectLimitsCandidate', 'voidMingFixedFourShaCandidate',
      'voidJielanFourShaCandidate', 'voidsBothActualLimitsGuardCandidate', 'voidsZiweiMaoYouSplitTrineCandidate',
      'robberyShaCandidate', 'robberyAnnualOfficialCandidate',
      'robberyFourFlyingOfficialDoubleGuardCandidate',
      'robberyBoshiOfficialCandidate', 'robberyMingBoshiOfficialGuardCandidate', 'robberyTaiSuiShaCandidate', 'robberyTaiSuiFireBellEnvoyCandidate',
      'robberyTaiSuiQuanshuFixedFireBellCandidate', 'robberyTaiSuiSkyCandidate', 'robberyMingTaiSuiNatalShaDoubleGuardCandidate',
      'skySupportCandidate', 'skyPartnerSupportCandidate', 'skyLuSupportCandidate', 'skyPartnerLuSupportCandidate',
      'skyCoSeatedAssistantCandidate', 'skyCoSeatedNobleCandidate', 'skyCoSeatedMingAuxiliaryNobleCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_kongjie_limits' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    for (const positive of ['jiSupportCandidate', 'jiFallenShaCandidate', 'jiMingFixedFourShaCandidate', 'jiBaseCandidate', 'jiBothLimitsAspectCandidate',
      'jiLiangTogetherCandidate', 'jiTongChangQuCandidate', 'xiangTempleAidCandidate',
      'xiangFallenLianPoYangTuoCandidate', 'xiangFallenOpposedCandidate', 'xiangFallenQuanshuFixedOpposedCandidate',
      'xiangMingYangFireBellCandidate', 'xiangMingYangAtVerifiedLimitCandidate',
      'xiangDoubleGuardCandidate', 'xiangIdleSeatCandidate', 'xiangIdleBothLimitsAspectCandidate', 'xiangGrowthAidCandidate',
      'tongSupportCandidate', 'tongFallenOpposedCandidate', 'tongFallenAnnualOpposedCandidate', 'tongFallenVoidsOpposedCandidate',
      'tongFallenJiOpposedCandidate', 'yinAtVerifiedLimitCandidate', 'yinClearFireBellCandidate', 'yinPairedFireBellCandidate',
      'yinSingleFireBellCandidate', 'yinReverseYangTuoCandidate', 'yinReverseAnnualYangTuoCandidate', 'yinReverseFireBellCandidate',
      'yinVolumeThreeNativeTrineDoubleGuardCandidate', 'yinMingDoubleGuardBothFireBellAspectsCandidate', 'yinMingSingleGuardWithoutFireBellCandidate',
      'yinQuanshuFixedClearFireBellCandidate', 'yinQuanshuFixedPairedFireBellCandidate', 'yinReverseQuanshuFixedFireBellCandidate',
      'yinReverseQuanshuFixedSplitLimitsCandidate',
      'bellWithoutNamedSupportCandidate', 'bellWithAdditionalAidCandidate',
      'bellWithNamedSupportCandidate', 'bellTanlangAtLimitCandidate', 'bellTanlangAspectCandidate', 'bellTempleWuTanCandidate',
      'bellTempleSupportPairCandidate', 'bellDoubleLimitWithoutNamedSupportCandidate', 'bellTempleHelperGroupsCandidate',
      'bellTempleFullSupportCandidate', 'jielanBellCandidate', 'quanshuFixedBellCandidate',
      'jielanBellWithoutNamedSupportCandidate', 'quanshuFixedBellWithoutNamedSupportCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_limit_verse_contacts' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    for (const positive of ['sunHarmoniousCandidate', 'sunTwoLimitAspectCandidate', 'sunFallenShaCandidate', 'sunTabooShaCandidate', 'sunDarkCandidate', 'sunDarkQuanshuFixedCandidate',
      'sunMingDimPairDoubleGuard', 'sunMingBrightDoubleGuardCandidate', 'sunMingFixedHarmoniousCandidate', 'sunMingFixedTwoLimitAspectCandidate', 'sunMingFixedFallenShaCandidate', 'sunMingFixedTabooShaCandidate',
      'wuTempleAtVerifiedLimitCandidate', 'wuTemplePlainCandidate', 'wuTempleChangCandidate', 'wuTempleChangNeighborCandidate',
      'wuTempleChangAssistantsCandidate', 'wuTempleChangFlankedCandidate',
      'wuQuanAtLimitCandidate', 'wuQuanAssistedCandidate', 'poTempleAtVerifiedLimitCandidate', 'poTemplePlainCandidate', 'poTempleSupportCandidate',
      'poTempleJoinedSupportCandidate', 'poTempleBothNoblesCandidate', 'poTempleAdverseCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_solar_wu_po_limits' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    for (const positive of ['parentMoonTigerCandidate', 'parentMoonSuiGuardTigerTrineCandidate', 'parentMoonSuiTigerTrinesCandidate',
      'parentMoonNatalSameSeatCandidate',
      'lifeBodyShaCandidate', 'lifeBodyAdditionalShaCandidate', 'lifeBodyMingFixedShaCandidate', 'lifeBodyMingFixedPairVerified',
      'lianzhenNatalXingJiBladeCandidate', 'lianzhenYearXingJiBladeCandidate',
      'lianzhenAtSuiMinor', 'qishaTianxingJiCandidate', 'qishaAnnualBladeJiCandidate', 'qishaSamePalaceAnnualJiBladeCandidate',
      'qishaNatalBladeTigerCandidate', 'qishaYearBladeTigerCandidate',
      'qishaNatalBladeAspectTigerCandidate', 'qishaYearBladeAspectTigerCandidate', 'qishaJielanBellTigerCandidate',
      'qishaQuanshuFixedBellTigerCandidate', 'qishaQuanshuFixedNatalBladeTigerCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_xing_ji_tiger' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    const qishaWithSupport = projected.find(f => f.entry.type === 'quanshu_xing_ji_tiger' && f.entry.data.mingQishaNatalLucunSameSeatCandidate === true)
      ?? projected.find(f => f.entry.type === 'quanshu_xing_ji_tiger' && f.entry.data.qishaXingJiEvidence === 'seen');
    if (qishaWithSupport) limitChapterIds.add(qishaWithSupport.factId);
    const qishaLucunAwayFromSui = projected.find(f => f.entry.type === 'quanshu_xing_ji_tiger'
      && f.entry.data.mingQishaNatalLucunOffTaiSuiCandidate === true);
    if (qishaLucunAwayFromSui) limitChapterIds.add(qishaLucunAwayFromSui.factId);
    const jielanSamePalace = projected.find(f => f.entry.type === 'quanshu_firebell_context' && f.entry.scope === 'yearly'
      && ((f.entry.data.jielanFireAtFocus === true && (f.entry.data.natalHorseAtFocus === true || f.entry.data.annualHorseAtFocus === true))
        || (f.entry.data.jielanBellAtLife === true && f.entry.data.qingyangAtLife === true && f.entry.data.annualWhiteTigerAtLife === true)));
    if (jielanSamePalace) limitChapterIds.add(jielanSamePalace.factId);
    const natalHorseFixedFire = projected.find(f => f.entry.type === 'quanshu_firebell_context' && f.entry.scope === 'yearly'
      && f.entry.data.quanshuFixedFireAtFocus === true && f.entry.data.natalHorseAtFocus === true);
    if (natalHorseFixedFire) limitChapterIds.add(natalHorseFixedFire.factId);
    for (const positive of ['flowHorseArchiveFireCandidate', 'flowHorseJielanFireCandidate', 'flowHorseQuanshuFixedFireCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_firebell_context' && f.entry.scope === 'yearly' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    for (const fact of projected) if (fact.entry.type === 'quanshu_tiger_layer_context' && fact.entry.scope === 'yearly'
      && fact.entry.data.lianzhenAnnualTigerTrineCandidate === true) limitChapterIds.add(fact.factId);
    for (const positive of ['cryVoidTogetherCandidate', 'cryVoidBothStarsDoubleGuardCandidate', 'cryVoidSplitCandidate',
      'cryVoidExceptionCandidate', 'cryVoidLuCandidate', 'cryVoidDadeFlankedDecadalCandidate', 'cryMourningDadeSplitFourFlyingCandidate',
      'cryVoidSameLimitAspectCandidate', 'cryVoidOtherLimitAspectCandidate', 'cryVoidLuAspectCandidate',
      'cryMourningCandidate', 'cryMourningLimitAspectCandidate', 'cryMourningSplitLimitsCandidate',
      'cryMourningNanyangMinorCandidate', 'cryMourningNanyangLifeCandidate', 'cryMourningQuanjiLifeAspectCandidate',
      'doujunMingYearContrastCandidate', 'doujunMingYearAnnualShaCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_year_encounters' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    const doujunEvidenceIds = new Set(knowledge.byMethod.ziwei
      .filter(match => ['partial', 'matched'].includes(match.status)
        && match.knowledgeId.endsWith('quanshu-interpretation-expansion-p044-001'))
      .flatMap(match => [...match.sourceFactIds, ...match.candidateFactIds ?? []]));
    for (const fact of projected) if (doujunEvidenceIds.has(fact.factId)) {
      limitChapterIds.add(fact.factId);
    }
    for (const positive of ['tanlangNatalXingJiCandidate', 'tanlangYearXingJiCandidate', 'qishaSeparateBodyLifeCandidate',
      'qishaSharedBodyLifeCandidate', 'qishaBodyLifeAspectCandidate', 'qishaBodyLifeRepeatCandidate', 'qishaPlainLimitCandidate',
      'qishaImperialLuCandidate', 'qishaFlowShaCandidate', 'qishaAnnualTigerGuardCandidate', 'qishaBodyLifeJielanMinorShaCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_body_limit_encounters' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    for (const positive of ['yangNetVerifiedOpposedLimitCandidate', 'yangNetVerifiedBothOpposed', 'yangNetVerifiedAcrossLimits',
      'yangNetVolumeTwoIdleLifeCandidate', 'yangNetMingIdleLifeCandidate',
      'yangTombBirthGuardCandidate', 'yangTombLifeGuardCandidate', 'yangZiChangFuGuardCandidate',
      'fallenYangGuardShaCandidate', 'fallenYangOpposedShaCandidate', 'fallenYangNatalJiCandidate', 'fallenYangRepeatAnnualCandidate',
      'fallenYangMingFixedGuardCandidate', 'fallenYangMingFixedOpposedCandidate', 'fallenYangJielanFireJiCandidate',
      'fallenYangMingJumenGuardCandidate',
      'birthTabooWithThreeShaCandidate', 'namedTabooWithThreeShaCandidate', 'namedMingFixedFireBellTabooCandidate',
      'strongPalaceWeakLimitCandidate', 'strongPalaceFallenLimitCandidate', 'strongDignityWeakLimitCandidate', 'strongDignityFallenLimitCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_yang_taboo_context' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    const yangOpposesWithFallenMajors = projected.find(f => f.entry.type === 'quanshu_yang_taboo_context'
      && f.entry.data.yangNetVerifiedOpposedLimitCandidate === true && f.entry.data.lifeMajorGradeState === 'all-fallen');
    if (yangOpposesWithFallenMajors) limitChapterIds.add(yangOpposesWithFallenMajors.factId);
    for (const positive of ['horseTianxingQishaCandidate', 'lifeHorseXingShaAtVerifiedLimit', 'nonLifeHorseXingShaAtVerifiedDecade',
      'horseCutVoidCandidate', 'horseXunVoidCandidate', 'horseSkyVoidCandidate',
      'mingHorseCutVoidGuardCandidate', 'mingHorseNativeVoidsGuardCandidate', 'horseDeadOrExtinctStageCandidate',
      'horseLuQishaXunVoidGuardCandidate',
      'horseTuoluoTogetherCandidate', 'horseAnnualTuoluoCandidate', 'flowHorseXingShaCandidate', 'flowHorseCutVoidCandidate', 'flowHorseXunVoidCandidate',
      'flowHorseSkyVoidCandidate', 'flowHorseNatalTuoluoCandidate', 'flowHorseAnnualTuoluoCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_horse_void_context' && f.entry.scope === 'yearly' && f.entry.data[positive] === true);
      if (fact) limitChapterIds.add(fact.factId);
    }
    for (const positive of ['propertySunCandidate', 'propertySunSplitAssistedCandidate', 'ziweiSupportCandidate', 'ziweiTrinePairCandidate',
      'propertySunDoubleFuBiGuard', 'ziweiDoubleFuBiGuard', 'ziweiMingFuXiangDoubleGuardCandidate', 'ziweiMingFuXiangSeatAndTrineDoubleGuardCandidate',
      'tianliangSupportCandidate', 'wenquSupportCandidate',
      'tianliangTempleSupportCandidate', 'tianliangCombinedShaCandidate', 'tianliangQuanshuFixedCombinedShaCandidate',
      'wenquPairedLimitsCandidate', 'ziweiThreeShaCandidate', 'wenquFallenCandidate', 'wenquChapterFallenCandidate']) {
      const fact = projected.find(f => f.entry.type === 'quanshu_support_condition' && f.entry.data[positive] === true
        && (!positive.startsWith('propertySun') || f.entry.scope === 'decadal'));
      if (fact) limitChapterIds.add(fact.factId);
    }
    const timingIds = new Set(['heindel_transit_context', 'heindel_direction_transit_overlap',
      'ptolemy_time_place', 'ptolemy_ingress_contact', 'lunation_window',
      'sepharial_lunation_context', 'progression_transit_overlap', 'leo_mc_tenth_contact',
      'leo_solar_natal_contact'].flatMap(type => {
      const fact = projected.find(fact => fact.entry.type === type
        && (type !== 'ptolemy_ingress_contact' || fact.entry.data.level !== 'authorTerm')
        && (type !== 'sepharial_lunation_context'
          || fact.entry.data.exactNatalContact === true || fact.entry.data.exactNatalSupportAspect === true)
        && (type !== 'leo_solar_natal_contact' || fact.entry.data.qualifiedCandidate === true));
      return fact ? [fact.factId] : [];
    }));
    for (const aspect of ['sextile', 'trine']) {
      const lunation = projected.find(({ factId, entry }) => entry.type === 'sepharial_lunation_context'
        && (westernCandidateIds.has(factId) || priorityIds.has(factId)) && entry.data.natalLunationAspect === aspect);
      if (lunation) timingIds.add(lunation.factId);
    }
    for (const field of ['stationaryTransits', 'annualProgressedLunarDirections', 'newMoonSignificatorContacts'] as const) {
      const lunation = projected.find(({ factId, entry }) => {
        const contacts = entry.data[field];
        return entry.type === 'sepharial_lunation_context' && (westernCandidateIds.has(factId) || priorityIds.has(factId))
          && Array.isArray(contacts) && contacts.length > 0;
      });
      if (lunation) representatives.add(lunation.factId);
    }
    const solarParallel = projected.find(({ factId, entry }) => entry.type === 'leo_solar_natal_contact'
      && (entry.data.soleSolarParallelCandidate === true || entry.data.soleSolarDualCoordinateCandidate === true) && priorityIds.has(factId));
    if (solarParallel) representatives.add(solarParallel.factId);
    for (const candidate of ['soleLunarCandidate', 'closestLunarCandidate', 'hasUniqueClosestNatalSolarMajor', 'hasUniqueClosestNatalSolarMinor', 'isAscendantDecanRuler', 'isAscendantDwadashamshaRuler']) {
      const lunarTransit = projected.find(fact => fact.entry.type === 'leo_solar_natal_contact'
        && fact.entry.data[candidate] === true && westernCandidateIds.has(fact.factId));
      if (lunarTransit) timingIds.add(lunarTransit.factId);
    }
    const secondHouseIds = new Set<string>();
    for (const body of ['Saturn', 'Jupiter']) {
      const options = projected.filter(fact => fact.entry.type === 'leo_second_house_transit_context' && fact.entry.data.transitBody === body);
      const matched = options.filter(fact => westernCandidateIds.has(fact.factId));
      const fact = matched.find(fact => Array.isArray(fact.entry.data.repeatingDirections) && fact.entry.data.repeatingDirections.length)
        ?? matched[0];
      if (fact) secondHouseIds.add(fact.factId);
      else if (options[0]) timingIds.add(options[0].factId);
      const crossing = matched.find(({ entry }) => Array.isArray(entry.data.targetCrossings) && entry.data.targetCrossings.length);
      const directions = matched.find(({ entry }) => Array.isArray(entry.data.financialDirections) && entry.data.financialDirections.length);
      if (crossing) secondHouseIds.add(crossing.factId);
      if (directions) secondHouseIds.add(directions.factId);
    }
    const ptolemyRelation = knowledge.byMethod.western.find(item => item.knowledgeId.endsWith('ptolemy-time-v4-relation-p001-001')
      && (item.status === 'partial' || item.status === 'matched'));
    const ptolemyRelationIds = new Set([...(ptolemyRelation?.sourceFactIds ?? []), ...(ptolemyRelation?.candidateFactIds ?? [])]);
    const beforePtolemyPhases = timingIds.size;
    for (const phase of ['new_moon', 'first_quarter', 'full_moon', 'last_quarter']) {
      const phases = projected.filter(({ entry }) => entry.type === 'ptolemy_lunar_phase_contact' && entry.data.phase === phase);
      const configured = phases.filter(({ entry }) => ['annualAspect', 'monthlyAspect', 'solarAnnualAspect', 'solarMonthlyAspect']
        .some(key => entry.data[key] && entry.data[key] !== 'none'));
      const witness = configured.find(({ entry }) =>
        Array.isArray(entry.data.phaseIngressContacts) && entry.data.phaseIngressContacts.length > 0) ?? configured[0];
      if (witness) timingIds.add(witness.factId);
      for (const level of ['year', 'month']) {
        const carry = phases.find(({ entry }) => Array.isArray(entry.data.phaseCarryContacts)
          && entry.data.phaseCarryContacts.some(contact => contact?.level === level));
        if (carry) timingIds.add(carry.factId);
        const related = phases.find(({ entry }) => Array.isArray(entry.data.phaseTransitAspectContacts)
          && entry.data.phaseTransitAspectContacts.some(contact => contact?.level === level));
        if (related) timingIds.add(related.factId);
      }
    }
    const addedPtolemyPhaseEvidence = timingIds.size - beforePtolemyPhases;
    const relatedPtolemyFacts = projected.filter(fact => ptolemyRelationIds.has(fact.factId));
    for (const aspect of ['sextile', 'trine', 'square', 'opposition']) {
      const fact = relatedPtolemyFacts.find(fact => fact.entry.data.aspectType === aspect);
      if (fact) timingIds.add(fact.factId);
    }
    const ptolemyReversal = relatedPtolemyFacts.find(({ entry: { data } }) => data.aspectType === 'opposition'
      && data.transitNatalOriginAspect === 'opposition' && data.governsNatalOrigin === false && data.sameAsNatalAuthorTermRuler === false
      && ['sextile', 'trine'].some(aspect => aspect === data.natalOriginAspect));
    if (ptolemyReversal) timingIds.add(ptolemyReversal.factId);
    for (const reversal of [false, true]) {
      const mercury = relatedPtolemyFacts.find(({ entry: { data } }) => data.transitBody === 'Mercury'
        && data.sameNatalMercuryHorizonSect === true && (data.aspectType === 'opposition') === reversal);
      if (mercury) timingIds.add(mercury.factId);
    }
    const ptolemyDiscordByContext = new Map<string, string>();
    for (const { factId, entry } of relatedPtolemyFacts) {
      const { origin, natalOriginAspect, natalOriginSignFamiliarity, oppositeNatalSect, monthlyOriginAspect,
        transitBody, sameNatalMercuryHorizonSect, aspectType } = entry.data;
      const mercury = transitBody === 'Mercury';
      const opposedSect = mercury ? sameNatalMercuryHorizonSect === false : oppositeNatalSect === true;
      const hardAspect = aspectType === 'square' || aspectType === 'opposition';
      const discordantNatal = natalOriginAspect === 'square' || natalOriginAspect === 'opposition' || natalOriginSignFamiliarity === 'alien';
      if (discordantNatal && opposedSect && hardAspect) {
        const context = JSON.stringify([origin, monthlyOriginAspect, natalOriginAspect, mercury]);
        if (!ptolemyDiscordByContext.has(context)) ptolemyDiscordByContext.set(context, factId);
      }
    }
    const ptolemyDiscordIds = new Set(ptolemyDiscordByContext.values());
    for (const mercury of [false, true]) {
      const natalRulerContact = relatedPtolemyFacts.find(({ entry: { data } }) => (data.transitBody === 'Mercury') === mercury
        && data.governsNatalOrigin === true && Array.isArray(data.natalRulership) && data.natalRulership.includes('domicile'));
      if (natalRulerContact) representatives.add(natalRulerContact.factId);
      const disputed = projected.find(({ entry: { type, data } }) => type === 'ptolemy_ingress_contact' && data.level === 'month'
        && (data.transitBody === 'Mercury') === mercury
        && data.governsNatalOrigin === false && data.sameAsNatalAuthorTermRuler === true
        && (mercury ? data.sameNatalMercuryHorizonSect === false : data.oppositeNatalSect === true)
        && (data.aspectType === 'square' || data.aspectType === 'opposition')
        && (data.natalOriginAspect === 'square' || data.natalOriginAspect === 'opposition' || data.natalOriginSignFamiliarity === 'alien'));
      if (disputed) representatives.add(disputed.factId);
    }
    const originalAnnualRuler = projected.find(f => f.entry.type === 'ptolemy_ingress_contact' && f.entry.data.level === 'year'
      && f.entry.data.sameAsAnnualLord === true && f.entry.data.aspectType === 'conjunction'
      && Array.isArray(f.entry.data.natalRulership) && f.entry.data.natalRulership.length > 0);
    if (originalAnnualRuler) timingIds.add(originalAnnualRuler.factId);
    const manuscriptOnlyDay = projected.find(({ entry }) => entry.type === 'ptolemy_ingress_contact'
      && entry.data.level === 'day' && entry.data.aspectType === 'none' && entry.data.dayManuscriptMoonContact === true);
    if (manuscriptOnlyDay) timingIds.add(manuscriptOnlyDay.factId);
    const timingSlotsBeforePrimary = timingIds.size;
    const authorBoundTransit = projected.find(f => f.entry.type === 'ptolemy_ingress_contact' && f.entry.data.level === 'month'
        && f.entry.data.sameAsNatalAuthorTermRuler === true && f.entry.data.governsNatalOrigin === false && ptolemyRelationIds.has(f.factId));
    if (authorBoundTransit) timingIds.add(authorBoundTransit.factId);
    const fortuneOverlap = knowledge.byMethod.western.find(row => row.knowledgeId.endsWith('ptolemy-time-v4-overlap-p001-001'));
    const fortuneOverlapEvidenceIds = new Set([...(fortuneOverlap?.sourceFactIds ?? []), ...(fortuneOverlap?.candidateFactIds ?? [])]);
    const isPtolemyOverlapEvidence = ({ factId, entry }: (typeof projected)[number]) =>
      entry.type === 'ptolemy_ingress_contact' && fortuneOverlapEvidenceIds.has(factId);
    for (const origin of ['ASC', 'MC', 'Sun', 'Moon', 'Fortune']) {
      const monthly = projected.find(fact => isPtolemyOverlapEvidence(fact) && fact.entry.data.level === 'month'
        && fact.entry.data.origin === origin && fact.entry.data.sameAsMonthlyLord === true && fact.entry.data.aspectType === 'conjunction');
      if (monthly) timingIds.add(monthly.factId);
    }
    for (const level of ['year', 'primary']) {
      const comparisons = projected.filter(fact => fact.entry.type === 'ptolemy_ingress_contact'
        && fact.entry.data.authorTermLevel === level && isPtolemyOverlapEvidence(fact));
      for (const agreement of ['same-ruler', 'different-ruler', 'egyptian-unavailable']) {
        const comparison = comparisons.find(row => row.entry.data.termTableAgreement === agreement
          && row.entry.data.sameAsNatalAuthorTermRuler === true)
          ?? comparisons.find(row => row.entry.data.termTableAgreement === agreement);
        if (comparison) timingIds.add(comparison.factId);
      }
      const termContacts = projected.filter(fact => fact.entry.type === 'ptolemy_ingress_contact'
        && fact.entry.data.level === level && fact.entry.data.termCoRulerIngress === true
        && fact.entry.data.sameAsPrimaryDirectionRuler !== true && fact.entry.data.sameAsAnnualLord !== true
        && isPtolemyOverlapEvidence(fact));
      const fact = termContacts.find(row => row.entry.data.sameAsNatalMaterialSignRuler === true) ?? termContacts[0];
      if (fact) timingIds.add(fact.factId);
    }
    for (const origin of ['ASC', 'MC', 'Sun', 'Moon', 'Fortune']) {
      for (const level of ['year', 'primary']) {
        const candidates = projected.filter(f => f.entry.type === 'ptolemy_ingress_contact' && f.entry.data.origin === origin
          && f.entry.data.level === level && f.entry.data.sameAsPrimaryDirectionRuler === true && isPtolemyOverlapEvidence(f));
        const fact = candidates.find(f => f.entry.data.natalFortuneSaturnJupiterWitness)
          ?? candidates.find(f => f.entry.data.sameAsNatalMaterialSignRuler === true) ?? candidates[0];
        if (fact) timingIds.add(fact.factId);
      }
      const place = projected.find(f => f.entry.type === 'ptolemy_time_place'
        && f.entry.data.origin === origin && f.entry.data.primaryDirection);
      if (place) timingIds.add(place.factId);
    }
    const fortuneWitness = projected.find(fact => isPtolemyOverlapEvidence(fact) && fact.entry.data.origin === 'Fortune'
      && (fact.entry.data.natalFortuneSaturnJupiterWitness as { jupiterBicorporeal?: boolean } | undefined)?.jupiterBicorporeal === true);
    if (fortuneWitness) timingIds.add(fortuneWitness.factId);
    const fortuneMoonWitness = projected.find(fact => isPtolemyOverlapEvidence(fact) && fact.entry.data.origin === 'Fortune'
      && (fact.entry.data.natalFortuneSaturnJupiterWitness as { lunarApplication?: unknown } | undefined)?.lunarApplication);
    if (fortuneMoonWitness) representatives.add(fortuneMoonWitness.factId);
    const verifiedFortuneTiming = projected.find(({ factId, entry }) => entry.type === 'ptolemy_ingress_contact'
      && entry.data.hasNatalFortuneSameSectHarmoniousWitness === true && fortuneOverlap?.status === 'matched'
      && fortuneOverlap.sourceFactIds.includes(factId));
    if (verifiedFortuneTiming) representatives.add(verifiedFortuneTiming.factId);
    const fortuneFamiliarities = projected.find(fact => {
      const { entry } = fact;
      if (entry.data.origin !== 'Fortune' || !isPtolemyOverlapEvidence(fact)) return false;
      const conditions = entry.data.natalFortuneRulerConditions as {
        ownPositionFamiliarities?: { egyptian?: { multiple?: boolean }; author?: { multiple?: boolean } };
      } | undefined;
      const own = conditions?.ownPositionFamiliarities;
      return own?.egyptian?.multiple === true || own?.author?.multiple === true;
    });
    if (fortuneFamiliarities) representatives.add(fortuneFamiliarities.factId);
    const addedPrimaryTimingEvidence = timingIds.size - timingSlotsBeforePrimary;
    for (const house of [7, 10]) {
      const choices = projected.filter(fact => fact.entry.type === 'leo_jupiter_house_ruler_context' && fact.entry.data.natalHouse === house);
      const fact = choices.find(item => item.entry.data.annualRulerDirectionCandidate === true)
        ?? choices.find(item => item.entry.data.sameRulerDirectionCandidate === true)
        ?? choices.find(item => westernCandidateIds.has(item.factId)) ?? choices[0];
      if (fact) timingIds.add(fact.factId);
    }
    const yunIds = new Set(['yun_time_segment', 'yun_palace_condition', 'yun_transformation_contact'].flatMap(type => {
      const choices = projected.filter(f => f.entry.type === type).sort((a, b) =>
        Number(b.entry.scope === 'daily') - Number(a.entry.scope === 'daily')
        || Number(b.entry.data.sunJiNinthPairVerified === true) - Number(a.entry.data.sunJiNinthPairVerified === true)
        || Number(b.entry.data.sourceDayClock === 'agreed') - Number(a.entry.data.sourceDayClock === 'agreed')
        || Number(b.entry.data.flowName === '命宫') - Number(a.entry.data.flowName === '命宫')
        || Number(b.entry.data.sourceScope === b.entry.scope) - Number(a.entry.data.sourceScope === a.entry.scope));
      return choices[0] ? [choices[0].factId] : [];
    }));
    const yunClockComparison = projected.find(({ entry }) => entry.type === 'yun_time_segment' && entry.data.sourceDayClock === 'civil-midnight');
    const yunClockCounterpart = yunClockComparison && projected.find(({ entry }) => entry.type === 'yun_time_segment'
      && entry.data.sourceDayClock === 'zi-start' && entry.start === yunClockComparison.entry.start
      && entry.endExclusive === yunClockComparison.entry.endExclusive);
    const partialYunIds = new Set(knowledge.byMethod.ziwei.filter(item => item.status === 'partial').flatMap(item => item.sourceFactIds));
    const monthlyAreas = projected.filter(({ factId, entry }) => entry.type === 'yun_month_finance_area' && partialYunIds.has(factId));
    const separatedFinanceAreas = ['life-area', 'year-axis'].map(area => projected.find(({ factId, entry }) =>
      priorityIds.has(factId) && entry.type === 'yun_month_finance_area' && entry.data.area === area
      && entry.data.separatedTabooAndSha === true));
    const financeArea = monthlyAreas.find(({ entry }) => entry.data.area === 'life-area' && Number(entry.data.affectedFinanceCount) >= 2)
      ?? monthlyAreas.find(({ entry }) => entry.data.area === 'life-area');
    const financeAxis = projected.find(({ entry }) => entry.type === 'yun_palace_condition'
      && ['overlaid_wealth', 'fortune_only'].includes(String(entry.data.dailyFinanceAxisSide))
      && Array.isArray(entry.data.localPositiveScopes) && ['monthly', 'daily'].every(scope => (entry.data.localPositiveScopes as unknown[]).includes(scope)));
    const propertyWitnesses = ['upper-taboo', 'jumen-taboo'].map(reading => projected.find(({ factId, entry }) =>
      (partialYunIds.has(factId) || priorityIds.has(factId)) && entry.type === 'yun_month_property_contact' && entry.data.propertyReading === reading));
    const annualAxis = monthlyAreas.find(({ entry }) => entry.data.area === 'year-axis');
    const axisTabooSha = monthlyAreas.find(({ entry }) =>
      Array.isArray(entry.data.yearAxisTabooShaWitnesses) && entry.data.yearAxisTabooShaWitnesses.length > 0);
    const lifeSeatFinance = projected.find(({ factId, entry }) => priorityIds.has(factId)
      && entry.type === 'yun_month_finance_area' && entry.data.yearAxisLifeSeatFinanceSupportWitness);
    const yunConditionIds = new Set([financeArea, financeAxis, ...propertyWitnesses, ...separatedFinanceAreas, annualAxis, axisTabooSha,
      lifeSeatFinance, yunClockComparison, yunClockCounterpart]
      .flatMap(fact => fact ? [fact.factId] : []));
    const leoIds = new Set(['leo_natal_context', 'leo_progressed_aspect', 'leo_lunar_contact'].flatMap(type => {
      const choices = projected.filter(f => f.entry.type === type).sort((a, b) =>
        Number(b.entry.data.aspectType === 'parallel') - Number(a.entry.data.aspectType === 'parallel'));
      return choices[0] ? [choices[0].factId] : [];
    }));
    const progressedPair = projected.find(fact => fact.entry.type === 'leo_progressed_aspect' && fact.entry.data.targetKind === 'progressed');
    if (progressedPair) leoIds.add(progressedPair.factId);
    for (const qualification of ['strengthened', 'favourable-context']) {
      const lunar = projected.find(({ entry: { type, data } }) => type === 'leo_solar_lunar_phase'
        && data.natalTargetId === 'Jupiter' && data.aspectType === 'conjunction' && data.lunarQualification === qualification);
      if (lunar) leoIds.add(lunar.factId);
    }
    for (const fact of projected) {
      if (['leo_solar_phase', 'leo_solar_lunar_phase'].includes(fact.entry.type)
        && westernCandidateIds.has(fact.factId)) leoIds.add(fact.factId);
      if (fact.entry.type === 'leo_lunar_exact_observation' && (Array.isArray(fact.entry.data.lunarNeptuneTestimonies)
        && fact.entry.data.lunarNeptuneTestimonies.length > 0 || (fact.entry.data.natalTargetId === 'Neptune'
          && fact.entry.data.aspectType === 'quincunx'
          && (fact.entry.data.natalTargetHouse === 1 || fact.entry.data.natalNeptuneApproachingAscendant === true
            || fact.entry.data.hasLunarNeptuneDevotionalContact === true)))) {
        leoIds.add(fact.factId);
        if (priorityIds.has(fact.factId)) representatives.add(fact.factId);
      }
      if (fact.entry.type === 'leo_mutual_exact_observation' && Array.isArray(fact.entry.data.natalMercuryNeptuneTestimonies)
        && fact.entry.data.natalMercuryNeptuneTestimonies.length > 0) leoIds.add(fact.factId);
      const { data } = fact.entry;
      if (fact.entry.type === 'leo_lunar_condition' && data.hasConcurrentUranianSensitivityDirection === true
        && (westernCandidateIds.has(fact.factId) || priorityIds.has(fact.factId))) leoIds.add(fact.factId);
      if (fact.entry.type === 'leo_lunar_condition'
        && (data.hasCleanAdverseMoonNeptuneActivation === true || data.hasExactCleanMarsSaturnAdverseMoon === true
          || data.hasExactCleanMarsJupiterOtherAdverseMoon === true || data.hasMarsJupiterAdverseLunarParallelActivation === true)
        && priorityIds.has(fact.factId)) leoIds.add(fact.factId);
      if (fact.entry.type === 'leo_mutual_exact_observation' && westernCandidateIds.has(fact.factId)
        && typeof data.natalVenusNeptuneAfflictionState === 'string') leoIds.add(fact.factId);
      const risingNeptuneArt = data.natalTargetHouse === 1
        && (data.hasMercuryNeptuneSextileExact === true || data.hasVenusNeptuneSemisextileExact === true);
      const natalCreativeContacts = (data.hasMercuryNeptuneSextileExact === true
        || (data.natalTargetHouse === 1 || data.natalTargetHouse === 3) && data.hasMarsNeptuneConjunctionExact === true
        || data.progressedBody === 'Mercury' && data.natalTargetId === 'Neptune' && data.aspectType === 'parallel')
        && Array.isArray(data.natalNeptuneCreativeTestimonies) && data.natalNeptuneCreativeTestimonies.length;
      const ninthHouseNeptune = data.natalTargetHouse === 9 && data.hasMercuryNeptuneSextileExact === true;
      const mercuryVenusArt = Array.isArray(data.natalMercuryVenusArtisticContacts) && data.natalMercuryVenusArtisticContacts.length > 0;
      const natalNeptuneClosestContact = Array.isArray(data.natalNeptuneClosestComparableLuminaryContacts)
        && data.natalNeptuneClosestComparableLuminaryContacts.length > 0;
      const venusNeptuneBand = data.targetKind === 'natal' && data.progressedBody === 'Venus' && data.natalTargetId === 'Neptune'
        && data.aspectType === 'semisextile' && (data.natalVenusNeptuneAfflictionState === 'adverse' || risingNeptuneArt);
      const mercuryNeptuneBand = data.targetKind === 'natal' && data.progressedBody === 'Mercury' && data.natalTargetId === 'Neptune'
        && data.aspectType === 'sextile' && ([1, 3, 9].some(house => house === data.natalTargetHouse) || mercuryVenusArt
          || Array.isArray(data.natalNeptuneCreativeTestimonies) && data.natalNeptuneCreativeTestimonies.length > 0);
      if (fact.entry.type === 'leo_progressed_aspect'
        && (venusNeptuneBand || mercuryNeptuneBand || westernCandidateIds.has(fact.factId)
          && (risingNeptuneArt || natalCreativeContacts || ninthHouseNeptune || mercuryVenusArt || natalNeptuneClosestContact))) {
        leoIds.add(fact.factId);
        representatives.add(fact.factId);
      }
    }
    const devotionalSolarPhase = projected.find(fact => fact.entry.type === 'leo_solar_lunar_phase'
      && fact.entry.data.hasNatalNeptuneDevotionalContact === true && westernCandidateIds.has(fact.factId));
    if (devotionalSolarPhase) representatives.add(devotionalSolarPhase.factId);
    const neptuneLunarSupport = projected.find(fact => fact.entry.type === 'leo_solar_lunar_phase'
      && ['lunar-sextile', 'lunar-trine'].some(type => type === fact.entry.data.neptuneTrineSupportType)
      && westernCandidateIds.has(fact.factId));
    if (neptuneLunarSupport) representatives.add(neptuneLunarSupport.factId);
    const neptuneContraryMoon = projected.find(({ entry: { type, data } }) => type === 'leo_solar_lunar_phase'
      && Array.isArray(data.neptuneTrineLunarSupportContacts) && data.neptuneTrineLunarSupportContacts.length > 0
      && Array.isArray(data.contacts) && data.contacts.some(contact => contact?.nature === 'adverse'));
    if (neptuneContraryMoon) representatives.add(neptuneContraryMoon.factId);
    const blockedNeptuneDirections = projected.find(({ entry: { type, data } }) => type === 'leo_solar_lunar_phase'
      && data.hasAdverseNeptuneTrineMoonContact === true
      && (data.neptuneTrineSupportType === 'major' || data.hasExactNeptuneTrineCrossLayerSolarSupport === true));
    if (blockedNeptuneDirections) representatives.add(blockedNeptuneDirections.factId);
    const neptuneSolarSupport = projected.find(fact => fact.entry.type === 'leo_solar_lunar_phase'
      && fact.entry.data.hasExactNeptuneTrineCrossLayerSolarSupport === true
      && (priorityIds.has(fact.factId) || westernCandidateIds.has(fact.factId)));
    if (neptuneSolarSupport) representatives.add(neptuneSolarSupport.factId);
    const neptuneFinanceObstacle = projected.find(({ entry: { type, data } }) => type === 'leo_solar_lunar_phase'
      && data.hasNeptuneTrineVenusMarsOpposition === true && data.hasExactNeptuneTrineCrossLayerSolarSupport === true);
    if (neptuneFinanceObstacle) representatives.add(neptuneFinanceObstacle.factId);
    const natalNeptuneFinanceObstacle = projected.find(({ entry: { type, data } }) => type === 'leo_solar_lunar_phase'
      && data.hasNatalSecondRulerTwelfthHouseAffliction === true
      && (data.neptuneTrineSupportType === 'major' || data.hasExactNeptuneTrineCrossLayerSolarSupport === true));
    if (natalNeptuneFinanceObstacle) representatives.add(natalNeptuneFinanceObstacle.factId);
    for (const type of ['leo_lunar_exact_observation', 'leo_solar_lunar_phase']) for (const layer of ['natal', 'progressed']) {
      const testimony = projected.find(fact => fact.entry.type === type && fact.entry.data.targetKind === layer
        && Array.isArray(fact.entry.data.natalSunNeptuneCreativeContacts) && fact.entry.data.natalSunNeptuneCreativeContacts.length > 0
        && westernCandidateIds.has(fact.factId));
      if (testimony) {
        leoIds.add(testimony.factId);
        representatives.add(testimony.factId);
      }
    }
    for (const aspect of ['quincunx', 'opposition']) for (const layer of ['natal', 'progressed']) {
      const testimony = projected.find(fact => fact.entry.type === 'leo_solar_lunar_phase'
        && fact.entry.data.aspectType === aspect && fact.entry.data.targetKind === layer
        && fact.entry.data.hasExactSaturnLunarFamilyContext === true
        && (priorityIds.has(fact.factId) || westernCandidateIds.has(fact.factId) || aspect === 'quincunx' && saturnQuincunxMatched));
      if (testimony) {
        leoIds.add(testimony.factId);
        representatives.add(testimony.factId);
      }
      if (aspect === 'quincunx') {
        const parallel = projected.find(fact => fact.entry.type === 'leo_solar_lunar_phase'
          && fact.entry.data.aspectType === aspect && fact.entry.data.targetKind === layer
          && fact.entry.data.saturnLunarFamilyParallelContact
          && (priorityIds.has(fact.factId) || westernCandidateIds.has(fact.factId) || saturnQuincunxMatched));
        if (parallel) representatives.add(parallel.factId);
        for (const field of ['saturnLunarSteadinessContacts', 'saturnLunarWeakSteadinessContacts'] as const) {
          const steadiness = projected.find(fact => {
            const contacts = fact.entry.data[field];
            return fact.entry.type === 'leo_solar_lunar_phase' && fact.entry.data.aspectType === aspect && fact.entry.data.targetKind === layer
              && Array.isArray(contacts) && contacts.length > 0
              && (priorityIds.has(fact.factId) || westernCandidateIds.has(fact.factId) || saturnQuincunxMatched);
          });
          if (steadiness) representatives.add(steadiness.factId);
        }
      }
    }
    for (const field of ['exactAdverseMoonToNatalEndpoint', 'exactAdverseMoonToProgressedEndpoint']) {
      const lunarParallel = projected.find(({ entry, factId }) => {
        const { data } = entry;
        const contact = data[field] as { aspectType?: string } | undefined;
        return entry.type === 'leo_lunar_condition' && data.progressedBody === 'Mars' && data.natalTargetId === 'Saturn'
          && data.targetKind === 'natal' && data.aspectType === 'parallel' && contact?.aspectType === 'parallel'
          && (westernCandidateIds.has(factId) || priorityIds.has(factId));
      });
      if (lunarParallel) representatives.add(lunarParallel.factId);
    }
    const uranianResearch = matched.find(row => row.knowledgeId.includes('-leo-1906-interpretation-p286-'));
    const lunarStudyHouses = projected.filter(({ factId, entry: { type, data } }) => type === 'leo_lunar_condition'
      && (data.uranianMetaphysicalMoonHouse === 8 || data.uranianMetaphysicalMoonHouse === 9)
      && uranianResearch?.sourceFactIds.includes(factId));
    for (const fact of lunarStudyHouses) representatives.add(fact.factId);
    const mutualUranianDirection = projected.find(({ entry: { type, data } }) =>
      type === 'leo_lunar_condition' && data.progressedBody === 'Sun' && data.natalTargetId === 'Uranus'
      && data.aspectType === 'parallel' && Array.isArray(data.uranianMetaphysicalMutualDirections)
      && data.uranianMetaphysicalMutualDirections.length > 0);
    if (mutualUranianDirection) representatives.add(mutualUranianDirection.factId);
    for (const key of ['hasExactUranianMetaphysicalSolarDirection', 'hasExactUranianMetaphysicalMercuryDirection',
      'hasExactUranianMetaphysicalVenusDirection', 'hasExactUranianMetaphysicalMoonDirection',
      'hasExactUranianMetaphysicalMinorMoonDirection',
      'hasUranianMetaphysicalMercuryLunarWitness', 'hasUranianLunarParallelActivation']) {
      const layers = key === 'hasExactUranianMetaphysicalMoonDirection' ? ['natal', 'progressed'] : [undefined];
      for (const layer of layers) {
        const witness = projected.find(({ factId, entry: { type, data, start, endExclusive } }) => {
          if (type !== 'leo_lunar_condition' || data[key] !== true) return false;
          if (layer && data.targetKind !== layer) return false;
          if (westernCandidateIds.has(factId)) return true;
          if (key === 'hasUranianLunarParallelActivation') return priorityIds.has(factId);
          if (data.progressedBody !== 'Sun' || data.natalTargetId !== 'Uranus' || data.aspectType !== 'parallel') return false;
          return uranianResearch?.sourceFactIds.includes(factId)
            || uranianResearch?.candidateFactIds?.includes(factId)
            || uranianResearch?.candidateWindows?.some(window => start < window.endExclusive && window.start < endExclusive);
        });
        if (witness) representatives.add(witness.factId);
      }
    }
    const hardLunarNeptune = run.facts.find(fact => {
      if (fact.factType !== 'leo_lunar_exact_observation') return false;
      const data = fact.normalizedPayload as Record<string, unknown> | null;
      return data?.aspectType === 'sesquiquadrate' && data.natalTargetId === 'Neptune'
        && Array.isArray(data.natalSquareOppositionBodies) && data.natalSquareOppositionBodies.includes('Neptune');
    });
    if (hardLunarNeptune) {
      const matchingBand = run.facts.find(fact => fact.factType === 'leo_progressed_aspect' && fact.parentSignalId === hardLunarNeptune.parentSignalId
        && fact.activeFrom <= hardLunarNeptune.activeFrom && hardLunarNeptune.activeFrom < fact.activeTo);
      if (matchingBand && projected.some(fact => fact.factId === matchingBand.factId)) leoIds.add(matchingBand.factId);
    }
    const crossings = projected.filter(fact => fact.entry.type === 'leo_lunar_ascendant_crossing'
      && westernCandidateIds.has(fact.factId));
    for (const crossing of crossings) {
      leoIds.add(crossing.factId);
      const context = projected.find(({ entry }) => entry.type === 'leo_lunar_house_context' && entry.data.house === 1
        && entry.data.targetKind === crossing.entry.data.targetKind && entry.data.annualFrameStart === crossing.entry.data.annualFrameStart
        && entry.start <= crossing.entry.start && crossing.entry.start < entry.endExclusive);
      if (context) leoIds.add(context.factId);
    }
    for (const house of [2, 3, 5, 6, 7, 8, 9, 10, 11]) {
      const samples = projected.filter(fact => fact.entry.type === 'leo_lunar_house_context'
        && fact.entry.data.house === house && (westernCandidateIds.has(fact.factId) || priorityIds.has(fact.factId)));
      if (house === 3 || house === 9) {
        if (samples[0]) leoIds.add(samples[0].factId);
        continue;
      }
      for (const nature of ['favourable', 'adverse']) {
        const fact = samples.find(({ entry: { data } }) => Array.isArray(data.lunarAspectNatures)
          && data.lunarAspectNatures.includes(nature) && (house !== 7 || nature !== 'favourable'
            || data.hasFavourableNatalTargetWithoutAffliction === true && data.moonHasAdverseAspect === false));
        if (fact) leoIds.add(fact.factId);
        if ([5, 10, 11].includes(house)) {
          const exact = samples.find(({ entry: { data } }) => Array.isArray(data.lunarExactAspectNatures)
            && data.lunarExactAspectNatures.includes(nature));
          if (exact) representatives.add(exact.factId);
        }
      }
    }
    for (const passage of ['p041', 'p044', 'p045', 'p049', 'p066', 'p068', 'p070', 'p073', 'p078', 'p080', 'p091', 'p094', 'p096', 'p098', 'p102',
      'p225', 'p257', 'p260', 'p262', 'p266', 'p269', 'p314', 'p340']) {
      const confirmedPair = passage === 'p044' ? ['Mars', 'Jupiter'] : passage === 'p340' ? ['Venus', 'Uranus'] : undefined;
      const result = knowledge.byMethod.western.find(row => (['partial', 'excluded'].includes(row.status)
        || confirmedPair && row.status === 'matched')
        && row.knowledgeId.includes('-leo-1906-interpretation-' + passage + '-'));
      const witnesses = projected.filter(({ factId, entry: { type, data, start, endExclusive } }) =>
        result?.sourceFactIds.includes(factId) || confirmedPair && type === 'leo_lunar_condition'
        && data.progressedBody === confirmedPair[0] && data.natalTargetId === confirmedPair[1]
        && (data.targetKind === 'natal' || passage === 'p340' && data.targetKind === 'progressed')
        && data.aspectType === 'quincunx' && result?.candidateWindows?.some(window => start < window.endExclusive && window.start < endExclusive));
      const fact = witnesses.find(row => row.entry.data.natalNeptuneBeforeAngularCusp === true) ?? witnesses[0];
      if (fact) leoIds.add(fact.factId);
      if (passage === 'p044' && result?.status === 'matched') representatives.add(result.sourceFactIds[0]);
      const representativeKeys = passage === 'p340'
        ? ['mutualExactInSlice', 'exactUranianSensitivityDirection', 'exactLunarLinkedBodies', 'venusNeptuneSensitivityDirection',
          'progressedVenusNeptuneSensitivityDirection', 'moonNeptuneSensitivityDirection',
          'hasVenusUranusParallelAtFormation',
          'hasUranianMoonSolarActivation', 'hasUranianLunarParallelActivation', 'hasVenusLunarParallelActivation']
        : passage === 'p098' ? ['mutualExactInSlice', 'natalMercuryAngularDominance', 'favourableNatalNeptuneLunarContacts'] : [];
      for (const key of representativeKeys) {
        const witness = witnesses.find(({ entry }) => {
          const value = entry.data[key];
          return Array.isArray(value) ? value.length > 0 : Boolean(value);
        });
        if (witness) leoIds.add(witness.factId);
      }
      if (['p098', 'p257', 'p266'].includes(passage)) {
        const luminary = witnesses.find(({ entry: { data } }) =>
          Array.isArray(data.natalNeptuneSoleLuminaryContacts) && data.natalNeptuneSoleLuminaryContacts.length > 0);
        if (luminary) leoIds.add(luminary.factId);
      }
    }
    for (const [passage, aspectType] of [['p257', 'conjunction'], ['p266', 'parallel']]) {
      const result = matched.find(row => row.knowledgeId.includes('-leo-1906-interpretation-' + passage + '-'));
      if (!result) continue;
      const band = projected.find(({ entry: { type, data, start, endExclusive } }) => type === 'leo_progressed_aspect'
        && data.progressedBody === 'Sun' && data.natalTargetId === 'Neptune' && data.targetKind === 'natal'
        && data.aspectType === aspectType && result.windows.some(window => start < window.endExclusive && window.start < endExclusive));
      if (band) {
        leoIds.add(band.factId);
        representatives.add(band.factId);
      }
    }
    const signWitnesses = new Set<string>();
    for (const { factId, entry } of projected) {
      const { progressedBodySign, progressedBody } = entry.data;
      if (entry.type !== 'leo_progressed_aspect' || typeof progressedBodySign !== 'number' || !westernCandidateIds.has(factId)) continue;
      const key = [progressedBody, progressedBodySign].join(':');
      if (signWitnesses.has(key)) continue;
      signWitnesses.add(key);
      leoIds.add(factId);
    }
    const directionAuditAspects: Readonly<Record<string, readonly [string, string, string]>> = {
      p037: ['Mars', 'Jupiter', 'conjunction'], p041: ['Mars', 'Jupiter', 'square'],
      p042: ['Mars', 'Jupiter', 'trine'],
      p044: ['Mars', 'Jupiter', 'quincunx'], p046: ['Mars', 'Jupiter', 'parallel'],
      p049: ['Mars', 'Neptune', 'semisquare'], p051: ['Mars', 'Neptune', 'square'], p067: ['Mars', 'Uranus', 'conjunction'],
      p057: ['Mars', 'Saturn', 'conjunction'], p059: ['Mars', 'Saturn', 'semisquare'], p063: ['Mars', 'Saturn', 'sesquiquadrate'],
      p066: ['Mars', 'Saturn', 'parallel'],
      p073: ['Mars', 'Uranus', 'sesquiquadrate'],
      p084: ['Mercury', 'Jupiter', 'quincunx'],
      p091: ['Mercury', 'Mars', 'square'], p094: ['Mercury', 'Mars', 'quincunx'],
      p095: ['Mercury', 'Mars', 'opposition'],
      p097: ['Mercury', 'Neptune', 'conjunction'], p102: ['Mercury', 'Neptune', 'trine'], p105: ['Mercury', 'Neptune', 'opposition'],
      p106: ['Mercury', 'Neptune', 'parallel'],
      p116: ['Mercury', 'Saturn', 'parallel'],
      p128: ['Mercury', 'Venus', 'semisextile'],
      p130: ['Mercury', 'Venus', 'sextile'],
      p236: ['Sun', 'Mars', 'semisextile'],
      p249: ['Sun', 'Moon', 'semisquare'], p254: ['Sun', 'Moon', 'quincunx'],
      p260: ['Sun', 'Neptune', 'sextile'],
      p259: ['Sun', 'Neptune', 'semisquare'], p261: ['Sun', 'Neptune', 'square'], p263: ['Sun', 'Neptune', 'sesquiquadrate'],
      p276: ['Sun', 'Saturn', 'parallel'], p281: ['Sun', 'Uranus', 'square'], p284: ['Sun', 'Uranus', 'quincunx'],
      p293: ['Venus', 'Jupiter', 'conjunction'],
      p295: ['Venus', 'Jupiter', 'semisquare'], p296: ['Venus', 'Jupiter', 'sextile'],
      p298: ['Venus', 'Jupiter', 'trine'], p301: ['Venus', 'Jupiter', 'opposition'],
      p300: ['Venus', 'Jupiter', 'quincunx'], p306: ['Venus', 'Mars', 'sextile'],
      p312: ['Venus', 'Mars', 'parallel'],
      p323: ['Venus', 'Saturn', 'conjunction'], p324: ['Venus', 'Saturn', 'semisextile'],
      p327: ['Venus', 'Saturn', 'square'], p331: ['Venus', 'Saturn', 'opposition'], p332: ['Venus', 'Saturn', 'parallel'],
      p329: ['Venus', 'Saturn', 'sesquiquadrate'],
      p333: ['Venus', 'Uranus', 'conjunction'], p336: ['Venus', 'Uranus', 'sextile'],
      p335: ['Venus', 'Uranus', 'semisquare'],
    };
    const directionNatalWitnesses: Readonly<Record<string, string[]>> = {
      p049: ['natalPairAspects'], p051: ['natalMarsNeptuneStrength'], p067: ['natalPairAspects'],
      p073: ['natalMarsUranusAfflictionFocus'],
      p091: ['natalMercuryImpulsivenessContacts'], p094: ['natalMercuryImpulsivenessContacts'],
      p097: ['natalMercuryNeptuneTestimonies', 'natalNeptuneArtContacts'], p102: ['natalAfflictionContacts'],
      p105: ['rulership'],
      p106: ['natalNeptuneMinorAfflictionContacts', 'natalNeptuneJupiterArtisticContacts', 'natalMercuryVenusArtisticContacts'], p128: ['natalVenusArtTestimonies', 'natalDevotionalTestimonies'],
      p130: ['natalVenusArtTestimonies', 'natalMercuryMentalTestimonies'],
      p259: ['natalMajorAspectContacts'], p261: ['natalAfflictionContacts'],
      p263: ['natalMajorAspectContacts'], p284: ['natalMajorAspectContacts'],
    };
    const beforeAspectAudit = leoIds.size;
    for (const passage of ['p043', 'p045', 'p052', 'p065', 'p283', 'p299', 'p314', ...Object.keys(directionAuditAspects)]) {
      const result = knowledge.byMethod.western.find(row => row.knowledgeId.includes('-leo-1906-interpretation-' + passage + '-'));
      const aspect = directionAuditAspects[passage];
      const hasSameGeometry = (data: Record<string, unknown>) => aspect
        && (data.targetKind === 'natal' || aspect[0] === 'Sun' && data.targetKind === 'progressed')
        && data.progressedBody === aspect[0] && data.natalTargetId === aspect[1] && data.aspectType === aspect[2];
      const basis = !aspect && result?.status === 'matched' && projected.find(row => (row.entry.type === 'leo_mutual_exact_observation'
        || (row.entry.type === 'leo_progressed_aspect' && row.entry.data.aspectType === 'parallel'))
        && result.sourceFactIds.includes(row.factId))?.entry.data;
      const slices = projected.filter(({ factId, entry }) => result?.sourceFactIds.includes(factId)
        || entry.type === 'leo_lunar_condition' && (aspect
          ? hasSameGeometry(entry.data)
          : basis && ['progressedBody', 'natalTargetId', 'targetKind', 'aspectType'].every(key => entry.data[key] === basis[key])));
      if (passage === 'p041' || passage === 'p044' || passage === 'p059') {
        const point = slices.find(({ factId, entry }) => entry.data.mutualExactInSlice === true && result?.sourceFactIds.includes(factId));
        if (point) leoIds.add(point.factId);
      }
      if (passage === 'p106') {
        const band = slices.find(({ factId, entry }) => entry.data.mercuryNeptuneParallelBandObserved === true
          && result?.sourceFactIds.includes(factId));
        if (band) leoIds.add(band.factId);
      }
      if (result?.status === 'matched' && (passage === 'p254' || passage === 'p260')) {
        const key = passage === 'p254' ? 'moonPosition' : 'natalFinancialContext';
        for (const layer of ['natal', 'progressed']) {
          const witness = slices.find(({ entry }) => entry.type === 'leo_lunar_condition'
            && entry.data.targetKind === layer && entry.data[key]);
          if (witness) leoIds.add(witness.factId);
        }
      }
      if (result?.status === 'matched' && passage === 'p300') {
        for (const witness of projected.filter(({ entry }) => entry.type === 'leo_progressed_aspect'
          && hasSameGeometry(entry.data) && entry.data.rulership)) leoIds.add(witness.factId);
      }
      for (const field of directionNatalWitnesses[passage] ?? []) {
        const witness = projected.find(({ entry }) => {
          if (entry.type !== 'leo_progressed_aspect' || !hasSameGeometry(entry.data)) return false;
          const value = entry.data[field];
          if (passage === 'p067') return Array.isArray(value) && value.some(row => row.aspect === 'conjunction');
          if (passage === 'p049') return Array.isArray(value) && value.some(row => ['semisextile', 'sextile', 'trine'].includes(row.aspect));
          if (aspect[0] === 'Sun') return Array.isArray(value) && value.some(row =>
            (row.first === aspect[1] || row.second === aspect[1])
            && (field === 'natalAfflictionContacts' || row.aspect === 'square' || row.aspect === 'opposition'));
          return Array.isArray(value) ? value.length > 0 : Boolean(value);
        });
        if (witness) leoIds.add(witness.factId);
      }
      for (const state of ['all_favourable', 'all_adverse']) {
        const fact = slices.find(row => row.entry.data.sameLayerLunarState === state);
        if (fact) leoIds.add(fact.factId);
      }
      const statesWithIndependentEvidence = passage === 'p044' || passage === 'p066' ? ['mixed', 'conditional'] : ['mixed'];
      for (const state of statesWithIndependentEvidence) {
        const point = slices.find(({ entry: { data } }) => data.sameLayerLunarState === state && data.exactAdverseMoonToNatalEndpoint);
        if (point) leoIds.add(point.factId);
      }
      const exactAdverseMovingMoon = slices.find(({ entry: { data } }) =>
        data.progressedState === 'all_adverse' && data.exactAdverseMoonToProgressedEndpoint);
      if (exactAdverseMovingMoon) leoIds.add(exactAdverseMovingMoon.factId);
      const exactFavourableMovingMoon = slices.find(({ entry: { data } }) =>
        data.progressedState === 'all_favourable' && data.exactFavourableMoonToProgressedEndpoint);
      if (exactFavourableMovingMoon) leoIds.add(exactFavourableMovingMoon.factId);
      if (passage === 'p095') {
        const adverseMoon = slices.find(({ entry }) => Array.isArray(entry.data.lunarAdverseTargets)
          && entry.data.lunarAdverseTargets.length > 0);
        if (adverseMoon) leoIds.add(adverseMoon.factId);
      }
      if (passage === 'p042') {
        const investment = slices.find(({ entry: { data } }) => {
          const directions = data.speculationDirections;
          return Array.isArray(directions) && directions.every(direction => direction.nature === 'favourable')
            && directions.some(direction => direction.body === 'Moon') && directions.some(direction => direction.body !== 'Moon');
        });
        if (investment) leoIds.add(investment.factId);
      }
      if (passage === 'p057') {
        const support = slices.find(({ entry: { data } }) => data.sameLayerLunarState === 'all_adverse'
          && Array.isArray(data.supportingDirections) && data.supportingDirections.length > 0);
        if (support) leoIds.add(support.factId);
      }
      if (passage === 'p059' || passage === 'p063') {
        for (const body of ['Sun', 'Moon']) {
          const witness = slices.find(({ entry: { data } }) => Array.isArray(data.luminaryLinks)
            && (passage === 'p063' || data.sameLayerLunarState === 'all_adverse' || data.directionSupportState === 'adverse')
            && data.luminaryLinks.some(link => link.body === body));
          if (witness) leoIds.add(witness.factId);
        }
      }
      if (passage === 'p236' || passage === 'p276') {
        for (const layer of ['natal', 'progressed']) {
          const favourable = slices.find(({ entry: { data } }) => data.targetKind === layer
            && (data.directionSupportState === 'favourable' || passage === 'p276' && data.directionSupportState === 'mixed')
            && Array.isArray(data.supportingDirections) && data.supportingDirections.some(row => row.nature === 'favourable'));
          if (favourable) leoIds.add(favourable.factId);
          if (passage !== 'p276') continue;
          const moon = slices.find(({ entry: { data } }) => data.targetKind === layer
            && Array.isArray(data.lunarFavourableTargets) && data.lunarFavourableTargets.length > 0);
          if (moon) leoIds.add(moon.factId);
        }
      }
      if (['p037', 'p116', 'p281', 'p295', 'p301', 'p323', 'p327', 'p332', 'p333'].includes(passage)) {
        const states = passage === 'p037' || passage === 'p333' ? ['favourable', 'adverse']
          : passage === 'p116' ? ['favourable'] : ['adverse', 'mixed'];
        for (const state of states) {
          const fact = slices.find(row => row.entry.data.directionSupportState === state
            && Array.isArray(row.entry.data.supportingDirections) && row.entry.data.supportingDirections.length > 0);
          if (fact) leoIds.add(fact.factId);
        }
      }
      const sequence = slices.find(row => row.entry.data.adverseSequence);
      if (sequence) leoIds.add(sequence.factId);
      if (passage === 'p052') for (const key of ['speculationDirections', 'travelDirections']) {
        const context = slices.find(row => Array.isArray(row.entry.data[key]) && row.entry.data[key].length > 0);
        if (context) leoIds.add(context.factId);
      }
    }
    const addedAspectAudit = leoIds.size - beforeAspectAudit;
    const marsSaturnMatches = new Set(knowledge.byMethod.western.find(item =>
      item.knowledgeId.includes('-leo-1906-interpretation-p059-'))?.sourceFactIds);
    const marsSaturnLuminaries = projected.filter(fact => (westernCandidateIds.has(fact.factId) || marsSaturnMatches.has(fact.factId))
      && fact.entry.type === 'leo_lunar_condition' && Array.isArray(fact.entry.data.luminaryLinks) && fact.entry.data.luminaryLinks.length > 0);
    const linkedLuminary = marsSaturnLuminaries.find(({ entry }) =>
      (entry.data.luminaryLinks as { body: string }[]).some(link => link.body === 'Sun')) ?? marsSaturnLuminaries[0];
    if (linkedLuminary) leoIds.add(linkedLuminary.factId);
    const lunarEndpoint = marsSaturnLuminaries.find(({ entry: { data } }) => data.aspectType === 'semisquare'
      && Array.isArray(data.exactLunarLinkedBodies) && data.exactLunarLinkedBodies.length > 0);
    if (lunarEndpoint) leoIds.add(lunarEndpoint.factId);
    const solarEndpoint = marsSaturnLuminaries.find(({ entry: { data } }) => data.aspectType === 'semisquare'
      && data.pairLuminaryLinksComplete === true
      && Array.isArray(data.exactSolarEndpointContacts) && data.exactSolarEndpointContacts.length > 0);
    if (solarEndpoint) leoIds.add(solarEndpoint.factId);
    const lunarConditions = projected.filter(fact => fact.entry.type === 'leo_lunar_condition' && westernCandidateIds.has(fact.factId)
      && Array.isArray(fact.entry.data.contacts) && fact.entry.data.contacts.length > 0);
    if (lunarConditions[0]) leoIds.add(lunarConditions[0].factId);
    const directionCandidates = projected.filter(fact => fact.entry.type === 'leo_lunar_condition'
      && westernCandidateIds.has(fact.factId));
    const marsSaturnParallel = projected.filter(({ entry, factId }) => entry.type === 'leo_lunar_condition'
      && entry.data.marsSaturnParallelBandObserved === true && (westernCandidateIds.has(factId) || priorityIds.has(factId)));
    const reviewedMoonBackground = marsSaturnParallel.find(fact => fact.entry.data.hasMarsSaturnReviewedMixedOrFavourableMoon === true);
    if (reviewedMoonBackground) leoIds.add(reviewedMoonBackground.factId);
    const trineAtParallel = marsSaturnParallel.find(fact => fact.entry.data.hasMarsSaturnTrineAtParallel === true);
    if (trineAtParallel) representatives.add(trineAtParallel.factId);
    const monthlyParallel = marsSaturnParallel.find(fact => fact.entry.data.hasMarsSaturnAdverseLunarParallelActivation === true);
    if (monthlyParallel) leoIds.add(monthlyParallel.factId);
    for (const active of [true, false]) {
      const candidates = marsSaturnParallel.filter(fact => fact.entry.data.hasMarsSaturnAdverseLunarActivation === active);
      const balance = candidates.find(fact => ['harmonious-aspect', 'domicile-exchange', 'both']
        .some(basis => basis === fact.entry.data.marsSaturnNatalBalanceBasis));
      if (balance) leoIds.add(balance.factId);
      for (const state of ['no-reviewed-mitigation', 'unreviewed']) {
        const comparison = candidates.find(fact => fact.entry.data.marsSaturnNatalBalanceBasis === state);
        if (comparison) leoIds.add(comparison.factId);
      }
    }
    const solarPreparation = marsSaturnLuminaries.find(({ entry: { data } }) => data.aspectType === 'semisquare'
      && data.pairLuminaryLinksComplete === false
      && Array.isArray(data.exactSolarLinkedBodies) && data.exactSolarLinkedBodies.length > 0);
    if (solarPreparation) leoIds.add(solarPreparation.factId);
    for (const key of ['venusNeptuneSensitivityDirection', 'progressedVenusNeptuneSensitivityDirection']) {
      const venusSensitivity = directionCandidates.find(fact => fact.entry.data[key]);
      if (venusSensitivity) leoIds.add(venusSensitivity.factId);
    }
    for (const kind of ['natal', 'progressed']) {
      const monthlyFrame = directionCandidates.find(({ entry }) => entry.data.targetKind === kind
        && (entry.data.monthlyThemeEvidence as { exactFrames?: unknown[] } | undefined)?.exactFrames?.length);
      if (monthlyFrame) leoIds.add(monthlyFrame.factId);
    }
    const lunarBridge = directionCandidates.find(fact => fact.entry.data.lunarBridge);
    const supportedDirectionIds = new Set(knowledge.byMethod.western.filter(item => item.status === 'partial'
      && /-leo-1906-interpretation-p(116|165|202|220|260|262|302)-/u.test(item.knowledgeId)).flatMap(item => item.sourceFactIds));
    const directionSupport = directionCandidates.find(fact => supportedDirectionIds.has(fact.factId)
      && Array.isArray(fact.entry.data.supportingDirections) && fact.entry.data.supportingDirections.length > 0);
    const moonPosition = directionCandidates.find(fact => fact.entry.data.moonPosition);
    const natalPremiseIds = new Set(knowledge.byMethod.western.filter(item => item.status === 'partial'
      && /-leo-1906-interpretation-p(181|284)-/u.test(item.knowledgeId)).flatMap(item => item.sourceFactIds));
    const natalPremise = projected.find(fact => natalPremiseIds.has(fact.factId));
    const placementIds = new Set(knowledge.byMethod.western.filter(item => item.status === 'partial'
      && /-leo-1906-interpretation-p(047|067)-/u.test(item.knowledgeId)).flatMap(item => item.sourceFactIds));
    const placement = projected.find(fact => placementIds.has(fact.factId));
    const concurrentIds = new Set(knowledge.byMethod.western.filter(item => item.status === 'partial'
      && /-leo-1906-interpretation-p(042|061|070|082|083|089|090|094|148|151|152|154|161|164|174|199|207|214|221|223|231|248|249|276|278|286|332)-/u.test(item.knowledgeId))
      .flatMap(item => item.sourceFactIds));
    const concurrent = directionCandidates.filter(fact => concurrentIds.has(fact.factId));
    const otherMajor = concurrent.find(fact => fact.entry.data.otherDirection);
    const classifiedMajor = concurrent.find(fact => Array.isArray(fact.entry.data.supportingDirections)
      && fact.entry.data.supportingDirections.length > 0);
    const concurrentMoon = concurrent.find(fact => Array.isArray(fact.entry.data.contacts)
      && fact.entry.data.contacts.some(contact => contact?.targetKind === fact.entry.data.targetKind));
    const priorLeoCount = leoIds.size;
    for (const item of matched.filter(row => /-leo-1906-interpretation-p(?:161|199|203|214|220|221|223|234|268)-/u.test(row.knowledgeId))) {
      const slices = projected.filter(fact => item.sourceFactIds.includes(fact.factId));
      const signatures = [
        slices.find(fact => fact.entry.data.monthlyLunarQualification === 'strengthened'),
        slices.find(fact => fact.entry.data.concurrentSolarJupiterSquare === true),
        slices.find(fact => item.knowledgeId.includes('-p234-') && Array.isArray(fact.entry.data.lunarFavourableTargets)
          && fact.entry.data.lunarFavourableTargets.includes('Jupiter')),
        slices.find(fact => item.knowledgeId.includes('-p268-') && fact.entry.data.otherDirection),
      ];
      for (const fact of signatures) if (fact) leoIds.add(fact.factId);
    }
    for (const [target, aspect] of [['Mercury', 'conjunction'], ['Sun', 'quincunx']]) {
      const slices = projected.filter(({ entry: { data, type } }) => type === 'leo_lunar_condition'
        && data.progressedBody === 'Moon' && data.natalTargetId === target && data.aspectType === aspect);
      for (const state of target === 'Sun' ? ['favourable'] : ['favourable', 'adverse', 'mixed']) {
        const direct = slices.find(({ entry }) => entry.data.directionSupportState === state);
        const bridged = slices.find(({ entry }) => entry.data.crossChartSupportState === state);
        for (const fact of [direct, bridged]) if (fact) leoIds.add(fact.factId);
      }
    }
    for (const layer of ['natal', 'progressed']) {
      const solar = projected.find(({ entry: { data, type } }) => type === 'leo_lunar_condition'
        && data.progressedBody === 'Moon' && data.natalTargetId === 'Sun' && data.aspectType === 'parallel'
        && data.targetKind === layer
        && (Array.isArray(data.natalSolarContacts) && data.natalSolarContacts.length > 0 || data.natalSolarDignity)
        && (Array.isArray(data.progressedSolarContacts) && data.progressedSolarContacts.length > 0 || data.progressedSolarDignity)
        && Array.isArray(data.contacts) && data.contacts.some(contact => contact.targetKind === layer));
      if (solar) leoIds.add(solar.factId);
    }
    const lunarHouseWitnesses = projected.filter(fact => fact.entry.type === 'leo_lunar_house_context'
      && fact.entry.data.targetKind === 'natal' && (westernCandidateIds.has(fact.factId) || priorityIds.has(fact.factId)));
    const keepLunarHouseWitness = (witness: typeof lunarHouseWitnesses[number] | undefined) => {
      if (!witness) return;
      leoIds.add(witness.factId);
      if (priorityIds.has(witness.factId)) representatives.add(witness.factId);
    };
    const hasLunarNature = (data: Record<string, unknown>, nature: string) =>
      Array.isArray(data.lunarAspectNatures) && data.lunarAspectNatures.includes(nature);
    const literaryWitnesses = lunarHouseWitnesses.filter(({ entry: { data } }) =>
      Array.isArray(data.literaryPlacements) && data.literaryPlacements.length);
    const literary = literaryWitnesses.find(({ entry }) => !hasLunarNature(entry.data, 'favourable')) ?? literaryWitnesses[0];
    if (literary) leoIds.add(literary.factId);
    const lunarFinance = lunarHouseWitnesses.find(({ entry }) =>
      (entry.data.secondFinance as { contacts?: unknown[] } | undefined)?.contacts?.length);
    if (lunarFinance) leoIds.add(lunarFinance.factId);
    const domesticWitnesses = lunarHouseWitnesses.filter(({ entry: { data } }) =>
      Array.isArray(data.domesticPlacements) && data.domesticPlacements.length);
    const domestic = domesticWitnesses.find(({ entry: { data } }) =>
      Array.isArray(data.relocationDirections) && data.relocationDirections.length) ?? domesticWitnesses[0];
    keepLunarHouseWitness(domestic);
    for (const field of ['sixthServicePlacements', 'careerPlacements', 'twelfthPrivatePlacements']) {
      const placements = lunarHouseWitnesses.filter(({ entry: { data } }) =>
        Array.isArray(data[field]) && data[field].length);
      const witness = field === 'sixthServicePlacements'
        ? placements.find(({ entry: { data } }) => !hasLunarNature(data, 'favourable') && !hasLunarNature(data, 'adverse')) ?? placements[0]
        : placements[0];
      keepLunarHouseWitness(witness);
    }
    for (const field of ['eighthFinance', 'ninthVoyage']) {
      for (const nature of ['favourable', 'adverse']) {
        const witness = lunarHouseWitnesses.find(({ entry: { data } }) => {
          const matched = (data[field] as { matchedNatures?: string[] } | undefined)?.matchedNatures;
          return Array.isArray(matched) && matched.includes(nature);
        });
        if (witness) leoIds.add(witness.factId);
      }
    }
    for (const field of ['relocationDirections', 'attachmentDirections', 'speculationDirections',
      'serviceDirections', 'eighthOccultDirections', 'careerDirections', 'familyDirections', 'friendshipDirections', 'reflectionDirections']) {
      for (const nature of ['favourable', 'adverse']) {
        const topicalWitnesses = lunarHouseWitnesses.filter(({ entry: { data } }) => {
          const directions = data[field];
          return Array.isArray(directions) && directions.some(direction => direction.nature === nature);
        });
        const witness = topicalWitnesses.find(({ entry }) => !hasLunarNature(entry.data, nature)) ?? topicalWitnesses[0];
        keepLunarHouseWitness(witness);
      }
    }
    for (const [passage, target, nature] of [['p234', 'Jupiter', 'adverse'], ['p292', 'Venus', 'favourable']]) {
      const result = knowledge.byMethod.western.find(row => ['matched', 'partial'].includes(row.status)
        && row.knowledgeId.includes('-leo-1906-interpretation-' + passage + '-'));
      const factIds = new Set(result?.sourceFactIds);
      const witnesses = projected.filter(({ factId, entry }) => factIds.has(factId)
        || passage === 'p292' && entry.type === 'leo_lunar_condition' && entry.data.progressedBody === 'Sun'
        && entry.data.natalTargetId === 'Venus' && entry.data.aspectType === 'parallel');
      const lunar = witnesses.filter(({ entry: { data } }) => Array.isArray(data.lunarFavourableTargets)
        && data.lunarFavourableTargets.includes(target));
      const solarOrPlanetary = witnesses.filter(({ entry: { data } }) => Array.isArray(data.supportingDirections)
        && data.supportingDirections.some(direction => direction.nature === nature));
      const concurrent = solarOrPlanetary.find(fact => !lunar.includes(fact)) ?? solarOrPlanetary[0];
      for (const fact of [lunar[0], concurrent]) if (fact) leoIds.add(fact.factId);
    }
    for (const candidate of [directionSupport, lunarBridge, moonPosition, natalPremise, placement, otherMajor, classifiedMajor, concurrentMoon]) {
      if (candidate) leoIds.add(candidate.factId);
    }
    for (const scope of ['reviewed-directions', 'other-planet-pairs']) {
      const relevant = projected.filter(fact => fact.entry.type === 'leo_lunar_condition' && fact.entry.data.contraryScope === scope);
      for (const fact of relevant) if (priorityIds.has(fact.factId) && fact.entry.data.mutualExactInSlice === true) {
        leoIds.add(fact.factId);
      }
      const uncertain = relevant.find(({ entry: { data } }) => data.contraryReviewState !== 'adverse'
        && data.progressedOtherPlanetContraryReviewState !== 'adverse'
        && (data.contraryReviewState === 'unreviewed' || data.progressedOtherPlanetContraryReviewState === 'unreviewed'));
      if (uncertain) leoIds.add(uncertain.factId);
      const seen = new Set<string>();
      for (const fact of relevant) {
        const { contraryDirections, progressedOtherPlanetContraryDirections } = fact.entry.data;
        const signature = JSON.stringify([contraryDirections, progressedOtherPlanetContraryDirections]);
        if (seen.has(signature)) continue;
        seen.add(signature);
        leoIds.add(fact.factId);
      }
    }
    const lunarTopicSelections: Readonly<Record<string, {
      nature: 'favourable' | 'adverse'; fields: string[]; mercuryAspect?: readonly [string, string];
    }>> = {
      '080': { nature: 'favourable', fields: ['friendshipDirections'], mercuryAspect: ['Jupiter', 'sextile'] },
      '085': { nature: 'adverse', fields: ['correspondenceDirections', 'friendshipDirections'], mercuryAspect: ['Jupiter', 'opposition'] },
      '108': { nature: 'favourable', fields: ['studyDirections'], mercuryAspect: ['Saturn', 'semisextile'] },
      '112': { nature: 'favourable', fields: ['studyDirections', 'correspondenceDirections', 'speculationDirections'], mercuryAspect: ['Saturn', 'trine'] },
      '115': { nature: 'adverse', fields: ['studyDirections', 'correspondenceDirections', 'disputeDirections'], mercuryAspect: ['Saturn', 'opposition'] },
      '118': { nature: 'favourable', fields: ['metaphysicalDirections'], mercuryAspect: ['Uranus', 'semisextile'] },
      '122': { nature: 'favourable', fields: ['metaphysicalDirections', 'correspondenceDirections', 'speculationDirections'], mercuryAspect: ['Uranus', 'trine'] },
      '123': { nature: 'adverse', fields: ['correspondenceDirections', 'friendshipDirections', 'travelDirections', 'relocationDirections'] },
      '126': { nature: 'favourable', fields: ['travelDirections', 'relocationDirections'], mercuryAspect: ['Uranus', 'parallel'] },
      '127': { nature: 'favourable', fields: ['friendshipDirections'], mercuryAspect: ['Venus', 'conjunction'] },
      '129': { nature: 'adverse', fields: ['correspondenceDirections', 'friendshipDirections'] },
      '132': { nature: 'favourable', fields: ['friendshipDirections'], mercuryAspect: ['Venus', 'parallel'] },
      '286': { nature: 'favourable', fields: ['metaphysicalDirections', 'uranianMetaphysicalMutualDirections'] },
    };
    for (const item of knowledge.byMethod.western) {
      const passage = item.knowledgeId.match(/-leo-1906-interpretation-p(\d{3})-/u)?.[1];
      const topicSelection = passage && lunarTopicSelections[passage];
      const mercuryAspect = topicSelection && topicSelection.mercuryAspect;
      if (passage === '124') {
        const factIds = new Set(item.sourceFactIds);
        const witnesses = projected.filter(fact => fact.entry.type === 'leo_lunar_condition' && factIds.has(fact.factId));
        const exact = witnesses.find(({ entry }) => entry.data.mutualExactInSlice === true);
        const sequence = witnesses.find(({ entry }) => entry.data.adverseSequence);
        const natal = witnesses.find(({ entry }) => Array.isArray(entry.data.natalMercuryBroadStudyContacts)
          && entry.data.natalMercuryBroadStudyContacts.length > 0);
        if (exact) leoIds.add(exact.factId);
        if (sequence) leoIds.add(sequence.factId);
        if (natal) leoIds.add(natal.factId);
        continue;
      }
      if (passage && ['062', '084', '293'].includes(passage) && item.sourceFactIds.length) {
        const matchedIds = new Set(item.sourceFactIds);
        const witnesses = projected.filter(({ entry, factId }) => entry.type === 'leo_lunar_condition' && matchedIds.has(factId));
        const exact = witnesses.find(({ entry: { data } }) => data.mutualExactInSlice === true);
        if (exact) leoIds.add(exact.factId);
        if (passage === '293') for (const state of ['linked-support', 'lunar-support', 'indirect-candidate']) {
          const witness = witnesses.find(({ entry }) => entry.data.venusJupiterEffectState === state);
          if (witness) leoIds.add(witness.factId);
        }
        const witness = witnesses.find(({ entry: { data } }) => data.directionSupportState === 'favourable'
          && data.hasUnreviewedMutualMajorDirection === false && !data.lunarBridge
          && (passage !== '062' || data.sameLayerLunarState === 'all_favourable'));
        if (witness) leoIds.add(witness.factId);
      }
      if (item.status !== 'partial' && !mercuryAspect) continue;
      if (passage === '148') {
        const witnesses = directionCandidates.filter(fact => item.sourceFactIds.includes(fact.factId));
        for (const field of ['speculationDirections', 'friendshipDirections']) {
          for (const nature of ['favourable', 'adverse']) {
            const matches = witnesses.filter(({ entry: { data } }) => {
              const directions = data[field];
              return Array.isArray(directions) && directions.length > 0 && directions.every(direction => direction.nature === nature);
            });
            const witness = matches.find(({ entry }) => !['favourable', 'adverse'].includes(String(entry.data.directionSupportState))) ?? matches[0];
            if (witness) leoIds.add(witness.factId);
          }
        }
      }
      if (topicSelection) {
        const factIds = new Set(item.sourceFactIds);
        // Keep topical background in the local audit even in a year with a near aspect only.
        const witnesses = mercuryAspect ? projected.filter(({ entry: { data, type } }) =>
          type === 'leo_lunar_condition' && data.progressedBody === 'Mercury' && data.targetKind === 'natal'
          && data.natalTargetId === mercuryAspect[0] && data.aspectType === mercuryAspect[1])
          : directionCandidates.filter(fact => factIds.has(fact.factId));
        const general = witnesses.find(({ entry }) => entry.data.sameLayerLunarState === 'all_' + topicSelection.nature);
        if (general) leoIds.add(general.factId);
        for (const field of topicSelection.fields) {
          const topical = witnesses.filter(({ entry }) => {
            const directions = entry.data[field];
            return Array.isArray(directions) && directions.length > 0;
          });
          const natures = passage === '118' ? ['favourable', 'adverse'] : [topicSelection.nature];
          for (const nature of natures) {
            const witness = topical.find(({ entry }) =>
              (entry.data[field] as { nature: string }[]).every(direction => direction.nature === nature));
            if (witness) leoIds.add(witness.factId);
          }
          if (passage === '118' && topical[0]) leoIds.add(topical[0].factId);
        }
        continue;
      }
      if (passage === '165' || passage === '202') {
        const witness = directionCandidates.find(fact => item.sourceFactIds.includes(fact.factId)
          && (fact.entry.data.crossChartSupportState === 'favourable'
            || passage === '165' && fact.entry.data.crossChartSupportState === 'adverse'));
        if (witness) leoIds.add(witness.factId);
      }
      const prefersAdverseSupport = /^(057|059|281|295|301|310|327|330)$/u.test(passage ?? '');
      if (!prefersAdverseSupport && !/^(037|042|052|058|062|063|065|084|086|097|099|100|103|105|106|118|128|130|150|154|191|196|203|204|212|236|263|266|268|294|300|333)$/u.test(passage ?? '')) continue;
      const factIds = new Set(item.sourceFactIds);
      const witnesses = projected.filter(fact => factIds.has(fact.factId));
      const adverse = prefersAdverseSupport ? witnesses.find(fact => Array.isArray(fact.entry.data.supportingDirections)
        && fact.entry.data.supportingDirections.some(direction => direction.nature === 'adverse')) : undefined;
      const otherDirection = passage === '268' ? witnesses.find(fact => fact.entry.data.otherDirection) : undefined;
      const support = passage === '037' ? witnesses.find(fact => Array.isArray(fact.entry.data.supportingDirections)
        && fact.entry.data.supportingDirections.length > 0) : undefined;
      const candidate = adverse ?? otherDirection ?? support ?? witnesses[0];
      if (candidate) leoIds.add(candidate.factId);
    }
    for (const [passage, target] of [['p154', 'Jupiter'], ['p164', 'Mars']]) {
      const hit = matched.find(row => row.knowledgeId.includes('-leo-1906-interpretation-' + passage + '-'));
      if (!hit) continue;
      const positiveLayers = new Set(projected.filter(row => hit.sourceFactIds.includes(row.factId)).map(row => row.entry.data.targetKind));
      const witness = projected.find(({ entry: { data, type } }) => type === 'leo_lunar_condition'
        && data.progressedBody === 'Moon' && data.natalTargetId === target && data.aspectType === 'parallel'
        && positiveLayers.has(data.targetKind)
        && (target === 'Jupiter' ? data.hasCleanLunarJupiterSupport === true
          : data.directionSupportState === 'adverse' || data.directionSupportState === 'mixed'));
      if (witness) leoIds.add(witness.factId);
    }
    const addedDirectionEvidence = leoIds.size - priorLeoCount;
    const repeatKey = (fact: typeof projected[number]) => {
      const p = fact.entry.data.jupiterRepeat as { offset?: number; status?: string; natalLongitude?: number;
        passes?: { at: number }[] } | undefined;
      return JSON.stringify([fact.entry.data.natalTargetId, fact.entry.data.aspectType, p?.offset, p?.status,
        p?.natalLongitude, p?.passes?.map(row => row.at)]);
    };
    const repeatCandidates = projected.filter(f => f.entry.type === 'heindel_transit_context'
      && f.entry.data.repeatProfile === 'heindel-jupiter-station-bracketed-repeat-v1');
    const heindelIds = new Set(repeatCandidates.filter((fact, i) => i === repeatCandidates.findIndex(other => repeatKey(fact) === repeatKey(other)))
      .map(fact => fact.factId));
    const neptuneTransit = matched.find(row => row.knowledgeId.endsWith('-heindel-v1-neptune-p001-001'));
    for (const fact of projected.filter(row => neptuneTransit?.sourceFactIds.includes(row.factId))) heindelIds.add(fact.factId);
    const heindelProgression = projected.find(fact => fact.entry.type === 'heindel_progression_context');
    if (heindelProgression) heindelIds.add(heindelProgression.factId);
    const heindelDirections = projected.filter(({ entry }) => entry.type === 'heindel_direction_transit_overlap'
      && ['solar_band', 'exact_point', 'solar_lunation_activation', 'solar_lunar_direction_activation'].includes(String(entry.data.directionKind)));
    const solarComparison = heindelDirections.find(({ entry: { data } }) => data.progressedBody === 'Sun'
      && data.directionNature && data.natureRelation !== 'unclassified');
    if (solarComparison) heindelIds.add(solarComparison.factId);
    for (const relation of ['akin', 'different']) {
      const neptuneComparison = heindelDirections.find(({ entry: { data } }) => data.transitBody === 'Neptune' && data.natureRelation === relation);
      if (neptuneComparison) heindelIds.add(neptuneComparison.factId);
      const neptuneParallel = heindelDirections.find(({ entry: { data } }) => data.transitBody === 'Neptune'
        && data.directionAspectType === 'parallel' && data.natureRelation === relation);
      if (neptuneParallel) heindelIds.add(neptuneParallel.factId);
      const jupiterComparison = heindelDirections.find(({ entry: { data } }) => data.transitBody === 'Jupiter'
        && data.transitNature === 'mild_adverse' && data.natureRelation === relation);
      if (jupiterComparison) heindelIds.add(jupiterComparison.factId);
    }
    const fellowshipLunation = projected.find(({ entry }) => entry.type === 'heindel_direction_transit_overlap'
      && ['solar_fellowship_transit_lunation', 'solar_fellowship_transit_lunation_month'].includes(String(entry.data.directionKind)));
    if (fellowshipLunation) heindelIds.add(fellowshipLunation.factId);
    const lunarActivation = heindelDirections.find(({ entry }) => entry.data.directionKind === 'solar_lunation_activation')
      ?? heindelDirections.find(({ entry }) => entry.data.hasLunationActivation === true);
    if (lunarActivation) heindelIds.add(lunarActivation.factId);
    const progressedMoonActivation = heindelDirections.find(({ entry }) => entry.data.directionKind === 'solar_lunar_direction_activation');
    if (progressedMoonActivation) heindelIds.add(progressedMoonActivation.factId);
    for (const angle of ['ASC', 'MC']) {
      const overlaps = projected.filter(({ entry, factId }) => entry.type === 'heindel_direction_transit_overlap'
        && entry.data.directionKind === 'solar_angle_transit_overlap' && entry.data.natalTargetId === angle
        && (priorityIds.has(factId) || westernCandidateIds.has(factId)));
      const overlap = overlaps.find(({ entry }) => entry.data.exactSaturnPass !== true);
      const exactPass = overlaps.find(({ entry }) => entry.data.exactSaturnPass === true);
      if (overlap) representatives.add(overlap.factId);
      if (exactPass) representatives.add(exactPass.factId);
    }
    for (const sameMover of [false, true]) {
      const direction = heindelDirections.find(({ entry: { data } }) => (data.progressedBody === data.transitBody) === sameMover);
      if (direction) heindelIds.add(direction.factId);
    }
    const luminaryIds = new Set(projected.filter(f => f.entry.type === 'leo_jupiter_luminary_context').map(f => f.factId));
    const lillyIds = new Set(projected.filter(f => f.entry.type === 'lilly_return_context' || f.entry.type === 'lilly_return_seventh_context')
      .map(f => f.factId));
    const timing = projected.filter(fact => timingIds.has(fact.factId) && !representatives.has(fact.factId)
      && !progressionIds.has(fact.factId) && !heindelIds.has(fact.factId) && !ptolemyDiscordIds.has(fact.factId));
    const materialPrimary = timing.find(fact => fact.factId === fortuneWitness?.factId)
      ?? timing.find(({ entry }) => entry.type === 'ptolemy_ingress_contact' && entry.data.level === 'primary'
        && entry.data.sameAsNatalMaterialSignRuler === true);
    if (materialPrimary) timing.sort((a, b) => Number(b === materialPrimary) - Number(a === materialPrimary));
    return [...projected.filter(fact => representatives.has(fact.factId)),
      ...projected.filter(fact => yunConditionIds.has(fact.factId) && !representatives.has(fact.factId)),
      ...projected.filter(fact => lillyIds.has(fact.factId) && !representatives.has(fact.factId)),
      ...projected.filter(fact => luminaryIds.has(fact.factId) && !representatives.has(fact.factId)),
      ...projected.filter(fact => secondHouseIds.has(fact.factId) && !representatives.has(fact.factId)),
      ...projected.filter(fact => heindelIds.has(fact.factId) && !representatives.has(fact.factId)),
      ...projected.filter(fact => ptolemyDiscordIds.has(fact.factId) && !representatives.has(fact.factId)),
      ...projected.filter(fact => baziContextIds.has(fact.factId) && !representatives.has(fact.factId)),
      ...projected.filter(fact => sourceBaziIds.has(fact.factId) && !representatives.has(fact.factId)),
      ...projected.filter(fact => leoIds.has(fact.factId) && !representatives.has(fact.factId)),
      ...projected.filter(fact => progressionIds.has(fact.factId) && !representatives.has(fact.factId) && !leoIds.has(fact.factId) && !heindelIds.has(fact.factId)),
      ...projected.filter(fact => sourceIds.has(fact.factId) && !representatives.has(fact.factId) && !progressionIds.has(fact.factId)),
      ...projected.filter(fact => limitChapterIds.has(fact.factId) && !representatives.has(fact.factId)),
      ...projected.filter(fact => quanshuIds.has(fact.factId) && !representatives.has(fact.factId) && !limitChapterIds.has(fact.factId)),
      ...timing,
      ...projected.filter(fact => yunIds.has(fact.factId) && !representatives.has(fact.factId) && !yunConditionIds.has(fact.factId)),
      ...projected.filter(fact => !representatives.has(fact.factId) && !baziContextIds.has(fact.factId)
        && !progressionIds.has(fact.factId) && !sourceIds.has(fact.factId) && !sourceBaziIds.has(fact.factId)
        && !quanshuIds.has(fact.factId) && !timingIds.has(fact.factId) && !ptolemyDiscordIds.has(fact.factId)
        && !yunIds.has(fact.factId) && !yunConditionIds.has(fact.factId) && !leoIds.has(fact.factId) && !lillyIds.has(fact.factId) && !luminaryIds.has(fact.factId)
        && !secondHouseIds.has(fact.factId) && !heindelIds.has(fact.factId) && !limitChapterIds.has(fact.factId)
        && fact.entry.type !== 'quanshu_limit_star_timing' && fact.entry.type !== 'quanshu_timed_limit_condition'
        && !['school_exam_context', 'school_entry_context', 'fateclear_bazi_context', 'smth_seal_hurting_context', 'smth_officer_mix_context', 'quanshu_limit_chapter', 'quanshu_transform_limits', 'quanshu_limit_combinations', 'quanshu_annual_sha', 'quanshu_literary_limits', 'quanshu_limit_branches', 'quanshu_year_and_limits', 'quanshu_shangshi_limits', 'quanshu_kongjie_limits', 'quanshu_limit_verse_contacts', 'quanshu_solar_wu_po_limits', 'quanshu_xing_ji_tiger', 'quanshu_year_encounters', 'quanshu_doujun_year_month', 'quanshu_body_limit_encounters'].includes(fact.entry.type))]
      .slice(0, 24 + lillyIds.size + luminaryIds.size + secondHouseIds.size + heindelIds.size + sourceBaziIds.size
        + limitChapterIds.size + ptolemyDiscordIds.size + addedDirectionEvidence + addedAspectAudit + addedPrimaryTimingEvidence + addedPtolemyPhaseEvidence
        + Number(projected.some(fact => fact.entry.type === 'zpqz_officer_context'))
        + Number(projected.some(fact => fact.entry.type === 'zpqz_wealth_context'))
        + Number(projected.some(fact => fact.entry.type === 'zpqz_killer_order_context'))
        + Number(projected.some(fact => fact.entry.type === 'zpqz_food_killer_context'))
        + Number(projected.some(fact => fact.entry.type === 'zpqz_seal_food_context')))
      .map(fact => ({ ...fact, aliases: [...aliases].filter(([, original]) => original === fact.factId).map(([id]) => id) }));
  });
  const references = new Map(facts.map(({ factId }, index) => ['F' + (index + 1), factId]));
  const refsByFact = new Map([...references].map(([ref, factId]) => [factId, ref]));
  facts.forEach((fact, index) => fact.aliases.forEach(alias => refsByFact.set(alias, 'F' + (index + 1))));
  const events = buildFortuneEvents(run, permitted).flatMap(event => {
    const factRefs = [...new Set(event.factIds.flatMap(id => refsByFact.get(id) ?? []))];
    if (!factRefs.length) return [];
    return [{ ...event, factRefs }];
  });
  const eventRefs = new Map(events.map((event, index) => [event.eventId, 'E' + (index + 1)]));
  const factIdsBySection = new Map<FortuneGeneratedSection['sectionId'], string[]>();
  const sections = fortuneReportSections.map(section => {
    const sectionMatches = matched.filter(item => item.sectionId === section.id && item.sourceFactIds.length);
    factIdsBySection.set(section.id, [...new Set(sectionMatches.flatMap(match => match.sourceFactIds))]);
    const findings = sectionMatches.map(match => {
      const entry = getFortuneKnowledgeEntry(match.knowledgeId)!;
      let conditions = entry.conditions.normalized;
      if (entry.source.passage_id === 'quanshu-interpretation-expansion-p005') {
        conditions = ['本命父母宫的太阴在《全书》卷一所列的卯、辰、巳、午、未陷地。',
          '同一农历年的太岁与四飞白虎都守照该父母宫，分查同宫与三合。'];
      } else if (entry.source.passage_id === 'quanshu-interpretation-expansion-p012') {
        conditions = ['按南阳堂明刊，以出生年安本命天马和火星。两星实际同宫，且本年太岁实临该宫时，采用卷一战马条。'];
      } else if (entry.source.passage_id === 'quanshu-interpretation-expansion-p035') {
        conditions = ['本命擎羊实居辰或戌，实际大限和小限在同一农历年同时处于其正对宫。原文的程度须另结合命宫主曜，只取限中变动的提示。'];
      } else if (entry.source.passage_id === 'zpqz-1936-interpretation-p090') {
        conditions = ['同一已核大运符合原评沈路分或龚知县的逐案取法。沈例分核运支之印、水与运干合财、争财。龚例只取壬申、癸酉。'];
      } else if (entry.id === 'bazi-fortune-v1-year-general-smth-v2-volume-p273-001') {
        conditions = ['实际流年天干与本命日干或时干五合。甲日逢己岁、己日逢甲岁另按原书分别取义，其他轻重仍需另参。'];
      } else if (entry.source.passage_id === 'leo-1906-interpretation-p212') {
        conditions = ['次限月亮与本命或同图次限天王星实际形成梅花相。原文把同期方向和个人回应列为影响如何表现的条件。'];
      } else if (entry.source.passage_id === 'leo-1906-interpretation-p124') {
        conditions = ['次限水星与本命天王星形成梅花相。基础倾向可独立表达，较明显的作用限定于已核连续偏难月相的区间。原文所说的思路开阔属于个人条件。'];
      } else if (entry.source.passage_id === 'leo-1906-interpretation-p098') {
        const ids = new Set(match.sourceFactIds);
        const states = run.facts.filter(fact => ids.has(fact.factId)).map(fact =>
          fact.normalizedPayload as Record<string, unknown>);
        const sensitive = states.filter(state => ['mercury-and-neptune', 'mercury', 'neptune'].includes(String(state.mercuryNeptuneNatalSensitivityState)));
        conditions = [
          states.some(state => state.mutualExactInSlice === true)
            ? '有效段内核到次限水星对本命海王星的半六合成相点，可参考原文的轻微倾向。'
            : '次限水星与本命海王星处于已核半六合片段，可参考原文的轻微倾向。',
          sensitive.length ? '仅在已核水星或海王星本命指征的片段，可参考较明显的灵感或梦境。'
            : '本命敏感条件仍待核，本次采用基础倾向。',
          sensitive.some(state => state.mercuryNeptuneLunarSupportState === 'all_favourable')
            ? '只有本命指征与同段偏顺月亮助力齐备的片段，才提及可能更容易表达。'
            : '外在表达仍须同期月相有助，本次保留为条件。',
          ...(states.some(state => state.mercuryBehindNeptune === true)
            ? ['次限水星在黄道次序上落在本命海王星之前的片段，另有短暂表达不畅的可能。'] : []),
        ];
      } else if (['leo-1906-interpretation-p257', 'leo-1906-interpretation-p266'].includes(entry.source.passage_id)) {
        const matchingIds = new Set(match.sourceFactIds);
        const witnesses = run.facts.filter(fact => matchingIds.has(fact.factId));
        const qualified = witnesses.length > 0 && witnesses.every(fact =>
          (fact.normalizedPayload as Record<string, unknown>).solarNeptuneNatalEvidenceState === 'qualified');
        conditions = [
          entry.source.passage_id.endsWith('p257') ? '次限太阳对本命海王星的合相进入实际有效生日年。'
            : '次限太阳和本命海王星在原书规定的一度绝对赤纬差内，作为较长时间的背景。',
          qualified ? '本命相位与显著性均有已核依据，较明显的体验仍按个人条件表达。'
            : '本次只采用基础背景。较明显的体验须等本命条件核齐。',
        ];
      } else if (entry.source.passage_id === 'leo-1906-interpretation-p041') {
        const matchedIds = new Set(match.sourceFactIds);
        const hasAdverseWindow = run.facts.some(fact => {
          if (!matchedIds.has(fact.factId)) return false;
          const state = fact.normalizedPayload as Record<string, unknown>;
          return state.sameLayerLunarState === 'all_adverse'
            || state.sameLayerLunarState === 'mixed' && state.hasExactAdverseMoonToNatalEndpoint === true
            || state.progressedState === 'all_adverse' && state.hasExactAdverseMoonToProgressedEndpoint === true;
        });
        conditions = ['次限火星对本命木星形成四分，适用原文的基础倾向。', hasAdverseWindow
          ? '仅在已核同期偏难的片段限定加强读法。偏顺、混合或未定的其他片段保留各自条件。'
          : '本次采用基础倾向。较明显的压力仍以同期偏难月相为条件。'];
      } else if (entry.source.passage_id === 'leo-1906-interpretation-p059') {
        const ids = new Set(match.sourceFactIds);
        const states = run.facts.filter(fact => ids.has(fact.factId)).map(fact => fact.normalizedPayload as Record<string, unknown>);
        const linked = states.filter(state => state.pairLuminaryLinksComplete === true
          || Array.isArray(state.exactLunarLinkedBodies) && state.exactLunarLinkedBodies.length > 0
          || state.hasExactAdverseMoonToNatalEndpoint === true || state.hasExactAdverseMoonToProgressedEndpoint === true);
        const strengthened = linked.some(state => state.directionSupportState === 'adverse' || state.sameLayerLunarState === 'all_adverse'
          || state.hasExactAdverseMoonToNatalEndpoint === true || state.hasExactAdverseMoonToProgressedEndpoint === true);
        conditions = ['火土半刑属于原文的弱背景，无日月照应时只参考活动或冲动倾向。',
          strengthened ? '仅对照应与同期偏难条件均已核实的片段，才参考较明显的急躁或受阻。'
            : linked.length ? '部分片段核到日月照应，进一步放大仍以同期偏难推运为条件。'
              : '本次只采用弱背景。原文所述较明显表现保留为条件。'];
      } else if (entry.source.passage_id === 'leo-1906-interpretation-p293') {
        const ids = new Set(match.sourceFactIds);
        const effects = new Set(run.facts.filter(fact => ids.has(fact.factId)).map(fact =>
          (fact.normalizedPayload as Record<string, unknown>).venusJupiterEffectState));
        conditions = ['次限金星合本命木星的基础倾向较温和。'];
        if (effects.has('linked-support')) conditions.push('仅在有已核月亮连接的片段，才参考较直接的表现。');
        if (effects.has('lunar-support')) conditions.push('独立的偏顺月相只在所属片段提供进一步参考。');
        if (effects.has('indirect-candidate')) conditions.push('同期有偏顺方向而已核范围未见月亮连接的片段，可参考经由他人间接表现的可能。');
      } else if (['leo-1906-interpretation-p316', 'leo-1906-interpretation-p318'].includes(entry.source.passage_id)) {
        const matchedIds = new Set(match.sourceFactIds);
        const witnesses = run.facts.filter(fact => matchedIds.has(fact.factId));
        const clearThroughout = witnesses.length > 0 && witnesses.every(fact => {
          const data = fact.normalizedPayload as Record<string, unknown>;
          return data.contraryReviewState === 'clear' && data.progressedOtherPlanetContraryReviewState === 'clear';
        });
        const aspect = entry.source.passage_id.endsWith('p316') ? '六合相' : '三分相';
        conditions = ['次限金星与本命海王星实际形成' + aspect + '。', clearThroughout
          ? '两层在所核同期范围内均未见反向或待审，可有条件参考较强的满足感描述。'
          : '本次采用原文的基础倾向。较强的满足感描述须在相关反向条件已排清时才适用。'];
      }
      if (entry.source.passage_id === 'leo-v1-transit-p001') {
        const ids = new Set(match.sourceFactIds);
        const witnesses = run.facts.filter(fact => ids.has(fact.factId));
        const consistentPressure = witnesses.length > 0 && witnesses.every(fact => {
          const data = fact.normalizedPayload as Record<string, unknown>;
          return data.natalFinancialState === 'pressure' && data.financialDirectionState === 'adverse';
        });
        conditions = ['土星实际经过本命第二宫，行运仅作同期财务推运的辅助背景。', consistentPressure
          ? '本命财务压力与同期财务推运方向一致，可参考原文的资源收紧解释，结合实际收支判断。'
          : '审慎安排支出是原文给出的可选回应，实际收支依现实情况。'];
      }
      if (entry.source.passage_id === 'leo-1906-interpretation-p314') {
        const witness = run.facts.find(fact => match.sourceFactIds.includes(fact.factId));
        const data = witness?.normalizedPayload as Record<string, unknown> | null | undefined;
        const state = data?.natalVenusNeptuneAfflictionState;
        const descriptions: Record<string, string> = {
          adverse: '本命两星命中原书所列的直接不良相位，参考本命互克分支。',
          weak: '本命两星只核到较弱的梅花相，按原书保留为程度较轻的条件。',
          clear: '采用一般半六合段，本命两星未见所核的不良相位。',
          qualified: '本命两星命中需依星座条件判读的较弱关系，依原书保留条件解读。',
        };
        const premise = typeof state === 'string' ? descriptions[state] : undefined;
        if (premise) conditions = ['次限金星与本命海王星实际形成半六合。', premise];
      }
      // The compact local audit may omit facts that were used by the matcher.
      const factRefs = match.sourceFactIds.every(id => refsByFact.has(id))
        ? [...new Set(match.sourceFactIds.map(id => refsByFact.get(id)!))] : [];
      const reviewedMeaning = reviewedBranchMeanings[entry.source.passage_id];
      const excerpts = match.matchedSourceExcerpt?.split('\n');
      const note = reviewedMeaning && [reviewedMeaning.excerpt].flat().some(excerpt => excerpts?.includes(excerpt))
        ? reviewedMeaning.meaning : entry.interpretation.classical_meaning;
      return { method: match.method, knowledgeId: entry.id, title: entry.title,
        note, originalText: match.matchedSourceExcerpt ?? entry.evidence.original_text, source: entry.source,
        conditions: match.confirmedBranches ? [] : match.matchedConditions ?? conditions,
        ...(match.confirmedBranches ? { confirmedBranches: match.confirmedBranches.map(({ conditions, windows }) => ({ conditions, windows })) } : {}),
        uncertain: entry.conditions.uncertain,
        limitations: entry.interpretation.limitations, windows: match.windows, factRefs,
        evidenceGroup: [entry.source.author, entry.source.passage_id].join(':'),
        eventRefs: events.filter(event => event.factIds.some(id => match.sourceFactIds.includes(id)))
          .map(event => eventRefs.get(event.eventId)!) };
    });
    return { ...section, findings };
  });
  const input = { period: report.periodType, sections,
    window: { ...report.displayWindow, referenceAt: new Date(run.time.referenceAt).toISOString() },
    timelineVersion: fortuneEventVersion,
    events: events.map(({ eventId, factIds: _ids, ...event }) => ({ ref: eventRefs.get(eventId), ...event })),
    methods: Object.fromEntries(methods.map(method => [method, {
      status: run.methods[method].status, warnings: run.methods[method].warnings,
      knowledgeVersion: getFortuneKnowledgeVersion(method),
      matchedCount: knowledge.byMethod[method].filter(item => item.status === 'matched').length,
      incompleteConditions: knowledge.byMethod[method]
        .filter(item => item.status === 'partial' || item.status === 'unknown' || item.candidateWindows?.length)
        .map(item => ({
          knowledgeId: item.knowledgeId,
          status: item.candidateWindows ? 'partial' : item.status,
          unresolved: item.unresolvedConditions, missing: item.missingConditions,
          ...(item.candidateWindows ? { windows: item.candidateWindows } : {}),
        })),
    }])),
    facts: facts.map(({ entry }, index) => ({ ref: 'F' + (index + 1), ...entry })) };
  return { input, references, knowledge, factIdsBySection };
}

export function parseFortuneModelSections(value: unknown, factIdsBySection: ReadonlyMap<FortuneGeneratedSection['sectionId'], string[]>) {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 1) throw new Error('Invalid fortune report');
  const { sections } = value as { sections?: unknown };
  if (!Array.isArray(sections) || sections.length !== fortuneReportSections.length) throw new Error('Invalid fortune section count');
  const seen = new Set<string>();
  const validated = sections.map((entry): FortuneGeneratedSection => {
    if (!entry || typeof entry !== 'object' || Object.keys(entry).length !== 2) throw new Error('Invalid fortune section');
    const { sectionId, summary } = entry;
    if ((sectionId !== 'overall' && sectionId !== 'wealth' && sectionId !== 'romance') || seen.has(sectionId)
      || typeof summary !== 'string' || summary.trim().length < 12 || summary.length > maxReportSectionLength
      || !/\p{Script=Han}/u.test(summary) || /[<>]/u.test(summary) || unsafeLanguage.test(summary)) throw new Error('Invalid fortune section fields');
    seen.add(sectionId);
    return { sectionId, summary, factIds: factIdsBySection.get(sectionId) ?? [] };
  });
  return fortuneReportSections.map(({ id }) => validated.find(section => section.sectionId === id)!);
}

export function publishFortuneReport(report: FortuneInterpretationReport): FortunePublishedReport | undefined {
  if ((report.generationMode !== 'cloud_llm' && report.generationMode !== 'no_matching_knowledge')
    || !report.modelSections) return undefined;
  return {
    reportId: report.reportId, calculationRunId: report.calculationRunId, natalChartSnapshotId: report.natalChartSnapshotId,
    periodType: report.periodType, sections: report.modelSections.map(({ sectionId, summary }) => ({ sectionId, summary })),
  };
}
