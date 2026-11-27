import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Body,Ecliptic,EquatorFromVector,GeoVector,RotateVector,Rotation_EQJ_EQD,SunPosition,e_tilt,MakeTime} from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import {formatFortuneFactAudit, formatFortunePrompt,describeFortuneFact} from './control/fortune-prompt.mjs';
import {createFortuneDeepSeek} from './server/deepseek-expression.mjs';
const {buildLeoLuminaryNatal,linkLeoJupiterLuminaries,leoJupiterLuminaryPolicy}=await import('./control/leo-jupiter-luminaries.ts');
const {calculateFortuneFacts,validateFortuneFacts}=await import('./control/fortune-facts.ts');
const {buildFortuneFactSubmission}=await import('./control/fortune-fact-submission.ts');
const {bindClientFortuneRun,readClientFactTime}=await import('./server/client-facts.mjs');
const {buildFactTimeContext}=await import('./control/fact-time-context.ts');
const {matchFortuneKnowledge}=await import('./control/knowledge/match.ts');
const {fortuneKnowledge}=await import('./control/knowledge/catalog.ts');
const {buildFortuneModelContext}=await import('./control/fortune-model-context.ts');
const {interpretFortune,requestForFortuneRun}=await import('./control/fortune-interpretation.ts');
const {buildFortuneEvents}=await import('./control/fortune-events.ts');
const {leoSourcePolicy}=await import('./control/leo-source-context.ts');
const {progressionEpoch,progressionPolicy}=await import('./control/western-progressions.ts');
const {anglesFromFrame,calculateHouseCusps,zodiacalHouse}=await import('./control/western-houses.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/leo-jupiter-luminary-reference.json',import.meta.url)));
const bodies=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'],day=86400000;
function chart(date=ref.sunBirth){const at=Date.parse(date);return {timeKnown:true,bazi:{rawResult:[]},ziwei:{rawResult:[]},western:{
 engineName:'astronomy-engine',engineVersion:'2.1.19',rulesetVersion:'tropical-whole-sign-v1',rawResult:[{julianDay:at/day+2440587.5,ascendant:120,midheaven:30,
 positions:bodies.map(planet=>({planet,longitude:planet==='Sun'?SunPosition(new Date(at)).elon:Ecliptic(GeoVector(Body[planet],new Date(at),true)).elon}))}]}};}
const cache=new Map();
function real(year=2026,month=1,birth=ref.sunBirth){const key=[year,month,birth].join(':');if(!cache.has(key)){
 const input={periodType:'month',displayTimezone:'UTC',targetPeriod:{year,month}},at=Date.UTC(year,month-1,15);
 cache.set(key,calculateFortuneFacts(input,buildFactTimeContext(input,at,'server'),'luminary-private-run',{snapshotId:'luminary-private-snapshot',chart:chart(birth)}));
 }return cache.get(key);}
const rows=run=>run.facts.filter(f=>f.factType==='leo_jupiter_luminary_context');
const matching=run=>matchFortuneKnowledge(run).byMethod.western[14];
const natal=()=>buildLeoLuminaryNatal(chart());
const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);

test('verified natal context retains both distinct luminaries and all eight other 1906 bodies, excluding Pluto and angles',()=>{
 const n=natal();assert.equal(n.status,'ready');assert.equal(n.positions.length,9);assert.equal(n.luminaries.length,2);
 const sun=n.luminaries.find(r=>r.luminary==='Sun'),moon=n.luminaries.find(r=>r.luminary==='Moon');
 close(sun.natalLongitude,ref.sunLongitude);close(moon.natalLongitude,ref.moonLongitudeAtSunBirth);
 for(const r of n.luminaries){assert.equal(r.natalAspects.length,8);assert.equal(r.natalAspects.some(a=>a.body===r.luminary),false);assert.equal(r.jupiterNatalPair.body,'Jupiter');assert.ok(!r.natalAspects.some(a=>['Pluto','ASC','MC'].includes(a.body)));}
});

test('every angular and signed-declination witness agrees with independent vector geometry without declaring nearest aspects to be source hits',()=>{
 const n=natal();for(const r of n.luminaries)for(const pair of r.natalAspects){
  const cosine=Math.cos((r.natalLongitude-pair.longitude)*Math.PI/180);close(pair.separation,Math.acos(Math.max(-1,Math.min(1,cosine)))*180/Math.PI);
  assert.equal(pair.aspectDistances.length,9);for(const a of pair.aspectDistances)close(a.difference,Math.abs(pair.separation-a.angle));
  close(pair.absoluteDeclinationDifference,Math.abs(Math.abs(r.natalDeclination)-Math.abs(pair.declination)));
  assert.equal(pair.sameHemisphere,Math.sign(r.natalDeclination)===Math.sign(pair.declination));assert.equal(pair.isAspect,undefined);
 }
 assert.equal(leoJupiterLuminaryPolicy.natalAspectOrb,'leo-green-1906-natal-aspects-v1');
 for(const r of n.luminaries)for(const a of r.jupiterNatalAspectCandidates){
  assert.ok(a.difference<=a.orb);
  if(a.aspect==='parallel')close(a.difference,r.jupiterNatalPair.absoluteDeclinationDifference);
  else close(a.difference,r.jupiterNatalPair.aspectDistances.find(ref=>ref.aspectType===a.aspect).difference);
 }
});

test('unknown time, multiple candidates, incompatible engine, inconsistent clock and altered Moon coordinates never become reliable natal premises',()=>{
 for(const change of [c=>{c.timeKnown=false;},c=>c.western.rawResult.push(structuredClone(c.western.rawResult[0])),
  c=>{c.western.engineVersion='other';},c=>{c.western.rawResult[0].positions.find(p=>p.planet==='Moon').longitude+=1;},
  c=>{c.bazi={engineName:'lunar-javascript',engineVersion:'1.7.8',rulesetVersion:'utc8-jie-local-civil-late-zi-next-v1',rawResult:[{utc:'1990-07-17T04:00:00Z'}]};}]){
  const c=chart();change(c);assert.notEqual(buildLeoLuminaryNatal(c).status,'ready');
 }
});

test('missing and duplicate required bodies stay unknown while invalid geometric house angles do not invent a birth-place dependency',()=>{
 const missing=chart();missing.western.rawResult[0].positions=missing.western.rawResult[0].positions.filter(p=>p.planet!=='Neptune');assert.equal(buildLeoLuminaryNatal(missing).status,'incomplete_or_duplicate_natal');
 const duplicate=chart();duplicate.western.rawResult[0].positions.push(structuredClone(duplicate.western.rawResult[0].positions[1]));assert.equal(buildLeoLuminaryNatal(duplicate).status,'incomplete_or_duplicate_natal');
 const noAngles=chart();delete noAngles.western.rawResult[0].ascendant;delete noAngles.western.rawResult[0].midheaven;assert.equal(buildLeoLuminaryNatal(noAngles).status,'ready');
});

