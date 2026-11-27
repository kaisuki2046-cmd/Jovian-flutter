import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {astro} from 'iztro';
import './server/knowledge/runtime.mjs';
import {describeFortuneFact,formatFortuneFactAudit, formatFortunePrompt} from './control/fortune-prompt.mjs';
import {createFortuneDeepSeek} from './server/deepseek-expression.mjs';
const {quanshuTigerCondition,quanshuMoonAnswerSeat,quanshuTigerPolicy}=await import('./control/ziwei-tiger-layers.ts');
const {quanshuLimitBranches}=await import('./control/ziwei-limit-branches.ts');
const {quanshuLimitTiming}=await import('./control/ziwei-limit-timing.ts');
const {quanshuLimitVerseContacts}=await import('./control/ziwei-limit-verse-contacts.ts');
const {quanshuTimedLianzhen,quanshuTimedTong}=await import('./control/ziwei-timed-limit-conditions.ts');
const {quanshuLimitPhase,quanshuLunarMidnight,quanshuLuYangTuo,quanshuMingTabooStar,quanshuMinorLimit,
  quanshuTransformations,readQuanshuNatal}=await import('./control/ziwei-quanshu.ts');
const {quanshuXingJiTiger}=await import('./control/ziwei-xing-ji-tiger.ts');
const {quanshuFourFlying}=await import('./control/ziwei-kongjie.ts');
const {calculateFortuneFacts,validateFortuneFacts}=await import('./control/fortune-facts.ts');
const {buildFactTimeContext}=await import('./control/fact-time-context.ts');
const {buildFortuneFactSubmission}=await import('./control/fortune-fact-submission.ts');
const {bindClientFortuneRun,readClientFactTime}=await import('./server/client-facts.mjs');
const {buildZiweiFactWindow}=await import('./control/ziwei-flows.ts');
const {matchFortuneKnowledge}=await import('./control/knowledge/match.ts');
const {evaluateFortuneRules,fortuneKnowledge}=await import('./control/knowledge/catalog.ts');
const {interpretFortune,requestForFortuneRun}=await import('./control/fortune-interpretation.ts');
const {buildFortuneModelContext}=await import('./control/fortune-model-context.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/quanshu-tiger-reference.json',import.meta.url)));
const config={yearDivide:'normal',horoscopeDivide:'normal',ageDivide:'normal',dayDivide:'current'};
const branches=[...'子丑寅卯辰巳午未申酉戌亥'];
const all=p=>[...p.majorStars,...p.minorStars,...p.adjectiveStars];
const native=(name='seven')=>{const {year,branch,...args}=ref.cases[name];return astro.withOptions({...args,fixLeap:true,config}).toJSON();};
const chart=n=>({timeKnown:true,bazi:{rawResult:[]},western:{rawResult:[]},ziwei:{engineName:'iztro',engineVersion:'2.6.5',rulesetVersion:'standard-new-year-leap-split-late-zi-current-v1',rawResult:[n]}});
const cache=new Map();
function real(name){if(!cache.has(name)){const n=native(name),year=ref.cases[name].year,input={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year}};
 cache.set(name,calculateFortuneFacts(input,buildFactTimeContext(input,Date.parse(year+'-11-19T00:00:00Z'),'server'),'tiger-private-run',{snapshotId:'tiger-private-snapshot',chart:chart(n)}));}return cache.get(name);}
const rows=run=>run.facts.filter(f=>f.factType==='quanshu_tiger_layer_context');
const match=(run,i)=>matchFortuneKnowledge(run).byMethod.ziwei[i];
const combinedType = 'quanshu_xing_ji_tiger';
const combinedRows = run => run.facts.filter(f => f.factType === combinedType);
const passageRule = n => fortuneKnowledge.ziwei.rules.find(r => r.knowledgeId.includes('expansion-p' + String(n).padStart(3, '0') + '-'));
const passageResult = (run, n) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === passageRule(n).knowledgeId);
function sameYear(name, original = real(name)) {
  const year = ref.cases[name].year;
  const facts = original.facts.filter(f => f.factType !== combinedType || f.normalizedPayload.lunarYear === year);
  const fact = facts.find(f => f.factType === combinedType);
  assert.ok(fact, name);
  return { run: { ...original, facts }, fact, data: fact.normalizedPayload };
}
function submittedYear(name, birthContext) {
  const year = ref.cases[name].year;
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const now = Date.UTC(year, 5, 1), archive = { snapshotId: name, chart: chart(native(name)) };
  if (birthContext) archive.chart.birthContext = birthContext;
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), name, archive);
  validateFortuneFacts(run);
  return sameYear(name, run);
}
function condition(n=native(),year=2024){const index=n.palaces.find(p=>p.earthlyBranch===branches[(year-4)%12]).index;return quanshuTigerCondition(n,index,index,year,'yearly');}

test('p029 binds the Bing natal Lianzhen taboo and actual Ding annual blade to the northern minor half', () => {
  const natal = astro.withOptions({ dateStr: '1986-06-23', timeIndex: 1, gender: '女', fixLeap: true, config }).toJSON();
  const year = 2037, now = Date.UTC(year, 5, 1);
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const archive = { snapshotId: 'lianzhen-bing-annual-blade', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
  validateFortuneFacts(run);
  const facts = run.facts.filter(fact => fact.factType === 'quanshu_timed_limit_condition'
    && fact.normalizedPayload.star === '廉贞' && fact.normalizedPayload.lunarYear === year);
  const active = facts.find(fact => fact.normalizedPayload.activeInSourceHalf === true);
  const inactive = facts.find(fact => fact.normalizedPayload.activeInSourceHalf === false);
  assert.ok(active && inactive);
  const data = active.normalizedPayload;
  assert.deepEqual([data.branch, data.starGroup, data.guardScopes], ['丑', '北斗', ['minor']]);
  assert.deepEqual([active.activeFrom, active.activeTo], ['2037-02-14T16:00:00.000Z', '2037-08-10T16:00:00.000Z']);
  assert.deepEqual([data.lianzhenNatalXingJiBladeCandidate, data.lianzhenYearXingJiBladeCandidate], [false, false]);
  assert.equal(data.lianzhenNatalSelfJiAnnualBladeCandidate, true);
  assert.deepEqual(data.lianzhenNatalSelfJiAnnualBladeWitness, { branch: '丑', birthStem: '丙', tabooStar: '廉贞',
    tabooBranch: '丑', tianxingBranch: '丑', annualStem: '丁', annualBladeBranch: '未' });
  assert.equal(inactive.activeFrom, active.activeTo);
  assert.equal(inactive.normalizedPayload.lianzhenNatalSelfJiAnnualBladeCandidate, true);
  assert.equal(inactive.normalizedPayload.lianzhenNatalSelfJiAnnualBladeWitness, undefined);
  const isolated = { ...run, facts: [active] };
  const hit = passageResult(isolated, 29);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.windows, [{ start: active.activeFrom, endExclusive: active.activeTo }]);
  assert.equal(passageResult({ ...run, facts: [inactive] }, 29).status, 'not_matched');
  const wrong = { ...active, normalizedPayload: { ...data, sourceFactType: 'other-source' } };
  assert.equal(passageResult({ ...run, facts: [wrong] }, 29).status, 'not_matched');
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), archive.snapshotId));
  assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  assert.match(formatFortuneFactAudit(input), /生年干丙使廉贞化忌，天刑实守同一丑宫，流年干丁安擎羊在未宫实冲/u);
  assert.doesNotMatch(formatFortunePrompt(input), /天刑实守同一丑宫|lianzhenNatalSelfJiAnnualBladeWitness/u);
});

test('p029 separates the Ming Geng Tianxiang taboo by natal and annual emitter inside the verified northern limit', () => {
  for (const [dateStr, year, periodScope, layer, xingBranch, xingRelation] of [
    ['1990-02-15', 1997, 'minor', 'natal', '酉', '守'],
    ['1986-10-15', 2000, 'decadal', 'yearly', '巳', '三合'],
  ]) {
    const engine = astro.withOptions({ dateStr, timeIndex: 0, gender: '女', fixLeap: true, config }), natal = engine.toJSON();
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 1), archive = { snapshotId: 'lianzhen-ming-geng-' + layer, chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
    validateFortuneFacts(run);
    const facts = run.facts.filter(row => row.factType === 'quanshu_timed_limit_condition'
      && row.normalizedPayload.sourceFactType === combinedType && row.normalizedPayload.lunarYear === year);
    const active = facts.find(row => row.normalizedPayload.star === '廉贞' && row.normalizedPayload.activeInSourceHalf === true);
    assert.ok(active);
    const data = active.normalizedPayload;
    assert.deepEqual(data.guardScopes, [periodScope]);
    assert.equal(data.lianzhenMingGengTabooProfile, 'quanshu-nanyangtang-geng-tianxiang-ji-lianzhen-v1');
    assert.deepEqual([data.lianzhenMingGengNatalXingJiBladeCandidate, data.lianzhenMingGengYearXingJiBladeCandidate],
      [layer === 'natal', layer === 'yearly']);
    assert.deepEqual([data.lianzhenNatalXingJiBladeCandidate, data.lianzhenYearXingJiBladeCandidate, data.lianzhenNatalSelfJiAnnualBladeCandidate],
      [false, false, false]);
    assert.deepEqual(data.lianzhenMingGengXingJiWitnesses, [{ layer, stem: '庚', branch: '酉',
      tianxing: { branch: xingBranch, relation: xingRelation }, blade: { branch: '酉', relation: '守' },
      taboo: { star: '天相', branch: '卯', relation: '冲' }, candidate: true }]);
    const scoped = { ...run, facts: [active] }, hit = passageResult(scoped, 29);
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.windows, [{ start: active.activeFrom, endExclusive: active.activeTo }]);
    const noEdition = { ...active, normalizedPayload: { ...data, lianzhenMingGengTabooProfile: undefined } };
    assert.equal(passageResult({ ...run, facts: [noEdition] }, 29).status, 'unknown');
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), archive.snapshotId));
    assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
    assert.doesNotMatch(formatFortunePrompt(input), /卯宫天相|lianzhenMingGengXingJiWitnesses/u);

    const h = engine.horoscope(`${year}-06-01`, 6), frame = { lunarYear: year, yearIndex: h.yearly.index,
      decadalIndex: h.decadal.index, minorIndex: h.age.index, age: h.age.nominalAge };
    const wrong = structuredClone(natal), seat = wrong.palaces.find(row => row.earthlyBranch === '卯');
    const [xiang] = seat.majorStars.splice(seat.majorStars.findIndex(row => row.name === '天相'), 1);
    seat.minorStars.push(xiang);
    const limits = quanshuLimitBranches(wrong, frame), source = quanshuXingJiTiger(wrong, frame.yearIndex, limits);
    const [timing] = quanshuLimitTiming(wrong, limits, { start: Date.parse(active.activeFrom), end: Date.parse(active.activeTo) }, frame);
    const lacking = quanshuTimedLianzhen(timing.data, source);
    assert.equal(lacking.activeInSourceHalf, true);
    assert.equal(lacking[layer === 'natal' ? 'lianzhenMingGengNatalXingJiBladeCandidate' : 'lianzhenMingGengYearXingJiBladeCandidate'], undefined);
    assert.deepEqual(lacking.lianzhenMingGengXingJiWitnesses, []);
    assert.equal(passageResult({ ...run, facts: [{ ...active, normalizedPayload: lacking }] }, 29).status, 'unknown');

    if (layer === 'natal') {
      const otherHalf = facts.find(row => row.normalizedPayload.star === '廉贞' && row.activeFrom === active.activeTo);
      assert.ok(otherHalf);
      assert.equal(otherHalf.normalizedPayload.activeInSourceHalf, false);
      assert.deepEqual(otherHalf.normalizedPayload.lianzhenMingGengXingJiWitnesses, []);
      assert.equal(passageResult({ ...run, facts: [otherHalf] }, 29).status, 'not_matched');
    }
  }
});

