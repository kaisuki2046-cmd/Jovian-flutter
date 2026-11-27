import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Lunar,Solar} from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import {describeFortuneFact,formatFortuneFactAudit, formatFortunePrompt} from './control/fortune-prompt.mjs';
import {createFortuneDeepSeek} from './server/deepseek-expression.mjs';
const {baziZpqzFoodKiller,zpqzFoodKillerCases,zpqzFoodKillerPolicy}=await import('./control/bazi-zpqz-food-killer.ts');
const {calculateFortuneFacts,validateFortuneFacts}=await import('./control/fortune-facts.ts');
const {buildFactTimeContext}=await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const {matchFortuneKnowledge}=await import('./control/knowledge/match.ts');
const {fortuneKnowledge}=await import('./control/knowledge/catalog.ts');
const {buildFortuneModelContext}=await import('./control/fortune-model-context.ts');
const {interpretFortune,requestForFortuneRun}=await import('./control/fortune-interpretation.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/zpqz-food-killer-reference.json',import.meta.url)));
const layers=['year','month','day','hour'],native=values=>Object.fromEntries(layers.map((key,i)=>[key,values[i]]));
const printed=id=>native(ref.printedCases.find(c=>c.id===id).pillars),ctx=(n=printed('hu'),luck='甲寅',known=true)=>baziZpqzFoodKiller(n,known,luck);
const indices=[131,132,133,134,135,136,137,138];
function chart(e){const [y,m,d]=e.date,l=Solar.fromYmdHms(y,m,d,e.hour,0,0).getLunar();return {timeKnown:true,bazi:{engineName:'lunar-javascript',engineVersion:'1.7.8',rulesetVersion:'utc8-jie-local-civil-late-zi-next-v1',rawResult:[{
 utc:new Date(Date.UTC(y,m-1,d,e.hour-8)).toISOString(),year:l.getYearInGanZhiExact(),month:l.getMonthInGanZhiExact(),day:l.getDayInGanZhiExact(),hour:l.getTimeInGanZhi(),
 luckPeriods:l.getEightChar().getYun(e.gender,2).getDaYun(11).slice(1).map(s=>({ganZhi:s.getGanZhi(),startAge:s.getStartAge(),endAge:s.getEndAge()})),tenGods:{},shenSha:{},
 }]},ziwei:{rawResult:[]},western:{rawResult:[]}};}
const cache=new Map();function real(i){if(!cache.has(i)){const e=ref.calendarExamples[i],input={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year:e.year}};
 cache.set(i,calculateFortuneFacts(input,buildFactTimeContext(input,Date.parse(e.year+'-11-19T02:00:00Z'),'server'),'food-private-run',{snapshotId:'food-private-chart',chart:chart(e)}));}return cache.get(i);}
const rows=run=>run.facts.filter(f=>f.factType==='zpqz_food_killer_context'),match=(run,i)=>matchFortuneKnowledge(run).byMethod.bazi[i];

function submitted(e) {
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: e.year } };
  const now = Date.UTC(e.year, 5, 15), ref = { snapshotId: 'food-printed-' + e.date.join('-') + '-' + e.hour };
  const archived = chart({ ...e, gender: e.gender ?? 1 });
  archived.birthContext = { birthInstant: archived.bazi.rawResult[0].utc, precision: 'minute', latitude: 39.9042, longitude: 116.4074,
    timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart: archived })));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
  validateFortuneFacts(run);
  return run;
}

function submittedCalendar(e) {
 const run = submitted(e);
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === e.luck);
 assert.ok(fact, e.luck);
 assert.deepEqual(fact.normalizedPayload.natalPillars.map(row => row.pillar), e.natal);
 return { run, fact, paths: fact.normalizedPayload.foodLuckPaths };
}

test('month food connects to real wealth and retains only relevant moving stages', () => {
 const base = ref.calendarExamples[131];
 const wealth = submittedCalendar({ ...base, year: 2009, luck: '庚辰' });
 assert.ok(wealth.paths.monthFoodWealth.some(link => link.from.position === 'month' && link.from.stem === '己'
  && link.to.position === 'hour' && link.to.stem === '庚'));
 assert.ok(wealth.paths.monthFoodFeedsLuckWealth.some(link => link.from.stem === '己' && link.to.stem === '庚'));
 assert.ok(wealth.paths.luckOutputFeedsWealth.some(link => link.from.stem === '戊' && link.from.kind === '运支藏干'
  && link.to.position === 'hour' && link.to.stem === '庚'));
 assert.ok(match(wealth.run, 131).sourceFactIds.includes(wealth.fact.factId));
 const unrelated = submittedCalendar(ref.authorityWithoutExposedFood);
 assert.ok(unrelated.paths.monthFoodWealth.length);
 assert.deepEqual(unrelated.paths.authorityPressure, []);
 assert.equal(match(unrelated.run, 131).status, 'not_matched');
 const source = ctx(printed('xie'), '戊辰');
 assert.ok(source.sourceVariants.some(text => text.includes('末柱列戊申') && text.includes('庚辰时')));
});

const xieCalendar = { date: [2039, 9, 3], hour: 16, gender: 1, natal: ['己未', '壬申', '戊子', '庚申'] };

test('the Xie diagram retains earth support in both named stages and separates arriving Chen at the boundary', () => {
 const { run, fact, paths } = submittedCalendar({ ...xieCalendar, year: 2078, luck: '戊辰' });
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊辰');
 const previous = rows(run).find(row => row.activeTo === transition?.exactInstant && row.normalizedPayload.luckPillar === '己巳');
 assert.ok(transition && previous);
 assert.equal(fact.activeFrom, transition.exactInstant);
 const xie = paths.xieLuck;
 assert.deepEqual([xie.food.stem, xie.food.position, xie.wealth.stem, xie.wealth.position], ['庚', 'hour', '壬', 'month']);
 assert.deepEqual(xie.foodRoots.map(row => [row.position, row.stem]), [['month', '庚'], ['hour', '庚']]);
 assert.deepEqual(xie.wealthRoots.map(row => [row.position, row.stem]), [['month', '壬'], ['hour', '壬']]);
 assert.deepEqual(xie.waterMembers.map(row => [row.branch, row.natalPositions]), [['申', ['month', 'hour']], ['子', ['day']], ['辰', []]]);
 assert.equal(xie.chenArrives, true);
 assert.equal(previous.normalizedPayload.foodLuckPaths.xieLuck.chenArrives, false);
 assert.deepEqual(previous.normalizedPayload.foodLuckPaths.xieLuck.namedSupport.map(row => row.stem), ['己', '丙', '戊']);
 assert.deepEqual(xie.namedSupport.map(row => [row.kind, row.stem]), [['运干', '戊'], ['运支藏干', '戊']]);
 const sourceOnly = structuredClone(run);
 for (const row of rows(sourceOnly)) {
  row.normalizedPayload.foodLuckRoutes = row.normalizedPayload.foodLuckRoutes.filter(route => route === 'xie-body-support');
 }
 const namedMatch = match(sourceOnly, 131);
 assert.ok([previous, fact].every(value => namedMatch.sourceFactIds.includes(value.factId)));
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'xie-transition'));
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('申在月柱、时柱，子在日柱；这一步运支另外补辰'));
 assert.ok(prompt.includes('谢例本步所核助身为'));
 assert.ok(!prompt.includes('xieLuck'));
});

test('p090 excludes the documented heavy Xie chart while the different-hour chart still reaches the generic wealth contact', () => {
 const query = { ...xieCalendar, year: 2051, luck: '辛未' };
 const original = submittedCalendar(query);
 assert.equal(original.paths.sourceBodyHeavy, true);
 assert.ok(original.paths.robberyChecksWealth.some(link => link.from.stem === '己' && link.to.stem === '壬' && link.to.position === 'month'));
 assert.equal(match(original.run, 132).status, 'not_matched');
 const altered = submittedCalendar({ ...query, hour: 18, natal: [...xieCalendar.natal.slice(0, 3), '辛酉'] });
 assert.equal(altered.paths.sourceBodyHeavy, false);
 assert.equal(altered.paths.xieLuck, undefined);
 assert.ok(altered.paths.robberyChecksWealth.length);
 assert.equal(match(altered.run, 132).status, 'not_matched');
});

test('Shen branch water retains the distinct Ren combination and Gui control of the same original wealth', () => {
 const base = ref.shenCalendar, ren = submittedCalendar(base);
 const change = ren.run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '壬子');
 const previous = rows(ren.run).find(row => row.activeTo === change?.exactInstant && row.normalizedPayload.luckPillar === '辛亥');
 assert.ok(change && previous);
 assert.equal(change.exactInstant, '2031-03-03T12:00:00.000Z');
 assert.equal(ren.fact.activeFrom, change.exactInstant);
 assert.deepEqual(ren.paths.shenLuck.renCombinesDing.map(pair => [pair.target.stem, pair.target.position]), [['丁', 'year']]);
 assert.deepEqual(ren.paths.shenLuck.northWater.map(row => row.stem), ['癸']);
 assert.deepEqual([ren.paths.shenLuck.nativeWaterRoot.position, ren.paths.shenLuck.nativeWaterRoot.stem], ['year', '壬']);
 const source = ren.paths.shenSourceFoodBody;
 assert.deepEqual([source.day.stem, source.food.position, source.food.stem, source.hurt.position, source.hurt.stem,
  source.wealth.position, source.wealth.stem], ['癸', 'month', '乙', 'hour', '甲', 'year', '丁']);
 assert.deepEqual(source.woodMembers.map(row => [row.branch, row.natalPositions]), [['亥', ['year']], ['卯', ['month', 'day']]]);
 const renMatch = match(ren.run, 132);
 assert.equal(renMatch.status, 'matched');
 assert.ok([previous, ren.fact].every(row => renMatch.sourceFactIds.includes(row.factId)));
 const gui = submittedCalendar({ ...base, year: 2043, luck: '癸丑' });
 assert.deepEqual(gui.paths.shenLuck.guiChecksDing.map(link => [link.from.stem, link.to.stem, link.to.position]), [['癸', '丁', 'year']]);
 assert.deepEqual(gui.paths.shenLuck.northWater.map(row => row.stem), ['癸']);
 assert.equal(gui.paths.shenSourceFoodBody.guiChecksDing[0].to.stem, '丁');
 assert.equal(match(gui.run, 132).status, 'matched');
 assert.ok(match(gui.run, 132).sourceFactIds.includes(gui.fact.factId));
 const { input } = buildFortuneModelContext(ren.run, interpretFortune(ren.run, requestForFortuneRun(ren.run), 'shen-transition'));
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('沈例同一步的运壬与原局年丁有五合位置'));
 assert.ok(prompt.includes('取运篇另录丁亥、癸卯、甲寅、甲寅'));
 assert.ok(input.facts.some(row => row.type === 'zpqz_food_killer_context' && row.data.luckPillar === '辛亥'
  && row.endExclusive === change.exactInstant));
 assert.ok(!prompt.includes('foodLuckPaths'));
});

