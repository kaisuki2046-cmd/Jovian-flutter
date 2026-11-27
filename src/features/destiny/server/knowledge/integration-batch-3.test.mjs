import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartVersions } from './catalog.mjs';
import { createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-3-20261118.json', import.meta.url)));
test('branch-bound placement and contextual palace references reach SQLite and report materials without losing qualifiers', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-three-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const catalog = catalogForDirectory(directory);
  catalog.ensure();
  const report = createReportLookup(directory);
  const request = facts => ({ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts: facts });
  const matches = (id, facts) => lookupInterpretations(directory, request(facts)).some(hit => hit.id === id);
  assert.equal(batch.changes.length, 8);
  for (const { id } of batch.changes) {
    const row = catalog.get(id);
    assert.ok(row.inputs?.length, id);
    for (const input of row.inputs) assert.ok(matches(id, input.required), id);
    const facts = row.inputs[0].required;
    assert.ok(buildReportMaterials(report([request(facts)])).includes(row.claim.evidence.original_text), id);
    assert.equal(matches(id, []), false, id + ': unknown facts');
    for (const kind of ['palace_branch', 'body_palace', 'natal_year_stem']) {
      const qualifier = facts.find(fact => fact.kind === kind);
      if (!qualifier) continue;
      const rest = facts.filter(fact => fact !== qualifier);
      assert.equal(matches(id, rest), false, id + ': missing ' + kind);
      const wrong = kind === 'palace_branch' ? { ...qualifier, branch: qualifier.branch === '子' ? '丑' : '子' }
        : kind === 'natal_year_stem' ? { ...qualifier, stem: '乙' }
          : { ...qualifier, palace: qualifier.palace === '命宫' ? '迁移' : '命宫' };
      assert.equal(matches(id, [...rest, wrong]), false, id + ': wrong ' + kind);
    }
  }
  const star = (palace, name) => ({ kind: 'palace_star', palace, star: name, scope: 'origin' });
  const together = 'ziwei-v3-xingjue-051-p656-001';
  assert.equal(matches(together, [star('财帛', '天府'), star('夫妻', '地劫')]), false);
  assert.equal(matches(together, [star('夫妻', '天府'), star('夫妻', '地劫')]), false);
  assert.equal(matches(together, [star('财帛', '天府'), star('财帛', '地劫')]), true);
  const here = 'ziwei-v2-jielan-101-p015-024';
  const branch = { kind: 'palace_branch', palace: '疾厄', branch: '戌' };
  assert.equal(matches(here, [branch, star('命宫', '破军')]), false);
  assert.equal(matches(here, [branch, star('疾厄', '破军')]), true);
});
