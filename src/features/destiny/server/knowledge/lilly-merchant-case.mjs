import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
import { lillyCusps, lillyDomicileRuler, lillyHouse, lillyInterceptedSigns } from '../../control/lilly-houses.mjs';
import { lillyAspect } from './lilly-aspects.mjs';
import { lillyPlanetPosition } from './lilly-sign-classes.mjs';
import { chartContext, normalizeRuleInput } from './matching.mjs';

export const lillyMerchantCaseProfile = 'lilly-1647-english-merchant-case-v1';
export const lillyMerchantCaseId = 'lilly_english_merchant';
export const lillyMerchantCaseNote = '按莉莉卷三第 742 页印盘的七颗古典星体和十二宫头逐项核对到角分。此处引用该历史命例及原书的表格、措辞或取证。';
const prefix = 'astro-lilly-v3-merchant-p';
const sourceNumber = id => id?.startsWith(prefix) && id.endsWith('-001') ? id.slice(prefix.length, -4) : null;
const reviewed = new Map([
  ['001', '4ac200d593a07cdd070087d72e741b7563fb63cb4fe6202eea4f5463e260b65e'],
  ['002', '8ace431fb510e11f785c549d6d63238d97287b203198c3d58c1b0efab4d27451'],
  ['003', '71d99f744c64a4e7d2c64ab810ef5e879fd6b006523cead8e2cf7e9dd682fdfe'],
  ['004', 'f075692fa6f5442e7321eef1ff48e8d24e7e79e2f73d41ee03f20f5748e80ff9'],
  ['005', '578e5388a3a21e7a4e6644396f2f814d7936d8b95ccd1b1ace4c01a2aa9fdbc3'],
  ['006', 'c4fe31dd08f4ab2ab7caf7929c0ffc8c20ac36ed826be2778936bef9f4ad375e'],
  ['007', 'b162667f0107bb9591e75ab959eb18c080cf1d7eaa70edd2605780c3344d5b1f'],
  ['008', '721bf0bb35a25733f034f8d1001d06e1ba0072504b3e4cb8463b72b4eeac97da'],
  ['009', 'f7c8abdc813f77c30b16aa8efbfa44ad269eabd45a072dd681aaf10d0f3e6b46'],
  ['010', '06455d943b7d25d9a56d47e143c3e0c92443033543f33b089c54334a0946bf06'],
  ['011', '779cecd600af2e4e513d06eaccdd0bfa9936f1c24b5342104dc26843d695250f'],
  ['012', 'baeb7743d301e70fc07d3d22400e495d6e12a266efe1cc03ca2f9420235daddb'],
  ['013', '6b184f5f8603ab54c5a1e060e50a332f3e53689d14f6f34942e63a5056e29e3e'],
  ['014', '98cca7798310acc93057ea71cf98f5c843c4975a2662ff31aaa9508c069d86e2'],
  ['015', 'c96e2c43659ff6bb443f28dc562bb88e9582b7a9a8c57e727213cc27e0356498'],
  ['016', '6ddc78228f637c69290b2708f2069bdd2f3a45aefa48e8257449a59ae005c16c'],
  ['017', '772ae4a2d4ea34f8d8a5d9b630670bfb89860d2dbd84e2b60c8b2a9fb79f118a'],
  ['018', '9c4ced8986b7de753a73085ca9a46e40e663b67f6d5ec213b02e81d6eb84bee1'],
  ['019', 'fd4c349d69ad4cf9c51d397fe1099a68db5ea19d96463c3ac8d375ebbd084501'],
  ['020', '4bfdbf80f28f84f8b2a60bc07517e59ae21497d121b75643c37bf357a7e2242c'],
  ['021', 'bdf3215ed0214c1bebf0bcdfdce33741082401b28632d98991523287eb5c27bf'],
  ['022', '2bac3fb9ee0f33563104e0e92568f8975c0ea2eff0341da43731b9d551a65685'],
  ['023', '1437d13f7ccef6c8c70843b28d58a814ede422dacae7235a14e8cd923dcb2b20'],
  ['024', 'efdfaeb912cc23754bed6f70ace2dfb1c94d9c539c810108a6cfd4010c5b7a2c'],
  ['025', '523ee9b339688c09e7a9e2d046b4016595096f18e54907b104338924d7bd14a5'],
  ['026', 'c4cb1b5cad39a8ccddba6c03c2b02935672fa1e47f9382d0cd94b95a3a633221'],
  ['027', '2b064bbbc67cac63acce7367407a522ea189729fdeb04d6cb04dab710813d83b'],
  ['028', '8b3accd4ca821286f7ea51345e542f5aa4882de038f658a523f7f415707bea96'],
  ['029', 'bc61eca5b470d44ef9961e0618f2bef15e3e6af451e3139de057dde24ed37240'],
  ['030', 'afe2e5edfc41a725de98c06d52c53c1c1f899172c39cce07a55854d03b7d7c8d'],
  ['031', 'af457d46ba8809530e9f31f98e39beb0b932d08e918141373ce1bc4447f418e9'],
  ['032', '15426151b1793838a531f6568d841bc1cc4d095589e7bc82218f6f9911e0157c'],
  ['033', 'ca467eff618fc4bdb6fcd193ac88f636089818bf1681ccd578387b0516d7aadd'],
  ['034', '6216148836fc831300d3f2bbe5a3aaff620efee838482639f52e3db37facafb4'],
  ['035', 'f960d4aa443f5f4edae6a4dacc53094b4ae759f9e9d11d0290ea959497158ebd'],
  ['036', '1808af523ba233dd50d33d8cb1140d86d02ba3c774912d4d3a3e422c02de9e22'],
  ['037', 'fc62f380deb62ad87199c63fa7ac964ef1b61b6f62654f1076af90864aba7cba'],
  ['038', 'cd49627bdb2167c35911d548b4e6c0741e26c58a64a0049f86260fc182f450fa'],
  ['039', 'bdead1514fd225a663d9266b0966e467bdbf9b7a9adaa245d6b077d811f50785'],
  ['040', 'd5c748e132999e2a77e9ea1ec197dc498474d00d3f2309718264c4808ed46139'],
  ['042', '65f94ca8a994a2fa01f407ac65411c2db6cde63628d80d0c10f506980a2ab820'],
  ['043', '94a56c6d19e29d152e248bc5e50ee777e8cbf291e82572fedd085664c0984212'],
  ['044', '233f1f58cc54e66b17d043b9aaa0c87d681c7cafbe591672e0f16060635841cd'],
  ['045', '70f520a286496b84445cfa987372a8ed2b6a8c17f82e7597474e5b7039697b18'],
  ['046', '750b347106bc55fee028234f78159d5d002397ab410854b335fd01f2e7608376'],
  ['047', '1223de7f82e3780b48c631bdf71db722392dc0d5f5407519460fd6a9d6295b44'],
  ['048', 'b11f41576ed15ca60a48baa0515cb4fee1ec10e9f75ddc0f0c8c24fad997f1eb'],
  ['049', '3dd1db7614c780e5d4fbdd315aed851c315a17120be78b10fd6df241c4c4f7cc'],
  ['050', '83dc432944354ea40bdf94c652c74f589dee844660b534941be0b955b91e0ad0'],
  ['051', '1324ac33cc9d17b87870ec398008581d975bf1f675d30b1fcedd08a41a2d00bd'],
  ['052', '567a325de06c6795dfeef7a0aaa64536577801a873d66b8c5995be361d378ec4'],
  ['053', '063eba6b031ab06782a0a155a34fad7e74799fc960a3ccfbc77c88b4aa4f0c19'],
  ['054', 'd9b231868224c2669a451bd731e4e7262a3751da15164961d8a61701ebd8b497'],
  ['056', 'fabe5f0e121ca07b142f07c36ba48934467cd715b0a31231e68867bbd5d471e6'],
  ['057', 'ec49aa04df41cdb1a1184591f7545a44f540082a7421ceb6b3587c14b0bb17f6'],
  ['058', 'a534116fb05419b000861f844fe0cbb32c09511a28ffc8d6554dea9931e5e15a'],
  ['059', 'ad9aee27498198b8c8ebebafab417f43f0e0b12783b4f677c6e4d46dbf968a45'],
  ['061', 'ac941f1993f745680d2f9c605730ff92968337571350015d4e1ccf655b5bce5d'],
  ['063', 'd655fe409fb825612907c7b26c385a1ca0cb0a4ef2af967813ea4de3f61a4676'],
  ['064', 'c0f69b8437e22a92c37645f3fc46baebd02a6fa07d49bb3b120b3b735f6ad37a'],
  ['065', '76f39d321f5a35384824e43ca60dcbef95106be561b1572db5ff4e01d32e86b3'],
  ['066', '27ba9ba918ab990e55cbde440002bcc9c1658b9eb34a441ae2b8aae637ac13a9'],
  ['067', '8ea26e3d90db2dc050257649c1ddb501b0f28065bb319eb1e5edc286b358287d'],
  ['068', 'd7ab85c2c8efe0d8c8b555fafadc5b7474332e5aa01ebc458770e625670cc306'],
  ['069', 'e59ea9f34275bc021d692a1442c3846cbb607336827df398a758149216bcea0b'],
  ['070', 'abcc6e9819e100c67a47216fd3176bcdc0b4c9f653882c099892764b0196081f'],
  ['071', 'd546d506f34506fddf7a3248602dd1c54bc89154b79e24959123f8b3667c2f1a'],
  ['072', '7604d9ef5d91d21133341f723713cfe95293949a3dfc8ea6c27d0059705cf1b1'],
  ['073', '5519615a579c533722cebf0e56bc18f75663660639f775c0358ef701ff5db589'],
  ['074', '2409c78f82a8deba5e24c1f001b5c55c0e891ee56cdae7173d4bcf8bcac2b418'],
  ['075', '7e73a4b1a554b9c3aa03f8aaad0a76bae6504866cb02b205c5f2821b83e89e28'],
  ['076', 'de7045e51734e739dc57736c9a3b7cbe90aa8007d6fe0d5e1fddf47f46c9a6d5'],
  ['077', '0856cc1db8b0b325ec7a9b8567c717957f514e59da960006ee6cb36519a3cc4f'],
  ['078', '16e2aad27d742136b2db169c35415e02f06c48ff039d81cf3797bab2c238c46d'],
  ['079', 'b265c29bcb8eb51473aa65cfd3c599274b709996312c057ff1ff60862a473949'],
  ['080', 'fd3896cc2497950dd26552f5e8f0019a29f74ee742c48c457c0497076b7ddc12'],
  ['081', '97cb76ac37064f2584208e8a6720927c0dfd14c4155bddf61655295899253002'],
  ['082', '85e3d1d89569ea3d646b76534bd557818d17e8c18c973c22d76c75c75da15f66'],
  ['083', '30e7a32503af9287aa6fcaae9c9b46f923b1520c4dd10452f3983e2b5dfe3b47'],
  ['084', '4d60b51be43cffe8ab18d936d615e9fd11bc2ab71ab7d85309b1422de03dc86e'],
  ['085', 'fb08a0fef61898cf16179770cc84259a2f1fb9a9c0a18eb88133396ccb73df7c'],
  ['086', '4c227d6ab6ef72bed1d1b8e201849affdaff65c0fc806276c19d0e3a9621ea2f'],
  ['087', 'd41442b12d723b67d35abc444efd1549d68afb9bd5bfd02fe89acc8279c9e375'],
  ['088', '7b1f666d7ced1cb84163c9785b0df966b3ea07e927c0e17790dfa29b70c026f8'],
  ['089', 'c15d84353f9b6a925fae5362e5a9a0a70f42ffdc3bee0b7c5a43d01f947ff31a'],
  ['090', 'b65b347235d4839080aa8c616e6bdcf9f9159abc53e2d62f831c55b2c7cacf38'],
  ['091', '88b4641cdb618ca220c062c2f084096a806b08a4133b7909ec06217c64bbfb5d'],
  ['092', 'c12369b722d9030f9ccdc05cb3ce03cb4f9de7ae096bffe9d8440e4f8b1f8d77'],
  ['093', '79c71592754e6bf25ad150127fae39e5c39e6c8ddd4fd29d956d33264e6c25a7'],
  ['094', 'ea767c1ff6614d2b3003d2b4a11aa1fca74b5e20c33f787c52f0c1a81cd44fd7'],
  ['095', '075d20fb9e998bc462ad9cd7eefa09ce6e737f303ed3092bcceca6dcc78abe5c'],
  ['096', 'fb06e0c4eb07a93516d60ac40dc26a9edb558112792608f94e2a380190ea6ebd'],
  ['097', 'e861e5f929ce90ea68501308da65627b7d7aac161ffe1d1646301f26820ec19e'],
  ['098', '1f1dfb7cbac40983dc666bc2335bc4b488f00690c4b1157ae716d45e5610ff68'],
  ['099', 'd408e318a5794eae12887e7ed57f3b7ddbedf7c49e41b91520e1ae50bb631c6d'],
  ['100', '939d2a0fa1d481b249a3018ea781367478e0565ad064159404453376209527f3'],
  ['101', '28340209953b9aaea83fdb67e0ba2b567add2abb4af42641c58b275bd4edf6dc'],
  ['102', '47a6c9209219fcf13861a7dd90754f492cda437f8babbd7ade8a5f01d5e8d665'],
  ['103', '762681703e9c476331c75298120daa8ab526e6a97dd9c61d75bf353cad1c3e62'],
  ['104', 'cfa898adf97c3db375a6e114b300c17260e5d74977a48145c45b622681cfc376'],
  ['105', '56cde14740a528658deb3d77f4b1f16eb7da5a782d98050ed8aa419d47811d4f'],
  ['106', '443c61a890f6b1aa242020c7a414eeb3abcf1fa8a422f1429364fd2c1162e624'],
  ['107', '17c9cee7c8fdd4f1577b27b5f7afbe1b7d5ca0e417819dba5d2f7fce5a0f9021'],
  ['108', 'b60defd0a33329608e90bb4da9910c00f3241f7d74fe0f7beb2516e28a878bab'],
  ['109', '419d813243f367a77a86de1f28b36867717e3662e503cf7ecb09d57e1c1b13dc'],
  ['114', '8e0921dfe2add4832215722b831b21bd793e5086e22c8be32a48dda45bbbaff8'],
  ['115', '4c3767e2b73c2b4fe4b7376efa960b1aa906e68d3f343a9d7377bd29f1706523'],
  ['116', '1c71bd151be8ed8e35756bf27da1a718e4ac0e67c1621ac8ff43276828e6b191'],
  ['117', '0c8bb04a9b032557eec21e19e4d27b05dfe3b587886ece15c61c70e1108adb32'],
  ['118', '230d30b60d1428653382ef8fe1b150a1abf5a84e1626fc3292880128ea1fb352'],
  ['119', 'abd44133995ff59b75ce4bf61c5ad0adb962e5ade842bd17eb5e29b72e5284e3'],
  ['120', 'b6f0bb4da513fc3822631c12c9811b4195f95b8016024d6c56f41ece80cb6ce7'],
  ['121', '47add512053009e414dd254b10f762feaf8acdb200a887608635430b6d441503'],
  ['122', '326cce9bb91ed5330072602f187882e9cb3a0578ac91c5f0480b0912276476ec'],
  ['123', '7f2c7247226e192a25426cfbbd7c4185093a74671677e8e1ae6d131cc3823aba'],
  ['124', '33070cd429b009c331b9d3a318468d04f3af666c139c0003063b899dd814cba5'],
  ['125', '74f5ad699955bb568b0c234963dcd8424bda39b21b32b6a28b0fd283b717dec3'],
  ['126', '14756455358c0dccd3d50f692618e1957aadc63f6fdbb34826ba20cecfcaad99'],
  ['127', 'cf8a383b856fc00926cb36cf4c4ca1afd2ebdf1eed12911e0edf90244f40460c'],
  ['128', '18799784d529f199ddf39914a25005592a7dc82449d7d4141f033f040c82b85a'],
  ['129', '8743f4ca3762b15710f02606e3492628ef0259f31d54fe626f0445d9090053f0'],
  ['130', '4c0e3b1a633822882f1e5975ec8601ceaa05ef84439743ee06256594ee333770'],
  ['131', 'a693e1b192770ead2a3258416548cdb74ab6661a6ad3840186777e14f30d5ad0'],
  ['132', '2c6290ccd96812c1ffdc2a115d615e64ac7815ec994789c077efeebdd7124674'],
  ['134', 'f668ffd52c94fb20d8bf8ebc4638237e10f3261db4120913b8aeabf55198ac23'],
  ['138', '7182f2e53f83f9ad10b7432826811f0c2e5981bed71159737585e213d46d007f'],
  ['139', '8a7d02ba61f5471ad4b615540958857196328330ac3f6adaa4ab8f85bfc4c2f8'],
  ['140', '67311b2a95c9b0139055a06134c71ba64051bbe964d5f3a40de33c7f480a7ad3'],
  ['141', 'f8c3c6c7f22005711dbbb12dcf44bafaec5c672cefd75198af74c5f25726872f'],
  ['142', '9b87eb71686d82bf3357b009531cff47fcffce94266aa173fc8634af6de0f098'],
  ['143', '74e921801e341a24416b003af19d16f332a4a300979c93b11c9033c1c7dccdc9'],
  ['144', '4f2f3803f6863d5f7eb1f00c10269269c27d1fd60e51c431d19f010de818313e'],
  ['145', '2da3802c66db89b86806dd74184d01a472df5eb6b4b484191fe33d9345a1e8c0'],
  ['146', 'a4e71327582534c616048bcbcf0f1135c3dac526ec6bd1ac438758c852111633'],
  ['147', 'fff7edbb1bc19d462c7d927b240e1f9f06bb9e4c1a7cad2b5dea3b454f733713'],
  ['148', '9c3710b7c46998504c6db8579c1812b03182cd4d0d7d3bc27af70989ccdf0750'],
  ['149', 'be8d4fb24a514b1dc91e7bbb079e3ed6ba719daf3164eab6725efce71c1a6edc'],
  ['150', 'b42dbefdbefbbd5f2483aa630e5970e9775c6fdb6a507cf6c0b2f1b4a4a3165b'],
  ['151', '4feac001f5b706c16c0ae6622699df00eb4e1e1728682e425dec7b786b141468'],
  ['153', '6c3ed70016c6044573289ef661b71923b5e6a9a178b07aec6b0af95dea9eddb8'],
  ['155', '13a44e1a78482abaf6c2c0565407cee8adc8229b61c8ba57674bd443560c979b'],
  ['156', '6fcf9fef150f9d295232fb338e112b6151ddb79cbea04ef40da7731d14aaec52'],
  ['157', 'ee5259485fe3891411efd75720db14e709d7947f9c7cc33af79c3b0f73c0bff9'],
  ['158', '83a8e46848f2d9364f77615e9260c3658782237fd16093d84e7a9389170aa0ae'],
  ['160', 'aaed70b92c23ce5e7a9fc84324d590e70cef87e69d812141127aa5f069d67a5b'],
  ['161', '1f3918351b96171f042927484e0232ec402165431e7581569cd5898939643fb1'],
  ['163', '9569f74e2c6b9003af8fadc678aeeafd9d547fdfde1c9602139728a755b9a0ce'],
  ['165', 'f633fd32f95c125b582d775e46c9df1c6c75f4f18bccde758356b9cb57328645'],
  ['166', '0e1179aa23104b0b43ff32bcf6b5aef8fa315f486251d04035543824513c7db2'],
  ['169', '2f46dd0e59843c9d879787d5eec7c42a02ac03d265c3c4ddd7a79c3bbbb842bb'],
  ['170', 'a0f64efc4b32460f5444238d3af44e7b81e3db875d1ef291f5eae4d3149dec4a'],
  ['181', '50e7c6d142543652872516f59bdcf9037e3ed0ed0375a4c6bb10a5b9f000a2b9'],
  ['183', '5ee9916597706d1270853db5f35fb2c70148b80b9d9d0cdff10bfb81deb5b890'],
  ['186', 'aa7af3667279fb24d84c0cbcb4384279fe61c0a722f6fe427ccf7e334d1fea8f'],
  ['187', '5ad33b1763dd6a4cf0cb04556294cfd23b07a29c253024fe0889550942c0a251'],
  ['190', 'd1c2477d8cd92768a5ab32fd8d5505c863bce30c2cd77fd786cf31449524d041'],
]);
const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const arcminutesPerSign = 30 * 60;
const circle = arcminutesPerSign * 12;
const normalizeArc = arc => ((arc % circle) + circle) % circle;
const location = (sign, degrees, minutes = 0) => ({ sign, arcminutes_in_sign: degrees * 60 + minutes });
const toArc = ({ sign, arcminutes_in_sign }) => normalizeArc(signs.indexOf(sign) * arcminutesPerSign + arcminutes_in_sign);
const fromArc = arc => ({ sign: signs[Math.floor(arc / arcminutesPerSign)], arcminutes_in_sign: arc % arcminutesPerSign });

