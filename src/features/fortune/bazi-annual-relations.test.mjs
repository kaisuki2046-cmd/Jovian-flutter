import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Solar } from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
import { createFortuneDeepSeek } from './server/deepseek-expression.mjs';
const { baziAnnualColumnRelations, annualRelationNatalClockReady, baziAnnualRelationPolicy } = await import('./control/bazi-annual-relations.ts');
const { smthBirthMonthGeneral } = await import('./control/bazi-smth-month-duty.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const ref = JSON.parse(readFileSync(new URL('./model/fixtures/bazi-annual-relations-reference.json', import.meta.url)));
const stem = '甲乙丙丁戊己庚辛壬癸', branch = '子丑寅卯辰巳午未申酉戌亥';
const cycle = Array.from({length:60},(_,i)=>stem[i%10]+branch[i%12]);
const natal = {year:'乙卯',month:'丙寅',day:'甲子',hour:'丁卯'}, before = {status:'before_luck'};
const pairsContain = (table,a,b) => table.includes(a+b)||table.includes(b+a);
const indices = [6,9,10];
function archive(example = ref.realExamples.jiaWuBothWitnesses) {
  const {year,month,day,hour,minute=0,gender}=example,lunar=Solar.fromYmdHms(year,month,day,hour,minute,0).getLunar();
  const pillars = [lunar.getYearInGanZhiExact(),lunar.getMonthInGanZhiExact(),lunar.getDayInGanZhiExact(),lunar.getTimeInGanZhi()];
  if(example.pillars) assert.deepEqual(pillars,example.pillars);
  return {timeKnown:true,bazi:{engineName:'lunar-javascript',engineVersion:'1.7.8',rulesetVersion:'utc8-jie-local-civil-late-zi-next-v1',rawResult:[{
    utc:new Date(Date.UTC(year,month-1,day,hour-8,minute)).toISOString(),year:pillars[0],month:pillars[1],day:pillars[2],hour:pillars[3],
    luckPeriods:lunar.getEightChar().getYun(gender,2).getDaYun(11).slice(1).map(d=>({ganZhi:d.getGanZhi(),startAge:d.getStartAge(),endAge:d.getEndAge()})),
    tenGods:{},shenSha:{},
  }]},ziwei:{rawResult:[]},western:{rawResult:[]}};
}
function calculate(chart=archive(),year=2018) {
  const params={periodType:'year',displayTimezone:'Asia/Shanghai',targetPeriod:{year}};
  return calculateFortuneFacts(params,buildFactTimeContext(params,Date.parse('2026-11-19T00:00:00Z'),'server'),
    'annual-relations-run',{snapshotId:'annual-relations-snapshot',chart});
}
const cache=new Map(),runFor=name=>{if(!cache.has(name)){const e=ref.realExamples[name];cache.set(name,calculate(archive(e),e.targetYear));}return cache.get(name);};
const facts=run=>run.facts.filter(f=>f.factType==='annual_column_relations');
const matched=(run,index)=>matchFortuneKnowledge(run).byMethod.bazi.find(r=>r.knowledgeId===fortuneKnowledge.bazi.rules[index].knowledgeId);

function submitCompleteYear(birth, year) {
  const chart = archive(birth);
  chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
    longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const now = Date.UTC(year, 5, 15), reference = { snapshotId: 'annual-conditions-' + year };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...reference, chart })));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(run);
  return run;
}

test('the original Geng-year Jia-day example only matches the stated direction', () => {
  const example = ref.realExamples.jiaWuBothWitnesses;
  const lookup = run => matchFortuneKnowledge(run).byMethod.bazi.find(row => row.knowledgeId === 'fortune-entry-2229');
  const positive = submitCompleteYear(example, 2020);
  const match = lookup(positive);
  assert.equal(match.status, 'matched');
  assert.ok(facts(positive).some(row => match.sourceFactIds.includes(row.factId)
    && row.normalizedPayload.dayMaster === '甲' && row.normalizedPayload.yearStem === '庚'));
  assert.equal(lookup(submitCompleteYear(example, 2018)).status, 'not_matched');
});

test('annual repetition requires both characters from the same natal month or hour column', () => {
  const birth = { year: 1997, month: 3, day: 15, hour: 12, gender: 1 };
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.bazi.find(row => row.knowledgeId === 'fortune-entry-' + id);
  for (const [id, otherId, year, position, pillar] of [
    [2319, 2320, 2023, 'month', '癸卯'],
    [2320, 2319, 2014, 'hour', '甲午'],
  ]) {
    const run = submitCompleteYear(birth, year);
    const match = lookup(run, id);
    assert.equal(match.status, 'matched');
    const matchingFacts = facts(run).filter(row => match.sourceFactIds.includes(row.factId));
    assert.ok(matchingFacts.length > 0);
    for (const { normalizedPayload: data } of matchingFacts) {
      assert.equal(data.yearPillar, pillar);
      assert.deepEqual(data.natalRepeatPositions, [position]);
    }
    assert.notEqual(lookup(run, otherId).status, 'matched');
    const sameBranch = submitCompleteYear(birth, year + 12);
    assert.ok(facts(sameBranch).some(row => row.normalizedPayload.yearPillar[1] === pillar[1]));
    assert.notEqual(lookup(sameBranch, id).status, 'matched');
  }
  const natal = archive(birth).bazi.rawResult[0];
  assert.deepEqual(baziAnnualColumnRelations(natal, false, '甲午').natalRepeatPositions, []);
});

test('the 2027 year-pillar table and day-master readings use the correct reference stem', () => {
  const lookup = run => matchFortuneKnowledge(run).byMethod.bazi.filter(row =>
    row.status === 'matched' && /^fortune-entry-(2339|23[4-9]\d|240[0-8])$/u.test(row.knowledgeId));
  const sample = { year: 1984, month: 12, day: 1, hour: 12, gender: 1 };
  const seedRun = submitCompleteYear(sample, 2027);
  const seedFact = facts(seedRun).find(row => row.normalizedPayload.annualYear === 2027);
  assert.ok(seedFact);
  assert.equal(seedFact.activeFrom, '2027-02-04T01:46:18.000Z');
  const yearIds = new Set();
  const dayIds = new Set();
  for (const [index, pillar] of cycle.entries()) {
    const candidateYear = 1984 + index;
    const year = candidateYear > 2026 ? candidateYear - 60 : candidateYear;
    const birth = { year, month: 12, day: 1, hour: 12, gender: 1 };
    const natal = archive(birth).bazi.rawResult[0];
    assert.equal(natal.year, pillar);
    const annual = baziAnnualColumnRelations(natal, true, '丁未', before);
    const evidence = {
      ...seedFact, normalizedPayload: { ...annual, annualYear: 2027 },
    };
    const yearId = 'fortune-entry-' + (2339 + index);
    const dayId = 'fortune-entry-' + (2399 + stem.indexOf(natal.day[0]));
    const expected = [yearId, dayId];
    const base = { ...seedRun, facts: [evidence] };
    const matches = lookup(base);
    assert.deepEqual(matches.map(row => row.knowledgeId).sort(), expected.slice().sort(), pillar);
    assert.ok(matches.every(row => row.windows[0].start === seedFact.activeFrom));
    if (index === 0) {
      const actual = lookup(seedRun);
      assert.deepEqual(actual.map(row => row.knowledgeId).sort(), expected.slice().sort());
      assert.ok(actual.every(row => row.windows[0].start === seedFact.activeFrom));
    }
    yearIds.add(yearId);
    dayIds.add(dayId);
    const otherCycle = { ...evidence, normalizedPayload: { ...evidence.normalizedPayload, annualYear: 2087 } };
    assert.deepEqual(lookup({ ...base, facts: [otherCycle] }), []);
    const wrongReference = { ...evidence, normalizedPayload: {
      ...evidence.normalizedPayload, yearTenGodByNatalYearStem: '错误值', yearMainQiTenGod: '错误值',
    } };
    assert.deepEqual(lookup({ ...base, facts: [wrongReference] }), []);
  }
  assert.equal(yearIds.size, 60);
  assert.equal(dayIds.size, 10);
  const nextDisplayYear = submitCompleteYear(sample, 2028);
  const januaryMatches = lookup(nextDisplayYear);
  assert.equal(januaryMatches.length, 2);
  assert.ok(januaryMatches.every(row => row.windows.at(-1).endExclusive === '2028-02-04T07:31:13.000Z'));
});

test('the Tai Sui source keeps the Jia-Wu, Jia-Zi repeat and reverse full-column clash distinct', () => {
  const birth = { year: 1984, month: 1, day: 31, hour: 12, gender: 1 };
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.bazi.find(row => row.knowledgeId === 'fortune-entry-' + id);
  const cases = [
    [2249, 2018, '戊戌', { dayControlsYear: true, dayBranchClash: false, yearTenGod: '偏财' }],
    [2250, 2044, '甲子', { dayControlsYear: false, yearControlsDay: false, dayBranchClash: false }],
    [2251, 1990, '庚午', { yearControlsDay: true, dayControlsYear: false, dayBranchClash: true }],
  ];
  for (const [id, year, pillar, expected] of cases) {
    const run = submitCompleteYear(birth, year);
    const match = lookup(run, id);
    assert.equal(match.status, 'matched');
    const matchedFacts = facts(run).filter(row => match.sourceFactIds.includes(row.factId));
    assert.ok(matchedFacts.length > 0);
    for (const fact of matchedFacts) {
      const data = fact.normalizedPayload;
      assert.equal(data.natalDay, '甲子');
      assert.equal(data.yearPillar, pillar);
      for (const [key, value] of Object.entries(expected)) assert.equal(data[key], value);
    }
    for (const [otherId] of cases.filter(([otherId]) => otherId !== id)) {
      assert.equal(lookup(run, otherId).status, 'not_matched');
    }
  }
  const gengWithoutClash = submitCompleteYear(birth, 2020);
  assert.equal(lookup(gengWithoutClash, 2229).status, 'matched');
  assert.equal(lookup(gengWithoutClash, 2251).status, 'not_matched');
});

test('the Tai Sui final clauses distinguish reciprocal hour controls and natal day polarity', () => {
  const yang = { year: 1984, month: 1, day: 31, hour: 12, gender: 1 };
  const yin = { ...yang, month: 2, day: 1 };
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.bazi.find(row => row.knowledgeId === 'fortune-entry-' + id);
  for (const [year, direction, excerpt, opposite] of [
    [2026, 'yearControlsHour', '太歲尅當生時', 'hourControlsYear'],
    [2044, 'hourControlsYear', '時尅太歲', 'yearControlsHour'],
  ]) {
    const run = submitCompleteYear(yang, year);
    const result = lookup(run, 2252);
    assert.equal(result.status, 'matched');
    const source = facts(run).filter(row => result.sourceFactIds.includes(row.factId));
    assert.ok(source.length > 0);
    assert.ok(source.some(({ normalizedPayload }) => normalizedPayload[direction] && !normalizedPayload[opposite]));
    assert.match(result.matchedSourceExcerpt, new RegExp(excerpt, 'u'));
    const noHour = source.map(row => ({ ...row,
      normalizedPayload: { ...row.normalizedPayload, timeKnown: false, hourControlsYear: undefined, yearControlsHour: undefined } }));
    assert.deepEqual(lookup({ ...run, facts: noHour }, 2252).windows, []);
  }
  for (const [chart, stem, id, otherId] of [[yang, '甲', 2253, 2254], [yin, '乙', 2254, 2253]]) {
    const run = submitCompleteYear(chart, 2018);
    const match = lookup(run, id);
    assert.equal(match.status, 'matched');
    assert.ok(facts(run).some(row => match.sourceFactIds.includes(row.factId)
      && row.normalizedPayload.dayMaster === stem && row.normalizedPayload.dayControlsYear));
    assert.equal(lookup(run, otherId).status, 'not_matched');
    assert.equal(lookup(submitCompleteYear(chart, 2021), id).status, 'not_matched');
  }
});

test('birth-year Tai Sui rules compare the actual natal and annual year branches', () => {
  const birth = { year: 1984, month: 4, day: 5, hour: 12, gender: 1 };
  const cases = [
    [2260, 2020, '庚子', '子子', '同支'],
    [2261, 2026, '丙午', '子午', '六冲'],
    [2262, 2027, '丁未', '子未', '六害'],
    [2263, 2017, '丁酉', '子酉', '六破'],
    [2264, 2023, '癸卯', '子卯', '相刑'],
  ];
  for (const [id, year, pillar, pair, relation] of cases) {
    const run = submitCompleteYear(birth, year);
    const matches = matchFortuneKnowledge(run).byMethod.bazi;
    const match = matches.find(row => row.knowledgeId === 'fortune-entry-' + id);
    assert.equal(match.status, 'matched', 'entry ' + id);
    const evidence = facts(run).filter(row => match.sourceFactIds.includes(row.factId));
    assert.ok(evidence.length > 0);
    for (const { normalizedPayload } of evidence) {
      assert.equal(normalizedPayload.birthYearPillar, '甲子');
      assert.equal(normalizedPayload.yearPillar, pillar);
      assert.equal(normalizedPayload.birthYearBranchPair, pair);
      assert.ok(normalizedPayload.birthYearBranchRelations.includes(relation));
    }
    assert.equal(matches.find(row => row.knowledgeId === 'fortune-entry-2265').status, 'not_matched');
  }
  const wrongColumn = submitCompleteYear({ year: 1986, month: 12, day: 12, hour: 12, gender: 1 }, 2026);
  assert.ok(facts(wrongColumn).some(({ normalizedPayload }) => normalizedPayload.yearPillar === '丙午'
    && normalizedPayload.pairs.some(pair => pair.position === 'month' && pair.branchClash)));
  assert.equal(matchFortuneKnowledge(wrongColumn).byMethod.bazi
    .find(row => row.knowledgeId === 'fortune-entry-2261').status, 'not_matched');
});

