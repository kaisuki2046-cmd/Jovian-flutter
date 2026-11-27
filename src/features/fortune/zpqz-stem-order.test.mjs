import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Solar } from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
import { createFortuneDeepSeek } from './server/deepseek-expression.mjs';
const {baziZpqzStemOrder,zpqzStemPolicy,zpqzPrintedStemCases}=await import('./control/bazi-zpqz-stems.ts');
const {calculateFortuneFacts,validateFortuneFacts}=await import('./control/fortune-facts.ts');
const {buildFactTimeContext}=await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const {matchFortuneKnowledge}=await import('./control/knowledge/match.ts');
const {evaluateFortuneRules,fortuneKnowledge}=await import('./control/knowledge/catalog.ts');
const {buildFortuneModelContext}=await import('./control/fortune-model-context.ts');
const {interpretFortune,requestForFortuneRun}=await import('./control/fortune-interpretation.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/zpqz-stem-order-reference.json',import.meta.url)));
const layers=['year','month','day','hour'],native=values=>Object.fromEntries(layers.map((key,i)=>[key,values[i]]));
const completeSourceIndices = new Set([71, 72, 87, 105, 112, 113]);
const printed=id=>native(ref.printedCases.find(c=>c.id===id).pillars),context=(n=printed('zeng-wealth-seal'),luck='壬辰',known=true)=>baziZpqzStemOrder(n,known,luck);
function archive(e){const [y,m,d]=e.date,l=Solar.fromYmdHms(y,m,d,e.hour,0,0).getLunar();
 const luckPeriods=l.getEightChar().getYun(e.gender,2).getDaYun(11).slice(1).map(s=>({ganZhi:s.getGanZhi(),startAge:s.getStartAge(),endAge:s.getEndAge()}));
 return {timeKnown:true,bazi:{engineName:'lunar-javascript',engineVersion:'1.7.8',rulesetVersion:'utc8-jie-local-civil-late-zi-next-v1',rawResult:[{
  utc:new Date(Date.UTC(y,m-1,d,e.hour-8)).toISOString(),year:l.getYearInGanZhiExact(),month:l.getMonthInGanZhiExact(),day:l.getDayInGanZhiExact(),hour:l.getTimeInGanZhi(),luckPeriods,tenGods:{},shenSha:{},
 }]},ziwei:{rawResult:[]},western:{rawResult:[]}};
}
function calculate(chart,year){const input={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year}};return calculateFortuneFacts(input,buildFactTimeContext(input,Date.parse(year+'-11-19T02:00:00Z'),'server'),'stem-order-run',{snapshotId:'stem-order-snapshot',chart});}
const cache=new Map(),real=i=>{if(!cache.has(i)){const e=ref.calendarExamples[i];cache.set(i,calculate(archive(e),e.year));}return cache.get(i);};
const rows=run=>run.facts.filter(f=>f.factType==='zpqz_stem_order');
const match=(run,i)=>matchFortuneKnowledge(run).byMethod.bazi[i];

function submittedChart(chart, year, snapshotId) {
 const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
 const now = Date.UTC(year, 5, 1);
 const reference = { snapshotId };
 const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...reference, chart })));
 assert.ok(rows(batch).every(fact => !('printedLuck' in fact.normalizedPayload)));
 const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
 validateFortuneFacts(run);
 return run;
}
function submitted(index, year, { hour = ref.calendarExamples[index].hour, gender = 1 } = {}) {
 return submittedChart(archive({ ...ref.calendarExamples[index], hour, gender }), year,
  'zpqz-stem-printed-' + index + '-' + year + '-' + hour);
}
function submittedCalendar(e, year = e.year) {
 const chart = archive(e), birth = chart.bazi.rawResult[0];
 assert.deepEqual(layers.map(layer => birth[layer]), e.natal);
 chart.birthContext = { birthInstant: birth.utc, precision: 'minute', latitude: 39.9042, longitude: 116.4074,
  timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
 return submittedChart(chart, year, 'stem-order-calendar-' + e.date.join('-') + '-' + e.hour);
}
const modelContext = run => buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'stem-printed-report'));

function calendarStemOrder(example) {
 const run = submittedCalendar(example);
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === example.luck);
 assert.ok(fact, example.luck);
 return { run, fact, data: fact.normalizedPayload };
}

test('five independent source diagrams retain exact column order, including the Bing day absent from non-day exposed stems',()=>{
 assert.deepEqual(zpqzPrintedStemCases,ref.printedCases);
 for(const e of ref.printedCases){const p=context(native(e.pillars));assert.equal(p.printedCases.find(c=>c.id===e.id).matches,true);}
 const p=context();assert.equal(p.dayMaster,'丙');assert.ok(!p.natalExposedStems.includes('丙'));assert.equal(p.hasJiaGengBingBridge,true);
 const bridge=p.jiaGengBingBridges[0];assert.equal(bridge.first.position,'month');assert.equal(bridge.second.position,'hour');
 assert.deepEqual(bridge.between.map(r=>[r.position,r.stem]),[['day','丙']]);
});

test('mere stem co-presence cannot replace the source bridge or Yi-Ji adjacency; reversed and more remote witnesses retain their real intervening stems',()=>{
 const bad=context(native(['庚寅','甲申','丙申','丙申']));assert.deepEqual([...bad.natalExposedStems].sort(),['丙','庚','甲'].sort());assert.equal(bad.hasJiaGengBingBridge,false);
 const original=context(printed('yi-ji-adjacent'),'辛巳');assert.equal(original.hasYiJiAdjacency,true);assert.equal(original.yiJiPairs[0].distance,1);
 const remote=context(native(['乙未','辛巳','庚寅','己卯']),'辛巳');assert.equal(remote.hasYiJiAdjacency,false);assert.equal(remote.yiJiPairs[0].distance,3);
 assert.deepEqual(remote.yiJiPairs[0].between.map(r=>r.position),['month','day']);
 const reversed=context(native(['乙未','庚申','丙申','甲寅']));assert.equal(reversed.hasJiaGengBingBridge,true);assert.equal(reversed.wealthSealPairs[0].wealth.position,'month');
});

test('source intervening-Ding and intervening-Yi examples distinguish day-master contact from non-day combination without declaring effective removal',()=>{
 const ding=context(printed('jia-ji-ding-between'));
 const pair=ding.natalFivePairs.find(r=>r.first.stem==='甲'&&r.second.stem==='己');assert.ok(pair.involvesDayMaster);assert.deepEqual(pair.between.map(r=>r.stem),['丁']);
 const yi=context(printed('wu-gui-yi-between')),other=yi.natalFivePairs.find(r=>r.first.stem==='癸'&&r.second.stem==='戊');
 assert.equal(other.involvesDayMaster,false);assert.deepEqual(other.between.map(r=>r.stem),['壬','乙']);
 assert.ok(!('removed' in other)&&!('transformed' in other));
});

test('all ten day stems use the specific exposed robbery-or-hurting stem that actually makes the five-combination with the killer',()=>{
 const stems='甲乙丙丁戊己庚辛壬癸',pillar=stem=>stem+(stems.indexOf(stem)%2?'丑':'子');
 for(const [day,kill,combiner,god]of ref.killCombiners){const p=context({year:pillar(kill),month:pillar(combiner),day:pillar(day),hour:pillar(day)},pillar(day));
  const pair=p.natalKillPairs.find(r=>r.kill.stem===kill&&r.combiner.stem===combiner);assert.ok(pair,day);assert.equal(pair.combiner.tenGod,god);
  assert.equal(p.dayYang,god==='劫财');assert.ok(p.natalKillCombinerTenGods.includes(god));
 }
});

test('a luck stem combining wealth cannot stand for combining an independently present officer, and moving luck has no invented natal adjacency',()=>{
 const n=native(['己未','丙子','甲戌','辛未']),p=context(n,'甲戌');
 assert.ok(p.natalExposedTenGods.includes('正官'));assert.deepEqual(p.combiningNatalTenGods,['正财']);
 assert.ok(p.movingFivePairs.every(row=>row.target.stem==='己'&&!('distance'in row)&&!('adjacent'in row)));
 const officer=context(n,'丙寅');assert.ok(officer.combiningNatalTenGods.includes('正官'));
});

test('day Ding, natal Ding and moving Ding retain their separate identities and all old contacts instead of being labelled automatic rivalry',()=>{
 const n=native(ref.calendarExamples[72].natal),p=context(n,'丁未'),target=p.movingFivePairs.find(r=>r.target.stem==='壬');
 assert.equal(target.target.tenGod,'正官');assert.equal(target.targetIsDayMaster,false);
 assert.ok(target.nativeSameAsMoving.some(r=>r.position==='day'));assert.ok(target.natalOtherFiveContacts.some(r=>r.position==='day'));
 assert.ok(p.natalFivePairs.some(r=>r.involvesDayMaster));assert.ok(!('rivalryResolved'in target));
 const self=context(n,'壬子').movingFivePairs.find(r=>r.target.position==='day');assert.equal(self.targetIsDayMaster,true);
});

test('seal attack is tied to the exact hurting-officer stem already paired with the killer, without claiming it has been removed',()=>{
 const n=native(ref.calendarExamples[106].natal),p=context(n,'壬寅');assert.equal(p.dayYang,false);assert.ok(p.hasMovingAttackOnKillCombiner);
 for(const row of p.movingAttacksKillCombiners){assert.equal(row.moving.tenGod,'正印');assert.equal(row.combiner.stem,'丙');assert.equal(row.kill.stem,'辛');
  assert.ok(p.natalKillPairs.some(pair=>pair.combiner.position===row.combiner.position&&pair.kill.position===row.kill.position));}
 const wrong=context({...n,month:'戊申'},'壬寅');assert.equal(wrong.natalKillPairs.length,0);assert.equal(wrong.hasMovingAttackOnKillCombiner,false);
});

