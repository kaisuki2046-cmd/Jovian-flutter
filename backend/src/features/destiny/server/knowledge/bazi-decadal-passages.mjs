import { createHash } from 'node:crypto';
import { LunarUtil } from 'lunar-javascript';
import { baziStemPhase } from '../../control/charts.ts';
import { normalizeRuleInput } from './matching.mjs';
import { shenfengLayeredSealWithOfficer, shenfengOutputWithoutOfficer, shenfengSpringWoodWithFire } from './bazi-shenfeng-reviewed.mjs';
import { balance, count, godColumns, missing, multiple, pattern, quantity, seen, shown, trine, vigor, weak } from './qtbj-counted-passages.mjs';

export const baziDecadalPassageProfile = 'bazi-decadal-source-passage-v1';
const dayStem = stem => ({ kind: 'stem', position: 'day', stem });
const monthBranch = branch => ({ kind: 'branch', position: 'month', branch });
const supportedOfficer = { kind: 'bazi_month_pattern', name: '正官格', result: '见配合' };
const strongDay = { kind: 'day_master_strength', result: '偏强', profile: 'monthly-weighted-strength-v1' };
const woodWealth = [
  [{ kind: 'stem', position: 'year', stem: '戊' }],
  ...['戊', '己'].map(stem => [{ kind: 'stem', position: 'hour', stem }]),
];
// 《论正官》 explicitly gives these two rooted and exposed examples.
const officerExamples = [
  { day: '甲', month: '辛酉', partner: '丙', lu: '寅' },
  { day: '乙', month: '庚申', partner: '乙', lu: '卯' },
];
const officerFacts = ({ day, month }) => [dayStem(day), { kind: 'pillar', position: 'month', ganZhi: month }, supportedOfficer];
const structure = name => ({ kind: 'bazi_ten_god_structure', name });
const withLuck = (inputs, luck) => inputs.map(input => ({ ...input, ...luck }));
const officerLuck = natal => [...'甲乙丙丁戊己庚辛壬癸'].map((day, index) => ({
  required: [dayStem(day), natal],
  stems: ['辛庚癸壬乙甲丁丙己戊'[index]],
}));
const wealthLucks = [
  ['甲乙', '土', '金', '辛庚', '辰戌丑未'],
  ['丙丁', '金', '水', '癸壬', '申酉'],
  ['戊己', '水', '木', '乙甲', '亥子'],
  ['庚辛', '木', '火', '丁丙', '寅卯'],
  ['壬癸', '火', '土', '己戊', '巳午'],
];
const weakWealthAndOfficer = wealthLucks.flatMap(([days, wealth, officer, properOfficerStems, branches]) =>
  [...days].flatMap((day, index) => withLuck(
    pattern(day, '', [strongDay, balance(wealth, '少量'), balance(officer, '少量')], seen(properOfficerStems[index])),
    { branches: [...branches] },
  )));
const wellConditions = [
  count('庚', 'visible', 2),
  ...[...'壬癸戊己'].map(stem => count(stem, 'visible', 0)),
  missing('丙'), missing('丁'),
];

const favorableLuckBranches = stem => [...'子丑寅卯辰巳午未申酉戌亥'].filter(branch =>
  ['长生', '临官', '帝旺'].includes(baziStemPhase(stem, branch)));
const natalGodCount = (tenGod, count) => ({ kind: 'bazi_ten_god_count', tenGod, count });
const monthGod = tenGod => ({ kind: 'branch_main_ten_god', position: 'month', tenGod });
const natalOuterSeats = ['year', 'month', 'hour'];
const wealthBranchesByDayElement = ['辰戌丑未', '申酉', '亥子', '寅卯', '巳午'];
const dayStems = '甲乙丙丁戊己庚辛壬癸';
const favorableLuck = (day, luckStem, required) => ({
  required: [dayStem(day), ...required], stems: [luckStem], branches: favorableLuckBranches(luckStem),
});

const winterBranches = '亥子丑';
const allBranches = '子丑寅卯辰巳午未申酉戌亥';
const earthBranches = '辰戌丑未';
const natalBladeBranches = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
const fireAndEarthPillars = LunarUtil.JIA_ZI.filter(([stem, branch]) =>
  ('丙丁'.includes(stem) && earthBranches.includes(branch)) || ('戊己'.includes(stem) && '巳午'.includes(branch)));
