import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Solar} from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import {describeFortuneFact,formatFortuneFactAudit, formatFortunePrompt} from './control/fortune-prompt.mjs';
import {createFortuneDeepSeek} from './server/deepseek-expression.mjs';
const {baziZpqzOfficer,zpqzOfficerCases,zpqzOfficerVariants,zpqzOfficerCounterfactual}=await import('./control/bazi-zpqz-officer.ts');
const {calculateFortuneFacts,validateFortuneFacts}=await import('./control/fortune-facts.ts');
const {buildFactTimeContext}=await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const {matchFortuneKnowledge}=await import('./control/knowledge/match.ts');
const {evaluateFortuneRules,fortuneKnowledge}=await import('./control/knowledge/catalog.ts');
const {buildFortuneModelContext}=await import('./control/fortune-model-context.ts');
const {interpretFortune,requestForFortuneRun}=await import('./control/fortune-interpretation.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/zpqz-officer-reference.json',import.meta.url)));
const indices=[54,64,98,99,100,101,102,103,104],layers=['year','month','day','hour'];
const completeSourceIndices = new Set([54, 64]);
const natal=values=>Object.fromEntries(layers.map((k,i)=>[k,values[i]]));
const printed=id=>natal(ref.printedCases.find(c=>c.id===id).pillars);
const ctx=(id='xue',luck='癸酉',known=true)=>baziZpqzOfficer(typeof id==='string'?printed(id):id,known,luck);
const rows=run=>run.facts.filter(f=>f.factType==='zpqz_officer_context');
const match=(run,i)=>matchFortuneKnowledge(run).byMethod.bazi[i];
const cache=new Map();
function officerChart(e){const [y,m,d]=e.date,l=Solar.fromYmdHms(y,m,d,e.hour,0,0).getLunar();
 return {timeKnown:true,bazi:{engineName:'lunar-javascript',engineVersion:'1.7.8',rulesetVersion:'utc8-jie-local-civil-late-zi-next-v1',rawResult:[{
 utc:new Date(Date.UTC(y,m-1,d,e.hour-8)).toISOString(),year:l.getYearInGanZhiExact(),month:l.getMonthInGanZhiExact(),day:l.getDayInGanZhiExact(),hour:l.getTimeInGanZhi(),
 luckPeriods:l.getEightChar().getYun(e.gender,2).getDaYun(11).slice(1).map(s=>({ganZhi:s.getGanZhi(),startAge:s.getStartAge(),endAge:s.getEndAge()})),tenGods:{},shenSha:{}}]},ziwei:{rawResult:[]},western:{rawResult:[]}};}
function real(i){if(!cache.has(i)){const e=i==='xue'?ref.xueCalendar:i==='zaqi'?ref.zaqiCalendar:ref.calendarExamples[i];
 const input={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year:e.year}};
 cache.set(i,calculateFortuneFacts(input,buildFactTimeContext(input,Date.parse(e.year+'-11-19T02:00:00Z'),'server'),'officer-private-run',{snapshotId:'officer-private-chart',chart:officerChart(e)}));}return cache.get(i);}

function submitted(date, hour, year, gender = 1) {
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'officer-printed-' + date.join('-') + '-' + hour };
  const chart = officerChart({ date, hour, gender });
  chart.birthContext = { birthInstant: chart.bazi.rawResult[0].utc, precision: 'minute', latitude: 39.9042, longitude: 116.4074,
    timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
  validateFortuneFacts(run);
  return run;
}

function realOfficerPath(example) {
 const { date, hour, year, gender, luck } = example;
 const run = submitted(date, hour, year, gender);
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === luck);
 assert.ok(fact, luck);
 assert.deepEqual(fact.normalizedPayload.natalPillars.map(row => row.pillar), example.natal);
 return { run, fact, data: fact.normalizedPayload };
}

async function providerMessage(input) {
 let message;
 const provider = createFortuneDeepSeek({ apiKey: 'test-key', transport: async (_, options) => {
  message = JSON.parse(options.body).messages[1].content;
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(input);
 return message;
}

test('p012 binds the attacked officer to actual wealth and excludes the complete chart with a hidden seal', async () => {
 const example = ref.calendarExamples[54];
 const run = submitted(example.date, example.hour, 2040, example.gender);
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '癸酉');
 assert.ok(change);
 const hit = match(run, 54);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows[0].start, change.exactInstant);
 const [path] = rows(run).find(fact => fact.activeFrom === change.exactInstant && fact.normalizedPayload.luckPillar === '癸酉')
  .normalizedPayload.wealthFedOfficerUnderOutput;
 assert.deepEqual([path.officer.position, path.officer.stem, path.officer.kind], ['month', '乙', '支藏']);
 assert.deepEqual([path.moving.stem, path.moving.god, path.moving.kind], ['辛', '伤官', '运支藏干']);
 assert.ok(path.wealthSources.some(value => value.wealth.position === 'hour' && value.wealth.stem === '壬' && value.fedByOutput));
 assert.deepEqual(path.sealsFacingOutput, []);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'output-officer-change'));
 assert.match(formatFortuneFactAudit(input), /生同一个月柱支藏乙.*本步大运运支藏干辛.*克此正官/u);
 assert.deepEqual(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId)?.windows, hit.windows);
 assert.match(await providerMessage(input), /若按原文取正官为用.*是否出现实际不利，仍须结合全局/u);

 const withSeal = submitted(example.date, 12, example.year, example.gender);
 const counterpart = rows(withSeal).find(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.luckPillar === '癸酉').normalizedPayload;
 assert.equal(counterpart.sealsAbsent, false);
 assert.ok(counterpart.wealthFedOfficerUnderOutput.some(value => value.sealsFacingOutput.some(seal =>
  seal.position === 'hour' && seal.kind === '支藏' && seal.stem === '丁')));
 assert.equal(match(withSeal, 54).status, 'not_matched');

 const annualOnly = submitted(example.date, example.hour, 2031, example.gender);
 const annualFact = annualOnly.facts.find(row => row.factType === 'zpqz_moving_relations' && row.normalizedPayload.annualStem === '辛');
 assert.ok(annualFact);
 const actual = rows(annualOnly).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '甲戌');
 assert.ok(actual.normalizedPayload.movingRows.slice(2).some(row => row.stem === '辛' && row.god === '伤官'));
 assert.deepEqual(actual.normalizedPayload.wealthFedOfficerUnderOutput, []);
 assert.equal(match(annualOnly, 54).status, 'not_matched');
});

test('p022 binds hidden wealth and officer to the actual branch seal through the luck change', async () => {
 const example = ref.calendarExamples[64];
 const run = submitted(example.date, example.hour, 2010, example.gender);
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '庚辰');
 assert.ok(change);
 const hit = match(run, 64);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows.at(-1).endExclusive, change.exactInstant);
 const earlier = rows(run).find(fact => fact.activeTo === change.exactInstant && fact.normalizedPayload.luckPillar === '己卯');
 const later = rows(run).find(fact => fact.activeFrom === change.exactInstant && fact.normalizedPayload.luckPillar === '庚辰');
 const paths = earlier.normalizedPayload.wealthOfficerSealPaths;
 assert.ok(paths.some(({ wealth, officer, seal, combines }) => wealth.position === 'hour' && wealth.stem === '庚' && wealth.kind === '支藏'
  && officer.position === 'hour' && officer.stem === '壬' && officer.kind === '支藏' && seal.kind === '运支藏干' && seal.stem === '乙' && !combines));
 assert.ok(later.normalizedPayload.movingRows.some(row => row.stem === '乙' && row.kind === '运支藏干'));
 assert.deepEqual(later.normalizedPayload.wealthOfficerSealPaths, []);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'officer-seal-change'));
 assert.ok(input.facts.some(fact => fact.type === 'zpqz_officer_context' && fact.endExclusive === change.exactInstant && fact.data.wealthOfficerSealPaths.length));
 assert.match(formatFortuneFactAudit(input), /同一路财官运印关系.*时柱支藏壬.*本步大运运支藏干乙/u);
 assert.deepEqual(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId)?.windows, hit.windows);
 assert.match(await providerMessage(input), /若按原文取财生官.*不必先有天干五合.*只凭印能生身就断吉凶/u);

 const annualOnly = submitted(example.date, example.hour, 2011, example.gender);
 const annualFact = annualOnly.facts.find(row => row.factType === 'zpqz_moving_relations' && row.normalizedPayload.annualBranch === '卯');
 assert.ok(annualFact);
 const actual = rows(annualOnly).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '庚辰');
 assert.ok(actual.normalizedPayload.movingRows.slice(2).some(row => row.stem === '乙' && row.god === '偏印'));
 assert.deepEqual(actual.normalizedPayload.wealthOfficerSealPaths, []);
 assert.equal(match(annualOnly, 64).status, 'not_matched');
});

test('p022 preserves the optional five-combination only on the same exposed wealth and moving seal', () => {
 const run = submitted([1988, 9, 16], 18, 2063, 0);
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '癸丑');
 assert.ok(fact);
 assert.equal(match(run, 64).status, 'matched');
 const paths = fact.normalizedPayload.wealthOfficerSealPaths;
 assert.ok(paths.some(({ wealth, officer, seal, combines }) => wealth.position === 'year' && wealth.stem === '戊' && wealth.kind === '透干'
  && officer.position === 'month' && officer.stem === '辛' && seal.stem === '癸' && seal.kind === '运干' && combines));
 assert.ok(paths.some(({ wealth, combines }) => wealth.kind === '支藏' && !combines));
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'officer-seal-combination'));
 assert.match(formatFortuneFactAudit(input), /同一原财与运印也有天干五合/u);
});

test('p023 distinguishes moving officer pressure on the same hidden seal from seal-only support', () => {
 const run = submitted([1980, 1, 1], 0, 2021, 0);
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '辛巳');
 assert.ok(change);
 const hit = match(run, 65);
 assert.equal(hit.status, 'partial');
 assert.equal(hit.windows.at(-1).endExclusive, change.exactInstant);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'killer-seal-change'));
 const facts = input.facts.filter(fact => fact.type === 'zpqz_seal_food_context');
 const pressure = facts.find(fact => fact.data.luckPillar === '庚辰' && fact.endExclusive === change.exactInstant);
 const support = facts.find(fact => fact.data.luckPillar === '辛巳');
 assert.ok(pressure && support);
 const chain = pressure.data.killerSealPressure.find(value => value.seal.position === 'day' && value.seal.stem === '辛');
 assert.equal(chain.seal.kind, '支藏');
 assert.ok(chain.killers.some(value => value.position === 'year' && value.stem === '己' && value.kind === '透干'));
 assert.deepEqual(chain.moving.map(value => [value.stem, value.god, value.kind]), [['戊', '正官', '运支藏干']]);
 assert.deepEqual(pressure.data.killerSealSupport.map(value => [value.stem, value.god]), [['庚', '正印']]);
 assert.deepEqual(support.data.killerSealPressure, []);
 assert.deepEqual(support.data.killerSealSupport.map(value => [value.stem, value.god]), [['辛', '偏印']]);
 const supportFact = run.facts.find(fact => fact.factType === 'zpqz_seal_food_context'
  && fact.activeFrom === change.exactInstant && fact.normalizedPayload.luckPillar === '辛巳');
 const sameKiller = supportFact.normalizedPayload.killerSealSupportPaths.find(row => row.seal.position === 'day' && row.seal.stem === '辛');
 assert.deepEqual([sameKiller.killer.position, sameKiller.killer.kind, sameKiller.killer.stem, sameKiller.day.stem],
  ['year', '透干', '己', '癸']);
 assert.deepEqual(sameKiller.movingSeals.map(row => [row.kind, row.stem, row.god]), [['运干', '辛', '偏印']]);
 assert.deepEqual(sameKiller.movingRobberies, []);
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /原局七杀.*克日元并生原局日柱癸酉支藏辛.*本步大运庚辰运支藏干戊/su);
 assert.match(prompt, /本步大运辛巳运干辛.*印劫扶身对照/u);
 assert.match(prompt, /同一原透七杀年柱己未透干己.*也生本步大运辛巳运干辛/u);
 assert.doesNotMatch(prompt, /killerSealPressure|killerSealSupport|wealthOfficerSealPaths/u);
 assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
});

test('five original diagrams, the invalid Wu-Jia prose and the explicit Ji-You-year counterfactual keep their original identities',()=>{
 assert.deepEqual(zpqzOfficerCases,ref.printedCases);assert.deepEqual(zpqzOfficerVariants,ref.sourceVariants);assert.deepEqual(zpqzOfficerCounterfactual,ref.counterfactual);
 for(const c of ref.printedCases){const r=ctx(natal(c.pillars)).printedCases.find(r=>r.id===c.id);assert.equal(r.matches,true);assert.equal(r.stemCheck.yearMonthCompatible,true);assert.equal(r.stemCheck.dayHourCompatible,true);}
 assert.equal(ref.sourceVariants[0].validPillars,false);assert.throws(()=>ctx(natal(ref.sourceVariants[0].pillars)));
 const counter=ctx(natal(ref.counterfactual.pillars));assert.equal(counter.counterfactual.matches,true);assert.equal(counter.counterfactual.historicalNatal,false);assert.equal(counter.printedCases.find(c=>c.id==='xue').matches,false);
});