test('January retains an actual continuing Jupiter/Sun band even though its exact retrograde pass occurred in December',()=>{
 const run=real(),f=rows(run).find(f=>f.normalizedPayload.luminary==='Sun');assert.ok(f);validateFortuneFacts(run);
 const p=f.normalizedPayload;assert.equal(p.hasExactInWindow,false);assert.deepEqual(p.exactPasses,[]);assert.equal(p.episodeStart,ref.firstEpisodeStart);
 assert.deepEqual(p.exactPassDeclinations,[]);
 close(Date.parse(f.activeTo),Date.parse(ref.januaryEpisodeExit),2000);assert.equal(p.exits,true);assert.equal(p.enters,false);
 close(Date.parse(p.nativePassage.enteredAt),Date.parse(ref.firstEpisodeStart),2000);
 close(Date.parse(p.nativePassage.exitedAt),Date.parse(ref.januaryEpisodeExit),2000);
 assert.ok(p.nativePassage.durationDays>90);
 assert.deepEqual(p.nativePassage.exactPasses.map(row=>[row.direction,row.passIndex]),[['direct',1],['retrograde',2]]);
 for(const [index,expected] of [ref.directPass,ref.retrogradePass].entries()){
  const at=Date.parse(p.nativePassage.exactPasses[index].at);
  close(at,Date.parse(expected),2000);
  const actual=Ecliptic(GeoVector(Body.Jupiter,new Date(at),true)).elon;
  close(Math.abs((actual-p.natalLongitude+540)%360-180),0,1e-6);
 }
 assert.equal(matching(run).status,'partial');assert.ok(!run.facts.some(f=>f.factType==='aspect_exact'&&f.normalizedPayload.transitBody==='Jupiter'&&f.normalizedPayload.natalTargetId==='Sun'&&f.normalizedPayload.aspectType==='conjunction'));
});

test('an exact Jupiter passage over an unaspected natal luminary verifies the ordinary reading only on the real point', () => {
 const run = real(2026, 6, '2003-05-08T00:00:00Z');
 const witness = rows(run).find(row => row.normalizedPayload.luminary === 'Moon');
 assert.ok(witness);
 const p = witness.normalizedPayload;
 assert.equal(p.hasReceivedNatalAspect, false);
 assert.deepEqual(p.receivedNatalAspects, []);
 assert.deepEqual(p.jupiterNatalAspectCandidates, []);
 assert.deepEqual(p.directionsAtExactPasses, []);
 assert.equal(p.hasExactInWindow, true);
 const [{ at }] = p.exactPasses;
 close(Date.parse(at), Date.parse('2026-06-25T19:46:58.286Z'), 2000);
 const actual = Ecliptic(GeoVector(Body.Jupiter, new Date(at), true)).elon;
 close(Math.abs((actual - p.natalLongitude + 540) % 360 - 180), 0, 1e-6);
 const result = matching(run);
 const point = rows(run).find(row => row.normalizedPayload.luminary === 'Moon' && row.normalizedPayload.transitKind === 'exact_point');
 assert.ok(point);
 assert.equal(result.status, 'matched');
 assert.deepEqual(result.sourceFactIds, [point.factId]);
 assert.equal(point.activeFrom, at);
 assert.equal(point.normalizedPayload.hasReceivedNatalAspect, false);
 assert.equal(point.normalizedPayload.hasNatalJupiterAspect, false);
 assert.deepEqual(result.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
 assert.equal(matching({ ...run, facts: [witness] }).status, 'partial');
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'luminary-ordinary-passage'));
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /采用原文的普通经过读法，时段只取实际过点/u);
 assert.doesNotMatch(prompt, /作为加强线索|本命联系在过点|hasNatalJupiterAspect|\b[FE]\d+\b/u);
 const { hasReceivedNatalAspect: _checked, ...unmeasured } = p;
 const incomplete = { ...witness, normalizedPayload: unmeasured };
 assert.equal(matching({ ...run, facts: [incomplete] }).status, 'unknown');
});

test('p008 distinguishes its exact natal trine from other natal Jupiter support and the adjacent month', () => {
 const birth = '1968-04-15T19:41:14.378Z', asOf = Date.parse('2023-04-15T00:00:00Z');
 const premise = '行运木星实际同度经过一颗本命日或月，该发光体与本命木星精确成三分。本例只确认过点和同一发光体原有的木星联系。';
 const date = millis => new Date(millis).toISOString();
 const runFor = (birthday, month = 4) => {
  const params = { periodType: 'month', displayTimezone: 'UTC', targetPeriod: { year: 2023, month } };
  const reference = { snapshotId: 'leo-jupiter-exact-trine', chart: chart(birthday) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
  validateFortuneFacts(run);
  return run;
 };
 const run = runFor(birth), match = matching(run);
 assert.equal(match.status, 'matched');
 const band = rows(run).find(row => row.normalizedPayload.luminary === 'Sun' && !row.normalizedPayload.transitKind);
 const hit = rows(run).find(row => row.normalizedPayload.transitKind === 'exact_point');
 assert.ok(hit && band);
 assert.deepEqual(match.sourceFactIds, [hit.factId]);
 assert.deepEqual(match.matchedConditions, [premise]);
 assert.equal(hit.normalizedPayload.luminary, 'Sun');
 const transit = run.facts.find(row => row.factId === hit.normalizedPayload.linkedTransitFactId);
 assert.equal(transit?.exactInstant, hit.exactInstant);
 assert.ok(transit.sourceFactIds.every(source => hit.sourceFactIds.includes(source)));
 assert.equal(hit.parentSignalId, band.parentSignalId);
 assert.deepEqual(match.windows, [{ start: hit.activeFrom, endExclusive: hit.activeTo }]);
 assert.deepEqual(match.candidateWindows, [{ start: band.activeFrom, endExclusive: hit.activeFrom },
  { start: hit.activeTo, endExclusive: band.activeTo }]);
 close(Date.parse(hit.exactInstant), Date.parse('2023-04-29T03:20:30.043Z'), 1000);
 assert.ok(Date.parse(hit.activeTo) - Date.parse(hit.activeFrom) <= 1000);
 const sun = SunPosition(new Date(birth)).elon;
 const jupiter = at => Ecliptic(GeoVector(Body.Jupiter, new Date(at), true)).elon;
 const separation = value => Math.abs((value + 540) % 360 - 180);
 close(separation(jupiter(birth) - sun), 120, 1e-6);
 close(separation(jupiter(hit.exactInstant) - sun), 0, 1e-6);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'leo-jupiter-exact-trine'));
 const detail = '本命太阳与本命木星实成三分相';
 assert.ok(formatFortuneFactAudit(input).includes(detail));
 const provider = formatFortunePrompt(input);
 assert.ok(provider.includes(premise) && !provider.includes(detail));
 assert.doesNotMatch(provider, /hasExactNatalJupiterTrine|natalTrineDifference|1968-04-15/u);
 const adjacent = runFor(birth, 5);
 const near = runFor(date(Date.parse(birth) + 3_600_000));
 assert.equal(matching(adjacent).status, 'partial');
 assert.ok(rows(adjacent).some(row => row.normalizedPayload.luminary === 'Sun'));
 assert.ok(rows(adjacent).every(row => row.normalizedPayload.transitKind !== 'exact_point'));
 const nearPoint = rows(near).find(row => row.normalizedPayload.luminary === 'Sun' && row.normalizedPayload.transitKind === 'exact_point');
 assert.ok(nearPoint);
 assert.equal(nearPoint.normalizedPayload.hasExactNatalJupiterTrine, false);
 assert.equal(nearPoint.normalizedPayload.hasNatalJupiterAspect, true);
 const nearMatch = matching(near);
 assert.equal(nearMatch.status, 'matched');
 assert.ok(nearMatch.sourceFactIds.includes(nearPoint.factId));
 assert.match(nearMatch.matchedConditions[0], /原文把这种已有的木星联系作为加强线索/u);
 assert.ok(rows(near).some(row => row.normalizedPayload.luminary === 'Sun' && row.normalizedPayload.hasExactInWindow));
 assert.equal(matching({ ...run, facts: run.facts.filter(row => row !== hit) }).status, 'partial');

 const lunarBirth = '1968-04-26T16:02:06.283Z', lunarRun = runFor(lunarBirth);
 const lunarMatch = matching(lunarRun), lunarHit = rows(lunarRun).find(row => lunarMatch.sourceFactIds.includes(row.factId));
 assert.equal(lunarMatch.status, 'matched');
 assert.equal(lunarHit?.normalizedPayload.luminary, 'Moon');
 assert.ok(!rows(lunarRun).some(row => row.normalizedPayload.luminary === 'Sun' && row.normalizedPayload.transitKind === 'exact_point'));
 const natalMoon = Ecliptic(GeoVector(Body.Moon, new Date(lunarBirth), true)).elon;
 close(separation(jupiter(lunarBirth) - natalMoon), 120, 1e-6);
 close(separation(jupiter(lunarHit.exactInstant) - natalMoon), 0, 1e-6);
});

