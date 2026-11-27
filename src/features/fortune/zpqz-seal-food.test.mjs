import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Solar} from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import {describeFortuneFact,formatFortuneFactAudit, formatFortunePrompt} from './control/fortune-prompt.mjs';
import {createFortuneDeepSeek} from './server/deepseek-expression.mjs';
const {baziZpqzSealFood,zpqzSealFoodCases,zpqzColumnStemCheck,zpqzSealFoodPolicy}=await import('./control/bazi-zpqz-seal-food.ts');
const {calculateFortuneFacts,validateFortuneFacts}=await import('./control/fortune-facts.ts');
const {buildFactTimeContext}=await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const {matchFortuneKnowledge}=await import('./control/knowledge/match.ts');
const {evaluateFortuneRules,fortuneKnowledge}=await import('./control/knowledge/catalog.ts');
const {buildFortuneModelContext}=await import('./control/fortune-model-context.ts');
const {interpretFortune,requestForFortuneRun}=await import('./control/fortune-interpretation.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/zpqz-seal-food-reference.json',import.meta.url)));
const layers=['year','month','day','hour'],native=values=>Object.fromEntries(layers.map((k,i)=>[k,values[i]]));
const printed=id=>native(ref.printedCases.find(c=>c.id===id).pillars),ctx=(n=printed('zhu'),luck='甲寅',known=true)=>baziZpqzSealFood(n,known,luck);
const indices=[45,55,119,120,121,122,123,124,125,126,127,128,129,130];
const liFoodWealthIndex = 122;
const exactLiIndices = [123, 124];
const namedSourceIndices = new Set([120, liFoodWealthIndex, ...exactLiIndices, 125, 126, 127, 128]);
const completeComparisonIndices = new Set([45, 55]);
const god=(p,name)=>p.gods.find(g=>g.god===name);
function archive(e){const [y,m,d]=e.date,l=Solar.fromYmdHms(y,m,d,e.hour,0,0).getLunar();
 const luckPeriods=l.getEightChar().getYun(e.gender,2).getDaYun(11).slice(1).map(s=>({ganZhi:s.getGanZhi(),startAge:s.getStartAge(),endAge:s.getEndAge()}));
 return {timeKnown:true,bazi:{engineName:'lunar-javascript',engineVersion:'1.7.8',rulesetVersion:'utc8-jie-local-civil-late-zi-next-v1',rawResult:[{
  utc:new Date(Date.UTC(y,m-1,d,e.hour-8)).toISOString(),year:l.getYearInGanZhiExact(),month:l.getMonthInGanZhiExact(),day:l.getDayInGanZhiExact(),hour:l.getTimeInGanZhi(),luckPeriods,tenGods:{},shenSha:{},
 }]},ziwei:{rawResult:[]},western:{rawResult:[]}};
}
function calculate(e,chart=archive(e)){const input={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year:e.year}};return calculateFortuneFacts(input,buildFactTimeContext(input,Date.parse(e.year+'-11-19T02:00:00Z'),'server'),'seal-private-run',{snapshotId:'seal-private-snapshot',chart});}
const cache=new Map(),real=i=>{if(!cache.has(i))cache.set(i,calculate(ref.calendarExamples[i]));return cache.get(i);};
const rows=run=>run.facts.filter(f=>f.factType==='zpqz_seal_food_context'),match=(run,i)=>matchFortuneKnowledge(run).byMethod.bazi[i];

function submitted(date, hour, year, gender = 1) {
 const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
 const now = Date.UTC(year, 5, 1);
 const reference = { snapshotId: 'seal-printed-' + date.join('-') + '-' + hour };
 const chart = archive({ date, hour, gender });
 chart.birthContext = { birthInstant: chart.bazi.rawResult[0].utc, precision: 'minute', latitude: 39.9042, longitude: 116.4074,
  timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
 const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...reference, chart })));
 assert.ok(rows(batch).every(fact => !('printedLuck' in fact.normalizedPayload)));
 const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), reference.snapshotId, reference);
 validateFortuneFacts(run);
 return run;
}
const modelContext = run => buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'seal-printed-report'));
function submittedCalendar(e) {
 const run = submitted(e.date, e.hour, e.year, e.gender);
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === e.luck);
 assert.ok(fact, e.luck);
 assert.deepEqual(fact.normalizedPayload.natalPillars.map(row => row.pillar), e.natal);
 return { run, fact, evidence: fact.normalizedPayload.sealLuckEvidence };
}
const candidate = (natal, luck, timeKnown = true, confirmed = true) => ({
 factType: 'zpqz_seal_food_context', scope: 'decadal', completeness: 'complete',
 normalizedPayload: { ...ctx(natal, luck, timeKnown), confirmed },
});

test('the Liu supporting seal and Hu overcontrol use separate source evidence at the actual luck periods', () => {
 const date = [1933, 9, 10], liu = submitted(date, 22, 1944);
 const change = liu.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '己未');
 assert.ok(change);
 const before = rows(liu).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '庚申');
 const after = rows(liu).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '己未');
 assert.ok(before && after);
 assert.deepEqual(after.normalizedPayload.natalPillars.map(row => row.pillar), ['癸酉', '辛酉', '己卯', '乙亥']);
 for (const { normalizedPayload: p } of [before, after]) {
  assert.equal(p.sealsPresent, false);
  assert.equal(p.foodKillerSourceReading, 'liu-weak-day');
  assert.equal(p.foodKillerNamedStrongExcluded, true);
 }
 assert.ok(before.normalizedPayload.foodKillerRemedyRoutes.includes('output-checks-killer'));
 assert.equal(before.normalizedPayload.foodKillerLiuSeal, false);
 const p = after.normalizedPayload;
 assert.equal(p.foodKillerLiuSeal, true);
 assert.ok(!p.foodKillerRemedyRoutes.includes('seal-checks-food'));
 const [path] = p.foodKillerRemedyPaths.filter(row => row.liuSourceSeals.length > 0);
 assert.deepEqual([path.food.position, path.food.stem, path.killer.position, path.killer.kind, path.killer.stem],
  ['month', '辛', 'hour', '透干', '乙']);
 const [seal] = path.liuSourceSeals;
 assert.deepEqual([seal.kind, seal.stem], ['运支藏干', '丁']);
 assert.ok(p.remedyMovingContacts.some(link => link.from.stem === '丁' && link.to.kind === '日干' && link.to.stem === '己' && link.relation === '生'));
 const support = match(liu, 48);
 assert.equal(support.status, 'matched');
 assert.match(support.matchedConditions.join(''), /徐注刘提督原图辨身弱克泄/u);
 assert.equal(support.windows[0].start, change.exactInstant);
 assert.ok(support.sourceFactIds.includes(after.factId));
 assert.equal(match(liu, 49).status, 'not_matched');
 const liuAudit = formatFortuneFactAudit(modelContext(liu).input);
 assert.match(liuAudit, /刘提督原图本命无印，原评按此图身弱/u);
 assert.match(liuAudit, /刘提督原例本步.*己未运支藏干丁/u);

 const hu = submitted([1958, 10, 26], 20, 1982);
 const huChange = hu.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '乙丑');
 assert.ok(huChange);
 const huPrior = rows(hu).find(row => row.activeTo === huChange.exactInstant && row.normalizedPayload.luckPillar === '甲子');
 const huFact = rows(hu).find(row => row.activeFrom === huChange.exactInstant && row.normalizedPayload.luckPillar === '乙丑');
 assert.ok(huPrior && huFact);
 assert.equal(huFact.normalizedPayload.foodKillerSourceReading, 'hu-overcontrol');
 assert.equal(huFact.normalizedPayload.foodKillerNamedStrongExcluded, true);
 assert.ok(huFact.normalizedPayload.foodKillerRemedyRoutes.includes('output-checks-killer'));
 for (const [stage, stem] of [[huPrior, '甲'], [huFact, '乙']]) {
  const value = stage.normalizedPayload;
  const proof = value.foodKillerRemedyPaths.find(path => path.seals.some(row => row.kind === '运干' && row.stem === stem));
  assert.deepEqual([proof.food.position, proof.food.stem, proof.killer.position, proof.killer.stem], ['month', '戊', 'month', '壬']);
  assert.ok(value.remedyMovingContacts.some(({ from, to, relation }) =>
   from.kind === '运干' && from.stem === stem && to.kind === '日干' && to.stem === '丙' && relation === '生'));
 }
 const huSupport = match(hu, 48);
 assert.equal(huSupport.status, 'matched');
 assert.equal(huSupport.matchedSourceExcerpt, '剋洩交加');
 assert.ok(huSupport.sourceFactIds.includes(huPrior.factId) && huSupport.sourceFactIds.includes(huFact.factId));
 assert.equal(match(hu, 49).status, 'not_matched');
 const { input: huInput } = modelContext(hu);
 assert.match(formatFortuneFactAudit(huInput), /胡会元原图本命无印，原评按此图杀轻制过/u);
 assert.match(formatFortunePrompt(huInput), /胡会元原例按食神制杀过度、日元不旺看/u);
 assert.doesNotMatch(formatFortunePrompt(huInput), /身弱則剋洩交加|foodKillerSourceReading/u);

 const branchSeals = submitted([1958, 10, 26], 20, 2002);
 const woodFireChange = '2002-12-17T10:00:00.000Z';
 const yin = rows(branchSeals).find(row => row.activeTo === woodFireChange && row.normalizedPayload.luckPillar === '丙寅');
 const mao = rows(branchSeals).find(row => row.activeFrom === woodFireChange && row.normalizedPayload.luckPillar === '丁卯');
 assert.ok(yin && mao);
 for (const [{ normalizedPayload: value }, stem, sealGod, peerGod] of [
  [yin, '甲', '偏印', '比肩'], [mao, '乙', '正印', '劫财'],
 ]) {
  const proof = value.foodKillerRemedyPaths.find(path => path.seals.some(row => row.kind === '运支藏干' && row.stem === stem));
  assert.deepEqual([proof.food.position, proof.food.stem, proof.killer.position, proof.killer.stem], ['month', '戊', 'month', '壬']);
  assert.deepEqual([value.luckBranchMainQiGod, value.luckTenGod], [sealGod, peerGod]);
  assert.ok(value.remedyMovingContacts.some(({ from, to, relation }) =>
   from.kind === '运支藏干' && from.stem === stem && to.kind === '日干' && to.stem === '丙' && relation === '生'));
 }
 const laterHu = match(branchSeals, 48);
 assert.equal(laterHu.status, 'matched');
 assert.equal(laterHu.matchedSourceExcerpt, '剋洩交加');
 assert.ok([yin, mao].every(stage => laterHu.sourceFactIds.includes(stage.factId)));
 assert.equal(match(branchSeals, 49).status, 'not_matched');
 const laterHuPrompt = formatFortunePrompt(modelContext(branchSeals).input);
 assert.match(laterHuPrompt, /运支.*木印.*运干.*火/u);
 assert.doesNotMatch(laterHuPrompt, /实排甲子或乙丑|foodKillerSourceReading/u);
 const earth = evaluateFortuneRules('bazi', 'year', [candidate(native(['戊戌', '壬戌', '丙子', '戊戌']), '戊辰')])[48];
 assert.equal(earth.confirmations.flatMap(path => path.hits).length, 0);

 const near = submitted(date, 2, 1943);
 const nearFact = rows(near).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '庚申');
 assert.ok(nearFact);
 assert.equal(nearFact.normalizedPayload.foodKillerSourceReading, undefined);
 assert.equal(nearFact.normalizedPayload.foodKillerNamedStrongExcluded, false);
 assert.equal(nearFact.normalizedPayload.foodKillerLiuSeal, false);
 assert.ok(match(near, 49).sourceFactIds.includes(nearFact.factId));
 assert.equal(ctx(native(['癸酉', '辛酉', '己卯', '乙亥']), '己未', false).foodKillerNamedStrongExcluded, undefined);
});

test('named Shangguan and concealed-seal comparisons retain the actual directed endpoints across luck changes', async () => {
 const bySource = (run, passage) => matchFortuneKnowledge(run).byMethod.bazi
  .find(row => row.knowledgeId.endsWith('zpqz-1936-interpretation-' + passage + '-001'));
 const chancellor = submitted([1968, 12, 26], 2, 2022);
 const beforePeer = rows(chancellor).findLast(row => row.normalizedPayload.luckPillar === '己巳');
 const afterPeer = rows(chancellor).find(row => row.normalizedPayload.luckPillar === '庚午');
 assert.equal(beforePeer.activeTo, '2022-07-27T02:00:00.000Z');
 assert.equal(afterPeer.activeFrom, beforePeer.activeTo);
 assert.equal(beforePeer.normalizedPayload.namedHurtingOfficerPeer, false);
 assert.equal(afterPeer.normalizedPayload.namedHurtingOfficerPeer, true);
 assert.equal(afterPeer.normalizedPayload.luckTenGod, '比肩');
 assert.equal(afterPeer.normalizedPayload.luckBranchMainQiGod, '正官');
 const peer = afterPeer.normalizedPayload.namedHurtingOfficerPeerEvidence;
 assert.deepEqual([peer.seal.stem, peer.hurt.stem, peer.officer.stem, peer.wealth[0].source.stem], ['戊', '癸', '丁', '甲']);
 assert.ok(peer.moving.some(row => row.component.stem === '庚' && row.sameElementAsDay));
 const hurting = bySource(chancellor, 'p001');
 assert.equal(hurting.status, 'matched');
 assert.equal(hurting.matchedSourceExcerpt, '官露');
 assert.equal(hurting.windows[0].start, afterPeer.activeFrom);
 assert.ok(hurting.sourceFactIds.includes(afterPeer.factId));
 assert.ok(!hurting.sourceFactIds.includes(beforePeer.factId));
 const changedHour = ctx({ ...native(['戊申', '甲子', '庚午', '丁丑']), hour: '戊寅' }, '庚午');
 assert.equal(changedHour.namedHurtingOfficerPeer, false);
 const retired = evaluateFortuneRules('bazi', 'year', [
  candidate({ ...native(['戊申', '甲子', '庚午', '丁丑']), hour: '戊寅' }, '庚午'),
 ]).find(row => row.knowledgeId === hurting.knowledgeId);
 assert.deepEqual(retired.confirmations[0].hits, []);
 const namedPrompt = formatFortunePrompt(modelContext(chancellor).input);
 assert.match(namedPrompt, /庚午为原评列明的运步，本步运干庚与日元同为比肩/u);
 assert.match(namedPrompt, /一般命盘的财印旺度和比劫伤官取法须另核/u);
 assert.doesNotMatch(namedPrompt, /namedHurtingOfficerPeer/u);

 const coldBing = submitted([1852, 3, 15], 22, 1938);
 const wealthBing = rows(coldBing).findLast(row => row.normalizedPayload.luckPillar === '辛亥');
 const authorityBing = rows(coldBing).find(row => row.normalizedPayload.luckPillar === '壬子');
 assert.equal(wealthBing.activeTo, '1938-11-21T08:00:00.000Z');
 assert.equal(authorityBing.activeFrom, wealthBing.activeTo);
 const wealth = wealthBing.normalizedPayload.coldBingSealComparison;
 const authority = authorityBing.normalizedPayload.coldBingSealComparison;
 for (const path of [wealth, authority]) {
  assert.deepEqual([path.seal.position, path.seal.stem, path.seal.kind, path.day.stem], ['month', '乙', '支藏', '丙']);
  assert.deepEqual(path.fireRoots, []);
  assert.deepEqual(path.nativeControl.map(row => [row.position, row.stem]), [['hour', '己']]);
  assert.deepEqual(path.officers.map(row => row.stem), ['癸']);
  assert.deepEqual(path.killers.map(row => row.stem), ['壬']);
 }
 assert.deepEqual(wealth.movingWealthPressure.map(row => [row.wealth.stem, row.feeds.map(feed => feed.stem)]), [['辛', ['癸', '壬']]]);
 assert.deepEqual(wealth.movingAuthorityPressure.map(row => [row.stem, row.kind]), [['壬', '运支藏干']]);
 assert.equal(wealthBing.normalizedPayload.coldBingBranchAuthorityWithWealth, true);
 assert.equal(authorityBing.normalizedPayload.coldBingBranchAuthorityWithWealth, false);
 assert.deepEqual(authority.movingWealthPressure, []);
 assert.deepEqual(authority.movingAuthorityPressure.map(row => [row.stem, row.kind]), [['壬', '运干'], ['癸', '运支藏干']]);
 const control = ctx(printed('cold-bing'), '己酉').coldBingSealComparison;
 assert.equal(control.movingStemControl.stem, '己');
 assert.deepEqual(control.movingAuthorityPressure, []);
 const neutral = ctx(printed('cold-bing'), '丁未');
 assert.equal(neutral.coldBingSealComparison.movingStemControl, undefined);
 assert.ok(!neutral.sealLuckRoutes.some(route => route.startsWith('cold-bing-hidden-seal')));
 const notOriginal = ctx({ ...printed('cold-bing'), hour: '戊戌' }, '壬子');
 assert.equal(notOriginal.coldBingSealComparison, undefined);
 const killer = bySource(coldBing, 'p023'), mixed = bySource(coldBing, 'p087');
 assert.equal(killer.status, 'matched');
 const branchPressure = killer.confirmedBranches.find(branch => branch.sourceFactIds.includes(wealthBing.factId));
 const stemPressure = killer.confirmedBranches.find(branch => branch.sourceFactIds.includes(authorityBing.factId));
 assert.ok(branchPressure && stemPressure && branchPressure !== stemPressure);
 assert.equal(branchPressure.windows.at(-1).endExclusive, authorityBing.activeFrom);
 assert.equal(stemPressure.windows[0].start, wealthBing.activeTo);
 assert.equal(killer.matchedSourceExcerpt, '再行官煞');
 assert.ok(authorityBing.normalizedPayload.hasKillerSealPressure);
 assert.ok(authority.movingAuthorityPressure.some(row => row.stem === '壬' && row.kind === '运干'));
 assert.equal(mixed.status, 'partial');
 assert.ok(mixed.sourceFactIds.includes(wealthBing.factId));
 assert.ok(mixed.sourceFactIds.includes(authorityBing.factId));
 assert.ok(wealthBing.normalizedPayload.sealLuckEvidence.outputWealthSealPaths.some(row =>
  row.output.stem === '己' && row.wealth.stem === '辛' && row.seal.position === 'month' && row.seal.stem === '乙'));
 assert.ok(!wealthBing.normalizedPayload.sealLuckRoutes.includes('wealth-presses-seal-with-output'));
 assert.equal(bySource(coldBing, 'p088').status, 'not_matched');
 const wealthVariant = ctx({ ...printed('cold-bing'), hour: '戊戌' }, '辛亥');
 assert.ok(wealthVariant.sealLuckRoutes.includes('wealth-presses-seal-with-output'));
 assert.equal(wealthVariant.coldBingBranchAuthorityWithWealth, false);
 assert.equal(ctx(printed('cold-bing'), '辛亥', false).coldBingBranchAuthorityWithWealth, undefined);
 assert.equal(notOriginal.coldBingSourceSealInUse, false);
 const { input } = modelContext(coldBing);
 const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === killer.knowledgeId);
 assert.deepEqual(finding.windows, killer.windows);
 const localWealthAuthority = /湿木丙火原图实在辛亥运/u;
 assert.match(formatFortuneFactAudit(input), localWealthAuthority);
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
  const message = JSON.parse(options.body).messages[1].content;
  assert.match(message, /按徐注湿木丙火原例取卯中乙印化官杀.*同一运杀既生原印又克日元/u);
  assert.match(message, /辛亥[^\n]*壬[^\n]*辛财/u);
  assert.doesNotMatch(message, localWealthAuthority);
  assert.doesNotMatch(message, /coldBingBranchAuthorityWithWealth|coldBingSourceSealInUse|杀重身轻、用印化杀及再来官杀是否增重仍未核/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(input);

 const next = submitted([1852, 3, 15], 22, 1948);
 const edge = next.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸丑')?.exactInstant;
 assert.ok(edge);
 const before = rows(next).find(row => row.activeTo === edge && row.normalizedPayload.luckPillar === '壬子');
 const after = rows(next).find(row => row.activeFrom === edge && row.normalizedPayload.luckPillar === '癸丑');
 assert.ok(before && after);
 const proof = after.normalizedPayload.coldBingSealComparison;
 assert.deepEqual(proof.movingAuthorityPressure.map(row => [row.kind, row.stem, row.god]), [['运干', '癸', '正官']]);
 assert.deepEqual([proof.seal.position, proof.seal.stem, proof.day.stem], ['month', '乙', '丙']);
 const authorityHit = bySource(next, 'p023');
 assert.equal(authorityHit.status, 'matched');
 assert.equal(authorityHit.matchedSourceExcerpt, '再行官煞');
 const [ren, gui] = authorityHit.confirmedBranches;
 assert.equal(ren.windows.at(-1).endExclusive, edge);
 assert.equal(gui.windows[0].start, edge);
 assert.ok(ren.sourceFactIds.includes(before.factId) && gui.sourceFactIds.includes(after.factId));
 const exposedSealRule = bySource(next, 'p087');
 assert.equal(exposedSealRule.status, 'partial');
 assert.ok(exposedSealRule.sourceFactIds.includes(after.factId));
 const nextPrompt = formatFortunePrompt(modelContext(next).input);
 assert.match(nextPrompt, /癸丑运干癸是正官，生原月乙印，又克丙日元/u);
 assert.doesNotMatch(nextPrompt, /印如透干，再見官煞運|hasUnopposedAuthorityToExposedSeal/u);
});

test('the Chang diagram distinguishes an allowed authority stage from the incoming robbery that protects the same natal seals', () => {
 const date = [1951, 4, 3], run = submitted(date, 14, 1990);
 const boundary = '1990-07-16T02:00:00.000Z';
 const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '戊子');
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '丁亥');
 assert.ok(before && after);
 const p = before.normalizedPayload, q = after.normalizedPayload;
 assert.equal(p.natalPillarSequence, '辛卯辛卯癸酉己未');
 assert.equal(q.sourceWealthRole, 'disease');
 assert.equal(p.changSourceAuthoritySealCompatible, true);
 assert.equal(q.changSourceAuthoritySealCompatible, false);
 assert.equal(p.hasKillerSealPressure, true);
 for (const position of ['year', 'month']) assert.ok(p.killerSealPressure.some(path => path.seal.position === position
  && path.seal.stem === '辛' && path.killers.some(row => row.position === 'hour' && row.stem === '己')
  && path.moving.some(row => row.kind === '运干' && row.stem === '戊')));
 assert.equal(p.changSourceRobberyProtectingSeal, false);
 assert.equal(q.changSourceRobberyProtectingSeal, true);
 assert.equal(q.hasRobberyWithSeal, true);
 const [path] = q.robberyAgainstSealWealth;
 assert.deepEqual([path.robbery.stem, path.robbery.god, path.robbery.kind], ['壬', '劫财', '运支藏干']);
 assert.deepEqual(path.natalWealthPaths.filter(row => row.seal.kind === '透干').map(row =>
  [row.wealth.position, row.wealth.stem, row.seal.position, row.seal.stem]),
 [['hour', '丁', 'year', '辛'], ['hour', '丁', 'month', '辛']]);
 const [support, opposite, addedAuthority] = [46, 47, 65].map(index => match(run, index));
 assert.equal(support.status, 'matched');
 assert.equal(support.windows[0].start, boundary);
 assert.ok(support.sourceFactIds.includes(after.factId) && !support.sourceFactIds.includes(before.factId));
 assert.equal(opposite.status, 'not_matched');
 assert.equal(addedAuthority.status, 'not_matched');
 const message = formatFortunePrompt(modelContext(run).input);
 assert.match(message, /常国公原图.*身不强/u);
 assert.doesNotMatch(message, /changSourceRobberyProtectingSeal|changSourceAuthoritySealCompatible/u);
 const near = submitted(date, 16, 1990);
 assert.ok(rows(near).every(row => !row.normalizedPayload.changSourceRobberyProtectingSeal
  && !row.normalizedPayload.changSourceAuthoritySealCompatible));
 const unknown = ctx(native(['辛卯', '辛卯', '癸酉', '己未']), '丁亥', false);
 assert.equal(unknown.changSourceRobberyProtectingSeal, undefined);
 assert.equal(unknown.changSourceAuthoritySealCompatible, undefined);
});

