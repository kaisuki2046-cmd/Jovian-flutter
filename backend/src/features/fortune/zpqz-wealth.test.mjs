import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Solar} from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import {describeFortuneFact,formatFortuneFactAudit, formatFortunePrompt} from './control/fortune-prompt.mjs';
import {createFortuneDeepSeek} from './server/deepseek-expression.mjs';
const {baziZpqzWealth,zpqzWealthCases,zpqzWealthVariants}=await import('./control/bazi-zpqz-wealth.ts');
const {calculateFortuneFacts,validateFortuneFacts}=await import('./control/fortune-facts.ts');
const {buildFactTimeContext}=await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const {matchFortuneKnowledge}=await import('./control/knowledge/match.ts');
const {evaluateFortuneRules,fortuneKnowledge}=await import('./control/knowledge/catalog.ts');
const {buildFortuneModelContext}=await import('./control/fortune-model-context.ts');
const {interpretFortune,requestForFortuneRun}=await import('./control/fortune-interpretation.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/zpqz-wealth-reference.json',import.meta.url)));
const indices=[107,108,109,110,111,114,115,116,117,118],layers=['year','month','day','hour'];
const wealthRemedySourceIndex = 109;
const treatedKillerSourceIndex = 117;
const namedSourceIndices = new Set([114, 115, 118]);
const completeSourceIndices = new Set([wealthRemedySourceIndex, treatedKillerSourceIndex, ...namedSourceIndices]);
const natal=values=>Object.fromEntries(layers.map((k,i)=>[k,values[i]]));
const printed=id=>natal(ref.printedCases.find(c=>c.id===id).pillars);
const ctx=(id='wu',luck='甲寅',known=true)=>baziZpqzWealth(typeof id==='string'?printed(id):id,known,luck);
const rows=run=>run.facts.filter(f=>f.factType==='zpqz_wealth_context');
const match=(run,i)=>matchFortuneKnowledge(run).byMethod.bazi[i];
const cache=new Map();
function chartFor(e){const [y,m,d]=e.date,l=Solar.fromYmdHms(y,m,d,e.hour,0,0).getLunar();
 return {timeKnown:true,bazi:{engineName:'lunar-javascript',engineVersion:'1.7.8',rulesetVersion:'utc8-jie-local-civil-late-zi-next-v1',rawResult:[{
 utc:new Date(Date.UTC(y,m-1,d,e.hour-8)).toISOString(),year:l.getYearInGanZhiExact(),month:l.getMonthInGanZhiExact(),day:l.getDayInGanZhiExact(),hour:l.getTimeInGanZhi(),
 luckPeriods:l.getEightChar().getYun(e.gender,2).getDaYun(11).slice(1).map(s=>({ganZhi:s.getGanZhi(),startAge:s.getStartAge(),endAge:s.getEndAge()})),tenGods:{},shenSha:{}}]},ziwei:{rawResult:[]},western:{rawResult:[]}};}
function real(i){if(!cache.has(i)){const e=ref.calendarExamples[i],chart=chartFor(e);
 const input={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year:e.year}};
 cache.set(i,calculateFortuneFacts(input,buildFactTimeContext(input,Date.parse(e.year+'-11-19T02:00:00Z'),'server'),'wealth-private-run',{snapshotId:'wealth-private-chart',chart}));}return cache.get(i);}

function submitted(date, hour, year, mutateBatch = () => {}, gender = 1) {
 const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
 const now = Date.UTC(year, 5, 1);
 const reference = { snapshotId: 'wealth-printed-' + date.join('-') + '-' + hour };
 const chart = chartFor({ date, hour, gender });
 chart.birthContext = { birthInstant: chart.bazi.rawResult[0].utc, precision: 'minute', latitude: 39.9042, longitude: 116.4074,
  timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
 const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...reference, chart })));
 assert.ok(rows(batch).every(fact => !('printedLuck' in fact.normalizedPayload)));
 mutateBatch(batch);
 const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
 validateFortuneFacts(run);
 return run;
}
const modelContext = run => buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'wealth-printed-report'));
function submittedCalendar(example) {
 const run = submitted(example.date, example.hour, example.year, undefined, example.gender);
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === example.luck);
 assert.ok(fact, example.luck);
 assert.deepEqual(fact.normalizedPayload.natalPillars.map(row => row.pillar), example.natal);
 return { run, fact, paths: fact.normalizedPayload.monthWealthLuck };
}

test('eight source diagrams and two different kinds of transcription variants retain their exact columns without recovered historical birthdays',()=>{
 assert.deepEqual(zpqzWealthCases,ref.printedCases);assert.deepEqual(zpqzWealthVariants,ref.sourceVariants);
 for(const c of ref.printedCases){const r=ctx(natal(c.pillars)).printedCases.find(r=>r.id===c.id);assert.equal(r.matches,true);assert.equal(r.stemCheck.yearMonthCompatible,true);assert.equal(r.stemCheck.dayHourCompatible,true);}
 assert.equal(ref.sourceVariants[0].validPillars,true);assert.equal(ref.sourceVariants[1].validPillars,false);assert.equal(ref.sourceVariants[1].pillars.length,3);
 assert.equal(ctx(natal(ref.sourceVariants[0].pillars)).printedCases.find(c=>c.id==='pingjiang').matches,false);
});

test('food and seal source conditions require both to be exposed; hidden food and completely absent seals cannot replace the original premises',()=>{
 for(const i of [114,115]){const q=fortuneKnowledge.bazi.rules[i].queries[0];assert.equal(q.where.foodExposed,true);assert.equal(q.where.sealsExposed,true);
  for(const key of ['foodExposed','sealsExposed']){const run=structuredClone(real(i));rows(run).forEach(f=>f.normalizedPayload[key]=false);assert.equal(match(run,i).status,'not_matched',i+key);}}
 assert.equal(ctx('wu').foodExposed,true);assert.equal(ctx('wu').sealsExposed,true);
 const hidden=ctx(natal(['壬戌','壬子','戊子','丁巳']));assert.equal(hidden.foodPresent,true);assert.equal(hidden.foodExposed,false);assert.equal(hidden.sealsExposed,true);
});

test('killer and seal must both be exposed for the wealth-month seal remedy source, including an explicit rejection of split-candidate seal evidence',()=>{
 const q=fortuneKnowledge.bazi.rules[118].queries[0];assert.equal(q.where.killerExposed,true);assert.equal(q.where.sealsExposed,true);
 const run=structuredClone(real(118));for(const f of rows(run)){const other=structuredClone(f);other.factId+='-separate';f.normalizedPayload.sealsExposed=false;other.normalizedPayload.killerExposed=false;run.facts.push(other);}
 assert.equal(match(run,118).status,'not_matched');assert.equal(ctx('mao').killerExposed,true);assert.equal(ctx('mao').sealsExposed,false);
});

test('p076 keeps general seal geometry as evidence while requiring the author’s original Zhao comparison', () => {
 const natalChart = natal(ref.calendarExamples[118].natal);
 const seal = ctx(natalChart, '乙酉');
 const incompatible = ctx(natalChart, '戊戌');
 assert.equal(seal.luckBranchMainQiGod, '正印');
 assert.equal(seal.strengthVerified, false);
 assert.ok(seal.printedCases.every(row => !row.matches));
 const candidates = [seal, incompatible].map(value => ({
  factType: 'zpqz_wealth_context', scope: 'decadal', completeness: 'complete',
  normalizedPayload: { ...value, confirmed: true },
 }));
 const id = fortuneKnowledge.bazi.rules[118].knowledgeId;
 const result = evaluateFortuneRules('bazi', 'year', candidates).find(rule => rule.knowledgeId === id);
 assert.ok(seal.wealthLuckRoutes.includes('killer-feeds-seal-luck'));
 assert.deepEqual(result.required[0].hits, []);
 assert.equal(result.unresolved.length, 0);
});

test('Wu food and seal are three columns apart with the actual two Wu stems in between and the day master is not an extra exposed companion',()=>{
 const p=ctx('wu'),pair=p.foodSealPairs.find(r=>r.from.stem==='庚'&&r.to.stem==='丙');assert.ok(pair);assert.equal(pair.columnDistance,3);
 assert.deepEqual(pair.between.map(r=>[r.position,r.pillar]),[['month','戊子'],['day','戊子']]);
 assert.deepEqual(p.gods.find(r=>r.god==='比肩').exposedRows.map(r=>r.position),['month']);
 assert.ok(p.sealDayMasterContacts.some(r=>r.from.stem==='丙'&&r.to.god==='日元'));
 for(const key of ['strengthVerified','transformationVerified','protectionVerified','climateVerified'])assert.equal(p[key],false);
});

test('Pingjiang Chen diagram contains Yi residual qi while the Ren-Shen prose variant does not; neither geometry rewrites the source no-root appraisal',()=>{
 const diagram=ctx('pingjiang','戊午'),alternate=ctx(natal(ref.sourceVariants[0].pillars),'戊午');
 assert.ok(diagram.roots.find(r=>r.stem==='乙').roots.some(r=>r.position==='year'&&r.exactStem));
 assert.equal(alternate.roots.find(r=>r.stem==='乙').roots.length,0);
 const text=describeFortuneFact({method:'bazi',type:'zpqz_wealth_context',data:diagram},String);
 for(const phrase of ['辰中确藏乙余气','评注另称食无根','年有壬申','前章正文与评注有分歧'])assert.ok(text.includes(phrase),phrase);
});

test('Yang Ding luck combines the actual two Ren foods, Wu attacks Ren food and natal food can control the arriving Bing killer without claiming effective rescue',()=>{
 const ding=ctx('yang','丁卯'),wu=ctx('yang','戊辰'),bing=ctx('yang','丙寅');
 assert.deepEqual(ding.movingFivePairs.filter(p=>p.target.stem==='壬').map(p=>[p.target.position,p.target.tenGod]),[['year','食神'],['month','食神']]);
 assert.ok(wu.movingContacts.some(p=>p.from.kind==='运干'&&p.from.stem==='戊'&&p.to.stem==='壬'&&p.to.god==='食神'&&p.relation==='克'));
 assert.ok(bing.natalMovingContacts.some(p=>p.from.stem==='壬'&&p.from.god==='食神'&&p.to.kind==='运干'&&p.to.stem==='丙'&&p.relation==='克'));
 assert.equal(bing.protectionVerified,false);assert.ok(ding.movingFivePairs.every(p=>p.distance===undefined));
});

test('Wang Ding targets Ren hurt while Bing separately contacts the day Xin and month Xin, and neither self-combination nor another companion is silently substituted',()=>{
 const d=ctx('wang','丁卯'),b=ctx('wang','丙寅');assert.ok(d.movingFivePairs.some(p=>p.target.stem==='壬'&&p.target.tenGod==='伤官'));
 const x=b.movingFivePairs.filter(p=>p.target.stem==='辛');assert.equal(x.length,2);assert.ok(x.some(p=>p.targetIsDayMaster));assert.ok(x.some(p=>p.target.position==='month'&&!p.targetIsDayMaster));
 assert.ok(b.hurtWealthContacts.some(p=>p.from.stem==='壬'&&p.to.stem==='甲'));
 assert.ok(b.companionOutputContacts.some(p=>p.from.position==='month'&&p.from.stem==='辛'&&p.to.stem==='壬'));
});