const positions = {
  Sun: location('libra', 6, 37), Moon: location('gemini', 1, 44), Mercury: location('libra', 3, 54),
  Venus: location('libra', 6, 54), Mars: location('leo', 0, 54), Jupiter: location('sagittarius', 21, 55),
  Saturn: location('taurus', 9, 2),
};
// Preserve the source's Taurus/Scorpio 30° labels. The numeric chart uses
// the corresponding boundary; the label remains part of the printed record.
const printedCusps = [
  location('capricorn', 6, 37), location('aquarius', 23, 30), location('aries', 18, 34),
  location('taurus', 14, 39), location('taurus', 30), location('gemini', 14, 49),
  location('cancer', 6, 37), location('leo', 23, 30), location('libra', 18, 34),
  location('scorpio', 14, 39), location('scorpio', 30), location('sagittarius', 14, 49),
];
const houseArcs = printedCusps.map(toArc);
const lowerPositions = Object.fromEntries(Object.entries(positions).map(([planet, point]) => [planet.toLowerCase(), point]));
const planetArcs = Object.entries(positions).map(([planet, point]) => [planet, toArc(point)]);
const longitude = planet => toArc(lowerPositions[planet]) / 60;
const cusps = houseArcs.map(arc => arc / 60);
const aspect = (first, second, ray) =>
  ['main', 'other'].every(table => lillyAspect(longitude(first), longitude(second), first, second, ray, table) === true);