test('the real 1944 Xue counterpart confirms the hidden-officer route with both wealth and seal exposed',()=>{
 const run=real('xue');validateFortuneFacts(run);assert.equal(match(run,98).status,'matched');const p=rows(run).find(f=>f.normalizedPayload.confirmed).normalizedPayload;
 assert.equal(p.officerExposed,false);assert.equal(p.wealthExposed,true);assert.equal(p.sealsExposed,true);assert.equal(p.monthOfficerCandidate,true);
 assert.equal(fortuneKnowledge.bazi.rules[98].queries[0].where.officerExposed,undefined);
 assert.deepEqual(p.natalPillars.map(r=>r.pillar),['甲申','壬申','乙巳','戊寅']);
 for(const key of ['wealthExposed','sealsExposed']){const missing=structuredClone(run);rows(missing).forEach(f=>f.normalizedPayload[key]=false);assert.equal(match(missing,98).status,'not_matched');}
});

test('no-seal source requires actual wealth as well as officer and treats an unknown hour as unknown absence rather than no seal',()=>{
 const p=ctx(natal(ref.calendarExamples[54].natal),'癸酉');assert.equal(p.sealsAbsent,true);assert.equal(p.wealthPresent,true);
 assert.equal(ctx(natal(ref.calendarExamples[54].natal),'癸酉',false).sealsAbsent,undefined);
 const missing=structuredClone(real(54));rows(missing).forEach(f=>f.normalizedPayload.wealthPresent=false);assert.equal(match(missing,54).status,'not_matched');
 assert.equal(ctx('xue').sealsAbsent,false);
});

test('wealth supporting officer does not invent an exposed-wealth or five-combination prerequisite for the seal luck appraisal',()=>{
 const n=natal(ref.calendarExamples[64].natal),p=ctx(n,'戊寅');assert.equal(p.wealthPresent,true);assert.equal(p.wealthExposed,false);assert.ok(p.wealthOfficerContacts.length>0);
 assert.equal(match(real(64),64).status,'matched');assert.equal(fortuneKnowledge.bazi.rules[64].queries[0].where.wealthExposed,undefined);
 const synthetic=structuredClone(real(64));rows(synthetic).forEach(f=>{f.normalizedPayload.natalFivePairs=[];f.normalizedPayload.movingFivePairs=[];});assert.equal(match(synthetic,64).status,'matched');
});

test('officer/output/seal source branches require all actual premises, and the source officer-generating-seal branch is no longer limited to seal-only luck',()=>{
 for(const i of [103,104]){const q=fortuneKnowledge.bazi.rules[i].queries[0];assert.equal(q.where.sealsPresent,true);assert.equal(q.where.outputPresent,true);
  for(const key of ['sealsPresent','outputPresent']){const missing=structuredClone(real(i));rows(missing).forEach(f=>f.normalizedPayload[key]=false);assert.equal(match(missing,i).status,'not_matched');}}
 const q=fortuneKnowledge.bazi.rules[103].queries[0];
 assert.equal(q.where.hasOfficerSealProtection, true);
 assert.equal(q.anyOf, undefined);
 for (const [luck, authority] of [['己巳', '正官'], ['戊辰', '七杀']]) {
  const p=ctx('xuan', luck);
  assert.equal(p.luckTenGod, authority);
  assert.equal(p.hasOfficerSealProtection, true);
 }
});

test('wealth and seal connect through the same verified moving officer while natal separation and combination remain distinct', () => {
 const xue = realOfficerPath(ref.xueCalendar);
 const zaqi = realOfficerPath(ref.zaqiCalendar);
 const hit = match(xue.run, 98), joinedPair = match(zaqi.run, 98);
 assert.equal(hit.status, 'matched');
 assert.ok(hit.sourceFactIds.includes(xue.fact.factId));
 assert.equal(joinedPair.status, 'not_matched');
 assert.equal(xue.data.officerExposed, false);
 assert.deepEqual(xue.data.wealthSupportingOfficerSeal.map(link => [link.wealth.stem, link.through.kind, link.through.stem,
  link.seal.stem, link.between.map(row => row.position), link.combines]), [['戊', '运支藏干', '辛', '壬', ['day'], false]]);
 assert.deepEqual(zaqi.data.wealthSupportingOfficerSeal.map(link => [link.wealth.stem, link.through.kind, link.through.stem,
  link.seal.stem, link.combines]), [['壬', '运干', '甲', '丁', true], ['壬', '运支藏干', '甲', '丁', true]]);
 for (const data of [xue.data, zaqi.data]) {
  assert.ok(data.wealthSupportingOfficerSeal.every(path => path.wealthControlsSeal && path.sealFeedsDay && path.movingControlsDay));
 }
 assert.deepEqual(xue.data.officerExposureChecks.authority, []);
 assert.deepEqual(zaqi.data.officerExposureChecks.authority.map(row => [row.officer.position, row.officer.stem, row.moving.stem, row.route]),
  [['hour', '乙', '甲', '七杀同透']]);
 assert.deepEqual(ctx('zaqi', '乙亥').officerExposureChecks.authority.map(row => [row.officer.stem, row.moving.stem, row.route]),
  [['乙', '乙', '正官同干重见']]);
 assert.ok(ctx('zaqi', '庚申').officerExposureChecks.combines.some(row => row.moving.stem === '庚' && row.target.position === 'hour' && row.target.stem === '乙'));
 const { input } = buildFortuneModelContext(zaqi.run, interpretFortune(zaqi.run, requestForFortuneRun(zaqi.run), 'officer-shared-endpoint'));
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('同一运成分再生月柱透干丁（正印）'));
 assert.ok(prompt.includes('这对原局财印也有天干五合'));
 assert.match(prompt, /同一原财对原印另有克向。同一原印有生戊日元的方向。同一运官杀也有克日元的方向/u);
 assert.ok(!prompt.includes('wealthSupportingOfficerSeal'));
});

test('p056 reaches the printed Ji-You counterfactual only from the actual Jia combination with the same wealth opposing natal Ren', () => {
 const date = [1909, 8, 13], run = submitted(date, 4, 1928, 0);
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '甲戌');
 assert.ok(transition);
 const before = rows(run).find(row => row.normalizedPayload.luckPillar === '癸酉' && row.activeTo === transition.exactInstant);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '甲戌' && row.activeFrom === transition.exactInstant);
 assert.ok(before && after);
 const hit = match(run, 98), p = after.normalizedPayload;
 assert.equal(hit.status, 'partial');
 assert.ok([before, after].every(fact => hit.sourceFactIds.includes(fact.factId)));
 assert.equal(before.normalizedPayload.hasCounterfactualWealthSeal, false);
 assert.equal(p.hasCounterfactualWealthSeal, true);
 assert.deepEqual(p.natalPillars.map(row => row.pillar), ['己酉', '壬申', '乙巳', '戊寅']);
 assert.deepEqual(p.printedLuckCaseIds, []);
 assert.deepEqual(p.wealthSupportingOfficerSeal, []);
 assert.deepEqual(p.counterfactualWealthSeal.map(path => [path.moving.stem, path.wealth.position, path.wealth.stem, path.seal.position, path.seal.stem]),
  [['甲', 'year', '己', 'month', '壬']]);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'officer-xue-counterfactual'));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /薛例的己酉年反设中，本步大运运干甲（劫财）合年柱透干己（偏财），同一原财有克月柱透干壬（正印）的方向/u);
 assert.doesNotMatch(prompt, /counterfactualWealthSeal|hasCounterfactualWealthSeal/u);
 const changed = submitted(date, 2, 1930, 0);
 const changedXu = rows(changed).find(row => row.normalizedPayload.luckPillar === '甲戌');
 assert.ok(changedXu);
 assert.equal(changedXu.normalizedPayload.hasCounterfactualWealthSeal, false);
 assert.equal(match(changed, 98).status, 'not_matched');
});

test('the same exposed month officer distinguishes arriving mixed authority, repetition and combination in the live luck stage', () => {
 const date = [1956, 4, 11], cut = '1984-06-26T16:00:00.000Z';
 const run = submitted(date, 6, 1984);
 const mixed = rows(run).find(row => row.activeTo === cut && row.normalizedPayload.luckPillar === '甲午');
 const repeated = rows(run).find(row => row.activeFrom === cut && row.normalizedPayload.luckPillar === '乙未');
 assert.ok(mixed && repeated);
 for (const [fact, route, arriving] of [[mixed, '七杀同透', '甲'], [repeated, '正官同干重见', '乙']]) {
  const p = fact.normalizedPayload;
  const { monthOfficer, exposedOfficer, authority, combinations } = p.monthOfficerExposureConflicts;
  assert.deepEqual([monthOfficer.position, monthOfficer.stem, exposedOfficer.position, exposedOfficer.stem], ['month', '乙', 'hour', '乙']);
  assert.deepEqual(authority.map(row => [row.route, row.moving.stem]), [[route, arriving]]);
  assert.deepEqual(combinations, []);
  assert.equal(p.hasMonthOfficerVisibleLuckConflict, true);
  assert.ok(p.wealthSupportingOfficerSeal.some(path => path.through.stem === arriving));
 }
 assert.equal(match(run, 98).status, 'excluded');
 assert.equal(match(run, 100).status, 'excluded');

 const hiddenRun = submitted(date, 8, 1984);
 const hidden = rows(hiddenRun).find(row => row.normalizedPayload.luckPillar === '乙未');
 assert.ok(hidden);
 assert.equal(hidden.normalizedPayload.officerExposed, false);
 assert.equal(hidden.normalizedPayload.hasMonthOfficerVisibleLuckConflict, false);
 assert.equal(match(hiddenRun, 98).status, 'partial');
 assert.equal(match(hiddenRun, 100).status, 'partial');

 const combining = submitted(date, 6, 2034);
 const joinCut = '2034-06-26T16:00:00.000Z';
 const before = rows(combining).find(row => row.activeTo === joinCut && row.normalizedPayload.luckPillar === '己亥');
 const after = rows(combining).find(row => row.activeFrom === joinCut && row.normalizedPayload.luckPillar === '庚子');
 assert.ok(before && after);
 assert.equal(before.normalizedPayload.hasMonthOfficerVisibleLuckConflict, false);
 assert.equal(after.normalizedPayload.hasMonthOfficerVisibleLuckConflict, true);
 assert.deepEqual(after.normalizedPayload.monthOfficerExposureConflicts.combinations.map(row =>
  [row.target.position, row.target.stem, row.moving.stem]), [['hour', '乙', '庚']]);
 const aid = match(combining, 100);
 assert.equal(aid.status, 'partial');
 assert.equal(aid.windows.at(-1).endExclusive, joinCut);
 assert.ok(aid.sourceFactIds.includes(before.factId));
 const doubleOfficer = ctx(natal(['乙未', '庚辰', '戊申', '乙卯']), '庚子');
 assert.equal(doubleOfficer.officerExposureChecks.combines.length, 2);
 assert.equal(doubleOfficer.hasMonthOfficerVisibleLuckConflict, false);
 const sameAsDay = ctx(natal(['庚申', '甲申', '乙酉', '丁丑']), '乙卯');
 assert.equal(sameAsDay.officerExposureChecks.combines.length, 1);
 assert.equal(sameAsDay.hasMonthOfficerVisibleLuckConflict, false);
 assert.equal(ctx(natal(['丙申', '壬辰', '戊申', '乙卯']), '乙未', false).hasMonthOfficerVisibleLuckConflict, undefined);
});

test('the exposed arrival and direct clash are distinct when the sole natal month officer stays hidden', () => {
 const date = [1936, 3, 7], year = 1986, gender = 0;
 const run = submitted(date, 0, year, gender);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '乙酉');
 assert.ok(change);
 assert.equal(change.exactInstant, '1986-06-27T14:00:00.000Z');
 const before = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '丙戌');
 const after = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '乙酉');
 assert.ok(before && after);
 assert.equal(before.normalizedPayload.hasOnlyHiddenMonthOfficerDirectLuckClash, false);
 const p = after.normalizedPayload;
 assert.deepEqual(p.natalPillars.map(row => row.pillar), ['丙子', '辛卯', '戊子', '壬子']);
 assert.equal(p.hasMonthOfficerVisibleLuckConflict, false);
 assert.equal(p.hasOnlyHiddenMonthOfficerDirectLuckClash, true);
 const { officer, movingOfficer, clash } = p.onlyHiddenMonthOfficerDirectLuckClash;
 assert.deepEqual([officer.position, officer.stem, officer.kind, movingOfficer.stem, movingOfficer.kind],
  ['month', '乙', '支藏', '乙', '运干']);
 assert.deepEqual(clash, { kind: '六冲', members: ['month', 'decadal'], values: '卯酉' });
 assert.ok(p.wealthSupportingOfficerSeal.some(path => path.wealth.stem === '壬' && path.through.stem === '乙' && path.seal.stem === '丙'));
 assert.equal(p.hasOfficerWealthAid, true);
 const isolated = { ...run, facts: [after] };
 for (const index of [98, 100]) assert.equal(match(isolated, index).status, 'excluded', index);
 const { input } = buildFortuneModelContext(isolated,
  interpretFortune(isolated, requestForFortuneRun(isolated), 'hidden-month-officer-branch-clash'));
 assert.match(formatFortuneFactAudit(input), /实际运支六冲月令/u);
 assert.doesNotMatch(formatFortunePrompt(input), /实际运支六冲月令|onlyHiddenMonthOfficerDirectLuckClash/u);

 const withChou = submitted(date, 2, year, gender);
 const near = rows(withChou).find(row => row.normalizedPayload.luckPillar === '乙酉');
 assert.ok(near);
 assert.equal(near.normalizedPayload.natalPillars.at(-1).pillar, '癸丑');
 assert.ok(near.normalizedPayload.threeCombinationGroups.find(row => row.values === '巳酉丑')
  .members.some(row => row.branch === '丑' && row.natalPositions.includes('hour')));
 assert.equal(near.normalizedPayload.hasOnlyHiddenMonthOfficerDirectLuckClash, false);
 for (const index of [98, 100]) assert.equal(match({ ...withChou, facts: [near] }, index).status, 'partial', index);
 assert.equal(ctx(natal(['丙子', '辛卯', '戊子', '壬子']), '乙酉', false).hasOnlyHiddenMonthOfficerDirectLuckClash, undefined);
});

