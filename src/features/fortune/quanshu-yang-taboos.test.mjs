import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {astro} from 'iztro';
import './server/knowledge/runtime.mjs';
import {describeFortuneFact,formatFortuneFactAudit, formatFortunePrompt} from './control/fortune-prompt.mjs';
import {createFortuneDeepSeek} from './server/deepseek-expression.mjs';
const {quanshuYangTabooCondition,quanshuBirthTabooCandidates,quanshuPalaceNameGroups,quanshuYangTabooPolicy}=await import('./control/ziwei-yang-taboos.ts');
const {quanshuAnnualContext, quanshuIdlePalace, quanshuLimitPhase, quanshuLunarMidnight}=await import('./control/ziwei-quanshu.ts');
const {quanshuKillerEcho}=await import('./control/ziwei-killer-echo.ts');
const {calculateFortuneFacts,validateFortuneFacts}=await import('./control/fortune-facts.ts');
const {buildFactTimeContext}=await import('./control/fact-time-context.ts');
const {buildFortuneFactSubmission}=await import('./control/fortune-fact-submission.ts');
const {bindClientFortuneRun,readClientFactTime}=await import('./server/client-facts.mjs');
const {matchFortuneKnowledge}=await import('./control/knowledge/match.ts');
const {fortuneKnowledge}=await import('./control/knowledge/catalog.ts');
const {interpretFortune,requestForFortuneRun}=await import('./control/fortune-interpretation.ts');
const {buildFortuneModelContext}=await import('./control/fortune-model-context.ts');
const ref=JSON.parse(readFileSync(new URL('./model/fixtures/quanshu-yang-taboo-reference.json',import.meta.url)));
const config={yearDivide:'normal',horoscopeDivide:'normal',ageDivide:'normal',dayDivide:'current'},branches=[...'子丑寅卯辰巳午未申酉戌亥'];
const all=p=>[...p.majorStars,...p.minorStars,...p.adjectiveStars];
const native=(name='opposite')=>{const {year,birth,minor,yang,...args}=ref.cases[name];return astro.withOptions({...args,fixLeap:true,config});};
function condition(name='opposite',change=n=>n){const a=native(name),h=a.horoscope(ref.cases[name].year+'-11-19'),n=change(a.toJSON());return quanshuYangTabooCondition(n,h.age.index,h.yearly.index,ref.cases[name].year,'minor',h.decadal.index,h.age.index);}
const chart=n=>({timeKnown:true,bazi:{rawResult:[]},western:{rawResult:[]},ziwei:{engineName:'iztro',engineVersion:'2.6.5',rulesetVersion:'standard-new-year-leap-split-late-zi-current-v1',rawResult:[n]}});
const cache=new Map();
function real(name){if(!cache.has(name)){const year=ref.cases[name].year,input={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year}};
 cache.set(name,calculateFortuneFacts(input,buildFactTimeContext(input,Date.parse(year+'-11-19T00:00:00Z'),'server'),'yang-private-run',{snapshotId:'yang-private-snapshot',chart:chart(native(name).toJSON())}));}return cache.get(name);}
const rows=run=>run.facts.filter(f=>f.factType==='quanshu_yang_taboo_context'),match=(run,i)=>matchFortuneKnowledge(run).byMethod.ziwei[i];
function annual(name, run = real(name)) {
 const facts = run.facts.filter(f => f.factType !== 'quanshu_yang_taboo_context'
   || (f.scope === 'yearly' && f.normalizedPayload.lunarYear === ref.cases[name].year));
 const fact = facts.find(f => f.factType === 'quanshu_yang_taboo_context');
 assert.ok(fact, name);
 return { run: { ...run, facts }, fact, data: fact.normalizedPayload };
}

test('p036 verifies Nanyang fallen Yang and Jumen sharing the actual guarded limit', () => {
  const archive = astro.withOptions({ dateStr: '1990-05-15', gender: '女', timeIndex: 3, fixLeap: true, config });
  const natal = archive.toJSON();
  for (const year of [1996, 1997]) {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 1), source = { snapshotId: 'ming-yang-jumen', chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, source)));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), source.snapshotId, source);
    validateFortuneFacts(bound);
    const fact = rows(bound).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === year);
    const p = fact.normalizedPayload, positive = year === 1997;
    assert.equal(p.mingXingAnProfile, 'quanshu-nanyangtang-yang-jumen-limit-v1');
    assert.equal(p.fallenYangMingJumenGuardCandidate, positive);
    assert.deepEqual(p.fallenYangMingJumenWitness, positive
      ? { yangBranch: '酉', jumenBranch: '酉', tianfuBranch: '午', guardScopes: ['minor'] } : undefined);
    for (const key of ['fallenYangGuardShaCandidate', 'fallenYangOpposedShaCandidate', 'fallenYangNatalJiCandidate',
      'fallenYangRepeatAnnualCandidate', 'fallenYangMingFixedGuardCandidate', 'fallenYangMingFixedOpposedCandidate',
      'fallenYangJielanFireJiCandidate']) assert.equal(p[key], false, key);
    const run = { ...bound, facts: [fact] };
    const result = matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId.includes('expansion-p036-'));
    assert.equal(result.status, positive ? 'partial' : 'not_matched');
    assert.deepEqual(result.sourceFactIds, positive ? [fact.factId] : []);
    if (positive) {
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), source.snapshotId));
      assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === result.knowledgeId));
      assert.match(formatFortuneFactAudit(input), /小限实守酉宫，陷地擎羊与复核过的巨门实居同宫/u);
      assert.doesNotMatch(formatFortunePrompt(input), /刑暗同行|fallenYangMingJumenWitness/u);
    }
  }
  const h = archive.horoscope('1997-06-01', 6);
  const unresolved = quanshuYangTabooCondition(natal, h.yearly.index, h.yearly.index, 1997, 'yearly', h.decadal.index);
  assert.equal(unresolved.fallenYangMingJumenGuardCandidate, undefined);
  const displaced = structuredClone(natal), original = displaced.palaces.find(palace => palace.majorStars.some(row => row.name === '紫微'));
  displaced.palaces.find(palace => palace.index === (original.index + 1) % 12).majorStars.push(original.majorStars.find(row => row.name === '紫微'));
  original.majorStars = original.majorStars.filter(row => row.name !== '紫微');
  const brokenAxis = quanshuYangTabooCondition(displaced, h.yearly.index, h.yearly.index, 1997, 'yearly', h.decadal.index, h.age.index);
  assert.equal(brokenAxis.fallenYangMingJumenGuardCandidate, undefined);
  assert.equal(brokenAxis.fallenYangMingJumenWitness, undefined);
  const decadal = astro.withOptions({ dateStr: '1990-05-15', gender: '女', timeIndex: 7, fixLeap: true, config });
  const current = decadal.horoscope('2004-06-01', 6);
  const confirmed = quanshuYangTabooCondition(decadal.toJSON(), current.yearly.index, current.yearly.index, 2004, 'yearly', current.decadal.index);
  assert.equal(confirmed.fallenYangMingJumenGuardCandidate, true);
  assert.deepEqual(confirmed.fallenYangMingJumenWitness.guardScopes, ['decadal']);
});

function submittedAnnual(name, birthContext) {
 const year = ref.cases[name].year;
 const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
 const now = Date.UTC(year, 5, 1), archive = { snapshotId: name, chart: chart(native(name).toJSON()) };
 if (birthContext) archive.chart.birthContext = birthContext;
 const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
 const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), name, archive);
 validateFortuneFacts(run);
 return annual(name, run);
}