test('Li source requires a monthly officer and the same native killer repeated in the luck stem', () => {
 const base = ref.calendarExamples[105];
 const { robberyWithoutMonthOfficer, twoRobberyStems } = ref.officerKillExamples;
 const positive = calendarStemOrder({ ...base, year: 2006 });
 const hit = match(positive.run, 105);
 assert.equal(hit.status, 'matched');
 const layout = positive.data.officerKillLuck;
 assert.deepEqual([layout.monthOfficer.pillar, layout.monthOfficer.stem], ['乙酉', '辛']);
 assert.deepEqual(layout.monthOfficer.exposedSeats, []);
 assert.deepEqual(layout.sameKillerInLuck.map(row => [row.pair.kill.position, row.pair.combiner.position, row.exposed.stem]),
  [['year', 'month', '庚']]);
 assert.ok(layout.sameKillerInLuck[0].movingCombinations.some(row => row.target.position === 'month' && row.target.stem === '乙'));
 const transition = positive.run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '己卯');
 assert.ok(transition);
 assert.equal(hit.windows.at(-1).endExclusive, transition.exactInstant);
 const { input } = modelContext(positive.run), prompt = formatFortuneFactAudit(input);
 assert.ok(input.facts.some(fact => fact.type === 'zpqz_stem_order' && fact.data.luckPillar === '庚辰'
  && fact.endExclusive === transition.exactInstant));
 assert.ok(prompt.includes('运干庚再见同一七杀'));
 assert.ok(!prompt.includes('officerKillLuck'));
 const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
 assert.deepEqual(finding?.windows, hit.windows);

 const doubled = calendarStemOrder(twoRobberyStems);
 assert.equal(match(doubled.run, 105).status, 'matched');
 assert.deepEqual(doubled.data.officerKillLuck.sameKillerInLuck.map(row => row.pair.combiner.position), ['month', 'hour']);
 const hidden = calendarStemOrder({ ...base, year: 1960, luck: '甲申' });
 assert.equal(match(hidden.run, 105).status, 'not_matched');
 assert.equal(hidden.data.officerKillLuck.sameKillerInLuck[0].exposed, undefined);
 assert.deepEqual(hidden.data.officerKillLuck.sameKillerInLuck[0].hidden, [{ stem: '庚', mainQi: true }]);
 assert.ok(hidden.run.facts.some(row => row.factType === 'zpqz_moving_relations' && row.normalizedPayload.annualStem === '庚'));

 const wrongMonth = calendarStemOrder(robberyWithoutMonthOfficer);
 assert.ok(wrongMonth.data.natalPresentTenGods.includes('正官') && wrongMonth.data.natalKillPairs.length);
 assert.equal(wrongMonth.data.officerKillLuck, undefined);
 assert.equal(match(wrongMonth.run, 105).status, 'not_matched');
});

test('the owl route distinguishes leading indirect seals and secondary seals fed at the same pillar', () => {
 const base = ref.calendarExamples[106];
 const { hurtingWithoutMonthOfficer, wealthAgainstSeal } = ref.officerKillExamples;
 for (const [example, placement, tenGod, status] of [
  [base, '运干', '正印', 'not_matched'],
  [{ ...base, year: 2021, luck: '庚子' }, '运支本气', '偏印', 'matched'],
  [{ ...base, year: 2031, luck: '辛丑' }, '运支其他藏干', '偏印', 'partial'],
  [{ ...base, year: 2051, luck: '癸卯' }, '运干', '偏印', 'matched'],
  [wealthAgainstSeal, '运干', '正印', 'not_matched'],
 ]) {
  const { run, fact, data } = calendarStemOrder(example);
  const hit = match(run, 106), layout = data.officerKillLuck;
  assert.equal(hit.status, status);
  assert.equal(hit.sourceFactIds.includes(fact.factId), status !== 'not_matched');
  assert.equal(data.directOwlAgainstHurt, status === 'matched' && placement === '运干');
  assert.deepEqual([layout.monthOfficer.pillar, layout.monthOfficer.stem], ['丙申', '庚']);
  assert.deepEqual(layout.luckSealAgainstCombiner.map(row => [row.seal.placement, row.seal.tenGod,
   row.pair.combiner.stem, row.pair.kill.stem]), [[placement, tenGod, '丙', '辛']]);
  assert.equal(data.killCombinationRoutes.includes('seal-controls-hurting-combiner'), placement !== '运支其他藏干');
  assert.equal(data.killCombinationRoutes.includes('owl-controls-hurting-combiner'), placement !== '运支其他藏干' && tenGod === '偏印');
  assert.equal(data.killCombinationRoutes.includes('supported-secondary-owl-controls-hurting-combiner'), placement === '运支其他藏干');
  assert.deepEqual(layout.luckSealAgainstCombiner[0].nativeWealth.map(row => [row.position, row.stem]),
   example === wealthAgainstSeal ? [['hour', '戊']] : []);
  if (placement === '运支本气') {
   assert.ok(formatFortuneFactAudit(modelContext(run).input).includes('运支本气癸（偏印）克本命月柱丙申'));
  }
  if (placement === '运支其他藏干') {
   assert.equal(layout.sameKillerInLuck[0].exposed.stem, '辛');
   assert.ok(data.killCombinationRoutes.includes('hurt-killer-reexposed'));
   assert.ok(!data.killCombinationRoutes.includes('robbery-killer-reexposed'));
   assert.equal(match(run, 105).status, 'not_matched');
  }
 }
 const wrongMonth = calendarStemOrder(hurtingWithoutMonthOfficer);
 assert.ok(wrongMonth.data.natalPresentTenGods.includes('正官') && wrongMonth.data.hasMovingAttackOnKillCombiner);
 assert.equal(wrongMonth.data.officerKillLuck, undefined);
 assert.equal(match(wrongMonth.run, 106).status, 'not_matched');
});

test('p064 confirms a direct owl-to-hurting stem only after the real Gui arrival and without exposed wealth opposing it', () => {
 const base = { ...ref.calendarExamples[106], year: 2049, luck: '癸卯' };
 for (const [example, boundary, supported] of [
  [base, '2049-05-24T00:00:00.000Z', true],
  [{ ...base, hour: 6, natal: ['辛酉', '丙申', '乙丑', '己卯'] }, '2049-07-23T12:00:00.000Z', false],
 ]) {
  const { run, fact, data } = calendarStemOrder(example);
  const before = rows(run).find(row => row.activeTo === boundary);
  assert.equal(fact.activeFrom, boundary);
  assert.equal(before.normalizedPayload.luckPillar, '壬寅');
  assert.equal(before.normalizedPayload.directOwlAgainstHurt, false);
  const [target] = data.officerKillLuck.luckSealAgainstCombiner;
  assert.deepEqual([target.seal.stem, target.pair.combiner.position, target.pair.combiner.stem, target.pair.kill.position, target.pair.kill.stem],
   ['癸', 'month', '丙', 'year', '辛']);
  assert.deepEqual(target.nativeWealth.map(row => [row.position, row.stem]), supported ? [] : [['hour', '己']]);
  assert.equal(data.directOwlAgainstHurt, supported);
  const hit = match(run, 106);
  assert.equal(hit.status, supported ? 'matched' : 'partial');
  assert.equal(hit.matchedSourceExcerpt, supported ? '梟印剋' : undefined);
  assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: fact.activeTo }]);
  const prompt = formatFortunePrompt(modelContext(run).input);
  assert.equal(/实际运干为偏印并克到同一个伤官/u.test(prompt), supported);
  assert.doesNotMatch(prompt, /梟印剋去傷官|directOwlAgainstHurt/u);
 }
});

test('an exposed luck stem feeding the secondary owl supplies the same native hurting-officer candidate', () => {
 const example = { date: [1980, 8, 8], hour: 14, gender: 1, year: 2030, luck: '己丑', natal: ['庚申', '甲申', '癸丑', '己未'] };
 const { run, fact, data } = calendarStemOrder(example);
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '己丑');
 const before = rows(run).find(row => row.activeTo === transition.exactInstant);
 assert.equal(before.normalizedPayload.luckPillar, '戊子');
 assert.equal(fact.activeFrom, transition.exactInstant);
 assert.deepEqual(before.normalizedPayload.officerKillLuck.supportedSecondaryOwls, []);
 assert.deepEqual(data.officerKillLuck.supportedSecondaryOwls.map(({ seal, pair }) => [seal.stem, seal.placement, pair.combiner.stem, pair.kill.stem]),
  [['辛', '运支其他藏干', '甲', '己']]);
 assert.ok(!data.killCombinationRoutes.includes('owl-controls-hurting-combiner'));
 const hit = match(run, 106);
 assert.equal(hit.status, 'partial');
 assert.ok(hit.sourceFactIds.includes(fact.factId));
 assert.ok(!hit.sourceFactIds.includes(before.factId));
 const bare = context(native(example.natal), '丁丑');
 assert.ok(bare.officerKillLuck.luckSealAgainstCombiner.some(row => row.seal.stem === '辛' && row.seal.placement === '运支其他藏干'));
 assert.deepEqual(bare.officerKillLuck.supportedSecondaryOwls, []);
 const { input } = modelContext(run);
 assert.ok(formatFortuneFactAudit(input).includes('本步运干己生本柱余藏偏印辛'));
 assert.ok(!formatFortunePrompt(input).includes('本步运干己生本柱余藏偏印辛'));
});

test('p064 confirms a moving main-qi owl with its real natal meeting and demotes it after the annual clash', () => {
 const base = { ...ref.calendarExamples[106], year: 2019, luck: '庚子' };
 const actual = calendarStemOrder(base);
 const boundary = actual.run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '庚子');
 assert.ok(boundary);
 const before = rows(actual.run).find(row => row.activeTo === boundary.exactInstant);
 assert.equal(actual.fact.activeFrom, boundary.exactInstant);
 assert.equal(before.normalizedPayload.luckPillar, '己亥');
 assert.equal(before.normalizedPayload.branchOwlMeetingAgainstHurt, false);
 const { seal, pair, meeting } = actual.data.officerKillLuck.branchOwlMeeting;
 assert.deepEqual([seal.pillar, seal.stem, seal.tenGod, seal.placement], ['庚子', '癸', '偏印', '运支本气']);
 assert.deepEqual([pair.combiner.pillar, pair.kill.pillar], ['丙申', '辛酉']);
 assert.deepEqual([meeting.branches, meeting.center, meeting.moving.pillar], ['申子辰', '子', '庚子']);
 assert.deepEqual(meeting.natalMembers.map(row => [row.position, row.pillar]), [['month', '丙申']]);
 assert.deepEqual(meeting.clashes, []);
 assert.equal(actual.data.branchOwlMeetingAgainstHurt, true);
 const entered = match(actual.run, 106);
 assert.equal(entered.matchedSourceExcerpt, '梟印剋');
 assert.deepEqual(entered.windows, [{ start: boundary.exactInstant, endExclusive: actual.fact.activeTo }]);
 const { input } = modelContext(actual.run);
 const local = /实际运支本气偏印癸与本命组成带中神的两支会[^\n]*丙申[^\n]*庚子/u;
 assert.match(formatFortuneFactAudit(input), local);
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /实际运支本气为偏印，与本命支合见有中神的同组两支/u);
 assert.doesNotMatch(prompt, /破合煞之局|branchOwlMeetingAgainstHurt/u);
 assert.doesNotMatch(prompt, local);

 const opposed = calendarStemOrder({ ...base, year: 2026 });
 const summer = Date.UTC(2026, 5, 1);
 const clashed = rows(opposed.run).find(row => Date.parse(row.activeFrom) <= summer && summer < Date.parse(row.activeTo));
 assert.ok(clashed);
 assert.equal(clashed.normalizedPayload.luckPillar, '庚子');
 assert.equal(clashed.activeFrom, '2026-02-03T20:02:08.000Z');
 assert.equal(clashed.normalizedPayload.branchOwlMeetingAgainstHurt, false);
 assert.deepEqual(clashed.normalizedPayload.officerKillLuck.branchOwlMeeting.meeting.clashes.map(row =>
  row.members.map(member => [member.position, member.pillar])), [[['decadal', '庚子'], ['annual', '丙午']]]);
 const isolated = { ...opposed.run, facts: [clashed] };
 assert.equal(match(isolated, 106).status, 'partial');
 assert.deepEqual(match(opposed.run, 106).windows, [{ start: opposed.fact.activeFrom, endExclusive: clashed.activeFrom }]);
 assert.deepEqual(match(opposed.run, 106).candidateWindows, [{ start: clashed.activeFrom, endExclusive: clashed.activeTo }]);
 assert.doesNotMatch(formatFortunePrompt(modelContext(isolated).input), /实际运支本气为偏印|原文：梟印剋/u);
 const natalOnly = baziZpqzStemOrder(native(['辛酉', '丙申', '乙丑', '甲子']), true, '庚子', '辛丑');
 assert.equal(natalOnly.officerKillLuck.luckSealAgainstCombiner[0].seal.placement, '运支本气');
 assert.equal(natalOnly.branchOwlMeetingAgainstHurt, false);
 const annualOnly = baziZpqzStemOrder(native(base.natal), true, '己亥', '庚子');
 assert.equal(annualOnly.branchOwlMeetingAgainstHurt, false);
 const noYear = context(native(base.natal), '庚子');
 assert.equal(noYear.branchOwlMeetingAgainstHurt, undefined);
});

