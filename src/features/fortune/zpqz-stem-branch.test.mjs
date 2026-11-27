import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Solar} from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import {describeFortuneFact,formatFortuneFactAudit, formatFortunePrompt} from './control/fortune-prompt.mjs';
import {createFortuneDeepSeek} from './server/deepseek-expression.mjs';
const {baziZpqzMovingRelations,zpqzMovingPolicy}=await import('./control/bazi-zpqz-relations.ts');
const {zpqzStemBranchPolicy}=await import('./control/bazi-zpqz-stem-branch.ts');
const {calculateFortuneFacts,validateFortuneFacts}=await import('./control/fortune-facts.ts');
const {buildFactTimeContext}=await import('./control/fact-time-context.ts');
const {buildFortuneFactSubmission}=await import('./control/fortune-fact-submission.ts');
const {bindClientFortuneRun,readClientFactTime}=await import('./server/client-facts.mjs');
const {matchFortuneKnowledge}=await import('./control/knowledge/match.ts');
const {fortuneKnowledge}=await import('./control/knowledge/catalog.ts');
const {buildFortuneModelContext}=await import('./control/fortune-model-context.ts');
const {interpretFortune,requestForFortuneRun}=await import('./control/fortune-interpretation.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/zpqz-stem-branch-reference.json',import.meta.url)));
const indices=[74,75,76,77,78,88,89,90,91,92,93,94,95],layers=['year','month','day','hour'];
const completeIndices = new Set([74, 75, 76, 77, 78, 88, 89, 90, 91, 92, 93]);
const natal=values=>Object.fromEntries(layers.map((k,i)=>[k,values[i]]));
const ctx=(i=94,luck=ref.calendarExamples[94].luck,known=true)=>baziZpqzMovingRelations(Array.isArray(i)?natal(i):natal(ref.calendarExamples[i].natal),known,luck,'甲辰');
const rows=run=>run.facts.filter(f=>f.factType==='zpqz_moving_relations');
const match=(run,i)=>matchFortuneKnowledge(run).byMethod.bazi[i];
const cache=new Map();
function stemBranchChart(e) {
 const [y,m,d]=e.date,l=Solar.fromYmdHms(y,m,d,e.hour,0,0).getLunar();
 return {timeKnown:true,bazi:{engineName:'lunar-javascript',engineVersion:'1.7.8',rulesetVersion:'utc8-jie-local-civil-late-zi-next-v1',rawResult:[{
 utc:new Date(Date.UTC(y,m-1,d,e.hour-8)).toISOString(),year:l.getYearInGanZhiExact(),month:l.getMonthInGanZhiExact(),day:l.getDayInGanZhiExact(),hour:l.getTimeInGanZhi(),
 luckPeriods:l.getEightChar().getYun(e.gender,2).getDaYun(11).slice(1).map(s=>({ganZhi:s.getGanZhi(),startAge:s.getStartAge(),endAge:s.getEndAge()})),tenGods:{},shenSha:{}}]},ziwei:{rawResult:[]},western:{rawResult:[]}};
}
function real(i){if(!cache.has(i)){const e=i==='return'?ref.returnClashCalendar:i==='wei'?ref.weiCalendar:ref.calendarExamples[i],chart=stemBranchChart(e);
 const input={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year:e.year}};
 cache.set(i,calculateFortuneFacts(input,buildFactTimeContext(input,Date.parse(e.year+'-11-19T02:00:00Z'),'server'),'stem-branch-private-run',{snapshotId:'stem-branch-private-chart',chart}));}return cache.get(i);}

function submitted(e) {
 const chart = stemBranchChart(e), birth = chart.bazi.rawResult[0];
 assert.deepEqual(layers.map(layer => birth[layer]), e.natal);
 chart.birthContext = { birthInstant: birth.utc, precision: 'minute', latitude: 39.9042, longitude: 116.4074,
  timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
 const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: e.year } };
 const ref = { snapshotId: 'stem-branch-example-' + e.date.join('-') + '-' + e.hour }, now = Date.UTC(e.year, 10, 19, 2);
 const payload = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart })));
 const run = bindClientFortuneRun(params, payload, readClientFactTime(params, payload, now), ref.snapshotId, ref);
 validateFortuneFacts(run);
 return run;
}

test('new stem/branch policy extends the existing atomic fact without replacing the earlier root/clash profile or interpreting successful effects',()=>{
 const p=ctx();assert.equal(p.profile,zpqzMovingPolicy.profile);assert.equal(p.stemBranchProfile,zpqzStemBranchPolicy.profile);
 assert.equal(p.requiredSourceEffectStillUnknown,true);assert.equal(p.stemBranchEffectsVerified,false);assert.equal(p.groups.length,4);
});

test('Ding-You month with Wu branch retains Ding companion and Ji food rather than inventing Bing robbery from the source Lu-tang label',()=>{
 const p=ctx(76,'壬午'),hidden=p.movingComponents.filter(r=>r.kind==='运支藏干');
 assert.deepEqual(hidden.map(r=>[r.stem,r.god]),[['丁','比肩'],['己','食神']]);assert.ok(!hidden.some(r=>r.stem==='丙'));
 assert.equal(p.dayLuBranch,'午');assert.equal(p.luckAtDayLu,true);assert.ok(!p.exposedComponents.some(r=>r.stem==='丁'));
 const text=describeFortuneFact({method:'bazi',type:'zpqz_moving_relations',data:p},String);for(const s of ['午藏丙劫财','丁比肩、己食神','不把午支当作丁干运','日干禄位坐标为午，本运支到此位'])assert.ok(text.includes(s),s);
});

test('Shen-Yin and You-Mao return clashes are bound to the exact pair and reject the former Shen-Mao and You-Yin false positives',()=>{
 const shen=['辛巳','己亥','壬午','戊申'],you=ref.returnClashCalendar.natal;
 assert.equal(ctx(shen,'甲寅').hasMatchingSealReturnClash,true);assert.equal(ctx(shen,'乙卯').hasMatchingSealReturnClash,false);
 assert.equal(ctx(you,'乙卯').hasMatchingSealReturnClash,true);assert.equal(ctx(you,'甲寅').hasMatchingSealReturnClash,false);
 const bad=structuredClone(real('return'));rows(bad).forEach(f=>{f.normalizedPayload.luckBranch='寅';f.normalizedPayload.hasMatchingSealReturnClash=false;});assert.equal(match(bad,89).status,'not_matched');
});

test('the real Wei branch stays a separate source condition without a fabricated return clash',()=>{
 const run=real('wei');validateFortuneFacts(run);assert.equal(match(run,89).status,'not_matched');
 const p=rows(run).find(f=>f.normalizedPayload.confirmed&&f.normalizedPayload.luckBranch==='未').normalizedPayload;assert.equal(p.hasMatchingSealReturnClash,false);assert.equal(p.returnClashes.length,0);
 assert.ok(describeFortuneFact({method:'bazi',type:'zpqz_moving_relations',data:p},String).includes('原局缺卯，列作评注虚会候选'));
});

test('unknown hour cannot prove no matching return pair, while a known actual pair stays a positive positional witness',()=>{
 const n=ref.returnClashCalendar.natal;assert.equal(ctx(n,'甲寅',false).hasMatchingSealReturnClash,undefined);
 assert.equal(ctx(n,'乙卯',false).hasMatchingSealReturnClash,true);assert.equal(ctx(n,'甲寅').hasMatchingSealReturnClash,false);
});

test('Ding-Chen source names Jia seal against arriving Wu hurt and Wu against Ren officer without asserting protection success or forcing Jia into the month stem',()=>{
 const p=ctx(88,'戊戌');assert.ok(p.natalComponentContacts.some(r=>r.from.kind==='透干'&&r.from.stem==='甲'&&r.from.position==='hour'&&r.to.kind==='运干'&&r.to.stem==='戊'&&r.relation==='克'));
 assert.ok(p.movingComponentContacts.some(r=>r.from.kind==='运干'&&r.from.stem==='戊'&&r.to.kind==='透干'&&r.to.stem==='壬'&&r.to.god==='正官'&&r.relation==='克'));
 assert.equal(p.stemBranchEffectsVerified,false);assert.equal(fortuneKnowledge.bazi.rules[88].queries[0].where.hasChenOfficerGuard,true);
});

