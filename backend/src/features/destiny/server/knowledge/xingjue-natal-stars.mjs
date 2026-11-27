import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueNatalStarsProfile = 'ziwei-xingjue-natal-stars-v1';

const prefix = 'ziwei-v2-xingjue-';
const womenPrefix = 'ziwei-v3-xingjue-059-';
const life = '命宫', wealth = '财帛', travel = '迁移', career = '官禄', estate = '田宅', fortune = '福德';
const spouse = '夫妻';
const palaces = [life, '兄弟', '夫妻', '子女', wealth, '疾厄', travel, '仆役', career, estate, fortune, '父母'];
const otherBodySeats = ['夫妻', wealth, travel, career, fortune];
const auspicious = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存'];
const malefics = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];

const branchAt = (palace, branch) => ({ kind: 'palace_branch', palace, branch });
const same = (palace, ...stars) => stars.map(star => ({ kind: 'palace_star', palace, star, scope: 'origin' }));
const at = (palace, branch, ...stars) => [branchAt(palace, branch), ...same(palace, ...stars)];
const sector = (palace, ...stars) => stars.map(star => ({ kind: 'palace_sector_star', palace, star }));
const bright = (palace, star, brightness) => ({ kind: 'palace_brightness', palace, star, scope: 'origin', brightness });
const coreCount = (palace, count) => ({ kind: 'palace_core_star_count', palace, count });
const mainCount = (palace, count) => ({ kind: 'palace_main_count', palace, count });
const year = stem => ({ kind: 'natal_year_stem', stem });
const hour = branch => ({ kind: 'natal_ziwei_hour', branch });
const phase = (palace, phase) => ({ kind: 'palace_changsheng_phase', palace, phase });
const bureau = bureau => ({ kind: 'natal_ziwei_bureau', bureau });
const suiqian = (palace, star) => ({ kind: 'palace_suiqian_star', palace, star });
const boshi = (palace, star) => ({ kind: 'palace_boshi_star', palace, star });
const relation = (anchor, target, relation) => ({ kind: 'palace_relation', anchor, target, relation });
const sectorChange = (palace, change) => ({ kind: 'palace_sector_mutagen', palace, change });
const changeAt = (palace, change) => [sectorChange(palace, change), { kind: 'palace_mutagen', palace, change, scope: 'origin' }];
const starChange = (palace, star, change) => ({ kind: 'star_mutagen', palace, star, change, scope: 'origin' });
const all = (...facts) => ({ required: facts.flat() });
const choice = (anyOf, required = [{ kind: 'ziwei_confirmed_natal_layout' }]) => ({ required, anyOf });
const product = (...options) => options.reduce((left, right) => left.flatMap(a => right.map(b => [...a, ...b])), [[]]);
const alternateBranches = (palace, branches) => [...branches].map(branch => [branchAt(palace, branch)]);
const seat = (palace, offset) => palaces[(palaces.indexOf(palace) + offset + palaces.length) % palaces.length];

function withBody(palace, { required, ...group }) {
  return { required: [{ kind: 'palace_confirmed_body_seat', palace }, ...required], ...group };
}

function onAnchors(condition, bodySeats = otherBodySeats) {
  return [condition(life), ...bodySeats.map(palace => withBody(palace, condition(palace)))];
}

function related(palace, mode) {
  const trines = [[seat(palace, 4), 'trine'], [seat(palace, -4), 'trine']];
  if (mode === 'trine') return trines;
  const sectors = [...trines, [seat(palace, 6), 'opposite']];
  return mode === 'sector' ? sectors : [...sectors, [seat(palace, 1), 'adjacent'], [seat(palace, -1), 'adjacent']];
}

function trineChange(palace, change) {
  return related(palace, 'trine').map(([target, path]) => [relation(palace, target, path), ...changeAt(target, change)]);
}

function flanks(anchor, first, second) {
  const [left, right] = [seat(anchor, -1), seat(anchor, 1)];
  const placement = (palace, star) => [
    relation(anchor, palace, 'adjacent'),
    ...same(palace, star),
  ];
  return [[...placement(left, first), ...placement(right, second)],
    [...placement(right, first), ...placement(left, second)]];
}

function oppositeStars(firstBranch, firstStars, secondBranch, secondStars) {
  return palaces.map(first => {
    const opposite = seat(first, 6);
    return [...at(first, firstBranch, ...firstStars), relation(first, opposite, 'opposite'),
      ...at(opposite, secondBranch, ...secondStars)];
  });
}

const goodTrines = palace => auspicious.map(star => [{ kind: 'palace_trine_star', palace, star }]);
const fourMalefics = malefics.slice(0, 4);
const trineStar = (palace, star) => ({ kind: 'palace_trine_star', palace, star });

// The Sun and Moon chapter calls Mao Sun ascending and Hai Moon exalted.
// In the current layout they can both trine a Wei palace from separate seats.
function brightTrines(anchor) {
  const sun = seat(anchor, 4), moon = seat(anchor, -4);
  return [branchAt(anchor, '未'), relation(anchor, sun, 'trine'), ...at(sun, '卯', '太阳'),
    relation(anchor, moon, 'trine'), ...at(moon, '亥', '太阴')];
}

function brightLights(anchor) {
  const sun = seat(anchor, -1), moon = seat(anchor, 1);
  return [
    brightTrines(anchor),
    [branchAt(anchor, '丑'), relation(anchor, sun, 'adjacent'), ...at(sun, '寅', '太阳'),
      relation(anchor, moon, 'adjacent'), ...at(moon, '子', '太阴')],
  ];
}

function opposedLights(anchor) {
  const target = seat(anchor, 6);
  return [
    [...at(anchor, '戌', '太阳'), relation(anchor, target, 'opposite'), ...at(target, '辰', '太阴')],
    [...at(anchor, '辰', '太阴'), relation(anchor, target, 'opposite'), ...at(target, '戌', '太阳')],
  ];
}

const voidStars = ['天空', '地空', '旬空', '截路'];
const lightsWithVoid = ['太阳', '太阴'].flatMap(star => voidStars.map(voidStar => same(life, star, voidStar)));
const litWithoutBenefics = {
  required: brightTrines(life),
  mustBeAbsent: [life, ...related(life, 'sector').map(([target]) => target)]
    .flatMap(palace => same(palace, '紫微', '天府', ...auspicious)),
};
const eastMoonGrowth = choice(product(alternateBranches(life, '寅辰'),
  ['长生', '帝旺'].map(value => [phase(life, value)])), same(life, '太阴'));
const pairTrineBenefics = auspicious.flatMap((first, index) =>
  auspicious.slice(index + 1).map(second => [trineStar(life, first), trineStar(life, second)]));

