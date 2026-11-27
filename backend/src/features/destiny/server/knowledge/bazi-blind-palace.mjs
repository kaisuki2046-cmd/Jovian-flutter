import { createHash } from 'node:crypto';
import { normalizeRuleInput } from './matching.mjs';
import { compatibleBaZiLiteralFacts } from './bazi-literal-conditions.mjs';

export const blindPalaceProfile = 'bazi-blind-palace-positions-v1';
const stemGod = (position, tenGod) => ({ kind: 'stem_ten_god', position, tenGod });
const mainGod = (position, tenGod) => ({ kind: 'branch_main_ten_god', position, tenGod });
const singleKilling = { kind: 'bazi_ten_god_count', tenGod: '七杀', count: 1 };
const positions = { 年: 'year', 月: 'month', 时: 'hour' };

// Hashes pin each reviewed heading to the local source, its terms and its text.
const reviewed = new Map([
  [29, '2b0d40e9966dbe3cbd91370a115d83e6e3c34a71ef1699fcce3632eafe41e922'],
  [30, '41bee32ba3345cd2afc8b44c6c3354ce63fd895b12be83794914ceb090863238'],
  [31, '1addf49f065074907867c02ad66175b9f07b533082f5bcb82888441647696cbd'],
  [32, '706c0a2fca5c782244972f2b5fd2cfcf5617459408bd32a54538372d814dbc5f'],
  [33, '3a91cdf48836b7d9dac67be0250a4f217022f5edbcb8b45b5af33ca44ed19c0b'],
  [35, '378f03a67069d7d80c59a5f20a75ffa6057a16f6d4d23177335fcfbc2ffc4ef4'],
  [36, 'aba4aff327301453e9be541d19a56172883bed96d6e5f27c739db444ceac2e2d'],
  [37, '98884675d80541a2bcc7b3e3749af3d5c4d9ebe0032d97990771a43a22601214'],
  [40, 'f2811e52751bb44dee9f15829b9ade70833a2db8391bde8680b8650b0ca3bf2b'],
  [41, '60256ef1e6f5c20ec96a562e3572e92b77ded4fc58a76845e974d50db8990c52'],
  [42, '6b0f85f7bd17f2286c213300fa8eb11c8a5ad25820166e05e858086d7e094d03'],
  [43, '7f427e9a28ce686c12b4863eba420d32b4f9a083ceb87a911f7b1fc1e94fd1cb'],
  [45, '785e879ade6411b0a99fa27846faa3f22151e6f347606af2bd98744793c6066b'],
  [46, '3e62ab7d4db6eef1e4cc497820586e9a36f58eca6a1318dd0b8d073fc0fc3eff'],
  [47, '590dadd9f4661d01cb08d453b5fe65888a9fb907fb3e1744673de77d01cf074c'],
  [48, '74d5ef08c68200d6a4a1702168d5573889a5b5eb4d656484e0145e76f1afcb48'],
  [51, '89b1d4acb07b6f4150a542fe9bd5d5f1102b1508901874c7d252f9a7b16f8093'],
  [52, '8875b5b6597ab06c12523843bca89449c8a3df07422183953c1156387b838b87'],
  [53, '5a21ce1425f48253f8746f11755f87f200efb042042a2128d805d21ce0b2e233'],
  [54, 'a3f276468a00a891d07a00e7cfffbc910254abcfecbaa6f54814b2be299f738e'],
  [55, 'ee933e299be32de8b5b68efbaef1b72195236f68caf75ed5c051b6c267fc49da'],
  [56, '0be850cab46ce0682c02f14b7948566b4bd62c9f0770d1ae5cbd7d8429e8ae71'],
  [58, '37d6809572681106dc56f5dc9111319a5eef444aa0b57b65d068ff9de7c63991'],
  [59, '97c2abed7a440d895ef5e8bf2c6ba70328f3df14fc7531ad7e544efc961dc5cf'],
  [62, 'db61227ab127fa2f67e7bcddde40c6cf4fc8d4faa567fda607721e39cb841948'],
  [64, 'dd211d3e21c03d0674aaf10a011638a3dcaa72b28d3387b15658041735f9a817'],
  [65, '52a6b58b20ff39eda621dde8bdeeea9596cbfd8e67a8b2426724df7d5cf24c96'],
  [67, 'ae94d4c19ffba505f7a19f7e2cbb17da8232b235cb2348ed3a197b298efffffc'],
  [68, '78b095f47ad88c5dee2b46405b6bb1f77775ab82fe289a4b4695efaed657ea7c'],
  [69, 'dd73e488ae3d45d533b3d4939994bdc051cc82a3aeaf8b88bf01173faf7fed97'],
  [70, '74bdf2fcc23bcd308749d23e4cfa0d0ad63c27dacc33c8e481c46075fe18d132'],
  [75, 'f0f98384a3079b7f57cb2137c8900222bf5130005e3ccf20fe8040d713c721b7'],
  [76, '26e892cec6a9881ce44553ce184197bc02c04499070c26c45969550fbdb2bef5'],
  [77, '5e8086a9c347cda97f00d3fb72761a1f50390c9dd5fe40ae6e01ce81c6fcaaf9'],
  [80, 'df1bdca11956df12cd9d90be3eb8c0cd62cf239c8d209946526365cc2d25422c'],
]);

