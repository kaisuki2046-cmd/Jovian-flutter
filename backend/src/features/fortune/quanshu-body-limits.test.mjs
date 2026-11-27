import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { astro } from 'iztro';
import { Lunar } from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
import { createFortuneDeepSeek } from './server/deepseek-expression.mjs';
const { quanshuBodyLifePositions, readQuanshuBodyNatal, quanshuBodyLimitCondition, quanshuBodyLimitPolicy } = await import('./control/ziwei-body-limits.ts');
const { jielanFlowShaBranches, quanshuBodyLimitEncounters, quanshuBodyLimitEncounterPolicy } = await import('./control/ziwei-body-limit-encounters.ts');
const { quanshuLimitBranches } = await import('./control/ziwei-limit-branches.ts');
const { quanshuLimitTiming } = await import('./control/ziwei-limit-timing.ts');
const { quanshuTimedBody } = await import('./control/ziwei-timed-limit-conditions.ts');
const { quanshuTransformations, quanshuBrightness, quanshuLunarMidnight } = await import('./control/ziwei-quanshu.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/quanshu-body-reference.json',import.meta.url)));
const config={yearDivide:'normal',horoscopeDivide:'normal',ageDivide:'normal',dayDivide:'current'};
const branches=[...'子丑寅卯辰巳午未申酉戌亥'],all=p=>[...p.majorStars,...p.minorStars,...p.adjectiveStars];
const native=(e={})=>astro.withOptions({dateStr:'1990-05-05',timeIndex:2,gender:'女',...e,fixLeap:true,config}).toJSON();
const chart=n=>({timeKnown:true,bazi:{rawResult:[]},western:{rawResult:[]},ziwei:{engineName:'iztro',engineVersion:'2.6.5',rulesetVersion:'standard-new-year-leap-split-late-zi-current-v1',rawResult:[n]}});
function calculate(snapshot,year=2026){const input={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year}};
  return calculateFortuneFacts(input,buildFactTimeContext(input,Date.parse(`${year}-11-19T00:00:00Z`),'server'),'body-limits-run',{snapshotId:'body-limits-snapshot',chart:snapshot});}
const cache=new Map(),real=e=>{const key=[e.dateStr,e.timeIndex,e.gender,e.year].join(':');if(!cache.has(key))cache.set(key,calculate(chart(native(e)),e.year));return cache.get(key);};
const facts=run=>run.facts.filter(f=>f.factType==='quanshu_body_limit_context');
const encounterType = 'quanshu_body_limit_encounters';
const timedType = 'quanshu_timed_limit_condition';
const timedEncounter = f => f.factType === timedType && f.normalizedPayload.sourceFactType === encounterType;
const encounterSamples = ref.encounterExamples;
const rule=n=>fortuneKnowledge.ziwei.rules.find(r=>r.knowledgeId.includes('expansion-p'+String(n).padStart(3,'0')+'-'));
const matched=(run,n)=>matchFortuneKnowledge(run).byMethod.ziwei.find(r=>r.knowledgeId===rule(n).knowledgeId);
const relation=(from,to)=>({0:'守',4:'三合',6:'冲',8:'三合',1:'邻宫',11:'邻宫'}[(branches.indexOf(to)-branches.indexOf(from)+12)%12]??'其他');
const remove=(n,name)=>{for(const p of n.palaces)for(const key of ['majorStars','minorStars','adjectiveStars'])p[key]=p[key].filter(s=>s.name!==name);};
function encounter(sample, run = real(sample)) {
  const rows = run.facts.filter(f => (f.factType !== encounterType && !timedEncounter(f)) || f.normalizedPayload.lunarYear === sample.year);
  const fact = rows.find(f => f.factType === encounterType);
  assert.ok(fact);
  return { run: { ...run, facts: rows }, fact, data: fact.normalizedPayload };
}
function activeEncounterIds(run, star) {
  return run.facts.filter(f => timedEncounter(f) && f.normalizedPayload.star === star
    && f.normalizedPayload.activeInSourceHalf === true).map(f => f.factId);
}
function submittedEncounter(name, sample = encounterSamples[name]) {
  const year = sample.year;
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const now = Date.UTC(year, 5, 1), archive = { snapshotId: name, chart: chart(native(sample)) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), name, archive);
  validateFortuneFacts(run);
  return encounter(sample, run);
}
function natalFrame(sample) {
  const archive = astro.withOptions({ ...sample, fixLeap: true, config });
  const h = archive.horoscope(sample.year + '-06-01', 6);
  return { natal: archive.toJSON(), frame: { lunarYear: sample.year, yearIndex: h.yearly.index,
    decadalIndex: h.decadal.index, minorIndex: h.age.index } };
}

test('p009 distinguishes the Jielan annual directional Sha at the verified active small limit from flowing blades', () => {
  for (const [years, branches] of [['寅午戌', '亥子丑'], ['亥卯未', '申酉戌'], ['申子辰', '巳午未'], ['巳酉丑', '寅卯辰']]) {
    for (const year of years) assert.deepEqual(jielanFlowShaBranches(year), [...branches]);
  }
  const base = { dateStr: '1947-02-05', timeIndex: 0, gender: '男', year: 1964 };
  const { run, data } = encounter(base);
  assert.deepEqual([data.qisha.branch, data.qisha.minor, data.qisha.decadal, data.jielanShaBranches], ['午', '守', '其他', ['巳', '午', '未']]);
  assert.deepEqual([data.qishaPlainLimitCandidate, data.qishaFlowShaCandidate, data.qishaJielanMinorFlowShaCandidate], [true, false, true]);
  const active = run.facts.filter(fact => timedEncounter(fact) && fact.normalizedPayload.star === '七杀');
  const exact = active.find(fact => fact.normalizedPayload.qishaJielanMinorFlowShaCandidate === true);
  assert.ok(exact);
  assert.equal(exact.activeFrom, '1964-08-07T16:00:00.000Z');
  assert.deepEqual(exact.normalizedPayload.guardScopes, ['minor']);
  assert.deepEqual(exact.normalizedPayload.jielanShaBranches, ['巳', '午', '未']);
  assert.equal(exact.normalizedPayload.qishaPlainLimitCandidate, false);
  assert.ok(active.filter(fact => fact.activeTo <= exact.activeFrom).every(fact => fact.normalizedPayload.qishaJielanMinorFlowShaCandidate === false));
  const strict = { ...run, facts: active };
  const hit = matched(strict, 9);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '遭流殺而逢凶');
  assert.deepEqual(hit.windows, [{ start: exact.activeFrom, endExclusive: exact.activeTo }]);
  assert.deepEqual(hit.sourceFactIds, [exact.factId]);
  const { input } = buildFortuneModelContext(strict, interpretFortune(strict, requestForFortuneRun(strict), 'jielan-minor-flow-sha'));
  assert.match(formatFortuneFactAudit(input), /按《捷览》的当年流杀方组，实守七杀的午宫小限也在本年组内，该组为巳、午、未/u);
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /遭流殺而逢凶/u);
  assert.doesNotMatch(prompt, /该组为巳、午、未|qishaJielanMinorFlowShaCandidate|遇帝祿而可解/u);
  assert.equal(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === hit.knowledgeId).originalText, hit.matchedSourceExcerpt);
  assert.equal(matched({ ...run, facts: [{ ...exact, normalizedPayload: { ...exact.normalizedPayload,
    jielanFlowShaProfile: 'unverified' } }] }, 9).status, 'not_matched');

  const other = encounter({ ...base, gender: '女', year: 1966 });
  assert.deepEqual([other.data.qisha.branch, other.data.qisha.minor, other.data.jielanShaBranches], ['午', '守', ['亥', '子', '丑']]);
  assert.equal(other.data.qishaFlowShaCandidate, true);
  assert.equal(other.data.qishaJielanMinorFlowShaCandidate, false);
  const { natal, frame } = natalFrame(base);
  const incomplete = quanshuLimitBranches(natal, { ...frame, minorIndex: undefined });
  assert.equal(quanshuBodyLimitEncounters(natal, frame.yearIndex, incomplete).qishaJielanMinorFlowShaCandidate, undefined);
});

