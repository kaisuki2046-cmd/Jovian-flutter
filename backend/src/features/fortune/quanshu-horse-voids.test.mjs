import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {astro} from 'iztro';
import {LunarUtil} from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import {describeFortuneFact,formatFortuneFactAudit, formatFortunePrompt} from './control/fortune-prompt.mjs';
import {createFortuneDeepSeek} from './server/deepseek-expression.mjs';
const {quanshuBirthVoidPairs,quanshuHorseVoidCondition,quanshuHorseVoidPolicy}=await import('./control/ziwei-horse-voids.ts');
const {quanshuFireBellCondition,quanshuHorseBranch}=await import('./control/ziwei-firebell.ts');
const {quanshuGrowthAtBranch}=await import('./control/ziwei-growth-stages.ts');
const {quanshuLimitPhase,quanshuLunarMidnight,quanshuLuYangTuo,quanshuMinorLimit}=await import('./control/ziwei-quanshu.ts');
const {calculateFortuneFacts,validateFortuneFacts}=await import('./control/fortune-facts.ts');
const {buildFactTimeContext}=await import('./control/fact-time-context.ts');
const {buildFortuneFactSubmission}=await import('./control/fortune-fact-submission.ts');
const {bindClientFortuneRun,readClientFactTime}=await import('./server/client-facts.mjs');
const {matchFortuneKnowledge}=await import('./control/knowledge/match.ts');
const {evaluateFortuneRules,fortuneKnowledge}=await import('./control/knowledge/catalog.ts');
const {interpretFortune,requestForFortuneRun}=await import('./control/fortune-interpretation.ts');
const {buildFortuneModelContext}=await import('./control/fortune-model-context.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/quanshu-horse-void-reference.json',import.meta.url)));
const config={yearDivide:'normal',horoscopeDivide:'normal',ageDivide:'normal',dayDivide:'current'};
const branches=[...'子丑寅卯辰巳午未申酉戌亥'],stems=[...'甲乙丙丁戊己庚辛壬癸'];
const all=p=>[...p.majorStars,...p.minorStars,...p.adjectiveStars];
const native=(name='cut')=>{const {year,birthYearPillar,horse,cutAtHorse,xunAtHorse,natalChang,...args}=ref.cases[name];return astro.withOptions({...args,fixLeap:true,config}).toJSON();};
const chart=n=>({timeKnown:true,bazi:{rawResult:[]},western:{rawResult:[]},ziwei:{engineName:'iztro',engineVersion:'2.6.5',rulesetVersion:'standard-new-year-leap-split-late-zi-current-v1',rawResult:[n]}});
function calculate(n,year){const input={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year}};return calculateFortuneFacts(input,buildFactTimeContext(input,Date.parse(year+'-11-19T00:00:00Z'),'server'),'horse-void-run',{snapshotId:'horse-void-snapshot',chart:chart(n)});}
const cache=new Map(),real=name=>{if(!cache.has(name))cache.set(name,calculate(native(name),ref.cases[name].year));return cache.get(name);};
const rows=run=>run.facts.filter(f=>f.factType==='quanshu_horse_void_context');
const match=(run,i)=>matchFortuneKnowledge(run).byMethod.ziwei[i];
function condition(n=native(),year=2028){const branch=branches[(year-4)%12],index=n.palaces.find(p=>p.earthlyBranch===branch).index;return quanshuHorseVoidCondition(n,index,index,year,'yearly',index,index);}
function annual(name, run = real(name)) {
 const facts = run.facts.filter(f => f.factType !== 'quanshu_horse_void_context'
   || (f.scope === 'yearly' && f.normalizedPayload.lunarYear === ref.cases[name].year));
 const fact = facts.find(f => f.factType === 'quanshu_horse_void_context');
 assert.ok(fact, name);
 return { run: { ...run, facts }, fact, data: fact.normalizedPayload };
}

test('all sixty birth years reproduce every printed cut-void and xun pair, with an independent engine xun check and no day-year substitution',()=>{
 const seen=new Set();
 for(let i=0;i<60;i++){const pillar=stems[i%10]+branches[i%12],p=quanshuBirthVoidPairs(pillar);
  assert.equal(p.cutVoidPair.join(''),ref.cutPairsByStem[pillar[0]]);assert.equal(p.xunVoidPair.join(''),ref.xunPairsByHead[p.xunHead]);
  assert.equal(p.xunVoidPair.join(''),LunarUtil.getXunKong(pillar));seen.add(p.xunHead);
  assert.equal(p.cutVoidPair.length,2);assert.equal(p.xunVoidPair.length,2);
 }
 assert.equal(seen.size,6);assert.deepEqual(quanshuBirthVoidPairs('甲午').xunVoidPair,['辰','巳']);
 for(const value of ['',null,'甲丑','甲子旬','丙'])assert.throws(()=>quanshuBirthVoidPairs(value));
});

test('all twelve year-branch horse positions match the source and stay independent of yearly reapplication candidates',()=>{
 for(const [year,horse]of Object.entries(ref.horseByYearBranch)){
  assert.equal(quanshuHorseBranch(year),horse);
  assert.notEqual(year,horse);
 }
 const p=condition();assert.equal(p.horseBranch,'申');assert.equal(p.annualHorseCandidateBranch,'寅');
 assert.equal(p.natalHorseAtFocus,true);assert.equal(p.annualHorseAtFocus,false);assert.equal(p.annualHorseRuleVerified,false);assert.equal(p.annualVoidRuleVerified,false);
 assert.equal(p.yearPillar,'甲午');assert.notEqual(p.annualVoidCandidates.yearPillar,p.yearPillar);
});

test('Ming Horse never shares the Tai Sui palace with the source small limit when Tai Sui visits it', () => {
 const horseBranches = new Set(branches.map(quanshuHorseBranch));
 for (const stem of stems) assert.ok(!horseBranches.has(quanshuLuYangTuo(stem).qingyangBranch));
 let annualHorseVisits = 0;
 for (const [birthIndex, birthBranch] of branches.entries()) {
   const horseBranch = quanshuHorseBranch(birthBranch);
   for (let age = 1; age <= 12; age++) {
     if (branches[(birthIndex + age - 1) % 12] !== horseBranch) continue;
     for (const gender of ['男', '女']) {
       assert.notEqual(quanshuMinorLimit(birthBranch, gender, age).branch, horseBranch);
       annualHorseVisits++;
     }
   }
 }
 assert.equal(annualHorseVisits, 24);
});

test('the source Horse at an extinct stage can be verified separately from voids and actual limits', () => {
 const horseBranches = [...new Set(branches.map(quanshuHorseBranch))];
 for (const bureau of ['水二局', '木三局', '金四局', '土五局', '火六局']) for (const gender of ['男', '女']) {
   const phases = horseBranches.map(branch => quanshuGrowthAtBranch(bureau, gender, branch).phase);
   assert.ok(!phases.includes('死'));
   assert.equal(phases.filter(phase => phase === '绝').length, 1);
 }
 const birth = { dateStr: '1947-02-05', timeIndex: 7, gender: '男', fixLeap: true, config };
 const engine = astro.withOptions(birth), natal = engine.toJSON();
 let representative;
 for (const [year, atDecade] of [[1977, true], [1989, false]]) {
   const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
   const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'native-horse-extinct', chart: chart(natal) };
   const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
   const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
   validateFortuneFacts(bound);
   const fact = rows(bound).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === year);
   const data = fact.normalizedPayload, run = { ...bound, facts: [fact] };
   assert.deepEqual(data.horseGrowth, { profile: 'quanshu-volume-two-bureau-growth-by-gender-v1', bureau: '水二局',
     origin: '申', direction: '顺排', branch: '巳', phase: '绝' });
   assert.deepEqual([data.annualBranch, data.sourceDecadal.verified, data.sourceDecadal.branch === '巳', data.minorBranch === '巳'],
     ['巳', true, atDecade, false]);
   assert.deepEqual([data.horseDeadOrExtinctStageCandidate, data.horseCutVoidCandidate, data.horseXunVoidCandidate, data.horseSkyVoidCandidate],
     [true, false, false, false]);
   const hit = match(run, 62);
   assert.equal(hit.status, 'matched');
   assert.equal(hit.matchedSourceExcerpt, '居绝死谓之死马');
   assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
   assert.equal(match(run, 63).status, 'matched');
   assert.equal(match(run, 60).status, 'not_matched');
   representative = { run, fact, year };
 }
 const { run, fact, year } = representative;
 const knowledgeId = match(run, 62).knowledgeId;
 const confirm = normalizedPayload => evaluateFortuneRules('ziwei', 'year', [{ ...fact, normalizedPayload }])
   .find(rule => rule.knowledgeId === knowledgeId).confirmations
   .find(row => row.condition.includes('horseDeadOrExtinctStageCandidate'));
 const conditionAtYear = (archive, chartEngine, lunarYear) => {
   const h = chartEngine.horoscope(lunarYear + '-06-01', 6);
   return quanshuHorseVoidCondition(archive, h.yearly.index, h.yearly.index, lunarYear, 'yearly', h.decadal.index, h.age.index);
 };
 const nearby = conditionAtYear(natal, engine, year + 1);
 assert.equal(nearby.horseDeadOrExtinctStageCandidate, false);
 assert.deepEqual([confirm(nearby).hits.length, confirm(nearby).unknown], [0, false]);
 const badBureau = conditionAtYear({ ...natal, fiveElementsClass: '木三局' }, engine, year);
 assert.equal(badBureau.horseDeadOrExtinctStageCandidate, undefined);
 assert.deepEqual([confirm(badBureau).hits.length, confirm(badBureau).unknown], [0, true]);
 const oppositeGender = astro.withOptions({ ...birth, gender: '女' });
 const normalStage = conditionAtYear(oppositeGender.toJSON(), oppositeGender, year);
 assert.equal(normalStage.horseGrowth.phase, '临官');
 assert.equal(normalStage.horseDeadOrExtinctStageCandidate, false);
 assert.deepEqual([confirm(normalStage).hits.length, confirm(normalStage).unknown], [0, false]);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'horse-extinct'));
 const localPlacement = /按卷二复算水二局，申起长生顺排，本命天马实在巳宫绝位，太岁也实临此宫/u;
 assert.match(formatFortuneFactAudit(input), localPlacement);
 const provider = formatFortunePrompt(input);
 assert.match(provider, /居绝死谓之死马/u);
 assert.doesNotMatch(provider, localPlacement);
 assert.doesNotMatch(provider, /逢空亡谓之死马|horseDeadOrExtinctStageCandidate|巳宫绝位/u);
});

