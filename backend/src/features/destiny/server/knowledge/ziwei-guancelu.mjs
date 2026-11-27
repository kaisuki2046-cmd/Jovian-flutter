import { createHash } from 'node:crypto';
import { earthlyBranches } from './dictionaries.mjs';
import { normalizeRuleInput } from './matching.mjs';
import { ziweiRelativePalaces } from './ziwei-relative-profile.mjs';

export const guanceluNatalProfile = 'guancelu-natal-palace-witnesses-v1';
const sourcePrefix = 'ziwei-v1-guancelu-001-';
export const guanceluRepeatedPassages = new Map([
  [sourcePrefix + 'p022-001', { id: sourcePrefix + 'p135-001' }],
  [sourcePrefix + 'p131-001', { id: sourcePrefix + 'p102-001', text: '祿存守身垣。主孤主財。' }],
]);
const bodyPalaces = ['命宫', '夫妻', '财帛', '迁移', '官禄', '福德'];
const same = (palace, ...stars) => stars.map(star => ({ kind: 'palace_star', palace, star, scope: 'origin' }));
const bodySeat = palace => ({ kind: 'palace_confirmed_body_seat', palace });
const originCount = (palace, count) => ({ kind: 'palace_origin_star_count', palace, count });
const at = (palace, branch) => ({ kind: 'palace_branch', palace, branch });
const relation = (anchor, target, relation) => ({ kind: 'palace_relation', anchor, target, relation });
const inBody = (palace, stars) => [...same(palace, ...stars), bodySeat(palace)];
const onBody = (...stars) => bodyPalaces.map(palace => inBody(palace, stars));
const lifeOrBody = stars => [same('命宫', ...stars), ...bodyPalaces.slice(1).map(palace => inBody(palace, stars))];

const tongLiangAcrossLifeAndBody = [['巳', '亥'], ['亥', '巳']].flatMap(([life, travel]) =>
  [['天同', '天梁'], ['天梁', '天同']].map(([lifeStar, bodyStar]) => [
    at('命宫', life), at('迁移', travel), relation('命宫', '迁移', 'opposite'),
    ...same('命宫', lifeStar), ...inBody('迁移', [bodyStar]),
  ]));
const ziLifeJuMen = [at('命宫', '子'), ...same('命宫', '巨门')];
const change = (palace, star, change) => ({ kind: 'star_mutagen', palace, star, change, scope: 'origin' });
const tanLangZiOppositeZiWei = [at('命宫', '子'), ...same('命宫', '贪狼'),
  at('迁移', '午'), ...same('迁移', '紫微'), relation('命宫', '迁移', 'opposite')];
const maoYouLifeTreasuryWithBodyWarriors = [at('命宫', '卯'), ...same('命宫', '天府'),
  at('迁移', '酉'), ...inBody('迁移', ['武曲', '七杀']), relation('命宫', '迁移', 'opposite')];
const haiLifeFallenTianLiang = [at('命宫', '亥'), ...same('命宫', '天梁'),
  { kind: 'palace_brightness', palace: '命宫', star: '天梁', scope: 'origin', brightness: '陷' }];
const femaleWeiLianSha = [at('命宫', '未'), ...same('命宫', '廉贞', '七杀'), { kind: 'natal_gender', gender: '女' }];
const femaleWeiLianShaMeetingLu = [['命宫', '廉贞'], ['财帛', '贪狼'], ['官禄', '武曲'], ['官禄', '破军']]
  .map(([palace, star]) => [...femaleWeiLianSha, ...same(palace, star), change(palace, star, '禄'),
    ...(palace === '命宫' ? [] : [relation('命宫', palace, 'trine')])]);
const shenLifeTongLiang = [at('命宫', '申'), ...same('命宫', '天同', '天梁')];

function natalTransformationInLifeSector(palace, star, mutation) {
  return [...same(palace, star), change(palace, star, mutation),
    ...(palace === '命宫' ? [] : [relation('命宫', palace, palace === '迁移' ? 'opposite' : 'trine')])];
}

const dignity = (palace, star, brightness) => ({ kind: 'palace_brightness', palace, star, scope: 'origin', brightness });
const yearStem = stem => ({ kind: 'natal_year_stem', stem });
const yearBranch = branch => ({ kind: 'natal_year_branch', branch });
const lifeOrBodyMajorState = state => bodyPalaces.map(palace => [
  { kind: 'palace_major_state', palace, state }, ...(palace === '命宫' ? [] : [bodySeat(palace)]),
]);
const lifeSector = (palace, ...stars) => [...same(palace, ...stars),
  relation('命宫', palace, palace === '迁移' ? 'opposite' : 'trine')];
const wuLifeZiWei = [at('命宫', '午'), ...same('命宫', '紫微')];
const ziLifeWuFu = [at('命宫', '子'), ...same('命宫', '武曲', '天府')];
const xuLifeTreasurySupported = [at('命宫', '戌'), ...same('命宫', '天府'),
  ...lifeSector('财帛', '紫微', '右弼'), ...lifeSector('官禄', '文昌', '天相')];
const weiLifeLianShaWithNobles = [...femaleWeiLianSha, ...same('命宫', '天钺'), ...lifeSector('迁移', '天魁')];
const lifeBodySoloTreasury = [...inBody('命宫', ['天府']), { kind: 'palace_main_count', palace: '命宫', count: 1 },
  ...lifeSector('迁移', '紫微', '七杀')];