test('p029 enumerates co-seated and opposed taboos with the actual annual minor-limit parity', () => {
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branchAt = index => branches[(index + 12) % 12];
  const stemsWithTabooAt = distance => stems.filter(stem => {
    const blade = quanshuLuYangTuo(stem).qingyangBranch;
    const taboos = [
      quanshuTransformations(stem).find(row => row.kind === '忌').star,
      quanshuMingTabooStar(stem),
    ];
    return branches.some((_, ziwei) => branches.some((__, hour) => {
      const lian = branchAt(ziwei - 8);
      const positions = { 廉贞: lian, 太阳: branchAt(ziwei - 3), 武曲: branchAt(ziwei - 4),
        天同: branchAt(ziwei - 5), 天机: branchAt(ziwei - 1), 太阴: branchAt(5 - ziwei),
        巨门: branchAt(7 - ziwei), 天相: branchAt(8 - ziwei), 贪狼: branchAt(6 - ziwei),
        文昌: branchAt(10 - hour), 文曲: branchAt(4 + hour) };
      const encounter = branchAt(branches.indexOf(lian) + distance);
      return blade === lian && taboos.some(star => positions[star] === encounter);
    }));
  });
  const coSeatedStems = stemsWithTabooAt(0), opposedStems = stemsWithTabooAt(6);
  assert.deepEqual(coSeatedStems, ['丙', '己', '辛']);
  assert.deepEqual(opposedStems, ['己', '庚', '辛']);
  const yearlyStems = new Set(), yearlyOpposedStems = new Set();
  for (let birth = 0; birth < 12; birth++) for (const gender of ['女', '男']) {
    for (let age = 1; age <= 60; age++) {
      const minor = quanshuMinorLimit(branches[birth], gender, age).branch;
      const annual = birth + age - 1;
      assert.equal(branches.indexOf(minor) % 2, annual % 2);
      const stem = stems[annual % 10];
      if (quanshuLuYangTuo(stem).qingyangBranch === minor) {
        if (coSeatedStems.includes(stem)) yearlyStems.add(stem);
        if (opposedStems.includes(stem)) yearlyOpposedStems.add(stem);
      }
    }
  }
  assert.deepEqual([...yearlyStems].sort(), ['丙', '己'].sort());
  assert.deepEqual([...yearlyOpposedStems], ['己']);

  const year = 2026, now = Date.UTC(year, 5, 1);
  const engine = astro.withOptions({ dateStr: '1951-03-14', timeIndex: 0, gender: '女', fixLeap: true, config });
  const natal = engine.toJSON(), params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const archive = { snapshotId: 'lianzhen-xin-natal', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
  validateFortuneFacts(bound);
  const facts = bound.facts.filter(row => row.factType === 'quanshu_timed_limit_condition'
    && row.normalizedPayload.star === '廉贞' && row.normalizedPayload.lunarYear === year);
  const active = facts.find(row => row.normalizedPayload.lianzhenNatalDoubleGuardActiveCandidate === true);
  assert.ok(active);
  assert.deepEqual(active.normalizedPayload.lianzhenNatalDoubleGuardWitness,
    { branch: '戌', birthStem: '辛', tabooStar: '文昌', tianxingBranch: '戌', bladeBranch: '戌' });
  assert.deepEqual(active.normalizedPayload.guardScopes, ['decadal', 'minor']);
  assert.ok(facts.some(row => row.activeFrom === active.activeTo && row.normalizedPayload.lianzhenNatalDoubleGuardActiveCandidate === false));
  const hit = passageResult({ ...bound, facts: [active] }, 29);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: '2026-02-16T16:00:00.000Z', endExclusive: '2026-08-12T16:00:00.000Z' }]);
  assert.equal(hit.matchedSourceExcerpt, '大小二限遇廉贞，更有天刑忌刃侵');

  const h = engine.horoscope('2026-06-15', 6);
  const frame = { lunarYear: year, age: h.age.nominalAge, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  const copy = structuredClone(natal), seat = copy.palaces.find(row => row.earthlyBranch === '戌');
  const [chang] = seat.minorStars.splice(seat.minorStars.findIndex(row => row.name === '文昌'), 1);
  seat.adjectiveStars.push(chang);
  const limits = quanshuLimitBranches(copy, frame);
  const start = Date.parse(active.activeFrom), end = Date.parse(active.activeTo);
  const [phase] = quanshuLimitTiming(copy, limits, { start, end }, frame);
  const wrongLayer = quanshuTimedLianzhen(phase.data, quanshuXingJiTiger(copy, frame.yearIndex, limits));
  assert.equal(wrongLayer.lianzhenNatalDoubleGuardActiveCandidate, undefined);
  assert.equal(wrongLayer.lianzhenNatalDoubleGuardWitness, undefined);
});

test('p029 confirms Ming natal Geng Tianxiang opposing the real double guard only in its northern overlap', () => {
  const year = 2005, now = Date.UTC(year, 5, 1);
  const engine = astro.withOptions({ dateStr: '1950-02-24', timeIndex: 0, gender: '女', fixLeap: true, config });
  const natal = engine.toJSON(), params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const archive = { snapshotId: 'lianzhen-geng-natal-opposed-ji', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
  validateFortuneFacts(bound);
  const facts = bound.facts.filter(row => row.factType === 'quanshu_timed_limit_condition'
    && row.normalizedPayload.star === '廉贞' && row.normalizedPayload.lunarYear === year);
  const field = 'lianzhenMingGengNatalTabooOpposedDoubleGuardCandidate';
  const active = facts.find(row => row.normalizedPayload[field] === true);
  assert.ok(active);
  assert.deepEqual(active.normalizedPayload.guardScopes, ['decadal', 'minor']);
  assert.equal(active.normalizedPayload.lianzhenNatalDoubleGuardActiveCandidate, false);
  assert.deepEqual(active.normalizedPayload.lianzhenMingGengXingJiWitnesses, [{ layer: 'natal', stem: '庚', branch: '酉',
    tianxing: { branch: '酉', relation: '守' }, blade: { branch: '酉', relation: '守' },
    taboo: { star: '天相', branch: '卯', relation: '冲' }, candidate: true }]);
  const run = { ...bound, facts: [active] }, hit = passageResult(run, 29);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '大小二限遇廉贞，更有天刑忌刃侵');
  assert.deepEqual(hit.windows, [{ start: '2005-02-08T16:00:00.000Z', endExclusive: '2005-08-04T16:00:00.000Z' }]);
  const later = facts.find(row => row.activeFrom === active.activeTo);
  assert.equal(later.normalizedPayload[field], false);
  assert.equal(passageResult({ ...bound, facts: [later] }, 29).status, 'partial');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
  assert.match(formatFortunePrompt(input), /天相化忌/u);
  assert.doesNotMatch(formatFortunePrompt(input), /酉宫|卯宫|lianzhenMingGengNatalTabooOpposedDoubleGuardCandidate/u);

  const calculate = (dateYear, archive, readFrame = frame => frame) => {
    const h = engine.horoscope(dateYear + '-06-15', 6);
    const frame = readFrame({ lunarYear: dateYear, age: h.age.nominalAge, yearIndex: h.yearly.index,
      decadalIndex: h.decadal.index, minorIndex: h.age.index });
    const limits = quanshuLimitBranches(archive, frame);
    const from = quanshuLunarMidnight(dateYear, 1);
    const [phase] = quanshuLimitTiming(archive, limits, { start: from, end: from + 1 }, frame);
    return quanshuTimedLianzhen(phase.data, quanshuXingJiTiger(archive, frame.yearIndex, limits));
  };
  const copy = structuredClone(natal);
  const place = copy.palaces.find(row => row.earthlyBranch === '卯');
  const [xiang] = place.majorStars.splice(place.majorStars.findIndex(row => row.name === '天相'), 1);
  place.minorStars.push(xiang);
  assert.equal(calculate(year, copy)[field], undefined);
  assert.equal(calculate(year, natal, frame => ({ ...frame, minorIndex: (frame.minorIndex + 1) % 12 }))[field], undefined);
  assert.equal(calculate(year + 1, natal)[field], false);
});