test('p008 follows the reviewed Earth-output chart’s actual wealth into the Ren-Xu handoff', async () => {
 const run = submitted([1898, 7, 12], 4, 1927);
 const boundary = '1927-06-07T10:00:00.000Z';
 const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '辛酉');
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '壬戌');
 assert.ok(before && after);
 const p = before.normalizedPayload, q = after.normalizedPayload;
 assert.equal(p.natalPillarSequence, '戊戌己未丙子庚寅');
 assert.deepEqual([p.sourceHurtSealUse, q.sourceHurtSealUse], ['not-used', 'not-used']);
 assert.equal(p.liEarthOutputSourceWealth, true);
 assert.equal(q.liEarthOutputSourceWealth, false);
 assert.equal(p.hasWealthPressingMonthHurtSeal, true);
 const path = p.wealthPressesHurtSeal.find(row => row.hurt.position === 'month' && row.hurt.kind === '透干'
  && row.seal.position === 'hour' && row.seal.stem === '甲');
 assert.equal(path.hurt.stem, '己');
 assert.deepEqual(path.wealth.map(row => [row.stem, row.kind]), [['辛', '运干'], ['辛', '运支藏干']]);
 const hit = matchFortuneKnowledge(run).byMethod.bazi.find(row => row.knowledgeId.endsWith('zpqz-1936-interpretation-p008-001'));
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '四柱雖佩印而不為用');
 assert.equal(hit.windows.at(-1).endExclusive, boundary);
 assert.ok(hit.sourceFactIds.includes(before.factId) && !hit.sourceFactIds.includes(after.factId));
 assert.equal(match(run, 60).status, 'not_matched');
 const near = candidate(native(['戊戌', '己未', '丙子', '辛卯']), '辛酉');
 const older = candidate(native(['戊戌', '己未', '丙子', '庚寅']), '庚申');
 const rule = evaluateFortuneRules('bazi', 'year', [near, older]).find(row => row.knowledgeId === hit.knowledgeId);
 assert.ok(rule.required[0].hits.includes(near) && rule.required[0].hits.includes(older));
 assert.deepEqual(rule.confirmations[0].hits, [older]);
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
  const content = JSON.parse(options.body).messages[1].content;
  assert.match(content, /徐注在李君原例明列食伤太旺、虽带印却不能取印损食/u);
  assert.doesNotMatch(content, /liEarthOutputSourceWealth/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(modelContext(run).input);
});

test('the Boluo diagram keeps incoming support to the exposed seals separate from wealth pressure across the real handoff', async () => {
 const date = [1872, 6, 16], run = submitted(date, 16, 1909);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '庚戌');
 assert.equal(change?.exactInstant, '1909-04-21T20:00:00.000Z');
 const before = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '己酉');
 const after = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '庚戌');
 assert.ok(before && after);
 const natal = ['壬申', '丙午', '甲午', '壬申'];
 for (const [stage, authority, kind, wealth] of [[before, '辛', '运支藏干', '己'], [after, '庚', '运干', '戊']]) {
  const data = stage.normalizedPayload;
  assert.deepEqual(data.natalPillars.map(row => row.pillar), natal);
  assert.equal(data.boluoSourceSealInUse, true);
  assert.equal(data.boluoSourceAuthorityFeedsSeal, true);
  assert.ok(data.killerSealPressure.some(row => row.seal.stem === '壬' && row.seal.kind === '透干'
   && row.moving.some(row => row.stem === authority && row.kind === kind)));
  assert.ok(data.wealthPressesHurtSeal.some(row => row.hurt.position === 'month' && row.hurt.stem === '丁'
   && row.seal.stem === '壬' && row.wealth.some(row => row.stem === wealth)));
 }
 const matches = matchFortuneKnowledge(run).byMethod.bazi;
 assert.equal(matches[50].status, 'not_matched');
 assert.equal(matches[65].status, 'not_matched');
 assert.equal(before.normalizedPayload.boluoSourceXuWealthPressure, false);
 assert.equal(after.normalizedPayload.boluoSourceXuWealthPressure, true);
 assert.equal(before.normalizedPayload.boluoSourceXuWesternWealthAndSeal, true);
 assert.equal(after.normalizedPayload.boluoSourceXuWesternWealthAndSeal, false);
 assert.equal(ctx(native(natal), '戊申').boluoSourceXuWesternWealthAndSeal, true);
 assert.equal(matches[60].status, 'matched');
 assert.ok([before, after].every(fact => matches[60].sourceFactIds.includes(fact.factId)));
 for (const [fact, excerpt, localOnly, sourceNote] of [
  [before, '佩印而行財', /只核原例戌支的财印关系/u, /本气金又生同一两处壬印。徐注判此两步尚无大碍/u],
  [after, '佩印', /本气金又生同一两处壬印/u, /只核原例戌支的财印关系/u],
 ]) {
  const single = { ...run, facts: [fact] }, hit = match(single, 60);
  assert.equal(hit.matchedSourceExcerpt, excerpt);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = modelContext(single), provider = formatFortunePrompt(input);
  const westAudit = /孛罗原图同一步运干土克年、时两处壬印/u;
  assert.equal(westAudit.test(formatFortuneFactAudit(input)), fact === before);
  assert.doesNotMatch(provider, westAudit);
  assert.match(provider, sourceNote);
  assert.doesNotMatch(provider, localOnly);
 }
 const west = matches[60].confirmedBranches.find(branch => branch.sourceFactIds.includes(before.factId));
 const xu = matches[60].confirmedBranches.find(branch => branch.sourceFactIds.includes(after.factId));
 assert.equal(west.windows.at(-1).endExclusive, change.exactInstant);
 assert.equal(xu.windows[0].start, change.exactInstant);
 const earlier = submitted([2052, 7, 2], 16, 2073), westernCut = '2073-11-05T16:00:00.000Z';
 const wu = rows(earlier).find(row => row.normalizedPayload.luckPillar === '戊申' && row.activeTo === westernCut);
 const ji = rows(earlier).find(row => row.normalizedPayload.luckPillar === '己酉' && row.activeFrom === westernCut);
 assert.ok(wu && ji);
 for (const fact of [wu, ji]) {
  assert.equal(fact.normalizedPayload.boluoSourceXuWesternWealthAndSeal, true);
  const single = { ...earlier, facts: [fact] }, hit = match(single, 60);
  assert.equal(hit.matchedSourceExcerpt, '佩印而行財');
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
 }
 const changed = candidate(native([...natal.slice(0, 3), '癸酉']), '庚戌');
 const close = evaluateFortuneRules('bazi', 'year', [changed]);
 for (const index of [50, 65]) {
  const rule = close.find(row => row.knowledgeId === matches[index].knowledgeId);
  assert.deepEqual(rule.required[0].hits, [changed]);
 }
 assert.ok(close.find(row => row.knowledgeId === matches[60].knowledgeId).confirmations.every(branch => !branch.hits.length));
 assert.equal(ctx(native([...natal.slice(0, 3), '癸酉']), '己酉').boluoSourceXuWesternWealthAndSeal, false);
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
  const content = JSON.parse(options.body).messages[1].content;
  assert.match(content, /只核原例戌支的财印关系，庚运干另有生印方向/u);
  assert.match(content, /本气金又生同一两处壬印/u);
  assert.doesNotMatch(content, /boluoSourceXuWealthPressure|boluoSourceXuWesternWealthAndSeal/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(modelContext(run).input);
 const unknown = ctx(native(natal), '庚戌', false);
 assert.equal(unknown.boluoSourceSealInUse, undefined);
 assert.equal(unknown.boluoSourceAuthorityFeedsSeal, undefined);
 assert.equal(unknown.boluoSourceXuWesternWealthAndSeal, undefined);
});

test('p018 confirms incoming wealth contacting the reviewed commander seal only after the real Gui-Mao handover', () => {
 const date = [1957, 9, 13];
 for (const [hour, named] of [[0, true], [2, false]]) {
  const run = submitted(date, hour, 2009);
  const boundary = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸卯')?.exactInstant;
  assert.ok(boundary);
  if (named) assert.equal(boundary, '2009-04-10T16:00:00.000Z');
  const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '甲辰');
  const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '癸卯');
  assert.ok(before && after);
  assert.ok(before.normalizedPayload.remedyMovingComponents.slice(2).some(row => row.stem === '癸'));
  assert.equal(before.normalizedPayload.wealthHeavySourceHurtSealPressure, false);
  assert.equal(after.normalizedPayload.wealthHeavySourceHurtSealPressure, named);
  assert.ok(after.normalizedPayload.wealthPressesHurtSeal.some(path => path.monthHurt && path.hurt.stem === '辛'
   && path.seal.position === 'year' && path.seal.stem === '丁' && path.wealth.some(row => row.kind === '运干' && row.stem === '癸')));
  const hit = match(run, 60);
  assert.equal(hit.status, named ? 'matched' : 'partial');
  if (!named) continue;
  assert.equal(hit.matchedSourceExcerpt, '佩印而行財');
  assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: after.activeTo }]);
  assert.ok(!hit.sourceFactIds.includes(before.factId));
  const { input } = modelContext(run);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /都统制[^\n]*癸卯[^\n]+\n原文：佩印而行財/u);
  const localSealPressure = /都统制原图实交癸卯后/u;
  assert.match(formatFortuneFactAudit(input), localSealPressure);
  assert.doesNotMatch(prompt, localSealPressure);
  assert.doesNotMatch(prompt, /wealthHeavySourceHurtSealPressure|佩印而行財破印之地/u);
 }
 const unknown = ctx(native(['丁酉', '己酉', '戊子', '壬子']), '癸卯', false);
 assert.equal(unknown.wealthHeavySourceHurtSealPressure, undefined);
});

test('the named cold Bing diagram rules out both wealth readings in the same actual Ding-You luck', () => {
 const date = [1852, 3, 15];
 for (const [hour, natalHour, named] of [[22, '己亥', true], [2, '己丑', false]]) {
  const run = submitted(date, hour, 1905, 0);
  const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丁酉');
  assert.ok(change);
  const before = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '戊戌');
  const after = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '丁酉');
  assert.ok(before && after);
  const p = after.normalizedPayload;
  assert.deepEqual(p.natalPillars.map(row => row.pillar), ['壬子', '癸卯', '丙子', natalHour]);
  assert.equal(p.confirmed, true);
  assert.equal(p.coldBingSourceSealInUse, named);
  assert.ok(p.robberyAgainstSealWealth.some(path => path.robbery.stem === '丁' && path.robbery.kind === '运干'));
  assert.ok(p.wealthPressesHurtSeal.some(path => path.hurt.stem === '己' && path.hurt.position === 'hour'
   && path.seal.position === 'month' && path.seal.stem === '乙'
   && path.wealth.some(row => row.stem === '辛' && row.kind === '运支藏干')));
  const rules = matchFortuneKnowledge(run).byMethod.bazi;
  const bySource = passage => rules.find(row => row.knowledgeId.endsWith('zpqz-1936-interpretation-' + passage + '-001'));
  for (const id of ['p005', 'p008']) {
   const rule = bySource(id);
   assert.ok(!rule.sourceFactIds.includes(before.factId));
   assert.equal(rule.sourceFactIds.includes(after.factId), !named, id);
  }
  if (named) {
   assert.equal(p.coldBingSealComparison.seal.stem, '乙');
   assert.ok(bySource('p087').sourceFactIds.includes(after.factId));
   const audit = describeFortuneFact({ method: 'bazi', type: 'zpqz_seal_food_context', data: p }, String);
   assert.match(audit, /冷木丙火例先核.*卯.*乙/u);
   const { input } = modelContext(run);
   const materials = input.sections.flatMap(section => section.findings.map(finding => finding.knowledgeId));
   assert.ok(!['p005', 'p008', 'p087'].some(id => materials.includes(bySource(id).knowledgeId)));
  }
 }
 assert.equal(ctx(printed('cold-bing'), '丁酉', false).coldBingSourceSealInUse, undefined);
});

test('Fan retains the branch-wealth contacts in Zi and Hai without misclassifying the seal taken in the source', () => {
 const run = submitted([1937, 2, 11], 4, 1959);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '己亥');
 assert.equal(change?.exactInstant, '1959-04-23T18:00:00.000Z');
 const before = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '庚子');
 const after = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '己亥');
 assert.ok(before && after);
 const natal = ['丁丑', '壬寅', '己巳', '丙寅'];
 for (const [stage, wealth] of [[before, '癸'], [after, '壬']]) {
  const data = stage.normalizedPayload;
  assert.deepEqual(data.natalPillars.map(row => row.pillar), natal);
  assert.equal(data.fanSourceSealInUse, true);
  assert.ok(data.wealthPressesHurtSeal.some(path => path.hurt.stem === '庚'
   && path.seal.position === 'hour' && path.seal.stem === '丙' && path.wealth.some(row => row.kind === '运支藏干' && row.stem === wealth)));
  assert.ok(data.sealLuckEvidence.outputWealthSealPaths.some(path =>
   path.output.stem === '庚' && path.wealth.kind === '运支藏干' && path.wealth.stem === wealth && path.seal.position === 'month'));
  assert.ok(!data.sealLuckRoutes.includes('wealth-presses-seal-with-output'));
 }
 const matches = matchFortuneKnowledge(run).byMethod.bazi;
 assert.deepEqual([50, 130].map(index => matches[index].status), ['not_matched', 'not_matched']);
 const near = candidate(native([...natal.slice(0, 3), '丁卯']), '己亥');
 assert.equal(near.normalizedPayload.fanSourceSealInUse, false);
 const ordinary = evaluateFortuneRules('bazi', 'year', [near]);
 for (const index of [50, 130]) {
  const rule = ordinary.find(row => row.knowledgeId === matches[index].knowledgeId);
  assert.deepEqual(rule.required[0].hits, [near]);
 }
 assert.equal(ctx(native(natal), '己亥', false).fanSourceSealInUse, undefined);
});

test('the Qian diagram confirms pressure on its natal water seal and excludes the opposite wealth reading', () => {
 const date = [1906, 5, 20], run = submitted(date, 4, 1952);
 const handoff = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊戌');
 assert.equal(handoff?.exactInstant, '1952-04-28T20:00:00.000Z');
 const before = rows(run).find(row => row.activeTo === handoff.exactInstant && row.normalizedPayload.luckPillar === '丁酉');
 const after = rows(run).find(row => row.activeFrom === handoff.exactInstant && row.normalizedPayload.luckPillar === '戊戌');
 assert.ok(before && after);
 assert.equal(after.normalizedPayload.natalPillarSequence, '丙午癸巳甲子丙寅');
 assert.deepEqual([before, after].map(row => row.normalizedPayload.sourceHurtSealUse), ['used', 'used']);
 assert.ok(after.normalizedPayload.wealthPressesHurtSeal.some(({ hurt, seal, wealth }) => hurt.position === 'year' && hurt.stem === '丁'
  && seal.position === 'month' && seal.stem === '癸' && seal.kind === '透干'
  && wealth.some(row => row.kind === '运干' && row.stem === '戊')));
 const p = after.normalizedPayload, q = before.normalizedPayload;
 assert.equal(p.monthHurtCandidate, false);
 assert.equal(p.hasQianSourceWealthSealPressure, true);
 assert.equal(q.hasQianSourceWealthSealPressure, false);
 const { hurt, wealth, seal, root, combination } = p.qianSourceWealthSealPressure;
 assert.deepEqual([hurt.position, hurt.stem, seal.position, seal.stem, root.position, root.stem],
  ['year', '丁', 'month', '癸', 'day', '癸']);
 assert.deepEqual(wealth.map(w => [w.stem, w.kind]), [['戊', '运干'], ['戊', '运支藏干']]);
 assert.deepEqual([combination.moving.stem, combination.target.stem, combination.target.position], ['戊', '癸', 'month']);
 const confirmed = match(run, 60);
 assert.equal(confirmed.status, 'matched');
 assert.match(confirmed.matchedSourceExcerpt, /佩印而行財|破印恐不能免/u);
 assert.equal(confirmed.windows[0].start, handoff.exactInstant);
 assert.ok(confirmed.sourceFactIds.includes(after.factId) && !confirmed.sourceFactIds.includes(before.factId));
 const discarded = match(run, 50);
 assert.equal(discarded.status, 'not_matched');
 assert.ok(!evaluateFortuneRules('bazi', 'year', [after]).find(row => row.knowledgeId === discarded.knowledgeId).required[0].hits.length);
 const { input } = modelContext(run);
 assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== discarded.knowledgeId)));
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /钱参政原图.*癸印.*调候/u);
 assert.doesNotMatch(prompt, /qianSourceWealthSealPressure|hasQianSourceWealthSealPressure/u);

 const next = submitted(date, 4, 1962);
 const leaving = rows(next).find(row => row.normalizedPayload.luckPillar === '戊戌');
 const ending = rows(next).find(row => row.normalizedPayload.luckPillar === '己亥');
 assert.ok(leaving && ending);
 assert.equal(ending.normalizedPayload.hasQianSourceWealthSealPressure, false);
 const endingMatch = match(next, 60);
 assert.ok(endingMatch.sourceFactIds.includes(leaving.factId) && !endingMatch.sourceFactIds.includes(ending.factId));
 assert.ok(endingMatch.sourceFactIds.every(id => rows(next).some(row => row.factId === id
  && row.normalizedPayload.luckPillar === '戊戌' && row.normalizedPayload.hasQianSourceWealthSealPressure)));
 assert.equal(endingMatch.windows.at(-1).endExclusive, '1962-04-28T20:00:00.000Z');

 const near = submitted(date, 6, 1952);
 const altered = rows(near).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '戊戌');
 assert.ok(altered);
 assert.equal(altered.normalizedPayload.sourceHurtSealUse, 'undetermined');
 assert.equal(altered.normalizedPayload.hasQianSourceWealthSealPressure, false);
 assert.equal(match(near, 60).status, 'not_matched');
 const candidate = match(near, 50);
 assert.equal(candidate.status, 'partial');
 assert.ok(candidate.sourceFactIds.includes(altered.factId));
 const missingHour = ctx(native(['丙午', '癸巳', '甲子', '丙寅']), '戊戌', false);
 assert.equal(missingHour.sourceHurtSealUse, undefined);
 assert.equal(missingHour.hasQianSourceWealthSealPressure, undefined);
});

test('sixteen literal source diagrams retain order and the wealthy-son year/month mismatch without silently repairing a historical column',()=>{
 assert.deepEqual(zpqzSealFoodCases,ref.printedCases);
 for(const c of ref.printedCases){const p=ctx(native(c.pillars)),row=p.printedCases.find(r=>r.id===c.id);assert.equal(row.matches,true);assert.equal(row.stemCheck.yearMonthCompatible,c.id!=='wealth-seal');assert.equal(row.stemCheck.dayHourCompatible,true);}
 const check=zpqzColumnStemCheck(ref.printedCases.find(c=>c.id==='wealth-seal').pillars);assert.equal(check.expectedMonthStem,'戊');
 const d=describeFortuneFact({method:'bazi',type:'zpqz_seal_food_context',data:ctx(printed('wealth-seal'))},String);assert.match(d,/不合通常起月规则/u);assert.match(d,/不能当作已复原有效生日/u);
});

test('source stem pairing checks agree with real ephemeris-free calendars over all sixty year stems/branches and early-year and hour boundaries',()=>{
 for(let y=1984;y<2044;y++)for(const m of [1,3,9])for(const h of [0,16]){const l=Solar.fromYmdHms(y,m,15,h,0,0).getLunar();
  const check=zpqzColumnStemCheck([l.getYearInGanZhiExact(),l.getMonthInGanZhiExact(),l.getDayInGanZhiExact(),l.getTimeInGanZhi()]);assert.equal(check.yearMonthCompatible,true);assert.equal(check.dayHourCompatible,true);
 }
 for(const bad of [[],['甲丑','丙寅','甲子','甲子']])assert.throws(()=>zpqzColumnStemCheck(bad));
});

test('all ten day stems distinguish seals, food and hurt in visible versus concealed positions without counting the day-master as another exposed peer',()=>{
 const stems='甲乙丙丁戊己庚辛壬癸';for(const day of stems){const p=ctx(native(['庚申','戊寅',day+(stems.indexOf(day)%2?'丑':'子'),'壬子']));
  assert.equal(p.gods.length,10);for(const row of p.gods){assert.equal(row.exposed,row.exposedRows.length>0);assert.equal(row.hidden,row.hiddenRows.length>0);assert.ok(row.exposedRows.every(r=>r.position!=='day'));}
 }
});

test('hidden food with an already exposed hurting stem is the rescue branch, not the source all-outputs-unexposed branch',()=>{
 const n=native(ref.calendarExamples[55].natal),p=ctx(n);assert.equal(p.hiddenFoodNoExposedOutputs,true);assert.equal(p.foodHidden,true);
 const hurt=ctx({...n,hour:'甲寅'});assert.equal(god(hurt,'伤官').exposed,true);assert.equal(hurt.hiddenFoodNoExposedOutputs,false);
 const missing=ctx({...n,hour:'甲寅'},'甲子',false);assert.equal(missing.hiddenFoodNoExposedOutputs,undefined);assert.equal(god(missing,'伤官').exposed,undefined);
 const reverse=ctx(native(['庚子','戊寅','癸未','甲寅']));assert.equal(reverse.sealExposedHurtOnlyHidden,false);
});

test('Mao diagram has no exposed output but explicitly retains hidden Yi food in Wei and Bing wealth in Si',()=>{
 const p=ctx(printed('mao'));assert.equal(p.maoSkeleton,true);assert.equal(p.outputsExposed,false);assert.equal(p.foodHidden,true);
 assert.ok(god(p,'食神').hiddenRows.some(r=>r.position==='day'&&r.branch==='未'&&r.stem==='乙'));
 assert.ok(god(p,'正财').hiddenRows.some(r=>r.position==='year'&&r.branch==='巳'&&r.stem==='丙'));
 assert.equal(p.wealthExposed,false);assert.equal(p.wealthHidden,true);assert.equal(p.visibilityInterpretationVerified,false);
});

test('Zhang concealed Gui food and Zhu exposed Ren hurt retain different identities, and distance alone cannot prove effective protection',()=>{
 const zhang=ctx(printed('zhang')),zhu=ctx(printed('zhu')),lin=ctx(printed('linhuai'));
 assert.ok(god(zhang,'食神').hiddenRows.some(r=>r.position==='hour'&&r.stem==='癸'));assert.equal(god(zhang,'伤官').exposed,false);
 assert.ok(god(zhu,'伤官').exposedRows.some(r=>r.position==='hour'&&r.stem==='壬'));
 const pair=zhu.sealOutputContacts.find(c=>c.from.kind==='透干'&&c.from.stem==='戊'&&c.to.kind==='透干'&&c.to.stem==='壬');assert.equal(pair.columnDistance,2);assert.deepEqual(pair.between.map(r=>r.position),['day']);
 assert.ok(lin.sealOutputContacts.some(c=>c.from.position==='year'&&c.to.position==='month'&&c.bothExposed&&c.columnDistance===1));
 for(const p of [zhang,zhu,lin])assert.equal(p.protectionVerified,false);
});

