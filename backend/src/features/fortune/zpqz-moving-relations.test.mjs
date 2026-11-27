import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Solar } from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
import { createFortuneDeepSeek } from './server/deepseek-expression.mjs';
const { baziZpqzMovingRelations, zpqzChenBirthTiming, zpqzMovingPolicy } = await import('./control/bazi-zpqz-relations.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/zpqz-moving-reference.json',import.meta.url)));
const fields=['year','month','day','hour'],native=values=>Object.fromEntries(fields.map((field,i)=>[field,values[i]]));
const p040=native(['壬申','戊申','丙寅','丁酉']);
const context=(n=p040,luck='壬寅',annual='丙寅',known=true)=>baziZpqzMovingRelations(n,known,luck,annual);
const rootDirectionIndex=44;
const ruleIndices=[rootDirectionIndex,66,79,80,81,82,83,84];
const completeIndices=[rootDirectionIndex,66,79,82,84];
function archive(example=ref.calendarExamples.twoShen){
 const [year,month,day]=example.date,hour=example.hour??18,lunar=Solar.fromYmdHms(year,month,day,hour,0,0).getLunar();
 const luckPeriods=lunar.getEightChar().getYun(example.gender,2).getDaYun(11).slice(1).map(s=>({ganZhi:s.getGanZhi(),startAge:s.getStartAge(),endAge:s.getEndAge()}));
 return {timeKnown:true,bazi:{engineName:'lunar-javascript',engineVersion:'1.7.8',rulesetVersion:'utc8-jie-local-civil-late-zi-next-v1',rawResult:[{
  utc:new Date(Date.UTC(year,month-1,day,hour-8)).toISOString(),year:lunar.getYearInGanZhiExact(),month:lunar.getMonthInGanZhiExact(),day:lunar.getDayInGanZhiExact(),hour:lunar.getTimeInGanZhi(),luckPeriods,tenGods:{},shenSha:{},
 }]},ziwei:{rawResult:[]},western:{rawResult:[]}};
}
function calculate(chart,year){const input={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year}};
 return calculateFortuneFacts(input,buildFactTimeContext(input,Date.parse(year+'-11-19T02:00:00Z'),'server'),'zpqz-moving-run',{snapshotId:'zpqz-moving-snapshot',chart});}
const cache=new Map(),real=name=>{if(!cache.has(name)){const e=ref.calendarExamples[name];cache.set(name,calculate(archive(e),e.year));}return cache.get(name);};
const rows=run=>run.facts.filter(f=>f.factType==='zpqz_moving_relations');
const result=(run,index)=>matchFortuneKnowledge(run).byMethod.bazi[index];

function submitted(name, example, year = example.year) {
 const chart = archive(example), birth = chart.bazi.rawResult[0];
 assert.deepEqual(fields.map(field => birth[field]), example.natal, name);
 chart.birthContext = { birthInstant: birth.utc, precision: 'minute', latitude: 39.9042, longitude: 116.4074,
  timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
 const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
 const reference = { snapshotId: 'zpqz-clash-' + name }, now = Date.UTC(year, 10, 19, 2);
 const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...reference, chart })));
 const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
 validateFortuneFacts(run);
 return run;
}

test('four original no-root examples keep own-branch roots distinct from actual natal roots and all source directions stay positional',()=>{
 const natal=native(['甲寅','丙午','戊辰','辛酉']);
 for(const pillar of ref.sourceRootExamples){const p=context(natal,pillar);assert.equal(p.luckStemRootedInOwnBranch,false,pillar);assert.equal(p.luckStemRootedInNatal,true,pillar);}
 for(const [name,branches]of Object.entries(ref.sourceDirections))for(const branch of branches){const p=context(natal,'甲'+branch);assert.equal(p.direction.name,name);}
 const roots=context(natal,'丙子').luckStemNativeRoots;
 assert.ok(roots.some(r=>r.branch==='寅'&&r.exactStem&&r.hiddenStems.includes('丙')));
 assert.ok(roots.some(r=>r.branch==='午'&&!r.exactStem&&r.hiddenStems.includes('丁')));
});

test('p002 records all printed direction contrasts without treating generating Qi as a same-element root', () => {
 const groups = [
  ['原文干支同类对照', ['庚申', '辛酉', '甲寅', '乙卯']],
  ['原文木火同气对照', ['甲午', '乙未', '丙寅', '丁卯']],
  ['原文金水同气对照', ['庚子', '辛丑', '壬申', '癸酉']],
  ['原文运干本支无根例', ref.sourceRootExamples],
 ];
 for (const [label, pillars] of groups) for (const pillar of pillars) {
  assert.equal(context(p040, pillar).directionRootContext.example, label, pillar);
 }
 const jiaWu = context(p040, '甲午');
 assert.equal(jiaWu.hasRootlessDirectionWitness, true);
 assert.deepEqual(jiaWu.directionRootContext.branchFeedsStem, []);
 assert.deepEqual(jiaWu.directionRootContext.stemFeedsBranch.map(row => row.stem), ['丁']);
 const bingYin = context(p040, '丙寅');
 assert.equal(bingYin.hasRootlessDirectionWitness, false);
 assert.deepEqual(bingYin.directionRootContext.branchFeedsStem.map(row => row.stem), ['甲']);
});

test('p002 ends at the actual Geng-Zi to Xin-Chou transition but keeps the other source example for comparison', () => {
 const sample = { date: [1981, 9, 13], hour: 16, gender: 0, year: 2020, natal: ['辛酉', '丁酉', '甲午', '壬申'] };
 const run = submitted('luck-direction-change', sample);
 const transition = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '辛丑');
 assert.ok(transition);
 const boundary = transition.exactInstant;
 const before = rows(run).find(row => row.normalizedPayload.luckPillar === '庚子' && row.activeTo === boundary);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '辛丑' && row.activeFrom === boundary);
 assert.ok(before && after);
 const hit = result(run, rootDirectionIndex);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows.at(-1).endExclusive, boundary);
 assert.ok(hit.sourceFactIds.includes(before.factId));
 assert.ok(!hit.sourceFactIds.includes(after.factId));
 assert.equal(result({ ...run, facts: [after] }, rootDirectionIndex).status, 'not_matched');
 const missing = structuredClone(before);
 delete missing.normalizedPayload.hasRootlessDirectionWitness;
 assert.equal(result({ ...run, facts: [missing] }, rootDirectionIndex).status, 'unknown');
 assert.deepEqual(before.normalizedPayload.luckStemOwnRoots, []);
 assert.ok(before.normalizedPayload.luckStemNativeRoots.some(row => row.position === 'hour' && row.exactStem));
 assert.ok(before.normalizedPayload.luckStemNativeRoots.some(row => row.position === 'year' && !row.exactStem));
 const { direction, directionRootContext: evidence, luckStemOwnRoots } = after.normalizedPayload;
 assert.deepEqual([direction.name, direction.element], ['北方', '水']);
 assert.deepEqual([evidence.branchMainQi.stem, evidence.branchMainQi.element], ['己', '土']);
 assert.deepEqual(evidence.branchFeedsStem.map(row => row.stem), ['己']);
 assert.deepEqual(evidence.stemFeedsBranch.map(row => row.stem), ['癸']);
 assert.ok(luckStemOwnRoots.some(row => row.exactStem && row.hiddenStems.includes('辛')));
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'luck-direction-change'));
 const sourceFacts = input.facts.filter(fact => fact.type === 'zpqz_moving_relations');
 assert.ok(sourceFacts.some(fact => fact.data.luckPillar === '庚子' && fact.endExclusive === boundary));
 assert.ok(sourceFacts.some(fact => fact.data.luckPillar === '辛丑' && fact.data.stageStart === boundary));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /本步大运辛丑见于原文金水同气对照。运干辛属金，运支丑本气己属土/u);
 assert.match(prompt, /运支所藏己有生运干辛的方向。运干辛有生运支所藏癸的方向/u);
 assert.doesNotMatch(prompt, /directionRootContext|hasRootlessDirectionWitness|natalDayFeedsStem/u);
 const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
 assert.ok(finding);
 assert.match(finding.note, /运支.*方气/u);
 assert.deepEqual(finding.windows, hit.windows);
});

test('p002 distinguishes no natal root, another Metal stem, and an exact Xin root in complete birth charts', () => {
 const cases = [[8, '甲辰', undefined], [16, '戊申', '庚'], [18, '己酉', '辛']];
 for (const [hour, hourPillar, storedStem] of cases) {
  const sample = { date: [1971, 4, 12], hour, gender: 1, year: 1978, natal: ['辛亥', '壬辰', '丁卯', hourPillar] };
  const run = submitted('luck-direction-native-' + hour, sample);
  const hit = result(run, rootDirectionIndex);
  const fact = rows(run).find(row => row.normalizedPayload.luckPillar === '辛卯' && hit.sourceFactIds.includes(row.factId));
  assert.equal(hit.status, 'matched');
  assert.ok(fact);
  const data = fact.normalizedPayload;
  assert.equal(data.luckStemRootedInNatal, Boolean(storedStem));
  assert.deepEqual(data.luckStemNativeRoots.map(row => [row.position, row.exactStem, row.hiddenStems]),
   storedStem ? [['hour', storedStem === '辛', [storedStem]]] : []);
  assert.ok(data.directionRootContext.natalSources.some(row => row.position === 'month' && row.stem === '戊' && row.kind === '支藏'));
  assert.match(describeFortuneFact({ method: 'bazi', type: fact.factType, data }, String), /本命月柱壬辰藏戊.*有生运干辛的方向/u);
 }
});

test('all natal-column placements distinguish exactly two Shen and one Yin from three Shen, two Yin and unknown hour',()=>{
 const seen=new Set();
 for(const a of fields)for(const b of fields.filter(p=>p!==a))for(const c of fields.filter(p=>p!==a&&p!==b)){
  const n={year:'己酉',month:'己酉',day:'己酉',hour:'己酉'};n[a]='壬申';n[b]='戊申';n[c]='丙寅';
  const p=context(n);assert.equal(p.exactTwoShenOneYin,true);assert.equal(p.hasShenYinClashPairings,true);assert.equal(p.twoClashPairings.length,2);
  for(const pairing of p.twoClashPairings){assert.equal(pairing.pairs.length,2);assert.equal(new Set(pairing.pairs.map(r=>r.shen.position)).size,2);assert.equal(new Set(pairing.pairs.map(r=>r.yin.position)).size,2);}
  seen.add(p.branchCounts.find(r=>r.branch==='寅').positions.join());
 }
 assert.equal(seen.size,4);
 assert.equal(context({...p040,hour:'庚申'}).exactTwoShenOneYin,false);
 assert.equal(context({...p040,hour:'庚寅'}).exactTwoShenOneYin,false);
 assert.equal(context(p040,'壬子').twoClashPairings.length,0);
 const unknown=context(p040,'壬寅','丙寅',false);assert.equal(unknown.exactTwoShenOneYin,undefined);assert.equal(unknown.twoClashPairings.length,0);
 assert.ok(unknown.branchCounts.every(row=>row.totalCount===undefined));assert.ok(unknown.natalPillars.every(row=>row.position!=='hour'));
});

test('every moving clash identifies its exact natal column, source class, month status and the annual co-clash of that same column',()=>{
 const n=native(['甲寅','乙卯','丙辰','丁巳']);
 for(const [kind,branches]of Object.entries(ref.sourceBranchClasses))for(const branch of branches){
  const list=[...'子丑寅卯辰巳午未申酉戌亥'],opposite=list[(list.indexOf(branch)+6)%12];
  const p=context({...n,month:'甲'+branch},'甲'+opposite,'丙'+opposite),row=p.movingClashes.find(row=>row.natal.position==='month');
  assert.equal(row.branchClass,kind);assert.equal(row.luckBranchClass,kind);assert.equal(row.sourceLayer,'branch');
  assert.equal(row.isMonthCommand,true);assert.equal(row.annualAlsoClashes,true);
  assert.equal(row.textUrgency,'急');
 }
 const p=context(p040,'壬寅','丙申');
 assert.equal(p.movingClashes.length,2);assert.equal(p.hasAnnualJointClash,false);
 assert.deepEqual(p.annualJointClashTargets,[]);
 // Annual Shen clashes natal Yin; moving Yin clashes natal Shen. Those
 // different targets must not be spliced into one "joint" clash.
 assert.equal(context(p040,'壬寅','丙寅').hasAnnualJointClash,true);
 assert.deepEqual(context(p040,'壬寅','丙寅').annualJointClashTargets,['year','month']);
 const repeated=context({...p040,hour:'庚申'},'壬寅','壬寅');
 assert.equal(repeated.movingClashes.find(row=>row.natal.position==='hour').textUrgency,'缓');
 assert.match(describeFortuneFact({method:'bazi',type:'zpqz_moving_relations',data:repeated},String),/太岁与大运干支同柱/u);
 assert.equal(context(n,'乙丑','乙丑',false).hasMovingClash,undefined);
});

