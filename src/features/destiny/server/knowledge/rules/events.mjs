import { makeRule } from './rule.mjs';
import { sourcePassage } from '../sources/registry.mjs';

const star = (palace, name) => ({ kind: 'palace_star', palace, star: name, scope: 'origin' });
const branch = (position, value) => ({ kind: 'branch', position, branch: value });
const pillar = (position, ganZhi) => ({ kind: 'pillar', position, ganZhi });
const sign = (planet, value) => ({ kind: 'planet_sign', planet, sign: value });
const studyLimit = '属于本命的学习、写作或应试线索。采用盘面分支，未判全局冲克、岁运及具体成绩。';
const relationshipLimit = '只取本命伴侣互动的方向。其他星曜和现实相处条件会改变表现，未推断婚期、对象特征或婚姻次数。';

function event({ id, method, tradition, input, literals, source, topic, basis, reading, limit, normalizationNote }) {
  return makeRule({
    id, method, tradition, layer: 'events', input, source, topic, basis, reading, limit,
    ancestry: { literalConditions: literals, normalizedConditions: input, normalizationNote },
    originalTopic: topic === '爱情' ? '感情' : topic === '综合' ? '生活' : topic,
  });
}

const bazi = [
  ['jia-hai', { kind: 'stem', position: 'day', stem: '甲' }, [branch('month', '亥'), branch('hour', '亥')],
    '甲日，月支或时支见亥', '子平段把甲见亥列为取长生学堂的例子。',
    '持续投入一门课程或技艺后，可能出现把零散知识整理成完整作品的机会。'],
  ['yi-wu', { kind: 'stem', position: 'day', stem: '乙' }, [branch('month', '午'), branch('hour', '午')],
    '乙日，月支或时支见午', '子平段把乙见午与甲见亥并列，并允许月或时一位出现。',
    '如果现有学习能不断得到练习和检验，原本较零散的训练可能逐渐形成一个能评估的成果。'],
  ['ding-you', { kind: 'stem', position: 'day', stem: '丁' }, [branch('month', '酉'), branch('hour', '酉')],
    '丁日，月支或时支见酉', '子平段把丁日酉月或酉时作为天乙与读书文翰有关的例子。',
    '系统学习或写作投入较深时，可能有机会把做出来的东西交给他人评阅。'],
  ['jiyou-zi', pillar('year', '己酉'), ['丙子', '庚子'].flatMap((value) => [pillar('day', value), pillar('hour', value)]),
    '己酉年，日柱或时柱为丙子、庚子', '古籍以己酉人见丙子、庚子日時为学堂会贵的实例。',
    '专业学习进入考核或作品评审时，可能得到评阅者指点或认可。'],
  ['renwu-xinmao', pillar('year', '壬午'), [pillar('day', '辛卯'), pillar('hour', '辛卯')],
    '壬午年，日柱或时柱为辛卯', '古籍以壬午人见辛卯日時为学堂会贵的另一例。',
    '学习成果可能有机会借作品交流或正式评定被看见，反馈也可能给下一步训练指明方向。'],
].map(([key, anchor, options, condition, basis, reading]) => {
  const id = 'event-sanming-v3-' + key;
  return event({
    id, method: 'bazi', tradition: '子平八字 · 学堂词馆', topic: '学业',
    input: { required: [anchor], anyOf: options.map((fact) => [fact]) }, literals: [condition], basis, reading,
    source: sourcePassage('sanming', id, '卷三 · 论学堂词馆 · ' + condition, {
      id: 'sanming-tonghui-siku-v3', editionId: 'siku-wikisource-juan-03',
      url: 'https://zh.wikisource.org/wiki/三命通會_(四庫全書本)/卷03',
    }),
    normalizationNote: '日干直接取日柱。古籍实例中的「某人」依年柱归一化，日時按日柱或时柱任一出现匹配。',
    limit: studyLimit,
  });
});

