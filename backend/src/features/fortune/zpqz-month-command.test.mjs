import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Solar} from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import {describeFortuneFact,formatFortuneFactAudit, formatFortunePrompt} from './control/fortune-prompt.mjs';
import {createFortuneDeepSeek} from './server/deepseek-expression.mjs';
const {zpqzMonthPositions,baziZpqzMonthCommand,zpqzGaoColumns,zpqzMonthPolicy}=await import('./control/bazi-zpqz-month.ts');
const {calculateFortuneFacts,validateFortuneFacts}=await import('./control/fortune-facts.ts');
const {buildFactTimeContext}=await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const {matchFortuneKnowledge}=await import('./control/knowledge/match.ts');
const {evaluateFortuneRules,fortuneKnowledge}=await import('./control/knowledge/catalog.ts');
const {buildFortuneModelContext}=await import('./control/fortune-model-context.ts');
const {interpretFortune,requestForFortuneRun}=await import('./control/fortune-interpretation.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/zpqz-month-command-reference.json',import.meta.url)));
const layers=['year','month','day','hour'],native=values=>Object.fromEntries(layers.map((k,i)=>[k,values[i]]));
const ctx=(n=native(ref.gaoPrinted),luck='丙子',known=true)=>baziZpqzMonthCommand(n,known,luck);
const luJieWealthIndex = 53;
const gaoSourceIndex = 59;
const luJieAuthorityIndex = 146;
const namedLuOfficerRiskIndex = 62;
const namedOutputSealIndex = 148;
const completeSourceIndices = new Set([luJieWealthIndex, gaoSourceIndex, luJieAuthorityIndex, namedLuOfficerRiskIndex, namedOutputSealIndex]);
const indices=[51,52,luJieWealthIndex,59,61,62,67,68,69,70,145,146,148];
function archive(e){const [y,m,d]=e.date,l=Solar.fromYmdHms(y,m,d,e.hour,0,0).getLunar();
 const luckPeriods=l.getEightChar().getYun(e.gender,2).getDaYun(11).slice(1).map(s=>({ganZhi:s.getGanZhi(),startAge:s.getStartAge(),endAge:s.getEndAge()}));
 return {timeKnown:true,bazi:{engineName:'lunar-javascript',engineVersion:'1.7.8',rulesetVersion:'utc8-jie-local-civil-late-zi-next-v1',rawResult:[{
  utc:new Date(Date.UTC(y,m-1,d,e.hour-8)).toISOString(),year:l.getYearInGanZhiExact(),month:l.getMonthInGanZhiExact(),day:l.getDayInGanZhiExact(),hour:l.getTimeInGanZhi(),luckPeriods,tenGods:{},shenSha:{},
 }]},ziwei:{rawResult:[]},western:{rawResult:[]}};
}
function calculate(e,chart=archive(e)){const input={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year:e.year}};return calculateFortuneFacts(input,buildFactTimeContext(input,Date.parse(e.year+'-11-19T02:00:00Z'),'server'),'month-private-run',{snapshotId:'month-private-snapshot',chart});}
const cache=new Map(),real=i=>{if(!cache.has(i))cache.set(i,calculate(ref.calendarExamples[i]));return cache.get(i);};
const rows=run=>run.facts.filter(f=>f.factType==='zpqz_month_command'),match=(run,i)=>matchFortuneKnowledge(run).byMethod.bazi[i];

function submitted(date, hour, year, gender = 1) {
 const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
 const now = Date.UTC(year, 5, 1);
 const reference = { snapshotId: 'month-printed-' + date.join('-') + '-' + hour };
 const chart = archive({ date, hour, gender });
 const birthInstant = chart.bazi.rawResult[0].utc;
 chart.birthContext = { birthInstant, precision: 'minute', latitude: 39.9042, longitude: 116.4074,
  timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
 const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...reference, chart })));
 assert.ok(rows(batch).every(fact => !('printedLuck' in fact.normalizedPayload)));
 const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
 validateFortuneFacts(run);
 return run;
}
const modelContext = run => buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'month-printed-report'));
const candidate = (chart, luck, timeKnown = true, confirmed = true) => ({
 factType: 'zpqz_month_command', scope: 'decadal', completeness: 'complete',
 normalizedPayload: { ...ctx(chart, luck, timeKnown), confirmed },
});

test('the printed Yue strong-blade reading excludes weak-blade advice at the real Ren-Zi to Xin-Hai handoff', () => {
 const date = [1883, 3, 21], cut = '1918-04-12T02:00:00.000Z';
 const run = submitted(date, 10, 1918);
 const prior = rows(run).find(row => row.activeTo === cut && row.normalizedPayload.luckPillar === '壬子');
 const actual = rows(run).find(row => row.activeFrom === cut && row.normalizedPayload.luckPillar === '辛亥');
 assert.ok(prior && actual);
 assert.ok([prior, actual].every(row => row.normalizedPayload.bladeSupportDifferentRationale
  && row.normalizedPayload.hasBladeAuthoritySupport));
 const proof = actual.normalizedPayload.bladeYueSourceComparison;
 assert.deepEqual([proof.blade.stem, proof.authority.position, proof.authority.stem, proof.authority.kind], ['乙', 'hour', '庚', '支藏']);
 assert.deepEqual(proof.movingSeal.map(row => [row.kind, row.stem]), [['运支首藏', '壬']]);
 assert.deepEqual(proof.movingWoodTrine.byBranch, [['decadal'], ['month'], ['year']]);
 assert.deepEqual(proof.movingClashAtKiller, {kind: '六冲', members: ['hour', 'decadal'], values: '巳亥'});
 assert.equal(prior.normalizedPayload.bladeYueSourceComparison.movingWoodTrine, undefined);
 assert.equal(match(run, 52).status, 'not_matched');
 const oldFacts = rows(run).map(row => ({
  ...row, normalizedPayload: { ...row.normalizedPayload, bladeSupportDifferentRationale: false },
 }));
 assert.equal(match({ ...run, facts: oldFacts }, 52).status, 'partial');

 const near = submitted(date, 16, 1918);
 const nearStage = rows(near).find(row => row.normalizedPayload.luckPillar === '辛亥');
 assert.ok(nearStage);
 assert.equal(nearStage.normalizedPayload.natalPillarSequence, '癸未乙卯甲子壬申');
 assert.equal(nearStage.normalizedPayload.bladeYueSourceComparison, undefined);
 assert.equal(nearStage.normalizedPayload.bladeSupportDifferentRationale, false);
 assert.equal(match(near, 52).status, 'partial');

 const opposed = submitted(date, 10, 1958);
 const stage = rows(opposed).find(row => row.activeFrom === '1958-04-12T02:00:00.000Z'
  && row.normalizedPayload.luckPillar === '丁未');
 assert.ok(stage);
 const { wealthControlsSeals, outputWithOriginalSeal } = stage.normalizedPayload.bladeYueSourceComparison;
 assert.deepEqual(wealthControlsSeals.map(row => [row.wealth.stem, row.seal.position, row.seal.stem]),
  [['己', 'year', '癸'], ['己', 'day', '癸']]);
 assert.deepEqual(outputWithOriginalSeal.map(path => [path.output.stem, path.originalSealsCheckingOutput.map(row => row.position)]),
  [['丁', ['year', 'day']]]);
 const opposedRules = matchFortuneKnowledge(opposed).byMethod.bazi;
 assert.equal(opposedRules[51].status, 'partial');
 assert.equal(opposedRules[61].status, 'partial');
 assert.equal(ctx(native(['癸未', '乙卯', '甲子', '己巳']), '辛亥', false).bladeYueSourceComparison, undefined);
});

test('the Qianlong reading separates the incoming seal from wealth in the actual Yi-Wei to Jia-Wu handoff', () => {
 const date = [1951, 9, 27], year = 1977, cut = '1977-10-20T04:00:00.000Z';
 const run = submitted(date, 0, year);
 const before = rows(run).find(row => row.activeTo === cut && row.normalizedPayload.luckPillar === '乙未');
 const after = rows(run).find(row => row.activeFrom === cut && row.normalizedPayload.luckPillar === '甲午');
 assert.ok(before && after);
 for (const [fact, wealthStem, support] of [[before, '乙', true], [after, '甲', false]]) {
  const p = fact.normalizedPayload;
  assert.equal(p.natalPillarSequence, '辛卯丁酉庚午丙子');
  assert.equal(p.qianlongSourceBladeWealthNotSuitable, true);
  assert.equal(p.hasQianlongSourceBladeSupport, support);
  const proof = p.bladeQianlongSourceComparison;
  assert.deepEqual([proof.blade.position, proof.blade.stem, proof.exposedRobbery.position, proof.exposedRobbery.stem,
   proof.officer.position, proof.officer.stem, proof.killer.position, proof.killer.stem],
  ['month', '辛', 'year', '辛', 'month', '丁', 'hour', '丙']);
  assert.deepEqual([proof.woodClash.members, proof.fireClash.members], [['year', 'month'], ['day', 'hour']]);
  assert.deepEqual(proof.movingWealth.map(row => row.stem), [wealthStem]);
  assert.deepEqual(proof.movingSeal.map(row => [row.kind, row.stem]), support ? [['运支首藏', '己']] : []);
  const scoped = { ...run, facts: [fact] };
  const checked = matchFortuneKnowledge(scoped).byMethod.bazi;
  const old = matchFortuneKnowledge({ ...scoped, facts: [{ ...fact, normalizedPayload: { ...p,
   qianlongSourceBladeWealthNotSuitable: false, hasQianlongSourceBladeSupport: false } }] }).byMethod.bazi;
  assert.equal(old[51].status, 'partial');
  assert.equal(checked[51].status, 'excluded');
  assert.equal(old[52].status, support ? 'partial' : 'unknown');
  assert.equal(checked[52].status, support ? 'matched' : 'unknown');
  assert.equal(checked[61].status, old[61].status);
 }
 const support = match(run, 52);
 assert.equal(support.matchedSourceExcerpt, '若刃輕而官煞重');
 assert.deepEqual(support.windows, [{ start: run.time.displayWindow.instantRange.startInstant, endExclusive: cut }]);
 const { input } = modelContext(run);
 const findings = input.sections.flatMap(section => section.findings);
 assert.deepEqual(findings.find(row => row.knowledgeId === support.knowledgeId)?.windows, support.windows);
 assert.ok(!findings.some(row => row.knowledgeId === match(run, 51).knowledgeId));
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /原文：若刃輕而官煞重/u);
 assert.doesNotMatch(prompt, /bladeQianlongSourceComparison|hasQianlongSourceBladeSupport/u);
 const audit = formatFortuneFactAudit(input);
 assert.match(audit, /乾隆原评判煞旺劫轻/u);
 assert.match(audit, /己.*承原局官杀而生同一月刃/u);
 assert.doesNotMatch(prompt, /乾隆原评判煞旺劫轻|承原局官杀而生同一月刃/u);
 const near = submitted(date, 2, year);
 const nearStage = rows(near).find(row => row.normalizedPayload.luckPillar === '乙未');
 assert.ok(nearStage);
 assert.equal(nearStage.normalizedPayload.natalPillarSequence, '辛卯丁酉庚午丁丑');
 assert.equal(nearStage.normalizedPayload.bladeQianlongSourceComparison, undefined);
 assert.equal(nearStage.normalizedPayload.qianlongSourceBladeWealthNotSuitable, false);
 assert.equal(nearStage.normalizedPayload.hasQianlongSourceBladeSupport, false);
 assert.equal(match({ ...near, facts: [nearStage] }, 51).status, 'partial');
 assert.equal(match({ ...near, facts: [nearStage] }, 52).status, 'partial');
 const incomplete = ctx(native(['辛卯', '丁酉', '庚午', '丙子']), '乙未', false);
 assert.equal(incomplete.qianlongSourceBladeWealthNotSuitable, undefined);
 assert.equal(incomplete.hasQianlongSourceBladeSupport, undefined);
});

test('when the exposed month blade joins the only exposed killer, the real luck cannot supply a separate blade-control path', () => {
 for (const {day, hour, hasJoin, wealthExcluded, outputExcluded} of [
  {day: 12, hour: 18, hasJoin: true, wealthExcluded: true, outputExcluded: true},
  {day: 12, hour: 16, hasJoin: false, wealthExcluded: false, outputExcluded: false},
  {day: 22, hour: 18, hasJoin: true, wealthExcluded: false, outputExcluded: true},
 ]) {
  const run = submitted([1982, 6, day], hour, 2029, 0);
  const active = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '辛丑');
  assert.ok(active, `1982-06-${day} ${hour}:00 must have Xin-Chou luck`);
  const p = active.normalizedPayload;
  assert.equal(p.hasBladeAuthorityWealth, true);
  assert.equal(p.hasBladeKillerOutput, true);
  assert.equal(p.bladeAuthorityWealthOnlyJoinedKiller, wealthExcluded);
  assert.equal(p.bladeOutputOnlyJoinedKiller, outputExcluded);
  assert.equal(Boolean(p.bladeKillerJoin), hasJoin);
  if (p.bladeKillerJoin) {
   const {blade, exposedBlade, killer} = p.bladeKillerJoin;
   assert.deepEqual([blade.position, blade.stem, exposedBlade.position, exposedBlade.stem, killer.position, killer.stem],
    ['month', '丁', 'hour', '丁', 'year', '壬']);
   assert.ok(p.bladeAuthorityPaths.some(path => path.authority.stem === '壬' && path.movingWealth.some(row => row.stem === '辛')));
   assert.ok(p.authorityOutputPaths.some(path => path.authority.stem === '壬' && path.output.stem === '己'));
  }
  if (day === 22) assert.ok(p.bladeAuthorityPaths.some(path => path.authority.position === 'day'
   && path.authority.stem === '癸' && path.authority.god === '正官' && path.movingWealth.some(row => row.stem === '辛')));
  const matches = matchFortuneKnowledge(run).byMethod.bazi;
  assert.equal(matches[51].status, wealthExcluded ? 'not_matched' : 'partial');
  assert.equal(matches[61].status, outputExcluded ? 'not_matched' : 'partial');
  if (wealthExcluded) {
   const { input } = modelContext(run);
   const evidence = /只依靠同一被月刃所合七杀的运段路径排除/u;
   assert.match(formatFortuneFactAudit(input), evidence);
   assert.doesNotMatch(formatFortunePrompt(input), evidence);
  }
 }
 const timeUnknown = ctx(native(['壬戌', '丙午', '丙寅', '丁酉']), '辛丑', false);
 assert.equal(timeUnknown.bladeKillerJoin, undefined);
 assert.equal(timeUnknown.bladeOutputOnlyJoinedKiller, undefined);
});

