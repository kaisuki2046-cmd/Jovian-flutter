import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Solar } from 'lunar-javascript';
import './server/knowledge/runtime.mjs';
import { formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';

const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { createFortuneDeepSeek } = await import('./server/deepseek-expression.mjs');
const { baziSmthOfficerMix } = await import('./control/bazi-smth-officer-mix.ts');

const id = 'bazi-fortune-v1-year-love-smth-v7-female-natal-p002-001';
const factType = 'smth_officer_mix_context';
const cases = {
  annual: [1989, 5, 21, 0, ['己巳', '己巳', '辛巳', '戊子']],
  transition: [1988, 3, 1, 18, ['戊辰', '甲寅', '乙卯', '乙酉']],
  repeat: [1987, 1, 25, 18, ['丙寅', '辛丑', '甲戌', '癸酉']],
  hidden: [1987, 2, 13, 0, ['丁卯', '壬寅', '癸巳', '壬子']],
  mixed: [1987, 1, 1, 0, ['丙寅', '庚子', '庚戌', '丙子']],
  withoutSupport: [1987, 1, 11, 0, ['丙寅', '辛丑', '庚申', '丙子']],
  twoHourOfficers: [1977, 6, 9, 22, ['丁巳', '丙午', '丁酉', '辛亥']],
  soleKiller: [1977, 6, 9, 0, ['丁巳', '丙午', '丁酉', '庚子']],
  twoMonthOfficers: [1981, 3, 21, 0, ['辛酉', '辛卯', '戊戌', '壬子']],
  twoNatalOfficers: [1977, 12, 6, 22, ['丁巳', '辛亥', '丁酉', '辛亥']],
  multiplePureKillers: [1977, 1, 18, 18, ['丙辰', '辛丑', '乙亥', '乙酉']],
  fireRemainder: [1951, 2, 9, 6, ['辛卯', '庚寅', '庚辰', '己卯']],
  waterRemainder: [1951, 6, 15, 22, ['辛卯', '甲午', '丙戌', '己亥']],
  reversedRemainder: [1952, 2, 5, 16, ['壬辰', '壬寅', '辛巳', '丙申']],
};
const outcome = run => matchFortuneKnowledge(run).byMethod.bazi.find(item => item.knowledgeId === id);
const facts = run => run.facts.filter(fact => fact.factType === factType);
const mainYear = run => facts(run).filter(fact => fact.normalizedPayload.yearPillar === '丙午');

function archive(name, gender = 'female', westCoast = false) {
  const [year, month, day, hour, natal] = cases[name];
  const local = Solar.fromYmdHms(year, month, day, hour, 0, 0).getLunar();
  // The Los Angeles fixture is May 1989, when the civil offset was UTC−07:00.
  assert.ok(!westCoast || name === 'annual');
  const utc = new Date(Date.UTC(year, month - 1, day, hour + (westCoast ? 7 : -8)));
  const terms = westCoast ? Solar.fromYmdHms(year, month, day, hour + 15, 0, 0).getLunar() : local;
  const columns = [terms.getYearInGanZhiExact(), terms.getMonthInGanZhiExact(), local.getDayInGanZhiExact(), local.getTimeInGanZhi()];
  assert.deepEqual(columns, natal);
  const yun = terms.getEightChar().getYun(gender === 'female' ? 0 : 1, 2);
  const start = yun.getStartSolar();
  const iso = date => new Date(date.toYmdHms().replace(' ', 'T') + '+08:00').toISOString();
  const luckPeriods = yun.getDaYun(11).slice(1).map(stage => ({ ganZhi: stage.getGanZhi(), startAge: stage.getStartAge(), endAge: stage.getEndAge() }));
  const luckContext = { gender, profile: 'lunar-javascript-beijing-jie-sect2-v1', direction: yun.isForward() ? 'forward' : 'backward',
    periods: luckPeriods.map((period, index) => ({ ...period, start: iso(start.nextYear(index * 10)), endExclusive: iso(start.nextYear((index + 1) * 10)) })) };
  const birthContext = { precision: 'minute', birthInstant: utc.toISOString(), clockVersion: 'gregory-iana-intl-v1',
    timeZone: 'America/Los_Angeles', latitude: 34.05, longitude: -118.25 };
  return { timeKnown: true, ...(westCoast ? { birthContext } : {}),
    bazi: { engineName: 'lunar-javascript', engineVersion: '1.7.8', rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1', rawResult: [{
      utc: utc.toISOString(), year: columns[0], month: columns[1], day: columns[2], hour: columns[3], luckPeriods, luckContext, tenGods: {}, shenSha: {},
    }] }, ziwei: { rawResult: [] }, western: { rawResult: [] } };
}