function submittedBeijingBirth(name) {
  const { dateStr, timeIndex } = ref.cases[name];
  const hour = String(timeIndex * 2).padStart(2, '0');
  return submittedAnnual(name, { precision: 'minute', birthInstant: new Date(dateStr + 'T' + hour + ':00:00+08:00').toISOString(),
    latitude: 39.9042, longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' });
}

test('all twelve birth branches preserve the separate printed prose and verse, named-star clauses and unproven full-taboo definition',()=>{
 for(const b of branches){const p=quanshuBirthTabooCandidates(b);assert.equal(p.proseBranches.join(''),ref.proseByBirth[b]);assert.equal(p.verseBranches.join(''),ref.verseByBirth[b]);assert.equal(p.completeTabooDefinitionVerified,false);}
 const wei=quanshuBirthTabooCandidates('未');assert.equal(wei.weiProseVerseConflict,true);assert.deepEqual(wei.proseBranches,['酉','戌']);assert.deepEqual(wei.verseBranches,['亥','酉']);assert.equal(wei.requiresTombYang,true);
 assert.deepEqual(quanshuBirthTabooCandidates('子').oppositionPairs,[['子','午']]);assert.deepEqual(quanshuBirthTabooCandidates('寅').oppositionPairs,[['卯','酉'],['寅','申']]);
 assert.deepEqual(quanshuBirthTabooCandidates('申').namedStars,['铃星','火星']);assert.deepEqual(quanshuBirthTabooCandidates('申').explicitAnnualBranches,['寅']);
 assert.deepEqual(quanshuBirthTabooCandidates('辰').explicitAnnualBranches, ['辰']);
 assert.deepEqual(quanshuBirthTabooCandidates('辰').explicitLimitBranches, ['辰', '戌']);
 assert.deepEqual(quanshuBirthTabooCandidates('巳').explicitLimitBranches, ['巳']);
 assert.deepEqual(quanshuBirthTabooCandidates('酉').explicitLimitBranches, ['卯']);
 assert.deepEqual(quanshuBirthTabooCandidates('戌').explicitLimitBranches, ['戌', '辰']);
 assert.deepEqual(quanshuBirthTabooCandidates('戌').oppositionPairs, [['辰', '戌']]);
 assert.deepEqual(quanshuBirthTabooCandidates('未').explicitLimitBranches, []);
 for(const b of ['','子丑','?'])assert.throws(()=>quanshuBirthTabooCandidates(b));
});

test('historical male and female palace tables are both exact and male unlisted palaces do not become weak or select a user identity',()=>{
 for(const [grade,names]of Object.entries(ref.malePalaceGroups))for(const name of names){const p=quanshuPalaceNameGroups(name);assert.equal(p.maleTable,grade==='未列'?undefined:grade);assert.equal(p.femaleTable,ref.femalePalaceStrong.includes(name)?'强宫':'弱宫');}
 assert.equal(quanshuPalaceNameGroups('官禄').maleTable,'强宫');assert.equal(quanshuPalaceNameGroups('官禄').femaleTable,'弱宫');
 assert.throws(()=>quanshuPalaceNameGroups('unknown'));
});

test('a real single minor opposition stays available for audit without triggering the verse about both limits',()=>{
 const p=condition();assert.equal(p.ready,true);assert.equal(p.birthYearBranch,'亥');assert.equal(p.yangBranch,'辰');assert.equal(p.branch,'戌');assert.equal(p.focusRelation,'冲');assert.equal(p.yangInNet,true);assert.equal(p.yangGrade,'庙');
 const {run,data}=annual('opposite');
 assert.equal(data.yangNetOpposedLimitCandidate,true);assert.equal(data.minorYangRelation,'冲');
 assert.equal(data.yangNetVerifiedOpposedLimitCandidate,true);
 assert.equal(data.yangNetVerifiedBothOpposed,false);
 assert.equal(match(run,84).status,'not_matched');
});

test('Yang on the Chen-Xu axis needs an actual opposing limit and distinguishes both possible two-limit patterns', () => {
 for (const [name, angles, across, both, status] of [
   ['netAcross', ['冲', '守'], true, false, 'not_matched'],
   ['netBothOpposed', ['冲', '冲'], false, true, 'matched'],
   ['netGuardOnly', ['其他', '守'], false, false, 'not_matched'],
 ]) {
   const { run, data } = annual(name);
   assert.equal(data.yangInNet, true);
   assert.deepEqual([data.decadalYangRelation, data.minorYangRelation], angles);
   assert.deepEqual([data.yangNetAcrossLimits, data.yangNetBothOpposed], [across, both]);
   assert.deepEqual([data.yangNetVerifiedAcrossLimits, data.yangNetVerifiedBothOpposed], [across, both]);
   assert.equal(data.yangNetVerifiedOpposedLimitCandidate, angles.includes('冲'));
   assert.equal(data.yangNetVerifiedAxes.sourceDecadal.verified, true);
   assert.equal(data.yangNetVerifiedAxes.minorVerified, true);
   assert.equal(data.yangNetVerifiedAxes.minorBranch, data.yangNetVerifiedAxes.sourceMinor.branch);
   assert.equal(match(run, 84).status, status);
 }
});

test('p035 preserves the verified dual year and rejects a fabricated or absent limit', () => {
 const archive = native('netBothOpposed'), year = ref.cases.netBothOpposed.year;
 const frame = archive.horoscope(year + '-11-19');
 const natal = archive.toJSON();
 const condition = (chart = natal, minorIndex = frame.age.index) => quanshuYangTabooCondition(
   chart, frame.yearly.index, frame.yearly.index, year, 'yearly', frame.decadal.index, minorIndex);
 const { run, fact, data } = submittedAnnual('netBothOpposed');
 const verdict = match(run, 84);
 assert.equal(verdict.status, 'matched');
 assert.deepEqual(verdict.sourceFactIds, [fact.factId]);
 assert.deepEqual(verdict.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
 assert.deepEqual([data.yangBranch, data.yangNetVerifiedAxes.decadalBranch, data.yangNetVerifiedAxes.minorBranch], ['戌', '辰', '辰']);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'yang-net-dual'));
 assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === verdict.knowledgeId));
 assert.match(formatFortuneFactAudit(input), /大小限同在羊宫的对宫/u);
 assert.doesNotMatch(formatFortunePrompt(input), /大小限同在羊宫的对宫|yangNetVerifiedBothOpposed/u);

 const wrongMinor = condition(natal, natal.palaces.find(row => row.earthlyBranch === '卯').index);
 assert.equal(wrongMinor.yangNetVerifiedBothOpposed, undefined);
 assert.equal(wrongMinor.yangNetVerifiedAxes.minorBranch, undefined);
 assert.equal(wrongMinor.yangNetVerifiedAxes.sourceMinor.branch, '辰');
 const wrongArchive = structuredClone(natal), palace = wrongArchive.palaces.find(row => row.index === frame.decadal.index);
 palace.decadal.range = [1, 10];
 assert.equal(quanshuLimitPhase(wrongArchive, frame.decadal.index, 10, quanshuLunarMidnight(year, 1)).ready, true);
 const wrongDecade = condition(wrongArchive);
 assert.deepEqual(wrongDecade.yangNetVerifiedAxes.sourceDecadal, { branch: '辰', verified: false });
 assert.equal(wrongDecade.yangNetVerifiedAxes.decadalBranch, undefined);
 assert.equal(wrongDecade.yangNetVerifiedBothOpposed, undefined);
 assert.equal(wrongDecade.yangNetVerifiedOpposedLimitCandidate, true);
 const { limitPlacementProof, ...oldPayload } = data;
 assert.equal(limitPlacementProof, 'quanshu-bureau-and-source-minor-v1');
 for (const normalizedPayload of [wrongMinor, wrongDecade, oldPayload]) {
   assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload }] }, 84).status, 'unknown');
 }
});

test('p035 projects the observed birth, life and named support for an actual Yang guard without confusing its opposing limit', () => {
  const cases = [
    ['yangTombBirthDifferentSeat', '辰', '寅', '子', ['其他', '守'], 1, [true, false, false]],
    ['yangTombLifeDifferentBirth', '亥', '未', '未', ['守', '邻宫'], 1, [false, true, false]],
    ['yangThreeNamedMinorGuard', '亥', '巳', '未', ['邻宫', '守'], 3, [false, false, true]],
    ['yangTwoNamedMinorGuard', '亥', '辰', '未', ['其他', '守'], 2, [false, false, false]],
    ['yangThreeNamedBothGuard', '亥', '巳', '未', ['守', '守'], 3, [false, false, true]],
    ['yangThreeNamedOpposedOnly', '卯', '午', '戌', ['三合', '冲'], 3, [false, false, false]],
    ['yangThreeNamedAcrossLimits', '卯', '午', '戌', ['守', '冲'], 3, [false, false, true]],
  ];
  for (const [name, birth, life, yang, limits, contacts, flags] of cases) {
    const { run, data } = submittedBeijingBirth(name);
    assert.deepEqual([data.birthYearBranch, data.natalLifeBranch, data.yangBranch], [birth, life, yang], name);
    assert.deepEqual([data.decadalYangRelation, data.minorYangRelation], limits, name);
    assert.deepEqual([data.yangTombBirthGuardCandidate, data.yangTombLifeGuardCandidate, data.yangZiChangFuGuardCandidate], flags, name);
    assert.deepEqual(data.yangZiChangFuContacts.map(row => row.star), ['紫微', '文昌', '天府'], name);
    assert.equal(data.yangZiChangFuContacts.filter(row => ['守', '冲', '三合'].includes(row.relation)).length, contacts, name);
    if (name === 'yangThreeNamedAcrossLimits') assert.deepEqual(data.yangZiChangFuContacts.map(({ branch, relation }) => [branch, relation]),
      [['午', '三合'], ['寅', '三合'], ['戌', '守']]);

    const opposite = limits.includes('冲');
    const result = match(run, 84);
    assert.equal(result.status, 'not_matched', name);
    const prompt = formatFortuneFactAudit(buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), name)).input);
    assert.equal(prompt.includes('符合四墓生人守羊限的候选条件'), flags[0], name);
    if (flags[0]) assert.doesNotMatch(prompt, /按本生年支辰所列的四墓生人候选/u);
    assert.equal(prompt.includes('本命命宫与擎羊同在四墓' + yang + '宫'), flags[1], name);
    assert.equal(prompt.includes('紫微、文昌、天府齐会该宫'), flags[2], name);
    assert.equal(prompt.includes('实际对冲羊宫'), opposite, name);
    if (name === 'yangThreeNamedBothGuard') assert.match(prompt, /大限、小限实守未宫的擎羊/u);
    assert.doesNotMatch(prompt, /yangZiChangFuGuardCandidate|yangTombLifeGuardCandidate/u);
  }
});

test('p035 uses idle palaces with the actual opposing limit and preserves edition and grade conflicts', () => {
  for (const [star, branch, expected] of [
    ['贪狼', '寅', [true, true]], ['贪狼', '辰', [true, false]], ['贪狼', '申', [false, true]],
    ['天梁', '巳', [true, undefined]], ['天梁', '酉', [true, true]], ['天相', '戌', [true, true]],
    ['武曲', '亥', [false, false]],
  ]) {
    const { volumeTwo, mingEdition } = quanshuIdlePalace(star, branch);
    assert.deepEqual([volumeTwo, mingEdition], expected, star + branch);
  }
  const cases = [
    ['netIdleAgrees', true, [true, true], [['天机', '巳', undefined, true, true]], '通行本卷二、明刻本'],
    ['netIdleWithoutOpposition', false, [false, false], [['天机', '巳', undefined, true, true]], ''],
    ['netIdleWithTempleGrade', true, [false, false], [['七杀', '辰', '庙', true, true]], ''],
    ['netIdleMingOnly', true, [false, true], [['贪狼', '申', undefined, false, true]], '明刻本'],
    ['netIdleWithStrongerCompanion', true, [false, false], [['紫微', '辰', undefined, true, true], ['天相', '辰', '地', true, true]], ''],
  ];
  for (const [name, opposed, expected, evidence, editions] of cases) {
    const { run, data } = submittedBeijingBirth(name);
    assert.equal(data.yangNetOpposedLimitCandidate, opposed, name);
    assert.deepEqual([data.yangNetVolumeTwoIdleLifeCandidate, data.yangNetMingIdleLifeCandidate], expected, name);
    assert.deepEqual(data.lifeMajorIdleEvidence.map(({ star, branch, grade, volumeTwo, mingEdition }) => [star, branch, grade, volumeTwo, mingEdition]), evidence, name);
    assert.equal(match(run, 84).status, 'not_matched', name);
    const prompt = formatFortuneFactAudit(buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), name)).input);
    assert.equal(prompt.includes('可列为命宫主星偏弱的一项候选'), Boolean(editions), name);
    if (editions) assert.ok(prompt.includes('按' + editions + '所列闲位与卷三陷地'), name);
    if (name === 'netIdleWithTempleGrade') assert.match(prompt, /七杀在辰宫，通行本卷二、明刻本列为闲位，卷三列为庙/u);
    assert.doesNotMatch(prompt, /lifeMajorIdleEvidence|yangNetMingIdleLifeCandidate/u);
  }
});

