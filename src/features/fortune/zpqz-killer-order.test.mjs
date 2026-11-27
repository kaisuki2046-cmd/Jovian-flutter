import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Solar} from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import {describeFortuneFact,formatFortuneFactAudit, formatFortunePrompt} from './control/fortune-prompt.mjs';
import {createFortuneDeepSeek} from './server/deepseek-expression.mjs';
const {baziZpqzKillerOrder,zpqzKillerOrderCases,zpqzKillerOrderVariants,zpqzKillerOrderPolicy}=await import('./control/bazi-zpqz-killer-order.ts');
const {calculateFortuneFacts,validateFortuneFacts}=await import('./control/fortune-facts.ts');
const {buildFactTimeContext}=await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const {matchFortuneKnowledge}=await import('./control/knowledge/match.ts');
const {evaluateFortuneRules,fortuneKnowledge}=await import('./control/knowledge/catalog.ts');
const {buildFortuneModelContext}=await import('./control/fortune-model-context.ts');
const {interpretFortune,requestForFortuneRun}=await import('./control/fortune-interpretation.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/zpqz-killer-order-reference.json',import.meta.url)));
const layers=['year','month','day','hour'],native=values=>Object.fromEntries(layers.map((key,i)=>[key,values[i]]));
const printed=id=>native(ref.printedCases.find(c=>c.id===id).pillars),ctx=(n=printed('tuotuo'),luck='丁未',known=true)=>baziZpqzKillerOrder(n,known,luck);
const indices=[139,140,141,142,143,144,147];
function chart(e){const [y,m,d]=e.date,l=Solar.fromYmdHms(y,m,d,e.hour,0,0).getLunar();return {timeKnown:true,bazi:{engineName:'lunar-javascript',engineVersion:'1.7.8',rulesetVersion:'utc8-jie-local-civil-late-zi-next-v1',rawResult:[{
 utc:new Date(Date.UTC(y,m-1,d,e.hour-8)).toISOString(),year:l.getYearInGanZhiExact(),month:l.getMonthInGanZhiExact(),day:l.getDayInGanZhiExact(),hour:l.getTimeInGanZhi(),
 luckPeriods:l.getEightChar().getYun(e.gender,2).getDaYun(11).slice(1).map(s=>({ganZhi:s.getGanZhi(),startAge:s.getStartAge(),endAge:s.getEndAge()})),tenGods:{},shenSha:{},
 }]},ziwei:{rawResult:[]},western:{rawResult:[]}};}
const cache=new Map();function real(i){if(!cache.has(i)){const e=i==='excluded'?ref.excluded:ref.calendarExamples[i],input={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year:e.year}};
 cache.set(i,calculateFortuneFacts(input,buildFactTimeContext(input,Date.parse(e.year+'-11-19T02:00:00Z'),'server'),'order-private-run',{snapshotId:'order-private-chart',chart:chart(e)}));}return cache.get(i);}
const rows=run=>run.facts.filter(f=>f.factType==='zpqz_killer_order_context'),match=(run,i)=>matchFortuneKnowledge(run).byMethod.bazi[i];
const has=(p,god,kind,stem)=>p.gods.find(r=>r.god===god)[kind==='透干'?'exposedRows':'hiddenRows'].some(r=>r.stem===stem);

function submitted(date, hour, year, gender = 1) {
 const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
 const now = Date.UTC(year, 5, 1);
 const reference = { snapshotId: 'killer-printed-' + date.join('-') + '-' + hour };
 const archived = chart({ date, hour, gender });
 archived.birthContext = { birthInstant: archived.bazi.rawResult[0].utc, precision: 'minute', latitude: 39.9042, longitude: 116.4074,
  timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
 const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...reference, chart: archived })));
 assert.ok(rows(batch).every(fact => !('printedLuck' in fact.normalizedPayload)));
 const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
 validateFortuneFacts(run);
 return run;
}
const modelContext = run => buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'killer-printed-report'));
const candidate = (natal, luck, timeKnown = true, confirmed = true) => ({
 factType: 'zpqz_killer_order_context', scope: 'decadal', completeness: 'complete',
 normalizedPayload: { ...ctx(natal, luck, timeKnown), confirmed },
});

test('the valid diagrams retain original order while Jia-Hu and Bing-Hai remain separate invalid transcriptions',()=>{
 assert.deepEqual(zpqzKillerOrderCases,ref.printedCases);assert.deepEqual(zpqzKillerOrderVariants,ref.sourceVariants);
 for(const c of ref.printedCases){const r=ctx(native(c.pillars)).printedCases.find(r=>r.id===c.id);assert.equal(r.matches,true);assert.equal(r.stemCheck.yearMonthCompatible,true);assert.equal(r.stemCheck.dayHourCompatible,true);}
 for(const c of ref.sourceVariants){assert.equal(c.validPillars,false);assert.throws(()=>ctx(native(c.pillars)));}
});

test('the Liu source reading keeps wealth and food contacts while excluding the two killer-use candidates at the actual Geng-Chen handoff', () => {
 const date = [1884, 12, 2], cut = '1926-07-11T00:00:00.000Z';
 const run = submitted(date, 4, 1926);
 const before = rows(run).find(row => row.activeTo === cut && row.normalizedPayload.luckPillar === '己卯');
 const after = rows(run).find(row => row.activeFrom === cut && row.normalizedPayload.luckPillar === '庚辰');
 assert.ok(before && after);
 for (const fact of [before, after]) {
  const p = fact.normalizedPayload;
  assert.equal(p.natalPillarSequence, '甲申乙亥丙戌庚寅');
  assert.equal(p.liuSourceKillerNotTaken, true);
  assert.ok(p.killerFoodMatched && p.killerWealthMatched);
  const path = p.killerWealthLuck.wealthRemedies.find(row => row.output.position === 'day' && row.output.stem === '戊'
   && row.killer.position === 'month' && row.killer.stem === '壬' && row.seal.stem === '乙' && row.wealth.stem === '庚');
  assert.ok(path);
  const moving = fact === before ? path.outputLuck : path.wealthLuck;
  assert.ok(moving.some(row => row.kind === '运干' && row.stem === p.luckPillar[0]));
 }
 const hits = matchFortuneKnowledge(run).byMethod.bazi;
 assert.equal(hits[139].status, 'excluded');
 assert.equal(hits[141].status, 'excluded');
 for (const index of [142, 143, 144, 147]) {
  assert.equal(hits[index].status, 'not_matched');
 }
 const near = submitted(date, 6, 1926);
 const nearFact = rows(near).find(row => row.normalizedPayload.luckPillar === '庚辰');
 assert.equal(nearFact?.normalizedPayload.natalPillarSequence, '甲申乙亥丙戌辛卯');
 assert.equal(nearFact?.normalizedPayload.liuSourceKillerNotTaken, false);
 assert.equal(match(near, 139).status, 'partial');
 assert.equal(match(near, 141).status, 'partial');
 assert.equal(ctx(printed('liu-previous'), '庚辰', false).liuSourceKillerNotTaken, undefined);
});

test('Tuotuo adjacent Ren-Jia-Bing-Wu generations keep the real day master and explicitly unverified control, including the Jia-Hu source variant',()=>{
 const p=ctx();assert.equal(p.generationChainPairs.length,3);assert.ok(p.generationChainPairs.every(r=>r.generates));assert.equal(p.generationChainPairs[1].to.god,'日元');
 assert.ok(p.killerSealContacts.some(r=>r.from.stem==='壬'&&r.to.stem==='甲'));assert.ok(p.sealOutputContacts.some(r=>r.from.stem==='甲'&&r.to.stem==='戊'));
 for(const key of ['strengthVerified','clearingVerified','remedyVerified','climateVerified'])assert.equal(p[key],false);
 assert.ok(describeFortuneFact({method:'bazi',type:'zpqz_killer_order_context',data:p},String).includes('甲胡'));
});

test('He original wealth and seal are three columns apart, and the source counterfactual swap is adjacent without geometry alone proving either outcome',()=>{
 const p=ctx(printed('he')),original=p.wealthSealPairs.find(r=>r.wealth.stem==='丙'&&r.seal.stem==='辛');assert.equal(original.distance,3);assert.deepEqual(original.between.map(r=>r.position),['month','day']);
 const swap=ctx({...printed('he'),month:'辛丑',hour:'戊戌'}),changed=swap.wealthSealPairs.find(r=>r.wealth.stem==='丙'&&r.seal.stem==='辛');assert.equal(changed.distance,1);assert.equal(changed.adjacent,true);
 assert.equal(p.remedyVerified,false);assert.equal(swap.remedyVerified,false);
});

test('wealth removing a seal to preserve food requires an actual exposed seal and dual wealth/seal use cannot be satisfied by wealth alone',()=>{
 const p=ctx(printed('zhou'));assert.equal(p.sealsExposed,true);assert.equal(p.wealthExposed,true);assert.ok(p.sealOutputContacts.some(r=>r.from.stem==='甲'&&r.to.stem==='戊'));assert.ok(p.wealthSealContacts.some(r=>r.from.stem==='庚'&&r.to.stem==='甲'));
 assert.equal(fortuneKnowledge.bazi.rules[141].queries[0].where.sealsExposed,true);assert.equal(fortuneKnowledge.bazi.rules[144].queries[0].where.sealsPresent,true);
 const absent=structuredClone(real(141));rows(absent).forEach(f=>f.normalizedPayload.sealsExposed=false);assert.equal(match(absent,141).status,'not_matched');
});

test('Yue and Shen preserve visible officer and hidden killer identities, shared element roots and the actual Zi-Wu clash without declaring successful clearing',()=>{
 const yue=ctx(printed('yue')),shen=ctx(printed('shen'));assert.ok(has(yue,'正官','透干','丁'));assert.ok(has(yue,'七杀','支藏','丙'));assert.equal(yue.officerAndKillerExposed,false);
 assert.ok(yue.roots.find(r=>r.stem==='丁').roots.some(r=>r.position==='month'&&!r.exactStem));
 assert.ok(shen.natalRelationPairs.some(r=>r.kind==='六冲'&&r.members.includes('year')&&r.members.includes('month')));
 assert.ok(has(shen,'正官','透干','丙'));assert.ok(has(shen,'七杀','支藏','丁'));assert.equal(shen.clearingVerified,false);
});

test('moving attacks name the exact original clearing helper, not a wealth or seal target, and the moving stem has no fabricated fifth-column distance',()=>{
 const n=native(['庚寅','乙酉','甲子','戊辰']),p=ctx(n,'辛亥'),pair=p.movingAttacksClearingHelpers.find(r=>r.helper.stem==='乙'&&r.target.stem==='庚');assert.ok(pair);assert.equal(pair.helper.tenGod,'劫财');assert.equal(pair.target.tenGod,'七杀');assert.equal(pair.moving.tenGod,'正官');assert.equal(pair.columnDistance,undefined);
 assert.equal(ctx(n,'丙寅').movingAttacksClearingHelpers.length,0);assert.ok(p.natalFivePairs.every(r=>r.distance<=3));
});

test('Zhao has no food but does have seals, and its hour Wu coordinate cannot substitute for a month Yang blade or a no-seal premise',()=>{
 const p=ctx(printed('zhao'));assert.equal(p.foodAbsent,true);assert.equal(p.sealsPresent,true);assert.equal(p.monthYangBlade,false);assert.deepEqual(p.luPlusOnePositions.map(r=>r.position),['hour']);
 const u=fortuneKnowledge.bazi.rules[143].unresolved.join();assert.ok(u.includes('原局无食'));assert.ok(!u.includes('原局无印与官运'));
 const missing=ctx(printed('zhao'),'甲子',false);assert.equal(missing.foodAbsent,undefined);assert.equal(missing.printedCases.find(c=>c.id==='zhao').matches,undefined);
});

test('opposite wealth/seal examples share the same Ding-Ren gap without a fabricated light/heavy decision, and the officer example preserves hidden hurt versus exposed officer',()=>{
 const a=ctx(printed('wealth-heavy')),b=ctx(printed('seal-heavy'));assert.ok(a.wealthSealPairs.some(p=>p.distance===3));assert.ok(b.wealthSealPairs.some(p=>p.distance===3));assert.equal(a.strengthVerified,false);assert.equal(b.strengthVerified,false);
 const c=ctx(printed('hurt-officer'));assert.equal(c.officerExposed,true);assert.equal(c.hurtExposed,false);assert.ok(has(c,'伤官','支藏','癸'));assert.ok(has(c,'正官','透干','丁'));
});