test('Si-You-Chou and Hai-Mao-Wei keep every member and the source’s single-Hai/single-Wei candidates separate from completed groups',()=>{
 const n=native(['甲亥','乙酉','甲子','丁巳']),p=context(n,'癸卯');
 const metal=p.groups.find(g=>g.values==='巳酉丑'),wood=p.groups.find(g=>g.values==='亥卯未');
 assert.equal(metal.natalComplete,false);assert.deepEqual(metal.missingInKnownPositions,['丑']);
 assert.equal(wood.completeWithLuck,false);assert.deepEqual(wood.missingInKnownPositions,['未']);
 assert.deepEqual(wood.members.find(m=>m.branch==='亥').natalPositions,['year']);assert.equal(wood.members.find(m=>m.branch==='卯').luckPresent,true);
 const full=context({...n,hour:'己未'},'癸卯').groups.find(g=>g.values==='亥卯未');assert.equal(full.completedByLuck,true);assert.equal(full.natalComplete,false);
 const already=context({...n,day:'乙卯',hour:'己未'},'癸卯').groups.find(g=>g.values==='亥卯未');assert.equal(already.natalComplete,true);assert.equal(already.completedByLuck,false);
});

test('Bing/Ding stem and Si/Wu branch pathways coexist without collapsing same-element stems into effective clashes',()=>{
 const n=native(['癸亥','甲子','丙子','丁酉']),p=context(n,'丁巳');
 assert.equal(p.fireExample.natalFrame,true);assert.equal(p.fireExample.movingSameFireStem,true);assert.equal(p.fireExample.movingSiWuBranch,true);
 assert.deepEqual(p.fireExample.contacts.map(row=>row.natal.position),['year']);
 const wu=context(n,'丙午');assert.deepEqual(wu.fireExample.contacts.map(row=>row.natal.position),['month']);
 assert.deepEqual(wu.movingClashes.map(row=>row.natal.position),['month','day']);
 assert.equal(context(n,'丙寅').movingClashes.length,0);
});

test('p024 distinguishes the winter-water frame and the two actual moving-fire routes', async () => {
 const sample = { date: [1971, 12, 17], hour: 18, gender: 0, year: 2028, natal: ['辛亥', '庚子', '丙子', '丁酉'] };
 const run = submitted('cold-water-fire', sample), hit = result(run, 66);
 const si = rows(run).findLast(row => row.normalizedPayload.luckPillar === '乙巳' && hit.sourceFactIds.includes(row.factId));
 const wu = rows(run).find(row => row.normalizedPayload.luckPillar === '丙午' && hit.sourceFactIds.includes(row.factId));
 assert.equal(hit.status, 'matched');
 assert.ok(si && wu);
 assert.equal(si.activeTo, wu.activeFrom);
 const contacts = [si, wu].map(row => row.normalizedPayload.fireExample.coldWaterFireContact);
 assert.deepEqual(contacts.map(({ waterHidden, fireHidden }) => [waterHidden, fireHidden].map(row => [row.position, row.pillar, row.stem, row.tenGod])),
  [[['year', '辛亥', '壬', '七杀'], ['decadal', '乙巳', '丙', '比肩']], [['month', '庚子', '癸', '正官'], ['decadal', '丙午', '丁', '劫财']]]);
 assert.equal(si.normalizedPayload.hasFireSourceStem, false);
 assert.equal(si.normalizedPayload.hasFireSourceBranch, true);
 assert.equal(wu.normalizedPayload.hasFireSourceStem, true);
 assert.equal(wu.normalizedPayload.hasFireSourceBranch, true);
 assert.equal(wu.normalizedPayload.fireExample.stemSupport.tenGod, '比肩');
 assert.deepEqual(wu.normalizedPayload.fireExample.natalWater.map(row => [row.position, row.stem]), [['year', '壬'], ['month', '癸']]);
 for (const fact of [si, wu]) {
  assert.equal(fact.normalizedPayload.hasColdWaterSeasonBasis, true);
  const { monthCommand, yearWater } = fact.normalizedPayload.fireExample.coldWaterSeasonBasis;
  assert.deepEqual([monthCommand.branch, monthCommand.stem, yearWater.branch, yearWater.stem], ['子', '癸', '亥', '壬']);
 }
 assert.deepEqual(wu.normalizedPayload.movingClashes.map(row => row.natal.position), ['month', 'day']);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'cold-water-fire'));
 const previous = input.facts.find(fact => fact.type === 'zpqz_moving_relations' && fact.endExclusive === wu.activeFrom
  && fact.data.luckPillar === '乙巳');
 assert.match(describeFortuneFact(previous, String), /本命年柱辛亥藏壬七杀与同一六冲中的本步大运乙巳藏丙比肩形成水克火的方向/u);
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /本步大运丙午的运干丙为比肩，与本命日干丙同属火/u);
 assert.match(prompt, /原局年亥和月子的水气分别为本命年柱辛亥藏壬七杀、本命月柱庚子藏癸正官/u);
 assert.match(prompt, /本命月柱庚子藏癸正官与同一六冲中的本步大运丙午藏丁劫财/u);
 assert.doesNotMatch(prompt, /hasFireSourceBranch|coldWaterFireContact/u);
 const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
 assert.deepEqual(finding.windows, hit.windows);
 assert.match(finding.note, /丙丁/);
 assert.match(finding.note, /巳冲本命年亥[^。]*午冲月子/u);
 let providerCalled = false;
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_url, options) => {
  const message = JSON.parse(options.body).messages[1].content;
  assert.ok(message.includes(finding.note));
  assert.ok(message.includes('行巳午運則為衰神沖旺'));
  providerCalled = true;
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(input);
 assert.equal(providerCalled, true);
 const stemOnly = submitted('winter-fire-stem-only', { ...sample, gender: 1 }, 2005);
 const stemHit = result(stemOnly, 66);
 assert.equal(stemHit.status, 'matched');
 const stemFacts = rows(stemOnly).filter(row => stemHit.sourceFactIds.includes(row.factId));
 assert.deepEqual([...new Set(stemFacts.map(row => row.normalizedPayload.luckPillar))], ['丁酉', '丙申']);
 assert.ok(stemFacts.every(row => row.normalizedPayload.hasFireSourceStem && !row.normalizedPayload.hasFireSourceBranch));
 const annualOnly = submitted('annual-fire-only', sample, 2014);
 assert.ok(rows(annualOnly).some(row => row.normalizedPayload.annualBranch === '午' && row.normalizedPayload.luckBranch === '辰'));
 assert.equal(result(annualOnly, 66).status, 'not_matched');
});

test('Ren Chen storehouse witnesses distinguish exact Ren roots from same-element Gui and reveal already-exposed versus newly-exposed stems',()=>{
 const n=native(['壬戌','甲辰','丁卯','己酉']),p=context(n,'庚子');
 assert.deepEqual(p.renExposures.map(row=>row.position),['year']);assert.equal(p.renExposed,true);
 assert.deepEqual(p.chenStorehousePositions,['month']);
 assert.ok(p.renRootsWithLuck.some(row=>row.position==='month'&&!row.exactStem&&row.hiddenStems.includes('癸')));
 assert.ok(p.renRootsWithLuck.some(row=>row.position==='decadal'&&!row.exactStem));
 assert.ok(context(n,'庚申').renRootsWithLuck.some(row=>row.position==='decadal'&&row.exactStem));
 const water=ref.calendarExamples.chenWater,p2=context(native(water.natal),water.luck);
 assert.deepEqual(p2.waterNativeAssociates,['申']);assert.equal(p2.groups.find(g=>g.values==='申子辰').natalComplete,false);
 assert.ok(p2.hiddenActivations.some(row=>row.stem==='癸'&&row.newlyExposedByLuck===true));
});

test('five real calendars exercise atomic SQLite source candidates, including the Shen-Chen branch without Zi',()=>{
 const expected={twoShen:[rootDirectionIndex,79,80,82],fireStem:[66],youClash:[],chenRen:[83],chenWater:[84]};
 for(const [name,indices]of Object.entries(expected)){
  const e=ref.calendarExamples[name],run=real(name);validateFortuneFacts(run);assert.notEqual(run.methods.bazi.status,'failed');
  const chart=archive(e);assert.deepEqual(fields.map(f=>chart.bazi.rawResult[0][f]),e.natal);
  assert.ok(rows(run).some(row=>row.normalizedPayload.luckPillar===e.luck&&row.normalizedPayload.confirmed));
  for(const i of indices)assert.equal(result(run,i).status,completeIndices.includes(i)?'matched':'partial',name+' '+i);
 }
 assert.equal(result(real('youClash'),81).status,'not_matched');
});

test('complete client charts separate natal combinations for p039 from an actual month clash for p037', () => {
 const cases = [
  ['metalPair', true, true, [], ['原局巳酉丑三支齐备']],
  ['metalFull', true, true, ['本命年柱另见丑，原局巳酉丑三支齐备']],
  ['yearWood', true, true, ['运卯会原局的本命年柱亥', '沈氏正文所举的年支亥在位']],
  ['elseWood', true, true, ['运卯会原局的本命时柱未'], ['沈氏正文所举的年支']],
  ['luckCompletesWood', true, true, ['运卯会原局的本命年柱亥、本命时柱未', '本运补齐原先缺支']],
  ['chenOnly', true, false, ['本命日柱的辰与月酉六合', '同一原局辰对应两处受卯运冲的酉']],
  ['xuOnly', true, true, ['本命年柱的戌与运卯六合']],
  ['annualPartnerOnly', true, false], ['chouOnly', true, false],
  ['offMonth', false, false], ['offDayMaster', true, false],
 ];
 for (const [name, monthClash, combination, included = [], excluded = []] of cases) {
  const e = ref.clashExamples[name], run = submitted(name, e);
  const fact = rows(run).find(row => row.normalizedPayload.luckPillar === e.luck && row.normalizedPayload.confirmed
   && Date.parse(row.activeFrom) <= Date.UTC(e.year, 6, 1) && Date.UTC(e.year, 6, 1) < Date.parse(row.activeTo));
  assert.ok(fact, name);
  const data = fact.normalizedPayload;
  assert.equal(data.hasMovingClash, true, name);
  assert.equal(data.hasMovingMonthClash, monthClash, name);
  assert.ok(data.movingClashes.every(row => row.textUrgency === (['year', 'month'].includes(row.natal.position) ? '急' : '缓')));
  const method = result(run, 79);
  assert.equal(method.status, 'matched', name);
  assert.equal(data.movingClashMethodReady, true, name);
  assert.ok(method.sourceFactIds.includes(fact.factId), name);
  const match = result(run, 81);
  const confirmedMeeting = { metalFull: 'natal-si-you-chou', elseWood: 'luck-mao-with-natal-wei',
   luckCompletesWood: 'luck-hai-mao-wei' }[name];
  assert.equal(match.status, confirmedMeeting ? 'matched' : combination ? 'partial' : 'not_matched', name);
  assert.deepEqual(data.youSourceMeetingRoutes, confirmedMeeting ? [confirmedMeeting] : [], name);
  if (confirmedMeeting) assert.equal(match.matchedSourceExcerpt, '有會合');
  assert.equal(data.youClashReliefRoutes.length > 0, combination, name);
  assert.equal(match.sourceFactIds.includes(fact.factId), combination, name);
  const sourceRoutes = {
   metalPair: ['natal-si-you'], metalFull: ['natal-si-you', 'natal-si-you-chou'],
   yearWood: ['year-hai-wei-meets-luck', 'hai-mao-wei-annual-supplement'],
   elseWood: [], luckCompletesWood: ['year-hai-wei-meets-luck', 'hai-mao-wei-in-natal-and-luck'],
  };
  assert.deepEqual(data.youSourceReliefRoutes, sourceRoutes[name] ?? [], name);
  if (name === 'yearWood') {
   const previousYear = rows(run).find(row => row.activeTo === fact.activeFrom && row.normalizedPayload.luckPillar === e.luck);
   assert.ok(previousYear);
   assert.equal(previousYear.normalizedPayload.annualBranch, '午');
   assert.equal(data.annualBranch, '未');
   assert.deepEqual(previousYear.normalizedPayload.youSourceReliefRoutes, ['year-hai-wei-meets-luck']);
   assert.deepEqual(data.youSourceRelief.annotatedNativeWood.map(row => [row.position, row.branch]), [['year', '亥']]);
   assert.ok(match.sourceFactIds.includes(previousYear.factId));
   assert.equal(data.groups.find(row => row.values === '亥卯未').completeWithLuck, false);
  }
  if (name === 'annualPartnerOnly') assert.equal(data.annualBranch, '戌');
  if (name === 'elseWood') {
   assert.deepEqual(data.youSourceRelief.annotatedNativeWood.map(row => [row.position, row.branch]), [['hour', '未']]);
   assert.equal(data.groups.find(row => row.values === '亥卯未').completeWithLuck, false);
  }
  if (name === 'luckCompletesWood') assert.equal(data.groups.find(row => row.values === '亥卯未').completedByLuck, true);
  const description = describeFortuneFact({ method: 'bazi', type: fact.factType, data }, String);
  for (const phrase of included) assert.ok(description.includes(phrase), name + ' ' + phrase);
  for (const phrase of excluded) assert.ok(!description.includes(phrase), name + ' ' + phrase);
  assert.doesNotMatch(description, /hasMovingMonthClash|natalChenPositions|natalXuPositions/u);
  if (name === 'chenOnly') {
   const [chen] = data.youExample.liuheRoutes;
   assert.deepEqual(chen.sharedChenClash.targets.map(row => row.position), ['month', 'hour']);
   const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'zpqz-month-clash'));
   assert.match(formatFortuneFactAudit(input), /本命日柱的辰与月酉六合/u);
   assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== match.knowledgeId)));
  }
 }

 const oneYou = { ...ref.clashExamples.yearWood, hour: 12, natal: ['辛亥', '丁酉', '甲寅', '庚午'] };
 const annualSupplement = submitted('year-hai-single-you', oneYou);
 const weiYear = rows(annualSupplement).find(row => row.normalizedPayload.luckPillar === '癸卯'
  && row.normalizedPayload.annualBranch === '未');
 const wuYear = rows(annualSupplement).find(row => row.activeTo === weiYear?.activeFrom);
 assert.ok(weiYear && wuYear);
 assert.equal(wuYear.normalizedPayload.annualBranch, '午');
 for (const fact of [wuYear, weiYear]) {
  assert.deepEqual(fact.normalizedPayload.youSourceMeetingRoutes, ['luck-mao-with-natal-hai']);
  assert.equal(fact.normalizedPayload.groups.find(row => row.values === '亥卯未').completeWithLuck, false);
  const match = result({ ...annualSupplement, facts: [fact] }, 81);
  assert.equal(match.status, 'matched');
  assert.equal(match.matchedSourceExcerpt, '有會合');
  assert.match(match.matchedConditions.join(''), /只确认这两处会位.*实际能否解冲仍须核/u);
 }

 const annualMao = submitted('annual-mao', ref.clashExamples.metalPair, 2023);
 assert.ok(rows(annualMao).some(fact => fact.normalizedPayload.annualBranch === '卯' && fact.normalizedPayload.luckBranch !== '卯'));
 assert.equal(result(annualMao, 81).status, 'not_matched');
});