test('birth-year Tai Sui punishment distinguishes self-punishment and complete natal groups', () => {
  const cases = [
    [2265, { year: 1990, month: 12, day: 5, hour: 12, gender: 0 }, 2026, '丙午', '午午'],
    [2266, { year: 1986, month: 12, day: 17, hour: 10, gender: 1 }, 2016, '丙申', '寅申', '寅巳申'],
    [2267, { year: 1985, month: 7, day: 23, hour: 12, gender: 1 }, 2018, '戊戌', '丑戌', '丑戌未'],
  ];
  for (const [id, birth, year, pillar, pair, group] of cases) {
    const run = submitCompleteYear(birth, year);
    const matches = matchFortuneKnowledge(run).byMethod.bazi;
    const match = matches.find(row => row.knowledgeId === 'fortune-entry-' + id);
    assert.equal(match.status, 'matched', 'entry ' + id);
    const evidence = facts(run).filter(row => match.sourceFactIds.includes(row.factId));
    assert.ok(evidence.length > 0);
    for (const { normalizedPayload } of evidence) {
      assert.equal(normalizedPayload.yearPillar, pillar);
      assert.equal(normalizedPayload.birthYearBranchPair, pair);
      if (group) assert.deepEqual(normalizedPayload.birthYearAnnualPunishmentGroups, [group]);
    }
    if (!group) assert.equal(matches.find(row => row.knowledgeId === 'fortune-entry-2260').status, 'matched');
  }
  const onlyLuckCompletes = { year: '丙寅', month: '乙卯', day: '甲子', hour: '丁卯' };
  const luck = { status: 'confirmed', pillar: '癸巳' };
  assert.deepEqual(baziAnnualColumnRelations(onlyLuckCompletes, true, '丙申', luck).birthYearAnnualPunishmentGroups, []);
  assert.equal(baziAnnualColumnRelations(onlyLuckCompletes, false, '丙申', luck).birthYearAnnualPunishmentGroups, undefined);
  const samePair = baziAnnualColumnRelations(onlyLuckCompletes, true, '乙亥');
  assert.ok(samePair.birthYearBranchRelations.includes('六合'));
  assert.ok(samePair.birthYearBranchRelations.includes('六破'));
});

test('the annual contact rules match only the named part of the actual natal column', () => {
  const cases = [
    [1978, 6, 20, 12, 2003, '癸未', [[2292, 'year'], [2293, 'month'], [2295, 'day'], [2297, 'year'], [2298, 'month'], [2300, 'hour']]],
    [1978, 12, 11, 8, 2050, '庚午', [[2289, 'month'], [2291, 'hour'], [2294, 'month'], [2299, 'day'], [2301, 'month']]],
    [1984, 3, 11, 8, 2030, '庚戌', [[2288, 'year'], [2290, 'day'], [2296, 'hour']]],
  ];
  const relation = (id) => id <= 2291 ? '天干四冲' : id <= 2293 ? '天干五合' : id <= 2296 ? '六冲' : '六合';
  const lookup = (run, id) => matchFortuneKnowledge(run).byMethod.bazi.find(row => row.knowledgeId === 'fortune-entry-' + id);
  for (const [year, month, day, hour, targetYear, targetPillar, entries] of cases) {
    const run = submitCompleteYear({ year, month, day, hour, gender: 1 }, targetYear);
    const matches = matchFortuneKnowledge(run).byMethod.bazi;
    for (const [id, position] of entries) {
      const match = matches.find(row => row.knowledgeId === 'fortune-entry-' + id);
      assert.equal(match.status, 'matched', 'entry ' + id);
      const witness = facts(run).find(row => row.normalizedPayload.yearPillar === targetPillar
        && match.sourceFactIds.includes(row.factId));
      assert.ok(witness);
      const pair = witness.normalizedPayload.pairs.find(candidate => candidate.position === position);
      const expected = id === 2301 ? ['天干四冲', '六冲'] : [relation(id)];
      assert.ok(expected.every(kind => pair.relations.includes(kind)));
      const filter = fortuneKnowledge.bazi.rules.find(row => row.knowledgeId === match.knowledgeId).queries[0].where;
      const columnField = Object.keys(filter).find(key => key.endsWith('Positions'));
      const misplaced = { ...witness, normalizedPayload: { ...witness.normalizedPayload,
        [columnField]: id === 2301 ? [] : [position === 'year' ? 'day' : 'year'] } };
      assert.equal(lookup({ ...run, facts: [misplaced] }, id).status, 'not_matched');
      if (position === 'hour') {
        const unknown = { ...witness, normalizedPayload: { ...witness.normalizedPayload, timeKnown: false } };
        assert.equal(lookup({ ...run, facts: [unknown] }, id).status, 'not_matched');
      }
    }
  }
  const separateColumns = baziAnnualColumnRelations({ year: '甲寅', month: '丙子', day: '丁卯', hour: '己酉' }, true, '庚午');
  assert.deepEqual(separateColumns.stemClashPositions, ['year']);
  assert.deepEqual(separateColumns.branchClashPositions, ['month']);
  assert.deepEqual(separateColumns.sameColumnDoubleClashPositions, []);
});

test('the Gui-Si and Ding-Hai example matches actual directed stem control and branch clash after Li Chun', () => {
  const chart = archive({ year: 1990, month: 1, day: 28, hour: 15, gender: 1 });
  const native = chart.bazi.rawResult[0];
  // The Los Angeles archives use the local date, one day earlier than in Beijing.
  native.utc = '1990-01-28T23:00:00.000Z';
  native.luckPeriods = [];
  chart.birthContext = { precision: 'minute', birthInstant: native.utc, latitude: 34, longitude: -118,
    timeZone: 'America/Los_Angeles', clockVersion: 'gregory-iana-intl-v1' };
  assert.equal(native.day, '癸巳');
  assert.equal(annualRelationNatalClockReady(native, true), false);
  assert.equal(annualRelationNatalClockReady(native, true, chart.birthContext), true);
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2007 } };
  const now = Date.parse('2026-11-19T00:00:00Z'), reference = { snapshotId: 'smth-tai-sui-example' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...reference, chart })));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), 'tai-sui-run', reference);
  const [prior, ...current] = facts(run);
  const liChun = '2007-02-04T05:18:12.000Z';
  assert.equal(prior.normalizedPayload.yearPillar, '丙戌');
  assert.equal(prior.activeTo, liChun);
  assert.equal(current[0].activeFrom, liChun);
  for (const { normalizedPayload } of current) {
    assert.equal(normalizedPayload.yearPillar, '丁亥');
    assert.equal(normalizedPayload.luckStatus, 'unavailable');
    assert.equal(normalizedPayload.dayControlsYear, true);
    assert.equal(normalizedPayload.dayBranchClash, true);
  }
  const result = matched(run, 4);
  assert.equal(result.status, 'matched');
  assert.deepEqual(result.sourceFactIds, current.map(fact => fact.factId));
  assert.deepEqual(result.windows, [{ start: liChun, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'tai-sui-report')).input;
  assert.match(formatFortuneFactAudit(model), /本命日干癸水克岁干丁火，日支巳与岁支亥六冲/u);
  assert.equal(matched(calculate({ ...chart, birthContext: { ...chart.birthContext, timeZone: 'Asia/Shanghai' } }, 2007), 4).status, 'unknown');
});

test('all 3600 valid day/year pairs preserve the explicit five stem pairs and six branch pairs within the same column',()=>{
  for(const day of cycle)for(const year of cycle){
    const context=baziAnnualColumnRelations({...natal,day},true,year,before),pair=context.pairs.find(p=>p.position==='day');
    const sh=pairsContain(ref.stemPairs,day[0],year[0]),zh=pairsContain(ref.branchPairs,day[1],year[1]);
    assert.equal(pair.stemCombine,sh);assert.equal(pair.branchCombine,zh);assert.equal(pair.bothCombine,sh&&zh);
    if (sh) assert.equal(pair.branchClash, false);
    assert.equal(pair.stemPair,day[0]+year[0]);assert.equal(pair.pillar,day);
    assert.equal(context.sameColumnCombines.includes('day'),sh&&zh);
    if (sh && zh) {
      const details = context.doubleCombineDetails.find(row => row.position === 'day');
      const heads = [day, year].map(pillar => cycle[Math.floor(cycle.indexOf(pillar) / 10) * 10]);
      assert.deepEqual([details.participantXun, details.annualXun], heads);
      assert.equal(details.sameXun, heads[0] === heads[1]);
    }
  }
});

test('the two directed Jia/Ji examples keep separate identities and raw circular distances, without inventing a severity score',()=>{
  for(const row of ref.directedExamples){
    const p=baziAnnualColumnRelations({...natal,day:row.natalDay},true,row.yearPillar,before);
    assert.equal(p.dayExample,row.example);assert.equal(p.dayStemCombine,true);
    assert.equal((p.dayToYearSexagenarySteps+p.yearToDaySexagenarySteps)%60,0);
    assert.equal(p.weight,undefined);assert.equal(p.taiSuiEnteringHome,undefined);
  }
  const jia=baziAnnualColumnRelations(natal,true,'己丑',before),reverse=baziAnnualColumnRelations({...natal,day:'己丑'},true,'甲子',before);
  assert.equal(jia.dayToYearSexagenarySteps,25);assert.equal(reverse.dayToYearSexagenarySteps,35);
  assert.equal(jia.dayToYearBranchSteps,1);assert.equal(reverse.dayToYearBranchSteps,11);
  assert.throws(()=>baziAnnualColumnRelations({...natal,day:'甲丑'},true,'甲子'),RangeError);
});

test('p273-001 keeps the source Jia/Ji direction and day/hour weights separate on full calendar charts', () => {
  const samples = [
    { month: 2, day: 28, targetYear: 2019, yearPillar: '己亥', weight: 'heavier', positions: ['day', 'hour'],
      liChun: '2019-02-04T03:14:21.000Z', phrase: /卷二将甲日己岁在这对有向例中列为相对较重/u },
    { month: 3, day: 25, targetYear: 2024, yearPillar: '甲辰', weight: 'lighter', positions: ['day'],
      liChun: '2024-02-04T08:27:07.000Z', phrase: /卷二将己日甲岁在这对有向例中列为相对较轻/u },
  ];
  for (const sample of samples) {
    const chart = archive({ year: 1990, month: sample.month, day: sample.day, hour: 0, gender: 1 });
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const run = calculate(chart, sample.targetYear);
    const result = matched(run, 9);
    assert.equal(result.status, 'matched');
    assert.equal(result.windows[0].start, sample.liChun);
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === sample.yearPillar && result.sourceFactIds.includes(row.factId));
    assert.ok(fact);
    const rows = fact.normalizedPayload.dayHourStemCombines;
    assert.deepEqual(rows.map(row => row.position), sample.positions);
    assert.deepEqual(rows.map(row => [row.positionWeight, row.jiaJiWeight]), sample.positions.length === 2
      ? [['lighter', sample.weight], ['heavier', undefined]] : [['lighter', sample.weight]]);
    const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'day-hour-weights')).input;
    const prompt = formatFortuneFactAudit(model);
    assert.match(prompt, sample.phrase);
    assert.match(prompt, /《神白经》所列日干合的柱位比较为较轻/u);
    if (sample.positions.includes('hour')) assert.match(prompt, /《神白经》所列时干合的柱位比较为较重/u);
    assert.doesNotMatch(prompt, /positionWeight|jiaJiWeight/u);
  }
});

test('p273-001 applies the actual stem pair, birth-month duty and separately located annual branch clash', async () => {
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2017 } };
  const now = Date.parse('2026-11-19T00:00:00Z'), reference = { snapshotId: 'year-combine-source' };
  const chart = archive({ year: 1990, month: 3, day: 12, hour: 8, gender: 0 });
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...reference, chart })));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), 'year-combine-run', reference);
  validateFortuneFacts(run);
  const match = matched(run, 9);
  assert.equal(run.calculationSource, 'client');
  assert.equal(match.status, 'matched');
  const { normalizedPayload: p } = facts(run).find(fact => match.sourceFactIds.includes(fact.factId)
    && fact.normalizedPayload.yearPillar === '丁酉');
  assert.deepEqual(p.dayHourStemCombinePositions, ['hour']);
  const [holder] = p.dayHourStemCombines;
  assert.equal(holder.stemPair, '壬丁');
  assert.equal(holder.positionWeight, 'heavier');
  assert.equal(holder.jiaJiWeight, undefined);
  assert.equal(holder.dayStemPhaseAtYearBranch, '死');
  assert.equal(holder.participantStemPhaseAtYearBranch, '沐浴');
  assert.deepEqual(holder.annualClashes.map(row => row.members), [['month', 'annual']]);
  assert.deepEqual(holder.combiningColumnClashes, []);
  assert.equal(holder.yearClashAtDayStemDeathOrExtinction, true);
  assert.equal(holder.yearClashAtParticipantDeathOrExtinction, false);
  assert.deepEqual(p.dayHourMonthDuty, { month: '己卯', elapsedDay: 7, label: '甲木', stem: '甲', outsidePrintedDays: false });
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'year-combine-report')).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /本命时柱壬辰的天干与岁干壬丁五合；日干临岁支为死；时干临岁支为沐浴/u);
  assert.match(prompt, /岁支另有冲位，本命月柱与本段太岁六冲/u);
  assert.match(prompt, /出生月己卯交节后第7日，首表司事候选为甲木/u);
  assert.doesNotMatch(prompt, /dayHourMonthDuty|combineDetailProfile|dayHourStemCombinePositions/u);
  const finding = model.sections.flatMap(section => section.findings).find(row => row.knowledgeId === match.knowledgeId);
  assert.ok(finding);
  assert.deepEqual(finding.windows, match.windows);
  let sent = false;
  const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_url, options) => {
    const content = JSON.parse(options.body).messages[1].content;
    assert.ok(content.includes(finding.note));
    assert.ok(content.includes('日干與時干不宜與太嵗天元合合則名為晦氣'));
    sent = true;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(model);
  assert.ok(sent);

  const onlyBranch = baziAnnualColumnRelations({ ...natal, hour: '丙寅' }, true, '辛巳', before);
  assert.deepEqual(onlyBranch.dayHourStemCombinePositions, ['hour']);
  assert.deepEqual(onlyBranch.fivePositionReferences, {
    sexagenaryForward: false, sexagenaryBackward: false, branchForward: true, branchBackward: false,
  });
  assert.deepEqual(onlyBranch.dayHouseArrival, {
    reference: '甲子', referenceTarget: '己巳', pillar: '辛巳', role: 'house', match: 'same-branch',
  });
  const fullForward = baziAnnualColumnRelations(natal, true, '己巳', before);
  assert.equal(fullForward.fivePositionReferences.sexagenaryForward, true);
  assert.equal(fullForward.dayHouseArrival.match, 'whole-pillar');
  const fullReverse = baziAnnualColumnRelations({ ...natal, day: '己巳' }, true, '甲子', before);
  assert.equal(fullReverse.fivePositionReferences.sexagenaryBackward, true);
  assert.equal(fullReverse.dayHouseArrival, undefined);
  assert.equal(baziAnnualColumnRelations(natal, true, '辛巳', before).dayHouseArrival, undefined);
});