test('p008 binds the Jielan minor directional Sha to actual body and life contacts in the same year', () => {
  const sample = { dateStr: '1947-10-15', timeIndex: 8, gender: '男', year: 1976 };
  const { run, fact, data } = submittedEncounter('jielan-shen-ming-sha', sample);
  assert.equal(data.qishaBodyLifeAspectCandidate, true);
  assert.equal(data.qishaJielanMinorFlowShaCandidate, true);
  assert.deepEqual(data.jielanShaBranches, ['巳', '午', '未']);
  assert.equal(data.qishaBodyLifeJielanMinorShaCandidate, true);
  assert.equal(data.qishaBodyLifeJielanBellCandidate, true);
  const bell = { star: '铃星', branch: '午', bodyRelation: '守', lifeRelation: '三合' };
  assert.deepEqual(data.qishaBodyLifeJielanMinorShaWitness, {
    minorBranch: '午', bodyBranch: '午', lifeBranch: '寅', bodyGuards: [bell], lifeTrines: [bell],
  });
  const isolated = structuredClone(fact);
  for (const key of ['qishaSeparateBodyLifeCandidate', 'qishaSharedBodyLifeCandidate', 'qishaBodyLifeAspectCandidate']) {
    isolated.normalizedPayload[key] = false;
  }
  const strict = { ...run, facts: [isolated] };
  const hit = matched(strict, 8);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '大小二限合身命逢殺，雖帝制也無功');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(strict, interpretFortune(strict, requestForFortuneRun(strict), 'jielan-shen-ming-sha'));
  const audit = formatFortuneFactAudit(input);
  assert.match(audit, /按《捷览》核当年流煞与复算小限同在七杀的午宫。铃星实守身宫午。铃星三合命宫寅/u);
  assert.match(formatFortunePrompt(input), /大小二限合身命逢殺，雖帝制也無功/u);
  assert.doesNotMatch(formatFortunePrompt(input), /铃星实守身宫午|qishaBodyLifeJielanBellCandidate|qishaBodyLifeJielanMinorShaWitness/u);

  const timed = run.facts.filter(row => timedEncounter(row) && row.normalizedPayload.star === '七杀');
  const flowSha = timed.find(row => row.normalizedPayload.qishaJielanMinorFlowShaCandidate === true);
  assert.ok(flowSha);
  const sameYearHit = matched({ ...run, facts: timed }, 9);
  assert.equal(sameYearHit.status, 'matched');
  assert.equal(sameYearHit.matchedSourceExcerpt, '遭流殺而逢凶');
  assert.deepEqual(sameYearHit.windows, [{ start: flowSha.activeFrom, endExclusive: flowSha.activeTo }]);
  assert.ok(sameYearHit.windows[0].start > fact.activeFrom);
  const early = timed.find(row => row.activeTo === flowSha.activeFrom);
  assert.ok(early);
  assert.notEqual(matched({ ...run, facts: [early] }, 9).status, 'matched');
  isolated.normalizedPayload.qishaBodyLifeJielanBellCandidate = undefined;
  assert.equal(matched(strict, 8).status, 'partial');
  isolated.normalizedPayload.jielanFlowShaProfile = 'unverified';
  assert.equal(matched(strict, 8).status, 'not_matched');

  for (const year of [1975, 1977]) assert.equal(encounter({ ...sample, year }).data.qishaBodyLifeJielanMinorShaCandidate, false);
  const near = encounter({ dateStr: '1947-07-15', timeIndex: 3, gender: '女', year: 1957 }).data;
  assert.equal(near.qishaJielanMinorFlowShaCandidate, true);
  assert.equal(near.qishaSeparateBodyLifeCandidate, true);
  assert.equal(near.qishaBodyLifeJielanMinorShaCandidate, false);
  const { natal, frame } = natalFrame(sample);
  const incomplete = quanshuLimitBranches(natal, { ...frame, minorIndex: undefined });
  assert.equal(quanshuBodyLimitEncounters(natal, frame.yearIndex, incomplete).qishaBodyLifeJielanMinorShaCandidate, undefined);
  assert.equal(quanshuBodyLimitEncounters(natal, frame.yearIndex, incomplete).qishaBodyLifeJielanBellCandidate, undefined);
});

test('p008 independently verifies Jielan Fire and the source birthday within the actual life and body limits', () => {
  const sample = { dateStr: '1980-03-05', timeIndex: 4, gender: '男', year: 2012 };
  const { run, fact, data } = submittedEncounter('jielan-fire-shen-ming', sample);
  const field = 'qishaBodyLifeJielanFireCandidate';
  assert.deepEqual([data[field], data.qishaBodyLifeJielanBellCandidate, data.qishaBodyLifeJielanMinorShaCandidate],
    [true, false, true]);
  assert.equal(data.qishaBirthAnchorProof, 'quanshu-natal-ziwei-bureau-lunar-day-v1');
  assert.deepEqual(data.jielanShaBranches, ['巳', '午', '未']);
  assert.deepEqual(data.qishaBodyLifeAspectWitnesses, [{
    decadal: { target: '身宫', targetBranch: '午', branch: '子', relation: '冲' },
    minor: { target: '命宫', targetBranch: '戌', branch: '午', relation: '三合' }, candidate: true,
  }]);
  const fire = { star: '火星', branch: '午', bodyRelation: '守', lifeRelation: '三合' };
  assert.deepEqual(data.qishaBodyLifeJielanMinorShaWitness.bodyGuards, [fire]);
  assert.ok(data.qishaBodyLifeJielanMinorShaWitness.lifeTrines.some(row => row.star === '火星'));
  const scoped = { ...run, facts: [fact] }, hit = matched(scoped, 8);
  assert.equal(hit.status, 'matched');
  assert.match(hit.matchedSourceExcerpt, /大小二限合身命逢殺|遇火铃则为杀长威/u);
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: '2012-01-22T16:00:00.000Z', endExclusive: fact.activeTo }]);
  const timed = run.facts.filter(row => timedEncounter(row) && row.normalizedPayload.star === '七杀');
  const separate = matched({ ...run, facts: timed }, 9);
  assert.equal(separate.status, 'matched');
  assert.ok(separate.windows[0].start > fact.activeFrom);

  const { natal, frame } = natalFrame(sample);
  const archiveMajor = structuredClone(natal);
  const seat = archiveMajor.palaces.find(row => row.earthlyBranch === '午');
  const [qisha] = seat.majorStars.splice(seat.majorStars.findIndex(row => row.name === '七杀'), 1);
  seat.adjectiveStars.push(qisha);
  const borrowed = native({ ...sample, dateStr: '1980-03-06' });
  borrowed.palaces = structuredClone(natal.palaces);
  for (const [chart, anchors] of [
    [archiveMajor, frame],
    [borrowed, frame],
    [natal, { ...frame, minorIndex: (frame.minorIndex + 1) % 12 }],
  ]) {
    const altered = quanshuBodyLimitEncounters(chart, anchors.yearIndex, quanshuLimitBranches(chart, anchors));
    assert.equal(altered[field], undefined);
    assert.notEqual(matched({ ...scoped, facts: [{ ...fact, normalizedPayload: altered }] }, 8).status, 'matched');
  }
  const later = encounter({ ...sample, year: 2013 }).data;
  assert.equal(later[field], false);
  const input = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'jielan-fire')).input;
  assert.match(formatFortuneFactAudit(input), /火星实守身宫午/u);
  assert.doesNotMatch(formatFortunePrompt(input), /火星实守身宫午|qishaBirthAnchorProof|qishaBodyLifeJielanFireCandidate/u);
});