test('p039 confirms two cited Liuhe arrangements only in the qualified slices of the same luck period', () => {
 for (const [name, route] of [['adjacentChen', 'chen-you'], ['singleXu', 'mao-xu']]) {
  const example = ref.clashExamples[name], run = submitted(name, example);
  const slices = rows(run).filter(fact => fact.normalizedPayload.confirmed
   && fact.normalizedPayload.luckPillar === example.luck).sort((left, right) => left.activeFrom.localeCompare(right.activeFrom));
  const [before, during] = slices;
  assert.equal(slices.length, 2, name);
  assert.equal(before.activeTo, during.activeFrom, name);
  assert.equal(before.normalizedPayload.annualBranch, '戌', name);
  assert.equal(during.normalizedPayload.annualBranch, '亥', name);
  for (const slice of slices) {
   const confirmed = slice === during, data = slice.normalizedPayload;
   assert.equal(data.hasMovingMonthClash, true, name);
   assert.ok(data.youClashReliefRoutes.includes(route), name);
   assert.deepEqual(data.youSourceLiuheRoutes, confirmed ? [route] : [], name);
   const single = { ...run, facts: [slice] }, match = result(single, 81);
   assert.equal(match.status, confirmed ? 'matched' : 'partial', name);
   if (confirmed) assert.equal(match.matchedSourceExcerpt, '有會合', name);
  }
 }
});

test('p037 checks the actual branch source even when the same natal column also has a stem clash', () => {
 const example = ref.calendarExamples.twoShen;
 for (const [year, luck, target, branch, expected] of [
  [2008, '丙午', ['year', '壬申'], undefined, 'not_matched'],
  [2038, '癸卯', ['hour', '丁酉'], '四正', 'matched'],
 ]) {
  const run = submitted('clash-method-' + year, example, year);
  const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === luck);
  assert.ok(fact, year);
  const data = fact.normalizedPayload, hit = result(run, 79);
  assert.deepEqual(data.movingStemClashes.map(row => [row.natal.position, row.natal.pillar, row.luck.pillar, row.sourceLayer]),
   [[...target, luck, 'stem']]);
  assert.deepEqual(data.movingClashes.map(row => [row.natal.position, row.natal.pillar, row.luck.pillar, row.branchClass, row.luckBranchClass, row.sourceLayer]),
   branch ? [[...target, luck, branch, branch, 'branch']] : []);
  assert.equal(data.hasMovingMonthClash, false);
  assert.equal(data.movingClashMethodReady, Boolean(branch));
  assert.equal(hit.status, expected);
  assert.equal(hit.sourceFactIds.includes(fact.factId), Boolean(branch));
 }
});

test('a complete natal rival for the same Liuhe partner excludes only the p039 relief candidate', async () => {
 const cases = [
  { id: 'chen', date: [1960, 9, 13], year: 2016, hour: 16, parallelHour: 12, gender: 0, luck: '己卯',
   natal: ['庚子', '乙酉', '甲辰', '壬申'], parallelHourPillar: '庚午', partner: '辰', group: '申子辰',
   annual: '申', combination: '辰酉', partnerPosition: 'day' },
  { id: 'xu', date: [1958, 9, 14], year: 2012, hour: 4, parallelHour: 6, gender: 0, luck: '乙卯',
   natal: ['戊戌', '辛酉', '甲午', '丙寅'], parallelHourPillar: '丁卯', partner: '戌', group: '寅午戌',
   annual: '辰', combination: '卯戌', partnerPosition: 'year' },
 ];
 for (const sample of cases) {
  const select = run => rows(run).find(({ normalizedPayload: p }) => p.confirmed === true
   && p.luckPillar === sample.luck && p.annualBranch === sample.annual);
  const competing = submitted(sample.id + '-natal-rival', sample);
  const rivalFact = select(competing);
  assert.ok(rivalFact, sample.id);
  const p = rivalFact.normalizedPayload;
  const [route] = p.youExample.liuheRoutes;
  assert.equal(route.partner, sample.partner);
  assert.deepEqual(route.positions, [sample.partnerPosition]);
  assert.equal(route.rivalValues, sample.group);
  assert.equal(route.natalRivalComplete, true);
  assert.equal(route.natalRivalHalf, false);
  assert.equal(route.annualCompletesRival, false);
  assert.deepEqual(route.rivalMembers.map(row => row.branch), [...sample.group]);
  assert.ok(route.rivalMembers.every(row => row.natalPositions.length > 0));
  assert.equal(p.youClashReliefCandidate, false);
  assert.ok(result(competing, 79).sourceFactIds.includes(rivalFact.factId), sample.id);
  assert.equal(result(competing, 81).status, 'not_matched', sample.id);
  const { input } = buildFortuneModelContext(competing, interpretFortune(competing, requestForFortuneRun(competing), 'zpqz-rival'));
  const prompt = formatFortuneFactAudit(input);
  assert.ok(prompt.includes('排除' + sample.combination + '六合可单独解月酉冲的候选，保留卯酉冲'), sample.id);
  assert.doesNotMatch(prompt, /youClashReliefCandidate|natalRivalComplete|annualCompletesRival/u);

  const parallel = submitted(sample.id + '-parallel', { ...sample, hour: sample.parallelHour,
   natal: [...sample.natal.slice(0, 3), sample.parallelHourPillar] });
  const parallelFact = select(parallel);
  assert.ok(parallelFact, sample.id);
  const [parallelRoute] = parallelFact.normalizedPayload.youExample.liuheRoutes;
  assert.equal(parallelRoute.natalRivalComplete, false);
  assert.equal(parallelRoute.natalRivalHalf, true);
  assert.equal(parallelRoute.annualCompletesRival, sample.id === 'chen');
  assert.deepEqual(parallelRoute.annualPartnerClashes.map(row => [row.position, row.pillar]), sample.id === 'xu' ? [['year', '戊戌']] : []);
  assert.equal(parallelFact.normalizedPayload.youClashReliefCandidate, true);
  assert.ok(result(parallel, 81).sourceFactIds.includes(parallelFact.factId), sample.id);
  assert.ok(result(parallel, 79).sourceFactIds.includes(parallelFact.factId), sample.id);
  const { input: parallelInput } = buildFortuneModelContext(parallel, interpretFortune(parallel, requestForFortuneRun(parallel), 'zpqz-half-rival'));
  const parallelPrompt = formatFortuneFactAudit(parallelInput);
  assert.ok(parallelPrompt.includes('半会见位，共用' + sample.combination + '六合的' + sample.partner));
  if (sample.id === 'xu') assert.match(parallelPrompt, /本段太岁壬辰另冲卯戌六合的伙伴本命年柱戊戌/u);
  assert.doesNotMatch(parallelPrompt, /natalRivalHalf|annualPartnerClashes/u);
  if (sample.id === 'chen') {
   const twoYou = submitted('one-chen-two-clashing-you', { ...sample, hour: 18,
    natal: [...sample.natal.slice(0, 3), '癸酉'] });
   const fact = select(twoYou);
   assert.ok(fact);
   const { normalizedPayload: data } = fact;
   const [chen] = data.youExample.liuheRoutes;
   assert.equal(chen.natalRivalComplete, false);
   assert.deepEqual([chen.sharedChenClash.partner.position, chen.sharedChenClash.partner.pillar], ['day', '甲辰']);
   assert.deepEqual(chen.sharedChenClash.targets.map(row => [row.position, row.pillar]), [['month', '乙酉'], ['hour', '癸酉']]);
   assert.deepEqual(data.youClashReliefRoutes, []);
   assert.equal(result(twoYou, 81).status, 'not_matched');
   assert.ok(result(twoYou, 79).sourceFactIds.includes(fact.factId));
   const { input } = buildFortuneModelContext(twoYou, interpretFortune(twoYou, requestForFortuneRun(twoYou), 'zpqz-two-you'));
   const evidence = /同一原局辰对应两处受卯运冲的酉，辰在本命日柱甲辰，两处酉为本命月柱乙酉和本命时柱癸酉/u;
   assert.match(formatFortuneFactAudit(input), evidence);
   const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
    assert.doesNotMatch(JSON.parse(options.body).messages[1].content, /同一原局辰对应两处受卯运冲的酉|sharedChenClash/u);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
   } });
   await provider.interpret(input);
  }
 }
 const other = context(native(['甲戌', '癸酉', '甲辰', '癸酉']), '己卯', '丙申');
 assert.ok(other.youExample.liuheRoutes.find(route => route.partner === '辰').sharedChenClash);
 assert.deepEqual(other.youClashReliefRoutes, ['mao-xu']);
 assert.equal(context(native(['甲戌', '癸酉', '甲辰', '癸酉']), '己卯', '丙申', false).youExample.liuheRoutes, undefined);
});

test('p039 locates a competing natal clash on the named combination partner itself', () => {
 const sample = { date: [1958, 9, 14], hour: 8, gender: 0, year: 2013, luck: '乙卯',
  natal: ['戊戌', '辛酉', '甲午', '戊辰'] };
 const run = submitted('natal-partner-clash', sample), hit = result(run, 81);
 const fact = rows(run).find(row => row.normalizedPayload.luckPillar === sample.luck && hit.sourceFactIds.includes(row.factId));
 assert.equal(hit.status, 'partial');
 assert.ok(fact);
 const routes = fact.normalizedPayload.youExample.liuheRoutes;
 assert.deepEqual(routes.map(row => [row.partner, row.natalRivalHalf]), [['辰', false], ['戌', true]]);
 for (const route of routes) {
  assert.deepEqual(route.natalPartnerClashes.flatMap(row => row.members.map(member => [member.position, member.pillar])),
   [['year', '戊戌'], ['hour', '戊辰']]);
 }
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'zpqz-partner-clash'));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /同一卯戌六合伙伴在原局另见本命年柱戊戌与本命时柱戊辰六冲/u);
 assert.doesNotMatch(prompt, /natalPartnerClashes/u);
});

