import type { RelationshipType, ReviewedRecord, SourceReference, System, ThemeId } from './interpretation';

export const combinationInteractions = [
  'reinforces', 'mitigates', 'aggravates', 'contradicts', 'requires_context', 'duplicate_or_dependent',
] as const;

export type CombinationRule = ReviewedRecord & {
  id: string;
  systemScope: System[] | 'cross_system';
  requiredKnowledgeIds: string[];
  relationshipTypes: RelationshipType[];
  themeIds: ThemeId[];
  interaction: typeof combinationInteractions[number];
  conditions: 'same_direction'[];
  explanation: string;
  limitations: string[];
  sourceIds: string[];
};

export type CombinationResult = {
  combinationId: string;
  ruleId: string;
  ruleVersion: string;
  interaction: CombinationRule['interaction'];
  relationshipType: RelationshipType;
  themeIds: ThemeId[];
  explanation: string;
  limitations: string[];
  evidenceIds: string[];
  factIds: string[];
  sourceRefs: SourceReference[];
};