test('seven real modern calendars bind each source to exact natal columns and uniquely confirmed full luck segments with complete raw provenance',()=>{
 for(const i of indices){const run=real(i),e=ref.calendarExamples[i];validateFortuneFacts(run);assert.equal(match(run,i).status,i===140?'not_matched':[139,143].includes(i)?'matched':'partial',String(i));
  const selected=rows(run).filter(f=>f.normalizedPayload.confirmed&&f.normalizedPayload.luckPillar===e.luck);assert.ok(selected.length);
  for(const f of selected){assert.deepEqual(f.normalizedPayload.natalPillars.map(p=>p.pillar),e.natal);assert.ok(f.normalizedPayload.stageStart<=f.activeFrom&&f.activeTo<=f.normalizedPayload.stageEnd);assert.ok(f.sourceFactIds.every(id=>run.rawFacts.some(raw=>raw.rawFactId===id)));}
 }
});

test('the real 1984 converted-wealth example is excluded from ordinary hurt-officer use without asserting all modified charts have the same pattern',()=>{
 const run=real('excluded');validateFortuneFacts(run);assert.deepEqual(chart(ref.excluded).bazi.rawResult[0].year,'甲子');
 const matches = matchFortuneKnowledge(run).byMethod.bazi;
 assert.equal(matches[43].status, 'excluded');
 assert.equal(matches[147].status, 'excluded');
 const converted=rows(run).find(f=>f.normalizedPayload.convertedWealthPrintedExample&&f.normalizedPayload.hurtOfficerMatched);
 assert.ok(converted);
 assert.deepEqual(converted.normalizedPayload.hurtOfficerLuck.convertedWealthMembers,
  [{branch:'申',positions:['month']},{branch:'子',positions:['year']},{branch:'辰',positions:[]}]);
 const sealContexts = run => run.facts.filter(row => row.factType === 'zpqz_seal_food_context');
 const sealStage = sealContexts(run).find(row => row.activeFrom === converted.activeFrom
  && row.normalizedPayload.luckPillar === converted.normalizedPayload.luckPillar);
 assert.ok(sealStage?.normalizedPayload.hasExposedOfficerWealthSeal);
 assert.equal(sealStage.normalizedPayload.convertedWealthPrintedExample, true);
 assert.equal(ctx({...printed('converted-wealth'),day:'己丑'}).convertedWealthPrintedExample,false);
 assert.equal(ctx(printed('converted-wealth'), '庚午', false).convertedWealthPrintedExample, undefined);
 const restored=structuredClone(run);
 for (const fact of [...rows(restored), ...sealContexts(restored)]) fact.normalizedPayload.convertedWealthPrintedExample = false;
 const restoredMatches = matchFortuneKnowledge(restored).byMethod.bazi;
 assert.equal(restoredMatches[43].status, 'partial');
 assert.equal(restoredMatches[147].status, 'partial');
});

test('SQLite source hashes and unresolved meanings survive import, and generic or split wealth/seal records cannot satisfy one atomic condition',()=>{
 for(const i of indices){const r=fortuneKnowledge.bazi.rules[i],e=fortuneKnowledge.bazi.entries.find(e=>e.id===r.knowledgeId);assert.equal(r.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:e.evidence,conditions:e.conditions})).digest('hex'));assert.equal(r.queries.length,1);assert.equal(r.unresolved.length,i===140?0:1);assert.equal(r.queries[0].factType,'zpqz_killer_order_context');}
 const absent=structuredClone(real(141));absent.facts=absent.facts.filter(f=>f.factType!=='zpqz_killer_order_context');assert.equal(match(absent,141).status,'unknown');
 const split=structuredClone(real(141));for(const f of rows(split)){const other=structuredClone(f);other.factId+='-other';other.normalizedPayload.sealsExposed=false;f.normalizedPayload.wealthExposed=false;split.facts.push(other);}assert.equal(match(split,141).status,'not_matched');
});

test('provider receives natural Chinese targets, actual day-master order and source disagreements, with no machine JSON or partial source paragraph',async()=>{
 const run=real(143),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'order-private-report'));assert.ok(input.facts.some(f=>f.type==='zpqz_killer_order_context'));
 const prompt=formatFortuneFactAudit(input);for(const text of ['无食不能误写成无印','伤官运为美与评注恐误','去印存食须有实际印的位置','同干与同五行异干分开','日元不计为另一外透比肩'])assert.ok(prompt.includes(text),text);
 for(const secret of ['order-private','zpqz-killer-clearing-helper','monthKillerCandidate','generationChainPairs','movingAttacksClearingHelpers','sourceVariants','stageStart'])assert.ok(!prompt.includes(secret),secret);
 const findings = input.sections.flatMap(section => section.findings);
 assert.ok(!findings.some(finding => indices.some(index => index !== 140 && index !== 143
  && finding.knowledgeId === fortuneKnowledge.bazi.rules[index].knowledgeId)));
 const confirmed = match(run, 143);
 const blade = findings.find(finding => finding.knowledgeId === confirmed.knowledgeId);
 assert.equal(blade.originalText, '制煞之運');
 assert.deepEqual(blade.windows, confirmed.windows);
 assert.ok(!/[{}\[\]]/u.test(describeFortuneFact({method:'bazi',type:'zpqz_killer_order_context',data:ctx()},String)));
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await provider.interpret(input);
});

test('all 48 reviewed movements retain their sources while SQLite separates other luck types from the hurting-officer comparison', () => {
 const originals = [
  [139, 'noble', ['癸未', '壬午', '辛巳', '庚辰']],
  [140, 'tuotuo', ['乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑'], ['丁未', '己酉', '癸丑']],
  [140, 'he', ['庚子', '辛丑', '壬寅', '癸卯', '甲辰'], ['癸卯']],
  [141, 'zhou', ['丙寅', '戊辰', '己巳']],
  [142, 'yue', ['乙卯', '甲寅', '癸丑', '壬子', '辛亥']],
  [142, 'shen', ['丙申', '戊戌', '己亥']],
  [143, 'zhao', ['乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申']],
  [144, 'wealth-heavy', ['丁未', '丙午', '乙巳', '甲辰']],
  [144, 'seal-heavy', ['辛亥', '壬子', '癸丑', '甲寅', '乙卯'], []],
  [147, 'hurt-officer', ['丙寅', '丁卯', '戊辰', '己巳', '庚午']],
 ];
 for (const [index, id, movements, expected = movements] of originals) {
  const natal = printed(id), sequence = Object.values(natal).join('');
  const rule = fortuneKnowledge.bazi.rules[index];
  const reading = rule.review.printedLuck.find(row => row.natalPillarSequence === sequence);
  assert.ok(reading, id);
  assert.deepEqual(reading.periods.flatMap(period => period.pillars), movements, id);
  const accepted = movements.map(luck => candidate(natal, luck));
  const rejected = [candidate(natal, movements[0], false), candidate(natal, movements[0], true, false)];
  const result = evaluateFortuneRules('bazi', 'year', [...accepted, ...rejected])
   .find(row => row.knowledgeId === rule.knowledgeId);
  assert.deepEqual(result.required[0].hits.map(fact => fact.normalizedPayload.luckPillar), expected, id);
  assert.ok(result.required[0].hits.every(fact => accepted.includes(fact)), id);
  assert.ok(result.exclusions.every(exclusion => !exclusion.hits.length), id);
  assert.equal(result.unresolved.length === 0, index === 140, id);
 }
 assert.equal(originals.reduce((count, row) => count + row[2].length, 0), 48);
});

test('ten real client diagrams distinguish commentary context from matching and preserve source exclusions', async () => {
 const cases = [
  [139, [1995, 9, 21], 2, 2024, '壬午', '运干壬合原局丁食'],
  [140, [1952, 4, 10], 20, 2000, '己酉', '辰酉合与甲己合的不同对象'],
  [140, [1866, 10, 14], 2, 1916, '癸卯', '原例仍可行的运步'],
  [141, [1898, 12, 10], 20, 1920, '丙寅', '附注取木火的反向说法'],
  [142, [2023, 6, 1], 8, 2075, '壬子', '水得地'],
  [142, [1876, 6, 12], 6, 1917, '戊戌', '戊己印的帮身化杀方向'],
  [143, [1928, 2, 8], 12, 1989, '庚申', '原局无食与大运食到分开'],
  [144, [1957, 9, 13], 0, 2003, '甲辰', '官杀生印与通财印的方向'],
  [144, [1982, 10, 2], 10, 2027, '甲寅', '官杀反泄财生印'],
  [147, [1968, 12, 26], 2, 2026, '庚午', '运干庚比和支午见丁官分开'],
 ];
 for (const [index, date, hour, year, pillar, clause] of cases) {
  const run = submitted(date, hour, year);
  const { input, knowledge } = modelContext(run);
  const result = knowledge.byMethod.bazi[index];
  const confirmed = [139, 140, 142, 143, 147].includes(index) || index === 144 && pillar === '甲辰';
  const sourceOutsideRule = index === 144 && pillar === '甲寅';
  assert.equal(result.status, sourceOutsideRule ? 'not_matched' : confirmed ? 'matched' : 'partial', pillar);
  const source = rows(run).find(fact => fact.normalizedPayload.luckPillar === pillar && fact.normalizedPayload.confirmed);
  assert.ok(source, pillar);
  assert.equal(result.sourceFactIds.includes(source.factId), !sourceOutsideRule, pillar);
  const facts = input.facts.filter(fact => fact.type === 'zpqz_killer_order_context' && fact.data.printedLuck?.length);
  const active = facts.find(fact => fact.data.luckPillar === pillar);
  assert.ok(active, pillar);
  const prompt = formatFortuneFactAudit(input);
  assert.ok(prompt.includes(clause), pillar);
  assert.ok(!prompt.includes('natalPillarSequence') && !prompt.includes('printedLuck'), pillar);
  assert.equal(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId), confirmed);
  if (index === 140 && pillar === '癸卯') {
   const [reading] = source.normalizedPayload.killerSealLuck.killerSealHurtCommentary;
   assert.deepEqual([reading.killer.stem, reading.seal.position, reading.seal.stem, reading.hurt.stem, reading.hurt.kind, reading.joinsSeal],
    ['戊', 'hour', '辛', '乙', '运支本气', false]);
   const [finding] = input.sections.flatMap(section => section.findings).filter(row => row.knowledgeId === result.knowledgeId);
   assert.match(finding.note, /若[^。]*印[^。]*化杀/u);
   assert.match(finding.note, /正文[^。]*伤官/u);
   assert.match(finding.note, /徐乐吾|徐注/u);
   let providerChecked = false;
   const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_url, options) => {
    const content = JSON.parse(options.body).messages[1].content;
    assert.ok(content.includes(finding.note));
    assert.ok(content.includes('傷官為美句恐有誤'));
    providerChecked = true;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
   } });
   await provider.interpret(input);
   assert.ok(providerChecked);
  }
  if (index === 147) {
   assert.ok(source.normalizedPayload.hurtOfficerLuck.paths.some(path => path.winterWaterWithFire && path.namedWuOfficer?.stem === '丁'));
   assert.ok(prompt.includes('实际暖局待核') && prompt.includes('运支本气与原官同干'));
  }
  if (pillar === '己酉') {
   assert.equal(source.normalizedPayload.monthKillerCandidate, false);
   assert.equal(source.normalizedPayload.killerPresent, true);
   const previous = rows(run).find(fact => fact.normalizedPayload.luckPillar === '戊申' && fact.activeTo === active.start);
   assert.ok(previous);
   assert.equal(previous.normalizedPayload.printedTuoSealMatched, true);
   assert.equal(previous.normalizedPayload.hasKillerSealHurtCommentary, false);
   assert.ok(!result.sourceFactIds.includes(previous.factId));
   const published = fortuneKnowledge.bazi.rules[index].review.printedLuck
    .find(row => row.natalPillarSequence === '壬辰甲辰丙戌戊戌').periods.find(row => row.pillars.includes('戊申'));
   assert.match(published.assessment, /附注所取申辰拱子/u);
  }
 }
 const converted = modelContext(real('excluded'));
 assert.equal(converted.knowledge.byMethod.bazi[147].status, 'excluded');
 assert.ok(converted.input.facts.every(fact => fact.type !== 'zpqz_killer_order_context' || !fact.data.printedLuck?.length));
});

