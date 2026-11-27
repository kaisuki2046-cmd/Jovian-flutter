import { ptolemyTermAt, ptolemyTermStarts, type PtolemyTermTable } from './ptolemy-natal-rulers';
import { eclipticEquator } from './western-houses';

const rad = Math.PI / 180;
const tolerance = 1e-8;
const normalize = (value: number) => (value % 360 + 360) % 360;
const signed = (value: number) => normalize(value + 180) - 180;
const sourceBodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;
const aspects = [
  [0, 'conjunction'], [60, 'sextile'], [90, 'square'], [120, 'trine'], [180, 'opposition'],
  [240, 'trine'], [270, 'square'], [300, 'sextile'],
] as const;
type AngularFrame = { armc: number; latitude: number; obliquity: number };
type Position = { planet: string; longitude: number };
export type PtolemyOrigin = 'ASC' | 'MC' | 'Sun' | 'Moon' | 'Fortune';
type OriginPlace = { origin: PtolemyOrigin; longitude: number };

export const ptolemyPrimaryDirectionProfile = 'ptolemy-iv10-projected-primary-chronocrators-v2';

// III.10 uses the diurnal or nocturnal half of the arc for the respective
// upper or lower meridian. Six unequal hours span each meridian to horizon.
function temporalPosition(frame: AngularFrame, longitude: number) {
  const { rightAscension, declination } = eclipticEquator(longitude, frame.obliquity);
  const diurnal = Math.acos(-Math.tan(frame.latitude * rad) * Math.tan(declination * rad)) / rad;
  const upperAngle = signed(frame.armc - rightAscension);
  const upper = Math.abs(upperAngle) <= diurnal;
  const fraction = upper ? upperAngle / diurnal : signed(upperAngle + 180) / (180 - diurnal);
  return { meridian: upper ? 'upper' : 'lower', fraction } as const;
}

export function ptolemyPrimaryDirections(frame: AngularFrame, natal: readonly Position[], origins: readonly OriginPlace[],
  table: PtolemyTermTable = 'egyptian') {
  const bodies = sourceBodies.flatMap(body => {
    const rows = natal.filter(row => row.planet === body);
    const longitude = rows[0]?.longitude;
    // Canonicalize equivalent archives before calculating ray and bound cuts.
    return rows.length === 1 && Number.isFinite(longitude)
      ? [{ body, longitude: normalize(Number(normalize(longitude).toFixed(10))) }] : [];
  });
  if (bodies.length !== sourceBodies.length) return [];
  const termStarts = ptolemyTermStarts(table);
  return origins.flatMap(({ origin, longitude: originLongitude }) => {
    if (origin !== 'MC' && Math.abs(frame.latitude) >= 90 - frame.obliquity - tolerance) return [];
    const temporal = origin === 'ASC' || origin === 'MC' ? undefined : temporalPosition(frame, originLongitude);
    const polar = (longitude: number) => {
      const { rightAscension, declination } = eclipticEquator(longitude, frame.obliquity);
      if (origin === 'MC') return rightAscension;
      const ascensionalDifference = Math.asin(Math.tan(frame.latitude * rad) * Math.tan(declination * rad)) / rad;
      if (!temporal) return rightAscension - ascensionalDifference;
      return temporal.meridian === 'upper'
        ? rightAscension + temporal.fraction * (90 + ascensionalDifference)
        : rightAscension - 180 + temporal.fraction * (90 - ascensionalDifference);
    };
    const initial = polar(originLongitude);
    const arcAt = (longitude: number) => {
      const arc = normalize(polar(longitude) - initial);
      return arc < tolerance || arc > 360 - tolerance ? 0 : arc;
    };
    const rays = bodies.flatMap(({ body, longitude }) => aspects.map(([offset, aspect]) => {
      const rayLongitude = normalize(longitude + offset);
      return { body, aspect, longitude: rayLongitude, arc: arcAt(rayLongitude) };
    })).sort((a, b) => a.arc - b.arc);
    const rayGroups: (typeof rays)[] = [];
    for (const ray of rays) {
      const previous = rayGroups.at(-1);
      if (previous && ray.arc - previous[0].arc <= tolerance) previous.push(ray);
      else rayGroups.push([ray]);
    }
    const bounds = termStarts.map(longitude => ({ longitude, arc: arcAt(longitude) })).sort((a, b) => a.arc - b.arc);
    const cuts = [0, ...rayGroups.map(group => group[0].arc), ...bounds.map(row => row.arc), 360]
      .sort((a, b) => a - b).reduce<number[]>((unique, value) => {
        if (!unique.length || value - unique.at(-1)! > tolerance) unique.push(value);
        return unique;
      }, []);
    return cuts.slice(0, -1).map((startArc, i) => {
      const endArc = cuts[i + 1];
      const bound = bounds.findLast(row => row.arc <= startArc + tolerance) ?? bounds.at(-1)!;
      const place = ptolemyTermAt(bound.longitude, table);
      const group = rayGroups.findLast(rays => rays[0].arc <= startArc + tolerance) ?? rayGroups.at(-1)!;
      const rulers = [...new Set(group.map(ray => ray.body))];
      return { origin, startArc, endArc, temporalMeridian: temporal?.meridian, temporalHours: temporal && 6 * temporal.fraction,
        sign: place.sign, term: place.term, witnesses: group,
        ruler: rulers.length === 1 ? rulers[0] : undefined };
    });
  });
}
