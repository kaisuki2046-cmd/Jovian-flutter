import { baziCombinationRules } from './bazi-combinations.mjs';
import { baziExpansion } from './bazi-expansion.mjs';
import { baziSamples } from './bazi-samples.mjs';
import { westernCombinationRules } from './western-combinations.mjs';
import { westernExpansion } from './western-expansion.mjs';
import { westernSamples } from './western-samples.mjs';
import { ziweiCombinationRules } from './ziwei-combinations.mjs';
import { ziweiExpansion } from './ziwei-expansion.mjs';
import { ziweiSamples } from './ziwei-samples.mjs';
import { chartKeywords, chartVersions } from './catalog.mjs';
import { eventReadings, personalityReading } from './readings.mjs';
import { reportTopics } from './topics.mjs';
import { pilotRules } from './rules/pilot.mjs';
import { eventExpansion } from './rules/events.mjs';
import { sourcePassage } from './sources/registry.mjs';

const referenceEntries = [
  {
    method: 'bazi',
    id: 'sanming-v8-jiachen-jiazi-shen',
    tradition: '子平八字',
    input: {
      required: [
        { kind: 'pillar', position: 'day', ganZhi: '甲辰' },
        { kind: 'pillar', position: 'hour', ganZhi: '甲子' },
        { kind: 'branch', position: 'month', branch: '申' },
      ],
      mustBeAbsent: [],
    },
    output: {
      topic: '事业',
      rule: '《三命通会》在甲辰日、甲子时、申月这一分支中，以煞星会印论贵，取其传统上有利于承担职事、获得认可的意涵。',
      reading: '可从长期承担职责的经历谈起，观察学习积累、经验或他人的支持如何帮助来访者应对更难的任务。',
      limit: '只适用于该日、时、月组合。「贵」保留为传统说法，表达时不推断具体职级或升迁时间。',
    },
    source: sourcePassage('sanming', 'sanming-v8-liujia-jiazi-jiachen-shen', '卷八 · 六甲日甲子时断 · 甲辰日条的申月分支', {
      alternateUrl: 'https://zh.wikisource.org/zh-hant/三命通會/卷八',
      excerpt: '',
    }),
    sourceCondition: {
      literalConditions: ['甲辰日', '甲子时', '申月', '分支以煞星会印论贵'],
      normalizedConditions: {
        derived: [
          { kind: 'hidden_ten_god', position: 'month', stem: '庚', tenGod: '七杀' },
          { kind: 'hidden_ten_god', position: 'hour', stem: '癸', tenGod: '正印' },
        ],
      },
      normalizationNote: '藏干对应为计算解释，仅供追溯。本条按原文直接给出的日、时、月匹配。相邻的年月水位与子月行运是另外的分支。',
    },
  },
  {
    method: 'ziwei',
    id: 'ziwei-taiwei-lucun-wealth',
    tradition: '紫微斗数',
    input: {
      required: [{ kind: 'palace_star', palace: '财帛', star: '禄存', scope: 'origin' }],
      mustBeAbsent: [],
    },
    output: {
      topic: '财富',
      rule: '《太微赋》将禄存守田宅或财帛视为有利于财富积聚的配置，本条收录财帛宫分支。',
      reading: '可围绕长期经营和保留资源展开，邀请来访者回看哪些习惯有助于把收入、技能或机会逐步积累下来。',
      limit: '本条只讲禄存落财帛宫的单条象征。全盘中的冲破等条件仍需另看，不据此承诺财富结果。',
    },
    source: {
      id: 'ziwei-doushu-quanshu-v1',
      title: '紫微斗數全書',
      author: '作者题署待核',
      edition: '维基文库卷一转录',
      passageId: 'ziwei-v1-taiwei-lucun-tian-cai',
      locator: '卷一 · 太微賦 · 禄存守田财条',
      url: 'https://zh.wikisource.org/zh/紫微斗數全書/卷一',
      excerpt: '祿存守於田財，堆金積玉。',
    },
  },
  {
    method: 'western',
    id: 'alan-leo-1899-sun-capricorn',
    tradition: 'Alan Leo 近代西方占星',
    input: {
      required: [{ kind: 'planet_sign', planet: 'Sun', sign: '摩羯座' }],
      mustBeAbsent: [],
    },
    output: {
      topic: '性格',
      rule: 'Alan Leo 在太阳摩羯座的章节中强调耐力、勤勉和对细节的关注，将它们与把目标落实成实际成果联系起来。',
      reading: '可用持续投入一个项目、逐步建立方法的情景解释这种倾向，留意耐心和谨慎在什么条件下帮助目标落地。',
      limit: '本条采用书中的太阳星座视角。宫位、相位和其他天体未纳入这条规则。',
    },
    source: sourcePassage('leo', 'alan-leo-1899-ch13-pp35-36', '第 XIII 章，初版第 35–36 页', {
      url: 'https://umbrielastrology.com/library/alan-leo-sun-in-capricorn.html',
      excerpt: '',
    }),
    sourceCondition: {
      literalConditions: ['太阳在摩羯座'],
      normalizedConditions: { required: [{ kind: 'planet_sign', planet: 'Sun', sign: '摩羯座' }] },
      normalizationNote: '沿用排盘的热带黄道太阳星座，本命单事实匹配。',
    },
  },
];

const seeds = [
  ...referenceEntries,
  ...baziSamples, ...baziExpansion, ...baziCombinationRules,
  ...ziweiSamples, ...ziweiExpansion, ...ziweiCombinationRules,
  ...westernSamples, ...westernExpansion, ...westernCombinationRules,
];
const topics = { 事业: 'career', 感情: 'love', 学业: 'study', 财富: 'wealth' };

const legacyEntries = seeds.map(({ id, method, tradition, input, output, source, sourceCondition }) => {
  const event = eventReadings.get(id);
  const layer = event ? 'events' : 'personality';
  return {
    id, method, layer, tradition, input, source,
    ...(sourceCondition && {
      schemaVersion: '1.1.0',
      applicability: { chartScope: 'natal', calculationProfile: chartVersions[method].rulesetVersion },
      sourceRefs: [{ sourceId: source.id, passageId: source.passageId, supportType: 'direct', supportNote: output.rule }],
      verification: { status: 'checked_online_passage', version: 1 },
      sourceCondition,
    }),
    entry: {
      keywords: [...chartKeywords(method, input.required), ...chartKeywords(method, input.mustBeAbsent, true)].sort(),
      reading: event ?? personalityReading(output.reading),
      topic: reportTopics[topics[output.topic] ?? 'overall'],
    },
    reference: { basis: output.rule, limit: output.limit, originalTopic: output.topic },
  };
});

export const entries = [...legacyEntries, ...pilotRules, ...eventExpansion];

if (legacyEntries.length !== 3000 || new Set(entries.map(({ id }) => id)).size !== entries.length
  || legacyEntries.filter(({ layer }) => layer === 'events').length !== eventReadings.size) {
  throw new Error('Incomplete interpretation migration.');
}