const adverseAspect = (first, second) =>
  ['main', 'other'].some(table => ['square', 'opposition'].some(ray =>
    lillyAspect(longitude(first), longitude(second), first, second, ray, table) === true));
const noAspect = (first, second) =>
  ['main', 'other'].every(table => lillyAspect(longitude(first), longitude(second), first, second, 'any', table) === false);
const houses = Object.fromEntries(planetArcs.map(([planet, arc]) => [planet.toLowerCase(), lillyHouse(arc / 60, cusps)]));
const ascendantRuler = lillyDomicileRuler(cusps[0]).toLowerCase();
const moonDispositor = lillyDomicileRuler(longitude('moon')).toLowerCase();
const printedMarsSaturnSquare = lillyAspect(longitude('mars'), longitude('saturn'), 'mars', 'saturn', 'square', 'main') === true;
const piscesInterceptedInSecond = lillyInterceptedSigns(cusps, 2).includes(signs.indexOf('pisces'));

const sum = values => Object.values(values).reduce((total, amount) => total + amount, 0);
function strength(fortitude, debility) {
  return {
    fortitude_points: sum(fortitude), debility_points: sum(debility),
    fortitude_items: fortitude, debility_items: debility,
  };
}

// The columns on pp.744–745 are independent of the value drawn on p.742.
const strengthTable = {
  longitude: { ...lowerPositions, mercury: location('libra', 3, 34), lot_of_fortune: location('virgo', 1, 44) },
  saturn: strength({ house_3: 1, free_combustion: 5, oriental: 2 }, { peregrine: 5, retrograde: 5, slow: 2 }),
  jupiter: strength({ domicile: 5, direct: 4, swift: 2, free_combustion: 5 }, { house_12: 5, occidental: 2 }),
  mars: strength({ house_7: 4, direct: 4, oriental: 2, swift: 2, free_combustion: 5 }, { peregrine: 5 }),
  sun: strength({ conjunct_venus: 5, swift: 2 }, { fall: 4, peregrine: 5, house_8: 4 }),
  venus: { ...strength({ domicile: 5, terms: 2, direct: 4, occidental: 2, swift: 2, cazimi: 5 }, { house_8: 4 }), cazimi_points: 5 },
  mercury: strength({ direct: 4, swift: 2 }, { house_8: 4, combustion: 5 }),
  moon: strength({ house_5: 3, swift: 2, free_combustion: 5 }, { peregrine: 5, decreasing_light: 2 }),
  lot_of_fortune: strength({ virgo: 2, free_combustion: 5 }, { conjunct_south_node: 3, house_8: 4 }),
};
const dignityTotals = Object.fromEntries(Object.entries(strengthTable).filter(([planet]) => planet !== 'longitude')
  .map(([planet, row]) => [planet, row.fortitude_points - row.debility_points]));