test('p038 keeps both actual targets before Li Chun without passing them into the next solar year', () => {
 const run = submitted('same-stage-joint-clash', ref.calendarExamples.twoShen, 2047);
 const hit = result(run, 80);
 const before = rows(run).find(row => row.normalizedPayload.annualPillar === '丙寅' && row.normalizedPayload.luckPillar === '壬寅');
 const after = rows(run).find(row => row.normalizedPayload.annualPillar === '丁卯' && row.normalizedPayload.luckPillar === '壬寅');
 assert.ok(before && after);
 assert.equal(before.activeTo, after.activeFrom);
 assert.deepEqual(before.normalizedPayload.annualJointClashTargets, ['year', 'month']);
 assert.deepEqual(after.normalizedPayload.annualJointClashTargets, []);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '流年並沖');
 assert.ok(hit.sourceFactIds.includes(before.factId));
 assert.ok(!hit.sourceFactIds.includes(after.factId));
 assert.equal(hit.windows[0].endExclusive, after.activeFrom);
 assert.equal(result({ ...run, facts: [after] }, 80).status, 'not_matched');

 const differentTargets = submitted('separate-clash-targets', ref.calendarExamples.twoShen, 2052);
 const mismatch = rows(differentTargets).find(row => row.normalizedPayload.annualPillar === '壬申' && row.normalizedPayload.luckPillar === '壬寅');
 assert.ok(mismatch);
 const data = mismatch.normalizedPayload;
 assert.deepEqual(data.movingClashes.map(row => row.natal.position), ['year', 'month']);
 assert.deepEqual(data.annualJointClashTargets, []);
 assert.equal(result(differentTargets, 80).status, 'not_matched');

 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'zpqz-joint-clash-years'));
 const inputBefore = input.facts.find(row => row.type === 'zpqz_moving_relations' && row.data.annualPillar === '丙寅');
 const inputAfter = input.facts.find(row => row.type === 'zpqz_moving_relations' && row.data.annualPillar === '丁卯');
 assert.equal(inputBefore.endExclusive, after.activeFrom);
 assert.equal(inputAfter.start, after.activeFrom);
 assert.match(describeFortuneFact(inputBefore, String), /太岁与大运同支异干/u);
 assert.doesNotMatch(describeFortuneFact(inputAfter, String), /岁运并冲的两个参与方已核/u);
});

test('p038 confirms favorable luck and annual clash only in the reviewed Zhang configuration', () => {
 const chart = { date: [1866, 10, 13], hour: 0, year: 1928, gender: 1, natal: ['丙寅', '戊戌', '辛酉', '戊子'] };
 const run = submitted('zhang-wealth-annual-clash', chart);
 const after = rows(run).find(row => row.normalizedPayload.annualPillar === '戊辰' && row.normalizedPayload.luckPillar === '甲辰');
 const before = rows(run).find(row => row.activeTo === after?.activeFrom);
 assert.ok(before && after);
 assert.deepEqual([before.normalizedPayload.luckPillar, before.normalizedPayload.annualPillar], ['甲辰', '丁卯']);
 assert.equal(before.normalizedPayload.hasZhangReviewedWealthMonthClash, false);
 assert.equal(after.normalizedPayload.hasZhangReviewedWealthMonthClash, true);
 const month = after.normalizedPayload.movingClashes.find(row => row.natal.position === 'month');
 assert.deepEqual([month.natal.pillar, month.luck.pillar, month.annual.pillar], ['戊戌', '甲辰', '戊辰']);
 assert.equal(result(run, 119).status, 'matched');
 const match = result(run, 80);
 assert.equal(match.status, 'matched');
 assert.equal(match.matchedSourceExcerpt, '或運雖為喜而流年並沖');
 assert.deepEqual(match.windows, [{ start: after.activeFrom, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
 assert.equal(result({ ...run, facts: [before] }, 80).status, 'not_matched');

 const near = context({ ...native(chart.natal), hour: '己丑' }, '甲辰', '戊辰');
 assert.deepEqual(near.annualJointClashTargets, ['month']);
 assert.equal(near.hasZhangReviewedWealthMonthClash, false);
 const generic = result({ ...run, facts: [{ ...after, normalizedPayload: { ...after.normalizedPayload, ...near } }] }, 80);
 assert.equal(generic.matchedSourceExcerpt, '流年並沖');
 const unknown = context(native(chart.natal), '甲辰', '戊辰', false);
 assert.equal(unknown.hasZhangReviewedWealthMonthClash, undefined);

 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'zhang-reviewed-wealth-clash'));
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /原评所取的甲财[^\n]+\n原文：或運雖為喜而流年並沖/u);
 assert.doesNotMatch(prompt, /hasZhangReviewedWealthMonthClash/u);
});

test('p038 binds the reviewed Zhang day clash to the actual Gui-Mao handover within the Yi-Mao year', () => {
 const chart = { date: [1866, 10, 13], hour: 0, year: 1915, gender: 1, natal: ['丙寅', '戊戌', '辛酉', '戊子'] };
 const run = submitted('zhang-reviewed-wealth-day-clash', chart);
 const after = rows(run).find(row => row.normalizedPayload.annualPillar === '乙卯' && row.normalizedPayload.luckPillar === '癸卯');
 const before = rows(run).find(row => row.activeTo === after?.activeFrom);
 assert.ok(before && after);
 assert.equal(after.activeFrom, '1915-06-06T00:00:00.000Z');
 assert.deepEqual([before.normalizedPayload.luckPillar, before.normalizedPayload.annualPillar], ['壬寅', '乙卯']);
 assert.equal(before.normalizedPayload.hasZhangReviewedWealthDayClash, false);
 assert.equal(after.normalizedPayload.hasZhangReviewedWealthDayClash, true);
 assert.equal(after.normalizedPayload.hasZhangReviewedWealthMonthClash, false);
 const [target] = after.normalizedPayload.movingClashes;
 assert.deepEqual([target.natal.position, target.natal.pillar, target.luck.pillar, target.annual.pillar], ['day', '辛酉', '癸卯', '乙卯']);
 assert.equal(result(run, 119).status, 'matched');
 const match = result(run, 80);
 assert.equal(match.status, 'matched');
 assert.equal(match.matchedSourceExcerpt, '或運雖為喜而流年並沖');
 assert.deepEqual(match.windows, [{ start: after.activeFrom, endExclusive: after.activeTo }]);
 assert.equal(result({ ...run, facts: [before] }, 80).status, 'not_matched');

 const near = submitted('zhang-day-clash-neighboring-hour', { ...chart, hour: 2, natal: ['丙寅', '戊戌', '辛酉', '己丑'] });
 const nearDay = rows(near).find(row => row.normalizedPayload.annualPillar === '乙卯' && row.normalizedPayload.luckPillar === '癸卯');
 assert.ok(nearDay);
 assert.deepEqual(nearDay.normalizedPayload.annualJointClashTargets, ['day']);
 assert.equal(nearDay.normalizedPayload.hasZhangReviewedWealthDayClash, false);
 assert.equal(result(near, 80).status, 'partial');
 const unknown = context(native(chart.natal), '癸卯', '乙卯', false);
 assert.equal(unknown.hasZhangReviewedWealthDayClash, undefined);

 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'zhang-reviewed-wealth-day-clash'));
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /癸卯[^\n]*实际岁支也是卯[^\n]+\n原文：或運雖為喜而流年並沖/u);
 const actualYearAudit = /张参政原图实交癸卯运[^\n]*乙卯/u;
 assert.match(formatFortuneFactAudit(input), actualYearAudit);
 assert.doesNotMatch(prompt, actualYearAudit);
 assert.doesNotMatch(prompt, /hasZhangReviewedWealthDayClash/u);
});

test('p038 and p039 separate the simultaneous month clash from the natal meeting across the same Mao luck', () => {
 const run = submitted('meeting-and-joint-clash', ref.clashExamples.metalFull, 2035);
 const after = rows(run).find(({ normalizedPayload: p }) => p.confirmed && p.luckPillar === '丁卯' && p.annualPillar === '乙卯');
 const before = rows(run).find(row => row.activeTo === after?.activeFrom && row.normalizedPayload.luckPillar === '丁卯');
 assert.ok(before && after);
 assert.equal(before.normalizedPayload.annualPillar, '甲寅');
 assert.deepEqual(before.normalizedPayload.youSourceMeetingRoutes, ['natal-si-you-chou']);
 assert.deepEqual(after.normalizedPayload.youSourceMeetingRoutes, []);
 assert.ok(after.normalizedPayload.youSourceReliefRoutes.includes('natal-si-you-chou'));
 assert.deepEqual(after.normalizedPayload.annualJointClashTargets, ['month']);
 const [month] = after.normalizedPayload.movingClashes;
 assert.deepEqual([month.natal.pillar, month.luck.pillar, month.annual.pillar], ['辛酉', '丁卯', '乙卯']);

 const meeting = result(run, 81), clash = result(run, 80);
 assert.equal(meeting.status, 'matched');
 assert.equal(meeting.matchedSourceExcerpt, '有會合');
 assert.deepEqual(meeting.windows, [{ start: before.activeFrom, endExclusive: before.activeTo }]);
 assert.deepEqual(meeting.candidateWindows, [{ start: after.activeFrom, endExclusive: after.activeTo }]);
 assert.equal(clash.status, 'matched');
 assert.equal(clash.matchedSourceExcerpt, '流年並沖');
 assert.deepEqual(clash.windows, [{ start: after.activeFrom, endExclusive: after.activeTo }]);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'same-luck-different-source-findings'));
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /只确认本命金组会位.*实际能否解冲仍须核/u);
 assert.match(prompt, /确认流年并冲的月令位置.*实际轻重仍须核/u);
 assert.doesNotMatch(prompt, /運雖為喜|因有會合解沖也|youSourceMeetingRoutes/u);
});

