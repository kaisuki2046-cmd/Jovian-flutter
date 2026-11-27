import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Solar} from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import {describeFortuneFact,formatFortuneFactAudit, formatFortunePrompt} from './control/fortune-prompt.mjs';
import {createFortuneDeepSeek} from './server/deepseek-expression.mjs';
const {baziZpqzSealFood,zpqzSealFoodPolicy}=await import('./control/bazi-zpqz-seal-food.ts');
const {calculateFortuneFacts,validateFortuneFacts}=await import('./control/fortune-facts.ts');
const {buildFactTimeContext}=await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const {matchFortuneKnowledge}=await import('./control/knowledge/match.ts');
const {fortuneKnowledge}=await import('./control/knowledge/catalog.ts');
const {buildFortuneModelContext}=await import('./control/fortune-model-context.ts');
const {interpretFortune,requestForFortuneRun}=await import('./control/fortune-interpretation.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/zpqz-remedy-reference.json',import.meta.url)));
const indices=[43,46,47,48,49,50,57,58,60,65],layers=['year','month','day','hour'];
const completeIndices = new Set([57, 58]);
const natal=values=>Object.fromEntries(layers.map((k,i)=>[k,values[i]]));
const ctx=(i=48,luck=ref.calendarExamples[48].luck,known=true)=>baziZpqzSealFood(natal(Array.isArray(i)?i:ref.calendarExamples[i].natal),known,luck);
const rows=run=>run.facts.filter(f=>f.factType==='zpqz_seal_food_context');
const match=(run,i)=>matchFortuneKnowledge(run).byMethod.bazi[i];
const cache=new Map();
function archive(e){const [y,m,d]=e.date,l=Solar.fromYmdHms(y,m,d,e.hour,0,0).getLunar();
 return {timeKnown:true,bazi:{engineName:'lunar-javascript',engineVersion:'1.7.8',rulesetVersion:'utc8-jie-local-civil-late-zi-next-v1',rawResult:[{
 utc:new Date(Date.UTC(y,m-1,d,e.hour-8)).toISOString(),year:l.getYearInGanZhiExact(),month:l.getMonthInGanZhiExact(),day:l.getDayInGanZhiExact(),hour:l.getTimeInGanZhi(),
 luckPeriods:l.getEightChar().getYun(e.gender,2).getDaYun(11).slice(1).map(s=>({ganZhi:s.getGanZhi(),startAge:s.getStartAge(),endAge:s.getEndAge()})),tenGods:{},shenSha:{}}]},ziwei:{rawResult:[]},western:{rawResult:[]}};
}
function real(i){if(!cache.has(i)){const e=ref.calendarExamples[i]??ref[i],chart=archive(e);
 const input={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year:e.year}};
 cache.set(i,calculateFortuneFacts(input,buildFactTimeContext(input,Date.parse(e.year+'-11-19T02:00:00Z'),'server'),'remedy-private-run',{snapshotId:'remedy-private-chart',chart}));}return cache.get(i);}

function submitted(index, year, { gender, example = ref.calendarExamples[index] ?? ref[index] } = {}) {
 const chart = archive({ ...example, gender: gender ?? example.gender });
 const birthInstant = chart.bazi.rawResult[0].utc;
 chart.birthContext = { birthInstant, precision: 'minute', latitude: 39.9042, longitude: 116.4074,
  timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
 const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
 const now = Date.UTC(year, 5, 1), reference = { snapshotId: 'food-remedy-' + index + '-' + year };
 const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...reference, chart })));
 const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), reference.snapshotId, reference);
 validateFortuneFacts(run);
 return run;
}

const modelContext = run => buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'food-remedy-report'));

test('all 106 source expansions use one same-candidate same-stage premise and only verified general methods resolve their conditions',()=>{
 const rules=fortuneKnowledge.bazi.rules.filter(r=>r.review?.sourcePassageId?.startsWith('zpqz-1936-interpretation-'));assert.equal(rules.length,106);
 for(const r of rules){assert.equal(r.queries.length,1,r.knowledgeId);assert.ok(!['natal_conditions','luck_conditions'].includes(r.queries[0].factType));}
 for(const i of indices) assert.equal(fortuneKnowledge.bazi.rules[i].unresolved.length === 0, completeIndices.has(i));
});

