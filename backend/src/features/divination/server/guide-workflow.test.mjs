import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { register } from 'node:module';
import { castCalendar } from '../control/cast-calendar.mjs';
import { readJingfang } from '../control/liuyao.mjs';
import { readMeihuaClicks } from '../control/meihua.mjs';
import { createReadingTaskService } from './reading-tasks.mjs';
import { parseProReport, parseSavedProReport, splitProInterpretation, splitProText } from '../model/pro-report.ts';
import { generateProReport, rawChartInput } from './pro-report.mjs';
import { tarotDeck } from '../model/tarot-deck.mjs';
import assets from '../data/asset_manifest.json' with { type: 'json' };

register('data:text/javascript,' + encodeURIComponent(`export function resolve(specifier, context, next) {
  if (context.parentURL?.includes('/divination/') && /^\\.\\.?\\//.test(specifier) && !/\\.[a-z]+$/.test(specifier)) {
    return next(specifier + '.ts', context);
  }
  return next(specifier, context);
}`), import.meta.url);
const { parseSnapshot } = await import('../requests/snapshot.ts');
const wire = (value) => JSON.parse(JSON.stringify(value));
const times = ['1794528000002', '1794528001003', '1794528002008'];
const coins = [[2, 2, 2], [3, 2, 2], [3, 3, 2], [3, 3, 3]];

test('a Tarot-first guide keeps the revealed draw for the final chart and report', async () => {
  const question = '这次面试后续会怎样？';
  const focus = '面试后续';
  let reportDraw;
  const service = createReadingTaskService(':memory:', {
    understand: async () => ({ focus, clarification: '', source: 'model' }),
    generatePro: async (task) => {
      reportDraw = task.draw;
      return { tarot: '塔罗解读。', meihua: '梅花易数解读。', liuyao: '六爻解读。' };
    },
  });
  try {
    const { proof } = await service.understandQuestion({ question, requireModel: true });
    const { token, task } = service.start({
      method: 'combined', profile: 'three-methods-v1', question, focus, proof, tarotFirst: true,
    });
    assert.equal(task.tarotFirst, true);
    assert.equal(task.stage, 'draw');
    assert.equal(task.slotCount, 78);
    assert.equal(task.draw, undefined);
    assert.throws(() => service.toss(token, { actionId: randomUUID(), step: 0 }), /toss_out_of_order/);
    const picks = [4, 17, 31].map((slot, step) => ({
      actionId: randomUUID(), step, slot, epochMs: times[step], monotonicMs: step, clockSessionId: randomUUID(),
    }));
    for (const pick of picks) service.pick(token, pick);
    const early = wire(service.get(token));
    assert.equal(early.stage, 'cast');
    assert.equal(early.tosses.length, 0);
    assert.equal(early.castResult, undefined);
    assert.deepEqual(early.draw.cards.map(({ slot }) => slot), [4, 17, 31]);
    assert.deepEqual(wire(service.pick(token, picks[2])), early);
    await assert.rejects(service.report(token), /report_not_ready/);
    for (let step = 0; step < 6; step++) service.toss(token, { actionId: randomUUID(), step });
    const complete = wire(service.get(token));
    assert.equal(complete.stage, 'reading');
    assert.deepEqual(complete.draw, early.draw);
    assert.deepEqual(complete.results.meihua.timestamps, times);
    assert.equal(complete.tosses.length, 6);
    assert.ok((await service.report(token)).proReport);
    assert.deepEqual(wire(reportDraw), early.draw);
  } finally {
    service.close();
  }
});

test('a chat question creates one complete automatic chart without manual ritual events', async () => {
  const question = '这次面试后续会怎样？';
  const focus = '面试后续';
  const service = createReadingTaskService(':memory:', {
    understand: async () => ({ focus, clarification: '', source: 'model' }),
    random: () => 0.3,
    generatePro: async (task) => {
      const input = rawChartInput(task);
      assert.equal(input.tarot.cards.length, 3);
      assert.equal(input.liuyao.tosses.length, 6);
      assert.deepEqual(input.meihua.inputs, [300, 300, 300]);
      assert.equal(input.meihua.inputSource, 'automatic-three-numbers');
      assert.equal(input.meihua.timestamps, undefined);
      return { tarot: '塔罗解读。', meihua: '梅花易数解读。', liuyao: '六爻解读。' };
    },
  });
  try {
    const { proof } = await service.understandQuestion({ question, requireModel: true });
    const { token, task } = service.start({ method: 'combined', profile: 'three-methods-v1', question, focus, proof, automatic: true });
    const snapshot = parseSnapshot(wire(task));
    assert.equal(snapshot.automatic, true);
    assert.equal(snapshot.stage, 'reading');
    assert.equal(snapshot.cardEvents, undefined);
    assert.equal(snapshot.draw.cards.length, 3);
    assert.equal(snapshot.tosses.length, 6);
    assert.match(snapshot.chartHash, /^[a-f0-9]{64}$/);
    const report = parseSnapshot(wire(await service.report(token)));
    assert.equal(report.chartHash, snapshot.chartHash);
    assert.deepEqual(report.proReport, { tarot: '塔罗解读。', meihua: '梅花易数解读。', liuyao: '六爻解读。' });
  } finally {
    service.close();
  }
});