test('p039 preserves the intervening natal Yin and confirms an adjacent Si-You only before a separate annual clash', () => {
 const separated = ref.clashExamples.metalPair;
 const separatedRun = submitted('shen-si-you-separated-by-yin', separated);
 const separatedFact = rows(separatedRun).find(row => row.normalizedPayload.luckPillar === '癸卯'
  && row.normalizedPayload.annualPillar === '戊申');
 assert.ok(separatedFact);
 const separatedData = separatedFact.normalizedPayload;
 assert.deepEqual(separatedData.youClashReliefRoutes, ['si-you']);
 assert.deepEqual(separatedData.youSourceMeetingRoutes, []);
 const { month, intervening, si } = separatedData.youSiMeetingSeparatedByYin;
 assert.deepEqual([month, intervening, si].map(row => [row.position, row.pillar]),
  [['month', '己酉'], ['day', '甲寅'], ['hour', '己巳']]);
 const isolated = { ...separatedRun, facts: [separatedFact] };
 const separatedMatch = result(isolated, 81);
 assert.equal(separatedMatch.status, 'partial');
 assert.ok(!separatedMatch.matchedSourceExcerpt);
 assert.deepEqual(separatedMatch.windows, [{ start: separatedFact.activeFrom, endExclusive: separatedFact.activeTo }]);
 assert.equal(context(native(separated.natal), '癸卯', '戊申', false).youSiMeetingSeparatedByYin, undefined);
 const separatedInput = buildFortuneModelContext(isolated,
  interpretFortune(isolated, requestForFortuneRun(isolated), 'shen-si-you-separated-by-yin')).input;
 const separatedAudit = formatFortuneFactAudit(separatedInput);
 assert.match(separatedAudit, /甲寅隔在.*按徐注此路仅留巳酉会位候选/u);
 assert.doesNotMatch(separatedAudit, /时柱见巳，与月酉相会/u);
 assert.doesNotMatch(formatFortunePrompt(separatedInput), /按徐注此路仅留巳酉会位候选|原文：有會合/u);

 const withWei = { date: [2015, 10, 5], hour: 10, gender: 0, year: 2068, natal: ['乙未', '乙酉', '甲寅', '己巳'] };
 const withWeiRun = submitted('shen-si-you-separated-with-an-independent-wei', withWei);
 const withWeiFact = rows(withWeiRun).find(row => row.normalizedPayload.luckPillar === '辛卯'
  && row.normalizedPayload.annualPillar === '戊子');
 assert.ok(withWeiFact);
 assert.equal(withWeiFact.normalizedPayload.youSiMeetingSeparatedByYin?.intervening.pillar, '甲寅');
 assert.deepEqual(withWeiFact.normalizedPayload.youSourceMeetingRoutes, ['luck-mao-with-natal-wei']);
 const withWeiHit = result({ ...withWeiRun, facts: [withWeiFact] }, 81);
 assert.equal(withWeiHit.status, 'matched');
 assert.match(withWeiHit.matchedConditions.join(''), /原局未占木组/u);

 const adjacent = { date: [1977, 9, 24], hour: 12, gender: 1, year: 2041, natal: ['丁巳', '己酉', '甲申', '庚午'] };
 const run = submitted('shen-si-you-meeting-and-annual-conflict', adjacent);
 const before = rows(run).find(row => row.normalizedPayload.luckPillar === '癸卯' && row.normalizedPayload.annualPillar === '庚申');
 const after = rows(run).find(row => row.activeFrom === before?.activeTo);
 assert.ok(before && after);
 assert.equal(after.normalizedPayload.annualPillar, '辛酉');
 assert.equal(after.normalizedPayload.luckPillar, '癸卯');
 const data = before.normalizedPayload;
 assert.deepEqual(data.youSourceRelief.nativeSi.map(row => row.position), ['year']);
 assert.equal(data.youSourceRelief.month.pillar, '己酉');
 assert.deepEqual(data.youSourceRelief.nativeChou, []);
 assert.deepEqual(data.youSourceMeetingRoutes, ['natal-si-with-month-you']);
 assert.equal(data.youSiMeetingSeparatedByYin, undefined);
 assert.deepEqual(after.normalizedPayload.youSourceMeetingRoutes, []);
 assert.ok(after.normalizedPayload.youSourceReliefRoutes.includes('natal-si-you'));
 const annualChou = context(native(adjacent.natal), '癸卯', '辛丑');
 assert.equal(annualChou.youSourceMeetingRoutes.includes('natal-si-with-month-you'), false);
 assert.equal(annualChou.youSourceReliefRoutes.includes('natal-si-you-chou'), false);
 const match = result(run, 81);
 assert.equal(match.status, 'matched');
 assert.equal(match.matchedSourceExcerpt, '有會合');
 assert.deepEqual(match.windows, [{ start: before.activeFrom, endExclusive: before.activeTo }]);
 assert.deepEqual(match.candidateWindows, [{ start: after.activeFrom, endExclusive: after.activeTo }]);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'shen-si-you-meeting-and-annual-conflict'));
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /本命巳[^\n]*月酉[^\n]+\n原文：有會合/u);
 const sourcePairAudit = /沈氏正文另列本命巳与月酉的两处会位/u;
 assert.match(formatFortuneFactAudit(input), sourcePairAudit);
 assert.doesNotMatch(prompt, sourcePairAudit);
 assert.doesNotMatch(prompt, /因有會合解沖也|natal-si-with-month-you/u);
});

test('p039 keeps both explicit stem meetings as competition while confirming an isolated Chen-You pair', () => {
 const samples = [
  { date: [1964, 10, 2], hour: 16, year: 2021, natal: ['甲辰', '癸酉', '甲申', '壬申'], luck: '己卯',
   annual: '辛丑', route: 'chen-you', partner: '辰', members: '申子辰', stems: ['癸', '壬'] },
  { date: [1946, 10, 7], hour: 2, year: 2001, natal: ['丙戌', '丁酉', '甲寅', '乙丑'], luck: '癸卯',
   annual: '辛巳', route: 'mao-xu', partner: '戌', members: '寅午戌', stems: ['丙', '丁'] },
 ];
 for (const sample of samples) {
  const run = submitted(sample.route + '-stem-meeting-competition', { ...sample, gender: 1 });
  const selected = rows(run).find(row => row.normalizedPayload.luckPillar === sample.luck
   && row.normalizedPayload.annualPillar === sample.annual);
  assert.ok(selected, sample.route);
  const data = selected.normalizedPayload;
  const route = data.youExample.liuheRoutes.find(row => row.partner === sample.partner);
  assert.ok(route);
  assert.equal(route.natalRivalComplete, false);
  assert.equal(route.natalRivalHalf, false);
  const meeting = route.natalRivalStemMeeting;
  assert.equal(meeting.branches, sample.members);
  assert.deepEqual(meeting.exposedStems.map(row => row.stem), sample.stems);
  assert.ok(!meeting.outerMembers.some(row => row.branch === meeting.center));
  assert.ok(data.youClashReliefRoutes.includes(sample.route));
  assert.ok(!data.youSourceLiuheRoutes.includes(sample.route));
  const isolated = { ...run, facts: [selected] };
  assert.equal(result(isolated, 81).status, 'partial');
  const { input } = buildFortuneModelContext(isolated,
   interpretFortune(isolated, requestForFortuneRun(isolated), 'competing-stem-meeting'));
  const local = /未见中神[^\n]*按原书保留双干会合候选/u;
  assert.match(formatFortuneFactAudit(input), local);
  assert.doesNotMatch(formatFortunePrompt(input), /原文：有會合|双干会合候选/u);
 }
 const sample = samples[0];
 const near = submitted('chen-you-one-water-stem', { ...sample, hour: 12, gender: 1, natal: ['甲辰', '癸酉', '甲申', '庚午'] });
 const chosen = rows(near).find(row => row.normalizedPayload.luckPillar === sample.luck && row.normalizedPayload.annualPillar === sample.annual);
 assert.ok(chosen);
 assert.equal(chosen.normalizedPayload.youExample.liuheRoutes[0].natalRivalStemMeeting, undefined);
 assert.deepEqual(chosen.normalizedPayload.youSourceLiuheRoutes, ['chen-you']);
 assert.equal(result({ ...near, facts: [chosen] }, 81).matchedSourceExcerpt, '有會合');
});

test('p039 distinguishes natal Lu substitute meetings from isolated 六合 and independent half meetings', () => {
 const samples = [
  { date: [1964, 10, 2], hour: 22, nearHour: 12, gender: 1, year: 2021, luck: '己卯', annual: '辛丑',
   natal: ['甲辰', '癸酉', '甲申', '乙亥'], nearPillar: '庚午', partner: '辰', route: 'chen-you',
   branches: '申子辰', center: '子', lu: '亥', annualLu: '己亥', half: 'luck-mao-with-natal-hai',
   formerConfirmation: /原局相邻一柱的辰与月酉六合/u },
  { date: [1958, 10, 4], hour: 10, nearHour: 2, gender: 0, year: 2020, luck: '乙卯', annual: '庚子',
   natal: ['戊戌', '辛酉', '甲寅', '己巳'], nearPillar: '乙丑', partner: '戌', route: 'mao-xu',
   branches: '寅午戌', center: '午', lu: '巳', annualLu: '癸巳',
   formerConfirmation: /同时与原局唯一戌六合/u },
 ];
 for (const sample of samples) {
  const isolate = (example, name) => {
   const run = submitted(sample.route + name, example);
   const row = rows(run).find(f => f.normalizedPayload.luckPillar === sample.luck && f.normalizedPayload.annualPillar === sample.annual);
   assert.ok(row, sample.route);
   return { data: row.normalizedPayload, run: { ...run, facts: [row] } };
  };
  const { data, run } = isolate(sample, '-natal-lu-competition');
  const route = data.youExample.liuheRoutes.find(item => item.partner === sample.partner);
  assert.equal(route.natalRivalComplete, false);
  assert.equal(route.natalRivalHalf, false);
  assert.equal(route.natalRivalStemMeeting, undefined);
  const { branches, center, outerMembers, luMembers } = route.natalRivalLuMeeting;
  assert.deepEqual([branches, center], [sample.branches, sample.center]);
  assert.deepEqual(outerMembers.map(row => [row.position, row.pillar]), [['year', sample.natal[0]], ['day', sample.natal[2]]]);
  assert.deepEqual(luMembers.map(row => [row.position, row.branch]), [['hour', sample.lu]]);
  assert.ok(data.youClashReliefRoutes.includes(sample.route));
  assert.ok(!data.youSourceLiuheRoutes.includes(sample.route));
  assert.deepEqual(data.youSourceMeetingRoutes, sample.half ? [sample.half] : []);
  const hit = result(run, 81);
  assert.equal(hit.status, sample.half ? 'matched' : 'partial');
  if (sample.half) assert.equal(hit.matchedSourceExcerpt, '有會合');
  else assert.equal(data.youSiMeetingSeparatedByYin?.intervening.pillar, '甲寅');
  const inputFor = isolated => buildFortuneModelContext(isolated,
   interpretFortune(isolated, requestForFortuneRun(isolated), 'natal-lu-competition')).input;
  const input = inputFor(run);
  const local = new RegExp('未见中神' + sample.center + '，原局却见本命时柱' + sample.natal[3]
   + '的禄位，按卷二保留会意与同一' + (sample.partner === '辰' ? '辰酉' : '卯戌') + '六合竞争', 'u');
  assert.match(formatFortuneFactAudit(input), local);
  const prompt = formatFortunePrompt(input);
  assert.doesNotMatch(prompt, sample.formerConfirmation);
  assert.doesNotMatch(prompt, local);
  const nearNatal = [...sample.natal.slice(0, 3), sample.nearPillar];
  const near = isolate({ ...sample, hour: sample.nearHour, natal: nearNatal }, '-without-natal-lu');
  assert.equal(near.data.youExample.liuheRoutes[0].natalRivalLuMeeting, undefined);
  assert.ok(near.data.youSourceLiuheRoutes.includes(sample.route));
  assert.match(formatFortunePrompt(inputFor(near.run)), sample.formerConfirmation);
  const onlyAnnualLu = context(native(nearNatal), sample.luck, sample.annualLu);
  assert.equal(onlyAnnualLu.youExample.liuheRoutes[0].natalRivalLuMeeting, undefined);
  assert.equal(context(native(sample.natal), sample.luck, sample.annual, false).youExample.liuheRoutes, undefined);
 }
});

test('p040 binds Yi and both natal Shen to the confirmed Yin luck interval', () => {
 const run = submitted('shenYinOfficer', ref.clashExamples.shenYinOfficer, 2026);
 const hit = result(run, 82);
 assert.equal(hit.status, 'matched');
 const transition = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '丙寅');
 assert.ok(transition);
 assert.equal(hit.windows[0].start, transition.exactInstant);
 const before = rows(run).findLast(row => row.normalizedPayload.luckPillar === '丁卯' && row.activeTo === transition.exactInstant);
 assert.ok(before);
 const natalContacts = before.normalizedPayload.shenYinOfficerContext;
 assert.deepEqual(natalContacts.nativeOfficerGeng.map(row => [row.position, row.pillar, row.stem, row.tenGod]),
  [['month', '壬申', '庚', '正官'], ['hour', '甲申', '庚', '正官']]);
 assert.deepEqual(natalContacts.betweenOfficers.map(row => row.pillar), ['乙酉']);
 assert.deepEqual([natalContacts.natalYinJia.pillar, natalContacts.natalYinJia.stem, natalContacts.natalYinJia.tenGod], ['甲寅', '甲', '劫财']);
 assert.equal(natalContacts.luckYinJia, undefined);
 assert.equal(before.normalizedPayload.hasShenYinOfficerPairings, false);
 for (const id of hit.sourceFactIds) {
  const fact = rows(run).find(row => row.factId === id);
  assert.equal(fact.normalizedPayload.dayMaster, '乙');
  assert.equal(fact.normalizedPayload.twoClashPairings.length, 2);
  assert.equal(fact.normalizedPayload.hasShenYinOfficerPairings, true);
  const arriving = fact.normalizedPayload.shenYinOfficerContext.luckYinJia;
  assert.deepEqual([arriving.position, arriving.pillar, arriving.stem, arriving.tenGod], ['decadal', '丙寅', '甲', '劫财']);
  assert.match(describeFortuneFact({ method: 'bazi', type: fact.factType, data: fact.normalizedPayload }, String),
   /乙日原局两申的本气庚为正官，本步大运再见寅，尚须核是否取申官为用/u);
 }
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'shen-yin-officer-change'));
 const previous = input.facts.find(row => row.type === 'zpqz_moving_relations' && row.endExclusive === transition.exactInstant
  && row.data.luckPillar === '丁卯');
 const prompt = formatFortuneFactAudit(input);
 assert.match(describeFortuneFact(previous, String), /本命月柱壬申藏庚正官、本命时柱甲申藏庚正官分别对同一个本命年柱甲寅藏甲劫财/u);
 assert.match(prompt, /本步大运丙寅藏甲劫财是实际新增的运寅甲/u);
 assert.doesNotMatch(prompt, /shenYinOfficerContext|hasShenYinOfficerPairings/u);
});

