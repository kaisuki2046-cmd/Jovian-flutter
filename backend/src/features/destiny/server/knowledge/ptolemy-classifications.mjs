import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
export const ptolemyClassificationProfile = 'ptolemy-robbins-1940-classifications-v1';
const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const bodies = 'Sun Moon Mercury Venus Mars Jupiter Saturn'.split(' ');
const specs = [
  ['chapter-5-p001', 'planet_nature', ['beneficent'], 'planet', 'fa89bf16e233001d595eb35fe53fe151fba9d8198c7a1a1bacb75a04aa2deefa'],
  ['chapter-5-p002', 'planet_nature', ['maleficent'], 'planet', '7669431e952e43e8b38b06f7bc6c72a460c7c252f2545269091096ac4b9338ae'],
  ['chapter-5-p003', 'planet_nature', ['common'], 'planet', 'bd719668770aa97b70083faecae7b6da6554a3f451bdf286417108eab608f400'],
  ['chapter-7-p001', 'planet_sect_affinity', ['diurnal'], 'planet', '9a67cb639ce56069e9691f10fe77e8af6d3287ae03360ab15969ede8344c290e'],
  ['chapter-7-p002', 'planet_sect_affinity', ['nocturnal'], 'planet', 'c82235eca143ecd4c38481b31a81488da9f218283af8d4747f9624228ca93648'],
  ['zodiac-types-p002', 'sign_mode', ['solstitial'], 'sign', 'f94e1ef0ef735eaa0891b8e25dfef36af7c3efedb7fd808f933c4120bcae4213'],
  ['zodiac-types-p003', 'sign_mode', ['equinoctial'], 'sign', '75a203d94b63b4f3d3559fdf01e2131b44cf8a131e21976dd27a4671dd8be702'],
  ['zodiac-types-p004', 'sign_mode', ['solid'], 'sign', '5c534698ad58017464bfd3990ddaa80a43a0b085b3d75ccb20e8990d581e7288'],
  ['zodiac-types-p005', 'sign_mode', ['bicorporeal'], 'sign', '836aab0a461c2e3278961e5d11ecc129041acbce35d781fa90e3fca32731fdd0'],
  ['chapter-12-p001', 'sign_polarity', ['masculine'], 'sign', '61da7bfe42931847975584c0f29b95c6c3948d7d3ea9747f1d3084f7846a3ac0'],
  ['chapter-12-p002', 'sign_polarity', ['feminine'], 'sign', 'd292077dd4266c2c9fa6fc745a1ec39df6bd94faee4a09893095cab9e3a9c0f0'],
  ['chapter-18-p001', 'triplicity_rulers', ['sun'], 'sign', '664e70154a5316b854794ce87d83e154a6072052447c1a0da8a700ccbdb6a7ac'],
  ['chapter-18-p002', 'triplicity_rulers', ['jupiter'], 'sign', 'c9333eb56b4208c07f6a4462e9d8d1d3bd2098070500783d73a2053a8de0c7eb'],
  ['chapter-18-p003', 'triplicity_rulers', ['venus'], 'sign', '8cd4661af8206a1041afce1bf3b9fe01be93b7c1d43c41799f54ee8fc59e1664'],
  ['chapter-18-p004', 'triplicity_rulers', ['moon'], 'sign', '82098526cb55dd6470b93d366dfe3fdda57e4785a9d64a5b48a32bb452a8d4f1'],
  ['chapter-18-p005', 'triplicity_rulers', ['saturn'], 'sign', '2561224271604c3f93d2928753a7c17699afc57c7f086aa4e7c021c7cd66c524'],
  ['chapter-18-p006', 'triplicity_rulers', ['mercury'], 'sign', '81f5110be7d542e6826c813fc545f7dfd09d3e72dbdc279aba59ff6865daf628'],
  ['chapter-18-p007', 'triplicity_rulers', ['venus', 'mars'], 'sign', '73e7221d847e96bc6ba40b628cf5c6b882bf6c27d2dc4f7487b9605192239a0e'],
  ['chapter-18-p008', 'triplicity_rulers', ['moon', 'mars'], 'sign', '203f68c92f0c4365d307a9472a61ab0e82e893a5e98a4d3c23f1a362aaead575'],
].map(([suffix, dimension, values, target, hash]) => ({ id: 'astro-ptolemy-v1-' + suffix + '-001', dimension, values, target, hash }));
export const ptolemyClassificationSourceIds = Object.freeze(specs.map(s => s.id));