test('Mao actual Yi-Geng pair, hidden Ding control and Zi-Wu clash coexist without declaring the killer removed or inventing a complete water group',()=>{
 const p=ctx('mao','甲子');assert.ok(p.killPairs.some(r=>r.target.stem==='庚'&&r.helper.stem==='乙'&&r.distance===1));
 assert.ok(p.outputKillerContacts.some(r=>r.from.stem==='丁'&&r.from.kind==='支藏'&&r.from.position==='day'&&r.to.stem==='庚'));
 assert.ok(p.movingRelationPairs.some(r=>r.kind==='六冲'&&r.members.includes('day')));
 const g=p.branchGroups.find(r=>r.values==='申子辰');assert.equal(g.complete,false);assert.deepEqual(g.missingKnownBranches,['申']);assert.equal(p.transformationVerified,false);
});

test('Li Bing stem attacking actual Geng food remains distinct from concealed fire in Wu branch and a seal branch is never automatically declared harmless',()=>{
 const a=ctx('li','丙寅'),b=ctx('li','戊午');assert.ok(a.movingContacts.some(r=>r.from.stem==='丙'&&r.from.kind==='运干'&&r.to.stem==='庚'&&r.to.god==='食神'&&r.relation==='克'));
 assert.ok(b.movingContacts.some(r=>r.from.stem==='丁'&&r.from.kind==='运支藏干'&&r.to.stem==='庚'&&r.relation==='克'));
 assert.equal(a.protectionVerified,false);assert.equal(b.protectionVerified,false);
 assert.match(fortuneKnowledge.bazi.rules[treatedKillerSourceIndex].review.printedLuck.find(row => row.name === '李御史').premise,
  /区分印在运支与明透运干/u);
});

test('Zhao hidden wealth, exposed Ding seal and two Yi killers name the Ren-to-Ding combination and attack, while the earlier three-column source stays incomplete',()=>{
 const p=ctx('zhao','壬申');assert.equal(p.wealthExposed,false);assert.equal(p.sealsExposed,true);assert.equal(p.killerExposed,true);
 assert.ok(p.killerSealContacts.some(r=>r.from.stem==='乙'&&r.to.stem==='丁'));
 assert.ok(p.movingFivePairs.some(r=>r.target.stem==='丁'&&r.target.tenGod==='偏印'));
 assert.ok(p.movingContacts.some(r=>r.from.stem==='壬'&&r.from.kind==='运干'&&r.to.stem==='丁'&&r.relation==='克'));
 assert.ok(describeFortuneFact({method:'bazi',type:'zpqz_wealth_context',data:p},String).includes('三柱'));
});

test('Ge Yin-Wu and Wu Zi-Chen record actual missing members rather than full fire or water transformations, and unknown hours never prove absence',()=>{
 const ge=ctx('ge','甲寅').branchGroups.find(r=>r.values==='寅午戌');assert.equal(ge.complete,false);assert.deepEqual(ge.missingKnownBranches,['戌']);
 const wu=ctx('wu','甲寅').branchGroups.find(r=>r.values==='申子辰');assert.equal(wu.complete,false);assert.deepEqual(wu.missingKnownBranches,['申']);
 const unknown=ctx('ge','甲寅',false);assert.equal(unknown.foodExposed,undefined);assert.equal(unknown.printedCases.find(c=>c.id==='ge').matches,undefined);
 assert.equal(unknown.branchGroups.find(r=>r.values==='寅午戌').complete,undefined);
});

test('wealth-month officer paths bind the actual original and moving components in each direction', () => {
 const finance = submittedCalendar(ref.calendarExamples[108]), base = ref.calendarExamples[107];
 const officer = submittedCalendar({ ...base, year: 2029, luck: '壬午' });
 const support = submittedCalendar(base);
 for (const { run, fact, paths } of [finance, officer, support]) {
  assert.ok(paths.monthOfficerLinks.some(link => link.from.position === 'month' && link.from.stem === '辛'
   && link.to.position === 'day' && link.to.stem === '壬'));
  const hit = match(run, run === support.run ? 107 : 108);
  assert.equal(hit.status, 'partial');
  assert.ok(hit.sourceFactIds.includes(fact.factId));
 }
 assert.ok(finance.paths.wealthFeedsOfficer.some(link => link.from.stem === '庚' && link.from.kind === '运干'
  && link.to.position === 'day' && link.to.stem === '壬'));
 assert.deepEqual(finance.paths.monthWealthFeedsOfficerLuck, []);
 assert.ok(officer.paths.monthWealthFeedsOfficerLuck.some(link => link.from.position === 'month' && link.from.stem === '辛'
  && link.to.stem === '壬' && link.to.kind === '运干'));
 assert.deepEqual(officer.paths.wealthFeedsOfficer, []);
 assert.ok(support.paths.supportsDay.some(link => link.moving.stem === '甲' && link.moving.kind === '运支藏干'
  && link.day.stem === '丁' && link.relation === '生'));
});

test('the same moving output must contact the officer and be checked by the exposed original seal', () => {
 const base = ref.calendarExamples[109];
 const conditions = [
  [base, '运干'],
  [{ ...base, year: 2008, luck: '庚辰' }, '运支藏干'],
  [{ ...base, year: 2028, luck: '壬午' }, undefined],
 ];
 for (const [example, kind] of conditions) {
  const { run, fact, paths } = submittedCalendar(example);
  const hit = match(run, 109);
  assert.equal(hit.status, kind ? 'matched' : 'not_matched', example.year);
  assert.equal(hit.sourceFactIds.includes(fact.factId), Boolean(kind));
  if (!kind) {
   assert.deepEqual(paths.sealProtectsOfficer, []);
   continue;
  }
  const [path] = paths.sealProtectsOfficer;
  assert.deepEqual([path.output.kind, path.output.stem], [kind, '戊']);
  assert.ok(path.targets.some(row => row.position === 'day' && row.stem === '壬'));
  assert.deepEqual(path.protectors.map(row => [row.position, row.kind, row.stem]), [['hour', '透干', '甲']]);
  assert.ok(path.wealthOfficerLinks.some(link => link.from.position === 'month' && link.from.stem === '辛'
   && link.to.position === 'day' && link.to.stem === '壬'));
  assert.deepEqual(path.targets, [...new Set(path.wealthOfficerLinks.map(link => link.to))]);
  const prompt = formatFortuneFactAudit(modelContext(run).input);
  assert.ok(prompt.includes('回克同一运食伤'));
  assert.ok(!prompt.includes('monthWealthLuck'));
 }
});

test('p067 ties both new luck directions to the same natal output that controls the officer fed by month wealth', () => {
 const base = ref.calendarExamples[107];
 const seal = submittedCalendar(base);
 const killer = submittedCalendar({ ...base, year: 2038, luck: '癸未' });
 const ordinaryOfficer = submittedCalendar({ ...base, year: 2029, luck: '壬午' });
 const pathFor = ({ paths }) => paths.natalOutputOfficerPaths.find(path =>
  path.output.position === 'year' && path.output.stem === '己' && path.output.kind === '透干');
 for (const sample of [seal, killer, ordinaryOfficer]) {
  assert.equal(sample.fact.normalizedPayload.sealsExposed, false);
  assert.deepEqual(sample.paths.sealProtectsOfficer, []);
  assert.ok(pathFor(sample).officersAtRisk.some(link =>
   link.from.position === 'month' && link.from.stem === '辛' && link.to.position === 'day' && link.to.stem === '壬'));
 }
 assert.deepEqual(pathFor(seal).movingSeals.map(row => [row.kind, row.stem]), [['运支藏干', '甲']]);
 assert.deepEqual(pathFor(seal).controlledKillers, []);
 assert.deepEqual(pathFor(killer).movingSeals, []);
 assert.deepEqual(pathFor(killer).controlledKillers.map(row => [row.kind, row.stem]), [['运干', '癸']]);
 for (const { run, fact } of [seal, killer]) {
  const hit = match(run, 109);
  assert.equal(hit.status, 'matched');
  assert.ok(hit.sourceFactIds.includes(fact.factId));
 }
 assert.equal(match(ordinaryOfficer.run, 109).status, 'not_matched');
 assert.ok(formatFortuneFactAudit(modelContext(killer.run).input).includes('原局克官食伤回克运杀'));
});

test('the original food god feeds actual month wealth before the support and moving food/wealth paths are applied', () => {
 const base = ref.calendarExamples[111], food = submittedCalendar(base), wealth = submittedCalendar(ref.calendarExamples[108]);
 for (const { run, fact, paths } of [food, wealth]) {
  assert.ok(paths.monthFoodLinks.some(link => link.from.stem === '己' && link.from.kind === '透干'
   && link.to.position === 'month' && link.to.stem === '辛'));
  const hit = match(run, 111);
  assert.equal(hit.status, run === wealth.run ? 'matched' : 'partial');
  assert.ok(hit.sourceFactIds.includes(fact.factId));
 }
 assert.ok(food.paths.foodLuckFeedsMonthWealth.some(link => link.from.stem === '己' && link.to.stem === '辛'));
 assert.ok(wealth.paths.foodFeedsWealthLuck.some(link => link.from.stem === '己' && link.to.stem === '庚'));
 assert.equal(match(food.run, 110).status, 'matched');
});