test('the named wealth and output counterexamples preserve exact contacts across their actual blade-luck boundaries', () => {
 const checks = [
  {
   date: [1930, 9, 17], hour: 12, year: 1977, from: '己丑', to: '庚寅', index: 51,
   boundary: '1977-12-30T06:00:00.000Z', beforeMatches: false, afterMatches: false,
   evidence(before, after) {
    assert.equal(before.bladeWealthSourceExcludesBenefit, false);
    assert.equal(after.bladeWealthSourceExcludesBenefit, true);
    assert.equal(after.hasBladeAuthorityWealth, true);
    assert.deepEqual(after.natalPillars.map(row => row.pillar), ['庚午', '乙酉', '庚午', '壬午']);
    const source = after.bladeWealthSourceComparison;
    assert.equal(source.movingYin.pillar, '庚寅');
    assert.deepEqual(source.natalWu.map(row => row.position), ['year', 'day', 'hour']);
    assert.deepEqual(source.paths.map(row => row.authority.position), ['year', 'day', 'hour']);
    assert.ok(source.paths.every(path => path.blade.stem === '辛' && path.authority.stem === '丁'
     && path.movingWealth.some(row => row.stem === '甲' && row.kind === '运支首藏')));
   },
  },
  {
   date: [1930, 9, 17], hour: 12, year: 1987, from: '庚寅', to: '辛卯', index: 51,
   boundary: '1987-12-30T06:00:00.000Z', beforeMatches: false, afterMatches: true,
   evidence(before, after) {
    assert.ok(before.bladeWealthSourceExcludesBenefit);
    assert.ok(after.hasBladeAuthorityWealth);
    assert.equal(after.bladeWealthSourceExcludesBenefit, false);
   },
  },
  {
   date: [1974, 7, 6], hour: 4, year: 1985, from: '辛未', to: '壬申', index: 61,
   boundary: '1985-01-26T18:00:00.000Z', beforeMatches: true, afterMatches: false,
   evidence(before, after) {
    assert.equal(before.bladeKillerNamedNotStrong, false);
    assert.equal(after.bladeKillerNamedNotStrong, true);
    assert.equal(after.hasBladeKillerOutput, true);
    assert.deepEqual(after.natalPillars.map(row => row.pillar), ['甲寅', '庚午', '戊申', '甲寅']);
    const source = after.bladeKillerJiaComparison;
    assert.equal(source.originalMetal.stem, '庚');
    assert.equal(source.movingWater.stem, '壬');
    assert.deepEqual(source.paths.map(path => [path.authority.position, path.authority.stem, path.output.stem]),
     [['year', '甲', '庚'], ['hour', '甲', '庚']]);
    assert.deepEqual(source.shenClashes.map(pair => pair.members),
     [['year', 'day'], ['year', 'decadal'], ['day', 'hour'], ['hour', 'decadal']]);
   },
  },
  {
   date: [1974, 7, 6], hour: 4, year: 1995, from: '壬申', to: '癸酉', index: 61,
   boundary: '1995-01-26T18:00:00.000Z', beforeMatches: false, afterMatches: false,
   evidence(before, after) {
    assert.ok(before.bladeKillerJiaComparison);
    assert.ok(after.bladeKillerNamedNotStrong && after.hasBladeKillerOutput);
    const source = after.bladeKillerJiaComparison;
    assert.equal(source.movingWater.stem, '癸');
    assert.deepEqual(source.paths.map(path => path.output.stem), ['辛', '辛']);
    assert.ok(source.shenClashes.every(pair => !pair.members.includes('decadal')));
   },
  },
 ];
 for (const item of checks) {
  const run = submitted(item.date, item.hour, item.year);
  const previous = rows(run).find(row => row.activeTo === item.boundary && row.normalizedPayload.luckPillar === item.from);
  const current = rows(run).find(row => row.activeFrom === item.boundary && row.normalizedPayload.luckPillar === item.to);
  assert.ok(previous && current, item.to);
  assert.ok(previous.normalizedPayload.confirmed && current.normalizedPayload.confirmed);
  item.evidence(previous.normalizedPayload, current.normalizedPayload);
  const result = match(run, item.index);
  assert.equal(result.sourceFactIds.includes(previous.factId), item.beforeMatches, item.from);
  assert.equal(result.sourceFactIds.includes(current.factId), item.afterMatches, item.to);
  assert.equal(result.status, item.beforeMatches || item.afterMatches ? 'partial' : 'not_matched', item.to);
  const phrase = { 庚寅: '和珅原图的庚寅运实见寅午方向', 壬申: '贾平章原图按徐注以寅午会印' }[item.to];
  if (phrase) {
   const { input } = modelContext(run);
   assert.ok(formatFortuneFactAudit(input).includes(phrase), item.to);
   assert.ok(!formatFortunePrompt(input).includes(phrase), item.to);
  }
 }
 const differentHour = submitted([1930, 9, 17], 14, 1979);
 const c = rows(differentHour).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '庚寅');
 assert.ok(c && c.normalizedPayload.hasBladeAuthorityWealth);
 assert.equal(c.normalizedPayload.bladeWealthSourceExcludesBenefit, false);
 assert.ok(match(differentHour, 51).sourceFactIds.includes(c.factId));
});

test('all ten supplemental Lu coordinates and every one of 120 month positions retain only five Yang monthly blades',()=>{
 for(const stem of '甲乙丙丁戊己庚辛壬癸')for(const branch of '子丑寅卯辰巳午未申酉戌亥'){
  const p=zpqzMonthPositions(stem,branch);assert.equal(p.luBranch,ref.luByStem[stem]);assert.equal(p.atLu,branch===ref.luByStem[stem]);
  assert.equal(p.bladeBranch,ref.bladeByYangStem[stem]);assert.equal(p.atYangBlade,branch===ref.bladeByYangStem[stem]);
 }
 for(const args of [['甲乙','卯'],['甲',''],['?','子']])assert.throws(()=>zpqzMonthPositions(...args));
});

test('non-month blades and a hidden peer cannot replace natal monthly Lu or Yang blade coordinates',()=>{
 const p=ctx(native(['甲子','庚辰','乙丑','乙酉']),'丁卯');assert.equal(p.monthHidesPeer,true);assert.equal(p.atLu,false);assert.equal(p.atYangBlade,false);
 const q=ctx(native(['甲子','丙寅','甲戌','丁卯']));assert.equal(q.atLu,true);assert.equal(q.atYangBlade,false);
 const yin=ctx(native(['乙丑','己卯','乙丑','辛巳']));assert.equal(yin.atLu,true);assert.equal(yin.atYangBlade,false);assert.equal(yin.dayYang,false);
 const e=ref.negativeHiddenPeer,run=calculate(e),actual=rows(run).find(f=>f.normalizedPayload.luckPillar===e.luck).normalizedPayload;
 assert.equal(actual.monthHidesPeer,true);assert.equal(actual.atLu,false);assert.equal(actual.hasOfficer,true);assert.equal(match(run,62).status,'not_matched');
});

test('Jia-You month is mandatory and Xin exposure, hidden roots and a newly revealed luck stem are different facts',()=>{
 const n=native(['辛丑','丁酉','甲午','壬申']),p=ctx(n,'庚申');assert.equal(p.jiaYouMonth,true);assert.equal(p.xinExposed,true);assert.equal(p.xinHidden,true);assert.equal(p.xinNewlyExposedByLuck,false);
 assert.ok(p.xinRoots.some(r=>r.position==='month'&&r.exactStem));assert.ok(p.xinRoots.some(r=>r.position==='decadal'&&!r.exactStem&&r.stems.includes('庚')));
 const other=ctx({...n,month:'癸巳'},'庚申');assert.equal(other.jiaYouMonth,false);assert.equal(other.xinExposed,true);
 const hidden=ctx(native(['庚申','乙酉','甲申','壬申']),'辛巳');assert.equal(hidden.xinExposed,false);assert.equal(hidden.xinHidden,true);assert.equal(hidden.xinNewlyExposedByLuck,true);
 assert.equal(ctx(native(['庚申','乙酉','甲申','辛未']),'辛巳',false).xinNewlyExposedByLuck,undefined);
});

test('source cases and the near Gao counterexample use uniquely verified tables and actual stage bounds',()=>{
 for(const i of indices){const e=ref.calendarExamples[i],chart=archive(e),n=chart.bazi.rawResult[0];assert.deepEqual(layers.map(k=>n[k]),e.natal,String(i));
  const run=real(i);validateFortuneFacts(run);assert.notEqual(run.methods.bazi.status,'failed');
  const comparisonOnly = [gaoSourceIndex, namedLuOfficerRiskIndex, namedOutputSealIndex].includes(i);
  assert.equal(match(run,i).status,comparisonOnly?'not_matched':completeSourceIndices.has(i)||i===68?'matched':'partial',String(i));
  const selected=rows(run).filter(f=>f.normalizedPayload.confirmed&&f.normalizedPayload.luckPillar===e.luck);assert.ok(selected.length,String(i));
  for(const f of selected){assert.equal(f.scope,'decadal');assert.equal(f.normalizedPayload.profile,zpqzMonthPolicy.profile);assert.deepEqual(f.normalizedPayload.natalPillars.map(p=>p.pillar),e.natal);assert.ok(f.normalizedPayload.stageStart<=f.activeFrom&&f.activeTo<=f.normalizedPayload.stageEnd);assert.ok(f.sourceFactIds.every(id=>run.rawFacts.some(raw=>raw.rawFactId===id)));}
 }
});

test('Gao source diagram and both conflicting fire comments are retained without identifying a modern person or inventing transformation',()=>{
 assert.deepEqual(zpqzGaoColumns,ref.gaoPrinted);const p=ctx();assert.equal(p.gaoSameColumns,true);assert.equal(p.atLu,true);assert.equal(p.fireAbsent,true);assert.equal(p.hasZiShen,true);assert.equal(p.transformationVerified,false);assert.equal(p.gaoFireCommentConflict,true);
 assert.equal(ctx({...native(ref.gaoPrinted),hour:'乙酉'}).gaoSameColumns,false);assert.equal(ctx(native(ref.gaoPrinted),'丙子',false).gaoSameColumns,undefined);
 const d=describeFortuneFact({method:'bazi',type:'zpqz_month_command',data:p},String);assert.match(d,/前段说逆行水木火均美/u);assert.match(d,/取运段却说官煞火运反不相宜/u);
});

test('fire absence checks hidden stems too, unknown hour is not empty and a fire branch can be a candidate without a fire luck stem',()=>{
 assert.equal(ctx().fireAbsent,true);const hidden=ctx({...native(ref.gaoPrinted),hour:'甲戌'});assert.equal(hidden.fireAbsent,false);assert.ok(hidden.nativeFireWitnesses.some(w=>w.kind==='支藏'&&w.fireStem==='丁'));
 const unknown=ctx({...native(ref.gaoPrinted),hour:'甲戌'},'丙子',false);assert.equal(unknown.fireAbsent,undefined);
 const p=rows(real(59)).find(f=>f.normalizedPayload.luckPillar==='庚午').normalizedPayload;assert.equal(p.luckFireStem,false);assert.equal(p.luckFireBranch,true);assert.equal(p.fireMovementCandidate,true);assert.equal(p.fireAbsent,true);assert.equal(p.dayMaster,'庚');assert.equal(p.gaoSameColumns,false);
});

test('p017 stops at the Wu-Zi transition and binds both actual natal Jia positions to stage soil', () => {
 const date = [2020, 8, 25], run = submitted(date, 16, 2054);
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊子');
 assert.ok(transition);
 const boundary = transition.exactInstant;
 const before = rows(run).find(row => row.normalizedPayload.luckPillar === '丁亥' && row.activeTo === boundary);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '戊子' && row.activeFrom === boundary);
 assert.ok(before && after);
 const hit = match(run, 59);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows.at(-1).endExclusive, boundary);
 assert.ok(hit.sourceFactIds.includes(before.factId) && !hit.sourceFactIds.includes(after.factId));
 const original = before.normalizedPayload.gaoContext;
 assert.deepEqual(original.birthTiming, { start: '2020-08-07T01:06:11.000Z', middle: '2020-08-22T15:44:56.000Z',
  end: '2020-09-07T04:08:02.000Z', afterChuShu: true });
 assert.deepEqual(original.waterSeats.map(row => row.positions.map(seat => seat.position)), [['year', 'day'], ['month', 'hour'], []]);
 assert.deepEqual(original.shenMetalAndWater.map(row => [row.position, row.stem]),
  [['month', '庚'], ['month', '壬'], ['hour', '庚'], ['hour', '壬']]);
 assert.deepEqual(original.fireAuthority, [{ stem: '丁', kind: '运干', god: '正官' }]);
 assert.deepEqual(after.normalizedPayload.gaoContext.fireAuthority, []);
 const returns = after.normalizedPayload.gaoSoilReturns;
 assert.deepEqual(returns.map(row => [row.wood.position, row.wood.stem, row.soil.kind, row.soil.stem]),
  [['month', '甲', '运干', '戊'], ['hour', '甲', '运干', '戊']]);
 assert.ok(returns.every(row => !row.combinesMovingStem && row.woodRoots.length === 0));
 const { input } = modelContext(run);
 assert.ok(input.facts.some(row => row.type === 'zpqz_month_command' && row.data.luckPillar === '戊子' && row.data.stageStart === boundary));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /出生在立秋至白露的申月、处暑起至白露前/u);
 assert.match(prompt, /运干丁正官有克庚日元的官杀方向/u);
 assert.match(prompt, /月柱甲申明透甲木克运干戊偏印/u);
 assert.doesNotMatch(prompt, /gaoSoilReturns|gaoContext|hasGaoFireAuthority/u);
 const ji = submitted(date, 16, 2066);
 const jiReturns = rows(ji).find(row => row.normalizedPayload.luckPillar === '己丑').normalizedPayload.gaoSoilReturns;
 assert.ok(jiReturns.some(row => row.wood.position === 'month' && row.soil.kind === '运干' && row.soil.stem === '己' && row.combinesMovingStem));
 assert.ok(jiReturns.some(row => row.wood.position === 'month' && row.soil.kind === '运支首藏' && row.soil.stem === '己' && !row.combinesMovingStem));
});

test('p017 rejects the similar Shen-month chart while retaining its main and minor fire geometry', () => {
 const run = submitted([1984, 8, 14], 16, 1996, 0);
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '庚午');
 assert.ok(transition);
 const boundary = transition.exactInstant;
 const minor = rows(run).find(row => row.normalizedPayload.luckPillar === '辛未' && row.activeTo === boundary);
 const principal = rows(run).find(row => row.normalizedPayload.luckPillar === '庚午' && row.activeFrom === boundary);
 assert.ok(minor && principal);
 const hit = match(run, 59);
 assert.equal(hit.status, 'not_matched');
 assert.deepEqual(hit.windows, []);
 assert.ok(!hit.sourceFactIds.includes(minor.factId) && !hit.sourceFactIds.includes(principal.factId));
 assert.equal(principal.normalizedPayload.gaoSameColumns, false);
 assert.equal(principal.normalizedPayload.hasGaoFireAuthority, true);
 const lesser = minor.normalizedPayload.gaoContext, actual = principal.normalizedPayload.gaoContext;
 assert.equal(actual.birthTiming.afterChuShu, false);
 assert.deepEqual(actual.waterSeats.find(row => row.branch === '辰').positions.map(row => [row.position, row.pillar]), [['day', '庚辰']]);
 assert.deepEqual(lesser.minorFire.map(row => row.stem), ['丁']);
 assert.deepEqual(lesser.fireAuthority, []);
 assert.deepEqual(actual.fireAuthority, [{ stem: '丁', kind: '运支首藏', god: '正官' }]);
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.match(prompt, /出生在立秋至白露的申月、立秋起至处暑前/u);
 assert.match(prompt, /申子辰成员齐备，实际成化待核/u);
 assert.match(prompt, /同运支内另藏火气丁正官/u);
 assert.match(prompt, /运支首藏丁正官有克庚日元的官杀方向/u);
 const natalFire = submitted([2020, 8, 25], 14, 2040);
 const bingXu = rows(natalFire).find(row => row.normalizedPayload.luckPillar === '丙戌');
 assert.ok(bingXu);
 assert.ok(bingXu.normalizedPayload.nativeFireWitnesses.some(row => row.position === 'hour' && row.kind === '支藏' && row.fireStem === '丁'));
 assert.equal(bingXu.normalizedPayload.gaoContext, undefined);
 assert.equal(match(natalFire, 59).status, 'not_matched');
});

test('month and luck stem/branch branches are not collapsed into a single metal or fire identity',()=>{
 const n=native(['辛丑','丁酉','甲午','壬申']),p=ctx(n,'庚申');assert.equal(p.luckTenGod,'七杀');assert.equal(p.luckBranchMainQiGod,'七杀');assert.equal(p.xinRoots.find(r=>r.position==='decadal').exactStem,false);
 const q=ctx(n,'辛酉');assert.equal(q.luckTenGod,'正官');assert.equal(q.xinRoots.find(r=>r.position==='decadal').exactStem,true);
 assert.deepEqual(q.youOfficerContext.branchRoot, { position: 'decadal', pillar: '辛酉', stem: '辛', branch: '酉', god: '正官', exactStem: true });
 assert.deepEqual(q.youOfficerRoutes, ['branch-root', 'xin-repeat']);
 const mixed=ctx(native(ref.gaoPrinted),'丙申');assert.equal(mixed.luckFireStem,true);assert.equal(mixed.luckFireBranch,false);assert.equal(mixed.strengthVerified,false);
 const run=real(61),both=rows(run).find(f=>f.normalizedPayload.luckPillar==='丁丑').normalizedPayload;
 assert.equal(both.luckTenGod,'伤官');assert.equal(both.luckBranchMainQiGod,'正财');
 assert.equal(match(run,51).status,'matched');
 assert.equal(match(run,51).matchedSourceExcerpt,'財鄉');
 assert.equal(match(run,61).status,'partial');
});