test('an autumn Wood chart with rooted peers and seals rules out weak-day candidates in the same real luck', () => {
 const example = { date: [1955, 8, 11], gender: 0 };
 for (const {hour, hourPillar, notWeak} of [
  {hour: 16, hourPillar: '壬申', notWeak: true},
  {hour: 14, hourPillar: '辛未', notWeak: false},
 ]) {
  const run = submitted('autumn-wood-' + hour, 2025, {example: {...example, hour}});
  const activeLuck = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '辛卯');
  assert.ok(activeLuck);
  const payload = activeLuck.normalizedPayload;
  assert.equal(payload.natalPillarSequence, '乙未甲申甲辰' + hourPillar);
  assert.equal(payload.hasRobberyAgainstNatalSealWealth, true);
  assert.equal(payload.hasKillerSealPressure, true);
  assert.equal(payload.autumnWoodSourceNotWeak, notWeak);
  if (notWeak) {
   const {roots, stems} = payload.autumnWoodSupport;
   assert.deepEqual([...new Set(roots.map(row => row.position))], ['year', 'day', 'hour']);
   assert.deepEqual(stems.map(({stem, roots}) => [stem.stem, roots.map(root => root.position)]), [
    ['乙', ['year', 'day']], ['壬', ['hour']],
   ]);
  } else assert.equal(payload.autumnWoodSupport, undefined);
  const matches = matchFortuneKnowledge(run).byMethod.bazi;
  for (const index of [46, 65]) assert.equal(matches[index].status, notWeak ? 'not_matched' : 'partial');
  if (notWeak) {
   const {input} = modelContext(run);
   assert.match(formatFortuneFactAudit(input), /依徐注，秋木失时而有明透比印及年日时三柱通根/u);
   assert.doesNotMatch(formatFortunePrompt(input), /秋木失时|autumnWoodSourceNotWeak/u);
  } else {
   for (const row of rows(run)) delete row.normalizedPayload.autumnWoodSourceNotWeak;
   const missing = matchFortuneKnowledge(run).byMethod.bazi;
   for (const index of [46, 65]) assert.equal(missing[index].status, 'unknown');
  }
 }
 const missingHour = ctx(['乙未','甲申','甲辰','壬申'], '辛卯', false);
 assert.equal(missingHour.autumnWoodSourceNotWeak, undefined);
});

test('exposed officer source requires actual wealth and seal, without inventing a requirement that both helpers must also be exposed',()=>{
 const q=fortuneKnowledge.bazi.rules[43].queries[0];assert.equal(q.where.wealthPresent,true);assert.equal(q.where.sealsPresent,true);assert.equal(q.where.officerExposed,true);
 assert.equal(q.where.wealthExposed,undefined);assert.equal(q.where.sealsExposed,undefined);
 for(const key of ['wealthPresent','sealsPresent']){const missing=structuredClone(real(43));rows(missing).forEach(f=>f.normalizedPayload[key]=false);assert.equal(match(missing,43).status,'not_matched');}
});

test('the original companion/hurt exception is not broadened to food: an actual food-stem-and-branch luck counterexample is rejected',()=>{
 const q=fortuneKnowledge.bazi.rules[43].queries[0];assert.ok(q.anyOf.every(w=>!Object.values(w)[0].oneOf.includes('食神')));
 const run=real('foodExceptionCounterexample');validateFortuneFacts(run);assert.equal(match(run,43).status,'not_matched');
 const p=rows(run).find(f=>f.normalizedPayload.confirmed&&f.normalizedPayload.luckPillar===ref.foodExceptionCounterexample.luck).normalizedPayload;
 assert.equal(p.officerExposed,true);assert.equal(p.hurtPresent,true);assert.equal(p.wealthPresent,true);assert.equal(p.sealsPresent,true);assert.equal(p.luckTenGod,'食神');assert.equal(p.luckBranchMainQiGod,'食神');
});

test('p001 connects the exposed officer to actual wealth, seal and hurt when the branch robbery enters', () => {
 const run = submitted(43, 1991);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊寅');
 assert.ok(change);
 const hit = match(run, 43);
 assert.equal(hit.status, 'partial');
 assert.equal(hit.windows[0].start, change.exactInstant);
 const data = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '戊寅').normalizedPayload;
 const path = data.exposedOfficerWealthSeal.find(row => row.seal.position === 'month' && row.seal.stem === '癸');
 assert.deepEqual([path.officer.position, path.officer.stem, path.hurt.position, path.hurt.stem], ['hour', '庚', 'month', '丙']);
 const wealth = path.wealth.find(row => row.source.position === 'year' && row.source.kind === '透干');
 assert.equal(wealth.source.stem, '己');
 assert.equal(wealth.bothExposed, false);
 const [moving] = path.moving;
 assert.deepEqual([moving.component.stem, moving.component.kind, moving.sameElementAsDay], ['甲', '运支藏干', true]);
 assert.ok(moving.checksWealth.some(row => row.position === 'year' && row.stem === '己'));
 assert.equal(moving.checksOfficer, false);
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.match(prompt, /月柱丙子透干丙.*克明透的时柱庚辰透干庚/u);
 assert.match(prompt, /戊寅运支藏干甲.*与日元同五行并克所列原财/u);
 assert.doesNotMatch(prompt, /exposedOfficerWealthSeal|checksWealth/u);
});

