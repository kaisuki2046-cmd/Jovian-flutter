import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';
import { defaultZiweiMutagens } from './ziwei-mutagen-placement.mjs';
import { ziweiRelativePalaces } from './ziwei-relative-profile.mjs';

export const quanshuTongyuanProfile = 'ziwei-quanshu-tongyuan-v1';

const prefix = 'ziwei-v3-c020-p';
const scope = 'origin';
const life = '命宫';
const bodyPalaces = [life, '夫妻', '财帛', '迁移', '官禄', '福德'];
const literaryAssistants = ['左辅', '右弼', '文昌', '文曲'];
const support = [...literaryAssistants, '天魁', '天钺'];
const malefics = ['擎羊', '陀罗', '火星', '铃星'];
const emptyStars = ['天空', '旬空', '截路', '空亡'];
const wealthOrEstate = ['财帛', '田宅'];
const wealthOrVirtue = ['财帛', '福德'];
const lifeAxis = [life, '财帛', '官禄', '迁移'];
const lifeTrines = ['财帛', '官禄'];
const sixMalefics = [...malefics, '地空', '地劫'];
const star = (palace, star) => ({ kind: 'palace_star', palace, star, scope });
const at = (palace, branch) => ({ kind: 'palace_branch', palace, branch });
const relation = (anchor, target, relation) => ({ kind: 'palace_relation', anchor, target, relation });
const change = (palace, change) => ({ kind: 'palace_mutagen', palace, change, scope });
const sectorStar = (palace, star) => ({ kind: 'palace_sector_star', palace, star });
const yearStem = stem => ({ kind: 'natal_year_stem', stem });
const yearBranch = branch => ({ kind: 'natal_year_branch', branch });
const female = { kind: 'natal_gender', gender: '女' };
const station = (palace, ...names) => names.map(name => star(palace, name));
const withStars = (palace, options, ...names) => options.map(name => station(palace, ...names, name));
const powerAndFortune = palace => [change(palace, '权'), change(palace, '禄')];
const withoutEmptyStars = ([{ palace }]) => emptyStars.map(name => star(palace, name));
const namedBodyPalace = palace => ({ kind: 'body_palace', palace });
const confirmedBodyPalace = palace => ({ kind: 'palace_confirmed_body_seat', palace });
const layout = { kind: 'ziwei_confirmed_natal_layout' };
const rating = (palace, star, brightness) => ({ kind: 'palace_brightness', palace, star, scope, brightness });
const sectorChange = (palace, change) => ({ kind: 'palace_sector_mutagen', palace, change });
const starChange = (palace, star, change) => ({ kind: 'star_mutagen', palace, star, change, scope });
const moreGoodThanHarm = palace => ({ kind: 'palace_sector_benefic_majority', palace });
const seatWith = (palace, names) => names.map(name => sectorStar(palace, name));
const product = (left, right) => left.flatMap(a => right.map(b => [...a, ...b]));
const choice = (required, anyOf) => ({ required: [layout, ...required], anyOf });
const lifeOrBody = (...names) => [station(life, ...names),
  { required: [layout], anyOf: bodyPalaces.slice(1).map(palace => [confirmedBodyPalace(palace), ...station(palace, ...names)]) },
];
const femaleLifeAt = (branch, qualifier, ...names) => [female, at(life, branch), qualifier, ...station(life, ...names)];
const flankLife = (next, previous) => [star('父母', next), star('兄弟', previous),
  relation(life, '父母', 'adjacent'), relation(life, '兄弟', 'adjacent')];
const atBranches = (palace, branches) => [...branches].map(branch => [at(palace, branch)]);
const goodChanges = palace => [...'科权禄'].map(mark => sectorChange(palace, mark));
const powerAndFortuneAtLife = [...powerAndFortune(life), sectorChange(life, '权'), sectorChange(life, '禄')];
const luMaTogether = lifeAxis.map(palace => station(palace, '禄存', '天马'));
const tanlangAndPojunInLifeSector = seatWith(life, ['贪狼', '破军']);
const zeroMajors = palace => ({ kind: 'palace_main_count', palace, count: 0 });
const nayin = element => ({ kind: 'natal_year_nayin_element', element });
const waterNayin = nayin('水');
const growthPhase = (palace, phase) => ({ kind: 'palace_changsheng_phase', palace, phase });
const majorState = (palace, state) => ({ kind: 'palace_major_state', palace, state });

function neighbors(palace) {
  const index = ziweiRelativePalaces.indexOf(palace);
  return [ziweiRelativePalaces[(index + 11) % 12], ziweiRelativePalaces[(index + 1) % 12]];
}

function flank(palace, first, second) {
  const [before, after] = neighbors(palace);
  return [[first, second], [second, first]].map(([a, b]) => [
    star(before, a), star(after, b), relation(palace, before, 'adjacent'), relation(palace, after, 'adjacent'),
  ]);
}

const adverseFlanks = [['劫空', '地劫', '地空'], ['火铃', '火星', '铃星'], ['羊陀', '擎羊', '陀罗']];
const helpfulFlanks = [['紫府', '紫微', '天府'], ['左右', '左辅', '右弼'], ['昌曲', '文昌', '文曲'],
  ['魁钺', '天魁', '天钺'], ['日月', '太阳', '太阴']];
const bodyFlanks = (first, second) => bodyPalaces.flatMap(palace => flank(palace, first, second)
  .map(facts => [confirmedBodyPalace(palace), ...facts]));