test('p028 and p029 separate the timed annual and natal conditions at the same two real limits', () => {
  const cases = [
    { dateStr: '1959-11-05', timeIndex: 4, gender: '男', year: 1976, star: '廉贞', passage: 29, startMonth: 1,
      archivedStar: '天刑', layer: 'adjectiveStars', bind: quanshuTimedLianzhen,
      produce: (natal, frame, limits) => quanshuXingJiTiger(natal, frame.yearIndex, limits),
      stem: 'lianzhenYearSelfJiBladeDoubleGuard', from: '1976-01-30T16:00:00.000Z', to: '1976-07-26T16:00:00.000Z',
      expected: { branch: '午', annualStem: '丙', tabooStar: '廉贞', tabooBranch: '午', tianxingBranch: '午', bladeBranch: '午' } },
    { dateStr: '1945-12-08', timeIndex: 3, gender: '男', year: 1969, star: '廉贞', passage: 29, startMonth: 1,
      archivedStar: '文曲', layer: 'minorStars', bind: quanshuTimedLianzhen,
      produce: (natal, frame, limits) => quanshuXingJiTiger(natal, frame.yearIndex, limits),
      stem: 'lianzhenYearWenquJiBladeDoubleGuard', from: new Date(quanshuLunarMidnight(1969, 1)).toISOString(),
      to: new Date(quanshuLunarMidnight(1969, 7)).toISOString(),
      expected: { branch: '未', annualStem: '己', tabooStar: '文曲', tabooBranch: '未', tianxingBranch: '未', bladeBranch: '未' } },
    { dateStr: '1964-12-30', timeIndex: 9, gender: '男', year: 2009, star: '廉贞', passage: 29, startMonth: 1,
      archivedStar: '文曲', layer: 'minorStars', bind: quanshuTimedLianzhen,
      produce: (natal, frame, limits) => quanshuXingJiTiger(natal, frame.yearIndex, limits),
      stem: 'lianzhenYearWenquJiOpposedDoubleGuard', from: '2009-01-25T16:00:00.000Z', to: '2009-08-19T16:00:00.000Z',
      expected: { branch: '未', annualStem: '己', tabooStar: '文曲', tabooBranch: '丑', tianxingBranch: '未', bladeBranch: '未', tabooRelation: '冲' } },
    { dateStr: '1959-03-30', timeIndex: 11, gender: '女', year: 1990, star: '天同', passage: 28, startMonth: 7,
      archivedStar: '地空', layer: 'minorStars', bind: quanshuTimedTong,
      produce: (_natal, _frame, limits) => quanshuLimitVerseContacts(limits),
      stem: 'tongFallenVoidsOpposedAtTaiSuiDoubleGuard', from: '1990-08-19T16:00:00.000Z', to: '1990-12-31T16:00:00.000Z',
      expected: { branch: '午', voids: [{ star: '古天空', branch: '子', relation: '冲' }] } },
    { dateStr: '1971-03-16', timeIndex: 10, gender: '女', year: 1990, star: '天同', passage: 28, startMonth: 7,
      archivedStar: '文昌', layer: 'minorStars', bind: quanshuTimedTong,
      produce: (_natal, _frame, limits) => quanshuLimitVerseContacts(limits),
      stem: 'tongFallenNatalJiOpposedAtTaiSuiDoubleGuard', from: '1990-08-19T16:00:00.000Z', to: '1990-12-31T16:00:00.000Z',
      expected: { layer: 'natal', stem: '辛', star: '文昌', branch: '子', relation: '冲' } },
    { dateStr: '1959-08-23', timeIndex: 8, gender: '女', year: 2026, star: '天同', passage: 28, startMonth: 7,
      archivedStar: '文曲', layer: 'minorStars', bind: quanshuTimedTong,
      produce: (_natal, _frame, limits) => quanshuLimitVerseContacts(limits),
      stem: 'tongFallenNatalJiOpposedAtTaiSuiDoubleGuard', from: '2026-08-12T16:00:00.000Z', to: '2026-12-31T16:00:00.000Z',
      expected: { layer: 'natal', stem: '己', star: '文曲', branch: '子', relation: '冲' } },
  ];
  for (const { dateStr, timeIndex, gender, year, star, passage, startMonth, archivedStar, layer, bind, produce, stem, from, to, expected } of cases) {
    const engine = astro.withOptions({ dateStr, timeIndex, gender, fixLeap: true, config });
    const natal = engine.toJSON(), params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 1), archive = { snapshotId: stem, chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), stem, archive);
    validateFortuneFacts(bound);
    const candidate = `${stem}Candidate`, witness = `${stem}Witness`;
    const run = { ...bound, facts: bound.facts.filter(row => row.factType === 'quanshu_timed_limit_condition'
      && row.normalizedPayload.star === star && row.normalizedPayload.lunarYear === year) };
    const trueRows = run.facts.filter(row => row.normalizedPayload[candidate] === true);
    assert.equal(trueRows.length, 1);
    const [active] = trueRows, data = active.normalizedPayload;
    assert.deepEqual(data.guardScopes, ['decadal', 'minor']);
    assert.deepEqual([active.activeFrom, active.activeTo], [from, to]);
    assert.deepEqual(data[witness], expected);
    const prior = passage === 29 ? data.lianzhenNatalDoubleGuardActiveCandidate : data.tongFallenAnnualOpposedAtTaiSuiCandidate;
    assert.equal(prior, false);
    if (passage === 28) {
      assert.equal(data.tongFallenVoidsOpposedCandidate, expected.voids !== undefined);
      assert.equal(natal.palaces.find(row => row.earthlyBranch === '子').majorStars.length, 0);
    }
    assert.ok(run.facts.some(row => row.normalizedPayload[candidate] === false
      && (startMonth === 1 ? row.activeFrom >= to : row.activeTo <= from)));

    const scoped = { ...run, facts: [active] }, hit = passageResult(scoped, passage);
    assert.equal(hit.status, 'matched');
    if (passage === 28) assert.equal(hit.matchedSourceExcerpt, '陷地须防恶杀冲');
    assert.deepEqual(hit.sourceFactIds, [active.factId]);
    assert.deepEqual(hit.windows, [{ start: from, endExclusive: to }]);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), stem));
    assert.ok(input.sections.some(section => section.findings.some(row => row.knowledgeId === hit.knowledgeId)));
    if (passage === 28) assert.match(formatFortunePrompt(input), /陷地须防恶杀冲/u);
    const local = expected.tabooRelation === '冲' ? /己年文曲化忌由丑宫正冲/u
      : expected.tabooStar === '文曲' ? /大小限均实守未宫廉贞并处北斗时段。流年己使文曲化忌/u
      : passage === 29 ? /大限和小限均实守午宫并处廉贞适用的北斗时段。流年干丙使廉贞化忌/u
        : expected.layer === 'natal'
          ? new RegExp(expected.star + '忌实从子宫正冲', 'u')
          : /太岁和复算大小限实守午宫，古天空由子宫正冲。原法空劫正冲与实限同段/u;
    if (expected.tabooStar === '文曲') {
      assert.equal(data.lianzhenYearSelfJiBladeDoubleGuardCandidate, false);
      if (expected.tabooRelation === '冲') {
        assert.equal(data.lianzhenYearWenquJiBladeDoubleGuardCandidate, false);
        assert.match(formatFortunePrompt(input), /文曲(?:化)?忌[^。]*丑宫正冲/u);
      } else {
        assert.match(formatFortunePrompt(input), /己年按同书流羊和四化表/u);
      }
    }
    assert.match(formatFortuneFactAudit(input), local);
    assert.doesNotMatch(formatFortunePrompt(input), local);
    assert.doesNotMatch(formatFortunePrompt(input), /子宫古天空|lianzhenYearSelfJiBladeDoubleGuard|lianzhenYearWenquJiBladeDoubleGuard|lianzhenYearWenquJiOpposedDoubleGuard|tongFallenVoidsOpposedAtTaiSuiDoubleGuard|tongFallenNatalJiOpposedAtTaiSuiDoubleGuard/u);

    const frame = lunarYear => {
      const h = engine.horoscope(`${lunarYear}-06-15`, 6);
      return { lunarYear, age: lunarYear - natal.rawDates.lunarDate.lunarYear + 1, yearIndex: h.yearly.index,
        decadalIndex: h.decadal.index, minorIndex: h.age.index };
    };
    const timedAt = (natalArchive, current) => {
      const limits = quanshuLimitBranches(natalArchive, current);
      const start = quanshuLunarMidnight(current.lunarYear, startMonth);
      const [timing] = quanshuLimitTiming(natalArchive, limits, { start, end: start + 1 }, current);
      return bind(timing.data, produce(natalArchive, current, limits));
    };
    assert.equal(timedAt(natal, frame(year + 1))[candidate], false);
    const current = frame(year), wrongLayer = structuredClone(natal);
    const palace = wrongLayer.palaces.find(palace => palace[layer].some(row => row.name === archivedStar));
    const [moved] = palace[layer].splice(palace[layer].findIndex(row => row.name === archivedStar), 1);
    palace[layer === 'minorStars' ? 'adjectiveStars' : 'minorStars'].push(moved);
    for (const [natalArchive, coordinates] of [[wrongLayer, current], [natal, { ...current, minorIndex: (current.minorIndex + 1) % 12 }]]) {
      const unresolved = timedAt(natalArchive, coordinates);
      assert.equal(unresolved[candidate], undefined);
      assert.equal(unresolved[witness], undefined);
    }
  }
});

test('p029 checks both real limits and the three natal conditions in one northern phase', () => {
  const engine = astro.withOptions({ dateStr: '1986-11-04', timeIndex: 1, gender: '女', fixLeap: true, config });
  const natal = engine.toJSON(), year = 2032, now = Date.UTC(year, 5, 1);
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const archive = { snapshotId: 'lianzhen-dual-limit-three-natal-checks', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
  validateFortuneFacts(run);
  const timed = run.facts.filter(row => row.factType === 'quanshu_timed_limit_condition' && row.normalizedPayload.star === '廉贞');
  const active = timed.find(row => row.normalizedPayload.lunarYear === year && row.normalizedPayload.lianzhenNatalDoubleGuardActiveCandidate === true);
  assert.ok(active);
  const data = active.normalizedPayload;
  assert.deepEqual([data.branch, data.starGroup, data.guardScopes], ['午', '北斗', ['decadal', 'minor']]);
  assert.deepEqual(data.lianzhenNatalDoubleGuardWitness, {
    branch: '午', birthStem: '丙', tabooStar: '廉贞', tianxingBranch: '午', bladeBranch: '午',
  });
  const secondHalf = timed.find(row => row.activeFrom === active.activeTo);
  assert.deepEqual(secondHalf.normalizedPayload.guardScopes, ['decadal']);
  assert.equal(secondHalf.normalizedPayload.activeInSourceHalf, true);
  assert.equal(secondHalf.normalizedPayload.lianzhenNatalDoubleGuardActiveCandidate, false);
  assert.equal(secondHalf.normalizedPayload.lianzhenNatalDoubleGuardWitness, undefined);
  const previous = timed.find(row => row.activeTo === active.activeFrom);
  assert.equal(previous.normalizedPayload.lunarYear, year - 1);
  assert.equal(previous.normalizedPayload.lianzhenNatalDoubleGuardActiveCandidate, false);

  const onlyDoubleGuard = { ...active, normalizedPayload: { ...data, lianzhenNatalXingJiBladeCandidate: false,
    lianzhenYearXingJiBladeCandidate: false, lianzhenNatalSelfJiAnnualBladeCandidate: false } };
  const isolated = { ...run, facts: [onlyDoubleGuard] };
  const hit = passageResult(isolated, 29);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: active.activeFrom, endExclusive: active.activeTo }]);
  assert.equal(passageResult({ ...run, facts: [secondHalf] }, 29).status, 'partial');
  const joined = passageResult({ ...run, facts: [onlyDoubleGuard, secondHalf] }, 29);
  assert.equal(joined.status, 'matched');
  assert.deepEqual(joined.windows, hit.windows);
  assert.deepEqual(joined.candidateWindows, [{ start: secondHalf.activeFrom, endExclusive: secondHalf.activeTo }]);
  assert.deepEqual(joined.sourceFactIds, [active.factId]);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), archive.snapshotId));
  assert.match(formatFortuneFactAudit(input), /大限和小限均实守午宫并处廉贞适用的北斗时段。生年干丙使廉贞化忌，与天刑和本命擎羊同宫/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /大限和小限实守本命廉贞所在宫，且同处廉贞适用的北斗半段/u);
  assert.doesNotMatch(prompt, /大限和小限均实守午宫|lianzhenNatalDoubleGuardWitness|lianzhenNatalPlacementProof/u);
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  const oldDoubleGuard = { ...onlyDoubleGuard, normalizedPayload: { ...onlyDoubleGuard.normalizedPayload, lianzhenNatalPlacementProof: undefined } };
  assert.equal(passageResult({ ...run, facts: [oldDoubleGuard] }, 29).status, 'unknown');

  const h = engine.horoscope(year + '-06-01', 6), frame = { lunarYear: year, yearIndex: h.yearly.index,
    decadalIndex: h.decadal.index, minorIndex: h.age.index, age: h.age.nominalAge };
  const wrongDecade = structuredClone(natal), decadal = wrongDecade.palaces.find(row => row.index === frame.decadalIndex);
  decadal.decadal.range = decadal.decadal.range.map(value => value - 1);
  assert.equal(quanshuLimitPhase(wrongDecade, frame.decadalIndex, frame.age, quanshuLunarMidnight(year, 1)).ready, true);
  const anotherMinor = natal.palaces.find(row => row.earthlyBranch === '未').index;
  const wrongBlade = structuredClone(natal);
  const bladePalace = wrongBlade.palaces.find(row => row.earthlyBranch === '午');
  const [blade] = bladePalace.minorStars.splice(bladePalace.minorStars.findIndex(row => row.name === '擎羊'), 1);
  bladePalace.adjectiveStars.push(blade);
  const window = { start: Date.parse(active.activeFrom), end: Date.parse(active.activeTo) };
  for (const [source, current] of [[wrongDecade, frame], [natal, { ...frame, minorIndex: anotherMinor }], [wrongBlade, frame]]) {
    const limits = quanshuLimitBranches(source, current), encounters = quanshuXingJiTiger(source, frame.yearIndex, limits);
    const [period] = quanshuLimitTiming(source, limits, window, current);
    const checked = quanshuTimedLianzhen(period.data, encounters);
    assert.equal(checked.lianzhenNatalDoubleGuardActiveCandidate, undefined);
    assert.equal(checked.lianzhenNatalDoubleGuardWitness, undefined);
    if (source === wrongBlade) assert.equal(checked.activeInSourceHalf, true);
    const fact = { ...active, normalizedPayload: { ...checked, lianzhenNatalXingJiBladeCandidate: false,
      lianzhenYearXingJiBladeCandidate: false, lianzhenNatalSelfJiAnnualBladeCandidate: false } };
    assert.equal(passageResult({ ...run, facts: [fact] }, 29).status, 'unknown');
  }
});

