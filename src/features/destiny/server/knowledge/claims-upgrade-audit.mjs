import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claimInventory, pendingClaimConditions, structuredClaimMappings } from './claims.mjs';
import { claimCatalogDigest } from './claim-compat.mjs';

export function claimUpgradeSummary() {
  const manifest = JSON.parse(readFileSync(new URL('./claims/upgrade-manifest.json', import.meta.url)));
  const inventory = claimInventory();
  const catalogs = {};
  for (const [method, source] of Object.entries(manifest.catalogs)) {
    const rows = inventory.filter(row => row.method === method);
    const sha256 = claimCatalogDigest(readFileSync(new URL(`./claims/${method}.json`, import.meta.url)));
    if (sha256 !== source.sha256 || rows.length !== source.count) throw new Error('Upgrade manifest differs from catalog: ' + method);
    const status = {}, reasons = {}, machineStatus = {};
    for (const { claim, lookup } of rows) {
      status[lookup.status] = (status[lookup.status] ?? 0) + 1;
      if (lookup.reason && lookup.status === 'unmapped') reasons[lookup.reason] = (reasons[lookup.reason] ?? 0) + 1;
      const state = claim.conditions.match?.status ?? 'legacy_text_conditions';
      machineStatus[state] = (machineStatus[state] ?? 0) + 1;
    }
    const historicalAphorismSources = rows.filter(row => row.lookup.matchScope === 'historical_aphorism').length;
    catalogs[method] = { ...source, status, reasons, machineStatus, revisedConditions: manifest.changedConditionIds[method].length,
      calculationReferenceSources: rows.filter(row => row.lookup.calculationReference).length,
      ...(historicalAphorismSources && { historicalAphorismSources }),
      revisedEvidence: new Set([...manifest.changedEvidenceIds[method],
        ...rows.filter(row => row.lookup.revisedEvidence).map(row => row.claim.id)]).size };
  }
  return { version: 1, importedAt: manifest.importedAt, digestFormat: manifest.digestFormat, total: inventory.length, catalogs };
}

function writeAudit() {
  const summary = claimUpgradeSummary();
  writeFileSync(new URL('./claims/upgrade-audit.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
  writeFileSync(new URL('./claims/condition-mappings.jsonl', import.meta.url), [...structuredClaimMappings()].map(row => JSON.stringify(row)).join('\n') + '\n');
  const columns = [['method', '术数'], ['id', '条目 ID'], ['title', '标题'], ['status', '映射状态'], ['reason', '整条未索引原因'],
    ['recognized', '已识别条件'], ['unresolved', '未映射条件'], ['uncertain', '原库待核'], ['excluded', '原库排除项'],
    ['branches', '可判定分句'], ['reviewNote', '排盘与原文复核'], ['normalized', '西洋库原归一化条件'],
    ['sourceNote', '原库匹配说明'], ['sourceMatchStatus', '原库机器条件状态'], ['calculationRequirements', '计算需求'],
    ['revisedConditions', '原有条件已修订'], ['revisedEvidence', '原有摘录已修订'], ['source', '出处']];
  const cell = value => '"' + String(Array.isArray(value) ? value.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(' ｜ ') : value ?? '').replaceAll('"', '""') + '"';
  for (const [name, includeSkipped, filter] of [['pending-conditions.csv', false, () => true],
    ['source-review.csv', true, row => row.uncertain.length || row.reason === 'source_review_required' || row.reviewNote || row.revisedConditions || row.revisedEvidence]]) {
    const rows = pendingClaimConditions({ includeSkipped }).filter(filter);
    const lines = [columns.map(([, title]) => cell(title)).join(','), ...rows.map(row => columns.map(([key]) => cell(row[key])).join(','))];
    writeFileSync(new URL('./claims/' + name, import.meta.url), '\uFEFF' + lines.join('\r\n') + '\r\n');
  }
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(arg => arg !== '--write')) throw new Error('Usage: claims-upgrade-audit.mjs [--write]');
  console.log(JSON.stringify(process.argv.includes('--write') ? writeAudit() : claimUpgradeSummary(), null, 2));
}