test('two real charts separate horse meeting the cut pair from horse meeting the xun pair, without selecting a principal or secondary star',()=>{
 for(const name of ['cut','xun']){const e=ref.cases[name],p=condition(native(name),e.year);assert.equal(p.ready,true);assert.equal(p.yearPillar,e.birthYearPillar);assert.equal(p.horseBranch,e.horse);
  assert.equal(p.groups.find(g=>g.kind==='截路空亡').atHorse,e.cutAtHorse);assert.equal(p.groups.find(g=>g.kind==='旬中空亡').atHorse,e.xunAtHorse);
  assert.ok(p.groups.every(g=>g.members.length===2&&g.members.every(m=>m.horseRelation)));
  assert.ok(p.groups.every(g=>!('primaryStar'in g)&&!('secondaryStar'in g)));
 }
});

test('archive names and modern Sky positions cannot overwrite independent source pairs or the source-hour Sky mapping',()=>{
 const n=native(),p=condition(n);assert.ok(p.sourceSkyReady);assert.ok(p.archiveVoids.some(s=>s.star==='截路'));
 const copy=structuredClone(n),from=copy.palaces.find(p=>all(p).some(s=>s.name==='截路'));
 const array=['minorStars','adjectiveStars'].find(k=>from[k].some(s=>s.name==='截路')),index=from[array].findIndex(s=>s.name==='截路');
 const [star]=from[array].splice(index,1);copy.palaces.find(p=>p.earthlyBranch==='子')[array].push(star);
 const changed=condition(copy);assert.equal(changed.ready,true);assert.deepEqual(changed.groups,p.groups);
 assert.equal(changed.archiveVoids.find(s=>s.star==='截路').branch,'子');
 assert.equal(p.sourceVoids.find(s=>s.kind==='古天空').branch,n.palaces.find(p=>all(p).some(s=>s.name==='地空')).earthlyBranch);
});

test('source horse verification and scope geometry reject duplicate, missing, shifted, wrong-year or inconsistent palaces',()=>{
 const n=native(),annualIndex=n.palaces.find(p=>p.earthlyBranch==='申').index;
 for(const modify of [n=>{const p=n.palaces.find(p=>all(p).some(s=>s.name==='天马'));p.minorStars=p.minorStars.filter(s=>s.name!=='天马');},
  n=>{const p=n.palaces.find(p=>all(p).some(s=>s.name==='天马'));p.minorStars.push(p.minorStars.find(s=>s.name==='天马'));},
  n=>{n.rawDates.chineseDate.yearly[1]='子';}]){
  const copy=structuredClone(n);modify(copy);assert.equal(condition(copy).ready,false);
 }
 assert.equal(quanshuHorseVoidCondition(n,(annualIndex+1)%12,annualIndex,2028,'yearly',annualIndex,annualIndex).ready,false);
 assert.equal(quanshuHorseVoidCondition(n,annualIndex,annualIndex,2027,'yearly',annualIndex,annualIndex).ready,false);
 assert.equal(condition(n,2004).ready,false);
});

test('real scope writer binds one native horse, actual year and both limit fragments with complete provenance',()=>{
 for(const name of ['cut','xun','minor']){const run=real(name);validateFortuneFacts(run);assert.notEqual(run.methods.ziwei.status,'failed');assert.ok(rows(run).length);
  for(const row of rows(run)){const p=row.normalizedPayload,source=run.rawFacts.find(raw=>row.sourceFactIds.includes(raw.rawFactId)&&raw.payload.policy?.profile===quanshuHorseVoidPolicy.profile);
   assert.ok(source);assert.equal(p.scope,row.scope);assert.equal(source.payload.interval.year.lunarYear,p.lunarYear);
   assert.ok(row.sourceFactIds.length>=2&&row.sourceFactIds.every(id=>run.rawFacts.some(raw=>raw.rawFactId===id)));
   assert.ok(p.scopeRelations.some(r=>r.scope===row.scope&&r.branch===p.branch));
  }
 }
});

test('horse-void SQLite entries retain source provenance and horse positions alone cannot replace moving Chang',()=>{
 const r=real('minor');
 const atHorse=rows(r).find(f=>f.normalizedPayload.natalHorseAtFocus&&f.scope==='minor');assert.ok(atHorse);
 const chang=atHorse.normalizedPayload.natalAuxiliary.find(s=>s.star==='文昌');assert.equal(chang.branch,'未');assert.equal(chang.horseRelation,'邻宫');
 // A known natal Chang outside the four-palace area cannot stand for an
 // dynamic Chang supplied by the separate literary condition.
 assert.equal(atHorse.normalizedPayload.flowChangRuleVerified,false);
 for(const i of [59,60,62,63]){const rule=fortuneKnowledge.ziwei.rules[i],e=fortuneKnowledge.ziwei.entries.find(e=>e.id===rule.knowledgeId);
  assert.equal(rule.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:e.evidence,conditions:e.conditions})).digest('hex'));
  assert.equal(rule.queries[0].factType,i===59?'quanshu_literary_limits':'quanshu_horse_void_context');
  assert.equal(rule.unresolved.length === 0, i === 60 || i === 63);
 }
 const removed=structuredClone(real('cut'));removed.facts=removed.facts.filter(f=>f.factType!=='quanshu_horse_void_context');assert.equal(match(removed,62).status,'unknown');
 const wrong=structuredClone(real('cut'));rows(wrong).forEach(f=>{f.normalizedPayload.profile='other';});assert.equal(match(wrong,62).status,'not_matched');
});