test('an otherwise similar chart with a different hour cannot use the original Tuotuo clause', () => {
 const run = submitted([1952, 4, 10], 22, 2003);
 assert.ok(rows(run).some(fact => fact.normalizedPayload.luckPillar === '己酉' && fact.normalizedPayload.confirmed
  && fact.normalizedPayload.killerPresent && fact.normalizedPayload.sealsPresent && !fact.normalizedPayload.monthKillerCandidate));
 assert.equal(match(run, 140).status, 'not_matched');
 assert.ok(!formatFortuneFactAudit(modelContext(run).input).includes('辰酉合与甲己合的不同对象'));
});

test('p097 verifies the matching peer without mistaking the incoming seal for another such support', async () => {
 const run = submitted([1980, 1, 5], 0, 1990, 0);
 const boundary = '1990-07-07T00:00:00.000Z';
 const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '丁丑');
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '戊寅');
 assert.ok(before && after);
 assert.equal(before.normalizedPayload.hasRootedFoodPeerSupport, true);
 assert.equal(after.normalizedPayload.hasRootedFoodPeerSupport, false);
 const pre = before.normalizedPayload.killerFoodLuck, post = after.normalizedPayload.killerFoodLuck;
 assert.deepEqual(pre.dayRoots.map(row => [row.position, row.branch, row.exactStem]), [['year', '未', true]]);
 assert.ok(pre.foodBodySupport.some(row => row.stem === '丁' && row.god === '比肩' && row.kind === '运干'));
 assert.ok(post.paths.some(row => row.output.position === 'year' && row.output.kind === '透干'
  && row.output.stem === '己' && row.killer.position === 'month' && row.killer.stem === '癸'
  && row.sealLuck.some(seal => seal.stem === '甲' && seal.kind === '运支本气')));
 const hit = match(run, 139);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '助身');
 assert.equal(hit.windows.at(-1).endExclusive, boundary);
 assert.equal(hit.candidateWindows[0].start, boundary);
 assert.ok(hit.sourceFactIds.includes(before.factId) && !hit.sourceFactIds.includes(after.factId));
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
  const message = JSON.parse(options.body).messages[1].content;
  assert.match(message, /原局日元的同干藏根见于一处，本步又见与日干同干的实际比肩/u);
  assert.match(message, /杀食相当、根轻和实际助力仍待核/u);
  assert.doesNotMatch(message, /hasRootedFoodPeerSupport/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(modelContext(run).input);
});

test('the Noble complete calendar binds each food-killer warning to its own verified luck stage', () => {
 const cases = [
  [2024, '壬午', 'combinesFood', 'ren-combines-food'],
  [2029, '辛巳', 'metalGroup', 'si-supports-killer'],
  [2044, '庚辰', 'metalPair', 'geng-chen-joins'],
 ];
 for (const [year, pillar, evidence, route] of cases) {
  const run = submitted([1995, 9, 21], 2, year);
  const result = match(run, 139);
  const source = rows(run).find(fact => fact.normalizedPayload.luckPillar === pillar && fact.normalizedPayload.confirmed);
  assert.equal(result.status, 'matched', pillar);
  assert.ok(source && result.sourceFactIds.includes(source.factId), pillar);
  assert.equal(source.normalizedPayload.nobleSourceFoodKillerWarning, route);
  const actual = source.normalizedPayload.killerFoodLuck;
  assert.ok(actual.paths.some(path => path.output.position === 'hour' && path.output.stem === '丁'
   && path.killer.position === 'month' && path.killer.stem === '辛'), pillar);
  const warnings = actual.nobleFoodLuck;
  assert.deepEqual(actual.foodBodySupport, []);
  assert.equal(source.normalizedPayload.hasRootedFoodPeerSupport, false);
  assert.ok(actual.dayRoots.some(root => root.position === 'day' && root.exactStem));
  if (evidence === 'combinesFood') {
   assert.equal(warnings.combinesFood[0].target.stem, '丁');
   assert.deepEqual(warnings.foodRootInLuck.map(root => [root.stem, root.kind]), [['丁', '运支藏干']]);
   assert.deepEqual(warnings.metalWaterStemRoots, { stem: '壬', sameElement: [] });
  }
  if (evidence === 'metalGroup') {
   assert.deepEqual(warnings.metalGroup.byBranch, [['decadal'], ['month'], ['hour']]);
   assert.deepEqual(warnings.metalWaterStemRoots.sameElement.map(root => root.stem), ['庚']);
   assert.deepEqual(warnings.killerRootInLuck, []);
   const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '辛巳');
   assert.ok(transition);
   const { input } = modelContext(run);
   const cited = input.facts.filter(row => row.type === 'zpqz_killer_order_context');
   assert.ok(cited.some(row => row.data.luckPillar === '壬午' && row.endExclusive === transition.exactInstant));
   assert.ok(cited.some(row => row.data.luckPillar === '辛巳' && row.start === transition.exactInstant));
   const prompt = formatFortuneFactAudit(input);
   assert.ok(prompt.includes('壬午运支藏干丁（食神）'));
   assert.ok(prompt.includes('辛巳运支藏干庚（正官）同五行异干'));
   const branch = result.confirmedBranches.find(row => row.windows[0].start === transition.exactInstant);
   assert.match(branch.conditions.join(''), /辛巳.*巳酉丑/u);
   const outbound = formatFortunePrompt(input);
   assert.match(outbound, /辛巳.*巳酉丑/u);
   assert.doesNotMatch(outbound, /nobleSourceFoodKillerWarning/u);
  }
  if (evidence === 'metalPair') {
   assert.deepEqual(warnings.metalPair.members, ['month', 'decadal']);
   assert.ok(warnings.combinesWood.some(pair => pair.target.position === 'month' && pair.target.stem === '乙'));
  }
  assert.equal(Boolean(warnings.combinesFood.length), pillar === '壬午');
  assert.equal(Boolean(warnings.metalGroup), pillar === '辛巳');
  assert.equal(Boolean(warnings.metalPair), pillar === '庚辰');
 }
 const near = submitted([1995, 9, 21], 4, 2029);
 assert.ok(rows(near).every(row => row.normalizedPayload.nobleSourceFoodKillerWarning === 'none'));
 assert.doesNotMatch(match(near, 139).matchedSourceExcerpt ?? '', /巳运会酉丑煞强/u);
 assert.equal(ctx(printed('noble'), '辛巳', false).nobleSourceFoodKillerWarning, undefined);
});

test('the Noble southern food root starts in actual Gui-Wei and ends when Ren combines with the natal Ding', () => {
 const date = [1995, 9, 21];
 for (const [year, bound, earlier, later] of [
  [2009, '2009-12-06T18:00:00.000Z', '甲申', '癸未'],
  [2019, '2019-12-06T18:00:00.000Z', '癸未', '壬午'],
 ]) {
  const run = submitted(date, 2, year);
  const before = rows(run).find(row => row.activeTo === bound && row.normalizedPayload.luckPillar === earlier);
  const after = rows(run).find(row => row.activeFrom === bound && row.normalizedPayload.luckPillar === later);
  assert.ok(before && after);
  const wei = later === '癸未' ? after : before, other = wei === after ? before : after;
  const p = wei.normalizedPayload;
  assert.equal(p.hasNobleSourceSouthernFoodRoot, true);
  assert.equal(other.normalizedPayload.hasNobleSourceSouthernFoodRoot, false);
  const { food, killer, root, luckStem, sealControlsFood, hourClash } = p.killerFoodLuck.nobleSouthernFoodRoot;
  assert.deepEqual([food.position, food.stem, killer.position, killer.stem, root.kind, root.stem, luckStem.stem],
   ['hour', '丁', 'month', '辛', '运支藏干', '丁', '癸']);
  assert.equal(sealControlsFood, true);
  assert.deepEqual(hourClash.members, ['hour', 'decadal']);
  assert.deepEqual(p.killerFoodLuck.nobleFoodLuck.metalWaterStemRoots.sameElement, []);
  const scoped = { ...run, facts: [wei] }, hit = match(scoped, 139);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '食神得地');
  assert.deepEqual(hit.windows, [{ start: wei.activeFrom, endExclusive: wei.activeTo }]);
  const { input } = modelContext(scoped);
  const prompt = formatFortunePrompt(input);
  const local = /贵造实运未中丁是原时丁食的同干根，运癸仍克原丁，运未与时丑有六冲/u;
  assert.match(formatFortuneFactAudit(input), local);
  assert.match(prompt, /原文：食神得地/u);
  assert.doesNotMatch(prompt, local);
  assert.doesNotMatch(prompt, /nobleSouthernFoodRoot|hasNobleSourceSouthernFoodRoot/u);
  const next = match({ ...run, facts: [other] }, 139);
  assert.equal(next.status, later === '壬午' ? 'matched' : 'not_matched');
  assert.notEqual(next.matchedSourceExcerpt, '食神得地');
 }
 const nearby = submitted(date, 4, 2014);
 const nearWei = rows(nearby).find(row => row.normalizedPayload.luckPillar === '癸未');
 assert.ok(nearWei);
 assert.equal(nearWei.normalizedPayload.hasNobleSourceSouthernFoodRoot, false);
 assert.equal(ctx(printed('noble'), '癸未', false).hasNobleSourceSouthernFoodRoot, undefined);
});

test('p098 binds the He wealth and seal to the same month killer while keeping both incoming Xin components', () => {
 const run = submitted([2046, 10, 30], 2, 2069);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '辛丑');
 assert.ok(change);
 const previous = rows(run).find(row => row.normalizedPayload.luckPillar === '庚子' && row.activeTo === change.exactInstant);
 const current = rows(run).find(row => row.normalizedPayload.luckPillar === '辛丑' && row.activeFrom === change.exactInstant);
 assert.ok(previous && current);
 const he = current.normalizedPayload.killerSealLuck.heSealContext;
 assert.deepEqual([he.wealth.stem, he.killer.stem, he.killer.kind, he.exposedKiller.stem, he.exposedKiller.kind, he.seal.stem],
  ['丙', '戊', '支藏', '戊', '透干', '辛']);
 assert.deepEqual(he.between.map(row => [row.position, row.pillar]), [['month', '戊戌'], ['day', '壬戌']]);
 assert.deepEqual(previous.normalizedPayload.killerSealLuck.heSealContext.movingSameSeal, []);
 assert.deepEqual(he.movingSameSeal.map(row => [row.stem, row.kind]), [['辛', '运干'], ['辛', '运支藏干']]);
 assert.ok(current.normalizedPayload.killerFoodLuck.paths.some(path => path.output.stem === '甲' && path.killer.stem === '戊'));
 const matches = matchFortuneKnowledge(run).byMethod.bazi;
 assert.equal(matches[139].status, 'not_matched');
 assert.ok([previous, current].every(row => row.normalizedPayload.printedHeSealMatched
  && !row.normalizedPayload.hasKillerSealHurtCommentary));
 assert.equal(matches[140].status, 'not_matched');
 const hePressure = run.facts.find(row => row.factType === 'zpqz_seal_food_context' && row.activeFrom === change.exactInstant
  && row.normalizedPayload.luckPillar === '辛丑');
 assert.ok(hePressure?.normalizedPayload.hasKillerSealPressure);
 assert.equal(hePressure.normalizedPayload.heSourceAuthoritySealCompatible, true);
 const pressure = hePressure.normalizedPayload.heSourceAuthoritySeal;
 assert.deepEqual([pressure.killer.position, pressure.killer.stem, pressure.seal.position, pressure.seal.stem,
  pressure.incomingAuthority.stem, pressure.incomingAuthority.god, pressure.day.stem], ['month', '戊', 'hour', '辛', '己', '正官', '壬']);
 assert.equal(matches[65].status, 'not_matched');
 const laterHe = submitted([2046, 10, 30], 2, 2099);
 const jia = laterHe.facts.find(row => row.factType === 'zpqz_seal_food_context' && row.normalizedPayload.luckPillar === '甲辰');
 assert.ok(jia?.normalizedPayload.hasKillerSealPressure);
 assert.equal(jia.normalizedPayload.heSourceAuthoritySealCompatible, true);
 assert.equal(jia.normalizedPayload.heSourceAuthoritySeal.incomingAuthority.stem, '戊');
 assert.equal(jia.normalizedPayload.heSourceAuthoritySeal.incomingAuthority.god, '七杀');
 assert.equal(match({ ...laterHe, facts: [jia] }, 65).status, 'not_matched');
 for (const { normalizedPayload: data } of [previous, current]) {
  assert.ok(data.killerWealthLuck.wealthRemedies.some(path =>
   path.wealth.position === 'year' && path.wealth.stem === '丙' && path.seal.position === 'hour' && path.seal.stem === '辛'));
  assert.equal(data.killerWealthMatched, false);
 }
 assert.equal(matches[141].status, 'not_matched');
 const near = candidate({ ...printed('he'), hour: '辛亥' }, '辛丑');
 assert.equal(near.normalizedPayload.killerSealLuck.heSealContext, undefined);
 const sameGeometry = evaluateFortuneRules('bazi', 'year', [near]).find(rule => rule.knowledgeId === matches[141].knowledgeId);
 assert.deepEqual(sameGeometry.required[0].hits, [near]);
 const changedHour = submitted([2046, 10, 30], 4, 2070);
 assert.ok(rows(changedHour).some(row => row.normalizedPayload.luckPillar === '辛丑' && row.normalizedPayload.confirmed));
 assert.ok(rows(changedHour).every(row => row.normalizedPayload.printedHeSealMatched === false));
 const changedPressure = changedHour.facts.find(row => row.factType === 'zpqz_seal_food_context' && row.normalizedPayload.luckPillar === '辛丑');
 assert.ok(changedPressure);
 assert.ok(changedPressure.normalizedPayload.hasKillerSealPressure);
 assert.equal(changedPressure.normalizedPayload.heSourceAuthoritySealCompatible, false);
 assert.equal(changedPressure.normalizedPayload.heSourceAuthoritySeal, undefined);
 assert.equal(match({ ...changedHour, facts: [changedPressure] }, 65).status, 'partial');
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.ok(prompt.includes('原财与原印中隔月柱戊戌、日柱壬戌'));
 assert.ok(prompt.includes('辛丑运干辛（正印）、本步大运辛丑运支藏干辛（正印）'));
});