test('p046 binds actual Jia to the same moving Wu that contacts Ren, with both Qingming readings', () => {
 for (const e of ref.chenGuardExamples) {
  const run = submitted(e), facts = rows(run).filter(f => f.normalizedPayload.confirmed && f.normalizedPayload.luckPillar === e.luck);
  assert.ok(facts.length, e.natal.join());
  const data = facts[0].normalizedPayload, guard = data.chenOfficerGuard, expected = Boolean(e.timing);
  const hit = match(run, 88);
  assert.equal(hit.status, expected ? 'matched' : 'not_matched', e.natal.join());
  assert.equal(data.hasChenOfficerGuard, expected);
  assert.equal(facts.some(f => hit.sourceFactIds.includes(f.factId)), expected);
  if (e.hiddenWuOnly) assert.ok(data.movingComponents.some(row => row.kind === '运支藏干' && row.stem === '戊'));
  if (e.annualWuOnly) assert.ok(facts.some(fact => fact.normalizedPayload.annualStem === '戊'));
  if (!expected) {
   assert.equal(guard, undefined);
   continue;
  }
  assert.deepEqual([guard.monthSeal.position, guard.monthSeal.stem, guard.monthSeal.god, guard.monthSeal.mainQi], ['month', '乙', '偏印', false]);
  assert.deepEqual([guard.monthHurt.position, guard.monthHurt.stem, guard.monthHurt.god, guard.monthHurt.mainQi], ['month', '戊', '伤官', true]);
  assert.deepEqual(guard.sealRoots.find(row => row.position === 'month').hiddenStems, ['乙']);
  assert.equal(guard.sealRoots.find(row => row.position === 'month').exactStem, false);
  assert.deepEqual(guard.monthHurtExposure.natalExposurePositions, e.priorWu ? [e.priorWu] : []);
  assert.equal(guard.monthHurtExposure.newlyExposedByLuck, !e.priorWu);
  assert.deepEqual([data.chenMonthClashes.month.position, data.chenMonthClashes.month.pillar], ['month', e.natal[1]]);
  assert.deepEqual(data.chenMonthClashes.opposing.map(row => [row.position, row.pillar]), [['decadal', '戊戌']]);
  const { birthTiming: timing } = guard;
  assert.deepEqual([timing.elapsedDay, timing.tableYiOnDuty, timing.proseYiOnDuty], e.timing);
  assert.equal(timing.tableDutyStem, { 2: '乙', 7: '乙', 12: '癸', 17: '戊' }[timing.elapsedDay]);
  const qingming = Solar.fromYmdHms(...e.date, e.hour, 0, 0).getLunar().getPrevJie();
  assert.equal(timing.qingmingAt, new Date(qingming.getSolar().toYmdHms().replace(' ', 'T') + '+08:00').toISOString());
  assert.ok(guard.sealToHurt.every(link => link.from.stem === '甲' && link.relation === '克'));
  assert.ok(guard.hurtToOfficer.every(link => link.to.stem === '壬' && link.relation === '克'));
  for (const link of guard.sealToHurt) assert.deepEqual(link.to, guard.movingHurt);
  for (const link of guard.hurtToOfficer) assert.deepEqual(link.from, guard.movingHurt);
  if (timing.elapsedDay === 12) assert.equal(guard.sealToHurt.length, 2);
  if (e.year === 2029) {
   const transition = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === e.luck);
   assert.ok(transition);
   assert.equal(hit.windows[0].start, transition.exactInstant);
   const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'chen-officer-guard'));
   const prompt = formatFortuneFactAudit(input);
   assert.ok(prompt.includes('两段以同一运干相连'));
   assert.match(prompt, /本步大运戊戌冲本命月柱壬辰/u);
   assert.ok(prompt.includes('交清明后第7日，卷一司令表列乙木九日'));
   assert.ok(prompt.includes('同卷评注另列乙木十二日'));
   assert.doesNotMatch(prompt, /chenOfficerGuard|hasChenOfficerGuard|tableYiOnDuty/u);
   const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
   assert.deepEqual(finding?.windows, hit.windows);
  }
 }
});

test('p046 keeps the earlier guard evidence when the next luck stage starts', () => {
 const run = submitted({ ...ref.chenGuardExamples[0], year: 2039 }), hit = match(run, 88);
 const transition = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '己亥');
 assert.ok(transition);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows.at(-1).endExclusive, transition.exactInstant);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'chen-guard-ending'));
 const evidence = input.facts.find(fact => fact.type === 'zpqz_moving_relations' && fact.data.luckPillar === '戊戌'
  && fact.endExclusive === transition.exactInstant);
 assert.ok(evidence);
 assert.ok(describeFortuneFact(evidence, String).includes('两段以同一运干相连'));
});

test('Ding-You Si branch keeps missing Chou separate from a real natal Chou and never requires or invents complete transformation',()=>{
 const p=ctx(77,'辛巳'),g=p.groups.find(r=>r.values==='巳酉丑');assert.equal(g.completeWithLuck,false);assert.deepEqual(g.missingInKnownPositions,['丑']);
 const withChou=ctx(['乙丑','乙酉','丁巳','庚子'],'辛巳').groups.find(r=>r.values==='巳酉丑');assert.equal(withChou.completeWithLuck,true);assert.equal(withChou.natalComplete,true);
 assert.equal(match(real(77),77).status,'matched');assert.equal(fortuneKnowledge.bazi.rules[77].queries[0].where.completeWithLuck,undefined);
});

test('p034 Wu hidden contacts and p035 Si wealth stay on their own sides of the verified luck change', () => {
 const run = submitted({ ...ref.calendarExamples[76], year: 2011 });
 const wuHit = match(run, 76), siHit = match(run, 77);
 const wuFact = rows(run).findLast(fact => wuHit.sourceFactIds.includes(fact.factId));
 const siFact = rows(run).find(fact => siHit.sourceFactIds.includes(fact.factId));
 assert.equal(wuHit.status, 'matched');
 assert.equal(siHit.status, 'matched');
 assert.equal(wuFact.activeTo, siFact.activeFrom);
 assert.equal(wuHit.windows.at(-1).endExclusive, siFact.activeFrom);
 assert.equal(siHit.windows[0].start, siFact.activeFrom);
 const wu = wuFact.normalizedPayload, si = siFact.normalizedPayload;
 const { wuDing, wuJi, youWealth } = wu.dingYouWuContacts;
 assert.equal(wu.luckAtDayLu, true);
 assert.equal(wu.luckStem, '壬');
 assert.deepEqual([wuDing, wuJi, youWealth].map(row => [row.position, row.pillar, row.stem, row.god]),
  [['decadal', '壬午', '丁', '比肩'], ['decadal', '壬午', '己', '食神'], ['month', '乙酉', '辛', '偏财']]);
 assert.equal(wu.hasDingYouSiWealth, false);
 assert.equal(si.hasDingYouWuContacts, false);
 assert.deepEqual(si.dingYouSiWealth.youWealth, youWealth);
 assert.deepEqual(si.dingYouSiWealth.competingClashes.map(row => row.members.map(member => member.pillar)), [['丁亥', '辛巳']]);
 assert.deepEqual(si.dingYouSiWealth.annualEndpointClashes.map(({ target, annual }) =>
  [target.position, target.pillar, annual.position, annual.pillar]), [['month', '乙酉', 'annual', '辛卯']]);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ding-you-wu-si-change'));
 const findings = input.sections.flatMap(section => section.findings);
 assert.match(findings.find(finding => finding.knowledgeId === wuHit.knowledgeId)?.note ?? '', /禄堂劫财.*比肩/u);
 assert.deepEqual(findings.find(finding => finding.knowledgeId === siHit.knowledgeId)?.windows, siHit.windows);
 const before = input.facts.find(row => row.type === 'zpqz_moving_relations' && row.endExclusive === siFact.activeFrom
  && row.data.luckPillar === '壬午');
 const after = input.facts.find(row => row.type === 'zpqz_moving_relations' && row.start === siFact.activeFrom && row.data.luckPillar === '辛巳');
 assert.match(describeFortuneFact(before, String), /本步大运壬午藏丁比肩的丁火可克同一月柱乙酉藏辛偏财，本步大运壬午藏己食神的己土则可生该辛金/u);
 assert.match(describeFortuneFact(after, String), /巳酉会位两端实际见本步大运辛巳藏庚正财与本命月柱乙酉藏辛偏财/u);
 assert.match(describeFortuneFact(after, String), /同段另见日柱丁亥与本步大运辛巳六冲/u);
 assert.match(describeFortuneFact(after, String), /同一岁段太岁辛卯冲月柱乙酉/u);
 assert.doesNotMatch(formatFortuneFactAudit(input), /dingYouWuContacts|dingYouSiWealth|competingClashes|annualEndpointClashes/u);
 assert.doesNotMatch(formatFortunePrompt(input), /太岁辛卯冲月柱乙酉/u);
});

test('p035 separates original Chou, a luck-completed group, and an annual Chou', () => {
 const base = ref.calendarExamples[77];
 const cases = [
  [{ ...base, year: 2021 }, false, false, [['month', '乙酉', '辛']]],
  [{ ...base, hour: 2, natal: ['庚申', '乙酉', '丁亥', '辛丑'] }, false, true,
   [['month', '乙酉', '辛'], ['hour', '辛丑', '辛']]],
  [{ date: [1961, 9, 11], hour: 10, gender: 0, year: 2042, luck: '乙巳', natal: ['辛丑', '丁酉', '丁未', '乙巳'] }, true, false,
   [['year', '辛丑', '辛'], ['month', '丁酉', '辛'], ['hour', '乙巳', '庚']]],
  [{ ...ref.calendarExamples[78], year: 2020, luck: '丁巳' }, false, false, [['month', '辛酉', '辛']]],
 ];
 for (const [example, natalComplete, completedByLuck, expectedWealth] of cases) {
  const run = submitted(example), hit = match(run, 77);
  const fact = rows(run).find(row => row.normalizedPayload.luckPillar === example.luck && hit.sourceFactIds.includes(row.factId)
   && (example.year !== 2021 || row.normalizedPayload.annualBranch === '丑'));
  assert.equal(hit.status, 'matched');
  assert.ok(fact);
  const p = fact.normalizedPayload, group = p.groups.find(row => row.values === '巳酉丑');
  assert.equal(group.natalComplete, natalComplete);
  assert.equal(group.completedByLuck, completedByLuck);
  assert.deepEqual(group.missingInKnownPositions, natalComplete || completedByLuck ? [] : ['丑']);
  assert.deepEqual(p.dingYouSiWealth.natalGroupWealth.map(row => [row.position, row.pillar, row.stem]), expectedWealth);
  const { groupWitnesses } = p.dingYouSiWealth;
  assert.ok(groupWitnesses.members.every(row => row.position !== 'annual'));
  assert.equal(groupWitnesses.annualMissingMember?.pillar, example.year === 2021 ? '辛丑' : undefined);
  if (example.year === 2020) {
   assert.deepEqual(p.dingYouSiWealth.competingClashes.map(row => row.members.map(member => member.pillar)), [['辛酉', '丁卯']]);
   assert.ok(rows(run).some(row => row.normalizedPayload.annualBranch === '子' && row.normalizedPayload.luckBranch === '巳'));
   assert.equal(match(run, 78).status, 'not_matched');
  }
 }
 for (const [year, annualBranch, rule] of [[2014, '午', 76], [2025, '巳', 77]]) {
  const run = submitted({ ...base, year });
  assert.ok(rows(run).some(row => row.normalizedPayload.annualBranch === annualBranch && row.normalizedPayload.luckBranch !== annualBranch));
  assert.equal(match(run, rule).status, 'not_matched');
 }
});

