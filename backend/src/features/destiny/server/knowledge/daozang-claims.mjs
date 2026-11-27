import { normalizeRuleInput } from './matching.mjs';

const branches = '子丑寅卯辰巳午未申酉戌亥';
const palaces = ['命宫', '财帛宫', '兄弟宫', '田宅宫', '男女宫', '奴仆宫', '妻妾宫', '疾厄宫', '迁移宫', '官禄宫', '福德宫', '相貌宫'];
const ring = ['紫微', '天虚', '天贵', '天印', '天寿', '天空', '红鸾', '天库', '天贯', '文昌', '天福', '天禄'];
const wrap = (value) => (value + 24) % 12;

// 《续道藏》卷一的起例及宫序。身宫按初一为起点，书载六个交宫日从未时换宫。
export function daozangChartFacts({ yearBranch, month, day, hour, leap }) {
  if (leap) return [];
  const year = branches.indexOf(yearBranch);
  if (year < 0 || ![month, day, hour].every(Number.isInteger)
    || hour < 0 || hour > 11 || month < 1 || month > 12 || day < 1 || day > 30) return [];
  const ziwei = wrap(7 + year);
  const staff = wrap(1 - month);
  const life = wrap(staff + 3 - hour);
  const body = wrap(staff - Math.floor((2 * (day - 1) + Number(hour >= 7)) / 5));
  const positions = [
    ...ring.map((star, index) => ({ star, at: wrap(ziwei - index) })),
    ...['天杖', '天异', '毛头', '天刃'].map((star, index) => ({ star, at: wrap(staff - index) })),
    { star: '天刑', at: wrap(month + 8) }, { star: '天姚', at: wrap(month) }, { star: '天哭', at: wrap(1 - year) },
  ];
  const slots = [...palaces.map((palace, index) => ({ palace, at: wrap(life + index) })), { palace: '身宫', at: body }];
  return [
    ...positions.map(({ star, at }) => ({ kind: 'daozang_star_branch', star, branch: branches[at] })),
    ...slots.flatMap(({ palace, at }) => positions.flatMap(({ star, at: starPosition }) => {
      const distance = wrap(starPosition - at);
      const relation = distance === 0 ? 'occupies' : distance === 6 ? 'opposite' : [4, 8].includes(distance) ? 'trine' : null;
      return relation ? [{ kind: 'daozang_palace_star', palace, star, relation }] : [];
    })),
    ...slots.map(({ palace, at }) => ({ kind: 'daozang_palace_star_count', palace, count: positions.filter((position) => position.at === at).length })),
  ];
}

const starIn = (palace, star, relation = 'occupies') => ({ kind: 'daozang_palace_star', palace, star, relation });
const atBranch = (star, branch) => ({ kind: 'daozang_star_branch', star, branch });
const countIn = (palace, count) => ({ kind: 'daozang_palace_star_count', palace, count });
const inEither = (palaces, star, branches = []) => palaces.flatMap((palace) => branches.length
  ? branches.map((branch) => [starIn(palace, star), atBranch(star, branch)]) : [[starIn(palace, star)]]);
const inSame = (...stars) => palaces.map((palace) => stars.map((star) => starIn(palace, star)));
const single = (text, palace, ...stars) => [[text, [stars.map((star) => starIn(palace, star))]]];
const redLuanAspects = (star) => ['命宫', '身宫'].flatMap((palace) => ['opposite', 'trine']
  .map((relation) => [starIn(palace, star, relation), atBranch('红鸾', '丑')]));