test('p008 prefers verified natal longitude over the same parallel at an actual Jupiter passage', () => {
 const newSource = '以黄经相位作为同一对星的主要联系';
 for (const [birth, year, month, target, expected] of [
  ['1930-01-19T12:00:00Z', 2032, 4, 'Sun', '2032-04-01T11:43:36.475Z'],
  ['1930-02-26T12:00:00Z', 2033, 2, 'Moon', '2033-02-03T01:20:26.033Z'],
 ]) {
  const run = real(year, month, birth);
  validateFortuneFacts(run);
  const point = rows(run).find(row => row.normalizedPayload.luminary === target && row.normalizedPayload.transitKind === 'exact_point');
  assert.ok(point, target);
  close(Date.parse(point.exactInstant), Date.parse(expected), 2000);
  const p = point.normalizedPayload;
  assert.equal(p.hasNatalJupiterLongitudePriority, true);
  const { longitude, parallel } = p.natalJupiterLongitudePriority;
  assert.deepEqual([longitude.aspect, longitude.orb, parallel.aspect, parallel.orb], ['trine', 8, 'parallel', 1]);
  const position = (body, at) => body === 'Sun' ? SunPosition(new Date(at)).elon : Ecliptic(GeoVector(Body[body], new Date(at), true)).elon;
  const arc = (x, y) => Math.abs((x - y + 540) % 360 - 180);
  const declination = body => { const date = new Date(birth);
   return EquatorFromVector(RotateVector(Rotation_EQJ_EQD(date), GeoVector(Body[body], date, true))).dec; };
  close(arc(position('Jupiter', point.exactInstant), position(target, birth)), 0, 1e-6);
  close(Math.abs(arc(position('Jupiter', birth), position(target, birth)) - 120), longitude.difference);
  close(Math.abs(Math.abs(declination('Jupiter')) - Math.abs(declination(target))), parallel.difference);
  const isolated = { ...run, facts: [point] };
  const result = matching(isolated);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
  assert.ok(result.confirmedBranches.some(branch => branch.conditions.some(text => text.includes(newSource))));
  const band = rows(run).find(row => row.normalizedPayload.luminary === target && !row.normalizedPayload.transitKind);
  assert.equal(matching({ ...run, facts: [band] }).status, 'partial');
  const noPreference = { ...point, normalizedPayload: { ...p, hasNatalJupiterLongitudePriority: false } };
  assert.equal(matching({ ...run, facts: [noPreference] }).matchedConditions.some(text => text.includes(newSource)), false);
  const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'leo-parallel-priority'));
  const provider = formatFortunePrompt(input);
  const local = /同时有主要黄经相位和赤纬平行，按原书以黄经三分相?为主/u;
  assert.match(formatFortuneFactAudit(input), local);
  assert.doesNotMatch(provider, local);
  assert.ok(provider.includes(newSource));
  assert.doesNotMatch(provider, /natalJupiterLongitudePriority|hasNatalJupiterLongitudePriority/u);
 }
});

