import type { ComparisonSection, ComparisonSubject } from '../model/comparison';
import type { InterpretationChartReference, InterpretationFact, System } from '../model/interpretation';
import { factPatternId, factTypeId, identifyInterpretationFact } from '../model/interpretation-facts';

export type ComparisonResult = {
  a: ComparisonSubject;
  b: ComparisonSubject;
  rulesVersion: string;
  sections: ComparisonSection[];
};

function chartReference({ chart, mode }: ComparisonSubject, system: System): InterpretationChartReference {
  const { engineName, engineVersion, rulesetVersion } = chart[system];
  return {
    mode, snapshotId: 'snapshotId' in chart ? chart.snapshotId : undefined,
    calculatedAt: chart.calculatedAt, engineName, engineVersion, rulesetVersion,
  };
}

export function adaptInterpretationFacts({ a, b, rulesVersion, sections }: ComparisonResult): InterpretationFact[] {
  const fingerprints = new Map<string, string>();
  return sections.flatMap(({ system, evidence, limitation }) => {
    const chartRefs = { a: chartReference(a, system), b: chartReference(b, system) };
    return evidence.flatMap((item) => {
      const typeId = factTypeId(system, item.rule);
      const { id, identity } = identifyInterpretationFact(typeId, item.direction, item.sources, item.facts ?? {});
      const existing = fingerprints.get(id);
      if (existing === identity) return [];
      if (existing !== undefined) throw new Error(`Interpretation fact ID collision in ${typeId}.`);
      fingerprints.set(id, identity);
      return [{ ...item, id, system, ruleVersion: item.ruleVersion ?? rulesVersion, chartRefs, factTypeId: typeId,
        factPatternId: factPatternId({ system, rule: item.rule, parameters: item.facts ?? {} }),
        limitations: [...(item.limitations ?? []), ...(limitation ? [limitation] : [])] }];
    });
  });
}
