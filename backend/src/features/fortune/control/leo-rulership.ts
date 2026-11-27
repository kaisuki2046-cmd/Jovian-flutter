// Same-author supporting edition, How to Judge a Nativity, fourth edition
// (1928), printed p.27. Do not silently identify this with a 1906 table or
// allocate Aquarius/Pisces to Uranus/Neptune from a modern house library.
const rulers = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'] as const;
const sourceBodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
const normalize = (value: number) => (value % 360 + 360) % 360;
export const leoRulershipPolicy = {
  profile: 'leo-natal-pair-rulership-1928-support-v1',
  basis: 'leo-1928-fourth-edition-explicit-sign-table',
  houseSystem: 'placidus', houseBasis: 'actual-natal-cusp-sign-not-occupied-house-or-natural-house-number',
  edition: 'supporting-same-author-edition-not-verified-identical-to-1906',
  outerBodies: 'table-does-not-allot-domiciles; not-zero-ruled-houses-or-modern-assignments',
  exchange: 'reciprocal-sign-domicile-coordinates-not-source-mutual-disposition-or-effective-rescue',
} as const;
export function readLeoSignRuler(sign: number) {
  if (!Number.isInteger(sign) || sign < 0 || sign > 11) throw new RangeError('Invalid Leo sign');
  return rulers[sign];
}
type Position = { body: string; longitude: number };
export function readLeoPairRulership(first: Position, second: Position, cusps?: readonly number[]) {
  if ([first, second].some(p => !sourceBodies.includes(p.body) || !Number.isFinite(p.longitude) || p.longitude < 0 || p.longitude >= 360)
    || first.body === second.body) throw new RangeError('Invalid Leo natal pair');
  if (cusps !== undefined && (cusps.length !== 12 || !cusps.every(value => Number.isFinite(value) && value >= 0 && value < 360)
    || cusps.some((value, i) => normalize(cusps[(i + 1) % 12] - value) <= 1e-8)
    || Math.abs(cusps.reduce((sum, value, i) => sum + normalize(cusps[(i + 1) % 12] - value), 0) - 360) > 1e-7)) throw new RangeError('Invalid Leo cusp cycle');
  const cuspRulers = cusps?.map((longitude, i) => ({ house: i + 1, longitude, sign: Math.floor(longitude / 30),
    ruler: readLeoSignRuler(Math.floor(longitude / 30)) }));
  const body = (position: Position) => {
    const sign = Math.floor(position.longitude / 30), domicileSigns = rulers.flatMap((ruler, i) => ruler === position.body ? [i] : []);
    const assigned = domicileSigns.length > 0;
    return { ...position, sign, signRuler: readLeoSignRuler(sign), domicileSigns, tableAssigned: assigned,
      status: !assigned ? 'not_allotted_in_supporting_table' : cuspRulers ? 'calculated_from_natal_cusps' : 'house_frame_unavailable',
      ruledHouses: assigned ? cuspRulers?.filter(row => row.ruler === position.body) : undefined };
  };
  const a = body(first), b = body(second);
  return { profile: leoRulershipPolicy.profile, basis: leoRulershipPolicy.basis, houseSystem: leoRulershipPolicy.houseSystem,
    source1906TableVerified: false, houseStatus: cuspRulers ? 'ready' : 'unavailable', first: a, second: b, cuspRulers,
    mutualDomicileExchange: a.tableAssigned && b.tableAssigned ? a.signRuler === b.body && b.signRuler === a.body : undefined,
    mutualDispositionInterpretationVerified: false, favourableNatalAspectVerified: false, effectiveBalanceVerified: false };
}