test('Leo preserves a real natal angular group on separate Jupiter and Sun passes', () => {
 const birth='2020-01-11T12:00:00Z', timezone='UTC', latitude=35;
 const birthAt=Date.parse(birth), obliquity=e_tilt(MakeTime(new Date(birthAt))).tobl;
 const group={house:4,sign:9,bodies:['Sun','Mercury','Jupiter','Saturn']};
 const bodyLongitude=(body,at)=>body==='Sun'?SunPosition(new Date(at)).elon:Ecliptic(GeoVector(Body[body],new Date(at),true)).elon;
 const byBody=Object.fromEntries(bodies.map(body=>[body,bodyLongitude(body,birthAt)]));
 const checkedHouses=armc=>group.bodies.map(body=>zodiacalHouse(byBody[body],calculateHouseCusps(armc,latitude,obliquity,'placidus').cusps));
 assert.deepEqual(checkedHouses(95),[4,4,4,4]);
 assert.deepEqual(checkedHouses(100),[4,4,3,4]);
 assert.ok(group.bodies.every(body=>Math.floor(byBody[body]/30)===group.sign));
 const runFor=(periodType,targetPeriod,asOf,armc)=>{
  const snapshot=chart(birth);
  Object.assign(snapshot.western.rawResult[0],anglesFromFrame(armc,latitude,obliquity));
  const params={periodType,displayTimezone:timezone,targetPeriod};
  const reference={snapshotId:'leo-angular-group-'+periodType+'-'+armc,chart:snapshot};
  const batch=JSON.parse(JSON.stringify(buildFortuneFactSubmission(params,asOf,reference)));
  const run=bindClientFortuneRun(params,batch,readClientFactTime(params,batch,asOf),reference.snapshotId,reference);
  validateFortuneFacts(run);
  return run;
 };
 const lunarMonth=runFor('month',{year:2032,month:2},Date.UTC(2032,1,16),95);
 const solarDay=runFor('day',{date:'2026-01-11'},Date.UTC(2026,0,11),95);
 const jupiterPoint=rows(lunarMonth).find(({normalizedPayload:p})=>p.luminary==='Sun'&&p.transitKind==='exact_point');
 const solarPoint=run=>run.facts.find(({factType,normalizedPayload:p})=>
  factType==='leo_solar_natal_contact'&&p.natalTargetId==='Mercury');
 const ruleMatch=(run,suffix)=>matchFortuneKnowledge(run).byMethod.western.find(match=>match.knowledgeId.endsWith(suffix));
 const jupiterRule='leo-v1-transit-p008-001', solarRule='leo-v1-transit-p009-001';
 const jupiterCondition='同一星座和同一角宫核到四颗以上星', solarCondition='同一星座且同一角宫实居群星';
 const displayedGroup='太阳、水星、木星、土星同在本命摩羯座第4角宫';
 for(const [run,point,body,target,expected,suffix,condition] of [
  [lunarMonth,jupiterPoint,'Jupiter','Sun','2032-02-16T04:03:04.139Z',jupiterRule,jupiterCondition],
  [solarDay,solarPoint(solarDay),'Sun','Mercury','2026-01-11T11:27:05.058Z',solarRule,solarCondition],
 ]){
  assert.ok(point);
  close(Date.parse(point.exactInstant),Date.parse(expected),1000);
  close(Math.abs((bodyLongitude(body,point.exactInstant)-byBody[target]+540)%360-180),0,1e-6);
  assert.equal(point.normalizedPayload.hasNatalAngularSameSignGroup,true);
  assert.deepEqual(point.normalizedPayload.natalAngularSameSignGroup,group);
  const atomic={...run,facts:[point]}, hit=ruleMatch(atomic,suffix);
  assert.equal(hit.status,'matched');
  assert.ok(hit.sourceFactIds.includes(point.factId));
  assert.ok(hit.confirmedBranches.some(branch=>branch.conditions.some(text=>text.includes(condition))));
  const {input}=buildFortuneModelContext(atomic,interpretFortune(atomic,requestForFortuneRun(atomic),'leo-angular-sign-group'));
  assert.ok(formatFortuneFactAudit(input).includes(displayedGroup));
  const prompt=formatFortunePrompt(input);
  assert.ok(prompt.includes(condition));
  assert.ok(!prompt.includes(displayedGroup));
  assert.doesNotMatch(prompt,/natalAngularSameSignGroup|hasNatalAngularSameSignGroup/u);
 }
 const band=rows(lunarMonth).find(({normalizedPayload:p})=>p.luminary==='Sun'&&!p.transitKind);
 assert.ok(band&&band.exactInstant===undefined);
 assert.equal(band.normalizedPayload.hasNatalAngularSameSignGroup,undefined);
 assert.equal(band.normalizedPayload.natalAngularSameSignGroup,undefined);
 assert.equal(ruleMatch({...lunarMonth,facts:[band]},jupiterRule).status,'partial');
 const split=runFor('day',{date:'2026-01-11'},Date.UTC(2026,0,11),100);
 const splitPoint=solarPoint(split);
 assert.equal(splitPoint.exactInstant,solarPoint(solarDay).exactInstant);
 assert.equal(splitPoint.normalizedPayload.natalHouse,4);
 assert.equal(splitPoint.normalizedPayload.hasNatalAngularSameSignGroup,false);
 assert.equal(splitPoint.normalizedPayload.natalAngularSameSignGroup,undefined);
 assert.deepEqual(splitPoint.normalizedPayload.sameSignNatalBodies.find(row=>row.body==='Jupiter'),{body:'Jupiter',house:3});
 const splitSolar=ruleMatch({...split,facts:[splitPoint]},solarRule);
 assert.equal(splitSolar.status,'matched');
 assert.ok(splitSolar.matchedConditions.every(text=>!text.includes(solarCondition)));
 const splitMonth=runFor('month',{year:2032,month:2},Date.UTC(2032,1,16),100);
 const splitJupiter=rows(splitMonth).find(({normalizedPayload:p})=>p.luminary==='Sun'&&p.transitKind==='exact_point');
 assert.equal(splitJupiter.exactInstant,jupiterPoint.exactInstant);
 assert.equal(splitJupiter.normalizedPayload.hasNatalAngularSameSignGroup,false);
 const splitMonthMatch=ruleMatch({...splitMonth,facts:[splitJupiter]},jupiterRule);
 assert.equal(splitMonthMatch.status,'matched');
 assert.ok(splitMonthMatch.matchedConditions.every(text=>!text.includes(jupiterCondition)));
});

test('real direct and retrograde points share a native episode and preserve direction and pass order instead of inventing a fixed month',()=>{
 const first=rows(real(2025,10)).find(f=>f.normalizedPayload.luminary==='Sun'),second=rows(real(2025,12)).find(f=>f.normalizedPayload.luminary==='Sun');
 assert.equal(first.parentSignalId,second.parentSignalId);const [a]=first.normalizedPayload.exactPasses,[b]=second.normalizedPayload.exactPasses;
 close(Date.parse(a.at),Date.parse(ref.directPass),2000);close(Date.parse(b.at),Date.parse(ref.retrogradePass),2000);
 assert.equal(a.direction,'direct');assert.equal(b.direction,'retrograde');assert.equal(a.passIndex,1);assert.equal(b.passIndex,2);
 for(const f of [first,second]){
  const p=f.normalizedPayload;
  assert.equal(p.sourceMonthDurationVerified,false);assert.equal(p.natalAspectOrbVerified,true);assert.equal(p.directionsVerified,false);
  close(Date.parse(p.nativePassage.exitedAt), Date.parse(ref.januaryEpisodeExit),2000);
  assert.equal(p.nativePassage.exactPasses.length,2);
  const [measurement] = p.exactPassDeclinations;
  assert.equal(measurement.at, p.exactPasses[0].at);
  const at = new Date(measurement.at);
  const declination = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(at), GeoVector(Body.Jupiter, at, true))).dec;
  close(measurement.transitDeclination, declination);
  close(measurement.natalDeclination, p.natalDeclination);
  close(measurement.difference, Math.abs(declination - p.natalDeclination));
 }
});