test('p098 separates Tuotuo combining the original killer in Ding-Wei from combining its seal in Ji-You', () => {
 const ding = submitted([1952, 4, 10], 20, 1983), ji = submitted([1952, 4, 10], 20, 2003);
 const dingFact = rows(ding).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '丁未');
 const jiFact = rows(ji).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '己酉');
 const dingPath = dingFact.normalizedPayload.killerSealLuck, jiPath = jiFact.normalizedPayload.killerSealLuck;
 assert.deepEqual(dingPath.tuoSealContext.combinesKiller.map(pair => [pair.moving.stem, pair.target.position, pair.target.stem]),
  [['丁', 'year', '壬']]);
 assert.deepEqual(dingPath.paths[0].combinesSeal, []);
 assert.deepEqual(jiPath.tuoSealContext.combinesKiller, []);
 assert.deepEqual(jiPath.paths[0].combinesSeal.map(pair => [pair.moving.stem, pair.target.position, pair.target.stem]),
  [['己', 'month', '甲']]);
 assert.ok(jiPath.paths[0].hurtLuck.some(row => row.stem === '己'));
 assert.deepEqual([dingPath, jiPath].map(path => path.killerSealHurtCommentary
  .map(row => [row.seal.position, row.seal.stem, row.hurt.stem, row.hurt.kind, row.joinsSeal])),
 [[['month', '甲', '己', '运支本气', false]], [['month', '甲', '己', '运干', true]]]);
 assert.ok(match(ding, 140).sourceFactIds.includes(dingFact.factId));
 assert.ok(match(ji, 140).sourceFactIds.includes(jiFact.factId));
 const prompt = formatFortuneFactAudit(modelContext(ji).input);
 assert.ok(prompt.includes('己（伤官）又与同一承杀原印月柱甲辰透干甲（偏印）有五合位置'));
});

test('p098 identifies the same seal returning control to the arriving hurt officer, and excludes an isolated food stage', () => {
 const run = submitted([1979, 4, 5], 20, 1981);
 const result = match(run, 140);
 const source = rows(run).find(fact => fact.normalizedPayload.luckPillar === '丁卯' && fact.normalizedPayload.hasKillerSealHurtCommentary);
 assert.equal(result.status, 'not_matched');
 assert.ok(source);
 const chain = source.normalizedPayload.killerSealLuck.paths.find(path => path.killer.stem === '戊' && path.killer.position === 'month'
  && path.seal.stem === '庚' && path.seal.position === 'hour');
 assert.ok(chain);
 assert.ok(chain.hurtLuck.some(value => value.stem === '乙' && value.kind === '运支本气'));
 assert.ok(chain.wealthLuck.some(value => value.stem === '丁' && value.kind === '运干'));
 assert.ok(source.normalizedPayload.killerSealLuck.killerSealHurtCommentary.some(row =>
  row.killer.position === chain.killer.position && row.killer.stem === chain.killer.stem
  && row.seal.position === chain.seal.position && row.seal.stem === chain.seal.stem
  && row.hurt.stem === '乙' && row.hurt.kind === '运支本气'));
 const { input } = modelContext(run);
 assert.ok(input.sections.every(section => section.findings.every(finding => finding.knowledgeId !== result.knowledgeId)));
 const prompt = describeFortuneFact({ method: 'bazi', type: source.factType, data: source.normalizedPayload }, String);
 assert.ok(prompt.includes('回克') && prompt.includes('克同一承杀原印'));
 assert.ok(!prompt.includes('killerSealLuck'));

 const isolated = submitted([1979, 8, 17], 0, 2014);
 const foodOnly = rows(isolated).find(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.luckPillar === '戊辰');
 assert.ok(foodOnly?.normalizedPayload.killerSealLuck.paths.length);
 assert.equal(foodOnly.normalizedPayload.luckTenGod, '食神');
 assert.equal(foodOnly.normalizedPayload.luckBranchMainQiGod, '食神');
 assert.equal(match(isolated, 140).status, 'not_matched');
});

test('p099 requires an actual exposed wealth-seal-remedy path and keeps nourishment-only calendars separate', () => {
 const zhou = submitted([1898, 12, 10], 20, 1920);
 const result = match(zhou, 141);
 const source = rows(zhou).find(fact => fact.normalizedPayload.luckPillar === '丙寅' && result.sourceFactIds.includes(fact.factId));
 assert.equal(result.status, 'partial');
 assert.ok(source);
 const { wealthRemedies, wealthNourishes } = source.normalizedPayload.killerWealthLuck;
 const original = wealthRemedies.find(path => path.wealth.position === 'hour' && path.wealth.stem === '庚'
  && path.seal.position === 'month' && path.seal.stem === '甲' && path.output.position === 'year' && path.output.stem === '戊'
  && path.killer.position === 'month' && path.killer.stem === '癸');
 assert.ok(original?.peerLuck.some(value => value.stem === '丙' && value.kind === '运干'));
 assert.ok(wealthNourishes.some(path => path.output.stem === '戊' && path.wealth.stem === '庚' && path.killer.stem === '癸'));

 const nourishmentOnly = submitted([1983, 2, 23], 12, 1991);
 const actual = rows(nourishmentOnly).find(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.luckPillar === '癸丑');
 assert.ok(actual);
 assert.equal(actual.normalizedPayload.sealsPresent, false);
 assert.ok(actual.normalizedPayload.killerWealthLuck.wealthNourishes.length);
 assert.deepEqual(actual.normalizedPayload.killerWealthLuck.wealthRemedies, []);
 assert.equal(match(nourishmentOnly, 141).status, 'not_matched');
});

test('p099 confirms the printed Zhou output stages and keeps the competing seal reading explicit', async () => {
 const run = submitted([1898, 12, 10], 20, 1947);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '己巳');
 assert.ok(change);
 const previous = rows(run).find(row => row.normalizedPayload.luckPillar === '戊辰' && row.activeTo === change.exactInstant);
 const current = rows(run).find(row => row.normalizedPayload.luckPillar === '己巳' && row.activeFrom === change.exactInstant);
 assert.ok(previous && current);
 const exact = fact => fact.normalizedPayload.killerWealthLuck.wealthRemedies.find(path => path.wealth.position === 'hour'
  && path.wealth.stem === '庚' && path.seal.position === 'month' && path.seal.stem === '甲'
  && path.output.position === 'year' && path.output.stem === '戊' && path.killer.stem === '癸');
 const old = exact(previous), currentPath = exact(current);
 assert.deepEqual(old.killerLuck, []);
 assert.deepEqual(old.hiddenKillerLuck.map(row => [row.stem, row.kind]), [['癸', '运支藏干']]);
 assert.deepEqual(currentPath.hiddenKillerLuck, []);
 assert.deepEqual(currentPath.wealthLuck.map(row => [row.stem, row.kind]), [['庚', '运支藏干']]);
 assert.ok(currentPath.outputLuck.some(row => row.stem === '己' && row.kind === '运干'));
 assert.deepEqual(current.normalizedPayload.killerWealthLuck.zhouDayRoots.filter(root => root.exactStem).map(root => root.position),
  ['year', 'day', 'hour']);
 const rule = match(run, 141);
 assert.equal(rule.status, 'matched');
 assert.ok([previous, current].every(row => row.normalizedPayload.hasZhouSourceWealthRemedy && rule.sourceFactIds.includes(row.factId)));
 const weakSeal = match(run, 46);
 assert.equal(weakSeal.status, 'excluded');
 const sealFacts = run.facts.filter(fact => fact.factType === 'zpqz_seal_food_context'
  && [previous, current].some(window => window.activeFrom === fact.activeFrom && window.activeTo === fact.activeTo));
 assert.deepEqual(sealFacts.map(fact => fact.normalizedPayload.luckPillar), ['戊辰', '己巳']);
 assert.ok(sealFacts[1].normalizedPayload.robberyAgainstSealWealth.some(path => path.robbery.stem === '丙'
  && path.natalWealthPaths.some(({ wealth, seal }) => wealth.position === 'hour' && wealth.stem === '庚'
   && seal.position === 'month' && seal.stem === '甲')));
 const weakSealQuery = evaluateFortuneRules('bazi', 'year', sealFacts).find(item => item.knowledgeId === weakSeal.knowledgeId);
 assert.deepEqual(weakSealQuery.exclusions.flatMap(query => query.hits).map(fact => fact.factId), sealFacts.map(fact => fact.factId));
 const later = submitted([1898, 12, 10], 20, 1960);
 const geng = rows(later).find(row => row.normalizedPayload.luckPillar === '庚午' && match(later, 141).sourceFactIds.includes(row.factId));
 assert.ok(geng);
 assert.ok(exact(geng).outputLuck.some(row => row.stem === '己' && row.kind === '运支藏干'));
 assert.equal(geng.normalizedPayload.hasZhouSourceWealthRemedy, false);
 assert.equal(match(later, 141).status, 'partial');
 const differentHour = ctx({ ...printed('zhou'), hour: '己酉' }, '己巳');
 assert.equal(differentHour.hasZhouSourceWealthRemedy, false);
 const { input } = modelContext(run);
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('戊辰运支藏干癸（七杀）受同一透财之生'));
 assert.ok(prompt.includes('己巳运支藏干庚（正财）克同一原印'));
 const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === rule.knowledgeId);
 assert.deepEqual(finding.windows, rule.windows);
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
  const message = JSON.parse(options.body).messages[1].content;
  assert.match(message, /按徐注的周丞相原例核丁火戌未藏根、时庚财制月甲印/u);
  assert.match(message, /林注另取甲印化杀、木火扶身/u);
  assert.doesNotMatch(message, /hasZhouSourceWealthRemedy|一般盘的身强、食杀轻重/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(input);
});

test('p100 separates a verified attack on the clearing helper from an attack on the original food', () => {
 const run = real(142);
 const result = match(run, 142);
 const source = rows(run).find(fact => fact.normalizedPayload.luckPillar === '丙寅' && result.sourceFactIds.includes(fact.factId));
 assert.equal(result.status, 'partial');
 assert.ok(source);
 const path = source.normalizedPayload.killerClearingLuck.paths.find(path => path.target.position === 'hour' && path.target.stem === '甲'
  && path.helper.position === 'year' && path.helper.stem === '己' && path.retained.position === 'month' && path.retained.stem === '乙');
 assert.ok(path?.checksHelper.some(row => row.kind === '运支本气' && row.stem === '甲'));
 assert.ok(path.originalControls.some(row => row.output.position === 'day' && row.output.stem === '辛'
  && row.killer.position === 'month' && row.killer.stem === '乙' && row.attack.some(move => move.stem === '丙' && move.kind === '运干')));
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.ok(prompt.includes('克这处原局取清配对之干') && prompt.includes('克原局制杀之神'));
 assert.ok(!prompt.includes('killerClearingLuck'));

 const coPresence = submitted([1980, 1, 5], 16, 1993);
 assert.ok(rows(coPresence).some(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.officerPresent
  && fact.normalizedPayload.monthKillerCandidate && !fact.normalizedPayload.killerClearingMatched));
 assert.equal(match(coPresence, 142).status, 'not_matched');
});

