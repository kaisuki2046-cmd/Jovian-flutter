import { existsSync, readFileSync } from 'node:fs';
import { branchInterpretation, claimEvidence, legacyEvidence } from './report-evidence.mjs';
import { LunarUtil } from 'lunar-javascript';
import { chartKeywords, chartVersions, normalizeFacts } from './catalog.mjs';
import { analyzeConfirmedBaZi, baziClaimFacts, baziDayMasterStrengthConsensus, calculatedClaimShenSha, genderedClaimShenSha, tenGodStrengthGroups, verifiedNatalShenSha } from './bazi-claim-facts.mjs';
import { baziShenShaPlacementFacts, baziShenShaPlacementProfile, compileBaziShenShaPlacementSource, baziShenShaPlacementPassages } from './bazi-shensha-placements.mjs';
import { compileQtbjSeasonalPassages, qtbjSeasonalPassageProfile } from './qtbj-seasonal-passages.mjs';
import { compileQtbjMetalWater, qtbjMetalWaterProfile } from './qtbj-metal-water-passages.mjs';
import { compileQtbjWoodFireEarth, qtbjWoodFireEarthProfile } from './qtbj-wood-fire-earth-passages.mjs';
import { isReviewedLillyComposite, isReviewedLillyFortune, isReviewedLillyHouseDignity, isReviewedLillyMarriageSigns, lillySourceGroupAlternatives } from './lilly-source-composites.mjs';
import { lillyAscendantRulerFacts, lillyFortune, lillyFortuneFacts, lillySharedRulerFacts } from './lilly-fortune.mjs';
import { lillyNodeFacts } from './lilly-nodes.mjs';
import { earthlyBranches, ziweiMajorStars as majorStars } from './dictionaries.mjs';
import { evaluateRule, normalizeRuleInput } from './matching.mjs';
import { reportTopics } from './topics.mjs';
import { compileWesternClaim, isWesternClaimMatch, usesLillyAspectTable, westernClaimCondition, westernClaimGroup, westernClaimConvention, westernClaimConditionAlternatives } from './western-claims.mjs';
import { lillyHouseFacts } from '../../control/lilly-houses.mjs';
import { lillyAspectFacts, lillyRulerHouseClassFacts } from './lilly-aspects.mjs';
import { lillyBookOneAspectFacts, lillyBookOneAspectsProfile, lillyBookOneAspectProof } from './lilly-book-one-aspects.mjs';
import { isLillyBookThreeOrdinaryRole, lillyBookThreeFacts, lillyBookThreeNeedsScores, lillyBookThreeRoleEvidence,
  lillyBookThreeRoleKind, lillyBookThreeRolesProfile } from './lilly-book-three-roles.mjs';
import { lillyDignityFacts } from './lilly-dignities.mjs';
import { lillyReceptionFacts } from './lilly-receptions.mjs';
import { lillyProfessionConditions, lillyProfessionFacts } from './lilly-profession.mjs';
import { consistentLillyProfessionSource, lillyProfessionSelectionProfile, lillyProfessionSourcesProfile,
  lillyProfessionDispositionProfile, lillyProfessionWitnessProfile } from './lilly-profession-sources.mjs';
import { consistentLillyPrefermentSource, lillyPrefermentConditions, lillyPrefermentExplanation,
  lillyPrefermentFacts, lillyPrefermentProfile } from './lilly-preferment.mjs';
import { lillySignClassFacts } from './lilly-sign-classes.mjs';
import { lillySolarFacts, lillyMotionFacts } from './lilly-solar-motion.mjs';
import { cardanoDignityFacts, cardanoDignityProfile } from './cardano-dignity.mjs';
import { lillyTravelFacts, lillyTravelProfile } from './lilly-travel.mjs';
import { lillySiblingsFacts, lillySiblingsProfile } from './lilly-siblings.mjs';
import { lillyWealthSourcesFacts, lillyWealthSourcesProfile } from './lilly-wealth-sources.mjs';
import { lillyWealthDurationFacts, lillyWealthDurationProfile } from './lilly-wealth-duration.mjs';
import { lillyWealthPrincipalFacts, lillyWealthPrincipalProof } from './lilly-wealth-principal.mjs';
import { lillyFortitudeRanges } from './lilly-fortitudes.mjs';
import { lillyWealthHistoryProof } from './lilly-wealth-history.mjs';
import { lillyFortuneWitnessFacts, lillyFortuneWitnessProfile, lillyFortuneWitnessProof } from './lilly-fortune-witnesses.mjs';
import { lillyChildrenFacts, lillyChildrenProfile } from './lilly-children.mjs';
import { lillyWitFacts, lillyWitProfile } from './lilly-wit.mjs';
import { lillyEnemiesFacts, lillyEnemiesProfile } from './lilly-enemies.mjs';
import { lillyFriendsFacts, lillyFriendsProfile } from './lilly-friends.mjs';
import { lillyNinthHouseFacts, lillyNinthHouseProfile, lillyNinthHouseReview } from './lilly-ninth-house.mjs';
import { compileLillyMannersSource, lillyMannersFacts, lillyMannersProfile, lillyMannersReview } from './lilly-manners.mjs';
import { compileLillyTemperamentSource, lillyTemperamentFacts, lillyTemperamentProfile, lillyTemperamentReview } from './lilly-temperament.mjs';
import { lillyMerchantCaseContext, lillyMerchantCaseNote, lillyMerchantCaseProfile, lillyMerchantComparison } from './lilly-merchant-case.mjs';
import { lillyParentDerivedFacts, lillyParentDerivedNote, lillyParentDerivedProfile } from './lilly-parent-derived-role.mjs';
import { lillyFamilyAphorismFact, lillyFamilyBirthBranchFact, lillyFamilyFacts, lillyFamilyProfile,
  lillyFamilyProof } from './lilly-family.mjs';
import { compileGuanceluNatal, guanceluNatalProfile } from './ziwei-guancelu.mjs';
import { compileGuanceluHistoricalCase, guanceluCaseNote, guanceluCaseProfile,
  supportsGuanceluCaseLookup } from './ziwei-guancelu-cases.mjs';
import { compileJielanGusui, jielanGusuiProfile } from './ziwei-jielan-gusui.mjs';
import { compileJielanNatalStars, jielanNatalStarProfile } from './ziwei-jielan-natal-stars.mjs';
import { ptolemyParentsFacts, ptolemyParentsProfile } from './ptolemy-parents.mjs';
import { ptolemyFortuneFacts, ptolemyFortuneProfile, ptolemyFortuneProof } from './ptolemy-fortune.mjs';
import { cardanoFortuneFacts, cardanoFortuneProfile, cardanoFortuneProof } from './cardano-fortune.mjs';
import { ptolemyBookOneFacts, ptolemyBookOneProfile, ptolemyBookOneProof, ptolemyBookOneRequiresDignities } from './ptolemy-book-one.mjs';
import { ptolemyFixedStarFacts, ptolemyFixedStarProfile, ptolemyFixedStarProof } from './ptolemy-fixed-stars.mjs';
import { ptolemySiblingFacts, ptolemySiblingProof, ptolemySiblingsProfile } from './ptolemy-siblings.mjs';
import { ptolemyTravelFacts, ptolemyTravelProfile, ptolemyTravelProof, ptolemyTravelRequiresDignities } from './ptolemy-travel.mjs';
import { compatibleZiweiRelativeFacts, hasZiweiRelativeSyntax } from './ziwei-relative-profile.mjs';
import { compileJielanPalacePassages, compileQuanshuPalaceText, jielanPalacePassageProfile, quanshuPalaceTextProfile,
  ziweiSourcePassageDisposition, ziweiSourcePassages, ziweiBirthGradeProfile } from './ziwei-source-passages.mjs';
import { compileZiweiSourceExclusions, ziweiSectorExclusionStars, ziweiSourceExclusionProfile } from './ziwei-source-exclusions.mjs';
import { compileZiweiSoloSources, ziweiSoloSectorExclusions, ziweiSoloSourceProfile } from './ziwei-solo-sources.mjs';
import { compileZiweiGusuiSources, ziweiGusuiProfile } from './ziwei-gusui-sources.mjs';
import { compileQuanshuTongyuan, quanshuTongyuanProfile } from './quanshu-tongyuan.mjs';
import { compileQuanshuZhuxingWenda, quanshuZhuxingWendaProfile } from './quanshu-zhuxing-wenda.mjs';
import { compatibleZiweiNatalPlacement, hasZiweiNatalPlacementSyntax, ziweiPalaceChangshengFacts } from './ziwei-natal-placement.mjs';
import { compatibleZiweiNatalMutagens, hasZiweiMutagenPlacementSyntax, ziweiMutagenSourceDisposition, ziweiMutagenSourceConditions, ziweiMutagenEditorialCondition, ziweiMutagenPlacementProfile } from './ziwei-mutagen-placement.mjs';
import { quanshuMinggongFacts, quanshuMinggongQualifier, quanshuMinggongRequirements, quanshuMinggongStar } from './quanshu-minggong.mjs';
import { compileQuanshuMinggongPassage, quanshuMinggongPassageProfile } from './quanshu-minggong-passages.mjs';
import { compileXingjueCareer, xingjueCareerProfile } from './xingjue-career.mjs';
import { compileXingjueChildren, xingjueChildrenProfile } from './xingjue-children.mjs';
import { compileXingjueEstate, xingjueEstateProfile } from './xingjue-estate.mjs';
import { compileXingjueFriends, xingjueFriendsProfile } from './xingjue-friends.mjs';
import { compileXingjueFude, xingjueFudeProfile } from './xingjue-fude.mjs';
import { compileXingjueHealth, xingjueHealthProfile } from './xingjue-health.mjs';
import { compileXingjueFemale, xingjueFemaleProfile } from './xingjue-female.mjs';
import { compileXingjueLifeBody, xingjueLifeBodyProfile } from './xingjue-life-body.mjs';
import { compileXingjueMigration, xingjueMigrationProfile } from './xingjue-migration.mjs';
import { compileXingjuePalaceConfiguration, xingjuePalaceConfigurationChapter, xingjuePalaceConfigurationProfile } from './xingjue-palace-configurations.mjs';
import { compileXingjuePalacePatterns, xingjuePalacePatternsProfile } from './xingjue-palace-patterns.mjs';
import { compileXingjueNatalStars, xingjueNatalStarsChapter, xingjueNatalStarsProfile } from './xingjue-natal-stars.mjs';
import { compileXingjueParents, xingjueParentsProfile } from './xingjue-parents.mjs';
import { compileXingjueSamePalace, xingjueSamePalaceProfile } from './xingjue-same-palace.mjs';
import { compileXingjueSiblings, xingjueSiblingsProfile } from './xingjue-siblings.mjs';
import { compileXingjueSpouse, xingjueSpouseConfigurationProfile, xingjueSpouseProfile } from './xingjue-spouse.mjs';
import { compileXingjueTianji, xingjueTianjiProfile } from './xingjue-tianji.mjs';
import { compileXingjueWealth, xingjueWealthProfile } from './xingjue-wealth.mjs';
import { compileZiweiChangshengSource, ziweiChangshengSourceProfile } from './ziwei-changsheng-sources.mjs';
import { claimPassageCategories, claimPassages } from './claim-passages.mjs';
import { claimReviewNotes, sourcePrerequisiteReview } from './claim-review-notes.mjs';
import { daozangChartFacts, daozangPassages } from './daozang-claims.mjs';
import { ziweiGradeFacts, ziweiLifeBodyClash } from './ziwei-grade-facts.mjs';
import { baziHistoricalCaseProfile, claimContextText, isClaimContext, compileBaziHistoricalCase, compileBaziMachineMatch,
  isHistoricalClaimCompiler, reviewedBaziCaseCitation } from './claim-compat.mjs';
import { zodiacNames as zodiacNamesForClaims } from '../../control/charts.ts';
import { createClaimSqliteStore, claimSourceDirectory } from './claims-sqlite.mjs';
import { join } from 'node:path';
import { legacySourceIds, writeLegacyCatalog } from './legacy-catalog.mjs';
import { compileReportKnowledge } from './report-knowledge-source.mjs';
import { baziLiteralConditions, compatibleBaZiLiteralFacts } from './bazi-literal-conditions.mjs';
import { baziDecadalPassageProfile, compileBaZiDecadalPassage } from './bazi-decadal-passages.mjs';
import { compileDtsjyReviewedPassage } from './bazi-dtsjy-passages.mjs';
import { confirmedBaZiDecadalPeriods, selectBaZiDecadalPeriods } from './bazi-decadal-periods.mjs';
import { baziClassicalStructureProfile, compileBaziClassicalStructures } from './bazi-classical-structures.mjs';
import { blindPalaceProfile, compileBlindPalace, confirmedBlindPalacePlacement } from './bazi-blind-palace.mjs';
import { compileShenfengReviewed, shenfengReviewedProfile } from './bazi-shenfeng-reviewed.mjs';
import { compileYuanhaiNatalPassages, yuanhaiNatalPassagesProfile } from './yuanhai-natal-passages.mjs';
import { compileZpzqCases, zpzqCaseProfile } from './zpzq-natal-cases.mjs';
import { baziLiteralPassages, baziLiteralPassageProfile, baziVisibleHiddenGodsProfile, baziLiteralSourceConditions,
  baziLiteralPassageDisposition, baziEqualColumnsPassageProfile, compileBaZiEqualColumnsPassage,
  compileShenfengNatalPassage, qtbjTermProfile, qtbjWoodPassageProfile } from './bazi-literal-passages.mjs';

