import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { normalizeFacts } from './catalog.mjs';
import { chartContext } from './matching.mjs';
import { claimChartContext } from './claims.mjs';
import { parseChartQueries } from './report-lookup.mjs';
import { chartVersions } from './catalog.mjs';
import { quanshuMinggongProfile, quanshuMinggongStars, quanshuMinggongStar,
  quanshuMinggongBrightness, quanshuMinggongFacts } from './quanshu-minggong.mjs';
const star = (name, palace = '命宫', scope = 'origin') => ({ kind: 'palace_star', palace, star: name, scope });
const branch = value => ({ kind: 'palace_branch', palace: '命宫', branch: value });

test('all 183 source table cells match the immutable original passages and all nine omissions stay unknown', () => {
  const claims = JSON.parse(readFileSync(new URL('./claims/ziwei.json', import.meta.url)));
  const evidence = new Map(quanshuMinggongStars.map(name => [name, new Set()]));
  for (const claim of claims) {
    const name = quanshuMinggongStar(claim);
    if (name) evidence.get(name).add(claim.evidence.original_text);
  }
  const levels = { 入庙: '庙', 庙: '庙', 旺地: '旺', 旺宫: '旺', 旺: '旺', 得地: '得', 利益: '利', 利: '利', 和平: '平', 陷地: '陷', 陷: '陷', 不得地: '不' };
  let defined = 0, unknown = 0;
  for (const [name, passages] of evidence) {
    assert.ok(passages.size, name);
    const observed = new Map();
    for (const text of passages) for (const match of text.matchAll(/([子丑寅卯辰巳午未申酉戌亥]+)(?:宫)?(入庙|庙|旺地|旺宫|旺|得地|利益|利|和平|陷地|陷|不得地)/gu)) {
      for (const value of match[1]) {
        const brightness = levels[match[2]];
        if (observed.has(value)) assert.equal(observed.get(value), brightness, name + value + ': consistent source');
        observed.set(value, brightness);
      }
    }
    for (const value of '子丑寅卯辰巳午未申酉戌亥') {
      const expected = observed.get(value) ?? null;
      assert.equal(quanshuMinggongBrightness(name, value), expected, name + value);
      const facts = quanshuMinggongFacts([star(name), branch(value)]);
      assert.equal(facts.length, expected ? 1 : 0, name + value);
      if (expected) { assert.equal(facts[0].brightness, expected); defined++; } else unknown++;
    }
  }
  assert.equal(defined, 183);
  assert.equal(unknown, 9);
  assert.equal(quanshuMinggongBrightness('天梁', '申'), '陷', 'table differs from the later verse');
  assert.equal(quanshuMinggongBrightness('天梁', '巳'), null);
});

test('source brightness is derived only from consistent original life-palace locations, never from supplied derived flags', () => {
  const valid = [star('天梁'), branch('丑')];
  const forged = { kind: 'palace_source_brightness', palace: '命宫', star: '天梁', branch: '丑', scope: 'origin', brightness: '陷', profile: quanshuMinggongProfile };
  for (const facts of [[], [forged], [star('天梁')], [branch('丑')], [star('天梁', '兄弟'), branch('丑')],
    [...valid, branch('未')], [...valid, star('天梁', '兄弟')],
    [...valid, { kind: 'palace_branch', palace: '兄弟', branch: '丑' }], [star('天梁', '命宫', 'decadal'), branch('丑')]]) {
    assert.deepEqual(quanshuMinggongFacts(facts), []);
  }
  assert.deepEqual(quanshuMinggongFacts(valid, 'annual'), []);
  const result = claimChartContext('ziwei', chartContext('ziwei', [...valid, forged], [
    { ...forged, brightness: '庙' },
  ]));
  const derived = result.present.filter(fact => fact.kind === 'palace_source_brightness');
  assert.equal(derived.length, 1);
  assert.equal(derived[0].brightness, '庙');
  assert.ok(!result.absentKeys.has(JSON.stringify(normalizeFacts('ziwei', [{ ...forged, brightness: '庙' }])[0])));
  assert.throws(() => normalizeFacts('ziwei', [{ ...forged, profile: 'other-book' }]));
  assert.throws(() => normalizeFacts('ziwei', [{ ...forged, brightness: '闲' }]));
});

test('report parsing removes supplied profile assertions and time-unknown Ziwei palace data', () => {
  const derived = quanshuMinggongFacts([star('天梁'), branch('丑')])[0];
  const query = { method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion,
    confirmedFacts: [star('天梁'), branch('丑'), derived], confirmedAbsentFacts: [{ ...derived, brightness: '陷' }] };
  const [known] = parseChartQueries([query]);
  assert.ok(!known.confirmedFacts.some(fact => fact.kind === 'palace_source_brightness'));
  assert.deepEqual(known.confirmedAbsentFacts, []);
  const [unknown] = parseChartQueries([query], { timeKnown: false });
  assert.deepEqual(unknown.confirmedFacts, []);
  assert.deepEqual(unknown.confirmedAbsentFacts, []);
});