test('p100 can reach a full non-original chart with exposed hurt controlling the officer, without a natal stem combination', () => {
 const run = submitted([2023, 6, 1], 6, 2035);
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '丙辰');
 assert.ok(fact);
 const context = fact.normalizedPayload.killerClearingLuck;
 assert.equal(context.namedClearing, undefined);
 assert.ok(context.paths.every(path => path.via === 'hurt-controls-officer'));
 const path = context.paths.find(row => row.helper.position === 'year' && row.target.position === 'month');
 assert.deepEqual([path.helper.stem, path.target.stem, path.retained.stem], ['癸', '丁', '丙']);
 assert.ok(path.checksHelper.some(row => row.stem === '戊' && row.kind === '运支本气'));
 assert.ok(match(run, 142).sourceFactIds.includes(fact.factId));
 assert.ok(formatFortuneFactAudit(modelContext(run).input).includes('原局明透伤官年柱癸卯透干癸（伤官）克明透正官月柱丁巳透干丁（正官）'));
});

test('p100 preserves a month-killer clash candidate and follows the luck combination to the same natal Zi', () => {
 const run = submitted([1876, 6, 12], 4, 1944);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '辛丑');
 assert.ok(change);
 const previous = rows(run).find(row => row.normalizedPayload.luckPillar === '庚子' && row.activeTo === change.exactInstant);
 const current = rows(run).find(row => row.normalizedPayload.luckPillar === '辛丑' && row.activeFrom === change.exactInstant);
 assert.ok(previous && current);
 const order = current.normalizedPayload.killerClearingLuck;
 assert.equal(order.namedClearing, undefined);
 assert.deepEqual(order.paths, []);
 const [path] = order.clashClearing;
 assert.deepEqual(path.clash.members, ['year', 'month']);
 assert.deepEqual([path.helper.pillar, path.killer.stem, path.officer.stem, path.officer.position], ['丙子', '丁', '丙', 'year']);
 assert.ok(path.officerMonthRoots.some(root => root.position === 'month' && !root.exactStem));
 assert.deepEqual(previous.normalizedPayload.killerClearingLuck.clashClearing[0].touchesHelper, []);
 assert.ok(path.touchesHelper.some(pair => pair.kind === '六合' && pair.members.includes('year') && pair.members.includes('decadal')));
 assert.ok([previous, current].every(row => match(run, 142).sourceFactIds.includes(row.factId)));
 const { input } = modelContext(run);
 const cited = input.facts.filter(row => row.type === 'zpqz_killer_order_context');
 assert.ok(cited.some(row => row.data.luckPillar === '庚子' && row.endExclusive === change.exactInstant));
 assert.ok(cited.some(row => row.data.luckPillar === '辛丑' && row.start === change.exactInstant));
 assert.ok(formatFortuneFactAudit(input).includes('原局年柱丙子与月支六冲'));
});

test('p100 keeps Yue earth attacks and other hidden qi in separate full-calendar evidence', () => {
 const date = [2023, 6, 1], earth = submitted(date, 8, 2035), wood = submitted(date, 8, 2052);
 const boundary = '2052-02-29T12:00:00.000Z';
 assert.ok(wood.facts.some(row => row.factType === 'luck_transition' && row.exactInstant === boundary
  && row.normalizedPayload.fromPillar === '乙卯' && row.normalizedPayload.toPillar === '甲寅'));
 for (const [run, luck, edge] of [[earth, '丙辰'], [wood, '乙卯', 'activeTo'], [wood, '甲寅', 'activeFrom']]) {
  const source = rows(run).find(fact => fact.normalizedPayload.luckPillar === luck && (!edge || fact[edge] === boundary));
  assert.ok(source, luck);
  const isolated = { ...run, facts: [source] }, result = match(isolated, 142), woodStage = luck !== '丙辰';
  assert.equal(result.status, woodStage ? 'matched' : 'partial');
  assert.ok(result.sourceFactIds.includes(source.factId));
  assert.equal(source.normalizedPayload.hasYueSourceRegulatorUnharmedInWood, woodStage);
  if (woodStage) {
   assert.equal(result.matchedSourceExcerpt, '無傷制煞之神');
   assert.deepEqual(result.windows, [{ start: source.activeFrom, endExclusive: source.activeTo }]);
  }
  const evidence = source.normalizedPayload.killerClearingLuck.namedClearing;
  assert.equal(evidence.yueRegulator.stem, '癸');
  assert.equal(evidence.yueChecksOfficer, true);
  assert.equal(evidence.killer.stem, '丙');
  assert.equal(evidence.sharedRoot.position, 'month');
  assert.equal(evidence.yueAttack.some(row => row.stem === '戊' && row.kind === '运支本气'), luck === '丙辰');
  assert.equal(evidence.yueConcealedAttack.some(row => row.stem === '戊' && row.kind === '运支藏干'), luck === '甲寅');
  const { input } = modelContext(isolated);
  if (luck === '甲寅') assert.match(formatFortuneFactAudit(input), /对岳例原局癸水有余气的克向/u);
  const provider = formatFortunePrompt(input);
  assert.equal(provider.includes('無傷制煞之神'), woodStage);
  assert.equal(provider.includes('乙卯实际运干和运支本气为乙木'), luck === '乙卯');
  assert.equal(provider.includes('寅中余藏戊另有克向'), luck === '甲寅');
  assert.doesNotMatch(provider, /hasYueSourceRegulatorUnharmedInWood|namedClearing|对岳例原局癸水有余气的克向/u);
 }
 assert.equal(ctx(printed('yue'), '甲寅', false).hasYueSourceRegulatorUnharmedInWood, undefined);
});

test('p100 confirms the original Yue warning when the actual luck stem checks the regulator while its branch supports it', () => {
 const date = [1843, 5, 16];
 const periods = [
  [1916, '庚戌', '己酉', '己', '辛', '1916-08-21T12:00:00.000Z'],
  [1926, '己酉', '戊申', '戊', '庚', '1926-08-21T12:00:00.000Z'],
 ];
 for (const [year, previous, current, earth, metal, cut] of periods) {
  const run = submitted(date, 8, year);
  const before = rows(run).find(row => row.activeTo === cut && row.normalizedPayload.luckPillar === previous);
  const after = rows(run).find(row => row.activeFrom === cut && row.normalizedPayload.luckPillar === current);
  assert.ok(before && after);
  const p = after.normalizedPayload;
  assert.equal(p.natalPillarSequence, '癸卯丁巳庚寅庚辰');
  assert.equal(p.hasYueSourceRegulatorPressureFromLuckStem, true);
  const proof = p.killerClearingLuck.namedClearing;
  assert.deepEqual([proof.yueRegulator.position, proof.yueRegulator.stem, proof.killer.position, proof.killer.stem], ['year', '癸', 'month', '丙']);
  assert.deepEqual(proof.yueAttack.map(row => [row.kind, row.stem]), [['运干', earth]]);
  assert.deepEqual(proof.yueFeedsRegulator.map(row => [row.kind, row.stem]), [['运支本气', metal]]);
  const hit = match(run, 142);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '無傷制煞之神');
  assert.ok(hit.sourceFactIds.includes(after.factId));
  if (previous === '庚戌') {
   assert.equal(before.normalizedPayload.hasYueSourceRegulatorPressureFromLuckStem, false);
   assert.deepEqual(hit.windows, [{start: cut, endExclusive: after.activeTo}]);
   assert.ok(!hit.sourceFactIds.includes(before.factId));
  } else {
   assert.equal(before.normalizedPayload.hasYueSourceRegulatorPressureFromLuckStem, true);
  }
  const prompt = formatFortunePrompt(modelContext(run).input);
  assert.match(prompt, /無傷制煞之神/u);
  assert.doesNotMatch(prompt, /hasYueSourceRegulatorPressureFromLuckStem|namedClearing/u);
 }
 assert.equal(ctx(printed('yue'), '己酉', false).hasYueSourceRegulatorPressureFromLuckStem, undefined);
 assert.equal(ctx({...printed('yue'), hour: '辛巳'}, '己酉').hasYueSourceRegulatorPressureFromLuckStem, false);
});

test('Shen peer support reaches both p097 and p100 across the same actual handoff', () => {
 const shen = submitted([1876, 6, 12], 6, 1904);
 const transition = shen.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丁酉');
 assert.ok(transition);
 const result = match(shen, 142);
 const fact = rows(shen).find(row => row.normalizedPayload.luckPillar === '丙申' && row.activeTo === transition.exactInstant);
 const next = rows(shen).find(row => row.normalizedPayload.luckPillar === '丁酉' && row.activeFrom === transition.exactInstant);
 assert.equal(result.status, 'matched');
 assert.ok(fact && next);
 assert.ok(result.sourceFactIds.includes(fact.factId));
 assert.ok(result.sourceFactIds.includes(next.factId));
 assert.equal(result.windows.at(-1).endExclusive, shen.time.displayWindow.instantRange.endInstantExclusive);
 const evidence = fact.normalizedPayload.killerClearingLuck.namedClearing;
 assert.deepEqual(evidence.shenClash.members, ['year', 'month']);
 assert.equal(evidence.officer.stem, '丙');
 assert.equal(evidence.killer.stem, '丁');
 assert.ok(evidence.shenSupport.some(row => row.kind === '运支本气' && row.stem === '庚'));
 const branch = fact.normalizedPayload.killerClearingLuck.shenSourceBodySupport;
 assert.equal(fact.normalizedPayload.hasShenSourceBodySupport, true);
 assert.deepEqual([branch.basis, branch.component.kind, branch.component.stem, branch.day.stem,
  branch.officer.stem, branch.killer.stem, branch.sharedRoot.branch], ['branch-peer', '运支本气', '庚', '辛', '丙', '丁', '午']);
 const localBranchPhrase = '沈例实运申中本气庚劫财与日元同五行';
 const { input } = modelContext({ ...shen, facts: [fact] });
 assert.ok(formatFortuneFactAudit(input).includes(localBranchPhrase));
 assert.ok(!formatFortunePrompt(input).includes(localBranchPhrase));
 for (const { normalizedPayload: data } of [fact, next]) {
  assert.ok(data.natalFivePairs.some(pair => pair.first.position === 'year' && pair.first.stem === '丙'
   && pair.second.position === 'hour' && pair.second.stem === '辛'));
  assert.deepEqual(data.killerClearingLuck.paths, []);
 }
 assert.equal(next.normalizedPayload.killerClearingMatched, true);
 assert.equal(next.normalizedPayload.hasShenSourceBodySupport, true);
 const youSupport = next.normalizedPayload.killerClearingLuck.shenSourceBodySupport;
 assert.deepEqual([youSupport.basis, youSupport.component.kind, youSupport.component.stem, youSupport.component.god, youSupport.day.stem],
  ['branch-peer', '运支本气', '辛', '比肩', '辛']);
 const foodMatch = match(shen, 139);
 assert.equal(foodMatch.status, 'matched');
 assert.match(foodMatch.matchedSourceExcerpt, /不通根/u);
 for (const stage of [fact, next]) {
  const p = stage.normalizedPayload;
  assert.equal(p.hasShenSourceFoodKillerSupport, true);
  const [path] = p.killerFoodLuck.paths;
  assert.deepEqual([path.output.position, path.output.stem, path.killer.position, path.killer.stem], ['year', '癸', 'month', '丁']);
  assert.equal(p.killerFoodLuck.dayRoots.length, 0);
  assert.ok(foodMatch.sourceFactIds.includes(stage.factId));
 }
 const youInput = modelContext({ ...shen, facts: [next] }).input;
 const localYou = '沈例实运酉中本气辛比肩与日元同干';
 assert.match(formatFortuneFactAudit(youInput), new RegExp(localYou, 'u'));
 const outbound = formatFortunePrompt(youInput);
 assert.match(outbound, /丁酉.*辛比肩/u);
 assert.doesNotMatch(outbound, /shenSourceBodySupport|hasShenSourceFoodKillerSupport|沈例实运酉中本气辛比肩/u);
 const variant = submitted([1876, 6, 12], 8, 1904);
 const ordinaryYou = rows(variant).find(row => row.normalizedPayload.luckPillar === '丁酉');
 assert.ok(ordinaryYou);
 assert.equal(ordinaryYou.normalizedPayload.hasShenSourceBodySupport, false);
 assert.equal(ordinaryYou.normalizedPayload.hasShenSourceFoodKillerSupport, false);
 assert.equal(match(variant, 139).status, 'partial');
 assert.equal(ctx(printed('shen'), '丁酉', false).hasShenSourceFoodKillerSupport, undefined);
});