test('p068 and p069 bracket native food generating month wealth across the same confirmed luck change', async () => {
 const run = submitted([1980, 1, 15], 0, 2007, undefined, 0);
 const boundary = '2007-01-15T10:00:00.000Z';
 const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '己卯');
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '庚辰');
 assert.ok(before && after);
 const priorPaths = before.normalizedPayload.monthWealthLuck, nextPaths = after.normalizedPayload.monthWealthLuck;
 for (const paths of [priorPaths, nextPaths]) {
  assert.ok(paths.monthFoodLinks.some(({ from, to }) => from.position === 'year' && from.stem === '己' && from.kind === '透干'
   && to.position === 'month' && to.stem === '辛'));
 }
 assert.ok(priorPaths.supportsDay.some(path => path.moving.stem === '乙' && path.day.stem === '丁' && path.relation === '生'));
 assert.deepEqual(priorPaths.foodFeedsWealthLuck, []);
 assert.deepEqual(nextPaths.supportsDay, []);
 assert.ok(nextPaths.foodFeedsWealthLuck.some(({ from, to }) =>
  from.position === 'year' && from.stem === '己' && to.stem === '庚' && to.kind === '运干'));
 for (const [i, accepted, rejected, excerpt] of [[110, before, after, '助身'], [111, after, before, '財食']]) {
  const hit = match(run, i);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, excerpt);
  assert.ok(hit.sourceFactIds.includes(accepted.factId) && !hit.sourceFactIds.includes(rejected.factId));
  assert.equal(i === 110 ? hit.windows.at(-1).endExclusive : hit.windows[0].start, boundary);
 }
 const { input } = modelContext(run);
 const provider = createFortuneDeepSeek({ apiKey: 'test-key', transport: async (_, options) => {
  const content = JSON.parse(options.body).messages[1].content;
  assert.match(content, /本步运干或运支首藏的印，生同一原局日元/u);
  assert.match(content, /原局同一处透食同时生月令实际所藏财和本步/u);
  assert.doesNotMatch(content, /杨氏原例|food-seal-supports-day|food-feeds-month-and-moving-wealth/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(input);
});

test('p069 confirms moving and natal Food feeding the same month Wealth unless a natal Seal controls the moving Food', () => {
 const date = [1980, 12, 21];
 for (const [hour, hourPillar, qualified] of [[18, '辛酉', true], [10, '丁巳', false]]) {
  const run = submitted(date, hour, 2015, undefined, 0);
  const boundary = run.facts.find(fact => fact.factType === 'luck_transition'
   && fact.normalizedPayload.toPillar === '甲申')?.exactInstant;
  const before = rows(run).find(fact => fact.activeTo === boundary && fact.normalizedPayload.luckPillar === '乙酉');
  const after = rows(run).find(fact => fact.activeFrom === boundary && fact.normalizedPayload.luckPillar === '甲申');
  assert.ok(before && after, hour);
  const data = after.normalizedPayload, paths = data.monthWealthLuck;
  assert.equal(data.natalPillarSequence, '庚申戊子戊辰' + hourPillar);
  assert.ok(paths.monthFoodLinks.some(({ from, to }) => from.position === 'year' && from.kind === '透干'
   && from.stem === '庚' && to.position === 'month' && to.stem === '癸'));
  assert.deepEqual(paths.foodLuckFeedsMonthWealth.map(({ from, to }) => [from.kind, from.stem, to.position, to.stem]),
   [['运支藏干', '庚', 'month', '癸']]);
  assert.deepEqual(paths.foodFeedsWealthLuck, []);
  assert.equal(data.wealthLuckRoutes.includes('moving-food-feeds-same-month-wealth'), qualified);
  const hit = match(run, 111);
  assert.equal(hit.status, qualified ? 'matched' : 'partial');
  if (qualified) {
   assert.equal(hit.windows[0].start, boundary);
   assert.equal(hit.matchedSourceExcerpt, '財食');
   assert.ok(hit.sourceFactIds.includes(after.factId) && !hit.sourceFactIds.includes(before.factId));
   const message = formatFortunePrompt(modelContext(run).input);
   assert.match(message, /原局明透的食神与本步.*同生月令同一处所藏的财/u);
   assert.doesNotMatch(message, /moving-food-feeds-same-month-wealth/u);
  }
 }
});

test('p069 confirms Yang’s source-supported food-wealth branch until the later separate killer period', () => {
 const run = submitted([1962, 2, 11], 10, 1999);
 const boundary = '1999-10-08T12:00:00.000Z';
 const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '乙巳');
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '丙午');
 assert.ok(before && after);
 assert.ok(before.normalizedPayload.wealthLuckRoutes.includes('yang-reviewed-food-wealth'));
 assert.ok(!after.normalizedPayload.wealthLuckRoutes.includes('yang-reviewed-food-wealth'));
 const beforeLinks = before.normalizedPayload.monthWealthLuck.foodFeedsWealthLuck
  .filter(({ from }) => from.kind === '透干' && from.stem === '壬');
 assert.deepEqual(beforeLinks.map(({ from, to }) => [from.position, to.stem]), [['year', '乙'], ['month', '乙']]);
 assert.deepEqual(after.normalizedPayload.monthWealthLuck.foodFeedsWealthLuck, []);
 const hit = match(run, 111);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows.at(-1).endExclusive, boundary);
 assert.equal(hit.candidateWindows[0].start, boundary);
 assert.ok(hit.sourceFactIds.includes(before.factId) && !hit.sourceFactIds.includes(after.factId));
 assert.equal(match(run, 110).status, 'not_matched');
 const prompt = formatFortunePrompt(modelContext(run).input);
 assert.match(prompt, /徐注按杨氏原例的日元、财与食相均来读/u);
 assert.doesNotMatch(prompt, /这里核对两路食神生财的位置|yang-reviewed-food-wealth/u);
});

test('p069 reaches a stage led by hurt feeding month wealth and ends that candidate at the next luck change', () => {
 const run = submitted([1988, 8, 10], 18, 2009, undefined, 0);
 const before = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '戊午');
 const after = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '丁巳');
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丁巳');
 assert.ok(before && after && change);
 const paths = before.normalizedPayload.monthWealthLuck;
 assert.ok(paths.monthFoodLinks.some(link => link.from.position === 'hour' && link.from.stem === '己'
  && link.to.position === 'month' && link.to.stem === '庚'));
 assert.deepEqual(paths.hurtLuckFeedsMonthFoodWealth.map(link => [link.from.kind, link.from.stem, link.to.stem]),
  [['运干', '戊', '庚']]);
 for (const key of ['foodLuckFeedsMonthWealth', 'foodFeedsWealthLuck', 'foodWealthControlsKiller', 'foodWealthInterference']) {
  assert.deepEqual(paths[key], []);
 }
 const hit = match(run, 111);
 assert.ok(hit.sourceFactIds.includes(before.factId));
 assert.ok(!hit.sourceFactIds.includes(after.factId));
 assert.equal(hit.windows.at(-1).endExclusive, change.exactInstant);
});

test('p069 ends Yang’s qualified window at Ding-Wei and retains the officer and seal counterexamples', async () => {
 const date = [1962, 2, 11];
 const transition = submitted(date, 10, 2009);
 const change = transition.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丁未');
 const bing = rows(transition).find(row => row.activeTo === change?.exactInstant && row.normalizedPayload.luckPillar === '丙午');
 const ding = rows(transition).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '丁未');
 const wuLuck = submitted(date, 10, 2020);
 const wu = rows(wuLuck).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '戊申');
 assert.ok(change && bing && ding && wu);
 assert.equal(ding.activeFrom, change.exactInstant);
 assert.equal(bing.normalizedPayload.yangFoodSourceExcludesBenefit, false);
 assert.ok(bing.normalizedPayload.monthWealthLuck.yangCounter.length);
 assert.ok(match(transition, 111).sourceFactIds.includes(bing.factId));
 assert.equal(match(transition, 111).windows.at(-1).endExclusive, change.exactInstant);
 const dingPaths = ding.normalizedPayload.monthWealthLuck;
 const wuPaths = wu.normalizedPayload.monthWealthLuck;
 const foodColumns = paths => paths.foodWealthInterference.filter(path => path.from.stem === '壬' && path.from.kind === '透干');
 for (const paths of [dingPaths, wuPaths]) {
  assert.equal(paths.foodWealthNamedBalanced, true);
  assert.deepEqual(foodColumns(paths).map(path => path.from.position), ['year', 'month']);
  assert.ok(foodColumns(paths).every(path => path.to.position === 'month' && path.to.stem === '甲'));
 }
 assert.ok(foodColumns(dingPaths).every(path => path.movingOfficerCombinations.some(pair => pair.moving.stem === '丁')));
 assert.ok(foodColumns(wuPaths).every(path => path.movingSeals.some(row => row.kind === '运干' && row.stem === '戊')));
 for (const [run, fact, mode, phrase] of [[transition, ding, 'officer-joins-food', '运干丁官合原局壬食'],
  [wuLuck, wu, 'seal-controls-food', '运干戊印克原局壬食']]) {
  const proof = fact.normalizedPayload;
  assert.equal(proof.yangFoodSourceExcludesBenefit, true);
  assert.ok(proof.wealthLuckRoutes.includes('food-wealth-interference'));
  assert.equal(proof.monthWealthLuck.yangFoodSourceInterference.mode, mode);
  assert.deepEqual(proof.monthWealthLuck.yangFoodSourceInterference.paths.map(path => path.from.position), ['year', 'month']);
  assert.equal(match(run, 110).status, 'not_matched');
  assert.ok(!match(run, 111).sourceFactIds.includes(fact.factId));
  const {input} = modelContext(run);
  const audit = formatFortuneFactAudit(input);
  assert.ok(audit.includes(phrase), mode);
  assert.match(audit, /杨侍郎原评将本步列为官印反晦/u);
  const provider = createFortuneDeepSeek({apiKey: 'test-key', transport: async (_, options) => {
   const message = JSON.parse(options.body).messages[1].content;
   assert.doesNotMatch(message, /杨侍郎原评将本步列为官印反晦|yangFoodSource(?:ExcludesBenefit|Interference)/u);
   assert.ok(!message.includes(phrase), mode);
   return Response.json({choices: [{finish_reason: 'stop', message: {content: '{"sections":[]}'}}]});
  }});
  await provider.interpret(input);
 }
 assert.equal(match(wuLuck, 111).status, 'not_matched');
 const otherHour = submitted(date, 12, 2010);
 const counterpart = rows(otherHour).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '丁未');
 assert.ok(counterpart);
 assert.equal(counterpart.normalizedPayload.yangFoodSourceExcludesBenefit, false);
 assert.equal(counterpart.normalizedPayload.monthWealthLuck.yangFoodSourceInterference, undefined);
 assert.equal(match(otherHour, 110).status, 'matched');
 assert.ok(counterpart.normalizedPayload.wealthLuckRoutes.includes('food-seal-supports-day'));
 assert.equal(match(otherHour, 111).status, 'partial');
 assert.doesNotMatch(formatFortuneFactAudit(modelContext(otherHour).input), /杨侍郎原评将本步列为官印反晦|运干丁官合原局壬食/u);
 assert.equal(ctx(printed('yang'), '丁未', false).yangFoodSourceExcludesBenefit, undefined);
});

