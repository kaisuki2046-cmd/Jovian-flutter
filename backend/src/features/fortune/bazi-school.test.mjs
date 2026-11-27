import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Solar } from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
import { createFortuneDeepSeek } from './server/deepseek-expression.mjs';
const { baziSchoolContext, baziSchoolPolicy, schoolEntryAge, schoolLuckEntryAges } = await import('./control/bazi-school.ts');
const { baziSchoolExamContext, schoolExamNobleSeason, baziSchoolExamPolicy } = await import('./control/bazi-school-exam.ts');
const { calculateFortuneFacts, validateFortuneFacts } = await import('./control/fortune-facts.ts');
const { buildFactTimeContext } = await import('./control/fact-time-context.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const reference = JSON.parse(readFileSync(new URL('./model/fixtures/bazi-school-reference.json', import.meta.url)));
function archive(gender = 1, birth = { year: 1990, month: 9, day: 26, hour: 12 }) {
  const { year, month, day, hour } = birth;
  const l = Solar.fromYmdHms(year, month, day, hour, 0, 0).getLunar();
  return { timeKnown: true, bazi: { engineName: 'lunar-javascript', engineVersion: '1.7.8', rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1',
    rawResult: [{ utc: new Date(Date.UTC(year, month - 1, day, hour - 8)).toISOString(),
      year: l.getYearInGanZhiExact(), month: l.getMonthInGanZhiExact(),
      day: l.getDayInGanZhiExact(), hour: l.getTimeInGanZhi(), tenGods: {}, shenSha: {},
      luckPeriods: l.getEightChar().getYun(gender, 2).getDaYun(11).slice(1)
        .map(s => ({ ganZhi: s.getGanZhi(), startAge: s.getStartAge(), endAge: s.getEndAge() })) }] },
    ziwei: { rawResult: [] }, western: { rawResult: [] } };
}
function calculate(chart = archive(), year = 2010) {
  const input = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  return calculateFortuneFacts(input, buildFactTimeContext(input, Date.parse('2026-11-19T03:00:00Z'), 'server'),
    'school-test-run', { snapshotId: 'school-test-snapshot', chart });
}
const specific = run => run.facts.filter(f => f.factType === 'school_context');
const entryFacts = run => run.facts.filter(f => f.factType === 'school_entry_context');
const result = run => matchFortuneKnowledge(run).byMethod.bazi.find(r => r.knowledgeId === fortuneKnowledge.bazi.rules[12].knowledgeId);
const examFacts = run => run.facts.filter(f => f.factType === 'school_exam_context');
const examResult = (run, suffix) => matchFortuneKnowledge(run).byMethod.bazi.find(r => r.knowledgeId.endsWith('smth-v3-school-p011-' + suffix));

function submitCompleteExamYear(birth, gender, year, timeZone = 'Asia/Shanghai') {
  const chart = archive(gender, birth);
  chart.birthContext = { precision: 'minute', birthInstant: chart.bazi.rawResult[0].utc, latitude: 39.9042, longitude: 116.4074,
    timeZone, clockVersion: 'gregory-iana-intl-v1' };
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
  const asOf = Date.UTC(year, 5, 15), ref = { chart, snapshotId: 'school-complete-exam-' + year };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, ref)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), ref.snapshotId, ref);
  validateFortuneFacts(run);
  return run;
}

test('source Na-yin five-element birth palaces stay separate from the day-stem engine table and explicit source examples', () => {
  assert.equal(reference.profile, baziSchoolPolicy.profile);
  for (const row of reference.sourceSchoolBranches) {
    const value = baziSchoolContext({ ...reference.realExample.pillars, year: row.year }, true, '丁亥');
    assert.equal(value.yearNaYinElement, row.element); assert.equal(value.yearNaYinSchoolBranch, row.schoolBranch);
  }
  for (const [index, [stem, branch]] of Object.entries(reference.sourceDayStartVolume2).entries()) {
    const value = baziSchoolContext({ ...reference.realExample.pillars, day: stem + (index % 2 ? '未' : '午') }, true, '丁亥');
    assert.equal(value.directSourceDayStart, branch); assert.equal(value.standardDayStartBranch, branch);
    assert.equal(value.directSourceDayStartAgrees, true);
  }
  // This source explicitly puts Na-yin earth with water at Shen; the current
  // day-stem engine puts Wu earth with fire. The two are not silently merged.
  const earth = baziSchoolContext({ ...reference.realExample.pillars, day: '戊子' }, true, '甲申');
  assert.equal(earth.yearNaYinSchoolBranch, '申'); assert.equal(earth.standardDayStartBranch, '寅');
  assert.equal(earth.sourceLuckAtDayStart, false);
});

test('unknown hours cannot prove absence, and an Yi-Wu day-method school can exist with no four-birth palace', () => {
  const base = reference.realExample.pillars, before = structuredClone(base);
  assert.equal(baziSchoolContext(base, true, '丁亥').fourBirthAbsent, true);
  const unknown = baziSchoolContext({ ...base, hour: 'not-provided' }, false, '丁亥');
  assert.equal(unknown.fourBirthAbsent, undefined); assert.equal(unknown.naYinAbsent, undefined);
  assert.equal(unknown.standardDayMonthHourAbsent, undefined);
  assert.ok(unknown.witnesses.every(w => w.position !== 'hour'));
  const yi = baziSchoolContext({ ...base, day: '乙酉', hour: '壬午' }, true, '壬午');
  assert.equal(yi.fourBirthAbsent, true); assert.equal(yi.standardDayMonthHourAbsent, false);
  assert.deepEqual(yi.standardDayMonthHourPositions, ['hour']);
  const allPresent = { ...base, month: '甲申', hour: '乙亥' };
  const withHour = baziSchoolContext(allPresent, true, '丁亥');
  assert.equal(withHour.sourceLuckAtDayStart, true); assert.equal(withHour.sourceSchoolAbsenceCandidate, false);
  assert.equal(baziSchoolContext(allPresent, false, '丁亥').sourceSchoolAbsenceCandidate, undefined);
  assert.deepEqual(base, before);
  for (const changed of [{ ...base, day: '甲丑' }, { ...base, month: '' }]) assert.throws(() => baziSchoolContext(changed, true, '丁亥'));
  assert.throws(() => baziSchoolContext(base, true, '甲丑'));
});

test('each school position preserves clash, break, self-punishment, directed stem and Na-yin controls with separate void bases', () => {
  // Relation-only counterexample, not represented as a real historical chart.
  const value = baziSchoolContext({ year: '甲子', month: '辛巳', day: '乙亥', hour: '丁巳' }, true, '癸亥');
  assert.deepEqual(value.naYinPositions, ['month', 'hour']); assert.deepEqual(value.sameNaYinPositions, ['month']);
  const school = value.witnesses.find(w => w.variant === 'year_nayin_birth' && w.position === 'month');
  assert.ok(school.branchContacts.some(r => r.kind === '六冲' && r.other === 'day'));
  assert.ok(school.branchContacts.some(r => r.kind === '六冲' && r.other === 'luck'));
  assert.deepEqual(school.stemControls, ['hour']); assert.ok(school.naYinControls.includes('day'));
  assert.ok(!school.stemControls.includes('day')); // Xin controls Yi, not the reverse.
  const hour = value.witnesses.find(w => w.variant === 'four_birth_palaces' && w.position === 'day');
  assert.equal(hour.natalYearVoid, true); assert.equal(hour.natalDayVoid, false);
  assert.ok(hour.branchContacts.some(r => r.kind === '相刑' && r.other === 'luck'));
  const broken = baziSchoolContext({ year: '甲申', month: '乙巳', day: '丙寅', hour: '壬辰' }, true, '甲寅');
  assert.ok(broken.witnesses.find(w => w.position === 'year').branchContacts.some(r => r.kind === '六破' && r.other === 'month'));
  assert.equal(value.injuryEffect, 'unresolved-source-void-basis-strength-and-rescue');
});

test('exact civil birthdays and leap-day comparison never choose the original five-seven age interpretation', () => {
  const birth = Date.parse(reference.realExample.birth), anniversary = Date.parse('1997-09-26T04:00:00Z');
  assert.equal(schoolEntryAge(birth, anniversary - 1), 6); assert.equal(schoolEntryAge(birth, anniversary), 7);
  assert.equal(schoolEntryAge(birth, birth - 1), undefined); assert.equal(schoolEntryAge(NaN, anniversary), undefined);
  const leap = Date.parse('2000-02-29T04:00:00Z');
  assert.equal(schoolEntryAge(leap, Date.parse('2001-03-01T03:59:59Z')), 0);
  assert.equal(schoolEntryAge(leap, Date.parse('2001-03-01T04:00:00Z')), 1);
  const dstBirth = Date.parse('2006-03-24T12:00:00Z'), dstEntry = Date.parse('2011-03-24T11:30:00Z');
  assert.equal(schoolEntryAge(dstBirth, dstEntry, 'America/Los_Angeles'), 5);
  assert.equal(schoolEntryAge(dstBirth, dstEntry), 4);
  assert.equal(schoolEntryAge(dstBirth, dstEntry, 'no-such-zone'), undefined);
});

