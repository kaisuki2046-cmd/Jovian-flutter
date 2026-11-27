import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';
import { pattern, quantity, shown } from './qtbj-counted-passages.mjs';

// These source records bundle distinct conditions and conclusions. Bind each
// literal condition to its own verbatim quotation, never the whole conclusion.
export const baziLiteralPassageProfile = 'bazi-explicit-literal-passages-v1';
export const baziVisibleHiddenGodsProfile = 'bazi-visible-hidden-gods-v1';
export const qtbjWoodPassageProfile = 'qtbj-v2-wood-passages-v1';
export const qtbjTermProfile = 'qtbj-v2-wood-principal-term-v1';
export const baziEqualColumnsPassageProfile = 'bazi-year-month-day-hour-equality-v1';
const sourceDigests = new Map([
  ['qtbj-v2-c013-p006-001', '108e7159aeb9aa85475652feb4306cc8397dc0b949bf0adfdf01a578931e7d9f'],
  ['qtbj-v2-c013-p008-001', 'bf527b8ead2e8af8f61ef902bcae7bbead2b4acf0382d80a51fc2be480ebebbb'],
  ['qtbj-v2-c013-p009-301', '099fb304ae11ad424c453783d96d5b25cccd443e101dbd4f21e8a775dbc4b860'],
  ['qtbj-v2-c014-p008-001', '523b5cd2d32f40ce006c52573d3de4d77fc516e870e95a4c08141b4b5376cd1f'],
  ['qtbj-v2-c008-p005-001', '58c141127aafa283cbccc89cae025c2bac30d5a561e4cbe0aca5c85a046c6bd0'],
  ['qtbj-v2-c008-p009-001', 'e52117808cb93be1e55262fd39507bc070231ea3bc2dbe3fb9c22580683ac89e'],
  ['qtbj-v2-c011-p001-001', '03ef63672803ca3f90195a801731b39074f68046911b3b072995a563daa0e689'],
  ['qtbj-v2-c014-p001-001', '5ee894410db2a924a37ec8b5f8a29b4ce3fb0d535d5e0fa140f808b1a426c15c'],
  ['qtbj-v2-c014-p009-001', 'a995794342d68e808fec933b4d99d6187ac009dfa9250054e704e1de8de6c70b'],
  ['qtbj-v5-c081-p002-101', '9db00ffb5b897d2a4f56b7faa2df9557b71998c9b2f315a1fc28900ec19d79d6'],
  ['qtbj-v2-c006-p001-002', '33aa23c5765a4cfca674324ef4e06b2ec517a5caaf299653a4d18b70cba7c300'],
  ['yhzp-v1-c313-p005-001', 'fd45164a5fe2e397e9d7988a2a3324dd4990a0331f74ad6b39203f399e166fa8'],
  ['yhzp-v3-c105-p002-101', 'c7e487472950b9959355789c82615b7117cd1aea450de39b2684a43c7f9e6142'],
  ['zpzq-v1-c021-p007-001', '2de4f8d338daa3105d41d0c560af83901c2e90320c17af372769bcb7e721d338'],
  ["qtbj-v4-c061-p002-101","34ad76c8fd9228a101cffcfe60d04b77823e7b1e9b22887e299599673c630d0e"],
  ["qtbj-v3-c017-p002-101","608af5de0b0856fd27efbeba6bd7d4ead6d20f7abaf618c2b3e783021bc43830"],
  ["qtbj-v4-c060-p002-101","c744c41a043c11b0935e99f9aa828a65b5e1bd983d7dcd6352ed8ae162e2ac33"],
  ["qtbj-v6-c099-p002-101","cb1fc2ab924b6507aa55168d7712f6caf9147d35ba944da2f0d7cefa3323c025"],
  ["qtbj-v6-c115-p001-101","ec71c098244050b18a77ab79e15ab28e8632c777a975b43043225a04278c890d"],
  ["qtbj-v3-c031-p001-101","8ffeccae5a308b4fa785ae7e6e9fa5fe948c26929787d2540e8aa554fc283779"],
  ["yhzp-v2-c252-p006-001","b14c84161eaadfd291b7ae9717a3dcfa4f1da20210aa63f69dfcbc06124c66f8"],
  ['yhzp-v4-c081-p008-001', 'ca30b8cffe72e4ed14281a798d39b8e5385b207c9b7298218e1d73e3af96b16c'],
  ['yhzp-v5-c109-p007-001', '2b83dd31ce8c8d36e8b0fe5333bd0923bddb5d72daaebe974fff9bab8d7ef34b'],
  ['yhzp-v5-c196-p002-001', '59707af246fbd37ad6f69a45db7f44569927d9cfc5954ba2862cd32abea99381'],
  ['yhzp-v1-c211-p002-001', '267b529cf7923e45c247971e10c97cd8100bf30d41370935ca74fff30b1d54c9'],
  ['yhzp-v1-c217-p002-001', '73a4e3078c251e0bb681d96679de428189ffd910cd56a3a3d3a7f45cbcae30f6'],
  ['yhzp-v1-c298-p002-001', '26440cc38dde963ec8911c5f8a5de70a10aa5b1376622dfcda46ea9c33caec6f'],
  ['yhzp-v2-c225-p003-001', '38c1fa1826b0ea534ba1621d682b818a639447b5fe59deb42cfceb782d5e2ed6'],
  ['yhzp-v5-c104-p005-001', '6025fb9d46b7721d6a6de622cb88d7276d2a6b7857d9802107501dd36ab1513f'],
  ['yhzp-v5-c165-p007-001', 'b0877f74c2e8bd962be3149d14a77ae0c957241526ab149f1a11e60606effdbb'],
]);
const sourceDigest = claim => createHash('sha256').update(JSON.stringify({ source: claim.source,
  conditions: claim.conditions, evidence: claim.evidence })).digest('hex');

