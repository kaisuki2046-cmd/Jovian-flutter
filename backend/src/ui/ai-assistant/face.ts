import { ellipsoid, headSurfaceZ } from './model';
import type { AssistantMaterial, AssistantMesh, Vec3 } from './model';

const eyeMaterial: AssistantMaterial = { color: [0.075, 0.070, 0.082], roughness: 0.48 };
const mouthMaterial: AssistantMaterial = { color: [0.085, 0.075, 0.090], roughness: 0.62 };
const reflection: AssistantMaterial = { color: [1, 0.995, 0.985], roughness: 0.65, emissive: 0.12 };
const eyeRadii: Vec3 = [0.080, 0.088, 0.034];
const pink: AssistantMaterial = { color: [1, 0.49, 0.60], roughness: 0.60, emissive: 0.24 };
const blushPink: AssistantMaterial = { color: [1, 0.56, 0.66], roughness: 0.82, emissive: 0.42 };
const tearBlue: AssistantMaterial = { color: [0.57, 0.84, 0.99], roughness: 0.26, emissive: 0.25 };
const starReflection: AssistantMaterial = { color: [1, 0.91, 0.60], roughness: 0.49, emissive: 0.56 };
const aqua: AssistantMaterial = { color: [0.31, 0.79, 0.99], roughness: 0.30, emissive: 0.42 };
const gold: AssistantMaterial = { color: [1, 0.82, 0.26], roughness: 0.44, emissive: 0.46 };
const coral: AssistantMaterial = { color: [1, 0.37, 0.46], roughness: 0.60, emissive: 0.34 };
type Point = [number, number];
export type AssistantFaceMesh = AssistantMesh & { expressionOnly?: true };

// Wrap the feature around its supporting surface, including its shading normals.
function conform(mesh: AssistantMesh, surface: (x: number, y: number) => number) {
  const step = 0.0004;
  const origin = surface(0, 0);
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i];
    const y = mesh.positions[i + 1];
    mesh.positions[i + 2] += surface(x, y) - origin;
    const slopeX = (surface(x + step, y) - surface(x - step, y)) / (2 * step);
    const slopeY = (surface(x, y + step) - surface(x, y - step)) / (2 * step);
    const nz = mesh.normals[i + 2];
    const nx = mesh.normals[i] - slopeX * nz;
    const ny = mesh.normals[i + 1] - slopeY * nz;
    const length = Math.hypot(nx, ny, nz) || 1;
    mesh.normals[i] = nx / length;
    mesh.normals[i + 1] = ny / length;
    mesh.normals[i + 2] = nz / length;
  }
  return mesh;
}

function outline(sample: (angle: number) => Point) {
  return Array.from({ length: 32 }, (_, index) => sample(index / 32 * Math.PI * 2));
}

function oval(rx: number, ry: number, angle = 0, top = ry) {
  return outline(t => {
    const x = rx * Math.cos(t);
    const y = Math.min(top, ry * Math.sin(t));
    return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
  });
}

function smileBowl(width: number, upper: number, lower: number) {
  return outline(t => {
    const sine = Math.sin(t);
    const cosine = Math.cos(t);
    const x = width * Math.sign(cosine) * Math.abs(cosine) ** 0.78;
    return [x, sine < 0 ? lower * sine : upper * sine ** 0.6];
  });
}

function roundedRay(width: number, height: number, angle: number) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return outline(t => {
    const along = Math.sin(t);
    const x = width * Math.cos(t) * (0.76 + 0.24 * along);
    const y = height * along;
    return [x * cos - y * sin, x * sin + y * cos];
  });
}

function squint(direction: number) {
  return outline(t => {
    const across = Math.cos(t);
    return [0.088 * across, 0.048 * Math.sin(t) + 0.025 * across ** 2 + 0.022 * direction * across];
  });
}

