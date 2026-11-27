import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';

export const xingjueMigrationProfile = 'ziwei-xingjue-migration-v1';
const prefix = 'ziwei-v3-xingjue-053-p';
const palace = '迁移';
const scope = 'origin';
const starAt = (seat, star) => ({ kind: 'palace_star', palace: seat, star, scope });
const branchAt = (seat, branch) => ({ kind: 'palace_branch', palace: seat, branch });
const same = (...stars) => stars.map(star => starAt(palace, star));
const at = (branch, ...stars) => [branchAt(palace, branch), ...same(...stars)];
const sector = (...stars) => stars.map(star => ({ kind: 'palace_sector_star', palace, star }));
const sectorChange = (seat, change) => ({ kind: 'palace_sector_mutagen', palace: seat, change });
const localChange = (change, seat = palace) => [
  { kind: 'palace_mutagen', palace: seat, change, scope }, sectorChange(seat, change),
];
const starChange = (star, change) => ({ kind: 'star_mutagen', palace, star, change, scope });
const adjacent = target => ({ kind: 'palace_relation', anchor: palace, target, relation: 'adjacent' });
const lifeOpposite = { kind: 'palace_relation', anchor: palace, target: '命宫', relation: 'opposite' };
const doubleLu = [...same('禄存'), ...localChange('禄'), lifeOpposite];
const guardsAndLiterary = same('天官', '文昌', '文曲');
const flanks = [['疾厄', '仆役'], ['仆役', '疾厄']];
const outsideSector = ['兄弟', '子女', '财帛', '疾厄', '仆役', '官禄', '田宅', '父母'];
const otherPalaces = [...outsideSector, '命宫', '夫妻', '福德'];
const literaryStars = ['文昌', '文曲'];
const threeChanges = [...'禄权科'].map(change => sectorChange(palace, change));
const trine = star => ({ kind: 'palace_trine_star', palace, star });
const fallen = star => ({ kind: 'palace_brightness', palace, star, scope, brightness: '陷' });
const growth = phase => ({ kind: 'palace_changsheng_phase', palace, phase });
const mainCount = count => ({ kind: 'palace_main_count', palace, count });
const quietTianji = branch => [...at(branch, '天机'), mainCount(1),
  { kind: 'palace_sector_six_malefic_count', palace, count: 0 }];
const tianjiLu = branch => [
  ...quietTianji(branch), ...localChange('禄'), starChange('天机', '禄'),
  lifeOpposite, starAt('命宫', '太阴'), sectorChange('命宫', '忌'),
  { kind: 'star_mutagen', palace: '命宫', star: '太阴', change: '忌', scope },
];
const oxXiangWithLiteraryStars = [...at('丑', '天相'), ...sector('文昌', '文曲')];
const hiddenJade = [...'子午'].map(branch => [
  ...at(branch, '巨门'), { kind: 'natal_year_stem', stem: '辛' }, ...threeChanges,
]);
const facingNobles = [['天魁', '天钺'], ['天钺', '天魁']].map(([here, there]) => [
  ...same(here), starAt('命宫', there), lifeOpposite,
]);
const cleanTianji = branch => ({
  required: [...at(branch, '天机'), { kind: 'palace_main_count', palace, count: 1 },
    { kind: 'palace_sector_six_malefic_count', palace, count: 0 }],
  anyOf: outsideSector.map(seat => localChange('忌', seat)),
});