test('the two food-body source diagrams use actual stem and branch support and exclude neighboring stages', async () => {
 const shen = submittedCalendar({ ...ref.shenCalendar, year: 2021, luck: '辛亥' });
 const shenBoundary = '2021-03-03T12:00:00.000Z';
 const before = rows(shen.run).find(row => row.activeTo === shenBoundary && row.normalizedPayload.luckPillar === '庚戌');
 assert.ok(before && shen.fact.activeFrom === shenBoundary);
 assert.ok(before.normalizedPayload.foodLuckPaths.sealChecksOutput.length);
 assert.equal(before.normalizedPayload.foodLuckPaths.shenSourceFoodBody, undefined);
 const shenHit = match(shen.run, 132);
 assert.equal(shenHit.status, 'matched');
 assert.equal(shenHit.windows[0].start, shenBoundary);
 assert.ok(!shenHit.sourceFactIds.includes(before.factId));

 const gongDate = [1894, 3, 12], gongHour = 8;
 for (const [year, previous, incoming] of [[1952, '壬申', '癸酉'], [1962, '癸酉', '甲戌']]) {
  const run = submitted({ date: gongDate, hour: gongHour, year });
  const boundary = year + '-02-18T16:00:00.000Z';
  const old = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === previous);
  const next = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === incoming);
  assert.ok(old && next);
  const hit = match(run, 132);
  assert.equal(hit.status, 'matched');
  for (const fact of [old, next]) {
   const expected = fact.normalizedPayload.luckPillar !== '甲戌';
   assert.equal(hit.sourceFactIds.includes(fact.factId), expected);
   const source = fact.normalizedPayload.foodLuckPaths.gongSourceFoodBody;
   assert.equal(Boolean(source), expected);
   if (!expected) continue;
   assert.deepEqual(source.wealth.map(row => [row.position, row.stem]), [['month', '丁'], ['hour', '丙']]);
   assert.deepEqual([source.food.position, source.food.stem, source.day.stem], ['month', '乙', '癸']);
   assert.deepEqual(source.waterRoots.filter(row => row.exactStem).map(row => row.position), ['day', 'hour']);
   const stems = fact.normalizedPayload.luckPillar === '壬申' ? ['壬', '庚'] : ['癸', '辛'];
   assert.deepEqual(source.movingSupport.map(link => [link.moving.kind, link.moving.stem, link.relation]), [
    ['运干', stems[0], '同五行'], ['运支藏干', stems[1], '生'],
   ]);
  }
  if (incoming !== '甲戌') continue;
  assert.equal(hit.windows.at(-1).endExclusive, boundary);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'two-source-food-body'));
  const finding = input.sections.flatMap(section => section.findings).find(item => item.knowledgeId === hit.knowledgeId);
  assert.ok(finding);
  assert.deepEqual(finding.windows, hit.windows);
  let checked = false;
  const provider = createFortuneDeepSeek({ apiKey: 'test', transport: async (_url, options) => {
   const content = JSON.parse(options.body).messages[1].content;
   assert.ok(content.includes(finding.note));
   assert.ok(content.includes('食重喜印，財重喜劫'));
   assert.match(content, /同一已核大运符合原评沈路分或龚知县的逐案取法/u);
   assert.doesNotMatch(content, /龚例按原评为身轻财重，月食|gongSourceFoodBody/u);
   checked = true;
   return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(input);
  assert.ok(checked);
 }
});

test('the food-killer branches retain the same native killer and distinguish wealth feeding it from the three seal contacts', () => {
 const base = ref.calendarExamples[133];
 const peerAndWealth = submittedCalendar(base), output = submittedCalendar(ref.calendarExamples[134]);
 const sealAndOutput = submittedCalendar({ ...base, year: 2054, luck: '甲辰' });
 assert.equal(match(peerAndWealth.run, 133).status, 'partial');
 assert.ok(peerAndWealth.paths.wealthFeedsKiller.some(link => link.from.stem === '辛' && link.to.position === 'month' && link.to.stem === '壬'));
 assert.deepEqual(peerAndWealth.paths.outputChecksKiller, []);
 assert.ok(match(peerAndWealth.run, 134).sourceFactIds.includes(peerAndWealth.fact.factId));
 assert.equal(match(peerAndWealth.run, 135).status, 'partial');
 assert.ok(output.paths.outputChecksKiller.length);
 assert.ok(output.paths.outputChecksKiller.every(link => output.paths.noSealKiller.some(pair => pair.to.position === link.to.position
  && pair.to.stem === link.to.stem && pair.from.position === 'month')));
 assert.equal(match(output.run, 134).status, 'partial');
 assert.deepEqual(sealAndOutput.paths.sealRescue.map(row => [row.moving.stem, row.killer.stem, row.food.stem, row.day.stem]),
  [['甲', '壬', '戊', '丙']]);
 assert.equal(match(sealAndOutput.run, 134).status, 'partial');
 assert.equal(match(sealAndOutput.run, 135).status, 'partial');
 const hiddenSeal = submittedCalendar({ ...base, hour: 4, year: 1994, luck: '戊戌', natal: [...base.natal.slice(0, 3), '庚寅'] });
 assert.equal(hiddenSeal.fact.normalizedPayload.noSeal, false);
 for (const index of [133, 134, 135]) assert.equal(match(hiddenSeal.run, index).status, 'not_matched');
});

test('p091 retains Liu’s named peer and seal contacts and rejects the strong-day route at the preceding stage', () => {
 const calendar = { date: [1933, 9, 10], hour: 22, gender: 1, natal: ['癸酉', '辛酉', '己卯', '乙亥'] };
 const firstSupport = submittedCalendar({ ...calendar, year: 1944, luck: '己未' });
 const { run, fact, paths } = firstSupport;
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '己未');
 const previous = rows(run).find(row => row.activeTo === transition?.exactInstant && row.normalizedPayload.luckPillar === '庚申');
 assert.ok(previous && transition);
 assert.equal(fact.activeFrom, transition.exactInstant);
 assert.equal(previous.normalizedPayload.strongFoodKillerExcluded, true);
 assert.ok(previous.normalizedPayload.foodLuckPaths.outputChecksKiller.some(link => link.to.stem === '乙'));
 assert.equal(match(run, 134).status, 'not_matched');
 assert.equal(match(run, 133).status, 'matched');
 assert.equal(match(run, 133).windows[0].start, transition.exactInstant);
 assert.ok(!match(run, 133).sourceFactIds.includes(previous.factId));
 assert.ok(match(run, 133).sourceFactIds.includes(fact.factId));
 assert.equal(fact.normalizedPayload.namedLiuWeakDay, true);
 assert.equal(fact.normalizedPayload.hasMonthFoodChecksExposedKiller, true);
 assert.ok(paths.secondarySealRescue.some(row => row.moving.stem === '丁' && row.killer.stem === '乙'));
 assert.equal(match(run, 135).status, 'not_matched');
 assert.equal(ctx(printed('liu'), '己未', false).namedLiuWeakDay, undefined);
 assert.deepEqual(paths.liuSupport.map(link => [link.moving.stem, link.moving.kind, link.day.stem]),
  [['己', '运干', '己'], ['己', '运支藏干', '己'], ['丁', '运支藏干', '己']]);
 const { food, killer, day, wealthSeparation } = paths.liuSourceSupport;
 assert.deepEqual([food.position, food.stem, killer.position, killer.stem, day.stem], ['month', '辛', 'hour', '乙', '己']);
 assert.deepEqual([wealthSeparation.from.position, wealthSeparation.from.stem, wealthSeparation.to.position,
  wealthSeparation.to.stem], ['year', '癸', 'hour', '乙']);
 assert.deepEqual(wealthSeparation.between.map(row => row.stem), ['辛', '己']);
 assert.equal(previous.normalizedPayload.foodLuckPaths.liuSourceSupport, undefined);
 assert.ok(paths.noSealKiller.some(link => link.from.position === 'month' && link.from.stem === '辛'
  && link.to.position === 'hour' && link.to.kind === '透干' && link.to.stem === '乙'));
 const remaining = [[1956, '戊午', ['戊', '丁', '己']], [1966, '丁巳', ['丁', '丙', '戊']], [1976, '丙辰', ['丙', '戊']]];
 for (const [year, luck, stems] of remaining) {
  const sample = submittedCalendar({ ...calendar, year, luck });
  assert.deepEqual(sample.paths.liuSupport.map(link => link.moving.stem), stems);
  assert.deepEqual(sample.paths.liuSourceSupport, paths.liuSourceSupport);
  assert.equal(match(sample.run, 133).status, 'matched');
  assert.ok(match(sample.run, 133).sourceFactIds.includes(sample.fact.factId));
 }
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'liu-transition'));
 assert.match(formatFortuneFactAudit(input), /刘例当步印比劫分别见于.*己未运支藏干丁/u);
 assert.match(formatFortunePrompt(input), /刘提督原图无印，原评定为己土身弱/u);
 assert.match(formatFortunePrompt(input), /年癸财与时透乙杀之间隔月辛、日己/u);
});

test('p007 and p092 distinguish actual output checks and wealth feeding the same rooted killer', async () => {
 const run = submitted({ date: [1951, 6, 14], hour: 4, year: 1989, gender: 0 });
 const boundary = '1989-06-28T06:00:00.000Z';
 const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '丁酉');
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '戊戌');
 assert.ok(before && after);
 const natal = native(['辛卯', '甲午', '乙酉', '戊寅']);
 for (const { normalizedPayload: p } of [before, after]) {
  assert.equal(p.noSeal, true);
  assert.equal(p.hasMonthFoodChecksExposedKiller, true);
  assert.deepEqual(p.natalPillars.map(row => row.pillar), Object.values(natal));
  assert.ok(p.roots.find(row => row.stem === '乙').roots.some(row => row.position === 'year' && row.exactStem));
  assert.ok(p.roots.find(row => row.stem === '辛').roots.some(row => row.position === 'day' && row.exactStem));
  assert.ok(p.foodLuckPaths.noSealKiller.some(row => row.from.position === 'month' && row.from.stem === '丁'
   && row.to.position === 'year' && row.to.stem === '辛' && row.to.kind === '透干'));
 }
 const actions = [before, after].map(row => row.normalizedPayload);
 assert.deepEqual(actions.map(p => [p.hasRootedFoodKillerOutput, p.hasRootedFoodKillerWealth]),
  [[true, false], [false, true]]);
 assert.ok(actions[0].foodLuckPaths.outputChecksKiller.some(row => row.from.stem === '丁' && row.to.position === 'year' && row.to.stem === '辛'));
 assert.deepEqual(actions[1].foodLuckPaths.wealthFeedsKiller.filter(row => row.to.position === 'year').map(row => [row.from.stem, row.from.kind]),
  [['戊', '运干'], ['戊', '运支藏干']]);
 const food = match(run, 49), source = match(run, 134);
 assert.equal(food.status, 'matched');
 assert.equal(food.matchedSourceExcerpt, '食制煞');
 assert.equal(food.windows.at(-1).endExclusive, boundary);
 assert.equal(source.status, 'matched');
 assert.equal(source.matchedSourceExcerpt, '食傷\n財運');
 const [output, wealth] = source.confirmedBranches;
 assert.equal(output.windows.at(-1).endExclusive, boundary);
 assert.equal(wealth.windows[0].start, boundary);
 assert.ok(output.sourceFactIds.includes(before.factId) && !output.sourceFactIds.includes(after.factId));
 assert.ok(wealth.sourceFactIds.includes(after.factId) && !wealth.sourceFactIds.includes(before.factId));
 const withSeal = ctx({ ...natal, hour: '丙子' }, '戊戌');
 assert.equal(withSeal.noSeal, false);
 assert.equal(withSeal.hasRootedFoodKillerWealth, false);
 assert.equal(ctx(natal, '丁酉', false).hasRootedFoodKillerOutput, false);

 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'food-killer-rooted'));
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
  const content = JSON.parse(options.body).messages[1].content;
  assert.match(content, /本运实际食伤克月令首藏食神所克的同一七杀/u);
  assert.match(content, /本运实际财承月令首藏食神，再生该食神所克的同一七杀/u);
  assert.match(content, /原文的忌财以身旺煞强为前提/u);
  assert.doesNotMatch(content, /hasRootedFoodKiller/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(input);
});