test('p273-001 names only a day or hour combine and keeps the unknown hour independent of the known day', () => {
  const yearAndMonth = submitCompleteYear({ year: 1990, month: 4, day: 8, hour: 11, gender: 1 }, 2015);
  const monthOnly = submitCompleteYear({ year: 1990, month: 6, day: 8, hour: 11, gender: 1 }, 2017);
  for (const [run, annual, positions] of [[yearAndMonth, '乙未', ['year', 'month']], [monthOnly, '丁酉', ['month']]]) {
    const stage = facts(run).find(row => row.normalizedPayload.yearPillar === annual);
    assert.ok(stage, annual);
    assert.deepEqual(stage.normalizedPayload.stemCombinePositions, positions);
    assert.deepEqual(stage.normalizedPayload.dayHourStemCombinePositions, []);
    assert.equal(matched(run, 9).status, 'not_matched');
  }

  const chart = archive({ year: 1990, month: 2, day: 28, hour: 0, gender: 1 });
  chart.timeKnown = false;
  const run = calculate(chart, 2019);
  const hit = matched(run, 9);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.windows[0].start, '2019-02-04T03:14:21.000Z');
  const rows = facts(run).filter(row => hit.sourceFactIds.includes(row.factId));
  assert.ok(rows.length);
  for (const { normalizedPayload: data } of rows) {
    assert.equal(data.timeKnown, false);
    assert.deepEqual(data.dayHourStemCombinePositions, ['day']);
    assert.equal(data.hourStemCombine, undefined);
    assert.equal(data.dayHourStemCombines[0].jiaJiWeight, 'heavier');
  }
});

test('p273-001 checks the reverse fifth position from the birth hour and rates the actual month duty element', () => {
  const cases = [
    { birth: [2, 11, 4], year: 2017, annual: '丁酉', hourPillar: '壬寅', positions: ['hour'],
      tomb: ['丁酉', 'whole-pillar'], duty: ['丙火', '火', '相'] },
    { birth: [2, 13, 18], year: 2024, annual: '甲辰', hourPillar: '癸酉', positions: ['day'],
      tomb: ['戊辰', 'same-branch'], duty: ['丙火', '火', '相'] },
    { birth: [2, 5, 8], year: 2017, annual: '丁酉', hourPillar: '壬辰', positions: ['hour'],
      duty: ['艮土', '土', '死'] },
    { birth: [2, 5, 4], year: 2017, annual: '丁酉', hourPillar: '庚寅', positions: [] },
    { birth: [3, 28, 0], year: 2017, annual: '丁酉', hourPillar: '庚子', positions: ['day'],
      house: '壬辰', duty: ['乙木', '木', '旺'] },
  ];
  for (const { birth: [month, day, hour], year, annual, hourPillar, positions, tomb, house, duty } of cases) {
    const run = submitCompleteYear({ year: 1990, month, day, hour, gender: 1 }, year);
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === annual);
    const p = fact.normalizedPayload, result = matched(run, 9);
    assert.equal(p.pairs.find(row => row.position === 'hour').pillar, hourPillar);
    assert.deepEqual(p.dayHourStemCombinePositions, positions);
    assert.equal(result.sourceFactIds.includes(fact.factId), positions.length > 0);
    if (positions.length) assert.ok(result.windows.some(row => row.start <= fact.activeFrom && row.endExclusive >= fact.activeTo));
    assert.deepEqual(p.hourTombArrival, tomb && {
      reference: hourPillar, referenceTarget: tomb[0], pillar: annual, role: 'tomb', match: tomb[1],
    });
    if (house) assert.equal(p.dayHouseArrival.reference, house);
    const season = p.dayHourMonthDutySeason;
    assert.deepEqual(season && [p.dayHourMonthDuty.label, season.element, season.power], duty);
    const prompt = formatFortuneFactAudit(buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'hour-tomb')).input);
    assert.equal(prompt.includes('时后五位核墓，基准柱' + hourPillar + '逆推五位'), Boolean(tomb));
    if (tomb) assert.ok(prompt.includes('墓位为' + tomb[0] + '，实际' + annual
      + (tomb[1] === 'whole-pillar' ? '整柱吻合' : '与该位同支')));
    if (duty) assert.ok(prompt.includes('该司事五行' + duty[1] + '为' + duty[2]));
    assert.doesNotMatch(prompt, /hourTombArrival|dayHourMonthDutySeason/u);
  }
});

test('p273-002 compares the natal month power of a punished double-combine pair without borrowing another pair', () => {
  const cases = [
    { birth: [1965, 5, 6, 2], year: 1980, annual: '庚申', position: 'year', pillar: '乙巳', monthPillar: '辛巳', powers: ['旺', '死'] },
    { birth: [1965, 11, 15, 12], year: 1980, annual: '庚申', position: 'year', pillar: '乙巳', monthPillar: '丁亥', powers: ['死', '休'] },
    { birth: [1990, 2, 6, 12], year: 1991, annual: '辛未', position: 'hour', pillar: '丙午' },
  ];
  for (const { birth: [birthYear, month, day, hour], year, annual, position, pillar, monthPillar, powers } of cases) {
    const run = submitCompleteYear({ year: birthYear, month, day, hour, gender: 0 }, year);
    const result = matched(run, 10);
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === annual && result.sourceFactIds.includes(row.factId));
    assert.equal(result.status, powers ? 'partial' : 'matched');
    assert.ok(fact);
    assert.ok(result.windows.some(row => row.start <= fact.activeFrom && row.endExclusive >= fact.activeTo));
    const pair = fact.normalizedPayload.doubleCombineDetails.find(row => row.position === position);
    assert.equal(fact.normalizedPayload.sourceDoubleCombinePositions.includes(position), !powers);
    assert.equal(pair.pillar, pillar);
    assert.equal(pair.ownHouseTomb, undefined);
    assert.equal(pair.directFriction.some(row => row.kind === '相刑'), Boolean(powers));
    const hasRestOrCaptive = powers?.some(power => power === '休' || power === '囚');
    assert.deepEqual(pair.punishmentSeason, powers && { month: monthPillar, participant: { element: '火', power: powers[0] },
      annual: { element: '金', power: powers[1] }, hasRestOrCaptive });
    if (!powers) assert.ok(pair.otherFriction.some(row => row.kind === '相刑'));
    const prompt = formatFortuneFactAudit(buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'pair-power')).input);
    if (powers) {
      assert.ok(prompt.includes('按本命月' + monthPillar + '的月令，本命年柱地支五行火为' + powers[0] + '，岁支五行金为' + powers[1]));
      assert.ok(prompt.includes(hasRestOrCaptive ? '这一对出现地支五行休或囚的候选' : '这一对的地支五行未见休或囚'));
    } else assert.doesNotMatch(prompt, /这对俱合柱同时相刑/u);
    assert.doesNotMatch(prompt, /punishmentSeason|hasRestOrCaptive/u);
  }
});

test('both p273 rules bind the Xinchou house or tomb to the same combining natal participant', () => {
  const cases = [
    [{ year: 1980, month: 2, day: 25, hour: 4, gender: 1 }, 1993, '癸酉', 'day', '戊辰', 'house'],
    [{ year: 1980, month: 1, day: 3, hour: 6, gender: 1 }, 1994, '甲戌', 'hour', '己卯', 'tomb'],
  ];
  for (const [birth, year, pillar, position, reference, role] of cases) {
    const run = submitCompleteYear(birth, year);
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === pillar);
    assert.ok(fact);
    const p = fact.normalizedPayload;
    const expected = { reference, referenceTarget: pillar, pillar, role, match: 'whole-pillar' };
    for (const [index, participants] of [[9, p.dayHourStemCombines], [10, p.doubleCombineDetails]]) {
      const hit = matched(run, index);
      assert.equal(hit.status, index === 9 ? 'matched' : 'partial');
      assert.ok(hit.sourceFactIds.includes(fact.factId));
      assert.deepEqual(participants.find(row => row.position === position)?.ownHouseTomb, expected);
      assert.ok(participants.filter(row => row.position === 'year' || row.position === 'month').every(row => row.ownHouseTomb === undefined));
    }
    assert.equal(p.doubleCombineDetails.find(row => row.position === position).natalHouseTomb, undefined);
    assert.deepEqual(p.sourceExactHouseTombPositions, []);
  }
});

test('p273-002 confirms the same punished pair when its branch and NaYin both show weak seasonal power', () => {
  const run = submitCompleteYear({ year: 1965, month: 9, day: 15, hour: 12, gender: 0 }, 1980);
  const match = matched(run, 10);
  assert.equal(match.status, 'matched');
  assert.match(match.matchedConditions.join(), /支五行和纳音五行均落在休或囚/u);
  const { normalizedPayload: p } = facts(run).find(fact => match.sourceFactIds.includes(fact.factId)
    && fact.normalizedPayload.yearPillar === '庚申');
  assert.deepEqual(p.doubleCombineReviewedPositions, ['year']);
  assert.deepEqual(p.sourceDoubleWeakPunishmentPositions, ['year']);
  const [combined] = p.doubleCombineDetails;
  assert.equal(combined.moonVirtue, '庚');
  assert.equal(combined.participantAtMoonVirtue, false);
  assert.equal(combined.yearAtMoonVirtue, true);
  assert.deepEqual(combined.moonVirtueRestriction,
    { taboo: '丙', positions: ['hour', 'luck'], status: 'listed-counter-present' });
  assert.deepEqual(combined.directFriction.map(row => [row.kind, ...row.members]), [
    ['六破', 'year', 'annual'], ['相刑', 'year', 'annual'],
  ]);
  assert.ok(combined.otherFriction.some(row => row.kind === '相刑' && row.members.join() === 'year,day'));
  assert.deepEqual(combined.punishments, []);
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'double-combine-report')).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /本命年柱乙巳与太岁干支俱合；本命月支所取月德为庚，岁干见月德/u);
  assert.match(prompt, /俱合的同一对另见本命年柱与本段太岁六破、本命年柱与本段太岁相刑/u);
  assert.match(prompt, /月德合的忌干丙见于本命时柱、同段已核大运/u);
  assert.doesNotMatch(prompt, /doubleCombineDetails|doubleCombineReviewedPositions|directFriction/u);
  assert.ok(model.sections.some(section => section.findings.some(row => row.knowledgeId === match.knowledgeId)));

  const third = baziAnnualColumnRelations({ year: '乙巳', month: '己酉', day: '丙寅', hour: '丁酉' }, true, '庚申', before);
  assert.deepEqual(third.doubleCombineDetails[0].punishments.map(row => [row.values, row.byBranch]), [
    ['寅巳申', [['day'], ['year'], ['annual']]],
  ]);
  const elsewhere = baziAnnualColumnRelations({ year: '甲子', month: '丙寅', day: '甲戌', hour: '丁亥' }, true, '己丑', before);
  assert.equal(elsewhere.doubleCombineDetails[0].moonVirtue, '丙');
  assert.equal(elsewhere.doubleCombineDetails[0].participantAtMoonVirtue, false);
  assert.equal(elsewhere.doubleCombineDetails[0].yearAtMoonVirtue, false);
  assert.equal(elsewhere.doubleCombineDetails[0].moonVirtueRestriction, undefined);
  assert.ok(elsewhere.doubleCombineDetails[0].branchVirtues.every(row => !row.atParticipant && !row.atAnnual));
  assert.deepEqual(elsewhere.doubleCombineDetails[0].heavenVirtue,
    [{ basis: 'stem', value: '丁', atParticipant: false, atAnnual: false, restriction: undefined }]);
  const trigram = baziAnnualColumnRelations({ ...natal, month: '己卯', day: '乙巳', hour: '戊寅' }, true, '庚申', before);
  assert.deepEqual(trigram.doubleCombineDetails.find(row => row.position === 'day').heavenVirtue, [
    { basis: 'yuanhai', value: '申', atParticipant: false, atAnnual: true,
      restriction: { taboo: '寅', positions: ['hour'], status: 'listed-counter-present' } },
    { basis: 'kaoyuan', value: '未', atParticipant: false, atAnnual: false, restriction: undefined },
  ]);
  const tomb = baziAnnualColumnRelations({ ...natal, year: '戊子' }, true, '辛未', before);
  assert.deepEqual(tomb.annualHouseTomb, {
    reference: '戊子', referenceTarget: '癸未', pillar: '辛未', role: 'tomb', match: 'same-branch',
  });
});