test('the Ge example shares one month-wealth endpoint while exact Jia-Yin and Yi-Mao luck have different authorities', () => {
 const run = submitted([1932, 12, 23], 6, 1957);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '乙卯');
 assert.ok(change);
  const boundary = change.exactInstant;
  const preceding = rows(run).find(row => row.normalizedPayload.luckPillar === '甲寅' && row.activeTo === boundary);
  const arriving = rows(run).find(row => row.normalizedPayload.luckPillar === '乙卯' && row.activeFrom === boundary);
  assert.ok(preceding && arriving);
  for (const [stage, index, stem, god] of [[preceding, 107, '甲', '七杀'], [arriving, 108, '乙', '正官']]) {
    const hit = match(run, index);
    assert.equal(hit.status, 'not_matched');
    assert.ok(!hit.sourceFactIds.includes(stage.factId));
    assert.equal(stage.normalizedPayload.geSourceStrongBodyWealth, true);
    const [path] = stage.normalizedPayload.monthWealthLuck.geOfficerComparison;
    assert.deepEqual([path.monthWealth.position, path.monthWealth.stem, path.monthWealth.kind], ['month', '癸', '支藏']);
    assert.deepEqual([path.originalOfficer.position, path.originalOfficer.stem, path.originalOfficer.kind], ['hour', '乙', '透干']);
    assert.deepEqual([path.movingAuthority.stem, path.movingAuthority.god, path.movingAuthority.kind], [stem, god, '运干']);
    assert.deepEqual(path.movingBranchAuthority.map(row => [row.stem, row.god, row.kind]), [[stem, god, '运支藏干']]);
  }
  const { geYinWu } = preceding.normalizedPayload.monthWealthLuck;
  assert.deepEqual(geYinWu.branchSupport.map(({ moving, day, relation }) => [moving.stem, moving.god, moving.kind, day.stem, relation]), [
    ['丙', '偏印', '运支藏干', '戊', '生'], ['戊', '比肩', '运支藏干', '戊', '同五行'],
  ]);
  assert.equal(arriving.normalizedPayload.monthWealthLuck.geYinWu, undefined);
  for (const natal of [{ ...printed('ge'), hour: '丙辰' }, { ...printed('ge'), day: '戊子' }]) {
    assert.equal(ctx(natal, '乙卯').monthWealthLuck.geOfficerComparison, undefined);
  }
  assert.equal(ctx(printed('ge'), '丙辰').monthWealthLuck.geOfficerComparison, undefined);
 const { input } = modelContext(run);
  assert.ok(input.facts.some(row => row.type === 'zpqz_wealth_context' && row.data.luckPillar === '甲寅' && row.endExclusive === boundary));
 assert.ok(formatFortuneFactAudit(input).includes('原局月子与日午仍见六冲'));
 assert.match(formatFortuneFactAudit(input), /葛例原局.*支藏癸.*同生.*透干乙.*并生.*运干甲/u);
 assert.match(formatFortuneFactAudit(input), /葛例运支余藏.*丙.*生日主戊/u);
 const earlier = submitted([1932, 12, 23], 6, 1947);
 const toJia = earlier.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '甲寅');
 assert.equal(toJia?.exactInstant, '1947-08-03T20:00:00.000Z');
 const gui = rows(earlier).find(row => row.activeTo === toJia.exactInstant && row.normalizedPayload.luckPillar === '癸丑');
 assert.ok(gui?.normalizedPayload.monthWealthLuck.wealthFeedsOfficer.some(row =>
  row.from.stem === '癸' && row.from.kind === '运干' && row.to.stem === '乙' && row.to.position === 'hour'));
 assert.ok(gui.normalizedPayload.wealthLuckRoutes.includes('officer-luck'));
 const contrasting = match(earlier, 108);
 assert.equal(contrasting.status, 'not_matched');
 const close = { ...gui, normalizedPayload: { ...ctx({ ...printed('ge'), hour: '丙辰' }, '癸丑'), confirmed: true } };
  assert.equal(close.normalizedPayload.geSourceStrongBodyWealth, false);
 const comparison = evaluateFortuneRules('bazi', 'year', [close]).find(rule => rule.knowledgeId === contrasting.knowledgeId);
 assert.deepEqual(comparison.required[0].hits, [close]);
});

test('p065 independently confirms the printed branch seal and the weak Ren chart’s repeated natal seal', () => {
 for (const [date, hour, gender, year, prior, next, boundary, route, sourcePhrase] of [
  [[1984, 9, 2], 14, 0, 2013, '庚午', '己巳', '2013-04-20T20:00:00.000Z', 'converted-wealth-branch-seal', /实(際|际)运支的本气印生日己/u],
  [[1887, 6, 6], 18, 1, 1927, '壬寅', '辛丑', '1927-07-18T20:00:00.000Z', 'wu-chaoshu-source-seal', /財官旺而日元弱|财官旺而日元弱/u],
 ]) {
  const run = submitted(date, hour, year, undefined, gender);
  const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === prior);
  const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === next);
  assert.ok(before && after);
  assert.ok(before.normalizedPayload.wealthLuckRoutes.includes('officer-support'));
  assert.ok(!before.normalizedPayload.wealthLuckRoutes.includes(route));
  assert.ok(after.normalizedPayload.wealthLuckRoutes.includes(route));
  const proof = after.normalizedPayload.monthWealthLuck;
  if (route === 'converted-wealth-branch-seal') {
   const { wealth, officer, seal, day } = proof.convertedWealthBranchSeal;
   assert.deepEqual([wealth.position, wealth.stem, officer.position, officer.stem, seal.stem, day.stem],
    ['month', '壬', 'year', '甲', '丙', '己']);
   const previous = before.normalizedPayload.monthWealthLuck.convertedWealthBranchSeal;
   assert.deepEqual([previous.seal.stem, previous.officer.stem, previous.officerPressure.stem], ['丁', '甲', '庚']);
   assert.ok(after.normalizedPayload.movingRelationPairs.some(pair => pair.kind === '六冲' && pair.values === '亥巳'));
   assert.ok(!ctx(natal(['甲子', '壬申', '己亥', '壬申']), next).wealthLuckRoutes.includes(route));
  } else {
   const { wealth, officer, root, natalSeal, movingSeal, day } = proof.wuChaoshuSealLuck;
   assert.deepEqual([wealth.stem, officer.position, officer.stem, root.position, root.branch, root.stem],
    ['丁', 'hour', '己', 'year', '亥', '壬']);
   assert.deepEqual([natalSeal.position, natalSeal.branch, natalSeal.stem, movingSeal.stem, day.stem], ['hour', '酉', '辛', '辛', '壬']);
   const otherDate = Solar.fromYmdHms(1887, 5, 23, 18, 0, 0).getLunar();
   assert.deepEqual([otherDate.getYearInGanZhiExact(), otherDate.getMonthInGanZhiExact(), otherDate.getDayInGanZhiExact(),
    otherDate.getTimeInGanZhi()], ['丁亥', '乙巳', '戊子', '辛酉']);
   assert.ok(!ctx(natal(['丁亥', '丙午', '壬寅', '戊申']), next).wealthLuckRoutes.includes(route));
  }
  const hit = match(run, 107);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '運喜身旺印綬');
  assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
  const confirmedFacts = rows(run).filter(row => row.normalizedPayload.confirmed
   && row.normalizedPayload.luckPillar === next && row.normalizedPayload.wealthLuckRoutes.includes(route));
  assert.deepEqual(new Set(hit.sourceFactIds), new Set(confirmedFacts.map(row => row.factId)));
  const { input } = modelContext(run), prompt = formatFortunePrompt(input);
  assert.match(prompt, sourcePhrase);
  assert.doesNotMatch(prompt, /converted-wealth-branch-seal|wu-chaoshu-source-seal/u);
  if (route === 'converted-wealth-branch-seal') assert.doesNotMatch(prompt, /财官旺而日元弱/u);
 }
});

test('p065 finds the actual Hai root and p066 excludes generated paths on the two printed abundant-wealth charts', () => {
 const wu = submitted([1887, 6, 6], 18, 1947);
 const boundary = wu.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '己亥')?.exactInstant;
 assert.ok(boundary);
 const before = rows(wu).find(fact => fact.activeTo === boundary && fact.normalizedPayload.luckPillar === '庚子');
 const after = rows(wu).find(fact => fact.activeFrom === boundary && fact.normalizedPayload.luckPillar === '己亥');
 assert.ok(before?.normalizedPayload.confirmed && after?.normalizedPayload.confirmed);
 assert.equal(before.normalizedPayload.monthWealthLuck.wuChaoshuLuLuck, undefined);
 const lu = after.normalizedPayload.monthWealthLuck.wuChaoshuLuLuck;
 assert.deepEqual([lu.root.position, lu.root.stem, lu.natalSeal.stem, lu.movingLu.stem, lu.day.stem],
  ['year', '壬', '辛', '壬', '壬']);
 assert.deepEqual([lu.movingOfficer.stem, lu.movingOfficer.god], ['己', '正官']);
 assert.ok(after.normalizedPayload.wealthLuckRoutes.includes('officer-luck'));
 assert.equal(after.normalizedPayload.sourceWealthTooStrongForLightRoute, true);
 assert.equal(match(wu, 108).status, 'not_matched');
 const support = match(wu, 107);
 assert.equal(support.status, 'matched');
 assert.equal(support.windows[0].start, boundary);
 assert.deepEqual(support.candidateWindows, [{ start: wu.time.displayWindow.instantRange.startInstant, endExclusive: boundary }]);
 const { input } = modelContext(wu);
 assert.match(formatFortuneFactAudit(input), /实交己亥运时，运支亥首藏壬与原年亥及壬日同干/u);
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /本次只确认运支到本命禄位的扶身分项/u);
 assert.doesNotMatch(prompt, /sourceWealthTooStrongForLightRoute|实交己亥运时，运支亥首藏壬与原年亥及壬日同干/u);

 for (const [hour, printed] of [[14, true], [16, false]]) {
  const run = submitted([1984, 9, 2], hour, 2063, undefined, 0);
  const fact = rows(run).find(item => item.normalizedPayload.luckPillar === '甲子');
  assert.ok(fact?.normalizedPayload.confirmed);
  assert.ok(fact.normalizedPayload.wealthLuckRoutes.includes('concurrent-wealth-officer'));
  assert.equal(fact.normalizedPayload.sourceWealthTooStrongForLightRoute, printed);
  const result = match(run, 108);
  assert.equal(result.status, printed ? 'not_matched' : 'matched');
  if (printed) assert.match(formatFortuneFactAudit(modelContext(run).input), /单丞相原评按财旺生官取用/u);
  else assert.ok(result.sourceFactIds.includes(fact.factId));
 }
});

test('p066 confirms the printed Zhao officer only after Gui replaces the Ren killer', () => {
 const date = [1966, 2, 16], boundary = '1992-02-09T08:00:00.000Z';
 const run = submitted(date, 10, 1992);
 const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '壬辰');
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '癸巳');
 assert.ok(before && after);
 const p = after.normalizedPayload;
 assert.equal(p.natalPillarSequence, '丙午庚寅丙午癸巳');
 assert.equal(p.monthWealthCandidate, false);
 assert.ok(p.wealthLuckRoutes.includes('zhao-weak-wealth-officer-luck'));
 const { wealth, officer, day, fire, matchingOfficer } = p.monthWealthLuck.zhaoPrefectLuck;
 assert.deepEqual([wealth.position, wealth.stem, officer.position, officer.stem, day.pillar, matchingOfficer.stem, matchingOfficer.god],
  ['month', '庚', 'hour', '癸', '丙午', '癸', '正官']);
 assert.deepEqual(fire.members.map(member => [member.branch, member.natalPositions]),
  [['寅', ['month']], ['午', ['year', 'day']], ['戌', []]]);
 assert.equal(fire.complete, false);
 assert.equal(before.normalizedPayload.monthWealthLuck.zhaoPrefectLuck.killerAtBlade.god, '七杀');
 assert.ok(!before.normalizedPayload.wealthLuckRoutes.includes('zhao-weak-wealth-officer-luck'));
 const hit = match(run, 108);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '財官運');
 assert.equal(hit.windows[0].start, boundary);
 assert.ok(hit.sourceFactIds.includes(after.factId) && !hit.sourceFactIds.includes(before.factId));
 assert.notEqual(match(run, 107).status, 'matched');
 const near = ctx(natal(['丙午', '庚寅', '丙午', '壬辰']), '癸巳');
 assert.ok(!near.wealthLuckRoutes.includes('zhao-weak-wealth-officer-luck'));
 const { input } = modelContext(run);
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /趙|赵/u);
 assert.doesNotMatch(prompt, /zhao-weak-wealth-officer-luck|本步运财实际生到月令财所生/u);
});