test('p091 through p093 retain the rootless Bing-Shen handoff locally when the killer is only concealed', () => {
 const date = [1896, 8, 11], natal = ['丙申', '丙申', '丙申', '丙申'];
 for (const [hour, hourPillar, year, isSource] of [[16, '丙申', 1938, true], [10, '癸巳', 1937, false]]) {
  const {run, fact, paths} = submittedCalendar({date, hour, year, luck: '辛卯', gender: 0,
   natal: [...natal.slice(0, 3), hourPillar]});
  const handoff = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '辛卯');
  const previous = rows(run).find(row => row.normalizedPayload.luckPillar === '壬辰' && row.activeTo === handoff?.exactInstant);
  assert.ok(handoff && previous);
  assert.equal(fact.activeFrom, handoff.exactInstant);
  assert.equal(fact.normalizedPayload.noSeal, true);
  assert.ok(paths.supportsDay.some(({moving, day}) => moving.stem === '乙' && day.stem === '丙'));
  assert.ok(paths.wealthFeedsKiller.some(({from, to}) => from.stem === '辛' && to.position === 'month' && to.stem === '壬'));
  assert.equal(fact.normalizedPayload.strongFoodKillerExcluded, isSource);
  assert.equal(previous.normalizedPayload.foodLuckPaths.bingShenReviewedSealAid?.length ?? 0, 0);
  assert.equal(paths.bingShenReviewedSealAid?.length ?? 0, isSource ? 1 : 0);
  assert.equal(fact.normalizedPayload.hasMonthFoodChecksExposedKiller, false);
  if (isSource) {
   const evidence = paths.rootlessBingShenSource;
   assert.deepEqual([evidence.monthFood.position, evidence.monthFood.stem, evidence.day.stem], ['month', '戊', '丙']);
   assert.deepEqual(evidence.killerSeats.map(row => [row.position, row.stem, row.kind]), [
    ['year', '壬', '支藏'], ['month', '壬', '支藏'], ['day', '壬', '支藏'], ['hour', '壬', '支藏'],
   ]);
   const [support] = paths.bingShenReviewedSealAid;
   assert.deepEqual([support.moving.kind, support.moving.stem, support.killer.position, support.killer.stem, support.food.stem, support.day.stem],
    ['运支藏干', '乙', 'month', '壬', '戊', '丙']);
  } else {
   assert.equal(paths.rootlessBingShenSource, undefined);
   assert.ok(fact.normalizedPayload.roots.find(row => row.stem === '丙')?.roots.some(row =>
    row.position === 'hour' && row.pillar === '癸巳' && row.exactStem));
  }
  const matches = matchFortuneKnowledge(run).byMethod.bazi;
  assert.equal(matches[133].status, 'not_matched');
  assert.ok(!matches[133].sourceFactIds.includes(fact.factId));
  assert.ok(previous.normalizedPayload.foodLuckPaths.secondarySealRescue.some(row =>
   row.moving.stem === '乙' && row.moving.kind === '运支藏干'));
  assert.ok(!matches[133].sourceFactIds.includes(previous.factId));
  assert.equal(matches[134].status, 'not_matched');
  assert.equal(matches[135].status, 'not_matched');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'rootless-bing-shen-audit'));
  const detail = '徐乐吾在卷二明确判这组丙火无根为身弱';
  assert.equal(formatFortuneFactAudit(input).includes(detail), isSource);
  assert.equal(/只有支藏七杀，留作本地对照/u.test(formatFortuneFactAudit(input)), isSource);
  assert.ok(!formatFortunePrompt(input).includes(detail));
  assert.doesNotMatch(formatFortunePrompt(input), /唯有印運最利，比劫亦利|bingShenReviewedSealAid/u);
 }
 const unknown = ctx(Object.fromEntries(['year', 'month', 'day', 'hour'].map((position, index) => [position, natal[index]])), '辛卯', false);
 assert.equal(unknown.foodLuckPaths?.rootlessBingShenSource, undefined);
 assert.equal(unknown.foodLuckPaths?.bingShenReviewedSealAid, undefined);
 assert.equal(unknown.hasMonthFoodChecksExposedKiller, undefined);
});

test('p093 retains the three Hu authority stages and the minor Gui component without admitting the strong-killer branch', () => {
 const calendar = { date: [1958, 10, 26], hour: 20, gender: 1, natal: ['戊戌', '壬戌', '丙子', '戊戌'] };
 const jia = submittedCalendar({ ...calendar, year: 1972, luck: '甲子' });
 const transition = jia.run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '甲子');
 const gui = rows(jia.run).find(row => row.activeTo === transition?.exactInstant && row.normalizedPayload.luckPillar === '癸亥');
 assert.ok(gui && transition);
 assert.ok([gui, jia.fact].every(row => row.normalizedPayload.hasMonthFoodChecksExposedKiller));
 assert.equal(gui.activeTo, transition.exactInstant);
 assert.equal(jia.fact.activeFrom, transition.exactInstant);
 assert.deepEqual(gui.normalizedPayload.foodLuckPaths.huAuthority.map(link => [link.moving.stem, link.moving.kind]),
  [['癸', '运干'], ['壬', '运支藏干']]);
 assert.ok(gui.normalizedPayload.foodLuckRoutes.includes('hu-authority-contrast'));
 assert.deepEqual(gui.normalizedPayload.foodLuckPaths.wealthFeedsKiller, []);
 assert.deepEqual(gui.normalizedPayload.foodLuckPaths.sealRescue, []);
 assert.equal(gui.normalizedPayload.hasHuStemSealTriplet, false);
 assert.deepEqual(jia.paths.huAuthority.map(link => [link.moving.stem, link.moving.kind]), [['癸', '运支藏干']]);
 assert.equal(jia.fact.normalizedPayload.hasHuStemSealTriplet, true);
 const exactTriplet = ({ killer, food, day, moving }) => [killer.position, killer.stem, food.position, food.stem, day.stem, moving.kind, moving.stem];
 assert.deepEqual(exactTriplet(jia.paths.huStemSealTriplet), ['month', '壬', 'month', '戊', '丙', '运干', '甲']);
 const original = match(jia.run, 135);
 assert.equal(original.status, 'matched');
 assert.ok([gui, jia.fact].every(fact => original.sourceFactIds.includes(fact.factId)));
 const yi = submittedCalendar({ ...calendar, year: 1985, luck: '乙丑' });
 assert.deepEqual(exactTriplet(yi.paths.huStemSealTriplet), ['month', '壬', 'month', '戊', '丙', '运干', '乙']);
 assert.deepEqual(yi.paths.huAuthority.map(link => [link.moving.stem, link.killer.stem, link.killer.position, link.day.stem]),
  [['癸', '壬', 'month', '丙']]);
 assert.ok(yi.paths.outputChecksKiller.length);
 assert.equal(match(yi.run, 134).status, 'not_matched');
 assert.equal(match(yi.run, 135).status, 'matched');
 assert.ok(match(yi.run, 135).sourceFactIds.includes(yi.fact.factId));
 const altered = submittedCalendar({ ...calendar, year: 1970, luck: '癸亥', hour: 18, natal: [...calendar.natal.slice(0, 3), '丁酉'] });
 assert.deepEqual(altered.paths.huAuthority, []);
 assert.equal(altered.fact.normalizedPayload.hasHuStemSealTriplet, false);
 assert.ok(altered.paths.secondarySealRescue.some(row => row.moving.stem === '甲' && row.killer.stem === '壬'));
 assert.equal(match(altered.run, 135).status, 'partial');
 assert.ok(match(altered.run, 135).sourceFactIds.includes(altered.fact.factId));
 const { input } = buildFortuneModelContext(jia.run, interpretFortune(jia.run, requestForFortuneRun(jia.run), 'hu-transition'));
 const cited = input.facts.filter(row => row.type === 'zpqz_food_killer_context');
 assert.ok(cited.some(row => row.data.luckPillar === '癸亥' && row.endExclusive === transition.exactInstant));
 assert.ok(cited.some(row => row.data.luckPillar === '甲子' && row.start === transition.exactInstant));
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('癸亥运干癸（正官）与原局月柱壬戌透干壬（七杀）同属水'));
 assert.ok(prompt.includes('甲子运支藏干癸（正官）与原局月柱壬戌透干壬（七杀）同属水'));
 assert.doesNotMatch(prompt, /huAuthority|hu-authority-contrast/u);
 const provider = formatFortunePrompt(input);
 assert.match(provider, /〈论食神〉另明示此原图日元不旺、宜印忌财/u);
 assert.match(provider, /本步实际明透甲或乙运印，承同一原月壬杀所生/u);
 assert.equal(provider.match(/原文：食傷制煞太過/gu)?.length, 1);
 assert.doesNotMatch(provider, /丙寅或丁卯|戊辰最忌|huStemSealTriplet/u);
 const stemBranch = original.confirmedBranches.find(branch => branch.sourceFactIds.includes(jia.fact.factId)
  && !branch.sourceFactIds.includes(gui.factId));
 assert.ok(stemBranch);
 assert.equal(stemBranch.windows[0].start, transition.exactInstant);
});

test('p093 keeps the actual wealth-to-killer contact while excluding Hu’s printed wealth warning', () => {
 const calendar = { date: [1958, 10, 26], year: 2032, gender: 1, luck: '庚午' };
 for (const [hour, hourPillar, start, hu] of [
  [20, '戊戌', '2032-12-17T10:00:00.000Z', true],
  [18, '丁酉', '2032-12-27T08:00:00.000Z', false],
 ]) {
  const { run, fact, paths } = submittedCalendar({ ...calendar, hour, natal: ['戊戌', '壬戌', '丙子', hourPillar] });
  const before = rows(run).find(row => row.activeTo === start && row.normalizedPayload.luckPillar === '己巳');
  assert.ok(before);
  assert.equal(fact.activeFrom, start);
  assert.equal(paths.huOvercontrol, hu);
  assert.deepEqual(paths.wealthFeedsKiller.map(({ from, to }) => [from.kind, from.stem, to.position, to.stem]),
   [['运干', '庚', 'month', '壬']]);
  assert.ok(fact.normalizedPayload.foodLuckRoutes.includes('wealth-feeds-killer'));
  assert.equal(fact.normalizedPayload.foodLuckRoutes.includes('wealth-remedies-overcontrol'), !hu);
  const contrast = match(run, 135);
  assert.equal(contrast.status, hu ? 'not_matched' : 'partial');
  assert.equal(contrast.sourceFactIds.includes(fact.factId), !hu);
  assert.equal(match(run, 134).sourceFactIds.includes(fact.factId), !hu);
 }
});

test('p091 and p093 accept the same secondary seal reaching the killer, food and day after the real luck transition', () => {
 const calendar = { date: [1975, 2, 5], hour: 12, gender: 1, year: 2005, luck: '甲戌', natal: ['乙卯', '戊寅', '壬午', '丙午'] };
 const { run, fact, paths } = submittedCalendar(calendar);
 const entry = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '甲戌');
 const previous = rows(run).find(row => row.activeTo === entry.exactInstant);
 assert.equal(previous.normalizedPayload.luckPillar, '乙亥');
 assert.equal(fact.activeFrom, entry.exactInstant);
 assert.deepEqual(paths.sealRescue, []);
 assert.ok(paths.secondarySealRescue.some(({ killer, food, moving, day }) => killer.stem === '戊' && killer.kind === '透干'
  && food.position === 'month' && food.stem === '甲' && moving.stem === '辛' && day.stem === '壬'));
 assert.deepEqual(previous.normalizedPayload.foodLuckPaths.secondarySealRescue, []);
 for (const index of [133,135]) {
  const hit = match(run, index);
  assert.equal(hit.status, 'partial');
  assert.ok(hit.sourceFactIds.includes(fact.factId));
  const withoutSecondarySeal = run.facts.map(row => row.factType === fact.factType && row.normalizedPayload.luckPillar === '甲戌'
   ? { ...row, normalizedPayload: { ...row.normalizedPayload, foodLuckRoutes: row.normalizedPayload.foodLuckRoutes
    .filter(route => route !== 'secondary-seal-contacts-food-killer-and-day') } } : row);
  assert.ok(!match({ ...run, facts: withoutSecondarySeal }, index).sourceFactIds.includes(fact.factId));
 }
 const variant = submittedCalendar({ ...calendar, hour: 16, natal: [...calendar.natal.slice(0, 3), '戊申'] });
 assert.equal(variant.fact.normalizedPayload.noSeal, false);
 assert.deepEqual(variant.paths.secondarySealRescue, []);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'secondary-seal-rescue'));
 assert.ok(formatFortuneFactAudit(input).includes('另核运支余藏印本步大运甲戌运支藏干辛'));
 assert.ok(!formatFortunePrompt(input).includes('另核运支余藏印'));
});

