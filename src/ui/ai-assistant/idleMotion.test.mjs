import assert from 'node:assert/strict';
import test from 'node:test';
import { assistantIdleMotionSource, assistantIntroDurationMs } from './idleMotion.ts';

const sample = Function(assistantIdleMotionSource + '\nreturn sampleAssistantIdleMotion;')();
const swim = Function(assistantIdleMotionSource + '\nreturn sampleAssistantSwim;')();

test('the swim goes both ways and settles facing front', () => {
  const left = swim(2200, 0);
  const right = swim(4700, 0);
  assert.ok(left.x < -0.08 && left.yaw < 0);
  assert.ok(right.x > 0.08 && right.yaw > 0);
  for (const t of [0, 6070, 9400]) {
    const rest = swim(t, 0);
    assert.ok(Math.abs(rest.x) < 0.001);
    assert.ok(Math.abs(rest.yaw) < 0.001);
  }
});

test('side docks face inward and keep their swim on the chat side', () => {
  for (const direction of [-1, 1]) {
    const rest = swim(0, direction);
    const moving = swim(2200, direction);
    assert.ok(rest.yaw * direction > 0.4);
    assert.equal(moving.yaw, rest.yaw);
    assert.ok(moving.x * direction > 0);
  }
});

test('the jelly stays planted and slowly gathers before its crown rises', () => {
  const flat = sample(0);
  assert.ok(flat.scaleY < 0.55);
  assert.ok(flat.scaleX > 1);
  assert.equal(flat.bandOpacity, 0);
  assert.equal(flat.cupOpacity, 0);
  assert.equal(flat.faceOpacity, 0);
  assert.equal(flat.feetProgress, 0);
  const base = pose => -0.795 * pose.scaleY + pose.offsetY;
  const gathered = sample(890);
  assert.ok(gathered.scaleY > flat.scaleY && gathered.scaleY - flat.scaleY < 0.06);
  assert.ok(gathered.scaleX < flat.scaleX);
  assert.ok(Math.abs(gathered.ripplePhase - flat.ripplePhase) < 0.21);
  assert.ok(flat.ripple < 0.08);
  for (let t = 0; t <= 1720; t += 40) assert.ok(Math.abs(base(flat) - base(sample(t))) < 0.001);
});

test('headband appears first, eyes open and blink, then look left and right before the feet emerge', () => {
  assert.ok(sample(1310).bandOpacity > 0);
  assert.equal(sample(1310).cupOpacity, 0);
  assert.ok(sample(1450).cupOpacity > 0);
  assert.equal(sample(1450).faceOpacity, 0);
  assert.ok(sample(1620).faceOpacity > 0 && sample(1620).eyeOpen < 0.2);
  assert.equal(sample(1800).eyeOpen, 1);
  assert.ok(sample(1930).eyeOpen < 0.15);
  assert.equal(sample(2010).eyeOpen, 1);
  assert.equal(sample(2190).glance, -1);
  assert.equal(sample(2230).glance, -1);
  assert.equal(sample(2470).glance, 1);
  assert.equal(sample(2550).glance, 1);
  assert.equal(sample(2740).glance, 0);
  assert.equal(sample(2740).feetProgress, 0);
  assert.ok(sample(3250).feetProgress > 0 && sample(3250).feetProgress < 1);
  assert.equal(sample(3750).feetProgress, 1);
});

test('the entrance ends once and idle time continues across later expression intervals', () => {
  assert.equal(sample(assistantIntroDurationMs - 1).intro, true);
  assert.equal(sample(assistantIntroDurationMs).intro, false);
  assert.equal(sample(assistantIntroDurationMs).idleMs, 0);
  assert.equal(sample(assistantIntroDurationMs + 14999).idleMs, 14999);
  assert.equal(sample(assistantIntroDurationMs + 15000).intro, false);
  assert.equal(sample(assistantIntroDurationMs + 15000).idleMs, 15000);
  assert.equal(sample(assistantIntroDurationMs + 30000).intro, false);
  assert.equal(sample(assistantIntroDurationMs + 30000).idleMs, 30000);
});

test('the dock can start fully visible and skip the entrance entirely', () => {
  assert.equal(sample(0, false).intro, false);
  assert.equal(sample(0, false).scaleY, 1);
  assert.equal(sample(300, false).idleMs, 300);
  assert.equal(sample(15000, false).idleMs, 15000);
});

test('the idle pose drifts gently and joins the end of the entrance without a jump', () => {
  const idle = sample(assistantIntroDurationMs + 3300);
  assert.ok(Math.abs(idle.offsetY) > 0 && Math.abs(idle.offsetY) < 0.022);
  assert.ok(Math.abs(idle.roll) < 0.018);
  assert.equal(sample(assistantIntroDurationMs).scaleY, 1);
  assert.equal(sample(assistantIntroDurationMs + 15000).scaleY, 1);
  assert.ok(Math.abs(sample(assistantIntroDurationMs - 1).offsetY - sample(assistantIntroDurationMs).offsetY) < 0.0001);
});
