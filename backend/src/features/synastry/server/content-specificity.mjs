import { percentileScale } from './score-percentiles.mjs';

// Small semantic groups award credit for the detail, regardless of how often it is repeated.
const rubric = {
  context: [
    ['家中与照护', /家务|同住|居住|私人空间|家庭作息|照顾晚辈|照顾长辈|照护|育儿|陪护|探望|家产|兄弟间|姐妹间/u],
    ['日程与变动', /改约|迟到|临时变动|排期|轮班|排班|交接|约时间|短程出行|搬家|出差|远行|外出办事|预约/u],
    ['金钱与共享', /账目|记账|预算|支出|份额|报销|出资|费用|物品|花费|资金|共同开支|共同收益/u],
    ['工作与协作', /项目|客户|职业责任|工作安排|中断任务|会议|签约|交付|验收|合作方|共同决策/u],
    ['关系与沟通', /互发消息|发消息|独处|初次见面|争执|相处时间|私人安排|分歧|谈承诺|约会|接触新群体/u],
    ['回应与恢复', /压力恢复|恢复精力|忙碌后|疲惫|需要休息|作息|联络方式|信息不明确/u],
    ['时间阶段', /提前|临时|事前|事后|当天|到期|下次|重复处境|执行前|结束后/u],
    ['沟通误会', /被听成批评|误会|被理解成|被视为|指责|否定本人|误读|争辩/u],
  ],
  action: [
    ['记录与复述', /写下|写出|写明|写清|写得明白|写进|列出|列明|记账|记录|复述|逐项列|回执/u],
    ['分配与执行', /分摊|分配|轮流|轮换|交接|委托|分担|由.{0,6}(?:负责|决定|执行)|谁.{0,5}(?:负责|投入|跟进|执行|拍板)/u],
    ['约定与调整', /约定|约好|约出|改约|推迟|取消|改期|安排休息|设定|指定|保留.{0,7}(?:时间|空间)|暂停.{0,6}(?:决定|讨论)/u],
    ['核对与复查', /逐项|核对.{1,12}(?:时间|资源|费用|进度|场景|安排|边界|成本)|重新确认|试行|复盘|验收|对照.{1,10}(?:经历|计划|安排|做法)/u],
    ['提出与协商', /问清|说清|说出|说明|明说|沟通.{1,8}(?:需求|安排|时间)|怎样.{0,7}(?:调整|配合)|怎么.{0,7}(?:安排|分工)/u],
    ['协助与置办', /经由.{0,8}(?:帮助|扶持)|直接得到帮助|自行置办|代为引荐|出面协调/u],
  ],
  object: [
    ['数量与期限', /金额|份额|比例|日期|期限|截止|时段|空闲|可投入的时间|联系时间|通知的时间|地点|回执|第[一二三四五六七八九十\d]+步|\d+(?:元|天|周|小时|分钟|%)|[一二两三四五六七八九十]人的助力/u],
    ['边界与责任', /任务|分工|边界|权限|责任|决定权|谁先|谁来|由谁|谁承担|各自负责|自主空间/u],
    ['资源与代价', /具体.{0,4}(?:物品|资源)|人手|材料|费用|预算|代价|成本|便利.{0,4}共享|试错范围|可承受/u],
    ['需求与行为', /家务|个人物品|共同管理|独处|一起活动|休息时间|投入时间|联络|沟通渠道|可执行的安排/u],
    ['关系变化', /争执.{0,8}疏远|关系.{0,6}(?:维持|延续)|婚配和顺|兄弟间和睦/u],
  ],
};

const clean = (text) => text.normalize('NFKC').replace(/[\p{P}\p{Z}\s]/gu, '').toLowerCase();
const subject = /A\s*方|B\s*方|来源方|目标方|接收方|发起方|另一方|一方/u;
const condition = /(?:在|当|遇到|如果|一旦|尤其|每逢).{2,20}(?:时|后|前|中)|(?:如果|如果说).{2,16}(?:则|就)/u;

export function createContentScorer(texts) {
  const unique = new Map(texts.map((text) => [clean(text), text]));
  const corpus = [...unique.values()];
  const families = Object.entries(rubric);
  const weights = new Map(families.flatMap(([, features]) => features.map(([name, pattern]) => {
    const frequency = corpus.filter((text) => pattern.test(text)).length;
    // Smooth inverse document frequency so boilerplate features are downweighted,
    // and cap the effect of a rare expression.
    return [name, Math.round(100 * Math.min(2.25, 1 + Math.log((unique.size + 1) / (frequency + 1)) / 3))];
  })));
  function measure(text) {
    const matched = Object.fromEntries(families.map(([family, features]) => [family,
      features.filter(([, pattern]) => pattern.test(text)).map(([name]) => name)]));
    const scoreFamily = (family) => matched[family].map((name) => weights.get(name)).sort((a, b) => b - a)
      .slice(0, 3).reduce((score, weight, index) => score + Math.round(weight / (index + 1)), 0);
    const identified = matched.action.length && matched.object.length;
    const raw = 2 * scoreFamily('context') + 3 * scoreFamily('action') + 2 * scoreFamily('object')
      + (identified && subject.test(text) ? 80 : 0)
      + (matched.context.length && condition.test(text) ? 60 : 0);
    return { raw, features: Object.values(matched).flat() };
  }
  const details = new Map([...unique].map(([key, text]) => [key, measure(text)]));
  const scale = percentileScale([...details.values()].map(({ raw }) => raw));
  return {
    sampleSize: unique.size,
    evaluate(text) {
      const detail = details.get(clean(text)) ?? measure(text);
      return { ...detail, score: scale(detail.raw) };
    },
  };
}