test('p035 distinguishes a verified fallen life-palace pair from mixed grades, an empty palace and a year without opposition', () => {
  const cases = [
    ['1971-02-15', 3, 1986, '亥', 'all-fallen', [['廉贞', '陷'], ['贪狼', '陷']], true],
    ['1971-08-15', 11, 1986, '申', 'other-grades', [['天同', '旺'], ['天梁', '陷']], true],
    ['1971-02-15', 7, 1986, '未', 'empty', [], true],
    ['1971-02-15', 3, 1987, '亥', 'all-fallen', [['廉贞', '陷'], ['贪狼', '陷']], false],
  ];
  for (const [dateStr, timeIndex, year, palace, gradeState, stars, opposed] of cases) {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 1), ref = { snapshotId: 'yang-life-grade-' + timeIndex + '-' + year };
    const natal = astro.withOptions({ dateStr, timeIndex, gender: '男', fixLeap: true, config }).toJSON();
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...ref, chart: chart(natal) })));
    const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
    validateFortuneFacts(bound);
    const fact = rows(bound).find(f => f.scope === 'yearly' && f.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    const data = fact.normalizedPayload;
    assert.equal(data.natalLifeBranch, palace);
    assert.equal(data.lifeMajorGradeState, gradeState);
    assert.deepEqual(data.lifeMajorStars.map(row => [row.star, row.grade]), stars);
    assert.equal(data.yangNetOpposedLimitCandidate, opposed);
    const run = { ...bound, facts: bound.facts.filter(f => f.factType !== fact.factType || f.factId === fact.factId) };
    const result = match(run, 84);
    const bothOpposed = data.decadalYangRelation === '冲' && data.minorYangRelation === '冲';
    assert.equal(result.status, bothOpposed ? 'matched' : 'not_matched');
    if (bothOpposed) {
      assert.deepEqual(result.sourceFactIds, [fact.factId]);
      assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'yang-life-grade'));
    const prompt = formatFortuneFactAudit(input);
    assert.equal(prompt.includes('可作为卷二所说命宫主星弱的一项候选'), opposed && gradeState === 'all-fallen');
    assert.doesNotMatch(prompt, /lifeMajorGradeState|all-fallen/u);
  }
});

test('source Yang fallen seats do not borrow archive brightness or collapse added-sha and rescue conditions',()=>{
 for(let year=1990;year<2000;year++){const a=astro.withOptions({dateStr:year+'-11-05',timeIndex:2,gender:'女',fixLeap:true,config}),n=a.toJSON(),h=a.horoscope('2026-11-19');
  const actual=quanshuYangTabooCondition(n,h.age.index,h.yearly.index,2026,'minor',h.decadal.index,h.age.index),expected=ref.yangByStem[n.rawDates.chineseDate.yearly[0]];
  assert.equal(actual.ready,true);assert.equal(actual.yangBranch,expected);assert.equal(actual.yangGrade,ref.yang.temple.includes(expected)?'庙':'陷');assert.equal(actual.yangInNet,ref.yang.net.includes(expected));
 }
 const p=condition('fallen',n=>{n.palaces.find(p=>all(p).some(s=>s.name==='擎羊')).minorStars.find(s=>s.name==='擎羊').brightness='庙';return n;});
 assert.equal(p.ready,true);assert.equal(p.yangBranch,'卯');assert.equal(p.yangGrade,'陷');assert.equal(p.yangFallen,true);assert.equal(p.encounterRangeVerified,false);assert.equal(p.wholeChartStrengthVerified,false);
 const {run,fact,data}=annual('fallen');
 assert.equal(p.focusRelation,'邻宫');assert.equal(data.decadalYangRelation,'守');
 assert.deepEqual(data.additionalSha.filter(row=>row.relation==='守').map(row=>row.star),['归档火星']);
 assert.equal(match(run,85).status,'partial');
 const archive = native('fallen'), year = ref.cases.fallen.year, h = archive.horoscope(year + '-11-19', 6), natal = archive.toJSON();
 const decadal = natal.palaces.find(row => row.index === h.decadal.index);
 decadal.decadal.range = decadal.decadal.range.map(value => value - 1);
 assert.equal(quanshuLimitPhase(natal, h.decadal.index, year - natal.rawDates.lunarDate.lunarYear + 1, quanshuLunarMidnight(year, 1)).ready, true);
 const wrongDecade = quanshuYangTabooCondition(natal, h.yearly.index, h.yearly.index, year, 'yearly', h.decadal.index, h.age.index);
 assert.equal(wrongDecade.decadalYangRelation, '守');
 assert.equal(wrongDecade.yangNetVerifiedAxes.sourceDecadal.verified, false);
 assert.equal(wrongDecade.yangNetVerifiedAxes.minorVerified, true);
 assert.equal(wrongDecade.fallenYangGuardShaCandidate, undefined);
 const { fallenYangLimitProof, ...oldPayload } = data;
 assert.equal(fallenYangLimitProof, 'quanshu-fallen-yang-verified-limit-witnesses-v1');
 for (const normalizedPayload of [wrongDecade, oldPayload]) {
   assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload }] }, 85).status, 'unknown');
 }
});

test('fallen Yang must share a palace with a second named Sha and have a guarding or opposing limit', () => {
 for (const [name, flags, status] of [
   ['fallenGuard', [true, false], 'partial'], ['fallenOpposed', [false, true], 'partial'],
   ['fallenGuardWithoutSha', [false, false], 'not_matched'], ['fallenShaWithoutLimit', [false, false], 'not_matched'],
 ]) {
   const { run, data } = annual(name);
   assert.equal(data.yangGrade, '陷');
   assert.deepEqual([data.fallenYangGuardShaCandidate, data.fallenYangOpposedShaCandidate], flags);
   assert.equal(match(run, 85).status, status);
   if (flags.includes(true)) assert.deepEqual(data.additionalSha.filter(row => row.relation === '守').map(row => row.star), ['古天空']);
 }
 const a = native('fallenGuard'), natal = a.toJSON(), year = ref.cases.fallenGuard.year, h = a.horoscope(year + '-11-19', 6);
 for (const palace of natal.palaces) palace.minorStars = palace.minorStars.filter(row => row.name !== '地空');
 const missing = quanshuYangTabooCondition(natal, h.yearly.index, h.yearly.index, year, 'yearly', h.decadal.index, h.age.index);
 assert.equal(missing.fallenYangGuardShaCandidate, undefined);
 assert.equal(missing.additionalSha.find(row => row.star === '古天空').branch, undefined);
 const { run, fact } = annual('fallenOpposed');
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'fallen-yang-contacts'));
 assert.match(formatFortuneFactAudit(input), /小限对冲陷地擎羊宫，羊宫同守古天空/u);
 const minor = native('fallenOpposed'), archive = minor.toJSON(), returnYear = ref.cases.fallenOpposed.year;
 const frame = minor.horoscope(returnYear + '-11-19', 6);
 const decadal = archive.palaces.find(row => row.index === frame.decadal.index);
 decadal.decadal.range = decadal.decadal.range.map(value => value - 1);
 const minorOnly = quanshuYangTabooCondition(archive, frame.yearly.index, frame.yearly.index, returnYear, 'yearly', frame.decadal.index, frame.age.index);
 assert.equal(minorOnly.yangNetVerifiedAxes.sourceDecadal.verified, false);
 assert.equal(minorOnly.fallenYangOpposedShaCandidate, true);
 assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: minorOnly }] }, 85).status, 'partial');
});

test('p036 keeps Ming Bell co-seated with fallen Yang distinct from its guarding or opposing limit', () => {
  const archive = astro.withOptions({ dateStr: '1974-02-05', timeIndex: 1, gender: '女', fixLeap: true, config });
  const natal = archive.toJSON();
  for (const [year, relation, guarded, opposed] of [
    [1987, '守', true, false], [1993, '冲', false, true], [1988, '邻宫', false, false],
  ]) {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const run = calculateFortuneFacts(params, buildFactTimeContext(params, Date.UTC(year, 5, 1), 'server'),
      'ming-fallen-yang', { snapshotId: 'ming-fallen-yang', chart: chart(natal) });
    const fact = rows(run).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    const data = fact.normalizedPayload;
    assert.deepEqual([data.yangBranch, data.yangGrade, data.minorYangRelation], ['卯', '陷', relation]);
    assert.deepEqual(data.fallenYangMingFixedSha, [
      { star: '火星', branch: '丑', relation: '其他' }, { star: '铃星', branch: '卯', relation: '守' },
    ]);
    assert.deepEqual([data.fallenYangMingFixedGuardCandidate, data.fallenYangMingFixedOpposedCandidate], [guarded, opposed]);
    assert.ok(![data.fallenYangGuardShaCandidate, data.fallenYangOpposedShaCandidate,
      data.fallenYangNatalJiCandidate, data.fallenYangRepeatAnnualCandidate].some(Boolean));
    const result = match({ ...run, facts: [fact] }, 85);
    assert.equal(result.status, guarded || opposed ? 'partial' : 'not_matched');
    assert.deepEqual(result.windows, guarded || opposed ? [{ start: fact.activeFrom, endExclusive: fact.activeTo }] : []);
    if (guarded || opposed) {
      const scoped = { ...run, facts: [fact] };
      const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'ming-fallen-yang'));
      assert.match(formatFortuneFactAudit(input), /明刊定宫铃星同守/u);
      assert.doesNotMatch(formatFortunePrompt(input), /明刊定宫铃星同守/u);
      assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === result.knowledgeId));
    }
    const wrong = { ...fact, normalizedPayload: { ...data, quanshuFixedFireBellProfile: 'other-source' } };
    assert.equal(match({ ...run, facts: [wrong] }, 85).status, 'not_matched');
    if (year === 1988) {
      const h = archive.horoscope(year + '-11-19', 6);
      const wrongMinor = natal.palaces.findIndex(row => row.earthlyBranch === '卯');
      const unverified = quanshuYangTabooCondition(natal, h.yearly.index, h.yearly.index, year, 'yearly', h.decadal.index, wrongMinor);
      assert.equal(unverified.minorYangRelation, '守');
      assert.equal(unverified.yangNetVerifiedAxes.minorRelation, undefined);
      assert.equal(unverified.fallenYangMingFixedGuardCandidate, undefined);
      assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: unverified }] }, 85).status, 'unknown');
    }
  }
});

