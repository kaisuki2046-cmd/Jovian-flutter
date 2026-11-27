import { createHash } from 'node:crypto';
import { baziStemPhase } from '../../control/charts.ts';
import { compatibleBaZiLiteralFacts } from './bazi-literal-conditions.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const zpzqCaseProfile = 'bazi-zpzq-natal-case-v1';
const outerStems = ['year', 'month', 'hour'];
const outerBranches = ['year', 'day', 'hour'];
const stemCycle = '甲乙丙丁戊己庚辛壬癸';
const stem = (position, stem) => ({ kind: 'stem', position, stem });
const branch = (position, branch) => ({ kind: 'branch', position, branch });
const pillar = (position, ganZhi) => ({ kind: 'pillar', position, ganZhi });
const month = value => branch('month', value);
const monthOf = (day, value) => [stem('day', day), month(value)];
const hidden = (position, stem, tenGod) => ({ kind: 'hidden_ten_god', position, stem, tenGod });
const visible = (position, tenGod) => ({ kind: 'stem_ten_god', position, tenGod });
const mainQi = (position, tenGod) => ({ kind: 'branch_main_ten_god', position, tenGod });
const structure = name => ({ kind: 'bazi_ten_god_structure', name });
const strong = { kind: 'day_master_strength', result: '偏强', profile: 'monthly-weighted-strength-v1' };
const vigorous = group => ({ kind: 'bazi_ten_god_strength', group, profile: 'anchored-weighted-ten-god-v1', strength: '旺' });
const visibleCount = (stem, count) => ({ kind: 'bazi_stem_placement_count', stem, placement: 'visible', count });
const male = { kind: 'natal_gender', gender: '男' };
const seal = ['正印', '偏印'];
const wealth = ['正财', '偏财'];
const output = ['食神', '伤官'];
const choose = (required, anyOf) => ({ required, anyOf });
const combine = (left, right) => left.flatMap(first => right.map(second => [...first, ...second]));
const visibleGods = gods => gods.flatMap(god => outerStems.map(position => [visible(position, god)]));
const monthGods = gods => gods.map(god => [mainQi('month', god)]);
const noKilling = [
  ...outerStems.map(position => visible(position, '七杀')),
  ...['year', 'month', 'day', 'hour'].map(position => ({ kind: 'branch_ten_god', position, tenGod: '七杀' })),
];
const seasonForms = (days, months) => [...days].flatMap(day => [...months].map(value => monthOf(day, value)));
const allPillars = ['year', 'month', 'day', 'hour'];
const weak = { ...strong, result: '偏弱' };
const godCount = (tenGod, count) => ({ kind: 'bazi_ten_god_count', tenGod, count });
const absentGods = (gods, includeHidden = false) => [
  ...visibleGods(gods).flat(),
  ...(includeHidden ? gods.flatMap(tenGod => allPillars.map(position => ({ kind: 'branch_ten_god', position, tenGod }))) : []),
];
const monthOutput = mainQi('month', '伤官');
const monthKilling = mainQi('month', '七杀');
const orderedGods = (earlier, later) => outerStems.flatMap((first, index) => outerStems.slice(index + 1)
  .flatMap(second => earlier.flatMap(from => later.map(to => [visible(first, from), visible(second, to)]))));
const killingWithFood = [monthKilling, structure('食神制杀')];
const branchRelation = (relation, first, second) => ({ kind: 'bazi_branch_relation', relation, first, second });
const stemUnion = (first, second) => ({ kind: 'bazi_stem_combination', first, second });
const twoVisible = (first, second) => first.flatMap(from => second.flatMap(to => placements([from, to], outerStems, visible)));
const monthForm = name => ({ kind: 'bazi_month_pattern', name, result: '见配合' });
const wealthForms = ['正财格', '偏财格'].map(name => [monthForm(name)]);
const hiddenGods = gods => allPillars.flatMap(position => gods.map(tenGod => ({ kind: 'branch_ten_god', position, tenGod })));
const noHiddenHurtingOfficer = hiddenGods(['伤官']);
const hurtingOfficerBetweenSeals = placements(['正印', '偏印', '伤官'], outerStems, visible);
const lightHurtingOfficerWithSeals = {
  ...choose([strong, structure('印绶护身')], hurtingOfficerBetweenSeals),
  mustBeAbsent: noHiddenHurtingOfficer,
};
const ownRoot = [...stemCycle].flatMap(day => [1, 2, 3, 4].map(count => [
  stem('day', day), { kind: 'bazi_stem_placement_count', stem: day, placement: 'hidden', count },
]));
const shenSha = (position, name) => ({ kind: 'shen_sha', position, name });
const monthBlade = shenSha('month', '阳刃');
const officer = ['正官', '七杀'];
const monthPeer = ['建禄', '月劫'].map(name => [{ kind: 'bazi_month_pattern', name, result: '待配合' }]);
const wealthRootedInSeveralBranches = [...stemCycle].flatMap((day, index) => {
  const element = ((Math.floor(index / 2) + 2) % 5) * 2;
  return [...stemCycle.slice(element, element + 2)].flatMap(root => [2, 3, 4].map(count => [
    stem('day', day), { kind: 'bazi_stem_placement_count', stem: root, placement: 'hidden', count },
  ]));
});
const wealthExposedOnceWithRoots = wealthRootedInSeveralBranches.map(([day, root]) => {
  const index = stemCycle.indexOf(root.stem);
  const pairedWealth = stemCycle[index % 2 === 0 ? index + 1 : index - 1];
  return [day, root, visibleCount(root.stem, 1), visibleCount(pairedWealth, 0)];
});
const officerWithMultipleRoots = [...stemCycle].flatMap((day, index) => {
  const element = ((Math.floor(index / 2) + 3) % 5) * 2;
  const officerStem = stemCycle[element + (index % 2 === 0 ? 1 : 0)];
  return combine([2, 3, 4].map(count => [stem('day', day),
    { kind: 'bazi_stem_placement_count', stem: officerStem, placement: 'hidden', count }]), visibleGods(['正官']));
});
const officerBetweenWealthAndSeal = [wealth, seal].flatMap((first, index) => first.flatMap(before =>
  [seal, wealth][index].map(after => [visible('year', before), visible('month', '正官'), visible('hour', after)])));