const oppositeLife = relation(life, '迁移', 'opposite');
const birthStems = [...'甲乙丙丁戊己庚辛壬癸'];
const twoSideDistributions = [[0, 0, 1], [0, 1, 0], [0, 1, 1], [1, 0, 0], [1, 0, 1], [1, 1, 0]];

function auspiciousFlanks(palace) {
  const sides = neighbors(palace);
  const adjacency = sides.map(side => relation(palace, side, 'adjacent'));
  return defaultZiweiMutagens.flatMap((carriers, index) => twoSideDistributions.map(distribution => [
    yearStem(birthStems[index]), ...adjacency,
    ...[...'禄权科'].flatMap((mark, position) => {
      const side = sides[distribution[position]], carrier = carriers[position];
      return [star(side, carrier), starChange(side, carrier, mark), sectorChange(side, mark)];
    }),
  ]));
}

const dimHuaKeCarriers = [
  ['天机', '丑未'], ['太阴', '卯辰巳'], ['文昌', '寅午戌'], ['文曲', '寅午戌'], ['天梁', '申巳亥'],
].flatMap(([carrier, branches]) => atBranches(life, branches).map(facts => [
  ...facts, star(life, carrier), starChange(life, carrier, '科'),
]));
const soloAssistantLife = ['左辅', '右弼'].map((name, index, aides) => ({
  ...choice([zeroMajors(life), star(life, name)], bodyPalaces.map(palace => [
    confirmedBodyPalace(palace), zeroMajors(palace),
  ])),
  mustBeAbsent: station(life, aides[1 - index]),
}));
const maleficMajorityAtLife = [2, 3, 4, 5, 6].flatMap(count =>
  Array.from({ length: count }, (_, beneficCount) => [
    { kind: 'palace_sector_six_malefic_count', palace: life, count },
    { kind: 'palace_sector_benefic_count', palace: life, count: beneficCount },
  ]));

const literaryMoonInLifeOrBody = ['文昌', '文曲'].flatMap(literary => [
  station(life, '太阴', literary),
  ...['夫妻', '财帛', '迁移', '官禄', '福德'].map(palace =>
    [{ kind: 'body_palace', palace }, ...station(palace, '太阴', literary)]),
]);
const sunAndGiantTrine = (sun, giant) => [
  at(sun, '午'), at(giant, '戌'), star(sun, '太阳'), star(giant, '巨门'), relation(sun, giant, 'trine'),
];

