import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
import { createAssistantModel, headSurfaceZ } from './model.ts';

// Metro resolves extensionless imports; this file also exercises the rig in Node.
const loader = `export function resolve(id, context, next) {
  const needsExtension = ['./model','./expressions'].includes(id) && context.parentURL?.includes('/ai-assistant/');
  return next(needsExtension ? id + '.ts' : id, context);
}`;
register('data:text/javascript,' + encodeURIComponent(loader));
const { createAssistantFace } = await import('./face.ts');
const { assistantLegs, resolveAssistantPose } = await import('./pose.ts');
const { assistantExpressions, assistantExpressionLegMotionSource } = await import('./expressions.ts');
const meshes = [...createAssistantModel(), ...createAssistantFace(true)];
const byId = new Map(meshes.map(mesh => [mesh.id, mesh]));
const legs = ['legOuterLeft', 'legInnerLeft', 'legInnerRight', 'legOuterRight'];

test('each blush is a round disc that sits above the curved cheek across its entire surface', () => {
  for (const id of ['blushLeft', 'blushRight']) {
    const { indices, positions, position } = byId.get(id);
    const x = positions.filter((_, i) => i % 3 === 0);
    const y = positions.filter((_, i) => i % 3 === 1);
    const span = values => Math.max(...values) - Math.min(...values);
    assert.ok(span(x) > 0.10);
    assert.ok(Math.abs(span(x) - span(y)) < 0.001);
    for (let i = 0; i < indices.length; i += 3) {
      const vertices = indices.slice(i, i + 3);
      const [cx, cy, cz] = position.map((offset, axis) => offset
        + vertices.reduce((sum, j) => sum + positions[j * 3 + axis], 0) / 3);
      assert.ok(cz - headSurfaceZ(cx, cy) > 0.008, id + ' must stay clear of the head');
    }
  }
});

test('each exposed leg keeps outward shading as it swings away from the mantle', () => {
  for (const id of legs) {
    const { indices, positions, normals } = byId.get(id);
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = indices.slice(i, i + 3).map(index => index * 3);
      const edge = (end, axis) => positions[end + axis] - positions[a + axis];
      const agreement = [0, 1, 2].reduce((sum, axis) => {
        const j = (axis + 1) % 3, k = (axis + 2) % 3;
        const faceNormal = edge(b, j) * edge(c, k) - edge(b, k) * edge(c, j);
        return sum + faceNormal * (normals[a + axis] + normals[b + axis] + normals[c + axis]);
      }, 0);
      assert.ok(agreement >= -1e-7, `${id}, triangle ${i / 3}`);
    }
  }
});

test('head, headset and all four legs retain their independent joints', () => {
  const seen = new Set();
  for (const mesh of meshes) {
    assert.ok(!seen.has(mesh.id), mesh.id);
    assert.ok(mesh.parent === null || seen.has(mesh.parent), mesh.id);
    seen.add(mesh.id);
  }
  for (const id of ['head', ...legs]) {
    assert.equal(byId.get(id).parent, null);
    assert.ok(byId.get(id).indices.length > 0);
  }
  const pivots = legs.map(id => byId.get(id).position[0]);
  assert.deepEqual(pivots, [...new Set(pivots)].sort((a, b) => a - b));
  assert.equal(byId.get('headphones').parent, 'head');
  assert.equal(byId.get('headband').parent, 'headphones');
  for (const side of ['Left', 'Right']) {
    assert.equal(byId.get('earcup' + side).parent, 'headphones');
    assert.equal(byId.get('eye' + side).parent, 'head');
    for (const mark of ['Glint', 'Spark']) {
      assert.equal(byId.get('eye' + side + mark).parent, 'eye' + side);
    }
  }
  assert.equal(byId.get('mouth').parent, 'head');
});

test('changing one leg, the headphones or the head changes only that joint locally', () => {
  const tilt = { rotation: [0, 0, 0.16] };
  assert.deepEqual(resolveAssistantPose(), {});
  for (const id of legs) {
    assert.deepEqual(resolveAssistantPose({ legs: { [id]: tilt } }), { [id]: tilt });
  }
  assert.deepEqual(resolveAssistantPose({ head: tilt }), { head: tilt });
  assert.deepEqual(resolveAssistantPose({ headphones: tilt }), { headphones: tilt });
});