test('age comparisons preserve three actual values of six without rounding toward a literal age', () => {
  const ages = schoolLuckEntryAges(Date.parse('1982-02-04T04:00:00Z'), Date.parse('1988-02-04T05:00:00Z'));
  assert.deepEqual(ages, { civilYears: 6, civilClock: 'beijing', liChunOrdinal: 6, lunarOrdinal: 6 });
});

test('real archived Jia-Wu adulthood preserves growth and school absence but cannot match the childhood clause', () => {
  const chart = archive(); assert.deepEqual(Object.fromEntries(['year', 'month', 'day', 'hour'].map(k => [k, chart.bazi.rawResult[0][k]])), reference.realExample.pillars);
  const run = calculate(chart, 2004); validateFortuneFacts(run);
  const [entry] = entryFacts(run), matched = result(run);
  assert.equal(entry.exactInstant, '2004-11-11T06:00:00.000Z');
  assert.equal(entry.normalizedPayload.luckPillar, reference.realExample.male.sourceLongLifeLuck);
  assert.equal(entry.normalizedPayload.sourceLuckAtDayStart, true);
  assert.equal(entry.normalizedPayload.sourceSchoolAbsenceCandidate, true);
  assert.equal(entry.normalizedPayload.civilYears, 14);
  assert.equal(matched.status, 'not_matched'); assert.deepEqual(matched.windows, []);
});

test('client facts bind the qualifying childhood entry to one second in SQLite and do not repeat the following year', () => {
  const birth = { year: 1990, month: 3, day: 22, hour: 0 };
  const run = submitCompleteExamYear(birth, 0, 1995);
  assert.equal(run.calculationSource, 'client');
  const [entry] = entryFacts(run);
  const start = '1995-06-30T02:00:00.000Z', endExclusive = '1995-06-30T02:00:01.000Z';
  assert.equal(entry.exactInstant, start); assert.equal(entry.timePrecision, 'second');
  assert.equal(entry.normalizedPayload.civilYears, 5);
  assert.equal(entry.normalizedPayload.liChunOrdinal, 6);
  assert.equal(entry.normalizedPayload.lunarOrdinal, 6);
  assert.equal(entry.normalizedPayload.sourceLuckSchoolClashOrBreak, false);
  assert.deepEqual(entry.normalizedPayload.luckSchoolContacts, []);
  assert.deepEqual(entry.normalizedPayload.luckSchoolChecks, {
    natalColumnsComplete: true, voidSources: [], controls: [],
  });
  assert.ok(entry.sourceFactIds.every(id => run.rawFacts.some(raw => raw.rawFactId === id)));
  const matched = result(run);
  assert.equal(matched.status, 'partial');
  assert.deepEqual(matched.sourceFactIds, [entry.factId]);
  assert.deepEqual(matched.windows, [{ start, endExclusive }]);
  assert.ok(matched.unresolvedConditions.some(s => s.includes('原文的年龄制度')));
  const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'school-entry-prompt')).input;
  const prompt = formatFortuneFactAudit(model);
  assert.match(prompt, /1995-06-30 10:00:00实际交入戊寅运/u);
  assert.match(prompt, /按出生地民用生日已满5周岁/u);
  assert.match(prompt, /按北京立春换年自出生年起计为第6年，按北京农历新年换年为第6年/u);
  assert.ok(!prompt.includes('school_entry_context'));
  assert.ok(model.sections.every(section => section.findings.every(row => row.knowledgeId !== matched.knowledgeId)));
  const following = submitCompleteExamYear(birth, 0, 1996);
  assert.ok(specific(following).some(f => f.normalizedPayload.sourceLuckAtDayStart));
  assert.deepEqual(entryFacts(following), []);
  assert.deepEqual(result(following).windows, []);
});

test('SQLite can qualify an ordinal of seven even when the completed birthdays are six', () => {
  const run = submitCompleteExamYear({ year: 1990, month: 3, day: 24, hour: 12 }, 0, 1996);
  const [entry] = entryFacts(run), match = result(run);
  assert.equal(entry.normalizedPayload.civilYears, 6);
  assert.equal(entry.normalizedPayload.liChunOrdinal, 7);
  assert.equal(entry.normalizedPayload.lunarOrdinal, 7);
  assert.equal(entry.normalizedPayload.sourceLuckSchoolClashOrBreak, false);
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.sourceFactIds, [entry.factId]);
});

test('p008 confirms the exact childhood entry only when school methods and literal age comparisons all qualify', () => {
  const birth = { year: 1984, month: 3, day: 23, hour: 12 };
  const run = submitCompleteExamYear(birth, 0, 1990);
  const start = '1990-02-26T04:00:00.000Z', endExclusive = '1990-02-26T04:00:01.000Z';
  const [entry] = entryFacts(run), p = entry.normalizedPayload;
  assert.deepEqual([p.civilYears, p.liChunOrdinal, p.lunarOrdinal], [5, 7, 7]);
  assert.equal(p.luckPillar, '丙寅');
  assert.equal(p.schoolEntryAgreement, true);
  assert.deepEqual(p.luckSchoolChecks, { natalColumnsComplete: true, voidSources: [], controls: [] });
  const hit = result(run);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '到五七歲却交日干長生運');
  assert.deepEqual(hit.windows, [{ start, endExclusive }]);
  assert.deepEqual(hit.sourceFactIds, [entry.factId]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'agreed-school-entry'));
  assert.match(formatFortunePrompt(input), /年龄各在原文五或七的字面值内/u);
  assert.doesNotMatch(formatFortunePrompt(input), /schoolEntryAgreement|亦有文學/u);
  const changed = submitCompleteExamYear({ ...birth, hour: 20 }, 0, 1990);
  const [other] = entryFacts(changed);
  assert.deepEqual([other.normalizedPayload.civilYears, other.normalizedPayload.liChunOrdinal, other.normalizedPayload.lunarOrdinal], [6, 7, 7]);
  assert.equal(other.normalizedPayload.schoolEntryAgreement, false);
  assert.equal(result(changed).status, 'partial');
});

test('p008 excludes the source named noble school at the actual childhood entry', () => {
  const birth = { year: 1942, month: 3, day: 24, hour: 6 };
  const withSchool = submitCompleteExamYear(birth, 0, 1948, 'Etc/GMT-8');
  const [entry] = entryFacts(withSchool), p = entry.normalizedPayload;
  assert.equal(entry.exactInstant, '1948-02-17T04:00:00.000Z');
  assert.deepEqual([p.civilYears, p.liChunOrdinal, p.lunarOrdinal], [5, 7, 7]);
  assert.equal(p.luckPillar, '壬寅');
  assert.equal(p.sourceSchoolAbsenceCandidate, true);
  assert.deepEqual(p.nobleSchoolWitnesses, [{ position: 'hour', pillar: '辛卯' }]);
  assert.equal(p.schoolEntryAgreement, false);
  const rejected = result(withSchool);
  assert.equal(rejected.status, 'excluded');
  assert.deepEqual(rejected.windows, []);
  const model = buildFortuneModelContext(withSchool, interpretFortune(withSchool, requestForFortuneRun(withSchool), 'named-noble-school')).input;
  assert.match(formatFortuneFactAudit(model), /本命时柱辛卯符合卷三具名学堂会贵/u);
  assert.doesNotMatch(formatFortunePrompt(model), /学堂会贵|nobleSchoolWitnesses|到五七歲却交日干長生運/u);

  const otherHour = submitCompleteExamYear({ ...birth, hour: 8 }, 0, 1948, 'Etc/GMT-8');
  const [other] = entryFacts(otherHour);
  assert.equal(other.exactInstant, '1948-02-28T06:00:00.000Z');
  assert.deepEqual(other.normalizedPayload.nobleSchoolWitnesses, []);
  assert.equal(other.normalizedPayload.schoolEntryAgreement, true);
  const confirmed = result(otherHour);
  assert.equal(confirmed.status, 'matched');
  assert.deepEqual(confirmed.windows, [{ start: other.exactInstant, endExclusive: '1948-02-28T06:00:01.000Z' }]);

  for (const pillar of ['丙子', '庚子']) {
    const natal = { year: '己酉', month: '庚午', day: pillar, hour: '戊子' };
    assert.deepEqual(baziSchoolContext(natal, true, '己巳').nobleSchoolWitnesses, [{ position: 'day', pillar }]);
    assert.equal(baziSchoolContext({ ...natal, day: '庚午', hour: pillar }, false, '己巳').hasNamedNobleSchool, undefined);
  }
});

