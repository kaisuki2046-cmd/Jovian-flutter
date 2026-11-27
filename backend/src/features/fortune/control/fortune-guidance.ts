import type { buildPeriodAnalysis } from './period-analysis';
import { planetLabels, type buildPlanetaryTransits } from './solar-transits';
import type { buildZiweiFlows } from './ziwei-flows';

const version = 'fortune-guidance-mvp-v1';
export const methodLabels = { bazi: '八字', ziwei: '紫微', western: '西方行运' };
export const topicLabels = { finance: '财务安排', relationships: '关系沟通', work: '工作规划', rhythm: '生活节奏' };
export const toneLabels = { support: '支持', caution: '留意', context: '关注' };
type Method = keyof typeof methodLabels;
type Topic = keyof typeof topicLabels;
type Tone = keyof typeof toneLabels;
type Signal = {
  sourceId: string; ruleId: string; method: Method; topic: Topic; tone: Tone;
  start: number; end?: number; fact: string;
};
const topicOrder = Object.keys(topicLabels) as Topic[];
const palaceTopics: Partial<Record<string, Topic>> = {
  财帛: 'finance', 夫妻: 'relationships', 交友: 'relationships', 官禄: 'work',
  迁移: 'work', 福德: 'rhythm', 田宅: 'rhythm',
};
const planetTopics: Record<keyof typeof planetLabels, Topic> = {
  Sun: 'work', Moon: 'rhythm', Mercury: 'relationships', Venus: 'relationships', Mars: 'work',
  Jupiter: 'work', Saturn: 'work', Uranus: 'rhythm', Neptune: 'rhythm', Pluto: 'rhythm',
};
const catalog = {
  finance: {
    yi: '核对本周期的账单到期日和已安排的支出。',
    ji: '避免在费用或条款还没看清时仓促承诺。',
    habit: '列一张近期账单清单，标出金额和到期日。',
  },
  relationships: {
    yi: '选一件需要协调的事，先向对方确认各自的预期。',
    ji: '避免只凭简短回复猜测对方的动机。',
    habit: '在一次重要沟通后，用一句话记下双方确认的下一步。',
  },
  work: {
    yi: '确认手头一项工作的交付物和完成时间。',
    ji: '避免在工时和依赖还没核实时承诺交付。',
    habit: '把一个待办拆成一个可以马上开始的小步骤。',
  },
  rhythm: {
    yi: '给连续安排之间留一点缓冲时间。',
    ji: '避免把空闲时段全部排满。',
    habit: '在本周期留出十分钟散步或安静休息。',
  },
} satisfies Record<Topic, Record<'yi' | 'ji' | 'habit', string>>;

export function rankFortuneTopics(signals: Signal[]) {
  const ranked = topicOrder.flatMap(topic => {
    const evidence = signals.filter(item => item.topic === topic)
      .sort((a, b) => a.start - b.start || a.sourceId.localeCompare(b.sourceId));
    if (!evidence.length) return [];
    const methods = [...new Set(evidence.map(item => item.method))];
    const support = evidence.some(item => item.tone === 'support');
    const caution = evidence.some(item => item.tone === 'caution');
    const tone = support && caution ? 'mixed' : support ? 'support' : caution ? 'caution' : 'context';
    return [{ topic, evidence, methods, tone }] as const;
  });
  return ranked.sort((a, b) => b.methods.length - a.methods.length);
}

export function buildFortuneGuidance(
  asOf: number,
  bazi: ReturnType<typeof buildPeriodAnalysis>,
  ziwei: ReturnType<typeof buildZiweiFlows>,
  western: ReturnType<typeof buildPlanetaryTransits>,
) {
  const signals: Signal[] = [];
  if (bazi) {
    for (const item of bazi.wealth) {
      signals.push({ sourceId: item.id, ruleId: 'bazi-wealth-topic-mvp-v1', method: 'bazi', topic: 'finance',
        tone: 'context', start: item.start, end: item.end,
        fact: `本命日柱 ${bazi.natalPillar} · ${item.pillar}见${item.tenGod}` });
    }
    for (const item of bazi.relationships) {
      signals.push({ sourceId: item.id, ruleId: 'bazi-branch-relationship-topic-mvp-v1', method: 'bazi',
        topic: 'relationships', tone: item.relationship === '六合' ? 'support' : 'caution',
        start: item.start, end: item.end, fact: `${item.pillar}与本命日支${bazi.natalPillar[1]}${item.relationship}` });
    }
  }
  if (ziwei.status === 'ready') {
    for (const item of ziwei.intervals) {
      const topic = palaceTopics[item.flow.palace];
      if (!topic) continue;
      signals.push({ sourceId: item.id, ruleId: 'ziwei-flow-palace-topic-mvp-v1', method: 'ziwei', topic,
        tone: 'context', start: item.start, end: item.end,
        fact: `${item.flow.name}${item.flow.pillar} · 命宫落本命${item.flow.palace}宫` });
    }
  }
  if (western.status === 'ready') {
    for (const item of western.events) {
      const tone = item.angle === 60 || item.angle === 120 ? 'support'
        : item.angle === 90 || item.angle === 180 ? 'caution' : 'context';
      signals.push({ sourceId: item.id, ruleId: 'western-same-body-aspect-topic-mvp-v1', method: 'western',
        topic: planetTopics[item.planet], tone, start: item.at,
        fact: `行运${planetLabels[item.planet]}与本命${planetLabels[item.planet]}${item.label}（${item.angle}°）` });
    }
  }
  const ranked = rankFortuneTopics(signals);
  const advice = rankFortuneTopics(signals.filter(item => item.end === undefined ? item.start >= asOf : item.end > asOf))
    .map(({ topic, evidence, tone }) => ({
      topic, tone, evidence, items: (['yi', 'ji', 'habit'] as const).map(kind => ({
        kind, ruleId: `fortune-${topic}-${kind}-mvp-v1`, text: catalog[topic][kind],
      })),
    }));
  return { version, ranked, advice };
}
