import type { AtomicRule, TopicMapping, Predicate, Topic, Rulebook, CatalogItem, ActionCategory, Condition } from '../model/interpretation';

const periods = ['year', 'month', 'week', 'day'] as const;
const research = { reviewStatus: 'draft', sourceIds: ['fortune-v1-design'] } as const;
const original = { reviewStatus: 'draft', sourceIds: ['fortune-original-actions'] } as const;
const eq = (field: string, value: string): Predicate => ({ field, eq: value });
const payload = (field: string, value: string) => eq('normalizedPayload.' + field, value);
const subject = (id: string): Predicate => ({ field: 'subjectIds', includes: id });
const rules: AtomicRule[] = [];
const mappings: TopicMapping[] = [];

function add(key: string, method: AtomicRule['method'], factTypes: string[], summary: string,
  topics: Topic[], options: Partial<Pick<AtomicRule, 'required' | 'supporting' | 'inhibiting' | 'exclusions' | 'scopes' | 'limitations' | 'allowPartial' | 'priority' | 'version'>> & {
    trigger?: Predicate[]; direction?: AtomicRule['meaning']['direction']; strength?: TopicMapping['strength'];
  } = {}) {
  const { trigger = [], direction = 'neutral', strength = 'weak', ...conditions } = options;
  rules.push({ ...research, sourceIds: [...research.sourceIds], ruleId: key, version: '1', method,
    tradition: { bazi: '子平八字', ziwei: '紫微斗数', western: '热带黄道占星' }[method],
    factTypes, periods: [...periods], allowPartial: false, trigger, required: [], supporting: [], inhibiting: [],
    exclusions: [], meaning: { key, direction, summary }, priority: 1,
    limitations: ['传统术数主题线索，须结合实际情况。'], ...conditions });
  for (const topicId of topics) mappings.push({ ...research, sourceIds: [...research.sourceIds],
    mappingId: key + ':' + topicId, version: '1', method, interpretationKey: key, topicId,
    strength, allowedDirections: [direction] });
}

const tenGods: [string, string, string, Topic[]][] = [
  ['peer', '比肩', '观察自主分工和同辈合作时的边界。', ['cooperation', 'action']],
  ['shared-cost', '劫财', '把共同投入、权限与分摊方式摆到桌面。', ['cooperation', 'spending']],
  ['output', '食神', '留意可以表达、试做或完成小样的安排。', ['action', 'career']],
  ['innovation', '伤官', '尝试新做法时，核实既有规则与交付边界。', ['career', 'action']],
  ['regular-income', '正财', '复核固定收支、账期和可承担的责任。', ['regular_income', 'wealth']],
  ['outside-resources', '偏财', '核对临时合作、额外投入与退出条件。', ['windfall', 'wealth']],
  ['responsibility', '正官', '梳理职责、约定和完成标准。', ['career']],
  ['execution', '七杀', '厘清紧迫事项的优先级与可用资源。', ['career', 'action']],
  ['study-support', '正印', '梳理学习资料和可用支持。', ['learning']],
  ['research', '偏印', '为需要深入研究的议题留出独立时间。', ['learning']],
];
for (const [key, value, summary, topics] of tenGods) {
  const context = { id: 'hidden-' + key, factType: 'hidden_stem_ten_god', where: [payload('tenGod', value)],
    sharedSubject: 'candidate', sameScope: true };
  add('bazi.' + key, 'bazi', ['ten_god'], summary, topics, { trigger: [payload('tenGod', value)],
    strength: 'conditional', required: [context], priority: 2 });
  add('bazi.hidden.' + key, 'bazi', ['hidden_stem_ten_god'], summary, topics, { trigger: [payload('tenGod', value)] });
}