test('ten real calendars keep their own verified stem evidence and exclude the direct-seal comparison from the owl rule',()=>{
 for(const key of Object.keys(ref.calendarExamples)){
  const i=Number(key),e=ref.calendarExamples[i],run=real(i);validateFortuneFacts(run);assert.notEqual(run.methods.bazi.status,'failed');
  assert.deepEqual(layers.map(key=>archive(e).bazi.rawResult[0][key]),e.natal);assert.ok(rows(run).some(f=>f.normalizedPayload.luckPillar===e.luck&&f.normalizedPayload.confirmed));
  assert.equal(match(run,i).status,[106,112,113].includes(i)?'not_matched':completeSourceIndices.has(i)?'matched':'partial',key);
 }
 const p=rows(real(112)).find(r=>r.normalizedPayload.luckPillar==='壬辰').normalizedPayload;
 assert.equal(p.printedCases.find(c=>c.id==='zeng-wealth-seal').matches,true);assert.ok(!p.natalExposedStems.includes('丙'));
});

test('p014 ties both printed month-seal examples to the actual native officer targeted in luck', () => {
 const jiaExample = { ...ref.calendarExamples[56], year: 2087 };
 const bingExample = { date: [1982, 3, 14], hour: 8, gender: 1, year: 2029, luck: '戊申', natal: ['壬戌', '癸卯', '丙申', '壬辰'] };
 for (const [example, code, officer, natalPosition, hiddenSeal, phrase, boundary, previousLuck] of [
  [jiaExample, 'jia-zi-bing', '辛', 'hour', '癸', '甲日子月的运丙合辛官例', '2087-04-01T10:00:00.000Z', '丁卯'],
  [bingExample, 'bing-mao-wu', '癸', 'month', '乙', '丙日卯月的运戊合癸官例', '2029-07-28T08:00:00.000Z', '丁未'],
 ]) {
  const { run, fact, data } = calendarStemOrder(example);
  const hit = match(run, 56);
  const confirmed = code === 'bing-mao-wu';
  assert.equal(hit.status, confirmed ? 'matched' : 'partial');
  assert.equal(data.sealOfficerPrimaryExample, confirmed ? code : undefined);
  assert.equal(hit.matchedSourceExcerpt, confirmed ? '運合官者' : undefined);
  assert.equal(hit.windows[0].start, boundary);
  assert.equal(fact.activeFrom, boundary);
  const prior = rows(run).find(row => row.normalizedPayload.luckPillar === previousLuck && row.activeTo === boundary);
  assert.ok(prior);
  assert.deepEqual(prior.normalizedPayload.sealOfficerJoinMonthRoutes, []);
  assert.ok(!hit.sourceFactIds.includes(prior.factId));
  const [join] = data.sealOfficerJoins;
  assert.equal(join.example, code);
  assert.deepEqual(data.sealOfficerJoinMonthRoutes, ['primary-seal']);
  assert.deepEqual([join.officer.stem, join.officer.position, join.officer.tenGod], [officer, natalPosition, '正官']);
  assert.deepEqual(join.monthSeals.map(row => [row.position, row.stem, row.tenGod]), [['month', hiddenSeal, '正印']]);
  assert.deepEqual(join.monthSeals.map(row => [row.hiddenOrder, row.mainQi, row.element, row.supportLevel]),
   [[1, true, hiddenSeal === '癸' ? '水' : '木', 'primary-seal']]);
  assert.deepEqual([join.monthPrimary.stem, join.monthPrimary.tenGod], [hiddenSeal, '正印']);
  assert.equal(join.woodMeeting, undefined);
  const audit = formatFortuneFactAudit(modelContext(run).input);
  assert.ok(audit.includes(phrase));
  assert.ok(audit.includes('月令' + hiddenSeal + '正印为本气'));
  if (confirmed) assert.match(formatFortunePrompt(modelContext(run).input), /实际运干戊五合到这处癸/u);
  if (code === 'jia-zi-bing') {
   const unclassified = structuredClone(run);
   rows(unclassified).forEach(row => { delete row.normalizedPayload.sealOfficerJoinMonthRoutes; });
   assert.equal(match(unclassified, 56).status, 'unknown');
  }
 }
 const annual = submittedCalendar(bingExample, 2028);
 assert.ok(annual.facts.some(fact => fact.factType === 'zpqz_moving_relations' && fact.normalizedPayload.annualStem === '戊'));
 assert.equal(match(annual, 56).status, 'not_matched');
 const unknownHour = context(native(jiaExample.natal), '丙寅', false);
 assert.deepEqual(unknownHour.sealOfficerJoins, []);
 assert.equal(unknownHour.sealOfficerJoinMonthRoutes, undefined);
});

test('p014 confirms the printed Jia example only after the real unmixed Bing arrival', () => {
 const example = { date: [1970, 12, 10], hour: 14, gender: 0, year: 1981, luck: '丙戌', natal: ['庚戌', '戊子', '甲子', '辛未'] };
 const { run, fact, data } = calendarStemOrder(example);
 const boundary = '1981-11-06T04:00:00.000Z';
 assert.equal(fact.activeFrom, boundary);
 assert.equal(data.sealOfficerPrimaryExample, 'jia-zi-bing');
 assert.deepEqual(data.movingFivePairs.map(row => [row.target.position, row.target.stem, row.nativeSameAsMoving.length]), [['hour', '辛', 0]]);
 const before = rows(run).find(row => row.activeTo === boundary);
 assert.equal(before.normalizedPayload.luckPillar, '丁亥');
 assert.equal(before.normalizedPayload.sealOfficerPrimaryExample, undefined);
 const hit = match(run, 56);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '運合官者');
 assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: fact.activeTo }]);
 const prompt = formatFortunePrompt(modelContext(run).input);
 assert.match(prompt, /实际运干丙五合到这处辛.*是否有效合去须另核/u);
 assert.doesNotMatch(prompt, /合去官星，為破格也|sealOfficerPrimaryExample/u);
});

test('p014 excludes the retained Geng officer only in the real Yi luck with the natal month Yi', () => {
 const example = { date: [1904, 11, 17], hour: 8, gender: 0, year: 1997, luck: '乙丑', natal: ['甲辰', '乙亥', '乙卯', '庚辰'] };
 const { run, fact, data } = calendarStemOrder(example);
 const boundary = '1997-12-06T16:00:00.000Z';
 assert.equal(fact.activeFrom, boundary);
 const prior = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '丙寅');
 assert.ok(prior);
 assert.equal(prior.normalizedPayload.sealOfficerSourceRetained, false);
 assert.equal(data.sealOfficerSourceRetained, true);
 const [join] = data.sealOfficerJoins;
 assert.deepEqual([join.officer.position, join.officer.stem, join.officer.tenGod], ['hour', '庚', '正官']);
 assert.deepEqual(join.monthSeals.map(row => [row.position, row.stem, row.mainQi]), [['month', '壬', true]]);
 assert.deepEqual(data.movingFivePairs[0].natalOtherFiveContacts.map(row => row.position), ['month', 'day']);
 assert.equal(match(run, 56).status, 'excluded');
 const { input } = modelContext(run);
 assert.match(formatFortuneFactAudit(input), /原评另说月乙相合时庚官仍在/u);
 assert.doesNotMatch(formatFortunePrompt(input), /庚官仍在|sealOfficerSourceRetained/u);

 const previousSubmission = structuredClone(run);
 rows(previousSubmission).forEach(row => { delete row.normalizedPayload.sealOfficerSourceRetained; });
 assert.equal(match(previousSubmission, 56).status, 'unknown');
 const missingHour = baziZpqzStemOrder(native(example.natal), false, '乙丑');
 assert.equal(missingHour.sealOfficerSourceRetained, undefined);
 const noOfficer = baziZpqzStemOrder(native([...example.natal.slice(0, 3), '己卯']), true, '乙丑');
 assert.equal(noOfficer.sealOfficerSourceRetained, false);
});

test('p014 keeps the printed single pair and distinguishes absence of roots from an actual hidden root', () => {
 const jia = { date: [1907, 12, 11], hour: 14, gender: 0, year: 1946, luck: '丙辰',
  natal: ['丁未', '壬子', '甲午', '辛未'] };
 const bing = { date: [1903, 3, 19], hour: 4, gender: 0, year: 1929, luck: '戊午',
  natal: ['癸卯', '乙卯', '丙午', '庚寅'] };
 const noRootText = /在本命四支和实际运支均未见同五行藏气，原局也未另透官杀/u;
 for (const [example, code, officer, beforeLuck, boundary] of [
  [jia, 'jia-zi-bing', '辛', '乙卯', '1946-10-06T08:00:00.000Z'],
  [bing, 'bing-mao-wu', '癸', '丁巳', '1929-04-04T22:00:00.000Z'],
 ]) {
  const { run, fact, data } = calendarStemOrder(example);
  const hit = match(run, 56);
  assert.equal(fact.activeFrom, boundary);
  assert.equal(data.sealOfficerPrimaryExample, code);
  assert.equal(data.sealOfficerNoRootExample, code);
  const [join] = data.sealOfficerJoins;
  assert.equal(join.officer.stem, officer);
  assert.deepEqual(join.officerRoots, []);
  assert.deepEqual(join.otherExposedAuthorities, []);
  const before = rows(run).find(row => row.activeTo === boundary);
  assert.equal(before.normalizedPayload.luckPillar, beforeLuck);
  assert.equal(before.normalizedPayload.sealOfficerNoRootExample, undefined);
  assert.ok(!hit.sourceFactIds.includes(before.factId));
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '運合官者');
  assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: fact.activeTo }]);
  const prompt = formatFortunePrompt(modelContext(run).input);
  assert.match(prompt, noRootText);
  assert.doesNotMatch(prompt, /合去官星，為破格也|sealOfficerNoRootExample/u);
 }
 const rooted = calendarStemOrder({ ...bing, hour: 2, natal: [...bing.natal.slice(0, 3), '己丑'] });
 assert.equal(rooted.fact.activeFrom, '1929-04-14T20:00:00.000Z');
 assert.equal(rooted.data.sealOfficerPrimaryExample, 'bing-mao-wu');
 assert.equal(rooted.data.sealOfficerNoRootExample, undefined);
 const [join] = rooted.data.sealOfficerJoins;
 assert.deepEqual(join.otherExposedAuthorities, []);
 assert.deepEqual(join.officerRoots.map(root => [root.position, root.pillar, root.stem, root.exactStem, root.hiddenOrder]),
  [['hour', '己丑', '癸', true, 2]]);
 const hit = match(rooted.run, 56);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '運合官者');
 assert.doesNotMatch(formatFortunePrompt(modelContext(rooted.run).input), noRootText);
 const missingHour = context(native(bing.natal), bing.luck, false);
 assert.equal(missingHour.sealOfficerNoRootExample, undefined);
});