const methods = ['bazi', 'ziwei', 'western'];
// User declined this rule because its alternative definition could not be sourced.
// Keep the original Claim for traceability, without compiling any matching branches.
const skippedClaims = new Set(['ziwei-v1-c017-p101004-001']);
// These newly recognised word forms cannot be realised by the current
// brightness/placement profile. Keep their original wording for source review.
const ziweiBrightnessReviewClaims = new Set([
  'ziwei-v2-c011-p101004-001', 'ziwei-v2-guanlugong-p101026-001', 'ziwei-v4-jielan-176-p001-001',
  'ziwei-v3-xingjue-051-p1431-001',
]);
const ziweiPlacementReviewClaims = new Set(['ziwei-v2-c005-p101007-003', 'ziwei-v2-c005-p101007-004', 'ziwei-v2-guanlugong-p004-001']);
const ziweiGradeSource = {
  book: '紫微斗数精成', locator: '人生品位的判定、斗数五行论命与星曜附表',
  url: 'https://vr-d.com/pdf-file/紫微斗数/紫微斗数精成_大德山人.pdf',
};
const mappingSources = new Map([
  ['smth-v9-liuri-10-09-p012-001', { book: '三命通会 · 六癸日申时断', locator: '四库、辛丑、蒋本、万历本癸未日条；《古今图书集成》卷619 · 酉申年月和亥卯附句',
    url: 'https://zh.wikisource.org/wiki/欽定古今圖書集成/博物彙編/藝術典/第619卷' }],
  ['ziwei-v3-c020-p109008-001', { book: '中州派紫微斗数深造讲义', locator: '事业宫 · 武曲贪狼会铃、武曲化科，可任财经职务；《全书》卷三天梁条的栋梁分句',
    url: 'https://vr-d.com/pdf-file/紫微斗数/中州派紫微斗数深造讲义_全_王亭之.pdf' }],
  ['ziwei-v3-c020-p119012-001', { book: '中州派紫微斗数深造讲义', locator: '夫妻宫 · 寅申贪狼与福德七杀会桃花；六十星系 · 贪狼行日月同垣运见日月之一化忌',
    url: 'https://vr-d.com/pdf-file/紫微斗数/中州派紫微斗数深造讲义_全_王亭之.pdf' }],
  ['smth-v6-uniform-p002-004', { book: '三命通会', locator: '卷六 · 一气生成 · 同段四己巳列例及歌诀「巳巳全逢」',
    url: 'https://www.shidianguji.com/zh/book/SK1610/chapter/1me0ciglb8lxc' }],
  ['smth-v9-liuri-06-11-p008-101', { book: '钦定古今图书集成', locator: '艺术典第616卷 · 六己日戌时断 · 己卯日甲戌时 · 未酉丑月火土运附句',
    url: 'https://zh.wikisource.org/wiki/欽定古今圖書集成/博物彙編/藝術典/第616卷' }],
  ['ziwei-v2-jielan-077-p001-004', { book: '紫微斗数捷览', locator: '命坐墓库制化论「余仿此」与斗数彀率破军败地；王亭之《深造讲义》卯酉廉破守财及见火铃的破耗',
    url: 'https://shixingji.club/public/ziweidoushujielan' }],
  ['ziwei-v1-c011-p118000-002', { book: '王亭之谈星', locator: '贪狼篇引同章商贾诗，天机篇补释本命与流盘；参校《康节说易》卷一的煞忌条件',
    url: 'https://www.xuanmen.com.cn/archives/1113.html' }],
  ['ziwei-v1-c011-p119000-001', { book: '王亭之谈星', locator: '天机 · 陆斌兆释原局贪狼在身与机梁月会照；王亭之补注为贪狼守身者行天机运',
    url: 'https://www.xuanmen.com.cn/archives/1107.html' }],
  ['ziwei-v3-c020-p129011-001', { book: '王亭之谈星', locator: '贪狼 · 贪狼、机月同梁格局及煞曜同躔；天机篇补注本命贪狼守身、流盘天机守命',
    url: 'https://www.xuanmen.com.cn/archives/1113.html' }],
  ['ziwei-v3-c020-p131003-001', { book: '紫微斗数精成', locator: '大德山人 · 诸星落命宫参断 · 廉贞 · 廉贞在陷地、行限逢巨门一支',
    url: 'https://vr-d.com/pdf-file/紫微斗数/紫微斗数精成_大德山人.pdf' }],
  ['ziwei-v1-zhuxing-wenda-p122000-003', { book: '中州派紫微斗数深造讲义', locator: '王亭之 · 贪狼 · 大运流年枢纽 · 贪狼原命与太阳巨门交并化忌之运',
    url: 'https://vr-d.com/pdf-file/紫微斗数/中州派紫微斗数深造讲义_全_王亭之.pdf' }],
  ['ziwei-v3-c020-p113006-001', { book: '中州派紫微斗数深造讲义', locator: '福德宫 · 天机天梁同度而天机化忌 · 易失眠',
    url: 'https://vr-d.com/pdf-file/紫微斗数/中州派紫微斗数深造讲义_全_王亭之.pdf' }],
  ['smth-v8-liuri-03-01-p012-001', { book: '子平真诠评注', locator: '论十干得时不旺失时不弱 · 重根与比印；《三命通会》卷八 · 丙辰日戊子时',
    url: 'https://luckclub.cn/bazi/002/008/' }],
  ['ziwei-v2-jielan-077-p001-002', { book: '王亭之紫微斗数评注', locator: '太阳 · 辰宫独坐、太阴对照，主名利双收',
    url: 'https://ziwei.yi958.com/zwds/3443/' }],
  ['smth-v8-liuri-05-08-p015-001', { book: '钦定古今图书集成', locator: '艺术典第615卷 · 六戊日己未时断 · 「巳酉伤官」与己酉、己巳例',
    url: 'https://zh.wikisource.org/wiki/Page%3AGujin_Tushu_Jicheng%2C_Volume_471_%281700-1725%29.djvu/113' }],
  ['ziwei-v1-c011-p118000-001', { book: '王亭之谈紫微斗数', locator: '巨门吉凶，在于才学有无 · 巨日坐命做事光明磊落',
    url: 'https://www.guoxuedashi.com/a/22543smzn/284974g.html' }],
  ['ziwei-v1-c012-p101009-001', { book: '紫微斗数全书', locator: '卷二 · 六疾厄 · 廉贞遇贪狼同度落陷；周德元《命理天机》贪狼同廉贞遇火星',
    url: 'https://zh.wikisource.org/zh-hans/紫微斗數全書/卷二#六疾厄' }],
  ['smth-v7-temperament-p007-012', { book: '三命通会', locator: '卷十 · 看命口诀 · 以劫财败财作下格的一例',
    url: 'https://zh.wikisource.org/wiki/三命通會_(四庫全書本)/卷10' }],
  ['smth-v7-female-discourse-p056-001', { book: '三命通会', locator: '卷七 · 论阴命 · 禄马贵人、自生自旺、六合主性巧',
    url: 'https://www.shidianguji.com/book/NGJ89241199902970167139/chapter/1lvorfox7ld12' }],
  ['ziwei-v3-daozang-001-p132-001', { book: '紫微斗数（续道藏本）', locator: '卷三 · 天杖「会凶星……多杖责」；卷一 · 十官禄宫 · 天贯受冲及天哭',
    url: 'https://zh.wikisource.org/zh-hant/紫微斗數' }],
  ['ziwei-v1-dedi-hege-p101007-001', { book: '王亭之紫微斗数评注', locator: '太阳 · 午宫日丽中天会禄；《捷览》定富局金灿光辉',
    url: 'https://ziwei.yi958.com/zwds/3443/' }],
  ['ziwei-v1-dedi-hege-p101009-001', { book: '紫微斗数全书', locator: '卷三 · 论诸星同垣 · 紫府同守寅申及辅弼拱照',
    url: 'https://www.mczwl.cn/guji/ziwei/zw-topic-26' }],
  ['smth-v12-gold-voice-p094-101', { book: '三命通会', locator: '卷十二 · 金声玉振赋 · 僧道段末引古歌，三合及华盖并临墓',
    url: 'https://zh.wikisource.org/wiki/三命通會_(四庫全書本)/卷12' }],
  ['ziwei-v2-minggong-p117002-001', { book: '紫微斗数全书', locator: '卷一 · 太微赋「太阳会文昌于官禄」；卷二 · 官禄宫「太阳入庙文武为良」',
    url: 'https://zh.wikisource.org/wiki/紫微斗數全書/全覽' }],
  ['smth-v8-liuri-02-05-p010-101', { book: '三命通会', locator: '卷三 · 孤鸾寡鹄煞 · 乙巳日的妻缘分句；卷八六乙日辰时断原句',
    url: 'https://zh.wikisource.org/wiki/三命通會_(四庫全書本)/卷03' }],
  ['smth-v9-liuri-10-12-p009-101', { book: '三命通会', locator: '卷九 · 六癸日癸亥时断 · 癸卯日辰戌与卯刑',
    url: 'https://www.chenshupaipan.com/books/2/1658.html' }],
  ['smth-v3-spirits-p020-001', { book: '五行精纪', locator: '卷二十三 · 浮沉杀 · 「却从命宫数」异文',
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/fb/CNTS-00047981911_4_五行精紀.pdf#page=156' }],
  ['ziwei-v1-xingxing-p101023-001', { book: '紫微斗数全书', locator: '卷二 · 论父母诀 · 廉贞与破军同度，再加羊陀等煞',
    url: 'https://m.gushiwen.cn/guwen/bookv_cc7daded1566.aspx' }],
  ['ziwei-v1-c008-p101027-001', { book: '增补太微赋（魁钺运星注）', locator: '断桥截路、卯酉二空 · 卯酉二时出生之注',
    url: 'https://www.kystars.net/sciences/140' }],
  ...['ziwei-v2-jielan-077-p001-001', 'ziwei-v2-jielan-077-p001-003'].map((id) => [id, {
    book: '紫微斗数全书', locator: '卷三 · 天府 · 天府武曲居财宅、有左右禄存亦美；与捷览命坐墓库制化论对读',
    url: 'https://zh.wikisource.org/wiki/紫微斗數全書/卷三',
  }]),
  ['ziwei-v1-zhuxing-wenda-p137000-001', { book: '王亭之谈星', locator: '文昌文曲 · 天梁见昌曲主聪明；捷览卷四以亥卯未为旺',
    url: 'https://www.shenpowang.com/ziwei/wangtingzhi/d244944.html' }],
  ...[
    ['ziwei-v2-minggong-p222004-001', '武曲 · 武曲相遇昌曲逢'],
    ['ziwei-v1-c011-p130000-001', '天机 · 机梁守命加刑忌；羽客僧流'],
    ['ziwei-v3-c020-p164007-001', '命有吉星官杀重及邻句凶多吉少'],
  ].map(([id, locator]) => [id, { book: '紫微斗数全书', locator: '卷三 · 论诸星同垣 · ' + locator,
    url: 'https://zh.wikisource.org/wiki/紫微斗數全書/卷三' }]),
  ['ziwei-v1-shixian-poge-p101009-001', { book: '命理天机·紫微斗数规则的运用与分析', locator: '周德元 · 亥宫廉贪同陷的泛水桃花；王亭之注太微赋 · 泛水桃花的漂泊取象',
    url: 'https://vr-d.com/pdf-file/紫微斗数/命理天机_紫微斗数规则的运用与分析_周德元著.pdf' }],
  ['ziwei-v3-jielan-120-p001-002', { book: '紫微斗数捷览', locator: '卷三 · 斗数赋性成形论 · 地劫地空逢四库；卷一安星诀',
    url: 'https://www.tianjihq.com/en/learn/books/ziwei-jielan/120' }],
  ...[
    ['ziwei-v1-daozang-270-p273-001', '卷一 · 四田宅宫 · 哭与库贯；卷二 · 定诸宫分合 · 库贯临身命'],
    ['ziwei-v2-daozang-009-p107-001', '卷二 · 骨肉三局赋；卷三 · 天福星庙旺位'],
    ['ziwei-v2-daozang-009-p109-001', '卷一 · 财帛宫 · 天贯主横财；卷二 · 天虚旺丑'],
    ['ziwei-v2-daozang-113-p113-001', '卷二 · 定诸宫分合 · 福寿鸾；卷三 · 天福星庙旺位'],
    ['ziwei-v3-daozang-001-p055-002', '卷三 · 天异星 · 善星加之主庶出；天福庙旺位'],
    ['ziwei-v3-daozang-001-p092-001', '卷一 · 官禄宫 · 印绶、文昌；卷三 · 文昌旺午'],
  ].map(([id, locator]) => [id, { book: '紫微斗数（续道藏本）', locator,
    url: 'https://zh.wikisource.org/zh/紫微斗數' }]),
  ['smth-v9-liuri-08-01-p018-101', { book: '五行精纪', locator: '卷十 · 释日时贵格 · 神白经辛酉日戊子时金化火',
    url: 'https://changxianyi.com/guji/wuxing-jingji/text-20261002-063/page-017/' }],
  ['smth-v4-season-wood-p008-002', { book: '三命通会', locator: '卷四 · 论木 · 初秋水盛无土；论五行时地分野吉凶 · 干支本气与古分野',
    url: 'https://zh.wikisource.org/wiki/三命通會_(四庫全書本)/卷04' }],
  ['ziwei-v3-c020-p102021-001', { book: '紫微斗数捷览', locator: '卷三 · 定富贵贫贱一十四等诀 · 吏曹 · 紫府并杀曜异文',
    url: 'https://www.tianjihq.com/en/learn/books/ziwei-jielan/133' }],
  ['ziwei-v1-c011-p147000-001', { book: '紫微斗数捷览', locator: '卷三 · 定富贵贫贱一十四等诀 · 贫贱 · 廉贪俱会合异文',
    url: 'https://www.tianjihq.com/en/learn/books/ziwei-jielan/133' }],
  ['ziwei-v1-shixian-poge-p101008-001', { book: '紫微斗数捷览', locator: '卷三 · 十二宫诸星失陷破格诀 · 戌上紫微文昌逢',
    url: 'https://www.tianjihq.com/en/learn/books/ziwei-jielan/126' }],
  ['ziwei-v1-zhuxing-wenda-p170000-001', { book: '紫微斗数捷览', locator: '卷三 · 斗数玄微论 · 身命羊陀、七杀；卷四 · 羊陀火铃四星总论',
    url: 'https://www.tianjihq.com/en/learn/books/ziwei-jielan/118' }],
  ['smth-v8-liuri-05-12-p020-101', { book: '三命通会', locator: '卷六 · 化气十段锦 · 戊从癸合，分别见乙、丁、庚；卷八 · 六戊日癸亥时断',
    url: 'https://zh.wikisource.org/wiki/三命通會_(四庫全書本)/全覽' }],
  ['smth-v3-void-p003-004', { book: '三命通会', locator: '卷三 · 论空亡、论三奇、论学堂词馆；卷六 · 夹贵夹禄',
    url: 'https://zh.wikisource.org/wiki/三命通會_(四庫全書本)/全覽' }],
  ['smth-v3-palaces-meng-p047-001', { book: '三命通会', locator: '卷三 · 论十二宫 · 破宅煞 · 乙酉癸未庚寅甲申女命原例',
    url: 'https://zh.wikisource.org/wiki/三命通會_(四庫全書本)/卷03' }],
  ['ziwei-v1-daozang-270-p270-001', { book: '紫微斗数（续道藏本）', locator: '卷一 · 四田宅宫；卷三 · 天异星 · 田宅宫单星断',
    url: 'https://zh.wikisource.org/zh/紫微斗數#紫微斗數卷之一' }],
  ['ziwei-v1-zhuxing-wenda-p157000-002', { book: '紫微斗数全书', locator: '卷二 · 化忌 · 权禄与忌同宫又兼煞空',
    url: 'https://zh.wikisource.org/zh-hans/紫微斗数全书/全览' }],
  ['ziwei-v1-c012-p101002-001', { book: '新锓希夷陈先生紫微斗数全书', locator: '卷五 · 武破相遇昌曲逢；武曲与天相同垣之异本释法',
    url: 'https://www.shidianguji.com/ens/book/SDZJ0170/chapter/1jvzop58rvdbm' }],
  ['smth-v9-liuri-06-02-p005-001', { book: '三命通会', locator: '卷五 · 时上一位贵 · 时杀独透、身强有制',
    url: 'https://zh.wikisource.org/zh-hans/三命通會_(四庫全書本)/卷05' }],
  ['smth-v8-liuri-03-06-p007-001', { book: '三命通会', locator: '卷八 · 六丙日癸巳时断 · 癸官在时，另论柱中所见',
    url: 'https://zh.wikisource.org/wiki/三命通會_(四庫全書本)/卷08' }],
  ['ziwei-v1-c012-p101006-001', { book: '紫微斗数全书', locator: '卷一 · 定富贵贫贱十等论 · 刑名论；卷二命宫 · 破军会武曲、权禄',
    url: 'https://zh.wikisource.org/zh/紫微斗數全書/卷二' }],
  ['ziwei-v1-c012-p101007-001', { book: '紫微格局', locator: '三台山三清灵学院 · 君臣庆会 · 紫微守命，府相和昌曲来会，无煞加吉化',
    url: 'https://sanqing.com.tw/en/the-chinese-astrology-chart012/' }],
  ['ziwei-v1-c012-p101008-001', { book: '紫微斗数全书', locator: '卷三 · 论人命入格、论格星数高下 · 陷地加凶杀化忌又会空劫',
    url: 'https://docs.iztro.com/learn/ancientBook-3' }],
  ['smth-v9-liuri-10-02-p005-001', { book: '三命通会', locator: '卷六 · 丑遥巳禄 · 癸丑喜冬、得申或酉来合',
    url: 'https://www.shidianguji.com/zh/book/SK1610/chapter/1kf5v7g660w09' }],
  ['ziwei-v3-c020-p117002-001', { book: '紫微斗数全书', locator: '卷三 · 财宅 · 财帛宫分别取武曲或太阴；禄存守财宅',
    url: 'https://zh.wikisource.org/zh/紫微斗數全書/卷三' }],
  ['smth-v2-general-star-p002-001', { book: '三命通会', locator: '卷六 · 夹贵夹禄 · 酉亥夹戌、卯巳夹辰',
    url: 'https://www.chinese-classics.org/read/shushu/mingli/san-ming-tong-hui/006' }],
  ['ziwei-v2-daozang-153-p383-002', { book: '紫微斗数（续道藏本）', locator: '卷二 · 洞微十八星断 · 天库星 · 是宫主财',
    url: 'https://www.shidianguji.com/zh/book/DZ1485/chapter/DZ1485_10' }],
  ['smth-v7-female-discourse-p089-001', { book: '三命通会', locator: '卷十 · 四面宣明 · 甲乙临寅卯为青龙',
    url: 'https://www.shidianguji.com/zh/book/NGJ89241199902970167139/chapter/1lvorgdb6ll3a' }],
  ['smth-v12-heart-mirror-p037-101', { book: '三命通会', locator: '卷三 · 论十干禄 · 甲禄寅、丑为向；卷五 · 论正官 · 向禄临财',
    url: 'https://www.shidianguji.com/book/NGJ89241199902970167139/chapter/1lvorewczyu5y' }],
  ['ziwei-v1-dedi-hege-p101001-001', { book: '易经研究系列著作集之紫微斗数类', locator: '太阴篇 · 同阴在子 · 癸生加左右',
    url: 'https://vr-d.com/pdf-file/紫微斗数/易经研究系列著作集之紫微斗数类.pdf' }],
  ['ziwei-v1-c011-p125000-001', { book: '紫微斗数全书', locator: '卷一 · 论人命有无艺术者 · 天府只居迁移位',
    url: 'https://www.scribd.com/document/764961388/斗数全书-简体版-word2007' }],
  ['ziwei-v1-shixian-poge-p101003-001', { book: '紫微斗数全书', locator: '十二宫诸星失陷破格诀 · 卯辰安命 · 太阳擎羊异文',
    url: 'https://vr-d.com/pdf-file/紫微斗数/康节说易_紫微斗数.pdf' }],
  ['ziwei-v1-shixian-poge-p005-001', { book: '王亭之谈星', locator: '巨门 · 子午巨门 · 石中隐玉及煞曜破格',
    url: 'https://download.s21i.co99.net/12045409/0/1/ABUIABA9GAAg_f_ssAYok7yS6gE.pdf' }],
  ...['ziwei-v1-dedi-hege-p101004-001', 'ziwei-v1-c010-p101068-001'].map((id) => [id, {
    book: '中州派紫微斗数深造讲义', locator: '卯酉天机巨门 · 化禄与火铃；王亭之《谈斗数》巨机同临',
    url: 'https://vr-d.com/pdf-file/紫微斗数/易经研究系列著作集之紫微斗数类.pdf',
  }]),
  ['ziwei-v1-zhuxing-wenda-p127000-003', { book: '王亭之谈星', locator: '天梁 · 空耗煞曜同度；中州安星法 · 亥年杂曜大耗在辰',
    url: 'https://www.xuanmen.com.cn/archives/1115.html' }],
  ['ziwei-v2-jielan-077-p001-005', { book: '紫微斗数捷览', locator: '卷二 · 命坐墓库制化论 · 余仿此',
    url: 'https://tianjihq.com/en/learn/books/ziwei-jielan/77' }],
  ['smth-v4-isolated-wealth-p003-001', { book: '三命通会', locator: '卷四 · 禄鬼孤害；卷六 · 金神三时',
    url: 'https://www.chinese-classics.org/read/shushu/mingli/san-ming-tong-hui/006' }],
  ['ziwei-v1-c007-p101013-001', { book: '紫微斗数全书', locator: '卷一 · 太微赋 · 忌暗同居身命疾厄',
    url: 'https://zh.wikisource.org/zh-hant/紫微斗數全書/卷一' }],
  ['ziwei-v1-zhuxing-wenda-p145000-001', { book: '王亭之谈星', locator: '天魁天钺 · 分守命宫、夫妻身宫',
    url: 'https://www.scribd.com/document/961879778/王亭之谈星' }],
  ['smth-v8-liuri-05-07-p004-101', { book: '三命通会', locator: '卷一 · 论火 · 金得火和则能鎔鑄',
    url: 'https://zh.wikisource.org/wiki/三命通會/卷一' }],
  ['smth-v12-true-treasure-p061-101', { book: '三命通会', locator: '卷六 · 金白水清；卷十二 · 金白水清被枭害',
    url: 'https://www.chinese-classics.org/read/shushu/mingli/san-ming-tong-hui/006' }],
  ...['smth-v9-liuri-07-12-p026-101', 'smth-v8-liuri-01-10-p018-101'].map((id) => [id, {
    book: '三命通会', locator: '卷六 · 三奇真贵 · 地支暗藏财官印',
    url: 'https://www.chinese-classics.org/read/shushu/mingli/san-ming-tong-hui/006',
  }]),
  ...[
    ['ziwei-v3-c020-p123001-001', '紫云 · 二曲同度、左右相逢'],
    ['ziwei-v3-c020-p125005-001', '紫云 · 昌曲入命逢陷弱和煞曜'],
  ].map(([id, locator]) => [id, { book: '紫云星情之昌曲', locator, url: 'https://www.scribd.com/document/864295548/紫云星情之昌曲' }]),
  ['ziwei-v3-daozang-001-p237-001', { book: '斗数四书·八喜楼钞本古诀与斗数格局', locator: '王亭之评注 · 天姚 · 子宫落陷',
    url: 'https://www.scribd.com/document/1043918902/斗数四书-八喜楼钞本古诀与斗数格局' }],
  ...[
    ['ziwei-v1-zhuxing-wenda-p122000-002', '王亭之 · 中州派紫微斗数深造讲义 · 贪狼守命、破军守身'],
    ['ziwei-v3-c020-p131004-001', '王亭之 · 中州派紫微斗数深造讲义 · 寅申廉贞 · 文曲迁移异文'],
  ].map(([id, locator]) => [id, { book: '易经研究系列著作集之紫微斗数类', locator,
    url: 'https://vr-d.com/pdf-file/紫微斗数/易经研究系列著作集之紫微斗数类.pdf' }]),
  ['ziwei-v1-dedi-hege-p010-001', { book: '紫微斗数捷览', locator: '卷三 · 斗数骨髓赋注解 · 巨日分守巳亥',
    url: 'https://www.tianjihq.com/zh-TW/learn/books/ziwei-jielan/123' }],
  ['ziwei-v1-c005-p101003-002', { book: '紫微随笔·亨集', locator: '钟义明 · 斗数准绳论新解',
    url: 'https://vr-d.com/pdf-file/紫微斗数/紫微随笔_亨集.pdf' }],
  ['ziwei-v1-c012-p101001-001', { book: '紫微斗数捷览', locator: '卷二 · 辨十二宫诸星庙陷诀 · 寅宫',
    url: 'https://tool.shixingji.club/library/ziweidoushujielan' }],
  ['ziwei-v1-shixian-poge-p101006-001', { book: '紫微斗数讲义·星曜性质', locator: '王亭之 · 巨门星 · 丑未同巨',
    url: 'https://vr-d.com/pdf-file/紫微斗数/紫微斗数讲羲3_星曜性质_王亭之.pdf' }],
  ['ziwei-v1-shixian-poge-p101001-001', { book: '紫微斗数捷览', locator: '卷二 · 辨十二宫诸星庙陷诀',
    url: 'https://tool.shixingji.club/library/ziweidoushujielan' }],
  ['ziwei-v3-c020-p139003-001', { book: '紫微斗数全书', locator: '卷一 · 女命骨髓赋 · 论定人驼背',
    url: 'https://zh.wikisource.org/zh-hant/紫微斗數全書/卷一' }],
  ['smth-v7-female-discourse-p109-001', { book: '三命通会', locator: '卷五 · 官煞去留并官鬼互变杂论',
    url: 'https://www.shidianguji.com/book/SK1610/chapter/1kf5v79f6hmwi' }],
  ['smth-v9-liuri-06-09-p018-101', { book: '三命通会', locator: '卷九 · 六己日壬申时断 · 刻本戊己辰戌',
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/23/NLC416-13jh000156-94145_三命通會.pdf' }],
  ['ziwei-v3-c005-p101001-001', { book: '紫微斗数捷览', locator: '卷一 · 安生年太岁十二神诀',
    url: 'https://www.tianjihq.com/en/learn/books/ziwei-jielan/49' }],
  ['ziwei-v1-c019-p101007-001', { book: '紫微斗数全书', locator: '卷一 · 诸星问答论 · 问紫微所主若何',
    url: 'https://zh.wikisource.org/zh-hant/紫微斗數全書/卷一' }],
  ['ziwei-v3-c020-p105005-001', { book: '紫微斗数捷览', locator: '卷三 · 定贵局 · 君臣庆会',
    url: 'https://tool.shixingji.club/library/ziweidoushujielan' }],
  ['ziwei-v1-c018-p101007-001', { book: '紫微斗数捷览', locator: '卷三 · 定贵局 · 财印夹禄',
    url: 'https://tool.shixingji.club/library/ziweidoushujielan' }],
  ...[
    ['ziwei-v1-c011-p127000-001', '卷三 · 论诸星同垣各司所宜分别富贵贫贱夭寿 · 紫微'],
    ['ziwei-v3-c020-p102009-001', '卷三 · 论诸星同垣各司所宜分别富贵贫贱夭寿 · 天府'],
  ].map(([id, locator]) => [id, { book: '紫微斗数全书', locator, url: 'https://zh.wikisource.org/zh-hant/紫微斗數全書/卷三' }]),
  ['ziwei-v2-guanlugong-p004-001', { book: '紫微斗数全书', locator: '卷二 · 一命宫 · 武曲',
    url: 'https://zh.wikisource.org/zh-hant/紫微斗數全書/卷二' }],
  ['ziwei-v1-c010-p101072-001', { book: '紫微斗数全书', locator: '卷二 · 一命宫 · 擎羊入男命诀',
    url: 'https://zh.wikisource.org/zh-hant/紫微斗數全書/卷二' }],
  ...[106, 107, 108, 110, 111, 112, 114, 115, 116].map((passage) => [`ziwei-v3-c003-p${passage}000-001`, ziweiGradeSource]),
  ['ziwei-v3-c020-p102002-001', { book: '新锓希夷陈先生紫微斗数全书', locator: '论仰面朝斗格',
    url: 'https://www.shidianguji.com/zh/mid-page/7356346222820573234' }],
  ['ziwei-v3-c020-p111002-001', { book: '紫微斗数新诠', locator: '天同星 · 马头带箭（慧心斋主）',
    url: 'https://vr-d.com/pdf-file/紫微斗数/紫微斗数新诠_慧心斋主.pdf' }],
  ['ziwei-v2-minggong-p319003-001', { book: '紫微斗数全书', locator: '卷三 · 论诸星同垣各司所宜分别富贵贫贱夭寿 · 天同',
    url: 'https://zh.wikisource.org/zh-hans/紫微斗數全書/卷三' }],
  ['ziwei-v1-c006-p101013-001', ziweiGradeSource],
  ['ziwei-v3-c020-p102008-001', { book: '紫微斗数捷览', locator: '卷三 · 斗数骨髓赋注解',
    url: 'https://www.tianjihq.com/en/learn/books/ziwei-jielan/123' }],
  ['ziwei-v1-c010-p101012-002', { book: '紫微斗数全书', locator: '卷三 · 论诸星同垣各司所宜分别富贵贫贱夭寿',
    url: 'https://zh.wikisource.org/zh-hans/紫微斗數全書/卷三' }],
  ['ziwei-v2-minggong-p304002-001', { book: '紫微斗数精要', locator: '潘子渔 · 化权概说',
    url: 'https://vr-d.com/pdf-file/紫微斗数/紫微斗数精要-潘子渔.pdf' }],
  ['ziwei-v3-c020-p109001-001', { book: '紫微斗数捷览', locator: '卷三 · 女命骨髓赋',
    url: 'https://tool.shixingji.club/library/ziweidoushujielan' }],
  ['ziwei-v1-c011-p101003-001', { book: '新锓希夷陈先生紫微斗数全书', locator: '卷之五 · 紫微',
    url: 'https://www.shidianguji.com/zh/book/SDZJ0170/chapter/1jvzop58rvdbm' }],
]);
const positions = { 年: 'year', 月: 'month', 日: 'day', 时: 'hour' };
const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = earthlyBranches.join('');
const stemBranch = '[' + stems + '][' + branches + ']';
const seasons = { 春: '寅卯辰', 夏: '巳午未', 秋: '申酉戌', 冬: '亥子丑' };
const monthElements = { 木: '寅卯', 火: '巳午', 土: '辰戌丑未', 金: '申酉', 水: '亥子' };
const positionNames = ['year', 'month', 'day', 'hour'];
const monthsNumerals = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const tenGods = '比肩|劫财|食神|伤官|偏财|正财|偏印|正印|七杀|正官|偏官|七煞';
const pairedGods = { 财: ['正财', '偏财'], 官: ['正官'], 印: ['正印', '偏印'], 煞: ['七杀'],
  官杀: ['正官', '七杀'], 财星: ['正财', '偏财'], 印绶: ['正印', '偏印'] };
const nayinNames = [...new Set(Object.values(LunarUtil.NAYIN).filter((name) => /[木火土金水]$/u.test(name)))];
const opposition = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
const dayHourPunishments = ['子卯', '寅巳', '巳申', '申寅', '丑戌', '戌未', '未丑', '辰辰', '午午', '酉酉', '亥亥'];
const harmPairs = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'];
const combinations = ['甲己', '乙庚', '丙辛', '丁壬', '戊癸'];
const transformations = { 甲己: '土', 乙庚: '金', 丙辛: '水', 丁壬: '木', 戊癸: '火' };
const baziStructures = ['食伤生财', '伤官生财', '官印相生', '杀印相生', '财官相生', '伤官见官', '官杀混杂', '财星破印', '枭印夺食', '食神制杀', '印绶护身'];
const explicitNatalOfficerOccurrence = claim => claim.conditions.normalized.some(text => /^(?:[男女]命)?(?:原局|本命原有)伤官见官$/u.test(text));
const baziPatternNames = ['建禄', '正官格', '七杀格', '偏印格', '正印格', '正财格', '偏财格', '伤官格', '食神格'];
const verifiedBaziKinds = ['day_master_strength', 'bazi_ten_god_structure', 'bazi_branch_relation', 'bazi_stem_transformation',
  'bazi_day_stem_transformation',
  'bazi_ten_god_count', 'bazi_stem_placement_count',
  'bazi_month_pattern', 'bazi_nayin_phase', 'bazi_ten_god_strength', 'bazi_stem_combination', 'bazi_element_balance',
  'bazi_day_master_season', 'bazi_own_stem_phase', 'bazi_hidden_god_phase', 'bazi_natal_configuration', 'bazi_natal_element', 'bazi_nayin_school'];
const verifiedBaziFact = ({ kind, name }) => verifiedBaziKinds.includes(kind) || (kind === 'shen_sha' && calculatedClaimShenSha.includes(name));
const branchRelationTypes = ['六合', '六冲', '六害', '相破', '相刑', '自刑', '三刑', '三合'];
const kuiGangPillars = ['庚辰', '壬辰', '戊戌', '庚戌'];
const dayVirtuePillars = ['甲寅', '丙辰', '戊辰', '庚辰', '壬戌'];

const palaceAliases = {
  命: '命宫', 命宫: '命宫', 兄弟: '兄弟', 夫妻: '夫妻', 妻妾: '夫妻', 子女: '子女', 子息: '子女', 男女: '子女',
  财帛: '财帛', 疾厄: '疾厄', 迁移: '迁移', 仆役: '仆役', 奴仆: '仆役', 交友: '仆役',
  官禄: '官禄', 田宅: '田宅', 福德: '福德', 父母: '父母',
  妻宫: '夫妻', 财宫: '财帛', 疾宫: '疾厄', 迁宫: '迁移', 官宫: '官禄', 福宫: '福德',
};
const palaces = [...new Set(Object.values(palaceAliases))];
const sectorExclusionStars = [...ziweiSectorExclusionStars, ...ziweiSoloSectorExclusions, '天刑', '天马'];
const coreStars = new Set([...majorStars, ...'左辅 右弼 文昌 文曲 天魁 天钺 禄存 擎羊 陀罗 火星 铃星 地空 地劫 天马'.split(' ')]);
const stars = [...coreStars, ...('天刑 天姚 红鸾 天喜 天空 空亡 旬空 天哭 天虚 恩光 天贵 三台 八座 龙池 凤阁 台辅 '
  + '封诰 天才 天寿 天官 天福 天巫 天月 天使 解神 阴煞').split(' ')];
const starAliases = { 昌曲: ['文昌', '文曲'], 辅弼: ['左辅', '右弼'], 魁钺: ['天魁', '天钺'], 日月: ['太阳', '太阴'],
  左右: ['左辅', '右弼'], 羊陀: ['擎羊', '陀罗'], 火铃: ['火星', '铃星'], 紫府: ['紫微', '天府'], 帝星紫微: ['紫微'] };
const beneficStars = [...starAliases.辅弼, ...starAliases.昌曲, ...starAliases.魁钺];
const maleficStars = [...starAliases.羊陀, ...starAliases.火铃];
const starToken = new RegExp(stars.concat(Object.keys(starAliases)).join('|'), 'gu');
// Match complete known names before a placement verb. A lazy arbitrary prefix
// can split 天同守 into 天 + 同守 and silently lose the entire condition.
const starNameWord = '(?:' + stars.concat(Object.keys(starAliases)).sort((a, b) => b.length - a.length).join('|') + ')';
const starNameList = starNameWord + '(?:[、与和及]?' + starNameWord + ')*';
const branchGuardPattern = new RegExp('^(' + starNameList + ')(独守|单守|同守|守)([子丑寅卯辰巳午未申酉戌亥](?:位)?(?:[、或][子丑寅卯辰巳午未申酉戌亥](?:位)?)*)(命|.+?宫)$', 'u');
const branchSet = new RegExp('^[' + branches + ']+$', 'u');

function godFacts(god, position, kinds) {
  return kinds.flatMap((kind) => (pairedGods[god] ?? [god]).map((tenGod) => ({ kind, position, tenGod })));
}

function baziBranchRelation(relation, first, second) {
  const ordered = [first, second].sort((a, b) => positionNames.indexOf(a) - positionNames.indexOf(b));
  return { kind: 'bazi_branch_relation', relation, first: ordered[0], second: ordered[1] };
}

function baziAtom(value) {
  const token = value.match(new RegExp('^([' + stems + ']?[' + branches + ']|[' + stems + '])([年月日时])$', 'u'));
  if (!token) return null;
  const [, name, unit] = token;
  const position = positions[unit];
  if (name.length === 2 && stems.indexOf(name[0]) % 2 !== branches.indexOf(name[1]) % 2) return null;
  if (name.length === 2) return { kind: 'pillar', position, ganZhi: name };
  if (stems.includes(name)) return { kind: 'stem', position, stem: name };
  return { kind: 'branch', position, branch: name };
}

function classicalRegion(value) {
  const match = /^古分野为([豫冀扬徐雍])$/u.exec(value);
  return match ? [[{ kind: 'natal_classical_region', zone: match[1] }]] : null;
}

function baziClause(value, hasDayHour = false) {
  value = value.replace(/^且(?=日主)/u, '');
  value = value.replace(/^(?:生于|生在|另生)(?=[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥春夏秋冬]+月$)/u, '');
  value = value.replace(/^生(?=[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]+月$)/u, '');
  const atom = baziAtom(value);
  if (atom) return [[atom]];
  if (value === '月令受到冲击') return baziClause('原局月支受冲');
  if (value === '原局年柱克日干') {
    const groups = ['甲乙', '丙丁', '戊己', '庚辛', '壬癸'];
    return groups.flatMap((group, index) => [...group].flatMap(year => [...groups[(index + 2) % 5]]
      .map(day => [baziAtom(year + '年'), baziAtom(day + '日')])));
  }
  if (value === '按本篇取癸酉、己巳、乙丑时的金神') return ['癸酉', '己巳', '乙丑'].map(pillar => [baziAtom(pillar + '时')]);
  const columnOfficerSeal = /^(?:原局)?(?:([年月])柱带官星与印绶|([年月])上带官星和印绶)$/u.exec(value);
  if (columnOfficerSeal) {
    const position = positions[columnOfficerSeal[1] ?? columnOfficerSeal[2]];
    return godFacts('官', position, ['stem_ten_god', 'branch_ten_god']).flatMap(officer =>
      godFacts('印', position, ['stem_ten_god', 'branch_ten_god']).map(seal => [officer, seal]))
      .filter(facts => compatibleBaZiLiteralFacts(facts));
  }
  const monthDay = value.match(/^([子丑寅卯辰巳午未申酉戌亥])月([甲乙丙丁戊己庚辛壬癸])日$/u);
  const dayMonth = value.match(/^([甲乙丙丁戊己庚辛壬癸])日([子丑寅卯辰巳午未申酉戌亥])月$/u);
  if (monthDay || dayMonth) {
    const month = monthDay?.[1] ?? dayMonth[2];
    const day = monthDay?.[2] ?? dayMonth[1];
    return [[baziAtom(month + '月'), baziAtom(day + '日')]];
  }
  const namedMonthDay = /^([子丑寅卯辰巳午未申酉戌亥、或]+)月([甲乙丙丁戊己庚辛壬癸])(?:日|([木火土金水]))$/u.exec(value);
  const stemElement = stem => '木木火火土土金金水水'[stems.indexOf(stem)];
  if (namedMonthDay && (!namedMonthDay[3] || stemElement(namedMonthDay[2]) === namedMonthDay[3])) {
    return [...new Set(namedMonthDay[1].replace(/[、或]/gu, ''))].map(branch => [baziAtom(branch + '月'), baziAtom(namedMonthDay[2] + '日')]);
  }
  const seasonDay = /^([春夏秋冬])(?:令|月)([甲乙丙丁戊己庚辛壬癸])(?:日|([木火土金水]))$/u.exec(value);
  if (seasonDay && (!seasonDay[3] || stemElement(seasonDay[2]) === seasonDay[3])) {
    return [...seasons[seasonDay[1]]].map(branch => [baziAtom(branch + '月'), baziAtom(seasonDay[2] + '日')]);
  }
  const elementDaySeason = /^([木火土金水])日([春夏秋冬])生$/u.exec(value);
  if (elementDaySeason) return [...stems].filter(stem => stemElement(stem) === elementDaySeason[1])
    .flatMap(stem => [...seasons[elementDaySeason[2]]].map(branch => [baziAtom(branch + '月'), baziAtom(stem + '日')]));
  if (value === '天月二德具备') return positionNames.flatMap(first => positionNames.map(second => [
    { kind: 'shen_sha', position: first, name: '天德' }, { kind: 'shen_sha', position: second, name: '月德' },
  ]));
  const bothVisible = value.match(/^([甲乙丙丁戊己庚辛壬癸])(?:与|、)?([甲乙丙丁戊己庚辛壬癸])(?:同透|两透|并透)$/u);
  if (bothVisible && bothVisible[1] !== bothVisible[2]) return ['year', 'month', 'hour'].flatMap(first =>
    ['year', 'month', 'hour'].filter(second => first !== second).map(second => [
      { kind: 'stem', position: first, stem: bothVisible[1] },
      { kind: 'stem', position: second, stem: bothVisible[2] },
    ]));
  const hiddenStem = /^([甲乙丙丁戊己庚辛壬癸])藏支$/u.exec(value);
  if (hiddenStem) return positionNames.flatMap(position => [...branches]
    .filter(branch => LunarUtil.ZHI_HIDE_GAN[branch].includes(hiddenStem[1]))
    .map(branch => [{ kind: 'branch', position, branch }]));
  const shownStem = /^([甲乙丙丁戊己庚辛壬癸])透干$/u.exec(value);
  if (shownStem) return ['year', 'month', 'hour'].map(position => [{ kind: 'stem', position, stem: shownStem[1] }]);
  if (/^[甲乙丙丁戊己庚辛壬癸]藏支、[甲乙丙丁戊己庚辛壬癸]透干$/u.test(value)) {
    const [hidden, shown] = value.split('、').map(clause => baziClause(clause));
    return hidden.flatMap(first => shown.map(second => [...first, ...second]));
  }
  if (/^[男女]命$/u.test(value)) return [[{ kind: 'natal_gender', gender: value[0] }]];
  if (/^[昼夜]生$/u.test(value)) return [[{ kind: 'natal_daylight', sect: value[0] === '昼' ? 'day' : 'night' }]];
  if (value === '节月上旬') return [[{ kind: 'bazi_solar_month_xun', band: 'early' }]];
  if (value === '寅月雨水后') return [[baziAtom('寅月'), { kind: 'bazi_previous_qi', term: '雨水' }]];
  if (value === '酉月秋分后') return [[baziAtom('酉月'), { kind: 'bazi_previous_qi', term: '秋分' }]];
  if (value === '冬月冬至后') return [['子', '冬至'], ['丑', '冬至'], ['丑', '大寒']]
    .map(([month, term]) => [baziAtom(month + '月'), { kind: 'bazi_previous_qi', term }]);
  const region = classicalRegion(value);
  if (region) return region;
  if (['禄命身三财齐', '日主支援四至六成', '禄马贵人俱见且有六合', '原局六害多见', '四柱纳音三金一木',
    '日时互换禄', '金火相停', '木盛金繁', '五虎遁天乙入庙', '年干禄前二辰见金舆', '德秀无冲破克', '日时德秀俱见', '年马克月支', '四干各临天乙贵支',
    '年纳音乘月旺且胜日纳音', '日纳音乘时旺且胜年纳音', '四支恰一支本气为土', '年日同纳音五行且见本家正印',
    '宅位年旬空且逢年劫煞', '田位本气旺相且逢年天乙', '田位落年旬空', '原局冲岁前宅位且宅不扶日纳音',
    '日坐年纳音之财且入生旺', '时支乘金生旺', '时支乘水生旺', '四干各两金两木', '四干四纳音各两金两木', '金木相停', '年干月干及年月藏干无火土',
    '月日时成局而年柱孤立', '食伤聚而日主无依', '金土乘月令秀气', '火木乘月令秀气', '水木乘月令秀气',
    '年柱干支纳音俱得月令旺相', '至少两处驿马临日主生旺', '驿马临日主生旺或官星生旺',
    '年月财官败绝空亡而日时得生旺',
    '日主与所透财官俱无根且逢刑冲',
    '年日禄后同支逢空孤',
    '水火相停', '时支临年旬六虚', '浮沉煞落财帛宫', '浮沉煞落田宅宫',
    '生年纳音日坐长生且驿马一冲一合', '同一干争合且见年支咸池', '地支本气同类且四柱纳音比和', '月胎禄马贵而日时不见'].includes(value)) {
    return [[{ kind: 'bazi_natal_configuration', name: value }]];
  }
  if (value === '原局见地支六合') return positionNames.flatMap((first, index) => positionNames.slice(index + 1)
    .map((second) => [baziBranchRelation('六合', first, second)]));
  if (['原局日时相冲', '原局日、时对冲'].includes(value)) {
    return [[baziBranchRelation('六冲', 'day', 'hour')]];
  }
  if (value === '原局月支受冲') return ['year', 'day', 'hour']
    .map(position => [baziBranchRelation('六冲', 'month', position)]);
  if (value === '地支相生六合') return positionNames.flatMap((first, index) => positionNames.slice(index + 1)
    .flatMap((second) => ['寅亥', '辰酉', '午未'].flatMap(([a, b]) => [[a, b], [b, a]].map(([left, right]) => [
      { kind: 'branch', position: first, branch: left }, { kind: 'branch', position: second, branch: right },
      baziBranchRelation('六合', first, second),
    ]))));
  if (value === '同干六冲') return positionNames.flatMap((first, index) => positionNames.slice(index + 1)
    .flatMap((second) => [...stems].map((stem) => [
      { kind: 'stem', position: first, stem }, { kind: 'stem', position: second, stem },
      baziBranchRelation('六冲', first, second),
    ])));
  if (value === '年干克月干') {
    const stemGroups = ['甲乙', '丙丁', '戊己', '庚辛', '壬癸'];
    return stemGroups.flatMap((group, index) => [...group].flatMap((year) =>
      [...stemGroups[(index + 2) % stemGroups.length]].map((month) => [baziAtom(year + '年'), baziAtom(month + '月')])));
  }
  const branchRepetition = value.match(/^四支([子丑寅卯辰巳午未申酉戌亥]+)至少三见$/u);
  if (branchRepetition) return positionNames.flatMap((omitted) => positionNames.filter((position) => position !== omitted)
    .reduce((groups, position) => groups.flatMap((group) => [...branchRepetition[1]].map((branch) =>
      [...group, { kind: 'branch', position, branch }])), [[]]));
  const branchPair = value.match(/^四支([子丑寅卯辰巳午未申酉戌亥])至少两见$/u);
  if (branchPair) return positionNames.flatMap((first, index) => positionNames.slice(index + 1)
    .map((second) => [first, second].map((position) => ({ kind: 'branch', position, branch: branchPair[1] }))));
  const stemRepetition = value.match(/^四干([甲乙丙丁戊己庚辛壬癸])至少三见$/u);
  if (stemRepetition) return positionNames.map((omitted) => positionNames.filter((position) => position !== omitted)
    .map((position) => ({ kind: 'stem', position, stem: stemRepetition[1] })));
  if (value === '按昼夜取日贵') return [['癸卯', 'day'], ['丁亥', 'day'], ['癸巳', 'night'], ['丁酉', 'night']]
    .map(([ganZhi, sect]) => [baziAtom(ganZhi + '日'), { kind: 'natal_daylight', sect }]);
  if (value === '日德叠见') return dayVirtuePillars.flatMap((day) => ['year', 'month', 'hour'].flatMap((position) =>
    dayVirtuePillars.map((ganZhi) => [baziAtom(day + '日'), { kind: 'pillar', position, ganZhi }])));
  const bothInvariant = value.match(/^年月纯([子丑寅卯辰巳午未申酉戌亥])$/u);
  if (bothInvariant) return [[baziAtom(bothInvariant[1] + '年'), baziAtom(bothInvariant[1] + '月')]];
  if (['正官与七杀混杂', '官煞混杂'].includes(value)) value = '官杀混杂';
  if (['原局伤官见官', '本命原有伤官见官'].includes(value)) {
    const occurrences = tenGod => positionNames.flatMap(position => godFacts(tenGod, position,
      position === 'day' ? ['branch_ten_god'] : ['stem_ten_god', 'branch_ten_god']));
    return occurrences('伤官').flatMap(first => occurrences('正官').map(second => [first, second]))
      .filter(facts => compatibleBaZiLiteralFacts(facts));
  }
  if (baziStructures.includes(value)) return [[{ kind: 'bazi_ten_god_structure', name: value }]];
  const pattern = value.match(/^(?:月令(?:成|为)?|按原文(?:成|为|作)|依原文成)?(.+格)$/u)?.[1];
  const normalizedPattern = pattern === '偏官格' ? '七杀格' : pattern;
  if (baziPatternNames.includes(normalizedPattern)) return [[{ kind: 'bazi_month_pattern', name: normalizedPattern, result: '见配合' }]];
  const singleGod = value.match(/^(?:四柱|原局)(?:只有|仅有|仅)?(正官|七杀|伤官|食神|正印|偏印|正财|偏财|财星|印星|印绶|比肩|劫财|比劫|官杀)(一|两|二|三|四)位$/u);
  if (singleGod) return [[{ kind: 'bazi_ten_god_count', tenGod: singleGod[1] === '印绶' ? '印星' : singleGod[1],
    count: ({ 一: 1, 两: 2, 二: 2, 三: 3, 四: 4 })[singleGod[2]] }]];
  if (value === '日干见五合') return [['year', 'day'], ['month', 'day'], ['day', 'hour']]
    .map(([first, second]) => [{ kind: 'bazi_stem_combination', first, second }]);
  const stemLink = value.match(/^([年月日时])([年月日时])干五合$/u);
  if (stemLink && stemLink[1] !== stemLink[2]) {
    const [first, second] = positionNames.filter((position) => position === positions[stemLink[1]] || position === positions[stemLink[2]]);
    return [[{ kind: 'bazi_stem_combination', first, second }]];
  }
  if (value === '日支受刑') return ['year', 'month', 'hour'].flatMap((position) => ['相刑', '三刑', '自刑']
    .map((relation) => [baziBranchRelation(relation, 'day', position)]));
  const exactStemUnion = value.match(/^([甲乙丙丁戊己庚辛壬癸])([甲乙丙丁戊己庚辛壬癸])见天干五合$/u);
  if (exactStemUnion && exactStemUnion[1] !== exactStemUnion[2]
    && combinations.some((pair) => pair.includes(exactStemUnion[1]) && pair.includes(exactStemUnion[2]))) {
    const [, a, b] = exactStemUnion;
    return positionNames.flatMap((first, index) => positionNames.slice(index + 1).flatMap((second) =>
      [[a, b], [b, a]].map(([left, right]) => [
        { kind: 'stem', position: first, stem: left }, { kind: 'stem', position: second, stem: right },
        { kind: 'bazi_stem_combination', first, second },
      ])));
  }
  const literalTransformation = value.match(/^([甲乙丙丁戊己庚辛壬癸]{2})(?:合)?化([木火土金水])$/u);
  if (literalTransformation) {
    const pair = literalTransformation[1];
    const reverse = [...pair].reverse().join('');
    if ((transformations[pair] ?? transformations[reverse]) === literalTransformation[2]) {
      return [pair, reverse].map((pair) => [{ kind: 'bazi_stem_transformation', pair, element: literalTransformation[2] }]);
    }
  }
  const positionLink = value.match(/^([年月日时])(?:支)?(?:与)?([年月日时])(?:支)?(六合|六冲|六害|相破|相刑|自刑|互换空亡)$/u);
  const dayHourPunishment = hasDayHour && /^(?:日时|时日)相刑$/u.test(value);
  if (positionLink && positionLink[1] !== positionLink[2] && !dayHourPunishment) {
    return [[baziBranchRelation(positionLink[3], positions[positionLink[1]], positions[positionLink[2]])]];
  }
  if (/^(?:年支|年)冲月令$/u.test(value)) return [[baziBranchRelation('六冲', 'year', 'month')]];
  if (value === '同两柱干合支刑') {
    return positionNames.flatMap((first, index) => positionNames.slice(index + 1).flatMap((second) => combinations.flatMap(([a, b]) =>
      [[a, b], [b, a]].map(([left, right]) => [
        { kind: 'stem', position: first, stem: left }, { kind: 'stem', position: second, stem: right },
        baziBranchRelation('相刑', first, second),
      ]))));
  }
  const pair = value.match(new RegExp('^(' + stemBranch + '|[' + stems + branches + '])日('
    + stemBranch + '|[' + stems + branches + '])时$', 'u'));
  if (pair) {
    const facts = [baziAtom(pair[1] + '日'), baziAtom(pair[2] + '时')];
    return facts.every(Boolean) ? [facts] : null;
  }
  const pairedDays = value.match(new RegExp('^(' + stemBranch + '(?:或' + stemBranch + ')+)日(' + stemBranch + ')时$', 'u'));
  if (pairedDays) {
    const options = pairedDays[1].split('或').map((day) => [baziAtom(day + '日'), baziAtom(pairedDays[2] + '时')]);
    if (options.every((facts) => facts.every(Boolean))) return options;
  }
  const months = value.match(/^(?:原条|所列)?(.+?)(?:四月之一|月之一|月生|月)(?:依上文)?$/u)?.[1].replace(/[、或]/gu, '');
  if (months && branchSet.test(months)) return [...months].map((branch) => [{ kind: 'branch', position: 'month', branch }]);
  const branchOptions = value.match(/^月为([子丑寅卯辰巳午未申酉戌亥、]+)之一$/u);
  if (branchOptions) return [...branchOptions[1].replaceAll('、', '')].map((branch) => [{ kind: 'branch', position: 'month', branch }]);
  const seasonOptions = value.match(/^([春夏秋冬、]+)或([子丑寅卯辰巳午未申酉戌亥])月$/u);
  if (seasonOptions) return [...new Set([...seasonOptions[1].replaceAll('、', '')].map((season) => seasons[season]).join('') + seasonOptions[2])]
    .map((branch) => [{ kind: 'branch', position: 'month', branch }]);
  const pairOptions = value.includes('或') && /^(?:[子丑寅卯辰巳午未申酉戌亥]日[子丑寅卯辰巳午未申酉戌亥]时[、或])+(?:[子丑寅卯辰巳午未申酉戌亥]日[子丑寅卯辰巳午未申酉戌亥]时)$/u.test(value);
  if (pairOptions) return value.split(/[、或]/u).flatMap((option) => baziClause(option));
  if (/^(?:按本诀以)?月令建禄(?:为条件)?$/u.test(value)) {
    return [[{ kind: 'day_stem_phase', position: 'month', phase: '临官' }]];
  }
  if (value === '四柱均出自同一旬') return [...'子戌申午辰寅'].map((branch) =>
    positionNames.map((position) => ({ kind: 'pillar_xun', position, head: '甲' + branch })));
  const pillarXun = value.match(/^([年月日时])柱在甲([子戌申午辰寅])旬$/u);
  if (pillarXun) return [[{ kind: 'pillar_xun', position: positions[pillarXun[1]], head: '甲' + pillarXun[2] }]];
  const school = value.match(/^([月日时])柱为(真学堂|真词馆)$/u);
  if (school) return [[{ kind: 'bazi_nayin_school', position: positions[school[1]], school: school[2] }]];
  if (value === '加日时成四库全') return permutations([...'辰戌丑未']).map((set) =>
    set.map((branch, index) => ({ kind: 'branch', position: positionNames[index], branch })));
  if (value === '地支辰巳午未全见') return permutations([...'辰巳午未']).map((set) =>
    set.map((branch, index) => ({ kind: 'branch', position: positionNames[index], branch })));
  if (value === '魁罡在此格的口径下重逢') return kuiGangPillars.flatMap((day) => kuiGangPillars.flatMap((ganZhi) =>
    ['year', 'month', 'hour'].map((position) => [baziAtom(day + '日'), { kind: 'pillar', position, ganZhi }])));
  const season = value.match(/^(?:四季分述中的)?([春夏秋冬])(?:生|月)$/u);
  if (season) return [...seasons[season[1]]].map((branch) => [{ kind: 'branch', position: 'month', branch }]);
  const monthEnergy = value.match(/^(?:原局)?(?:月气通([木火土金水]+)|(?:月通|通)([木火土金水]+)(?:月)?气)$/u);
  const monthElement = monthEnergy?.[1] ?? monthEnergy?.[2];
  if (monthElement?.length === 1) {
    return [...monthElements[monthElement]].map((branch) => [{ kind: 'branch', position: 'month', branch }]);
  }
  const yearAndMonthBranches = value.match(/^(?:原条)?年月见(?:原列)?([子丑寅卯辰巳午未申酉戌亥、]+)$/u);
  if (yearAndMonthBranches) {
    const listed = [...new Set(yearAndMonthBranches[1].replaceAll('、', ''))];
    if (listed.length === 2) return [listed, [...listed].reverse()].map(([year, month]) => [baziAtom(year + '年'), baziAtom(month + '月')]);
    if (listed.length > 2) return listed.flatMap((year) => listed.filter((month) => month !== year)
      .map((month) => [baziAtom(year + '年'), baziAtom(month + '月')]));
  }
  if (hasDayHour && value === '日禄于时上见') return [[{ kind: 'day_stem_phase', position: 'hour', phase: '临官' }]];
  if (/^(?:本篇)?日禄归时$/u.test(value)) return [[{ kind: 'day_stem_phase', position: 'hour', phase: '临官' }]];
  if (hasDayHour && /^申月(?:长生)?学堂$/u.test(value)) return [[
    baziAtom('壬日'), baziAtom('申月'), { kind: 'day_stem_phase', position: 'month', phase: '长生' },
  ]];
  const pillarShift = value.match(/^([甲乙丙丁戊己庚辛壬癸])临(长生|沐浴|冠带|临官|帝旺|衰|病|死|墓|绝|胎|养)$/u);
  if (hasDayHour && pillarShift) return [[baziAtom(pillarShift[1] + '日'), { kind: 'day_stem_phase', position: 'hour', phase: pillarShift[2] }]];
  if (/^(?:日主)?身[强旺弱]$|^日主(?:自身)?[强旺弱]时?$|^日主(?:衰弱|羸弱)$/u.test(value)) {
    return [[{ kind: 'day_master_strength', result: value.includes('弱') ? '偏弱' : '偏强', profile: 'monthly-weighted-strength-v1' }]];
  }
  if (value === '日主相对均衡' || value === '日主强弱适中以上') {
    const results = value === '日主相对均衡' ? ['相对均衡'] : ['相对均衡', '偏强'];
    return results.map((result) => [{ kind: 'day_master_strength', result, profile: 'monthly-weighted-strength-v1' }]);
  }
  const strongGod = value.match(/^(.+?)(过盛|旺)$/u);
  if (strongGod && Object.hasOwn(tenGodStrengthGroups, strongGod[1])) return [[{
    kind: 'bazi_ten_god_strength', group: strongGod[1], profile: 'anchored-weighted-ten-god-v1', strength: strongGod[2],
  }]];
  const presentElement = value.match(/^五行有([木火土金水])$/u);
  if (presentElement) return [[{ kind: 'bazi_natal_element', element: presentElement[1] }]];
  const elementBalance = value.match(/^五行([木火土金水])(旺|弱|过盛|少量)$/u);
  if (elementBalance) return [[{ kind: 'bazi_element_balance', element: elementBalance[1], band: elementBalance[2],
    profile: 'weighted-element-balance-v1' }]];
  const masterSeason = value.match(/^日主月令(旺相|休囚)$/u);
  if (masterSeason) return [...masterSeason[1]].map((season) => [{ kind: 'bazi_day_master_season', season }]);
  const shownGod = value.match(new RegExp('^(?:按此处所说)?([年月时])(?:干(?:上)?(?:透|为)?|上)(?:见)?(' + tenGods + ')$', 'u'));
  if (shownGod) return [[{ kind: 'stem_ten_god', position: positions[shownGod[1]],
    tenGod: ['偏官', '七煞'].includes(shownGod[2]) ? '七杀' : shownGod[2] }]];
  const visibleGroup = value.match(/^(天干|年月干|年干|月干|时干)透(?:出)?(财|财星|官|印|印绶|食神|伤官|比肩|劫财|七杀|正官|偏财|正财|偏印|正印)$/u);
  if (visibleGroup) {
    const locations = visibleGroup[1] === '天干' ? ['year', 'month', 'hour'] : visibleGroup[1] === '年月干' ? ['year', 'month'] : [positions[visibleGroup[1][0]]];
    return locations.flatMap((position) => godFacts(visibleGroup[2], position, ['stem_ten_god']).map((fact) => [fact]));
  }
  // These predicates assert natal occurrence, not relative strength or a
  // successful structure. Keep shown stems and concealed gods as alternatives.
  const natalGod = /^(?:原局|四柱)(?:有|见|带)(正官|七杀|正财|偏财|正印|偏印|财星|印绶|食神|伤官|比肩|劫财|官杀)$/u.exec(value);
  const god = natalGod?.[1] ?? (value === '原局印绶' ? '印绶' : value === '遇鬼杀' ? '七杀' : value === '得官星' ? '正官' : null);
  if (god) return positionNames.flatMap(position => godFacts(god, position,
    position === 'day' ? ['branch_ten_god'] : ['stem_ten_god', 'branch_ten_god']).map(fact => [fact]));
  const columnGod = /^([年月日时])柱(?:有|见|带)(正官|七杀|正财|偏财|正印|偏印|食神|伤官|比肩|劫财)$/u.exec(value);
  if (columnGod) return godFacts(columnGod[2], positions[columnGod[1]], columnGod[1] === '日'
    ? ['branch_ten_god'] : ['stem_ten_god', 'branch_ten_god']).map(fact => [fact]);
  const visibleStem = value.match(/^年月(?:干)?透([甲乙丙丁戊己庚辛壬癸])$/u);
  if (visibleStem) return ['year', 'month'].map((position) => [{ kind: 'stem', position, stem: visibleStem[1] }]);
  const storedGroup = value.match(/^([年月日时])支(?:本气为|藏|见)(财|财星|官|印|印绶|食神|伤官|比肩|劫财|七杀|正官|偏财|正财|偏印|正印)$/u);
  const hiddenNatalGod = /^原局地支藏(正官|七杀|正财|偏财|财星|正印|偏印|印绶|食神|伤官|比肩|劫财)$/u.exec(value);
  if (hiddenNatalGod) return positionNames.flatMap(position => godFacts(hiddenNatalGod[1], position, ['branch_ten_god']).map(fact => [fact]));
  if (storedGroup) return godFacts(storedGroup[2], positions[storedGroup[1]],
    [value.includes('本气为') ? 'branch_main_ten_god' : 'branch_ten_god']).map((fact) => [fact]);
  const conjunction = value.match(/^([年月日时])位(?:又)?遇([财官印煞]{2,3})$/u);
  if (conjunction && new Set(conjunction[2]).size === conjunction[2].length) {
    return [...conjunction[2]].reduce((groups, god) => groups.flatMap((group) =>
      godFacts(god, positions[conjunction[1]], ['stem_ten_god', 'branch_ten_god']).map((fact) => [...group, fact])), [[]]);
  }
  const equalPillars = value.match(/^([年月日时])([年月日时])同([干支])$/u);
  if (equalPillars && equalPillars[1] !== equalPillars[2]) {
    const atoms = equalPillars[3] === '干' ? stems : branches;
    return [...atoms].map((token) => [baziAtom(token + equalPillars[1]), baziAtom(token + equalPillars[2])]);
  }
  const pure = value.match(/^(?:原局)?纯([子丑寅卯辰巳午未申酉戌亥])$/u);
  if (pure) return [positionNames.map((position) => ({ kind: 'branch', position, branch: pure[1] }))];
  const repeatedPillar = value.match(new RegExp('^四柱(?:均|皆)?(?:为|同为|都是)(' + stemBranch + ')$', 'u'));
  if (repeatedPillar && baziAtom(repeatedPillar[1] + '日')) {
    return [positionNames.map((position) => ({ kind: 'pillar', position, ganZhi: repeatedPillar[1] }))];
  }
  const visible = value.match(/^透([甲乙丙丁戊己庚辛壬癸])$/u);
  if (visible) return ['year', 'month', 'hour'].map((position) => [{ kind: 'stem', position, stem: visible[1] }]);
  const stemPart = value.match(/^([年月时])干(?:为|透|见)([甲乙丙丁戊己庚辛壬癸])$/u);
  if (stemPart) return [[{ kind: 'stem', position: positions[stemPart[1]], stem: stemPart[2] }]];
  if (hasDayHour && value === '以卯为乙木建禄') return [[
    { kind: 'stem', position: 'day', stem: '乙' }, { kind: 'branch', position: 'hour', branch: '卯' },
    { kind: 'day_stem_phase', position: 'hour', phase: '临官' },
  ]];
  if (hasDayHour && value === '原诗偏财遇食神') return [[
    { kind: 'stem_ten_god', position: 'hour', tenGod: '偏财' },
    { kind: 'hidden_ten_god', position: 'hour', stem: '辛', tenGod: '食神' },
  ]];
  if (hasDayHour && value === '倒食暗鬼') return [[
    { kind: 'stem_ten_god', position: 'hour', tenGod: '偏印' },
    { kind: 'hidden_ten_god', position: 'hour', stem: '庚', tenGod: '七杀' },
  ]];
  if (hasDayHour && /^(?:伤官并羊刃|伤官羊刃并见)$/u.test(value)) return [[
    { kind: 'stem', position: 'day', stem: '甲' }, { kind: 'branch', position: 'hour', branch: '卯' },
    { kind: 'stem_ten_god', position: 'hour', tenGod: '伤官' },
  ]];
  const shenSha = value.match(/^([年月日时])(?:柱|支|位)(?:坐|有|见|带|逢)(天乙贵人|文昌贵人|禄神|驿马|将星|华盖|桃花|空亡|天德|月德|孤辰|寡宿|阳刃|劫煞|亡神|官符|元辰|勾神|绞神)$/u);
  if (shenSha) return [[{ kind: 'shen_sha', position: positions[shenSha[1]], name: shenSha[2] }]];
  const natalShenSha = value.match(/^命中有(天乙贵人|禄神|驿马|将星|天德|月德|华盖|空亡|孤辰|寡宿|阳刃|劫煞|亡神|勾神|绞神|丧门|吊客)$/u);
  if (natalShenSha) return positionNames.map((position) => [{ kind: 'shen_sha', position, name: natalShenSha[1] }]);
  const lifePhase = value.match(/^([年月日时])支(?:为|临)(长生|沐浴|冠带|临官|帝旺|衰|病|死|墓|绝|胎|养)$/u);
  if (lifePhase) return [[{ kind: 'day_stem_phase', position: positions[lifePhase[1]], phase: lifePhase[2] }]];
  const nayinElement = value.match(/^([年月日时])柱纳音为([木火土金水])$/u);
  if (nayinElement) return nayinNames.filter((name) => name.endsWith(nayinElement[2])).map((name) =>
    [{ kind: 'pillar_nayin', position: positions[nayinElement[1]], name }]);
  const nayin = value.match(/^([年月日时])柱纳音(?:为)?(.+[木火土金水])$/u);
  if (nayin && nayinNames.includes(nayin[2])) {
    return [[{ kind: 'pillar_nayin', position: positions[nayin[1]], name: nayin[2] }]];
  }
  const ownPhase = value.match(/^([年月日时])柱(纳音|本干)在(生旺|衰死绝|衰败死绝|死绝|长生|临官|帝旺|墓|绝)$/u);
  if (ownPhase) {
    const phases = { 生旺: ['长生', '帝旺'], 衰死绝: ['衰', '死', '绝'], 衰败死绝: ['衰', '沐浴', '死', '绝'],
      死绝: ['死', '绝'] }[ownPhase[3]] ?? [ownPhase[3]];
    const kind = ownPhase[2] === '纳音' ? 'bazi_nayin_phase' : 'bazi_own_stem_phase';
    return phases.map((phase) => [{ kind, position: positions[ownPhase[1]], phase }]);
  }
  const hiddenPhase = value.match(/^([年月日时])支藏(正官|七杀|正印|偏印|食神|伤官|正财|偏财)(在月令|在|于)(长生|生旺|衰死绝|死绝|墓绝)$/u);
  if (hiddenPhase) return ({ 长生: ['长生'], 生旺: ['长生', '帝旺'], 衰死绝: ['衰', '死', '绝'], 死绝: ['死', '绝'], 墓绝: ['墓', '绝'] })[hiddenPhase[4]]
    .map((phase) => [{ kind: 'bazi_hidden_god_phase', position: positions[hiddenPhase[1]], tenGod: hiddenPhase[2],
      phase, anchor: hiddenPhase[3] === '在月令' ? 'month' : 'host' }]);
  const phase = hasDayHour && value.match(/^([甲乙丙丁戊己庚辛壬癸])在([子丑寅卯辰巳午未申酉戌亥])取(长生|沐浴|冠带|临官|帝旺|衰|病|死|墓|绝|胎|养)$/u);
  if (phase) {
    return [[baziAtom(phase[1] + '日'), baziAtom(phase[2] + '时'), { kind: 'day_stem_phase', position: 'hour', phase: phase[3] }]];
  }
  if (/^(?:日时|时日)(?:相|并|对)冲$/u.test(value)) {
    return opposition.flatMap(([a, b]) => [[a, b], [b, a]].map(([day, hour]) =>
      [baziAtom(day + '日'), baziAtom(hour + '时')]));
  }
  if (/^(?:日时|时日)相(?:穿|害)$/u.test(value)) {
    return harmPairs.flatMap(([a, b]) => [[a, b], [b, a]].map(([day, hour]) =>
      [baziAtom(day + '日'), baziAtom(hour + '时')]));
  }
  const stemPair = value.match(/^(?:本篇所谓|按本篇、?带)?([甲乙丙丁戊己庚辛壬癸]{2})(?:中正|仁义)?之?合$/u);
  if (stemPair && (combinations.includes(stemPair[1]) || combinations.includes([...stemPair[1]].reverse().join('')))) {
    const [a, b] = stemPair[1];
    return positionNames.flatMap((position) => positionNames.filter((other) => other !== position).map((other) => [
      { kind: 'stem', position, stem: a }, { kind: 'stem', position: other, stem: b },
    ]));
  }
  const specificDayHour = hasDayHour && value.match(/^本句从日时([子丑寅卯辰巳午未申酉戌亥]{2})相逢立论$/u);
  if (specificDayHour) {
    const [a, b] = specificDayHour[1];
    return [[baziAtom(a + '日'), baziAtom(b + '时')], [baziAtom(b + '日'), baziAtom(a + '时')]];
  }
  const brokenBranches = value.match(/^地支([子丑寅卯辰巳午未申酉戌亥])([子丑寅卯辰巳午未申酉戌亥])相破$/u);
  if (brokenBranches && ['卯午', '丑辰', '子酉', '未戌'].includes(brokenBranches[1] + brokenBranches[2])) {
    return positionNames.flatMap((position) => positionNames.filter((other) => position !== other).map((other) => [
      { kind: 'branch', position, branch: brokenBranches[1] }, { kind: 'branch', position: other, branch: brokenBranches[2] },
    ]));
  }
  const completeBranchGroup = value.match(/^地支(寅午戌|申子辰|巳酉丑|亥卯未|寅卯辰|巳午未|申酉戌|亥子丑|寅巳申|丑戌未)全见$/u);
  if (completeBranchGroup) return positionNames.flatMap((omitted) => permutations([...completeBranchGroup[1]]).map((set) =>
    positionNames.filter((position) => position !== omitted).map((position, index) => ({ kind: 'branch', position, branch: set[index] }))));
  if (/^(?:日时|时日)相刑$/u.test(value) || (hasDayHour && /^(?:日时见)?[子丑寅卯辰巳午未申酉戌亥]{2}相刑$/u.test(value))) {
    const named = value.match(/[子丑寅卯辰巳午未申酉戌亥]{2}/u)?.[0];
    const valid = dayHourPunishments.filter(([a, b]) => !named || [a + b, b + a].includes(named));
    if (valid.length) return valid.flatMap(([a, b]) => [[a, b], [b, a]].map(([day, hour]) =>
      [baziAtom(day + '日'), baziAtom(hour + '时')]));
  }
  const yearAndMonth = value.match(/^(?:年月)?([子丑寅卯辰巳午未申酉戌亥])([子丑寅卯辰巳午未申酉戌亥])(?:年月)?$/u);
  if (yearAndMonth && value.includes('年月')) {
    const [, a, b] = yearAndMonth;
    return [[a, b], [b, a]].map(([year, month]) => [baziAtom(year + '年'), baziAtom(month + '月')]);
  }
  if (value.includes('或')) {
    const options = value.split('或').map((option) => baziClause(option, hasDayHour));
    if (options.every(Boolean)) return options.flat();
  }
  if (/[且而]/u.test(value) && !value.includes('或')) {
    const groups = value.split(/[且而]/u).map((option) => baziClause(option, hasDayHour));
    if (groups.every(Boolean)) return groups.reduce((lhs, rhs) => lhs.flatMap((first) => rhs.map((last) => [...first, ...last])), [[]]);
  }
  return null;
}

function permutations(items) {
  if (!items.length) return [[]];
  return items.flatMap((item) => permutations(items.filter((other) => other !== item)).map((tail) => [item, ...tail]));
}

function palaceName(name) {
  if (name === '身' || name === '身宫') return '身宫';
  return palaceAliases[name] ?? palaceAliases[name.replace(/宫$/u, '')];
}

function parseStars(value) {
  const compact = value.replace(/[、与和及]/gu, '');
  const names = compact.match(starToken);
  if (!names || names.join('') !== compact) return null;
  const expanded = names.flatMap((name) => starAliases[name] ?? [name]);
  return new Set(expanded).size === expanded.length ? expanded : null;
}

function ziweiFacts(names, palace, states = [], branch = null) {
  if (palace === '身宫') return palaces.flatMap((actual) => ziweiFacts(names, actual, states, branch)
    .map((facts) => [...facts, { kind: 'body_palace', palace: actual }]));
  const required = names.map((star) => ({ kind: 'palace_star', palace, star, scope: 'origin' }));
  if (branch) required.push({ kind: 'palace_branch', palace, branch });
  return states.length
    ? names.reduce((choices, star) => choices.flatMap((facts) => states.map((brightness) =>
      [...facts, { kind: 'palace_brightness', palace, star, scope: 'origin', brightness }])), [required])
    : [required];
}

function soloZiweiFacts(star, palace, states = [], branch = null) {
  const kind = majorStars.includes(star) ? 'palace_main_count' : 'palace_core_star_count';
  return ziweiFacts([star], palace, states, branch)
    .map((facts) => [...facts, { kind, palace: facts[0].palace, count: 1 }]);
}

function palaceSectors(palace, offsets) {
  const index = palaces.indexOf(palace);
  return offsets.map((offset) => palaces[(index + offset + 12) % 12]);
}

function allPalaceRelations(names, anchor, relation) {
  return palaceSectors(anchor, relation === 'opposite' ? [6] : [-4, 4]).map((target) =>
    [...ziweiFacts(names, target)[0], { kind: 'palace_relation', anchor, target, relation }]);
}

function surroundingPalaces(names, anchor, relation) {
  const [a, b] = names;
  const offset = relation === 'adjacent' ? 1 : 4;
  const targets = palaceSectors(anchor, [offset, -offset]);
  return targets.flatMap((first) => targets.filter((second) => second !== first).map((second) => [
    ...ziweiFacts([a], first)[0], ...ziweiFacts([b], second)[0],
    { kind: 'palace_relation', anchor, target: first, relation },
    { kind: 'palace_relation', anchor, target: second, relation },
  ]));
}

function ziweiClause(value) {
  const region = classicalRegion(value);
  if (region) return region;
  const explicitGender = /^(?:按原(?:篇|书)([男女])命取法|按古[籍书]([男女])命体例|古[籍书]([男女])命)$/u.exec(value);
  if (explicitGender) return [[{ kind: 'natal_gender', gender: explicitGender.slice(1).find(Boolean) }]];
  const bureauNames = { 水: '水二局', 木: '木三局', 金: '金四局', 土: '土五局', 火: '火六局' };
  const bureau = /^([水木金土火])局$/u.exec(value);
  if (bureau) return [[{ kind: 'natal_ziwei_bureau', bureau: bureauNames[bureau[1]] }]];
  if (value === '命无正曜') return [[{ kind: 'palace_main_count', palace: '命宫', count: 0 }]];
  let clause = value.replace(/，宫职由篇题给出$/u, '').replace(/（奴仆宫）$/u, '')
    .replace(/^本命/u, '')
    .replace(/([在居落临守坐])本命/gu, '$1')
    .replace(/同在本命(.+?宫)$/u, '在$1')
    .replace(/([在居落临守坐值]|^)(身命|命身)(?=$|且)/u, '$1身宫或命宫')
    .replace(/戍(?=命|宫|位|$)/gu, '戌');
  clause = clause.replace(/且陷$/u, '落陷');
  const unsplit = clause;
  // A named star's transformation and location belong to one actual palace.
  // A bare palace transformation or another star's transformation cannot fill it.
  const changedAt = text => {
    const before = /^(.+?)化([禄权科忌])(?:居|在|守)(.+)$/u.exec(text);
    const after = /^(.+?)(?:居|在|守)(.+?)(?:且|并)化([禄权科忌])$/u.exec(text);
    if (!before && !after) return null;
    const star = (before ?? after)[1], change = before?.[2] ?? after[3], location = before?.[3] ?? after[2];
    if (!stars.includes(star)) return null;
    const branchNames = location.replace(/(?:宫|位)$/u, '').replace(/[、或]/gu, '');
    const sites = location.split('或').map(palaceName);
    const placements = branchSet.test(branchNames)
      ? [...new Set(branchNames)].flatMap(branch => palaces.flatMap(palace => ziweiFacts([star], palace, [], branch)))
      : sites.every(Boolean) ? sites.flatMap(palace => ziweiFacts([star], palace)) : null;
    return placements?.map(facts => [...facts, { kind: 'star_mutagen', palace: facts.find(f => f.kind === 'palace_star' && f.star === star).palace, star, scope: 'origin', change }]) ?? null;
  };
  const changedOr = /^(.+?化[禄权科忌](?:居|在|守).+)或(.+?化[禄权科忌](?:居|在|守).+)$/u.exec(clause);
  if (changedOr) {
    const first = changedAt(changedOr[1]), second = changedAt(changedOr[2]);
    return first && second ? [...first, ...second] : null;
  }
  const changedPlacement = changedAt(clause);
  if (changedPlacement) return changedPlacement;
  const leadingBrightness = clause.match(/^(.+?)(入庙|失陷|落陷)((?:独守|单守|同守|守).+)$/u);
  if (leadingBrightness && parseStars(leadingBrightness[1])) {
    clause = leadingBrightness[1] + leadingBrightness[3] + leadingBrightness[2];
  }
  // Both predicates describe the same star in the same palace. Splitting
  // this into two independent existential clauses could join different places.
  const brightChange = clause.match(/^(.+?)(入庙|庙旺|落陷)且化([禄权科忌])$/u);
  if (brightChange && stars.includes(brightChange[1])) {
    const levels = { 入庙: ['庙'], 庙旺: ['庙', '旺'], 落陷: ['陷'] }[brightChange[2]];
    return palaces.flatMap(palace => ziweiFacts([brightChange[1]], palace, levels).map(facts => [
      ...facts, { kind: 'star_mutagen', palace, star: brightChange[1], scope: 'origin', change: brightChange[3] },
    ]));
  }
  if (clause === '身命异宫') return palaces.filter((palace) => palace !== '命宫').map((palace) => [
    { kind: 'body_palace', palace },
  ]);
  if (clause === '身命对宫') return [[{ kind: 'body_palace', palace: '迁移' },
    { kind: 'palace_relation', anchor: '命宫', target: '迁移', relation: 'opposite' }]];
  if (clause === '命身宫支及正曜同向相克') return [[{ kind: 'ziwei_life_body_clash' }]];
  if (clause === '八座聚吉化吉') return [[{ kind: 'ziwei_eight_seats' }]];
  const bodyLocation = clause.match(/^身宫落(.+?宫)$/u);
  const bodyPalace = bodyLocation && palaceName(bodyLocation[1]);
  if (palaces.includes(bodyPalace)) return [[{ kind: 'body_palace', palace: bodyPalace }]];
  const grade = clause.match(/^命宫([星数])格([上中下])$/u);
  if (grade) return [[{ kind: 'ziwei_grade', dimension: grade[1] === '星' ? 'star' : 'number', grade: grade[2] }]];
  if (/^[昼夜]生$/u.test(clause)) return [[{ kind: 'natal_daylight', sect: clause[0] === '昼' ? 'day' : 'night' }]];
  const bornHour = clause.match(/^([子丑寅卯辰巳午未申酉戌亥、]+)时生$/u);
  if (bornHour) return [...new Set(bornHour[1].replaceAll('、', ''))].map((branch) => [{ kind: 'natal_ziwei_hour', branch }]);
  const gender = clause.match(/^(?:(?:古籍|古书)(?:限定)?)?([男女])命(?:诀)?/u);
  if (gender) {
    const fact = { kind: 'natal_gender', gender: gender[1] };
    const remainder = clause.slice(gender[0].length);
    if (!remainder) return [[fact]];
    return ziweiClause(remainder)?.map((facts) => [fact, ...facts]) ?? null;
  }
  const explicitTrine = clause.match(/^(.+?)由(.+?)三合照$/u);
  if (explicitTrine) return anchoredZiweiClause(explicitTrine[2] + '三合照', ziweiClause(explicitTrine[1]) ?? []);
  const changePlacement = clause.match(/^(?:本命)?化([禄权科忌吉])(?:在|守|入)([\p{Script=Han}]+)$/u);
  const changePalaces = changePlacement && changePlacement[2].split('或').map(palaceName);
  if (changePalaces?.every((palace) => palaces.includes(palace) || palace === '身宫')) {
    const changes = changePlacement[1] === '吉' ? [...'禄权科'] : [changePlacement[1]];
    return changes.flatMap((change) => changePalaces.flatMap((palace) => palace === '身宫'
      ? palaces.map((target) => [{ kind: 'palace_mutagen', palace: target, scope: 'origin', change },
        { kind: 'body_palace', palace: target }])
      : [[{ kind: 'palace_mutagen', palace, scope: 'origin', change }]]));
  }
  const majorState = clause.match(/^(.+?宫)正曜(庙旺化吉|庙旺|入庙|陷地)$/u);
  const majorPalace = majorState && palaceName(majorState[1]);
  if (palaces.includes(majorPalace) || majorPalace === '身宫') {
    return [[{ kind: 'palace_major_state', palace: majorPalace, state: majorState[2] }]];
  }
  const changeInSamePalace = clause.match(/^化([禄权科忌])与化([禄权科忌])同宫$/u);
  if (changeInSamePalace && changeInSamePalace[1] !== changeInSamePalace[2]) {
    return palaces.map((palace) => [changeInSamePalace[1], changeInSamePalace[2]].map((change) =>
      ({ kind: 'palace_mutagen', palace, scope: 'origin', change })));
  }
  const changeAspect = clause.match(/^化([禄权科忌])从(对宫|三方)朝命宫$/u);
  if (changeAspect) {
    const isOpposite = changeAspect[2] === '对宫';
    return palaceSectors('命宫', isOpposite ? [6] : [-4, 4]).map((target) => [
      { kind: 'palace_mutagen', palace: target, scope: 'origin', change: changeAspect[1] },
      { kind: 'palace_relation', anchor: '命宫', target, relation: isOpposite ? 'opposite' : 'trine' },
    ]);
  }
  const changeBrightness = clause.match(/^实际化([禄权科忌])的星曜(入庙|庙旺|落陷)(?:在(.+?宫))?$/u);
  const brightnessPalace = changeBrightness?.[3] && palaceName(changeBrightness[3]);
  if (changeBrightness && (!changeBrightness[3] || palaces.includes(brightnessPalace))) {
    const levels = { 入庙: ['庙'], 庙旺: ['庙', '旺'], 落陷: ['陷'] }[changeBrightness[2]];
    return (brightnessPalace ? [brightnessPalace] : palaces).flatMap((palace) => levels.map((brightness) => [
      { kind: 'palace_mutagen_brightness', palace, change: changeBrightness[1], brightness },
    ]));
  }
  const birthStems = clause.match(/^(?:保留)?([甲乙丙丁戊己庚辛壬癸或、]+)生人(?:的限定)?(?:合格)?$/u);
  if (birthStems) return [...birthStems[1].replace(/[或、]/gu, '')].map((stem) => [{ kind: 'natal_year_stem', stem }]);
  const yearSuffix = /^([甲乙丙丁戊己庚辛壬癸])年(?:或([甲乙丙丁戊己庚辛壬癸])年)*生(?:人)?$/u.exec(clause);
  if (yearSuffix) return [...new Set([...clause.matchAll(/([甲乙丙丁戊己庚辛壬癸])年/gu)].map(match => match[1]))]
    .map(stem => [{ kind: 'natal_year_stem', stem }]);
  const natalStems = clause.match(/^生年(?:天干)?(?:为)?([甲乙丙丁戊己庚辛壬癸或、]+)$/u);
  if (natalStems) return [...new Set(natalStems[1].replace(/[或、]/gu, ''))].map(stem => [{ kind: 'natal_year_stem', stem }]);
  const birthBranches = clause.match(/^([子丑寅卯辰巳午未申酉戌亥或、]+)生(?:人)?$/u);
  if (birthBranches) return [...birthBranches[1].replace(/[或、]/gu, '')].map((branch) => [{ kind: 'natal_year_branch', branch }]);
  const natalBranches = /^生年地支(?:为)?([子丑寅卯辰巳午未申酉戌亥或、]+)$/u.exec(clause);
  if (natalBranches) return [...new Set(natalBranches[1].replace(/[或、]/gu, ''))]
    .map(branch => [{ kind: 'natal_year_branch', branch }]);
  const branchGroup = /^(.+?)在(四生|四墓|四库)宫位的(.+?宫)$/u.exec(clause);
  if (branchGroup && parseStars(branchGroup[1])?.length === 1 && palaceName(branchGroup[3])) {
    const sites = branchGroup[2] === '四生' ? '寅申巳亥' : '辰戌丑未';
    return [...sites].flatMap(branch => ziweiFacts(parseStars(branchGroup[1]), palaceName(branchGroup[3]), [], branch));
  }
  const lunarMonth = clause.match(/^([正一二三四五六七八九十或、]+)月生(?:依原文)?$/u);
  if (lunarMonth) {
    const labels = lunarMonth[1].replaceAll('、', '或').split('或').map((label) => label === '一' ? '正' : label);
    if (labels.every((label) => monthsNumerals.includes(label))) return labels.map((label) =>
      [{ kind: 'natal_lunar_month', month: monthsNumerals.indexOf(label) + 1, leap: false }]);
  }
  const bureaus = clause.split('或');
  if (bureaus.every((bureau) => /^(水二局|木三局|金四局|土五局|火六局)$/u.test(bureau))) {
    return bureaus.map((bureau) => [{ kind: 'natal_ziwei_bureau', bureau }]);
  }
  const natalElement = clause.match(/^年纳音(?:为)?([木火土金水])$/u);
  if (natalElement) return [[{ kind: 'natal_year_nayin_element', element: natalElement[1] }]];
  const transformation = clause.match(/^(.+?)化([禄权科忌吉])(?:所处宫未说明)?$/u);
  if (transformation && stars.includes(transformation[1])) {
    const changes = transformation[2] === '吉' ? [...'禄权科'] : [transformation[2]];
    return palaces.flatMap((palace) => changes.map((change) =>
      [{ kind: 'star_mutagen', palace, star: transformation[1], scope: 'origin', change }]));
  }
  const placedChange = clause.match(/^(.+?)在([子丑寅卯辰巳午未申酉戌亥])宫化([禄权科忌])$/u);
  if (placedChange && stars.includes(placedChange[1])) {
    return palaces.map((palace) => [
      ...ziweiFacts([placedChange[1]], palace, [], placedChange[2])[0],
      { kind: 'star_mutagen', palace, star: placedChange[1], scope: 'origin', change: placedChange[3] },
    ]);
  }
  if (clause === '擎羊与力士同宫') return palaces.map((palace) => [
    ...ziweiFacts(['擎羊'], palace)[0], { kind: 'palace_boshi_star', palace, star: '力士' },
  ]);
  const boshi = clause.match(/^博士十二神(博士|力士|青龙|小耗|将军|奏书|飞廉|喜神|病符|大耗|伏兵|官府)守(.+?宫)$/u);
  const boshiPalace = boshi && palaceName(boshi[2]);
  if (palaces.includes(boshiPalace)) return [[{ kind: 'palace_boshi_star', palace: boshiPalace, star: boshi[1] }]];
  const yearlyStar = clause.match(/^(岁前官符|将前劫煞|将前咸池)(守|在)(.+?宫)(三方四正)?$/u);
  const yearlyStarPalace = yearlyStar && palaceName(yearlyStar[3]);
  if (palaces.includes(yearlyStarPalace)) {
    const kind = yearlyStar[1] === '岁前官符' ? 'palace_suiqian_star' : 'palace_jiangqian_star';
    const star = yearlyStar[1].slice(2);
    return (yearlyStar[4] ? palaceSectors(yearlyStarPalace, [0, -4, 4, 6]) : [yearlyStarPalace]).map((palace, index) => [
      { kind, palace, star },
      ...(index ? [{ kind: 'palace_relation', anchor: yearlyStarPalace, target: palace, relation: index === 3 ? 'opposite' : 'trine' }] : []),
    ]);
  }
  if (clause === '左辅、右弼从两侧夹紫微') return palaces.flatMap((palace) =>
    surroundingPalaces(['左辅', '右弼'], palace, 'adjacent').map((requirements) => [...ziweiFacts(['紫微'], palace)[0], ...requirements]));
  const emptyPalace = clause.match(/^(.+?宫)无正曜$/u);
  if (emptyPalace && palaces.includes(palaceName(emptyPalace[1]))) {
    return [[{ kind: 'palace_main_count', palace: palaceName(emptyPalace[1]), count: 0 }]];
  }
  const lifePositions = clause.match(/^命(?:宫)?在((?:[子丑寅卯辰巳午未申酉戌亥、]|或)+)$/u);
  if (lifePositions) return [...lifePositions[1].replace(/[、或]/gu, '')].map((branch) =>
    [{ kind: 'palace_branch', palace: '命宫', branch }]);
  const bodyPositions = clause.match(/^身宫在([子丑寅卯辰巳午未申酉戌亥]+)$/u);
  if (bodyPositions) return palaces.flatMap((palace) => [...bodyPositions[1]].map((branch) => [
    { kind: 'body_palace', palace }, { kind: 'palace_branch', palace, branch },
  ]));
  const branchFirstPalace = /^([子丑寅卯辰巳午未申酉戌亥])地(.+?宫)$/u.exec(clause);
  const branchFirstTarget = branchFirstPalace && palaceName(branchFirstPalace[2]);
  if (palaces.includes(branchFirstTarget)) return [[{ kind: 'palace_branch', palace: branchFirstTarget, branch: branchFirstPalace[1] }]];
  const alternativeSites = /^(.+?宫(?:或.+?宫)+)(?:逢|见|遇)(.+)$/u.exec(clause);
  const alternativeTargets = alternativeSites?.[1].split('或').map(palaceName);
  const alternativeStars = alternativeSites && parseStars(alternativeSites[2]);
  if (alternativeStars && alternativeTargets?.every(palace => palaces.includes(palace) || palace === '身宫')) {
    return alternativeTargets.flatMap(palace => ziweiFacts(alternativeStars, palace));
  }
  const forwardPalace = clause.match(/^(.+?宫)顺支下一宫有(.+)$/u);
  const forwardAnchor = forwardPalace && palaceName(forwardPalace[1]);
  const forwardStars = forwardPalace && parseStars(forwardPalace[2]);
  if (palaces.includes(forwardAnchor) && forwardStars?.length) {
    const [target] = palaceSectors(forwardAnchor, [-1]);
    return [...branches].map((branch, index) => [
      { kind: 'palace_branch', palace: forwardAnchor, branch },
      { kind: 'palace_relation', anchor: forwardAnchor, target, relation: 'adjacent' },
      ...ziweiFacts(forwardStars, target, [], branches[(index + 1) % branches.length])[0],
    ]);
  }
  const opposite = clause.match(/^(.+?)(?:在|于)(.+?宫)对宫(?:冲照)?$/u);
  if (opposite && parseStars(opposite[1]) && palaces.includes(palaceName(opposite[2]))) {
    return allPalaceRelations(parseStars(opposite[1]), palaceName(opposite[2]), 'opposite');
  }
  const trine = clause.match(/^(.+?)从(.+?宫)三合(?:照|拱)$/u);
  const companions = trine && parseStars(trine[1]);
  const anchor = trine && palaceName(trine[2]);
  if (companions && palaces.includes(anchor)) return allPalaceRelations(companions, anchor, 'trine');
  const spread = clause.match(/^(.+?)分守(.+?宫)的两侧三合$/u);
  const separatedStars = spread && parseStars(spread[1]);
  const centralPalace = spread && palaceName(spread[2]);
  if (separatedStars?.length === 2 && palaces.includes(centralPalace)) {
    return surroundingPalaces(separatedStars, centralPalace, 'trine');
  }
  const stellarGroup = clause.match(/^(.+?宫)(三合)?有(六吉|四煞)之一(?:且除(.+)外)?$/u);
  const supportedPalace = stellarGroup && palaceName(stellarGroup[1]);
  if (supportedPalace === '身宫' && !stellarGroup[2] && !stellarGroup[4]) {
    return [[{ kind: 'palace_body_star_group', group: stellarGroup[3] }]];
  }
  if (palaces.includes(supportedPalace) || (supportedPalace === '身宫' && !stellarGroup[2])) {
    const names = stellarGroup[3] === '六吉' ? beneficStars : maleficStars;
    const excluded = stellarGroup[4] ? parseStars(stellarGroup[4]) : [];
    if (excluded) return names.filter((star) => !excluded.includes(star)).flatMap((star) => stellarGroup[2]
      ? allPalaceRelations([star], supportedPalace, 'trine') : ziweiFacts([star], supportedPalace));
  }
  const sectors = clause.match(/^(.+?)在(.+?宫)三方四正$/u);
  const sectorStars = sectors && parseStars(sectors[1]);
  const sectorAnchor = sectors && palaceName(sectors[2]);
  if (sectorStars?.length && palaces.includes(sectorAnchor)) {
    return [sectorStars.map((star) => ({ kind: 'palace_sector_star', palace: sectorAnchor, star }))];
  }
  const beneficCount = clause.match(/^(.+?宫)三方四正六吉(至多一|至少三)颗$/u);
  const countedPalace = beneficCount && palaceName(beneficCount[1]);
  if (palaces.includes(countedPalace)) return (beneficCount[2] === '至多一' ? [0, 1] : [3, 4, 5, 6])
    .map((count) => [{ kind: 'palace_sector_benefic_count', palace: countedPalace, count }]);
  const maleficCount = clause.match(/^(.+?宫)三方四正四煞至少([两三])颗$/u);
  const afflictedPalace = maleficCount && palaceName(maleficCount[1]);
  if (palaces.includes(afflictedPalace)) return (maleficCount[2] === '两' ? [2, 3, 4] : [3, 4]).map((count) => [
    { kind: 'palace_sector_malefic_count', palace: afflictedPalace, count },
  ]);
  const allBenefic = clause.match(/^(.+?宫)三方四正均有六吉$/u);
  const supportedSectors = allBenefic && palaceName(allBenefic[1]);
  if (palaces.includes(supportedSectors)) return [[{ kind: 'palace_sector_all_benefic', palace: supportedSectors }]];
  const sectorChange = clause.match(/^化([禄权科忌])在(.+?宫)三方四正$/u);
  const changeAnchor = sectorChange && palaceName(sectorChange[2]);
  if (palaces.includes(changeAnchor)) return palaceSectors(changeAnchor, [0, -4, 4, 6]).map((target, index) => [
    { kind: 'palace_mutagen', palace: target, scope: 'origin', change: sectorChange[1] },
    ...(index ? [{ kind: 'palace_relation', anchor: changeAnchor, target, relation: index === 3 ? 'opposite' : 'trine' }] : []),
  ]);
  const guardingChange = clause.match(/^(.+?)守(.+?宫)化([禄权科忌])$/u);
  const guardedPalace = guardingChange && palaceName(guardingChange[2]);
  if (palaces.includes(guardedPalace) && stars.includes(guardingChange[1])) {
    const star = guardingChange[1];
    return [[...ziweiFacts([star], guardedPalace)[0],
      { kind: 'star_mutagen', palace: guardedPalace, star, change: guardingChange[3], scope: 'origin' }]];
  }
  const flanking = clause.match(/^(.+?)(?:分别在)?(命宫两侧夹命|夹命宫|夹命)$/u);
  const flankers = flanking && parseStars(flanking[1]?.replace(/分别在$/u, ''));
  if (flankers?.length === 2) return surroundingPalaces(flankers, '命宫', 'adjacent');
  const bodyFlanking = clause.match(/^(.+?)夹身宫$/u);
  const bodyFlankers = bodyFlanking && parseStars(bodyFlanking[1]);
  if (bodyFlankers?.length === 2) return palaces.flatMap((palace) =>
    surroundingPalaces(bodyFlankers, palace, 'adjacent').map((facts) => [...facts, { kind: 'body_palace', palace }]));
  const namedFlanks = /^(.+?)(?:分夹(.+?宫)|构成(.+?宫)之夹|夹(.+?宫))$/u.exec(clause);
  const namedFlankers = namedFlanks && parseStars(namedFlanks[1]);
  const namedTargets = namedFlanks && namedFlanks.slice(2).find(Boolean).split(/[、或]/u).map(palaceName);
  if (namedFlankers?.length === 2 && namedTargets?.every(palace => palaces.includes(palace) || palace === '身宫')) {
    return namedTargets.flatMap(target => target === '身宫' ? palaces.flatMap(palace =>
      surroundingPalaces(namedFlankers, palace, 'adjacent').map(facts => [...facts, { kind: 'body_palace', palace }]))
      : surroundingPalaces(namedFlankers, target, 'adjacent'));
  }
  const aroundNamedPalace = /^(.+?)位在(.+?)前后相夹$/u.exec(clause);
  const aroundStars = aroundNamedPalace && parseStars(aroundNamedPalace[1]);
  const aroundTarget = aroundNamedPalace && palaceName(aroundNamedPalace[2]);
  if (aroundStars?.length === 2 && palaces.includes(aroundTarget)) return surroundingPalaces(aroundStars, aroundTarget, 'adjacent');
  const placedFlanks = clause.match(/^(.+?)守(.+?宫(?:或.+?宫)?)由(.+?)(?:前后|两侧)夹$/u);
  if (placedFlanks) {
    const [, core, targets, neighbors] = placedFlanks;
    const flankingStars = parseStars(neighbors);
    const locations = targets.split('或').map(palaceName);
    if (stars.includes(core) && flankingStars?.length === 2 && locations.every((palace) => palaces.includes(palace))) {
      return locations.flatMap((palace) => surroundingPalaces(flankingStars, palace, 'adjacent').map((requirements) =>
        [...ziweiFacts([core], palace)[0], ...requirements]));
    }
  }
  const sign = clause.match(/^(.+?)(?:在|居)身$/u);
  if (sign && parseStars(sign[1])) return ziweiFacts(parseStars(sign[1]), '身宫');
  const listedAlternatives = clause.match(/^(.+?宫)(?:有|见)原(?:书|句)并列的(.+)$/u);
  const listedPalace = listedAlternatives && palaceName(listedAlternatives[1]);
  if (listedPalace && listedAlternatives[2].includes('或')) {
    const options = listedAlternatives[2].split('或').map(parseStars);
    if (options.every(names => names?.length === 1)) return options.flatMap(names => ziweiFacts(names, listedPalace));
  }
  const levels = { 入庙: ['庙'], 不入庙: ['旺', '得', '利', '平', '不', '闲', '陷'], 庙旺: ['庙', '旺'], 失陷: ['陷'],
    陷地: ['陷'], 陷宫: ['陷'], 落陷: ['陷'], 旺宫: ['旺'], 旺地: ['旺'], 庙地: ['庙'], 不得地: ['不'], 得地: ['得'], 利益: ['利'] };
  clause = clause.replace(/(不入庙|入庙|庙旺|失陷|陷地|陷宫|落陷|旺宫|旺地|庙地|不得地|得地|利益)且独守$/u, '独守$1');
  const qualifier = clause.match(/(?:且|并)?(?:处|居|在)?(不入庙|入庙|庙旺|失陷|陷地|陷宫|落陷|旺宫|旺地|庙地|不得地|得地|利益)$/u);
  const states = qualifier ? levels[qualifier[1]] : [];
  if (qualifier) clause = clause.slice(0, -qualifier[0].length);
  // A newly recognised brightness word does not resolve whether a bare list
  // means alternatives, conjunction, or stars in separate palaces.
  const brightnessStars = qualifier && ['旺地', '庙地'].includes(qualifier[1])
    && parseStars((clause.match(starToken) ?? []).join(''));
  if (brightnessStars?.length > 1 && !/(?:同宫|同垣|同居|同守)/u.test(clause)) return null;
  // “火星居旺宫” specifies brightness, not an unnamed palace location.
  if (states.length && parseStars(clause.replace(/(?:居|在)$/u, ''))) clause = clause.replace(/(?:居|在)$/u, '');
  const singleSeated = clause.match(/^(.+?)单坐(?:([子丑寅卯辰巳午未申酉戌亥])位)?(.+?)$/u);
  if (singleSeated && coreStars.has(singleSeated[1]) && palaceName(singleSeated[3])) {
    return soloZiweiFacts(singleSeated[1], palaceName(singleSeated[3]), states, singleSeated[2]).filter(compatibleZiweiRelativeFacts);
  }
  const lone = clause.match(/^(.+?)(?:独守|单守|单居)(?:([子丑寅卯辰巳午未申酉戌亥])位)?(.+?)$/u);
  if (lone && coreStars.has(lone[1]) && palaceName(lone[3])) {
    return soloZiweiFacts(lone[1], palaceName(lone[3]), states, lone[2]);
  }
  const bare = states.length && parseStars(clause);
  if (bare) return palaces.flatMap((palace) => ziweiFacts(bare, palace, states));
  const shorthand = clause.match(/^([子丑寅卯辰巳午未申酉戌亥])命$/u);
  if (shorthand) return [[{ kind: 'palace_branch', palace: '命宫', branch: shorthand[1] }]];
  const front = clause.match(/^(.+?宫)(?:逢|见|遇|临)?(.+)$/u);
  if (front && palaceName(front[1])) {
    const solo = /(?:独守|单守|单居)$/u.test(front[2]);
    const names = parseStars(front[2].replace(/(?:独守|单守|单居|坐守|同宫|同守|同居|同度)$/u, ''));
    if (names?.length && (!solo || names.length === 1)) return solo
      ? soloZiweiFacts(names[0], palaceName(front[1]), states) : ziweiFacts(names, palaceName(front[1]), states);
  }
  const shortFront = clause.match(/^(兄弟|夫妻|妻妾|子女|子息|财帛|疾厄|迁移|仆役|官禄|田宅|福德|父母)(.+)$/u);
  if (shortFront) {
    const solo = /(?:独守|单守|单居)$/u.test(shortFront[2]);
    const names = parseStars(shortFront[2].replace(/(?:独守|单守|单居|坐守|同守|同宫|同居|同度)$/u, ''));
    if (names?.length && (!solo || names.length === 1)) return solo
      ? soloZiweiFacts(names[0], palaceName(shortFront[1]), states) : ziweiFacts(names, palaceName(shortFront[1]), states);
  }
  const branchGuard = clause.match(branchGuardPattern);
  const guardingStars = branchGuard && parseStars(branchGuard[1]);
  const guardingPalace = branchGuard && palaceName(branchGuard[4]);
  if (guardingStars?.length && guardingPalace) {
    const solo = ['独守', '单守'].includes(branchGuard[2]);
    if (solo && guardingStars.length !== 1) return null;
    return [...new Set(branchGuard[3].replace(/[位、或]/gu, ''))].flatMap(branch => solo
      ? soloZiweiFacts(guardingStars[0], guardingPalace, states, branch)
      : ziweiFacts(guardingStars, guardingPalace, states, branch));
  }
  const guardingBranch = clause.match(/^(.+?)守([子丑寅卯辰巳午未申酉戌亥])(?:位)?(命|.+?宫)$/u);
  if (guardingBranch && parseStars(guardingBranch[1]) && palaceName(guardingBranch[3])) {
    return ziweiFacts(parseStars(guardingBranch[1]), palaceName(guardingBranch[3]), states, guardingBranch[2]);
  }
  const palaceBranch = clause.match(/^(.+?宫)在([子丑寅卯辰巳午未申酉戌亥]+(?:[、或][子丑寅卯辰巳午未申酉戌亥]+)*)$/u);
  if (palaceBranch && palaceName(palaceBranch[1])) {
    return [...new Set(palaceBranch[2].replace(/[、或]/gu, ''))].map(branch =>
      [{ kind: 'palace_branch', palace: palaceName(palaceBranch[1]), branch }]);
  }
  const locatedByBranch = clause.match(/^(.+?)在(.+?)(?:之一)?守(.+)$/u);
  const locatedBranches = locatedByBranch?.[2].replace(/位$/u, '');
  if (locatedByBranch && branchSet.test(locatedBranches)) {
    const names = parseStars(locatedByBranch[1]);
    const places = locatedByBranch[3].split('或').map(palaceName);
    if (names && places.every(Boolean)) return [...locatedBranches].flatMap((branch) =>
      places.flatMap((palace) => ziweiFacts(names, palace, states, branch)));
  }
  const lifeOrOpposite = clause.match(/^(.+?)在命宫或对宫$/u);
  const lifeOrOppositeStars = lifeOrOpposite && parseStars(lifeOrOpposite[1]);
  if (lifeOrOppositeStars?.length) return [
    ...ziweiFacts(lifeOrOppositeStars, '命宫', states),
    ...ziweiFacts(lifeOrOppositeStars, '迁移', states).map(facts => [
      ...facts, { kind: 'palace_relation', anchor: '命宫', target: '迁移', relation: 'opposite' },
    ]),
  ];
  const atBranch = clause.match(/^(.+?)(同)?([子丑寅卯辰巳午未申酉戌亥、]+)(位|同宫)?$/u);
  const branchStars = atBranch && parseStars(atBranch[1]);
  if (branchStars && ((atBranch[2] || atBranch[4] === '同宫') ? branchStars.length >= 2 : atBranch[4] === '位' && branchStars.length === 1)) {
    return [...atBranch[3].replaceAll('、', '')].flatMap((branch) => palaces.flatMap((palace) => ziweiFacts(branchStars, palace, states, branch)));
  }
  const located = clause.match(/^(.+?)(在|守|坐|入|居|临|落|值)([\p{Script=Han}]+)$/u);
  if (located) {
    const [, text, verb, location] = located;
    const names = parseStars(text) ?? (['在', '守', '坐'].includes(verb) && parseStars(text.replace(/同$/u, '')));
    const places = location.split('或').map(palaceName);
    if (names && places.every(Boolean)) {
      const groups = places.flatMap((palace) => ziweiFacts(names, palace, states));
      return verb === '值' ? groups.filter(compatibleZiweiRelativeFacts) : groups;
    }
    const branchNames = location.replace(/之一$/u, '').replace(/[或宫]/gu, '');
    if (names && branchSet.test(branchNames)) {
      return [...branchNames].flatMap((branch) =>
        palaces.flatMap((p) => ziweiFacts(names, p, states, branch)));
    }
  }
  const conjunct = clause.match(/^(.+?)(?:同宫|同垣|同居|同度|同守)$/u);
  const group = conjunct && parseStars(conjunct[1]);
  if (group?.length >= 2) return palaces.flatMap((palace) => ziweiFacts(group, palace, states));
  const onPalace = clause.match(/^(.+?)在(.+?宫)与(.+?)(?:同宫|同垣|同居|同度)$/u);
  if (onPalace) {
    const palace = palaceName(onPalace[2]);
    const names = parseStars(onPalace[1] + '、' + onPalace[3]);
    if (names && palace) return ziweiFacts(names, palace, states);
  }
  const togetherAt = /^(.+?)合于(.+?宫)$/u.exec(clause);
  const togetherNames = togetherAt && parseStars(togetherAt[1]);
  const togetherTarget = togetherAt && palaceName(togetherAt[2]);
  if (togetherNames?.length >= 2 && (palaces.includes(togetherTarget) || togetherTarget === '身宫')) {
    return ziweiFacts(togetherNames, togetherTarget, states);
  }
  const guardedConjunction = clause.match(/^(.+?)(?:守|在)(.+?)(?:且|并)与(.+?)(?:同宫|同守)$/u);
  if (guardedConjunction && !states.length) {
    const palace = palaceName(guardedConjunction[2]);
    const names = parseStars(guardedConjunction[1] + '、' + guardedConjunction[3]);
    if (names && palace) return ziweiFacts(names, palace);
  }
  if (unsplit.includes('且') && !unsplit.includes('或')) {
    const groups = unsplit.split('且').map(ziweiClause);
    if (groups.every(Boolean)) return groups.reduce((lhs, rhs) => lhs.flatMap((first) => rhs.map((last) => [...first, ...last])), [[]]);
  }
  return null;
}

// Palace chapters often bundle independent judgments into one Claim. Keep
// each explicit sub-sentence tied to its own tests and quoted passage.
function ziweiPassageBranches(claim) {
  if (claim.source.book !== '紫微斗数全书' || claim.conditions.excluded.length
    || !claim.conditions.uncertain.every((note) => /^(?:同段的并列条件或简写|原文并列星曜或使用)/u.test(note))) return [];
  const first = claim.conditions.normalized[0]?.match(/^(.+?)在(.+?宫)(?:（奴仆宫）)?$/u);
  const palace = first && palaceName(first[2]);
  const primary = first && parseStars(first[1]);
  if (!palace || palace === '身宫' || !primary?.length || primary.length > 2) return [];
  const names = [primary.join(''), first[1]];
  const states = { 庙旺: ['庙', '旺'], 入庙: ['庙'], 庙地: ['庙'], 陷地: ['陷'], 陷宫: ['陷'], 落陷: ['陷'] };
  const extraction = claim.evidence.original_text.replace(/\s+/gu, '').split(/[，。；;]/u);
  const branches = [];
  const hasExtraCondition = /^(?:且|再|更|加|会|遇|逢|见|与|若|无|有|在|入|居|同|或|不见)|单守|独守|同宫|庙旺|入庙|旺相|陷宫|陷地|(?:加|逢|遇|见|会|照|同)[四吉煞羊陀火铃空劫杀]|诸吉星|[子丑寅卯辰巳午未申酉戌亥]宫/u;
  const hasOutcome = (text) => /^(?:仅|只|亦)?(?:有)?[一二两三四五六七八九十]+(?:人|子|女)$/u.test(text)
    || /^(?:亦)?(?:不和|刑克|刑剋|内助|年少|孤单|孤克|少克|无刑|无克|灾少|富贵|财旺|晚发|迟发|和睦|劳碌|作巨商)$/u.test(text)
    || (text.length >= 4 && !hasExtraCondition.test(text));
  const continuation = /^(?:不见|不遇|无|须|必得|又要|更须|又须|若无|若不|然后|方可|方为|方主|主则)/u;
  const lead = names.find((name) => extraction[0].startsWith(name));
  for (const [index, text] of extraction.entries()) {
    if (continuation.test(extraction[index + 1] ?? '')) continue;
    const initial = index === 0 && lead;
    const phrase = initial ? text.slice(lead.length) : text;
    const positioned = (initial || (lead && index === 1)) && phrase.match(/^(?:在|于|居)([子丑寅卯辰巳午未申酉戌亥]+)宫(?:方)?(.+)$/u);
    if (positioned && hasOutcome(positioned[2])) {
      branches.push({ text, facts: [...positioned[1]].flatMap((branch) => ziweiFacts(primary, palace, [], branch)) });
      continue;
    }
    const solo = initial && primary.length === 1 && coreStars.has(primary[0])
      && phrase.match(/^(庙旺|入庙|陷地|陷宫)?(?:独守|单守|单居)(.+)$/u);
    if (solo && hasOutcome(palace === '迁移' ? solo[2].replace(/^在外/u, '') : solo[2])) {
      branches.push({ text, facts: soloZiweiFacts(primary[0], palace, states[solo[1]]) });
      continue;
    }
    const state = Object.keys(states).find((level) => phrase.startsWith(level));
    // An immediately following opposite brightness clause can keep the same subject.
    const previousState = index === 1 && lead && Object.keys(states).find((level) => extraction[0].startsWith(lead + level));
    const contrast = state && previousState && (states[state].includes('陷') !== states[previousState].includes('陷'))
      && hasOutcome(extraction[0].slice(lead.length + previousState.length));
    if (initial || contrast) {
      const rest = phrase.slice(state?.length ?? 0);
      const numeric = rest.match(/^((?:有)?[一二两三四五六七八九十]+(?:人|子|女))(?=加吉星)/u)?.[1];
      const outcome = palace === '迁移' ? rest.replace(/^在外/u, '') : rest;
      if (numeric || hasOutcome(outcome)) {
        branches.push({ text: numeric ? text.slice(0, text.length - rest.length + numeric.length) : text,
          facts: ziweiFacts(primary, palace, states[state] ?? []) });
      }
    } else {
      const split = text.match(/^(?:与)?(.{2,8}?)同(?:宫|垣)?(.+)$/u);
      const companion = split && parseStars(split[1]);
      if (companion?.length && companion.every((star) => !primary.includes(star)) && hasOutcome(split[2])) {
        branches.push({ text, facts: ziweiFacts([...primary, ...companion], palace) });
      }
    }
  }
  return branches.map(({ text, facts }) => ({ text, inputs: facts.map((required) => normalizeRuleInput('ziwei', { required })) }));
}

function ziweiExplicitBranches(claim) {
  if (claim.source.book !== '紫微斗数全书' || claim.conditions.excluded.length
    || claim.conditions.normalized.length < 2
    || !claim.conditions.uncertain.every((note) => /^(?:同段的并列条件或简写|原文并列星曜或使用)/u.test(note))) return [];
  const quotes = claim.evidence.original_text.split(/[。\n]+/u).map((line) => line.trim()).filter(Boolean);
  if (quotes.length !== claim.conditions.normalized.length) return [];
  const result = [];
  for (const [index, value] of claim.conditions.normalized.entries()) {
    const parts = value.match(/^(.+?宫)(.+?)[:：]([子丑寅卯辰巳午未申酉戌亥]+)宫(得地|入庙|利益|庙旺|处利益)[,，]([甲乙丙丁戊己庚辛壬癸]+)生人(?:贵格|大贵)?$/u);
    if (!parts || !palaceName(parts[1]) || !stars.includes(parts[2])) continue;
    const [, palace, star, branches, qualifier, stems] = parts;
    const labels = { 得地: ['得'], 入庙: ['庙'], 利益: ['利'], 处利益: ['利'], 庙旺: ['庙', '旺'] };
    const facts = [...branches].flatMap((branch) => ziweiFacts([star], palaceName(palace), labels[qualifier], branch).flatMap((slot) =>
      [...stems].map((stem) => [...slot, { kind: 'natal_year_stem', stem }])));
    result.push({ text: quotes[index], inputs: facts.map((required) => normalizeRuleInput('ziwei', { required })) });
  }
  return result;
}

function ziweiMingGongTable(claim) {
  if (!/^ziwei-v2-minggong-/u.test(claim.id) || claim.conditions.excluded.length
    || !claim.conditions.uncertain.some((note) => note.startsWith('各行配对按原书分别读'))) return [];
  const star = claim.conditions.normalized[0]?.match(/^命宫(.+?)[：:]/u)?.[1];
  if (!stars.includes(star) || !claim.conditions.normalized.every((text) => text.startsWith('命宫' + star + '：'))) return [];
  const results = [];
  const levels = { 入庙: '庙', 庙: '庙', 旺地: '旺', 旺宫: '旺', 旺: '旺', 得地: '得', 陷地: '陷', 陷宫: '陷', 陷: '陷',
    处和平: '平', 和平: '平', 处利益: '利', 利益: '利', 处利: '利', 利: '利' };
  const position = new RegExp(`^([${branches}]+)(宫)?(${Object.keys(levels).join('|')})?`, 'u');
  const compatibleOutcome = /^(?:财官格|财格|贵格|贵不耐久|大贵(?:财官格)?|贵|有成败|为福(?:不耐久)?|福厚(?:财官格)?|福不耐久|主贵|主困|困|次之|禄合格|孤寡不耐久|不耐久|悔吝|成败带疾|利达|利|吉)$/u;
  const birth = new RegExp(`^喜?([${stems}]+)生人(.*)$`, 'u');
  for (const line of claim.evidence.original_text.split(/\r?\n/u)) {
    const original = line.trim();
    let rest = original;
    const placements = [];
    for (let placed = position.exec(rest); placed && (placed[2] || placed[3]); placed = position.exec(rest)) {
      placements.push(...[...placed[1]].map((branch) => [branch, placed[3] ? [levels[placed[3]]] : []]));
      rest = rest.slice(placed[0].length).replace(/^[，,]/u, '');
    }
    if (!placements.length || rest.startsWith('不得地')) continue;
    const companion = rest.match(/^(?:与)?(.{2,4}?)同(?:宫|度|垣)[，,]?/u);
    const secondary = companion && parseStars(companion[1]);
    if (companion && secondary?.length !== 1) continue;
    if (companion) rest = rest.slice(companion[0].length);
    const solo = /^(?:单守|独守)[，,]?/u.exec(rest);
    if (solo) {
      if (companion || !majorStars.includes(star)) continue;
      rest = rest.slice(solo[0].length);
    }
    const headLength = original.length - rest.length;
    const paragraphs = rest.split(/[，,。]/u);
    if (!paragraphs[0] || !(birth.test(paragraphs[0]) || compatibleOutcome.test(paragraphs[0]))) continue;
    for (const [index, fragment] of paragraphs.entries()) {
      if (!fragment) continue;
      const selection = birth.exec(fragment);
      if (index > 0 && !selection) continue;
      if (!compatibleOutcome.test(selection?.[2] ?? fragment)) continue;
      const preferred = selection ? [...new Set(selection[1])] : [null];
      const inputs = placements.flatMap(([branch, [brightness]]) => {
        const [facts] = ziweiFacts([star, ...(secondary ?? [])], '命宫', [], branch);
        if (brightness) facts.push({ kind: 'palace_brightness', palace: '命宫', star, scope: 'origin', brightness });
        if (solo) facts.push({ kind: 'palace_main_count', palace: '命宫', count: 1 });
        return preferred.map((stem) => normalizeRuleInput('ziwei', {
          required: stem ? [...facts, { kind: 'natal_year_stem', stem }] : facts,
        }));
      });
      const text = index === 0 ? original.slice(0, headLength + fragment.length) : fragment;
      results.push({ text, inputs });
    }
  }
  return results;
}

function mappedPassages(method, claim) {
  const passages = claimPassages[claim.id] ?? [];
  const byText = new Map();
  for (const [text, clauses, exclusions = [], periodAnchor] of passages) {
    const groups = clauses.map((clause) => method === 'bazi' ? baziClause(clause, true) : ziweiClause(clause));
    const exclusionGroups = exclusions.map((clause) => method === 'bazi' ? baziAbsences(clause) : ziweiAbsences(clause));
    if (!claim.evidence.original_text.includes(text) && !claimContextText(claim.evidence.context).includes(text)) continue;
    const parsedConditions = [...groups, ...exclusionGroups];
    const invalidCondition = [...clauses, ...exclusions].find((_, index) => !parsedConditions[index]?.length);
    if (invalidCondition !== undefined) throw new Error('Invalid mapped condition for ' + claim.id + ': ' + invalidCondition);
    const alternatives = groups.reduce((lhs, rhs) => lhs.flatMap((first) => rhs.map((last) => [...first, ...last])), [[]]);
    let decadalAnchor;
    if (periodAnchor) {
      const palace = method === 'ziwei' && palaceName(periodAnchor);
      if (palaces.includes(palace)) decadalAnchor = { kind: 'ziwei_decadal_range', palace };
      if (method === 'bazi' && LunarUtil.NAYIN[periodAnchor]) decadalAnchor = { kind: 'bazi_decadal_range', ganZhi: periodAnchor };
      if (!decadalAnchor) throw new Error('Invalid decadal anchor for ' + claim.id + ': ' + periodAnchor);
    }
    const key = JSON.stringify([text, decadalAnchor]);
    const branch = byText.get(key) ?? { text, inputs: [], ...(decadalAnchor && { decadalAnchor }) };
    const mustBeAbsent = exclusionGroups.flat();
    branch.inputs.push(...alternatives.map((required) => normalizeRuleInput(method, { required, mustBeAbsent })));
    byText.set(key, branch);
  }
  return [...byText.values()];
}

function baziTemperamentPassage(claim) {
  if (!/^smth-v7-temperament-p00[2-6]-/u.test(claim.id) || claim.conditions.excluded.length) return [];
  const placed = claim.conditions.normalized[0]?.match(/^([木火土金水])(?:处|气)(旺相|休囚|太过|不及)[，；]/u);
  const text = claim.evidence.original_text;
  if (!placed || !text.startsWith(placed[2] === '太过' ? '太過' : placed[2])) return [];
  return [{ text, inputs: [normalizeRuleInput('bazi', { required: [
    { kind: 'bazi_element_temperament', element: placed[1], classification: placed[2], profile: 'element-weighted-temperament-v1' },
  ] })] }];
}

function baziAbsences(clause) {
  if (clause === '原局无官星') clause = '原局无正官';
  const weakGroup = clause.match(/^(.+)不旺$/u)?.[1];
  if (Object.hasOwn(tenGodStrengthGroups, weakGroup)) return baziClause(weakGroup + '旺')[0];
  const missingNayin = clause.match(/^四柱无纳音(.+)$/u)?.[1];
  if (missingNayin) {
    const names = /^[木火土金水]$/u.test(missingNayin)
      ? nayinNames.filter((name) => name.endsWith(missingNayin)) : nayinNames.filter((name) => name === missingNayin);
    return names.length ? positionNames.flatMap((position) => names.map((name) => ({ kind: 'pillar_nayin', position, name }))) : null;
  }
  const missingElement = clause.match(/^五行无([木火土金水])$/u);
  if (missingElement) return [{ kind: 'bazi_natal_element', element: missingElement[1] }];
  if (clause === '原局无天干五合') return positionNames.flatMap((first, index) => positionNames.slice(index + 1)
    .map((second) => ({ kind: 'bazi_stem_combination', first, second })));
  if (clause === '四柱无六冲') return positionNames.flatMap((first, index) => positionNames.slice(index + 1)
    .map((second) => baziBranchRelation('六冲', first, second)));
  const noTransformation = clause.match(/^原局无([甲乙丙丁戊己庚辛壬癸]{2}化[木火土金水])$/u);
  if (noTransformation) return baziClause(noTransformation[1])?.flat() ?? null;
  if (clause === '原局无加临魁罡') return ['year', 'month', 'hour'].flatMap((position) =>
    kuiGangPillars.map((ganZhi) => ({ kind: 'pillar', position, ganZhi })));
  const noShenSha = clause.match(/^(四柱|[年月日时]柱)无(空亡|孤辰|寡宿|劫煞|亡神|官符|元辰|勾神|绞神|天罗|地网|桃花|天乙贵人|文昌贵人|禄神|天德|月德)$/u);
  if (noShenSha) return (noShenSha[1] === '四柱' ? positionNames : [positions[noShenSha[1][0]]])
    .map((position) => ({ kind: 'shen_sha', position, name: noShenSha[2] }));
  const exactPillar = clause.replace(/^不(?:见|是)/u, '');
  if (exactPillar !== clause && baziAtom(exactPillar)?.kind === 'pillar') return [baziAtom(exactPillar)];
  const forbiddenGods = clause.match(/^(本命|原局|四柱|柱中|天干|年月)无(正官|七杀|官杀|正财|偏财|财星|印绶|正印|偏印|食神|伤官|比肩|劫财)$/u);
  if (forbiddenGods) return (forbiddenGods[1] === '年月' ? ['year', 'month'] : positionNames)
    .flatMap((position) => godFacts(forbiddenGods[2], position,
      forbiddenGods[1] === '天干' ? ['stem_ten_god'] : ['stem_ten_god', 'branch_ten_god']));
  const noBranchLink = clause.match(/^([年月日时])支无([冲合刑破害]{1,5})$/u);
  if (noBranchLink) {
    const relationNames = { 冲: ['六冲'], 合: ['六合', '三合'], 刑: ['相刑', '自刑', '三刑'], 破: ['相破'], 害: ['六害'] };
    const position = positions[noBranchLink[1]];
    return positionNames.filter((other) => other !== position).flatMap((other) =>
      [...noBranchLink[2]].flatMap((name) => relationNames[name].map((relation) => baziBranchRelation(relation, position, other))));
  }
  const input = clause.match(/^(?:又以)?(年月|月时|柱|四柱|原局)(?:均)?(?:不见|无|忌)([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥、]+?)(?:字|[填塡]实|[填塡]實)?(?:为吉)?$/u);
  if (!input) return null;
  const positionsToCheck = input[1] === '年月' ? ['year', 'month'] : input[1] === '月时' ? ['month', 'hour'] : positionNames;
  return positionsToCheck.flatMap((position) => [...input[2].replaceAll('、', '')].map((name) =>
    stems.includes(name) ? { kind: 'stem', position, stem: name } : { kind: 'branch', position, branch: name }));
}

function ziweiAbsences(clause) {
  const match = clause.match(/^(.+?宫)(三方四正|两邻)?无(.+)$/u);
  const palace = match && palaceName(match[1]);
  if (!palaces.includes(palace)) return null;
  const offsets = { 三方四正: [0, -4, 4, 6], 两邻: [-1, 1] }[match[2]] ?? [0];
  const targets = palaceSectors(palace, offsets);
  const change = match[3].match(/^化([禄权科忌])$/u);
  if (change) return targets.map((palace) => ({ kind: 'palace_mutagen', palace, scope: 'origin', change: change[1] }));
  const omitted = parseStars(match[3].replaceAll('空劫', '地空、天空、地劫'));
  return omitted ? targets.flatMap((palace) => ziweiFacts(omitted, palace)[0]) : null;
}

export function claimChartContext(method, chart, calculationFacts = [], dignityCellsAt, readFortitudeRows,
  { wealthHistory = false, ptolemyDignitiesAt, cardanoFortune = false, ptolemyBookOne = false,
    ptolemyBookOneDignitiesAt, ptolemyFixedStars = false, ptolemyTravel = false, ptolemyTravelDignitiesAt } = {}) {
  const absentKeys = new Set(chart.absentKeys);
  const declaredGenders = new Set(chart.present.filter(fact => fact.kind === 'natal_gender').map(fact => fact.gender));
  if (declaredGenders.size > 1) {
    const present = chart.present.filter(fact => fact.kind !== 'natal_gender');
    chart = { ...chart, present, presentKeys: new Set(present.map(fact => JSON.stringify(fact))) };
    for (const key of absentKeys) if (JSON.parse(key).kind === 'natal_gender') absentKeys.delete(key);
  }
  if (method === 'western') {
    // Client-provided derived claims cannot bypass the precise cusp/longitude
    // calculation, including by asserting their absence in an exclusion.
    const isDerived = kind => kind.startsWith('western_lilly_') || kind.startsWith('western_ptolemy_fortune_')
      || kind.startsWith('western_cardano_fortune_') || kind.startsWith('western_ptolemy_book_one_')
      || kind.startsWith('western_ptolemy_fixed_star_') || kind.startsWith('western_ptolemy_travel_')
      || kind.startsWith('western_ptolemy_siblings_')
      || ['western_cardano_dignity', 'western_ptolemy_parent'].includes(kind);
    const raw = chart.present.filter(fact => !isDerived(fact.kind));
    const genders = new Set(raw.filter(fact => fact.kind === 'natal_gender').map(fact => fact.gender));
    const fortune = lillyFortune(raw);
    const houses = lillyHouseFacts(raw);
    const nodes = lillyNodeFacts(raw);
    const dignities = lillyDignityFacts(raw, dignityCellsAt, { includeCount: true });
    const solar = lillySolarFacts(raw);
    const ptolemyFortune = chart.scope === 'natal' ? ptolemyFortuneFacts(raw, solar, ptolemyDignitiesAt) : [];
    let fortitudeRanges;
    const readFortitudeRanges = readFortitudeRows
      ? () => fortitudeRanges ??= lillyFortitudeRanges(raw, dignityCellsAt, readFortitudeRows()) : undefined;
    const lillyRoleEvidence = chart.scope === 'natal' ? lillyBookThreeRoleEvidence(
      raw, calculationFacts, houses, nodes, dignities, readFortitudeRanges, dignityCellsAt) : new Map();
    const present = [...raw.filter(fact => genders.size <= 1 || fact.kind !== 'natal_gender'),
      ...normalizeFacts('western', [...houses, ...nodes, ...lillyFortuneFacts(fortune), ...lillySharedRulerFacts(fortune, houses, raw), ...lillyAscendantRulerFacts(houses, raw),
        ...lillyRulerHouseClassFacts(houses), ...lillyAspectFacts(raw, calculationFacts, fortune), ...dignities,
        ...lillyReceptionFacts(raw, calculationFacts, dignityCellsAt), ...lillyProfessionFacts(raw, dignityCellsAt, { includeSteps: true }),
        ...lillySignClassFacts(raw, dignityCellsAt),
        ...solar, ...lillyMotionFacts(raw),
        ...(chart.scope === 'natal' ? [
          ...lillyProfessionConditions(raw, houses, dignities),
          ...cardanoDignityFacts(raw), ...lillyTravelFacts(raw, houses, dignityCellsAt),
          ...lillySiblingsFacts(raw, houses, nodes),
          ...lillyWealthSourcesFacts(raw, houses, fortune),
          ...lillyWealthDurationFacts(raw, fortune),
          ...lillyFortuneWitnessFacts(raw, fortune, solar, dignityCellsAt),
          ...lillyWealthPrincipalFacts(raw, houses, fortune, dignities, readFortitudeRanges, { historical: wealthHistory }),
          ...lillyChildrenFacts(raw, houses, nodes),
          ...lillyWitFacts(raw, houses),
          ...lillyPrefermentFacts(raw, houses, dignities, dignityCellsAt),
          ...lillyEnemiesFacts(raw, houses, dignities),
          ...lillyFriendsFacts(raw, houses, dignities, readFortitudeRanges),
          ...lillyNinthHouseFacts(raw, houses, nodes, dignities, solar),
          ...lillyMannersFacts(raw, houses, dignityCellsAt),
          ...lillyTemperamentFacts(raw, houses, nodes, solar),
          ...lillyParentDerivedFacts(raw, houses, chart.lillyParentDerivedFigure),
          ...lillyFamilyFacts(raw, houses, dignities),
          ...lillyBookOneAspectFacts(raw, calculationFacts, dignities, solar),
          ...lillyBookThreeFacts(lillyRoleEvidence),
          ...ptolemyParentsFacts(raw, chart.ptolemyParentAttendanceText),
          ...ptolemyFortune,
          ...ptolemySiblingFacts(raw, calculationFacts, ptolemyFortune.find(fact => fact.kind === 'western_ptolemy_fortune_point')),
          ...(cardanoFortune ? cardanoFortuneFacts(raw) : []),
          ...(ptolemyBookOne ? ptolemyBookOneFacts(raw, ptolemyBookOneDignitiesAt) : []),
          ...(ptolemyFixedStars ? ptolemyFixedStarFacts(raw) : []),
          ...(ptolemyTravel ? ptolemyTravelFacts(raw, ptolemyTravelDignitiesAt) : []),
        ] : [])])];
    chart = { ...chart, present, presentKeys: new Set(present.map(fact => JSON.stringify(fact))) };
    for (const key of absentKeys) if (isDerived(JSON.parse(key).kind)) absentKeys.delete(key);
    // Only a confirmed, unambiguous selector can establish its other values as absent.
    const domains = {
      planet_sign: ['sign', zodiacNamesForClaims], planet_house: ['house', Array.from({ length: 12 }, (_, i) => i + 1)],
      planet_motion: ['motion', ['direct', 'retrograde', 'stationary']], angle_sign: ['sign', zodiacNamesForClaims],
      house_sign: ['sign', zodiacNamesForClaims], western_sect: ['sect', ['day', 'night']],
      western_profile_planet_house: ['house', Array.from({ length: 12 }, (_, i) => i + 1)],
      western_profile_house_sign: ['sign', zodiacNamesForClaims],
      western_lilly_planet_house: ['house', Array.from({ length: 12 }, (_, i) => i + 1)],
      western_lilly_node_house: ['house', Array.from({ length: 12 }, (_, i) => i + 1)],
      western_lilly_node_sign: ['sign', zodiacNamesForClaims],
      western_lilly_ruler_house: ['placedIn', Array.from({ length: 12 }, (_, i) => i + 1)],
      western_lilly_house_ruler: ['planet', ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']],
      natal_gender: ['gender', ['男', '女']],
      western_lilly_aspect: ['matches', [true, false]],
      western_lilly_dignity: ['matches', [true, false]],
      western_lilly_dignified_count: ['count', Array.from({ length: 8 }, (_, i) => i)],
      western_lilly_reception: ['matches', [true, false]],
      western_lilly_profession_ruler: ['matches', [true, false]],
      western_lilly_sign_class: ['matches', [true, false]],
      western_lilly_solar_state: ['matches', [true, false]],
      western_lilly_speed_state: ['matches', [true, false]],
      western_lilly_fortune_house: ['house', Array.from({ length: 12 }, (_, i) => i + 1)],
    };
    for (const [kind, [field, domain]] of Object.entries(domains)) {
      const selectors = new Map();
      for (const fact of chart.present.filter(fact => fact.kind === kind)) {
        const { [field]: value, ...selector } = fact;
        const key = JSON.stringify(selector);
        if (!selectors.has(key)) selectors.set(key, { selector, values: new Set() });
        selectors.get(key).values.add(value);
      }
      for (const { selector, values } of selectors.values()) {
        if (values.size !== 1 || !domain.includes([...values][0])) continue;
        for (const value of domain) if (!values.has(value)) {
          const [fact] = normalizeFacts('western', [{ ...selector, [field]: value }]);
          if (!chart.presentKeys.has(JSON.stringify(fact))) absentKeys.add(JSON.stringify(fact));
        }
      }
    }
    return { ...chart, absentKeys, lillyRoleEvidence };
  }
  if (method === 'ziwei') {
    const derived = [];
    const brightnessKey = ({ palace, star, scope }) => JSON.stringify([palace, star, scope]);
    const brightnessByStar = new Map();
    for (const fact of chart.present.filter(fact => fact.kind === 'palace_brightness')) {
      const key = brightnessKey(fact);
      if (!brightnessByStar.has(key)) brightnessByStar.set(key, new Set());
      brightnessByStar.get(key).add(fact.brightness);
    }
    const consistentBrightness = fact => fact.kind !== 'palace_brightness' || brightnessByStar.get(brightnessKey(fact)).size === 1;
    for (const key of absentKeys) {
      if (key.startsWith('{"kind":"palace_source_brightness",') || key.startsWith('{"kind":"palace_sector_star",')
        || key.startsWith('{"kind":"palace_opposite_')
        || key.startsWith('{"kind":"palace_sector_benefic_majority",')
        || key.startsWith('{"kind":"palace_sector_mutagen",')
        || key.startsWith('{"kind":"palace_changsheng_phase",')
        || key.startsWith('{"kind":"palace_trine_star",') || key.startsWith('{"kind":"palace_confirmed_body_seat",')
        || key.startsWith('{"kind":"palace_origin_star_count",')
        || key === '{"kind":"palace_life_trines_without_auspicious_mutagens"}'
        || key === '{"kind":"palace_life_without_trine_auspicious_mutagens"}'
        || key === '{"kind":"ziwei_confirmed_natal_layout"}'
        || key === '{"kind":"palace_life_without_natal_ji"}') absentKeys.delete(key);
    }
    derived.push(...quanshuMinggongFacts(chart.present, chart.scope));
    const originByPalace = new Map(palaces.map((palace) => [palace, { stars: new Set(), counts: new Set(), mainCounts: new Set() }]));
    const changesByStar = new Map();
    for (const { kind, palace, star, scope, count, change } of chart.present) {
      if (kind === 'palace_star' && scope === 'origin') originByPalace.get(palace)?.stars.add(star);
      if (kind === 'palace_origin_star_count') originByPalace.get(palace)?.counts.add(count);
      if (kind === 'palace_main_count') originByPalace.get(palace)?.mainCounts.add(count);
      if (kind === 'star_mutagen' && scope === 'origin') {
        const key = JSON.stringify([palace, star]);
        if (!changesByStar.has(key)) changesByStar.set(key, new Set());
        changesByStar.get(key).add(change);
      }
    }
    const completeOrigins = new Set([...originByPalace].filter(([, { stars, counts }]) => counts.size === 1 && counts.has(stars.size))
      .map(([palace]) => palace));
    for (const [palace, { stars }] of originByPalace) {
      if (stars.size > 1) absentKeys.add(JSON.stringify({ kind: 'palace_origin_star_count', palace, count: 1 }));
    }
    const verifiedMainCounts = new Set([...originByPalace].filter(([palace, { stars, mainCounts }]) => {
      if (mainCounts.size !== 1) return false;
      const [reported] = mainCounts;
      const observed = majorStars.filter(star => stars.has(star)).length;
      return completeOrigins.has(palace) ? reported === observed : reported > 0 && reported >= observed;
    }).map(([palace]) => palace));
    const majorStates = new Map(palaces.map((palace) => [palace, new Set()]));
    for (const { kind, palace, star, scope, brightness } of chart.present.filter(consistentBrightness)) {
      if (kind !== 'palace_brightness' || scope !== 'origin' || !originByPalace.get(palace)?.stars.has(star)) continue;
      const changes = [...(changesByStar.get(JSON.stringify([palace, star])) ?? [])];
      if (['庙', '旺', '陷'].includes(brightness)) {
        for (const change of changes) derived.push({ kind: 'palace_mutagen_brightness', palace, change, brightness });
      }
      if (!majorStars.includes(star)) continue;
      const states = majorStates.get(palace);
      if (brightness === '陷') states.add('陷地');
      if (brightness === '庙') states.add('入庙');
      if (['庙', '旺'].includes(brightness)) states.add('庙旺');
      if (['庙', '旺'].includes(brightness) && changes.some((change) => change !== '忌')) states.add('庙旺化吉');
    }
    const bodyPalaces = new Set(chart.present.filter(({ kind, palace }) => kind === 'body_palace' && palaces.includes(palace))
      .map(({ palace }) => palace));
    const palaceBranches = new Map(palaces.map(palace => [palace, new Set()]));
    for (const { kind, palace, branch } of chart.present) {
      if (kind === 'palace_branch') palaceBranches.get(palace)?.add(branch);
    }
    const branchAt = (palace) => {
      const known = palaceBranches.get(palace);
      return known?.size === 1 ? known.values().next().value : null;
    };
    const lifeIndex = branches.indexOf(branchAt('命宫'));
    if (chart.scope === 'natal' && lifeIndex >= 0 && palaces.every((palace, index) =>
      branchAt(palace) === branches[(lifeIndex - index + 12) % 12])) {
      derived.push({ kind: 'ziwei_confirmed_natal_layout' });
    }
    derived.push(...ziweiPalaceChangshengFacts(chart.present, branchAt, chart.scope));
    const natalHours = new Set(chart.present.filter(fact => fact.kind === 'natal_ziwei_hour').map(fact => fact.branch));
    const confirmedSectorRelation = (anchor, target, relation) => {
      if (!chart.presentKeys.has(JSON.stringify({ kind: 'palace_relation', anchor, target, relation }))
        || palaceBranches.get(anchor).size > 1 || palaceBranches.get(target).size > 1) return false;
      const first = branchAt(anchor), second = branchAt(target);
      if (first && !branches.includes(first) || second && !branches.includes(second)) return false;
      if (!first || !second) return true;
      const distance = (branches.indexOf(second) - branches.indexOf(first) + 12) % 12;
      return relation === 'opposite' ? distance === 6 : distance === 4 || distance === 8;
    };
    if (bodyPalaces.size === 1) {
      const [palace] = bodyPalaces;
      const [hourBranch] = natalHours;
      const from = branches.indexOf(branchAt('命宫')), to = branches.indexOf(branchAt(palace));
      if (chart.scope === 'natal' && natalHours.size === 1 && branches.includes(hourBranch)
        && from >= 0 && to >= 0 && (to - from + 12) % 12 === (2 * branches.indexOf(hourBranch)) % 12) {
        derived.push({ kind: 'palace_confirmed_body_seat', palace });
      }
      for (const state of majorStates.get(palace)) derived.push({ kind: 'palace_major_state', palace: '身宫', state });
      const known = originByPalace.get(palace).stars;
      if (beneficStars.some((star) => known.has(star))) derived.push({ kind: 'palace_body_star_group', group: '六吉' });
      if (maleficStars.some((star) => known.has(star))) derived.push({ kind: 'palace_body_star_group', group: '四煞' });
      if (chart.scope === 'natal' && palace !== '命宫' && completeOrigins.has('命宫') && completeOrigins.has(palace)) {
        const lifeMajors = majorStars.filter((star) => originByPalace.get('命宫').stars.has(star));
        const bodyMajors = majorStars.filter((star) => known.has(star));
        const lifeBranch = branchAt('命宫');
        const bodyBranch = branchAt(palace);
        if (lifeBranch && bodyBranch && lifeMajors.length === 1 && bodyMajors.length === 1
          && ziweiLifeBodyClash(lifeBranch, bodyBranch, lifeMajors[0], bodyMajors[0])) {
          derived.push({ kind: 'ziwei_life_body_clash' });
        }
      }
    }
    for (const palace of palaces) {
      const known = originByPalace.get(palace).stars;
      const sector = new Set(known);
      const trine = new Set();
      const provenPalaces = [palace];
      let completeTrines = 0;
      for (const [index, target] of palaceSectors(palace, [-4, 4, 6]).entries()) {
        const relation = index === 2 ? 'opposite' : 'trine';
        if (confirmedSectorRelation(palace, target, relation)) {
          provenPalaces.push(target);
          const knownTrine = relation === 'trine' && branchAt(palace) && branchAt(target);
          if (knownTrine && completeOrigins.has(target)) completeTrines++;
          const targetStars = originByPalace.get(target).stars;
          if (chart.scope === 'natal' && relation === 'opposite' && branchAt(palace) && branchAt(target)
            && completeOrigins.has(target)) {
            derived.push(
              { kind: 'palace_opposite_benefic_count', palace, count: beneficStars.filter(star => targetStars.has(star)).length },
              { kind: 'palace_opposite_six_malefic_count', palace, count: ziweiSectorExclusionStars.filter(star => targetStars.has(star)).length },
            );
          }
          for (const star of targetStars) {
            sector.add(star);
            if (knownTrine) trine.add(star);
          }
        }
      }
      for (const star of sector) derived.push({ kind: 'palace_sector_star', palace, star });
      for (const star of trine) derived.push({ kind: 'palace_trine_star', palace, star });
      if (completeTrines === 2) {
        for (const star of coreStars) {
          if (!trine.has(star)) absentKeys.add(JSON.stringify({ kind: 'palace_trine_star', palace, star }));
        }
      }
      for (const state of majorStates.get(palace)) derived.push({ kind: 'palace_major_state', palace, state });
      if (provenPalaces.length === 4 && provenPalaces.every((target) =>
        beneficStars.some((star) => originByPalace.get(target).stars.has(star)))) {
        derived.push({ kind: 'palace_sector_all_benefic', palace });
      }
      if (provenPalaces.length === 4 && provenPalaces.every((target) => completeOrigins.has(target))) {
        const beneficCount = beneficStars.filter((star) => sector.has(star)).length;
        const maleficCount = ziweiSectorExclusionStars.filter((star) => sector.has(star)).length;
        const beneficMajority = { kind: 'palace_sector_benefic_majority', palace };
        derived.push({ kind: 'palace_sector_benefic_count', palace, count: beneficCount });
        derived.push({ kind: 'palace_sector_malefic_count', palace, count: maleficStars.filter((star) => sector.has(star)).length });
        derived.push({ kind: 'palace_sector_six_malefic_count', palace, count: maleficCount });
        if (chart.scope === 'natal') {
          if (beneficCount >= 2 && beneficCount > maleficCount) derived.push(beneficMajority);
          else absentKeys.add(JSON.stringify(beneficMajority));
        }
        for (const star of sectorExclusionStars) {
          if (!sector.has(star)) absentKeys.add(JSON.stringify({ kind: 'palace_sector_star', palace, star }));
        }
      }
      if (!completeOrigins.has(palace)) continue;
      derived.push({ kind: 'palace_core_star_count', palace, count: [...known].filter((star) => coreStars.has(star)).length });
      for (const star of [...stars, '截路', '天伤']) {
        if (!known.has(star)) absentKeys.add(JSON.stringify({ kind: 'palace_star', palace, star, scope: 'origin' }));
      }
    }
    const changePalaces = new Map([...'禄权科忌'].map((change) => [change, new Set(chart.present
      .filter((fact) => fact.kind === 'palace_mutagen' && fact.scope === 'origin' && fact.change === change)
      .map(({ palace }) => palace))]));
    const confirmedChangePalace = change => {
      const seats = changePalaces.get(change);
      if (seats.size !== 1) return null;
      const [palace] = seats;
      const hosts = chart.present.filter(fact => fact.kind === 'star_mutagen' && fact.scope === 'origin' && fact.change === change);
      return hosts.length === 1 && hosts[0].palace === palace
        && originByPalace.get(palace)?.stars.has(hosts[0].star) && branchAt(palace) ? palace : null;
    };
    const lifeTrines = palaceSectors('命宫', [4, -4]);
    const lifeAndTrines = ['命宫', ...lifeTrines];
    if (chart.scope === 'natal' && branchAt('命宫') && chart.present.some(fact => fact.kind === 'natal_year_stem')
      && compatibleZiweiNatalMutagens(chart.present)) {
      const confirmed = new Map([...'禄权科忌'].map(change => [change, confirmedChangePalace(change)]));
      for (const [change, palace] of confirmed) {
        if (palace) derived.push({ kind: 'natal_ziwei_mutagen_branch', change, branch: branchAt(palace) });
      }
      for (const palace of palaces.filter(branchAt)) {
        const axis = [palace, ...palaceSectors(palace, [4, -4, 6]).filter((target, index) =>
          confirmedSectorRelation(palace, target, index === 2 ? 'opposite' : 'trine'))];
        for (const [change, host] of confirmed) {
          if (axis.includes(host)) derived.push({ kind: 'palace_sector_mutagen', palace, change });
        }
      }
      const jiPalace = confirmed.get('忌');
      const outsideLife = jiPalace && jiPalace !== '命宫' && branchAt(jiPalace) !== branchAt('命宫');
      const knownTrines = lifeTrines.every(palace => branchAt(palace) && confirmedSectorRelation('命宫', palace, 'trine'));
      const changesOutside = seats => [...'禄权科'].every(change => confirmed.get(change) && !seats.includes(confirmed.get(change)));
      if (outsideLife) derived.push({ kind: 'palace_life_without_natal_ji' });
      if (knownTrines && changesOutside(lifeAndTrines)) derived.push({ kind: 'palace_life_trines_without_auspicious_mutagens' });
      if (knownTrines && changesOutside(lifeTrines)) derived.push({ kind: 'palace_life_without_trine_auspicious_mutagens' });
    }
    const eightSeats = ['命宫', '夫妻', '迁移', '财帛', '官禄', '福德'];
    const seatBranches = eightSeats.map(branchAt);
    const auspiciousPalaces = [...'禄权科'].filter((change) => changePalaces.get(change).size === 1)
      .map((change) => [...changePalaces.get(change)][0]);
    if (chart.scope === 'natal' && bodyPalaces.size === 1 && bodyPalaces.has('夫妻')
      && seatBranches.every(Boolean) && new Set(seatBranches).size === eightSeats.length
      && seatBranches.every((branch) => branches.indexOf(branch) % 2 === branches.indexOf(seatBranches[0]) % 2)
      && auspiciousPalaces.length === 3 && auspiciousPalaces.every((palace) => eightSeats.includes(palace))
      && eightSeats.every((palace) => completeOrigins.has(palace)
        && (majorStates.get(palace).has('庙旺') || auspiciousPalaces.includes(palace)
          || beneficStars.some((star) => originByPalace.get(palace).stars.has(star))))) {
      derived.push({ kind: 'ziwei_eight_seats' });
    }
    if ([...changePalaces.values()].every((sites) => sites.size === 1)) {
      for (const [change, sites] of changePalaces) {
        for (const palace of palaces) {
          if (!sites.has(palace)) absentKeys.add(JSON.stringify({ kind: 'palace_mutagen', palace, change, scope: 'origin' }));
        }
      }
    }
    const lifeSector = palaceSectors('命宫', [0, 4, -4, 6]);
    if (chart.scope === 'natal' && lifeSector.every((palace, index) => completeOrigins.has(palace) && (!index
      || confirmedSectorRelation('命宫', palace, index === 3 ? 'opposite' : 'trine')))) {
      const lifeStars = originByPalace.get('命宫').stars;
      const majors = majorStars.filter((star) => lifeStars.has(star));
      const brightness = new Map(majors.map((star) => [star, new Set(chart.present.filter((fact) =>
        fact.kind === 'palace_brightness' && fact.scope === 'origin' && fact.palace === '命宫' && fact.star === star)
        .map(({ brightness }) => brightness))]));
      const phases = new Set(chart.present.filter(({ kind }) => kind === 'natal_ziwei_life_phase').map(({ phase }) => phase));
      const count = (names) => lifeSector.map((palace) => names.filter((star) => originByPalace.get(palace).stars.has(star)).length);
      const verifiedChanges = [...changePalaces.values()].every((sites) => sites.size === 1);
      const inSector = (change) => lifeSector.includes(changePalaces.get(change).values().next().value);
      derived.push(...ziweiGradeFacts({
        branch: branchAt('命宫'),
        phase: phases.size === 1 ? phases.values().next().value : null,
        majors, brightness, support: count(beneficStars), adverse: count([...maleficStars, '地空', '地劫']),
        benefics: new Set(beneficStars.filter((star) => lifeSector.some((palace) => originByPalace.get(palace).stars.has(star)))),
        auspiciousChanges: verifiedChanges && [...'禄权科'].every(inSector),
        unluckyChange: verifiedChanges ? inSector('忌') : null,
        unluckyOpposesLife: verifiedChanges ? ['命宫', '迁移'].includes(changePalaces.get('忌').values().next().value) : null,
      }));
    }
    const input = new Map(chart.present.filter(({ kind }) => kind === 'ziwei_daozang_input').map((fact) => [JSON.stringify(fact), fact]));
    const daylight = new Set(chart.present.filter(fact => fact.kind === 'natal_daylight').map(fact => fact.sect));
    const present = chart.present.filter(fact => {
      const { kind } = fact;
      return consistentBrightness(fact) && (kind !== 'palace_branch' || branchAt(fact.palace) === fact.branch)
        && (kind !== 'palace_main_count' || verifiedMainCounts.has(fact.palace))
        && (kind !== 'palace_origin_star_count' || completeOrigins.has(fact.palace))
        && (kind !== 'body_palace' || bodyPalaces.size === 1)
        && kind !== 'palace_source_brightness' && kind !== 'palace_trine_star' && kind !== 'palace_changsheng_phase'
        && kind !== 'natal_ziwei_hour_phase' && kind !== 'natal_ziwei_mutagen_branch'
        && kind !== 'palace_confirmed_body_seat' && kind !== 'palace_life_trines_without_auspicious_mutagens'
        && kind !== 'palace_life_without_trine_auspicious_mutagens'
        && kind !== 'palace_life_without_natal_ji'
        && !kind.startsWith('daozang_') && !kind.startsWith('palace_sector_') && !kind.startsWith('palace_opposite_')
        && (kind !== 'natal_daylight' || daylight.size === 1)
        && (kind !== 'natal_ziwei_hour' || natalHours.size === 1)
        && !['palace_core_star_count', 'palace_major_state', 'palace_body_star_group', 'palace_mutagen_brightness',
          'ziwei_grade', 'ziwei_life_body_clash', 'ziwei_eight_seats', 'ziwei_confirmed_natal_layout'].includes(kind);
    });
    present.push(...normalizeFacts('ziwei', derived));
    if (input.size === 1 && chart.scope === 'natal') present.push(...normalizeFacts('ziwei', daozangChartFacts(input.values().next().value)));
    return { ...chart, present, presentKeys: new Set(present.map((fact) => JSON.stringify(fact))), absentKeys };
  }
  if (method !== 'bazi') return chart;
  const confirmed = analyzeConfirmedBaZi(chart.present);
  const genders = new Set(chart.present.filter(({ kind }) => kind === 'natal_gender').map(({ gender }) => gender));
  const gender = genders.size === 1 ? genders.values().next().value : null;
  const fetalMonths = new Set(chart.present.filter(({ kind }) => kind === 'bazi_fetal_month').map(({ ganZhi }) => ganZhi));
  const [fetalMonth] = fetalMonths;
  const previousTerms = new Set(chart.present.filter(({ kind }) => kind === 'bazi_previous_qi').map(({ term }) => term));
  const [previousQi] = previousTerms;
  const birthSects = new Set(chart.present.filter(fact => fact.kind === 'natal_daylight').map(fact => fact.sect));
  const recalculated = (fact) => verifiedBaziFact(fact)
    || (previousTerms.size > 1 && fact.kind === 'bazi_previous_qi')
    || (birthSects.size > 1 && fact.kind === 'natal_daylight')
    || (confirmed && fact.kind === 'shen_sha' && verifiedNatalShenSha.includes(fact.name));
  const present = chart.present.filter((fact) => !recalculated(fact));
  if (confirmed) present.push(...normalizeFacts('bazi', baziClaimFacts(confirmed, gender,
    fetalMonths.size === 1 && baziAtom(fetalMonth + '月')?.kind === 'pillar' ? fetalMonth : null,
    previousTerms.size === 1 ? previousQi : null)));
  else present.push(...normalizeFacts('bazi', baziDayMasterStrengthConsensus(chart.present)));
  if (chart.scope === 'natal') present.push(...normalizeFacts('bazi', baziShenShaPlacementFacts(chart.present)));
  const presentKeys = new Set(present.map((fact) => JSON.stringify(fact)));
  for (const key of absentKeys) {
    if (recalculated(JSON.parse(key))) absentKeys.delete(key);
  }
  if (confirmed) {
    for (const element of '木火土金水') {
      const key = JSON.stringify({ kind: 'bazi_natal_element', element });
      if (!presentKeys.has(key)) absentKeys.add(key);
    }
    for (const group of Object.keys(tenGodStrengthGroups)) {
      const key = JSON.stringify({ kind: 'bazi_ten_god_strength', group, profile: 'anchored-weighted-ten-god-v1', strength: '旺' });
      if (!presentKeys.has(key)) absentKeys.add(key);
    }
    for (const [orderedPair, element] of Object.entries(transformations)) {
      for (const pair of [orderedPair, [...orderedPair].reverse().join('')]) {
        const key = JSON.stringify({ kind: 'bazi_stem_transformation', pair, element });
        if (!presentKeys.has(key)) absentKeys.add(key);
      }
    }
    for (const [index, first] of positionNames.entries()) {
      for (const name of [...calculatedClaimShenSha, ...verifiedNatalShenSha]) {
        if (genderedClaimShenSha.includes(name) && !gender) continue;
        const key = JSON.stringify({ kind: 'shen_sha', position: first, name });
        if (!presentKeys.has(key)) absentKeys.add(key);
      }
      for (const second of positionNames.slice(index + 1)) {
        const combinationKey = JSON.stringify({ kind: 'bazi_stem_combination', first, second });
        if (!presentKeys.has(combinationKey)) absentKeys.add(combinationKey);
        for (const relation of branchRelationTypes) {
          const key = JSON.stringify(baziBranchRelation(relation, first, second));
          if (!presentKeys.has(key)) absentKeys.add(key);
        }
      }
    }
  }
  for (const position of positionNames) {
    for (const [kind, domain] of [['stem', stems], ['branch', branches]]) {
      const values = new Set(chart.present.filter((f) => f.kind === kind && f.position === position).map((f) => f[kind]));
      const [observed] = values;
      if (values.size !== 1 || observed?.length !== 1 || !domain.includes(observed)) continue;
      for (const value of domain) if (value !== observed) absentKeys.add(JSON.stringify({ kind, position, [kind]: value }));
    }
    const known = new Set(chart.present.filter((fact) => fact.kind === 'pillar' && fact.position === position).map(({ ganZhi }) => ganZhi));
    if (known.size === 1 && [...known].every((ganZhi) => baziAtom(ganZhi + '日')?.kind === 'pillar')) {
      const nayin = LunarUtil.NAYIN[known.values().next().value];
      for (const name of nayinNames) {
        const key = JSON.stringify({ kind: 'pillar_nayin', position, name });
        if (name !== nayin && !presentKeys.has(key)) absentKeys.add(key);
      }
      for (let index = 0; index < 60; index++) {
        const ganZhi = stems[index % 10] + branches[index % 12];
        if (!known.has(ganZhi)) absentKeys.add(JSON.stringify({ kind: 'pillar', position, ganZhi }));
      }
    }
    const stemsAtPosition = new Set(chart.present.filter((fact) => fact.kind === 'stem_ten_god' && fact.position === position).map(({ tenGod }) => tenGod));
    const knownBranch = [...new Set(chart.present.filter((fact) => fact.kind === 'branch' && fact.position === position).map(({ branch }) => branch))];
    const expectedHidden = knownBranch.length === 1 && LunarUtil.ZHI_HIDE_GAN[knownBranch[0]];
    const hidden = chart.present.filter((fact) => fact.kind === 'hidden_ten_god' && fact.position === position);
    const completeHidden = expectedHidden && expectedHidden.length === hidden.length && expectedHidden.every((stem) => hidden.some((fact) => fact.stem === stem));
    for (const tenGod of tenGods.split('|').slice(0, 10)) {
      if (stemsAtPosition.size === 1 && !stemsAtPosition.has(tenGod)) absentKeys.add(JSON.stringify({ kind: 'stem_ten_god', position, tenGod }));
      if (completeHidden && !hidden.some((fact) => fact.tenGod === tenGod)) absentKeys.add(JSON.stringify({ kind: 'branch_ten_god', position, tenGod }));
    }
  }
  return { ...chart, present, presentKeys, absentKeys };
}

function conditionClauses(claim) {
  return (ziweiMutagenSourceConditions(claim) ?? claim.conditions.normalized).flatMap((condition) =>
    condition.replace(/\s+/gu, '').replace(/，宫职由篇题给出$/u, '').split(/[,，；;]/u));
}

function ziweiChapterPalace(claim) {
  if (claim.source.book.includes('续道藏')) return null;
  const chapter = claim.source.chapter.replace(/^[一二三四五六七八九十\d]+[\s、.．]*/u, '')
    .replaceAll('宮', '宫').replaceAll('財', '财').replaceAll('祿', '禄')
    .replaceAll('遷', '迁').replaceAll('僕', '仆').replaceAll('訣', '诀')
    .replaceAll('陰', '阴').replaceAll('陽', '阳').replaceAll('機', '机').replaceAll('貪', '贪')
    .replaceAll('貞', '贞').replaceAll('軍', '军').replaceAll('殺', '杀');
  const verse = /^(.+?)入[男女]?命吉凶诀$/u.exec(chapter);
  if (verse && parseStars(verse[1])?.length === 1) return '命宫';
  return palaceName(chapter) ?? null;
}

function ziweiScopedClause(claim, text, context = []) {
  const frame = ziweiChapterPalace(claim);
  let parsed = ziweiClause(text);
  if (!frame) return parsed;
  const compact = text.replace(/^本命/u, '');
  if (!parsed) {
    const gendered = /^(?:原篇)?([男女])命(?:逢|见|遇)(.+)$/u.exec(compact);
    const named = gendered && parseStars(gendered[2]);
    if (named?.length === 1) parsed = palaces.flatMap(palace => ziweiFacts(named, palace)
      .map(facts => [{ kind: 'natal_gender', gender: gendered[1] }, ...facts]));
    const names = parseStars(compact);
    if (names?.length === 1) parsed = palaces.flatMap(palace => ziweiFacts(names, palace));
    const solo = /^(.+?)(?:独守|单守|单居)$/u.exec(compact);
    if (solo && majorStars.includes(solo[1])) parsed = palaces.flatMap(palace => soloZiweiFacts(solo[1], palace));
  }
  if (!parsed?.length || parsed.some(facts => facts.some(fact => fact.kind === 'body_palace' || fact.kind === 'palace_relation'))) return parsed;
  const subjects = new Set(parsed.flat().filter(fact => ['palace_star', 'star_mutagen', 'palace_brightness'].includes(fact.kind)).map(fact => fact.star));
  const sites = new Set(parsed.flat().filter(fact => fact.palace).map(fact => fact.palace));
  const explicitlyTogether = /(?:同宫|同垣|同度)$/u.test(compact) || compact.includes('同守');
  if ((!subjects.size || subjects.size > 1 && !explicitlyTogether) || sites.size !== 12) return parsed;
  const explicit = new Set();
  for (const other of context) {
    if (other === text) continue;
    const groups = ziweiClause(other);
    if (!groups?.length) continue;
    if (groups.every(facts => facts.length && facts.every(fact => fact.kind === 'palace_branch'))) {
      for (const fact of groups.flat()) explicit.add(fact.palace);
      continue;
    }
    if (!groups.flat().some(fact => subjects.has(fact.star))) continue;
    if (groups.flat().some(fact => fact.kind === 'body_palace')) return parsed;
    const positions = new Set(groups.flat().filter(fact => subjects.has(fact.star) && fact.palace).map(fact => fact.palace));
    if (positions.size < 12) for (const palace of positions) explicit.add(palace);
  }
  if (explicit.size > 1) return parsed;
  const target = explicit.size ? [...explicit][0] : frame;
  return parsed.filter(facts => facts.every(fact => !fact.palace || fact.palace === target));
}

function anchoredZiweiClause(clause, anchors) {
  const sameOrOpposite = /^见(.+?)同宫或对宫$/u.exec(clause);
  const alternatives = sameOrOpposite && parseStars(sameOrOpposite[1]);
  if (alternatives?.length) return anchors.flatMap(facts => {
    const located = facts.filter(fact => fact.kind === 'palace_star');
    const palace = located[0]?.palace;
    if (!palace || !located.every(fact => fact.palace === palace) || located.some(fact => alternatives.includes(fact.star))) return [];
    return [...ziweiFacts(alternatives, palace), ...allPalaceRelations(alternatives, palace, 'opposite')]
      .map(extra => [...facts, ...extra]);
  });
  const brightness = { 入庙: ['庙'], 庙旺: ['庙', '旺'], 落陷: ['陷'], 失陷: ['陷'], 陷地: ['陷'], 旺地: ['旺'], 得地: ['得'] }[clause];
  if (brightness) return anchors.flatMap(facts => {
    const located = facts.filter(fact => fact.kind === 'palace_star');
    if (located.length !== 1) return [];
    return ziweiFacts([located[0].star], located[0].palace, brightness).map(extra => [...facts, ...extra]);
  });
  const placedHere = /^(.+?)在此宫$/u.exec(clause);
  const hereStars = placedHere && parseStars(placedHere[1]);
  if (hereStars) return anchors.flatMap(facts => {
    const locations = new Set(facts.filter(fact => ['palace_star', 'palace_branch'].includes(fact.kind)).map(fact => fact.palace));
    return locations.size === 1 ? ziweiFacts(hereStars, [...locations][0]) : [];
  });
  const same = clause.match(/^(?:与|伴随)?(.+?)(?:同宫|同垣|同居)$/u);
  const trines = clause.match(/^(?:另得)?(.+?)三合(?:拱照|相照|照|拱)$/u);
  const additional = (same || trines) && parseStars((same ?? trines)[1]);
  if (!additional || (!same && additional.length !== 2)) return null;
  return anchors.flatMap((facts) => {
    const matching = facts.filter(({ kind }) => kind === 'palace_star');
    const palace = matching[0]?.palace;
    if (!palace || !matching.every((fact) => fact.palace === palace) || matching.some(({ star }) => additional.includes(star))) return [];
    const additions = same ? ziweiFacts(additional, palace) : surroundingPalaces(additional, palace, 'trine');
    return additions.map((group) => [...facts, ...group]);
  });
}

function canCoexist(method, facts) {
  const uniqueValues = new Map();
  for (const fact of facts) {
    let key;
    if (method === 'bazi' && ['branch', 'stem', 'pillar'].includes(fact.kind)) key = `${fact.kind}:${fact.position}`;
    if (method === 'ziwei') {
      if (fact.kind === 'palace_star' && coreStars.has(fact.star)) key = `${fact.kind}:${fact.scope}:${fact.star}`;
      if (fact.kind === 'palace_branch') key = `${fact.kind}:${fact.palace}`;
      if (fact.kind === 'body_palace') key = fact.kind;
    }
    if (!key) continue;
    const value = JSON.stringify(fact);
    if (uniqueValues.has(key) && uniqueValues.get(key) !== value) return false;
    uniqueValues.set(key, value);
  }
  return true;
}

function classifyConditions(method, claim) {
  const clauses = conditionClauses(claim).flatMap(text => {
    if (method !== 'bazi') return [text];
    // Keep the gender, absence and both virtues as separate AND conditions;
    // a positive-only parser must not swallow the absence inside the sentence.
    const virtues = /^([男女]命)(原局无七杀)而(天月二德具备)$/u.exec(text);
    return virtues ? [virtues[1], virtues[2], virtues[3]] : [text];
  });
  const hasDayHour = method === 'bazi' && clauses.some((value) => /^.+日.+时$/u.test(value) && baziClause(value));
  return clauses.map((text) => {
    if (method === 'bazi') {
      if (baziEditorialCondition(claim, text)) return { text, metadata: true };
      if ((hasDayHour && /^(?:原段日时组合|时据篇题|时干(?:据篇题|依本篇))$/u.test(text))
        || (text === '按本赋注文' && clauses.includes('四柱均出自同一旬'))) return { text, metadata: true };
      const qualifiedAbsence = hasDayHour && /^不见[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥、]+$/u.test(text);
      const mustBeAbsent = baziAbsences(text === '无午穿冲' && clauses.includes('乙丑日丙子时') ? '柱无午' : qualifiedAbsence ? '柱' + text : text);
      if (mustBeAbsent) return { text, mustBeAbsent };
      return { text, alternatives: baziClause(text, hasDayHour) };
    }
    if ((text === '所处宫未说明' && clauses.some((value) => /^.+化[禄权科忌]$/u.test(value)))
      || (text === '具体化出者未写' && clauses.includes('本命化忌守身宫或命宫'))) return { text, metadata: true };
    // Exact edition notes only: neither adds a chart predicate. Do not strip
    // arbitrary “按原文…” text, brightness, gender or other prerequisites.
    if (ziweiMutagenEditorialCondition(claim, text)) return { text, metadata: true };
    if ((claim.id === 'ziwei-v2-fuqigong-p009-001' && text === '依原句男女命均论')
      || (claim.id === 'ziwei-v1-zhuxing-wenda-p182000-001' && text === '按本歌核对')) return { text, metadata: true };
    const anchors = clauses.slice(0, 1).flatMap(value => ziweiScopedClause(claim, value, clauses) ?? []);
    const originalBrightness = quanshuMinggongQualifier(claim, text, anchors);
    if (originalBrightness?.length) return { text, alternatives: originalBrightness };
    const sourceGroups = groups => groups.map(facts => quanshuMinggongRequirements(claim, facts, true));
    const explicitFlanks = [
      ['武曲、天梁两侧夹', '天相守命宫或田宅宫', '天相守命宫或田宅宫由武曲、天梁两侧夹'],
      ['太阳太阴来夹', '武曲守命宫或财帛宫', '武曲守命宫或财帛宫由太阳太阴两侧夹'],
      ['太阳和太阴前后夹', '紫微守命', '紫微守命宫由太阳和太阴前后夹'],
    ].find(([condition, core]) => text === condition && clauses.includes(core));
    const mustBeAbsent = ziweiAbsences(text);
    if (mustBeAbsent) return { text, mustBeAbsent };
    const direct = ziweiScopedClause(claim, explicitFlanks?.[2] ?? text, clauses);
    if (direct) {
      if (/入命/u.test(claim.source.chapter)
        && /^(?:本命)?.+?(入庙|庙旺|落陷)且化[禄权科忌]$/u.test(text)) {
        return { text, alternatives: sourceGroups(direct.filter(facts => facts.every(fact => !fact.palace || fact.palace === '命宫'))) };
      }
      // “疾厄宫在卯；天同与天刑、铃星同居” refers to that
      // palace, not a conjunction anywhere else in a chart whose 疾厄 is 卯.
      const conjunction = /^(?:本命)?(.+?)(?:同宫|同垣|同居|同度|同守)$/u.exec(text);
      if (conjunction && parseStars(conjunction[1])?.length > 1) {
        const locations = new Set(clauses.map(value => {
          const forward = /^(?:本命)?(.+?宫)在[子丑寅卯辰巳午未申酉戌亥、或]+$/u.exec(value);
          const reversed = /^(?:本命)?[子丑寅卯辰巳午未申酉戌亥]地(.+?宫)$/u.exec(value);
          return palaceName((forward ?? reversed)?.[1] ?? '');
        }).filter(Boolean));
        if (locations.size > 1) return { text, alternatives: null };
        if (locations.size === 1) return { text, alternatives: sourceGroups(direct.filter(facts =>
          facts.every(fact => !fact.palace || fact.palace === [...locations][0]))) };
      }
      return { text, alternatives: sourceGroups(direct) };
    }
    const explicitOmissions = text.match(/^原句所列(.+)均无$/u);
    const anchorPalaces = new Set(anchors.flat().filter(fact => fact.kind === 'palace_star').map(fact => fact.palace));
    if (explicitOmissions && anchorPalaces.size === 1) {
      const omitted = ziweiAbsences(`${[...anchorPalaces][0]}宫无${explicitOmissions[1]}`);
      if (omitted) return { text, mustBeAbsent: omitted };
    }
    const contextual = anchoredZiweiClause(text, anchors);
    return { text, alternatives: contextual?.length ? sourceGroups(contextual) : null };
  });
}

function baziEditorialCondition(claim, text) {
  // These are the supplied edition's examples/definitions, not extra life
  // facts or unimplemented strength/control requirements. Keep them in source.
  return (claim.id === 'yhzp-v2-c002-p011-101' && text === '原注以甲乙日遇庚辛年示意')
    || (claim.id === 'yhzp-v1-c294-p002-002' && text === '以月令为提纲')
    || (claim.id === 'yhzp-v3-c031-p002-003' && text === '原文称姊妹');
}

function compileBaziLiteral(claim, sourceConditions = baziLiteralSourceConditions(claim)) {
  if (sourceConditions === null) return null;
  const hasDayHour = conditionClauses(claim).some(value => /^.+日.+时$/u.test(value) && baziClause(value));
  const groups = baziLiteralConditions(sourceConditions ? { ...claim, conditions: { ...claim.conditions, normalized: sourceConditions.normalized } } : claim, {
    positive: value => baziEditorialCondition(claim, value) ? [[]] : baziClause(value, hasDayHour),
    absence: baziAbsences,
  });
  if (!groups) return null;
  const unique = facts => [...new Map(facts.map(fact => [JSON.stringify(fact), fact])).values()];
  const inputs = groups.filter(({ required, mustBeAbsent }) => required.length && compatibleBaZiLiteralFacts(required, mustBeAbsent)
    && !mustBeAbsent.some(absent => required.some(fact => JSON.stringify(fact) === JSON.stringify(absent))))
    .map(({ required, mustBeAbsent }) => normalizeRuleInput('bazi', { required: unique(required), mustBeAbsent: unique(mustBeAbsent) }));
  return inputs.length ? { inputs: [...new Map(inputs.map(input => [JSON.stringify(input), input])).values()],
    compiler: sourceConditions?.compiler ?? (explicitNatalOfficerOccurrence(claim) ? 'bazi-natal-god-presence-v1' : 'bazi-literal-dnf-v1') } : null;
}

function compileYuanhaiOneVirtue(claim) {
  // The supplied edition explicitly says 一德 in this passage. Its note only
  // contrasts another chapter's 二德; preserve both texts, using this passage's
  // own quantifier instead of silently imposing the other chapter's condition.
  if (claim.id !== 'yhzp-v3-c031-p002-101' || claim.source.book !== '渊海子平'
    || claim.source.volume !== '卷三' || claim.source.chapter !== '女命富貴貧賤篇'
    || claim.source.passage_id !== 'yhzp-v3-c031-p002' || claim.conditions.match
    || JSON.stringify(claim.conditions.normalized) !== JSON.stringify(['本篇女命原局有天月德，又见印绶'])
    || JSON.stringify(claim.conditions.original) !== JSON.stringify(['天月一德', '如逢印綬'])
    || JSON.stringify(claim.conditions.uncertain) !== JSON.stringify(['该卷录为「天月一德」，同书另篇作二德，并存。'])
    || claim.conditions.excluded.length || !claim.evidence.original_text.startsWith('天月一德以爲本命，如逢印綬，')) return null;
  return { compiler: 'yhzp-v3-one-virtue-v1', inputs: baziClause('原局印绶').map(facts => normalizeRuleInput('bazi', {
    required: [{ kind: 'natal_gender', gender: '女' }, { kind: 'bazi_natal_configuration', name: '天月德至少一项' }, ...facts],
  })) };
}

function compileZiweiRelativeOr(claim) {
  // This supplied record explicitly lists two alternative routes to the same
  // outcome. Do not reinterpret every comma or “及” as OR in other sources.
  if (claim.id !== 'ziwei-v3-jielan-122-p001-001' || claim.source.book !== '紫微斗数捷览'
    || claim.source.chapter !== '斗数彀率'
    || JSON.stringify(claim.conditions.normalized) !== JSON.stringify(['武曲天相夹命，或日月夹财帛宫'])
    || claim.evidence.original_text !== '财（武曲）印（天相）夹命，日月夹财（财帛宫），其富何疑') return null;
  const groups = ['武曲天相夹命', '日月夹财帛宫'].map(ziweiClause);
  if (groups.some(group => !group?.length)) return null;
  return { compiler: 'ziwei-relative-palaces-v1', inputs: groups.flat().filter(compatibleZiweiRelativeFacts)
    .map(required => normalizeRuleInput('ziwei', { required })) };
}

function compile(method, claim) {
  if (method === 'western') return compileWesternClaim(claim);
  const machineMatch = claim.conditions.match;
  if (method === 'bazi') {
    if (machineMatch?.system && machineMatch.system !== 'bazi') return { reason: 'different_calculation_system' };
    const reviewedPassage = compileBaZiDecadalPassage(claim) ?? compileShenfengNatalPassage(claim)
      ?? compileShenfengReviewed(claim) ?? compileDtsjyReviewedPassage(claim);
    if (reviewedPassage) return reviewedPassage;
    if (machineMatch?.chartScope && machineMatch.chartScope !== 'natal') return { reason: 'requires_temporal_calculation' };
    if (machineMatch?.recordType === 'case') return compileBaziHistoricalCase(claim);
    const blindPalace = compileBlindPalace(claim);
    if (blindPalace) return blindPalace;
    const classicalStructure = compileBaziClassicalStructures(claim) ?? compileYuanhaiNatalPassages(claim);
    if (classicalStructure) return classicalStructure;
    const equalColumns = compileBaZiEqualColumnsPassage(claim);
    if (equalColumns) return equalColumns;
  }
  const { uncertain, excluded } = claim.conditions;
  const prerequisiteReview = sourcePrerequisiteReview(claim);
  if (prerequisiteReview) return { reason: 'source_review_required', reviewNote: prerequisiteReview };
  const sourceVirtue = method === 'bazi' && compileYuanhaiOneVirtue(claim);
  if (sourceVirtue) return sourceVirtue;
  const seasonalPassages = method === 'bazi'
    ? compileQtbjSeasonalPassages(claim, compileBaziLiteral)
      ?? compileQtbjMetalWater(claim) ?? compileQtbjWoodFireEarth(claim)
    : undefined;
  if (seasonalPassages) return seasonalPassages;
  const zpzqCases = method === 'bazi' ? compileZpzqCases(claim) : undefined;
  if (zpzqCases) return zpzqCases;
  const palaceText = method === 'ziwei' ? compileQuanshuPalaceText(claim) : undefined;
  if (palaceText) return palaceText;
  const minggong = method === 'ziwei' ? compileQuanshuMinggongPassage(claim) : undefined;
  if (minggong) return minggong;
  const xingjuePalace = method === 'ziwei'
    ? compileXingjuePalaceConfiguration(claim)
      ?? compileXingjueCareer(claim) ?? compileXingjueEstate(claim) ?? compileXingjueFude(claim) ?? compileXingjueHealth(claim)
      ?? compileXingjueSpouse(claim) ?? compileXingjueFemale(claim)
      ?? compileXingjueMigration(claim) ?? compileXingjueWealth(claim) ?? compileXingjueFriends(claim)
      ?? compileXingjueParents(claim) ?? compileXingjueSiblings(claim) ?? compileXingjueChildren(claim)
      ?? compileXingjueLifeBody(claim) ?? compileXingjueTianji(claim) ?? compileXingjueSamePalace(claim)
      ?? compileXingjuePalacePatterns(claim) ?? compileXingjueNatalStars(claim)
    : undefined;
  if (xingjuePalace) return xingjuePalace;
  const changshengSource = method === 'ziwei' ? compileZiweiChangshengSource(claim) : undefined;
  if (changshengSource) return changshengSource;
  const jielanPalace = method === 'ziwei' ? compileJielanPalacePassages(claim) ?? compileJielanNatalStars(claim) : undefined;
  if (jielanPalace) return jielanPalace;
  const ziweiSourceExclusions = method === 'ziwei' ? compileZiweiSourceExclusions(claim) : undefined;
  if (ziweiSourceExclusions) return ziweiSourceExclusions;
  const ziweiSoloSources = method === 'ziwei' ? compileZiweiSoloSources(claim, soloZiweiFacts, palaceSectors) : undefined;
  if (ziweiSoloSources) return ziweiSoloSources;
  const gusuiSources = method === 'ziwei' ? compileZiweiGusuiSources(claim) : undefined;
  if (gusuiSources) return gusuiSources;
  const tongyuan = method === 'ziwei' ? compileQuanshuTongyuan(claim) : undefined;
  if (tongyuan) return tongyuan;
  const zhuxingWenda = method === 'ziwei' ? compileQuanshuZhuxingWenda(claim) : undefined;
  if (zhuxingWenda) return zhuxingWenda;
  const guancelu = method === 'ziwei' ? compileGuanceluNatal(claim) ?? compileGuanceluHistoricalCase(claim) : undefined;
  if (guancelu) return guancelu;
  const jielanGusui = method === 'ziwei' ? compileJielanGusui(claim, surroundingPalaces, palaceSectors, majorStars) : undefined;
  if (jielanGusui) return jielanGusui;
  const passageSource = method === 'bazi' ? baziLiteralPassageDisposition(claim) : undefined;
  if (passageSource !== undefined) return passageSource
    ? { reason: excluded.length ? 'unmapped_exclusions' : 'unmapped_condition', condition: '原段分句分别匹配，未确认分句不进入报告' }
    : { reason: 'source_review_required', reviewNote: '分句接线所据原文或条件已变化，须复核固定来源后重新编译。' };
  const literalSource = method === 'bazi' ? baziLiteralSourceConditions(claim) : undefined;
  if (literalSource === null) return { reason: 'source_review_required', reviewNote: '固定文字条件所据原文或条件已变化，须重新复核。' };
  if (uncertain.length) return { reason: 'uncertain_conditions' };
  if (excluded.length) return { reason: 'unmapped_exclusions' };
  if (literalSource?.compiler === qtbjTermProfile) {
    return compileBaziLiteral(claim, literalSource) ?? { reason: 'unmapped_condition' };
  }
  if (method === 'bazi') {
    const placement = compileBaziShenShaPlacementSource(claim);
    if (placement) return placement;
  }
  if (method === 'ziwei' && ziweiBrightnessReviewClaims.has(claim.id)) return { reason: 'different_chart_tradition' };
  if (method === 'ziwei' && ziweiPlacementReviewClaims.has(claim.id)) return { reason: 'different_chart_tradition' };
  if (method === 'bazi') {
    const machine = compileBaziMachineMatch(claim.conditions.match);
    if (machine) return machine;
  }
  if (method === 'ziwei' && claim.source.book.includes('续道藏')) return { reason: 'different_chart_tradition' };
  const gradedSource = method === 'ziwei' ? ziweiSourcePassageDisposition(claim) : undefined;
  if (gradedSource !== undefined) return gradedSource
    ? { reason: 'unmapped_condition', condition: claim.conditions.normalized.join('；') }
    : { reason: 'source_review_required', reviewNote: '分生年等级的专用转换所据原文或条件已变化，须重新核对，不能沿用旧分句。' };
  if (method === 'ziwei') {
    if (ziweiMutagenSourceDisposition(claim) === false) return { reason: 'source_review_required', reviewNote: '本条四化与地支转换所据原文或条件已变化，须重新核对，不能沿用旧转换。' };
    const alternatives = compileZiweiRelativeOr(claim);
    if (alternatives) return alternatives;
  }
  let alternatives = [[]];
  const mustBeAbsent = [];
  for (const { text, metadata, mustBeAbsent: absence, alternatives: parsed } of classifyConditions(method, claim)) {
    if (metadata) continue;
    if (absence) {
      mustBeAbsent.push(...absence);
      continue;
    }
    if (!parsed) return method === 'bazi' ? compileBaziLiteral(claim) ?? { reason: 'unmapped_condition', condition: text }
      : { reason: 'unmapped_condition', condition: text };
    alternatives = alternatives.flatMap((first) => parsed.map((second) => [...first, ...second]));
  }
  if (!alternatives.some((facts) => facts.length)) return { reason: 'no_condition' };
  const relativeProfile = method === 'ziwei' && hasZiweiRelativeSyntax(claim);
  const natalPlacementProfile = method === 'ziwei' && hasZiweiNatalPlacementSyntax(claim);
  const mutagenPlacementProfile = method === 'ziwei' && hasZiweiMutagenPlacementSyntax(claim);
  const earthVoidSingleSeat = method === 'ziwei' && conditionClauses(claim)
    .some(text => /^(?:本命)?地空单坐身宫$/u.test(text));
  // Default iztro life/body indices are month − hour and month + hour.
  // At the two shared positions (Zi and Wu hours), earth void and earth
  // robbery at Hai − hour and Hai + hour necessarily share the same palace.
  const canSeatEarthVoidAlone = facts => !facts.some(fact => fact.kind === 'body_palace' && fact.palace === '命宫');
  const compatible = facts => (!relativeProfile || compatibleZiweiRelativeFacts(facts))
    && (!natalPlacementProfile || compatibleZiweiNatalPlacement(facts))
    && (!mutagenPlacementProfile || compatibleZiweiNatalMutagens(facts))
    && (!earthVoidSingleSeat || canSeatEarthVoidAlone(facts));
  const usesPlacementProfile = relativeProfile || natalPlacementProfile || mutagenPlacementProfile || earthVoidSingleSeat;
  const incompatible = usesPlacementProfile ? alternatives.filter(facts => canCoexist(method, facts) && !compatible(facts)) : [];
  const valid = alternatives.filter((facts) => canCoexist(method, facts) && compatible(facts));
  if (relativeProfile && !valid.length) return { reason: 'different_chart_tradition',
    reviewNote: '保留原句及归一化条件；该组合在现行默认十四主星完整布局或身宫位置中不相容，不能通过把且改为或、改动落宫或删除星曜启用。须独立核对来源及所用排盘体系。' };
  if (mutagenPlacementProfile && !valid.length) return { reason: 'different_chart_tradition', incompatibleAlternatives: incompatible,
    reviewNote: '保留原文、生年与同一星曜化曜条件；该组合与当前iztro 2.6.5默认生年四化不相容，不改生年或把别星的化忌拼接进来，待独立核定原书取法。' };
  if (earthVoidSingleSeat && !valid.length && incompatible.length) return { reason: 'different_chart_tradition', incompatibleAlternatives: incompatible };
  if (!valid.length) return { reason: 'conflicting_conditions' };
  const compiled = valid.map((facts) => normalizeRuleInput(method, {
    required: [...new Map(facts.map((fact) => [JSON.stringify(fact), fact])).values()],
    mustBeAbsent,
  }));
  return { inputs: [...new Map(compiled.map((input) => [JSON.stringify(input), input])).values()],
    ...(mutagenPlacementProfile && { compiler: ziweiMutagenPlacementProfile, incompatibleAlternatives: incompatible,
      ...(incompatible.length && { remainingAlternatives: incompatible.length }) }),
    ...(method === 'bazi' && explicitNatalOfficerOccurrence(claim) && { compiler: 'bazi-natal-god-presence-v1' }),
    ...(natalPlacementProfile && { compiler: 'ziwei-natal-placement-v1', incompatibleAlternatives: incompatible,
      ...(incompatible.length && { remainingAlternatives: incompatible.length }) }),
    ...(relativeProfile && { compiler: 'ziwei-relative-palaces-v1', incompatibleAlternatives: incompatible }),
    ...(earthVoidSingleSeat && { compiler: 'ziwei-earth-void-single-seat-v1', incompatibleAlternatives: incompatible,
      ...(incompatible.length && { remainingAlternatives: incompatible.length }) }) };
}

function isClaim(claim) {
  const { id, title, category, source, evidence, conditions, interpretation } = claim ?? {};
  const text = (value) => typeof value === 'string' && value.trim().length > 0;
  const texts = (value) => Array.isArray(value) && value.every(text);
  return text(id) && text(title) && Object.values(reportTopics).includes(category?.topic)
    && ['性格', '事件'].includes(category?.type) && texts(category.tags)
    && ['book', 'author', 'edition', 'volume', 'chapter', 'passage_id'].every((key) => text(source?.[key]))
    && (/^https:\/\//u.test(source.url) || (source.url === null && ['supplied_skill_material', 'supplied_tieban_clause'].includes(source.material_type)
      && text(source.local_path) && !source.local_path.split(/[\\/]/u).includes('..') && !/^(?:[A-Za-z]:|[\\/])/u.test(source.local_path)))
    && (source.section === null || text(source.section))
    && text(evidence?.original_text) && isClaimContext(evidence.context)
    && ['original', 'normalized', 'uncertain', 'excluded'].every((key) => texts(conditions?.[key]))
    && text(interpretation?.classical_meaning) && texts(interpretation.limitations);
}

export function compileClaimSources(sourceDirectory = claimSourceDirectory) {
  const upgrade = JSON.parse(readFileSync(join(sourceDirectory, 'upgrade-manifest.json'), 'utf8'));
  const interpretationFile = join(sourceDirectory, 'branch-interpretations.json');
  const authoredBranches = existsSync(interpretationFile)
    ? JSON.parse(readFileSync(interpretationFile, 'utf8').replace(/^\uFEFF/u, '')) : {};
  if (!authoredBranches || typeof authoredBranches !== 'object' || Array.isArray(authoredBranches)) {
    throw new Error('Invalid branch interpretation catalog');
  }
  const interpretations = new Map(Object.entries(authoredBranches));
  const revisedConditions = new Set(Object.values(upgrade.changedConditionIds).flat());
  const revisedEvidence = new Set(Object.values(upgrade.changedEvidenceIds).flat());
  const seen = new Set();
  const rows = methods.flatMap((method) => {
    const file = readFileSync(join(sourceDirectory, method + '.json'), 'utf8');
    const claims = JSON.parse(file.replace(/^\uFEFF/u, ''));
    if (!Array.isArray(claims)) throw new Error('Invalid Claim collection: ' + method);
    return claims.map((claim) => {
      if (!isClaim(claim) || seen.has(claim.id) || (method === 'western' && !isWesternClaimMatch(claim.conditions.match))) {
        throw new Error('Invalid claim: ' + (claim?.id ?? method));
      }
      seen.add(claim.id);
      if (skippedClaims.has(claim.id)) return { method, claim, reason: 'user_requested_skip', branches: [] };
      let rule = compile(method, claim);
      const branches = rule.branches ?? (rule.inputs || revisedConditions.has(claim.id) || revisedEvidence.has(claim.id)
        || method === 'ziwei' && ziweiPlacementReviewClaims.has(claim.id)
        || ['different_calculation_system', 'requires_temporal_calculation', 'historical_case',
          'unsupported_machine_requirements', 'unsupported_machine_facts', 'source_review_required'].includes(rule.reason) ? [] : [...mappedPassages(method, claim),
        ...(method === 'bazi' ? baziTemperamentPassage(claim) : []),
        ...(method === 'bazi' ? baziLiteralPassages(claim, compileBaziLiteral) : []),
        ...(method === 'bazi' ? baziShenShaPlacementPassages(claim) : []),
        ...(method === 'ziwei' && claim.source.book.includes('续道藏') ? daozangPassages(claim) : []),
        ...(method === 'ziwei' ? [...ziweiSourcePassages(claim, ziweiClause), ...ziweiMingGongTable(claim), ...ziweiExplicitBranches(claim), ...ziweiPassageBranches(claim)] : [])]);
      const category = branches.length && claimPassageCategories[claim.id];
      if (method === 'ziwei' && quanshuMinggongStar(claim)) {
        const rebase = input => normalizeRuleInput(method, { ...input, required: quanshuMinggongRequirements(claim, input.required) });
        if (rule.inputs) rule = { ...rule, inputs: rule.inputs.map(rebase) };
        for (const branch of branches) branch.inputs = branch.inputs.map(rebase);
      }
      if (category && (!Object.values(reportTopics).includes(category.topic) || !['性格', '事件'].includes(category.type))) {
        throw new Error('Invalid passage category for ' + claim.id);
      }
      const authored = interpretations.get(claim.id);
      if (interpretations.has(claim.id)) {
        if (!authored || typeof authored !== 'object' || Array.isArray(authored) || Object.entries(authored).some(([excerpt, modern]) =>
          typeof modern !== 'string' || !modern.trim() || !branches.some(branch => branch.text === excerpt))) {
          throw new Error('Invalid or outdated branch interpretation: ' + claim.id);
        }
        interpretations.delete(claim.id);
      }
      const materialBranches = branches.map(branch => ({
        ...branch, ...branchInterpretation(claim, branch, authored && Object.hasOwn(authored, branch.text) ? authored[branch.text] : undefined),
      }));
      return { method, claim, ...rule, branches: materialBranches, ...(category && { category }),
        revisedConditions: revisedConditions.has(claim.id), revisedEvidence: revisedEvidence.has(claim.id) || rule.revisedEvidence === true };
    });
  });
  if (interpretations.size) throw new Error('Branch interpretation has no active source: ' + interpretations.keys().next().value);
  return rows;
}

export function createClaimsCatalog(options = {}) {
  const { includeLegacy = true, ...storage } = options;
  return createClaimSqliteStore({
    ...storage,
    compile(sourceDirectory, knowledge) {
      const compiled = compileClaimSources(sourceDirectory);
      return knowledge ? compileReportKnowledge(compiled, knowledge, legacySourceIds) : compiled;
    },
    ...(includeLegacy && { augment: writeLegacyCatalog }),
  });
}

const runtimeCatalog = createClaimsCatalog();
export function buildClaimsCatalog(options) { return runtimeCatalog.build(options); }
export function claimsCatalogStatus() { return runtimeCatalog.status(); }

export function claimInventory(catalog = runtimeCatalog) { return catalog.inventory(); }

export function pendingClaimConditions({ includeSkipped = false, catalog = runtimeCatalog } = {}) {
  return claimInventory(catalog).filter(({ lookup }) => (includeSkipped || lookup.status !== 'skipped')
    && (!['indexed', 'case_indexed'].includes(lookup.status) || lookup.remainingAlternatives)).map(({ method, claim, lookup }) => {
    const recognized = [];
    const unresolved = [];
    if (method === 'western' && (compileLillyMannersSource(claim)?.inputs || compileLillyTemperamentSource(claim)?.inputs)) {
      recognized.push(...claim.conditions.match.include.map(group =>
        group.map(({ fact, equals }) => `${fact} = ${equals}`).join(' 且 ')));
    } else if (method === 'western') {
      const convention = westernClaimConvention(claim);
      const profiles = new Set(claim.conditions.match.include.flat().filter(condition => condition.fact === 'chart.house_system').map(condition => condition.equals));
      const fallback = profiles.size === 1 ? [...profiles][0] : 'whole_sign';
      for (const group of [...claim.conditions.match.include, ...claim.conditions.match.exclude]) {
        const profile = group.find(condition => condition.fact === 'chart.house_system')?.equals ?? fallback;
        for (const condition of group) {
          const alternatives = westernClaimConditionAlternatives(condition, convention, group);
          const mapped = alternatives.every(variant => westernClaimGroup(variant, profile, convention)?.every(Boolean));
          (mapped ? recognized : unresolved).push(`${condition.fact} = ${condition.equals}`);
        }
      }
    } else {
      for (const clause of classifyConditions(method, claim)) {
        if (clause.alternatives || clause.mustBeAbsent || clause.metadata) recognized.push(clause.text);
        else unresolved.push(clause.text);
      }
    }
    return { method, id: claim.id, title: claim.title, status: lookup.status, reason: lookup.reason,
      recognized, unresolved, uncertain: claim.conditions.uncertain, excluded: claim.conditions.excluded,
      reviewNote: lookup.reviewNote ?? lillyNinthHouseReview(claim.id) ?? lillyMannersReview(claim.id)
        ?? lillyTemperamentReview(claim.id) ?? claimReviewNotes[claim.id],
      sourceNote: claim.conditions.match?.reason,
      calculationRequirements: claim.conditions.match?.requirements ?? [],
      sourceMatchStatus: claim.conditions.match?.status,
      revisedConditions: lookup.revisedConditions ?? false,
      revisedEvidence: lookup.revisedEvidence ?? false,
      normalized: method === 'western' ? claim.conditions.normalized : [],
      branches: lookup.branches?.map(({ text }) => text) ?? [], source: claim.source.url };
  });
}

export function* structuredClaimMappings(catalog = runtimeCatalog) {
  for (const { method, claim, inputs, branches, reason, remainingAlternatives, category, revisedConditions, revisedEvidence,
    reviewNote, calculationReference, compiler, incompatibleAlternatives, matchScope } of catalog.compiledEntries()) {
    const { conditions, id, source } = claim;
    const status = reason === 'user_requested_skip' ? 'skipped' : isHistoricalClaimCompiler(compiler) ? 'case_indexed'
      : inputs ? 'indexed' : branches.length ? 'branch_indexed' : 'unmapped';
    const sourceConditions = method === 'western' ? {
      ...conditions.match,
      ...([lillyMannersProfile, lillyTemperamentProfile, lillyMerchantCaseProfile,
        lillyParentDerivedProfile, lillyFamilyProfile, lillyWealthDurationProfile, lillyFortuneWitnessProfile,
        ptolemyFortuneProfile, cardanoFortuneProfile, ptolemyBookOneProfile, ptolemyFixedStarProfile, ptolemyTravelProfile,
        lillyProfessionDispositionProfile, lillyProfessionWitnessProfile, lillyBookOneAspectsProfile,
        lillyBookThreeRolesProfile, ptolemySiblingsProfile].includes(compiler)
        && { compiledGroups: inputs.map(input => input.required) }),
      include: conditions.match.include.map(group => {
        const convention = westernClaimConvention(claim);
        const facts = westernClaimGroup(group, 'whole_sign', convention);
        const groupExpansion = convention === 'lilly' ? lillySourceGroupAlternatives(group) : null;
        return group.map((condition, index) => ({ ...condition, mappedFact: facts?.[index] ?? null,
          ...(index === 0 && groupExpansion && { expandedGroups: groupExpansion.map(variant => westernClaimGroup(variant, 'whole_sign', convention)) }),
          ...(westernClaimConditionAlternatives(condition, westernClaimConvention(claim), group).some(variant => variant.length !== 1 || variant[0].fact !== condition.fact)
            && { expandedGroups: westernClaimConditionAlternatives(condition, westernClaimConvention(claim), group).map(variant =>
              westernClaimGroup(variant, group.find(c => c.fact === 'chart.house_system')?.equals ?? 'whole_sign', westernClaimConvention(claim))) }),
          ...(usesLillyAspectTable(facts?.[index]) && { orbAlternatives: ['main', 'other']
            .map(table => westernClaimCondition(condition, 'regiomontanus', westernClaimConvention(claim), table)) }) }));
      }),
      exclude: conditions.match.exclude.map(group => {
        const profiles = new Set(conditions.match.include.flat().filter(c => c.fact === 'chart.house_system').map(c => c.equals));
        const profile = profiles.size === 1 ? [...profiles][0] : 'whole_sign';
        const facts = westernClaimGroup(group, profile, westernClaimConvention(claim));
        return group.map((condition, index) => ({ ...condition, mappedFact: facts?.[index] ?? null }));
      }),
    } : [xingjueCareerProfile, xingjueEstateProfile, xingjueFudeProfile, xingjueSpouseProfile,
      xingjueMigrationProfile, xingjueWealthProfile, xingjueFriendsProfile, xingjueParentsProfile,
      xingjueSiblingsProfile, xingjueChildrenProfile, xingjueLifeBodyProfile, xingjueTianjiProfile,
      xingjueSamePalaceProfile, xingjuePalacePatternsProfile, xingjueNatalStarsProfile, jielanNatalStarProfile,
      ziweiChangshengSourceProfile, zpzqCaseProfile, guanceluCaseProfile,
      baziHistoricalCaseProfile, baziClassicalStructureProfile, yuanhaiNatalPassagesProfile,
      qtbjMetalWaterProfile, qtbjWoodFireEarthProfile].includes(compiler) ? [{
      text: conditions.normalized.join('；'), status: 'compiled_source_expression', alternatives: inputs,
    }] : compiler === quanshuMinggongPassageProfile ? [{
      text: conditions.normalized.join('；'), status: 'compiled_source_expression',
      alternatives: inputs.map(({ required, anyOf }) => ({ required, anyOf })),
    }] : ['bazi-literal-dnf-v1', 'bazi-literal-source-count-v1', 'yhzp-v3-one-virtue-v1', 'bazi-fixed-pillar-example-v1', 'bazi-natal-god-presence-v1', baziShenShaPlacementProfile, qtbjTermProfile, qtbjSeasonalPassageProfile, quanshuPalaceTextProfile, jielanPalacePassageProfile, ziweiSourceExclusionProfile, ziweiSoloSourceProfile, ziweiGusuiProfile, quanshuTongyuanProfile, quanshuZhuxingWendaProfile, 'ziwei-relative-palaces-v1', 'ziwei-natal-placement-v1', 'ziwei-earth-void-single-seat-v1', ziweiMutagenPlacementProfile].includes(compiler) ? [{ text: conditions.normalized.join('；'),
      status: compiler === 'ziwei-relative-palaces-v1' ? 'compiled_relative_expression'
        : compiler === 'bazi-literal-dnf-v1' ? 'compiled_literal_expression' : 'compiled_source_expression',
      alternatives: inputs.map(({ required, mustBeAbsent }) => ({ required, mustBeAbsent })) }]
      : classifyConditions(method, claim).map(({ text, alternatives, mustBeAbsent, metadata }) => ({
      text, ...(metadata ? { status: 'editorial_note' } : alternatives ? { alternatives } : mustBeAbsent ? { mustBeAbsent }
        : { status: 'unresolved', factors: mentionedFactors(method, text) }),
    }));
    const branchConditions = branches.map(({ modernInterpretation, interpretationOrigin, ...branch }) => branch);
    yield { id, method, status, reason, remainingAlternatives, sourceConditions, inputs: inputs ?? [], branches: branchConditions,
      ...(compiler && { conditionCompiler: compiler }),
      ...(matchScope && { matchScope }),
      ...(incompatibleAlternatives?.length && { incompatibleAlternatives }),
      ...(calculationReference && { calculationReference }),
      ...(method === 'bazi' && conditions.match && { sourceMatch: conditions.match }),
      revisedConditions: revisedConditions ?? false, revisedEvidence: revisedEvidence ?? false,
      ...(category && { mappedCategory: category }),
      reviewNote: reviewNote ?? claimReviewNotes[id],
      ...(branches.length && mappingSources.has(id) && { mappingSource: mappingSources.get(id) }),
      uncertain: conditions.uncertain, excluded: conditions.excluded, source: { book: source.book, passageId: source.passage_id, url: source.url,
        ...(source.local_path && { localPath: source.local_path, materialType: source.material_type }) } };
  }
}

function mentionedFactors(method, text) {
  // Labels for review only. Mentioning an item never asserts that it is a required fact.
  if (method === 'bazi') {
    const named = Object.entries({
      ganZhi: text.match(new RegExp(stemBranch, 'gu')),
      tenGods: text.match(new RegExp(tenGods, 'gu')),
      phases: text.match(/长生|沐浴|冠带|临官|帝旺|死绝|墓库/gu),
      structures: text.match(/三合|三会|六合|相冲|刑冲|相刑|六害|格局|用神|身旺|身强|身弱|旺相|得令|通月气|化气|成格/gu),
      timeLayers: text.match(/大运|行运|岁运|行运|流年|流月|行[财官印]运/gu),
    });
    return Object.fromEntries(named.filter(([, values]) => values).map(([key, values]) => [key, [...new Set(values)]]));
  }
  const factors = Object.entries({ stars: text.match(starToken), palaces: text.match(/身宫|命宫|兄弟|夫妻|妻妾|子女|男女宫|财帛|疾厄|迁移|奴仆|仆役|交友|官禄|田宅|福德|父母/gu),
    relations: text.match(/同宫|同垣|同度|三方四正|三方|三合|夹命|拱照|会照|对宫|冲照|夹|会|逢/gu),
    states: text.match(/入庙|庙旺|陷地|陷宫|落陷|得地|化禄|化科|化权|化忌/gu),
    timeLayers: text.match(/大限|行限|流年|流月|太岁/gu),
  });
  return Object.fromEntries(factors.filter(([, values]) => values).map(([key, values]) => [key, [...new Set(values)]]));
}

function consistentZiweiNatalPlacement(compiler, inputs, branches, observedFacts) {
  const usesTongyuan = compiler === quanshuTongyuanProfile || branches.some(branch => branch.conditionCompiler === quanshuTongyuanProfile);
  const usesZhuxingWenda = compiler === quanshuZhuxingWendaProfile || branches.some(branch => branch.conditionCompiler === quanshuZhuxingWendaProfile);
  const usesJielanStars = compiler === jielanNatalStarProfile || branches.some(branch => branch.conditionCompiler === jielanNatalStarProfile);
  const usesPlacement = compiler === 'ziwei-natal-placement-v1' || usesTongyuan || usesZhuxingWenda || usesJielanStars
    || [quanshuMinggongPassageProfile, xingjueCareerProfile, xingjueEstateProfile, xingjueFudeProfile, xingjueHealthProfile,
      xingjueFemaleProfile, xingjueSpouseProfile, xingjueSpouseConfigurationProfile,
      xingjueMigrationProfile, xingjueWealthProfile, xingjueFriendsProfile, xingjueParentsProfile,
      xingjueSiblingsProfile, xingjueChildrenProfile, xingjueLifeBodyProfile, xingjueTianjiProfile,
      xingjueSamePalaceProfile, xingjuePalacePatternsProfile, xingjueNatalStarsProfile, ziweiChangshengSourceProfile].includes(compiler)
    || branches.some(branch => [ziweiBirthGradeProfile, quanshuMinggongPassageProfile,
      xingjueCareerProfile, xingjueEstateProfile, xingjueFudeProfile, xingjueHealthProfile,
      xingjueFemaleProfile, xingjueSpouseProfile, xingjueSpouseConfigurationProfile, xingjuePalaceConfigurationProfile,
      xingjueMigrationProfile, xingjueWealthProfile, xingjueFriendsProfile, xingjueParentsProfile,
      xingjueSiblingsProfile, xingjueChildrenProfile, xingjueLifeBodyProfile, xingjueTianjiProfile,
      xingjueSamePalaceProfile, xingjueNatalStarsProfile, ziweiChangshengSourceProfile].includes(branch.conditionCompiler));
  const requiresYearCheck = (profile, groups) => profile === ziweiMutagenPlacementProfile
    || [jielanPalacePassageProfile, ziweiSoloSourceProfile, ziweiGusuiProfile, quanshuZhuxingWendaProfile,
      quanshuMinggongPassageProfile, xingjueCareerProfile].includes(profile)
      && groups.some(input => input.required.some(fact => fact.kind === 'star_mutagen'
        || profile === ziweiGusuiProfile && fact.kind === 'natal_year_stem'))
    || [xingjueEstateProfile, xingjueFudeProfile, xingjueHealthProfile, xingjueFemaleProfile,
      xingjueSpouseProfile, xingjueSpouseConfigurationProfile, xingjuePalaceConfigurationProfile].includes(profile)
      && groups.some(input => input.required.some(fact => fact.kind === 'palace_sector_mutagen'))
    || [xingjueMigrationProfile, xingjueWealthProfile, xingjueFriendsProfile, xingjueParentsProfile,
      xingjueSiblingsProfile, xingjueChildrenProfile, xingjueLifeBodyProfile, xingjueTianjiProfile,
      xingjueSamePalaceProfile, xingjuePalacePatternsProfile, xingjueNatalStarsProfile, jielanNatalStarProfile].includes(profile)
      && groups.some(input => [input.required, ...input.anyOf].some(group => group.some(fact => fact.kind === 'palace_sector_mutagen')));
  const usesMutagenPlacement = requiresYearCheck(compiler, inputs)
    || branches.some(branch => requiresYearCheck(branch.conditionCompiler, branch.inputs));
  return (!usesPlacement || compatibleZiweiNatalPlacement(observedFacts))
    && (!usesJielanStars || compatibleZiweiRelativeFacts(observedFacts))
    && (!usesMutagenPlacement || compatibleZiweiNatalMutagens(observedFacts));
}

function usesQtbjSeasonalPassages(compiler, branches) {
  return compiler === qtbjSeasonalPassageProfile || branches.some(branch => branch.conditionCompiler === qtbjSeasonalPassageProfile);
}

const qtbjCountedPassageProfiles = [qtbjMetalWaterProfile, qtbjWoodFireEarthProfile];

function usesQtbjCountedPassages(compiler, branches) {
  return qtbjCountedPassageProfiles.includes(compiler)
    || branches.some(branch => qtbjCountedPassageProfiles.includes(branch.conditionCompiler));
}

function usesZpzqCases(compiler, branches) {
  return compiler === zpzqCaseProfile || branches.some(branch => branch.conditionCompiler === zpzqCaseProfile);
}

function usesBaziClassicalStructures(compiler, branches) {
  return compiler === baziClassicalStructureProfile || branches.some(branch => branch.conditionCompiler === baziClassicalStructureProfile);
}

function usesYuanhaiNatalPassages(compiler, branches) {
  return compiler === yuanhaiNatalPassagesProfile || branches.some(branch => branch.conditionCompiler === yuanhaiNatalPassagesProfile);
}

function consistentBaZiPillars({ present, absentKeys }) {
  const isCoordinate = fact => ['pillar', 'stem', 'branch'].includes(fact.kind);
  return compatibleBaZiLiteralFacts(present.filter(isCoordinate), [...absentKeys].map(key => JSON.parse(key)).filter(isCoordinate));
}

function completeBaZiPillars(chart) {
  return positionNames.every(position => chart.present.some(fact => fact.kind === 'pillar' && fact.position === position))
    && consistentBaZiPillars(chart);
}

function provedBaZiDecadalPeriods(chart) {
  if (!completeBaZiPillars(chart)) return null;
  const genders = chart.present.filter(fact => fact.kind === 'natal_gender');
  if (genders.length !== 1) return null;
  const yearAndMonth = ['year', 'month'].map(position => chart.present.find(fact =>
    fact.kind === 'pillar' && fact.position === position).ganZhi);
  return confirmedBaZiDecadalPeriods(yearAndMonth, genders[0].gender, chart.present);
}

function supportsHistoricalCaseLookup(chart) {
  return chart.scope === 'natal' && completeBaZiPillars(chart)
    && ['natal_gender', 'bazi_fetal_month'].every(kind => chart.present.filter(fact => fact.kind === kind).length <= 1);
}

export function lookupBaziHistoricalCases(chart, tradition, catalog = runtimeCatalog) {
  if (!supportsHistoricalCaseLookup(chart)) return [];
  const keys = chart.present.filter(fact => ['pillar', 'natal_gender', 'bazi_fetal_month'].includes(fact.kind))
    .map(fact => JSON.stringify(fact));
  const candidates = catalog.candidates('bazi', keys, tradition, undefined, { caseReferences: true });
  return candidates.flatMap(({ claim, inputs, category = claim.category, promptEvidence }) => {
    const [match] = matchedClaimInputs(inputs, chart);
    const citation = reviewedBaziCaseCitation(claim);
    return match ? [{ id: claim.id, topic: category.topic, source: claim.source, reportEvidence: claimEvidence(claim), promptEvidence,
      matchedConditions: match.result.conditions, ...(citation && {
        ...citation, calculationNote: '四柱按所引国家图书馆藏本的异文复排。',
      }) }] : [];
  });
}

export function lookupWesternHistoricalCases(chart, tradition, catalog = runtimeCatalog) {
  if (tradition && tradition !== 'Christian Astrology') return [];
  const observed = lillyMerchantCaseContext(chart);
  if (!observed) return [];
  return catalog.candidates('western', observed.presentKeys, tradition, undefined, { caseReferences: true })
    .flatMap(({ claim, inputs, category = claim.category, promptEvidence }) => {
    const [match] = matchedClaimInputs(inputs, observed);
    const comparisonNote = lillyMerchantComparison(claim.id);
    return match ? [{ id: claim.id, topic: category.topic, source: claim.source, claim, reportEvidence: claimEvidence(claim), promptEvidence,
      matchedConditions: match.result.conditions, calculationNote: lillyMerchantCaseNote, ...(comparisonNote && { comparisonNote }) }] : [];
  });
}

function guanceluCaseContext(chart) {
  if (!supportsGuanceluCaseLookup(chart)) return null;
  const observed = claimChartContext('ziwei', chart);
  return observed.present.some(fact => fact.kind === 'palace_confirmed_body_seat') ? observed : null;
}

export function lookupZiweiHistoricalCases(chart, tradition, catalog = runtimeCatalog) {
  if (tradition && tradition !== '斗数观测录') return [];
  const observed = guanceluCaseContext(chart);
  if (!observed) return [];
  return catalog.candidates('ziwei', observed.presentKeys, tradition, undefined, { caseReferences: true })
    .flatMap(({ claim, inputs, category = claim.category, promptEvidence }) => {
    const [match] = matchedClaimInputs(inputs, observed);
    return match ? [{ id: claim.id, topic: category.topic, source: claim.source, referenceType: 'ziwei', promptEvidence,
      reportEvidence: claimEvidence(claim),
      matchedConditions: match.result.conditions, calculationNote: guanceluCaseNote }] : [];
  });
}

export function explainClaim(ruleId, method, chart, tradition, catalog = runtimeCatalog, { historicalAphorism, birthBranch } = {}) {
  const row = catalog.get(ruleId);
  if (!row) return null;
  const { claim, reason, condition, inputs, branches, compiler } = row;
  const { id } = claim;
  if (!inputs && !branches.length) return { claim, matched: false, reason, ...(condition && { condition }), reviewNote: row.reviewNote ?? claimReviewNotes[id] };
  if (!chart || method !== row.method || chart.scope !== 'natal' || (tradition && (row.reportTradition ?? claim.source.book) !== tradition)) {
    return { claim, matched: false, reason: 'calculation_profile' };
  }
  const isAphorism = row.matchScope === 'historical_aphorism';
  if (isAphorism && historicalAphorism !== true) return { claim, matched: false, reason: 'historical_aphorism_requires_opt_in' };
  if (compiler === baziHistoricalCaseProfile) {
    const [match] = supportsHistoricalCaseLookup(chart) ? matchedClaimInputs(inputs, chart) : [];
    const citation = reviewedBaziCaseCitation(claim);
    return { claim, matched: Boolean(match), matchScope: 'historical_case',
      ...(match ? { matchedConditions: match.result.conditions, calculationNote: '古籍命例仅按完整四柱及原例附加条件对照。',
        ...(citation && { comparisonSource: citation.source, comparisonNote: citation.comparisonNote }) }
        : { reason: 'conditions_not_met' }) };
  }
  if (compiler === lillyMerchantCaseProfile) {
    const observed = lillyMerchantCaseContext(chart);
    const [match] = observed ? matchedClaimInputs(inputs, observed) : [];
    const comparisonNote = lillyMerchantComparison(id);
    return { claim, matched: Boolean(match), matchScope: 'historical_case',
      ...(match ? { matchedConditions: match.result.conditions, calculationNote: lillyMerchantCaseNote,
        ...(comparisonNote && { comparisonNote }) } : { reason: 'conditions_not_met' }) };
  }
  if (compiler === guanceluCaseProfile) {
    const observed = guanceluCaseContext(chart);
    const [match] = observed ? matchedClaimInputs(inputs, observed) : [];
    return { claim, matched: Boolean(match), matchScope: 'historical_case',
      ...(match ? { matchedConditions: match.result.conditions, calculationNote: guanceluCaseNote } : { reason: 'conditions_not_met' }) };
  }
  if (!consistentZiweiNatalPlacement(compiler, inputs, branches, chart.present)) return { claim, matched: false, reason: 'conflicting_natal_year_placement' };
  if (usesQtbjSeasonalPassages(compiler, branches) && !consistentBaZiPillars(chart)
    || (usesZpzqCases(compiler, branches) || usesBaziClassicalStructures(compiler, branches)
      || usesYuanhaiNatalPassages(compiler, branches) || usesQtbjCountedPassages(compiler, branches)) && !completeBaZiPillars(chart)) {
    return { claim, matched: false, reason: 'conflicting_pillars' };
  }
  if (compiler === lillyProfessionSourcesProfile && !consistentLillyProfessionSource(claim.id, chart.present)) {
    return { claim, matched: false, reason: 'conditions_not_met' };
  }
  if (compiler === lillyPrefermentProfile && !consistentLillyPrefermentSource(claim.id, chart.present)) {
    return { claim, matched: false, reason: 'conditions_not_met' };
  }
  const ruleFacts = ({ required, mustBeAbsent, anyOf }) => [...required, ...mustBeAbsent, ...anyOf.flat()];
  const calculationFacts = method === 'western' ? [...(inputs ?? []).flatMap(ruleFacts),
    ...branches.flatMap(branch => branch.inputs.flatMap(ruleFacts))] : [];
  const wealthHistory = isAphorism && compiler === lillyWealthDurationProfile;
  const needsFortitude = wealthHistory || calculationFacts.some(fact =>
    fact.kind === 'western_lilly_wealth_principal' || fact.kind === 'western_lilly_wealth_strength'
    || (fact.kind === 'western_lilly_friend_condition' && ['fortified', 'weak'].includes(fact.condition))
    || lillyBookThreeNeedsScores(fact));
  const ptolemyBookOne = compiler === ptolemyBookOneProfile && isAphorism;
  const ptolemyTravel = compiler === ptolemyTravelProfile && isAphorism;
  const cells = new Map();
  const bookOneNeedsCells = ptolemyBookOne && ptolemyBookOneRequiresDignities(id);
  const travelNeedsCells = ptolemyTravel && ptolemyTravelRequiresDignities(id);
  const needsCells = compiler === ptolemyFortuneProfile || bookOneNeedsCells || travelNeedsCells;
  const ptolemyDignitiesAt = needsCells ? (sign, degree, sect) => {
    const key = `${sign}:${degree}:${sect}`;
    if (!cells.has(key)) cells.set(key, catalog.ptolemyFortuneDignities(sign, degree, sect));
    return cells.get(key);
  } : undefined;
  chart = claimChartContext(method, chart, calculationFacts,
    (sign, degree) => catalog.lillyDignityCells(sign, degree), needsFortitude ? () => catalog.lillyFortitudeRows() : undefined,
    { wealthHistory, ptolemyDignitiesAt: compiler === ptolemyFortuneProfile ? ptolemyDignitiesAt : undefined,
      cardanoFortune: compiler === cardanoFortuneProfile && isAphorism,
      ptolemyBookOne, ptolemyBookOneDignitiesAt: bookOneNeedsCells ? ptolemyDignitiesAt : undefined,
      ptolemyFixedStars: compiler === ptolemyFixedStarProfile && isAphorism,
      ptolemyTravel, ptolemyTravelDignitiesAt: travelNeedsCells ? ptolemyDignitiesAt : undefined });
  if (isAphorism && compiler === lillyFamilyProfile) {
    const selected = [lillyFamilyAphorismFact, ...(['male', 'female'].includes(birthBranch) ? [lillyFamilyBirthBranchFact(birthBranch)] : [])];
    chart = { ...chart, present: [...chart.present, ...selected],
      presentKeys: new Set([...chart.presentKeys, ...selected.map(fact => JSON.stringify(fact))]) };
  }
  if (!inputs) {
    const matches = matchPassageBranches(branches, chart);
    const calculationNote = claimCalculationNote([], matches, compiler, id);
    return { claim, matched: matches.length > 0, matchScope: 'passage_branch', matchedBranches: matches,
      ...(calculationNote && { calculationNote }),
      ...(row.category && { mappedCategory: row.category }),
      ...(mappingSources.has(id) && { mappingSource: mappingSources.get(id) }),
      ...(claimReviewNotes[id] && { reviewNote: claimReviewNotes[id] }),
      ...(matches.length === 0 && { reason: 'conditions_not_met' }) };
  }
  const matches = matchedClaimInputs(inputs, chart);
  if (matches.length) return { claim, matched: true,
    matchedConditions: claimConditions(matches, compiler, chart.present, ptolemyDignitiesAt, chart.lillyRoleEvidence),
    ...(isAphorism && { matchScope: 'historical_aphorism' }),
    ...(claimCalculationNote(matches, [], compiler, id) && { calculationNote: claimCalculationNote(matches, [], compiler, id) }) };
  const missing = inputs.map(({ required, mustBeAbsent, anyOf }) => [
    ...required.filter((fact) => !chart.presentKeys.has(JSON.stringify(fact))),
    ...mustBeAbsent.filter((fact) => !chart.absentKeys.has(JSON.stringify(fact))).map((fact) => ({ absenceRequired: fact })),
    ...(anyOf.map(group => group.filter(fact => !chart.presentKeys.has(JSON.stringify(fact))))
      .sort((a, b) => a.length - b.length)[0] ?? []),
  ])
    .sort((a, b) => a.length - b.length)[0];
  return { claim, matched: false, reason: 'conditions_not_met', missing };
}

function matchedClaimInputs(inputs, chart) {
  return inputs.flatMap((input) => {
    const result = evaluateRule(input, 'natal', chart);
    return result.matched ? [{ input, result }] : [];
  });
}

function lillyAspectProfileNote(matches) {
  const proofs = matches.map(({ input, result }) =>
    [...input.required, ...input.mustBeAbsent, ...result.conditions.alternatives.flat()].filter(usesLillyAspectTable));
  if (!proofs.length || proofs.some(facts => !facts.length)) return null;
  const tables = new Set(proofs.flat().map(fact => fact.table));
  return tables.size === 1 ? `本条已满足的相位组合采用莉莉${tables.has('main') ? '首列' : '另一说'}容许度；另一套表未满足同组全部条件，解释应保留这一口径差异。` : null;
}

function claimCalculationNote(matches, branches = [], compiler, claimId) {
  if (branches.some(branch => branch.conditionCompiler === shenfengReviewedProfile)) {
    return '用户资料包《神峰通考》经原书复核的本命盘面分句。相关旺弱沿用本项目月令与十神加权；岁运及旧断留在出处。';
  }
  if (branches.some(branch => branch.conditionCompiler === blindPalaceProfile)) {
    return '用户资料包的盲派宫星口诀，已核对应柱位的透干或地支本气。涉及独杀时另核四柱杀星位置。这里引用盘面条件，宫合与后续断语仍须另行核查。';
  }
  const notes = [lillyAspectProfileNote(matches)];
  if (compiler === lillyPrefermentProfile) {
    notes.push(lillyPrefermentExplanation(claimId));
  }
  if (compiler === lillyProfessionSourcesProfile) {
    notes.push(claimId === 'astro-lilly-v3-profession-p078-001'
      ? '莉莉职业篇由前两步确认唯一初始指征。两张容许度表均证实它与另两颗候选无形体合相或射线相位，才取单独发挥作用的原文。弱相位的判定仍待核。'
      : '莉莉职业篇由前两步确认职业指征星，再核条文所列相位、同座或月亮入相。每组相位统一采用一套容许度。强相位导致的指征移交和最终主次仍待核，职业称谓属于原书的历史取象。');
  }
  if (compiler === lillyProfessionSelectionProfile) {
    const required = matches.flatMap(({ input }) => input.required);
    if (required.some(fact => fact.kind === 'western_lilly_profession_tenth_house')) {
      notes.push('按莉莉卷三第626页，以第十宫头星座及其传统庙主的实际落座、落宫取职业资料。');
    } else if (required.some(fact => fact.kind === 'western_lilly_profession_account')) {
      notes.push('按莉莉卷三第626页的转述，比较七曜在出生时刻的几何东升次序，再核十宫庙主或十宫落位与月亮射线相位。这里采用东地平过界，完整的历史晨见可见度待核。');
    } else if (required.some(fact => fact.kind === 'western_lilly_profession_step' && fact.step === 5)) {
      notes.push('按莉莉卷三第625页，先排除前四步，再核几何东升次序和太阳前的黄经顺序一致，且水、金、火中只有一颗先于太阳升起。职业称谓属于原书的历史取象。');
    } else {
      notes.push('按莉莉卷三第625页核对职业选星，依次检查角宫、十宫主、照月整度相位及月亮半容许度。前三步无合格者才检查第四步，两张容许度表须一致。原书的职业称谓属于历史取象。');
    }
  }
  if (compiler === lillyProfessionWitnessProfile) {
    const facts = matches.flatMap(({ result }) => [...result.conditions.required, ...result.conditions.alternatives.flat()]);
    const precise = facts.some(fact => fact.kind === 'western_lilly_partile_aspect');
    notes.push(precise
      ? '莉莉卷三第626页的职业修饰，先确认当用职业指征，再查对应整度的合相或条文所需射线。其余强弱和主次留待核定。'
      : '莉莉卷三第632页的职业损害，逐一核对土星或火星对同一实际职业指征的形体合相、刑或冲。同组采用一张原书容许度表。');
    if (claimId === 'astro-lilly-v3-profession-p001-001') notes.push('原文要求火星善相强而有效。当前取对应整度的三合，并按莉莉五度规则查火星落宫，火星落座依实际盘面。');
  }
  if (compiler === lillyProfessionDispositionProfile) {
    notes.push(claimReviewNotes[claimId], '职业成就与行当称谓属于莉莉原书的历史取象。');
  }
  if (compiler === lillyTravelProfile) {
    notes.push('按莉莉卷三远行章，逐一核查有效见证。先由宫主、落宫、合相、接纳或尊贵确认远行主题，再查同一批指征星的宫位和星座。陆路、水路按指征星多数计算。方位只列本条的盘面见证，实际出行以本人安排为准。');
    if (claimId === 'astro-lilly-v3-travel-followup-p003-001') {
      notes.push('已接入火星或土星成相和掌管指征落座两支。指征单独失势的分支仍待核。');
    }
  }
  if (compiler === lillySiblingsProfile) {
    const angular = matches.some(({ input }) => input.required.some(fact => fact.kind === 'western_lilly_dignity'));
    notes.push(angular
      ? '依莉莉手足篇，同一颗星须同时在角宫并有本质尊贵。角宫按宫头前五度取位，尊贵查莉莉原表。出生次序和生活境遇是原书并列的历史取象。'
      : '依莉莉手足篇核对第三宫头、第三宫主、按宫头前五度取位的第三宫星体，以及火星和月亮的一般指征。采用本篇的星座和星体分类，实际手足人数以本人资料为准。');
  }
  if (compiler === lillyWealthSourcesProfile) {
    notes.push('依莉莉卷三财富篇选择第二宫主、截夺座主、福点及其主星、木星和依五度规则落第二宫的行星。同一行星承担多种角色时只计一颗，财源词列按已确认的行星与位置取材。职业、人物和财富主题仅作历史取象，实际收支与职业按现实资料判断。');
  }
  if (compiler === lillyWealthDurationProfile) {
    notes.push(claimReviewNotes[claimId], matches.some(({ input }) => [...input.required, ...input.anyOf.flat()]
      .some(fact => ['western_lilly_wealth_quarter', 'western_lilly_wealth_timing_motion'].includes(fact.kind)))
      ? '这里只核对历史原文所列的宫位或行星运动见证。阶段取证不换算年龄、财务事件年份或个人寿命。'
      : '原文用于讨论传统的财富守成主题，现实资产变化以实际资料为准。');
  }
  if (compiler === lillyFortuneWitnessProfile) {
    notes.push(claimReviewNotes[claimId] ?? '按原文短表取实算福点所在星座的传统庙主及其实际坐标。其他尊贵层次参与主宰的口径待核。',
      '此处为古籍中的财富主题。现实财务以实际资料为准。');
  }
  if (compiler === ptolemyFortuneProfile) {
    notes.push(claimReviewNotes[claimId]
      ?? '第 IV 卷第 2 章取实算福点的星座庙主。对该主星在自己所处位置的亲和核实至少两项，采用第 I 卷的庙、旺、三分与托勒密手稿界表。其他得势形式待核。');
  }
  if (compiler === cardanoFortuneProfile) notes.push(claimReviewNotes[claimId]);
  if (compiler === ptolemyBookOneProfile) {
    const chapter = claimId.split('-')[4];
    notes.push(claimReviewNotes[claimId]);
    notes.push({
      4: '卷一第 4 章载七曜冷暖燥湿的原书分类。日月修饰取五星之一与日或月成立的四类整座相位，证据列出所涉及的两星。',
      6: '卷一第 6 章分别核星体本性、日相方位和地平象限。晨昏按实算黄经判定前后，地平象限采用雷吉奥蒙塔努斯三维落宫。阴阳是原书星体分类术语。',
      7: '卷一第 7 章分别核水星晨昏的派属，以及土星配昼、火星配夜的历史调和取法。晨昏采用日相方位，地平昼夜采用已确认盘面。',
      8: '按 Robbins 版卷一第 8 章，用朔、上弦、望、下弦的有向黄经差划分四个开区间。末段采用下弦至下次朔的天文口径，观测隐没和 Ashmand 的初见异读另待核。',
      10: '卷一第 10 章按太阳热带落座核古典四季。原书东、北、西、南分别取上升、下中天、下降、上中天的 1° 黄经近角。比较时仅按原书优势性质核同类或相反，可核四季或近角两路，人生年龄类比仍待核。',
      12: '卷一第 12 章的两种取法分别查询。上升交替取行星所在热带星座距实际上升座的顺行步数。四象限取实际四轴之间的完整星座，跨轴的星座保留待核。',
      13: '卷一第 13 章按两星所在热带星座的最短步长，分别核六分、四分、三分、对分。盘面证据列实际星座。',
      14: '依据 Robbins 版卷一第 14 章注 80、82 的整座配对，从白羊座或天秤座向两侧数相同座数。白羊至处女为夏半圆，天秤至双鱼为冬半圆。',
      15: '依据 Robbins 版卷一第 15 章注 83 的整座配对，从巨蟹座或摩羯座向两侧数相同座数。',
      16: '卷一第 16 章落实为相隔一座或五座，且星座对同时排除分点座、至点座两类对称。两个星座均须有盘面事实。',
      17: '卷一第 17 章按热带星座核庙座分配的半圆，狮子至摩羯为太阳半圆，水瓶至巨蟹为月亮半圆。',
      18: claimId.endsWith('p013-001')
        ? '采用 Hübner 希腊校勘本：双子、天秤、宝瓶一组主东方，混合取东北。证据为实际落在本组的星座。'
        : '卷一第 18 章所列三分组已按热带星座取证。风向是原书的分类术语，由条目自身保留主风方向和混合读法。',
    }[chapter]);
  }
  if (compiler === ptolemyFixedStarProfile) {
    notes.push('《四书》卷一第 9 章列恒星的传统性质。历史查询采用实算热带视黄经与七曜、上升点或中天的最短弧不超过 1° 来选星。1° 是本项目的黄道投影尺度，恒星组仅核已校定的成员。', claimReviewNotes[claimId]);
  }
  if (compiler === lillyBookOneAspectsProfile) {
    notes.push('莉莉《Christian Astrology》卷一第十九章。星座方向按列出的两星顺序，渐入和渐离分别按原表两列容许度计算。此处供查证原书条件。');
    if (/aspects-p0(?:20|31|36|37)-001$/u.test(claimId)) notes.push(claimReviewNotes[claimId]);
  }
  if (compiler === lillyBookThreeRolesProfile) {
    notes.push('莉莉卷三以同一颗指征星的实际本命落宫、尊贵或相位取证。强弱用卷一积分区间判断，两个容许度表分别取证。原书措辞供历史取象，现实关系与事件应依据实际资料。');
  }
  if (compiler === ptolemySiblingsProfile) {
    notes.push('《四书》卷三兄弟姐妹篇用于同母手足取证。按选定版本逐处核对星座见证，原书的人数、次序、性别和寿命措辞仅供查阅。');
    if (/p0(?:17|18|19|20)-001$/u.test(claimId)) {
      notes.push('Ashmand 版将中天和当派母星列为可择一的起点。其相离条比对同一位置的两颗给予星。');
    } else if (claimId.endsWith('p036-001')) {
      notes.push('卡尔达诺评注在本章将水星置于两种性质之间，以已确认的水星落座查阅。');
    } else {
      notes.push('本次采用中天与昼金星或夜月亮同座的共同分支，分别核起点座和紧接下一座。中天与母星位置不同的读法待核。');
    }
  }
  if (compiler === ptolemyTravelProfile) {
    notes.push(claimReviewNotes[claimId], '此处核原书的盘面取证，实际行程及安全情况以现实信息判断。');
  }
  if (compiler === lillyChildrenProfile) {
    notes.push('依莉莉第五宫篇核对第一、第五、十一宫及各条指定对象。落宫沿用宫头前五度规则；星体性质和落座的组合核对同一对象。多产、少产与数量权重是原书的分类术语，用于说明古籍取象。实际生育及亲子情况以本人资料为准。');
  }
  if (compiler === lillyWitProfile) {
    notes.push('依莉莉卷三智识篇逐项核对水星、月亮和该句具名的见证。原文的智识、人格和能力判断只作历史取象，现实能力和健康另以实际资料判断。');
    if (matches.some(({ input }) => input.required.some(fact => fact.kind === 'western_lilly_wit'
      && ['mercury_below_horizon', 'mercury_above_horizon'].includes(fact.selector)))) {
      notes.push('地平上下按未移宫头的黄道经度判断；条文要求完全无相时，逐一核对其余六颗古典星体。');
    }
  }
  if (compiler === lillyEnemiesProfile) {
    notes.push('依莉莉卷三对立关系篇及相关格言核对本命盘。涉及对立指征星的条文检查第七、十二宫主、两宫实际落入的古典行星，以及与日月对冲的其他古典行星。落宫按宫头前五度判定。原书关于人数、身份和胜负的说法只作历史取象，现实关系以实际互动为准。');
    if (claimId === 'astro-lilly-v3-enemies-p009-001') notes.push('本条只引用已确认的日月分别对冲见证。“多星”分支尚待原书取数口径。');
  }
  if (compiler === lillyFriendsProfile) {
    if (claimId === 'astro-lilly-v3-friends-p041-001') {
      notes.push('依莉莉卷三友伴篇，火星或土星须落第一或第十一宫，由同一颗行星同时满足无本质尊贵及本位座或变动座。依相位选取指征的备选仍待核实。');
    } else if (matches.some(({ input }) => input.required.some(fact => fact.kind === 'western_lilly_friend_condition'))) {
      notes.push('莉莉卷三友伴篇此处核第一或第十一宫的实占行星，尊贵、强弱或受损证据须落在同一颗行星上。当前取已验证的盘式，其余取法待核。友人数目或关系定性属于古籍取象。');
    } else {
      notes.push('依莉莉卷三友伴篇核对第一、第十一宫的实际古典行星、宫头庙主或截夺座庙主。按宫头前五度判行星落宫，按原宫头计算截夺座。原书人物和职业词列作历史取象，实际友伴职业与关系以现实资料为准。');
    }
  }
  if (compiler === lillyNinthHouseProfile) {
    notes.push('莉莉卷三第九宫篇按宫头前五度核对本命落宫。判断空宫须核齐七颗古典星体，梦象先取第九宫实际星体，确认空宫才取实际宫主。古籍用语属于历史取象，实际信仰和梦境以本人经历为准。');
    const review = lillyNinthHouseReview(claimId);
    if (review) notes.push(review);
  }
  if (compiler === lillyMannersProfile) {
    notes.push('依莉莉卷三性情篇逐条核对上升座、截夺座、行星合相、第一宫主或具名恒星。原书的性情、品行和遭遇用语供历史取材，现实中的品行和行为以可核实的经历为准。');
    const review = lillyMannersReview(claimId);
    if (review) notes.push(review);
  }
  if (compiler === lillyTemperamentProfile) {
    notes.push('按莉莉卷三气质篇逐项核实历史见证。上升相位采用整度差，月亮相位采用同一套半容许度。单项见证供原书取材，热冷干湿的总计和命局主星仍待校核。');
    const review = lillyTemperamentReview(claimId);
    if (review) notes.push(review);
  }
  if (compiler === lillyParentDerivedProfile) notes.push(lillyParentDerivedNote);
  if (compiler === lillyFamilyProfile) {
    const review = claimReviewNotes[claimId];
    if (matches.some(({ input }) => input.required.some(fact => fact.kind === lillyFamilyAphorismFact.kind))) {
      notes.push(`${review ?? ''}命中仅表示盘面符合所选历史原文的条件。`);
    } else {
      notes.push(review, '本条采用莉莉卷三父母章的历史取象，家庭关系与处境以实际资料为准。');
    }
  }
  if (claimId === 'astro-lilly-v3-health-servants-p006-001') {
    notes.push('依莉莉卷三第六宫格言核对木星或金星实际落第六或第十二宫。原书的家内用工语境作历史取象，用于讨论合作及分工主题。');
  }
  if (compiler === cardanoDignityProfile) {
    const sunAngular = matches.some(({ input }) => input.required.some(fact =>
      fact.kind === 'western_cardano_dignity' && fact.selector === 'sun_angular' && fact.matches));
    notes.push('依卡尔达诺 1578 年译注第四卷第三章的第四档，太阳在阳性座，月亮在阴性座。'
      + (sunAngular ? '太阳居角、月亮离角。' : '月亮居角、太阳离角，原注比较中稍弱。')
      + '角位取实际 Regiomontanus 第一、四、七、十宫。');
  }
  if (compiler === ptolemyParentsProfile) {
    const selectors = matches.flatMap(({ input }) => input.required.filter(fact =>
      fact.kind === 'western_ptolemy_parent').map(fact => fact.selector));
    if (selectors.includes('hubner_greek')) {
      notes.push('Hübner 希腊校勘本分别核对日月的吉星伴随与同派星伴随。每种见证可在光体同座或黄道后继一座。');
    } else if (selectors.includes('allacci_latin')) {
      notes.push('Allacci 拉丁译本分别核对日月，各有吉星或同派星伴随即可。伴随位置取光体同座或黄道后继一座。');
    } else if (selectors.includes('attendance.in_sect_beneficial')) {
      notes.push('按本条整理口径，日月各有一颗既属吉星又与该光体同派的行星，位于同座或后继一座。');
    } else {
      notes.push('本章用昼夜选择本次优先观察的指征星，保留两颗自然指征。');
    }
  }
  if (isReviewedLillyMarriageSigns(claimId)) notes.push('婚次措辞属于原书的历史取象。报告只讨论盘面所示的关系主题，现实婚姻次数以本人经历为准。');
  const conditions = [...matches.map(({ input }) => input.required), ...branches.map(branch => branch.matchedConditions.required)];
  if (conditions.some(group => group.some(fact => ['western_lilly_aspect_phase', 'western_lilly_luminary_application'].includes(fact.kind)))) {
    notes.push('按出生时刻黄经与前后半小时的有向位移核对入相或离相，离相至少距精确相位六角分且仍在两星半径之和内。当前方向仅作原书取证，未判断之后能否完成相位，也不预测现实财产或个人关系。');
  }
  if (conditions.some(group => group.some(fact => fact.kind === 'western_lilly_node_house' || fact.kind === 'western_lilly_node_sign'))) {
    notes.push('月交点采用当时月球轨道与当日黄道相交的位置，南北交相隔一百八十度，落宫按莉莉宫头前五度判。友伴、家务和信仰措辞为古籍取象，个人关系与信仰以实际经历和本人表达为准。');
    if (claimId.includes('-friends-')) notes.push('本次仅核对交点实际落第一或第十一宫，相位取证另待复核。');
  }
  if (isReviewedLillyHouseDignity(claimId)) {
    const hasDignityCondition = conditions.some(group => group.some(fact => fact.kind === 'western_lilly_dignity'));
    notes.push('按莉莉宫头前五度规则重算落宫，宫主取传统庙主。' + (hasDignityCondition ? '同一行星同时满足落宫及本质尊贵条件；分别核对庙、擢升、三分主、界、面，五项皆无才判为漂泊。' : '')
      + '财产、家世与亲属的评语仅作古籍取象。');
    if (claimId === 'astro-lilly-v3-wealth-duration-p013-001') notes.push('本条仅确认二宫内合格候选；尚未执行多星的力量排序。');
  }
  if (isReviewedLillyComposite(claimId)) notes.push('本条按莉莉实际黄经与宫头前五度规则核落宫及传统七曜庙主。吉星只取木星、金星，凶星只取土星、火星；宫主身份与其落宫须属于同一颗星，不能借另一星的位置。职业星须先按已确认的选星步骤成为实际成员，再读取该成员自身星座；本段固定组排除天蝎，水土列举组不补处女。缺资料不作否定，性别仅用于原书已有历史分支。资源、生育、友伴和梦象均为原书取象，不当作现实结果或他人品质的必然判断。');
  if (conditions.some(facts => facts.some(fact => fact.kind === 'western_lilly_fortune_house'))) {
    notes.push('福点按莉莉卷二第143页以实际升点加月亮黄经减太阳黄经，昼夜用同一公式；卷三按宫头前五度判宫。福点主取其所在星座的传统庙主，福点与福点主分别判宫。');
  }
  if (isReviewedLillyFortune(claimId) && claimId.includes('religion-dreams')) notes.push('按原书分别核太阳、月亮、水星或福点实际所处宫位。涉及成相时，两端须包括满足宫位条件的同一颗星。个人信仰以当事人的表达为准。');
  if (claimId === 'astro-lilly-v3-spouse-description-p051-001') notes.push(claimReviewNotes[claimId]);
  if ([...matches.flatMap(({ input }) => [...input.required, ...input.mustBeAbsent]), ...conditions.flat()]
    .some(fact => fact.kind === 'western_lilly_aspect' && fact.aspect === 'any')) {
    notes.push('原句未指定相位种类，按莉莉四种射线相位与包含合相的宽泛读法比较，只使用两者一致的判断：六合、刑、拱、冲可以提供证据，处于合相容许度内则不自动肯定或否定。缺位置、宫主同为一星或输入矛盾不当作无相位；两套容许度仍整组独立核对。古代能力与关系评语仅供原书取象，不据此诊断能力、行为或健康事实。');
  }
  if (conditions.some(facts => facts.some(fact => fact.kind === 'western_lilly_sign_class'))) {
    notes.push('星座类别按莉莉所列分组核对具体对象：宫头、宫主与金星定位星不能互换，七宫头、七宫主和太阳的并列前提逐项满足，不要求它们是同一具体星座。定位星只取统一库原尊贵表的传统庙主；回归座只取巨蟹、摩羯，职业段四足组只取白羊、狮子、射手，不挪用同书其他段的更宽列表。职业类别仍先要求已确认的职业指征成员；古代婚次和职业象征不确定现实经历或身份。');
  }
  if (conditions.some(facts => facts.some(fact => fact.kind === 'western_lilly_solar_state'))) notes.push('太阳关系按莉莉原书定义分别计算，东方／西方不是宫位方位；燃烧要求同座且距离不足8度30分，光束以17度为界。原页一个十度燃烧例句与明说定义不一致，保留资料而按明说定义计算。日心17分以内的强化说明及职业章对照用于优先判日心，这是本次判定顺序的推定，未把它与一般燃烧／光束影响叠加；精确合、冲的方向转换点不补方向证据。');
  if (conditions.some(facts => facts.some(fact => fact.kind === 'western_lilly_speed_state'))) notes.push('快慢以本次时刻前后各12小时的实际黄经位移量与莉莉该天体平均日行量比较，方向另读顺逆行，不能以顺行冒充快行，也不把一小时差分乘24冒充完整日行量。“很快”及相对强度未据此设任意阈值。');
  if (compiler === 'ziwei-natal-placement-v1') notes.push('本条逐项核对本命星曜所守宫位及原列生年条件：生年天干与生年地支分别读取，不能用命宫地支代替出生年支。四生只指寅申巳亥四个地支位置，不是额外的长生状态；天马须实际守夫妻宫，其他宫的天马不替代。');
  if (compiler === ziweiMutagenPlacementProfile || branches.some(branch => branch.conditionCompiler === ziweiMutagenPlacementProfile)) {
    notes.push('本条化曜必须属于同一颗已命名星曜、同一实际宫位及本命时间层，不能拼接别星、别宫或流年化忌。生年与四化按当前iztro 2.6.5默认表核对，不相容原句保留待核。各篇地支列表分别使用；《全书》这一命宫分句的太阳列表含午，《捷览》化忌篇不含午，不能互相覆盖。分句只引用已确认的正向原句，不并入另句未确认的陷地判断。');
  }
  if (branches.some(branch => branch.conditionCompiler === ziweiBirthGradeProfile)) notes.push('本条只发送廉贞守申命且满足对应生年等级的独立原句；甲、庚、戊与丙的等级分别核对。申位条件不能由寅位替代，丙年次之不套用甲庚戊的贵格断语；明度仍按本条所据《全书》命宫表核对，古代等级不等于现实身份或职业保证。');
  if (compiler === 'ziwei-relative-palaces-v1') {
    notes.push('本条按原列宫位逐项匹配，命宫与身宫的择一、同宫与对宫、前后两侧相夹分别核对，不能跨宫拼接。新增组合经现行默认十四主星与六类身宫位置校验；不相容备选保留复核记录，未把且改成或。择一的独立取法仅用于已核的对应原句，不外推到其他来源。');
  }
  if (conditions.some(facts => facts.some(fact => fact.kind === 'day_master_strength' && fact.profile === 'monthly-weighted-strength-v1'))) {
    notes.push('日主旺衰按项目月令加权模型筛选，偏强／偏弱不是所有古籍流派的一致结论；未知时辰只保留十二种合法时柱评估一致的结果。');
  }
  if (compiler === 'yhzp-v3-one-virtue-v1') {
    notes.push('本条按所据卷三原句“天月一德”筛选，天德或月德至少一项实际出现，同时须为女命并见印绶；其他篇的“二德全者”条件分开保留，原资料异文说明不删除。天月德按节气月支重算，藏干不充当透出的月德。');
  }
  if (compiler === 'bazi-fixed-pillar-example-v1') notes.push('本条只复现原例辛日、申月、年干壬、月干戊、时干丙的指定排列，不以别柱的壬戊丙替代；未把这一排列概括为任意印星都能隔伤护官，原例的许贵是历史取格说明。');
  if (compiler === 'bazi-natal-god-presence-v1') notes.push('本条按原局已确认的伤官与正官同现核对，天干与支藏位置分别保留，七杀不替代正官；不额外添加两者都透干或都为月令本气的条件，也不以项目结构成立标记代替原句。此匹配不等于伤官格成立、制化成败或现实人格与关系结果。');
  if (compiler === baziShenShaPlacementProfile || branches.some(branch => branch.conditionCompiler === baziShenShaPlacementProfile)) {
    if (claimId === 'yhzp-v3-c087-p006-003') {
      notes.push('年支和日支分别按三合组起驿马，两支须互为实际马位。时辰未知时仍按已确认的年、日两支核对。离乡措辞属于古籍取象。');
    } else {
      notes.push('本条沿用项目现行本命神煞取法，从已确认的年柱或日柱及目标柱重算；年、日分别起查，不以本柱为自身的空亡、驿马或华盖来源。此为项目的明确计算口径，不声称原书已统一年查、日查之争。马落空亡、华盖逢空要求实际落在同一柱，不能拼接别柱；本篇妻宫指日支，不是时柱或紫微夫妻宫。未知时辰只核对已知柱，不补时柱，也不把未知当作没有。源段只引用已确认分句，学堂遇贵另句尚待核；这些是传统取象条件，不代表现实婚姻、迁居或职业结果必然发生。');
    }
  }
  if (branches.some(branch => branch.conditionCompiler === baziVisibleHiddenGodsProfile)) {
    notes.push('本条露官／露杀只核年、月、时天干，藏官／藏杀／藏财核四支藏干；官与七杀、正偏财分别保留。藏不自动等于未透，也未补出原句没有写明的缺席条件。只发送已匹配的独立原句；两种见证同时出现时保留其并存，不强取一个吉凶结论。');
  }
  if (conditions.some(facts => facts.some(fact => fact.kind === 'palace_source_brightness'))) {
    notes.push('明度采用《全书》卷二命宫表的固定修订口径，与软件默认明度及同卷歌诀分开；原表未列位置不补值。');
  }
  if (compiler === quanshuMinggongPassageProfile || branches.some(branch => branch.conditionCompiler === quanshuMinggongPassageProfile)) {
    notes.push('依《全书》卷二命宫表和歌诀核对本命座位、生年及指定同宫或会照。男女命按原段适用范围取用。古籍所述财禄、身份和其他断语只作传统取象。', claimReviewNotes[claimId]);
    if (conditions.some(facts => facts.some(fact => fact.kind === 'palace_confirmed_body_seat'))) {
      notes.push('身宫条件以排盘给出的实际身宫为准；同宫和三合都从该宫核对。');
    }
    if (conditions.some(facts => facts.some(fact => fact.kind === 'palace_life_trines_without_auspicious_mutagens'))) {
      notes.push('核对生年化禄、权、科各自的化星和落宫。此处三方指命宫、财帛宫及官禄宫，对宫另计。');
    }
  }
  if (conditions.some(facts => facts.some(fact => ['western_lilly_dignity', 'western_lilly_dignified_count'].includes(fact.kind)))) {
    notes.push('本质尊贵采用莉莉 p.104 原表，界与面按左闭右开区间取值；漂泊须五项本质尊贵均无，昼夜未定时只采两种结果一致的事实，不等同于整体强弱或现实能力。');
  }
  if (conditions.some(facts => facts.some(fact => fact.kind === 'western_lilly_dignified_count'))) {
    notes.push('本条按传统七曜分别核对庙、擢升、三分主、界、面，任有一项即计该星一次；同星多项不重复，失势或落陷不是本质尊贵。“三颗或四颗”保留精确数量，不改成至少三颗。未知昼夜先分别计算整盘数量，只取两者一致的值；缺任一星的位置或表值不补默认数量。');
  }
  if (conditions.some(facts => facts.some(fact => fact.kind === 'western_lilly_reception'))) {
    notes.push('接纳按莉莉本质尊贵原表重算，单向接纳保留接纳方与客星顺序；互容要求两颗不同天体各居对方尊贵，宫主与日月定位星只取传统庙主，未知昼夜不拼接两套结果。');
  }
  if (compiler !== lillyProfessionSourcesProfile
    && conditions.some(facts => facts.some(fact => fact.kind === 'western_lilly_profession_ruler'))) {
    notes.push('初始职业指征按莉莉卷三第625页前两步筛选。先取一、七、十宫内有本质尊贵且离太阳至少十七度的水、金、火，可多星同主。三者均已排除后才检查有本质尊贵且不落陷的十宫传统宫主。第三、第四步另列月亮见证，第五步另核唯一先日星。这里的唯一状态限于初始选星，下一章的强相位移交和性质混合仍需另判。职业称谓属于原书的历史取象。');
  }
  if (compiler === 'bazi-literal-dnf-v1') notes.push('本条透干只取年、月、时，藏干按各支原表核对；不透与原局完全不见分别处理，各月备选及其排除条件不跨支拼接，未知不当作缺席。');
  if (usesQtbjCountedPassages(compiler, branches)) {
    const chapters = compiler === qtbjWoodFireEarthProfile
      || branches.some(branch => branch.conditionCompiler === qtbjWoodFireEarthProfile) ? '论木、论火、论土' : '论金、论水';
    notes.push(`《穷通宝鉴》${chapters}按完整节气四柱取证。同一天干在一柱透藏并见只计一柱；透干看年、月、时，藏干查四支。旺衰采用项目现行加权口径，三合支局要求三支齐备。科名与财禄等措辞属于古籍取象。`);
    if (claimId === 'qtbj-v6-c105-p001-101') notes.push('此处辰日辰时采用已复排的戊申年盘式，戊在年干透出，庚藏于年支申。');
    if (claimId === 'qtbj-v6-c119-p003-401') notes.push('昼夜按出生时刻太阳相对当地地平线的位置判定。');
  }
  if (usesQtbjSeasonalPassages(compiler, branches)) {
    notes.push('《穷通宝鉴》按实际节气月令与日干匹配。透干核年、月、时，藏干核本命地支，不透与四柱干支均不见分别取证。三合分句按对应的三个地支同时出现核对，科举与财禄措辞只作古籍取象。');
    if (claimId === 'qtbj-v3-c021-p001-101') notes.push('同句先论壬庚透干，“不见戊土”按年、月、时干取证，巳月所藏的戊仍保留。');
    if (claimId === 'qtbj-v4-c058-p002-101') notes.push('辰月这一分句承接上文丙、癸、甲透干的比较，查丙甲透而癸未透，辰中仍藏癸。');
    if (claimId === 'qtbj-v3-c027-p002-401') notes.push('这里只查辛透、地支见辰和原句指定月令。化合逢时是原书对这组条件的称呼。');
    if (claimId === 'qtbj-v3-c036-p001-301') notes.push('两丙夹丁取月干、时干均为丙；支见水只取原局有亥或子可确认的口径。');
    if (claimId === 'qtbj-v3-c038-p002-301') notes.push('取支中藏癸且原局见申或酉的金支，按同段所述的救应取证。');
    if (claimId === 'qtbj-v4-c054-p002-301') notes.push('亥月所藏甲、壬分别为本段的甲长生与得地之水。无庚和庚仅藏支两项各自取材。');
  }
  if (claimId === 'yhzp-v4-c081-p008-001') notes.push('《四言独步》的月令见禄按日干禄位与本命月支一致取证，报告只引本条分句。');
  if (claimId === 'yhzp-v5-c109-p007-001') notes.push('《金神诗诀》逐一查时柱是否为癸酉、己巳、乙丑，引用本句的时柱取法。');
  if (claimId === 'ziwei-v2-xingjue-026-p438-001') notes.push('本条单坐沿用本项目单守口径，地空所在身宫须在核心正辅煞星组中仅有地空；普通杂曜另列，不把看不到其他星等同于没有其他星。身宫须为本命实际所落宫，不能借另一宫地空满足；他乡为本篇取象，不作现实遭遇的必然结论。');
  if (['ziwei-v1-zhuxing-wenda-p168000-001', 'ziwei-v4-jielan-222-p001-001'].includes(claimId)) notes.push('本条值身命按铃星实际守命宫或实际身宫择一，不要求同时守两宫，也不以其他宫铃星代替。身宫沿用当前本命排盘可达位置；沉吟、威势及形貌措辞为古籍取象，不作现实性格或外貌的必然结论。');
  if (compiler === 'bazi-reviewed-literal-source-v1') {
    const scope = {
      'qtbj-v5-c081-p002-101': '本条辰月辛日的月时皆丙须月干、时干同为丙，争合是该原篇对此配置的称名，不据此推定化合成败。',
      'qtbj-v2-c006-p001-002': '本条秋月甲日的庚透无丁保留庚在年、月、时透出与全局无丁，不能改成有丁但未制成功。',
      'yhzp-v5-c196-p002-001': '《合禄》核对戊日、庚申时及秋冬节月。无官印采用四柱干支和藏干均无木火的口径。',
    }[claimId] ?? '';
    notes.push(scope + '显干、藏干与未知分别核对，来源或条件改变须重新复核，历史交游与财禄评语不当作现实结果。');
  }
  if (compiler === 'bazi-literal-source-count-v1') notes.push('本条“一庚高透”核对年、月、时至少一处庚，日主不充当透干；原句“支藏一二丙火”同时保留至少一处、至多两处地支藏丙，未因归一化省略数字而丢掉上限。');
  if (branches.some(branch => branch.conditionCompiler === baziLiteralPassageProfile)) {
    notes.push('本条只引用已满足条件的独立原句，不将同段其他断语合并；透干只取年、月、时，“有两丙”核对至少两处，未额外添加最多两处的上限，隔位按四柱位置核对。');
  }
  if (branches.some(branch => branch.conditionCompiler === qtbjWoodPassageProfile)) {
    notes.push('按节月和日干核分句，透干核年、月、时，藏干核实际地支。只在明定了互斥或不透的分支核对未透，缺柱不能证明未透。科名、财禄措辞仅是古籍取象。');
  }
  if (compiler === qtbjTermProfile || branches.some(branch => branch.conditionCompiler === qtbjTermProfile)) {
    notes.push('中气按实际交接时刻核对，并保留原篇节月范围。透干核年、月、时；全局有无同时核对显干和实际藏干，缺柱不能证明全无。科名、名利、财禄仅为古籍取象。');
    if (claimId === 'qtbj-v2-c014-p008-001') notes.push('坐下木局核齐亥卯未，且日支参与。');
  }
  if (compiler === quanshuPalaceTextProfile || branches.some(branch => branch.conditionCompiler === quanshuPalaceTextProfile)) {
    notes.push('按《紫微斗数全书》卷二所列本命宫位查同宫，明度取该宫该星的排盘值。煞曜排除按条件所列星曜和宫位核对，星曜资料不足时保留未知。文武职、贵人、家缘和子息数等只作古籍取象。');
    if (claimId.startsWith('ziwei-v2-caibogong-')) notes.push('财禄和年龄措辞只作原书取象。');
    if (claimId.startsWith('ziwei-v2-fuqigong-')) notes.push('婚期和伴侣年龄措辞属于古籍取象，不代表已知婚姻事实。');
    if (claimId.startsWith('ziwei-v2-c007-')) {
      notes.push('疾厄篇的伤病、灾厄和康健措辞只作古籍引证。匹配说明描述实际星曜及其盘面关系，健康判断以专业医学评估为准。');
      notes.push(claimReviewNotes[claimId]);
    }
    if (claimId === 'ziwei-v2-fuqigong-p101009-002' || claimId === 'ziwei-v2-fuqigong-p101013-004'
      || claimId === 'ziwei-v2-c013-p101016-003') {
      notes.push(claimReviewNotes[claimId]);
    }
    if (claimId.startsWith('ziwei-v2-c003-p101019-')) notes.push(claimReviewNotes[claimId]);
    const confirmed = [...matches.map(({ result }) => result.conditions), ...branches.map(branch => branch.matchedConditions)];
    if (confirmed.some(({ required, alternatives }) => [...required, ...alternatives.flat()]
      .some(fact => fact.kind === 'palace_sector_star'))) {
      notes.push('会照核对本宫、对宫与两处三合宫。列名的会照星逐颗查验，泛称吉星取已确认的六吉见证。');
    }
    if (confirmed.some(({ required, alternatives }) => [...required, ...alternatives.flat()]
      .some(fact => fact.kind === 'palace_trine_star'))) {
      notes.push('本条的三合来会按实际两处三合宫取证。');
    }
    if (confirmed.some(({ required }) => required.some(fact => fact.kind.startsWith('palace_opposite_')))) {
      notes.push('只用地支正对且星表完整的对宫计数。吉曜核辅弼昌曲魁钺，煞曜核擎羊、陀罗、火星、铃星、地空、地劫。');
    }
    if (confirmed.some(({ required }) => required.some(fact => fact.kind === 'palace_sector_mutagen'))) {
      notes.push('会照条件所列的生年四化逐一核对生年干、实际承载星及入四正的本命宫位。');
    }
    if (claimId === 'ziwei-v2-caibogong-p101005-001') {
      notes.push('武曲化吉按本命武曲实际承载的生年化禄、化权或化科核对。');
    }
    if (conditions.some(group => group.some(fact => fact.kind === 'palace_sector_benefic_count' && fact.count === 0))) {
      notes.push('无吉按六吉未见核对，四处本命星曜资料齐备后才判定。');
    }
    if (conditions.some(group => group.some(fact => fact.kind === 'natal_daylight'))) {
      notes.push('昼夜按出生时刻太阳在当地地平线的上方或下方判定，只引用已命中的昼生或夜生条件。');
    }
  }
  if (compiler === jielanPalacePassageProfile || branches.some(branch => branch.conditionCompiler === jielanPalacePassageProfile)) {
    notes.push('《紫微斗数捷览》所引判语以指定本命宫位为准，明度按当前排盘取该星的值。只使用已命中的分句，财禄和旧式官职属于原书取象。');
    if (claimId === 'ziwei-v2-jielan-101-p014-016') notes.push('文曲项按原文“同前断”承接文昌条的分句，明度取本宫文曲。');
    if (claimId === 'ziwei-v2-jielan-101-p010-027') notes.push('本条将标题中的魁钺分别按天魁入命或天钺入命核对。');
    if (/^ziwei-v2-jielan-101-p01[13]-/u.test(claimId)) notes.push('兄弟、子息人数与家庭称谓属于历史取象，报告只讨论关系主题。');
    if (/^ziwei-v2-jielan-101-p012-(?:012|014|017|018|023|024|025|030|031|033)$/u.test(claimId)) {
      notes.push('夫妻宫的刑克、分离和外貌措辞是历史取象。报告只讨论相处主题，实际关系以现实资料为准。');
    }
    if (claimId.startsWith('ziwei-v2-jielan-101-p015-')) {
      notes.push('疾厄宫的疾病、体征和缓解措辞属于历史取象。报告仅说明命中的星曜配置，健康与诊疗以专业医学评估为准。');
    }
    if (/^ziwei-v2-jielan-101-p020-(?:004|014|015|022)$/u.test(claimId)) {
      notes.push('福德宫的寿数和寿夭措辞属于历史取象。报告仅讨论福德主题，省略寿数和生死推断。');
    }
    if (/^ziwei-v2-jielan-101-p019-(?:005|024)$/u.test(claimId)) {
      notes.push('田宅七杀会吉与会凶各按实际星曜核对。两项同时命中时，把原书两句作为并列见证。');
    }
    if (claimId.startsWith('ziwei-v2-jielan-101-p021-')) {
      notes.push('父母宫的刑克、福寿是历史取象。报告可讨论关系与照护主题，不据此推断家属寿命或实际遭遇。');
    }
    if (conditions.some(group => group.some(fact => fact.kind === 'palace_sector_star'))) {
      notes.push('会照逐项核对指定本命宫、对宫和两处三合宫，列出的每颗辅曜均须获得证据。');
    }
    if (conditions.some(group => group.some(fact => fact.kind === 'palace_sector_malefic_count'))) {
      notes.push('四煞计数按擎羊、陀罗、火星、铃星查验，需指定宫、对宫和两处三合宫的本命星曜资料齐备。');
    }
    if (conditions.some(group => group.some(fact => fact.kind === 'palace_sector_mutagen'))) {
      notes.push('本命化曜逐项核对生年干、实际承载星及其落宫。');
    }
    if (/^ziwei-v2-jielan-101-p(?:010-(?:005|043)|011-(?:023|037))$/u.test(claimId)) {
      notes.push('吉多须有指定宫、对宫及两处三合宫的完整星表，并且至少两颗六吉且六吉多于六煞。');
    }
    if (claimId === 'ziwei-v2-jielan-101-p019-021') notes.push(claimReviewNotes[claimId]);
  }
  if (compiler === guanceluNatalProfile || branches.some(branch => branch.conditionCompiler === guanceluNatalProfile)) {
    notes.push('《斗数观测录》按本命盘核对实际宫位。涉及身宫的条件须有出生时支、命宫支位和身宫支位的证据。案中人物、职业和行运结果只作为原出处的历史语境。');
    if (claimId === 'ziwei-v1-guancelu-001-p143-001') notes.push('禄存非单守需要实际观察到另一颗同宫星曜。');
    if (claimId === 'ziwei-v1-guancelu-001-p162-001') {
      notes.push('杀破狼以其中一颗守命宫或实际身宫为锚点，再核其余两颗落在两处三合宫。');
    }
  }
  if (compiler === jielanGusuiProfile || branches.some(branch => branch.conditionCompiler === jielanGusuiProfile)) {
    notes.push('《捷览》骨髓赋按本命星位核对同宫、相邻、对宫或三合。涉及身宫时，须取得实际身宫支位。明确写出的无煞条件按对应宫位确认。科名、财禄、性情和寿夭措辞沿用古籍取象。');
  }
  if (compiler === ziweiSourceExclusionProfile || branches.some(branch => branch.conditionCompiler === ziweiSourceExclusionProfile)) {
    const absent = [...matches.flatMap(({ input }) => input.mustBeAbsent), ...branches.flatMap(branch => branch.matchedConditions.absent)];
    if (absent.some(fact => fact.kind === 'palace_sector_star')
      || conditions.some(group => group.some(fact => fact.kind === 'palace_sector_malefic_count'))) {
      notes.push('所引会煞或排除条件按本宫、两处三合宫和对宫核对，四处本命星曜齐备后才判定。四煞指擎羊、陀罗、火星、铃星。');
    }
    if (absent.some(fact => fact.kind === 'palace_star')) notes.push('本条排除项只核对原句指定的本命落宫。');
    notes.push('古籍的关系、亲缘及财禄措辞只作传统取象。');
  }
  if (compiler === ziweiSoloSourceProfile || branches.some(branch => branch.conditionCompiler === ziweiSoloSourceProfile)) {
    notes.push('原句的独守按所指本命宫位核对。主星以该宫唯一正曜确认，辅曜独守须有该宫完整的本命核心星曜资料。子息数、关系断语、财禄与古代官职仅作传统取象。');
    if (claimId === 'ziwei-v2-xingjue-004-p1065-001') notes.push('无辅弼须核实本命宫、对宫与两处三合宫的本命星曜完整，四处均不见左辅、右弼。');
  }
  if (compiler === ziweiGusuiProfile || branches.some(branch => branch.conditionCompiler === ziweiGusuiProfile)) {
    notes.push('《斗数骨髓赋注解》按所引原句核对本命落宫、会照和生年。分支各自取材，古代官职、财禄等级与人物例只作古籍取象。');
    if (claimId === 'ziwei-v3-jielan-123-p001-093') notes.push('昌曲夹命的“亦如之”承接前句的排除条件，命宫须证实不见地空、地劫、擎羊、铃星。');
    if (['ziwei-v3-jielan-123-p001-108', 'ziwei-v3-jielan-123-p001-124'].includes(claimId)) {
      notes.push('寅亥合按原注两支核对，寅宫的禄存与亥宫星曜各自取证。');
    }
  }
  if (compiler === quanshuTongyuanProfile || branches.some(branch => branch.conditionCompiler === quanshuTongyuanProfile)) {
    notes.push('《紫微斗数全书》同垣篇按所引原句核对本命落宫及实际同守、会照或相邻关系。只取已命中的分句，书中官职、财禄与命例仅作古籍取象。', claimReviewNotes[claimId]);
  }
  if (compiler === quanshuZhuxingWendaProfile || branches.some(branch => branch.conditionCompiler === quanshuZhuxingWendaProfile)) {
    notes.push('《紫微斗数全书》诸星问答论按已确认的本命宫位、身宫及所列星曜关系取材。古籍所述官财、关系、品行与身体情况属于传统取象。', claimReviewNotes[claimId]);
    if (conditions.some(group => group.some(fact => fact.kind === 'palace_sector_mutagen'))) {
      notes.push('会照的生年化曜需有唯一载体、实际落宫及同宫或会照关系，且与生年四化表相符。');
    }
  }
  if (compiler === xingjueCareerProfile || branches.some(branch => branch.conditionCompiler === xingjueCareerProfile)) {
    notes.push('《紫微星诀》官禄篇按本命落宫、星曜和实际三合、对宫或夹宫关系取材，生年化曜核对其实际载体。书中的古代官职与成败描述属于传统取象。');
  }
  if (compiler === xingjueEstateProfile || branches.some(branch => branch.conditionCompiler === xingjueEstateProfile)) {
    notes.push('《紫微星诀》田宅篇核对本命同宫、会照、夹宫及生年化曜的实际位置。古书的家产、祖业和田园说法属于传统取象。');
  }
  if (compiler === xingjueFudeProfile || branches.some(branch => branch.conditionCompiler === xingjueFudeProfile)) {
    notes.push('《紫微星诀》福德篇按本命盘核对同宫、会照及夹宫，生年化曜核实唯一载体及落宫。福禄与荣困用语属于古籍取象，报告只取已命中的原句或分句。');
  }
  if (branches.some(branch => branch.conditionCompiler === xingjueHealthProfile)) {
    notes.push('《紫微星诀》疾厄篇核对本命星位、明度、宫位关系及生年化曜。匹配分句只描述盘面配置。');
  }
  if (branches.some(branch => branch.conditionCompiler === xingjueFemaleProfile)) {
    notes.push('《紫微星诀》女命篇按原书适用范围，核对本命星曜、身宫和生年化曜。匹配分句记录星曜配置及同宫、会照关系。');
  }
  if (compiler === xingjueSpouseProfile || branches.some(branch => branch.conditionCompiler === xingjueSpouseProfile)) {
    notes.push('《紫微星诀》夫妻篇核对本命夫妻宫、会照和夹宫，以及原句指定的星曜、化曜和长生阶段。原书的婚缘与科名用语属于传统取象，不能据此判定现实伴侣、婚期或婚姻结果。');
    if (claimId === 'ziwei-v3-xingjue-049-p1360-001' && branches.some(branch => branch.text === '但貞破夾則晚成多災')) {
      notes.push('廉贞、破军实夹时，原文后句是前句早科取象的例外。同见时按后句的早晚取象引用。');
    }
  }
  if (branches.some(branch => branch.conditionCompiler === xingjueSpouseConfigurationProfile)) {
    notes.push('《紫微星诀》夫妻篇核对本命落宫、会照、夹宫和生年化曜。原书婚配及家庭旧评留在出处。');
  }
  if (branches.some(branch => branch.conditionCompiler === xingjuePalaceConfigurationProfile)) {
    const chapter = xingjuePalaceConfigurationChapter(claimId);
    notes.push(`《紫微星诀》${chapter}篇核对本命宫位、星曜和原句指定的会照、明度、化曜或长生阶段。匹配分句记录盘面配置。`);
  }
  if (compiler === xingjueMigrationProfile || branches.some(branch => branch.conditionCompiler === xingjueMigrationProfile)) {
    notes.push('《紫微星诀》迁移篇核对本命迁移宫、对宫与夹宫。生年化曜须确认载体及落宫。远行、经商与科名措辞属于古籍取象。');
  }
  if (compiler === xingjueWealthProfile || branches.some(branch => branch.conditionCompiler === xingjueWealthProfile)) {
    notes.push('《紫微星诀》财帛篇按本命盘核同宫、四正、对照与两侧夹宫。生年化曜取实际载体与落宫。财禄措辞属于古籍取象。');
  }
  if (compiler === xingjueFriendsProfile || branches.some(branch => branch.conditionCompiler === xingjueFriendsProfile)) {
    notes.push('《紫微星诀》仆役篇依仆役宫的本命同守、三方及对宫取材，生年化曜须核载体和落宫。原书称谓与对交往的评语属于传统取象。');
  }
  if (compiler === xingjueParentsProfile || branches.some(branch => branch.conditionCompiler === xingjueParentsProfile)) {
    notes.push('《紫微星诀》父母篇按本命盘核同守、三方来照、实际两侧夹宫与长生阶段。亲缘、寿数及克亲字样仅作出处说明，不能据此判定亲属的经历、健康或生死。');
  }
  if (compiler === xingjueSiblingsProfile || branches.some(branch => branch.conditionCompiler === xingjueSiblingsProfile)) {
    notes.push('《紫微星诀》兄弟篇按本命同守、三合、对照及两侧夹宫核对。原书人数、亲缘与伤克措辞属于传统取象，不能据此判定现实兄弟姊妹的人数或经历。');
  }
  if (compiler === xingjueChildrenProfile || branches.some(branch => branch.conditionCompiler === xingjueChildrenProfile)) {
    notes.push('《紫微星诀》子息篇核对本命同守、三合、对照、夹宫与长生阶段。原书对子息的数目、性别及吉凶描述属于传统取象，不据此判定现实生育、妊娠或子女经历。');
  }
  if (compiler === xingjueLifeBodyProfile || branches.some(branch => branch.conditionCompiler === xingjueLifeBodyProfile)) {
    notes.push('《紫微星诀》身命篇在实际命宫或经时支核实的身宫取证。同守和夹宫须落到相应宫位，四化须核生年载体。原书对功名及人生经历的说法属于传统取象。');
  }
  if (compiler === xingjueTianjiProfile || branches.some(branch => branch.conditionCompiler === xingjueTianjiProfile)) {
    notes.push('《紫微星诀》卷二天机条按所列同守、三方四正或邻宫夹照取证，身宫按本命时支核对，科权禄忌核实生年载体。原书名位与得失用语只用于说明传统取象。');
  }
  if (compiler === xingjueSamePalaceProfile || branches.some(branch => branch.conditionCompiler === xingjueSamePalaceProfile)) {
    notes.push('《紫微星诀》诸星同位垣按盘面的原位、会照或邻宫取证。查无吉煞须有完整星表，四化须有生年载体。原书的名位、寿夭及性情用语只用于说明传统取象。');
    if (claimId === 'ziwei-v1-xingjue-044-p177-001') {
      notes.push('日照雷门按清抄本的午、辰、卯地匹配太阳守命，出生时刻须确认太阳在当地地平线上方。');
    }
    if (claimId === 'ziwei-v1-xingjue-044-p1040-001') {
      notes.push('破耗取本章破军条所指的破军，本句核对破军、擎羊、铃星实守官禄。');
    }
  }
  if (compiler === xingjuePalacePatternsProfile) {
    notes.push('《紫微星诀》诸宫杂格及庙享格按实际宫位、对照或夹宫取证。长生阶段按五行局和生年顺逆核对，火生按生年干支纳音，科权禄按实落宫位核实生年载体。古书的格名和名位措辞属于传统取象。');
    if (claimReviewNotes[claimId]) notes.push(claimReviewNotes[claimId]);
  }
  if (compiler === xingjueNatalStarsProfile || branches.some(branch => branch.conditionCompiler === xingjueNatalStarsProfile)) {
    const chapter = xingjueNatalStarsChapter(claimId);
    notes.push(`《紫微星诀》${chapter}按本命星曜的实际落宫取证。同宫、邻夹、三合及对照各自核对，命宫和身宫按实际位置分别处理。禄存与生年化禄分别查落宫，科权禄忌由生年及星曜载体校验。古书关于名位、财福或灾厄的用语属于传统取象。`);
    if ((chapter === '日月篇' || chapter === '论紫府') && claimReviewNotes[claimId]) notes.push(claimReviewNotes[claimId]);
    if (claimId === 'ziwei-v2-xingjue-020-p404-001') {
      notes.push('本句目前采用身宫落财帛、化科由三合宫来会的盘式。');
    }
  }
  if (compiler === jielanNatalStarProfile || branches.some(branch => branch.conditionCompiler === jielanNatalStarProfile)) {
    const annotatedTaiwei = claimId.startsWith('ziwei-v5-jielan-232-');
    const taiyin = claimId.startsWith('ziwei-v4-jielan-156-');
    const chapter = annotatedTaiwei ? '太微赋注解' : taiyin ? '太阴星论' : '分星篇和三方加会';
    notes.push(`《紫微斗数捷览》${chapter}按本命落宫取证。三合来拱和对宫来冲分开核对，四化检查生年及实际载体。空宫与无吉化的判断需要完整盘面证据。古籍的名位、亲缘和吉凶用语属于传统取象。`);
    if (annotatedTaiwei && /-(?:004|015|016|036)$/u.test(claimId)) {
      notes.push('昼夜按出生时刻太阳在当地地平线的上方或下方核对，身宫须确认实际落宫。');
    }
    if (claimId === 'ziwei-v4-jielan-169-p001-001') notes.push('本条已核实七杀守身，七杀与对宫天府均入庙、辅弼昌曲会照的盘式。守命一支继续待核。');
    if (claimId === 'ziwei-v4-jielan-169-p001-003') notes.push('七杀遇紫微所称化权是原书的星性取象。本条只核实紫微七杀同宫。');
    if (claimId === 'ziwei-v4-jielan-154-p001-002') notes.push('庙乐分句目前只采用天府实守田宅的情形。');
    if (taiyin) {
      notes.push(claimReviewNotes[claimId]);
      if (/-(?:005|012|014|018|021)$/u.test(claimId)) {
        notes.push('原文的子息和疾厄措辞属于古籍取象，盘面只能核对星曜配置。');
      }
    }
    if (/^ziwei-v4-jielan-(?:157|159|160|162|163|164|165|166|167|1[789]\d|2[012]\d)-/u.test(claimId)
      || /^ziwei-v5-jielan-(?:23[3-9]|24[1245])-/u.test(claimId)) {
      notes.push(claimReviewNotes[claimId]);
    }
  }
  if (compiler === ziweiChangshengSourceProfile || branches.some(branch => branch.conditionCompiler === ziweiChangshengSourceProfile)) {
    notes.push('按排盘所用五行局、生年阴阳和性别计算长生十二神，并以命宫的排盘结果校验。匹配时核对原句指定的实际宫位与星曜。古籍格名和吉凶用语属于传统取象。');
  }
  if (usesZpzqCases(compiler, branches)) {
    notes.push('《子平真诠》例式按四柱实际月令、透干位置及原句所列合冲会局核对。原书的格名和六亲结果属于传统取象。');
  }
  if (usesBaziClassicalStructures(compiler, branches)) {
    notes.push('按实排四柱核对原文的月令本气、透藏、柱序和神煞。涉及财印的分句参照原书所列命式，区分库支余气与已经透出或作本气的财。原书贵显、性情用语属于传统取象。');
  }
  if (usesYuanhaiNatalPassages(compiler, branches)) {
    notes.push('《渊海子平》按完整节气四柱核对月令、日干、柱位、透藏和支局。旺衰采用项目已实现的月令加权及十神旺度口径。科名、财禄和六亲描述属于古籍取象。');
    if (claimId.startsWith('yhzp-v3-c065-')) {
      notes.push('明确要求化气的分句核对与日干相邻的合干、月令及根气，并排除争合和相关支冲。原句只论五合时按实际的日干五合取材。');
    }
    if (claimId === 'yhzp-v3-c087-p003-002') {
      notes.push('本条保留库内「切財」录文，同段组合据《刻京台增补渊海子平大全》作劫财核对。');
    }
    if (['yhzp-v2-c244-p002-002', 'yhzp-v3-c146-p001-002', 'yhzp-v4-c002-p014-001', 'yhzp-v4-c040-p006-002'].includes(claimId)) {
      notes.push(claimReviewNotes[claimId]);
    }
  }
  if (branches.some(branch => branch.conditionCompiler === baziDecadalPassageProfile)) {
    notes.push('原文按本命前提及所列运干或运支取材。大运干支依出生年干阴阳、性别和月柱校验，虚岁限段沿用已确认的排盘。古书的财禄、科名措辞属于传统取象。');
  }
  if (branches.some(branch => branch.conditionCompiler === baziEqualColumnsPassageProfile)) {
    notes.push('原句逐位核对年柱与日柱、月柱与时柱的同柱关系。古书的贵显用语属于传统取象。');
  }
  return notes.filter(Boolean).join('；') || null;
}

function claimConditions(matches, compiler, observed, ptolemyDignitiesAt, lillyRoleEvidence) {
  const { result } = matches[0];
  const conditions = matches.length === 1 ? result.conditions : {
    ...result.conditions,
    alternatives: matches.flatMap(({ result: { conditions } }) => conditions.alternatives.length
      ? conditions.alternatives.map(group => [...conditions.required, ...group])
      : [conditions.required]),
  };
  if (compiler === lillyPrefermentProfile) return lillyPrefermentConditions(conditions, observed);
  if (compiler === lillyFamilyProfile) return lillyFamilyProof(conditions, observed);
  if (compiler === lillyBookOneAspectsProfile) return lillyBookOneAspectProof(conditions, observed);
  if (compiler === lillyBookThreeRolesProfile) {
    const { passage } = conditions.required.find(fact => fact.kind === lillyBookThreeRoleKind);
    return { ...conditions, required: [...conditions.required, ...lillyRoleEvidence.get(passage)] };
  }
  if (compiler === lillyWealthDurationProfile) return lillyWealthHistoryProof(lillyWealthPrincipalProof(conditions, observed), observed);
  if (compiler === lillyFortuneWitnessProfile) return lillyFortuneWitnessProof(conditions, observed);
  if (compiler === ptolemyFortuneProfile) return ptolemyFortuneProof(conditions, observed);
  if (compiler === cardanoFortuneProfile) return cardanoFortuneProof(conditions, observed);
  if (compiler === ptolemyBookOneProfile) return ptolemyBookOneProof(conditions, observed, ptolemyDignitiesAt);
  if (compiler === ptolemyFixedStarProfile) return ptolemyFixedStarProof(conditions, observed);
  if (compiler === ptolemySiblingsProfile) return ptolemySiblingProof(conditions, observed);
  if (compiler === ptolemyTravelProfile) return ptolemyTravelProof(conditions, observed, ptolemyDignitiesAt);
  return conditions;
}

function matchPassageBranches(branches, chart) {
  let decadalSequence;
  return branches.flatMap(({ text, inputs, decadalAnchor, conditionCompiler, modernInterpretation, interpretationOrigin, promptEvidence }) => {
    const candidates = matchedClaimInputs(inputs, chart);
    const matches = conditionCompiler === blindPalaceProfile
      ? candidates.filter(({ input }) => confirmedBlindPalacePlacement(chart, input))
      : candidates;
    if (!matches.length) return [];
    if (conditionCompiler === baziEqualColumnsPassageProfile && !completeBaZiPillars(chart)) return [];
    if (conditionCompiler === shenfengReviewedProfile && !consistentBaZiPillars(chart)) return [];
    const matchedConditions = claimConditions(matches);
    if (conditionCompiler === baziDecadalPassageProfile) {
      if (decadalSequence === undefined) decadalSequence = provedBaZiDecadalPeriods(chart);
      const periods = selectBaZiDecadalPeriods(decadalSequence, decadalAnchor);
      if (!periods.length) return [];
      matchedConditions.decadalPeriods = periods;
    } else if (decadalAnchor) {
      const selectors = Object.entries(decadalAnchor);
      const periods = chart.present.filter((fact) => selectors.every(([key, value]) => fact[key] === value));
      if (periods.length !== 1) return [];
      const [{ kind, ...period }] = periods;
      matchedConditions.decadalPeriod = { ...period, ageBasis: '虚岁' };
    }
    return [{ text, modernInterpretation, interpretationOrigin, matchedConditions,
      matchedRuleConditions: matches.map(({ result }) => result.conditions),
      ...(conditionCompiler && { conditionCompiler }), ...(promptEvidence && { promptEvidence }) }];
  });
}

export function lookupClaims(method, chart, tradition, catalog = runtimeCatalog, connection) {
  if (chart.scope !== 'natal' || !methods.includes(method)) return [];
  const observed = chart;
  const ptolemyDignitiesAt = method === 'western' && (!tradition || tradition === 'Tetrabiblos')
    ? (sign, degree, sect) => catalog.ptolemyFortuneDignities(sign, degree, sect, connection) : undefined;
  let qtbjPillarsAgree;
  let fullPillarsAgree;
  chart = claimChartContext(method, chart, method === 'western' ? [...catalog.factsByKind('western_lilly_aspect', connection),
    ...catalog.factsByKind('western_lilly_partile_aspect', connection),
    ...catalog.factsByKind('western_lilly_aspect_phase', connection), ...catalog.factsByKind('western_lilly_luminary_application', connection),
    ...catalog.factsByKind('western_lilly_reception', connection),
    ...catalog.factsByKind(lillyBookThreeRoleKind, connection).filter(isLillyBookThreeOrdinaryRole)] : [],
    (sign, degree) => catalog.lillyDignityCells(sign, degree, connection),
    method === 'western' && (!tradition || tradition === 'Christian Astrology') ? () => catalog.lillyFortitudeRows(connection) : undefined,
    { ptolemyDignitiesAt });
  return catalog.candidates(method, chart.presentKeys, tradition, connection)
    .flatMap(({ claim, inputs, branches, compiler, category = claim.category, reportTradition, promptEvidence }) => {
    const { id, source, interpretation } = claim;
    if (tradition && tradition !== (reportTradition ?? source.book)) return [];
    if (!consistentZiweiNatalPlacement(compiler, inputs, branches, observed.present)) return [];
    if (compiler === lillyProfessionSourcesProfile && !consistentLillyProfessionSource(id, observed.present)) return [];
    if (compiler === lillyPrefermentProfile && !consistentLillyPrefermentSource(id, observed.present)) return [];
    if (usesQtbjSeasonalPassages(compiler, branches) && !(qtbjPillarsAgree ??= consistentBaZiPillars(observed))) return [];
    if ((usesZpzqCases(compiler, branches) || usesBaziClassicalStructures(compiler, branches)
      || usesYuanhaiNatalPassages(compiler, branches) || usesQtbjCountedPassages(compiler, branches))
      && !(fullPillarsAgree ??= completeBaZiPillars(observed))) return [];
    const matches = inputs ? matchedClaimInputs(inputs, chart) : [];
    const matchedBranches = inputs ? [] : matchPassageBranches(branches, chart);
    if (!matches.length && !matchedBranches.length) return [];
    const matchedConditions = matches.length
      ? claimConditions(matches, compiler, chart.present, undefined, chart.lillyRoleEvidence) : matchedBranches[0].matchedConditions;
    const input = matches[0]?.input ?? normalizeRuleInput(method, { required: matchedConditions.required });
    const branchText = matchedBranches.map(({ text }) => text).join('。');
    return [{
      id, method, claim, input, layer: category.type === '性格' ? 'personality' : 'events',
      topic: category.topic, originalTopic: claim.category.topic, chartScope: 'natal', rulesetVersion: chartVersions[method].rulesetVersion,
      reading: branchText || interpretation.classical_meaning, basis: branchText || claim.evidence.original_text, limit: interpretation.limitations.join('。'),
      ...(claimCalculationNote(matches, matchedBranches, compiler, id) && { calculationNote: claimCalculationNote(matches, matchedBranches, compiler, id) }),
      keywords: chartKeywords(method, input.required), matchedConditions,
      ...(matches.length && { matchedRuleConditions: matches.map(({ result }) => result.conditions) }),
      ...(promptEvidence && { promptEvidence }),
      ...(matchedBranches.length && { matchScope: 'passage_branch', matchedBranches }),
      source: { title: source.book, locator: [source.volume, source.chapter, source.section].filter(Boolean).join(' · '),
        url: source.url, author: source.author, edition: source.edition, passageId: source.passage_id, tradition: source.book },
    }];
  });
}

const configurationTitles = new Map([
  [blindPalaceProfile, '盲派宫星定位盘面分句'],
  [shenfengReviewedProfile, '《神峰通考》本命盘面分句'],
  [xingjueHealthProfile, '《紫微星诀》疾厄宫盘面分句'],
  [xingjueFemaleProfile, '《紫微星诀》女命篇盘面分句'],
  [xingjueSpouseConfigurationProfile, '《紫微星诀》夫妻篇盘面分句'],
]);

export function claimForPrompt(rule) {
  const legacy = rule.claim ? null : legacyEvidence(rule);
  const claim = rule.claim ?? {
    id: rule.id,
    title: rule.reading,
    category: { topic: rule.topic, type: rule.layer === 'personality' ? '性格' : '事件', tags: [] },
    source: {
      book: rule.source.title, author: rule.source.author, edition: rule.source.edition,
      volume: rule.source.volume ?? null, chapter: rule.source.locator, section: null,
      passage_id: rule.source.passageId, url: rule.source.url,
    },
    evidence: { original_text: legacy.originalText, context: rule.basis || null,
      ...(legacy.originalKind && { original_kind: legacy.originalKind }) },
    conditions: {
      original: rule.sourceCondition?.literalConditions ?? [],
      normalized: rule.keywords.filter((keyword) => !keyword.startsWith('!')),
      uncertain: [],
      excluded: rule.keywords.filter((keyword) => keyword.startsWith('!')).map((keyword) => keyword.slice(1)),
    },
    interpretation: { classical_meaning: rule.reading, limitations: rule.limit ? [rule.limit] : [] },
  };
  if (rule.matchScope === 'passage_branch') {
    // Do not give the model outcomes from sub-sentences whose conditions failed.
    const configurationTitle = rule.matchedBranches.map(({ conditionCompiler }) => conditionCompiler === xingjuePalaceConfigurationProfile
      ? `《紫微星诀》${xingjuePalaceConfigurationChapter(claim.id)}篇盘面分句`
      : configurationTitles.get(conditionCompiler)).find(Boolean);
    const temperament = rule.matchedBranches.some(({ matchedConditions }) =>
      matchedConditions.required.some(({ kind }) => kind === 'bazi_element_temperament'));
    const limitations = configurationTitle ? [] : temperament ? [...claim.interpretation.limitations,
      '旺相、休囚、太过和不及按项目的五行权重与月令算法筛选，解读时结合全盘。'] : claim.interpretation.limitations;
    const matchedBranches = rule.matchedBranches.map(branch => branch.modernInterpretation
      ? branch : { ...branch, ...branchInterpretation(claim, branch) });
    return {
      ...claim,
      ...(configurationTitle && { title: configurationTitle }),
      ...(rule.topic !== claim.category.topic && {
        category: { ...claim.category, topic: rule.topic },
        originalCategory: claim.category,
      }),
      evidence: { original_text: rule.matchedBranches.map(({ text }) => text).join('。'), context: null },
      ...(mappingSources.has(rule.id) && { mappingSource: mappingSources.get(rule.id) }),
      conditions: { original: [], normalized: [], uncertain: [], excluded: [] },
      interpretation: { classical_meaning: matchedBranches.map(({ modernInterpretation }) => modernInterpretation).join('\n'), limitations },
      method: rule.method, matchedConditions: rule.matchedConditions, matchScope: rule.matchScope, matchedBranches,
    };
  }
  // Context may include other newly split judgments or an entire source chapter.
  // Keep it in the catalog for review; supply only this record's proven evidence.
  const { original, normalized, uncertain, excluded } = claim.conditions;
  return { ...claim, evidence: { ...claim.evidence, context: null },
    conditions: { original, normalized, uncertain, excluded },
    method: rule.method, matchedConditions: rule.matchedConditions };
}