test('p008 separates an observed clash or break from a non-self branch punishment', () => {
  const cases = [
    { birth: [1989, 1, 18, 16], year: 1994, start: '1994-07-20T14:00:00.000Z', luck: '丙寅',
      contacts: [['六冲', 'hour', '庚申'], ['相刑', 'hour', '庚申']], excluded: true },
    { birth: [1990, 2, 17, 12], year: 1995, start: '1995-09-07T18:00:00.000Z', luck: '己卯',
      contacts: [['六破', 'year', '庚午'], ['六破', 'hour', '戊午']], excluded: true },
    { birth: [1989, 1, 18, 10], year: 1994, start: '1994-08-20T08:00:00.000Z', luck: '丙寅',
      contacts: [['相刑', 'hour', '丁巳']], excluded: false },
  ];
  for (const { birth: [birthYear, month, day, hour], year, start, luck, contacts, excluded } of cases) {
    const run = submitCompleteExamYear({ year: birthYear, month, day, hour }, 1, year);
    const [fact] = entryFacts(run), p = fact.normalizedPayload;
    assert.equal(fact.exactInstant, start);
    assert.equal(p.luckPillar, luck);
    assert.equal(p.sourceLuckPhase, '长生');
    assert.equal(p.sourceSchoolAbsenceCandidate, true);
    assert.equal(p.sourceLuckSchoolClashOrBreak, excluded);
    assert.equal(p.sourceLuckSchoolSelfPunishment, false);
    assert.deepEqual(p.luckSchoolContacts.map(row => [row.kind, row.position, row.pillar]), contacts);
    const hit = result(run);
    assert.equal(hit.status, excluded ? 'excluded' : 'partial');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, excluded ? [] : [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'school-luck-contact'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes('构成' + contacts[0][0]));
    assert.equal(prompt.includes('排除无冲破的长生运候选'), excluded);
    assert.doesNotMatch(prompt, /luckSchoolContacts|sourceLuckSchoolClashOrBreak/u);
  }
});

test('p008 excludes a same-branch self-punishment at the actual childhood longevity entry', () => {
  const run = submitCompleteExamYear({ year: 1962, month: 7, day: 26, hour: 12 }, 0, 1968);
  const [fact] = entryFacts(run), p = fact.normalizedPayload;
  assert.equal(fact.exactInstant, '1968-10-01T22:00:00.000Z');
  assert.deepEqual([p.dayMaster, p.directSourceDayStart, p.luckPillar, p.liChunOrdinal, p.lunarOrdinal], ['乙', '午', '丙午', 7, 7]);
  assert.equal(p.sourceSchoolAbsenceCandidate, true);
  assert.equal(p.sourceLuckSchoolClashOrBreak, false);
  assert.equal(p.sourceLuckSchoolSelfPunishment, true);
  assert.deepEqual(p.luckSchoolContacts, [{ kind: '相刑', position: 'hour', pillar: '壬午' }]);
  const hit = result(run);
  assert.equal(hit.status, 'excluded');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, []);
});

test('p008 checks both natal void bases and directed controls on the same actual longevity entry', () => {
  const cases = [
    { birth: [1989, 1, 18, 0], year: 1994, status: 'partial', voidSources: [],
      controls: [{ position: 'hour', pillar: '壬子', parts: ['stem'] }] },
    { birth: [1989, 1, 18, 16], year: 1994, status: 'excluded', voidSources: [],
      controls: [{ position: 'hour', pillar: '庚申', parts: ['branch'] }] },
    { birth: [1990, 2, 17, 12], year: 1995, status: 'excluded', voidSources: [{ basis: 'day', xun: '甲辰' }],
      controls: [{ position: 'day', pillar: '癸丑', parts: ['nayin'] }] },
    { birth: [1991, 12, 20, 0], year: 1995, status: 'partial',
      voidSources: [{ basis: 'year', xun: '甲子' }, { basis: 'day', xun: '甲子' }],
      controls: [{ position: 'year', pillar: '辛未', parts: ['branch'] },
        { position: 'day', pillar: '甲子', parts: ['stem', 'nayin'] },
        { position: 'hour', pillar: '甲子', parts: ['stem', 'nayin'] }] },
  ];
  for (const { birth: [birthYear, month, day, hour], year, status, voidSources, controls } of cases) {
    const run = submitCompleteExamYear({ year: birthYear, month, day, hour }, 1, year);
    const [fact] = entryFacts(run);
    assert.equal(fact.exactInstant, fact.activeFrom);
    assert.equal(fact.normalizedPayload.sourceLuckPhase, '长生');
    assert.deepEqual(fact.normalizedPayload.luckSchoolChecks, { natalColumnsComplete: true, voidSources, controls });
    assert.equal(result(run).status, status);
    assert.deepEqual(result(run).sourceFactIds, [fact.factId]);
    if (voidSources.length === 2) {
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'school-void-and-controls'));
      const audit = formatFortuneFactAudit(input);
      assert.match(audit, /本命年柱所属甲子旬，实际长生运支落旬空/u);
      assert.match(audit, /本命日柱所属甲子旬，实际长生运支落旬空/u);
      assert.match(audit, /本命日柱甲子的天干、纳音对实际运柱构成相克/u);
      assert.doesNotMatch(audit, /luckSchoolChecks|voidSources/u);
    }
  }

  const native = archive(1, { year: 1989, month: 1, day: 18, hour: 0 }).bazi.rawResult[0];
  const unknownHour = baziSchoolContext(native, false, '丙寅');
  assert.deepEqual(unknownHour.luckSchoolChecks, { natalColumnsComplete: false, voidSources: [], controls: [] });
});

test('p008 keeps the bathing and death stages in their actual childhood entry without a longevity match', () => {
  for (const [day, hour, year, phase, printedPhase] of [[13, 0, 1996, '沐浴', '沐浴（败）'], [17, 2, 1995, '死', '死']]) {
    const run = submitCompleteExamYear({ year: 1989, month: 1, day, hour }, 1, year);
    const [fact] = entryFacts(run), p = fact.normalizedPayload;
    assert.equal(p.luckPillar, '丙寅');
    assert.equal(p.sourceLuckPhase, phase);
    assert.equal(p.sourceLuckAtDayStart, false);
    assert.equal(p.dayLongevityAbsent, true);
    assert.equal(p.sourceLuckSchoolClashOrBreak, false);
    assert.equal(p.luckSchoolChecks, undefined);
    const hit = result(run);
    assert.equal(hit.status, 'not_matched');
    assert.deepEqual(hit.windows, []);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'school-bathing-or-death'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes('同书日干十二宫，实际入运为' + printedPhase + '，本命四柱地支均未见日干长生位'));
    assert.doesNotMatch(prompt, /实际交入丙寅运，运支为.*日干的长生位|sourceLuckPhase/u);
  }
});

test('school facts split at the real exact luck transition and do not synthesize an absence from an unconfirmed archive', () => {
  const run = calculate(archive(0), reference.realExample.female.transitionYear); validateFortuneFacts(run);
  const facts = specific(run), starts = facts.filter(f => f.activeFrom === f.normalizedPayload.stageStart);
  assert.equal(starts.length, 1);
  const after = starts[0], before = facts.find(f => f.activeTo === after.activeFrom);
  assert.equal(after.activeFrom, reference.realExample.female.transition);
  assert.equal(before.normalizedPayload.luckPillar, reference.realExample.female.before);
  assert.equal(after.normalizedPayload.luckPillar, reference.realExample.female.after);
  for (const fact of facts) assert.ok(fact.activeFrom >= fact.normalizedPayload.stageStart && fact.activeTo <= fact.normalizedPayload.stageEnd);
  const invalid = archive(); invalid.bazi.rawResult[0].luckPeriods.pop();
  const unverified = calculate(invalid, 2004);
  assert.equal(result(unverified).status, 'unknown');
  assert.deepEqual(entryFacts(unverified), []);
  assert.ok(specific(unverified).every(f => f.completeness === 'partial'));
  const unknown = archive(); unknown.timeKnown = false;
  assert.equal(result(calculate(unknown)).status, 'unknown');
  assert.ok(specific(calculate(unknown)).every(f => f.normalizedPayload.fourBirthAbsent === undefined));
});

