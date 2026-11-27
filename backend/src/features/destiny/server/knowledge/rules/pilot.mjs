import { makeRule } from './rule.mjs';
import { sourcePassage } from '../sources/registry.mjs';

const pillar = (position, ganZhi) => ({ kind: 'pillar', position, ganZhi });
const month = (branch) => ({ kind: 'branch', position: 'month', branch });
const star = (palace, name) => ({ kind: 'palace_star', palace, star: name, scope: 'origin' });

const bazi = [
  ['甲辰', '丙寅', '戌', '事业', '该月分支把职事联系到风宪。', '承担审查或监督的场景出现时，工作可能逐渐转向核对标准和纠正偏差。'],
  ['甲辰', '丙寅', '酉', '事业', '该月分支提到正式职事受到认可。', '有清晰职责与评核标准的岗位，可能更容易成为你获得正式认可的渠道。'],
  ['甲申', '丙寅', '未', '财富', '原文将未月单列为财库分支。', '现有资源可能逐渐从零散进出转向可以留存的储备。'],
  ['甲戌', '庚午', '辰戌', '综合', '辰、戌两个月份都写到性情敦厚。', '遇到需要持久协调的问题时，处理方式往往稳重而克制。', 'personality'],
  ['甲子', '辛未', '辰戌丑未巳酉', '事业', '此组土金月份涉及文职声望。', '书面处理或整理制度的成果，可能更有机会在工作中得到正式认可。'],
  ['甲寅', '辛未', '寅申', '事业', '寅、申月分支谈到承担职事。', '职责有空缺时，可能有机会被交付更正式的分工。'],
  ['甲辰', '辛未', '辰戌丑未', '财富', '原文单列四个土支月份并联系积累。', '资源有机会随持续经营逐步累积，尤其是在能持续保留成果的安排里。'],
  ['甲申', '辛未', '子丑', '事业', '子、丑月有单独的职事判断。', '正式分工或评价中，已有成果可能得到更多认可。'],
  ['甲辰', '乙亥', '酉', '事业', '酉月明确按正官分支表述。', '当岗位按明确规则分工时，你可能有机会从执行具体任务进入更正式的责任范围。'],
  ['甲戌', '乙亥', '巳午未', '财富', '夏生分支并列付出较多及积累不易。', '即使投入增加，手头资源也可能因周转和持续支出而难以留下。'],
].map(([day, hour, months, topic, basis, reading, layer = 'events']) => {
  const id = 'pilot-sanming-v8-' + day + '-' + hour + '-' + months;
  const branches = [...months];
  const required = [pillar('day', day), pillar('hour', hour)];
  if (branches.length === 1) required.push(month(months));
  const input = { required, anyOf: branches.length > 1 ? branches.map((branch) => [month(branch)]) : [] };
  return makeRule({
    id, method: 'bazi', layer, tradition: '子平八字 · 日时分支', input, topic, basis, reading,
    source: sourcePassage('sanming', id, '卷八 · 六甲日' + hour + '时断 · ' + day + '日条'),
    ancestry: {
      literalConditions: [day + '日', hour + '时', day === '甲戌' && hour === '乙亥' ? '夏生' : months + '月分支'],
      normalizedConditions: input, normalizationNote: '以节气月令取月支，夏生按巳、午、未。候选月支任一成立即可。',
    },
    limit: '仅限原书所列日时月分支。原文其他年月、行运和格局分支另判，未据此确定职级、收入或时间。',
  });
});

const ziwei = [
  ['财帛', '天机+巨门', '五财帛', '财富', '原文把此同宫的求取放在交涉较多的环境。', '新的资源渠道可能伴随较多沟通和反复确认，取得和结算未必同步。'],
  ['财帛', '天机+天梁', '五财帛', '财富', '会合段落联系谋划所得，也提到更改安排才有积累。', '原来收益有限的安排可能需要转向，改变用途或经营方式后才比较容易持续。'],
  ['财帛', '武曲+破军', '五财帛', '财富', '武曲条描述往来周转以及由缺到有。', '资源来源可能先经历流动和重整，之后才逐渐形成手头能持续运用的基础。'],
  ['财帛', '廉贞+贪狼', '五财帛', '财富', '同宫条同时谈到快速得失。', '资源可能在一段扩张中增加，也可能随支出或条件变化很快回落。'],
  ['田宅', '天同+天梁', '十田宅', '综合', '同宫条把居住基础描述为先退后进。', '眼下的住处或共同空间安排可能先收缩或暂缓，随后才逐渐恢复可持续的条件。'],
  ['田宅', '廉贞+天相', '十田宅', '综合', '同宫条将基础视为由缺渐成。', '共同生活的空间可能需要从零规划，原本没有现成安排的部分逐步落实。'],
  ['迁移', '天同', '七迁移', '综合', '天同条把进入外部环境和获得扶持联系起来。', '换到新环境时，可能有熟悉当地做法的人提供引介或协助。'],
  ['迁移', '天梁', '七迁移', '事业', '天梁条把外出和有人扶助成事联系起来。', '跨团队或离开熟悉环境工作时，可能遇到愿意帮你接通流程的人。'],
  ['夫妻', '紫微+天府', '三妻妾', '爱情', '同宫条着眼于关系的延续。', '双方愿意长期维持共同安排时，关系可能逐渐稳定下来。'],
  ['夫妻', '天同+天梁', '三妻妾', '爱情', '相关星曜段把相处写为和缓。', '相处中遇到意见不一时，可能出现让争执缓下来、重新协商生活安排的机会。'],
].map(([palace, names, section, topic, basis, reading]) => {
  const id = 'pilot-ziwei-v2-' + palace + '-' + names;
  const stars = names.split('+').map((name) => star(palace, name));
  const input = { required: stars, relations: stars.length === 2 ? [{ type: 'same_palace', first: stars[0], second: stars[1] }] : [] };
  return makeRule({
    id, method: 'ziwei', layer: 'events', tradition: '紫微斗数 · 本命星宫', input, topic, basis, reading,
    source: sourcePassage('ziwei', id, '卷二 · ' + section + ' · ' + names.split('+')[0] + '段'),
    ancestry: { literalConditions: [palace + '宫', names], normalizedConditions: input,
      normalizationNote: '宫名沿用 iztro，书中妻妾宫对应本命夫妻宫，同宫须确认两颗本命星。' },
    limit: '仅取本命星宫条的外部变化。庙陷、加会、冲破和限运需另行核对，不能据此定时间、金额或关系结果。',
  });
});