test('twelve independently transcribed source diagrams retain column order and valid year-month and day-hour stem pairs',()=>{
 assert.deepEqual(zpqzFoodKillerCases,ref.printedCases);assert.equal(ref.printedCases.length,12);
 for(const c of ref.printedCases){const r=ctx(native(c.pillars)).printedCases.find(row=>row.id===c.id);assert.equal(r.matches,true);assert.equal(r.stemCheck.yearMonthCompatible,true);assert.equal(r.stemCheck.dayHourCompatible,true);}
});

test('all three food-killer branches require the shared absence of both visible and concealed seals',()=>{
 const p=ctx();assert.equal(p.monthFoodCandidate,true);assert.equal(p.killerPresent,true);assert.equal(p.noSeal,true);assert.equal(p.foodKillerNoSeal,true);
 const withHiddenSeal=ctx({...printed('hu'),hour:'乙亥'});assert.equal(withHiddenSeal.noSeal,false);assert.equal(withHiddenSeal.foodKillerNoSeal,false);assert.ok(withHiddenSeal.sealRows.some(r=>r.kind==='支藏'));
 for(const i of [133,134,135]) {
  assert.equal(fortuneKnowledge.bazi.rules[i].queries[0].where.noSeal,true);
  assert.equal(fortuneKnowledge.bazi.rules[i].queries[0].where.hasMonthFoodChecksExposedKiller,true);
 }
 assert.equal(ctx(printed('chang')).noSeal,false);
});

test('unknown hour cannot establish no-seal, full diagram or negative hidden-root claims, while an already known seal remains positive',()=>{
 const p=ctx(printed('hu'),'甲寅',false);assert.equal(p.noSeal,undefined);assert.equal(p.foodKillerNoSeal,undefined);assert.equal(p.printedCases.find(c=>c.id==='hu').matches,undefined);
 assert.ok([...p.foodRows,...p.hurtRows,...p.sealRows].every(r=>r.position!=='hour'));
 assert.equal(ctx(printed('chang'),'甲寅',false).noSeal,false);
});

test('Hu hidden Xin wealth survives the no-seal premise and is never erased by the conflicting source wealth-luck commentary',()=>{
 const p=ctx();assert.equal(p.noSeal,true);assert.equal(p.wealthPresent,true);assert.equal(p.wealthExposed,false);
 assert.equal(p.wealthRows.filter(r=>r.stem==='辛'&&r.kind==='支藏').length,3);
 assert.equal(p.strengthVerified,false);assert.equal(p.remedyVerified,false);assert.equal(p.transformationVerified,false);
});

test('the exposed Ji wealth rescue example separates absent exact-Ji roots from actual same-element Wu in Yin and Shen',()=>{
 const p=ctx(printed('wealth-rescue'));const root=p.roots.find(r=>r.stem==='己');assert.ok(root);assert.ok(root.roots.length);assert.ok(root.roots.every(r=>!r.exactStem));
 assert.ok(p.wealthRows.some(r=>r.stem==='己'&&r.kind==='透干'));assert.ok(p.wealthRows.some(r=>r.stem==='戊'&&r.kind==='支藏'));
 assert.equal(p.remedyVerified,false);
});

test('Liang full wood members, Shen partial members and original-versus-moving Ren/Ding combinations remain separate',()=>{
 const liang=ctx(printed('liang'),'壬子'),shen=ctx(printed('shen'),'己未');assert.equal(liang.woodCompleteNatal,true);assert.equal(shen.woodCompleteNatal,false);assert.equal(shen.woodCompleteWithLuck,true);
 assert.equal(liang.natalRenDingWealthPairs.length,0);assert.ok(liang.movingFivePairs.some(p=>p.moving.stem==='壬'&&p.target.stem==='丁'));
 const changed=ctx({...printed('liang'),hour:'壬子'});assert.ok(changed.natalRenDingWealthPairs.length);assert.equal(changed.transformationVerified,false);
});

test('Liang natal Ren counterfactual excludes the fire wealth path at the actual Jia-Wu handoff', () => {
 const date = [1907, 3, 15], year = 1989, cut = '1989-11-06T10:00:00.000Z';
 const run = submitted({ date, hour: 0, year });
 const before = rows(run).find(row => row.activeTo === cut && row.normalizedPayload.luckPillar === '乙未');
 const after = rows(run).find(row => row.activeFrom === cut && row.normalizedPayload.luckPillar === '甲午');
 assert.ok(before && after);
 assert.equal(before.normalizedPayload.hasLiangSourceRenCounterfactualFireWealth, false);
 const p = after.normalizedPayload;
 assert.deepEqual(p.natalPillars.map(row => row.pillar), ['丁未', '癸卯', '癸亥', '壬子']);
 assert.equal(p.hasLiangSourceRenCounterfactualFireWealth, true);
 const proof = p.foodLuckPaths.liangSourceRenCounterfactual;
 assert.deepEqual([proof.natalWealthCombination.first, proof.natalWealthCombination.second].map(row => [row.position, row.stem]),
  [['year', '丁'], ['hour', '壬']]);
 assert.ok(proof.woodMembers.every(row => row.natalPositions.length));
 assert.deepEqual(proof.fireWealth.map(({ from, to }) => [from.position, from.stem, to.kind, to.stem]),
  [['month', '乙', '运支藏干', '丁']]);
 assert.deepEqual(proof.movingDaySupport, []);
 const scoped = { ...run, facts: [after] };
 const priorRule = { ...scoped, facts: [{ ...after, normalizedPayload: { ...p, hasLiangSourceRenCounterfactualFireWealth: false } }] };
 assert.equal(match(priorRule, 131).status, 'partial');
 assert.equal(match(scoped, 131).status, 'excluded');
 assert.equal(match({ ...run, facts: [before] }, 131).status, 'partial');
 const { input } = buildFortuneModelContext(scoped,
  interpretFortune(scoped, requestForFortuneRun(scoped), 'liang-ren-counterfactual'));
 const auditPhrase = /梁图反设的原局时壬合年丁，按徐注另看火财/u;
 assert.match(formatFortuneFactAudit(input), auditPhrase);
 assert.doesNotMatch(formatFortunePrompt(input), auditPhrase);
 const original = submittedCalendar({ date, hour: 2, year, luck: '甲午', natal: ['丁未', '癸卯', '癸亥', '癸丑'] });
 assert.equal(original.fact.normalizedPayload.hasLiangSourceRenCounterfactualFireWealth, false);
 assert.equal(match({ ...original.run, facts: [original.fact] }, 131).matchedSourceExcerpt, '身重喜行財食');
 const mixed = ctx({ ...printed('liang'), hour: '壬子' }, '丁酉');
 assert.equal(mixed.hasLiangSourceRenCounterfactualFireWealth, false);
 assert.ok(mixed.foodLuckPaths.liangSourceRenCounterfactual.fireWealth.length > 0);
 assert.ok(mixed.foodLuckPaths.liangSourceRenCounterfactual.movingDaySupport.length > 0);
 assert.equal(ctx({ ...printed('liang'), hour: '壬子' }, '甲午', false).hasLiangSourceRenCounterfactualFireWealth, undefined);
});

test('Shu and Qian chapter names never rename actual ten gods, and summer wood without a seal stays distinct from already carrying a seal',()=>{
 const shu=ctx(printed('shu'));assert.equal(shu.winterMetalWaterFoodCandidate,true);assert.ok(shu.hurtRows.some(r=>r.stem==='壬'&&r.kind==='透干'));assert.ok(shu.killerRows.some(r=>r.stem==='丁'&&r.kind==='透干'));assert.ok(shu.foodRows.some(r=>r.stem==='癸'&&r.position==='month'));
 const qian=ctx(printed('qian')),huang=ctx(printed('huang'));assert.ok(qian.foodRows.some(r=>r.stem==='丙'&&r.kind==='透干'));assert.equal(qian.hurtExposed,false);assert.equal(qian.summerWood,true);assert.equal(qian.sealsPresent,true);assert.equal(huang.summerWood,true);assert.equal(huang.noSeal,true);
 for(const p of [shu,qian,huang])assert.equal(p.climateVerified,false);
});

test('Liu wealth-before-food-before-killer retains named endpoints and the intervening month and day instead of assuming effective control',()=>{
 const p=ctx(printed('liu')),pair=p.wealthKillerPairs.find(r=>r.from.position==='year'&&r.from.kind==='透干'&&r.to.position==='hour'&&r.to.kind==='透干');
 assert.ok(pair);assert.equal(pair.from.stem,'癸');assert.equal(pair.to.stem,'乙');assert.equal(pair.columnDistance,3);assert.deepEqual(pair.between.map(r=>r.position),['month','day']);
 assert.ok(p.foodKillerPairs.some(r=>r.from.position==='month'&&r.from.stem==='辛'&&r.to.position==='hour'&&r.to.stem==='乙'));
 assert.equal(p.remedyVerified,false);
});

test('eight modern calendars retain verified facts and a winter analogue cannot match the named Shu reading',()=>{
 for(const i of indices){const run=real(i),e=ref.calendarExamples[i];validateFortuneFacts(run);assert.equal(match(run,i).status,[132,138].includes(i)?'not_matched':'partial',String(i));
  const selected=rows(run).filter(f=>f.normalizedPayload.confirmed&&f.normalizedPayload.luckPillar===e.luck);assert.ok(selected.length,String(i));
  for(const f of selected){assert.deepEqual(f.normalizedPayload.natalPillars.map(p=>p.pillar),e.natal);assert.ok(f.normalizedPayload.stageStart<=f.activeFrom&&f.activeTo<=f.normalizedPayload.stageEnd);assert.ok(f.sourceFactIds.every(id=>run.rawFacts.some(r=>r.rawFactId===id)));}
 }
});

test('generic, wrong-profile and split no-seal/killer premises cannot satisfy one source condition by combining different facts',()=>{
 const absent=structuredClone(real(133));absent.facts=absent.facts.filter(f=>f.factType!=='zpqz_food_killer_context');assert.equal(match(absent,133).status,'unknown');
 const wrong=structuredClone(real(133));rows(wrong).forEach(f=>f.normalizedPayload.profile='other');assert.equal(match(wrong,133).status,'not_matched');
 const split=structuredClone(real(133));for(const f of rows(split)){const other=structuredClone(f);other.factId+='-other';other.normalizedPayload.noSeal=false;f.normalizedPayload.killerPresent=false;split.facts.push(other);}assert.equal(match(split,133).status,'not_matched');
});

test('all eight source hashes retain their own coverage boundaries in SQLite',()=>{
 for(const i of indices){const r=fortuneKnowledge.bazi.rules[i],e=fortuneKnowledge.bazi.entries.find(e=>e.id===r.knowledgeId);assert.equal(r.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:e.evidence,conditions:e.conditions})).digest('hex'));assert.equal(r.queries.length,1);assert.equal(r.queries[0].factType,'zpqz_food_killer_context');assert.equal(r.unresolved.length,[132,138].includes(i)?0:1);}
 const p=rows(real(136)).find(f=>f.normalizedPayload.luckPillar==='己亥').normalizedPayload;assert.equal(p.luckTenGod,'正财');assert.equal(p.luckBranchMainQiGod,'偏印');assert.equal(match(real(136),136).status,'partial');
});

