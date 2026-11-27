import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire, registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { legacyRoot } from './legacy_compute/paths.mjs';
const sceneRoot = pathToFileURL(resolve(legacyRoot, 'src/ui/ai-assistant')).href + '/';
const browserRoot = resolve(process.env.JOVIAN_BROWSER_TEST_ROOT ?? legacyRoot);
const require = createRequire(resolve(browserRoot, 'package.json'));
const { chromium } = require('playwright-core');
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(sceneRoot) && specifier.startsWith('./') && !specifier.endsWith('.ts')) {
      return next(specifier + '.ts', context);
    }
    return next(specifier, context);
  },
});
const { assistantSceneDocument } = await import(sceneRoot + 'sceneDocument.ts');
const { assistantExpressions } = await import(sceneRoot + 'expressions.ts');
const source = assistantSceneDocument();
assert.ok(source.includes('antialias:true, depth:true'));
const scene = source.replace('antialias:true, depth:true', 'antialias:true, depth:true, preserveDrawingBuffer:true');
const output = resolve('src/features/divination/assets/assistant/motion');
await mkdir(output, { recursive: true });
const size = 160;
const columns = 12;
const notes = [
  {name:'intro', frames:100, interval:40, intro:true},
  {name:'idle', frames:188, interval:50},
  {name:'listening', frames:46, interval:50, listening:true},
  {name:'tap', frames:1, interval:50, tapped:true},
];
const expressions = Object.keys(assistantExpressions);
for (const [choice, name] of expressions.entries()) {
  notes.push({name:'expression-' + name, frames:88, interval:62.5, choice:(choice + 0.5) / expressions.length});
}
const browser = await chromium.launch({
  executablePath:process.env.CHROME_EXECUTABLE ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args:['--disable-background-networking','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
try {
  for (const clip of notes) {
    const page = await browser.newPage({ viewport:{width:size,height:size}, deviceScaleFactor:1 });
    const clock = '<script>(' + (() => {
      let scheduled = [];
      let id = 0;
      window.requestAnimationFrame = next => {
        scheduled.push([++id,next]);
        return id;
      };
      window.cancelAnimationFrame = id => {
        scheduled = scheduled.filter(item => item[0] !== id);
      };
      window.sample = timestamp => {
        const pending = scheduled;
        scheduled = [];
        for (const [,callback] of pending) callback(timestamp);
      };
    }).toString() + ')();</script>';
    const seed = clip.choice === undefined ? '' : '<script>Math.random = () => ' + clip.choice + ';</script>';
    const capture = scene.replace('</head>',seed + clock + '</head>');
    await page.setContent(capture);
    const image = await page.evaluate(({clip, size, columns}) => {
      const state = {animate:true, playIntro:clip.intro === true, listening:clip.listening === true, tapCount:0};
      window.setAssistantState(state);
      window.sample(0);
      if (document.body.dataset.ready !== 'true') throw Error('Original RN WebGL scene failed to initialize');
      if (clip.tapped) window.setAssistantState({...state,tapCount:1});
      const canvas = document.querySelector('canvas');
      const shadow = document.querySelector('.shadow');
      const atlas = document.createElement('canvas');
      const across = Math.min(columns, clip.frames);
      atlas.width = across * size;
      atlas.height = Math.ceil(clip.frames / across) * size;
      const ctx = atlas.getContext('2d');
      for (let frame=0; frame<clip.frames; frame++) {
        const start = clip.choice === undefined ? (clip.tapped ? 40 : 0) : 15000;
        if (start || frame) window.sample(start + frame * clip.interval);
        if (clip.choice !== undefined && frame === 24 && document.body.dataset.expression !== clip.name.slice(11)) {
          throw Error('Captured the wrong expression: ' + document.body.dataset.expression);
        }
        const x = frame % across * size;
        const y = Math.floor(frame / across) * size;
        const box = shadow.getBoundingClientRect();
        ctx.save();
        ctx.translate(x + box.x + box.width/2, y + box.y + box.height/2);
        ctx.scale(box.width/2,box.height/2);
        const fade = ctx.createRadialGradient(0,0,0,0,0,0.7);
        fade.addColorStop(0, 'rgba(68,67,99,.17)');
        fade.addColorStop(1, 'rgba(68,67,99,0)');
        ctx.fillStyle = fade;
        ctx.fillRect(-1,-1,2,2);
        ctx.restore();
        ctx.drawImage(canvas,x,y,size,size);
      }
      const first = document.createElement('canvas');
      first.width = first.height = size;
      first.getContext('2d').drawImage(atlas,0,0,size,size,0,0,size,size);
      return {atlas:atlas.toDataURL('image/webp',.83), first:first.toDataURL('image/webp',.83)};
    },{clip,size,columns});
    const bytes = value=>Buffer.from(value.slice(value.indexOf(',')+1),'base64');
    await writeFile(resolve(output,clip.name+'.webp'),bytes(image.atlas));
    if (clip.name === 'intro') await writeFile(resolve(output,'intro-first.webp'),bytes(image.first));
    console.log(clip.name, clip.frames, bytes(image.atlas).length);
    await page.close();
  }
} finally { await browser.close(); }