const haiLifeTianLiangWithAfflictions = [...haiLifeFallenTianLiang, ...same('命宫', '天马', '地空', '地劫'),
  ...lifeSector('财帛', '擎羊'), ...lifeSector('官禄', '火星'), ...lifeSector('迁移', '陀罗')];
const wealthBodySunLuBoshu = [...inBody('财帛', ['太阳', '禄存']), { kind: 'palace_boshi_star', palace: '财帛', star: '博士' }];
// The source calls both positions "inside Jie Lu". The current chart marks
// the companion Si position as Kong Wang and the primary Zi position as Jie Lu.
const cutOffLu = [['丙', '巳', '空亡'], ['癸', '子', '截路']].map(([stem, branch, star]) => ({
  required: [yearStem(stem)],
  anyOf: ziweiRelativePalaces.map(palace => [at(palace, branch), ...same(palace, '禄存', star)]),
}));

function femaleLianZhenWithAuspiciousWitnesses() {
  const benefics = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'];
  return bodyPalaces.map(palace => {
    const opposite = ziweiRelativePalaces[(ziweiRelativePalaces.indexOf(palace) + 6) % ziweiRelativePalaces.length];
    const witnessesFor = star => [[{ kind: 'palace_trine_star', palace, star }], same(opposite, star)];
    return {
      required: [{ kind: 'natal_gender', gender: '女' }, ...same(palace, '廉贞'),
        ...(palace === '命宫' ? [] : [bodySeat(palace)]),
        { kind: 'palace_sector_six_malefic_count', palace, count: 0 }],
      anyOf: benefics.flatMap((star, index) => benefics.slice(index + 1).flatMap(other =>
        witnessesFor(star).flatMap(first => witnessesFor(other).map(second => [...first, ...second])))),
    };
  });
}

function martialAndLiteraryPassages() {
  const base = [...ziLifeWuFu, ...lifeSector('财帛', '廉贞'), ...lifeSector('迁移', '七杀')];
  const bing = [...base, yearStem('丙'), ...same('迁移', '擎羊')];
  const literaryAxis = ['命宫', '财帛', '官禄', '迁移'];
  // With Life at Zi, Wen Chang moves counterclockwise from Xu by the birth hour.
  const wenChangHour = palace => ({
    kind: 'natal_ziwei_hour', branch: earthlyBranches[(10 + ziweiRelativePalaces.indexOf(palace)) % earthlyBranches.length],
  });
  return [
    { text: '羊刃七殺廉貞拱照。武職威勇。', required: [
      [...base, yearStem('乙'), ...lifeSector('官禄', '擎羊')],
      [...base, yearStem('戊'), ...same('迁移', '擎羊')],
      ...ziweiRelativePalaces.filter(palace => !literaryAxis.includes(palace))
        .map(palace => [...bing, wenChangHour(palace), ...same(palace, '文昌'), change(palace, '文昌', '科')]),
    ] },
    { text: '而昌曲化科則文矣。', required: literaryAxis.map(palace => [
      ...bing, wenChangHour(palace), ...natalTransformationInLifeSector(palace, '文昌', '科'),
    ]) },
  ];
}

function shenLifeTongLiangWithThreeTransformations() {
  return [
    ...['命宫', '财帛', '官禄', '迁移'].map(palace => [
      ...shenLifeTongLiang, { kind: 'natal_year_stem', stem: '丙' },
      ...natalTransformationInLifeSector('命宫', '天同', '禄'),
      ...natalTransformationInLifeSector('官禄', '天机', '权'),
      ...natalTransformationInLifeSector(palace, '文昌', '科'),
    ]),
    [...shenLifeTongLiang, { kind: 'natal_year_stem', stem: '丁' },
      ...natalTransformationInLifeSector('财帛', '太阴', '禄'),
      ...natalTransformationInLifeSector('命宫', '天同', '权'),
      ...natalTransformationInLifeSector('官禄', '天机', '科')],
  ];
}

function flanks(anchor, first, second, base = []) {
  const index = ziweiRelativePalaces.indexOf(anchor);
  const previous = ziweiRelativePalaces.at(index - 1);
  const next = ziweiRelativePalaces[(index + 1) % ziweiRelativePalaces.length];
  return [[first, second], [second, first]].map(([left, right]) => [
    ...base, ...same(previous, left), ...same(next, right),
    relation(anchor, previous, 'adjacent'), relation(anchor, next, 'adjacent'),
  ]);
}

function trioInLifeOrBody() {
  const trio = ['七杀', '破军', '贪狼'];
  return bodyPalaces.flatMap(palace => trio.map(star => [
    ...same(palace, star),
    ...(palace === '命宫' ? [] : [bodySeat(palace)]),
    ...trio.filter(other => other !== star).map(other => ({ kind: 'palace_trine_star', palace, star: other })),
  ]));
}