test('p087 and p036 confirm two named Ming combinations on the same actual 1977 chart', () => {
  const archive = astro.withOptions({ dateStr: '1954-10-05', timeIndex: 9, gender: '男', fixLeap: true, config });
  const natal = archive.toJSON(), source = { snapshotId: 'ming-killer-and-fallen-yang', chart: chart(natal) };
  const rule = suffix => fortuneKnowledge.ziwei.rules.find(row => row.knowledgeId.endsWith(suffix)).knowledgeId;
  const killerId = rule('archive-p087-001'), yangId = rule('expansion-p036-001');
  const submit = year => {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 1);
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, source)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), source.snapshotId, source);
    validateFortuneFacts(run);
    return { ...run, facts: run.facts.filter(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === year
      && ['quanshu_killer_echo', 'quanshu_yang_taboo_context'].includes(row.factType)) };
  };
  const verdict = (run, id) => matchFortuneKnowledge(run).byMethod.ziwei.find(row => row.knowledgeId === id);
  const sameYear = submit(1977);
  const killer = sameYear.facts.find(row => row.factType === 'quanshu_killer_echo');
  const yang = sameYear.facts.find(row => row.factType === 'quanshu_yang_taboo_context');
  assert.deepEqual([killer.normalizedPayload.lifeBranch, killer.normalizedPayload.killerBranch, killer.normalizedPayload.killerLifeRelation],
    ['丑', '巳', '三合']);
  assert.deepEqual(killer.normalizedPayload.annualYangTuo.map(row => [row.star, row.branch, row.lifeRelation]),
    [['擎羊', '未', '冲'], ['陀罗', '巳', '三合']]);
  assert.equal(yang.normalizedPayload.fallenYangMingBellDoubleGuardCandidate, true);
  assert.deepEqual([yang.normalizedPayload.yangBranch, yang.normalizedPayload.yangNetVerifiedAxes.decadalBranch,
    yang.normalizedPayload.yangNetVerifiedAxes.minorBranch], ['卯', '卯', '卯']);
  assert.deepEqual(yang.normalizedPayload.fallenYangMingFixedSha.find(row => row.star === '铃星'),
    { star: '铃星', branch: '卯', relation: '守' });

  const near = submit(1978);
  const { input } = buildFortuneModelContext(sameYear, interpretFortune(sameYear, requestForFortuneRun(sameYear), source.snapshotId));
  for (const [id, fact, sourceExcerpt] of [[killerId, killer, '流年又遇流羊流陀冲照凶'], [yangId, yang, '擎羊加杀最为凶，二限休教落陷逢']]) {
    const hit = verdict(sameYear, id);
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    assert.equal(input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === id).originalText, sourceExcerpt);
    assert.notEqual(verdict(near, id).status, 'matched');
  }
  assert.match(formatFortuneFactAudit(input), /明刊定宫铃星同守/u);
  assert.doesNotMatch(formatFortunePrompt(input), /明刊定宫铃星同守|两颗流曜同时照命|fallenYangMingBellDoubleGuardCandidate/u);

  const h = archive.horoscope('1977-06-01', 6);
  const calcYang = (raw, minor = h.age.index) => quanshuYangTabooCondition(raw, h.yearly.index, h.yearly.index, 1977, 'yearly', h.decadal.index, minor);
  assert.equal(calcYang(natal, (h.age.index + 1) % 12).fallenYangMingBellDoubleGuardCandidate, undefined);
  const wrongLayer = structuredClone(natal), sheep = wrongLayer.palaces.find(row => row.earthlyBranch === '卯');
  sheep.adjectiveStars.push(...sheep.minorStars.splice(sheep.minorStars.findIndex(row => row.name === '擎羊'), 1));
  const uncheckedYang = calcYang(wrongLayer);
  assert.equal(uncheckedYang.fallenYangMingBellDoubleGuardCandidate, undefined);
  assert.equal(verdict({ ...sameYear, facts: [{ ...yang, normalizedPayload: uncheckedYang }] }, yangId).status, 'partial');

  const duplicate = structuredClone(natal), qisha = duplicate.palaces.find(row => row.earthlyBranch === '巳');
  qisha.minorStars.push({ ...qisha.majorStars.find(row => row.name === '七杀') });
  const uncheckedKiller = quanshuKillerEcho(duplicate, quanshuAnnualContext(duplicate, 1977, '丁'), '巳');
  assert.equal(uncheckedKiller.ready, false);
  assert.notEqual(verdict({ ...sameYear, facts: [{ ...killer, normalizedPayload: uncheckedKiller }] }, killerId).status, 'matched');
});

test('p036 binds Jielan Fire and birth Ji to fallen Yang and uses both actual limits', () => {
  const astrolabe = astro.withOptions({ dateStr: '1954-10-05', timeIndex: 8, gender: '男', fixLeap: true, config });
  const natal = astrolabe.toJSON();
  for (const year of [1971, 1970, 1972]) {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const now = Date.UTC(year, 5, 1), archive = { snapshotId: 'jielan-fallen-yang', chart: chart(natal) };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
    const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
    validateFortuneFacts(run);
    const fact = rows(run).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === year);
    assert.ok(fact);
    const data = fact.normalizedPayload;
    const onlyJielan = { ...data, fallenYangGuardShaCandidate: false, fallenYangOpposedShaCandidate: false,
      fallenYangMingFixedGuardCandidate: false, fallenYangMingFixedOpposedCandidate: false,
      fallenYangNatalJiCandidate: false, fallenYangRepeatAnnualCandidate: false };
    const isolated = { ...run, facts: [{ ...fact, normalizedPayload: onlyJielan }] };
    const result = match(isolated, 85);
    assert.equal(data.fallenYangJielanFireJiCandidate, year === 1971, year);
    assert.equal(result.status, year === 1971 ? 'partial' : 'not_matched', year);
    if (year !== 1971) continue;
    assert.deepEqual(data.fallenYangJielanFireJiWitness, { yangBranch: '卯', decadalBranch: '卯', minorBranch: '酉',
      fire: { star: '火星', branch: '酉', relation: '冲' },
      taboo: { stem: '甲', star: '太阳', branch: '酉', relation: '冲' },
      voids: [{ star: '古天空', branch: '卯', relation: '守' }, { star: '地劫', branch: '未', relation: '三合' }] });
    assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const wrong = { ...fact, normalizedPayload: { ...onlyJielan, jielanFireBellProfile: 'ming-fixed' } };
    assert.equal(match({ ...isolated, facts: [wrong] }, 85).status, 'not_matched');
    const { input } = buildFortuneModelContext(isolated, interpretFortune(isolated, requestForFortuneRun(isolated), 'jielan-yang'));
    assert.ok(!input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === result.knowledgeId));
    assert.match(formatFortuneFactAudit(input), /按《捷览》时位，火星在酉宫对冲卯宫的擎羊，太阳化忌在酉宫也对冲/u);
    assert.doesNotMatch(formatFortunePrompt(input), /按《捷览》时位|fallenYangJielanFireJiWitness/u);
  }
  const { yearly, decadal } = astrolabe.horoscope('1971-06-01');
  const missingMinor = quanshuYangTabooCondition(natal, yearly.index, yearly.index, 1971, 'yearly', decadal.index);
  assert.equal(missingMinor.fallenYangJielanFireJiCandidate, undefined);
});

test('p036 distinguishes birth Ji and repeated annual Yang using actual limits and the same Tai Sui palace', () => {
  const cases = [
    ['fallenNatalJiGuard', ['其他', '守'], '午', '卯', false, true, false],
    ['fallenNatalJiOpposed', ['邻宫', '冲'], '午', '午', false, true, false],
    ['fallenNatalJiOnlyTrine', ['邻宫', '三合'], '午', '午', false, false, false],
    ['fallenOnlyAnnualJi', ['其他', '守'], '申', '卯', false, false, false],
    ['fallenRepeatedAnnualYang', ['守', '其他'], '寅', '午', true, false, true],
    ['fallenRepeatedYangWithoutLimit', ['其他', '其他'], '卯', '午', true, false, false],
    ['fallenRepeatedYangWithoutTaiSui', ['冲', '守'], '卯', '午', false, false, false],
    ['fallenTaiSuiWithoutAnnualYang', ['守', '其他'], '卯', '子', false, false, false],
  ];
  const jiRelations = { 午: '守', 寅: '三合', 卯: '其他', 申: '其他' };
  for (const [name, limitContacts, jiBranch, annualYangBranch, atTaiSui, natalJi, repeated] of cases) {
    const { run, fact, data } = submittedBeijingBirth(name);
    assert.deepEqual([data.yangBranch, data.yangGrade], ['午', '陷'], name);
    assert.deepEqual([data.decadalYangRelation, data.minorYangRelation], limitContacts, name);
    assert.deepEqual([data.fallenYangGuardShaCandidate, data.fallenYangOpposedShaCandidate], [false, false], name);
    assert.deepEqual(data.fallenYangNatalJi, { stem: '戊', star: '天机', branch: jiBranch,
      relation: jiRelations[jiBranch] }, name);
    assert.deepEqual([data.fallenYangAnnualYang.branch, data.fallenYangAnnualYang.atTaiSui], [annualYangBranch, atTaiSui], name);
    assert.deepEqual([data.fallenYangNatalJiCandidate, data.fallenYangRepeatAnnualCandidate], [natalJi, repeated], name);
    if (name === 'fallenOnlyAnnualJi') {
      const transformations = run.facts.find(row => row.factType === 'quanshu_transform_limits'
        && row.normalizedPayload.lunarYear === data.lunarYear)?.normalizedPayload;
      const annualGroup = transformations?.seats.find(row => row.layer === 'minor')?.groups.find(row => row.layer === 'yearly');
      assert.deepEqual(annualGroup?.stars.find(row => row.kind === '忌'), { kind: '忌', star: '太阳', branch: '午', relation: '守' });
    }
    const result = match(run, 85);
    assert.equal(result.status, natalJi || repeated ? 'partial' : 'not_matched', name);
    if (natalJi || repeated) {
      assert.deepEqual(result.sourceFactIds, [fact.factId]);
      assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), name));
    const prompt = formatFortuneFactAudit(input);
    assert.equal(prompt.includes('生年干戊使天机化忌，与陷地擎羊同在午宫，同段小限' + (limitContacts[1] === '冲' ? '对冲此宫' : '实守此宫')), natalJi, name);
    assert.equal(prompt.includes('流年干戊所定的流年擎羊与本命陷地擎羊同在午宫，同段太岁与大限实守该宫'), repeated, name);
    assert.doesNotMatch(prompt, /fallenYangNatalJi|fallenYangRepeatAnnualCandidate/u);
  }
});

