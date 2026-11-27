import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeBaZi } from './bazi-analysis.ts';
import { calculateBaZi, describeBaZiPillars } from './charts.ts';

const analyze = (year, month, day, hour) => analyzeBaZi(describeBaZiPillars({ year, month, day, hour }));

test('derives all stem and branch attributes, ordered hidden stems and seasons', () => {
  const chart = (ganZhi) => analyze(ganZhi, ganZhi, ganZhi, ganZhi).L1;
  const stems = '甲乙丙丁戊己庚辛壬癸';
  const branches = '子丑寅卯辰巳午未申酉戌亥';
  const hidden = ['癸', '己癸辛', '甲丙戊', '乙', '戊乙癸', '丙戊庚', '丁己', '己丁乙', '庚壬戊', '辛', '戊辛丁', '壬甲'];
  for (const [index, stem] of [...stems].entries()) {
    const result = chart(stem + branches[index]).pillars[0].stem;
    assert.equal(result.name, stem);
    assert.equal(result.element, '木木火火土土金金水水'[index]);
    assert.equal(result.polarity, '阳阴'[index % 2]);
    assert.match(result.id, /^stem:/);
  }
  for (const [index, branch] of [...branches].entries()) {
    const l1 = chart(stems[index % 2] + branch);
    assert.equal(l1.pillars[1].branch.element, '水土木木土火火土金金土水'[index]);
    assert.equal(l1.pillars[1].branch.polarity, '阳阴'[index % 2]);
    assert.equal(l1.monthCommand.season, '春夏秋冬'[Math.floor(((index + 10) % 12) / 3)]);
    assert.deepEqual(l1.monthCommand.hiddenStems.map(({ name, order, role }) => [name, order, role]),
      [...hidden[index]].map((name, i) => [name, i + 1, ['本气', '中气', '余气'][i]]));
  }
});

test('indexes all ten gods by actual positions and keeps unweighted element distributions separate', () => {
  const { L1, L2 } = analyze('癸丑', '壬戌', '壬午', '壬寅');
  assert.equal(L1.dayMaster.stem.name, '壬');
  assert.deepEqual(L1.elements.stems, { 木: 0, 火: 0, 土: 0, 金: 0, 水: 4 });
  assert.deepEqual(L1.elements.branches, { 木: 1, 火: 1, 土: 2, 金: 0, 水: 0 });
  assert.deepEqual(L1.elements.hiddenStems, { 木: 1, 火: 3, 土: 4, 金: 2, 水: 1 });
  assert.equal(L1.tenGodIndex.length, 10);
  const peer = L1.tenGodIndex.find(({ name }) => name === '比肩');
  assert.deepEqual(peer.exposed.map(({ position }) => position), ['month', 'hour']);
  assert.deepEqual(peer.hidden, []);
  assert.equal(peer.count, 2);
  assert.deepEqual(L2.localStructures.roots.map(({ position, match }) => [position, match]), [['year', 'same_element']]);
  assert.deepEqual(L2.localStructures.daySeat.hiddenStems.map(({ tenGod }) => tenGod), ['正财', '正官']);
  assert.equal(L2.localStructures.daySeat.hasWealth, true);
  assert.equal(L2.localStructures.daySeat.hasSeal, false);
  const combos = new Map(L2.tenGodStructures.map((c) => [c.name, c]));
  for (const name of ['食伤生财', '官印相生', '杀印相生', '官杀混杂', '食神制杀']) {
    assert.equal(combos.get(name).candidate, true, name);
    assert.ok(combos.get(name).evidence.from.length);
    assert.ok(combos.get(name).evidence.to.length);
    assert.equal(combos.get(name).formation.status, 'evaluated');
    assert.equal(combos.get(name).formation.result, '仅见组合线索');
  }
  assert.equal(combos.get('伤官生财').candidate, false);
  assert.equal(L2.assessments.patterns.status, 'evaluated');
  assert.ok(Object.values(L2.assessments.usefulGod).every(({ status }) => status === 'evaluated'));
});

test('day seat reads only day hidden stems and keeps exact stem roots distinct', () => {
  const chart = (day) => analyze('甲子', '丙寅', day, '己巳').L2.localStructures;
  assert.deepEqual(chart('甲午').daySeat.hiddenStems.map(({ tenGod }) => tenGod), ['伤官', '正财']);
  assert.equal(chart('甲子').daySeat.hasSeal, true);
  assert.equal(chart('甲申').daySeat.hiddenStems[0].tenGod, '七杀');
  assert.ok(chart('甲寅').roots.some(({ position, match }) => position === 'day' && match === 'same_stem'));
  assert.deepEqual(analyze('丙午', '丁巳', '甲午', '庚申').L2.localStructures.roots, []);
});