export function compileShenfengNatalPassage(claim) {
  if (claim.id !== 'muxuan-v1-f011-p00103-001') return undefined;
  const text = '有杀当为贵命看';
  if (sourceDigest(claim) !== '3f648273d80df3f799817286c68280a3fda61136231f1996fa4890d4e670e594'
    || !claim.evidence.original_text.includes(text)) {
    return { reason: 'source_review_required', reviewNote: '丙日午月伤官见杀的原文、出处或本命条件已变，须重新核对。' };
  }
  const inputs = pattern('丙', '午', [], shown('己'), shown('壬'), quantity('壬', 'hidden', 1))
    .map(input => normalizeRuleInput('bazi', input));
  return {
    reason: 'requires_temporal_calculation',
    reviewNote: '取原歌前半的本命分句，核午中己土伤官透出、壬七杀透而有根。同首后半的金水异文及大运条件继续待核。',
    branches: [{ text, conditionCompiler: baziLiteralPassageProfile, inputs }],
  };
}

export function compileBaZiEqualColumnsPassage(claim) {
  if (claim.id !== 'smth-v8-liuri-01-03-p004-701') return undefined;
  const text = '若年月與日時同大貴';
  if (sourceDigest(claim) !== '96669baf68e7944572c45da3feb171ac24636a88a3bd8362fc46c53578f96987' || !claim.evidence.original_text.includes(text)) {
    return { reason: 'source_review_required', reviewNote: '年月与日时同柱的原文或位置已变，须重新核对。' };
  }
  const required = [
    { kind: 'pillar', position: 'year', ganZhi: '甲子' }, { kind: 'pillar', position: 'month', ganZhi: '丙寅' },
    { kind: 'pillar', position: 'day', ganZhi: '甲子' }, { kind: 'pillar', position: 'hour', ganZhi: '丙寅' },
  ];
  return {
    reason: 'unmapped_condition',
    reviewNote: '已核年柱与日柱相同、月柱与时柱相同的一句；另列的迁徙异说继续待核。',
    branches: [{ text, conditionCompiler: baziEqualColumnsPassageProfile, inputs: [normalizeRuleInput('bazi', { required })] }],
  };
}

const termConditions = new Map([
  ['qtbj-v2-c013-p006-001', ['酉月乙日', '酉月秋分后', '丙癸同透']],
  ['qtbj-v2-c013-p009-301', ['酉月乙日', '酉月秋分后', '年癸透或月癸透', '时丙透']],
  ['qtbj-v2-c014-p008-001', ['乙日', '冬月冬至后', '地支同见亥卯未', '丙透']],
]);

