export type Vec3 = [number, number, number];

export type AssistantMaterial = {
  color: Vec3;
  roughness: number;
  emissive?: number;
};

/** The origin of each mesh is its pivot in its parent's coordinate system. */
export type AssistantMesh = {
  id: string;
  parent: string | null;
  position: Vec3;
  positions: number[];
  normals: number[];
  indices: number[];
  material: AssistantMaterial;
};

type PointOnSurface = (angle: number, fraction: number) => Vec3;
type ProfilePoint = [number, number];

const jelly: AssistantMaterial = { color: [0.947, 0.937, 0.986], roughness: 0.36 };
const pearl: AssistantMaterial = { color: [0.838, 0.87, 0.971], roughness: 0.31 };
const earShell: AssistantMaterial = { color: [0.932, 0.943, 0.994], roughness: 0.31 };
const cushion: AssistantMaterial = { color: [0.49, 0.555, 0.683], roughness: 0.57 };
const silver: AssistantMaterial = { color: [0.723, 0.763, 0.865], roughness: 0.24 };
const blue: AssistantMaterial = { color: [0.48, 0.745, 0.994], roughness: 0.28, emissive: 0.12 };
const cyan: AssistantMaterial = { color: [0.245, 0.922, 1], roughness: 0.3, emissive: 0.65 };
const starlight: AssistantMaterial = { color: [0.88, 1, 1], roughness: 0.3, emissive: 0.85 };
const fullTurn = 2 * Math.PI;