const purpleOrTreasury = ['紫微', '天府'].map(star => same(life, star));
const pairedNoblesAndAssistants = ['左辅', '右弼', '天魁', '天钺'];
const sectorMalefics = (palace, count) => ({ kind: 'palace_sector_six_malefic_count', palace, count });
const absentInSector = (anchor, stars) => [anchor, ...related(anchor, 'sector').map(([target]) => target)]
  .flatMap(palace => same(palace, ...stars));
const pairedLifeBody = (lifeStar, bodyStar, additional = () => []) => otherBodySeats.map(palace => [
  ...same(life, lifeStar), ...same(palace, bodyStar), { kind: 'palace_confirmed_body_seat', palace },
  ...additional(palace),
]);
const xuTreasuryAndWuBodyPurple = [
  ...at(life, '戌', '天府'), ...at(wealth, '午', '紫微'),
  { kind: 'palace_confirmed_body_seat', palace: wealth },
];
const xuTreasury = at(life, '戌', '天府');
const auspiciousTreasurySupport = product(pairedNoblesAndAssistants.map(star => sector(life, star)),
  ['科', '禄'].map(change => [sectorChange(life, change)]));
const outsideLifeSector = palaces.filter(palace => ![life, wealth, travel, career].includes(palace));
const xuTreasuryWithoutSameMalefics = stems => ({
  ...choice(product([...stems].map(stem => [year(stem)]), auspiciousTreasurySupport), xuTreasury),
  mustBeAbsent: same(life, ...malefics),
});

export const xingjueSunMoonRepeatedPassages = new Map([
  [prefix + '007-p271-001', { id: prefix + '007-p842-001' }],
  [prefix + '007-p278-001', { id: prefix + '007-p846-001' }],
]);
const atSiChang = palace => all(at(palace, '巳', '文昌'), [hour('巳'), coreCount(palace, 1), suiqian(palace, '龙德')]);
const twoLu = (a, b) => [[...same(a, '禄存'), ...changeAt(b, '禄')], [...same(b, '禄存'), ...changeAt(a, '禄')]];
const twoHostStarAndChange = (a, b, star, change) => [[...same(a, star), ...changeAt(b, change)], [...same(b, star), ...changeAt(a, change)]];
const luYearSeats = ['甲寅', '庚申', '乙卯', '辛酉'].map(([stem, branch]) => [year(stem), branchAt(life, branch)]);
const afflictedTongLiang = onAnchors(anchor => {
  const paths = star => related(anchor, 'includingFlanks').map(([palace, path]) => [relation(anchor, palace, path), ...same(palace, star)]);
  return choice(malefics.flatMap((first, index) => malefics.slice(index + 1)
    .flatMap(second => product(paths(first), paths(second)))), same(anchor, '天同', '天梁'));
});

