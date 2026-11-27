import { reportTopics } from './knowledge/topics.mjs';

export const reportTopicLimit = 40;

const sourceTiers = new Map([
  ['三命通会', 100], ['三命通會', 100], ['渊海子平', 96], ['子平真诠', 96], ['Christian Astrology', 96], ['Tetrabiblos', 96],
  ['紫微斗数全书', 94], ['紫微斗數全書', 94], ['滴天髓辑要', 94], ['神峰通考', 93], ['穷通宝鉴', 92],
  ['紫微斗数捷览', 90], ['紫微星诀', 89], ['斗数观测录', 87], ['铁板神数', 76],
]);

const factBits = new Map([
  ['pillar', 5.9], ['stem', 3.3], ['branch', 3.6], ['day_master_strength', 1.5],
  ['stem_ten_god', 3.1], ['hidden_ten_god', 2.6], ['branch_main_ten_god', 3.1],
  ['shen_sha', 2.8], ['natal_gender', 1], ['natal_daylight', 1],
  ['natal_ziwei_hour', 3.6], ['natal_ziwei_time_band', 1.6],
  ['palace_star', 3.5], ['palace_branch', 3.6], ['palace_brightness', 2],
  ['planet_sign', 3.6], ['planet_house', 3.6], ['planet_motion', 1.4], ['western_sect', 1],
  ['western_zodiac', 0], ['western_house_system', 0], ['western_profile', 0],
  ['planet_longitude', 4], ['aspect', 3], ['aspect_orb', 2.5],
  ['ziwei_daozang_input', 7], ['bazi_fetal_month', 3.6],
]);

const detailSignals = [
  [4, /搬家|搬迁|迁居|乔迁|移居|移民|离乡|异地|跨城|外派|出国|定居|迁移(?!宫)|relocat|emigrat/iu],
  [4, /签约|入职|辞职|离职|失业|裁员|转行|换工作|升职|升迁|晋升|调职|创业|经商|出仕|任职|罢官|commission|profession|dismissal/iu],
  [4, /结婚|成婚|婚配|离婚|分居|分手|再婚|续弦|复合|订婚|婚约|marri|divorc|spouse|betroth/iu],
  [4, /入学|升学|转学|留级|停学|辍学|毕业|考取|登科|科举|功名|学位|录取|apprentice|school|examination/iu],
  [4, /购房|买房|置产|置办产业|继承|遗产|变卖|破产|负债|借贷|投资|破财|积蓄|薪资|inherit|estate|debt|bankrupt/iu],
  [3, /生育|生产|添丁|收养|丧偶|丧亲|监禁|诉讼|官司|失窃|火灾|事故|受伤|injur|bereave|lawsuit|prison/iu],
  [2, /父母|父亲|母亲|兄弟|姐妹|配偶|子女|同事|雇主|下属|客户|合伙人|亲属|parent|children|sibling|colleague|employer/iu],
  [2, /幼年|少年|早年|中年|晚年|几年|数年|三次|反复|多次|婚后|毕业后|退休|(?:\d+|[一二三四五六七八九十百]+)(?:虚?岁|年间|次)|childhood|in youth|old age/u],
  [2, /先.{0,20}(?:后|再)|因.{2,18}(?:导致|而|于是)|从.{2,18}(?:转为|转到|改为)|随后|先后|继而|由此|followed by|leading to/iu],
  [1, /工匠|商人|军职|医者|教师|写作|从业|工作|伴侣|学校|学徒|合同|家产|artist|merchant|soldier|teacher|physician/iu],
  [1.5, /流程|预算|额度|交付|任务|竞标|分工|居住安排|求职|家务|学业计划|名单|日程|排班|职位|租约|居所|职位|schedule|budget|lease/iu],
  [1.25, /协商|谈判|试验|请教|分配|表明立场|介绍自己|向.{1,12}求助|调解|咨询|申请|核对|比较方案|整理步骤|练习|petition|negotiate|rehearse/iu],
  [1, /在[^，。；、]{3,22}(?:时|阶段|场合)|(?:当|如果|每逢)[^，。；、]{3,22}(?:时|，)|[^，。]{3,16}(?:后|之前|期间)[，。]|when |during /iu],
  [0.5, /谨慎|疏离|情绪|固执|执拗|果断|谦逊|待人|直言|慷慨|清秀|聪明|艰辛|奔波|争执|不愿让步|grief|temperament|stubborn/iu],
];

function constraintCost(facts) {
  const constraints = new Map();
  for (const fact of facts) {
    // 干、支与整柱描述有重叠。同一颗星的同一落位也可能有多个证明。
    const pillar = ['pillar', 'stem', 'branch'].includes(fact.kind);
    const key = pillar ? `pillar:${fact.position}` : JSON.stringify(fact);
    const cost = factBits.get(fact.kind) ?? (fact.kind?.startsWith('western_profile_') ? 0 : 2.1);
    const previous = constraints.get(key);
    if (pillar && previous && fact.kind !== 'pillar' && !previous.full && !previous.kinds.has(fact.kind)) {
      previous.cost = Math.min(5.9, previous.cost + cost);
      previous.kinds.add(fact.kind);
    } else if (!previous || cost > previous.cost) {
      constraints.set(key, { cost, full: fact.kind === 'pillar', kinds: new Set([fact.kind]) });
    }
  }
  return [...constraints.values()].reduce((total, item) => total + item.cost, 0);
}

