import type { CoinToss, LiuYaoReading, MeihuaReading } from './iching';
import type { TarotDraw } from './tarot';
import type { TarotSnapshot } from './tarot-session';

export const readingMethods = ['tarot', 'liuyao', 'meihua'] as const;
export type ReadingMethod = (typeof readingMethods)[number];
export type ReadingKind = ReadingMethod | 'combined';
export const methodLabels: Record<ReadingKind, string> = { tarot: '塔罗', liuyao: '六爻', meihua: '梅花易数', combined: '综合算事' };
export const ruleVersions = { tarot: 'rws-three-card-v1', liuyao: 'three-coin-v1', meihua: 'three-number-v1', combined: 'tarot-liuyao-meihua-v1' } as const;
export const combinedRules = {
  tarot: ruleVersions.tarot, liuyao: ruleVersions.liuyao, meihua: 'first-three-liuyao-lines-v1',
} as const;
export const combinedPromptVersion = 'divination_combined_v1';
export const meihuaInputSource = 'liuyao-first-three-lines';
export const clickMeihuaSource = 'tarot-click-epoch-ms';
export const automaticMeihuaSource = 'automatic-three-numbers';
export const guideVersion = 'three-methods-v1';
export const guidePromptVersion = 'concise-reading-v1';
export type ProReportParagraph = Readonly<{ text: string; detail?: string }>;
export type ProReport = Readonly<Record<ReadingMethod, string>>
  | Readonly<Record<ReadingMethod, readonly ProReportParagraph[]>>;
export type ProSection = Readonly<{ text: string; highlight: string }>;
export type LegacyProReport = Readonly<Record<ReadingMethod, ProSection> & { opening: string; closing: string }>;
export const guideRules = {
  tarot: 'rws-78-v1', liuyao: 'liuyao-jingfang-najia-v1', meihua: 'meihua-click-ms-sum-v1',
} as const;
export const automaticGuideRules = { ...guideRules, meihua: ruleVersions.meihua } as const;
export type RitualEvent = { actionId: string; step: number };
export type CardEvent = RitualEvent & { slot: number; epochMs: string; monotonicMs: number; clockSessionId: string };
export const maxFollowUps = 8;

export type QuestionUnderstanding = Readonly<{ focus: string; clarification: string; source: 'model' | 'local'; intent?: 'chat_only'; proof?: string }>;
export type ReadingReport = Readonly<{
  schemaVersion: 1;
  method: ReadingKind;
  answer: string;
  explanation: string;
  nextSteps: readonly string[];
  evidenceIds: readonly string[];
  source: 'local' | 'model';
  promptVersion?: typeof combinedPromptVersion | typeof guidePromptVersion | 'followup_v1';
  sections?: readonly Readonly<{ evidenceId: string; text: string }>[];
}>;
export type ReadingFollowUp = Readonly<{ question: string; report: ReadingReport }>;
export type ReadingFollowUpAction = (id: number, question: string) => Promise<string | undefined>;
export type ReadingEvidence = Readonly<{
  id: string;
  label: string;
  plain: string;
  source: string;
  catalogVersion: 1;
}>;
export type MeihuaNumbers = readonly [number, number, number];

export type ReadingBase = Readonly<{
  question: string;
  focus: string;
  resolvedAt?: string;
  evidence: readonly ReadingEvidence[];
  report?: ReadingReport;
  followUps: readonly ReadingFollowUp[];
}>;

export type LiuYaoSnapshot = ReadingBase & Readonly<{
  method: 'liuyao';
  ruleVersion: typeof ruleVersions.liuyao;
  stage: 'cast' | 'reading';
  tosses: readonly CoinToss[];
  result?: LiuYaoReading;
}>;
export type MeihuaSnapshot = ReadingBase & Readonly<{
  method: 'meihua';
  ruleVersion: typeof ruleVersions.meihua;
  stage: 'numbers' | 'reading';
  result?: MeihuaReading;
}>;
export type CombinedSnapshot = ReadingBase & Readonly<{
  method: 'combined';
  ruleVersion: typeof ruleVersions.combined | typeof guideVersion;
  calculationRules: typeof combinedRules | typeof guideRules | typeof automaticGuideRules;
  automatic?: true;
  castStartedAt?: string;
  castResult?: ReturnType<typeof import('../control/liuyao.mjs').readJingfang>;
  cardEvents?: readonly CardEvent[];
  chartHash?: string;
  proReport?: ProReport | LegacyProReport;
  stage: 'shuffle' | 'cut' | 'draw' | 'cast' | 'reading';
  cut?: number;
  slotCount: number;
  selectedSlots: readonly number[];
  draw?: TarotDraw;
  tosses: readonly CoinToss[];
  results?: Readonly<{
    liuyao: LiuYaoReading;
    meihua: MeihuaReading;
    meihuaInputSource: typeof meihuaInputSource | typeof clickMeihuaSource | typeof automaticMeihuaSource;
  }>;
}>;
export type ReadingSnapshot = TarotSnapshot | LiuYaoSnapshot | MeihuaSnapshot | CombinedSnapshot;
export type ReadingQuestion = {
  id: number;
  kind: 'readingQuestion';
  question: string;
  previousQuestion?: string;
  understanding: QuestionUnderstanding;
  error?: string;
};
export type ReadingSession = { id: number; kind: 'readingSession'; snapshot: ReadingSnapshot };
export type ReadingTask = ReadingQuestion | ReadingSession;