function submit(chart, year = 2026) {
  const params = { periodType: 'year', targetPeriod: { year }, displayTimezone: 'Asia/Shanghai' };
  const now = Date.UTC(year, 10, 1, 2);
  const reference = { snapshotId: 'officer-mix-snapshot' };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(params, now, { ...reference, chart })));
  return bindClientFortuneRun(params, batch, readClientFactTime(params, batch, now), 'officer-mix-run', reference);
}

test('the volume seven source hash survives the SQLite atomic predicate', () => {
  const entry = fortuneKnowledge.bazi.entries.find(item => item.id === id);
  const rule = fortuneKnowledge.bazi.rules.find(item => item.knowledgeId === id);
  assert.equal(rule.review.sourcePassageId, entry.source.passage_id);
  assert.equal(rule.review.sourceHash, createHash('sha256').update(JSON.stringify({ evidence: entry.evidence, conditions: entry.conditions })).digest('hex'));
  assert.equal(rule.queries.length, 1);
  assert.equal(rule.queries[0].factType, factType);
  assert.deepEqual(rule.queries[0].anyOf, [{ annualOppositeCandidate: true }, { luckOppositeCandidate: true },
    { twoOfficerSeatsWithoutKiller: true }, { luckSeasonRemainderOpposite: true }, { soleKillerSeatWithoutOfficer: true },
    { soleOfficerSeatWithoutKiller: true }, { twoNatalOfficerSeatsWithoutKiller: true }, { multiplePureNatalKillerSeats: true }]);
  assert.ok(rule.unresolved.length);
});

test('both pure natal branches use real phases, and a luck-only opposite begins at the verified stage instant', () => {
  const annual = submit(archive('annual'));
  const annualFact = mainYear(annual)[0], a = annualFact.normalizedPayload;
  assert.equal(a.verifiedFemaleArchive, true);
  assert.equal(a.natalPattern, 'officer_only');
  assert.deepEqual(a.phaseEvidence.map(row => [row.stem, row.monthSupport, row.hourOnlySupport]), [['丙', true, false]]);
  assert.deepEqual(a.sameKind.map(row => [row.column, row.stem, row.placement]), [['annual', '丙', 'stem']]);
  assert.deepEqual(a.differentKind.map(row => [row.column, row.stem, row.placement]), [['annual', '丁', 'main_qi']]);
  assert.equal(a.luckOppositeCandidate, false);
  assert.equal(outcome(annual).status, 'partial');

  const transition = submit(archive('transition'));
  const [old, next] = mainYear(transition);
  const start = '2026-10-07T22:00:00.000Z';
  assert.equal(old.activeTo, start);
  assert.equal(next.activeFrom, start);
  assert.equal(old.normalizedPayload.luckPillar, '辛亥');
  assert.equal(old.normalizedPayload.luckOppositeCandidate, false);
  assert.equal(next.normalizedPayload.natalPattern, 'killer_only');
  assert.deepEqual(next.normalizedPayload.phaseEvidence.map(row => [row.stem, row.monthSupport, row.hourOnlySupport]), [['辛', false, true]]);
  assert.equal(next.normalizedPayload.annualOppositeCandidate, false);
  assert.deepEqual(next.normalizedPayload.differentKind.map(row => [row.column, row.pillar, row.stem, row.god]), [['decadal', '庚戌', '庚', '正官']]);
  assert.equal(next.normalizedPayload.effectiveMixVerified, false);
  const match = outcome(transition);
  assert.equal(match.status, 'partial');
  assert.deepEqual(match.windows, [{ start, endExclusive: '2026-12-31T16:00:00.000Z' }]);
  assert.deepEqual(match.sourceFactIds, [next.factId]);
  assert.ok(next.sourceFactIds.every(source => transition.rawFacts.some(raw => raw.rawFactId === source)));
});