test('real Wei birth keeps the conflicting taboo columns and tomb birth candidate without declaring exemption or weakness',()=>{
 const p=condition('wei');assert.equal(p.birthBranchInTombsCandidate,true);assert.equal(p.yangBranch,'戌');assert.equal(p.birthTaboo.weiProseVerseConflict,true);assert.equal(p.birthTaboo.requiresTombYang,true);
 assert.equal(p.mainPositionsReady,true);assert.equal(p.lifeMajorStars[0].star,'七杀');assert.equal(p.lifeMajorStars[0].grade,'庙');assert.equal(p.wholeChartStrengthVerified,false);
});

test('birth taboo support, three Sha seats and a printed taboo witness must coincide within one annual fragment', () => {
 const seat = annual('tabooSeat'), pair = annual('tabooPair');
 assert.deepEqual(seat.data.yearSha.map(row => [row.scope, row.branch, row.stars]), [
   ['yearly', '巳', ['陀罗', '归档火星']], ['decadal', '子', ['归档铃星']], ['minor', '未', ['本命擎羊']],
 ]);
 assert.deepEqual(seat.data.matchingTabooSeats.map(row => [row.scope, row.branch]), [['yearly', '巳']]);
 assert.ok(seat.data.natalHelpers.some(row => row.star === '左辅' && row.labels.includes('身宫')));
 assert.equal(pair.data.matchingTabooSeats.length, 0);
 assert.deepEqual(pair.data.matchingTabooPairs.map(row => [row.firstScope, row.firstBranch, row.secondScope, row.secondBranch]),
   [['decadal', '子', 'minor', '午']]);
 for (const { run, fact } of [seat, pair]) {
   const result = match(run, 99);
   assert.equal(result.status, 'partial');
   assert.deepEqual(result.sourceFactIds, [fact.factId]);
   assert.ok(fact.sourceFactIds.length >= 2);
 }
 const lacksSha = annual('tabooWithoutThreeSha'), lacksTaboo = annual('threeShaWithoutTaboo');
 assert.ok(lacksSha.data.matchingTabooSeats.length > 0);
 assert.equal(lacksSha.data.yearSha.find(row => row.scope === 'decadal').present, false);
 assert.ok(lacksTaboo.data.yearSha.every(row => row.present));
 assert.equal(lacksTaboo.data.matchingTabooSeats.length + lacksTaboo.data.matchingTabooPairs.length, 0);
 for (const { run } of [lacksSha, lacksTaboo]) assert.equal(match(run, 99).status, 'not_matched');
 const { input } = buildFortuneModelContext(pair.run, interpretFortune(pair.run, requestForFortuneRun(pair.run), 'birth-taboo-contacts'));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /本段有原书列出的子午对冲支组/u);
 assert.doesNotMatch(prompt, /birthTabooWithThreeShaCandidate|matchingTabooPairs/u);
 assert.ok(!input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === fortuneKnowledge.ziwei.rules[99].knowledgeId));
});

test('a listed weak palace and a known fallen major are separate limit branches, each requiring supported strong geometry', () => {
 const palace = annual('weakPalaceOnly'), grade = annual('fallenMajorOnly');
 assert.deepEqual([palace.data.strongPalaceWeakLimitCandidate, palace.data.strongPalaceFallenLimitCandidate], [true, false]);
 assert.deepEqual([grade.data.strongPalaceWeakLimitCandidate, grade.data.strongPalaceFallenLimitCandidate], [false, true]);
 assert.equal(palace.data.palaceTable, 'femaleTable');
 assert.ok(palace.data.supportedStrongPalaces.some(row => row.palace === '财帛' && row.lifeRelation === '三合'));
 assert.deepEqual(grade.data.weakLimits.find(row => row.scope === 'decadal').fallenMajors, ['破军']);
 assert.equal(grade.data.weakLimits.find(row => row.scope === 'decadal').palaceGrade, '强宫');
 for (const { run, fact } of [palace, grade]) {
   const result = match(run, 100);
   assert.equal(result.status, 'partial');
   assert.deepEqual(result.sourceFactIds, [fact.factId]);
 }
 const unlisted = annual('weakUnlisted');
 assert.equal(unlisted.data.palaceTable, 'maleTable');
 assert.ok(unlisted.data.weakLimits.some(row => row.palace === '命宫' && row.weakPalace === undefined));
 assert.equal(match(unlisted.run, 100).status, 'unknown');
 const { input } = buildFortuneModelContext(grade.run, interpretFortune(grade.run, requestForFortuneRun(grade.run), 'weaker-limit'));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /财帛在未宫，守宫有魁钺组，在卷二女盘表列为强宫，与命宫为三合/u);
 assert.match(prompt, /大限在酉宫，卷三星表在该宫列陷的主曜为破军/u);
 assert.doesNotMatch(prompt, /strongPalaceFallenLimitCandidate|maleTable|femaleTable/u);

 const archive = native('fallenMajorOnly'), year = ref.cases.fallenMajorOnly.year;
 const h = archive.horoscope(year + '-06-01', 6);
 const calculate = natal => quanshuYangTabooCondition(natal, h.yearly.index, h.yearly.index, year, 'yearly', h.decadal.index, h.age.index);
 const shifted = archive.toJSON();
 const wrong = shifted.palaces.find(row => row.index === h.decadal.index);
 wrong.decadal.range = wrong.decadal.range.map(value => value + 1);
 const falseDecade = calculate(shifted);
 assert.deepEqual(falseDecade.yangNetVerifiedAxes.sourceDecadal, { branch: '酉', verified: false });
 assert.equal(falseDecade.weakLimits.find(row => row.scope === 'decadal').branch, undefined);
 assert.equal(falseDecade.weakLimits.find(row => row.scope === 'minor').branch,
   grade.data.weakLimits.find(row => row.scope === 'minor').branch);
 assert.equal(falseDecade.strongPalaceFallenLimitCandidate, undefined);
 const wrongLayer = archive.toJSON(), host = wrongLayer.palaces.find(row => row.majorStars.some(star => star.name === '破军'));
 const [po] = host.majorStars.splice(host.majorStars.findIndex(star => star.name === '破军'), 1);
 host.minorStars.push(po);
 const falseFallen = calculate(wrongLayer);
 assert.equal(falseFallen.weakLimits.find(row => row.scope === 'decadal').hasFallenMajor, undefined);
 assert.ok(falseFallen.supportedStrongPalaces.length);
 const { weakLimitPlacementProof, ...legacy } = grade.data;
 assert.equal(weakLimitPlacementProof, 'quanshu-weak-limit-actual-seats-and-star-layers-v1');
 for (const normalizedPayload of [falseDecade, falseFallen, legacy]) {
   assert.equal(match({ ...grade.run, facts: [{ ...grade.fact, normalizedPayload }] }, 100).status, 'unknown');
 }
});

test('p050 uses each birth year’s named stars at their actual active seats and keeps both fire and bell necessary', () => {
 const samples = [
  ['tabooWuSevenKill', [['七杀', '丑', ['minor']]]],
  ['tabooWeiTombYang', [['擎羊', '戌', ['yearly', 'minor']]]],
  ['tabooShenFireBell', [['铃星', '亥', ['decadal']], ['火星', '卯', ['yearly', 'minor']]]],
  ['tabooYouYangTuo', [['擎羊', '丑', ['yearly']], ['陀罗', '亥', ['minor']]]],
  ['tabooXuYangTuo', [['擎羊', '卯', ['yearly']], ['陀罗', '丑', ['decadal']]]],
  ['tabooHaiYangTuo', [['擎羊', '辰', ['decadal']], ['陀罗', '寅', ['minor']]]],
 ];
 for (const [name, expected] of samples) {
  const { run, fact, data } = annual(name);
  assert.equal(data.birthTabooWithThreeShaCandidate, false, name);
  assert.equal(data.namedTabooWithThreeShaCandidate, true, name);
  assert.deepEqual(data.namedTabooGuards.filter(row => row.guarded).map(row => [row.star, row.branch, row.scopes]), expected);
  const result = match(run, 99);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.sourceFactIds, [fact.factId]);
 }
 const onlyFire = annual('tabooShenFireOnly');
 assert.ok(onlyFire.data.yearSha.every(row => row.present));
 assert.deepEqual(onlyFire.data.namedTabooGuards.map(row => [row.star, row.guarded]), [['铃星', false], ['火星', true]]);
 assert.equal(match(onlyFire.run, 99).status, 'not_matched');

 const named = annual('tabooShenFireBell');
 const archive = native('tabooShenFireBell'), natal = archive.toJSON(), year = ref.cases.tabooShenFireBell.year;
 const h = archive.horoscope(year + '-11-19', 6);
 const wrongDecadalRange = structuredClone(natal), decadalPalace = wrongDecadalRange.palaces.find(row => row.index === h.decadal.index);
 decadalPalace.decadal.range = decadalPalace.decadal.range.map(age => age + 1);
 const mismatchedLimits = [
  quanshuYangTabooCondition(wrongDecadalRange, h.yearly.index, h.yearly.index, year, 'yearly', h.decadal.index, h.age.index),
  quanshuYangTabooCondition(natal, h.yearly.index, h.yearly.index, year, 'yearly', (h.decadal.index + 1) % 12, h.age.index),
  quanshuYangTabooCondition(natal, h.yearly.index, h.yearly.index, year, 'yearly', undefined, h.age.index),
 ];
 assert.deepEqual(mismatchedLimits.map(row => row.yangNetVerifiedAxes.sourceDecadal?.verified), [false, false, undefined]);
 for (const data of mismatchedLimits) {
  assert.equal(data.namedTabooWithThreeShaCandidate, undefined);
  assert.deepEqual(data.yearSha.map(row => [row.scope, row.branch, row.present]), [
   ['yearly', '卯', true], ['decadal', undefined, undefined], ['minor', '卯', true],
  ]);
  assert.deepEqual(data.namedTabooGuards.map(row => [row.star, row.scopes, row.guarded]), [
   ['铃星', [], undefined], ['火星', ['yearly', 'minor'], true],
  ]);
  assert.equal(match({ ...named.run, facts: [{ ...named.fact, normalizedPayload: data }] }, 99).status, 'unknown');
 }
 for (const palace of natal.palaces) palace.minorStars = palace.minorStars.filter(row => row.name !== '铃星');
 const missing = quanshuYangTabooCondition(natal, h.yearly.index, h.yearly.index, year, 'yearly', h.decadal.index, h.age.index);
 assert.equal(missing.namedTabooWithThreeShaCandidate, undefined);
 assert.equal(missing.namedTabooGuards.find(row => row.star === '铃星').guarded, undefined);
 const { input } = buildFortuneModelContext(named.run, interpretFortune(named.run, requestForFortuneRun(named.run), 'named-taboo'));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /卷三该生年点名的归档铃星在亥宫，实守大限/u);
 assert.match(prompt, /原书生时法未核/u);
 assert.doesNotMatch(prompt, /namedTabooWithThreeShaCandidate|product-hour/u);
 assert.ok(!input.sections.flatMap(section => section.findings).some(finding => finding.knowledgeId === match(named.run, 99).knowledgeId));
});