const repeatedRootedKilling = [...stemCycle].flatMap((day, index) => {
  const killingStem = stemCycle[(index + 6) % 10];
  return [2, 3, 4].map(count => [stem('day', day), visibleCount(killingStem, 2),
    { kind: 'bazi_stem_placement_count', stem: killingStem, placement: 'hidden', count }]);
});
const separatedEarthWealthAndSeal = [...monthOf('戊', '酉'), stem('month', '己'), monthOutput];
const winterWoodSeal = seasonForms('甲乙', '亥子');
const winterMetalOutput = seasonForms('庚辛', '亥子');
const summerWood = seasonForms('甲乙', '巳午未');
const summerWoodOutput = combine(summerWood, visibleGods(['伤官']));
const winterWaterOutput = combine(seasonForms('壬癸', '亥子丑'), visibleGods(['伤官']));

const dingRenPreservesYou = [
  ...monthOf('甲', '酉'), visibleCount('丁', 1), visibleCount('壬', 1),
  mainQi('month', '正官'), { kind: 'bazi_stem_combination', first: 'month', second: 'hour' },
];
const yiYouWithDingXin = [...monthOf('乙', '酉'), structure('食神制杀')];
const mixedVisibleWealth = [...stemCycle].map((day, index) => {
  const start = ((Math.floor(index / 2) + 2) % 5) * 2;
  const [first, second] = stemCycle.slice(start, start + 2);
  return [stem('day', day), visibleCount(first, 1), visibleCount(second, 1)];
});
const childPhases = phases => [...stemCycle].flatMap((day, index) => {
  const yangOfficer = stemCycle[((Math.floor(index / 2) + 3) % 5) * 2];
  return [...'子丑寅卯辰巳午未申酉戌亥']
    .filter(value => phases.includes(baziStemPhase(yangOfficer, value)))
    .map(value => [stem('day', day), branch('hour', value)]);
});
const usefulHourStem = [
  ...monthGods(wealth).map(facts => [...facts, visible('hour', '食神'), structure('食伤生财')]),
  ...wealth.map(god => [mainQi('month', '正官'), visible('hour', god), structure('财官相生')]),
];
const interferingHourStem = [
  [mainQi('month', '正官'), visible('hour', '伤官'), structure('伤官见官')],
  ...combine(monthGods(seal), wealth.map(god => [visible('hour', god), structure('财星破印')])),
];

function placements(values, positions, fact) {
  if (!values.length) return [[]];
  const [first, ...remaining] = values;
  return positions.flatMap(position => placements(remaining, positions.filter(other => other !== position), fact)
    .map(group => [fact(position, first), ...group]));
}

const exposedStems = (values, base) => placements(values, outerStems, stem).map(group => [...base, ...group]);
const throughTrine = (day, monthBranch, first, second, visible) => placements([first, second], outerBranches, branch)
  .flatMap(group => exposedStems(visible, [...monthOf(day, monthBranch), ...group]));
const missingStems = (positions, values) => positions.flatMap(position => values.map(value => stem(position, value)));
const forbid = (groups, ...values) => groups.map(group => {
  const { required, mustBeAbsent = [] } = Array.isArray(group) ? { required: group } : group;
  return { required, mustBeAbsent: [...mustBeAbsent, ...missingStems(outerStems, values)] };
});

// Compare the source's two adjoining year/month forms, with a separate day stem.
function divertedPair(days, gender) {
  return [...days].flatMap(day => {
    const partner = stemCycle[(stemCycle.indexOf(day) + 5) % 10];
    return [[day, partner], [partner, day]].map(([year, month]) => ({
      required: [{ kind: 'natal_gender', gender }, stem('day', day), stem('year', year), stem('month', month)],
      mustBeAbsent: missingStems(['hour'], [day, partner]),
    }));
  });
}

const ownDingRen = ['month', 'hour'].map(position => ({
  required: [{ kind: 'natal_gender', gender: '女' }, stem('day', '丁'), stem(position, '壬')],
  mustBeAbsent: [
    ...missingStems(outerStems, ['丁']),
    ...missingStems(outerStems.filter(other => other !== position), ['壬']),
  ],
}));
const jiaChenConflicted = outerBranches.flatMap(position => forbid(exposedStems(['壬'], [...monthOf('甲', '辰'),
  branch(position, '戌')]), '丙')).flatMap(group => ['申', '子'].map(value => ({
  required: group.required,
  mustBeAbsent: [...group.mustBeAbsent, ...outerBranches.map(position => branch(position, value))],
})));

const orderedGuiXin = outerStems.flatMap((first, index) => outerStems.slice(index + 1).map(second => ({
  required: [...monthOf('己', '卯'), stem(first, '癸'), stem(second, '辛')],
  mustBeAbsent: [...missingStems(outerStems.filter(position => position !== first), ['癸']),
    ...missingStems(outerStems.filter(position => position !== second), ['辛'])],
})));

function soleWealth(day, monthBranch, hiddenStem, visibleWealth = '丙丁', hiddenGod = '正官') {
  return outerStems.flatMap(position => [...visibleWealth].map(value => ({
    required: [...monthOf(day, monthBranch), hidden('month', hiddenStem, hiddenGod), stem(position, value)],
    mustBeAbsent: missingStems(outerStems.filter(other => other !== position), ['丙', '丁']),
  })));
}