test('p057 and p058 retain distinct assistance to the day master and the specific month officer across the actual luck change', () => {
 const example = ref.calendarExamples[99];
 const run = submitted(example.date, example.hour, 1990, example.gender);
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊寅');
 assert.ok(transition);
 const boundary = transition.exactInstant;
 const before = rows(run).find(row => row.normalizedPayload.luckPillar === '己卯' && row.activeTo === boundary);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '戊寅' && row.activeFrom === boundary);
 assert.ok(before && after);
 const support = match(run, 99), aid = match(run, 100);
 assert.equal(support.status, 'partial');
 assert.equal(aid.status, 'partial');
 assert.ok([before, after].every(row => support.sourceFactIds.includes(row.factId)));
 assert.ok(aid.sourceFactIds.includes(before.factId) && !aid.sourceFactIds.includes(after.factId));
 assert.equal(aid.windows.at(-1).endExclusive, boundary);
 const [path] = before.normalizedPayload.monthOfficerWealthPaths;
 assert.deepEqual([path.officer.position, path.officer.pillar, path.officer.stem], ['month', '庚辰', '乙']);
 assert.ok(path.nativeWealth.some(row => row.position === 'hour' && row.stem === '壬' && row.kind === '透干'));
 assert.deepEqual(path.movingOfficer.map(row => [row.kind, row.stem]), [['运支藏干', '乙']]);
 assert.deepEqual(after.normalizedPayload.monthOfficerWealthPaths[0].movingOfficer, []);
 assert.deepEqual(before.normalizedPayload.officerWealthBodySupport.peers.map(row => row.stem), ['己']);
 assert.deepEqual(after.normalizedPayload.officerWealthBodySupport.peers.map(row => row.stem), ['戊']);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'officer-wealth-change'));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /本步大运运支藏干乙（正官）与月柱支藏乙（正官）同干/u);
 assert.match(prompt, /本步大运运干己（劫财）与日柱日干戊（日元）同属日元五行/u);
 assert.doesNotMatch(prompt, /monthOfficerWealthPaths|officerWealthBodySupport|hasOfficerWealthAid/u);
 const seal = realOfficerPath({ ...example, year: 2001, luck: '丁丑' });
 assert.deepEqual(seal.data.officerWealthBodySupport.seals.map(row => [row.kind, row.stem]), [['运干', '丁']]);
 assert.equal(match(seal.run, 99).status, 'partial');
 assert.equal(ctx('xue', '乙卯').officerWealthBodySupport.luSeat.stem, '乙');
});

test('p057 excludes the strong original chart while p058 confirms the branch wealth path alongside output', async () => {
 const { date, hour, gender } = ref.zaqiCalendar;
 const original = submitted(date, hour, 1935, gender), variant = submitted(date, 8, 1935, gender);
 for (const [run, named] of [[original, true], [variant, false]]) {
  const stage = rows(run).find(row => row.normalizedPayload.luckPillar === '己酉');
  assert.ok(stage);
  assert.equal(stage.normalizedPayload.officerWealthNamedStrong, named);
  assert.ok(stage.normalizedPayload.officerWealthBodySupport.peers.some(row => row.stem === '己'));
  assert.equal(match(run, 99).status, named ? 'not_matched' : 'partial');
 }
 const wealthRun = submitted(date, hour, 1952, gender);
 const change = wealthRun.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '辛亥');
 assert.ok(change);
 const hit = match(wealthRun, 100);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows[0].start, change.exactInstant);
 const stage = rows(wealthRun).find(row => row.normalizedPayload.luckPillar === '辛亥' && row.activeFrom === change.exactInstant);
 const [path] = stage.normalizedPayload.monthOfficerWealthPaths;
 assert.deepEqual([path.officer.pillar, path.officer.stem], ['丁未', '乙']);
 assert.deepEqual(path.movingWealth.map(row => [row.kind, row.stem]), [['运支藏干', '壬']]);
 assert.deepEqual(path.movingOutput.map(row => [row.kind, row.stem]), [['运干', '辛']]);
 const { input } = buildFortuneModelContext(wealthRun, interpretFortune(wealthRun, requestForFortuneRun(wealthRun), 'zaqi-wealth'));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /徐注判该例日元当旺、官稍轻/u);
 assert.match(prompt, /本步大运运支藏干壬（偏财）也有生这处月柱支藏乙（正官）的方向/u);
 assert.match(prompt, /本步大运运干辛（伤官）也有克这处月柱支藏乙（正官）的方向/u);
 assert.match(await providerMessage(input), /辛亥另有辛伤官克同一乙官的方向/u);
});

test('p059 and p060 bind natal officer and seal to body support and the wealth that actually controls that seal', () => {
 const example = ref.calendarExamples[101];
 const run = submitted(example.date, example.hour, 2020, example.gender);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '乙亥');
 assert.ok(change);
 const boundary = change.exactInstant;
 const before = rows(run).find(row => row.normalizedPayload.luckPillar === '丙子' && row.activeTo === boundary);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '乙亥' && row.activeFrom === boundary);
 assert.ok(before && after);
 const wealth = match(run, 101), support = match(run, 102);
 assert.ok([before, after].every(row => wealth.sourceFactIds.includes(row.factId)));
 assert.ok(support.sourceFactIds.includes(before.factId) && !support.sourceFactIds.includes(after.factId));
 assert.equal(support.windows.at(-1).endExclusive, boundary);
 const path = p => p.monthOfficerSealPaths.find(row => row.seal.position === 'hour' && row.seal.stem === '丙');
 const early = path(before.normalizedPayload), late = path(after.normalizedPayload);
 assert.deepEqual([early.officer.position, early.officer.pillar, early.officer.stem, early.day.stem], ['month', '庚辰', '乙', '戊']);
 assert.deepEqual(early.movingWealth.map(row => [row.kind, row.stem]), [['运支藏干', '癸']]);
 assert.deepEqual(late.movingWealth.map(row => [row.kind, row.stem]), [['运支藏干', '壬']]);
 assert.deepEqual(before.normalizedPayload.officerSealBodySupport.seals.map(row => [row.kind, row.stem]), [['运干', '丙']]);
 assert.deepEqual(after.normalizedPayload.officerSealBodySupport.seals, []);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'officer-seal-transition'));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /月柱支藏乙（正官）生时柱透干丙（偏印），同一原印再生日柱日干戊（日元）/u);
 assert.match(prompt, /本步大运运支藏干癸（正财）有克这处时柱透干丙（偏印）的方向/u);
 assert.doesNotMatch(prompt, /monthOfficerSealPaths|hasOfficerSealWealthOutput|hasOfficerSealBodySupport/u);
});

test('p059 confirms the printed Jin wealth stage and stops when incoming Gui instead feeds the seal', async () => {
 const date = [1915, 11, 12], run = submitted(date, 20, 1947);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸未');
 assert.ok(change);
 const before = rows(run).find(row => row.normalizedPayload.luckPillar === '甲申' && row.activeTo === change.exactInstant);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '癸未' && row.activeFrom === change.exactInstant);
 assert.ok(before && after);
 const hit = match(run, 101);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows.at(-1).endExclusive, change.exactInstant);
 assert.ok(hit.sourceFactIds.includes(before.factId));
 assert.ok(!hit.sourceFactIds.includes(after.factId));
 assert.equal(before.normalizedPayload.hasJinSourceSealReinforcement, false);
 assert.equal(after.normalizedPayload.hasJinSourceSealReinforcement, true);
 assert.ok(before.normalizedPayload.monthOfficerWealthPaths.some(path => path.officer.position === 'month'
  && path.officer.stem === '壬' && path.movingWealth.some(wealth => wealth.stem === '庚' && wealth.kind === '运支藏干')));
 assert.equal(before.normalizedPayload.hasOfficerWealthAid, true);
 assert.equal(match({ ...run, facts: [before] }, 100).status, 'not_matched');
 assert.equal(match({ ...run, facts: [after] }, 100).status, 'not_matched');
 assert.ok([before, after].every(row => row.normalizedPayload.hasOfficerSealProtection
  && row.normalizedPayload.officerSealNamedStrong));
 assert.equal(before.normalizedPayload.hasOfficerWealthBodySupport, true);
 assert.equal(match(run, 99).status, 'not_matched');
 assert.equal(match(run, 103).status, 'not_matched');
 assert.equal(match(run, 102).status, 'not_matched');
 assert.equal(before.normalizedPayload.hasOfficerSealBodySupport, true);
 assert.equal(before.normalizedPayload.officerSealNamedStrong, true);
 const outputWealth = match(run, 104);
 assert.equal(outputWealth.status, 'matched');
 assert.equal(outputWealth.matchedSourceExcerpt, '印綬重疊以生身');
 assert.ok(outputWealth.sourceFactIds.includes(before.factId) && !outputWealth.sourceFactIds.includes(after.factId));
 assert.equal(outputWealth.windows.at(-1).endExclusive, change.exactInstant);
 const proof = before.normalizedPayload.jinSourceOutputThroughWealth;
 assert.deepEqual([proof.moving.stem, proof.moving.kind], ['庚', '运支藏干']);
 assert.ok(proof.fedByOutput.some(row => row.position === 'day' && row.kind === '支藏' && row.stem === '己'));
 assert.ok(proof.fedByOutput.some(row => row.position === 'hour' && row.kind === '支藏' && row.stem === '戊'));
 for (const [position, stem] of [['year', '乙'], ['month', '甲']]) {
  assert.ok(proof.affectedSeals.some(row => row.position === position && row.stem === stem));
 }
 assert.equal(after.normalizedPayload.jinSourceOutputThroughWealth, undefined);
 assert.equal(after.normalizedPayload.hasJinSourceOutputThroughWealth, false);
 const prior = before.normalizedPayload.jinSealComparison, next = after.normalizedPayload.jinSealComparison;
 assert.equal(prior.woodGroup.nativeComplete, true);
 assert.deepEqual(prior.natalMetalRoots.map(row => [row.position, row.stem]), [['hour', '辛']]);
 assert.deepEqual(prior.movingMetalRoots.map(row => row.stem), ['庚']);
 assert.deepEqual(ctx('jin', '乙酉').jinSealComparison.movingMetalRoots.map(row => row.stem), ['辛']);
 assert.deepEqual(prior.jiaHiddenRoots.map(row => [row.position, row.stem]), [['month', '甲']]);
 assert.ok(next.southernBridges.some(row => row.wealth.stem === '庚' && row.through.stem === '癸'
  && row.through.kind === '运干' && row.seal.position === 'year' && row.seal.stem === '乙'));
 assert.ok(after.normalizedPayload.officerLuckRoutes.includes('wealth-officer-seal'));
 assert.equal(match({ ...run, facts: [after] }, 98).status, 'not_matched');
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'officer-jin-seal'));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /徐注判该例身旺印重/u);
 assert.match(prompt, /运支藏干庚（正财）与原局时庚同干/u);
 assert.match(prompt, /金例该南方运里时柱透干庚（正财）生本步大运运干癸（七杀），再生年柱透干乙（偏印）/u);
 const providerText = await providerMessage(input);
 assert.match(providerText, /金状元原评按亥卯未会印、年乙透出定身旺印重/u);
 assert.match(providerText, /原局丁日所生的食伤接本步同一运财/u);
 assert.doesNotMatch(providerText, /金例该南方运里|一氣相通|hasJinSourceSealReinforcement|jinSourceOutputThroughWealth/iu);
 const variant = submitted(date, 18, 1940);
 const nearby = rows(variant).find(row => row.normalizedPayload.luckPillar === '甲申');
 assert.ok(nearby);
 assert.equal(nearby.normalizedPayload.officerSealNamedStrong, false);
 assert.equal(nearby.normalizedPayload.hasJinSourceOutputThroughWealth, false);
 assert.notEqual(match(variant, 101).status, 'matched');
 assert.notEqual(match(variant, 104).status, 'matched');
 assert.equal(match(variant, 102).status, 'partial');

 const otherGengHour = submitted(date, 0, 1947);
 const otherGui = rows(otherGengHour).find(row => row.normalizedPayload.luckPillar === '癸未');
 assert.ok(otherGui);
 const p = otherGui.normalizedPayload;
 assert.ok(p.wealthSupportingOfficerSeal.some(row => row.wealth.pillar === '庚子' && row.through.stem === '癸' && row.seal.stem === '乙'));
 assert.equal(p.hasJinSourceSealReinforcement, false);
 assert.equal(match({ ...otherGengHour, facts: [otherGui] }, 98).status, 'partial');

 const south = submitted(date, 20, 1957);
 const renWu = rows(south).find(row => row.normalizedPayload.luckPillar === '壬午');
 assert.ok(renWu);
 assert.equal(renWu.normalizedPayload.hasOfficerWealthAid, true);
 assert.equal(renWu.normalizedPayload.hasJinSourceSealReinforcement, true);
 assert.equal(match(south, 100).status, 'not_matched');
 assert.equal(match({ ...south, facts: [renWu] }, 98).status, 'not_matched');
});