function reviewedPlacements(text) {
  if (text === '日坐独杀') return [{ required: [mainGod('day', '七杀'), singleKilling] }];
  if (text === '时上七杀') return [{
    required: [stemGod('hour', '七杀'), singleKilling],
    mustBeAbsent: [{ kind: 'branch_ten_god', position: 'hour', tenGod: '七杀' }],
  }];
  if (text === '时支逢伤官') return [{ required: [mainGod('hour', '伤官')] }];
  const day = /^日带(.+)$/u.exec(text);
  if (day) return [{ required: [mainGod('day', day[1])] }];
  const placement = /^([年月时])上([\p{Script=Han}]+)(?:（天干）)?(?:\s*\+\s*年支([\p{Script=Han}]+))?$/u.exec(text);
  if (!placement) throw new Error('Unrecognized reviewed Blind School placement: ' + text);
  const [, column, tenGod, yearBranchGod] = placement;
  return (tenGod === '比劫' ? ['比肩', '劫财'] : [tenGod]).map(god => ({
    required: [stemGod(positions[column], god), ...(yearBranchGod ? [mainGod('year', yearBranchGod)] : [])],
  }));
}

export function compileBlindPalace(claim) {
  const id = /^muxuan-v1-f002-p000(\d{2})-001$/u.exec(claim.id);
  if (!id || !reviewed.has(Number(id[1]))) return undefined;
  const { source, conditions, evidence } = claim;
  const hash = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  const text = conditions.match?.selector?.text;
  if (hash !== reviewed.get(Number(id[1])) || !evidence.original_text.startsWith('- ' + text + '：')) {
    return { reason: 'source_review_required', reviewNote: '已核盲派宫星条目的来源、原文或条件有变化，须重新核对。' };
  }
  const inputs = reviewedPlacements(text).map(group => normalizeRuleInput('bazi', group));
  return {
    reason: 'unmapped_condition', condition: '按资料包核对柱位、透干和地支本气。宫合及后续取象另行核查。',
    branches: [{ text, conditionCompiler: blindPalaceProfile, inputs }],
  };
}

const coordinates = ['pillar', 'stem', 'branch'];
const tenGodPlacements = ['stem_ten_god', 'branch_main_ten_god', 'branch_ten_god', 'hidden_ten_god'];

export function confirmedBlindPalacePlacement(chart, input) {
  const occupied = new Set(['day', ...[...input.required, ...input.mustBeAbsent]
    .filter(fact => tenGodPlacements.includes(fact.kind)).map(fact => fact.position)]);
  const facts = chart.present.filter(fact => coordinates.includes(fact.kind)
    || occupied.has(fact.position) && tenGodPlacements.includes(fact.kind));
  return [...occupied].every(position => facts.some(fact => fact.kind === 'pillar' && fact.position === position))
    && compatibleBaZiLiteralFacts(facts, input.mustBeAbsent);
}