test('school facts are rendered into Chinese without machine payloads and the incomplete source remains absent from matched materials', () => {
  const run = calculate(), report = interpretFortune(run, requestForFortuneRun(run), 'school-prompt');
  const { input } = buildFortuneModelContext(run, report), prompt = formatFortuneFactAudit(input);
  assert.ok(input.facts.some(f => f.type === 'school_context'));
  assert.match(prompt, /本命完整四柱均不见寅申巳亥四生宫/u);
  assert.match(prompt, /卷二所列本日干长生在亥/u); assert.match(prompt, /原文五七岁的计龄仍待核/u);
  assert.ok(input.sections.every(s => !s.findings.some(f => f.knowledgeId === fortuneKnowledge.bazi.rules[12].knowledgeId)));
  for (const key of ['school_context', 'fourBirthPositions', 'standardLuckPhase', 'school-test-run', 'school-test-snapshot', 'https://']) assert.ok(!prompt.includes(key), key);
  const standalone = describeFortuneFact({ method: 'bazi', type: 'school_context', data: baziSchoolContext(
    { year: '甲子', month: '辛巳', day: '乙亥', hour: '丁巳' }, true, '癸亥') }, String);
  assert.match(standalone, /对该柱天干形成五行克关系的柱位为时柱/u); assert.match(standalone, /按年柱旬空核落空，按日柱旬空核不落空/u);
  assert.ok(!/[{}\[\]]|year_nayin_birth|stemControls/u.test(standalone));
});

test('review preserves the original source hash and does not turn one variant absence or a numeric age interval into a universal prerequisite', () => {
  const rule = fortuneKnowledge.bazi.rules[12], entry = fortuneKnowledge.bazi.entries.find(e => e.id === rule.knowledgeId);
  assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
  assert.equal(rule.queries.length, 1); assert.equal(rule.queries[0].factType, 'school_entry_context');
  assert.equal(rule.queries[0].where.confirmed, true);
  assert.equal(rule.queries[0].where.sourceLuckAtDayStart, true);
  assert.equal(rule.queries[0].where.sourceSchoolAbsenceCandidate, true);
  assert.equal(rule.queries[0].where.profile, baziSchoolPolicy.entry);
  assert.equal(rule.unless[0].where.profile, baziSchoolPolicy.entry);
  assert.deepEqual(rule.unless[0].anyOf, [{ sourceLuckSchoolClashOrBreak: true }, { sourceLuckSchoolSelfPunishment: true }]);
  assert.deepEqual(rule.queries[0].anyOf, ['civilYears', 'liChunOrdinal', 'lunarOrdinal'].map(key => ({ [key]: { oneOf: [5, 7] } })));
  assert.equal(rule.queries[0].where.fourBirthAbsent, undefined); assert.equal(rule.queries[0].where.entryCompletedCivilYears, undefined);
  assert.equal(rule.unresolved.length, 4);
});

test('noble season changes at the exact summer and winter solstices, with separate birth-year and day witnesses', () => {
  const summer = Date.parse('1990-06-21T15:32:46Z'), winter = Date.parse('1990-12-22T03:06:59Z');
  assert.equal(schoolExamNobleSeason(summer - 1).season, '阳贵');
  assert.deepEqual(schoolExamNobleSeason(summer), { season: '阴贵', start: summer });
  assert.equal(schoolExamNobleSeason(winter - 1).season, '阴贵');
  assert.deepEqual(schoolExamNobleSeason(winter), { season: '阳贵', start: winter });
  const natal = archive(0).bazi.rawResult[0];
  const value = baziSchoolExamContext(natal, true, '癸亥', '辛巳');
  assert.equal(value.dayStemSeal, true);
  assert.equal(value.nayinStorehouseSeal, false);
  assert.equal(value.bases[0].officerContact, true);
  assert.deepEqual(value.bases[1].supports, ['正印']);
  assert.equal(value.examSupportCandidate, false);
  assert.equal(baziSchoolExamContext(natal, false, '丁未').bases[0].nobleContact, undefined);
  for (const [year, seal] of [['甲子', '乙丑'], ['戊辰', '癸未'], ['丙寅', '甲戌'], ['甲申', '壬辰'], ['庚午', '丙辰']]) {
    const sameStorehouse = baziSchoolExamContext({ ...natal, year }, true, seal);
    assert.equal(sameStorehouse.sealPillar, seal);
    assert.equal(sameStorehouse.nayinStorehouseSeal, true);
  }
  assert.equal(baziSchoolExamContext(natal, true, '戊辰').nayinStorehouseSeal, false);
});

test('the month-building clause is independent of the luck table and treats a stem-only combination as unresolved', () => {
  const snapshot = archive();
  snapshot.bazi.rawResult[0].luckPeriods = [];
  const combined = calculate(snapshot, 2000), result = examResult(combined, '001');
  assert.equal(result.status, 'matched');
  assert.equal(result.matchedSourceExcerpt, '只以行年太歲與本生月建參而推之');
  assert.ok(result.windows[0].start.startsWith('2000-02-04'));
  assert.ok(result.sourceFactIds.every(id => examFacts(combined).some(f => f.factId === id && !f.normalizedPayload.confirmed
    && f.normalizedPayload.jointMonthCombination && f.normalizedPayload.annualPillar === '庚辰')));
  const half = calculate(snapshot, 2020);
  assert.equal(examResult(half, '001').status, 'unknown');
  assert.ok(examFacts(half).some(f => f.normalizedPayload.annualPillar === '庚子'
    && f.normalizedPayload.monthRelations.includes('天干五合') && f.normalizedPayload.monthHarmonyCandidate === undefined));
  const reversed = baziSchoolExamContext(archive().bazi.rawResult[0], true, '辛卯');
  assert.equal(reversed.jointMonthOpposition, true);
  assert.equal(reversed.monthHarmonyCandidate, false);
});

test('p011-001 uses the archived birthplace clock and preserves friction on a jointly combining month and year', async () => {
  const snapshot = archive(1, { year: 1990, month: 1, day: 28, hour: 15 });
  const native = snapshot.bazi.rawResult[0];
  assert.equal(native.month, '丁丑');
  native.utc = '1990-01-28T23:00:00.000Z';
  native.luckPeriods = [];
  snapshot.birthContext = { precision: 'minute', birthInstant: native.utc, latitude: 34, longitude: -118,
    timeZone: 'America/Los_Angeles', clockVersion: 'gregory-iana-intl-v1' };
  const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year: 2032 } };
  const asOf = Date.parse('2026-11-19T03:00:00Z'), reference = { snapshotId: 'school-clock-source', chart: snapshot };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, reference)));
  const run = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), 'school-clock-run', reference);
  validateFortuneFacts(run);
  assert.equal(run.calculationSource, 'client');
  const result = examResult(run, '001');
  assert.equal(result.status, 'matched');
  assert.equal(result.matchedSourceExcerpt, '只以行年太歲與本生月建參而推之');
  const { normalizedPayload: p } = examFacts(run).find(row => result.sourceFactIds.includes(row.factId));
  assert.equal(p.annualPillar, '壬子');
  assert.equal(p.natalMonth, '丁丑');
  assert.equal(p.monthPairAssessment, 'stem-branch-combination');
  assert.deepEqual(p.monthBranchFriction, []);
  assert.equal(p.confirmed, undefined);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'school-month-pair-confirmed'));
  const finding = input.sections.flatMap(section => section.findings).find(row => row.knowledgeId === result.knowledgeId);
  assert.equal(finding.originalText, '只以行年太歲與本生月建參而推之');
  assert.match(finding.conditions.join(''), /若本次讨论应试.*五合、地支六合/u);
  const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
    const message = JSON.parse(options.body).messages[1].content;
    assert.match(message, /只以行年太歲與本生月建參而推之/u);
    assert.doesNotMatch(message, /月建相和作福|录取必中|monthPairAssessment/u);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(input);
  assert.equal(examResult(calculate({ ...snapshot, birthContext: { ...snapshot.birthContext, timeZone: 'Asia/Shanghai' } }, 2032), '001').status, 'unknown');

  const mixed = calculate(archive(0, { year: 1988, month: 5, day: 7, hour: 20 }), 1992);
  const hit = examResult(mixed, '001');
  assert.equal(hit.status, 'partial');
  const pair = examFacts(mixed).find(row => hit.sourceFactIds.includes(row.factId) && row.normalizedPayload.annualPillar === '壬申');
  assert.equal(pair.normalizedPayload.natalMonth, '丁巳');
  assert.equal(pair.normalizedPayload.monthPairAssessment, 'combination-with-friction');
  assert.deepEqual(pair.normalizedPayload.monthBranchFriction, ['六破', '相刑']);
  const model = buildFortuneModelContext(mixed, interpretFortune(mixed, requestForFortuneRun(mixed), 'school-month-pair')).input;
  assert.match(formatFortuneFactAudit(model), /同对岁月柱兼见六破、相刑，合解及相和是否得用仍待核/u);
  assert.ok(model.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
});

