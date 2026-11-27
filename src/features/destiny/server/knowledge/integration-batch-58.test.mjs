import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileQuanshuTongyuan, quanshuTongyuanProfile } from './quanshu-tongyuan.mjs';
import { compileQuanshuZhuxingWenda, quanshuZhuxingWendaProfile } from './quanshu-zhuxing-wenda.mjs';

const readWitnesses = batch => JSON.parse(readFileSync(new URL(`./claims/integration-batch-${batch}-witnesses.json`, import.meta.url)));
const batch58 = readWitnesses(58);
const batch61 = readWitnesses(61);
const batch64 = readWitnesses(64);
const batch65 = readWitnesses(65);
const batch66 = readWitnesses(66);
const batch112 = readWitnesses(112);
const batch113 = readWitnesses(113);
const batch114 = readWitnesses(114);
const batch115 = readWitnesses(115);
const { witnesses } = batch58;
const idOf = suffix => 'ziwei-v3-c020-p' + suffix;
const catalog = catalogForDirectory();
const lookup = createReportLookup();
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const inputsOf = row => row.inputs ? [{ inputs: row.inputs }] : row.branches;
const raw = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const matchesFact = (facts, pattern) => facts.some(fact => Object.entries(pattern).every(([key, value]) => fact[key] === value));
const wendaVerification = {
  profile: quanshuZhuxingWendaProfile,
  compile: compileQuanshuZhuxingWenda,
  calculationNote: /诸星问答论/u,
};