test('the source’s three explicit examples and all 144 expanded month/hour cells agree with actual independent archive body markers',()=>{
  for(const e of ref.explicitSourceExamples){const p=quanshuBodyLifePositions(e.month,e.hour);assert.equal(p.bodyBranch,e.body);assert.equal(p.lifeBranch,e.life);}
  const houses=new Set();
  for(let month=1;month<=12;month++)for(let hour=0;hour<12;hour++){
    const dateStr=Lunar.fromYmd(2026,month,15).getSolar().toYmd(),n=native({dateStr,timeIndex:hour}),before=structuredClone(n);
    assert.equal(n.rawDates.lunarDate.lunarMonth,month);assert.equal(n.rawDates.lunarDate.isLeap,false);
    const p=readQuanshuBodyNatal(n);assert.equal(p.ready,true);assert.equal(p.bodyBranch,ref.bodyGridByMonth[month-1][hour]);
    assert.equal(p.bodyBranch,n.earthlyBranchOfBodyPalace);assert.equal(p.lifeBranch,n.earthlyBranchOfSoulPalace);
    assert.equal(n.palaces.find(p=>p.isBodyPalace).index,p.bodyIndex);houses.add(p.bodyNatalName);
    assert.equal(p.bodyBranch===p.lifeBranch,[0,6].includes(hour));assert.deepEqual(n,before);
  }
  assert.deepEqual([...houses].sort(),['命宫','夫妻','官禄','福德','财帛','迁移'].sort());
  for(const [month,hour]of[[0,'子'],[13,'子'],[1,'未定']])assert.throws(()=>quanshuBodyLifePositions(month,hour),RangeError);
});

test('missing, duplicate, misplaced or contradictory body metadata and incomplete major positions cannot qualify the source',()=>{
  const mutations=[n=>{n.palaces.forEach(p=>{p.isBodyPalace=false;});},n=>{n.palaces.find(p=>!p.isBodyPalace).isBodyPalace=true;},
    n=>{n.earthlyBranchOfBodyPalace='子';},n=>{n.earthlyBranchOfSoulPalace='子';},n=>{delete n.palaces[0].isBodyPalace;},
    n=>{const p=n.palaces.find(p=>p.isBodyPalace);p.isBodyPalace=false;n.palaces[(p.index+1)%12].isBodyPalace=true;},
    n=>remove(n,'七杀'),n=>{n.palaces[0].majorStars.push(structuredClone(n.palaces.flatMap(all).find(s=>s.name==='七杀')));},
    n=>{n.rawDates.lunarDate.isLeap=true;}];
  for(const mutate of mutations){const n=native();mutate(n);assert.equal(readQuanshuBodyNatal(n).ready,false);}
});

test('every full-year source record binds actual body/life positions and all three layer geometries to one interval with provenance',()=>{
  const e=ref.examples.find(e=>e.n===22),run=real(e);validateFortuneFacts(run);assert.notEqual(run.methods.ziwei.status,'failed');
  const rows=facts(run);assert.ok(rows.length>=6);
  for(const f of rows){const p=f.normalizedPayload;assert.equal(p.ready,true);assert.equal(p.profile,quanshuBodyLimitPolicy.profile);
    assert.equal(p.bodyBranch,e.bodyBranch);assert.equal(p.lifeBranch,e.lifeBranch);assert.equal(p.bodyLifeSame,false);
    assert.ok(f.sourceFactIds.length>=2&&f.sourceFactIds.every(id=>run.rawFacts.some(r=>r.rawFactId===id)));
    const raw=run.rawFacts.find(r=>f.sourceFactIds.includes(r.rawFactId)&&r.payload.policy?.profile===quanshuBodyLimitPolicy.profile);
    assert.ok(raw);const interval=raw.payload.interval;
    assert.equal(f.activeFrom,new Date(interval.start).toISOString());assert.equal(f.activeTo,new Date(interval.end).toISOString());
    for(const [scope,part]of[['yearly',interval.year],['decadal',interval.decadal],['minor',interval.minor]]){
      if(!part)continue;assert.ok(part.start<=interval.start&&interval.end<=part.end);
      const contact=p.layerContacts.find(c=>c.scope===scope);assert.ok(contact);
      const palace=native(e).palaces.find(x=>x.index===part.output.index);assert.equal(contact.branch,palace.earthlyBranch);
      assert.equal(contact.lifeRelation,relation(p.lifeBranch,contact.branch));assert.equal(contact.bodyRelation,relation(p.bodyBranch,contact.branch));
      assert.equal(contact.qishaRelation,relation(contact.branch,p.qishaBranch));
    }
    for(const r of [...p.shaPositions,...p.rescuePositions]){assert.equal(r.lifeRelation,relation(p.lifeBranch,r.branch));assert.equal(r.bodyRelation,relation(p.bodyBranch,r.branch));}
  }
});

test('the six existing archive examples preserve body and life geometry in their own layer',()=>{
  for(const e of ref.examples){const run=real(e);
    const p=facts(run).find(f=>f.scope===e.scope&&f.normalizedPayload.branch===e.focusBranch&&f.normalizedPayload.lunarYear===e.year)?.normalizedPayload;
    assert.ok(p);assert.equal(p.bodyBranch,e.bodyBranch);assert.equal(p.lifeBranch,e.lifeBranch);
    if(e.n===8)assert.equal(p.decadalMinorSamePalace,false);
    if(e.n===22){assert.equal(p.lifeCandidateShaPresent,true);assert.equal(p.bodyCandidateShaPresent,true);}
    if(e.n===47){assert.equal(p.qishaAtLifeOrBody,true);assert.equal(p.qishaBranch,p.bodyBranch);assert.notEqual(p.qishaBranch,p.lifeBranch);assert.notEqual(p.branch,p.lifeBranch);}
  }
});

test('Tanlang needs an actual guard and a verified Tianxing contact with a named stem-based taboo', () => {
  const natalTaboo = encounter(encounterSamples.tanlangNatal);
  const yearTaboo = encounter(encounterSamples.tanlangAnnual);
  for (const [sample, relations, flagStates] of [
    [natalTaboo, ['守', '三合', '其他'], [true, false]],
    [yearTaboo, ['冲', '其他', '冲'], [false, true]],
  ]) {
    const { run, data } = sample;
    assert.equal(data.tanlang.minor, '守');
    assert.deepEqual([data.tanlangXing, ...data.taboos.map(row => row.relation)], relations);
    assert.deepEqual([data.tanlangNatalXingJiCandidate, data.tanlangYearXingJiCandidate], flagStates);
    const result = matched(run, 6);
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.sourceFactIds, activeEncounterIds(run, '贪狼'));
  }
  const near = encounter(encounterSamples.tanlangWithoutXing);
  assert.equal(near.data.tanlang.minor, '守');
  assert.equal(near.data.taboos[0].relation, '守');
  assert.equal(matched(near.run, 6).status, 'not_matched');
  const { natal, frame } = natalFrame(encounterSamples.tanlangNatal);
  remove(natal, '天刑');
  const missing = quanshuBodyLimitEncounters(natal, frame.yearIndex, quanshuLimitBranches(natal, frame));
  assert.equal(missing.tanlangNatalXingJiCandidate, undefined);
  assert.equal(missing.tanlangYearXingJiCandidate, false);
  const { input } = buildFortuneModelContext(yearTaboo.run,
    interpretFortune(yearTaboo.run, requestForFortuneRun(yearTaboo.run), 'tanlang-year-taboo'));
  assert.match(formatFortuneFactAudit(input), /流年干化忌候选落在申宫的廉贞，与贪狼宫为冲/u);
});

