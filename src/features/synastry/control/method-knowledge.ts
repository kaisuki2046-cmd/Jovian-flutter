import { algorithmDefinitions } from '../model/algorithm-profiles';
import type { System } from '../model/interpretation';
import { methodLibrary } from '../model/method-diagnostics';

export { methodLibrary };

export function methodRefsForFact(system: System, rule: string) {
  if (system === 'bazi' && rule === 'branch-opposition') return ['BZ-M19'];
  return algorithmDefinitions.find((item) => item.system === system && item.rule === rule)?.methods
    ?? methodLibrary.factMethodAdaptation.byFactType.find(({ factTypeId }) => factTypeId === `${system}:${rule}`)?.methodRefs ?? [];
}
