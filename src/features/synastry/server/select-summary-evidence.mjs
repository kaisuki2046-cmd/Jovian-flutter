import { summarySections } from '../model/summary.ts';

const quotas = { a_to_b: 40, b_to_a: 40, common: 30 };

export function summaryDirection(proofs) {
  const directions = new Set(proofs.map(({ direction }) => direction));
  const forward = directions.has('a_to_b');
  const reverse = directions.has('b_to_a');
  if (forward !== reverse) return forward ? 'a_to_b' : 'b_to_a';
  if (forward || directions.has('mutual') || directions.has('whole')
    || (directions.has('self_a') && directions.has('self_b'))) return 'common';
  return null;
}

export function selectSummaryEvidence(evidence) {
  const selected = { ...evidence };
  for (const { type } of summarySections) {
    const section = evidence[type];
    const ranked = section.basis.flatMap((entry) => {
      if (!entry.source) return [];
      const direction = summaryDirection(entry.proofs);
      if (!direction) return [];
      return [{ entry, direction }];
    }).sort((a, b) => b.entry.scores.condition - a.entry.scores.condition
      || b.entry.scores.content - a.entry.scores.content
      || b.entry.scores.source - a.entry.scores.source
      || a.entry.id - b.entry.id);

    const remaining = { ...quotas };
    const sent = new Set();
    const basis = [];
    for (const { entry, direction } of ranked) {
      if (!remaining[direction]) continue;
      const key = `${entry.id}:${direction}`;
      if (sent.has(key)) continue;
      basis.push({ ...entry, direction });
      sent.add(key);
      remaining[direction]--;
    }
    selected[type] = { ...section, basis };
  }
  return selected;
}

export function groupSummaryEvidence({ hits, ...evidence }) {
  const sections = Object.fromEntries(summarySections.map(({ type, label }) => [type, { label, basis: [] }]));
  for (const hit of hits) {
    sections[hit.topic].basis.push(hit);
  }
  return { ...evidence, ...sections };
}