test('sixty source years and twelve real annual scopes prove Tiger is eight palaces from Tai-Sui and never the same annual life palace',()=>{
 for(let year=1984;year<2044;year++){const p=quanshuFourFlying(year),t=p.placements.find(s=>s.name==='白虎');assert.equal(t.branch,ref.whiteTigerByAnnualBranch[p.yearBranch]);assert.notEqual(t.branch,p.yearBranch);}
 const n=native();
 for(let year=2024;year<2036;year++){
  const start=Date.parse(year+'-11-19T00:00:00Z'),result=buildZiweiFactWindow({start,end:start+86400000},'day',chart(n));
  assert.equal(result.status,'ready');const y=result.candidates[0].scopes.find(s=>s.scope==='yearly').output;
  assert.equal(y.palaces.find(p=>p.index===y.index).yearlySuiqianStar,'岁建');
  assert.equal(y.palaces.find(p=>p.yearlySuiqianStar==='白虎').branch,ref.whiteTigerByAnnualBranch[y.earthlyBranch]);
  const p=condition(n,year);assert.equal(p.ready,true);assert.equal(p.annualTigerAtYear,false);assert.equal(p.annualTigerYearRelation,'三合');
 }
});

test('every Moon answer seat keeps volume-one and volume-three cells separate without filling either unlisted branch',()=>{
 for(const branch of branches){const p=quanshuMoonAnswerSeat(branch);assert.equal(p.answerGrade,ref.moonAnswer.fallen.includes(branch)?'陷地':ref.moonAnswer.supported.includes(branch)?'得垣':undefined);}
 for(const branch of ['午','未']){const p=quanshuMoonAnswerSeat(branch);assert.equal(p.answerGrade,'陷地');assert.equal(p.volume3Grade,undefined);}
 assert.equal(quanshuMoonAnswerSeat('寅').answerGrade,undefined);assert.equal(quanshuMoonAnswerSeat('寅').volume3Grade,'旺');
 assert.deepEqual(branches.map(branch=>quanshuMoonAnswerSeat(branch).volume2Grade),['庙','庙','庙','陷','陷','陷','陷','利','利','庙','庙','庙']);
 for(const b of ['','子丑','unknown'])assert.throws(()=>quanshuMoonAnswerSeat(b));
});

test('Tai Sui and the minor limit coincide only in the reverse sequence, where natal White Tiger cannot guard, oppose or trine', () => {
  let coincidences = 0;
  for (let birth = 1984; birth < 1996; birth++) for (const gender of ['女', '男']) {
    // May 5, 1993 belongs to lunar leap March. Keep the birth year and use a regular month.
    const dateStr = birth === 1993 ? '1993-06-05' : birth + '-05-05';
    const archive = astro.withOptions({ dateStr, timeIndex: 6, gender, fixLeap: true, config });
    const natal = archive.toJSON();
    const natalWhiteTiger = natal.palaces.find(p => p.suiqian12 === '白虎').earthlyBranch;
    for (let year = birth + 9; year < birth + 33; year++) {
      const horoscope = archive.horoscope(year + '-06-01', 6);
      if (year === birth + 9 || horoscope.yearly.index === horoscope.age.index) {
        const value = quanshuTigerCondition(natal, horoscope.yearly.index, horoscope.yearly.index, year,
          'yearly', horoscope.decadal.index, horoscope.age.index);
        assert.equal(value.sourceMinor.verified, true);
        assert.equal(value.sourceMinor.direction, gender === '男' ? '顺行' : '逆行');
        assert.equal(value.sourceMinor.ordinal, year - birth + 1);
      }
      if (horoscope.yearly.index !== horoscope.age.index) continue;
      coincidences++;
      assert.equal(gender, '女');
      assert.equal((year - birth) % 2, 1);
      const annual = horoscope.yearly.earthlyBranch;
      const distance = (branches.indexOf(natalWhiteTiger) - branches.indexOf(annual) + 12) % 12;
      assert.equal(distance % 2, 1);
      assert.equal(quanshuFourFlying(year).placements.find(row => row.name === '白虎').branch, ref.whiteTigerByAnnualBranch[annual]);
      assert.ok([4, 8].includes((branches.indexOf(ref.whiteTigerByAnnualBranch[annual]) - branches.indexOf(annual) + 12) % 12));
    }
  }
  assert.equal(coincidences, 48);
});

test('fallen Moon at native Parents preserves the same-fragment White Tiger guard',()=>{
 const run=real('moon'),p=rows(run).find(f=>f.scope==='yearly'&&f.normalizedPayload.lunarYear===2026).normalizedPayload;
 assert.equal(p.parentBranch,'未');assert.equal(p.moon.branch,'未');assert.equal(p.parentMoonFallen,true);assert.equal(p.moon.volume3Grade,undefined);
 assert.equal(p.annualBranch,'午');assert.notEqual(p.parentBranch,p.annualBranch);assert.equal(match(run,54).status,'not_matched');
 const aligned = sameYear('moonAligned');
 assert.deepEqual(aligned.data.parents, { branch: '未', moonBranch: '未', moonGrade: '陷地', moonFallenAtParents: true, taiSui: '三合', annualTiger: '守' });
 assert.equal(aligned.data.annualTiger, '未');
 assert.equal(passageResult(aligned.run, 5).status, 'matched');
 assert.ok(passageResult(aligned.run, 5).sourceFactIds.includes(aligned.fact.factId));
});

test('p005 accepts a Tai Sui guard or two actual distinct trines without treating a lone opposition as encounter', () => {
  for (const [name, start, sui, tiger, guard] of [
    ['moonSuiGuard', '2015-02-18T16:00:00.000Z', '未', '卯', true],
    ['moonSuiTigerTrines', '2011-02-02T16:00:00.000Z', '卯', '亥', false],
  ]) {
    const { run, fact, data } = submittedYear(name);
    const suiContact = guard ? '守' : '三合';
    assert.deepEqual(data.parents, { branch: '未', moonBranch: '未', moonGrade: '陷地', moonFallenAtParents: true,
      taiSui: suiContact, annualTiger: '三合' });
    assert.deepEqual([data.annualBranch, data.annualTiger], [sui, tiger]);
    assert.deepEqual([data.parentMoonTigerCandidate, data.parentMoonSuiGuardTigerTrineCandidate,
      data.parentMoonSuiTigerTrinesCandidate], [false, guard, !guard]);
    const result = passageResult(run, 5);
    assert.equal(result.status, 'matched');
    assert.deepEqual(result.sourceFactIds, [fact.factId]);
    assert.deepEqual(result.windows, [{ start, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), name));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes('太岁在' + sui + '宫，与父母宫为' + suiContact));
    assert.ok(prompt.includes('年度四飞白虎在' + tiger + '宫，与父母宫为三合'));
    assert.doesNotMatch(prompt, /parentMoonSuiGuardTigerTrineCandidate|parentMoonSuiTigerTrinesCandidate/u);
  }
  const near = sameYear('moonSuiOpposed');
  assert.deepEqual([near.data.parents.taiSui, near.data.parents.annualTiger], ['冲', '其他']);
  assert.equal(passageResult(near.run, 5).status, 'not_matched');
});

test('p005 exhausts the annual Tai Sui and Four Flying Tiger contacts for one verified Parents Moon chart', () => {
  const natal = native('moonSuiGuard');
  const read = (archive, lunarYear) => {
    const annual = branches[(lunarYear - 4) % 12];
    const yearIndex = archive.palaces.find(row => row.earthlyBranch === annual).index;
    return quanshuXingJiTiger(archive, yearIndex, quanshuLimitBranches(archive, { lunarYear, yearIndex }));
  };
  const required = data => evaluateFortuneRules('ziwei', 'year', [{ factType: combinedType, scope: 'yearly',
    completeness: 'complete', normalizedPayload: data }]).find(row => row.knowledgeId === passageRule(5).knowledgeId).required[0];
  const shapes = [];
  for (let lunarYear = 2004; lunarYear <= 2015; lunarYear++) {
    const data = read(natal, lunarYear);
    const valid = [data.parents.taiSui, data.parents.annualTiger].every(relation => ['守', '冲', '三合'].includes(relation));
    assert.equal(data.parentMoonYearContactsCandidate, valid);
    assert.deepEqual([required(data).hits.length, required(data).unknown], [Number(valid), false]);
    if (valid) shapes.push([lunarYear, data.parents.taiSui, data.parents.annualTiger]);
  }
  assert.deepEqual(shapes, [[2007, '三合', '守'], [2011, '三合', '三合'], [2015, '守', '三合']]);

  const unlisted = astro.withOptions({ dateStr: '1990-03-08', timeIndex: 2, gender: '女', fixLeap: true, config }).toJSON();
  const offGrade = read(unlisted, 2010);
  assert.deepEqual([offGrade.parents.branch, offGrade.parents.moonBranch, offGrade.parents.taiSui, offGrade.parents.annualTiger],
    ['寅', '寅', '守', '三合']);
  assert.equal(offGrade.parents.moonGrade, undefined);
  assert.equal(offGrade.parentMoonYearContactsCandidate, false);
  assert.deepEqual([required(offGrade).hits.length, required(offGrade).unknown], [0, false]);

  const misplaced = structuredClone(natal), parent = misplaced.palaces.find(row => row.name === '父母');
  const [moon] = parent.majorStars.splice(parent.majorStars.findIndex(star => star.name === '太阴'), 1);
  parent.adjectiveStars.push(moon);
  const unknown = read(misplaced, 2015);
  assert.equal(unknown.parentMoonYearContactsCandidate, undefined);
  assert.deepEqual([required(unknown).hits.length, required(unknown).unknown], [0, true]);
  const { run, fact } = sameYear('moonSuiGuard');
  const invalidRun = { ...run, facts: [{ ...fact, normalizedPayload: unknown }] };
  const missed = passageResult(invalidRun, 5);
  assert.equal(missed.status, 'unknown');
  assert.deepEqual(missed.sourceFactIds, []);
  const { input } = buildFortuneModelContext(invalidRun, interpretFortune(invalidRun, requestForFortuneRun(invalidRun), 'moon-wrong-layer'));
  assert.doesNotMatch(formatFortunePrompt(input), /在父母，如陷地失輝，遇流年白虎太歲/u);
});