test('p273-002 confirms only the exact combining natal house pillar after client submission and SQLite matching', () => {
  const run = submitCompleteYear({ year: 1983, month: 12, day: 6, hour: 12, gender: 1,
    pillars: ['癸亥', '癸亥', '戊辰', '戊午'] }, 1993);
  const match = matched(run, 10);
  assert.equal(match.status, 'matched');
  assert.match(match.matchedConditions.join(), /整柱吻合本命年柱/u);
  const fact = facts(run).find(row => row.normalizedPayload.yearPillar === '癸酉' && match.sourceFactIds.includes(row.factId));
  assert.ok(fact);
  assert.deepEqual(fact.normalizedPayload.sourceExactHouseTombPositions, ['day']);
  assert.equal(match.windows[0].start, fact.activeFrom);
  assert.ok(facts(run).filter(row => row.normalizedPayload.yearPillar !== '癸酉')
    .every(row => !match.sourceFactIds.includes(row.factId)));
  const [pair] = fact.normalizedPayload.doubleCombineDetails;
  assert.equal(pair.position, 'day');
  assert.deepEqual([pair.participantXun, pair.annualXun, pair.sameXun], ['甲子', '甲子', true]);
  assert.deepEqual(pair.natalHouseTomb, {
    reference: '癸亥', referenceTarget: '戊辰', pillar: '戊辰', role: 'house', match: 'whole-pillar',
  });
  assert.deepEqual(pair.branchVirtues.find(row => row.name === '月德'),
    { name: '月德', branch: '辰', atParticipant: true, atAnnual: false });
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'year-house-report')).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /本命月建所取月德为辰，本命日柱地支同位/u);
  assert.match(prompt, /参与柱在甲子旬，太岁在甲子旬，按〈论十干合〉属同旬俱合/u);
  assert.match(prompt, /基准柱癸亥顺推五位的宅位为戊辰，实际戊辰整柱吻合/u);
  assert.doesNotMatch(prompt, /referenceTarget|natalHouseTomb|branchVirtues/u);
});

test('p273-002 retains separate Xun and heaven virtue on the actual selected pair', () => {
  const chart = archive({ year: 1965, month: 11, day: 15, hour: 12, gender: 0, pillars: ['乙巳', '丁亥', '癸酉', '戊午'] });
  const run = calculate(chart, 1980);
  const result = matched(run, 10);
  const fact = facts(run).find(row => row.normalizedPayload.yearPillar === '庚申' && result.sourceFactIds.includes(row.factId));
  assert.equal(result.status, 'partial');
  assert.ok(fact);
  const pair = fact.normalizedPayload.doubleCombineDetails.find(row => row.position === 'year');
  assert.deepEqual([pair.participantXun, pair.annualXun, pair.sameXun], ['甲辰', '甲寅', false]);
  assert.deepEqual(pair.heavenVirtue, [{ basis: 'stem', value: '乙', atParticipant: true, atAnnual: false,
    restriction: { taboo: '辛', positions: [], status: 'listed-counter-absent' } }]);
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'combine-virtue')).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /参与柱在甲辰旬，太岁在甲寅旬，按〈论十干合〉属跨旬俱合/u);
  assert.match(prompt, /天德按卷六实干查乙，本命年柱天干同位/u);
  assert.match(prompt, /本命与同段岁运未见天德的忌干辛/u);
  assert.doesNotMatch(prompt, /participantXun|heavenVirtue/u);
});

test('p273-002 changes the named virtue restriction at the verified luck boundary without deleting the combination', () => {
  const chart = archive({ year: 1955, month: 2, day: 15, hour: 12, gender: 0,
    pillars: ['乙未', '戊寅', '丁未', '丙午'] });
  chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
    longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 1991 } };
  const now = Date.parse('2026-11-19T00:00:00Z'), reference = { snapshotId: 'virtue-counter-transition' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...reference, chart })));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), 'virtue-counter-run', reference);
  validateFortuneFacts(run);
  const result = matched(run, 10);
  assert.equal(result.status, 'matched');
  assert.equal(result.matchedSourceExcerpt, '若干支俱合');
  const [previous, current] = facts(run).filter(row => row.normalizedPayload.yearPillar === '辛未'
    && result.sourceFactIds.includes(row.factId));
  const boundary = '1991-07-07T16:00:00.000Z';
  assert.equal(previous.activeTo, boundary);
  assert.equal(current.activeFrom, boundary);
  assert.equal(previous.normalizedPayload.luckPillar, '辛巳');
  assert.equal(current.normalizedPayload.luckPillar, '壬午');
  const restriction = fact => fact.normalizedPayload.doubleCombineDetails.find(row => row.position === 'hour').moonVirtueRestriction;
  assert.deepEqual(restriction(previous), { taboo: '壬', positions: [], status: 'listed-counter-absent' });
  assert.deepEqual(restriction(current), { taboo: '壬', positions: ['luck'], status: 'listed-counter-present' });
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'virtue-counter-report')).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /本命与同段岁运未见月德合的忌干壬/u);
  assert.match(prompt, /月德合的忌干壬见于同段已核大运/u);
  assert.doesNotMatch(prompt, /moonVirtueRestriction|listed-counter-present/u);
});

test('month generals switch at each middle term while the birth month pillar stays in the same branch', () => {
  const terms = ['大寒', '雨水', '春分', '谷雨', '小满', '夏至', '大暑', '处暑', '秋分', '霜降', '小雪', '冬至'];
  const generals = '子亥戌酉申未午巳辰卯寅丑';
  for (const [index, middleTerm] of terms.entries()) {
    const qi = Solar.fromYmdHms(2000, index + 1, 26, 12, 0, 0).getLunar().getPrevQi(false);
    assert.equal(qi.getName(), middleTerm);
    const at = Date.parse(qi.getSolar().toYmdHms().replace(' ', 'T') + '+08:00');
    const birthMonth = '丑寅卯辰巳午未申酉戌亥子'[index];
    const before = smthBirthMonthGeneral(at - 1, birthMonth), current = smthBirthMonthGeneral(at, birthMonth);
    assert.equal(before.actualBranch, generals[(index + 11) % 12], middleTerm);
    assert.equal(before.matchesHeavenVirtueGeneral, false);
    assert.deepEqual(current, { middleTerm, start: new Date(at).toISOString(), actualBranch: generals[index],
      expectedBranch: generals[index], matchesHeavenVirtueGeneral: true });
  }
});

test('p273-002 uses the calendar instant of Rain Water for heaven virtue month-general support', () => {
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 1982 } };
  const now = Date.parse('2026-11-19T00:00:00Z');
  for (const minute of [48, 49]) {
    const chart = archive({ year: 1958, month: 2, day: 19, hour: 11, minute, gender: 1,
      pillars: ['戊戌', '甲寅', '丁卯', '丙午'] });
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const reference = { snapshotId: 'heaven-virtue-rain-water-' + minute };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...reference, chart })));
    const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const result = matched(run, 10);
    assert.equal(result.status, 'matched');
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === '壬戌'
      && row.normalizedPayload.doubleCombineReviewedPositions.includes('day'));
    assert.ok(!result.sourceFactIds.includes(fact.factId));
    assert.ok(result.candidateWindows.some(window => window.start <= fact.activeFrom && window.endExclusive >= fact.activeTo));
    const pair = fact.normalizedPayload.doubleCombineDetails.find(row => row.position === 'day');
    assert.equal(pair.heavenVirtue.every(row => row.atParticipant), true);
    const general = pair.heavenVirtueMonthGeneral;
    const after = minute === 49;
    assert.equal(general.actualBranch, after ? '亥' : '子');
    assert.equal(general.expectedBranch, '亥');
    assert.equal(general.matchesHeavenVirtueGeneral, after);
    assert.equal(general.printedFirstMonthExample, after);
    if (after) {
      assert.equal(general.start, '1958-02-19T03:48:26.000Z');
      assert.equal(fact.normalizedPayload.yearTenGod, '正官');
      assert.deepEqual(general.natalSupports.officers, []);
      assert.deepEqual(general.natalSupports.luPositions, ['hour']);
      assert.equal(general.natalSupports.hasAllNamedPositions, false);
    } else assert.equal(general.natalSupports, undefined);
    const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'month-general')).input;
    const prompt = formatFortuneFactAudit(model);
    assert.match(prompt, after ? /最近中气雨水取亥将，〈二德扶身〉本月所列扶将为亥，两者相符/u
      : /最近中气大寒取子将，〈二德扶身〉本月所列扶将为亥，当前月将尚未到该支/u);
    assert.equal(prompt.includes('符合〈将星扶德〉所举正月例的这两项条件'), after);
    assert.doesNotMatch(prompt, /heavenVirtueMonthGeneral|printedFirstMonthExample/u);
  }
});

test('p273-002 keeps the named natal supports and the actual same-column noble and horse', () => {
  const chart = archive({ year: 1956, month: 2, day: 24, hour: 8, gender: 1,
    pillars: ['丙申', '庚寅', '辛酉', '壬辰'] });
  chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
    longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2017 } };
  const now = Date.parse('2026-11-19T00:00:00Z'), reference = { snapshotId: 'month-general-natal-supports' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...reference, chart })));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const result = matched(run, 10);
  assert.equal(result.status, 'matched');
  const fact = facts(run).find(row => row.normalizedPayload.yearPillar === '丁酉' && result.sourceFactIds.includes(row.factId));
  const general = fact.normalizedPayload.doubleCombineDetails.find(row => row.position === 'hour').heavenVirtueMonthGeneral;
  assert.equal(general.matchesHeavenVirtueGeneral, true);
  assert.equal(general.printedFirstMonthExample, false);
  const support = general.natalSupports;
  assert.deepEqual(support.officers.map(({ column, stem, god, placement }) => [column, stem, god, placement]), [
    ['year', '丙', '正官', 'stem'], ['month', '丙', '正官', 'other_hidden'],
  ]);
  const [officer] = support.officerEvidence;
  assert.equal(officer.sourceOfficerMonth, true);
  assert.deepEqual([officer.officer.column, officer.monthRoot.column, officer.monthRoot.placement], ['year', 'month', 'other_hidden']);
  const exposedHurting = officer.hurtingControls.find(row => row.role.placement === 'stem');
  assert.equal(exposedHurting.role.column, 'hour');
  assert.equal(exposedHurting.role.stem, '壬');
  assert.equal(exposedHurting.atHourPhase, '墓');
  assert.equal(officer.officerAtHourPhase, '冠带');
  assert.ok(exposedHurting.restrainingSeals.length && exposedHurting.restrainingSeals.every(row => row.placement !== 'stem'));
  assert.deepEqual([support.nobleSeason, support.tianyiBranch, support.tianyiPositions], ['阳贵', '寅', ['month']]);
  assert.deepEqual([support.luBranch, support.luPositions], ['酉', ['day']]);
  assert.deepEqual([support.horseBranch, support.horsePositions, support.tianyiHorsePositions], ['寅', ['month'], ['month']]);
  const nobleHorse = support.branchSupportDetails.find(row => row.position === 'month');
  assert.deepEqual(nobleHorse.voidSources, []);
  assert.ok(nobleHorse.contacts.some(row => row.kind === '六冲' && row.members.join() === 'year,month'));
  assert.equal(support.hasAllNamedPositions, true);
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'natal-supports')).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /本命年柱丙申的天干丙为正官、本命月柱庚寅的支非本气藏干丙为正官/u);
  assert.match(prompt, /本命时柱壬辰的天干壬为伤官，对这一官干有克制关系/u);
  assert.match(prompt, /该伤官干临出生时支为墓/u);
  assert.match(prompt, /天乙与驿马同见于本命月柱/u);
  assert.match(prompt, /天乙与驿马所在本命月柱庚寅；该柱原局另见本命年柱与本命月柱六冲/u);
  assert.match(prompt, /原局四项位置同见。格局及实际相扶仍待核/u);
  assert.doesNotMatch(prompt, /hasAllNamedPositions|tianyiHorsePositions/u);
});

test('p273-002 binds wealth and seal or exposed killer to the actual natal officer evidence', () => {
  const samples = [
    { year: 1952, month: 8, day: 27, hour: 8, gender: 1, pillars: ['壬辰', '戊申', '乙巳', '庚辰'],
      target: 2013, annual: '癸巳', participation: 'month', officer: 'hour', stem: '庚', killer: false },
    { year: 1948, month: 3, day: 24, hour: 4, gender: 1, pillars: ['戊子', '乙卯', '戊申', '甲寅'],
      target: 2013, annual: '癸巳', participation: 'day', officer: 'month', stem: '乙', killer: true },
  ];
  for (const sample of samples) {
    const chart = archive(sample), input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.target } };
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const now = Date.parse('2026-11-19T00:00:00Z'), reference = { snapshotId: 'natal-officer-' + sample.year };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...reference, chart })));
    const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const result = matched(run, 10);
    assert.equal(result.status, 'partial');
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === sample.annual && result.sourceFactIds.includes(row.factId));
    const detail = fact.normalizedPayload.doubleCombineDetails.find(row => row.position === sample.participation);
    const [officer] = detail.heavenVirtueMonthGeneral.natalSupports.officerEvidence;
    assert.deepEqual([officer.officer.column, officer.officer.stem, officer.sourceOfficerMonth], [sample.officer, sample.stem, true]);
    assert.deepEqual([officer.monthRoot.column, officer.monthRoot.stem, officer.monthRoot.placement], ['month', sample.stem, 'main_qi']);
    const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'natal-officer')).input;
    const prompt = formatFortuneFactAudit(model);
    if (sample.killer) {
      assert.deepEqual(officer.exposedKillers.map(row => [row.column, row.stem]), [['hour', '甲']]);
      assert.match(prompt, /原局同时透出七杀，本命时柱甲寅的天干甲为七杀/u);
    } else {
      assert.deepEqual(officer.wealthToOfficer.filter(row => row.placement === 'stem').map(row => [row.column, row.stem]), [['month', '戊']]);
      assert.deepEqual(officer.officerToSeals.filter(row => row.placement === 'stem').map(row => [row.column, row.stem]), [['year', '壬']]);
      assert.deepEqual(officer.exposedKillers, []);
      assert.ok(officer.officerCombines.some(row => row.members.join() === 'day,hour'));
      assert.match(prompt, /与这一官干有财生官关系，[^。]*本命月柱戊申的天干戊为正财/u);
      assert.match(prompt, /与这一官干有官生印关系，[^。]*本命年柱壬辰的天干壬为正印/u);
    }
    assert.doesNotMatch(prompt, /officerEvidence|sourceOfficerMonth|exposedKillers/u);
  }
});