test('Li branch uses the actual Yi-Mao month, Bing-Wu day and named exposed Wu food as Gui combination target, with no effective transformation claim',()=>{
 const p=ctx(printed('li'),'癸丑');assert.equal(p.liSkeleton,true);assert.equal(p.liGuiCombinesExposedFood,true);
 const pair=p.movingFivePairs.find(c=>c.target.stem==='戊'&&c.target.tenGod==='食神');assert.equal(pair.target.position,'year');assert.equal(pair.targetIsDayMaster,false);
 const wrong=ctx({...printed('li'),month:'乙酉'},'癸丑');assert.equal(wrong.liSkeleton,false);assert.equal(p.transformationVerified,false);
 assert.equal(ctx(printed('li'),'壬子').luckTenGod,'七杀');
});

test('Ma source Shen-Chen members are incomplete until actual Zi luck supplies Zi, and first-completion never proves transforming the seal into a peer',()=>{
 const p=ctx(printed('ma'),'庚子');assert.equal(p.maSkeleton,true);assert.equal(p.nativeGroupComplete,false);assert.equal(p.groupComplete,true);assert.equal(p.groupCompletedByLuck,true);
 assert.deepEqual(p.shenZiChen.find(r=>r.branch==='申').natalPositions,['month']);assert.deepEqual(p.shenZiChen.find(r=>r.branch==='辰').natalPositions,['day']);assert.equal(p.shenZiChen.find(r=>r.branch==='子').luckPresent,true);
 assert.equal(ctx(printed('ma'),'丁未').groupComplete,false);assert.equal(p.transformationVerified,false);
 const full=ctx({...printed('ma'),hour:'庚子'},'甲子');assert.equal(full.nativeGroupComplete,true);assert.equal(full.groupCompletedByLuck,false);
});

test('fourteen real calendars retain verified candidates while near diagrams cannot match named readings',()=>{
 for(const i of indices){const e=ref.calendarExamples[i],chart=archive(e);assert.deepEqual(layers.map(k=>chart.bazi.rawResult[0][k]),e.natal,String(i));
  const run=real(i);validateFortuneFacts(run);assert.notEqual(run.methods.bazi.status,'failed');
  assert.equal(match(run,i).status,namedSourceIndices.has(i)?'not_matched':completeComparisonIndices.has(i)||[121,130].includes(i)?'matched':'partial',String(i));
  const selected=rows(run).filter(f=>f.normalizedPayload.confirmed&&f.normalizedPayload.luckPillar===e.luck);assert.ok(selected.length,String(i));
  for(const f of selected){assert.equal(f.normalizedPayload.profile,zpqzSealFoodPolicy.profile);assert.deepEqual(f.normalizedPayload.natalPillars.map(p=>p.pillar),e.natal);assert.ok(f.normalizedPayload.stageStart<=f.activeFrom&&f.activeTo<=f.normalizedPayload.stageEnd);assert.ok(f.sourceFactIds.every(id=>run.rawFacts.some(raw=>raw.rawFactId===id)));}
 }
});

test('p003 follows the moving killer to the exact exposed seal that checks the hidden hurt', () => {
 const { run, fact } = submittedCalendar({ ...ref.calendarExamples[45], year: 1998 });
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丙子');
 assert.ok(change);
 const hit = match(run, 45);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows.at(-1).endExclusive, change.exactInstant);
 assert.deepEqual(fact.normalizedPayload.officerSealExposureRoutes, ['shown-seal-hidden-hurt-authority']);
 const path = fact.normalizedPayload.monthOfficerSealLuck.find(row => row.seal.stem === '庚' && row.hurt.position === 'month');
 assert.equal(path.exposedSeal, true);
 assert.deepEqual([path.officer.position, path.officer.stem, path.officer.kind], ['month', '戊', '支藏']);
 assert.deepEqual([path.seal.position, path.seal.kind, path.hurt.stem, path.hurt.kind], ['year', '透干', '甲', '支藏']);
 assert.deepEqual(path.officersFeedingSeal.map(row => [row.stem, row.god, row.kind]), [['己', '七杀', '运支藏干']]);
 const { input } = modelContext(run);
 assert.ok(input.facts.some(row => row.type === 'zpqz_seal_food_context' && row.endExclusive === change.exactInstant
  && row.data.monthOfficerSealLuck.length));
 assert.match(formatFortuneFactAudit(input), /印露伤藏的实际柱位为年柱庚申透干庚.*克月柱戊寅支藏甲.*生同一处原印/u);
});

test('p003 distinguishes the exposed-hurt branch with entering authority and with entering wealth', () => {
 const { run, fact } = submittedCalendar({ date: [1985, 2, 13], hour: 4, gender: 1, year: 1990, luck: '丁丑', natal: ['乙丑', '戊寅', '癸未', '甲寅'] });
 const hit = match(run, 45);
 assert.equal(hit.status, 'matched');
 assert.ok(hit.sourceFactIds.includes(fact.factId));
 assert.deepEqual(fact.normalizedPayload.officerSealExposureRoutes,
  ['shown-hurt-hidden-seal-authority', 'shown-hurt-hidden-seal-wealth']);
 const path = fact.normalizedPayload.monthOfficerSealLuck.find(row => row.hurt.position === 'hour' && row.seal.position === 'year');
 assert.equal(path.exposedSeal, false);
 assert.deepEqual([path.hurt.stem, path.hurt.kind, path.seal.stem, path.seal.kind], ['甲', '透干', '辛', '支藏']);
 assert.ok(path.officersFeedingSeal.some(row => row.stem === '己' && row.god === '七杀'));
 assert.ok(path.wealthFacingSeal.some(row => row.stem === '丁' && row.kind === '运干'));
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.match(prompt, /伤露印藏的实际柱位为年柱乙丑支藏辛.*时柱甲寅透干甲/u);
 assert.match(prompt, /丁丑运干丁.*克此处藏印/u);
});

test('p013 binds hidden food and monthly wealth to an incoming killer and closes at the actual transition', () => {
 const example = ref.calendarExamples[55];
 const { run, fact } = submittedCalendar({ ...example, year: 1998 });
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丙子');
 assert.ok(change);
 const hit = match(run, 55);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows.at(-1).endExclusive, change.exactInstant);
 const [path] = fact.normalizedPayload.wealthWithArrivingKiller;
 assert.deepEqual([path.wealth.position, path.wealth.stem, path.killer.stem, path.killer.kind], ['month', '丙', '己', '运支藏干']);
 assert.ok(path.hiddenFoodFeedingWealth.some(row => row.position === 'hour' && row.stem === '乙'));
 assert.ok(path.hiddenFoodFacingKiller.some(row => row.position === 'hour' && row.stem === '乙'));
 assert.deepEqual(path.exposedOutputFacingKiller, []);
 const { input } = modelContext(run);
 assert.ok(input.facts.some(row => row.type === 'zpqz_seal_food_context' && row.endExclusive === change.exactInstant
  && row.data.wealthWithArrivingKiller.length));
 assert.match(formatFortuneFactAudit(input), /月柱戊寅支藏丙.*本步大运丁丑运支藏干己.*同一个运杀也克日元/u);
});

test('p013 excludes the chart with exposed hurting officer even though the same original hidden food remains', () => {
 const example = { date: [1990, 2, 7], hour: 8, gender: 0, year: 1994, luck: '丁丑', natal: ['庚午', '戊寅', '癸卯', '丙辰'] };
 const hidden = submittedCalendar(example);
 const exposed = submittedCalendar({ ...example, hour: 4, natal: ['庚午', '戊寅', '癸卯', '甲寅'] });
 assert.equal(match(hidden.run, 55).status, 'matched');
 assert.equal(match(exposed.run, 55).status, 'not_matched');
 assert.equal(exposed.fact.normalizedPayload.foodHidden, true);
 assert.equal(exposed.fact.normalizedPayload.hiddenFoodNoExposedOutputs, false);
 const [path] = exposed.fact.normalizedPayload.wealthWithArrivingKiller;
 assert.ok(path.hiddenFoodFeedingWealth.some(row => row.position === 'day' && row.stem === '乙'));
 assert.deepEqual(path.exposedOutputFacingKiller.map(row => [row.position, row.stem, row.god]), [['hour', '甲', '伤官']]);
 assert.match(formatFortuneFactAudit(modelContext(exposed.run).input), /已明透的时柱甲寅透干甲.*另有回克同一运杀的方向/u);
});

test('all source hashes survive SQLite import and wrong-profile, generic or split premises cannot fabricate an atomic seal-protection case',()=>{
 for(const i of indices){const r=fortuneKnowledge.bazi.rules[i],e=fortuneKnowledge.bazi.entries.find(e=>e.id===r.knowledgeId);assert.equal(r.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:e.evidence,conditions:e.conditions})).digest('hex'));assert.equal(r.queries[0].factType,'zpqz_seal_food_context');assert.equal(r.unresolved.length,namedSourceIndices.has(i)||completeComparisonIndices.has(i)?0:1);}
 const absent=structuredClone(real(45));absent.facts=absent.facts.filter(f=>f.factType!=='zpqz_seal_food_context');assert.equal(match(absent,45).status,'unknown');
 const wrong=structuredClone(real(45));rows(wrong).forEach(f=>f.normalizedPayload.profile='other');assert.equal(match(wrong,45).status,'not_matched');
 const split=structuredClone(real(45));for(const f of [...rows(split)]){const other=structuredClone(f);other.factId+='-separate';other.normalizedPayload.monthOfficerCandidate=false;f.normalizedPayload.officerSealExposureRoutes=[];split.facts.push(other);}assert.equal(match(split,45).status,'not_matched');
});

test('unknown hour cannot prove a complete source diagram or global lack of a visible role',()=>{
 const p=ctx(printed('mao'),'甲子',false);assert.equal(p.maoSkeleton,undefined);assert.equal(p.printedCases.find(c=>c.id==='mao').matches,undefined);assert.equal(god(p,'正印').exposed,undefined);
 assert.ok(p.gods.every(g=>g.exposedRows.every(r=>r.position!=='hour')&&g.hiddenRows.every(r=>r.position!=='hour')));
 for(const bad of ['甲丑','甲','bad'])assert.throws(()=>ctx(printed('mao'),bad));
});

test('actual provider gets natural Chinese target columns, exposure and unresolved meanings, not raw machine JSON or partial source paragraphs',async()=>{
 const run=real(123),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'seal-private-report'));assert.ok(input.facts.some(f=>f.type==='zpqz_seal_food_context'));
 const prompt=formatFortuneFactAudit(input);for(const t of ['乙卯月、丙午日和戊己明透','食神与伤官都未明透','戊癸五合位置','不表示已经合去或化劫','印重可取财与印轻忌财是相反条件','至少一端是支藏'])assert.ok(prompt.includes(t),t);
 for(const secret of ['zpqz-seal-output','seal-private','sealExposedHurtOnlyHidden','printedCases','liGuiCombinesExposedFood','columnDistance','stageStart'])assert.ok(!prompt.includes(secret),secret);
 assert.ok(!input.sections.flatMap(s=>s.findings).some(f=>indices.some(i=>f.knowledgeId===fortuneKnowledge.bazi.rules[i].knowledgeId)));
 const d=describeFortuneFact({method:'bazi',type:'zpqz_seal_food_context',data:ctx(printed('mao'))},String);assert.ok(!/[{}\[\]]/u.test(d));
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await provider.interpret(input);
});

test('the 35 documented stages retain their source readings, with the Wang warning outside the relief match', () => {
 const reviews = [
  [119, 'zhang', ['己亥', '庚子', '辛丑', '壬寅', '癸卯', '甲辰']],
  [120, 'zhu', ['己亥', '庚子', '壬寅', '癸卯', '甲辰']],
  [122, 'li', ['丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉']],
  [125, 'mao', ['庚午', '己巳', '丁卯', '辛未', '戊辰']],
  [126, 'ma', ['壬子', '甲寅']],
  [128, 'wang', ['乙未', '甲午', '癸巳', '壬辰', '辛卯', '庚寅'], ['乙未', '甲午', '癸巳', '辛卯', '庚寅']],
  [130, 'niu', ['丁亥', '戊子', '己丑', '庚寅', '辛卯'], []],
 ];
 for (const [index, id, movements, matching = movements] of reviews) {
  const natal = printed(id);
  const rule = fortuneKnowledge.bazi.rules[index];
  const [reading] = rule.review.printedLuck;
  assert.equal(reading.natalPillarSequence, Object.values(natal).join(''));
  assert.deepEqual(reading.periods.flatMap(period => period.pillars), movements);
  const accepted = movements.map(luck => candidate(natal, luck));
  const rejected = [candidate(natal, movements[0], false), candidate(natal, movements[0], true, false)];
  const result = evaluateFortuneRules('bazi', 'year', [...accepted, ...rejected]).find(row => row.knowledgeId === rule.knowledgeId);
  assert.deepEqual(result.required[0].hits.map(fact => fact.normalizedPayload.luckPillar), matching, id);
  assert.ok(result.required[0].hits.every(fact => accepted.includes(fact)), id);
  assert.equal(result.unresolved.length, namedSourceIndices.has(index) ? 0 : 1, id);
 }
 assert.equal(reviews.reduce((count, row) => count + row[2].length, 0), 35);
});

test('the Ma Zi-luck comparison requires actual completion of missing native Zi', () => {
 const ma = printed('ma');
 const completes = candidate(ma, '壬子');
 const alreadyComplete = candidate({ ...ma, hour: '庚子' }, '壬子');
 const wrongBranch = candidate(ma, '己酉');
 assert.equal(completes.normalizedPayload.groupCompletedByLuck, true);
 assert.equal(alreadyComplete.normalizedPayload.nativeGroupComplete, true);
 assert.equal(alreadyComplete.normalizedPayload.groupCompletedByLuck, false);
 assert.ok(!alreadyComplete.normalizedPayload.sealLuckRoutes.includes('ma-zi-completes'));
 assert.ok(alreadyComplete.normalizedPayload.sealLuckRoutes.includes('ma-output-or-peer'));
 const id = fortuneKnowledge.bazi.rules[126].knowledgeId;
 const result = evaluateFortuneRules('bazi', 'year', [completes, alreadyComplete, wrongBranch]).find(row => row.knowledgeId === id);
 assert.deepEqual(result.required[0].hits.map(row => row.normalizedPayload.nativeGroupComplete), [false]);
 assert.equal(completes.normalizedPayload.transformationVerified, false);
});

test('a named exposed officer feeds the month seal and the p079 wealth confirmation requires the same endpoints', () => {
 const officer = submittedCalendar(ref.calendarExamples[119]);
 const hit = match(officer.run, 119);
 assert.equal(hit.status, 'partial');
 assert.ok(hit.sourceFactIds.includes(officer.fact.factId));
 assert.ok(officer.evidence.officerToMonthSeal.some(link => link.from.position === 'hour' && link.from.stem === '壬'
  && link.to.position === 'month' && link.to.stem === '甲'));
 assert.ok(officer.evidence.dayFeedsMovingOutput.some(link => link.from.stem === '丁' && link.to.stem === '己'));
 assert.ok(officer.evidence.officerMonthSealRelays.some(path => path.officer.stem === '壬' && path.seal.stem === '甲'
  && path.day.stem === '丁' && path.incomingOutput.some(row => row.stem === '己')));

 const base = ref.calendarExamples[120], guarded = submittedCalendar(base);
 assert.equal(match(guarded.run, 120).status, 'not_matched');
 assert.equal(match(guarded.run, 121).status, 'matched');
 assert.ok(match(guarded.run, 121).sourceFactIds.includes(guarded.fact.factId));
 assert.deepEqual(guarded.evidence.wealthControlsGuard.map(row => [row.seal.stem, row.hurt.stem, row.officer.stem, row.moving.stem,
  row.hurtFeedsWealth, row.wealthFeedsOfficer]), [['庚', '乙', '己', '丁', true, true]]);
 const wrong = submittedCalendar({ ...base, hour: 16, natal: [...base.natal.slice(0, 3), '戊申'] });
 assert.deepEqual(wrong.evidence.wealthControlsGuard, []);
 assert.equal(match(wrong.run, 120).status, 'not_matched');
 assert.equal(match(wrong.run, 121).status, 'not_matched');
});

test('p079 and p088 verify their distinct seal endpoints on the same actual Ren-Wu wealth handoff', async () => {
 const run = submitted([1980, 9, 16], 18, 2003, 0);
 const boundary = '2003-09-06T00:00:00.000Z';
 const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '癸未');
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '壬午');
 assert.ok(before && after);
 const p = after.normalizedPayload, q = before.normalizedPayload;
 assert.equal(p.natalPillarSequence, '庚申乙酉壬辰己酉');
 assert.deepEqual([p.hasGuardOutputWealthToSeal, p.hasExposedOutputWealthToMonthSeal], [true, true]);
 assert.deepEqual([q.hasGuardOutputWealthToSeal, q.hasExposedOutputWealthToMonthSeal], [false, false]);
 const [guard] = p.sealLuckEvidence.wealthControlsGuard;
 const exact = p.sealLuckEvidence.outputWealthSealPaths.find(row => row.output.position === 'month' && row.output.kind === '透干');
 assert.deepEqual([guard.hurt.stem, guard.moving.stem, guard.officer.stem, guard.seal.position, guard.seal.stem],
  ['乙', '丁', '己', 'year', '庚']);
 assert.deepEqual([exact.day.stem, exact.seal.position, exact.seal.stem], ['壬', 'month', '辛']);
 assert.deepEqual(exact.wealth, guard.moving);
 assert.deepEqual(exact.output, guard.hurt);
 for (const [i, excerpt] of [[121, '財運'], [130, '見財']]) {
  const hit = match(run, i);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, excerpt);
  assert.equal(hit.windows[0].start, boundary);
  assert.ok(hit.sourceFactIds.includes(after.factId) && !hit.sourceFactIds.includes(before.factId));
 }
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
  const message = JSON.parse(options.body).messages[1].content;
  assert.match(message, /原局同一透食伤也克原透正官，该官又受同一实运财生/u);
  assert.match(message, /是否取食伤为用、原印轻重及实际影响仍须依原条另核/u);
  assert.doesNotMatch(message, /hasGuardOutputWealthToSeal|hasExposedOutputWealthToMonthSeal/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(modelContext(run).input);
});

test('the Zhao chapter reading excludes five incorrect seal candidates across verified stages using the same native chart', () => {
 const date = [1966, 2, 16];
 const stages = [
  { year: 1992, before: '壬辰', after: '癸巳', cut: '1992-02-09T08:00:00.000Z', excluded: [119] },
  { year: 2002, before: '癸巳', after: '甲午', cut: '2002-02-09T08:00:00.000Z', excluded: [46, 47] },
  { year: 2022, before: '乙未', after: '丙申', cut: '2022-02-09T08:00:00.000Z', excluded: [50, 119, 130] },
 ];
 for (const { year, before, after, cut, excluded } of stages) {
  const run = submitted(date, 10, year);
  const facts = rows(run);
  assert.ok(facts.some(row => row.activeTo === cut && row.normalizedPayload.luckPillar === before));
  assert.ok(facts.some(row => row.activeFrom === cut && row.normalizedPayload.luckPillar === after));
  assert.ok(facts.every(row => row.normalizedPayload.natalPillarSequence === '丙午庚寅丙午癸巳'
    && row.normalizedPayload.monthSealCandidate && row.normalizedPayload.zhaoSourceMonthSealNotTaken));
  const actual = matchFortuneKnowledge(run).byMethod.bazi;
  const priorRules = { ...run, facts: facts.map(row => ({
   ...row, normalizedPayload: { ...row.normalizedPayload, zhaoSourceMonthSealNotTaken: false },
  })) };
  const prior = matchFortuneKnowledge(priorRules).byMethod.bazi;
  for (const index of excluded) {
   assert.equal(prior[index].status, 'partial');
   assert.equal(actual[index].status, 'excluded');
  }
  for (const index of [48, 49, 60, 65, 121, 129]) {
   assert.equal(actual[index].status, 'not_matched');
  }
 }
 const zhao = native(['丙午', '庚寅', '丙午', '癸巳']);
 assert.equal(ctx(zhao, '丙申', false).zhaoSourceMonthSealNotTaken, undefined);
 assert.equal(ctx({ ...zhao, hour: '壬辰' }, '丙申').zhaoSourceMonthSealNotTaken, false);
});

test('the Sun chapter reading excludes ordinary wealth paths and verifies the actual Jia combination', () => {
 const date = [1985, 5, 30], pillars = ['乙丑', '辛巳', '己巳', '庚午'];
 const cases = [
  { year: 2033, prior: '丁丑', luck: '丙子', excluded: [50, 130] },
  { year: 2053, prior: '乙亥', luck: '甲戌', excluded: [47] },
 ];
 for (const { year, prior, luck, excluded } of cases) {
  const run = submitted(date, 12, year);
  const cut = year + '-08-10T16:00:00.000Z';
  const before = rows(run).find(row => row.normalizedPayload.luckPillar === prior && row.activeTo === cut);
  const after = rows(run).find(row => row.normalizedPayload.luckPillar === luck && row.activeFrom === cut);
  assert.ok(before && after);
  const data = after.normalizedPayload;
  assert.equal(data.natalPillarSequence, pillars.join(''));
  assert.equal(data.sunSourceSealInUse, true);
  const review = data.sunSourceSealReview;
  assert.deepEqual([review.seal, review.killer, review.output].map(row => [row.position, row.stem, row.kind]),
   [['month', '丙', '支藏'], ['year', '乙', '透干'], ['hour', '庚', '透干']]);
  assert.equal(data.sunSourceJiaOfficerCombinesDay, luck === '甲戌');
  assert.equal(before.normalizedPayload.sunSourceJiaOfficerCombinesDay, false);
  if (luck === '甲戌') {
   const combination = review.jiaOfficerCombination;
   assert.deepEqual([combination.moving.stem, combination.target.position, combination.target.stem], ['甲', 'day', '己']);
   assert.equal(data.hasRobberyWithSeal, true);
   assert.equal(data.hasKillerSealPressure, true);
  } else {
   assert.deepEqual(review.movingWealth.map(({ wealth, fedByOutput }) => [wealth.stem, fedByOutput.map(row => row.stem)]),
    [['癸', ['辛', '庚']]]);
  }
  const isolated = { ...run, facts: [after] };
  const legacy = { ...run, facts: [{ ...after, normalizedPayload: { ...data,
   sunSourceSealInUse: false, sunSourceJiaOfficerCombinesDay: false } }] };
  const eligible = matchFortuneKnowledge(legacy).byMethod.bazi;
  const checked = matchFortuneKnowledge(isolated).byMethod.bazi;
  const { input } = modelContext(isolated);
  const findings = input.sections.flatMap(section => section.findings);
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /孙布政原评取.*通关/u);
  assert.doesNotMatch(formatFortunePrompt(input), /孙布政原评取|sunSourceSealReview/u);
  if (luck === '甲戌') assert.match(audit, /运干甲官与日主己相合/u);
  for (const index of excluded) {
   assert.equal(eligible[index].status, index === 130 ? 'matched' : 'partial', index);
   assert.equal(checked[index].status, 'excluded', index);
   assert.ok(!findings.some(row => row.knowledgeId === checked[index].knowledgeId), index);
  }
  if (luck === '甲戌') {
   assert.equal(eligible[65].status, 'partial');
   assert.equal(checked[65].status, 'matched');
   assert.match(checked[65].matchedSourceExcerpt, /混煞為嫌/u);
   assert.match(checked[65].matchedConditions.join(''), /甲.*己/u);
   assert.match(formatFortunePrompt(input), /逢甲為官，合已混煞為嫌/u);
   const priorStage = matchFortuneKnowledge({ ...run, facts: [before] }).byMethod.bazi;
   assert.equal(priorStage[65].status, 'partial');
   for (const index of [50, 130]) assert.equal(priorStage[index].status, 'excluded', index);
  }
  assert.equal(checked[46].status, eligible[46].status);
 }
 const near = submitted(date, 14, 2033);
 const nearFact = rows(near).find(row => row.normalizedPayload.luckPillar === '丙子');
 assert.ok(nearFact);
 assert.equal(nearFact.normalizedPayload.sunSourceSealInUse, false);
 assert.equal(nearFact.normalizedPayload.sunSourceJiaOfficerCombinesDay, false);
 const nearbyWealth = match({ ...near, facts: [nearFact] }, 130);
 assert.equal(nearbyWealth.status, 'matched');
 assert.equal(nearbyWealth.matchedSourceExcerpt, '見財');
 assert.equal(ctx(native(pillars), '甲戌', false).sunSourceSealInUse, undefined);
 assert.equal(ctx(native(pillars), '甲戌', false).sunSourceJiaOfficerCombinesDay, undefined);
});