test('five printed cases bind named luck readings to exact natal columns and the verified active period in SQLite', async () => {
  const cases = [
    ['liang', [1907, 3, 15], 2, 1959, '戊戌', 131, '列作有波折的一运', false],
    ['gong', [1894, 3, 12], 8, 1948, '壬申', 132, '列作原例较得助的运步', false],
    ['hu', [1958, 10, 26], 20, 2012, '戊辰', 135, '列作加重土势的取忌运步', false],
    ['qian', [1906, 5, 20], 4, 1952, '丁酉', 136, '列作原例适宜的运步', true],
    ['shu', [1947, 12, 28], 18, 1988, '戊申', 138, '作为印劫运的平常对照', true],
  ];
  for (const [id, date, hour, year, luck, ruleIndex, assessment, independent] of cases) {
    const run = submitted({ date, hour, year });
    const source = ref.printedCases.find(row => row.id === id);
    const selected = rows(run).filter(row => row.normalizedPayload.luckPillar === luck);
    assert.ok(selected.length, id);
    for (const fact of selected) {
      const p = fact.normalizedPayload;
      assert.equal(p.confirmed, true);
      assert.deepEqual(p.natalPillars.map(row => row.pillar), source.pillars);
      assert.deepEqual(p.printedLuckCaseIds, [id]);
      assert.deepEqual(p.printedLuck.map(row => [row.id, row.assessment]), [[id, assessment]]);
      assert.ok(p.stageStart <= fact.activeFrom && fact.activeTo <= p.stageEnd);
      if (id === 'hu') {
        assert.equal(p.namedHuEarthWarning, true);
        assert.ok(p.foodLuckRoutes.includes('secondary-seal-contacts-food-killer-and-day'));
        assert.ok(p.foodLuckPaths.secondarySealRescue.some(row => row.moving.stem === '乙'));
      }
      if (id === 'qian') {
        const seal = p.foodClimateEvidence.qianLuck;
        assert.deepEqual([seal.seal.stem, seal.lu.pillar, seal.branchFeedsSeal.stem], ['癸', '甲子', '辛']);
      }
    }
    const hit = match(run, ruleIndex);
    assert.equal(hit.status, 'matched', id);
    assert.ok(selected.every(fact => hit.sourceFactIds.includes(fact.factId) === (id !== 'liang')));
    if (id === 'liang') {
      const entry = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丁酉');
      const after = rows(run).find(row => row.normalizedPayload.luckPillar === '丁酉' && row.activeFrom === entry?.exactInstant);
      assert.ok(after && selected.every(row => row.activeTo <= entry.exactInstant));
      assert.ok(hit.sourceFactIds.includes(after.factId));
      assert.equal(hit.windows[0].start, entry.exactInstant);
      assert.equal(hit.candidateWindows.at(-1).endExclusive, entry.exactInstant);
      assert.equal(hit.matchedSourceExcerpt, '身重喜行財食');
      assert.ok(after.normalizedPayload.foodLuckRoutes.includes('liang-reviewed-food-wealth'));
      assert.equal(after.normalizedPayload.foodSealRemedySourceExcluded, true);
      assert.ok(after.normalizedPayload.foodLuckRoutes.includes('wealth-reaches-food-controlling-seal'));
      assert.deepEqual(after.normalizedPayload.foodLuckPaths.monthFoodFeedsLuckWealth.map(({ from, to }) => [from.stem, to.stem]),
       [['乙', '丁']]);
      assert.ok(!ctx({ ...printed('liang'), hour: '壬子' }, '丁酉').foodLuckRoutes.includes('liang-reviewed-food-wealth'));
    }
    if (id === 'liang' || id === 'gong') {
      assert.ok(selected.every(({ normalizedPayload: p }) => p.foodSealRemedySourceExcluded
       && p.foodLuckRoutes.includes('seal-or-authority-against-food-remedy')));
      assert.equal(match(run, 137).status, 'not_matched');
      const wrongHour = { ...printed(id), hour: id === 'liang' ? '壬子' : '乙卯' };
      assert.equal(ctx(wrongHour, luck).foodSealRemedySourceExcluded, false);
      assert.equal(ctx(printed(id), luck, false).foodSealRemedySourceExcluded, undefined);
      if (id === 'gong') {
        const close = submittedCalendar({ date, hour: 6, year, gender: 1, luck, natal: Object.values(wrongHour) });
        const candidate = match(close.run, 137);
        assert.equal(candidate.status, 'partial');
        assert.ok(candidate.sourceFactIds.includes(close.fact.factId));
      }
    }
    if (id === 'qian') {
      const entry = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊戌');
      const opposite = rows(run).find(row => row.normalizedPayload.luckPillar === '戊戌' && row.activeFrom === entry?.exactInstant);
      assert.ok(opposite && selected.every(row => row.activeTo <= entry.exactInstant));
      assert.ok(!hit.sourceFactIds.includes(opposite.factId));
      assert.equal(hit.windows.at(-1).endExclusive, entry.exactInstant);
      assert.equal(hit.candidateWindows[0].start, entry.exactInstant);
      assert.equal(hit.matchedSourceExcerpt, '夏木見火，火旺木焚，運喜印綬');
    }
    if (id === 'hu') {
      const handoff = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊辰');
      assert.ok(handoff);
      const previous = rows(run).find(row => row.activeTo === handoff.exactInstant && row.normalizedPayload.luckPillar === '丁卯');
      assert.ok(previous);
      assert.equal(previous.normalizedPayload.namedHuEarthWarning, false);
      assert.ok(previous.normalizedPayload.foodLuckRoutes.includes('hu-reviewed-luck'));
      assert.ok(previous.normalizedPayload.foodLuckRoutes.includes('hu-fire-wood-support'));
      const fireSeal = previous.normalizedPayload.foodLuckPaths.huSealTriplet;
      assert.deepEqual([fireSeal.moving.stem, fireSeal.killer.stem, fireSeal.food.stem, fireSeal.day.stem], ['乙', '壬', '戊', '丙']);
      const supportSource = hit.confirmedBranches.find(branch => branch.sourceFactIds.includes(previous.factId));
      const earthSource = hit.confirmedBranches.find(branch => selected.some(fact => branch.sourceFactIds.includes(fact.factId)));
      assert.ok(supportSource && earthSource && supportSource !== earthSource);
      assert.equal(supportSource.windows.at(-1).endExclusive, handoff.exactInstant);
      assert.equal(earthSource.windows[0].start, handoff.exactInstant);
      assert.ok(earthSource.sourceFactIds.every(id => !supportSource.sourceFactIds.includes(id)));
      const support = match(run, 133);
      assert.equal(support.status, 'partial');
      assert.ok(support.sourceFactIds.includes(previous.factId) && selected.every(fact => !support.sourceFactIds.includes(fact.factId)));
      assert.equal(support.windows.at(-1).endExclusive, handoff.exactInstant);
      assert.equal(ctx(printed('hu'), '戊辰', false).namedHuEarthWarning, undefined);
    }
    const structural = structuredClone(run);
    rows(structural).forEach(fact => { fact.normalizedPayload.printedLuckCaseIds = []; });
    assert.equal(match(structural, ruleIndex).status, independent ? 'not_matched' : 'matched', id);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'case-luck'));
    assert.ok(formatFortuneFactAudit(input).includes('将所核的' + luck + '运' + assessment));
    assert.ok(input.sections.some(section => section.findings.some(finding => finding.knowledgeId === hit.knowledgeId)));
    if (id === 'liang') {
      const message = formatFortunePrompt(input);
      assert.match(message, /梁丞相原图亥卯未齐/u);
      assert.doesNotMatch(message, /实际戊戌则单列|列作有波折的一运/u);
    }
    if (id === 'qian') {
      const audit = formatFortuneFactAudit(input);
      assert.match(audit, /列作土财可能损及水印的运步/u);
      const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
        const message = JSON.parse(options.body).messages[1].content;
        assert.match(message, /钱参政原图甲日巳月/u);
        assert.match(message, /夏木見火，火旺木焚，運喜印綬/u);
        assert.doesNotMatch(message, /列作土财可能损及水印的运步|李君原图/u);
        return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
      } });
      await provider.interpret(input);
    }
  }
});

test('summer wood retains the water-to-wood and water-to-fire contacts and the original no-seal Huang comparison', () => {
 const ordinary = submittedCalendar(ref.calendarExamples[136]);
 const paths = ordinary.fact.normalizedPayload.foodClimateEvidence;
 assert.ok(paths.summerWater.some(value => value.moving.kind === '运支藏干' && value.moving.stem === '壬'
  && value.day.stem === '甲' && value.fire.stem === '丙'));
 assert.ok(paths.nativeWaterSeals.some(row => row.kind === '透干' && row.position === 'month' && row.stem === '癸'));
 assert.equal(match(ordinary.run, 136).status, 'partial');
 const huang = submittedCalendar(ref.huangCalendar), data = huang.fact.normalizedPayload;
 assert.equal(data.noSeal, true);
 assert.deepEqual(data.foodClimateEvidence.nativeWaterSeals, []);
 assert.deepEqual(data.foodClimateEvidence.summerWater, []);
 assert.deepEqual(data.foodClimateEvidence.huangSupport.map(row => [row.moving.stem, row.moving.kind, row.relation]),
  [['乙', '运干', '同五行']]);
 const change = huang.run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '甲子');
 assert.ok(change);
 const hit = match(huang.run, 136);
 assert.ok(hit.sourceFactIds.includes(huang.fact.factId));
 const previous = rows(huang.run).find(row => row.normalizedPayload.luckPillar === '乙丑' && row.activeTo === change.exactInstant);
 const next = rows(huang.run).find(row => row.normalizedPayload.luckPillar === '甲子' && row.activeFrom === change.exactInstant);
 assert.ok(previous && next);
 assert.ok([previous, next].every(row => hit.sourceFactIds.includes(row.factId)));
 const qian = submitted({ date: [1906, 5, 20], hour: 4, year: 1954 });
 const counter = rows(qian).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '戊戌');
 assert.ok(counter);
 const evidence = counter.normalizedPayload.foodClimateEvidence.qianLuck;
 assert.deepEqual([evidence.wealthAttacksSeal.stem, evidence.seal.stem, evidence.wealthCombinesSeal], ['戊', '癸', true]);
 const warning = match(qian, 136);
 assert.equal(warning.status, 'partial');
 assert.ok(warning.sourceFactIds.includes(counter.factId));
 const bingShen = submittedCalendar({ date: [1906, 5, 20], hour: 4, gender: 1, year: 1937, luck: '丙申',
  natal: ['丙午', '癸巳', '甲子', '丙寅'] });
 assert.equal(bingShen.fact.normalizedPayload.foodClimateEvidence.qianLuck.branchFeedsSeal.stem, '庚');
 assert.equal(match(bingShen.run, 136).status, 'matched');
});

