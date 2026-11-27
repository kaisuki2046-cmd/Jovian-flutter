import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../typescript-imports.mjs';
import { isConsistentZiweiFact } from './ziwei-fact-integrity.mjs';

function consistent(rule, facts, direction = 'a_to_b') {
  return isConsistentZiweiFact({ rule, direction, facts });
}

test('Ziwei cross-palace matching checks the actual branch relation, named palaces and direction', () => {
  const rule = 'ziwei-cross-palace-sector';
  const trine = { source: '夫妻', target: '命宫', sourceBranch: '寅', targetBranch: '午', offset: 4,
    relation: '顺四支三合', sourceMajorStars: '武曲', targetMajorStars: '太阳', sourceMinorStars: '', targetMinorStars: '左辅' };
  assert.ok(consistent(rule, trine));
  assert.equal(consistent(rule, { ...trine, relation: '对宫' }), false);
  assert.equal(consistent(rule, { ...trine, target: undefined }), false);
  assert.equal(consistent(rule, { ...trine, sourceMajorStars: undefined }), false);
  assert.equal(consistent(rule, trine, 'self_a'), false);
});

test('Ziwei same-branch facts require their palace, branch and transformation provenance', () => {
  const palaceRule = 'ziwei-palace-by-branch';
  const location = { source: '身宫', target: '命', branch: '亥' };
  assert.ok(consistent(palaceRule, location, 'b_to_a'));
  assert.equal(consistent(palaceRule, { ...location, source: '夫妻' }), false);
  assert.equal(consistent(palaceRule, { ...location, branch: undefined }), false);

  const transformationRule = 'ziwei-transformation-by-branch';
  const native = { source: '财帛', target: '田宅', branch: '辰', star: '廉贞', marker: '禄' };
  assert.ok(consistent(transformationRule, native));
  assert.equal(consistent(transformationRule, { ...native, marker: '科' }), false);
  assert.equal(consistent(transformationRule, { ...native, source: undefined }), false);
  assert.equal(consistent(transformationRule, { ...native, star: undefined }), false);
});

test('Ziwei palace-stem flight preserves the native landing and confirms the configured stem and marker', () => {
  const rule = 'ziwei-palace-stem-flight-overlay';
  const flight = { source: '命宫', sourceBranch: '子', heavenlyStem: '甲', star: '廉贞', marker: '禄',
    nativeLanding: '疾厄', branch: '未', target: '福德' };
  assert.ok(consistent(rule, flight));
  assert.ok(consistent(rule, { ...flight, nativeLanding: '命', branch: '子' }));
  assert.equal(consistent(rule, { ...flight, heavenlyStem: '乙' }), false);
  assert.equal(consistent(rule, { ...flight, branch: '子' }), false);
  assert.equal(consistent(rule, { ...flight, branch: '申' }), false);
  assert.equal(consistent(rule, { ...flight, nativeLanding: '命宫' }), false);
  assert.equal(consistent(rule, { ...flight, nativeLanding: undefined }), false);
});

test('Ziwei natal sector and palace facts keep the person, geometry and complete star lists', () => {
  const sectorRule = 'ziwei-natal-sector';
  const sector = { person: 'A', source: '夫妻', target: '夫妻', sourceBranch: '寅', targetBranch: '寅',
    offset: 0, relation: '同支', sourceStars: '破军、文昌', targetStars: '破军、文昌' };
  assert.ok(consistent(sectorRule, sector, 'self_a'));
  assert.equal(consistent(sectorRule, sector, 'self_b'), false);
  assert.equal(consistent(sectorRule, { ...sector, target: '官禄' }, 'self_a'), false);
  assert.equal(consistent(sectorRule, { ...sector, targetStars: '破军' }, 'self_a'), false);
  assert.equal(consistent(sectorRule, { ...sector, targetStars: undefined }, 'self_a'), false);
  const opposite = { ...sector, target: '官禄', targetBranch: '申', offset: 6, relation: '对宫', targetStars: '' };
  assert.ok(consistent(sectorRule, opposite, 'self_a'));
  assert.equal(consistent(sectorRule, { ...opposite, target: '田宅' }, 'self_a'), false);

  const palaceRule = 'ziwei-natal-palace';
  const palace = { person: 'A', palace: '夫妻', branch: '寅', majorStars: '破军', minorStars: '文昌',
    adjectiveStars: '', lifePalace: 0, bodyPalace: 1 };
  assert.ok(consistent(palaceRule, palace, 'self_a'));
  assert.equal(consistent(palaceRule, { ...palace, adjectiveStars: undefined }, 'self_a'), false);
  assert.equal(consistent(palaceRule, { ...palace, lifePalace: 1 }, 'self_a'), false);
});