test('p009 and p010 follow the same natal killer, with branch wealth and branch seal on opposite sides of the verified luck change', () => {
 const run = submitted([1980, 3, 12], 16, 2002, 0);
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丙子');
 assert.ok(transition);
 const boundary = transition.exactInstant;
 const previous = rows(run).find(row => row.normalizedPayload.luckPillar === '丁丑' && row.activeTo === boundary);
 const active = rows(run).find(row => row.normalizedPayload.luckPillar === '丙子' && row.activeFrom === boundary);
 assert.ok(previous && active);
 const path = row => row.normalizedPayload.bladeAuthorityPaths.find(value => value.authority.position === 'year'
  && value.authority.kind === '明透' && value.authority.stem === '庚');
 const wealth = path(previous), aid = path(active);
 assert.deepEqual(wealth.movingWealth, [{ stem: '己', god: '正财', kind: '运支首藏' }]);
 assert.deepEqual(wealth.movingOutput, [{ stem: '丁', god: '伤官', kind: '运干' }]);
 assert.deepEqual(wealth.movingSeal, []);
 assert.deepEqual(aid.movingSeal, [{ stem: '癸', god: '正印', kind: '运支首藏' }]);
 assert.deepEqual(aid.movingPeer, []);
 assert.equal(aid.blade.stem, '乙');
 assert.ok(aid.authorityRoots.every(row => row.position !== 'decadal'));
 assert.ok(aid.authorityRoots.some(row => row.position === 'day' && row.exactStem && row.stems.includes('庚')));
 const fromWealth = match(run, 51), fromAid = match(run, 52);
 assert.equal(fromWealth.status, 'matched');
 assert.equal(fromAid.status, 'partial');
 assert.equal(fromWealth.windows.at(-1).endExclusive, boundary);
 assert.equal(fromAid.windows[0].start, boundary);
 assert.ok(fromWealth.sourceFactIds.includes(previous.factId) && !fromWealth.sourceFactIds.includes(active.factId));
 assert.ok(fromAid.sourceFactIds.includes(active.factId) && !fromAid.sourceFactIds.includes(previous.factId));
 const { input } = modelContext(run);
 assert.ok(input.facts.some(row => row.type === 'zpqz_month_command' && row.data.luckPillar === '丁丑' && row.endExclusive === boundary));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /运支首藏己正财生原局年柱明透庚七杀，同一官杀克月令卯所藏乙劫财/u);
 assert.match(prompt, /原局年柱明透庚七杀生运支首藏癸正印，同一运印生月令卯所藏乙劫财/u);
 assert.match(prompt, /阳刃一路，运干丁伤官克原局年柱明透庚七杀，同一七杀克月令卯所藏乙劫财/u);
 assert.doesNotMatch(prompt, /hasBladeAuthorityWealth|hasBladeAuthoritySupport|bladeAuthorityPaths/u);
});

test('p009 and p019 independently confirm branch wealth and unopposed output to the same rooted killer only before the actual luck handoff', async () => {
 const run = submitted([1950, 3, 20], 10, 2025);
 const boundary = '2025-08-23T18:00:00.000Z';
 const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '丙戌');
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '丁亥');
 assert.ok(before && after);
 const p = before.normalizedPayload, q = after.normalizedPayload;
 assert.equal(p.natalPillarSequence, '庚寅己卯甲寅己巳');
 const wealth = p.bladeAuthorityPaths.find(path => path.authority.position === 'year' && path.authority.kind === '明透');
 const output = fact => fact.authorityOutputPaths.find(path => path.route === '阳刃' && path.authority.position === 'year'
  && path.authority.kind === '明透' && path.output.kind === '运干');
 assert.deepEqual([wealth.authority.stem, wealth.blade.stem, output(p).output.stem], ['庚', '乙', '丙']);
 assert.ok(wealth.authorityRoots.some(root => root.position === 'hour' && root.branch === '巳' && root.exactStem));
 assert.deepEqual(wealth.movingWealth, [{ stem: '戊', god: '偏财', kind: '运支首藏' }]);
 assert.deepEqual(output(p).originalSealsCheckingOutput, []);
 assert.deepEqual(output(p).movingSealsCheckingOutput, []);
 assert.deepEqual(output(q).movingSealsCheckingOutput, [{ stem: '壬', god: '偏印', kind: '运支首藏' }]);
 assert.equal(q.hasRootedBladeAuthorityFromBranchWealth, false);
 assert.equal(q.hasRootedBladeKillerUnderUnopposedOutput, false);
 for (const [index, excerpt] of [[51, '財鄉'], [61, '陽刃']]) {
  const result = match(run, index);
  assert.equal(result.status, 'matched');
  assert.equal(result.matchedSourceExcerpt, excerpt);
  assert.equal(result.windows.at(-1).endExclusive, boundary);
  const afterOnly = { ...run, facts: run.facts.filter(row => row.factType !== 'zpqz_month_command' || row.activeFrom >= boundary) };
  const afterResult = match(afterOnly, index);
  assert.equal(afterResult.status, index === 51 ? 'not_matched' : 'partial');
  assert.equal(afterResult.matchedSourceExcerpt, undefined);
 }

 const secondarySeal = submitted([1970, 3, 15], 10, 1993, 0);
 const chou = rows(secondarySeal).find(row => row.normalizedPayload.luckPillar === '丁丑').normalizedPayload;
 assert.deepEqual(output(chou).originalSealsCheckingOutput, []);
 assert.deepEqual(output(chou).movingSealsCheckingOutput, [{ stem: '癸', god: '正印', kind: '运支余藏' }]);
 assert.equal(match(secondarySeal, 51).status, 'matched');
 assert.equal(match(secondarySeal, 61).status, 'partial');

 const { input } = modelContext(run);
 assert.match(formatFortuneFactAudit(input), /运支首藏壬偏印同运克这处运干丁伤官/u);
 const provider = createFortuneDeepSeek({ apiKey: 'test-key', transport: async (_, options) => {
  const content = JSON.parse(options.body).messages[1].content;
  assert.match(content, /若同段食伤也克该官杀，财生和食伤克分别陈述/u);
  assert.match(content, /先假定日主过旺并依靠此七杀制刃/u);
  assert.doesNotMatch(content, /运支首藏壬偏印同运克这处运干丁伤官|hasRootedBlade/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(input);
});

test('p009 keeps a sole clashed root conditional and p019 confirms an independent branch output', () => {
 const weakRoot = submitted([1940, 3, 12], 16, 1953, 0);
 const rootFact = rows(weakRoot).find(row => row.normalizedPayload.luckPillar === '丁丑');
 assert.ok(rootFact?.normalizedPayload.confirmed);
 const root = rootFact.normalizedPayload;
 assert.equal(root.natalPillarSequence, '庚辰己卯甲寅壬申');
 assert.equal(root.hasBladeAuthorityWealth, true);
 assert.deepEqual(root.bladeFourGrowthRootClashes.map(pair => pair.members), [['day', 'hour']]);
 assert.equal(root.hasRootedBladeAuthorityFromBranchWealth, false);
 assert.equal(match(weakRoot, 51).status, 'partial');
 assert.match(formatFortuneFactAudit(modelContext(weakRoot).input), /同干本命根所在四生支见六冲/u);

 const outputs = [2, 4].map(hour => submitted([1930, 6, 15], hour, 1969));
 for (const [i, run] of outputs.entries()) {
  const usable = i === 0;
  const fact = rows(run).find(item => item.normalizedPayload.luckPillar === '丙戌');
  assert.ok(fact?.normalizedPayload.confirmed);
  const p = fact.normalizedPayload;
  assert.equal(p.natalPillarSequence, '庚午壬午丙申' + (usable ? '己丑' : '庚寅'));
  assert.equal(p.hasBladeKillerOutput, true);
  assert.equal(p.hasRootedBladeKillerUnderUnopposedOutput, false);
  assert.equal(p.hasBladeKillerWithUnopposedBranchOutput, usable);
  const proof = p.authorityOutputPaths.find(path => path.authority.position === 'month' && path.output.kind === '运支首藏');
  assert.deepEqual([proof.authority.stem, proof.output.stem, proof.seat.stem], ['壬', '戊', '丁']);
  assert.equal(proof.originalSealsCheckingOutput.some(seal => seal.position === 'hour' && seal.stem === '甲'), !usable);
  const hit = match(run, 61);
  assert.equal(hit.status, usable ? 'matched' : 'partial');
  if (!usable) continue;
  const stage = rows(run).filter(row => row.normalizedPayload.luckPillar === '丙戌');
  assert.deepEqual(hit.sourceFactIds, stage.map(row => row.factId));
  assert.deepEqual(hit.windows, [{ start: stage[0].activeFrom, endExclusive: stage.at(-1).activeTo }]);
  assert.equal(hit.matchedSourceExcerpt, '陽刃');
  const prompt = formatFortunePrompt(modelContext(run).input);
  assert.match(prompt, /运支首藏食伤克原局明透七杀/u);
  assert.doesNotMatch(prompt, /庚午壬午丙申己丑|hasBladeKillerWithUnopposedBranchOutput/u);
 }
});

test('p009 keeps same-pillar support for exposed wealth on the actual Geng-Chen stage', () => {
 const date = [1940, 6, 22];
 for (const [hour, supported] of [[2, true], [4, false]]) {
  const run = submitted(date, hour, 1955, 0);
  const fact = rows(run).find(row => row.normalizedPayload.luckPillar === '庚辰');
  assert.ok(fact);
  const p = fact.normalizedPayload;
  assert.equal(p.hasRootedBladeAuthorityFromBranchWealth, false);
  assert.equal(p.hasBladeAuthorityFromSupportedStemWealth, supported);
  const path = p.bladeAuthorityPaths.find(row => row.authority.position === 'month' && row.authority.stem === '壬');
  assert.ok(path.authorityRoots.some(row => row.position === 'day' && row.branch === '申' && row.exactStem));
  assert.deepEqual(path.movingWealth.map(row => [row.kind, row.stem]), [['运干', '庚']]);
  assert.equal(p.bladeFourGrowthRootClashes.length, supported ? 0 : 1);
  const hit = match(run, 51);
  assert.equal(hit.status, supported ? 'matched' : 'partial');
  if (supported) {
   const boundary = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '庚辰');
   assert.equal(fact.activeFrom, boundary.exactInstant);
   assert.ok(hit.sourceFactIds.includes(fact.factId));
   assert.equal(hit.windows[0].start, boundary.exactInstant);
   assert.match(formatFortunePrompt(modelContext(run).input), /运支首藏生同柱运财/u);
  }
 }
});

test('the printed Ding-Ren blade chart preserves each direction while excluding the three opposite readings', () => {
 const date = [2006, 9, 28];
 const restraint = submitted(date, 12, 2050);
 const boundary = '2050-03-01T22:00:00.000Z';
 const before = rows(restraint).find(row => row.activeTo === boundary);
 const after = rows(restraint).find(row => row.activeFrom === boundary);
 assert.deepEqual([before.normalizedPayload.luckPillar, after.normalizedPayload.luckPillar], ['辛丑', '壬寅']);
 assert.equal(before.normalizedPayload.bladeKillerSourceAllowsRestraint, false);
 assert.equal(before.normalizedPayload.bladeClearingSourceComparison, undefined);
 const { normalizedPayload: p } = after;
 const { authority, officer, helper, blade, join, output, wealth, seal } = p.bladeClearingSourceComparison;
 assert.deepEqual([authority.position, authority.stem, officer.position, officer.stem, helper.position, helper.stem, blade.stem],
  ['year', '丙', 'month', '丁', 'hour', '壬', '辛']);
 assert.deepEqual(join, { kind: '天干五合', values: '丁壬', members: ['month', 'hour'] });
 assert.deepEqual([output.kind, output.stem, wealth.kind, wealth.stem, seal], ['运干', '壬', '运支首藏', '甲', undefined]);
 assert.equal(p.hasBladeAuthorityWealth, true);
 assert.equal(p.hasBladeKillerOutput, true);
 assert.equal(p.bladeWealthSourceExcludesBenefit, true);
 assert.equal(p.bladeKillerSourceAllowsRestraint, true);
 const guiMao = ctx(native(['丙戌', '丁酉', '庚申', '壬午']), '癸卯');
 assert.equal(guiMao.bladeKillerSourceAllowsRestraint, true);
 assert.equal(guiMao.bladeWealthSourceExcludesBenefit, true);
 assert.deepEqual([guiMao.bladeClearingSourceComparison.output.stem, guiMao.bladeClearingSourceComparison.wealth.stem], ['癸', '乙']);
 const matches = matchFortuneKnowledge(restraint).byMethod.bazi;
 assert.deepEqual([51, 61].map(index => matches[index].status), ['not_matched', 'not_matched']);
 assert.equal(matches[52].status, 'partial');
 assert.equal(matches[52].windows.at(-1).endExclusive, boundary);
 const { input } = buildFortuneModelContext(restraint,
  interpretFortune(restraint, requestForFortuneRun(restraint), 'blade-source-branch'));
 assert.match(formatFortuneFactAudit(input), /庚申原图时壬合月丁，原评留年丙七杀/u);
 assert.doesNotMatch(formatFortunePrompt(input), /庚申原图时壬合月丁|bladeClearingSourceComparison/u);
 const changed = submitted(date, 10, 2050);
 const changedYin = rows(changed).find(row => row.normalizedPayload.luckPillar === '壬寅');
 assert.ok(changedYin);
 assert.equal(changedYin.normalizedPayload.bladeClearingSourceComparison, undefined);
 assert.equal(changedYin.normalizedPayload.bladeWealthSourceExcludesBenefit, false);
 assert.equal(changedYin.normalizedPayload.bladeKillerSourceAllowsRestraint, false);
 const changedMatches = matchFortuneKnowledge(changed).byMethod.bazi;
 assert.deepEqual([51, 61].map(index => changedMatches[index].status), ['matched', 'partial']);
 assert.ok([51, 61].every(index => changedMatches[index].sourceFactIds.includes(changedYin.factId)));

 const pendingSeal = submitted(date, 12, 2020);
 const sealBoundary = '2020-03-01T22:00:00.000Z';
 const priorSeal = rows(pendingSeal).find(row => row.activeTo === sealBoundary);
 const nextSeal = rows(pendingSeal).find(row => row.activeFrom === sealBoundary);
 assert.deepEqual([priorSeal.normalizedPayload.luckPillar, nextSeal.normalizedPayload.luckPillar], ['戊戌', '己亥']);
 for (const [fact, stem] of [[priorSeal, '戊'], [nextSeal, '己']]) {
  const payload = fact.normalizedPayload;
  assert.equal(payload.hasBladeAuthoritySupport, true);
  assert.equal(payload.bladeSupportDifferentRationale, true);
  assert.deepEqual([payload.bladeClearingSourceComparison.seal.kind, payload.bladeClearingSourceComparison.seal.stem,
   payload.bladeClearingSourceComparison.helper.stem], ['运干', stem, '壬']);
 }
 assert.equal(match(pendingSeal, 52).status, 'not_matched');
 assert.equal(match(pendingSeal, 61).status, 'partial');
 const shiftedSeal = submitted(date, 10, 2020);
 const closeSeal = rows(shiftedSeal).find(row => row.normalizedPayload.luckPillar === '己亥');
 assert.ok(closeSeal);
 assert.equal(closeSeal.normalizedPayload.bladeSupportDifferentRationale, false);
 assert.equal(match(shiftedSeal, 52).status, 'partial');
 assert.equal(ctx(native(['丙戌', '丁酉', '庚申', '壬午']), '壬寅', false).bladeKillerSourceAllowsRestraint, undefined);
});

test('p009 confirms the author’s strong blade in the printed chart at the actual Shen and You stages', () => {
 const date = [1986, 6, 21], hour = 8;
 for (const [year, prior, incoming, stem] of [
  [2001, '乙未', '丙申', '庚'], [2011, '丙申', '丁酉', '辛'],
 ]) {
  const run = submitted(date, hour, year);
  const boundary = `${year}-12-11T00:00:00.000Z`;
  const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === prior);
  const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === incoming);
  assert.ok(before && after);
  assert.equal(before.normalizedPayload.hasReviewedStrongBladeWealthPath, year === 2011);
  const data = after.normalizedPayload;
  assert.equal(data.natalPillarSequence, '丙寅甲午丙申壬辰');
  assert.equal(data.hasReviewedStrongBladeWealthPath, true);
  assert.equal(data.hasBladeAuthoritySupport, true);
  assert.equal(data.bladeSupportStrongSource, true);
  assert.equal(data.bladeSupportDifferentRationale, true);
  assert.equal(match(run, 52).status, 'not_matched');
  const path = data.bladeAuthorityPaths.find(row => row.authority.position === 'hour' && row.authority.kind === '明透');
  assert.deepEqual([path.blade.position, path.blade.stem, path.authority.stem], ['month', '丁', '壬']);
  assert.ok(path.authorityRoots.some(root => root.position === 'day' && root.branch === '申' && root.exactStem));
  assert.deepEqual(path.movingWealth.map(row => [row.kind, row.stem]), [['运支首藏', stem]]);
  const hit = match(run, 51);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '原局刃旺');
  assert.equal(hit.sourceFactIds.includes(before.factId), year === 2011);
  assert.ok(hit.sourceFactIds.includes(after.factId));
  if (year === 2001) assert.equal(hit.windows[0].start, boundary);
  const { input } = modelContext(run);
  const message = formatFortunePrompt(input);
  const localSource = /丙寅原图的原评取刃旺杀强/u;
  assert.match(formatFortuneFactAudit(input), localSource);
  assert.doesNotMatch(message, localSource);
  assert.match(message, /原局刃旺/u);
  assert.doesNotMatch(message, /則喜行財鄉|hasReviewedStrongBladeWealthPath/u);
 }
 const changedHour = submitted(date, 10, 2001);
 const alternative = rows(changedHour).find(row => row.normalizedPayload.luckPillar === '丙申');
 assert.ok(alternative);
 assert.equal(alternative.normalizedPayload.hasReviewedStrongBladeWealthPath, false);
 assert.equal(alternative.normalizedPayload.bladeSupportStrongSource, false);
 assert.equal(match(changedHour, 51).status, 'partial');
 assert.equal(ctx(native(['丙寅', '甲午', '丙申', '壬辰']), '丙申', false).hasReviewedStrongBladeWealthPath, undefined);
 assert.equal(ctx(native(['丙寅', '甲午', '丙申', '壬辰']), '丙申', false).bladeSupportStrongSource, undefined);
});

