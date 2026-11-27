import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
import { Script } from 'node:vm';
import { assistantIntroDurationMs } from './idleMotion.ts';

const loader = `export function resolve(id, context, next) {
  const local = /^\\.\\/[a-zA-Z]+$/.test(id) && context.parentURL?.includes('/ai-assistant/');
  return next(local ? id + '.ts' : id, context);
}`;
register('data:text/javascript,' + encodeURIComponent(loader));
const { assistantSceneDocument } = await import('./sceneDocument.ts');
const scene = new Script(assistantSceneDocument().split('<script>')[1].split('</script>')[0]);

function mountScene(native) {
  const statuses = [];
  const drawnSurfaces = [];
  const frames = [];
  const timers = new Map();
  const handlers = {};
  const dataset = {};
  const ignore = () => {};
  let surface;
  let clock = 0;
  let timerId = 0;
  const gl = new Proxy({
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    isContextLost: () => false,
    getUniformLocation: (_, name) => name,
    uniform1f(name, value) { if (name === 'surface') surface = value; },
    drawElements() { drawnSurfaces.push(surface); },
  }, { get: (target, key) => target[key] ?? ignore });
  const canvas = { clientWidth: 200, clientHeight: 200, getContext: () => gl, addEventListener: ignore };
  const shadow = { style: {} };
  const parent = { postMessage: message => statuses.push(message.assistantScene) };
  const window = { parent, addEventListener: (name, callback) => { handlers[name] = callback; } };
  if (native) window.ReactNativeWebView = { postMessage: status => statuses.push(status) };
  scene.runInNewContext({
    window,
    document: { querySelector: query => query === 'canvas' ? canvas : shadow,
      body: { dataset }, addEventListener: ignore },
    requestAnimationFrame: callback => frames.push(callback),
    setTimeout(callback, delay) {
      const id = ++timerId;
      timers.set(id, { callback, due: clock + delay });
      return id;
    },
    clearTimeout: id => timers.delete(id),
  });
  function configure(state) {
    if (native) window.setAssistantState(state);
    else handlers.message({ source: parent, data: { assistantState: state } });
  }
  function drawAt(timestamp) {
    clock = timestamp;
    for (const [id, { callback, due }] of timers) {
      if (due > clock) continue;
      timers.delete(id);
      callback();
    }
    frames.shift()?.(timestamp);
  }
  return { statuses, dataset, drawnSurfaces, frames, configure, drawAt };
}

for (const native of [false, true]) {
  test(`the ${native ? 'native WebView' : 'browser iframe'} draws only the jelly on its first configured intro frame`, () => {
    const { statuses, dataset, drawnSurfaces, frames, configure } = mountScene(native);
    assert.deepEqual(statuses, ['initialized']);
    assert.equal(dataset.ready, 'false');
    assert.equal(frames.length, 0);
    assert.deepEqual(drawnSurfaces, []);

    configure({ playIntro: true, animate: true, paused: true });
    assert.equal(dataset.ready, 'false');
    frames.shift()(2500);
    assert.equal(dataset.motionPhase, 'intro');
    assert.deepEqual(drawnSurfaces, [1]);
    assert.deepEqual(statuses, ['initialized', 'ready']);
    assert.equal(dataset.ready, 'true');
  });
}

test('a scene with reduced motion renders the finished character after configuration', () => {
  const { dataset, drawnSurfaces, frames, configure } = mountScene(true);
  configure({ playIntro: true, animate: false });
  frames.shift()(2500);
  assert.equal(dataset.motionPhase, 'still');
  assert.ok(drawnSurfaces.includes(2));
  assert.ok(drawnSurfaces.includes(4));
  assert.equal(dataset.ready, 'true');
});

test('typing during the entrance switches to listening only when the animation finishes', () => {
  const { dataset, drawnSurfaces, frames, configure } = mountScene(false);
  const intro = { playIntro: true, animate: true };
  const start = 1000;
  configure(intro);
  frames.shift()(start);
  assert.deepEqual(drawnSurfaces, [1]);

  configure({ ...intro, listening: true });
  frames.shift()(start + 600);
  assert.equal(dataset.motionPhase, 'intro');
  assert.equal(dataset.expression, 'neutral');
  frames.shift()(start + assistantIntroDurationMs - 40);
  assert.equal(dataset.motionPhase, 'intro');
  assert.ok(drawnSurfaces.includes(2));

  frames.shift()(start + assistantIntroDurationMs);
  assert.equal(dataset.motionPhase, 'listening');
  assert.equal(dataset.expression, 'listening');
});

test('clearing the draft during the entrance ends its listening request', () => {
  const { dataset, drawnSurfaces, frames, configure } = mountScene(true);
  const intro = { playIntro: true, animate: true };
  const start = 1000;
  configure({ ...intro, listening: true });
  frames.shift()(start);
  assert.equal(dataset.motionPhase, 'intro');
  assert.deepEqual(drawnSurfaces, [1]);

  configure(intro);
  frames.shift()(start + assistantIntroDurationMs);
  assert.equal(dataset.motionPhase, 'idle');
  assert.equal(dataset.expression, 'neutral');
});

test('taps during the entrance expire, and post-entrance taps restore the listening face after one second', () => {
  const { dataset, configure, drawAt } = mountScene(false);
  const intro = { playIntro: true, animate: true };
  configure(intro);
  drawAt(0);
  drawAt(600);
  configure({ ...intro, listening: true, tapCount: 1 });
  drawAt(700);
  assert.equal(dataset.motionPhase, 'intro');
  assert.equal(dataset.expression, 'neutral');

  drawAt(assistantIntroDurationMs);
  assert.equal(dataset.expression, 'listening');
  configure({ ...intro, listening: true, tapCount: 2 });
  drawAt(assistantIntroDurationMs + 100);
  assert.equal(dataset.expression, 'angryTap');
  drawAt(assistantIntroDurationMs + 900);
  assert.equal(dataset.expression, 'angryTap');
  drawAt(assistantIntroDurationMs + 1000);
  assert.equal(dataset.expression, 'listening');
});

test('another tap restarts the reaction timer and a drag takes priority', () => {
  const { dataset, configure, drawAt } = mountScene(true);
  configure({ tapCount: 2 });
  drawAt(0);
  assert.equal(dataset.expression, 'neutral');
  configure({ tapCount: 3 });
  drawAt(500);
  assert.equal(dataset.expression, 'angryTap');
  configure({ tapCount: 4 });
  drawAt(1100);
  assert.equal(dataset.expression, 'angryTap');

  configure({ held: true, tapCount: 4 });
  drawAt(1200);
  assert.equal(dataset.expression, 'frightened');
  configure({ held: false, tapCount: 4 });
  drawAt(1250);
  assert.equal(dataset.expression, 'neutral');
});