test('p040 keeps adjacent Shen, visible Geng, and an annual Yin distinct from the incoming luck Yin', () => {
 const adjacent = { date: [1968, 8, 13], hour: 4, gender: 0, year: 2022, natal: ['戊申', '庚申', '乙卯', '戊寅'] };
 const run = submitted('adjacent-shen-exposed-geng', adjacent), hit = result(run, 82);
 const fact = rows(run).find(row => row.normalizedPayload.luckPillar === '甲寅' && hit.sourceFactIds.includes(row.factId));
 assert.equal(hit.status, 'matched');
 assert.ok(fact);
 const p = fact.normalizedPayload.shenYinOfficerContext;
 assert.deepEqual(p.betweenOfficers, []);
 assert.deepEqual(p.exposedOfficers.map(row => [row.position, row.pillar]), [['month', '庚申']]);
 const description = describeFortuneFact({ method: 'bazi', type: fact.factType, data: fact.normalizedPayload }, String);
 assert.match(description, /两处本命申相邻/u);
 assert.match(description, /原局庚明透于本命月柱庚申/u);
 const example = ref.clashExamples.shenYinOfficer, annualOnly = submitted('annual-yin-only', example, 2022);
 const annual = rows(annualOnly).find(row => row.normalizedPayload.annualBranch === '寅' && row.normalizedPayload.luckPillar === '丁卯');
 assert.ok(annual);
 assert.equal(annual.normalizedPayload.shenYinOfficerContext.onlyAnnualYin.pillar, '壬寅');
 assert.equal(annual.normalizedPayload.hasShenYinOfficerPairings, false);
 assert.equal(result(annualOnly, 82).status, 'not_matched');
});

test('p040 also compares Bing day and rejects a different number of natal Shen or absence of natal Yin', () => {
 const date = [1968, 8, 14];
 const cases = [
  [4, ['戊申', '庚申', '丙辰', '庚寅'], 'matched'],
  [16, ['戊申', '庚申', '丙辰', '丙申'], 'not_matched'],
  [8, ['戊申', '庚申', '丙辰', '壬辰'], 'not_matched'],
 ];
 for (const [hour, natal, expected] of cases) {
  const run = submitted('shen-yin-bing-' + hour, { date, hour, gender: 0, year: 2022, natal });
  const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '甲寅');
  assert.ok(fact);
  const hit = result(run, 82), data = fact.normalizedPayload;
  assert.equal(hit.status, expected);
  assert.equal(data.shenYinOfficerContext, undefined);
  assert.equal(data.hasShenYinClashPairings, expected === 'matched');
  assert.equal(hit.sourceFactIds.includes(fact.factId), expected === 'matched');
  if (expected === 'matched') {
   const { nativeGeng, natalYinJia, luckYinJia } = data.shenYinClashComparison;
   assert.deepEqual(nativeGeng.map(row => [row.position, row.stem, row.tenGod]), [['year', '庚', '偏财'], ['month', '庚', '偏财']]);
   assert.deepEqual([natalYinJia.pillar, luckYinJia.pillar], ['庚寅', '甲寅']);
   assert.deepEqual(data.twoClashPairings.map(row => row.pairs.map(pair => [pair.shen.position, pair.yin.position])),
    [[['year', 'hour'], ['month', 'decadal']], [['year', 'decadal'], ['month', 'hour']]]);
   const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'shen-yin-bing'));
   const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
   assert.deepEqual(finding?.windows, hit.windows);
   const audit = formatFortuneFactAudit(input);
   assert.match(audit, /本命年柱戊申藏庚偏财、本命月柱庚申藏庚偏财分别对同一个本命时柱庚寅藏甲偏印/u);
   assert.match(audit, /一对一配对候选2/u);
   assert.doesNotMatch(audit, /乙日原局两申的本气庚为正官|shenYinClashComparison/u);
  }
 }
});

test('the Chen source table and prose retain independent half-open Qingming periods', () => {
 const dayMs = 86_400_000;
 const month = Solar.fromYmdHms(2026, 4, 11, 10, 0, 0).getLunar();
 const atJie = jie => Date.parse(jie.getSolar().toYmdHms().replace(' ', 'T') + '+08:00');
 const qingming = atJie(month.getPrevJie());
 const lixia = atJie(month.getNextJie());
 assert.ok(qingming + 30 * dayMs < lixia);
 for (const [offset, stem, tableYi, proseYi] of [
  [0, '乙', true, true], [9 * dayMs - 1, '乙', true, true], [9 * dayMs, '癸', false, true],
  [12 * dayMs - 1, '癸', false, true], [12 * dayMs, '戊', false, false], [30 * dayMs - 1, '戊', false, false],
  [30 * dayMs, undefined, false, false],
 ]) {
  const timing = zpqzChenBirthTiming(new Date(qingming + offset).toISOString());
  assert.deepEqual([timing.tableDutyStem, timing.tableYiOnDuty, timing.proseYiOnDuty], [stem, tableYi, proseYi], offset);
 }
 assert.equal(zpqzChenBirthTiming(new Date(qingming - 1).toISOString()), undefined);
 assert.equal(zpqzChenBirthTiming(new Date(lixia).toISOString()), undefined);
 assert.equal(zpqzChenBirthTiming('invalid'), undefined);
});

test('p041 binds the Chen-only natal water roots to actual Shen or Zi luck', () => {
 const cases = [
  ['renShen', true, '壬', undefined], ['chenRen', true, '癸', undefined],
  ['renHai', false, '壬', '亥'], ['renOtherWater', false, '癸', '丑'],
 ];
 for (const [name, chenOnly, incomingStem, otherRoot] of cases) {
  const e = ref.chenExamples[name] ?? ref.calendarExamples[name], run = submitted(name, e);
  const fact = rows(run).find(row => row.normalizedPayload.luckPillar === e.luck && row.normalizedPayload.confirmed);
  assert.ok(fact, name);
  const data = fact.normalizedPayload;
  assert.equal(data.renRootsConfinedToChen, chenOnly, name);
  const incoming = data.renRootsWithLuck.find(row => row.position === 'decadal');
  assert.deepEqual(incoming.hiddenStems, [incomingStem]);
  assert.equal(incoming.exactStem, incomingStem === '壬');
  if (otherRoot) assert.ok(data.renRootsWithLuck.some(row => row.position !== 'decadal' && row.branch === otherRoot));
  assert.equal(data.hasDingChenOfficerRootArrival, chenOnly);
  if (chenOnly) {
   const { natal: natalRoot, arriving, incomingClashes, birthTiming } = data.dingChenOfficerRootArrival;
   assert.deepEqual([natalRoot.position, natalRoot.renPhase, natalRoot.exactStem, natalRoot.hiddenStems], ['month', '墓', false, ['癸']]);
   assert.deepEqual([arriving.position, arriving.renPhase, arriving.hiddenStems],
    ['decadal', incomingStem === '壬' ? '长生' : '帝旺', [incomingStem]]);
   assert.deepEqual(natalRoot.hiddenRoles, [{ stem: '癸', tenGod: '七杀', mainQi: false }]);
   assert.deepEqual(arriving.hiddenRoles, [{ stem: incomingStem, tenGod: incomingStem === '壬' ? '正官' : '七杀', mainQi: incomingStem === '癸' }]);
   assert.equal(birthTiming.tableDutyStem, name === 'renShen' ? '乙' : '癸');
   assert.deepEqual(incomingClashes.map(row => [row.position, row.pillar]), name === 'renShen' ? [['hour', '壬寅']] : []);
   assert.equal(data.chenMonthClashes.month.pillar, e.natal[1]);
   assert.deepEqual(data.chenMonthClashes.opposing.map(row => [row.position, row.pillar]), [['year', e.natal[0]]]);
  }
  const match = result(run, 83);
  assert.equal(match.status, chenOnly ? 'partial' : 'not_matched', name);
  assert.equal(match.sourceFactIds.includes(fact.factId), chenOnly, name);
  if (name === 'renShen') {
   const transition = run.facts.find(f => f.factType === 'luck_transition' && f.normalizedPayload.toPillar === e.luck);
   assert.ok(transition);
   assert.equal(match.windows[0].start, transition.exactInstant);
   const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'chen-officer-root'));
   const prompt = formatFortuneFactAudit(input);
   assert.match(prompt, /原局水根限于辰库，申运另见壬的同干根位/u);
   assert.match(prompt, /本命月柱庚辰为墓位，实藏癸水。本步大运壬申为长生位，实际根位是申中同干壬/u);
   assert.match(prompt, /本步大运壬申的运支同时冲本命时柱壬寅/u);
   assert.match(prompt, /本命年柱庚戌冲本命月柱庚辰/u);
   assert.doesNotMatch(prompt, /dingChenOfficerRootArrival|incomingClashes/u);
  }
 }
});

test('p041 separates the sole Shen root clash from an annual water meeting across the same luck', async () => {
 const run = submitted('renShenAtLiChun', {
  date: [1931, 4, 22], hour: 4, gender: 1, year: 2009, luck: '甲申',
  natal: ['辛未', '壬辰', '丁未', '壬寅'],
 });
 const stage = rows(run).filter(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '甲申');
 const before = stage.find(row => row.normalizedPayload.annualPillar === '戊子');
 const after = stage.find(row => row.normalizedPayload.annualPillar === '己丑');
 assert.ok(before && after);
 assert.equal(before.activeTo, after.activeFrom);
 for (const row of [before, after]) {
  const data = row.normalizedPayload;
  assert.equal(data.hasDingChenOfficerRootArrival, true);
  assert.equal(data.dingChenOfficerRootArrival.arriving.exactStem, true);
  assert.equal(data.shenRootOpposition.clash.natal.pillar, '壬寅');
  assert.equal(data.shenRootOpposition.clash.luck.pillar, '甲申');
  assert.deepEqual(data.shenRootOpposition.combinations, []);
 }
 assert.equal(before.normalizedPayload.dingChenRootClashUnsupported, false);
 assert.deepEqual(before.normalizedPayload.shenRootOpposition.meetings.map(group => [group.values, group.byBranch]), [
  ['申子辰', [['decadal'], ['annual'], ['month']]],
 ]);
 assert.equal(after.normalizedPayload.dingChenRootClashUnsupported, true);
 assert.deepEqual(after.normalizedPayload.shenRootOpposition.meetings, []);
 assert.deepEqual(after.normalizedPayload.shenRootOpposition.middleBranches, []);
 const found = result(run, 83);
 assert.equal(found.status, 'partial');
 assert.ok(found.sourceFactIds.includes(before.factId));
 assert.ok(!found.sourceFactIds.includes(after.factId));
 assert.equal(found.windows[0].endExclusive, before.activeTo);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'shen-root-li-chun'));
 const evidence = /同段未核到六合、完整会局或中神见位，排除申根稳固的候选/u;
 assert.match(formatFortuneFactAudit(input), evidence);
 assert.doesNotMatch(formatFortunePrompt(input), evidence);

 const annualOnly = submitted('renShenAnnualClash', {
  date: [1931, 4, 22], hour: 8, gender: 1, year: 2010, luck: '甲申',
  natal: ['辛未', '壬辰', '丁未', '甲辰'],
 });
 const select = pillar => rows(annualOnly).find(row => row.normalizedPayload.confirmed
  && row.normalizedPayload.luckPillar === '甲申' && row.normalizedPayload.annualPillar === pillar);
 const beforeAnnual = select('己丑'), afterAnnual = select('庚寅');
 assert.ok(beforeAnnual && afterAnnual);
 assert.equal(beforeAnnual.activeTo, afterAnnual.activeFrom);
 assert.equal(beforeAnnual.normalizedPayload.shenRootOpposition, undefined);
 assert.equal(beforeAnnual.normalizedPayload.dingChenUnopposedRootArrival, true);
 assert.equal(afterAnnual.normalizedPayload.shenRootOpposition.clash, undefined);
 const { annualClash, combinations, meetings, middleBranches } = afterAnnual.normalizedPayload.shenRootOpposition;
 assert.deepEqual([annualClash.annual.position, annualClash.annual.pillar, annualClash.luck.position, annualClash.luck.pillar],
  ['annual', '庚寅', 'decadal', '甲申']);
 assert.deepEqual([combinations, meetings, middleBranches], [[], [], []]);
 assert.equal(afterAnnual.normalizedPayload.hasDingChenOfficerRootArrival, true);
 assert.equal(afterAnnual.normalizedPayload.dingChenRootClashUnsupported, true);
 assert.equal(afterAnnual.normalizedPayload.dingChenUnopposedRootArrival, false);
 const annualResult = result(annualOnly, 83);
 assert.equal(annualResult.status, 'matched');
 assert.equal(annualResult.matchedSourceExcerpt, '運逢申子');
 assert.ok(annualResult.sourceFactIds.includes(beforeAnnual.factId));
 assert.ok(!annualResult.sourceFactIds.includes(afterAnnual.factId));
 assert.deepEqual(annualResult.windows, [{ start: beforeAnnual.activeFrom, endExclusive: afterAnnual.activeFrom }]);
 const { input: annualInput } = buildFortuneModelContext(annualOnly,
  interpretFortune(annualOnly, requestForFortuneRun(annualOnly), 'zpqz-annual-shen-root-clash'));
 const annualEvidence = /本段太岁庚寅六冲本步大运甲申的申长生根/u;
 assert.match(formatFortuneFactAudit(annualInput), annualEvidence);
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
  const message = JSON.parse(options.body).messages[1].content;
  assert.match(message, /实际申运另添申中同干壬/u);
  assert.doesNotMatch(message, /則官星根固而力顯/u);
  assert.doesNotMatch(message, annualEvidence);
  assert.doesNotMatch(message, /shenRootOpposition|annualClash/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(annualInput);
});

