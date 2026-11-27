import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartVersions } from './catalog.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { createReportLookup } from './report-lookup.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-2-20261118.json', import.meta.url)));
test('second batch reaches SQLite and report materials with every original qualifier retained', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-two-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const catalog = catalogForDirectory(directory);
  catalog.ensure();
  const report = createReportLookup(directory);
  const query = (method, facts) => ({ method, rulesetVersion: chartVersions[method].rulesetVersion, confirmedFacts: facts });
  assert.equal(batch.changes.length, 13);
  for (const { id, method } of batch.changes) {
    const row = catalog.get(id);
    assert.ok(row.inputs?.length, id);
    for (const input of row.inputs) {
      const request = query(method, input.required);
      assert.ok(lookupInterpretations(directory, request).some(hit => hit.id === id), id);
    }
    const input = row.inputs[0];
    const groups = report([query(method, input.required)]);
    assert.ok(buildReportMaterials(groups).includes(row.claim.evidence.original_text), id);
    assert.ok(!lookupInterpretations(directory, query(method, [])).some(hit => hit.id === id), id);
    for (const kind of ['natal_gender', 'natal_ziwei_bureau']) {
      const qualifier = input.required.find(fact => fact.kind === kind);
      if (!qualifier) continue;
      const without = input.required.filter(fact => fact !== qualifier);
      assert.ok(!lookupInterpretations(directory, query(method, without)).some(hit => hit.id === id), id + ': absent ' + kind);
      const wrong = kind === 'natal_gender' ? { ...qualifier, gender: '男' }
        : { ...qualifier, bureau: qualifier.bureau === '水二局' ? '火六局' : '水二局' };
      assert.ok(!lookupInterpretations(directory, query(method, [...without, wrong])).some(hit => hit.id === id), id + ': wrong ' + kind);
    }
  }
  const id = 'qtbj-v5-c088-p001-101';
  const base = [{ kind: 'branch', position: 'month', branch: '亥' }, { kind: 'stem', position: 'day', stem: '辛' },
    { kind: 'stem', position: 'year', stem: '壬' }];
  const hits = facts => lookupInterpretations(directory, query('bazi', facts)).some(row => row.id === id);
  assert.equal(hits(base), false, 'one visible stem does not satisfy both');
  assert.equal(hits([...base, { kind: 'branch', position: 'hour', branch: '寅' }]), false, 'hidden 丙 is not visible 丙');
  assert.equal(hits([...base, { kind: 'stem', position: 'hour', stem: '丙' }]), true);
  assert.equal(hits([...base.filter(f => f.kind !== 'branch'), { kind: 'branch', position: 'month', branch: '子' },
    { kind: 'stem', position: 'hour', stem: '丙' }]), false, 'wrong month');
  const hiddenId = 'qtbj-v5-c088-p002-101';
  assert.ok(lookupInterpretations(directory, query('bazi', [...base, { kind: 'branch', position: 'hour', branch: '寅' }]))
    .some(row => row.id === hiddenId));
  assert.ok(!lookupInterpretations(directory, query('bazi', [...base, { kind: 'stem', position: 'hour', stem: '丙' }]))
    .some(row => row.id === hiddenId), 'visible 丙 does not establish hidden 丙');
});