test('carrying wealth as a disease requires actual wealth, while liking wealth does not invent an original-wealth gate or resolve opposite strength conclusions',()=>{
 const run=real(46);assert.equal(match(run,46).status,'partial');assert.equal(match(run,47).status,'partial');
 assert.equal(fortuneKnowledge.bazi.rules[46].queries[0].where.wealthPresent,true);assert.equal(fortuneKnowledge.bazi.rules[47].queries[0].where.wealthPresent,undefined);
 const missing=real('noWealthSealCalendar');validateFortuneFacts(missing);assert.equal(match(missing,46).status,'not_matched');assert.equal(match(missing,47).status,'partial');assert.ok(rows(missing).some(f=>f.normalizedPayload.wealthPresent===false));
 const p=rows(run)[0].normalizedPayload;assert.equal(p.strengthVerified,false);assert.equal(p.protectionVerified,false);
});

test('p004 and p005 retain the same natal wealth touched by robbery and distinguish simultaneous luck wealth', () => {
 const run = submitted(46, 2031);
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '壬午');
 assert.ok(change);
 for (const index of [46, 47]) {
  const hit = match(run, index);
  assert.equal(hit.status, 'partial');
  assert.equal(hit.windows[0].start, change.exactInstant);
 }
 const fact = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '壬午');
 const [path] = fact.normalizedPayload.robberyAgainstSealWealth;
 assert.deepEqual([path.robbery.stem, path.robbery.kind], ['壬', '运干']);
 assert.ok(path.natalWealthPaths.some(({ wealth, seal }) => wealth.position === 'month' && wealth.stem === '丙'
  && wealth.kind === '透干' && seal.position === 'day' && seal.stem === '辛' && seal.kind === '支藏'));
 assert.ok(path.movingWealthPaths.some(({ wealth, seal }) => wealth.position === 'decadal' && wealth.stem === '丁' && seal.position === 'day'));
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.match(prompt, /本步大运壬午运干壬.*克原局月柱丙子透干丙.*这处原财克日柱癸酉支藏辛/u);
 assert.match(prompt, /克同一步的本步大运壬午运支藏干丁/u);
});

test('only moving wealth under robbery is retained for p005 without becoming p004 native wealth', () => {
 const run = submitted('noWealthSealCalendar', 2039, { gender: 1 });
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '庚午');
 assert.ok(fact);
 assert.equal(fact.normalizedPayload.wealthPresent, false);
 assert.equal(match(run, 46).status, 'not_matched');
 assert.equal(match(run, 47).status, 'partial');
 const [path] = fact.normalizedPayload.robberyAgainstSealWealth;
 assert.equal(path.robbery.stem, '丁');
 assert.deepEqual(path.natalWealthPaths, []);
 assert.ok(path.movingWealthPaths.some(({ wealth, seal }) => wealth.stem === '庚' && wealth.kind === '运干'
  && seal.position === 'year' && seal.stem === '乙' && seal.god === '正印'));
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.match(prompt, /完整原局未见财端/u);
 assert.match(prompt, /运支藏干丁.*克同一步的本步大运庚午运干庚/u);
});

test('p008 uses an actual hurt outside the month and p018 binds the month hurt to the same seal and wealth', () => {
 const elsewhere = submitted(50, 1982);
 const [other] = rows(elsewhere).find(row => row.normalizedPayload.confirmed).normalizedPayload.wealthPressesHurtSeal;
 assert.deepEqual([other.hurt.position, other.hurt.stem, other.seal.position, other.seal.stem], ['hour', '甲', 'day', '辛']);
 assert.equal(other.monthHurt, false);
 assert.deepEqual(other.wealth.map(row => [row.stem, row.kind]), [['丁', '运干']]);
 assert.equal(match(elsewhere, 50).status, 'partial');
 assert.equal(match(elsewhere, 60).status, 'not_matched');

 const run = submitted(60, 2029);
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '壬午');
 assert.ok(change);
 assert.equal(match(run, 60).status, 'partial');
 assert.equal(match(run, 60).windows[0].start, change.exactInstant);
 const paths = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '壬午').normalizedPayload.wealthPressesHurtSeal;
 assert.ok(paths.some(({ hurt, seal, wealth, monthHurt }) => monthHurt && hurt.position === 'month' && hurt.stem === '辛'
  && seal.position === 'year' && seal.stem === '丁' && seal.kind === '支藏' && wealth.some(row => row.stem === '壬' && row.kind === '运干')));
 const { input } = modelContext(run), prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /生日元并克月令的月柱丁丑支藏辛.*该伤官生实际运财本步大运壬午运干壬.*同一原印/u);
 assert.doesNotMatch(prompt, /wealthPressesHurtSeal|robberyAgainstSealWealth/u);
 assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== match(run, 60).knowledgeId)));
});