test('p010 confirms the same exposed Ren and Jia at each source stage with the separately reviewed Wu-Zi clash', async () => {
 const date = [1961, 7, 2], hour = 8;
 const sourcePhrase = /时透壬杀通申根，原评谓身非旺，取月透甲印化杀/u;
 const cases = [
  [1980, '癸巳', '壬辰', 'authority', 'authority', '癸', '壬'],
  [1990, '壬辰', '辛卯', 'authority', 'unrootedWealth', '壬', '辛'],
  [2000, '辛卯', '庚寅', 'unrootedWealth', 'unrootedWealth', '辛', '庚'],
  [2020, '己丑', '戊子', 'outputsCheckedBySeal', undefined, '己', undefined],
 ];
 const interpretations = {
  authority: /本步官杀生原局月甲印/u,
  unrootedWealth: /运干无运支金根而生原壬/u,
  outputsCheckedBySeal: /本步己伤官克时壬杀/u,
 };
 for (const [year, previous, incoming, fromField, toField, fromStem, toStem] of cases) {
  const run = submitted(date, hour, year);
  const boundary = new Date(Date.UTC(year, 2, 8, 4)).toISOString();
  const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === previous);
  const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === incoming);
  assert.ok(before && after, incoming);
  const result = match(run, 52);
  assert.equal(match(run, 51).status, 'not_matched');
  const sourceOnly = structuredClone(run);
  rows(sourceOnly).forEach(row => { row.normalizedPayload.hasBladeAuthoritySupport = false; });
  const sourceHit = match(sourceOnly, 52);
  for (const [fact, field, stem] of [[before, fromField, fromStem], [after, toField, toStem]]) {
   const p = fact.normalizedPayload;
   assert.equal(p.confirmed, true);
   assert.equal(p.bladeWealthSourceExcludesBenefit, true);
   const wuZiClash = p.luckPillar === '戊子';
   assert.equal(p.hasPrintedBladeStageMonthClash, wuZiClash);
   assert.equal(result.sourceFactIds.includes(fact.factId), Boolean(field) || wuZiClash, p.luckPillar);
   assert.equal(sourceHit.sourceFactIds.includes(fact.factId), Boolean(field) || wuZiClash, p.luckPillar);
   if (!field) {
    assert.equal(p.bladePrintedSupportRoute, undefined);
    assert.deepEqual(p.bladeKillerSourceComparison.monthClash.members, ['month', 'decadal']);
    const contact = p.bladeKillerSourceComparison.paths.find(path => path.output.kind === '运干');
    assert.deepEqual([contact.output.stem, contact.authority.position, contact.authority.stem], ['戊', 'hour', '壬']);
    assert.ok(contact.originalSealsCheckingOutput.some(row => row.position === 'month' && row.stem === '甲'));
    continue;
   }
   const proof = p.bladePrintedSupport;
   assert.deepEqual([proof.killer.position, proof.killer.stem, proof.seal.position, proof.seal.stem, proof.blade.stem],
    ['hour', '壬', 'month', '甲', '丁']);
   assert.ok(proof.killerRoots.some(root => root.position === 'day' && root.branch === '申' && root.exactStem));
   assert.ok(proof[field].some(row => row.kind === '运干' && row.stem === stem));
   if (field === 'unrootedWealth') {
    assert.ok(p.luckHiddenStems.every(row => row.element !== '金'));
    assert.equal(p.hasBladeAuthorityWealth, true);
   }
   if (field === 'outputsCheckedBySeal') assert.deepEqual(proof[field].map(row => row.kind), ['运干', '运支首藏']);
  }
  assert.equal(result.status, 'matched');
  assert.equal(sourceHit.status, 'matched');
  assert.equal(result.matchedSourceExcerpt, incoming === '戊子'
   ? '若刃輕而官煞重，則宜助其刃\n子運沖刃' : '若刃輕而官煞重，則宜助其刃');
  if (incoming === '戊子') {
   assert.equal(result.confirmedBranches[0].windows.at(-1).endExclusive, boundary);
   assert.equal(result.confirmedBranches[1].windows[0].start, boundary);
   const withinWuZi = match({ ...run, facts: [after] }, 52);
   assert.equal(withinWuZi.matchedSourceExcerpt, '子運沖刃');
   assert.match(withinWuZi.matchedConditions.join(''), /戊.*壬.*甲.*午/u);
   const isolated = formatFortunePrompt(modelContext({ ...run, facts: [after] }).input);
   assert.match(isolated, /子運沖刃/u);
   assert.doesNotMatch(isolated, /若刃輕而官煞重，則宜助其刃|bladeKillerSourceComparison|hasPrintedBladeStageMonthClash/u);
  }
  if (year === 1990) {
   assert.equal(result.confirmedBranches.length, 2);
   const [authority, wealth] = result.confirmedBranches;
   assert.match(authority.conditions.join(''), interpretations.authority);
   assert.match(wealth.conditions.join(''), interpretations.unrootedWealth);
   assert.equal(authority.windows.at(-1).endExclusive, boundary);
   assert.equal(wealth.windows[0].start, boundary);
  }
  const { input } = modelContext(run);
  const message = formatFortunePrompt(input);
  for (const [field, phrase] of Object.entries(interpretations)) {
   assert.equal(phrase.test(message), [fromField, toField].includes(field), field);
  }
  if (year === 2000) {
   const phrase = /在运支无同五行根，生该原杀/u;
   assert.match(formatFortuneFactAudit(input), phrase);
   assert.doesNotMatch(formatFortunePrompt(input), phrase);
   const provider = createFortuneDeepSeek({ apiKey: 'test-key', transport: async (_, options) => {
    const content = JSON.parse(options.body).messages[1].content;
    assert.match(content, sourcePhrase);
    assert.match(content, interpretations.unrootedWealth);
    assert.doesNotMatch(content, interpretations.authority);
    assert.doesNotMatch(content, interpretations.outputsCheckedBySeal);
    assert.doesNotMatch(content, /bladePrintedSupportRoute|unrooted-wealth-to-killer-to-seal/u);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
   } });
   await provider.interpret(input);
  }
 }

 const other = submitted([1888, 6, 14], 20, 1966);
 const source = rows(other).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '丙寅');
 assert.ok(source && source.normalizedPayload.hasBladeAuthoritySupport);
 assert.equal(source.normalizedPayload.bladeSupportDifferentRationale, true);
 const comparison = source.normalizedPayload.bladeFoodReliefComparison;
 assert.deepEqual([comparison.officer.position, comparison.officer.stem, comparison.officer.kind], ['year', '癸', '支藏']);
 assert.deepEqual(comparison.outputs.map(row => [row.position, row.stem]), [['year', '戊'], ['month', '戊'], ['hour', '戊']]);
 assert.deepEqual(comparison.sealsCheckingOutput.map(row => [row.kind, row.stem]), [['运支首藏', '甲']]);
 assert.equal(match(other, 52).status, 'not_matched');
 assert.match(formatFortuneFactAudit(modelContext(other).input), /戊子原图的三处透戊实克/u);
 const changedHour = submitted([1888, 6, 14], 18, 1966);
 const near = rows(changedHour).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '丙寅');
 assert.ok(near && near.normalizedPayload.hasBladeAuthoritySupport);
 assert.equal(near.normalizedPayload.bladeSupportDifferentRationale, false);
 const nearHit = match(changedHour, 52);
 assert.equal(nearHit.status, 'partial');
 assert.ok(nearHit.sourceFactIds.includes(near.factId));
 assert.doesNotMatch(formatFortunePrompt(modelContext(changedHour).input), sourcePhrase);
});

test('p011 requires native wealth on the same output path even when the arriving wealth and native output are already present', () => {
 const date = [1980, 12, 16], target = 1986;
 const absent = submitted(date, 6, target, 0), present = submitted(date, 8, target, 0);
 const stages = [absent, present].map(run => rows(run).find(row => row.normalizedPayload.luckPillar === '丁亥'
  && row.normalizedPayload.confirmed));
 assert.ok(stages.every(row => row?.normalizedPayload.wealthBridgeCandidate));
 assert.deepEqual(stages.map(row => row.normalizedPayload.natalPillarSequence), ['庚申戊子癸亥乙卯', '庚申戊子癸亥丙辰']);
 assert.deepEqual(stages[0].normalizedPayload.nativeWealthBridgePaths, []);
 assert.equal(match(absent, luJieWealthIndex).status, 'not_matched');
 const hit = match(present, luJieWealthIndex), data = stages[1].normalizedPayload;
 assert.equal(hit.status, 'matched');
 assert.ok(hit.sourceFactIds.includes(stages[1].factId));
 const path = data.nativeWealthBridgePaths.find(row => row.peer.position === 'month' && row.peer.stem === '癸'
  && row.output.position === 'day' && row.output.stem === '甲'
  && row.wealth.position === 'hour' && row.wealth.kind === '明透' && row.wealth.stem === '丙');
 assert.ok(path);
 assert.deepEqual(path.rootPositions, []);
 assert.deepEqual(path.movingWealth, { stem: '丁', god: '偏财', kind: '运干' });
 const missing = structuredClone(stages[1]);
 delete missing.normalizedPayload.hasNativeWealthBridge;
 assert.equal(match({ ...present, facts: [missing] }, luJieWealthIndex).status, 'unknown');
 const { input } = modelContext(present);
 const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
 assert.ok(finding);
 assert.match(finding.note, /食伤/u);
 assert.match(finding.note, /先/u);
 assert.deepEqual(finding.windows, hit.windows);
 assert.match(formatFortuneFactAudit(input), /同一日柱支藏甲伤官所生原财为时柱明透丙正财，所接运财为运干丁偏财/u);
});

test('p019 retains the exact output and seal in the named blade chart but applies its documented not-strong exception only to the same four columns', () => {
 const date = [1961, 7, 2], year = 2020;
 const original = submitted(date, 8, year), variant = submitted(date, 10, year);
 const originalWu = rows(original).find(row => row.normalizedPayload.luckPillar === '戊子');
 const variantWu = rows(variant).find(row => row.normalizedPayload.luckPillar === '戊子');
 assert.ok(originalWu && variantWu);
 const path = originalWu.normalizedPayload.authorityOutputPaths.find(row => row.route === '阳刃'
  && row.authority.position === 'hour' && row.authority.stem === '壬' && row.authority.kind === '明透');
 assert.ok(path);
 assert.deepEqual(path.output, { stem: '戊', god: '食神', kind: '运干' });
 assert.equal(path.seat.stem, '丁');
 assert.ok(path.originalSealsCheckingOutput.some(row => row.position === 'month' && row.kind === '明透' && row.stem === '甲'));
 assert.deepEqual(path.movingSealsCheckingOutput, []);
 assert.equal(originalWu.normalizedPayload.bladeKillerNamedNotStrong, true);
 assert.equal(variantWu.normalizedPayload.bladeKillerNamedNotStrong, false);
 const bladeComparison = originalWu.normalizedPayload.bladeKillerSourceComparison;
 assert.ok(bladeComparison.paths.some(row => row.output.stem === '戊' && row.authority.stem === '壬'));
 assert.equal(bladeComparison.monthClash.kind, '六冲');
 assert.deepEqual(bladeComparison.monthClash.members, ['month', 'decadal']);
 assert.equal(variantWu.normalizedPayload.bladeKillerSourceComparison, undefined);
 assert.equal(variantWu.normalizedPayload.hasPrintedBladeStageMonthClash, false);
 assert.equal(ctx(native(['辛丑', '甲午', '丙申', '壬辰']), '戊子', false).hasPrintedBladeStageMonthClash, undefined);
 assert.equal(match(original, 61).status, 'not_matched');
 assert.ok(match(original, 52).sourceFactIds.includes(originalWu.factId));
 assert.ok(!match(variant, 52).sourceFactIds.includes(variantWu.factId));
 assert.ok(match(variant, 61).sourceFactIds.includes(variantWu.factId));
 assert.match(formatFortuneFactAudit(modelContext(original).input), /徐注判该例日元不旺，食伤克杀和印回克按此原例读/u);
});

test('p019 checks the used Mu officer independently of the two hidden killers across the Hai-to-Zi luck handover', () => {
 const date = [1954, 10, 1];
 for (const [hour, usesOfficer] of [[4, true], [6, false]]) {
  const run = submitted(date, hour, 1977);
  const boundary = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丙子')?.exactInstant;
  assert.ok(boundary);
  if (usesOfficer) assert.equal(boundary, '1977-05-30T14:00:00.000Z');
  const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '乙亥');
  const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '丙子');
  assert.ok(before && after);
  for (const [fact, stem] of [[before, '壬'], [after, '癸']]) {
   const data = fact.normalizedPayload;
   assert.equal(data.bladeKillerSourceUsesOfficer, usesOfficer);
   assert.equal(data.hasBladeKillerOutput, true);
   const comparison = data.bladeKillerMuOfficerComparison;
   if (usesOfficer) {
    assert.deepEqual([comparison.authority.position, comparison.authority.stem, comparison.authority.god, comparison.blade.stem],
     ['year', '丁', '正官', '辛']);
    assert.deepEqual(comparison.outputPaths.map(({ authority, output }) => [authority.position, authority.stem, output.kind, output.stem]),
     [['day', '丙', '运支首藏', stem], ['hour', '丙', '运支首藏', stem]]);
    assert.deepEqual(comparison.officerPressure.map(row => row.stem), [stem]);
    if (fact === after) assert.deepEqual(comparison.officerClash.members, ['year', 'decadal']);
    else assert.equal(comparison.officerClash, undefined);
   } else assert.equal(comparison, undefined);
   assert.equal(match({ ...run, facts: [fact] }, 61).status, usesOfficer ? 'not_matched' : 'partial');
  }
  if (usesOfficer) {
   const { input } = modelContext(run);
   assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== fortuneKnowledge.bazi.rules[61].knowledgeId)));
   const localSource = /穆同知原图取年午丁正官制刃/u;
   assert.match(formatFortuneFactAudit(input), localSource);
   assert.doesNotMatch(formatFortunePrompt(input), localSource);
  }
 }
 const unknown = ctx(native(['甲午', '癸酉', '庚寅', '戊寅']), '丙子', false);
 assert.equal(unknown.bladeKillerSourceUsesOfficer, undefined);
});

test('p020 keeps Jin’s two source comparisons at the transition without matching the protected risk', () => {
 const run = submitted([1970, 12, 19], 22, 2006);
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '壬辰');
 assert.ok(transition);
 const boundary = transition.exactInstant;
 const before = rows(run).find(row => row.normalizedPayload.luckPillar === '辛卯' && row.activeTo === boundary);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '壬辰' && row.activeFrom === boundary);
 assert.ok(before && after);
 const hit = match(run, 62);
 assert.equal(hit.status, 'not_matched');
 assert.deepEqual(hit.windows, []);
 assert.ok(!hit.sourceFactIds.includes(before.factId) && !hit.sourceFactIds.includes(after.factId));
 const path = before.normalizedPayload.authorityOutputPaths.find(row => row.route === '建禄'
  && row.authority.position === 'month' && row.authority.stem === '戊' && row.authority.kind === '明透');
 assert.ok(path);
 assert.deepEqual(path.output, { stem: '乙', god: '食神', kind: '运支首藏' });
 assert.equal(path.seat.stem, '癸');
 assert.ok(path.authorityRoots.some(row => row.position === 'year' && row.exactStem && row.stems.includes('戊')));
 assert.ok(path.originalSealsCheckingOutput.some(row => row.position === 'year' && row.kind === '明透' && row.stem === '庚'));
 assert.deepEqual(path.movingSealsCheckingOutput, [{ stem: '辛', god: '偏印', kind: '运干' }]);
 assert.ok(after.normalizedPayload.luckHiddenStems.some(row => row.stem === '乙'));
 assert.deepEqual(after.normalizedPayload.authorityOutputPaths, []);
 assert.equal(before.normalizedPayload.luOfficerSourceComparison.route, 'jin-printed-protection');
 assert.equal(before.normalizedPayload.luOfficerSourceExcludesRisk, true);
 assert.equal(after.normalizedPayload.luOfficerSourceComparison.route, 'jin-printed-protection');
 assert.equal(after.normalizedPayload.luOfficerSourceExcludesRisk, false);
 const { input } = modelContext(run);
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /建禄一路，运支首藏乙食神克原局月柱明透戊正官，同一正官克月令子所藏癸比肩/u);
 assert.match(prompt, /原局年柱明透庚正印克这处运支首藏乙食神/u);
 assert.match(prompt, /运干辛偏印同运克这处运支首藏乙食神/u);
 assert.doesNotMatch(prompt, /originalSealsCheckingOutput|movingSealsCheckingOutput|bladeKillerNamedNotStrong/u);
});