test('p094 reaches the Li fire-day comparison and changes from actual wealth to actual authority at the verified boundary', () => {
 const calendar = { date: [1898, 7, 12], hour: 4, gender: 1, natal: ['戊戌', '己未', '丙子', '庚寅'] };
 const { run, fact } = submittedCalendar({ ...calendar, year: 1927, luck: '壬戌' });
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '壬戌');
 const previous = rows(run).find(row => row.normalizedPayload.luckPillar === '辛酉' && row.activeTo === transition?.exactInstant);
 assert.ok(previous && transition);
 assert.equal(fact.activeFrom, transition.exactInstant);
 assert.equal(fact.normalizedPayload.summerWood, false);
 const oldLi = previous.normalizedPayload.foodClimateEvidence.liLuck;
 const newLi = fact.normalizedPayload.foodClimateEvidence.liLuck;
 assert.deepEqual([oldLi.day.stem, oldLi.seal.position, oldLi.seal.stem], ['丙', 'hour', '甲']);
 assert.deepEqual(oldLi.fireRoots.map(row => [row.position, row.stem]), [['hour', '丙'], ['year', '丁'], ['month', '丁']]);
 assert.ok(oldLi.earthFeedsWealth.some(link => link.from.position === 'month' && link.from.stem === '己'
  && link.to.stem === '辛' && link.to.kind === '运支藏干'));
 assert.deepEqual(newLi.earthFeedsWealth, []);
 assert.deepEqual(newLi.waterChecksDay.map(link => [link.from.stem, link.from.kind, link.to.stem]), [['壬', '运干', '丙']]);
 const hit = match(run, 136);
 assert.equal(hit.status, 'partial');
 assert.ok([previous, fact].every(row => hit.sourceFactIds.includes(row.factId)));
 const geng = submittedCalendar({ ...calendar, year: 1912, luck: '庚申' });
 assert.ok(geng.fact.normalizedPayload.foodClimateEvidence.liLuck.earthFeedsWealth.some(link =>
  link.from.stem === '戊' && link.from.position === 'year' && link.to.stem === '庚' && link.to.kind === '运干'));
 assert.equal(match(geng.run, 136).status, 'partial');
 assert.ok(match(geng.run, 136).sourceFactIds.includes(geng.fact.factId));
 const altered = submittedCalendar({ ...calendar, hour: 2, year: 1925, luck: '辛酉', natal: [...calendar.natal.slice(0, 3), '己丑'] });
 assert.equal(altered.fact.normalizedPayload.foodClimateEvidence.liLuck, undefined);
 assert.equal(match(altered.run, 136).status, 'not_matched');
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'li-earth-contrast'));
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('李例的原局土食伤泄给运财的位置'));
 assert.ok(prompt.includes('李例按原评另查的运水官杀克身位置'));
 assert.ok(input.sections.every(section => section.findings.every(finding => finding.knowledgeId !== hit.knowledgeId)));
 assert.doesNotMatch(formatFortunePrompt(input), /钱参政原图甲日巳月|夏木見火，火旺木焚，運喜印綬/u);
});

test('p094 separates the printed summer Jia fire layouts, natal seal requirement and damp Chen seat', () => {
 const examples = [
  { date: [1902, 6, 20], hour: 6, year: 1926, luck: '癸卯', formation: 'yin-wu-xu',
    natal: ['壬寅', '丙午', '甲戌', '丁卯'], bothFire: true, hasSeal: true },
  { date: [1902, 6, 20], hour: 4, year: 1927, luck: '癸卯', formation: 'yin-wu-xu',
    natal: ['壬寅', '丙午', '甲戌', '丙寅'], bothFire: false, hasSeal: true },
  { date: [1917, 6, 21], hour: 10, year: 1964, luck: '辛亥', formation: 'si-wu',
    natal: ['丁巳', '丙午', '甲午', '己巳'], bothFire: true, hasSeal: false },
  { date: [1917, 6, 21], hour: 8, year: 1964, luck: '辛亥',
    natal: ['丁巳', '丙午', '甲午', '戊辰'], hasSeal: true },
  { date: [1910, 6, 8], hour: 4, year: 1961, luck: '丙子', formation: 'yin-wu-xu',
    natal: ['庚戌', '壬午', '甲辰', '丙寅'], bothFire: false, hasSeal: true },
 ];
 for (const example of examples) {
  const {run, fact} = submittedCalendar({...example, gender: 0});
  const payload = fact.normalizedPayload;
  const {summerWater, summerFireSource, summerJiaReviewedWaterSeal} = payload.foodClimateEvidence;
  assert.ok(summerWater.some(({moving, day, fire}) => moving.element === '水' && day.stem === '甲' && fire.element === '火'));
  assert.equal(payload.sealsPresent, example.hasSeal);
  if (example.formation) {
   assert.equal(summerFireSource.formation, example.formation);
   assert.equal(summerFireSource.hasBothFireStems, example.bothFire);
   assert.deepEqual(summerFireSource.members.map(row => row.pillar), example.natal.filter(pillar =>
    (example.formation === 'si-wu' ? '巳午' : '寅午戌').includes(pillar[1])));
   assert.deepEqual(summerFireSource.dampChenDay, example.natal[2] === '甲辰' ? {position: 'day', pillar: '甲辰'} : undefined);
  } else assert.equal(summerFireSource, undefined);
  const hit = match(run, 136);
  const sourceBranch = example.formation === 'yin-wu-xu' && example.bothFire && example.hasSeal;
  assert.equal(payload.hasSummerJiaReviewedWaterSeal, sourceBranch);
  assert.equal(hit.status, sourceBranch ? 'matched' : example.hasSeal ? 'partial' : 'not_matched');
  assert.equal(hit.sourceFactIds.includes(fact.factId), example.hasSeal);
  if (sourceBranch) {
   const boundary = '1926-11-17T08:00:00.000Z';
   assert.equal(fact.activeFrom, boundary);
   assert.equal(hit.windows[0].start, boundary);
   assert.ok(rows(run).some(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '甲辰'
    && !row.normalizedPayload.hasSummerJiaReviewedWaterSeal));
   assert.deepEqual(summerJiaReviewedWaterSeal.map(row => [row.stem, row.kind]), [['癸', '运干']]);
   assert.equal(hit.matchedSourceExcerpt, '夏木見火，火旺木焚，運喜印綬');
   const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'summer-jia-verified-water'));
   const model = formatFortunePrompt(input);
   assert.match(model, /丙丁.*透/u);
   assert.doesNotMatch(model, /钱参政原图甲日巳月|hasSummerJiaReviewedWaterSeal/u);
  }
  if (example.natal[2] === '甲辰') {
   const {input} = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'summer-fire-audit'));
   const audit = formatFortuneFactAudit(input);
   assert.match(audit, /卷首甲木例核到原局寅午戌齐见.*丙丁并透的条件未齐/u);
   assert.match(audit, /日柱甲辰另核原书所说的辰湿土/u);
   assert.doesNotMatch(formatFortunePrompt(input), /卷首甲木例核到|辰湿土|summerFireSource/u);
  }
 }
});

test('p094 confirms the printed summer Yi Gui route until the actual shift to Ren', () => {
 const sourceBirth = Lunar.fromYmdHms(1877, 5, 1, 22, 0, 0).getSolar();
 const date = [sourceBirth.getYear(), sourceBirth.getMonth(), sourceBirth.getDay()];
 assert.deepEqual(date, [1877, 6, 11]);
 const natal = ['丁丑', '丙午', '乙卯', '丁亥'];
 const boundary = '1909-06-03T14:00:00.000Z';
 const run = submitted({date, hour: 22, gender: 1, year: 1909});
 const fact = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '癸卯');
 const before = fact.normalizedPayload;
 assert.deepEqual(before.natalPillars.map(row => row.pillar), natal);
 assert.equal(before.hasSummerYiReviewedWaterSeal, true);
 assert.equal(before.hasSummerJiaReviewedWaterSeal, false);
 const {gui, ren, xin, moving, fire, day} = before.foodClimateEvidence.summerYiReviewedWaterSeal;
 assert.deepEqual([gui.position, gui.pillar, gui.stem, ren.position, ren.pillar, ren.stem, xin.position, xin.stem],
  ['year', '丁丑', '癸', 'hour', '丁亥', '壬', 'year', '辛']);
 assert.deepEqual([moving.kind, moving.pillar, moving.stem, day.stem], ['运干', '癸卯', '癸', '乙']);
 assert.deepEqual(fire.map(row => [row.position, row.stem]), [['year', '丁'], ['hour', '丁'], ['month', '丙']]);
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '壬寅');
 assert.equal(after.normalizedPayload.hasSummerYiReviewedWaterSeal, false);
 assert.ok(after.normalizedPayload.foodLuckRoutes.includes('summer-water-to-wood-and-fire'));
 const hit = match(run, 136);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '夏木見火，火旺木焚，運喜印綬');
 assert.deepEqual(hit.windows, [{start: run.time.displayWindow.instantRange.startInstant, endExclusive: boundary}]);
 assert.ok(hit.sourceFactIds.includes(fact.factId));
 assert.ok(!hit.sourceFactIds.includes(after.factId));
 const promptFor = value => formatFortunePrompt(buildFortuneModelContext(value,
  interpretFortune(value, requestForFortuneRun(value), 'summer-yi-water')).input);
 assert.match(promptFor(run), /同一丑中癸水由实运干透出/u);
 assert.doesNotMatch(promptFor(run), /钱参政原图甲日巳月|hasSummerYiReviewedWaterSeal/u);
 const wrongHour = submittedCalendar({date, hour: 20, gender: 1, year: 1909, luck: '癸卯', natal: [...natal.slice(0, 3), '丙戌']});
 assert.equal(wrongHour.fact.normalizedPayload.hasSummerYiReviewedWaterSeal, false);
 assert.equal(match(wrongHour.run, 136).status, 'partial');
 assert.doesNotMatch(promptFor(wrongHour.run), /同一丑中癸水由实运干透出/u);
 assert.equal(ctx(native(natal), '癸卯', false).hasSummerYiReviewedWaterSeal, undefined);
});

test('p094 confirms the rooted summer Yi Gui route with actual fire branches and keeps incoming water under exposed earth pending', () => {
 const example = {date: [1902, 6, 11], hour: 20, gender: 0, year: 1924, luck: '癸卯',
  natal: ['壬寅', '丙午', '乙丑', '丙戌']};
 const {run, fact} = submittedCalendar(example);
 const boundary = '1924-01-19T22:00:00.000Z';
 assert.equal(fact.activeFrom, boundary);
 const prior = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '甲辰');
 assert.ok(prior);
 assert.equal(prior.normalizedPayload.hasSummerYiFireFormationWaterSeal, false);
 const evidence = fact.normalizedPayload.foodClimateEvidence.summerYiFireFormationWaterEvidence;
 assert.deepEqual(evidence.fireMembers.map(row => row.pillar), ['壬寅', '丙午', '丙戌']);
 assert.deepEqual(evidence.fire.map(row => [row.position, row.stem]), [['month', '丙'], ['hour', '丙']]);
 assert.deepEqual(evidence.roots.map(({gui, xin}) => [gui.position, gui.stem, xin.position, xin.stem]), [['day', '癸', 'day', '辛']]);
 assert.deepEqual([evidence.moving.stem, evidence.day.stem], ['癸', '乙']);
 assert.deepEqual(evidence.opposingEarth, []);
 assert.deepEqual(evidence.clashes, []);
 assert.equal(fact.normalizedPayload.hasSummerYiFireFormationWaterSeal, true);
 const hit = match(run, 136);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '夏木見火，火旺木焚，運喜印綬');
 assert.deepEqual(hit.windows, [{start: boundary, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive}]);
 assert.ok(hit.sourceFactIds.includes(fact.factId) && !hit.sourceFactIds.includes(prior.factId));
 const output = formatFortunePrompt(buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'summer-yi-fire-trine')).input);
 assert.match(output, /午月乙日.*寅、午、戌实齐/u);
 assert.doesNotMatch(output, /hasSummerYiFireFormationWaterSeal|summerYiFireFormationWaterEvidence/u);

 const sameDay = submittedCalendar({...example, hour: 22, natal: [...example.natal.slice(0, 3), '丁亥']});
 assert.equal(sameDay.fact.normalizedPayload.hasSummerYiFireFormationWaterSeal, false);
 assert.equal(match(sameDay.run, 136).status, 'partial');
 const blocked = submittedCalendar({date: [1922, 6, 26], hour: 4, gender: 0, year: 1948, luck: '癸卯',
  natal: ['壬戌', '丙午', '乙丑', '戊寅']});
 const blockedPayload = blocked.fact.normalizedPayload;
 assert.equal(blocked.fact.activeFrom, '1948-12-03T08:00:00.000Z');
 assert.equal(blockedPayload.hasSummerYiFireFormationWaterSeal, false);
 assert.deepEqual(blockedPayload.foodClimateEvidence.summerYiFireFormationWaterEvidence.opposingEarth.map(row =>
  [row.position, row.stem]), [['hour', '戊']]);
 assert.equal(match(blocked.run, 136).status, 'partial');
 assert.equal(ctx(native(example.natal), '癸卯', false).hasSummerYiFireFormationWaterSeal, undefined);
});