// Build-time conversion only. The 19 sources remain reference tables, not
// unconditional personality/event rules. Metadata cells live in SQLite's
// existing lookup_json column and are filtered by SQL at runtime.
export function compilePtolemyClassifications(claims) {
  const selected = new Map(claims.filter(c => ptolemyClassificationSourceIds.includes(c.id)).map(c => [c.id, c]));
  if (!selected.size) return new Map();
  if (selected.size !== specs.length) throw new Error('Incomplete Ptolemy classification sources.');
  const result = new Map();
  for (const spec of specs) {
    const claim = selected.get(spec.id), hash = createHash('sha256').update(JSON.stringify({ source: claim.source, conditions: claim.conditions, evidence: claim.evidence })).digest('hex');
    if (hash !== spec.hash || claim.source.book !== 'Tetrabiblos') throw new Error('Review Ptolemy classification source ' + spec.id);
    const entries = claim.conditions.match.include.map(group => {
      const map = Object.fromEntries(group.map(c => [c.fact, c.equals]));
      const allowed = ['chart.zodiac', 'chart.sect', 'profiles.ptolemy.classification.active_' + spec.target];
      const key = map[allowed[2]], sect = map['chart.sect'] ?? 'both';
      if (Object.keys(map).length !== group.length || group.some(c => !allowed.includes(c.fact))
        || !(spec.target === 'planet' ? bodies.map(b => b.toLowerCase()) : signs).includes(key)
        || spec.target === 'sign' && map['chart.zodiac'] !== 'tropical'
        || !['both', 'day', 'night'].includes(sect)) throw new Error('Invalid Ptolemy classification cell ' + spec.id);
      return { target: spec.target, key, sect, dimension: spec.dimension, values: [...spec.values] };
    });
    result.set(spec.id, { role: 'classification_table', profile: ptolemyClassificationProfile, cells: entries.length, entries });
  }
  if ([...result.values()].reduce((n, r) => n + r.cells, 0) !== 61) throw new Error('Incomplete Ptolemy classification matrix.');
  return result;
}

// A sign requires a unique confirmed longitude/sign and a declared tropical
// zodiac. Planet nature and fixed sect affinity depend on identity, not on
// the chart's sect; Mercury's variable sect is deliberately not invented.
export function ptolemyClassificationReferences(facts, rowsAt) {
  if (!Array.isArray(facts) || !rowsAt) return [];
  const zodiacs = new Set(facts.filter(f => f.kind === 'western_zodiac').map(f => f.zodiac));
  const tropical = zodiacs.size === 1 && zodiacs.has('tropical');
  const sects = new Set(facts.filter(f => f.kind === 'western_sect').map(f => f.sect));
  const sect = sects.size === 1 ? [...sects][0] : 'unknown', references = [];
  for (const planet of bodies) {
    const longitudes = new Set(facts.filter(f => f.kind === 'planet_longitude' && f.planet === planet).map(f => f.longitude));
    const labels = new Set(facts.filter(f => f.kind === 'planet_sign' && f.planet === planet).map(f => f.sign));
    if (longitudes.size > 1 || labels.size > 1 || !longitudes.size && !labels.size) continue;
    const [longitude] = longitudes, [label] = labels;
    if (longitudes.size && (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360)) continue;
    const index = longitudes.size ? Math.floor(longitude / 30) : zodiacNames.indexOf(label);
    if (index < 0 || labels.size && zodiacNames[index] !== label) continue;
    const classifications = rowsAt(planet.toLowerCase(), tropical ? signs[index] : null, sect);
    if (classifications.length) references.push({ role: 'classification_lookup', profile: ptolemyClassificationProfile, planet,
      ...(tropical && { sign: zodiacNames[index] }), classifications,
      sources: [...new Map(classifications.map(c => [c.sourceId, { id: c.sourceId, ...c.source }])).values()] });
  }
  return references;
}