test('p014 verifies a unique unrooted officer pair beyond the two printed examples on the real Ren stage', () => {
 const base = { date: [1970, 1, 20], hour: 8, gender: 1, year: 2014, luck: '壬申', natal: ['己酉', '丁丑', '庚子', '庚辰'] };
 const { run, fact, data } = calendarStemOrder(base);
 const boundary = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '壬申');
 assert.ok(boundary);
 const before = rows(run).find(row => row.activeTo === boundary.exactInstant);
 assert.ok(before);
 assert.equal(fact.activeFrom, boundary.exactInstant);
 assert.equal(before.normalizedPayload.sealOfficerSourceUnrootedJoin, false);
 assert.equal(data.sealOfficerSourceUnrootedJoin, true);
 assert.equal(data.sealOfficerPrimaryExample, undefined);
 assert.equal(data.sealOfficerNoRootExample, undefined);
 const [join] = data.sealOfficerJoins;
 assert.deepEqual([join.moving.pillar, join.officer.position, join.officer.stem, join.monthSeals[0].stem], ['壬申', 'month', '丁', '己']);
 assert.equal(join.monthSeals[0].mainQi, true);
 assert.deepEqual(join.officerRoots, []);
 assert.deepEqual(join.otherExposedAuthorities, []);
 const hit = match(run, 56);
 assert.equal(hit.matchedSourceExcerpt, '運合官者');
 assert.deepEqual(hit.windows, [{ start: boundary.exactInstant, endExclusive: fact.activeTo }]);
 const staticCondition = /实际运干与该官独合/u;
 const { input } = modelContext(run);
 const local = /明透正官与实际运干独合，本命四支和本步运支未见该正官的同五行藏根/u;
 assert.match(formatFortuneFactAudit(input), local);
 assert.match(formatFortunePrompt(input), staticCondition);
 assert.doesNotMatch(formatFortunePrompt(input), /合去官星，為破格也|sealOfficerSourceUnrootedJoin/u);
 assert.doesNotMatch(formatFortunePrompt(input), local);

 const near = calendarStemOrder({ ...base, year: 2016, hour: 12, natal: ['己酉', '丁丑', '庚子', '壬午'] });
 assert.equal(near.data.sealOfficerSourceUnrootedJoin, false);
 assert.deepEqual(near.data.movingFivePairs[0].natalOtherFiveContacts.map(row => row.pillar), ['壬午']);
 assert.deepEqual(near.data.sealOfficerJoins[0].officerRoots.map(row => [row.pillar, row.stem]), [['壬午', '丁']]);
 assert.equal(match(near.run, 56).status, 'partial');
 assert.doesNotMatch(formatFortunePrompt(modelContext(near.run).input), staticCondition);
 assert.equal(context(native(base.natal), '壬申', false).sealOfficerSourceUnrootedJoin, undefined);
});

test('p014 verifies the sole exposed mixed-month seal only before an actual competing month meeting', () => {
 const example = { date: [1986, 7, 21], hour: 10, gender: 1, year: 2012, luck: '戊戌',
  natal: ['丙寅', '乙未', '丙寅', '癸巳'] };
 const { run, fact, data } = calendarStemOrder(example);
 const boundary = '2012-06-18T20:00:00.000Z';
 assert.equal(fact.activeFrom, boundary);
 const prior = rows(run).find(row => row.activeTo === boundary);
 assert.equal(prior.normalizedPayload.luckPillar, '丁酉');
 assert.equal(prior.normalizedPayload.sealOfficerSingleResidualJoin, false);
 const { seal, officer, moving, monthPairs, monthGroups } = data.sealOfficerSingleResidual;
 assert.deepEqual([seal.position, seal.stem, seal.hiddenOrder, seal.supportLevel, officer.position,
  officer.pillar, moving.pillar], ['month', '乙', 3, 'residual-seal-exposed', 'hour', '癸巳', '戊戌']);
 assert.deepEqual(seal.exposedSeats.map(row => row.pillar), ['乙未']);
 assert.deepEqual([monthPairs, monthGroups], [[], []]);
 assert.equal(data.sealOfficerSingleResidualJoin, true);
 const hit = match(run, 56);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '運合官者');
 assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: fact.activeTo }]);
 assert.deepEqual(hit.sourceFactIds, [fact.factId]);

 const later = submittedCalendar(example, 2014), laterHit = match(later, 56);
 const [before, after] = rows(later);
 assert.equal(before.normalizedPayload.sealOfficerSingleResidualJoin, true);
 assert.equal(after.normalizedPayload.sealOfficerSingleResidualJoin, false);
 assert.equal(after.activeFrom, '2014-02-03T22:03:16.000Z');
 assert.deepEqual(after.normalizedPayload.sealOfficerSingleResidual.monthGroups,
  [{ kind: '三会', values: '巳午未', byBranch: [['hour'], ['annual'], ['month']] }]);
 assert.deepEqual(laterHit.windows, [{ start: before.activeFrom, endExclusive: after.activeFrom }]);
 assert.deepEqual(laterHit.candidateWindows, [{ start: after.activeFrom, endExclusive: after.activeTo }]);
 assert.deepEqual(laterHit.sourceFactIds, [before.factId]);
 const prompt = formatFortunePrompt(modelContext(run).input);
 assert.match(prompt, /辰戌丑未月只透一类月支藏干/u);
 assert.doesNotMatch(prompt, /合去官星，為破格也|sealOfficerSingleResidual/u);
 assert.equal(context(native(example.natal), '戊戌', false).sealOfficerSingleResidualJoin, undefined);
});

test('p014 distinguishes a residual month seal exposure, the month primary officer and the natal wood formation', () => {
 const base = { date: [1972, 11, 12], gender: 0, year: 2006, luck: '丁未' };
 for (const [hour, hourPillar, exposed, mao] of [[8, '甲辰', true, []], [18, '己酉', false, []], [6, '癸卯', false, ['hour']]]) {
  const { run, data } = calendarStemOrder({ ...base, hour, natal: ['壬子', '辛亥', '丁未', hourPillar] });
  const [join] = data.sealOfficerJoins;
  assert.equal(data.hasSealOfficerJoin, true);
  assert.deepEqual(data.sealOfficerJoinMonthRoutes, [exposed ? 'residual-seal-exposed' : 'residual-seal-only']);
  assert.equal(join.monthSeals[0].supportLevel, data.sealOfficerJoinMonthRoutes[0]);
  assert.equal(match(run, 56).status, 'partial');
  assert.deepEqual([join.officer.position, join.officer.stem, join.moving.stem], ['year', '壬', '丁']);
  assert.deepEqual([join.monthPrimary.stem, join.monthPrimary.tenGod, join.monthPrimary.exposedSeats.map(row => row.position)],
   ['壬', '正官', ['year']]);
  assert.deepEqual(join.monthSeals.map(row => [row.stem, row.element, row.hiddenOrder, row.mainQi, row.exposedSeats.map(seat => seat.position)]),
   [['甲', '木', 2, false, exposed ? ['hour'] : []]]);
  assert.deepEqual(join.woodMeeting.map(row => [row.branch, row.positions.map(seat => seat.position)]),
   [['亥', ['month']], ['卯', mao], ['未', ['day']]]);
  const audit = formatFortuneFactAudit(modelContext(run).input);
  assert.match(audit, /月令本气壬正官明透于本命年柱壬子/u);
  assert.ok(audit.includes('月令甲正印为第2藏，' + (exposed ? '同干透在' : '原局其他柱未见同干明透')));
  assert.match(audit, mao.length ? /卯在本命时柱癸卯/u : /卯未见/u);
 }
});

test('p021 binds the changing Gui seal to year Wu and month Xin while retaining distinct water-root roles', () => {
 const example = ref.calendarExamples[63];
 const { run, data } = calendarStemOrder({ ...example, year: 2061 });
 const transition = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '癸丑');
 assert.ok(transition);
 const hit = match(run, 63);
 assert.equal(hit.status, 'partial');
 assert.equal(hit.windows[0].start, transition.exactInstant);
 const { wealth, officer, seal, waterRoots, nativeExposedGui } = data.guiWithYearWu;
 assert.deepEqual([wealth.position, wealth.stem, officer.position, officer.stem, seal.position, seal.stem], ['year', '戊', 'month', '辛', 'decadal', '癸']);
 assert.deepEqual(waterRoots.map(root => [root.position, root.stem, root.role, root.exactStem]), [
  ['year', '癸', '水库', true], ['decadal', '癸', '水余气', true],
 ]);
 assert.deepEqual(nativeExposedGui.map(row => [row.position, row.stem]), [['hour', '癸']]);
 assert.equal(data.guiOwnLuckWaterRoot, 'exact-stem');
 assert.ok(data.guiRootsOnlyStorageOrResidual);
 assert.deepEqual(data.guiWaterRootClashes.map(pair => pair.map(row => row.position)), [['year', 'day']]);
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.match(prompt, /年戊、月辛和运癸按同一步大运核对/u);
 assert.match(prompt, /本命年柱戊辰支藏癸，为水库位置/u);
 assert.match(prompt, /本步大运癸丑支藏癸，为水余气位置/u);
 assert.match(prompt, /只见水库或余气/u);
 assert.doesNotMatch(prompt, /guiWithYearWu|guiWaterRootClashes/u);

 const withHai = calendarStemOrder({ ...example, hour: 22, natal: ['戊辰', '辛酉', '甲戌', '乙亥'] });
 assert.equal(match(withHai.run, 63).status, 'partial');
 assert.equal(withHai.data.guiRootsOnlyStorageOrResidual, false);
 assert.equal(withHai.data.guiOwnLuckWaterRoot, 'exact-stem');
 assert.ok(withHai.data.guiWithYearWu.waterRoots.some(row => row.position === 'hour' && row.stem === '壬' && !row.exactStem));
 assert.match(formatFortuneFactAudit(modelContext(withHai.run).input), /本命时柱乙亥支藏壬，为本气位置，对运癸为同水异干藏位/u);
 const annual = submittedCalendar(example, 2053);
 assert.ok(annual.facts.some(fact => fact.factType === 'zpqz_moving_relations' && fact.normalizedPayload.annualStem === '癸'));
 assert.equal(match(annual, 63).status, 'not_matched');
 const forward = calendarStemOrder({ ...example, gender: 1, year: 2005, luck: '癸亥' });
 assert.equal(match(forward.run, 63).status, 'partial');
 assert.equal(forward.data.guiOwnLuckWaterRoot, 'same-element');
 assert.ok(forward.data.guiWithYearWu.waterRoots.some(root => root.position === 'decadal' && root.stem === '壬' && !root.exactStem));
 const dryPillar = context(native(example.natal), '癸卯');
 assert.equal(dryPillar.guiOwnLuckWaterRoot, 'absent');
 assert.ok(dryPillar.guiWithYearWu.waterRoots.some(root => root.position === 'year' && root.stem === '癸'));
});

