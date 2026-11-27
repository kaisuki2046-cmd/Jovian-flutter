import assert from 'node:assert/strict';
import fs,{readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {createHash} from 'node:crypto';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {test} from 'node:test';
import {calculateBaZi,describeBaZiPillars,chartFacts,chartVersions} from '../../control/charts.ts';
import {createClaimsCatalog,compileClaimSources,claimChartContext,explainClaim,structuredClaimMappings} from './claims.mjs';
import {claimSourceDirectory} from './claims-sqlite.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import {catalogForDirectory,lookupInterpretations} from './database.mjs';
import {chartContext,evaluateRule} from './matching.mjs';
import {parseChartQueries,createReportLookup} from './report-lookup.mjs';
import {buildReportMaterials} from '../report-materials.mjs';
import {generateReport} from '../report.mjs';
const batch=JSON.parse(readFileSync(new URL('./claims/integration-batch-33-20261119.json',import.meta.url)));
const native=JSON.parse(readFileSync(new URL('./claims/integration-batch-33-witnesses.json',import.meta.url)));
const sources=JSON.parse(readFileSync(new URL('./claims/bazi.json',import.meta.url)));
const ids={summer:'qtbj-v2-c011-p002-301',pair:'qtbj-v5-c081-p002-101',waterUnshown:'qtbj-v5-c074-p003-401',waterAbsent:'qtbj-v5-c082-p001-102',noDing:'qtbj-v2-c006-p001-002',promoted:'smth-v9-liuri-10-01-p007-101'};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const query=confirmedFacts=>({method:'bazi',rulesetVersion:chartVersions.bazi.rulesetVersion,confirmedFacts});
const rawFacts=w=>chartFacts.bazi(calculateBaZi(Date.parse(w.date),Date.parse(w.localDate)));
const observed=pillars=>chartFacts.bazi(describeBaZiPillars(pillars));
function temporary(context){const directory=mkdtempSync(join(tmpdir(),'destiny-batch-thirty-three-'));context.after(()=>{assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep+'destiny-batch-thirty-three-'));rmSync(directory,{recursive:true,force:true});});return directory;}

test('all 32 new or promoted alternatives reach SQLite, explanation and report materials from native dates',context=>{
  const directory=temporary(context),catalog=catalogForDirectory(directory),seen=new Set();catalog.ensure();
  assert.equal(batch.newWholeEntries,5);assert.equal(batch.promotedWholeEntries,1);assert.equal(native.targetAlternatives,32);assert.deepEqual(native.missing,[]);
  for(const w of native.witnesses){const raw=rawFacts(w),parsed=parseChartQueries([query(raw)]);assert.ok(parsed);const chart=claimChartContext('bazi',chartContext('bazi',parsed[0].confirmedFacts,[],'natal'));
    const hits=lookupInterpretations(directory,parsed[0]);assert.ok(createReportLookup(directory)(parsed).length);
    for(const proof of w.proofs){const row=catalog.get(proof.id),input=row.inputs.find(i=>digest(i)===proof.inputDigest);assert.ok(input);assert.equal(evaluateRule(input,'natal',chart).matched,true);
      const hit=hits.find(h=>h.id===proof.id);assert.ok(hit);assert.equal(explainClaim(proof.id,'bazi',chartContext('bazi',raw,[],'natal'),undefined,catalog).matched,true);
      assert.deepEqual(row.claim,sources.find(s=>s.id===proof.id));assert.ok(buildReportMaterials([{topic:'命理',personality:[],events:[hit]}]).includes(row.claim.evidence.original_text));seen.add(proof.id+':'+proof.inputDigest);
    }
  }assert.deepEqual([...seen].sort(),batch.changes.flatMap(r=>r.inputs.map(i=>r.id+':'+i.digest)).sort());
});

test('summer columns bind Gui to year and Ji to month while hidden Bing is not replaced by exposed Bing',context=>{
  const directory=temporary(context),matches=facts=>lookupInterpretations(directory,query(facts)).some(h=>h.id===ids.summer);
  const positive=observed({year:'癸酉',month:'己未',day:'乙巳',hour:'丙子'});assert.equal(matches(positive),true);
  assert.equal(matches(observed({year:'戊午',month:'己未',day:'乙巳',hour:'丙子'})),false,'same month stem, wrong year stem');
  assert.equal(matches(observed({year:'癸酉',month:'戊午',day:'乙巳',hour:'丙子'})),false,'summer alone does not provide the required month stem');
  assert.equal(matches(observed({year:'癸酉',month:'己未',day:'乙酉',hour:'丙子'})),false,'Bing exposed at hour is not Bing concealed');
  const[unknown]=parseChartQueries([query(positive)],{timeKnown:false});assert.equal(matches(unknown.confirmedFacts),true,'all necessary evidence remains confirmed');
});

test('water unshown differs from absent water, and hidden fire cannot replace exposed fire',context=>{
  const directory=temporary(context),matches=(id,pillars)=>lookupInterpretations(directory,query(observed(pillars))).some(h=>h.id===id);
  const positive={year:'丙寅',month:'丁酉',day:'庚子',hour:'戊寅'};assert.equal(matches(ids.waterUnshown,positive),true,'Gui concealed in Zi is allowed');
  assert.equal(matches(ids.waterUnshown,{...positive,hour:'壬午'}),false,'Ren exposed violates water unshown');
  assert.equal(matches(ids.waterUnshown,{year:'戊寅',month:'辛酉',day:'庚寅',hour:'戊寅'}),false,'concealed Bing is not exposed fire');
  const[unknown]=parseChartQueries([query(observed(positive))],{timeKnown:false});assert.ok(!lookupInterpretations(directory,unknown).some(h=>h.id===ids.waterUnshown));
  const dry={year:'戊午',month:'丁巳',day:'辛酉',hour:'丁酉'};assert.equal(matches(ids.waterAbsent,dry),true);
  for(const day of ['辛亥','辛丑'])assert.equal(matches(ids.waterAbsent,{...dry,day}),false,'hidden Ren or Gui still violates entire absence');
  const[lost]=parseChartQueries([query(observed(dry))],{timeKnown:false});assert.ok(!lookupInterpretations(directory,lost).some(h=>h.id===ids.waterAbsent));
});