// Source hashes bind the selected passages to the Qing manuscript and its supplied prerequisites.
const reviewed = new Map([
  ['004-p239-001', ['213376cdbcc936e923de70b128471f89e03b8a26368d19f23f086d84832884d8',
    ['旬路二空亦紫府之所忌',
      [choice(product([
        at(life, '午', '紫微'), at(life, '戌', '天府'),
      ], ['旬空', '截路'].map(star => same(life, star))))]],
  ]],
  ['004-p240-001', ['10c68245a929d2865769ea2906ad5253a24361855025efd7a7b50f55d8e85e08',
    ['雖得日月魁鉞昌曲諸星若無輔弼則終不至於極品',
      [{
        ...choice(flanks(life, '太阳', '太阴'), [...same(life, '天府'), ...sector(life, '天魁', '天钺', '文昌', '文曲')]),
        mustBeAbsent: absentInSector(life, ['左辅', '右弼']),
      }]],
  ]],
  ['004-p242-001', ['6678fed3f4ece6ac18863ea688eaf8b6ae37e0ec648307d38a4d6b4493043999',
    ['紫微居命、天府居身、無殺星沖破者、一生福祿',
      [choice(pairedLifeBody('紫微', '天府', body => [
        sectorMalefics(life, 0), sectorMalefics(body, 0),
      ]))]],
  ]],
  ['004-p243-001', ['4a2064432e07258a75c6640b128f4ae35417d37496c3c33bc6c4797114211ee3',
    ['府居命紫居身者亦富貴',
      [choice(pairedLifeBody('天府', '紫微', body => [
        sectorMalefics(life, 0), sectorMalefics(body, 0), ...sector(life, '左辅', '右弼'),
      ]))]],
  ]],
  ['004-p245-001', ['f9245cd53480cb3a3814847a18b8ab775a95ed527eea7d815bac3150f875920f',
    ['天府地劫同居者無妨',
      [all(same(life, '天府', '地劫'))]],
  ]],
  ['004-p247-001', ['259a8cfab73a4837010d11e8a34098f818e94e6a4daa99fcba85b72e70af7489',
    ['寅申安命紫府同宮則謂之紫府同宮格',
      [choice(product(alternateBranches(life, '寅申'), pairedNoblesAndAssistants.map(star => [trineStar(life, star)])),
        [...same(life, '紫微', '天府'), ...sector(life, ...pairedNoblesAndAssistants)])]],
  ]],
  ['004-p248-001', ['cc253a3dcb0f063768f1ce63eea155cdc87e6ef71e3b4ebfb2ec4f8b6db4cc68',
    ['命不見殺星湊合公卿貴格也',
      [choice(goodTrines(life), [...at(life, '午', '紫微'), sectorMalefics(life, 0)])]],
  ]],
  ['004-p249-001', ['23c9cf478f054672868bc5b209ca4dc800db9aa046c58b75718f7899b7ed5c2a',
    ['府左輔同守命於辰戌二宮',
      [choice(product(alternateBranches(life, '辰戌'), [...'科权禄'].flatMap(change => trineChange(life, change))),
        same(life, '天府', '左辅'))]],
  ]],
  ['004-p250-001', ['852fc7ce34135aff3c55a70de72eeb74b6f53189c74e7e57115bbf64f0d49442',
    ['天府落空',
      [choice(voidStars.map(star => same('子女', star)), same('子女', '天府'))]],
  ]],
  ['004-p251-001', ['783c01d00cc7cfd1d88a849734c9da5e280d876ee6072b71aa8df4ff2a990136',
    ['午戌成格富貴隆重',
      [choice([...'科权禄'].flatMap(change => trineChange(life, change)),
        at(life, '戌', '廉贞', '天府')),
      choice(product(['地空', '旬空'].map(star => same(life, star)), auspicious.map(star => sector(life, star))),
        [...at(life, '午', '武曲', '天府'), bureau('火六局'), { kind: 'natal_year_nayin_element', element: '火' }])]],
  ]],
  ['004-p252-001', ['310648b81fd34559a9fbf6b9b0eec2b8463ea768b0a658d2b3bef2fda6d0793e',
    ['紫遇劫',
      [all(same(life, '紫微', '地劫'))]],
    ['府犯空',
      [choice(voidStars.map(star => same(life, star)), same(life, '天府'))]],
  ]],
  ['004-p1057-001', ['8df60e740029811424b73b97805df4ae172e736d783bf8ba575367ccde53a52b',
    ['若輔弼夾拱、則雖不得日月昌曲魁鉞、不害登科',
      [{
        ...choice(product(purpleOrTreasury, flanks(life, '左辅', '右弼'))),
        mustBeAbsent: absentInSector(life, ['太阳', '太阴', '文昌', '文曲', '天魁', '天钺']),
      }]],
  ]],
  ['004-p1058-001', ['61c1ec26f2bf2fd74890475bdb3b43f7b6963dcf2a46d241130d705364eaedea',
    ['紫微天府不得輔弼昌曲日月魁鉞池閣等諸吉、則只是重厚質樸而已',
      [{
        ...choice(purpleOrTreasury),
        mustBeAbsent: absentInSector(life, ['左辅', '右弼', '文昌', '文曲', '太阳', '太阴', '天魁', '天钺', '龙池', '凤阁']),
      }]],
  ]],
  ['004-p1059-001', ['814061eeb67d1c5275453e5d9f3f3e95a98959c867ff11e2e1575437c04fd869',
    ['紫府輔弼之身命得台座及台輔者、必為宰相',
      [all(same(life, '紫微', '天府'), sector(life, '左辅', '右弼', '三台', '八座', '台辅'))]],
  ]],
  ['004-p1060-001', ['d5400b8f6b332a13590b4b992d159ad07d9cf058d17056e04aca9a5cb2ade609',
    ['紫府之同居、終身祿厚',
      [all(same(life, '紫微', '天府'), sectorMalefics(life, 0))]],
    ['若殺星沖破',
      [choice(malefics.map(star => same(travel, star)),
        [...same(life, '紫微', '天府'), relation(life, travel, 'opposite')])]],
  ]],
  ['004-p1061-001', ['ef834155a7aa6798119d4e5558becbb404048db253111a3b9c9dc007b12cc8df',
    ['戌府守命、午紫守身是謂紫府迭守',
      [all(xuTreasuryAndWuBodyPurple)]],
    ['加有輔弼文星科星、早發、名揚位顯',
      [choice(['文昌', '文曲'].map(star => sector(life, star)),
        [...xuTreasuryAndWuBodyPurple, ...sector(life, '左辅', '右弼'), sectorChange(life, '科')])]],
  ]],
  ['004-p1064-001', ['43bd913645a6c2ae795f0c12cc95c64eb9e33dcec2b9f04c2e9d1b0dfdae6621',
    ['若落旬路二空坐絕地',
      [choice(['紫微', '天府', '天相'].map(star => same(life, star)),
        [...same(life, '旬空', '截路'), phase(life, '绝')])]],
  ]],
  ['004-p1066-001', ['39bd7d1c1bb6244fa8f8a95b886540ab222e421e8ac730dbc0cb21d82b07c06f',
    ['紫府迭守身命為貴',
      [choice([
        ...pairedLifeBody('紫微', '天府'), ...pairedLifeBody('天府', '紫微'),
      ])]],
    ['而兼得財印昌曲權祿朝拱、雄威發越',
      [choice([
        ...pairedLifeBody('紫微', '天府'), ...pairedLifeBody('天府', '紫微'),
      ], [...sector(life, '武曲', '天相', '文昌', '文曲'), sectorChange(life, '权'), sectorChange(life, '禄')])]],
  ]],
  ['004-p1069-001', ['e9e9b6e1032d7787c5f91115724ca764b4a44b64cd10747509393aa6e7c9eadb',
    ['戌府守命腰金衣紫、貴格。而甲己人合格',
      [xuTreasuryWithoutSameMalefics('甲己')]],
    ['而餘則常貴',
      [xuTreasuryWithoutSameMalefics('乙丙丁戊庚辛壬癸')]],
    ['不逢左右魁鉞科祿者、中平',
      [{
        ...choice(product(...['科', '禄'].map(change => outsideLifeSector.map(palace => changeAt(palace, change)))), xuTreasury),
        mustBeAbsent: [...absentInSector(life, pairedNoblesAndAssistants), ...same(life, ...malefics)],
      }]],
    ['加殺者非',
      [choice(malefics.map(star => same(life, star)), xuTreasury)]],
  ]],
  ['004-p1070-001', ['2f2a2229b15efa3f6af4a8e7b0914cdf40efc3ee283267776c1680ad79e3363f',
    ['紫居卯酉守命、加值殺星者',
      [choice(product(alternateBranches(life, '卯酉'), malefics.map(star => sector(life, star))),
        same(life, '紫微'))]],
    ['而如得吉化魁鉞者、貴命',
      [choice(product(alternateBranches(life, '卯酉'),
        [...'科权禄'].map(change => [sectorChange(life, change)])),
        [...same(life, '紫微'), ...sector(life, '天魁', '天钺')])]],
  ]],
  ['004-p1071-001', ['edb27ba523161b75527dd0dd7734c6eb6c84fb3e99e9504a4ca4e7c96ab53be3',
    ['天府落空則雖武曲兩祿等財星並得地入廟',
      [choice(product(voidStars.map(star => same(life, star)), [['寅', '戌'], ['申', '辰']].map(([lifeBranch, wealthBranch]) => [
        branchAt(life, lifeBranch), ...at(wealth, wealthBranch, '武曲'),
      ])), [
        ...same(life, '天府'), relation(life, wealth, 'trine'),
        ...sector(life, '禄存'), sectorChange(life, '禄'),
      ])]],
  ]],
  ['007-p271-001', ['a874c8a09344b9e9300e5d3e7d528fb30310bb96fc31d5bef9c4c68f1cf4a0c7',
    ['主文明華翰之才',
      [litWithoutBenefics]],
  ]],
  ['007-p276-001', ['0e9565067b7a6dc07f652f2b6a283686a9a4e8e6163f10a194abaf9d514d1a85',
    ['日月化貴于強宮者、光輝最大。',
      [choice([life, wealth, career].map(palace => [
        ...same(palace, '太阳', '太阴'), starChange(palace, '太阳', '禄'), ...changeAt(palace, '禄'),
        starChange(palace, '太阴', '科'), ...changeAt(palace, '科'),
      ]))]],
  ]],
  ['007-p277-001', ['7c850048e90416ce02a7da583136575b3f5a081806b82ea550ad74b6870ddc0e',
    ['太陰得地成格者雖清貴而亦有成敗',
      [choice(goodTrines(life), brightTrines(life))]],
  ]],
  ['007-p278-001', ['d39538fb215189d37cd24c1185ff170cbe7187b48d05b1bb819c558257f27055',
    ['若居東方而得生旺則其清輝發揚',
      [eastMoonGrowth]],
  ]],
  ['007-p281-001', ['84db8e4f2dd886dfbe67e7ee1b0300961ff41e4adaaeaf3171c5640b5d010502',
    ['日月遇水空者得諸吉拱則富貴',
      [choice(product(['天空', '地空', '旬空'].map(star => same(career, star)), pairTrineBenefics),
        [...brightTrines(life), bureau('水二局')])]],
  ]],
  ['007-p287-001', ['a622ecb74e2c2e676071b7f6b657abd8f6652ae031be334891691a23f3965d8a',
    ['太陽得昌曲魁鉞而化奇者',
      [choice(['禄', '权'].map(change => [starChange(life, '太阳', change), ...changeAt(life, change)]),
        [...same(life, '太阳'), ...sector(life, '文昌', '文曲', '天魁', '天钺')])]],
  ]],
  ['007-p289-001', ['6ed1c1dbafe1909e3a3a29ead894a3061302daa4b5381680fd92f3de852067ed',
    ['辰戌日月拱於身命、為文藝之士。',
      [withBody(travel, choice(opposedLights(life)))]],
  ]],
  ['007-p290-001', ['e05ca81713fa5649d195d18aa099f5e1e6b4fe690fecda9c7ec213ea8777823d',
    ['旬路天地空皆喜逢',
      [choice(lightsWithVoid)]],
    ['但火劫相值則空能作禍',
      [choice(product(lightsWithVoid, [
        [...same(life, '地劫'), trineStar(life, '火星')],
        [...same(life, '火星'), trineStar(life, '地劫')],
      ]))]],
  ]],
  ['007-p291-001', ['102e5803dd71ca440d555e3893196ab3b368b658f3fdcbaea141e39c46b3fb39',
    ['日月昌曲',
      [choice(opposedLights(life), [...sector(life, '文昌', '文曲'),
        sectorChange(life, '科'), sectorChange(life, '权'), sectorChange(life, '禄')])]],
  ]],
  ['007-p844-001', ['59e74dcfc879583c9935ad8928f6cf95c78a5c17c0552a797b15cbc90f3bc3f0',
    ['若紫府與諸殺並會者',
      [choice([2, 3, 4].map(count => [{ kind: 'palace_sector_malefic_count', palace: life, count }]),
        same(life, '紫微', '天府'))]],
  ]],
  ['007-p845-001', ['ba0c576fbdfed9425d8e694f1611ff191783592846e7c45158196b37cfb14a59',
    ['太陰入廟居財宮者',
      [choice(alternateBranches(wealth, '亥子'), same(wealth, '太阴'))]],
  ]],
  ['007-p846-001', ['a0e44cbb1713b8a72d174f60bb7f4032d3eb1fc816f233372b9ed04f807b09b5',
    ['若居東方而得生旺、則其清輝發揚不下於亥子宮。',
      [eastMoonGrowth]],
  ]],
  ['007-p850-001', ['9ae71c254ca703d2e6a4a82c4e52740f1f1add73fbbbd5cb7d8b64a5c623e586',
    ['身宮得反背日月照空者',
      [choice([life, ...otherBodySeats].flatMap(anchor => voidStars.map(star => {
        const sun = seat(anchor, 4), moon = seat(anchor, -4);
        return [
          { kind: 'palace_confirmed_body_seat', palace: anchor }, ...at(anchor, '丑', star), mainCount(anchor, 0),
          relation(anchor, sun, 'trine'), ...at(sun, '酉', '太阳'),
          relation(anchor, moon, 'trine'), ...at(moon, '巳', '太阴'),
        ];
      })))]],
  ]],
  ['007-p874-001', ['c448ecdd16290375e74cb43705621c86b2a3c69e0718d048de6b7c72d1ad76d0',
    ['機日天才相遇、又得日月照臨者',
      [all(
        branchAt(life, '申'), relation(life, travel, 'opposite'), at(travel, '寅', '太阳'),
        relation(life, wealth, 'trine'), at(wealth, '辰', '天机', '天才'),
        relation(life, career, 'trine'), at(career, '子', '太阴'))]],
  ]],
  ['007-p272-001', ['21ff2a63386a38b0021306c0f5e9ba399d73b091396e08b972e67aeb8e6dee91',
    ['在財宮則主富',
      [choice(brightLights(wealth))]],
  ]],
  ['007-p273-001', ['85ff64df8ec8eaa2d0f0f7b854b555478814f3426a27673aa15a9e8afc4df280',
    ['在官宮則主貴',
      [choice(brightLights(career))]],
  ]],
  ['007-p274-001', ['7a6202416d27661f2dd5d0445b3aaa765140df54c700c468261b683b8bc58ec7',
    ['日月逢羊陀火鈴者皆不美',
      [choice(product(opposedLights(life), fourMalefics.map(star => sector(life, star))))]],
  ]],
  ['007-p275-001', ['84af43241572732b9299f69706395a13e62ee56392bf6b18a8f87e4594e85357',
    ['丑未宮安命遇日月者、若於三方無吉星拱照、福不生貴不至',
      [{
        required: [...same(life, '太阳', '太阴'), { kind: 'palace_life_without_trine_auspicious_mutagens' }],
        anyOf: alternateBranches(life, '丑未'),
        mustBeAbsent: goodTrines(life).flat(),
      }]],
  ]],
  ['007-p280-001', ['eafbef9f583414226167e28b4a1a09163bef2fb065ee44ed60f0a5bf1a6c44bc',
    ['日月守田宅而居廟庫者',
      [choice(alternateBranches(estate, '丑未'), same(estate, '太阳', '太阴'))]],
  ]],
  ['007-p282-001', ['49587b841da2290a6cf7f372e5a68a7e11c358e7181835f05312a3cd184c064f',
    ['日月雖反背、與昌曲科祿會照者、文明榮貴。',
      [choice(opposedLights(life), [...sector(life, '文昌', '文曲'),
        sectorChange(life, '科'), sectorChange(life, '禄')])]],
  ]],
  ['007-p283-001', ['7eae61f2914693933b9519e4e6376cd449033352693574671c5bfcf698648277',
    ['亥地月遇天空者、若亥時生人則文章冠世',
      [all(at(life, '亥', '太阴', '天空'), hour('亥'))]],
  ]],
  ['007-p284-001', ['3eeb1b079265dfea23f2fd9630af5921306354c468d6a35822c199fd31f8e072',
    ['日月池閣同守身命丑宮者',
      onAnchors(anchor => all(at(anchor, '丑', '太阳', '太阴', '龙池', '凤阁')))],
    ['三合雖有兇殺、富貴福祿自如。',
      onAnchors(anchor => choice(fourMalefics.map(star => [trineStar(anchor, star)]),
        at(anchor, '丑', '太阳', '太阴', '龙池', '凤阁')))],
  ]],
  ['007-p285-001', ['d78e6ed131d680c120bb053f298e750f103fb11696f5003dfaec943359fe97aa',
    ['不得日照者只有虛名',
      [{
        ...choice(related(life, 'sector').map(([target, path]) => [
          relation(life, target, path), ...same(target, '太阴'),
        ])),
        mustBeAbsent: [life, ...related(life, 'sector').map(([target]) => target)].flatMap(palace => same(palace, '太阳')),
      }]],
  ]],
  ['007-p286-001', ['8abaf9399e6cdc883d56c4b41d6fb97ef41ca3541ac70c3a40f3871f55623b77',
    ['財官宮得地廟旺照命者',
      [all(brightTrines(life))]],
  ]],
  ['007-p292-001', ['853dfd75068153a3b04c79e77a7e4c999f6c9b4d4182b35eb03b38591fe98001',
    ['日會文昌月會文曲',
      [choice([spouse, career].flatMap(anchor => {
        const fromSun = seat(anchor, 4), fromMoon = seat(anchor, -4);
        return [
          [...at(anchor, '卯', '太阳', '文昌'), relation(anchor, fromSun, 'trine'), ...at(fromSun, '亥', '太阴', '文曲')],
          [...at(anchor, '亥', '太阴', '文曲'), relation(anchor, fromMoon, 'trine'), ...at(fromMoon, '卯', '太阳', '文昌')],
        ];
      }))]],
  ]],
  ['007-p293-001', ['0945147b6454a155319f9f94c0d01e72778347e40634d45c202f819475d718e5',
    ['命宮前後有日又有太陰者',
      [choice(flanks(life, '太阳', '太阴'))]],
  ]],
  ['007-p294-001', ['87033be115f2a524fff5304d037ce91298f9054e28975bed81d1c3f3058e0799',
    ['反背日化權不宜。',
      [choice(alternateBranches(life, '申酉戌亥子'),
        [...same(life, '太阳'), starChange(life, '太阳', '权'), ...changeAt(life, '权')])]],
  ]],
  ['007-p842-001', ['0ee911442afbffead30d409c884361e5cc4b6bd1a2cc06984936640b8316c33c',
    ['若不得諸吉而只得日月照者、主文明華翰之才。',
      [litWithoutBenefics]],
  ]],
  ['007-p843-001', ['0323bc05d2dce93b3f98bc69187efe3094d0ea2b7d728dd1c8da5e0b5d34c198',
    ['日月臨對宮者、惟丙辛生人福祿隆興。',
      [choice(product(alternateBranches(travel, '丑未'), ['丙', '辛'].map(stem => [year(stem)])),
        [relation(life, travel, 'opposite'), ...same(travel, '太阳', '太阴')])]],
  ]],
  ['007-p847-001', ['821c7c41724d7b837f5acd410410f9dae51ca0af9e48b3d0f77e9d5f8aaba803',
    ['太陰之居卯宮者、得生旺則其格至貴',
      [choice(['长生', '帝旺'].map(value => [phase(life, value)]), at(life, '卯', '太阴'))]],
  ]],
  ['007-p848-001', ['07f47f9afa74c4f4e8d5575a1c166f4bb4cd0ef2250fa1c570ecd621ebf734ac',
    ['日月逢台座、多為爕理之臣。',
      [all(same(life, '太阳', '太阴'), sector(life, '三台', '八座'))]],
  ]],
  ['007-p851-001', ['796632c8622f1049ce10e0238560b95d868dc18ef8012d3154cad471cc46d2b9',
    ['亥子太陰極貴、而若居奴宮、兼有科星',
      [choice(alternateBranches('仆役', '亥子'), [...same('仆役', '太阴'), ...changeAt('仆役', '科')])]],
  ]],
  ['007-p862-001', ['dc3d9c20a40862deeb924832df95d80f3aed15b24fb003a64792ff9b4f01e62a',
    ['戌宮命太陽單守、化忌同居、落日昏冥不美',
      [all(at(life, '戌', '太阳'), mainCount(life, 1), starChange(life, '太阳', '忌'), changeAt(life, '忌'))]],
    ['加以卯地羊昌相合',
      [all(at(life, '戌', '太阳'), mainCount(life, 1), starChange(life, '太阳', '忌'), changeAt(life, '忌'),
        at('仆役', '卯', '擎羊', '文昌'))]],
  ]],
  ['007-p863-001', ['7b58b5eadfb8034ea3e2acdd56b1d3e12c1d79d79c1ec6bbabf29715bf84b23f',
    ['亥宮命太陰逢惡於絕地、馬落絕地者',
      [choice(fourMalefics.map(star => same(life, star)), [...at(life, '亥', '太阴', '天马'), phase(life, '绝')])]],
  ]],
  ['007-p864-001', ['b515ec04f04cf4b63598b1a835a9213761e27fb1b82625c0f7c89665fac5bbbf',
    ['安身命自未至子遇月者、富貴快樂。',
      onAnchors(anchor => choice(alternateBranches(anchor, '未申酉戌亥子'), same(anchor, '太阴')))],
  ]],
  ['007-p865-001', ['159e06636eb16801dbd104f08eec41b5abb69725525d8bac0f70189c1a3ad9ed',
    ['日月科祿同居丑宮極貴。',
      [all(at(life, '丑', '太阳', '太阴'), starChange(life, '太阳', '禄'), changeAt(life, '禄'),
        starChange(life, '太阴', '科'), changeAt(life, '科'))]],
  ]],
  ['007-p866-001', ['0590b044c8dd1b36eb861d1ee98c6c966ce4d3e8211c67534995884002b646cf',
    ['丑未日月守命宮、前後左右昌曲夾者至貴至顯。',
      [choice(product(alternateBranches(life, '丑未'), flanks(life, '文昌', '文曲')), same(life, '太阳', '太阴'))]],
  ]],
  ['007-p867-001', ['2bb92c6a7d395701059a87a3ee83604bd60a7075633db88f7a31a0f65c0296e4',
    ['日月照池閣',
      [choice([life, career, travel].map(anchor => [
        ...same(anchor, '龙池', '凤阁'), ...brightTrines(anchor),
      ]))]],
  ]],
  ['007-p868-001', ['fce83bdc1be8ac9e10adacdc2d4c4906add6535d942ae09792fbae0305358c41',
    ['命逢日月池閣夾之',
      [choice(flanks(life, '龙池', '凤阁'), same(life, '太阳', '太阴'))]],
  ]],
  ['007-p869-001', ['68c911f9febee7a51218e6246ccd8277d7ca7c9f37f4c78e55ea9d618bb5bce1',
    ['命宮日月雖反背、如日在戌月在辰、輔弼迭守命遷者、為廟會左右。',
      [choice(product(opposedLights(life), [
        [...same(life, '左辅'), ...same(travel, '右弼')], [...same(life, '右弼'), ...same(travel, '左辅')],
      ]))]],
  ]],
  ['007-p871-001', ['dd9b4b8a18ce0b4b539c1925f71406738851eb0f9ce44a06ce15435db3142fe3',
    ['丑日月自遷宮來朝者、雖遇陀無妨。',
      [all(at(travel, '丑', '太阳', '太阴', '陀罗'), relation(life, travel, 'opposite'))]],
  ]],
  ['007-p872-001', ['f538e7343b01431332fa54bfee26b9291206e7bc1fa0a4d83741ce000c1c4ba9',
    ['卯地月與忌鈴同居',
      [all(at(life, '卯', '太阴', '铃星'), changeAt(life, '忌'))]],
    ['祿存同居則救災',
      [all(at(life, '卯', '太阴', '铃星', '禄存'), changeAt(life, '忌'))]],
  ]],
  ['007-p873-001', ['fba0d61981ca02fd7de0d60c9d85bbb71e247fb012112dd15d3135579ae0f497',
    ['太陰會文曲於命宮、紫府夾者至貴。',
      [choice(flanks(life, '紫微', '天府'), same(life, '太阴', '文曲'))]],
  ]],
  ['007-p875-001', ['706fa50c55438d4c3b1f328288157fb64e596b1c3f6be6edd012cfbdc87ab80e',
    ['日在身月在命、日在命月在身、台座在官宮',
      [choice(otherBodySeats.flatMap(palace => [['太阳', '太阴'], ['太阴', '太阳']].map(([onBody, onLife]) => [
        { kind: 'palace_confirmed_body_seat', palace }, ...same(palace, onBody), ...same(life, onLife),
      ])), same(career, '三台', '八座'))]],
  ]],
  ['007-p877-001', ['c842f0867b52c6844db15e06ae94ad9a0385a4c787f7fd03609be66f6372681a',
    ['太陰天同同宮於子地為好、而怕遇鈴哭。',
      [all(at(life, '子', '太阴', '天同'), sector(life, '铃星', '天哭'))]],
  ]],
  ['005-p258-001', ['50eb4b21afabc69e9dcd527e28d7c1bf133ba4950132d49d7f39498ca81cc045',
    [null,
      onAnchors(anchor => choice([['左辅', '右弼'], ['右弼', '左辅']].map(([atAnchor, atFortune]) =>
        [...same(anchor, atAnchor), ...same(fortune, atFortune)])), [career])],
  ]],
  ['008-p295-001', ['796c94f08ecdebca3bc69fe6afaf12dce3374b46829c1f2ca4d485f7056642bc',
    [null,
      [choice([wealth, estate].flatMap(palace => ['庙', '旺', '得'].map(value => [...same(palace, '武曲', '天府'), bright(palace, '武曲', value)])))]],
  ]],
  ['008-p300-001', ['5712585f839f855be6b55239483db3c635a2de087fb3ca6bf73f37a693df6f59',
    [null,
      [choice(palaces.map(palace => at(palace, '卯', '武曲', '七杀')))]],
  ]],
  ['009-p857-001', ['e342a5e06953247f39bf8a5574607717790d30edbf758dfdc9752d3193a9c497',
    [null,
      afflictedTongLiang],
  ]],
  ['009-p1080-001', ['7db16cf9a9150eb8f899ed0252aa06d618cff5d8047cd0cfd9de711686726e01',
    [null,
      afflictedTongLiang],
  ]],
  ['010-p860-001', ['ec01d19ebf8f3ec3d9e8f620bd9a9b986b65d177c33200fd5833fc5348483a10',
    ['午命天梁坐守為官資清顯。',
      [all(at(life, '午', '天梁'))]],
    ['丁人上格',
      [all(at(life, '午', '天梁'), year('丁'))]],
    ['己人次之',
      [all(at(life, '午', '天梁'), year('己'))]],
    ['癸人主富。',
      [all(at(life, '午', '天梁'), year('癸'))]],
  ]],
  ['010-p861-001', ['2b3b6b8bfe4c890c889840a5164e34d1363b44bc599d960e17f8aba0ca8d45e7',
    [null,
      [all(at(life, '午', '天梁', '地空'), bureau('水二局'))]],
  ]],
  ['010-p1084-001', ['1b7b15ce8952048be5b3b6b4b2e2d186efa0dd279a39e24127d2ada67f6743bd',
    [null,
      [choice(alternateBranches(life, '子午'), [...same(life, '天梁'), ...sector(life, '陀罗', '火星')])]],
  ]],
  ['011-p319-001', ['d6d422e3ced563708287135fb6fd946e94f809caf1ac717be3ce5a0e345388aa',
    [null,
      [choice(palaces.flatMap(palace => [...'巳亥'].map(branch => [...at(palace, branch, '贪狼', '廉贞', '文昌', '陀罗'), ...changeAt(palace, '忌')])))]],
  ]],
  ['011-p1087-001', ['c7627595851c194a85fe64766127be289c7284c3c62fe50467c4f205ccf28fc7',
    [null,
      [choice(goodTrines(life), at(life, '未', '廉贞', '七杀'))]],
  ]],
  ['011-p1090-001', ['009b8bfe55e740e3bbf3a8c39f289c0ed67ce910f47ee28f9bc9565d949178e0',
    [null,
      [choice(palaces.flatMap(palace => [...'甲乙丙丁戊己庚辛壬癸'].map((stem, index) => [
        year(stem), ...at(palace, '申午辰寅子'[index % 5], '廉贞', '截路'), phase(palace, '绝'),
      ])))]],
  ]],
  ['013-p1098-001', ['5fac2073d36d19b22894280f675eebc8b705cf38e20da19b53e1822e01347957',
    [null,
      onAnchors(palace => all(at(palace, '辰', '巨门'), year('辛')))],
  ]],
  ['013-p1100-001', ['4195a1fc7c5e215fb4360fc7acfe9e0776798c1ebed2a1dc10c49340b6732454',
    ['而若辛生人巨門化祿在辰則酉祿暗合',
      [choice([at(seat(life, -5), '酉', '禄存')], [
        ...at(life, '辰', '巨门'), year('辛'), starChange(life, '巨门', '禄'), ...changeAt(life, '禄'),
      ])]],
  ]],
  ['014-p1107-001', ['e16727f1d14aae0276b828601c9bbe32921a492434ada55dedcbc5823edd19b9',
    ['辰地命紫相遇刑陀者不發',
      [all(at(life, '辰', '紫微', '天相'), sector(life, '天刑', '陀罗'))]],
  ]],
  ['015-p1114-001', ['7f962183616308b905bd01c6f7971e7791346bdce772d53ccea4e5e1893d7f21',
    [null,
      [choice(goodTrines(fortune), at(fortune, '未', '廉贞', '七杀'))]],
  ]],
  ['017-p1125-001', ['76f4de9fff8c4bfa4d06c44a51b912d6f34d22a681f1efeb6d94831c39df88b5',
    [null,
      [choice(palaces.map(first => [...at(first, '亥', '文昌'), ...at(seat(first, -3), '寅', '巨门', '太阳')]), [hour('亥')])]],
  ]],
  ['017-p1126-001', ['e189818c7d84acb3fed1f389ddd7e5345f5b2406054bb1a5a402e3c9878fde95',
    [null,
      [choice(palaces.map(palace => [...same(palace, '文昌', '红鸾'), suiqian(palace, '龙德')]))]],
  ]],
  ['017-p1127-001', ['4e49042b4ed2b5c01d335e9016032b708b558cb3427b692f813218860d4338a8',
    ['巳時生、巳地文昌單守遇龍德、主文科、身命官宮皆宜逢之',
      [atSiChang(life), atSiChang(career), withBody('夫妻', atSiChang('夫妻'))]],
  ]],
  ['019-p1136-001', ['2b1ea5946d3288fcdf43d9a5710c6c731a8cf23e341271d21e68c9d1755c7a0b',
    [null,
      otherBodySeats.map(palace => withBody(palace, choice([['天魁', '龙池'], ['龙池', '天魁']]
        .map(([lifeStar, bodyStar]) => [...same(life, lifeStar), ...same(palace, bodyStar)]))))],
  ]],
  ['019-p1137-001', ['6eb1f27f81e78387dcf91b25c4fdab0f718bf2cb3a9e8d29fed809f1a6cdecc5',
    [null,
      [choice(palaces.map(palace => [...same(palace, '天钺'), suiqian(palace, '白虎')]))]],
  ]],
  ['019-p1138-001', ['40701e9c64cba24cbe5b9307aa312f75c2c85b1d67579439f2f9e49694095ce8',
    [null,
      [choice(flanks(life, '天魁', '天钺'), [sectorChange(life, '科'), sectorChange(life, '禄')])]],
  ]],
  ['020-p400-001', ['25e1579c43998f1519a2d45f6ee3e84762d9d91a35e915fa039e8430d156b04c',
    ['兩祿分守田財者大富、不富則大貴',
      [choice(twoLu(wealth, estate))]],
    ['又兩祿分守田財、而一祿與與馬同居、一祿與權同居者、極貴',
      [choice(product(twoLu(wealth, estate), twoHostStarAndChange(wealth, estate, '天马', '权')))]],
  ]],
  ['020-p404-001', ['257c17fb199d3de11b9465d9b6af5d61a046d4c6d72eb028948330f3a0a2ef7a',
    [null,
      [withBody(wealth, choice(trineChange(wealth, '科'), [
        ...changeAt(life, '禄'), relation(life, travel, 'opposite'), ...changeAt(travel, '权'), ...same(wealth, '禄存'),
      ]))]],
  ]],
  ['020-p1139-001', ['1670937280b8d9f7f248239521618cfe7bcf48d527ff15067f1ad160603e7ec6',
    [null,
      otherBodySeats.map(palace => withBody(palace, all(same(life, '禄存'), changeAt(palace, '禄'))))],
  ]],
  ['020-p1141-001', ['d221d7f8fb4b09b3f9c43d19919c281dcdea54a2ef8ec57f5786f1511dd100c0',
    [null,
      [choice(oppositeStars('寅', ['禄存', '地劫'], '申', ['地空']))]],
  ]],
  ['020-p1142-001', ['cdc50e99c8515d0da2c864c4c805d124edd39faf9785db4c91fa6274103c1cd9',
    ['兩祿分守身命極貴',
      otherBodySeats.map(palace => withBody(palace, choice(twoLu(life, palace))))],
    ['而一祿與曲同居、一祿與科同居者、極貴',
      [withBody(career, choice(product(twoLu(life, career), twoHostStarAndChange(life, career, '文曲', '科'))))]],
  ]],
  ['020-p1144-001', ['7704125e3964a37d16b9c6b196b1194562178c3b1fbbd8c7e882e36892047bb8',
    ['此四位皆為祿守命垣',
      [choice(luYearSeats, same(life, '禄存'))]],
    ['若值殺星化忌者、主平常',
      [choice(product(luYearSeats, malefics.map(star => sector(life, star))), [...same(life, '禄存'), sectorChange(life, '忌')])]],
  ]],
  ['021-p409-001', ['7fbefb6e3673c65f342c2c65633f28bb47468c611e4aef65e8ffcd13cba210eb',
    ['天馬之遇青龍者為龍馬交會、又謂之飛龍馬',
      onAnchors(palace => all(same(palace, '天马'), [boshi(palace, '青龙')]))],
    ['遇長生者為生馬化龍、其格至貴、身命逢之至貴。',
      onAnchors(palace => all(same(palace, '天马'), [phase(palace, '长生')]))],
  ]],
  ['021-p414-001', ['2a383351d5f08653ea647d5868122ea1486a0fa1711c5a1e310fba05451a47dd',
    ['馬遇台輔謂之甫馬、甫馬之照命者、必為宰相。',
      [choice(related(life, 'sector').map(([palace, path]) => [relation(life, palace, path), ...same(palace, '天马', '台辅')]))]],
    ['馬宜遊行、故在遷宮得台輔為貴。',
      [all(same(travel, '天马', '台辅'))]],
  ]],
  ['021-p1152-001', ['e20ab469a79ac81ae6f0619de024d289bb35c4c7180b3b0b1e7e2bf516c55f4e',
    [null,
      [choice(oppositeStars('申', ['禄存'], '寅', ['天马']), [hour('申')])]],
  ]],
  ['021-p1153-001', ['b5cc7dd9150af8b18cc0a5453e5de810037b33733ddac524084708267523f7a3',
    [null,
      onAnchors(palace => choice(product(
        alternateBranches(palace, '寅申巳亥'), [...'科权禄'].flatMap(change => trineChange(palace, change)),
      ), same(palace, '天马')))],
  ]],
]);