const earthPillarsWithoutFire = LunarUtil.JIA_ZI.filter(([stem, branch]) =>
  ('戊己'.includes(stem) || earthBranches.includes(branch))
  && !'丙丁'.includes(stem) && LunarUtil.ZHI_HIDE_GAN[branch].every(hidden => !'丙丁'.includes(hidden)));
const youthDeclineOrExtinction = ['甲乙', '丙丁', '戊己', '庚辛', '壬癸'].flatMap(([representative, paired]) => {
  const branches = [...allBranches].filter(branch => ['衰', '绝'].includes(baziStemPhase(representative, branch)));
  return [representative, paired].map(day => ({
    required: [dayStem(day)], branches, ageRange: { startAge: 1, endAge: 29 },
  }));
});
const excessiveOfficer = { kind: 'bazi_ten_god_strength', group: '官杀', profile: 'anchored-weighted-ten-god-v1', strength: '过盛' };
const strongOfficerLuck = [...dayStems].map((day, index) => {
  const officerStems = ['庚辛', '壬癸', '甲乙', '丙丁', '戊己'][Math.floor(index / 2)];
  return {
    required: [dayStem(day), { kind: 'natal_gender', gender: '女' }, weak, excessiveOfficer],
    ganZhis: LunarUtil.JIA_ZI.filter(([stem, branch]) =>
      officerStems.includes(stem) && ['临官', '帝旺'].includes(baziStemPhase(stem, branch))),
  };
});

