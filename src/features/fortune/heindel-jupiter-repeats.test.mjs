import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Body,Ecliptic,GeoVector,SunPosition} from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import {formatFortuneFactAudit, formatFortunePrompt,describeFortuneFact} from './control/fortune-prompt.mjs';
import {createFortuneDeepSeek} from './server/deepseek-expression.mjs';
const {scanJupiterStations,jupiterPassesInCycle,classifyJupiterRepeats,createJupiterRepeatScanner,heindelJupiterRepeatPolicy}=await import('./control/heindel-jupiter-repeats.ts');
const {readTransitLongitude}=await import('./control/solar-transits.ts');
const {linkHeindelTransits,heindelSourcePolicy}=await import('./control/heindel-source-context.ts');
const {calculateFortuneFacts,validateFortuneFacts}=await import('./control/fortune-facts.ts');
const {buildFortuneFactSubmission}=await import('./control/fortune-fact-submission.ts');
const {bindClientFortuneRun,readClientFactTime}=await import('./server/client-facts.mjs');
const {buildFactTimeContext}=await import('./control/fact-time-context.ts');
const {matchFortuneKnowledge}=await import('./control/knowledge/match.ts');
const {fortuneKnowledge}=await import('./control/knowledge/catalog.ts');
const {buildFortuneModelContext}=await import('./control/fortune-model-context.ts');
const {interpretFortune,requestForFortuneRun}=await import('./control/fortune-interpretation.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/heindel-jupiter-repeat-reference.json',import.meta.url)));
const day=86400000,period=400*day,epoch=Date.parse('2025-01-01T00:00:00Z'),normalize=v=>(v%360+360)%360;
const synthetic=at=>normalize(350+30*(at-epoch)/period+8*Math.sin(2*Math.PI*(at-epoch)/period));
const theta=Math.acos(-30/(16*Math.PI)),retro=epoch+period*theta/(2*Math.PI),direct=epoch+period*(1-theta/(2*Math.PI));
const turns=[{at:Math.round(direct-period),directionAfter:'direct'},{at:Math.round(retro),directionAfter:'retrograde'},
 {at:Math.round(direct),directionAfter:'direct'},{at:Math.round(retro+period),directionAfter:'retrograde'}].map(r=>({...r,longitude:synthetic(r.at)}));
const allTurns=scanJupiterStations({start:epoch-2*period,end:epoch+3*period},synthetic);
const close=(a,b,tolerance=2000)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
function chart(at=Date.parse(ref.birthAt)){const bodies=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];return {
 timeKnown:true,bazi:{rawResult:[]},ziwei:{rawResult:[]},western:{engineName:'astronomy-engine',engineVersion:'2.1.19',rulesetVersion:'tropical-whole-sign-v1',rawResult:[{
 julianDay:at/day+2440587.5,ascendant:120,midheaven:30,positions:bodies.map(planet=>({planet,longitude:planet==='Sun'?SunPosition(new Date(at)).elon:Ecliptic(GeoVector(Body[planet],new Date(at),true)).elon}))}]}};}
let actual;
function run(){if(!actual){const input={periodType:'year',displayTimezone:'UTC',targetPeriod:{year:2025}},at=Date.parse('2025-11-19T00:00:00Z');actual=calculateFortuneFacts(input,buildFactTimeContext(input,at,'server'),'repeat-private-run',{snapshotId:'repeat-private-chart',chart:chart()});}return actual;}
const allRepeatRows = run => run.facts.filter(fact => fact.factType === 'heindel_transit_context'
  && fact.normalizedPayload.repeatProfile === heindelJupiterRepeatPolicy.profile);
const rows = run => allRepeatRows(run).filter(fact => !fact.normalizedPayload.hasVerifiedRepeatPoint);
const matching=r=>matchFortuneKnowledge(r).byMethod.western[35];

