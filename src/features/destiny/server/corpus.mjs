export const corpusVersion = 'destiny-report-corpus-v3';

const topicRows = [
  ['growth', '成长与人生方向'],
  ['work', '事业与长期积累'],
  ['bonds', '关系与亲密边界'],
  ['resources', '资源与安全感'],
  ['inner', '内在节奏与恢复'],
];

const knowledgeRows = [
  ['bazi', 'growth', '日干 四柱 天干', '当前规则用日干提取成长方向。它是四柱中日柱的天干，适合作为传统解读的一个切入点。'],
  ['bazi', 'work', '月支 月柱 地支', '当前规则用月支映射做事风格。月支只是月柱的地支，需要把它表述成观察角度。'],
  ['ziwei', 'growth', '命宫 主星', '命宫主星在当前规则中用于讨论人生方向，引用具体星名时只用输入所列线索。'],
  ['ziwei', 'work', '官禄 主星', '官禄宫在此用于讨论如何承担职责与积累经验，可联系不同人生阶段的角色转换。'],
  ['ziwei', 'bonds', '夫妻 主星', '夫妻宫在此提供讨论亲密互动的传统角度，关系建立、经营和修复都可以作为场景。'],
  ['ziwei', 'resources', '财帛 主星', '财帛宫在此提供讨论资源分配方式的角度。资源也包括时间、能力和支持网络。'],
  ['ziwei', 'inner', '福德 主星', '福德宫在此提供讨论内在节奏的传统角度，可落到日常如何独处、整理思路和恢复精力。'],
  ['western', 'growth', '太阳 星座', '太阳所在星座在当前规则中映射自我表达与成长方向。引用星座只使用已有的本机结果。'],
  ['western', 'work', '火星 星座', '火星所在星座在当前规则中映射行动与投入方式，可用于讨论做事节奏和承担责任。'],
  ['western', 'bonds', '金星 星座', '金星所在星座在当前规则中映射亲近、欣赏和互动方式，可联系关系中的期待与表达。'],
  ['western', 'resources', '土星 星座', '土星所在星座在当前规则中映射结构与长期约束，适合讨论资源边界和长期安排。'],
  ['western', 'inner', '月亮 星座', '月亮所在星座在当前规则中映射习惯与恢复方式，适合联系真实生活中可观察的节奏。'],
];

export const topics = new Map(topicRows);
export const corpus = knowledgeRows.map(([method, topic, tags, text]) => ({
  id: 'knowledge-' + method + '-' + topic, topic, method, tags, text,
}));
