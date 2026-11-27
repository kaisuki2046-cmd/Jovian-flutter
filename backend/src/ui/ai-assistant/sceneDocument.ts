import { createAssistantFace } from './face';
import { createAssistantModel, headSurfaceZ } from './model';
import { assistantLegs } from './pose';
import { assistantExpressionLegMotionSource, assistantExpressions, assistantTapExpression } from './expressions';
import { assistantIdleMotionSource, assistantIntroDurationMs } from './idleMotion';
import { assistantIdleExpressionSource } from './idleExpressions';

// Both the browser and the native WebView run this same, self-contained scene.
// Geometry crosses the native bridge once. Later pose changes carry only transforms.
const vertexShader = `
  attribute vec3 position;
  attribute vec3 normal;
  uniform mat4 model;
  uniform vec2 framing;
  uniform float ripple;
  uniform float ripplePhase;
  varying vec3 worldNormal;
  varying vec3 worldPoint;
  void main() {
    // A broad crest and a low shoulder shift gently on the crown. The base stays level.
    float height = clamp((position.y + 0.55) / 1.2, 0.0, 1.0);
    float crown = height * height * (3.0 - 2.0 * height);
    float wave = 6.1 * position.x + ripplePhase;
    float crest = ripple * cos(wave);
    vec3 shape = position + vec3(0.0, crest * crown, 0.0);
    float dx = -6.1 * ripple * sin(wave) * crown;
    float dy = crest * 5.0 * height * (1.0 - height);
    vec3 shapeNormal = vec3((1.0 + dy) * normal.x - dx * normal.y, normal.y, (1.0 + dy) * normal.z);
    vec4 point = model * vec4(shape, 1.0);
    vec3 a = model[0].xyz, b = model[1].xyz, c = model[2].xyz;
    // The cofactor matrix preserves normals under local non-uniform scaling.
    worldNormal = normalize(mat3(cross(b,c), cross(c,a), cross(a,b)) * shapeNormal);
    worldPoint = point.xyz;
    gl_Position = vec4(point.xy * framing, -point.z * 0.2, 1.0);
  }
`;

const fragmentShader = `
  precision mediump float;
  uniform vec3 albedo;
  uniform float roughness;
  uniform float emission;
  uniform float surface;
  uniform float opacity;
  uniform float headset;
  uniform vec3 cups[2];
  uniform vec3 belly;
  uniform vec3 headUp;
  varying vec3 worldNormal;
  varying vec3 worldPoint;
  float softbox(vec3 n, vec2 center, vec2 spread) {
    vec2 d = (n.xy - center) / spread;
    return exp(-dot(d,d)) * smoothstep(.05,.58,n.z);
  }
  float padShadow(vec3 point, vec3 cup) {
    vec3 d = (point - cup) * vec3(1.0,.58,.90);
    return exp(-dot(d,d)*26.0);
  }
  void main() {
    vec3 n = normalize(worldNormal);
    vec3 key = normalize(vec3(-0.35, 0.77, 0.55));
    vec3 halfVector = normalize(key + vec3(0.0, 0.0, 1.0));
    float diffuse = clamp(dot(n, key) * 0.58 + 0.42, 0.0, 1.0);
    float facing = max(n.z, 0.0);
    float grazing = 1.0 - facing;
    float keyHighlight = pow(max(dot(n, halfVector), 0.0), mix(65.0, 8.0, roughness));
    float topPanel = softbox(n, vec2(-.29,.54), vec2(.49,.30));
    float strip = softbox(n, vec2(.67,.11), vec2(.14,.58));
    vec3 fill = mix(vec3(.65,.69,.79), vec3(1.015,1.005,1.025), diffuse);
    vec3 color = albedo * fill;
    float reflection = keyHighlight * .18 + topPanel * .21 + strip * .12;
    if (surface == 1.0 || surface == 2.0) {
      color = mix(color, vec3(1.0,.975,.986), .63 * pow(facing,1.55));
      color = mix(color, vec3(.90,.91,.98), .32 * smoothstep(.22,.95,-n.y));
      // A cool transmission band delineates the jelly against both page themes.
      color = mix(color, vec3(.71,.76,.91), .52 * pow(grazing, 1.4));
      color += vec3(.044,.052,.06) * pow(grazing, 7.0);
      if (surface == 1.0) {
        float contact = max(padShadow(worldPoint,cups[0]),padShadow(worldPoint,cups[1]));
        color *= mix(vec3(1.0),vec3(.77,.80,.88),contact * headset);
        reflection += topPanel * .20;
      } else {
        vec3 d = worldPoint - belly;
        float along = dot(d,headUp);
        float toe = smoothstep(.032,.15,-along);
        float underHead = toe * smoothstep(-.20,.06,along) * exp(-dot(d,d)*3.0);
        color *= mix(vec3(1.0),vec3(.76,.78,.88),underHead);
        reflection += mix(topPanel*.20, strip*.22+topPanel*.30, toe);
      }
    } else if (surface == 3.0) {
      vec3 cup = distance(worldPoint,cups[0]) < distance(worldPoint,cups[1]) ? cups[0] : cups[1];
      float glaze = smoothstep(-.19,.21,dot(worldPoint-cup,headUp));
      color = mix(color * vec3(.89,.91,.98),vec3(.80,.92,1.0), .62 * glaze);
    } else if (surface == 4.0) {
      color = mix(color,vec3(.76,.82,.94), .27 * grazing);
      reflection += .24 * topPanel + .18 * strip;
    }
    // The eye catches are modeled separately and retain the deep black iris.
    reflection *= mix(.16,1.0,smoothstep(.12,.5,max(albedo.r,albedo.b)));
    color = mix(color,vec3(.998,.996,1.0),clamp(reflection,0.0,.76));
    color = mix(color, albedo, clamp(emission, 0.0, 1.0));
    gl_FragColor = vec4(clamp(color, 0.0, 1.0) * opacity, opacity);
  }
`;