test('p005 reports calendar points, edition grades and the natal same-seat condition only on the annual parent-Moon encounter', () => {
  const cases = [
    ['moonShortMonthEnd', '未', [1, 29, 29, '晦'], ['利', undefined], ['陀罗'], ['流年擎羊']],
    ['moonLongMonthBeforeEnd', '未', [11, 29, 30, undefined], ['利', undefined], ['陀罗'], ['流年擎羊']],
    ['moonLongMonthEnd', '午', [1, 30, 30, '晦'], ['陷', undefined], [], ['流年擎羊']],
    ['moonBirthNewDay', '午', [1, 1, 29, '朔'], ['陷', undefined], [], ['流年擎羊']],
    ['moonBirthLastQuarterDay', '巳', [1, 23, 30, '下弦'], ['陷', '陷'], [], []],
    ['moonSameDegreeWithoutEncounter', '未', undefined, undefined, [], []],
  ];
  for (const [name, branch, calendar, grades, natalAtSeat, yearlyAtSeat] of cases) {
    const { dateStr, timeIndex } = ref.cases[name];
    const hour = String(timeIndex * 2).padStart(2, '0');
    const birthContext = { precision: 'minute', birthInstant: new Date(dateStr + 'T' + hour + ':00:00+08:00').toISOString(),
      latitude: 39.9042, longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const { run, fact, data } = submittedYear(name, birthContext), evidence = data.parentMoonEvidence;
    assert.deepEqual([data.parents.branch, data.parents.moonBranch, data.parents.moonGrade], [branch, branch, '陷地'], name);
    assert.equal(data.parentMoonNatalSameSeatCandidate, natalAtSeat.length > 0, name);
    const result = passageResult(run, 5);
    assert.equal(result.status, calendar ? 'matched' : 'not_matched', name);
    if (calendar) {
      assert.deepEqual([evidence.calendar.lunarMonth, evidence.calendar.lunarDay, evidence.calendar.monthDays, evidence.calendar.point], calendar, name);
      assert.deepEqual([evidence.volume2Grade, evidence.volume3Grade], grades, name);
      assert.deepEqual(evidence.yangTuo.natal.filter(row => row.relation === '守').map(row => row.star), natalAtSeat, name);
      assert.deepEqual(evidence.yangTuo.yearly.filter(row => row.relation === '守').map(row => row.star), yearlyAtSeat, name);
      assert.deepEqual(result.sourceFactIds, [fact.factId]);
      assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    } else {
      assert.equal(evidence, undefined);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), name));
    assert.equal(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === result.knowledgeId),
      Boolean(calendar), name);
    const providerPrompt = formatFortunePrompt(input);
    assert.equal(providerPrompt.includes('在父母，如陷地失輝，遇流年白虎太歲'), Boolean(calendar), name);
    assert.equal(providerPrompt.includes('同一农历年的太岁与四飞白虎都守照该父母宫'), Boolean(calendar), name);
    assert.doesNotMatch(providerPrompt, /出生农历|原书异表见位|年度四飞白虎在|parentMoonYearContactsCandidate|parentMoonEvidence/u, name);
    const prompt = formatFortuneFactAudit(input);
    assert.equal(prompt.includes('父母宫太阴的原书异表见位'), Boolean(calendar), name);
    assert.equal(prompt.includes('同段另见卷一所说的羊陀同度候选'), natalAtSeat.length > 0, name);
    assert.equal(prompt.includes('同宫流曜另列盘层'), yearlyAtSeat.length > 0, name);
    if (calendar) {
      const [month, day, days, point] = calendar;
      const dateText = '出生农历' + month + '月第' + day + '日，本月共' + days + '日';
      assert.ok(prompt.includes(dateText), name);
      assert.equal(prompt.includes(dateText + '，按历日用语记为'), Boolean(point), name);
      if (point) assert.ok(prompt.includes(dateText + '，按历日用语记为' + point), name);
    }
    assert.doesNotMatch(prompt, /parentMoonEvidence|parentMoonNatalSameSeatCandidate/u);
  }
});

test('real annual and minor Lianzhen coincidence retains a separate trine annual Tiger and a separately named natal product layer',()=>{
 const run=real('lian'),actual=rows(run).find(f=>f.scope==='yearly'&&f.normalizedPayload.lunarYear===2026);
 const p=actual.normalizedPayload;
 assert.equal(p.annualMinorAtLianzhen,true);assert.equal(p.annualBranch,'午');
 assert.deepEqual(p.sourceMinor,{startBranch:'未',branch:'午',ordinal:38,direction:'逆行',verified:true});
 assert.equal(p.lianzhenAnnualTigerTrineCandidate,true);
 const tiger=p.fourFlying.find(s=>s.name==='白虎');assert.equal(tiger.branch,'寅');assert.equal(tiger.lianzhenRelation,'三合');
 assert.equal(p.natalTigerProductVerified,true);assert.equal(p.natalTigerSourceLayerVerified,false);
 const hit = passageResult(run, 46);
 assert.equal(hit.status, 'matched');
 assert.deepEqual(hit.unresolvedConditions, []);
 assert.deepEqual(hit.matchedConditions, ['按《全书》，同一农历年的太岁、小限实守本命廉贞，按当年太岁安出的四飞白虎从三合宫照来。']);
 assert.deepEqual(hit.windows, [{ start: actual.activeFrom, endExclusive: actual.activeTo }]);
 assert.equal(Date.parse(actual.activeFrom), quanshuLunarMidnight(2026, 1));
 const previous = rows(run).find(f => f.scope === 'yearly' && f.activeTo === actual.activeFrom);
 assert.equal(previous.normalizedPayload.lunarYear, 2025);
 assert.equal(passageResult({ ...run, facts: [previous] }, 46).status, 'not_matched');
 const annualSeat = native('lian').palaces.find(palace => palace.earthlyBranch === '午').index;
 const male = astro.withOptions({ dateStr: ref.cases.lian.dateStr, timeIndex: ref.cases.lian.timeIndex, gender: '男', fixLeap: true, config }).toJSON();
 const inconsistent = quanshuTigerCondition(male, annualSeat, annualSeat, 2026, 'yearly', undefined, annualSeat);
 assert.equal(inconsistent.annualMinorAtLianzhen, true);
 assert.equal(inconsistent.sourceMinor.verified, false);
 assert.equal(inconsistent.lianzhenAnnualTigerTrineCandidate, undefined);
 assert.equal(passageResult({ ...run, facts: [{ ...actual, normalizedPayload: inconsistent }] }, 46).status, 'unknown');
 const noMinor = quanshuTigerCondition(native('lian'), annualSeat, annualSeat, 2026, 'yearly');
 assert.equal(noMinor.lianzhenAnnualTigerTrineCandidate, undefined);
 const leap = astro.withOptions({ dateStr: '1993-05-05', timeIndex: 6, gender: '女', fixLeap: true, config }).toJSON();
 const leapBasis = quanshuTigerCondition(leap, annualSeat, annualSeat, 2026, 'yearly', undefined, annualSeat);
 assert.equal(leapBasis.ready, false);
 assert.equal(leapBasis.lianzhenAnnualTigerTrineCandidate, undefined);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'lianzhen-verified-minor'));
 const audit = formatFortuneFactAudit(input);
 assert.match(audit, /卷二小限诀从未宫起，按第38农历年逆行至午宫，与归档相符/u);
 assert.match(audit, /年度四飞白虎与已核的太岁、小限同守廉贞宫为三合位置/u);
 assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /同一农历年的太岁、小限实守本命廉贞，按当年太岁安出的四飞白虎从三合宫照来/u);
 assert.doesNotMatch(prompt, /按第38农历年逆行至午宫|年度四飞白虎与已核的太岁、小限同守廉贞宫为三合位置|lianzhenAnnualTigerTrineCandidate/u);
});

test('p046 matches verified late leap-month births through client submission and the annual SQLite window', () => {
  const year = 2010;
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const n = astro.withOptions({ dateStr: '1993-05-09', timeIndex: 2, gender: '女', fixLeap: true, config }).toJSON();
  const birth = readQuanshuNatal(n);
  assert.equal(birth.birthMonthBasis, 'quanshu-leap-next-month');
  assert.equal(birth.birthMonth, 4);
  const archive = { snapshotId: 'lianzhen-leap', chart: chart(n) };
  const now = Date.UTC(year, 5, 1);
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, archive)));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), 'lianzhen-leap', archive);
  validateFortuneFacts(run);

  const years = rows(run).filter(f => f.scope === 'yearly');
  const annual = years.find(f => f.normalizedPayload.lunarYear === year);
  assert.equal(annual.normalizedPayload.annualBranch, '寅');
  assert.deepEqual(annual.normalizedPayload.sourceMinor,
    { startBranch: '未', branch: '寅', ordinal: 18, direction: '逆行', verified: true });
  const hit = passageResult({ ...run, facts: [annual] }, 46);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: annual.activeFrom, endExclusive: annual.activeTo }]);
  assert.equal(Date.parse(annual.activeFrom), quanshuLunarMidnight(year, 1));
  assert.deepEqual(hit.sourceFactIds, [annual.factId]);
  assert.equal(passageResult({ ...run, facts: years.filter(f => f !== annual) }, 46).status, 'not_matched');
});