const baziFocus: [string, Topic, string][] = [
  ['比肩', 'cooperation', '一起做事前，可以先说清各自负责哪一部分，给独立完成的事项留出时间。'],
  ['劫财', 'cooperation', '如果和别人共用时间或资源，可以先约定各自承担什么、什么时候再确认。'],
  ['食神', 'action', '手头有想法的话，可以先做个小样，看看哪一部分最值得继续。'],
  ['伤官', 'action', '如果想换个做法，可以先挑一个容易调整的环节试一试。'],
  ['正财', 'spending', '这段时间的财务重点偏向固定收入和已安排的支出，账单和付款日期值得留意。'],
  ['偏财', 'spending', '这段时间的财务变数更可能出现在临时邀约和额外开销上，能否带来收益仍取决于具体条件。'],
  ['正官', 'career', '选一件手头的工作，先写清谁负责、要做到什么程度、什么时候确认。'],
  ['七杀', 'action', '几件事同时催得紧时，可以选出一件必须先处理的，把其余事项重新排一下。'],
  ['正印', 'learning', '遇到不太熟悉的问题，可以先整理手边已有的资料，找出最需要问清的一点。'],
  ['偏印', 'learning', '可以留一段少受打扰的时间，专心弄清一个一直没来得及细想的问题。'],
];
for (const [tenGod, topic, summary] of baziFocus) {
  add('focus.bazi.' + tenGod, 'bazi', ['ten_god'], summary, [topic], { trigger: [payload('tenGod', tenGod)] });
}
const relations: [string, string][] = [
  ['stem_combine', '关注相关柱位间的牵连，合化仍需其他条件。'],
  ['stem_clash', '关注相互制约的安排。'],
  ['branch_combine', '查看现有安排能否协调起来。'],
  ['branch_clash', '预留调整分工或节奏的空间。'],
  ['branch_punishment', '识别反复需要处理的结构。'],
  ['branch_harm', '复核容易遗漏的实际条件。'],
  ['branch_break', '复核原有约定的维护与调整。'],
  ['three_combinations', '观察三个地支共同出现所指向的结构。'],
  ['three_meetings', '观察季节性结构的集中程度。'],
  ['generating', '记录参与柱位之间的生助方向。'],
  ['controlling', '记录参与柱位之间的制约方向。'],
];
for (const [type, summary] of relations) {
  add('bazi.' + type + '.day', 'bazi', [type], summary, ['relationship_stability', 'relationship_communication'],
    { trigger: [subject('natal:day')] });
  add('bazi.' + type + '.month', 'bazi', [type], summary, ['career', 'change'], { trigger: [subject('natal:month')] });
}
add('bazi.luck-context', 'bazi', ['branch_combine', 'branch_clash', 'generating', 'controlling'],
  '保留大运与本期柱位的条件关系，供核对顺逆口径。', ['change'],
  { trigger: [subject('decadal')], allowPartial: true, limitations: ['正式起运尚未确认。'] });

const palaceTopics: [string, Topic[], string][] = [
  ['命宫', ['action'], '选一件自己能推进的事，先定一个小目标。'],
  ['兄弟', ['cooperation'], '有事需要和熟人一起办，可以先说清各自负责什么。'],
  ['夫妻', ['romance', 'relationship_communication'], '想和在意的人商量一件事时，可以先听听彼此的想法。'],
  ['子女', ['action', 'family'], '给家里正在进行的事留出一段能一起投入的时间。'],
  ['财帛', ['wealth', 'spending'], '把已确定的收入、支出和账期对一遍，再决定接下来的安排。'],
  ['疾厄', ['health_routine'], '看看有没有可以放慢的安排，给休息留出时间。'],
  ['迁移', ['change'], '遇到新的安排，可以先试一个小步骤，再决定要不要继续。'],
  ['交友', ['social_opportunity', 'cooperation'], '可以跟进一段正在进行的交流，问清有没有可一起做的事。'],
  ['官禄', ['career'], '先把最重要的一项工作说清楚，包括要做成什么样、什么时候完成。'],
  ['田宅', ['family'], '如果家里有事需要协调，可以先商量一件具体的安排。'],
  ['福德', ['rest', 'emotional_state'], '在忙碌的安排之间留一点空，让自己有时间缓一缓。'],
  ['父母', ['family', 'learning'], '遇到不熟悉的事，可以问问有经验的人，记下能用的建议。'],
];
const ziweiContext: Condition = { id: 'same-layer-transformation', factType: 'transformation', where: [],
  sharedSubject: 'candidate', sameScope: true,
  link: { field: 'normalizedPayload.natalPalaceIndices', from: 'normalizedPayload.index', operator: 'includes' } };