test('p021 reaches two separately clashed light roots only after the actual Gui-Chou handoff', () => {
 const example = ref.calendarExamples[63];
 const comparison = [
  [14, '辛未', [['year', 'day'], ['hour', 'decadal']], 'matched'],
  [12, '庚午', [['year', 'day']], 'partial'],
 ];
 for (const [hour, natalHour, clashes, status] of comparison) {
  const e = { ...example, hour, year: 2061, natal: [...example.natal.slice(0, 3), natalHour] };
  const { run, fact, data } = calendarStemOrder(e);
  const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸丑');
  assert.ok(transition);
  assert.equal(fact.activeFrom, transition.exactInstant);
  const preceding = rows(run).find(row => row.activeTo === fact.activeFrom && row.normalizedPayload.luckPillar === '甲寅');
  assert.ok(preceding);
  assert.equal(preceding.normalizedPayload.guiAllLightRootsClashed, undefined);
  assert.deepEqual(data.guiWithYearWu.waterRoots.map(({ position, role }) => [position, role]), [['year', '水库'], ['decadal', '水余气']]);
  assert.deepEqual(data.guiWaterRootClashes.map(pair => pair.map(row => row.position)), clashes);
  assert.equal(data.guiAllLightRootsClashed, status === 'matched');
  assert.equal(data.guiUnopposedLightRoots, false);
  const hit = match(run, 63);
  assert.equal(hit.status, status);
  assert.ok(!hit.sourceFactIds.includes(preceding.factId));
  assert.equal(hit.windows[0].start, transition.exactInstant);
  const message = formatFortunePrompt(modelContext(run).input);
  if (status === 'matched') {
   assert.equal(hit.matchedSourceExcerpt, '戊癸合');
   assert.match(message, /年辰库及运丑余气所藏的同干癸，分别由日戌与时未六冲/u);
   assert.doesNotMatch(message, /未见两处根位受冲|反傷官星也|guiAllLightRootsClashed/u);
  } else {
   assert.doesNotMatch(message, /原文：戊癸合/u);
  }
 }
 assert.equal(context(native(['戊辰', '辛酉', '甲戌', '辛未']), '癸丑', false).guiAllLightRootsClashed, undefined);
});

test('p021 confirms the Wu-Gui join with unopposed light roots at the real Gui-Chou handoff', () => {
 const e = { date: [1928, 9, 11], hour: 4, gender: 0, year: 1999, luck: '癸丑', natal: ['戊辰', '辛酉', '甲寅', '丙寅'] };
 const { run, fact, data } = calendarStemOrder(e);
 const changeAt = '1999-08-30T18:00:00.000Z';
 assert.equal(fact.activeFrom, changeAt);
 assert.ok(rows(run).some(row => row.activeTo === changeAt && row.normalizedPayload.luckPillar === '甲寅'
  && row.normalizedPayload.guiUnopposedLightRoots === undefined));
 assert.equal(data.guiUnopposedLightRoots, true);
 assert.deepEqual(data.guiWithYearWu.waterRoots.map(root => [root.position, root.role]), [['year', '水库'], ['decadal', '水余气']]);
 const hit = match(run, 63);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '戊癸合');
 assert.deepEqual(hit.windows, [{ start: changeAt, endExclusive: fact.activeTo }]);
 const prompt = formatFortunePrompt(modelContext(run).input);
 assert.match(prompt, /所见水根仅年辰库与运丑余气/u);
 assert.doesNotMatch(prompt, /反傷官星也|guiUnopposedLightRoots/u);

 const extra = calendarStemOrder({ ...e, hour: 8, natal: [...e.natal.slice(0, 3), '戊辰'] });
 assert.equal(extra.data.guiUnopposedLightRoots, false);
 assert.deepEqual(extra.data.movingFivePairs.map(row => row.target.position), ['year', 'hour']);
 assert.equal(match(extra.run, 63).status, 'partial');
 assert.doesNotMatch(formatFortunePrompt(modelContext(extra.run).input), /所见水根仅年辰库与运丑余气/u);
 assert.equal(context(native(e.natal), '癸丑', false).guiUnopposedLightRoots, undefined);
});

test('p021 records an actual Gui Lu branch and the exact relations on that root without resolving floating strength', () => {
 const example = { date: [1928, 9, 11], hour: 0, gender: 0, year: 2000, luck: '癸丑', natal: ['戊辰', '辛酉', '甲寅', '甲子'] };
 const { run, fact, data } = calendarStemOrder(example);
 const [witness] = data.guiZiLuRoots;
 assert.deepEqual([witness.root.position, witness.root.pillar, witness.root.stem, witness.root.tenGod, witness.root.element],
  ['hour', '甲子', '癸', '正印', '水']);
 assert.deepEqual(witness.relations.map(row => [row.kind, row.members]), [['六破', ['month', 'hour']], ['六合', ['hour', 'decadal']]]);
 const hit = match(run, 63);
 assert.equal(hit.status, 'partial');
 assert.ok(hit.sourceFactIds.includes(fact.factId));
 const near = calendarStemOrder({ ...example, hour: 12, natal: [...example.natal.slice(0, 3), '庚午'] });
 assert.deepEqual(near.data.guiZiLuRoots, []);
 assert.equal(data.guiUnopposedLightRoots, false);
 assert.equal(near.data.guiUnopposedLightRoots, true);
 const nearHit = match(near.run, 63);
 assert.equal(nearHit.status, 'matched');
 assert.equal(nearHit.matchedSourceExcerpt, '戊癸合');
 const { input } = modelContext(run);
 assert.ok(formatFortuneFactAudit(input).includes('癸禄在本命时柱甲子的支本气癸'));
 assert.ok(!formatFortunePrompt(input).includes('癸禄在本命时柱甲子'));
});

test('p021 excludes a real complete northern water formation while preserving the adjacent charts and the unknown state', () => {
 const example = { date: [1928, 9, 21], hour: 22, gender: 0, year: 2003, luck: '癸丑', natal: ['戊辰', '辛酉', '甲子', '乙亥'] };
 const { run, fact, data } = calendarStemOrder(example);
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸丑');
 assert.equal(transition?.exactInstant, '2003-04-10T12:00:00.000Z');
 assert.equal(fact.activeFrom, transition.exactInstant);
 assert.ok(rows(run).some(row => row.activeTo === transition.exactInstant && row.normalizedPayload.luckPillar === '甲寅'
  && row.normalizedPayload.guiNorthernWaterAssembly === undefined));
 assert.equal(data.hasGuiWithYearWu, true);
 assert.equal(data.hasGuiNorthernWaterAssembly, true);
 assert.deepEqual(data.guiNorthernWaterAssembly.map(({ position, pillar, stem, role }) => [position, pillar, stem, role]), [
  ['hour', '乙亥', '壬', '本气'], ['day', '甲子', '癸', '本气'], ['decadal', '癸丑', '癸', '水余气'],
 ]);
 assert.equal(match(run, 63).status, 'not_matched');
 assert.deepEqual(match(run, 63).windows, []);
 const { input } = modelContext(run);
 const audit = formatFortuneFactAudit(input);
 assert.match(audit, /同一实际运段亥子丑三方成员齐见.*浮水候选排除/u);
 assert.doesNotMatch(formatFortunePrompt(input), /亥子丑三方成员齐见/u);

 const changedHour = calendarStemOrder({ ...example, hour: 12, natal: [...example.natal.slice(0, 3), '庚午'] });
 assert.equal(changedHour.data.hasGuiNorthernWaterAssembly, false);
 assert.ok(changedHour.data.guiWaterRootClashes.some(pair => pair.some(row => row.pillar === '庚午')));
 assert.equal(match(changedHour.run, 63).status, 'partial');
 assert.ok(match(changedHour.run, 63).sourceFactIds.includes(changedHour.fact.factId));
 const missingProof = { ...changedHour.fact, normalizedPayload: { ...changedHour.data, hasGuiNorthernWaterAssembly: undefined } };
 const outcome = evaluateFortuneRules('bazi', 'year', [missingProof]).find(row => row.knowledgeId === match(run, 63).knowledgeId);
 assert.equal(outcome.required[0].unknown, true);
 assert.deepEqual(outcome.required[0].hits, []);
});

test('p021 rejects floating Gui when the natal water trine is complete at a confirmed Gui handoff', () => {
 const example = { date: [1988, 9, 26], hour: 0, gender: 1, year: 2002, luck: '癸亥', natal: ['戊辰', '辛酉', '甲申', '甲子'] };
 const { run, fact, data } = calendarStemOrder(example);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸亥');
 assert.equal(change?.exactInstant, '2002-11-13T08:00:00.000Z');
 assert.equal(fact.activeFrom, change.exactInstant);
 assert.ok(rows(run).some(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '壬戌'
  && row.normalizedPayload.guiShenZiChenAssembly === undefined));
 assert.equal(data.hasGuiWithYearWu, true);
 assert.equal(data.hasGuiNorthernWaterAssembly, false);
 assert.equal(data.hasGuiShenZiChenAssembly, true);
 assert.deepEqual(data.guiShenZiChenAssembly.map(({ position, pillar, stem }) => [position, pillar, stem]), [
  ['day', '甲申', '壬'], ['hour', '甲子', '癸'], ['year', '戊辰', '癸'],
 ]);
 assert.ok(data.guiZiLuRoots[0].relations.some(pair => pair.kind === '六破' && pair.members.includes('month')));
 const result = match(run, 63);
 assert.equal(result.status, 'not_matched');
 assert.deepEqual(result.windows, []);
 const near = { ...fact, normalizedPayload: { ...context(native([...example.natal.slice(0, 3), '丙寅']), '癸亥'), confirmed: true } };
 assert.equal(near.normalizedPayload.hasGuiShenZiChenAssembly, false);
 const compared = evaluateFortuneRules('bazi', 'year', [near]).find(row => row.knowledgeId === result.knowledgeId);
 assert.deepEqual(compared.required[0].hits, [near]);
 assert.equal(context(native(example.natal), '癸亥', false).hasGuiShenZiChenAssembly, undefined);
});