test('p065 and p066 keep the stronger Ge chart in audit and allow ordinary wealth-to-officer paths', async () => {
 const ge = submitted([1932, 12, 23], 6, 1967);
 const wealth = submitted([1969, 6, 16], 18, 2036, undefined, 0);
 const cases = [
  { run: ge, index: 107, beforePillar: '乙卯', afterPillar: '丙辰', start: '1967-08-03T20:00:00.000Z' },
  { run: wealth, index: 108, beforePillar: '丙子', afterPillar: '丁丑', start: '2036-06-03T00:00:00.000Z',
   route: 'concurrent-wealth-officer', excerpt: '財官運', providerCondition: /同时实际运官与该原官同干，也受同一月令财所生/u },
 ];
 for (const { run, index, beforePillar, afterPillar, start, route, excerpt, providerCondition } of cases) {
  const before = rows(run).find(row => row.activeTo === start && row.normalizedPayload.luckPillar === beforePillar);
  const after = rows(run).find(row => row.activeFrom === start && row.normalizedPayload.luckPillar === afterPillar);
  assert.ok(before && after);
  if (route) {
   assert.ok(!before.normalizedPayload.wealthLuckRoutes.includes(route));
   assert.ok(after.normalizedPayload.wealthLuckRoutes.includes(route));
  }
  const proof = after.normalizedPayload.monthWealthLuck;
  if (index === 107) {
   assert.equal(after.normalizedPayload.natalPillarSequence, '壬申壬子戊午乙卯');
   assert.ok(proof.supportsDay.some(row => row.moving.stem === '丙' && row.day.stem === '戊' && row.relation === '生'));
   assert.ok(proof.monthOfficerLinks.some(row => row.from.stem === '癸' && row.to.position === 'hour' && row.to.stem === '乙'));
   for (const row of [before, after]) {
    const p = row.normalizedPayload;
    assert.equal(p.geSourceStrongBodyWealth, true);
    const { wealth, officer, seal, day } = p.monthWealthLuck.geStrongBodyWealth;
    assert.deepEqual([wealth.position, wealth.stem, officer.position, officer.stem, seal.position, seal.stem, day.stem],
     ['month', '癸', 'hour', '乙', 'day', '丁', '戊']);
   }
   assert.equal(match(run, 107).status, 'not_matched');
   assert.equal(match(run, 108).status, 'not_matched');
   const { input } = modelContext(run);
   assert.match(formatFortuneFactAudit(input), /葛参政原评为身旺坐印、月令财旺/u);
   assert.doesNotMatch(formatFortunePrompt(input), /葛参政原评为身旺坐印、月令财旺|財官旺而身輕|財官輕而身旺|此大运为徐注明列的运步/u);
   assert.equal(ctx('ge', '丙辰', false).geSourceStrongBodyWealth, undefined);
   continue;
  } else {
   assert.equal(after.normalizedPayload.natalPillarSequence, '己酉庚午壬戌己酉');
   assert.ok(before.normalizedPayload.monthWealthLuck.wealthFeedsOfficer.length);
   assert.deepEqual(before.normalizedPayload.monthWealthLuck.monthWealthFeedsOfficerLuck, []);
   assert.ok(proof.wealthFeedsOfficer.some(row => row.from.stem === '丁' && row.to.kind === '透干' && row.to.stem === '己'));
   assert.deepEqual(proof.monthWealthFeedsOfficerLuck.map(row => [row.from.position, row.from.stem, row.to.stem]),
    [['month', '丁', '己']]);
  }
  const hit = match(run, index);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, excerpt);
  assert.equal(hit.windows[0].start, start);
  assert.ok(hit.sourceFactIds.includes(after.factId) && !hit.sourceFactIds.includes(before.factId));
  const { input } = modelContext(run);
  const provider = createFortuneDeepSeek({ apiKey: 'test-key', transport: async (_, options) => {
   const content = JSON.parse(options.body).messages[1].content;
   assert.match(content, providerCondition);
   assert.ok(content.includes('原文：' + excerpt));
   assert.doesNotMatch(content, /concurrent-wealth-officer/u);
   return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(input);
 }
});

test('exposed food and seal use actual month wealth paths, including the Wu branch wood feeding the exposed Bing seal', () => {
 const food = submittedCalendar(ref.calendarExamples[114]), support = submittedCalendar(ref.calendarExamples[115]);
 assert.equal(match(food.run, 114).status, 'not_matched');
 assert.ok(food.paths.foodLuckFeedsMonthWealth.some(link => link.from.stem === '己' && link.to.position === 'month'));
 assert.equal(match(support.run, 115).status, 'not_matched');
 assert.ok(support.paths.supportsDay.some(link => link.moving.stem === '甲' && link.relation === '生'));
 const run = submitted([1971, 1, 3], 8, 1994);
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '辛卯');
 assert.ok(fact);
 assert.deepEqual(fact.normalizedPayload.monthWealthLuck.supportsDay, []);
 assert.deepEqual(fact.normalizedPayload.wealthRemedyLuck.wuWoodFeedsSeal.map(link => [link.from.kind, link.from.stem, link.to.position, link.to.stem]),
  [['运支藏干', '乙', 'hour', '丙']]);
 assert.ok(match(run, 115).sourceFactIds.includes(fact.factId));
 assert.equal(match(run, 115).status, 'matched');
 assert.ok(formatFortuneFactAudit(modelContext(run).input).includes('吴例运干金在运支无同五行藏气'));
});

test('the Wu chart excludes the light-wealth route and changes from its killer feeding the seal to its officer combining with food', () => {
 const date = [1971, 1, 3];
 const food = submitted(date, 8, 1984);
 const geng = rows(food).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '庚寅');
 assert.ok(geng);
 assert.ok(geng.normalizedPayload.wealthRemedyLuck.monthFoodSealPaths.some(path =>
  path.food.position === 'year' && path.food.stem === '庚' && path.incomingFood.length));
 assert.equal(match(food, 114).status, 'not_matched');
 assert.ok(match(food, 115).sourceFactIds.includes(geng.factId));
 const run = submitted(date, 8, 2032);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '乙未');
 assert.ok(change);
 const before = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '甲午' && row.activeTo === change.exactInstant);
 const after = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '乙未' && row.activeFrom === change.exactInstant);
 assert.ok(before && after);
 const route = row => row.normalizedPayload.wealthRemedyLuck.monthFoodSealPaths[0];
 assert.deepEqual(route(before).killerFeedsSeal.map(link => [link.from.stem, link.to.position, link.to.stem]), [['甲', 'hour', '丙']]);
 assert.deepEqual(route(before).officerCombinations, []);
 assert.deepEqual(route(after).killerFeedsSeal, []);
 assert.deepEqual(route(after).officerCombinations.map(pair => [pair.moving.stem, pair.target.position, pair.target.stem]), [['乙', 'year', '庚']]);
 assert.deepEqual(route(after).monthWealth.map(row => [row.position, row.stem]), [['month', '癸']]);
 const hit = match(run, 115);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows.at(-1).endExclusive, change.exactInstant);
 assert.ok(hit.sourceFactIds.includes(before.factId));
 assert.ok(!hit.sourceFactIds.includes(after.factId));
 assert.deepEqual(before.normalizedPayload.wealthRemedyLuck.wuKillerFeedsSeal.map(link => [link.from.kind, link.from.stem, link.to.stem]),
  [['运干', '甲', '丙']]);
 assert.deepEqual(after.normalizedPayload.wealthRemedyLuck.wuKillerFeedsSeal, []);
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.ok(prompt.includes('运七杀生同一原局透印'));
 assert.ok(describeFortuneFact({ method: 'bazi', type: after.factType, data: after.normalizedPayload }, String)
  .includes('本运干正官乙五合原透食神'));
 assert.doesNotMatch(prompt, /monthFoodSealPaths|officerCombinations|killerFeedsSeal/u);
});

test('the Wu source excludes both food-prominence readings across the actual Ren-Chen to Gui-Si handover', () => {
 const date = [1971, 1, 3];
 for (const [hour, sourceExcludes] of [[8, true], [6, false]]) {
  const run = submitted(date, hour, 2012);
  const boundary = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸巳')?.exactInstant;
  assert.ok(boundary);
  const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '壬辰');
  const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '癸巳');
  assert.ok(before && after);
  assert.ok(before.normalizedPayload.wealthLuckRoutes.includes('food-feeds-month-and-moving-wealth'));
  assert.ok(after.normalizedPayload.wealthLuckRoutes.includes('food-seal-supports-day'));
  for (const fact of [before, after]) {
   const data = fact.normalizedPayload;
   assert.equal(data.wuFoodSealSourceExcludesFoodRule, sourceExcludes);
   const contrast = data.monthWealthLuck.wuFoodSealSourceContrast;
   if (sourceExcludes) {
    assert.deepEqual([contrast.monthFood.position, contrast.monthFood.stem, contrast.seal.position, contrast.seal.stem, contrast.day.stem],
     ['year', '庚', 'hour', '丙', '戊']);
   } else assert.equal(contrast, undefined);
  }
  assert.equal(match({ ...run, facts: [before] }, 111).status, sourceExcludes ? 'not_matched' : 'matched');
  assert.equal(match({ ...run, facts: [after] }, 110).status, sourceExcludes ? 'not_matched' : 'matched');
  if (sourceExcludes) {
   const { input } = modelContext(run);
   assert.ok(input.sections.every(section => section.findings.every(row =>
    ![fortuneKnowledge.bazi.rules[110].knowledgeId, fortuneKnowledge.bazi.rules[111].knowledgeId].includes(row.knowledgeId))));
   const localContrast = /吴榜眼原图取时印，年食不作取用/u;
   assert.match(formatFortuneFactAudit(input), localContrast);
   assert.doesNotMatch(formatFortunePrompt(input), localContrast);
  }
 }
 assert.equal(ctx('wu', '癸巳', false).wuFoodSealSourceExcludesFoodRule, undefined);
});

test('wealth with a natal hurting officer accepts either moving output and checks the exact Wang combination', () => {
 const base = ref.calendarExamples[116], choice = submittedCalendar(base);
 const food = submittedCalendar({ ...base, year: 2038, luck: '癸未' });
 for (const context of [choice, food]) {
  assert.ok(context.fact.normalizedPayload.wealthRemedyLuck.monthHurtLinks.some(link =>
   link.from.god === '伤官' && link.to.position === 'month' && link.to.stem === '辛'));
 }
 assert.ok(choice.fact.normalizedPayload.wealthRemedyLuck.hurtingFeedsWealth.some(link =>
  link.from.kind === '运干' && link.from.stem === '戊' && link.to.stem === '辛'));
 assert.equal(match(choice.run, 116).status, 'partial');
 assert.ok(food.fact.normalizedPayload.wealthRemedyLuck.hurtingFeedsWealth.some(link =>
  link.from.kind === '运支藏干' && link.from.stem === '己' && link.from.god === '食神' && link.to.stem === '辛'));
 assert.ok(match(food.run, 116).sourceFactIds.includes(food.fact.factId));
 const inert = submittedCalendar({ date: [1986, 6, 17], hour: 10, gender: 1, year: 2026,
  natal: ['丙寅', '甲午', '壬辰', '乙巳'], luck: '戊戌' });
 assert.ok(inert.fact.normalizedPayload.wealthRemedyLuck.monthHurtLinks.length);
 assert.deepEqual(inert.fact.normalizedPayload.wealthRemedyLuck.hurtInterference, []);
 assert.equal(match(inert.run, 116).status, 'not_matched');
 const wang = submitted([1984, 7, 26], 8, 2030);
 const fact = rows(wang).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '丙子');
 assert.ok(fact);
 const remedies = fact.normalizedPayload.wealthRemedyLuck;
 const positions = remedies.wangInterference.map(pair => [pair.target.position, pair.targetIsDayMaster]);
 assert.deepEqual(positions, [['month', false], ['day', true]]);
 const hurt = remedies.hurtInterference.find(path => path.from.position === 'hour' && path.from.stem === '壬' && path.from.kind === '透干');
 assert.deepEqual(hurt.movingOfficerCombinations.map(pair => [pair.target.position, pair.targetIsDayMaster]), [['month', false]]);
 assert.deepEqual(remedies.wangBranchRelations.map(pair => [pair.kind, pair.members]),
  [['六害', ['year', 'month']], ['六合', ['day', 'hour']]]);
 assert.ok(match(wang, 116).sourceFactIds.includes(fact.factId));
});