test('p005, p046 and p047 require verified main-star places from the same northern or southern sequence', () => {
  const cases = [
    ['moonSuiGuard', 5, 'moon', '天府', 'parentMoonSuiGuardTigerTrineCandidate', combinedType],
    ['lian', 46, 'lianzhen', '紫微', 'lianzhenAnnualTigerTrineCandidate', 'quanshu_tiger_layer_context'],
    ['qishaAnnualJiBladeTogether', 47, 'qisha', '天府', 'qishaSamePalaceAnnualJiBladeCandidate', combinedType],
  ];
  for (const [name, passage, proofKey, anchor, predicate, factType] of cases) {
    const { year, ...birth } = ref.cases[name];
    const calculated = astro.withOptions({ ...birth, fixLeap: true, config });
    const natal = calculated.toJSON(), h = calculated.horoscope(year + '-06-01', 6);
    const frame = { lunarYear: year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
    const produce = n => factType === combinedType
      ? quanshuXingJiTiger(n, frame.yearIndex, quanshuLimitBranches(n, frame))
      : quanshuTigerCondition(n, frame.yearIndex, frame.yearIndex, year, 'yearly', frame.decadalIndex, frame.minorIndex);
    const intact = produce(natal), proof = intact.principalSeatProof[proofKey];
    assert.equal(proof.anchor, anchor);
    assert.equal(proof.verified, true);
    assert.equal(proof.archiveBranch, proof.expectedBranch);
    assert.equal(intact[predicate], true);
    const corrupted = structuredClone(natal);
    const origin = corrupted.palaces.find(palace => palace.majorStars.some(star => star.name === anchor));
    const destination = corrupted.palaces.find(palace => palace.index === (origin.index + 1) % 12);
    const [displaced] = origin.majorStars.splice(origin.majorStars.findIndex(star => star.name === anchor), 1);
    destination.majorStars.push(displaced);
    const invalid = produce(corrupted);
    const placement = invalid.principalSeatProof[proofKey];
    assert.equal(placement.archiveBranch, proof.archiveBranch);
    assert.equal(placement.anchorBranch, destination.earthlyBranch);
    assert.equal(placement.verified, false);
    assert.equal(invalid[predicate], undefined);
    const query = data => evaluateFortuneRules('ziwei', 'year', [{ factType, scope: 'yearly', completeness: 'complete',
      normalizedPayload: data }]).find(row => row.knowledgeId === passageRule(passage).knowledgeId).required[0];
    assert.deepEqual([query(intact).hits.length, query(intact).unknown], [1, false]);
    assert.deepEqual([query(invalid).hits.length, query(invalid).unknown], [0, true]);
  }
});

test('p048 keeps the archived Bell and annual blade contacts as local observations',()=>{
 const run=real('seven'),p=rows(run).find(f=>f.scope==='yearly'&&f.normalizedPayload.lunarYear===2024).normalizedPayload;
 assert.equal(p.mainStars.find(s=>s.star==='七杀').branch,'子');assert.equal(p.annualBranch,'辰');
 assert.equal(p.fourFlying.find(s=>s.name==='白虎').sevenKillRelation,'守');assert.equal(p.encounterRangeVerified,false);
 assert.equal(p.bellProductVerified,true);assert.equal(p.bellSourceHourVerified,false);assert.equal(match(run,97).status,'not_matched');
 assert.equal(p.yang.length,2);assert.deepEqual(p.yang.map(y=>y.layer),['natal','yearly']);
 for (const [name, branch, isBirth] of [['qishaBirthBladeTiger', '未', true], ['qishaYearBladeTiger', '午', false]]) {
   const { run: exactRun, data } = sameYear(name);
   assert.deepEqual([data.qisha.branch, data.annualTiger, data.bellBranch], [branch, branch, branch]);
   assert.equal(data.qishaNatalBladeTigerCandidate, isBirth);
   assert.equal(data.qishaYearBladeTigerCandidate, !isBirth);
   assert.notEqual(data.annualBranch, branch);
   assert.equal(data.qishaQuanshuFixedNatalBladeTigerCandidate, false);
   assert.equal(passageResult(exactRun, 48).status, 'not_matched');
 }
});

test('p048 keeps paired opposition and trine observations apart from the source co-seat', () => {
  for (const [name, layer, relation, branch] of [
    ['qishaYearBladeOpposedTiger', 'yearly', '冲', '子'],
    ['qishaYearBladeTrineTiger', 'yearly', '三合', '子'],
    ['qishaNatalBladeTrineTiger', 'natal', '三合', '未'],
  ]) {
    const { run, data } = sameYear(name);
    validateFortuneFacts(run);
    assert.equal(data.qisha.branch, data.annualTiger);
    assert.equal(data.bellBranch, branch);
    assert.equal(data.qishaBell, relation);
    assert.equal(data.layers.find(row => row.layer === layer).bladeBranch, branch);
    assert.deepEqual([data.qishaNatalBladeTigerCandidate, data.qishaYearBladeTigerCandidate], [false, false]);
    assert.deepEqual([data.qishaNatalBladeAspectTigerCandidate, data.qishaYearBladeAspectTigerCandidate],
      [layer === 'natal', layer === 'yearly']);
    const hit = passageResult(run, 48);
    assert.equal(hit.status, 'not_matched');
    assert.deepEqual(hit.sourceFactIds, []);
    assert.deepEqual(hit.windows, []);
    const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'qisha-shared-aspect')).input;
    const prompt = formatFortuneFactAudit(input);
    const bladeLabel = layer === 'natal' ? '本命擎羊' : '流年擎羊';
    assert.ok(prompt.includes(bladeLabel + '与归档铃星同在' + branch + '宫，与七杀宫为' + relation));
    assert.doesNotMatch(prompt, /qishaNatalBladeAspectTigerCandidate|qishaYearBladeAspectTigerCandidate/u);
    assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
  }
  const near = sameYear('qishaSplitAspectTiger');
  const blade = near.data.layers.find(row => row.layer === 'yearly');
  assert.deepEqual([near.data.bellBranch, blade.bladeBranch, near.data.qishaBell, blade.qishaBlade], ['辰', '子', '三合', '三合']);
  assert.equal(near.data.qishaYearBladeAspectTigerCandidate, false);
  assert.equal(passageResult(near.run, 48).status, 'not_matched');
});

test('p048 uses the Ming natal Qisha, Yang and Bell co-seat with annual Tiger wherever it occurs', () => {
  const source = astro.withOptions({ dateStr: '1991-02-23', timeIndex: 5, gender: '女', fixLeap: true, config });
  const natal = source.toJSON();
  const bound = (chartData, year) => {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 1), archive = { snapshotId: 'ming-qisha-tiger', chart: chart(chartData) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
    validateFortuneFacts(run);
    const fact = combinedRows(run).find(row => row.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    return { run, fact, data: fact.normalizedPayload };
  };
  const { run, fact, data } = bound(natal, 2022);
  assert.deepEqual([data.qisha.branch, data.quanshuFixedBell.branch, data.annualTiger], ['戌', '戌', '戌']);
  assert.deepEqual([data.qisha.decadal, data.qisha.minor, data.lifeBranch, data.annualBranch], ['其他', '三合', '酉', '寅']);
  assert.equal(data.layers.find(row => row.layer === 'natal').bladeBranch, '戌');
  assert.notEqual(data.bellBranch, data.quanshuFixedBell.branch);
  assert.equal(data.qishaQuanshuFixedNatalBladeTigerCandidate, true);
  const isolated = { ...run, facts: [fact] };
  const hit = passageResult(isolated, 48);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.equal(fact.activeFrom, '2022-01-31T16:00:00.000Z');
  assert.equal(passageResult(run, 49).status, 'not_matched');
  const wrongSource = { ...fact, normalizedPayload: { ...data, quanshuFixedFireBellProfile: 'other-source' } };
  assert.equal(passageResult({ ...run, facts: [wrongSource] }, 48).status, 'not_matched');
  const { run: nearRun, fact: nearFact, data: near } = bound(natal, 2023);
  assert.equal(near.qisha.branch, '戌');
  assert.equal(near.annualTiger, '亥');
  assert.equal(near.qishaQuanshuFixedNatalBladeTigerCandidate, false);
  assert.equal(passageResult({ ...nearRun, facts: [nearFact] }, 48).status, 'not_matched');
  const h = source.horoscope('2022-06-01', 6);
  const qisha = natal.palaces.find(palace => palace.earthlyBranch === data.qisha.branch);
  qisha.majorStars.push({ ...qisha.majorStars.find(star => star.name === '七杀') });
  const limits = quanshuLimitBranches(natal, { lunarYear: 2022, yearIndex: h.yearly.index, decadalIndex: h.decadal.index,
    minorIndex: h.age.index });
  const unknown = quanshuXingJiTiger(natal, h.yearly.index, limits);
  assert.equal(unknown.ready, true);
  assert.equal(unknown.qishaQuanshuFixedNatalBladeTigerCandidate, undefined);
  assert.equal(passageResult({ ...run, facts: [{ ...fact, normalizedPayload: unknown }] }, 48).status, 'unknown');
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'ming-qisha-tiger'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  assert.match(formatFortuneFactAudit(input), /本命七杀、本命擎羊和南阳堂明刊铃星同守戌宫，当年四飞白虎也实到此宫/u);
  assert.doesNotMatch(formatFortunePrompt(input), /明刊铃星同守戌宫|qishaQuanshuFixedNatalBladeTigerCandidate/u);
});

test('two natal Sha seats qualify only when the same-year major and minor limits visit both required palaces', () => {
  const joined = sameYear('lifeBodyLimits'), separated = sameYear('lifeBodyAlone');
  for (const { data } of [joined, separated]) {
    assert.deepEqual([data.lifeBranch, data.bodyBranch], ['辰', '午']);
    assert.ok(data.nativeSha.some(row => row.star === '陀罗' && row.lifeContact === '守'));
    assert.ok(data.nativeSha.some(row => row.star === '擎羊' && row.bodyContact === '守'));
  }
  assert.equal(joined.data.lifeContact.decadal, '守');
  assert.equal(joined.data.bodyContact.minor, '守');
  assert.equal(passageResult(joined.run, 22).status, 'partial');
  assert.equal(passageResult(separated.run, 22).status, 'not_matched');
});

test('p022 uses a verified natal void or Ji recipient as one of the two actual guarding witnesses', () => {
  for (const [name, start, focusKey, expectedStar, wording] of [
    ['lifeBodyNatalJi', '1982-01-24T16:00:00.000Z', 'bodyContact', { star: '文昌', stem: '辛', branch: '午' },
      '生年干辛所推文昌化忌在午宫，与身宫为守'],
    ['lifeBodyRobbery', '1993-01-22T16:00:00.000Z', 'lifeContact', { star: '地劫', branch: '卯' },
      '地劫在卯宫，与命宫为守'],
    ['lifeBodySky', '1993-01-22T16:00:00.000Z', 'bodyContact', { star: '古天空', branch: '卯' },
      '古天空在卯宫，与身宫为守'],
  ]) {
    const { run, fact, data } = submittedYear(name);
    assert.notEqual(data.lifeBranch, data.bodyBranch);
    assert.equal(data.lifeBodyShaCandidate, false);
    assert.equal(data.lifeBodyAdditionalShaCandidate, true);
    const companions = data.nativeAdditionalSha.filter(row => row.lifeContact === '守' || row.bodyContact === '守');
    assert.deepEqual(companions.map(({ lifeContact, bodyContact, ...row }) => row), [expectedStar]);
    assert.equal(companions[0][focusKey], '守');
    assert.ok(data.nativeSha.some(row => row[focusKey === 'lifeContact' ? 'bodyContact' : 'lifeContact'] === '守'));
    const result = passageResult(run, 22);
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.sourceFactIds, [fact.factId]);
    assert.deepEqual(result.windows, [{ start, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), name));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(wording), name);
    assert.doesNotMatch(prompt, /lifeBodyAdditionalShaCandidate|nativeAdditionalSha/u);
  }

  const near = sameYear('lifeBodyNatalJiWithoutLimits');
  assert.ok(near.data.nativeAdditionalSha.some(row => row.stem === '辛' && row.bodyContact === '守'));
  assert.equal(passageResult(near.run, 22).status, 'not_matched');

  const { year, ...birth } = ref.cases.lifeBodyNatalJi;
  const archive = astro.withOptions({ ...birth, fixLeap: true, config });
  const natal = archive.toJSON(), h = archive.horoscope(year + '-06-01', 6);
  for (const palace of natal.palaces) palace.minorStars = palace.minorStars.filter(star => star.name !== '文昌');
  const frame = { lunarYear: year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  const missing = quanshuXingJiTiger(natal, frame.yearIndex, quanshuLimitBranches(natal, frame));
  assert.equal(missing.lifeBodyShaCandidate, false);
  assert.equal(missing.lifeBodyAdditionalShaCandidate, undefined);
});