test('p029 distinguishes the natal Ding touching the same killer, the incoming Ding and its Bing support comparison', () => {
 const example = ref.calendarExamples[71];
 const run = submittedCalendar(example, 2035), result = match(run, 71);
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '丙午');
 assert.ok(change);
 assert.equal(result.status, 'matched');
 assert.equal(result.windows.at(-1).endExclusive, change.exactInstant);
 const { input } = modelContext(run);
 const facts = input.facts.filter(fact => fact.type === 'zpqz_stem_order');
 const ding = facts.find(fact => fact.data.luckPillar === '丁未' && fact.endExclusive === change.exactInstant);
 const bing = facts.find(fact => fact.data.luckPillar === '丙午' && fact.start === change.exactInstant);
 assert.ok(ding && bing);
 const { monthRen, renCombinations } = ding.data.haiStemComparison;
 assert.deepEqual(monthRen, { pillar: '辛亥', stem: '壬', tenGod: '七杀' });
 assert.equal(renCombinations[0].target.position, 'year');
 assert.deepEqual(renCombinations[0].natalCombinations.map(pair => [pair.second.position, pair.involvesDayMaster]), [['hour', false]]);
 assert.equal(bing.data.haiStemComparison.route, 'bing-companion');
 assert.deepEqual(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId)?.windows, result.windows);
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /运丁实际五合到本命年柱壬申.*合杀候选/u);
 assert.match(prompt, /本步大运丙午.*丙是实际运干.*比肩/u);
 assert.doesNotMatch(prompt, /haiStemComparison|bing-joins-killer/u);

 const annualOnly = submittedCalendar(example, 2017);
 assert.ok(annualOnly.facts.some(fact => fact.factType === 'zpqz_moving_relations' && fact.normalizedPayload.annualStem === '丁'));
 assert.equal(match(annualOnly, 71).status, 'not_matched');
});

test('p030 matches the separate Ding combining the exposed officer and excludes the Bing and hidden-Ren comparisons', async () => {
 const example = ref.calendarExamples[72];
 const { run, fact, data } = calendarStemOrder({ ...example, year: 2032 });
 const [target] = data.haiStemComparison.renCombinations;
 assert.equal(target.target.position, 'year');
 assert.deepEqual(target.natalCombinations.map(pair => [pair.second.position, pair.involvesDayMaster]), [['day', true]]);
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '丙午');
 assert.ok(change);
 const companion = rows(run).find(row => row.normalizedPayload.luckPillar === '丙午' && row.activeFrom === change.exactInstant);
 assert.equal(companion.normalizedPayload.haiStemRoute, 'ding-robbery');
 const result = match(run, 72);
 assert.equal(result.status, 'matched');
 assert.ok(result.sourceFactIds.includes(fact.factId) && !result.sourceFactIds.includes(companion.factId));
 assert.equal(result.windows.at(-1).endExclusive, change.exactInstant);
 const { input } = modelContext(run);
 const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId);
 assert.deepEqual(finding.windows, result.windows);
 assert.match(finding.note, /若[^。]*壬[^。]*官/u);
 assert.match(finding.note, /丙/u);
 assert.match(formatFortuneFactAudit(input), /满足该年柱位置.*运丁实际五合到本命年柱壬申.*合官候选/su);
 let providerChecked = false;
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_url, options) => {
  const content = JSON.parse(options.body).messages[1].content;
  assert.ok(content.includes(finding.note));
  assert.ok(content.includes('丁生亥月，透壬為官'));
  providerChecked = true;
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(input);
 assert.equal(providerChecked, true);

 const hourRen = { date: [1984, 11, 9], hour: 4, gender: 1, year: 2006, luck: '丁丑', natal: ['甲子', '乙亥', '丁未', '壬寅'] };
 const other = calendarStemOrder(hourRen);
 assert.equal(match(other.run, 72).status, 'matched');
 assert.deepEqual(other.data.haiStemComparison.exposedRen.map(row => row.position), ['hour']);
 assert.match(formatFortuneFactAudit(modelContext(other.run).input), /仅在其他出生柱满足徐注的透壬条件/u);

 const hiddenOnly = calendarStemOrder({ ...hourRen, hour: 6, natal: ['甲子', '乙亥', '丁未', '癸卯'] });
 assert.equal(hiddenOnly.data.haiStemComparison, undefined);
 assert.equal(match(hiddenOnly.run, 72).status, 'not_matched');
});

test('p031 binds Gui to the actual Wu that controls natal Ren and keeps later Ren luck as a separate comparison', () => {
 const example = ref.calendarExamples[73];
 const run = submittedCalendar(example, 2072), result = match(run, 73);
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '壬寅');
 assert.ok(change);
 assert.equal(result.status, 'partial');
 assert.equal(result.windows.at(-1).endExclusive, change.exactInstant);
 const { input } = modelContext(run);
 const facts = input.facts.filter(fact => fact.type === 'zpqz_stem_order');
 const gui = facts.find(fact => fact.data.luckPillar === '癸卯' && fact.endExclusive === change.exactInstant);
 const ren = facts.find(fact => fact.data.luckPillar === '壬寅' && fact.start === change.exactInstant);
 assert.ok(gui && ren);
 assert.equal(rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '癸卯')
  .normalizedPayload.hasHaiGuiRootedLink, false);
 assert.deepEqual(gui.data.haiStemComparison.hurtOfficerLinks.map(row => [row.hurt.position, row.officer.position, row.movingCombinesHurt]),
  [['hour', 'year', true]]);
 assert.deepEqual(ren.data.haiStemComparison.hurtOfficerLinks.map(row => [row.hurt.position, row.officer.position, row.movingCombinesHurt]),
  [['hour', 'year', false]]);
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /运干癸五合到上述同一戊伤官/u);
 assert.match(prompt, /壬运干重见正官/u);
 assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== result.knowledgeId)));

 const hiddenWu = calendarStemOrder({ ...ref.calendarExamples[72], year: 2064, luck: '癸卯' });
 assert.equal(hiddenWu.data.haiStemComparison, undefined);
 assert.equal(match(hiddenWu.run, 73).status, 'not_matched');
});

test('p031 confirms the rooted year-hour link only during the verified Gui-Chou stage', () => {
 const example = { date: [1982, 11, 10], hour: 16, gender: 1, year: 2001, luck: '癸丑', natal: ['壬戌', '辛亥', '丁酉', '戊申'] };
 const { run, fact, data } = calendarStemOrder(example);
 const boundary = '2001-11-24T08:00:00.000Z';
 assert.equal(fact.activeFrom, boundary);
 const previous = rows(run).find(row => row.activeTo === boundary);
 assert.equal(previous.normalizedPayload.luckPillar, '壬子');
 assert.equal(previous.normalizedPayload.haiStemRoute, 'ren-repeats-officer-under-hurt');
 assert.equal(previous.normalizedPayload.hasHaiGuiRootedLink, undefined);
 const link = data.haiGuiRootedLink;
 assert.equal(data.hasHaiGuiRootedLink, true);
 assert.deepEqual([link.hurt.position, link.hurt.stem, link.officer.position, link.officer.stem], ['hour', '戊', 'year', '壬']);
 assert.deepEqual(link.natalHurtPartners, []);
 assert.deepEqual(link.fireRoots.map(({ position, pillar, stem, tenGod }) => [position, pillar, stem, tenGod]),
  [['year', '壬戌', '丁', '比肩']]);
 assert.deepEqual(link.fireRootClashes, []);
 const hit = match(run, 73);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '逢癸');
 assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: fact.activeTo }]);
 const prompt = formatFortunePrompt(modelContext(run).input);
 assert.match(prompt, /实际运干癸五合的是同一个戊.*合化和官星能否得救仍须核/u);
 assert.doesNotMatch(prompt, /化傷為劫|haiGuiRootedLink/u);
 assert.equal(context(native(example.natal), '癸丑', false).hasHaiGuiRootedLink, undefined);

 const opposed = calendarStemOrder({ date: [1948, 11, 28], hour: 4, gender: 1, year: 2042, luck: '癸酉',
  natal: ['戊子', '癸亥', '丁巳', '壬寅'] });
 const entry = '2042-01-09T22:00:00.000Z';
 assert.equal(opposed.fact.activeFrom, entry);
 assert.ok(rows(opposed.run).some(row => row.activeTo === entry && row.normalizedPayload.luckPillar === '壬申'));
 assert.equal(opposed.data.haiStemRoute, 'gui-joins-hurting');
 assert.equal(opposed.data.hasHaiGuiRootedLink, false);
 const contested = opposed.data.haiGuiRootedLink;
 assert.deepEqual([contested.hurt.position, contested.officer.position], ['year', 'hour']);
 assert.deepEqual(contested.natalHurtPartners.map(row => [row.position, row.pillar]), [['month', '癸亥']]);
 assert.ok(contested.fireRoots.some(row => row.position === 'day' && row.pillar === '丁巳'));
 const comparison = match(opposed.run, 73);
 assert.equal(comparison.status, 'partial');
 const contestedFacts = rows(opposed.run).filter(row => row.normalizedPayload.luckPillar === '癸酉');
 assert.deepEqual(comparison.sourceFactIds, contestedFacts.map(row => row.factId));
 assert.deepEqual(comparison.windows, [{ start: entry, endExclusive: contestedFacts.at(-1).activeTo }]);
 const { input: opposedInput } = modelContext(opposed.run);
 assert.ok(opposedInput.sections.every(section => section.findings.every(row => row.knowledgeId !== comparison.knowledgeId)));
 assert.match(formatFortuneFactAudit(opposedInput), /原局.*癸亥.*也与同一戊伤官成五合/u);
 assert.doesNotMatch(formatFortunePrompt(opposedInput), /也与同一戊伤官成五合|natalHurtPartners/u);
});

test('p031 retains the exact Gui-Wu pair when the only fire root meets the natal Hai clash', () => {
 const actual = calendarStemOrder({ date: [1972, 11, 22], hour: 16, gender: 1, year: 1987, luck: '癸丑',
  natal: ['壬子', '辛亥', '丁巳', '戊申'] });
 const boundary = actual.run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸丑');
 assert.ok(boundary);
 assert.equal(actual.fact.activeFrom, boundary.exactInstant);
 assert.ok(rows(actual.run).some(row => row.activeTo === boundary.exactInstant && row.normalizedPayload.luckPillar === '壬子'));
 assert.equal(actual.data.haiStemRoute, 'gui-joins-hurting');
 assert.equal(actual.data.hasHaiGuiRootedLink, false);
 const link = actual.data.haiGuiRootedLink;
 assert.deepEqual([link.hurt.position, link.hurt.stem, link.officer.position, link.officer.stem], ['hour', '戊', 'year', '壬']);
 assert.deepEqual(link.natalHurtPartners, []);
 assert.deepEqual(link.fireRoots.map(({ position, pillar, stem }) => [position, pillar, stem]), [['day', '丁巳', '丙']]);
 assert.deepEqual(link.fireRootClashes.map(({ root, opposing }) => [root.position, opposing.position, opposing.pillar]),
  [['day', 'month', '辛亥']]);
 const result = match(actual.run, 73);
 assert.equal(result.status, 'partial');
 assert.equal(result.matchedSourceExcerpt, undefined);
 const stage = rows(actual.run).filter(row => row.normalizedPayload.luckPillar === '癸丑');
 assert.ok(stage.every(row => row.normalizedPayload.hasHaiGuiRootedLink === false));
 assert.deepEqual(result.windows, [{ start: boundary.exactInstant, endExclusive: stage.at(-1).activeTo }]);
 const { input } = modelContext(actual.run);
 const local = /丁巳[^\n]*所藏的丙火，与[^\n]*辛亥[^\n]*实见六冲，火根作用留待核/u;
 assert.match(formatFortuneFactAudit(input), local);
 const provider = formatFortunePrompt(input);
 assert.doesNotMatch(provider, /化傷為劫|原文：逢癸|haiGuiRootedLink/u);
 assert.doesNotMatch(provider, local);

 const withAnotherRoot = calendarStemOrder({ date: [1982, 11, 30], hour: 16, gender: 1, year: 1996, luck: '癸丑',
  natal: ['壬戌', '辛亥', '丁巳', '戊申'] });
 const retained = withAnotherRoot.data.haiGuiRootedLink;
 assert.deepEqual(retained.fireRoots.map(root => root.pillar), ['壬戌', '丁巳']);
 assert.deepEqual([...new Set(retained.fireRootClashes.map(({ root }) => root.pillar))], ['丁巳']);
 assert.equal(withAnotherRoot.data.hasHaiGuiRootedLink, true);
 assert.equal(match(withAnotherRoot.run, 73).matchedSourceExcerpt, '逢癸');
});