function heart(rx: number, ry: number) {
  return outline(t => {
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [rx * Math.sin(t) ** 3, ry * (y + 2.5) / 14.5];
  });
}

function sparkle(r: number) {
  return outline(t => {
    const radius = r * (0.41 + 0.59 * Math.abs(Math.cos(2 * t)) ** 5);
    return [radius * Math.cos(t), radius * Math.sin(t)];
  });
}

function patch(
  id: string, parent: string, origin: Vec3, contour: Point[], material: AssistantMaterial,
  surface: (x: number, y: number) => number, depth = 0.007,
): AssistantFaceMesh {
  const mesh: AssistantFaceMesh = {
    id, parent, position: origin, material, expressionOnly: true,
    positions: [0, 0, depth], normals: [0, 0, 1], indices: [],
  };
  for (const [x, y] of contour) {
    mesh.positions.push(x, y, 0);
    mesh.normals.push(0.28 * Math.sign(x), 0.28 * Math.sign(y), 1);
  }
  for (let i = 0; i < contour.length; i++) mesh.indices.push(0, i + 1, (i + 1) % contour.length + 1);
  conform(mesh, surface);
  return mesh;
}

function feature(id: string, x: number, y: number, contour: Point[], material: AssistantMaterial, lift = 0.008) {
  const surface = (u: number, v: number) => headSurfaceZ(x + u, y + v);
  return patch(id, 'head', [x, y, surface(0, 0) + lift], contour, material, surface);
}

function cheek(side: 'Left' | 'Right', direction: number) {
  const x = direction * 0.432;
  const y = -0.351;
  const surface = (u: number, v: number) => headSurfaceZ(x + u, y + v);
  // Sample several concentric circles before applying the cheek's curvature.
  // Long fan triangles can sink into the mantle and leave only a thin highlight.
  const contour = oval(0.060, 0.060);
  const mesh: AssistantFaceMesh = {
    id: 'blush' + side, parent: 'head', position: [x, y, surface(0, 0) + 0.013],
    material: blushPink, expressionOnly: true, positions: [0, 0, 0], normals: [0, 0, 1], indices: [],
  };
  const rings = 4;
  for (let ring = 1; ring <= rings; ring++) {
    const start = mesh.positions.length / 3;
    for (const [u, v] of contour) {
      mesh.positions.push(u * ring / rings, v * ring / rings, 0);
      mesh.normals.push(0, 0, 1);
    }
    for (let i = 0; i < contour.length; i++) {
      const a = start + i;
      const b = start + (i + 1) % contour.length;
      if (ring === 1) {
        mesh.indices.push(0, a, b);
      } else {
        const c = a - contour.length;
        const d = b - contour.length;
        mesh.indices.push(c, a, b, c, b, d);
      }
    }
  }
  return conform(mesh, surface);
}

function stroke(
  id: string, x: number, y: number, flow: Point[], radius: number, material: AssistantMaterial,
) {
  const along = flow.map((point, i): Point => {
    const a = flow[Math.max(i - 1, 0)];
    const b = flow[Math.min(i + 1, flow.length - 1)];
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const taper = i === 0 || i === flow.length - 1 ? 0.43 : 1;
    return [-(b[1] - a[1]) * radius * taper / span, (b[0] - a[0]) * radius * taper / span];
  });
  const top = flow.map(([u, v], i): Point => [u + along[i][0], v + along[i][1]]);
  const bottom = flow.map(([u, v], i): Point => [u - along[i][0], v - along[i][1]]).reverse();
  // Triangulate the two edges of the strip. A center fan would fill the concave
  // part of a closed eye or eyebrow.
  const mesh = feature(id, x, y, [...top, ...bottom], material);
  mesh.indices.length = 0;
  for (let i = 0; i < top.length - 1; i++) {
    const a = i + 1;
    const b = top.length * 2 - i;
    mesh.indices.push(a, b, a + 1, b, b - 1, a + 1);
  }
  return mesh;
}