test('only short inline phrases are styled in the Pro report', () => {
  const parts = splitProText('**整句解读。**后续可**留意电话**。**建议当面确认**。再等**反馈。');
  assert.deepEqual(parts.filter(({ bold }) => bold).map(({ text }) => text), ['留意电话']);
  assert.equal(parts.map(({ text }) => text).join(''), '整句解读。后续可留意电话。建议当面确认。再等反馈。');
});

test('explicit Pro phrases take precedence over the legacy interpretation highlight', () => {
  const highlighted = (text) => splitProInterpretation(text).filter(({ bold }) => bold).map(({ text }) => text);
  assert.deepEqual(highlighted('现状 · 星币三正位。对方可能在核实协作经验。'), ['对方可能在核实协作经验']);
  assert.deepEqual(highlighted('现状 · 星币三正位。**对方可能在核实协作经验。**'), ['对方可能在核实协作经验']);
  assert.deepEqual(highlighted('现状 · 星币三正位。对方在**核实协作经验**。接着可能会**安排补充沟通**，再**确认复试时间**。'),
    ['核实协作经验', '安排补充沟通', '确认复试时间']);
  assert.deepEqual(highlighted('星币三正位提示对方在**核实协作经验**。'), ['核实协作经验']);
  assert.deepEqual(highlighted('变卦提示后续仍需确认细节。'), ['后续仍需确认细节']);
});

test('existing Pro reports still load and a new overview has no detail', () => {
  const legacy = { tarot: '塔罗解读。', meihua: '梅花易数解读。', liuyao: '六爻解读。' };
  assert.deepEqual(parseProReport(legacy), legacy);
  const paragraph = { text: '盘面支持**继续沟通**。', detail: '盘面支持沟通，可以先等对方给出明确答复。' };
  const overview = { text: '综述 · 可以**再沟通一次**。行动建议 · 先**确认反馈时间**。' };
  const report = { tarot: [paragraph, paragraph, paragraph, overview], meihua: [paragraph, paragraph, overview], liuyao: [paragraph, paragraph, overview] };
  assert.deepEqual(parseProReport(report, false), report);
  const oldParagraph = { text: paragraph.text, technique: '盘面的依据。', interpretation: '先等对方给出明确答复。' };
  const old = { ...report, meihua: [oldParagraph, oldParagraph, { ...oldParagraph, text: '小结 · 等消息。' }] };
  assert.deepEqual(parseProReport(old).meihua, [
    { text: paragraph.text, detail: '盘面的依据。 先等对方给出明确答复。' },
    { text: paragraph.text, detail: '盘面的依据。 先等对方给出明确答复。' },
    { text: '综述 · 等消息。' },
  ]);
  assert.throws(() => parseProReport({ ...report, tarot: [paragraph, paragraph, paragraph, { ...overview, detail: '不应有详情' }] }, false),
    /Invalid Pro report paragraph detail/);
  assert.throws(() => parseProReport({ ...report, meihua: [paragraph, { text: '没有详情' }, overview] }, false),
    /Invalid Pro report paragraph detail/);
  assert.throws(() => parseProReport({ ...report, meihua: legacy.meihua }), /Invalid Pro report sections/);
});

test('archived five-field reports retain original text and valid highlights', () => {
  const section = { text: '牌面偏积极。可以先确认反馈时间。', highlight: '确认反馈时间' };
  const archived = { opening: '三种方法各有侧重。', tarot: section, meihua: section, liuyao: section, closing: '留意后续消息。' };
  assert.deepEqual(parseSavedProReport(archived), archived);
});

