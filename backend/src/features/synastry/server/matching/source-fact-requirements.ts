import { comparisonRulesVersion } from '../../model/comparison';
import { algorithmDefinitions, enrichmentVersion } from '../../model/algorithm-profiles';
import type { Condition, System } from '../../model/interpretation';
import { factTypeId } from '../../model/interpretation-facts';
import type { FactInput } from '../../control/fact-matching';

export const sourceChartRulesets: Record<System, string> = {
  bazi: 'utc8-jie-local-civil-late-zi-next-v1',
  ziwei: 'standard-new-year-leap-split-late-zi-current-v1',
  western: 'tropical-whole-sign-v1',
};

const aspectRules = new Set(['western-cross-aspect', 'western-axis-aspect', 'western-planet-to-axis',
  'western-house-ruler-aspect', 'western-ruler-to-ruler', 'western-sun-saturn-contact']);

export function sourceFactRequirements(id: string, system: System, rule: string) {
  const conditions: Condition[] = [];
  if (system === 'western' && aspectRules.has(rule)) {
    conditions.push(
      { id: id + ':minimum', field: 'facts.deviation', operator: 'gte', expected: 0, required: true, description: '实际相位偏差非负' },
      { id: id + ':orb', field: 'facts.deviation', operator: 'lte', expectedField: 'facts.orb',
        required: true, description: '实际相位偏差在容许度内' },
    );
  }
  const asInput = (factRule: string, required: Condition[]): FactInput => ({
    type: factTypeId(system, factRule), ruleVersions: [algorithmDefinitions.some((entry) =>
      entry.system === system && entry.rule === factRule) ? enrichmentVersion : comparisonRulesVersion],
    chartRulesets: [sourceChartRulesets[system]],
    conditions: required, exclusions: [],
  });
  const primary = asInput(rule, conditions);
  if (system !== 'western' || rule !== 'western-matching-planet-angle') return { primary, supporting: undefined };

  return { primary, supporting: {
    input: asInput('western-cross-aspect', [
      { id: id + ':aspect-direction', field: 'direction', operator: 'eq', expected: 'mutual', required: true, description: '双向跨盘相位' },
      { id: id + ':aspect-angle', field: 'facts.angle', operator: 'in', expected: [0, 60, 90, 120, 180],
        required: true, description: '已确认的主要相位角' },
      { id: id + ':aspect-min', field: 'facts.deviation', operator: 'gte', expected: 0, required: true, description: '实际相位偏差非负' },
      { id: id + ':aspect-bound', field: 'facts.deviation', operator: 'lte', expectedField: 'facts.orb',
        required: true, description: '须另有同一对天体及同一角距的有效相位' },
    ]),
    fields: { aPlanet: 'planet', bPlanet: 'planet', aLongitude: 'aLongitude', bLongitude: 'bLongitude', degrees: 'degrees' },
  } };
}
