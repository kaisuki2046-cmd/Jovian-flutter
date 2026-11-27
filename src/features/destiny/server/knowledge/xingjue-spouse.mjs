import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueSpouseProfile = 'ziwei-xingjue-spouse-v1';
export const xingjueSpouseConfigurationProfile = 'ziwei-xingjue-spouse-configuration-v1';
const prefix = 'ziwei-v3-xingjue-049-p';
const palace = '夫妻';
const scope = 'origin';
const starAt = (seat, star) => ({ kind: 'palace_star', palace: seat, star, scope });
const same = (...stars) => stars.map(star => starAt(palace, star));
const at = (branch, ...stars) => [{ kind: 'palace_branch', palace, branch }, ...same(...stars)];
const sector = (...stars) => stars.map(star => ({ kind: 'palace_sector_star', palace, star }));
const sectorChange = (change, seat = palace) => ({ kind: 'palace_sector_mutagen', palace: seat, change });
const localChange = (change, seat = palace) => [{ kind: 'palace_mutagen', palace: seat, change, scope }, sectorChange(change, seat)];
const starChange = (star, change) => ({ kind: 'star_mutagen', palace, star, change, scope });
const relationship = (target, relation) => ({ kind: 'palace_relation', anchor: palace, target, relation });
const position = (target, relation, star) => [relationship(target, relation), starAt(target, star)];
const outward = [['迁移', 'trine'], ['福德', 'trine'], ['官禄', 'opposite']];
const outside = star => outward.map(([target, relation]) => position(target, relation, star));
const withOutside = (required, first, second) => [{
  required,
  anyOf: outside(first).flatMap(firstSeat => outside(second).map(secondSeat => [...firstSeat, ...secondSeat])),
}];
const mainCount = count => ({ kind: 'palace_main_count', palace, count });
const coreCount = count => ({ kind: 'palace_core_star_count', palace, count });
const phase = value => ({ kind: 'palace_changsheng_phase', palace, phase: value });
const phaseOptions = values => values.map(value => [phase(value)]);
const bureau = value => ({ kind: 'natal_ziwei_bureau', bureau: value });
const phases = '长生 沐浴 冠带 临官 帝旺 衰 病 死 墓 绝 胎 养'.split(' ');
const sixMalefics = '擎羊 陀罗 火星 铃星 地空 地劫'.split(' ');
const boshiExceptLishi = '博士 青龙 小耗 将军 奏书 飞廉 喜神 病符 大耗 伏兵 官府'.split(' ')
  .map(star => [{ kind: 'palace_boshi_star', palace, star }]);

// Qing manuscript, pp. 148–153. Conditional clauses retain the antecedent
// from the same entry even when the stored quotation starts after it.
const yearBranch = branch => ({ kind: 'natal_year_branch', branch });
const trineStar = star => ({ kind: 'palace_trine_star', palace, star });
const suiqian = star => ({ kind: 'palace_suiqian_star', palace, star });
const spouseBenefics = '左辅 右弼 文昌 文曲 天魁 天钺 禄存'.split(' ');
const ziSpouseKongJie = [...at('亥', '地空', '地劫'), { kind: 'natal_ziwei_hour', branch: '子' }];
const oppositeAt = (branch, star) => [
  relationship('官禄', 'opposite'), { kind: 'palace_branch', palace: '官禄', branch }, starAt('官禄', star),
];
const backturnedLights = [
  [...at('戌', '太阳'), ...oppositeAt('辰', '太阴')],
  [...at('辰', '太阴'), ...oppositeAt('戌', '太阳')],
];
const youSpouseSoloQu = [...at('酉', '文曲'), { kind: 'palace_confirmed_body_seat', palace }, mainCount(0), coreCount(1),
  ...oppositeAt('卯', '天机'), ...position('福德', 'trine', '太阴'),
  { kind: 'palace_branch', palace: '福德', branch: '丑' }];
const goldSpouseWubi = () => [...'申酉'].flatMap(branch => withOutside([...at(branch, '武曲', '右弼'), bureau('金四局')], '紫微', '天府'));