const hasTriad: Predicate = { field: 'normalizedPayload.triadIndices.length', eq: 2 };
for (const [palace, topics, summary] of palaceTopics) {
  const key = 'ziwei.palace.' + palace;
  add(key, 'ziwei', ['palace_mapping'], summary, topics,
    { trigger: [payload('flowName', '命宫'), payload('natalName', palace), hasTriad],
      strength: 'conditional', required: [ziweiContext], priority: 3, version: '2' });
}
add('context.ziwei.romance', 'ziwei', ['palace_mapping'],
  '这段时间感情上的关注点偏向相处节奏。已有互动时，关系能否推进可以从双方愿意投入的时间来观察。', ['romance'],
  { trigger: [payload('flowName', '命宫'), payload('natalName', '夫妻'), hasTriad] });
for (const [kind, meaning, topics] of [
  ['禄', '记录该层所关注的资源与连接。', ['wealth', 'cooperation']],
  ['权', '关注该层的职责、推动与分工。', ['career', 'action']],
  ['科', '关注说明、整理和表达的安排。', ['learning', 'relationship_communication']],
  ['忌', '关注该层需要反复核对的问题。', ['rest', 'change']],
] as [string, string, Topic[]][]) {
  add('ziwei.transformation.' + kind, 'ziwei', ['transformation'], meaning, topics,
    { trigger: [payload('kind', kind), { field: 'normalizedPayload.placements.length', oneOf: [1, 2, 3, 4] }],
      scopes: ['decadal', 'yearly', 'monthly', 'daily'] });
}

const planetTopics: Record<string, Topic[]> = {
  Sun: ['action', 'career'], Moon: ['emotional_state', 'rest', 'health_routine'],
  Mercury: ['learning', 'relationship_communication'], Venus: ['relationship_communication', 'spending'],
  Mars: ['action', 'change'], Jupiter: ['learning', 'career'], Saturn: ['career', 'action'],
  Uranus: ['change'], Neptune: ['emotional_state'], Pluto: ['change', 'cooperation'],
};
const aspectWords: Record<string, string> = {
  conjunction: '先聚焦议题本身，再看相关背景。', sextile: '查看已有安排中是否有可利用的协调条件。',
  trine: '查看哪些安排已有衔接空间。', square: '给需要协调的部分多留一步复核。',
  opposition: '分别写下两边的需要和取舍。',
};
for (const [body, topics] of Object.entries(planetTopics)) {
  for (const [aspect, summary] of Object.entries(aspectWords)) {
    add('western.' + body + '.' + aspect, 'western', ['aspect_interval'], summary, topics,
      { trigger: [payload('transitBody', body), payload('aspectType', aspect),
        { field: 'normalizedPayload.orb', lte: 3 },
        { field: 'normalizedPayload.natalTargetType', oneOf: ['planet', 'angle'] }] });
  }
}

for (const [body, topic, summary] of [
  ['Moon', 'rest', '可以在相邻的安排之间留一点空，忙完一件事再进入下一件。'],
  ['Mercury', 'relationship_communication', '有件事需要商量时，可以先把问题说具体，最后确认彼此理解的下一步。'],
  ['Mars', 'action', '可以挑一个可在短时间内完成的步骤动手，做完再调整后续安排。'],
  ['Saturn', 'career', '可以查一查手头的承诺有没有遗漏的截止时间，及早和相关的人确认。'],
] as [string, Topic, string][]) {
  add('focus.western.' + body, 'western', ['aspect_interval'], summary, [topic], {
    trigger: [payload('transitBody', body), payload('natalTargetType', 'planet'), { field: 'normalizedPayload.orb', lte: 3 }],
  });
}
for (const [key, types, direction] of [
  ['ease', ['sextile', 'trine'], 'supportive'], ['tension', ['square', 'opposition'], 'challenging'],
] as const) {
  add('western.venus.' + key, 'western', ['aspect_interval'], direction === 'supportive'
    ? '互动有可尝试的空间，可以从小而具体的沟通开始。'
    : '先核对对话双方的预期，给关系安排留出确认时间。', ['romance', 'relationship_communication'], {
    trigger: [payload('transitBody', 'Venus'), { field: 'normalizedPayload.natalTargetId', oneOf: ['Venus', 'Moon'] },
      { field: 'normalizedPayload.aspectType', oneOf: [...types] }, { field: 'normalizedPayload.orb', lte: 3 }],
    required: [{ id: 'related-house', factType: 'house_interval', sharedSubject: 'Venus',
      where: [{ field: 'normalizedPayload.natalHouse', oneOf: [5, 7] }] }],
    inhibiting: [{ id: 'station', factType: 'station', sharedSubject: 'Venus', where: [] }],
    strength: 'direct', direction, priority: 4,
  });
}
add('context.western.romance', 'western', ['aspect_interval'],
  '这段时间可能更在意交流时的熟悉感和回应。已有互动时，双方是否都愿意把话题继续下去，比一次聊得投机更能说明进展。', ['romance'], {
    trigger: [payload('transitBody', 'Venus'), payload('natalTargetType', 'planet'),
      { field: 'normalizedPayload.natalTargetId', oneOf: ['Venus', 'Moon'] }, { field: 'normalizedPayload.orb', lte: 3 }],
  });