// p.743 keeps the Moon-in-Gemini row empty. In particular, its appearance
// in this table does not add heat or moisture to the recorded tally.
const temperamentRows = [
  ['cold', 'dry'], ['cold', 'dry'], ['cold', 'dry'], ['cold', 'dry'], ['hot', 'moist'], ['hot', 'moist'], [],
  ['hot', 'dry'], ['cold', 'dry'], ['hot', 'moist'], ['hot', 'moist'], ['cold', 'dry'], ['hot', 'moist'], ['hot', 'moist'],
];
const temperamentTotals = Object.fromEntries(['hot', 'moist', 'cold', 'dry'].map(quality =>
  [quality, temperamentRows.filter(row => row.includes(quality)).length]));
const anti = Object.fromEntries(Object.entries(lowerPositions).map(([planet, point]) => [planet, normalizeArc(circle / 2 - toArc(point))]));
const mercuryStrengthArc = toArc(strengthTable.longitude.mercury);
const mercuryStrengthAntiscion = normalizeArc(circle / 2 - mercuryStrengthArc);
const modernHouseSign = house => signs[Math.floor(houseArcs[house - 1] / arcminutesPerSign)];
const rulesHouse = (planet, house) => lillyDomicileRuler(cusps[house - 1]) === planet;
const angularGap = (a, b) => Math.min(Math.abs(a - b), circle - Math.abs(a - b));
const astroGap = (first, second) => angularGap(toArc(lowerPositions[first]), toArc(lowerPositions[second]));
const fixedStarCrosscheck = (printed, point) => ({
  table_sign: printed.sign, table_degree_arcminutes: printed.arcminutes_in_sign,
  absolute_difference_arcminutes: angularGap(toArc(printed), toArc(point)),
});
const printedReferenceStars = {
  cor_leonis: location('leo', 24, 30), oculus_taurus: location('gemini', 4, 30),
  spica_virgo: location('libra', 18, 30), lucida_lancis: location('scorpio', 9, 45),
};
const comparisons = new Map([
  ['009', '第 751 页正文称木星六合第三宫头。按第 742 页印盘，木星与该宫头的较短黄经距离为 116°39′。'],
  ['014', '第 756 页正文称狮子心与八宫头成整度合相。按第 616 页星表和第 742 页宫头，两位置相差 60 角分。'],
  ['019', '第 754 页原书以三分术语记录水土关系。印盘所列水星在天秤、土星在金牛。'],
  ['020', '月亮的西方措辞、金星离中天和八宫位置均按第 755 页作者的原书表述引用。'],
  ['023', '第 758 页的出行星座列举含白羊，第 742 页印盘的火星在狮子。此条同时保留正文的方向陈述与印盘位置。'],
  ['074', '此处以第 745 页强弱表的水星 3°34′复算。第 743 页印成的正反映点与第 742 页印盘 3°54′对应。'],
  ['075', '第 757 页按列印出双体座 2、月亮 1、成相行星 4，结论栏也印作可能 4。'],
  ['125', '第 761 页正文以秤盘亮星临中天取材。第 616 页星表与印盘中天的黄经差为 294 角分。'],
  ['073', '第 763 页将居住地的公共境况另列为限制。第 643 页格言是否适用采用作者对这份印盘的原文结论。'],
  ['183', '第 763 页把金星和木星合列为命局主星，第 743 页气质表单列金星。印盘及第 743 页列有日、金、水与月亮的拱相，此处保留作者关于月亮受损的具体判断。'],
  ['187', '第 764 页将古代身体术语用于原例判断。印盘中水星在天秤 3°54′，该座的传统庙主是金星。'],
]);