test('Li’s same exposed officer has different source evidence across Ji-Hai and Wu-Xu', () => {
 const run = submitted([1957, 6, 14], 4, 2030);
 const boundary = '2030-01-26T20:00:00.000Z';
 const before = rows(run).find(row => row.normalizedPayload.luckPillar === '己亥' && row.activeTo === boundary);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '戊戌' && row.activeFrom === boundary);
 assert.ok(before && after);
 assert.deepEqual([before.normalizedPayload.luOfficerSourceComparison.route, after.normalizedPayload.luOfficerSourceComparison.route],
  ['li-ji-hai-neutral', 'li-wu-xu-pressure']);
 assert.deepEqual([before.normalizedPayload.luOfficerSourceExcludesRisk, after.normalizedPayload.luOfficerSourceExcludesRisk], [true, false]);
 assert.deepEqual([before.normalizedPayload.namedLuOfficerRisk, after.normalizedPayload.namedLuOfficerRisk], [false, true]);
 for (const [fact, stem] of [[before, '己'], [after, '戊']]) {
  const comparison = fact.normalizedPayload.luOfficerSourceComparison;
  const path = comparison.paths.find(row => row.output.kind === '运干');
  assert.deepEqual([path.seat.branch, path.authority.position, path.authority.stem, path.output.stem], ['午', 'hour', '壬', stem]);
  assert.ok(path.originalSealsCheckingOutput.every(row => row.kind !== '明透'));
  assert.deepEqual(comparison.wealthToOfficer.officer, path.authority);
  assert.deepEqual(comparison.wealthToOfficer.sources.map(row => [row.position, row.branch, row.stem]),
   [['day', '巳', '庚'], ['year', '酉', '辛']]);
 }
 const variant = submitted([1957, 6, 14], 22, 2030);
 const changedHour = rows(variant).find(row => row.normalizedPayload.luckPillar === '戊戌').normalizedPayload;
 assert.equal(changedHour.hasLuOfficerOutput, true);
 assert.equal(changedHour.luOfficerSourceComparison, undefined);
 assert.equal(changedHour.luOfficerSourceExcludesRisk, false);
 assert.equal(match(variant, namedLuOfficerRiskIndex).status, 'not_matched');
 const { input, knowledge } = modelContext(run);
 const hit = knowledge.byMethod.bazi[namedLuOfficerRiskIndex];
 assert.equal(hit.status, 'matched');
 assert.ok(!hit.sourceFactIds.includes(before.factId));
 assert.ok(hit.sourceFactIds.includes(after.factId));
 assert.equal(hit.windows[0].start, boundary);
 const prompt = formatFortunePrompt(input), audit = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('己亥尚可，到了戊戌则由运干戊伤官'));
 assert.ok(audit.includes('原评将这步列为无碍对照') && audit.includes('原评明确保留这一食伤压力'));
 assert.ok(!prompt.includes('李知府戊戌的运干戊伤官实克原局时透壬官'));
});

test('missing time keeps negative exposure and named-god absence unknown while visible positive witnesses remain available',()=>{
 const n=native(['庚申','乙酉','甲申','辛未']),p=ctx(n,'辛巳',false);assert.equal(p.xinExposed,undefined);assert.equal(p.xinHidden,true);assert.equal(p.xinNewlyExposedByLuck,undefined);
 assert.equal(p.godWitnesses.find(g=>g.god==='正官').exposed,undefined);assert.equal(p.godWitnesses.find(g=>g.god==='七杀').present,true);
 assert.equal(p.natalPillars.length,3);assert.equal(p.natalPillars.some(p=>p.position==='hour'),false);
 for(const bad of ['甲丑','甲','bad'])assert.throws(()=>ctx(native(ref.gaoPrinted),bad));
});

test('SQLite rejects wrong-month and generic records and withholds incomplete passages',()=>{
 const run=structuredClone(real(67));rows(run).forEach(f=>{f.normalizedPayload.jiaYouMonth=false;});for(const i of [67,68,69,70])assert.equal(match(run,i).status,'not_matched');
 const absent=structuredClone(real(67));absent.facts=absent.facts.filter(f=>f.factType!=='zpqz_month_command');assert.equal(match(absent,67).status,'unknown');
 const wrong=structuredClone(real(67));rows(wrong).forEach(f=>f.normalizedPayload.profile='other');assert.equal(match(wrong,67).status,'not_matched');
 const split=structuredClone(real(67));for(const f of [...rows(split)]){const other=structuredClone(f);other.factId+='-separate';other.normalizedPayload.jiaYouMonth=false;f.normalizedPayload.xinExposed=false;split.facts.push(other);}
 assert.equal(match(split,67).status,'not_matched','two incomplete contexts cannot supply each other\'s month/exposure premise');
 const {input}=buildFortuneModelContext(real(67),interpretFortune(real(67),requestForFortuneRun(real(67)),'month-private-report'));assert.ok(!input.sections.flatMap(s=>s.findings).some(f=>indices.some(i=>i!==luJieWealthIndex&&f.knowledgeId===fortuneKnowledge.bazi.rules[i].knowledgeId)));
});

test('p025–p027 keep the actual Shen root, moving Geng and both root clashes on one confirmed stage', () => {
 const date = [1998, 9, 14], hour = 6;
 const run = submitted(date, hour, 2000, 0);
 const actual = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '庚申');
 assert.ok(actual);
 assert.equal(actual.normalizedPayload.stageStart, '2000-09-22T16:00:00.000Z');
 for (const index of [67, 68, 69]) {
  const result = match(run, index);
  assert.equal(result.status, 'partial');
  assert.equal(result.windows[0].start, actual.normalizedPayload.stageStart);
 }
 assert.equal(match(run, 70).status, 'not_matched');
 assert.equal(actual.normalizedPayload.youOfficerUnopposedShenRoot, false);
 assert.equal(actual.normalizedPayload.youOfficerDistinctMovingStem, undefined);
 const { youOfficerContext: context, youOfficerRoutes } = actual.normalizedPayload;
 assert.deepEqual(youOfficerRoutes, ['branch-root', 'geng-killer']);
 assert.deepEqual(context.monthOfficer, { position: 'month', pillar: '辛酉', stem: '辛', branch: '酉', god: '正官' });
 assert.deepEqual(context.branchRoot, { position: 'decadal', pillar: '庚申', stem: '庚', branch: '申', god: '七杀', exactStem: false });
 assert.deepEqual(context.rootClashes.map(pair => pair.map(row => row.position)), [['year', 'decadal'], ['month', 'hour']]);
 assert.deepEqual(context.rootReview.map(row => [row.position, row.seat, row.exactStem, row.opposingColumns.map(other => other.position)]), [
  ['month', 'xin-you-lu', true, ['hour']], ['decadal', 'other-metal-root', false, ['year']],
 ]);
 assert.deepEqual(context.exposureReview.map(row => [row.position, row.god, row.combiningColumns.length]), [
  ['month', '正官', 0], ['decadal', '七杀', 0],
 ]);
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.match(prompt, /本步大运庚申的运支本气为庚七杀.*同金异干根位/u);
 assert.match(prompt, /本步大运庚申的运干庚为七杀.*混杀候选/u);
 assert.match(prompt, /月柱辛酉与时柱丁卯六冲/u);
 assert.doesNotMatch(prompt, /youOfficerRoutes|youOfficerContext|geng-killer/u);

 const annualOnly = submitted(date, hour, 2021, 0);
 assert.ok(annualOnly.facts.some(fact => fact.factType === 'zpqz_moving_relations' && fact.normalizedPayload.annualStem === '辛'));
 for (const index of [67, 68, 69, 70]) assert.equal(match(annualOnly, index).status, 'not_matched');
});

test('p025 and p026 confirm separate branch and stem positions at one actual Geng-Shen arrival', () => {
 const run = submitted([1943, 9, 13], 10, 1945, 1);
 const boundary = '1945-03-18T12:00:00.000Z';
 const fact = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.confirmed);
 assert.ok(fact);
 const p = fact.normalizedPayload;
 assert.equal(p.natalPillarSequence, '癸未辛酉甲戌己巳');
 assert.equal(p.luckPillar, '庚申');
 assert.equal(p.youOfficerUnopposedShenRoot, true);
 assert.equal(p.youOfficerDistinctMovingStem, 'geng-killer');
 assert.equal(p.youOfficerContext.branchRoot.exactStem, false);
 assert.deepEqual([p.youOfficerContext.branchRoot.stem, p.youOfficerContext.movingStem.god], ['庚', '七杀']);

 for (const [index, excerpt] of [[67, '運至西方'], [68, '逢庚辛']]) {
  const matchResult = match(run, index);
  assert.equal(matchResult.status, 'matched');
  assert.equal(matchResult.matchedSourceExcerpt, excerpt);
  assert.equal(matchResult.windows[0].start, boundary);
  assert.ok(matchResult.sourceFactIds.includes(fact.factId));
 }
 assert.equal(match(run, 70).status, 'not_matched');
 const prompt = formatFortunePrompt(modelContext(run).input);
 assert.match(prompt, /实际申运新增本气庚金的位置，与月令辛同金异干/u);
 assert.match(prompt, /实际运干庚以七杀新到，与原局透辛分列/u);
 assert.doesNotMatch(prompt, /為混煞重官|youOfficerUnopposedShenRoot|youOfficerDistinctMovingStem/u);
 const unknown = ctx(native(['癸未', '辛酉', '甲戌', '己巳']), '庚申', false);
 assert.equal(unknown.youOfficerUnopposedShenRoot, undefined);
 assert.equal(unknown.youOfficerDistinctMovingStem, undefined);
});

test('p026 retains both Geng and repeated Xin on their own sides of the actual luck change', () => {
 const example = ref.calendarExamples[68];
 const run = submitted(example.date, example.hour, 2020, example.gender);
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '辛丑');
 assert.ok(change);
 const hit = match(run, 68);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '逢庚辛');
 const [geng, xin] = hit.confirmedBranches;
 assert.equal(geng.windows.at(-1).endExclusive, change.exactInstant);
 assert.equal(xin.windows[0].start, change.exactInstant);
 assert.match(geng.conditions[0], /运干庚以七杀新到/u);
 assert.match(xin.conditions[0], /运干再见正官辛/u);
 assert.equal(match(run, 70).status, 'not_matched');
 const { input } = modelContext(run);
 const facts = input.facts.filter(fact => fact.type === 'zpqz_month_command');
 assert.ok(facts.some(fact => fact.data.youOfficerContext?.movingStem?.route === 'geng-killer' && fact.endExclusive === change.exactInstant));
 assert.ok(facts.some(fact => fact.data.youOfficerContext?.movingStem?.route === 'xin-repeat' && fact.start === change.exactInstant));
 assert.match(formatFortuneFactAudit(input), /本步大运辛丑的运干辛为正官.*原局已透辛同见.*重官候选/u);
});

test('p026 confirms repeated Geng and Xin separately when the natal chart already exposes both', () => {
 const run = submitted([1981, 9, 23], 12, 2016, 0);
 const boundary = '2016-10-18T22:00:00.000Z';
 const beforeFact = rows(run).find(row => row.activeTo === boundary);
 const afterFact = rows(run).find(row => row.activeFrom === boundary);
 const before = beforeFact.normalizedPayload, after = afterFact.normalizedPayload;
 assert.equal(after.natalPillarSequence, '辛酉丁酉甲辰庚午');
 assert.deepEqual([before.luckPillar, after.luckPillar], ['庚子', '辛丑']);
 assert.equal(before.youOfficerRepeatedXinWithNatalGeng, false);
 assert.equal(after.youOfficerRepeatedXinWithNatalGeng, true);
 assert.equal(before.youOfficerRepeatedGengWithNatalXin, true);
 assert.equal(after.youOfficerRepeatedGengWithNatalXin, false);
 assert.equal(before.youOfficerDistinctMovingStem, undefined);
 assert.equal(after.youOfficerDistinctMovingStem, undefined);
 assert.deepEqual(before.youOfficerContext.exposureReview.filter(row => row.stem === '庚')
  .map(row => [row.position, row.pillar, row.combiningColumns]), [['hour', '庚午', []], ['decadal', '庚子', []]]);
 assert.ok(before.youOfficerContext.rootReview.filter(row => row.exactStem).every(row => !row.opposingColumns.length));
 assert.deepEqual(after.youOfficerContext.nativeKillerExposures.map(row => [row.position, row.pillar]), [['hour', '庚午']]);
 assert.deepEqual(after.youOfficerContext.exposureReview.filter(row => row.stem === '辛').map(row => [row.position, row.pillar]),
  [['year', '辛酉'], ['decadal', '辛丑']]);
 assert.deepEqual(after.youOfficerContext.rootReview.filter(row => row.exactStem).map(row => [row.position, row.branch, row.opposingColumns.length]),
  [['year', '酉', 0], ['month', '酉', 0], ['decadal', '丑', 0]]);
 const result = match(run, 68);
 assert.equal(result.status, 'matched');
 assert.equal(result.matchedSourceExcerpt, '逢庚辛');
 const { startInstant, endInstantExclusive } = run.time.displayWindow.instantRange;
 assert.deepEqual(result.windows, [{ start: startInstant, endExclusive: endInstantExclusive }]);
 const geng = result.confirmedBranches.find(branch => branch.sourceFactIds.includes(beforeFact.factId));
 const xin = result.confirmedBranches.find(branch => branch.sourceFactIds.includes(afterFact.factId));
 assert.equal(geng.windows.at(-1).endExclusive, boundary);
 assert.equal(xin.windows[0].start, boundary);
 assert.match(geng.conditions.join(''), /实际运干再见原有的庚/u);
 assert.match(xin.conditions.join(''), /实际运干再见辛/u);
 assert.equal(match(run, 70).status, 'not_matched');
 const { input } = modelContext(run);
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /实际运干再见辛.*本步重见辛/u);
 assert.match(prompt, /实际运干再见原有的庚/u);
 assert.doesNotMatch(prompt, /运干庚以七杀新到|為混煞重官|youOfficerRepeatedXinWithNatalGeng|youOfficerRepeatedGengWithNatalXin/u);
 assert.equal(ctx(native(['辛酉', '丁酉', '甲辰', '庚午']), '辛丑', false).youOfficerRepeatedXinWithNatalGeng, undefined);
 assert.equal(ctx(native(['辛酉', '丁酉', '甲辰', '庚午']), '庚子', false).youOfficerRepeatedGengWithNatalXin, undefined);
});