function queries(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function context(query) {
  return chartContext('ziwei', query.confirmedFacts, query.confirmedAbsentFacts);
}

function explain(number, facts, timeKnown = true) {
  return explainClaim(idOf(number), 'ziwei', context(queries(facts, timeKnown)[0]), undefined, catalog);
}

function chartFor(number, pattern = {}, pool = witnesses) {
  const witness = pool.find(witness => witness.proofs.some(proof => proof.id === idOf(number)) && matchesFact(raw(witness), pattern));
  assert.ok(witness, idOf(number));
  return raw(witness);
}

function verifyWitnesses({ witnesses, alternatives, wholeRecords, sourceRecords }, {
  profile = quanshuTongyuanProfile,
  compile = compileQuanshuTongyuan,
  calculationNote = /同垣篇/u,
} = {}) {
  const rows = new Map([...new Set(witnesses.flatMap(witness => witness.proofs.map(proof => proof.id)))]
    .map(id => [id, catalog.get(id)]));
  assert.equal(rows.size, sourceRecords);
  assert.equal([...rows.values()].filter(row => row.compiler === profile).length, wholeRecords);
  const expected = new Set([...rows].flatMap(([id, row]) => inputsOf(row).flatMap(({ text, inputs, conditionCompiler }) => {
    assert.equal(conditionCompiler ?? row.compiler, profile);
    if (text) assert.ok(row.claim.evidence.original_text.includes(text));
    return inputs.map(input => JSON.stringify([id, text ?? null, digest(input)]));
  })));
  assert.equal(alternatives, expected.size);
  const seen = new Set();
  for (const witness of witnesses) {
    const parsed = queries(raw(witness));
    const chart = context(parsed[0]);
    const calculated = claimChartContext('ziwei', chart);
    const refs = lookup(parsed);
    const hits = refs.flatMap(ref => [...ref.events, ...ref.personality]);
    const materials = buildReportMaterials(refs);
    for (const { id, text, inputDigest } of witness.proofs) {
      const row = rows.get(id);
      const input = inputsOf(row).find(entry => entry.text === text)?.inputs.find(input => digest(input) === inputDigest);
      assert.ok(input && evaluateRule(input, 'natal', calculated).matched, id);
      const hit = hits.find(hit => hit.id === id);
      const explanation = explainClaim(id, 'ziwei', chart, undefined, catalog);
      assert.ok(hit && explanation.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(explanation.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.ok(materials.includes(text ?? row.claim.evidence.original_text), id);
      assert.match(explanation.calculationNote, calculationNote);
      seen.add(JSON.stringify([id, text ?? null, inputDigest]));
    }
  }
  assert.deepEqual(seen, expected);
  for (const row of rows.values()) {
    const altered = structuredClone(row.claim);
    altered.evidence.context += '异本';
    assert.equal(compile(altered).reason, 'source_review_required');
  }
}

test('all reviewed All Stars in Shared Palaces alternatives reach SQLite and report materials from actual charts', () => {
  verifyWitnesses(batch58);
});

test('the subsequent All Stars in Shared Palaces rules reach SQLite and report materials from actual charts', () => {
  assert.equal(batch61.sourceRecords, 14);
  verifyWitnesses(batch61);
});

test('reviewed Questions on the Stars passages reach SQLite and report materials from actual charts', () => {
  assert.equal(batch64.sourceRecords, 18);
  verifyWitnesses(batch64, wendaVerification);
});

test('the next Questions on the Stars palace and stellar combinations reach SQLite and report materials', () => {
  assert.equal(batch65.sourceRecords, 33);
  verifyWitnesses(batch65, wendaVerification);
});

test('Questions on the Stars trines, exclusions and transformations reach SQLite and reports', () => {
  assert.equal(batch66.sourceRecords, 32);
  verifyWitnesses(batch66, wendaVerification);
});

test('the latest Questions on the Stars conditions reach the catalog, explanations and report from native charts', () => {
  assert.equal(batch112.sourceRecords, 19);
  verifyWitnesses(batch112, wendaVerification);
});

test('the next Questions on the Stars passages preserve their independent evidence in lookup', () => {
  assert.equal(batch113.sourceRecords, 21);
  verifyWitnesses(batch113, wendaVerification);
});

test('Questions on the Stars validates flanks, grouped malefics and brightness through SQLite', () => {
  assert.equal(batch114.sourceRecords, 17);
  verifyWitnesses(batch114, wendaVerification);
});

const wendaId = suffix => 'ziwei-v1-zhuxing-wenda-p' + suffix;
const explainWenda = (suffix, facts) => explainClaim(wendaId(suffix), 'ziwei', context(queries(facts)[0]), undefined, catalog);

function wendaWitness(suffix, text, batch = batch112) {
  const found = batch.witnesses.find(witness => witness.proofs.some(proof => proof.id === wendaId(suffix) && proof.text === text));
  assert.ok(found, suffix);
  return raw(found);
}

test('the children-palace branches distinguish local assistance from verified solo placement', () => {
  const suffix = '101000-011';
  const supported = '男女宮得祥佐吉星，主生貴子。', solo = '若獨守無相佐，則子息孤單。';
  assert.deepEqual(explainWenda(suffix, wendaWitness(suffix, supported)).matchedBranches.map(({ text }) => text), [supported]);
  const chart = wendaWitness(suffix, solo);
  assert.deepEqual(explainWenda(suffix, chart).matchedBranches.map(({ text }) => text), [solo]);
  const withoutCount = chart.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '子女');
  assert.equal(explainWenda(suffix, withoutCount).matched, false);
});

test('the fully supported Purple emperor clauses separate charts with and without actual malefics', () => {
  const suffix = '182001-002';
  const auspicious = '若得府相左右昌曲吉集，無有不貴。不然亦主巨富。', mixed = '縱有四殺沖破亦作中局。';
  for (const text of [auspicious, mixed]) {
    const chart = wendaWitness(suffix, text);
    assert.deepEqual(explainWenda(suffix, chart).matchedBranches.map(branch => branch.text), [text]);
    assert.equal(explainWenda(suffix, chart.filter(f => f.kind !== 'palace_star' || f.star !== '文曲')).matched, false);
  }
});

test('the Tian Ji and Ju Men claim needs the actual natal transformation carrier', () => {
  const suffix = '182002-001', chart = wendaWitness(suffix);
  assert.ok(explainWenda(suffix, chart).matched);
  const withoutCarrier = chart.filter(f => f.kind !== 'star_mutagen' || f.change !== '权');
  assert.equal(explainWenda(suffix, withoutCarrier).matched, false);
});

test('Questions on the Stars verifies each natal carrier before using its sector transformation', () => {
  const suffix = '006-002', luQuan = '有權祿則為貴婦。', support = '女人吉星拱照，主旺夫益子。';
  const chart = wendaWitness(suffix, luQuan, batch113);
  assert.deepEqual(explainWenda(suffix, chart).matchedBranches.map(branch => branch.text), [support, luQuan]);
  for (const change of ['禄', '权']) {
    const missing = chart.filter(f => f.kind !== 'star_mutagen' || f.change !== change);
    const synthetic = { kind: 'palace_sector_mutagen', palace: '命宫', change };
    assert.deepEqual(explainWenda(suffix, missing.concat(synthetic)).matchedBranches.map(branch => branch.text), [support]);
    const direct = explainClaim(wendaId(suffix), 'ziwei', chartContext('ziwei', missing.concat(synthetic)), undefined, catalog);
    assert.deepEqual(direct.matchedBranches.map(branch => branch.text), [support]);
  }
  const stem = chart.find(f => f.kind === 'natal_year_stem').stem;
  const stems = '甲乙丙丁戊己庚辛壬癸';
  const otherStem = stems[(stems.indexOf(stem) + 2) % stems.length];
  // Isolate the four-transformations check from the separate year-based Qing Yang rule.
  const wrongYear = chart.filter(f => f.kind !== 'palace_star' || f.star !== '擎羊')
    .map(f => f.kind === 'natal_year_stem' ? { ...f, stem: otherStem } : f);
  assert.deepEqual(explainWenda(suffix, wrongYear).matchedBranches.map(branch => branch.text), [support]);
});

test('the bright Sun quotation needs an observed connection to a different natal palace', () => {
  const suffix = '182003-004', line = '有輝照身命，平步入金門';
  const chart = wendaWitness(suffix, line, batch113);
  const sun = chart.find(f => f.kind === 'palace_star' && f.star === '太阳').palace;
  assert.deepEqual(explainWenda(suffix, chart).matchedBranches.map(branch => branch.text), [line]);
  const noLinks = chart.filter(f => f.kind !== 'palace_relation' || f.target !== sun);
  assert.equal(explainWenda(suffix, noLinks).matched, false);
});

test('the Purple Breaker female passage quotes either supported condition without importing its male reading', () => {
  const suffix = '182001-003', quoted = ['女命逢之作貴婦斷。', '加殺沖破，亦作平常不為下賤。'];
  for (const text of quoted) {
    const chart = wendaWitness(suffix, text, batch113);
    assert.deepEqual(explainWenda(suffix, chart).matchedBranches.map(branch => branch.text), [text]);
    const report = buildReportMaterials(lookup(queries(chart)));
    assert.ok(report.includes(text) && !report.includes('為臣不忠，為子不孝之論。'));
  }
});

test('the Sun and Moon flank quotation needs both recorded adjacency relations', () => {
  const suffix = '182008-003', line = '喜居日月侧，文人遇禹门';
  const chart = wendaWitness(suffix, line, batch114);
  const palace = chart.find(f => f.kind === 'palace_star' && f.star === '太阳').palace;
  const links = chart.filter(f => f.kind === 'palace_relation' && f.anchor === palace && f.relation === 'adjacent');
  assert.equal(links.length, 2);
  assert.deepEqual(explainWenda(suffix, chart).matchedBranches.map(branch => branch.text), [line]);
  for (const link of links) assert.equal(explainWenda(suffix, chart.filter(f => f !== link)).matched, false);
});

test('all four named malefics must come from the observed chart', () => {
  const suffix = '160000-006', chart = wendaWitness(suffix, undefined, batch114);
  assert.ok(explainWenda(suffix, chart).matched);
  for (const star of ['擎羊', '陀罗', '火星', '铃星']) {
    const incomplete = chart.filter(f => f.kind !== 'palace_star' || f.star !== star);
    const fabricated = { kind: 'palace_sector_star', palace: '命宫', star };
    assert.equal(explainWenda(suffix, incomplete.concat(fabricated)).matched, false);
  }
});

test('the Fire and Tan Lang quotation requires complete trine star lists and excludes its timing line', () => {
  const suffix = '182011-001', line = '若得贪狼会，旺地贵无伦';
  const chart = wendaWitness(suffix, line, batch114);
  assert.deepEqual(explainWenda(suffix, chart).matchedBranches.map(branch => branch.text), [line]);
  for (const palace of ['财帛', '官禄']) {
    const incomplete = chart.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== palace);
    assert.equal(explainWenda(suffix, incomplete).matched, false);
  }
  const materials = buildReportMaterials(lookup(queries(chart)));
  assert.ok(materials.includes(line) && !materials.includes('中年后始兴'));
});

test('the old Kong Jie name requires natal Di Kong rather than modern Tian Kong', () => {
  const suffix = '182013-001', line = '劫空为害最愁人，才智英雄误一身';
  const chart = wendaWitness(suffix, line, batch114);
  assert.ok(explainWenda(suffix, chart).matched);
  const replaced = chart.map(f => f.kind === 'palace_star' && f.star === '地空' ? { ...f, star: '天空' } : f);
  assert.equal(explainWenda(suffix, replaced).matched, false);
});

test('Questions on the Stars verifies trines, cycle stars and named transformations through SQLite', () => {
  assert.equal(batch115.sourceRecords, 16);
  verifyWitnesses(batch115, wendaVerification);
});

test('the Ju Men trine quotation requires observed stars in the two natal trines', () => {
  const suffix = '123000-011', chart = wendaWitness(suffix, undefined, batch115);
  assert.ok(explainWenda(suffix, chart).matched);
  const unlinked = chart.filter(f => f.kind !== 'palace_relation' || f.anchor !== '命宫' || f.relation !== 'trine');
  const fabricated = ['火星', '铃星'].map(star => ({ kind: 'palace_trine_star', palace: '命宫', star }));
  assert.equal(explainWenda(suffix, unlinked.concat(fabricated)).matched, false);
});

test('the Tian Liang quotation keeps the two natal cycle stars distinct', () => {
  const suffix = '127000-013', chart = wendaWitness(suffix, undefined, batch115);
  assert.ok(explainWenda(suffix, chart).matched);
  const swapped = chart.map(f => {
    if (f.kind === 'palace_suiqian_star' && f.star === '官符') return { ...f, kind: 'palace_boshi_star', star: '官府' };
    return f;
  });
  assert.equal(explainWenda(suffix, swapped).matched, false);
});

test('Yang and Seven Killings needs a natal Wu Qu transformation carrier in You', () => {
  const suffix = '160000-007', chart = wendaWitness(suffix, undefined, batch115);
  assert.ok(explainWenda(suffix, chart).matched);
  const withoutCarrier = chart.filter(f => f.kind !== 'star_mutagen' || f.star !== '武曲' || f.change !== '权');
  assert.ok(matchesFact(withoutCarrier, { kind: 'palace_mutagen', palace: '命宫', change: '权' }));
  assert.equal(explainWenda(suffix, withoutCarrier).matched, false);
});

test('Tai Yin in illness requires both named natal malefics for its quoted passage', () => {
  const suffix = '121000-007', line = '遇火鈴為災';
  const chart = wendaWitness(suffix, line, batch115);
  assert.deepEqual(explainWenda(suffix, chart).matchedBranches.map(branch => branch.text), [line]);
  for (const star of ['火星', '铃星']) {
    const incomplete = chart.filter(f => f.kind !== 'palace_star' || f.star !== star);
    assert.equal(explainWenda(suffix, incomplete.concat({ kind: 'palace_sector_star', palace: '疾厄', star })).matched, false);
  }
});

test('only the checked Wen Qu clause enters report materials', () => {
  const suffix = '037-007', line = '午戌之地，巨门羊陀冲破';
  const chart = wendaWitness(suffix, line, batch115);
  const materials = buildReportMaterials(lookup(queries(chart)));
  assert.ok(materials.includes(line) && !materials.includes('丧命夭折，水大惊险。'));
  const incomplete = chart.filter(f => f.kind !== 'palace_brightness' || f.star !== '文曲');
  assert.equal(explainWenda(suffix, incomplete).matched, false);
});

test('the confirmed exclusions, same-star transformation and trine evidence are independent', () => {
  const chartForPassage = (suffix, text) => {
    const id = 'ziwei-v1-zhuxing-wenda-p' + suffix;
    const facts = raw(batch66.witnesses.find(witness => witness.proofs.some(proof => proof.id === id && proof.text === text)));
    const explainFacts = known => explainClaim(id, 'ziwei', context(queries(known)[0]), undefined, catalog);
    assert.ok(explainFacts(facts).matchedBranches.some(branch => branch.text === text));
    return { facts, explainFacts };
  };
  const lone = chartForPassage('101000-007', '無輔弼同行則為孤君，雖美玉不足。');
  assert.equal(lone.explainFacts(lone.facts.filter(fact =>
    fact.kind !== 'palace_origin_star_count' || fact.palace !== '命宫')).matched, false);
  assert.equal(lone.explainFacts([...lone.facts, { kind: 'palace_star', palace: '命宫', star: '左辅', scope: 'origin' }]).matched, false);

  const sun = chartForPassage('110000-012', '若居廟旺，化祿化權，允為貴論。');
  assert.equal(sun.explainFacts(sun.facts.filter(fact => fact.kind !== 'star_mutagen' || fact.star !== '太阳')).matched, false);
  const wrongYear = sun.facts.map(fact => fact.kind === 'natal_year_stem' ? { ...fact, stem: '甲' } : fact);
  assert.equal(sun.explainFacts(wrongYear).matched, false);

  const salary = chartForPassage('182010-001', '禄存对向守迁移');
  assert.ok(!salary.explainFacts(salary.facts).matchedBranches.some(branch => branch.text === '三合逢之利禄宜'));
  assert.equal(salary.explainFacts(salary.facts.filter(fact => fact.kind !== 'palace_relation'
    || fact.anchor !== '命宫' || fact.target !== '迁移')).matched, false);
});

test('Sun judgment requires the stated natal gender, and Broken Army requires the brightness of its own seat', () => {
  const id = suffix => 'ziwei-v1-zhuxing-wenda-p' + suffix;
  const findChart = (claimId, text) => raw(batch65.witnesses.find(witness =>
    witness.proofs.some(proof => proof.id === claimId && proof.text === text)));
  const explainFacts = (claimId, facts) => explainClaim(claimId, 'ziwei', context(queries(facts)[0]), undefined, catalog);

  const sun = id('110000-010'), bright = '父母宮男子單作父星，有輝則吉';
  const sunFacts = findChart(sun, bright);
  assert.ok(explainFacts(sun, sunFacts).matchedBranches.some(branch => branch.text === bright));
  assert.equal(explainFacts(sun, [...sunFacts, { kind: 'natal_gender', gender: '女' }]).matched, false);
  const female = sunFacts.map(fact => fact.kind === 'natal_gender' ? { ...fact, gender: '女' } : fact);
  assert.equal(explainFacts(sun, female).matched, false);

  const po = id('133000-016'), land = '在田宅陷度，祖基破蕩';
  const landFacts = findChart(po, land);
  assert.ok(explainFacts(po, landFacts).matchedBranches.some(branch => branch.text === land));
  const withoutBrightness = landFacts.filter(fact =>
    !(fact.kind === 'palace_brightness' && fact.palace === '田宅' && fact.star === '破军'));
  assert.equal(explainFacts(po, withoutBrightness).matched, false);
  const otherStarDim = [...withoutBrightness,
    { kind: 'palace_brightness', palace: '田宅', star: '武曲', brightness: '陷', scope: 'origin' }];
  assert.equal(explainFacts(po, otherStarDim).matched, false);
});

test('Questions on the Stars requires actual placements and keeps the Horse excerpts separate', () => {
  const id = suffix => 'ziwei-v1-zhuxing-wenda-p' + suffix;
  const horse = id('153000-002');
  const excerpt = '遇陀罗谓之折足马';
  const horseWitness = batch64.witnesses.find(witness =>
    witness.proofs.some(proof => proof.id === horse && proof.text === excerpt));
  const horseChart = raw(horseWitness);
  const explainFacts = (claimId, facts, timeKnown) => explainClaim(claimId, 'ziwei', context(queries(facts, timeKnown)[0]), undefined, catalog);
  assert.ok(explainFacts(horse, horseChart).matchedBranches.some(branch => branch.text === excerpt));
  const withoutTuo = horseChart.filter(fact => fact.kind !== 'palace_star' || fact.star !== '陀罗');
  assert.ok(!explainFacts(horse, withoutTuo).matchedBranches.some(branch => branch.text === excerpt));
  assert.equal(explainFacts(horse, horseChart, false).matched, false);
  assert.doesNotMatch(buildReportMaterials(lookup(queries(horseChart)).map(ref => ({ ...ref,
    personality: ref.personality.filter(hit => hit.id === horse),
    events: ref.events.filter(hit => hit.id === horse),
  }))), /俱主灾病/u);

  const wuTan = id('014-003');
  const wuTanChart = raw(batch64.witnesses.find(witness => witness.proofs.some(proof => proof.id === wuTan)));
  assert.ok(explainFacts(wuTan, wuTanChart).matched);
  const noTan = wuTanChart.filter(fact => fact.kind !== 'palace_star' || fact.star !== '贪狼');
  assert.equal(explainFacts(wuTan, [...noTan, { kind: 'palace_sector_star', palace: '命宫', star: '贪狼' }]).matched, false);

  const sunMoon = id('121000-004');
  assert.equal(catalog.get(sunMoon).inputs, undefined);
  assert.equal(catalog.get(sunMoon).branches.length, 0);
  assert.match(explainFacts(sunMoon, horseChart).reviewNote, /同盘组合不可达/u);
});

test('birth qualifiers, two-sided Fire and Bell, and an empty main-star count require their own facts', () => {
  const tianxiang = '107002-001';
  const life = chartFor(tianxiang, { kind: 'natal_year_stem', stem: '己' }, batch61.witnesses);
  assert.ok(explain(tianxiang, life).matched);
  assert.equal(explain(tianxiang, life.filter(fact => !['natal_gender', 'natal_year_stem'].includes(fact.kind))).matched, false);
  assert.equal(explain(tianxiang, [...life, { kind: 'natal_year_stem', stem: '甲' }]).matched, false);
  assert.equal(explain(tianxiang, [...life, { kind: 'natal_gender', gender: '男' }]).matched, false);

  const flank = '144000-002';
  const fireBell = chartFor(flank, { kind: 'palace_star', palace: '父母', star: '铃星', scope: 'origin' }, batch61.witnesses);
  assert.ok(explain(flank, fireBell).matchedBranches.some(branch => branch.text === '惟夹忌'));
  assert.equal(explain(flank, fireBell.filter(fact => fact.kind !== 'palace_mutagen' || fact.palace !== '命宫' || fact.change !== '忌')).matched, false);
  assert.equal(explain(flank, fireBell.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '命宫' || fact.target !== '父母')).matched, false);

  const noMain = '164001-002';
  const empty = chartFor(noMain, { kind: 'palace_main_count', palace: '命宫', count: 0 }, batch61.witnesses);
  assert.ok(explain(noMain, empty).matched);
  assert.equal(explain(noMain, empty.filter(fact => fact.kind !== 'palace_main_count' || fact.palace !== '命宫')).matched, false);
});