const chartPassages = {
  'ziwei-v3-daozang-001-p132-001': [['主頻遭責辱', [[
    starIn('官禄宫', '天杖'), starIn('官禄宫', '天贯'), starIn('官禄宫', '天哭', 'opposite'), countIn('官禄宫', 2),
  ]]]],
  'ziwei-v1-daozang-270-p273-001': [['先破後成還自置。', [[
    starIn('田宅宫', '天哭'), starIn('身宫', '天贯'), starIn('命宫', '天库'), atBranch('天库', '亥'),
  ]]]],
  'ziwei-v2-daozang-009-p107-001': [['福星廟旺對合宮', [...'卯寅申巳'].map((branch) => [
    starIn('身宫', '天福', 'opposite'), atBranch('天福', branch), starIn('身宫', '天寿'),
    starIn('命宫', '天印'), starIn('命宫', '文昌', 'opposite'),
  ])]],
  'ziwei-v2-daozang-009-p109-001': [['橫財正照，虛廟不照破，紅鸾對合', [[
    starIn('命宫', '天贯', 'opposite'), starIn('身宫', '红鸾', 'opposite'), atBranch('天虚', '丑'),
  ]]]],
  'ziwei-v2-daozang-113-p113-001': [['觀夫福壽齊臨紅鸾，何如其聰明。', [...'卯寅申巳'].map((branch) => [
    starIn('命宫', '天福'), starIn('命宫', '天寿', 'opposite'), starIn('命宫', '红鸾', 'trine'), atBranch('天福', branch),
  ])]],
  'ziwei-v3-daozang-001-p055-002': [['主過房庶出', ['命宫', '身宫'].flatMap((palace) => [...'卯寅申巳'].map((branch) => [
    starIn(palace, '天福'), starIn(palace, '天异'), atBranch('天福', branch),
  ]))]],
  'ziwei-v3-daozang-001-p092-001': [['會善星與文星合，主清雅之職。', [[
    starIn('官禄宫', '天禄', 'trine'), starIn('官禄宫', '天印'), starIn('官禄宫', '文昌', 'opposite'), atBranch('文昌', '午'),
  ]]]],
  'ziwei-v1-daozang-270-p270-001': single('不宜天異，主凶父母早喪', '田宅宫', '天异'),
  'ziwei-v2-daozang-153-p383-002': [['是官，主財，卻損人益己',
    inEither(['命宫', '身宫'], '天库', [...'午亥卯未'])]],
  // 卷三天姚条把子位列为花粹宝玉格。后世《八喜楼钞本古诀》也明确将子位列为陷。
  'ziwei-v3-daozang-001-p237-001': [['若臨命陷，嫁不用謀，把手成親，',
    [[starIn('命宫', '天姚'), atBranch('天姚', '子'), { kind: 'natal_gender', gender: '女' }]]]],
  // In the time table, 無剋破 is the entry's family reading, parallel to 先剋父 and 先剋母.
  'ziwei-v1-daozang-040-p049-001': [['寅時中四刻，無剋破。爲人有成有敗有權柄，衣祿足、富貴，性急輕怏忠直，六親少倚，兄弟須有情，疏子息，桃花夾竹之命。',
    [[{ kind: 'natal_ziwei_time_band', branch: '寅', band: 'middle' }]]]],
  'ziwei-v1-daozang-040-p072-001': [['申時上四刻，無剋破。爲人近貴，性巧聰明，逢危不險，大事化小，一生安穩，衣祿無虧，六親和，兄弟睦，子息不孤之命。',
    [[{ kind: 'natal_ziwei_time_band', branch: '申', band: 'early' }]]]],
  'ziwei-v1-daozang-040-p073-001': [['申時中，先剋父。六親不得力，兄弟難爲，自卓自立，近官出入聰明，祖業稀招，終成家業，妻宜兩硬，子必先虛。',
    [[{ kind: 'natal_ziwei_time_band', branch: '申', band: 'middle' }]]]],
  'ziwei-v1-daozang-040-p081-001': [['戌時中刻，先剋母。爲人多計較，性巧聰明，好生怏樂，忠良出類，言詞過人，有施爲，六親稀和，兄弟須有，無祖業興家，中末則吉，子息不孤之命。',
    [[{ kind: 'natal_ziwei_time_band', branch: '戌', band: 'middle' }]]]],
  'ziwei-v1-daozang-205-p209-001': [['入廟旺臨財帛，俱富', [
    ...inEither(['财帛宫'], '紫微', [...'酉子']), ...inEither(['财帛宫'], '红鸾', ['丑']),
  ]]],
  'ziwei-v1-daozang-205-p210-001': [['天貴遇貫星，巨富', [
    [starIn('财帛宫', '天贵'), starIn('财帛宫', '天贯', 'opposite')],
  ]]],
  'ziwei-v1-daozang-205-p215-001': single('守財帛進退', '财帛宫', '天虚'),
  'ziwei-v1-daozang-240-p242-001': single('主喧爭多見刑', '兄弟宫', '天虚'),
  'ziwei-v1-daozang-240-p244-001': single('兄弟貴顯', '兄弟宫', '天印'),
  'ziwei-v1-daozang-300-p300-001': [['宜紅鸾天貴照臨，主有美貴之妻及奴婢',
    [[starIn('妻妾宫', '红鸾', 'trine'), starIn('妻妾宫', '天贵', 'trine')]]]],
  'ziwei-v1-daozang-300-p301-001': single('印因妻致富', '妻妾宫', '天印'),
  'ziwei-v1-daozang-300-p301-002': single('文招聰明伶俐之妻', '妻妾宫', '文昌'),
  'ziwei-v1-daozang-328-p329-001': [
    ...single('紫出入住外方近貴', '迁移宫', '紫微'), ...single('虛出祖外才益', '迁移宫', '天虚'),
    ...single('印出外方才祿', '迁移宫', '天印'), ...single('貴出入得貴人力', '迁移宫', '天贵'),
  ],
  'ziwei-v1-daozang-336-p336-001': [['宜見印绶文昌，中科名', [
    [starIn('官禄宫', '天印'), starIn('官禄宫', '文昌', 'opposite')],
    [starIn('官禄宫', '文昌'), starIn('官禄宫', '天印', 'opposite')],
  ]]],
  'ziwei-v1-daozang-336-p337-001': single('虛主虛名奇人勢自無決斷之事', '官禄宫', '天虚'),
  'ziwei-v1-daozang-347-p347-001': [['如凡虛星照破，一生無福', [[starIn('福德宫', '天虚', 'opposite')]]]],
  'ziwei-v1-daozang-347-p348-001': single('姚身亂心忙', '福德宫', '天姚'),
  'ziwei-v2-daozang-153-p153-001': [['獨臨卯位，謂之出辰格，主貴大命', palaces.map((palace) =>
    [atBranch('紫微', '卯'), starIn(palace, '紫微'), countIn(palace, 1)])]],
  'ziwei-v2-daozang-153-p153-002': [['照身宮，主有祿，清職端正，能文多智', ['opposite', 'trine'].map((relation) => [starIn('身宫', '紫微', relation)])]],
  'ziwei-v2-daozang-153-p190-001': [['廟中旺丑身命宮，主性巧福薄', inEither(['命宫', '身宫'], '天虚', ['丑'])]],
  'ziwei-v2-daozang-153-p190-002': single('若在身宮，主一身兩姓，早年剋父，女人見之不宜', '身宫', '天虚'),
  'ziwei-v2-daozang-153-p229-001': [['廟樂旺宮辰廟寅樂亥旺身命宮，主立非常之功，超群出衆，難事易成，高人見親，小人難近，有聲名',
    inEither(['命宫', '身宫'], '天贵', [...'辰寅亥'])]],
  'ziwei-v2-daozang-153-p229-002': single('天貴守命。主形端面白，方員氣宇，寬大物長，大肥胖面，方員白爭，四字唇紅齒白，心和性良，清雅便爲官', '命宫', '天贵'),
  'ziwei-v2-daozang-153-p266-001': [['廟子旺辰樂卯身命宮，主權貴福多', inEither(['命宫', '身宫'], '天印', [...'子辰卯'])]],
  'ziwei-v2-daozang-153-p266-002': [['得地，則承祖業', [...'子辰卯'].map((branch) => [atBranch('天印', branch)])]],
  'ziwei-v2-daozang-153-p340-001': [['丑廟見入廟格，照身命宮，主性柔，威儀清楚，好衣服，貪酒色，喜朋友，多得陰人扶助，又招妻財。',
    redLuanAspects('红鸾')]],
  'ziwei-v2-daozang-153-p340-002': [['紅鸾入廟，祿元照身命，爲龍門高擢格，主貴。', redLuanAspects('天禄')]],
  'ziwei-v2-daozang-153-p383-001': [['廟午旺亥己樂卯未身命宮，主富貴財帛，田宅豐滿', inEither(['命宫', '身宫'], '天库', [...'午亥卯未'])]],
  // 卷一五男女宫分列天贵与天禄的断语，卷二此句合称。
  'ziwei-v2-daozang-113-p113-002': [['貴祿臨男女之宮，光榮後代。',
    ['天贵', '天禄'].map((star) => [starIn('男女宫', star)])]],
  // 卷三开篇把勾绞列为贯索的异名。本句取该星同时守命、身。
  'ziwei-v3-daozang-001-p001-001': [['同守身命宮，爲連索身刑格，招閑事，惹爭訟',
    [[starIn('命宫', '天贯'), starIn('身宫', '天贯')]]]],
  // 卷三在文昌星条列文曲为别称，旺乐分别列午、戌。
  'ziwei-v3-daozang-001-p017-001': [['旺樂午戌居身命，主後秀文，高杖名選，出將入相。',
    inEither(['命宫', '身宫'], '文昌', [...'午戌'])]],
  'ziwei-v3-daozang-001-p017-002': [['居旺地，主清貴無雙，仁義有守，信實不移。', [[atBranch('文昌', '午')]]]],
  'ziwei-v3-daozang-001-p028-001': [['卯上學堂星，虛危未顯名', [[atBranch('文昌', '卯')]]]],
  'ziwei-v3-daozang-001-p055-001': single('官祿宮，有政事，不狂妄', '官禄宫', '天福'),
  'ziwei-v3-daozang-001-p092-002': single('官祿宮見之，最吉，主財厚業隆', '官禄宫', '天禄'),
  'ziwei-v3-daozang-001-p132-002': [['會星天印同宮，主權印，亦貴顯', inSame('天杖', '天印')]],
  'ziwei-v3-daozang-001-p169-001': [['廟丑未樂辰身命二官，主破祖離鄉', inEither(['命宫', '身宫'], '天异', [...'丑未辰'])]],
  'ziwei-v3-daozang-001-p169-002': single('妻妾宮不宜見之，主離損', '妻妾宫', '天异'),
  'ziwei-v3-daozang-001-p189-001': single('官祿宮，主不怕事，立志有謀，決斷無疑', '官禄宫', '毛头'),
  'ziwei-v3-daozang-001-p218-001': single('刑刃星兄弟宮，名破雁格', '兄弟宫', '天刑', '天刃'),
};

export function daozangPassages(claim) {
  return (chartPassages[claim.id] ?? []).map(([text, groups]) => {
    if (!claim.evidence.original_text.includes(text)) throw new Error('Invalid Daozang passage: ' + claim.id);
    return { text, inputs: groups.map((required) => normalizeRuleInput('ziwei', { required })) };
  });
}