test('the confirmed Zhang wealth stages require a real wealth contact and end at the Yi-Si handoff', async () => {
 const run = submitted([1866, 10, 13], 0, 1935);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '乙巳');
 assert.equal(change?.exactInstant, '1935-06-06T00:00:00.000Z');
 const before = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '甲辰');
 const after = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '乙巳');
 assert.ok(before && after);
 for (const { normalizedPayload: chart } of [before, after]) {
  assert.ok(chart.confirmed);
  assert.equal(chart.natalPillarSequence, '丙寅戊戌辛酉戊子');
  assert.equal(chart.sealLuckEvidence.zhangDayRoot.stem, '辛');
  assert.equal(chart.sealLuckEvidence.zhangOutput.stem, '癸');
  assert.equal(chart.zhangSourceOutputInsteadOfSeal, true);
  assert.ok(!chart.sealLuckRoutes.includes('officer-seal-wealth-output'));
 }
 assert.ok(before.normalizedPayload.sealLuckRoutes.includes('zhang-reviewed-output'));
 assert.equal(before.normalizedPayload.hasZhangReviewedWealth, true);
 assert.ok(!after.normalizedPayload.sealLuckRoutes.includes('zhang-reviewed-output'));
 assert.equal(after.normalizedPayload.hasZhangReviewedWealth, false);
 assert.ok(after.normalizedPayload.sealLuckEvidence.officerMonthSealRelays.some(path =>
  path.seal.position === 'month' && path.seal.stem === '戊' && path.incomingWealth.some(row => row.stem === '乙')));
 assert.ok(after.normalizedPayload.killerSealPressure.some(path => path.seal.position === 'month' && path.seal.stem === '戊'
  && path.moving.some(row => row.kind === '运支藏干' && row.stem === '丙')));
 assert.equal(match(run, 65).status, 'not_matched');
 const result = match(run, 119);
 assert.equal(result.status, 'matched');
 assert.equal(result.matchedSourceExcerpt, '官露印重，財運反吉');
 assert.ok(result.sourceFactIds.includes(before.factId) && !result.sourceFactIds.includes(after.factId));
 assert.equal(result.windows.at(-1).endExclusive, change.exactInstant);
 const near = candidate({ ...printed('zhang'), hour: '己丑' }, '乙巳');
 assert.ok(near.normalizedPayload.sealLuckRoutes.includes('officer-seal-wealth-output'));
 assert.equal(near.normalizedPayload.zhangSourceOutputInsteadOfSeal, false);
 const unknown = ctx(printed('zhang'), '甲辰', false);
 assert.ok(!unknown.sealLuckRoutes.includes('zhang-reviewed-output'));
 assert.equal(unknown.hasZhangReviewedWealth, undefined);
 assert.equal(unknown.zhangSourceOutputInsteadOfSeal, undefined);
 const { input } = modelContext(run);
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
  const content = JSON.parse(options.body).messages[1].content;
  assert.match(content, /张参政原图年丙官透，原评按身旺印强而取时子藏癸泄秀/u);
  assert.doesNotMatch(content, /zhang-reviewed-output|zhangDayRoot/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(input);

 const early = submitted([2046, 10, 29], 0, 2060);
 const waterEvidence = rows(early).filter(row => ['己亥', '庚子'].includes(row.normalizedPayload.luckPillar));
 assert.deepEqual([...new Set(waterEvidence.map(row => row.normalizedPayload.luckPillar))], ['己亥', '庚子']);
 for (const { normalizedPayload: p } of waterEvidence) {
  assert.equal(p.natalPillarSequence, '丙寅戊戌辛酉戊子');
  assert.ok(p.sealLuckRoutes.includes('zhang-reviewed-output'));
  assert.equal(p.hasZhangReviewedWealth, false);
  assert.equal(p.hasZhangReviewedOutputSupport, true);
  assert.ok(p.sealLuckEvidence.officerMonthSealRelays.some(row => row.officer.stem === '丙' && row.seal.stem === '戊'
   && row.incomingOutput.some(output => output.kind === '运支藏干' && output.stem === (p.luckPillar === '己亥' ? '壬' : '癸'))));
 }
 const robbery = waterEvidence.find(fact => fact.normalizedPayload.luckPillar === '庚子').normalizedPayload;
 assert.ok(robbery.hasRobberyAgainstNatalSealWealth);
 assert.ok(robbery.robberyAgainstSealWealth.some(path => path.robbery.stem === '庚'
  && path.natalWealthPaths.some(({ wealth }) => wealth.position === 'year' && wealth.stem === '甲')));
 assert.equal(match(early, 46).status, 'not_matched');
 assert.equal(match(early, 47).status, 'not_matched');
 const outputHit = match(early, 119);
 assert.equal(outputHit.status, 'matched');
 assert.equal(outputHit.matchedSourceExcerpt, '官露印重');
 const waterChange = '2060-01-08T20:00:00.000Z';
 const hai = outputHit.confirmedBranches.find(branch => branch.windows.at(-1).endExclusive === waterChange);
 const zi = outputHit.confirmedBranches.find(branch => branch.windows[0].start === waterChange);
 assert.match(hai.conditions.join(''), /亥.*壬/u);
 assert.match(zi.conditions.join(''), /子.*癸/u);
 const earlyInput = modelContext(early).input;
 assert.match(formatFortuneFactAudit(earlyInput), /张例日酉藏辛生时子藏癸/u);
 const localSourceChoice = /张参政原图按徐注取时支食神泄秀/u;
 assert.match(formatFortuneFactAudit(earlyInput), localSourceChoice);
 assert.doesNotMatch(formatFortunePrompt(earlyInput), localSourceChoice);
 assert.doesNotMatch(formatFortunePrompt(earlyInput), /財運反吉|zhangDayRoot|hasZhangReviewedOutputSupport/u);
 const peerRun = submitted([2046, 10, 29], 0, 2070);
 const peerBoundary = '2070-01-08T20:00:00.000Z';
 const peer = rows(peerRun).find(row => row.activeFrom === peerBoundary && row.normalizedPayload.luckPillar === '辛丑');
 assert.ok(peer);
 assert.equal(peer.normalizedPayload.sealLuckEvidence.zhangPeer, true);
 assert.equal(peer.normalizedPayload.hasZhangReviewedOutputSupport, false);
 assert.equal(peer.normalizedPayload.hasZhangReviewedPeerSupport, true);
 const peerHit = match(peerRun, 119);
 assert.equal(peerHit.status, 'matched');
 const peerBranch = peerHit.confirmedBranches.find(branch => branch.sourceFactIds.includes(peer.factId));
 assert.ok(peerHit.matchedSourceExcerpt.split('\n').includes('比劫運亦可行'));
 assert.equal(peerBranch.windows[0].start, peerBoundary);
 assert.match(peerBranch.conditions.join(''), /比劫运亦可行.*运干辛.*比肩/u);
 const peerPrompt = formatFortunePrompt(modelContext(peerRun).input);
 assert.match(peerPrompt, /比劫运亦可行.*运干辛.*比肩/u);
 assert.doesNotMatch(peerPrompt, /hasZhangReviewedPeerSupport|zhangPeer/u);
 assert.equal(ctx(printed('zhang'), '辛丑', false).hasZhangReviewedPeerSupport, undefined);
 const alternatePeer = submitted([2046, 10, 29], 2, 2070);
 const alternateChou = rows(alternatePeer).find(row => row.normalizedPayload.luckPillar === '辛丑');
 assert.ok(alternateChou);
 assert.equal(alternateChou.normalizedPayload.hasZhangReviewedPeerSupport, false);

 for (const [year, pillar, stem] of [[1906, '壬寅', '甲'], [1916, '癸卯', '乙']]) {
  const stage = submitted([1866, 10, 13], 0, year);
  const actual = rows(stage).find(row => row.normalizedPayload.luckPillar === pillar);
  const matchedWealth = match(stage, 119);
  assert.equal(actual.normalizedPayload.hasZhangReviewedWealth, true);
  assert.ok(actual.normalizedPayload.sealLuckEvidence.officerMonthSealRelays.some(row =>
   row.seal.stem === '戊' && row.incomingWealth.some(wealth => wealth.kind === '运支藏干' && wealth.stem === stem)));
  assert.equal(matchedWealth.status, 'matched');
  assert.ok(matchedWealth.sourceFactIds.includes(actual.factId));
 }
});

test('Zhu wealth luck reaches the named heavy guard and excludes the light guard and Zhang release routes', () => {
 const date = [1946, 10, 24];
 const zhu = submittedCalendar({ date, hour: 8, gender: 1, year: 1981, luck: '壬寅',
  natal: ['丙戌', '戊戌', '辛未', '壬辰'] });
 assert.ok(zhu.evidence.wealthControlsGuard.some(row => row.seal.stem === '戊' && row.hurt.stem === '壬'
  && row.officer.stem === '丙' && row.moving.stem === '甲'));
 const [heavy] = zhu.evidence.zhuGuardRoots;
 assert.deepEqual(heavy.roots.map(row => [row.position, row.stem]), [['year', '戊'], ['month', '戊'], ['day', '己'], ['hour', '戊']]);
 const boundary = '1981-10-26T06:00:00.000Z', heavyHit = match(zhu.run, 120);
 const prior = rows(zhu.run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '辛丑');
 assert.equal(zhu.fact.activeFrom, boundary);
 assert.equal(heavyHit.status, 'matched');
 assert.equal(heavyHit.windows[0].start, boundary);
 assert.ok(heavyHit.sourceFactIds.includes(zhu.fact.factId) && !heavyHit.sourceFactIds.includes(prior.factId));
 assert.equal(match(zhu.run, 119).status, 'not_matched');
 assert.equal(match(zhu.run, 121).status, 'not_matched');
 const { input } = modelContext(zhu.run), prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('朱例原注按土厚论'));
 assert.match(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === heavyHit.knowledgeId)?.originalText ?? '', /土重\s*埋金/u);
 const food = submittedCalendar({ date, hour: 10, gender: 1, year: 1981, luck: '壬寅',
  natal: ['丙戌', '戊戌', '辛未', '癸巳'] });
 assert.equal(food.fact.normalizedPayload.hurtExposed, false);
 assert.equal(food.fact.normalizedPayload.exposedOfficerAndOutput, true);
 assert.deepEqual(food.evidence.wealthControlsGuard.map(row => [row.hurt.stem, row.hurt.god]), [['癸', '食神']]);
 assert.equal(match(food.run, 120).status, 'not_matched');
 assert.ok(match(food.run, 121).sourceFactIds.includes(food.fact.factId));

 const earlier = submitted(date, 8, 1961), earlierHit = match(earlier, 120), outputBoundary = '1961-10-26T06:00:00.000Z';
 const controlFacts = [rows(earlier).find(row => row.activeTo === outputBoundary && row.normalizedPayload.luckPillar === '己亥'),
  rows(earlier).find(row => row.activeFrom === outputBoundary && row.normalizedPayload.luckPillar === '庚子')];
 assert.equal(earlierHit.status, 'matched');
 for (const fact of controlFacts) {
  assert.ok(earlierHit.sourceFactIds.includes(fact.factId));
  assert.deepEqual(fact.normalizedPayload.sealLuckEvidence.wealthControlsGuard, []);
  assert.ok(fact.normalizedPayload.sealLuckEvidence.zhuChecksMovingOutput.some(row => row.seal.stem === '戊' && row.officer.stem === '丙'));
 }
});

test('Linhuai keeps the Chou-You comparison separate from its source-confirmed natal seal standing', () => {
 const run = submitted([1995, 3, 7], 4, 2005);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丁丑');
 assert.ok(change);
 const before = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '戊寅' && row.activeTo === change.exactInstant);
 const after = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '丁丑' && row.activeFrom === change.exactInstant);
 assert.ok(before && after);
 assert.deepEqual(after.normalizedPayload.natalPillars.map(row => row.pillar), ['乙亥', '己卯', '丁酉', '壬寅']);
 const comparison = row => row.normalizedPayload.linhuaiGuardComparison;
 assert.deepEqual([comparison(after).seal.stem, comparison(after).hurt.stem, comparison(after).officer.stem, comparison(after).sealOfficerDistance],
  ['乙', '己', '壬', 3]);
 assert.deepEqual(comparison(before).movingOutputAtOfficer.map(row => row.stem), ['戊']);
 const chou = comparison(after).chouYou;
 assert.deepEqual([chou.day, chou.luck, chou.missingSi], ['丁酉', '丁丑', true]);
 assert.deepEqual(chou.maoYouClash.members, ['month', 'day']);
 assert.deepEqual(chou.hiddenWealth.map(row => row.stem), ['辛']);
 assert.ok([119, 120, 121].every(index => match(run, index).status === 'not_matched'));
 const { input } = modelContext(run);
 assert.ok(input.facts.some(row => row.type === 'zpqz_seal_food_context' && row.data.linhuaiGuardComparison && row.endExclusive === change.exactInstant));
 assert.ok(input.facts.some(row => row.type === 'zpqz_seal_food_context' && row.data.linhuaiGuardComparison && row.start === change.exactInstant));
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('临淮例运丑与日酉见会位，巳支未齐'));
 assert.ok(prompt.includes('此例认为财旺未破印'));
 assert.doesNotMatch(prompt, /linhuaiGuardComparison|zhuNamedHeavyGuard/u);
 const you = candidate(printed('linhuai'), '癸酉');
 assert.equal(you.normalizedPayload.linhuaiChouWealthComparison, false);
 assert.equal(you.normalizedPayload.linhuaiSourceSealStrong, true);
 assert.ok(you.normalizedPayload.sealLuckEvidence.wealthControlsGuard.length);
 const ruleIds = [120, 121].map(index => fortuneKnowledge.bazi.rules[index].knowledgeId);
 const checked = evaluateFortuneRules('bazi', 'year', [you]).filter(rule => ruleIds.includes(rule.knowledgeId));
 assert.equal(checked.length, 2);
 assert.deepEqual(checked.map(rule => rule.required[0].hits.includes(you)), [false, false]);
 const enteringYou = submitted([1995, 3, 7], 4, 2045);
 const boundary = '2045-06-10T12:00:00.000Z';
 const previous = rows(enteringYou).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '甲戌');
 const current = rows(enteringYou).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '癸酉');
 assert.ok(previous && current);
 const proof = current.normalizedPayload.linhuaiGuardComparison.sourceSealStanding;
 assert.deepEqual([proof.seal.position, proof.seal.stem, proof.seal.kind], ['year', '乙', '透干']);
 assert.deepEqual(proof.roots.map(row => [row.position, row.branch, row.stem]), [
  ['year', '亥', '甲'], ['month', '卯', '乙'], ['hour', '寅', '甲'],
 ]);
 assert.ok(current.normalizedPayload.sealLuckEvidence.wealthControlsGuard.some(path => path.moving.stem === '辛' && path.seal.stem === '乙'));
 assert.ok(current.normalizedPayload.sealLuckEvidence.outputWealthSealPaths.length > 0);
 assert.ok(!current.normalizedPayload.sealLuckRoutes.includes('wealth-presses-seal-with-output'));
 assert.equal(match(enteringYou, 130).status, 'not_matched');
 assert.equal(current.normalizedPayload.linhuaiChouWealthComparison, false);
 assert.equal(match(enteringYou, 121).status, 'not_matched');
 const linhuaiAudit = modelContext(enteringYou).input;
 assert.match(formatFortuneFactAudit(linhuaiAudit), /临淮原图依原评取印旺/u);
 assert.doesNotMatch(formatFortunePrompt(linhuaiAudit), /临淮原图依原评取印旺/u);
 const differentDay = submitted([1995, 3, 17], 4, 2052);
 const aligned = rows(differentDay).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '癸酉');
 assert.ok(aligned && aligned.normalizedPayload.sealLuckEvidence.wealthControlsGuard.length);
 assert.equal(aligned.normalizedPayload.linhuaiSourceSealStrong, false);
 assert.ok(match(differentDay, 121).sourceFactIds.includes(aligned.factId));
});

test('the published wealth-remedy and wealth-disease diagrams cannot trigger each other on a real robbery stage', () => {
 const scenarios = [
  { date: [2048, 2, 27], hour: 18, year: 2060, gender: 1, luck: '丙辰',
   natal: ['戊辰', '甲寅', '丁卯', '己酉'], role: 'remedy', prior: '乙卯',
   boundary: '2060-04-25T22:00:00.000Z', retained: 'p005', excluded: 'p004', incoming: '丙', wealth: '辛', seal: '甲' },
  { date: [1970, 12, 20], hour: 22, year: 1995, gender: 0, luck: '乙酉',
   natal: ['庚戌', '戊子', '甲戌', '乙亥'], role: 'disease', prior: '丙戌',
   boundary: '1995-04-27T12:00:00.000Z', retained: 'p004', excluded: 'p005', incoming: '乙', wealth: '戊', seal: '癸' },
 ];
 const sourceMatch = (run, code) => matchFortuneKnowledge(run).byMethod.bazi.find(row =>
  row.knowledgeId.includes('-zpqz-1936-interpretation-' + code + '-'));
 for (const sample of scenarios) {
  const run = submitted(sample.date, sample.hour, sample.year, sample.gender);
  const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === sample.luck);
  assert.equal(transition?.exactInstant, sample.boundary);
  const after = rows(run).find(row => row.activeFrom === sample.boundary && row.normalizedPayload.luckPillar === sample.luck);
  assert.ok(after && rows(run).some(row => row.activeTo === sample.boundary && row.normalizedPayload.luckPillar === sample.prior));
  const data = after.normalizedPayload;
  assert.deepEqual(data.natalPillars.map(row => row.pillar), sample.natal);
  assert.equal(data.sourceWealthRole, sample.role);
  assert.equal(data.hasRobberyAgainstNatalSealWealth, true);
  assert.ok(data.robberyAgainstSealWealth.some(({ robbery, natalWealthPaths }) => robbery.stem === sample.incoming
   && natalWealthPaths.some(({ wealth, seal }) => wealth.stem === sample.wealth && seal.stem === sample.seal)));
  const kept = sourceMatch(run, sample.retained);
  assert.equal(kept.status, 'partial');
  assert.ok(kept.sourceFactIds.includes(after.factId));
  assert.equal(sourceMatch(run, sample.excluded).status, 'not_matched');
  const stale = { ...after, normalizedPayload: { ...data, sourceWealthRole: undefined } };
  const check = evaluateFortuneRules('bazi', 'year', [stale]).find(rule => rule.knowledgeId === kept.knowledgeId).required[0];
  assert.equal(check.unknown, true);
  assert.deepEqual(check.hits, []);
  const phrase = sample.role === 'remedy' ? '原评在这幅命例取财损印' : '原评在这幅命例把原财列为妨碍';
  const { input } = modelContext(run);
  assert.ok(formatFortuneFactAudit(input).includes(phrase));
  assert.ok(!formatFortunePrompt(input).includes(phrase));
 }
 const changed = submitted(scenarios[0].date, 20, 2061);
 const changedStage = rows(changed).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '丙辰');
 assert.equal(changedStage?.normalizedPayload.sourceWealthRole, 'undetermined');
 assert.ok(changedStage?.normalizedPayload.hasRobberyAgainstNatalSealWealth);
 assert.ok(sourceMatch(changed, 'p004').sourceFactIds.includes(changedStage.factId));
 assert.ok(sourceMatch(changed, 'p005').sourceFactIds.includes(changedStage.factId));
});

test('the two printed injury wealth and seal cases keep the actual robbery contact and distinct original decisions', async () => {
 for (const [date, hour, year, luck, role, expected, wealthPosition, sealPosition] of [
  [[1957, 9, 13], 0, 1979, '丁未', 'separated', ['not_matched', 'not_matched'], 'hour', 'year'],
  [[1982, 10, 2], 10, 2024, '癸丑', 'remedy', ['not_matched', 'matched'], 'year', 'hour'],
  [[1957, 9, 13], 2, 1979, '丁未', 'undetermined', ['partial', 'partial']],
 ]) {
  const run = submitted(date, hour, year);
  const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === luck);
  assert.ok(fact);
  const p = fact.normalizedPayload;
  assert.equal(p.hasRobberyAgainstNatalSealWealth, true);
  assert.equal(p.sourceWealthRole, role);
  if (role !== 'undetermined') {
   const {wealth, seal, between, robberies, printedSupport} = p.sourceHurtWealthSeal;
   assert.deepEqual([wealth.position, wealth.stem, seal.position, seal.stem], [wealthPosition, '壬', sealPosition, '丁']);
   assert.deepEqual(between.map(row => row.position), ['month', 'day']);
   assert.deepEqual(robberies.map(row => [row.stem, row.kind]), [['己', '运支藏干']]);
   assert.deepEqual(printedSupport.map(row => [row.stem, row.kind]), [[luck[0], '运干'], [luck[0], '运支藏干']]);
   assert.equal(match(run, 144).status, role === 'separated' ? 'matched' : 'partial');
  } else assert.equal(p.sourceHurtWealthSeal, undefined);
  const result = matchFortuneKnowledge(run).byMethod.bazi;
  assert.deepEqual([result[46].status, result[47].status], expected);
  assert.equal(result[46].sourceFactIds.includes(fact.factId), expected[0] === 'partial');
  assert.equal(result[47].sourceFactIds.includes(fact.factId), expected[1] !== 'not_matched');
  assert.equal(p.hasChancellorSourceRobberyToUsedWealth, role === 'remedy');
  const { input } = modelContext(run);
  const audit = formatFortuneFactAudit(input);
  const prompt = formatFortunePrompt(input);
  const separated = '都统制原例壬财与丁印分居，原评为财印不碍';
  const remedy = '丞相原例按壬财损丁印取用';
  assert.equal(audit.includes(separated), role === 'separated');
  assert.equal(audit.includes(remedy), role === 'remedy');
  assert.ok(!prompt.includes(separated) && !prompt.includes(remedy));
  if (role === 'remedy') {
   const boundary = '2024-12-07T06:00:00.000Z';
   const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '甲寅');
   assert.equal(change?.exactInstant, boundary);
   const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '甲寅');
   assert.ok(after);
   assert.equal(after.normalizedPayload.hasChancellorSourceRobberyToUsedWealth, false);
   assert.ok(!result[47].sourceFactIds.includes(after.factId));
   assert.equal(result[47].windows.at(-1).endExclusive, boundary);
   assert.equal(result[47].matchedSourceExcerpt, '喜財損印');
   const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
    const content = JSON.parse(options.body).messages[1].content;
    assert.match(content, /徐注仍把癸丑列在相宜的财地/u);
    assert.doesNotMatch(content, /hasChancellorSourceRobberyToUsedWealth/u);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
   } });
   await provider.interpret(input);
  } else {
   assert.doesNotMatch(prompt, /徐注仍把癸丑列在相宜的财地/u);
  }
 }
});