test('p050 checks both Ming fire and bell on the actual three Sha seats of a Shen birth', () => {
 const a = astro.withOptions({ dateStr: '1980-03-11', timeIndex: 3, gender: '男', fixLeap: true, config });
 const natal = a.toJSON();
 const submitted = year => {
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const now = Date.UTC(year, 5, 1), archive = { snapshotId: 'ming-shen-taboo', chart: chart(natal) };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'ming-shen-taboo', archive);
  validateFortuneFacts(run);
  const fact = rows(run).find(f => f.scope === 'yearly' && f.normalizedPayload.lunarYear === year);
  assert.ok(fact);
  return { fact, run: { ...run, facts: run.facts.filter(f => f.factType !== fact.factType || f.factId === fact.factId) } };
 };
 const { fact, run } = submitted(2016), data = fact.normalizedPayload;
 assert.equal(data.birthTabooWithThreeShaCandidate, false);
 assert.equal(data.namedTabooWithThreeShaCandidate, false);
 assert.equal(data.namedMingFixedFireBellTabooCandidate, true);
 assert.equal(data.namedShenTabooAtVerifiedThreeScopes, true);
 assert.deepEqual(data.mingNamedTabooGuards.map(row => [row.star, row.branch, row.scopes]),
  [['火星', '寅', ['decadal']], ['铃星', '戌', ['minor']]]);
 assert.deepEqual(data.mingNamedTabooYearSha.map(row => [row.scope, row.branch, row.stars]),
  [['yearly', '申', ['古天空']], ['decadal', '寅', ['地劫', '火星']], ['minor', '戌', ['铃星']]]);
 const result = match(run, 99);
 assert.equal(result.status, 'matched');
 assert.equal(result.matchedSourceExcerpt, '太岁二限有凶，又且本生人所忌');
 assert.deepEqual(result.sourceFactIds, [fact.factId]);
 assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
 const wrongProfile = structuredClone(run);
 rows(wrongProfile)[0].normalizedPayload.quanshuFixedFireBellProfile = 'archive-position';
 assert.equal(match(wrongProfile, 99).status, 'not_matched');

 const near = submitted(2017);
 assert.equal(near.fact.normalizedPayload.namedMingFixedFireBellTabooCandidate, false);
 assert.equal(match(near.run, 99).status, 'not_matched');
 const f = a.horoscope('2016-07-01', 6);
 const shifted = quanshuYangTabooCondition(natal, f.yearly.index, f.yearly.index, 2016, 'yearly', f.decadal.index, (f.age.index + 1) % 12);
 assert.equal(shifted.namedMingFixedFireBellTabooCandidate, undefined);
 assert.equal(shifted.namedShenTabooAtVerifiedThreeScopes, undefined);
 const wrongDecade = structuredClone(natal);
 const decadal = wrongDecade.palaces.find(row => row.index === f.decadal.index);
 decadal.decadal.range = decadal.decadal.range.map(value => value + 1);
 const wrongRange = quanshuYangTabooCondition(wrongDecade, f.yearly.index, f.yearly.index, 2016, 'yearly', f.decadal.index, f.age.index);
 assert.equal(wrongRange.yangNetVerifiedAxes.sourceDecadal.verified, false);
 assert.equal(wrongRange.namedMingFixedFireBellTabooCandidate, undefined);
 assert.equal(wrongRange.namedShenTabooAtVerifiedThreeScopes, undefined);
 assert.equal(wrongRange.mingNamedTabooYearSha.find(row => row.scope === 'decadal').branch, undefined);
 const candidateRun = { ...run, facts: run.facts.map(row => row.factId === fact.factId ? { ...fact, normalizedPayload: wrongRange } : row) };
 assert.equal(match(candidateRun, 99).status, 'unknown');
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'ming-shen-taboo'));
 assert.ok(input.sections.flatMap(section => section.findings).some(row => row.knowledgeId === result.knowledgeId));
 const audit = formatFortuneFactAudit(input);
 assert.match(audit, /申年本生忌按明刊定宫核火星在寅宫，由大限实守/u);
 assert.match(audit, /申年本生忌按明刊定宫核铃星在戌宫，由小限实守/u);
 const prompt = formatFortunePrompt(input);
 assert.match(prompt, /太岁二限有凶，又且本生人所忌/u);
 assert.doesNotMatch(prompt, /申年本生忌按明刊定宫核|namedShenTabooAtVerifiedThreeScopes|又且本生人所忌方凶/u);
});

test('p051 separately accepts explicitly dignified support contacting Life and an actual weak or fallen limit', () => {
 const weak = annual('dignityWeakWithoutNamedStrongPalace'), fallen = annual('dignityFallenOutsideNamedStrongPalace');
 for (const { run, fact, data } of [weak, fallen]) {
  assert.equal(data.strongPalaceWeakLimitCandidate, false);
  assert.equal(data.strongPalaceFallenLimitCandidate, false);
  assert.ok(data.strongDignitySupports.length);
  assert.ok(data.strongDignitySupports.every(row => ['庙', '旺'].includes(row.grade) && ['守', '冲', '三合'].includes(row.lifeRelation)));
  const result = match(run, 100);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.sourceFactIds, [fact.factId]);
 }
 assert.equal(weak.data.strongDignityWeakLimitCandidate, true);
 assert.notEqual(weak.data.strongDignityFallenLimitCandidate, true);
 assert.equal(fallen.data.strongDignityWeakLimitCandidate, false);
 assert.equal(fallen.data.strongDignityFallenLimitCandidate, true);
 assert.ok(fallen.data.weakLimits.some(row => row.scope === 'decadal' && row.branch === '卯' && row.fallenMajors.includes('破军')));
 const unsupported = annual('weakWithoutEitherStrongSupport');
 assert.ok(unsupported.data.weakLimits.some(row => row.weakPalace));
 assert.deepEqual(unsupported.data.strongDignitySupports, []);
 assert.equal(match(unsupported.run, 100).status, 'not_matched');
 const { input } = buildFortuneModelContext(fallen.run, interpretFortune(fallen.run, requestForFortuneRun(fallen.run), 'dignified-help'));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /文昌在丑宫，卷三星表列为庙，与命宫为守/u);
 assert.match(prompt, /大限在卯宫，卷三星表在该宫列陷的主曜为破军/u);
 assert.doesNotMatch(prompt, /strongDignityFallenLimitCandidate/u);
 const archive = native('dignityFallenOutsideNamedStrongPalace');
 const h = archive.horoscope('2020-06-01', 6), natal = archive.toJSON();
 const seat = natal.palaces.find(row => row.earthlyBranch === '丑');
 const [chang] = seat.minorStars.splice(seat.minorStars.findIndex(star => star.name === '文昌'), 1);
 seat.adjectiveStars.push(chang);
 const unverified = quanshuYangTabooCondition(natal, h.yearly.index, h.yearly.index, 2020, 'yearly', h.decadal.index, h.age.index);
 assert.equal(unverified.weakLimits.find(row => row.scope === 'decadal').hasFallenMajor, true);
 assert.ok(unverified.strongDignitySupports.every(row => row.star !== '文昌'));
 assert.equal(unverified.strongDignityFallenLimitCandidate, true);
 assert.equal(match({ ...fallen.run, facts: [{ ...fallen.fact, normalizedPayload: unverified }] }, 100).status, 'partial');
 for (const { star, branch } of unverified.strongDignitySupports) {
   const wrongHost = natal.palaces.find(row => row.earthlyBranch === branch);
   const layer = ['文昌', '文曲'].includes(star) ? 'minorStars' : 'majorStars';
   const [misplaced] = wrongHost[layer].splice(wrongHost[layer].findIndex(row => row.name === star), 1);
   wrongHost.adjectiveStars.push(misplaced);
 }
 const incomplete = quanshuYangTabooCondition(natal, h.yearly.index, h.yearly.index, 2020, 'yearly', h.decadal.index, h.age.index);
 assert.deepEqual(incomplete.strongDignitySupports, []);
 assert.equal(incomplete.strongDignityFallenLimitCandidate, undefined);
 assert.equal(match({ ...fallen.run, facts: [{ ...fallen.fact, normalizedPayload: incomplete }] }, 100).status, 'unknown');
});