test('p022 can verify two distinct natal palaces guarded only by Ming fixed Fire and Bell', () => {
  const dateStr = '1986-02-16', timeIndex = 1;
  const n = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config }).toJSON();
  const runFor = year => {
    const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const run = calculateFortuneFacts(input, buildFactTimeContext(input, Date.UTC(year, 5, 1), 'server'),
      'ming-life-body', { snapshotId: 'ming-life-body', chart: chart(n) });
    const fact = combinedRows(run).find(row => row.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    return { run: { ...run, facts: [fact] }, fact, data: fact.normalizedPayload };
  };
  const { run, fact, data } = runFor(1995);
  assert.deepEqual([data.lifeBranch, data.bodyBranch], ['丑', '卯']);
  assert.deepEqual([data.lifeContact.decadal, data.bodyContact.minor], ['守', '三合']);
  assert.equal(data.lifeBodyShaCandidate, false);
  assert.equal(data.lifeBodyAdditionalShaCandidate, false);
  assert.equal(data.lifeBodyMingFixedShaCandidate, true);
  assert.equal(data.lifeBodyMingFixedPairVerified, true);
  assert.deepEqual(data.lifeBodyMingFixedFireBell, [
    { star: '火星', branch: '丑', lifeContact: '守', bodyContact: '其他' },
    { star: '铃星', branch: '卯', lifeContact: '其他', bodyContact: '守' },
  ]);
  const result = passageResult(run, 22);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.sourceFactIds, [fact.factId]);
  assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-life-body'));
  assert.match(formatFortuneFactAudit(input), /按明刊定宫，火星实守/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /火星和铃星分别实守相异的本命命宫与身宫/u);
  assert.doesNotMatch(prompt, /按明刊定宫，火星实守|贪花恋酒|lifeBodyMingFixedPairVerified/u);
  assert.equal(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId).originalText, '身命两宫俱有杀');
  const wrong = { ...fact, normalizedPayload: { ...data, quanshuFixedFireBellProfile: 'other-source' } };
  assert.equal(passageResult({ ...run, facts: [wrong] }, 22).status, 'not_matched');
  const later = runFor(1996);
  assert.deepEqual(later.data.lifeBodyMingFixedFireBell, data.lifeBodyMingFixedFireBell);
  assert.equal(later.data.lifeBodyMingFixedShaCandidate, false);
  assert.equal(later.data.lifeBodyMingFixedPairVerified, false);
  assert.equal(passageResult(later.run, 22).status, 'not_matched');
  const actual = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config }).horoscope('1995-06-01', 6);
  const verifiedLimits = quanshuLimitBranches(n, { lunarYear: 1995, yearIndex: actual.yearly.index,
    decadalIndex: actual.decadal.index, minorIndex: actual.age.index });
  assert.equal(verifiedLimits.sourceDecadal.verified, true);
  const unchecked = quanshuXingJiTiger(n, actual.yearly.index, { ...verifiedLimits, sourceDecadal: { ...verifiedLimits.sourceDecadal, verified: false } });
  assert.equal(unchecked.lifeBodyMingFixedShaCandidate, true);
  assert.equal(unchecked.lifeBodyMingFixedPairVerified, undefined);
  assert.equal(passageResult({ ...run, facts: [{ ...fact, normalizedPayload: unchecked }] }, 22).status, 'partial');
  const wrongMinorIndex = n.palaces.find(row => row.earthlyBranch === data.bodyBranch).index;
  const wrongFrame = { lunarYear: 1995, yearIndex: actual.yearly.index, decadalIndex: actual.decadal.index, minorIndex: wrongMinorIndex };
  const wrongLimits = quanshuLimitBranches(n, wrongFrame);
  assert.equal(wrongLimits.sourceMinor.verified, false);
  const wrongBody = quanshuXingJiTiger(n, wrongFrame.yearIndex, wrongLimits);
  assert.equal(wrongBody.minorBranch, data.bodyBranch);
  assert.equal(wrongBody.bodyContact.minor, undefined);
  assert.equal(wrongBody.lifeBodyMingFixedShaCandidate, undefined);
  assert.equal(wrongBody.lifeBodyMingFixedPairVerified, undefined);
  assert.equal(passageResult({ ...run, facts: [{ ...fact, normalizedPayload: wrongBody }] }, 22).status, 'unknown');
});

test('Lian Zhen requires verified Xing and a paired Ji and Yang contact in a single source layer', () => {
  for (const [name, area, star, birth] of [['lianBirthLayer', '午', '武曲', true], ['lianYearLayer', '辰', '武曲', false]]) {
    const { run, data } = sameYear(name);
    assert.equal(data.lianzhen.branch, area);
    assert.equal(data.lianzhen.minor, '守');
    assert.equal(data.lianzhenNatalXingJiBladeCandidate, birth);
    assert.equal(data.lianzhenYearXingJiBladeCandidate, !birth);
    assert.equal(data.layers.find(row => row.lianzhenXingJiBladeCandidate).tabooStar, star);
    assert.equal(passageResult(run, 29).status, 'partial');
  }
  const mixed = sameYear('lianMixed');
  assert.equal(mixed.data.lianzhen.decadal, '守');
  assert.equal(mixed.data.tianxingAtLianzhen, '守');
  assert.deepEqual(mixed.data.layers.map(row => [row.lianBlade, row.lianTaboo]), [['其他', '三合'], ['三合', '其他']]);
  assert.equal(passageResult(mixed.run, 29).status, 'not_matched');
});

test('the Qisha body and life alternatives require actual annual Ji and named Xing geometry and preserve support positions', () => {
  const body = sameYear('qishaBodyXing');
  assert.equal(body.data.qishaAtBody, true);
  assert.equal(body.data.qishaAtLife, false);
  assert.equal(body.data.qishaTianxingJiCandidate, true);
  assert.equal(body.data.qishaAnnualBladeJiCandidate, false);
  assert.equal(body.data.tianxingAtQisha, '三合');
  assert.equal(body.data.support.find(row => row.star === '紫微').qishaRelation, '守');
  assert.equal(body.data.support.find(row => row.star === '天相').minor, '守');
  assert.equal(body.data.support.find(row => row.star === '天相').qishaRelation, '其他');
  assert.equal(body.data.qishaXingJiEvidence, 'seen');
  assert.equal(passageResult(body.run, 47).status, 'partial');
  const { input } = buildFortuneModelContext(body.run, interpretFortune(body.run, requestForFortuneRun(body.run), 'qisha-support'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /同一刑忌片段的具名会照为紫微在亥宫，与七杀宫为守，/u);
  assert.doesNotMatch(prompt, /qishaXingJiEvidence/u);

  const life = sameYear('qishaLifeBlade');
  assert.equal(life.data.qishaAtLife, true);
  assert.equal(life.data.qishaTianxingJiCandidate, false);
  assert.equal(life.data.qishaAnnualBladeJiCandidate, true);
  assert.equal(life.data.layers.find(row => row.layer === 'yearly').qishaTaboo, '冲');
  assert.equal(life.data.qishaSamePalaceAnnualJiBladeCandidate, false);
  assert.equal(life.data.qishaXingJiEvidence, 'seen');
  assert.equal(life.data.support.find(row => row.star === '本命禄存').qishaRelation, '三合');
  assert.equal(passageResult(life.run, 47).status, 'partial');

  const single = sameYear('qishaLifeAlone');
  assert.equal(single.data.qishaAtLife, true);
  assert.equal(single.data.support.find(row => row.star === '本命禄存').qishaRelation, '三合');
  assert.equal(single.data.qishaXingJiEvidence, 'no-trigger');
  assert.equal(passageResult(single.run, 47).status, 'not_matched');
});

test('p047 also finds an actual same-year blade and taboo palace opposing natal Qisha without a nearby Tai Sui seat', () => {
  const { run, fact, data } = sameYear('qishaAnnualJiBladeTogether');
  assert.equal(data.qishaAtLife, true);
  assert.equal(data.qisha.branch, '午');
  assert.equal(data.annualBranch, '辰');
  assert.equal(data.qisha.annual, '其他');
  assert.equal(data.qishaTianxingJiCandidate, false);
  assert.equal(data.qishaAnnualBladeJiCandidate, false);
  const annual = data.layers.find(row => row.layer === 'yearly');
  assert.deepEqual([annual.stem, annual.tabooStar, annual.tabooBranch, annual.bladeBranch, annual.qishaTaboo],
    ['壬', '武曲', '子', '子', '冲']);
  assert.equal(data.qishaSamePalaceAnnualJiBladeCandidate, true);
  assert.equal(data.qishaXingJiEvidence, 'outside');
  const result = passageResult(run, 47);
  assert.equal(result.status, 'partial');
  assert.ok(result.sourceFactIds.includes(fact.factId));

  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'annual-xing-ji-test'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /流年干壬所推武曲化忌在子宫，与七杀宫为冲/u);
  assert.match(prompt, /同一流年干的擎羊与上述化忌受曜同在子宫/u);
  assert.doesNotMatch(prompt, /同一刑忌片段的具名会照/u);
  assert.doesNotMatch(prompt, /qishaSamePalaceAnnualJiBladeCandidate/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId));

  const { year, ...birth } = ref.cases.qishaAnnualJiBladeTogether;
  const archive = astro.withOptions({ ...birth, fixLeap: true, config });
  const natal = archive.toJSON(), h = archive.horoscope(year + '-06-01', 6);
  const original = natal.palaces.find(palace => palace.majorStars.some(star => star.name === '天相'));
  const tianxiang = original.majorStars.find(star => star.name === '天相');
  original.majorStars = original.majorStars.filter(star => star.name !== '天相');
  natal.palaces.find(palace => palace.earthlyBranch === '午').majorStars.push(tianxiang);
  const frame = { lunarYear: year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  const conflicting = quanshuXingJiTiger(natal, frame.yearIndex, quanshuLimitBranches(natal, frame));
  assert.equal(conflicting.qishaSamePalaceAnnualJiBladeCandidate, true);
  assert.equal(conflicting.support.find(row => row.star === '天相').branch, undefined);
  assert.equal(conflicting.qishaXingJiEvidence, 'unverified');
});

