export type LibraryMethod = {
  methodId: string;
  system: 'bazi' | 'ziwei' | 'western';
  name: string;
  procedure: { step: number; operation: string; requiredInputs: string[]; produces: string[] }[];
  expectedOutputs: string[];
  limitations: string[];
  sourceRefs: string[];
  missingFactTypes: string[];
  releaseStatus: string;
  locator: { chapterId: string; startPage: number; heading: string };
};

export type LibraryEntry = {
  entryId: string;
  sourceClaimId: string;
  system: LibraryMethod['system'];
  factTypeId: string;
  title: string;
  tags: string[];
  match: { direction?: string[]; facts: Record<string, (string | number)[]> };
  topics: string[];
  content: { coreMeaning: string; interpretation: string; observableExamples: string[]; limitations: string[] };
  editorialClaim: {
    source: LibraryPassage;
    evidence: { original_text?: string; context?: string; supporting?: { source: LibraryPassage }[] };
    interpretation: { classical_meaning: string };
    conditions: { original: string[]; normalized: string[]; uncertain: string[]; excluded: string[];
      match?: { version: number; status: string; include: unknown[][]; exclude: unknown[][]; reason?: string | null } };
  };
};
export type LibraryPassage = {
  passage_id: string; book: string; author?: string | null; edition?: string | null;
  volume?: string | null; chapter?: string | null; section?: string | null; url?: string | null;
};
export type ReferenceBranch = {
  id: string;
  title: string;
  category: { topic: string; type: string; tags: string[]; topics: string[] };
  context?: string;
  supporting: { claimId: string; context?: string }[];
  conditions: Omit<LibraryEntry['editorialClaim']['conditions'], 'match'>;
  interpretation: { classical_meaning: string; fact_meaning: string; modern_explanation: string;
    observable_examples: string[]; limitations: string[] };
  sourceRefs: { sourceId: string; title: string; author: string; location: string; note: string }[];
  provenance: { status: string; version: number };
};
export type ReferenceClaim = {
  id: string;
  source: LibraryPassage;
  evidence: { original_text: string; context?: string };
  provenance: { kind: string; role?: string; sourceRefs: string[] };
  branches: ReferenceBranch[];
};
export type MethodLibrary = {
  methodLibrary: { methods: LibraryMethod[] };
  factMethodAdaptation: { byFactType: { factTypeId: string; methodRefs: string[] }[] };
};
