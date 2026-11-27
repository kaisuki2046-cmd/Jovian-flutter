import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateFortuneCalendar, fortuneReferenceFields } from './control/fortune-calendar.ts';

const local = (instant) => {
  const { date, time } = fortuneReferenceFields(instant);
  return date + ' ' + time;
};

test('recomputes the five V2 windows and distinguishes the reference and action pillars', () => {
  const report = calculateFortuneCalendar({ date: '2026-11-11', time: '14:45' });
  assert.deepEqual(report.windows.map(({ period, periodStart, start, end }) => [
    period, local(periodStart), local(start), local(end),
  ]), [
    ['year', '2026-01-01 00:00', '2026-11-11 14:45', '2027-01-01 00:00'],
    ['month', '2026-11-01 00:00', '2026-11-11 14:45', '2026-12-01 00:00'],
    ['week', '2026-11-09 00:00', '2026-11-11 14:45', '2026-11-16 00:00'],
    ['day', '2026-11-11 00:00', '2026-11-11 14:45', '2026-11-12 00:00'],
    ['hour', '2026-11-11 15:00', '2026-11-11 15:00', '2026-11-11 16:00'],
  ]);
  assert.equal(report.windows[0].start, Date.parse('2026-11-11T06:45:00Z'));
  assert.deepEqual(report.referencePillars, { year: '丙午', month: '己亥', day: '己丑', hour: '辛未' });
  assert.deepEqual(report.actionPillars, { year: '丙午', month: '己亥', day: '己丑', hour: '壬申' });
  for (const time of ['15:00', '16:00', '16:59']) {
    assert.deepEqual(calculateFortuneCalendar({ date: '2026-11-11', time }).referencePillars, report.actionPillars);
  }
});

test('crosses midnight, Monday, month, and year boundaries and rejects invalid dates', () => {
  const date = '2023-12-31';
  const report = calculateFortuneCalendar({ date, time: '23:59' });
  assert.deepEqual(report.windows.slice(0, 4).map(({ end }) => local(end)), Array(4).fill('2024-01-01 00:00'));
  assert.equal(local(report.windows[2].periodStart), '2023-12-25 00:00');
  assert.equal(local(report.windows[4].start), '2024-01-01 00:00');
  assert.equal(report.referencePillars.day, calculateFortuneCalendar({ date, time: '22:59' }).referencePillars.day);
  assert.notEqual(report.referencePillars.day, report.actionPillars.day);
  assert.ok(calculateFortuneCalendar({ date: '2024-02-29', time: '12:00' }));
  assert.equal(calculateFortuneCalendar({ date: '2026-02-29', time: '12:00' }), null);
  assert.equal(calculateFortuneCalendar({ date, time: '24:00' }), null);
});