test('a two-degree Jupiter station confirms only when the same episode brackets it with real exact passes', () => {
 const cases = [
  [ref.sunBirth, true, 1.7693993],
  ['1990-07-18T04:00:00.000Z', true, 0.1391484],
  ['1990-07-20T04:00:00.000Z', false, 2.0484553],
 ];
 for (const [birth, near, difference] of cases) {
  const run = real(2025, 11, birth);
  const fact = rows(run).find(row => row.normalizedPayload.luminary === 'Sun');
  assert.ok(fact);
  const p = fact.normalizedPayload;
  const station = Date.parse('2025-11-11T16:45:02.122Z');
  const longitudeAt = at => Ecliptic(GeoVector(Body.Jupiter, new Date(at), true)).elon;
  assert.ok(longitudeAt(station - 86_400_000) < longitudeAt(station));
  assert.ok(longitudeAt(station + 86_400_000) < longitudeAt(station));
  close(Math.abs((longitudeAt(station) - p.natalLongitude + 540) % 360 - 180), difference, 1e-6);
  assert.equal(p.hasExactInWindow, false);
  assert.equal(p.natalLuminaryStationWitnesses.length, near ? 1 : 0);
  const match = matching(run);
  const confirmed = birth === ref.sunBirth;
  assert.equal(match.status, confirmed ? 'matched' : 'partial');
  const point = rows(run).find(row => row.normalizedPayload.transitKind === 'station_point'
    && row.normalizedPayload.luminary === 'Sun');
  assert.equal(Boolean(point), confirmed);
  assert.ok((confirmed ? match.candidateFactIds : match.sourceFactIds).includes(fact.factId));
  if (!confirmed) assert.deepEqual(p.nativePassage.exactPasses, []);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'jupiter-station'));
  assert.equal(/停驻转逆行，距同一本命太阳.*两度停驻范围内/u.test(formatFortuneFactAudit(input)), near);
  const provider = formatFortunePrompt(input);
  assert.equal(/同一轮轨迹在停驻前后各有一次对这颗星的精确经过/u.test(provider), confirmed);
  assert.doesNotMatch(provider, /两度停驻范围内|natalLuminaryStationWitnesses|stationTimingProfile/u);
  if (!near) continue;
  const [witness] = p.natalLuminaryStationWitnesses;
  close(Date.parse(witness.at), station, 2000);
  close(witness.distance, difference, 1e-6);
  close(witness.longitude, longitudeAt(Date.parse(witness.at)));
  assert.equal(witness.directionAfter, 'retrograde');
  const interval = run.facts.find(row => row.factId === p.linkedTransitFactId);
  const updated = linkLeoJupiterLuminaries(buildLeoLuminaryNatal(chart(birth)), [
   { ...interval, activeTo: witness.at }, { ...interval, activeFrom: witness.at },
  ]);
  assert.deepEqual(updated.map(row => row.payload.natalLuminaryStationWitnesses.length), [0, 1]);
  assert.deepEqual(updated.map(row => row.verifiedStations.length), [0, Number(confirmed)]);
  if (!confirmed) continue;
  assert.deepEqual(match.sourceFactIds, [point.factId]);
  assert.equal(point.activeFrom, point.exactInstant);
  assert.equal(Date.parse(point.activeTo) - Date.parse(point.exactInstant), 1_000);
  assert.equal(point.parentSignalId, fact.parentSignalId);
  assert.ok(interval.sourceFactIds.every(id => point.sourceFactIds.includes(id)));
  const { before, after } = point.normalizedPayload.natalStation;
  close(Date.parse(before), Date.parse(ref.directPass), 2000);
  close(Date.parse(after), Date.parse(ref.retrogradePass), 2000);
  assert.ok(before < point.exactInstant && point.exactInstant < after);
  for (const pass of [before, after]) close(Math.abs((longitudeAt(Date.parse(pass)) - p.natalLongitude + 540) % 360 - 180), 0, 1e-6);
  const outdated = { ...point, normalizedPayload: { ...point.normalizedPayload, stationTimingProfile: 'product' } };
  assert.equal(matching({ ...run, facts: [outdated] }).status, 'partial');
 }
});

test('real Moon and Sun conjunctions bind each illuminated body to its own natal pairs rather than borrowing a more favourable luminary',()=>{
 const run=real(2026,6,ref.moonBirth),sun=rows(run).find(f=>f.normalizedPayload.luminary==='Sun'),moon=rows(run).find(f=>f.normalizedPayload.luminary==='Moon');
 assert.ok(sun&&moon);close(moon.normalizedPayload.natalLongitude,ref.moonLongitude);close(Date.parse(moon.normalizedPayload.exactPasses[0].at),Date.parse(ref.moonDirectPass),2000);
 assert.notEqual(sun.parentSignalId,moon.parentSignalId);assert.notEqual(sun.normalizedPayload.jupiterNatalPair.separation,moon.normalizedPayload.jupiterNatalPair.separation);
 assert.ok(sun.normalizedPayload.natalAspects.some(r=>r.body==='Moon'));assert.ok(moon.normalizedPayload.natalAspects.some(r=>r.body==='Sun'));
 const exact = rows(run).filter(row => matching(run).sourceFactIds.includes(row.factId));
 assert.equal(matching(run).status,'matched');
 assert.deepEqual(exact.map(row => row.normalizedPayload.luminary).sort(), ['Moon', 'Sun']);
 assert.ok(exact.every(row => row.normalizedPayload.transitKind === 'exact_point'));
});

test('natal Jupiter conjunction follows the 1906 same-sign definition when Jupiter actually crosses the Sun', () => {
  const scenarios = [
    { run: real(2026, 6, ref.moonBirth), sameSign: true },
    { run: real(2026, 7, '1990-07-24T00:00:00Z'), sameSign: false },
  ];
  for (const { run, sameSign } of scenarios) {
    const sun = rows(run).find(fact => fact.normalizedPayload.luminary === 'Sun');
    const p = sun.normalizedPayload;
    assert.equal(p.hasExactInWindow, true);
    assert.ok(p.jupiterNatalPair.separation < 10);
    assert.equal(Math.floor(p.natalLongitude / 30) === Math.floor(p.jupiterNatalPair.longitude / 30), sameSign);
    assert.equal(p.jupiterNatalAspectCandidates.some(aspect => aspect.aspect === 'conjunction'), sameSign);
    assert.equal(p.receivedNatalAspects.some(aspect => aspect.body === 'Jupiter' && aspect.aspect === 'conjunction'), sameSign);
    assert.equal(p.natalAspectProfile, 'leo-green-1906-natal-aspects-v1');
    const match = matching(run);
    assert.equal(match.status, 'matched');
    const point = rows(run).find(row => match.sourceFactIds.includes(row.factId) && row.normalizedPayload.luminary === 'Sun');
    assert.equal(point?.normalizedPayload.transitKind, 'exact_point');
    assert.equal(point.normalizedPayload.hasReceivedNatalAspect, true);
    assert.equal(point.normalizedPayload.hasNatalJupiterAspect, sameSign);
    const isolated = matching({ ...run, facts: [point] });
    assert.equal(isolated.status, 'matched');
    if (sameSign) assert.match(isolated.matchedConditions[0], /作为加强线索/u);
    else assert.match(isolated.matchedConditions[0], /与其他行星|和其他行星/u);
    const comparison = { ...sun, normalizedPayload: { ...p, natalAspectProfile: 'leo-natal-aspects-1928-support-v1' } };
    assert.equal(matching({ ...run, facts: [comparison] }).status, 'not_matched');
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'luminary-sign-source'));
    const detail = '按一九〇六年本命相位表，合相还须同一星座';
    assert.ok(formatFortuneFactAudit(input).includes(detail));
    assert.ok(!formatFortunePrompt(input).includes(detail));
  }
});