test('p273-002 binds a void horse to its natal year or day reference and checks combination on that actual column', () => {
  const samples = [
    { year: 1955, month: 2, day: 25, hour: 16, gender: 1, pillars: ['乙未', '戊寅', '丁巳', '戊申'],
      target: 1992, annual: '壬申', horse: 'day', basis: 'year', xun: '甲午', combination: true, natalPair: ['day', 'hour'] },
    { year: 1960, month: 7, day: 24, hour: 4, gender: 1, pillars: ['庚子', '癸未', '癸丑', '甲寅'],
      target: 2019, annual: '己亥', horse: 'hour', basis: 'day', xun: '甲辰', combination: false, natalPair: ['year', 'day'] },
  ];
  for (const sample of samples) {
    const chart = archive(sample);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.target } };
    const now = Date.parse('2026-11-19T00:00:00Z'), reference = { snapshotId: 'void-horse-' + sample.target };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...reference, chart })));
    const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const result = matched(run, 10);
    assert.equal(result.status, 'partial');
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === sample.annual && result.sourceFactIds.includes(row.factId));
    const { sourceRelations, doubleCombineDetails } = fact.normalizedPayload;
    const pair = doubleCombineDetails.find(row => row.position === sample.horse);
    const horse = pair.heavenVirtueMonthGeneral.natalSupports.branchSupportDetails.find(row => row.position === sample.horse);
    assert.deepEqual(horse.voidSources, [{ position: sample.basis, xun: sample.xun }]);
    assert.equal(horse.voidHasCombination, sample.combination);
    assert.ok(sourceRelations.some(row => row.kind === '六合' && row.members.join() === sample.natalPair.join()));
    assert.ok(sourceRelations.some(row => row.kind === '六合' && row.members.join() === sample.horse + ',annual'));
    assert.ok(horse.contacts.every(row => row.members.includes(sample.horse) && !row.members.includes('annual')));
    if (!sample.combination) {
      assert.ok(sourceRelations.some(row => row.kind === '六冲' && row.members.join() === 'month,day'));
      assert.deepEqual(horse.contacts, []);
    }
    const { input: model } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'void-horse'));
    const prompt = formatFortuneFactAudit(model);
    assert.match(prompt, sample.combination ? /落在本命年柱所属甲午旬空/u : /落在本命日柱所属甲辰旬空/u);
    assert.equal(prompt.includes('空亡所在柱另有六合，属于〈论空亡〉所列合解候选'), sample.combination);
    assert.doesNotMatch(prompt, /voidSources|branchSupportDetails|voidHasCombination/u);
  }
});

test('p273-002 accepts the verified year-and-luck pair only after its actual stage transition', () => {
  const chart = archive({ year: 1965, month: 5, day: 15, hour: 12, gender: 0,
    pillars: ['乙巳', '辛巳', '己巳', '庚午'] });
  const native = chart.bazi.rawResult[0];
  chart.birthContext = { precision: 'minute', birthInstant: native.utc, latitude: 39.9042,
    longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2022 } };
  const now = Date.parse('2026-11-19T00:00:00Z'), reference = { snapshotId: 'year-luck-combine-source' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...reference, chart })));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), 'year-luck-combine-run', reference);
  validateFortuneFacts(run);
  const boundary = '2022-08-15T08:00:00.000Z';
  const [previous, current] = facts(run).filter(row => row.normalizedPayload.yearPillar === '壬寅');
  assert.equal(previous.activeTo, boundary);
  assert.equal(previous.normalizedPayload.luckPillar, '丙戌');
  assert.equal(previous.normalizedPayload.luckAnnualCombination, 'none');
  assert.deepEqual(previous.normalizedPayload.doubleCombineReviewedPositions, []);
  assert.equal(current.activeFrom, boundary);
  assert.equal(current.normalizedPayload.luckPillar, '丁亥');
  assert.equal(current.normalizedPayload.luckAnnualCombination, 'both');
  assert.equal(current.normalizedPayload.hasSameColumnDoubleCombine, false);
  assert.deepEqual(current.normalizedPayload.doubleCombineReviewedPositions, ['luck']);
  assert.deepEqual(current.normalizedPayload.sourceDoubleCombinePositions, []);
  const [pair] = current.normalizedPayload.doubleCombineDetails;
  assert.deepEqual([pair.position, pair.pillar, pair.natalHouseTomb], ['luck', '丁亥', undefined]);
  assert.ok(pair.directFriction.some(row => row.kind === '六破'));
  assert.ok(pair.otherFriction.some(row => row.kind === '六冲' && row.members.join() === 'month,luck'));
  const result = matched(run, 10);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.sourceFactIds, [current.factId]);
  assert.deepEqual(result.windows, [{ start: boundary, endExclusive: current.activeTo }]);
  assert.equal(matched(run, 9).status, 'not_matched');

  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'year-luck-combine-report')).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /同段已核大运丁亥与太岁干支俱合/u);
  assert.doesNotMatch(prompt, /luckAnnualCombination|participantAtMoonVirtue/u);
  assert.ok(model.sections.every(section => section.findings.every(row => row.knowledgeId !== result.knowledgeId)));

  for (const [pillar, kind] of [['丁丑', 'stem-only'], ['己亥', 'branch-only']]) {
    const classified = baziAnnualColumnRelations(native, true, '壬寅', { status: 'confirmed', pillar });
    assert.equal(classified.luckAnnualCombination, kind);
    assert.deepEqual(classified.doubleCombineReviewedPositions, []);
    const single = structuredClone(run);
    Object.assign(facts(single).find(row => row.factId === current.factId).normalizedPayload, classified);
    assert.equal(matched(single, 10).status, 'not_matched');
  }
  const unverified = structuredClone(run);
  facts(unverified).find(row => row.factId === current.factId).normalizedPayload.luckStatus = 'unavailable';
  assert.deepEqual(matched(unverified, 10).sourceFactIds, []);
});

test('p273-002 confirms the same-pillar geometry only during its real matching luck stage', () => {
  const run = submitCompleteYear({ year: 1965, month: 2, day: 9, hour: 12, gender: 1 }, 2026);
  const boundary = '2026-10-25T08:00:00.000Z';
  const previous = facts(run).find(row => row.activeTo === boundary);
  const current = facts(run).find(row => row.activeFrom === boundary);
  assert.equal(previous.normalizedPayload.luckPillar, '壬申');
  assert.deepEqual(previous.normalizedPayload.sourceDoubleCombinePositions, []);
  assert.equal(current.normalizedPayload.yearPillar, '丙午');
  assert.equal(current.normalizedPayload.luckPillar, '辛未');
  assert.deepEqual(current.normalizedPayload.sourceDoubleCombinePositions, ['luck']);
  const result = matched(run, 10);
  assert.equal(result.status, 'matched');
  assert.equal(result.matchedSourceExcerpt, '若干支俱合');
  assert.deepEqual(result.sourceFactIds, [current.factId]);
  assert.deepEqual(result.windows, [{ start: boundary, endExclusive: current.activeTo }]);

  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'confirmed-luck-combine')).input;
  const finding = model.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId);
  assert.ok(finding);
  assert.deepEqual(finding.windows, result.windows);
  const prompt = formatFortunePrompt(model);
  assert.match(prompt, /按原书岁君与大运同论，确认当段俱合的位置/u);
  assert.doesNotMatch(prompt, /主添進人口|sourceDoubleCombinePositions/u);

  const unreviewed = structuredClone(run);
  const newPayload = facts(unreviewed).find(row => row.factId === current.factId).normalizedPayload;
  delete newPayload.sourceDoubleCombinePositions;
  assert.equal(matched(unreviewed, 10).status, 'partial');
});

test('unconfirmed hour is omitted and negative global predicates stay unknown, while a positive known day or column survives',()=>{
  const n={year:'庚午',month:'戊寅',day:'甲辰',hour:'乙丑'};
  const unknown=baziAnnualColumnRelations(n,false,'庚子',before);
  assert.equal(unknown.hourStemCombine,undefined);assert.equal(unknown.hasDayOrHourStemCombine,undefined);
  assert.equal(unknown.hasSameColumnDoubleCombine,undefined);assert.ok(!unknown.pairs.some(p=>p.position==='hour'));
  assert.equal(unknown.dayHourStemCombinePositions, undefined);
  assert.equal(unknown.doubleCombineReviewedPositions, undefined);
  const known=baziAnnualColumnRelations(n,true,'庚子',before);assert.equal(known.hasDayOrHourStemCombine,true);
  const positive=baziAnnualColumnRelations({...n,day:'甲子',hour:'ignored'},false,'己丑',before);
  assert.equal(positive.hasDayOrHourStemCombine,true);assert.equal(positive.hasSameColumnDoubleCombine,true);
  assert.deepEqual(positive.dayHourStemCombinePositions, ['day']);
  assert.ok(positive.doubleCombineReviewedPositions.includes('day'));
  assert.equal(positive.dayHourMonthDuty, undefined);
});

test('whole GengShen, exposed metal, exposed Gui, hidden Gui and both/one/neither witnesses are distinct, never declared effective rescue',()=>{
  const cases=[
    [natal,'neither-present'],
    [{...natal,year:'庚申',month:'癸未'},'both-present'],
    [{...natal,year:'庚午',month:'丙申'},'metal-only'],
    [{...natal,month:'癸未'},'gui-only'],
  ];
  for(const [n,expected]of cases){
    const p=baziAnnualColumnRelations(n,true,'戊戌',before);assert.equal(p.witnessBranch,expected);
    assert.ok(p.hiddenGui.some(p=>p.position==='day'));assert.equal(p.rescueEffective,undefined);assert.equal(p.stemTransformation,undefined);
    if(expected==='metal-only'){assert.deepEqual(p.natalGengShenPositions,[]);assert.equal(p.metalPresent,true);assert.equal(p.guiPresent,false);}
  }
  const unknown=baziAnnualColumnRelations(natal,true,'戊戌');assert.equal(unknown.metalPresent,undefined);assert.equal(unknown.guiPresent,undefined);assert.equal(unknown.witnessBranch,undefined);
  const both=baziAnnualColumnRelations({...natal,year:'庚申',month:'癸未'},false,'戊戌');assert.equal(both.witnessBranch,'both-present');
  const missingHour=baziAnnualColumnRelations(natal,false,'戊戌',before);assert.equal(missingHour.witnessBranch,undefined);
  const metal=baziAnnualColumnRelations(natal,true,'戊戌',{status:'confirmed',pillar:'庚申'});assert.equal(metal.luckGengShen,true);assert.equal(metal.exposedMetal[0].position,'luck');
});

test('the natal/luck metal members cannot borrow the annual branch, and source relations retain actual column identities',()=>{
  const n={year:'乙巳',month:'丁酉',day:'甲子',hour:'丙寅'};
  const without=baziAnnualColumnRelations(n,true,'己丑',before);assert.deepEqual(without.metalGroups,[]);
  const withLuck=baziAnnualColumnRelations(n,true,'己丑',{status:'confirmed',pillar:'辛丑'});
  assert.equal(withLuck.metalGroups.length,1);assert.deepEqual(withLuck.metalGroups[0].byBranch,[['year'],['month'],['luck']]);
  assert.ok(withLuck.sourceRelations.some(p=>p.kind==='六合'&&p.members.includes('annual')));
  assert.equal(withLuck.metalGroups[0].effective,undefined);
});

test('source qualification recomputes archived clock and each reliable pillar, and ignores an unconfirmed sampled hour',()=>{
  const n=archive().bazi.rawResult[0];assert.equal(annualRelationNatalClockReady(n,true),true);
  for(const position of ['year','month','day','hour']){const wrong={...n,[position]:n[position]==='甲子'?'丙寅':'甲子'};assert.equal(annualRelationNatalClockReady(wrong,true),false,position);}
  assert.equal(annualRelationNatalClockReady({...n,hour:'ignored'},false),true);
  assert.equal(annualRelationNatalClockReady({...n,utc:'invalid'},true),false);
});