test('p074 keeps the Wang combination and seal attack on the same hurt across the Ding-Chou to Wu-Yin transition', () => {
 const run = submitted([1984, 7, 26], 8, 2048);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊寅');
 assert.ok(change);
 const before = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '丁丑' && row.activeTo === change.exactInstant);
 const after = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '戊寅' && row.activeFrom === change.exactInstant);
 assert.ok(before && after);
 const path = fact => fact.normalizedPayload.wealthRemedyLuck.hurtInterference.find(row =>
  row.from.position === 'hour' && row.from.stem === '壬' && row.from.kind === '透干' && row.to.stem === '乙');
 assert.deepEqual(path(before).movingKillerCombinations.map(pair => [pair.moving.stem, pair.target.stem]), [['丁', '壬']]);
 assert.deepEqual(path(after).movingKillerCombinations, []);
 assert.deepEqual(path(after).movingSeals.map(row => [row.kind, row.stem]), [['运干', '戊']]);
 const hit = match(run, 116);
 assert.equal(hit.status, 'partial');
 assert.equal(hit.matchedSourceExcerpt, undefined);
 assert.ok([before, after].every(row => hit.sourceFactIds.includes(row.factId)));
 const { input } = modelContext(run);
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('运印克同一原局伤官'));
 assert.ok(prompt.includes('实际运干七杀丁五合'));
 assert.doesNotMatch(formatFortunePrompt(input), /身重以傷官生財為用|汪学士原评明确比劫旺/u);
});

test('p074 confirms the printed road director seal support across the actual Jia-Zi to Yi-Chou handover', () => {
 const date = [1953, 10, 21];
 const run = submitted(date, 4, 1979, undefined, 0);
 const boundary = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '乙丑')?.exactInstant;
 assert.equal(boundary, '1979-10-05T20:00:00.000Z');
 const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '甲子');
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '乙丑');
 assert.ok(before && after);
 assert.equal(before.normalizedPayload.natalPillarSequence, '癸巳壬戌乙巳戊寅');
 const path = before.normalizedPayload.wealthRemedyLuck.roadDirectorReviewedSealSupport;
 assert.deepEqual(path.hurtSources.map(({ from, to }) => [from.position, from.stem, to.position, to.stem]),
  [['year', '丙', 'month', '戊'], ['day', '丙', 'month', '戊']]);
 assert.deepEqual(path.natalSeals.map(row => [row.position, row.stem]), [['year', '癸'], ['month', '壬']]);
 assert.deepEqual([path.movingSeal.moving.kind, path.movingSeal.moving.stem, path.movingSeal.day.stem, path.movingSeal.relation],
  ['运支藏干', '癸', '乙', '生']);
 assert.ok(after.normalizedPayload.movingRows.slice(2).some(row => row.stem === '癸'));
 assert.equal(after.normalizedPayload.wealthRemedyLuck.roadDirectorReviewedSealSupport, undefined);
 const natalChart = natal(['癸巳', '壬戌', '乙巳', '戊寅']);
 assert.ok(ctx(natalChart, '癸亥').movingRelationPairs.some(pair => pair.kind === '六冲' && pair.values === '巳亥'));
 assert.equal(ctx(natalChart, '癸亥').wealthRemedyLuck.roadDirectorReviewedSealSupport, undefined);
 assert.equal(ctx(natalChart, '甲子', false).wealthRemedyLuck.roadDirectorReviewedSealSupport, undefined);

 const candidate = submitted(date, 6, 1979, undefined, 0);
 assert.ok(rows(candidate).some(row => row.normalizedPayload.luckPillar === '甲子'
  && row.normalizedPayload.wealthLuckRoutes.includes('hurt-wealth-or-support')));
 assert.equal(match(candidate, 116).status, 'partial');
 assert.notEqual(match(run, 110).status, 'matched');
 const hit = match(run, 116);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '身弱以幫身為吉');
 assert.ok(hit.sourceFactIds.includes(before.factId));
 assert.equal(hit.windows.at(-1).endExclusive, boundary);
 assert.equal(hit.candidateWindows[0].start, boundary);
 const { input } = modelContext(run);
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /甲子[^\n]*癸印[^\n]+\n原文：身弱以幫身為吉/u);
 const localSeal = /公路局长原图的印助身已核至实际甲子运/u;
 assert.match(formatFortuneFactAudit(input), localSeal);
 assert.doesNotMatch(prompt, localSeal);
 assert.doesNotMatch(prompt, /身重以傷官生財為用|roadDirectorReviewedSealSupport|road-director-reviewed-seal-support/u);
});

test('p074 distinguishes Wang output and wealth readings across his actual luck transitions', async () => {
 const date = [1984, 7, 26];
 for (const [year, from, to, fromGod, toGod] of [
  [1998, '壬申', '癸酉', '伤官', '食神'],
  [2008, '癸酉', '甲戌', '食神', '正财'],
 ]) {
  const run = submitted(date, 8, year);
  const boundary = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === to)?.exactInstant;
  assert.ok(boundary);
  const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === from);
  const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === to);
  assert.ok(before && after);
  for (const [fact, pillar, god] of [[before, from, fromGod], [after, to, toGod]]) {
   const { wangReviewedOutput, wangReviewedWealth } = fact.normalizedPayload.wealthRemedyLuck;
   const path = god === '正财' ? wangReviewedWealth[0] : wangReviewedOutput[0];
   const moving = path?.movingOutput ?? path?.movingWealth;
   assert.deepEqual([moving?.kind, moving?.pillar, moving?.god], ['运干', pillar, god]);
   assert.deepEqual([path.hurt.position, path.hurt.stem, path.monthWealth.position, path.monthWealth.stem], ['hour', '壬', 'month', '乙']);
  }
  const hit = match(run, 116);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '身重以傷官生財為用');
  const preceding = hit.confirmedBranches.find(branch => branch.sourceFactIds.includes(before.factId));
  const arriving = hit.confirmedBranches.find(branch => branch.sourceFactIds.includes(after.factId));
  assert.ok(preceding && arriving && preceding !== arriving);
  assert.equal(preceding.windows.at(-1).endExclusive, boundary);
  assert.equal(arriving.windows[0].start, boundary);
  assert.match(preceding.conditions.join(''), new RegExp(`${from}运干${from[0]}${fromGod}也生原局同一月财`, 'u'));
  const expected = toGod === '正财' ? /同一原局时壬生本步运干财/u : /癸酉运干癸食神也生原局同一月财/u;
  assert.match(arriving.conditions.join(''), expected);
  const provider = createFortuneDeepSeek({ apiKey: 'test-key', transport: async (_, options) => {
   const message = JSON.parse(options.body).messages[1].content;
   assert.ok(message.includes(preceding.conditions.at(-1)));
   assert.match(message, expected);
   assert.doesNotMatch(message, /身弱以幫身為吉|wang-reviewed-output|wangReviewedOutput/u);
   if (year === 2008) assert.doesNotMatch(message, /壬申运干壬伤官也生原局同一月财/u);
   return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(modelContext(run).input);
 }
 const changedHour = submitted(date, 6, 2008);
 assert.ok(rows(changedHour).some(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '癸酉'));
 assert.notEqual(match(changedHour, 116).status, 'matched');
 assert.deepEqual(ctx(printed('wang'), '癸酉', false).wealthRemedyLuck.wangReviewedOutput, []);
});

test('p074 confirms the Wang wealth branch on the exact Jia-Xu and Yi-Hai stages and stops at Bing-Zi', async () => {
 const date = [1984, 7, 26];
 const incoming = submitted(date, 8, 2018);
 const outgoing = submitted(date, 8, 2028);
 for (const [run, from, to, movingStems] of [
  [incoming, '甲戌', '乙亥', ['甲', '乙']],
  [outgoing, '乙亥', '丙子', ['乙']],
 ]) {
  const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === to);
  assert.ok(change, to);
  const boundary = change.exactInstant;
  const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === from);
  const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === to);
  assert.ok(before && after, to);
  const hit = match(run, 116);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '身重以傷官生財為用');
  for (const [fact, expectedStem] of [[before, movingStems[0]], [after, movingStems[1]]]) {
   const data = fact.normalizedPayload;
   const [path] = data.wealthRemedyLuck.wangReviewedWealth;
   assert.equal(hit.sourceFactIds.includes(fact.factId), Boolean(expectedStem));
   assert.equal(data.wealthLuckRoutes.includes('wang-reviewed-wealth'), Boolean(expectedStem));
   if (expectedStem) {
    assert.deepEqual([path.companion.position, path.companion.stem, path.hurt.position, path.hurt.stem,
     path.monthWealth.position, path.monthWealth.stem], ['month', '辛', 'hour', '壬', 'month', '乙']);
    assert.deepEqual([path.natalWealth.position, path.natalWealth.stem, path.movingWealth.kind, path.movingWealth.stem],
     ['year', '甲', '运干', expectedStem]);
   } else {
    assert.equal(path, undefined);
    assert.ok(data.wealthLuckRoutes.includes('wang-hurt-interference'));
    assert.equal(hit.windows.at(-1).endExclusive, boundary);
    assert.equal(hit.candidateWindows[0].start, boundary);
   }
  }
 }
 const { input } = modelContext(outgoing);
 const provider = createFortuneDeepSeek({apiKey: 'test-key', transport: async (_, options) => {
  const message = JSON.parse(options.body).messages[1].content;
  assert.match(message, /身重以傷官生財為用/u);
  assert.doesNotMatch(message, /身弱以幫身為吉|wangReviewedWealth|原局时壬.*运干丙/u);
  return Response.json({choices: [{finish_reason: 'stop', message: {content: '{"sections":[]}'}}]});
 }});
 await provider.interpret(input);
 const wrongHour = submitted(date, 6, 2018);
 assert.ok(rows(wrongHour).some(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '乙亥'));
 assert.notEqual(match(wrongHour, 116).status, 'matched');
 assert.deepEqual(ctx(printed('wang'), '乙亥', false).wealthRemedyLuck.wangReviewedWealth, []);
});