test('centered-velocity station brackets agree with independent analytic stationary times across zero longitude',()=>{
 const found=allTurns.filter(r=>epoch<r.at&&r.at<epoch+period);assert.equal(found.length,2);close(found[0].at,retro);close(found[1].at,direct);
 assert.equal(found[0].directionAfter,'retrograde');assert.equal(found[1].directionAfter,'direct');
 assert.equal(scanJupiterStations({start:epoch,end:epoch+day},()=>20).length,0);
 assert.throws(()=>scanJupiterStations({start:epoch,end:epoch+2001*day},synthetic));
});

test('four actual turns bound three directed passes of the same degree through the zero-degree wrap',()=>{
 const c=jupiterPassesInCycle(turns,5,synthetic);assert.equal(c.passes.length,3);assert.deepEqual(c.passes.map(p=>p.direction),['direct','retrograde','direct']);
 close(c.passes[1].at,epoch+period/2,2);assert.equal(c.touches.length,0);
 for(const p of c.passes)close(Math.cos((synthetic(p.at)-5)*Math.PI/180),1,1e-12);
 assert.throws(()=>jupiterPassesInCycle(turns.slice(0,3),5,synthetic));
});

test('a single ordinary passage is verified in both neighboring closed loops without being forced into the repeat branch',()=>{
 const r=classifyJupiterRepeats(allTurns,20,epoch+period,epoch+2*period,epoch-10*period,synthetic);
 assert.equal(r.status,'single');assert.equal(r.verified,true);assert.equal(r.hasRepeatGeometry,false);assert.equal(r.passes.length,1);assert.equal(r.bracketingCycleCount,2);
 close(r.passes[0].at,epoch+period,2);
});

test('an incomplete bracket and a stationary tangent stay unresolved instead of becoming false absence or double counted crossings',()=>{
 const c=jupiterPassesInCycle(turns,normalize(synthetic(turns[1].at)),synthetic);assert.equal(c.touches.length,1);assert.equal(c.passes.length,1);
 const tangent=classifyJupiterRepeats(allTurns,synthetic(turns[1].at),turns[1].at,epoch+period,epoch-10*period,synthetic);
 assert.equal(tangent.status,'stationary_touch');assert.equal(tangent.verified,false);
 const missing=classifyJupiterRepeats(turns.slice(0,3),5,epoch+period/2,epoch+period,epoch-10*period,synthetic);
 assert.equal(missing.status,'unresolved');assert.equal(missing.hasRepeatGeometry,undefined);
});

test('future and pre-birth passes never become an already completed personal return',()=>{
 const at=epoch+period/2,r=classifyJupiterRepeats(allTurns,5,at,at,epoch-10*period,synthetic);
 assert.equal(r.status,'repeated');assert.equal(r.occurredPassCount,2);assert.equal(r.futurePassCount,1);assert.equal(r.returnedAsOfReference,false);
 const old=classifyJupiterRepeats(allTurns,5,at,epoch+period,at-1,synthetic);assert.equal(old.allPassesAfterBirth,false);assert.equal(old.returnedAsOfReference,false);assert.ok(old.passes[0].beforeBirth);
 const done=classifyJupiterRepeats(allTurns,5,at,epoch+period,epoch-10*period,synthetic);assert.equal(done.returnedAsOfReference,true);assert.equal(heindelJupiterRepeatPolicy.effectDurationVerified,false);
});

test('positive and negative sextile and trine branches retain their actual common target, rejecting mismatched anchors and unsupported aspects',()=>{
 const at=Math.round(epoch+period/2),scan=createJupiterRepeatScanner(Math.round(epoch+period),epoch-10*period,synthetic);
 for(const [natal,aspect,offset]of [[305,'sextile',60],[65,'sextile',-60],[245,'trine',120],[125,'trine',-120]]){
  const r=scan(at,natal,aspect);assert.equal(r.status,'repeated');assert.equal(r.offset,offset);close(r.targetLongitude,5,1e-10);
 }
 assert.equal(scan(at,300,'sextile').status,'coordinate_mismatch');assert.throws(()=>scan(at,5,'square'));assert.throws(()=>scan(at,NaN,'trine'));
});