test('real Jia/Wu years retain both structural witness paths after Li Chun with complete raw provenance',()=>{
  const run=runFor('jiaWuBothWitnesses');validateFortuneFacts(run);assert.notEqual(run.methods.bazi.status,'failed');
  const result=matched(run,6);assert.equal(result.status,'matched');assert.ok(result.windows.length);
  assert.equal(result.matchedSourceExcerpt, '若五行有救四柱有情如甲日尅戊年');
  assert.ok(result.windows[0].start>'2018-02-01T00:00:00Z');
  const positive=facts(run).filter(f=>f.normalizedPayload.yearStem==='戊');assert.ok(positive.length);
  for(const f of positive){
    const p=f.normalizedPayload;assert.equal(p.dayMaster,'甲');assert.equal(p.yearTenGod,'偏财');assert.equal(p.dayControlsYear,true);
    assert.deepEqual(p.natalGengShenPositions,['year']);assert.equal(p.witnessBranch,'both-present');
    assert.ok(p.exposedGui.some(r=>r.position==='month'));assert.equal(p.luckStatus,'confirmed');
    assert.equal(p.jiaWuRescueCandidate, true);
    assert.ok(p.jiaWuRescue.metalControls.some(row => row.position === 'year' && row.target === 'day'));
    assert.ok(p.jiaWuRescue.guiCombines.some(row => row.position === 'month' && row.target === 'annual'));
    assert.ok(f.sourceFactIds.length>=2&&f.sourceFactIds.every(id=>run.rawFacts.some(r=>r.rawFactId===id)));
  }
  const confirmed = positive.find(fact => result.sourceFactIds.includes(fact.factId));
  assert.equal(confirmed.normalizedPayload.jiaWuNamedRescuePair, true);
  assert.deepEqual(result.windows, [{ start: confirmed.activeFrom, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
  for (const jiaWuNamedRescuePair of [false, undefined]) {
    const oldFact = { ...confirmed, normalizedPayload: { ...confirmed.normalizedPayload, jiaWuNamedRescuePair } };
    assert.equal(matched({ ...run, facts: [oldFact] }, 6).status, 'partial');
  }
});

test('p267-004 confirms only the actual sole witness after a luck handoff or with no metal present', () => {
  const metalBirth = { year: 1980, month: 5, day: 11, hour: 10, gender: 1, pillars: ['庚申', '辛巳', '甲申', '己巳'] };
  const metalRun = submitCompleteYear(metalBirth, 2008);
  const cut = '2008-11-05T08:00:00.000Z';
  const prior = facts(metalRun).find(row => row.activeTo === cut);
  const after = facts(metalRun).find(row => row.activeFrom === cut);
  assert.ok(prior && after);
  assert.equal(prior.normalizedPayload.luckPillar, '癸未');
  assert.equal(prior.normalizedPayload.jiaWuNamedRescuePair, true);
  assert.equal(prior.normalizedPayload.jiaWuSoleWitnessPath, undefined);
  assert.equal(after.normalizedPayload.luckPillar, '甲申');
  assert.equal(after.normalizedPayload.jiaWuSoleWitnessPath, 'named-metal-only');
  assert.deepEqual(after.normalizedPayload.hiddenGui, []);
  const byTime = matched(metalRun, 6);
  assert.equal(byTime.status, 'matched');
  assert.deepEqual(byTime.confirmedBranches.map(branch => branch.windows), [prior, after]
    .map(row => [{ start: row.activeFrom, endExclusive: row.activeTo }]));
  assert.match(byTime.confirmedBranches[0].conditions.join(' '), /恰有一处明癸与岁戊五合/u);
  assert.match(byTime.confirmedBranches[1].conditions.join(' '), /四柱与实际大运明藏位置均未见癸/u);
  const afterOnly = { ...metalRun, facts: [after] };
  const afterReport = interpretFortune(afterOnly, requestForFortuneRun(afterOnly), 'jia-wu-sole-metal');
  const afterPrompt = formatFortunePrompt(buildFortuneModelContext(afterOnly, afterReport).input);
  assert.match(afterPrompt, /同段本命有完整庚申，明庚制日甲/u);
  assert.doesNotMatch(afterPrompt, /恰有一处明癸与岁戊五合|jiaWuSoleWitnessPath/u);

  const guiBirth = { year: 1962, month: 3, day: 7, hour: 0, gender: 0, pillars: ['壬寅', '癸卯', '甲辰', '甲子'] };
  const guiRun = submitCompleteYear(guiBirth, 1998);
  const guiResult = matched(guiRun, 6);
  assert.equal(guiResult.status, 'matched');
  const gui = facts(guiRun).find(row => guiResult.sourceFactIds.includes(row.factId));
  const p = gui.normalizedPayload;
  assert.equal(p.luckPillar, '己亥');
  assert.equal(p.jiaWuSoleWitnessPath, 'gui-only');
  assert.deepEqual(p.jiaWuRescue.metalControls, []);
  assert.deepEqual(p.jiaWuRescue.guiCombines.map(row => row.position), ['month']);
  const guiPrompt = formatFortunePrompt(buildFortuneModelContext(guiRun,
    interpretFortune(guiRun, requestForFortuneRun(guiRun), 'jia-wu-sole-gui')).input);
  assert.match(guiPrompt, /四柱与实际大运的明藏位置均未见庚辛/u);
  assert.doesNotMatch(guiPrompt, /明庚制日甲|凶半|jiaWuSoleWitnessPath/u);
  const guiNatal = archive(guiBirth).bazi.rawResult[0];
  assert.equal(baziAnnualColumnRelations(guiNatal, false, '戊寅', { status: 'confirmed', pillar: '己亥' }).jiaWuSoleWitnessPath, undefined);
  assert.equal(baziAnnualColumnRelations(guiNatal, true, '戊寅').jiaWuSoleWitnessPath, undefined);
});

test('p267-004 confirms actual Geng-Shen luck independently from the native pillar and the Gui companion', () => {
  for (const [birth, start, state, gui] of [
    [{ year: 1954, month: 5, day: 18, hour: 12, gender: 0, pillars: ['甲午', '己巳', '甲戌', '庚午'] },
      '2038-05-30T00:00:00.000Z', 'moving-metal-only', false],
    [{ year: 1952, month: 12, day: 4, hour: 18, gender: 1, pillars: ['壬辰', '辛亥', '甲申', '癸酉'] },
      '2038-02-03T18:03:48.000Z', 'moving-metal-with-gui', true],
  ]) {
    const run = submitCompleteYear(birth, 2038), hit = matched(run, 6), rows = facts(run);
    assert.equal(hit.status, 'matched');
    const endExclusive = run.time.displayWindow.instantRange.endInstantExclusive;
    const current = rows.find(row => row.activeFrom === start);
    const confirmed = matched({ ...run, facts: [current] }, 6);
    assert.equal(confirmed.matchedSourceExcerpt, '大運中亦有將甲木製伏');
    assert.deepEqual(confirmed.windows, [{ start, endExclusive }]);
    assert.deepEqual(hit.windows, [{ start: '2038-02-03T18:03:48.000Z', endExclusive }]);
    const p = current.normalizedPayload;
    assert.equal(p.jiaWuNamedRescuePair, false);
    assert.equal(p.jiaWuMovingMetalWitness, state);
    assert.equal(p.luckPillar, '庚申');
    assert.ok(p.jiaWuRescue.metalControls.some(row => row.position === 'luck' && row.target === 'day'));
    assert.equal(p.jiaWuRescue.guiCombines.length > 0, gui);
    const previous = rows.find(row => row.activeTo === start);
    assert.equal(previous.normalizedPayload.jiaWuMovingMetalWitness, undefined);
    assert.equal(previous.normalizedPayload.jiaWuRootedXinWitness, gui ? undefined : 'metal-only');
    if (!gui) assert.deepEqual(hit.confirmedBranches.map(row => row.windows),
      [[{ start, endExclusive }], [{ start: previous.activeFrom, endExclusive: start }]]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'jia-wu-moving-metal'));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /实际大运为庚申。运干明庚制日甲/u);
    assert.equal(/同段另有一处明癸与岁戊实合/u.test(prompt), gui);
    assert.doesNotMatch(prompt, /jiaWuMovingMetalWitness|本命有完整庚申/u);
  }
});

test('p267-004 starts at the actual luck transition that introduces a verified directed metal witness', () => {
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2038 } };
  const now = Date.parse('2026-11-19T00:00:00Z'), reference = { snapshotId: 'jia-wu-transition' };
  const chart = archive({ year: 1994, month: 2, day: 17, hour: 4, gender: 0 });
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...reference, chart })));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), 'jia-wu-run', reference);
  validateFortuneFacts(run);
  const match = matched(run, 6), boundary = '2038-05-19T08:00:00.000Z';
  assert.equal(run.calculationSource, 'client');
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.windows, [{ start: boundary, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
  const before = facts(run).find(fact => fact.activeTo === boundary).normalizedPayload;
  assert.equal(before.yearPillar, '戊午');
  assert.equal(before.luckPillar, '壬戌');
  assert.equal(before.jiaWuRescueCandidate, false);
  const after = facts(run).find(fact => match.sourceFactIds.includes(fact.factId)).normalizedPayload;
  assert.equal(after.luckPillar, '辛酉');
  assert.equal(after.jiaWuRootedXinWitness, undefined);
  assert.deepEqual(after.jiaWuRescue.metalControls, [{
    position: 'luck', pillar: '辛酉', target: 'day', fireControls: [
      { position: 'month', pillar: '丙寅' }, { position: 'hour', pillar: '丙寅' },
    ],
    otherCombines: [{ position: 'month', pillar: '丙寅' }, { position: 'hour', pillar: '丙寅' }],
  }]);
  assert.deepEqual(after.jiaWuRescue.woodClause.extraWood, [{ position: 'year', pillar: '甲戌' }]);
  assert.equal(after.jiaWuRescue.fireCandidate, false);
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'jia-wu-report')).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /同段已核大运辛酉的辛金克日干甲，同段该金另受本命月柱丙寅、本命时柱丙寅的丙丁火反克/u);
  assert.match(prompt, /本命生于寅月，除日干外，本命年柱甲戌另有甲乙透干/u);
  assert.doesNotMatch(prompt, /jiaWuRescue|metalControls|fireControls/u);
  assert.ok(model.sections.every(section => section.findings.every(row => row.knowledgeId !== match.knowledgeId)));
});

test('p267-004 verifies rooted Xin in the natal or active luck column, with and without a separate Gui witness', () => {
  const cases = [
    [{ year: 1981, month: 2, day: 15, hour: 2, gender: 0 }, 2008, '戊子', '癸巳', 'year', 'metal-with-gui'],
    [{ year: 1981, month: 7, day: 15, hour: 10, gender: 1 }, 2028, '戊申', '庚寅', 'year', 'metal-only'],
    [{ year: 1993, month: 7, day: 12, hour: 2, gender: 0 }, 2018, '戊戌', '辛酉', 'luck', 'metal-with-gui'],
    [{ year: 1974, month: 5, day: 13, hour: 10, gender: 0 }, 2048, '戊辰', '辛酉', 'luck', 'metal-only'],
  ];
  for (const [birth, year, annual, luck, position, state] of cases) {
    const run = submitCompleteYear(birth, year), result = matched(run, 6);
    assert.equal(result.status, 'matched');
    assert.equal(result.matchedSourceExcerpt, '干頭須要庚辛');
    const fact = facts(run).find(row => row.normalizedPayload.yearPillar === annual);
    const p = fact.normalizedPayload;
    assert.equal(p.luckPillar, luck);
    assert.equal(p.jiaWuRootedXinWitness, state);
    const metal = p.jiaWuRescue.metalRootReview.find(row => row.position === position);
    assert.equal(metal.pillar, '辛酉');
    assert.ok(metal.roots.some(root => root.position === position && root.sameStem && root.mainQi && !root.clashes.length));
    assert.deepEqual(result.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    assert.deepEqual(result.sourceFactIds, [fact.factId]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'rooted-xin'));
    const provider = formatFortunePrompt(input);
    assert.match(provider, /酉中本气辛为同干根，明辛克日甲/u);
    assert.equal(/同段另有唯一明癸与岁戊五合/u.test(provider), state === 'metal-with-gui');
    assert.doesNotMatch(provider, /jiaWuRootedXinWitness|metalRootReview/u);
  }
});