test('all linked facts keep the same source subjects, native episode and raw provenance without double-counting the parent event',()=>{
 const run=real(2025,10);validateFortuneFacts(run);const f=rows(run)[0],p=f.normalizedPayload,base=run.facts.find(r=>r.factId===p.linkedTransitFactId);
 assert.deepEqual(f.subjectIds,base.subjectIds);assert.equal(f.parentSignalId,base.parentSignalId);assert.ok(f.sourceFactIds.every(id=>run.rawFacts.some(raw=>raw.rawFactId===id)));
 const events=buildFortuneEvents(run,[base,f]);assert.equal(events.length,1);assert.ok(events[0].factIds.includes(f.factId));
});

test('other targets, unrelated natal coordinates, unverified intervals and invalid episode starts cannot provide an atomic source context',()=>{
 const n=natal(),f=real().facts.find(f=>f.factType==='aspect_interval'&&f.normalizedPayload.transitBody==='Jupiter'&&f.normalizedPayload.natalTargetId==='Sun'&&f.normalizedPayload.aspectType==='conjunction');assert.ok(f);
 for(const mutate of [r=>{r.normalizedPayload.natalTargetId='Moon';},r=>{r.normalizedPayload.transitBody='Saturn';},r=>{r.completeness='partial';},r=>{r.normalizedPayload.natalLongitude+=1;},r=>{r.normalizedPayload.episodeStartInstant='not-a-date';},r=>{r.normalizedPayload.episodeStartInstant='2030-01-01T00:00:00Z';}]){
  const bad=structuredClone(f);mutate(bad);assert.deepEqual(linkLeoJupiterLuminaries(n,[bad]),[]);
 }
});

test('SQLite retains the exact source hash and rejects generic, wrong-profile and split natal/transit premises',()=>{
 const rule=fortuneKnowledge.western.rules[14],entry=fortuneKnowledge.western.entries.find(e=>e.id===rule.knowledgeId);
 assert.equal(rule.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:entry.evidence,conditions:entry.conditions})).digest('hex'));assert.equal(rule.queries.length,1);assert.equal(rule.queries[0].factType,'leo_jupiter_luminary_context');assert.equal(rule.unresolved.length,2);
 const absent=structuredClone(real());absent.facts=absent.facts.filter(f=>f.factType!=='leo_jupiter_luminary_context');assert.equal(matching(absent).status,'unknown');
 const wrong=structuredClone(real());rows(wrong).forEach(f=>f.normalizedPayload.profile='other');assert.equal(matching(wrong).status,'not_matched');
 const split=structuredClone(real());for(const f of rows(split)){const other=structuredClone(f);other.factId+='-split';other.normalizedPayload.birthVerified=false;f.normalizedPayload.transitConjunction=false;split.facts.push(other);}assert.equal(matching(split).status,'not_matched');
 const withoutAspects=structuredClone(real());for(const f of rows(withoutAspects)) f.normalizedPayload.hasReceivedNatalAspect=false;
 assert.equal(matching(withoutAspects).status,'partial');
 for(const f of rows(withoutAspects)) delete f.normalizedPayload.hasReceivedNatalAspect;
 assert.equal(matching(withoutAspects).status,'unknown');
 const noTightJupiter=real(2026,1,'1994-07-16T04:00:00Z'),sun=rows(noTightJupiter).find(f=>f.normalizedPayload.luminary==='Sun');
 assert.ok(sun);assert.ok(sun.normalizedPayload.jupiterNatalPair.closestAspects.every(a=>a.difference>10));
 assert.ok(sun.normalizedPayload.jupiterNatalAspectCandidates.every(a=>a.aspect==='parallel'));
 assert.equal(matching(noTightJupiter).status,'partial');
});

test('the Jupiter episode joins only the actual illuminated pair, matching coordinate and overlapping time', () => {
  const n = natal();
  const target = n.luminaries.find(row => row.luminary === 'Sun');
  const reference = target.receivedNatalAspects.find(row => row.coordinate === 'longitude');
  const transit = real().facts.find(f => f.factType === 'aspect_interval' && f.normalizedPayload.transitBody === 'Jupiter'
    && f.normalizedPayload.natalTargetId === 'Sun' && f.normalizedPayload.aspectType === 'conjunction');
  const start = Date.parse(transit.activeFrom), end = Date.parse(transit.activeTo);
  const overlapEnd = new Date(Math.floor((start + end) / 2)).toISOString();
  const direction = {
    method: 'western', scope: 'progressed', factType: 'leo_progressed_aspect', completeness: 'complete', sourceEngine: 'astronomy-engine',
    activeFrom: new Date(start - day).toISOString(), activeTo: overlapEnd, sourceFactIds: ['actual-direction-raw'],
    normalizedPayload: { profile: leoSourcePolicy.profile, targetKind: 'natal', kind: 'secondary', progressionPolicy: progressionPolicy.version,
      progressedBody: 'Sun', natalTargetId: reference.body, aspectType: reference.aspect, coordinate: 'ecliptic_longitude' },
  };
  const change = payload => ({ ...direction, sourceFactIds: ['unrelated-direction-raw'],
    normalizedPayload: { ...direction.normalizedPayload, ...payload } });
  const [row] = linkLeoJupiterLuminaries(n, [transit, direction, change({ targetKind: 'progressed' }),
    change({ coordinate: 'equatorial_declination_of_date' }), change({ progressedBody: 'Moon', natalTargetId: 'Mars' }),
    { ...change({}), activeFrom: transit.activeTo, activeTo: new Date(end + day).toISOString() }]);
  assert.deepEqual(row.payload.repeatingDirections, [{ progressedBody: 'Sun', natalTargetId: reference.body,
    aspectType: reference.aspect, start: transit.activeFrom, endExclusive: overlapEnd }]);
  assert.ok(row.sourceFactIds.includes('actual-direction-raw'));
  assert.ok(!row.sourceFactIds.includes('unrelated-direction-raw'));
  assert.deepEqual([row.start, row.end], [start, end]);
});

test('Chinese prompt keeps actual target, natal geometry and continuing timing with no machine JSON or partial source paragraph',()=>{
 const run=real(),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'luminary-private-report'));
 assert.equal(input.facts.filter(f=>f.type==='leo_jupiter_luminary_context').length,rows(run).length);
 const prompt=formatFortuneFactAudit(input);for(const t of ['受照的本命太阳','本命太阳与本命木星','最近不等于落入已核本命相位容许度','加强分支','固定一个月','整段实算精确经过2次','当前区间未记录精确经过点','同性质尚未核全'])assert.ok(prompt.includes(t),t);
 assert.doesNotMatch(formatFortunePrompt(input), /整段实算精确经过|nativePassage/u);
 for(const forbidden of ['luminary-private','leo-jupiter-luminary-natal-links','linkedTransitFactId','closestAspects','natalAspectOrbVerified','sourceMonthDurationVerified'])assert.ok(!prompt.includes(forbidden),forbidden);
 assert.ok(!input.sections.flatMap(s=>s.findings).some(f=>f.knowledgeId===fortuneKnowledge.western.rules[14].knowledgeId));
 assert.equal(describeFortuneFact({method:'western',type:'leo_jupiter_luminary_context',data:{profile:'wrong'}},String),'');
 assert.ok(!/[{}\[\]]/u.test(describeFortuneFact({method:'western',type:'leo_jupiter_luminary_context',data:rows(run)[0].normalizedPayload},String)));
});