const reviewed = new Map([
  ['610-001', ['3d8ea19c7676f03ddfedd58dfc1394a1d0c0542c72f6da6efe07e900787fa252',
    ['妻宮太陰科星同入者必登第', same('地空', '地劫').map(fact => ({
      required: [...same('太阴'), ...localChange('科')], mustBeAbsent: [fact],
    }))],
    ['若空刧同宮、小科可成、大科難望', [[...same('太阴', '地空', '地劫'), ...localChange('科')]]],
  ]],
  ['611-001', ['22a84785d9b707d4afefb7f75fab8386c575fc49bdb0b0aca7fe95f569bdaa8c',
    [null, [at('辰', '七杀', '地劫')]],
  ]],
  ['619-001', ['68ccb1c669dfc73ef903556372ed7176992520b28df3fafa412b02688b044bb6',
    [null, [at('酉', '天同', '天刑')]],
  ]],
  ['623-001', ['8f15249212c6ad4ff1d5fd1de7de99c7c3aa9324e70ddfd90b079eb09dcb16ad',
    [null, [['左辅', '天同'], ['天同', '左辅']].map(([before, after]) => [
      ...same('三台'), ...position('兄弟', 'adjacent', before), ...position('子女', 'adjacent', after),
    ])],
  ]],
  ['624-001', ['5c4f24d772084b2de7211f4789f766853258eb26a9028a0d035b9e8966c14fc7',
    [null, [
      [...same('禄存'), ...localChange('禄')],
      { required: [...same('禄存'), sectorChange('禄')], anyOf: outward.map(([target, relation]) => [
        relationship(target, relation), { kind: 'palace_mutagen', palace: target, change: '禄', scope },
      ]) },
      { required: localChange('禄'), anyOf: outside('禄存') },
    ]],
  ]],
  ['626-001', ['6f9f41d9a1ceb3b4601f5d273869f38101d3da5ed38a6d920c644ac35693dc22',
    ['妻宮池相紫曲同守最吉', [{
      required: same('龙池', '天相', '紫微', '文曲'), anyOf: phaseOptions(phases.filter(value => value !== '绝')),
    }]],
  ]],
  ['627-001', ['2819c16e694b31f51b2be75806509b14718ea3ea820d7f3ac1f37cdbd2b3cbaa',
    [null, withOutside(same('台辅'), '太阳', '太阴')],
  ]],
  ['628-001', ['599a9d5a0fe19b18a8de1b5de33aee9704590e0a4074cebd5304719ea8160592',
    [null, ['辰', '戌'].map(branch => [...at(branch, '天机', '天梁', '凤阁'), ...localChange('科')])],
  ]],
  ['630-001', ['67b193ccd6273beeb9b4c37c53f09e21889e26a81105baffe24480894ffe9252',
    ['寅妻紫府夫婦溫和', [
      { required: at('寅', '紫微', '天府'), mustBeAbsent: same('地空') },
      { required: at('寅', '紫微', '天府', '地空'), anyOf: boshiExceptLishi },
    ]],
  ]],
  ['1339-001', ['6de3441356b82363a3e4a35174c26ccde2eec7126ac99e0813cd8f127ff6f35c',
    [null, [[...same('天梁'), mainCount(1), { kind: 'palace_confirmed_body_seat', palace }, ...localChange('权')]]],
  ]],
  ['1341-001', ['06404f5eb4625f01b7730d114dd5cccf6b9c01853f3243c8482f921d20e21e8f',
    [null, same('地空', '地劫').map(fact => ({
      required: at('巳', '天机'), anyOf: ['水二局', '木三局', '土五局', '火六局'].map(value => [bureau(value)]),
      mustBeAbsent: [fact],
    }))],
  ]],
  ['1342-001', ['7a3d66b35bdbc4d2c4fc4ad35f300c5cbf9d4d555362bb8772cc8b958a23c26f',
    [null, [[...same('文昌'), starChange('文昌', '科'), ...localChange('科'),
      ...sector('太阳', '太阴', '天魁', '天钺', '文曲'), sectorChange('权')]]],
  ]],
  ['1343-001', ['020c1b74a5b2a502d3eb3ee2a46eed683d543cc2826cc1ec960bccb87d97f2d3',
    ['馬在妻宮遇陀、夫婦不和', [same('天马', '陀罗')]],
  ]],
  ['1344-001', ['0e4b4f94b4d88861fd359c480564fc4d073f1dcc87e9152f52c559f15c5ebd33',
    ['妻宮亥地遇武破空刧天馬同守、夫婦傷恩', [at('亥', '武曲', '破军', '地空', '地劫', '天马')]],
  ]],
  ['1345-001', ['185244cefc997ca19394c7bd1f32eb3addb5939c902277727b7041279f045425',
    [null, [{
      required: [starAt('命宫', '天同'), starAt('命宫', '天梁')],
      anyOf: ['长生', '帝旺'].flatMap(value => sixMalefics.map(star => [phase(value), ...same(star)])),
    }]],
  ]],
  ['1346-001', ['e4839cde5ff8a11a7e126db212fb7399a3720d5d81c5c48a8c6c1b970917c899',
    ['水局人卯地妻宮、紫貪同居則同稠偕老', [{
      required: [...at('卯', '紫微', '贪狼'), bureau('水二局')], mustBeAbsent: same('火星'),
    }]],
    ['而火星同居則時發不平辭色', [[...at('卯', '紫微', '贪狼', '火星'), bureau('水二局')]]],
  ]],
  ['1347-001', ['d18d3070b5e4c370174463545a38f507031b85273e229bc15b0799b9cfba7c2f',
    [null, [[...at('戌', '天同'), mainCount(1), bureau('水二局')]]],
  ]],
  ['1348-001', ['0c976a2047552fb22d92a670c6b2fdcfd686b50543e752d747b0217074adcc0b',
    ['火局申妻、七殺為主星、右弼同、得賢妻', [[...at('申', '七杀', '右弼'), mainCount(1), bureau('火六局')]]],
    ['天鉞紅鸞同宮尤奇', [[...at('申', '七杀', '右弼', '天钺', '红鸾'), mainCount(1), bureau('火六局')]]],
  ]],
  ['1352-001', ['8d253e465c636a69226b2e3486a469c76e82559bf2c5b0c22f95e5c2cebd7de3',
    ['妻宮月曲同居、祿馬雙朝、萬不得一、貴格也', withOutside(same('太阴', '文曲'), '禄存', '天马')],
  ]],
  ['1354-001', ['94f396992584459b400660f682da1a271c669208df00f93e8d30386656319042',
    ['妻宮午地破軍單守者', [[...at('午', '破军'), mainCount(1)]]],
  ]],
  ['1359-003', ['74d3fd47b088f523b0acf5b8ca4f670c2ab1d0cda4d9892617e2b18136ce188c',
    ['陀鈴同居者不和', [at('亥', '天机', '陀罗', '铃星')]],
  ]],
  ['1367-001', ['70b6baae2d470483688e1f3f16e04443edd0f6c60e0f1e5b777f13dd2b483b44',
    [null, [same('禄存', '天马', '封诰')]],
  ]],
  ['1369-001', ['176953e63cdef1e26b8da156ecf7cfc071c0441f7fd91dc2886e6f21612432bb',
    [null, [[...at('亥', '陀罗'), mainCount(0), coreCount(1), phase('病')]]],
  ]],
  ['1374-001', ['85b7b1531892a313cd1d4a0d0cae3654bed655d1cd21ca45573057d5cc3abdfc',
    [null, [{
      required: sector('紫微', '天府', '文曲'), mustBeAbsent: same('紫微', '天府', '文曲'),
    }]],
  ]],
  ['1375-001', ['0693834809a11c11ebc3ddcb31706cf4a2cb27eabb29980c65f7f74fa6012761',
    ['馬在妻、哭同居、相剋', [same('天马', '天哭')]],
  ]],
  ['609-001', ['7df19b1f55ca9ee2e2961ad75baab7d1e8a1fb681605779ba3decc59435e94d4',
    ["子時生人、妻宮坐亥地、例克妻、妻空刧並守故也", [ziSpouseKongJie]],
    ["金局人則其禍尤速", [[...ziSpouseKongJie, bureau('金四局')]]],
  ]],
  ['613-001', ['15e1c55b1b04f0c5461d4e557ea27bf936c6eae32f1b9607cb552e3b488436f4',
    [null, goldSpouseWubi()],
  ]],
  ['614-001', ['ae2c2056a9e6e801040c90e828de87411527bd5f0f7f199593dc21d16d1fc4e6',
    ["亥地妻宮天梁文曲同守", [at('亥', '天梁', '文曲')]],
  ]],
  ['615-001', ['9ddf5d63dc97648c4bf7688cfda920742a062db2ddd83d88514a04fe48009743',
    ["戌生妻宮在戌、太陰坐守得美妻", [[...at('戌', '太阴'), yearBranch('戌')]]],
  ]],
  ['617-001', ['42a9f8307df56515b65304d5d837f412b79aab1ee283b998b97e001f9b0ba9bb',
    ["妻宮反背日月遇火忌、反目不和", [[...backturnedLights[1], ...sector('火星'), sectorChange('忌')]]],
    ["羊忌相合、琴瑟殺聲", backturnedLights.map(required => [
      ...required, ...sector('擎羊'), sectorChange('忌'),
    ])],
  ]],
  ['625-001', ['b560175913654679e7be1b9fbdac2df24dfc56819a6210bb176be620604a0d76',
    [null, [[...same('天梁', '右弼'), phase('绝'), ...position('官禄', 'opposite', '地空'), starAt('官禄', '地劫')]]],
  ]],
  ['1349-001', ['1bf8f29c1ae249b0b5c2a36992118e0046bebe5eba8ebf34de9833f08c370c87',
    [null, [...'丑寅未申戌辰'].map(branch => ({ required: at(branch, '七杀'), anyOf: spouseBenefics.map(star => sector(star)) }))],
  ]],
  ['1341-002', ['0d947a41395907a24cebb04e4f76c9f14480687f139776d36b639585a4c812b3',
    ["妻宮坐巳地、天機坐守者為貴、而若金局人遇之則局傷其星、難免叩盆", [[...at('巳', '天机'), bureau('金四局')]]],
  ]],
  ['1341-003', ['3037213c9ce94636b24097bd59ced185cd378c15dc29107efdd7ca9bc7c5d533',
    ["空刧同守則屢張花燭", [at('巳', '天机', '地空', '地劫')]],
  ]],
  ['1351-001', ['133b992745a01fd6e7f4e8a4f0cfc6558b267372dd85999a4197410ce2b10207',
    ["妻宮火鈴單守不好", ['火星', '铃星'].map(star => [...same(star), mainCount(0), coreCount(1)])],
    ["而若免死絕地、天府同居、祿馬相合、化祿來朝、和合偕老", [{
      required: [...same('天府', '火星'), ...sector('禄存', '天马'), sectorChange('禄')],
      anyOf: phaseOptions(phases.filter(value => !['死', '绝'].includes(value))),
      mustBeAbsent: [{ kind: 'palace_mutagen', palace, change: '禄', scope }],
    }]],
  ]],
  ['1353-001', ['d128989db43accb5b3776e258b80d8f2d45c09cc2d21f5e18f207750de896c36',
    ["妻宮天相必因親戚成姻", [same('天相')]],
    ["與天姚同居多賤妾", [same('天相', '天姚')]],
  ]],
  ['1355-001', ['ce5f7151595278dd95d7363ece46d65b4a69a9a75e0f5c363b860556ee24a33e',
    ["太陰會文曲於妻宮得財", [[...same('太阴'), ...sector('文曲')]]],
  ]],
  ['1356-001', ['cda7a2f77b11e63faec2f0e5805f8e3d91fac1371140c29881cb22704e7599d1',
    ["妻宮太陰坐守、昌曲來照者早科", withOutside(same('太阴'),'文昌', '文曲')],
    ["若坐卯地逢刑忌則神速", withOutside([...at('卯', '太阴'), ...sector('天刑'), sectorChange('忌')],'文昌', '文曲')],
  ]],
  ['1357-001', ['b07cb00241337bd4ad4ee2467737d7a348a7ab52d8938cc93a10e10306297192',
    ["妻宮日月同梁昌曲照守成格者、和諧無剋", [{ required: sector('太阳', '太阴', '天同', '天梁', '文昌', '文曲'),
      anyOf: ['太阳', '太阴', '天同', '天梁'].map(star => same(star)) }]],
  ]],
  ['1358-001', ['ed37ee0de9c336195f9e972029630401e8e4d1dbff89889e2d2c9671b872deab',
    ["妻宮酉地、鈴星與羊陀火忌拱會者甚不吉、夫婦不和且有叩盆", [{ required: [...at('酉', '铃星'), ...sector('擎羊', '陀罗', '火星'), sectorChange('忌')],
      mustBeAbsent: same('擎羊', '陀罗', '火星') }]],
  ]],
  ['1359-001', ['1737748c5aafdef6e91269f30772aba261933350b599121d6f68049fad80a58f',
    [null, [at('亥', '天机')]],
  ]],
  ['1359-004', ['f87fedeaf767ade50a3a407cf01f120697362df7e1d0870fc6e87919fc4c28a6',
    ["馬在本宮者生離死別", [at('亥', '天机', '天马')]],
  ]],
  ['1359-005', ['a999ec42bdd36f55f34e07b9a8f348e56a4620da2fce3c800b66758a579dea52',
    ["兼得空刧沖會者叩盆", withOutside(at('亥', '天机', '天马'),'地空', '地劫')],
  ]],
  ['1360-001', ['702354328952ac8b12d639fcf39ecdb428a0b9bd3441cd9b35b31492b440adb0',
    ["酉地身妻宮、文曲單守、卯上機、丑上月照者早科", [youSpouseSoloQu]],
    ["但貞破夾則晚成多災", [[...youSpouseSoloQu, ...position('子女', 'adjacent', '廉贞'), ...position('兄弟', 'adjacent', '破军')]]],
  ]],
  ['1361-001', ['33dd31d1319e058363faf1bb304eb8b1d061fe8687b0933f928eb682c00e3929',
    [null, [[...same('文曲'), ...sector('擎羊', '陀罗')]]],
  ]],
  ['1366-001', ['a2eaa87b13f1eda0e2ec2c85b994c324777c886a849579e779c15972cdb22385',
    ["妻宮天梁單坐和", [{ required: [...same('天梁'), mainCount(1)], mustBeAbsent: [palace,...outward.map(([target])=>target)]
       .flatMap(target => ['地空', '地劫', '陀罗', '七杀'].map(star => starAt(target,star))) }]],
    ["合夾空刧陀七相剋", [[...same('天梁'), mainCount(1), ...sector('地空', '地劫'),
      ...position('兄弟', 'adjacent', '七杀'), ...position('子女', 'adjacent', '陀罗')]]],
  ]],
  ['1373-001', ['bb1fe8c3537ccac850cbd5a52adb8e64b84fe353a776c0d92f791882c06eeb33',
    [null, [[...at('辰', '天机', '天梁', '陀罗'), suiqian('吊客')]]],
  ]],
  ['1376-001', ['5b0acb8a98f7df9a4fa419900126aca16c8a1a7d62adebd82a81bbf96b249c4b',
    [null, [at('戌', '天府', '廉贞', '擎羊', '文曲')]],
  ]],
  ['1377-001', ['7d9dbeb9834c1d7ddea177ad9e796d8104e58afd62fb156ae2c55da656817b77',
    ["火鈴忌相合於妻宮、生離死別。", [{ required: [...sector('火星', '铃星'), sectorChange('忌')], anyOf: ['火星', '铃星'].map(star=>same(star)) }]],
  ]],
  ['1380-001', ['976d7e1b182dd860d3f7948f06c3b3ebf471c60a007e5f8c045505b8ff21e010',
    ["金局人妻宮武曲右弼坐守於金鄉、紫府朝照則夫婦和合、且得賢妻", goldSpouseWubi()],
  ]],
  ['1381-001', ['4d6394110281ecea2b687d53261295d29f1a3bac7596f4d93bea7254cb5bbc82',
    ["妻宮丑地空羊早剋。", [at('丑', '地空', '擎羊')]],
  ]],
  ['1381-002', ['f93ee70f49eac51f3935f30ec8e36066dfdd8ce1795fe9e6da3a734ea93222c3',
    ["妻宮羊虎同居者", [[...same('擎羊'), suiqian('白虎')]]],
    ["雖未地羊刃、必早剋", [[...at('未', '擎羊'), suiqian('白虎')]]],
  ]],
  ['1381-003', ['461e3f6b4a7d7bd36cbbc3aaed8d4f21474cfb8fb2ac134c10bc1453938a6343',
    [null, [at('辰', '七杀', '天刑')]],
  ]],
  ['1383-001', ['727af94d3ca6beddc30e36cd67483277c76292a2ef09a37ba4850731e5437f6e',
    ["妻宮七殺、勿論得失地、叩盆", [same('七杀')]],
  ]],
  ['1383-002', ['336ae136cc4f1153814dfdb52b011c6a382aab946a9ad1efed194417eb7d2c1e',
    ["與昌曲同居者", [same('七杀', '文昌', '文曲')]],
  ]],
  ['1384-003', ['14990d92270db98e7234d1952f21545a76aca2f85880f4829f2aaf4675a9b52a',
    [null, [at('子', '廉贞', '天相', '左辅', '文曲', '擎羊')]],
  ]],
  ['1385-001', ['9887698e3c8afd9e6402461b8479e6b189ec4aea2035876cb35ac8ee1238b4e7',
    ["土局人妻宮遇破軍水文昌水同守", [[...same('破军', '文昌'), bureau('土五局')]]],
  ]],
  ['1385-002', ['a443b629bc086a4ce540cde6c7d4f3ff4748d9338b70f3208e5af2867e15229d',
    ["妻宮巳亥貪貞遇火忌者", [[...at('巳', '贪狼', '廉贞'), ...sector('火星'), sectorChange('忌')]]],
  ]],
  ['1386-001', ['0fece6d900d843190802dfe297c587ef852c75a659f89ef3ebe929b9546dc9bc',
    ["木局尤凶", [[...at('辰', '七杀', '地劫'), bureau('木三局')]]],
  ]],
  ['1386-002', ['646781b1f62393f3de8dbbf99be7b9005b820bc2655647353017c39776fa676c',
    [null, [[...same('廉贞'), ...['擎羊', '地空', '地劫'].map(trineStar)]]],
  ]],
  ['1387-002', ['6619f7148de407a7e294c837575a728ffd4a31b9ca43536c8f89a1b8ad7e3781',
    ["丑妻梁空刧傷剋。", [[...at('丑', '天梁'), ...sector('地空', '地劫')]]],
  ]],
  ['1388-001', ['be12cd1fd9367c83a0d5bfb0261f0ec934a2b4d4a36ac29c17b70f45b272bdb6',
    [null, [same('七杀')]],
  ]],
  ['1389-002', ['da34cadac344c3b37bdd66c5f2f3cca53f73de39ac464f48c5dbc7a56c8eac90',
    ["鈴昌曲相會妻宮、羊合陀拱者", [[...same('铃星'), ...sector('文昌', '文曲', '擎羊'), trineStar('陀罗')]]],
  ]],
  ['1390-003', ['35c3292ca3251bd650f1039ef990373a635a10837c905df6b5d7eb64b1c3ec1c',
    [null, [same('天梁', '火星')]],
  ]],
]);