test('the Ming fallen Tanlang can meet its natal blade and taboo together only within an actual northern limit half', () => {
  const sample = { dateStr: '1989-06-25', timeIndex: 3, gender: '女', year: 1997 };
  const { run, data } = encounter(sample);
  assert.deepEqual([data.tanlang.branch, data.tanlang.minor, data.tianxingBranch], ['亥', '守', '丑']);
  assert.deepEqual([data.tanlangNatalXingJiCandidate, data.tanlangYearXingJiCandidate], [false, false]);
  const witness = { tanlangBranch: '亥', birthStem: '己', yangBranch: '未', tabooStar: '文曲', relation: '三合' };
  assert.deepEqual(data.tanlangMingNatalYangJiAspectWitness, witness);
  const related = run.facts.filter(row => timedEncounter(row) && row.normalizedPayload.star === '贪狼');
  const active = related.find(row => row.normalizedPayload.activeInSourceHalf === true);
  const inactive = related.find(row => row.normalizedPayload.activeInSourceHalf === false);
  assert.deepEqual(active.normalizedPayload.guardScopes, ['minor']);
  assert.deepEqual(active.normalizedPayload.tanlangMingNatalYangJiAspectWitness, witness);
  assert.equal(inactive.normalizedPayload.tanlangMingNatalYangJiAspectWitness, undefined);
  const hit = matched(run, 6);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [active.factId]);
  assert.deepEqual(hit.windows, [{ start: '1997-02-06T16:00:00.000Z', endExclusive: '1997-08-02T16:00:00.000Z' }]);
  assert.equal(active.activeTo, inactive.activeFrom);
  assert.equal(matched({ ...run, facts: [inactive] }, 6).status, 'not_matched');

  const { natal, frame } = natalFrame(sample);
  const range = { start: Date.parse(active.activeFrom), end: Date.parse(active.activeTo) };
  const missingQu = structuredClone(natal);
  remove(missingQu, '文曲');
  const wrongLayer = structuredClone(natal), yangSeat = wrongLayer.palaces.find(row => row.earthlyBranch === witness.yangBranch);
  const [yang] = yangSeat.minorStars.splice(yangSeat.minorStars.findIndex(row => row.name === '擎羊'), 1);
  assert.equal(yang.name, '擎羊');
  yangSeat.adjectiveStars.push(yang);
  for (const [change, archive, expected] of [
    [{ ...frame, minorIndex: (frame.minorIndex + 1) % 12 }, natal, 'unknown'],
    [frame, missingQu, 'partial'],
    [frame, wrongLayer, 'unknown'],
  ]) {
    const limits = quanshuLimitBranches(archive, change);
    const context = quanshuBodyLimitEncounters(archive, frame.yearIndex, limits);
    assert.equal(context.tanlangMingNatalYangJiAspectCandidate, undefined);
    const [timing] = quanshuLimitTiming(archive, limits, range, { ...change, age: limits.sourceMinor.ordinal });
    const [normalizedPayload] = quanshuTimedBody(timing.data, context);
    const unresolved = { ...active, normalizedPayload };
    assert.equal(matched({ ...run, facts: [unresolved] }, 6).status, expected);
  }
});

test('p006 verifies both native blades and Ji at fallen Tanlang during a genuine northern limit half', () => {
  const sample = { dateStr: '1983-03-15', timeIndex: 0, gender: '女', year: 2003 };
  const { natal, frame } = natalFrame(sample);
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.year } };
  const now = Date.UTC(sample.year, 5, 1), name = 'ming-tanlang-both-blades';
  const archive = { snapshotId: name, chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const submitted = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), name, archive);
  validateFortuneFacts(submitted);
  const { run, data } = encounter(sample, submitted);
  assert.deepEqual([data.tanlang.branch, data.tanlang.minor, data.tanlang.decadal], ['巳', '守', '其他']);
  assert.deepEqual([data.tanlangNatalXingJiCandidate, data.tanlangYearXingJiCandidate, data.tanlangMingNatalYangJiAspectCandidate],
    [false, false, false]);
  const witness = {
    branch: '巳', birthStem: '癸', yangTuo: [{ star: '擎羊', branch: '丑', relation: '三合' }, { star: '陀罗', branch: '亥', relation: '冲' }],
    taboo: { label: '生年干化忌', star: '贪狼', branch: '巳', relation: '守' },
  };
  assert.deepEqual(data.tanlangMingNatalYangTuoJiWitness, witness);
  const related = run.facts.filter(row => timedEncounter(row) && row.normalizedPayload.star === '贪狼');
  const active = related.find(row => row.normalizedPayload.activeInSourceHalf === true);
  const inactive = related.find(row => row.normalizedPayload.activeInSourceHalf === false);
  assert.deepEqual(active.normalizedPayload.guardScopes, ['minor']);
  assert.deepEqual(active.normalizedPayload.tanlangMingNatalYangTuoJiWitness, witness);
  assert.equal(inactive.normalizedPayload.tanlangMingNatalYangTuoJiWitness, undefined);
  const isolated = facts => ({ ...run, facts });
  const hit = matched(isolated([active]), 6);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [active.factId]);
  assert.deepEqual(hit.windows, [{ start: '2003-01-31T16:00:00.000Z', endExclusive: '2003-07-28T16:00:00.000Z' }]);
  assert.equal(matched(isolated([inactive]), 6).status, 'not_matched');
  const scope = isolated([active]);
  const { input } = buildFortuneModelContext(scope, interpretFortune(scope, requestForFortuneRun(scope), name));
  assert.match(formatFortuneFactAudit(input), /陷地贪狼同时见生年羊陀和化忌/u);
  assert.doesNotMatch(formatFortunePrompt(input), /陷地贪狼同时见生年羊陀和化忌|tanlangMingNatalYangTuoJi/u);

  const read = (natal, frame, year) => {
    const limits = quanshuLimitBranches(natal, frame);
    const context = quanshuBodyLimitEncounters(natal, frame.yearIndex, limits);
    const bounds = { start: quanshuLunarMidnight(year, 1), end: quanshuLunarMidnight(year + 1, 1) };
    const [timing] = quanshuLimitTiming(natal, limits, bounds, { ...frame, age: limits.sourceMinor.ordinal });
    return quanshuTimedBody(timing.data, context)[0];
  };
  const offLayer = structuredClone(natal), hai = offLayer.palaces.find(row => row.earthlyBranch === '亥');
  const [tuoluo] = hai.minorStars.splice(hai.minorStars.findIndex(row => row.name === '陀罗'), 1);
  hai.adjectiveStars.push(tuoluo);
  const missing = read(offLayer, frame, sample.year);
  assert.equal(missing.activeInSourceHalf, true);
  assert.equal(missing.tanlangMingNatalYangTuoJiCandidate, undefined);
  assert.equal(matched(isolated([{ ...active, normalizedPayload: missing }]), 6).status, 'unknown');
  const duplicate = structuredClone(natal);
  duplicate.palaces.find(row => row.earthlyBranch === '巳').minorStars.push(tuoluo);
  assert.equal(quanshuLimitBranches(duplicate, frame).ready, false);
  const near = natalFrame({ ...sample, year: 2002 });
  const noGuard = read(near.natal, near.frame, 2002);
  assert.equal(noGuard.activeInSourceHalf, false);
  assert.equal(noGuard.tanlangMingNatalYangTuoJiCandidate, false);
  assert.equal(matched(isolated([{ ...active, normalizedPayload: noGuard }]), 6).status, 'not_matched');
});