// Column-major matrices. A parent is always defined before its children in the rig.
const runtime = `
  const canvas = document.querySelector('canvas');
  const shadow = document.querySelector('.shadow');
  const notify = status => {
    document.body.dataset.ready = String(status === 'ready');
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(status);
    else window.parent.postMessage({assistantScene: status}, '*');
  };
  function multiply(a, b) {
    const result = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 4; i++) result[col*4+row] += a[i*4+row] * b[col*4+i];
      }
    }
    return result;
  }
  function localMatrix(origin, transform) {
    const [x,y,z] = transform.rotation || [0,0,0];
    const [sx,sy,sz] = transform.scale || [1,1,1];
    const move = transform.translation || [0,0,0];
    const cx = Math.cos(x), cy = Math.cos(y), cz = Math.cos(z);
    const ix = Math.sin(x), iy = Math.sin(y), iz = Math.sin(z);
    // XYZ local Euler rotation; scale around this part's joint before translation.
    return [
      cy*cz*sx, cy*iz*sx, -iy*sx, 0,
      (ix*iy*cz-cx*iz)*sy, (ix*iy*iz+cx*cz)*sy, ix*cy*sy, 0,
      (cx*iy*cz+ix*iz)*sz, (cx*iy*iz-ix*cz)*sz, cx*cy*sz, 0,
      origin[0]+move[0], origin[1]+move[1], origin[2]+move[2], 1
    ];
  }
  function projectShadow(widthFactor, offsetX) {
    const pixels = Math.min(canvas.clientWidth,canvas.clientHeight) / 2.22;
    shadow.style.width = (1.1544*pixels*widthFactor)+'px';
    shadow.style.height = (.222*pixels)+'px';
    shadow.style.transform = 'translate(calc(-50% + '+(offsetX*pixels)+'px), calc(-50% + '+(.9102*pixels)+'px))';
  }
  let transforms = {};
  let held = false;
  let holdStart;
  let wantsToListen = false;
  let peekDirection = 0;
  const legs = ${JSON.stringify(assistantLegs)};
  const expressions = ${JSON.stringify(Object.entries(assistantExpressions))};
  ${assistantIdleMotionSource}
  ${assistantIdleExpressionSource}
  ${assistantExpressionLegMotionSource}
  const expressionAt = createAssistantIdleExpressionSampler(expressions);
  const restScale = [1,1,1], collapsed = [.001,.001,.001], zero = [0,0,0];
  const listeningFace = ${JSON.stringify(assistantExpressions.listening)};
  const angryTap = { name: 'angryTap', weight: 1, elapsedMs: 0, target: ${JSON.stringify(assistantTapExpression)} };
  const frightened = { name: 'frightened', weight: 1, elapsedMs: 0, target: {
    eyeLeft: {scale:[1.09,1.30,1], translation:[-.015,.015,.014]},
    eyeRight: {scale:[1.09,1.30,1], translation:[.015,.015,.014]},
    eyeLeftGlint: {scale:[.82,.82,1]},
    eyeRightGlint: {scale:[.82,.82,1]},
    mouth: {scale:collapsed},
    roundMouth: {scale:[.90,1.35,1], translation:[0,-.007,.015]},
    roundTongue: {scale:[.78,1.15,1], translation:[0,-.013,.015]},
    attentionBlueLeft: {scale:restScale},
    attentionBlueMain: {scale:restScale},
    attentionBlueRight: {scale:restScale},
  }};
  let animate = false, playIntro = false, paused = false;
  let motionTime = 0, expressionTime = 0, motionFrameTime;
  let lastTapCount = 0, tapReactionTimer;
  let configured = false;
  let drawFrame = null;
  let frame = 0;
  function redraw() {
    if (!configured || frame || !drawFrame) return;
    frame = requestAnimationFrame(timestamp => {
      frame = 0;
      if (configured && drawFrame) drawFrame(timestamp);
    });
  }
  function clearTapReaction() {
    if (tapReactionTimer === undefined) return;
    clearTimeout(tapReactionTimer);
    tapReactionTimer = undefined;
  }
  window.setAssistantState = state => {
    transforms = state.pose || {};
    const nextAnimate = state.animate === true;
    if (animate !== nextAnimate) {
      motionFrameTime = undefined;
      animate = nextAnimate;
    }
    playIntro = state.playIntro === true;
    paused = state.paused === true;
    const nextHeld = state.held === true;
    if (held !== nextHeld) holdStart = undefined;
    held = nextHeld;
    wantsToListen = state.listening === true;
    peekDirection = state.peekDirection === 1 ? 1 : state.peekDirection === -1 ? -1 : 0;
    const nextTapCount = state.tapCount ?? 0;
    const tapped = configured && nextTapCount > lastTapCount;
    lastTapCount = Math.max(lastTapCount, nextTapCount);
    if (paused || held) {
      motionFrameTime = undefined;
      clearTapReaction();
    } else if (tapped && (!animate || !playIntro || motionTime >= ${assistantIntroDurationMs})) {
      clearTapReaction();
      tapReactionTimer = setTimeout(() => {
        tapReactionTimer = undefined;
        redraw();
      }, 1000);
    }
    configured = true;
    redraw();
  };
  document.addEventListener('visibilitychange', () => {
    motionFrameTime = undefined;
    holdStart = undefined;
    if (!document.hidden) redraw();
  });
  function interpolate(from, to, t) {
    return from.map((v, i) => v + (to[i] - v) * t);
  }
  function jointAt(mesh, target, weight) {
    const base = transforms[mesh.id];
    const defaultScale = mesh.expressionOnly ? collapsed : restScale;
    if (!target || !weight) return base || { scale: defaultScale };
    return {
      translation: interpolate(base?.translation || zero, target.translation || zero, weight),
      rotation: interpolate(base?.rotation || zero, target.rotation || zero, weight),
      scale: interpolate(base?.scale || defaultScale, target.scale || defaultScale, weight),
    };
  }
  window.addEventListener('message', event => {
    if (event.source === window.parent && event.data && event.data.assistantState) {
      window.setAssistantState(event.data.assistantState);
    }
  });
  function initialize() {
    const gl = canvas.getContext('webgl', {alpha:true, premultipliedAlpha:true, antialias:true, depth:true});
    if (!gl) throw new Error('WebGL unavailable');
    function compile(kind, source) {
      const shader = gl.createShader(kind);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    const program = gl.createProgram();
    const vert = compile(gl.VERTEX_SHADER, vertex);
    const frag = compile(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    function buffer(kind, array) {
      const result = gl.createBuffer();
      gl.bindBuffer(kind, result);
      gl.bufferData(kind, array, gl.STATIC_DRAW);
      return result;
    }
    const gpu = meshes.map(mesh => mesh.indices.length ? {
      vertices: buffer(gl.ARRAY_BUFFER, new Float32Array(mesh.positions)),
      normals: buffer(gl.ARRAY_BUFFER, new Float32Array(mesh.normals)),
      triangles: buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices))
    } : null);
    const pos = gl.getAttribLocation(program, 'position');
    const normal = gl.getAttribLocation(program, 'normal');
    const uniform = name => gl.getUniformLocation(program, name);
    const model = uniform('model'), framing = uniform('framing');
    const ripple = uniform('ripple'), ripplePhase = uniform('ripplePhase');
    const albedo = uniform('albedo'), roughness = uniform('roughness');
    const emission = uniform('emission'), surface = uniform('surface');
    const opacity = uniform('opacity'), headset = uniform('headset');
    const leftCup = uniform('cups[0]'), rightCup = uniform('cups[1]');
    const belly = uniform('belly'), headUp = uniform('headUp');
    gl.enableVertexAttribArray(pos);
    gl.enableVertexAttribArray(normal);
    gl.enable(gl.DEPTH_TEST);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0,0,0,0);
    let first = true;
    let lastDraw = -Infinity;
    let visiblePeek = 0;
    drawFrame = timestamp => {
      const running = animate && !paused && !held && !document.hidden;
      const swayingHeld = held && animate && !document.hidden;
      const desiredPeek = held ? 0 : peekDirection;
      const turning = animate && !document.hidden && Math.abs(desiredPeek - visiblePeek) > .002;
      const drawDelta = timestamp - lastDraw;
      if ((running || swayingHeld || turning) && drawDelta < 30) { redraw(); return; }
      lastDraw = timestamp;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const width = Math.round(canvas.clientWidth * dpr), height = Math.round(canvas.clientHeight * dpr);
      if (!width || !height || gl.isContextLost()) return;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0,0,width,height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const span = Math.min(width, height) / 1.11;
      gl.uniform2f(framing, span / width, span / height);
      let elapsed = 0;
      if (running) {
        if (motionFrameTime !== undefined) elapsed = timestamp - motionFrameTime;
        motionTime += elapsed;
        motionFrameTime = timestamp;
      }
      const motion = animate && !held ? sampleAssistantIdleMotion(motionTime, playIntro) : null;
      const listening = wantsToListen && !motion?.intro;
      const reactingToTap = tapReactionTimer !== undefined;
      if (!listening && !reactingToTap && motion) expressionTime += Math.min(elapsed, motion.idleMs);
      const phase = held ? 'held' : listening ? 'listening' : motion ? (motion.intro ? 'intro' : 'idle') : 'still';
      if (document.body.dataset.motionPhase !== phase) document.body.dataset.motionPhase = phase;
      const turnWeight = turning ? 1 - Math.exp(-Math.min(drawDelta, 60) / 78) : 1;
      visiblePeek += (desiredPeek - visiblePeek) * turnWeight;
      const { x: swimX, yaw, roll } = sampleAssistantSwim(motion?.idleMs ?? 0, visiblePeek);
      const rootTransform = localMatrix(zero, {
        translation: [swimX, motion?.offsetY ?? 0, 0],
        rotation: [0,yaw,roll + (motion?.roll ?? 0)],
        scale: motion ? [motion.scaleX, motion.scaleY, motion.scaleZ] : restScale,
      });
      projectShadow(motion?.scaleX ?? 1, swimX);
      const expressionCue = held ? frightened
        : reactingToTap ? angryTap
        : listening ? { name: 'listening', target: listeningFace, weight: 1, elapsedMs: motion?.idleMs ?? 0 }
        : expressionAt(motion && { intro: motion.intro, idleMs: expressionTime });
      const { name, target, weight, elapsedMs } = expressionCue;
      const expression = weight > .75 ? name : 'neutral';
      if (document.body.dataset.expression !== expression) document.body.dataset.expression = expression;
      const heldMs = swayingHeld ? timestamp - (holdStart ??= timestamp) : 0;
      const world = Object.create(null);
      const visible = [];
      for (const mesh of meshes) {
        let transform = jointAt(mesh, target?.[mesh.id], weight);
        if (mesh.surface === 2) {
          if (swayingHeld) {
            transform = applyAssistantExpressionLegMotion(transform, mesh.id, 'held', heldMs, 1);
          } else if (!held && animate && name && weight) {
            transform = applyAssistantExpressionLegMotion(transform, mesh.id, name, elapsedMs, weight);
          }
        }
        // The bridge breaks the crown's silhouette first; the two cushions slide
        // out of the sides a beat later. Their child meshes follow each hinge.
        if (mesh.id === 'headphones' && motion?.intro && motion.bandOpacity < 1) {
          const tucked = 1 - motion.bandOpacity;
          const [x,y,z] = transform.translation || zero;
          const [sx,sy,sz] = transform.scale || restScale;
          transform = {...transform, translation:[x,y-.23*tucked,z], scale:[sx*(1-.12*tucked),sy,sz]};
        } else if (motion?.intro && motion.cupOpacity < 1 && (mesh.id === 'earcupLeft' || mesh.id === 'earcupRight')) {
          const tucked = 1 - motion.cupOpacity;
          const [x,y,z] = transform.translation || zero;
          transform = {...transform, translation:[x-Math.sign(mesh.position[0])*.18*tucked,y,z-.06*tucked]};
        }
        if (mesh.glanceOffsets && motion?.intro) {
          const [x,y,z] = transform.translation || zero;
          const [sx,sy,sz] = transform.scale || restScale;
          const [dx,dz] = mesh.glanceOffsets[motion.glance < 0 ? 0 : 1];
          const distance = Math.abs(motion.glance);
          transform = {...transform, translation:[x+dx*distance,y,z+dz*distance],
            scale:[sx,sy*motion.eyeOpen,sz]};
        }
        if (mesh.surface === 2 && motion?.intro) {
          const [x,y,z] = transform.translation || zero;
          const extension = motion.feetProgress;
          // Unfold below the belly before bringing the rounded tips forward.
          const tuckDepth = (mesh.position[2] + .18) * (1 - extension ** 3);
          transform = {...transform, translation:[x,y+.21*(1-extension),z-tuckDepth]};
        }
        const local = localMatrix(mesh.position, transform);
        world[mesh.id] = multiply(mesh.parent ? world[mesh.parent] : rootTransform, local);
        visible.push(!transform.scale || Math.max(...transform.scale) > .004);
      }
      const head = world.head;
      const l = world.earcupLeft, r = world.earcupRight;
      gl.uniform3f(leftCup, l[12],l[13],l[14]);
      gl.uniform3f(rightCup, r[12],r[13],r[14]);
      gl.uniform3f(belly, head[12]-.65*head[4],head[13]-.65*head[5],head[14]-.65*head[6]);
      const upLength = Math.hypot(head[4], head[5], head[6]) || 1;
      gl.uniform3f(headUp, head[4]/upLength, head[5]/upLength, head[6]/upLength);
      const bandAlpha = motion?.bandOpacity ?? 1;
      const cupAlpha = motion?.cupOpacity ?? 1;
      const faceAlpha = motion?.faceOpacity ?? 1;
      const rippleAmount = motion?.ripple ?? 0;
      gl.uniform1f(headset, cupAlpha);
      gl.uniform1f(ripplePhase, motion?.ripplePhase ?? 0);
      const translucent = [];
      function draw(i, alpha) {
        const mesh = meshes[i];
        const part = gpu[i];
        gl.uniformMatrix4fv(model, false, world[mesh.id]);
        gl.uniform3fv(albedo, mesh.material.color);
        gl.uniform1f(roughness, mesh.material.roughness);
        gl.uniform1f(emission, mesh.material.emissive || 0);
        gl.uniform1f(surface, mesh.surface);
        gl.uniform1f(ripple, mesh.surface === 1 ? rippleAmount : 0);
        gl.uniform1f(opacity, alpha);
        gl.bindBuffer(gl.ARRAY_BUFFER, part.vertices);
        gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, part.normals);
        gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, part.triangles);
        gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
      }
      meshes.forEach((mesh, i) => {
        if (!gpu[i] || !visible[i]) return;
        // The feet slide out from inside the mantle. Keep their exposed surfaces
        // in the opaque depth pass so their backs cannot show through their fronts.
        if (mesh.surface === 2 && motion?.feetProgress === 0) return;
        const alpha = mesh.family === 'face' ? faceAlpha : mesh.family === 'headband' ? bandAlpha
          : mesh.family === 'earcups' ? cupAlpha : 1;
        if (alpha >= .999) draw(i, 1);
        else if (alpha > .005) translucent.push([i, alpha]);
      });
      if (translucent.length) {
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        for (const [i, alpha] of translucent) draw(i, alpha);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
      if (first) { first = false; notify('ready'); }
      if (running || swayingHeld || turning) redraw();
    };
    window.addEventListener('pagehide', event => {
      clearTapReaction();
      if (event.persisted || gl.isContextLost()) return;
      if (frame) cancelAnimationFrame(frame);
      drawFrame = null;
      for (const part of gpu) {
        if (!part) continue;
        gl.deleteBuffer(part.vertices);
        gl.deleteBuffer(part.normals);
        gl.deleteBuffer(part.triangles);
      }
      gl.deleteProgram(program);
    }, {once:true});
    // Request the pose before painting. Default motion flags would show the fully formed character.
    notify('initialized');
    redraw();
  }
  function start() {
    try { initialize(); }
    catch { drawFrame = null; notify('unavailable'); }
  }
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    clearTapReaction();
    configured = false;
    motionFrameTime = undefined;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    drawFrame = null;
    notify('unavailable');
  });
  canvas.addEventListener('webglcontextrestored', start);
  window.addEventListener('resize', redraw);
  if (window.ResizeObserver) new ResizeObserver(redraw).observe(canvas);
  start();
`;