const remainingSourceReview = {
  'c005-p003-001': '按相邻的年、月干先合核对可复排的正财例式。其他财星位置及隔位取法待核。',
  'c005-p003-002': '按相邻的年、月干先合核对可复排的正官例式。其他官星位置及多重争合待核。',
  'c006-p005-201': '丁日只取月干或时干见唯一壬，且其余天干没有丁争合。远隔的年干壬待核。',
  'c021-p005-001': '只匹配同一盘里癸先、辛后且各只透一位的原句。辛先、时癸的另一断语不在本条原文。',
};

const reviewed = new Map([
  ['c005-p003-001', ['fbfcc1c39d29270d61822c04ffa3462609a019d9a2ffe75bfbde0c738973b16f',
    [null, divertedPair('甲丙戊庚壬', '男')],
  ]],
  ['c005-p003-002', ['f3b4e9b6042bb0a89e02e7fde59c8084d34e0ece95480dff4f03e46c0a5e3d0f',
    [null, divertedPair('乙丁己辛癸', '女')],
  ]],
  ['c006-p005-201', ['1383d1643ed133bc28cbd960283f9a6d950cf50f596cc455462ca9cf3beef8a2',
    [null, ownDingRen],
  ]],
  ['c008-p005-201', ['36b5b8b306182490462ff9af4dd0ea7e92dec87dd63edbd3cf9c4b0bd99cd6e0',
    ['虽于别宫刑冲', [choose([...monthOf('丙', '子'), mainQi('month', '正官')],
      placements(['卯', '酉'], outerBranches, branch))]],
  ]],
  ['c011-p006-001', ['687a032463a23ed50701be5b21c19a863b6e74710c6aabf41e1e27db45bf64de',
    [null, forbid(throughTrine('丙', '申', '子', '辰', ['壬', '戊']), '庚')],
  ]],
  ['c013-p002-001', ['0966c1c2b792ae23e6eb695371a562d5ea5735db93af65cb4d4305e23abc50a1',
    ['透丁合壬', [dingRenPreservesYou]],
  ]],
  ['c013-p002-002', ['e87f983084fadb78c43b7282e2fbfddda6d8f9c163d1cd27e449a42182c8e282',
    [null, [[...monthOf('甲', '辰'), stem('year', '乙'), stem('month', '庚'), stem('hour', '戊')]]],
  ]],
  ['c013-p003-002', ['93bc6ca764f27d8396a318d13981e093f2a5971a0486b9d0af89272b57f1cf34',
    [null, [...'寅午'].flatMap(branch => exposedStems(['癸', '庚'], [pillar('day', '丙' + branch), month('子')]))],
  ]],
  ['c013-p004-001', ['366333ebe456d03fed75dfbc88f41827f4a2058fe8c9aad16b82185deae454e0',
    ['壬合丁以清官，而壬水根深', [choose([...dingRenPreservesYou, vigorous('印星')],
      outerBranches.map(position => [hidden(position, '壬', '偏印'), branch(position, '亥')]))]],
  ]],
  ['c013-p004-002', ['ff56555f5a7d150893830e40b7cf715ad59df833fdd7d74af85cee9e128dac03',
    [null, exposedStems(['辛', '丁'], monthOf('乙', '酉'))],
  ]],
  ['c013-p005-001', ['dd0d1d372845eb3ae5eb4a71656af919445502f710c7fae1c555c8e686c13b5b',
    ['乙逢酉逢煞，透丁以制', [choose(yiYouWithDingXin, exposedStems(['辛', '丁'], []))]],
  ]],
  ['c013-p006-001', ['7e6dd47c5f9da31df640ac629bf364141c4d89dfbdda9688fccd3650ffdd3832',
    ['身强印旺，透煞', [choose([strong, vigorous('印星'), structure('杀印相生')],
      combine(monthGods(seal), visibleGods(['七杀'])))]],
  ]],
  ['c013-p006-002', ['d420d8c0a523d813c4d5bf9efe45e47b648f7d54740673f30d930f8f59fbaef8',
    ['身主甚旺，伤官甚浅，印又太重', [{
      ...lightHurtingOfficerWithSeals,
      required: [...lightHurtingOfficerWithSeals.required, { ...vigorous('印星'), strength: '过盛' }],
    }]],
  ]],
  ['c013-p006-003', ['bf5cd697ea0eece1088eafd27d409e8432dbc2a4626fa6071427b47384befbe0',
    ['身强比重而财无气', [{
      ...choose([strong, vigorous('比劫')], visibleGods(wealth)),
      mustBeAbsent: allPillars.flatMap(position => wealth.map(tenGod => ({ kind: 'branch_ten_god', position, tenGod }))),
    }]],
  ]],
  ['c015-p002-001', ['6424c5ca347e5285fb499fb1141f46deaaf18d752a42c2b6dfbd2051682f13d0',
    ['冬木逢水，虽透官星', [choose([structure('官印相生')], combine(winterWoodSeal, visibleGods(['正官'])))]],
  ]],
  ['c015-p002-002', ['7a39de3e3b22ea10d74a5c55a8e6726bb1ef10339f9140143a9d7297bbec10f9',
    ['身印两旺，透食', [choose([strong, vigorous('印星')], combine(winterWoodSeal, visibleGods(['食神'])))]],
  ]],
  ['c015-p003-001', ['6f7036ee48dc0b2aeeb6028d30be6ec1c5be23b1a8c41201828b86eb8a65f0ea',
    ['伤官见官', [choose([mainQi('month', '伤官'), structure('伤官见官')],
      combine(winterMetalOutput, visibleGods(['正官'])))]],
  ]],
  ['c015-p003-002', ['19f6a83adbba7756c34ba37dec5dcefdd9d743d09978c86e0d2cdfcf6714c069',
    ['伤官带煞', [choose([mainQi('month', '伤官')], combine(winterMetalOutput, visibleGods(['七杀'])))]],
  ]],
  ['c015-p004-001', ['13ecbd43537009941bf2de22ca277851cb71c8ef1e394b113905884ca4c67233',
    ['伤官佩印', [choose([mainQi('month', '伤官'), vigorous('印星')], combine(summerWoodOutput, visibleGods(seal)))]],
  ]],
  ['c015-p005-001', ['423805882c9c0993997e873ec731a49b0336f3286aab6b576137fcc2027122dc',
    ['伤官用财', [choose([structure('伤官生财')], combine(winterWaterOutput, visibleGods(wealth)))]],
  ]],
  ['c015-p006-001', ['525a2a0e776a157c1b8276b7fa0b4d0eddde7d2e95e7cc8e71b2a143026ed405',
    ['伤官用财', [choose([mainQi('month', '伤官'), structure('伤官生财')], combine(summerWoodOutput, visibleGods(wealth)))]],
  ]],
  ['c015-p007-001', ['2f3dad5fd35a3ad745057bf4e7aec4b7275e3b08b8253f8e827134257cbb6605',
    ['庚生申月，而支中或子或辰，会成水局，天干透丁，以为官星，只要壬癸不透露干头，便为贵格', forbid(throughTrine('庚', '申', '子', '辰', ['丁']), '壬', '癸')],
  ]],
  ['c015-p008-001', ['b4877b47a5a586ec5688465f7961662e26ba09fa1538d11bc0032e0fa5cb9f86',
    ['夏木火盛', [choose([{ kind: 'bazi_element_balance', element: '火', band: '过盛', profile: 'weighted-element-balance-v1' }],
      combine(summerWood, visibleGods(['食神'])))]],
  ]],
  ['c017-p005-001', ['9f9d64976b493174e53e6746a701e8f78e278a7985fa954f30194f5cdd861eb9',
    [null, jiaChenConflicted],
  ]],
  ['c017-p006-001', ['6dbcde6813cebbfe79d7817bdd3da57c73e7dd3004cefb459420e554c315ef10',
    [null, throughTrine('癸', '辰', '申', '子', ['戊'])],
  ]],
  ['c017-p006-002', ['d9256a74f2f0e6e7fd6afcd1e4dfd276e61241c14c1133ff7ead1a724741a327',
    [null, exposedStems(['戊', '壬'], monthOf('丙', '辰'))],
  ]],
  ['c021-p005-001', ['f7d269233b93a70b4878af5d31ff364b95257f0eaf398eb612d3b7c20222b64f',
    [null, orderedGuiXin],
  ]],
  ['c021-p006-001', ['24907b334d3d6a851658312052938fdf45b2f1460efaf4c60c5db45cfa714b7d',
    [null, [[stem('year', '癸'), pillar('month', '辛酉'), stem('day', '丙'), stem('hour', '己')]]],
  ]],
  ['c022-p004-001', ['fa981b747f0ca5a2e22b2d1a6e1f2d25baed00ddb9b46e92f06d2534701517b7',
    ['其实财官成格', [choose([structure('财官相生')],
      combine(['正财格', '偏财格', '正官格'].map(name => [monthForm(name)]), twoVisible(wealth, ['正官'])))]],
  ]],
  ['c025-p001-001', ['565f5e7a99a55328c74eb4de459cb92809f9fd7fd65997c6dfbae8a334f4e43e',
    ['提纲得力', ['正官格', '正财格', '偏财格', '食神格', '伤官格', '正印格', '偏印格', '七杀格']
      .map(name => [monthForm(name)])],
    ['年干有用', [
      choose([mainQi('month', '正官'), structure('财官相生')], wealth.map(god => [visible('year', god)])),
      choose([visible('year', '食神'), structure('食伤生财')], monthGods(wealth)),
    ]],
  ]],
  ['c025-p002-001', ['9f00008f4979be7208933dd5284b6d8341960f49c832346f7d9d21faf618c6b0',
    ['妻宫坐财', [choose([male, structure('财星破印')], combine(monthGods(seal), wealth.map(god => [mainQi('day', god)])))]],
    ['妻坐官', [[male, mainQi('month', '伤官'), mainQi('day', '正官'), structure('伤官见官')]]],
  ]],
  ['c025-p002-002', ['96b5df3787420e90d63e0e41dfd67d3a2b5b231f3e11c7fff3dcb7963e84aa66',
    ['财格逢之，可以生财', [choose([male, mainQi('day', '伤官'), structure('伤官生财')], monthGods(wealth))]],
  ]],
  ['c025-p002-003', ['3a329ab95e44802e52813f9a19e1eaf6c4f537e7c9d5aa0eef063432a67994ff',
    ['全凭日刃帮身', [{
      ...choose([male, weak, shenSha('day', '阳刃')], ['正财格', '偏财格', '正官格', '七杀格', '伤官格']
        .map(name => [{ kind: 'bazi_month_pattern', name, result: '见配合' }])),
      mustBeAbsent: [...absentGods(seal, true), ...absentGods(['比肩', '劫财']),
        ...['year', 'month', 'hour'].flatMap(position => ['比肩', '劫财'].map(tenGod =>
          ({ kind: 'branch_ten_god', position, tenGod })))],
    }]],
  ]],
  ['c025-p003-001', ['757bbd19dfdff5870239bc45035b73c2eb3baefadbe0ba04b73614a0ae89b5a9',
    ['官格透财', [choose([male, mainQi('month', '正官'), structure('财官相生')], visibleGods(wealth))]],
    ['食伤透财为用', [choose([male, structure('食伤生财')], combine(monthGods(output), visibleGods(wealth)))]],
  ]],
  ['c025-p003-002', ['e0ac7139e2637575994a64c9bf333d0be13b1227ee81c59297bd13e781835c51',
    ['印轻财露', [choose([male, structure('财星破印'), godCount('印星', 1)],
      combine(monthGods(seal), visibleGods(wealth)))]],
    ['透煞逢财', [choose([male, monthKilling], twoVisible(['七杀'], wealth))]],
  ]],
  ['c025-p003-003', ['3ae6ccce86d989f7a74371a1899c3ff7d999c27d2620a4fc9f48b9099c298bb3',
    ['或妻宫有用而坐下刑冲', [choose([male, structure('食伤生财')],
      combine(combine(monthGods(wealth), wealth.map(god => [mainQi('day', god)])),
        ['六冲', '三刑', '相刑', '自刑'].flatMap(relation => [
          [branchRelation(relation, 'year', 'day')], [branchRelation(relation, 'month', 'day')], [branchRelation(relation, 'day', 'hour')],
        ])))]],
  ]],
  ['c025-p003-004', ['41cd85d32f3247ec751dda29bc4be40c5c08e1631433c9adc9cdbda34f317b60',
    ['妻星两透，偏正杂出', [choose([male], mixedVisibleWealth)]],
  ]],
  ['c025-p004-201', ['54bcd9ecc590ea3655b0712d838d3a8d6b3e4baf0958a27e04547d4fa2dcb205',
    ['长生', [choose([male], childPhases(['长生']))]],
    ['沐浴', [choose([male], childPhases(['沐浴']))]],
    ['冠带临官', [choose([male], childPhases(['冠带', '临官']))]],
    ['旺中', [choose([male], childPhases(['帝旺']))]],
  ]],
  ['c025-p006-001', ['58ace2baf9b80d4f71e33abb52fb937fef0bbf7f820909a9b93e75f591bfbb22',
    ['时逢死绝', [choose([male], combine(childPhases(['死', '绝']), usefulHourStem))]],
    ['逢生旺', [choose([male], combine(childPhases(['长生', '帝旺']), usefulHourStem))]],
  ]],
  ['c025-p006-002', ['21ccacff2cfa2f0176c91a53cb59bbab2141f74da037fc24b465e080147ac767',
    ['即逢生旺', [choose([male], combine(childPhases(['长生', '帝旺']), interferingHourStem))]],
    ['若又死绝', [choose([male], combine(childPhases(['死', '绝']), interferingHourStem))]],
  ]],
  ['c032-p005-001', ['1d56d93fb67794c7350055b918c6571426c4504d44e6f959b4f58c08595f7a44',
    ['化官为印而透财', [{
      ...choose([...monthOf('丁', '亥'), mainQi('month', '正官'), visible('hour', '正财')],
        placements(['卯', '未'], outerBranches, branch)),
      mustBeAbsent: [...absentGods(['伤官']), ...noKilling],
    }]],
  ]],
  ['c032-p010-001', ['527cf8dc0ae3fdbc0045d6802331c0ab9d784e0af403f49766edd6995dfe23c3',
    ['至于官格透伤用印者，又忌见财', [choose([mainQi('month', '正官'), structure('伤官见官'), structure('财星破印')],
      wealth.flatMap(money => seal.flatMap(resource => placements([money, resource, '伤官'], outerStems, visible))))]],
  ]],
  ['c034-p004-001', ['f1e24a87279c6e934d624c7fd7bea8f75dc626a4e462428d1af10f99a6849b2d',
    ['有财旺生官者，身强而不透伤官，不混七煞', [{
      ...choose([strong, vigorous('财星'), structure('财官相生')], combine(wealthForms, visibleGods(['正官']))),
      mustBeAbsent: [...absentGods(['伤官']), ...noKilling],
    }]],
  ]],
  ['c034-p005-201', ['defe80c37d06175808eacfe689bdf71ccfe0ee35eecf9feeddc56dcb309fabfa',
    ['身强而不露官，略带一位比劫', [{
      ...choose([strong, structure('食伤生财'), godCount('比劫', 1)], combine([
        ...wealthForms, ...wealthForms.map(([form]) => [{ ...form, result: '待配合' }]),
      ], visibleGods(['食神']))),
      mustBeAbsent: absentGods(['正官']),
    }]],
  ]],
  ['c034-p007-001', ['a57d0b5251fbd3c5ecce83b1d7b9581827a7f08cb9e59c23ea57d5ddd5ff2e32',
    ['财格佩印', [{
      ...choose([structure('印绶护身')], combine(monthGods(wealth), visibleGods(seal))),
      mustBeAbsent: absentGods(wealth),
    }]],
  ]],
  ['c034-p010-001', ['189a5ea8a5eaf43859eca4f4aafab5910ae5afa88ca4e44113ca54aa12f89be3',
    ['食与印两不相碍', [choose([visible('year', '食神'), visible('month', '比肩'), visible('hour', '偏印'),
      structure('食伤生财')], monthGods(wealth))]],
  ]],
  ['c034-p015-001', ['077bb00dbd3a7bc92744ee554619d8844c24d1b8a5cbe8bbdcdea473a0687c14',
    ['制煞生财', [choose([structure('食神制杀'), structure('食伤生财')],
      combine(monthGods(wealth), combine(visibleGods(['食神']), visibleGods(['七杀']))))]],
  ]],
  ['c034-p018-001', ['84eccc2d4e0669684e6f1f50cff32deb9851cec6db39b6ed46076edbc5e660fa',
    ['有财用煞印者', [{
      ...choose([structure('杀印相生'), structure('印绶护身')],
        combine(monthGods(wealth), combine(visibleGods(['七杀']), visibleGods(seal)))),
      mustBeAbsent: absentGods(wealth),
    }]],
  ]],
  ['c034-p018-201', ['354be8b364e70d684d6682647a6945722ce7b5e6b21e176cfe5797a2cb27727f',
    ['若财用煞印而印独，财煞并透', [choose([structure('杀印相生'), structure('财星破印'), godCount('印星', 1)],
      combine(monthGods(wealth), combine(visibleGods(wealth), visibleGods(['七杀']))))]],
  ]],
  ['c036-p001-201', ['e386fd1356e59e7585459ee2d320a01805f99eefb54aad293c247d262c04335a',
    ['官星清纯', [{
      ...choose([strong, vigorous('印星'), structure('官印相生')], combine(monthGods(seal), visibleGods(['正官']))),
      mustBeAbsent: noKilling,
    }]],
  ]],
  ['c036-p006-201', ['2450020548e0084298dda82ecedb1ac67e4cc1e23ce182ca501855b604ed98f1',
    ['有印而用伤食者，身强印旺', [choose([strong, vigorous('印星')],
      combine(monthGods(seal), visibleGods(output)))]],
  ]],
  ['c036-p007-201', ['76b1d6ea30ccc28892d70184bad719673d521a340c12341bed943f5d5ee54301',
    ['印浅身轻，而用层层伤食', [choose([weak, godCount('印星', 1)],
      combine(combine(monthGods(seal), orderedGods(output, output)), [2, 3, 4].map(count => [godCount('食伤', count)])))]],
  ]],
  ['c036-p011-001', ['dd01bf2d5a9e820c996f2a18c7abca2dc09f3e50fde139f2d70bf9374e8969b8',
    ['有用煞而兼带伤食者', [choose([structure('杀印相生'), structure('食神制杀')],
      combine(monthGods(seal), combine(visibleGods(['七杀']), visibleGods(['食神']))))]],
  ]],
  ['c036-p013-201', ['bd05a8dcaa3b4905e1c570a7187e69046cc4e9f39d6bec5eb5a166b526ddfcb2',
    ['印轻财重，又无劫财以救', [{
      ...choose([vigorous('财星'), godCount('印星', 1), structure('财星破印')], monthGods(seal)),
      mustBeAbsent: absentGods(['劫财'], true),
    }]],
  ]],
  ['c036-p014-001', ['fe1a2aaacfacc7f61e3585998c76c65694c44deeefc4d5925a201577a1d5a3b1',
    ['财与食相生', [{
      ...choose([vigorous('印星'), godCount('财星', 1), structure('食伤生财')],
        combine(monthGods(seal), combine(visibleGods(wealth), visibleGods(output)))),
      mustBeAbsent: [vigorous('财星')],
    }]],
  ]],
  ['c036-p017-001', ['c1f211bf25e0f833d99863dd4e5013174a4552aeec6e790c46277bdd71073c7d',
    ['又有印而兼透官煞者', [choose([structure('食神制杀')],
      combine(monthGods(seal), placements(['正官', '七杀', '食神'], outerStems, visible)))]],
  ]],
  ['c036-p022-001', ['3f6534878ac0377d93fb99225ddf2a151db8e468307b7139b233be44f0b5851a',
    ['印透七煞，而劫财以存煞印', [choose([structure('杀印相生')],
      combine(monthGods(seal), wealth.flatMap(money => placements(['七杀', money, '劫财'], outerStems, visible))))]],
  ]],
  ['c038-p007-001', ['1e653ea9d003b5d8b7dbc04db06324b554fef2c2edfac0cd708b63cd187f44e9',
    ['夏木用财，火炎土燥', [{
      ...choose([{ kind: 'bazi_element_balance', element: '火', band: '旺', profile: 'weighted-element-balance-v1' },
        structure('食伤生财')], combine(summerWood, visibleGods(wealth))),
      mustBeAbsent: absentGods(seal, true),
    }]],
  ]],
  ['c038-p016-001', ['fc5efe18fa82b3713faab9766b0ba6c3b887d7bc78dda58c9690473d8d640c07',
    ['更有印来夺食，透财以解', [choose([mainQi('month', '食神'), structure('枭印夺食'), structure('财星破印')],
      combine(visibleGods(['偏印']), visibleGods(wealth)))]],
  ]],
  ['c038-p016-201', ['ccdf1578ce6619bb503264763ee185b4170fd298812b0d23256c83de376463d9',
    ['食神而官煞竞出', [choose([mainQi('month', '食神'), structure('食神制杀')],
      placements(officer, outerStems, visible))]],
  ]],
  ['c040-p004-001', ['b0d65cc58afe48c4a5db6cc9639898519418f2c4cbcbc6ac41255690df42eb07',
    ['财先食后，财生煞而食以制之', [choose([...killingWithFood, vigorous('财星')], orderedGods(wealth, ['食神']))]],
  ]],
  ['c040-p008-001', ['f01033c2357739ec9cc52ca8f3fe67b3d0c500669e6d6263c80f2844f0614799',
    ['煞重身轻', [choose([monthKilling, weak, vigorous('七杀'), structure('杀印相生'), structure('印绶护身')], visibleGods(seal))]],
  ]],
  ['c040-p011-201', ['a25e58ca22164a007ac47567e346088c819c6064d3a2df9dbfeca3b9d4c6ce6d',
    ['煞又化印，用神不清，而借财以清格', [{
      ...choose([...monthOf('丙', '亥'), monthKilling, strong, godCount('七杀', 1),
        structure('杀印相生'), structure('财星破印')],
        combine(outerBranches.map(position => [
          branch(position, '寅'),
          position === 'year' ? branchRelation('六合', 'year', 'month') : branchRelation('六合', 'month', position),
        ]), twoVisible(seal, wealth))),
      mustBeAbsent: absentGods(['七杀']),
    }]],
  ]],
  ['c040-p013-001', ['44459eec43eaf007577db4e49d102f783e5c439e4db1cced5eb8c68652824895',
    ['杂气七煞，干头不透财', [{
      ...choose([{ kind: 'bazi_month_pattern', name: '七杀格', result: '见配合' }],
        combine([...'辰戌丑未'].map(value => [month(value)]), visibleGods(['七杀']))),
      mustBeAbsent: absentGods(wealth),
    }]],
  ]],
  ['c040-p009-001', ['dac23d3878c9239d4d630cb44c28c093b010860385cfea9083cf465a8d00834c',
    ['财以去印存食', [choose([...killingWithFood, structure('枭印夺食'), structure('财星破印')],
      wealth.flatMap(money => placements([money, '偏印', '食神'], outerStems, visible)))]],
  ]],
  ['c040-p014-001', ['bd8dc41d5c63c2eaa7b17daaa4a4335ce010d772c1414acb4415c64b5cf50999',
    ['或去官', [{
      ...choose([monthKilling, structure('伤官见官')], twoVisible(['伤官'], ['正官'])),
      mustBeAbsent: [...absentGods(['食神']), branchRelation('六冲', 'year', 'month')],
    }]],
    ['或去煞', [{
      ...choose([monthKilling, branchRelation('六冲', 'year', 'month')], visibleGods(['正官'])),
      mustBeAbsent: [...absentGods(['七杀', '伤官']),
        ...outerBranches.map(position => ({ kind: 'branch_ten_god', position, tenGod: '七杀' }))],
    }]],
  ]],
  ['c042-p001-001', ['292599badd4c7e1f64da17b1c7d40652e10cd98e2df1fbabeaab430a2e80af83',
    ['夏木见水', [choose([monthOutput], combine(summerWood, visibleGods(seal)))]],
    ['冬金见火', [choose([monthOutput], combine(winterMetalOutput, visibleGods(['正官', '七杀'])))]],
  ]],
  ['c042-p002-001', ['6fd913134ccfacf9e16adfd2ad0060f6445f4cc730eb094e9a030f644384976d',
    ['身强而有根', [choose([monthForm('伤官格'), strong, structure('伤官生财')], ownRoot)]],
  ]],
  ['c042-p008-001', ['2761efd2cd2e1f602c33be9e627442b0d9f544d17d0125ebf6d04eea87ad376c',
    ['伤官旺，身稍弱', [choose([monthOutput, weak, vigorous('伤官'), vigorous('印星'), structure('印绶护身')], visibleGods(seal))]],
  ]],
  ['c042-p009-201', ['c5298b91e0d64f878f5ad8120941185d82189f486f7bbb9d3297e8ddbe56dccc',
    ['伤轻身重而印绶多见', [{
      ...lightHurtingOfficerWithSeals,
      required: [...lightHurtingOfficerWithSeals.required, vigorous('印星')],
    }]],
  ]],
  ['c042-p010-001', ['dbee0513af60aa2a0d7d9e411499742f9d242ee3140f275532902dc7c81670d6',
    ['财太旺而带印', [[...separatedEarthWealthAndSeal, stem('year', '丁'), stem('hour', '壬'),
      vigorous('财星'), structure('伤官生财')]]],
    ['印太重而带财', [choose([...separatedEarthWealthAndSeal, stem('year', '壬'), stem('hour', '丁'),
      godCount('财星', 1), structure('印绶护身')], [3, 4].map(count => [godCount('印星', count)]))]],
  ]],
  ['c042-p013-201', ['7a04b9c7375a2735cc2b203a54aa0c4aff918b060fb36551762b16fa80dfbaba',
    ['赖煞生印以帮身而制伤', [{
      ...choose([monthOutput, weak, vigorous('伤官'), structure('杀印相生'), structure('印绶护身')],
        combine(visibleGods(['七杀']), visibleGods(seal))),
      mustBeAbsent: absentGods(wealth, true),
    }]],
  ]],
  ['c042-p017-001', ['7320a6b3e057c0f13cb8b58afd38417da3eb1a318981e5270f2c02e5c249ca01',
    ['冬金用官，而又化伤为财', [{
      ...choose([...monthOf('辛', '亥'), monthOutput],
        combine(placements(['卯', '未'], outerBranches, branch), visibleGods(['正官']))),
      mustBeAbsent: absentGods(['伤官', '七杀']),
    }]],
  ]],
  ['c044-p001-001', ['60ab0d85895ae2fd4e2145f6b5ee1b43f2e14bb6a0cf8cd923aab1a69a3f1542',
    ['刃宜伏制，官煞皆宜，财印相随', [choose([monthBlade, structure('官印相生'), structure('财官相生')],
      wealth.flatMap(money => seal.flatMap(resource => placements([money, '正官', resource], outerStems, visible))))]],
    ['财印相随', [choose([monthBlade, structure('杀印相生')],
      wealth.flatMap(money => seal.flatMap(resource => placements([money, '七杀', resource], outerStems, visible))))]],
  ]],
  ['c044-p003-001', ['a2b99811d0bc2d99c5104b12129aa21e786ba80e824ce330d3f173d57e7fa479',
    ['官煞露而根深', [
      { ...choose([monthBlade], officerWithMultipleRoots), mustBeAbsent: absentGods(['七杀']) },
      { ...choose([monthBlade, vigorous('七杀')], visibleGods(['七杀'])), mustBeAbsent: absentGods(['正官']) },
    ]],
  ]],
  ['c044-p006-201', ['f19b8f999736967104d6098615a4df584848dcc59bfeaa4b86a9eb40f03b39d6',
    ['或是印护', [[monthBlade, mainQi('year', '正官'), visible('month', '伤官'), visible('hour', '偏印'),
      stemUnion('month', 'hour')]]],
    ['煞太重而裁损之', [choose([monthBlade, vigorous('七杀'), structure('食神制杀')],
      combine(repeatedRootedKilling, visibleGods(['食神'])))]],
    ['官煞轻而取清之', [[monthBlade, visible('year', '七杀'), visible('month', '正官'), visible('hour', '食神'),
      stemUnion('month', 'hour')]]],
  ]],
  ['c044-p010-001', ['fd025dcc0e916d2da771dab937667e6b82bad280c2e7513e2944ab0be69e11ad',
    ['财煞并透露，则犯去印存煞之忌', [choose([...monthOf('戊', '午'), structure('财星破印')],
      combine(placements(['寅', '戌'], outerBranches, branch), wealth.flatMap(money =>
        placements([money, '七杀', '偏印'], outerStems, visible))))]],
  ]],
  ['c044-p011-001', ['c94ef67c677d51fb05d77fac46a4290964e37accfe41dc822a1fe2f53442f3e4',
    ['财根深而用伤食，以转刃生财', [choose([monthBlade, structure('食伤生财')],
      combine(wealthRootedInSeveralBranches, visibleGods(output)))]],
  ]],
  ['c046-p005-001', ['6279b75019ebfdf17a1c5847afaefdb3d56fa0da9fa994367f87d29b6e85f67f',
    ['以官隔之，使财印两不相伤', [choose([structure('官印相生'), structure('财官相生')],
      combine(monthPeer, officerBetweenWealthAndSeal))]],
  ]],
  ['c046-p014-201', ['799f2123d019556631a81929b850de7dd71abffd23e7fea3bc1a7cdc426090ab',
    ['去煞存财', [choose([visible('year', '七杀'), visible('month', '劫财'), stemUnion('year', 'month')],
      combine(monthPeer, wealth.map(god => [visible('hour', god)])))]],
  ]],
  ['c046-p016-001', ['aff205c9fc070a1f12c898e74dfc52932f69882e883cb63f97cb77aa8caf7ac7',
    ['无财官而用伤食', [{
      ...choose([strong, vigorous('比劫')], combine(monthPeer, visibleGods(output))),
      mustBeAbsent: absentGods([...wealth, ...officer], true),
    }]],
    ['春木秋金', [{
      ...choose([strong, vigorous('比劫')], combine(combine(monthPeer,
        [...seasonForms('甲乙', '寅卯辰'), ...seasonForms('庚辛', '申酉戌')]), visibleGods(output))),
      mustBeAbsent: absentGods([...wealth, ...officer], true),
    }]],
  ]],
  ['c046-p019-001', ['0dbe66157110c6c0f4721310b24619f6ef80f6410f8907d5974023a898184c93',
    ['官煞竞出，必取清', [choose([visible('year', '正官'), visible('month', '七杀'), visible('hour', '劫财'),
      stemUnion('month', 'hour')], monthPeer)]],
    ['官煞竞出', [choose([structure('食神制杀')], combine(monthPeer, placements(['正官', '七杀', '食神'], outerStems, visible)))]],
  ]],
  ['c046-p023-201', ['988b0a901daddd8b6a2dcafb76d79167b9d650df7e64b708cf348b740bb9735a',
    ['孤官无辅', [{
      ...choose([godCount('正官', 1)], combine(monthPeer, visibleGods(['正官']))),
      mustBeAbsent: absentGods([...wealth, ...seal, '七杀'], true),
    }]],
  ]],
  ['c046-p025-001', ['f206f232d42a7e2e9b8f9805872f2ff8413fe01bf4b6c40dc2ff5154be34c7de',
    ['干头透一位而不杂，地支根多', monthPeer.map(pattern => ({
      ...choose(pattern, wealthExposedOnceWithRoots),
      mustBeAbsent: absentGods(output),
    }))],
  ]],
  ['c048-p004-001', ['9985f702e64a50c447266b3264e3a8d59ebd2cc3fe36d7813df8503641d0fcc5',
    ['丁壬化木，地支全亥卯未、寅卯辰，而又生于春月', ['丁壬', '壬丁'].map(([day, partner]) =>
      choose([{ kind: 'bazi_day_stem_transformation', stem: day, partner, element: '木' }],
        [...'寅卯辰'].flatMap(monthBranch => ['亥卯未', '寅卯辰'].flatMap(formation =>
          placements([...formation].filter(value => value !== monthBranch), outerBranches, branch)
            .map(positions => [...monthOf(day, monthBranch), ...positions])))))],
  ]],
  ['c034-p019-001', ['6c54065beb1ffc3920b8261004e179c7739cb47df1bf66180815ce21fa654294',
    [null, [...soleWealth('壬', '午', '己'), ...soleWealth('癸', '巳', '戊')]],
  ]],
  ['c034-p020-201', ['648027a56d5ae0a45b6e127d9458f542b6e08872f5dd0146158de0d16ff86247',
    [null, forbid(soleWealth('壬', '巳', '戊', '丙', '七杀'), '戊')],
  ]],
]);