test('p011-001 confirms isolated branch harmony only without verified competing friction', () => {
  const cases = [
    [{ year: 1984, month: 4, day: 17, hour: 12 }, 2029, '己酉', true, '同五行', []],
    [{ year: 1984, month: 4, day: 17, hour: 12 }, 2005, '乙酉', false, '后克前', []],
    [{ year: 1998, month: 5, day: 7, hour: 20 }, 2016, '丙申', false, '同五行', ['六破', '相刑']],
  ];
  for (const [birth, year, annualPillar, accepted, stemRelation, friction] of cases) {
    const run = submitCompleteExamYear(birth, 1, year);
    const fact = examFacts(run).find(row => row.normalizedPayload.annualPillar === annualPillar);
    assert.ok(fact);
    const p = fact.normalizedPayload;
    assert.equal(p.jointMonthCombination, false);
    assert.ok(p.monthRelations.includes('六合'));
    assert.equal(p.monthElements.find(row => row.part === 'stem').kind, stemRelation);
    assert.deepEqual(p.monthBranchFriction, friction);
    assert.equal(p.verifiedMonthBranchCombination, accepted);
    const scoped = { ...run, facts: [fact] };
    const hit = examResult(scoped, '001');
    assert.equal(hit.status === 'matched', accepted);
    if (accepted) {
      assert.ok(examFacts(run).some(row => row.activeTo === fact.activeFrom && row.normalizedPayload.annualPillar === '戊申'));
      assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'school-month-branch-combine'));
      assert.match(formatFortuneFactAudit(input), /同一岁月对只见地支六合/u);
      const prompt = formatFortunePrompt(input);
      assert.match(prompt, /实见地支六合/u);
      assert.doesNotMatch(prompt, /verifiedMonthBranchCombination|同一岁月对只见地支六合/u);
    }
  }
});

test('p011-001 applies isolated stem harmony with same element branches and excludes competing branch contacts', () => {
  const birth = { year: 1984, month: 3, day: 15, hour: 12 };
  for (const [year, annual, branchRelation, friction, expected] of [
    [2022, '壬寅', '同五行', [], true],
    [2012, '壬辰', '前克后', ['六害'], false],
    [2052, '壬申', '后克前', [], false],
  ]) {
    const run = submitCompleteExamYear(birth, 1, year);
    const fact = examFacts(run).find(row => row.normalizedPayload.annualPillar === annual);
    assert.ok(fact);
    const p = fact.normalizedPayload;
    assert.equal(p.natalMonth, '丁卯');
    assert.ok(p.monthRelations.includes('天干五合'));
    assert.equal(p.jointMonthCombination, false);
    assert.equal(p.verifiedMonthBranchCombination, false);
    assert.equal(p.monthElements.find(row => row.part === 'branch').kind, branchRelation);
    assert.deepEqual(p.monthBranchFriction, friction);
    assert.equal(p.verifiedMonthStemCombination, expected);
    const scoped = { ...run, facts: [fact] };
    const hit = examResult(scoped, '001');
    assert.equal(hit.status === 'matched', expected);
    if (expected) {
      assert.equal(fact.activeFrom, '2022-02-03T20:50:47.000Z');
      assert.ok(examFacts(run).some(row => row.activeTo === fact.activeFrom && !row.normalizedPayload.verifiedMonthStemCombination));
      assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
      const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'school-month-stem-combine'));
      assert.match(formatFortunePrompt(input), /若应试.*天干见五合，地支同气/u);
      assert.doesNotMatch(formatFortunePrompt(input), /verifiedMonthStemCombination|录取必中/u);
    }
  }
});

test('p011-001 confirms an isolated stem combination with either direction of branch generation unless that pair has friction', () => {
  const cases = [
    [{ year: 1984, month: 4, day: 17, hour: 12 }, 2013, '戊辰', '癸巳', '后生前', [],
      '2013-02-03T16:13:25.000Z'],
    [{ year: 1988, month: 5, day: 7, hour: 19 }, 2012, '丁巳', '壬辰', '前生后', [],
      '2012-02-04T10:22:24.000Z'],
    [{ year: 1979, month: 1, day: 9, hour: 12 }, 1990, '乙丑', '庚午', '后生前', ['六害']],
  ];
  for (const [birth, year, natalMonth, annualPillar, branchRelation, friction, boundary] of cases) {
    const run = submitCompleteExamYear(birth, 1, year);
    const fact = examFacts(run).find(row => row.normalizedPayload.annualPillar === annualPillar);
    assert.ok(fact, 'Missing annual school context for ' + year);
    const p = fact.normalizedPayload;
    assert.equal(p.natalMonth, natalMonth);
    assert.ok(p.monthRelations.includes('天干五合'));
    assert.equal(p.jointMonthCombination, false);
    assert.equal(p.verifiedMonthStemCombination, false);
    assert.equal(p.monthElements.find(row => row.part === 'branch').kind, branchRelation);
    assert.deepEqual(p.monthBranchFriction, friction);
    assert.equal(p.verifiedMonthStemCombinationWithBranchGeneration, !friction.length);
    const scoped = { ...run, facts: [fact] };
    const hit = examResult(scoped, '001');
    assert.equal(hit.status === 'matched', !friction.length);
    if (!boundary) continue;
    const before = examFacts(run).find(row => row.activeTo === boundary);
    assert.ok(before);
    assert.equal(before.normalizedPayload.verifiedMonthStemCombinationWithBranchGeneration, false);
    assert.equal(fact.activeFrom, boundary);
    assert.deepEqual(hit.windows, [{ start: boundary, endExclusive: fact.activeTo }]);
    assert.equal(hit.matchedSourceExcerpt, '只以行年太歲與本生月建參而推之');
    const { input } = buildFortuneModelContext(scoped, interpretFortune(scoped, requestForFortuneRun(scoped), 'school-month-stem-branch-growth'));
    const prompt = formatFortunePrompt(input);
    assert.match(prompt, /若本次讨论应试.*天干五合/u);
    assert.doesNotMatch(prompt, /verifiedMonthStemCombinationWithBranchGeneration|录取必中/u);
  }
});

test('p011-001 accepts either direction of same-pair generation and keeps mixed directions and friction separate', () => {
  const snapshot = archive(1, { year: 1979, month: 1, day: 9, hour: 12 });
  snapshot.bazi.rawResult[0].luckPeriods = [];
  const cases = [
    [2013, '癸巳', 'annual-to-month', '太岁的天干和地支分别生月建的天干和地支'],
    [2016, '丙申', 'month-to-annual', '月建的天干和地支分别生太岁的天干和地支'],
  ];
  for (const [year, pillar, direction, phrase] of cases) {
    const params = { periodType: 'year', displayTimezone: 'Asia/Shanghai', targetPeriod: { year } };
    const asOf = Date.UTC(year, 5, 15), ref = { chart: snapshot, snapshotId: 'school-month-generation-' + year };
    const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, asOf, ref)));
    const submitted = bindClientFortuneRun(params, batch, readClientFactTime(params, batch, asOf), ref.snapshotId, ref);
    validateFortuneFacts(submitted);
    const fact = examFacts(submitted).find(row => row.normalizedPayload.annualPillar === pillar);
    const p = fact.normalizedPayload;
    assert.equal(p.natalMonth, '乙丑');
    assert.equal(p.confirmed, undefined);
    assert.equal(p.jointMonthCombination, false);
    assert.equal(p.monthPairAssessment, 'same-direction-generation');
    assert.equal(p.monthGenerationDirection, direction);
    assert.equal(p.corroboratedMonthGeneration, false);
    assert.deepEqual(p.monthBranchFriction, []);
    const run = { ...submitted, facts: submitted.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const hit = examResult(run, '001');
    assert.equal(hit.status, 'partial');
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'school-month-generation'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes(phrase + '，同对未见所列刑冲破害，记录为月建相和候选'));
    assert.doesNotMatch(prompt, /同一对柱干支俱合，可以核对书中月建相和|monthGenerationDirection/u);
    assert.ok(input.sections.every(section => !section.findings.some(row => row.knowledgeId === hit.knowledgeId)));
  }

  for (const [month, day, year, pillar, assessment, directions, friction, status] of [
    [1, 4, 2016, '丙申', undefined, ['前生后', '后生前'], [], 'unknown'],
    [3, 9, 2038, '戊午', 'generation-with-friction', ['前生后', '前生后'], ['六破'], 'not_matched'],
  ]) {
    const run = calculate(archive(1, { year: 1979, month, day, hour: 12 }), year);
    const fact = examFacts(run).find(row => row.normalizedPayload.annualPillar === pillar);
    const p = fact.normalizedPayload;
    assert.deepEqual(p.monthElements.map(row => row.kind), directions);
    assert.equal(p.monthPairAssessment, assessment);
    assert.deepEqual(p.monthBranchFriction, friction);
    const clipped = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    assert.equal(examResult(clipped, '001').status, status);
  }
});