const palaceEntries = [
  // Companion dynamics in the named spouse palace paragraph.
  ['夫妻', '紫微+天相', '三妻妾', '爱情', '夫妻段把同宫与相处的延续联系起来。', '关系进入需要长期磨合的阶段时，原先反复商量的相处方式可能渐渐稳定。'],
  ['夫妻', '武曲+天相', '三妻妾', '爱情', '天相段对同宫写的是和合程度有所减少。', '共同事务多起来时，可能在分工和做决定的方式上起摩擦，原先的相处约定需要重新谈。'],
  ['夫妻', '武曲+破军', '三妻妾', '爱情', '破军段把与武曲同宫列为亲密关系磨合压力较大的组合。', '外部安排改变时，关系可能有想靠近又暂时拉开距离的阶段，如何一起解决现实问题会影响后续相处。'],
  ['夫妻', '天机+巨门', '三妻妾', '爱情', '巨门段把天机同宫与配偶对日常事务的协助相联系。', '有要一起处理的事情时，可能逐步形成彼此分担的办法，让原先集中在一方的压力有所缓解。'],
  ['夫妻', '天同+太阴', '三妻妾', '爱情', '太阴段将与天同的组合联系到伴侣相助。', '生活遇到变化时，原先需要自己安排的一部分事务，可能在关系里得到实际照应。'],
  ['夫妻', '廉贞+天府', '三妻妾', '爱情', '廉贞段将天府同宫描述为有机会相处长久，并讲到性格较刚。', '关系可能在双方坚持各自做法的情况下持续下去，重要变化往往来自重新约定各自负责的事。'],
  ['夫妻', '廉贞+七杀', '三妻妾', '爱情', '廉贞、七杀段将该组合与关系压力及分离倾向相联系。', '相处承受的压力较大时，原先的见面或共同生活安排可能间歇中断，需要重新判断双方可以维持的节奏。'],
  ['夫妻', '紫微+破军', '三妻妾', '爱情', '紫微段将破军同宫写为亲密关系较易遇到摩擦。', '关系在明确新的承诺或日常安排之前，可能先遇到一轮较明显的分歧。'],
  ['夫妻', '文昌', '三妻妾', '爱情', '文昌段有伴侣相助的内容，并附加陷地与煞曜的限制。', '如果现实中的相处条件配合，共同事务有机会得到对方的协助，分担方式也可能变得更明确。'],
  ['夫妻', '天同', '三妻妾', '爱情', '天同段有成约较迟而关系能维持的方向，并列其他会合的变化。', '确定长期相处的安排可能会比预期多一轮磨合。相处规则逐渐形成后，关系更有机会保持稳定。'],
  ['夫妻', '破军', '三妻妾', '爱情', '破军本宫段直接提到两人分处或关系进退。', '见面或共同生活的节奏可能有一段受距离或安排牵制。能否继续，需要看双方如何处理这段变化。'],
  // Movement, changes in living arrangements and support networks.
  ['迁移', '紫微+天府', '七迁移', '综合', '同宫段把离开原有环境与外出进展顺畅联系起来。', '活动范围扩大时，原先需要在熟悉圈内才能办成的事，可能在新环境里找到可以接续的安排。'],
  ['迁移', '廉贞+天相', '七迁移', '综合', '廉贞段对天相同宫强调在变动中取得进展。', '留在原处迟迟不动的事，可能在换一处办或改变对接方式后出现推进的空间。'],
  ['迁移', '天同+巨门', '七迁移', '综合', '天同段对巨门同宫写到外出后多费心力。', '跨环境的安排可能发生几次沟通和调整，有些需要在当地协调的事项会比原先预期更费精力。'],
  ['迁移', '左辅', '七迁移', '综合', '左辅段将活动和得到外部扶持联系起来。', '走出熟悉的圈子以后，可能有其他人协助介绍合适的去处或接手一部分对接。'],
  ['迁移', '右弼', '七迁移', '综合', '右弼段提到在外有扶持，并列不同会合下的竞争。', '外出办事时，可能同时出现新的协作者和竞争关系，原先的推进方式需要随环境调整。'],
  ['田宅', '天机+太阴', '十田宅', '综合', '天机段将太阴同宫与自行形成居住条件联系起来。', '居住或共同使用空间的条件可能从自己逐步筹划、添置开始，慢慢形成稳定安排。'],
  ['田宅', '武曲+贪狼', '十田宅', '综合', '武曲段讲到置办条件较晚出现。', '改善或置办生活空间的安排可能先经过一段准备，等条件凑齐后再推进。'],
  // Work changes with a concrete institutional or activity context.
  ['官禄', '天同+巨门', '九官禄', '事业', '天同段对同宫的工作规模写为由小渐大。', '一项原先规模不大的工作可能逐渐扩大，随后带来更复杂的协调或交付范围。'],
  ['官禄', '太阳+巨门', '九官禄', '事业', '巨门段将同宫与工作上的进退变化联系起来，另论入庙。', '工作职责可能有先扩大再调整、或者不同阶段进展不一的情况，实际能维持多久要看团队条件。'],
  ['官禄', '廉贞+天相', '九官禄', '事业', '天相段写到廉贞同宫与职事权责相连，并有会煞的例外。', '需要明确权限的任务中，可能出现由你接手较正式职责的机会。'],
  ['官禄', '廉贞+破军', '九官禄', '事业', '破军段把廉贞同宫与某类岗位难以长期维持相联系。', '岗位或项目的职责范围可能在一段时间后重分配，开始时谈好的分工未必能一直沿用。'],
  ['迁移', '武曲+贪狼', '七迁移', '事业', '武曲段把贪狼同宫与对外经营联系起来。', '跨区域或跨团队对接中，可能出现把手头工作延伸到经营或交易环节的机会。'],
  // Resource movement, separate from disposition toward money.
  ['财帛', '紫微+天府', '五财帛', '财富', '紫微段强调同宫有持守和积累的趋势。', '已有资源有机会逐步变成能长期维持的储备，宜结合实际收支判断能留下多少。'],
  ['财帛', '天机+太阴', '五财帛', '财富', '太阴段以自行经营形成家计描述天机同宫。', '新的收入或可用资源可能主要由持续经营逐步形成，从小规模尝试累积出比较固定的渠道。'],
  ['财帛', '太阴+太阳', '五财帛', '财富', '太阴段将同宫描述为由少逐渐增多。', '起初可用的资源可能有限，稳定筹划与投入之后，能留存的部分才逐渐增加。'],
  ['财帛', '武曲+七杀', '五财帛', '财富', '武曲段将七杀同宫写为自己建立经营基础。', '一部分资源可能需要靠自己打开来源，经过持续经营后才逐渐形成较稳定的基础。'],
  ['财帛', '天同+天梁', '五财帛', '财富', '天梁段把天同同宫写作自立经营并改善基础。', '早期能依靠的资源可能不多，随后有机会靠重复有效的经营方式形成可维持的来源。'],
  ['财帛', '太阳+禄存', '五财帛', '财富', '太阳段把禄存同宫与操心经营后才有积累相联系。', '有机会通过经营增加可用资源，但收益可能依赖持续照看流程以及处理额外的运营事务。'],
  ['财帛', '天机', '五财帛', '财富', '天机段描述反复筹划才有财源。', '资源或收益来源可能需要多次调整方案才逐步成形，原先一次就能落实的预期也可能变动。'],
];

