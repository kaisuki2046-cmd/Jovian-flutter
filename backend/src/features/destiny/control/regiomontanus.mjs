const turn = Math.PI * 2;
const degrees = 180 / Math.PI;
const normalize = angle => (angle % 360 + 360) % 360;
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x,
});

// Project a physical body through the local north/south axis onto the equator.
// This includes its celestial latitude; it is different from longitudeHouse.
export function regiomontanusHouse(bodyEquatorial, theta, latitude) {
  if (![theta, latitude, bodyEquatorial.x, bodyEquatorial.y, bodyEquatorial.z].every(Number.isFinite)
    || Math.abs(latitude) >= Math.PI / 2) return null;
  const north = { x: -Math.sin(latitude) * Math.cos(theta), y: -Math.sin(latitude) * Math.sin(theta), z: Math.cos(latitude) };
  const normal = cross(north, bodyEquatorial);
  const x = normal.y, y = -normal.x;
  if (Math.hypot(x, y) < 1e-12) return null;
  // north.z is positive away from geographical poles, fixing the orientation.
  // Choosing by dot(body, projection) would incorrectly flip high-declination
  // bodies whose north-axis component dominates their equatorial projection.
  const ra = Math.atan2(y, x) * degrees;
  const position = normalize(ra - theta * degrees - 90) / 30;
  const boundary = Math.round(position);
  return (Math.abs(position - boundary) < 1e-10 ? boundary % 12 : Math.floor(position)) + 1;
}

// Independent vector construction from the geometric definition in Swiss
// Ephemeris documentation 6.2.3; no Swiss Ephemeris implementation is imported.
// theta/latitude are radians in the equatorial frame used by the supplied rotation.
export function regiomontanusCusps(theta, latitude, toEcliptic) {
  if (!Number.isFinite(theta) || !Number.isFinite(latitude) || Math.abs(latitude) >= Math.PI / 2) return null;
  const north = toEcliptic(-Math.sin(latitude) * Math.cos(theta), -Math.sin(latitude) * Math.sin(theta), Math.cos(latitude));
  const cusps = Array.from({ length: 12 }, (_, index) => {
    const angle = theta + (index - 9) * turn / 12;
    const equatorPoint = toEcliptic(Math.cos(angle), Math.sin(angle), 0);
    const normal = cross(north, equatorPoint);
    // Intersection of the house great circle with the ecliptic (z = 0).
    const x = normal.y, y = -normal.x;
    if (Math.hypot(x, y) < 1e-12) return NaN;
    const toward = x * equatorPoint.x + y * equatorPoint.y;
    return normalize(Math.atan2(y, x) * degrees + (toward < 0 ? 180 : 0));
  });
  if (!cusps.every(Number.isFinite)) return null;
  const widths = cusps.map((cusp, index) => normalize(cusps[(index + 1) % 12] - cusp));
  // Polar inversions need a separately verified clockwise house-position rule.
  // Leave them explicitly unsupported rather than substituting another system.
  if (widths.some(width => width <= 1e-8 || width >= 180) || Math.abs(widths.reduce((a, b) => a + b, 0) - 360) > 1e-7) return null;
  return cusps;
}

// Traditional zero-latitude longitude placement, deliberately named so it cannot
// be mistaken for a body's three-dimensional Regiomontanus house position.
export function longitudeHouse(longitude, cusps) {
  if (!Number.isFinite(longitude) || cusps.length !== 12 || !cusps.every(Number.isFinite)) return null;
  const widths = cusps.map((cusp, index) => normalize(cusps[(index + 1) % 12] - cusp));
  if (widths.some(width => width <= 1e-8 || width >= 180) || Math.abs(widths.reduce((a, b) => a + b, 0) - 360) > 1e-7) return null;
  const index = cusps.findIndex((cusp, index) => normalize(longitude - cusp) < widths[index]);
  return index < 0 ? null : index + 1;
}