test('Zhou’s two source readings keep the generic robbery rules out and verify the actual Geng wealth handoff', () => {
 const byPassage = (run, passage) => matchFortuneKnowledge(run).byMethod.bazi
  .find(row => row.knowledgeId.endsWith('zpqz-1936-interpretation-' + passage + '-001'));
 const birth = [1898, 12, 10];
 const early = submitted(birth, 20, 1927);
 const earlyChange = '1927-08-11T22:00:00.000Z';
 const bing = rows(early).find(row => row.activeTo === earlyChange);
 const ding = rows(early).find(row => row.activeFrom === earlyChange);
 assert.deepEqual([bing.normalizedPayload.luckPillar, ding.normalizedPayload.luckPillar], ['丙寅', '丁卯']);
 assert.equal(bing.normalizedPayload.hasZhouSourceRobberyDispute, true);
 assert.equal(ding.normalizedPayload.hasZhouSourceRobberyDispute, false);
 const peerYear = submitted(birth, 18, 1927);
 const sameBing = rows(peerYear).find(row => row.normalizedPayload.luckPillar === '丙寅');
 assert.ok(sameBing);
 assert.equal(sameBing.normalizedPayload.hasZhouSourceRobberyDispute, false);
 assert.equal(sameBing.normalizedPayload.hasRobberyAgainstNatalSealWealth, true);
 for (const doctrine of ['p004', 'p005']) {
  const excluded = byPassage(early, doctrine);
  assert.equal(excluded.status, 'excluded');
  assert.deepEqual(excluded.windows, []);
  const ordinary = byPassage(peerYear, doctrine);
  assert.equal(ordinary.status, 'partial');
  assert.ok(ordinary.sourceFactIds.includes(sameBing.factId));
 }
 const earlyInput = modelContext(early).input;
 const robberyAudit = /周原图此运同一来劫/u;
 assert.match(formatFortuneFactAudit(earlyInput), robberyAudit);
 assert.doesNotMatch(formatFortunePrompt(earlyInput), robberyAudit);

 const late = submitted(birth, 20, 1957);
 const boundary = '1957-08-11T22:00:00.000Z';
 const ji = rows(late).find(row => row.activeTo === boundary);
 const geng = rows(late).find(row => row.activeFrom === boundary);
 assert.deepEqual([ji.normalizedPayload.luckPillar, geng.normalizedPayload.luckPillar], ['己巳', '庚午']);
 for (const [fact, kind] of [[bing, '运干'], [ji, '运支藏干']]) {
  const p = fact.normalizedPayload;
  const { robbery, wealth, seal } = p.zhouSourceRobberyDispute;
  assert.equal(p.hasZhouSourceRobberyDispute, true);
  assert.deepEqual([robbery.kind, robbery.stem, wealth.position, wealth.stem, seal.position, seal.stem],
   [kind, '丙', 'hour', '庚', 'month', '甲']);
 }
 for (const doctrine of ['p004', 'p005']) assert.deepEqual(byPassage(late, doctrine).windows, []);
 assert.equal(ji.normalizedPayload.hasZhouSourceWealthOutput, false);
 assert.equal(geng.normalizedPayload.hasZhouSourceRobberyDispute, false);
 assert.equal(geng.normalizedPayload.hasZhouSourceWealthOutput, true);
 const { hurt, wealth, seal } = geng.normalizedPayload.zhouSourceWealthOutput;
 assert.deepEqual([hurt.position, hurt.kind, hurt.stem, wealth.kind, wealth.stem, seal.position, seal.kind, seal.stem],
  ['year', '透干', '戊', '运干', '庚', 'month', '透干', '甲']);

 const hit = byPassage(late, 'p008');
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '四柱雖佩印而不為用');
 assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: geng.activeTo }]);
 assert.deepEqual(hit.sourceFactIds, [geng.factId]);
 const lateInput = modelContext(late).input;
 const prompt = formatFortunePrompt(lateInput), wealthAudit = /周原图实排庚午/u;
 assert.match(formatFortuneFactAudit(lateInput), wealthAudit);
 assert.match(prompt, /周丞相.*徐注|徐注.*周丞相/u);
 assert.match(prompt, /林注.*甲印/u);
 assert.doesNotMatch(prompt, wealthAudit);
 assert.doesNotMatch(prompt, /zhouSourceWealthOutput|hasZhouSourceRobberyDispute/u);

 const other = submitted(birth, 18, 1957);
 const otherGeng = rows(other).find(row => row.normalizedPayload.luckPillar === '庚午');
 assert.ok(otherGeng);
 assert.equal(otherGeng.normalizedPayload.hasZhouSourceWealthOutput, false);
 assert.equal(byPassage(other, 'p008').status, 'partial');
 assert.doesNotMatch(formatFortunePrompt(modelContext(other).input), /周丞相/u);
 const unknown = ctx(native(['戊戌', '甲子', '丁未', '庚戌']), '丙寅', false);
 assert.equal(unknown.hasZhouSourceRobberyDispute, undefined);
});

test('p005 confirms the two printed wealth stages without requiring robbery and switches the matched conditions at handoff', () => {
 const date = [1982, 10, 2], run = submitted(date, 10, 2004);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '壬子');
 assert.ok(change);
 const boundary = change.exactInstant;
 const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '辛亥');
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '壬子');
 assert.ok(before && after);
 for (const [fact, support] of [[before, [['运支藏干', '壬']]], [after, [['运干', '壬'], ['运支藏干', '癸']]]]) {
  const p = fact.normalizedPayload;
  assert.equal(p.natalPillarSequence, '壬戌己酉戊午丁巳');
  assert.equal(p.sourceWealthRole, 'remedy');
  assert.equal(p.hasChancellorSourceWealthSupport, true);
  assert.equal(p.hasChancellorSourceRobberyToUsedWealth, false);
  const { seal, printedSupport } = p.sourceHurtWealthSeal;
  assert.deepEqual([seal.position, seal.stem, seal.kind], ['hour', '丁', '透干']);
  assert.deepEqual(printedSupport.map(row => [row.kind, row.stem]), support);
  assert.ok(printedSupport.every(source => p.remedyMovingContacts.some(({ from, to, relation }) =>
   from.kind === source.kind && from.stem === source.stem && to.kind === seal.kind
   && to.position === seal.position && to.stem === seal.stem && relation === '克')));
 }
 const result = match(run, 47);
 assert.equal(result.status, 'matched');
 assert.equal(result.matchedSourceExcerpt, '喜財損印');
 const [xin, ren] = result.confirmedBranches;
 assert.ok(xin.sourceFactIds.includes(before.factId));
 assert.ok(ren.sourceFactIds.includes(after.factId));
 for (const [route, pillar] of [[xin, '辛亥'], [ren, '壬子']]) {
  assert.ok(route.sourceFactIds.every(id => rows(run).find(row => row.factId === id)?.normalizedPayload.luckPillar === pillar));
 }
 assert.equal(xin.windows.at(-1).endExclusive, boundary);
 assert.equal(ren.windows[0].start, boundary);
 assert.match(xin.conditions.join(''), /辛亥.*亥中壬财克原时柱的透丁印/u);
 assert.match(ren.conditions.join(''), /壬子.*运干壬财与运支子中癸财/u);
 assert.equal(match(run, 46).status, 'not_matched');

 const { input } = modelContext(run);
 const audit = formatFortuneFactAudit(input);
 assert.match(audit, /辛亥运的财位为[^。\n]*壬/u);
 assert.doesNotMatch(audit, /辛亥运的财位为[^。\n]*癸/u);
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /本步辛亥是原评所列财地/u);
 assert.match(prompt, /本步壬子是原评所列财地/u);
 assert.doesNotMatch(prompt, /hasChancellorSourceWealthSupport|徐注仍把癸丑列在相宜的财地/u);
 const near = submitted(date, 12, 2004);
 assert.ok(!rows(near).some(row => row.normalizedPayload.hasChancellorSourceWealthSupport));
 assert.notEqual(match(near, 47).status, 'matched');
 const missingTime = ctx(native(['壬戌', '己酉', '戊午', '丁巳']), '壬子', false);
 assert.equal(missingTime.hasChancellorSourceWealthSupport, undefined);
});

test('p004 confirms the Wu chart’s used seal when the actual Gui luck checks its exposed wealth', async () => {
 const run = submitted([2007, 7, 7], 18, 2037);
 const transition = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸卯');
 assert.ok(transition);
 const boundary = transition.exactInstant;
 const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '甲辰');
 const after = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '癸卯');
 assert.ok(before && after);
 const p = after.normalizedPayload;
 assert.equal(p.natalPillarSequence, '丁亥丙午壬寅己酉');
 assert.equal(p.sourceWealthRole, 'disease');
 assert.equal(p.hasWuSourceRobberyProtectingSeal, true);
 assert.equal(before.normalizedPayload.hasWuSourceRobberyProtectingSeal, false);
 const [proof] = p.robberyAgainstSealWealth;
 assert.deepEqual([proof.robbery.kind, proof.robbery.stem], ['运干', '癸']);
 assert.deepEqual(proof.natalWealthPaths.filter(({ wealth, seal }) => wealth.kind === '透干'
  && seal.position === 'hour' && seal.stem === '辛').map(({ wealth }) => [wealth.position, wealth.stem]),
 [['year', '丁'], ['month', '丙']]);
 const findSource = (knowledge, source) => knowledge.byMethod.bazi.find(row => row.knowledgeId.includes('-interpretation-' + source + '-'));
 const { input, knowledge } = modelContext(run);
 const hit = findSource(knowledge, 'p004');
 assert.equal(hit.status, 'matched');
 assert.equal(hit.windows[0].start, boundary);
 assert.ok(hit.sourceFactIds.includes(after.factId));
 assert.ok(!hit.sourceFactIds.includes(before.factId));
 assert.equal(findSource(knowledge, 'p005').status, 'not_matched');
 const phrase = /伍朝枢原图的午月壬水按原评为身弱/u;
 const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
  const content = JSON.parse(options.body).messages[1].content;
  assert.match(content, phrase);
  assert.doesNotMatch(content, /hasWuSourceRobberyProtectingSeal/u);
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
 } });
 await provider.interpret(input);
 const altered = submitted([2007, 7, 7], 20, 2038);
 const sameLuck = rows(altered).find(row => row.normalizedPayload.luckPillar === '癸卯');
 assert.ok(sameLuck?.normalizedPayload.hasRobberyAgainstNatalSealWealth);
 assert.equal(sameLuck.normalizedPayload.hasWuSourceRobberyProtectingSeal, false);
 assert.equal(findSource(matchFortuneKnowledge(altered), 'p004').status, 'partial');
 assert.doesNotMatch(formatFortunePrompt(modelContext(altered).input), phrase);
});

test('p080 retains the actual food, wealth, and fire directions within the Li diagram', () => {
 const date = [1958, 3, 30];
 const run = submitted(date, 22, 1980);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊午');
 assert.ok(change);
 const before = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '丁巳' && row.activeTo === change.exactInstant);
 const after = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '戊午' && row.activeFrom === change.exactInstant);
 assert.ok(before && after);
 const data = row => row.normalizedPayload.sealLuckEvidence.liLuck;
 assert.deepEqual([data(after).exposedSeal.stem, data(after).monthSeal.stem, data(after).dayBlade.stem], ['乙', '乙', '丁']);
 assert.deepEqual(data(after).originalOutput.map(link => [link.from.stem, link.to.position, link.to.stem]),
  [['丙', 'year', '戊'], ['丙', 'hour', '己']]);
 assert.deepEqual(data(before).movingFire.map(row => [row.kind, row.stem]), [['运干', '丁'], ['运支藏干', '丙']]);
 assert.deepEqual(data(before).dayFeedsMovingOutput, []);
 assert.deepEqual(data(after).movingFire.map(row => [row.kind, row.stem]), [['运支藏干', '丁']]);
 assert.deepEqual(data(after).dayFeedsMovingOutput.map(link => [link.to.kind, link.to.stem]), [['运干', '戊']]);
 const hit = match(run, 122);
 assert.equal(hit.status, 'matched');
 assert.ok([before, after].every(row => hit.sourceFactIds.includes(row.factId)));
 const { input } = modelContext(run);
 const source = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
 assert.match(source?.originalText ?? '', /食傷財運均吉/u);
 assert.deepEqual(source.windows, hit.windows);
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('日午刃位实藏'));
 assert.ok(prompt.includes('本步与日丙同属火的实际运干或支本气'));
 const finance = submittedCalendar({ date, hour: 22, gender: 1, year: 2003, luck: '庚申',
  natal: ['戊戌', '乙卯', '丙午', '己亥'] });
 const wealth = finance.evidence.liLuck;
 assert.equal(wealth.wealthAtMonthSeal.length, 2);
 assert.ok(wealth.wealthAtMonthSeal.every(row => row.stem === '庚'));
 assert.deepEqual(wealth.outputFeedsMovingWealth.map(link => [link.from.stem, link.to.kind]),
  [['戊', '运干'], ['戊', '运支藏干'], ['己', '运干'], ['己', '运支藏干']]);
 assert.ok(match(finance.run, 122).sourceFactIds.includes(finance.fact.factId));
});

test('the near Li diagram keeps both actual stem contacts at the boundary as audit evidence', () => {
 const base = ref.calendarExamples[122];
 const run = submitted(base.date, base.hour, 2028, base.gender);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '壬子');
 assert.ok(change);
 const gui = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '癸丑');
 const ren = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '壬子');
 assert.ok(gui && ren);
 const { liLuck: guiLuck } = gui.normalizedPayload.sealLuckEvidence, { liLuck: renLuck } = ren.normalizedPayload.sealLuckEvidence;
 assert.equal(guiLuck.sourceDiagramExact, false);
 assert.equal(renLuck.sourceDiagramExact, false);
 assert.ok(guiLuck.dayFeedsMovingOutput.some(link => link.to.stem === '己'));
 assert.deepEqual(guiLuck.guiFoodPairs.map(row => [row.pair.target.position, row.pair.target.stem, row.foodControlsGui, row.guiControlsDay]),
  [['year', '戊', true, true]]);
 assert.deepEqual(guiLuck.guiFoodPairs[0].foodEarthRoots.map(row => [row.position, row.stem]), [['day', '己']]);
 const waterCoordinates = data => data.waterRootWitnesses.map(({ root, sameStem }) => [root.position, root.stem, sameStem]);
 assert.deepEqual(waterCoordinates(guiLuck), [['year', '癸', true], ['hour', '壬', false], ['decadal', '癸', true]]);
 assert.deepEqual(renLuck.renFeedsSeal.map(link => [link.from.stem, link.to.position, link.to.stem, link.to.kind]),
  [['壬', 'month', '乙', '透干'], ['壬', 'month', '乙', '支藏']]);
 assert.equal(renLuck.renControlsDay, true);
 assert.deepEqual(renLuck.renRoots, ['癸']);
 assert.deepEqual(waterCoordinates(renLuck), [['year', '癸', false], ['hour', '壬', true], ['decadal', '癸', false]]);
 assert.deepEqual(renLuck.bladeClashes.map(row => row.members), [['year', 'day'], ['day', 'decadal']]);
 assert.deepEqual(renLuck.guiFoodPairs, []);
 assert.equal(match(run, 122).status, 'not_matched');
 assert.deepEqual(match(run, 122).windows, []);
 assert.equal(match(run, 123).status, 'not_matched');
 assert.equal(match(run, 124).status, 'not_matched');
 const { input } = modelContext(run), prompt = formatFortuneFactAudit(input);
 assert.ok(input.facts.some(row => row.type === 'zpqz_seal_food_context' && row.endExclusive === change.exactInstant
  && row.data.sealLuckEvidence?.liLuck?.guiFoodPairs?.length));
 assert.ok(input.facts.some(row => row.type === 'zpqz_seal_food_context' && row.start === change.exactInstant
  && row.data.sealLuckEvidence?.liLuck?.renFeedsSeal?.length));
 assert.ok(input.sections.flatMap(section => section.findings).every(row => [liFoodWealthIndex, ...exactLiIndices]
  .every(index => row.knowledgeId !== fortuneKnowledge.bazi.rules[index].knowledgeId)));
 assert.ok(prompt.includes('合戊的同一运癸同时受该戊食所克'));
 assert.ok(prompt.includes('滋润效果仍待核'));
 assert.ok(prompt.includes('运支另冲本命日午'));
 assert.ok(prompt.includes('与运干同五行异干'));
 assert.ok(!prompt.includes('sealLuckEvidence'));
});

test('Li’s exact diagram separates Ren-Xu hidden fire and Gui-Hai combination at one actual boundary', () => {
 const run = submitted([1958, 3, 30], 22, 2030);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸亥');
 assert.ok(change);
 const boundary = change.exactInstant;
 assert.equal(boundary, '2030-02-25T14:00:00.000Z');
 const ren = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === '壬戌');
 const gui = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === '癸亥');
 assert.ok(ren && gui);
 const { liLuck: renLuck } = ren.normalizedPayload.sealLuckEvidence, { liLuck: guiLuck } = gui.normalizedPayload.sealLuckEvidence;
 assert.equal(renLuck.sourceDiagramExact, true);
 assert.equal(guiLuck.sourceDiagramExact, true);
 assert.deepEqual(renLuck.dayFeedsMovingOutput.map(link => [link.to.stem, link.to.kind]), [['戊', '运支藏干']]);
 assert.deepEqual(renLuck.movingFire, []);
 assert.deepEqual(renLuck.movingOtherFire.map(row => [row.stem, row.kind]), [['丁', '运支藏干']]);
 assert.deepEqual(renLuck.renRoots, []);
 assert.deepEqual(renLuck.waterRootWitnesses.map(({ root, sameStem }) => [root.position, root.stem, sameStem]), [['hour', '壬', true]]);
 assert.deepEqual(guiLuck.movingOtherFire, []);
 assert.deepEqual(guiLuck.guiFoodPairs.map(({ food, foodEarthRoots }) => [food.position, food.stem,
  foodEarthRoots.map(root => [root.position, root.stem, root.sameStem])]), [['year', '戊', [['year', '戊', true], ['day', '己', false]]]]);
 assert.deepEqual(guiLuck.waterRootWitnesses.map(({ root, sameStem }) => [root.position, root.stem, sameStem]),
  [['hour', '壬', false], ['decadal', '壬', false]]);
 for (const index of [liFoodWealthIndex, 124]) {
  const result = match(run, index);
  assert.equal(result.status, 'matched');
  assert.ok(result.sourceFactIds.includes(ren.factId));
  assert.ok(!result.sourceFactIds.includes(gui.factId));
  assert.equal(result.windows.at(-1).endExclusive, boundary);
 }
 const guiResult = match(run, 123);
 assert.equal(guiResult.status, 'matched');
 assert.ok(guiResult.sourceFactIds.includes(gui.factId));
 assert.ok(!guiResult.sourceFactIds.includes(ren.factId));
 assert.equal(guiResult.windows[0].start, boundary);
 const describe = fact => describeFortuneFact({method:'bazi',type:'zpqz_seal_food_context',data:fact.normalizedPayload},String);
 assert.match(describe(ren), /与李状元原图相同.*乙卯印专旺、此造反忌比劫/u);
 assert.match(describe(ren), /运支余藏火为[^。]*丁/u);
 assert.match(describe(gui), /同五行藏气见于[^。]*戊[^。]*同干[^。]*己[^。]*异干/u);
 const { input } = modelContext(run);
 const findings = input.sections.flatMap(section => section.findings);
 for (const [index, wording] of [[123, /癸.*合戊/u], [124, /壬水滋潤/u]]) {
  const id = fortuneKnowledge.bazi.rules[index].knowledgeId;
  const finding = findings.find(row => row.knowledgeId === id);
  assert.match(finding?.originalText ?? '', wording);
 }
 const invalid = ['壬戌', '癸亥'].flatMap(luck => [candidate(printed('li'), luck, false), candidate(printed('li'), luck, true, false)]);
 for (const row of evaluateFortuneRules('bazi', 'year', invalid).filter(rule => exactLiIndices
  .some(index => rule.knowledgeId === fortuneKnowledge.bazi.rules[index].knowledgeId))) {
  assert.deepEqual(row.required[0].hits, []);
 }

 const changedHour = submitted([1958, 3, 30], 2, 2030);
 const otherChange = changedHour.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸亥');
 assert.equal(otherChange.exactInstant, '2030-06-04T18:00:00.000Z');
 const seats = rows(changedHour).filter(row => row.activeTo === otherChange.exactInstant || row.activeFrom === otherChange.exactInstant);
 assert.ok(seats.some(row => row.normalizedPayload.sealLuckRoutes.includes('li-gui-combines-food')));
 assert.ok(seats.some(row => row.normalizedPayload.sealLuckRoutes.includes('li-ren-feeds-seal')));
 for (const index of exactLiIndices) assert.equal(match(changedHour, index).status, 'not_matched');
});

test('near Mao and Ma charts retain the actual wealth target without inheriting either reading', () => {
 const mao = submittedCalendar(ref.calendarExamples[125]);
 assert.equal(match(mao.run, 125).status, 'not_matched');
 const [maoPath] = mao.evidence.exposedKillerSealLuck;
 assert.deepEqual(maoPath.wealth.map(row => row.stem), ['丁']);
 assert.deepEqual([maoPath.killer.position, maoPath.killer.stem, maoPath.seal.position, maoPath.seal.stem], ['month', '己', 'hour', '庚']);
 const nativeComplete = submittedCalendar(ref.calendarExamples[126]);
 assert.equal(nativeComplete.fact.normalizedPayload.nativeGroupComplete, true);
 assert.equal(nativeComplete.evidence.maZi, false);
 assert.ok(nativeComplete.evidence.maWealth.every(row => row.seal.position === 'month' && row.seal.kind === '支藏' && row.seal.stem === '庚'));
 const ma = submittedCalendar(ref.maBothRoutes), hit = match(ma.run, 126);
 const change = ma.run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '丙子');
 assert.ok(change);
 assert.equal(ma.fact.activeFrom, change.exactInstant);
 assert.equal(ma.evidence.maZi, true);
 assert.deepEqual(ma.evidence.maWealth.map(row => [row.moving.stem, row.killer.position, row.killer.stem, row.seal.position, row.seal.stem]),
  [['丙', 'hour', '戊', 'month', '庚']]);
 assert.equal(hit.status, 'not_matched');
 assert.ok(formatFortuneFactAudit(modelContext(ma.run).input).includes('本运子补齐原局申辰'));
});