test('p027 confirms the printed strong officer in the same Geng-Shen stage only on the source chart', async () => {
 const sourcePhrase = /徐注据甲日酉月的刘例见月辛通根/u;
 const branchPhrase = /实排运支见申酉/u, stemPhrase = /实排运干见庚辛/u;
 const provider = createFortuneDeepSeek({ apiKey: 'test-key', transport: async (_, options) => {
  const content = JSON.parse(options.body).messages[1].content;
  assert.match(content, sourcePhrase);
  assert.match(content, branchPhrase);
  assert.match(content, stemPhrase);
  assert.doesNotMatch(content, /liuSourceOfficerStrong|liuSourceOfficerStrength/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 for (const [hour, hourPillar, strong] of [[4, '丙寅', true], [2, '乙丑', false]]) {
  const run = submitted([1943, 9, 23], hour, 1949);
  const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '庚申');
  assert.ok(fact);
  const p = fact.normalizedPayload;
  assert.equal(p.natalPillarSequence, '癸未辛酉甲申' + hourPillar);
  assert.deepEqual(p.youOfficerRoutes, ['branch-root', 'geng-killer']);
  assert.equal(p.liuSourceOfficerStrong, strong);
  assert.equal(p.youOfficerUnopposedShenRoot, false);
  assert.equal(p.youOfficerDistinctMovingStem, undefined);
  const evidence = p.youOfficerContext.liuSourceOfficerStrength;
  if (strong) {
   assert.deepEqual([evidence.monthOfficer.stem, evidence.officerStem.stem, evidence.fireStem.stem], ['辛', '辛', '丙']);
   assert.deepEqual(evidence.stemJoin.members, ['month', 'hour']);
   assert.deepEqual([evidence.between.position, evidence.between.pillar, evidence.between.stem], ['day', '甲申', '甲']);
   assert.deepEqual([evidence.dayMetal.position, evidence.dayMetal.stem, evidence.hourFire.position, evidence.hourFire.stem],
    ['day', '庚', 'hour', '丙']);
  } else assert.equal(evidence, undefined);
  const matches = matchFortuneKnowledge(run).byMethod.bazi;
  for (const index of [67, 68]) assert.equal(matches[index].status, strong ? 'not_matched' : 'partial');
  const hit = matches[69];
  assert.equal(hit.status, strong ? 'matched' : 'partial');
  assert.ok(hit.sourceFactIds.includes(fact.factId));
  assert.equal(matches[70].status, 'not_matched');
  const { input } = modelContext(run);
  const findings = input.sections.flatMap(section => section.findings);
  assert.equal(findings.some(row => row.knowledgeId === hit.knowledgeId), strong);
  assert.equal(sourcePhrase.test(formatFortunePrompt(input)), strong);
  if (strong) {
   assert.equal(hit.matchedSourceExcerpt, '申酉\n庚辛');
   assert.deepEqual(hit.confirmedBranches.map(row => row.sourceFactIds.includes(fact.factId)), [true, true]);
   const audit = formatFortuneFactAudit(input);
   assert.match(audit, /原评仍取官旺通根/u);
   assert.match(audit, /月辛与时丙中隔日甲.*《造化元钥评注》按隔位不合/u);
   await provider.interpret(input);
  }
 }
 const stemOnly = submitted([1943, 9, 23], 4, 2038);
 const boundary = stemOnly.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '辛亥')?.exactInstant;
 assert.ok(boundary);
 const before = rows(stemOnly).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '壬子');
 const after = rows(stemOnly).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '辛亥');
 assert.ok(before && after);
 assert.deepEqual(before.normalizedPayload.youOfficerRoutes, []);
 assert.deepEqual(after.normalizedPayload.youOfficerRoutes, ['xin-repeat']);
 const hit = match(stemOnly, 69);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '庚辛');
 assert.equal(hit.windows[0].start, boundary);
 assert.ok(hit.sourceFactIds.includes(after.factId));
 assert.ok(!hit.sourceFactIds.includes(before.factId));
 const prompt = formatFortunePrompt(modelContext(stemOnly).input);
 assert.match(prompt, stemPhrase);
 assert.doesNotMatch(prompt, branchPhrase);
 const unknown = ctx(native(['癸未', '辛酉', '甲申', '丙寅']), '庚申', false);
 assert.equal(unknown.liuSourceOfficerStrong, undefined);
});

test('p028 binds first Xin exposure to natal month You and retains the natal Geng separately', () => {
 const example = ref.calendarExamples[70];
 const run = submitted(example.date, example.hour, 2010, example.gender);
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '辛巳');
 assert.ok(change);
 const result = match(run, 70);
 assert.equal(result.status, 'partial');
 assert.equal(result.windows[0].start, change.exactInstant);
 assert.equal(match(run, 68).status, 'not_matched');
 assert.equal(match(run, 69).status, 'partial');
 const { input } = modelContext(run);
 const xin = input.facts.find(fact => fact.type === 'zpqz_month_command' && fact.data.luckPillar === '辛巳');
 assert.deepEqual(xin.data.youOfficerContext.newExposureSeats.map(row => [row.position, row.pillar, row.stem]), [['month', '乙酉', '辛']]);
 assert.deepEqual(xin.data.youOfficerContext.nativeKillerExposures.map(row => [row.position, row.pillar]), [['year', '庚申']]);
 assert.equal(rows(run).find(row => row.normalizedPayload.luckPillar === '辛巳').normalizedPayload.xinFirstExposureUnopposed, false);
 assert.equal(xin.data.youOfficerContext.branchRoot, undefined);
 assert.match(formatFortuneFactAudit(input), /本步大运辛巳的运干辛使原局藏辛首次透出.*月柱乙酉/u);
 assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== result.knowledgeId)));
});

test('p028 confirms first Xin exposure only after the verified Xin-Hai stage begins', () => {
 const run = submitted([1992, 9, 15], 2, 2010, 1);
 const boundary = '2010-06-19T00:00:00.000Z';
 const previous = rows(run).find(row => row.activeTo === boundary);
 const current = rows(run).find(row => row.activeFrom === boundary);
 assert.equal(previous.normalizedPayload.luckPillar, '庚戌');
 assert.equal(previous.normalizedPayload.xinFirstExposureUnopposed, false);
 const p = current.normalizedPayload;
 assert.equal(p.luckPillar, '辛亥');
 assert.equal(p.natalPillarSequence, '壬申己酉甲午乙丑');
 assert.equal(p.xinFirstExposureUnopposed, true);
 assert.deepEqual(p.youOfficerContext.newExposureSeats.map(({ position, stem }) => [position, stem]), [['month', '辛'], ['hour', '辛']]);
 const result = match(run, 70);
 assert.equal(result.status, 'matched');
 assert.equal(result.matchedSourceExcerpt, '運逢辛');
 assert.deepEqual(result.windows, [{ start: boundary, endExclusive: current.activeTo }]);
 const { input } = modelContext(run);
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /实际运干首次见辛.*需另核原评的官弱和透清发用/u);
 assert.doesNotMatch(prompt, /為官星透清，非重官也|xinFirstExposureUnopposed/u);
 assert.equal(ctx(native(['壬申', '己酉', '甲午', '乙丑']), '辛亥', false).xinFirstExposureUnopposed, undefined);
});

test('p028 binds the two printed first-Xin cases to their original roles and real transitions', () => {
 for (const [date, year, beforeLuck, afterLuck, boundary, natal, source, phrase] of [
  [[1895, 9, 14], 1927, '壬午', '辛巳', '1927-09-11T22:00:00.000Z', ['乙未', '乙酉', '甲子', '丁卯'],
   'taishou-use-officer', /太守原图以月令官制刃/u],
  [[1946, 10, 7], 1977, '庚子', '辛丑', '1977-06-04T06:00:00.000Z', ['丙戌', '丁酉', '甲寅', '丁卯'],
   'xiaolian-officer-overcontrolled', /孝廉原图指出丙丁并透、原官受制/u],
 ]) {
  const run = submitted(date, 6, year);
  const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === beforeLuck);
  const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === afterLuck);
  assert.ok(before && after);
  const p = after.normalizedPayload, evidence = p.youOfficerContext.namedFirstXinEvidence;
  assert.equal(p.natalPillarSequence, natal.join(''));
  assert.equal(before.normalizedPayload.youOfficerNamedFirstXin, undefined);
  assert.equal(p.youOfficerNamedFirstXin, source);
  assert.equal(p.xinFirstExposureUnopposed, false);
  assert.equal(p.youOfficerSourceBenefitsMetal, true);
  assert.deepEqual(p.youOfficerContext.rootClashes.map(pair => pair.map(row => row.position)), [['month', 'hour']]);
  if (source === 'taishou-use-officer') {
   assert.deepEqual([evidence.daySeal.position, evidence.daySeal.stem], ['day', '癸']);
   assert.equal(evidence.movingJoin, undefined);
  } else {
   assert.deepEqual(evidence.movingJoin.members, ['year', 'decadal']);
   assert.equal(evidence.movingOfficerRoot.exactStem, true);
   assert.deepEqual(evidence.natalFire.map(row => [row.position, row.stem]), [['year', '丙'], ['month', '丁'], ['hour', '丁']]);
   const prior = before.normalizedPayload;
   assert.equal(prior.youOfficerSourceBenefitsMetal, true);
   assert.deepEqual(prior.youOfficerRoutes, ['geng-killer']);
   const compared = prior.youOfficerContext.xiaolianSourceMetalWater;
   assert.deepEqual([compared.officer.stem, compared.movingMetal.stem, compared.movingWater.stem, compared.movingWater.god],
    ['辛', '庚', '癸', '正印']);
   assert.deepEqual(compared.nativeFire.map(row => [row.position, row.stem]), [['year', '丙'], ['month', '丁'], ['hour', '丁']]);
   assert.equal(match(run, 69).status, 'not_matched');
   const alternate = submitted(date, 8, year);
   const ordinary = rows(alternate).find(row => row.normalizedPayload.luckPillar === '庚子');
   assert.ok(ordinary && ordinary.normalizedPayload.natalPillarSequence === '丙戌丁酉甲寅戊辰');
   assert.equal(ordinary.normalizedPayload.youOfficerSourceBenefitsMetal, false);
   assert.equal(ordinary.normalizedPayload.youOfficerContext.xiaolianSourceMetalWater, undefined);
   const strongCandidate = match(alternate, 69);
   assert.equal(strongCandidate.status, 'partial');
   assert.ok(strongCandidate.sourceFactIds.includes(ordinary.factId));
  }
  const hit = match(run, 70);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '運逢辛');
  assert.equal(hit.windows[0].start, boundary);
  assert.ok(hit.sourceFactIds.includes(after.factId) && !hit.sourceFactIds.includes(before.factId));
  assert.ok(!match(run, 69).sourceFactIds.includes(after.factId));
  const prompt = formatFortunePrompt(modelContext(run).input);
  assert.match(prompt, phrase);
  assert.doesNotMatch(prompt, /為官星透清，非重官也|youOfficerNamedFirstXin/u);
  assert.equal(ctx(native([...natal.slice(0, 3), '戊辰']), afterLuck).youOfficerNamedFirstXin, undefined);
  assert.equal(ctx(native(natal), afterLuck, false).youOfficerSourceBenefitsMetal, undefined);
 }
 const gengRun = submitted([1895, 9, 14], 6, 1937);
 const geng = rows(gengRun).find(row => row.activeFrom === '1937-09-11T22:00:00.000Z' && row.normalizedPayload.luckPillar === '庚辰');
 assert.equal(geng.normalizedPayload.youOfficerNamedFirstXin, undefined);
 assert.equal(geng.normalizedPayload.youOfficerSourceBenefitsMetal, true);
 const comparison = geng.normalizedPayload.youOfficerContext;
 assert.equal(comparison.taishouSourceDaySeal.stem, '癸');
 assert.deepEqual(comparison.exposureReview.find(row => row.position === 'decadal').combiningColumns.map(row => row.position), ['year', 'month']);
 assert.equal(match(gengRun, 69).status, 'not_matched');
});

test('Jia-You officer roots preserve the natal metal storehouse and residual qi at their own opposing positions', () => {
 const run = submitted([1994, 9, 15], 2, 2007, 0);
 const hit = match(run, 70);
 assert.equal(hit.status, 'partial');
 const fact = rows(run).find(row => hit.sourceFactIds.includes(row.factId) && row.normalizedPayload.luckPillar === '辛未');
 assert.equal(fact.normalizedPayload.xinFirstExposureUnopposed, false);
 const { rootReview, exposureReview } = fact.normalizedPayload.youOfficerContext;
 assert.deepEqual(rootReview.map(row => [row.position, row.pillar, row.seat, row.exactStem, row.stems,
  row.opposingColumns.map(other => [other.position, other.pillar])]), [
  ['year', '甲戌', 'metal-residual', true, ['辛'], [['day', '甲辰']]],
  ['month', '癸酉', 'xin-you-lu', true, ['辛'], []],
  ['hour', '乙丑', 'metal-storehouse', true, ['辛'], [['decadal', '辛未']]],
 ]);
 assert.deepEqual(fact.normalizedPayload.youOfficerContext.rootClashes, []);
 assert.deepEqual(exposureReview.map(row => [row.position, row.stem, row.god]), [['decadal', '辛', '正官']]);
});

test('first Xin exposure distinguishes each actual stem combination from repeating a pre-existing officer', () => {
 const run = submitted([1970, 9, 11], 4, 2003, 0);
 const hit = match(run, 70);
 assert.equal(hit.status, 'partial');
 assert.equal(match(run, 68).status, 'not_matched');
 const fact = rows(run).find(row => hit.sourceFactIds.includes(row.factId) && row.normalizedPayload.luckPillar === '辛巳');
 const { exposureReview } = fact.normalizedPayload.youOfficerContext;
 assert.deepEqual(exposureReview.map(row => [row.position, row.stem, row.god,
  row.combiningColumns.map(other => [other.position, other.stem])]), [
  ['year', '庚', '七杀', [['month', '乙']]],
  ['decadal', '辛', '正官', [['hour', '丙']]],
 ]);
 assert.equal(fact.normalizedPayload.youOfficerContext.movingStem.route, 'xin-new-exposure');
 assert.deepEqual(fact.normalizedPayload.youOfficerContext.metalFormations, []);
 assert.equal(fact.normalizedPayload.strengthVerified, false);
 assert.ok(modelContext(run).input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
});

test('p027 and p028 keep the two official-source charts and an ordinary first Xin exposure separate', async () => {
 const date = [1950, 9, 26];
 for (const {hour, hourPillar, year, source, official} of [
  {hour: 6, hourPillar: '丁卯', year: 2005, source: false, official: true},
  {hour: 8, hourPillar: '戊辰', year: 2005, source: true},
  {hour: 10, hourPillar: '己巳', year: 2004, source: false},
 ]) {
  const run = submitted(date, hour, year);
  const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '辛卯');
  assert.ok(change);
  const before = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '庚寅');
  const arrived = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '辛卯');
  assert.ok(before && arrived);
  const p = arrived.normalizedPayload;
  assert.equal(p.natalPillarSequence, '庚寅乙酉甲子' + hourPillar);
  assert.equal(p.xinExposed, false);
  assert.deepEqual(p.youOfficerRoutes, ['xin-new-exposure']);
  assert.deepEqual(p.youOfficerContext.newExposureSeats.map(row => [row.position, row.stem]), [['month', '辛']]);
  assert.ok(p.youOfficerContext.rootClashes.some(rows => rows.map(row => row.position).join() === 'month,decadal'));
  assert.equal(p.xinFirstExposureUnopposed, false);
  for (const fact of [before, arrived]) assert.equal(fact.normalizedPayload.youOfficerSourceBenefitsMetal, Boolean(official));
  assert.equal(before.normalizedPayload.youOfficerSourceExcludesNewClearExposure, false);
  assert.equal(p.youOfficerSourceExcludesNewClearExposure, source);
  const comparison = p.youOfficerContext.liSourceXinExposureComparison;
  const canzheng = p.youOfficerContext.canzhengSourceOfficer;
  const {input} = modelContext(run);
  const audit = formatFortuneFactAudit(input);
  const label = /李参政原评仍取印，实际辛卯的卯冲本命月酉/u;
  if (source) {
   assert.deepEqual([comparison.natalKiller.position, comparison.natalKiller.stem, comparison.partner.position, comparison.partner.stem],
    ['year', '庚', 'month', '乙']);
   assert.deepEqual(comparison.join.members, ['year', 'month']);
   assert.deepEqual(comparison.natalSeals.map(row => [row.position, row.branch, row.stem]), [['day', '子', '癸'], ['hour', '辰', '癸']]);
   assert.deepEqual(comparison.monthClash.members, ['month', 'decadal']);
   assert.match(audit, label);
   const provider = createFortuneDeepSeek({apiKey: 'fixture', transport: async (_, options) => {
    const message = JSON.parse(options.body).messages[1].content;
    assert.doesNotMatch(message, /李参政原评仍取印|liSourceXinExposureComparison|youOfficerSourceExcludesNewClearExposure/u);
    return Response.json({choices: [{finish_reason: 'stop', message: {content: '{"sections":[]}'}}]});
   }});
   await provider.interpret(input);
  } else {
   assert.equal(comparison, undefined);
   assert.doesNotMatch(audit, label);
  }
  if (official) {
   assert.equal(change.exactInstant, '2005-01-19T04:00:00.000Z');
   assert.equal(p.youOfficerNamedFirstXin, 'canzheng-officer-killer-favourable');
   assert.deepEqual([canzheng.natalKiller.pillar, canzheng.partner.pillar, canzheng.hourHurt.pillar], ['庚寅', '乙酉', '丁卯']);
   assert.deepEqual(canzheng.join.members, ['year', 'month']);
   assert.deepEqual(canzheng.monthClashes.map(pair => pair.members), [['month', 'hour'], ['month', 'decadal']]);
   assert.deepEqual(before.normalizedPayload.youOfficerContext.canzhengSourceOfficer.movingJoin.members, ['month', 'decadal']);
   const prompt = formatFortunePrompt(input);
   assert.match(prompt, /原评概括宜官杀运.*未单独点名辛卯/su);
   assert.doesNotMatch(prompt, /為官星透清，非重官也|canzhengSourceOfficer/u);
  } else {
   assert.equal(canzheng, undefined);
   assert.equal(p.youOfficerNamedFirstXin, undefined);
  }
  const first = match(run, 70);
  assert.equal(first.status, official ? 'matched' : source ? 'not_matched' : 'partial');
  assert.equal(first.sourceFactIds.includes(arrived.factId), !source);
  if (!source) assert.equal(first.windows[0].start, change.exactInstant);
  assert.equal(match(run, 68).status, 'not_matched');
  assert.ok([before, arrived].every(row => match(run, 69).sourceFactIds.includes(row.factId) !== Boolean(official)));
 }
 assert.equal(ctx(native(['庚寅', '乙酉', '甲子', '戊辰']), '辛卯', false).youOfficerSourceExcludesNewClearExposure, undefined);
});