test('real Jupiter sequence preserves all three direct-retrograde-direct dates and independent velocity reversals at its four turns',()=>{
 const scan=createJupiterRepeatScanner(Date.parse('2026-01-15T00:00:00Z'),Date.parse(ref.birthAt));
 const r=scan(Date.parse(ref.passes[0].at),ref.natalSunLongitude,'sextile');assert.equal(r.status,'repeated');assert.equal(r.verified,true);
 for(let i=0;i<3;i++){close(r.passes[i].at,Date.parse(ref.passes[i].at));assert.equal(r.passes[i].direction,ref.passes[i].direction);close(normalize(readTransitLongitude('Jupiter',r.passes[i].at)-ref.natalSunLongitude),60,1e-6);}
 for(const turn of r.stationTurns){const before=readTransitLongitude('Jupiter',turn.at)-readTransitLongitude('Jupiter',turn.at-day),after=readTransitLongitude('Jupiter',turn.at+day)-readTransitLongitude('Jupiter',turn.at);assert.equal(Math.sign(before),turn.directionAfter==='retrograde'?1:-1);assert.equal(Math.sign(after),turn.directionAfter==='retrograde'?-1:1);}
});

test('real annual calculation joins the full cycle to each exact source anchor and retains local progression uncertainty',()=>{
 const r=run();validateFortuneFacts(r);const selected=rows(r).filter(f=>f.normalizedPayload.natalTargetId==='Sun'&&f.normalizedPayload.aspectType==='sextile');assert.equal(selected.length,2);
 assert.deepEqual(selected[0].normalizedPayload.jupiterRepeat.passes.map(p=>p.at),selected[1].normalizedPayload.jupiterRepeat.passes.map(p=>p.at));
 for(const f of selected){assert.equal(f.normalizedPayload.sourceClockVerified,false);assert.equal(f.normalizedPayload.jupiterRepeat.verified,true);assert.ok(f.normalizedPayload.jupiterRepeat.anchorAt>=Date.parse(f.activeFrom)&&f.normalizedPayload.jupiterRepeat.anchorAt<Date.parse(f.activeTo));}
 const verified = allRepeatRows(r).filter(fact => fact.normalizedPayload.hasVerifiedRepeatPoint);
 assert.deepEqual(verified.map(fact => fact.normalizedPayload.natalTargetId), ['Sun', 'Sun']);
 assert.deepEqual(verified.map(fact => fact.exactInstant), selected.map(fact => fact.exactInstant));
 const match = matching(r);
 assert.equal(match.status, 'matched');
 assert.deepEqual(match.windows, verified.map(fact => ({ start: fact.exactInstant,
   endExclusive: new Date(Date.parse(fact.exactInstant) + 1000).toISOString() })));
 assert.ok(match.candidateWindows.length > 0);
 assert.equal(matching({ ...r, facts: rows(r) }).status, 'partial');
 assert.ok(rows(r).some(fact => fact.normalizedPayload.natalTargetId === 'Venus'
   && fact.normalizedPayload.natalTargetHasAffliction && fact.normalizedPayload.jupiterRepeat.status === 'repeated'));
});

test('the same physical cycle survives a new year and a later product episode without treating all years or local episode indices as new benefits',()=>{
 const scan=createJupiterRepeatScanner(Date.parse('2026-07-01T00:00:00Z'),Date.parse(ref.birthAt));
 const last=scan(Date.parse(ref.passes[2].at),ref.natalSunLongitude,'sextile');assert.equal(last.status,'repeated');assert.equal(last.returnedAsOfReference,true);
 assert.deepEqual(last.passes.map(p=>p.at),rows(run()).find(f=>f.normalizedPayload.natalTargetId==='Sun').normalizedPayload.jupiterRepeat.passes.map(p=>p.at));
 assert.equal(last.searchStart===rows(run())[0].normalizedPayload.jupiterRepeat.searchStart,false);
});

