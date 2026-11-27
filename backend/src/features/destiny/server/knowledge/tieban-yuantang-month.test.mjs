import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';
import { createHistoricalTiebanLookup, historicalTest as test } from './test-fixtures/tieban.mjs';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { parseInput } from '../report.mjs';
import { catalogFile } from './database.mjs';
import { chenHeluoLinesProfile, chenHeluoNajiaProfile, heluoProfile, taiXuanFormsProfile, tiebanBaseNumbers } from './tieban.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-yuantang-month-'));
const lookup = createHistoricalTiebanLookup(directory);
after(() => {
  rmSync(join(directory, catalogFile), { force: true });
  rmdirSync(directory);
});

function birth(localTime, gender = '男') {
  const wall = Date.parse(`${localTime}:00:00Z`);
  const chart = calculateBaZi(wall - 8 * 3600000, wall, gender === '男' ? 'male' : 'female');
  return {
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, birthYear: new Date(wall).getUTCFullYear(),
    confirmedFacts: [...chartFacts.bazi(chart), { kind: 'natal_gender', gender }],
  };
}

const calculation = (tieban, profile) => tieban.additionalCalculations.find(row => row.profile === profile);
const trigrams = ({ upper, lower }) => upper + lower;
const taiXuanAxes = ['earlier_transformed', 'earlier_transformed_mutual'];
const heluoProfiles = [heluoProfile, chenHeluoLinesProfile, chenHeluoNajiaProfile];
const heluoLater = row => row.axis.endsWith('_later') || row.axis.includes('_later_');

test('Qianji year and month use the two stated exceptions for each of the three natal hexagrams', () => {
  const fixtures = [
    ['1904-02-24T02', '寅', 5, '坎坎', '坎坤', [2678, 3788]],
    ['1904-02-24T14', '寅', 6, '坎坎', '坎坎', [2674, 3788]],
    ['1905-01-28T02', '丑', 5, '坎坎', '坎坎', [2674, 3788]],
    ['1905-01-28T14', '丑', 6, '坎坎', '坎巽', [2632, 9363]],
    ['1907-05-22T02', '巳', 5, '坎震', '震坎', [1463, 2636]],
    ['1907-05-22T14', '巳', 6, '坎震', '震巽', [1421, 8211]],
    ['1907-08-15T02', '申', 5, '坎震', '震坤', [1467, 2636]],
    ['1907-08-15T14', '申', 6, '坎震', '震坎', [1463, 2636]],
    ['1907-09-22T02', '酉', 5, '坎艮', '艮坎', [3784, 4888]],
    ['1907-09-22T14', '酉', 6, '坎艮', '艮巽', [3742, 1463]],
    ['1907-12-15T02', '子', 5, '坎艮', '艮坤', [3788, 4888]],
    ['1907-12-15T14', '子', 6, '坎艮', '艮坎', [3784, 4888]],
  ];
  for (const [time, month, line, earlier, later, numbers] of fixtures) {
    const { confirmedFacts, birthYear } = birth(time);
    const raw = tiebanBaseNumbers(confirmedFacts, birthYear);
    const transformed = calculation(raw, taiXuanFormsProfile).candidates.filter(row => taiXuanAxes.includes(row.axis));
    assert.equal(confirmedFacts.filter(fact => fact.kind === 'pillar')[1].ganZhi[1], month, time);
    assert.deepEqual([trigrams(raw.candidates[0]), trigrams(transformed[0]), transformed[0].yuanTangLine], [earlier, later, line], time);
    assert.deepEqual(transformed.map(row => row.clauseId), numbers, time);
  }
});

test('Heluo keeps the line in its original seat only for the printed exceptions', () => {
  const fixtures = [
    ['1904-07-03T02', '男', 5, '坎坎', '坎坤', 7182],
    ['1909-03-02T14', '男', 6, '坎坎', '巽坎', 1483],
    ['1928-11-15T02', '男', 5, '坎坎', '坤坎', 8223],
    ['1900-10-08T14', '男', 6, '坎坎', '坎巽', 7197],
    ['1905-12-21T02', '女', 5, '坎震', '震坤', 9318],
    ['1903-08-27T14', '女', 6, '坎震', '巽震', 1482],
    ['1900-07-15T02', '女', 5, '坎震', '坤震', 8222],
    ['1900-03-15T14', '男', 6, '坎震', '震巽', 9376],
    ['1900-01-01T02', '女', 5, '坎艮', '艮坤', 4822],
    ['1900-05-01T22', '女', 6, '坎艮', '巽艮', 1491],
    ['1900-10-08T02', '男', 5, '坎艮', '坤艮', 8231],
    ['1902-07-09T14', '男', 6, '坎艮', '艮巽', 4837],
  ];
  for (const [time, gender, line, earlier, later, number] of fixtures) {
    const { confirmedFacts, birthYear } = birth(time, gender);
    const raw = tiebanBaseNumbers(confirmedFacts, birthYear);
    const [natal, transformed] = calculation(raw, heluoProfile).candidates;
    const chenLine = calculation(raw, chenHeluoLinesProfile).candidates.find(heluoLater);
    assert.deepEqual([trigrams(natal), trigrams(transformed), transformed.clauseId], [earlier, later, number], time);
    assert.deepEqual([trigrams(chenLine), chenLine.yuanTangLine], [later, line], time);
  }
});

test('every observed hit from the exceptions reaches the report with its SQLite claim, and missing numbers stay unmatched', () => {
  const witnesses = [
    ['1904-02-24T14', '男', [3788], [2674]],
    ['1907-09-22T02', '男', [3784], [4888]],
    ['1900-05-01T22', '女', [3942], []],
    ['1900-10-08T02', '男', [3342, 3246], []],
    ['1903-08-27T14', '女', [1482, 4261, 3945], []],
    ['1906-02-18T22', '男', [4357], []],
    ['1909-03-02T14', '男', [1483, 4359, 3926, 4022, 3830], [4263]],
    ['1928-11-15T02', '男', [8223, 2383], []],
  ];
  const ids = new Set();
  for (const [time, gender, hits, misses] of witnesses) {
    const input = parseInput({ timeKnown: true, chartQueries: [birth(time, gender)] });
    const references = lookup(input.chartQueries);
    const { tieban } = references.find(ref => ref.tieban);
    const rows = [
      ...calculation(tieban, taiXuanFormsProfile).results.filter(row => taiXuanAxes.includes(row.axis)),
      ...heluoProfiles.flatMap(profile => calculation(tieban, profile)?.results.filter(heluoLater) ?? []),
    ];
    const materials = buildReportMaterials(references);
    for (const number of hits) {
      const hit = rows.find(row => row.clauseId === number && row.status === 'matched');
      assert.ok(hit, `${time} ${number}`);
      assert.ok(materials.includes(hit.claim.evidence.original_text), `${time} ${number}`);
      ids.add(hit.claim.id);
    }
    for (const number of misses) {
      const result = rows.find(row => row.clauseId === number);
      assert.deepEqual([result?.status, result?.reason, result?.claim], ['unmatched', 'not_in_catalog', undefined], `${time} ${number}`);
    }
  }
  assert.equal(ids.size, 16);
});