test('year Chen and month You form their real six-combination, while arriving Zi and Chen do not fabricate absent Shen or two simultaneously transformed groups',()=>{
 const p=ctx(78,'壬子');assert.ok(p.branchRelations.some(r=>r.kind==='六合'&&r.members.some(r=>r.position==='year')&&r.members.some(r=>r.position==='month')));
 const g=p.groups.find(r=>r.values==='申子辰');assert.equal(g.completeWithLuck,false);assert.deepEqual(g.missingInKnownPositions,['申']);assert.equal(p.stemBranchEffectsVerified,false);
});

test('p032 and p033 bind the named water and metal components to the same Mao officer across the actual luck change', () => {
 const example = ref.calendarExamples[74];
 const run = submitted({ ...example, year: 2044 });
 const shenHit = match(run, 74), youHit = match(run, 75);
 assert.equal(shenHit.status, 'matched');
 assert.equal(youHit.status, 'matched');
 const shenFact = rows(run).find(fact => fact.normalizedPayload.luckPillar === '庚申' && shenHit.sourceFactIds.includes(fact.factId));
 const youFact = rows(run).findLast(fact => fact.normalizedPayload.luckPillar === '辛酉' && youHit.sourceFactIds.includes(fact.factId));
 assert.ok(shenFact && youFact);
 assert.equal(youFact.activeTo, shenFact.activeFrom);
 assert.equal(youHit.windows.at(-1).endExclusive, shenFact.activeFrom);
 assert.equal(shenHit.windows[0].start, shenFact.activeFrom);
 const shen = shenFact.normalizedPayload, you = youFact.normalizedPayload;
 assert.equal(shen.wuMaoBranchRoute, 'zi-shen-water');
 assert.equal(you.wuMaoBranchRoute, 'zi-you-officer');
 assert.deepEqual(shen.wuMaoLuckContext.monthOfficer, you.wuMaoLuckContext.monthOfficer);
 assert.deepEqual([shen.wuMaoLuckContext.monthOfficer.pillar, shen.wuMaoLuckContext.monthOfficer.stem,
  shen.wuMaoLuckContext.monthOfficer.god], ['丁卯', '乙', '正官']);
 assert.deepEqual(shen.wuMaoLuckContext.supports.map(row => [row.position, row.pillar, row.stem]),
  [['year', '甲子', '癸'], ['decadal', '庚申', '壬']]);
 assert.deepEqual(you.wuMaoLuckContext.hurts.map(row => [row.position, row.pillar, row.stem, row.god]),
  [['decadal', '辛酉', '辛', '伤官']]);
 assert.deepEqual(shen.groups.find(row => row.values === '申子辰').missingInKnownPositions, ['辰']);
 assert.ok(you.movingClashes.some(row => row.natal.position === 'month' && row.luck.pillar === '辛酉'));
 assert.equal(match({ ...run, facts: [youFact] }, 74).status, 'not_matched');
 assert.equal(match({ ...run, facts: [shenFact] }, 75).status, 'not_matched');
 const missingClash = structuredClone(youFact);
 delete missingClash.normalizedPayload.hasMovingMonthClash;
 assert.equal(match({ ...run, facts: [missingClash] }, 75).status, 'unknown');
 missingClash.normalizedPayload.hasMovingMonthClash = false;
 assert.equal(match({ ...run, facts: [missingClash] }, 75).status, 'not_matched');

 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'wu-mao-luck-change'));
 const findings = input.sections.flatMap(section => section.findings);
 const finding = findings.find(row => row.knowledgeId === youHit.knowledgeId);
 assert.ok(finding);
 assert.match(finding.note, /辛金为伤官/u);
 assert.match(finding.note, /乙木为戊日正官/u);
 assert.match(finding.note, /辛克乙/u);
 assert.deepEqual(finding.windows, youHit.windows);
 const shenFinding = findings.find(row => row.knowledgeId === shenHit.knowledgeId);
 assert.ok(shenFinding);
 for (const label of ['子', '申', '乙', '正官']) assert.ok(shenFinding.note.includes(label), label);
 assert.deepEqual(shenFinding.windows, shenHit.windows);
 assert.equal(shenFinding.windows[0].start, youFact.activeTo);
 const prompt = formatFortuneFactAudit(input);
 assert.ok(formatFortunePrompt(input).includes(shenFinding.note));
 assert.match(prompt, /年柱甲子藏癸正财、本步大运庚申藏壬偏财/u);
 assert.match(prompt, /本步大运辛酉藏辛伤官，对同一月柱丁卯藏乙正官为辛金克乙木/u);
 assert.doesNotMatch(prompt, /wuMaoLuckContext|wuMaoBranchRoute/u);
});

test('the printed Chou-year routes stay distinct from the Zi-year officer rules', () => {
 const sample = { date: [1961, 3, 16], hour: 12, gender: 0, natal: ['辛丑', '辛卯', '戊申', '戊午'] };
 for (const [year, luck, route] of [[2009, '丙申', 'chou-shen-birth'], [2019, '丁酉', 'chou-you-metal']]) {
  const run = submitted({ ...sample, year }), fact = rows(run).find(row => row.normalizedPayload.luckPillar === luck);
  assert.ok(fact);
  assert.equal(fact.normalizedPayload.wuMaoBranchRoute, route);
  assert.equal(match(run, 74).status, 'not_matched');
  assert.equal(match(run, 75).status, 'not_matched');
  const data = fact.normalizedPayload.wuMaoLuckContext;
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'chou-branch-comparison'));
  const prompt = formatFortuneFactAudit(input);
  if (luck === '丙申') {
   assert.deepEqual(data.birthPhase, { text: '长生', engine: '病' });
   assert.match(prompt, /正文丑年申运例称戊到申为长生.*将戊到申列为病/u);
  } else {
   assert.deepEqual(data.hurts.map(row => [row.position, row.pillar, row.stem]), [['year', '辛丑', '辛'], ['decadal', '丁酉', '辛']]);
   assert.match(prompt, /正文丑年酉运例另核丑酉会位/u);
  }
 }
});

test('the Zi-year Mao-month example keeps natal punishment, day-Xu combination and arriving clashes on their own pillars', () => {
 const example = { date: [1960, 3, 11], hour: 4, gender: 0, natal: ['庚子', '己卯', '戊戌', '甲寅'] };
 const shenRun = submitted({ ...example, year: 2022 });
 const youRun = submitted({ ...example, year: 2012 });
 const findWitness = (run, index, pillar) => {
  const hit = match(run, index);
  assert.equal(hit.status, completeIndices.has(index) ? 'matched' : 'partial');
  const fact = rows(run).find(row => hit.sourceFactIds.includes(row.factId) && row.normalizedPayload.luckPillar === pillar);
  assert.ok(fact);
  return fact.normalizedPayload.wuMaoLuckContext.branchReview;
 };
 const shen = findWitness(shenRun, 74, '壬申');
 const you = findWitness(youRun, 75, '癸酉');
 const positions = pair => pair.members.map(row => [row.position, row.branch]);
 for (const review of [shen, you]) {
  assert.deepEqual(positions(review.natalYearMonthPunishment), [['year', '子'], ['month', '卯']]);
  assert.deepEqual(positions(review.natalMonthDayCombine), [['month', '卯'], ['day', '戌']]);
  assert.deepEqual(review.natalHourFireBranch, { pillar: '甲寅', branch: '寅' });
 }
 assert.deepEqual(shen.otherEndpointClashes.map(positions), [[['hour', '寅'], ['decadal', '申']]]);
 assert.deepEqual(you.otherEndpointClashes, []);
 assert.deepEqual(you.endpointCombinations.map(positions), [[['month', '卯'], ['day', '戌']]]);

 const onlyHourXu = findWitness(submitted({ date: [1960, 3, 21], hour: 20, gender: 0, year: 2017,
  natal: ['庚子', '己卯', '戊申', '壬戌'] }), 75, '癸酉');
 assert.equal(onlyHourXu.natalMonthDayCombine, undefined);
 assert.equal(onlyHourXu.natalHourFireBranch, undefined);
 assert.deepEqual(onlyHourXu.endpointCombinations.map(positions), [[['month', '卯'], ['hour', '戌']]]);
});