const ziwei = palaceEntries.map(([palace, names, section, topic, basis, reading]) => {
  const id = 'event-ziwei-v2-' + palace + '-' + names;
  const required = names.split('+').map((name) => star(palace, name));
  const input = { required, ...(required.length === 2 && {
    relations: [{ type: 'same_palace', first: required[0], second: required[1] }],
  }) };
  return event({
    id, method: 'ziwei', tradition: '紫微斗数 · 本命星宫', input, literals: [palace + '宫', names], topic, basis, reading,
    source: sourcePassage('ziwei', id, '卷二 · ' + section + ' · ' + names + '分支'),
    normalizationNote: '按原文对应宫位，将双星条件归一为同宫的本命星曜。',
    limit: topic === '爱情' ? relationshipLimit : '仅讨论本命宫与星曜给出的事件线索。其他会照、旺陷及运限会修饰表现，未推断金额或发生时间。',
  });
});

const ziweiStudy = [
  ['wenchang-ming', [star('命宫', '文昌')], '诸星问答论 · 问文昌星所主若何', '文昌守身命段把这颗星与科名、学业成果受到认可联系起来。', '掌握的知识可能在正式考核、作品评阅或展示中得到认可。'],
  ['wenqu-ming', [star('命宫', '文曲')], '诸星问答论 · 问文曲星所主若何', '文曲守身命段联系科第与文墨，同时另论凶曜和宫位条件。', '系统整理的文字或表达成果可能进入正式遴选、答辩或其他需要检验表达的场合。'],
  ['huake-ming', [{ kind: 'palace_mutagen', palace: '命宫', change: '科', scope: 'origin' }], '诸星问答论 · 问化科星所主若何', '化科段以应试与文墨解释，并把身命宫作为一类适用位置。', '如果你有持续的写作、训练或备考，阶段成果可能有机会成为正式评阅的材料。'],
  ['taiyin-wenqu-love', [star('夫妻', '太阴'), star('夫妻', '文曲')], '斗数发微论 · 太阴合文曲于妻宫', '原文把妻宫太阴文曲组合与文业、科名相联。',
    '长期文字或专业训练形成成果后，可能有机会在一次正式评价中被看见。'],
].map(([key, required, locator, basis, reading]) => {
  const id = 'event-ziwei-v1-' + key;
  return event({
    id, method: 'ziwei', tradition: '紫微斗数 · 本命星宫', topic: '学业',
    input: { required }, literals: required.map(({ palace, star: name, change }) => palace + '见' + (name ?? '化' + change)),
    source: sourcePassage('ziwei', id, '卷一 · ' + locator, {
      id: 'ziwei-doushu-quanshu-v1', editionId: 'ziwei-wikisource-juan-01',
      url: 'https://zh.wikisource.org/zh-hans/紫微斗數全書/卷一',
    }), basis, reading, limit: studyLimit,
    normalizationNote: '只匹配本命。四化直接读取当前排盘引擎的本命星曜变化。命宫条件是原文身命分支的一部分。',
  });
});