test('p031 distinguishes the actual Gui combination from a complete winter-water chart without supporting fire', () => {
 const example = { date: [2032, 11, 27], hour: 16, gender: 1, year: 2045, luck: '癸丑', natal: ['壬子', '辛亥', '丁丑', '戊申'] };
 const { run, fact, data } = calendarStemOrder(example);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸丑');
 assert.equal(change?.exactInstant, '2045-12-26T18:00:00.000Z');
 assert.equal(fact.activeFrom, change.exactInstant);
 const previous = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '壬子');
 assert.equal(previous.normalizedPayload.haiStemRoute, 'ren-repeats-officer-under-hurt');
 assert.equal(previous.normalizedPayload.hasHaiGuiColdWaterOpposition, undefined);
 assert.equal(data.haiStemRoute, 'gui-joins-hurting');
 assert.equal(data.hasHaiGuiColdWaterOpposition, true);
 assert.equal(data.hasHaiGuiRootedLink, false);
 assert.deepEqual(data.haiGuiColdWaterOpposition.waterPositions.map(row => [row.position, row.pillar]),
  [['month', '辛亥'], ['year', '壬子'], ['day', '丁丑'], ['decadal', '癸丑']]);
 assert.deepEqual(data.haiGuiColdWaterOpposition.natalMetalSources.map(row => [row.position, row.pillar]),
  [['month', '辛亥'], ['hour', '戊申']]);
 assert.ok(data.haiStemComparison.hurtOfficerLinks.some(row => row.hurt.position === 'hour'
  && row.officer.position === 'year' && row.movingCombinesHurt));
 const result = match(run, 73);
 assert.equal(result.status, 'not_matched');
 const changed = [
  { ...native(example.natal), year: '壬戌' },
  { ...native(example.natal), day: '丁巳' },
 ].map(natal => ({ ...fact, normalizedPayload: { ...context(natal, '癸丑'), confirmed: true } }));
 assert.ok(changed.every(row => row.normalizedPayload.hasHaiGuiColdWaterOpposition === false));
 const compared = evaluateFortuneRules('bazi', 'year', changed).find(row => row.knowledgeId === result.knowledgeId);
 assert.deepEqual(compared.required[0].hits, changed);
 assert.equal(context(native(example.natal), '癸丑', false).hasHaiGuiColdWaterOpposition, undefined);
});

test('p045 matches the actual Ji, the same Jia and the original exposed Ding', async () => {
 const cases = [{ ...ref.calendarExamples[87], foodAndWealth: ['year', 'hour'] }, ...ref.wuOfficerExamples];
 for (const e of cases) {
  const run = submittedCalendar(e), facts = rows(run).filter(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.luckPillar === e.luck);
  assert.ok(facts.length, e.natal.join());
  const data = facts[0].normalizedPayload, layout = data.wuOfficerFoodWealth;
  const result = match(run, 87);
  assert.equal(result.status, e.foodAndWealth ? 'matched' : 'not_matched', e.natal.join());
  assert.equal(facts.some(fact => result.sourceFactIds.includes(fact.factId)), Boolean(e.foodAndWealth));
  assert.equal(data.hasNewWuOfficerFoodWealth, Boolean(e.foodAndWealth));
  if (e.annualJiOnly) {
   assert.equal(layout, undefined);
   assert.ok(run.facts.some(fact => fact.factType === 'zpqz_moving_relations' && fact.normalizedPayload.annualStem === '己'));
   continue;
  }
  assert.deepEqual([layout.officer.position, layout.officer.pillar, layout.officer.stem, layout.officer.tenGod],
   ['month', e.natal[1], '己', '正官']);
  assert.deepEqual(layout.foodCheckingOfficer.map(row => row.position), layers.filter((_, index) => e.natal[index][0] === '甲'));
  assert.deepEqual(layout.officer.natalExposurePositions, e.priorJi ? [e.priorJi] : []);
  assert.equal(layout.officer.newlyExposedByLuck, !e.priorJi);
  assert.equal(layout.foodWealthLinks.length, e.foodAndWealth ? 1 : 0);
  if (!e.foodAndWealth) continue;
  const [target] = layout.foodWealthLinks;
  assert.deepEqual([target.food.position, target.wealth.position], e.foodAndWealth);
  assert.deepEqual([target.food.element, target.wealth.element, layout.moving.element], ['木', '火', '土']);
  assert.ok(data.movingFivePairs.some(pair => pair.target.position === target.food.position && pair.target.stem === '甲'));
  assert.deepEqual(target.wealthDayCombinations.map(row => [row.first.stem, row.second.stem].sort().join('')), ['丁壬']);
  if (e.year === 2018) {
   const entry = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === e.luck);
   assert.ok(entry);
   assert.equal(entry.exactInstant, '2018-08-20T12:00:00.000Z');
   assert.equal(result.windows[0].start, entry.exactInstant);
   const { input } = modelContext(run), prompt = formatFortuneFactAudit(input);
   assert.ok(prompt.includes('本命月柱甲午的午支藏己正官'));
   assert.ok(prompt.includes('运己所合的本命月柱甲午（该干对日主为食神）在五行上生本命时柱丁未'));
   assert.ok(prompt.includes('这位丁财与本命壬日干原有五合位置'));
   assert.doesNotMatch(prompt, /wuOfficerFoodWealth|hasNewWuOfficerFoodWealth/u);
   const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId);
   assert.deepEqual(finding.windows, result.windows);
   assert.match(finding.note, /若[^。]*甲[^。]*丁[^。]*为用/u);
   let providerChecked = false;
   const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_url, options) => {
    const content = JSON.parse(options.body).messages[1].content;
    assert.ok(content.includes(finding.note));
    assert.ok(content.includes('則己土合甲，反傷喜神為忌矣'));
    providerChecked = true;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
   } });
   await provider.interpret(input);
   assert.ok(providerChecked);
  }
 }
});

test('p045 preserves an earlier matched food-wealth chain after the next stage begins', () => {
 const run = submittedCalendar(ref.wuOfficerExamples[0], 2028), hit = match(run, 87);
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '庚子');
 assert.ok(change);
 assert.equal(change.exactInstant, '2028-08-20T12:00:00.000Z');
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows.at(-1).endExclusive, change.exactInstant);
 const { input } = modelContext(run);
 assert.ok(input.facts.some(fact => fact.type === 'zpqz_stem_order' && fact.data.luckPillar === '己亥'
  && fact.endExclusive === change.exactInstant && describeFortuneFact(fact, String).includes('己在本运首次透出')));
 assert.ok(input.facts.some(fact => fact.type === 'zpqz_stem_order' && fact.data.luckPillar === '庚子'));
});

test('synthetic predicate isolation rejects wrong actual target, false bridge and nonadjacent Yi-Ji even alongside unrelated original facts',()=>{
 const scenario=(n,luck,i)=>{const run=structuredClone(real(i)),template=structuredClone(rows(run)[0]);
  run.facts=run.facts.filter(f=>f.factType!=='zpqz_stem_order');template.normalizedPayload={...context(n,luck),confirmed:true};run.facts.push(template);return match(run,i);};
 assert.equal(scenario(native(['己未','丙子','甲戌','辛未']),'甲戌',56).status,'not_matched');
 assert.equal(scenario(native(['庚寅','甲申','丙申','丙申']),'壬辰',112).status,'not_matched');
 assert.equal(scenario(native(['乙未','辛巳','庚寅','己卯']),'辛巳',113).status,'not_matched');
});

test('actual source facts retain stage bounds and raw provenance; unknown hour and unverified direction cannot become a complete source premise',()=>{
 const run=real(112);for(const row of rows(run)){
  const p=row.normalizedPayload;assert.ok(row.activeFrom>=p.stageStart&&row.activeTo<=p.stageEnd);
  assert.ok(row.sourceFactIds.length>=2&&row.sourceFactIds.every(id=>run.rawFacts.some(raw=>raw.rawFactId===id)));
 }
 const unknown=context(printed('zeng-wealth-seal'),'壬辰',false);assert.equal(unknown.hasJiaGengBingBridge,undefined);
 assert.equal(unknown.printedCases.find(c=>c.id==='zeng-wealth-seal').matches,undefined);assert.ok(unknown.natalPillars.every(r=>r.position!=='hour'));
 const e=ref.calendarExamples[112],bad=archive(e);bad.bazi.rawResult[0].luckPeriods[0].ganZhi='甲子';
 assert.ok(rows(calculate(bad,e.year)).every(f=>f.completeness==='partial'&&f.normalizedPayload.confirmed===false));
 const removed=structuredClone(run);removed.facts=removed.facts.filter(f=>f.factType!=='zpqz_stem_order');assert.equal(match(removed,112).status,'unknown');
});

test('all ten source hashes, precise effect gaps and the three documented query corrections survive SQLite import',()=>{
 for(const i of Object.keys(ref.calendarExamples).map(Number)){const r=fortuneKnowledge.bazi.rules[i],e=fortuneKnowledge.bazi.entries.find(e=>e.id===r.knowledgeId);
  assert.equal(r.queries.length,1);assert.equal(r.queries[0].factType,'zpqz_stem_order');assert.equal(r.queries[0].where.profile,zpqzStemPolicy.profile);assert.equal(r.unresolved.length===0,completeSourceIndices.has(i));
  assert.equal(r.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:e.evidence,conditions:e.conditions})).digest('hex'));
 }
 for(const i of [56,112,113])assert.equal(fortuneKnowledge.bazi.rules[i].review.sourceCorrections.originalJSONPreserved,true);
});