test('winking and relaxing the smile can be combined without deforming the other eye', () => {
  for (const side of ['Left', 'Right']) {
    const eye = 'eye' + side;
    const blink = 'blink' + side;
    const wink = resolveAssistantPose({ expression: { [blink]: 1, smile: 0 } });
    assert.deepEqual(Object.keys(wink).sort(), [eye, eye + 'Glint', eye + 'Spark', 'mouth'].sort());
    assert.ok(wink[eye].scale[1] > 0 && wink[eye].scale[1] < 0.2);
    assert.ok(wink[eye + 'Glint'].translation[2] < 0);
    const halfBlink = resolveAssistantPose({ expression: { [blink]: 0.5 } });
    assert.ok(halfBlink[eye].scale[1] > wink[eye].scale[1] && halfBlink[eye].scale[1] < 1);
    assert.ok(wink.mouth.scale[1] > 0 && wink.mouth.scale[1] < 1);
  }
  assert.deepEqual(resolveAssistantPose({ expression: { blinkLeft: 0, blinkRight: 0, smile: 1 } }), {});
});

test('all eleven expression presets drive registered facial joints and cover every optional feature', () => {
  assert.deepEqual(createAssistantFace().map(({ id }) => id),
    meshes.filter(({ id, expressionOnly }) => !expressionOnly && /^(eye|mouth)/.test(id)).map(({ id }) => id));
  const presets = Object.entries(assistantExpressions);
  assert.equal(presets.length, 11);
  const covered = new Set();
  for (const [preset, transforms] of presets) {
    assert.deepEqual(resolveAssistantPose({ expression: { preset } }), transforms);
    for (const [id, transform] of Object.entries(transforms)) {
      assert.ok(byId.get(id)?.indices.length > 0, preset + ' points to a facial mesh called ' + id);
      for (const vector of Object.values(transform)) assert.ok(vector.length === 3 && vector.every(Number.isFinite));
      if (transform.scale?.[0] > 0.01) covered.add(id);
    }
  }
  for (const { id, expressionOnly } of meshes) if (expressionOnly) assert.ok(covered.has(id), id);
  assert.equal(new Set(presets.map(([, transforms]) => JSON.stringify(transforms))).size, presets.length);
});

test('a blink composes with a preset without reviving its hidden eyes or reflections', () => {
  const wink = resolveAssistantPose({ expression: { preset: 'wink', blinkRight: 1 } });
  assert.ok(wink.eyeRight.scale.every(value => value < 0.01));
  const love = resolveAssistantPose({ expression: { preset: 'love', blinkLeft: 0.7 } });
  assert.ok(love.eyeLeftGlint.scale.every(value => value < 0.01));
  assert.equal(love.eyeLeftHeart.scale[0], 1);
});

test('expression movement sways the legs sideways while preserving the rest of the pose', () => {
  const move = new Function('legs', assistantExpressionLegMotionSource +
    '\nreturn applyAssistantExpressionLegMotion;')(assistantLegs);
  const base = { rotation: [0.1, 0.2, 0.03], translation: [0.01, 0.04, 0.06], scale: [1, 0.99, 1] };
  const motions = [...Object.keys(assistantExpressions), 'held'].map(name =>
    [350, 720, 1420].flatMap(time => assistantLegs.map(leg => {
      const sample = move(base, leg, name, time, 1);
      assert.equal(sample.translation, base.translation);
      assert.equal(sample.scale, base.scale);
      assert.deepEqual(sample.rotation.slice(0, 2), base.rotation.slice(0, 2));
      const maxAngle = name === 'held' ? 0.18 : 0.16;
      assert.ok(Math.abs(sample.rotation[2] - base.rotation[2]) <= maxAngle);
      return sample.rotation[2];
    })));
  assert.equal(new Set(motions.map(motion => JSON.stringify(motion))).size, motions.length);
  assert.equal(move(base, 'legOuterRight', 'wink', 600, 0), base);
  assert.deepEqual(move(base, 'legOuterLeft', 'wink', 0, 1), base);

  const right = move(base, 'legOuterRight', 'wink', 600, 1);
  const left = move(base, 'legOuterRight', 'wink', 1400, 1);
  const easingIn = move(base, 'legOuterRight', 'wink', 600, 0.2);
  assert.ok(left.rotation[2] < base.rotation[2] && base.rotation[2] < easingIn.rotation[2]);
  assert.ok(easingIn.rotation[2] < right.rotation[2]);
  for (const [name, period] of [['held', 1500], ['listening', 2300]]) {
    const first = move(base, 'legOuterLeft', name, 620, 1);
    const later = move(base, 'legOuterLeft', name, 620 + 7 * period, 1);
    assert.ok(Math.abs(first.rotation[2] - later.rotation[2]) < 1e-12);
    assert.notEqual(first.rotation[2], base.rotation[2]);
  }
});