test('p011-001 confirms unopposed generation only when stems, branches and Na-yin agree on the same direction', () => {
  for (const [month, day, year, natalMonth, annual, direction, relation, from] of [
    [4, 17, 2026, '戊辰', '丙午', 'annual-to-month', '后生前', '2026-02-03T20:02:08.000Z'],
    [7, 20, 2052, '辛未', '壬申', 'month-to-annual', '前生后', '2052-02-04T03:23:05.000Z'],
  ]) {
    const run = submitCompleteExamYear({ year: 1984, month, day, hour: 12 }, 1, year);
    const hit = examResult(run, '001'), rows = examFacts(run);
    const fact = rows.find(row => hit.sourceFactIds.includes(row.factId)), p = fact.normalizedPayload;
    assert.equal(hit.status, 'matched');
    assert.deepEqual(hit.windows, [{ start: from, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
    assert.deepEqual([p.natalMonth, p.annualPillar, p.monthGenerationDirection, p.monthNayinRelation],
      [natalMonth, annual, direction, relation]);
    assert.ok(rows.some(row => row.activeTo === from && !hit.sourceFactIds.includes(row.factId)));
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'school-same-generation'));
    assert.match(formatFortunePrompt(input), /若本次讨论应试.*干、支和纳音三个层次同向相生/u);
    assert.doesNotMatch(formatFortunePrompt(input), /corroboratedMonthGeneration|前生后|后生前/u);
  }
});

test('SQLite uses all three independent annual supports only within their compatible officer stage', () => {
  const snapshot = archive(0);
  for (const [year, annual, support] of [[2027, '丁未', '天乙'], [2028, '戊申', '禄'], [2036, '丙辰', '正印']]) {
    const run = calculate(snapshot, year), match = examResult(run, '002');
    validateFortuneFacts(run);
    assert.equal(match.status, 'partial', annual); assert.ok(match.sourceFactIds.length);
    const hits = examFacts(run).filter(f => match.sourceFactIds.includes(f.factId) && f.normalizedPayload.annualPillar === annual);
    assert.ok(hits.length, annual);
    for (const f of hits) {
      assert.equal(f.normalizedPayload.luckPillar, '辛巳');
      const yearBasis = f.normalizedPayload.bases.find(row => row.basis === 'year');
      assert.equal(yearBasis.officerContact, true);
      assert.deepEqual(yearBasis.supports, [support]);
      assert.ok(f.activeFrom >= f.normalizedPayload.stageStart && f.activeTo <= f.normalizedPayload.stageEnd);
    }
    if (annual === '丙辰') {
      assert.ok(examFacts(run).some(f => f.normalizedPayload.annualPillar === annual && f.normalizedPayload.examSupportCandidate === false
        && f.activeFrom === hits.at(-1).activeTo));
      const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'exam-prompt'));
      const prompt = formatFortuneFactAudit(input);
      assert.match(prompt, /卷三取丙辰为正库印/u);
      assert.match(prompt, /本步同一基准的官位与当年支持同时可核/u);
      assert.ok(input.sections.every(s => s.findings.every(f => f.knowledgeId !== match.knowledgeId)));
    }
  }
  const acrossLiChun = calculate(snapshot, 2030), liChunHit = examResult(acrossLiChun, '002');
  const [previousYear, currentYear] = examFacts(acrossLiChun);
  assert.deepEqual([previousYear.normalizedPayload.annualPillar, currentYear.normalizedPayload.annualPillar], ['己酉', '庚戌']);
  assert.deepEqual(previousYear.normalizedPayload.examSupportRoutes, ['annual-family-lu']);
  assert.deepEqual(currentYear.normalizedPayload.examSupportRoutes, []);
  assert.equal(liChunHit.status, 'partial');
  assert.deepEqual(liChunHit.sourceFactIds, [previousYear.factId]);
  assert.deepEqual(liChunHit.windows, [{ start: previousYear.activeFrom, endExclusive: currentYear.activeFrom }]);
  snapshot.bazi.rawResult[0].luckPeriods.pop();
  assert.equal(examResult(calculate(snapshot, 2027), '002').status, 'unknown');
  for (const suffix of ['001', '002']) {
    const rule = fortuneKnowledge.bazi.rules.find(r => r.knowledgeId.endsWith('smth-v3-school-p011-' + suffix));
    const entry = fortuneKnowledge.bazi.entries.find(e => e.id === rule.knowledgeId);
    assert.equal(rule.queries[0].where.profile, baziSchoolExamPolicy.profile);
    assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
  }
});

test('two void bases revoke only the exact annual Nayin seal, retaining the position and the parallel day-stem reading', () => {
  const examples = [
    [{ year: 1960, month: 7, day: 5, hour: 0 }, 0, '辛巳', ['year', 'day'], undefined],
    [{ year: 1960, month: 6, day: 28, hour: 16 }, 0, '辛巳', ['year'], 'year'],
    [{ year: 1961, month: 1, day: 6, hour: 12 }, 1, '庚寅', ['year', 'day'], 'day'],
    [{ year: 1961, month: 7, day: 1, hour: 12 }, 1, '癸巳', ['year', 'day'], undefined, 'same-direction-generation'],
    [{ year: 1960, month: 7, day: 5, hour: 18 }, 0, '辛巳', ['year', 'day'], undefined, undefined, [{ position: 'hour', pillar: '癸酉' }]],
  ];
  for (const [birth, gender, luck, voids, supportedBasis, monthPairAssessment, combinations = []] of examples) {
    const run = submitCompleteExamYear(birth, gender, 1976);
    const fact = examFacts(run).find(row => row.normalizedPayload.annualPillar === '丙辰' && row.normalizedPayload.luckPillar === luck);
    assert.ok(fact, birth.day);
    const p = fact.normalizedPayload;
    assert.equal(p.nayinStorehouseSeal, true);
    assert.deepEqual(p.nayinSealVoidSources.map(row => row.basis), voids);
    assert.equal(p.nayinSealVoidBoth, voids.length === 2);
    assert.deepEqual(p.nayinSealVoidCombinations, combinations);
    if (combinations.length) assert.match(describeFortuneFact({ method: 'bazi', type: fact.factType, data: p }, String),
      /本命时柱癸酉的地支实际六合，是否有救助仍待核/u);
    assert.deepEqual(p.bases.filter(row => row.officerContact && row.supports.includes('正印')).map(row => row.basis),
      supportedBasis ? [supportedBasis] : []);
    const sameYear = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const hit = examResult(sameYear, '002');
    assert.equal(hit.status, supportedBasis ? 'partial' : 'not_matched', birth.day);
    assert.equal(hit.sourceFactIds.includes(fact.factId), Boolean(supportedBasis), birth.day);
    if (monthPairAssessment) {
      assert.equal(p.monthPairAssessment, monthPairAssessment);
      assert.equal(examResult(sameYear, '001').status, 'partial');
    }
  }
});

test('the named Geng-Xu Yi-Chou punishment removes only the annual storehouse seal route', () => {
  const cases = [
    [{ year: 1970, month: 7, day: 6, hour: 6 }, '辛巳', true],
    [{ year: 1971, month: 3, day: 25, hour: 14 }, '癸巳', false],
  ];
  for (const [birth, luck, punished] of cases) {
    const run = submitCompleteExamYear(birth, 0, 1985);
    const fact = examFacts(run).find(row => row.normalizedPayload.annualPillar === '乙丑' && row.normalizedPayload.luckPillar === luck);
    const p = fact.normalizedPayload;
    assert.equal(p.nayinStorehouseSeal, true);
    assert.equal(p.nayinSealVoidBoth, false);
    assert.equal(p.bases[0].officerContact, true);
    assert.deepEqual(p.nayinSealNamedPunishment, punished
      ? { birthPillar: '庚戌', annualPillar: '乙丑', branches: '戌丑' } : undefined);
    assert.deepEqual(p.bases[0].supports, punished ? [] : ['正印']);
    const current = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const hit = examResult(current, '002');
    assert.equal(hit.status, punished ? 'not_matched' : 'partial');
    assert.deepEqual(hit.sourceFactIds, punished ? [] : [fact.factId]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'named-seal-punishment'));
    if (punished) assert.match(formatFortuneFactAudit(input), /庚戌年命见乙丑，戌丑相刑/u);
    assert.doesNotMatch(formatFortunePrompt(input), /庚戌年命见乙丑|nayinSealNamedPunishment/u);
  }
});