test('p267-004 confirms exposed metal with an undisturbed same-stem Lu root on a separate actual column', () => {
  for (const { birth, year, boundary, annual, beforeLuck, afterLuck, exposed, root, state, growth } of [
    { birth: { year: 1990, month: 3, day: 10, hour: 10, gender: 1 }, year: 2038,
      boundary: '2038-11-05T02:00:00.000Z', annual: '戊午', beforeLuck: '癸未', afterLuck: '甲申',
      exposed: ['year', '庚午'], root: '甲申', state: 'metal-only', growth: ['hour', '己巳'] },
    { birth: { year: 1980, month: 5, day: 11, hour: 18, gender: 1 }, year: 2018,
      boundary: '2018-09-26T16:00:00.000Z', annual: '戊戌', beforeLuck: '甲申', afterLuck: '乙酉',
      exposed: ['month', '辛巳'], root: '乙酉', state: 'metal-with-gui' },
  ]) {
    const run = submitCompleteYear(birth, year);
    const before = facts(run).find(row => row.activeTo === boundary && row.normalizedPayload.luckPillar === beforeLuck);
    const after = facts(run).find(row => row.activeFrom === boundary && row.normalizedPayload.luckPillar === afterLuck);
    assert.ok(before && after);
    assert.equal(before.normalizedPayload.jiaWuCrossColumnMetalWitness, undefined);
    const beforeMatch = matched({ ...run, facts: [before] }, 6);
    assert.equal(beforeMatch.status, 'matched');
    if (growth) {
      assert.equal(before.normalizedPayload.jiaWuGrowingGengMetalWitness, 'metal-with-gui');
      const [growthWitness] = before.normalizedPayload.jiaWuRescue.gengGrowthRoots;
      assert.deepEqual([growthWitness.root.position, growthWitness.root.pillar], growth);
      assert.equal(growthWitness.root.stem, '庚');
      assert.equal(growthWitness.root.mainQi, false);
      assert.deepEqual(growthWitness.root.clashes, []);
      assert.deepEqual(before.normalizedPayload.jiaWuRescue.guiCombines.map(row => [row.position, row.pillar]), [['luck', '癸未']]);
      assert.equal(beforeMatch.matchedSourceExcerpt, '干頭須要庚辛');
      assert.deepEqual(beforeMatch.windows, [{ start: before.activeFrom, endExclusive: boundary }]);
      const scoped = { ...run, facts: [before] };
      const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'jia-wu-geng-growth'));
      const local = /为卷二所列庚之长生位/u;
      assert.match(formatFortuneFactAudit(input), local);
      assert.match(formatFortunePrompt(input), /干頭須要庚辛/u);
      assert.doesNotMatch(formatFortunePrompt(input), local);
      const noonRun = submitCompleteYear({ ...birth, hour: 12 }, year);
      const noon = facts(noonRun).find(row => row.normalizedPayload.luckPillar === beforeLuck && row.normalizedPayload.yearPillar === annual);
      assert.ok(noon);
      assert.equal(noon.normalizedPayload.jiaWuGrowingGengMetalWitness, undefined);
      assert.equal(matched({ ...noonRun, facts: [noon] }, 6).status, 'partial');
    } else {
      assert.equal(before.normalizedPayload.jiaWuGrowingGengMetalWitness, undefined);
    }
    const p = after.normalizedPayload;
    assert.equal(p.yearPillar, annual);
    assert.equal(p.jiaWuCrossColumnMetalWitness, state);
    assert.equal(p.jiaWuGrowingGengMetalWitness, undefined);
    const [position, pillar] = exposed;
    assert.ok(p.jiaWuRescue.metalControls.some(row => row.position === position && row.pillar === pillar
      && row.target === 'day' && !row.fireControls.length && !row.otherCombines.length));
    const metalRoot = p.jiaWuRescue.metalRootReview.find(row => row.position === position && row.pillar === pillar);
    assert.ok(metalRoot.roots.some(row => row.position === 'luck' && row.pillar === root && row.sameStem
      && row.mainQi && !row.clashes.length));
    assert.equal(p.jiaWuRescue.guiCombines.length, state === 'metal-with-gui' ? 1 : 0);
    const scoped = { ...run, facts: [after] }, matchedAfter = matched(scoped, 6);
    assert.equal(matchedAfter.status, 'matched');
    assert.equal(matchedAfter.matchedSourceExcerpt, '干頭須要庚辛');
    assert.deepEqual(matchedAfter.windows, [{ start: boundary, endExclusive: after.activeTo }]);
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'jia-wu-separate-root'));
    assert.match(formatFortunePrompt(input), /本气.*同干|同干.*本气/u);
    assert.doesNotMatch(formatFortunePrompt(input), /jiaWuCrossColumnMetalWitness|本命有完整庚申/u);
    const natal = archive(birth).bazi.rawResult[0];
    assert.equal(baziAnnualColumnRelations(natal, true, annual, { status: 'before_luck' }).jiaWuCrossColumnMetalWitness, undefined);
  }
  const rootClash = baziAnnualColumnRelations({ year: '庚午', month: '己卯', day: '甲戌', hour: '己巳' }, true, '戊寅',
    { status: 'confirmed', pillar: '甲申' });
  assert.ok(rootClash.jiaWuRescue.metalRootReview[0].roots.some(row => row.position === 'luck' && row.sameStem && row.clashes.length));
  assert.equal(rootClash.jiaWuCrossColumnMetalWitness, undefined);
});

test('p267-004 distinguishes two verified visible paths from two paths with a real countercontact', () => {
  const examples = [
    { year: 1960, month: 7, day: 15, hour: 12, gender: 0, targetYear: 1998,
      pillars: ['庚子', '癸未', '甲辰', '庚午'], luck: '己卯',
      state: 'verified-without-listed-counters', phrase: /参与戊癸合的两柱均未见六冲/u },
    { year: 1931, month: 5, day: 9, hour: 12, gender: 0, targetYear: 1968,
      luck: '丙申', state: 'with-countercontact', phrase: /至少一路的已见位置均有反克或另合/u },
    { year: 1963, month: 3, day: 2, hour: 14, gender: 1, targetYear: 2008,
      pillars: ['癸卯', '甲寅', '甲辰', '辛未'], luck: '庚戌',
      state: 'with-metal-root-clash', phrase: /所见藏金根所在柱均参与六冲/u,
      metalRoots: [['luck', ['day']]] },
    { year: 1950, month: 4, day: 9, hour: 18, gender: 0, targetYear: 2008,
      pillars: ['庚寅', '庚辰', '甲戌', '癸酉'], luck: '甲戌',
      state: 'verified-without-listed-counters', phrase: /参与戊癸合的两柱均未见六冲/u,
      metalRoots: [['day', ['month']], ['hour', []], ['luck', ['month']]] },
  ];
  for (const sample of examples) {
    const run = submitCompleteYear(sample, sample.targetYear);
    const result = matched(run, 6);
    assert.equal(result.status, 'partial', JSON.stringify({ sample: sample.pillars, targetYear: sample.targetYear,
      facts: facts(run).map(({ normalizedPayload: p }) => [p.yearPillar, p.luckPillar, p.jiaWuDualWitnessState]) }));
    const witness = facts(run).find(row => result.sourceFactIds.includes(row.factId));
    const p = witness.normalizedPayload;
    assert.equal(p.jiaWuDualWitnessState, sample.state);
    assert.equal(p.luckPillar, sample.luck);
    assert.ok(p.jiaWuRescue.metalControls.length && p.jiaWuRescue.guiCombines.length);
    assert.deepEqual(p.jiaWuRescue.guiCombines[0].branchClashes, []);
    if (sample.metalRoots) {
      const roots = p.jiaWuRescue.metalRootReview[0].roots;
      assert.deepEqual(roots.map(root => [root.position,
        root.clashes.flatMap(clash => clash.members.filter(position => position !== root.position))]), sample.metalRoots);
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), run.calculationRunId));
    const prompt = formatFortuneFactAudit(input);
    assert.match(prompt, sample.phrase);
    assert.doesNotMatch(prompt, /jiaWuDualWitnessState/u);
    assert.ok(input.sections.every(section => !section.findings.some(row => row.knowledgeId === result.knowledgeId)));
  }
  const known = archive(examples[0]).bazi.rawResult[0];
  const partial = baziAnnualColumnRelations(known, false, '戊寅', { status: 'confirmed', pillar: '己卯' });
  assert.equal(partial.jiaWuDualWitnessState, 'coverage-unverified');
  assert.equal(partial.jiaWuRescueCandidate, true);
});

test('p267-004 distinguishes a known missing witness from hidden Gui or an unverified stage', () => {
  const native = { year: 1978, month: 2, day: 21, hour: 4, gender: 0 };
  const absent = calculate(archive(native), 2028);
  assert.ok(facts(absent).some(row => row.normalizedPayload.jiaWuRescueCandidate === false));
  assert.equal(matched(absent, 6).status, 'not_matched');

  const hidden = calculate(archive({ ...native, day: 11 }), 2028);
  const p = facts(hidden).find(row => row.normalizedPayload.yearPillar === '戊申').normalizedPayload;
  assert.deepEqual(p.hiddenGui.map(row => row.position), ['day']);
  assert.deepEqual(p.jiaWuRescue.guiCombines, []);
  assert.equal(p.jiaWuRescueCandidate, undefined);
  assert.equal(matched(hidden, 6).status, 'unknown');

  const unverified = archive(native);
  unverified.bazi.rawResult[0].luckPeriods = [];
  assert.equal(matched(calculate(unverified, 2028), 6).status, 'unknown');
  const unknownHour = archive(native);
  unknownHour.timeKnown = false;
  assert.equal(matched(calculate(unknownHour, 2028), 6).status, 'unknown');
});

test('p267-004 checks actual competing combinations on both rescue paths at a verified luck transition', () => {
  const samples = [
    { year: 1973, month: 9, day: 25, hour: 0, gender: 0, pillars: ['癸丑', '辛酉', '甲子', '甲子'],
      target: 1988, annual: '戊辰', boundary: '1988-04-26T22:00:00.000Z', oldLuck: '壬戌', newLuck: '癸亥',
      oldClashes: [['luck', 'annual']], newClashes: [],
      competing: ['year', 'luck'], metalPartners: [], phrase: /本命年柱、同段已核大运各有透癸，同段并合一个岁干戊/u },
    { year: 2000, month: 7, day: 15, hour: 0, gender: 1, pillars: ['庚辰', '癸未', '甲戌', '甲子'],
      target: 2018, annual: '戊戌', boundary: '2018-05-19T20:00:00.000Z', oldLuck: '甲申', newLuck: '乙酉',
      oldClashes: [['year', 'annual']], newClashes: [['year', 'annual']],
      competing: [], metalPartners: [{ position: 'luck', pillar: '乙酉' }],
      rootChange: { oldStem: '庚', newStem: '辛' },
      phrase: /本命年柱庚辰的庚金克日干甲，该金同时与同段已核大运乙酉的天干五合/u },
  ];
  for (const sample of samples) {
    const chart = archive(sample);
    chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
      longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
    const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: sample.target } };
    const now = Date.parse('2026-11-19T00:00:00Z'), reference = { snapshotId: 'jia-wu-competition-' + sample.target };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...reference, chart })));
    const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), reference.snapshotId, reference);
    validateFortuneFacts(run);
    const result = matched(run, 6);
    assert.equal(result.status, 'partial');
    const [previous, current] = facts(run).filter(row => row.normalizedPayload.yearPillar === sample.annual
      && result.sourceFactIds.includes(row.factId));
    assert.equal(previous.activeTo, sample.boundary);
    assert.equal(current.activeFrom, sample.boundary);
    const before = previous.normalizedPayload, after = current.normalizedPayload;
    assert.equal(before.luckPillar, sample.oldLuck);
    assert.equal(after.luckPillar, sample.newLuck);
    assert.equal(before.jiaWuDualWitnessState, 'with-gui-branch-clash');
    assert.equal(after.jiaWuDualWitnessState, 'with-countercontact');
    assert.deepEqual(before.jiaWuRescue.guiCompetingPositions, []);
    assert.deepEqual(before.jiaWuRescue.metalControls[0].otherCombines, []);
    assert.deepEqual(after.jiaWuRescue.guiCompetingPositions, sample.competing);
    assert.deepEqual(after.jiaWuRescue.metalControls[0].otherCombines, sample.metalPartners);
    assert.deepEqual(after.jiaWuRescue.metalControls[0].fireControls, []);
    assert.deepEqual(before.jiaWuRescue.guiCombines[0].branchClashes.map(row => row.members), sample.oldClashes);
    assert.deepEqual(after.jiaWuRescue.guiCombines[0].branchClashes.map(row => row.members), sample.newClashes);
    const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'jia-wu-competition')).input;
    const prompt = formatFortuneFactAudit(model);
    assert.match(prompt, sample.phrase);
    assert.match(prompt, /戊癸合的柱位见六冲。制合效力仍待核/u);
    assert.doesNotMatch(prompt, /guiCompetingPositions|otherCombines|metalRootReview/u);
    if (sample.rootChange) {
      const oldMetal = before.jiaWuRescue.metalRootReview.find(row => row.position === 'year');
      const newMetal = after.jiaWuRescue.metalRootReview.find(row => row.position === 'year');
      assert.equal(oldMetal.luBranch, '申');
      assert.equal(newMetal.luBranch, '申');
      assert.deepEqual(oldMetal.roots.find(row => row.position === 'luck'), {
        position: 'luck', pillar: '甲申', stem: sample.rootChange.oldStem, mainQi: true, sameStem: true, clashes: [],
      });
      assert.deepEqual(newMetal.roots.find(row => row.position === 'luck'), {
        position: 'luck', pillar: '乙酉', stem: sample.rootChange.newStem, mainQi: true, sameStem: false, clashes: [],
      });
      assert.ok(newMetal.roots.some(row => row.position === 'day' && row.stem === '辛' && !row.mainQi && !row.sameStem));
      assert.match(prompt, /同段已核大运甲申本气庚为同干根/u);
      assert.match(prompt, /同段已核大运乙酉本气辛为同五行异干根/u);
    }
  }
});

test('p267-004 retains separate six-clashes to the two columns that form the Wu-Gui stem combination', () => {
  const chart = archive({ year: 1968, month: 1, day: 15, hour: 12, gender: 0,
    pillars: ['丁未', '癸丑', '甲申', '庚午'] });
  chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
    longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 1998 } };
  const now = Date.parse('2026-11-19T00:00:00Z'), reference = { snapshotId: 'jia-wu-clashed-combination' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...reference, chart })));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const result = matched(run, 6);
  assert.equal(result.status, 'partial');
  const witness = facts(run).find(row => row.normalizedPayload.yearPillar === '戊寅' && result.sourceFactIds.includes(row.factId));
  const [gui] = witness.normalizedPayload.jiaWuRescue.guiCombines;
  assert.equal(gui.position, 'month');
  assert.equal(gui.pillar, '癸丑');
  assert.equal(witness.normalizedPayload.luckPillar, '丙辰');
  assert.deepEqual(gui.branchClashes, [
    { kind: '六冲', members: ['year', 'month'], values: '未丑' },
    { kind: '六冲', members: ['day', 'annual'], values: '申寅' },
  ]);
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId)).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /本命月柱癸丑的癸与岁干戊五合，参与干合的柱另见本命年柱与本命月柱六冲、本命日柱与本段太岁六冲/u);
  assert.doesNotMatch(prompt, /with-gui-branch-clash|branchClashes/u);
});

