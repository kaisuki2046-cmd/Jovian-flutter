import { createHash } from 'node:crypto';
import { zodiacNames } from '../../control/charts.ts';
import { lillyDignityBodies } from './lilly-dignities.mjs';
import { lillyNodeLongitudes, lunarNodes } from './lilly-nodes.mjs';

export const lillyPrintedDignityProfile = 'lilly-1647-p104-printed-labels-v1';
const prefix = 'astro-lilly-v1-dignity-table-p';
const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
const bodies = [...lillyDignityBodies.map(planet => planet.toLowerCase()), ...lunarNodes];
const dayNightLabels = { Diurnall: 'diurnal', Nocturnall: 'nocturnal', 'except Sol and Luna': 'both' };
const reviewed = new Map([
  ['145', '6b6ffc44570b66c0f6e3a728849dec536b3484cf1320be103f4738fc45dc4a0e'],
  ['146', '148ebf80e314593fac7cbcad38a729d46f2154b1d2579ecf4d5bdd49c7027c3e'],
  ['147', 'c25a4b420660f2b0459e651b57ac46596694a186854deb8f45df84ceef1d64d2'],
  ['148', '7e95c7e6800d1b0f6c3d55c794f13dce1f756afcb5a5df3eccd56c38655525a6'],
  ['149', 'feb84e60eb7205e2c696ec2ccf5350177202eb9dfb83ced14c00415e19a97fd8'],
  ['150', '284c5a7049a71f66349f55ad235b2083253d39b6444e8f3460e4ca3ab7e7a4aa'],
  ['151', '95e10975f56569c831d031dc4040815c069c904e79f8e8da7129b5e1122674ca'],
  ['152', 'afa7d16c0b144aa83bc1666171347f6d91a400380ca213a8be2f5d48b1f3cf2a'],
  ['153', 'a50c05ce5e5deced6ef5fbca30ccd064114c3624b79e0404e73419505fc89b09'],
  ['154', '27e1f368524b3eab2b5b505aa00cf6a2e3f798654a89c00c8dcd98e8b5c0e367'],
  ['155', '9fb27537daa0b011658d84922c5dde875be68cad53525a2f5543416a91d64752'],
  ['156', '352b4592cc40f8b53d19211203a3f1bdbc9a0a928d21fd8fc235e99a33e91ad3'],
  ['157', '59fc47c4deed0220c3357d8038fe1bc4edb773ef879125f18189efc886193abe'],
  ['158', '7eb01c65d3e15da5b07760c11eb7cc9b896120b73aa818f94e2bfb2e8eb69e90'],
  ['159', '905ad917b1296c3bb6e9a7eab10c38af24c9fecc56b1300bfb25c815abd9707c'],
  ['160', '212856a268751415f60632d439bd29280bc95c25632b6b7a50a9c3f21ac41db8'],
  ['161', '5e5ce51a5f504b55bdef23c251abde9c959114606ea8ecaf746e6cb3a23e59a0'],
  ['162', '8ec0cfeddc91238c0dc7ba3efb744963c3648579c4b3dc3d70462d1538507fb7'],
  ['163', '7c235cfef90279cb6ad03181cf84e21850b8582c1072287e80917a02e9348219'],
  ['164', '0357383e640110b4d68d74b6cf7deb5c84640c09c4fa8baf0f260249b055a604'],
  ['165', '668274acfc9ebf0d37f07bcbec4783be4c6c1ee2ff82caed9925922ff2cf496f'],
]);

