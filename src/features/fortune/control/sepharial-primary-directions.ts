import { Body, EquatorFromVector, GeoVector, RotateVector, Rotation_EQJ_EQD } from 'astronomy-engine';
import type { Planet } from './solar-transits';

const rad = Math.PI / 180;
const signedArc = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180;
type Observer = { armc: number; latitude: number };
type Position = { rightAscension: number; declination: number };

export const sepharialSphericalPrimaryProfile = 'sepharial-1901-mundane-natal-semiarc-v1';

export function sepharialNatalEquatorialPosition(body: Planet, birthAt: number): Position {
  const date = new Date(birthAt);
  const vector = RotateVector(Rotation_EQJ_EQD(date), GeoVector(Body[body], date, true));
  const { ra, dec } = EquatorFromVector(vector);
  return { rightAscension: 15 * ra, declination: dec };
}

function diurnalSemiArc(declination: number, latitude: number) {
  const cosine = -Math.tan(latitude * rad) * Math.tan(declination * rad);
  return Math.abs(cosine) < 1 ? Math.acos(cosine) / rad : undefined;
}

export function sepharialMundaneAngleArcs(frame: Observer, position: Position) {
  const meridian = position.rightAscension - frame.armc;
  const semiArc = diurnalSemiArc(position.declination, frame.latitude);
  const angles = [
    { indicator: 'MC', aspect: 'conjunction', sphericalPoint: 'upper-meridian', arc: signedArc(meridian) },
    { indicator: 'MC', aspect: 'opposition', sphericalPoint: 'lower-meridian', arc: signedArc(meridian + 180) },
  ] as const;
  if (semiArc === undefined) return [...angles];
  return [...angles,
    { indicator: 'ASC', aspect: 'conjunction', sphericalPoint: 'east-horizon', arc: signedArc(meridian - semiArc) },
    { indicator: 'ASC', aspect: 'opposition', sphericalPoint: 'west-horizon', arc: signedArc(meridian + semiArc) },
  ] as const;
}

// Prognostic Astronomy IV keeps the chosen indicator stationary and brings
// the moving body to the same proportion of its own day or night semi-arc.
export function sepharialMundaneConjunctionArc(frame: Observer, moving: Position, stationary: Position) {
  const stationaryDay = diurnalSemiArc(stationary.declination, frame.latitude);
  const movingDay = diurnalSemiArc(moving.declination, frame.latitude);
  if (stationaryDay === undefined || movingDay === undefined) return;
  const targetHour = signedArc(frame.armc - stationary.rightAscension);
  const above = Math.abs(targetHour) <= stationaryDay;
  const meridian = above ? 0 : 180;
  const targetDistance = signedArc(targetHour - meridian);
  const ratio = above ? movingDay / stationaryDay : (180 - movingDay) / (180 - stationaryDay);
  const movingHour = frame.armc - moving.rightAscension;
  return signedArc(meridian + ratio * targetDistance - movingHour);
}