test('p100 confirms Shen’s printed support stages while keeping the natal Zi-Wu clash separate', () => {
 const date = [1876, 6, 12], hour = 6, run = submitted(date, hour, 1924);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '己亥');
 assert.ok(change);
 const previous = rows(run).find(row => row.normalizedPayload.luckPillar === '戊戌' && row.activeTo === change.exactInstant);
 const current = rows(run).find(row => row.normalizedPayload.luckPillar === '己亥' && row.activeFrom === change.exactInstant);
 assert.ok(previous && current);
 for (const [fact, stem, god] of [[previous, '戊', '正印'], [current, '己', '偏印']]) {
  const { shenSourceBodySupport: support, namedClearing } = fact.normalizedPayload.killerClearingLuck;
  assert.deepEqual([support.basis, support.component.kind, support.component.stem, support.component.god, support.day.stem],
   ['stem-seal', '运干', stem, god, '辛']);
  assert.deepEqual(namedClearing.shenClash.members, ['year', 'month']);
  assert.equal(support.sharedRoot.exactStem, false);
  const isolated = {...run, facts: [fact] }, matched = match(isolated, 142);
  assert.equal(matched.status, 'matched');
  assert.equal(matched.matchedSourceExcerpt, '身輕則喜助身');
  assert.deepEqual(matched.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = modelContext(isolated);
  assert.match(formatFortuneFactAudit(input), new RegExp('沈例按原评身弱取助，实际.*运干' + stem, 'u'));
  const provider = formatFortunePrompt(input);
  assert.match(provider, /沈郎中/u);
  assert.doesNotMatch(provider, /沈例按原评身弱取助，实际|shenSourceBodySupport|namedClearing/u);
 }
 const variant = submitted(date, 8, 1924);
 const altered = rows(variant).find(row => row.normalizedPayload.luckPillar === '己亥');
 assert.ok(altered && altered.normalizedPayload.hasShenSourceBodySupport === false);
 assert.notEqual(match({ ...variant, facts: [altered] }, 142).status, 'matched');
 assert.equal(ctx(printed('shen'), '己亥', false).hasShenSourceBodySupport, undefined);
});

test('p100 separates the original Yue Gui-Chou root and branch earth from the succeeding unopposed water support', () => {
 const date = [2023, 6, 1], run = submitted(date, 8, 2072);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '壬子');
 assert.ok(change);
 const before = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '癸丑');
 const after = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '壬子');
 assert.ok(before && after);
 assert.equal(before.normalizedPayload.hasYueSourceRegulatorSupport, false);
 assert.equal(before.normalizedPayload.hasYueSourceRegulatorUnharmedInWood, false);
 assert.equal(before.normalizedPayload.hasYueSourceGuiChouRegulatorRoot, true);
 assert.equal(after.normalizedPayload.hasYueSourceGuiChouRegulatorRoot, false);
 assert.equal(after.normalizedPayload.hasYueSourceRegulatorSupport, true);
 const old = before.normalizedPayload.killerClearingLuck.namedClearing;
 const water = after.normalizedPayload.killerClearingLuck.namedClearing;
 assert.ok(old.yueAttack.some(row => row.stem === '己' && row.kind === '运支本气'));
 assert.deepEqual([water.yueRegulator.position, water.yueRegulator.stem, water.killer.position, water.killer.stem],
  ['year', '癸', 'month', '丙']);
 assert.deepEqual(water.yueWater.map(row => [row.kind, row.stem]), [['运干', '壬'], ['运支本气', '癸']]);
 assert.deepEqual(water.yueAttack, []);
 const guiChou = before.normalizedPayload.killerClearingLuck.yueGuiChouRegulatorRoot;
 assert.deepEqual([guiChou.regulator.position, guiChou.regulator.stem, guiChou.killer.stem,
  guiChou.movingWater.stem, guiChou.waterRoot.stem, guiChou.waterRoot.kind, guiChou.movingEarth.stem],
 ['year', '癸', '丙', '癸', '癸', '运支藏干', '己']);
 const earlier = match({ ...run, facts: [before] }, 142), laterWater = match({ ...run, facts: [after] }, 142);
 assert.equal(earlier.status, 'matched');
 assert.equal(earlier.matchedSourceExcerpt, '用神得地');
 const earlierInput = modelContext({ ...run, facts: [before] }).input;
 const earlierPrompt = formatFortunePrompt(earlierInput);
 const local = /岳例实运癸制月丙，丑余癸为运癸同干根，丑首己仍克原年癸/u;
 assert.match(formatFortuneFactAudit(earlierInput), local);
 assert.match(earlierPrompt, /原文：用神得地/u);
 assert.doesNotMatch(earlierPrompt, local);
 assert.doesNotMatch(earlierPrompt, /yueGuiChouRegulatorRoot|hasYueSourceGuiChouRegulatorRoot/u);
 assert.equal(laterWater.status, 'matched');
 assert.equal(laterWater.matchedSourceExcerpt, '無傷制煞之神');
 const hit = match(run, 142);
 assert.equal(hit.status, 'matched');
 assert.match(hit.matchedSourceExcerpt, /用神得地/u);
 assert.match(hit.matchedSourceExcerpt, /無傷制煞之神/u);
 assert.equal(hit.confirmedBranches.length, 2);
 assert.ok(hit.confirmedBranches.some(branch => branch.windows.at(-1).endExclusive === change.exactInstant));
 assert.ok(hit.confirmedBranches.some(branch => branch.windows[0].start === change.exactInstant));
 assert.ok(hit.sourceFactIds.includes(after.factId) && hit.sourceFactIds.includes(before.factId));
 const { input } = modelContext(run);
 assert.match(formatFortunePrompt(input), /岳统制原图据徐注按丙丁同根、官作杀论/u);
 const later = submitted(date, 8, 2087), xinHai = rows(later).find(row => row.normalizedPayload.luckPillar === '辛亥');
 assert.ok(xinHai?.normalizedPayload.hasYueSourceRegulatorSupport);
 assert.deepEqual(xinHai.normalizedPayload.killerClearingLuck.namedClearing.yueWater.map(row => [row.kind, row.stem]),
  [['运支本气', '壬']]);
 assert.equal(match(later, 142).status, 'matched');
 const altered = submitted(date, 10, 2077);
 assert.ok(rows(altered).some(row => row.normalizedPayload.luckPillar === '壬子'));
 assert.notEqual(match(altered, 142).status, 'matched');
});

test('p101 binds the same month killer to actual moving output and its native seal countercheck at the transition', async () => {
 const run = submitted([1981, 1, 4], 0, 1991);
 const boundary = '1991-08-04T16:00:00.000Z';
 const result = match(run, 143);
 const previous = rows(run).find(row => row.normalizedPayload.luckPillar === '己丑' && row.activeTo === boundary);
 const fact = rows(run).find(row => row.normalizedPayload.luckPillar === '庚寅' && row.activeFrom === boundary);
 assert.ok(previous && fact);
 assert.equal(result.status, 'matched');
 assert.equal(result.matchedSourceExcerpt, '制煞之運');
 assert.equal(result.windows[0].start, boundary);
 assert.ok(result.sourceFactIds.includes(fact.factId) && !result.sourceFactIds.includes(previous.factId));
 assert.equal(previous.normalizedPayload.hasMonthBladeKillerSealCountercheck, false);
 assert.equal(fact.normalizedPayload.hasMonthBladeKillerSealCountercheck, true);
 assert.equal(fact.normalizedPayload.monthKillerCandidate, false);
 const evidence = fact.normalizedPayload.killerBladeLuck;
 assert.deepEqual(evidence.bladePosition, { position: 'month', pillar: '戊子' });
 assert.deepEqual(evidence.bladePeers.map(row => [row.position, row.stem, row.kind]), [['month', '癸', '支藏']]);
 assert.ok(evidence.paths.some(path => path.killer.position === 'month' && path.killer.kind === '透干' && path.killer.stem === '戊'
  && path.check.some(row => row.kind === '运支本气' && row.stem === '甲')));
 assert.deepEqual(evidence.monthBladeKillerSealCounterchecks.map(({ blade, killer, output, seals }) => ({
  blade: [blade.position, blade.stem], killer: [killer.position, killer.stem],
  output: [output.kind, output.stem], seals: seals.map(seal => [seal.position, seal.stem]),
 })), [{ blade: ['month', '癸'], killer: ['month', '戊'], output: ['运支本气', '甲'], seals: [['year', '庚'], ['hour', '庚']] }]);

 const restrained = submitted([1979, 12, 11], 16, 1983);
 assert.ok(rows(restrained).some(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.monthYangBlade
  && fact.normalizedPayload.foodAbsent && !fact.normalizedPayload.hurtAbsent && fact.normalizedPayload.killerPresent));
 assert.equal(match(restrained, 143).status, 'not_matched');
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
  const content = JSON.parse(options.body).messages[1].content;
  assert.match(content, /同一七杀所生的原透印既生日元，也克这处运食伤/u);
  assert.match(content, /原文以刃轻煞重为前提/u);
  assert.doesNotMatch(content, /monthBladeKillerSealCounterchecks/iu);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(modelContext(run).input);
});

test('p101 keeps the Zhao hour example separate and distinguishes native absence from arriving Xin', () => {
 const zhao = submitted([1928, 2, 8], 12, 1998);
 const result = match(zhao, 143);
 const source = rows(zhao).find(fact => fact.normalizedPayload.luckPillar === '辛酉' && fact.normalizedPayload.confirmed);
 assert.equal(result.status, 'matched');
 assert.ok(source && result.sourceFactIds.includes(source.factId));
 assert.equal(source.normalizedPayload.zhaoSourceBladeAuthorityRoute, 'moving-metal-checks-killer');
 assert.equal(source.normalizedPayload.foodAbsent, true);
 assert.equal(source.normalizedPayload.monthYangBlade, false);
 const evidence = source.normalizedPayload.killerBladeLuck;
 assert.deepEqual(evidence.bladePosition, { position: 'hour', pillar: '戊午' });
 assert.deepEqual(evidence.monthBladeKillerSealCounterchecks, []);
 assert.ok(evidence.zhaoMetalControlsKiller && evidence.paths.some(path => path.killer.stem === '甲'
  && path.check.some(row => row.kind === '运干' && row.stem === '辛') && path.nativeSeals.length
  && path.branchMetalChecks.some(row => row.kind === '运支藏干' && row.stem === '辛')));
 assert.ok(formatFortuneFactAudit(modelContext(zhao).input).includes('前章有用印读法'));
 const changedHour = submitted([1928, 2, 8], 14, 1998);
 assert.ok(rows(changedHour).some(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.foodAbsent
  && fact.normalizedPayload.monthKillerCandidate && !fact.normalizedPayload.monthYangBlade));
 assert.equal(match(changedHour, 143).status, 'not_matched');
 assert.ok(rows(changedHour).every(fact => fact.normalizedPayload.zhaoSourceBladeAuthorityRoute === 'none'));
});

test('p101 follows the actual Zhao hour-blade companion and preserves the moving Wu blade at the verified boundary', () => {
 const run = submitted([1928, 2, 8], 12, 1966);
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊午');
 assert.ok(transition);
 const previous = rows(run).find(row => row.normalizedPayload.luckPillar === '丁巳' && row.activeTo === transition.exactInstant);
 const current = rows(run).find(row => row.normalizedPayload.luckPillar === '戊午' && row.activeFrom === transition.exactInstant);
 assert.ok(previous && current);
 assert.equal(current.normalizedPayload.monthYangBlade, false);
 const blade = current.normalizedPayload.killerBladeLuck;
 assert.deepEqual(blade.bladePeers.map(row => [row.position, row.stem]), [['hour', '己']]);
 assert.deepEqual(previous.normalizedPayload.killerBladeLuck.movingBladePeers, []);
 assert.deepEqual(blade.movingBladePeers.map(row => [row.kind, row.stem]), [['运支藏干', '己']]);
 assert.equal(match(run, 143).status, 'matched');
 assert.ok([previous, current].every(fact => fact.normalizedPayload.zhaoSourceBladeAuthorityRoute === 'supporting-seal-peer'));
 assert.ok([previous, current].every(fact => match(run, 143).sourceFactIds.includes(fact.factId)));
 const early = submitted([1928, 2, 8], 12, 1940);
 const yi = rows(early).find(row => row.normalizedPayload.luckPillar === '乙卯' && row.normalizedPayload.confirmed);
 assert.deepEqual(yi?.normalizedPayload.killerBladeLuck.authorityChecksBlade.map(value => [value.moving.kind, value.moving.stem, value.peer.stem]),
  [['运干', '乙', '己'], ['运支本气', '乙', '己']]);
 assert.equal(yi.normalizedPayload.zhaoSourceBladeAuthorityRoute, 'yi-mao-officer-pressure');
 assert.ok(match(early, 143).sourceFactIds.includes(yi.factId));
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.ok(prompt.includes('原局刃位的藏劫实见时柱戊午支藏己（劫财）'));
 assert.ok(prompt.includes('当运同刃支另藏同一劫财干本步大运戊午运支藏干己（劫财）'));
});