test('p083 rejects both other diagrams while retaining their shared wealth and seal positions', () => {
 const date = [1980, 1, 9];
 const other = submittedCalendar({ date, hour: 2, gender: 1, year: 1993, luck: '乙亥',
  natal: ['己未', '丁丑', '辛巳', '己丑'] });
 assert.equal(other.fact.normalizedPayload.maoSkeleton, false);
 const path = other.evidence.exposedKillerSealLuck.find(row => row.seal.position === 'year');
 assert.deepEqual([path.killer.position, path.killer.stem, path.seal.position, path.seal.stem, path.day.stem],
  ['month', '丁', 'year', '己', '辛']);
 assert.deepEqual(path.wealth.map(row => [row.kind, row.stem]), [['运干', '乙']]);
 assert.equal(match(other.run, 125).status, 'not_matched');
 const natalWealth = submittedCalendar({ date, hour: 14, gender: 1, year: 1993, luck: '乙亥',
  natal: ['己未', '丁丑', '辛巳', '乙未'] });
 assert.equal(natalWealth.fact.normalizedPayload.wealthExposed, true);
 assert.ok(natalWealth.evidence.exposedKillerSealLuck.some(row => row.killer.stem === '丁' && row.seal.stem === '己'
  && row.wealth.some(wealth => wealth.stem === '乙')));
 assert.equal(match(natalWealth.run, 125).status, 'not_matched');
});

test('p083 retains Mao branch wealth and then the authority feeding the same exposed seal through the actual transition', () => {
 const run = submitted([1989, 9, 20], 16, 2033);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊辰');
 assert.ok(change);
 const before = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '己巳' && row.activeTo === change.exactInstant);
 const after = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '戊辰' && row.activeFrom === change.exactInstant);
 assert.ok(before && after);
 const path = fact => fact.normalizedPayload.sealLuckEvidence.exposedKillerSealLuck[0];
 assert.deepEqual(path(before).wealth.map(row => [row.kind, row.stem]), [['运支藏干', '丙']]);
 assert.deepEqual(path(before).authority.map(row => [row.kind, row.stem]), [['运干', '己']]);
 assert.deepEqual(path(before).originalHiddenWealth.map(row => [row.position, row.stem]), [['year', '丙'], ['day', '丁']]);
 assert.deepEqual(path(after).wealth, []);
 assert.deepEqual(path(after).authority.map(row => [row.kind, row.stem]), [['运干', '戊'], ['运支藏干', '戊']]);
 const matches = matchFortuneKnowledge(run).byMethod.bazi, hit = matches[125];
 assert.equal(hit.status, 'matched');
 assert.ok([before, after].every(row => hit.sourceFactIds.includes(row.factId)));
 for (const { normalizedPayload: data } of [before, after]) {
  assert.equal(data.hasKillerSealPressure, true);
  assert.equal(data.maoSourceAuthorityToExposedSeal, true);
  assert.ok(data.killerSealPressure.some(row => row.seal.position === 'hour' && row.seal.stem === '庚'));
 }
 assert.equal(matches[65].status, 'not_matched');
 const near = candidate({ ...printed('mao'), hour: '辛酉' }, '戊辰');
 const pressure = evaluateFortuneRules('bazi', 'year', [near]).find(row => row.knowledgeId === matches[65].knowledgeId);
 assert.deepEqual(pressure.required[0].hits, [near]);
 assert.equal(ctx(printed('mao'), '戊辰', false).maoSourceAuthorityToExposedSeal, undefined);
 const { input } = modelContext(run);
 const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId);
 assert.match(finding?.originalText ?? '', /財則黨煞破\s*印/u);
 assert.deepEqual(finding.windows, hit.windows);
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('生上述透杀并克其所生的同一透印'));
 assert.ok(prompt.includes('生同一原局透印，同时克日元'));
 assert.doesNotMatch(prompt, /exposedKillerSealLuck|foodCheckedBySeal/u);
});

test('p084 distinguishes the native-output condition for peers from incoming output at the actual Gui-Chou to Jia-Yin change', () => {
 const run = submitted([1962, 8, 22], 4, 2018);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '甲寅');
 assert.ok(change);
 const before = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '癸丑' && row.activeTo === change.exactInstant);
 const after = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '甲寅' && row.activeFrom === change.exactInstant);
 assert.ok(before && after);
 const path = fact => fact.normalizedPayload.sealLuckEvidence.maLuck;
 assert.deepEqual(path(before).peersWithOriginalOutput.map(row => [row.kind, row.stem]), [['运干', '癸']]);
 assert.deepEqual(path(before).movingOutput, []);
 assert.ok(path(before).originalOutput.some(row => row.position === 'year' && row.stem === '甲' && row.kind === '支藏'));
 assert.deepEqual(path(after).peersWithOriginalOutput, []);
 assert.deepEqual(path(after).movingOutput.map(row => [row.kind, row.stem]), [['运干', '甲'], ['运支藏干', '甲']]);
 assert.deepEqual(path(after).nativeWater.map(({ root, sameStem }) => [root.position, root.stem, sameStem]),
  [['month', '壬', true], ['day', '癸', false]]);
 const matches = matchFortuneKnowledge(run).byMethod.bazi, hit = matches[126];
 assert.equal(hit.status, 'matched');
 assert.ok([before, after].every(row => hit.sourceFactIds.includes(row.factId)));
 const oldGeometry = before.normalizedPayload;
 assert.equal(oldGeometry.maSourceStrongDayLightSeal, true);
 assert.equal(oldGeometry.hasKillerSealPressure, true);
 assert.equal(oldGeometry.hasRobberyWithSeal, true);
 assert.ok(oldGeometry.robberyAgainstSealWealth.some(path => path.robbery.stem === '癸'
  && path.natalWealthPaths.some(({ wealth, seal }) => wealth.position === 'year' && wealth.stem === '丙'
   && seal.position === 'month' && seal.stem === '庚')));
 assert.deepEqual([46, 47, 65].map(index => matches[index].status), ['not_matched', 'not_matched', 'not_matched']);
 const near = candidate({ ...printed('ma'), hour: '甲辰' }, '癸丑');
 const candidates = evaluateFortuneRules('bazi', 'year', [near]);
 for (const index of [46, 47, 65]) {
  const comparable = candidates.find(row => row.knowledgeId === matches[index].knowledgeId);
  assert.deepEqual(comparable.required[0].hits, [near]);
 }
 assert.equal(ctx(printed('ma'), '癸丑', false).maSourceStrongDayLightSeal, undefined);
 const prompt = formatFortuneFactAudit(modelContext(run).input);
 assert.ok(prompt.includes('含原局食伤的比劫运') && prompt.includes('生本运食伤'));
});

test('the named Ma chart switches from incoming output to financial pressure at the actual Bing-Chen change', () => {
 const date = [1962, 8, 22];
 const run = submitted(date, 4, 2038), cut = '2038-05-28T02:00:00.000Z';
 const before = rows(run).find(row => row.normalizedPayload.luckPillar === '乙卯' && row.activeTo === cut);
 const after = rows(run).find(row => row.normalizedPayload.luckPillar === '丙辰' && row.activeFrom === cut);
 assert.ok(before && after);
 const original = before.normalizedPayload.sealLuckEvidence, current = after.normalizedPayload.sealLuckEvidence;
 assert.ok(original.maLuck.movingOutput.length > 0);
 assert.deepEqual(original.maWealth, []);
 assert.deepEqual(current.maLuck.movingOutput, []);
 assert.deepEqual(current.maWealth.map(row => [row.moving.stem, row.killer.position, row.killer.stem, row.seal.position, row.seal.stem]),
  [['丙', 'month', '戊', 'month', '庚']]);
 assert.equal(current.maZi, false);
 const hit = match(run, 126);
 assert.equal(hit.status, 'matched');
 assert.ok([before, after].every(row => hit.sourceFactIds.includes(row.factId)));
 assert.ok(current.outputWealthSealPaths.some(row => row.output.stem === '甲'
  && row.wealth.stem === '丙' && row.seal.position === 'month' && row.seal.stem === '庚'));
 assert.ok(!after.normalizedPayload.sealLuckRoutes.includes('wealth-presses-seal-with-output'));
 assert.equal(match(run, 130).status, 'not_matched');
 const { input } = modelContext(run);
 assert.match(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId)?.originalText ?? '', /斷其樞紐/u);

 const changed = submitted(date, 8, 2038), differentCut = '2038-05-08T06:00:00.000Z';
 const changedFact = rows(changed).find(row => row.normalizedPayload.luckPillar === '丙辰' && row.activeFrom === differentCut);
 assert.ok(changedFact);
 assert.ok(changedFact.normalizedPayload.sealLuckEvidence.maWealth.length > 0);
 assert.equal(match(changed, 126).status, 'not_matched');
 assert.ok(match(changed, 130).sourceFactIds.includes(changedFact.factId));
});

test('robbery, seal and incoming authority use the actual wealth and monthly seal positions', () => {
 const base = ref.calendarExamples[127];
 const robbery = submittedCalendar(base), seal = submittedCalendar({ ...base, luck: '乙亥', year: 2011 });
 assert.ok(robbery.evidence.robberyChecksWealth.some(row => row.moving.stem === '丁' && row.wealth.position === 'year'
  && row.wealth.kind === '透干' && row.wealth.stem === '庚' && row.seal.position === 'month' && row.seal.stem === '甲'));
 assert.ok(seal.evidence.sealsHelpWithWealth.some(row => row.moving.stem === '乙' && row.day.stem === '丙'
  && row.pressures.some(link => link.from.stem === '庚' && link.from.kind === '透干' && link.to.stem === '甲')));
 const authority = submittedCalendar({ ...base, luck: '癸酉', year: 2030 });
 assert.deepEqual(authority.evidence.robberyChecksWealth, []);
 assert.deepEqual(authority.evidence.sealsHelpWithWealth, []);
 assert.ok(authority.evidence.wealthFeedsLuckOfficer.some(row => row.wealth.position === 'year' && row.wealth.stem === '庚'
  && row.moving.stem === '癸' && row.moving.kind === '运干' && row.seal.position === 'month' && row.seal.stem === '甲'));
 for (const { run, fact } of [robbery, seal, authority]) {
  const hit = match(run, 127);
  assert.equal(hit.status, 'not_matched');
  assert.ok(!hit.sourceFactIds.includes(fact.factId));
  assert.equal(fact.normalizedPayload.namedHeavySeal, false);
 }
 assert.ok(describeFortuneFact({ method: 'bazi', type: authority.fact.factType, data: authority.fact.normalizedPayload }, String)
  .includes('财印之间的运官杀候选'));
});

test('a non-original companion still controls the same wealth without invoking the published weak-seal case', () => {
 const run = submitted([1980, 1, 8], 4, 2020), cut = '2020-07-25T12:00:00.000Z';
 const before = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '癸酉' && row.activeTo === cut);
 const after = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '壬申' && row.activeFrom === cut);
 assert.ok(before && after);
 const old = before.normalizedPayload, current = after.normalizedPayload;
 const receiver = path => path.wealth.position === 'year' && path.wealth.pillar === '己未' && path.wealth.stem === '乙'
  && path.seal.position === 'month' && path.seal.pillar === '丁丑' && path.seal.stem === '己';
 assert.ok(old.sealLuckEvidence.robberyChecksWealth.some(path => receiver(path) && path.moving.stem === '辛'));
 const { robberyChecksWealth, companionChecksWealth, sealsHelpWithWealth, wealthFeedsLuckOfficer } = current.sealLuckEvidence;
 assert.deepEqual([robberyChecksWealth, sealsHelpWithWealth, wealthFeedsLuckOfficer], [[], [], []]);
 const companion = companionChecksWealth.find(receiver);
 assert.deepEqual([companion.moving.pillar, companion.moving.kind, companion.moving.stem, companion.moving.god],
  ['壬申', '运支藏干', '庚', '比肩']);
 assert.ok(current.sealLuckRoutes.includes('companion-checks-natal-wealth'));
 assert.ok(!current.sealLuckRoutes.includes('robbery-seal-or-authority-against-wealth'));
 const result = match(run, 127);
 assert.equal(result.status, 'not_matched');
 assert.deepEqual(result.sourceFactIds, []);
 for (const index of [46, 47]) {
  const priorOnly = match(run, index);
  assert.equal(priorOnly.status, 'partial');
  assert.ok(priorOnly.sourceFactIds.includes(before.factId));
  assert.ok(!priorOnly.sourceFactIds.includes(after.factId));
  assert.equal(priorOnly.windows.at(-1).endExclusive, cut);
 }
 const { input } = modelContext(run);
 const prompt = describeFortuneFact({ method: 'bazi', type: after.factType, data: current }, String);
 assert.match(prompt, /比肩制财的候选.{0,45}壬申.{0,16}庚.{0,14}克.{0,45}乙/u);
 assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== result.knowledgeId)));
});

test('the multiple-seal branch excludes a single seal and binds both wealth and output luck to the monthly seal', () => {
 const base = ref.calendarExamples[128];
 const one = submittedCalendar({ ...ref.calendarExamples[127], luck: base.luck, year: base.year });
 const wealth = submittedCalendar(base);
 const output = submittedCalendar({ ...base, luck: '己巳', year: 2071 });
 assert.deepEqual(one.evidence.originalSealPositions.map(row => [row.position, row.stem]), [['month', '甲']]);
 assert.ok(one.evidence.wealthControlsMonthSeal.length);
 assert.equal(match(one.run, 128).status, 'not_matched');
 assert.deepEqual(wealth.evidence.originalSealPositions.map(row => [row.position, row.stem]), [['month', '甲'], ['hour', '乙']]);
 assert.deepEqual(wealth.evidence.nativeSealColumns, ['month', 'hour']);
 assert.ok(wealth.evidence.wealthControlsMonthSeal.some(link => link.from.stem === '辛' && link.to.stem === '甲'));
 assert.ok(wealth.evidence.multipleSealWealthPaths.some(path => path.wealth.position === 'year' && path.wealth.stem === '庚'
  && path.seal.position === 'month' && path.seal.stem === '甲' && path.movingWealth.some(row => row.stem === '辛')));
 assert.deepEqual(output.evidence.wealthControlsMonthSeal, []);
 assert.ok(output.evidence.movingOutputFeedsWealth.some(row => row.moving.stem === '己' && row.wealth.stem === '庚'
  && row.seal.position === 'month' && row.seal.stem === '甲'));
 assert.ok(output.evidence.multipleSealWealthPaths.some(path => path.wealth.position === 'year' && path.wealth.stem === '庚'
  && path.seal.position === 'month' && path.seal.stem === '甲' && path.movingOutput.some(row => row.stem === '己')));
 for (const { run, fact } of [wealth, output]) {
  const hit = match(run, 128);
  assert.equal(hit.status, 'not_matched');
  assert.ok(!hit.sourceFactIds.includes(fact.factId));
 }
 assert.equal(match(one.run, 130).status, 'matched');
 assert.ok(one.evidence.dayFeedsOriginalOutput.some(link => link.from.stem === '丙' && link.to.stem === '戊'));
});

test('the Xia diagram keeps monthly wealth and authority contacts but excludes the opposite source judgments', () => {
 const natal = ['壬寅', '丁未', '丙寅', '壬辰'];
 const date = [1962, 7, 27];
 const range = [
  [1996, ['庚戌', '辛亥'], [true, true], [false, true]],
  [2006, ['辛亥', '壬子'], [true, false], [true, true]],
  [2016, ['壬子', '癸丑'], [false, false], [true, true]],
 ];
 for (const [year, pillars, expectedWealth, expectedAuthority] of range) {
  const run = submitted(date, 8, year);
  const boundary = year + '-07-29T18:00:00.000Z';
  const stages = pillars.map((pillar, i) => rows(run).find(row => row.normalizedPayload.luckPillar === pillar
   && row[i === 0 ? 'activeTo' : 'activeFrom'] === boundary));
  assert.ok(stages.every(Boolean), year);
  const payloads = stages.map(row => row.normalizedPayload);
  assert.deepEqual(payloads.map(row => row.xiaSourceFavorsArrivingWealth), expectedWealth);
  assert.deepEqual(payloads.map(row => row.xiaSourceFavorsArrivingAuthority), expectedAuthority);
  for (const p of payloads) {
   assert.equal(p.natalPillarSequence, natal.join(''));
   const witness = p.xiaSourceWealthAuthority;
   assert.deepEqual([witness.monthSeal.position, witness.monthSeal.stem, witness.waterRoot.position, witness.waterRoot.stem],
    ['month', '乙', 'hour', '癸']);
   assert.deepEqual(witness.dingRenPairs.map(({ first, second }) => [first.position, second.position]),
    [['year', 'month'], ['month', 'hour']]);
   if (p.xiaSourceFavorsArrivingWealth) {
    assert.equal(p.hasWealthPressingMonthHurtSeal, true);
    assert.equal(witness.wealthPressure.hurt.stem, '己');
    assert.deepEqual(witness.wealthPressure.wealth.map(row => row.stem), [p.luckPillar[0]]);
   }
   if (p.xiaSourceFavorsArrivingAuthority) {
    assert.equal(p.hasKillerSealPressure, true);
    assert.ok(witness.authorityPressure.moving.some(row => row.stem === (p.luckPillar === '辛亥' ? '壬' : p.luckPillar[0])));
   }
  }
  assert.deepEqual([60, 65].map(index => match(run, index).status), ['not_matched', 'not_matched']);
 }
 const alternate = submitted(date, 10, 1996);
 const sameLuck = rows(alternate).find(row => row.normalizedPayload.luckPillar === '辛亥');
 assert.ok(sameLuck);
 assert.equal(sameLuck.normalizedPayload.natalPillarSequence, '壬寅丁未丙寅癸巳');
 assert.equal(sameLuck.normalizedPayload.xiaSourceWealthAuthority, undefined);
 for (const index of [60, 65]) {
  const rule = match(alternate, index);
  assert.equal(rule.status, 'partial');
  assert.ok(rule.sourceFactIds.includes(sameLuck.factId));
 }
 const unknown = ctx(native(natal), '辛亥', false);
 assert.equal(unknown.xiaSourceFavorsArrivingWealth, undefined);
 assert.equal(unknown.xiaSourceFavorsArrivingAuthority, undefined);
});

test('the printed light-seal wealth warning is distinct from the generic output rule and ends at Geng-Yin', () => {
 const run = submitted([1970, 12, 20], 22, 1986);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '庚寅');
 const boundary = '1986-06-08T08:00:00.000Z';
 assert.equal(change?.exactInstant, boundary);
 const wealth = rows(run).find(row => row.normalizedPayload.luckPillar === '己丑' && row.activeTo === boundary);
 const support = rows(run).find(row => row.normalizedPayload.luckPillar === '庚寅' && row.activeFrom === boundary);
 assert.ok(wealth && support);
 for (const { normalizedPayload: p } of [wealth, support]) {
  assert.equal(p.namedLightSeal, true);
  assert.equal(p.namedHeavySeal, false);
  const [witness] = p.sealLuckEvidence.lightSealWealthContrast;
  assert.equal(p.sourceHurtSealUse, 'used');
  assert.deepEqual([witness.robbery.position, witness.robbery.stem, witness.wealth.position, witness.wealth.stem,
   witness.killer.position, witness.killer.stem, witness.seal.position, witness.seal.stem],
   ['hour', '乙', 'month', '戊', 'year', '庚', 'month', '癸']);
  assert.ok(!p.sealLuckRoutes.includes('wealth-presses-seal-with-output'));
 }
 const fromWealth = wealth.normalizedPayload;
 assert.equal(fromWealth.hasWealthPressingHurtSeal, true);
 const hurtWealth = fromWealth.wealthPressesHurtSeal.filter(({ hurt, wealth: arrivals }) =>
  hurt.position === 'day' && hurt.stem === '丁' && arrivals.every(arrival => arrival.stem === '己'));
 assert.deepEqual(hurtWealth.map(({ seal }) => [seal.position, seal.stem]), [['month', '癸'], ['hour', '壬']]);
 assert.equal(match(run, 50).status, 'not_matched');
 assert.ok(fromWealth.sealLuckEvidence.multipleSealWealthPaths.length > 0);
 assert.ok(fromWealth.sealLuckEvidence.outputWealthSealPaths.length > 0);
 assert.deepEqual(fromWealth.sealLuckEvidence.lightSealWealthContrast[0].incomingWealth.map(row => [row.stem, row.kind]),
  [['己', '运干'], ['己', '运支藏干']]);
 assert.deepEqual(support.normalizedPayload.sealLuckEvidence.lightSealWealthContrast[0].incomingWealth, []);
 const helps = match(run, 127);
 assert.equal(helps.status, 'not_matched');
 assert.ok(support.normalizedPayload.sealLuckEvidence.wealthFeedsLuckOfficer.length > 0);
 assert.equal(match(run, 128).status, 'not_matched');
 assert.equal(fromWealth.hasLightSealSourceWealthPressure, true);
 assert.equal(support.normalizedPayload.hasLightSealSourceWealthPressure, false);
 const pressure = match(run, 130);
 assert.equal(pressure.status, 'matched');
 assert.equal(pressure.matchedSourceExcerpt, '印輕者亦不利見財');
 assert.ok(pressure.sourceFactIds.includes(wealth.factId) && !pressure.sourceFactIds.includes(support.factId));
 assert.equal(pressure.windows.at(-1).endExclusive, boundary);
 const otherHour = ctx({ ...printed('light-seal-wealth'), hour: '甲戌' }, '己丑');
 assert.equal(otherHour.hasLightSealSourceWealthPressure, false);
 assert.equal(ctx(printed('light-seal-wealth'), '己丑', false).hasLightSealSourceWealthPressure, undefined);
 assert.equal(otherHour.namedLightSeal, false);
 assert.equal(otherHour.sourceHurtSealUse, 'undetermined');
 assert.equal(otherHour.hasWealthPressingHurtSeal, true);
 const close = candidate({ ...printed('light-seal-wealth'), hour: '甲戌' }, '己丑');
 const comparable = evaluateFortuneRules('bazi', 'year', [wealth, close])
  .find(rule => rule.knowledgeId === fortuneKnowledge.bazi.rules[50].knowledgeId);
 assert.deepEqual(comparable.required[0].hits, [close]);
 assert.equal(otherHour.sealLuckEvidence.lightSealWealthContrast, undefined);
 const { input } = modelContext(run);
 const phrase = /徐注将此原图按财旺、煞印均弱论/u;
 assert.match(formatFortuneFactAudit(input), phrase);
 const prompt = formatFortunePrompt(input);
 assert.doesNotMatch(prompt, phrase);
 assert.match(prompt, /财旺、煞印均弱.*原月戊财.*月子所藏癸印/u);
 assert.doesNotMatch(prompt, /hasLightSealSourceWealthPressure|lightSealWealthContrast/u);
});

test('the Jia-Ji source’s explicit heavy seal cannot stand in for either light-seal route', () => {
 const e = submittedCalendar({ date: [1979, 10, 31], hour: 10, gender: 1, year: 2047, luck: '丁卯',
  natal: ['己未', '甲戌', '辛未', '癸巳'] });
 assert.equal(e.fact.normalizedPayload.namedHeavySeal, true);
 assert.ok(e.evidence.robberyChecksWealth.length + e.evidence.sealsHelpWithWealth.length + e.evidence.wealthFeedsLuckOfficer.length > 0);
 assert.ok(e.evidence.outputWealthSealPaths.length > 0);
 assert.equal(match(e.run, 127).status, 'not_matched');
 assert.equal(match(e.run, 130).status, 'not_matched');
});

