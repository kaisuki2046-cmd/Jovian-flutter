import type { ChartFacts, ComparisonSection } from '../model/comparison';
import { algorithmDefinitions, enrichmentVersion } from '../model/algorithm-profiles';
import { enrichBaZi } from './bazi-enrichment';
import { enrichZiwei } from './ziwei-enrichment';
import { enrichWestern } from './western-enrichment';

export function enrichComparison(a: ChartFacts, b: ChartFacts, sections: ComparisonSection[]) {
  const additions = { bazi: enrichBaZi(a.bazi, b.bazi), ziwei: enrichZiwei(a, b), western: enrichWestern(a.western, b.western) };
  return sections.map((section) => ({
    ...section, evidence: [...section.evidence, ...additions[section.system].map((fact) => {
      const definition = algorithmDefinitions.find(({ system, rule }) => system === section.system && rule === fact.rule)!;
      return { ...fact, scope: definition.scope, layer: fact.rule.includes('composite') ? 'composite' as const : 'natal' as const,
        methodRefs: definition.methods, ruleVersion: enrichmentVersion,
        calculationProfileId: enrichmentVersion + ':' + definition.rule, limitations: [definition.limitation] };
    })],
  }));
}
