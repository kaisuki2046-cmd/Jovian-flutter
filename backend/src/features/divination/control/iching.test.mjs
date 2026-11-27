import assert from 'node:assert/strict';
import test from 'node:test';
import { combineReadings } from './combined-reading.ts';
import { readLiuYao, readMeihua, rollLiuYaoLine } from './iching.ts';
import { openTarotSelection, pickTarotSlot } from './tarot.ts';

const coinsForValue = {
  6: [2, 2, 2],
  7: [2, 2, 3],
  8: [2, 3, 3],
  9: [3, 3, 3],
};
const tosses = (values) => values.map((value) => coinsForValue[value]);
const meiInput = (liuyao) => liuyao.lines.slice(0, 3).map(({ value }) => value);

test('the three-coin example in 增删卜易 forms 既济 from bottom to top', () => {
  const values = [7, 8, 9, 6, 9, 8];
  const readings = readLiuYao(tosses(values));
  assert.deepEqual(readings.lines.map(({ value }) => value), values);
  assert.deepEqual(readings.lines.map(({ kind }) => kind), ['少阳', '少阴', '老阳', '老阴', '老阳', '少阴']);
  assert.equal(readings.primary.name, '水火既济');
  assert.equal(readings.primary.lower, '离');
  assert.equal(readings.primary.upper, '坎');
  assert.deepEqual(readings.moving, [3, 4, 5]);
  assert.equal(readings.changed.name, '震为雷');
});

test('pure 乾 matches the source table for 纳支, 六亲 and 世应', () => {
  const readings = readLiuYao(tosses([7, 7, 7, 7, 7, 7]));
  assert.equal(readings.primary.name, '乾为天');
  assert.equal(readings.palace, '乾');
  assert.equal(readings.shi, 6);
  assert.equal(readings.ying, 3);
  assert.deepEqual(readings.lines.map(({ branch, relative, role }) => [branch, relative, role]), [
    ['子', '子孙', undefined], ['寅', '妻财', undefined], ['辰', '父母', '应'],
    ['午', '官鬼', undefined], ['申', '兄弟', undefined], ['戌', '父母', '世'],
  ]);
  assert.deepEqual(readings.moving, []);
  assert.strictEqual(readings.primary, readings.changed);
});

test('each six-line pattern resolves to a distinct hexagram', () => {
  const names = Array.from({ length: 64 }, (_, pattern) => {
    const values = Array.from({ length: 6 }, (_, index) => pattern & (1 << index) ? 7 : 8);
    const result = readLiuYao(tosses(values));
    assert.ok(result.lines.every(({ branch, element, relative }) => branch && element && relative));
    assert.equal(result.lines.filter(({ role }) => role === '世').length, 1);
    assert.equal(result.lines.filter(({ role }) => role === '应').length, 1);
    return result.primary.name;
  });
  assert.equal(new Set(names).size, 64);
});

test('Meihua uses the first three Liu Yao values, including remainder zero as line six', () => {
  const first = readLiuYao(tosses([7, 8, 9, 6, 9, 8]));
  const second = readLiuYao(tosses([7, 8, 9, 7, 8, 8]));
  const meihua = readMeihua(meiInput(first));
  assert.deepEqual(meihua.inputs, [7, 8, 9]);
  assert.equal(meihua.primary.name, '山地剥');
  assert.equal(meihua.moving, 6);
  assert.equal(meihua.nuclear.name, '坤为地');
  assert.equal(meihua.changed.name, '坤为地');
  assert.equal(meihua.body.name, '坤');
  assert.equal(meihua.use.name, '艮');
  assert.equal(meihua.relation, '体用比和');
  assert.deepEqual(readMeihua(meiInput(second)), meihua);
});

test('Meihua keeps the still trigram as body and compares original and changed use', () => {
  const reading = readMeihua([7, 6, 9]);
  assert.equal(reading.primary.name, '山水蒙');
  assert.equal(reading.moving, 4);
  assert.equal(reading.body.name, '坎');
  assert.equal(reading.use.name, '艮');
  assert.equal(reading.changedUse.name, '离');
  assert.equal(reading.relation, '用克体');
  assert.equal(reading.changedRelation, '体克用');
  assert.equal(reading.direction, 'verify');
});

test('a reading with supporting cards still puts a hexagram condition before action', () => {
  const question = { id: 1, kind: 'tarotQuestion', question: '我最近要不要换工作？' };
  const picking = openTarotSelection(question, () => 0);
  const tarot = pickTarotSlot(pickTarotSlot(pickTarotSlot(picking, 0), 1), 3);
  const liuyao = readLiuYao(tosses([7, 8, 9, 6, 9, 8]));
  const meihua = readMeihua(meiInput(liuyao));
  const combined = combineReadings(tarot, liuyao, meihua);

  assert.equal(tarot.overview.direction, 'advance');
  assert.equal(liuyao.direction, 'verify');
  assert.equal(meihua.direction, 'advance');
  assert.equal(combined.direction, 'verify');
  assert.match(combined.summary, /条件合适时，再做一个成本有限的尝试/);
  assert.match(combined.nextStep, /比较新旧岗位/);
  assert.strictEqual(combined.liuyao, liuyao);
  assert.strictEqual(combined.meihua, meihua);
});

test('aligned signals support a reversible trial in one report', () => {
  const question = { id: 1, kind: 'tarotQuestion', question: '我最近要不要换工作？' };
  const picking = openTarotSelection(question, () => 0);
  const tarot = [0, 1, 3].reduce(pickTarotSlot, picking);
  const liuyao = readLiuYao(tosses([7, 7, 7, 7, 7, 7]));
  const meihua = readMeihua(meiInput(liuyao));
  const report = combineReadings(tarot, liuyao, meihua);

  assert.equal(report.direction, 'advance');
  assert.match(report.answer, /通过面谈/);
  assert.match(report.summary, /容易改变的尝试/);
});

test('each throw consumes three coin flips and the reading requires six valid throws', () => {
  let calls = 0;
  const roll = () => rollLiuYaoLine(() => calls++ % 2 ? 0.75 : 0.25);
  const first = roll();
  assert.equal(calls, 3);
  assert.deepEqual(first, [2, 3, 2]);
  const rolled = [first, ...Array.from({ length: 5 }, roll)];
  assert.equal(calls, 18);
  assert.deepEqual(rolled, tosses([7, 8, 7, 8, 7, 8]).map((row, index) => index % 2 ? [3, 2, 3] : [2, 3, 2]));
  assert.throws(() => readLiuYao(rolled.slice(0, 5)), RangeError);
  assert.throws(() => readMeihua([6, 8, 10]), RangeError);
});