// Qing manuscript, pp. 165–168. Retain the preceding fire-bureau heading
// for Taiyin/Huoxing and use exact independent fragments for partial entries.
const reviewed = new Map([
  ['683-001', ['647baace7f607282b423e07989f3ef857a7542a10ab1a4a4351b57e0a7310d10',
    ['雙祿居遷為雙祿朝命格', [doubleLu]],
    ['若得天官天貴同照、能以賤化貴', [[...doubleLu, ...same('天官', '天贵')]]],
  ]],
  ['685-001', ['a6484988f85d851360b17bffac485a89420b74f5f231f1c9a8af74c401cfd7fa',
    [null, [[...same('太阴', '火星'), { kind: 'natal_ziwei_bureau', bureau: '火六局' }]]],
  ]],
  ['686-001', ['8dbc08ba537fefeadd4f3e2b282dba196a09ff868e1075976e414c773977ba59',
    ['遷宮紫府同宮', [same('紫微', '天府')]],
  ]],
  ['687-001', ['bd07b7b48c9994c83db43bcd6158ecb2b35b90fd3c45cd2651a641a814c15e21',
    [null, [[...same('文昌'), starChange('文昌', '科'), ...localChange('科'), lifeOpposite]]],
  ]],
  ['690-001', ['d3a3ba66bb1faa86e9563f0da041ab82264256c231c76ce64bdd2ae1b59d7a3b',
    ['遷宮同輔台同居', [same('天同', '左辅', '三台')]],
  ]],
  ['694-001', ['c8a308779b470e350ee4cecf731de20b5abfffde87741cff9b23bdb1390e5ced',
    ['遷宮太陽輔弼', [same('太阳', '左辅', '右弼')]],
  ]],
  ['697-001', ['c1b2a481f0cdb25ffe8128d70a83072f2f7b756e15788a9a61efee182ca032b0',
    ['青龍太陽同居遷宮者', [[...same('太阳'), { kind: 'palace_boshi_star', palace, star: '青龙' }]]],
  ]],
  ['1476-001', ['06f34aff353d52a46e3d14f613027ba2f9a60f0fa5b75b1cf42cc0605b93646c',
    ['遷宮天官昌曲同守至貴', [{ required: guardsAndLiterary, anyOf: otherPalaces.map(seat => localChange('忌', seat)) }]],
    ['而若化忌同宮則不貴', [[...guardsAndLiterary, ...localChange('忌')]]],
  ]],
  ['1477-001', ['3b4101e96889e7415186d8bb606a80b650951435b100b7da00ae0aacec934733',
    ['廉貞天相地刧同守遷宮、行身處事善惡無常', [same('廉贞', '天相', '地劫')]],
  ]],
  ['1481-001', ['3f1fe9c0d721a084756eaddfb31e0cec393b2f9dbfd2a18d77e60644d74bc6bb',
    ['未遷羊相同會者', [[...at('未', '擎羊'), ...sector('天相')]]],
  ]],
  ['1484-001', ['6507077fd5cf752dea853938c75d2cb3f6bc255b038bc9fc0373a312f4453a61',
    [null, flanks.map(([xing, ji]) => [
      ...same('七杀', '地劫'), adjacent(xing), adjacent(ji), starAt(xing, '天刑'), ...localChange('忌', ji),
    ])],
  ]],
  ['1485-001', ['56f5122a28dde68fdeabafd14710efa07b30ca88cd95ac5992e35d9877a6ce4d',
    [null, [same('天府', '文曲')]],
  ]],
  ['1487-001', ['25b731af068306587f30380df7a323991305cad84ca76d0b2642c72ac2ec172f',
    ['遷宮貞七、在家少、出外多、勞心忙懮', [same('廉贞', '七杀')]],
  ]],
  ['1488-001', ['54cd90cc28780abe0593cf5b96d6b7fe701288120290085e5d9a137fca76f044',
    ['遷宮午地紫魁最好', [{ required: at('午', '紫微', '天魁'), mustBeAbsent: same('右弼') }]],
    ['其有右弼不若無之為愈', [at('午', '紫微', '天魁', '右弼')]],
  ]],
  ['1490-001', ['5606a6e407c9f353b96dcada94d9975e79b50b2abf9da186c8c4f54ed7c127ec',
    [null, [at('辰', '太阴', '地空', '天姚')]],
  ]],
  ['1491-001', ['9497cab8017e0f33d937afb35bd1d8ecb1127391bbb545640228871c091d9640',
    [null, ['巳', '亥'].map(cleanTianji)],
  ]],
  ['1492-001', ['5648152e93afa403c1ffd10b646fccbea53d613c8bba0baaae1227678c30d9cc',
    ['申昌七弼忌同居者', [[...at('申', '文昌', '七杀', '右弼'), ...localChange('忌')]]],
  ]],
  ['1495-001', ['5cb6893af62e66e8a7a086771fa871d66bb0e82b35984209bff8227b444887a0',
    [null, [same('地空', '地劫')]],
  ]],
  ['1496-001', ['10774718dbae31c11a14d7204793e40d3c22478cea4d6149899f166a5b84d230',
    ['權祿夾右弼於遷宮', flanks.map(([quan, lu]) => [
      ...same('右弼'), adjacent(quan), adjacent(lu), ...localChange('权', quan), ...localChange('禄', lu),
    ])],
  ]],
  ['1497-001', ['a17e16e42bd91cab1434e970c652493197a3d540458a7a169c3c585ef8d85dd9',
    ['遷宮午地廉相與台輔同居', [at('午', '廉贞', '天相', '台辅')]],
  ]],
  ['1498-001', ['97a52c1693a5c7cfb1f4bc446d2bb382740587bda0345ad8d61837c13a1a1b7e',
    ['遷宮天相與午地巨門合者、為印合土石之格', [[
      ...at('未', '天相'), adjacent('仆役'), branchAt('仆役', '午'), starAt('仆役', '巨门'),
    ]]],
  ]],
  ['1499-001', ['e5b976ab1bafce3a44565fed859c96ed86088539631aefafd19b2d3d51755ac6',
    [null, [same('武曲', '破军', '地空', '地劫')]],
  ]],
  ['688-001', ['3485b9ab6b1c80e5a4fe530e8c63023baedbfe907b2380ad1c7d724031959a71',
    ['遷宮未地羊', [at('未', '擎羊')]],
  ]],
  ['689-001', ['a7521f9c07a1a7b25d25e021bcd587ff6107e23816bfa320b606ddbc9de1cba5',
    ['遷宮機月', [same('天机', '太阴')]],
  ]],
  ['692-001', ['d5e47330e6547819f24989524b58a2b92aba3123e97107a37b1e63213bbeef67',
    ['遷宮文星天刑同居', literaryStars.map(star => same(star, '天刑'))],
  ]],
  ['693-001', ['1618a51aee988d326fe58ee67a2f07b3851a4a78e3ee2cc922474af79d2f8426',
    ['丑遷天相得昌曲', [oxXiangWithLiteraryStars]],
  ]],
  ['1478-001', ['6f57442c71dd957ee4678ebd104964d150c4f524d54964b0694bfb3f35c0d1e4',
    ['遷宮巳亥貪貞與生馬同宮者', [...'巳亥'].map(branch => [...at(branch, '贪狼', '廉贞', '天马'), growth('长生')])],
  ]],
  ['1480-001', ['ea829c85dca7e44d46e615a07a56c58d3128db16c2cc665eb504736b3587d7f3',
    ['遷宮申地機月落空', ['地空', '旬空', '截路'].map(star => at('申', '天机', '太阴', star))],
  ]],
  ['1482-001', ['3ee37204a0e51eaeb5f48b8031a948c880143402b989d026b8d8958b562cafd5',
    ['遷宮石中隱玉格', hiddenJade],
  ]],
  ['1483-001', ['d6046a37ab1e0dbdff8727b0a265652961826fa9d8754d7f62624d1a844307e7',
    ['遷宮坐貴向貴', facingNobles],
    ['又福官貴來會、池閣夾者', flanks.map(([pond, gallery]) => [
      ...facingNobles[1], trine('天福'), trine('天官'), adjacent(pond), adjacent(gallery), starAt(pond, '龙池'), starAt(gallery, '凤阁'),
    ])],
  ]],
  ['1486-001', ['aaeac98b13d23b556b3279c5efd214ee669e7d477151c6bdbb24cf56b13a2b15',
    [null, literaryStars.map(star => same(star))],
  ]],
  ['1489-001', ['7ae27a042485e06ecf57206da29027161514331d4ce4342cc31312efbce8e737',
    ['遷宮無正曜', [[mainCount(0)]]],
  ]],
  ['1491-002', ['4f608d88443646ab4a53624a46358f09f22c1ec9af45dd688e04eefe279c69ae',
    ['化祿者、專作商販之業、江湖生涯', [...'巳亥'].map(tianjiLu)],
  ]],
  ['1493-001', ['f0960775d46b30921b6724b422bf018866185ffd19f22a13bf50156dbea8df51',
    ['官貴在遷宮遇魁鉞者、倔起立門戶', [[...same('天官'), ...sector('天魁', '天钺')]]],
  ]],
  ['1501-002', ['f28b581939a7e978690d1eefb065470e3933734a2b885ab666cc9ba9b017dc44',
    ['遷宮陷地貪星與鈴星相聚者', [...'巳亥'].map(branch => [...at(branch, '贪狼', '铃星'), fallen('贪狼')])],
  ]],
  ['1503-001', ['393681c1f1e1058f6a5f60e3034a276b17c17dc70e711d41af819553fd05555c',
    ['遷宮有羊陀七殺刑', [[...same('七杀', '天刑'), ...sector('擎羊', '陀罗')]]],
  ]],
  ['1503-002', ['37e7764372ccfd1dc815f5752c0b3cb4dc2285aefb6f83854388ed1b8e9dee6c',
    ['遷宮陷地巨門', [[...same('巨门'), fallen('巨门')]]],
    ['火鈴姚星', [[
      ...same('巨门', '天姚'), fallen('巨门'), ...sector('火星', '铃星'),
    ]]],
  ]],
]);

