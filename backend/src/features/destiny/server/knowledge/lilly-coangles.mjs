import { regiomontanusCusps } from '../../control/regiomontanus.mjs';
import { westernAngularPlanets, westernAngularStars, westernFixedStarProfile } from '../../control/western-fixed-stars.mjs';

const radians = Math.PI / 180;
const siderealLimit = 1;
const cycle = angle => (angle % 360 + 360) % 360;
const distance = (a, b) => Math.abs(cycle(a - b + 180) - 180);

function eclipticUnitVector(longitude, latitude, obliquity) {
  const lon = longitude * radians, lat = latitude * radians;
  const x = Math.cos(lat) * Math.cos(lon), y = Math.cos(lat) * Math.sin(lon), z = Math.sin(lat);
  return { x, y: y * Math.cos(obliquity) - z * Math.sin(obliquity),
    z: y * Math.sin(obliquity) + z * Math.cos(obliquity) };
}

function observerFromCusps(cusps, obliquity) {
  const mc = eclipticUnitVector(cusps[9], 0, obliquity);
  const meridian = Math.atan2(mc.y, mc.x);
  let numerator = 0, denominator = 0;
  for (const [index, cusp] of cusps.entries()) {
    const equator = meridian + (index - 9) * Math.PI / 6;
    const { x, y, z } = eclipticUnitVector(cusp, 0, obliquity);
    // The house circle contains the local northern horizon point and its
    // Regiomontanus equator division. Solve that plane equation for tan(phi).
    const leverage = Math.sin(meridian - equator) * z;
    if (Math.abs(leverage) > Math.abs(denominator)) {
      numerator = Math.sin(equator) * x - Math.cos(equator) * y;
      denominator = leverage;
    }
  }
  if (Math.abs(denominator) < 1e-10) return null;
  const latitude = Math.atan(numerator / denominator);
  const cos = Math.cos(obliquity), sin = Math.sin(obliquity);
  const reconstructed = regiomontanusCusps(meridian, latitude, (x, y, z) => ({
    x, y: y * cos + z * sin, z: -y * sin + z * cos,
  }));
  if (!reconstructed?.every((cusp, index) => distance(cusp, cusps[index]) < 1e-6)) return null;
  return { sidereal: cycle(meridian / radians), latitude };
}

function eventPhases(longitude, latitude, obliquity, observer) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return {};
  const { x, y, z } = eclipticUnitVector(longitude, latitude, obliquity);
  const ra = cycle(Math.atan2(y, x) / radians);
  const dec = Math.atan2(z, Math.hypot(x, y));
  const crossing = -Math.tan(observer.latitude) * Math.tan(dec);
  const crossesHorizon = Math.abs(crossing) < 1 - 1e-10;
  return {
    ...(Math.abs(observer.latitude - dec) < Math.PI / 2 && { mc: ra }),
    ...(Math.abs(observer.latitude + dec) < Math.PI / 2 && { ic: cycle(ra + 180) }),
    ...(crossesHorizon && { ascendant: cycle(ra - Math.acos(crossing) / radians),
      descendant: cycle(ra + Math.acos(crossing) / radians) }),
  };
}

function uniqueValue(facts, kind, field, accepts = () => true) {
  const values = new Set(facts.filter(fact => fact.kind === kind && accepts(fact)).map(fact => fact[field]));
  return values.size === 1 ? values.values().next().value : undefined;
}

export function lillyHorizonRisePhases(facts, cusps, longitudes) {
  const degrees = uniqueValue(facts, 'western_geometry_obliquity', 'obliquity');
  if (!cusps || !Number.isFinite(degrees) || degrees < 22 || degrees > 25) return new Map();
  const obliquity = degrees * radians;
  const observer = observerFromCusps(cusps, obliquity);
  if (!observer) return new Map();
  return new Map([...longitudes].map(([planet, longitude]) => {
    const latitude = uniqueValue(facts, 'western_geometry_planet_latitude', 'latitude', fact => fact.planet === planet);
    return [planet, eventPhases(longitude, latitude, obliquity, observer).ascendant];
  }));
}

export function westernPlanetAngleOffsets(facts, cusps, longitudes) {
  const value = uniqueValue(facts, 'western_geometry_obliquity', 'obliquity');
  if (!cusps || !Number.isFinite(value) || value < 22 || value > 25) return new Map();
  const obliquity = value * radians;
  const observer = observerFromCusps(cusps, obliquity);
  if (!observer) return new Map();
  return new Map([...longitudes].flatMap(([planet, longitude]) => {
    const latitude = uniqueValue(facts, 'western_geometry_planet_latitude', 'latitude', fact => fact.planet === planet);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude) >= 90) return [];
    const phases = eventPhases(longitude, latitude, obliquity, observer);
    return [[planet, { latitude, obliquity: value, offsets: Object.fromEntries(Object.entries(phases)
      .map(([angle, phase]) => [angle, cycle(phase - observer.sidereal + 180) - 180])) }]];
  }));
}

export function lillyCoangleFacts(facts, cusps, planetLongitudes) {
  const value = uniqueValue(facts, 'western_geometry_obliquity', 'obliquity');
  if (!Number.isFinite(value) || value < 22 || value > 25) return [];
  const obliquity = value * radians;
  const observer = observerFromCusps(cusps, obliquity);
  if (!observer) return [];
  const planets = westernAngularPlanets.map(planet => [planet, eventPhases(planetLongitudes.get(planet),
    uniqueValue(facts, 'western_geometry_planet_latitude', 'latitude', fact => fact.planet === planet), obliquity, observer)]);
  return westernAngularStars.flatMap(star => {
    const fromCatalog = fact => fact.star === star && fact.profile === westernFixedStarProfile;
    const events = eventPhases(uniqueValue(facts, 'western_fixed_star_longitude', 'longitude', fromCatalog),
      uniqueValue(facts, 'western_geometry_star_latitude', 'latitude', fromCatalog), obliquity, observer);
    return ['mc', 'ascendant'].flatMap(angle => {
      const phase = events[angle];
      if (phase === undefined || distance(phase, observer.sidereal) > siderealLimit + 1e-10) return [];
      return planets.flatMap(([planet, times]) => {
        const companion = times[angle];
        if (companion === undefined || distance(companion, observer.sidereal) > siderealLimit + 1e-10
          || distance(phase, companion) > siderealLimit + 1e-10) return [];
        return [{ kind: 'western_lilly_preferment_coangle', star, planet, angle }];
      });
    });
  });
}