export function baziLiteralSourceConditions(claim) {
  const seasonal = termConditions.get(claim.id);
  if (seasonal) return sourceDigest(claim) === sourceDigests.get(claim.id)
    ? { normalized: seasonal, compiler: qtbjTermProfile } : null;
  if (claim.id === 'yhzp-v5-c196-p002-001') {
    return sourceDigest(claim) === sourceDigests.get(claim.id)
      ? { normalized: ['戊日', '秋月或冬月', '庚申时', '原局无甲乙丙丁'], compiler: 'bazi-reviewed-literal-source-v1' } : null;
  }
  if (!['qtbj-v3-c017-p002-101', 'zpzq-v1-c021-p007-001', 'qtbj-v5-c081-p002-101', 'qtbj-v2-c006-p001-002'].includes(claim.id)) return undefined;
  if (sourceDigest(claim) !== sourceDigests.get(claim.id)) return null;
  // Only these exact original quotations clarify editorial labels. This does
  // not make bare 争合 or 无丁制 a general, independently computed predicate.
  if (claim.id === 'qtbj-v5-c081-p002-101') return { normalized: ['辰月辛日', '月时丙均透'], compiler: 'bazi-reviewed-literal-source-v1' };
  if (claim.id === 'qtbj-v2-c006-p001-002') return { normalized: ['秋月甲日', '庚透', '原局无丁'], compiler: 'bazi-reviewed-literal-source-v1' };
  if (claim.id === 'zpzq-v1-c021-p007-001') return { normalized: ['辛日申月', '壬年', '戊月', '丙时'], compiler: 'bazi-fixed-pillar-example-v1' };
  // The normalized clause omitted the upper bound in the original 一二丙火.
  // Keep the raw source intact, adding its bound to this source's actual tests.
  return { normalized: [...claim.conditions.normalized, '至多二支藏丙'], compiler: 'bazi-literal-source-count-v1' };
}
const passages = new Map([
  ['qtbj-v2-c013-p008-001', {
    book: '穷通宝鉴', section: '三秋乙木', normalized: ['秋分后乙木，区分有丙缺癸与有癸缺丙'],
    profile: qtbjTermProfile,
    branches: [
      ['酉月乙日，酉月秋分后，四柱干支见丙，四柱无癸', '生秋分後，有丙无癸，亦略富贵。'],
      ['酉月乙日，酉月秋分后，四柱干支见癸，四柱无丙', '若有癸无丙，名利虚花。'],
    ],
  }],
  ['qtbj-v2-c008-p005-001', {
    book: '穷通宝鉴', section: '三冬甲木', normalized: ['甲日子月，庚丁齐透而原文所列巳寅在地支'],
    profile: qtbjWoodPassageProfile,
    exclusions: ['癸透伤丁'],
    branches: [
      ['子月甲日，庚丁同透，地支同见巳寅，癸不透', '庚丁两透，支见巳寅，科甲有准'],
    ],
  }],
  ['qtbj-v2-c008-p009-001', {
    book: '穷通宝鉴', section: '三冬甲木', normalized: ['甲日在丑月，区别庚丁齐透与仅一透另一伏藏'],
    profile: qtbjWoodPassageProfile,
    branches: [
      ['丑月甲日，庚丁同透', '庚丁两透，科甲恩封。'],
      ['丑月甲日，庚透，丁藏支，丁不透', '庚透丁藏，小贵。'],
      ['丑月甲日，丁透，庚藏支，庚不透', '丁透庚藏，小富贵。'],
    ],
  }],
  ['qtbj-v2-c011-p001-001', {
    book: '穷通宝鉴', section: '三夏乙木总论', normalized: ['乙木夏生，丙透且在支有气，再透一癸'],
    profile: qtbjWoodPassageProfile,
    branches: [
      ['夏月乙日，丙透，丙藏支', '先得丙透，支下又有丙火，名曰木秀火明'],
      ['夏月乙日，丙透，丙藏支，仅一癸透', '得一癸透，科甲中人。'],
    ],
  }],
  ['qtbj-v2-c014-p001-001', {
    book: '穷通宝鉴', section: '三冬乙木', normalized: ['亥月乙木辨丙戊同透，或只有丙无戊'],
    profile: qtbjWoodPassageProfile,
    branches: [
      ['亥月乙日，丙戊同透', '丙戊两透，科甲定然。'],
    ],
  }],
  ['qtbj-v2-c014-p009-001', {
    book: '穷通宝鉴', section: '三冬乙木', normalized: ['子月乙木透丙，癸未透干破丙'],
    profile: qtbjWoodPassageProfile,
    branches: [
      ['子月乙日，仅一丙透，癸不透', '得一丙透，无癸出破格，不特科甲，定主名臣显宦。'],
    ],
  }],
  ['yhzp-v1-c313-p005-001', {
    book: '渊海子平', section: null, normalized: ['分别看原局官透而杀藏、杀透而官藏'], profile: baziVisibleHiddenGodsProfile,
    branches: [
      ['天干透正官且原局地支藏七杀', '露官藏殺方\n爲福'],
      ['天干透七杀且原局地支藏正官', '露殺藏官是禍胎'],
    ],
  }],
  ['yhzp-v3-c105-p002-101', {
    book: '渊海子平', section: null, normalized: ['本诀分别取官露、财藏及杀藏官露'], profile: baziVisibleHiddenGodsProfile,
    branches: [
      ['天干透正官', '官喜露，露則清高'],
      ['原局地支藏财星', '財要藏，藏則豊厚'],
      ['原局地支藏七杀且天干透正官', '殺藏官露，惡隱善揚。人生遇此，名振鄉邦'],
    ],
  }],
  ['qtbj-v4-c060-p002-101', {
    book: '穷通宝鉴', section: '三秋己土', normalized: ['秋月己土分丙癸同透和无癸两丙透'],
    branches: [
      ['秋月己土丙癸同透', '丙癸两透，雁塔题名'],
      ['秋月己土无癸且至少两丙透', '或无癸，有两丙透者，异途显达，或武职权高'],
    ],
  }],
  ['qtbj-v4-c061-p002-101', {
    book: '穷通宝鉴', section: '三冬己土', normalized: ['冬月己土，一丙透一丙藏而有甲出干'],
    branches: [
      ['冬月己土，一丙透一丙藏而有甲出干', '或干透一丙，支藏一丙，如以甲透，科甲有准'],
    ],
  }],
  ['qtbj-v6-c099-p002-101', {
    book: '穷通宝鉴', section: '四月壬水', normalized: ['巳月壬日辨壬辛两透，或癸辛同透另有甲透'],
    branches: [
      ['巳月壬日壬辛同透', '壬辛两透，金榜有名'],
      ['巳月壬日癸辛同透且甲透', '或癸辛两出，加以甲透，亦主异路之荣'],
    ],
  }],
  ['qtbj-v6-c115-p001-101', {
    book: '穷通宝鉴', section: '八月癸水', normalized: ['酉月癸日，分丙辛二者隔位同透与丙透辛藏'],
    branches: [
      ['酉月癸日丙与辛隔位同透', '如丙与辛隔位同透，主科甲功名'],
      ['酉月癸日丙透且辛藏支', '或丙透辛藏，一榜之士'],
    ],
  }],
  ['qtbj-v3-c031-p001-101', {
    book: '穷通宝鉴', section: '二月丁火', normalized: ['卯月丁火，分庚甲两透、庚透甲藏和甲透庚藏'],
    branches: [
      ['卯月丁火庚甲同透', '庚甲两透，科甲定然'],
      ['卯月丁火庚透且甲藏支', '庚透甲藏，亦有生贡'],
      ['卯月丁火甲透且庚藏支', '甲透庚藏，异路功名'],
    ],
  }],
  ['yhzp-v2-c252-p006-001', {
    book: '渊海子平', section: null, normalized: ['年柱、月柱各见伤官的分位取象'],
    branches: [
      ['年柱见伤官', '年帶傷官，父母不全'],
      ['月柱见伤官', '月帶傷官，兄弟不完'],
    ],
  }],
  ['yhzp-v4-c081-p008-001', {
    book: '渊海子平', section: null, normalized: ['原局月令建禄，另看是否有财官'],
    branches: [
      ['甲日且寅月或乙日且卯月或丙日且巳月或丁日且午月或戊日且巳月或己日且午月或庚日且申月或辛日且酉月或壬日且亥月或癸日且子月',
        '月令見禄，不住祖基'],
    ],
  }],
  ['yhzp-v5-c109-p007-001', {
    book: '渊海子平', section: null, normalized: ['本歌按癸酉、己巳、乙丑三时取金神'],
    branches: [
      ['按本篇取癸酉、己巳、乙丑时的金神', '癸酉己巳并乙丑，時上逢之是福神'],
    ],
  }],
  ['yhzp-v1-c211-p002-001', {
    book: '渊海子平', section: null, reviewedUncertainty: true,
    normalized: ['依截路空亡歌中所列甲己、乙庚、丙辛、丁壬、戊癸配各支取法'],
    branches: [
      [[['甲己', '申酉'], ['乙庚', '午未'], ['丙辛', '辰巳'], ['丁壬', '寅卯'], ['戊癸', '子丑']]
        .flatMap(([stems, hours]) => [...stems].flatMap(stem => [...hours].map(hour => stem + '日且' + hour + '时')))
        .join('或'), '人生值此也多憂'],
    ],
  }],
  ['yhzp-v1-c217-p002-001', {
    book: '渊海子平', section: null, normalized: ['生日为本篇所列十恶大败日之一'],
    branches: [
      ['甲辰日或乙巳日或壬申日或丙申日或丁亥日或庚辰日或戊戌日或癸亥日或辛巳日', '人命若還逢此日倉庫金銀化作塵'],
    ],
  }],
  ['yhzp-v1-c298-p002-001', {
    book: '渊海子平', section: null, normalized: ['分别看丙日亥时有亥中木印生火，和戊日巳时虽禄旺却伤官'],
    branches: [['戊日巳时', '凡戊日巳時官終不顯']],
  }],
  ['yhzp-v2-c225-p003-001', {
    book: '渊海子平', section: null, reviewedUncertainty: true,
    normalized: ['本篇列甲申、乙酉、丁丑三日作坐杀'],
    branches: [['甲申日或乙酉日或丁丑日', '甲申、乙酉、丁丑坐殺，性急令俐，心巧聰明']],
  }],
  ['yhzp-v5-c104-p005-001', {
    book: '渊海子平', section: null, normalized: ['按本歌日贵所列卯巳亥酉一类，原局无刑冲空亡'],
    branches: [
      ['按昼夜取日贵，日柱坐天乙贵人，年支无刑冲，月支无刑冲，日支无刑冲，时支无刑冲，四柱无空亡',
        '刑冲不遇空亡位，輔佐功勳在帝家'],
    ],
  }],
  ['yhzp-v5-c165-p007-001', {
    book: '渊海子平', section: null, normalized: ['庚或壬日，原局年月日时重见子而无冲破'],
    branches: [
      ['庚日或壬日，四支子至少两见，年支无冲破，月支无冲破，日支无冲破，时支无冲破', '無破無沖富贵奇'],
    ],
  }],
]);

