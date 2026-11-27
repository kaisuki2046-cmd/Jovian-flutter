import { registeredFactFields } from '../model/interpretation-facts';
import type { SynastrySummaryRequest } from '../model/summary';
import type { ComparisonResult } from './interpretation-fact-adapter';

export function prepareSynastrySummary({ rulesVersion, sections }: ComparisonResult): SynastrySummaryRequest {
  const facts = sections.flatMap(({ system, versions, evidence }) => {
    return evidence.flatMap(({ rule, direction, facts, observation, sources }) => {
      const fields = registeredFactFields(system, rule);
      if (!fields) return [];
      const parameters = Object.fromEntries(fields.filter((field) => Object.hasOwn(facts, field)).map((field) => [field, facts[field]]));
      return [{ system, rule, direction, observation, sources, facts: parameters, chartRulesets: versions }];
    });
  });
  return { rulesVersion, facts };
}