test('p006 keeps Ming Yang Xing and Tuo Ji at a single genuine northern limit without requiring stem Ji', () => {
  const sample = { dateStr: '1990-05-05', timeIndex: 0, gender: '女', year: 2027 };
  const { run, data } = encounter(sample);
  assert.deepEqual([data.tanlang.branch, data.tanlang.minor], ['卯', '守']);
  assert.ok(data.taboos.every(row => row.relation === '其他'));
  assert.equal(data.tanlangNatalXingJiCandidate, false);
  assert.equal(data.tanlangYearXingJiCandidate, false);
  assert.equal(data.tanlangMingNatalYangTuoJiCandidate, false);
  assert.equal(data.tanlangMingXingJiAliasesCandidate, true);
  const witness = { branch: '卯', yangTuo: [
    { star: '擎羊', branch: '酉', relation: '冲' }, { star: '陀罗', branch: '未', relation: '三合' },
  ] };
  assert.deepEqual(data.tanlangMingXingJiAliasesWitness, witness);
  const timed = run.facts.filter(row => timedEncounter(row) && row.normalizedPayload.star === '贪狼');
  const positive = timed.find(row => row.normalizedPayload.activeInSourceHalf === true);
  const negative = timed.find(row => row.normalizedPayload.activeInSourceHalf === false);
  assert.deepEqual(positive.normalizedPayload.guardScopes, ['minor']);
  assert.deepEqual(positive.normalizedPayload.tanlangMingXingJiAliasesWitness, witness);
  assert.equal(negative.normalizedPayload.tanlangMingXingJiAliasesWitness, undefined);
  const scoped = (facts = [positive]) => ({ ...run, facts });
  const hit = matched(scoped(), 6);
  assert.equal(hit.status, 'partial');
  assert.deepEqual(hit.sourceFactIds, [positive.factId]);
  assert.deepEqual(hit.windows, [{ start: positive.activeFrom, endExclusive: negative.activeFrom }]);
  assert.equal(matched(scoped([negative]), 6).status, 'not_matched');
  const scope = scoped();
  const { input } = buildFortuneModelContext(scope, interpretFortune(scope, requestForFortuneRun(scope), 'ming-yang-xing-tuo-ji'));
  const audit = '按明刊羊化刑、陀化忌，擎羊酉宫正冲、陀罗未宫三合贪狼所守卯宫';
  assert.ok(formatFortuneFactAudit(input).includes(audit));
  assert.ok(!formatFortunePrompt(input).includes(audit));
  assert.ok(input.sections.flatMap(section => section.findings).every(row => row.knowledgeId !== hit.knowledgeId));

  const { frame, natal } = natalFrame(sample);
  const missingTuo = structuredClone(natal), tuoSeat = missingTuo.palaces.find(row => row.earthlyBranch === '未');
  const [tuo] = tuoSeat.minorStars.splice(tuoSeat.minorStars.findIndex(row => row.name === '陀罗'), 1);
  tuoSeat.adjectiveStars.push(tuo);
  const duplicateYang = structuredClone(natal), yangSeat = duplicateYang.palaces.find(row => row.earthlyBranch === '酉');
  duplicateYang.palaces.find(row => row.earthlyBranch === '申').adjectiveStars.push(yangSeat.minorStars.find(row => row.name === '擎羊'));
  assert.equal(quanshuLimitBranches(duplicateYang, frame).ready, false);
  const limits = quanshuLimitBranches(missingTuo, frame);
  const wrongLayer = quanshuBodyLimitEncounters(missingTuo, frame.yearIndex, limits);
  assert.equal(wrongLayer.tanlangMingXingJiAliasesCandidate, undefined);
  const [timing] = quanshuLimitTiming(missingTuo, limits, { start: Date.parse(positive.activeFrom), end: Date.parse(positive.activeTo) },
    { ...frame, age: limits.sourceMinor.ordinal });
  const [normalizedPayload] = quanshuTimedBody(timing.data, wrongLayer);
  assert.equal(matched(scoped([{ ...positive, normalizedPayload }]), 6).status, 'unknown');
});

test('p006 confirms both Ming Xing Ji readings only in the shared active Tanlang window', () => {
  const sample = { dateStr: '1983-02-13', timeIndex: 0, gender: '女', year: 2015 };
  const { run } = submittedEncounter('ming-tanlang-confirmed-double-limits', sample);
  const timed = run.facts.filter(f => timedEncounter(f) && f.normalizedPayload.star === '贪狼');
  const positive = timed.find(f => f.normalizedPayload.tanlangMingDoubleGuardXingJiCandidate === true);
  assert.ok(positive);
  const later = timed.find(f => f.activeFrom === positive.activeTo);
  assert.ok(later);
  assert.equal(later.normalizedPayload.tanlangMingDoubleGuardXingJiCandidate, false);
  const p = positive.normalizedPayload;
  assert.deepEqual(p.guardScopes, ['decadal', 'minor']);
  assert.deepEqual(p.tanlangMingDoubleGuardXingJiWitness, {
    branch: '巳', birthStem: '癸',
    yangTuo: [{ star: '擎羊', branch: '丑', relation: '三合' }, { star: '陀罗', branch: '亥', relation: '冲' }],
    taboo: { label: '生年干化忌', star: '贪狼', branch: '巳', relation: '守' },
    tianxing: { star: '天刑', branch: '酉', relation: '三合' },
  });
  const isolated = facts => ({ ...run, facts });
  const hit = matched(isolated([positive]), 6);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '二限為禍非輕');
  assert.deepEqual(hit.sourceFactIds, [positive.factId]);
  assert.deepEqual(hit.windows, [{ start: '2015-02-18T16:00:00.000Z', endExclusive: '2015-08-13T16:00:00.000Z' }]);
  assert.equal(matched(isolated([later]), 6).status, 'partial');
  const yearHit = matched(run, 6);
  assert.deepEqual(yearHit.windows, hit.windows);
  assert.deepEqual(yearHit.sourceFactIds, [positive.factId]);
  assert.ok(yearHit.candidateFactIds.includes(later.factId));
  assert.ok(yearHit.candidateWindows.some(window => window.start === later.activeFrom && window.endExclusive === later.activeTo));
  const isolatedRun = isolated([positive]);
  const { input } = buildFortuneModelContext(isolatedRun,
    interpretFortune(isolatedRun, requestForFortuneRun(isolatedRun), 'ming-tanlang-confirmed-double-limits'));
  assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === hit.knowledgeId));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /同一贪狼宫的守、冲或三合范围同时见核实的本命天刑、擎羊、陀罗和生年化忌受曜/u);
  assert.doesNotMatch(prompt, /tanlangMingDoubleGuardXingJi|天刑酉宫/u);

  const { natal, frame } = natalFrame(sample);
  const wrong = structuredClone(natal), seat = wrong.palaces.find(palace => palace.earthlyBranch === '酉');
  const [xing] = seat.adjectiveStars.splice(seat.adjectiveStars.findIndex(star => star.name === '天刑'), 1);
  seat.minorStars.push(xing);
  const limits = quanshuLimitBranches(wrong, frame);
  const source = quanshuBodyLimitEncounters(wrong, frame.yearIndex, limits);
  const [time] = quanshuLimitTiming(wrong, limits, { start: Date.parse(positive.activeFrom), end: Date.parse(positive.activeTo) },
    { ...frame, age: limits.sourceMinor.ordinal });
  const [normalizedPayload] = quanshuTimedBody(time.data, source);
  assert.equal(normalizedPayload.tanlangMingDoubleGuardXingJiCandidate, undefined);
  assert.equal(matched(isolated([{ ...positive, normalizedPayload }]), 6).status, 'partial');
});