test('confirmed Jupiter repeat points keep their source links through the client submission', () => {
 const params = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2025 } };
 const asOf = Date.parse('2025-11-19T00:00:00Z');
 const archive = { snapshotId: 'heindel-repeat-client', chart: chart() };
 const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, archive)));
 const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), archive.snapshotId, archive);
 const points = allRepeatRows(bound).filter(fact => fact.normalizedPayload.hasVerifiedRepeatPoint);
 assert.equal(points.length, 2);
 for (const point of points) {
   const source = bound.facts.find(fact => fact.factId === point.normalizedPayload.transitFactId);
   assert.equal(source?.factType, 'aspect_exact');
   assert.equal(source.exactInstant, point.exactInstant);
   assert.ok(point.sourceFactIds.some(id => source.sourceFactIds.includes(id)));
 }
 assert.deepEqual(matching(bound).windows, matching(run()).windows);
});

test('Heindel Jupiter distinguishes ordinary and repeated passages within the verified strong band', () => {
 const input = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2025 } };
 const reference = { snapshotId: 'repeat-band-chart', chart: { ...chart(), birthContext: {
   precision: 'minute', clockVersion: 'gregory-iana-intl-v1', birthInstant: ref.birthAt, timeZone: 'Europe/London',
 } } };
 const asOf = Date.parse('2025-11-19T00:00:00Z');
 const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, reference)));
 const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), 'repeat-band-run', reference);
 validateFortuneFacts(run);
 const bands = run.facts.filter(({ factType, normalizedPayload: p }) => factType === 'heindel_transit_context'
   && p.fellowshipJupiterTransitBandProfile === heindelSourcePolicy.fellowshipJupiterTransitBandProfile
   && p.natalTargetId === 'Sun' && p.aspectType === 'sextile' && p.hasVerifiedJupiterRepeatBand);
 assert.ok(bands.length > 0);
 for (const pass of ref.passes.slice(0, 2)) {
   assert.ok(bands.some(band => Date.parse(band.activeFrom) <= Date.parse(pass.at)
     && Date.parse(pass.at) < Date.parse(band.activeTo)));
 }
 const outsideOrb = at => Math.abs(normalize(readTransitLongitude('Jupiter', at) - ref.natalSunLongitude) - 60);
 for (const band of bands) {
   const from = Date.parse(band.activeFrom), to = Date.parse(band.activeTo);
   assert.ok(outsideOrb((from + to) / 2) < 1.5);
   for (const [edge, side] of [[from, -1], [to, 1]]) {
     if ([Date.UTC(2025, 0, 1), Date.UTC(2026, 0, 1)].includes(edge)) continue;
     assert.ok(outsideOrb(edge + side * 60000) > 1.5);
     assert.ok(outsideOrb(edge - side * 60000) < 1.5);
   }
   const matched = matching({ ...run, facts: [band] });
   assert.equal(matched.status, 'matched');
   assert.deepEqual(matched.windows, [{ start: band.activeFrom, endExclusive: band.activeTo }]);
   const ordinaryBand = { ...band, normalizedPayload: { ...band.normalizedPayload, hasVerifiedJupiterRepeatBand: false } };
   const noRepeat = matching({ ...run, facts: [ordinaryBand] });
   assert.equal(noRepeat.status, 'matched');
   assert.equal(noRepeat.matchedSourceExcerpt, 'in accordance with the radical indications');
   for (const changes of [{ natalTargetHasAffliction: true },
     { dateBasis: 'UTC-birth-date-candidate' }]) {
     const other = { ...band, normalizedPayload: { ...band.normalizedPayload, ...changes } };
     assert.notEqual(matching({ ...run, facts: [other] }).status, 'matched');
   }
 }
 const selected = { ...run, facts: bands };
 const model = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'repeat-band-report'));
 assert.match(formatFortunePrompt(model.input), /课程第十三课给木星实际行运一度半强范围/u);
 assert.doesNotMatch(formatFortunePrompt(model.input), /fellowshipJupiterTransitBandProfile|hasVerifiedJupiterRepeatBand/u);

 const ordinary = run.facts.find(({ factType, normalizedPayload: p }) => factType === 'heindel_transit_context'
   && p.fellowshipJupiterTransitBandProfile === heindelSourcePolicy.fellowshipJupiterTransitBandProfile
   && p.natalTargetId === 'Mercury' && p.aspectType === 'sextile' && p.hasVerifiedJupiterRepeatBand === false);
 assert.ok(ordinary);
 const from = Date.parse(ordinary.activeFrom), to = Date.parse(ordinary.activeTo);
 assert.deepEqual([ordinary.activeFrom, ordinary.activeTo], ['2025-07-09T11:22:50.480Z', '2025-07-22T21:54:40.564Z']);
 const natalMercury = readTransitLongitude('Mercury', Date.parse(ref.birthAt));
 const deviation = at => Math.abs(Math.abs(normalize(readTransitLongitude('Jupiter', at) - natalMercury + 180) - 180) - 60);
 assert.ok(deviation(from - 60000) > 1.5 && deviation(from + 60000) < 1.5);
 assert.ok(deviation(to - 60000) < 1.5 && deviation(to + 60000) > 1.5);
 const ordinaryRun = { ...run, facts: [ordinary] };
 const ordinaryMatch = matching(ordinaryRun);
 assert.equal(ordinaryMatch.status, 'matched');
 assert.equal(ordinaryMatch.matchedSourceExcerpt, 'in accordance with the radical indications');
 assert.deepEqual(ordinaryMatch.windows, [{ start: ordinary.activeFrom, endExclusive: ordinary.activeTo }]);
 for (const change of [{ natalTargetHasSupport: false }, { natalTargetHasAffliction: true }, { transitAllowedOrb: 1.6 }]) {
   const altered = { ...ordinary, normalizedPayload: { ...ordinary.normalizedPayload, ...change } };
   assert.notEqual(matching({ ...ordinaryRun, facts: [altered] }).status, 'matched');
 }
 const modelOrdinary = buildFortuneModelContext(ordinaryRun, interpretFortune(ordinaryRun, requestForFortuneRun(ordinaryRun), 'ordinary-jupiter'));
 const prompt = formatFortunePrompt(modelOrdinary.input);
 assert.match(prompt, /一度半有效段内参考原文所述的一般顺相背景/u);
 assert.doesNotMatch(prompt, /已核同一有向相位的顺、逆、再顺复过|hasVerifiedJupiterRepeatBand|11:22:50/u);
});

