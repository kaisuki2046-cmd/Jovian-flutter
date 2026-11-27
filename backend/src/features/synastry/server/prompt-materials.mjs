import { summarySections } from '../model/summary.ts';

const directionLabels = { a_to_b: 'A方作用于B方', b_to_a: 'B方作用于A方', common: '双方共同' };
const contentLabels = { personality: '相处表现', fact: '事件倾向' };

function sharedReferences(rows, prefix) {
  const counts = new Map();
  for (const row of rows) counts.set(row, (counts.get(row) ?? 0) + 1);
  return new Map([...counts].filter(([, count]) => count > 1)
    .map(([row], index) => [row, `〔${prefix}${index + 1}〕`]));
}

export function buildSummaryMaterials(evidence) {
  const sections = summarySections.map(({ type, label }) => ({
    label,
    entries: evidence[type].basis.map(({ direction, contentType, interpretation, originalText, originalConditions }) => ({
      heading: `${directionLabels[direction]}｜${contentLabels[contentType]}`,
      interpretation,
      original: JSON.stringify(originalText),
      conditions: JSON.stringify(originalConditions),
    })),
  }));
  const all = sections.flatMap(({ entries }) => entries);
  const originals = sharedReferences(all.map(({ original }) => original), '原');
  const conditions = sharedReferences(all.map((entry) => entry.conditions), '条');
  const sceneRows = sections.map(({ label, entries }) => ({
    label,
    rows: [...new Set(entries.map((entry) => [
      entry.heading,
      `  现代解读：${entry.interpretation}`,
      `  原文：${originals.get(entry.original) ?? entry.original}`,
      `  原文命中条件：${conditions.get(entry.conditions) ?? entry.conditions}`,
    ].join('\n')))],
  }));
  const shared = sharedReferences(sceneRows.flatMap(({ rows }) => rows), '释');
  const blocks = [];
  if (originals.size || conditions.size) {
    blocks.push([
      '【共用原文与条件】',
      ...[...originals].map(([text, id]) => `${id} 原文：${text}`),
      ...[...conditions].map(([text, id]) => `${id} 原文命中条件：${text}`),
    ].join('\n'));
  }
  if (shared.size) {
    blocks.push(['【共用命中解读】', ...[...shared].map(([row, id]) => `${id} ${row}`)].join('\n'));
  }
  for (const { label, rows } of sceneRows) {
    const lines = rows.length ? rows.map((row) => `- ${shared.get(row) ?? row}`) : ['本类暂无命中解读。'];
    blocks.push([`【${label}命中解读】`, ...lines].join('\n'));
  }
  return blocks.join('\n\n');
}