const houses: Topic[] = ['action', 'wealth', 'learning', 'family', 'romance', 'health_routine',
  'relationship_communication', 'cooperation', 'learning', 'career', 'social_opportunity', 'rest'];
houses.forEach((topic, index) => add('western.house.' + (index + 1), 'western', ['house_interval'],
  '把本命整宫行运作为该主题的背景线索。', [topic],
  { trigger: [{ field: 'normalizedPayload.natalHouse', eq: index + 1 }] }));

const actionText: [Topic, string, string, string, string, string][] = [
  ['wealth', '列出确定的收入与账期', '金额或条款没核对前先缓一步', '在桌边留一处专放账单和合同', '核对一笔已经安排的支出', '记下一个还待核实的数字'],
  ['romance', '找一个适合双方的沟通时段', '先避免替对方下结论', '找一处便于平静交谈的空间', '就一件小事表达自己的预期', '写下一条双方已经确认的共识'],
  ['career', '把一件工作拆成可检查的交付', '工时和依赖未确认前先别答应新期限', '收起与当前交付无关的工作材料', '确认一位协作者的下一步', '记录一个可以改进的安排'],
  ['learning', '选一份资料并确定要回答的问题', '暂缓一次性囤积用不上的资料', '把当前需要的材料放到手边', '完成一轮小范围查证', '记下仍未弄清的一个问题'],
  ['social_opportunity', '跟进一次已开始的交流', '给尚未确认的邀约留出调整空间', '安排一个便于交谈的位置', '向对方核对下一步', '记下一项可继续联系的话题'],
  ['rest', '给连着的安排之间预留缓冲', '少排一件可以延后的事', '留一处方便短暂停歇的位置', '留十分钟安静休息', '记下一个能帮自己放缓的安排'],
];
const categories: ActionCategory[] = ['yi', 'ji', 'environment', 'behavior', 'ritual'];
const catalog: CatalogItem[] = [];
const actions: Rulebook['actions'] = [];
for (const [topic, ...texts] of actionText) categories.forEach((category, index) => {
  const itemId = topic + ':' + category;
  const usage = texts[index];
  catalog.push({ ...original, sourceIds: [...original.sourceIds], itemId, category, title: usage, usage,
    periodUsage: { year: '选一个能每月复盘的时间。' + usage + '。', month: '选本月一个阶段。' + usage + '。',
      week: '安排在本周一个可调整的时段。' + usage + '。', day: '今天先从一件小事做起。' + usage + '。' },
    costLevel: 'free', safetyTags: ['可自愿选择', '日常低风险'] });
  actions.push({ ...original, sourceIds: [...original.sourceIds], ruleId: 'action:' + itemId, version: '1', topicId: topic,
    interpretationKeys: mappings.filter(item => item.topicId === topic && item.strength !== 'weak')
      .map(item => item.interpretationKey), itemId, applicablePeriods: [...periods],
    rationale: '以该主题的有效证据为提示，选择可调整的日常行动。', limitations: ['结合当前实际安排。'] });
});

export const builtinFortuneRulebook: Rulebook = {
  version: 'fortune-interpretation-builtin-v2', mappingVersion: 'fortune-mapping-v2',
  actionVersion: 'fortune-actions-v1', catalogVersion: 'fortune-remedies-v1',
  sources: [
    { sourceId: 'fortune-v1-design', title: '玄玄运势解读层 V1 实施规范', type: 'research_note',
      licenseStatus: 'unknown', allowedUse: 'internal_research', locator: '用户提供的规范第 6–13 节，语义草案' },
    { sourceId: 'fortune-original-actions', title: '玄玄原创低成本行动说明', type: 'research_note',
      licenseStatus: 'unknown', allowedUse: 'internal_research', locator: '运势模块 V1 草案' },
  ], rules, mappings, actions, catalog,
};