test('p036 locates the same natal Chen and You wealth when the arriving Zi joins a partial or complete water group', () => {
 const cases = [
  [{ ...ref.calendarExamples[78], hour: 8, year: 2076, natal: ['戊辰', '辛酉', '丁卯', '甲辰'] }, false, []],
  [{ ...ref.calendarExamples[78], hour: 16, year: 2074, natal: ['戊辰', '辛酉', '丁卯', '戊申'] }, true,
   [['decadal', '壬子', 'annual', '甲午']]],
 ];
 for (const [example, complete, annualClashes] of cases) {
  const run = submitted(example), hit = match(run, 78);
  const fact = rows(run).find(row => row.normalizedPayload.luckPillar === '壬子' && hit.sourceFactIds.includes(row.factId)
   && row.normalizedPayload.annualBranch === (complete ? '午' : '申'));
  assert.ok(fact);
  const p = fact.normalizedPayload;
  assert.equal(hit.status, 'matched');
  const { chenWu, youWealth, luckZiGui, chenYouCombination } = p.dingYouZiChain;
  assert.deepEqual([chenWu, youWealth, luckZiGui].map(row => [row.position, row.pillar, row.stem, row.god]),
   [['year', '戊辰', '戊', '伤官'], ['month', '辛酉', '辛', '偏财'], ['decadal', '壬子', '癸', '七杀']]);
  assert.deepEqual(chenYouCombination.members.map(row => [row.position, row.pillar]),
   [[chenWu.position, chenWu.pillar], [youWealth.position, youWealth.pillar]]);
  assert.equal(chenYouCombination.kind, '六合');
  assert.deepEqual(p.dingYouZiChain.competingClashes.map(row => row.members.map(member => member.pillar)), [['辛酉', '丁卯']]);
  assert.deepEqual(p.dingYouZiChain.annualEndpointClashes.map(({ target, annual }) =>
   [target.position, target.pillar, annual.position, annual.pillar]), annualClashes);
  const water = p.groups.find(row => row.values === '申子辰');
  assert.equal(water.completeWithLuck, complete);
  assert.deepEqual(water.missingInKnownPositions, complete ? [] : ['申']);
  assert.deepEqual(water.members.find(row => row.branch === '辰').natalPositions, complete ? ['year'] : ['year', 'hour']);
  assert.equal(p.dingYouZiChain.groupWitnesses.annualMissingMember?.branch, complete ? undefined : '申');
  assert.ok(p.dingYouZiChain.groupWitnesses.members.every(row => row.position !== 'annual'));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'chen-you-zi-wealth'));
  assert.deepEqual(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId)?.windows, hit.windows);
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /两路共用同一个原局年辰/u);
  assert.match(prompt, /年柱戊辰藏戊伤官的土生同一月柱辛酉藏辛偏财，该辛又对本步大运壬子藏癸七杀呈金生水方向/u);
  assert.doesNotMatch(prompt, /dingYouZiChain|hasDingYouZiChain/u);
 }
 const otherChen = ctx(['戊戌', '辛酉', '丁卯', '甲辰'], '壬子');
 assert.equal(otherChen.hasDingYouZiChain, false);
 assert.ok(otherChen.branchRelations.some(row => row.kind === '六合'
  && row.members.some(member => member.position === 'hour' && member.branch === '辰')
  && row.members.some(member => member.position === 'month' && member.branch === '酉')));
});

test('the metal, water and fire source meetings expose annual clashes on their complete third member', () => {
 const cases = [
  [77, { ...ref.calendarExamples[77], hour: 2, year: 2015, natal: ['庚申', '乙酉', '丁亥', '辛丑'] },
   '乙未', '巳酉丑', 'dingYouSiWealth', [['hour', '辛丑']], ['丁亥', '辛巳']],
  [78, { ...ref.calendarExamples[78], hour: 16, year: 2070, natal: ['戊辰', '辛酉', '丁卯', '戊申'] },
   '庚寅', '申子辰', 'dingYouZiChain', [['hour', '戊申']]],
  [94, { date: [1958, 9, 14], hour: 20, gender: 0, year: 2024, luck: '甲寅', natal: ['戊戌', '辛酉', '甲午', '甲戌'] },
   '甲辰', '寅午戌', undefined, [['year', '戊戌'], ['hour', '甲戌']]],
  [95, ref.fireExamples.find(row => row.gengInBothLayouts), '甲辰', '寅午戌', undefined,
   [['year', '庚戌']], ['甲申', '戊寅']],
 ];
 for (const [index, example, annual, values, container, affected, competing] of cases) {
  const run = submitted(example), hit = match(run, index);
  assert.equal(hit.status, completeIndices.has(index) ? 'matched' : 'partial', values);
  const fact = rows(run).find(row => row.normalizedPayload.luckPillar === example.luck
   && row.normalizedPayload.annualPillar === annual && hit.sourceFactIds.includes(row.factId));
  assert.ok(fact, `${values} ${annual}`);
  const data = fact.normalizedPayload;
  const group = container ? data[container].groupWitnesses : data.fireMeetingGroupWitnesses;
  assert.equal(group.values, values);
  assert.equal(group.natalComplete, false);
  assert.equal(group.completedByLuck, true);
  assert.deepEqual(group.missingBranches, []);
  assert.equal(group.annualMissingMember, undefined);
  const expectedBranches = [...values, ...(index === 94 ? ['戌'] : [])].sort();
  assert.deepEqual(group.members.map(row => row.branch).sort(), expectedBranches);
  assert.deepEqual(group.annualClashes.map(({ target, annual: year }) => [target.position, target.pillar, year.pillar]),
   affected.map(([position, pillar]) => [position, pillar, annual]));
  if (competing) assert.ok(group.competingClashes.some(pair => pair.members.map(row => row.pillar).join('') === competing.join('')));
  if (index === 94) {
   const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'fire-group-audit'));
   const audit = formatFortuneFactAudit(input);
   assert.match(audit, /同一岁段太岁甲辰冲会组成员年柱戊戌/u);
   assert.match(audit, /同一岁段太岁甲辰冲会组成员时柱甲戌/u);
   assert.doesNotMatch(formatFortunePrompt(input), /冲会组成员|fireMeetingGroupWitnesses/u);
  }
 }
});

test('four source no-own-root pillars remain separate from four branch-qi-generating-stem examples and no relation is converted to a strength score',()=>{
 for(const pillar of ref.sourceRootPillars){const p=ctx(90,pillar);assert.equal(p.luckStemRootedInOwnBranch,false,pillar);assert.equal(p.sourcePillarExample.kind,'rootless');}
 for(const pillar of ref.sourceGeneratingPillars){const p=ctx(90,pillar);assert.ok(p.luckPillarElementLinks.some(r=>r.from.kind==='运支藏干'&&r.to.kind==='运干'&&r.relation==='生'),pillar);assert.ok(p.sourcePillarExample.generatingStems.length);assert.equal(p.stemBranchEffectsVerified,false);}
 const xinChou=ctx(90,'辛丑');assert.deepEqual(xinChou.sourcePillarExample.generatingStems,['己']);assert.equal(xinChou.luckStemOwnRoots[0].exactStem,true);
 const xinYou=ctx(['庚戌','乙酉','甲辰','辛未'],'癸酉');assert.deepEqual(xinYou.xinRootsInLuck.metalStems,['辛']);
});

test('p048 matches the concrete stem remedy and branch root comparisons while excluding unrelated contacts', () => {
 const examples = [{ ...ref.calendarExamples[90], source: 'generating' }, ...ref.stemBranchExamples];
 for (const e of examples) {
  const run = submitted(e), facts = rows(run).filter(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.luckPillar === e.luck);
  assert.ok(facts.length, e.natal.join());
  const data = facts[0].normalizedPayload;
  const result = match(run, 90);
  const status = e.source ? 'matched' : 'not_matched';
  assert.equal(result.status, status, e.natal.join());
  assert.equal(match({ ...run, facts: [facts[0]] }, 90).status, status, e.natal.join());
  assert.equal(facts.some(fact => result.sourceFactIds.includes(fact.factId)), Boolean(e.source));
  assert.equal(data.hasSourceStemBranchExample, Boolean(e.source));
  if (e.source === 'generating') {
   assert.deepEqual(data.sourcePillarExample, { kind: 'generating', generatingStems: ['戊'] });
   const transition = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === e.luck);
   assert.ok(transition);
   assert.equal(result.windows[0].start, transition.exactInstant);
  }
  if (e.source === 'rootless') {
   assert.equal(data.sourcePillarExample.kind, 'rootless');
   assert.equal(data.luckStemRootedInOwnBranch, false);
   assert.equal(data.luckStemRootedInNatal, true);
  }
  if (e.source === 'officer-root') {
   assert.deepEqual(data.xinRootsInLuck.officers.map(row => [row.position, row.stem]), [['hour', '辛']]);
   assert.deepEqual(data.xinRootsInLuck.metalStems, ['庚']);
   assert.ok(describeFortuneFact({ method: 'bazi', type: 'zpqz_moving_relations', data }, String)
    .includes('时柱透干辛（正官）见本运支申所藏庚，是同五行异干根位'));
  }
  if (e.source === 'hurt-combination') {
   assert.deepEqual(data.officerHurtCombination.hurtTargets.map(row => [row.position, row.stem]), [['hour', '戊']]);
   assert.deepEqual(data.officerHurtCombination.officers.map(row => [row.position, row.stem]), [['year', '壬']]);
   assert.ok(describeFortuneFact({ method: 'bazi', type: 'zpqz_moving_relations', data }, String)
    .includes('本步运干癸与时柱透干戊（伤官）五合'));
  }
  if (e.source === 'officer-root' || e.source === 'hurt-combination') {
   const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), e.source));
   const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId);
   assert.ok(finding);
   assert.match(finding.note, /去病.*得地/u);
   assert.deepEqual(finding.windows, result.windows);
   assert.ok(formatFortunePrompt(input).includes(finding.note));
   assert.doesNotMatch(formatFortuneFactAudit(input), /xinRootsInLuck|hasSourceStemBranchExample/u);
  }
 }
});