function unit([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function difference(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function node(id: string, parent: string | null, position: Vec3, material: AssistantMaterial): AssistantMesh {
  return { id, parent, position, material, positions: [], normals: [], indices: [] };
}

// A periodic surface with one vertex at each pole. Evaluating the tangents before
// quantization gives a smooth seam even on the small earpad details.
function surface(mesh: AssistantMesh, slices: number, rows: number, sample: PointOnSurface): AssistantMesh {
  function vertex(angle: number, fraction: number) {
    const point = sample(angle, fraction);
    const v = Math.max(0.0001, Math.min(0.9999, fraction));
    const step = 0.00001;
    const tangent = difference(sample(angle + step, v), sample(angle - step, v));
    const along = difference(sample(angle, v + step), sample(angle, v - step));
    const normal = unit(cross(tangent, along));
    for (let axis = 0; axis < 3; axis++) {
      mesh.positions.push(Math.round(point[axis] * 100000) / 100000);
      mesh.normals.push(Math.round(normal[axis] * 10000) / 10000);
    }
  }
  vertex(0, 0);
  for (let row = 1; row < rows; row++) {
    for (let slice = 0; slice < slices; slice++) vertex(slice * fullTurn / slices, row / rows);
  }
  const last = mesh.positions.length / 3;
  vertex(0, 1);
  for (let slice = 0; slice < slices; slice++) {
    const next = (slice + 1) % slices;
    mesh.indices.push(0, 1 + next, 1 + slice);
    for (let row = 0; row < rows - 2; row++) {
      const a = 1 + row * slices + slice;
      const b = 1 + row * slices + next;
      mesh.indices.push(a, b, a + slices, b, b + slices, a + slices);
    }
    mesh.indices.push(last - slices + slice, last - slices + next, last);
  }
  return mesh;
}

export function ellipsoid(
  id: string, parent: string | null, position: Vec3, radii: Vec3, material: AssistantMaterial,
): AssistantMesh {
  return surface(node(id, parent, position, material), 28, 16, (angle, fraction) => {
    const latitude = fraction * Math.PI;
    return [
      radii[0] * Math.sin(latitude) * Math.cos(angle),
      radii[1] * Math.cos(latitude),
      radii[2] * Math.sin(latitude) * Math.sin(angle),
    ];
  });
}

// Meridian traced from the crown, over the low, full cheeks, and back to the
// underside. The front and back share this profile, as in the turnaround.
const bellProfile: ProfilePoint[] = [
  [0, 0.665], [0.422, 0.665], [0.72, 0.43], [0.811, 0.12],
  [0.839, 0.025], [0.885, -0.14], [0.887, -0.274],
  [0.891, -0.475], [0.735, -0.626], [0.545, -0.66],
  [0.437, -0.679], [0.401, -0.755], [0.258, -0.776],
  [0.160, -0.794], [0.065, -0.795], [0, -0.795],
];
const depthRatio = 0.855;

function bellSection(fraction: number): ProfilePoint {
  const count = (bellProfile.length - 1) / 3;
  const segment = Math.min(count - 1, Math.floor(fraction * count));
  const t = fraction * count - segment;
  const s = 1 - t;
  const [a, b, c, d] = bellProfile.slice(3 * segment, 3 * segment + 4);
  return [
    s ** 3 * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t ** 3 * d[0],
    s ** 3 * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t ** 3 * d[1],
  ];
}

/** Mantle surface facing the camera, used to attach animated eyes and mouth. */
export function headSurfaceZ(x: number, y: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (bellSection(mid)[1] > y) lo = mid;
    else hi = mid;
  }
  const [r] = bellSection((lo + hi) / 2);
  return Math.sqrt(Math.max(0, r * r - x * x)) * depthRatio;
}

function head(): AssistantMesh {
  return surface(node('head', null, [0, 0, 0], jelly), 56, 36, (angle, fraction) => {
    const [r, y] = bellSection(fraction);
    return [r * Math.cos(angle), y, depthRatio * r * Math.sin(angle)];
  });
}

function leg(id: string, side: number, outer: boolean): AssistantMesh {
  const pivot: Vec3 = [side * (outer ? 0.235 : 0.105), -0.585, outer ? -0.012 : 0.23];
  const tilt = outer ? 0.82 : 0.31;
  const tiltX = side * Math.sin(tilt);
  const tiltY = Math.cos(tilt);
  const mesh = surface(node(id, null, pivot, jelly), 32, 22, (angle, fraction) => {
    const latitude = Math.PI * fraction;
    const toe = (1 - Math.cos(latitude)) / 2;
    const radius = Math.max(0, Math.sin(latitude)) ** 0.85;
    const along = (outer ? 0.323 : 0.312) * toe - 0.022;
    const across = (outer ? 0.119 : 0.143) * radius * Math.cos(angle);
    return [
      tiltX * along + tiltY * across,
      -tiltY * along + tiltX * across,
      (outer ? 0.235 : 0.218) * toe + (outer ? 0.17 : 0.165) * radius * Math.sin(angle),
    ];
  });
  // The soft roots nest inside the lower mantle. Continue its shading across
  // the joint, then release to the rounded toe normal over its exposed length.
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = pivot[0] + mesh.positions[i];
    const y = pivot[1] + mesh.positions[i + 1];
    const z = pivot[2] + mesh.positions[i + 2];
    const r = Math.hypot(x, z / depthRatio);
    let lo = 0.45;
    let hi = 1;
    for (let j = 0; j < 16; j++) {
      const t = (lo + hi) / 2;
      if (bellSection(t)[0] > r) lo = t;
      else hi = t;
    }
    const t = (lo + hi) / 2;
    const [ra, ya] = bellSection(Math.max(0, t - 0.0005));
    const [rb, yb] = bellSection(Math.min(1, t + 0.0005));
    const slope = (yb - ya) / (rb - ra);
    const mantleNormal = unit([slope * x / r, -1, slope * z / (r * depthRatio ** 2)]);
    const gap = ((ya + yb) / 2 - y) / Math.hypot(1, slope);
    const alignment = mantleNormal[0] * mesh.normals[i] +
      mantleNormal[1] * mesh.normals[i + 1] + mantleNormal[2] * mesh.normals[i + 2];
    if (alignment <= 0.32 || Math.abs(gap) >= 0.088) continue;
    const fraction = Math.abs(gap) / 0.088;
    const toeWeight = fraction ** 2 * (3 - 2 * fraction);
    const compatible = Math.min(1, (alignment - 0.32) / 0.44);
    const weight = 1 - (1 - toeWeight) * compatible;
    const normal = unit([
      weight * mesh.normals[i] + (1 - weight) * mantleNormal[0],
      weight * mesh.normals[i + 1] + (1 - weight) * mantleNormal[1],
      weight * mesh.normals[i + 2] + (1 - weight) * mantleNormal[2],
    ]);
    for (let axis = 0; axis < 3; axis++) mesh.normals[i + axis] = Math.round(normal[axis] * 10000) / 10000;
  }
  return mesh;
}

// All three cyan inlays follow the curvature of the bridge, including the
// rounded ends. Offsetting them toward +Z keeps them flush on its front.
function bridge(
  id: string, start: number, end: number, thickness: number, depth: number,
  front: number, material: AssistantMaterial, subdivisions: number,
): AssistantMesh {
  return surface(node(id, 'headphones', [0, 0, -0.015], material), 12, subdivisions, (angle, fraction) => {
    const t = start + (end - start) * fraction;
    const cap = Math.min(1, (t - start) / thickness, (end - t) / thickness);
    const radius = Math.sqrt(Math.max(0, 1 - (1 - cap) ** 2));
    const offset = radius * Math.cos(angle) * thickness;
    return [
      (0.84 + offset) * Math.sin(t),
      0.012 + (0.803 + offset) * Math.cos(t),
      front + 0.32 * (1 - Math.cos(t)) + radius * Math.sin(angle) * depth,
    ];
  });
}

// Oriented earcups sit slightly oblique to the face. The glowing disc is
// visible head-on, and the full-size star is revealed in a side view.
function earcup(side: number, name: string): AssistantMesh[] {
  const pivot: Vec3 = [side * 0.788, 0.125, 0.245];
  const outward = unit([side * 0.884, 0.232, 0.407]);
  const across = unit(cross([0, 1, 0], outward));
  const up = unit(cross(outward, across));
  const cupId = 'earcup' + name;
  function earPoint(vertical: number, tangent: number, axial: number): Vec3 {
    return [
      vertical * up[0] + tangent * across[0] + axial * outward[0],
      vertical * up[1] + tangent * across[1] + axial * outward[1],
      vertical * up[2] + tangent * across[2] + axial * outward[2],
    ];
  }
  function pad(id: string, axial: number, width: number, height: number, depth: number, material: AssistantMaterial) {
    return surface(node(cupId + id, cupId, [0, 0, 0], material), 32, 18, (angle, fraction) => {
      const t = fraction * Math.PI;
      return earPoint(Math.sin(t) * height * Math.cos(angle), Math.sin(t) * width * Math.sin(angle), axial + depth * Math.cos(t));
    });
  }
  const layers = [
    node(cupId, 'headphones', pivot, pearl),
    pad('Cushion', -0.022, 0.249, 0.307, 0.066, cushion),
    pad('Shell', 0.060, 0.246, 0.313, 0.106, earShell),
  ];
  // These patches conform to the same convex shell. Their backs are buried
  // beneath the housing; narrow open rings cannot split away when animated.
  function badge(id: string, height: number, width: number, lift: number, material: AssistantMaterial, star = false) {
    const mesh = surface(node(cupId + id, cupId, [0, 0, 0], material), 40, 12, (angle, fraction) => {
      const t = fraction * Math.PI;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const v = height * Math.sin(t) * (star ? cos ** 3 : cos);
      const h = width * Math.sin(t) * (star ? sin ** 3 : sin);
      const shellDepth = 0.060 + 0.106 * Math.sqrt(Math.max(0, 1 - (v / 0.313) ** 2 - (h / 0.246) ** 2));
      return earPoint(v, h, shellDepth + lift * Math.cos(t) + lift / 2);
    });
    // At either pole the badge has an exact axial normal. The cusped star's
    // azimuth derivative vanishes there, so a numerical tangent is unreliable.
    mesh.normals.splice(0, 3, ...outward);
    mesh.normals.splice(-3, 3, -outward[0], -outward[1], -outward[2]);
    return mesh;
  }
  layers.push(
    badge('LightRim', 0.204, 0.181, 0.005, cyan),
    badge('Enamel', 0.190, 0.167, 0.014, blue),
    badge('Star', 0.103, 0.085, 0.023, starlight, true),
  );
  return layers;
}

export function createAssistantModel(): AssistantMesh[] {
  const meshes = [
    head(),
    leg('legOuterLeft', -1, true),
    leg('legInnerLeft', -1, false),
    leg('legInnerRight', 1, false),
    leg('legOuterRight', 1, true),
    node('headphones', 'head', [0, 0, 0], pearl),
    bridge('headband', -1.092, 1.092, 0.083, 0.103, 0, pearl, 54),
  ];
  const inlays = [
    { name: 'Center', start: -0.411, end: 0.411, slices: 42 },
    { name: 'Left', start: -1.006, end: -0.729, slices: 20 },
    { name: 'Right', start: 0.729, end: 1.006, slices: 20 },
  ];
  for (const { name, start, end, slices } of inlays) {
    meshes.push(bridge('headbandGlow' + name, start, end, 0.020, 0.009, 0.102, cyan, slices));
    meshes.push(bridge('headbandLight' + name, start + 0.003, end - 0.003, 0.013, 0.006, 0.108, starlight, slices));
  }
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'Left' : 'Right';
    meshes.push(ellipsoid('hinge' + name, 'headphones', [side * 0.745, 0.389, 0.173], [0.075, 0.078, 0.082], silver));
    meshes.push(...earcup(side, name));
  }
  return meshes;
}