function conditionCost(entry) {
  if (entry.kind === 'tieban') return 6;
  if (entry.kind === 'calculation' || entry.kind === 'lookup') return 2;
  const { required = [], alternatives = [], absent = [], relations = [], measurements = [], decadalPeriods, decadalPeriod } =
    entry.conditions ?? {};
  // 旧规则的备选组只附加条件；多路线 Claim 的备选组已经包含整路必要条件。
  const requiredKeys = required.map(fact => JSON.stringify(fact));
  const fullRoutes = alternatives.some(route => {
    const routeKeys = new Set(route.map(fact => JSON.stringify(fact)));
    return requiredKeys.every(key => routeKeys.has(key));
  });
  const routes = alternatives.length ? alternatives.map(group => fullRoutes ? group : [...required, ...group]) : [required];
  const uniqueRoutes = new Map(routes.map(route => [JSON.stringify(route.map(fact => JSON.stringify(fact)).sort()), route]));
  const proofCosts = [...uniqueRoutes.values()].map(constraintCost);
  const conjunction = Math.max(0, -Math.log2(proofCosts.reduce((total, cost) => total + 2 ** -cost, 0)));
  const periods = decadalPeriods ?? (decadalPeriod ? [decadalPeriod] : []);
  const age = periods.length ? Math.min(...periods.map(period => {
    const range = period.applicableAgeRange;
    return range ? 3.3 + Math.log2(10 / (range.endAge - range.startAge + 1)) : 3.3;
  })) : 0;
  return Math.min(60, conjunction + Math.min(3.5, absent.length * 0.45)
    + Math.min(4, relations.length * 1.4 + measurements.length) + age);
}

function detailScore({ originalText = '', modernInterpretation = '', kind }) {
  if (kind === 'lookup') return 2;
  // 只分析原文和实际解读，分句的机器条件说明不作为解读细节加分。
  const meaning = (modernInterpretation ?? '').split('相关盘面包括')[0];
  const text = `${originalText ?? ''}\n${meaning}`;
  const score = detailSignals.reduce((value, [weight, signal]) => value + (signal.test(text) ? weight : 0), 0);
  return kind === 'calculation' ? Math.min(1, score) : score;
}

function documentaryScore({ source, originalKind, kind }) {
  const book = source?.book ?? source?.title;
  const tier = sourceTiers.get(book) ?? (source?.edition && (source?.passage_id || source?.passageId || source?.locator) ? 84 : book ? 70 : 45);
  if (kind === 'lookup') return Math.min(84, tier);
  if (originalKind === 'rule_basis') return Math.min(76, tier);
  return tier;
}

export function reportEvidenceKey({ kind, id, branch, knowledgeId }) {
  return JSON.stringify([kind, knowledgeId ?? id, knowledgeId === undefined ? branch?.text ?? null : null]);
}

export function rawReportScores(entry, { sampleSize = 0, hits = {} } = {}) {
  const prior = conditionCost(entry);
  const observed = hits[reportEvidenceKey(entry)];
  // 以结构估计作弱先验。只使用样本中出现过的条目频率；未抽中的罕见命中仍按实际约束评分。
  const strictness = sampleSize && observed
    ? 0.5 * (prior - Math.log2((observed + 12 * 2 ** -prior) / (sampleSize + 12))) : prior;
  return [strictness, detailScore(entry), documentaryScore(entry)];
}

function cumulativeDistribution(distribution) {
  // 用并列秩的中点。只保留频数表即可复现样本的经验分布。
  let lower = 0;
  const ranks = distribution.map(([score, frequency]) => {
    const rank = { score, lower, mid: lower + frequency / 2 };
    lower += frequency;
    return rank;
  });
  return { ranks, size: lower };
}

function percentile(value, { ranks, size }) {
  if (!size) return null;
  let low = 0;
  let high = ranks.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (ranks[middle].score < value) low = middle + 1;
    else high = middle;
  }
  const rank = ranks[low];
  return 100 * (rank?.score === value ? rank.mid : rank?.lower ?? size) / size;
}

function scoreEvidence(entry, calibration, distributions) {
  const raw = rawReportScores(entry, calibration);
  // 混入连续刻度，避免样本稀疏区两个不同的原始分数被压成同分。
  const anchors = [100 * (1 - 2 ** (-raw[0] / 12)), 100 * (1 - 2 ** (-raw[1] / 8)), raw[2]];
  return raw.map((value, dimension) => {
    if (dimension === 2 && value === 100) return 100;
    const empirical = percentile(value, distributions[dimension]);
    return Math.min(100, empirical === null ? anchors[dimension] : 0.8 * empirical + 0.2 * anchors[dimension]);
  });
}

export function selectReportMaterials(blocks, calibration) {
  const distributions = [0, 1, 2].map(dimension => cumulativeDistribution(calibration?.distributions?.[dimension] ?? []));
  return Object.entries(reportTopics).map(([topicId, topic]) => {
    const sorted = blocks.filter(block => block.topicId ? block.topicId === topicId : block.topic === topic)
      .flatMap(block => block.entries).map(entry => ({ ...entry, scores: scoreEvidence(entry, calibration, distributions) }))
      .sort((a, b) => b.scores[0] - a.scores[0] || b.scores[1] - a.scores[1] || b.scores[2] - a.scores[2]
        || reportEvidenceKey(a).localeCompare(reportEvidenceKey(b), 'en'));
    const seen = new Set();
    const entries = sorted.filter(entry => {
      const key = entry.deduplicationKey ?? reportEvidenceKey(entry);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, reportTopicLimit);
    return { topicId, topic, entries };
  });
}