test('actual provider transport receives only the natural-language user message and keeps all simultaneous luminary episodes',async()=>{
 const run=real(2026,6,ref.moonBirth),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'luminary-private-report'));
 assert.equal(input.facts.filter(f=>f.type==='leo_jupiter_luminary_context').length,4);
 const prompt=formatFortuneFactAudit(input);assert.ok(prompt.includes('受照的本命太阳'));assert.ok(prompt.includes('受照的本命月亮'));
 const [sun,moon]=rows(run).filter(row => row.normalizedPayload.transitKind !== 'exact_point')
   .sort((a,b)=>b.normalizedPayload.luminary.localeCompare(a.normalizedPayload.luminary));
 assert.deepEqual(sun.normalizedPayload.repeatingDirections,[]);
 assert.deepEqual(sun.normalizedPayload.directionsAtExactPasses,[]);
 assert.ok(moon.normalizedPayload.repeatingDirections.some(row=>row.progressedBody==='Moon'&&row.natalTargetId==='Jupiter'&&row.aspectType==='parallel'));
 const pass = moon.normalizedPayload.exactPasses[0].at;
 const exactDirection = moon.normalizedPayload.directionsAtExactPasses.find(row => row.natalTargetId === 'Jupiter');
 assert.deepEqual(exactDirection, { at: pass, progressedBody: 'Moon', natalTargetId: 'Jupiter', aspectType: 'parallel' });
 const moonPoint = rows(run).find(row => row.exactInstant === pass && row.normalizedPayload.transitKind === 'exact_point');
 assert.equal(moonPoint.normalizedPayload.hasNatalJupiterLongitudePriority, true);
 assert.equal(moonPoint.normalizedPayload.hasRepeatedMoonJupiterParallelAtPass, undefined);
 const nativeTransit = run.facts.filter(f => f.parentSignalId === moon.parentSignalId && ['aspect_interval', 'aspect_exact'].includes(f.factType));
 const direction = run.facts.find(f => f.factType === 'leo_progressed_aspect' && f.normalizedPayload.progressedBody === 'Moon'
   && f.normalizedPayload.natalTargetId === 'Jupiter' && f.normalizedPayload.aspectType === 'parallel'
   && f.activeFrom < pass && pass < f.activeTo);
 assert.ok(direction);
 const [endsAtPass] = linkLeoJupiterLuminaries(buildLeoLuminaryNatal(chart(ref.moonBirth)),
   [...nativeTransit, { ...direction, activeTo: pass }]);
 assert.ok(endsAtPass.payload.repeatingDirections.length > 0);
 assert.deepEqual(endsAtPass.payload.directionsAtExactPasses, []);
 assert.ok(prompt.includes('次限月亮对本命木星的赤纬绝对值平行重现'));
 assert.ok(prompt.includes('精确经过时，次限月亮对本命木星的赤纬绝对值平行仍处于有效段'));
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{const message=JSON.parse(options.body).messages[1].content;
  assert.equal(message, formatFortunePrompt(input));assert.match(message, /本次只确认实际过点/u);
  assert.doesNotMatch(message, /1990-07-22|nativePassage|hasNatalJupiterAspect|\b[FE]\d+\b/u);
  return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await provider.interpret(input);
});

test('a real Jupiter pass confirms a repeating Moon trine with the same natal Jupiter', () => {
 const birth = '1970-12-15T00:00:00.000Z';
 const run = real(2026, 1, birth);
 const point = rows(run).find(row => row.normalizedPayload.luminary === 'Moon' && row.normalizedPayload.transitKind === 'exact_point');
 assert.ok(point);
 close(Date.parse(point.exactInstant), Date.parse('2026-01-27T14:11:03.353Z'), 1000);
 const p = point.normalizedPayload;
 assert.equal(p.hasRepeatedMoonJupiterLongitudeAtPass, true);
 assert.equal(p.repeatedMoonJupiterLongitude.aspect, 'trine');
 close(p.repeatedMoonJupiterLongitude.deviation, 0.04705946, 1e-6);
 const transit = run.facts.filter(f => f.parentSignalId === point.parentSignalId && ['aspect_interval', 'aspect_exact'].includes(f.factType));
 const direction = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload }) => factType === 'leo_progressed_aspect'
   && normalizedPayload.progressedBody === 'Moon' && normalizedPayload.natalTargetId === 'Jupiter' && normalizedPayload.aspectType === 'trine'
   && activeFrom <= point.exactInstant && point.exactInstant < activeTo);
 assert.ok(direction && direction.sourceFactIds.every(id => point.sourceFactIds.includes(id)));
 const [link] = linkLeoJupiterLuminaries(buildLeoLuminaryNatal(chart(birth)),
   [...transit, { ...direction, natalChartSnapshotId: 'other-chart' }]);
 assert.equal(link.verifiedPasses[0].repeatedMoonJupiterLongitude, undefined);
 const selected = { ...run, facts: [point] };
 const match = matching(selected);
 assert.equal(match.status, 'matched');
 assert.match((match.matchedConditions ?? match.confirmedBranches.flatMap(branch => branch.conditions)).join(), /同为六合或三分/u);
 const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'leo-moon-jupiter-trine'));
 assert.match(formatFortuneFactAudit(input), /次限月亮对同一本命木星确有同类黄经/u);
 assert.match(formatFortunePrompt(input), /同为六合或三分/u);
 assert.doesNotMatch(formatFortunePrompt(input), /repeatedMoonJupiterLongitude|progressedLongitude/u);
});