test('p049 separates actual Wu wealth Lu and exposed Ding attacking the same You officer at the luck transition', () => {
 const { concealedOfficer, onlyHiddenJi } = ref.jiaLuckExamples;
 const exposedOfficer = ref.calendarExamples[91];
 for (const [example, route] of [
  [concealedOfficer, 'wu-wealth-lu'], [{ ...exposedOfficer, year: 2060 }, 'wu-wealth-lu'],
  [{ ...exposedOfficer, year: 2062, luck: '丁未' }, 'ding-officer-hurt'],
  [onlyHiddenJi, undefined], [{ ...ref.calendarExamples[92], year: 2033, luck: '壬午' }, undefined],
 ]) {
  const run = submitted(example);
  const hit = match(run, 91);
  const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === example.luck);
  assert.ok(fact, example.year);
  const status = route ? 'matched' : 'not_matched';
  assert.equal(hit.status, status, example.year);
  assert.equal(match({ ...run, facts: [fact] }, 91).status, status, example.year);
  assert.equal(hit.sourceFactIds.includes(fact.factId), Boolean(route));
  const witness = fact.normalizedPayload.jiaWuWealthLu;
  if (route === 'wu-wealth-lu') {
   const concealed = example === concealedOfficer;
   assert.deepEqual(witness.officers.map(row => [row.position, row.stem]), [[concealed ? 'hour' : 'year', '辛']]);
   assert.deepEqual(witness.exposedOfficers.map(row => row.stem), concealed ? [] : ['辛']);
   assert.deepEqual(witness.wealthAtLu.map(row => [row.position, row.stem, row.luBranch]), [[concealed ? 'year' : 'month', '己', '午']]);
   assert.deepEqual([witness.hurtHidden, witness.wealthHidden].map(row => [row.stem, row.god]), [['丁', '伤官'], ['己', '正财']]);
   assert.ok(witness.wealthFeedsOfficer.some(link => link.wealth.stem === '己' && link.officer.kind === '支藏' && link.officer.stem === '辛'));
   assert.ok(witness.hiddenHurtControls.some(link => link.from.kind === '运支藏干' && link.from.stem === '丁' && link.to.stem === '辛'));
  } else {
   assert.equal(witness, undefined);
  }
  if (example.year === 2062) {
   assert.ok(rows(run).some(row => row.normalizedPayload.luckPillar === '丁未' && row.normalizedPayload.annualBranch === '午'
    && !row.normalizedPayload.jiaLuckRoutes.includes('wu-wealth-lu')));
   const controls = fact.normalizedPayload.jiaDingOfficerHurt.controls;
   assert.ok(controls.every(link => link.from.kind === '运干' && link.from.stem === '丁' && link.to.stem === '辛'));
   assert.deepEqual(controls.map(link => [link.to.position, link.to.kind]), [['year', '透干'], ['year', '支藏']]);
  }
  if (example.year === 2060) {
   const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丁未');
   assert.ok(transition);
   const boundary = transition.exactInstant;
   const previous = rows(run).find(row => row.normalizedPayload.jiaLuckRoutes.includes('wu-wealth-lu') && row.activeTo === boundary);
   const active = rows(run).find(row => row.normalizedPayload.jiaLuckRoutes.includes('ding-officer-hurt') && row.activeFrom === boundary);
   assert.ok(previous && active);
   assert.ok(hit.sourceFactIds.includes(previous.factId) && hit.sourceFactIds.includes(active.factId));
   assert.ok(!previous.normalizedPayload.jiaDingOfficerHurt && !active.normalizedPayload.jiaWuWealthLu);
   const priorHit = match({ ...run, facts: [previous] }, 91);
   const nextHit = match({ ...run, facts: [active] }, 91);
   assert.equal(priorHit.windows.at(-1).endExclusive, boundary);
   assert.equal(nextHit.windows[0].start, boundary);
   const missingRoutes = structuredClone(active);
   delete missingRoutes.normalizedPayload.jiaLuckRoutes;
   assert.equal(match({ ...run, facts: [missingRoutes] }, 91).status, 'unknown');
   const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'jia-ji-lu'));
   const prompt = formatFortuneFactAudit(input);
   assert.ok(prompt.includes('月柱透干己（正财）见本步午运为己禄位'));
   assert.ok(prompt.includes('本步大运运干丁（伤官）克年柱支藏辛（正官）'));
   assert.doesNotMatch(prompt, /jiaWuWealthLu|jiaDingOfficerHurt/u);
   const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
   assert.ok(finding);
   assert.match(finding.note, /(?:若|如果).*酉.*官/u);
   for (const phrase of ['午', '己', '禄', '丁', '伤官']) assert.ok(finding.note.includes(phrase), phrase);
   assert.deepEqual(finding.windows, hit.windows);
   assert.ok(formatFortunePrompt(input).includes(finding.note));
  }
 }
});

test('exposed Ji is attacked by the actual Jia or Yi stem and can independently see Yin or Mao support and named exceptions', () => {
 const { concealedOfficer, onlyHiddenJi, officerAndOutput, jiWei } = ref.jiaLuckExamples;
 const officerOnly = { ...officerAndOutput, hour: 8, natal: ['辛酉', '己亥', '甲午', '戊辰'] };
 const outputOnly = { ...concealedOfficer, year: 2053, luck: '甲申' };
 for (const [example, stem, branch] of [
  [officerAndOutput, '甲', ''],
  [officerOnly, '甲', ''],
  [outputOnly, '甲', ''],
  [{ ...concealedOfficer, year: 1993, luck: '戊寅' }, '', '寅'],
  [{ ...jiWei, year: 2034, luck: '甲寅' }, '甲', '寅'],
  [{ ...jiWei, year: 2044, luck: '乙卯' }, '乙', '卯'],
  [{ ...onlyHiddenJi, year: 2014, luck: '甲戌' }, '', ''],
 ]) {
  const run = submitted(example), hit = match(run, 92);
  const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === example.luck);
  const data = fact?.normalizedPayload;
  assert.ok(data, example.year);
  assert.equal(hit.status, stem || branch ? 'matched' : 'not_matched', example.year);
  assert.equal(hit.sourceFactIds.includes(fact.factId), Boolean(stem || branch));
  assert.equal(Boolean(data.jiaWealthStem), Boolean(stem));
  assert.equal(Boolean(data.jiaWealthBranch), Boolean(branch));
  if (stem) assert.deepEqual(data.jiaWealthStem.attacks.map(row => [row.from.stem, row.to.kind, row.to.stem, row.combines]),
   [[stem, '透干', '己', stem === '甲']]);
  if (branch) assert.deepEqual([data.jiaWealthBranch.mainQi.branch, data.jiaWealthBranch.mainQi.god],
   [branch, branch === '寅' ? '比肩' : '劫财']);
  if (example === officerOnly || example === outputOnly) {
   const { attacks, officerControls, outputBridges } = data.jiaWealthStem;
   assert.deepEqual(officerControls.map(row => [row.from.stem, row.to]), example === officerOnly ? [['辛', attacks[0].from]] : []);
   assert.deepEqual(outputBridges.map(row => [row.from, row.through.stem, row.wealth]),
    example === outputOnly ? [[attacks[0].from, '丙', attacks[0].to]] : []);
  }
  if (example === officerAndOutput) {
   assert.equal(match(run, 93).status, 'not_matched');
   const { attacks, officerControls, outputBridges } = data.jiaWealthStem;
   assert.deepEqual(officerControls.map(row => [row.from.position, row.from.stem, row.to]), [['year', '辛', attacks[0].from]]);
   assert.deepEqual(outputBridges.map(row => [row.from, row.through.stem, row.wealth]), [[attacks[0].from, '丙', attacks[0].to]]);
   const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'jia-ji-wealth'));
   const prompt = formatFortuneFactAudit(input);
   assert.ok(prompt.includes('官透制化候选：年柱透干辛（正官）克本步大运运干甲'));
   assert.ok(prompt.includes('生时柱透干丙（食神），再生月柱透干己（正财）'));
   assert.ok(prompt.includes('克月柱透干己（正财），这对明干也有甲己五合'));
   const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
   assert.match(finding?.note ?? '', /(?:若|如果).*己.*财/u);
   assert.deepEqual(finding.windows, hit.windows);
  }
  if (stem && branch) assert.deepEqual(data.jiaWealthStem.officerControls, []);
  if (example.year === 1993) assert.deepEqual(data.jiaWealthBranch.concealedYouOfficers.map(row => row.position), ['hour']);
  assert.equal(data.stemBranchEffectsVerified, false);
 }
});

test('Gui seal evidence separates exposed Wu-Gui combination, hidden Gui, and the actual components of each storehouse', () => {
 const { wuChen, jiWei } = ref.jiaLuckExamples;
 const transitionExample = { ...wuChen, year: 2068 };
 for (const [example, expectedCombines, storehouse] of [
  [transitionExample, [['透干', true], ['支藏', false]], '戊乙癸'],
  [jiWei, [['透干', false]], '己丁乙'],
  [ref.calendarExamples[93], [], '己癸辛'],
  [{ ...jiWei, year: 1994, luck: '庚戌' }, [], '戊辛丁'],
  [{ ...ref.calendarExamples[92], year: 1993 }, [['支藏', false], ['支藏', false]], ''],
 ]) {
  const run = submitted(example), hit = match(run, 93);
  const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === example.luck);
  const data = fact?.normalizedPayload;
  assert.ok(data);
  assert.equal(hit.status, 'matched');
  assert.ok(hit.sourceFactIds.includes(fact.factId));
  assert.deepEqual(data.jiaSealStem.map(row => [row.to.kind, row.combines]), expectedCombines);
  assert.equal(data.jiaSealStorehouse?.hidden.map(row => row.stem).join('') ?? '', storehouse);
  assert.ok(data.jiaSealStem.every(row => row.from.kind === '运干' && row.to.stem === '癸'));
  if (storehouse) {
   const contacts = data.jiaSealStorehouse.contacts;
   const expected = new Map([['戊', '克'], ['己', '克'], ['癸', '同五行'], ['辛', '生']]);
   assert.ok(contacts.every(row => row.from.kind === '运支藏干' && row.to.stem === '癸' && !row.combines));
   for (const seal of data.jiaSealStorehouse.seals) {
    assert.deepEqual(contacts.filter(row => row.to.position === seal.position && row.to.kind === seal.kind)
     .map(row => [row.from.stem, row.relation]), [...storehouse].filter(stem => expected.has(stem)).map(stem => [stem, expected.get(stem)]));
   }
  }
  if (example === transitionExample) {
   const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丁卯');
   assert.ok(change);
   const later = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '丁卯');
   assert.ok(later);
   assert.equal(hit.windows.at(-1).endExclusive, change.exactInstant);
   assert.deepEqual(later.normalizedPayload.jiaLuckRoutes.filter(route => route.startsWith('seal-')), []);
   assert.equal(match({ ...run, facts: [later] }, 93).status, 'not_matched');
   assert.ok(data.jiaLuckRoutes.includes('seal-stem') && data.jiaLuckRoutes.includes('seal-storehouse'));

   const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'jia-gui-seal'));
   const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
   assert.ok(finding);
   assert.match(finding.note, /(?:若|如果).*癸.*印/u);
   for (const phrase of ['藏', '运干', '四库']) assert.ok(finding.note.includes(phrase), phrase);
   assert.deepEqual(finding.windows, hit.windows);
   const prompt = formatFortuneFactAudit(input);
   assert.ok(prompt.includes('克时柱透干癸（正印），同一对明干也有戊癸五合'));
   assert.ok(prompt.includes('甲日癸印的四库运支候选：辰支实藏'));
   assert.ok(prompt.includes('库支本步大运运支藏干癸（正印）与时柱透干癸（正印）同属水'));
   assert.ok(!prompt.includes('jiaSealStorehouse'));
  }
  assert.equal(data.stemBranchEffectsVerified, false);
 }
});