test('p047 Ming Lu Cun is the actual natal companion and stays separate from contested annual transformation tables', () => {
  const base = astro.withOptions({ dateStr: '1987-05-15', timeIndex: 1, gender: '女', fixLeap: true, config });
  const natal = base.toJSON();
  for (const year of [2002, 2003]) {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 1), archive = { snapshotId: 'ming-qisha-lucun', chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
    validateFortuneFacts(bound);
    const fact = combinedRows(bound).find(row => row.normalizedPayload.lunarYear === year);
    const data = fact.normalizedPayload, active = year === 2002;
    assert.equal(data.mingQishaLucunPolicy, 'quanshu-nanyangtang-qisha-natal-lucun-v1');
    assert.deepEqual(data.support.map(row => [row.star, row.qishaRelation]),
      [['紫微', '其他'], ['天相', '其他'], ['本命禄存', '守']]);
    assert.deepEqual([data.mingQishaNatalLucunSameSeatCandidate, data.qishaXingJiEvidence], active ? [true, 'seen'] : [false, 'no-trigger']);
    assert.deepEqual(data.mingQishaNatalLucunWitness, active ? {
      branch: '午', birthStem: '丁', annualStem: '壬', tabooStar: '武曲', tabooBranch: '子', bladeBranch: '子',
    } : undefined);
    const pojun = bound.facts.find(row => row.factType === 'quanshu_annual_sha' && row.normalizedPayload.lunarYear === year);
    assert.equal(pojun.normalizedPayload.pojunCase.candidate, active);
    assert.equal(pojun.normalizedPayload.pojunCase.namedReliefInArea, true);
    assert.deepEqual(pojun.normalizedPayload.pojunCase.relief.filter(row => row.layer === 'natal'), [
      { star: '天梁', layer: 'natal', branch: '巳', relation: '其他' },
      { star: '禄存', layer: 'natal', branch: '午', relation: '三合' },
    ]);
    assert.equal(passageResult({ ...bound, facts: [pojun] }, 23).status, active ? 'partial' : 'not_matched');
    const run = { ...bound, facts: [fact] }, result = passageResult(run, 47);
    assert.equal(result.status, active ? 'matched' : 'not_matched');
    assert.deepEqual(result.sourceFactIds, active ? [fact.factId] : []);
    if (active) {
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
      assert.equal(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId).originalText, '七杀临身命流年刑忌');
      assert.match(formatFortuneFactAudit(input), /本命禄存实守/u);
      const prompt = formatFortunePrompt(input);
      assert.match(prompt, /擎羊和化忌受曜同在对宫，本命禄存实守七杀宫/u);
      assert.doesNotMatch(prompt, /武曲化忌|灾伤|mingQishaNatalLucun/u);
      assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      const h = base.horoscope(year + '-06-01', 6);
      const frame = { lunarYear: year, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
      const displaced = (star, layer) => {
        const wrong = structuredClone(natal), seat = wrong.palaces.find(row => row[layer].some(item => item.name === star));
        seat.adjectiveStars.push(...seat[layer].splice(seat[layer].findIndex(item => item.name === star), 1));
        return quanshuXingJiTiger(wrong, frame.yearIndex, quanshuLimitBranches(wrong, frame));
      };
      const wrongLu = displaced('禄存', 'minorStars');
      assert.equal(wrongLu.qishaXingJiEvidence, 'unverified');
      assert.equal(wrongLu.mingQishaNatalLucunSameSeatCandidate, undefined);
      assert.equal(wrongLu.mingQishaNatalLucunWitness, undefined);
      assert.equal(passageResult({ ...run, facts: [{ ...fact, normalizedPayload: wrongLu }] }, 47).status, 'partial');
      const wrongWu = displaced('武曲', 'majorStars');
      assert.equal(wrongWu.mingQishaNatalLucunSameSeatCandidate, undefined);
      assert.equal(wrongWu.mingQishaNatalLucunWitness, undefined);
      assert.notEqual(passageResult({ ...run, facts: [{ ...fact, normalizedPayload: wrongWu }] }, 47).status, 'matched');
    }
  }
  const lunarYear = 2020, h = base.horoscope(lunarYear + '-06-01', 6);
  const frame = { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
  const geng = quanshuXingJiTiger(natal, frame.yearIndex, quanshuLimitBranches(natal, frame));
  assert.equal(geng.layers.find(row => row.layer === 'yearly').stem, '庚');
  assert.equal(geng.layers.find(row => row.layer === 'yearly').tabooStar, '天同');
  assert.notEqual(geng.mingQishaNatalLucunSameSeatCandidate, true);
  assert.equal(geng.mingQishaNatalLucunWitness, undefined);
});

test('p047 confirms same-year opposite Xing Ji with natal Lu Cun even when Tai Sui is in another palace', () => {
  const engine = astro.withOptions({ dateStr: '1987-05-15', timeIndex: 1, gender: '女', fixLeap: true, config });
  const natal = engine.toJSON(), knowledgeId = passageRule(47).knowledgeId;
  const archive = { snapshotId: 'ming-qisha-lucun-off-tai-sui', chart: chart(natal) };
  const field = 'mingQishaNatalLucunOffTaiSuiCandidate';
  const witness = 'mingQishaNatalLucunOffTaiSuiWitness';
  for (const [year, annualBranch, annualRelation] of [[2012, '辰', '其他'], [2022, '寅', '三合']]) {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 1);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
    validateFortuneFacts(bound);
    const fact = combinedRows(bound).find(row => row.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    const data = fact.normalizedPayload;
    assert.deepEqual([data.qishaAtLife, data.qishaAtBody], [false, true]);
    assert.equal(data.mingQishaNatalLucunSameSeatCandidate, false);
    assert.equal(data[field], true);
    assert.deepEqual(data[witness], { branch: '午', birthStem: '丁', annualStem: '壬', tabooStar: '武曲',
      tabooBranch: '子', bladeBranch: '子', annualBranch, annualRelation });

    const isolate = normalizedPayload => ({ ...bound, facts: [{ ...fact, normalizedPayload }] });
    const run = isolate(data), hit = passageResult(run, 47);
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, '七杀临身命流年刑忌');
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
    assert.ok(input.sections.some(section => section.findings.some(row => row.knowledgeId === knowledgeId)));
    assert.match(formatFortuneFactAudit(input), /明刊七杀临身命的逢禄存一段，本命七杀与本命禄存同守/u);
    assert.doesNotMatch(formatFortunePrompt(input), /午宫|子宫|流年干壬|mingQishaNatalLucunOffTaiSui/u);

    const calculate = (chart, lunarYear) => {
      const h = engine.horoscope(`${lunarYear}-06-01`, 6);
      const frame = { lunarYear, yearIndex: h.yearly.index, decadalIndex: h.decadal.index, minorIndex: h.age.index };
      return quanshuXingJiTiger(chart, frame.yearIndex, quanshuLimitBranches(chart, frame));
    };
    const following = calculate(natal, year + 1);
    assert.equal(following[field], false);
    assert.equal(passageResult(isolate(following), 47).status, 'not_matched');
    const wrong = structuredClone(natal), luSeat = wrong.palaces.find(row => row.earthlyBranch === '午');
    luSeat.adjectiveStars.push(...luSeat.minorStars.splice(luSeat.minorStars.findIndex(row => row.name === '禄存'), 1));
    const unknown = calculate(wrong, year);
    assert.equal(unknown[field], undefined);
    assert.equal(unknown[witness], undefined);
    assert.equal(passageResult(isolate(unknown), 47).status, 'partial');
    if (year === 2012) {
      const wrongBody = calculate({ ...natal, earthlyBranchOfBodyPalace: '未' }, year);
      assert.equal(wrongBody[field], undefined);
      assert.notEqual(passageResult(isolate(wrongBody), 47).status, 'matched');
    }
  }
});

test('missing or repeated optional stars and malformed parent or product layers stay unknown without overwriting the annual source',()=>{
 for(const star of ['太阴','廉贞','七杀','铃星']){
  for(const duplicate of [false,true]){const n=native(),palace=n.palaces.find(p=>all(p).some(s=>s.name===star));
   const field=['majorStars','minorStars','adjectiveStars'].find(k=>palace[k].some(s=>s.name===star));
   if(duplicate)palace[field].push({...palace[field].find(s=>s.name===star)});else palace[field]=palace[field].filter(s=>s.name!==star);
   const p=condition(n);assert.equal(p.ready,true);
   if(star==='铃星')assert.equal(p.bellProductVerified,false);else assert.equal(p.mainStars.find(s=>s.star===star).known,false);
   if(star==='太阴')assert.equal(p.parentMoonFallen,undefined);if(star==='廉贞')assert.equal(p.annualMinorAtLianzhen,undefined);
   if(star==='七杀')assert.equal(p.sevenKillKnown,undefined);
  }
 }
 const n=native(),before=condition(n);n.palaces.find(p=>p.suiqian12==='白虎').suiqian12='unverified';
 const after=condition(n);assert.equal(after.natalTigerProductVerified,false);assert.deepEqual(after.fourFlying,before.fourFlying);
 const p=n.palaces.find(p=>p.name==='父母');p.name='福德';assert.equal(condition(n).parentMoonFallen,undefined);
});

test('wrong year, mismatched annual or limit index and absent requested partners cannot produce ready cross-layer geometry',()=>{
 const n=native(),index=n.palaces.find(p=>p.earthlyBranch==='辰').index;
 assert.equal(quanshuTigerCondition(n,index,index,2025,'yearly').ready,false);
 assert.equal(quanshuTigerCondition(n,(index+1)%12,index,2024,'yearly').ready,false);
 assert.equal(quanshuTigerCondition(n,index,index,2024,'minor').ready,false);
 assert.equal(quanshuTigerCondition(n,index,index,2024,'yearly',99).ready,false);
 const copy=structuredClone(n);copy.rawDates.chineseDate.yearly[1]='子';assert.equal(condition(copy).ready,false);
 const ancient=structuredClone(n);ancient.rawDates.lunarDate.lunarYear=-26;assert.equal(condition(ancient).ready,false);
});

test('real writer keeps year and both limits atomically sourced and every new SQLite source hash unchanged',()=>{
 for(const name of ['moon','lian','seven']){const run=real(name);validateFortuneFacts(run);assert.notEqual(run.methods.ziwei.status,'failed');
  for(const row of rows(run)){const p=row.normalizedPayload,source=run.rawFacts.find(raw=>row.sourceFactIds.includes(raw.rawFactId)&&raw.payload.policy?.profile===quanshuTigerPolicy.profile);
   assert.ok(source);assert.equal(source.payload.interval.year.lunarYear,p.lunarYear);assert.equal(p.scope,row.scope);
   assert.ok(row.sourceFactIds.length>=2&&row.sourceFactIds.every(id=>run.rawFacts.some(raw=>raw.rawFactId===id)));
   assert.ok(p.scopeRelations.some(r=>r.scope===row.scope&&r.branch===p.branch));
  }
 }
 for(const [passage, outstanding] of [[5,0],[46,1],[48,0]]){const r=passageRule(passage),e=fortuneKnowledge.ziwei.entries.find(e=>e.id===r.knowledgeId);
  assert.equal(r.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:e.evidence,conditions:e.conditions})).digest('hex'));
  assert.equal(r.unresolved.length,outstanding);
 }
});

test('SQLite rows reject generic and wrong-profile facts and do not claim completed encounters from the new source positions',()=>{
 const { run, fact } = sameYear('qishaYearBladeTiger');
 assert.ok(fact.sourceFactIds.every(id=>run.rawFacts.some(raw=>raw.rawFactId===id)));
 const removed=structuredClone(run);removed.facts=removed.facts.filter(f=>f.factType!==combinedType);assert.equal(passageResult(removed,48).status,'unknown');
 const wrong=structuredClone(run);combinedRows(wrong).forEach(f=>f.normalizedPayload.profile='other');assert.equal(passageResult(wrong,48).status,'not_matched');
 const missing=structuredClone(run);combinedRows(missing).forEach(f=>{
   delete f.normalizedPayload.qishaQuanshuFixedNatalBladeTigerCandidate;
 });assert.equal(passageResult(missing,48).status,'unknown');
 for(const n of [5,22,47,48])assert.equal(passageRule(n).queries[0].factType,combinedType);
 const lianzhen = passageRule(29).queries[0];
 assert.equal(lianzhen.factType, 'quanshu_timed_limit_condition');
 assert.equal(lianzhen.where.sourceFactType, combinedType);
 assert.equal(passageRule(46).queries[0].factType,'quanshu_tiger_layer_context');
});

test('actual provider receives only natural Chinese geometry and explicit unknowns, without raw machine payload or partial source findings',async()=>{
 const run=real('moon'),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'tiger-private-report'));
 assert.ok(input.facts.some(f=>f.type==='quanshu_tiger_layer_context'));const prompt=formatFortuneFactAudit(input);
 for(const t of ['白虎在太岁前八宫','本命父母宫在未','卷一太阴问答在未明确等级为陷地','卷三另表等级为未列','这是生年产品层','生年干依卷二独立安擎羊','流年干依卷二独立安擎羊'])assert.ok(prompt.includes(t),t);
 for(const secret of ['quanshu-tiger-annual','annualMinorAtLianzhen','parentMoonFallen','sevenKillKnown','tiger-private','bellProductVerified'])assert.ok(!prompt.includes(secret),secret);
 assert.ok(!input.sections.flatMap(s=>s.findings).some(f=>[54,95,97].some(i=>f.knowledgeId===fortuneKnowledge.ziwei.rules[i].knowledgeId)));
 const p=rows(run).find(f=>f.scope==='yearly'&&f.normalizedPayload.lunarYear===2026).normalizedPayload;
 const d=describeFortuneFact({method:'ziwei',type:'quanshu_tiger_layer_context',data:p},String);assert.ok(!/[{}\[\]]/u.test(d));
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await provider.interpret(input);
});

test('the model sees the Chinese annual Xing Ji contacts while partial source passages stay outside findings', () => {
  const { run } = sameYear('qishaBodyXing');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'xing-ji-tiger-prompt'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /本命身宫的七杀在亥宫/u);
  assert.match(prompt, /流年干癸所推贪狼化忌在未宫，与七杀宫为三合/u);
  assert.match(prompt, /本命天刑在卯宫，与七杀宫为三合/u);
  assert.doesNotMatch(prompt, /quanshu-xing-ji-tiger|qishaTianxingJiCandidate|xing-ji-tiger-prompt/u);
  for (const n of [5, 22, 29, 47, 48]) assert.ok(!input.sections.flatMap(s => s.findings).some(f => f.knowledgeId === passageRule(n).knowledgeId));
});
