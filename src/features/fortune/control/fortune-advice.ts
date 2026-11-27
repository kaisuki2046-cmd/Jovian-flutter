import type { FortuneAdvice, FortuneAdviceGroup, FortuneSelectedAdvice } from '../model/advice';
import { matchFortuneAdviceOption, matchFortuneNatalAdvice, type FortuneAdviceMatch } from './knowledge/catalog';
import type { FortuneAdviceThemes } from './fortune-advice-themes';

const natalFields = ['element', 'sign', 'lifeStar'] as const;
const natalReasons = {
  bazi: '取已确认的本命日干五行作象征搭配主题，不等同喜用判断。',
  western: '取本命太阳所在的热带黄道星座作搭配主题，不代表本期吉凶。',
  ziwei: '取已确认命宫的首颗主星作象征主题，不据此推断佩戴效果。',
};

function adviceGroups(matches: FortuneAdviceMatch[], natal: boolean): FortuneAdviceGroup[] {
  const groups = new Map<string, FortuneAdviceGroup>((['数字', '饰品', '颜色'] as const)
    .map(kind => [kind, { kind, items: [] }]));
  for (const { method, theme, entry } of matches) {
    const advice = entry.interpretation.advice!;
    groups.get(advice.kind)!.items.push({
      method, theme: natal && method === 'western' ? theme + '座' : theme,
      reason: natal ? natalReasons[method] : '根据你选择的资料来源和主题，用作象征搭配参考。',
      options: advice.options, knowledgeId: entry.id,
      source: entry.source.book + ' · ' + (entry.source.section ?? entry.source.passage_id),
      limitations: [...entry.interpretation.limitations, ...entry.conditions.uncertain],
    });
  }
  return [...groups.values()];
}

export function buildFortuneAdvice(calculationRunId: string, snapshotId: string, periodType: string,
  themes: FortuneAdviceThemes): FortuneAdvice {
  const matches = periodType === 'week' ? []
    : natalFields.flatMap(field => themes[field] ? matchFortuneNatalAdvice(field, themes[field]) : []);
  return { version: 1, calculationRunId, snapshotId, periodType, groups: adviceGroups(matches, true) };
}

export function buildFortuneSelectedAdvice(optionId: string): FortuneSelectedAdvice | undefined {
  const matches = matchFortuneAdviceOption(optionId);
  return matches.length ? { version: 1, optionId, groups: adviceGroups(matches, false) } : undefined;
}