test('a clipped Jupiter strong band can use a previous-year exact repeat without bridging a real exit', () => {
 const birthInstant = '1990-05-13T04:00:00.000Z';
 const birth = Date.parse(birthInstant), start = Date.UTC(2026, 0, 1), end = Date.UTC(2027, 0, 1);
 const asOf = Date.UTC(2026, 0, 2), input = { periodType: 'year', displayTimezone: 'UTC', targetPeriod: { year: 2026 } };
 const archive = { snapshotId: 'jupiter-year-edge', chart: { ...chart(birth), birthContext: {
   precision: 'minute', clockVersion: 'gregory-iana-intl-v1', birthInstant, timeZone: 'Europe/London',
 } } };
 const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, asOf, archive)));
 const result = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, asOf), 'jupiter-year-edge', archive);
 validateFortuneFacts(result);
 const clipped = result.facts.find(({ factType, activeFrom, normalizedPayload: p }) => factType === 'heindel_transit_context'
   && activeFrom === new Date(start).toISOString() && p.natalTargetId === 'Sun' && p.transitBody === 'Jupiter'
   && p.aspectType === 'sextile' && p.fellowshipJupiterTransitBandProfile === heindelSourcePolicy.fellowshipJupiterTransitBandProfile);
 assert.ok(clipped);
 assert.equal(clipped.normalizedPayload.hasVerifiedJupiterRepeatBand, true);
 const endOfBand = Date.parse(clipped.activeTo);
 close(endOfBand, Date.parse('2026-01-06T08:50:02.123Z'));
 assert.equal(result.facts.some(({ factType, exactInstant, normalizedPayload: p }) => factType === 'aspect_exact'
   && p.transitBody === 'Jupiter' && p.natalTargetId === 'Sun' && p.aspectType === 'sextile'
   && start <= Date.parse(exactInstant) && Date.parse(exactInstant) < endOfBand), false);
 const interval = result.facts.find(fact => fact.factId === clipped.normalizedPayload.transitFactId);
 assert.equal(interval?.factType, 'aspect_interval');
 assert.equal(clipped.sourceFactIds.length, interval.sourceFactIds.length + 2);
 assert.ok(interval.sourceFactIds.every(id => clipped.sourceFactIds.includes(id)));
 // The client submits anonymous source IDs. Compute the attached proof independently to check its geometry.
 const scan = createJupiterRepeatScanner(asOf, birth);
 const proof = scan.findAdjacentBandRepeat({ start, end: endOfBand }, { start, end },
   clipped.normalizedPayload.transitNatalLongitude, 'sextile', 1.5);
 assert.ok(proof);
 close(proof.anchorAt, Date.parse('2025-12-25T19:13:13.948Z'));
 assert.equal(proof.returnedAsOfReference, false);
 const deviation = at => Math.abs(normalize(readTransitLongitude('Jupiter', at) - proof.targetLongitude + 180) - 180);
 assert.ok(deviation(proof.anchorAt) < 1e-6 && deviation(start) < 1.5 && deviation(endOfBand + 60_000) > 1.5);
 assert.deepEqual(matching({ ...result, facts: [clipped] }).windows, [{ start: clipped.activeFrom, endExclusive: clipped.activeTo }]);
 const selected = { ...result, facts: [clipped] };
 const model = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'jupiter-year-edge'));
 const prompt = formatFortunePrompt(model.input);
 assert.match(prompt, /课程第十三课给木星实际行运一度半强范围/u);
 assert.doesNotMatch(prompt, /2025-12-25|hasVerifiedJupiterRepeatBand|targetLongitude/u);
 const returnAt = proof.passes.at(-1).at;
 const between = returnAt - 2 * day;
 assert.ok(deviation(between) < 1.5);
 assert.ok(proof.stationTurns.some(turn => proof.anchorAt < turn.at && turn.at < between && deviation(turn.at) > 1.5));
 assert.equal(scan.findAdjacentBandRepeat({ start: between, end: returnAt }, { start: between, end },
   proof.natalLongitude, 'sextile', 1.5), undefined);
});