test('named Xin/Geng target layouts retain actual column gaps and partial Yin-Wu-Xu branches rather than a fabricated completed fire frame',()=>{
 const p=ctx(94),layouts=p.fireTargetLayouts.filter(r=>r.target.stem==='辛');assert.deepEqual(layouts.map(r=>[r.target.position,r.wu.position,r.columnDistance]),[['year','day',2],['month','day',1]]);
 assert.equal(p.groups.find(r=>r.values==='寅午戌').completeWithLuck,false);assert.deepEqual(p.groups.find(r=>r.values==='寅午戌').missingInKnownPositions,['寅']);
 const q=ctx(95,ref.calendarExamples[95].luck);assert.ok(q.fireTargetLayouts.some(r=>r.target.stem==='庚'&&r.target.god==='七杀'));
 assert.equal(q.groups.find(r=>r.values==='寅午戌').completeWithLuck,false);assert.deepEqual(q.groups.find(r=>r.values==='寅午戌').missingInKnownPositions,['戌']);
});

test('p052 and p053 use the actual luck, named metal root and a separate natal Wu', () => {
 const natalComplete = { date: [1978, 9, 9], hour: 4, gender: 0, year: 2039, luck: '甲寅',
  natal: ['戊午', '辛酉', '甲戌', '丙寅'], matches: [94] };
 for (const e of [...ref.fireExamples, natalComplete]) {
  const run = submitted(e), facts = rows(run).filter(row => row.normalizedPayload.luckPillar === e.luck && row.normalizedPayload.confirmed);
  assert.ok(facts.length, e.natal.join());
  const data = facts[0].normalizedPayload;
  const found = matchFortuneKnowledge(run).byMethod.bazi;
  for (const index of [94, 95]) {
   const selected = e.matches.includes(index), hit = found[index];
   const expected = !selected ? 'not_matched' : index === 94 && e.year === 1983 ? 'matched' : 'partial';
   assert.equal(hit.status, expected, e.natal.join());
   assert.equal(facts.some(fact => hit.sourceFactIds.includes(fact.factId)), selected);
  }
  assert.deepEqual(data.fireMeetingTargetStems, e.matches.map(index => index === 94 ? '辛' : '庚'));
  if (e.matches.length) {
   const fire = data.groups.find(row => row.values === '寅午戌');
   assert.deepEqual(fire.missingInKnownPositions, e.otherFireMember ? [e.otherFireMember] : []);
   assert.equal(fire.completeWithLuck, !e.otherFireMember);
   const sourceStatus = e === natalComplete ? 'natal-complete' : e.otherFireMember ? 'incomplete' : 'luck-completes';
   assert.equal(data.fireMeetingStatus, sourceStatus);
   if (sourceStatus !== 'luck-completes') assert.deepEqual(data.fireMeetingSourcePaths, []);
   const target = data.fireTargetLayouts.find(row => row.target.stem === data.fireMeetingTargetStems[0] && !row.sameColumn);
   assert.notEqual(target.target.position, target.wu.position);
   assert.deepEqual(target.namedRoots.map(row => row.branch), [e.matches.includes(94) ? '酉' : '申']);
  }
  assert.equal(data.fireMeetingPaths.length > 0, Boolean(e.matches.length));
  for (const path of data.fireMeetingPaths) {
   assert.equal(path.target.kind, '透干');
   assert.equal(path.root.stem, path.target.stem);
   assert.equal(path.wuFire.stem, '丁');
   assert.equal(path.movingFire.stem, e.luck.endsWith('寅') ? '丙' : '丁');
   assert.equal(path.movingFire.pillar, e.luck);
   assert.ok(path.wuFire.position !== path.target.position);
   const layout = data.fireTargetLayouts.find(row => row.target.position === path.target.position && row.wu.position === path.wuFire.position);
   assert.deepEqual(path.betweenStemAndWu, layout.between);
   assert.equal(path.rootColumnDistance, Math.abs(layers.indexOf(path.root.position) - layers.indexOf(path.wuFire.position)));
   assert.ok(path.annualClashes.every(link => [path.root.position, path.wuFire.position, 'decadal'].includes(link.target.position)));
  }
  if (e.gengSameColumnOnly || e.gengInBothLayouts) {
   const geng = data.fireTargetLayouts.filter(row => row.target.stem === '庚');
   assert.ok(geng.some(row => row.sameColumn && row.target.pillar === '庚午' && row.namedRoots.length));
   assert.equal(geng.some(row => !row.sameColumn), Boolean(e.gengInBothLayouts));
  }
  if (e.annualWuOnly) {
   assert.ok(facts.some(fact => fact.normalizedPayload.annualBranch === '午'));
   assert.equal(data.fireTargetLayouts.length, 0);
  }
  assert.deepEqual(data.concealedXinNeighbors.map(pair => [pair.wu.position, pair.you.position]), e.concealedXin ?? []);
  assert.ok(data.concealedXinNeighbors.every(pair => pair.wu.stem === '丁' && pair.you.stem === '辛'
   && pair.wu.kind === '支藏' && pair.you.kind === '支藏'));
  const description = describeFortuneFact({ method: 'bazi', type: 'zpqz_moving_relations', data }, String);
  assert.equal(description.includes('属于徐注的紧贴对照'), Boolean(e.concealedXin));
  if (e.year === 2013) {
   const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === e.luck);
   assert.ok(transition);
   assert.equal(found[95].windows[0].start, transition.exactInstant);
  }
  if (e.year === 1977) {
   assert.equal(data.stageStart, '1977-01-12T00:00:00.000Z');
   assert.equal(found[94].windows[0].start, data.stageStart);
   const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'fire-meeting'));
   assert.match(formatFortuneFactAudit(input), /同干根位年柱己酉，日柱甲午的午与实际大运戊寅为两支会位/u);
   const [path] = data.fireMeetingPaths;
   assert.deepEqual([path.stemColumnDistance, path.rootColumnDistance, path.betweenRootAndWu.map(row => row.pillar)], [1, 2, ['丁丑']]);
   assert.match(formatFortuneFactAudit(input), /日柱甲午藏丁伤官与本步大运戊寅藏丙食神均有克时柱透干辛（正官）的方向/u);
   assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== found[94].knowledgeId)));
  }
  if (e.year === 1975) {
   const [path] = data.fireMeetingPaths;
   assert.deepEqual(path.rootClashes.map(pair => pair.members.map(row => row.position)), [['hour', 'decadal']]);
   assert.deepEqual(path.wuClashes, []);
  }
 }
});

test('p052 and p053 confirm only the two actual natal and luck members when the month metal root is unopposed', () => {
 const cases = [
  [{ date: [1968, 9, 11], hour: 12, gender: 1, year: 1984, luck: '壬戌', natal: ['戊申', '辛酉', '甲申', '庚午'] }, 94, '辛'],
  [{ date: [1951, 8, 22], hour: 12, gender: 0, year: 1968, luck: '戊戌', natal: ['辛卯', '丙申', '甲午', '庚午'] }, 95, '庚'],
 ];
 for (const [example, index, stem] of cases) {
  const run = submitted(example), hit = match(run, index);
  const actual = rows(run).filter(({ normalizedPayload: p }) => p.confirmed && p.luckPillar === example.luck);
  const qualified = actual.filter(({ normalizedPayload: p }) => p.fireHalfMeetingTargetStems.includes(stem));
  assert.ok(qualified.length, example.natal.join());
  assert.ok(qualified.every(({ normalizedPayload: p }) => p.fireMeetingStatus === 'incomplete'
    && p.fireMeetingGroupWitnesses.missingBranches.join() === '寅'));
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '命與運二支會局');
  assert.deepEqual(hit.sourceFactIds, qualified.map(fact => fact.factId));
  if (index === 94) {
   const clashed = actual.find(({ normalizedPayload: p }) => p.annualPillar === '甲子');
   assert.ok(clashed);
   assert.deepEqual(clashed.normalizedPayload.fireHalfMeetingTargetStems, []);
   assert.equal(hit.windows.at(-1).endExclusive, clashed.activeFrom);
   assert.equal(hit.candidateWindows[0].start, clashed.activeFrom);
  }
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'source-two-branch-meeting'));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /只确认两支会位及同一透干的生克方向/u);
  assert.doesNotMatch(prompt, /則火動傷官|火動而制煞|fireHalfMeetingTargetStems/u);
 }
});