export const lillyMerchantComparison = id => comparisons.get(sourceNumber(id));
const moonSextileMars = aspect('moon', 'mars', 'sextile');
const friendlyMoon = ['mercury', 'sun', 'venus'].every(planet => aspect('moon', planet, 'friendly'));
const marsSextilesLibra = ['mercury', 'sun', 'venus'].every(planet => aspect('mars', planet, 'sextile'));
const fortuna = strengthTable.longitude.lot_of_fortune;
const p754 = {
  moon_applies_sinister_trine_to_mercury: true, moon_applies_sinister_trine_to_sun: true, moon_applies_sinister_trine_to_venus: true,
  sun_partill_square_seventh_cusp: Math.floor(longitude('sun')) - Math.floor(cusps[6]) === 90,
  venus_partill_square_seventh_cusp: Math.floor(longitude('venus')) - Math.floor(cusps[6]) === 90,
  long_ascension_configuration: true,
};
const childrenCountTable = {
  bicorporeal_printed: 2, moon_printed: 1, aspected_planets_printed: 4, probability_printed: 4,
  judgment_sign: modernHouseSign(5), eleventh_judgment_sign: modernHouseSign(11), house_11_judgment_sign: modernHouseSign(11),
  mercury_judged_combust: true, moon_sextile_mars: moonSextileMars,
  mars_in_masculine_sign: signs.indexOf(lowerPositions.mars.sign) % 2 === 0,
  sun_in_masculine_sign: signs.indexOf(lowerPositions.sun.sign) % 2 === 0,
  moon_near_exact_sextile_to_mars: Math.abs(astroGap('moon', 'mars') - 60 * 60) <= 60,
  mercury_power_given_to_sun: true, venus_is_active_child_significator: true,
};
const angularHouses = [1, 4, 7, 10];
const eighthRuler = lillyDomicileRuler(cusps[7]).toLowerCase();
const malefics = ['saturn', 'mars'];
const healthAndDeathReadings = {
  // pp.763–764, statements about the printed case, including the author's
  // evaluation of hindrance rather than the mere existence of an aspect.
  luminaries_in_hostile_aspect: adverseAspect('sun', 'moon'),
  luminaries_afflicted_by_angular_saturn_or_mars: malefics.some(planet => angularHouses.includes(houses[planet])
    && ['sun', 'moon'].some(light => adverseAspect(planet, light))),
  imprisonment: { p643_aphorisms_applicable: false },
  death: {
    moon_angular: angularHouses.includes(houses.moon),
    moon_impeded_by_malefic_aspect_of_saturn_or_mars: malefics.some(planet => adverseAspect(planet, 'moon')),
    moon_impeded_by_eighth_ruler: adverseAspect(eighthRuler, 'moon'),
    moon_impeded_by_any_aspect_of_eighth_occupant: Object.entries(houses).some(([planet, house]) =>
      house === 8 && adverseAspect(planet, 'moon')),
    venus_and_jupiter_lords_of_geniture: true, // The p.763 reading, distinct from the p.743 table.
    intercepted_virgo_in_eighth: lillyInterceptedSigns(cusps, 8).includes(signs.indexOf('virgo')),
    venus_regulates_mercury: lillyDomicileRuler(longitude('mercury')) === 'Venus', // p.764
  },
};