test('p060 confirms the Wu officer-seal path on entering the actual Gui stage', async () => {
 const run = submitted([2007, 7, 7], 18, 2037);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸卯');
 assert.ok(change);
 const boundary = change.exactInstant;
 const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '甲辰');
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '癸卯');
 assert.ok(before && after);
 const p = after.normalizedPayload;
 assert.equal(p.hasWuSourceOfficerSealSupport, true);
 assert.equal(before.normalizedPayload.hasWuSourceOfficerSealSupport, false);
 assert.deepEqual(p.natalPillars.map(({ pillar }) => pillar), ['丁亥', '丙午', '壬寅', '己酉']);
 assert.deepEqual(p.monthOfficerSealPaths.map(({ officer, seal, day }) =>
  [officer.position, officer.stem, seal.position, seal.stem, day.stem]), [['month', '己', 'hour', '辛', '壬']]);
 assert.deepEqual(p.officerSealBodySupport.peers.map(({ kind, stem }) => [kind, stem]), [['运干', '癸']]);
 const hit = match(run, 102);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows[0].start, boundary);
 assert.ok(hit.sourceFactIds.includes(after.factId) && !hit.sourceFactIds.includes(before.factId));
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'wu-officer-seal'));
 const phrase = /伍朝枢原图依原评为午月壬水身弱、财官过旺/u;
 const content = await providerMessage(input);
 assert.match(content, phrase);
 assert.doesNotMatch(content, /hasWuSourceOfficerSealSupport/u);
 const altered = submitted([2007, 7, 7], 20, 2038);
 const sameLuck = rows(altered).find(row => row.normalizedPayload.luckPillar === '癸卯');
 assert.ok(sameLuck?.normalizedPayload.hasOfficerSealBodySupport);
 assert.equal(sameLuck.normalizedPayload.hasWuSourceOfficerSealSupport, false);
 assert.equal(match(altered, 102).status, 'partial');
 const counterpart = buildFortuneModelContext(altered, interpretFortune(altered, requestForFortuneRun(altered), 'wu-altered')).input;
 assert.doesNotMatch(formatFortunePrompt(counterpart), phrase);
});

test('output luck without a wealth endpoint fails the wealth-generation branch while the actual fortune components keep their distinct routes', () => {
 const absent = realOfficerPath(ref.officerPathExamples.outputWithoutWealth);
 assert.ok(absent.data.luckOutputFeedsWealth.length);
 assert.ok(absent.data.luckOutputFeedsWealth.every(link => link.wealth.length === 0));
 assert.equal(match(absent.run, 101).status, 'not_matched');
 const outputLuck = realOfficerPath({ ...ref.officerPathExamples.outputWithoutWealth, year: 1982, luck: '丁丑' });
 assert.deepEqual(outputLuck.data.luckWealthControlsSeal, []);
 assert.ok(outputLuck.data.luckOutputFeedsWealth.some(link => link.output.stem === '己'
  && link.wealth.some(target => target.kind === '运支藏干' && target.stem === '辛')));
 assert.equal(match(outputLuck.run, 101).status, 'partial');
 const sealLuck = realOfficerPath(ref.calendarExamples[101]);
 assert.ok(sealLuck.data.luckWealthControlsSeal.some(link => link.from.kind === '运支藏干' && link.from.stem === '癸'
  && link.to.position === 'hour' && link.to.stem === '丙'));
 assert.ok(sealLuck.data.luckSealControlsOutput.some(link => link.seal.kind === '运干' && link.seal.stem === '丙'
  && link.day.god === '日元' && link.output.god === '食神'));
 assert.equal(match(sealLuck.run, 101).status, 'partial');
 assert.equal(match(sealLuck.run, 103).status, 'partial');
 const officerLuck = realOfficerPath(ref.calendarExamples[103]);
 assert.ok(officerLuck.data.luckOfficerFeedsSeal.some(link => link.officer.stem === '乙' && link.officer.kind === '运支藏干'
  && link.seal.position === 'hour' && link.seal.stem === '丙' && link.output.stem === '庚'));
 assert.equal(match(officerLuck.run, 103).status, 'partial');
});

test('seal-overlap passage requires distinct natal columns and a real wealth contact, with visible and hidden positions preserved', () => {
 const examples = [
  [ref.calendarExamples[104], true, 2],
  [ref.officerPathExamples.sealsHiddenAcrossColumns, true, 0],
  [ref.officerPathExamples.sealsInOneColumn, false, 0],
  [ref.calendarExamples[101], false, 0],
 ];
 for (const [example, overlap, exposed] of examples) {
  const { run, fact, data } = realOfficerPath(example);
  const hit = match(run, 104);
  assert.equal(hit.status, overlap ? 'partial' : 'not_matched', example.natal.join());
  assert.equal(hit.sourceFactIds.includes(fact.factId), overlap);
  assert.equal(data.sealsOverlapAcrossColumns, overlap);
  assert.equal(data.overlappingSeals.filter(row => row.kind === '透干').length, exposed);
  assert.ok(data.luckWealthControlsSeal.length);
  if (!overlap) assert.equal(data.overlappingSeals.length, 0);
  assert.equal(data.sealOverlapWealthPaths.length > 0, overlap);
  for (const path of data.sealOverlapWealthPaths) {
   assert.ok(path.affectedSeals.every(seal => data.luckWealthControlsSeal.some(link => link.from.kind === path.moving.kind
    && link.from.stem === path.moving.stem && link.to.position === seal.position && link.to.stem === seal.stem)));
   assert.ok(path.fedByOutput.length);
  }
 }
});

test('p061 separates Xuan’s support and reversal at actual Ding-Mao while p062 excludes the same source example', async () => {
 const date = [1879, 7, 18], run = submitted(date, 22, 1913);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丁卯');
 assert.ok(change);
 const boundary = change.exactInstant;
 const before = rows(run).find(row => row.normalizedPayload.luckPillar === '戊辰' && row.activeTo === boundary);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '丁卯' && row.activeFrom === boundary);
 assert.ok(before && after);
 const original = match(run, 103);
 assert.equal(original.status, 'matched');
 assert.ok(original.sourceFactIds.includes(before.factId));
 assert.ok(original.sourceFactIds.includes(after.factId));
 assert.equal(original.matchedSourceExcerpt, '官旺所以生印\n財星破印');
 const [support, reversal] = original.confirmedBranches;
 assert.equal(support.windows.at(-1).endExclusive, boundary);
 assert.equal(reversal.windows[0].start, boundary);
 assert.ok(support.sourceFactIds.includes(before.factId) && !support.sourceFactIds.includes(after.factId));
 assert.ok(reversal.sourceFactIds.includes(after.factId) && !reversal.sourceFactIds.includes(before.factId));
 assert.equal(match({ ...run, facts: [before] }, 103).matchedSourceExcerpt, '官旺所以生印');
 assert.equal(match({ ...run, facts: [after] }, 103).matchedSourceExcerpt, '財星破印');
 assert.equal(before.normalizedPayload.hasOfficerSealProtection, true);
 assert.equal(before.normalizedPayload.hasXuanSourceSealAid, true);
 assert.equal(before.normalizedPayload.hasXuanSourceWealthBreaksSeal, false);
 assert.equal(after.normalizedPayload.hasOfficerSealProtection, false);
 assert.equal(after.normalizedPayload.hasXuanSourceSealAid, false);
 assert.equal(after.normalizedPayload.hasXuanSourceWealthBreaksSeal, true);
 assert.deepEqual(after.normalizedPayload.printedLuckCaseIds, ['xuan']);
 assert.deepEqual([100, 101, 104].map(index => match(run, index).status), ['not_matched', 'not_matched', 'not_matched']);
 const relevant = p => p.officerSealProtectionPaths.filter(row => row.seal.stem === '辛' && row.seal.kind === '透干'
  && row.output.position === 'year' && row.output.stem === '乙');
 const early = relevant(before.normalizedPayload), late = relevant(after.normalizedPayload);
 assert.deepEqual(early.map(row => [row.officer.position, row.officer.stem, row.seal.position, row.day.stem]),
  [['month', '己', 'month', '壬'], ['month', '己', 'hour', '壬']]);
 assert.ok(early.every(row => row.movingAuthority.some(value => value.kind === '运干' && value.stem === '戊')));
 assert.ok(late.every(row => row.movingWealth.some(value => value.kind === '运干' && value.stem === '丁')));
 const data = after.normalizedPayload;
 assert.equal(data.xuanSealComparison.woodGroup.nativeComplete, true);
 assert.deepEqual(data.xuanSealComparison.yinHai.members, ['day', 'hour']);
 assert.deepEqual(data.sealOverlapWealthPaths.map(path => [path.moving.stem, path.affectedSeals.map(seal => seal.position)]),
  [['丁', ['month', 'hour']]]);
 assert.equal(data.hasOfficerWealthAid, true);
 assert.equal(data.hasOfficerSealWealthOutput, true);
 assert.equal(data.officerSealOutputNamedForRestraint, true);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'xuan-seal-protection'));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /原局还有日柱壬寅与时柱辛亥六合/u);
 assert.match(prompt, /徐注在原例取月柱透干辛（正印）、时柱透干辛（正印）制伤滋身/u);
 assert.match(prompt, /本步大运运干丁（正财）分别有克月柱透干辛（正印）、时柱透干辛（正印）的方向/u);
 assert.match(prompt, /宣参国原例交入丁卯后，运干丁财克原局辛印/u);
 assert.doesNotMatch(prompt, /officerSealProtectionPaths|sealOverlapWealthPaths|officerSealOutputNamedForRestraint/u);
 const providerText = await providerMessage(input);
 assert.match(providerText, /依徐注宣参国原例的取法.*官杀运干生原局月、时两处辛印/u);
 assert.match(providerText, /实际交入丁卯后，运干丁财分别克月柱透辛及时柱透辛/u);
 assert.doesNotMatch(providerText, /若傷官重印綬輕，喜行印地|xuanSealComparison|hasXuanSourceSealAid|hasXuanSourceWealthBreaksSeal/u);
 const variant = submitted(date, 20, 1917);
 const altered = rows(variant).find(row => row.normalizedPayload.luckPillar === '丁卯');
 assert.ok(altered);
 assert.equal(altered.normalizedPayload.officerSealOutputNamedForRestraint, false);
 assert.equal(altered.normalizedPayload.hasXuanSourceWealthBreaksSeal, false);
 assert.equal(ctx('xuan', '戊辰', false).hasXuanSourceSealAid, undefined);
 assert.equal(ctx('xuan', '丁卯', false).hasXuanSourceWealthBreaksSeal, undefined);
 assert.deepEqual([100, 101, 104].map(index => match(variant, index).status), ['partial', 'partial', 'partial']);
 const wrongHourSameLuck = submitted(date, 20, 1907);
 const changedNatal = rows(wrongHourSameLuck).find(row => row.normalizedPayload.luckPillar === '戊辰');
 assert.ok(changedNatal);
 assert.equal(changedNatal.normalizedPayload.hasXuanSourceSealAid, false);
 assert.notEqual(match(wrongHourSameLuck, 103).status, 'matched');
});

test('Xuan printed conversion excludes two ordinary officer support paths at the actual Jia-Zi handover', () => {
 const date = [1879, 7, 18];
 for (const [hour, named] of [[22, true], [20, false]]) {
  const run = submitted(date, hour, 1943);
  const boundary = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '甲子')?.exactInstant;
  assert.ok(boundary);
  if (named) assert.equal(boundary, '1943-03-21T20:00:00.000Z');
  const before = rows(run).find(row => row.normalizedPayload.luckPillar === '乙丑' && row.activeTo === boundary);
  const after = rows(run).find(row => row.normalizedPayload.luckPillar === '甲子' && row.activeFrom === boundary);
  assert.ok(before && after);
  const data = after.normalizedPayload;
  assert.equal(data.officerSealOutputNamedForRestraint, named);
  assert.equal(data.hasOfficerWealthBodySupport, true);
  assert.equal(data.hasOfficerSealBodySupport, true);
  assert.deepEqual(data.officerSealBodySupport.peers.map(row => [row.kind, row.stem]), [['运支藏干', '癸']]);
  assert.ok(data.monthOfficerWealthPaths.some(path => path.officer.position === 'month' && path.officer.stem === '己'
   && path.nativeWealth.some(wealth => wealth.position === 'month' && wealth.stem === '丁')));
  assert.ok(data.monthOfficerSealPaths.some(path => path.officer.position === 'month' && path.officer.stem === '己'
   && path.seal.position === 'month' && path.seal.stem === '辛' && path.day.stem === '壬'));
  for (const index of [99, 102]) {
   assert.equal(match({ ...run, facts: [after] }, index).status, named ? 'not_matched' : 'partial');
  }
  if (named) {
   const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'converted-officer-comparison'));
   const localSource = /宣参国图原评用辛印制伤/u;
   assert.match(formatFortuneFactAudit(input), localSource);
   assert.doesNotMatch(formatFortunePrompt(input), localSource);
  }
 }
});