test('food-carrying-killer sources require the actual month-food candidate and an exposed killer, not food and killer appearing anywhere',()=>{
 for(const i of [48,49,57])for(const key of ['monthFoodCandidate','killerExposed']){assert.equal(fortuneKnowledge.bazi.rules[i].queries[0].where[key],true);
  const missing=structuredClone(real(i));rows(missing).forEach(f=>f.normalizedPayload[key]=false);assert.equal(match(missing,i).status,'not_matched');}
});

test('the same-chapter weak-food/killer source permits a real existing seal and does not borrow a later no-seal premise',()=>{
 const run=real('foodKillerWithSeal');validateFortuneFacts(run);assert.equal(match(run,48).status,'partial');
 assert.ok(rows(run).some(f=>f.normalizedPayload.sealsPresent===true));assert.equal(fortuneKnowledge.bazi.rules[48].queries[0].where.sealsPresent,undefined);
});

test('arriving seal can be considered without an original seal, verified through a real no-original-seal calendar and a confirmed full luck stage',()=>{
 const run=real('foodKillerWithoutSeal');validateFortuneFacts(run);assert.equal(match(run,48).status,'partial');
 const p=rows(run).find(f=>f.normalizedPayload.confirmed&&f.normalizedPayload.luckPillar===ref.foodKillerWithoutSeal.luck).normalizedPayload;
 assert.equal(p.sealsPresent,false);assert.equal(p.monthFoodCandidate,true);assert.equal(p.killerExposed,true);assert.ok(p.remedyMovingComponents.some(r=>['正印','偏印'].includes(r.god)));
 const food = p.foodKillerRemedyPaths.find(path => path.wealth.some(wealth => wealth.stem === '壬'));
 assert.deepEqual([food.monthSource.role, food.monthSource.stem, food.monthSource.mainQi, food.monthSource.hiddenOrder], ['食神', '庚', true, 1]);
 assert.equal(p.luckBranchMainQiGod, '正印');
 assert.equal(match(run, 57).status, 'matched');
 assert.equal(match(run, 58).status, 'not_matched');
});

test('arriving Ding seal names its actual Xin food control, native Yi killer generation and actual Ji day-master support without declaring triple rescue',()=>{
 const p=ctx(48,'丁巳');assert.ok(p.remedyMovingContacts.some(r=>r.from.kind==='运干'&&r.from.stem==='丁'&&r.to.stem==='辛'&&r.to.god==='食神'&&r.relation==='克'));
 assert.ok(p.remedyNatalContacts.some(r=>r.from.stem==='乙'&&r.from.god==='七杀'&&r.to.kind==='运干'&&r.to.stem==='丁'&&r.relation==='生'));
 assert.ok(p.remedyMovingContacts.some(r=>r.from.kind==='运干'&&r.from.stem==='丁'&&r.to.god==='日元'&&r.to.stem==='己'&&r.relation==='生'));assert.equal(p.protectionVerified,false);
});

test('the source specifically naming owl luck uses indirect seal and excludes direct seal',()=>{
 const q=fortuneKnowledge.bazi.rules[58].queries[0];assert.ok(q.anyOf.every(w=>Object.values(w)[0].oneOf.join()==='偏印'));
 const p=ctx(58,'乙卯');assert.ok(p.remedyMovingContacts.some(r=>r.from.kind==='运干'&&r.from.god==='偏印'&&r.to.god==='食神'&&r.relation==='克'));
 const direct=structuredClone(real(58));rows(direct).forEach(f=>{f.normalizedPayload.luckTenGod='正印';f.normalizedPayload.luckBranchMainQiGod='正印';});assert.equal(match(direct,58).status,'not_matched');
});