// The text records interpretation-specific testimonies alongside the
// printed figure. Keep those statements in this source case's namespace.
const chapterReadings = {
  // pp.747–751, appearance, fortune, property and siblings.
  lyra_near_ascendant_cusp: true, lucida_lancis_culminating: true, moon_near_oculus_taurus: true,
  jupiter_and_venus_strong_in_obscure_houses: houses.jupiter === 12 && houses.venus === 8
    && dignityTotals.jupiter > 0 && dignityTotals.venus > 0,
  jupiter_and_venus_essentially_fortified: true, venus_essentially_fortified: true, jupiter_essentially_fortified: true,
  venus_essentially_strongest: true, venus_prevalent_in_figure: dignityTotals.venus === Math.max(...Object.values(dignityTotals)),
  mars_accidentally_strong: true, moon_accidentally_strong: true, mars_has_accidental_fortitude: true,
  sun_peregrine: true, saturn_opposes_tenth_house_by_text: true,
  saturn_oriental: true, saturn_below_earth: houses.saturn < 7, sun_above_earth: houses.sun > 6, venus_above_earth: houses.venus > 6,
  venus_partile_aspect_to_ascendant: Math.floor(cusps[0]) - Math.floor(longitude('venus')) === 90,
  venus_rules_fourth: rulesHouse('Venus', 4), venus_rules_ninth: rulesHouse('Venus', 9),
  second_cusp_fixed: signs.indexOf(modernHouseSign(2)) % 3 === 1, jupiter_cadent: [3, 6, 9, 12].includes(houses.jupiter),
  fortune_conj_south_node: true, saturn_casts_sinister_trine_to_fortune: true,
  mercury_disposes_fortune: lillyDomicileRuler(toArc(fortuna) / 60) === 'Mercury', mercury_rules_fifth: rulesHouse('Mercury', 5),
  mars_sextiles_three_libra_planets: marsSextilesLibra, moon_sinister_sextile_mars: moonSextileMars,
  siblings_p751: { reported_brothers: 7, jupiter_count: 2, mars_count: 1, remaining_group: 'mercury_venus_sun', implied_remainder: 7 - 2 - 1 },
  // pp.752–754, the parents' position circle, house six and kinship.
  siblings_p752: { paternal_relatives_house: 6, paternal_relatives_second_house: 7 },
  mars_rules_third: rulesHouse('Mars', 3), sun_rules_eighth: rulesHouse('Sun', 8),
  sun_disposes_mars: lillyDomicileRuler(longitude('mars')) === 'Sun',
  moon_has_dominion_in_third: true, sun_free_from_malefic_aspects: true,
  venus_receives_sun: lillyDomicileRuler(longitude('sun')) === 'Venus',
  father_substance_significator: 'mars', derived_father_pole_degrees: 40, derived_father_ascendant_arcminutes: 397,
  parents: { father_significator: 'sun', mother_significator: 'venus', sun_venus_almost_same_position_circle: true },
  venus_stronger_than_sun: dignityTotals.venus > dignityTotals.sun,
  mercury_rules_house_6: rulesHouse('Mercury', 6), mercury_and_saturn_share_triplicity: true,
  health: { house_6_cusp_other_affliction: false, venus_assistance_at_least_sun_affliction: true, sixth_sign_common: true },
  // pp.754–757, the author's marriage and children readings.
  p754, p755: { spouse_derived_house_9: 3 }, marriage: { spouse_derived_house_4: 10 },
  marriage_significators_in_amicable_aspects: true, moon_occidental_of_sun_and_in_figure: true, venus_leaving_meridian: true,
  moon_then_connects_mercury_and_venus: true, first_partner_significator: 'mars', second_partner_significator: 'venus',
  cor_leonis_partile_conj_house_8_cusp: true, house_8_cusp_fixed: signs.indexOf(modernHouseSign(8)) % 3 === 1,
  house_8_ruler_sun_peregrine: true, south_node_in_house_8: true,
  mercury_applies_to_sun_then_venus: true, children_count_table: childrenCountTable,
  fifth_cusp_gemini: modernHouseSign(5) === 'gemini', jupiter_in_twelfth_in_sagittarius: houses.jupiter === 12 && lowerPositions.jupiter.sign === 'sagittarius',
  moon_has_friendly_aspects_to_mercury_sun_venus: friendlyMoon, fifth_cusp_has_friendly_testimony: true,
  children_mutual_aspects_benign: true, p757: { venus_and_moon_treated_as_feminine: true },
  // pp.758–763, travels, profession and friends.
  small_reception_moon_mercury: true, travel_p758: { reported_overseas_trips: 3, reported_barbary_trips: 2, reported_holland_trips: 1 },
  moon_in_west_quarter_tending_north: true, venus_sun_mercury_in_southwest_quarter: true, // p.758
  capricorn_free_from_malefic_presence_or_aspect: true, // The author's judgment in p.760.
  venus_disposes_mercury_and_sun: ['mercury', 'sun'].every(planet => lillyDomicileRuler(longitude(planet)) === 'Venus'),
  mars_rules_tenth: rulesHouse('Mars', 10), mars_sextiles_moon_venus_sun_mercury: moonSextileMars && marsSextilesLibra,
  active_profession_significator: 'mars', venus_contributes_to_profession: true, mercury_contributes_to_profession: true,
  p761: { profession_significator_aspects_close: true },
  house_11_cusp_sagittarius: modernHouseSign(11) === 'sagittarius', jupiter_rules_eleventh: rulesHouse('Jupiter', 11),
  moon_rules_seventh: rulesHouse('Moon', 7), mercury_peregrine: true, mercury_considered_in_friendship: true,
};

