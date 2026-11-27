import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';
import { balance, branchAt, count, godColumns, heavy, pattern, quantity, shown, trine, vigor, weak } from './qtbj-counted-passages.mjs';

export const dtsjyReviewedProfile = 'bazi-dtsjy-reviewed-passages-v1';

const positions = ['year', 'month', 'day', 'hour'];
const outerPositions = ['year', 'month', 'hour'];
const strong = { kind: 'day_master_strength', result: '偏强', profile: 'monthly-weighted-strength-v1' };
const female = { kind: 'natal_gender', gender: '女' };
const male = { kind: 'natal_gender', gender: '男' };
const structure = name => ({ kind: 'bazi_ten_god_structure', name });
const configuration = name => ({ kind: 'bazi_natal_configuration', name });
const godCount = (tenGod, count) => ({ kind: 'bazi_ten_god_count', tenGod, count });
const supportedOfficer = { kind: 'bazi_month_pattern', name: '正官格', result: '见配合' };
const visibleGod = tenGod => outerPositions.map(position => [{ kind: 'stem_ten_god', position, tenGod }]);
const yangBlade = positions.map(position => [{ kind: 'shen_sha', position, name: '阳刃' }]);
const noVisible = stems => [...stems].map(stem => count(stem, 'visible', 0));
const clearOfficer = [vigor('官星'), configuration('原局只透一位正官'), godCount('七杀', 0)];
const smallShare = group => ({ kind: 'bazi_ten_god_strength', group, profile: 'weighted-ten-god-share-v1', strength: '少量' });
const wealthOfficerFlow = [...clearOfficer, structure('财官相生')];
const visibleWealth = [...visibleGod('正财'), ...visibleGod('偏财')];
const favorableMonthPhase = ['长生', '临官', '帝旺']
  .map(phase => [{ kind: 'day_stem_phase', position: 'month', phase }]);
const monthlyClashes = [['year', 'month'], ['month', 'day'], ['month', 'hour']]
  .map(([first, second]) => [{ kind: 'bazi_branch_relation', relation: '六冲', first, second }]);
const oneWoodStem = [
  [count('甲', 'visible', 1), count('乙', 'visible', 0)],
  [count('甲', 'visible', 0), count('乙', 'visible', 1)],
];

function forms(required, ...choices) {
  const anyOf = choices.length ? choices.reduce((groups, alternatives) =>
    groups.flatMap(group => alternatives.map(alternative => [...group, ...alternative])), [[]]) : [];
  return { required, anyOf };
}