let cachedDocument: string | undefined;

export function assistantSceneDocument() {
  if (cachedDocument) return cachedDocument;
  const face = createAssistantFace(true);
  const faceIds = new Set(face.map(mesh => mesh.id));
  const meshes = [...createAssistantModel(), ...face].map(mesh => {
    let surface = 0;
    if (mesh.id === 'head') surface = 1;
    else if (mesh.id.startsWith('leg')) surface = 2;
    else if (mesh.id.endsWith('Enamel')) surface = 3;
    else if (mesh.id.endsWith('Shell') || mesh.id === 'headband') surface = 4;
    const family = faceIds.has(mesh.id) ? 'face' : surface === 1 || surface === 2 ? 'body'
      : mesh.id.startsWith('headband') ? 'headband' : 'earcups';
    // Moving the eye on the curved cheek also carries its two reflections.
    const [x, y] = mesh.position;
    const glanceOffsets = mesh.id === 'eyeLeft' || mesh.id === 'eyeRight'
      ? [-0.042, 0.042].map(dx => [dx, headSurfaceZ(x + dx, y) - headSurfaceZ(x, y)])
      : undefined;
    return { ...mesh, family, surface, glanceOffsets };
  });
  const data = JSON.stringify(meshes, (_, value) =>
    typeof value === 'number' ? Math.round(value * 10000) / 10000 : value,
  );
  cachedDocument = `<!doctype html><html><head><meta name="color-scheme" content="light dark"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
    <style>*{box-sizing:border-box}:root{color-scheme:light dark}html,body,canvas{margin:0;width:100%;height:100%;display:block;background:transparent;overflow:hidden}
    .shadow{display:none;position:absolute;left:50%;top:50%;background:radial-gradient(ellipse,rgba(68,67,99,.17),transparent 70%)}body[data-ready="true"] .shadow{display:block}canvas{position:relative}</style></head>
    <body><div class="shadow"></div><canvas></canvas><script>
    const meshes=${data}, vertex=${JSON.stringify(vertexShader)}, fragment=${JSON.stringify(fragmentShader)};
    ${runtime}
    </script></body></html>`;
  return cachedDocument;
}