test('Qisha body and life need both same-period limits with shared seats and repeats handled explicitly', () => {
  const separate = encounter(encounterSamples.qishaSeparate);
  const shared = encounter(encounterSamples.qishaShared);
  const repeat = encounter(encounterSamples.qishaRepeat);
  assert.deepEqual([separate.data.qisha.branch, separate.data.life.decadal, separate.data.body.minor], ['子', '守', '三合']);
  assert.deepEqual([separate.data.qishaSeparateBodyLifeCandidate, separate.data.qishaSharedBodyLifeCandidate], [true, false]);
  assert.deepEqual([shared.data.qishaSeparateBodyLifeCandidate, shared.data.qishaSharedBodyLifeCandidate], [false, true]);
  assert.equal(shared.data.life.branch, shared.data.body.branch);
  assert.equal(repeat.data.qishaBodyLifeRepeatCandidate, true);
  assert.deepEqual(repeat.data.flowSha.filter(row => row.repeatsNatal && row.relation === '守').map(row => row.star), ['流年陀罗']);
  for (const { run, fact } of [separate, shared, repeat]) {
    const result = matched(run, 8);
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.sourceFactIds, [fact.factId]);
    assert.ok(fact.sourceFactIds.length >= 2 && fact.sourceFactIds.every(id => run.rawFacts.some(row => row.rawFactId === id)));
  }
  const near = encounter({ ...encounterSamples.qishaSeparate, year: 1999 });
  assert.equal(near.data.qisha.decadal, '守');
  assert.equal(near.data.body.minor, '其他');
  assert.equal(matched(near.run, 8).status, 'not_matched');
  const { natal, frame } = natalFrame(encounterSamples.qishaSeparate);
  const alone = quanshuLimitBranches(natal, { ...frame, minorIndex: undefined });
  assert.equal(quanshuBodyLimitEncounters(natal, frame.yearIndex, alone).qishaSeparateBodyLifeCandidate, undefined);
});

test('one natal archive cannot supply an unverified minor to Tanlang or either Qisha passage', () => {
  const birth = { dateStr: '1990-01-15', timeIndex: 1, gender: '女' };
  const cases = [
    [2003, '巳', '申', 6, 'tanlangYearXingJiCandidate', '贪狼'],
    [1999, '酉', '寅', 8, 'qishaSeparateBodyLifeCandidate', undefined],
    [2001, '未', '子', 9, 'qishaFlowShaCandidate', '七杀'],
  ];
  for (const [year, expected, wrongBranch, number, field, star] of cases) {
    const sample = { ...birth, year };
    const { run, fact, data } = encounter(sample);
    assert.equal(data[field], false, field);
    const { natal, frame } = natalFrame(sample);
    const wrongIndex = natal.palaces.find(row => row.earthlyBranch === wrongBranch).index;
    const limits = quanshuLimitBranches(natal, { ...frame, minorIndex: wrongIndex });
    assert.equal(limits.sourceMinor.verified, false);
    assert.equal(limits.sourceMinor.branch, expected);
    const misplaced = quanshuBodyLimitEncounters(natal, frame.yearIndex, limits);
    const archiveAssumed = quanshuBodyLimitEncounters(natal, frame.yearIndex, { ...limits,
      sourceMinor: { ...limits.sourceMinor, branch: wrongBranch, verified: true } });
    assert.equal(archiveAssumed[field], true, field);
    assert.equal(misplaced[field], undefined, field);
    assert.equal((star === '贪狼' ? misplaced.tanlang : misplaced.qisha).minor, undefined);
    let evidence = { ...fact, normalizedPayload: misplaced };
    if (star) {
      const source = run.facts.find(row => timedEncounter(row) && row.normalizedPayload.star === star);
      assert.ok(source, field);
      const bounds = { start: Date.parse(source.activeFrom), end: Date.parse(source.activeTo) };
      const [time] = quanshuLimitTiming(natal, limits, bounds, { age: limits.sourceMinor.ordinal, decadalIndex: frame.decadalIndex });
      const timed = quanshuTimedBody(time.data, misplaced).find(row => row.star === star);
      assert.equal(timed.activeInSourceHalf, undefined);
      evidence = { ...source, normalizedPayload: timed };
    }
    assert.equal(matched({ ...run, facts: [evidence] }, number).status, 'unknown', field);
  }
  const { natal, frame } = natalFrame({ ...birth, year: 1998 });
  const independent = quanshuBodyLimitEncounters(natal, frame.yearIndex,
    quanshuLimitBranches(natal, { ...frame, minorIndex: undefined }));
  assert.equal(independent.qisha.decadal, '守');
  assert.equal(independent.qishaFlowShaCandidate, true);
});

test('p008 independently matches one trine and one opposition to the verified natal body and life', () => {
  for (const [name, start, qisha, decadal, minor] of [
    ['qishaLifeTrineBodyOpposed', '1991-02-14T16:00:00.000Z', '酉', ['命宫', '酉', '巳', '三合'], ['身宫', '丑', '未', '冲']],
    ['qishaLifeOpposedBodyTrine', '2009-01-25T16:00:00.000Z', '巳', ['命宫', '亥', '巳', '冲'], ['身宫', '巳', '丑', '三合']],
    ['qishaSharedTrineAndOpposed', '1989-02-05T16:00:00.000Z', '卯', ['身命同宫', '卯', '亥', '三合'], ['身命同宫', '卯', '酉', '冲']],
  ]) {
    const { run, fact, data } = submittedEncounter(name);
    assert.equal(data.qisha.branch, qisha);
    assert.deepEqual([data.qishaSeparateBodyLifeCandidate, data.qishaSharedBodyLifeCandidate, data.qishaBodyLifeAspectCandidate],
      [false, false, true]);
    const asWitness = ([target, targetBranch, branch, relation]) => ({ target, targetBranch, branch, relation });
    assert.deepEqual(data.qishaBodyLifeAspectWitnesses, [{ decadal: asWitness(decadal), minor: asWitness(minor), candidate: true }]);
    const result = matched(run, 8);
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.sourceFactIds, [fact.factId]);
    assert.deepEqual(result.windows, [{ start, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), name));
    const prompt = formatFortuneFactAudit(input);
    for (const [label, [target, targetBranch, branch, relation]] of [['大限', decadal], ['小限', minor]]) {
      assert.ok(prompt.includes(label + '在' + branch + '宫，与' + target + '所在的' + targetBranch + '宫为' + relation));
    }
    assert.doesNotMatch(prompt, /qishaBodyLifeAspectCandidate|qishaBodyLifeAspectWitnesses/u);
  }

  const near = encounter(encounterSamples.qishaTwoTrines);
  assert.deepEqual([near.data.life.decadal, near.data.body.minor], ['三合', '三合']);
  assert.equal(matched(near.run, 8).status, 'not_matched');

  const { natal, frame } = natalFrame(encounterSamples.qishaLifeTrineBodyOpposed);
  const lackingMinor = quanshuLimitBranches(natal, { ...frame, minorIndex: undefined });
  const missing = quanshuBodyLimitEncounters(natal, frame.yearIndex, lackingMinor);
  assert.equal(missing.qishaBodyLifeAspectCandidate, undefined);
  assert.deepEqual(missing.qishaBodyLifeAspectWitnesses, []);
});