test('source-specific configurations preserve exact columns, exclusions and guarded full-source changes',context=>{
  const directory=temporary(context),catalog=catalogForDirectory(directory),matches=(id,facts)=>lookupInterpretations(directory,query(facts)).some(h=>h.id===id);
  const pair=rawFacts(native.witnesses.find(w=>w.proofs.some(p=>p.id===ids.pair)));assert.equal(matches(ids.pair,pair),true);
  assert.equal(matches(ids.pair,observed({year:'丙寅',month:'壬辰',day:'辛酉',hour:'丙申'})),false,'year/hour Bing cannot replace month/hour Bing');
  const noDing=rawFacts(native.witnesses.find(w=>w.proofs.some(p=>p.id===ids.noDing)));assert.equal(matches(ids.noDing,noDing),true);
  for(const pillars of [{year:'庚午',month:'乙酉',day:'甲子',hour:'甲子'},{year:'庚申',month:'乙酉',day:'甲子',hour:'丁卯'}])assert.equal(matches(ids.noDing,observed(pillars)),false,'concealed or exposed Ding still violates no Ding');
  const fixture=join(temporary(context),'source');mkdirSync(fixture);
  for(const method of ['ziwei','western'])writeFileSync(join(fixture,method+'.json'),'[]');
  writeFileSync(join(fixture,'upgrade-manifest.json'),JSON.stringify({changedConditionIds:{},changedEvidenceIds:{}}));
  const changed=[ids.pair,ids.noDing].map(id=>{const source=structuredClone(sources.find(r=>r.id===id));source.conditions.normalized.push('另需未知条件');return source;});writeFileSync(join(fixture,'bazi.json'),JSON.stringify(changed));
  for(const row of compileClaimSources(fixture)){assert.ok(!row.inputs?.length);assert.deepEqual(row.branches,[]);}
  assert.ok(catalog.get(ids.pair).inputs.every(i=>i.required.some(f=>f.position==='month'&&f.stem==='丙')&&i.required.some(f=>f.position==='hour'&&f.stem==='丙')));
});

test('audit counts promotion separately, retains the exact prior branch input and all source hashes',context=>{
  const catalog=catalogForDirectory(temporary(context)),mappings=new Map([...structuredClaimMappings(catalog)].map(r=>[r.id,r]));
  for(const row of batch.changes){assert.equal(mappings.get(row.id).status,'indexed');assert.equal(mappings.get(row.id).remainingAlternatives??0,0);}
  assert.equal(batch.previousQueryableCompiledUnchanged,2820);assert.equal(batch.previousQueryableInputsPreserved,2821);
  const promoted=catalog.get(ids.promoted);assert.deepEqual(promoted.inputs.map(digest),batch.promotedInputDigests);assert.deepEqual(promoted.branches,[]);
  assert.ok(promoted.inputs[0].required.some(f=>f.kind==='bazi_ten_god_structure'&&f.name==='伤官生财'));
  assert.ok(promoted.inputs[0].required.some(f=>f.kind==='pillar'&&f.position==='day'&&f.ganZhi==='癸卯'));
  assert.ok(promoted.inputs[0].required.some(f=>f.kind==='pillar'&&f.position==='hour'&&f.ganZhi==='壬子'));
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
});

test('fresh runtime retrieves all six entries with source JSON reads blocked',context=>{
  const directory=temporary(context);catalogForDirectory(directory).ensure();const original=fs.readFileSync;
  fs.readFileSync=function(file,...args){if(String(file).startsWith(claimSourceDirectory)&&/\.json$/u.test(String(file)))throw new Error('Runtime JSON scan');return original(file,...args);};syncBuiltinESMExports();
  try{const catalog=createClaimsCatalog({directory});for(const row of batch.changes){const w=native.witnesses.find(w=>w.proofs.some(p=>p.id===row.id));assert.ok(lookupInterpretations(directory,query(rawFacts(w)),catalog).some(h=>h.id===row.id));}}
  finally{fs.readFileSync=original;syncBuiltinESMExports();}
});

test('a model double receives the reviewed literal original and explicit limits through the real report query',async context=>{
  const directory=temporary(context),actual=createReportLookup(directory),w=native.witnesses.find(w=>w.proofs.some(p=>p.id===ids.pair));let calls=0;
  const lookup=queries=>actual(queries).map(r=>({...r,personality:r.personality.filter(h=>h.id===ids.pair),events:r.events.filter(h=>h.id===ids.pair)}));
  const result=await generateReport({chartQueries:parseChartQueries([query(rawFacts(w))])},{lookup,signal:new AbortController().signal,
    complete:async request=>{calls++;assert.ok(request.materials.includes('如月时皆丙'));assert.match(request.materials,/不据此推定化合成败/u);assert.match(request.materials,/不当作现实结果/u);assert.ok(!request.materials.includes('秋月甲日'));assert.ok(!request.materials.includes('庚透无丁'));return'模型替身报告';}});
  assert.equal(calls,1);assert.equal(result.report,'模型替身报告');
});