test('p102 binds the same finance and seal in both named cases but preserves the opposite source readings', () => {
 const cases = [
  [[1957, 9, 13], 0, 2003, '甲辰', 'wealth-heavy', 'hour', 'year', '官杀生印与通财印的方向'],
  [[1982, 10, 2], 10, 2027, '甲寅', 'seal-heavy', 'year', 'hour', '官杀反泄财生印'],
 ];
 for (const [date, hour, year, luck, name, wealthPosition, sealPosition, assessment] of cases) {
  const run = submitted(date, hour, year);
  const { input, knowledge } = modelContext(run);
  const result = knowledge.byMethod.bazi[144];
  const fact = rows(run).find(f => f.normalizedPayload.luckPillar === luck && f.normalizedPayload.confirmed);
  assert.equal(result.status, name === 'wealth-heavy' ? 'matched' : 'not_matched', luck);
  assert.ok(fact, luck);
  assert.equal(result.sourceFactIds.includes(fact.factId), name === 'wealth-heavy');
  const matched = fact.normalizedPayload.hurtDualLuck;
  assert.equal(matched.dualCase, name);
  assert.equal(fact.normalizedPayload.hasHurtDualSourceAuthority, true);
  const source = matched.sourceAuthority;
  assert.equal(source.reading, name === 'wealth-heavy' ? 'supports-seal' : 'diverts-wealth');
  assert.deepEqual([source.wealth.position, source.wealth.stem, source.seal.position, source.seal.stem],
   [wealthPosition, '壬', sealPosition, '丁']);
  assert.ok(source.authority.some(row => row.kind === '运干' && row.stem === '甲'));
  assert.deepEqual(source.between.map(row => row.position), ['month', 'day']);
  const path = matched.paths.find(p => p.wealth.position === wealthPosition && p.wealth.kind === '透干' && p.wealth.stem === '壬'
   && p.seal.position === sealPosition && p.seal.kind === '透干' && p.seal.stem === '丁');
  assert.ok(path);
  assert.equal(path.output.stem, '辛');
  assert.equal(path.nativeCombination.distance, 3);
  assert.equal(path.columnDistance, 3);
  assert.deepEqual(path.between.map(row => row.position), ['month', 'day']);
  assert.ok(path.authorityLuck.some(row => row.kind === '运干' && row.stem === '甲'));
  if (luck === '甲辰') {
   assert.ok(path.authorityLuck.some(row => row.kind === '运支藏干' && row.stem === '乙'));
   assert.ok(path.wealthLuck.some(row => row.kind === '运支藏干' && row.stem === '癸'));
  }
  const prompt = formatFortuneFactAudit(input);
  assert.ok(prompt.includes(assessment) && prompt.includes('该运官杀再生同一原印'));
  const sourceLabel = name === 'wealth-heavy' ? '都统制原评取官杀生印' : '丞相原评取运官杀泄财生印';
  assert.ok(prompt.includes(sourceLabel));
  assert.ok(!formatFortunePrompt(input).includes(sourceLabel));
  assert.ok(!prompt.includes('hurtDualLuck'));
 }
});

test('p102 confirms only the original seal support and keeps the separate wealth-labelled chart local', async () => {
 const examples = [
  { date: [1957, 9, 13], hour: 0, year: 1979, from: '丁未', to: '丙午', field: 'sealLuck', stem: '丁',
   rendered: '丁未运支藏干丁（正印）生日元' },
  { date: [1982, 10, 2], hour: 10, year: 2024, from: '癸丑', to: '甲寅', field: 'wealthLuck', stem: '癸',
   rendered: '癸丑运支藏干癸（正财），该运财克' },
 ];
 for (const item of examples) {
  const run = submitted(item.date, item.hour, item.year);
  const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === item.to);
  assert.ok(change);
  const previous = rows(run).find(row => row.normalizedPayload.luckPillar === item.from && row.activeTo === change.exactInstant);
  const current = rows(run).find(row => row.normalizedPayload.luckPillar === item.to && row.activeFrom === change.exactInstant);
  assert.ok(previous && current);
  const named = previous.normalizedPayload.hurtDualLuck;
  const path = named.paths.find(value => value.wealth.stem === '壬' && value.wealth.kind === '透干'
   && value.seal.stem === '丁' && value.seal.kind === '透干');
  assert.deepEqual(path[item.field].filter(row => row.stem === item.stem).map(row => row.kind), ['运干', '运支藏干']);
  assert.equal(previous.normalizedPayload.hasHurtDualSourceAuthority, false);
  assert.equal(current.normalizedPayload.hasHurtDualSourceAuthority, item.to === '甲寅');
  if (item.stem === '丁') {
   assert.ok(named.dualRoots.sealRoots.every(root => root.position === 'decadal'));
   assert.ok(named.dualRoots.sealRoots.some(root => root.position === 'decadal' && root.exactStem));
  } else {
   assert.ok(named.dualRoots.wealthRoots.every(root => root.position === 'decadal'));
   assert.ok(named.dualRoots.wealthRoots.some(root => root.position === 'decadal' && !root.exactStem));
  }
  const recognized = match(run, 144);
  const originalSeal = item.stem === '丁';
  assert.equal(recognized.status, originalSeal ? 'matched' : 'not_matched');
  assert.equal(previous.normalizedPayload.hasHurtDualSourceRelief, true);
  assert.equal(current.normalizedPayload.hasHurtDualSourceRelief, item.stem === '丁');
  assert.equal(recognized.sourceFactIds.includes(previous.factId), originalSeal);
  assert.equal(recognized.sourceFactIds.includes(current.factId), originalSeal);
  const { input } = modelContext(run);
  const cited = input.facts.filter(row => row.type === 'zpqz_killer_order_context');
  assert.ok(cited.some(row => row.data.luckPillar === item.from && row.endExclusive === change.exactInstant));
  assert.ok(cited.some(row => row.data.luckPillar === item.to && row.start === change.exactInstant));
  assert.ok(formatFortuneFactAudit(input).includes(item.rendered));
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === recognized.knowledgeId);
  if (originalSeal) {
   assert.deepEqual(finding.windows, recognized.windows);
   assert.equal(recognized.matchedSourceExcerpt, '財多而帶印者，運喜助印');
  } else assert.equal(finding, undefined);
  const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
   const message = JSON.parse(options.body).messages[1].content;
   assert.equal(/徐注按都统制原例财多身弱/u.test(message), originalSeal);
   assert.equal(/財多而帶印者，運喜助印/u.test(message), originalSeal);
   assert.doesNotMatch(message, /印多盘见明列财运/u);
   assert.doesNotMatch(message, /hasHurtDualSourceRelief|一般盘的财印轻重、阻隔实际作用/u);
   return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(input);
 }
});

test('p102 retains support with a competing wealth contact and rejects wealth pressure alone after Xin-Chou', () => {
 const run = submitted([1957, 9, 13], 0, 2029);
 const boundary = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '辛丑')?.exactInstant;
 assert.equal(boundary, '2029-04-10T16:00:00.000Z');
 const before = rows(run).find(row => row.normalizedPayload.luckPillar === '壬寅' && row.activeTo === boundary);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '辛丑' && row.activeFrom === boundary);
 assert.ok(before && after);
 const path = fact => fact.normalizedPayload.hurtDualLuck.paths.find(row => row.wealth.kind === '透干'
  && row.wealth.position === 'hour' && row.wealth.stem === '壬' && row.seal.kind === '透干'
  && row.seal.position === 'year' && row.seal.stem === '丁');
 assert.deepEqual(path(before).authorityLuck.map(row => row.stem), ['甲']);
 assert.deepEqual(path(before).wealthLuck.map(row => row.stem), ['壬']);
 assert.deepEqual(path(after).authorityLuck, []);
 assert.deepEqual(path(after).sealLuck, []);
 assert.deepEqual(path(after).wealthLuck.map(row => [row.stem, row.kind]), [['癸', '运支藏干']]);
 const result = match(run, 144);
 assert.equal(result.status, 'partial');
 assert.ok(result.sourceFactIds.includes(before.factId));
 assert.ok(!result.sourceFactIds.includes(after.factId));
 assert.equal(match({ ...run, facts: [after] }, 144).status, 'not_matched');
 assert.doesNotMatch(formatFortunePrompt(modelContext(run).input), /財多而帶印者，運喜助印/u);
});

test('p102 keeps both named bridging years inside the source reading and excludes a changed hour', () => {
 const date = [1957, 9, 13], run = submitted(date, 0, 1989);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '乙巳');
 assert.ok(change);
 const before = rows(run).find(row => row.normalizedPayload.luckPillar === '丙午' && row.activeTo === change.exactInstant);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '乙巳' && row.activeFrom === change.exactInstant);
 assert.ok(before && after);
 assert.equal(before.normalizedPayload.hasHurtDualSourceAuthority, false);
 assert.equal(after.normalizedPayload.hasHurtDualSourceAuthority, true);
 assert.deepEqual(after.normalizedPayload.hurtDualLuck.sourceAuthority.authority.map(row => [row.kind, row.stem]), [['运干', '乙']]);
 const result = match(run, 144);
 assert.equal(result.status, 'matched');
 assert.ok(result.sourceFactIds.includes(before.factId));
 assert.ok(result.sourceFactIds.includes(after.factId));
 const authorityOnly = { ...run, facts: [after] };
 const authorityHit = match(authorityOnly, 144);
 assert.equal(authorityHit.status, 'matched');
 assert.deepEqual(authorityHit.windows, [{ start: change.exactInstant, endExclusive: after.activeTo }]);
 const provider = formatFortunePrompt(modelContext(authorityOnly).input);
 assert.match(provider, /都统制/u);
 assert.doesNotMatch(provider, /sourceAuthority|官杀反泄财生印/u);
 const variant = submitted(date, 2, 1990);
 assert.ok(rows(variant).some(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '乙巳'));
 assert.ok(rows(variant).every(row => !row.normalizedPayload.hasHurtDualSourceAuthority));
});

test('p102 accepts the one-exposed and one-concealed route but rejects when both finance and seal are concealed', () => {
 const visibleWealth = submitted([1979, 1, 11], 0, 1989);
 const result = match(visibleWealth, 144);
 const fact = rows(visibleWealth).find(f => f.normalizedPayload.luckPillar === '丙寅' && result.sourceFactIds.includes(f.factId));
 assert.equal(result.status, 'partial');
 const path = fact?.normalizedPayload.hurtDualLuck.paths.find(p => p.wealth.stem === '壬' && p.wealth.kind === '透干'
  && p.seal.kind === '支藏' && p.sealLuck.some(row => row.stem === '丙' && row.kind === '运干'));
 assert.ok(path);
 assert.equal(path.columnDistance, Math.abs(path.wealth.index - path.seal.index));
 assert.equal(path.between.length, Math.max(0, path.columnDistance - 1));
 assert.equal(path.nativeCombination, undefined);
 const legacy = structuredClone(fact.normalizedPayload);
 for (const recorded of legacy.hurtDualLuck.paths) {
  delete recorded.columnDistance;
  delete recorded.between;
 }
 const legacyText = describeFortuneFact({ method: 'bazi', type: 'zpqz_killer_order_context', data: legacy }, String);
 assert.ok(legacyText.includes('兼财印见'));
 assert.doesNotMatch(legacyText, /原财与原印中隔。/u);

 const concealed = submitted([1979, 1, 11], 4, 1989);
 assert.ok(rows(concealed).some(f => f.normalizedPayload.confirmed && f.normalizedPayload.luckPillar === '丙寅'
  && f.normalizedPayload.wealthPresent && f.normalizedPayload.sealsPresent
  && !f.normalizedPayload.wealthExposed && !f.normalizedPayload.sealsExposed));
 assert.equal(match(concealed, 144).status, 'not_matched');
});

