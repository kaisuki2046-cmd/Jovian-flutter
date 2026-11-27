import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { calculateWestern } from './charts.ts';
import { regiomontanusCusps, regiomontanusHouse, longitudeHouse } from './regiomontanus.mjs';
const radians = Math.PI / 180;
const norm = angle => (angle % 360 + 360) % 360;
const error = (a, b) => Math.abs(norm(a - b + 180) - 180);
const rotation = obliquity => (x, y, z) => ({ x, y: Math.cos(obliquity) * y + Math.sin(obliquity) * z,
  z: -Math.sin(obliquity) * y + Math.cos(obliquity) * z });

test('independent Swiss Ephemeris numerical fixtures agree for 25 cusp sets and 525 three-dimensional placements', () => {
  const fixture = JSON.parse(readFileSync(new URL('./regiomontanus-reference.json', import.meta.url)));
  for (const row of fixture.cases) {
    const eps = row.obliquity * radians;
    const cusps = regiomontanusCusps(row.armc * radians, row.latitude * radians, rotation(eps));
    assert.ok(cusps);
    row.cusps.forEach((expected, index) => assert.ok(error(cusps[index], expected) < 1e-7));
    for (const p of row.positions) {
      const lon = p.longitude * radians, lat = p.latitude * radians;
      const v = rotation(-eps)(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat));
      assert.equal(regiomontanusHouse(v, row.armc * radians, row.latitude * radians), p.house);
    }
  }
});

test('actual birth time and longitude drive cusps consistent with independent Swiss Ephemeris birth fixtures', () => {
  const fixture = JSON.parse(readFileSync(new URL('./regiomontanus-reference.json', import.meta.url)));
  assert.equal(fixture.swissVersion, '2.10.03');
  for (const row of fixture.birthCases) {
    const chart = calculateWestern(Date.parse(row.date), { latitude: row.latitude, longitude: row.longitude });
    assert.ok(chart.regiomontanus);
    row.cusps.forEach((cusp, index) => assert.ok(error(chart.regiomontanus.houses[index], cusp) < 1e-4));
    assert.ok(error(chart.regiomontanus.houses[0], chart.ascendant) < 1e-8);
    assert.ok(error(chart.regiomontanus.houses[9], chart.midheaven) < 1e-8);
  }
});

test('equator projections match the independent right-ascension relation and opposite cusps', () => {
  const obliquity = 23.4392911 * radians;
  for (let theta = 0; theta < 360; theta += 17) {
    const cusps = regiomontanusCusps(theta * radians, 0, rotation(obliquity));
    assert.ok(cusps);
    for (let index = 0; index < 12; index++) {
      const ra = (theta + (index - 9) * 30) * radians;
      const expected = norm(Math.atan2(Math.sin(ra), Math.cos(obliquity) * Math.cos(ra)) / radians);
      assert.ok(error(cusps[index], expected) < 1e-8);
      assert.ok(error(cusps[(index + 6) % 12], cusps[index] + 180) < 1e-8);
    }
  }
});

test('cusps lie on the specified north-south great circles at northern and southern latitudes', () => {
  const rotate = rotation(23.4392911 * radians);
  for (const latitude of [-60, -35, 0, 35, 60]) for (const theta of [0, 41, 110, 181, 271]) {
    const lat = latitude * radians, angle = theta * radians;
    const north = rotate(-Math.sin(lat) * Math.cos(angle), -Math.sin(lat) * Math.sin(angle), Math.cos(lat));
    const cusps = regiomontanusCusps(angle, lat, rotate);
    assert.ok(cusps);
    cusps.forEach((longitude, index) => {
      const ra = angle + (index - 9) * 30 * radians;
      const p = rotate(Math.cos(ra), Math.sin(ra), 0);
      const v = { x: Math.cos(longitude * radians), y: Math.sin(longitude * radians), z: 0 };
      const determinant = v.x * (north.y * p.z - north.z * p.y) + v.y * (north.z * p.x - north.x * p.z);
      assert.ok(Math.abs(determinant) < 1e-9);
      assert.equal(longitudeHouse(longitude, cusps), index + 1);
      assert.equal(longitudeHouse(longitude - 1e-6, cusps), (index + 11) % 12 + 1);
    });
  }
});

test('invalid and polar-degenerate inputs fail explicitly without a replacement house system', () => {
  assert.equal(regiomontanusCusps(NaN, 0, rotation(0)), null);
  assert.equal(regiomontanusCusps(0, Math.PI / 2, rotation(0)), null);
  assert.equal(longitudeHouse(NaN, Array.from({ length: 12 }, (_, i) => i * 30)), null);
  assert.equal(longitudeHouse(0, Array(12).fill(0)), null);
  assert.equal(longitudeHouse(0, Array.from({ length: 12 }, (_, i) => -i * 30)), null);
});

test('three-dimensional positions follow house great circles including off-ecliptic bodies', () => {
  for (const latitude of [-60, -35, 0, 35, 60]) for (const angle of [0, 43, 171, 281]) {
    const lat = latitude * radians, theta = angle * radians;
    const north = { x: -Math.sin(lat) * Math.cos(theta), y: -Math.sin(lat) * Math.sin(theta), z: Math.cos(lat) };
    for (let house = 1; house <= 12; house++) {
      // An interior equatorial point and any north-axis displacement remain in
      // the same great-circle plane. Avoid the undefined north/south axis itself.
      const ra = theta + (90 + (house - 1) * 30 + 15) * radians;
      for (const displacement of [-2, -0.2, 0, 0.2, 2]) {
        const body = { x: Math.cos(ra) + displacement * north.x,
          y: Math.sin(ra) + displacement * north.y, z: displacement * north.z };
        assert.equal(regiomontanusHouse(body, theta, lat), house);
      }
    }
    assert.equal(regiomontanusHouse(north, theta, lat), null);
  }
});

test('three-dimensional cusp boundaries enter the next house consistently across the equatorial wrap', () => {
  for (let theta = 0; theta < 360; theta += 17) for (let house = 1; house <= 12; house++) {
    const angle = (theta + 90 + (house - 1) * 30) * radians;
    const at = offset => ({ x: Math.cos(angle + offset), y: Math.sin(angle + offset), z: 0 });
    assert.equal(regiomontanusHouse(at(0), theta * radians, 35 * radians), house);
    assert.equal(regiomontanusHouse(at(-1e-6), theta * radians, 35 * radians), (house + 10) % 12 + 1);
    assert.equal(regiomontanusHouse(at(1e-6), theta * radians, 35 * radians), house);
  }
});
