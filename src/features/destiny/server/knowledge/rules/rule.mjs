import { chartKeywords, chartVersions } from '../catalog.mjs';

export function makeRule({ id, method, layer, tradition, input, ancestry, topic, originalTopic = topic, source, basis, reading, limit }) {
  return {
    id, method, layer, tradition, schemaVersion: '1.1.0',
    applicability: { chartScope: 'natal', calculationProfile: chartVersions[method].rulesetVersion },
    input: { mustBeAbsent: [], ...input },
    source,
    sourceRefs: [{ sourceId: source.id, passageId: source.passageId, supportType: 'direct', supportNote: basis }],
    sourceCondition: ancestry,
    verification: { status: 'checked_online_passage', version: 1 },
    entry: { topic, keywords: chartKeywords(method, input.required), reading },
    reference: { basis, limit, originalTopic },
  };
}