test('p011-002 applies the same Na-yin seal punishment to actual Gui-Wei years without discarding independent noble support', async () => {
  const examples = [
    [{ year: 1973, month: 2, day: 8, hour: 12 }, 1, '癸丑', '辛亥', '丑未', []],
    [{ year: 1959, month: 6, day: 22, hour: 12 }, 1, '己亥', '丙寅', undefined, ['正印']],
    [{ year: 1958, month: 6, day: 24, hour: 12 }, 0, '戊戌', '甲寅', '戌未', ['天乙']],
  ];
  for (const [birth, gender, birthPillar, luck, branches, supports] of examples) {
    const run = submitCompleteExamYear(birth, gender, 2003);
    const fact = examFacts(run).find(row => row.normalizedPayload.annualPillar === '癸未' && row.normalizedPayload.luckPillar === luck);
    assert.ok(fact, birthPillar);
    const p = fact.normalizedPayload;
    assert.equal(p.nayinStorehouseSeal, true);
    assert.equal(p.nayinSealNamedPunishment, undefined);
    assert.equal(p.nayinSealVoidBoth, false);
    assert.equal(p.bases[0].officerContact, true);
    assert.deepEqual(p.nayinSealSameElementPunishment, branches
      ? { birthPillar, annualPillar: '癸未', branches, element: '木' } : undefined);
    assert.deepEqual(p.bases[0].supports, supports);
    const sameStage = { ...run, facts: run.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const hit = examResult(sameStage, '002');
    assert.equal(hit.status, supports.length ? 'partial' : 'not_matched');
    assert.deepEqual(hit.sourceFactIds, supports.length ? [fact.factId] : []);
    if (birthPillar === '癸丑') {
      const { input } = buildFortuneModelContext(sameStage,
        interpretFortune(sameStage, requestForFortuneRun(sameStage), 'school-seal-punishment'));
      assert.match(formatFortuneFactAudit(input), /癸丑年命见癸未，丑未相刑，同属木纳音/u);
      const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
        const message = JSON.parse(options.body).messages[1].content;
        assert.doesNotMatch(message, /癸丑年命见癸未|nayinSealSameElementPunishment/u);
        return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
      } });
      await provider.interpret(input);
    }
  }
});

test('p011-002 matches documented birth-branch support and the same-element Na-yin officer position independently', () => {
  const cases = [
    [{ year: 1979, month: 3, day: 11, hour: 12 }, 1, 1988, '戊辰', '丙寅', 'documented-year-support', '正天乙原例'],
    [{ year: 1986, month: 2, day: 7, hour: 12 }, 0, 2014, '甲午', '丁亥', 'documented-year-support', '本家禄原例'],
    [{ year: 1980, month: 9, day: 23, hour: 12 }, 1, 2027, '丁未', '庚寅', 'nayin-office', '天乙'],
  ];
  for (const [birth, gender, year, annual, luck, route, support] of cases) {
    const run = calculate(archive(gender, birth), year), hit = examResult(run, '002');
    assert.equal(hit.status, 'partial');
    const { normalizedPayload: p } = examFacts(run).find(row => hit.sourceFactIds.includes(row.factId)
      && row.normalizedPayload.annualPillar === annual);
    assert.equal(p.luckPillar, luck);
    assert.deepEqual(p.examSupportRoutes, [route]);
    if (route === 'documented-year-support') {
      assert.deepEqual(p.documentedSupports, [support]);
      assert.equal(p.bases[0].officerContact, true);
      assert.deepEqual(p.bases[0].supports, []);
    } else {
      assert.equal(p.bases[0].officerContact, false);
      assert.deepEqual(p.nayinOffice, { linguanBranch: '寅', luckNayin: '松柏木', sameElement: true, matchesBranch: true, supports: [support] });
    }
    const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'school-officer-review')).input;
    const prompt = formatFortuneFactAudit(model);
    assert.match(prompt, route === 'documented-year-support' ? new RegExp(support + '，与当段年干基准官位同见', 'u')
      : /按年命纳音核词馆正位在寅，当段运柱同纳音五行，为松柏木，同段岁层支持为天乙/u);
    assert.doesNotMatch(prompt, /examSupportRoutes|documentedSupports|nayinOffice/u);
    assert.ok(model.sections.every(section => section.findings.every(row => row.knowledgeId !== hit.knowledgeId)));
  }

  const woodNatal = archive(1, cases[2][0]).bazi.rawResult[0];
  const wrongElement = baziSchoolExamContext(woodNatal, true, '丁未', '甲寅');
  assert.equal(wrongElement.nayinOffice.matchesBranch, true);
  assert.equal(wrongElement.nayinOffice.sameElement, false);
  assert.deepEqual(wrongElement.examSupportRoutes, []);

  const nobleNatal = archive(1, cases[0][0]).bazi.rawResult[0];
  const wrongBasis = baziSchoolExamContext(nobleNatal, true, '戊辰', '丁亥');
  assert.equal(wrongBasis.bases[0].officerContact, false);
  assert.equal(wrongBasis.bases[1].officerContact, true);
  assert.deepEqual(wrongBasis.documentedSupports, ['正天乙原例']);
  assert.deepEqual(wrongBasis.examSupportRoutes, []);
});

test('p011-002 matches actual family Lu only within the verified year-based officer stage', () => {
  const cases = [
    { birth: { year: 1968, month: 3, day: 12, hour: 0 }, gender: 0, year: 1970, pillar: '庚戌', lu: '申', stage: '甲寅',
      transition: '1970-03-30T06:00:00.000Z' },
    { birth: { year: 1977, month: 3, day: 6, hour: 0 }, gender: 1, year: 2008, pillar: '戊子', lu: '巳', stage: '己亥' },
  ];
  for (const { birth, gender, year, pillar, lu, stage, transition } of cases) {
    const run = submitCompleteExamYear(birth, gender, year);
    const rows = examFacts(run).filter(row => row.normalizedPayload.annualPillar === pillar);
    const fact = rows.find(row => row.normalizedPayload.luckPillar === stage);
    const p = fact.normalizedPayload, hit = examResult(run, '002');
    assert.equal(p.annualFamilyLu, true);
    assert.equal(p.annualStemLuBranch, lu);
    assert.equal(p.birthBranch, lu);
    assert.deepEqual(p.bases[0].supports, []);
    assert.deepEqual(p.examSupportRoutes, ['annual-family-lu']);
    assert.equal(hit.status, 'partial');
    assert.ok(hit.sourceFactIds.includes(fact.factId));
    assert.ok(hit.windows.some(window => window.start <= fact.activeFrom && window.endExclusive >= fact.activeTo));
    if (transition) {
      const before = rows.find(row => row.activeTo === transition);
      assert.equal(fact.activeFrom, transition);
      assert.equal(hit.windows[0].start, transition);
      assert.equal(before.normalizedPayload.annualFamilyLu, true);
      assert.equal(before.normalizedPayload.confirmed, undefined);
      assert.ok(!hit.sourceFactIds.includes(before.factId));
    }
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'school-family-lu'));
    const prompt = formatFortuneFactAudit(input);
    assert.ok(prompt.includes('岁干' + pillar[0] + '的禄位在本命年支' + lu + '，按《五行精纪》核为本家禄，与当段年干基准官位同见'));
    assert.doesNotMatch(prompt, /annualFamilyLu|annual-family-lu/u);
  }
});

test('p011-002 requires an arriving stem to supply a distinct missing noble group member on the same year-based stage', () => {
  const cases = [
    { birth: [1968, 3, 6, 0, 0], year: 1969, pillar: '己酉', stage: '甲寅', group: '乙己',
      members: [['month', '乙'], ['day', '乙']], completes: true, expected: true },
    { birth: [1969, 5, 6, 16, 1], year: 1997, pillar: '丁丑', stage: '丙寅', group: '丙丁',
      members: [['hour', '丙']], completes: true, expected: true },
    { birth: [1968, 3, 6, 0, 0], year: 1975, pillar: '乙卯', stage: '甲寅', group: '乙己',
      members: [['month', '乙'], ['day', '乙']], completes: false, expected: false },
    { birth: [1968, 3, 6, 6, 0], year: 1969, pillar: '己酉', stage: '甲寅', group: '乙己',
      members: [['month', '乙'], ['day', '乙'], ['hour', '己']], completes: false, expected: false, natalComplete: true },
    { birth: [1968, 5, 6, 0, 0], year: 1995, pillar: '乙亥', stage: '甲寅', group: '乙己',
      members: [], completes: false, expected: false },
    { birth: [1968, 3, 6, 0, 0], year: 2029, pillar: '己酉', stage: '戊申', group: '乙己',
      members: [['month', '乙'], ['day', '乙']], completes: true, expected: false, dayOfficeOnly: true },
  ];
  for (const { birth: [birthYear, month, day, hour, gender], year, pillar, stage, group, members, completes, expected,
    natalComplete = false, dayOfficeOnly = false } of cases) {
    const submitted = submitCompleteExamYear({ year: birthYear, month, day, hour }, gender, year);
    const fact = examFacts(submitted).find(row => row.normalizedPayload.annualPillar === pillar && row.normalizedPayload.luckPillar === stage);
    const p = fact.normalizedPayload;
    assert.deepEqual(p.annualNobleGroup, { requiredStemPool: group, natalMembers: members.map(([position, stem]) => ({ position, stem })),
      natalGroupComplete: natalComplete, annualCompletesGroup: completes });
    assert.equal(p.bases[0].officerContact, !dayOfficeOnly);
    if (dayOfficeOnly) assert.equal(p.bases[1].officerContact, true);
    assert.deepEqual(p.examSupportRoutes, expected ? ['annual-noble-group'] : []);
    const run = { ...submitted, facts: submitted.facts.filter(row => row.factType !== fact.factType || row.factId === fact.factId) };
    const hit = examResult(run, '002');
    assert.equal(hit.status, expected ? 'partial' : 'not_matched');
    assert.deepEqual(hit.sourceFactIds, expected ? [fact.factId] : []);
    assert.deepEqual(hit.windows, expected ? [{ start: fact.activeFrom, endExclusive: fact.activeTo }] : []);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'school-noble-group'));
    const prompt = formatFortuneFactAudit(input);
    if (expected) {
      assert.ok(prompt.includes('所查的天乙干组为' + group));
      assert.ok(prompt.includes('岁干' + pillar[0] + '补足第二种天干，与当段年干基准官位同见'));
    } else {
      assert.doesNotMatch(prompt, /补足第二种天干，与当段年干基准官位同见/u);
    }
    assert.doesNotMatch(prompt, /annualNobleGroup|annual-noble-group/u);
  }
});