test('p051 confirms a Ming strong migration palace and a distinctly listed weak limit in the same real period', () => {
 const name = 'mingStrongMigrationAndWeakLimit';
 const { run, fact, data } = submittedBeijingBirth(name);
 assert.equal(data.weakLimitNatalPalaceNameProof, 'quanshu-natal-palace-name-order-v1');
 assert.equal(data.strongMigrationWithFallenWeakLimit, true);
 assert.deepEqual(data.supportedStrongPalaces.filter(row => row.palace === '迁移').map(row => [row.star, row.branch, row.lifeRelation]),
   [['紫微', '亥', '冲'], ['左辅', '亥', '冲']]);
 assert.ok(data.weakLimits.some(row => row.scope === 'minor' && row.branch === '午' && row.weakPalace && row.fallenMajors.includes('天同')));
 const hit = match(run, 100);
 assert.equal(hit.status, 'matched');
 const stale = { ...fact, normalizedPayload: { ...data, weakLimitNatalPalaceNameProof: undefined } };
 assert.equal(match({ ...run, facts: [stale] }, 100).status, 'unknown');
 assert.deepEqual(hit.sourceFactIds, [fact.factId]);
 assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
 const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), name));
 assert.match(formatFortunePrompt(input), /明确称迁移为强宫且要求吉曜相佐/u);
 assert.doesNotMatch(formatFortunePrompt(input), /strongMigrationWithFallenWeakLimit/u);
 const archive = native(name), h = archive.horoscope('2020-06-01', 6), natal = archive.toJSON();
 const migration = natal.palaces.find(row => row.name === '迁移');
 const [assistant] = migration.minorStars.splice(migration.minorStars.findIndex(row => row.name === '左辅'), 1);
 migration.adjectiveStars.push(assistant);
 const altered = quanshuYangTabooCondition(natal, h.yearly.index, h.yearly.index, 2020, 'yearly', h.decadal.index, h.age.index);
 assert.equal(altered.strongMigrationWithFallenWeakLimit, undefined);
 assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: altered }] }, 100).status, 'partial');

 const year = 2023, now = Date.UTC(year, 5, 1), original = archive.toJSON();
 const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
 const ref = { snapshotId: name + '-neighbor', chart: chart(original) };
 const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, ref)));
 const yearRun = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), ref.snapshotId, ref);
 const realFact = rows(yearRun).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === year);
 const valid = realFact.normalizedPayload, limit = p => p.weakLimits.find(row => row.scope === 'minor');
 assert.deepEqual(limit(valid), { scope: 'minor', branch: '酉', palace: '官禄', palaceGrade: '强宫',
   weakPalace: false, fallenMajors: ['天相'], hasFallenMajor: true });
 assert.equal(valid.strongMigrationWithFallenWeakLimit, false);
 assert.equal(match({ ...yearRun, facts: [realFact] }, 100).status, 'partial');

 const swapped = structuredClone(original);
 const career = swapped.palaces.find(row => row.earthlyBranch === '酉');
 const father = swapped.palaces.find(row => row.earthlyBranch === '午');
 [career.name, father.name] = [father.name, career.name];
 const yearPositions = archive.horoscope(`${year}-06-01`, 6);
 const unverified = quanshuYangTabooCondition(swapped, yearPositions.yearly.index, yearPositions.yearly.index,
   year, 'yearly', yearPositions.decadal.index, yearPositions.age.index);
 assert.equal(unverified.natalLifeBranch, valid.natalLifeBranch);
 assert.deepEqual(unverified.yangNetVerifiedAxes, valid.yangNetVerifiedAxes);
 assert.deepEqual(limit(unverified), { scope: 'minor', branch: '酉', palace: undefined, palaceGrade: undefined,
   weakPalace: undefined, fallenMajors: ['天相'], hasFallenMajor: true });
 assert.equal(unverified.strongMigrationWithFallenWeakLimit, undefined);
 assert.equal(match({ ...yearRun, facts: [{ ...realFact, normalizedPayload: unverified }] }, 100).status, 'partial');
});

test('p051 confirms the source career Ziwei and Tianfu pair with a fallen weak actual limit', () => {
 const engine = astro.withOptions({ dateStr: '1961-07-15', timeIndex: 9, gender: '男', fixLeap: true, config });
 const natal = engine.toJSON(), field = 'strongCareerZiFuWithFallenWeakLimit';
 for (const year of [1981, 1982]) {
   const targetPeriod = { year }, params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod };
   const now = Date.UTC(year, 5, 1), archive = { snapshotId: 'strong-career-zi-fu', chart: chart(natal) };
   const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, archive)));
   const bound = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), archive.snapshotId, archive);
   validateFortuneFacts(bound);
   const fact = rows(bound).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === year);
   assert.ok(fact);
   const p = fact.normalizedPayload, positive = year === 1981;
   assert.equal(p.natalLifeBranch, '戌');
   assert.deepEqual(p.supportedStrongPalaces.filter(row => row.palace === '官禄' && ['紫微', '天府'].includes(row.star)),
     [{ star: '紫微', branch: '寅', palace: '官禄', lifeRelation: '三合' },
       { star: '天府', branch: '寅', palace: '官禄', lifeRelation: '三合' }]);
   assert.equal(p.strongMigrationWithFallenWeakLimit, false);
   assert.equal(p[field] === true, positive);
   const run = { ...bound, facts: [fact] }, hit = match(run, 100);
   assert.equal(hit.status, positive ? 'matched' : 'partial');
   if (!positive) continue;
   assert.deepEqual(p.weakLimits.find(row => row.scope === 'minor'),
     { scope: 'minor', branch: '卯', palace: '仆役', palaceGrade: '弱宫', weakPalace: true,
       fallenMajors: ['太阴'], hasFallenMajor: true });
   assert.equal(hit.matchedSourceExcerpt, '行限逢乎弱地未必為災');
   assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
   const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), archive.snapshotId));
   assert.match(formatFortunePrompt(input), /行限逢乎弱地未必為災/u);
   assert.doesNotMatch(formatFortunePrompt(input), /寅宫|卯宫|strongCareerZiFuWithFallenWeakLimit/u);

   const h = engine.horoscope(year + '-06-01', 6), broken = structuredClone(natal);
   broken.rawDates.lunarDate.lunarDay += 1;
   const data = quanshuYangTabooCondition(broken, h.yearly.index, h.yearly.index, year, 'yearly', h.decadal.index, h.age.index);
   assert.equal(data[field], undefined);
   assert.notEqual(match({ ...run, facts: [{ ...fact, normalizedPayload: data }] }, 100).status, 'matched');
 }
});

test('p050 uses explicit You, Xu and Chen birth limits independently of annual and named-pair routes', () => {
 for (const [name, birth, year, scope, branch] of [
  ['tabooYouExplicitMinor', '酉', '丑', 'minor', '卯'],
  ['tabooXuExplicitDecadal', '戌', '子', 'decadal', '戌'],
  ['tabooChenExplicitXuDecadal', '辰', '卯', 'decadal', '戌'],
 ]) {
  const { run, fact, data } = annual(name);
  assert.equal(data.birthYearBranch, birth);
  assert.equal(data.annualBranch, year);
  assert.equal(data.namedTabooWithThreeShaCandidate, false);
  assert.deepEqual(data.matchingTabooSeats.map(row => [row.scope, row.branch, row.explicitLimitCandidate]), [[scope, branch, true]]);
  if (birth === '辰') assert.equal(data.matchingTabooSeats[0].verseCandidate, false);
  assert.ok(data.yearSha.every(row => row.present));
  const result = match(run, 99);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.sourceFactIds, [fact.factId]);
 }
});

test('p050 matches three actual Sha seats with independently known natal lights and birth-stem helpers', () => {
 const cases = [
  ['tabooNatalTransformation', '2013-02-09T16:00:00.000Z', false, [{ star: '天梁', transformation: '科', branch: '巳', labels: ['命宫', '身宫'] }],
   /巳宫，守宫有本命天梁，由生年干化科/u],
  ['tabooNatalLuAndTransformations', '2003-01-31T16:00:00.000Z', false, [{ star: '禄存', branch: '午', labels: ['命宫'] },
   { star: '武曲', transformation: '禄', branch: '辰', labels: ['身宫'] }, { star: '贪狼', transformation: '权', branch: '戌', labels: ['官禄'] }],
   /命宫在午宫，守宫有本命禄存.*身宫在辰宫，守宫有本命武曲，由生年干化禄.*官禄在戌宫，守宫有本命贪狼，由生年干化权/us],
  ['tabooNatalLuOnly', '2012-01-22T16:00:00.000Z', true, [{ star: '禄存', branch: '申', labels: ['身宫'] }],
   /身宫在申宫，守宫有本命禄存/u],
  ['tabooNatalSun', '2007-02-17T16:00:00.000Z', false, [{ star: '太阳', branch: '午', labels: ['官禄'] }],
   /官禄在午宫，守宫有本命太阳/u],
 ];
 for (const [name, start, namedMatch, helpers, wording] of cases) {
  const { run, fact, data } = submittedAnnual(name);
  assert.deepEqual(data.natalHelpers, [], name);
  assert.deepEqual(data.natalAdditionalHelpers, helpers, name);
  assert.equal(data.natalSupport, true, name);
  assert.ok(data.yearSha.every(row => row.present), name);
  assert.equal(data.birthTabooWithThreeShaCandidate, true, name);
  assert.equal(data.namedTabooWithThreeShaCandidate, namedMatch, name);
  assert.equal(fact.activeFrom, start, name);
  const result = match(run, 99);
  assert.equal(result.status, 'partial', name);
  assert.deepEqual(result.sourceFactIds, [fact.factId], name);
  assert.deepEqual(result.windows, [{ start, endExclusive: fact.activeTo }], name);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), name));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, wording, name);
  assert.doesNotMatch(prompt, /natalAdditionalHelpers|birthTabooWithThreeShaCandidate/u);
 }
});

test('p050 assigns Chen birth taboos to the actual annual or limit layer', () => {
 const xu = submittedAnnual('tabooChenXuAnnual'), chen = submittedAnnual('tabooChenChenAnnual');
 assert.deepEqual(xu.data.matchingTabooSeats.map(row => [row.scope, row.branch]), [['minor', '辰']]);
 assert.deepEqual(chen.data.matchingTabooSeats.map(row => [row.scope, row.branch]), [['yearly', '辰'], ['minor', '戌']]);
 assert.equal(xu.data.scopeRelations.find(row => row.scope === 'yearly').explicitAnnualCandidate, false);
 assert.equal(chen.data.scopeRelations.find(row => row.scope === 'yearly').explicitAnnualCandidate, true);
 for (const { run, fact, data } of [xu, chen]) {
  assert.ok(data.yearSha.every(row => row.present));
  const result = match(run, 99);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.sourceFactIds, [fact.factId]);
 }
 const archive = native('tabooChenXuAnnual'), natal = archive.toJSON(), h = archive.horoscope('2006-06-01', 6);
 const missingMinor = quanshuYangTabooCondition(natal, h.yearly.index, h.yearly.index, 2006, 'yearly', h.decadal.index);
 assert.equal(missingMinor.annualBranch, '戌');
 assert.deepEqual(missingMinor.matchingTabooSeats, []);
 assert.equal(missingMinor.birthTabooWithThreeShaCandidate, undefined);
 const chenArchive = native('tabooChenChenAnnual'), chenNatal = chenArchive.toJSON(), chenFrame = chenArchive.horoscope('2012-06-01', 6);
 const wrongDecade = quanshuYangTabooCondition(chenNatal, chenFrame.yearly.index, chenFrame.yearly.index, 2012,
  'yearly', (chenFrame.decadal.index + 1) % 12, chenFrame.age.index);
 assert.equal(wrongDecade.birthTabooWithThreeShaCandidate, undefined);
 assert.deepEqual(wrongDecade.matchingTabooSeats.map(row => [row.scope, row.branch]), [['yearly', '辰'], ['minor', '戌']]);
 assert.ok(wrongDecade.matchingTabooPairs.every(row => row.firstScope !== 'decadal' && row.secondScope !== 'decadal'));
 assert.equal(match({ ...chen.run, facts: [{ ...chen.fact, normalizedPayload: wrongDecade }] }, 99).status, 'unknown');
 const { input } = buildFortuneModelContext(xu.run, interpretFortune(xu.run, requestForFortuneRun(xu.run), 'taboo-chen-scope'));
 const prompt = formatFortuneFactAudit(input);
 assert.match(prompt, /小限所在辰宫符合注文明确的本生忌限支/u);
 assert.doesNotMatch(prompt, /太岁所在戌宫符合/u);
});

