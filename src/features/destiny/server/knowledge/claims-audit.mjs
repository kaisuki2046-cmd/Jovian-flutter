import { mkdtempSync, readFileSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claimForPrompt, claimInventory, pendingClaimConditions, structuredClaimMappings } from './claims.mjs';
import { catalogFile } from './database.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

register('data:text/javascript,' + encodeURIComponent(
  'export function resolve(s, c, n) { return n(s.startsWith(".") && !s.endsWith(".ts") && '
  + '["/birth-places.ts", "/local-reading.ts", "/requests/report.ts"].some(p => c.parentURL?.endsWith(p)) ? s + ".ts" : s, c); }',
));

const { runReading } = await import('../../control/local-reading.ts');
const { birthPlaces } = await import('../../model/birth-profile.ts');
const { findBirthPlace } = await import('../../model/birth-places.ts');
const { buildReportRequest } = await import('../../requests/report.ts');
const directory = mkdtempSync(join(tmpdir(), 'destiny-claims-audit-'));
try {
  const lookup = createReportLookup(directory);
  const status = {};
  const inventory = claimInventory();
  const baseline = JSON.parse(readFileSync(new URL('./claims/mapping-baseline.json', import.meta.url), 'utf8'));
  const target = new Map(Object.entries(baseline).flatMap(([method, ids]) => ids.map((id) => [id, method])));
  const targetInventory = inventory.filter(({ claim }) => target.has(claim.id));
  if (target.size !== 1438
    || targetInventory.some(({ method, claim }) => target.get(claim.id) !== method)) throw new Error('Original mapping target changed.');
  for (const { method, lookup: review } of inventory) {
    const value = status[method] ??= {};
    const id = review.status === 'unmapped' ? review.reason : review.status;
    value[id] = (value[id] ?? 0) + 1;
  }
  const methods = ['bazi', 'ziwei', 'western'];
  const metrics = Object.fromEntries(methods.map((method) =>
    [method, { covered: 0, full: 0, branch: 0, hits: 0, max: 0, ids: new Set(), byTopic: {}, byLayer: {} }]));
  const cities = [birthPlaces[0], birthPlaces.at(-1), birthPlaces.at(-2)];
  let seed = 41641681;
  const next = (limit) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return Math.floor(seed / 2 ** 32 * limit); };
  const examples = [
    ...[
      [1908, 9, 25, '酉申年月三四品'], [1911, 3, 14, '亥夘文進貴'],
      [1969, 9, 5, '酉申年月三四品'], [1987, 11, 30, '亥夘文進貴'],
    ].map(([year, month, day, expectedPassage]) => ({ date: { year, month, day }, hour: 16,
      expected: 'smth-v9-liuri-10-09-p012-001', expectedPassage, expectedTopic: '事业' })),
    { date: { year: 1974, month: 2, day: 11 }, hour: 16, expectedAbsent: ['smth-v9-liuri-10-09-p012-001'] },
    { date: { year: 1975, month: 2, day: 6 }, hour: 16, expectedAbsent: ['smth-v9-liuri-10-09-p012-001'] },
    { date: { year: 1988, month: 1, day: 4 }, hour: 8, expectedAbsent: ['ziwei-v1-c017-p101004-001'] },
    { date: { year: 1934, month: 7, day: 17 }, hour: 20, expected: 'ziwei-v3-c020-p109008-001', expectedPassage: '拟作栋梁之客' },
    { date: { year: 1965, month: 2, day: 3 }, hour: 20, gender: 'female', expected: 'ziwei-v3-c020-p119012-001',
      expectedPassage: '日月更须贪杀会', expectedPeriod: { palace: '子女', startAge: 94, endAge: 103, ageBasis: '虚岁' } },
    { date: { year: 1964, month: 9, day: 27 }, hour: 20, expected: 'smth-v9-liuri-06-11-p008-101',
      expectedPassage: '未酉丑月行火土運四五品', expectedPeriod: { ganZhi: '丁丑', startAge: 35, endAge: 44, ageBasis: '虚岁' } },
    { date: { year: 1972, month: 8, day: 28 }, hour: 2, gender: 'female', expected: 'ziwei-v2-jielan-077-p001-004', expectedPassage: '主穷。' },
    { date: { year: 1992, month: 8, day: 2 }, hour: 14, gender: 'female', expected: 'ziwei-v2-jielan-077-p001-004', expectedPassage: '主穷。' },
    { date: { year: 1989, month: 5, day: 9 }, hour: 10, expected: 'smth-v6-uniform-p002-004', expectedPassage: '秀奪山川出類才' },
    { date: { year: 1971, month: 8, day: 20 }, hour: 0, gender: 'female', expected: 'ziwei-v1-c011-p118000-002',
      expectedPassage: '暮夜求利之辈。', expectedPeriod: { palace: '田宅', startAge: 34, endAge: 43, ageBasis: '虚岁' } },
    { date: { year: 1952, month: 12, day: 6 }, hour: 4, gender: 'female', expected: 'ziwei-v1-c011-p119000-001',
      expectedPassage: '潮海营营自走忙。', expectedPeriod: { palace: '疾厄', startAge: 55, endAge: 64, ageBasis: '虚岁' } },
    { date: { year: 1952, month: 12, day: 6 }, hour: 4, gender: 'female', expected: 'ziwei-v3-c020-p129011-001',
      expectedPassage: '作经商。', expectedPeriod: { palace: '疾厄', startAge: 55, endAge: 64, ageBasis: '虚岁' } },
    { date: { year: 2007, month: 1, day: 28 }, hour: 4, expected: 'ziwei-v3-c020-p131003-001',
      expectedPassage: '曹吏贪婪', expectedPeriod: { palace: '父母', startAge: 13, endAge: 22, ageBasis: '虚岁' } },
    { date: { year: 1987, month: 9, day: 12 }, hour: 2, gender: 'female', expected: 'ziwei-v1-zhuxing-wenda-p122000-003',
      expectedPassage: '口舌是非常有。', expectedPeriod: { palace: '父母', startAge: 12, endAge: 21, ageBasis: '虚岁' } },
    { date: { year: 1938, month: 5, day: 7 }, hour: 6, gender: 'female', expected: 'ziwei-v3-c020-p113006-001', expectedPassage: '无眠睡' },
    { date: { year: 1965, month: 10, day: 29 }, hour: 0, expected: 'smth-v8-liuri-03-01-p012-001', expectedPassage: '身旺最宜武貴' },
    { date: { year: 2025, month: 10, day: 14 }, hour: 0, expected: 'smth-v8-liuri-03-01-p012-001', expectedPassage: '身旺最宜武貴' },
    { date: { year: 2020, month: 9, day: 1 }, hour: 8, expected: 'ziwei-v2-jielan-077-p001-002', expectedPassage: '主贵。' },
    { date: { year: 1969, month: 5, day: 23 }, hour: 14, expected: 'smth-v8-liuri-05-08-p015-001', expectedPassage: '各成局面方吉' },
    { date: { year: 1991, month: 8, day: 13 }, hour: 12, expected: 'ziwei-v1-c011-p118000-001', expectedPassage: '耿直之心' },
    { date: { year: 1943, month: 6, day: 20 }, hour: 4, gender: 'female', expected: 'ziwei-v1-c012-p101009-001', expectedPassage: '主疾' },
    { date: { year: 1986, month: 5, day: 19 }, hour: 0, expected: 'smth-v7-temperament-p007-012', expectedPassage: '性氣無常不自檢束' },
    { date: { year: 1990, month: 3, day: 5 }, hour: 16, gender: 'female', expected: 'smth-v7-female-discourse-p056-001', expectedPassage: '性巧人和順' },
    { date: { year: 2000, month: 10, day: 31 }, hour: 0, expected: 'ziwei-v3-daozang-001-p132-001', expectedPassage: '主頻遭責辱' },
    { date: { year: 2023, month: 4, day: 10 }, hour: 20, expected: 'ziwei-v1-dedi-hege-p101007-001', expectedPassage: '廪禄丰。' },
    { date: { year: 1984, month: 4, day: 18 }, hour: 16, expected: 'ziwei-v1-dedi-hege-p101009-001', expectedPassage: '一生富贵逞英雄。' },
    { date: { year: 1990, month: 2, day: 4 }, hour: 20, expected: 'smth-v12-gold-voice-p094-101', expectedPassage: '三合生人辰戌時定為僧道不須疑' },
    { date: { year: 1992, month: 2, day: 6 }, hour: 8, expected: 'smth-v12-gold-voice-p094-101', expectedPassage: '三合生人辰戌時定為僧道不須疑' },
    { date: { year: 2000, month: 6, day: 26 }, hour: 14, gender: 'female', expected: 'ziwei-v2-minggong-p117002-001', expectedPassage: '文武皆宜之。' },
    { date: { year: 1990, month: 2, day: 9 }, hour: 8, expected: 'smth-v8-liuri-02-05-p010-101', expectedPassage: '刑尅妻' },
    { date: { year: 2000, month: 10, day: 12 }, hour: 22, expected: 'smth-v9-liuri-10-12-p009-101', expectedPassage: '辰戌與夘刑主孤貧' },
    { date: { year: 1990, month: 1, day: 1 }, hour: 16, expected: 'smth-v3-spirits-p020-001', expectedPassage: '在田宅則主破祖' },
    { date: { year: 1990, month: 1, day: 1 }, hour: 20, expected: 'smth-v3-spirits-p020-001', expectedPassage: '只在財帛宫名串錢主富蓄' },
    { date: { year: 1990, month: 6, day: 18 }, hour: 8, gender: 'female', expected: 'ziwei-v1-xingxing-p101023-001' },
    { date: { year: 1935, month: 5, day: 17 }, hour: 18, gender: 'female', expectedAbsent: ['ziwei-v1-c008-p101027-001'] },
    { date: { year: 1983, month: 2, day: 15 }, hour: 20, expected: ['ziwei-v2-jielan-077-p001-001', 'ziwei-v2-jielan-077-p001-003'] },
    { date: { year: 2020, month: 1, day: 26 }, hour: 20, expected: 'ziwei-v2-jielan-077-p001-001' },
    { date: { year: 1926, month: 2, day: 19 }, hour: 22, expected: 'ziwei-v1-zhuxing-wenda-p137000-001' },
    { date: { year: 1998, month: 2, day: 10 }, hour: 10, gender: 'female', expected: 'ziwei-v2-minggong-p222004-001' },
    { date: { year: 1958, month: 10, day: 6 }, hour: 10, gender: 'female', expected: 'ziwei-v1-c011-p130000-001' },
    { date: { year: 1976, month: 8, day: 13 }, hour: 18, gender: 'female', expected: 'ziwei-v1-shixian-poge-p101009-001' },
    { date: { year: 1975, month: 7, day: 17 }, hour: 22, gender: 'female', expected: 'ziwei-v3-c020-p164007-001' },
    { date: { year: 1983, month: 3, day: 15 }, hour: 8, expected: 'ziwei-v3-jielan-120-p001-002' },
    { date: { year: 1995, month: 2, day: 5 }, hour: 8, expected: 'ziwei-v1-daozang-270-p273-001' },
    { date: { year: 1990, month: 1, day: 9 }, hour: 14, expected: 'ziwei-v2-daozang-009-p107-001' },
    { date: { year: 1992, month: 2, day: 2 }, hour: 8, expected: 'ziwei-v2-daozang-009-p109-001' },
    { date: { year: 1990, month: 1, day: 1 }, hour: 4, expected: 'ziwei-v2-daozang-113-p113-001' },
    { date: { year: 1990, month: 10, day: 18 }, hour: 8, expected: 'ziwei-v3-daozang-001-p055-002' },
    { date: { year: 1992, month: 2, day: 4 }, hour: 0, expected: 'ziwei-v3-daozang-001-p092-001' },
    { date: { year: 1940, month: 9, day: 15 }, hour: 0, expected: 'smth-v9-liuri-08-01-p018-101' },
    { date: { year: 2016, month: 8, day: 7 }, hour: 12, expected: 'ziwei-v3-c020-p102021-001' },
    { date: { year: 1926, month: 11, day: 9 }, hour: 2, gender: 'female', expected: 'ziwei-v1-c011-p147000-001' },
    { date: { year: 1946, month: 10, day: 13 }, hour: 0, expected: 'ziwei-v1-shixian-poge-p101008-001' },
    { date: { year: 1926, month: 6, day: 5 }, hour: 14, expected: 'ziwei-v1-zhuxing-wenda-p170000-001' },
    ...[['CN-140110', '水盛無土冀雍飄蕩無居'], ['CN-610104', '水盛無土冀雍飄蕩無居'],
      ['CN-320303', '徐揚人反㓙成吉'], ['CN-321002', '徐揚人反㓙成吉']].map(([placeId, expectedPassage]) => ({
      date: { year: 2011, month: 9, day: 6 }, hour: 0, place: findBirthPlace(placeId),
      expected: 'smth-v4-season-wood-p008-002', expectedPassage,
    })),
    { date: { year: 1996, month: 6, day: 14 }, hour: 16, expected: 'smth-v4-season-water-p005-001', expectedPassage: '五六月之水正能滋助萬物喜土同行' },
    { date: { year: 1907, month: 6, day: 28 }, hour: 22, expected: 'smth-v8-liuri-05-12-p020-101' },
    { date: { year: 1909, month: 6, day: 17 }, hour: 22, expected: 'smth-v8-liuri-05-12-p020-101' },
    { date: { year: 1935, month: 6, day: 21 }, hour: 22, expected: 'smth-v8-liuri-05-12-p020-101' },
    { date: { year: 1994, month: 12, day: 6 }, hour: 18, expected: 'smth-v3-void-p003-004' },
    { date: { year: 1945, month: 7, day: 20 }, hour: 16, gender: 'female', expected: 'smth-v3-palaces-meng-p047-001' },
    { date: { year: 1990, month: 1, day: 1 }, hour: 14, expected: 'ziwei-v1-daozang-270-p270-001' },
    { date: { year: 1941, month: 2, day: 21 }, hour: 4, gender: 'female', expected: 'ziwei-v1-zhuxing-wenda-p157000-002' },
    { date: { year: 1900, month: 5, day: 16 }, hour: 2, expected: 'smth-v9-liuri-06-02-p005-001' },
    { date: { year: 1912, month: 1, day: 9 }, hour: 2, expected: 'smth-v12-heart-mirror-p037-101' },
    { date: { year: 1901, month: 2, day: 17 }, hour: 10, expected: 'smth-v8-liuri-03-06-p007-001' },
    { date: { year: 1957, month: 12, day: 7 }, hour: 2, expected: 'smth-v9-liuri-10-02-p005-001' },
    { date: { year: 1994, month: 6, day: 18 }, hour: 0, minute: 57, gender: 'female', expected: 'ziwei-v3-c020-p117002-001' },
    { date: { year: 1982, month: 3, day: 10 }, hour: 20, expected: 'ziwei-v1-c012-p101008-001' },
    { date: { year: 1924, month: 9, day: 6 }, hour: 12, gender: 'female', expected: 'ziwei-v1-c012-p101006-001' },
    { date: { year: 1934, month: 10, day: 16 }, hour: 12, expected: 'ziwei-v1-c012-p101007-001' },
    { date: { year: 1924, month: 3, day: 1 }, hour: 18, expected: 'ziwei-v1-c012-p101002-001' },
    { date: { year: 1935, month: 6, day: 25 }, hour: 8, expected: 'ziwei-v1-c012-p101002-001' },
    { date: { year: 1912, month: 3, day: 17 }, hour: 10, expected: 'smth-v2-general-star-p002-001' },
    { date: { year: 1944, month: 10, day: 24 }, hour: 14, gender: 'female', expected: 'ziwei-v1-c012-p101003-001' },
    { date: { year: 2014, month: 10, day: 3 }, hour: 6, expected: 'ziwei-v1-c012-p101004-001' },
    { date: { year: 1984, month: 4, day: 26 }, hour: 18, gender: 'female', expected: 'ziwei-v1-c012-p101005-001' },
    { date: { year: 1995, month: 12, day: 7 }, hour: 14, expected: 'ziwei-v2-daozang-153-p383-002' },
    { date: { year: 1974, month: 12, day: 13 }, hour: 16, minute: 47, expected: 'ziwei-v1-shixian-poge-p101003-001' },
    { date: { year: 2011, month: 2, day: 11 }, hour: 16, minute: 41, gender: 'female', expected: 'ziwei-v1-shixian-poge-p005-001' },
    { date: { year: 1912, month: 10, day: 6 }, hour: 2, gender: 'female', expected: 'smth-v7-female-discourse-p089-001' },
    { date: { year: 1944, month: 2, day: 1 }, hour: 22, minute: 51, gender: 'female', expected: 'ziwei-v1-c011-p125000-001' },
    { date: { year: 1925, month: 3, day: 13 }, hour: 12, minute: 6, gender: 'female', expected: 'ziwei-v1-c010-p101068-001' },
    { date: { year: 1971, month: 4, day: 25 }, hour: 4, minute: 11, gender: 'female', expected: 'ziwei-v1-dedi-hege-p101004-001' },
    { date: { year: 1993, month: 7, day: 14 }, hour: 12, minute: 31, expected: 'ziwei-v1-dedi-hege-p101001-001' },
    { date: { year: 1923, month: 11, day: 15 }, hour: 14, expected: 'ziwei-v1-zhuxing-wenda-p127000-003' },
    { date: { year: 1933, month: 12, day: 28 }, hour: 22, minute: 14, gender: 'female', expected: 'ziwei-v2-jielan-077-p001-005' },
    { date: { year: 2010, month: 4, day: 11 }, hour: 16, minute: 36, gender: 'female', expected: 'ziwei-v2-jielan-077-p001-005' },
    { date: { year: 1926, month: 4, day: 24 }, hour: 10, expected: 'ziwei-v1-zhuxing-wenda-p145000-001' },
    { date: { year: 1987, month: 9, day: 3 }, hour: 14, minute: 12, expected: 'ziwei-v1-c007-p101013-001' },
    { date: { year: 1940, month: 12, day: 7 }, hour: 18, expected: 'smth-v4-isolated-wealth-p003-001' },
    { date: { year: 1913, month: 1, day: 6 }, hour: 22, expected: 'smth-v11-breath-image-p081-101' },
    { date: { year: 1926, month: 6, day: 28 }, hour: 12, expected: 'smth-v8-liuri-05-07-p004-101' },
    { date: { year: 1952, month: 6, day: 19 }, hour: 20, minute: 24, gender: 'female', expected: 'ziwei-v3-c020-p131004-001' },
    { date: { year: 1924, month: 10, day: 6 }, hour: 18, minute: 26, gender: 'female', expected: 'ziwei-v3-c020-p123001-001' },
    { date: { year: 1912, month: 7, day: 23 }, hour: 22, expected: 'smth-v9-liuri-07-12-p026-101' },
    { date: { year: 1912, month: 1, day: 9 }, hour: 18, expected: 'smth-v8-liuri-01-10-p018-101' },
    { date: { year: 1948, month: 10, day: 22 }, hour: 8, minute: 29, expected: 'ziwei-v3-c020-p125005-001' },
    { date: { year: 1928, month: 11, day: 4 }, hour: 20, minute: 57, expected: 'ziwei-v1-zhuxing-wenda-p122000-002' },
    { date: { year: 1900, month: 5, day: 7 }, hour: 8, expected: 'smth-v9-liuri-07-05-p004-101' },
    { date: { year: 1908, month: 3, day: 31 }, hour: 8, gender: 'female', expected: 'smth-v7-rivalry-p002-001',
      expectedPassage: '若彼旺我衰四柱衝我則彼正而我為偏矣' },
    { date: { year: 1902, month: 1, day: 10 }, hour: 10, expected: 'smth-v5-pure-elements-p002-001' },
    { date: { year: 1983, month: 10, day: 2 }, hour: 18, expected: 'smth-v6-combine-hit-p002-001' },
    { date: { year: 1914, month: 4, day: 28 }, hour: 0, expected: 'smth-v5-combined-wealth-p002-001' },
    { date: { year: 1959, month: 3, day: 5 }, hour: 10, expected: 'smth-v8-liuri-03-06-p018-101' },
    { date: { year: 1915, month: 9, day: 17 }, hour: 10, expected: 'smth-v3-ten-lu-p029-001' },
    { date: { year: 1945, month: 10, day: 7 }, hour: 0,
      expected: ['smth-v11-breath-image-p041-001', 'smth-v11-breath-image-p042-101'] },
    { date: { year: 1915, month: 3, day: 14 }, hour: 6, expected: 'smth-v5-yang-blade-p002-001' },
    { date: { year: 1916, month: 9, day: 14 }, hour: 12, gender: 'female', expected: 'smth-v7-female-discourse-p109-001' },
    { date: { year: 1914, month: 1, day: 29 }, hour: 8, gender: 'female', expected: 'smth-v7-rivalry-p002-001',
      expectedPassage: '若本身自旺彼身值衰四柱不衝則我正而彼為偏' },
    { date: { year: 1935, month: 9, day: 14 }, hour: 22, expected: 'smth-v3-crossing-p017-001' },
    { date: { year: 1916, month: 10, day: 9 }, hour: 16, expected: 'smth-v9-liuri-06-09-p018-101' },
    { date: { year: 1912, month: 2, day: 20 }, hour: 10, expected: 'smth-v6-general-virtue-p002-001' },
    { date: { year: 1912, month: 2, day: 10 }, hour: 20, place: findBirthPlace('CN-410302'), expected: 'smth-v8-liuri-03-11-p009-101' },
    { date: { year: 1912, month: 3, day: 26 }, hour: 6, place: findBirthPlace('CN-410302'), expected: 'smth-v9-liuri-08-04-p005-001' },
    { date: { year: 1912, month: 4, day: 18 }, hour: 14, place: findBirthPlace('CN-410302'), expected: 'smth-v8-liuri-01-08-p004-101' },
    { date: { year: 1912, month: 5, day: 12 }, hour: 0, place: findBirthPlace('CN-321002'), expected: 'smth-v4-season-earth-p006-003' },
    { date: { year: 1912, month: 12, day: 3 }, hour: 20, place: findBirthPlace('CN-410302'), expected: 'smth-v9-liuri-10-11-p005-101' },
    { date: { year: 1912, month: 12, day: 7 }, hour: 20, place: findBirthPlace('CN-410302'), expected: 'smth-v4-season-fire-p006-002' },
    { date: { year: 1912, month: 1, day: 6 }, hour: 16, expected: 'smth-v10-jade-well-p267-101' },
    { date: { year: 1912, month: 4, day: 9 }, hour: 8, expected: 'smth-v12-gold-voice-p090-101' },
    { date: { year: 1986, month: 11, day: 14 }, hour: 20, minute: 18, expected: 'ziwei-v1-shixian-poge-p101001-001' },
    { date: { year: 1952, month: 4, day: 17 }, hour: 18, minute: 3, expected: 'ziwei-v1-shixian-poge-p101006-001' },
    { date: { year: 2012, month: 6, day: 16 }, hour: 12, minute: 47, gender: 'female', expected: 'ziwei-v3-c020-p139003-001' },
    { date: { year: 1948, month: 9, day: 16 }, hour: 20, minute: 47, gender: 'female', expected: 'ziwei-v1-c011-p141000-001' },
    { date: { year: 2020, month: 10, day: 23 }, hour: 8, minute: 39, expectedAbsent: ['ziwei-v2-minggong-p274000-001'] },
    { date: { year: 1955, month: 6, day: 4 }, hour: 16, minute: 38, gender: 'female', expected: 'ziwei-v1-dedi-hege-p010-001' },
    { date: { year: 1974, month: 7, day: 9 }, hour: 22, minute: 22, expectedAbsent: ['ziwei-v3-c001-p101006-001'] },
    { date: { year: 2003, month: 8, day: 10 }, hour: 12, minute: 20, gender: 'female', place: findBirthPlace('CN-321002'), expected: 'ziwei-v1-c012-p101001-001' },
    { date: { year: 1968, month: 12, day: 26 }, hour: 14, minute: 49, expected: 'ziwei-v1-c005-p101003-002' },
    { date: { year: 1990, month: 1, day: 1 }, hour: 16 },
    { date: { year: 1973, month: 10, day: 13 }, hour: 4, minute: 19 },
    { date: { year: 2000, month: 4, day: 15 }, hour: 17, minute: 15, expected: 'smth-v9-liuri-10-10-p008-101' },
    { date: { year: 2000, month: 6, day: 25 }, hour: 10, expected: 'smth-v8-liuri-01-06-p007-103' },
    { date: { year: 1912, month: 1, day: 1 }, hour: 12, expected: 'smth-v3-spirits-p028-001' },
    { date: { year: 1912, month: 1, day: 5 }, hour: 18, expected: 'smth-v7-temperament-p007-011' },
    { date: { year: 1912, month: 1, day: 10 }, hour: 10, expected: 'smth-v10-jade-well-p287-101' },
    { date: { year: 1912, month: 1, day: 16 }, hour: 6, expected: 'smth-v5-yang-blade-p002-008' },
    { date: { year: 1912, month: 1, day: 18 }, hour: 22, expected: 'smth-v3-palaces-zhong-p061-001' },
    { date: { year: 1912, month: 3, day: 31 }, hour: 18, expected: 'smth-v10-jade-well-p242-101' },
    { date: { year: 1912, month: 6, day: 14 }, hour: 18, expected: 'smth-v9-liuri-08-10-p021-101' },
    { date: { year: 1912, month: 7, day: 16 }, hour: 12, expected: 'smth-v6-muddy-source-p002-001' },
    { date: { year: 1912, month: 11, day: 12 }, hour: 0, expected: 'smth-v10-life-method-p024-101' },
    { date: { year: 1913, month: 1, day: 16 }, hour: 20, expected: 'smth-v8-liuri-04-11-p002-101' },
    { date: { year: 1914, month: 3, day: 4 }, hour: 18, expected: 'smth-v12-subtle-creation-p002-101' },
    { date: { year: 1914, month: 12, day: 6 }, hour: 8, expected: 'smth-v8-liuri-03-05-p024-101' },
    { date: { year: 1918, month: 12, day: 31 }, hour: 12, expected: 'smth-v11-favor-disfavor-p002-102' },
    { date: { year: 1925, month: 4, day: 8 }, hour: 14, expected: 'smth-v11-waxing-note-p033-101' },
    { date: { year: 1958, month: 3, day: 8 }, hour: 4, expected: 'smth-v1-nayin-character-p083-001' },
    { date: { year: 1927, month: 7, day: 26 }, hour: 22, minute: 17, gender: 'female', expected: 'ziwei-v3-c005-p101001-001' },
    { date: { year: 1924, month: 4, day: 12 }, hour: 20, minute: 46, gender: 'female', expected: 'ziwei-v2-minggong-p182002-001' },
    { date: { year: 2009, month: 9, day: 18 }, hour: 2, minute: 26, expected: 'ziwei-v1-c012-p101010-001' },
    { date: { year: 1998, month: 8, day: 18 }, hour: 6, minute: 59, expected: 'ziwei-v1-c019-p101007-001' },
    { date: { year: 1991, month: 6, day: 9 }, hour: 20, minute: 22, gender: 'female', expected: 'ziwei-v3-c020-p105005-001' },
    { date: { year: 1974, month: 7, day: 5 }, hour: 18, minute: 52, expectedAbsent: ['ziwei-v2-guanlugong-p004-001'] },
    { date: { year: 1948, month: 11, day: 28 }, hour: 4, minute: 13, expected: 'ziwei-v1-zhuxing-wenda-p101000-004' },
    { date: { year: 1970, month: 11, day: 8 }, hour: 16, minute: 8, gender: 'female', expected: 'ziwei-v1-c011-p127000-001' },
    { date: { year: 1974, month: 5, day: 16 }, hour: 20, minute: 53, gender: 'female', expected: 'ziwei-v2-minggong-p230002-001' },
    { date: { year: 1985, month: 2, day: 9 }, hour: 14, minute: 31, expected: 'ziwei-v1-c018-p101007-001' },
    { date: { year: 1993, month: 6, day: 28 }, hour: 18, minute: 14, gender: 'female', expected: 'ziwei-v3-c020-p102009-001' },
    { date: { year: 2009, month: 9, day: 3 }, hour: 2, minute: 52, expected: 'ziwei-v1-c010-p101072-001' },
    { date: { year: 1912, month: 1, day: 9 }, hour: 12, gender: 'female', expected: 'smth-v7-abundant-natal-p002-001' },
    { date: { year: 1912, month: 1, day: 13 }, hour: 0, expected: 'smth-v3-school-p011-001' },
    { date: { year: 1912, month: 3, day: 2 }, hour: 2, gender: 'female', expected: 'smth-v7-female-discourse-p022-003' },
    { date: { year: 1912, month: 7, day: 13 }, hour: 16, expected: 'smth-v11-waxing-p048-101' },
    { date: { year: 1912, month: 8, day: 13 }, hour: 18, expected: 'smth-v11-six-spirit-p043-101' },
    { date: { year: 1912, month: 11, day: 10 }, hour: 12, expected: 'smth-v10-jade-well-p218-101' },
    { date: { year: 1913, month: 6, day: 8 }, hour: 16, gender: 'female', expected: 'smth-v7-quiet-relationship-p002-001' },
    { date: { year: 1913, month: 9, day: 1 }, hour: 20, expected: 'smth-v10-jade-well-p066-101' },
    { date: { year: 1914, month: 4, day: 4 }, hour: 6, expected: 'smth-v6-following-p002-001' },
    { date: { year: 1914, month: 6, day: 9 }, hour: 8, expected: 'smth-v11-bright-way-p069-101' },
    { date: { year: 1915, month: 9, day: 11 }, hour: 16, expected: 'smth-v12-origin-ode-p084-101' },
    { date: { year: 1923, month: 12, day: 12 }, hour: 22, gender: 'female', expected: 'smth-v7-late-marriage-p002-001' },
    { date: { year: 1928, month: 7, day: 12 }, hour: 2, minute: 46, expectedAbsent: ['ziwei-v2-minggong-p112000-001'] },
    { date: { year: 1950, month: 6, day: 21 }, hour: 4, minute: 37, gender: 'female', expected: 'ziwei-v1-c011-p123000-001' },
    { date: { year: 1981, month: 2, day: 4 }, hour: 20, minute: 53, gender: 'female', expected: 'ziwei-v2-minggong-p304002-001' },
    { date: { year: 2005, month: 3, day: 21 }, hour: 20, minute: 5, gender: 'female', expected: 'ziwei-v3-c020-p109001-001' },
    { date: { year: 2005, month: 9, day: 18 }, hour: 2, minute: 34, gender: 'female', expected: 'ziwei-v1-c011-p101003-001' },
    { date: { year: 1913, month: 9, day: 23 }, hour: 10, expected: 'smth-v8-liuri-04-06-p011-001' },
    { date: { year: 1913, month: 6, day: 9 }, hour: 10, expected: 'smth-v9-liuri-08-06-p004-101' },
    { date: { year: 1914, month: 6, day: 9 }, hour: 22, expected: 'smth-v8-liuri-03-12-p006-001' },
    { date: { year: 1914, month: 9, day: 13 }, hour: 4, expected: 'smth-v6-ren-northeast-p002-001' },
    { date: { year: 1914, month: 5, day: 10 }, hour: 22, expected: 'smth-v3-palaces-zhong-p062-001' },
    { date: { year: 1915, month: 10, day: 13 }, hour: 22, expected: 'smth-v3-heaven-wonders-p003-001' },
    { date: { year: 1916, month: 2, day: 13 }, hour: 2, expected: 'ziwei-v1-c010-p101027-002' },
    { date: { year: 1912, month: 12, day: 12 }, hour: 4, expected: 'smth-v6-uniform-p002-006' },
    { date: { year: 1912, month: 8, day: 12 }, hour: 0,
      expected: ['smth-v5-building-lu-p002-005', 'smth-v12-true-treasure-p061-101'] },
    { date: { year: 1916, month: 8, day: 8 }, hour: 6, expected: 'smth-v10-life-method-p023-001' },
    { date: { year: 1914, month: 5, day: 10 }, hour: 14, expected: 'smth-v3-palaces-ji-p034-001' },
    { date: { year: 1920, month: 8, day: 10 }, hour: 8, expected: 'smth-v6-well-p002-001' },
    { date: { year: 1920, month: 12, day: 22 }, hour: 10, expected: 'smth-v8-liuri-01-06-p007-102' },
    { date: { year: 1949, month: 11, day: 3 }, hour: 8, expected: 'ziwei-v3-c020-p102001-001' },
    { date: { year: 1954, month: 11, day: 26 }, hour: 8, gender: 'female', expected: 'ziwei-v3-c020-p102007-001' },
    { date: { year: 1957, month: 1, day: 20 }, hour: 2, expected: 'ziwei-v3-c020-p117001-001' },
    { date: { year: 1958, month: 6, day: 6 }, hour: 8, gender: 'female', expected: 'ziwei-v1-c002-p103012-001' },
    { date: { year: 1978, month: 5, day: 20 }, hour: 6, gender: 'female', expected: 'ziwei-v3-c020-p137006-001' },
    { date: { year: 1979, month: 6, day: 28 }, hour: 4, minute: 49, gender: 'female', expected: 'ziwei-v1-c018-p101008-001' },
    { date: { year: 1922, month: 3, day: 2 }, hour: 0, expected: 'smth-v9-liuri-06-01-p009-103' },
    { date: { year: 1923, month: 2, day: 18 }, hour: 10, expected: 'smth-v9-liuri-09-06-p017-101' },
    { date: { year: 1924, month: 3, day: 15 }, hour: 0, expected: 'smth-v6-day-noble-p002-001' },
    { date: { year: 1926, month: 12, day: 12 }, hour: 0, gender: 'female', expected: 'ziwei-v3-c020-p166002-001' },
    { date: { year: 1927, month: 9, day: 23 }, hour: 20, expected: 'smth-v12-true-treasure-p088-101' },
    { date: { year: 1928, month: 5, day: 21 }, hour: 6, expected: 'smth-v9-liuri-08-04-p017-002' },
    { date: { year: 1930, month: 2, day: 3 }, hour: 0, expected: 'smth-v8-liuri-01-01-p016-101' },
    { date: { year: 1939, month: 1, day: 3 }, hour: 12, minute: 10, gender: 'female', expected: 'ziwei-v3-c020-p111002-001' },
    { date: { year: 1962, month: 1, day: 18 }, hour: 8, minute: 8, gender: 'female',
      expected: ['ziwei-v1-c006-p101013-001', 'ziwei-v3-daozang-001-p237-001'] },
    { date: { year: 1938, month: 1, day: 4 }, hour: 10, expected: 'ziwei-v1-zhuxing-wenda-p116000-002' },
    { date: { year: 1938, month: 5, day: 11 }, hour: 19, minute: 6, place: findBirthPlace('CN-510104'), expected: 'smth-v9-liuri-10-11-p006-101' },
    { date: { year: 1938, month: 12, day: 17 }, hour: 18, gender: 'female', expected: 'smth-v7-female-discourse-p010-003' },
    { date: { year: 1940, month: 9, day: 1 }, hour: 12, expected: 'smth-v6-three-wonders-p002-001' },
    { date: { year: 1942, month: 6, day: 17 }, hour: 8, minute: 12, expected: 'ziwei-v3-c003-p108000-001' },
    { date: { year: 1944, month: 2, day: 1 }, hour: 22, minute: 51, gender: 'female', expected: 'ziwei-v2-jielan-088-p001-001' },
    { date: { year: 1941, month: 2, day: 16 }, hour: 22, minute: 51,
      expected: ['ziwei-v3-daozang-001-p001-001', 'ziwei-v1-c007-p101014-001'] },
    { date: { year: 1945, month: 7, day: 11 }, hour: 15, minute: 12, expected: 'ziwei-v1-daozang-040-p072-001' },
    { date: { year: 1945, month: 8, day: 22 }, hour: 0, expected: 'smth-v3-school-p007-001' },
    { date: { year: 1947, month: 3, day: 20 }, hour: 10, gender: 'female', expected: 'smth-v7-female-discourse-p022-001' },
    { date: { year: 1947, month: 12, day: 22 }, hour: 12, minute: 31, gender: 'female', expected: 'ziwei-v3-c020-p102008-001' },
    { date: { year: 1948, month: 2, day: 7 }, hour: 4, gender: 'female', expected: 'smth-v7-female-discourse-p005-002' },
    { date: { year: 1949, month: 9, day: 18 }, hour: 3, minute: 45, expected: 'ziwei-v1-c018-p101022-001' },
    { date: { year: 1951, month: 2, day: 12 }, hour: 4, gender: 'female', expectedAbsent: ['ziwei-v2-c005-p101004-001'] },
    { date: { year: 1953, month: 12, day: 18 }, hour: 2, minute: 52, expected: 'ziwei-v2-jielan-096-p001-001' },
    { date: { year: 1966, month: 11, day: 19 }, hour: 12, expected: 'smth-v5-building-lu-p002-002' },
    { date: { year: 1967, month: 6, day: 16 }, hour: 18, gender: 'female', expected: 'smth-v3-heaven-noble-p003-001' },
    { date: { year: 1968, month: 2, day: 6 }, hour: 0, expected: 'smth-v1-station-earth-p002-001' },
    { date: { year: 1968, month: 12, day: 21 }, hour: 8, expected: 'smth-v8-liuri-02-05-p004-001' },
    { date: { year: 1970, month: 4, day: 18 }, hour: 6, gender: 'female', expected: 'ziwei-v3-c020-p166000-001' },
    { date: { year: 1972, month: 1, day: 6 }, hour: 8, gender: 'female', expected: 'smth-v11-breath-image-p048-101' },
    { date: { year: 1972, month: 12, day: 23 }, hour: 0, expected: 'smth-v5-wealth-generates-p002-002' },
    { date: { year: 1974, month: 5, day: 16 }, hour: 20, minute: 53, gender: 'female', expected: 'ziwei-v1-c010-p101028-001' },
    { date: { year: 1980, month: 1, day: 18 }, hour: 10, expected: 'ziwei-v2-c008-p101022-001' },
    { date: { year: 1980, month: 1, day: 18 }, hour: 16, expected: 'ziwei-v1-daozang-040-p073-001' },
    { date: { year: 1983, month: 12, day: 1 }, hour: 0, expected: 'smth-v9-liuri-10-01-p017-001' },
    { date: { year: 1984, month: 2, day: 15 }, hour: 0, expected: 'ziwei-v3-c020-p146000-001' },
    { date: { year: 1989, month: 5, day: 5 }, hour: 12, expected: 'ziwei-v3-c020-p170000-001' },
    { date: { year: 1990, month: 3, day: 18 }, hour: 0, gender: 'female', expected: 'ziwei-v3-c020-p102004-001' },
    { date: { year: 1990, month: 5, day: 9 }, hour: 10, expected: 'smth-v8-liuri-01-06-p002-101' },
    { date: { year: 1990, month: 5, day: 13 }, hour: 10, expected: 'smth-v12-gold-voice-p055-101' },
    { date: { year: 1993, month: 5, day: 6 }, hour: 10, expected: 'ziwei-v1-c007-p101009-001' },
    { date: { year: 1994, month: 2, day: 10 }, hour: 16, expected: 'ziwei-v3-c020-p102002-001' },
    { date: { year: 1995, month: 6, day: 13 }, hour: 10, minute: 4, gender: 'female', expected: 'ziwei-v1-c016-p101001-001' },
    { date: { year: 1999, month: 8, day: 14 }, hour: 8, gender: 'female', expected: 'ziwei-v2-jielan-077-p001-006' },
    { date: { year: 2001, month: 3, day: 27 }, hour: 20, gender: 'female', expected: 'ziwei-v3-c020-p133004-001' },
    { date: { year: 2003, month: 6, day: 21 }, hour: 22, gender: 'female', expected: 'ziwei-v3-c001-p101011-001' },
    { date: { year: 2007, month: 8, day: 9 }, hour: 22, gender: 'female', expected: 'smth-v7-female-discourse-p009-002' },
    { date: { year: 2009, month: 9, day: 3 }, hour: 2, minute: 52, expected: 'ziwei-v2-jielan-078-p001-001' },
    { date: { year: 2017, month: 3, day: 8 }, hour: 16, gender: 'female', expected: 'ziwei-v1-zhuxing-wenda-p158000-002' },
    { date: { year: 2017, month: 6, day: 19 }, hour: 6, expected: 'smth-v4-season-fire-p004-001' },
    { date: { year: 2018, month: 6, day: 26 }, hour: 22, expectedAbsent: ['ziwei-v3-c003-p103000-001'] },
    { date: { year: 2018, month: 8, day: 22 }, hour: 6, gender: 'female', expected: 'ziwei-v3-c020-p144000-001' },
    { date: { year: 2018, month: 10, day: 12 }, hour: 10, expected: 'ziwei-v3-c020-p160000-001' },
    { date: { year: 2019, month: 9, day: 5 }, hour: 4, gender: 'female', expected: 'ziwei-v3-c020-p113009-001' },
    { date: { year: 2021, month: 9, day: 7 }, hour: 6, expected: 'ziwei-v3-c020-p111003-001' },
    { date: { year: 2022, month: 2, day: 18 }, hour: 4, expected: 'smth-v6-uniform-p002-002' },
    { date: { year: 2022, month: 7, day: 11 }, hour: 18, gender: 'female', expected: 'ziwei-v1-zhuxing-wenda-p165000-003' },
    { date: { year: 2022, month: 11, day: 22 }, hour: 4, minute: 24, gender: 'female', expected: 'ziwei-v1-c002-p103028-002' },
    { date: { year: 2012, month: 3, day: 19 }, hour: 14, gender: 'female', expected: 'ziwei-v1-c010-p101028-002' },
    { date: { year: 2013, month: 7, day: 26 }, hour: 4, minute: 26, expected: 'ziwei-v3-c003-p114000-001' },
  ];
  const sample = Array.from({ length: 240 }, (_, index) => ({
    date: { year: 1920 + next(106), month: 1 + next(12), day: 1 + next(27) },
    hour: next(24), minute: next(60), place: cities[index % cities.length], gender: index % 2 === 0 ? 'male' : 'female',
  }));
  let tested = 0;
  let all = 0;
  let baziAndZiwei = 0;
  let any = 0;
  let largestRequest = 0;
  const invalid = [];
  const exampleHits = [];
  const observedTarget = new Set();
  for (const [index, profile] of [...sample, ...examples].entries()) {
    const { date, hour, minute = 0, place = cities[0], gender = 'male' } = profile;
    const signal = new AbortController().signal;
    let reading;
    try {
      reading = await runReading({ date, time: { timeKnown: true, hour, minute }, place, gender }, signal, () => {});
    } catch (error) {
      invalid.push({ index, message: error.message });
      if (index < sample.length) continue;
      throw error;
    }
    const request = buildReportRequest(reading);
    largestRequest = Math.max(largestRequest, Buffer.byteLength(JSON.stringify(request)));
    const queries = parseChartQueries(request.chartQueries, { timeKnown: true });
    if (!queries || !methods.every((method) => queries.some((query) => query.method === method))) {
      throw new Error('Expected all three techniques on sample ' + index);
    }
    const hits = lookup(queries).flatMap(({ personality, events }) => [...personality, ...events]).filter(({ claim }) => claim);
    if (hits.some(({ id }) => profile.expectedAbsent?.includes(id))) {
      throw new Error('Unexpected chart match for ' + profile.expectedAbsent.join(', '));
    }
    for (const expected of [profile.expected ?? []].flat()) {
      const hit = hits.find(({ id }) => id === expected);
      if (!hit || (profile.expectedPassage && !hit.matchedBranches?.some(({ text }) => text === profile.expectedPassage))) {
        throw new Error('Expected chart match for ' + expected);
      }
      if (profile.expectedTopic && (hit.topic !== profile.expectedTopic || claimForPrompt(hit).category.topic !== profile.expectedTopic)) {
        throw new Error('Expected passage topic for ' + expected);
      }
      if (profile.expectedPeriod) {
        const promptBranch = claimForPrompt(hit).matchedBranches.find(({ text }) => text === profile.expectedPassage);
        if (JSON.stringify(promptBranch.matchedConditions.decadalPeriod) !== JSON.stringify(profile.expectedPeriod)) {
          throw new Error('Expected calculated age range in prompt for ' + expected);
        }
        const withoutTime = parseChartQueries(request.chartQueries, { timeKnown: false });
        const unconfirmed = lookup(withoutTime).flatMap(({ personality, events }) => [...personality, ...events]);
        if (unconfirmed.some(({ id }) => id === expected)) throw new Error('Unconfirmed decadal match for ' + expected);
      }
    }
    for (const { id } of hits) if (target.has(id)) observedTarget.add(id);
    if (index >= sample.length) {
      const bazi = queries.find(({ method }) => method === 'bazi');
      exampleHits.push({ date, hour, minute, city: place.name, gender,
        pillars: bazi.confirmedFacts?.filter(({ kind }) => kind === 'pillar'),
        hits: hits.map(({ id, method, matchScope, matchedBranches }) =>
        ({ id, method, matchScope: matchScope ?? 'whole_claim', ...(matchedBranches && { passages: matchedBranches.map(({ text }) => text) }) })) });
      continue;
    }
    tested++;
    any += Number(hits.length > 0);
    all += Number(methods.every((method) => hits.some((hit) => hit.method === method)));
    baziAndZiwei += Number(['bazi', 'ziwei'].every((method) => hits.some((hit) => hit.method === method)));
    for (const method of methods) {
      const relevant = hits.filter((hit) => hit.method === method);
      const result = metrics[method];
      result.covered += Number(relevant.length > 0);
      result.hits += relevant.length;
      result.max = Math.max(result.max, relevant.length);
      for (const hit of relevant) {
        result[hit.matchScope === 'passage_branch' ? 'branch' : 'full']++;
        result.byTopic[hit.topic] = (result.byTopic[hit.topic] ?? 0) + 1;
        result.byLayer[hit.layer] = (result.byLayer[hit.layer] ?? 0) + 1;
        result.ids.add(hit.id);
      }
    }
  }
  for (const result of Object.values(metrics)) result.ids = result.ids.size;
  const outputPath = (flag) => {
    const index = process.argv.indexOf(flag);
    if (index === -1) return null;
    const target = process.argv[index + 1];
    if (!target || target.startsWith('--')) throw new Error('Missing output path for ' + flag);
    return target;
  };
  const mappingPath = outputPath('--write-mappings');
  if (mappingPath) writeFileSync(mappingPath, [...structuredClaimMappings()].map((row) => JSON.stringify(row)).join('\n') + '\n');
  const reports = [['--write-pending', () => true],
    ['--write-source-review', (row) => row.uncertain.length > 0 || row.reason === 'source_review_required' || Boolean(row.reviewNote)]];
  for (const [flag, filter] of reports) {
    const target = outputPath(flag);
    if (!target) continue;
    const rows = pendingClaimConditions({ includeSkipped: flag === '--write-source-review' }).filter(filter);
    const columns = [['method', '术数'], ['id', '条目 ID'], ['title', '标题'], ['status', '映射状态'], ['reason', '整条未索引原因'],
      ['recognized', '已识别条件'], ['unresolved', '未映射条件'], ['uncertain', '原库待核'], ['excluded', '原库排除项'],
      ['branches', '可判定分句'], ['reviewNote', '排盘与原文复核'], ['normalized', '西洋库原归一化条件'],
      ['sourceNote', '西洋库匹配说明'], ['source', '出处']];
    const cell = (value) => '"' + String(Array.isArray(value) ? value.join(' ｜ ') : value ?? '').replaceAll('"', '""') + '"';
    writeFileSync(target, '\uFEFF' + [columns.map(([, label]) => cell(label)).join(','),
      ...rows.map((row) => columns.map(([key]) => cell(row[key])).join(','))].join('\r\n') + '\r\n');
  }
  const remaining = targetInventory.filter(({ lookup }) => lookup.status === 'unmapped');
  const skipped = targetInventory.filter(({ lookup }) => lookup.status === 'skipped');
  const indexed = targetInventory.filter(({ lookup }) => ['indexed', 'branch_indexed'].includes(lookup.status));
  if (remaining.length + skipped.length + indexed.length !== targetInventory.length) throw new Error('Unaccounted mapping target.');
  const mappingTarget = {
    total: target.size,
    localOnly: target.size - targetInventory.length,
    indexed: indexed.length,
    skipped: skipped.length,
    remaining: remaining.length,
    observed: observedTarget.size,
    byMethod: Object.fromEntries(Object.entries(baseline).map(([method, ids]) => [method, {
      total: ids.length,
      localOnly: ids.length - targetInventory.filter(row => row.method === method).length,
      indexed: indexed.filter((entry) => entry.method === method).length,
      skipped: skipped.filter((entry) => entry.method === method).length,
      remaining: remaining.filter((entry) => entry.method === method).length,
      observed: ids.filter((id) => observedTarget.has(id)).length,
    }])),
  };
  console.log(JSON.stringify({ mappingTarget, status, sample: { tested, invalid, any, all, baziAndZiwei, largestRequest, metrics }, exampleHits }, null, 2));
  if (process.argv.includes('--verify-baseline') && remaining.length) process.exitCode = 1;
} finally {
  rmSync(join(directory, catalogFile), { force: true });
  rmdirSync(directory);
}
