type Vector3 = { x: number; y: number; z: number };
export function regiomontanusHouse(bodyEquatorial: Vector3, theta: number, latitude: number): number | null;
export function regiomontanusCusps(theta: number, latitude: number, toEcliptic: (x: number, y: number, z: number) => Vector3): number[] | null;
export function longitudeHouse(longitude: number, cusps: readonly number[]): number | null;
