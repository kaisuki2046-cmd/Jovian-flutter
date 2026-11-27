import assert from 'node:assert/strict';
import test from 'node:test';
import { assistantIdleExpressionSource } from './idleExpressions.ts';

const createSampler = Function(assistantIdleExpressionSource + '\nreturn createAssistantIdleExpressionSampler;')();
const expressions = Object.entries({
  wink: { winkEye: {} },
  sleepy: { sleepZTop: {} },
  love: { loveHeart: {} },
});
const rest = idleMs => ({ intro: false, idleMs });

function prescribedRandom(draws) {
  let index = 0;
  return () => {
    assert.ok(index < draws.length, 'randomness must only be consumed when a new idle period begins');
    return draws[index++];
  };
}

test('one expression starts at fifteen seconds and keeps its selection across redraws', () => {
  const sample = createSampler(expressions, prescribedRandom([0.8]));
  assert.equal(sample(rest(0)).weight, 0);
  assert.equal(sample(rest(14999)).weight, 0);
  assert.equal(sample(rest(15235)).weight, 0.5);
  assert.deepEqual(sample(rest(16000)), { name: 'love', target: expressions[2][1], weight: 1, elapsedMs: 1000 });
  assert.equal(sample(rest(19300)).weight, 1);
  assert.equal(sample(rest(20175)).weight, 0.5);
  assert.equal(sample(rest(20500)).weight, 0);
  assert.equal(sample(rest(29999)).weight, 0);
});

test('each later interval introduces one expression and avoids back-to-back repeats', () => {
  const sample = createSampler(expressions, prescribedRandom([0, 0, 0]));
  assert.equal(sample(rest(15500)).name, 'wink');
  assert.equal(sample(rest(30500)).name, 'sleepy');
  assert.equal(sample(rest(38000)).weight, 0);
  assert.equal(sample(rest(45500)).name, 'wink');
});

test('skipping a frame and pausing in the same interval do not change the selected expression', () => {
  const sample = createSampler(expressions, prescribedRandom([0.8]));
  assert.equal(sample({ intro: true, idleMs: 0 }).weight, 0);
  assert.equal(sample(rest(15500)).name, 'love');
  assert.equal(sample(null).weight, 0);
  assert.equal(sample(rest(15600)).name, 'love');
});