test('p052 confirms the same original year Xin and You root only during an unopposed natal and luck fire pair', () => {
 const example = { date: [1981, 5, 16], hour: 2, gender: 0, year: 2028,
  natal: ['辛酉', '癸巳', '甲午', '乙丑'] };
 const run = submitted(example), hit = match(run, 94);
 const actual = rows(run).find(({ normalizedPayload: p }) => p.confirmed && p.luckPillar === '戊戌');
 assert.ok(actual);
 const before = rows(run).find(fact => fact.normalizedPayload.confirmed && fact.activeTo === actual.activeFrom);
 assert.equal(before?.normalizedPayload.luckPillar, '丁酉');
 assert.equal(actual.activeFrom, '2028-05-20T02:00:00.000Z');
 assert.equal(before?.normalizedPayload.fireHalfYearXinSamePillar, false);
 assert.equal(actual.normalizedPayload.fireHalfYearXinSamePillar, true);
 assert.deepEqual(actual.normalizedPayload.fireHalfMeetingTargetStems, []);
 const path = actual.normalizedPayload.fireMeetingPaths.find(row => row.target.position === 'year');
 assert.deepEqual([path.target.pillar, path.root.position, path.root.pillar, path.root.stem,
  path.wuFire.position, path.wuFire.pillar, path.movingFire.pillar],
 ['辛酉', 'year', '辛酉', '辛', 'day', '甲午', '戊戌']);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '命與運二支會局');
 assert.deepEqual(hit.windows, [{ start: actual.activeFrom, endExclusive: actual.activeTo }]);
 assert.deepEqual(hit.sourceFactIds, [actual.factId]);
 assert.equal(match(run, 95).status, 'not_matched');
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'same-year-xin-half-meeting'));
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /年柱辛酉/u);
 assert.doesNotMatch(prompt, /則火動傷官|火動而制煞|fireHalfYearXinSamePillar/u);

 const changed = submitted({ ...example, hour: 6, natal: ['辛酉', '癸巳', '甲午', '丁卯'] });
 const clashed = rows(changed).find(({ normalizedPayload: p }) => p.confirmed && p.luckPillar === '戊戌');
 assert.ok(clashed);
 assert.equal(clashed.normalizedPayload.fireHalfYearXinSamePillar, false);
 assert.ok(clashed.normalizedPayload.fireMeetingPaths.some(p => p.root.pillar === '辛酉'
  && p.rootClashes.some(pair => pair.members.some(row => row.pillar === '丁卯'))));
 const blocked = match(changed, 94);
 assert.equal(blocked.status, 'partial');
 assert.deepEqual(blocked.windows, [{ start: clashed.activeFrom, endExclusive: clashed.activeTo }]);
 const blockedInput = buildFortuneModelContext(changed,
  interpretFortune(changed, requestForFortuneRun(changed), 'clashed-year-xin-half-meeting')).input;
 assert.ok(blockedInput.sections.every(section => section.findings.every(row => row.knowledgeId !== blocked.knowledgeId)));
 assert.equal(baziZpqzMovingRelations(natal(example.natal), false, '戊戌', '戊申').fireHalfYearXinSamePillar, undefined);

 const yinRun = submitted({ ...example, gender: 1, year: 2005 });
 const [annualClash, annualClear] = rows(yinRun).filter(fact => fact.normalizedPayload.confirmed);
 assert.deepEqual([annualClash, annualClear].map(({ normalizedPayload: p }) =>
  [p.luckPillar, p.annualPillar, p.fireHalfYearXinSamePillar]),
 [['庚寅', '甲申', false], ['庚寅', '乙酉', true]]);
 assert.ok(annualClash.normalizedPayload.fireMeetingPaths.some(path =>
  path.annualClashes.some(clash => clash.target.position === 'decadal' && clash.annual.pillar === '甲申')));
 const liChun = '2005-02-03T17:43:02.000Z';
 const yinHit = match(yinRun, 94);
 assert.equal(yinHit.status, 'matched');
 assert.deepEqual(yinHit.windows, [{ start: liChun, endExclusive: annualClear.activeTo }]);
 assert.deepEqual(yinHit.candidateWindows, [{ start: annualClash.activeFrom, endExclusive: liChun }]);
 assert.deepEqual(yinHit.sourceFactIds, [annualClear.factId]);
 assert.equal(match(yinRun, 95).status, 'not_matched');
});

test('p052 and p053 resolve the natal and luck pair independently of an annual third fire seat', () => {
 const cases = [
  [{ date: [1968, 9, 11], hour: 12, gender: 1, year: 1986, luck: '壬戌', natal: ['戊申', '辛酉', '甲申', '庚午'] }, 94, '辛', '丙寅'],
  [{ date: [1951, 8, 22], hour: 12, gender: 0, year: 1974, luck: '戊戌', natal: ['辛卯', '丙申', '甲午', '庚午'] }, 95, '庚', '甲寅'],
 ];
 for (const [example, index, stem, annual] of cases) {
  const run = submitted(example), hit = match(run, index);
  const actual = rows(run).filter(({ normalizedPayload: p }) => p.confirmed && p.luckPillar === example.luck);
  const after = actual.find(({ normalizedPayload: p }) => p.annualPillar === annual);
  const before = actual.find(fact => fact.activeTo === after?.activeFrom);
  assert.ok(before && after, example.natal.join());
  const right = after.normalizedPayload;
  assert.equal(before.normalizedPayload.fireMeetingStatus, 'incomplete');
  assert.deepEqual(before.normalizedPayload.fireHalfMeetingTargetStems, [stem]);
  assert.equal(right.fireMeetingStatus, 'annual-supplement');
  assert.equal(right.fireMeetingGroupWitnesses.annualMissingMember.pillar, annual);
  assert.deepEqual(right.fireMeetingGroupWitnesses.missingBranches, ['寅']);
  assert.equal(right.fireMeetingGroupWitnesses.completedByLuck, false);
  assert.deepEqual(right.fireMeetingSourcePaths, []);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '命與運二支會局');
  const sourcePath = right.fireMeetingPaths.find(path => path.target.stem === stem && path.root.position === 'month');
  assert.ok(sourcePath);
  if (index === 94) {
   assert.deepEqual(sourcePath.annualClashes, []);
   assert.deepEqual(right.fireHalfMeetingTargetStems, [stem]);
   assert.deepEqual(hit.windows, [{ start: before.activeFrom, endExclusive: after.activeTo }]);
   assert.deepEqual(hit.sourceFactIds, [before.factId, after.factId]);
  } else {
   assert.deepEqual(sourcePath.annualClashes.map(pair => [pair.annual.pillar, pair.target.position, pair.target.pillar]),
    [['甲寅', 'month', '丙申']]);
   assert.deepEqual(right.fireHalfMeetingTargetStems, []);
   assert.deepEqual(hit.windows, [{ start: before.activeFrom, endExclusive: after.activeFrom }]);
   assert.deepEqual(hit.candidateWindows, [{ start: after.activeFrom, endExclusive: after.activeTo }]);
   assert.deepEqual(hit.sourceFactIds, [before.factId]);
  }
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'annual-third-seat'));
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
  assert.deepEqual(finding?.windows, hit.windows);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /只确认两支会位及同一透干的生克方向/u);
  assert.doesNotMatch(prompt, /則火動傷官|火動而制煞|寅午戌缺位只由当岁补出|fireHalfMeetingTargetStems/u);
 }
});

test('p052 confirms an actual Xu-completed fire meeting only while the same Xin path has no six-clash', () => {
 const example = ref.fireExamples[1], run = submitted({ ...example, year: 1987 });
 const after = rows(run).find(({ normalizedPayload: p }) => p.confirmed && p.luckPillar === example.luck && p.annualPillar === '丁卯');
 const before = rows(run).find(row => row.activeTo === after?.activeFrom && row.normalizedPayload.luckPillar === example.luck);
 assert.ok(before && after);
 assert.equal(before.normalizedPayload.fireMeetingUnopposedXin, true);
 assert.equal(after.normalizedPayload.fireMeetingUnopposedXin, false);
 const [source] = before.normalizedPayload.fireMeetingSourcePaths;
 assert.deepEqual([source.target.position, source.root.position, source.wuFire.position, source.partner.position, source.movingFire.branch],
  ['month', 'month', 'hour', 'day', '戌']);
 assert.deepEqual(source.betweenStemAndWu.map(row => row.position), ['day']);
 assert.deepEqual(source.betweenRootAndWu.map(row => row.position), ['day']);
 assert.deepEqual(source.betweenWuAndPartner, []);
 assert.deepEqual(after.normalizedPayload.fireMeetingSourcePaths[0].annualClashes.map(pair => [pair.target.pillar, pair.annual.pillar]),
  [['辛酉', '丁卯']]);
 const hit = match(run, 94);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '運遇寅戌會局');
 assert.deepEqual(hit.windows, [{ start: before.activeFrom, endExclusive: after.activeFrom }]);
 assert.deepEqual(hit.candidateWindows, [{ start: after.activeFrom, endExclusive: after.activeTo }]);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'confirmed-xu-meeting'));
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /由实际大运补齐寅午戌.*是否用酉官、实际成化或伤官仍须另核/u);
 assert.doesNotMatch(prompt, /則火動傷官|fireMeetingUnopposedXin/u);
});