export function baziLiteralPassageDisposition(claim) {
  if (!passages.has(claim.id)) return undefined;
  return sourceDigest(claim) === sourceDigests.get(claim.id);
}

export function baziLiteralPassages(claim, compile) {
  const spec = passages.get(claim.id);
  if (!spec || claim.source.book !== spec.book || claim.source.section !== spec.section
    || sourceDigest(claim) !== sourceDigests.get(claim.id)
    || JSON.stringify(claim.conditions.normalized) !== JSON.stringify(spec.normalized)
    || (claim.conditions.uncertain.length && !spec.reviewedUncertainty) || claim.conditions.match
    || JSON.stringify(claim.conditions.excluded) !== JSON.stringify(spec.exclusions ?? [])) return [];
  const compiled = spec.branches.map(([condition, text]) => {
    if (!claim.evidence.original_text.includes(text)) return null;
    // The reviewed Zi-month clause expresses the original exclusion by requiring
    // confirmed non-exposure of Gui, without inferring whether exposed Gui harms Ding.
    const row = compile({ ...claim, conditions: { ...claim.conditions, normalized: [condition], excluded: [] } });
    return row?.inputs?.length ? { text, inputs: row.inputs, conditionCompiler: spec.profile ?? baziLiteralPassageProfile } : null;
  });
  return compiled.every(Boolean) ? compiled : [];
}