function arc(halfWidth: number, rise: number) {
  return Array.from({ length: 13 }, (_, i): Point => {
    const t = i / 6 - 1;
    return [halfWidth * t, rise * (t * t - 0.4)];
  });
}

function createEye(side: 'Left' | 'Right', includeExpressions: boolean): AssistantFaceMesh[] {
  const direction = side === 'Left' ? -1 : 1;
  const id = `eye${side}`;
  const x = 0.280 * direction;
  const y = -0.245;
  const z = headSurfaceZ(x, y);
  const face = (dx: number, dy: number) => headSurfaceZ(x + dx, y + dy);
  const eye = conform(ellipsoid(id, 'head', [x, y, z + 0.001], eyeRadii, eyeMaterial), face);

  function lensSurface(dx: number, dy: number) {
    const radius = (dx / eyeRadii[0]) ** 2 + (dy / eyeRadii[1]) ** 2;
    return face(dx, dy) - z + eyeRadii[2] * Math.sqrt(Math.max(0, 1 - radius));
  }
  function createReflection(name: string, dx: number, dy: number, radius: number) {
    const center: Vec3 = [dx, dy, lensSurface(dx, dy) + 0.001];
    const dot = ellipsoid(id + name, id, center, [radius, radius, radius * 0.16], reflection);
    return conform(dot, (u, v) => lensSurface(dx + u, dy + v));
  }
  const base = [
    eye,
    createReflection('Glint', -direction * 0.009, 0.034, 0.036),
    createReflection('Spark', direction * 0.010, -0.041, 0.013),
  ];
  if (!includeExpressions) return base;
  return [
    ...base,
    patch(id + 'Heart', id, [0, 0.022, lensSurface(0, 0.022) + 0.005], heart(0.046, 0.035),
      reflection, (u, v) => lensSurface(u, v + 0.022), 0.003),
    patch(id + 'Star', id, [0, 0.022, lensSurface(0, 0.022) + 0.005], sparkle(0.047),
      starReflection, (u, v) => lensSurface(u, v + 0.022), 0.003),
    stroke(id + 'Closed', x, y - 0.012, arc(0.082, 0.034), 0.019, eyeMaterial),
    feature(id + 'Angry', x, y - 0.009, oval(0.069, 0.071, direction * 0.53, 0.018), eyeMaterial),
    feature(id + 'AngryGlint', x - direction * 0.009, y - 0.015, oval(0.021, 0.022), reflection, 0.021),
    feature(id + 'Uneven', x, y, squint(direction), eyeMaterial),
    cheek(side, direction),
    feature('tear' + side, direction * 0.347, -0.342, oval(0.055, 0.039, direction * 0.18), tearBlue, 0.014),
  ];
}

function createMouth(): AssistantMesh {
  const y = -0.296;
  const mesh: AssistantMesh = {
    id: 'mouth', parent: 'head', position: [0, y, headSurfaceZ(0, y) + 0.001],
    positions: [], normals: [], indices: [], material: mouthMaterial,
  };
  const halfSpan = 0.050;
  const radius = 0.015;
  const mouthDepth = 0.012;
  const sides = 12;
  // Parallel rings along the smile, with hemispherical end caps.
  function ring(t: number, cap: number) {
    const x = halfSpan * t;
    const curve = 0.025 * t * t - 0.010;
    const slope = 0.050 * t / halfSpan;
    const tx = 1 / Math.hypot(1, slope);
    const ty = slope * tx;
    const band = Math.cos(cap);
    for (let side = 0; side < sides; side++) {
      const a = 2 * Math.PI * side / sides;
      const along = Math.sin(cap);
      const across = band * Math.cos(a);
      const front = band * Math.sin(a);
      const nx = along * tx - across * ty;
      const ny = along * ty + across * tx;
      mesh.positions.push(x + radius * nx, curve + radius * ny, mouthDepth * front);
      const nz = front * radius / mouthDepth;
      const length = Math.hypot(nx, ny, nz);
      mesh.normals.push(nx / length, ny / length, nz / length);
    }
  }
  const capRings = 4;
  const curveRings = 16;
  for (let i = capRings; i > 0; i--) ring(-1, -Math.PI * i / (2 * capRings));
  for (let i = 0; i <= curveRings; i++) ring(i * 2 / curveRings - 1, 0);
  for (let i = 1; i <= capRings; i++) ring(1, Math.PI * i / (2 * capRings));
  const rings = mesh.positions.length / (3 * sides);
  for (let row = 0; row < rings - 1; row++) {
    for (let side = 0; side < sides; side++) {
      const a = row * sides + side;
      const b = row * sides + (side + 1) % sides;
      mesh.indices.push(a, b, b + sides, a, b + sides, a + sides);
    }
  }
  return conform(mesh, (dx, dy) => headSurfaceZ(dx, y + dy));
}