const fireBellEntry = '1501-001';
const fireBellHash = 'b65d48d513ba1a0644be28bdd4bf9c6644b96570f415630565c634a8abbaae14';

export function compileXingjueMigration(claim) {
  if (!claim.id.startsWith(prefix)) return undefined;
  const id = claim.id.slice(prefix.length);
  const spec = reviewed.get(id);
  if (!spec && id !== fireBellEntry) return undefined;
  const [hash, ...passages] = spec ?? [fireBellHash];
  const { source, conditions, evidence } = claim;
  const fingerprint = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (fingerprint !== hash || passages.some(([text]) => text && !evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '《紫微星诀》迁移篇的原文、出处或条件有变化，须重新核对。' };
  }
  if (id === fireBellEntry) return {
    reason: 'different_chart_tradition',
    reviewNote: '本库将火铃守迁归为火星与铃星同宫。当前排法中二曜起点不同且同向随时辰移动，原句能否按分别守照取用仍待核。',
  };
  const branches = passages.map(([text, groups]) => ({
    text,
    conditionCompiler: xingjueMigrationProfile,
    inputs: groups.map(group => normalizeRuleInput('ziwei', Array.isArray(group) ? { required: group } : group)),
  }));
  if (!branches[0].text) return { compiler: xingjueMigrationProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '按《紫微星诀》迁移篇已核盘式与分句匹配', branches };
}
