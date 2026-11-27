import { BaryState, Body, C_AUDAY, DEG2RAD, Ecliptic, Vector } from 'astronomy-engine';

export const westernFixedStarProfile = 'hipparcos-2007-ect-v1';
export const westernFixedStarNames = Object.freeze({
  cor_leonis: '狮子心', spica_virgo: '角宿一', caput_algol: '大陵五',
  oculus_taurus: '毕宿五', hercules: '北河三', lucida_lancis: '氐宿一', cor_scorpii: '心宿二',
  sirius: '天狼星', procyon: '南河三',
  arcturus: '大角星', betelgeuse: '参宿四', capella: '五车二',
});
export const westernAngularStars = ['caput_algol', 'oculus_taurus', 'cor_scorpii', 'sirius', 'procyon'];
export const westernAngularPlanets = ['Sun', 'Moon', 'Jupiter'];
export const westernGeometryPlanets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

// VizieR I/311/hip2. ICRS coordinates at J1991.25, parallax and proper motion in mas and mas/Julian year.
const stars = [
  { star: 'cor_leonis', ra: 152.09358042, dec: 11.96719519, parallax: 41.13, pmRa: -248.73, pmDec: 5.59 }, // HIP 49669
  { star: 'spica_virgo', ra: 201.29835228, dec: -11.16124494, parallax: 13.06, pmRa: -42.35, pmDec: -30.67 }, // HIP 65474
  { star: 'caput_algol', ra: 47.04220893, dec: 40.95565071, parallax: 36.27, pmRa: 2.99, pmDec: -1.66 }, // HIP 14576
  { star: 'oculus_taurus', ra: 68.98000194, dec: 16.50976158, parallax: 48.94, pmRa: 63.45, pmDec: -188.94 }, // HIP 21421
  { star: 'hercules', ra: 116.33068294, dec: 28.02631022, parallax: 96.54, pmRa: -626.55, pmDec: -45.80 }, // HIP 37826
  { star: 'lucida_lancis', ra: 222.71990516, dec: -16.04161027, parallax: 43.03, pmRa: -105.68, pmDec: -68.40 }, // HIP 72622
  { star: 'cor_scorpii', ra: 247.35194829, dec: -26.43194598, parallax: 5.89, pmRa: -12.11, pmDec: -23.30 }, // HIP 80763
  { star: 'sirius', ra: 101.28854105, dec: -16.71314306, parallax: 379.21, pmRa: -546.01, pmDec: -1223.07 }, // HIP 32349
  { star: 'procyon', ra: 114.82724202, dec: 5.22750758, parallax: 284.56, pmRa: -714.59, pmDec: -1036.80 }, // HIP 37279
  { star: 'arcturus', ra: 213.91811408, dec: 19.18727046, parallax: 88.83, pmRa: -1093.39, pmDec: -2000.06 }, // HIP 69673
  { star: 'betelgeuse', ra: 88.79287149, dec: 7.40703653, parallax: 6.55, pmRa: 27.54, pmDec: 11.30 }, // HIP 27989
  { star: 'capella', ra: 79.17206466, dec: 45.99902905, parallax: 76.20, pmRa: 75.25, pmDec: -426.89 }, // HIP 24608
];
const milliarcseconds = DEG2RAD / 3_600_000;

export function westernFixedStarLongitudes(time) {
  const earth = BaryState(Body.Earth, time);
  const years = time.tt / 365.25 + (2000 - 1991.25);
  return stars.map(({ star, ra, dec, parallax, pmRa, pmDec }) => {
    const a = ra * DEG2RAD, d = dec * DEG2RAD;
    const sinRa = Math.sin(a), cosRa = Math.cos(a), sinDec = Math.sin(d), cosDec = Math.cos(d);
    // Tangent motion uses mu_alpha*cos(delta); the catalog direction already includes light travel.
    const east = years * pmRa * milliarcseconds, north = years * pmDec * milliarcseconds;
    const parallaxRad = parallax * milliarcseconds;
    const x = cosDec * cosRa - east * sinRa - north * sinDec * cosRa - earth.x * parallaxRad;
    const y = cosDec * sinRa + east * cosRa - north * sinDec * sinRa - earth.y * parallaxRad;
    const z = sinDec + north * cosDec - earth.z * parallaxRad;
    // First-order annual aberration, followed by the same ecliptic-of-date rotation as the chart planets.
    const scale = Math.hypot(x, y, z) / C_AUDAY;
    const vector = new Vector(x + earth.vx * scale, y + earth.vy * scale, z + earth.vz * scale, time);
    const { elon, elat } = Ecliptic(vector);
    return { star, longitude: elon, latitude: elat };
  });
}