export function createAssistantFace(includeExpressions = false): AssistantFaceMesh[] {
  const base = [...createEye('Left', includeExpressions), ...createEye('Right', includeExpressions), createMouth()];
  if (!includeExpressions) return base;
  const rays = (prefix: string, material: AssistantMaterial) => [
    feature(prefix + 'Left', 0.26, 0.144, roundedRay(0.029, 0.054, 0.53), material),
    feature(prefix + 'Main', 0.363, 0.168, roundedRay(0.031, 0.079, -0.34), material),
    feature(prefix + 'Right', 0.448, 0.101, roundedRay(0.026, 0.055, -0.92), material),
  ];
  return [
    ...base,
    stroke('winkEye', 0.280, -0.245, [[0.069, -0.049], [0.020, -0.024], [-0.035, 0], [0.020, 0.024], [0.069, 0.049]], 0.018, eyeMaterial),
    feature('laughMouth', 0, -0.307, smileBowl(0.079, 0.029, 0.062), mouthMaterial),
    feature('laughTongue', 0, -0.319, smileBowl(0.057, 0.017, 0.038), pink, 0.021),
    feature('roundMouth', 0, -0.306, oval(0.058, 0.068), mouthMaterial),
    feature('roundTongue', 0, -0.324, oval(0.042, 0.038, 0, 0.032), pink, 0.021),
    stroke('worriedMouth', 0, -0.314, arc(0.046, -0.028), 0.013, mouthMaterial),
    feature('loveHeart', 0.386, 0.139, heart(0.104, 0.093), pink),
    feature('smallHeart', 0.247, 0.019, heart(0.054, 0.049), pink),
    stroke('questionCurve', 0.366, 0.105, [[-0.066, 0.044], [-0.054, 0.080], [-0.027, 0.097], [0.020, 0.097],
      [0.052, 0.075], [0.055, 0.041], [0.040, 0.014], [0.005, -0.015], [-0.006, -0.053]], 0.019, aqua),
    feature('questionDot', 0.36, 0.004, oval(0.025, 0.025), aqua),
    stroke('sleepZTop', 0.391, 0.144, [[-0.06, 0.052], [0.06, 0.052], [-0.055, -0.051], [0.060, -0.051]], 0.020, aqua),
    stroke('sleepZSmall', 0.284, 0.030, [[-0.039, 0.031], [0.039, 0.031], [-0.037, -0.031], [0.039, -0.031]], 0.014, aqua),
    ...rays('attentionGold', gold),
    ...rays('attentionBlue', aqua),
    ...Array.from({ length: 4 }, (_, i) => {
      const t = i * Math.PI / 2 + 0.18;
      const points: Point[] = [[0.026, 0.104], [0.023, 0.054], [0.049, 0.031], [0.103, 0.026]];
      return stroke('angerMark' + i, 0.35, 0.092, points.map(([x, y]) =>
        [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)]), 0.015, coral);
    }),
  ];
}