const routeVoids = ['截路', '空亡'];
const externalChange = change => outward.map(([target, relation]) => [
  relationship(target, relation), { kind: 'palace_mutagen', palace: target, change, scope },
]);
const youTongFire = at('酉', '天同', '火星');
const youTongFireWithChenTan = [
  ...youTongFire, { kind: 'ziwei_confirmed_natal_layout' }, { kind: 'palace_branch', palace: '仆役', branch: '辰' },
  starAt('仆役', '贪狼'), starAt('仆役', '地空'),
];
const lianPoJi = [...same('廉贞', '破军'), ...localChange('忌'), starChange('廉贞', '忌')];

const reviewedConfigurations = new Map([
  ['620-001', ['421b894cee859a9b91ae0c482211d1962d98869cc450a341328595e9b5567e41',
    ['權祿同守', [palace, '子女'].map(seat => [...localChange('权', seat), ...localChange('禄', seat)])],
  ]],
  ['629-001', ['e63a3fea2bd8fc5dd1d50d20acfcab1cb4ba506b014c0589d3a0b33ed51e8f71',
    ['合多得妻財因妻發', [
      { required: [...sector('禄存', '武曲', '天相'), sectorChange('禄')], mustBeAbsent: same('禄存'),
        anyOf: externalChange('禄') },
    ]],
  ]],
  ['1350-001', ['2ff7752db4b7756860b92bccd1b9a108ab3a29679c0f70b1c013f0de1242d0bc',
    ['妻宮地空落在旬路二空', routeVoids.map(star => same('地空', '旬空', star))],
    ['武七貞姚齊會', [[...same('地空', '旬空', '截路'), ...sector('武曲', '七杀', '廉贞', '天姚')]]],
  ]],
  ['1362-001', ['5f84aab2884b8c1b069bce256f5a08e17586541b154c31849fd1a22234714216',
    ['妻宮反背太陰與權星同居', [[...backturnedLights[1], ...localChange('权'), starChange('太阴', '权')]]],
  ]],
  ['1363-001', ['4cfac9fbc15f75abf28eb2c4c07039189957f75ba037b1bafc834e4b02044b29',
    ['喪地七殺在妻宮落空與羊刧會者', ['地空', '旬空', '截路', '空亡'].map(star => [...same('七杀', star), suiqian('丧门'), ...sector('擎羊', '地劫')])],
  ]],
  ['1379-001', ['57b9cfed40aa8bba387b591075b31606586f6051a4b51c68dbe57e8e9ae34c95',
    ['天府兩祿落空於妻宮', ['地空', '天空'].map(star => [...same('天府', '禄存', star), ...localChange('禄')])],
  ]],
  ['1382-001', ['276ab0d6d28b720996567a62178f41c156481a2924b65b8ae2c362e9d93bd0f9',
    ['妻宮破軍天空鈴星', [same('破军', '天空', '铃星')]],
  ]],
  ['1382-002', ['1c753bda820604281ba3886de0ce790abafef7a0c56b20d0fa4798dee2b4b871',
    ['妻宮酉地天同火星', [youTongFire]],
    ['與貪空相合', [youTongFireWithChenTan]],
    ['武殺成夾', [[...youTongFireWithChenTan, ...position('兄弟', 'adjacent', '武曲'), ...position('子女', 'adjacent', '七杀')]]],
  ]],
  ['1383-003', ['2077dbdd04c508b2592c43d87ca6977aec9b61c8aa47712c2c4f3af85c336b67',
    ['戌妻文昌太陽化忌落空', [[...at('戌', '文昌', '太阳', '旬空'), ...localChange('忌'), starChange('太阳', '忌')]]],
  ]],
  ['1384-002', ['b9c1571786e461543cb6da3fc9d55aa80a322065f0c1cdb39168d81a7ff86431',
    ['妻宮貪昌左輔', [same('贪狼', '文昌', '左辅')]],
    ['落空', ['旬空', '天空', '截路'].map(star => same('贪狼', '文昌', '左辅', star))],
  ]],
  ['1385-003', ['0b5e4ba8292e2a1e28561c0ca90e9d99cd012bed80e56596b53c00e1b9055652',
    ['妻宮羊火落空', ['地空', '旬空', '天空', '空亡'].map(star => same('擎羊', '火星', star))],
  ]],
  ['1387-001', ['1487222ab0ef6087b2842e579bebe476ce61287a5d824c3b0c14a9885a1dc13e',
    ['妻宮落空、對宮犯旬空者', ['地空', '截路', '空亡'].map(star => [...same(star), ...position('官禄', 'opposite', '旬空')])],
  ]],
  ['1390-001', ['3423b463bfcc93c45e3a9d0d6c29195cb548b67c33c65ceefd1126ca29943132',
    ['申宮巨日忌落空於妻宮者', [['巨门', ['地空', '天空']], ['太阳', ['地空', '旬空', '截路']]].flatMap(([host, voids]) => voids.map(star => [
      ...at('申', '巨门', '太阳', star), ...localChange('忌'), starChange(host, '忌'),
    ]))],
  ]],
  ['1390-002', ['5793ad9f297030676b265a09347806575a5fb427550de7771f0c05ebaea569a1',
    ['羊鈴落空於妻宮', ['旬空', '天空', '空亡'].map(star => same('擎羊', '铃星', star))],
  ]],
  ['1391-001', ['3ad26813b141c0bbbd836578ecfebf7d677a46452e4a55334603aa7c1d805caf',
    ['貞破忌', [lianPoJi]],
  ]],
]);

export const xingjueSpouseRepeatedPassages = new Map([
  [prefix + '613-001', {
    id: prefix + '1380-001', text: '金局人妻宮武曲右弼坐守於金鄉、紫府朝照則夫婦和合、且得賢妻',
  }],
]);

export function compileXingjueSpouse(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const id = claim.id.slice(prefix.length);
  const configuration = reviewedConfigurations.get(id);
  const spec = configuration ?? reviewed.get(id);
  if (!spec) return undefined;
  const [hash, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== hash || passages.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》夫妻篇的原文、出处或条件有变化，须重新核对。' };
  }
  const branches = passages.map(([text, groups]) => ({
    text,
    conditionCompiler: configuration ? xingjueSpouseConfigurationProfile : xingjueSpouseProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group)),
  }));
  if (!branches[0].text) return { compiler: xingjueSpouseProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》夫妻篇已核盘式与分句匹配', branches };
}