test('wealth and killer routes use the exact natal treated target, with the source Li branch seal preserved separately', () => {
 const base = ref.calendarExamples[117], output = submittedCalendar(base);
 const support = submittedCalendar({ ...base, year: 2029, luck: '壬午' });
 const actual = output.fact.normalizedPayload.wealthRemedyLuck;
 assert.ok(actual.outputControlsTreatedKiller.length);
 assert.ok(actual.outputControlsTreatedKiller.every(link => actual.treatedKillers.some(row => row.killer.position === link.to.position
  && row.killer.stem === link.to.stem && row.wealth.some(wealth => wealth.position === 'month'))));
 assert.deepEqual(support.fact.normalizedPayload.wealthRemedyLuck.outputControlsTreatedKiller, []);
 assert.ok(support.paths.supportsDay.some(row => row.relation === '同五行'));
 assert.equal(match(output.run, treatedKillerSourceIndex).status, 'matched');
 assert.equal(match(support.run, treatedKillerSourceIndex).status, 'matched');
 const combining = submittedCalendar({ date: [1940, 4, 11], hour: 2, gender: 0, year: 1963,
  natal: ['庚辰', '庚辰', '甲申', '乙丑'], luck: '丁丑' });
 const combined = combining.fact.normalizedPayload.wealthRemedyLuck.treatedKillers;
 assert.ok(combined.some(path => path.killer.position === 'month' && path.killer.stem === '庚'
  && path.combinations.some(pair => pair.first.stem === '庚' && pair.second.stem === '乙')));
 assert.ok(combined.every(path => path.controllers.length === 0));
 const combinedHit = match(combining.run, treatedKillerSourceIndex);
 assert.equal(combinedHit.status, 'matched');
 assert.ok(combinedHit.sourceFactIds.includes(combining.fact.factId));
 const li = submitted([1880, 12, 15], 4, 1940);
 const fact = rows(li).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '甲午');
 assert.ok(fact);
 assert.deepEqual(fact.normalizedPayload.wealthRemedyLuck.liBranchSeal.map(link => [link.from.kind, link.from.stem, link.to.stem]),
  [['运支藏干', '丁', '庚']]);
 const liHit = match(li, treatedKillerSourceIndex);
 assert.equal(liHit.status, 'matched');
 assert.ok(liHit.sourceFactIds.includes(fact.factId));
 const stem = submittedCalendar({ date: [1880, 12, 15], hour: 4, gender: 1, year: 1960,
  natal: ['庚辰', '戊子', '戊寅', '甲寅'], luck: '丙申' });
 const stemPressure = stem.fact.normalizedPayload.wealthRemedyLuck.killerControlPressure;
 assert.ok(stemPressure.some(path => path.killer.position === 'hour' && path.killer.stem === '甲'
  && path.controller.position === 'year' && path.controller.stem === '庚'
  && path.attacks.some(row => row.kind === '运干' && row.stem === '丙')));
 assert.ok(stem.fact.normalizedPayload.wealthRemedyLuck.outputControlsTreatedKiller.some(link =>
  link.from.kind === '运支藏干' && link.from.stem === '庚' && link.to.position === 'hour' && link.to.stem === '甲'));
 assert.ok(match(stem.run, treatedKillerSourceIndex).sourceFactIds.includes(stem.fact.factId));

 const pressure = submittedCalendar({ ...base, year: 2058, luck: '乙酉' });
 const pressureFacts = pressure.fact.normalizedPayload;
 assert.ok(pressure.run.facts.some(row => row.factType === 'zpqz_moving_relations' && row.normalizedPayload.annualStem === '戊'));
 assert.ok(pressureFacts.wealthLuckRoutes.includes('treated-killer-counterpressure'));
 assert.ok(!pressureFacts.wealthLuckRoutes.includes('treated-killer-luck'));
 assert.equal(match(pressure.run, treatedKillerSourceIndex).status, 'not_matched');

 const { input } = modelContext(li);
 assert.deepEqual(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === liHit.knowledgeId)?.windows, liHit.windows);
 assert.match(formatFortunePrompt(input), /若月令取财且原局用合或制处理七杀/u);
});

test('p076 ordinary moving output still reaches the same month wealth, killer, and seal locally', () => {
 const run = submittedCalendar({ date: [1970, 1, 8], hour: 4, gender: 1, year: 2022,
  natal: ['己酉', '丁丑', '戊子', '甲寅'], luck: '辛未' });
 const { fact } = run;
 const payload = fact.normalizedPayload;
 assert.deepEqual(payload.wealthLuckRoutes.filter(route => route.includes('killer-seal')),
  ['output-feeds-wealth-under-killer-seal']);
 const [path] = payload.wealthRemedyLuck.movingOutputWealthKillerSeal;
 assert.deepEqual([path.output.stem, path.monthWealth.position, path.monthWealth.stem, path.killer.position, path.killer.stem,
  path.seal.position, path.seal.stem, path.day.stem], ['辛', 'month', '癸', 'hour', '甲', 'month', '丁', '戊']);
 assert.equal(match(run.run, 118).status, 'not_matched');
 assert.ok(describeFortuneFact({ method: 'bazi', type: fact.factType, data: payload }, String).includes('运食伤经月财生原透七杀'));
 const withoutKiller = submitted([1970, 1, 8], 6, 2022);
 const changed = rows(withoutKiller).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '辛未');
 assert.ok(changed);
 assert.equal(changed.normalizedPayload.killerExposed, false);
 assert.deepEqual(changed.normalizedPayload.wealthRemedyLuck.movingOutputWealthKillerSeal, []);
 assert.equal(match(withoutKiller, 118).status, 'not_matched');
});

test('the exposed killer feeds the incoming seal, while wealth can both attack and combine with the original seal', () => {
 const base = ref.calendarExamples[118];
 const seal = submittedCalendar({ ...base, year: 1992, luck: '乙酉' });
 const wealth = submittedCalendar(base);
 const remedies = seal.fact.normalizedPayload.wealthRemedyLuck;
 assert.ok(remedies.killerSealPairs.some(link => link.from.kind === '透干' && link.from.stem === '戊'
  && link.to.kind === '透干' && link.to.stem === '庚'));
 assert.ok(remedies.killerFeedsSealLuck.some(link => link.from.position === 'hour' && link.from.stem === '戊'
  && link.to.stem === '辛' && link.to.kind === '运支藏干'));
 assert.ok(wealth.fact.normalizedPayload.wealthRemedyLuck.wealthControlsKillerSeal.some(link =>
  link.from.stem === '丁' && link.to.stem === '庚' && !link.alsoCombines));
 assert.equal(match(seal.run, 118).status, 'not_matched');
 assert.equal(match(wealth.run, 118).status, 'not_matched');
 const zhao = submitted([1925, 11, 11], 22, 1967);
 const change = zhao.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '壬午');
 const fact = rows(zhao).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '壬午');
 assert.ok(change && fact);
 const prior = rows(zhao).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '癸未'
  && row.activeTo === change.exactInstant);
 assert.ok(prior);
 assert.equal(fact.activeFrom, change.exactInstant);
 assert.equal(match(zhao, 118).status, 'matched');
 assert.deepEqual(prior.normalizedPayload.wealthRemedyLuck.zhaoGuiWeiSeal.map(row => [row.stem, row.kind]),
  [['丁', '运支藏干']]);
 assert.deepEqual(fact.normalizedPayload.wealthRemedyLuck.zhaoRenWuCombinesSeal.map(row => [row.from.stem, row.to.stem, row.alsoCombines]),
  [['壬', '丁', true]]);
 for (const [stage, stem, combines] of [[prior, '癸', false], [fact, '壬', true]]) {
  assert.deepEqual(stage.normalizedPayload.wealthRemedyLuck.wealthControlsKillerSeal.map(link =>
   [link.from.stem, link.to.position, link.to.stem, link.alsoCombines]), [[stem, 'month', '丁', combines]]);
  assert.ok(match(zhao, 118).sourceFactIds.includes(stage.factId));
 }
 const { input } = modelContext(zhao);
 for (const [pillar, meaning] of [['癸未', '原例相宜运步'], ['壬午', '壬财合丁印']]) {
  const reading = input.facts.find(row => row.type === 'zpqz_wealth_context' && row.data.luckPillar === pillar
   && row.data.printedLuck?.some(line => line.name === '赵侍郎取运图' && line.assessment.includes(meaning)));
  assert.ok(reading, pillar);
 }
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('同一对天干亦有五合'));
 assert.ok(!prompt.includes('wealthRemedyLuck'));
});

test('ten real modern calendars supply SQLite results only from exact natal columns and unique validated luck segments with raw provenance',()=>{
 for(const i of indices){const run=real(i),e=ref.calendarExamples[i];validateFortuneFacts(run);assert.equal(match(run,i).status,namedSourceIndices.has(i)?'not_matched':completeSourceIndices.has(i)||i===110?'matched':'partial',String(i));
  const selected=rows(run).filter(f=>f.normalizedPayload.confirmed&&f.normalizedPayload.luckPillar===e.luck);assert.ok(selected.length);
  for(const f of selected){assert.deepEqual(f.normalizedPayload.natalPillars.map(p=>p.pillar),e.natal);assert.ok(f.normalizedPayload.stageStart<=f.activeFrom&&f.activeTo<=f.normalizedPayload.stageEnd);assert.ok(f.sourceFactIds.every(id=>run.rawFacts.some(raw=>raw.rawFactId===id)));}}
});

test('source hashes survive SQLite, every rule is atomic and missing the atomic fact cannot be replaced by generic natal and luck records',()=>{
 for(const i of indices){const r=fortuneKnowledge.bazi.rules[i],e=fortuneKnowledge.bazi.entries.find(e=>e.id===r.knowledgeId);assert.equal(r.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:e.evidence,conditions:e.conditions})).digest('hex'));assert.equal(r.queries.length,1);assert.equal(r.unresolved.length,completeSourceIndices.has(i)?0:1);assert.equal(r.queries[0].factType,'zpqz_wealth_context');}
 const run=structuredClone(real(114));run.facts=run.facts.filter(f=>f.factType!=='zpqz_wealth_context');assert.equal(match(run,114).status,'unknown');
 const noTreatment=structuredClone(real(117));rows(noTreatment).forEach(f=>f.normalizedPayload.killerTreatmentCandidate=false);assert.equal(match(noTreatment,117).status,'not_matched');
});