const reviewed = new Map([
  ['119004-001', ['25d49d504f5959f7362b59a7da686e26ce958a4db0a20768cb19cbdcbafd45a6',
    ['日月命身居丑末三方无吉', [{
      required: [layout, at(life, '丑'), ...station(life, '太阳', '太阴'), confirmedBodyPalace(life),
        { kind: 'palace_life_without_trine_auspicious_mutagens' }],
      mustBeAbsent: lifeTrines.flatMap(palace => station(palace, ...support, '禄存')),
    }]],
  ]],
  ['119004-002', ['5110a898930b9ba0e9ba7a99cc7a15a1b0accdcbde786e7784ed4d87f021a6f1',
    ['辰戌，身命更佳。', [choice([oppositeLife, confirmedBodyPalace('迁移')], [life, '迁移'].map((palace, index, seats) => [
      at(palace, '辰'), star(palace, '太阳'), at(seats[1 - index], '戌'), star(seats[1 - index], '太阴'),
    ]))]],
  ]],
  ['129003-003', ['3fe208d9b1732a18cb388bea7ce055659272229b949418947d6907dc45722d96',
    ['贪狼加吉坐长生', [choice([star(life, '贪狼'), nayin('火'), growthPhase(life, '长生')], product(
      product(atBranches(life, '寅申'), [...'寅午戌'].map(branch => [yearBranch(branch)])),
      support.map(name => seatWith(life, [name]))))]],
  ]],
  ['131005-001', ['be9b3a0b85c46e9150d6a277c951c187047afc72dc061cc8d75eba7c9fad1470',
    ['杀居午', [[at(life, '午'), star(life, '七杀')]]],
  ]],
  ['154003-003', ['7b960bde998d7ed39319795760980a9af4e497a1d491100d530d99daa7523ce5',
    ['禄逢冲破', [choice([star(life, '禄存'), oppositeLife],
      ['火星', '铃星'].map(name => station('迁移', name)))]],
  ]],
  ['158006-002', ['8a8b750c27c775b814774f13cea37af0602390e23b713c1111e7200493eac047',
    ['化科陷地', [choice([sectorChange(life, '科')], dimHuaKeCarriers)]],
    ['或又加羊陀劫空', [choice([sectorChange(life, '科'), ...seatWith(life, ['擎羊', '陀罗', '地劫', '地空'])],
      dimHuaKeCarriers)]],
  ]],
  ['160000-003', ['0133413cc33cf6d7f579f47e9332fe23c1d7427fc7c56d7f04b66dbf16223350',
    ['生处劫空', [[layout, ...station(life, '地空', '地劫'), growthPhase(life, '长生')]]],
  ]],
  ['166002-003', ['81f42f097ebe1972a18b882e3ebbd2c9e5696128589bdb75b8230dc5f9fbbf7e',
    ['命弱身强', [choice([majorState(life, '陷地'), { kind: 'palace_main_count', palace: life, count: 1 }],
      bodyPalaces.slice(1).map(palace => [
        confirmedBodyPalace(palace), majorState(palace, '庙旺'), { kind: 'palace_main_count', palace, count: 1 },
      ]))]],
  ]],
  ['168001-002', ['c2d97f722b8005c346b5a1b5be140c3b557590607c1f2dc2e516152a4d3a8e3a',
    ['安命在酉败地', [[layout, at(life, '酉'), waterNayin, yearStem('甲'), yearBranch('申')]]],
  ]],
  ['168001-003', ['2841cce52d2f0013bec5719dae245d920b5813a0598bab5b3f9839775c480161',
    ['水土绝在巳安命在巳为绝地却得金星在巳生水不绝', [
      choice([at(life, '巳'), star(life, '武曲')], ['水', '土'].map(element => [nayin(element)])),
    ]],
  ]],
  ['109009-001', ['4cdecaeeb97e717d60f5f048e9c48311e5917ba60b09f4f9d628258a9801eb97',
    ['梁居酉', [[at(life, '酉'), star(life, '天梁')]]],
  ]],
  ['121001-001', ['be4406ccffce9aa5334d79bf1656e2c0c0a0e7a13bb2d1dbd4fe2fa46aa29120',
    ['文昌武曲为人多学多能', [choice([
      ...station(life, '文昌', '武曲'), ...goodChanges(life), change(life, '权'), change(life, '科'),
    ], product(atBranches(life, '辰戌丑未卯酉巳亥'), lifeTrines.map(palace => [
      change(palace, '禄'), relation(life, palace, 'trine'),
    ])))]],
  ]],
  ['121001-002', ['180e85dbbebf75140a67fbe831f6d903b648cb1d0d023d1b36190e0e91727ccf',
    ['文科拱照', [choice([sectorChange(life, '科')], lifeTrines.map(palace => [
      ...station(palace, '文昌'), starChange(palace, '文昌', '科'), relation(life, palace, 'trine'),
    ]))]],
  ]],
  ['129007-001', ['f33a5cb4a808a451574b6275e9fde761e727a6ed6150eafda59d23919e9c8bea',
    ['丑未宫次之。', [choice(station(life, '贪狼', '武曲'), atBranches(life, '丑未'))]],
  ]],
  ['129007-002', ['9dc3ad6cae1e07babf051df038b5e1accc14492e7d8f711bd57ba0d416e4afa5',
    ['贪武先贫而后富', [station(life, '贪狼', '武曲')]],
  ]],
  ['129014-002', ['c9b7a1a96e60af0df038882727d267d215eced4c88cddf283d952f8200b63b1a',
    ['贪武四生四墓宫破军忌杀', [choice([...station(life, '武曲'), ...tanlangAndPojunInLifeSector, sectorChange(life, '忌')],
      product(atBranches(life, '寅申巳亥辰戌丑未'), sixMalefics.map(name => seatWith(life, [name]))))]],
  ]],
  ['129014-003', ['28293d6c9d23e9ad14b0cbf5e044f5d357e129b24153d3dc248d0feef8a2fd8e',
    ['贪武破军无吉曜', [{
      required: [layout, ...station(life, '武曲'), ...tanlangAndPojunInLifeSector, { kind: 'palace_sector_benefic_count', palace: life, count: 0 }],
      mustBeAbsent: lifeAxis.flatMap(palace => [star(palace, '禄存'), ...[...'科权禄'].map(mark => change(palace, mark))]),
    }]],
  ]],
  ['129017-001', ['04d073a5e18d55b0b481be484e321aa13991816b0114af7bf91fc86fbc5a1374',
    ['贪狼廉贞同度', [station(life, '贪狼', '廉贞')]],
  ]],
  ['133004-001', ['6f15870c4cb4d9c15c5121abe542729436255b0c26ee95130ae91e8335f1c919',
    ['巨门子午科权禄', [choice([...station(life, '巨门'), yearStem('辛'), ...goodChanges(life)], atBranches(life, '子午'))]],
  ]],
  ['133014-001', ['d1c6adf90fd29c519762c6e2a43bde12896c158191d0a7d6bb8df3631e5177ce',
    ['巨门羊陀于身命疾厄', [
      ...[life, '疾厄'].map(palace => [layout, star(palace, '巨门'), ...seatWith(palace, ['擎羊', '陀罗'])]),
      choice([], bodyPalaces.slice(1).map(palace =>
        [confirmedBodyPalace(palace), star(palace, '巨门'), ...seatWith(palace, ['擎羊', '陀罗'])])),
    ]],
  ]],
  ['152002-003', ['6d4d1b7c436ef56da9ed95d49005b5f464ea1f5b03ba78d6918e0573df618687',
    ['身命无正曜是也', soloAssistantLife],
  ]],
  ['152007-001', ['1eb2543cd164b2ba6d1fa5beb1161180b1b644d20dfc9c4da6585171942cb153',
    ['左右魁钺为福寿', [choice(station(life, '左辅', '右弼'),
      ['天魁', '天钺'].map((name, index, nobles) => [star(life, name), sectorStar(life, nobles[1 - index])]))]],
  ]],
  ['152007-002', ['50b3962577f83d9395a3690901a4313367637cf2c503575932931a7430c68513',
    ['右弼天相', [station(life, '右弼', '天相')]],
    ['丑未亥三宫不贵', [choice(station(life, '右弼', '天相'), atBranches(life, '丑未亥'))]],
    ['若卯酉二陷宫，少称心意', [choice([...station(life, '右弼', '天相'), rating(life, '天相', '陷')], atBranches(life, '卯酉'))]],
  ]],
  ['154003-002', ['565ea7cf4ceb91967f78766660e3434671d440af66653560cc3a0eeea5f34ebc',
    ['双禄重返终身富贵', [[layout, star(life, '禄存'), change(life, '禄'), sectorChange(life, '禄')]]],
  ]],
  ['156000-001', ['b9a9c0ebec112a09e1cb98bfa9ea2ca959927b7c64d0761a1839a1365e8add89',
    ['禄马最喜交驰', [choice([], luMaTogether)]],
    ['忌见杀羊火截路空亡', [choice([], product(luMaTogether, ['擎羊', '火星', '截路', '空亡'].map(name => seatWith(life, [name]))))]],
  ]],
  ['158006-001', ['05a71ecf02212f53eb6fa4fe4c62ffca9dc0f9d56c99376d95981270804e9e1f',
    ['权禄重逢杀凑', [choice(powerAndFortuneAtLife, sixMalefics.map(name => seatWith(life, [name])))]],
  ]],
  ['164001-001', ['21b3dea95b5e447a9ea1ea214b9afcd33b0f1574a902c8c59f7e72884f65ae7f',
    ...[...adverseFlanks, ...helpfulFlanks].map(([text, first, second]) => [text, [choice([], flank(life, first, second))]]),
    ['科权禄', [choice([], auspiciousFlanks(life))]],
  ]],
  ['166000-001', ['86f9f330ffe1cebc93b58f541dfbd4e39c80804ec28c27e7103419e74f5cc0ea',
    ...adverseFlanks.map(([text, first, second]) => [text, [choice([], bodyFlanks(first, second))]]),
    ['六夹贵逢吉甚妙', [choice([], helpfulFlanks.flatMap(([, first, second]) =>
      bodyFlanks(first, second).map(([seat, ...facts]) => [seat, moreGoodThanHarm(seat.palace), ...facts]))
      .concat(bodyPalaces.flatMap(palace => auspiciousFlanks(palace).map(facts =>
        [confirmedBodyPalace(palace), moreGoodThanHarm(palace), ...facts]))))]],
    ['夹忌', [choice([], bodyPalaces.flatMap(palace => adverseFlanks.flatMap(([, first, second]) =>
      flank(palace, first, second).map(facts => [
        confirmedBodyPalace(palace), change(palace, '忌'), sectorChange(palace, '忌'), ...facts,
      ]))))]],
  ]],
  ['166002-001', ['d3b541b934a9bf6492f95ffd088ecca547263287592344223a1e3bdaf90c0045',
    ['身命俱吉', [choice([moreGoodThanHarm(life)], bodyPalaces.map(palace => [
      confirmedBodyPalace(palace), moreGoodThanHarm(palace),
    ]))]],
  ]],
  ['166002-002', ['6c6d87bd0a55a49f0e9f16ae770a58c830a8724909ddd95ba7f601cb3619e907',
    ['身吉命凶', [choice([], product(maleficMajorityAtLife, bodyPalaces.slice(1).map(palace => [
      confirmedBodyPalace(palace), moreGoodThanHarm(palace),
    ])))]],
  ]],
  ['168001-001', ['8ee6ffb03f2cf1328888ea82f075d041e09c11ea4f2e9f2e14c0a72de784567f',
    ['如水生人墓辰遇财官或禄存尤妙', [choice([waterNayin], [
      ...['财帛', '官禄'].map(palace => [at(palace, '辰')]),
      ...ziweiRelativePalaces.map(palace => [at(palace, '辰'), star(palace, '禄存')]),
    ])]],
  ]],
  ['172001-001', ['be16c69f372d16ade5453a693782edbe2dcca15732861fd3b033ecc713bc313c',
    ['紫微辅弼多为财赋之官', [station('财帛', '紫微', '左辅', '右弼')]],
  ]],
  ['174001-012', ['8b92c348d3c9497280ed4877d4940bece62cc57eb3ac0a57756167c03c08207f',
    ['巨火擎羊陀逢恶曜', [choice([...station(life, '巨门'), ...seatWith(life, ['火星', '擎羊', '陀罗'])],
      ['铃星', '地空', '地劫'].map(name => seatWith(life, [name])))]],
  ]],
  ['174001-014', ['04c956883bf7cb480ead901ebd35c4852ebb73b6fcd8d3887490c4dbd6e4e192',
    ['杀临绝地会羊陀', [[layout, star(life, '七杀'), ...seatWith(life, ['擎羊', '陀罗']),
      { kind: 'palace_changsheng_phase', palace: life, phase: '绝' }]]],
  ]],
  ['113002-002', ['0c9f85d917ce51c54d6ce66b5073a5f1d81dc48b0c344dd006902d20020ce95e',
    ['加刑忌', [[layout, ...station(life, '天机', '天梁', '天刑'), change(life, '忌'), sectorChange(life, '忌')]]],
  ]],
  ['113003-001', ['fab7719876b5fbefed07cede24f917a1cab5fae60f70cdead2b19167b6ab9b82',
    ['机梁同照命身，又逢劫空', [choice(seatWith(life, ['天机', '天梁', '地劫', '天空']),
      bodyPalaces.map(palace => [confirmedBodyPalace(palace), ...seatWith(palace, ['天机', '天梁'])]))]],
  ]],
  ['119004-003', ['3bf4c06d89f9a7ba5e038a232994c112573e2cc926027c1419fad3e9860033db',
    ['日月守命', [station(life, '太阳', '太阴')]],
  ]],
  ['119008-001', ['ba7c4a712c7f5b210efa47bd48cb03b4cc965d6fbaf542453073cba94bdd3d73',
    ['若反背日戌月辰', [life, '迁移'].map((palace, index, seats) => [
      at(palace, '戌'), star(palace, '太阳'), at(seats[1 - index], '辰'), star(seats[1 - index], '太阴'),
      relation(life, '迁移', 'opposite'),
    ])],
  ]],
  ['119010-002', ['b7fd0197899e1ade2be9cb754ac50ebbfd1f94033b641351acb2d518f06ba989',
    ['日月羊陀', [choice(seatWith(life, ['太阳', '太阴', '擎羊', '陀罗']),
      ['太阳', '太阴'].map(name => station(life, name)))]],
  ]],
  ['125003-002', ['2ce8b8529a84e714a695f7aeab80f533268626ed6e83eee6b3df1e10a6dfd071',
    ['昌曲吉星居福德', [choice(station('福德', '文昌', '文曲'),
      ['左辅', '右弼', '天魁', '天钺', '禄存'].map(name => station('福德', name)))]],
  ]],
  ['127003-001', ['2318d08eb9e2ecdadba393dde21a1e807adbd68d361d9261cb4e3f8957e46f61',
    ['武曲禄马交驰', [choice(station(life, '武曲'), lifeAxis.map(palace => station(palace, '禄存', '天马')))]],
  ]],
  ['127003-002', ['2d169aa46b1f25c824d1944f150ff5de8810e559ebea1ddda856e28e6d1a9aa8',
    ['武曲迁移巨商高贾', [[layout, star('迁移', '武曲'), moreGoodThanHarm('迁移')]]],
  ]],
  ['127005-001', ['5b4f9f76e469fd28432a0c943bfeb7144441a6e1b62b126a534c811d57a3fdb9',
    ['武曲廉贞贪杀', [[layout, star(life, '武曲'), ...seatWith(life, ['廉贞', '贪狼', '七杀'])]]],
  ]],
  ['131001-001', ['c12378c20b63df8d1a7a2283152583203769cc8835c0c5f65ee4873f0f184f7b',
    ['廉贞申未宫无杀', [choice([star(life, '廉贞'),
      { kind: 'palace_sector_six_malefic_count', palace: life, count: 0 }], [...'申未'].map(branch => [at(life, branch)]))]],
    ['加杀平常。', [choice([star(life, '廉贞')], product(
      [...'申未'].map(branch => [at(life, branch)]), sixMalefics.map(name => seatWith(life, [name]))))]],
  ]],
  ['133014-002', ['6d106f1eb2ed4853a22c16bfcfeaff6ca214dbf39cabdde5f1919146caf17e9a',
    ['巨门四杀陷', [[layout, ...station(life, '巨门'), rating(life, '巨门', '陷'), ...seatWith(life, malefics)]]],
  ]],
  ['137001-001', ['9f6a62dcea89d5b1466091d4024bc048ef5a8844127f87984c29dd6b2818a934',
    ['破军子午宫无杀', [choice([star(life, '破军'),
      { kind: 'palace_sector_six_malefic_count', palace: life, count: 0 }], [...'子午'].map(branch => [at(life, branch)]))]],
  ]],
  ['139001-001', ['ee77eb505641c5e00b92ec41b3297ebfa3fcf38da6a6a32b9c8dd03516648820',
    ['擎羊入庙富贵声扬', [choice([star(life, '擎羊'), rating(life, '擎羊', '庙')],
      support.map(name => seatWith(life, [name])))]],
  ]],
  ['149004-001', ['c4352503a243657a3642444ba1d277adbf40f077a498a9d9f63b950fcb0fd6e0',
    ['魁钺重逢杀凑', [choice(seatWith(life, ['天魁', '天钺']),
      ['擎羊', '铃星', '地空', '地劫'].map(name => seatWith(life, [name])))]],
  ]],
  ['154007-001', ['d3fb4d6b6a4d0b6947e163e3fb8cb88b8c46d2305bbe224693de0234187a3827',
    ['禄存厚重多衣禄', [station(life, '禄存')]],
  ]],
  ['158001-001', ['4c62c94037e9a6dfe1f90a52172d2ffb7e75811cd6bdf01f2a0d47a622daf89c',
    ['科权禄合', [[layout, ...[...'科权禄'].map(mark => sectorChange(life, mark))]]],
  ]],
  ['158001-002', ['4919a9908741132e9d33d11384e56364c2ed33515c356b772890af46b306ed28',
    ['禄权命逢合吉', [choice([...powerAndFortune(life), sectorChange(life, '禄'), sectorChange(life, '权')],
      support.map(name => seatWith(life, [name])))]],
  ]],
  ['158001-003', ['2ad4afc2b93bfd693a044222a35211f86ca22cbed194b6212816db956c36f978',
    ['权禄重逢财官双美', [[layout, ...powerAndFortune(life), sectorChange(life, '禄'), sectorChange(life, '权'), moreGoodThanHarm(life)]]],
  ]],
  ['172003-001', ['5e643938e50b2cc1dab6b4f57d18ce6eb1210980a2b16d5d1606caa278f83a5f',
    ['紫府武曲居财帛更兼权禄', [[layout, star('财帛', '紫微'), ...seatWith('财帛', ['天府', '武曲']),
      sectorChange('财帛', '权'), sectorChange('财帛', '禄')]]],
  ]],
  ['174001-002', ['b6d1c9243ecd396706554dfb02bc28ed67fc9fde9b350dd01a5051e607d9847c',
    ['天同会吉', [choice(station(life, '天同'), support.map(name => seatWith(life, [name])))]],
  ]],
  ['174001-003', ['74418f82413ed2e92ddc9e6a2be8b59f0f6f62561c6c69796f67c2c1e62d3fa9',
    ['天机加恶杀同宫', [choice(station(life, '天机'), sixMalefics.map(name => station(life, name)))]],
  ]],
  ['174001-004', ['1cc0897a26d6a75af70d444b16ab50759d887543d0a1abaaf8206a3ebea2f6fd',
    ['阴阳左右合为佳', [choice(seatWith(life, ['太阳', '太阴', '左辅', '右弼']),
      ['太阳', '太阴'].map(name => station(life, name)))]],
  ]],
  ['174001-006', ['a30441b9bffd1e7160de336bae28b0506fd1da3c5f3974d5c59efc593d6f4d18',
    ['文昌武曲于身命文正兼备', lifeOrBody('文昌', '武曲')],
  ]],
  ['174001-007', ['195ec30ddf9a9c0d88a1e96e62d099a5c4f99c3456af075dfdc5978b68ca25d4',
    ['武曲破贞于卯地', [[layout, at(life, '卯'), star(life, '武曲'), ...seatWith(life, ['破军', '廉贞'])]]],
  ]],
  ['174001-008', ['c19f6f29e0359def309674161a761234471fb18320ef0949ea13d80866e6879c',
    ['武曲羊陀兼火宿', [[layout, star(life, '武曲'), ...seatWith(life, ['擎羊', '陀罗', '火星'])]]],
  ]],
  ['174001-011', ['7a9ed042bc9b997870efdb54b80ee9a9e69f5713ce0837a32cda63000a399ea2',
    ['廉贞杀破会迁移', [[layout, ...seatWith('迁移', ['廉贞', '七杀', '破军'])]]],
  ]],
  ['174001-013', ['03df334235bd86dbb1a7a8b00bd27030814d40cbd798c1b342938536cfce7a76',
    ['七杀廉贞同位', [station(life, '七杀', '廉贞')]],
  ]],
  ['174001-015', ['6ef34f801effa3b82520e3d3fbc29add9f1f68ca171d6ea8fb634cf05ed0e685',
    ['杀与铃火', [[layout, star(life, '七杀'), ...seatWith(life, ['铃星', '火星'])]]],
  ]],
  ['174001-018', ['9f092f0b81f1a2c34f213b10d817d6516127e8757c1ba4c66bd951bb25ebd936',
    ['擎羊火星', [station(life, '擎羊', '火星')]],
  ]],
  ['174001-019', ['72a025bb9154ca8d5804d1f08139be692430e36ecae55709f8488974ff8468d4',
    ['左右贞羊', [[layout, star(life, '廉贞'), ...seatWith(life, ['左辅', '右弼', '擎羊'])]]],
  ]],
  ['102010-001', ['28b21423e9594e62cafd3be0878f9f2e2f14e54c79310082d2dbb51435e35c03',
    ['紫微辅弼同宫一呼百诺居上品', [station(life, '紫微', '左辅', '右弼')]],
  ]],
  ['102010-002', ['f6b91a55476db9f4b1c445c6f932ec1c1b62392eb6bb72cd636d62f33f997cf6',
    [null, [station('财帛', '紫微', '左辅', '右弼')]],
  ]],
  ['109009-002', ['e1763ad7a0337a8130855112e368855f229bdc26ce33ffd695c0c5af88530632',
    [null, [...'巳亥申'].map(branch => [at(life, branch), ...station(life, '天梁', '天马')])],
  ]],
  ['113002-001', ['c743cf444f84a500dc5cf316e5acae45ae9a17a088caa194665b7574d7536c4f',
    ['机梁守命，加吉曜，富贵慈祥', withStars(life, literaryAssistants, '天机', '天梁'),
      [star(life, '擎羊'), star(life, '天刑'), change(life, '忌')]],
  ]],
  ['117003-001', ['b39668b3263bfb91627844dce42cceb07275b98efc617886388db33619815423',
    ['太阴同文曲于妻宫蟾宫折桂', [station('夫妻', '太阴', '文曲')]],
    ['文昌同亦然', [station('夫妻', '太阴', '文昌')]],
  ]],
  ['117003-002', ['d3dc0f15506c70f60a22bdc397596b2a3dcbeb01d33e5bcba042ee14eaa960b2',
    [null, literaryMoonInLifeOrBody],
  ]],
  ['125003-001', ['1dbbfcb2a2862be38cfd3904bb1ac7ac88c09ff4678a758d328acda987e87276',
    ['昌曲巳亥临不贵即当大富', ['文昌', '文曲'].map((literary, index, stars) => [at(life, '巳'), at('官禄', '酉'), star(life, literary), star('官禄', stars[1-index]), relation(life, '官禄', 'trine')])],
  ]],
  ['127005-002', ['862b747476ece664efc2325668be5e632900c81bea96e6d795334489df8d2b5c',
    [null, [station(life, '武曲', '破军')]],
  ]],
  ['127009-001', ['dd89be9aa50ef54636b8f80e82391d867cebfad9bef23cc3c8c3ca1459f5c496',
    [null, wealthOrEstate.map(palace => station(palace, '武曲', '贪狼')), withoutEmptyStars],
  ]],
  ['127009-002', ['48fd9661687658c5b39bfe2120c44ead33be30297e808276537ec46a04a19b67',
    [null, withStars(life, ['擎羊', '火星', '铃星'], '武曲', '贪狼').map(facts => [...facts, change(life, '忌')])],
  ]],
  ['129003-001', ['327bb0ca930c0f3a763d953c9fd107f67a67bf13623a648502ce76170b31a4b0',
    [null, malefics.map(name => [...station(life, '贪狼'), sectorStar(life, name), { kind: 'palace_sector_benefic_count', palace: life, count: 0 }]), [life, '迁移', '财帛', '官禄'].flatMap(palace => [star(palace, '禄存'), ...[...'禄权科'].map(mark => change(palace, mark))])],
  ]],
  ['129003-004', ['996f0ce8207be865777ec3efedac7e62d49aa95cd62a739e8ea1041cf410b52f',
    ['贪狠巳亥加杀不为屠户亦遭刑', [...'巳亥'].flatMap(branch => withStars(life, ['陀罗', '火星', '铃星'], '贪狼').map(facts => [...facts, at(life, branch)]))],
  ]],
  ['131001-002', ['9d63029f6028c69194b0aafb6f1ac467a5e490e97a088920e898fe7ba3266ec0',
    ['廉贞卯酉宫加杀公胥无面官人', [...'卯酉'].flatMap(branch => withStars(life, ['擎羊', '火星', '铃星'], '廉贞').map(facts => [...facts, at(life, branch)]))],
  ]],
  ['133005-001', ['aac504ea9f15e5b1be9775a4ba10f3a71e7c6e62739382dda35e5f521354ebb5',
    [null, [[at(life, '申'), ...station(life, '巨门', '太阳')]]],
  ]],
  ['133005-004', ['bda7db5ed5418645a6d7427e8cb039fa62c6669591cbd1c9f5203f6fd846da70',
    ['巨日拱照亦为奇', [sunAndGiantTrine(life, '官禄'), sunAndGiantTrine('财帛', life)]],
  ]],
  ['137004-001', ['55dba7f5ae28f9d777b80ac55bbc56661f86646d35522cb26d6b6be516d1306e',
    ['破军火铃奔波劳碌', ['火星', '铃星'].map((same, index, stars) => [
      ...station(life, '破军', same), sectorStar(life, stars[1 - index]),
    ])],
  ]],
  ['139005-001', ['287a2e14f5aa907e6948cf6906664678bdeb8c63fd40e017fee6f3647b5c8203',
    ['擎羊逢力士李广难封', ['甲卯', '丙午', '庚酉', '壬子'].map(([stem, branch]) => [yearStem(stem), at(life, branch), star(life, '擎羊'), { kind: 'palace_boshi_star', palace: life, star: '力士' }]), [...support.map(name => star(life, name)), ...malefics.filter(name => name !== '擎羊').map(name => star(life, name))]],
  ]],
  ['139001-002', ['33c906cd0cb3cec6951102707f89ae84bbed0200628519817ff192c28ae43dd4',
    ['辰戍人佳', [...'辰戌'].map(branch => [yearBranch(branch), ...station(life, '擎羊', '火星')])],
    ['丑未次之。', [...'丑未'].map(branch => [yearBranch(branch), ...station(life, '擎羊', '火星')])],
  ]],
  ['152002-001', ['c6b397adbfa97423f44d3521e4aa317040007252ac01ae19713611c839dcc150',
    ['右弼左辅终身福厚', [life, '迁移'].map(palace => station(palace, '左辅', '右弼'))],
    ['三方次之。', ['财帛', '官禄'].flatMap(left => ['财帛', '官禄'].map(right => [star(left, '左辅'), star(right, '右弼'), relation(life, left, 'trine'), ...(left === right ? [] : [relation(life, right, 'trine')])]))],
  ]],
  ['154001-001', ['c14216a7e9d83720d03a7690ce560734b7fe68961ea7208fb7af7697b0ceba01',
    ['禄存守于财宅积玉堆金', wealthOrEstate.map(palace => station(palace, '禄存'))],
  ]],
  ['156002-002', ['299bb715595d0335f9ff0fc7f8afd49fe35d4a043aedbf4be69758c60ab72366',
    [null, withStars(life, ['旬空', '截路', '空亡'], '天马')],
  ]],
  ['158009-001', ['6085af0d7ae7aa36eac980d5d24cc9631c5052d21720b81a8ccf54d88cbb8378',
    [null, wealthOrVirtue.map(powerAndFortune)],
  ]],
  ['158009-002', ['0f33160bc2b2cebeacf1049d5653dff992538ee200783ba98153fe06d540b04e',
    [null, support.filter(name => name !== '天魁').map(name => [...powerAndFortune('仆役'), star('仆役', name)])],
  ]],
  ['170000-001', ['1197f0b053eeefdbc13d5fca1f577f9d2f61a640259462038d54cf7cc1edec11',
    ['日月夹财加吉曜不贵则富', support.filter(name => name !== '天魁').map(name => [at('财帛', '未'), at('子女', '申'), at('疾厄', '午'), ...station('财帛', '天府', name), star('子女', '太阴'), star('疾厄', '太阳'), relation('财帛', '子女', 'adjacent'), relation('财帛', '疾厄', 'adjacent')])],
  ]],
  ['172003-002', ['486e16f93db09f4d59c65c7e528e7331f8ccc979a6161f4a10dcd051f70a26a9',
    ['武曲贪狼财宅横发资财', wealthOrEstate.map(palace => station(palace, '武曲', '贪狼')),
      withoutEmptyStars],
  ]],
  ['174000-001', ['377f55399b64bc4bcc6471a92cc2fec170a538ddb914bdf40f914dd382c76554',
    [null, wealthOrVirtue.map(powerAndFortune)],
  ]],
  ['174001-005', ['163e5d70a29d81772a40cad2132153ff2a24597304ec75cbf50decee6bf7a104',
    [null, [[...station(life, '左辅', '文昌'), star('财帛', '天钺'), relation(life, '财帛', 'trine')]],
      [...malefics, '地空', '地劫'].map(name => star(life, name))],
  ]],
  ['174001-020', ['f8b9397f636f5fe857a60f7f2d28b1c5f82b6044b4e1e740f4284fdee070c0e8',
    [null, [[star(life, '禄存'), change(life, '禄')]]],
  ]],
  ['107002-001', ['8167b3b2665ed55b9d1dec0c83155909aa8981887b21d9da1248855b1ced22fe',
    [null, ['己子', '甲午', '庚辰'].map(([stem, branch]) => femaleLifeAt(branch, yearStem(stem), '天相'))],
  ]],
  ['107002-002', ['800900347f6084bc72f886dc93075bcede618efb6674c55bb2bc7932fcab668f',
    ['子宫癸生人', [femaleLifeAt('子', yearStem('癸'), '天相', '右弼')]],
    ['寅宫癸己生人', [...'癸己'].map(stem => femaleLifeAt('寅', yearStem(stem), '天相', '右弼'))],
    ['申宫甲庚癸生人，俱是贵格', [...'甲庚癸'].map(stem => femaleLifeAt('申', yearStem(stem), '天相', '右弼'))],
  ]],
  ['111005-001', ['28840643063dd8105e6ad0d385ee62c51b1bc00810483ef5732b953f66636e72',
    ['子生人命坐寅', [femaleLifeAt('寅', yearBranch('子'), '天同')]],
    ['辛人命卯', [femaleLifeAt('卯', yearStem('辛'), '天同')]],
    ['丁人命戌入格', [femaleLifeAt('戌', yearStem('丁'), '天同')]],
    ['丙辛人命中吉', [...'丙辛'].map(stem => [female, yearStem(stem), star(life, '天同')])],
  ]],
  ['113003-002', ['c1835569a090fadea0ef0a791b2cc8bb30661d71db8aa34804a47babd64ae247',
    ['机同单守命身，又逢空亡。', ['天机', '天同'].flatMap(name => bodyPalaces.flatMap(palace =>
      ['旬空', '截路', '空亡'].map(empty => [
        ...(palace === life ? [] : [namedBodyPalace(palace)]), ...station(palace, name, empty),
        { kind: 'palace_main_count', palace, count: 1 },
      ])))],
  ]],
  ['129003-002', ['fdf8d01c75bfced52dfab851064ec462aa0ecf19c70ec1d1b024189c40b6c03f',
    [null, ['子申子辰', '午寅午戌', '卯亥卯未', '酉巳酉丑'].flatMap(([branch, ...years]) =>
      years.map(year => [at(life, branch), yearBranch(year), star(life, '贪狼')]))],
  ]],
  ['129017-002', ['eff1c34a170ab64013b63e856aa6e9c327ff67ee955ef3e0e8679daac946cd5a',
    ['在亥子，遇羊陀嫉妒之流。', [['亥', '陀罗'], ['子', '擎羊']].map(([branch, name]) =>
      [female, at(life, branch), ...station(life, '贪狼', name)])],
  ]],
  ['144000-002', ['6861b3a06c2a39ff8b6caa98938057607a7329bae29777db9c710d3601085d11',
    ['惟夹忌', [[...flankLife('铃星', '火星'), change(life, '忌')]]],
  ]],
  ['154001-002', ['7434c1ff8886a723db01c71bc2cf97095d80e23b6de8c2884f0a21f837d07196',
    [null, [...'子午'].flatMap(branch => bodyPalaces.map(palace => [at(palace, branch), star(palace, '禄存'),
      ...([life, '迁移'].includes(palace) ? [] : [namedBodyPalace(palace)])]))],
  ]],
  ['160000-002', ['2d7840b2f2a24d03c4b06a927180b6c8dc35e7b872a48642952d807757061025',
    [null, wealthOrVirtue.map(palace => station(palace, '地劫', '天空'))],
  ]],
  ['164001-002', ['0e1fc609ddc783fd3835919e2631ca4e2b029563f04f7e9a9a6a3c67d343f8c2',
    ['命无正曜二姓延生', [[{ kind: 'palace_main_count', palace: life, count: 0 }]]],
  ]],
  ['170000-002', ['56b948b7d7f24a508a3e932bc560fe787b2202f44e651ac63a476e2ea65ed7f1',
    ['如左右同财帛宫', [station('财帛', '左辅', '右弼')]],
  ]],
  ['172001-002', ['6661c9e098efc4f88631335053aa1d6ba105aed523877fa348b589ff835be08c',
    [null, withStars('财帛', ['武曲', '太阴'])],
  ]],
  ['174001-009', ['e1e635b988e087339a3913aaa1ce3cb84eb1576f6e0e06c2f0ea14b5bc85d15b',
    ['贪狠入庙寿元长', [...'辰戌丑未'].map(branch => [at(life, branch), star(life, '贪狼')])],
  ]],
  ['174001-016', ['f9a96bdcf69b6b40c2984dafb8e5c8bf6c669a99a9aa718a4fba8b7f61250c0a',
    [null, bodyPalaces.map(palace => [namedBodyPalace(palace), star(palace, '七杀')])],
  ]],
]);

export function compileQuanshuTongyuan(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [hash, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== hash || passages.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微斗数全书》同垣篇所据原文、出处或条件已变，须重新核对。' };
  }
  const branches = passages.map(([text, groups, mustBeAbsent]) => ({
    text, conditionCompiler: quanshuTongyuanProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? {
      required: group, mustBeAbsent: typeof mustBeAbsent === 'function' ? mustBeAbsent(group) : mustBeAbsent,
    } : group)),
  }));
  if (!branches[0].text) return { compiler: quanshuTongyuanProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '按《紫微斗数全书》同垣篇已核分句匹配', branches };
}