test('Xue original Jia luck has no Ji target while the stated Ji-You-year comparison names actual Ji wealth, rather than relabeling it as a seal',()=>{
 const original=ctx('xue','甲寅'),counter=ctx(natal(ref.counterfactual.pillars),'甲寅');assert.equal(original.movingFivePairs.length,0);
 assert.ok(counter.movingFivePairs.some(p=>p.target.stem==='己'&&p.target.tenGod==='偏财'&&p.target.position==='year'));
 assert.ok(counter.natalFivePairs.every(p=>p.first.stem!=='甲'&&p.second.stem!=='甲'));
 assert.equal(counter.protectionVerified,false);assert.equal(original.protectionVerified,false);
 const text=describeFortuneFact({method:'bazi',type:'zpqz_officer_context',data:original},String);
 for(const phrase of ['官藏申而未明透','戌运不伤印与戌运破印','反设不是当前甲申年原局'])assert.ok(text.includes(phrase),phrase);
});

test('Zaqi hidden Yi-Geng across Mao-Shen is not a branch six-combination and the missing Si from the other commentary is never inserted',()=>{
 const p=ctx('zaqi','壬子');assert.ok(p.hiddenFivePairs.some(r=>[r.first.stem,r.second.stem].sort().join('')==='乙庚'&&[r.first.position,r.second.position].sort().join()==='day,hour'));
 assert.ok(!p.nativeRelations.some(r=>r.kind==='六合'&&r.members.includes('day')&&r.members.includes('hour')));
 assert.ok(!p.natalPillars.some(r=>r.pillar[1]==='巳'));assert.ok(p.natalFivePairs.some(r=>r.first.stem==='壬'&&r.second.stem==='丁'));
 const text=describeFortuneFact({method:'bazi',type:'zpqz_officer_context',data:p},String);for(const phrase of ['戊甲','取运图无巳','卯申称为地支六合'])assert.ok(text.includes(phrase),phrase);
});

test('Jin wood group is complete but transformation is unverified, and day Ding remains the day master rather than another exposed companion',()=>{
 const p=ctx('jin','庚申'),g=p.threeCombinationGroups.find(r=>r.values==='亥卯未');assert.equal(g.nativeComplete,true);
 assert.deepEqual(p.gods.find(r=>r.god==='比肩').exposedRows.map(r=>r.position),['month']);assert.equal(p.transformationVerified,false);
 assert.ok(p.dayOutputContacts.every(r=>r.from.god==='日元'));assert.ok(p.movingFivePairs.some(r=>r.target.stem==='乙'&&r.target.tenGod==='偏印'));
});

test('Xuan named Xin seals control actual Yi hurt and are generated by actual Ji officer, while arriving Ding wealth attacks both Xin seals',()=>{
 const p=ctx('xuan','丁卯');assert.ok(p.sealOutputContacts.some(r=>r.from.stem==='辛'&&r.to.stem==='乙'&&r.to.god==='伤官'));
 assert.ok(p.officerSealContacts.some(r=>r.from.stem==='己'&&r.from.god==='正官'&&r.to.stem==='辛'));
 assert.deepEqual(p.movingContacts.filter(r=>r.from.kind==='运干'&&r.from.stem==='丁'&&r.relation==='克'&&r.to.stem==='辛').map(r=>r.to.position),['month','hour']);
 assert.equal(p.protectionVerified,false);
});

test('Fan Si-Chou lacks You until an actual You branch supplies it, while natal Ding-Ren and moving Ren-to-Bing remain different named operations',()=>{
 const a=ctx('fan','庚申'),b=ctx('fan','辛酉');assert.equal(a.threeCombinationGroups.find(r=>r.values==='巳酉丑').complete,false);
 assert.deepEqual(a.threeCombinationGroups.find(r=>r.values==='巳酉丑').missingKnownBranches,['酉']);assert.equal(b.threeCombinationGroups.find(r=>r.values==='巳酉丑').complete,true);
 assert.ok(a.natalFivePairs.some(r=>r.first.stem==='丁'&&r.second.stem==='壬'));const ren=ctx('fan','壬子');
 assert.ok(ren.movingContacts.some(r=>r.from.kind==='运干'&&r.from.stem==='壬'&&r.to.stem==='丙'&&r.to.god==='正印'&&r.relation==='克'));
 assert.ok(ren.movingFivePairs.some(r=>r.target.stem==='丁'&&r.target.tenGod==='偏印'));assert.equal(ren.transformationVerified,false);
});

test('same officer branch coordinates retain actual native and moving contacts and Lu is a coordinate rather than a declared effective strength',()=>{
 const p=ctx('xue','乙亥');assert.ok(p.officerBranchRelations.length>0);assert.deepEqual(p.gods.find(r=>r.god==='正官').hiddenRows.map(r=>r.position),['year','month','day']);
 assert.ok(p.officerBranchRelations.every(r=>r.members.some(position=>['year','month','day'].includes(position))));
 assert.ok(p.movingRelations.some(r=>r.kind==='六冲'&&r.members.includes('day')));assert.equal(p.luBranch,'卯');assert.equal(ctx('xue','丁卯').luckAtLu,true);
 assert.equal(p.strengthVerified,false);assert.equal(p.effectTimingVerified,false);
});

test('nine calendar examples retain exact natal columns and source raw IDs inside uniquely verified whole luck segments',()=>{
 for(const i of indices){const run=real(i),e=ref.calendarExamples[i];validateFortuneFacts(run);assert.equal(match(run,i).status,completeSourceIndices.has(i)?'matched':'partial',String(i));const selected=rows(run).filter(f=>f.normalizedPayload.confirmed&&f.normalizedPayload.luckPillar===e.luck);assert.ok(selected.length);
  for(const f of selected){assert.deepEqual(f.normalizedPayload.natalPillars.map(p=>p.pillar),e.natal);assert.ok(f.normalizedPayload.stageStart<=f.activeFrom&&f.activeTo<=f.normalizedPayload.stageEnd);assert.ok(f.sourceFactIds.every(id=>run.rawFacts.some(raw=>raw.rawFactId===id)));}}
});

test('all nine SQLite rows keep their source hashes and no cross-candidate split can manufacture exposed wealth and seal',()=>{
 for(const i of indices){const r=fortuneKnowledge.bazi.rules[i],e=fortuneKnowledge.bazi.entries.find(e=>e.id===r.knowledgeId);assert.equal(r.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:e.evidence,conditions:e.conditions})).digest('hex'));assert.equal(r.queries.length,1);assert.equal(r.queries[0].factType,'zpqz_officer_context');assert.equal(r.unresolved.length,completeSourceIndices.has(i)?0:1);}
 const split=structuredClone(real('xue'));for(const f of rows(split)){const other=structuredClone(f);other.factId+='-other';f.normalizedPayload.sealsExposed=false;other.normalizedPayload.wealthExposed=false;split.facts.push(other);}assert.equal(match(split,98).status,'not_matched');
});

test('verified luck pillars for officer cases carry the source reading through client facts, SQLite and the model', () => {
  const cases = [
    ['xue', [1944, 8, 9], 4, 2008, '戊寅', 98, '作为原局与运支的两寅冲官对照', true],
    ['zaqi', [1922, 8, 8], 6, 1958, '辛亥', 100, '按运表整柱核位，对照正文亥子财地的助官判语', false],
    ['zaqi', [1922, 8, 8], 6, 1966, '壬子', 100, '按运表整柱核位，对照正文亥子财地的助官判语', false],
    ['jin', [1915, 11, 12], 20, 1934, '乙酉', 101, '列入先行的申酉财地', false],
    ['jin', [1915, 11, 12], 20, 1940, '甲申', 101, '列入先行的申酉财地', false],
    ['jin', [1915, 11, 12], 20, 1960, '壬午', 101, '列作南方运见壬官而泄财生印的对照', true],
    ['xuan', [1879, 7, 18], 22, 1901, '己巳', 103, '列作官杀生辛印的运步', false],
    ['xuan', [1879, 7, 18], 22, 1907, '戊辰', 103, '列作官杀生辛印的运步', false],
    ['xuan', [1879, 7, 18], 22, 1917, '丁卯', 103, '留存评注对运干丁财损辛印的提醒', false],
  ];
  for (const [id, date, hour, year, luck, index, assessment, independent] of cases) {
    const run = submitted(date, hour, year);
    const selected = rows(run).filter(row => row.normalizedPayload.luckPillar === luck);
    assert.ok(selected.length, id + ' ' + luck);
    for (const fact of selected) {
      const p = fact.normalizedPayload;
      assert.equal(p.confirmed, true);
      assert.deepEqual(p.natalPillars.map(row => row.pillar), ref.printedCases.find(row => row.id === id).pillars);
      assert.deepEqual(p.printedLuckCaseIds, [id]);
      assert.ok(p.printedLuck[0].assessment.startsWith(assessment));
      assert.ok(p.stageStart <= fact.activeFrom && fact.activeTo <= p.stageEnd);
    }
    const hit = match(run, index);
    const auditOnly = independent;
    const expectedStatus = auditOnly ? 'not_matched' : 'matched';
    assert.equal(hit.status, expectedStatus, id + ' ' + luck);
    if (id === 'xuan') assert.equal(hit.matchedSourceExcerpt, luck === '丁卯' ? '財星破印' : '官旺所以生印');
    assert.ok(selected.every(fact => hit.sourceFactIds.includes(fact.factId) === !auditOnly));
    const structural = structuredClone(run);
    rows(structural).forEach(row => { row.normalizedPayload.printedLuckCaseIds = []; });
    assert.equal(match(structural, index).status, expectedStatus);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'officer-printed-luck'));
    assert.ok(formatFortuneFactAudit(input).includes('将所核的' + luck + '运' + assessment));
    assert.equal(input.sections.some(section => section.findings.some(finding => finding.knowledgeId === hit.knowledgeId)),
      expectedStatus === 'matched');
  }
});