test('p011-002 accepts the new year-based supports at the same-element Na-yin officer seat', () => {
  const cases = [
    { birth: { year: 1980, month: 7, day: 6, hour: 6 }, year: 2055, pillar: '乙亥', support: '岁干补齐天乙干组' },
    { birth: { year: 1980, month: 7, day: 12, hour: 0 }, year: 2050, pillar: '庚午', support: '本家禄' },
  ];
  for (const { birth, year, pillar, support } of cases) {
    const run = submitCompleteExamYear(birth, 1, year);
    const hit = examResult(run, '002');
    const fact = examFacts(run).find(row => row.normalizedPayload.annualPillar === pillar && hit.sourceFactIds.includes(row.factId));
    assert.equal(hit.status, 'partial');
    assert.ok(fact);
    const p = fact.normalizedPayload;
    assert.equal(p.luckPillar, '庚寅');
    assert.equal(p.bases[0].officerContact, false);
    assert.deepEqual(p.examSupportRoutes, ['nayin-office']);
    assert.deepEqual(p.nayinOffice, { linguanBranch: '寅', luckNayin: '松柏木', sameElement: true, matchesBranch: true, supports: [support] });
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'school-nayin-support'));
    assert.ok(formatFortuneFactAudit(input).includes('当段运柱同纳音五行，为松柏木，同段岁层支持为' + support));
  }
});

test('p011-002 confirms a year storehouse seal when both year-based officer readings agree in the real luck stage', () => {
  const birth = { year: 1953, month: 5, day: 9, hour: 12 };
  const run = submitCompleteExamYear(birth, 0, 2012);
  const fact = examFacts(run).find(row => row.normalizedPayload.annualPillar === '壬辰'
    && row.normalizedPayload.luckPillar === '癸亥');
  assert.ok(fact);
  const p = fact.normalizedPayload;
  assert.equal(p.corroboratedNayinSealAtOffice, true);
  assert.equal(p.bases[0].officerContact, true);
  assert.equal(p.bases[1].officerContact, false);
  assert.deepEqual(p.nayinSealVoidSources, []);
  assert.deepEqual(p.nayinSealNatalDamage, []);
  assert.deepEqual(p.nayinOffice, { linguanBranch: '亥', luckNayin: '大海水', sameElement: true, matchesBranch: true, supports: ['正印'] });
  assert.equal(fact.activeFrom, '2012-08-20T12:00:00.000Z');
  const hit = examResult(run, '002');
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '大運在官位又太歲帶正印');
  assert.deepEqual(hit.sourceFactIds, [fact.factId]);
  assert.deepEqual(hit.windows, [{ start: fact.activeFrom, endExclusive: fact.activeTo }]);
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'school-nayin-seal-at-office'));
  assert.match(formatFortunePrompt(input), /实走的大运同时满足同篇的年干官贵临官/u);
  assert.ok(examFacts(run).some(row => row.activeTo === fact.activeFrom && row.normalizedPayload.corroboratedNayinSealAtOffice === false));
  const natal = archive(0, birth).bazi.rawResult[0];
  assert.equal(baziSchoolExamContext(natal, false, '壬辰', '癸亥').corroboratedNayinSealAtOffice, false);
});

test('p011-002 holds a damaged year storehouse seal at candidate level after the real office arrival', () => {
  for (const [hour, natalPillar, kind, branches, from] of [
    [2, '丁丑', '六破', '丑辰', '2012-10-10T02:00:00.000Z'],
    [6, '己卯', '六害', '卯辰', '2012-09-20T06:00:00.000Z'],
    [8, '庚辰', '相刑', '辰辰', '2012-09-10T08:00:00.000Z'],
    [20, '丙戌', '六冲', '戌辰', '2012-07-10T20:00:00.000Z'],
  ]) {
    const run = submitCompleteExamYear({ year: 1953, month: 5, day: 9, hour }, 0, 2012);
    const rows = examFacts(run);
    const fact = rows.find(row => row.normalizedPayload.annualPillar === '壬辰' && row.normalizedPayload.luckPillar === '癸亥');
    assert.equal(fact.activeFrom, from);
    const p = fact.normalizedPayload;
    assert.equal(p.bases[0].officerContact, true);
    assert.equal(p.nayinOffice.sameElement && p.nayinOffice.matchesBranch, true);
    assert.equal(p.nayinStorehouseSeal, true);
    assert.deepEqual(p.nayinSealVoidSources, []);
    assert.deepEqual(p.nayinSealNatalDamage, [{ kind, position: 'hour', natalPillar, annualPillar: '壬辰', branches }]);
    assert.equal(p.corroboratedNayinSealAtOffice, false);
    const hit = examResult(run, '002');
    assert.equal(hit.status, 'partial');
    assert.equal(hit.matchedSourceExcerpt, undefined);
    assert.deepEqual(hit.windows, [{ start: from, endExclusive: fact.activeTo }]);
    assert.deepEqual(hit.sourceFactIds, [fact.factId]);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'school-damaged-seal'));
    assert.ok(formatFortuneFactAudit(input).includes(`岁库印壬辰与本命时柱${natalPillar}地支有${kind}`));
    assert.doesNotMatch(formatFortunePrompt(input), /实走的大运同时满足同篇的年干官贵临官|岁库印壬辰|nayinSealNatalDamage/u);
  }
});

test('p011-002 independently confirms family Lu and dual-evidence Tianyi within the two year office readings', () => {
  for (const { birth, gender, year, from, luck, proof, excerpt, pattern } of [
    { birth: { year: 1953, month: 5, day: 9, hour: 12 }, gender: 0, year: 2016, from: '2016-02-04T09:46:03.000Z',
      luck: '癸亥', proof: 'corroboratedFamilyLuAtOffice', excerpt: '或本家祿', pattern: /实际岁干的本家禄位/u },
    { birth: { year: 1955, month: 4, day: 5, hour: 22 }, gender: 1, year: 2028, from: '2028-02-04T07:31:13.000Z',
      luck: '壬申', proof: 'corroboratedNobleAtOffice', excerpt: '或正天乙', pattern: /岁干补足同一生年支的具名天乙干组/u },
  ]) {
    const run = submitCompleteExamYear(birth, gender, year), hit = examResult(run, '002');
    const rows = examFacts(run), fact = rows.find(row => hit.sourceFactIds.includes(row.factId));
    const p = fact.normalizedPayload;
    assert.equal(hit.status, 'matched');
    assert.equal(hit.matchedSourceExcerpt, excerpt);
    assert.deepEqual(hit.windows, [{ start: from, endExclusive: run.time.displayWindow.instantRange.endInstantExclusive }]);
    assert.ok(rows.some(row => row.activeTo === from && row.normalizedPayload[proof] === false));
    assert.equal(p[proof], true);
    assert.equal(p.bases[0].officerContact, true);
    assert.ok(p.nayinOffice.matchesBranch && p.nayinOffice.sameElement);
    assert.equal(p.luckPillar, luck);
    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'school-noble-or-family-lu'));
    assert.match(formatFortunePrompt(input), pattern);
    assert.doesNotMatch(formatFortunePrompt(input), /corroboratedFamilyLuAtOffice|corroboratedNobleAtOffice/u);
  }
});