// Keep named cases, borrowed houses and fortune periods outside these natal
// rules. Each supported conclusion is coupled to the reviewed evidence.
const reviewed = new Map([
  ['p004-001', { hash: '1117960ad9daee2bdf6df0362d101dd4d0bd1664ee252bd7b34d31d74f6f28ad',
    required: tongLiangAcrossLifeAndBody, text: '即巳亥同梁身命互守也。' }],
  ['p010-001', { hash: '3c8b082e3f001817ee826a8f5d35962316b41b317b28083be57a82de234f01b4',
    required: lifeOrBody(['天梁', '擎羊']) }],
  ['p011-001', { hash: '9822622781b6a961416a2d588a397cb8b45132c2bbf6f8021ce054c6ff961ce9',
    required: lifeOrBody(['天梁', '天马']) }],
  ['p012-001', { hash: 'af51cb408f5b188458549280f36014591edb09f9437cbf892010486af117e37f',
    required: [same('夫妻', '擎羊')] }],
  ['p015-001', { hash: '7c9709cd2e1c50ef610e5532056acb956efb8bd059a0ae0531935d1efee8ac6a',
    required: bodyPalaces.map(palace => [
      ...inBody(palace, ['破军']), at(palace, '辰'), { kind: 'natal_gender', gender: '女' },
    ]) }],
  ['p018-001', { hash: '657d851ddbcacb99f4b2de204cbf13214b9385a15033c201b302a419edccadb1',
    required: [same('命宫', '天同', '巨门')] }],
  ['p040-001', { hash: '9c897dc6a3e45cf98d7083fc8663c0a84639a7262ca811838b0ff0a430ff9092',
    required: onBody('天同'), text: '天同守身垣宜於道家。' }],
  ['p046-001', { hash: '4a5c90a80283d6add7bfb9023268504ea7330dbc55e067c3a6d058bf45a264ab',
    required: [[...same('命宫', '禄存'), ...same('父母', '擎羊'), ...same('兄弟', '陀罗'),
      relation('命宫', '父母', 'adjacent'), relation('命宫', '兄弟', 'adjacent')]],
    text: '父母宮必遇羊刃。' }],
  ['p054-001', { hash: '0a9c1d187457c6fe2f0e8d5752ee943125eb0c9e09ee087e9faeb8a3936542f3',
    required: [same('官禄', '擎羊')] }],
  ['p055-001', { hash: '8d89522d9f88ab19d944ce0bb37500a539a1f35e50f8794088a731aa8775c9dd',
    required: [same('田宅', '禄存', '天马')], text: '田宅祿馬。何能安跡家中。' }],
  ['p058-001', { hash: '11285c0336839020b0f5670216a1a3b69ae6c25ec330135e3b8c56b11f02f7c9',
    passages: [
      { required: [ziLifeJuMen], text: '巨門守命垣在子。為石中隱玉格。' },
      { required: [[...ziLifeJuMen, ...same('命宫', '擎羊'), ...inBody('迁移', ['天机']),
        at('迁移', '午'), relation('命宫', '迁移', 'opposite')]], text: '附有擎羊主武職。' },
    ] }],
  ['p060-001', { hash: '7999b4d141e0d21bc54eea00cefc7672b65aca6eed455676c05aa3b1d83f40e7',
    required: [[...ziLifeJuMen, ...same('命宫', '擎羊')]] }],
  ['p076-001', { hash: 'de0aea1659ec42ebbf8dd87589e6609df8072768faa3ab2f5fa0b850e224b49c',
    required: [[...same('命宫', '天府'), ...inBody('官禄', ['天相']), relation('命宫', '官禄', 'trine')]],
    text: '此府守命而相守身尤佳。' }],
  ['p080-001', { hash: 'a18ca35929c27ab0a9d08cfb4325668795a7c0426342fe6d1bae373c187ef892',
    required: [same('官禄', '天梁', '天马')] }],
  ['p081-001', { hash: '6a21e35efdee97154a488b33dfee8b9de98b13361f95c2bf716bb9221432bab2',
    required: [same('命宫', '太阳', '太阴')] }],
  ['p086-001', { hash: '9f4b030942277531a8860ea139ac40d3d3a6ef0f77c286f931d3813ea4d51407',
    required: [same('迁移', '巨门')], text: '巨門在遷移。多招是非。' }],
  ['p091-001', { hash: '042077e0005e247ba07075c8b45faf70678dc2268ef75b16d56223062f1edf5b',
    required: onBody('武曲', '天相') }],
  ['p095-001', { hash: '65dd9f30576bb90ba44c45223a3be59e4b8991c7ab480ba4755f965a104fe7d8',
    required: [same('夫妻', '禄存', '天马')] }],
  ['p102-001', { hash: '6c6e468fe264b6f7ac0a09775b0024dfd758ebbfcda6cfee53b51fe2656a04f0',
    required: onBody('禄存'), text: '祿存守身垣。主孤主財。' }],
  ['p111-001', { hash: '5bc530cfecffa023ec4c5b56a060aa405ee1dc54174f7208136036393c435e79',
    required: [[at('官禄', '巳'), ...same('官禄', '廉贞', '贪狼', '天姚'), ...['廉贞', '贪狼'].map(star => ({
      kind: 'palace_brightness', palace: '官禄', scope: 'origin', star, brightness: '陷',
    }))]], text: '廉貪在巳落陷附天姚。' }],
  ['p116-001', { hash: '2960d43e4279c0e65fe099cf21dbd8638d62691da5f5fec80a7a962f630d7374',
    required: onBody('廉贞'), text: '廉貞守身。孤剛英斷。' }],
  ['p121-001', { hash: '9b3785032180dee03f704d7ec737dbf0c7d65f4337fc7e3ede5f93ae457b4fa6',
    required: ['官禄', '田宅'].map(palace => [at(palace, '卯'), ...same(palace, '太阳', '天梁')]) }],
  ['p143-001', { hash: '9bd5df34b94c8df274bc027d201f5a14f1981cf6ea5dddce3d721377b090d9d0',
    required: [same('官禄', '禄存')], mustBeAbsent: [originCount('官禄', 1)] }],
  ['p162-001', { hash: '6c67897cb6efb6886a61cfda881a1e853aa4aea854e2f956008e26d5da4b5ead',
    required: trioInLifeOrBody() }],
  ['p020-001', { hash: 'b1dc6a2376342ab263976edfb8ee127a842fdc3721d2ce510c669a79b6c44731',
    required: [[...tanLangZiOppositeZiWei, bodySeat('命宫')]] }],
  ['p022-001', { hash: 'e5a506eede83e6430fc845b296c6d2520d2e7c897de0d33a760bb6d2ffce1b22',
    required: [maoYouLifeTreasuryWithBodyWarriors] }],
  ['p030-001', { hash: '77177f36d5dc6759ae7ff414064599bfbe90629cd0d194cec4381180484c43ac',
    required: [wealthBodySunLuBoshu] }],
  ['p051-001', { hash: 'aa110641199eb459f3a2b8cbb65a2e39e343e623c0cade0234abdc4235876f85',
    required: [[...same('财帛', '巨门'), change('财帛', '巨门', '忌')]], text: '巨門化忌。亦作破論。' }],
  ['p056-001', { hash: 'f51e48937e918a85ca4f37488cff351c00eda20ea6baa4dcc451221294db8e23',
    required: [[at('命宫', '卯'), ...same('命宫', '巨门', '天机')]], text: '巨門天機守命垣在卯。' }],
  ['p059-001', { hash: '92fddbf5518a86655b91c5a4c36d832ae3398e9b3e94677ee3a6cddd0e92c0f5',
    required: [[...same('命宫', '巨门'), ...inBody('迁移', ['天机']), relation('命宫', '迁移', 'opposite')]] }],
  ['p067-001', { hash: 'fa2ac773f80b876d405484f038d81e77378a460079bd9ace4711fcb5cebcc32e',
    required: [haiLifeFallenTianLiang.concat(same('命宫', '天马'))], text: '天梁天馬陷。飄蕩無疑。' }],
  ['p069-001', { hash: '90271d71e60e330f2bf4d127772d5237d54874218c5aa9ba295902a0a1be6222',
    required: [[at('命宫', '寅'), ...same('命宫', '天同', '天梁', '天马')]], text: '惟此造天梁遇馬飄\n蕩無疑。' }],
  ['p073-001', { hash: '8a59b2d7d4955efc49c4691f9fb514b0ed2b61fc05760c9fa4ae63182dbd05c1',
    required: [same('田宅', '贪狼', '陀罗')] }],
  ['p075-001', { hash: 'a2b75b69fbd3c6de9931ed657f361f1f19c4943e634dccc7d6c7f8025a7e3f68',
    required: femaleWeiLianShaMeetingLu }],
  ['p099-001', { hash: '291ae9a4548c060683ddb0bd6eb6b265a483409b6eac7178352cb9f3c9a32a7b',
    required: [same('命宫', '紫微', '天府', '陀罗')], text: '紫府守命。附有陀羅破其格。' }],
  ['p106-001', { hash: '99028f7ea980642090666da72fcdb6956df125de1c948c9aea236b6a3868ac59',
    required: [same('父母', '巨门', '天同')], text: '考其父母宮巨同。' }],
  ['p117-001', { hash: '9cff65ee557eb7420533fc6c067a636941f740300ec3065f232e6c96fa03111f',
    required: [lifeBodySoloTreasury], text: '天府單守身命垣。' }],
  ['p135-001', { hash: 'd5c904fc352d843a41faf4279e3fe2c70711c45b02227fdb7fc0956431fc6273',
    required: [maoYouLifeTreasuryWithBodyWarriors] }],
  ['p153-001', { hash: '0a19e95697eb780f2a0af2d84adcdd1ba6cf78fb7dc29efbe70ab0826ce589e9',
    required: [same('命宫', '廉贞', '七杀')] }],
  ['p156-001', { hash: 'f53eb78abfbf7e545917433eb9d430b91a10979f39a199906f85472ce427c59c',
    required: [tanLangZiOppositeZiWei] }],
  ['p163-001', { hash: '79b23b30737983d4849caecb907acd4084b0693b22171127800fc6524587afdf',
    required: [inBody('财帛', ['地空'])], text: '財宮地空又是身垣。' }],
  ['p171-001', { hash: '78574dfc71146114c56b5f51c3e4f3507b753b827bc8548ff319bd1ce6cf8a2f',
    required: shenLifeTongLiangWithThreeTransformations() }],
  ['p174-001', { hash: 'aafd2c48d857e94ca820e9fb2799f145e796ce8ca2daddf533029a90e0072497',
    required: flanks('命宫', '擎羊', '七杀') }],
  ['p175-001', { hash: 'ffb868d2ef127b854d884e061a6ab2f464f5d4a8613329820cf6f878b7f055e9',
    required: bodyPalaces.flatMap(palace => flanks(palace, '天魁', '天钺', [bodySeat(palace)])) }],
  ['p178-001', { hash: 'a26645dedf8d1424542af66be0f1da609285e6e159197e861065e047ccba438d',
    required: [haiLifeFallenTianLiang], text: '天梁雖失陷。亦主孤則有福。' }],
  ['p183-001', { hash: 'cf5fe006e43640bfe20d3b62ae2dacbaa443b3b18724308adcf0083088f03ef1',
    required: femaleWeiLianShaMeetingLu }],
  ['p184-001', { hash: '92d292df4a0f9119fc487526ffe6e257110dac632479ceed4457dbf949a57c4e',
    required: [weiLifeLianShaWithNobles] }],
  ['p195-001', { hash: 'ade99e9cceeb40c9aed5855d87817da3d2400e4fd0a7f45b8d5db818ae903030',
    required: ['寅', '申'].map(branch => [at('财帛', branch), ...same('财帛', '天机', '太阴')]) }],
  ['p016-001', { hash: '0b4b99c839a46572c27ba191b9cc819ebe89d8468591a27cd1fa8fca1650e25a',
    required: [[...weiLifeLianShaWithNobles, ...inBody('官禄', ['武曲', '破军']), at('官禄', '亥')]],
    text: '有孤高剛強之心性。聰慧秀麗。' }],
  ['p017-001', { hash: '4504362bf7d6cf8b852f283ab957e4b645d1299336b5e42be64f08c922bd460e',
    required: [[...xuLifeTreasurySupported, ...same('财帛', '铃星'), ...same('官禄', '陀罗'),
      ...same('迁移', '七杀', '擎羊'), relation('命宫', '迁移', 'opposite')]] }],
  ['p021-001', { hash: '9c5e4ebf20cdab96549bcef5b34fafddf5bfea21bebb552473b4958daaaf0db1',
    required: [[...same('子女', '贪狼'), dignity('子女', '贪狼', '陷')]] }],
  ['p024-001', { hash: 'dacb5a23b210505da6bf91f5996688cad37fd610157395a0e47862655f314939',
    required: [[...ziLifeWuFu, dignity('命宫', '武曲', '旺'), dignity('命宫', '天府', '庙'), ...same('命宫', '天魁'),
      ...lifeSector('迁移', '左辅', '文昌'), ...lifeSector('财帛', '右弼', '文曲', '天钺'),
      ...natalTransformationInLifeSector('官禄', '紫微', '科')]] }],
  ['p035-001', { hash: '1ee79332fc078d74d460e41d54e58af08a14aa1ed616a53719d612d95bfccfe8',
    required: [xuLifeTreasurySupported], text: '書云天府臨戌有星拱。腰金衣紫。' }],
  ['p052-001', { hash: '2667b7a1d5bd2a15baa8bec1a6bddea5f2be692b85f639ce05340143825e603d',
    required: [[{ kind: 'natal_gender', gender: '男' }, ...same('夫妻', '擎羊', '破军', '文昌'),
      change('夫妻', '文昌', '忌')]] }],
  ['p057-001', { hash: '62ec85ce25b79ee64241feb4f4230d96d9f9d79337e6dc180d2ef7979584128c',
    required: [[at('命宫', '申'), ...same('命宫', '破军'), ...inBody('夫妻', ['紫微']), at('夫妻', '午')]] }],
  ['p063-001', { hash: '70ddb13ea1fe39303fc1ce12f9285a8a4e321061acf829755fc6588cc116cfaf',
    required: [same('田宅', '禄存', '天同', '太阴')] }],
  ['p068-001', { hash: '71130ad5c2e4a7c6ef7c4207472ebc94fc826bd65952419fd052660cf5d6ed7c',
    required: [[...haiLifeTianLiangWithAfflictions, change('命宫', '天梁', '科')]] }],
  ['p074-001', { hash: '2bc817bceea56462520a884ccba87bda3269991cccfaf3d2618ead2608b2ba37',
    required: [[...weiLifeLianShaWithNobles, ...same('迁移', '天府'), ...lifeSector('官禄', '左辅'),
      ...natalTransformationInLifeSector('财帛', '贪狼', '禄'), ...natalTransformationInLifeSector('财帛', '右弼', '科')]] }],
  ['p079-001', { hash: 'dcab65a182ce1942324e3d7c1589d381deb744adc9debe97f38f5b5dd436b3d9',
    required: [[...inBody('福德', ['巨门', '天机', '文昌', '天刑']), at('福德', '卯'), change('福德', '文昌', '忌')]],
    text: '文昌化忌多管文事。' }],
  ['p082-001', { hash: '881e55b036777fea631f8a20e5c6e9f287306d03205cfa0bb97608971edf2679',
    required: [[...same('田宅', '火星', '地空'), ...same('子女', '擎羊', '破军'), relation('田宅', '子女', 'opposite')]] }],
  ['p083-001', { hash: '1ed6e1f8a96d2a71649905bbd2a6811891f0133910581aa565f39312aacfb118',
    required: [[...same('命宫', '太阳'), change('命宫', '太阳', '权'), ...same('财帛', '禄存'),
      ...same('福德', '巨门'), change('福德', '巨门', '禄'), relation('财帛', '福德', 'opposite')]],
    text: '命垣化權。財宮祿存。又合化祿。本主財權。' }],
  ['p089-001', { hash: '5ca9b9bf9fb859c2710fee482736d7164a0bb260991eed1cecc199eb97cd265c',
    required: [[...wuLifeZiWei, dignity('命宫', '紫微', '庙'), ...same('命宫', '左辅', '禄存'), ...lifeSector('官禄', '天府'),
      ...lifeSector('财帛', '天相'), ...natalTransformationInLifeSector('财帛', '武曲', '禄'),
      ...natalTransformationInLifeSector('迁移', '贪狼', '权')]],
    text: '附有左輔祿存。府相祿權加會。不為孤立。' }],
  ['p090-001', { hash: 'bf33dded75cfa0da846b53a3ab0ed9ad4337656ede5dab04a22b3b796ef39992',
    required: [[...wuLifeZiWei, ...inBody('财帛', ['武曲', '天相']), change('财帛', '武曲', '禄')]] }],
  ['p115-001', { hash: 'e8e8469e9b9ca58030b449a778068e55a797532dbca15c899287b165641a48cd',
    passages: martialAndLiteraryPassages() }],
  ['p128-001', { hash: '8aec5d8e44be2d53e708386148f464e2c09f666adee13113ddbf6e0631f66f50',
    required: [[...tanLangZiOppositeZiWei, bodySeat('命宫'), yearStem('辛'), { kind: 'natal_year_branch', branch: '巳' }]] }],
  ['p136-001', { hash: '9cd8ffcf029dc7102d316d98dcfc81c867b64e906a69283554bef6edf80a531c',
    required: [[...lifeBodySoloTreasury, ...same('迁移', '地空', '地劫')]], text: '行動不安。蓋地空地劫使然。' }],
  ['p139-001', { hash: '84e2709ed1d0b67b2952b3f70fc540dfe0a16a673390e91d9ba347ab6a208228',
    required: lifeOrBody(['紫微', '贪狼']), text: '而心性不常。' }],
  ['p160-001', { hash: '8e9e8b9d281c03e783f2382b217e70512b55382b0b04984be6bbe3eb43ca460b',
    required: [[...same('福德', '天梁'), ...same('财帛', '天马'), relation('福德', '财帛', 'opposite')]],
    text: '天梁合天馬。又是福德宮。' }],
  ['p161-001', { hash: '36fcfe6b2d2778fb1da0186ec2edc0f9f901c7a41758459c4a6d319a67066b25',
    required: [[at('命宫', '卯'), ...same('命宫', '巨门', '天机'), ...inBody('福德', ['文曲']),
      ...same('迁移', '文昌'), relation('命宫', '迁移', 'opposite'), change('福德', '文曲', '科')]],
    text: '化科主文科文藝之事。' }],
  ['p176-001', { hash: '3c60bc7671a1ec0c8dfe22d287f4c29f13678fc3a97611d93ec847bd7b510f2d',
    required: shenLifeTongLiangWithThreeTransformations(), text: '天同化氣為福。天梁化氣為壽。' }],
  ['p179-001', { hash: 'f65a470339d247c7cc752ebc33fb064a6c64fb869d01b461db20b3e938b907eb',
    required: [[...haiLifeTianLiangWithAfflictions, { kind: 'natal_gender', gender: '男' }]] }],
  ['p180-001', { hash: 'a7006926e54218838ae0e31e4e4141a7dc20192e001ed9d8b7f5ee5fec0580cb',
    required: [['辰', '财帛', '子'], ['戌', '财帛', '午'], ['丑', '福德', '卯'], ['未', '福德', '酉']]
      .map(([life, body, branch]) => [at('命宫', life), ...same('命宫', '天同'),
        at(body, branch), ...inBody(body, ['天梁', '文昌'])]), text: '命天同。身天梁。附文昌。' }],
  ['p185-001', { hash: 'd656c861009674a93493e33df82dc11173da9fef6758976849607a30786be537',
    required: [weiLifeLianShaWithNobles] }],
  ['p001-001', { hash: 'db90b58e34e7d4b7287635e0dadd4e16a9abf03697110765c834c8cdc019cb43',
    required: lifeOrBody(['廉贞']) }],
  ['p002-001', { hash: '89a80d5167d2a379d50aea5e4bf1bd076671cfcfb8a4cf4cb21c20b37bd0799b',
    required: [same('官禄', '巨门')] }],
  ['p037-001', { hash: 'ead7912bba3c4e0259217926208de45b6046c48649eeb88dadfa9de1f6e06226',
    required: lifeOrBody(['巨门']) }],
  ['p039-001', { hash: 'c52d998b3e7c22078972313f2445514ff32f090cc46e9b6824b2424b238fa982',
    required: [same('官禄', '天刑')] }],
  ['p071-001', { hash: 'ba37d6f0f04a9d534bc115ba8b7e950b5471e0c71e160b43a64f06038d0cd6e9',
    required: [[at('命宫', '子'), ...same('命宫', '贪狼')], ...bodyPalaces.slice(1)
      .map(palace => [at(palace, '子'), ...inBody(palace, ['贪狼'])])] }],
  ['p093-001', { hash: '33cff954041d4ff680a447f08a3064f65486de354d842fae140b78721936a773',
    required: [[at('夫妻', '寅'), ...inBody('夫妻', ['武曲', '天相']), change('夫妻', '武曲', '忌')]] }],
  ['p096-001', { hash: '73c76c60003941968e496637a6cf721fff9f6dc46301b24e5a1e1cddbba50728',
    required: [[at('命宫', '辰'), at('福德', '午'), ...inBody('福德', ['太阳', '天刑']),
      change('福德', '太阳', '忌')]] }],
  ['p101-001', { hash: 'cbcbc75e08090d0d6bf2a3fedff64d1f96ba08920df546f05a84dad313908856',
    required: [[at('命宫', '戌'), ...same('命宫', '天同', '天刑'), change('命宫', '天同', '忌'), ...lifeSector('迁移', '巨门')]] }],
  ['p105-001', { hash: '59a624a2e70b6dafe4c6b0b73b243816693fdfe5f63c5f53dc890e8b7744c657',
    required: [[...wuLifeZiWei, dignity('命宫', '紫微', '庙'), ...lifeSector('财帛', '天相'), ...lifeSector('官禄', '天府'),
      ...['左辅', '右弼', '天魁', '天钺'].map(star => ({ kind: 'palace_sector_star', palace: '命宫', star }))]],
    text: '紫微正在升殿。得有輔佐。則主權貴矣。' }],
  ['p107-001', { hash: '4d2b501e214d253d052567f9892a64fe97c6c5ab17aea0f52efdfae6f45ceb3a',
    required: lifeOrBody(['贪狼']) }],
  ['p108-001', { hash: '0da5ea149ca01d93f08e549c7947461dfabfa6f485c9293df8165bcb7838b77d',
    required: [[at('命宫', '丑'), ...same('命宫', '紫微', '破军'), change('命宫', '紫微', '权'),
      ...lifeSector('官禄', '文昌'), ...lifeSector('财帛', '文曲')]] }],
  ['p119-001', { hash: 'b5cf3b078408c4e84322628d1f798466c978465c0ded0e8a21ba9910afc20401',
    required: lifeOrBody(['廉贞']) }],
  ['p130-001', { hash: 'a4fe96ad6faef5bbc2644acc31a9e63ba35dd10142bca6e37ae03e8fc5c69e12',
    required: [[...tanLangZiOppositeZiWei, bodySeat('命宫')]] }],
  ['p148-001', { hash: '7be5342849a702e11fb66dde0e7132b831b0fd68ffec5723b24bcf6330aa07cd',
    required: [[...wealthBodySunLuBoshu, change('财帛', '太阳', '忌')]] }],
  ['p149-001', { hash: '4dddb3ff0e62b4cdfa857a5291c47acff10dd13714b110295952315e3c4b9588',
    required: [[...inBody('夫妻', ['擎羊', '破军']), at('夫妻', '戌'), { kind: 'natal_gender', gender: '男' }]],
    text: '身垣臨於妻宮。羊刃在戌。' }],
  ['p152-001', { hash: 'f09eefa255b4a423ace7dcd581e76af2804987b9fb64a9ad79e29eec142d2672',
    required: [[at('命宫', '丑'), ...same('命宫', '廉贞', '七杀', '天魁'), ...lifeSector('迁移', '天钺')]] }],
  ['p154-001', { hash: '63b292d704dce92a372cb63c7ebec734580919b882662612f45ed25bb6a8d0a2',
    required: [[at('福德', '卯'), ...inBody('福德', ['文昌']), ...same('财帛', '紫微', '贪狼'),
      relation('福德', '财帛', 'opposite')]], text: '合紫貪。當然尚於進取。有縱橫孤高之象。' }],
  ['p155-001', { hash: '691585d65837420178d17a4df8ff0e44f875a12570180668511a497cdb65c108',
    required: [[at('福德', '卯'), ...inBody('福德', ['文昌']), ...same('夫妻', '天相', '文曲'),
      ...same('迁移', '天钺'), relation('福德', '夫妻', 'trine'), relation('福德', '迁移', 'trine')]] }],
  ['p159-001', { hash: '69a0e346e5404b64e9802cac511e589d369848648c6d5b20c2da9d1c32127fb1',
    required: [[at('命宫', '申'), ...same('命宫', '文昌'), ...inBody('官禄', ['巨门']),
      ...same('夫妻', '天机', '文曲', '咸池'), relation('官禄', '夫妻', 'opposite')]] }],
  ['p173-001', { hash: '4f58da1cbc89bd7ae03df931c87fe4789a58e64896f2fbe3e49e89b66c9f8eb3',
    required: [[...shenLifeTongLiang, ...same('财帛', '太阴', '火星', '地空'), ...same('福德', '太阳'),
      relation('财帛', '福德', 'opposite')]], text: '財祿因日月相反。火星地空有亦難存。又恐有失。' }],
  ['p177-001', { hash: '924229f8c690cc8b01dfef91ef3d9ce59ee1a7831bec1bdde4245b7b458ce567',
    required: [[...shenLifeTongLiang, ...lifeSector('迁移', '天姚')]], text: '天姚尚風流。' }],
  ['p182-001', { hash: '1d18681b5f6d4a55ca89dd3881427f9683a5b9b9c1ff60e7c589d2efc44e9757',
    cases: femaleLianZhenWithAuspiciousWitnesses() }],
  ['p005-001', { hash: 'd66a5564abb68f121da05c3799d653b23567d39af17f2981d45601ddf6b310a6',
    required: [[...same('官禄', '禄存'), originCount('官禄', 1)]] }],
  ['p006-001', { hash: 'ed7dcd560be7bc93fd467b28b11bf62d66e5318526da3da388bed8f16ce2243c',
    required: [[...same('命宫', '禄存'), originCount('命宫', 1)]] }],
  ['p007-001', { hash: '26f02770ae0502a1c811a55b63ccaaa2f103755138838e70b7b396d7baa654af',
    required: lifeOrBodyMajorState('陷地'), text: '星宿落陷。多好爭強鬧事。奔走不寧。' }],
  ['p008-001', { hash: '70a08f04a03567cd17dfb3ff719f1d720135e0e7180a4f1c04d81f65d857aa0d',
    required: lifeOrBodyMajorState('庙旺'), text: '每每廟旺之星曜。反能退讓落陷之星曜。' }],
  ['p027-001', { hash: '366a15b6bb9a5fdac54fe169043a6d4ae9cd5b2f250a683630490ed282033531',
    cases: cutOffLu, text: '兩祿臨於截路之內。' }],
  ['p049-001', { hash: '2c901a1322f7a3708e3faca738d9054c0ce8ee52236f40a5745271df6794b5f0',
    required: [[at('子女', '午'), ...same('子女', '天梁')]], text: '有點福氣能持重。文藝聰明。好道。' }],
  ['p070-001', { hash: 'fcc29badd02b9f3d11925420640df33c9b1fbc526e12513e74c0740889dc4728',
    required: [[at('命宫', '子'), ...same('命宫', '贪狼'), ...same('子女', '禄存'), { kind: 'natal_gender', gender: '女' }]],
    text: '子女宮祿存主孤。' }],
  ['p118-001', { hash: '397b3136c46082c806b9ff78ae4575d9f41a464fb09c58c7c1d229ecfa321310',
    required: lifeOrBody(['文曲']), text: '蓋此星在十二宮中皆以孤暗論。' }],
  ['p131-001', { hash: '0a8989f31c566652d3116a2438f3bb6cddba588cdd325c09c6185755673ba76b',
    required: [[yearStem('壬'), yearBranch('辰'), at('命宫', '丑'), ...same('命宫', '紫微', '破军'),
      at('夫妻', '亥'), ...inBody('夫妻', ['禄存', '红鸾'])]], text: '祿存守身垣。主孤主財。' }],
  ['p151-001', { hash: 'b11d103980276ad3c25b98328b54ee8d003a18f4193da608b500c48e32ee0ddf',
    required: [[yearStem('己'), yearBranch('丑'), at('田宅', '巳'), ...same('田宅', '陀罗'),
      at('子女', '亥'), ...same('子女', '廉贞', '贪狼'), at('财帛', '戌'), ...inBody('财帛', ['太阴', '寡宿'])]],
    text: '又田宅宮為陀羅。' }],
  ['p157-001', { hash: 'c9638d7cc80a8505128230800e6ad61d6e09187bf9a97ee2e5c3cc6578528f33',
    required: [[yearStem('戊'), yearBranch('寅'), ...tanLangZiOppositeZiWei,
      at('官禄', '辰'), ...inBody('官禄', ['七杀', '陀罗']), relation('命宫', '官禄', 'trine')]],
    text: '七殺守身垣金物屬。陀羅亦金石屬。' }],
  ['p168-001', { hash: 'b4d72e3dfb82ca03d791876ce798a0b9cda18b478f768253ac717a0c7a2ee290',
    passages: [
      { required: [[at('官禄', '未'), ...same('官禄', '武曲', '贪狼', '擎羊')]],
        text: '羊刃主武職。武貪亦主武職。' },
      { required: [[yearStem('己'), yearBranch('丑'), at('命宫', '卯'), ...inBody('命宫', ['廉贞', '破军']),
        at('官禄', '未'), ...lifeSector('官禄', '武曲', '贪狼', '擎羊', '旬空')]],
        text: '臨於旬空。宜於僧道。' },
    ] }],
]);

export function compileGuanceluNatal(claim) {
  if (!claim.id.startsWith(sourcePrefix)) return undefined;
  const spec = reviewed.get(claim.id.slice(sourcePrefix.length));
  if (!spec) return undefined;
  const { source, conditions, evidence } = claim;
  const hash = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  const passages = spec.passages ?? (spec.text ? [spec] : []);
  if (hash !== spec.hash || passages.some(({ text }) => !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《斗数观测录》本条依据、宫位或分句已变，须重新复核。' };
  }
  const compileInputs = ({ required, mustBeAbsent, cases }) => (cases ?? required.map(group =>
    ({ required: group, mustBeAbsent }))).map(input => normalizeRuleInput('ziwei', input));
  if (!passages.length) return { compiler: guanceluNatalProfile, inputs: compileInputs(spec) };
  return { reason: 'unmapped_condition', condition: '《斗数观测录》只按已核本命分句引用',
    branches: passages.map(({ text, ...passage }) => ({ text, conditionCompiler: guanceluNatalProfile, inputs: compileInputs(passage) })) };
}