test('p006 and p007 use the same month food and exposed killer while the actual luck components change', () => {
 const run = submitted(48, 2019);
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '辛巳');
 assert.ok(change);
 assert.equal(match(run, 48).status, 'partial');
 assert.equal(match(run, 48).windows[0].start, change.exactInstant);
 assert.equal(match(run, 49).status, 'partial');
 const before = rows(run).find(fact => fact.activeTo === change.exactInstant && fact.normalizedPayload.luckPillar === '庚辰').normalizedPayload;
 const after = rows(run).find(fact => fact.activeFrom === change.exactInstant && fact.normalizedPayload.luckPillar === '辛巳').normalizedPayload;
 for (const fact of [before, after]) {
  const path = fact.foodKillerRemedyPaths.find(row => row.food.position === 'month' && row.killer.position === 'hour');
  assert.deepEqual([path.food.stem, path.killer.stem, path.killer.kind], ['辛', '乙', '透干']);
 }
 const [beforePath] = before.foodKillerRemedyPaths;
 const [afterPath] = after.foodKillerRemedyPaths;
 assert.deepEqual(beforePath.outputs.map(value => [value.stem, value.god, value.kind]), [['庚', '伤官', '运干']]);
 assert.deepEqual(beforePath.seals, []);
 assert.deepEqual(afterPath.outputs.map(value => [value.stem, value.god, value.kind]), [['辛', '食神', '运干']]);
 assert.deepEqual(afterPath.seals.map(value => [value.stem, value.god, value.kind]), [['丙', '正印', '运支藏干']]);
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.match(prompt, /庚辰运干庚.*克同一个时柱乙亥透干乙/u);
 assert.match(prompt, /同一七杀生本步大运辛巳运支藏干丙.*各克这处月令食神/u);
});

test('p006 checks actual stem support for a secondary seal without erasing the opposite p007 path', async () => {
 const example = { date: [1925, 10, 19], hour: 8, gender: 0 };
 const run = submitted('supported-secondary-seal', 1982, {example});
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '壬辰');
 assert.ok(change);
 const before = rows(run).find(fact => fact.activeTo === change.exactInstant && fact.normalizedPayload.luckPillar === '辛卯');
 const after = rows(run).find(fact => fact.activeFrom === change.exactInstant && fact.normalizedPayload.luckPillar === '壬辰');
 assert.ok(before && after);
 const payload = after.normalizedPayload;
 assert.equal(payload.natalPillarSequence, '乙丑丙戌丙子壬辰');
 const path = payload.foodKillerRemedyPaths.find(({food, killer}) => food.position === 'month'
  && food.stem === '戊' && killer.position === 'hour' && killer.stem === '壬');
 assert.ok(path);
 assert.deepEqual(path.seals, []);
 assert.deepEqual(path.secondarySeals.map(({source, seal}) => [source.stem, source.kind, seal.stem, seal.kind]), [
  ['壬', '运干', '乙', '运支藏干'],
 ]);
 assert.deepEqual(path.outputs.map(({stem, kind}) => [stem, kind]), [['戊', '运支藏干']]);
 assert.ok(before.normalizedPayload.foodKillerRemedyRoutes.includes('seal-checks-food'));
 assert.ok(payload.foodKillerRemedyRoutes.includes('stem-feeds-secondary-seal'));
 const weak = match(run, 48), strong = match(run, 49);
 assert.equal(weak.status, 'partial');
 assert.equal(strong.status, 'partial');
 assert.ok(weak.sourceFactIds.includes(before.factId) && weak.sourceFactIds.includes(after.factId));
 assert.ok(strong.sourceFactIds.includes(after.factId));
 const {input} = modelContext(run);
 const localRescue = /运干壬生本步同支余藏乙.*同一原局.*也生该印.*该印克月令.*并生日元/u;
 assert.match(formatFortuneFactAudit(input), localRescue);
 const provider = createFortuneDeepSeek({apiKey: 'test-key', transport: async (_, options) => {
  const message = JSON.parse(options.body).messages[1].content;
  assert.doesNotMatch(message, /本步同支余藏乙|secondarySeals|stem-feeds-secondary-seal/u);
  return Response.json({choices: [{finish_reason: 'stop', message: {content: '{"sections":[]}'}}]});
 }});
 await provider.interpret(input);

 const differentLuck = submitted('unsupported-secondary-seal', 1979, {example, gender: 1});
 const unsupported = rows(differentLuck).find(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.luckPillar === '庚辰');
 assert.ok(unsupported);
 assert.equal(unsupported.normalizedPayload.natalPillarSequence, payload.natalPillarSequence);
 assert.ok(unsupported.normalizedPayload.remedyMovingComponents.some(({stem, kind}) => stem === '乙' && kind === '运支藏干'));
 assert.ok(!unsupported.normalizedPayload.foodKillerRemedyRoutes.includes('stem-feeds-secondary-seal'));
 assert.ok(!match(differentLuck, 48).sourceFactIds.includes(unsupported.factId));

 const noExposedKiller = submitted('no-exposed-killer', 1982, {example: {...example, hour: 6}});
 const noExposed = rows(noExposedKiller).find(fact => fact.normalizedPayload.confirmed && fact.normalizedPayload.luckPillar === '壬辰');
 assert.ok(noExposed);
 assert.equal(noExposed.normalizedPayload.natalPillarSequence, '乙丑丙戌丙子辛卯');
 assert.equal(noExposed.normalizedPayload.killerExposed, false);
 assert.ok(!match(noExposedKiller, 48).sourceFactIds.includes(noExposed.factId));
});