test('the sole killer seat in the source tradition stops confirming when an actual officer arrives', () => {
  const run = submit(archive('soleKiller'));
  const cut = '2026-12-17T14:00:00.000Z';
  const before = mainYear(run).find(row => row.activeTo === cut && row.normalizedPayload.luckPillar === '庚戌');
  const after = mainYear(run).find(row => row.activeFrom === cut && row.normalizedPayload.luckPillar === '辛亥');
  assert.ok(before && after);
  const p = before.normalizedPayload;
  assert.equal(p.verifiedFemaleArchive, true);
  assert.equal(p.natalPattern, 'killer_only');
  assert.deepEqual(p.nativePositions.map(row => [row.column, row.pillar, row.stem, row.placement]), [['hour', '庚子', '癸', 'main_qi']]);
  assert.deepEqual(p.phaseEvidence.map(row => [row.stem, row.monthSupport, row.hourOnlySupport]), [['癸', false, true]]);
  assert.equal(p.soleKillerSeatWithoutOfficer, true);
  assert.deepEqual(p.sameKind, []);
  assert.deepEqual(p.differentKind, []);
  assert.equal(after.normalizedPayload.soleKillerSeatWithoutOfficer, false);
  assert.deepEqual(after.normalizedPayload.differentKind.map(row => [row.column, row.pillar, row.stem, row.placement]),
    [['decadal', '辛亥', '壬', 'main_qi']]);
  const hit = outcome(run);
  assert.equal(hit.status, 'matched');
  assert.equal(hit.matchedSourceExcerpt, '一位為好');
  const beforeLiChun = facts(run).find(row => row.activeTo === before.activeFrom && row.normalizedPayload.yearPillar === '乙巳');
  assert.equal(beforeLiChun.normalizedPayload.soleKillerSeatWithoutOfficer, true);
  assert.deepEqual(hit.windows, [{ start: beforeLiChun.activeFrom, endExclusive: cut }]);
  assert.deepEqual(hit.sourceFactIds, [beforeLiChun.factId, before.factId]);
  assert.ok(hit.candidateFactIds.includes(after.factId));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'one-killer-seat'));
  const prompt = formatFortunePrompt(input);
  assert.match(prompt, /一位為好/u);
  assert.match(prompt, /原局透藏仅一整柱见七杀/u);
  assert.doesNotMatch(prompt, /俱為良婦|soleKillerSeatWithoutOfficer/u);
  const natal = Object.fromEntries(['year', 'month', 'day', 'hour'].map((key, index) => [key, cases.soleKiller[4][index]]));
  const residual = baziSmthOfficerMix(natal, '戊辰', { status: 'confirmed', pillar: '庚戌' }, 'female');
  assert.deepEqual(residual.sameKind, []);
  assert.equal(residual.soleKillerSeatWithoutOfficer, false);
  assert.equal(baziSmthOfficerMix(natal, '丙午', { status: 'unavailable' }, 'female').soleKillerSeatWithoutOfficer, undefined);
  assert.equal(baziSmthOfficerMix(natal, '丙午', { status: 'confirmed', pillar: '庚戌' }, 'male').verifiedFemaleArchive, false);
});

test('the two source remainder stems extend the same otherwise unsupported fortune at the verified luck change', () => {
  for (const { name, year, cut, prior, current, stem } of [
    { name: 'fireRemainder', year: 1999, cut: '1999-08-05T02:00:00.000Z', prior: '甲午', current: '乙未', stem: '丁' },
    { name: 'waterRemainder', year: 2018, cut: '2018-11-30T00:00:00.000Z', prior: '庚子', current: '辛丑', stem: '癸' },
  ]) {
    const run = submit(archive(name), year), match = outcome(run);
    assert.equal(match.status, 'partial');
    const before = facts(run).find(fact => fact.activeTo === cut && fact.normalizedPayload.luckPillar === prior);
    const after = facts(run).find(fact => fact.activeFrom === cut && fact.normalizedPayload.luckPillar === current);
    assert.ok(before && after);
    assert.equal(before.normalizedPayload.luckOppositeCandidate, true);
    assert.equal(before.normalizedPayload.luckSeasonRemainderOpposite, false);
    const p = after.normalizedPayload;
    assert.equal(p.luckOppositeCandidate, false);
    assert.equal(p.annualOppositeCandidate, false);
    assert.equal(p.twoOfficerSeatsWithoutKiller, false);
    assert.equal(p.luckSeasonRemainderOpposite, true);
    assert.deepEqual([p.continuedSeasonOfficer.priorLuckPillar, p.continuedSeasonOfficer.role.pillar,
      p.continuedSeasonOfficer.role.stem, p.continuedSeasonOfficer.role.placement], [prior, current, stem, 'other_hidden']);
    assert.ok(match.sourceFactIds.includes(after.factId));

    const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'officer-season-remainder'));
    const phrase = '按卷十所列余气，实际大运由' + prior + '进入' + current;
    assert.ok(formatFortuneFactAudit(input).includes(phrase));
    assert.ok(!formatFortunePrompt(input).includes(phrase));
  }
  const reverse = submit(archive('reversedRemainder'), 2012);
  const after = facts(reverse).find(fact => fact.activeFrom === '2012-03-31T00:00:00.000Z' && fact.normalizedPayload.luckPillar === '乙未');
  assert.ok(after.normalizedPayload.differentKind.some(row => row.stem === '丁' && row.placement === 'other_hidden'));
  assert.equal(after.normalizedPayload.luckSeasonRemainderOpposite, false);
  assert.ok(!outcome(reverse).sourceFactIds.includes(after.factId));
});

