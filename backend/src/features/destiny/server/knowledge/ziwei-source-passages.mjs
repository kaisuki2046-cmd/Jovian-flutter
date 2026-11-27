import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';
import { defaultZiweiMutagens, ziweiMutagenPlacementProfile } from './ziwei-mutagen-placement.mjs';

export const ziweiBirthGradeProfile = 'quanshu-explicit-birth-grades-v1';
export const quanshuPalaceTextProfile = 'quanshu-palace-text-v1';
export const jielanPalacePassageProfile = 'jielan-palace-passage-v1';
const sourceId = 'ziwei-v2-minggong-p142000-004';
const sourceHash = '6000e8ccf6448445cfdca83a8d41fc4283d1987df7f20e5167959baa16f1d960';
const lightId = 'ziwei-v2-minggong-p323001-033';
const lightHash = 'f35b44935fb9956af5247bc64c53a4cfaf6fddc1f1ff79e090f3937ee574c1bf';
const digest = claim => createHash('sha256').update(JSON.stringify({
  source: claim.source, conditions: claim.conditions, evidence: claim.evidence,
})).digest('hex');
const benefics = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'];
const fourMalefics = ['擎羊', '陀罗', '火星', '铃星'];
const voidStars = ['地空', '地劫'];
const sixMalefics = [...fourMalefics, ...voidStars];
// 火铃 and 文曲 advance together from different seats in the current chart.
const huoLingSamePalaceBenefics = benefics.filter(star => star !== '文曲');
const nobleStars = ['天魁', '天钺'];
const assistants = ['左辅', '右弼'];
const assistantAndLiteraryStars = [...assistants, '文昌', '文曲'];
const otherLeftBenefics = benefics.filter(star => star !== '左辅');

const illnessPassages = new Map([
  ['002-003', 'b1b6dd5e70cbbdd70f73cb31a13392151763f05d06627cb64fdcbc903e7c5f86', '天相同皮胎劳',
    { stars: ['紫微', '天相'] }],
  ['002-004', '7e31e9c13a90b9bf90358a4d8dc7b47d5b5722d62a3df8f948b6e4f90e1a4494', '如加破军血气不和',
    { stars: ['紫微', '天相'], sector: ['破军'] }],
  ['002-005', 'bceaf6bc23cbe0e00b8785715b70fa08fa46c7b54f73cbf42fe1a10ef2199f33', '同羊铃主有暗疾',
    { stars: ['紫微', '擎羊', '铃星'] }],
  ['002-006', '5eb454974ae520e65ce11c6240137ff94adf58e4e3933afaef0e04a44076c16e', '加空劫主疢疾心气疾',
    { stars: ['紫微'], sector: voidStars }],
  ['004-002', '60a3d12c7a141829dc2323cafb60175be394d5e66581fcbd2abe75aabbb7c3fe', '太阴同加化忌，羊陀主眼目有伤',
    { stars: ['太阳', '太阴'], sector: ['擎羊', '陀罗'], sectorChanges: ['忌'] }],
  ['005-005', '86536a53a4ad73d9916024678b503462a4bba8b75ba0240f63626f40852492e7', '贪狼同庙旺无疾',
    { stars: ['贪狼', '武曲'], brightness: ['庙'] }],
  ['006-003', '5359cdaa9d0c346b92d0eed834b842f1d2800945048b92fa1a94c5f2b2699fd3', '太阴同加羊火血气疾',
    { stars: ['天同', '太阴'], sector: ['擎羊', '火星'] }],
  ['007-002', '9b0f933f7d1eb4cfa5d9264ca7efdae381d4544d0d2310f9b4a03db43f49c7cd', '入庙加吉和平',
    { stars: ['廉贞'], brightness: ['庙'], companions: [...assistantAndLiteraryStars, '天钺'] }],
  ['007-003', '197638e15ec2ffd51e050aedf4be0e9ab3588a3ebd9c5e1a330c4f95372add45', '遇贪狼同，陷地眼疾灾多',
    { stars: ['廉贞', '贪狼'], brightness: ['陷'] }],
  ['007-004', 'b0751d5a271114720ce7ebbd7e6f890a3e4f834040574b887ca0641dc90842af', '七杀破军天府同灾少',
    { stars: ['廉贞'], companions: ['七杀', '破军', '天府'] }],
  ['009-004', '4717ab3be79e2dfd0caca3dda0fce37270f132b041954dfe5f7e20054f354bbd', '若太阳同加吉美一生灾少',
    { stars: ['太阴', '太阳'], companions: benefics }],
  ['009-005', '3021618b77cf541d40156429df3a3ab19d5415ee50d49b7b27979f8c6c3b805f', '羊陀火铃眼目疾',
    { stars: ['太阴', '太阳'], sector: fourMalefics }],
  ['009-006', '0ecb0785fdeda79efbab427c68c0518bf228f3d2664b48a245b2debcd18b230a', '加空劫有疯疾',
    { stars: ['太阴', '太阳'], sector: voidStars }],
  ['011-004', '3ef463264f429ff7fbb8248b98c11046bff3bf4dd99cd1daa6bbb0b69928cdae', '加羊火酒免之疾',
    { stars: ['巨门', '天同'], sector: ['擎羊', '火星'] }],
  ['011-005', '2519bac58f0c7033c430deec4aa51acaf947761f867206a43097d87f012ad7b2', '加忌有耳目之忧',
    { stars: ['巨门', '天同'], sector: ['擎羊', '火星'], sectorChanges: ['忌'] }],
  ['012-004', '13739d50e5ce87d5e615259ffc6a74c08ed1d1f96c48f22bafd6edcf1ac56db3', '廉贞同加空劫手足伤',
    { stars: ['天相', '廉贞'], sector: voidStars }],
  ['013-002', '15524caa3b7ad37d9aa4f53b523d637f9ec65b304d863c2af6c60dd938fa9372', '武曲同加四杀手足伤残',
    { stars: ['七杀', '武曲'], sector: fourMalefics }],
  ['013-004', '2818eeb0bda59e138bdf558e340c6ae8764a28411db841fd6302666b26944969', '加擎羊四肢有伤残',
    { stars: ['七杀', '廉贞', '擎羊'] }],
  ['014-004', 'b45970322086fb705501bb2acf7baa09016969e955e4fc5cf84ca54a97dcc1bf', '廉贞同加羊火四肢有伤残',
    { stars: ['破军', '廉贞'], sector: ['擎羊', '火星'] }],
  ['016-002', 'b8129fd0e0666aefb93d0dae989c14d99872a10c18a3c99bbc9e004a11c4cf29', '加吉星一世无灾',
    { stars: ['文曲'], companions: ['左辅', '文昌', ...nobleStars] }],
  ['017-002', '37a1b6f7c555c19e90ea6065cafba201febfdfec1858394dc6ee0a51091522a6', '加吉星灾少',
    { stars: ['左辅'], mainCount: 0, companions: otherLeftBenefics }],
  ['017-003', '8ba1998f08bedadd3c2e6bcb64ab150a6c5643be30c5979333f247f9d53bdeca', '见羊陀火铃空劫常有灾',
    { stars: ['左辅'], mainCount: 0, sector: sixMalefics }],
  ['019-002', 'd7b19b3c03cb278a5eb8b30f0358561dae388c1366da4a203997428c2d9c80b0', '加吉星灾少',
    { stars: ['禄存'], companions: assistantAndLiteraryStars }],
  ['019-004', 'e945862efeaec962249094bf690e5c39254c2da9e5a417ae1235395631394fe0', '暗疾延生',
    { stars: ['禄存'], sector: voidStars }],
  ['021-002', 'f0c784597931ecd79f147021dbf8575a8cc8ee6a5efc81d6c873c6c286202b15', '加吉星灾少',
    { stars: ['擎羊'], companions: assistantAndLiteraryStars }],
  ['022-001', '162a17c28f9bd279552e60e79c4071a4b70d386fb506bbd4708e05dbb440d5ed', '主一生灾少，身体健旺伶俐',
    { stars: [], companions: nobleStars, sector: nobleStars }],
].map(([suffix, hash, text, conditions]) => [
  'ziwei-v2-c007-p101' + suffix,
  { hash, palace: '疾厄', ...conditions, passages: [{ text }] },
]));