test('p006 keeps the Liu source reading with the two natal stems between wealth and killer', async () => {
 const example = { date: [1933, 9, 10], hour: 22, gender: 1 };
 const run = submitted('liu-source-separation', 1944, {example});
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '己未');
 assert.ok(change);
 const before = rows(run).find(fact => fact.activeTo === change.exactInstant && fact.normalizedPayload.luckPillar === '庚申');
 const after = rows(run).find(fact => fact.activeFrom === change.exactInstant && fact.normalizedPayload.luckPillar === '己未');
 assert.ok(before && after);
 const payload = after.normalizedPayload;
 const separation = payload.liuSourceWealthSeparation;
 assert.ok(separation);
 assert.deepEqual([separation.from.position, separation.from.stem, separation.to.position, separation.to.stem], ['year', '癸', 'hour', '乙']);
 assert.deepEqual(separation.between.map(({position, stem}) => [position, stem]), [['month', '辛'], ['day', '己']]);
 assert.deepEqual(before.normalizedPayload.liuSourceWealthSeparation, separation);
 const path = payload.foodKillerRemedyPaths.find(({food, killer}) => food.stem === '辛' && killer.stem === '乙');
 assert.ok(path);
 assert.deepEqual(path.secondarySeals, []);
 assert.deepEqual(path.liuSourceSeals.map(({stem, kind}) => [stem, kind]), [['丁', '运支藏干']]);
 assert.equal(payload.foodKillerLiuSeal, true);
 assert.equal(before.normalizedPayload.foodKillerLiuSeal, false);
 const hit = match(run, 48);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows[0].start, change.exactInstant);
 assert.ok(hit.sourceFactIds.includes(after.factId));
 assert.ok(!hit.sourceFactIds.includes(before.factId));
 assert.ok(!match(run, 49).sourceFactIds.includes(after.factId));
 const {input} = modelContext(run);
 const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
 assert.deepEqual(finding.windows, hit.windows);
 const sourceComparison = /刘提督原评年癸财与时乙杀之间隔着月辛、日己/u;
 assert.match(formatFortuneFactAudit(input), sourceComparison);
 const provider = createFortuneDeepSeek({apiKey: 'test-key', transport: async (_, options) => {
  const message = JSON.parse(options.body).messages[1].content;
  assert.match(message, /按徐注刘提督原图辨身弱克泄.*由同一运印承杀、克月食并生原日元/u);
  assert.doesNotMatch(message, /原评年癸财与时乙杀|liuSourceWealthSeparation/u);
  return Response.json({choices: [{finish_reason: 'stop', message: {content: '{"sections":[]}'}}]});
 }});
 await provider.interpret(input);
 const unknown = ctx(['癸酉', '辛酉', '己卯', '乙亥'], '己未', false);
 assert.equal(unknown.liuSourceWealthSeparation, undefined);
 assert.equal(unknown.foodKillerLiuSeal, false);
});

test('p015 keeps the arriving wealth path and a simultaneous branch seal on the same native pair', () => {
 const run = submitted(57, 2029);
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '壬午');
 assert.ok(change);
 const hit = match(run, 57);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows[0].start, change.exactInstant);
 const data = rows(run).find(fact => fact.activeFrom === change.exactInstant && fact.normalizedPayload.luckPillar === '壬午').normalizedPayload;
 const [path] = data.foodKillerRemedyPaths;
 assert.deepEqual(path.monthSource, { role: '食神', stem: '辛', hiddenOrder: 3, mainQi: false, exposedSameStem: [] });
 assert.deepEqual(path.wealth.map(value => [value.stem, value.kind]), [['壬', '运干']]);
 assert.deepEqual(path.seals.map(value => [value.stem, value.kind]), [['丁', '运支藏干']]);
 assert.equal(data.luckBranchMainQiGod, '偏印');
 assert.equal(data.monthKillerCandidate, false);
 assert.equal(match(run, 58).status, 'not_matched');
 assert.ok(hit.sourceFactIds.some(id => match(run, 48).sourceFactIds.includes(id)));
 const { input } = modelContext(run), prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /月柱丁丑支藏辛.*生本步大运壬午运干壬.*该运财再生同一个时柱乙亥透干乙/u);
 assert.match(prompt, /月令辛食神为支中第3藏/u);
 assert.match(prompt, /同一七杀生本步大运壬午运支藏干丁/u);
 assert.doesNotMatch(prompt, /foodKillerRemedyPaths|wealth-feeds-killer/u);
 const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
 assert.deepEqual(finding?.windows, hit.windows);
});