test('p009 keeps co-seated imperial Lu from counting as relief when verified body and Life limits oppose and trine', () => {
  const sample = { dateStr: '1946-02-05', timeIndex: 3, gender: '男', year: 1971 };
  const year = sample.year, now = Date.UTC(year, 5, 1);
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const archive = { snapshotId: 'qisha-lu-body-life-conflict', chart: chart(native(sample)) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const boundRun = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
  validateFortuneFacts(boundRun);
  const { run, data } = encounter(sample, boundRun);
  assert.equal(data.qishaImperialLuCandidate, true);
  assert.equal(data.qishaImperialLuBodyLifeConflictCandidate, true);
  const facts = run.facts.filter(fact => timedEncounter(fact) && fact.normalizedPayload.star === '七杀');
  const active = facts.find(fact => fact.normalizedPayload.activeInSourceHalf === true);
  assert.ok(active);
  const earlier = facts.find(fact => fact.activeTo === active.activeFrom);
  assert.ok(earlier);
  assert.equal(active.activeFrom, '1971-08-20T16:00:00.000Z');
  assert.deepEqual(active.normalizedPayload.guardScopes, ['minor']);
  const bound = active.normalizedPayload;
  assert.equal(bound.qishaImperialLuCandidate, false);
  assert.equal(bound.qishaImperialLuBodyLifeConflictCandidate, true);
  assert.deepEqual([bound.qishaPlainLimitCandidate, bound.qishaFlowShaCandidate, bound.qishaAnnualTigerGuardCandidate,
    bound.qishaJielanMinorFlowShaCandidate], [false, false, false, false]);
  assert.deepEqual(bound.qishaImperialLuBodyLifeConflictWitness, { branch: '巳', ziweiBranch: '巳', lucunBranch: '巳',
    limits: [{ decadal: { target: '身宫', targetBranch: '巳', branch: '丑', relation: '三合' },
      minor: { target: '命宫', targetBranch: '亥', branch: '巳', relation: '冲' }, candidate: true }] });
  assert.equal(earlier.normalizedPayload.qishaImperialLuBodyLifeConflictWitness, undefined);
  const strict = { ...run, facts: [active] };
  const verdict = matched(strict, 9);
  assert.equal(verdict.status, 'partial');
  assert.deepEqual(verdict.windows, [{ start: active.activeFrom, endExclusive: active.activeTo }]);
  assert.equal(matched({ ...run, facts: [earlier] }, 9).status, 'not_matched');
  const regular = encounter(encounterSamples.qishaImperialOnly);
  assert.ok(regular.run.facts.some(fact => timedEncounter(fact) && fact.normalizedPayload.star === '七杀'
    && fact.normalizedPayload.activeInSourceHalf === true && fact.normalizedPayload.qishaImperialLuCandidate === true
    && fact.normalizedPayload.qishaImperialLuBodyLifeConflictCandidate === false));
  const { natal, frame } = natalFrame(sample);
  const noMinor = quanshuLimitBranches(natal, { ...frame, minorIndex: undefined });
  const unknown = quanshuBodyLimitEncounters(natal, frame.yearIndex, noMinor);
  assert.equal(unknown.ready, true);
  assert.equal(unknown.qishaImperialLuBodyLifeConflictCandidate, undefined);
  const misplacedLucun = structuredClone(natal), palace = misplacedLucun.palaces.find(row => row.earthlyBranch === '巳');
  const [lucun] = palace.minorStars.splice(palace.minorStars.findIndex(row => row.name === '禄存'), 1);
  palace.adjectiveStars.push(lucun);
  const misplaced = quanshuBodyLimitEncounters(misplacedLucun, frame.yearIndex, quanshuLimitBranches(misplacedLucun, frame));
  assert.equal(misplaced.ready, true);
  assert.equal(misplaced.lu.find(row => row.label === '本命禄存').branch, undefined);
  assert.equal(misplaced.qishaImperialLuBodyLifeConflictCandidate, undefined);
  assert.equal(misplaced.qishaImperialLuBodyLifeConflictWitness, undefined);
  const { input } = buildFortuneModelContext(strict, interpretFortune(strict, requestForFortuneRun(strict), archive.snapshotId));
  assert.ok(!input.sections.flatMap(section => section.findings).some(entry => entry.knowledgeId === verdict.knowledgeId));
  assert.match(formatFortuneFactAudit(input), /七杀、紫微和本命禄存同守巳宫，大限丑宫与身宫为三合、小限巳宫与命宫为冲/u);
  assert.doesNotMatch(formatFortunePrompt(input), /七杀、紫微和本命禄存同守巳宫|qishaImperialLuBodyLifeConflictWitness/u);
});

test('Qisha at the limit keeps Ziwei and its four Lu candidates separate from the annual Yang/Tuo contacts', () => {
  const cases = [
    [encounterSamples.qishaPlain, [true, false, false]],
    [encounterSamples.qishaImperialOnly, [false, true, false]],
    [encounterSamples.qishaFlowOnly, [false, false, true]],
    [encounterSamples.qishaBoth, [false, true, true]],
  ];
  for (const [sample, expected] of cases) {
    const { run, data } = encounter(sample);
    assert.deepEqual([data.qishaPlainLimitCandidate, data.qishaImperialLuCandidate, data.qishaFlowShaCandidate], expected);
    assert.equal(data.qisha.minor, '守');
    assert.equal(matched(run, 9).status, 'partial');
    assert.deepEqual(matched(run, 9).sourceFactIds, activeEncounterIds(run, '七杀'));
  }
  const { run, data } = encounter(encounterSamples.qishaBoth);
  assert.equal(data.qishaGrade, '平');
  assert.deepEqual(data.lu.filter(row => ['守', '冲', '三合'].includes(row.relation)).map(row => [row.label, row.star]),
    [['流年干化禄候选', '破军']]);
  const older = { ...run, facts: run.facts.filter(f => f.factType !== encounterType && f.factType !== timedType) };
  assert.ok(facts(older).some(f => f.normalizedPayload.focusMainStars?.includes('七杀')));
  assert.equal(matched(older, 9).status, 'unknown');
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'qisha-limit-encounters'));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /流年干化禄候选落在破军，位于酉宫，关系为三合/u);
  assert.match(prompt, /流年陀罗在亥宫，关系为冲/u);
  assert.doesNotMatch(prompt, /qishaImperialLuCandidate|quanshu_body_limit_encounters/u);
  assert.ok(!input.sections.flatMap(section => section.findings).some(entry => entry.knowledgeId === rule(9).knowledgeId));
});

test('a body and life context alone cannot satisfy the separate verse predicate',()=>{
  const r = rule(22);
  assert.deepEqual(r.queries[0].anyOf, [{ lifeBodyShaCandidate: true }, { lifeBodyAdditionalShaCandidate: true }]);
  assert.match(r.unresolved.join(),/杀曜全集/u);
  const run=structuredClone(real(ref.examples.find(e=>e.n===22)));
  run.facts=run.facts.filter(f=>f.factType!=='quanshu_xing_ji_tiger');
  assert.ok(facts(run).some(f=>f.normalizedPayload.lifeCandidateShaPresent&&f.normalizedPayload.bodyCandidateShaPresent));
  assert.equal(matched(run,22).status,'unknown');
  assert.ok(!buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'sha-missing')).input.sections.flatMap(s=>s.findings).some(f=>f.knowledgeId===r.knowledgeId));
});

test('p009 keeps annual Four Flying White Tiger at a guarded Qisha seat separate from the Yang and Tuo candidates', () => {
 const sample = { dateStr: '1989-02-15', timeIndex: 1, gender: '女', year: 2004 };
 const { run, data } = encounter(sample);
 assert.deepEqual([data.qisha.branch, data.qisha.minor], ['辰', '守']);
 assert.deepEqual(data.annualTiger, { branch: '辰', relation: '守' });
 assert.equal(data.qishaPlainLimitCandidate, false);
 assert.equal(data.qishaFlowShaCandidate, false);
 assert.equal(data.qishaImperialLuCandidate, false);
 assert.equal(data.qishaAnnualTigerGuardCandidate, true);
 const result = matched(run, 9);
 assert.equal(result.status, 'partial');
 assert.deepEqual(result.sourceFactIds, activeEncounterIds(run, '七杀'));
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'qisha-four-flying'));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /年度四飞白虎与七杀同守辰宫，实际一限也守该宫/u);
 assert.doesNotMatch(prompt, /qishaAnnualTigerGuardCandidate/u);
 assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === result.knowledgeId));

 const near = encounter({ ...sample, timeIndex: 0, gender: '男', year: 2005 });
 assert.deepEqual(near.data.annualTiger, { branch: '巳', relation: '守' });
 assert.equal(near.data.qishaAnnualTigerGuardCandidate, false);
 assert.equal(matched(near.run, 9).status, 'not_matched');
});