export function compileZpzqCases(claim) {
  if (!claim.id.startsWith('zpzq-v1-')) return undefined;
  const spec = reviewed.get(claim.id.slice(8));
  if (!spec) return undefined;
  const [digest, ...entries] = spec;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== digest || entries.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《子平真诠》例式的原文、出处或条件有变化，须重新核对。' };
  }
  const branches = entries.map(([text, groups]) => ({
    text,
    conditionCompiler: zpzqCaseProfile,
    inputs: groups.map(group => Array.isArray(group) ? { required: group } : group)
      .filter(({ required, mustBeAbsent }) => compatibleBaZiLiteralFacts(required, mustBeAbsent))
      .map(group => normalizeRuleInput('bazi', group)),
  }));
  if (branches.some(branch => !branch.inputs.length)) {
    return { reason: 'source_review_required', reviewNote: '该例式尚无可在现行历法下复排的条件组。' };
  }
  if (!branches[0].text) {
    const reviewNote = remainingSourceReview[claim.id.slice(8)];
    return { compiler: zpzqCaseProfile, inputs: branches[0].inputs, ...(reviewNote && { remainingAlternatives: 1, reviewNote }) };
  }
  return { reason: 'unmapped_condition', condition: '按《子平真诠》已校原句的确切盘式取材', branches };
}