test('the same Yi chart and Gui-Chou luck distinguish actual birth times before and after the summer solstice', () => {
 const natal = ['壬寅', '丙午', '乙丑', '丙戌'], common = { natal, hour: 20, gender: 1, luck: '癸丑' };
 for (const expected of [
  { date: [1902, 6, 11], year: 1971, phase: 'before-solstice', solsticeAt: '1902-06-22T09:15:08.000Z' },
  { date: [1842, 6, 25], year: 1906, phase: 'at-or-after-solstice', solsticeAt: '1842-06-21T21:21:45.000Z' },
 ]) {
  const { run, fact } = submittedCalendar({ ...common, ...expected });
  const p = fact.normalizedPayload;
  const evidence = p.foodClimateEvidence.summerYiFireFormationWaterEvidence;
  assert.equal(p.hasSummerYiFireFormationWaterSeal, true);
  assert.equal(p.summerYiFireFormationSolsticePhase, expected.phase);
  const [birthYear, birthMonth, birthDay] = expected.date;
  assert.deepEqual(evidence.solarTerm, { phase: expected.phase,
   birthAt: new Date(Date.UTC(birthYear, birthMonth - 1, birthDay, 12)).toISOString(), solsticeAt: expected.solsticeAt });
  assert.deepEqual(evidence.fireMembers.map(row => row.pillar), ['壬寅', '丙午', '丙戌']);
  assert.equal(evidence.moving.stem, '癸');
  assert.equal(evidence.roots[0].xin.stem, '辛');
  const scoped = { ...run, facts: [fact] }, hit = match(scoped, 136);
  assert.equal(hit.status, 'matched');
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'summer-yi-solstice'));
  const beforeSolstice = expected.phase === 'before-solstice';
  const local = beforeSolstice ? /午月乙木出生在夏至交节前/u : /午月乙木出生已到夏至交节/u;
  const provider = beforeSolstice ? /此段先取癸、次取丙/u : /此段将丙与癸并取/u;
  assert.match(hit.matchedConditions.join(''), provider);
  assert.match(formatFortuneFactAudit(input), local);
  assert.match(formatFortunePrompt(input), provider);
  assert.doesNotMatch(formatFortunePrompt(input), local);
  const missingTiming = { ...scoped, facts: [{ ...fact, normalizedPayload: { ...p,
   summerYiFireFormationSolsticePhase: 'unverified',
  } }] };
  const fallback = match(missingTiming, 136);
  assert.equal(fallback.status, 'matched');
  assert.doesNotMatch(fallback.matchedConditions.join(''), /先取癸、次取丙|将丙与癸并取/u);
 }
 const unverified = ctx(native(natal), '癸丑');
 assert.equal(unverified.hasSummerYiFireFormationWaterSeal, true);
 assert.equal(unverified.summerYiFireFormationSolsticePhase, 'unverified');
 assert.equal(unverified.foodClimateEvidence.summerYiFireFormationWaterEvidence.solarTerm, undefined);
 assert.equal(ctx(native(natal), '癸丑', false).summerYiFireFormationSolsticePhase, undefined);
});

test('the same seal controls food and receives wealth pressure while natal and moving wealth roots remain distinct', () => {
 const base = ref.wealthRemedyCalendar;
 const jiSi = submittedCalendar(base), xinWei = submittedCalendar({ ...base, luck: '辛未', year: 1945 });
 const output = submittedCalendar({ ...base, luck: '丁卯', year: 1907 });
 for (const { run, fact } of [jiSi, xinWei, output]) {
  assert.deepEqual(fact.normalizedPayload.wealthRemedyReviewedActions, run === jiSi.run
   ? ['wealth-checks-seal', 'output-feeds-wealth'] : run === xinWei.run
    ? ['wealth-checks-seal', 'authority-feeds-seal'] : ['output-feeds-wealth']);
  const path = fact.normalizedPayload.foodClimateEvidence.foodSealWealth.find(row =>
   row.wealth.stem === '己' && row.food.position === 'month' && row.food.stem === '丙' && row.seal.kind === '透干' && row.seal.stem === '壬');
  assert.ok(path);
  const hit = match(run, 137);
  assert.equal(hit.status, 'matched');
  assert.ok(hit.sourceFactIds.includes(fact.factId));
  assert.ok(path.wealthRoots.some(root => root.position === 'month' && !root.exactStem));
  assert.ok(path.wealthRoots.every(root => root.position === 'decadal' || !root.exactStem));
  assert.equal(path.wealthRoots.some(root => root.position === 'decadal' && root.exactStem), run === xinWei.run);
  assert.deepEqual(path.movingAuthorityCombinesFood.map(pair => [pair.moving.stem, pair.target.position, pair.target.stem]),
   run === xinWei.run ? [['辛', 'month', '丙']] : []);
  assert.deepEqual(path.movingSealChecksExposedFood, []);
  if (run === output.run) {
   assert.deepEqual(path.movingWealth, []);
   assert.ok(path.movingOutput.some(row => row.stem === '丁'));
  }
 }
 const change = xinWei.run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '辛未');
 assert.ok(change);
 assert.equal(xinWei.fact.activeFrom, change.exactInstant);
 const raw = ref.calendarExamples[137];
 const hiddenWealth = submittedCalendar({ ...raw, hour: 8, natal: [...raw.natal.slice(0, 3), '甲辰'] });
 assert.deepEqual(hiddenWealth.fact.normalizedPayload.foodClimateEvidence.foodSealWealth, []);
 assert.equal(match(hiddenWealth.run, 137).status, 'not_matched');
 const hiddenFood = submittedCalendar({ date: [1980, 2, 11], hour: 0, gender: 0, year: 1993,
  natal: ['庚申', '戊寅', '甲寅', '甲子'], luck: '丙子' });
 const hiddenFoodPaths = hiddenFood.fact.normalizedPayload.foodClimateEvidence.foodSealWealth;
 assert.ok(hiddenFoodPaths.some(path => path.food.stem === '丙' && path.food.position === 'month'
  && path.movingSeal.some(seal => seal.stem === '癸' && seal.kind === '运支藏干')));
 assert.ok(hiddenFoodPaths.every(path => !path.exposedFood.length && !path.movingSealChecksExposedFood.length
  && !path.movingAuthorityCombinesFood.length));
 assert.equal(match(hiddenFood.run, 137).status, 'partial');
});

test('p095 excludes the printed wealth and seal comparison on both sides of the real luck handoff', () => {
 const source = { date: [1889, 2, 17], hour: 8, year: 1903, luck: '甲子', natal: ['己丑', '丙寅', '甲子', '戊辰'] };
 const exact = submittedCalendar(source);
 const near = submittedCalendar({ ...source, hour: 6, natal: [...source.natal.slice(0, 3), '丁卯'] });
 for (const [fixture, isPrinted] of [[exact, true], [near, false]]) {
  const { run, fact } = fixture;
  const handoff = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '甲子');
  assert.ok(handoff);
  const before = rows(run).find(row => row.activeTo === handoff.exactInstant && row.normalizedPayload.luckPillar === '乙丑');
  assert.ok(before);
  assert.equal(fact.activeFrom, handoff.exactInstant);
  for (const [stage, route] of [[before, 'wealth-reaches-food-controlling-seal'], [fact, 'seal-or-authority-against-food-remedy']]) {
   const evidence = stage.normalizedPayload;
   assert.ok(evidence.foodLuckRoutes.includes(route));
   assert.equal(evidence.printedFoodSealSeparate, isPrinted);
   const comparison = evidence.foodClimateEvidence.foodSealSourceComparison;
   if (isPrinted) {
    assert.equal(comparison.id, 'printed-wealth-seal-separate');
    assert.deepEqual([comparison.food.position, comparison.food.stem, comparison.seal.position, comparison.seal.stem],
     ['month', '丙', 'day', '癸']);
    assert.deepEqual(comparison.wealth.map(row => [row.position, row.stem]), [['year', '己'], ['hour', '戊']]);
   } else {
    assert.equal(comparison, undefined);
    assert.ok(match(run, 137).sourceFactIds.includes(stage.factId));
   }
  }
 }
 assert.equal(match(exact.run, 137).status, 'not_matched');
 assert.equal(match(near.run, 137).status, 'partial');
 const unknown = ctx(native(source.natal), '甲子', false);
 assert.equal(unknown.printedFoodSealSeparate, undefined);
 assert.equal(unknown.foodClimateEvidence.foodSealSourceComparison, undefined);
});

test('p095 confirms the named opposing authority and seal route alongside the earlier wealth root', async () => {
 const { run, fact } = submittedCalendar({ ...ref.wealthRemedyCalendar, luck: '壬申', year: 1955 });
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '壬申');
 const previous = rows(run).find(row => row.normalizedPayload.luckPillar === '辛未' && row.activeTo === transition?.exactInstant);
 assert.ok(previous && transition);
 assert.equal(fact.activeFrom, transition.exactInstant);
 const touched = row => row.normalizedPayload.foodClimateEvidence.foodSealWealth.find(path =>
  path.food.position === 'month' && path.food.stem === '丙' && path.seal.position === 'hour' && path.seal.kind === '透干');
 const currentPath = touched(fact), previousPath = touched(previous);
 assert.deepEqual(currentPath.exposedFood.map(row => [row.position, row.stem]), [['month', '丙']]);
 assert.deepEqual(currentPath.movingSeal.map(row => [row.kind, row.stem]), [['运干', '壬']]);
 assert.deepEqual(currentPath.movingAuthority.map(row => [row.kind, row.stem]), [['运支藏干', '庚']]);
 assert.deepEqual(previousPath.movingAuthorityCombinesFood.map(pair => [pair.moving.stem, pair.target.position, pair.target.stem]),
  [['辛', 'month', '丙']]);
 assert.deepEqual(currentPath.movingAuthorityCombinesFood, []);
 assert.deepEqual(currentPath.movingSealChecksExposedFood.map(link => [link.from.stem, link.to.position, link.to.kind, link.to.stem]),
  [['壬', 'month', '透干', '丙']]);
 assert.deepEqual([...currentPath.movingWealth, ...currentPath.movingOutput], []);
 assert.ok(currentPath.secondaryWealth.some(row => row.stem === '戊'));
 assert.deepEqual(previous.normalizedPayload.wealthRemedyReviewedActions, ['wealth-checks-seal', 'authority-feeds-seal']);
 assert.deepEqual(fact.normalizedPayload.wealthRemedyReviewedActions, ['seal-checks-food', 'authority-feeds-seal']);
 assert.ok(previousPath.wealthRoots.some(row => row.position === 'decadal' && row.exactStem));
 assert.ok(currentPath.wealthRoots.every(row => row.position !== 'decadal' || !row.exactStem));
 const hit = match(run, 137);
 assert.equal(hit.status, 'matched');
 assert.ok([previous, fact].every(row => hit.sourceFactIds.includes(row.factId)));
 assert.deepEqual(ctx({ ...printed('wealth-rescue'), hour: '癸酉' }, '壬申').wealthRemedyReviewedActions, []);
 assert.equal(ctx(printed('wealth-rescue'), '壬申', false).wealthRemedyReviewedActions, undefined);
 for (const [row, excerpts] of [[previous, ['運喜財旺', '官煞皆忌也']], [fact, ['印與官煞皆忌也', '官煞皆忌也']]]) {
  const sliced = match({ ...run, facts: [row] }, 137);
  assert.equal(sliced.status, 'matched');
  for (const excerpt of excerpts) assert.ok(sliced.matchedSourceExcerpt.includes(excerpt));
  if (row === fact) assert.doesNotMatch(sliced.matchedSourceExcerpt, /運喜財旺|食傷亦吉/u);
 }
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'seal-wealth-counterdirection'));
 const cited = input.facts.filter(row => row.type === 'zpqz_food_killer_context');
 assert.ok(cited.some(row => row.data.luckPillar === '辛未' && row.endExclusive === transition.exactInstant));
 assert.ok(cited.some(row => row.data.luckPillar === '壬申' && row.start === transition.exactInstant));
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('壬申运干壬（偏印）克同一月令食神'));
 assert.ok(prompt.includes('壬申运支藏干庚（七杀）生同一原局印'));
 assert.match(prompt, /辛未运干辛（正官）实际五合月柱丙寅透干丙/u);
 assert.match(prompt, /壬申运干壬（偏印）克月令食神的同干明透月柱丙寅透干丙/u);
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
  const content = JSON.parse(options.body).messages[1].content;
  assert.match(content, /年透己财制壬.*病重药轻/u);
  assert.doesNotMatch(content, /wealthRemedyReviewedActions|movingSealChecksExposedFood/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(input);
});