test('actual provider transport receives natural Chinese targets and source differences, with no raw JSON, private IDs or incomplete source paragraphs',async()=>{
 const run=real(115),{input,knowledge}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'wealth-private-report'));
 assert.ok(input.facts.some(f=>f.type==='zpqz_wealth_context'));const prompt=formatFortuneFactAudit(input);
 for(const phrase of ['财用食印须食印均明透','财月透杀印须杀印均明透','日干仍是日元','前章正文与评注有分歧','李例印可行支不可行干'])assert.ok(prompt.includes(phrase),phrase);
 for(const key of ['wealth-private','zpqz-wealth-visible-food','foodSealPairs','natalMovingContacts','killerTreatmentCandidate','monthWealthCandidate','stageStart','sourceVariants'])assert.ok(!prompt.includes(key),key);
 const findings = input.sections.flatMap(section => section.findings);
 assert.ok(findings.some(row => row.knowledgeId === fortuneKnowledge.bazi.rules[wealthRemedySourceIndex].knowledgeId));
 for (const index of indices.filter(index => !completeSourceIndices.has(index))) {
  const result = knowledge.byMethod.bazi[index];
  const finding = findings.find(row => row.knowledgeId === result.knowledgeId);
  if (!finding) continue;
  assert.equal(result.status, 'matched');
  assert.ok(result.matchedSourceExcerpt);
  assert.equal(finding.originalText, result.matchedSourceExcerpt);
  assert.deepEqual(finding.windows, result.windows);
 }
 assert.ok(!/[{}\[\]]/u.test(describeFortuneFact({method:'bazi',type:'zpqz_wealth_context',data:ctx('wu')},String)));
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await provider.interpret(input);
});

test('the 43 reviewed movements retain source context while SQLite separates their comparison stages', () => {
 const reviewed = fortuneKnowledge.bazi.rules.filter(rule => rule.review?.printedLuck && rule.queries[0]?.factType === 'zpqz_wealth_context');
 assert.equal(reviewed.length, 8);
 const examples = reviewed.flatMap(rule => rule.review.printedLuck.flatMap(reading => {
  const source = ref.printedCases.find(row => row.name === reading.name);
  assert.ok(source);
  assert.equal(source.pillars.join(''), reading.natalPillarSequence);
  return reading.periods.flatMap(({ pillars }) => pillars.map(pillar => ({
   knowledgeId: rule.knowledgeId,
   fact: { factType: 'zpqz_wealth_context', scope: 'decadal', completeness: 'complete',
    normalizedPayload: { ...ctx(source.id, pillar), confirmed: true } },
  })));
 }));
 assert.equal(examples.length, 43);
 const evaluated = new Map(evaluateFortuneRules('bazi', 'year', examples.map(example => example.fact))
  .map(result => [result.knowledgeId, result]));
 const comparedOnly = new Map([
  [fortuneKnowledge.bazi.rules[107].knowledgeId, ['甲寅', '丙辰', '丁巳', '戊午', '己未']],
  [fortuneKnowledge.bazi.rules[108].knowledgeId, ['乙卯']],
  [fortuneKnowledge.bazi.rules[111].knowledgeId, ['丁未', '戊申']],
  [fortuneKnowledge.bazi.rules[114].knowledgeId, ['戊申', '己酉', '庚戌', '辛亥']],
  [fortuneKnowledge.bazi.rules[115].knowledgeId, ['壬辰', '乙未']],
 ]);
 for (const { knowledgeId, fact } of examples) {
  const pillar = fact.normalizedPayload.luckPillar;
  assert.equal(evaluated.get(knowledgeId).required[0].hits.includes(fact),
   !comparedOnly.get(knowledgeId)?.includes(pillar), knowledgeId + ' ' + pillar);
 }
});

test('eight archived diagrams distinguish the active lookup from printed comparison stages', async () => {
 const cases = [
  ['ge', [1932, 12, 23], 6, 1949, '甲寅', 107, '运干甲混杀与运支寅会午帮身', false],
  ['yang', [1962, 2, 11], 10, 2002, '丙午', 111, '有食伤回克且可暖局', false],
  ['wu', [1971, 1, 3], 8, 1994, '辛卯', 115, '运干金不通根、运支木助火', true],
  ['pingjiang', [2012, 6, 1], 18, 2033, '戊申', 114, '申酉印助身旺反晦', false],
  ['wang', [1984, 7, 26], 8, 2042, '丁丑', 116, '运干丁杀合时干壬伤', false],
  ['mao', [1885, 4, 9], 8, 1921, '丙子', 117, '子支冲午的提醒', false],
  ['li', [1880, 12, 15], 4, 1940, '甲午', 117, '运干甲另存为七杀', true],
  ['zhao', [1925, 11, 11], 22, 1951, '甲申', 118, '官杀生印与运支申酉食伤生财', false],
 ];
 for (const [id, date, hour, year, pillar, index, phrase, usesOriginalCaseBranch] of cases) {
  const run = submitted(date, hour, year);
  const sequence = Object.values(printed(id)).join('');
  const selected = rows(run).filter(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.luckPillar === pillar);
  assert.ok(selected.length, id);
  assert.ok(selected.every(fact => fact.normalizedPayload.natalPillarSequence === sequence), id);
  const { input, knowledge } = modelContext(run);
  const result = knowledge.byMethod.bazi[index];
  assert.equal(result.status, id === 'ge' ? 'not_matched' : completeSourceIndices.has(index) ? 'matched' : 'partial', id);
  const localOnly = id === 'pingjiang';
  assert.equal(selected.some(fact => result.sourceFactIds.includes(fact.factId)), !localOnly && id !== 'ge', id);
  const warningFact = localOnly ? selected.find(fact => fact.activeFrom === result.windows.at(-1).endExclusive) : undefined;
  const evidence = localOnly
   ? warningFact && { data: warningFact.normalizedPayload, start: warningFact.activeFrom }
   : input.facts.find(fact => fact.type === 'zpqz_wealth_context' && fact.data.luckPillar === pillar && fact.data.printedLuck?.length);
  assert.ok(evidence, id);
  const prompt = formatFortuneFactAudit(input);
  if (!localOnly) assert.ok(prompt.includes(phrase), id);
  assert.ok(!prompt.includes('natalPillarSequence') && !prompt.includes('printedLuck'), id);
  assert.equal(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId),
   completeSourceIndices.has(index), id);
  if (id === 'ge') {
   const { geYinWu } = selected[0].normalizedPayload.monthWealthLuck;
   assert.deepEqual(geYinWu.fire.missingKnownBranches, ['戌']);
   assert.deepEqual(geYinWu.clash.members, ['month', 'day']);
   assert.deepEqual([geYinWu.killer.stem, geYinWu.killer.kind], ['甲', '运干']);
  }
  if (id === 'yang') {
   const { yangCounter } = selected[0].normalizedPayload.monthWealthLuck;
   assert.deepEqual(yangCounter.filter(link => link.from.stem === '壬' && link.from.kind === '透干').map(link => link.from.position), ['year', 'month']);
   assert.ok(yangCounter.every(link => link.relation === '克' && link.to.kind === '运干' && link.to.stem === '丙'));
   assert.ok(prompt.includes('回克同一本步大运运干丙'));
  }
  if (id === 'mao') {
   const { killerControlPressure, outputControlsTreatedKiller } = selected[0].normalizedPayload.wealthRemedyLuck;
   assert.ok(killerControlPressure.some(path => path.killer.stem === '庚' && path.killer.position === 'month'
    && path.controller.position === 'day' && path.controller.stem === '丁' && path.controller.kind === '支藏'
    && path.branchClashes.some(pair => pair.kind === '六冲' && pair.members.includes('day') && pair.members.includes('decadal'))));
   assert.ok(outputControlsTreatedKiller.some(link => link.from.stem === '丙' && link.to.position === 'month' && link.to.stem === '庚'));
  }
  if (usesOriginalCaseBranch) {
   const other = structuredClone(run);
   for (const fact of rows(other)) fact.normalizedPayload.natalPillarSequence = '甲子甲子甲子甲子';
   assert.equal(match(other, index).status, 'not_matched', id);
  }
  if (id === 'pingjiang') {
   const before = input.facts.find(fact => fact.type === 'zpqz_wealth_context' && fact.data.luckPillar === '丁未' && fact.data.printedLuck?.length);
   assert.ok(before, id);
   assert.equal(before.endExclusive, evidence.start);
   assert.ok(prompt.includes('财轻喜财'), id);
   assert.equal(knowledge.byMethod.bazi[115].status, 'not_matched');
   const prior = rows(run).find(fact => fact.normalizedPayload.luckPillar === '丁未' && fact.activeTo === warningFact.activeFrom);
   assert.ok(prior && result.sourceFactIds.includes(prior.factId));
   assert.ok(!result.sourceFactIds.includes(warningFact.factId));
   const reviewed = fortuneKnowledge.bazi.rules[index].review.printedLuck
    .find(row => row.natalPillarSequence === sequence).periods.find(row => row.pillars.includes('戊申'));
   assert.ok(reviewed.assessment.includes(phrase));
   const [namedWealth] = prior.normalizedPayload.wealthRemedyLuck.pingjiangSourceWealth;
   assert.deepEqual([namedWealth.food.stem, namedWealth.originalWealth.stem, namedWealth.movingWealth.stem,
    namedWealth.originalOfficer.stem, namedWealth.seal.stem], ['乙', '丙', '丁', '戊', '辛']);
   const { pingjiangFoodSealComparison: comparison } = evidence.data.wealthRemedyLuck;
   assert.deepEqual(comparison.chenYou.members, ['year', 'hour']);
   assert.deepEqual(comparison.siYou, ['month', 'day']);
   assert.deepEqual(comparison.natalMonthWealthFeedsAuthority.map(link => [link.from.stem, link.to.position, link.to.stem]),
    [['丙', 'month', '戊'], ['丙', 'day', '戊']]);
   assert.deepEqual(comparison.monthWealthFeedsMovingAuthority.map(link => [link.from.stem, link.to.kind, link.to.stem]),
    [['丙', '运干', '戊']]);
   assert.deepEqual(comparison.movingSealsSupportingDay.map(link => [link.moving.kind, link.moving.stem, link.day.stem]),
    [['运支藏干', '庚', '癸']]);
   assert.ok(prompt.includes('平江原局年辰与时酉有六合'));
   assert.ok(prompt.includes('平江原局月柱、日柱两处巳和时酉各见合金会位'));
  }
  if (namedSourceIndices.has(index)) {
   const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId);
   assert.deepEqual(finding.windows, result.windows);
   const title = { wu: '吴', pingjiang: '平江', zhao: '赵' }[id];
   assert.ok(finding.note.includes(title), id);
   let checked = false;
   const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_url, options) => {
    const content = JSON.parse(options.body).messages[1].content;
    assert.ok(content.includes(finding.note));
    assert.ok(content.includes(finding.originalText));
    checked = true;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
   } });
   await provider.interpret(input);
   assert.ok(checked, id);
  }
 }
});

test('the same luck pillar with a different hour or an unconfirmed stage cannot supply a printed reading', () => {
 const run = submitted([1932, 12, 23], 8, 1949, batch => {
  for (const fact of rows(batch)) fact.normalizedPayload.printedLuck = [{ name: '伪造原例', premise: '伪造前提', assessment: '伪造判语' }];
 });
 assert.ok(rows(run).some(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.luckPillar === '甲寅'));
 assert.equal(match(run, 107).status, 'not_matched');
 assert.ok(!formatFortuneFactAudit(modelContext(run).input).includes('伪造'));
 const uncertain = submitted([1932, 12, 23], 6, 1949, batch => {
  for (const fact of rows(batch)) fact.normalizedPayload.confirmed = false;
 });
 assert.equal(match(uncertain, 107).status, 'not_matched');
 assert.ok(!formatFortuneFactAudit(modelContext(uncertain).input).includes('运干甲混杀与运支寅会午帮身'));
});