const caseData = {
  context: { historical_case: lillyMerchantCaseId, lilly_merchant_table: 'p743_temperament',
    lilly_merchant_children_passage: 'p757_after_count_table',
    lilly_legacy_region_sign: ['capricorn', 'pisces', 'libra', 'sagittarius'] },
  chart: {
    house_system: 'regiomontanus', sect: 'day',
    angles: { asc: { sign: printedCusps[0].sign }, desc: { sign: printedCusps[6].sign } },
    planets: {
      ...Object.fromEntries(Object.entries(lowerPositions).map(([planet, point]) => [planet, { sign: point.sign, house: houses[planet] }])),
      saturn: { sign: lowerPositions.saturn.sign, house: houses.saturn, motion: 'retrograde' },
      south_node: { house: 8 },
    },
  },
  profiles: { lilly: {
    aspects: {
      // The ascendant rays are recorded in the p.743 table. Only the solar
      // square is described there as partile and it equals 90° in the figure.
      saturn: { ascendant: { trine: true }, moon: { any: !noAspect('saturn', 'moon') }, venus: { any: !noAspect('saturn', 'venus') } },
      // The author lists this wider square in the case (pp.746, 750).
      mars: { saturn: { square: printedMarsSaturnSquare, partile_square: astroGap('mars', 'saturn') === 90 * 60 },
        moon: { sextile: moonSextileMars }, venus: { sextile: aspect('mars', 'venus', 'sextile') }, house_11_cusp: { trine: true } },
      // P.751 explicitly writes sextile to the third cusp. Keep this apart
      // from the 116°39′ ecliptic distance obtainable from the p.742 figure.
      jupiter: { house_2_cusp: { sextile: true }, house_3_cusp: { sextile: true }, house_6_cusp: { opposition: true } },
      sun: { ascendant: { square: toArc(lowerPositions.sun) + 90 * 60 === houseArcs[0] },
        moon: { trine: aspect('sun', 'moon', 'trine') },
        venus: { conjunction: aspect('sun', 'venus', 'conjunction') }, mercury: { conjunction: aspect('sun', 'mercury', 'conjunction') } },
      venus: { ascendant: { square: true }, moon: { trine: aspect('venus', 'moon', 'trine') }, saturn: { any: !noAspect('venus', 'saturn') } },
      mercury: { ascendant: { square: true }, moon: { trine: aspect('mercury', 'moon', 'trine') },
        saturn: { any: !noAspect('mercury', 'saturn') } },
      moon: { mars: { sextile: moonSextileMars }, mercury: { friendly: aspect('moon', 'mercury', 'friendly'), trine: aspect('moon', 'mercury', 'trine') },
        sun: { friendly: aspect('moon', 'sun', 'friendly'), trine: aspect('moon', 'sun', 'trine') },
        venus: { friendly: aspect('moon', 'venus', 'friendly'), trine: aspect('moon', 'venus', 'trine') },
        lot_of_fortune: { square: true }, house_11_cusp: { opposition: true } },
    },
    essential_dignities: { jupiter: { strong: true }, venus: { strong: true }, sun: { fall: true } },
    receptions: { venus: { saturn: { mutual: true } } }, // p.746
    house_rulers: { house_3: { mars: lillyDomicileRuler(cusps[2]) === 'Mars' } },
    merchant_case: {
      ...chapterReadings,
      ...healthAndDeathReadings,
      printed_birth: { year: 1616, month: 9, day: 19, seconds_of_day: 14 * 3600 + 24 * 60 + 30, latitude_degrees: 53 },
      printed_diagram: { mid_heaven_right_ascension_arcminutes: 222 * 60 + 10, ascendant_oblique_ascension_arcminutes: 312 * 60 + 10 },
      printed_diagram_longitude: lowerPositions,
      printed_longitude: { moon: lowerPositions.moon, mercury: strengthTable.longitude.mercury },
      recomputed_antiscia: { mercury: fromArc(mercuryStrengthAntiscion) },
      recomputed_contra_antiscia: { mercury: fromArc(normalizeArc(mercuryStrengthAntiscion + circle / 2)) },
      printed_reference_stars: printedReferenceStars,
      fixed_star_crosscheck: {
        moon_oculus_p616: fixedStarCrosscheck(printedReferenceStars.oculus_taurus, lowerPositions.moon),
        moon_oculus_p644: fixedStarCrosscheck(location('gemini', 4), lowerPositions.moon),
        ninth_cusp_spica_p616: fixedStarCrosscheck(printedReferenceStars.spica_virgo, printedCusps[8]),
        midheaven_lucida_lancis_p616: fixedStarCrosscheck(printedReferenceStars.lucida_lancis, printedCusps[9]),
      },
      printed_house_cusps: Object.fromEntries(printedCusps.map((point, index) => ['house_' + (index + 1), point])),
      printed_latitude_arcminutes: { saturn: -178, jupiter: -37, mars: 21, venus: -60, mercury: -32, moon: 60 },
      printed_antiscia: Object.fromEntries(Object.entries(anti).map(([planet, arc]) => [planet, fromArc(arc)])),
      printed_contra_antiscia: Object.fromEntries(Object.entries(anti).map(([planet, arc]) => [planet, fromArc(normalizeArc(arc + circle / 2))])),
      printed_strength_table: strengthTable, dignity_totals: dignityTotals,
      temperament_table: { totals: temperamentTotals, year_quarter: 'autumn' },
      lord_of_geniture: 'venus', // Explicit in p.743 and p.746.
      ascendant_ruler: ascendantRuler,
      ascendant_has_no_planets: !Object.values(houses).includes(1),
      saturn_rules_first_and_second: ascendantRuler === 'saturn' && lillyDomicileRuler(cusps[1]) === 'Saturn',
      mars_saturn_platick_square: printedMarsSaturnSquare,
      second_house_intercepted_sign: piscesInterceptedInSecond ? 'pisces' : null,
      north_node_in_pisces: true, north_node_in_house_2: true, north_node_dispositor: 'jupiter', // p.749
      jupiter_rules_intercepted_pisces_in_second: piscesInterceptedInSecond && lillyDomicileRuler(330) === 'Jupiter',
      moon_dispositor: moonDispositor,
      sun_partile_aspect_to_ascendant: toArc(lowerPositions.sun) + 90 * 60 === houseArcs[0],
      mercury_combust: lowerPositions.sun.sign === lowerPositions.mercury.sign && Math.abs(longitude('sun') - longitude('mercury')) < 8.5,
      venus_cazimi: Math.abs(toArc(lowerPositions.sun) - toArc(lowerPositions.venus)) === 17,
    },
  } },
};

