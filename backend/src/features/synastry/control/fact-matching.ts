import type { Condition, InterpretationQuery, KnowledgeAtom, RelationshipVariant } from '../model/interpretation';
import { factPatternId, factTypeId } from '../model/interpretation-facts';
import { aspectComparisonEpsilon } from './western-facts';

export type FactQuery = Omit<InterpretationQuery, 'requestedRelationships' | 'requestedSchools' | 'requestedThemes'>;
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function parameter(query: FactQuery, path: string) {
  if (path === 'direction') return query.direction;
  const key = path.slice('facts.'.length);
  return Object.hasOwn(query.parameters, key) ? query.parameters[key] : undefined;
}

export function evaluateInterpretationConditions(conditions: readonly Condition[], query: FactQuery) {
  return conditions.map((condition) => {
    const { id, field, operator } = condition;
    const value = parameter(query, field);
    const expected = 'expectedField' in condition ? parameter(query, condition.expectedField)
      : 'expected' in condition ? condition.expected : undefined;
    const result = { id, field, operator, actual: value, expected, description: condition.description, required: condition.required };
    if (value === undefined || ('expectedField' in condition && expected === undefined)) {
      return { ...result, status: 'missing' } as const;
    }
    const passed = (() => {
      switch (operator) {
        case 'exists': return true;
        case 'eq': return value === condition.expected;
        case 'neq': return typeof value === typeof condition.expected && value !== condition.expected;
        case 'in': return condition.expected.includes(value);
        case 'not_in': return condition.expected.some((candidate) => typeof candidate === typeof value)
          && !condition.expected.includes(value);
        case 'contains': return typeof value === 'string' && value.includes(condition.expected);
        case 'member': return typeof value === 'string' && value.split('、').includes(condition.expected);
        case 'not_member': return typeof value === 'string' && !value.split('、').includes(condition.expected);
        case 'gte': return numeric(value) && numeric(expected) && value >= expected;
        case 'lte': {
          const aspectBound = 'expectedField' in condition && [
            ['facts.deviation', 'facts.orb'], ['facts.nativeDeviation', 'facts.nativeOrb'], ['facts.crossDeviation', 'facts.crossOrb'],
          ].some(([deviation, orb]) => condition.field === deviation && condition.expectedField === orb);
          return numeric(value) && numeric(expected) && value <= expected + (aspectBound ? aspectComparisonEpsilon : 0);
        }
      }
    })();
    return { ...result, status: passed ? 'passed' : 'failed' } as const;
  });
}

export type FactInput = {
  type: string;
  ruleVersions: string[];
  chartRulesets?: string[];
  factIds?: string[];
  pattern?: string;
  conditions: Condition[];
  exclusions: Condition[][];
};

export function factInputs(atom: KnowledgeAtom, scene: RelationshipVariant): FactInput[] {
  if (atom.sourceConditions?.pending) return [];
  return (atom.sourceConditions?.include ?? [[]]).map((group) => ({
    type: factTypeId(atom.system, atom.factRule), ruleVersions: atom.ruleVersions,
    chartRulesets: atom.chartRulesets, factIds: atom.factIds, pattern: atom.factPatternId,
    conditions: [...group, ...atom.conditions, ...scene.conditions],
    exclusions: [...(atom.sourceConditions?.exclude ?? []), ...[...atom.exclusions, ...scene.exclusions].map((item) => [item])],
  }));
}

export function evaluateFactInput(input: FactInput, query: FactQuery) {
  const pattern = input.pattern && factPatternId(query);
  type Checks = ReturnType<typeof evaluateInterpretationConditions>;
  if (input.type !== factTypeId(query.system, query.rule)
    || input.factIds && !input.factIds.includes(query.factId)
    || input.pattern && pattern && input.pattern !== pattern) {
    return { status: 'condition_not_met' as const };
  }
  if (!input.ruleVersions.includes(query.ruleVersion)
    || input.chartRulesets && !query.chartRulesets.every((version) => input.chartRulesets!.includes(version))) {
    return { status: 'incompatible_version' as const };
  }
  const conditions = evaluateInterpretationConditions(input.conditions, query);
  const groupedExclusions = input.exclusions.map((group) => evaluateInterpretationConditions(group, query));
  const exclusions: Checks = groupedExclusions.flat();
  if (conditions.some(({ required, status }) => required && status === 'failed')
    || groupedExclusions.some((group) => group.every(({ status }) => status === 'passed'))) {
    return { status: 'condition_not_met' as const, conditions, exclusions };
  }
  // An exclusion is disproved only by a known contradictory value in its conjunction.
  if (conditions.some(({ required, status }) => required && status === 'missing') || input.pattern && !pattern
    || groupedExclusions.some((group) => !group.some(({ status }) => status === 'failed')
      && group.some(({ required, status }) => required && status === 'missing'))) {
    return { status: 'insufficient_fact_data' as const, conditions, exclusions };
  }
  return { status: 'matched' as const, conditions, exclusions };
}