test('Xue confirms both named paths at a real transition and preserves the conflicting Xu readings', async () => {
  const transition = submitted([1944, 8, 9], 4, 1964), boundary = '1964-08-02T10:00:00.000Z';
  const old = rows(transition).find(row => row.activeTo === boundary);
  const next = rows(transition).find(row => row.activeFrom === boundary);
  assert.equal(old.normalizedPayload.luckPillar, '癸酉');
  assert.equal(old.normalizedPayload.stageEnd, boundary);
  const { officer: natalOfficer, wealth, officerRoots, wealthRoots } = old.normalizedPayload.xueSourceNatalOfficerWealthRoots;
  assert.deepEqual([natalOfficer.position, natalOfficer.stem, wealth.position, wealth.stem], ['month', '庚', 'hour', '戊']);
  assert.deepEqual(officerRoots.map(({ position, branch, phase }) => [position, branch, phase]),
    [['year', '申', '临官'], ['month', '申', '临官'], ['day', '巳', '长生']]);
  assert.deepEqual(wealthRoots.map(({ position, branch, phase }) => [position, branch, phase]),
    [['day', '巳', '临官'], ['hour', '寅', '长生']]);
  assert.deepEqual(next.normalizedPayload.xueSourceNatalOfficerWealthRoots, old.normalizedPayload.xueSourceNatalOfficerWealthRoots);
  assert.equal(next.normalizedPayload.luckPillar, '甲戌');
  assert.equal(next.normalizedPayload.stageStart, boundary);
  assert.deepEqual(next.normalizedPayload.xueXuWealth.map(path => [path.from.kind, path.from.stem, path.to.position, path.to.stem, path.companionControlsWealth]),
    [['运支藏干', '戊', 'month', '壬', true]]);
  assert.deepEqual(next.normalizedPayload.counterfactualWealthSeal, []);
  const matches = matchFortuneKnowledge(transition).byMethod.bazi, hit = matches[98];
  assert.equal(hit.status, 'matched');
  assert.ok(hit.sourceFactIds.includes(old.factId));
  assert.ok(!hit.sourceFactIds.includes(next.factId));
  assert.equal(hit.windows.at(-1).endExclusive, boundary);
  const xueSupport = old.normalizedPayload.xueSourceOfficerSealSupport;
  assert.deepEqual([xueSupport.officer.position, xueSupport.officer.stem, xueSupport.seal.position,
    xueSupport.seal.stem, xueSupport.movingSeal.kind, xueSupport.movingSeal.stem],
  ['month', '庚', 'month', '壬', '运干', '癸']);
  assert.equal(old.normalizedPayload.hasXueSourceOfficerSealSupport, true);
  assert.equal(next.normalizedPayload.hasXueSourceOfficerSealSupport, false);
  assert.equal(old.normalizedPayload.xueSourceOfficerSealFurtherRoute, undefined);
  assert.equal(next.normalizedPayload.xueSourceOfficerSealFurtherRoute, 'jia-xu-peer');
  const peer = next.normalizedPayload.xueSourceOfficerSealFurtherSupport;
  assert.deepEqual([peer.officer.stem, peer.seal.stem, peer.day.stem, peer.moving.stem, peer.moving.kind], ['庚', '壬', '乙', '甲', '运干']);
  assert.equal(ctx({ ...printed('xue'), hour: '丁丑' }, '癸酉').hasXueSourceOfficerSealSupport, false);
  assert.equal(ctx('xue', '癸酉', false).hasXueSourceOfficerSealSupport, undefined);
  const support = matches[102];
  assert.equal(support.status, 'matched');
  assert.ok(support.sourceFactIds.includes(old.factId));
  assert.ok(support.sourceFactIds.includes(next.factId));
  assert.deepEqual(support.windows, [{
    start: transition.time.displayWindow.instantRange.startInstant,
    endExclusive: transition.time.displayWindow.instantRange.endInstantExclusive,
  }]);
  const y = support.confirmedBranches.find(branch => branch.sourceFactIds.includes(old.factId));
  const j = support.confirmedBranches.find(branch => branch.sourceFactIds.includes(next.factId));
  assert.equal(y.windows.at(-1).endExclusive, boundary);
  assert.equal(j.windows[0].start, boundary);
  assert.match(y.conditions.join(''), /薛相公原图.*兼用财与印/u);
  assert.match(j.conditions.join(''), /甲戌/u);
  assert.equal(next.normalizedPayload.officerWealthNamedWeak, true);
  assert.equal(next.normalizedPayload.hasOfficerWealthAid, true);
  assert.equal(next.normalizedPayload.hasOfficerSealWealthOutput, true);
  const wealthSupport = matches[99];
  assert.equal(wealthSupport.status, 'matched');
  assert.equal(wealthSupport.matchedSourceExcerpt, '身弱喜印綬身旺之地');
  const guiYou = wealthSupport.confirmedBranches.find(branch => branch.sourceFactIds.includes(old.factId));
  const jiaXu = wealthSupport.confirmedBranches.find(branch => branch.sourceFactIds.includes(next.factId));
  assert.equal(guiYou.windows.at(-1).endExclusive, boundary);
  assert.equal(jiaXu.windows[0].start, boundary);
  assert.deepEqual([100, 101].map(index => matches[index].status), ['not_matched', 'not_matched']);
  assert.equal(next.normalizedPayload.sealsOverlapAcrossColumns, true);
  assert.equal(next.normalizedPayload.hasSealOverlapWealth, true);
  assert.equal(matches[104].status, 'not_matched');
  const near = { ...next, normalizedPayload: { ...ctx({ ...printed('xue'), hour: '丁丑' }, '甲戌'), confirmed: true } };
  assert.equal(near.normalizedPayload.officerWealthNamedWeak, false);
  assert.equal(near.normalizedPayload.xueSourceOfficerSealFurtherRoute, undefined);
  assert.notEqual(match({ ...transition, facts: [near] }, 102).status, 'matched');
  const nearRules = evaluateFortuneRules('bazi', 'year', [near]);
  for (const index of [100, 101]) assert.deepEqual(nearRules.find(row => row.knowledgeId === matches[index].knowledgeId).required[0].hits, [near]);
  assert.equal(ctx('xue', '甲戌', false).officerWealthNamedWeak, undefined);
  const { input } = buildFortuneModelContext(transition, interpretFortune(transition, requestForFortuneRun(transition), 'officer-transition'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /癸酉运依酉支七杀记为泄财生印的对照/u);
  assert.match(prompt, /甲戌运同时留存戌运财旺而印未损、戌运财星破印两处判语/u);
  assert.match(prompt, /同一戌土也受本步运干甲克/u);
  assert.match(prompt, /薛例原月官.*同运另核助身位置/u);
  const content = await providerMessage(input);
  assert.match(content, /徐注认为财印可兼用.*酉藏辛杀承时戊之生/u);
  assert.match(content, /财官较旺、乙木身稍轻.*保留戌土伤印与不伤印/u);
  assert.match(content, /实际癸酉运中，酉辛从财接至原月壬印，运干癸也生乙日元/u);
  assert.match(content, /薛相公原图依徐注为财官过旺、身稍轻，兼用财与印/u);
  assert.match(content, /实际助身方向/u);
  assert.doesNotMatch(content, /hasXueSourceOfficerSealSupport|xueSourceOfficerSealFurtherSupport|薛例原月官/u);

  const north = submitted([1944, 8, 9], 4, 1984), northBoundary = '1984-08-02T10:00:00.000Z';
  const haiFact = rows(north).find(row => row.activeTo === northBoundary && row.normalizedPayload.luckPillar === '乙亥');
  const ziFact = rows(north).find(row => row.activeFrom === northBoundary && row.normalizedPayload.luckPillar === '丙子');
  assert.ok(haiFact && ziFact);
  assert.deepEqual(haiFact.normalizedPayload.xueHaiClashes.map(pair => [pair.kind, ...pair.members]),
    [['六害', 'year', 'decadal'], ['六害', 'month', 'decadal'], ['六冲', 'day', 'decadal']]);
  assert.equal(haiFact.normalizedPayload.hasXueSourceNorthernSealOutput, false);
  assert.equal(ziFact.normalizedPayload.hasXueSourceNorthernSealOutput, true);
  assert.equal(haiFact.normalizedPayload.xueSourceOfficerSealFurtherRoute, 'yi-hai-seal-peer');
  const hai = haiFact.normalizedPayload.xueSourceOfficerSealFurtherSupport;
  assert.deepEqual([hai.officer.stem, hai.seal.stem, hai.day.stem, hai.moving.kind, hai.moving.stem, hai.peer.kind, hai.peer.stem],
    ['庚', '壬', '乙', '运支藏干', '壬', '运干', '乙']);
  assert.deepEqual(hai.clashes, haiFact.normalizedPayload.xueHaiClashes);
  assert.equal(ziFact.normalizedPayload.xueSourceOfficerSealFurtherRoute, 'bing-zi-seal');
  assert.deepEqual(ziFact.normalizedPayload.xueSourceOfficerSealFurtherSupport.moving, ziFact.normalizedPayload.xueSourceNorthernSealOutput.seal);
  const { seal, day, officer, output } = ziFact.normalizedPayload.xueSourceNorthernSealOutput;
  assert.deepEqual([seal.kind, seal.stem, day.stem, officer.pillar, officer.stem, output.kind, output.stem],
    ['运支藏干', '癸', '乙', '壬申', '庚', '运干', '丙']);
  const northMatch = match(north, 99);
  assert.equal(northMatch.status, 'matched');
  const { startInstant, endInstantExclusive } = north.time.displayWindow.instantRange;
  assert.deepEqual(northMatch.confirmedBranches.map(branch => branch.windows), [
    [{ start: startInstant, endExclusive: northBoundary }], [{ start: northBoundary, endExclusive: endInstantExclusive }],
  ]);
  const ziOnly = { ...north, facts: [ziFact] };
  const northSealMatch = match(north, 102);
  assert.equal(northSealMatch.matchedSourceExcerpt, '宜行比劫祿印之地也');
  assert.deepEqual(northSealMatch.windows, [{ start: startInstant, endExclusive: endInstantExclusive }]);
  const haiConfirmation = northSealMatch.confirmedBranches.find(branch => branch.sourceFactIds.includes(haiFact.factId));
  const ziConfirmation = northSealMatch.confirmedBranches.find(branch => branch.sourceFactIds.includes(ziFact.factId));
  assert.deepEqual(haiConfirmation.windows, [{ start: startInstant, endExclusive: northBoundary }]);
  assert.deepEqual(ziConfirmation.windows, [{ start: northBoundary, endExclusive: endInstantExclusive }]);
  assert.match(haiConfirmation.conditions.join(''), /乙亥.*日巳/u);
  const haiOnly = { ...north, facts: [haiFact] };
  const haiInput = buildFortuneModelContext(haiOnly, interpretFortune(haiOnly, requestForFortuneRun(haiOnly), 'xue-hai-seal')).input;
  const haiProvider = await providerMessage(haiInput);
  const haiAudit = /薛例实排乙亥.*运亥同时冲日巳并害原年月申/u;
  assert.match(formatFortuneFactAudit(haiInput), haiAudit);
  assert.match(haiProvider, /乙亥.*日巳/u);
  assert.doesNotMatch(haiProvider, haiAudit);
  assert.doesNotMatch(haiProvider, /xueSourceOfficerSealFurtherRoute|yi-hai-seal-peer/u);
  const northInput = buildFortuneModelContext(ziOnly, interpretFortune(ziOnly, requestForFortuneRun(ziOnly), 'xue-northern-seal')).input;
  const northProvider = await providerMessage(northInput);
  assert.match(northProvider, /子中本气癸印生乙日元/u);
  assert.match(northProvider, /运干丙伤官克原局月申同一庚官/u);
  assert.match(northProvider, /宜行比劫祿印之地也/u);
  assert.doesNotMatch(northProvider, /实排甲戌|乙亥.*日巳|hasXueSourceNorthernSealOutput|xueSourceOfficerSealFurtherRoute/u);
  const otherHour = submitted([1944, 8, 9], 6, 1984);
  const otherHai = rows(otherHour).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '乙亥');
  assert.ok(otherHai);
  assert.equal(otherHai.normalizedPayload.xueSourceOfficerSealFurtherRoute, undefined);
  assert.notEqual(match({ ...otherHour, facts: [otherHai] }, 102).status, 'matched');
  for (const other of [ctx('xue', '丁丑'), ctx({ ...printed('xue'), hour: '丁丑' }, '丙子')]) {
    assert.equal(other.hasXueSourceNorthernSealOutput, false);
  }
  assert.equal(ctx('xue', '丙子', false).hasXueSourceNorthernSealOutput, undefined);
  const yin = submitted([1944, 8, 9], 4, 2008);
  const yinFact = rows(yin).find(row => row.normalizedPayload.luckPillar === '戊寅');
  assert.deepEqual(yinFact.normalizedPayload.xueYinShenClashes.map(pair => pair.members),
    [['year', 'hour'], ['month', 'hour'], ['year', 'decadal'], ['month', 'decadal']]);

  const wrongHour = submitted([1879, 7, 18], 20, 1917);
  assert.ok(rows(wrongHour).every(row => row.normalizedPayload.luckPillar === '丁卯'
    && row.normalizedPayload.printedLuckCaseIds.length === 0));
  assert.equal(match(wrongHour, 103).status, 'not_matched');
  assert.deepEqual(ctx('xuan', '丁卯', false).printedLuckCaseIds, []);
  assert.deepEqual(ctx('zaqi', '庚戌').printedLuckCaseIds, []);
  assert.doesNotMatch(prompt, /printedLuckCaseIds|printedLuck/u);
});

test('Xue northern Chou confirms the remaining hidden seal without treating it as primary Qi', async () => {
  const run = submitted([1944, 8, 9], 4, 1994);
  const boundary = run.facts.find(({ factType, normalizedPayload: p }) =>
    factType === 'luck_transition' && p.toPillar === '丁丑').exactInstant;
  assert.equal(boundary, '1994-08-02T10:00:00.000Z');
  const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '丙子');
  const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '丁丑');
  assert.ok(before && after);
  assert.equal(before.normalizedPayload.hasXueSourceChouNorthernSeal, false);
  assert.equal(before.normalizedPayload.hasXueSourceNorthernSealOutput, true);
  assert.equal(after.normalizedPayload.hasXueSourceNorthernSealOutput, false);
  assert.equal(after.normalizedPayload.hasXueSourceChouNorthernSeal, true);
  assert.deepEqual(after.normalizedPayload.xueSourceNatalOfficerWealthRoots, before.normalizedPayload.xueSourceNatalOfficerWealthRoots);
  const { seal, day, output, mainQi, officer } = after.normalizedPayload.xueSourceChouNorthernSeal;
  assert.deepEqual([seal.kind, seal.stem, day.stem, output.stem, output.god, mainQi.stem, mainQi.god, officer.stem],
    ['运支藏干', '癸', '乙', '丁', '食神', '己', '偏财', '庚']);
  assert.equal(after.normalizedPayload.hasOfficerWealthBodySupport, false);
  assert.equal(after.normalizedPayload.hasOfficerSealBodySupport, false);
  assert.equal(after.normalizedPayload.xueSourceOfficerSealFurtherRoute, 'ding-chou-hidden-seal');
  assert.deepEqual(after.normalizedPayload.xueSourceOfficerSealFurtherSupport.moving, seal);
  const isolated = { ...run, facts: [after] }, hit = match(isolated, 99);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: after.activeTo }]);
  const sealHit = match(isolated, 102);
  assert.equal(sealHit.matchedSourceExcerpt, '宜行比劫祿印之地也');
  assert.deepEqual(sealHit.windows, hit.windows);
  const other = submitted([1944, 8, 9], 2, 1994);
  const otherChou = rows(other).find(row => row.normalizedPayload.luckPillar === '丁丑');
  assert.ok(otherChou && otherChou.normalizedPayload.hasXueSourceChouNorthernSeal === false);
  assert.equal(otherChou.normalizedPayload.xueSourceNatalOfficerWealthRoots, undefined);
  assert.notEqual(match({ ...other, facts: [otherChou] }, 99).status, 'matched');
  assert.notEqual(match({ ...other, facts: [otherChou] }, 102).status, 'matched');
  assert.equal(ctx('xue', '丁丑', false).hasXueSourceChouNorthernSeal, undefined);
  assert.equal(ctx('xue', '戊寅').hasXueSourceChouNorthernSeal, false);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'xue-chou-seal'));
  const local = formatFortuneFactAudit(input);
  assert.match(local, /薛例庚官的临官位实在.*薛例戊财的长生位实在/us);
  assert.match(local, /薛例实交丁丑时，丑中余藏癸偏印生乙日元/u);
  const chainAudit = /薛例原月官.*同运另核助身位置/u;
  assert.match(local, chainAudit);
  const provider = await providerMessage(input);
  assert.match(provider, /丑中余藏癸偏印生乙日元/u);
  assert.match(provider, /宜行比劫祿印之地也/u);
  assert.doesNotMatch(provider, /子中本气癸印|临官位实在|薛例实交丁丑时|xueSourceChouNorthernSeal|xueSourceNatalOfficerWealthRoots|xueSourceOfficerSealFurtherRoute/u);
  assert.doesNotMatch(provider, chainAudit);
});