test('p095 allows secondary wealth only when it checks the exposed seal on the same food path', () => {
 const { run, fact } = submittedCalendar({ date: [1978, 2, 23], hour: 4, gender: 1, year: 2001,
  luck: '丁巳', natal: ['戊午', '甲寅', '丙辰', '庚寅'] });
 const entry = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丁巳');
 const previous = rows(run).find(row => row.activeTo === entry.exactInstant);
 assert.equal(previous.normalizedPayload.luckPillar, '丙辰');
 assert.equal(fact.activeFrom, entry.exactInstant);
 const path = fact.normalizedPayload.foodClimateEvidence.foodSealWealth.find(row => row.secondaryWealth.length);
 assert.deepEqual([path.food.stem, path.seal.stem, path.seal.kind, path.wealth.stem, path.secondaryWealth[0].stem],
  ['戊', '甲', '透干', '庚', '庚']);
 assert.deepEqual([...path.movingOutput, ...path.movingAuthority, ...path.movingSeal, ...path.movingWealth], []);
 assert.ok(previous.normalizedPayload.foodClimateEvidence.foodSealWealth.every(row => !row.secondaryWealth.length));
 const hit = match(run, 137);
 assert.equal(hit.status, 'partial');
 assert.ok(hit.sourceFactIds.includes(fact.factId));
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'secondary-wealth-rescue'));
 assert.ok(formatFortuneFactAudit(input).includes('运支余藏财本步大运丁巳运支藏干庚'));
 assert.ok(!formatFortunePrompt(input).includes('运支余藏财本步大运丁巳'));
});

test('winter food retains separate wealth feeding fire and moving fire checked by the actual month food', () => {
 const base = ref.calendarExamples[138], wealth = submittedCalendar(base);
 const fire = submittedCalendar({ ...base, luck: '庚午', year: 2063 });
 assert.ok(wealth.fact.normalizedPayload.foodClimateEvidence.winterWealthFeedsFire.some(link =>
  link.from.stem === '甲' && link.to.stem === '丙' && link.to.position === 'hour'));
 assert.deepEqual(wealth.fact.normalizedPayload.foodClimateEvidence.winterFireLuck, []);
 assert.deepEqual(fire.fact.normalizedPayload.foodClimateEvidence.winterFireLuck.map(value =>
  [value.fire.stem, value.fire.god, value.day.stem, value.waterChecks.map(row => [row.position, row.stem])]),
  [['丁', '正官', '庚', [['month', '壬']]]]);
 assert.equal(match(wealth.run, 138).status, 'not_matched');
 assert.equal(match(fire.run, 138).status, 'not_matched');
 const supportOnly = submittedCalendar({ ...base, luck: '辛未', year: 2073 });
 assert.equal(match(supportOnly.run, 138).status, 'not_matched');
});

test('p096 distinguishes wood feeding moving fire in Yi-Si from wealth feeding native fire after Jia-Chen begins', () => {
 const { run, fact } = submittedCalendar({ date: [1947, 12, 28], hour: 18, year: 2024, gender: 1,
  natal: ['丁亥', '壬子', '辛巳', '丁酉'], luck: '甲辰' });
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '甲辰');
 const previous = rows(run).find(row => row.normalizedPayload.luckPillar === '乙巳' && row.activeTo === transition?.exactInstant);
 assert.ok(previous && transition);
 assert.equal(fact.activeFrom, transition.exactInstant);
 const old = previous.normalizedPayload.foodClimateEvidence, now = fact.normalizedPayload.foodClimateEvidence;
 assert.deepEqual(old.winterFireLuck.map(link => [link.fire.stem, link.fire.kind, link.waterChecks.map(row => row.stem),
  link.movingWealth.map(row => row.stem)]), [['丙', '运支藏干', ['癸'], ['乙']]]);
 assert.deepEqual(now.winterFireLuck, []);
 assert.deepEqual(now.winterWealthFeedsFire.filter(link => link.to.kind === '透干')
  .map(link => [link.from.stem, link.from.kind, link.to.position]), [
   ['甲', '运干', 'year'], ['甲', '运干', 'hour'], ['乙', '运支藏干', 'year'], ['乙', '运支藏干', 'hour'],
  ]);
 assert.equal(transition.exactInstant, '2024-10-23T18:00:00.000Z');
 const hit = match(run, 138);
 assert.equal(hit.status, 'matched');
 assert.ok([previous, fact].every(row => hit.sourceFactIds.includes(row.factId)));
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'shu-wealth-fire-transition'));
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('乙巳运干乙（偏财）生这处运火'));
 assert.ok(prompt.includes('甲辰运支藏干乙（偏财）生'));
 assert.match(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId)?.originalText ?? '', /原局金寒水冷/u);

 const changed = submitted({ date: [1947, 12, 28], hour: 20, year: 2024 });
 const changedFact = rows(changed).find(row => row.normalizedPayload.luckPillar === '甲辰' && row.activeFrom === '2024-11-02T20:00:00.000Z');
 assert.ok(changedFact);
 assert.equal(changedFact.normalizedPayload.winterMetalWaterFoodCandidate, true);
 assert.ok(changedFact.normalizedPayload.foodClimateEvidence.winterWealthFeedsFire.length > 0);
 assert.deepEqual(changedFact.normalizedPayload.printedLuckCaseIds, []);
 assert.equal(match(changed, 138).status, 'not_matched');

 const later = submitted({ date: [1947, 12, 28], hour: 18, year: 2034 });
 const laterCut = '2034-10-23T18:00:00.000Z';
 const inSource = rows(later).find(row => row.normalizedPayload.luckPillar === '甲辰' && row.activeTo === laterCut);
 const outsideSource = rows(later).find(row => row.normalizedPayload.luckPillar === '癸卯' && row.activeFrom === laterCut);
 assert.ok(inSource && outsideSource);
 assert.ok(outsideSource.normalizedPayload.foodLuckRoutes.includes('winter-wealth-or-fire'));
 assert.deepEqual(outsideSource.normalizedPayload.printedLuckCaseIds, []);
 const finalSourceHit = match(later, 138);
 assert.ok(finalSourceHit.sourceFactIds.includes(inSource.factId));
 assert.ok(!finalSourceHit.sourceFactIds.includes(outsideSource.factId));
 assert.equal(finalSourceHit.windows.at(-1).endExclusive, laterCut);
});

test('printed luck readings preserve both sides of a verified transition and require the same four columns', () => {
  const transition = submitted({ date: [1947, 12, 28], hour: 18, year: 1994 });
  const facts = rows(transition), boundary = '1994-10-23T18:00:00.000Z';
  const oldStage = facts.find(row => row.normalizedPayload.luckPillar === '戊申' && row.activeTo === boundary);
  const newStage = facts.find(row => row.normalizedPayload.luckPillar === '丁未' && row.activeFrom === boundary);
  assert.equal(oldStage.normalizedPayload.stageEnd, boundary);
  assert.equal(newStage.normalizedPayload.stageStart, boundary);
  assert.deepEqual(oldStage.normalizedPayload.foodClimateEvidence.shuSealPeer.map(row => [row.moving.stem, row.relation]),
   [['戊', '生'], ['庚', '同五行']]);
  assert.deepEqual(newStage.normalizedPayload.foodClimateEvidence.winterFireLuck.filter(row => row.fire.stem === '丁'
   && row.waterChecks.some(food => food.position === 'month' && food.stem === '癸')).map(row => row.fire.kind), ['运干', '运支藏干']);
  const shu = match(transition, 138);
  assert.equal(shu.status, 'matched');
  assert.ok([oldStage, newStage].every(fact => shu.sourceFactIds.includes(fact.factId)));
  const { input } = buildFortuneModelContext(transition, interpretFortune(transition, requestForFortuneRun(transition), 'case-transition'));
  const kept = input.facts.filter(row => row.type === 'zpqz_food_killer_context');
  assert.equal(new Set(kept.map(row => [row.start, row.endExclusive, row.data.luckPillar].join('|'))).size, kept.length);
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /戊申运作为印劫运的平常对照/u);
  assert.match(prompt, /丁未运列作原例最相宜的火运/u);
  assert.doesNotMatch(prompt, /printedLuckCaseIds|printedLuck/u);

  const wrongHour = submitted({ date: [1906, 5, 20], hour: 6, year: 1947 });
  assert.ok(rows(wrongHour).every(row => row.normalizedPayload.luckPillar === '丁酉'
    && row.normalizedPayload.printedLuckCaseIds.length === 0));
  assert.equal(match(wrongHour, 136).status, 'not_matched');
  assert.deepEqual(ctx(printed('qian'), '丁酉', false).printedLuckCaseIds, []);
  assert.deepEqual(ctx(printed('qian'), '乙未').printedLuckCaseIds, []);
});

test('actual provider gets natural Chinese column witnesses, no-seal and unresolved meanings without machine JSON or partial original paragraphs',async()=>{
 const run=real(133),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'food-private-report'));
 assert.ok(input.facts.some(f=>f.type==='zpqz_food_killer_context'));const prompt=formatFortuneFactAudit(input);
 for(const text of ['食神带杀三种分支共同的无印位置前提','同五行异干根','钱例甲日丙干实际为食神','胡例戌中藏辛财仍保留','同一实际运段'])assert.ok(prompt.includes(text),text);
 for(const secret of ['food-private','zpqz-food-killer-no-seal','monthFoodCandidate','foodKillerNoSeal','natalWoodMembers','stageStart'])assert.ok(!prompt.includes(secret),secret);
 assert.ok(!input.sections.flatMap(s=>s.findings).some(f=>indices.some(i=>f.knowledgeId===fortuneKnowledge.bazi.rules[i].knowledgeId)));
 const pure=describeFortuneFact({method:'bazi',type:'zpqz_food_killer_context',data:ctx()},String);assert.ok(!/[{}\[\]]/u.test(pure));
 assert.ok(describeFortuneFact({method:'bazi',type:'zpqz_food_killer_context',data:ctx(printed('liang'),'壬子')},String).includes('原局另透壬的假设'));
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await provider.interpret(input);
});