const moons = [
  ['白羊座', 'Aries', '事业', '原文提到独立开拓和承担带领事务的机会。', '新任务缺少既定做法时，可能有人请你率先试起来，随后再逐渐形成明确的工作责任。'],
  ['金牛座', 'Taurus', '财富', '原典将该落座与积累财物和不动产主题联系起来。', '长期储蓄或经营进入能实际落实的阶段时，可能出现配置或改善长期使用资源的机会。'],
  ['双子座', 'Gemini', '学业', '原文把读书、文学和可被采用的表达技能放在同一段讨论。', '学习或写作的产出可能有机会被用于讲解、整理材料或其他实际任务。'],
  ['巨蟹座', 'Cancer', '综合', '原文把居住、家庭环境及房屋主题与该落座关联。', '生活安排有变动时，可能出现重新选择住处或改善家中使用空间的机会。'],
  ['狮子座', 'Leo', '爱情', '原文明确提到恋爱投入和容易受到恋爱对象注意。', '已有互动逐渐增多时，可能出现双方更愿意表明好感、让关系从试探进入明确相处的机会。'],
  ['天秤座', 'Libra', '综合', '原文将许多生活变化与结伴及合作联系起来。', '一些原本由个人推进的事务可能逐渐变成共同安排，后续改变也会受合作者的选择影响。'],
  ['天蝎座', 'Scorpio', '爱情', '原典在关系段并列吸引力和伴侣之间的不和。', '亲密关系中可能先有较强吸引，之后又需要处理双方坚持的做法所带来的摩擦。'],
  ['射手座', 'Sagittarius', '综合', '原文明确讨论出行和住所变化。', '活动地点可能在某段时间变得更分散，安排出行或改变居住方式的需求也可能随之出现。'],
  ['水瓶座', 'Aquarius', '学业', '原文提到通过同好组织参与教育或科学事务。', '课题、读书或研究兴趣可能让你接触同好组织，并有机会参与共同学习或研究活动。'],
];