test('surplus repetitions, isolated opposite residual qi, already mixed natal and lack of named seasonal support do not qualify', () => {
  for (const [name, expectedPattern] of [['repeat', 'officer_only'], ['hidden', 'officer_only'], ['mixed', 'mixed'], ['withoutSupport', 'killer_only']]) {
    const run = submit(archive(name)), row = mainYear(run)[0].normalizedPayload;
    assert.equal(row.natalPattern, expectedPattern, name);
    if (name === 'repeat') {
      assert.ok(row.sameKind.length && !row.differentKind.length);
      assert.ok(new Set(row.nativePositions.map(role => role.column)).size > 1);
      assert.equal(row.twoOfficerSeatsWithoutKiller, false);
    }
    if (name === 'hidden') assert.ok(row.differentKind.length && row.differentKind.every(role => role.placement === 'other_hidden'));
    if (name === 'withoutSupport') assert.ok(row.annualOppositeCandidate && !row.natalProsperityCandidate);
    assert.equal(outcome(run).status, 'not_matched', name);
  }
});

test('a verified second officer without any killer begins or ends at the real luck boundary', async () => {
  const cases = [
    { name: 'twoHourOfficers', cut: '2026-08-28T12:00:00.000Z', prior: '庚戌', next: '辛亥', starts: true,
      natalOfficer: ['hour', '辛亥', '壬', 'main_qi'], movingOfficer: ['decadal', '辛亥', '壬', 'main_qi'] },
    { name: 'twoMonthOfficers', cut: '2026-04-15T02:00:00.000Z', prior: '乙未', next: '丙申', starts: false,
      natalOfficer: ['month', '辛卯', '乙', 'main_qi'], movingOfficer: ['decadal', '乙未', '乙', 'stem'] },
  ];
  const seat = row => [row.column, row.pillar, row.stem, row.placement];
  for (const e of cases) {
    const run = submit(archive(e.name)), match = outcome(run);
    const before = mainYear(run).find(row => row.activeTo === e.cut);
    const after = mainYear(run).find(row => row.activeFrom === e.cut);
    assert.ok(before && after, e.name);
    assert.deepEqual([before.normalizedPayload.luckPillar, after.normalizedPayload.luckPillar], [e.prior, e.next]);
    const active = e.starts ? after : before, inactive = e.starts ? before : after;
    const p = active.normalizedPayload;
    assert.equal(p.natalProsperityCandidate, true);
    assert.equal(p.twoOfficerSeatsWithoutKiller, true);
    assert.deepEqual(p.nativePositions.map(seat), [e.natalOfficer]);
    assert.deepEqual(p.sameKind.map(seat), [e.movingOfficer]);
    assert.deepEqual(p.differentKind, []);
    assert.equal(inactive.normalizedPayload.twoOfficerSeatsWithoutKiller, false);
    assert.equal(match.status, 'matched');
    assert.ok(match.matchedSourceExcerpt.split('\n').includes('有兩位官星無煞以雜之'));
    assert.ok(match.sourceFactIds.includes(active.factId));
    assert.ok(match.sourceFactIds.includes(inactive.factId));
    assert.equal(inactive.normalizedPayload.soleOfficerSeatWithoutKiller, true);
    const boundary = e.starts ? 'start' : 'endExclusive';
    const separateBranch = match.confirmedBranches.find(branch => branch.conditions.some(line => line.includes('按整柱计两处')));
    assert.ok(separateBranch.windows.some(row => row[boundary] === e.cut));
    assert.ok(separateBranch.sourceFactIds.includes(active.factId));
    assert.ok(!separateBranch.sourceFactIds.includes(inactive.factId));

    const model = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'two-officer-seats')).input;
    const prompt = formatFortuneFactAudit(model);
    assert.match(prompt, /两处正官，原局与同段岁运透藏未见七杀/u);
    assert.ok(prompt.includes(e.natalOfficer[1]) && prompt.includes(e.movingOfficer[1]));
    assert.doesNotMatch(prompt, /twoOfficerSeatsWithoutKiller/u);
    const finding = model.sections.flatMap(section => section.findings).find(row => row.knowledgeId === id);
    assert.equal(finding.originalText, match.matchedSourceExcerpt);
    assert.deepEqual(finding.windows, match.windows);
    assert.ok(finding.confirmedBranches.some(branch => /按整柱计两处.*明透与藏干均未见七杀/u.test(branch.conditions.join(''))));
    assert.ok(prompt.includes('本命只核一处正官，同段岁运透藏均未增加官杀'));
    const provider = createFortuneDeepSeek({ apiKey: 'fixture', transport: async (_, options) => {
      const message = JSON.parse(options.body).messages[1].content;
      assert.match(message, /有兩位官星無煞以雜之/u);
      assert.doesNotMatch(message, /一位為好有兩位|俱為良婦|verifiedFemaleArchive|twoOfficerSeatsWithoutKiller/u);
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
    } });
    await provider.interpret(model);
    if (e.name === 'twoMonthOfficers') {
      const hurt = matchFortuneKnowledge(run).byMethod.bazi.find(item => item.knowledgeId.endsWith('career-smth-v5-hurting-p003-001'));
      const proof = run.facts.find(row => row.factType === 'smth_seal_hurting_context' && row.activeTo === e.cut
        && hurt.sourceFactIds.includes(row.factId));
      assert.equal(hurt.status, 'partial');
      assert.ok(proof.normalizedPayload.hurtOfficerReview.some(row => row.hurt.stem === '辛'
        && row.arrivals.some(arrival => arrival.officer.stem === '乙'
          && arrival.damage.some(link => link.kind === '六破' && link.members.includes('day')))));
    }
  }

  const annualRun = submit(archive('twoMonthOfficers'), 2035);
  const annualFact = facts(annualRun).find(row => row.normalizedPayload.yearPillar === '乙卯');
  const annual = annualFact.normalizedPayload;
  assert.equal(annual.luckPillar, '丙申');
  assert.deepEqual(annual.sameKind.map(seat), [['annual', '乙卯', '乙', 'stem'], ['annual', '乙卯', '乙', 'main_qi']]);
  assert.equal(annual.twoOfficerSeatsWithoutKiller, true);
  const annualMatch = outcome(annualRun);
  assert.equal(annualMatch.status, 'matched');
  assert.ok(annualMatch.sourceFactIds.includes(annualFact.factId));

  const natal = archive('twoMonthOfficers').bazi.rawResult[0];
  const evaluate = (year, luck) => baziSmthOfficerMix(natal, year, { status: 'confirmed', pillar: luck }, 'female');
  assert.equal(evaluate('丙午', '乙卯').sameKind.length, 2);
  assert.equal(evaluate('丙午', '乙卯').twoOfficerSeatsWithoutKiller, true);
  assert.equal(evaluate('乙卯', '乙未').twoOfficerSeatsWithoutKiller, false);
  assert.ok(evaluate('丙午', '乙亥').differentKind.some(row => row.stem === '甲' && row.placement === 'other_hidden'));
  assert.equal(evaluate('丙午', '乙亥').twoOfficerSeatsWithoutKiller, false);
  assert.equal(baziSmthOfficerMix(natal, '乙卯', { status: 'unavailable' }, 'female').twoOfficerSeatsWithoutKiller, undefined);
});