test('p267-004 ties the annual clash to each actual natal root without treating the annual branch as a root', () => {
  const chart = archive(ref.realExamples.jiaWuBothWitnesses);
  chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042,
    longitude: 116.4074, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 1998 } };
  const now = Date.parse('2026-11-19T00:00:00Z'), reference = { snapshotId: 'jia-wu-root-clash' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(input, now, { ...reference, chart })));
  const run = bindClientFortuneRun(input, batch, readClientFactTime(input, batch, now), reference.snapshotId, reference);
  validateFortuneFacts(run);
  const result = matched(run, 6);
  assert.equal(result.status, 'partial');
  const witness = facts(run).find(row => row.normalizedPayload.yearPillar === '戊寅' && result.sourceFactIds.includes(row.factId));
  const metal = witness.normalizedPayload.jiaWuRescue.metalRootReview.find(row => row.position === 'year');
  assert.equal(witness.normalizedPayload.jiaWuNamedRescuePair, false);
  assert.equal(metal.pillar, '庚申');
  assert.equal(metal.luBranch, '申');
  for (const position of ['year', 'day']) {
    const root = metal.roots.find(row => row.position === position);
    assert.equal(root.stem, '庚');
    assert.equal(root.mainQi, true);
    assert.equal(root.sameStem, true);
    assert.deepEqual(root.clashes.map(contact => contact.members), [[position, 'annual']]);
  }
  assert.ok(metal.roots.every(row => row.position !== 'annual'));
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), reference.snapshotId)).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /本命年柱庚申本气庚为同干根，根所在柱与本段太岁六冲/u);
  assert.match(prompt, /本命日柱甲申本气庚为同干根，根所在柱与本段太岁六冲/u);
});

test('p267-004 keeps other Wu contacts and the natal-only fire-assembly proviso distinct', () => {
  const withOtherWu = baziAnnualColumnRelations({ year: '庚申', month: '戊寅', day: '甲午', hour: '癸酉' },
    true, '戊戌', { status: 'confirmed', pillar: '丁卯' });
  assert.deepEqual(withOtherWu.jiaWuRescue.guiCombines, [{
    position: 'hour', pillar: '癸酉', target: 'annual', otherWuPositions: ['month'],
    branchClashes: [{ kind: '六冲', members: ['hour', 'luck'], values: '酉卯' }],
  }]);
  assert.deepEqual(withOtherWu.jiaWuRescue.metalControls[0].fireControls, [{ position: 'luck', pillar: '丁卯' }]);

  const extraWood = { year: '甲戌', month: '丁卯', day: '甲午', hour: '丙寅' };
  const fire = baziAnnualColumnRelations(extraWood, true, '戊申', before);
  assert.deepEqual(fire.jiaWuRescue.woodClause.natalFireMembers, [['hour'], ['day'], ['year']]);
  assert.equal(fire.jiaWuRescue.fireCandidate, true);
  assert.equal(fire.jiaWuRescueCandidate, true);
  const onlyLuck = baziAnnualColumnRelations({ ...extraWood, hour: '丁卯' }, true, '戊申',
    { status: 'confirmed', pillar: '丙寅' });
  assert.equal(onlyLuck.jiaWuRescue.woodClause.natalFireMembers, undefined);
  assert.equal(onlyLuck.jiaWuRescue.fireCandidate, false);
  assert.equal(onlyLuck.jiaWuRescueCandidate, false);

  const run = calculate(archive({ year: 1994, month: 3, day: 9, hour: 4, gender: 0,
    pillars: ['甲戌', '丁卯', '甲午', '丙寅'] }), 1998);
  const match = matched(run, 6);
  assert.equal(match.status, 'partial');
  const { normalizedPayload: p } = facts(run).find(fact => match.sourceFactIds.includes(fact.factId));
  assert.equal(p.yearPillar, '戊寅');
  assert.deepEqual(p.jiaWuRescue.metalControls, []);
  assert.deepEqual(p.jiaWuRescue.guiCombines, []);
  assert.equal(p.jiaWuRescue.fireCandidate, true);
});

test('p267-004 cannot substitute a metal group for an exposed witness before or after a real luck transition', () => {
  const run = submitCompleteYear({ year: 1952, month: 5, day: 18, hour: 2, gender: 1,
    pillars: ['壬辰', '乙巳', '甲子', '乙丑'] }, 1998);
  const change = run.facts.find(row => row.factType === 'luck_transition' && row.normalizedPayload.toPillar === '庚戌');
  assert.ok(change);
  const before = facts(run).find(row => row.activeTo === change.exactInstant && row.normalizedPayload.luckPillar === '己酉');
  const after = facts(run).find(row => row.activeFrom === change.exactInstant && row.normalizedPayload.luckPillar === '庚戌');
  assert.ok(before && after);
  assert.equal(before.normalizedPayload.yearPillar, '戊寅');
  assert.deepEqual(before.normalizedPayload.metalGroups[0].byBranch, [['month'], ['luck'], ['hour']]);
  assert.equal(before.normalizedPayload.jiaWuRescueCandidate, undefined);
  assert.deepEqual(before.normalizedPayload.jiaWuRescue.metalControls, []);
  assert.deepEqual(after.normalizedPayload.metalGroups, []);
  assert.deepEqual(after.normalizedPayload.jiaWuRescue.metalControls.map(row => [row.position, row.pillar, row.target]),
    [['luck', '庚戌', 'day']]);
  const result = matched(run, 6);
  assert.equal(result.status, 'partial');
  assert.ok(!result.sourceFactIds.includes(before.factId));
  assert.ok(result.sourceFactIds.includes(after.factId));
  assert.equal(result.windows[0].start, change.exactInstant);

  const natalOnly = submitCompleteYear({ year: 1957, month: 5, day: 12, hour: 2, gender: 0,
    pillars: ['丁酉', '乙巳', '甲申', '乙丑'] }, 1968);
  const { normalizedPayload: p } = facts(natalOnly).find(row => row.normalizedPayload.yearPillar === '戊申');
  assert.deepEqual(p.metalGroups[0].byBranch, [['month'], ['year'], ['hour']]);
  assert.equal(p.jiaWuRescue.woodClause, undefined);
  assert.equal(p.jiaWuRescueCandidate, undefined);
  assert.equal(matched(natalOnly, 6).status, 'unknown');
});

test('real cross-column and unrelated-year false positives are rejected; same-column and hour-only source candidates remain reachable',()=>{
  const cross=runFor('crossColumn'),unrelated=runFor('unrelatedYearOnly');
  assert.ok(cross.facts.some(f=>f.factType==='pillar_relation'&&f.normalizedPayload.kind==='天干五合'));
  assert.ok(cross.facts.some(f=>f.factType==='pillar_relation'&&f.normalizedPayload.kind==='六合'));
  assert.equal(matched(cross,10).status,'not_matched');assert.equal(matched(cross,9).status,'matched');
  assert.ok(unrelated.facts.some(f=>f.factType==='pillar_relation'&&f.normalizedPayload.kind==='天干五合'&&f.normalizedPayload.members.includes('flow:year')));
  assert.equal(matched(unrelated,9).status,'not_matched');
  assert.equal(matched(runFor('sameColumn'),10).status,'partial');
  const same=facts(runFor('sameColumn')).filter(f=>f.normalizedPayload.hasSameColumnDoubleCombine);
  assert.ok(same.some(f=>f.normalizedPayload.sameColumnCombines.includes('year')));
  const hourly=runFor('hourOnly');assert.equal(matched(hourly,9).status,'matched');
  assert.ok(facts(hourly).filter(f=>f.normalizedPayload.yearStem==='辛').every(f=>!f.normalizedPayload.dayStemCombine&&f.normalizedPayload.hourStemCombine));
});

test('annual and verified luck context split at the exact transition; no mixture across Li Chun or luck stages',()=>{
  const run=runFor('transition'),rows=facts(run),boundary=ref.realExamples.transition.boundary;
  assert.ok(rows.some(f=>f.activeTo===boundary&&f.normalizedPayload.luckPillar==='己丑'));
  assert.ok(rows.some(f=>f.activeFrom===boundary&&f.normalizedPayload.luckPillar==='庚寅'));
  for(const f of rows){
    assert.ok(f.activeFrom>=f.normalizedPayload.stageStart&&f.activeTo<=f.normalizedPayload.stageEnd);
    assert.ok(f.normalizedPayload.exposedMetal.every(w=>w.position!=='luck'||w.pillar===f.normalizedPayload.luckPillar));
  }
  assert.ok(rows.slice(1).every((f,i)=>f.activeFrom===rows[i].activeTo));
});

test('before-luck and unconfirmed or inconsistent archives never invent a luck pillar, and candidates cannot be merged',()=>{
  const e=ref.realExamples.sameColumn,chart=archive(e),born=Date.parse(chart.bazi.rawResult[0].utc),early=calculate(chart,e.year);
  assert.ok(facts(early).length);assert.ok(facts(early).every(f=>Date.parse(f.activeFrom)>=born));
  assert.ok(facts(early).some(f=>f.normalizedPayload.luckStatus==='before_luck'&&f.normalizedPayload.luckPillar===undefined));
  const bad=archive();bad.bazi.rawResult[0].luckPeriods.pop();const unresolved=calculate(bad);
  assert.ok(facts(unresolved).length&&facts(unresolved).every(f=>f.normalizedPayload.luckStatus==='unavailable'&&f.normalizedPayload.luckPillar===undefined));
  bad.bazi.rawResult[0].day='甲子';assert.equal(facts(calculate(bad)).length,0);
  const unknown=archive(ref.realExamples.hourOnly);unknown.timeKnown=false;
  assert.equal(matched(calculate(unknown,2021),9).status,'unknown');
  const multi=archive();multi.bazi.rawResult.push(structuredClone(multi.bazi.rawResult[0]));
  assert.equal(matched(calculate(multi),6).status,'unknown');
});

test('SQLite source reviews are current and atomic predicates refuse generic, wrong-source or missing facts',()=>{
  const run=runFor('jiaWuBothWitnesses');
  for(const index of indices){
    const r=fortuneKnowledge.bazi.rules[index],e=fortuneKnowledge.bazi.entries.find(e=>e.id===r.knowledgeId);
    assert.equal(r.queries.length,1);assert.equal(r.queries[0].factType,'annual_column_relations');assert.equal(r.queries[0].where.profile,baziAnnualRelationPolicy.profile);
    assert.equal(r.review.sourceHash,createHash('sha256').update(JSON.stringify({evidence:e.evidence,conditions:e.conditions})).digest('hex'));assert.equal(r.unresolved.length,index===9?0:2);
  }
  const wrong=structuredClone(run);facts(wrong).forEach(f=>{f.normalizedPayload.profile='other';});assert.equal(matched(wrong,6).status,'not_matched');
  const absent=structuredClone(run);absent.facts=absent.facts.filter(f=>f.factType!=='annual_column_relations');assert.equal(matched(absent,6).status,'unknown');
  const missing=structuredClone(runFor('sameColumn'));facts(missing).forEach(f=>{
    delete f.normalizedPayload.doubleCombineReviewedPositions;
    delete f.normalizedPayload.dayHourStemCombinePositions;
  });
  assert.equal(matched(missing,10).status,'unknown');assert.equal(matched(missing,9).status,'unknown');
});

test('actual model requests send the confirmed Jia-Wu excerpt and keep local evidence separate',async()=>{
  const run=runFor('jiaWuBothWitnesses'),{input}=buildFortuneModelContext(run,interpretFortune(run,requestForFortuneRun(run),'annual-source-report'));
  assert.ok(input.facts.some(f=>f.type==='annual_column_relations'));
  assert.ok(input.facts.some(f=>f.type==='annual_column_relations'&&f.data.yearStem==='戊'));
  assert.ok(input.facts.some(f=>f.type==='annual_column_relations'&&f.data.yearStem==='丁'));
  const findings = input.sections.flatMap(section => section.findings);
  assert.ok(findings.some(row => row.knowledgeId === fortuneKnowledge.bazi.rules[6].knowledgeId));
  assert.ok(!findings.some(row => [9, 10].some(index => row.knowledgeId === fortuneKnowledge.bazi.rules[index].knowledgeId)));
  const prompt=formatFortuneFactAudit(input);
  for(const phrase of ['同一实际年段太岁成对比较','不跨柱拼合','本命完整庚申柱在本命年柱','这一分类不表示原文救应分支已生效','同段大运已按完整归档表唯一核验'])assert.ok(prompt.includes(phrase),phrase);
  for(const secret of ['smth-annual-column-relations','stemCombinePositions','natalGengShenPositions','annual-relations-run','sourceRelations','witnessBranch'])assert.ok(!prompt.includes(secret),secret);
  assert.ok(!/[{}\[\]]/u.test(prompt));
  let called=false;const provider=createFortuneDeepSeek({apiKey:'test-key',transport:async(_,options)=>{
    called=true;
    const message = JSON.parse(options.body).messages[1].content;
    assert.equal(message, formatFortunePrompt(input));
    assert.match(message, /若五行有救四柱有情如甲日尅戊年/u);
    assert.doesNotMatch(message, /本命完整庚申柱在本命年柱|jiaWuNamedRescuePair|metalRootReview/u);
    return Response.json({choices:[{finish_reason:'stop',message:{content:'{"sections":[]}'}}]});
  }});await provider.interpret(input);assert.equal(called,true);
  const unknown=baziAnnualColumnRelations({...natal,hour:'ignored'},false,'戊戌');
  const translated=describeFortuneFact({method:'bazi',type:'annual_column_relations',data:unknown},String);
  assert.match(translated,/未知时柱不能当作已经排除/u);assert.match(translated,/不将缺项划成仅有一种或两者皆无/u);
  const scattered=baziAnnualColumnRelations({...natal,year:'庚午',month:'丙申'},true,'戊戌',before);
  assert.match(describeFortuneFact({method:'bazi',type:'annual_column_relations',data:scattered},String),/不将分柱庚与申拼成庚申柱/u);
  assert.ok(!describeFortuneFact({method:'bazi',type:'annual_column_relations',data:{...scattered,yearStem:'丁',yearPillar:'丁酉'}},String).includes('透干见证分类'));
  assert.equal(describeFortuneFact({method:'bazi',type:'annual_column_relations',data:{profile:'other'}},String),'');
});