test('chapter 32 verifies the four source-specific officer paths at the real luck boundaries', () => {
  const cases = [
    {
      index: 98, date: [1944, 8, 9], hour: 4, year: 1964, luck: '癸酉',
      field: 'hasXueSourceWealthOfficerSeal', generic: { officerLuckRoutes: [], hasCounterfactualWealthSeal: false },
      audit: /薛例癸酉的同一财官印路径.*财印中隔日柱乙巳/u,
      evidence(p) {
        const { wealth, through, seal, between } = p.xueSourceWealthOfficerSeal;
        assert.deepEqual([wealth.position, wealth.stem, wealth.kind], ['hour', '戊', '透干']);
        assert.deepEqual([through.kind, through.stem, through.god], ['运支藏干', '辛', '七杀']);
        assert.deepEqual([seal.position, seal.stem, seal.kind], ['month', '壬', '透干']);
        assert.deepEqual(between.map(row => [row.position, row.pillar]), [['day', '乙巳']]);
      },
    },
    {
      index: 99, date: [1944, 8, 9], hour: 4, year: 1964, luck: '甲戌',
      field: 'hasXueSourceBodySupport', generic: { hasOfficerWealthBodySupport: false },
      audit: /薛例原评所取的这步助身成分为本步大运运干甲（劫财）/u,
      evidence(p) {
        const support = p.xueSourceBodySupport;
        assert.deepEqual([support.kind, support.stem, support.god], ['运干', '甲', '劫财']);
      },
    },
    {
      index: 100, date: [1922, 8, 8], hour: 6, year: 1952, luck: '辛亥',
      field: 'hasZaqiSourceOfficerAid', generic: { hasOfficerWealthAid: false },
      audit: /杂气原图的实际运支水财.*生同一月令所藏官月柱支藏乙（正官）/u,
      evidence(p) {
        const { officer, movingWealth, movingOutput } = p.zaqiSourceOfficerAid;
        assert.deepEqual([officer.position, officer.pillar, officer.stem], ['month', '丁未', '乙']);
        assert.deepEqual(movingWealth.map(row => [row.kind, row.stem]), [['运支藏干', '壬']]);
        assert.deepEqual(movingOutput.map(row => [row.kind, row.stem]), [['运干', '辛']]);
      },
    },
    {
      index: 101, date: [1915, 11, 12], hour: 20, year: 1947, luck: '甲申',
      field: 'hasJinSourceWealthTrimsSeal', generic: { hasOfficerSealWealthOutput: false },
      audit: /金状元原评所取的实际运支金财.*同查年透乙印和月藏甲印/u,
      evidence(p) {
        const [wealth] = p.jinSourceWealthTrimsSeal;
        assert.deepEqual([wealth.kind, wealth.stem, wealth.god], ['运支藏干', '庚', '正财']);
        const targets = p.luckWealthControlsSeal.filter(link => link.from.kind === wealth.kind && link.from.stem === wealth.stem)
          .map(link => [link.to.position, link.to.stem, link.to.kind]);
        assert.ok(targets.some(([position, stem, kind]) => position === 'year' && stem === '乙' && kind === '透干'));
        assert.ok(targets.some(([position, stem, kind]) => position === 'month' && stem === '甲' && kind === '支藏'));
        assert.equal(p.jinSealComparison.woodGroup.nativeComplete, true);
      },
    },
  ];
  const runs = new Map(), audits = new Map();
  for (const { index, date, hour, year, luck, field, generic, audit, evidence } of cases) {
    const key = date.join('-');
    if (!runs.has(key)) runs.set(key, submitted(date, hour, year));
    const run = runs.get(key);
    const actual = rows(run).filter(row => row.normalizedPayload[field]);
    assert.ok(actual.length, String(index));
    assert.ok(actual.every(row => row.normalizedPayload.luckPillar === luck && row.normalizedPayload.confirmed === true));
    actual.forEach(row => evidence(row.normalizedPayload));
    assert.ok(rows(run).some(row => row.normalizedPayload.luckPillar !== luck && row.normalizedPayload[field] === false));
    if (!audits.has(key)) {
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'officer-source-chapter'));
      audits.set(key, formatFortuneFactAudit(input));
    }
    assert.match(audits.get(key), audit);

    const sourceOnly = structuredClone(run);
    rows(sourceOnly).forEach(row => Object.assign(row.normalizedPayload, generic, { printedLuckCaseIds: [] }));
    const hit = match(sourceOnly, index);
    assert.equal(hit.status, 'matched', String(index));
    assert.deepEqual(hit.sourceFactIds, actual.map(row => row.factId));
    const transition = run.facts.find(row => row.factType === 'luck_transition');
    const after = transition.normalizedPayload.toPillar === luck;
    assert.equal(after ? hit.windows[0].start : hit.windows.at(-1).endExclusive, transition.exactInstant);

    rows(sourceOnly).forEach(row => { row.normalizedPayload[field] = false; });
    assert.equal(match(sourceOnly, index).status, 'not_matched', String(index));
  }
  assert.equal(ctx('xue', '乙亥').xueSourceBodySupport.stem, '壬');
  assert.equal(ctx('zaqi', '壬子').zaqiSourceOfficerAid.officer.stem, '乙');
  assert.deepEqual(ctx('jin', '乙酉').jinSourceWealthTrimsSeal.map(row => row.stem), ['辛']);
  assert.equal(ctx('xue', '癸酉', false).hasXueSourceWealthOfficerSeal, false);
  assert.equal(ctx({ ...printed('xue'), hour: '丁丑' }, '甲戌').hasXueSourceBodySupport, false);
  assert.equal(ctx({ ...printed('zaqi'), hour: '丙辰' }, '辛亥').hasZaqiSourceOfficerAid, false);
  assert.equal(ctx({ ...printed('jin'), hour: '己酉' }, '甲申').hasJinSourceWealthTrimsSeal, false);
});

test('p056 excludes the printed Zaqi bridge when the actual luck reaches only the joined wealth and seal', async () => {
 const date = [1922, 8, 8];
 for (const {hour, hourPillar, excluded} of [
  {hour: 6, hourPillar: '乙卯', excluded: true},
  {hour: 8, hourPillar: '丙辰', excluded: false},
 ]) {
  const run = submitted(date, hour, 1982);
  const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '甲寅');
  assert.ok(change);
  const previous = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '癸丑');
  const arrived = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '甲寅');
  assert.ok(previous && arrived);
  const p = arrived.normalizedPayload;
  assert.deepEqual(p.natalPillars.map(row => row.pillar), ['壬戌', '丁未', '戊申', hourPillar]);
  assert.ok(p.officerLuckRoutes.includes('wealth-officer-seal'));
  assert.ok(p.wealthSupportingOfficerSeal.some(path => path.combines && path.wealth.stem === '壬' && path.seal.stem === '丁'));
  assert.equal(previous.normalizedPayload.zaqiWealthSealSourceExcludesBridge, false);
  assert.equal(p.zaqiWealthSealSourceExcludesBridge, excluded);
  const result = match(run, 98);
  assert.equal(result.status, excluded ? 'not_matched' : 'partial');
  assert.equal(result.sourceFactIds.includes(arrived.factId), !excluded);
  assert.ok(!result.sourceFactIds.includes(previous.factId));
  const {input} = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'zaqi-bridge-comparison'));
  const audit = formatFortuneFactAudit(input);
  const sourceText = /杂气原评的年壬财与月丁印同合而失用/u;
  if (excluded) {
   const {wealth, seal, authorities} = p.zaqiInactiveWealthSeal;
   assert.ok(p.wealthSupportingOfficerSeal.every(path => path.combines));
   assert.deepEqual([wealth.position, wealth.stem, seal.position, seal.stem], ['year', '壬', 'month', '丁']);
   assert.deepEqual(authorities.map(row => [row.kind, row.stem]), [['运干', '甲'], ['运支藏干', '甲']]);
   assert.match(audit, sourceText);
   assert.doesNotMatch(await providerMessage(input), /杂气原评的年壬财|zaqiInactiveWealthSeal|zaqiWealthSealSourceExcludesBridge/u);
  } else {
   assert.equal(p.zaqiInactiveWealthSeal, undefined);
   assert.ok(p.wealthSupportingOfficerSeal.some(path => !path.combines && path.seal.position === 'hour' && path.seal.stem === '丙'));
   assert.equal(result.windows[0].start, change.exactInstant);
   assert.doesNotMatch(audit, sourceText);
  }
 }
 assert.equal(ctx('zaqi', '甲寅', false).zaqiWealthSealSourceExcludesBridge, undefined);
});

test('p056 excludes both Fan bridge shapes when Xu reads their shared exposed wealth as converted', async () => {
  const run = submitted([1937, 2, 11], 4, 1954, 0);
  const boundary = '1954-10-29T12:00:00.000Z';
  const previous = rows(run).find(row => row.activeTo === boundary);
  const current = rows(run).find(row => row.activeFrom === boundary);
  assert.deepEqual([previous.normalizedPayload.luckPillar, current.normalizedPayload.luckPillar], ['癸卯', '甲辰']);
  for (const [fact, through] of [[previous, '乙'], [current, '甲']]) {
    const p = fact.normalizedPayload;
    assert.equal(p.fanWealthConvertedToOfficer, true);
    const { wealth, joinedSeal, separateSeal, officer, join, bridges } = p.fanWealthConversion;
    assert.deepEqual([wealth, joinedSeal, separateSeal, officer].map(row => [row.position, row.pillar, row.stem, row.kind]),
      [['month', '壬寅', '壬', '透干'], ['year', '丁丑', '丁', '透干'], ['hour', '丙寅', '丙', '透干'],
        ['month', '壬寅', '甲', '支藏']]);
    assert.deepEqual(join, { kind: '天干五合', members: ['year', 'month'], values: '丁壬' });
    assert.deepEqual(bridges.map(row => [row.wealth.stem, row.through.stem, row.seal.stem, row.combines]),
      [['壬', through, '丁', true], ['壬', through, '丙', false]]);
  }
  const hit = match(run, 98);
  assert.equal(hit.status, 'not_matched');
  const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'fan-wealth-officer')).input;
  assert.match(formatFortuneFactAudit(input), /范太傅原图的年丁与月壬实合，徐注作财化为官/u);
  assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
  assert.doesNotMatch(await providerMessage(input), /范太傅|fanWealthConvertedToOfficer/u);

  const otherHour = submitted([1937, 2, 11], 6, 1954, 0);
  const other = rows(otherHour).find(row => row.normalizedPayload.luckPillar === '甲辰');
  assert.ok(other);
  assert.equal(other.normalizedPayload.fanWealthConvertedToOfficer, false);
  assert.equal(other.normalizedPayload.fanWealthConversion, undefined);
  assert.equal(other.normalizedPayload.wealthSupportingOfficerSeal.length, 2);
  assert.equal(match(otherHour, 98).status, 'partial');
  assert.equal(ctx('fan', '甲辰', false).fanWealthConvertedToOfficer, undefined);
});

test('Fan checks the actual Xin and Geng at the same exposed seal across one transition', async () => {
  const date = [1937, 2, 11], run = submitted(date, 4, 1949);
  const boundary = '1949-04-23T18:00:00.000Z';
  const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '辛丑');
  const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '庚子');
  assert.ok(before && after);
  for (const [fact, stem, god, natalPosition] of [[before, '辛', '食神', 'year'], [after, '庚', '伤官', 'day']]) {
    const p = fact.normalizedPayload;
    assert.equal(p.hasOfficerSealWealthOutput, true);
    assert.equal(p.hasFanSourceSealChecksOutput, true);
    assert.equal(p.hasOfficerSealProtection, false);
    const { officer, seal, output, originalOutput } = p.fanSourceSealChecksOutput;
    assert.deepEqual([officer.position, officer.stem, seal.position, seal.stem, output.kind, output.stem, output.god],
      ['month', '甲', 'hour', '丙', '运干', stem, god]);
    assert.deepEqual(originalOutput.map(value => [value.position, value.stem]), [[natalPosition, stem]]);
  }
  assert.equal(before.normalizedPayload.fanBranchWealthSupportsOfficer, false);
  assert.equal(after.normalizedPayload.fanBranchWealthSupportsOfficer, true);
  assert.equal(match(run, 101).status, 'not_matched');
  const protection = match(run, 103);
  assert.equal(protection.status, 'matched');
  assert.ok([before, after].every(fact => protection.sourceFactIds.includes(fact.factId)));
  assert.match(protection.matchedSourceExcerpt, /印可[護护]官/u);
  assert.deepEqual(protection.windows, [{ start: run.time.displayWindow.instantRange.startInstant,
    endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'fan-guarding-officer'));
  const message = await providerMessage(input);
  assert.match(message, /范太傅.*丙印.*回克/u);
  assert.doesNotMatch(message, /hasFanSourceSealChecksOutput|fanSourceSealChecksOutput/u);

  const neighbor = submitted(date, 6, 1949);
  const other = rows(neighbor).find(row => row.normalizedPayload.luckPillar === '辛丑');
  assert.ok(other && other.normalizedPayload.natalPillars.at(-1).pillar === '丁卯');
  assert.equal(other.normalizedPayload.hasOfficerSealWealthOutput, true);
  assert.equal(other.normalizedPayload.hasFanSourceSealChecksOutput, false);
  assert.equal(match(neighbor, 101).status, 'partial');
  assert.ok(match(neighbor, 101).sourceFactIds.includes(other.factId));
  assert.equal(match(neighbor, 103).status, 'not_matched');
  assert.equal(ctx('fan', '辛丑', false).hasFanSourceSealChecksOutput, undefined);
});