const reviewed = new Map([
  ['muxuan-v1-f001-p00049-001', {
    hash: '6fca47689aa6dec510248a01c32a25cabbef784ed3b4fdec2cbad9bcd37cb035',
    text: '怕衰、绝运',
    forms: youthDeclineOrExtinction,
    reviewNote: '同一资料包按日主五行查运支。木火土金水分别以甲丙戊庚壬的长生序列为代表，只取衰、绝两阶段。以1至29虚岁落实约30岁前，跨界运段只引用重叠虚岁。刑冲空亡的另一分句待核。',
  }],
  ['muxuan-v1-f004-p00034-001', {
    hash: '764f4b3a2a10b3f3b9bd9b4a7896fb2211a9252891725486eb3428da6da5182b',
    text: '运逢火土助',
    forms: withLuck(pattern('甲乙', winterBranches, [weak]), { ganZhis: fireAndEarthPillars }),
    reviewNote: '核冬月甲乙日，日主偏弱。一运柱明干及运支本气分见火、土，任一元素单见及运支余气另待校。',
  }],
  ['muxuan-v1-f004-p00041-001', {
    hash: 'bc8aea4bf91e35fbc6723fdb9cb2adffc5194787d5836f9d19c2a3b84e7db4e9',
    text: '财杀',
    forms: ['丙壬亥', '丁癸子'].flatMap(([day, killing, killingBranch]) => withLuck(
      pattern(day, winterBranches, [weak]),
      { ganZhis: LunarUtil.JIA_ZI.filter(([stem, branch]) =>
        (stem === killing && '申酉'.includes(branch)) || ('庚辛'.includes(stem) && branch === killingBranch)) },
    )),
    reviewNote: '冬月丙丁日偏弱，查同一运柱一边为财、一边为七杀，运支用本气区分正官与七杀。只引财杀同时出现的条件，旺衰程度待核。',
  }],
  ['muxuan-v1-f004-p00055-001', {
    hash: 'a00ceec7a93634b2f92ca11afa3c3fc02b958c8dc9fd326428309dd9ecb4f6bf',
    text: '虽然喜逢土，无火',
    forms: withLuck(pattern('庚辛', winterBranches, [missing('丙'), missing('丁')]), { ganZhis: earthPillarsWithoutFire }),
    reviewNote: '庚辛日冬月，先核原局明暗皆无丙丁，再取实有戊己土或本气为土而运柱明暗均无丙丁的大运。',
  }],
  ['muxuan-v1-f009-p00048-001', {
    hash: 'a46466f318c7183c23ddfba5a0cf2d2832023bce71f3a1bb42aafe5af53a3159',
    text: '运入官杀旺地',
    forms: strongOfficerLuck,
    reviewNote: '女命偏弱，原局官杀加权档为过盛。核实际大运干为正官或七杀，且该运干在同一运支临官或帝旺。',
  }],
  ['muxuan-v1-f008-p00098-001', {
    hash: '0ad80fefc0eeea0293e42028b3b94c1f7df8cbc4a91810c5d79f01a3fc31aa1a',
    text: '印绶见财行财运',
    forms: [...dayStems].map((day, index) => ({
      required: [dayStem(day), vigor('印星')],
      anyOf: ['正印', '偏印'].flatMap(seal => natalOuterSeats.flatMap(position =>
        ['正财', '偏财'].map(wealth => [monthGod(seal), { kind: 'stem_ten_god', position, tenGod: wealth }]))),
      stems: [...['戊己', '庚辛', '壬癸', '甲乙', '丙丁'][Math.floor(index / 2)]],
    })),
    reviewNote: '取月支本气为印、印旺且原局明透财的大运分句。实际运干须为日主正财或偏财。死绝所指的阶段归属及其余并列条件待核。',
  }],
  ['muxuan-v1-f018-p00081-001', {
    hash: '8757fb6c0607b9b69d68e596a9e293e7b96ad5fcdf56205d352dba430aec5557',
    text: '行运再入刃地',
    forms: Object.entries(natalBladeBranches).map(([day, branch]) => ({
      ...pattern(day, '', [strongDay, natalGodCount('正官', 0)], godColumns('劫财', 2),
        ['year', 'day', 'hour'].map(position => [{ kind: 'shen_sha', position, name: '阳刃' }]))[0],
      branches: [branch],
    })),
    reviewNote: '取五阳日，原局年日时见实际阳刃，身偏强、劫财至少两柱且无正官。大运支按同一日干阳刃重临。',
  }],
  ['muxuan-v1-f020-p00096-001', {
    hash: 'e69ba127aed44088524e6a55929e10d3322e4f0db27dd09858d675d45a99714c',
    text: '运入官杀旺地',
    forms: strongOfficerLuck.map(({ required, ...form }) => ({
      ...form, required: [...required, { kind: 'bazi_natal_configuration', name: '食伤均未透且非月令本气' }],
    })),
    reviewNote: '与六亲篇同类旺运条件。按现有结构的明干与月令本气取锚，另核食伤均未明透且非月支本气。',
  }],
  ['dtsjy-v1-c037-p007-001', {
    hash: '4c90237cdc33f5365b21961ba31632be5115c0126b5c279d4a1a80e87bd4e1ef',
    text: '奔南',
    forms: withLuck(pattern('甲乙', '', [vigor('食伤')], [...shown('丙'), ...shown('丁')]), { branches: [...'巳午未'] }),
    reviewNote: '只取大运南方分支，原局甲乙日食伤旺且丙或丁实透，实际运支须在巳午未。报告列出干支及虚岁范围，原文中偏的取象仍待核。',
  }],
  ['qtbj-v2-c007-p018-601', {
    hash: '210670420f65eff4207f4a6a183440e95b108b99458596e488ff9b59727240fa',
    text: '甲乙比肩，又逢比劫运',
    forms: withLuck([...'甲乙'].flatMap(day => pattern(day, '申酉戌', [], shown(day))), { stems: ['甲', '乙'] }),
    reviewNote: '按三秋论木上下文，核甲乙日原局另透同干比肩，当前取大运天干实透甲或乙，报告注明运干支及虚岁。仅运支是比劫的分支待核。',
  }],
  ['yhzp-v3-c099-p002-701', {
    hash: '14ecb42c18b0208b64fc60d01d71ca45b3c6c127c7026627c66e42198d009a86',
    text: '逢制殺運',
    ...favorableLuck('辛', '癸', [
      monthGod('七杀'), vigor('七杀'), strongDay, natalGodCount('正官', 0), natalGodCount('食伤', 0),
    ]),
    mustBeAbsent: natalOuterSeats.map(position => ({ kind: 'stem_ten_god', position, tenGod: '偏印' })),
    reviewNote: '先取可复排的辛日午月。月令本气七杀、杀旺而日主偏强，原局无正官、食伤且偏印不透。大运实际透食神，且食神在同一运支临长生、临官或帝旺。',
  }],
  ['yhzp-v3-c099-p002-702', {
    hash: '58755e9564583a3615bdb2e2635f92cb3ea8282b5bebd2ea859cf7c3de758fbf',
    text: '逢傷官運，又無印綬治之，傷官得地',
    forms: [['甲', '丁'], ['丙', '己'], ['壬', '乙'], ['癸', '甲']].map(([day, output]) =>
      favorableLuck(day, output, [monthGod('正官'), natalGodCount('印星', 0)])),
    reviewNote: '复排甲丙壬癸日，核月支本气正官，原局无正偏印。只取实际运干为伤官且本干在同一运支临长生、临官或帝旺的分句。',
  }],
  ['yhzp-v3-c099-p002-703', {
    hash: 'bd12a4b29c39f465cd2a96808fb99ef9834b6a6da36c4a088c7c89df75e513c8',
    text: '財神脱局，羊刃相逢',
    forms: [['戊', '癸', '子', '午'], ['庚', '乙', '卯', '酉']]
      .map(([day, wealth, root, blade]) => ({
        required: [dayStem(day), vigor('正财'), natalGodCount('官杀', 0), natalGodCount('偏财', 0),
          count(wealth, 'hidden', 1)],
        anyOf: ['year', 'month', 'day', 'hour'].flatMap(position => natalOuterSeats.map(seat => [
          { kind: 'branch', position, branch: root },
          { kind: 'hidden_ten_god', position, stem: wealth, tenGod: '正财' },
          { kind: 'stem', position: seat, stem: wealth },
        ])),
        branches: [blade],
      })),
    reviewNote: '只取原局无官杀和偏财、正财实透而旺且仅有一个同干藏根，真实大运支为羊刃并六冲该独根的可核分支。',
  }],
  ['yhzp-v2-c230-p005-701', {
    hash: '038677d15575281e495b10194549a15920bce6a29450b0f738f8a5159478894d',
    text: '歲運臨財鄉，以傷其印',
    forms: [...dayStems].map((day, index) => {
      const group = Math.floor(index / 2);
      return {
        required: [dayStem(day), vigor('印星')],
        anyOf: [[monthGod('正印')], [monthGod('偏印')]],
        mustBeAbsent: natalOuterSeats.flatMap(position => ['正官', '七杀'].map(tenGod =>
          ({ kind: 'stem_ten_god', position, tenGod }))),
        stems: [...['戊己', '庚辛', '壬癸', '甲乙', '丙丁'][group]],
        branches: [...wealthBranchesByDayElement[group]],
      };
    }),
    reviewNote: '本命取印星旺且月支本气为印，排官杀明透。岁运句先核实际大运，运干、运支均在财乡。流年及另临死绝仍待核。',
  }],
  ['yhzp-v4-c002-p010-701', {
    hash: '1ad86d84efa6d1a33229c90d72f9b7387e29dcddc575dc42c901a6e97978878d',
    text: '運合財鄉',
    forms: [...'甲丙戊庚壬'].map((day, index) => ({
      required: [dayStem(day), { kind: 'natal_gender', gender: '男' }],
      stems: ['己辛癸乙丁'[index]], branches: [...wealthBranchesByDayElement[index]],
    })),
    reviewNote: '取男命日干与大运实际正财干五合且同一运支为对应财乡的分句。报告列出已核大运干支与虚岁起止。',
  }],
  ['smth-v8-liuri-01-01-p003-701', {
    hash: '982c213f1cf52cbfca9b3d23260f641473cb7a12958da8211c721887228f4d6d',
    text: '若年月俱寅逢申酉運大富',
    branches: ['申', '酉'],
    reviewNote: '原文後退財未列对应运限，现只取申酉两运的独立分句。',
  }],
  ['muxuan-v1-f011-p00115-001', {
    hash: 'd1ba377a81f151d197b66be8fe551764a3e102c46d97076814a31c9f02ab0e68',
    text: '运入东方俱发达',
    required: [dayStem('丁'), monthBranch('丑')],
    branches: ['寅', '卯'],
    reviewNote: '按《金不换骨髓歌断》取丁日丑月东运分句。同首怕土多仍待核定数量口径。',
  }],
  ['muxuan-v1-f011-p00219-001', {
    hash: '654a274c92d948c6a86f19cc0898d4c7009f7da803d49786ce2c1bdc2e233c37',
    text: '顺行南地多清贵',
    required: [dayStem('癸'), monthBranch('卯')],
    mustBeAbsent: [{ kind: 'bazi_natal_element', element: '土' }],
    branches: ['巳', '午'],
    forward: true,
    reviewNote: '按《金不换骨髓歌断》核对本命无官杀、顺行及巳午运支。同首西方分句保留原文。',
  }],
  ['muxuan-v1-f011-p00120-001', {
    hash: '063aefa965e49a447b9f837eebcd1790c5c9995398189e503b343660a5dd1645',
    text: '逢杀大贵',
    required: [dayStem('丁'), monthBranch('午'), strongDay],
    stems: ['癸'],
    reviewNote: '据原书「若得运中逢七杀」，取丁火建禄、日主偏强且实逢癸干大运。藏干范围继续待核。',
  }],
  ['smth-v5-officer-p004-601', {
    hash: '1477c5c7ddcc4ca24531825c95a105240ad01493019b4e7e95def9503f8a1c6a',
    text: '官逄運合',
    forms: officerExamples.map(example => ({
      required: officerFacts(example),
      stems: [example.partner],
    })),
    reviewNote: '按同篇所列甲日辛酉、乙日庚申，核已成配合的月令正官和实际丙、乙运干。合化、运支合和古书去职断语继续待核。',
  }],
  ['smth-v11-six-spirit-p035-601', {
    hash: '8fb971cd8e7130af6b1926394c519434711cab0d925223104bbfac8a01e18759',
    text: '運行歸祿之鄉乃比肩旺地',
    forms: officerExamples.map(example => ({
      required: officerFacts(example),
      anyOf: woodWealth,
      branches: [example.lu],
    })),
    reviewNote: '取甲日辛酉、乙日庚申正官有配合且见已透的戊己财干。归禄验甲寅、乙卯的运支；古书失俸的条件仍待核。',
  }],
  ['muxuan-v1-f011-p00049-001', {
    hash: '4dd3e4d1757ba07a68ab13b3b9b8503eb8f8c630e6d2533b6be4769998ee2607',
    text: '运行财乡名利驰',
    forms: weakWealthAndOfficer,
    reviewNote: '《金不换看命绳尺》核日主偏强，财、官对应五行均为少量且实见正官。按日干所克的五行核实际运支。',
  }],
  ['muxuan-v1-f011-p00065-001', {
    hash: '79fdca774cbb762cf705c514eb2fc8eff5cb431c5a815caa22c3b406ab44fd31',
    text: '顺行火地难显',
    forms: withLuck(pattern('甲', '寅', [vigor('七杀')], godColumns('财星', 2), multiple('庚')),
      { branches: [...'巳午'], forward: true }),
    reviewNote: '核甲日寅月，土财至少见两柱、庚杀至少见两柱且加权为旺。大运须顺行并实见巳午运支。',
  }],
  ['muxuan-v1-f011-p00083-001', {
    hash: '3047cba65adf049a7a112c8d2cc2172d03e4b65762badd49874d14d6be2bb19f',
    text: '火金大运皆为美',
    forms: withLuck(pattern('乙', '卯', [structure('财官相生')]), { branches: [...'巳午申酉'] }),
    reviewNote: '以乙日卯月且财官相生得到实际盘面支持，核巳午申酉运支。',
  }],
  ['muxuan-v1-f011-p00089-001', {
    hash: '9b902d019c8b3344890b6a89bd16daed8d7bf18c2e1ed4d76f7c7efd4d0717a4',
    text: '大运功名佐庙廊',
    forms: withLuck(pattern('乙', '酉', [vigor('七杀')], multiple('辛'), quantity('乙', 'hidden', 1)),
      { branches: [...'巳午'] }),
    reviewNote: '据原歌后半核乙木有根及南方火运。辛杀须见于至少两柱且加权为旺，再核实际巳午运限。',
  }],
  ['muxuan-v1-f011-p00091-001', {
    hash: '4ab35e11198c0b5fc24f84ed5e6ce0a2d7fad45afcac8747736031680fbf4ad3',
    text: '逆走西南富贵真',
    forms: withLuck(pattern('乙', '亥', [vigor('印星')], [[missing('庚')], [missing('辛')]]),
      { branches: [...'申酉巳午'], forward: false }),
    reviewNote: '核乙日亥月印旺与逆行，排除官杀同时见的后续盘式。西、南分别取申酉、巳午运支。',
  }],
  ['muxuan-v1-f011-p00097-001', {
    hash: '857866e07b1ba34b09e6ee312ff9a3268b642ebc39425102c7ab817bcf2401ca',
    text: '运入东南多发达',
    forms: withLuck(pattern('丙', '子', [], [...quantity('甲', 'hidden', 1), ...quantity('乙', 'hidden', 1)]),
      { branches: [...'寅卯巳午'] }),
    reviewNote: '核丙日子月印星甲或乙实际有根，东、南分别查寅卯及巳午运支。',
  }],
  ['muxuan-v1-f011-p00133-001', {
    hash: 'cb7bb0484a9f5ada299009c5bc032338a0b559a5e005f6673163c8ddf3803566',
    text: '运入火乡尤发达',
    forms: withLuck(pattern('戊', '寅', [weak, structure('杀印相生')]), { branches: [...'巳午'] }),
    reviewNote: '核戊日寅月偏弱、杀印相生得到盘面支持，且实际运支为巳或午。',
  }],
  ['muxuan-v1-f011-p00152-001', {
    hash: 'cf8484be018fd3e59392da5b31f623f05cc76dbe55a455eb1d2ec66bff454ee3',
    text: '喜顺行',
    forms: withLuck(pattern('己', '辰', [structure('财官相生')], shown('癸'), quantity('甲', 'hidden', 1)),
      { forward: true }),
    reviewNote: '原歌顺行句在资料库摘作喜顺行。己日辰月核库中癸财透干、甲官有根和已成财官相生，大运须经实际顺行序列确认。',
  }],
  ['muxuan-v1-f011-p00154-001', {
    hash: '90e6707f2f3132fe8ecabf41a97f631034b85e3198763a60bd41eb101749c29b',
    text: '官轻逆运亦荣昌',
    forms: withLuck(pattern('己', '午', [strongDay, balance('木', '少量')], seen('甲')), { forward: false }),
    reviewNote: '核己日午月建禄、身强、实见甲官且木仅少量。只取排盘所确认的逆行运限。',
  }],
  ['muxuan-v1-f011-p00226-001', {
    hash: 'eafdb249a1c809db12eb4bc844fa1507c23cadf17d78d7225c7172bb16c96418',
    text: '运行木火多财禄',
    forms: withLuck(pattern('癸', '戌', [structure('财官相生')], shown('丁'), shown('戊')),
      { branches: [...'寅卯巳午'] }),
    reviewNote: '核癸日戌月，所藏丁财、戊官均透且财官相生得到盘面支持，运支查寅卯巳午。',
  }],
  ['muxuan-v1-f007-p00094-001', {
    hash: 'ace1d787c7a375b5364c6a77800919901dc7a68a58d146ab4e850ce547630e13',
    text: '正财忌冲',
    forms: ['戊午子', '壬子午', '庚酉卯'].map(([day, hour, luck]) => ({
      required: [dayStem(day), strongDay, { kind: 'branch', position: 'hour', branch: hour }],
      branches: [luck],
    })),
    reviewNote: '按阳刃原文以时支取刃且身旺，仅取戊日午、壬日子、庚日酉三式，分别验真实运支子、午、卯。财制、官制和古书吉凶留出处。',
  }],
  ['muxuan-v1-f008-p00058-001', {
    hash: '4396023696113e3a06f58d9598e16061420c1196156db61a8b1dddb1cde8f2b6',
    text: '伤官伤尽行官运',
    forms: officerLuck(shenfengOutputWithoutOfficer).filter(({ required: [day] }) => !'乙癸'.includes(day.stem)),
    reviewNote: '按《玄机赋》核月支本气为伤官、原局无透藏正官及实际正官运干。乙日巳月与癸日寅月的月支本身藏正官，暂不纳入此种口径。合并的旧断继续待核。',
  }],
  ['muxuan-v1-f015-p00060-001', {
    hash: '6f0a9f7884ac8a35ccd63ab9f4bfa99801d73aa8586d43e5ec6fa01285a233c6',
    text: '行伤官运',
    required: [shenfengSpringWoodWithFire, strongDay, balance('火', '少量')],
    branches: ['巳', '午'],
    reviewNote: '按《伤官食神格》假伤官取甲乙日寅卯月实透火，日主偏强且火仅少量。南方火运核已确认运支巳午。',
  }],
  ['muxuan-v1-f015-p00061-001', {
    hash: 'c85b11a8750df8d42d8919dcbf37c3176d76e46781f23141b2395c1620fd4076',
    text: '行伤官墓地',
    forms: ['甲丁', '乙丙'].map(([day, output]) => ({
      required: [dayStem(day), shenfengSpringWoodWithFire, strongDay, balance('火', '少量')],
      anyOf: shown(output),
      branches: [...'子丑寅卯辰巳午未申酉戌亥'].filter(branch => baziStemPhase(output, branch) === '墓'),
    })),
    reviewNote: '按原章假伤官火轻、甲乙日偏强、寅卯月，核丁或丙伤官确透。墓按该伤官干阴阳顺逆分别取丁丑支、丙戌支，核实际运段。',
  }],
  ['muxuan-v1-f019-p00104-001', {
    hash: 'bb0c64253c12e343a5379c6f3e12d840da414b5f4c0b05ff46f5a38fd746ed02',
    text: '印绶行官运',
    forms: officerLuck(shenfengLayeredSealWithOfficer),
    reviewNote: '《印绶格》核月支本气、年时俱见印及原局实见正官。官运先取实际运干为日主正官的分句，运支和财旺损印另核。',
  }],
  ['smth-v6-well-p002-701', {
    hash: '6aa6af912b3e7623436785673ec7f1f5c4a1c83b8c5d15070ca8112d6270172e',
    text: '井欄運喜東方地得到財鄉眞富貴',
    forms: withLuck([...'申酉'].flatMap(month => pattern('庚', month, wellConditions, trine('申子辰', month))),
      { branches: [...'寅卯'] }),
    reviewNote: '已复排申、酉两月。原局申子辰齐，连日干三庚透，壬癸戊己不透、原局无丙丁。只取实见寅卯运，其他岁运及冬月变格待核。',
  }],
]);

export function compileBaZiDecadalPassage(claim) {
  const spec = reviewed.get(claim.id);
  if (!spec) return undefined;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== spec.hash || !evidence.original_text.includes(spec.text)) {
    return { reason: 'source_review_required', reviewNote: '大运分句所据原文、出处或前提已变，须重新核对。' };
  }
  return {
    reason: 'requires_temporal_calculation',
    condition: '按原书所列本命条件和实际大运取材',
    reviewNote: spec.reviewNote,
    branches: (spec.forms ?? [spec]).map(({ required, mustBeAbsent, anyOf, branches, stems, ganZhis, ageRange, forward }) => {
      const inputs = required ? [{ required, mustBeAbsent, anyOf }] : conditions.match.natalInputs;
      return {
        text: spec.text,
        conditionCompiler: baziDecadalPassageProfile,
        decadalAnchor: { kind: 'bazi_decadal_range', ...(branches && { branches }), ...(stems && { stems }),
          ...(ganZhis && { ganZhis }), ...(ageRange && { ageRange }),
          ...(forward !== undefined && { forward }) },
        inputs: inputs.map(input => normalizeRuleInput('bazi', input)),
      };
    }),
  };
}