const female = { kind: 'natal_gender', gender: '女' };
const forWoman = (...facts) => all([female], ...facts);
const splitLifeBody = (first, second) => otherBodySeats.map(palace =>
  withBody(palace, forWoman(same(life, first), same(palace, second))));
// In the reverse void placement only Travel can be the body palace under the current hour formula.
// A chart that also has the named Giant Gate condition takes the next clause.
const splitVoidsWithoutGiant = [
  ...splitLifeBody('地空', '地劫').map(group => ({ ...group, mustBeAbsent: same(life, '巨门') })),
  { ...withBody(travel, forWoman(same(life, '地劫'), same(travel, '地空'))), mustBeAbsent: same(travel, '巨门') },
];
const careerArrivals = ['太阳', '太阴', '文昌', '文曲'];
const womenReviewed = new Map([
  ['p780-001', ['eaa04ecfe04eb09095eb4aecbee20478227686e27904a39067df086e7bfb2af6',
    ['天相輔弼同居一宮', [choice([life, spouse, fortune].map(palace => same(palace, '天相', '左辅', '右弼')), [female])]],
  ]],
  ['p783-001', ['525d9f030c155e7a67c493c6ea3b294a2fdfcef54326741a447b74a0399dfba8',
    ['夫宮天馬與合宮姚星', [forWoman(same(spouse, '天马'), same(fortune, '天姚', '巨门', '天机'),
      [relation(spouse, fortune, 'trine')])]],
  ]],
  ['p784-001', ['87503994c6b3656ce8d0ee4d4921f986af80509eb2a164fecc79bc804ae1703b',
    [null, [['红鸾', '封诰'], ['封诰', '红鸾']].flatMap(([lifeStar, bodyStar]) =>
      related(life, 'sector').map(([target, path]) => withBody(target,
        forWoman(same(life, lifeStar), same(target, bodyStar), [relation(life, target, path)]))))],
  ]],
  ['p785-001', ['6b92c9fbd074c2a54b8f1d262211b24ee9ca8fc3a085cd92b0e669c963e4b09b',
    ['空刧雖迭守身命不妨', splitVoidsWithoutGiant],
    ['巨刧迭守身命險艱', [...splitLifeBody('巨门', '地劫'), ...splitLifeBody('地劫', '巨门')]],
  ]],
  ['p786-001', ['12bb429d04414e3778da61617403fc2832b416438d174bd886a2e80a0e9dca4e',
    ['官宮日月昌曲會朝', [{
      required: [female, ...sector(career, ...careerArrivals, '左辅', '封诰')],
      mustBeAbsent: same(career, ...careerArrivals),
    }]],
  ]],
  ['p787-001', ['d2463b515f224540e83e451646827a94fe66858d9a5c30cf459f8764fcd2c384',
    [null, [forWoman(at(spouse, '子', '天同', '太阴', '右弼'))]],
  ]],
  ['p789-001', ['8994ce88a435f36e7d4cd3e00a3f03ab4d38a4fa073c026391bd19e1fbaf0591',
    [null, onAnchors(palace => forWoman(same(palace, '擎羊')))],
  ]],
  ['p1661-001', ['27e2c4b17deb6d7882ba90d13117f368ac8aff89521c52d6c5e0988e870ce1c8',
    ['午地太陽坐守命宮者富貴', [forWoman(at(life, '午', '太阳'))]],
  ]],
  ['p1672-001', ['bb63892936722500f73fc0ae0ea77e48c0a94e2aae50b3bd4f95f9e741759e60',
    ['午地天機同照者合格', [forWoman(at(life, '子', '巨门'), at(travel, '午', '天机'), [relation(life, travel, 'opposite')])]],
  ]],
  ['p1674-001', ['1dd2d6dfd981401b6b9ea53bd7b607ef1d8f71b83755e06f46d07d6917e43984',
    [null, [choice(flanks(wealth, '紫微', '天府'), [female])]],
  ]],
  ['p1680-001', ['88112e51aaf8f79df33c2ff3417b4ee3d050a5e03d9eeabe33b84d82bb5a9b21',
    ['寅地巨門聰慧', [forWoman(at(life, '寅', '巨门'))]],
  ]],
  ['p1683-001', ['7f8a480d2ca2c0c0ab04ac09b5cbab3b3143988cde11583e8d3ae364b71e4eec',
    ['刧空二星迭守財福宮者、不論男女、皆為貧賤下格', [choice([['地劫', '地空'], ['地空', '地劫']]
      .map(([atWealth, atFortune]) => [...same(wealth, atWealth), ...same(fortune, atFortune)]))]],
  ]],
]);