test('all 78 card faces and the card back are bundled with their recorded checksums', () => {
  assert.equal(new Set(tarotDeck.map(({ id }) => id)).size, 78);
  const files = new Map(assets.assets.map(({ file, sha256 }) => [file, sha256]));
  assert.equal(files.size, 79);
  for (const { id } of tarotDeck) assert.ok(files.has(id + '.jpg'), id);
  for (const [file, sha256] of files) {
    const bytes = readFileSync(new URL('../assets/tarot/' + file, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256, file);
  }
});

test('guide calendar, original-palace relatives, spirits and hidden lines match fixed samples', () => {
  for (const [time, day] of [['22:59:59', '甲子'], ['23:00:00', '乙丑']]) {
    assert.equal(castCalendar(Date.parse('2000-01-07T' + time + '+08:00')).day, day);
  }
  const calendar = { timezone: 'Asia/Shanghai', year: '庚辰', month: '己卯', day: '甲子' };
  const sample = readJingfang([9, 7, 7, 7, 7, 6].map((value) => coins[value - 6]), calendar);
  assert.deepEqual([sample.pattern, sample.changedPattern, sample.shi, sample.ying], [31, 62, 5, 2]);
  assert.deepEqual(sample.voidBranches, ['戌', '亥']);
  assert.equal(sample.originalLines[4].monthOpposed, true);
  assert.deepEqual(sample.changedLines.map(({ relative }) => relative), ['兄弟', '妻财', '子孙', '父母', '子孙', '兄弟']);
  assert.deepEqual(sample.hiddenSpirits.map(({ position, stem, branch, flyingStem, flyingBranch }) =>
    [position, stem, branch, flyingStem, flyingBranch]), [[2, '乙', '巳', '甲', '寅']]);
  for (let code = 0; code < 4096; code++) {
    const values = Array.from({ length: 6 }, (_, index) => (code >> (index * 2)) & 3);
    const movingMask = values.reduce((mask, value, index) => mask | (value === 0 || value === 3 ? 1 << index : 0), 0);
    const result = readJingfang(values.map((value) => coins[value]), calendar);
    assert.equal(result.pattern ^ result.changedPattern, movingMask);
  }
});

test('click arithmetic covers 384 combinations and preserves full values in event order', () => {
  const result = readMeihuaClicks(times);
  assert.deepEqual([result.primary.name, result.changed.name, result.nuclear.name, result.moving], ['泽火革', '泽山咸', '天风姤', 1]);
  assert.deepEqual(readMeihuaClicks([...times].reverse()).timestamps, [...times].reverse());
  assert.deepEqual(readMeihuaClicks([times[2], times[2], times[2]]).timestamps, Array(3).fill(times[2]));
  assert.equal(readMeihuaClicks(['1794528000001', '1794528001001', '1794528002001']).nuclear.name, '风火家人');
  assert.equal(readMeihuaClicks(['1794528000008', '1794528001000', '1794528002004']).nuclear.name, '坤为地');
  for (let upper = 1; upper <= 8; upper++) for (let lower = 1; lower <= 8; lower++) for (let moving = 1; moving <= 6; moving++) {
    const offset = (moving - upper - lower + 18) % 6 || 6;
    const result = readMeihuaClicks([upper, lower, offset].map((value) => String(2400000000000 + value)));
    assert.deepEqual([result.upperNumber, result.lowerNumber, result.moving], [upper, lower, moving]);
  }
});

test('guide session resumes the same 78 slots and replays accepted events after restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jovian-guide-'));
  const db = join(dir, 'test.sqlite');
  const question = '我这次面试后续会怎样？';
  const previousQuestion = '我能顺利完成这次面试吗？';
  let clock = Date.parse('2000-01-07T22:59:59+08:00');
  let count = 0;
  let comparisons = 0;
  const options = { now: () => clock, random: () => { count++; return 0.3; },
    understand: async (latest, _signal, guide, previous) => {
      assert.deepEqual([latest, guide, previous], [question, true, previousQuestion]);
      return { focus: '这次面试', clarification: '', source: 'model' };
    },
    generatePro: (task, signal) => generateProReport(task, {
      apiKey: 'test-key', signal,
      async transport(url, init) {
        comparisons++;
        const request = JSON.parse(init.body);
        assert.equal(url, 'https://api.deepseek.com/chat/completions');
        assert.equal(request.model, 'deepseek-v4-pro');
        assert.equal(request.messages[0].content,
          readFileSync(new URL('../docs/DeepSeek-Pro-Prompt.md', import.meta.url), 'utf8').trim());
        assert.equal(request.max_tokens, 8192);
        const input = JSON.parse(request.messages[1].content);
        assert.deepEqual([input.previousQuestion, input.question], [previousQuestion, question]);
        assert.deepEqual(input.liuyao.tosses, task.tosses);
        assert.deepEqual(input.meihua.timestamps, times);
        assert.deepEqual(input.tarot.cards.map(({ name }) => name), task.draw.cards.map(({ card }) => card.name));
        assert.equal(input.evidence, undefined);
        assert.equal(input.liuyao.primary.theme, undefined);
        if (comparisons === 1) return Response.json({ choices: [{ finish_reason: 'length' }] });
        const paragraph = (text, technique, interpretation) => ({ text, detail: technique + interpretation });
        const result = {
          tarot: [
            paragraph('牌面提示对方在**核实面试流程**。', '现状位反映当前需要检视的事项。', '可以留意对方是否询问过往项目。'),
            paragraph('影响在于是否会**补充沟通**。', '关键影响位指出当前的阻力。', '补充提问出现时可以主动说明。'),
            paragraph('趋势指向**确认反馈时间**。', '趋势位提示后续步骤。', '对方给出明确时间才算推进。'),
            { text: '综述 · 还有**继续沟通的空间**。行动建议 · 可以**准备协作案例**。' },
          ],
          meihua: [
            paragraph('体用变化提示**反馈来得较快**。', '从体用关系看彼此的作用。', '可以留意电话或消息。'),
            paragraph('变卦提示**仍需确认细节**。', '变卦用于观察后续转变。', '得到回应后可问清流程。'),
            { text: '综述 · 先看**有没有具体回应**。行动建议 · **留意来电**。' },
          ],
          liuyao: [
            paragraph('从动爻看，反馈可能**晚于预期**。', '动爻是看事情变化的线索。', '可以观察中间流程是否拖延。'),
            paragraph('世应提示**先等对方明确表态**。', '世应反映双方如何互动。', '对方回复前保持原有安排。'),
            { text: '综述 · 仍有**时间不确定性**。行动建议 · **约定反馈时间**。' },
          ],
        };
        return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] });
      },
    }),
  };
  let service = createReadingTaskService(db, options);
  try {
    const input = { method: 'combined', question, previousQuestion, focus: '这次面试', profile: 'three-methods-v1' };
    assert.throws(() => service.start(input), /question_needs_model_confirmation/);
    const { proof } = await service.understandQuestion({ question, previousQuestion, requireModel: true });
    assert.throws(() => service.start({ ...input, previousQuestion: '替换背景', proof }), /question_needs_model_confirmation/);
    const { token } = service.start({ ...input, proof });
    const first = { step: 0, actionId: randomUUID() };
    const firstSnapshot = service.toss(token, first);
    assert.equal(parseSnapshot(wire(firstSnapshot)).stage, 'cast');
    clock += 2000;
    for (let step = 1; step < 6; step++) service.toss(token, { step, actionId: randomUUID() });
    const deck = service.get(token);
    assert.equal(parseSnapshot(wire(deck)).slotCount, 78);
    assert.equal(deck.stage, 'draw');
    assert.equal(deck.slotCount, 78);
    assert.equal(deck.castResult.calendar.day, '甲子');
    assert.equal(deck.draw, undefined);
    const calls = count;
    assert.deepEqual(service.toss(token, first), JSON.parse(JSON.stringify(firstSnapshot)));
    assert.throws(() => service.toss(token, { ...first, step: 1 }), /action_conflict/);
    assert.equal(count, calls);
    const cards = times.map((epochMs, step) => ({ actionId: randomUUID(), clockSessionId: randomUUID(),
      monotonicMs: step, epochMs, step, slot: [77, 0, 35][step] }));
    const picked = service.pick(token, cards[0]);
    service.close();
    service = createReadingTaskService(db, options);
    assert.deepEqual(service.pick(token, cards[0]), JSON.parse(JSON.stringify(picked)));
    assert.throws(() => service.pick(token, { ...cards[0], epochMs: times[1] }), /action_conflict/);
    service.pick(token, cards[1]);
    const completed = service.pick(token, cards[2]);
    assert.equal(parseSnapshot(wire(completed)).chartHash, completed.chartHash);
    assert.deepEqual(completed.results.meihua.timestamps, times);
    assert.equal(new Set(completed.draw.cards.map(({ card }) => card.id)).size, 3);
    assert.match(completed.chartHash, /^[a-f0-9]{64}$/);
    await assert.rejects(service.report(token), /pro_model_invalid_output/);
    const [left, right] = await Promise.all([service.report(token), service.report(token)]);
    const { proReport } = parseSnapshot(wire(left));
    const phrases = (text) => splitProText(text).filter(({ bold }) => bold).map(({ text }) => text);
    assert.deepEqual(Object.keys(proReport), ['tarot', 'meihua', 'liuyao']);
    assert.deepEqual(proReport.tarot.slice(0, 3).flatMap(({ text }) => phrases(text)), ['核实面试流程', '补充沟通', '确认反馈时间']);
    assert.deepEqual(phrases(proReport.meihua[0].text), ['反馈来得较快']);
    assert.deepEqual(phrases(proReport.liuyao[0].text), ['晚于预期']);
    assert.equal(proReport.tarot[0].detail, '现状位反映当前需要检视的事项。可以留意对方是否询问过往项目。');
    assert.deepEqual(Object.keys(proReport.tarot.at(-1)), ['text']);
    assert.deepEqual(left, right);
    assert.equal(left.chartHash, completed.chartHash);
    assert.equal(left.report, undefined);
    assert.deepEqual((await service.report(token)).proReport, left.proReport);
    assert.equal(comparisons, 2);
    assert.equal(count, calls);
  } finally {
    service.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