test('p053 distinguishes the natal and moving Yin that clash with the same monthly Shen as luck completes the fire meeting', () => {
 for (const [e, boundary, yinSource, yinPosition, wuPosition, confirmed] of [
  [{ date: [1970, 8, 22], hour: 12, gender: 0, year: 2025, luck: '戊寅', natal: ['庚戌', '甲申', '甲戌', '庚午'] },
   '2025-05-17T16:00:00.000Z', 'luck-yin', 'decadal', 'hour', false],
  [{ date: [1974, 8, 21], hour: 12, gender: 1, year: 1990, luck: '甲戌', natal: ['甲寅', '壬申', '甲午', '庚午'] },
   '1990-08-03T22:00:00.000Z', 'natal-yin', 'year', 'day', true],
 ]) {
  const run = submitted(e);
  const before = rows(run).find(row => row.activeTo === boundary), after = rows(run).find(row => row.activeFrom === boundary);
  assert.ok(before && after, e.luck);
  assert.deepEqual(before.normalizedPayload.fireMeetingMonthShenClashes, []);
  assert.equal(after.normalizedPayload.fireMeetingStatus, 'luck-completes');
  assert.deepEqual(after.normalizedPayload.fireMeetingMonthShenClashes, [yinSource]);
  const paths = after.normalizedPayload.fireMeetingSourcePaths;
  assert.ok(paths.length > 0 && paths.every(path => path.wuFire.position === wuPosition));
  for (const path of paths) {
   assert.equal(path.root.position, 'month');
   assert.deepEqual(path.shenRootClash.members.map(row => [row.position, row.branch]).sort(), [[yinPosition, '寅'], ['month', '申']].sort());
  }
  const hit = match(run, 95);
  assert.equal(after.normalizedPayload.fireMeetingWithMonthlyGeng, confirmed);
  assert.equal(hit.status, confirmed ? 'matched' : 'partial');
  assert.equal(hit.windows[0].start, boundary);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'shen-root-and-fire-meeting'));
  assert.equal(input.sections.some(section => section.findings.some(row => row.knowledgeId === hit.knowledgeId)), confirmed);
  if (confirmed) {
    assert.equal(hit.matchedSourceExcerpt, '火動');
    assert.match(formatFortunePrompt(input), /月申所受寅申冲/u);
  }
  assert.doesNotMatch(formatFortunePrompt(input), /火動而制煞|fireMeetingMonthShenClashes|fireMeetingWithMonthlyGeng/u);
 }
});

test('annual supplements leave both source fire candidates separate from a group completed by the actual luck', () => {
 for (const [example, year, index, annual] of [
  [ref.fireExamples[0], 1982, 94, '壬戌'], [ref.fireExamples[3], 2022, 95, '壬寅'],
 ]) {
  const run = submitted({ ...example, year });
  const after = rows(run).find(({ normalizedPayload: p }) => p.confirmed && p.luckPillar === example.luck && p.annualPillar === annual);
  const before = rows(run).find(row => row.activeTo === after?.activeFrom && row.normalizedPayload.luckPillar === example.luck);
  assert.ok(before && after, String(index));
  assert.equal(before.normalizedPayload.fireMeetingStatus, 'incomplete');
  assert.equal(after.normalizedPayload.fireMeetingStatus, 'annual-supplement');
  assert.notEqual(after.normalizedPayload.fireMeetingWithMonthlyGeng, true);
  assert.equal(after.normalizedPayload.fireMeetingGroupWitnesses.annualMissingMember.pillar, annual);
  assert.equal(after.normalizedPayload.fireMeetingGroupWitnesses.completedByLuck, false);
  const hit = match(run, index);
  assert.equal(hit.status, 'partial');
  assert.ok(hit.sourceFactIds.includes(before.factId) && hit.sourceFactIds.includes(after.factId));
 }
});

test('the same annual Tiger links to the root on each individual Geng path without borrowing the other Shen', () => {
 const example = { date: [1960, 6, 25], hour: 16, gender: 0, year: 1998, luck: '戊寅',
  natal: ['庚子', '壬午', '甲申', '壬申'] };
 const run = submitted(example);
 const fact = rows(run).find(({ normalizedPayload: p }) => p.confirmed && p.luckPillar === example.luck && p.annualPillar === '戊寅');
 const before = rows(run).find(row => row.activeTo === fact?.activeFrom && row.normalizedPayload.luckPillar === example.luck);
 assert.ok(before && fact);
 const paths = fact.normalizedPayload.fireMeetingPaths;
 assert.deepEqual(paths.map(path => [path.root.position, path.annualClashes.map(link => link.target.position)]), [
  ['day', ['day']], ['hour', ['hour']],
 ]);
 assert.ok(before.normalizedPayload.fireMeetingPaths.every(path => path.annualClashes.length === 0));
 const hit = match(run, 95);
 assert.equal(hit.status, 'partial');
 assert.ok(hit.sourceFactIds.includes(before.factId) && hit.sourceFactIds.includes(fact.factId));
});

test('p053 retains the independent natal, luck and annual clashes against their actual fire and metal seats', () => {
 const example = ref.fireExamples.find(row => row.gengInBothLayouts), run = submitted({ ...example, year: 2028 });
 const hit = match(run, 95);
 const fact = rows(run).find(row => row.normalizedPayload.luckPillar === '戊寅' && row.normalizedPayload.annualPillar === '戊申');
 assert.ok(fact && hit.sourceFactIds.includes(fact.factId));
 const data = fact.normalizedPayload, [path] = data.fireMeetingPaths;
 assert.deepEqual(data.fireMeetingPaths.map(row => row.target.position), ['year']);
 assert.deepEqual(path.betweenStemAndWu.map(row => row.position), ['month', 'day']);
 assert.deepEqual(path.betweenRootAndWu.map(row => row.position), ['day']);
 assert.deepEqual(path.rootClashes.map(pair => pair.members.map(row => [row.position, row.pillar])),
  [[['month', '甲申'], ['decadal', '戊寅']]]);
 assert.deepEqual(path.wuClashes.map(pair => pair.members.map(row => [row.position, row.pillar])),
  [[['day', '甲子'], ['hour', '庚午']]]);
 assert.deepEqual(data.annualFireMeetingClashes.map(row => [row.annual.pillar, row.target.position, row.target.pillar]),
  [['戊申', 'decadal', '戊寅']]);
 assert.deepEqual(path.annualClashes, data.annualFireMeetingClashes);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'fire-meeting-clashes'));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /本段会位或根位所涉六冲为月柱甲申与本步大运戊寅/u);
 assert.match(prompt, /本段太岁戊申六冲本步大运戊寅/u);
 assert.doesNotMatch(prompt, /fireMeetingPaths|annualFireMeetingClashes|rootColumnDistance/u);
});

test('thirteen real calendars keep exact natal columns, verified luck stages and fact provenance',()=>{
 for(const i of indices){const run=real(i),e=ref.calendarExamples[i];validateFortuneFacts(run);assert.equal(match(run,i).status,completeIndices.has(i)?'matched':'partial',String(i));const selected=rows(run).filter(f=>f.normalizedPayload.confirmed&&f.normalizedPayload.luckPillar===e.luck);assert.ok(selected.length);
  for(const f of selected){assert.deepEqual(f.normalizedPayload.natalPillars.map(r=>r.pillar),e.natal);assert.ok(f.subjectIds.includes('flow:year'));assert.ok(f.normalizedPayload.stageStart<=f.activeFrom&&f.activeTo<=f.normalizedPayload.stageEnd);assert.ok(f.sourceFactIds.every(id=>run.rawFacts.some(raw=>raw.rawFactId===id)));}}
});

test('thirteen SQLite rows keep their source hashes and distinguish verified relationships from open effects',()=>{
 for(const i of indices){const r=fortuneKnowledge.bazi.rules[i],e=fortuneKnowledge.bazi.entries.find(e=>e.id===r.knowledgeId);assert.equal(r.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:e.evidence,conditions:e.conditions})).digest('hex'));assert.equal(r.queries.length,1);assert.equal(r.queries[0].factType,'zpqz_moving_relations');assert.equal(r.queries[0].where.stemBranchProfile,zpqzStemBranchPolicy.profile);assert.equal(r.unresolved.length,completeIndices.has(i)?0:1);}
 assert.match(fortuneKnowledge.bazi.rules[76].review.sourceCorrections.join(),/不能改写为午藏丙劫财/u);
 const returns=fortuneKnowledge.bazi.rules[89];
 assert.match(returns.review.sourceCorrections.join(),/申与卯或酉与寅/u);
 assert.match(returns.review.mappedConditions.join(),/未运的虚会按第 117 条独立处理/u);
});

test('generic, missing-subprofile and split Jia/Ren evidence cannot manufacture a new atomic premise across candidates',()=>{
 const missing=structuredClone(real(88));missing.facts=missing.facts.filter(f=>f.factType!=='zpqz_moving_relations');assert.equal(match(missing,88).status,'unknown');
 const old=structuredClone(real(88));rows(old).forEach(f=>delete f.normalizedPayload.stemBranchProfile);assert.equal(match(old,88).status,'unknown');
 const split=structuredClone(real(88));for(const f of rows(split)){const other=structuredClone(f);other.factId+='-separate';f.normalizedPayload.natalExposedStems=['甲'];other.normalizedPayload.natalExposedStems=['壬'];split.facts.push(other);}assert.equal(match(split,88).status,'not_matched');
});

test('actual provider receives Chinese stem/branch components and source limits without raw machine JSON, private IDs or partial source paragraphs',async()=>{
 const run=real(94),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'stem-branch-private-report'));
 const fact=input.facts.find(f=>f.type==='zpqz_moving_relations');assert.ok(fact);assert.equal(fact.data.stemBranchProfile,zpqzStemBranchPolicy.profile);const prompt=formatFortuneFactAudit(input);
 for(const phrase of ['运支各藏干不能合为一个运干','不隔二位','不同柱','两支会意不预先要求三支齐全','四库支中的实际藏气不等同戊己运干'])assert.ok(prompt.includes(phrase),phrase);
 for(const key of ['stem-branch-private','zpqz-stem-branch-components','movingComponentContacts','natalComponentContacts','stemLuCoordinates','fireTargetLayouts','stageStart'])assert.ok(!prompt.includes(key),key);
 assert.ok(!input.sections.flatMap(s=>s.findings).some(f=>indices.some(i=>!completeIndices.has(i)&&fortuneKnowledge.bazi.rules[i].knowledgeId===f.knowledgeId)));
 assert.ok(!/[{}\[\]]/u.test(describeFortuneFact({method:'bazi',type:'zpqz_moving_relations',data:ctx()},String)));
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await provider.interpret(input);
});