export function xingjueNatalStarsChapter(id) {
  if (id.startsWith(womenPrefix)) return '女命篇';
  if (id.startsWith(prefix + '004-')) return '论紫府';
  if (id.startsWith(prefix + '007-')) return '日月篇';
  return '分星篇';
}

export function compileXingjueNatalStars(claim) {
  const isWomenChapter = claim.id.startsWith(womenPrefix);
  if (!isWomenChapter && !claim.id.startsWith(prefix)) return undefined;
  const chapter = xingjueNatalStarsChapter(claim.id);
  const spec = isWomenChapter ? womenReviewed.get(claim.id.slice(womenPrefix.length)) : reviewed.get(claim.id.slice(prefix.length));
  if (!spec) return undefined;
  const [expected, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== expected || passages.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: `《紫微星诀》${chapter}的出处、原文或条件有变化，须重新核对。` };
  }
  const branches = passages.map(([text, groups]) => ({
    text,
    conditionCompiler: xingjueNatalStarsProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', group)),
  }));
  return branches[0].text === null
    ? { compiler: xingjueNatalStarsProfile, inputs: branches[0].inputs,
      ...(claim.id === prefix + '020-p404-001' && { remainingAlternatives: 4 }) }
    : { reason: 'unmapped_condition', condition: `按《紫微星诀》${chapter}已核分句取材`, branches };
}