test('Jia-You officer separates native metal formations from those supplied by the actual luck branch', () => {
 const sameDate = [1970, 9, 11];
 const examples = [
  { date: sameDate, hour: 0, year: 1972, gender: 0, luck: '甲申', index: 69,
   kind: '三会', branches: '申酉戌', nativeComplete: false, columns: [['decadal'], ['month'], ['year']] },
  { date: sameDate, hour: 16, year: 1972, gender: 0, luck: '甲申', index: 69,
   kind: '三会', branches: '申酉戌', nativeComplete: true, columns: [['hour', 'decadal'], ['month'], ['year']] },
  { date: sameDate, hour: 2, year: 2003, gender: 0, luck: '辛巳', index: 70,
   kind: '三合', branches: '巳酉丑', nativeComplete: false, columns: [['decadal'], ['month'], ['hour']] },
  { date: [1973, 9, 15], hour: 10, year: 1977, gender: 1, luck: '庚申', index: 67,
   kind: '三合', branches: '巳酉丑', nativeComplete: true, columns: [['hour'], ['month'], ['year']] },
 ];
 for (const example of examples) {
  const run = submitted(example.date, example.hour, example.year, example.gender);
  const result = match(run, example.index);
  assert.equal(result.status, 'partial');
  const fact = rows(run).find(row => result.sourceFactIds.includes(row.factId) && row.normalizedPayload.luckPillar === example.luck);
  assert.ok(fact, example.luck);
  const { youOfficerContext: context, strengthVerified } = fact.normalizedPayload;
  assert.equal(context.monthOfficer.stem, '辛');
  assert.equal(strengthVerified, false);
  assert.deepEqual(context.metalFormations.map(group => [group.kind, group.branches, group.nativeComplete,
   group.members.map(rows => rows.map(row => row.position))]),
  [[example.kind, example.branches, example.nativeComplete, example.columns]]);
  assert.ok(context.natalContacts.some(({ source, relation }) => relation === '生' && ['戊', '己'].includes(source.stem)));
  assert.ok(context.natalContacts.some(({ source, relation }) => relation === '克'
   && source.position === 'day' && source.kind === '支藏' && ['丙', '丁'].includes(source.stem)));
  assert.ok(context.natalContacts.every(({ source, relation }) => source.position !== 'decadal'
   && (relation === '生' ? ['正财', '偏财'] : ['食神', '伤官']).includes(source.god)));
  const { input } = modelContext(run);
  assert.ok(input.facts.some(row => row.type === 'zpqz_month_command' && row.data.luckPillar === example.luck
   && row.data.youOfficerContext?.metalFormations[0]?.nativeComplete === example.nativeComplete));
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== result.knowledgeId)));
 }
});

test('source hashes, the verified wealth bridge step and remaining prerequisites survive SQLite import',()=>{
 for(const i of indices){const r=fortuneKnowledge.bazi.rules[i],e=fortuneKnowledge.bazi.entries.find(e=>e.id===r.knowledgeId);assert.equal(r.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:e.evidence,conditions:e.conditions})).digest('hex'));assert.equal(r.queries.length,1);assert.equal(r.queries[0].factType,'zpqz_month_command');assert.equal(r.unresolved.length,completeSourceIndices.has(i)?0:1);}
});

test('actual provider user message is natural Chinese and preserves the actual month, hidden roots and conflicting original case contexts',async()=>{
 const run=real(59),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'month-private-report'));assert.ok(input.facts.some(f=>f.type==='zpqz_month_command'));const prompt=formatFortuneFactAudit(input);
 for(const text of ['本命月支申','原局透干和支藏均未见火','运干不是火、运支为巳午','原图按年、月、日、时分别为庚子、甲申、庚子、甲申','两种评语分别保留','不自行拆成干支各管五年'])assert.ok(prompt.includes(text),text);
 for(const secret of ['zpqz-month-command','month-private','monthLuJieCandidate','xinNewlyExposedByLuck','fireMovementCandidate','stageStart','godWitnesses'])assert.ok(!prompt.includes(secret),secret);
 const d=describeFortuneFact({method:'bazi',type:'zpqz_month_command',data:ctx()},String);assert.ok(!/[{}\[\]]/u.test(d));
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await provider.interpret(input);
});

test('the wealth bridge uses the monthly peer, native output and actual moving wealth together on both SQLite rules', () => {
 for (const index of [53, 145]) {
  const run = real(index), luck = ref.calendarExamples[index].luck;
  const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === luck);
  const { wealthBridgeCandidate, wealthBridge } = fact.normalizedPayload;
  assert.equal(wealthBridgeCandidate, true);
  assert.ok(wealthBridge.monthPeers.every(row => row.position === 'month' && ['比肩', '劫财'].includes(row.tenGod)));
  assert.ok(wealthBridge.natalOutputs.every(row => layers.includes(row.position) && ['食神', '伤官'].includes(row.god)));
  assert.ok(wealthBridge.luckWealth.every(row => ['运干', '运支首藏'].includes(row.kind) && ['正财', '偏财'].includes(row.god)));
  assert.match(formatFortuneFactAudit(modelContext(run).input), /食伤生财的位置对照/u);
  const isolated = structuredClone(run);
  const guard = index === 53 ? 'wealthBridgeCandidate' : 'bladeWealthMatched';
  for (const row of rows(isolated)) row.normalizedPayload[guard] = false;
  assert.equal(match(isolated, index).status, 'not_matched');
 }
 const noOutput = native(['乙亥', '己卯', '甲子', '乙亥']);
 const p = ctx(noOutput, '丁丑');
 assert.equal(p.luckTenGod, '伤官');
 assert.equal(p.luckBranchMainQiGod, '正财');
 assert.equal(p.wealthBridgeCandidate, false);
 assert.equal(ctx(noOutput, '丁丑', false).wealthBridgeCandidate, undefined);
 const guard = evaluateFortuneRules('bazi', 'year', [candidate(noOutput, '甲寅')])
  .find(row => row.knowledgeId === fortuneKnowledge.bazi.rules[52].knowledgeId);
 assert.equal(guard.required[0].hits.length, 0);
});

test('reviewed original movements keep their sources and SQLite excludes documented counterexamples', () => {
 const examples = [
  [51, '己酉丙子壬申丙午', ['庚午']],
  [52, '辛丑甲午丙申壬辰', ['癸巳', '壬辰', '辛卯', '庚寅', '己丑', '戊子']],
  [59, '庚子甲申庚子甲申', ['丙戌', '丁亥']],
  [62, '庚戌戊子癸酉癸亥', ['庚寅', '辛卯'], ['庚寅', '辛卯']],
  [62, '丁酉丙午丁巳壬寅', ['己亥', '戊戌'], ['己亥']],
  [146, '辛丑庚寅甲辰乙亥', ['丁亥', '丙戌', '甲申']],
  [146, '辛亥庚寅甲申丙寅', ['戊子', '丁亥', '丙戌']],
  [148, '甲子丙寅甲子丙寅', ['庚午', '辛未', '壬申'], ['庚午', '辛未', '壬申']],
  [148, '癸卯庚申庚子庚辰', ['己未', '戊午', '丁巳', '丙辰'], ['戊午', '丁巳', '丙辰']],
 ];
 for (const [index, sequence, stages, counterexamples = []] of examples) {
  const natal = native(sequence.match(/.{2}/gu));
  const rule = fortuneKnowledge.bazi.rules[index];
  const reading = rule.review.printedLuck.find(row => row.natalPillarSequence === sequence);
  assert.deepEqual(reading.periods.flatMap(row => row.pillars), stages);
  const valid = stages.map(luck => candidate(natal, luck));
  const inputs = [...valid, candidate(natal, stages[0], false), candidate(natal, stages[0], true, false)];
  if (index === gaoSourceIndex) inputs.push(candidate(natal, '庚午'), candidate({ ...natal, hour: '乙酉' }, stages[0]));
  const result = evaluateFortuneRules('bazi', 'year', inputs).find(row => row.knowledgeId === rule.knowledgeId);
  assert.deepEqual(result.required[0].hits.map(row => row.normalizedPayload.luckPillar),
   stages.filter(stage => !counterexamples.includes(stage)), sequence);
  assert.ok(result.required[0].hits.every(row => valid.includes(row)), sequence);
  assert.equal(result.unresolved.length === 0, completeSourceIndices.has(index));
 }
 assert.equal(examples.reduce((count, entry) => count + entry[2].length, 0), 26);
});

test('verified client facts preserve eight original diagrams and both readings at overlapping civil-year transitions', () => {
 const examples = [
  [51, [1969, 12, 23], 12, 2028, '庚午', '火财助官'],
  [52, [1961, 7, 2], 8, 2020, '戊子', '子支冲本命午刃', '己丑'],
  [59, [2020, 8, 25], 16, 2044, '丁亥', '亥支藏水分开记录', '丙戌'],
  [62, [1970, 12, 19], 22, 1999, '辛卯', '寅卯支的甲乙食伤', undefined, true],
  [146, [2021, 2, 25], 22, 2058, '丙戌', '丁丙食伤制杀', '丁亥'],
  [146, [1971, 2, 28], 4, 1992, '戊子', '子支癸印'],
  [148, [1924, 2, 15], 4, 1984, '壬申', '对壬印、申杀的反向提醒', undefined, true],
  [148, [1963, 8, 25], 8, 2002, '丙辰', '辰支首藏戊印与运干丙杀火运', undefined, true],
 ];
 for (const [index, date, hour, year, stage, clause, previous, counterexample = false] of examples) {
  const run = submitted(date, hour, year);
  const { input, knowledge } = modelContext(run);
  const result = knowledge.byMethod.bazi[index];
  const expectedStatus = counterexample && !previous ? 'not_matched'
   : completeSourceIndices.has(index) || [51, 52].includes(index) ? 'matched' : 'partial';
  assert.equal(result.status, expectedStatus, stage);
  assert.equal(rows(run).some(row => row.normalizedPayload.luckPillar === stage && result.sourceFactIds.includes(row.factId)),
   !counterexample, stage);
  const annotated = input.facts.filter(fact => fact.type === 'zpqz_month_command' && fact.data.printedLuck?.length);
  const active = annotated.find(row => row.data.luckPillar === stage);
  assert.ok(active, stage);
  const prompt = formatFortuneFactAudit(input);
  assert.ok(prompt.includes(clause), stage);
  assert.ok(!prompt.includes('natalPillarSequence') && !prompt.includes('printedLuck') && !prompt.includes('wealthBridge'));
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId);
  assert.equal(Boolean(finding), expectedStatus === 'matched');
  if (index === gaoSourceIndex) {
   assert.deepEqual(finding.windows, result.windows);
   assert.match(finding.note, /逆行水木火/u);
   assert.match(finding.note, /火运.{0,8}不相宜/u);
   assert.ok(rows(run).some(row => row.normalizedPayload.luckPillar === previous && result.sourceFactIds.includes(row.factId)));
  }
  if (previous) {
   const before = annotated.find(row => row.data.luckPillar === previous);
   assert.ok(before);
   assert.equal(before.endExclusive, active.start);
  }
 }
});

test('the second officer-killer original requires the same hour even with the same exposed gods and Wu-Zi luck', () => {
 const run = submitted([1971, 2, 28], 6, 1992);
 const fact = rows(run).find(row => row.normalizedPayload.exposedOfficerAndKiller && row.normalizedPayload.confirmed
  && row.normalizedPayload.luckPillar === '戊子');
 assert.ok(fact);
 assert.equal(fact.normalizedPayload.namedSealChecksFood, false);
 const route = fact.normalizedPayload.luJieAuthorityPaths.find(path => path.killer.stem === '庚' && path.officer.stem === '辛');
 assert.ok(route?.sealsCheckingOutput.some(row => row.output.stem === '丁' && row.output.position === 'hour' && row.seal.stem === '癸'));
 assert.ok(route.wealthFeedsKiller.some(row => row.stem === '戊' && row.kind === '运干'));
 assert.ok(route.wealthFeedsOfficer.some(row => row.stem === '戊' && row.kind === '运干'));
 assert.ok(match(run, 146).sourceFactIds.includes(fact.factId));
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.ok(prompt.includes('运支首藏癸正印克原局制杀之时柱明透丁伤官'));
 assert.ok(!prompt.includes('禄格食制杀原例的戊子运'));
});

test('p103 binds the monthly blade, original output, rooted natal wealth and the actual arriving wealth in one path', () => {
 const run = submitted([1884, 12, 18], 22, 1933);
 const result = match(run, 145);
 const fact = rows(run).find(row => row.normalizedPayload.luckPillar === '辛巳' && result.sourceFactIds.includes(row.factId));
 assert.equal(result.status, 'matched');
 assert.ok(fact);
 const payload = fact.normalizedPayload;
 assert.equal(payload.natalPillarSequence, '甲申丙子壬寅辛亥');
 const path = payload.bladeWealthPaths.find(row => row.peer.stem === '癸' && row.peer.position === 'month'
  && row.output.stem === '甲' && row.output.position === 'day' && row.output.kind === '支藏'
  && row.wealth.position === 'month' && row.wealth.stem === '丙' && row.wealth.kind === '明透');
 assert.ok(path);
 assert.ok(path.rootPositions.some(root => root.position === 'day' && root.exactStem && root.stems.includes('丙')));
 assert.ok(path.rootPositions.every(root => root.position !== 'decadal'));
 assert.deepEqual(path.movingWealth, { stem: '丙', god: '偏财', kind: '运支首藏' });
 const { input: report } = modelContext(run);
 const prompt = formatFortuneFactAudit(report);
 assert.ok(prompt.includes('原财的原局根位为') && prompt.includes('运支首藏丙偏财'));
 assert.ok(!prompt.includes('bladeWealthPaths'));
 assert.match(formatFortunePrompt(report), /壬日原图依徐注取食伤通关/u);

 const rootless = submitted([1980, 10, 4], 0, 2022);
 const change = rootless.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '庚寅');
 assert.ok(change);
 const before = rows(rootless).find(row => row.normalizedPayload.luckPillar === '己丑' && row.activeTo === change.exactInstant);
 const contrast = rows(rootless).find(row => row.normalizedPayload.luckPillar === '庚寅' && row.activeFrom === change.exactInstant);
 assert.deepEqual(before.normalizedPayload.bladeWealthPaths, []);
 assert.ok(contrast?.normalizedPayload.wealthBridgeCandidate);
 assert.ok(contrast.normalizedPayload.godWitnesses.some(row => row.god === '正财' && row.exposed));
 assert.ok(contrast.normalizedPayload.bladeWealthPaths.some(row => row.peer.stem === '辛' && row.output.stem === '壬'
  && row.wealth.stem === '乙' && row.movingWealth.stem === '甲' && row.rootPositions.length === 0));
 assert.equal(contrast.normalizedPayload.bladeWealthMatched, false);
 const hit = match(rootless, 145);
 assert.equal(hit.status, 'not_matched');
 assert.deepEqual(hit.windows, []);
 assert.ok(!hit.sourceFactIds.includes(contrast.factId));
 const { input } = modelContext(rootless);
 assert.match(formatFortuneFactAudit(input), /原财缺《论阳刃》所需的本命根/u);
 assert.doesNotMatch(formatFortunePrompt(input), /原财缺《论阳刃》所需的本命根|bladeWealthMatched/u);
});