test('p016 binds the actual owl to the food opposing the month killer and excludes the prior direct seal and annual-only owl', () => {
 const run = submitted(58, 2000);
 const change = run.facts.find(fact => fact.factType === 'luck_transition' && fact.normalizedPayload.toPillar === '己卯');
 assert.ok(change);
 const hit = match(run, 58);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows[0].start, change.exactInstant);
 const previous = rows(run).find(fact => fact.activeTo === change.exactInstant && fact.normalizedPayload.luckPillar === '戊寅');
 const before = previous.normalizedPayload;
 const after = rows(run).find(fact => fact.activeFrom === change.exactInstant && fact.normalizedPayload.luckPillar === '己卯').normalizedPayload;
 assert.equal(before.luckBranchMainQiGod, '正印');
 assert.ok(!before.foodKillerRemedyRoutes.includes('owl-checks-month-killer-food'));
 assert.ok(!hit.sourceFactIds.includes(previous.factId));
 assert.ok(after.foodKillerRemedyPaths.some(({ food, killer, owls }) => food.position === 'year' && food.stem === '己'
  && killer.position === 'month' && killer.stem === '癸' && owls.some(value => value.stem === '乙' && value.kind === '运支藏干')));
 assert.ok(after.foodKillerRemedyPaths.every(({ killer }) => killer.position === 'month'));
 const { input } = modelContext(run);
 assert.match(formatFortuneFactAudit(input), /月中此杀生本步大运己卯运支藏干乙.*各克同一原局食神/u);
 const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
 assert.deepEqual(finding?.windows, hit.windows);
 assert.match(formatFortunePrompt(input), /若[^。\n]*食神制杀/u);

 const annualOnly = submitted(58, 2011);
 assert.ok(annualOnly.facts.some(row => row.factType === 'zpqz_moving_relations' && row.normalizedPayload.annualBranch === '卯'));
 const realLuck = rows(annualOnly).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '庚辰');
 assert.ok(realLuck.normalizedPayload.remedyMovingComponents.some(row => row.stem === '乙' && row.god === '偏印'));
 assert.ok(!realLuck.normalizedPayload.foodKillerRemedyRoutes.includes('owl-checks-month-killer-food'));
 assert.equal(match(annualOnly, 58).status, 'not_matched');
});

test('although wearing seal but not using it requires an actual seal, while the source does not require wealth already present in the natal chart',()=>{
 const q=fortuneKnowledge.bazi.rules[50].queries[0];assert.equal(q.where.sealsPresent,true);assert.equal(q.where.wealthPresent,undefined);
 const missing=structuredClone(real(50));rows(missing).forEach(f=>f.normalizedPayload.sealsPresent=false);assert.equal(match(missing,50).status,'not_matched');assert.equal(ctx(50).strengthVerified,false);
});

test('food to arriving Ren wealth, arriving Ren to actual Yi killer and native food to killer remain three named links rather than a computed broken pattern',()=>{
 const p=ctx(57,'壬午');assert.ok(p.remedyNatalContacts.some(r=>r.from.god==='食神'&&r.to.kind==='运干'&&r.to.stem==='壬'&&r.to.god==='正财'&&r.relation==='生'));
 assert.ok(p.remedyMovingContacts.some(r=>r.from.kind==='运干'&&r.from.stem==='壬'&&r.to.stem==='乙'&&r.to.god==='七杀'&&r.relation==='生'));
 assert.ok(p.foodKillerContacts.some(r=>r.from.god==='食神'&&r.to.stem==='乙'));assert.equal(p.transformationVerified,false);
});