// These reviewed passages bind each conclusion to its own natal palace and
// witnesses. Full-text entries and independent excerpts share the same input syntax.
const palaceText = new Map([
  ['ziwei-v2-c008-p101001-001', {
    hash: '272cef3633d4441588ed0cb92e17bdd4e4344d04de95e584eac15e6c1e483a0d',
    palace: '迁移', stars: ['紫微', '左辅', '右弼'],
  }],
  ['ziwei-v2-c005-p101018-001', {
    hash: '8b6e6b76d349c04dc9be7bcb08efb31a1e2df5b74c1b50e96872e0613837f6d1',
    palace: '子女', stars: ['天相'], absent: ['擎羊', '陀罗', '火星', '铃星'],
  }],
  ['ziwei-v2-guanlugong-p101011-001', {
    hash: '6b005ce5532b76563e157f18414e0f3fbcbec64941d13071a568b9acdb2c8f40',
    palace: '官禄', stars: ['巨门'], brightness: ['庙'],
  }],
  ['ziwei-v2-guanlugong-p101016-001', {
    hash: 'f3d7a95740240a3c06efea7c60cb169f836167b93abd8d1e9fbcf40dd2f6421c',
    palace: '官禄', stars: ['七杀'], brightness: ['庙', '旺'],
  }],
  ['ziwei-v2-guanlugong-p101020-001', {
    hash: '028bef2859d405315c971885973633881a17395bf8f2421513d093336b5d35e6',
    palace: '官禄', stars: ['左辅'], brightness: ['庙'],
  }],
  ['ziwei-v2-guanlugong-p101021-001', {
    hash: 'cf6e71243758176fbf18425295fa811fee1659ffed33ac93a859352f226ed7b1',
    palace: '官禄', stars: ['右弼'],
  }],
  ['ziwei-v2-guanlugong-p107000-001', {
    hash: '9c37dcd914d6ed2db9ce44e3ac21fa76fe4d00077154fc488f71139e402e5aa6',
    palace: '官禄', stars: ['文昌', '文曲'],
  }],
  ['ziwei-v2-c005-p101004-002', {
    hash: '32b1a26b70a52558a7dcff6a594d187e2c5c81d32e9f50ddc3befe3fb3151afc',
    palace: '子女', stars: ['太阴'], sect: 'day',
  }],
  ['ziwei-v2-c005-p101004-003', {
    hash: 'fe3816ffa4a703c9514508fa342dfcfe0f52d7d59862030c122c49bf0b5d8816',
    palace: '子女', stars: ['太阳'], sect: 'night',
  }],
  ['ziwei-v2-c005-p101007-002', {
    hash: '82fb0041a6287d75843fe3ec47c3554ccb0a7003be1341821e204a1a10b2fddc',
    palace: '子女', stars: ['天机', '巨门'],
  }],
  ['ziwei-v2-c005-p101008-004', {
    hash: 'ab30e1d717d450b336007ee9b132d7cdd382d082593810e4a094c62320f2cc8f',
    palace: '子女', stars: ['太阳'], brightness: ['陷'],
  }],
  ['ziwei-v2-c005-p101009-001', {
    hash: 'ea847c5b981056ef902b13eef47387e0f9c09bd95b33e0177483ae6f8dfc94af',
    palace: '子女', stars: ['武曲'],
  }],
  ['ziwei-v2-c005-p101009-004', {
    hash: 'a81caec0fad9c2277824e2107253d373be1299bf6036d5e1c1f32d162c1f256b',
    palace: '子女', stars: ['武曲', '贪狼'],
  }],
  ['ziwei-v2-c005-p101010-004', {
    hash: '8ce68bc324c15ab54edb554f6b051a5fc32180c35102ae2caa600d2dc076877d',
    palace: '子女', stars: ['天同', '太阴'], branch: '午', brightness: ['陷'],
  }],
  ['ziwei-v2-c005-p101010-006', {
    hash: '47447663b65f90e7ba3b3894306353faf709dabba3ce96b5f144f08e49cb02c1',
    palace: '子女', stars: ['天同', '天梁'], branch: '申',
  }],
  ['ziwei-v2-c005-p101012-003', {
    hash: 'b6c7876f39c72b93c2954c1bba825cfe58e1c6268af28796ff35a3565815a7c4',
    palace: '子女', stars: ['廉贞'], companions: ['贪狼', '破军', '七杀'],
  }],
  ['ziwei-v2-c005-p101014-007', {
    hash: '6771d4e4f92b76918fcfa2543a29d82005e4f21d0a8e871f525902cb0a94cb89',
    palace: '子女', stars: ['太阴', '天同'], brightness: ['庙'],
  }],
  ['ziwei-v2-c005-p101017-001', {
    hash: '44ab7f6160c2c5d1c3295bb912856826b3032a616a79f69e276c3bf8fbdc7bd1',
    palace: '子女', stars: ['巨门'], brightness: ['庙'],
  }],
  ['ziwei-v2-c008-p101003-003', {
    hash: '3dbb6b73d6d4d5fb6251152163b1f93888031a067639c5a27299acebe48b8bfc',
    palace: '迁移', stars: ['太阳', '巨门'],
  }],
  ['ziwei-v2-c008-p101004-001', {
    hash: '9235cd84065c704d2663e7cab08afdabc7db142f17fc5fcfb6cb5473e18b6719',
    palace: '迁移', stars: ['武曲'],
  }],
  ['ziwei-v2-c008-p101004-003', {
    hash: 'c6eca1f4f306eea001461312d9e217cc0eca5185f6cf825ee8bf5dde03ef7e9c',
    palace: '迁移', stars: ['武曲'], companions: ['七杀', '破军'],
  }],
  ['ziwei-v2-c008-p101007-003', {
    hash: 'f6f5885e2201b7e30d2846c05598f8e63bd5774c17afbd11831a98818b1da340',
    palace: '迁移', stars: ['天府'], companions: ['廉贞', '武曲'],
  }],
  ['ziwei-v2-c008-p101020-003', {
    hash: '60700c70ba3766e6891cc7279184142a8665ad6611f076bb580de9a18a0fb178',
    palace: '迁移', stars: ['擎羊'], brightness: ['陷'],
  }],
  ['ziwei-v2-c009-p101005-002', {
    hash: 'd65c9021982e1ac5dab349063f782e042282051ee6032958c70f422b0e62160e',
    palace: '仆役', stars: ['天同', '巨门'],
  }],
  ['ziwei-v2-c009-p101007-002', {
    hash: 'f4dcab6e4b8ed94681d614bbc9953188e530cd06ef981f8fdb848a763a30659a',
    palace: '仆役', stars: ['天府', '紫微'],
  }],
  ['ziwei-v2-c009-p101013-003', {
    hash: '5724438db5ba1a0e50fcc722675956d780c07318b8760074168050c1b3fe1261',
    palace: '仆役', stars: ['七杀', '廉贞'],
  }],
  ['ziwei-v2-guanlugong-p101003-002', {
    hash: '2ccad2c3c1bd92f24ff2c98dec2ed4cf86531879a46c0f54ac4894926fc3bd30',
    palace: '官禄', stars: ['太阳'], brightness: ['庙'], absent: ['擎羊', '陀罗', '火星', '铃星'],
  }],
  ['ziwei-v2-guanlugong-p101006-002', {
    hash: '3bfa6ea4046e1e17bd033db4b27e7e04a5400a1863537d9a95df746eeed5298f',
    palace: '官禄', stars: ['天同'], brightness: ['庙'], absent: ['擎羊', '陀罗', '火星', '铃星'],
  }],
  ['ziwei-v2-guanlugong-p101006-005', {
    hash: 'f4d830f8fbf1aa3102b17e83e440dbb97d8c0675c93c9bc2481377a94893c744',
    palace: '官禄', stars: ['天同'], brightness: ['陷'],
  }],
  ['ziwei-v2-guanlugong-p101007-004', {
    hash: '93b1b3d0c928390e72d8d22fa6f5e4a464f552f10d4ee00c784582d341344ef7',
    palace: '官禄', stars: ['廉贞'], companions: ['天相', '天府'],
  }],
  ['ziwei-v2-guanlugong-p101008-002', {
    hash: 'e76f285a233688a022e33cd0653ad31772a8fb68d4204cb837da8b569254ff0f',
    palace: '官禄', stars: ['天府'], companions: ['廉贞', '武曲'],
  }],
  ['ziwei-v2-guanlugong-p101018-002', {
    hash: 'c93bcc5745050e46ed62fb5c0d9d91eb128b80634efdc7ecca2636b6fca38270',
    palace: '官禄', stars: ['文昌', '天府', '文曲'],
  }],
  ['ziwei-v2-guanlugong-p001-002', {
    hash: 'c0a109fc35c5655972ba3b2e66ef587dddc94ea68c62c1da09bed8d06442def8',
    palace: '官禄', stars: ['紫微'], brightness: ['庙'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃平常' }],
  }],
  ['ziwei-v2-guanlugong-p101001-002', {
    hash: '4e9a9c78bce470b659019bd075fd7b79b429e45ebd9dbddfcd15e1341ea0784d',
    palace: '官禄', stars: ['紫微', '天相'], passages: [{ text: '天相加内外权贵清正' }],
  }],
  ['ziwei-v2-guanlugong-p101010-004', {
    hash: '477bafe67c284c0f965aa8c853a88d0aa4d42e5f3a4809e6acfa70d5ab374c7f',
    palace: '官禄', stars: ['贪狼'], brightness: ['陷'], sector: ['擎羊', '陀罗', '地空', '地劫'],
    passages: [{ text: '加羊陀空劫平常' }],
  }],
  ['ziwei-v2-guanlugong-p101013-007', {
    hash: '1441afb9a59ffc762fd6f15ff6bbf832f56030303cd3a5896996e0b3ed7dc089',
    palace: '官禄', stars: ['天相', '廉贞'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫有贬谪' }],
  }],
  ['ziwei-v2-guanlugong-p101017-002', {
    hash: 'a35f541f6c2ec85738a21ebfc9ce6216fe97e77ce02f70615d086ea7ec405e50',
    palace: '官禄', stars: ['破军', '武曲'], sector: ['文昌', '文曲'], sectorChanges: ['禄', '权'],
    passages: [{ text: '武曲同加权禄，文昌文曲显达' }],
  }],
  ['ziwei-v2-guanlugong-p101017-003', {
    hash: '07478ab59c2bd8a46b0338f1758b49c8a08e2bc349fe4cddd41b117e70f6815a',
    palace: '官禄', stars: ['破军'], brightness: ['旺'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃平常' }],
  }],
  ['ziwei-v2-guanlugong-p101024-002', {
    hash: '41b37f9447ee4f55a8d10e0ef0b69111f2d7f4bc4cd9e506ec0b525525369688',
    palace: '官禄', stars: ['陀罗'], mainCount: 0, companions: benefics,
    passages: [{ text: '加吉星亦虚名而已' }],
  }],
  ['ziwei-v2-guanlugong-p101026-003', {
    hash: '0b7f7a47e8ab01e08997cfd4c9e9d70ac678757bb833a5ca84d837349510314b',
    palace: '官禄', stars: ['铃星'], brightness: ['庙'], sector: ['文昌', '文曲'],
    passages: [{ text: '加诸吉星权贵' }],
  }],
  ['ziwei-v2-guanlugong-p107000-002', {
    hash: '7138125b82b7f45016429c7bd22cf9a5847b5eca685ed23f3cf555f9cb92c26f',
    palace: '官禄', stars: ['紫微', '天相', '文曲'], sector: ['文昌'], sectorChanges: ['禄', '权'],
    passages: [{ text: '紫相更兼权禄至，定居风宪肃朝仪' }],
  }],
  ['ziwei-v2-caibogong-p101001-002', {
    hash: '1b4900eb8d0229626deb457d0d79caa7efc0fe24075488cc5b5ca4e7aa8b57b2',
    palace: '财帛', stars: ['紫微'], sector: sixMalefics, passages: [{ text: '加羊陀火铃空劫不旺' }],
  }],
  ['ziwei-v2-caibogong-p101010-002', {
    hash: '3c8e29651740f3aedc22378f0988bf1bfd639c652062a6e8ca9576345d52c240',
    palace: '财帛', stars: ['天府'], sector: sixMalefics, passages: [{ text: '见羊陀火铃空劫有成败' }],
  }],
  ['ziwei-v2-caibogong-p101013-003', {
    hash: '17ab71c8a03b741f764597c91ea3431b503e211923ffab1baecdef238bb03edd',
    palace: '财帛', stars: ['巨门', '太阳'], brightness: ['庙'], passages: [{ text: '太阳同入庙守见成家计' }],
  }],
  ['ziwei-v2-caibogong-p101013-006', {
    hash: '122e0553c8ae8894e040cf60ab929359fb6d7764d9a54d4f169eafb6c2cd348c',
    palace: '财帛', stars: ['巨门'], mainCount: 1, sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫破财多端' }],
  }],
  ['ziwei-v2-caibogong-p002-002', {
    hash: '2819d76060beff2c98650c44f6488549e754e79f1bff8eb9f7ded2203366799d',
    palace: '财帛', stars: ['紫微', '天府'], sector: ['左辅', '右弼'],
  }],
  ['ziwei-v2-caibogong-p002-003', {
    hash: 'cb53aed5dc9a141a42b5c39cd407694962c3e878b7b810a0b998f4de3b0e3748',
    palace: '财帛', stars: ['紫微', '七杀'], sectorCompanions: benefics,
  }],
  ['ziwei-v2-caibogong-p101004-003', {
    hash: 'cac54b78fc92c1512bea4076e627be35f3c0fbe860f246b9f58f97acb8caa734',
    palace: '财帛', stars: ['太阳', '太阴'], sector: ['左辅', '右弼'],
  }],
  ['ziwei-v2-caibogong-p101004-004', {
    hash: 'ec911152f02397fe6d50c656268f522acc565db13e4cff9d71e36add693704e4',
    palace: '财帛', stars: ['太阳', '禄存'], passages: [{ text: '禄存同操心得财' }],
  }],
  ['ziwei-v2-caibogong-p101004-005', {
    hash: '5c51be529f8822d447046754915fae9c79c12d968bd01f75a60493e908efc4b9',
    palace: '财帛', stars: ['太阳', '巨门'], passages: [{ text: '巨门同早年成败' }],
  }],
  ['ziwei-v2-caibogong-p101005-001', {
    hash: '0be904cc2fdd5595c7d4bc158c3060e2b5f36e465fb9c05fdad06e97d2987f2c',
    palace: '财帛', stars: ['武曲'], starChanges: ['禄', '权', '科'],
  }],
  ['ziwei-v2-caibogong-p101005-002', {
    hash: '39d4deddac75341eca3d3b8afaddbc056856d8ecda120faba48a78e83b706d16',
    palace: '财帛', stars: ['武曲'], noSectorBenefics: true,
  }],
  ['ziwei-v2-caibogong-p101005-005', {
    hash: 'a0d07ef957389e42b1d45a48747422288d895afc4022d09a68826ea428f2b68d',
    palace: '财帛', stars: ['武曲', '天相', '天钺'], passages: [{ text: '遇贵生财成家' }],
  }],
  ['ziwei-v2-caibogong-p101008-003', {
    hash: '7052e3cf74493309105b4639dc03bb60a8dda96bf116bfa219de879ff75b9749',
    palace: '财帛', stars: ['廉贞', '贪狼'],
  }],
  ['ziwei-v2-caibogong-p101008-004', {
    hash: '419df4856d705986150bb96834989f3a1906b743a27b547fe0c58de543473401',
    palace: '财帛', stars: ['廉贞', '贪狼'], sector: ['擎羊', '火星'],
  }],
  ['ziwei-v2-caibogong-p101012-004', {
    hash: 'ab26adf38153c55e447b29daa9c07a9bad09f3f304f3cc758d27e895f6564ca6',
    palace: '财帛', stars: ['贪狼'], sector: ['火星'],
  }],
  ['ziwei-v2-caibogong-p101013-005', {
    hash: '3110fc7b3d4c73f09747d0cd4044378d522b9fd7fc4ff4089a16ebe16082e2ed',
    palace: '财帛', stars: ['巨门', '天同'], passages: [{ text: '天同同白手成家' }],
  }],
  ['ziwei-v2-caibogong-p101018-002', {
    hash: '8a9629ec31790a623a3e4e32675fa3caca441e96a4c70dd22648eddbb463e82d',
    palace: '财帛', stars: ['破军'], brightness: ['旺'], branches: ['辰', '戌'],
  }],
  ['ziwei-v2-caibogong-p101018-003', {
    hash: '57ac3743c0491966d45956aff5b0cf00f6e7f5b840eedb8871322ec49228082f',
    palace: '财帛', stars: ['破军'], brightness: ['陷'],
  }],
  ['ziwei-v2-caibogong-p101018-007', {
    hash: '1fa70b81f11385d0f97a3385b997ae376b7469bf0c667626e32321a1fd0c6990',
    palace: '财帛', stars: ['破军'], sector: ['地空', '地劫'],
  }],
  ['ziwei-v2-caibogong-p101020-002', {
    hash: 'b252c34c5ca4712ea91ce68f99c2e19bfe5c4cf7b97e3a011486ea6d7a48e8d7',
    palace: '财帛', stars: ['文昌'], sectorCompanions: benefics.filter(star => star !== '文昌'),
  }],
  ['ziwei-v2-caibogong-p101021-002', {
    hash: '23700ee841a3b6c2b7c0c0a879d20e5ff2e1983712c989d4f2322b295b264e72',
    palace: '财帛', stars: ['文曲'], sectorCompanions: benefics.filter(star => star !== '文曲'),
  }],
  ['ziwei-v2-caibogong-p101022-001', {
    hash: '07819d7cc30cf236b0cd0d3db1d0ca445511ca1d85e000af7244b2d178ea711b',
    palace: '财帛', stars: ['左辅', '右弼'],
  }],
  ['ziwei-v2-caibogong-p101022-002', {
    hash: '5c8d8f8e742845ddca1e9cf2242b19a6246296a885ba2d2733c26113073e1f6d',
    palace: '财帛', stars: [], companions: assistants, sector: assistants, trineGroups: [nobleStars],
    passages: [{ text: '会诸吉星得贵人财' }],
  }],
  ['ziwei-v2-caibogong-p101023-002', {
    hash: 'cbeda9fdc5b0cab41bb4a5b3281bce00326a85606f31ab31f72a71a4834f97fc',
    palace: '财帛', stars: ['禄存'], sectorCompanions: benefics,
  }],
  ['ziwei-v2-caibogong-p101024-003', {
    hash: 'aa00b8514e1f3572050c2ee84c1abda473d9ce34e122f28b0b8a1a229e60c1b8',
    palace: '财帛', stars: ['擎羊'], brightness: ['陷'],
  }],
  ['ziwei-v2-caibogong-p101025-003', {
    hash: '8f59af1c2dffe8e99655cf2c1293f3398ec6a79efc9041771958a9146bb7995c',
    palace: '财帛', stars: ['陀罗'], sector: ['地空', '地劫'],
  }],
  ['ziwei-v2-caibogong-p101026-003', {
    hash: '0503750ecb4ddce29548c2a2a79782a42576d9ff8874177e421c9efa34344965',
    palace: '财帛', stars: ['火星'], companions: huoLingSamePalaceBenefics, passages: [{ text: '加吉星财多遂志' }],
  }],
  ['ziwei-v2-caibogong-p101028-001', {
    hash: '49b2a068c888d4c2cf4ac83fd6c28f5fd4a096520261576b50d63c1f6ef999ae',
    palace: '财帛', stars: [], companions: nobleStars, sector: nobleStars, remainingAlternatives: 1,
  }],
  ['ziwei-v2-guanlugong-p001-001', {
    hash: '2228119b54c679c5f481d33ac011aa18a61808c190553cc19226856181364b3d',
    palace: '官禄', stars: ['紫微'], brightness: ['庙', '旺'], sector: benefics,
  }],
  ['ziwei-v2-guanlugong-p101002-002', {
    hash: '194e4c6804494cf4b1b4b85767ef1dd6b512f7db2f2d1470248fc22f71981c1e',
    palace: '官禄', stars: ['天机'], brightness: ['庙'], sector: ['文曲'],
  }],
  ['ziwei-v2-guanlugong-p101008-003', {
    hash: 'f98af51d2eaec2069468c11774acd0c3fb24589bb5ecbdb846b17a2aa2359e02',
    palace: '官禄', stars: ['天府'], sector: ['地空', '地劫'],
  }],
  ['ziwei-v2-guanlugong-p101010-001', {
    hash: 'aa70bae2eb4cccb70ce86695ee27cdcac06dbb68873bf1f75c622c2be7466043',
    palace: '官禄', stars: ['贪狼'], brightness: ['庙'], sector: ['火星', '铃星'],
  }],
  ['ziwei-v2-guanlugong-p101011-002', {
    hash: 'a3611287058e4a9252d018986f35a9665d0da174e522d8dcd4da70ea53332ffe',
    palace: '官禄', stars: ['巨门', '太阳'],
    passages: [{ text: '太阳同有进退' }, { text: '入庙久长', brightness: ['庙'] }],
  }],
  ['ziwei-v2-guanlugong-p101015-001', {
    hash: '651bbaad40c24fd1911884d49294fad1b2316cc9618010fa7b99f386dfb10d85',
    palace: '官禄', stars: ['天梁'], brightness: ['庙'], branch: '午', sector: ['左辅', '右弼', '天魁', '天钺'],
  }],
  ['ziwei-v2-guanlugong-p101019-003', {
    hash: 'fe859bf5c34888e97ff1577cfeeeecd44a562fb27cc82137c2b2869b0d34371d',
    palace: '官禄', stars: ['文曲'], sector: ['紫微', '天府', '左辅', '右弼'],
  }],
  ['ziwei-v2-guanlugong-p101020-002', {
    hash: '97a8ce19c779c8dcedf336e7d44e5554093b9a17d735c975bcc9b61594112152',
    palace: '官禄', stars: ['左辅'], brightness: ['庙'],
    trineGroups: ['文昌', '文曲', ...nobleStars].map(star => [star]),
    passages: [{ text: '会吉星身中清，文武皆良' }],
  }],
  ['ziwei-v2-guanlugong-p101022-001', {
    hash: '9abfa07c47e043ba94d264bd91ae0c53cb83e7397afd6f6e368dca53eb4f96db',
    palace: '官禄', stars: ['禄存'], sectorCompanions: benefics,
  }],
  ['ziwei-v2-guanlugong-p101023-002', {
    hash: '008909a58b39a8fecdb6867404e24e5549a0585a1860710970092729c4ba26bc',
    palace: '官禄', stars: ['擎羊'], brightness: ['庙'], companions: ['左辅', '右弼', '文昌', '文曲'],
  }],
  ['ziwei-v2-guanlugong-p101025-002', {
    hash: '0be422bc17c011e107c0c5b9f71b556d879291b84b7430a3126c4b28882eaf4c',
    palace: '官禄', stars: ['火星'], sector: ['紫微', '贪狼'],
  }],
  ['ziwei-v2-c011-p101001-004', {
    hash: '26c6837fb8a78c1a4f0b088539a659db42237054ead875c97052c29062b917ae',
    palace: '田宅', stars: ['紫微', '天相'], passages: [{ text: '天相同有见成家业' }],
  }],
  ['ziwei-v2-c011-p101003-001', {
    hash: 'ea5cbe8e57539cf77e30c2f041f9a375af299af89f6390339e60a4166008c7dd',
    palace: '田宅', stars: ['太阳'], brightness: ['庙'], passages: [{ text: '太阳入庙得祖业' }],
  }],
  ['ziwei-v2-c011-p101003-002', {
    hash: '31f3eaba2e2108f7fc6690b9ec7f106f48e76df5a260343aa817ac06e4a83faa',
    palace: '田宅', stars: ['太阳', '太阴'], companions: benefics,
  }],
  ['ziwei-v2-c011-p101004-009', {
    hash: '5ead6b3b3c780239da295e4e4a0398a3bbbf2fcd8795911ef9927fa166b8e3df',
    palace: '田宅', stars: ['武曲', '地空', '地劫'],
  }],
  ['ziwei-v2-c011-p101006-003', {
    hash: 'be54137a502b33dd26d090cc8c5b27a9efca67eb2a042b1bb8fba6ab1502f4ad',
    palace: '田宅', stars: ['太阴', '天同'], brightness: ['庙'],
  }],
  ['ziwei-v2-c011-p101008-003', {
    hash: '9fc85356b9005b4aa7a41c7fc9d4c49055149e869b7221f9def7f36909eeef53',
    palace: '田宅', stars: ['天府'], companions: ['廉贞', '武曲'],
  }],
  ['ziwei-v2-c011-p101010-002', {
    hash: '0c401d1a1f60cb204c4c87f9e1d1e14785abb0812fa5676708cb38507acfb7f6',
    palace: '田宅', stars: ['贪狼'], brightness: ['庙', '旺'], passages: [{ text: '庙旺有祖业' }],
  }],
  ['ziwei-v2-c011-p101017-003', {
    hash: 'e664579c6654885d1aaa4eac7aea9dc40d2f721659c4da77991af59a17142e65',
    palace: '田宅', stars: ['左辅'], sectorCompanions: benefics.filter(star => star !== '左辅'),
  }],
  ['ziwei-v2-c011-p101018-002', {
    hash: '25f1c6323f16f643cce8dee07452cea038198cbc66fdd1eb24ad3cbaf387e4df',
    palace: '田宅', stars: ['禄存'], sectorCompanions: benefics,
  }],
  ['ziwei-v2-c011-p101020-003', {
    hash: 'cf2f8c45194883f83e59a25186d4ccdc486e9905fb3808d2f1ed312f457392c3',
    palace: '田宅', stars: ['陀罗', '地空', '地劫'],
  }],
  ['ziwei-v2-c011-p101021-002', {
    hash: '36a0c9f618a85b4e4dedeaf3f0399ed13508751039d46754d24157a39f641651',
    palace: '田宅', stars: ['火星'], sectorCompanions: benefics,
  }],
  ['ziwei-v2-c012-p101001-002', {
    hash: 'a14ddde25dfdb62518526a49f831fd1713106c66b69f5bbc80b9c4f6c28c8d0f',
    palace: '福德', stars: ['紫微'], companions: ['天府', '天相'],
  }],
  ['ziwei-v2-c012-p101017-001', {
    hash: '8eb129a4484ee96caae63c635384fa834dd3ed94a32948675f3d387e646e5706',
    palace: '福德', stars: ['文昌'], brightness: ['庙'], companions: ['文曲', '天魁', '天钺'],
  }],
  ['ziwei-v2-c012-p101018-001', {
    hash: '7c3b9cd768a82d11a432ff7fb96ce572201ee409f8651c0c30ccac3a5858fb70',
    palace: '福德', stars: ['左辅'], companions: benefics.filter(star => star !== '左辅'),
  }],
  ['ziwei-v2-c012-p101019-002', {
    hash: 'fb22b44bf30579162bdf85efbc1077f0fabc3ca097995cfa8e2176eaafb35519',
    palace: '福德', stars: ['右弼'], companions: benefics.filter(star => star !== '右弼'),
  }],
  ['ziwei-v2-c012-p101020-002', {
    hash: 'e6da8883464caa7cff50c45b9ae43608e9fe3e0d751d8648da3d7d7b89ea554a',
    palace: '福德', stars: ['禄存'], companions: ['左辅', '右弼', '文昌', '文曲'],
  }],
  ['ziwei-v2-c012-p101023-004', {
    hash: '98e4516a42483239c7ffafc66eb95a575cd206dfb0c86d70ab6cf2132a5f81f6',
    palace: '福德', stars: ['陀罗'], companions: benefics,
  }],
  ['ziwei-v2-c012-p101024-002', {
    hash: 'f98e1e003a12bc432a326b99060089072334bf33689e40f155e4d9a26a96109c',
    palace: '福德', stars: ['火星'], companions: huoLingSamePalaceBenefics,
  }],
  ['ziwei-v2-c012-p101025-002', {
    hash: '252fdc68533d35ecd39d003301d9db7ce12df0bcb207a0da8ce04dbc0a1ed7a1',
    palace: '福德', stars: ['铃星'], companions: huoLingSamePalaceBenefics,
  }],
  ['ziwei-v2-c009-p101002-005', {
    hash: 'ad7e47e80e4d5cd83ba31b50908120c1d12d3c0c9c9a563373e3814033fb955d',
    palace: '仆役', stars: ['天机', '巨门'], companions: benefics,
  }],
  ['ziwei-v2-c009-p101019-002', {
    hash: 'a06f482c93bda31c700e66a49421e03bf935148427aaa11672ca1f8117ef622f',
    palace: '仆役', stars: ['禄存'], companions: ['左辅', '右弼', '文昌', '文曲'],
  }],
  ['ziwei-v2-c009-p101021-002', {
    hash: 'cfbf8b9f05d51c5c429b0d580da932fbc355ecba83b5df99150e1d26e4ab0710',
    palace: '仆役', stars: ['陀罗'], brightness: ['庙'], companions: benefics,
  }],
  ['ziwei-v2-c009-p101022-002', {
    hash: '60fc41bca3a55cf02e63d7efb7198f74dbf761f2d093b5b04c3f1bc87b3d89b1',
    palace: '仆役', stars: ['火星'], brightness: ['庙'], companions: huoLingSamePalaceBenefics,
  }],
  ['ziwei-v2-c009-p101023-002', {
    hash: '8d3c56a053414283a866fe0f444bf52700dc81c92ceb1fef30f0b51a8b527bd5',
    palace: '仆役', stars: ['铃星'], brightness: ['庙'], sectorCompanions: benefics,
  }],
  ['ziwei-v2-c013-p101005-005', {
    hash: '1b62dd10b25cf52162386be33997160f7bc5fa709270486a2ff09bd9379f8c7b',
    palace: '父母', stars: ['紫微', '贪狼'], absent: sixMalefics,
  }],
  ['ziwei-v2-c013-p101006-003', {
    hash: '4dbf645a89fbe9d9cff99577132db2c4de5432593acdadb962c5dc066c8b4331',
    palace: '父母', stars: ['天机', '太阴'], absent: sixMalefics, passages: [{ text: '太阴同免刑' }],
  }],
  ['ziwei-v2-c013-p101006-004', {
    hash: 'e8cf497a681081663a97b7eaafe769ed19b8830b48f239c4270e744094ea6659',
    palace: '父母', stars: ['天机', '天梁'], absent: sixMalefics,
  }],
  ['ziwei-v2-c013-p101006-006', {
    hash: 'fbca9f99c26ebd702a12417debbe9d50cffbcd0a4e250d832da2514959d4363f',
    palace: '父母', stars: ['天机', '巨门'],
  }],
  ['ziwei-v2-c013-p101012-003', {
    hash: '9f739c413a20feb4229787c7c8110e03a4ec937859a34449608840b72b9b61be',
    palace: '父母', stars: ['廉贞', '七杀'],
  }],
  ['ziwei-v2-c013-p101015-003', {
    hash: '7220502cd44e5f89c184bb52b3801491de503739bfc8acf4d64c9abb7687bd2c',
    palace: '父母', stars: ['紫微', '贪狼'], absent: sixMalefics,
  }],
  ['ziwei-v2-c013-p101018-003', {
    hash: '49efa197a02dcf8ebb6ff44e49150bfa0390a2550b38e0203cf23fa7238557a0',
    palace: '父母', stars: ['天梁', '天同'], absent: fourMalefics, passages: [{ text: '无杀无刑' }],
  }],
  ['ziwei-v2-c013-p101020-004', {
    hash: '2fcf2639e0d46c3cb915b2861bb798ee96d572b9e736121ea8e3b4432f5b375f',
    palace: '父母', stars: ['七杀', '紫微'], companions: benefics,
  }],
  ['ziwei-v2-c013-p101022-001', {
    hash: 'b8cf924b443fa044bb6295cc7a02b8928208b83256c52c2aea556b2c57312d80',
    palace: '父母', stars: ['文昌'], brightness: ['庙'], companions: ['文曲', '天魁', '天钺'],
  }],
  ['ziwei-v2-c013-p101025-002', {
    hash: '584e19f979b4bbf08ad3b1bc446f058ddd77640e57e2ef77f95ccc5b6b0a1e8d',
    palace: '父母', stars: ['右弼'], companions: ['左辅', '文昌', '天魁', '天钺'],
  }],
  ['ziwei-v2-c013-p101027-002', {
    hash: 'da0f5c27240306e70b0d192c33cea48b3271a412867fb1f614dbb18ced76878e',
    palace: '父母', stars: ['擎羊'], sector: ['太阳', '太阴'],
  }],
  ['ziwei-v2-c013-p101028-002', {
    hash: '19726b435b4fa228c9bbd99cff752e9f139ef3382e1e75ea6d3590eabf55b7c1',
    palace: '父母', stars: ['陀罗'], sector: ['太阳', '太阴'],
  }],
  ['ziwei-v2-c013-p101028-003', {
    hash: 'c3bb7431d701604cf80445f038a863eeadbc3b3dae3b22b2ba0ff4a8cca7d448',
    palace: '父母', stars: ['陀罗'], companions: benefics,
  }],
  ['ziwei-v2-c013-p101029-002', {
    hash: '076fd8415802d6e1cbc554c1b91a15428b5306d8cadd2dc4b153e9b3972fa895',
    palace: '父母', stars: ['火星'], companions: huoLingSamePalaceBenefics,
  }],
  // 卷二「三妻妾」按分句保留相邻的同守、明度及四正前提。
  ['ziwei-v2-fuqigong-p003-003', {
    hash: '73e5ee9d5dbf65b24fbdf08964805655b6ff4601d3943ef2c576b3dd3d086f81',
    palace: '夫妻', stars: ['太阳'], brightness: ['庙', '旺'],
    passages: [{ text: '因妻得贵' }],
  }],
  ['ziwei-v2-fuqigong-p006-003', {
    hash: '42365b7a7b14192ebc701daad5bcbb1086e9e4b8c4b59b3855fa4679208663b0',
    palace: '夫妻', stars: ['天同'], sector: fourMalefics,
    passages: [{ text: '加四杀欠和生离' }],
  }],
  ['ziwei-v2-fuqigong-p006-004', {
    hash: '026eb1c9cafeed383d9a7240ef4cc2110cfdee8aa53f6b870da4ce8cf15a3726',
    palace: '夫妻', stars: ['天同', '巨门'], sector: fourMalefics,
    passages: [{ text: '巨门同加四杀亦克' }],
  }],
  ['ziwei-v2-fuqigong-p009-002', {
    hash: '56bae16304242968cda089c26330bf6e73162bae774ebaab15048345e3be4da6',
    palace: '夫妻', stars: ['太阴'], brightness: ['庙'], sector: ['文昌', '文曲'],
    passages: [{ text: '加昌曲极美' }],
  }],
  ['ziwei-v2-fuqigong-p101001-003', {
    hash: '9269f21402c6750896dabdcfe37b2ffb8b6bc7ecd95d3fb134b74b1d303992c6',
    palace: '夫妻', stars: ['紫微', '破军'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃亦刑' }],
  }],
  ['ziwei-v2-fuqigong-p101001-004', {
    hash: 'e90e97d6b4960e36a190898924c6c0cbbf7f1e9558cda4f61552b0c7ac974d13',
    palace: '夫妻', stars: ['紫微', '贪狼'], sectorCompanions: benefics,
    passages: [{ text: '贪狼同有吉星免刑' }],
  }],
  ['ziwei-v2-fuqigong-p101002-002', {
    hash: 'bc051719176c7b424b97cb1647ee09ae99fc024682b99894ab8f6ce329b42472',
    palace: '夫妻', stars: ['天机'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃主生离' }],
  }],
  ['ziwei-v2-fuqigong-p101003-001', {
    hash: '9ddca80b42ea71214743d51f96b58b38553d00a6cd1dedd71bce39d133dccdaf',
    palace: '夫妻', stars: ['太阳', '天梁'], brightness: ['庙'], sector: assistants,
    passages: [{ text: '与天梁同加左右招贤明之妻' }],
  }],
  ['ziwei-v2-fuqigong-p101005-002', {
    hash: '6fd1fea9f924889a3713a25894ee5c8b81443d9fbd75d433401d8d59d4decaad',
    palace: '夫妻', stars: ['武曲'], sectorCompanions: benefics,
    passages: [{ text: '加吉星因妻得财' }],
  }],
  ['ziwei-v2-fuqigong-p101005-005', {
    hash: '18c5329360b8db555f838afef76a162302b55a3b4b6c932b79b10b79b6dedf69',
    palace: '夫妻', stars: ['武曲', '七杀'],
    passages: [{ text: '七杀同克二三妻' }],
  }],
  ['ziwei-v2-fuqigong-p101005-006', {
    hash: '1e4db5e3441275e909beeb0de1e860c89228a1fc80813559d2528aeeae166db9',
    palace: '夫妻', stars: ['武曲', '七杀'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫更克' }],
  }],
  ['ziwei-v2-fuqigong-p101007-004', {
    hash: '5a28760e76b7900d6d8da9ae0edfba505f9bef222479123351995998a1554d01',
    palace: '夫妻', stars: ['廉贞', '七杀'], sector: fourMalefics,
    passages: [{ text: '羊陀火铃主生离' }],
  }],
  ['ziwei-v2-fuqigong-p101007-005', {
    hash: '7f182ba917878cf67e289c65918536a95bf30148e33bdd388d1cd3fdf3e9ac74',
    palace: '夫妻', stars: ['廉贞', '天府'],
    passages: [{ text: '府谐老' }],
  }],
  ['ziwei-v2-fuqigong-p101010-002', {
    hash: '3293f6a21640515464aea878b8cbaa0949a5105cf24e2e3c1793f37a59e96c43',
    palace: '夫妻', stars: ['贪狼'], brightness: ['庙'],
    passages: [{ text: '入庙宜迟娶' }],
  }],
  ['ziwei-v2-fuqigong-p101011-004', {
    hash: '1cbc12f62a3b0b2285fd3ac52e1b4a885280fea83d1984be43518a1e0a5f07d3',
    palace: '夫妻', stars: ['巨门', '天同'],
    passages: [{ text: '天同同性聪之妻并头' }],
  }],
  ['ziwei-v2-fuqigong-p101011-005', {
    hash: 'c27d5c6d9bdeefc38cfec4ec411b939130cdf7fad6e90eff1eebd860178a6e87',
    palace: '夫妻', stars: ['巨门', '天同'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫定克二妻或主生离' }],
  }],
  ['ziwei-v2-fuqigong-p101012-004', {
    hash: 'cd25f93f6685830e172927108289b4e3478a939603a8c30c3ca007d81ba747e6',
    palace: '夫妻', stars: ['天相', '廉贞'], brightness: ['庙'],
    passages: [{ text: '廉贞同入庙免刑' }],
  }],
  ['ziwei-v2-fuqigong-p101012-005', {
    hash: '9a5b4327cca6bcf3778ba2c95068e1b76af28faa58d729be6241dfc0a57dbe35',
    palace: '夫妻', stars: ['天相', '廉贞'], brightness: ['庙'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫刑克' }],
  }],
  ['ziwei-v2-fuqigong-p101013-001', {
    hash: '9c47365a67b1d7a9e97f3351a2c34cac77ef815c2425212393eab501136fbac6',
    palace: '夫妻', stars: ['天梁'],
    passages: [{ text: '天梁妻宜大美容' }],
  }],
  ['ziwei-v2-fuqigong-p101013-003', {
    hash: '2a94c89d81fdf7f64414b26b28c4f3ca9bc6828baf4d5ab7a65012d97458a723',
    palace: '夫妻', stars: ['天梁', '天机'],
    passages: [{ text: '天机招美淑' }],
  }],
  ['ziwei-v2-fuqigong-p101014-005', {
    hash: '5a24916751caac0c7b0142e80e0c1fdc20bd79abdf09b8e6f8062479b631d85d',
    palace: '夫妻', stars: ['七杀', '廉贞'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫克三妻' }],
  }],
  ['ziwei-v2-fuqigong-p101015-004', {
    hash: '6233020ffd7391e620bd5c001f46c6c79333af0305987d3fdf9068e68046a9d1',
    palace: '夫妻', stars: ['破军', '紫微'],
    passages: [{ text: '紫微同宜年长之妻' }],
  }],
  ['ziwei-v2-fuqigong-p101016-001', {
    hash: '133561c07bdb8f2f878d7eb3f350429f3cb78dbfabf75eab190d869368f4c569',
    palace: '夫妻', stars: ['文昌'],
    passages: [{ text: '文昌妻少内助聪明' }],
  }],
  ['ziwei-v2-fuqigong-p101016-003', {
    hash: '13f22be9a8e868916aba0dbfbe0a0216cf0a416dd1d65605bf43c60e36c1c14e',
    palace: '夫妻', stars: ['文昌', '天机', '太阴'], brightness: ['陷'],
    passages: [{ text: '不宜陷地' }],
  }],
  ['ziwei-v2-fuqigong-p101017-002', {
    hash: '816b999c759b957d977f8f7200ecb93fce02ce76d7f3e8aaa33f7aa3a13e2c8e',
    palace: '夫妻', stars: ['文曲', '文昌'],
    passages: [{ text: '同昌曲妻妾多' }],
  }],
  ['ziwei-v2-fuqigong-p101020-002', {
    hash: '1844c7b5fe7ff9c322868374ca96d0c55b26350d422c6de31327a5ac4042eecd',
    palace: '夫妻', stars: ['擎羊'], brightness: ['陷'],
    passages: [
      { text: '陷地早克' },
      { text: '陷地早克', stars: ['陀罗'] },
    ],
  }],
  ['ziwei-v2-fuqigong-p101021-001', {
    hash: 'cc4ee5c58a6115c6348ca1d1e7082ca8a327dff5ba3bd605b1750cdbdef15c80',
    palace: '夫妻', stars: ['火星'], brightness: ['庙'], companions: ['左辅', '文昌', '天魁', '天钺'],
    passages: [
      { text: '火星铃星入庙加吉无刑' },
      { text: '火星铃星入庙加吉无刑', stars: ['铃星'] },
    ],
  }],
  ['ziwei-v2-fuqigong-p006-002', {
    hash: '2f138764e89f9895be261ae165311a2b1895d9f3dc7bc5777149eaf034a702fc',
    palace: '夫妻', stars: ['天同'],
    passages: [{ text: '夫宜长妻宜少' }],
  }],
  ['ziwei-v2-fuqigong-p101002-001', {
    hash: '27018210dc20cb9c2b5a27811e33d283ac2af925d5da629bbab2e17c3adbfb5b',
    palace: '夫妻', stars: ['天机'],
    passages: [{ text: '天机宜年少刚强之，妻可配夫宜长' }],
  }],
  ['ziwei-v2-fuqigong-p101005-001', {
    hash: '6fb05005e074e636ffa10a5f3c8b64433db1be3669c494a21a05242316af5b40',
    palace: '夫妻', stars: ['武曲'],
    passages: [{ text: '宜迟娶' }],
  }],
  ['ziwei-v2-fuqigong-p101009-002', {
    hash: 'd563cf493545e84431ba94cb83013aeded59a4e986b424b8d98698e0c9815040',
    palace: '夫妻', stars: ['太阴', '天同'], brightness: ['庙'],
    passages: [{ text: '夫同同内助' }],
  }],
  ['ziwei-v2-fuqigong-p101009-003', {
    hash: '092dde99e5a877b3ce50bc40be7918671c59aa27175f831a9eb808e3930cbe7a',
    palace: '夫妻', stars: ['太阴', '天机'], branches: ['寅', '申'],
    passages: [{ text: '天机同美好宜少年' }],
  }],
  ['ziwei-v2-fuqigong-p101010-001', {
    hash: '4e5ce3122b7c468c304e363b295ab0fd2e1fbbb8fd2123e215918bbbc7c2af01',
    palace: '夫妻', stars: ['贪狼'],
    passages: [{ text: '贪狼男女不得美' }],
  }],
  ['ziwei-v2-fuqigong-p101010-004', {
    hash: '40cfbc4c5307b9885b07eaa3897ce4471e2eef2702d2d4c9b4251468d6955328',
    palace: '夫妻', stars: ['贪狼'], mainCount: 1, sector: fourMalefics,
    passages: [{ text: '加羊陀火铃主生离' }],
  }],
  ['ziwei-v2-fuqigong-p101011-001', {
    hash: 'c5eca3c37e2a546f79b6bd7ed5d3be1359893b35dafc2678271a38e4fb61999d',
    palace: '夫妻', stars: ['巨门'],
    passages: [{ text: '巨门宜年长' }],
  }],
  ['ziwei-v2-fuqigong-p101012-001', {
    hash: 'a93430f65ce2aa2ac6713c45736abc968074fa13933c2e54608037c126c83193',
    palace: '夫妻', stars: ['天相'],
    passages: [{ text: '天相貌美贤淑夫宜年长' }],
  }],
  ['ziwei-v2-fuqigong-p101013-004', {
    hash: 'd72718516abfd8426b74e9dab605010ca9b2cc3628ce48a3d1b04c32e433d21f',
    palace: '夫妻', stars: ['天梁'], mainCount: 1, sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫朵不和顺' }],
  }],
  ['ziwei-v2-fuqigong-p101009-001', {
    hash: 'ffc4dc2c133658f5365aee9bb6a0ad57f1786ab5faf73f0dd8e416f3580b298e',
    palace: '夫妻', stars: ['太阴', '太阳'], brightness: ['庙'], remainingAlternatives: 1,
  }],
  ['ziwei-v2-fuqigong-p101014-004', {
    hash: 'a2939fe1199a518f26a117552b2ad6f82846ffb27dcbd357d2df88d0aacdfc93',
    palace: '夫妻', stars: ['七杀', '廉贞'],
  }],
  ['ziwei-v2-fuqigong-p101015-003', {
    hash: '981cb8ec78601515c73f21ce01a45ba8a8c5cb819305ce29465ecdcee277736c',
    palace: '夫妻', stars: ['破军', '廉贞'],
  }],
  ['ziwei-v2-fuqigong-p101016-002', {
    hash: '73f1bab3f4d5b1bdcf1df55cce619c205326a8d68c76a718ef108e62f4a34ee0',
    palace: '夫妻', stars: ['文昌', '天机', '太阴'],
  }],
  // 兄弟条文按已复排的明度、同守与会曜取证。
  ['ziwei-v2-c003-p101011-001', {
    hash: '757b051fb6d83e6276860e1a1564c94c28967ac7728947fd70f59430ffd9535b',
    palace: '兄弟', stars: ['天相'], absent: fourMalefics,
    passages: [{ text: '天相和平有二三人' }],
  }],
  ['ziwei-v2-c003-p101011-002', {
    hash: '2dd35f52a07678ce45eba62194db85319333ae4558c5af25951e0ab41241fa23',
    palace: '兄弟', stars: ['天相'], companions: fourMalefics,
    passages: [{ text: '见杀全无' }],
  }],
  ['ziwei-v2-c003-p101014-002', {
    hash: '9a62336817c45f8b982afc54611c85b01157546d79157f5794aa6478822854bf',
    palace: '兄弟', stars: ['破军'], brightness: ['陷'], companions: ['擎羊', '火星', '铃星'],
    passages: [{ text: '陷地加杀孤单' }],
  }],
  ['ziwei-v2-c003-p101015-003', {
    hash: '38e38392b27ea17b8c9ce10d43a64a8e8693f31a7e17fac88d082519b4a15540',
    palace: '兄弟', stars: ['文昌'], brightness: ['陷'], sector: fourMalefics,
    passages: [{ text: '陷宫孤单' }],
  }],
  ['ziwei-v2-c003-p101018-002', {
    hash: 'a444531ffd2891d30158f577eab7c223d4c999d29652b0398abc20e7d76de316',
    palace: '兄弟', stars: ['禄存'], companions: ['火星', '铃星'],
    passages: [{ text: '见杀克害招怨' }],
  }],
  ['ziwei-v2-c003-p101019-001', {
    hash: '807b73d127eea969f9ba9e0d56c617505ff449a94a0ed61ede343a5d30afedce',
    palace: '兄弟', stars: ['擎羊'], brightness: ['庙'],
    passages: [
      { text: '羊玲克害入庙一人' },
      { text: '羊玲克害入庙一人', stars: ['陀罗'] },
    ],
  }],
  ['ziwei-v2-c003-p101019-002', {
    hash: '475038aeacb92cd24bf073bb1e653439de6b0a18f918e80a85ed7beb57253231',
    palace: '兄弟', stars: ['擎羊'], brightness: ['庙'], sector: assistantAndLiteraryStars,
    passages: [
      { text: '众吉星加有二三人' },
      { text: '众吉星加有二三人', stars: ['陀罗'] },
    ],
  }],
  ['ziwei-v2-c003-p101019-003', {
    hash: 'dc43532ecf8be052dd66c141f357f73cde7254d7c494c62fcc161d564c0e944d',
    palace: '兄弟', stars: ['擎羊'], brightness: ['陷'],
    passages: [
      { text: '陷地全无' },
      { text: '陷地全无', stars: ['陀罗'] },
    ],
  }],
  ['ziwei-v2-c003-p101020-002', {
    hash: '3d4eb80077090e3291673fbafd6ddf740b9b60f6920c18886dfb391e4c7451ba',
    palace: '兄弟', stars: ['火星'], sector: ['廉贞', '七杀', '破军', '铃星'],
    passages: [{ text: '加廉杀破铃孤克' }],
  }],
  // 官禄条文与附歌按各自宫位、四化和三合来会核对。
  ['ziwei-v2-guanlugong-p004-002', {
    hash: 'be32b205033c26f4ef375443884c9006f95ee133d1773e61d7c595b6e6054628',
    palace: '官禄', stars: ['武曲'], brightness: ['庙'], sectorChanges: ['科', '权', '禄'],
    passages: [{ text: '会科权禄为财富之官' }],
  }],
  ['ziwei-v2-guanlugong-p101017-005', {
    hash: '87e3d900b431818b0866b6b9ba4342ff0783e83e47bc58f9deaa280ea9d70cc0',
    palace: '官禄', stars: ['破军', '廉贞'],
    passages: [{ text: '廉贞同文人不耐久，胥吏最美' }],
  }],
  ['ziwei-v2-guanlugong-p101018-001', {
    hash: '5915a7f1c0cfabefa5f7076c7b72fe5f0854ab1dbbcd9c2c2e932e3ad95c7190',
    palace: '官禄', stars: ['文昌', '太阳'], brightness: ['庙'], sectorChanges: ['科', '权', '禄'], sectorCompanions: ['文曲'],
    passages: [{ text: '文昌入庙太阳同加吉科权禄，文武之材' }],
  }],
  ['ziwei-v2-guanlugong-p101020-003', {
    hash: 'cee9318b328582bd37f3834f09aab7df2cf486649092b6e668b5d3ef77f8fee0',
    palace: '官禄', stars: ['左辅'], sector: sixMalefics,
    passages: [{ text: '见羊陀火铃空劫进退声名' }],
  }],
  ['ziwei-v2-guanlugong-p111001-001', {
    hash: '81c15f99441cbbaf23b7bfb508bea40fd2668a852f562376215cf840a22ba982',
    palace: '官禄', stars: ['武曲', '七杀'],
    passages: [{ text: '七杀同横立功名' }],
  }],
  ['ziwei-v2-guanlugong-p111001-002', {
    hash: '45cbdd5d612c9ad2e9b8fe31bd7b1f9651600f027e14d928068b61f4663ad2b6',
    palace: '官禄', stars: ['紫微', '左辅', '右弼'],
    passages: [{ text: '辅弼星缠帝座中，高官三品入朝中' }],
  }],
  ['ziwei-v2-guanlugong-p111001-003', {
    hash: '952a4f7adbf33aef4ae7dcdea0d0ece23efcd3977ef0ae20bba9f983aebda2c6',
    palace: '官禄', stars: ['文昌', '文曲'], absent: fourMalefics,
    passages: [{ text: '昌曲二曜最难逢，建节封侯笑语中' }],
  }],
  ['ziwei-v2-guanlugong-p111001-006', {
    hash: '77a57089e25dda2c04e29501b61f679c0d8357953a7af4384e8a6216fd480151',
    palace: '官禄', stars: ['文昌', '文曲'], companions: ['擎羊', '陀罗'],
    passages: [{ text: '若然凶杀来临破，须然好处也成凶' }],
  }],
  ['ziwei-v2-guanlugong-p111001-005', {
    hash: '97ea24a47544be4f9c2adbeddd4af22c190b48ad7ff5018511446a6bb850414c',
    palace: '官禄', stars: ['紫微', '左辅', '右弼'], trineGroups: [['空亡', '陀罗'], ['空亡', '火星'], ['空亡', '铃星']],
    passages: [{ text: '空亡恶曜三方见，指是虚名受荫封' }],
  }],
  ['ziwei-v2-c003-p101003-002', {
    hash: '702a5fea200d8fda06eb1651f00239635a1b9c0262cd24c7c6bb503fdbca1e67',
    palace: '兄弟', stars: ['太阳', '巨门'], absent: sixMalefics,
  }],
  ['ziwei-v2-c003-p101004-004', {
    hash: 'da60f3cc2a2eead329d07d3fda430ad4622674b4360f1c56fdbbb90de7e634cc',
    palace: '兄弟', stars: ['武曲'], companions: ['破军', '七杀'],
  }],
  ['ziwei-v2-c003-p101004-005', {
    hash: '13fa0cf083087493272e7e39bc31e9044377cae92f0997553bbe039a1f245931',
    palace: '兄弟', stars: ['武曲', '文昌', '文曲', '左辅', '右弼'],
  }],
  ['ziwei-v2-c003-p101005-003', {
    hash: '2e071f1b480cf0bd3ff9404264e292749afb2653052bc63b031892dcbeb31ccc',
    palace: '兄弟', stars: ['天同', '巨门'], absent: sixMalefics,
  }],
  ['ziwei-v2-c003-p101014-006', {
    hash: 'bbbd314ca8cfc666c7cdc33e3d2f4aa8c90bec7076e90c3f7499f2680e9d7ce4',
    palace: '兄弟', stars: ['破军', '文昌', '文曲', '左辅', '右弼'],
  }],
  ['ziwei-v2-c003-p101016-002', {
    hash: 'badd4daaff99782d3edf62f59147945a9b209c7fb378c1579574c2a090dd1c3b',
    palace: '兄弟', stars: ['左辅', '天同', '文昌', '文曲'],
  }],
  ['ziwei-v2-c003-p101020-001', {
    hash: 'a9a58539a749af2bbd624aa6a45420c5c8107f646129d0a0216cfc84d4f62e03',
    palace: '兄弟', stars: ['火星'], brightness: ['庙'], sectorCompanions: benefics,
  }],
  ['ziwei-v2-c005-p101003-003', {
    hash: '81ab06086e9e124d11ac2e984762565a67e2b292081e8e556a64b42b0d7591df',
    palace: '子女', stars: ['太阳'], branches: ['子', '寅', '辰', '午', '申', '戌'],
  }],
  ['ziwei-v2-c005-p101003-004', {
    hash: 'ce7d996d4016e47fda642bfcd37879b40602023576b8752227bca7afb032b1ad',
    palace: '子女', stars: ['太阴'], branches: ['丑', '卯', '巳', '未', '酉', '亥'],
  }],
  ['ziwei-v2-c005-p101005-005', {
    hash: '18f37f1ecf7c502f8ac0e2e9ea8bf7b0475660c058459e50a37f7a4764c695d8',
    palace: '子女', stars: ['紫微', '天府'], companions: benefics.filter(star => star !== '天魁'),
  }],
  ['ziwei-v2-c005-p101010-007', {
    hash: '935d2ecd38ec6c9ef3dbf9a1ee83619994aad50cff7d5d2a4fd34443ebcc72aa',
    palace: '子女', stars: ['天同', '天梁'], branch: '寅', companions: benefics.filter(star => star !== '天魁'),
  }],
  ['ziwei-v2-c005-p101016-003', {
    hash: 'bdd11d04ea16495d7a0bcc99b04b6df96d0d10ae56bf85262decbb5cffdb4189',
    palace: '子女', stars: ['贪狼', '廉贞'], passages: [{ text: '廉贞同子少' }],
  }],
  ['ziwei-v2-c005-p101017-005', {
    hash: '44e196c2d8dd1d8ec87e259bbfde37d39a2686c6be7f9858b117668254209467',
    palace: '子女', stars: ['巨门', '天机'], companions: benefics,
  }],
  ['ziwei-v2-c005-p101021-002', {
    hash: '77e240e03bf71675e0b2e48a75c072229caa28aa94675b862be61137ecd10340',
    palace: '子女', stars: ['七杀', '紫微'], companions: benefics,
  }],
  ['ziwei-v2-c005-p101024-002', {
    hash: '3ec2fee07f0ad0747bf5038f5b8daae22ce92675c479fd51c1cd7f6d22f8e84a',
    palace: '子女', stars: ['右弼'], companions: ['左辅', '文昌', '天魁', '天钺'],
  }],
  ['ziwei-v2-c005-p101025-002', {
    hash: 'ea635b160564f13d2d03e116b6b3638f9a2e491a8c83c38d1a12cab6ce7e3844',
    palace: '子女', stars: ['文昌'], companions: benefics.filter(star => star !== '文昌'),
  }],
  ['ziwei-v2-c005-p101027-002', {
    hash: 'df011d5b95dad9280a5388eba049f14dc2ccdf9a1d30f98f7efeb2d200968ee1',
    palace: '子女', stars: ['禄存'], companions: ['左辅', '右弼', '文昌', '文曲'],
  }],
  ['ziwei-v2-c005-p101029-001', {
    hash: 'f040408f9e1ac668c6b76e25364f2af0b0e53c939345100e1b4a3a8e5e936c99',
    palace: '子女', stars: ['火星'], companions: huoLingSamePalaceBenefics,
  }],
  ['ziwei-v2-c005-p101030-002', {
    hash: 'ec464e4388ed6ab040e7789e303c7ccb1bc7f2883d986f5582ac52144a67931b',
    palace: '子女', stars: ['铃星'], brightness: ['庙'], companions: ['左辅', '文昌', '天魁', '天钺'],
  }],
  ['ziwei-v2-c008-p101007-002', {
    hash: '0024791419cac574a90833b512d595dfacc6c786ead168b95d5f0425bddb48dd',
    palace: '迁移', stars: ['天府', '紫微'], passages: [{ text: '同紫微发福' }],
  }],
  ['ziwei-v2-c008-p101008-005', {
    hash: '40a1ae9c6b0f466e79f122ca49489652fa3114282b565a7910cd950bf61e74ba',
    palace: '迁移', stars: ['太阴', '天同'], branch: '子', brightness: ['庙'],
  }],
  ['ziwei-v2-c008-p101014-004', {
    hash: '126a08a726c37337072d7a3f25e5b1ce14f4addaa2a6d32c9a8f560dc5694bbf',
    palace: '迁移', stars: ['破军'], sector: ['文昌', '文曲', '武曲'],
  }],
  ['ziwei-v2-c008-p101016-002', {
    hash: 'f20b5b6116764312ede471e6f493a588b1bcc6b929949b963a563de0834975c4',
    palace: '迁移', stars: ['文曲'], companions: ['左辅', '文昌', '天魁', '天钺'],
  }],
  ['ziwei-v2-c008-p101020-002', {
    hash: '76d116377cb918bb59c6a43c1ba821637a4fadbbbc592d78ce035267ba04cc76',
    palace: '迁移', stars: ['擎羊'], brightness: ['庙'], companions: ['左辅', '右弼', '文昌', '文曲'],
  }],
  ['ziwei-v2-c008-p101021-001', {
    hash: '5dacbaa167d2a58e392899e67c5d55ecfb9d726cfe6c02cce3bb9310ff4513a7',
    palace: '迁移', stars: ['陀罗'], sectorCompanions: benefics,
  }],
  ['ziwei-v2-c008-p101022-002', {
    hash: '925e55f0429e0ddff8545520896211be3ebce58d4b64a950da4cb9a19a51f19d',
    palace: '迁移', stars: ['火星'], companions: huoLingSamePalaceBenefics,
  }],
  ['ziwei-v2-c008-p101023-001', {
    hash: '100b41808d6a46b0cb02f23552d6f5547f0a74309aa1b688d0f86933451f6ea3',
    palace: '迁移', stars: ['铃星'], companions: huoLingSamePalaceBenefics,
  }],
  ['ziwei-v2-c003-p101002-006', {
    hash: 'a459a2347e371bf8199becb4c59c486f27cc9b070ed2c3b8dc789776f02ab3d5',
    palace: '兄弟', stars: ['天机'], brightness: ['庙'], sector: fourMalefics,
    passages: [{ text: '见羊陀火铃虽有而克害' }],
  }],
  ['ziwei-v2-c003-p101003-005', {
    hash: '7d77dbc376e98954539a20f85b4cf7988b504c8c4aec84921411b7d6ea5ee2ef',
    palace: '兄弟', stars: ['太阳'], brightness: ['陷'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫更克减半' }],
  }],
  ['ziwei-v2-c003-p101004-006', {
    hash: 'cc46e1eec43ce72818babcde9e9e895e956492d99002e06b9b2d03d316a74429',
    palace: '兄弟', stars: ['武曲'], sector: sixMalefics,
    passages: [{ text: '见羊陀火铃空劫孤单' }],
  }],
  ['ziwei-v2-c003-p101006-006', {
    hash: 'c893a169701fa852071fbcf6d21f276e4eeb810486f30717e3dc478dfd185229',
    palace: '兄弟', stars: ['廉贞'], sector: sixMalefics,
    passages: [{ text: '见羊陀火铃空劫有克且不和' }],
  }],
  ['ziwei-v2-c003-p101007-004', {
    hash: 'ba49d2bfc0a37539fafe0c7ba03c8cbe8192314c83be9f7f497bc19400c40473',
    palace: '兄弟', stars: ['天府'], sector: sixMalefics,
    passages: [{ text: '见羊陀火铃空劫只二人' }],
  }],
  ['ziwei-v2-c003-p101009-005', {
    hash: '65220ba56615793fbd306c46f456c498bfac81d2a9120a6e322356625512e5d3',
    palace: '兄弟', stars: ['贪狼'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫孤单' }],
  }],
  ['ziwei-v2-c003-p101010-006', {
    hash: '858c48ad7e337f918aa57b078474d9b0561496668e8b7b3a03eb3dc7e742a152',
    palace: '兄弟', stars: ['巨门'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫孤克' }],
  }],
  ['ziwei-v2-c003-p101011-006', {
    hash: '7dc6e9e85e9ec6e8bc4fef0edb433112b678bd25e54c7d497a1a2ae62ec07a53',
    palace: '兄弟', stars: ['天相'], sector: sixMalefics,
    passages: [{ text: '见羊陀火铃空劫孤单' }],
  }],
  ['ziwei-v2-c003-p101012-005', {
    hash: 'c0f1e88e9bf05cafdeed761c8391dc2571d4fc7b0b6863634fc115edb37a3ba1',
    palace: '兄弟', stars: ['天梁'], sector: sixMalefics,
    passages: [{ text: '见羊陀火铃空劫少' }],
  }],
  ['ziwei-v2-c003-p101016-003', {
    hash: '5f7344ee09cc9ce8399196484b73f8805d8903acd9dd8e275e2dea7beec43c8c',
    palace: '兄弟', stars: ['左辅'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃二人' }],
  }],
  ['ziwei-v2-c003-p101016-004', {
    hash: '36b5b3ac35c02d34470b6c3dcab3f7af962396ec80bca0827f71356a200f6288',
    palace: '兄弟', stars: ['左辅'], sector: voidStars,
    passages: [{ text: '有空劫欠力不和' }],
  }],
  ['ziwei-v2-c003-p101017-003', {
    hash: '817d6de29c1367b6c9caa65a57ac07a45339f1631d7c93e3582b6b789aa3af4b',
    palace: '兄弟', stars: ['右弼'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃二人' }],
  }],
  ['ziwei-v2-c003-p101017-004', {
    hash: 'bef12ba6f569f26267d1e7bd1c1e116d38fd94c8bc046d2fc9bc919a195364ad',
    palace: '兄弟', stars: ['右弼'], sector: voidStars,
    passages: [{ text: '有空劫欠力不和睦' }],
  }],
  ['ziwei-v2-c008-p101002-005', {
    hash: '2c369a34e6ff2b5b820bfe0e5c56acbb10dd5c8fbc3c0b667df3365fc24f62a3',
    palace: '迁移', stars: ['天机'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃在外多是非身不安静' }],
  }],
  ['ziwei-v2-c008-p101003-004', {
    hash: 'db4f6b9c9f7ad3082c6562f93edf2147588f53a93fec7cb435c3881baa63de22',
    palace: '迁移', stars: ['太阳'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫在外心身不清闲' }],
  }],
  ['ziwei-v2-c008-p101004-004', {
    hash: '50118e3294358c9f00c5c6ae66dbff3bdced0aac07e9a17b734e0f655a9dc739',
    palace: '迁移', stars: ['武曲', '七杀'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃在外招是非' }],
  }],
  ['ziwei-v2-c008-p101005-005', {
    hash: '6665aaa1ce1949337c9ddde4a3094f843806886d4e7e008921e9d9bde3859040',
    palace: '迁移', stars: ['天同'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫在外少遂志' }],
  }],
  ['ziwei-v2-c008-p101010-002', {
    hash: '55dfbfdc04843d0c1509467baa28878fbc5f591a3b8a69848da93befd241a853',
    palace: '迁移', stars: ['巨门'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫愈甚' }],
  }],
  ['ziwei-v2-c008-p101011-004', {
    hash: '8294bbcb17454e55d31f1a9aed8fffdc44b4dc849b6460bfe576bd24dc644755',
    palace: '迁移', stars: ['天相', '廉贞'], sector: fourMalefics,
    passages: [{ text: '廉贞同加羊陀火铃招是非小人不足' }],
  }],
  ['ziwei-v2-c008-p101014-003', {
    hash: '4e6dc441a1539d55bf3fb4f867cea76b5ef197dc335d1fb74b872773b190488e',
    palace: '迁移', stars: ['破军'], brightness: ['庙', '旺'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃，奔驰巧艺走途中' }],
  }],
  ['ziwei-v2-c009-p101001-002', {
    hash: '865ee092bbec23672bfba0c279d7f96f2c115f0ac9c0876d87728c5e62bedf4f',
    palace: '仆役', stars: ['紫微'], sector: fourMalefics,
    passages: [{ text: '加擎羊火铃陀罗欠力' }],
  }],
  ['ziwei-v2-c009-p101001-005', {
    hash: 'b8a5d3c77884e2dbf477eb93d5aef09049bb9899955cce3edf30adcaf2852692',
    palace: '仆役', stars: ['紫微', '天相'], sector: voidStars,
    passages: [{ text: '加空劫招怨逃走' }],
  }],
  ['ziwei-v2-c009-p101002-006', {
    hash: 'c1b5bf469a41596ecfb8478f676b922f697448fc404179e9f55f10e103df890f',
    palace: '仆役', stars: ['天机'], sector: sixMalefics,
    passages: [{ text: '加擎陀火铃空劫全难' }],
  }],
  ['ziwei-v2-c009-p101003-005', {
    hash: '61df1b883abb7fcb4fe3eb5f5b3b9cc7806e1e4c2f950372c08d61070556c9fc',
    palace: '仆役', stars: ['太阳'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃奴则背主' }],
  }],
  ['ziwei-v2-c009-p101005-005', {
    hash: 'dbf3e7c58c99ff71cb2cab54362ce506c32e449a189d02cf83f05c4f7665d10d',
    palace: '仆役', stars: ['天同'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃有背主之奴' }],
  }],
  ['ziwei-v2-c009-p101005-006', {
    hash: '1b28a34ed8fb5550bf34523d3369f91a2da914aea4fec10a3ce834298a05783a',
    palace: '仆役', stars: ['天同'], sector: voidStars,
    passages: [{ text: '若见空劫怨主会走' }],
  }],
  ['ziwei-v2-c009-p101006-006', {
    hash: '81a20af857d2b6e9a90b9a83a9f156c5bab03226800f27f4113efbc822ce7a20',
    palace: '仆役', stars: ['廉贞'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃不旺，会走' }],
  }],
  ['ziwei-v2-c009-p101007-004', {
    hash: '1a637fdaf50366d71f1b850ec5f928ce44f1ad2a2a42b90002c72d970f5e962e',
    palace: '仆役', stars: ['天府', '武曲'], sector: sixMalefics,
    passages: [{ text: '加陀羊火铃空劫多背主，逃走' }],
  }],
  ['ziwei-v2-c009-p101008-005', {
    hash: '6ec4c7fd0eaa957697064f65c5322143f44d4b2d580ce992c7808ad14fd26d26',
    palace: '仆役', stars: ['太阴', '天同'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫，虽有而走' }],
  }],
  ['ziwei-v2-c009-p101011-005', {
    hash: '0c7cd51b63b7073d5a98e0931244dd0186167939b81c180b029f89722600a551',
    palace: '仆役', stars: ['天相', '廉贞'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫欠力逃走' }],
  }],
  ['ziwei-v2-c003-p101008-005', {
    hash: 'f14246d95a3333e7c1922af678f3b885b5a836ae138d643f5f5a9216df402d1a',
    palace: '兄弟', stars: ['太阴'], brightness: ['庙'], sector: sixMalefics,
    passages: [{ text: '见羊陀火铃空劫减半，且克宜分居相背' }],
  }],
  ['ziwei-v2-c008-p101017-002', {
    hash: 'b23e73378fd09b1e6ba75a0a195e756c71aa46a1b502b372e1c8fd934de408fc',
    palace: '迁移', stars: ['左辅'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃下人不足多招是非' }],
  }],
  ['ziwei-v2-c003-p101001-005', {
    hash: '7af041bd49ff8995800bc64b2e51387fd95c80ac3e96d876601949c4f812a434',
    palace: '兄弟', stars: ['紫微', '破军'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫克害有则欠和' }],
  }],
  ['ziwei-v2-c003-p101014-007', {
    hash: 'eaccfa4cbf47bb9527500b3a2fd762d023ead89e51e50b9d1370dd692e3d8b0a',
    palace: '兄弟', stars: ['破军'], sector: sixMalefics,
    passages: [{ text: '羊陀火铃空劫孤单' }],
  }],
  ['ziwei-v2-c009-p101014-006', {
    hash: 'ebb46705a9febac7fb0554c750c70d88b337e5a71fe162047c87b6e7edd29bef',
    palace: '仆役', stars: ['破军'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫难招' }],
  }],
  ['ziwei-v2-c009-p101013-004', {
    hash: 'a696d3026056deb07d899b1f9de0006e136b7ea01c11ad025c57deb53290ad0f',
    palace: '仆役', stars: ['七杀', '廉贞'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫全，难招' }],
  }],
  ['ziwei-v2-c008-p101001-005', {
    hash: '19f2e1fb8a821485da44a96d1391f8597f30cc8ba21fe2015b55b333137a15a5',
    palace: '迁移', stars: ['紫微'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫在外不安静' }],
  }],
  ['ziwei-v2-c011-p101001-002', {
    hash: '628f631615d8b66d79953ad16537c0a8a1afcabbdb5badf15711a93820e5afe6',
    palace: '田宅', stars: ['紫微'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫，有置有去' }],
  }],
  ['ziwei-v2-c011-p101003-005', {
    hash: '435c932a2d849e91427ef889985fc4c781b7255ec79dd75f3c50048dc25b0842',
    palace: '田宅', stars: ['太阳'], brightness: ['陷'], sector: sixMalefics,
    passages: [{ text: '陷地逢羊陀火铃空劫全无' }],
  }],
  ['ziwei-v2-c011-p101004-005', {
    hash: 'aa9be04827c0ff660d7ebf5a20b3168fdc055a6ecba100b6c1cac86922983751',
    palace: '田宅', stars: ['武曲', '七杀'],
    passages: [{ text: '七杀同心不欲' }],
  }],
  ['ziwei-v2-c011-p101008-004', {
    hash: '1ed23bf3a2711de664d9e4ddee08ee849c5d4a3e221662c3fa30a36e7c4fbdd9',
    palace: '田宅', stars: ['天府', '武曲'], sector: sixMalefics,
    passages: [{ text: '见羊陀火铃空劫更少，有成败' }],
  }],
  ['ziwei-v2-c011-p101010-006', {
    hash: '3573cab5bba015c1c8bdb01e6a82ad92d63c48ae35f6ac5a43aaac1383d0f992',
    palace: '田宅', stars: ['贪狼', '武曲', '火星'], sector: ['火星', '铃星'],
    passages: [{ text: '见火铃星守祖业，有自创，但恐火焚屋宅' }],
  }],
  ['ziwei-v2-c011-p101011-004', {
    hash: '4d3a84196bbffa4eb655203d66072b70f2e0cbea25ef32f9db73181bdb6693e3',
    palace: '田宅', stars: ['巨门'], sector: sixMalefics, mainCount: 1,
    passages: [{ text: '加羊陀火铃空劫田宅全无' }],
  }],
  ['ziwei-v2-c011-p101012-004', {
    hash: '2d6cfebc0ae8c8b25197c8f08b96fc6a9a4605974e84a26cb4ae1b336c6847d1',
    palace: '田宅', stars: ['天相', '廉贞'], sector: sixMalefics,
    passages: [{ text: '廉贞加羊陀火铃空劫飘零祖业' }],
  }],
  ['ziwei-v2-c011-p101014-002', {
    hash: 'e97df11efe7f2c1f87a863937d11c7e1911669a768491adbe2875ae9fcb6cc59',
    palace: '田宅', stars: ['破军'], sector: fourMalefics, branches: ['子', '午'],
    passages: [{ text: '加羊陀火铃退祖田少' }],
  }],
  ['ziwei-v2-c011-p101015-001', {
    hash: '6fee257e1b12e179ea934dc34666c847f66ff78bbb9ad3920cf424be5561e9e5',
    palace: '田宅', stars: ['文昌'],
    trineGroups: [['左辅', '右弼']],
    passages: [{ text: '文昌会诸吉田园广置' }],
  }],
  ['ziwei-v2-c011-p101016-002', {
    hash: '178c919a632c1438c9b668d1bf54ddc4852bd5f3a81b3f6116372c2bc05d65a6',
    palace: '田宅', stars: ['文曲'],
    companions: ['左辅', '文昌', '天魁', '天钺'],
    passages: [{ text: '加吉星自置' }],
  }],
  ['ziwei-v2-c011-p101019-002', {
    hash: '724b3bc80696eac4926216053b4a0640844613a56e352c18575daca14d877d1d',
    palace: '田宅', stars: ['擎羊'], brightness: ['陷'], sector: voidStars,
    passages: [{ text: '陷地加空劫退祖业' }],
  }],
  ['ziwei-v2-c011-p101020-002', {
    hash: '125f7f4f9a9924cc60e120092441114ea0702f1dd43ea30a0b7e56319ccb1f2c',
    palace: '田宅', stars: ['陀罗'],
    companions: benefics,
    passages: [{ text: '加吉星先无后有' }],
  }],
  ['ziwei-v2-c011-p101021-003', {
    hash: '10905a9231fc2c292c7cde59ae5b4c0d686e87b8aebe0c0b956aafb56970fcab',
    palace: '田宅', stars: ['火星'], sector: voidStars, coreCount: 1,
    passages: [{ text: '加空劫全无' }],
  }],
  ['ziwei-v2-c011-p101022-002', {
    hash: '11428de3f0224292c056dc9c2c94df9d6346e09eeab3662ff4d29ffae3b3e933',
    palace: '田宅', stars: ['铃星'], brightness: ['庙'],
    companions: ['右弼', '文昌', '天魁', '天钺'],
    passages: [{ text: '入庙加吉星自有置' }],
  }],
  ['ziwei-v2-c011-p101022-003', {
    hash: '2cfeb1119937c1e5bc95f0620a99f1f87cad6cc194117f50affb19d4c0bbbc78',
    palace: '田宅', stars: ['铃星'], brightness: ['庙'], sector: voidStars,
    passages: [{ text: '见空劫全无' }],
  }],
  ['ziwei-v2-c012-p101001-004', {
    hash: 'e1fe6d596b79f07e79a46e95f0ed02f0d95c3a93a3533f7897ee78a73a9e5197',
    palace: '福德', stars: ['紫微'], sector: ['擎羊', '陀罗', '铃星', ...voidStars], mainCount: 1,
    passages: [{ text: '加羊陀铃空劫福薄' }],
  }],
  ['ziwei-v2-c012-p101002-005', {
    hash: '82b4c3ef44536a495cddc964de74714b75e1f47f252dfcd85ff0a93705c2726e',
    palace: '福德', stars: ['天机'], brightness: ['庙'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫奔走不得宁静' }],
  }],
  ['ziwei-v2-c012-p101003-005', {
    hash: 'd3f3d08272b9dba957dc0b1329496897be7f527e16d80949f7cb9e6c41145890',
    palace: '福德', stars: ['太阳'], gender: '女',
    trineGroups: benefics.map(star => [star]),
    passages: [{ text: '女人会吉星，招贤明之夫，享福' }],
  }],
  ['ziwei-v2-c012-p101005-007', {
    hash: '1202e73bf0b733d662af8a3d119702ef087549328dcc86b0eaf9c5030b900ac8',
    palace: '福德', stars: ['武曲', '贪狼', '火星'], sector: ['火星', '铃星'],
    passages: [{ text: '见火铃星安逸' }],
  }],
  ['ziwei-v2-c012-p101005-008', {
    hash: '737cefc2be4b06b091d211b2744b5d3d841d02cb38b2d76c3aa2f714d951e14a',
    palace: '福德', stars: ['武曲', '贪狼'], sector: ['擎羊', '陀罗'],
    passages: [{ text: '加羊陀操心得力' }],
  }],
  ['ziwei-v2-c012-p101008-005', {
    hash: 'a890626995ef992dcebbaedcaa2d4e68a766c8c70db24de37c09b42bda0de7f1',
    palace: '福德', stars: ['廉贞', '破军'], sector: fourMalefics,
    passages: [{ text: '再加羊陀火铃劳苦终身，末年如意' }],
  }],
  ['ziwei-v2-c012-p101010-005', {
    hash: 'ef4d2ab58326665f0f96a8733eff6728860c9b69f44038efd597560726a920ee',
    palace: '福德', stars: ['太阴', '天同'], brightness: ['庙'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫，有忧有喜，不得安静' }],
  }],
  ['ziwei-v2-c012-p101012-005', {
    hash: 'da17bd97c063399d3d81c8384bfa9cbd97b7f06a088dd30483fe98d956d93588',
    palace: '福德', stars: ['巨门', '天同'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫生平多忧' }],
  }],
  ['ziwei-v2-c012-p101016-005', {
    hash: 'ba7e015a094f0bf6f811e9e909a500be1f6f88f27f86d24b6ed463ceb1f4c751',
    palace: '福德', stars: ['破军'], sector: sixMalefics, mainCount: 1,
    passages: [{ text: '加羊陀火铃空劫操心，不得宁静' }],
  }],
  ['ziwei-v2-c012-p101018-002', {
    hash: 'e23d594c62ba643aa391ce36d1f2a3a65ac2f93a9875241038a618274469983b',
    palace: '福德', stars: ['左辅'], coreCount: 1,
    passages: [{ text: '独守，晚年安宁' }],
  }],
  ['ziwei-v2-c012-p101019-003', {
    hash: 'b6271a5814009cbcde6ec5ff877412a4b96eb4e32ee6831bb9b479e71cc97795',
    palace: '福德', stars: ['右弼'], sector: sixMalefics,
    passages: [{ text: '见羊陀火铃空劫，凑劳心欠安' }],
  }],
  ['ziwei-v2-c012-p101021-001', {
    hash: '4478c6f3279060a89179931c4c3c20e45179065acc9aa5cf6fd351f43e34eac8',
    palace: '福德', stars: [], sector: nobleStars,
    companions: ['天魁', '天钺'],
    passages: [{ text: '魁钺有贵人，为伴享福快乐' }],
  }],
  ['ziwei-v2-c012-p101022-003', {
    hash: '37cc6a4b5bdbf48d42d80f2129e6934004e986d9a84b25103fc0022b78a56ccd',
    palace: '福德', stars: ['擎羊'], brightness: ['陷'],
    companions: ['左辅', '右弼', '文昌', '文曲'],
    passages: [{ text: '得吉星，同减忧' }],
  }],
  ['ziwei-v2-c012-p101022-004', {
    hash: '2eca446fce01fc135e95855b0b9064b45dc9fe7ff1bbbd2e5b3196de06ab1565',
    palace: '福德', stars: ['擎羊'], brightness: ['陷'], coreCount: 1,
    passages: [{ text: '独守身心不安' }],
  }],
  // 子女与父母条文按实际宫位核对照宫和完整星表。
  ['ziwei-v2-c005-p101028-001', {
    hash: 'c7585424660e38d460b554c7873e1402788342622604fe79bc0f7d20ace15a1f',
    palace: '子女', stars: ['擎羊'], brightness: ['陷'],
    passages: [
      { text: '羊陀陷宫孤单' },
      { text: '羊陀陷宫孤单', stars: ['陀罗'] },
    ],
  }],
  ['ziwei-v2-c005-p101028-002', {
    hash: 'd0178b09f2ed9ccdfb543ec2999a8329459e21b7189b6837fc17c7e5fa398aff',
    palace: '子女', stars: ['擎羊'], brightness: ['庙'], companions: ['左辅', '右弼', '文昌', '文曲'],
    passages: [
      { text: '加吉星庙旺有一人' },
      { text: '加吉星庙旺有一人', stars: ['陀罗'] },
    ],
  }],
  ['ziwei-v2-c005-p101028-003', {
    hash: '5fb31c73035cf8b28b5bcad3313d8b93d5616b1906c07f08b2c7c80eca0553eb',
    palace: '子女', stars: ['陀罗'], brightness: ['庙'], noOppositeMalefics: true, oppositeBeneficCount: 3,
    passages: [{ text: '如对宫有吉星多无杀冲，亦有三四人' }],
  }],
  ['ziwei-v2-c005-p101029-002', {
    hash: 'd68a5c96b736f53c52683d2f05f8e0fc480d800671d67c40aa344152d5900ef7',
    palace: '子女', stars: ['火星'], brightness: ['陷'], companions: ['擎羊', '陀罗'],
    passages: [{ text: '陷宫加杀刑伤' }],
  }],
  ['ziwei-v2-c005-p101030-003', {
    hash: '50ef07412772f0783c6f198fd105e61e3feec7a90fdc3abaf262498935282029',
    palace: '子女', stars: ['铃星'], oppositeBeneficCount: 3,
    passages: [{ text: '看对宫吉多二三人' }],
  }],
  ['ziwei-v2-c013-p101008-004', {
    hash: 'd86991f34fdbda69e377956a61d58596775a331e09f32494b7d0938ee822bb57',
    palace: '父母', stars: ['太阳', '太阴'], sectorAbsent: ['擎羊', '陀罗'],
    passages: [{ text: '父母全迟刑' }],
  }],
  ['ziwei-v2-c013-p101016-003', {
    hash: '5de82742d3e7d877901bf5538b7f78d2b30adf21d704a308612ec37edccfbca9',
    palace: '父母', stars: ['巨门', '天机'],
    passages: [{ text: '天机同重，拜' }],
  }],
  ['ziwei-v2-c013-p101027-003', {
    hash: 'a2f871c8ce05f3a5ad7e8ae5145290dd7eec09d8e32aa4554ff413ec3bc50839',
    palace: '父母', stars: ['擎羊'], sector: assistantAndLiteraryStars,
    passages: [{ text: '加吉星众免刑' }],
  }],
  ['ziwei-v2-c005-p101005-002', {
    hash: '1484c80273aaf5bf5b3b6380a4cf0ae474e2cb841df5bda754fb5b0a7145e124',
    palace: '子女', stars: ['紫微'], brightness: ['庙', '旺'], sector: assistantAndLiteraryStars,
    passages: [{ text: '加左右昌曲有五人' }],
  }],
  ['ziwei-v2-c005-p101005-003', {
    hash: '79f3ca768932535e62d96a8e84b5fdb020fc4d71e733994d4ce0bfe33f514521',
    palace: '子女', stars: ['紫微'], brightness: ['庙', '旺'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫只一双' }],
  }],
  ['ziwei-v2-c005-p101005-007', {
    hash: '748899db86a207adca5d4cad078f0717a9a11b6ec4d668f8fcf04b63ac693468',
    palace: '子女', stars: ['紫微'], coreCount: 1, sector: voidStars,
    passages: [{ text: '若独守再加空劫孤君' }],
  }],
  ['ziwei-v2-c005-p101008-005', {
    hash: '3d116796b89d6f41b829774c7cb95b429dbcfe18dab45f5d066d59aadbeaae1e',
    palace: '子女', stars: ['太阳'], brightness: ['陷'], sector: sixMalefics,
    passages: [{ text: '再加羊陀火铃空劫止留一子送终' }],
  }],
  ['ziwei-v2-c005-p101012-004', {
    hash: '4f28e6e6c8116c464158e861e76da105b2964146e6702cb8c86ac047b9814a53',
    palace: '子女', stars: ['廉贞'], companions: ['破军', '七杀'], sector: sixMalefics,
    passages: [{ text: '再加羊陀火铃空劫全无' }],
  }],
  ['ziwei-v2-c005-p101014-009', {
    hash: '2679bbe4fbbc1189144dbf928a448e51c63deff5150387c0d33ddb2e74916dc4',
    palace: '子女', stars: ['太阴', '天同'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫子少' }],
  }],
  ['ziwei-v2-c005-p101017-006', {
    hash: '164cc84bb1d68ef9e2758c7d4b2685554a1fa555a229066052cd1a11040eab01',
    palace: '子女', stars: ['巨门', '天机'], sector: voidStars,
    passages: [{ text: '加空劫全无' }],
  }],
  ['ziwei-v2-c005-p101018-002', {
    hash: 'ef64f33a0796f3af2d50bb44afdf1bf11858887d297f3a602b4afb5874ecb00e',
    palace: '子女', stars: ['天相'], companions: fourMalefics,
    passages: [{ text: '有杀先招祀子居长，亲生一二子' }],
  }],
  ['ziwei-v2-c005-p101020-002', {
    hash: 'a9ccd2dd89bbd5a0e77376c73f892acfbc5f4687a74862e8e7eae936b9c664b0',
    palace: '子女', stars: ['天梁'], brightness: ['庙', '旺'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫早克' }],
  }],
  ['ziwei-v2-c005-p101022-003', {
    hash: 'c442493565aa628ce9ad3e5deed03c7c2cf2e41508001274fa1c7ed93e75ffc2',
    palace: '子女', stars: ['破军', '武曲'], sector: assistantAndLiteraryStars,
    passages: [{ text: '武曲同加昌曲左右有三人' }],
  }],
  ['ziwei-v2-c005-p101023-002', {
    hash: '7f180cf1c39f57df6f08a759f92b6be43e0a6da59ff3b04df2257d03a0a8a20e',
    palace: '子女', stars: ['左辅'], sector: ['紫微', '天府'], sectorCompanions: ['右弼', '文昌', '文曲', '天魁', '天钺'],
    passages: [{ text: '见紫微天府诸吉星主贵子' }],
  }],
  ['ziwei-v2-c005-p101027-001', {
    hash: 'dc84209594e405384da30bb0be1b972c9258579e0f28f0b432443a89028c59db',
    palace: '子女', stars: ['禄存'],
    passages: [{ text: '禄存主孤' }],
  }],
  ['ziwei-v2-c013-p101006-002', {
    hash: 'ea0e52c956c4ceaf26dfc51ace8fd9ee4b8b1dc12b92bc04ce70f869f3164ae1',
    palace: '父母', stars: ['天机'], brightness: ['陷'], sector: sixMalefics,
    passages: [{ text: '陷地逢羊陀火铃空劫，二姓寄居，重拜父母，或过房入赘' }],
  }],
  ['ziwei-v2-c013-p101006-005', {
    hash: '21870b0dc215d1d5bb8ea12f076964e6c7c83d700b49af836a0f1b7f91201c45',
    palace: '父母', stars: ['天机'], companions: ['太阴', '天梁'], sectorCompanions: fourMalefics,
    passages: [{ text: '加有杀，加也不免刑伤' }],
  }],
  ['ziwei-v2-c013-p101008-003', {
    hash: '4ae1d6732cb9ce78c0f973ed45026bdc204c68eecb1f1a848e049caaccab7466',
    palace: '父母', stars: ['太阳'], brightness: ['陷'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫克父母早' }],
  }],
  ['ziwei-v2-c013-p101012-001', {
    hash: 'e4ac7119b688bacb5840866835b1961277d7835d3a8937421189edb8ec61c617',
    palace: '父母', stars: ['廉贞'],
    passages: [{ text: '廉贞难为父母' }],
  }],
  ['ziwei-v2-c013-p101012-006', {
    hash: '17215e7f4180d454a4f4d95477215043b9e237872dcd016544a906d176e1521c',
    palace: '父母', stars: ['廉贞', '破军'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫，父母不周全' }],
  }],
  ['ziwei-v2-c013-p101013-003', {
    hash: '40e48ba1bcf841a6fa778b1a18a5b4ea37d7bfc6935496b72db92271ee5e34c6',
    palace: '父母', stars: ['天府'],
    passages: [
      { text: '廉贞武曲同，在庙旺无刑', companions: ['廉贞'], brightness: ['庙'] },
      { text: '廉贞武曲同，在庙旺无刑', companions: ['武曲'], brightness: ['庙', '旺'] },
    ],
  }],
  ['ziwei-v2-c013-p101013-004', {
    hash: '150902262e0b6031a5ea68375d426c1057d50c4b069d6a83b0607585ed805b57',
    palace: '父母', stars: ['天府', '武曲'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫主伤' }],
  }],
  ['ziwei-v2-c013-p101014-002', {
    hash: '34c5617341493b2e15e6359028a90efaca16c5b23d84782948ec187910e65638',
    palace: '父母', stars: ['太阴'], brightness: ['庙'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃克母' }],
  }],
  ['ziwei-v2-c013-p101015-001', {
    hash: 'ac9d8365e764bc85d9da77a67bce127847c5659b4a46858336250c95abf707d0',
    palace: '父母', stars: ['贪狼'], brightness: ['陷'],
    passages: [{ text: '贪狼狼陷地早弃祖' }],
  }],
  ['ziwei-v2-c013-p101016-004', {
    hash: '40eed0e7c197b8da39ab3de17227386736dda534a3879c85de78e08b34e90031',
    palace: '父母', stars: ['巨门', '天同'],
    passages: [{ text: '天同同或退祖无刑' }],
  }],
  ['ziwei-v2-c013-p101016-005', {
    hash: '3a941a2ac1c39d50501f5bd5eebaebd521d18a8a7fd232072c42e4c73ca242b2',
    palace: '父母', stars: ['巨门', '天同'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫父母不周全' }],
  }],
  ['ziwei-v2-c013-p101017-004', {
    hash: 'd9e8a9c74a41fabb124a1033d276c897e3a62ce87c67cf322b14787dfba83a82',
    palace: '父母', stars: ['天相', '廉贞'], sector: sixMalefics,
    passages: [{ text: '加羊陀火铃空劫早刑' }],
  }],
  ['ziwei-v2-c013-p101018-006', {
    hash: 'a2ade0d0f8757636c7a5f7606b51774fde1082944e1018d7ed18bcf91c96658c',
    palace: '父母', stars: ['天梁', '太阳'], sector: sixMalefics,
    passages: [{ text: '加四杀空劫亦克早' }],
  }],
  ['ziwei-v2-c013-p101021-001', {
    hash: '6c05b8c9971231f1ecb673518e4bbd5f65102f725e86734c0b06e7fb3dd2768c',
    palace: '父母', stars: ['破军'],
    passages: [{ text: '破军克早离祖' }],
  }],
  ['ziwei-v2-c013-p101024-003', {
    hash: '89f3167569b8b02826fa6048848103d019cccba1ab8883b3da7a29e4175f12e1',
    palace: '父母', stars: ['左辅', '廉贞', '文昌'],
    passages: [{ text: '加文昌相生无刑' }],
  }],
  ['ziwei-v2-c013-p101024-004', {
    hash: '86c72edc286f1e833d4dbddb47252483a8a1d75f79992ffe591577c2813469be',
    palace: '父母', stars: ['左辅', '廉贞'], sector: fourMalefics,
    passages: [{ text: '加羊陀火铃刑伤' }],
  }],
  ['ziwei-v2-c013-p101025-003', {
    hash: '886263e730fa633ca414c6bb3e611e373943c2c40ea6ac98331c407065a4f978',
    palace: '父母', stars: ['右弼'], sector: fourMalefics,
    passages: [{ text: '见羊陀火铃凑，离祖二姓安居' }],
  }],
  ['ziwei-v2-c013-p101031-001', {
    hash: '74bc543c8df997b9cd621803bf509672ff4e77c9f051ba83d0b4e7fd92357cc8',
    palace: '父母', stars: [], companions: nobleStars, sector: nobleStars,
    passages: [{ text: '魁钺主父母荣贵' }],
  }],
]);

export function compileQuanshuPalaceText(claim) {
  const spec = palaceText.get(claim.id) ?? illnessPassages.get(claim.id);
  if (!spec) return undefined;
  if (digest(claim) !== spec.hash || spec.passages?.some(({ text }) => !claim.evidence.original_text.includes(text))) {
    return { reason: 'source_review_required', reviewNote: '所据卷二原文、出处或条件发生变化，须按原篇复核。' };
  }
  if (!spec.passages) return { compiler: quanshuPalaceTextProfile, inputs: quanshuPalaceInputs(spec),
    ...(spec.remainingAlternatives && { remainingAlternatives: spec.remainingAlternatives }) };
  return { reason: 'unmapped_condition', condition: '按《紫微斗数全书》卷二已核分句匹配',
    branches: spec.passages.map(({ text, ...details }) => ({ text, conditionCompiler: quanshuPalaceTextProfile,
      inputs: quanshuPalaceInputs({ ...spec, ...details }) })) };
}

function quanshuPalaceInputs({
  palace, stars, brightness = [null], absent = [], companions = [null], sect, gender, mainCount, coreCount,
  branch, branches = [branch], sector = [], sectorAbsent = [], sectorCompanions = [], noSectorBenefics = false,
  trineGroups = [], starChanges = [], sectorChanges = [], oppositeBeneficCount, noOppositeMalefics = false,
}) {
  const starFact = star => ({ kind: 'palace_star', palace, star, scope: 'origin' });
  const sectorFact = star => ({ kind: 'palace_sector_star', palace, star });
  const required = [
    ...stars.map(starFact),
    ...sector.map(sectorFact),
    ...(oppositeBeneficCount !== undefined ? [{ kind: 'palace_opposite_benefic_count', palace, count: oppositeBeneficCount }] : []),
    ...(noOppositeMalefics ? [{ kind: 'palace_opposite_six_malefic_count', palace, count: 0 }] : []),
    ...sectorChanges.map(change => ({ kind: 'palace_sector_mutagen', palace, change })),
    ...(mainCount !== undefined ? [{ kind: 'palace_main_count', palace, count: mainCount }] : []),
    ...(coreCount !== undefined ? [{ kind: 'palace_core_star_count', palace, count: coreCount }] : []),
    ...(noSectorBenefics ? [{ kind: 'palace_sector_benefic_count', palace, count: 0 }] : []),
    ...(sect ? [{ kind: 'natal_daylight', sect }] : []),
    ...(gender ? [{ kind: 'natal_gender', gender }] : []),
  ];
  const mustBeAbsent = [...absent.map(starFact), ...sectorAbsent.map(sectorFact)];
  const anyOf = [
    ...sectorCompanions.map(star => [sectorFact(star)]),
    ...trineGroups.map(group => group.map(star => ({ kind: 'palace_trine_star', palace, star }))),
    ...starChanges.map(change => [
      { kind: 'star_mutagen', palace, star: stars[0], scope: 'origin', change },
      { kind: 'palace_mutagen', palace, scope: 'origin', change },
      { kind: 'palace_sector_mutagen', palace, change },
    ]),
  ];
  return companions.flatMap(companion => brightness.flatMap(level => branches.map(seat => normalizeRuleInput('ziwei', {
    required: [
      ...required,
      ...(seat ? [{ kind: 'palace_branch', palace, branch: seat }] : []),
      ...(companion ? [starFact(companion)] : []),
      ...(level ? [{ kind: 'palace_brightness', palace, star: stars[0], scope: 'origin', brightness: level }] : []),
    ],
    mustBeAbsent, anyOf,
  }))));
}

// Chapter 101 uses one paragraph for multiple conditions. Each selected
// excerpt stays attached to its own native palace, body and observed condition.
const jielanPrefix = 'ziwei-v2-jielan-101-';
const earthVoidInheritance = [
  { text: '难为祖业', beneficMajority: false },
  { text: '吉多亦平', beneficMajority: true },
];
const voidStarsWithManyBenefics = { text: '加吉多，一人', sectorCompanions: voidStars, beneficMajority: true };
const tianfuChildrenWithKillingAndWenqu = { text: '加七杀曲，主二人，宜庶出', sectorCompanions: ['七杀', '文曲'] };
const wuquParentsWithYangTuo = { text: '加羊陀，克害', anyCompanions: ['擎羊', '陀罗'] };
export const jielanPalaceRepeatedPassages = new Map([
  [jielanPrefix + 'p010-043', { id: jielanPrefix + 'p010-005' }],
  [jielanPrefix + 'p011-037', { id: jielanPrefix + 'p011-023', text: voidStarsWithManyBenefics.text }],
  [jielanPrefix + 'p012-030', { id: jielanPrefix + 'p012-017', text: '加四杀遇昌，主离' }],
  [jielanPrefix + 'p013-026', { id: jielanPrefix + 'p013-009', text: tianfuChildrenWithKillingAndWenqu.text }],
  [jielanPrefix + 'p015-020', { id: jielanPrefix + 'p015-001', text: '加七杀四杀，痔疾风疮' }],
  [jielanPrefix + 'p015-021', { id: jielanPrefix + 'p015-002', text: '加四杀，寒热气疾' }],
  [jielanPrefix + 'p015-023', { id: jielanPrefix + 'p015-003', text: '会贪贞，腰足疾' }],
  [jielanPrefix + 'p015-025', { id: jielanPrefix + 'p015-003', text: '女人会武曲巳宫，气蛊疾' }],
  [jielanPrefix + 'p021-026', { id: jielanPrefix + 'p021-007', text: wuquParentsWithYangTuo.text }],
  [jielanPrefix + 'p021-029', { id: jielanPrefix + 'p021-003', text: '加破军，有灾，亦不妨寿' }],
  [jielanPrefix + 'p021-030', { id: jielanPrefix + 'p021-013', text: '加杀，不为害，有寿' }],
]);

const jielanPalaceText = new Map([
  ['p010-005', {
    hash: '28cb2dee57a56d08ba6be30238c30a98b1a16707904ea9195525805ae0242893', palace: '命宫', star: "地空",
    passages: earthVoidInheritance,
  }],
  ['p010-006', {
    hash: '870e2b73a6bf7271ce8528be72a7518864d9a693b39752d3770f5a7ae4876c66', palace: '命宫', star: "紫微",
    passages: [{ text: "形貌敦厚" }],
  }],
  ['p010-016', {
    hash: '2e5382158f255b63b78c19c3d77952a55bb9c2e6233871ab8536ce57110d12b5', palace: '命宫', star: "巨门",
    passages: [{ text: "一生有唇舌", levels: "陷", anyCompanions: fourMalefics }],
  }],
  ['p010-043', {
    hash: 'c6479ba0c412df0bec8dd1662be69e4e04ec15bc502c198d783fe5072271211e', palace: '命宫', star: "地空",
    passages: earthVoidInheritance,
  }],
  ['p011-017', {
    hash: 'bd03fecf59a29f31b4fbf4205276f8834f28e42e4f9ccd247b66df29d2be8f76', palace: '兄弟', star: "右弼",
    passages: [{ text: "加杀武陀火，主克，不得力", sectorCompanions: ["七杀", "武曲", "陀罗", "火星"] }],
  }],
  ['p011-021', {
    hash: '02735bfbf565a64a1d110389208fd1c06222c3337fc23e1bc7ec7a505b30ffc0', palace: '兄弟', star: "擎羊",
    passages: [{ text: "弟兄有败家之兆，不和", sameChanges: ["忌"] }],
  }],
  ['p011-022', {
    hash: '7af8be421b39258110cd8d62c8fca353c45694e39157f133557ca38ab6b4e7c2', palace: '兄弟', star: ["天姚", "天刑"],
    passages: [{ text: "主刑伤不和", sectorCompanions: ["天姚", "天刑"] }],
  }],
  ['p011-023', {
    hash: '55ffa89b9b0dc50cd1ee22921834a8826010a95e84c5f682be53340f24a55de1', palace: '兄弟', star: "地空",
    passages: [{ text: "主无", companion: "地劫", beneficMajority: false }, voidStarsWithManyBenefics],
  }],
  ['p011-024', {
    hash: '9c98a32239df68e1730500753ec49f87a535732bd3561c3018d99c05f555bc42', palace: '兄弟', star: nobleStars,
    passages: [{ text: "主兄弟中有一贵者", sectorCompanions: nobleStars, sectorChanges: ["禄", "权", "科"] }],
  }],
  ['p011-025', {
    hash: '4e249248f1c08717f4d04a1fbc37ee1215148bc3bec15b1a8d67750dd0de30a5', palace: '兄弟', star: "天同",
    passages: [{ text: "同梁兄弟和", companion: "天梁" }],
  }],
  ['p011-027', {
    hash: '4f02940e48c493c1aa82dc0c973bbd01ce0f4921c94be2eef894ce72863d2d0e', palace: '兄弟', star: ["七杀", "破军"],
    passages: [{ text: "火铃杀破路相过", sectorCompanions: ["火星", "铃星", "七杀", "破军"] }],
  }],
  ['p011-031', {
    hash: 'de385027892d5da01123e5dd41d24b74335cad4ae7c4a3bb97a953e541f9f70f', palace: '兄弟', star: "天府",
    passages: [{ text: "加七杀武，招怨", sectorCompanions: ["七杀", "武曲"] }],
  }],
  ['p011-033', {
    hash: '113a41f1e1055e00130cb05de47ed64e3aed76a28a0903d7c7dad193c0d44c94', palace: '兄弟', star: "贪狼",
    passages: [{ text: "有亦不同心。欠和", levels: "陷" }],
  }],
  ['p011-037', {
    hash: 'd80279d1e50c79f9822c0926ff832fbc5d894aec49892bc70ae398bf2d5f9c07', palace: '兄弟', star: "地空",
    passages: [voidStarsWithManyBenefics],
  }],
  ['p012-023', {
    hash: '2c1971feba1cd6a0b24e5f96bf2ea745b9687e1fd6d4c021c7a9be120beadf55', palace: '夫妻', star: nobleStars,
    passages: [{ text: "男主宦家女", gender: "男", sectorCompanions: nobleStars, sectorChanges: ["禄", "权", "科"] }, { text: "女主夫贵", gender: "女", sectorCompanions: nobleStars, sectorChanges: ["禄", "权", "科"] }],
  }],
  ['p012-024', {
    hash: '2631b28c1cd3af16df48b62502d9fb39a9df060b440e2865cfc7b2f018dd8fce', palace: '夫妻', star: "天同",
    passages: [{ text: "同梁左右和", companion: "天梁", sectorCompanions: assistants }],
  }],
  ['p012-025', {
    hash: '63701719d5d5a1cfea2ecac8df22ac1523b5ea9bd93bb859640d277feedb3d91', palace: '夫妻', star: ["武曲", "廉贞"],
    passages: [{ text: "铃武廉陀夫妇离", sectorCompanions: ["铃星", "武曲", "廉贞", "陀罗"] }],
  }],
  ['p013-013', {
    hash: '91f49a67302462b204ed3eb6296c50ece1875e613f4c52d72960b172c27ce7b5', palace: '子女', star: "天相",
    passages: [{ text: "如破军四杀，庶出，迟吉", sectorCompanions: ["破军"], sectorMaleficCounts: [4] }],
  }],
  ['p013-017', {
    hash: 'c91718dd169cfccbdf432d712b0bee77d11229ec4471ace8e2a518bb61093917', palace: '子女', star: "右弼",
    passages: [{ text: "加杀武火陀，克，或一人不得力", sectorCompanions: ["七杀", "武曲", "火星", "陀罗"] }],
  }],
  ['p013-021', {
    hash: '09986c7e41160583d813ca4def86ede0eb5d90daabdad0d87f6c5743fbb60b7a', palace: '子女', star: ["擎羊", "陀罗"],
    passages: [{ text: "主孤，有亦不得力" }],
  }],
  ['p013-022', {
    hash: '7ee018f63ce7bee2ed32a148d6a871cbe46ae4dd2b9788f6b8bd494ff02347a1', palace: '子女', star: "地空",
    passages: [{ text: "无子。", companion: "地劫", sameChanges: ["忌"] }],
  }],
  ['p013-023', {
    hash: '3d60b744d1c4f395921411a0672f0751985bc2673970160bb9c8ab6a9284e017', palace: '子女', star: nobleStars,
    passages: [{ text: "主生贵子", sectorCompanions: nobleStars, sectorChanges: ["禄", "权", "科"] }],
  }],
  ['p013-026', {
    hash: '2920f3780099c9d17ee164591bbea8d29c8b6863ab8d2f8165c1186ee84d7483', palace: '子女', star: "天府",
    passages: [tianfuChildrenWithKillingAndWenqu],
  }],
  ['p013-029', {
    hash: '8718078dc042f8a3a04526b56e9e5b47a1a914d9bb5f8ad85210313a4516b1e4', palace: '子女', star: "武曲",
    passages: [{ text: "临老二子庶出。" }],
  }],
  ['p013-032', {
    hash: 'abe61c4b47ae51ebe886ddde6555ba741f8dd67d73a4c96e6a34d88f769d74e6', palace: '子女', star: ["禄存", "七杀"],
    passages: [{ text: "禄存七杀一二柯" }],
  }],
  ['p014-019', {
    hash: '00186aa5751a531716d1c83cf0369a46e99ae98a5038ec1e8358efd8fc88c33a', palace: '财帛', star: nobleStars,
    passages: [{ text: "并吉", sectorCompanions: [...assistants, ...nobleStars], sectorChanges: ["禄", "权", "科"] }],
  }],
  ['p018-018', {
    hash: '3c91244a1de11eb54af6ca2781149bf294b4729e8a5244abc3aa30e661b6be37', palace: '官禄', star: "右弼",
    passages: [{ text: "文章贵格", companions: ["紫微", "天府"], beneficScope: "trine", beneficOptions: ["文昌"] }],
  }],
  ['p018-021', {
    hash: '890b050f1f19643c92df898cd72a993129a07b03dd38744ef62c18c976d88d3f', palace: '官禄', star: nobleStars,
    passages: [{ text: "并贵", sectorCompanions: nobleStars, sectorChanges: ["禄", "权", "科"] }],
  }],
  ['p019-021', {
    hash: 'b7be9090e5dc39f52710ffeb5461ab06a1fd37f2e21240a2da29310338a64d56', palace: '田宅', star: ["火星", "铃星"],
    passages: [{ text: "逢吉，自置", beneficScope: "sector", beneficOptions: { 火星: benefics.filter(star => star !== '文曲') } }],
  }],
  ['p019-022', {
    hash: '64f4853da2c8e3d9e5a87c4f7228c9131f7e209ecc8c974651b8df45cc60236e', palace: '田宅', star: "武曲",
    passages: [{ text: "武相同居左右良。", companion: "天相", sectorCompanions: assistants }],
  }],
  ['p020-016', {
    hash: '047abd3b44999b06f2a960c0c99338a7338705f1199d51278215640cc230201b', palace: '福德', star: "左辅",
    passages: [{ text: "福禄有余", companion: "右弼" }],
  }],
  ['p021-017', {
    hash: '8c1e885939c7d3934f8633cabfcfd77fc5cbed9065fd0a8a730752677c75b314', palace: '父母', star: "文昌",
    passages: [{ text: "主富贵", noSectorMalefics: true }],
  }],
  ['p021-022', {
    hash: '25e7b329ce590045d2d6e021a4f022ca0df399617bdc2678fc55af59a31a6763', palace: '父母', star: "地空",
    passages: [{ text: "宜庶出，过房吉。", companion: "地劫" }],
  }],
  ['p021-023', {
    hash: 'ace88957fb417a02d28dc56b8135f05a2aa271ae8665fa1764badcba9264386c', palace: '父母', star: "天刑",
    passages: [{ text: "有克", sameChanges: ["忌"] }],
  }],
  ['p021-024', {
    hash: '5fff184d3cb9fdf5b9ead18ef62447a815c3f75780cf308de6813724a09ce5c1', palace: '父母', star: nobleStars,
    passages: [{ text: "富贵平和", sectorCompanions: nobleStars, sectorChanges: ["禄", "权", "科"] }],
  }],
  ['p021-026', {
    hash: 'f8c45bb32cf49077302d5509e3a0443c2868a08b8bc56b4312e9f6274457a51e', palace: '父母', star: "武曲",
    passages: [wuquParentsWithYangTuo],
  }],
  ['p021-029', {
    hash: '63950f659a2ae78013841ecb19a14bcf75f345a58b964c1c7a83d94d49f5bd7e', palace: '父母', star: "文曲",
    passages: [{ text: "加破军，有灾", companion: "破军" }],
  }],
  ['p021-030', {
    hash: '28b112dc8f9dc8d6daf45bdcc7b3c716843e45b2fa053df21e1913029b5b5a3c', palace: '父母', star: "天相",
    passages: [{ text: "加杀，不为害", anyCompanions: fourMalefics }],
  }],
  ['p023-001', {
    hash: '189379644c68963b452a45d3708054f3ef151f8a9e9c65f3df02481fad947f23', palace: '田宅', star: ["擎羊", "陀罗"],
    passages: [{ text: "羊陀先破后才发" }],
  }],
  ['p014-003', {
    hash: 'aac5a0a7ee2922a13577bdf408bbf1c4ec169049103d41fea32a82ae9c8f8ce8', palace: '财帛', star: '武曲',
    passages: [{ text: '入庙化吉，闹中进财，白手成家', levels: '庙', changes: '禄权科' }],
  }],
  ['p014-004', {
    hash: '023d0fde2e5a02fd9f36764b8a6c9dff80c37806acbb29310fe41d17ee8d4229', palace: '财帛', star: '贪狼',
    passages: [{ text: '四库之地，吉', branches: '辰戌丑未' }],
  }],
  ['p014-005', {
    hash: 'a35e51a00e44ce2d3255d5019f161c15dc4d5058072b60031a53341887447114', palace: '财帛', star: '巨门',
    passages: [{ text: '见地空，财不聚', companion: '地空' }],
  }],
  ['p014-006', {
    hash: '624b85b700e3db1e48d61c59f5f15fa6c1096b3afcd8584bd7d195edff2c6151', palace: '财帛', star: '七杀',
    passages: [{ text: '入庙，闹中进财', levels: '庙' }],
  }],
  ['p014-008', {
    hash: '375b82acb7f53eda315c78ca80ab73dfd8c6251ea67c404ae3a53861b82be8cb', palace: '财帛', star: '太阳',
    passages: [{ text: '陷地，劳碌生财', levels: '陷' }],
  }],
  ['p014-009', {
    hash: '9915f407979a4b226602f8c7063c0c317d25974d323995522c903f91fb04ed88', palace: '财帛', star: '天同',
    passages: [{ text: '陷地，破耗', levels: '陷' }],
  }],
  ['p014-012', {
    hash: 'cb95866db6aa7b5ff80367f4c4cdf72123496dff7695424656a4381d46d7e6de', palace: '财帛', star: '太阴',
    passages: [{ text: '庙旺，富贵财多', levels: '庙旺' }, { text: '陷地，成败不一，终不聚财', levels: '陷' }],
  }],
  ['p014-014', {
    hash: '2a2685f787bfb94e3750d00e2c8240fa09dc58152e8e8870d28c94348b9dd543', palace: '财帛', star: '天梁',
    passages: [{ text: '入庙，财帛成就', levels: '庙' }],
  }],
  ['p014-015', {
    hash: '832fab7e5d03817e2bdfb46d50f16cd235af21425788b29e51b92c3fb33d0dee', palace: '财帛', star: '文昌',
    passages: [{ text: '入庙，丰阜成聚', levels: '庙' }, { text: '陷地，破耗不一，闹中进财', levels: '陷' }],
  }],
  ['p014-016', {
    hash: '915a0477dfa7df5451a22fd02fff88778260e6ebaea74af803c490fd2a23212c', palace: '财帛', star: '文曲',
    passages: [{ text: '入庙，丰阜成聚', levels: '庙' }, { text: '陷地，破耗不一，闹中进财', levels: '陷' }],
  }],
  ['p017-003', {
    hash: '6f926e48b52e02199cb8ca12ba0935f125e0d96274b569a535c83c1cd977a89a', palace: '仆役', star: '天梁',
    passages: [{ text: '入庙，旺相', levels: '庙' }, { text: '陷地，无力', levels: '陷' }],
  }],
  ['p017-011', {
    hash: 'aaf4ad5e22e388d0d6b99fd5cb44da75bcd4574980b749db52feaa2eb73b11ab', palace: '仆役', star: '贪狼',
    passages: [{ text: '入庙，旺相', levels: '庙' }, { text: '陷地，无力', levels: '陷' }],
  }],
  ['p018-001', {
    hash: '08d570b511fbb69e0fbf81b577fd8e545714922cb1cae8d3191fa52e57581ef8', palace: '官禄', star: '天机',
    passages: [{ text: '入庙，贵格', levels: '庙' }, { text: '陷地，吏曹', levels: '陷' }],
  }],
  ['p018-003', {
    hash: '8baa0fb22c7b20ec4a926907c533e2a3470c9ed9ced71cda1f4bac5b8e51081b', palace: '官禄', star: '破军',
    passages: [{ text: '庙，富贵不小', levels: '庙' }],
  }],
  ['p018-005', {
    hash: '0fa9fa21b0571bccb79cbb823e4ff15911e5ac3af66c26788627643ad26b0a78', palace: '官禄', star: '文曲',
    passages: [{ text: '庙，文武才', levels: '庙' }],
  }],
  ['p018-008', {
    hash: '8ae418e531f199485d0087e354cbb52123431e78f09fe248ef07c2774a719bfe', palace: '官禄', star: '廉贞',
    passages: [{ text: '陷，不利', levels: '陷' }],
  }],
  ['p018-009', {
    hash: '6eeef7257edd06192845f2bb663e4c660e9dd6b98cdaa994c249ba855696e379', palace: '官禄', star: '太阳',
    passages: [{ text: '陷，不久', levels: '陷' }],
  }],
  ['p018-010', {
    hash: '2b4af282d46c3d8bf4c35522c7a5b9d1d924cfa333e1fe44dc4217a8da77c80f', palace: '官禄', star: '天同',
    passages: [{ text: '入庙，文武三品职', levels: '庙' }, { text: '陷地，吏曹', levels: '陷' }],
  }],
  ['p018-011', {
    hash: '70c751a3b5be8cf1cac583fd6922d5c23519790a8aa47a32470f209d9995b35a', palace: '官禄', star: '天府',
    passages: [{ text: '入庙，权贵，文武之才', levels: '庙' }],
  }],
  ['p018-012', {
    hash: '48694671309376cf4ad2b0badee8b5daa8b15303f97c026ae58cfbea4eaaf6b0', palace: '官禄', star: '太阴',
    passages: [{ text: '入庙，权贵', levels: '庙' }],
  }],
  ['p018-013', {
    hash: '6b44ce082bf18dd8123e64850f7a665279412c5aff69d545acfebf3ef680fea9', palace: '官禄', star: '贪狼',
    passages: [{ text: '陷，平常', levels: '陷' }],
  }],
  ['p018-014', {
    hash: 'cb1d6b01c95ab27bb8ac9f00975626e1ab2551dce74f93d4278102055fa02116', palace: '官禄', star: '巨门',
    passages: [{ text: '入庙，武职', levels: '庙' }, { text: '陷，奔波', levels: '陷' }],
  }],
  ['p018-015', {
    hash: '4ac5ba99ba637b23d03c38b2f47cf82e8cc938a23a3ccd3b8a5dbbc005cea702', palace: '官禄', star: '天相',
    passages: [{ text: '庙，权贵，食禄千钟，常人富足', levels: '庙' }],
  }],
  ['p018-016', {
    hash: 'b6d3afa3acaea3513c897b646d9e654a6cc635f30f3afa40e985c467a2a30d5d', palace: '官禄', star: '七杀',
    passages: [{ levels: '庙' }],
  }],
  ['p018-019', {
    hash: '172e57b664aa38f64c706dbab61cfd78672d7f6e5876862323cac7642dcefada', palace: '官禄', star: '武曲',
    passages: [{ text: '庙，权贵', levels: '庙' }],
  }],
  ['p019-001', {
    hash: '3d4abc318a32151546370975dfdf65ad5f151ea31e37dd9868faa632abf22458', palace: '田宅', star: '天机',
    passages: [{ text: '如陷地，无分', levels: '陷' }],
  }],
  ['p019-002', {
    hash: '9baabbe13ec433a69c5a49d56744303054afa0e42c27f23e65ca6852a3f5d820', palace: '田宅', star: '天府',
    passages: [{ text: '庙旺，始终如一', levels: '庙旺' }],
  }],
  ['p019-004', {
    hash: 'd48fd734fe3109463a018aca24e60c39bdfea2ec6e18fd49b0c7de1519a8c610', palace: '田宅', star: '巨门',
    passages: [{ text: '入庙亦自置', levels: '庙' }],
  }],
  ['p019-006', {
    hash: '57d4b4ec7911f18e501e4b32a15694af66ff42a99cd48de607da5a84871c646e', palace: '田宅', star: '破军',
    passages: [{ text: '入庙，自置', levels: '庙' }, { text: '陷地，不成家', levels: '陷' }],
  }],
  ['p019-008', {
    hash: 'b8ac564eeb64cc0aa9f82dc61b19d3e658ff78014e357865b15ee9fde042d3c9', palace: '田宅', star: '太阳',
    passages: [{ text: '入庙，多得祖业', levels: '庙' }, { text: '陷，无', levels: '陷' }],
  }],
  ['p019-009', {
    hash: '14067e1ee118291c4252f966dfaef86e33338371bfe918ae9e38d743450fa26c', palace: '田宅', star: '武曲',
    passages: [{ text: '入庙，自置', levels: '庙' }],
  }],
  ['p019-012', {
    hash: '4ea73fd503f1529ee2d2cdba6c99f8b4733bbb909d1ca3181964cf4b79cee064', palace: '田宅', star: '太阴',
    passages: [{ text: '入庙，有分', levels: '庙' }, { text: '陷，无', levels: '陷' }],
  }],
  ['p019-013', {
    hash: 'b5db74d96db156bc6e45e5ddcd6c2853ac53ab8ab89d3dd6bdaec41fab2de36e', palace: '田宅', star: '天相',
    passages: [{ levels: '庙' }],
  }],
  ['p010-004', {
    hash: 'ca8ef3f735a4343174effd6dc30992621ef3adbdf7185aa1b959d434cab3aee0', palace: '命宫', star: '贪狼',
    passages: [{ text: '庙旺，富贵', levels: '庙旺' }],
  }],
  ['p010-008', {
    hash: '02715a669307ea49158bc0c7bc38b19f03cc00ba169d30be8ec9fa1306294e1d', palace: '命宫', star: '天机',
    passages: [{ text: '庙旺，主人性急好善，做事有力，察见渊深', levels: '庙旺' }, { text: '如化吉，富贵', levels: '庙旺', changes: '禄权科' }, { text: '陷地，多奸诈，平常', levels: '陷' }],
  }],
  ['p010-020', {
    hash: 'e4cab49ab69d0cff3db2c62c778304ef874ca73c2bf08c450ad0eadd658bc885', palace: '命宫', star: '天相',
    passages: [{ text: '庙旺，衣食足，福有余，为人敦厚和平，聪明秀丽，富贵之论', levels: '庙' }, { text: '陷地，平常', levels: '陷' }],
  }],
  ['p010-022', {
    hash: 'fbc6b5e3de0f18644eb20b0271c66e8ce57e666b3d5f0bb19fec6c8a799275a9', palace: '命宫', star: '破军',
    passages: [{ text: '庙旺，富贵', levels: '庙旺' }, { text: '陷，平常，孤贫寡合招非', levels: '陷' }],
  }],
  ['p010-023', {
    hash: '57df6112be5465aba2cb817e8a04f2bcc52b4a7a6cfc9e68db51f5bbfceedd4e', palace: '命宫', star: '左辅',
    passages: [{ text: '庙旺，富贵，福量宽和，子息亦吉', levels: '庙旺' }, { text: '陷，亦平稳', levels: '陷' }],
  }],
  ['p010-025', {
    hash: 'a84a765c98cbc8b6413f39e675b846c9a872749c186a61dd09055bbe3d540230', palace: '命宫', star: '文昌',
    passages: [{ text: '庙旺，富贵人，为人俊秀，有志读书', levels: '庙' }, { text: '陷地，平常', levels: '陷' }],
  }],
  ['p010-026', {
    hash: 'd716c88e88583711ae865f9d57d0b2d422cf0be2c27b873cee86425701c51f5b', palace: '命宫', star: '文曲',
    passages: [{ text: '庙旺，富贵', levels: '庙旺' }],
  }],
  ['p010-031', {
    hash: 'e4e8abdfb1ccfff2cfe8014395479a15af83313a3c870cfdf1980e751b57e638', palace: '命宫', star: '擎羊',
    passages: [{ text: '陷地招凶', levels: '陷' }],
  }],
  ['p010-032', {
    hash: '96d8a1ccdceee81a30d6d8d72ee9f8ad6d3282affb059da7c4293054985a1ad4', palace: '命宫', star: '陀罗',
    passages: [{ text: '入庙，主贵，发达', levels: '庙' }, { text: '陷，主孤贫，心事不同', levels: '陷' }],
  }],
  ['p010-039', {
    hash: 'd8b72ef23cf90c31ef49a2a39bab2a2b685472496db1e8c3ab755389d8ade5a6', palace: '命宫', star: '天同',
    passages: [{ levels: '庙旺' }],
  }],
  ['p010-041', {
    hash: '56061a69bbf3e5378fa7d1ee32e73547fd91ce3a9a52f1d5fd70e924274b6e39', palace: '命宫', star: '七杀',
    passages: [{ text: '庙旺，主贵', levels: '庙旺' }],
  }],
  ['p011-002', {
    hash: '11488c1bc08baa989c53abcf08c3843a16096eea80a090b3f1211ee255393af1', palace: '兄弟', star: '太阳',
    passages: [{ text: '陷，主克，异居可也', levels: '陷' }],
  }],
  ['p011-007', {
    hash: 'c1695f46ea2ae903d01c9fa76eb44f511b34ea7550ce810e913989e16648d004', palace: '兄弟', star: '天机',
    passages: [{ text: '如庙旺，三二人，有贵', levels: '庙旺' }],
  }],
  ['p011-008', {
    hash: '95d1a95deea66ece3e2a5df4e626707d90af2c0839f1b26b63cd2e84505e082d', palace: '兄弟', star: '廉贞',
    passages: [{ text: '庙旺，主二人得力', levels: '庙' }],
  }],
  ['p011-009', {
    hash: '6a889ceddb607c3ca9977d5a954e92ef0d157ea25663e45e406b30d3d2a8142f', palace: '兄弟', star: '天府',
    passages: [{ text: '庙，主五人', levels: '庙' }],
  }],
  ['p011-011', {
    hash: '8d598594c01d450b859014d4307a809e7d9186b91b782bdddf9eaf93d3f30e71', palace: '兄弟', star: '巨门',
    passages: [{ text: '入庙吉', levels: '庙' }],
  }],
  ['p011-012', {
    hash: '9c8756bc7604b8f96baed18b1a229bd8540dcfe388f762f22ad73fb078565114', palace: '兄弟', star: '贪狼',
    passages: [{ text: '庙旺，三人', levels: '庙旺' }],
  }],
  ['p011-030', {
    hash: '10e97c94bfc4cd62ab708f8e01916f13414e598b55116a27de1a9912187178e6', palace: '兄弟', star: '天府',
    passages: [{ text: '加左右曲，得力', levels: '庙', companions: ['左辅', '右弼', '文曲'] }],
  }],
  ['p011-035', {
    hash: '5955c017948bab58087bf66114468ec28c24a0df157d4d4e5ea261e003b67392', palace: '兄弟', star: '天同',
    passages: [{ text: '见天梁主姊妹招夫', companion: '天梁' }],
  }],
  ['p012-005', {
    hash: '9f6a3dc181ddf0ecc0ebbbec66b2363ca9546eb20598cb8a093687b6c819a82a', palace: '夫妻', star: '破军',
    passages: [{ text: '或化吉，好', changes: '禄权' }],
  }],
  ['p013-010', {
    hash: 'd42728541e989faca3ec093b7f0600c4d7e524ff510f511dd38268103476d6e2', palace: '子女', star: '太阴',
    passages: [{ text: '庙旺，三子', levels: '庙旺' }, { text: '陷，主孤，有亦不得力', levels: '陷' }],
  }],
  ['p013-011', {
    hash: '031ae35a045dce0c1e31b28498d5d802012752161da6e7a882ec1d55b1b55f7e', palace: '子女', star: '贪狼',
    passages: [{ text: '庙旺，男女三四人', levels: '庙旺' }, { text: '陷，孤克，一子半子', levels: '陷' }],
  }],
  ['p016-003', {
    hash: '6d9dc83f3420969d828ee7c03cd114b69108c01a7b1e4e0df9907ebd2955eb7c', palace: '迁移',
    passages: [{ changes: '禄' }],
  }],
  ['p016-004', {
    hash: '28b888d892531b66b6ae5858e3a559e3a73dceb922a850ef86882ee4142e236e', palace: '迁移',
    passages: [{ changes: '权' }],
  }],
  ['p016-025', {
    hash: '0924f417f47c13a6b226cde98b4fb182352415f943d175e130b94db670248e16', palace: '迁移', star: '破军',
    passages: [{ text: '破杀陷宫多是非', levels: '陷' }],
  }],
  ['p017-015', {
    hash: '499d1279f08631474ce7a8057bb35cb20ef3ab692ca63b941c393693f3fc6463', palace: '仆役', star: ['左辅', '右弼'],
    passages: [{}],
  }],
  ['p021-001', {
    hash: 'd4766d38e7a71c96821ea7e44f69dec00e4a98e8bde33c19c84ea13aa44b32fb', palace: '父母', star: '天机',
    passages: [{ text: '陷，偏生', levels: '陷' }],
  }],
  ['p021-006', {
    hash: 'dae150b67df986e737baefc7e8f0fd301faee43ff222a7b2ed717c92467a41bc', palace: '父母', star: '太阳',
    passages: [{ text: '入庙，富贵无克', levels: '庙' }],
  }],
  ['p021-011', {
    hash: '6805fdf27334516c3a7c7c31d0c56090b5b132943a7cbfa519cb7286bb5c9afb', palace: '父母', star: '太阴',
    passages: [{ text: '庙，无克，父母平和', levels: '庙' }],
  }],
  ['p021-016', {
    hash: '9854aab23f25f5d63adb5b05e9109bb7d9df48a9ebee223cb088e8c73017649a', palace: '父母', star: '破军',
    passages: [{ text: '入庙，亦吉', levels: '庙' }],
  }],
  ['p021-028', {
    hash: '4ac0538817cf79fe4c8f49b89b21a0b86ab5f318266a0fc5489715f9fa3fda93', palace: '父母', star: '廉贞',
    passages: [{ changes: '忌' }],
  }],
  ['p011-018', {
    hash: '06449a342ad238b665e7537fc0a5a38c9c4e469f4175a7b37c43b2e6fa35b6d4', palace: '兄弟', star: '文昌',
    passages: [{ text: '加府曲左右，得力', sectorCompanions: ['天府', '文曲', '左辅', '右弼'] }],
  }],
  ['p011-028', {
    hash: 'd5132e291ecc8c2edaebad144b374875648fc179f6ad414ad4bfa1ed6bb71b5d', palace: '兄弟', star: '紫微',
    passages: [{ sectorCompanions: ['文昌', '文曲'] }],
  }],
  ['p011-034', {
    hash: '0976928abe1d9269ccd38c7c6d8ac6e38c556303ea0299cd3ea7acbfb256b9ab', palace: '兄弟', star: '武曲',
    passages: [{ sectorCompanions: ['破军', '七杀'] }],
  }],
  ['p011-036', {
    hash: '4d9cae517e3a46020a5325076de0aa7c4b06390c9f83efce3d6a5d7c78475b54', palace: '兄弟', star: '天相',
    passages: [{ sectorCompanions: ['天魁', '天钺'] }],
  }],
  ['p013-008', {
    hash: '9ee5e48bf96d34926d075caf95b55d517fa5b35446be7a9a05599889f5360901', palace: '子女', star: '廉贞',
    passages: [{ text: '七杀，偏生', companion: '七杀' }],
  }],
  ['p013-009', {
    hash: 'fd2a98549880c6829751a586de55ff03ac21cac94f134bfb3443fbcc2859956d', palace: '子女', star: '天府',
    passages: [tianfuChildrenWithKillingAndWenqu],
  }],
  ['p013-012', {
    hash: '9e6bc95dbe2cdd9dfa12ebf6d2af1557411309a7ce7ff24cc8f90dc77e311556', palace: '子女', star: '巨门',
    passages: [{ text: '见同左右，亲子得力，庶出送老', sectorCompanions: ['天同', '左辅', '右弼'] }],
  }],
  ['p013-016', {
    hash: '0d960d28a74077943b4401eafebc6b6a3032247436f1ef5f93f03ae4ad30f9d6', palace: '子女', star: '左辅',
    passages: [{ text: '加曲左右，贵，得力', sectorCompanions: ['文曲', '右弼'] }],
  }],
  ['p013-018', {
    hash: 'ea87f5c83631cab4de183a1290289d3cb4b01120c0d9f0cabe911bd880a60326', palace: '子女', star: '文昌',
    passages: [{ text: '加曲府左右，贵', sectorCompanions: ['文曲', '天府', '左辅', '右弼'] }],
  }],
  ['p013-028', {
    hash: '5573f8fe0799c517d9cb5c03b0d4db284eecc943a7e770dece02444c4109799f', palace: '子女', star: '巨门',
    passages: [{ branches: '酉', sectorCompanions: ['天机', '左辅'] }],
  }],
  ['p018-004', {
    hash: '469e40017db255544b3f5b151b24bcfb41cb9b6e6b34da7b250bdb0adcfda3e7', palace: '官禄', star: '文昌',
    passages: [{ text: '入庙，遇太阴，权贵，大臣职', levels: '庙', companion: '太阴' }],
  }],
  ['p018-007', {
    hash: '960542eb14e37c8638d01092bdcae21e89bd84d956a4c5975adcc738b763107b', palace: '官禄', star: '紫微',
    passages: [{ levels: '庙旺', sectorCompanions: ['文昌', '天钺', '天魁', '左辅', '右弼'] }],
  }],
  ['p018-024', {
    hash: '1d3122cff8fc78113819c335e1c64994ca1c3f078f5d20bd7ad8faebc877e0e8', palace: '官禄', star: '天梁',
    passages: [{ branches: '午', sectorCompanions: ['左辅', '右弼', '天魁', '天钺'] }],
  }],
  ['p010-029', {
    hash: '9e49d2086a96432f4019c7748b6848657615f795b2f68c1a4a230d82cac12739', palace: '命宫', star: ['火星', '铃星'],
    passages: [{ text: '庙旺，性刚不奈静，读书可贵', levels: '庙' }],
  }],
  ['p011-020', {
    hash: 'e5a45d9640bba254d9a161e9af57b930180735c8a8629198808695e19383072b', palace: '兄弟', star: ['火星', '铃星'],
    passages: [{ text: '庙旺，二人，不得力', levels: '庙' }, { text: '陷，克，独', levels: '陷' }],
  }],
  ['p012-022', {
    hash: '95f63f927186a96af97993f256338a5a58cffe84118e56c3ead50fcf1d382ba6', palace: '夫妻', star: ['擎羊', '陀罗'],
    passages: [{ text: '入庙，吉', levels: '庙' }, { text: '不入庙，克', levels: '陷' }],
  }],
  ['p014-018', {
    hash: '0454dd9aca9d8822764c9bdf0285a4e8c17fdfa9c9120ffa49ab76296388518c', palace: '财帛', star: ['火星', '铃星'],
    passages: [{ text: '入庙发财', levels: '庙' }],
  }],
  ['p017-019', {
    hash: '08b3f01112a21be91eaa5c63dc73027293e2ccf896b219d5194d294be5fd5250', palace: '仆役', star: ['火星', '铃星'],
    passages: [{ text: '入庙，平和', levels: '庙' }, { text: '陷地，招怨', levels: '陷' }],
  }],
  ['p018-006', {
    hash: '39dea10016a8a973c8e56d8db9ef7704d126ca027101b271f808cf9569d99983', palace: '官禄', star: ['火星', '铃星'],
    passages: [{ text: '庙，权贵', levels: '庙' }],
  }],
  ['p018-020', {
    hash: '847ed098375bf35283e6ab56c27831eb4178fa8fcc92ced26deea8dfd1d0fbb0', palace: '官禄', star: ['擎羊', '陀罗'],
    passages: [{ text: '庙，权贵，武职', levels: '庙' }, { text: '陷，主不足，奔波度日', levels: '陷' }],
  }],
  ['p018-026', {
    hash: '222a7d75b4702cfdc3c1396bfba3cf7b590c69cfe121c9e25cde84fd27c83300', palace: '官禄', star: ['火星', '铃星'],
    passages: [{ text: '陷，冷职', levels: '陷' }],
  }],
  ['p021-021', {
    hash: '3071ed42081dd0378e44672e303e8c67c488a92172b029bbf85c62a72f47195b', palace: '父母', star: ['火星', '铃星'],
    passages: [{ text: '庙，富贵', levels: '庙' }],
  }],
  ['p010-002', {
    hash: '7d62bad05261621d79fc76bea2943d0419eaeb7beeb99cd2460efb34a598fc54', palace: '命宫', star: '廉贞',
    passages: [{ text: '遇吉亦好学近古', beneficScope: 'sector' }],
  }],
  ['p010-007', {
    hash: 'f8101292aa7caddf18a9995967a3fe56018eec1d22a25dd9dc6ef525add7f23d', palace: '命宫', star: '紫微',
    passages: [{ text: '入庙，富贵双全', levels: '庙' }],
  }],
  ['p010-009', {
    hash: '7bb56bee3556e5c3b5e3d17138adcf84f614267c4f6bb255b85207d78c8c62f3', palace: '命宫', star: '太阳',
    passages: [{ text: '庙，富贵，三方吉拱', levels: '庙', beneficScope: 'trine' }],
  }],
  ['p010-014', {
    hash: '608e9840696ca7d5e0a211184003bfba64d9b97e1e90a28284b4f02782ba93da', palace: '命宫', star: '天府',
    passages: [{ text: '庙旺，富贵', levels: '庙旺' }],
  }],
  ['p010-040', {
    hash: '79d8efa0308e10eaa8f187faf268a195e4929c3e362b17b9234be27b5f7f8bff', palace: '命宫', star: '右弼',
    passages: [{ levels: '庙' }],
  }],
  ['p011-003', {
    hash: '137b3ea6b0da69943819b5d40abde9894430833a3f313d24529030b3bd7a90ed', palace: '兄弟', star: '天同',
    passages: [{ text: '见天梁主姊妹招夫', sectorCompanions: ['天梁'] }],
  }],
  ['p011-014', {
    hash: 'bf594565a6415b63186b2a1ea4d60d073b052cbf5f44190fbcdb6c09ba69655d', palace: '兄弟', star: '七杀',
    passages: [{ text: '加吉一人', beneficScope: 'same' }],
  }],
  ['p011-015', {
    hash: '298d9cca66d54e761248395b6bc402600360262b0b8b5babd3fa5b3c8a43ea8b', palace: '兄弟', star: '破军',
    passages: [{ text: '加吉，三二人，亦不和', beneficScope: 'same' }],
  }],
  ['p011-019', {
    hash: '66e5a4e9b281be5c573d97acebe9d671db3f1fd45c96c8a04f6cd18ea9a4fd29', palace: '兄弟', star: '文曲',
    passages: [{ text: '加吉得力', beneficScope: 'same' }],
  }],
  ['p011-029', {
    hash: 'e84b2261524aa066bde82783a295ea778941c83a9fcc0410172addfed7e09f43', palace: '兄弟', star: '紫微',
    passages: [{ companion: '破军' }],
  }],
  ['p012-001', {
    hash: '6fcc774c5f1660858659927b8a716422dcd4a67c43ff4f9e00863e6896d108f1', palace: '夫妻', star: '天机',
    passages: [{ text: '男主妻小，性刚早婚', gender: '男' }, { text: '女主夫长', gender: '女' }],
  }],
  ['p012-002', {
    hash: '7f6dc9194d948a5a8c7f0ae5757666a67ed667e82a3921206e7a7a58c14d64f5', palace: '夫妻', star: '太阴',
    passages: [{ text: '男主妻多聪俊', gender: '男' }, { text: '女主夫长早聘', gender: '女' }],
  }],
  ['p012-003', {
    hash: '7beba2ac1db24b81d0012e7cc1a76d2d2498f8fd8ce68c811ece3d3788eb0729', palace: '夫妻', star: '天相',
    passages: [{ text: '无杀，谐老', noSectorMalefics: true }],
  }],
  ['p012-004', {
    hash: 'e958a217342e0ab46344b8c7ac4f8216ef763777fa5ed1dd8c31c58974f8a3c6', palace: '夫妻', star: '天梁',
    passages: [{ text: '男主妻长，贤达性刚', gender: '男' }, { text: '女主夫长，性刚', gender: '女' }],
  }],
  ['p012-006', {
    hash: '981adc6f513902d3a613ca183570d5e7a16c4600a38dc5612df0d5d23c17c84e', palace: '夫妻', star: '左辅',
    passages: [{ text: '见昌曲，美貌', gender: '男', sectorCompanions: ['文昌', '文曲'] }, { text: '女主夫吉', gender: '女' }],
  }],
  ['p012-007', {
    hash: '75fbbfb3d8cee43d6747a1ec3ce6e9ea3287a002ea321f9aea940c59b68c7fd8', palace: '夫妻', star: '右弼',
    passages: [{ text: '男主妻聪性刚', gender: '男' }, { text: '见昌曲，美貌', gender: '男', sectorCompanions: ['文昌', '文曲'] }],
  }],
  ['p012-010', {
    hash: '94a8a275e79ea22428b848182a1156603619f84be8207181bc1c86f917f858e7', palace: '夫妻', star: '紫微',
    passages: [{ text: '男主妻贤', gender: '男' }, { text: '女主夫荣', gender: '女' }],
  }],
  ['p012-011', {
    hash: '87409ecf3c745a9ac26b04ea506673a280108e5850a3fe99560cf704b5acd50b', palace: '夫妻', star: '武曲',
    passages: [{ text: '男主妻性急', gender: '男' }, { text: '女主夫贵', gender: '女' }],
  }],
  ['p012-013', {
    hash: '72541df9a7427085e01adf33ca822c7f2999403ca890e89bc873ce0111817295', palace: '夫妻', star: '天同',
    passages: [{ text: '男主妻小聪俊，早娶', gender: '男' }, { text: '女主夫长，谐老', gender: '女' }],
  }],
  ['p012-015', {
    hash: '4b7f40929edf54fd4a6f4fe5fe1047ce37ad9cb012e21728e7bfa2032b5deffe', palace: '夫妻', star: '天府',
    passages: [{ text: '男主妻小聪明', gender: '男' }, { text: '女主夫长', gender: '女' }],
  }],
  ['p012-016', {
    hash: '63bca21c7290b2fdc1793f39ae3d1be2eb8ebef607d977d375c0ee0abb27050c', palace: '夫妻', star: '贪狼',
    passages: [{ text: '男主妻迟', gender: '男' }, { text: '女主夫长，迟', gender: '女' }],
  }],
  ['p012-019', {
    hash: 'c287ac7b84b2fade4e867a0a77199430489755b1c7dfce7a5c8dadb6cf8c58a8', palace: '夫妻', star: '文昌',
    passages: [{ text: '男主妻小聪俊', gender: '男' }, { text: '女主夫贵', gender: '女' }],
  }],
  ['p012-026', {
    hash: '4f420142bfe155642c1f11baae164e8b6dba53ea16085b52531d3dc201b5e55e', palace: '夫妻', star: '紫微',
    passages: [{ companion: '擎羊', gender: '女' }],
  }],
  ['p012-027', {
    hash: '952d6abaedc3afa2ad579b7ec018aa306e357cb8a0ff3e348e38447f68bedb08', palace: '夫妻', star: '紫微',
    passages: [{ noSectorMalefics: true }],
  }],
  ['p013-001', {
    hash: 'd58526f6b261a17d9cf88709717b96c5448ef0300f65a06b021921dc3bc49fa6', palace: '子女', star: '天机',
    passages: [{ text: '加吉，一人分', beneficScope: 'same' }],
  }],
  ['p013-002', {
    hash: '4b7c145efb429426f089b79e5c24dd87d36a8ec78097a534c605f31794bee749', palace: '子女', star: '天同',
    passages: [{ text: '加吉，贵', beneficScope: 'same' }],
  }],
  ['p013-007', {
    hash: '88c5eb0efbca64c8c92b01f45d6902718e6cd3e93978806748858ed4e64dd2fb', palace: '子女', star: '武曲',
    passages: [{ text: '加吉，一子分', beneficScope: 'same' }],
  }],
  ['p013-019', {
    hash: 'ff3f026d2573b2997ad116406152d7b8393f5854b8ea6d759bc3e5dc0d01d59f', palace: '子女', star: '文曲',
    passages: [{ text: '加吉得力', beneficScope: 'same' }],
  }],
  ['p013-020', {
    hash: '68a7c7048373d4477b7517fbc82940b636d6e37ae73f4e6625cd18300c27689a', palace: '子女', star: '禄存',
    passages: [{ text: '逢吉，一人分', beneficScope: 'sector' }],
  }],
  ['p013-025', {
    hash: 'f75ce24773550f0c96d09add245f308065d2011ca692b9946e3bba325d0974be', palace: '子女', star: '紫微',
    passages: [{ text: '加七杀，二人', companion: '七杀' }],
  }],
  ['p013-031', {
    hash: '59ce7891c02fe790771f996800dc37f180379b77637b97d86280f16ccc00eb74', palace: '子女', star: '破军',
    passages: [{ beneficScope: 'sector' }],
  }],
  ['p014-010', {
    hash: 'ac3429538f5006b5b137640215731290725166f3a1e9e69510e4738f6b272413', palace: '财帛', star: '天府',
    passages: [{ text: '遇吉星，财多', beneficScope: 'sector' }],
  }],
  ['p014-021', {
    hash: 'e36dc5d3ad07504b1cb991dd17c5aa6fff62a22ccbede058a567265d9324a9b5', palace: '财帛', star: '贪狼',
    passages: [{ sectorCompanions: ['火星', '铃星'] }],
  }],
  ['p014-023', {
    hash: '20b605a376186684683619ec8332d9bf9496f30df7f2078b923b42fa9e3948f6', palace: '财帛', star: '破军',
    passages: [{ beneficScope: 'sector' }],
  }],
  ['p016-006', {
    hash: '1fa302486344caa72a0f4673cde396eedbd95c64516b6e9685f34d590aa5bdb9', palace: '迁移', star: '天机',
    passages: [{ text: '遇吉星，发达', beneficScope: 'sector' }],
  }],
  ['p016-008', {
    hash: '2bbc4c5752b0ba80782cc3669e756013d5a3ce3f911eeb09bcad282592f5843c', palace: '迁移', star: '武曲',
    passages: [{ text: '见吉星，发财', beneficScope: 'sector' }],
  }],
  ['p017-010', {
    hash: '7cac993ab089f437e345a6fb4c595b4d069fd046c0f444b1a3dabf4a9f1d78e3', palace: '仆役', star: '太阴',
    passages: [{ levels: '旺' }],
  }],
  ['p019-003', {
    hash: '5f1608edab83e31cd44d48a545eec7bea23022de3fdaaab22fd31cb175945489', palace: '田宅', star: '贪狼',
    passages: [{ text: '逢吉，亦自置', beneficScope: 'sector' }],
  }],
  ['p019-019', {
    hash: 'a0a089640972ab117123485650a4aefffce89198394f9fdab9990c72592d60c9', palace: '田宅', star: '禄存',
    passages: [{}],
  }],
  ['p019-023', {
    hash: '0be5570174965cabfbb5eded7791a0a36af0d4f01030533dbb314e29224625a0', palace: '田宅', star: '七杀',
    passages: [{ text: '逢吉，大发', beneficScope: 'sector' }],
  }],
  // Chapter 101, separately reviewed palace, brightness and companion clauses.
  ['p010-003', {
    hash: '05a04384061985768f6f5e40519ca5aa020a645cfcdd1ae04676590581d0f1a5', palace: '命宫', star: '巨门',
    passages: [
      { text: '庙旺，富贵', levels: '庙旺' },
      { text: '陷地加杀，做事颠置，大事小成', levels: '陷', anyCompanions: fourMalefics },
    ],
  }],
  ['p010-024', {
    hash: '6052a18fddd02a3bd931e798b5d047957bae8529b6409dab719bfd28fa7d1e77', palace: '命宫', star: '右弼',
    passages: [
      { text: '庙，发达进财', levels: '庙' },
      { text: '陷，平常', levels: '陷' },
    ],
  }],
  ['p011-004', {
    hash: '09b8cec99b146736e0cd3e2bdcaf8357457f09a0ea2f94006344e37718be8f98', palace: '兄弟', star: '天相',
    passages: [
      { text: '值魁钺，主有贵兄弟', sectorCompanions: ['天魁', '天钺'] },
    ],
  }],
  ['p011-005', {
    hash: 'ce902ccfc2c7b6da7fd78c914e82a288216547c562ad152ad486df819f393947', palace: '兄弟', star: '陀罗',
    passages: [
      { text: '主寡合' },
    ],
  }],
  ['p011-010', {
    hash: '380880627c15d8c3820cb739571e59e4076787fe66cd3eb3bc0b4c32d04c73ff', palace: '兄弟', star: '太阴',
    passages: [
      { text: '陷地加杀，不得力', levels: '陷', anyCompanions: fourMalefics },
    ],
  }],
  ['p012-008', {
    hash: '4f704314e1611921d7ebbedf460313fa2cb7043888db4da2e5f8fc2fa687b33c', palace: '夫妻', star: '文曲',
    passages: [
      { text: '男主妻聪俊，早婚', gender: '男' },
      { text: '女主夫长', gender: '女' },
    ],
  }],
  ['p012-020', {
    hash: '7dbc43b6e6c1299ac6c39dd3e09e9a3917080237f989e5d776e0c4422258fa04', palace: '夫妻', star: '禄存',
    passages: [
      { text: '男女皆主婚迟' },
      { text: '加杀，偏房', anyCompanions: ['火星', '铃星'] },
    ],
  }],
  ['p012-021', {
    hash: 'ad22d4133fa8c01dc8ff7ee0fa18efab08d1d14b8d36e825e8db9c8f977465d2', palace: '夫妻', star: ['火星', '铃星'],
    passages: [
      { text: '迟婚吉' },
    ],
  }],
  ['p013-004', {
    hash: '34f81cd8cccf8d1d68c888d2af25910ef426b3af2d15698d3c8d10aad55ed458', palace: '子女', star: ['火星', '铃星'],
    passages: [
      { text: '加吉，一子分', beneficScope: 'same', beneficOptions: huoLingSamePalaceBenefics },
    ],
  }],
  ['p013-005', {
    hash: 'c9b6d7d07ceb417021453caa48b4a0d27a87d77affe5486d6e3e1f2bb20830a2', palace: '子女', star: '紫微',
    passages: [
      { text: '见左右昌曲，主贵', sectorCompanions: ['左辅', '右弼', '文昌', '文曲'] },
    ],
  }],
  ['p014-001', {
    hash: '15c23306afc1d49221cd4eb6927b148a452ed9269392736a9a6d494ad888a342', palace: '财帛', star: '紫微',
    passages: [
      { text: '逢杀，先难后易', sectorMaleficCounts: [1, 2, 3] },
      { text: '加四杀，先易后难', sectorMaleficCounts: [4] },
    ],
  }],
  ['p014-013', {
    hash: 'b1470939c89c146718986ac97ffdc777f88d31710a675f7024193fbfb38d2e22', palace: '财帛', star: '天相',
    passages: [
      { text: '加四杀，成败不一', sectorMaleficCounts: [4] },
    ],
  }],
  ['p014-017', {
    hash: '4a5fc461b693e555d4b3cb1ba51489f176ad0de4e70125654ab95ae4b841c80c', palace: '财帛', star: '禄存',
    passages: [
      { text: '加杀先难后易', anyCompanions: ['火星', '铃星'] },
    ],
  }],
  ['p017-009', {
    hash: '8c7c166497cf9f25ab86666f13010fef92f0bc59317caead1b3bd330a4f4ab26', palace: '仆役', star: '天府',
    passages: [
      { beneficScope: 'sector' },
    ],
  }],
  ['p019-020', {
    hash: 'b516687400ae5435a04cbcbaeb5ea079042f6665519722d3b920d6f393d815d4', palace: '田宅', star: ['擎羊', '陀罗'],
    passages: [
      { text: '遇吉，一发', beneficScope: 'sector' },
    ],
  }],
  ['p021-003', {
    hash: 'c08b9bc45a99c0e8cd2d23eae27023e2d36918a5c5d090be834810d932f3d684', palace: '父母', star: '文曲',
    passages: [
      { text: '加破军，有灾，亦不妨寿', companion: '破军' },
    ],
  }],
  ['p021-004', {
    hash: '86e8a178b594b9bf46f72cbc172fce83dba66577639df284d72a1ad44a02d532', palace: '父母', star: '禄存',
    passages: [
      { text: '加吉，父母有贵，无克', beneficScope: 'same', beneficOptions: ['左辅', '右弼', '文昌', '文曲'] },
    ],
  }],
  ['p021-005', {
    hash: 'f41363deb0ddd917dc2fd884e78344010a4dfabe7105220461d447d30721974a', palace: '父母', star: '紫微',
    passages: [
      { text: '加羊陀，先克父', anyCompanions: ['擎羊', '陀罗'] },
    ],
  }],
  ['p021-007', {
    hash: 'fdb813b4b3b9db8ebda687182e5b1478e95fe240902ba52b6b771672374e7f29', palace: '父母', star: '武曲',
    passages: [
      wuquParentsWithYangTuo,
      { text: '加杀，先母后父', anyCompanions: ['火星', '铃星'] },
    ],
  }],
  ['p021-008', {
    hash: '238fe891757f064bac6ca2c27179169ddac61a2cfb5ff31d22c074b2844efebe', palace: '父母', star: '天同',
    passages: [
      { text: '加凶，早克', anyCompanions: sixMalefics },
    ],
  }],
  ['p021-009', {
    hash: '0a9ec09619ac2526549c6a00e9d0593f5049c177a66a11de29e0cac697d380c4', palace: '父母', star: '廉贞',
    passages: [
      { text: '加羊陀，刑克太甚', anyCompanions: ['擎羊', '陀罗'] },
      { text: '如化忌，主克', changes: '忌' },
    ],
  }],
  ['p021-010', {
    hash: '9cf1c6b2f3b8d2adeb8ab4049ff936e7b19f1710513da9ed0e0b1c65f8cbafb9', palace: '父母', star: '天府',
    passages: [
      { text: '庙，主父母得祖力', levels: '庙' },
    ],
  }],
  ['p021-013', {
    hash: '6093be0d8d4b34eb548bb710226fc8ce61aa433542636a3aee70386af1d6b6b6', palace: '父母', star: '天相',
    passages: [
      { text: '加杀，不为害，有寿', anyCompanions: fourMalefics },
    ],
  }],
  ['p021-014', {
    hash: '899c8e7e2db6681a54e4582388a9b6061c04a3e5199a3bd313359717ce3e4f1e', palace: '父母', star: '天梁',
    passages: [
      { text: '加杀灾克', anyCompanions: fourMalefics },
    ],
  }],
  ['p021-015', {
    hash: 'bb0469b8ac8c8c1687d047a064e7019835b351ca356951e7c5afba3d0ab162dd', palace: '父母', star: '七杀',
    passages: [
      { text: '有吉方好', beneficScope: 'sector' },
    ],
  }],
  ['p021-018', {
    hash: '2b235a2ba65232dd15037e2f6597aeb91b6c81a9f4ad9c12bc804536d3745d4e', palace: '父母', star: '左辅',
    passages: [
      { text: '无杀无克', noSectorMalefics: true, noSectorCompanions: ['地空', '地劫'] },
      { text: '加凶有刑', anyCompanions: sixMalefics },
    ],
  }],
  ['p021-019', {
    hash: '0917ccb17c57161f51d79b0634f947e2e56619f64d228b126a4706f2cef7f1a8', palace: '父母', star: '右弼',
    passages: [
      { text: '无凶杀，吉', noSectorMalefics: true, noSectorCompanions: ['地空', '地劫'] },
    ],
  }],
  // Reviewed independent palace clauses, including quantified sector witnesses.
  ['p010-027', {
    hash: '4ddf7530a15ab1bfd7895d704fa4bcca301b1afc9c5282599692b91b81d4e550', palace: '命宫', star: ['天魁', '天钺'],
    passages: [{  }],
  }],
  ['p010-028', {
    hash: '0a0db3cc7ffa66dab42eed1c042f3ea5744c99a04c89d1f51d98c220fabe6f1f', palace: '命宫', star: '禄存',
    passages: [{ text: '主为人重厚' }],
  }],
  ['p010-038', {
    hash: '2d9d53822d0e7c2aab7706e2a66861f607e990875ad629b69efeea0cddcbdcf7', palace: '命宫', star: '武曲',
    passages: [{ text: '加杀，僧道风流', anyCompanions: fourMalefics }],
  }],
  ['p010-042', {
    hash: 'fb720c1c2b9b0072f1df232e33056a054047252b9cdd9540ba85a287feb6f86f', palace: '命宫', star: ['火星', '铃星'],
    passages: [{ text: '陷地，贫贱', levels: '陷' }],
  }],
  ['p011-001', {
    hash: 'c6634e49fd6f22d83c74c78a2614dcc768fe87d0e0464f938072a733e3bc4d4f', palace: '兄弟', star: '武曲',
    passages: [{ text: '加四杀，克', sectorMaleficCounts: [4] }],
  }],
  ['p011-006', {
    hash: 'fcb6de2ff1af8b2a180a93cbcdd54b35b55119397cc5dbbd9cacadfd2d903145', palace: '兄弟', star: '紫微',
    passages: [{ text: '会昌曲，五七人', sectorCompanions: ['文昌', '文曲'] }],
  }],
  ['p011-013', {
    hash: '63dac3a1c1648efa91aa314388a7b984f72aff4f3c45114296e1ff5a63f5110b', palace: '兄弟', star: '天梁',
    passages: [{ text: '加羊陀火铃，主克', sectorMaleficCounts: [4] }],
  }],
  ['p011-016', {
    hash: '6f40e6c969dd4475e705fd379a29858d7141963d4158c40790c20c9376b0ac36', palace: '兄弟', star: '左辅',
    passages: [{ text: '加四杀，二人', sectorMaleficCounts: [4] }],
  }],
  ['p011-032', {
    hash: '357d05e32b7274a81c65ca10cbd0378a35929d22800e70a5438f63bacaf3cf3d', palace: '兄弟', star: '天府',
    passages: [{ text: '旺加杀，亦克', levels: '旺', anyCompanions: fourMalefics }],
  }],
  ['p012-012', {
    hash: 'b49b3982e33c2c7414a3a9a29312846fafadb73a2a9d08035419650e5f7ff8b5', palace: '夫妻', star: '太阳',
    passages: [{ text: '加四杀，男女皆克', sectorMaleficCounts: [4] }],
  }],
  ['p012-014', {
    hash: '10c67319f08bc6fc76f6b2181d28d6038486580d24f175fb92ad6ead3c11a1ef', palace: '夫妻', star: '廉贞',
    passages: [{ text: '加四杀不一，生离', sectorMaleficCounts: [4] }],
  }],
  ['p012-018', {
    hash: 'adc38addd92cb60b1c68ae22525636be6f9039d8b6fcc533e90c190cf0cd2007', palace: '夫妻', star: '七杀',
    passages: [{ text: '欠和', sectorMaleficCounts: [4] }],
  }],
  ['p012-030', {
    hash: '783488e1db55c6b5959bf7b9449a72e64304be837a8729988917eeb8d77eb92b', palace: '夫妻', star: '巨门',
    passages: [{ text: '加四杀遇昌，主离', sectorMaleficCounts: [4], companion: '文昌' }],
  }],
  ['p012-031', {
    hash: 'c57246531b966a60f48294b1f73af006aa3d9c581cb1235235633605eec4c515', palace: '夫妻', star: '天相',
    passages: [{ text: '加羊陀，克', anyCompanions: ['擎羊', '陀罗'] }],
  }],
  ['p012-033', {
    hash: '7ded262bde983f38abd279ccd14b6a5404d192542d6ae5ffc3f543fcdfad8076', palace: '夫妻', star: '右弼',
    passages: [{ text: '见昌曲，美貌', sectorCompanions: ['文昌', '文曲'] }],
  }],
  ['p013-006', {
    hash: 'e7ac61b0d344b42dc284e18cebadae276fb89320a58e9af4577abe3e4e3a01da', palace: '子女', star: '太阳',
    passages: [{ text: '陷地加四杀，克', levels: '陷', sectorMaleficCounts: [4] }],
  }],
  ['p013-014', {
    hash: '0d2db9b7808fd10f192723702cd18266fce4321918ef814a46bef4d8564a90a4', palace: '子女', star: '天梁',
    passages: [{ text: '加四杀，有亦不得力', sectorMaleficCounts: [4] }],
  }],
  ['p013-015', {
    hash: 'a444d816b3351640b11760f1b85ac9906cf529e1f20156df572f171b6d606037', palace: '子女', star: '破军',
    passages: [{ text: '加四杀孤，有亦不得力', sectorMaleficCounts: [4] }],
  }],
  ['p014-007', {
    hash: '313372e572d6f17292469e34ec800313166146d445385ee9c25b11b7f79f0442', palace: '财帛', star: '破军',
    passages: [{ text: '如加吉，一发如雷', beneficScope: 'same' }],
  }],
  ['p014-020', {
    hash: 'ff8781ccddb3a3f04a6b7b245f25b06879c288aac1b6a1c3d4012868bdcdcd45', palace: '财帛', star: '巨门',
    passages: [{ text: '先难后易，加羊陀，亦然', anyCompanions: ['擎羊', '陀罗'] }],
  }],
  ['p014-022', {
    hash: '77edf16fcab5a804f037cb8d78a8e6a55805ea2c012210b4b47e8d456acefe99', palace: '财帛', star: '破军',
    passages: [{ text: '加四杀，辛苦得财，横成横破', sectorMaleficCounts: [4] }],
  }],
  ['p019-005', {
    hash: '903d824b27393db6b8e8ff63ee24d8cd355c8df2bad8c19ea183ae9f06d15c38', palace: '田宅', star: '七杀',
    passages: [{ text: '逢吉，大发', beneficScope: 'sector' }],
  }],
  ['p019-024', {
    hash: '0a5c1c745253bd79cc0c850e2001e4a0900c8f7dbd77f7a052b6950b2b6cc259', palace: '田宅', star: '七杀',
    passages: [{ text: '逢凶，破耗', anySectorCompanions: sixMalefics }],
  }],
  ['p021-027', {
    hash: 'a97020697438dbaf588605af8c5a63ff25f26f212816b5ee6343363a740596d1', palace: '父母', star: '天机',
    passages: [{ text: '加凶，生离克害', anyCompanions: sixMalefics }],
  }],
  // Each excerpt retains the prerequisites of its own clause.
  ['p012-017', {
    hash: '1cc384d574d34fc9a4eeaa645d424e52465b357e89e77f430941a4a32c9db3df', palace: '夫妻', star: '巨门',
    passages: [
      { text: '男主刑妻，刚者可对', gender: '男' },
      { text: '女宜夫长可对', gender: '女' },
      { text: '加四杀遇昌，主离', sectorMaleficCounts: [4], companion: '文昌' },
    ],
  }],
  ['p015-001', {
    hash: '448df44169a898cf53191982f14b9a5f78f067c6fbe71ff663b4764d56dc59e3', palace: '疾厄', star: '武曲',
    passages: [
      { text: '庙，灾小', levels: '庙' },
      { text: '加七杀四杀，痔疾风疮', companion: '七杀', sectorMaleficCounts: [4] },
    ],
  }],
  ['p015-002', {
    hash: '3f28a8fd2eb210ce3b660d328faa19a0a7f11f133f05cc020c40eaa06f5dee02', palace: '疾厄', star: '太阴',
    passages: [
      { text: '血气之灾' },
      { text: '加四杀，寒热气疾', sectorMaleficCounts: [4] },
      { text: '陷，主痰火', levels: '陷' },
    ],
  }],
  ['p015-003', {
    hash: '6f35dd4fa3e8ff2ecd71d1389887575f5baf89b4dbb3331d03c4aedd62ac2fc2', palace: '疾厄', star: '破军',
    passages: [
      { text: '目昏气疾' },
      { text: '会贪贞，腰足疾', sectorCompanions: ['贪狼', '廉贞'] },
      { text: '居戌，主风邪', branches: '戌' },
      { text: '女人会武曲巳宫，气蛊疾', branches: '巳', companion: '武曲', gender: '女' },
    ],
  }],
  ['p015-004', {
    hash: '6f447514cfdb6833ae3cc55f439c96541c3b6d88f6bfa257be5d3f710b08e820', palace: '疾厄', star: '紫微',
    passages: [{ text: '遇吉可医', beneficScope: 'sector' }],
  }],
  ['p015-005', {
    hash: '11039be42bab1e3f135ff5a98ee2a71f5655fd3a2347d0a690c01bb9805efab6', palace: '疾厄', star: '天机',
    passages: [
      { text: '主热毒湿气' },
      { text: '加火陀，四肢目疾', companions: ['火星', '陀罗'] },
    ],
  }],
  ['p015-006', {
    hash: '1e52573e4b0590d107fee2d1f6a885a893727925495f9e420c43cb2e781f5ca4', palace: '疾厄', star: '太阳',
    passages: [{ text: '头风寒湿之灾' }],
  }],
  ['p015-007', {
    hash: '40ae075c9c76e797e50a01cdff0c435008309e440f2661502b18124fbccb5d5a', palace: '疾厄', star: '天同',
    passages: [{ text: '加吉，平和', beneficScope: 'same' }],
  }],
  ['p015-009', {
    hash: 'c77ca2c24c3afd3586055dbf3ef9f23d935c2376d01be001eef476ad5c0f0b84', palace: '疾厄', star: '廉贞',
    passages: [{
      text: '入庙加吉，平和', levels: '庙', beneficScope: 'same', beneficOptions: [...assistantAndLiteraryStars, '天钺'],
    }],
  }],
  ['p015-010', {
    hash: '375b08e04c7d42872771a9f702830f4ffc93e6868590baf01d6d53a8add6035c', palace: '疾厄', star: '贪狼',
    passages: [
      { text: '入庙，灾少', levels: '庙' },
      { text: '陷，腰足带疾，痔疾', levels: '陷' },
      { text: '加火铃，眼昏', sectorCompanions: ['火星', '铃星'], anyCompanions: ['火星', '铃星'] },
    ],
  }],
  ['p015-011', {
    hash: '8494316842df87e38a20106a0950cfc0250821e4e7acb1c167b74b28e90216ae', palace: '疾厄', star: '天相',
    passages: [{ text: '陷，主残疾', levels: '陷' }],
  }],
  ['p015-012', {
    hash: 'b1f527e74107de6a08410e33b0e5e25b8fff4d37c011754f021b8dac4373655e', palace: '疾厄', star: '巨门',
    passages: [{ text: '加四杀，四肢寒疾，唇舌有破', sectorMaleficCounts: [4] }],
  }],
  ['p015-013', {
    hash: 'bab3f7fcf96c8df56ae36472124bf4c4a940cc4b17401fd3a73add7676813655', palace: '疾厄', star: '七杀',
    passages: [{ text: '加羊陀四肢疾', sectorCompanions: ['擎羊', '陀罗'] }],
  }],
  ['p015-014', {
    hash: '63405cae51e331855896ed0d2ed65783a5d9afe97bacc28a13e7bec50e2a782e', palace: '疾厄', star: '天梁',
    passages: [
      { text: '吉', noSectorCompanions: ['火星', '铃星'] },
      { text: '加火铃，残疾', sectorCompanions: ['火星', '铃星'], anyCompanions: ['火星', '铃星'] },
    ],
  }],
  ['p015-020', {
    hash: '3398e7aa1922a3903d9f4d4c88fa2ec515fc93d03cb0ffdcd3b06292211a3c12', palace: '疾厄', star: '武曲',
    passages: [{ text: '加七杀四杀，痔疾风疮', companion: '七杀', sectorMaleficCounts: [4] }],
  }],
  ['p015-021', {
    hash: '2efebdbb6ef0e0ed2d0bca587979e5ca20d893adc35d7fca24d3785d84f441e4', palace: '疾厄', star: '太阴',
    passages: [{ text: '加四杀，寒热气疾', sectorMaleficCounts: [4] }],
  }],
  ['p015-023', {
    hash: '107ccd7556430798729733cacff1ca0597b818ffefac618f26534004b7cf8552', palace: '疾厄', star: '破军',
    passages: [{ text: '会贪贞，腰足疾', sectorCompanions: ['贪狼', '廉贞'] }],
  }],
  ['p015-025', {
    hash: '3ef30dab192de5e068108facafea44ddb5be3b882b2c59e76eff8713e5e5cbec', palace: '疾厄', star: '破军',
    passages: [{ text: '女人会武曲巳宫，气蛊疾', branches: '巳', companion: '武曲', gender: '女' }],
  }],
  ['p015-026', {
    hash: '2036b10471982d93de0a7f05132ab52ed7de38f395c8209cea1b11ab923ae0c6', palace: '疾厄', star: '太阳',
    passages: [{ text: '男女四杀休逢日，襁褓年来疾厄痛', sectorMaleficCounts: [4] }],
  }],
  ['p016-016', {
    hash: '0f4caa91ed2fefe9450394302160e2d62fb1918b1571000a90c013ba590b71fb', palace: '迁移', star: '七杀',
    passages: [{ text: '出外多忙，闹中安身' }],
  }],
  ['p020-004', {
    hash: '1f30743c2d3f254bd3dc06a112775f961aebd9147f8b36bde4e1aff4f801011a', palace: '福德', star: '紫微',
    passages: [{ text: '庙旺，八十四岁', levels: '庙旺' }],
  }],
  ['p020-014', {
    hash: 'c725cc50cabb48e6d6522a6a894d9c4a81bdfd359b29f4e71ec34cfc4c5619a3', palace: '福德', star: '七杀',
    passages: [{ text: '庙，福寿', levels: '庙' }],
  }],
  ['p020-015', {
    hash: '1594954e2696d90731c0210890d53743242de1b4d2b435d67ab3ec00ec612dca', palace: '福德', star: '破军',
    passages: [
      { text: '庙，有寿', levels: '庙' },
      { text: '陷，无', levels: '陷' },
    ],
  }],
  ['p020-022', {
    hash: '8e2c7ae59160169ae3434d243b10b6cfa5134c68a336fb8e19e1f12efaf42f4f', palace: '福德', star: '地空',
    passages: [{ text: '空劫：贫夭。', companion: '地劫' }],
  }],
]);

export function compileJielanPalacePassages(claim) {
  if (!claim.id.startsWith(jielanPrefix)) return undefined;
  const spec = jielanPalaceText.get(claim.id.slice(jielanPrefix.length));
  if (!spec) return undefined;
  if (digest(claim) !== spec.hash) return { reason: 'source_review_required', reviewNote: '《捷览》原文、出处或条件发生变化，须重新核对分句。' };
  const { palace, star, passages } = spec;
  const scope = 'origin';
  const starFact = body => ({ kind: 'palace_star', palace, star: body, scope });
  const sectorFact = body => ({ kind: 'palace_sector_star', palace, star: body });
  const beneficFact = {
    same: starFact,
    sector: sectorFact,
    trine: body => ({ kind: 'palace_trine_star', palace, star: body }),
  };
  const branches = passages.map(({ text, levels, branches: places, changes, companion, companions = [],
    sectorCompanions = [], gender, beneficScope, beneficOptions = benefics, anyCompanions = [], anySectorCompanions = [],
    noSectorMalefics = false, noSectorCompanions = [], sectorMaleficCounts, sectorChanges = [], sameChanges = [],
    beneficMajority }) => {
    const majority = { kind: 'palace_sector_benefic_majority', palace };
    const supporting = [
      ...[...(companion ? [companion] : []), ...companions].map(starFact),
      ...sectorCompanions.map(sectorFact),
      ...[...new Set([...sectorChanges, ...sameChanges])].map(change => ({ kind: 'palace_sector_mutagen', palace, change })),
      ...sameChanges.map(change => ({ kind: 'palace_mutagen', palace, change, scope })),
      ...(beneficMajority === true ? [majority] : []),
      ...(gender ? [{ kind: 'natal_gender', gender }] : []),
    ];
    const counts = sectorMaleficCounts ?? (noSectorMalefics ? [0] : []);
    const countFacts = counts.length ? counts.map(count => ({ kind: 'palace_sector_malefic_count', palace, count })) : [null];
    const mustBeAbsent = [...noSectorCompanions.map(sectorFact), ...(beneficMajority === false ? [majority] : [])];
    const branchFacts = places ? [...places].map(branch => ({ kind: 'palace_branch', palace, branch })) : [null];
    const inputs = (changes ? [...changes] : [null]).flatMap(change => {
      // A transformation named without its host can belong to any eligible
      // star. Each alternative still binds the same host and palace.
      const actors = star ? [star].flat() : [...new Set(defaultZiweiMutagens.map(row => row['禄权科忌'.indexOf(change)]))];
      return actors.flatMap(body => {
        const required = [starFact(body), ...supporting];
        const eligibleBenefics = Array.isArray(beneficOptions) ? beneficOptions : beneficOptions[body] ?? benefics;
        const anyOf = beneficScope
          ? eligibleBenefics.filter(benefic => benefic !== body).map(benefic => [beneficFact[beneficScope](benefic)])
          : [...anyCompanions.map(associate => [starFact(associate)]),
            ...anySectorCompanions.map(associate => [sectorFact(associate)])];
        if (change) required.push({ kind: 'star_mutagen', palace, star: body, change, scope });
        const brightnessFacts = levels ? [...levels].map(brightness => ({
          kind: 'palace_brightness', palace, star: body, scope, brightness,
        })) : [null];
        return brightnessFacts.flatMap(level => branchFacts.flatMap(position => countFacts.map(count =>
          normalizeRuleInput('ziwei', { required: [...required, ...[level, position, count].filter(Boolean)], anyOf, mustBeAbsent }))));
      });
    });
    return { text, conditionCompiler: jielanPalacePassageProfile, inputs };
  });
  if (!branches[0].text) return { compiler: jielanPalacePassageProfile, inputs: branches[0].inputs };
  return { reason: 'unmapped_condition', condition: '《捷览》本段仅按已核原文分句提供证据', branches };
}

export function ziweiSourcePassageDisposition(claim) {
  return claim.id === sourceId ? digest(claim) === sourceHash : claim.id === lightId ? digest(claim) === lightHash : undefined;
}

// The supplied record contains two different grades at 申, plus the earlier
// 寅 sentence. Preserve the complete source but quote only the matched grade.
// In particular, 丙 must never receive the 甲庚戊 “贵格” quotation.
export function ziweiSourcePassages(claim, compileCondition) {
  if (ziweiSourcePassageDisposition(claim) !== true) return [];
  if (claim.id === lightId) {
    // The source chapter is explicitly 命宫. Quote only the positive sentence,
    // whose Sun list INCLUDES 午; the separate 捷览 sentence excludes 午.
    // The subsequent fallen-light sentence is not proved by this branch.
    const inputs = ['太阳化忌居寅卯辰巳午', '太阴化忌居酉戌亥子'].flatMap(condition =>
      (compileCondition(condition) ?? []).filter(facts => facts.every(fact => !fact.palace || fact.palace === '命宫'))
        .map(required => normalizeRuleInput('ziwei', { required })));
    return [{ text: '若太阳在寅卯辰巳午化忌，太阴在酉戌亥子化忌为福论。', conditionCompiler: ziweiMutagenPlacementProfile, inputs }];
  }
  const placements = compileCondition('廉贞入庙守申位命宫');
  if (!placements?.length) return [];
  return [
    ['申宫入庙甲庚戊生人贵格', ['甲', '庚', '戊']],
    ['丙生人次之', ['丙']],
  ].map(([text, stems]) => ({
    text, conditionCompiler: ziweiBirthGradeProfile,
    inputs: placements.flatMap(required => stems.map(stem => normalizeRuleInput('ziwei', {
      required: [...required, { kind: 'natal_year_stem', stem }],
    }))),
  }));
}