test('p041 keeps the original Shen root and a new Zi root separate when the actual year reaches Yin', () => {
 const e = { date: [1931, 4, 12], hour: 16, gender: 0, year: 2010, luck: '庚子', natal: ['辛未', '壬辰', '丁酉', '戊申'] };
 const run = submitted('original-shen-with-annual-clash', e), boundary = '2010-02-03T22:47:51.000Z';
 const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.annualPillar === '己丑');
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.annualPillar === '庚寅');
 assert.ok(before && after);
 for (const fact of [before, after]) {
  const p = fact.normalizedPayload;
  assert.equal(p.luckPillar, '庚子');
  assert.equal(p.renRootsConfinedToChen, false);
  assert.equal(p.dingChenUnopposedRootArrival, false);
  assert.equal(p.dingChenZiArrivalWithAnnualShenClash, fact === after);
  const proof = p.dingChenZiRootComparison;
  assert.deepEqual([proof.natal.position, proof.natal.renPhase, proof.natal.hiddenStems], ['month', '墓', ['癸']]);
  assert.deepEqual([proof.originalShen.position, proof.originalShen.renPhase, proof.originalShen.hiddenStems, proof.originalShen.exactStem],
   ['hour', '长生', ['壬'], true]);
  assert.deepEqual([proof.arriving.position, proof.arriving.renPhase, proof.arriving.hiddenRoles],
   ['decadal', '帝旺', [{ stem: '癸', tenGod: '七杀', mainQi: true }]]);
  assert.deepEqual(proof.incomingClashes, []);
  assert.equal(proof.annualClash?.pillar, fact === after ? '庚寅' : undefined);
  const isolated = { ...run, facts: [fact] };
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'chen-competing-roots'));
  const audit = /太岁庚寅六冲原局.*同一步庚子运另见子中本气癸水/u;
  assert.equal(audit.test(formatFortuneFactAudit(input)), fact === after);
  const prompt = formatFortunePrompt(input);
  assert.equal(/太岁寅六冲原有申根/u.test(prompt), fact === after);
  assert.doesNotMatch(prompt, /則官星根固而力顯|dingChenZiRootComparison/u);
  assert.doesNotMatch(prompt, audit);
 }
 const hit = result(run, 83);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '運逢申子');
 assert.deepEqual(hit.sourceFactIds, [after.factId]);
 assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: after.activeTo }]);
 assert.equal(context(native(e.natal), '庚子', '庚寅', false).dingChenZiArrivalWithAnnualShenClash, undefined);
});

test('p041 keeps explicit water stems after the annual middle branch leaves the clashed Shen luck', () => {
 const e = { date: [1943, 4, 9], hour: 4, gender: 0, year: 1985, luck: '庚申', natal: ['癸未', '丙辰', '丁酉', '壬寅'] };
 const run = submitted('shen-root-stem-meeting', e);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '庚申' && row.normalizedPayload.annualPillar === '乙丑');
 const before = rows(run).find(row => row.activeTo === after?.activeFrom && row.normalizedPayload.luckPillar === '庚申');
 assert.ok(before && after);
 const initial = before.normalizedPayload.shenRootOpposition;
 assert.equal(before.normalizedPayload.annualPillar, '甲子');
 assert.ok(initial.meetings.some(group => group.values === '申子辰'));
 assert.equal(initial.stemSubstituteMeeting, undefined);
 const data = after.normalizedPayload;
 assert.equal(data.dingChenUnopposedRootArrival, false);
 assert.equal(data.dingChenRootClashUnsupported, false);
 const opposition = data.shenRootOpposition;
 assert.deepEqual(opposition.meetings, []);
 assert.deepEqual(opposition.combinations, []);
 assert.deepEqual(opposition.middleBranches, []);
 const meeting = opposition.stemSubstituteMeeting;
 assert.equal(meeting.branches, '申子辰');
 assert.deepEqual(meeting.outerMembers.map(row => [row.position, row.branch]), [['month', '辰'], ['decadal', '申']]);
 assert.deepEqual(meeting.exposedStems.map(row => [row.position, row.stem]), [['year', '癸'], ['hour', '壬']]);
 const isolated = { ...run, facts: [after] };
 assert.equal(result(isolated, 83).status, 'partial');
 const { input } = buildFortuneModelContext(isolated,
  interpretFortune(isolated, requestForFortuneRun(isolated), 'shen-root-stem-meeting'));
 assert.match(formatFortuneFactAudit(input), /未见中神子[^\n]*按原书保留双干会合候选/u);
 assert.doesNotMatch(formatFortunePrompt(input), /運逢申子|則官星根固而力顯|双干会合候选/u);
});

test('p041 verifies the same natal Zi root and incoming Shen when the actual year changes to Wu', () => {
 const e = { date: [1931, 4, 22], hour: 0, gender: 1, year: 2014, luck: '甲申', natal: ['辛未', '壬辰', '丁未', '庚子'] };
 const run = submitted('original-zi-with-annual-clash', e);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '甲申' && row.normalizedPayload.annualPillar === '甲午');
 const before = rows(run).find(row => row.activeTo === after?.activeFrom && row.normalizedPayload.luckPillar === '甲申');
 assert.ok(before && after);
 assert.equal(before.normalizedPayload.annualPillar, '癸巳');
 assert.equal(before.normalizedPayload.dingChenShenArrivalWithAnnualZiClash, false);
 assert.equal(after.normalizedPayload.dingChenShenArrivalWithAnnualZiClash, true);
 const comparison = after.normalizedPayload.dingChenShenRootComparison;
 assert.deepEqual([comparison.natal.position, comparison.natal.renPhase], ['month', '墓']);
 assert.deepEqual([comparison.originalZi.position, comparison.originalZi.renPhase, comparison.originalZi.hiddenStems], ['hour', '帝旺', ['癸']]);
 assert.deepEqual([comparison.arriving.position, comparison.arriving.renPhase, comparison.arriving.hiddenStems], ['decadal', '长生', ['壬']]);
 assert.equal(comparison.annualClash.pillar, '甲午');
 assert.deepEqual(comparison.incomingClashes, []);
 const hit = result(run, 83);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '運逢申子');
 assert.deepEqual(hit.windows, [{ start: after.activeFrom, endExclusive: after.activeTo }]);
 assert.equal(result({ ...run, facts: [before] }, 83).status, 'not_matched');
 const { input } = buildFortuneModelContext(run,
  interpretFortune(run, requestForFortuneRun(run), 'shen-root-original-zi'));
 const local = /太岁甲午六冲原局的[^\n]*庚子[^\n]*子根，同一步甲申运另见申中壬长生根/u;
 assert.match(formatFortuneFactAudit(input), local);
 assert.match(formatFortunePrompt(input), /原文：運逢申子/u);
 assert.doesNotMatch(formatFortunePrompt(input), local);
 assert.equal(context(native(e.natal), '甲申', '甲午', false).dingChenShenArrivalWithAnnualZiClash, undefined);
});

test('p041 separates the original Hai Lu and incoming Zi root at the actual Si year boundary', () => {
 const e = { date: [1931, 4, 12], hour: 22, gender: 0, year: 2013, luck: '庚子', natal: ['辛未', '壬辰', '丁酉', '辛亥'] };
 const run = submitted('geng-zi-with-hai-lu-clash', e);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '庚子' && row.normalizedPayload.annualPillar === '癸巳');
 const before = rows(run).find(row => row.activeTo === after?.activeFrom && row.normalizedPayload.luckPillar === '庚子');
 assert.ok(before && after);
 assert.equal(after.activeFrom, '2013-02-03T16:13:25.000Z');
 assert.equal(before.normalizedPayload.annualPillar, '壬辰');
 assert.equal(before.normalizedPayload.dingChenZiArrivalWithAnnualHaiClash, false);
 assert.equal(after.normalizedPayload.dingChenZiArrivalWithAnnualHaiClash, true);
 const comparison = after.normalizedPayload.dingChenHaiRootComparison;
 assert.deepEqual([comparison.natal.position, comparison.natal.renPhase], ['month', '墓']);
 assert.deepEqual([comparison.originalHai.position, comparison.originalHai.pillar, comparison.originalHai.renPhase,
  comparison.originalHai.hiddenStems], ['hour', '辛亥', '临官', ['壬']]);
 assert.deepEqual([comparison.arriving.position, comparison.arriving.pillar, comparison.arriving.renPhase,
  comparison.arriving.hiddenStems, comparison.arriving.exactStem], ['decadal', '庚子', '帝旺', ['癸'], false]);
 assert.equal(comparison.annualClash.pillar, '癸巳');
 assert.deepEqual(comparison.incomingClashes, []);
 assert.equal(after.normalizedPayload.dingChenUnopposedRootArrival, false);
 const hit = result(run, 83);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '運逢申子');
 const stage = rows(run).filter(row => row.normalizedPayload.luckPillar === '庚子' && row.normalizedPayload.annualPillar === '癸巳');
 assert.ok(stage.every(row => row.normalizedPayload.dingChenZiArrivalWithAnnualHaiClash === true));
 assert.deepEqual(hit.windows, [{ start: after.activeFrom, endExclusive: stage.at(-1).activeTo }]);
 assert.equal(result({ ...run, facts: [before] }, 83).status, 'not_matched');
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'hai-lu-zi-root'));
 const local = /太岁癸巳六冲原局的辛亥藏壬根，同一步庚子运另见子中本气癸水/u;
 assert.match(formatFortuneFactAudit(input), local);
 const provider = formatFortunePrompt(input);
 assert.match(provider, /同一实际流年的巳支直接冲该亥[^\n]*首藏癸为同五行水根/u);
 assert.match(provider, /原文：運逢申子/u);
 assert.doesNotMatch(provider, /則官星根固而力顯|dingChenHaiRootComparison/u);
 assert.doesNotMatch(provider, local);
 assert.equal(context(native(e.natal), '庚子', '癸巳', false).dingChenZiArrivalWithAnnualHaiClash, undefined);
});

test('p041 confirms the Zi main-qi root only after the verified Geng-Zi arrival', () => {
 const e = { date: [1931, 4, 12], hour: 8, gender: 0, year: 2009, luck: '庚子', natal: ['辛未', '壬辰', '丁酉', '甲辰'] };
 const run = submitted('unopposed-geng-zi', e);
 const boundary = '2009-06-12T18:00:00.000Z';
 const before = rows(run).find(row => row.activeTo === boundary);
 const after = rows(run).find(row => row.activeFrom === boundary);
 assert.equal(before.normalizedPayload.luckPillar, '己亥');
 assert.equal(before.normalizedPayload.dingChenUnopposedRootArrival, false);
 const payload = after.normalizedPayload;
 assert.equal(payload.luckPillar, '庚子');
 assert.equal(payload.dingChenUnopposedRootArrival, true);
 assert.deepEqual(payload.dingChenOfficerRootArrival.arriving.hiddenRoles, [{ stem: '癸', tenGod: '七杀', mainQi: true }]);
 const hit = result(run, 83);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '運逢申子');
 assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: after.activeTo }]);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'unopposed-zi-root'));
 assert.match(formatFortunePrompt(input), /实际子运添支本气癸水/u);
 assert.doesNotMatch(formatFortunePrompt(input), /实际申运另添|則官星根固而力顯/u);
 assert.equal(context(native(e.natal), '庚子', '己丑', false).dingChenUnopposedRootArrival, undefined);
});