test('original two-officer and pure-killer seats confirm only their actual periods', () => {
  const cases = [
    { name: 'twoNatalOfficers', year: 2011, pillar: '辛卯', next: '壬辰', luck: '乙卯',
      flag: 'twoNatalOfficerSeatsWithoutKiller', excerpt: '有兩位官星無煞以雜之', local: '本命两处正官' },
    { name: 'multiplePureKillers', year: 2009, pillar: '己丑', next: '庚寅', luck: '戊戌',
      flag: 'multiplePureNatalKillerSeats', excerpt: '四柱純煞無官以混之', local: '本命多处均为七杀' },
  ];
  for (const e of cases) {
    const chart = archive(e.name), positive = submit(chart, e.year), negative = submit(chart, e.year + 1);
    const actual = facts(positive).find(row => row.normalizedPayload.yearPillar === e.pillar);
    const later = facts(negative).find(row => row.normalizedPayload.yearPillar === e.next);
    assert.equal(actual.normalizedPayload.luckPillar, e.luck);
    assert.equal(later.normalizedPayload.luckPillar, e.luck);
    assert.equal(actual.normalizedPayload[e.flag], true);
    assert.equal(later.normalizedPayload[e.flag], false);
    const match = outcome(positive);
    assert.equal(match.status, 'matched');
    assert.ok(match.sourceFactIds.includes(actual.factId));
    assert.ok(match.matchedSourceExcerpt.split('\n').includes(e.excerpt));
    assert.ok(!outcome(negative).sourceFactIds.includes(later.factId));
    const model = buildFortuneModelContext(positive, interpretFortune(positive, requestForFortuneRun(positive), e.name)).input;
    assert.ok(formatFortuneFactAudit(model).includes(e.local));
  }
});