export function compileLillyPrintedDignities(claims, dignityCells) {
  const sources = claims.filter(({ id }) => id.startsWith(prefix) && reviewed.has(id.slice(prefix.length, -4)));
  if (!sources.length) return new Map();
  if (sources.length !== reviewed.size) throw new Error('Incomplete Lilly printed dignity sources.');

  const selected = new Map();
  const domicileSigns = new Set(), exaltedBodies = new Set();
  for (const claim of sources) {
    const { id, source, conditions, evidence } = claim;
    const hash = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
    if (hash !== reviewed.get(id.slice(prefix.length, -4))) throw new Error('Review Lilly printed dignity source ' + id);
    const fields = Object.fromEntries(conditions.match.include[0].map(({ fact, equals }) => [fact, equals]));
    const reference = { profile: lillyPrintedDignityProfile, cells: 1 };

    if (fields['context.lilly_dignity_query'] === 'domicile_day_night_label') {
      const sign = fields['profiles.lilly.dignities.table.active_sign'];
      const label = dayNightLabels[evidence.original_text];
      const ruler = dignityCells.find(cell => cell.dimension === 'domicile' && cell.sign === sign)?.body;
      if (!signs.includes(sign) || !label || !ruler || domicileSigns.has(sign)
        || (label === 'both') !== ['sun', 'moon'].includes(ruler)) throw new Error('Invalid Lilly domicile label ' + id);
      domicileSigns.add(sign);
      selected.set(id, { ...reference, role: 'domicile_day_night_label', sign, label, ruler });
    } else {
      const printed = conditions.original[0].match(/^The table prints ([a-z_]+) exalted in ([a-z]+) at degree (\d+)\.$/u);
      const [, body, sign, number] = printed ?? [];
      const degree = Number(number);
      if (fields['context.lilly_dignity_query'] !== 'printed_exaltation_degree'
        || fields['profiles.lilly.dignities.table.active_body'] !== body
        || !bodies.includes(body) || !signs.includes(sign) || !Number.isInteger(degree) || degree < 0 || degree >= 30
        || exaltedBodies.has(body) || !dignityCells.some(cell => cell.dimension === 'exaltation' && cell.sign === sign && cell.body === body)) {
        throw new Error('Invalid Lilly printed exaltation ' + id);
      }
      exaltedBodies.add(body);
      selected.set(id, { ...reference, role: 'printed_exaltation_degree', body, sign, degree });
    }
  }
  if (domicileSigns.size !== signs.length || exaltedBodies.size !== bodies.length) throw new Error('Incomplete Lilly printed dignity matrix.');
  return selected;
}

function chartPositions(facts) {
  const positions = [];
  for (const planet of lillyDignityBodies) {
    const values = new Set(facts.filter(fact => fact.kind === 'planet_longitude' && fact.planet === planet).map(fact => fact.longitude));
    const declared = new Set(facts.filter(fact => fact.kind === 'planet_sign' && fact.planet === planet).map(fact => fact.sign));
    if (values.size > 1 || declared.size > 1 || (!values.size && !declared.size)) continue;
    const [longitude] = values;
    if (values.size && (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360)) continue;
    const index = values.size ? Math.floor(longitude / 30) : zodiacNames.indexOf(declared.values().next().value);
    if (index < 0 || declared.size && !declared.has(zodiacNames[index])) continue;
    positions.push({ body: planet.toLowerCase(), sign: signs[index], ...(values.size && { degreeInSign: longitude % 30 }) });
  }
  return positions.concat(lillyNodeLongitudes(facts).map(({ node, longitude }) =>
    ({ body: node, sign: signs[Math.floor(longitude / 30)], degreeInSign: longitude % 30 })));
}

export function lillyPrintedDignityReferences(facts, rows) {
  const zodiacs = new Set(facts.filter(fact => fact.kind === 'western_zodiac').map(fact => fact.zodiac));
  if (!rows.length || zodiacs.size !== 1 || !zodiacs.has('tropical')) return [];
  const positions = chartPositions(facts);
  const byBody = new Map(positions.map(position => [position.body, position]));
  const profile = lillyPrintedDignityProfile;
  return rows.flatMap(({ role, sign, label, ruler, body, degree, sourceId, source }) => {
    const citation = { id: sourceId, ...source };
    const signName = zodiacNames[signs.indexOf(sign)];
    if (role === 'domicile_day_night_label') {
      const present = positions.filter(position => position.sign === sign).map(position => position.body);
      return present.length ? [{ role: 'domicile_label_lookup', profile, sign, signName, label, ruler, occupants: present, source: citation }] : [];
    }
    const position = byBody.get(body);
    if (!position) return [];
    const matchesSign = position.sign === sign;
    const matchesDegree = position.degreeInSign === undefined
      ? undefined : matchesSign && Math.floor(position.degreeInSign) === degree;
    return [{ role: 'printed_exaltation_lookup', profile, body, sign, signName, degree, observed: position,
      matchesSign, ...(matchesDegree !== undefined && { matchesDegree }), source: citation }];
  });
}