test('p042 admits one newly exposed seal from the natal water group when both seal kinds were already present', () => {
 const variants = {
  sealFullGroup: { ...ref.calendarExamples.chenWater, hour: 0, natal: ['壬申', '甲辰', '乙卯', '丙子'] },
  sealSingleKind: { ...ref.chenExamples.sealNewGuiFromZi, date: [1984, 4, 21], year: 2030,
   natal: ['甲子', '戊辰', '乙酉', '庚辰'] },
 };
 const cases = [
  ['chenWater', 'matched', [['month', '癸']], true],
  ['sealNewRen', 'matched', [['hour', '壬']], true],
  ['sealNewGuiFromZi', 'matched', [['year', '癸'], ['month', '癸'], ['hour', '癸']], true],
  ['sealFullGroup', 'matched', [['month', '癸'], ['hour', '癸']], true],
  ['sealSingleKind', 'not_matched', [['year', '癸'], ['month', '癸'], ['hour', '癸']], true],
  ['sealExisting', 'not_matched', [['year', '癸'], ['month', '癸']], false],
  ['sealOutsideOnly', 'not_matched', [], false],
  ['sealNoAssociate', 'not_matched', [['month', '癸'], ['hour', '癸']], true],
 ];
 for (const [name, status, sources, newExposure] of cases) {
  const e = variants[name] ?? ref.chenExamples[name] ?? ref.calendarExamples[name], run = submitted(name, e);
  const fact = rows(run).find(row => row.normalizedPayload.luckPillar === e.luck && row.normalizedPayload.confirmed
   && (name !== 'chenWater' || row.normalizedPayload.annualPillar === '甲戌'));
  assert.ok(fact, name);
  const data = fact.normalizedPayload;
  assert.deepEqual(data.waterSealExposures.map(row => [row.position, row.stem]), sources, name);
  assert.equal(data.newWaterSealExposure, newExposure, name);
  const pairPresent = newExposure && name !== 'sealNoAssociate';
  assert.equal(data.waterSealExposureRoute, pairPresent ? e.luck[0] === '壬' ? 'ren-from-shen' : 'gui-from-zi-chen' : 'none');
  assert.equal(data.waterSealPromotionReady, status === 'matched', name);
  if (pairPresent) {
   const { nativeWaterGroup, natalKinds, groupKinds, newExposure: exposure } = data.yiChenNativeSeals;
   assert.deepEqual(natalKinds, name === 'sealSingleKind' ? ['偏印'] : ['正印', '偏印']);
   assert.deepEqual(groupKinds, name === 'sealNewGuiFromZi' || name === 'sealSingleKind' ? ['偏印'] : ['正印', '偏印']);
   assert.equal(nativeWaterGroup.complete, name === 'sealFullGroup');
   assert.deepEqual(nativeWaterGroup.missingBranches, name === 'sealFullGroup' ? []
    : ['sealNewGuiFromZi', 'sealSingleKind'].includes(name) ? ['申'] : ['子']);
   assert.deepEqual(exposure.sourceColumns.map(row => [row.position, row.stem]), sources);
  }
  if (name === 'sealExisting') {
   assert.ok(data.waterSealExposures.every(row => row.natalExposurePositions.join() === 'hour'));
   assert.equal(data.yiChenNativeSeals.newExposure, undefined);
  }
  if (name === 'sealOutsideOnly') {
   assert.ok(data.hiddenActivations.some(row => row.branch === '亥' && row.stem === '壬' && row.newlyExposedByLuck));
   assert.equal(data.yiChenNativeSeals.newExposure, undefined);
   assert.deepEqual(data.chenMonthClashes.opposing.map(row => [row.position, row.pillar]), [['decadal', '壬戌']]);
  }
  const match = result(run, 84);
  assert.equal(match.status, status, name);
  assert.equal(match.sourceFactIds.includes(fact.factId), status === 'matched', name);
  if (name === 'sealNewRen' || name === 'sealNewGuiFromZi' || name === 'chenWater') {
   const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'chen-seal-exposure'));
   const prompt = formatFortuneFactAudit(input);
   const { group, outsideGroup, visible, birthTiming, newExposure: exposure } = data.yiChenNativeSeals;
   assert.equal(birthTiming.tableDutyStem, name === 'sealNewRen' ? '癸' : '乙');
   if (name === 'sealNewRen') {
    assert.deepEqual(group.map(row => [row.position, row.stem, row.tenGod, row.mainQi]),
     [['month', '癸', '偏印', false], ['hour', '壬', '正印', false]]);
    assert.deepEqual(exposure.otherExposed, []);
    assert.match(prompt, /原局申子辰组的本命时柱甲申藏壬印，与本步运干同干，该印本运首次透出/u);
    assert.match(prompt, /同组同时见正印与偏印/u);
   } else if (name === 'sealNewGuiFromZi') {
    assert.ok(group.every(row => row.stem === '癸'));
    assert.deepEqual(group.filter(row => row.mainQi).map(row => row.position), ['year']);
    assert.deepEqual(outsideGroup.map(row => [row.position, row.stem, row.tenGod]), [['day', '壬', '正印']]);
    assert.match(prompt, /当前同组仅见一种藏印/u);
    assert.match(prompt, /水组以外的原局藏印另见本命日柱乙亥藏壬正印/u);
   } else {
    assert.deepEqual(visible.map(row => [row.position, row.stem, row.tenGod]), [['year', '壬', '正印']]);
    assert.deepEqual(exposure.otherExposed, visible);
    assert.deepEqual([exposure.incoming.position, exposure.incoming.pillar, exposure.incoming.tenGod], ['decadal', '癸卯', '偏印']);
    assert.equal(data.chenMonthClashes.month.pillar, '甲辰');
    assert.deepEqual(data.chenMonthClashes.opposing.map(row => [row.position, row.pillar]), [['annual', '甲戌']]);
    assert.match(prompt, /原局已经明透的印另见本命年柱壬申透壬正印/u);
    assert.match(prompt, /本段太岁甲戌冲本命月柱甲辰/u);
    assert.match(prompt, /本步大运癸卯新透癸偏印与本命年柱壬申原透壬正印在同段并见/u);
   }
   assert.doesNotMatch(prompt, /renRootsConfinedToChen|newWaterSealExposure|waterSealExposures|yiChenNativeSeals/u);
   assert.ok(input.sections.some(section => section.findings.some(row => row.knowledgeId === match.knowledgeId)));
  }
 }
});

test('the earlier Chen water evidence remains in the provider input after the actual luck change', () => {
 const cases = [
  ['renShen', 2050, '辛未', 83, /本步大运壬申为长生位/u],
  ['sealNewRen', 2053, '辛未', 84, /原局申子辰组的本命时柱甲申藏壬印，与本步运干同干，该印本运首次透出/u],
 ];
 for (const [name, year, nextLuck, ruleIndex, evidence] of cases) {
  const example = ref.chenExamples[name], run = submitted(name, example, year);
  const before = rows(run).findLast(row => row.normalizedPayload.luckPillar === example.luck);
  const after = rows(run).find(row => row.normalizedPayload.luckPillar === nextLuck);
  const match = result(run, ruleIndex);
  assert.equal(before.activeTo, after.activeFrom);
  assert.equal(match.status, ruleIndex === 84 ? 'matched' : 'partial');
  assert.ok(match.sourceFactIds.includes(before.factId));
  assert.ok(!match.sourceFactIds.includes(after.factId));
  assert.ok(match.windows.every(window => window.endExclusive <= after.activeFrom));
  if (ruleIndex === 84) {
   assert.deepEqual(before.normalizedPayload.yiChenNativeSeals.natalKinds, after.normalizedPayload.yiChenNativeSeals.natalKinds);
   assert.equal(before.normalizedPayload.yiChenNativeSeals.newExposure.incoming.stem, '壬');
   assert.equal(after.normalizedPayload.yiChenNativeSeals.newExposure, undefined);
   assert.equal(after.normalizedPayload.waterSealPromotionReady, false);
  }
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'chen-water-transition'));
  assert.ok(input.facts.some(row => row.type === 'zpqz_moving_relations' && row.data.luckPillar === nextLuck));
  assert.match(formatFortuneFactAudit(input), evidence);
 }
});

test('actual luck transition and Li Chun cuts bound every source premise and provenance, without combining different stages or years',()=>{
 const run=real('twoShen');
 const transition=run.facts.find(f=>f.factType==='luck_transition'&&f.normalizedPayload.toPillar==='壬寅');assert.ok(transition);
 const target=rows(run).filter(f=>f.normalizedPayload.luckPillar==='壬寅');assert.ok(target.length);
 const start=target.map(f=>f.normalizedPayload.stageStart).sort()[0];
 assert.ok(result(run,79).windows.every(w=>w.start>=start));assert.ok(result(run,80).windows.every(w=>w.start>=start));
 assert.equal(transition.exactInstant,start);
 for(const row of rows(run)){
  const p=row.normalizedPayload;assert.ok(row.activeFrom>=p.stageStart);assert.ok(row.activeTo<=p.stageEnd);
  assert.ok(row.sourceFactIds.length>=2&&row.sourceFactIds.every(id=>run.rawFacts.some(raw=>raw.rawFactId===id)));
  assert.equal(p.hasAnnualJointClash,p.movingClashes.some(c=>c.annualAlsoClashes));
  const local=new Date((Date.parse(row.activeFrom)+Date.parse(row.activeTo))/2+8*3600000);
  const annual=Solar.fromYmdHms(local.getUTCFullYear(),local.getUTCMonth()+1,local.getUTCDate(),local.getUTCHours(),local.getUTCMinutes(),local.getUTCSeconds()).getLunar().getYearInGanZhiExact();
  assert.equal(p.annualPillar,annual);
 }
});

test('unknown hours, unverified luck tables and other-profile facts cannot satisfy the eight source mappings',()=>{
 const e=ref.calendarExamples.twoShen,unknown=archive(e);unknown.timeKnown=false;
 const unknownRun=calculate(unknown,e.year);assert.ok(ruleIndices.every(i=>result(unknownRun,i).status!=='matched'));
 const wrong=archive(e);wrong.bazi.rawResult[0].luckPeriods[0].ganZhi='甲子';
 assert.ok(rows(calculate(wrong,e.year)).every(row=>row.completeness==='partial'&&row.normalizedPayload.confirmed===false));
 const generic=structuredClone(real('twoShen'));generic.facts=generic.facts.filter(f=>f.factType!=='zpqz_moving_relations');assert.equal(result(generic,82).status,'unknown');
 const other=structuredClone(real('twoShen'));rows(other).forEach(f=>{f.normalizedPayload.profile='other';});assert.equal(result(other,82).status,'not_matched');
});

test('each reviewed mapping preserves the exact JSON source hash and distinguishes the rootless direction check',()=>{
 for(const i of ruleIndices){const r=fortuneKnowledge.bazi.rules[i],e=fortuneKnowledge.bazi.entries.find(e=>e.id===r.knowledgeId);
  assert.equal(r.queries.length,1);assert.equal(r.queries[0].factType,'zpqz_moving_relations');assert.equal(r.queries[0].where.profile,zpqzMovingPolicy.profile);
  assert.equal(r.unresolved.length===0,completeIndices.includes(i));
  assert.equal(r.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:e.evidence,conditions:e.conditions})).digest('hex'));
 }
 assert.equal(fortuneKnowledge.bazi.rules[84].review.sourceCorrections.originalJSONPreserved,true);
});

test('real Chinese prompt describes root distinctions, counts, both pairings and common targets, never machine JSON or partial source passages',async()=>{
 const run=real('twoShen'),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'zpqz-moving-report'));
 assert.ok(input.facts.some(f=>f.type==='zpqz_moving_relations'));
 const prompt=formatFortuneFactAudit(input);
 for(const phrase of ['完整原局确为两申一寅','一对一配对候选1','一对一配对候选2','运支无根不等于原局无根','岁运并冲的两个参与方已核','不据结构保证具体事件'])assert.ok(prompt.includes(phrase),phrase);
 for(const hidden of ['twoClashPairings','annualAlsoClashes','rootPolicy','zpqz-moving-root-clash','zpqz-moving-run','zpqz-moving-snapshot','exactTwoShenOneYin'])assert.ok(!prompt.includes(hidden),hidden);
 assert.ok(!input.sections.flatMap(s=>s.findings).some(f=>ruleIndices.some(i=>!completeIndices.includes(i)&&f.knowledgeId===fortuneKnowledge.bazi.rules[i].knowledgeId)));
 const unknown=describeFortuneFact({method:'bazi',type:'zpqz_moving_relations',data:context(p040,'壬寅','丙寅',false)},String);
 assert.match(unknown,/完整四柱总数仍未知/u);assert.ok(!/[{}\[\]]/u.test(unknown));
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});
 await provider.interpret(input);
});