test('birth-stem source transformations stay distinct from unverified annual extensions and ignore default archive mutagens',()=>{
  const n=native({dateStr:'2022-05-05'}),p=quanshuBodyLimitCondition(n,4,4,2026,'yearly');assert.equal(p.ready,true);
  const birth=p.transformations.filter(t=>t.layer==='natal');assert.deepEqual(birth.map(t=>({star:t.star,kind:t.kind})),quanshuTransformations('壬'));
  assert.equal(birth.find(t=>t.kind==='科').star,'天府');assert.equal(p.annualTransformationRuleVerified,false);
  assert.ok(p.transformations.filter(t=>t.layer==='annual_candidate').every(t=>t.sourceStatus==='extension-candidate-not-verified-annual-rule'));
  const edited=structuredClone(n);for(const palace of edited.palaces)for(const star of all(palace)){star.mutagen='忌';star.brightness='陷';}
  const after=quanshuBodyLimitCondition(edited,4,4,2026,'yearly');assert.deepEqual(after.transformations,p.transformations);assert.equal(after.qishaGrade,p.qishaGrade);
  assert.equal(p.qishaGrade,quanshuBrightness('七杀',p.qishaBranch));assert.equal(p.rescued,undefined);
});

test('unavailable Tianxing or unlocated transformation targets do not become false negatives or erase known body geometry',()=>{
  const n=native({dateStr:'2022-05-05'});remove(n,'天刑');remove(n,'文昌');const p=quanshuBodyLimitCondition(n,4,4,2026,'yearly');
  assert.equal(p.ready,true);assert.equal(p.tianxingReady,false);assert.equal(p.tianxingBranch,undefined);
  const chang=p.transformations.find(t=>t.layer==='annual_candidate'&&t.star==='文昌');assert.equal(chang.placed,false);assert.equal(chang.branch,undefined);
  assert.equal(p.qishaAtLifeOrBody,readQuanshuBodyNatal(n).mainPositions.some(s=>s.star==='七杀'&&[p.bodyBranch,p.lifeBranch].includes(s.branch)));
  const translated=describeFortuneFact({method:'ziwei',type:'quanshu_body_limit_context',data:p},String);
  assert.match(translated,/天刑的来源位置未核/u);assert.match(translated,/受化星归档位置不唯一/u);
});

test('firebell product failure leaves absent-looking source Sha positions unknown, with verified source Yang/Tuo retained',()=>{
  const n=native();remove(n,'火星');const p=quanshuBodyLimitCondition(n,4,4,2026,'yearly');assert.equal(p.ready,true);
  assert.equal(p.firebellProductCoordinatesReady,false);assert.equal(p.sourceFirebellHourVerified,false);assert.equal(p.shaPositions.length,2);
  for(const [key,rel]of[['lifeCandidateShaPresent','lifeRelation'],['bodyCandidateShaPresent','bodyRelation']]){
    assert.equal(p[key],p.shaPositions.some(s=>s[rel]==='守')?true:undefined);
  }
});

test('lunar new year and both limit boundaries cut jointly; the Gregorian year cannot reuse the preceding annual stem',()=>{
  const run=real(ref.examples.find(e=>e.n===47)),annual=facts(run).filter(f=>f.scope==='yearly');
  assert.ok(annual.some(f=>f.normalizedPayload.lunarYear===2025&&f.normalizedPayload.annualStem==='乙'));
  const current=annual.filter(f=>f.normalizedPayload.lunarYear===2026);assert.ok(current.length);assert.equal(current[0].activeFrom,'2026-02-16T16:00:00.000Z');
  assert.ok(current.every(f=>f.normalizedPayload.annualStem==='丙'&&f.normalizedPayload.annualBranch==='午'));
  for(const f of annual)assert.ok(f.normalizedPayload.transformations.filter(t=>t.layer==='annual_candidate').every(t=>t.stem===f.normalizedPayload.annualStem));
  assert.ok(annual.slice(1).every((f,i)=>f.activeFrom===annual[i].activeTo));
});

test('missing partner scopes remain unknown; mismatched annual or focus geometry and ambiguous archives cannot supply a hit',()=>{
  const n=native(),p=quanshuBodyLimitCondition(n,4,4,2026,'yearly');assert.equal(p.ready,true);assert.equal(p.decadalMinorSamePalace,undefined);assert.equal(p.layerContacts.length,1);
  assert.equal(quanshuBodyLimitCondition(n,3,3,2026,'yearly').ready,false);
  assert.equal(quanshuBodyLimitCondition(n,4,4,2026,'decadal',3,2).ready,false);
  const e=ref.examples.find(e=>e.n===47),unknown=chart(native(e));unknown.timeKnown=false;assert.equal(matched(calculate(unknown),47).status,'unknown');
  const multi=chart(native(e));multi.ziwei.rawResult.push(structuredClone(multi.ziwei.rawResult[0]));assert.equal(matched(calculate(multi),47).status,'unknown');
});

test('all six source hashes and remaining conditions are preserved and wrong-profile or missing source fields cannot qualify',()=>{
  for(const e of ref.examples){const r=rule(e.n),source=fortuneKnowledge.ziwei.entries.find(s=>s.id===r.knowledgeId);
    assert.equal(r.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:source.evidence,conditions:source.conditions})).digest('hex'));
    assert.equal(r.queries.length,1);
    const formerType = [22,29,47].includes(e.n) ? 'quanshu_xing_ji_tiger' : encounterType;
    const timed = [6,9,29].includes(e.n);
    assert.equal(r.queries[0].factType, timed ? timedType : formerType);
    if (timed) assert.equal(r.queries[0].where.sourceFactType, formerType);
    if ([6,9].includes(e.n)) assert.equal(r.queries[0].where.sourceProfile, quanshuBodyLimitEncounterPolicy.profile);
    if (e.n === 8) assert.equal(r.queries[0].where.profile, quanshuBodyLimitEncounterPolicy.profile);
    assert.ok(r.unresolved.length);
  }
  const sourceFacts=run=>run.facts.filter(f=>f.factType==='quanshu_xing_ji_tiger');
  const run=structuredClone(real(ref.examples.find(e=>e.n===47)));sourceFacts(run).forEach(f=>{f.normalizedPayload.profile='other';});assert.equal(matched(run,47).status,'not_matched');
  const missing=structuredClone(real(ref.examples.find(e=>e.n===47)));sourceFacts(missing).forEach(f=>{
    delete f.normalizedPayload.qishaXingJiEvidence;
  });assert.equal(matched(missing,47).status,'unknown');
  const generic=structuredClone(real(ref.examples.find(e=>e.n===47)));generic.facts=generic.facts.filter(f=>f.factType!=='quanshu_xing_ji_tiger');assert.equal(matched(generic,47).status,'unknown');
});

test('the actual provider receives separate body/life and source-layer caveats in Chinese, never raw payloads or partial source passages',async()=>{
  const run=real(ref.examples.find(e=>e.n===47)),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'body-limits-report'));
  assert.ok(input.facts.some(f=>f.type==='quanshu_body_limit_context'));assert.ok(!input.sections.flatMap(s=>s.findings).some(f=>ref.examples.some(e=>f.knowledgeId===rule(e.n).knowledgeId)));
  const prompt=formatFortuneFactAudit(input);
  for(const phrase of ['身宫和命宫分列','不能把不同宫预先排除','年度发化规则尚未同源核实','不是救应已生效','无功与可解属于不同语境'])assert.ok(prompt.includes(phrase),phrase);
  for(const secret of ['quanshu-body-life','bodyBranch','qishaAtLifeOrBody','annual_candidate','body-limits-snapshot','layerContacts','coordinateBasis'])assert.ok(!prompt.includes(secret),secret);
  assert.ok(!/[{}\[\]]/u.test(prompt));let called=false;
  const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{called=true;assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));
    return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});
  await provider.interpret(input);assert.equal(called,true);
  const same=native({timeIndex:0}),data=quanshuBodyLimitCondition(same,4,4,2026,'yearly');
  assert.match(describeFortuneFact({method:'ziwei',type:'quanshu_body_limit_context',data},String),/不重复计成两份证据/u);
  assert.equal(describeFortuneFact({method:'ziwei',type:'quanshu_body_limit_context',data:{...data,profile:'other'}},String),'');
});