test('Sun and Moon must flank the specified Treasury from both adjacent seats', () => {
  const id = '170000-001';
  const facts = chartFor(id);
  const sat = (star, palace) => matchesFact(facts, { kind: 'palace_star', scope: 'origin', star, palace });
  assert.ok(sat('天府', '财帛') && sat('太阳', '疾厄') && sat('太阴', '子女'));
  assert.ok(explain(id, facts).matched);
  const oneSide = facts.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '财帛' || fact.target !== '子女');
  assert.equal(explain(id, oneSide).matched, false);
  assert.equal(explain(id, facts, false).matched, false);
});

test('the body placement and spouse placement cite only the corresponding text', async () => {
  const spouse = '117003-001';
  const facts = chartFor(spouse, { kind: 'palace_star', palace: '夫妻', star: '文昌', scope: 'origin' });
  const hasQu = matchesFact(facts, { kind: 'palace_star', palace: '夫妻', star: '文曲', scope: 'origin' });
  const { report } = await generateReport({ chartQueries: queries(facts) }, {
    lookup: parsed => lookup(parsed).map(ref => ({ ...ref,
      personality: ref.personality.filter(hit => hit.id === idOf(spouse)),
      events: ref.events.filter(hit => hit.id === idOf(spouse)),
    })),
    signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /文昌同亦然/u);
      if (!hasQu) assert.doesNotMatch(materials, /太阴同文曲于妻宫/u);
      assert.doesNotMatch(materials, /在身命巧艺之人/u);
      return '太阴昌曲取材校验';
    },
  });
  assert.equal(report, '太阴昌曲取材校验');

  const body = '117003-002';
  const bodyExample = witnesses.find(witness => witness.proofs.some(proof => proof.id === idOf(body))
    && raw(witness).some(fact => fact.kind === 'body_palace' && fact.palace !== '命宫')
    && matchesFact(raw(witness), { kind: 'palace_star', star: '太阴', scope: 'origin' })
    && !matchesFact(raw(witness), { kind: 'palace_star', star: '太阴', scope: 'origin', palace: '命宫' }));
  assert.ok(bodyExample);
  const bodyFacts = raw(bodyExample);
  assert.ok(explain(body, bodyFacts).matched);
  assert.equal(explain(body, bodyFacts.filter(fact => fact.kind !== 'body_palace')).matched, false);
});

test('proof of no emptiness is local to the occupied wealth or estate palace', () => {
  const id = '172003-002';
  const facts = chartFor(id);
  const claim = explain(id, facts);
  assert.ok(claim.matched);
  const absent = claim.matchedBranches[0].matchedConditions.absent;
  const { palace } = absent[0];
  assert.deepEqual(new Set(absent.map(fact => fact.star)), new Set(['天空', '旬空', '截路', '空亡']));
  assert.ok(absent.every(fact => fact.palace === palace));
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== palace)).matched, false);
  assert.equal(explain(id, [...facts, { kind: 'palace_star', palace, star: '截路', scope: 'origin' }]).matched, false);
});