test('hurt/seal source preserves real hidden seals, separate same/exact roots and the actual day master instead of adding an exposed companion',()=>{
 const p=ctx(60),q=fortuneKnowledge.bazi.rules[60].queries[0];assert.equal(p.monthHurtCandidate,true);assert.equal(p.sealsPresent,true);assert.equal(q.where.sealsExposed,undefined);
 assert.ok(p.sealDayContacts.length>0);assert.ok(p.sealDayContacts.every(r=>r.to.god==='日元'&&r.to.position==='day'&&r.relation==='生'));assert.ok(!p.gods.some(g=>g.exposedRows.some(r=>r.position==='day')));
});

test('a real hidden-seal killer/weak-body counterpart is no longer excluded by an unsupported exposed-seal gate and still cannot declare the luck useful',()=>{
 const run=real('hiddenSeal');validateFortuneFacts(run);assert.equal(match(run,65).status,'partial');
 const p=rows(run).find(f=>f.normalizedPayload.confirmed).normalizedPayload;assert.equal(p.sealsPresent,true);assert.equal(p.sealsExposed,false);assert.equal(fortuneKnowledge.bazi.rules[65].queries[0].where.sealsExposed,undefined);
 assert.ok(p.remedyMovingContacts.some(r=>r.from.god==='七杀'&&['正印','偏印'].includes(r.to.god)&&r.relation==='生'));
 assert.ok(p.remedyMovingContacts.some(r=>r.from.god==='七杀'&&r.to.god==='日元'&&r.relation==='克'));assert.equal(p.strengthVerified,false);
});

test('ten real calendars retain exact natal columns, unique whole luck segments and raw provenance',()=>{
 for(const i of indices){const run=real(i),e=ref.calendarExamples[i];validateFortuneFacts(run);assert.equal(match(run,i).status,completeIndices.has(i)?'matched':'partial',String(i));const selected=rows(run).filter(f=>f.normalizedPayload.confirmed&&f.normalizedPayload.luckPillar===e.luck);assert.ok(selected.length);
  for(const f of selected){assert.deepEqual(f.normalizedPayload.natalPillars.map(r=>r.pillar),e.natal);assert.ok(f.normalizedPayload.stageStart<=f.activeFrom&&f.activeTo<=f.normalizedPayload.stageEnd);assert.ok(f.sourceFactIds.every(id=>run.rawFacts.some(raw=>raw.rawFactId===id)));}}
});

test('SQLite retains source hashes and a single new atomic subprofile; missing or split wealth/seal evidence cannot manufacture a premise',()=>{
 for(const i of indices){const r=fortuneKnowledge.bazi.rules[i],e=fortuneKnowledge.bazi.entries.find(e=>e.id===r.knowledgeId);assert.equal(r.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:e.evidence,conditions:e.conditions})).digest('hex'));assert.equal(r.queries.length,1);assert.equal(r.queries[0].where.sourceDecisionProfile,zpqzSealFoodPolicy.generalRemedy);assert.equal(r.unresolved.length,completeIndices.has(i)?0:1);}
 const absent=structuredClone(real(46));rows(absent).forEach(f=>delete f.normalizedPayload.sourceDecisionProfile);assert.equal(match(absent,46).status,'unknown');
 const split=structuredClone(real(46));for(const f of rows(split)){const other=structuredClone(f);other.factId+='-other';f.normalizedPayload.wealthPresent=false;other.normalizedPayload.sealsPresent=false;split.facts.push(other);}assert.equal(match(split,46).status,'not_matched');
});

test('actual outbound provider message renders source-specific remedy candidates in Chinese without machine JSON, private IDs or partial original paragraphs',async()=>{
 const run=real(57),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'remedy-private-report'));
 const f=input.facts.find(f=>f.type==='zpqz_seal_food_context');assert.ok(f);assert.equal(f.data.sourceDecisionProfile,zpqzSealFoodPolicy.generalRemedy);const prompt=formatFortuneFactAudit(input);
 for(const phrase of ['同章食神带杀明确定义','不借后章无印分支改写本条','例外不擅扩为食神','运干与各运支藏干不合为同一神','原局印对实际日元'])assert.ok(prompt.includes(phrase),phrase);
 for(const key of ['remedy-private','zpqz-general-remedy-premises','sourceDecisionProfile','remedyMovingContacts','remedyNatalContacts','sealDayContacts','stageStart'])assert.ok(!prompt.includes(key),key);
 assert.ok(!input.sections.flatMap(s=>s.findings).some(f=>indices.some(i=>!completeIndices.has(i)&&fortuneKnowledge.bazi.rules[i].knowledgeId===f.knowledgeId)));
 assert.ok(!/[{}\[\]]/u.test(describeFortuneFact({method:'bazi',type:'zpqz_seal_food_context',data:ctx()},String)));
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await provider.interpret(input);
});