test('the horse, Tianxing and Qisha have to share one actual year palace', () => {
 const { run, fact, data } = annual('xingShaTogether');
 assert.equal(data.horseBranch, '巳');
 assert.deepEqual(data.companions.filter(row => row.star === '天刑' || row.star === '七杀')
   .map(row => [row.star, row.horseRelation]), [['七杀', '守'], ['天刑', '守']]);
 assert.deepEqual(data.xingShaSeatProof, {
   tianxingBranch: '巳', ziweiBranch: '巳', ziweiExpectedBranch: '巳', ziweiVerified: true,
   tianfuBranch: '亥', tianfuExpectedBranch: '亥', tianfuVerified: true,
   qishaBranch: '巳', qishaExpectedBranch: '巳', qishaVerified: true,
 });
 assert.equal(data.horseTianxingQishaCandidate, true);
 assert.equal(data.lifeHorseXingShaAtVerifiedLimit, true);
 assert.equal(data.horseXingShaAnnualCandidate, false);
 const result = match(run, 60);
 assert.equal(result.status, 'matched');
 assert.deepEqual(result.unresolvedConditions, []);
 assert.equal(result.matchedSourceExcerpt, '刑杀同宫');
 assert.deepEqual(result.sourceFactIds, [fact.factId]);
 assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: { ...data, xingShaNatalZiweiPlacementProof: undefined } }] }, 60).status, 'unknown');
 const single = annual('xingOnly');
 assert.ok(single.data.natalHorseAtFocus);
 assert.equal(single.data.companions.find(row => row.star === '七杀').horseRelation, '三合');
 assert.equal(match(single.run, 60).status, 'not_matched');
 const next = annual('xingShaOtherYear');
 assert.equal(next.data.natalHorseAtFocus, false);
 assert.equal(match(next.run, 60).status, 'not_matched');
 const later = calculate(native('xingShaTogether'), 2013);
 const laterFact = rows(later).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === 2013);
 const laterData = laterFact.normalizedPayload;
 assert.equal(laterData.horseTianxingQishaCandidate, true);
 assert.deepEqual([laterData.lifeHorseXingShaAtVerifiedLimit, laterData.nonLifeHorseXingShaAtVerifiedDecade], [false, false]);
 assert.equal(laterData.horseXingShaAnnualCandidate, true);
 assert.ok([laterData.sourceDecadal, laterData.sourceMinor].every(limit => limit.verified && limit.branch !== laterData.horseBranch));
 const laterRun = { ...later, facts: [laterFact] };
 const laterHit = match(laterRun, 60);
 assert.equal(laterHit.status, 'matched');
 assert.equal(laterHit.matchedSourceExcerpt, '刑杀同宫');
 assert.deepEqual(laterHit.sourceFactIds, [laterFact.factId]);
 assert.deepEqual(laterHit.windows, [{ start: laterFact.activeFrom, endExclusive: laterFact.activeTo }]);
 const older = { ...laterFact, normalizedPayload: { ...laterData, horseXingShaAnnualCandidate: undefined } };
 assert.equal(match({ ...later, facts: [older] }, 60).status, 'unknown');
 const laterModel = buildFortuneModelContext(laterRun, interpretFortune(laterRun, requestForFortuneRun(laterRun), 'horse-tai-sui-after-limits'));
 const laterPrompt = formatFortunePrompt(laterModel.input);
 assert.match(laterPrompt, /此处采用原书独立流年条件/u);
 assert.doesNotMatch(laterPrompt, /太岁到巳宫|horseTianxingQishaCandidate|lifeHorseXingShaAtVerifiedLimit/u);
 const n = native('xingShaTogether');
 for (const palace of n.palaces) for (const key of ['minorStars', 'adjectiveStars']) {
   palace[key] = palace[key].filter(row => row.name !== '天刑');
 }
 assert.equal(condition(n, 2001).horseTianxingQishaCandidate, undefined);
 const forged = native('xingOnly');
 const misplaced = forged.palaces.find(palace => palace.majorStars.some(row => row.name === '七杀'));
 const [qisha] = misplaced.majorStars.splice(misplaced.majorStars.findIndex(row => row.name === '七杀'), 1);
 forged.palaces.find(palace => palace.earthlyBranch === single.data.horseBranch).majorStars.push(qisha);
 const badSeat = condition(forged, 2007);
 assert.equal(badSeat.companions.find(row => row.star === '七杀').horseRelation, '守');
 assert.equal(badSeat.xingShaSeatProof.qishaVerified, false);
 assert.equal(badSeat.xingShaSeatProof.qishaExpectedBranch, misplaced.earthlyBranch);
 assert.equal(badSeat.horseTianxingQishaCandidate, undefined);
 const evaluated = evaluateFortuneRules('ziwei', 'year', [{ factType: 'quanshu_horse_void_context', scope: 'yearly',
   completeness: 'complete', normalizedPayload: badSeat }]).find(row => row.knowledgeId === result.knowledgeId);
 assert.deepEqual([evaluated.required[0].hits.length, evaluated.required[0].unknown], [0, true]);
 const tianfuSeat = forged.palaces.find(palace => palace.majorStars.some(row => row.name === '天府'));
 const [tianfu] = tianfuSeat.majorStars.splice(tianfuSeat.majorStars.findIndex(row => row.name === '天府'), 1);
 forged.palaces.find(palace => palace.earthlyBranch === '巳').majorStars.push(tianfu);
 const transposedPair = condition(forged, 2007);
 assert.equal(transposedPair.xingShaSeatProof.tianfuBranch, '巳');
 assert.equal(transposedPair.xingShaSeatProof.tianfuVerified, false);
 assert.equal(transposedPair.xingShaSeatProof.qishaBranch, '亥');
 assert.equal(transposedPair.horseTianxingQishaCandidate, undefined);
 const pairQuery = evaluateFortuneRules('ziwei', 'year', [{ factType: 'quanshu_horse_void_context', scope: 'yearly',
   completeness: 'complete', normalizedPayload: transposedPair }]).find(row => row.knowledgeId === result.knowledgeId);
 assert.deepEqual([pairQuery.required[0].hits.length, pairQuery.required[0].unknown], [0, true]);
 const transposed = native('xingOnly');
 for (const [star, branch] of [['紫微', '亥'], ['天府', '巳'], ['七杀', '亥']]) {
   const origin = transposed.palaces.find(palace => palace.majorStars.some(row => row.name === star));
   const [archived] = origin.majorStars.splice(origin.majorStars.findIndex(row => row.name === star), 1);
   transposed.palaces.find(palace => palace.earthlyBranch === branch).majorStars.push(archived);
 }
 const coherentWrongSeat = condition(transposed, 2007);
 assert.equal(coherentWrongSeat.horseBranch, '亥');
 assert.deepEqual(coherentWrongSeat.xingShaSeatProof,
   { tianxingBranch: '亥', ziweiBranch: '亥', ziweiExpectedBranch: single.data.xingShaSeatProof.ziweiBranch, ziweiVerified: false,
     tianfuBranch: '巳', tianfuExpectedBranch: single.data.xingShaSeatProof.tianfuBranch, tianfuVerified: false,
     qishaBranch: '亥', qishaExpectedBranch: single.data.xingShaSeatProof.qishaBranch, qishaVerified: false });
 assert.equal(coherentWrongSeat.horseTianxingQishaCandidate, undefined);
 assert.equal(match({ ...single.run, facts: [{ ...single.fact, normalizedPayload: coherentWrongSeat }] }, 60).status, 'unknown');
 const wrongBirthDay = native('xingShaTogether');
 wrongBirthDay.rawDates.lunarDate.lunarDay += 1;
 const wrongBirth = condition(wrongBirthDay, 2001);
 assert.equal(wrongBirth.xingShaSeatProof.ziweiExpectedBranch, undefined);
 assert.equal(wrongBirth.horseTianxingQishaCandidate, undefined);
 assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: wrongBirth }] }, 60).status, 'unknown');
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'horse-xing-sha'));
 assert.match(formatFortuneFactAudit(input), /太岁到巳宫，本命天马与天刑、七杀同守/u);
 assert.match(formatFortunePrompt(input), /太岁和至少一层复算限宫也到该宫/u);
 assert.doesNotMatch(formatFortunePrompt(input), /负尸马|lifeHorseXingShaAtVerifiedLimit/u);
});

test('the Ming non-Life Horse, Tianxing and Qisha share the actual annual and decadal palace', () => {
 const year = 1965, now = Date.UTC(year, 5, 1);
 const engine = astro.withOptions({ dateStr: '1947-10-23', timeIndex: 6, gender: '女', fixLeap: true, config });
 const natal = engine.toJSON();
 const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
 const archive = { snapshotId: 'ming-non-life-horse', chart: chart(natal) };
 const submission = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
 const bound = bindClientFortuneRun(params, submission, readClientFactTime(params, submission, now), archive.snapshotId, archive);
 validateFortuneFacts(bound);
 const fact = rows(bound).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === year);
 assert.ok(fact);
 const data = fact.normalizedPayload;
 assert.equal(data.xingShaNatalZiweiPlacementProof, 'quanshu-natal-ziwei-bureau-lunar-day-v1');
 assert.deepEqual([data.xingShaSeatProof.ziweiExpectedBranch, data.xingShaSeatProof.ziweiVerified], ['巳', true]);
 assert.equal(data.natalName, '父母');
 assert.deepEqual([data.horseBranch, data.annualBranch, data.sourceDecadal.branch, data.sourceMinor.branch], ['巳', '巳', '巳', '未']);
 assert.deepEqual([data.sourceDecadal.verified, data.sourceMinor.verified], [true, true]);
 assert.equal(data.lifeHorseXingShaAtVerifiedLimit, false);
 assert.equal(data.nonLifeHorseXingShaAtVerifiedDecade, true);
 assert.equal(data.horseXingShaAnnualCandidate, false);
 const forFact = normalizedPayload => ({ ...bound, facts: [{ ...fact, normalizedPayload }] });
 const hit = match(bound, 60);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '刑杀同宫');
 assert.deepEqual(hit.sourceFactIds, [fact.factId]);
 assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
 const { input } = buildFortuneModelContext(bound, interpretFortune(bound, requestForFortuneRun(bound), archive.snapshotId));
 const auditPhrase = /复算大限也实守巳宫的本命父母宫/u;
 assert.match(formatFortuneFactAudit(input), auditPhrase);
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /本命天马、天刑及七杀实守同一个非命宫/u);
 assert.doesNotMatch(prompt, auditPhrase);
 assert.doesNotMatch(prompt, /nonLifeHorseXingShaAtVerifiedDecade/u);

 const horoscope = engine.horoscope(year + '-06-01', 6);
 const movingStars = value => natal.palaces.map(palace => ({ branch: palace.earthlyBranch,
   movingStarIds: (value.yearly.stars?.[palace.index] ?? []).map(star => star.name) }));
 const evaluate = (source, decadalIndex = horoscope.decadal.index) => quanshuHorseVoidCondition(source,
   horoscope.yearly.index, horoscope.yearly.index, year, 'yearly', decadalIndex, horoscope.age.index, movingStars(horoscope));
 const wrongDecadal = evaluate(natal, (horoscope.decadal.index + 1) % 12);
 assert.equal(wrongDecadal.sourceDecadal.verified, false);
 assert.equal(wrongDecadal.nonLifeHorseXingShaAtVerifiedDecade, undefined);
 assert.equal(wrongDecadal.horseXingShaAnnualCandidate, true);
 const annualOnly = match(forFact(wrongDecadal), 60);
 assert.equal(annualOnly.status, 'matched');
 assert.equal(annualOnly.confirmedBranches, undefined);
 assert.match(annualOnly.matchedConditions.join(' '), /此处采用原书独立流年条件/u);

 const wrongLayer = structuredClone(natal);
 const horse = wrongLayer.palaces.find(palace => palace.earthlyBranch === data.horseBranch);
 const [tianxing] = horse.adjectiveStars.splice(horse.adjectiveStars.findIndex(star => star.name === '天刑'), 1);
 horse.minorStars.push(tianxing);
 const unprovenTianxing = evaluate(wrongLayer);
 assert.equal(unprovenTianxing.nonLifeHorseXingShaAtVerifiedDecade, undefined);
 assert.equal(unprovenTianxing.horseXingShaAnnualCandidate, undefined);
 assert.equal(match(forFact(unprovenTianxing), 60).status, 'unknown');

 const nextYear = engine.horoscope((year + 1) + '-06-01', 6);
 const displacedTaiSui = quanshuHorseVoidCondition(natal, nextYear.yearly.index, nextYear.yearly.index,
   year + 1, 'yearly', nextYear.decadal.index, nextYear.age.index, movingStars(nextYear));
 assert.equal(displacedTaiSui.nonLifeHorseXingShaAtVerifiedDecade, false);
 assert.equal(match(forFact(displacedTaiSui), 60).status, 'not_matched');
});

