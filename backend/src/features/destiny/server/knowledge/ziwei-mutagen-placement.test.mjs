import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateZiwei, chartFacts } from '../../control/charts.ts';
import { compileClaimSources } from './claims.mjs';
import { defaultZiweiMutagens, compatibleZiweiNatalMutagens, ziweiMutagenSourceDisposition, ziweiMutagenEditorialCondition } from './ziwei-mutagen-placement.mjs';
import { ziweiSourcePassageDisposition } from './ziwei-source-passages.mjs';

const sources = JSON.parse(readFileSync(new URL('./claims/ziwei.json', import.meta.url)));
const ids = ['ziwei-v2-jielan-072-p002-002', 'ziwei-v4-jielan-203-p002-001', 'ziwei-v2-minggong-p323001-033'];
const mutagen = (star, change, scope = 'origin') => ({ kind: 'star_mutagen', palace: '命宫', star, change, scope });
function fixture(context, claims) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-mutagen-source-'));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-mutagen-source-')); rmSync(directory, { recursive: true, force: true }); });
  for (const method of ['bazi', 'ziwei', 'western']) writeFileSync(join(directory, method + '.json'), JSON.stringify(method === 'ziwei' ? claims : []));
  // Keep revision guards: a revised source must not revive an old manual passage.
  writeFileSync(join(directory, 'upgrade-manifest.json'), readFileSync(new URL('./claims/upgrade-manifest.json', import.meta.url)));
  return directory;
}

test('the default four transformations agree with native iztro for all ten birth stems', () => {
  const observed = new Set();
  for (let year = 1984; year < 1994; year++) {
    const raw = chartFacts.ziwei(calculateZiwei({ date: { year, month: 7, day: 15 }, gender: 'female' }, 0));
    const stem = raw.find(f => f.kind === 'natal_year_stem').stem; observed.add(stem);
    assert.equal(compatibleZiweiNatalMutagens(raw), true, String(year));
    const changes = raw.filter(f => f.kind === 'star_mutagen' && f.scope === 'origin');
    assert.equal(changes.length, 4);
    for (const f of changes) assert.equal(defaultZiweiMutagens['甲乙丙丁戊己庚辛壬癸'.indexOf(stem)]['禄权科忌'.indexOf(f.change)], f.star);
    for (const f of changes) assert.equal(compatibleZiweiNatalMutagens(raw.map(candidate => candidate === f ? { ...f, star: f.star === '太阳' ? '太阴' : '太阳' } : candidate)), false);
  }
  assert.equal(observed.size, 10);
  // This module uses lunar New Year, rather than borrowing the Bazi 立春 year.
  for (const [day, stem] of [[1, '癸'], [3, '甲']]) {
    const raw = chartFacts.ziwei(calculateZiwei({ date: { year: 1984, month: 2, day }, gender: 'female' }, 0));
    assert.equal(raw.find(f => f.kind === 'natal_year_stem').stem, stem);
    assert.equal(compatibleZiweiNatalMutagens(raw), true);
  }
});

test('the finite year constraint preserves sixty legal pillars and rejects impossible year and transformation combinations', () => {
  const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
  for (let i = 0; i < 60; i++) assert.equal(compatibleZiweiNatalMutagens([{ kind: 'natal_year_stem', stem: stems[i % 10] }, { kind: 'natal_year_branch', branch: branches[i % 12] }]), true);
  assert.equal(compatibleZiweiNatalMutagens([{ kind: 'natal_year_stem', stem: '甲' }, { kind: 'natal_year_branch', branch: '丑' }]), false);
  for (const [stem, star] of [['辛', '巨门'], ['丁', '天同']]) assert.equal(compatibleZiweiNatalMutagens([{ kind: 'natal_year_stem', stem }, mutagen(star, '忌')]), false);
  assert.equal(compatibleZiweiNatalMutagens([mutagen('太阳', '忌'), mutagen('太阴', '忌')]), false);
  assert.equal(compatibleZiweiNatalMutagens([mutagen('太阳', '忌')]), true, 'unknown year may remain possible without inventing a year');
});

test('other periods neither impose a natal transformation nor generate missing positive facts', () => {
  const facts = [{ kind: 'natal_year_stem', stem: '辛' }, mutagen('巨门', '忌', 'yearly')], before = structuredClone(facts);
  assert.equal(compatibleZiweiNatalMutagens(facts), true); assert.deepEqual(facts, before);
  assert.equal(compatibleZiweiNatalMutagens([]), true);
});

test('source fingerprints protect both bounded whole records and the positive 命宫 passage', context => {
  for (const id of ids) {
    const source = sources.find(row => row.id === id), disposition = id === ids[2] ? ziweiSourcePassageDisposition : ziweiMutagenSourceDisposition;
    assert.equal(disposition(source), true);
    for (const field of ['source', 'conditions', 'evidence']) {
      const changed = structuredClone(source);
      if (field === 'source') changed.source.edition += '修订';
      if (field === 'conditions') changed.conditions.normalized.push('另须未定义的条件');
      if (field === 'evidence') changed.evidence.original_text += '另有条件';
      assert.equal(disposition(changed), false);
      const [row] = compileClaimSources(fixture(context, [changed]));
      assert.ok(!row.inputs?.length); assert.deepEqual(row.branches, []);
    }
  }
});

test('editorial source labels are removed only for the exact reviewed source, never as a generic 按本篇 shortcut', context => {
  const source = sources.find(row => row.id === ids[0]);
  assert.equal(ziweiMutagenEditorialCondition(source, '按本篇水乡克火'), true);
  const changed = structuredClone(source); changed.id = 'test-unknown-mutagen-prerequisite';
  assert.equal(ziweiMutagenEditorialCondition(changed, '按本篇水乡克火'), false);
  const [row] = compileClaimSources(fixture(context, [changed])); assert.ok(!row.inputs?.length); assert.deepEqual(row.branches, []);
});

test('the three contradictory source-year records stay outside the versioned catalog', () => {
  const removed = new Set(['ziwei-v3-c020-p133011-001', 'ziwei-v2-minggong-p319003-002', 'ziwei-v2-minggong-p319003-003']);
  assert.ok(sources.every(row => !removed.has(row.id)));
});