test('Li keeps the stated seal luck separate from the same natal and moving killer competing for Yi', () => {
  const date = [1950, 9, 26];
  const stages = [
    [1975, '丁亥', '戊子', '壬', '癸'],
    [1995, '己丑', '庚寅', '癸', undefined],
  ];
  for (const [year, beforePillar, afterPillar, beforeStem, afterStem] of stages) {
    const run = submitted(date, 8, year);
    const boundary = year + '-01-09T06:00:00.000Z';
    const before = rows(run).find(row => row.normalizedPayload.luckPillar === beforePillar && row.activeTo === boundary);
    const after = rows(run).find(row => row.normalizedPayload.luckPillar === afterPillar && row.activeFrom === boundary);
    assert.ok(before && after);
    for (const [fact, stem] of [[before, beforeStem], [after, afterStem]]) {
      const p = fact.normalizedPayload;
      assert.deepEqual(p.natalPillars.map(row => row.pillar), ['庚寅', '乙酉', '甲子', '戊辰']);
      const review = p.liSourceOfficerSealReview;
      assert.deepEqual([review.natalKiller.position, review.natalKiller.stem, review.peer.position, review.peer.stem,
        review.officer.position, review.officer.stem, review.seal.position, review.seal.stem],
      ['year', '庚', 'month', '乙', 'month', '辛', 'day', '癸']);
      assert.deepEqual(review.natalCombination.members, ['year', 'month']);
      assert.equal(review.nativeWaterGroup.nativeComplete, false);
      assert.deepEqual(review.nativeWaterGroup.members.map(row => [row.branch, row.natalPositions]),
        [['申', []], ['子', ['day']], ['辰', ['hour']]]);
      assert.equal(p.hasLiSourceRepeatedKiller, !stem);
      assert.equal(p.hasLiSourceOfficerSealSupport, Boolean(stem));
      const scoped = { ...run, facts: [fact] };
      const { input } = buildFortuneModelContext(scoped,
        interpretFortune(scoped, requestForFortuneRun(scoped), 'li-officer-seal-luck'));
      const prompt = formatFortunePrompt(input);
      const audit = formatFortuneFactAudit(input);
      const sealAudit = /李参政原评所列亥子丑印运，本步实见.*生日元/u;
      const killerAudit = /来运庚七杀也合月乙，原评按两庚合乙判七杀混局/u;
      if (stem) {
        assert.deepEqual([review.incomingSeal.kind, review.incomingSeal.stem], ['运支藏干', stem]);
        const supported = match(scoped, 102);
        assert.equal(supported.status, 'matched');
        assert.equal(supported.matchedSourceExcerpt, '亥子丑印運');
        assert.deepEqual(supported.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
        assert.match(audit, sealAudit);
        assert.match(prompt, /原文：亥子丑印運/u);
      } else {
        const repeated = review.repeatedKillerCombination;
        assert.deepEqual([repeated.moving.stem, repeated.target.position, repeated.target.stem], ['庚', 'month', '乙']);
        const baseline = { ...scoped, facts: [{ ...fact, normalizedPayload: { ...p, hasLiSourceRepeatedKiller: false } }] };
        const legacy = matchFortuneKnowledge(baseline).byMethod.bazi, checked = matchFortuneKnowledge(scoped).byMethod.bazi;
        for (const index of [99, 102, 103]) {
          assert.equal(legacy[index].status, 'partial', index);
          assert.equal(checked[index].status, 'excluded', index);
          assert.ok(!input.sections.some(section => section.findings.some(row => row.knowledgeId === checked[index].knowledgeId)), index);
        }
        assert.match(audit, killerAudit);
        assert.doesNotMatch(prompt, /原文：亥子丑印運/u);
      }
      assert.doesNotMatch(prompt, sealAudit);
      assert.doesNotMatch(prompt, killerAudit);
      assert.doesNotMatch(prompt, /liSourceOfficerSealReview|hasLiSourceRepeatedKiller/u);
    }
    if (year === 1995) assert.equal(match(run, 102).windows.at(-1).endExclusive, boundary);
  }
  const near = submitted(date, 6, 1995);
  const opposite = rows(near).find(row => row.normalizedPayload.luckPillar === '庚寅');
  assert.ok(opposite);
  assert.equal(opposite.normalizedPayload.natalPillars.at(-1).pillar, '丁卯');
  assert.equal(opposite.normalizedPayload.liSourceOfficerSealReview, undefined);
  assert.equal(opposite.normalizedPayload.hasLiSourceRepeatedKiller, false);
  assert.equal(match({ ...near, facts: [opposite] }, 102).status, 'partial');
  const unresolved = ctx(natal(['庚寅', '乙酉', '甲子', '戊辰']), '庚寅', false);
  assert.equal(unresolved.hasLiSourceRepeatedKiller, undefined);
  assert.equal(unresolved.hasLiSourceOfficerSealSupport, undefined);
});

test('Fan branch wealth and stem support preserve the distinct source readings across the actual luck stages', async () => {
  const date = [1937, 2, 11];
  const years = [
    [1959, ['庚子', '己亥'], [undefined, 'peer']],
    [1979, ['戊戌', '丁酉'], ['peer', 'ding-seal-with-output-group']],
    [1989, ['丁酉', '丙申'], ['ding-seal-with-output-group', 'bing-seal']],
    [1999, ['丙申', '乙未'], ['bing-seal', undefined]],
  ];
  for (const [year, pillars, routes] of years) {
    const run = submitted(date, 4, year);
    const boundary = year + '-04-23T18:00:00.000Z';
    const stages = pillars.map((pillar, idx) => rows(run).find(row => row.normalizedPayload.luckPillar === pillar
      && row[idx === 0 ? 'activeTo' : 'activeFrom'] === boundary));
    assert.ok(stages.every(Boolean), year);
    const hit = match(run, 102);
    assert.equal(hit.status, 'matched');
    assert.equal(match(run, 99).status, 'not_matched');
    for (const [idx, stage] of stages.entries()) {
      const { normalizedPayload: p, factId } = stage;
      assert.equal(p.fanWealthConvertedToOfficer, true);
      assert.equal(p.fanBranchWealthSupportsOfficer, year === 1959);
      assert.equal(p.fanSourceOfficerSealSupportRoute, routes[idx]);
      if (year === 1959) {
        const { wealth, officer, seal } = p.fanBranchWealth;
        assert.deepEqual([wealth.kind, wealth.stem, officer.position, officer.stem, seal.position, seal.stem],
          ['运支藏干', idx === 0 ? '癸' : '壬', 'month', '甲', 'hour', '丙']);
        assert.ok(p.monthOfficerWealthPaths.some(p => p.movingWealth.some(m => m.stem === wealth.stem && m.kind === wealth.kind)));
        assert.ok(p.monthOfficerSealPaths.some(p => p.seal.position === seal.position && p.seal.stem === seal.stem
          && p.movingWealth.some(m => m.stem === wealth.stem && m.kind === wealth.kind)));
      }
      assert.equal(hit.sourceFactIds.includes(factId), !!routes[idx]);
      assert.equal(p.hasFanSourceYouOutputChallengesOfficer, pillars[idx] === '丁酉');
      if (!routes[idx]) continue;
      const { officer, seal, day, moving, outputGroup } = p.fanSourceOfficerSealSupport;
      assert.deepEqual([officer.stem, seal.stem, day.stem, moving.stem, moving.kind], ['甲', '丙', '己', pillars[idx][0], '运干']);
      if (routes[idx] === 'ding-seal-with-output-group') {
        assert.equal(outputGroup.values, '巳酉丑');
        assert.equal(outputGroup.nativeComplete, false);
        assert.deepEqual(outputGroup.members.map(row => [row.branch, row.natalPositions, row.luckPresent]),
          [['巳', ['day'], false], ['酉', [], true], ['丑', ['year'], false]]);
        const harmfulGroup = p.fanSourceYouOutputChallengesOfficer;
        assert.deepEqual([harmfulGroup.officer.position, harmfulGroup.officer.stem, harmfulGroup.movingOutput.kind,
          harmfulGroup.movingOutput.stem, harmfulGroup.movingOutput.god, harmfulGroup.outputGroup.values],
        ['month', '甲', '运支藏干', '辛', '食神', '巳酉丑']);
        assert.equal(p.hasOfficerSealProtection, true);
        assert.equal(match({ ...run, facts: [stage] }, 103).status, 'excluded');
      }
    }
    if (year === 1959) {
      for (const index of [100, 101, 104]) assert.equal(match(run, index).status, 'not_matched');
      assert.equal(hit.windows[0].start, boundary);
    }
    if (year === 1979) {
      const branch = hit.confirmedBranches.find(row => row.windows[0].start === boundary);
      assert.match(branch.conditions.join(''), /丁酉.*丁.*印.*酉/u);
      const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'fan-stem-support')).input;
      assert.match(formatFortuneFactAudit(input), /范图丁酉运补齐巳酉丑.*按原评排此段护官候选/u);
      const message = await providerMessage(input);
      assert.match(message, /范太傅.*丁酉/u);
      assert.doesNotMatch(message, /fanSourceOfficerSealSupportRoute|fanBranchWealthSupportsOfficer|范图丁酉运补齐巳酉丑|按原评排此段护官候选/u);
    }
    if (year === 1989) {
      const sealPath = match(run, 103);
      assert.equal(sealPath.status, 'partial');
      assert.equal(sealPath.windows[0].start, boundary);
    }
    if (year === 1999) assert.equal(hit.windows.at(-1).endExclusive, boundary);
  }

  const alternative = submitted(date, 6, 1959);
  const other = rows(alternative).find(row => row.normalizedPayload.luckPillar === '己亥');
  assert.ok(other);
  assert.equal(other.normalizedPayload.natalPillars.at(-1).pillar, '丁卯');
  assert.equal(other.normalizedPayload.fanWealthConvertedToOfficer, false);
  assert.equal(other.normalizedPayload.fanBranchWealthSupportsOfficer, false);
  assert.equal(other.normalizedPayload.fanSourceOfficerSealSupportRoute, undefined);
  for (const idx of [99, 100, 101, 102, 104]) {
    const hit = match(alternative, idx);
    assert.equal(hit.status, 'partial', idx);
    assert.ok(hit.sourceFactIds.includes(other.factId), idx);
  }
  assert.equal(ctx('fan', '己亥', false).fanBranchWealthSupportsOfficer, undefined);
  assert.equal(ctx('fan', '己亥', false).fanSourceOfficerSealSupportRoute, undefined);
  assert.equal(ctx('fan', '丁酉', false).hasFanSourceYouOutputChallengesOfficer, undefined);
});

test('missing officer atomic evidence is unknown rather than reconstructed from unrelated generic natal and luck records',()=>{
 const run=structuredClone(real(98));run.facts=run.facts.filter(f=>f.factType!=='zpqz_officer_context');assert.equal(match(run,98).status,'unknown');
 const noMonth=structuredClone(real(103));rows(noMonth).forEach(f=>f.normalizedPayload.monthOfficerCandidate=false);assert.equal(match(noMonth,103).status,'not_matched');
});

test('actual outbound provider message contains natural Chinese premises, hidden officer and source differences without raw JSON or partial source text',async()=>{
 const run=real('xue'),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'officer-private-report'));
 assert.ok(input.facts.some(f=>f.type==='zpqz_officer_context'));const prompt=formatFortuneFactAudit(input);
 for(const phrase of ['官藏申而未明透','财印并透不要求官也明透','戌运不伤印与戌运破印','日元不作为另一位外透比肩'])assert.ok(prompt.includes(phrase),phrase);
 for(const key of ['officer-private','zpqz-officer-wealth-seal','hiddenFivePairs','monthOfficerCandidate','officerBranchRelations','sourceVariants','stageStart'])assert.ok(!prompt.includes(key),key);
 const matched = input.sections.flatMap(s => s.findings);
 assert.ok(matched.some(f => f.knowledgeId === fortuneKnowledge.bazi.rules[98].knowledgeId));
 assert.ok(!matched.some(f => indices.some(i => i !== 98 && !completeSourceIndices.has(i)
  && fortuneKnowledge.bazi.rules[i].knowledgeId === f.knowledgeId)));
 assert.ok(!/[{}\[\]]/u.test(describeFortuneFact({method:'bazi',type:'zpqz_officer_context',data:ctx('xue')},String)));
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await provider.interpret(input);
 const zaqiRun=real('zaqi');validateFortuneFacts(zaqiRun);assert.equal(match(zaqiRun,98).status,'not_matched');
 const zi=buildFortuneModelContext(zaqiRun,interpretFortune(zaqiRun,requestForFortuneRun(zaqiRun),'officer-private-zaqi-report')).input,zp=formatFortuneFactAudit(zi);
 for(const phrase of ['不把卯申称为地支六合','戊甲','取运图无巳'])assert.ok(zp.includes(phrase),phrase);
 const zprovider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(zi));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await zprovider.interpret(zi);
});
