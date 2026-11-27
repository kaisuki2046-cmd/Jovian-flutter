import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueSamePalaceProfile = 'ziwei-xingjue-same-palace-v1';
const prefix = 'ziwei-v1-xingjue-044-p';
const life = '命宫';
const travel = '迁移';
const career = '官禄';
const wealth = '财帛';
const estate = '田宅';
const fortune = '福德';
const bodySeats = ['夫妻', wealth, travel, career, fortune];
const palaces = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
const benefics = '左辅 右弼 文昌 文曲 天魁 天钺 禄存'.split(' ');
const malefics = '擎羊 陀罗 火星 铃星'.split(' ');
const female = { kind: 'natal_gender', gender: '女' };
const yearStem = stem => ({ kind: 'natal_year_stem', stem });
const yearBranch = branch => ({ kind: 'natal_year_branch', branch });
const branchAt = (palace, branch) => ({ kind: 'palace_branch', palace, branch });
const same = (palace, ...stars) => stars.map(star => ({ kind: 'palace_star', palace, star, scope: 'origin' }));
const inBranch = (palace, branch, ...stars) => [branchAt(palace, branch), ...same(palace, ...stars)];
const sector = (palace, ...stars) => stars.map(star => ({ kind: 'palace_sector_star', palace, star }));
const relate = (anchor, target, relation) => ({ kind: 'palace_relation', anchor, target, relation });
const bodyAt = palace => ({ kind: 'palace_confirmed_body_seat', palace });
const sectorChange = (palace, change) => ({ kind: 'palace_sector_mutagen', palace, change });
const localChange = (palace, change) => [sectorChange(palace, change), { kind: 'palace_mutagen', palace, change, scope: 'origin' }];
const starChange = (palace, star, change) => ({ kind: 'star_mutagen', palace, star, change, scope: 'origin' });
const changePair = palace => [sectorChange(palace, '权'), sectorChange(palace, '禄')];
const threeChanges = palace => [...changePair(palace), sectorChange(palace, '科')];
const noMalefics = palace => ({ kind: 'palace_sector_six_malefic_count', palace, count: 0 });
const someFrom = (palace, choices) => choices.map(star => sector(palace, star));
const withGood = (palace, required) => ({ required, anyOf: someFrom(palace, benefics) });
const noGoodAtLife = required => ({
  required: [...required, { kind: 'palace_sector_benefic_count', palace: life, count: 0 }],
  mustBeAbsent: [life, wealth, career, travel].flatMap(palace => same(palace, '禄存')),
});
function atLifeOrBody(conditions, confirmedSeats = bodySeats) {
  return [conditions(life), ...confirmedSeats.map(palace => [bodyAt(palace), ...conditions(palace)])];
}
function flank(palace, first, second) {
  const order = palaces.indexOf(palace);
  const previous = palaces[(order + palaces.length - 1) % palaces.length], next = palaces[(order + 1) % palaces.length];
  return [relate(palace, previous, 'adjacent'), relate(palace, next, 'adjacent'), ...same(previous, first), ...same(next, second)];
}
const mansionPair = (sunBranch, moonBranch) => palaces.map((palace, index) => {
  const opposite = palaces[(index + 6) % palaces.length];
  return [...inBranch(palace, sunBranch, '太阳'), relate(palace, opposite, 'opposite'), ...inBranch(opposite, moonBranch, '太阴')];
});

const fourBirths = '寅申巳亥';
const goodHuoBranches = '寅午戌';
const goodLingBranches = '寅卯午戌';
const trineStar = (palace, star) => ({ kind: 'palace_trine_star', palace, star });
const noOpposingHarms = palace => {
  const opposite = palaces[(palaces.indexOf(palace) + 6) % palaces.length];
  return { required: [relate(palace, opposite, 'opposite')],
    mustBeAbsent: same(opposite, ...malefics, '地空', '地劫', '天刑') };
};
const assistAt = (palace, a, b) => ({
  required: [relate(life, palace, 'trine'), ...same(life, a), ...same(palace, b)],
  mustBeAbsent: same(travel, a, b),
});
const intercept = [...'甲乙丙丁戊己庚辛壬癸'].map((stem, index) => [yearStem(stem), '申午辰寅子'[index % 5]]);
const relatedSeats = palace => {
  const index = palaces.indexOf(palace);
  return [4, 6, 8].map(offset => [palaces[(index + offset) % palaces.length], offset === 6 ? 'opposite' : 'trine']);
};