test('the two birth voids and the natal Tuo each need their own actual contacts', () => {
 const voidMatch = ({ run, fact }) => match({ ...run, facts: [{ ...fact,
   normalizedPayload: { ...fact.normalizedPayload, horseDeadOrExtinctStageCandidate: false } }] }, 62);
 for (const [name, expected] of [['cut', [true, false]], ['xun', [false, true]]]) {
   const { run, fact, data } = annual(name);
   assert.deepEqual([data.horseCutVoidCandidate, data.horseXunVoidCandidate], expected);
   const result = voidMatch({ run, fact });
   assert.equal(result.status, name === 'cut' ? 'matched' : 'partial');
   assert.deepEqual(result.sourceFactIds, [fact.factId]);
 }
 const external = annual('robberyOnly');
 assert.equal(external.data.sourceVoids.find(row => row.kind === '地劫').horseRelation, '守');
 assert.equal(voidMatch(external).status, 'not_matched');
 const name = 'tuoluoTogether', year = ref.cases[name].year, now = Date.UTC(year, 5, 1);
 const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
 const snapshot = { snapshotId: 'natal-horse-tuo', chart: chart(native(name)) };
 const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, snapshot)));
 const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), snapshot.snapshotId, snapshot);
 validateFortuneFacts(bound);
 const together = annual(name, bound), opposed = annual('tuoluoOpposed');
 assert.equal(together.data.tuoluoHorseRelation, '守');
 assert.equal(opposed.data.tuoluoHorseRelation, '冲');
 const hit = match(together.run, 63);
 assert.equal(hit.status, 'matched');
 assert.deepEqual(hit.unresolvedConditions, []);
 assert.deepEqual(hit.matchedConditions, ['按《全书》卷一，本命天马和本命陀罗同宫，所查流年太岁实临同宫。']);
 assert.deepEqual(hit.sourceFactIds, [together.fact.factId]);
 assert.deepEqual(hit.windows, [{ start: together.fact.activeFrom, endExclusive: together.fact.activeTo }]);
 assert.equal(hit.candidateWindows, undefined);
 const { input } = buildFortuneModelContext(together.run,
   interpretFortune(together.run, requestForFortuneRun(together.run), snapshot.snapshotId));
 assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /遇陀罗谓之折足马/u);
 assert.match(prompt, /本命天马和本命陀罗同宫，所查流年太岁实临同宫/u);
 assert.doesNotMatch(prompt, /horseTuoluoTogetherCandidate|horseArchiveLayerProof|亥宫/u);
 assert.equal(match(opposed.run, 63).status, 'not_matched');
});

test('Horse clauses require the original natal star layers and keep independent annual Tuo in the facts', () => {
 const layered = (chart, star, from, to, duplicate = false) => {
   const copy = structuredClone(chart);
   const palace = copy.palaces.find(row => row[from].some(placement => placement.name === star));
   const index = palace[from].findIndex(placement => placement.name === star);
   palace[to].push(duplicate ? palace[from][index] : palace[from].splice(index, 1)[0]);
   return copy;
 };
 const result = (data, index) => {
   const rule = evaluateFortuneRules('ziwei', 'year', [{ factType: 'quanshu_horse_void_context', scope: 'yearly',
     completeness: 'complete', normalizedPayload: data }]).find(row => row.knowledgeId === fortuneKnowledge.ziwei.rules[index].knowledgeId);
   return [rule.required[0].hits.length, rule.required[0].unknown];
 };
 const xingShaNatal = native('xingShaTogether');
 const positive = condition(xingShaNatal, 2001);
 assert.equal(positive.horseArchiveLayerProof, 'quanshu-horse-natal-star-layers-v1');
 assert.deepEqual(result(positive, 60), [1, false]);
 const { horseArchiveLayerProof, ...beforeProof } = positive;
 assert.deepEqual(result(beforeProof, 60), [0, true]);
 for (const [star, from, to, duplicate] of [
   ['天刑', 'adjectiveStars', 'minorStars'],
   ['七杀', 'majorStars', 'minorStars'],
   ['紫微', 'majorStars', 'adjectiveStars'],
   ['天府', 'majorStars', 'adjectiveStars'],
   ['七杀', 'majorStars', 'adjectiveStars', true],
 ]) {
   const rejected = condition(layered(xingShaNatal, star, from, to, duplicate), 2001);
   assert.equal(rejected.ready, true, star);
   assert.equal(rejected.horseTianxingQishaCandidate, undefined, star);
   assert.deepEqual(result(rejected, 60), [0, true], star);
 }
 const misguidedHorse = condition(layered(xingShaNatal, '天马', 'minorStars', 'adjectiveStars'), 2001);
 assert.deepEqual(misguidedHorse, { ready: false, reason: 'inconsistent_source_horse' });
 const natalTuo = native('tuoluoTogether');
 const matchedTuo = condition(natalTuo, 2007);
 const wrongTuo = condition(layered(natalTuo, '陀罗', 'minorStars', 'adjectiveStars'), 2007);
 assert.equal(matchedTuo.horseTuoluoTogetherCandidate, true);
 assert.equal(wrongTuo.horseTuoluoTogetherCandidate, undefined);
 assert.equal(wrongTuo.tuoluoHorseRelation, undefined);
 assert.deepEqual(result(matchedTuo, 63), [1, false]);
 assert.deepEqual(result(wrongTuo, 63), [0, true]);
 assert.equal(condition(natalTuo, 2008).horseTuoluoTogetherCandidate, false);
 const archive = astro.withOptions({ dateStr: '1991-10-15', timeIndex: 5, gender: '女', fixLeap: true, config });
 const h = archive.horoscope('2037-06-01', 6);
 const moving = xingShaNatal.palaces.map(p => ({ branch: p.earthlyBranch,
   movingStarIds: (h.yearly.stars?.[p.index] ?? []).map(star => star.name) }));
 const independent = quanshuHorseVoidCondition(layered(xingShaNatal, '陀罗', 'minorStars', 'adjectiveStars'),
   h.yearly.index, h.yearly.index, 2037, 'yearly', h.decadal.index, h.age.index, moving);
 assert.equal(independent.horseTuoluoTogetherCandidate, undefined);
 assert.equal(independent.horseAnnualTuoluoCandidate, true);
 assert.deepEqual(result(independent, 63), [0, true]);
});

test('p013 confirms the co-seated natal Seven Killings and Lu Horse in the source Xun void at a real limit', () => {
 const matchingXunYears = [], matchingCutYears = [];
 for (let i = 0; i < 60; i++) {
   const stem = stems[i % 10], birthBranch = branches[i % 12];
   const horse = quanshuHorseBranch(birthBranch);
   if (quanshuLuYangTuo(stem).lucunBranch !== horse) continue;
   const birthYear = stem + birthBranch, { cutVoidPair, xunVoidPair } = quanshuBirthVoidPairs(birthYear);
   if (cutVoidPair.includes(horse)) matchingCutYears.push(birthYear);
   if (xunVoidPair.includes(horse)) matchingXunYears.push(birthYear);
 }
 assert.deepEqual(matchingCutYears, []);
 assert.deepEqual(matchingXunYears, ['甲辰']);

 const year = 1986, now = Date.UTC(year, 5, 1);
 const engine = astro.withOptions({ dateStr: '1964-02-27', timeIndex: 2, gender: '男', fixLeap: true, config });
 const natal = engine.toJSON();
 const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
 const archive = { snapshotId: 'horse-lu-qisha-xun', chart: chart(natal) };
 const submitted = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
 const bound = bindClientFortuneRun(params, submitted, readClientFactTime(params, submitted, now), archive.snapshotId, archive);
 validateFortuneFacts(bound);
 const fact = rows(bound).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === year);
 assert.ok(fact);
 const data = fact.normalizedPayload;
 assert.deepEqual([data.horseBranch, data.annualBranch, data.sourceDecadal.branch, data.sourceMinor.branch], ['寅', '寅', '寅', '申']);
 assert.deepEqual(data.companions.filter(row => ['禄存', '七杀'].includes(row.star)).map(row => [row.star, row.branch]),
   [['禄存', '寅'], ['七杀', '寅']]);
 assert.equal(data.horseLuQishaXunVoidGuardCandidate, true);
 assert.deepEqual([data.horseXunVoidCandidate, data.mingHorseLifeBodyXunVoidAnnualCandidate, data.horseCutVoidCandidate,
   data.horseSkyVoidCandidate, data.horseDeadOrExtinctStageCandidate], [true, false, false, false, false]);
 const isolate = normalizedPayload => ({ ...bound, facts: [{ ...fact, normalizedPayload }] });
 const run = isolate(data), hit = match(run, 62);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '限逢七殺祿馬空亡');
 assert.deepEqual(hit.sourceFactIds, [fact.factId]);
 assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
 assert.match(formatFortunePrompt(input), /限逢七殺祿馬空亡/u);
 assert.doesNotMatch(formatFortunePrompt(input), /寅宫|horseLuQishaXunVoidGuardCandidate/u);
 assert.equal(match(isolate({ ...data, xingShaNatalZiweiPlacementProof: undefined }), 62).status, 'partial');

 const fromChart = (currentYear, currentNatal = natal) => {
   const h = engine.horoscope(currentYear + '-06-01', 6);
   return quanshuHorseVoidCondition(currentNatal, h.yearly.index, h.yearly.index, currentYear, 'yearly', h.decadal.index, h.age.index);
 };
 const neighboring = fromChart(1987), laterTaiSui = fromChart(1998);
 assert.deepEqual([neighboring.horseXunVoidCandidate, neighboring.horseLuQishaXunVoidGuardCandidate], [false, false]);
 assert.deepEqual([laterTaiSui.horseXunVoidCandidate, laterTaiSui.horseLuQishaXunVoidGuardCandidate], [true, false]);
 const wronglyLayered = structuredClone(natal);
 const horse = wronglyLayered.palaces.find(palace => palace.earthlyBranch === data.horseBranch);
 const [qisha] = horse.majorStars.splice(horse.majorStars.findIndex(star => star.name === '七杀'), 1);
 horse.adjectiveStars.push(qisha);
 const unknown = fromChart(year, wronglyLayered);
 assert.equal(unknown.horseXunVoidCandidate, true);
 assert.equal(unknown.horseLuQishaXunVoidGuardCandidate, undefined);
 assert.equal(match(isolate(unknown), 62).status, 'partial');
});