const anchor = 'context.historical_case';
const caseValue = selector => typeof selector === 'string' ? selector.split('.').reduce((row, field) =>
  row && typeof row === 'object' && Object.hasOwn(row, field) ? row[field] : undefined, caseData) : undefined;
export function isLillyMerchantCaseFact(selector, value) {
  const expected = caseValue(selector);
  if (Array.isArray(expected)) return expected.includes(value);
  return ['string', 'boolean', 'number'].includes(typeof expected) && expected === value;
}
const caseFact = (selector, value) => ({ kind: 'western_lilly_merchant_case', selector, value });

export function compileLillyMerchantCase(claim) {
  const number = sourceNumber(claim.id);
  if (!reviewed.has(number)) return undefined;
  const { source, conditions, evidence } = claim;
  if (reviewed.get(number) !== createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex')) {
    return { reason: 'source_review_required', reviewNote: '莉莉商人命例的原文、条件或版本已变化，须重核印盘。' };
  }
  const groups = conditions.match.include.filter(group => group.some(({ fact, equals }) => fact === anchor && equals === lillyMerchantCaseId)
    && group.every(({ fact, equals }) => isLillyMerchantCaseFact(fact, equals)));
  if (groups.length !== conditions.match.include.length) return {
    reason: 'source_review_required', reviewNote: '本条有条件尚未由印盘、原表或指定章节的正文证实。',
  };
  return { compiler: lillyMerchantCaseProfile, inputs: groups.map(group =>
    normalizeRuleInput('western', { required: group.map(({ fact, equals }) => caseFact(fact, equals)) })) };
}

function collectFacts(row, path = []) {
  return Object.entries(row).flatMap(([key, value]) => {
    const next = [...path, key];
    if (value === null) return [];
    if (Array.isArray(value)) return value.map(option => caseFact(next.join('.'), option));
    return typeof value === 'object' ? collectFacts(value, next) : [caseFact(next.join('.'), value)];
  });
}

export function lillyMerchantPrintedChartFacts() {
  return [
    { kind: 'western_zodiac', zodiac: 'tropical' },
    { kind: 'western_profile_system', profile: 'regiomontanus' },
    ...cusps.map((longitude, index) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude })),
    ...planetArcs.map(([planet, arc]) => ({ kind: 'planet_longitude', planet, longitude: arc / 60 })),
  ];
}

export function lillyMerchantCaseContext(chart) {
  if (chart?.scope !== 'natal') return null;
  const zodiacs = new Set(chart.present.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (zodiacs.size !== 1 || !zodiacs.has('tropical')) return null;
  const observedCusps = lillyCusps(chart.present);
  const toRoundedArc = longitude => Number.isFinite(longitude) ? normalizeArc(Math.round(longitude * 60)) : null;
  if (!observedCusps?.every((longitude, index) => toRoundedArc(longitude) === houseArcs[index])
    || !planetArcs.every(([planet, arc]) => toRoundedArc(lillyPlanetPosition(chart.present, planet)?.longitude) === arc)) return null;
  // Recorded evidence is attached only after the whole source figure is
  // confirmed. An asserted case field does not participate in identification.
  return chartContext('western', collectFacts(caseData));
}

export function lillyMerchantCaseFactText({ selector, value }) {
  if (selector === anchor) return '同一初版英格兰商人印盘，七曜及十二宫头在角分精度一致';
  if (selector === 'chart.house_system') return '采用原书印盘的雷吉奥蒙塔努斯宫制';
  if (selector === 'context.lilly_merchant_table') return '采用第 743 页原印气质见证表';
  const label = selector.replace(/^profiles\.lilly\.(?:merchant_case\.)?/u, '');
  return '印本记录 ' + label + ' 为 ' + (value === true ? '成立' : value === false ? '无此相位' : value);
}