const pairs = [
  ['天秤座', '白羊座', 'Libra', 'Aries', '爱情', '原文把理想期待与亲密关系难以协调联系起来。', '关系进入共享日常安排时，原先没有说清的期待可能变成具体分歧，双方需要重新商量各自能接受的范围。'],
  ['天秤座', '金牛座', 'Libra', 'Taurus', '财富', '原文指出共同经营中的资源收益。', '长期合作或共同生活的安排中，可能出现资源互相补足的机会，是否能形成积累取决于双方规则。'],
  ['天蝎座', '巨蟹座', 'Scorpio', 'Cancer', '爱情', '原文把较强的依恋与正式确立关系的方向相联。', '一段联系可能从反复确认对方的态度，逐渐转向讨论是否维持更长期的相处安排。'],
  ['天蝎座', '狮子座', 'Scorpio', 'Leo', '爱情', '原文将强烈情感与关系压力并陈。', '关系快速靠近之后，投入节奏不同可能成为要面对的分歧，后续取决于双方怎么协调。'],
  ['摩羯座', '狮子座', 'Capricorn', 'Leo', '爱情', '原文将事业抱负与亲密关系表达之间的张力和结合机会并列。', '工作投入增多时，原有的相处安排可能要重新协调，明确双方可持续投入的时间后才更容易稳定。'],
  ['水瓶座', '天秤座', 'Aquarius', 'Libra', '爱情', '原文明确给出伴侣关系较易建立的判断。', '已经有共同生活方向的关系，可能有机会进一步商定承诺或更稳定的相处方式。'],
  ['双子座', '金牛座', 'Gemini', 'Taurus', '财富', '原典把文学事务与资源收益联系起来。', '写作、编辑或文档整理可能从单纯练习转为实际委托，回报取决于成果是否被采用。'],
  ['双子座', '巨蟹座', 'Gemini', 'Cancer', '综合', '原文明确提到出行和公共事务的活动。', '行程或活动地点可能因为一项公共事务而变得更频繁，原先固定的日常安排也可能随之调整。'],
  ['双子座', '天秤座', 'Gemini', 'Libra', '学业', '原文并提学习、公开写作与作品受到关注。', '一段学习积累可能进入公开文字交流或作品展示，让成果有机会收到读者的反馈。'],
  ['天秤座', '狮子座', 'Libra', 'Leo', '学业', '原文明确说艺术方面存在获得发展的机会。', '诗歌、音乐或其他艺术练习有机会进入可以得到展示和继续训练的场合。'],
  ['天蝎座', '双子座', 'Scorpio', 'Gemini', '事业', '原文将配置与写评论及评析作品的工作联系起来。', '在需要检查材料或评析作品的项目中，可能有机会接手负责比较、审阅或撰写反馈的角色。'],
  ['摩羯座', '金牛座', 'Capricorn', 'Taurus', '财富', '原文直接讨论实际经营和积累财富。', '持续经营的事务可能逐步形成可以长期保留的结果，短期回报仍取决于实际收支。'],
  ['摩羯座', '双子座', 'Capricorn', 'Gemini', '学业', '原文把持续学习与科学写作、公开表达联系起来。', '深入学习的成果可能有机会转成研究性文字、演讲或其他面向读者的交流材料。'],
  ['摩羯座', '处女座', 'Capricorn', 'Virgo', '事业', '原典把分析判断与文字工作联系起来。', '需要仔细判断材料的任务中，可能出现接手长文整理、编辑或内容校核的机会。'],
  ['水瓶座', '摩羯座', 'Aquarius', 'Capricorn', '事业', '原文把责任扩展与朋友提供帮助联系起来。', '新职责可能经由朋友或同事的介绍向你打开，后续是否接得住仍取决于现实配合。'],
];

function westernEvent({ required, locator, topic, basis, reading, pair = false }) {
  const id = 'event-leo-1899-' + (pair ? 'pair-' : 'moon-') + required.map(({ sign: value }) => value).join('-');
  return event({
    id, method: 'western', tradition: 'Alan Leo 近代西方占星', input: { required }, topic, basis, reading,
    literals: required.map(({ planet, sign: value }) => (planet === 'Moon' ? '月亮' : '太阳') + '在' + value),
    source: sourcePassage('leo', id, locator, pair ? {
      url: 'https://umbrielastrology.com/library/alan-leo-sun-moon-combinations.html',
    } : {}),
    normalizationNote: '只取原文明确提供的本命落座条件，按热带黄道匹配。',
    limit: topic === '爱情' ? relationshipLimit : '根据本命落座章节的生活线索，实际机会仍要结合现实条件。未看宫位、行运或发生时间。',
  });
}

const western = [
  ...moons.map(([value, name, topic, basis, reading]) => westernEvent({
    required: [sign('Moon', value)], locator: '第 XVII 章 · The Moon in ' + name, topic, basis, reading,
  })),
  ...pairs.map(([sun, moon, sunName, moonName, topic, basis, reading]) => westernEvent({
    required: [sign('Sun', sun), sign('Moon', moon)], pair: true,
    locator: '第 XVIII 章 · The Sun in ' + sunName + ' and Moon in ' + moonName, topic, basis, reading,
  })),
];

export const eventExpansion = [...bazi, ...ziwei, ...ziweiStudy, ...western];