// Qing manuscript, pp. 60–68. Keep common seats, external configurations
// and independent clauses separate where the text calls for them.
const reviewed = new Map([
  ['171-001', ['16d3f24fc2cad818a78e3096d8f27caeec10f90ca71a0e9d1a4720eb30131d69',
    ["輔弼同宮一呼百諾居上品", [life, wealth].map(palace => same(palace, '紫微', '左辅', '右弼'))],
  ]],
  ['172-001', ['93d9f20f410b09cd3a2db327ee7225566a628407bea4dbb1c859d76cc858cfe1',
    [null, [noGoodAtLife(same(life, '紫微', '破军'))]],
  ]],
  ['173-001', ['36888e7afcfcef5b407aab6d29c818c2296f0d5f362ad78d10bf865b44ddd364',
    ["府相朝垣千鍾食祿", [...'寅申'].map(branch => [
      branchAt(life, branch), relate(life, career, 'trine'), relate(life, wealth, 'trine'),
      ...same(career, '天府'), ...same(wealth, '天相'),
    ])],
  ]],
  ['174-001', ['c8310086dd04fb3c945bff3f6124f50d96671d7cd0de3abcd08e1498de7acdd4',
    ["天府昌曲左右、高第息榮。", atLifeOrBody(palace => [
      ...same(palace, '天府'), ...sector(palace, '文昌', '文曲', '左辅', '右弼'),
    ], [wealth, career])],
  ]],
  ['175-001', ['d332eec853676b84c5dd954982240036283155fc125e9d4a9435b0003624d1fc',
    ["女命天同", [
      [...inBranch(life, '寅', '天同'), female, yearBranch('子')],
      [...inBranch(life, '卯', '天同'), female, yearStem('辛')],
      [...inBranch(life, '戌', '天同'), female, yearStem('丁')],
    ]],
  ]],
  ['176-001', ['32b0819a8dcb0ed27e015bc4ba2cdcb1e859a200c66f3a6815a89a4c55cce592',
    ["機梁守命加吉曜、富貴慈詳", [withGood(life, same(life, '天机', '天梁'))]],
    ["加刑忌僧道", [[...same(life, '天机', '天梁'), ...sector(life, '天刑'), sectorChange(life, '忌')]]],
  ]],
  ['177-001', ['b5432ca67abcbfadc7b81c8c04a349ebd87a29066221563238ab856193d5d61f',
    [null, [...'午辰卯'].map(branch => [
      ...inBranch(life, branch, '太阳'), { kind: 'natal_daylight', sect: 'day' },
    ])],
  ]],
  ['178-001', ['e7e27bb99cf5cfa47ddb3744592e8a48f23482d6c7d77e6fdf39cc8ed14132a5',
    [null, [[branchAt(life, '丑'), relate(life, travel, 'opposite'), ...inBranch(travel, '未', '太阳', '太阴')]]],
  ]],
  ['179-001', ['84b97bd862a1060f0da89677b9a3a99ea2fda2731189779e299dafd9547c2105',
    ["命身居丑未三方無吉反為凶", [noGoodAtLife([bodyAt(life), ...inBranch(life, '丑', '太阳', '太阴')])]],
  ]],
  ['180-001', ['ad0e6085c329456ab2fcbf84a340efdb46aa809c6970db7903c0f7d7292da9fc',
    ["天同會吉壽元長", [...'卯巳亥子申'].map(branch => withGood(life, inBranch(life, branch, '天同')))],
  ]],
  ['183-001', ['0a840fcf05ea86ab64fb96d00248f8e81d71f4b29ac96d7f1b8648d658be1ea1',
    ["日月夾命夾財", [life, wealth].map(palace => withGood(palace, [
      branchAt(palace, '丑'), ...flank(palace, '太阳', '太阴'),
    ]))],
  ]],
  ['184-001', ['040f81a646c0804b3dc1415dffa979a3ad0b0b384f6e5eeb6639f245e86923a1',
    ["日月羊陀多剋親", [[...sector(life, '太阳', '太阴', '擎羊', '陀罗')]]],
  ]],
  ['186-001', ['08d4f4fb9e42c89ab42db8ab0d4646f6ffb66b8610f813c87bbc44032d0d4622',
    ["文昌武曲為人多學多能", atLifeOrBody(palace => same(palace, '文昌', '武曲'))],
  ]],
  ['189-001', ['80d48418a08e7e6941ae7f9caa4cc8ecdce6f98fbfa970976c7a4b501ea18eb1',
    ["女人昌曲聰明", [[...same(life, '文昌', '文曲'), female]]],
  ]],
  ['190-001', ['03e2e85fc60411fa3eed05ef81e722759ab9938737a5e4e1690292971acc7b30',
    ["武曲祿馬交馳發財遠郡", [[...same(life, '武曲'), ...sector(life, '禄存', '天马')]]],
  ]],
  ['191-001', ['ccd04d3e3e0361b589f016b3834032e955364a4ae339ec97e1acaf4e9992118d',
    [null, [wealth, estate].map(palace => same(palace, '武曲', '贪狼'))],
  ]],
  ['192-001', ['b6b809dde3465d53e3ae20e21f114a13138e128c1e8b2fb8ea4c22a169e2e4f1',
    ["武曲貪狼加殺忌技藝之人", [life, wealth, estate].map(palace => ({
      required: [...same(palace, '武曲', '贪狼'), ...localChange(palace, '忌')],
      anyOf: someFrom(palace, malefics),
    }))],
  ]],
  ['193-001', ['fe06b724658937cd63143be5199b7bf63fac77e5aa0cc87a0fdfd5bb03d71c1e',
    ["武曲破軍破祖破家勞碌", atLifeOrBody(palace => same(palace, '武曲', '破军'))],
  ]],
  ['194-001', ['78db56ebdddde6cf2733cdd3ce429954ec5415099aa20024235872599a8d1938',
    ["貪狼遇鈴火四墓宮、豪富家資", [...'辰戌丑未'].map(branch => ({
      required: inBranch(life, branch, '贪狼'),
      anyOf: ['火星', '铃星'].flatMap(fire => benefics.map(good => [...same(life, fire), ...sector(life, good)])),
    }))],
  ]],
  ['197-001', ['e5493def3ecdccf0bffbae862db2f7f5957418027eccd9870586334ad59c7f82',
    ["廉貞申未宮無殺富貴", [...'申未'].map(branch => [...inBranch(life, branch, '廉贞'), noMalefics(life)])],
  ]],
  ['198-001', ['97f0d961c20e1bb7e2c89b4eed86a13ace0ff06d7859235943c8b317d0374fc7',
    ["廉貞入廟會將軍", [...'寅申'].map(branch => [...inBranch(life, branch, '廉贞'), { kind: 'palace_boshi_star', palace: life, star: '将军' }])],
  ]],
  ['201-001', ['cf0f308e8d84461893b1f58755d0d1afccfcf4685ea48dd9944c8156a0f1006c',
    ["廉貞羊殺居官祿、枷杻難逃", [[...same(career, '廉贞', '擎羊'), ...sector(career, '七杀')]]],
  ]],
  ['202-001', ['2678fac18de789cd8df2b260b493ec28ecf3b88b6ea0c94e2611b0656cb3512a',
    ["石中隱玉", [...'子午'].map(branch => [
      ...inBranch(life, branch, '巨门'), yearStem('辛'), ...threeChanges(life),
    ])],
  ]],
  ['204-001', ['098ea03aebd28f8e374448a2ab5988bf0c161fcd915c74855f45e97b73d591f4',
    ["巨門辰宮化忌", [[...inBranch(life, '辰', '巨门'), starChange(life, '巨门', '忌'), sectorChange(life, '忌')]]],
  ]],
  ['205-001', ['f049086c73e7862b833967e7413eb66cc8e69634fb9886d0e8870f9907350647',
    ["七殺寅申子午一生爵祿榮昌", [...'寅申子午'].map(branch => inBranch(life, branch, '七杀'))],
  ]],
  ['207-001', ['a4e370ad7f794ff638decd9f9fd0d71d33bf471bced4cd4963a6bbb7445ab854',
    ["殺臨絕地會羊陀", [[...same(life, '七杀'), { kind: 'palace_changsheng_phase', palace: life, phase: '绝' }, ...sector(life, '擎羊', '陀罗')]]],
  ]],
  ['1017-001', ['da23aea6edbc474053b60cf939e6b0dcbbecdf938360f98b02354628f290b900',
    [null, [...'寅申'].map(branch => [...inBranch(life, branch, '紫微', '天府'), yearStem('甲'), noMalefics(life)])],
  ]],
  ['1018-001', ['d7a191adfe40cc360c99c9537e6a3d15214d5313c53b413bc733b9d926777cd5',
    ["紫府權祿遇羊陀、雖獲吉而無道為人心術不正", [[
      ...same(life, '紫微'), ...changePair(life), ...sector(life, '天府', '擎羊', '陀罗'),
    ]]],
  ]],
  ['1019-001', ['b8b9460b9936dae784e6a3b9ec26c8e908a289b3b09f18b65f9ee44e25202783',
    [null, [...'丑未'].map(branch => withGood(life, inBranch(life, branch, '紫微', '破军')))],
  ]],
  ['1020-001', ['50b33e3cd3144276e398bea68a14fc67ce9d7862cd965074a9a5affc064463f3',
    ["有左右祿存亦美", [wealth, estate].map(palace => [
      ...same(palace, '天府', '武曲'), ...sector(palace, '左辅', '右弼', '禄存'),
    ])],
  ]],
  ['1021-001', ['ea1c8bf09080ae0afbc9726125bb4dc7d6cb7cb5fe7cbd6631e2e78cf9c429ec',
    [null, [['己', '子'], ['甲', '午'], ['庚', '辰']].map(([stem, branch]) =>
      [...inBranch(life, branch, '天相'), female, yearStem(stem)])],
  ]],
  ['1022-001', ['335bf719d4f6a1d90d7a50604e5241f1615569300471c344af37ea633b43e53b',
    ["天梁天馬、為人飄蕩風流", atLifeOrBody(palace => same(palace, '天梁', '天马'))],
  ]],
  ['1023-001', ['e7da0406c64b937cdc1a8cc492773a90e6c9ec7583c2fca775017f9a65a442ab',
    ["天梁加吉坐遷移、巨商高賈", [withGood(travel, same(travel, '天梁'))]],
    ["加刑忌平常", [[...same(travel, '天梁', '天刑'), ...localChange(travel, '忌')]]],
  ]],
  ['1025-001', ['9be8d556afdb4745febec4cc4d84509b60f0da803304f60e6ac989400890eba2',
    ["太陽居午、庚辛丁已人富貴雙全", [...'庚辛丁己'].map(stem => [...inBranch(life, '午', '太阳'), yearStem(stem)])],
  ]],
  ['1026-001', ['4a039a4fdc27f9c995d8f7bcd4f514ba782ee550b235dd7fbcfff78daa7f2a6a',
    [null, [...'未申'].map(branch => inBranch(life, branch, '太阳'))],
  ]],
  ['1028-001', ['5c67c5c9e726dcf3c77fd75b18e93b74e21f380a2e59bec4b73a7bea3e1816fb',
    ["日戌月辰", mansionPair('戌', '辰')],
  ]],
  ['1031-001', ['9e6deb90f7646afbf7ae7de2218c6fbfb0516dd25500824998f333212c31f2fe',
    ["武破相遇昌曲、聰明巧藝定無窮", atLifeOrBody(palace => [
      ...same(palace, '武曲', '破军'), ...sector(palace, '文昌', '文曲'),
    ], ['夫妻', travel, fortune])],
    ["武曲或與天相同垣逢昌曲", atLifeOrBody(palace => [
      ...same(palace, '武曲', '天相'), ...sector(palace, '文昌', '文曲'),
    ], [wealth, career])],
  ]],
  ['1033-001', ['1b7a9d3239cd70115a56e1e455fbbe6913a5b78f3d64c665ef2f27f46c8ad91a',
    ["武曲遷移、巨商高賈", [[...same(travel, '武曲'), ...sector(travel, '文昌', '文曲', '左辅', '右弼')]]],
  ]],
  ['1034-001', ['6371231e631e41613c7bd16b8acdefbd04f7799f0a8037bcd3087f38de87981b',
    ["貪狼會殺無吉曜、屠宰之人", [{ ...noGoodAtLife(same(life, '贪狼')), anyOf: someFrom(life, malefics) }]],
  ]],
  ['1035-001', ['68d367592a6f7ecbb3264c8a100bc5b0662fa3b1685bd17d039c42cdc001dc2e',
    ["貪遇羊陀居亥子、名為泛水桃花", [...'亥子'].map(branch =>
      [...inBranch(life, branch, '贪狼'), ...sector(life, '擎羊', '陀罗')])],
  ]],
  ['1037-001', ['70ea002780488d277c5115c6485f44309366884e60fd7c74d98bdee10122eaf8',
    ["巨機酉上化吉者、縱有財官也不終", [{
      required: inBranch(life, '酉', '巨门', '天机'),
      anyOf: ['禄', '权', '科'].map(change => localChange(life, change)),
    }]],
  ]],
  ['1038-001', ['23a1a43953b59b67ee8afcc045936a4994aa729d0badfe7ad849981728f4c048',
    ["破軍子午宮無殺、官資清顯至三公甲癸生人合格", [...'子午'].flatMap(branch => [...'甲癸'].map(stem =>
      [...inBranch(life, branch, '破军'), yearStem(stem), noMalefics(life)]))],
  ]],
  ['1039-001', ['36d3b5913eec099f95bee697406b7d62934e28c78ddd30d8243867809841f1dc',
    ["破軍火鈴、奔波勞碌", atLifeOrBody(palace => [
      ...same(palace, '破军'), ...sector(palace, '火星', '铃星'),
    ])],
  ]],
  ['181-001', ['3ed2dde78eb57ab017ef443b654954ea1513e0ebf0846d1a33c5dc8ff7df03c2',
    ["寅申位一生吏業聰明", [...'寅申'].map(branch => noGoodAtLife([
      ...inBranch(life, branch, '天同', '天梁'), ...sector(life, '天机', '太阴'),
    ]))],
  ]],
  ['185-001', ['3aeddfe76d49b93641f588a1283a8e50ab81c8ccd346c02dc62f51f9f275f107',
    ["逢惡殺勞碌奔波", [
      ['戌', '太阳', travel, '辰', '太阴', 'opposite'],
      ['辰', '太阴', travel, '戌', '太阳', 'opposite'],
      ['亥', '太阳', career, '卯', '太阴', 'trine'],
      ['卯', '太阴', wealth, '亥', '太阳', 'trine'],
    ].map(([branch, star, target, outerBranch, outerStar, relation]) => ({
      required: [...inBranch(life, branch, star), relate(life, target, relation), ...inBranch(target, outerBranch, outerStar)],
      anyOf: someFrom(life, malefics),
    }))],
  ]],
  ['187-001', ['15ebb98a83ed72325219ec42fb3346c1f2433258bfff762fb3d018d750855828',
    ["逢左右將相之材", [[
      bodyAt(career), ...inBranch(career, '辰', '武曲'), ...inBranch(life, '子', '文曲'),
      relate(career, life, 'trine'), ...sector(career, '左辅', '右弼'),
    ]]],
  ]],
  ['199-001', ['f071571b25bd7b08bfe8c309e19f25f41727d968d39c0d0039e846e6453fee71',
    ["廉貞四殺遭刑戮", [noGoodAtLife([...same(life, '廉贞'), ...sector(life, ...malefics)])]],
  ]],
  ['200-001', ['88a69e00aaeb17c1ce6b5539f0661fe31644a5e0c93b50e6063744f7cebff2fb',
    ["廉貞貪殺居巳亥流蕩天涯", [...'巳亥'].map(branch => [...inBranch(life, branch, '廉贞', '贪狼'), trineStar(life, '七杀')])],
  ]],
  ['203-001', ['ed676da1bd7a42186d889dcec55fcc3b5f6d61c55751194687561da781d2ad3a',
    ["巨機居卯、辛己巳丙至公卿不貴即富", [...'辛己丙'].map(stem => [...inBranch(life, '卯', '巨门', '天机'), yearStem(stem)])],
  ]],
  ['206-001', ['cc0299615149e715fd21913285a90752626a389b70b3f503af1794d8933d6564',
    ["七殺破軍宜出外", ['七杀', '破军'].flatMap((star, i, stars) => atLifeOrBody(palace =>
      [...same(palace, star), trineStar(palace, stars[1 - i])]))],
  ]],
  ['208-001', ['1d3e78eb6ebdcecc9ded0094c472048219f663ff73c27b42f7f21131d556a152',
    ["鈴火守身命", [wealth, career].map(palace => ({
      required: [bodyAt(palace), ...sector(life, '擎羊', '陀罗')],
      anyOf: [[...same(life, '铃星'), ...same(palace, '火星')], [...same(life, '火星'), ...same(palace, '铃星')]],
    }))],
  ]],
  ['209-001', ['620dc62bad2c42b0b1b7dfd81d3287549809313a6639bd34faeeccf6c537e6f0',
    ["相遇名振諸邦", [[life, goodHuoBranches], [wealth, '午'], [career, '戌']].flatMap(([palace, branches]) =>
      [...branches].map(branch => [
        ...inBranch(palace, branch, '火星'), ...sector(palace, '铃星'), ...(palace === life ? [] : [bodyAt(palace)]),
      ]))],
  ]],
  ['210-001', ['2fe0eee563a79375b8fcfa27f2dae030924d83935602a5ba4ba08c06a6973246',
    ["火鈴旺宮亦為福論", [{
      required: [...same(life, '铃星'), ...sector(life, '火星')],
      anyOf: [...goodLingBranches].flatMap(mansion => relatedSeats(life).flatMap(([seat, relation]) =>
        [...goodHuoBranches].map(branch => [branchAt(life, mansion), relate(life, seat, relation),
          ...inBranch(seat, branch, '火星')]))),
    }]],
  ]],
  ['211-001', ['da15dbc1621bdb78bceb65e8c02df988bb6660cdf15fa6d0659d51c1be700785',
    ["擎羊火鈴為下格", [[...same(life, '擎羊'), ...sector(life, '火星', '铃星'), { kind: 'natal_gender', gender: '男' }]]],
  ]],
  ['213-001', ['e6b30e2c89d27b2c6235d8e33e6bbd41b89ced9b37b903ce47f58f45e59f4e3d',
    [null, [same(life, '左辅', '右弼')]],
  ]],
  ['214-001', ['879a68632ec86cae0d29b8d50ecfdb1d969fae84270477dda1942ae9d15970f0',
    ["祿存厚重", [life, wealth, estate, fortune].map(palace => same(palace, '禄存'))],
  ]],
  ['215-001', ['754e8f6efc4c7601374c3b2f172550813ab2ee6722a1e0d04319e3b15396dc4a',
    ["馬遇空亡終身奔走", [
      ...atLifeOrBody(palace => same(palace, '天马', '旬空')),
      ...atLifeOrBody(palace => same(palace, '天马', '截路')).map((required, index) => ({
        required,
        anyOf: intercept.map(([stem, branch]) => [stem, branchAt([life, ...bodySeats][index], branch)]),
      })),
    ]],
  ]],
  ['216-001', ['5f47f697ffc617807db20d33cbaa17292610eb9ae33e82b55ffc2b0b85d9a154',
    ["科權祿合富貴雙全", atLifeOrBody(palace => [...threeChanges(palace), noMalefics(palace)])],
  ]],
  ['217-001', ['973ddf6e5072ffbde3d432b8d5d48f0df5ac0245b9248f4acb7532193719e1dd',
    [null, [flank(life, '地劫', '地空'), flank(life, '地空', '地劫')]],
  ]],
  ['218-001', ['b86fb1f9cabf3f5c23aeff0f4a681cd0652cdd5ab914b26686274a5158ac1012',
    ["劫空臨財福之鄉生來貧賤", [wealth, fortune].map(palace => same(palace, '地空', '地劫'))],
  ]],
  ['1032-001', ['74e89f8460d760d729796ef349c77a8798ecbab74af88fd91b4de44f2665c9f1',
    ["武曲魁鉞居廟旺、財賦之官", [...'辰戌丑未子午'].map(branch => [
      ...inBranch(life, branch, '武曲'), ...sector(life, '天魁', '天钺'),
    ])],
  ]],
  ['1036-001', ['4898b74d73a68996a7c39c0188e9eb985d21f0ba4f5cd7b7161d5eb13707a656',
    ["殺居午奇格", [inBranch(life, '午', '七杀')]],
  ]],
  ['1041-001', ['3d07ad8c3a94cf71972c16d93396d1321f65fc9ae0a08d41134379abda0495fa',
    ["魁鉞昌曲祿存扶、刑殺無沖台輔貴", [life, ...bodySeats].map(palace => {
      const { required, mustBeAbsent } = noOpposingHarms(palace);
      return { required: [...required, ...sector(palace, '天魁', '天钺', '文昌', '文曲', '禄存'),
        ...(palace === life ? [] : [bodyAt(palace)])], mustBeAbsent };
    })],
  ]],
  ['1042-001', ['75f3ec0648425f4aef7801f7ba1de3e6b1bf988e23d2688affc7d19d93164a75',
    ["左右夾命為貴格", [flank(life, '左辅', '右弼'), flank(life, '右弼', '左辅')]],
  ]],
  ['1043-001', ['f4014373b511843d2a90d693b88e0e8673415a78ab486b1f21e21ca7d345f175',
    ["右弼左輔終身福厚在命宮遷移是也", [
      same(life, '左辅', '右弼'), [...same(travel, '左辅', '右弼'), relate(life, travel, 'opposite')],
      [...same(life, '左辅'), ...same(travel, '右弼'), relate(life, travel, 'opposite')],
      [...same(life, '右弼'), ...same(travel, '左辅'), relate(life, travel, 'opposite')],
    ]],
    ["三方次之", [wealth, career].flatMap((palace, index, seats) => [
      { required: [...same(palace, '左辅', '右弼'), relate(life, palace, 'trine')] },
      assistAt(palace, '左辅', '右弼'), assistAt(palace, '右弼', '左辅'),
      { required: [...same(palace, '左辅'), ...same(seats[1 - index], '右弼'),
        relate(life, palace, 'trine'), relate(life, seats[1 - index], 'trine')] },
    ])],
  ]],
  ['1040-001', ['7aebde5bdb99e77f1e192a926d7e360da7a3daae3766df3192cbbf2df83de6d9',
    [null, [same(career, '破军', '擎羊', '铃星')]],
  ]],
  ['1044-001', ['b5590f61590781aa93b4fdcb4969ad6ef016a54ed054805ee338fe5f172a77cf',
    [null, [...fourBirths].map(branch => inBranch('夫妻', branch, '天马'))],
  ]],
]);

export function compileXingjueSamePalace(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [hash, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== hash || passages.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》诸星同位垣的原文、出处或条件有变化，须重新核对。' };
  }
  const branches = passages.map(([text, groups]) => ({
    text, conditionCompiler: xingjueSamePalaceProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group)),
  }));
  if (!branches[0].text) return { compiler: xingjueSamePalaceProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》诸星同位垣已核盘式及分句匹配', branches };
}