test('p086 excludes two seal positions in the same natal column despite incoming wealth controlling the month seal', () => {
 const sameColumn = submittedCalendar({ date: [1960, 10, 18], hour: 0, gender: 1, year: 1969, luck: '丁亥',
  natal: ['庚子', '丙戌', '己卯', '甲子'] });
 assert.deepEqual(sameColumn.evidence.originalSealPositions.map(row => [row.position, row.stem, row.kind]),
  [['month', '丙', '透干'], ['month', '丁', '支藏']]);
 assert.deepEqual(sameColumn.evidence.nativeSealColumns, ['month']);
 assert.ok(sameColumn.evidence.wealthControlsMonthSeal.some(link => link.from.stem === '壬' && link.to.stem === '丁'));
 assert.deepEqual(sameColumn.evidence.multipleSealWealthPaths, []);
 assert.equal(match(sameColumn.run, 128).status, 'not_matched');
});

test('the Lin Sen hour variants retain separate clash positions and the same wealth-to-heavy-seal route', () => {
 const cases = [
  { hour: 18, variant: '酉时', source: 'lin-sen-you', clash: '卯酉', columns: ['day', 'hour'], wealth: '辛', change: '1935-09-23T06:00:00.000Z' },
  { hour: 16, variant: '申时异文', source: 'lin-sen-shen', clash: '寅申', columns: ['month', 'hour'], wealth: '庚', change: '1935-10-03T04:00:00.000Z' },
 ];
 for (const e of cases) {
  const run = submitted([1868, 2, 11], e.hour, 1935);
  const before = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '庚申' && row.activeTo === e.change);
  const after = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '辛酉' && row.activeFrom === e.change);
  assert.ok(before && after, `原录${e.variant}的实际交运点应为${e.change}`);
  for (const [fact, arriving] of [[before, '庚'], [after, '辛']]) {
   const p = fact.normalizedPayload, comparison = p.sealLuckEvidence.linSenSealComparison;
   assert.ok(p.printedCases.some(row => row.id === e.source && row.matches === true));
   assert.deepEqual(comparison.easternMeeting, { kind: '三会', values: '寅卯辰', byBranch: [['month'], ['day'], ['year']] });
   assert.deepEqual(comparison.clash, { kind: '六冲', members: e.columns, values: e.clash });
   assert.deepEqual([comparison.variant, comparison.wealth.position, comparison.wealth.stem], [e.variant, 'hour', e.wealth]);
   assert.deepEqual([comparison.seal.position, comparison.seal.stem, comparison.seal.kind], ['month', '甲', '支藏']);
   assert.deepEqual([comparison.exposedSeal.position, comparison.exposedSeal.stem], ['month', '甲']);
   assert.deepEqual(comparison.incomingWealth.map(row => [row.stem, row.kind]), [[arriving, '运干'], [arriving, '运支藏干']]);
   assert.ok(p.sealLuckRoutes.includes('lin-sen-wealth-reduces-heavy-seal'));
   assert.equal(p.sourceHurtSealUse, 'reduce-seal');
   assert.equal(p.hasWealthPressingMonthHurtSeal, true);
   assert.ok(p.sealLuckEvidence.outputWealthSealPaths.length > 0, '几何仍在，原书命例的印重证据排除印轻候选');
   assert.ok(!p.sealLuckRoutes.includes('wealth-presses-seal-with-output'));
  }
  const heavy = match(run, 128);
  assert.equal(heavy.status, 'matched');
  assert.ok(heavy.sourceFactIds.includes(before.factId));
  assert.ok(heavy.sourceFactIds.includes(after.factId));
  const remedy = match(run, 47);
  assert.equal(remedy.status, 'matched');
  assert.equal(remedy.matchedSourceExcerpt, '喜財損印');
  assert.ok(remedy.sourceFactIds.includes(before.factId) && remedy.sourceFactIds.includes(after.factId));
  const namedOnly = { ...after, normalizedPayload: { ...after.normalizedPayload, sealLuckRoutes: ['lin-sen-wealth-reduces-heavy-seal'] } };
  const evaluated = evaluateFortuneRules('bazi', 'year', [namedOnly]).find(row => row.knowledgeId === heavy.knowledgeId);
  assert.deepEqual(evaluated.required[0].hits.map(row => row.factId), [namedOnly.factId]);
  assert.equal(match(run, 130).status, 'not_matched');
  assert.equal(match(run, 60).status, 'not_matched');
  const close = candidate({ ...printed(e.source), hour: '庚戌' }, '辛酉');
  const weakSeal = evaluateFortuneRules('bazi', 'year', [before, after, close])
   .find(rule => rule.knowledgeId === fortuneKnowledge.bazi.rules[60].knowledgeId);
  assert.deepEqual(weakSeal.required[0].hits, [close]);
  const { input } = modelContext(run);
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /林森/u);
  assert.match(formatFortunePrompt(input), /兩種時柱讀法為財輕印多|两种时柱读法为财轻印多/u);
  assert.match(prompt, new RegExp(e.clash, 'u'));
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === heavy.knowledgeId);
  assert.deepEqual(finding.windows, heavy.windows);
  assert.match(finding.note, /林森/u);
 }

 const alternate = submitted([2048, 2, 27], 18, 2051);
 const support = rows(alternate).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '乙卯').normalizedPayload;
 assert.equal(support.namedHeavySeal, true);
 assert.equal(support.sourceHurtSealUse, 'reduce-seal');
 assert.ok(support.sealLuckEvidence.sealsHelpWithWealth.length > 0);
 assert.deepEqual(support.sealLuckEvidence.linSenSealComparison.incomingWealth, []);
 assert.ok(!support.sealLuckRoutes.includes('lin-sen-wealth-reduces-heavy-seal'));
 assert.equal(match(alternate, 127).status, 'not_matched');
 assert.notEqual(match(alternate, 47).status, 'matched');

 const otherClock = ctx({ ...printed('lin-sen-you'), hour: '庚戌' }, '辛酉');
 assert.equal(otherClock.namedHeavySeal, false);
 assert.equal(otherClock.sourceHurtSealUse, 'undetermined');
 assert.equal(otherClock.hasWealthPressingMonthHurtSeal, true);
 assert.equal(ctx(printed('lin-sen-you'), '辛酉', false).sourceHurtSealUse, undefined);
 assert.equal(otherClock.sealLuckEvidence.linSenSealComparison, undefined);
 assert.ok(!otherClock.sealLuckRoutes.includes('lin-sen-wealth-reduces-heavy-seal'));
 assert.equal(ctx(printed('lin-sen-you'), '辛酉', false).sealLuckEvidence.linSenSealComparison, undefined);
});

test('the printed wealthy-son seal support and wealth pressure remain distinct in both real transitions', async () => {
 const windows = [
  { year: 1938, prior: '己卯', next: '庚辰', change: '1938-12-22T12:00:00.000Z' },
  { year: 1948, prior: '庚辰', next: '辛巳', change: '1948-12-22T12:00:00.000Z' },
 ];
 for (const e of windows) {
  const run = submitted([1920, 2, 8], 14, e.year);
  const before = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === e.prior && row.activeTo === e.change);
  const after = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === e.next && row.activeFrom === e.change);
  assert.ok(before && after, `${e.prior}应于${e.change}交${e.next}`);
  for (const fact of [before, after]) {
   const p = fact.normalizedPayload, comparison = p.sealLuckEvidence.wealthySonSealComparison;
   assert.ok(p.printedCases.some(row => row.id === 'wealthy-son-wu-yin' && row.matches === true));
   assert.equal(p.namedLightSeal, true);
   assert.deepEqual(comparison.clashes, [
    { kind: '六冲', members: ['year', 'month'], values: '申寅' },
    { kind: '六冲', members: ['month', 'day'], values: '寅申' },
   ]);
   assert.deepEqual([comparison.seal.position, comparison.seal.stem, comparison.seal.kind], ['month', '甲', '支藏']);
   assert.deepEqual([comparison.yiGeng.first.position, comparison.yiGeng.first.stem, comparison.yiGeng.second.position, comparison.yiGeng.second.stem],
    ['year', '庚', 'hour', '乙']);
   assert.equal(comparison.yiGeng.adjacent, false);
   assert.deepEqual(comparison.hiddenPeers.map(row => [row.position, row.stem]), [['month', '丙'], ['hour', '丁']]);
   if (p.luckPillar === '己卯') {
    assert.deepEqual([comparison.incomingSeal.stem, comparison.incomingSeal.kind, comparison.incomingWealth], ['乙', '运支藏干', []]);
    assert.ok(p.sealLuckRoutes.includes('wealthy-son-mao-helps-seal'));
   } else {
    assert.equal(comparison.incomingSeal, undefined);
    assert.deepEqual(comparison.incomingWealth.map(row => [row.stem, row.kind]), [[p.luckPillar[0], '运干']]);
    assert.ok(p.sealLuckEvidence.multipleSealWealthPaths.length > 0);
    assert.ok(p.sealLuckEvidence.outputWealthSealPaths.length > 0);
    assert.ok(!p.sealLuckRoutes.includes('wealth-reaches-multiple-seals'));
    assert.ok(!p.sealLuckRoutes.includes('wealth-presses-seal-with-output'));
    assert.ok(p.sealLuckRoutes.includes('wealthy-son-wealth-presses-light-seal'));
    if (p.luckPillar === '辛巳') {
     assert.ok(p.sealLuckEvidence.companionChecksWealth.some(path => path.moving.stem === '丙'));
     assert.ok(!p.sealLuckRoutes.includes('companion-checks-natal-wealth'));
    }
   }
  }
  const weak = match(run, 127);
  assert.equal(weak.status, 'matched');
  assert.ok(weak.sourceFactIds.includes(before.factId));
  assert.ok(weak.sourceFactIds.includes(after.factId));
  if (e.prior === '己卯') {
   const namedOnly = { ...before, normalizedPayload: { ...before.normalizedPayload, sealLuckRoutes: ['wealthy-son-mao-helps-seal'] } };
   const checked = evaluateFortuneRules('bazi', 'year', [namedOnly]).find(row => row.knowledgeId === weak.knowledgeId);
   assert.deepEqual(checked.required[0].hits.map(row => row.factId), [before.factId]);
  }
  assert.equal(match(run, 128).status, 'not_matched');
  assert.equal(match(run, 130).status, 'not_matched');
  const { input } = modelContext(run);
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /浙西.{0,8}富翁子/u);
  assert.match(prompt, /年申与日申分别冲月寅/u);
  assert.ok(input.facts.some(row => row.type === 'zpqz_seal_food_context' && row.start === e.change
   && row.data.sealLuckEvidence?.wealthySonSealComparison));
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === weak.knowledgeId);
  assert.deepEqual(finding.windows, weak.windows);
  if (e.prior === '己卯') {
   assert.match(finding.note, /己卯[^。]*庚辰[^。]*辛巳|己卯[^。]*。[^。]*庚辰[^。]*辛巳/u);
   let checked = false;
   const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_url, options) => {
    const content = JSON.parse(options.body).messages[1].content;
    assert.ok(content.includes(finding.note));
    assert.ok(content.includes('如印輕財重，則為貪財壞印'));
    checked = true;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
   } });
   await provider.interpret(input);
   assert.ok(checked);
  }
 }
 const impossibleVersion = ctx(printed('wealth-seal'), '己卯');
 assert.equal(impossibleVersion.sealLuckEvidence.wealthySonSealComparison, undefined);
 assert.ok(!impossibleVersion.sealLuckRoutes.includes('wealthy-son-mao-helps-seal'));
 const wrongHour = ctx({ ...printed('wealthy-son-wu-yin'), hour: '癸巳' }, '己卯');
 assert.equal(wrongHour.sealLuckEvidence.wealthySonSealComparison, undefined);
});

test('natal and moving authority converge on the same exposed seal without substituting a hidden seal', () => {
 const actual = submittedCalendar(ref.calendarExamples[129]);
 const hit = match(actual.run, 129);
 assert.equal(hit.status, 'matched');
 assert.equal(hit.matchedSourceExcerpt, '印如透干，再見官煞運');
 assert.equal(actual.fact.normalizedPayload.hasUnopposedAuthorityToExposedSeal, true);
 assert.ok(hit.sourceFactIds.includes(actual.fact.factId));
 assert.deepEqual(actual.evidence.natalAuthoritySeal.map(row => [
  row.seal.stem, row.officers.map(from => from.stem), row.killers.map(from => from.stem),
  row.moving.map(from => [from.kind, from.stem]), row.day.stem,
 ]), [['己', ['丁'], ['丙'], [['运支藏干', '丙']], '庚']]);
 const { input } = modelContext(actual.run);
 assert.match(formatFortunePrompt(input), /原局明透的同一印星承接本命正官、七杀和实运官杀/u);
 assert.doesNotMatch(formatFortunePrompt(input), /亦無大礙|hasUnopposedAuthorityToExposedSeal/u);
 const contested = ctx(native(ref.calendarExamples[129].natal), '丁亥');
 assert.ok(contested.sealLuckEvidence.natalAuthoritySeal.some(row => row.moving.some(authority => authority.stem === '丁')));
 assert.ok(contested.remedyMovingContacts.some(({ from, to, relation }) =>
  from.kind === '运支藏干' && from.stem === '甲' && to.position === 'year' && to.stem === '己' && relation === '克'));
 assert.equal(contested.hasUnopposedAuthorityToExposedSeal, false);
 const hidden = submittedCalendar(ref.hiddenAuthoritySeal);
 assert.equal(hidden.fact.normalizedPayload.officerAndKillerExposed, true);
 assert.equal(hidden.fact.normalizedPayload.sealsExposed, false);
 assert.equal(hidden.fact.normalizedPayload.hasUnopposedAuthorityToExposedSeal, false);
 assert.deepEqual(hidden.evidence.natalAuthoritySeal, []);
 assert.equal(match(hidden.run, 129).status, 'not_matched');
 const printedChart = ctx(printed('officer-killer-seal'), '庚寅');
 assert.equal(printedChart.sealsExposed, false);
 assert.ok(printedChart.sealLuckEvidence.natalAuthorityCombinations.some(row => row.kill.stem === '庚' && row.combiner.stem === '乙'));
 assert.deepEqual(printedChart.sealLuckEvidence.natalAuthoritySeal, []);
});

test('p087 tracks the same exposed seal when an incoming wealth stem feeds both natal authorities', () => {
 const base = ref.calendarExamples[129];
 const wealth = submittedCalendar({ ...base, year: 2052, luck: '甲申' });
 const [path] = wealth.evidence.natalAuthoritySeal;
 assert.deepEqual([path.seal.position, path.seal.stem, path.day.stem], ['year', '己', '庚']);
 assert.deepEqual(path.moving, []);
 assert.equal(wealth.fact.normalizedPayload.hasUnopposedAuthorityToExposedSeal, false);
 assert.deepEqual(path.movingWealth.map(row => [row.wealth.kind, row.wealth.stem, row.feeds.map(feed => [feed.position, feed.stem])]),
  [['运干', '甲', [['month', '丁'], ['hour', '丙']]]]);
 assert.ok(match(wealth.run, 129).sourceFactIds.includes(wealth.fact.factId));
 assert.ok(formatFortuneFactAudit(modelContext(wealth.run).input).includes('同时克上述官杀所生之'));
});

test('the literal Jia-Chen source has its own Wu-Xu concealed-seal path alongside the exposed-seal rule', () => {
 const run = submitted([2031, 12, 30], 22, 2049);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊戌');
 assert.ok(change);
 const fact = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '戊戌'
  && row.activeFrom === change.exactInstant);
 assert.ok(fact);
 const payload = fact.normalizedPayload;
 assert.equal(payload.natalPillarSequence, '辛亥庚子甲辰乙亥');
 assert.equal(payload.sealsExposed, false);
 assert.deepEqual(payload.sealLuckEvidence.natalAuthoritySeal, []);
 assert.ok(payload.sealLuckEvidence.natalAuthorityCombinations.some(row => row.kill.stem === '庚' && row.combiner.stem === '乙'));
 const [path] = payload.jiaChenAuthorityComparison.monthPaths;
 assert.deepEqual([path.seal.kind, path.seal.position, path.seal.stem, path.day.stem], ['支藏', 'month', '癸', '甲']);
 assert.deepEqual(path.movingWealth.map(row => [row.wealth.kind, row.wealth.stem, row.feeds.map(feed => feed.stem)]),
  [['运干', '戊', ['辛', '庚']], ['运支藏干', '戊', ['辛', '庚']]]);
 assert.ok(payload.sealLuckRoutes.includes('jia-chen-wu-xu-hidden-seal'));
 assert.ok(!payload.sealLuckRoutes.includes('wealth-presses-exposed-authority-seal'));
 const previous = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '己亥'
  && row.activeTo === change.exactInstant);
 assert.ok(previous);
 assert.ok(!previous.normalizedPayload.sealLuckRoutes.includes('jia-chen-wu-xu-hidden-seal'));
 assert.ok(previous.normalizedPayload.sealLuckRoutes.includes('jia-chen-wealth-presses-month-seal'));
 assert.ok(!payload.sealLuckRoutes.includes('jia-chen-wealth-presses-month-seal'));
 assert.deepEqual(previous.normalizedPayload.jiaChenAuthorityComparison.monthPaths[0].movingWealth.map(row =>
  [row.wealth.kind, row.wealth.stem, row.feeds.map(feed => feed.stem)]), [['运干', '己', ['辛', '庚']]]);
 assert.equal(previous.normalizedPayload.jiaChenAuthorityComparison.supportingBranch.branchQi.stem, '壬');
 const { input, knowledge } = modelContext(run);
 const hit = knowledge.byMethod.bazi[129];
 assert.equal(hit.status, 'partial');
 assert.ok(hit.sourceFactIds.includes(fact.factId));
 assert.ok(hit.sourceFactIds.includes(previous.factId));
 assert.equal(payload.hasUnopposedAuthorityToExposedSeal, false);
 assert.ok(input.sections.flatMap(section => section.findings).every(row => row.knowledgeId !== hit.knowledgeId));
 assert.doesNotMatch(formatFortunePrompt(input), /甲辰原图的印在月子藏癸|印如透干，再見官煞運|林注另以土制水/u);
 assert.ok(input.facts.some(row => row.type === 'zpqz_seal_food_context' && row.data.jiaChenAuthorityComparison
  && row.data.luckPillar === '戊戌' && row.start === change.exactInstant));
 const prompt = formatFortuneFactAudit(input);
 assert.ok(prompt.includes('甲辰原图只见藏印'));
 assert.match(prompt, /甲辰图实际运财.*己亥.*运干己/u);
 assert.ok(prompt.includes('甲辰图戊戌运保留原评有关波折的提醒'));
 assert.ok(fortuneKnowledge.bazi.rules[129].review.mappedConditions.some(row => /林注.*土制水.*木泄水.*火调候/u.test(row)));
 assert.doesNotMatch(prompt, /jiaChenAuthorityComparison|movingWealth/u);
});

test('the Jia-Chen concealed-seal source distinguishes actual output stages from the wealth warning', () => {
 const date = [2031, 12, 30];
 for (const [year, previous, incoming, outputStem, authorityStem] of [
  [2059, '戊戌', '丁酉', '丁', '辛'], [2069, '丁酉', '丙申', '丙', '庚'],
 ]) {
  const run = submitted(date, 22, year);
  const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === incoming);
  assert.equal(change?.exactInstant, year + '-09-29T10:00:00.000Z');
  const before = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === previous);
  const after = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === incoming);
  assert.ok(before && after);
  const data = after.normalizedPayload;
  assert.equal(data.natalPillarSequence, '辛亥庚子甲辰乙亥');
  assert.equal(data.sealsExposed, false);
  assert.equal(data.hasOutput, false);
  assert.ok(!data.sealLuckRoutes.includes('jia-chen-wu-xu-hidden-seal'));
  assert.ok(data.sealLuckRoutes.includes('jia-chen-output-drains-day'));
  const [proof] = data.jiaChenAuthorityComparison.outputLuck;
  assert.deepEqual([proof.day.position, proof.day.stem, proof.output.kind, proof.output.stem, proof.seal.position, proof.seal.stem],
   ['day', '甲', '运干', outputStem, 'month', '癸']);
  assert.deepEqual(proof.checksAuthority.map(row => [row.position, row.stem]), [['year', '辛'], ['month', '庚']]);
  assert.deepEqual(proof.movingAuthorityToSameSeal.map(row => [row.kind, row.stem]), [['运支藏干', authorityStem]]);
  const hit = match(run, 129);
  const sourceWarning = previous === '戊戌';
  assert.equal(hit.status, 'partial');
  assert.ok(hit.sourceFactIds.includes(before.factId));
  assert.ok(hit.sourceFactIds.includes(after.factId));
  if (sourceWarning) {
   assert.deepEqual(before.normalizedPayload.jiaChenAuthorityComparison.outputLuck, []);
   assert.ok(before.normalizedPayload.sealLuckRoutes.includes('jia-chen-wu-xu-hidden-seal'));
  }
  const { input } = modelContext(run);
  assert.ok(input.sections.flatMap(section => section.findings).every(row => row.knowledgeId !== hit.knowledgeId));
  assert.match(formatFortuneFactAudit(input), /甲辰原例按原评取食伤泄秀/u);
  assert.doesNotMatch(formatFortunePrompt(input), /甲辰原例按原评取食伤泄秀/u);
 }
 const variant = submitted(date, 20, 2060);
 const sameLuck = rows(variant).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '丁酉');
 assert.ok(sameLuck);
 assert.equal(sameLuck.normalizedPayload.jiaChenAuthorityComparison, undefined);
 assert.equal(match(variant, 129).status, 'not_matched');
 const secondaryOnly = ctx(printed('officer-killer-seal'), '乙未');
 assert.deepEqual(secondaryOnly.jiaChenAuthorityComparison.outputLuck, []);
 assert.ok(!secondaryOnly.sealLuckRoutes.includes('jia-chen-output-drains-day'));
});

test('an actual Jia-Chen supporting branch is separate from wealth and authority at the concealed seal', () => {
 const date = [2031, 12, 30], run = submitted(date, 22, 2044, 0);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '壬寅');
 assert.equal(change?.exactInstant, '2044-01-25T22:00:00.000Z');
 const before = rows(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '辛丑');
 const after = rows(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '壬寅');
 assert.ok(before && after);
 const support = after.normalizedPayload.jiaChenAuthorityComparison.supportingBranch;
 assert.deepEqual([support.day.stem, support.seal.stem, support.branchQi.kind, support.branchQi.stem, support.branchQi.god],
  ['甲', '癸', '运支藏干', '甲', '比肩']);
 assert.deepEqual(support.assistingStems.map(row => [row.stem, row.god]), [['壬', '偏印']]);
 assert.deepEqual(support.competingWealth, []);
 assert.deepEqual(support.competingAuthority, []);
 const hit = match(run, 129);
 assert.equal(hit.status, 'partial');
 assert.ok([before, after].every(row => hit.sourceFactIds.includes(row.factId)));
 assert.ok(before.normalizedPayload.sealLuckRoutes.includes('jia-chen-wealth-presses-month-seal'));
 assert.ok(!before.normalizedPayload.sealLuckRoutes.includes('jia-chen-supporting-branch'));
 assert.ok(after.normalizedPayload.sealLuckRoutes.includes('jia-chen-supporting-branch'));
 assert.ok(!after.normalizedPayload.sealLuckRoutes.includes('jia-chen-wealth-presses-month-seal'));
 assert.deepEqual(before.normalizedPayload.jiaChenAuthorityComparison.monthPaths[0].movingWealth.map(row =>
  [row.wealth.kind, row.wealth.stem, row.feeds.map(feed => feed.stem)]), [['运支藏干', '己', ['辛', '庚']]]);
 assert.ok(before.normalizedPayload.sealLuckEvidence.officerMonthSealRelays.some(path => path.incomingWealth.length));
 assert.equal(match(run, 119).status, 'not_matched');

 const mixed = submitted(date, 22, 2049);
 const overlap = rows(mixed).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '己亥');
 assert.ok(overlap);
 const competing = overlap.normalizedPayload.jiaChenAuthorityComparison.supportingBranch;
 assert.equal(competing.branchQi.stem, '壬');
 assert.deepEqual(competing.competingWealth.map(row => row.stem), ['己']);
 assert.ok(!overlap.normalizedPayload.sealLuckRoutes.includes('jia-chen-supporting-branch'));
 assert.ok(overlap.normalizedPayload.sealLuckRoutes.includes('jia-chen-wealth-presses-month-seal'));
 assert.equal(match(mixed, 119).status, 'not_matched');

 const similar = submitted(date, 20, 2044, 0);
 const similarStage = rows(similar).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '壬寅');
 assert.ok(similarStage);
 assert.equal(similarStage.normalizedPayload.jiaChenAuthorityComparison, undefined);
 assert.equal(match(similar, 129).status, 'not_matched');
 const { input } = modelContext(run);
 assert.match(formatFortuneFactAudit(input), /甲辰原例的身印旺地取法/u);
 assert.doesNotMatch(formatFortunePrompt(input), /甲辰原例的身印旺地取法/u);
});