test('out-of-window station and pass data have their own raw provenance and use the archived transit coordinate independently of the ACD natal rounding',()=>{
 const r=run();for(const f of rows(r)){
  const repeat=f.normalizedPayload.jupiterRepeat,raw=f.sourceFactIds.map(id=>r.rawFacts.find(v=>v.rawFactId===id));assert.ok(raw.every(Boolean));
  assert.ok(raw.some(row=>row.payload?.policy?.profile===heindelJupiterRepeatPolicy.profile&&row.payload.calculation.anchorAt===repeat.anchorAt));
  assert.equal(repeat.natalLongitude,f.normalizedPayload.transitNatalLongitude);assert.equal(repeat.effectDurationVerified,false);
 }
 const source=structuredClone(r.rawFacts.find(row=>row.payload?.calculation?.clock&&row.payload?.policy?.profile==='heindel-acd-geometry-candidate-v1').payload.calculation);
 source.natal.find(row=>row.body==='Sun').longitude+=0.005;
 const link=linkHeindelTransits(source,r.facts).find(row=>row.kind==='exact'&&row.transitBody==='Jupiter'&&row.natalTargetId==='Sun'&&row.aspectType==='sextile');
 assert.notEqual(link.natalLongitude,link.transitNatalLongitude);
 const scan=createJupiterRepeatScanner(Date.parse('2025-11-19T00:00:00Z'),source.clock.birthAt);
 assert.equal(scan(link.exactAt,link.transitNatalLongitude,'sextile').verified,true);
 assert.equal(scan(link.exactAt,link.natalLongitude,'sextile').status,'coordinate_mismatch');
});

