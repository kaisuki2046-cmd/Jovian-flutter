import assert from 'node:assert/strict';
import test from 'node:test';
import { assistantYawLimits, dragAssistant, frontView, stepAssistant } from './rotation.ts';

const degree = Math.PI / 180;

test('horizontal drags stop at the two reference side views and reverse without a dead zone', () => {
  const left = dragAssistant(frontView, -900, 0, 180);
  const right = dragAssistant(left, 900, 0, 180);
  assert.equal(left.yaw, -17 * degree);
  assert.equal(right.yaw, 25 * degree);
  assert.equal(dragAssistant(right, 40, 0, 180), right);
  assert.ok(dragAssistant(right, -1, 0, 180).yaw < right.yaw);
});

test('vertical pitch stays limited and reverses immediately after an overshoot', () => {
  const limit = dragAssistant(frontView, 0, 900, 180);
  assert.equal(limit.pitch, 60 * degree);
  assert.ok(dragAssistant(limit, 0, -1, 180).pitch < limit.pitch);
  assert.equal(dragAssistant(limit, 0, -900, 180).pitch, -10 * degree);
});

test('diagonal motion and accessible actions stay within the same pitch-dependent arc', () => {
  assert.deepEqual(assistantYawLimits(15 * degree), assistantYawLimits(0));
  for (const direction of [-1, 1]) {
    const side = dragAssistant(frontView, direction * 900, 15, 180);
    const halfway = dragAssistant(side, 0, 22.5, 180);
    assert.ok(Math.abs(halfway.yaw) < Math.abs(side.yaw));
    assert.ok(Math.abs(halfway.yaw) > 3 * degree);
    const bottom = dragAssistant(side, direction * 900, 900, 180);
    assert.equal(bottom.yaw, direction * 3 * degree);
    let keys = frontView;
    for (let i = 0; i < 20; i++) {
      keys = stepAssistant(stepAssistant(keys, direction < 0 ? 'left' : 'right'), 'down');
    }
    assert.deepEqual(keys, bottom);
  }
});

test('keyboard and accessibility steps use the same view and can restore the front', () => {
  const turned = stepAssistant(stepAssistant(frontView, 'left'), 'up');
  assert.ok(turned.yaw < 0 && turned.pitch < 0);
  assert.deepEqual(stepAssistant(stepAssistant(turned, 'right'), 'down'), frontView);
  assert.equal(stepAssistant(turned, 'reset'), frontView);
});