test('real Jupiter passes verify the same natal Sun or Moon direction of progressed Jupiter', () => {
 const samples = [
   ['Sun', 'conjunction', 0, '2014-07-28T12:00:00Z', '2026-07-24T17:10:19Z', true],
   ['Sun', 'conjunction', 0, '2014-07-30T12:00:00Z', '2026-08-02T08:29:18Z', false],
   ['Moon', 'trine', 120, '1983-07-11T12:00:00Z', '2026-07-12T04:44:18Z', true],
   ['Moon', 'trine', 120, '1983-07-11T14:00:00Z', '2026-07-17T22:22:12Z', false],
 ];
 const distance = (a, b) => Math.abs((a - b + 540) % 360 - 180);
 const longitude = (body, at) => body === 'Sun' ? SunPosition(new Date(at)).elon : Ecliptic(GeoVector(Body[body], new Date(at), true)).elon;
 const condition = /次限木星/u;
 for (const [luminary, aspect, angle, birth, expectedAt, qualified] of samples) {
   const born = Date.parse(birth);
   const month = Number(expectedAt.slice(5, 7));
   const params = { periodType: 'month', targetPeriod: { year: 2026, month }, displayTimezone: 'UTC' };
   const asOf = Date.UTC(2026, month - 1, 15);
   const reference = { snapshotId: 'leo-directed-jupiter-' + birth, chart: chart(birth) };
   const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
   const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), reference.snapshotId, reference);
   const point = rows(run).find(row => row.normalizedPayload.luminary === luminary
     && row.normalizedPayload.transitKind === 'exact_point' && Math.abs(Date.parse(row.exactInstant) - Date.parse(expectedAt)) < 120_000);
   assert.ok(point, birth);
   const p = point.normalizedPayload;
   const at = Date.parse(point.exactInstant), progressedAt = Math.round(progressionEpoch(born, at));
   const natalLuminaryLongitude = longitude(luminary, born);
   const natalJupiterLongitude = longitude('Jupiter', born);
   const progressedJupiterLongitude = longitude('Jupiter', progressedAt);
   const deviation = Math.abs(distance(progressedJupiterLongitude, natalLuminaryLongitude) - angle);
   if (luminary === 'Sun') assert.equal(Math.floor(natalLuminaryLongitude / 30), Math.floor(natalJupiterLongitude / 30));
   else assert.ok(Math.abs(distance(natalJupiterLongitude, natalLuminaryLongitude) - angle) < 3);
   assert.ok(distance(longitude('Jupiter', at), natalLuminaryLongitude) < 1e-6);
   assert.equal(deviation <= leoSourcePolicy.longitudeOrb, qualified);
   assert.equal(p.hasNatalJupiterAspect, true);
   assert.equal(p.hasRepeatedProgressedJupiterToLuminaryAtPass === true, qualified);
   assert.equal(Date.parse(point.activeTo) - at, 1_000);
   const scoped = { ...run, facts: [point] };
   const match = matching(scoped);
   assert.equal(match.status, 'matched');
   const conditions = match.matchedConditions ?? match.confirmedBranches.flatMap(branch => branch.conditions);
   assert.equal(conditions.some(text => condition.test(text)), qualified);
   if (!qualified) continue;
   const witness = p.repeatedProgressedJupiterToLuminary;
   assert.equal(witness.aspect, aspect);
   close(witness.progressedLongitude, progressedJupiterLongitude);
   close(witness.natalLuminaryLongitude, natalLuminaryLongitude);
   close(witness.deviation, deviation);
   const direction = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: d }) =>
     factType === 'progressed_aspect' && d.progressedBody === 'Jupiter' && d.natalTargetId === luminary
     && d.aspectType === aspect && activeFrom <= point.exactInstant && point.exactInstant < activeTo);
   assert.ok(direction && direction.sourceFactIds.every(id => point.sourceFactIds.includes(id)));
   const transit = run.facts.filter(row => row.parentSignalId === point.parentSignalId && ['aspect_interval', 'aspect_exact'].includes(row.factType));
   for (const modified of [{ ...direction, natalChartSnapshotId: 'other-chart' }, { ...direction, activeTo: point.exactInstant }]) {
     const links = linkLeoJupiterLuminaries(buildLeoLuminaryNatal(chart(birth)), [...transit, modified]);
     const linked = links.flatMap(link => link.verifiedPasses).find(row => row.at === point.exactInstant);
     assert.ok(linked);
     assert.equal(linked.repeatedProgressedJupiterToLuminary, undefined);
   }
   const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), reference.snapshotId));
   assert.match(formatFortuneFactAudit(input), condition);
   const prompt = formatFortunePrompt(input);
   assert.match(prompt, condition);
   assert.doesNotMatch(prompt, /repeatedProgressedJupiterToLuminary|progressedLongitude/u);
 }
});

test('a real Jupiter pass confirms the repeating Moon parallel only while its same-chart witness is effective', () => {
 const birth = '1989-08-28T00:00:00.000Z', born = Date.parse(birth);
 const run = real(2026, 6, birth);
 const point = rows(run).find(row => row.normalizedPayload.luminary === 'Moon' && row.normalizedPayload.transitKind === 'exact_point');
 assert.ok(point);
 assert.equal(point.normalizedPayload.hasNatalJupiterLongitudePriority, false);
 assert.equal(point.normalizedPayload.hasRepeatedMoonJupiterParallelAtPass, true);
 const witness = point.normalizedPayload.repeatedMoonJupiterParallel;
 const at = Date.parse(point.exactInstant);
 close(at, Date.parse('2026-06-16T23:47:50.613Z'), 2);
 const declination = (body, instant) => {
   const date = new Date(instant);
   return EquatorFromVector(RotateVector(Rotation_EQJ_EQD(date), GeoVector(Body[body], date, true))).dec;
 };
 const jupiter = declination('Jupiter', born), natalMoon = declination('Moon', born);
 const progressedMoon = declination('Moon', Math.round(progressionEpoch(born, at)));
 close(witness.natalJupiterDeclination, jupiter);
 close(witness.progressedDeclination, progressedMoon);
 close(witness.natalDeviation, Math.abs(Math.abs(jupiter) - Math.abs(natalMoon)));
 close(witness.deviation, Math.abs(Math.abs(jupiter) - Math.abs(progressedMoon)));
 assert.ok(witness.natalDeviation < 1 && witness.deviation < 1);
 const transit = run.facts.filter(f => f.parentSignalId === point.parentSignalId && ['aspect_interval', 'aspect_exact'].includes(f.factType));
 const direction = run.facts.find(({ factType, activeFrom, activeTo, normalizedPayload: p }) =>
   factType === 'leo_progressed_aspect' && p.progressedBody === 'Moon' && p.natalTargetId === 'Jupiter' && p.aspectType === 'parallel'
     && activeFrom <= point.exactInstant && point.exactInstant < activeTo);
 assert.ok(direction && direction.sourceFactIds.every(id => point.sourceFactIds.includes(id)));
 for (const changes of [{ activeTo: point.exactInstant }, { natalChartSnapshotId: 'other-chart' }]) {
   const [link] = linkLeoJupiterLuminaries(buildLeoLuminaryNatal(chart(birth)), [...transit, { ...direction, ...changes }]);
   assert.ok(link.verifiedPasses.length === 1);
   assert.equal(link.verifiedPasses[0].repeatedMoonJupiterParallel, undefined);
 }
 const selected = { ...run, facts: [point] };
 const match = matching(selected);
 const conditions = hit => (hit.matchedConditions ?? hit.confirmedBranches.flatMap(branch => branch.conditions)).join();
 assert.equal(match.status, 'matched');
 assert.match(conditions(match), /次限月亮对同一本命木星/u);
 assert.deepEqual(match.windows, [{ start: point.activeFrom, endExclusive: point.activeTo }]);
 const outdated = { ...point, normalizedPayload: { ...point.normalizedPayload, hasRepeatedMoonJupiterParallelAtPass: undefined } };
 assert.doesNotMatch(conditions(matching({ ...run, facts: [outdated] })), /次限月亮对同一本命木星/u);
 const { input } = buildFortuneModelContext(selected, interpretFortune(selected, requestForFortuneRun(selected), 'leo-moon-jupiter-repeat'));
 const provider = formatFortunePrompt(input);
 assert.match(provider, /次限月亮对同一本命木星/u);
 assert.doesNotMatch(provider, /repeatedMoonJupiterParallel|progressedDeclination|23:47:50/u);
});