test('p105 binds attacking, conveying, and shielding to the same exposed officer and rejects a merely hidden officer', () => {
 const run = real(147), result = match(run, 147);
 const fact = rows(run).find(f => f.normalizedPayload.luckPillar === '庚午' && result.sourceFactIds.includes(f.factId));
 assert.equal(result.status, 'partial');
 assert.ok(fact);
 const path = fact.normalizedPayload.hurtOfficerLuck.paths.find(p => p.officer.stem === '乙' && p.officer.position === 'month');
 assert.equal(path.output.stem, '辛');
 assert.equal(path.output.kind, '支藏');
 assert.ok(path.moneyLinks.some(link => link.wealth.stem === '壬' && link.wealth.position === 'hour'));
 assert.ok(path.sealLuck.some(row => row.kind === '运支本气' && row.stem === '丁'));
 const attack = path.outputLuck.find(link => link.moving.kind === '运干' && link.moving.stem === '庚');
 assert.ok(attack?.moneyLinks.some(link => link.wealth.stem === '壬' && link.wealth.position === 'hour'));
 assert.ok(attack.protectingSeals.some(row => row.stem === '丙' && row.position === 'day'));
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.ok(prompt.includes('克同一明透原官') && prompt.includes('原财承接或原印回克'));

 const hidden = submitted([1979, 1, 23], 0, 1985);
 assert.ok(rows(hidden).some(f => f.normalizedPayload.confirmed && f.normalizedPayload.monthHurtCandidate
  && f.normalizedPayload.officerPresent && !f.normalizedPayload.officerExposed));
 assert.equal(match(hidden, 147).status, 'not_matched');

 const bothExposed = submitted([1979, 2, 17], 8, 1985);
 assert.ok(rows(bothExposed).some(f => f.normalizedPayload.confirmed && f.normalizedPayload.monthHurtCandidate
  && f.normalizedPayload.officerExposed && f.normalizedPayload.hurtExposed));
 assert.equal(match(bothExposed, 147).status, 'not_matched');
});

test('p105 confirms the visible Ding officer, native Wu root and incoming hidden seal across a verified boundary', async () => {
 const run = submitted([1968, 12, 26], 2, 2012);
 const transition = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '己巳');
 assert.ok(transition);
 const selection = match(run, 147);
 assert.equal(selection.status, 'matched');
 const active = rows(run).filter(fact => selection.sourceFactIds.includes(fact.factId));
 const before = active.find(fact => fact.activeTo === transition.exactInstant && fact.normalizedPayload.luckPillar === '戊辰');
 const after = active.find(fact => fact.activeFrom === transition.exactInstant && fact.normalizedPayload.luckPillar === '己巳');
 assert.ok(before && after);
 const pathAt = fact => fact.normalizedPayload.hurtOfficerLuck.paths.find(path => path.officer.position === 'hour'
  && path.officer.stem === '丁' && path.output.position === 'month' && path.output.stem === '癸');
 const path = pathAt(after);
 for (const stage of [before, after]) {
  const source = stage.normalizedPayload.hurtOfficerLuck.sourceTakingOfficer;
  assert.equal(stage.normalizedPayload.hasHurtOfficerSourceTakingOfficer, true);
  assert.equal(source.route, 'seal-protects-officer');
  assert.deepEqual([source.output.position, source.output.stem, source.wealth.position, source.wealth.stem], ['month', '癸', 'month', '甲']);
  assert.deepEqual([source.officer.position, source.officer.stem, source.seal.position, source.seal.stem], ['hour', '丁', 'year', '戊']);
  assert.equal(source.officerRoot.pillar, '庚午');
 }
 assert.deepEqual(path.officerRoots.filter(root => root.exactStem).map(root => [root.position, root.pillar]), [['day', '庚午']]);
 assert.ok(path.natalRootClashes.some(pair => pair.members.includes('month') && pair.members.includes('day')));
 assert.ok(path.visibleSupports.some(pair => pair.wealth.position === 'month' && pair.wealth.stem === '甲'
  && pair.seal.position === 'year' && pair.seal.stem === '戊'));
 assert.ok(path.sealLuck.some(row => row.kind === '运干' && row.stem === '己'));
 assert.ok(path.sealLuck.some(row => row.kind === '运支藏干' && row.stem === '戊'));
 assert.ok(!pathAt(before).sealLuck.some(row => row.kind === '运干' && row.stem === '己'));
 const { input } = modelContext(run);
 assert.ok(input.facts.some(fact => fact.type === 'zpqz_killer_order_context' && fact.data.luckPillar === '戊辰' && fact.endExclusive === transition.exactInstant));
 assert.ok(input.facts.some(fact => fact.type === 'zpqz_killer_order_context' && fact.data.luckPillar === '己巳' && fact.start === transition.exactInstant));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /本命同干根为日柱庚午/u);
 assert.match(prompt, /己巳运支藏干戊/u);
 assert.match(prompt, /伤官用官原例中.*本步核运印护该官/u);
 assert.doesNotMatch(formatFortunePrompt(input), /伤官用官原例中/u);
 const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === selection.knowledgeId);
 assert.deepEqual(finding.windows, selection.windows);
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
  const message = JSON.parse(options.body).messages[1].content;
  assert.match(message, /本步戊己印制同一月子藏癸伤/u);
  assert.doesNotMatch(message, /运支本气木财生同一时丁官|运支午藏丁为同一官的来运根/u);
  assert.doesNotMatch(message, /hasHurtOfficerSourceTakingOfficer|源例中.*本步核运印护该官/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(input);
});

test('p105 binds the five original officer stages to actual component routes and the exact entry and exit', () => {
 const date = [1968, 12, 26], hour = 2;
 const checks = [
  [1982, '乙丑', '丙寅', undefined, 'wealth-feeds-officer', '甲', '运支本气'],
  [1992, '丙寅', '丁卯', 'wealth-feeds-officer', 'wealth-feeds-officer', '乙', '运支本气'],
  [2002, '丁卯', '戊辰', 'wealth-feeds-officer', 'seal-protects-officer', '戊', '运干'],
  [2022, '己巳', '庚午', 'seal-protects-officer', 'officer-root-in-luck', '丁', '运支本气'],
  [2032, '庚午', '辛未', 'officer-root-in-luck', undefined],
 ];
 const branchPhrases = {
  'wealth-feeds-officer': /运支本气木财生同一时丁官/u,
  'seal-protects-officer': /本步戊己印制同一月子藏癸伤/u,
  'officer-root-in-luck': /运支午藏丁为同一官的来运根/u,
 };
 for (const [year, previous, incoming, beforeRoute, afterRoute, stem, kind] of checks) {
  const run = submitted(date, hour, year);
  const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === incoming);
  assert.ok(change, incoming);
  const before = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === previous);
  const after = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === incoming);
  assert.ok(before && after, incoming);
  const result = match(run, 147);
  assert.equal(result.status, 'matched', incoming);
  assert.equal(result.matchedSourceExcerpt, '傷官用官，大都為調候而取用');
  for (const [fact, expected] of [[before, beforeRoute], [after, afterRoute]]) {
   const data = fact.normalizedPayload;
   assert.equal(data.hasHurtOfficerSourceTakingOfficer, Boolean(expected), incoming);
   assert.equal(data.hurtOfficerLuck.sourceTakingOfficer?.route, expected, incoming);
   assert.equal(result.sourceFactIds.includes(fact.factId), Boolean(expected), incoming);
  }
  if (afterRoute) assert.ok(after.normalizedPayload.hurtOfficerLuck.sourceTakingOfficer.moving
   .some(row => row.stem === stem && row.kind === kind), incoming);
  if (beforeRoute && afterRoute && beforeRoute !== afterRoute) {
   assert.equal(result.confirmedBranches.length, 2);
   const [from, to] = result.confirmedBranches;
   assert.match(from.conditions.join(''), branchPhrases[beforeRoute]);
   assert.match(to.conditions.join(''), branchPhrases[afterRoute]);
   assert.equal(from.windows.at(-1).endExclusive, change.exactInstant);
   assert.equal(to.windows[0].start, change.exactInstant);
  }
 }
 const differentHour = submitted(date, 4, 2013);
 assert.ok(rows(differentHour).some(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '己巳'));
 assert.ok(rows(differentHour).every(row => !row.normalizedPayload.hasHurtOfficerSourceTakingOfficer));
 assert.notEqual(match(differentHour, 147).status, 'matched');
});

test('p105 binds Zheng’s hidden wealth and southern fire to the actual stage transitions', () => {
 const date = [1896, 11, 14], hour = 22;
 const transitions = [[1924, '辛丑', '壬寅', [], ['branch-wealth']],
  [1954, '甲辰', '乙巳', ['stem-wealth'], ['stem-wealth', 'southern-fire']],
  [1984, '丁未', '戊申', ['southern-fire'], []]];
 const phrases = { 'branch-wealth': /运支本气木财/u, 'stem-wealth': /实际运干甲乙木财/u,
  'southern-fire': /实际南方运支/u };
 for (const [year, from, to, beforeRoutes, afterRoutes] of transitions) {
  const run = submitted(date, hour, year);
  const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === to);
  assert.ok(change, to);
  const period = (pillar, field) => rows(run).find(row => row[field] === change.exactInstant && row.normalizedPayload.luckPillar === pillar);
  const before = period(from, 'activeTo'), after = period(to, 'activeFrom');
  assert.ok(before && after, to);
  const reading = fact => fact.normalizedPayload.hurtOfficerLuck.zhengLuck;
  const result = match(run, 147);
  assert.equal(result.status, 'matched');
  for (const [fact, expected] of [[before, beforeRoutes], [after, afterRoutes]]) {
   assert.deepEqual(fact.normalizedPayload.zhengHurtOfficerReviewedRoutes, expected);
   assert.equal(result.sourceFactIds.includes(fact.factId), expected.length > 0);
   const evidence = reading(fact);
   assert.deepEqual([evidence.officer.position, evidence.officer.stem], ['year', '丙']);
   assert.deepEqual(evidence.nativeWealth.map(row => [row.position, row.branch, row.stem]),
    [['day', '未', '乙'], ['month', '亥', '甲'], ['hour', '亥', '甲']]);
   assert.deepEqual(evidence.nativeSeals.map(row => [row.position, row.kind, row.stem]),
    [['month', '透干', '己'], ['hour', '透干', '己'], ['day', '支藏', '己']]);
   const isolated = { ...run, facts: [fact] }, matched = match(isolated, 147);
   assert.equal(matched.status === 'matched', expected.length > 0);
   if (expected.length) {
    assert.equal(matched.matchedSourceExcerpt, '傷官用官，大都為調候而取用');
    assert.deepEqual(matched.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    assert.equal(matched.confirmedBranches?.length ?? 1, expected.length);
   }
   const { input } = modelContext(isolated), provider = formatFortunePrompt(input);
   for (const [route, phrase] of Object.entries(phrases)) assert.equal(phrase.test(provider), expected.includes(route), route);
   assert.match(formatFortuneFactAudit(input), /郑丞相原图取亥未暗财承接/u);
   assert.doesNotMatch(provider, /郑丞相原图取亥未暗财承接|zhengLuck/u);
  }
  if (to === '乙巳') {
   assert.ok(reading(before).wealth.some(row => row.kind === '运干' && row.stem === '甲'));
   assert.ok(reading(after).southernFireRoots.some(row => row.kind === '运支本气' && row.stem === '丙'));
  } else if (to === '戊申') {
   assert.ok(reading(before).southernFireRoots.some(row => row.kind === '运支藏干' && row.stem === '丁'));
   assert.deepEqual(reading(after).southernFireRoots, []);
   assert.ok(after.normalizedPayload.hurtOfficerLuck.paths.some(row => row.sealLuck.length > 0));
  }
 }
 const differentHour = submitted(date, 20, 1954);
 const analogous = rows(differentHour).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '乙巳');
 assert.ok(analogous);
 assert.equal(analogous.normalizedPayload.hurtOfficerLuck?.zhengLuck, undefined);
 assert.deepEqual(analogous.normalizedPayload.zhengHurtOfficerReviewedRoutes, []);
 assert.notEqual(match(differentHour, 147).status, 'matched');
 const unknown = ctx(printed('zheng'), '乙巳', false);
 assert.equal(unknown.hurtOfficerLuck?.zhengLuck, undefined);
 assert.equal(unknown.zhengHurtOfficerReviewedRoutes, undefined);
});