test('p013 Ming Horse at Tai Sui guards a real limit with the cut void or the named two voids', () => {
  for (const [dateStr, year, branch, expected] of [
    ['1974-02-05', 2040, '申', [true, false]],
    ['1974-02-05', 1980, '申', [false, false]],
    ['1989-03-11', 2043, '亥', [false, true]],
  ]) {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 1);
    const engine = astro.withOptions({ dateStr, timeIndex: 0, gender: '男', fixLeap: true, config });
    const natal = engine.toJSON();
    const archive = { snapshotId: 'ming-natal-horse-' + year, chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
    validateFortuneFacts(bound);
    const fact = rows(bound).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    const data = fact.normalizedPayload;
    assert.deepEqual([data.horseBranch, data.annualBranch], [branch, branch]);
    assert.deepEqual(data.cutVoidPair, ['申', '酉']);
    assert.deepEqual([data.mingHorseCutVoidGuardCandidate, data.mingHorseNativeVoidsGuardCandidate], expected);
    const annualCut = year === 1980;
    assert.equal(data.mingHorseCutVoidAnnualCandidate, annualCut);
    assert.deepEqual(data.mingHorseGuardScopes, expected.includes(true) ? ['decadal'] : []);
    assert.deepEqual(data.sourceVoids.map(row => [row.kind, row.horseRelation]),
      [['古天空', expected[1] ? '守' : '其他'], ['地劫', expected[1] ? '守' : '其他']]);
    if (year === 1980) {
      assert.equal(data.horseCutVoidCandidate, true);
      assert.equal(match({ ...bound, facts: [fact] }, 62).status, 'matched');
      const wrongDecadalIndex = natal.palaces.find(row => row.earthlyBranch === branch).index;
      const actual = engine.horoscope(year + '-06-01', 6);
      const misplaced = quanshuHorseVoidCondition(natal, actual.yearly.index, actual.yearly.index, year,
        'yearly', wrongDecadalIndex, actual.age.index);
      assert.deepEqual(misplaced.sourceDecadal, { branch, verified: false });
      assert.equal(misplaced.mingHorseCutVoidGuardCandidate, undefined);
      assert.deepEqual(misplaced.mingHorseGuardScopes, []);
      assert.equal(misplaced.horseCutVoidCandidate, true);
      assert.equal(misplaced.mingHorseCutVoidAnnualCandidate, true);
      assert.equal(match({ ...bound, facts: [{ ...fact, normalizedPayload: misplaced }] }, 62).status, 'matched');
    }

    if (year === 2040) {
      const horoscope = engine.horoscope(year + '-06-01', 6);
      const next = engine.horoscope(year + 1 + '-06-01', 6);
      const adjacent = quanshuHorseVoidCondition(natal, next.yearly.index, next.yearly.index, year + 1,
        'yearly', next.decadal.index, next.age.index);
      assert.equal(adjacent.mingHorseCutVoidAnnualCandidate, false);
      for (const [missing, remaining] of [['地空', '地劫'], ['地劫', '古天空']]) {
        const archive = structuredClone(natal);
        for (const palace of archive.palaces) palace.minorStars = palace.minorStars.filter(row => row.name !== missing);
        const single = quanshuHorseVoidCondition(archive, horoscope.yearly.index, horoscope.yearly.index, year,
          'yearly', horoscope.decadal.index, horoscope.age.index);
        assert.equal(single.sourceVoidPairReady, false);
        assert.deepEqual(single.sourceVoids.map(row => [row.kind, row.horseRelation]), [[remaining, '其他']]);
        assert.equal(single.mingHorseNativeVoidsGuardCandidate, false);
        assert.equal(single.mingHorseCutVoidGuardCandidate, true);
      }
    }

    const testFact = structuredClone(fact);
    testFact.normalizedPayload.horseDeadOrExtinctStageCandidate = false;
    for (const key of ['horseCutVoidCandidate', 'horseXunVoidCandidate', 'horseSkyVoidCandidate',
      'flowHorseCutVoidCandidate', 'flowHorseXunVoidCandidate', 'flowHorseSkyVoidCandidate']) {
      if (key !== 'horseCutVoidCandidate' || !annualCut) testFact.normalizedPayload[key] = false;
    }
    const run = { ...bound, facts: [...bound.facts.filter(row => row.factType !== fact.factType), testFact] };
    const hit = match(run, 62);
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.equal(hit.confirmedBranches, undefined);
    if (annualCut) {
      assert.equal(hit.matchedSourceExcerpt, '逢空亡');
      assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-natal-horse-annual'));
      const prompt = formatFortunePrompt(input);
      assert.match(prompt, /篇末的流年条件和南阳堂本具名截路空亡/u);
      assert.doesNotMatch(prompt, /实际大限或小限守此宫|mingHorseCutVoidAnnualCandidate/u);
    } else {
      assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      assert.equal(hit.matchedSourceExcerpt, expected[0] ? '逢空亡' : '逢空亡谓之死马、亡马');
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-natal-horse'));
      const phrase = expected[0]
        ? `明刊候选核到本命天马、太岁与生年截路空亡同在${branch}宫`
        : `明刊候选核到本命天马、太岁、古天空与地劫同在${branch}宫`;
      assert.ok(formatFortuneFactAudit(input).includes(phrase));
      const prompt = formatFortunePrompt(input);
      const cutCondition = /本命天马实守生年干所定的截路空亡双宫之一/u;
      const hourVoidsCondition = /本命天马、古天空和地劫同宫，实际大限或小限守此宫，同一农历年太岁也临此宫/u;
      assert.doesNotMatch(prompt, /明刊候选核到本命天马|mingHorse/u);
      assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
      assert.deepEqual([cutCondition.test(prompt), hourVoidsCondition.test(prompt)], expected);
      const oldPayload = { ...testFact.normalizedPayload, horseArchiveLayerProof: undefined };
      assert.equal(match({ ...bound, facts: [{ ...fact, normalizedPayload: oldPayload }] }, 62).status, 'partial');
      if (expected[1]) {
        const both = match({ ...bound, facts: [fact] }, 62);
        assert.equal(both.confirmedBranches.length, 2);
        assert.deepEqual(new Set(both.matchedSourceExcerpt.split('\n')), new Set(['逢空亡谓之死马、亡马', '居绝死谓之死马']));
        const horoscope = engine.horoscope(year + '-06-01', 6);
        const runCondition = (source, decade = horoscope.decadal.index) => quanshuHorseVoidCondition(source,
          horoscope.yearly.index, horoscope.yearly.index, year, 'yearly', decade, horoscope.age.index);
        const lacking = structuredClone(natal), sky = lacking.palaces.find(palace => palace.minorStars.some(star => star.name === '地空'));
        sky.minorStars = sky.minorStars.filter(star => star.name !== '地空');
        assert.equal(runCondition(lacking).mingHorseNativeVoidsGuardCandidate, undefined);
        const wrongLimit = runCondition(natal, (horoscope.decadal.index + 1) % 12);
        assert.equal(wrongLimit.mingHorseNativeVoidsGuardCandidate, undefined);
        const check = (normalizedPayload) => match({ ...bound, facts: [{ ...fact, normalizedPayload }] }, 62);
        assert.equal(check(wrongLimit).matchedSourceExcerpt, '居绝死谓之死马');
        assert.equal(check({ ...wrongLimit, horseDeadOrExtinctStageCandidate: false }).status, 'partial');
        const near = engine.horoscope(year + 1 + '-06-01', 6);
        assert.equal(quanshuHorseVoidCondition(natal, near.yearly.index, near.yearly.index, year + 1,
          'yearly', near.decadal.index, near.age.index).mingHorseNativeVoidsGuardCandidate, false);
      }
    }
    testFact.normalizedPayload.mingNatalHorseProfile = 'unverified';
    testFact.normalizedPayload.horseCutVoidCandidate = false;
    assert.equal(match(run, 62).status, 'not_matched');
  }

  const archive = astro.withOptions({ dateStr: '1974-02-05', timeIndex: 0, gender: '男', fixLeap: true, config });
  const h = archive.horoscope('1980-06-01', 6);
  const incomplete = quanshuHorseVoidCondition(archive.toJSON(), h.yearly.index, h.yearly.index,
    1980, 'yearly', undefined, h.age.index);
  assert.equal(incomplete.horseCutVoidCandidate, true);
  assert.equal(incomplete.mingHorseCutVoidGuardCandidate, undefined);
  assert.equal(incomplete.mingHorseCutVoidAnnualCandidate, true);
  assert.equal(incomplete.mingHorseNativeVoidsGuardCandidate, false);
});