const reviewed = new Map([
  ['dtsjy-v1-c005-p017-001', ['b1d5d07bb4d671440f9127f7f1bb12125e9f9ef1394a13b65cb60bc2b1cc5354',
    ['辛金生於冬月，見丙', pattern('辛', '亥子丑', [female], shown('丙')), { fromContext: true }],
  ]],
  ['dtsjy-v1-c005-p017-002', ['b4e2920c0e5b334a4bf87434b1d8b4c1dbe78f6bf43269a64d574a948adfee19',
    ['若見丁', pattern('辛', '亥子丑', [count('丙', 'visible', 0)], shown('丁'))],
  ]],
  ['dtsjy-v1-c009-p005-201', ['33ece9755a37fd0da366af3bec516ab7c26f29a6a59d53a77b0a65462450970e',
    ['遇亥之生', oneWoodStem.map(required => forms(required, trine('寅卯辰亥')))],
    ['未之庫', oneWoodStem.map(required => forms(required, trine('寅卯辰未')))],
  ]],
  ['dtsjy-v1-c016-p002-001', ['459166ad95feeb38728edd862a6682bc07e446deadda203be32551b627c56d7e',
    ['身弱而財官旺', [forms([weak, vigor('财星'), vigor('官星')])]],
  ]],
  ['dtsjy-v1-c017-p002-201', ['8604987cfc6d5b41cdb4a82f08bc9d3f63fb7aab1ccd8fedebe38b560cc49d76',
    ...[['丁', '遇丁火'], ['乙', '遇乙木'], ['己', '遇己土'], ['癸', '遇癸水']]
      .map(([stem, text]) => [text, pattern('庚辛', '申', [], shown(stem))]),
  ]],
  ['dtsjy-v1-c024-p001-001', ['bca42cbceeb8a952d5b1fc6c17a7e665faae0e22fc6690c5d6c0631ab0f87c1e',
    ['身旺有財', [forms([...clearOfficer, supportedOfficer, strong, godCount('伤官', 0)],
      godColumns('财星', 1))], { fromContext: true }],
    ['身弱有印', [forms([...clearOfficer, supportedOfficer, weak, vigor('印星'), godCount('伤官', 0)])], { fromContext: true }],
  ]],
  ['dtsjy-v1-c028-p002-002', ['bcc23a0134109849721070159a02fb60866ca32810fcd83498c153004bed3188',
    ['純陰之局，身弱而官煞多', [forms([configuration('四柱纯阴'), weak], godColumns('官杀', 3))]],
  ]],
  ['dtsjy-v1-c030-p001-001', ['218f347b309369d5a4bc0de097a8c495c04b03b3aa025c13b4841ca1182e7b6d',
    ['木遇火成象', pattern('甲乙', '', [vigor('食伤'), structure('食伤生财')], godColumns('食伤', 3))],
  ]],
  ['dtsjy-v1-c031-p003-001', ['bd8968d686201cc840484e6e99c1755948da579b3209373c9c4d23afa6f34a8d',
    ['多合', [forms([configuration('原局两组以上干支合')])]],
  ]],
  ['dtsjy-v1-c037-p019-001', ['b5843d48a73485fe30ad8bfa0cdb8f15e60d0c4d41aef79e1130a8dceecbf40e',
    ['有金氣伏於内', [forms(noVisible('庚辛'), trine('寅午戌'), [...quantity('庚', 'hidden', 1), ...quantity('辛', 'hidden', 1)])]],
  ]],
  ['dtsjy-v1-c037-p021-001', ['8043669adad577f074ca468896e5882e0b6e76c24a7c268bebc022e1139ef282',
    ['有火氣藏於内', [forms(noVisible('丙丁'), trine('酉丑亥'), [...quantity('丙', 'hidden', 1), ...quantity('丁', 'hidden', 1)])]],
  ]],
  ['dtsjy-v1-c041-p002-002', ['1f67eeb427780735ec2c44402fd3390ba5a377f00d5252b40d1b07ee99462254',
    ['比肩透露', visibleGod('比肩').map(required => forms(required))],
    ['身旺無財', [forms([strong, godCount('财星', 0)])]],
  ]],
  ['dtsjy-v1-c041-p008-003', ['7a04a292870f368cb8126702d25613736d24bbc4bafdb1086aed640b525a4c35',
    ['比肩重而傷官、財煞亦旺', [forms([vigor('伤官'), vigor('财星'), vigor('七杀')],
      godColumns('比肩', 2), visibleGod('比肩'))]],
  ]],
  ['dtsjy-v1-c041-p008-004', ['6cb2b8926d009cedafdeaef5b4efa9177199d0655d28374e36a635a8b468345f',
    ['身弱而三者不顯，有印', [{ ...forms([weak, vigor('印星')]),
      mustBeAbsent: [...visibleGod('比肩').flat(), ...visibleGod('劫财').flat(), ...yangBlade.flat()] }]],
    ['身旺而三者又顯，無官', [forms([strong, godCount('官杀', 0)], visibleGod('比肩'), visibleGod('劫财'), yangBlade)]],
  ]],
  ['dtsjy-v1-c041-p010-001', ['330520bdfcfccd1f46245af736011f9db9078503142f8d182b48b4496c8b7c59',
    ['局中官星明順', [forms([...clearOfficer, female])]],
  ]],
  ['dtsjy-v1-c041-p010-002', ['a854250811eb07eb4205544c53723f3400c86fffef3b7c91cd178f3ef9cd0354',
    ['局中食神清顯', [forms([female, vigor('食神'), godCount('食神', 1), godCount('伤官', 0)], visibleGod('食神'))]],
  ]],
  ['dtsjy-v1-c044-p002-001', ['5e7e31eb35a2876fef89b2c2eb2c3f2ccdac41fb0aa8969b216cfaaa495555ce',
    ['官星清而身旺', [forms([...clearOfficer, strong])]],
  ]],
  ['dtsjy-v1-c044-p006-001', ['a96c9e473c600d4bfcdb347c177ab1aacba1995060eb355541cc0200b75f45ad',
    ['財神清而身旺', ['正财', '偏财'].map((tenGod, index) =>
      forms([strong, vigor(tenGod), godCount(index ? '正财' : '偏财', 0)], visibleGod(tenGod)))],
  ]],
  ['dtsjy-v1-c044-p006-002', ['aed3660d93cf7a1cf1e51dde410b851dd3f7cfab645e95a8805920a9a70bff75',
    ['財神濁而財旺', [forms([vigor('财星')], visibleGod('正财'), visibleGod('偏财'))]],
  ]],
  ['dtsjy-v1-c037-p023-002', ['e073556f6d1e8dc1bf75158ac25b77f86902943c2c3020b4a1fa28713c27e7fe',
    ['傷官局清', [forms([{ kind: 'bazi_month_pattern', name: '伤官格', result: '见配合' },
      vigor('伤官'), godCount('官杀', 0)], visibleGod('伤官'))]],
  ]],
  ['dtsjy-v1-c044-p001-001', ['210e1bca3842fca5fb4dc42fa3e8ea96e8ecabf4fd2408026c46c1cc61b24817',
    ['財星旺而官星通達', [forms([vigor('财星'), vigor('官星'), structure('财官相生')], visibleGod('正官'))], { fromContext: true }],
  ]],
  ['dtsjy-v1-c044-p003-001', ['0db8a907ca2b700a04e9b72f2bc662c245034d7578eb0c93a0824fd52ab01fad',
    ['財重無官', [forms([vigor('财星'), godCount('官杀', 0)])], { fromContext: true }],
    ['官重無印', [forms([vigor('官星'), godCount('印星', 0)])], { fromContext: true }],
  ]],
  ['dtsjy-v1-c044-p005-001', ['57cf71a4457b75d6fade2de5881f23cc221bb57b1c9b3731834d9d0327304a70',
    ['財露而傷官亦露', [forms([vigor('财星')], [...visibleGod('正财'), ...visibleGod('偏财')], visibleGod('伤官'))], { fromContext: true }],
  ]],
  ['dtsjy-v1-c019-p003-201', ['be297c028b155316b07366fe0c3b6d8be242fbc27cad04d08a2dd1eb07804b94',
    ['過於濕者', [forms([configuration('湿土月金水过半且水量大于火量两倍')])]],
    ['過於燥者', [forms([configuration('燥土月木火过半且火量大于水量两倍')])]],
  ]],
  ['dtsjy-v1-c025-p002-002', ['613931c8f7202fb4d6478db16918caf12d761b469db266186d9787833738b7ed',
    ['金水不得令', [forms([branchAt('month', '寅'), configuration('金水合量过半')],
      [...shown('庚'), ...shown('辛')], [...shown('壬'), ...shown('癸')])]],
  ]],
  ['dtsjy-v1-c037-p003-001', ['524ad23c2b4238b0df9e778c6baf707909c261ffb40b493117f35875522c2969',
    ['火烈而性燥', [forms([configuration('燥土月木火过半且火量大于水量两倍')],
      [...shown('丙'), ...shown('丁')])]],
    ['遇金水激之', [forms([balance('火', '过盛')],
      [...shown('庚'), ...shown('辛')], [...trine('子午'), ...trine('巳亥')])]],
  ]],
  ['dtsjy-v1-c037-p005-001', ['b81329ab487a2ce19aade4cf9173545dfd3b02c2a5861b0e375d776d2e9263b4',
    ['有金以行之，木以納之', pattern('壬癸', '', [], heavy('水'), godColumns('印星', 1), godColumns('食伤', 1),
      [...visibleGod('正印'), ...visibleGod('偏印')], [...visibleGod('食神'), ...visibleGod('伤官')])],
  ]],
  ['dtsjy-v1-c037-p009-001', ['cf409b3d758bae3500e82569ccff81bb85e9dddad8ac82f4eea79e41cb6692da',
    ['金見水以流通', pattern('庚辛', '', [vigor('食伤')], godColumns('食伤', 2)), { fromContext: true }],
  ]],
  ['dtsjy-v1-c037-p015-001', ['ac74a6d335be03cc486e3d59816813a02214eb3f300ab4a2abf20ffcb23ddefe',
    ['遇擊', [forms([configuration('木火土三干顺生而外支冲入')])]],
  ]],
  ['dtsjy-v1-c037-p017-001', ['973fa2ea465db674710a45154520f8a05d64cfffe3c88eb75c8c59261c9f81e1',
    ['見戌酉申', pattern('甲乙', '亥', [], trine('申酉戌', '亥'))],
  ]],
  ['dtsjy-v1-c037-p023-001', ['4aa36f71c6bde5ef1c9e50c3dfebe144be1178adb77ee1700db6f1688f52f745',
    ['陽刃局戰', [forms([{ kind: 'shen_sha', position: 'month', name: '阳刃' }], monthlyClashes)]],
  ]],
  ['dtsjy-v1-c041-p002-003', ['d8de3a85ca0e2f02a4e61e0cbfb89aa914e89aac4cfcf6f01c9a5f031968163a',
    ['財旺身弱', [forms([male, weak, vigor('财星')])]],
  ]],
  ['dtsjy-v1-c041-p008-001', ['aa51bff567f977c9eec19076a374edddd370643f83fde14c615d8a36778ee4e2',
    ['財、官弱', [forms([smallShare('财星'), smallShare('官星')], visibleGod('比肩'), visibleGod('劫财'), yangBlade)]],
    ['財官旺', [forms([vigor('财星'), vigor('官星')], visibleGod('比肩'), visibleGod('劫财'), yangBlade)]],
  ]],
  ['dtsjy-v1-c041-p008-002', ['993a7a9abf5b0d1ec0469ca36840be18d011f3b3ecea20e4b24914ab69169390',
    ['身與財官兩平，而三者伏而出助', [forms([configuration('日主支援与财官合量相近'),
      configuration('比肩劫财俱藏且至少一类透干')], yangBlade)]],
  ]],
  ['dtsjy-v1-c042-p006-001', ['4f83dd10b56b86ced2f967c92a790224d2eb77c9cf8d64107005e2fefb04d79e',
    ['財星成箇門户，通得官星', [forms([...wealthOfficerFlow, vigor('财星')], visibleWealth, favorableMonthPhase)]],
  ]],
  ['dtsjy-v1-c043-p005-001', ['c3f30be9b1e6c697663e9dd75654f608802923807a2dcd7abf0584999948b6a8',
    ['財官和順，清奇純粹', [forms([...wealthOfficerFlow, supportedOfficer, godCount('伤官', 0)], visibleWealth)]],
  ]],
  ['dtsjy-v1-c044-p007-001', ['38fa602217502dffaff43bf411c8aa780da74c6fdda32a128808a20ee35261ca',
    ...[['傷輕財重', '伤官', '财星'], ['財輕官重', '财星', '官星'],
      ['傷重印輕', '印星', '伤官'], ['財重刼輕', '劫财', '财星']]
      .map(([text, light, heavy]) => [text, [forms([smallShare(light), vigor(heavy)])]]),
  ]],
  ['dtsjy-v1-c044-p012-001', ['3400e454f093ab407e23388c32aec2e549c6b28c866d4a9740d2d4d121e631af',
    ['財官無力', [forms([weak], ...['财星', '官星'].map(group => [[smallShare(group)], [godCount(group, 0)]]))]],
  ]],
]);

export function compileDtsjyReviewedPassage(claim) {
  const spec = reviewed.get(claim.id);
  if (!spec) return undefined;
  const [expected, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== expected || passages.some(([text, , { fromContext = false } = {}]) =>
    !(fromContext ? evidence.context : evidence.original_text)?.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《滴天髓輯要》已核分句的出处、原文或条件有变，须重新核对。' };
  }
  return {
    reason: 'unmapped_condition',
    condition: '按《滴天髓輯要》原文已核盘面分句取材',
    branches: passages.map(([text, inputs]) => ({
      text,
      conditionCompiler: dtsjyReviewedProfile,
      inputs: inputs.map(input => normalizeRuleInput('bazi', input)),
    })),
  };
}