test('p103 retains the exact blade wealth chain when the arriving Ding becomes secondary qi after Ren-Wu', () => {
 const run = submitted([1884, 12, 18], 22, 1950);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸未');
 assert.ok(change);
 const previous = rows(run).find(row => row.normalizedPayload.luckPillar === '壬午' && row.activeTo === change.exactInstant);
 const current = rows(run).find(row => row.normalizedPayload.luckPillar === '癸未' && row.activeFrom === change.exactInstant);
 assert.ok(previous && current);
 const chain = fact => fact.normalizedPayload.bladeWealthPaths.find(path => path.peer.stem === '癸' && path.output.stem === '甲'
  && path.output.position === 'day' && path.wealth.stem === '丙' && path.wealth.position === 'month');
 assert.deepEqual(chain(previous).movingWealth, { stem: '丁', god: '正财', kind: '运支首藏' });
 assert.deepEqual(chain(current).movingWealth, { stem: '丁', god: '正财', kind: '运支余藏' });
 assert.equal(current.normalizedPayload.wealthBridgeCandidate, false);
 assert.ok(chain(current).rootPositions.some(root => root.position === 'day' && root.exactStem));
 const original = current.normalizedPayload.bladeWealthExample;
 assert.deepEqual(original.yinHai.members, ['day', 'hour']);
 assert.deepEqual(original.shenZiChen.map(row => [row.branch, row.positions]), [['申', ['year']], ['子', ['month']], ['辰', []]]);
 const hit = match(run, 145);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '陽刃用財，必須有食傷通關');
 assert.ok(hit.sourceFactIds.includes(previous.factId));
 assert.ok(!hit.sourceFactIds.includes(current.factId));
 assert.equal(hit.windows.at(-1).endExclusive, change.exactInstant);
 assert.equal(hit.candidateWindows[0].start, change.exactInstant);
 const { input } = modelContext(run);
 const cited = input.facts.filter(row => row.type === 'zpqz_month_command');
 assert.ok(cited.some(row => row.data.luckPillar === '壬午' && row.endExclusive === change.exactInstant));
 assert.ok(cited.some(row => row.data.luckPillar === '癸未' && row.start === change.exactInstant));
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('运支余藏丁正财') && prompt.includes('日寅与时亥六合'));
 assert.doesNotMatch(formatFortunePrompt(input), /运支余藏丁正财/u);
});

test('p103 excludes the printed Wu chart with only residual Xin when actual Ren wealth enters', async () => {
 const date = [2008, 6, 27];
 for (const {hour, hourPillar, excluded} of [
  {hour: 12, hourPillar: '戊午', excluded: true},
  {hour: 16, hourPillar: '庚申', excluded: false},
 ]) {
  const run = submitted(date, hour, 2041);
  const handoff = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '壬戌');
  assert.ok(handoff);
  const previous = rows(run).find(row => row.normalizedPayload.luckPillar === '辛酉' && row.activeTo === handoff.exactInstant);
  const arrived = rows(run).find(row => row.normalizedPayload.luckPillar === '壬戌' && row.activeFrom === handoff.exactInstant);
  assert.ok(previous && arrived);
  const proof = arrived.normalizedPayload;
  assert.equal(proof.natalPillarSequence, '戊子戊午戊戌' + hourPillar);
  assert.equal(previous.normalizedPayload.bladeWealthMatched, false);
  assert.equal(proof.bladeWealthMatched, true);
  assert.equal(proof.bladeWealthSourceExcludesBridge, excluded);
  assert.ok(proof.bladeWealthPaths.some(({output, wealth, movingWealth}) =>
   output.position === 'day' && output.stem === '辛' && wealth.position === 'year' && wealth.stem === '癸'
    && movingWealth.kind === '运干' && movingWealth.stem === '壬'));
  const result = match(run, 145);
  assert.equal(result.status, excluded ? 'not_matched' : 'partial');
  assert.equal(result.sourceFactIds.includes(arrived.factId), !excluded);
  assert.ok(!result.sourceFactIds.includes(previous.factId));
  const {input} = modelContext(run);
  const audit = formatFortuneFactAudit(input);
  const sourceText = /徐注戊土原例仅见日戌余辛，未按通关取用.*原注另提申，原图四支无申/u;
  if (excluded) {
   const {output, wealth, natalBranches} = proof.bladeWealthBridgeSourceComparison;
   assert.deepEqual([output.position, output.branch, output.stem, output.kind], ['day', '戌', '辛', '支藏']);
   assert.deepEqual([wealth.position, wealth.branch, wealth.stem], ['year', '子', '癸']);
   assert.deepEqual(natalBranches.map(row => row.branch), ['子', '午', '戌', '午']);
   assert.match(audit, sourceText);
   const provider = createFortuneDeepSeek({apiKey: 'test-key', transport: async (_, options) => {
    const message = JSON.parse(options.body).messages[1].content;
    assert.doesNotMatch(message, /徐注戊土原例|原图四支无申|bladeWealth(?:BridgeSourceComparison|SourceExcludesBridge)/u);
    return Response.json({choices: [{finish_reason: 'stop', message: {content: '{"sections":[]}'}}]});
   }});
   await provider.interpret(input);
  } else {
   assert.equal(proof.bladeWealthBridgeSourceComparison, undefined);
   assert.ok(proof.bladeWealthPaths.some(({output}) => output.position === 'hour' && output.stem === '庚' && output.kind === '明透'));
   assert.equal(result.windows[0].start, handoff.exactInstant);
   assert.doesNotMatch(audit, sourceText);
  }
 }
 const unknown = ctx(native(['戊子', '戊午', '戊戌', '戊午']), '壬戌', false);
 assert.equal(unknown.bladeWealthSourceExcludesBridge, undefined);
});

test('p104 keeps the actual combining and controlling stems on separate native positions', () => {
 const combination = submitted([2021, 2, 25], 22, 2058);
 const selection = match(combination, 146);
 const active = rows(combination).find(row => row.normalizedPayload.luckPillar === '丙戌' && selection.sourceFactIds.includes(row.factId));
 assert.equal(selection.status, 'matched');
 const pair = active?.normalizedPayload.luJieAuthorityPaths.find(path => path.killer.stem === '庚' && path.killer.position === 'month'
  && path.officer.stem === '辛' && path.officer.position === 'year');
 assert.ok(pair?.combinations.some(row => row.helper.stem === '乙' && row.helper.position === 'hour'));
 assert.ok(pair.outputLuck.some(row => row.stem === '丙' && row.kind === '运干'));
 assert.ok(pair.outputAlsoChecksOfficer.some(row => row.stem === '丙'));

 const controlled = submitted([1971, 2, 28], 4, 1992);
 const result = match(controlled, 146);
 const sealStage = rows(controlled).find(row => row.normalizedPayload.luckPillar === '戊子' && result.sourceFactIds.includes(row.factId));
 assert.equal(result.status, 'matched');
 assert.ok(sealStage?.normalizedPayload.namedSealChecksFood);
 const evidence = sealStage.normalizedPayload.luJieAuthorityPaths.find(path => path.killer.position === 'month' && path.killer.stem === '庚');
 assert.ok(evidence.killerRoots.some(root => root.position === 'day' && root.exactStem && root.stems.includes('庚')));
 assert.ok(evidence.sealsCheckingOutput.some(link => link.seal.stem === '癸' && link.seal.kind === '运支首藏'
  && link.output.stem === '丙' && link.output.position === 'hour' && link.output.kind === '明透'));

 const firstDiagram = submitted([2021, 2, 25], 22, 2040);
 const sealFact = rows(firstDiagram).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '戊子');
 const firstPath = sealFact.normalizedPayload.luJieAuthorityPaths.find(path => path.killer.position === 'month' && path.killer.stem === '庚');
 assert.ok(firstPath.combinations.some(row => row.helper.position === 'hour' && row.helper.stem === '乙'));
 assert.deepEqual(firstPath.sealsSupportingDay, [{ stem: '癸', god: '正印', kind: '运支首藏' }]);
 const firstHit = match(firstDiagram, luJieAuthorityIndex);
 assert.equal(firstHit.status, 'matched');
 assert.ok(firstHit.sourceFactIds.includes(sealFact.factId));
 const { input } = modelContext(firstDiagram);
 assert.deepEqual(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === firstHit.knowledgeId)?.windows, firstHit.windows);
 assert.match(formatFortuneFactAudit(input), /运印运支首藏癸正印生同一甲日元/u);

 const untreated = submitted([1891, 3, 30], 8, 1931);
 const generic = rows(untreated).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '丁亥');
 assert.ok(generic?.normalizedPayload.atLu && generic.normalizedPayload.exposedOfficerAndKiller);
 assert.equal(generic.normalizedPayload.luckTenGod, '食神');
 assert.deepEqual(generic.normalizedPayload.luJieAuthorityPaths, []);
 assert.equal(match(untreated, 146).status, 'not_matched');
 const untreatedSeal = submitted([1891, 3, 30], 8, 1923);
 const seal = rows(untreatedSeal).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '戊子');
 assert.ok(seal?.normalizedPayload.exposedOfficerAndKiller);
 assert.equal(seal.normalizedPayload.luckBranchMainQiGod, '偏印');
 assert.deepEqual(seal.normalizedPayload.luJieAuthorityPaths, []);
 assert.equal(match(untreatedSeal, luJieAuthorityIndex).status, 'not_matched');
});

test('p104 reaches the separately observed moving officer only when the native combination is present', () => {
 const run = submitted([2021, 2, 25], 22, 2070);
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '乙酉');
 assert.ok(fact);
 const path = fact.normalizedPayload.luJieAuthorityPaths.find(row => row.killer.stem === '庚' && row.officer.stem === '辛');
 assert.ok(path?.combinations.some(row => row.helper.stem === '乙' && row.helper.position === 'hour'));
 assert.deepEqual([...path.outputLuck, ...path.peerLuck, ...path.sealsCheckingOutput, ...path.wealthFeedsKiller, ...path.wealthFeedsOfficer], []);
 assert.deepEqual(path.authorityPressure, [{ stem: '辛', god: '正官', kind: '运支首藏' }]);
 assert.ok(match(run, 146).sourceFactIds.includes(fact.factId));
 assert.ok(formatFortuneFactAudit(modelContext(run).input).includes('运支首藏辛正官克同一甲日元'));
});

test('p106 binds the same native output to the month peer, original root and arriving seal on that luck stage', () => {
 const run = real(148), selected = match(run, 148);
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '癸酉');
 assert.equal(selected.status, 'not_matched');
 assert.ok(fact);
 const paths = fact.normalizedPayload.luJieOutputPaths;
 const path = paths.find(row => row.output.stem === '丙' && row.output.position === 'month');
 assert.ok(path?.feedingPeers.some(row => row.stem === '甲' && row.position === 'month'));
 assert.ok(path.outputRoots.some(row => row.position === 'month' && row.exactStem));
 assert.deepEqual(path.movingSeal, [{ stem: '癸', god: '正印', kind: '运干' }]);
 assert.deepEqual(path.movingAuthority, []);
 const prompt = describeFortuneFact({ method: 'bazi', type: fact.factType, data: fact.normalizedPayload }, String);
 assert.ok(prompt.includes('克月令比劫所生的原局') && prompt.includes('该食伤原局根位为'));
 assert.ok(!prompt.includes('luJieOutputPaths'));
 const wealthStage = real(53);
 assert.ok(rows(wealthStage).some(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '己巳'
  && row.normalizedPayload.luJieOutputPaths.some(path => path.movingWealth.length && !path.movingSeal.length)));
 assert.equal(match(wealthStage, 148).status, 'not_matched');
});

test('p106 retains Zhang’s control, combinations and seal effects only on their actual original stages', () => {
 const cases = [[1962, '庚午'], [1972, '辛未'], [1982, '壬申']];
 for (const [year, luck] of cases) {
  const run = submitted([1924, 2, 15], 4, year);
  const selection = match(run, 148);
  const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === luck);
  assert.equal(selection.status, 'not_matched', luck);
  assert.ok(fact, luck);
  const evidence = fact.normalizedPayload.zhangOutputCaseEvidence;
  assert.deepEqual(evidence.natalZiSeals.map(row => row.position), ['year', 'day']);
  assert.equal(evidence.gengKiller, luck === '庚午');
  assert.deepEqual(evidence.gengRoots, []);
  assert.deepEqual(evidence.xinOutputPairs.map(pair => pair.members[0]), luck === '辛未' ? ['month', 'hour'] : []);
  assert.equal(evidence.renShenAuthoritySeal, luck === '壬申');
 }
 const changedHour = submitted([1924, 2, 15], 2, 1962);
 assert.ok(rows(changedHour).some(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '庚午'
  && row.normalizedPayload.luJieOutputPaths.some(path => path.movingAuthority.some(move => move.stem === '庚'))));
 assert.equal(match(changedHour, 148).status, 'not_matched');
});

test('p106 separates fire authority from a seal on the actual metal-water chart and its two distinct movements', () => {
 const cases = [
  [1982, '戊午', [{ stem: '丁', god: '正官', kind: '运支首藏' }], true],
  [1992, '丁巳', [{ stem: '丁', god: '正官', kind: '运干' }, { stem: '丙', god: '七杀', kind: '运支首藏' }], false],
 ];
 for (const [year, luck, fire, hasSeal] of cases) {
  const run = submitted([1963, 8, 25], 8, year);
  const selection = match(run, 148);
  const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === luck);
  assert.equal(selection.status, 'not_matched', luck);
  assert.ok(fact, luck);
  const payload = fact.normalizedPayload;
  assert.equal(payload.fireAbsent, true);
  assert.deepEqual(payload.metalWaterOutputCaseEvidence.waterGroup.byBranch, [['month'], ['day'], ['hour']]);
  assert.deepEqual(payload.metalWaterOutputCaseEvidence.fireAuthority, fire);
  assert.ok(payload.metalWaterOutputCaseEvidence.natalWealthLinks.some(link => link.output.stem === '癸'
   && link.output.position === 'year' && link.wealth.stem === '乙' && link.wealth.position === 'year'));
  const seals = payload.luJieOutputPaths.flatMap(path => path.movingSeal);
  assert.equal(seals.some(seal => seal.kind !== '运支余藏'), hasSeal);
  if (luck === '丁巳') assert.ok(seals.some(seal => seal.kind === '运支余藏' && seal.stem === '戊'));
  const prompt = formatFortuneFactAudit(modelContext(run).input);
  assert.ok(prompt.includes('金水相涵例本运火官杀位置为') && prompt.includes('该原图的徐注对火官杀另有不利评语'));
 }
});

test('p106 keeps secondary Gui geometry local at the actual Wu-Chen boundary without inferring the source exception', () => {
 const run = submitted([1924, 2, 15], 4, 1940);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊辰');
 assert.ok(change);
 const result = match(run, 148);
 const after = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '戊辰');
 const before = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '丁卯');
 assert.ok(before && after);
 assert.equal(result.status, 'not_matched');
 assert.ok(!result.sourceFactIds.includes(after.factId));
 assert.ok(!result.sourceFactIds.includes(before.factId));
 const { luJieOutputPaths, zhangOutputCaseEvidence } = after.normalizedPayload;
 assert.deepEqual(zhangOutputCaseEvidence.natalFoodRoots.map(root => root.position), ['month', 'hour']);
 const monthBing = luJieOutputPaths.find(path => path.output.position === 'month' && path.output.kind === '明透' && path.output.stem === '丙');
 assert.deepEqual(monthBing?.movingSeal, [{ stem: '癸', god: '正印', kind: '运支余藏' }]);
 assert.match(describeFortuneFact({ method: 'bazi', type: after.factType, data: after.normalizedPayload }, String),
  /运支余藏癸正印克月令比劫所生的原局/u);
});

test('p106 matches the named metal-water seal exception only until the real Ji-Wei to Wu-Wu boundary', () => {
 const run = submitted([1963, 8, 25], 8, 1979);
 const { input, knowledge } = modelContext(run);
 const result = knowledge.byMethod.bazi[namedOutputSealIndex];
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊午');
 assert.equal(change.exactInstant, '1979-03-24T22:00:00.000Z');
 const before = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '己未');
 const after = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '戊午');
 assert.equal(result.status, 'matched');
 assert.ok(result.sourceFactIds.includes(before.factId));
 assert.ok(!result.sourceFactIds.includes(after.factId));
 assert.deepEqual(before.normalizedPayload.metalWaterSealRelief.map(({ output, seal }) => [output.position, output.stem, seal.kind, seal.stem]),
  [['year', '癸', '运干', '己'], ['year', '癸', '运支首藏', '己']]);
 assert.deepEqual(after.normalizedPayload.metalWaterSealRelief, []);
 assert.ok(formatFortuneFactAudit(input).includes('徐注在此盘许印运'));
 const prompt = formatFortunePrompt(input);
 assert.ok(prompt.includes('在金水相涵例认定原局取食伤生财，也允许印运'));
 assert.ok(!prompt.includes('徐注在此盘许印运'));
});