test('p011 to p014 keep verified flowing Horse, Fire and source voids separate in the local audit', () => {
  const cases = [
    ['1991-10-15', 5, 1995, '巳', 'decadal', false,
      [[60, 'flowHorseXingShaCandidate', '本命天刑和七杀与守限的流马同宫']]],
    ['1981-02-15', 2, 1995, '巳', 'minor', true,
      [[61, 'flowHorseArchiveFireCandidate', '守限流马与归档火星同宫']]],
    ['1981-02-15', 1, 2001, '亥', 'minor', true,
      [[61, 'flowHorseJielanFireCandidate', '守限流马与《捷览》所推火星同宫']]],
    ['1980-02-15', 6, 1994, '申', 'decadal', false,
      [[62, 'flowHorseCutVoidCandidate', '守限流马在本生年截路双宫组内']]],
    ['1991-10-15', 5, 1993, '亥', 'minor', false,
      [[62, 'flowHorseXunVoidCandidate', '守限流马在本生年旬中空亡双宫组内']]],
    ['1980-02-15', 0, 1993, '亥', 'minor', false,
      [[62, 'flowHorseSkyVoidCandidate', '守限流马与按生时核位的古天空同宫'],
       [63, 'flowHorseAnnualTuoluoCandidate', '守限流马与按流年干独立核位的流陀同宫']]],
    ['1991-10-15', 5, 2022, '申', 'decadal', false,
      [[63, 'flowHorseNatalTuoluoCandidate', '守限流马与本命陀罗同宫']]],
    ['1980-02-15', 6, 2001, '亥', undefined, false,
      [[62, 'horseSkyVoidCandidate', '太岁所守的本命天马与按生时核位的古天空同宫']]],
  ];
  for (const [dateStr, timeIndex, year, branch, limit, isFire, entries] of cases) {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'flow-horse-' + timeIndex + '-' + year };
    const natal = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config }).toJSON();
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart: chart(natal) })));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
    validateFortuneFacts(bound);
    const type = isFire ? 'quanshu_firebell_context' : 'quanshu_horse_void_context';
    const fact = bound.facts.find(f => f.factType === type && f.scope === 'yearly' && f.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    const data = fact.normalizedPayload;
    assert.deepEqual(data.flowHorse, { branch, guardingLimits: limit ? [limit] : [], atLimit: limit !== undefined });
    assert.notEqual(data.flowHorse.branch, data.annualBranch);
    if (isFire) {
      assert.deepEqual([data.flowHorseArchiveFireCandidate, data.flowHorseJielanFireCandidate],
        year === 1995 ? [true, false] : [false, true]);
      assert.ok(!(data.natalHorseAtFocus && data.fireArchiveAtFocus) && !(data.natalHorseAtFocus && data.jielanFireAtFocus));
    }
    const run = { ...bound, facts: bound.facts.filter(f => f.factType !== type || f.factId === fact.factId) };
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'flow-horse'));
    const prompt = formatFortuneFactAudit(input);
    for (const [index, flag, phrase] of entries) {
      if (index === 60) assert.equal(data.horseTianxingQishaCandidate, false);
      if (index === 62) assert.deepEqual([data.horseCutVoidCandidate, data.horseXunVoidCandidate], [false, false]);
      if (index === 63) assert.equal(data.horseTuoluoTogetherCandidate, false);
      assert.equal(data[flag], true);
      if (index === 60) assert.deepEqual(data.xingShaSeatProof, {
        tianxingBranch: '巳', ziweiBranch: '巳', ziweiExpectedBranch: '巳', ziweiVerified: true,
        tianfuBranch: '亥', tianfuExpectedBranch: '亥', tianfuVerified: true,
        qishaBranch: '巳', qishaExpectedBranch: '巳', qishaVerified: true,
      });
      const hit = match(run, index);
      const localOnly = isFire || index === 60 || index === 63;
      assert.equal(hit.status, localOnly ? 'not_matched' : 'partial');
      assert.deepEqual(hit.sourceFactIds, localOnly ? [] : [fact.factId]);
      assert.deepEqual(hit.windows, localOnly ? [] : [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      assert.ok(prompt.includes(phrase), phrase);
      assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
    }
    assert.doesNotMatch(prompt, /guardingLimits|flowHorseXingShaCandidate|flowHorseArchiveFireCandidate/u);
  }
});

test('flowing Horse must be unique at the independently verified position and actually guard a limit', () => {
  const archive = astro.withOptions({ dateStr: '1991-10-15', timeIndex: 5, gender: '女', fixLeap: true, config });
  const natal = archive.toJSON();
  const examine = (year, move = palaces => palaces) => {
    const h = archive.horoscope(year + '-06-01', 6);
    const placements = natal.palaces.map(p => ({ branch: p.earthlyBranch,
      movingStarIds: (h.yearly.stars?.[p.index] ?? []).map(star => star.name) }));
    return quanshuHorseVoidCondition(natal, h.yearly.index, h.yearly.index, year, 'yearly', h.decadal.index, h.age.index, move(placements));
  };
  const offLimit = examine(2003);
  assert.deepEqual(offLimit.flowHorse, { branch: '巳', guardingLimits: [], atLimit: false });
  assert.deepEqual(offLimit.companions.filter(row => row.star === '七杀' || row.star === '天刑').map(row => row.branch), ['巳', '巳']);
  assert.equal(offLimit.flowHorseXingShaCandidate, false);
  for (const altered of [
    palaces => palaces.map(p => ({ ...p, movingStarIds: p.movingStarIds.map(star => star === '流马' ? '运马' : star) })),
    palaces => palaces.map(p => p.branch === '巳' ? { ...p, movingStarIds: [...p.movingStarIds, '流马'] } : p),
    palaces => palaces.map(p => p.branch === '亥' ? { ...p, movingStarIds: [...p.movingStarIds, '流马'] }
      : { ...p, movingStarIds: p.movingStarIds.filter(star => star !== '流马') }),
  ]) {
    const result = examine(1995, altered);
    assert.equal(result.flowHorse.branch, undefined);
    assert.equal(result.flowHorseXingShaCandidate, undefined);
  }
});

test('p013 verifies ancient Sky separately from Robbery for natal and flowing Horse', () => {
  const cases = [
    ['1980-02-15', 6, '女', 2001, 'horseSkyVoidCandidate'],
    ['1980-02-15', 0, '女', 1993, 'flowHorseSkyVoidCandidate'],
    ['1989-03-11', 0, '男', 2043, 'horseSkyVoidCandidate'],
  ];
  const id = fortuneKnowledge.ziwei.rules[62].knowledgeId;
  const without = (natal, missingName) => ({ ...natal, palaces: natal.palaces.map(palace => ({
    ...palace, majorStars: palace.majorStars.filter(star => star.name !== missingName),
    minorStars: palace.minorStars.filter(star => star.name !== missingName),
    adjectiveStars: palace.adjectiveStars.filter(star => star.name !== missingName),
  })) });
  for (const [dateStr, timeIndex, gender, year, field] of cases) {
    const archive = astro.withOptions({ dateStr, timeIndex, gender, fixLeap: true, config });
    const natal = archive.toJSON(), h = archive.horoscope(year + '-06-01', 6);
    const moving = natal.palaces.map(palace => ({ branch: palace.earthlyBranch,
      movingStarIds: (h.yearly.stars?.[palace.index] ?? []).map(star => star.name) }));
    const read = n => quanshuHorseVoidCondition(n, h.yearly.index, h.yearly.index, year, 'yearly', h.decadal.index, h.age.index, moving);
    const intact = read(natal), noRobbery = read(without(natal, '地劫')), noAncientSky = read(without(natal, '地空'));
    assert.equal(intact[field], true);
    assert.equal(noRobbery[field], true);
    assert.equal(noRobbery.sourceSkyReady, true);
    assert.equal(noRobbery.sourceVoidPairReady, false);
    assert.deepEqual(noRobbery.sourceVoids.map(row => row.kind), ['古天空']);
    assert.equal(noAncientSky[field], undefined);
    assert.equal(noAncientSky.sourceSkyReady, false);
    assert.equal(noAncientSky.sourceRobberyReady, true);
    assert.deepEqual(noAncientSky.sourceVoids.map(row => row.kind), ['地劫']);
    const localAudit = describeFortuneFact({ method: 'ziwei', type: 'quanshu_horse_void_context',
      data: noAncientSky }, String);
    assert.match(localAudit, /地劫位置已核，古天空仍待核/u);
    if (year === 2043) {
      assert.equal(intact.mingHorseNativeVoidsGuardCandidate, true);
      assert.equal(noRobbery.mingHorseNativeVoidsGuardCandidate, undefined);
      assert.equal(noAncientSky.mingHorseNativeVoidsGuardCandidate, undefined);
      continue;
    }
    const query = data => evaluateFortuneRules('ziwei', 'year', [{ factType: 'quanshu_horse_void_context', scope: 'yearly',
      completeness: 'complete', normalizedPayload: data }]).find(row => row.knowledgeId === id).required[0];
    assert.deepEqual([query(noRobbery).hits.length, query(noRobbery).unknown], [1, false]);
    assert.deepEqual([query(noAncientSky).hits.length, query(noAncientSky).unknown], [0, true]);
  }
});