test('the Wang southeast wood and fire periods use their actual route across the Jia-Wu and Gui-Si handoff', () => {
 const run = submitted([1981, 8, 22], 22, 2006);
 const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '癸巳');
 assert.ok(change);
 const before = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '甲午'
  && row.activeTo === change.exactInstant);
 const after = rows(run).find(row => row.normalizedPayload.confirmed && row.normalizedPayload.luckPillar === '癸巳'
  && row.activeFrom === change.exactInstant);
 assert.ok(before && after);
 assert.deepEqual(before.normalizedPayload.sealLuckEvidence.wangBingXin.southeastLuck.map(row => row.stem), ['甲', '丁']);
 assert.equal(after.normalizedPayload.sealLuckEvidence.wangSiWealth.stem, '丙');
 const hit = match(run, 128);
 assert.equal(hit.status, 'matched');
 for (const fact of [before, after]) {
  assert.ok(fact.normalizedPayload.sealLuckRoutes.includes('wang-luck-contrast'));
  assert.ok(fact.normalizedPayload.sealLuckRoutes.includes('wang-wealth-relief'));
  assert.ok(hit.sourceFactIds.includes(fact.factId));
 }
 const changedHour = ctx({ ...printed('wang'), hour: '庚戌' }, '癸巳');
 assert.equal(changedHour.sealLuckEvidence.wangSiWealth, undefined);
 assert.ok(!changedHour.sealLuckRoutes.includes('wang-luck-contrast'));

 const east = submitted([1981, 8, 22], 22, 2026), cut = '2026-08-16T20:00:00.000Z';
 const warning = rows(east).find(row => row.normalizedPayload.luckPillar === '壬辰' && row.activeTo === cut);
 const eastern = rows(east).find(row => row.normalizedPayload.luckPillar === '辛卯' && row.activeFrom === cut);
 assert.ok(warning && eastern);
 const easternHit = match(east, 128);
 assert.equal(easternHit.status, 'matched');
 assert.equal(easternHit.windows[0].start, cut);
 assert.ok(!easternHit.sourceFactIds.includes(warning.factId));
 assert.ok(easternHit.sourceFactIds.includes(eastern.factId));
 const { wangWoodRelief, wealthControlsMonthSeal } = eastern.normalizedPayload.sealLuckEvidence;
 assert.deepEqual(wealthControlsMonthSeal, []);
 assert.deepEqual([wangWoodRelief.output.stem, wangWoodRelief.wealth.position, wangWoodRelief.wealth.stem,
  wangWoodRelief.seal.position, wangWoodRelief.seal.stem], ['乙', 'month', '丙', 'month', '庚']);
});

test('p088 uses the connected output-wealth-seal positions and keeps Niu Ding-Hai as a named heavy-seal comparison', () => {
 const ordinary = submittedCalendar(ref.calendarExamples[130]);
 const path = ordinary.evidence.outputWealthSealPaths.find(row => row.output.position === 'month' && row.output.kind === '透干');
 assert.deepEqual([path.day.stem, path.output.stem, path.wealth.kind, path.wealth.stem, path.seal.position, path.seal.stem],
  ['丙', '戊', '运支藏干', '辛', 'month', '甲']);
 assert.ok(match(ordinary.run, 130).sourceFactIds.includes(ordinary.fact.factId));
 const niu = submittedCalendar({ date: [1950, 9, 25], hour: 8, gender: 1, year: 1975, luck: '丁亥',
  natal: ['庚寅', '乙酉', '癸亥', '丙辰'] });
 const crossing = niu.run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '戊子');
 assert.equal(crossing?.exactInstant, '1975-05-09T06:00:00.000Z');
 const next = rows(niu.run).find(row => row.activeFrom === crossing.exactInstant && row.normalizedPayload.luckPillar === '戊子');
 assert.ok(next);
 assert.equal(next.normalizedPayload.sourceWealthRole, 'remedy');
 assert.equal(next.normalizedPayload.hasNiuSourceFoodWealthReducingHeavySeal, false);
 assert.deepEqual(niu.evidence.niuLuck.incomingWealth.map(row => [row.output.stem, row.wealth.stem, row.seal.stem]),
  [['乙', '丁', '辛']]);
 const rootPlace = ({ source, root, sameStem }) => [source.position, source.pillar, source.stem, root.position, root.pillar, root.stem, sameStem];
 assert.deepEqual(niu.evidence.niuLuck.wealthRoots.map(rootPlace), [['hour', '丙辰', '丙', 'year', '庚寅', '丙', true]]);
 assert.deepEqual(niu.evidence.niuLuck.sealRoots.map(rootPlace), [['year', '庚寅', '庚', 'month', '乙酉', '辛', false]]);
 assert.deepEqual(niu.evidence.niuLuck.peerRoots.map(row => [row.kind, row.stem]), [['运支藏干', '壬']]);
 assert.ok(niu.fact.normalizedPayload.sealLuckRoutes.includes('niu-luck-contrast'));
 assert.ok(!niu.fact.normalizedPayload.sealLuckRoutes.includes('wealth-presses-seal-with-output'));
 assert.equal(niu.fact.normalizedPayload.namedHeavySeal, true);
 assert.equal(niu.fact.normalizedPayload.sourceWealthRole, 'remedy');
 assert.equal(niu.fact.normalizedPayload.hasNiuSourceFoodWealthReducingHeavySeal, true);
 assert.ok(niu.fact.normalizedPayload.robberyAgainstSealWealth.some(path => path.robbery.stem === '壬'
  && path.natalWealthPaths.some(({ wealth, seal }) => wealth.position === 'hour' && wealth.stem === '丙' && seal.stem === '辛')));
 assert.equal(match(niu.run, 46).status, 'not_matched');
 const thickSeal = match(niu.run, 47);
 assert.equal(thickSeal.status, 'matched');
 assert.equal(thickSeal.matchedSourceExcerpt, '喜財損印');
 assert.ok(thickSeal.sourceFactIds.includes(niu.fact.factId));
 assert.ok(!thickSeal.sourceFactIds.includes(next.factId));
 assert.equal(thickSeal.windows.at(-1).endExclusive, crossing.exactInstant);
 assert.match(thickSeal.matchedConditions.join(''), /牛监薄原图.*月透乙食生运干丁财.*月酉本气辛印/u);
 assert.equal(ctx(printed('niu'), '丁亥', false).hasNiuSourceFoodWealthReducingHeavySeal, undefined);
 const wrongHour = { ...printed('niu'), hour: '丁巳' };
 assert.equal(ctx(wrongHour, '丁亥').hasNiuSourceFoodWealthReducingHeavySeal, false);
 assert.equal(ctx(wrongHour, '丁亥').sourceWealthRole, 'undetermined');
 assert.ok(niu.evidence.robberyChecksWealth.some(path => path.moving.stem === '壬' && path.wealth.stem === '丙'));
 assert.equal(match(niu.run, 127).status, 'not_matched');
 const lightSeal = match(niu.run, 130);
 assert.equal(lightSeal.status, 'not_matched');
 assert.deepEqual(lightSeal.windows, []);
 const { input } = modelContext(niu.run);
 assert.match(formatFortuneFactAudit(input), /牛监薄原图按徐注身强印旺/u);
 assert.doesNotMatch(formatFortunePrompt(input), /牛监薄原图按徐注身强印旺/u);
 assert.match(formatFortunePrompt(input), /牛监薄原图.*月透乙食生运干丁财.*月酉本气辛印/u);
 assert.doesNotMatch(formatFortunePrompt(input), /hasNiuSourceFoodWealthReducingHeavySeal/u);
 assert.ok(input.sections.every(section => section.findings.every(row => row.knowledgeId !== lightSeal.knowledgeId)));
});

test('seven source counterparts retain the reviewed clauses and keep the Wang warning separate', async () => {
 const cases = [
  [119, [1866, 10, 13], 0, 1905, '壬寅', '壬癸食伤与寅卯木财'],
  [120, [1946, 10, 24], 8, 1964, '庚子', '食伤运有印回克'],
  [122, [1958, 3, 30], 22, 1974, '丁巳', '对比劫火旺的提醒'],
  [125, [1989, 9, 20], 16, 2026, '己巳', '另有注家按身强喜火土论'],
  [126, [1962, 8, 22], 4, 1998, '壬子', '成员齐全与是否化印为劫分开'],
  [128, [1981, 8, 22], 22, 2016, '壬辰', '对此步波折的提醒'],
  [130, [1950, 9, 25], 8, 1979, '戊子', '戊己官杀不占优'],
 ];
 for (const [index, date, hour, year, pillar, clause] of cases) {
  const run = submitted(date, hour, year);
  const { input, knowledge } = modelContext(run);
  const result = knowledge.byMethod.bazi[index];
  const named = namedSourceIndices.has(index) || index === 119;
  const isWangWarning = index === 128;
  const isNiuContrast = index === 130;
  assert.equal(result.status, isNiuContrast ? 'not_matched' : named ? 'matched' : 'partial', pillar);
  assert.equal(rows(run).some(fact => fact.normalizedPayload.luckPillar === pillar && result.sourceFactIds.includes(fact.factId)),
   !isWangWarning && !isNiuContrast, pillar);
  const facts = input.facts.filter(fact => fact.type === 'zpqz_seal_food_context' && fact.data.printedLuck?.length);
  const warning = isWangWarning ? rows(run).find(fact => fact.normalizedPayload.luckPillar === pillar) : undefined;
  const current = warning ? { start: warning.activeFrom, data: warning.normalizedPayload }
   : facts.find(fact => fact.data.luckPillar === pillar);
  assert.ok(current, pillar);
  const prompt = formatFortuneFactAudit(input);
  if (!isWangWarning) assert.ok(prompt.includes(clause), pillar);
  assert.ok(!prompt.includes('printedLuck') && !prompt.includes('natalPillarSequence'), pillar);
  assert.equal(input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === result.knowledgeId), named);
  if (index === 126) {
   const arrival = rows(run).find(row => row.normalizedPayload.luckPillar === '壬子' && row.activeFrom === '1998-05-28T02:00:00.000Z');
   assert.ok(arrival && result.sourceFactIds.includes(arrival.factId));
   const prior = rows(run).find(row => row.normalizedPayload.luckPillar === '辛亥' && row.activeTo === arrival.activeFrom);
   assert.equal(prior.normalizedPayload.sealLuckEvidence.maZi, false);
   assert.equal(arrival.normalizedPayload.sealLuckEvidence.maZi, true);
  }
  if (isWangWarning) {
   const before = facts.find(fact => fact.data.luckPillar === '癸巳');
   assert.ok(before);
   assert.equal(before.endExclusive, current.start);
   assert.equal(result.windows.at(-1).endExclusive, current.start);
   assert.ok(current.data.sealLuckRoutes.includes('wang-luck-contrast'));
   assert.ok(!current.data.sealLuckRoutes.includes('wang-wealth-relief'));
   const caution = fortuneKnowledge.bazi.rules[index].review.printedLuck
    .find(row => row.natalPillarSequence === '辛酉丙申壬申辛亥').periods.find(row => row.pillars.includes('壬辰'));
   assert.ok(caution.assessment.includes(clause));
   assert.ok(prompt.includes('另一录文此处写作丙水'));
   assert.equal(before.data.sealLuckEvidence.wangSiWealth.stem, '丙');
   assert.equal(current.data.sealLuckEvidence.wangChenRoot, '癸');
   assert.equal(current.data.sealLuckEvidence.wangNamedLightWealth, true);
   const { pairs, southeastLuck } = before.data.sealLuckEvidence.wangBingXin;
   assert.deepEqual(pairs.map(({ first, second, distance, between }) =>
    [first.position, first.stem, second.position, second.stem, distance, between.map(row => row.stem)]),
   [['year', '辛', 'month', '丙', 1, []], ['month', '丙', 'hour', '辛', 2, ['壬']]]);
   assert.deepEqual(southeastLuck.map(row => [row.kind, row.stem]), [['运支藏干', '丙']]);
   assert.deepEqual(current.data.sealLuckEvidence.wangBingXin.southeastLuck, []);
   assert.match(prompt, /汪例原局.*为五合.*中隔日柱壬申/u);
   assert.match(prompt, /汪例所述东南运程，本运实际木火位置为/u);
   assert.ok(before.data.sealLuckEvidence.outputWealthSealPaths.length > 0);
   assert.ok(current.data.sealLuckEvidence.wealthFeedsLuckOfficer.some(row =>
    row.wealth.stem === '丙' && row.moving.stem === '戊' && row.seal.stem === '庚'));
   assert.equal(knowledge.byMethod.bazi[127].status, 'not_matched');
   assert.equal(knowledge.byMethod.bazi[130].status, 'not_matched');
   assert.ok(prompt.includes('汪侍郎原图按财轻印重论'));
   const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId);
   let checked = false;
   const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_url, options) => {
    const content = JSON.parse(options.body).messages[1].content;
    assert.ok(content.includes(finding.note));
    assert.ok(content.includes('財輕印多，用財損印，則喜財鄉'));
    checked = true;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
   } });
   await provider.interpret(input);
   assert.ok(checked);
  }
  if (index === 130) {
   const niu = current.data.sealLuckEvidence.niuLuck;
   assert.deepEqual(niu.foodWealth.map(link => [link.from.stem, link.to.stem]), [['乙', '丙']]);
   assert.deepEqual(niu.peerRoots.map(row => row.stem), ['癸']);
   assert.ok(niu.yiGeng);
   assert.ok(prompt.includes('牛例食神引财的位置') && !prompt.includes('sealLuckEvidence'));
   assert.match(prompt, /牛例.*同干藏根/u);
   assert.match(prompt, /牛例.*同五行异干藏根/u);
  }
  if (index === 120) {
   assert.equal(knowledge.byMethod.bazi[121].status, 'not_matched');
   assert.deepEqual(current.data.sealLuckEvidence.zhuChecksMovingOutput.map(row => [row.seal.stem, row.moving.stem, row.officer.stem]),
    [['戊', '癸', '丙']]);
  }
  if (index === 119) {
   const { zhangDayRoot, zhangOutput, zhangWarmth } = current.data.sealLuckEvidence;
   assert.deepEqual([zhangDayRoot.position, zhangDayRoot.stem, zhangOutput.position, zhangOutput.stem], ['day', '辛', 'hour', '癸']);
   assert.deepEqual(zhangWarmth.month, { position: 'month', pillar: '戊戌', branch: '戌' });
   assert.deepEqual([zhangWarmth.natalFire.position, zhangWarmth.natalFire.stem], ['year', '丙']);
   assert.deepEqual(zhangWarmth.movingFire, []);
   const zhang = printed('zhang');
   assert.deepEqual(ctx(zhang, '丙午').sealLuckEvidence.zhangWarmth.movingFire.map(row => [row.kind, row.stem]),
    [['运干', '丙'], ['运支藏干', '丁']]);
   assert.equal(ctx({ ...zhang, hour: '庚子' }).sealLuckEvidence.zhangWarmth, undefined);
   assert.ok(prompt.includes('张例日酉藏辛生时子藏癸'));
   assert.match(prompt, /张例原局已有年柱丙寅透干丙.*月柱为戊戌/u);
  }
 }
});

test('p005 uses Wang’s two named branch wealth steps and stops before Ren-Chen', () => {
 for (const [year, left, right, after] of [[2006, '甲午', '癸巳', true], [2016, '癸巳', '壬辰', false]]) {
  const boundary = `${year}-08-16T20:00:00.000Z`;
  const run = submitted([1981, 8, 22], 22, year);
  const before = rows(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === left);
  const next = rows(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === right);
  assert.ok(before && next);
  assert.equal(before.normalizedPayload.hasWangSourceWealthReducingHeavySeal, true);
  assert.equal(next.normalizedPayload.hasWangSourceWealthReducingHeavySeal, after);
  const { moving, seal, originalWealth } = before.normalizedPayload.sealLuckEvidence.wangSourceWealthReduction;
  assert.deepEqual([moving.stem, moving.kind, seal.position, seal.stem, originalWealth.stem],
   [left === '甲午' ? '丁' : '丙', '运支藏干', 'month', '庚', '丙']);
  const hit = match(run, 47);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '喜財損印');
  assert.ok(hit.sourceFactIds.includes(before.factId));
  assert.equal(hit.sourceFactIds.includes(next.factId), after);
  if (!after) assert.equal(hit.windows.at(-1).endExclusive, boundary);
  assert.match(formatFortunePrompt(modelContext(run).input), /徐注明列汪图身强印旺用财/u);
 }
 const wang = printed('wang');
 assert.equal(ctx({...wang, hour: '庚戌'}, '癸巳').hasWangSourceWealthReducingHeavySeal, false);
 assert.equal(ctx(wang, '癸巳', false).hasWangSourceWealthReducingHeavySeal, undefined);
});

test('p005 checks Wang’s early wood and fire and later eastern wood while Ren-Chen stays out', () => {
 const date = [1981, 8, 22], hour = 22;
 for (const [year, prior, current, priorMatch] of [[1996, '乙未', '甲午', true], [2026, '壬辰', '辛卯', false], [2036, '辛卯', '庚寅', true]]) {
  const run = submitted(date, hour, year);
  const cut = `${year}-08-16T20:00:00.000Z`;
  const before = rows(run).find(row => row.activeTo === cut && row.normalizedPayload.luckPillar === prior);
  const after = rows(run).find(row => row.activeFrom === cut && row.normalizedPayload.luckPillar === current);
  assert.ok(before && after);
  const hit = match(run, 47);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '喜財損印');
  assert.equal(hit.sourceFactIds.includes(before.factId), priorMatch);
  assert.ok(hit.sourceFactIds.includes(after.factId));
  assert.notEqual(match(run, 46).status, 'matched');
  for (const [fact, expected] of [[before, priorMatch], [after, true]]) {
   const { luckPillar, hasWangSourceYiWeiWoodFire, hasWangSourceWoodFeedingWealth, sealLuckEvidence } = fact.normalizedPayload;
   assert.equal(hasWangSourceYiWeiWoodFire, luckPillar === '乙未');
   assert.equal(hasWangSourceWoodFeedingWealth, ['辛卯', '庚寅'].includes(luckPillar));
   if (hasWangSourceYiWeiWoodFire) {
    const { output, wealth, seal, branchMainQi } = sealLuckEvidence.wangYiWeiRelief;
    assert.deepEqual([output.stem, output.kind, wealth.stem, wealth.kind, seal.position, seal.stem, branchMainQi.stem],
     ['乙', '运干', '丁', '运支藏干', 'month', '庚', '己']);
   }
   if (hasWangSourceWoodFeedingWealth) {
    const { output, wealth, seal } = sealLuckEvidence.wangWoodRelief;
    assert.deepEqual([output.stem, output.kind, wealth.position, wealth.stem, seal.position, seal.stem],
     [luckPillar === '辛卯' ? '乙' : '甲', '运支藏干', 'month', '丙', 'month', '庚']);
   }
   const isolated = { ...run, facts: [fact] }, branch = match(isolated, 47);
   assert.equal(branch.status === 'matched', expected);
   if (expected) assert.deepEqual(branch.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
   const { input } = modelContext(isolated), provider = formatFortunePrompt(input);
   const yiWeiAudit = /汪例本步.*生未中余藏/u;
   assert.equal(yiWeiAudit.test(formatFortuneFactAudit(input)), hasWangSourceYiWeiWoodFire);
   assert.doesNotMatch(provider, yiWeiAudit);
   assert.equal(provider.includes('喜財損印'), expected);
   assert.equal(/未中余丁/u.test(provider), hasWangSourceYiWeiWoodFire);
   assert.equal(/运支本气.*生原月丙财/u.test(provider), hasWangSourceWoodFeedingWealth);
   assert.doesNotMatch(provider, /hasWangSourceYiWeiWoodFire|hasWangSourceWoodFeedingWealth|wangYiWeiRelief/u);
  }
 }
 const wang = printed('wang');
 assert.equal(ctx({ ...wang, hour: '庚戌' }, '乙未').hasWangSourceYiWeiWoodFire, false);
 assert.equal(ctx(wang, '辛卯', false).hasWangSourceWoodFeedingWealth, undefined);
});

test('Wang and Niu seal details require all four published pillars', () => {
 const wang = printed('wang'), niu = printed('niu');
 const yiWei = ctx(wang, '乙未');
 assert.deepEqual(yiWei.sealLuckEvidence.wangBingXin.southeastLuck.map(row => [row.kind, row.stem]),
  [['运干', '乙'], ['运支藏干', '丁'], ['运支藏干', '乙']]);
 assert.ok(yiWei.sealLuckRoutes.includes('wang-luck-contrast'));
 assert.deepEqual(ctx(wang, '甲午').sealLuckEvidence.wangBingXin.southeastLuck.map(row => [row.kind, row.stem]),
  [['运干', '甲'], ['运支藏干', '丁']]);
 const outsideSoutheast = ctx(wang, '辛卯').sealLuckEvidence;
 assert.equal(outsideSoutheast.wangWoodLuck.stem, '乙');
 assert.deepEqual(outsideSoutheast.wangBingXin.southeastLuck, []);
 for (const [natal, hour, luck, field, route] of [
  [wang, '庚戌', '壬辰', 'wangBingXin', 'wang-luck-contrast'],
  [niu, '乙卯', '丁亥', 'niuLuck', 'niu-luck-contrast'],
 ]) {
  for (const near of [ctx({ ...natal, hour }, luck), ctx(natal, luck, false)]) {
   assert.equal(near.sealLuckEvidence[field], undefined);
   assert.ok(!near.sealLuckRoutes.includes(route));
  }
 }
});

test('changing only Li’s hour preserves the basic structure and Ding-Si luck without the original annotation', () => {
 const run = submitted([1958, 3, 30], 2, 1974);
 assert.ok(rows(run).some(fact => fact.normalizedPayload.liSkeleton && fact.normalizedPayload.confirmed
  && fact.normalizedPayload.luckPillar === '丁巳'));
 assert.equal(match(run, 122).status, 'not_matched');
 assert.ok(!formatFortuneFactAudit(modelContext(run).input).includes('对比劫火旺的提醒'));
});