test('requires an explicitly declared and independently checked archive and respects the birthplace civil clock', () => {
  const male = submit(archive('annual', 'male'));
  assert.ok(facts(male).every(row => row.normalizedPayload.verifiedFemaleArchive === false));
  assert.equal(outcome(male).status, 'not_matched');
  for (const alter of [chart => { delete chart.bazi.rawResult[0].luckContext; },
    chart => { delete chart.bazi.rawResult[0].luckContext.periods; },
    chart => { chart.bazi.rawResult[0].luckContext.periods[3].ganZhi = '甲子'; },
    chart => { chart.bazi.rawResult[0].luckContext.gender = 'male'; },
    chart => { chart.bazi.rawResult.push(structuredClone(chart.bazi.rawResult[0])); },
    chart => { chart.timeKnown = false; }]) {
    const chart = archive('annual'); alter(chart);
    const run = submit(chart);
    assert.ok(facts(run).every(row => row.normalizedPayload.verifiedFemaleArchive === undefined));
    assert.equal(outcome(run).status, 'unknown');
  }
  const chart = archive('annual', 'female', true);
  assert.equal(outcome(submit(chart)).status, 'partial');
  assert.equal(outcome(submit({ ...chart, birthContext: { ...chart.birthContext, timeZone: 'invalid' } })).status, 'unknown');
  assert.equal(outcome(submit({ ...chart, birthContext: undefined })).status, 'unknown');
});

test('actual model transport includes verified role locations and never projects the gender or partial source excerpt', async () => {
  const run = submit(archive('transition'));
  const { input } = buildFortuneModelContext(run, interpretFortune(run, requestForFortuneRun(run), 'officer-mix-model'));
  const projected = input.facts.filter(fact => fact.type === factType);
  assert.equal(projected.length, 1);
  assert.equal(projected[0].data.verifiedFemaleArchive, undefined);
  assert.ok(input.sections.every(section => section.findings.every(finding => finding.knowledgeId !== id)));
  const prompt = formatFortuneFactAudit(input);
  assert.match(prompt, /辛在本命时柱乙酉地支为临官/u);
  assert.match(prompt, /同段已核大运柱庚戌的天干庚为正官/u);
  assert.match(prompt, /实际取用、制化和关系结果仍待核定/u);
  assert.doesNotMatch(prompt, /verifiedFemaleArchive|female|officer-mix-run|smth_officer_mix_context|一位為好有兩位官星無煞以雜之|[{}\[\]]/u);
  let called = false;
  const provider = createFortuneDeepSeek({ apiKey: 'test-key', transport: async (_url, options) => {
    called = true;
    assert.equal(JSON.parse(options.body).messages[1].content, formatFortunePrompt(input));
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(input);
  assert.equal(called, true);
});