test('Ming native Life and Body Horse bind ancient Sky and birth xun separately at its annual visit', () => {
 const skyFlag = 'mingHorseLifeBodySkyVoidAnnualCandidate', xunFlag = 'mingHorseLifeBodyXunVoidAnnualCandidate';
 const cases = [
  ['1968-12-04', 9, 1974, '命宫', true, true],
  ['1968-12-04', 3, 1974, '身宫', false, true],
  ['1980-11-22', 9, 1986, '命宫', true, false],
 ];
 for (const [dateStr, timeIndex, year, role, sky, xun] of cases) {
  const engine = astro.withOptions({ dateStr, timeIndex, gender: '女', fixLeap: true, config }), natal = engine.toJSON();
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 5, 1), archive = { snapshotId: 'horse-life-body-void-' + year + '-' + timeIndex, chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
  validateFortuneFacts(bound);
  const fact = rows(bound).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === year);
  assert.ok(fact);
  const data = fact.normalizedPayload;
  assert.deepEqual([data.horseBranch, data.annualBranch], ['寅', '寅']);
  assert.deepEqual([data.mingHorseLifeBodyRole, data[skyFlag], data[xunFlag]], [role, sky, xun]);
  assert.equal(data.horseCutVoidCandidate, false);
  assert.equal(data.mingHorseNativeVoidsGuardCandidate, false);
  const run = { ...bound, facts: [fact] };
  const findRule = facts => evaluateFortuneRules('ziwei', 'year', facts).find(row => row.knowledgeId === fortuneKnowledge.ziwei.rules[62].knowledgeId);
  const proof = (value, flag) => findRule([{ ...fact, normalizedPayload: value }]).confirmations.find(row => row.condition.includes(flag));
  const hit = match(run, 62);
  assert.equal(hit.status, 'matched');
  assert.ok(hit.matchedSourceExcerpt.split('\n').includes('逢空亡'));
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  assert.deepEqual([proof(data, skyFlag).hits.length, proof(data, xunFlag).hits.length], [Number(sky), Number(xun)]);
  const input = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId)).input;
  const provider = formatFortunePrompt(input);
  assert.match(provider, /谭星要论/u);
  assert.doesNotMatch(provider, /寅宫|mingHorseLifeBody/u);

  const read = (n, y) => {
   const h = engine.horoscope(y + '-06-01', 6);
   return quanshuHorseVoidCondition(n, h.yearly.index, h.yearly.index, y, 'yearly', h.decadal.index, h.age.index);
  };
  const later = read(natal, year + 1);
  assert.deepEqual([later[skyFlag], later[xunFlag]], [false, false]);
  if (sky) {
   const palace = natal.palaces.find(row => row.earthlyBranch === '寅');
   const [ancient] = palace.minorStars.splice(palace.minorStars.findIndex(row => row.name === '地空'), 1);
   palace.adjectiveStars.push(ancient);
   const misplaced = read(natal, year);
   assert.equal(misplaced[skyFlag], undefined);
   assert.equal(misplaced[xunFlag], xun);
   assert.equal(proof(misplaced, skyFlag).hits.length, 0);
  } else {
   const body = natal.palaces.find(row => row.isBodyPalace);
   assert.equal(body.earthlyBranch, '寅');
   body.isBodyPalace = false;
   natal.palaces.find(row => row.earthlyBranch === '申').isBodyPalace = true;
   natal.earthlyBranchOfBodyPalace = '申';
   const misplaced = read(natal, year);
   assert.equal(misplaced[xunFlag], undefined);
   assert.equal(proof(misplaced, xunFlag).hits.length, 0);
   assert.equal(proof(misplaced, xunFlag).unknown, true);
  }
 }
});

test('one actual native chart verifies both true limit gates for Horse Xing-Sha, void and Tuo', () => {
  const archive = astro.withOptions({ dateStr: '1991-10-15', timeIndex: 5, gender: '女', fixLeap: true, config });
  const natal = archive.toJSON();
  const cases = [
    [1995, '巳', ['decadal'], [[60, 'flowHorseXingShaCandidate'], [62, 'flowHorseCutVoidCandidate']]],
    [2003, '巳', [], [[60, 'flowHorseXingShaCandidate'], [62, 'flowHorseCutVoidCandidate']]],
    [2022, '申', ['decadal'], [[63, 'flowHorseNatalTuoluoCandidate']]],
    [2018, '申', [], [[63, 'flowHorseNatalTuoluoCandidate']]],
  ];
  for (const [year, branch, guardingLimits, rules] of cases) {
    const h = archive.horoscope(year + '-06-01', 6);
    const movedMinor = natal.palaces.find(row => row.earthlyBranch === branch).index;
    assert.notEqual(movedMinor, h.age.index, String(year));
    const moving = natal.palaces.map(p => ({ branch: p.earthlyBranch,
      movingStarIds: (h.yearly.stars?.[p.index] ?? []).map(star => star.name) }));
    const read = (producer, minorIndex, decadalIndex = h.decadal.index, chartData = natal) => producer(chartData, h.yearly.index, h.yearly.index, year,
      'yearly', decadalIndex, minorIndex, moving);
    const actual = read(quanshuHorseVoidCondition, h.age.index);
    const displaced = read(quanshuHorseVoidCondition, movedMinor);
    const independentDecade = guardingLimits.length > 0;
    const wrongDecadalIndex = independentDecade ? (h.decadal.index + 1) % 12 : movedMinor;
    const displacedDecadal = read(quanshuHorseVoidCondition, h.age.index, wrongDecadalIndex);
    assert.equal(actual.sourceDecadal.verified, true);
    assert.equal(displacedDecadal.sourceDecadal.verified, false);
    assert.equal(displacedDecadal.decadalMinorSamePalace, undefined);
    assert.deepEqual(displacedDecadal.flowHorse, { branch, guardingLimits: [], atLimit: undefined });
    assert.deepEqual(read(quanshuFireBellCondition, h.age.index, wrongDecadalIndex).flowHorse, displacedDecadal.flowHorse);
    assert.deepEqual(actual.flowHorse, { branch, guardingLimits, atLimit: independentDecade });
    assert.deepEqual(displaced.flowHorse, { branch, guardingLimits, atLimit: independentDecade || undefined });
    assert.deepEqual(read(quanshuFireBellCondition, movedMinor).flowHorse, displaced.flowHorse);
    assert.ok(displaced.scopeRelations.some(row => row.scope === 'minor' && row.branch === branch));
    assert.equal(displaced.sourceMinor.verified, false);
    assert.equal(displaced.decadalMinorSamePalace, undefined);

    const queries = data => evaluateFortuneRules('ziwei', 'year', [{ factType: 'quanshu_horse_void_context', scope: 'yearly',
      completeness: 'complete', normalizedPayload: data }]);
    const actualRules = queries(actual), displacedRules = queries(displaced), displacedDecadalRules = queries(displacedDecadal);
    const { limitPlacementProof, ...legacy } = actual;
    assert.equal(limitPlacementProof, 'quanshu-bureau-and-source-minor-v1');
    const legacyRules = queries(legacy);
    const changed = structuredClone(natal);
    const wrongPalace = changed.palaces.find(row => row.index === wrongDecadalIndex);
    const rightPalace = changed.palaces.find(row => row.index === h.decadal.index);
    wrongPalace.decadal.range = [...rightPalace.decadal.range];
    assert.equal(quanshuLimitPhase(changed, wrongDecadalIndex, h.age.nominalAge, quanshuLunarMidnight(year, 1)).ready, true);
    const copied = read(quanshuHorseVoidCondition, h.age.index, wrongDecadalIndex, changed);
    assert.deepEqual(copied.sourceDecadal, { branch: wrongPalace.earthlyBranch, verified: false });
    assert.deepEqual(copied.flowHorse, displacedDecadal.flowHorse);
    assert.deepEqual(read(quanshuFireBellCondition, h.age.index, wrongDecadalIndex, changed).flowHorse, copied.flowHorse);
    const copiedRules = queries(copied);
    for (const [index, field] of rules) {
      const id = fortuneKnowledge.ziwei.rules[index].knowledgeId;
      const current = evaluated => evaluated.find(row => row.knowledgeId === id).required[0];
      assert.equal(actual[field], independentDecade, field);
      assert.equal(displaced[field], independentDecade || undefined, field);
      assert.equal(displacedDecadal[field], undefined, field);
      if (index === 60 || index === 63) {
        for (const evaluated of [actualRules, displacedRules, displacedDecadalRules, copiedRules, legacyRules]) {
          assert.deepEqual([current(evaluated).hits.length, current(evaluated).unknown], [0, false], field);
        }
        continue;
      }
      assert.deepEqual([current(actualRules).hits.length, current(actualRules).unknown], [Number(independentDecade), false], field);
      assert.deepEqual([current(displacedRules).hits.length, current(displacedRules).unknown],
        [Number(independentDecade), !independentDecade], field);
      assert.deepEqual([current(displacedDecadalRules).hits.length, current(displacedDecadalRules).unknown], [0, true], field);
      assert.deepEqual([current(copiedRules).hits.length, current(copiedRules).unknown], [0, true], field);
      assert.deepEqual([current(legacyRules).hits.length, current(legacyRules).unknown], [0, independentDecade], field);
    }
    if (year === 1995) {
      const incomplete = structuredClone(natal);
      delete incomplete.fiveElementsClass;
      const readIncomplete = read(quanshuHorseVoidCondition, h.age.index, h.decadal.index, incomplete);
      assert.equal(readIncomplete.sourceDecadal.verified, undefined);
      assert.equal(readIncomplete.sourceMinor.verified, true);
      assert.equal(readIncomplete.flowHorseXingShaCandidate, undefined);
      assert.deepEqual(read(quanshuFireBellCondition, h.age.index, h.decadal.index, incomplete).flowHorse, readIncomplete.flowHorse);
    }
  }
  const h = archive.horoscope('1993-06-01', 6);
  const moving = natal.palaces.map(p => ({ branch: p.earthlyBranch,
    movingStarIds: (h.yearly.stars?.[p.index] ?? []).map(star => star.name) }));
  const changed = structuredClone(natal);
  const wrongDecade = changed.palaces.find(row => row.earthlyBranch === '亥');
  wrongDecade.decadal.range = [...changed.palaces.find(row => row.index === h.decadal.index).decadal.range];
  const minorOnly = quanshuHorseVoidCondition(changed, h.yearly.index, h.yearly.index, 1993, 'yearly',
    wrongDecade.index, h.age.index, moving);
  assert.equal(minorOnly.sourceDecadal.verified, false);
  assert.deepEqual(minorOnly.flowHorse, { branch: '亥', guardingLimits: ['minor'], atLimit: true });
  const minorOnlyAudit = describeFortuneFact({ type: 'quanshu_horse_void_context', method: 'ziwei', scope: 'yearly', data: minorOnly }, String);
  assert.match(minorOnlyAudit, /未能从归档核对当年虚岁对应的大限十年区间/u);
  assert.ok(!minorOnlyAudit.includes('大限命宫在' + minorOnly.sourceDecadal.branch));
  assert.equal(minorOnly.flowHorseXunVoidCandidate, true);
  delete changed.fiveElementsClass;
  const noBureau = quanshuHorseVoidCondition(changed, h.yearly.index, h.yearly.index, 1993, 'yearly',
    wrongDecade.index, h.age.index, moving);
  assert.equal(noBureau.sourceDecadal.verified, undefined);
  assert.equal(noBureau.flowHorseXunVoidCandidate, true);
  const horseBranches = new Set(branches.map(quanshuHorseBranch));
  assert.ok(stems.every(stem => !horseBranches.has(quanshuLuYangTuo(stem).qingyangBranch)));
});