test('Chen birth taboos and weak-palace evidence reject a misplaced minor in the same natal chart', () => {
 const archive = native('tabooChenXuAnnual'), natal = archive.toJSON();
 const index = branch => natal.palaces.find(row => row.earthlyBranch === branch).index;
 for (const [year, wrongBranch, expectedBranch, rule, candidate] of [
   [2002, '辰', '申', 99, 'birthTabooWithThreeShaCandidate'],
   [2011, '寅', '亥', 100, 'strongPalaceWeakLimitCandidate'],
 ]) {
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const run = calculateFortuneFacts(params, buildFactTimeContext(params, Date.UTC(year, 5, 1), 'server'),
    'yang-taboo-verified-minor', { snapshotId: 'yang-taboo-verified-minor', chart: chart(natal) });
  const fact = rows(run).find(row => row.scope === 'yearly' && row.normalizedPayload.lunarYear === year);
  assert.ok(fact);
  assert.equal(fact.normalizedPayload[candidate], false);
  assert.equal(fact.normalizedPayload.yangNetVerifiedAxes.minorBranch, expectedBranch);
  const h = archive.horoscope(year + '-06-01', 6);
  const data = quanshuYangTabooCondition(natal, h.yearly.index, h.yearly.index, year, 'yearly', h.decadal.index, index(wrongBranch));
  const raw = data.scopeRelations.find(row => row.scope === 'minor');
  assert.equal(raw.branch, wrongBranch);
  assert.equal(data.yangNetVerifiedAxes.minorBranch, undefined);
  assert.equal(data[candidate], undefined);
  if (rule === 99) {
    assert.equal(raw.explicitLimitCandidate, true);
    assert.ok(data.yearSha.filter(row => row.scope !== 'minor').every(row => row.present));
    assert.equal(data.yearSha.find(row => row.scope === 'minor').present, undefined);
    assert.ok(data.matchingTabooSeats.every(row => row.scope !== 'minor'));
  } else {
    assert.equal(quanshuPalaceNameGroups(raw.natalName).femaleTable, '弱宫');
    assert.ok(data.supportedStrongPalaces.length);
    assert.equal(data.weakLimits.find(row => row.scope === 'minor').weakPalace, undefined);
  }
  assert.equal(match({ ...run, facts: [{ ...fact, normalizedPayload: data }] }, rule).status, 'unknown');
 }

 const year = 1998, h = archive.horoscope(year + '-06-01', 6);
 const independent = quanshuYangTabooCondition(natal, h.yearly.index, h.yearly.index, year, 'yearly', h.decadal.index);
 assert.equal(independent.weakLimits.find(row => row.scope === 'decadal').weakPalace, true);
 assert.equal(independent.strongPalaceWeakLimitCandidate, true);
});

test('known empty life palace is not weak and a source-unlisted Wuqu grade remains unknown despite a present unique star',()=>{
 const empty=condition('fallen');assert.equal(empty.mainPositionsReady,true);assert.deepEqual(empty.lifeMajorStars,[]);
 const p=condition(),wu=p.lifeMajorStars.find(s=>s.star==='武曲');assert.ok(wu);assert.equal(wu.branch,'卯');assert.equal(wu.grade,undefined);
 const d=describeFortuneFact({method:'ziwei',type:'quanshu_yang_taboo_context',data:empty},String);assert.match(d,/没有十四主曜成员，不能因此判弱命/u);
});

test('missing or duplicate main stars and inconsistent body position remain unknown while verified source Yang is kept separate',()=>{
 for(const star of ['紫微','武曲'])for(const duplicate of [false,true]){
  const p=condition('opposite',n=>{const palace=n.palaces.find(p=>all(p).some(s=>s.name===star));if(duplicate)palace.majorStars.push({...palace.majorStars.find(s=>s.name===star)});else palace.majorStars=palace.majorStars.filter(s=>s.name!==star);return n;});
  assert.equal(p.ready,true);assert.equal(p.mainPositionsReady,undefined);assert.equal(p.lifeMajorStars,undefined);assert.equal(p.yangBranch,'辰');
 }
 const p=condition('opposite',n=>{n.earthlyBranchOfBodyPalace='子';return n;});assert.equal(p.ready,true);assert.equal(p.mainPositionsReady,undefined);
 const a=astro.withOptions({dateStr:'1992-11-05',timeIndex:2,gender:'女',fixLeap:true,config}),n=a.toJSON(),h=a.horoscope('2026-11-19');
 n.palaces.forEach(p=>{p.minorStars=p.minorStars.filter(s=>s.name!=='铃星');});
 const missingBell=quanshuYangTabooCondition(n,h.age.index,h.yearly.index,2026,'minor',h.decadal.index,h.age.index);
 assert.equal(missingBell.ready,true);assert.equal(missingBell.birthYearBranch,'申');assert.equal(missingBell.allListedTabooStarsPositioned,undefined);
 const text=describeFortuneFact({method:'ziwei',type:'quanshu_yang_taboo_context',data:missingBell},String);assert.match(text,/点名候选为铃星、火星/u);assert.match(text,/部分点名星的位置未核/u);
});

test('wrong-year or mismatched annual and requested limit geometry, shifted Yang and pre-birth years cannot construct ready source facts',()=>{
 const n=native().toJSON(),year=2022,index=n.palaces.find(p=>p.earthlyBranch==='寅').index;
 assert.equal(quanshuYangTabooCondition(n,index,index,2023,'yearly').ready,false);assert.equal(quanshuYangTabooCondition(n,index,index,2022,'minor').ready,false);
 assert.equal(quanshuYangTabooCondition(n,index,index,2022,'yearly',99).ready,false);
 assert.equal(quanshuYangTabooCondition(n,index,index,1986,'yearly').ready,false);
 const shifted=structuredClone(n),from=shifted.palaces.find(p=>p.minorStars.some(s=>s.name==='擎羊')),star=from.minorStars.find(s=>s.name==='擎羊');from.minorStars=from.minorStars.filter(s=>s.name!=='擎羊');shifted.palaces.find(p=>p.earthlyBranch==='子').minorStars.push(star);assert.equal(quanshuYangTabooCondition(shifted,index,index,year,'yearly').ready,false);
});

test('real writer binds one birth frame and actual year with both limits, exact opposite pairs and source provenance',()=>{
 for(const name of ['opposite','wei','fallen']){const run=real(name);validateFortuneFacts(run);assert.notEqual(run.methods.ziwei.status,'failed');assert.ok(rows(run).length);
  for(const row of rows(run)){const p=row.normalizedPayload,source=run.rawFacts.find(raw=>row.sourceFactIds.includes(raw.rawFactId)&&raw.payload.policy?.profile===quanshuYangTabooPolicy.profile);
   assert.ok(source);assert.equal(source.payload.interval.year.lunarYear,p.lunarYear);assert.equal(p.scope,row.scope);assert.ok(p.scopeRelations.some(s=>s.scope===row.scope&&s.branch===p.branch));
   assert.ok(row.sourceFactIds.length>=2&&row.sourceFactIds.every(id=>run.rawFacts.some(raw=>raw.rawFactId===id)));
   for(const pair of p.scopePairCandidates){const a=branches.indexOf(pair.firstBranch),b=branches.indexOf(pair.secondBranch);assert.equal(pair.opposite,(b-a+12)%12===6);}
  }
 }
});

test('all four SQLite source hashes survive import, generic and wrong-profile records fail and missing whole-frame evidence is unknown',()=>{
 for (const i of [84, 85, 99, 100]) {
  const rule = fortuneKnowledge.ziwei.rules[i];
  const entry = fortuneKnowledge.ziwei.entries.find(row => row.id === rule.knowledgeId);
  const sourceHash = createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex');
  assert.equal(rule.review.sourceHash, sourceHash);
  assert.equal(rule.unresolved.length > 0, i !== 84);
  assert.equal(rule.queries[0].factType, 'quanshu_yang_taboo_context');
 }
 const scenario=annual('tabooSeat').run;
 const missing=structuredClone(scenario);rows(missing).forEach(f=>{delete f.normalizedPayload.birthTabooWithThreeShaCandidate;});
 assert.ok(rows(missing).some(f=>f.normalizedPayload.mainPositionsReady===true));assert.equal(match(missing,99).status,'unknown');
 const absent={...scenario,facts:scenario.facts.filter(f=>f.factType!=='quanshu_yang_taboo_context')};assert.equal(match(absent,99).status,'unknown');
 const wrong=structuredClone(scenario);rows(wrong).forEach(f=>f.normalizedPayload.profile='other');assert.equal(match(wrong,99).status,'not_matched');
});

test('actual provider receives natural Chinese source distinctions, no partial passages or machine payload and no invented weak-chart verdict',async()=>{
 const run=real('wei'),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'yang-private-report'));assert.ok(input.facts.some(f=>f.type==='quanshu_yang_taboo_context'));
 const prompt=formatFortuneFactAudit(input);for(const t of ['未年歌句猪鸡对应亥酉','注文却列酉戌','男表为未列','女表为弱宫','宫名强弱、星曜庙陷和全盘强弱是不同层次','不能互相代替','擎羊须在四墓宫','本生所忌不保证等于这一章的子集'])assert.ok(prompt.includes(t),t);
 for(const secret of ['quanshu-yang-strength','yang-private','birthBranchInTombsCandidate','mainPositionsReady','coordinateBasis','weiProseVerseConflict'])assert.ok(!prompt.includes(secret),secret);
 assert.ok(!input.sections.flatMap(s=>s.findings).some(f=>[84,85,99,100].some(i=>f.knowledgeId===fortuneKnowledge.ziwei.rules[i].knowledgeId)));
 const d=describeFortuneFact({method:'ziwei',type:'quanshu_yang_taboo_context',data:condition('wei')},String);assert.ok(!/[{}\[\]]/u.test(d));
 const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});}});await provider.interpret(input);
});