test('reports complete and partial branch groups, directional stem relations and overlapping evidence', () => {
  const rel = (...pillars) => analyze(...pillars).L2.stemBranchRelations;
  const groups = rel('甲寅', '己巳', '庚申', '辛亥');
  assert.ok(groups.stems.some(({ combination, traditionalElement, transformation }) =>
    combination === '五合' && traditionalElement === '土' && transformation.supported === false));
  assert.ok(groups.stems.some(({ relation }) => relation === '克'));
  for (const kind of ['六合', '六冲', '六害', '相破', '三刑']) {
    assert.ok(groups.branches.some(({ type, state }) => type === kind && state === 'complete'), kind);
  }
  assert.ok(groups.tensions.length);
  assert.ok(groups.tensions.some(({ resolution }) => resolution.result === '合局见冲'));
  assert.ok(rel('甲寅', '丁卯', '戊辰', '辛酉').branches.some(({ type, state }) => type === '三会' && state === 'complete'));
  const trines = rel('甲申', '丙子', '戊辰', '庚辰').branches;
  assert.ok(trines.some(({ type, state }) => type === '三合' && state === 'complete'));
  assert.ok(trines.some(({ type, state }) => type === '自刑' && state === 'complete'));
  const partial = rel('甲寅', '丁巳', '甲午', '辛酉').branches;
  assert.ok(partial.some(({ type, state, missing }) => type === '三刑' && state === 'partial' && missing.includes('申')));
  assert.ok(partial.some(({ type, state }) => type === '三合' && state === 'partial'));
  assert.equal(rel('甲子', '丁卯', '庚午', '癸酉').branches.find(({ type }) => type === '相刑').pattern, '子卯');
});

test('computes the strength ledger and makes independent useful-element recommendations', () => {
  const { L2 } = analyze('癸丑', '壬戌', '壬午', '壬寅');
  const { dayMasterStrength, fiveElementStrength, tenGodStrength, usefulGod } = L2.assessments;
  assert.deepEqual([dayMasterStrength.result, dayMasterStrength.supportScore, dayMasterStrength.total], ['偏弱', 34, 121]);
  assert.deepEqual(fiveElementStrength.elements.map(({ score }) => score), [6, 21, 60, 20, 14]);
  assert.equal(tenGodStrength.scores.find(({ name }) => name === '比肩').score, 8);
  assert.deepEqual(fiveElementStrength.contributions.filter(({ position }) => position === 'day')
    .map(({ stem }) => stem), ['丁', '己']);
  assert.deepEqual(usefulGod.monthPattern.candidates, ['土']);
  assert.deepEqual(usefulGod.balancing.candidates, ['金', '水']);
  assert.deepEqual(usefulGod.climate.candidates, ['水']);
  assert.deepEqual(usefulGod.remedy.candidates, ['木']);
  assert.deepEqual(usefulGod.mediation.candidates, []);
  const winter = analyze('壬子', '壬子', '甲寅', '癸亥').L2.assessments;
  assert.equal(winter.dayMasterStrength.result, '偏强');
  assert.equal(winter.patterns.candidate, '正印格');
  assert.equal(winter.climate.temperature, '偏寒');
  assert.deepEqual(winter.usefulGod.climate.candidates, ['火']);
  const mixed = analyze('甲辰', '己丑', '癸亥', '乙卯').L2.assessments;
  assert.equal(mixed.patterns.result, '见配合');
  assert.ok(mixed.mediation.pairs.some(({ from, to, bridge }) =>
    from.element === '木' && to.element === '土' && bridge === '火'));
});

test('explains an eligible stem transformation and preserves evidence for special structures', () => {
  const { L2 } = analyze('甲寅', '己未', '丙午', '戊辰');
  const transformation = L2.stemBranchRelations.stems.find(({ combination }) => combination)?.transformation;
  assert.equal(transformation.supported, true);
  assert.deepEqual(transformation.evidence.roots, ['year', 'month', 'day', 'hour']);
  const special = analyze('癸丑', '壬戌', '壬午', '壬寅').L2.specialStructures;
  assert.equal(special.naYin.byPillar[0].name, '桑柘木');
  assert.ok(special.shenShaCombinations.matches.some(({ position }) => position === 'hour'));
  assert.deepEqual([special.dayHourCombinations.day, special.dayHourCombinations.hour], ['壬午', '壬寅']);
  assert.equal(Object.hasOwn(special, 'kinship'), false);
});

test('extends the real Beijing example without changing the legacy pillars, ten gods or shen sha', () => {
  const chart = calculateBaZi(Date.UTC(1973, 9, 12, 20, 19), Date.UTC(1973, 9, 13, 4, 19));
  const analysis = analyzeBaZi(chart);
  assert.deepEqual(analysis.pillars, { year: '癸丑', month: '壬戌', day: '壬午', hour: '壬寅' });
  assert.deepEqual(analysis.L2.specialStructures.shenSha.byPillar, chart.shenSha);
  assert.deepEqual(analysis.L1.pillars.map(({ tenGod }) => tenGod), ['劫财', '比肩', '日主', '比肩']);
  assert.deepEqual(JSON.parse(JSON.stringify(analysis)), analysis);
});