const western = [
  ['aries', '白羊座', 'Aries', '综合', '强调冲劲、自主与容易一时急进。', '遇到停滞时，你可能更愿意直接动手另试一种办法，行动较快时也容易少留核对余地。'],
  ['taurus', '金牛座', 'Taurus', '综合', '强调平稳、坚持和抵触外力带来的改变。', '已经熟悉的做法能让你稳定投入。旁人提议改变时，你可能会先看原方法还能不能继续。'],
  ['gemini', '双子座', 'Gemini', '学业', '强调阅读、求知及兴趣容易转换。', '你可能靠阅读和接触不同题材保持兴趣。方向太多时，持续完成一项往往需要多花一点心力。'],
  ['cancer', '巨蟹座', 'Cancer', '综合', '重视熟悉的环境，也容易感受到周围人情绪。', '在熟悉的环境里，你更容易放松。换个场合时，常会先感受他人的状态，再调整自己的回应。'],
  ['leo', '狮子座', 'Leo', '事业', '描写乐于承担责任及在公开场合表现。', '工作需要有人公开说明方向或出面负责时，你可能愿意承担这个角色，也在意自己的投入能否被看见。'],
  ['virgo', '处女座', 'Virgo', '学业', '强调记忆、学习和低调做事。', '面对要记住的材料时，你可能习惯静下来梳理并复习，再在真正用到时把掌握的内容拿出来。'],
  ['libra', '天秤座', 'Libra', '综合', '强调结伴合作，也容易受到合作者影响。', '有机会结伴做事时，你倾向与对方合计；如果关系很紧密，也容易让对方的意见影响自己的取舍。'],
  ['scorpio', '天蝎座', 'Scorpio', '综合', '强调坚决自主及对外界施加改变的抗拒。', '别人催你改方向时，你可能仍坚持原判断；一旦理由来自自己，你反而能下决心做大调整。'],
  ['sagittarius', '射手座', 'Sagittarius', '学业', '强调节奏快、活动取向以及向人讲解的倾向。', '遇到感兴趣的问题，你可能更喜欢尽快试起来，再通过给别人讲一遍整理所学。'],
  ['capricorn', '摩羯座', 'Capricorn', '财富', '单独描述处理钱财的谨慎。', '牵涉长期支出时，你可能习惯事先算清代价。安排明显超出预算时，通常会先收紧承诺。'],
  ['aquarius', '水瓶座', 'Aquarius', '学业', '强调对新奇观点的兴趣及与志趣相近的人交流。', '遇到新颖、少见的题目时，你可能愿意多追查一些来龙去脉，也容易在与同好交流时保持兴趣。'],
  ['pisces', '双鱼座', 'Pisces', '学业', '强调能激发感受的阅读与丰富想象。', '有情节或能激起感受的材料往往更能抓住你的注意力。表达时，你可能自然联想到许多细节。'],
].map(([key, sign, name, topic, basis, reading]) => {
  const id = 'pilot-leo-1899-moon-' + key;
  const input = { required: [{ kind: 'planet_sign', planet: 'Moon', sign }] };
  return makeRule({
    id, method: 'western', layer: 'personality', tradition: 'Alan Leo 近代西方占星', input, topic, basis, reading,
    source: sourcePassage('leo', id, '第 XVII 章 · The Moon in ' + name, {
      alternateUrl: 'https://iapsop.com/ssoc/1899__leo___astrology_for_all.pdf',
    }),
    ancestry: { literalConditions: ['本命月亮在' + sign], normalizedConditions: input,
      normalizationNote: '按当前热带黄道的月亮落座匹配。保留章内与行为相关的说法。' },
    limit: '仅用于月亮单项倾向。太阳、宫位及相位可能修饰该倾向，不能据此推断外部事件。',
  });
});

export const pilotRules = [...bazi, ...ziwei, ...western];