test('SQLite keeps the original source hash, ordinary passages remain candidates and generic or wrong-repeat-profile records cannot replace the new witness',()=>{
 const rule=fortuneKnowledge.western.rules[35],entry=fortuneKnowledge.western.entries.find(e=>e.id===rule.knowledgeId);
 assert.equal(rule.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:entry.evidence,conditions:entry.conditions})).digest('hex'));
 assert.equal(rule.queries[0].where.hasRepeatGeometry,undefined);assert.equal(rule.unresolved.length,3);
 const single=structuredClone(run());single.facts=single.facts.filter(f=>f.factType!=='heindel_transit_context'||f.normalizedPayload.jupiterRepeat?.status==='single');
 assert.ok(rows(single).length);assert.equal(matching(single).status,'partial');
 const wrong=structuredClone(run());allRepeatRows(wrong).forEach(f=>f.normalizedPayload.repeatProfile='other');assert.equal(matching(wrong).status,'not_matched');
 const absent=structuredClone(run());absent.facts=absent.facts.filter(f=>!f.normalizedPayload.repeatProfile);assert.equal(matching(absent).status,'not_matched');
});

test('provider input describes full directed dates and future state in Chinese, with one representative per same loop and no machine JSON or partial original',async()=>{
 const r=run(),{input}=buildFortuneModelContext(r,interpretFortune(r,requestForFortuneRun(r),'repeat-private-report'));
 assert.ok(input.facts.some(f=>f.data.repeatProfile===heindelJupiterRepeatPolicy.profile));
 const selected=input.facts.filter(f=>f.data.repeatProfile===heindelJupiterRepeatPolicy.profile);assert.equal(selected.length,3);
 const keys=selected.map(f=>JSON.stringify([f.data.natalTargetId,f.data.aspectType,f.data.jupiterRepeat.offset,f.data.jupiterRepeat.passes.map(p=>p.at)]));assert.equal(new Set(keys).size,selected.length);
 const prompt=formatFortuneFactAudit(input);for(const text of ['顺行、逆行、再顺行','同一个逆行回环','尚未发生','普通六合、拱不以重复经过为必要门槛','五年搜索范围'])assert.ok(prompt.includes(text),text);
 for(const forbidden of ['heindel-jupiter-station','repeat-private','stationTurns','targetLongitude','returnedAsOfReference','effectDurationVerified'])assert.ok(!prompt.includes(forbidden),forbidden);
 const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === fortuneKnowledge.western.rules[35].knowledgeId);
 assert.deepEqual(finding?.conditions, fortuneKnowledge.western.rules[35].confirmedWhen[0].sourceConditions);
 const external = formatFortunePrompt(input);
 assert.match(external, /每次实过各自有效/u);
 assert.doesNotMatch(external, /hasVerifiedRepeatPoint|stationTurns|14:50:53|尚未发生/u);
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await provider.interpret(input);
 const value=describeFortuneFact({method:'western',type:'heindel_transit_context',data:rows(r)[0].normalizedPayload},String);assert.ok(!/[{}\[\]]/u.test(value));
});
