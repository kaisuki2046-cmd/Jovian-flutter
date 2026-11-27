import assert from 'node:assert/strict';
import { mkdtempSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { maxReportVersions } from '../model/report.ts';
import { assembleReport } from './report.mjs';
import { createTaskService, TaskError } from './tasks.mjs';

const question = '我最近要不要换工作？';
const fixtureTosses = [[2, 2, 3], [2, 3, 3], [3, 3, 3], [2, 2, 2], [3, 3, 3], [2, 3, 3]];
const fixedRandom = () => {
  const values = [...Array(18).fill(0), ...fixtureTosses.flat().map((coin) => coin === 2 ? 0 : 0.75)];
  return () => {
    assert.ok(values.length, 'no extra randomness');
    return values.shift();
  };
};

function pickThree(service, token) {
  return [7, 0, 3].map((slot, step) => service.pick(token, { slot, step }));
}

function tossSix(service, token) {
  return fixtureTosses.map((_, step) => service.toss(token, { step }));
}

const status = (code) => (error) => error instanceof TaskError && error.status === code;

test('task access, hidden cards and sequenced steps are durable across a restart', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'divination-test-'));
  const path = join(temp, 'tasks.sqlite');
  const random = fixedRandom();
  let service = createTaskService(path, { random });
  try {
    const { token, task } = service.start({ question, tosses: fixtureTosses });
    assert.deepEqual(task.selectedSlots, []);
    assert.equal(task.draw, undefined);
    assert.equal(Object.hasOwn(task, 'picking'), false);
    assert.throws(() => service.get('incorrect'), status(401));
    assert.throws(() => service.get('x'.repeat(43)), status(404));
    assert.throws(() => service.toss(token, { step: 0 }), status(409));
    assert.throws(() => service.start({ question: '我需要停药去工作吗？' }), status(400));

    const [first, second, final] = pickThree(service, token);
    assert.equal(first.draw, undefined);
    assert.equal(second.draw, undefined);
    assert.deepEqual(final.draw.cards.map(({ slot }) => slot), [7, 0, 3]);
    assert.deepEqual(service.pick(token, { step: 0, slot: 7 }), final);
    assert.throws(() => service.pick(token, { step: 0, slot: 6 }), status(409));
    assert.throws(() => service.toss(token, { step: 2 }), status(409));
    await assert.rejects(service.report(token, { version: 0 }), status(409));
    service.toss(token, { step: 0 });
    service.close();

    service = createTaskService(path, { random });
    assert.deepEqual(service.get(token).tosses, fixtureTosses.slice(0, 1));
    assert.deepEqual(service.toss(token, { step: 0 }).tosses, fixtureTosses.slice(0, 1));
    const completed = tossSix(service, token).at(-1);
    assert.deepEqual(completed.tosses, fixtureTosses);
    const firstReport = await service.report(token, { version: 0 });
    assert.equal(firstReport.reportVersion, 1);
    assert.equal(firstReport.report.nextSteps.length, 1);
    assert.doesNotMatch(JSON.stringify(firstReport.report), /塔罗|六爻|梅花易数/);
    assert.deepEqual(await service.report(token, { version: 0 }), firstReport);
    assert.deepEqual((await service.report(token, { version: 1 })).draw, final.draw);
    assert.deepEqual(service.get(token).tosses, fixtureTosses);
  } finally {
    service.close();
    rmSync(path, { force: true });
    rmSync(path + '-shm', { force: true });
    rmSync(path + '-wal', { force: true });
    rmdirSync(temp);
  }
});

test('concurrent generation requests share one model call for the same version', async () => {
  let callCount = 0;
  const service = createTaskService(':memory:', {
    random: fixedRandom(),
    generate: async (evidence) => {
      callCount++;
      await new Promise((resolve) => setImmediate(resolve));
      return assembleReport(evidence.choices, { explanations: ['combined', 'priority'], actions: ['first'] });
    },
  });
  try {
    const { token } = service.start({ question });
    pickThree(service, token);
    tossSix(service, token);
    const reports = await Promise.all(Array.from({ length: 3 }, () => service.report(token, { version: 0 })));
    assert.equal(callCount, 1);
    assert.deepEqual(reports, Array(3).fill(reports[0]));
    assert.match(reports[0].report.explanation, /\n\n/);
    for (let version = 1; version <= maxReportVersions; version++) {
      await service.report(token, { version });
    }
    assert.equal(service.get(token).reportVersion, maxReportVersions);
    assert.equal(callCount, maxReportVersions);
  } finally {
    service.close();
  }
});

test('a model timeout keeps the computed judgment and original draw available', async () => {
  const service = createTaskService(':memory:', {
    random: fixedRandom(),
    generate: async () => { throw new DOMException('Timeout', 'TimeoutError'); },
  });
  try {
    const { token } = service.start({ question });
    const picked = pickThree(service, token).at(-1);
    tossSix(service, token);
    const report = await service.report(token, { version: 0 });
    assert.deepEqual(report.draw, picked.draw);
    assert.deepEqual(report.tosses, fixtureTosses);
    assert.match(report.report.answer, /确认新岗位/);
    assert.match(report.report.explanation, /条件合适时/);
  } finally {
    service.close();
  }
});