test('p014 audits annual Tuo independently and requires natal Tuo for an interpretation match', () => {
  const engine = astro.withOptions({ dateStr: '1991-10-15', timeIndex: 5, gender: '女', fixLeap: true, config });
  const natal = engine.toJSON();
  for (const [year, flowTuoluoBranch] of [[2037, '巳'], [2025, '寅']]) {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'natal-horse-annual-tuoluo', chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
    validateFortuneFacts(bound);
    const fact = rows(bound).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    const data = fact.normalizedPayload;
    const together = year === 2037;
    assert.deepEqual([data.horseBranch, data.annualBranch, data.flowTuoluoBranch, data.horseAnnualTuoluoCandidate],
      ['巳', '巳', flowTuoluoBranch, together]);
    assert.deepEqual([data.horseTuoluoTogetherCandidate, data.flowHorseNatalTuoluoCandidate, data.flowHorseAnnualTuoluoCandidate],
      [false, false, false]);
    const run = { ...bound, facts: bound.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const hit = match(run, 63);
    assert.equal(hit.status, 'not_matched');
    assert.deepEqual(hit.sourceFactIds, []);

    const horoscope = engine.horoscope(year + '-06-01', 6);
    const yearlyPalaces = natal.palaces.map(palace => ({ branch: palace.earthlyBranch,
      movingStarIds: (horoscope.yearly.stars?.[palace.index] ?? []).map(star => star.name) }));
    const conditionWith = (chartData, yearly = yearlyPalaces) => quanshuHorseVoidCondition(
      chartData, horoscope.yearly.index, horoscope.yearly.index, year,
      'yearly', horoscope.decadal.index, horoscope.age.index, yearly);
    const withCondition = data => ({ ...run, facts: [{ ...fact, normalizedPayload: data }] });
    const recheck = (data, index = 63) => match(withCondition(data), index);
    for (const moveToHorse of [false, true]) {
      const changed = structuredClone(natal);
      const natalTuoPalace = changed.palaces.find(palace => palace.minorStars.some(star => star.name === '陀罗'));
      const [tuo] = natalTuoPalace.minorStars.splice(natalTuoPalace.minorStars.findIndex(star => star.name === '陀罗'), 1);
      if (moveToHorse) changed.palaces.find(palace => palace.earthlyBranch === '巳').minorStars.push(tuo);
      const independent = conditionWith(changed);
      assert.equal(independent.horseAnnualTuoluoCandidate, together);
      assert.equal(independent.horseTuoluoTogetherCandidate, undefined);
      assert.equal(independent.horseTianxingQishaCandidate, undefined);
      assert.equal(independent.horseCutVoidCandidate, undefined);
      const result = recheck(independent);
      assert.equal(result.status, 'unknown');
      assert.deepEqual(result.sourceFactIds, []);
      assert.equal(recheck(independent, 60).status, 'unknown');
      assert.equal(recheck(independent, 62).status, 'unknown');
      if (together && moveToHorse) {
        const current = withCondition(independent);
        const { input } = buildFortuneModelContext(current, interpretFortune(current, requestForFortuneRun(current), 'independent-annual-tuo'));
        const phrase = /太岁所守的本命天马与按流年干独立核位的流陀同在巳宫/u;
        assert.match(formatFortuneFactAudit(input), phrase);
        assert.doesNotMatch(formatFortunePrompt(input), phrase);
        assert.ok(input.sections.flatMap(section => section.findings).every(row => row.knowledgeId !== hit.knowledgeId));
      }
      const missingAnnual = conditionWith(changed, []);
      assert.equal(missingAnnual.horseAnnualTuoluoCandidate, undefined);
      assert.equal(recheck(missingAnnual).status, 'unknown');
    }
    if (together) {
      assert.equal(fact.activeFrom, new Date(quanshuLunarMidnight(year, 1)).toISOString());
      const previousYear = rows(bound).find(row => row.scope === 'yearly' && row.activeTo === fact.activeFrom);
      assert.equal(previousYear.normalizedPayload.lunarYear, year - 1);
      assert.equal(previousYear.normalizedPayload.horseAnnualTuoluoCandidate, false);

      for (const duplicate of [false, true]) {
        const misplaced = yearlyPalaces.map(palace => ({ ...palace, movingStarIds: [
          ...palace.movingStarIds.filter(star => duplicate || star !== '流陀'),
          ...(palace.branch === '午' ? ['流陀'] : []),
        ] }));
        const unverifiable = conditionWith(natal, misplaced);
        assert.equal(unverifiable.flowTuoluoBranch, undefined);
        assert.equal(unverifiable.horseAnnualTuoluoCandidate, undefined);
        assert.equal(recheck(unverifiable).status, 'not_matched');
      }

      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'natal-horse-annual-tuoluo'));
      const prompt = formatFortuneFactAudit(input);
      assert.match(prompt, /太岁所守的本命天马与按流年干独立核位的流陀同在巳宫/u);
      assert.doesNotMatch(prompt, /horseAnnualTuoluoCandidate/u);
      assert.ok(input.sections.flatMap(section => section.findings).every(row => row.knowledgeId !== hit.knowledgeId));
      assert.doesNotMatch(formatFortunePrompt(input), /本命天马和本命陀罗同宫，所查流年太岁实临同宫/u);
    }
  }
});

test('p014 separates the fixed sixty-branch Horse–Tuo contacts from Tuo at Tai Sui', () => {
  const horseAtTuo = new Set(), taiSuiAtTuo = new Set(), nativeHorseBranches = new Set(branches.map(quanshuHorseBranch));
  for (let i = 0; i < 60; i++) {
    const stem = stems[i % 10], branch = branches[i % 12], pillar = stem + branch;
    const { tuoluoBranch } = quanshuLuYangTuo(stem);
    if (quanshuHorseBranch(branch) === tuoluoBranch) horseAtTuo.add(pillar);
    if (branch === tuoluoBranch) taiSuiAtTuo.add(pillar);
  }
  assert.deepEqual(horseAtTuo, new Set(['丁卯', '丁未', '丁亥', '己卯', '己未', '己亥', '癸丑', '癸巳', '癸酉']));
  assert.deepEqual(taiSuiAtTuo, new Set(['丙辰', '丁巳', '戊辰', '己巳', '壬戌', '癸亥']));
  assert.deepEqual(new Set([...taiSuiAtTuo].filter(pillar => nativeHorseBranches.has(pillar[1]))), new Set(['丁巳', '己巳', '癸亥']));
});

test('all named companions and Tuo relationships retain exact separate geometry without labelling them the complete Xing-Sha set',()=>{
 const p=condition(),expected={禄存:'寅',紫微:'戌',天府:'午',七杀:'子',天刑:'子'};
 for(const [star,branch]of Object.entries(expected))assert.equal(p.companions.find(s=>s.star===star).branch,branch);
 assert.equal(p.tianxingReady,true);assert.ok(p.tuoluoHorseRelation);assert.ok(!('xingShaComplete'in p));
 const d=describeFortuneFact({method:'ziwei',type:'quanshu_horse_void_context',data:p},String);assert.match(d,/不固定为原文完整刑杀集合/u);
});

test('natural Chinese prompt preserves the distinct source groups and candidate limits while excluding raw JSON and partial source passages',async()=>{
 const run=real('cut'),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'horse-void-report'));
 assert.ok(input.facts.some(f=>f.type==='quanshu_horse_void_context'));const prompt=formatFortuneFactAudit(input);
 for(const text of ['本生年所属旬首','截路空亡按本生年独立核得双宫组申、酉','旬中空亡按本生年独立核得双宫组辰、巳','本命文昌改名为流昌','现代同名天空不作替身'])assert.ok(prompt.includes(text),text);
 for(const secret of ['quanshu-horse-birth-void','cutVoidPair','annualVoidCandidates','flowChangRuleVerified','horse-void-run','horse-void-snapshot'])assert.ok(!prompt.includes(secret),secret);
 const findings=input.sections.flatMap(s=>s.findings);
 assert.ok(!findings.some(f=>[59,60,63].some(i=>f.knowledgeId===fortuneKnowledge.ziwei.rules[i].knowledgeId)));
 assert.ok(findings.some(f=>f.knowledgeId===fortuneKnowledge.ziwei.rules[62].knowledgeId));
 const supplied=formatFortunePrompt(input);
 assert.match(supplied,/篇末的流年条件和南阳堂本具名截路空亡/u);
 assert.doesNotMatch(supplied,/本生年所属旬首|mingHorseCutVoidAnnualCandidate/u);
 const d=describeFortuneFact({method:'ziwei',type:'quanshu_horse_void_context',data:condition()},String);assert.ok(!/[{}\[\]]/u.test(d));
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await provider.interpret(input);
});