test('Chinese model request preserves source diagram and day-master distinctions, excludes raw machinery and withholds all partial findings',async()=>{
 const run=real(112),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'stem-order-report'));
 assert.ok(input.facts.some(f=>f.type==='zpqz_stem_order'));const prompt=formatFortuneFactAudit(input);
 for(const phrase of ['日干本身保留在柱序内','甲庚隔丙的实际见证','曾参政财印隔日干原图','运干没有本命第五柱位置','根位不等于有效根气'])assert.ok(prompt.includes(phrase),phrase);
 for(const secret of ['jiaGengBingBridges','zeng-wealth-seal','zpqz-stem-order-targets','stem-order-run','stem-order-snapshot','natalOtherFiveContacts','movingFiveTargets'])assert.ok(!prompt.includes(secret),secret);
 assert.ok(!input.sections.flatMap(s=>s.findings).some(f=>Object.keys(ref.calendarExamples).some(i=>fortuneKnowledge.bazi.rules[i].knowledgeId===f.knowledgeId)));
 const p=context(native(ref.calendarExamples[72].natal),'丁未'),d=describeFortuneFact({method:'bazi',type:'zpqz_stem_order',data:p},String);
 assert.match(d,/不据两对一自动命名为争合/u);assert.ok(!/[{}\[\]]/u.test(d));
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await provider.interpret(input);
});

test('the two reviewed wealth-seal rules reach all eleven original movements through SQLite and keep the other Zeng movement open', () => {
 const caseMovements = [
  [112, 'zeng-wealth-seal', ['癸未', '壬午', '辛巳', '己卯', '戊寅']],
  [113, 'yi-ji-adjacent', ['戊寅', '丁丑', '丙子', '乙亥', '甲戌', '癸酉']],
 ];
 for (const [index, id, movements] of caseMovements) {
  const columns = printed(id);
  const rule = fortuneKnowledge.bazi.rules[index];
  const [reading] = rule.review.printedLuck;
  assert.equal(reading.natalPillarSequence, Object.values(columns).join(''));
  assert.deepEqual(reading.periods.flatMap(period => period.pillars), movements);
  const candidate = (chart, luck, timeKnown = true, confirmed = true) => ({
   factType: 'zpqz_stem_order', scope: 'decadal', completeness: 'complete',
   normalizedPayload: { ...context(chart, luck, timeKnown), confirmed },
  });
  const accepted = movements.map(luck => candidate(columns, luck));
  const rejected = [candidate(columns, index === 112 ? '庚辰' : '丙子', true, false),
   candidate(columns, movements[0], false)];
  if (index === 112) rejected.push(candidate(columns, '庚辰'));
  if (index === 113) rejected.push(candidate(columns, '辛巳'), candidate({ ...columns, hour: '庚辰' }, '丙子'));
  const outcome = evaluateFortuneRules('bazi', 'year', [...accepted, ...rejected]).find(result => result.knowledgeId === rule.knowledgeId);
  assert.deepEqual(outcome.required[0].hits, accepted);
  assert.deepEqual(outcome.unresolved, []);
 }
});

test('p070 follows a month-rooted wealth and separated seal across the actual authority change outside the Zeng case', () => {
 const run = submittedCalendar({ date: [1988, 9, 9], hour: 10, gender: 1, year: 2008,
  natal: ['戊辰', '辛酉', '丁卯', '乙巳'] });
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '癸亥');
 assert.ok(change);
 const before = rows(run).find(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.luckPillar === '壬戌'
  && fact.activeTo === change.exactInstant);
 const after = rows(run).find(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.luckPillar === '癸亥'
  && fact.activeFrom === change.exactInstant);
 assert.ok(before && after);
 const route = fact => fact.normalizedPayload.wealthSealLuck.separatedWealthSealPaths[0];
 for (const fact of [before, after]) {
  const path = route(fact);
  assert.deepEqual([path.monthWealth.stem, path.wealth.position, path.wealth.stem, path.seal.position, path.seal.stem],
   ['辛', 'month', '辛', 'hour', '乙']);
  assert.deepEqual(path.between.map(row => row.position), ['day']);
  assert.deepEqual(path.competingAdjacentPairs, []);
 }
 assert.deepEqual(route(before).authorityBridges.map(path => [path.authority.placement, path.authority.stem, path.checkedBy.map(row => row.stem)]),
  [['运干', '壬', ['戊']]]);
 assert.deepEqual(route(after).authorityBridges.map(path => [path.authority.placement, path.authority.stem, path.checkedBy.length]),
  [['运干', '癸', 0], ['运支本气', '壬', 0]]);
 const hit = match(run, 112);
 assert.equal(hit.status, 'not_matched');
 assert.deepEqual(hit.sourceFactIds, []);
 const { input } = modelContext(run);
 const prompt = formatFortuneFactAudit(input);
 const projected = input.facts.filter(row => row.type === 'zpqz_stem_order');
 assert.ok(projected.some(row => row.data.luckPillar === '壬戌' && row.endExclusive === change.exactInstant));
 assert.ok(projected.some(row => row.data.luckPillar === '癸亥' && row.start === change.exactInstant));
 assert.ok(prompt.includes('同一运官杀连接财印'));
 assert.ok(prompt.includes('同一步的运支本气戊（伤官）又克该运官杀'));
 assert.doesNotMatch(prompt, /wealthSealLuck|authorityBridges|曾参政财印隔日干原图/u);
});

test('p070 retains an intervening day but excludes the candidate when the same seal is also adjacent to another month-rooted wealth', () => {
 const run = submittedCalendar({ date: [1970, 8, 14], hour: 4, gender: 1, year: 1980,
  natal: ['庚戌', '甲申', '丙寅', '庚寅'] });
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '乙酉');
 assert.ok(fact);
 const [path] = fact.normalizedPayload.wealthSealLuck.separatedWealthSealPaths;
 assert.equal(path.wealth.position, 'hour');
 assert.equal(path.seal.position, 'month');
 assert.ok(path.supportingSeals.some(row => row.seal.stem === '乙'));
 assert.deepEqual(path.competingAdjacentPairs.map(pair => [pair.wealth.position, pair.seal.position]), [['year', 'month']]);
 assert.equal(match(run, 112).status, 'not_matched');
});

test('original stage changes preserve separate readings and intervening days through client submission and the model', () => {
 const cases = [
  [112, 1908, '癸未', '壬午', '运干癸官', '运干壬杀'],
  [113, 2028, '戊寅', '丁丑', '运干戊印', '运干丁官'],
  [113, 2039, undefined, '丙子', undefined, '子首藏癸伤属食伤顾虑'],
  [113, 2069, undefined, '癸酉', undefined, '酉首藏辛劫的扶身方向'],
 ];
 for (const [index, year, previous, current, beforeText, afterText] of cases) {
  const run = submitted(index, year);
  const { input, knowledge } = modelContext(run);
  const result = knowledge.byMethod.bazi[index];
  assert.equal(result.status, 'matched', year);
  const selected = input.facts.filter(fact => fact.type === 'zpqz_stem_order' && fact.data.printedLuck?.length);
  const active = selected.find(fact => fact.data.luckPillar === current);
  assert.ok(active, year);
  const prompt = formatFortuneFactAudit(input);
  assert.ok(prompt.includes(afterText), year);
  assert.ok(!prompt.includes('natalPillarSequence') && !prompt.includes('printedLuck'), year);
  if (previous) {
   const before = selected.find(fact => fact.data.luckPillar === previous);
   assert.ok(before, year);
   assert.equal(before.endExclusive, active.start);
   assert.ok(prompt.includes(beforeText), year);
  }
  if (index === 112) {
   const roots = active.data.wealthSealLuck.zengWealthSealRoots;
   assert.deepEqual(roots.map(row => [row.role, row.stem, row.positions.map(position => position.position)]),
    [['丙长生', '丙', ['hour']], ['甲禄', '甲', ['hour']], ['庚禄', '庚', ['month', 'day']]]);
   assert.ok(prompt.includes('曾例的庚禄'));
  }
  if (current === '癸酉') {
   const [path] = active.data.wealthSealLuck.yiJiWealthSealPaths;
   assert.deepEqual(path.supportiveRobbery.map(row => [row.placement, row.stem]), [['运支本气', '辛']]);
   assert.deepEqual(path.outputFeedsWealth.map(row => [row.placement, row.stem]), [['运干', '癸']]);
  }
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId);
  assert.ok(finding, year);
  assert.deepEqual(finding.windows, result.windows);
 }
});

test('the confirmed Zeng Geng-Chen movement retains its secondary seal and authority as a local contrast', () => {
 const run = submitted(112, 1933);
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '庚辰');
 assert.ok(fact);
 const { wealthSealLuck, hasSeparatedWealthSealLuck } = fact.normalizedPayload;
 assert.deepEqual(wealthSealLuck.zengGengChen.map(row => [row.placement, row.stem, row.tenGod]), [
  ['运干', '庚', '偏财'], ['运支本气', '戊', '食神'], ['运支其他藏干', '乙', '正印'], ['运支其他藏干', '癸', '正官'],
 ]);
 assert.equal(hasSeparatedWealthSealLuck, false);
 const { input, knowledge } = modelContext(run);
 const hit = knowledge.byMethod.bazi[112];
 assert.equal(hit.status, 'not_matched');
 assert.ok(input.facts.some(row => row.type === 'zpqz_stem_order' && row.data.wealthSealLuck?.zengGengChen?.length === 4));
 assert.match(formatFortuneFactAudit(input), /曾例原表另列庚辰运.*偏财.*食神.*正印.*正官/u);
 assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
});

test('a changed hour keeps the actual Yi-Ji directions without inheriting the original reading', () => {
 const other = submitted(113, 2039, { hour: 8 });
 const candidate = rows(other).find(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.luckPillar === '丙子');
 assert.ok(candidate);
 const [path] = candidate.normalizedPayload.wealthSealLuck.yiJiWealthSealPaths;
 assert.equal(path.monthWealth.stem, '乙');
 assert.deepEqual(path.authorityBridges.map(row => [row.authority.stem, row.checkedBy.map(output => output.stem)]), [['丙', ['癸']]]);
 assert.deepEqual(path.outputFeedsWealth.map(row => [row.placement, row.stem]), [['运支本气', '癸']]);
 assert.equal(match(other, 113).status, 'not_matched');
 const prompt = formatFortuneFactAudit(modelContext(other).input);
 assert.ok(prompt.includes('运支本气癸（伤官）生同一原透乙财'));
 assert.ok(!prompt.includes('子首藏癸伤属食伤顾虑'));
 const alternateDirection = submitted(113, 2034, { gender: 0 });
 assert.equal(match(alternateDirection, 113).status, 'not_matched');
 assert.ok(modelContext(alternateDirection).input.facts.every(fact => fact.type !== 'zpqz_stem_order' || !fact.data.printedLuck?.length));
});

test('p071 rejects adjacent Yi and Ji if the month does not supply the same wealth even with a robbery branch', () => {
 const run = submittedCalendar({ date: [2016, 1, 9], hour: 10, gender: 1, year: 2050,
  natal: ['乙未', '己丑', '庚寅', '辛巳'] });
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '乙酉');
 assert.ok(fact);
 assert.equal(fact.normalizedPayload.hasYiJiAdjacency, true);
 assert.equal(fact.normalizedPayload.luckBranchMainQiGod, '劫财');
 assert.deepEqual(fact.normalizedPayload.wealthSealLuck.yiJiWealthSealPaths, []);
 assert.equal(match(run, 113).status, 'not_matched');
});
