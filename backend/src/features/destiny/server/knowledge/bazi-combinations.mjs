import { baziExpansion } from './bazi-expansion.mjs';

const roleDetails = [
  ['peer', '比肩', '人际', '多方都希望按自己的办法推进', '说出各自能独立承担的部分', '保留一块能自行负责又便于同步的范围'],
  ['rival', '劫财', '财富', '多个用途需要争用同一份资源', '盘点哪些资源重叠、哪些用途必须保留', '约定共用额度和到期后的收回方式'],
  ['food', '食神', '生活', '已有做法开始形成稳定产出', '选一项可重复完成的小成果', '把其中做顺的一步整理成可重复用的方法'],
  ['output', '伤官', '性格', '已有标准与想尝试的做法不完全相容', '把真正不合用的步骤描述清楚', '用一个范围有限的改动验证替代办法'],
  ['wealth', '正财', '财富', '一项承诺需要明确的实际投入', '核对固定投入和可临时调整的成本', '用可核查的记录跟踪承诺是否仍承担得起'],
  ['opportunity', '偏财', '财富', '机会突然增多又难以逐个投入', '找出可以尝试而且容易收回的一项', '试一小轮后比较新增机会和原计划的取舍'],
  ['authority', '正官', '事业', '一项任务涉及明确职责和验收条件', '说清谁负责决定、谁负责交付', '把需要遵守的标准和仍能商量的方法分别写明'],
  ['pressure', '七杀', '情绪', '时间、要求或外部压力同时增加', '先定下必须优先处理的一件事', '为压力最高的步骤预留支援与重试办法'],
  ['resource', '正印', '学业', '做事之前需要可靠的方法和支持', '先找一个能复核的范例或说明', '用已有资料验证步骤，再判断哪里需要请教'],
  ['indirect', '偏印', '学业', '常用方法不足以说明新情况', '留出一种不同的观察路径', '用原问题中的反例检验新角度是否真正合用'],
];

const columns = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
const axes = [
  ['year', 'month', '较早形成的安排如何接到眼前的分工', '原先沿用的方式要接到当下的共同任务上'],
  ['year', 'hour', '既有安排与个人预留的调整空间', '已有安排又需要为之后的执行留出余地'],
  ['month', 'hour', '眼前的分工与实际执行方式', '当前任务要从分工转入各自落实'],
];

const previousPairs = new Set(baziExpansion
  .filter(({ id }) => id.startsWith('review-bazi-pair-'))
  .map(({ input }) => input.required.map(({ position, tenGod }) => position + ':' + tenGod).join('|')));

const roleSource = baziExpansion.find(({ id }) => id === 'review-bazi-food-year').source;
const peersSource = baziExpansion.find(({ id }) => id === 'review-bazi-peer-year').source;
const stemAt = (position, tenGod) => ({ kind: 'stem_ten_god', position, tenGod });

const stemPairs = axes.flatMap(([first, second, theme, situation]) =>
  roleDetails.flatMap(([aId, a, , cue, firstAction]) =>
    roleDetails.flatMap(([bId, b, topic, , , secondAction]) => {
      if (previousPairs.has(first + ':' + a + '|' + second + ':' + b)) return [];
      const peer = a === '比肩' || a === '劫财' || b === '比肩' || b === '劫财';
      return [{
        method: 'bazi', id: 'review-bazi-stem-link-' + first + '-' + second + '-' + aId + '-' + bId,
        tradition: '子平八字 · 双柱十神现代释义',
        input: { required: [stemAt(first, a), stemAt(second, b)], mustBeAbsent: [] },
        output: {
          topic,
          rule: columns[first] + '天干为' + a + '，' + columns[second] + '天干为' + b + '，用于观察' + theme + '。',
          reading: situation + '时，如果' + cue + '，可以先' + firstAction + '，然后' + secondAction + '。',
          limit: '两柱天干十神都须确认。情境是按相对日干的两种关系作出的原创释义，未断旺衰、成格或岁运。',
        },
        source: peer ? peersSource : roleSource,
      }];
    })));

// All ten stem relationships have been reproduced with every mark placement below.
const markPlacements = [
  ['noble', 'year', '原有联系可能提供协助', '遇到需要熟悉背景才能办的事'],
  ['noble', 'month', '眼前分工可以借助专业协作', '工作碰到一个超出当前经验的环节'],
  ['noble', 'day', '一对一沟通可能带来支持', '想找到可以直接商量的人'],
  ['noble', 'hour', '执行阶段可以预留支援', '后续执行暂时缺少一项具体支持'],
  ['travel', 'month', '变动影响当前分工', '工作地点、步骤或合作对象发生改变'],
  ['travel', 'hour', '移动或切换使执行顺序改变', '不同地点或日程需要反复转换'],
  ['lu', 'day', '已有的稳定条件可供取用', '面对需要持续一段时间的投入'],
  ['void', 'month', '当前计划仍有前提待落实', '准备推进的任务还有一项条件尚未明确'],
  ['void', 'day', '未证实的空缺可以单独核对', '必须在信息不完整的情况下先作初步判断'],
];
const stemPlacements = [
  ['year', '回看原先约定是否适用于眼前情境'],
  ['month', '把处理办法说给共同承担这项事的人听'],
  ['hour', '预留一项能在正式实施前复查的准备'],
];

const stemAndMark = markPlacements.flatMap(([markId, markPosition, theme, situation]) => {
  const base = baziExpansion.find(({ id }) => id === 'review-bazi-' + markId + '-' + markPosition);
  return stemPlacements.flatMap(([position, conclusion]) =>
    roleDetails.map(([roleId, role, topic, , action]) => ({
      method: 'bazi', id: 'review-bazi-mark-link-' + markId + '-' + markPosition + '-' + position + '-' + roleId,
      tradition: '子平八字 · 十神与神煞现代释义',
      input: { required: [stemAt(position, role), ...base.input.required], mustBeAbsent: [] },
      output: {
        topic,
        rule: columns[position] + '天干为' + role + '，' + base.output.rule + ' 两者合看时留意' + theme + '。',
        reading: situation + '时，可以' + action + '，随后' + conclusion + '。',
        limit: '神煞和天干十神必须同时出现在确认盘面。组合情境为原创观察角度，神煞的古法分支及吉凶应期不纳入。',
      },
      source: base.source,
    })));
});

export const baziCombinationRules = [...stemPairs, ...stemAndMark];
