import { createHash } from 'node:crypto';
import { earthlyBranches } from './dictionaries.mjs';
import { normalizeRuleInput } from './matching.mjs';

export const ziweiSoloSourceProfile = 'ziwei-solo-source-v1';
export const ziweiSoloSectorExclusions = ['左辅', '右弼'];
const bodySeatsOutsideLife = ['夫妻', '财帛', '迁移', '官禄', '福德'];

const reviewed = new Map([
  ['ziwei-v2-jielan-101-p013-027', {
    hash: '21f2109214bb0e83db60eb41df0f267a2eb1b21740392a85a4f7bc430b2a4d84',
    palace: '子女', star: '太阴', branch: '卯',
  }],
  ['ziwei-v2-minggong-p242001-003', {
    hash: '46c082defe1ba4473644b89af862929e7df9bea3adf325885174151b43fae011',
    palace: '命宫', bodySeats: bodySeatsOutsideLife, star: '禄存', text: '单守命身，看财之奴',
  }],
  ['ziwei-v2-xingjue-014-p343-001', {
    hash: '4e309e7dc255a7224f3051ffe22814f3be88b497655ff2c10ac6c4d80744f787',
    palace: '官禄', star: '天相', companion: '天马',
  }],
  ['ziwei-v2-xingjue-016-p362-001', {
    hash: '20282916ff4757b30053b4a8bdff2d9ceb1ea23760b2b152a0e1bcafcb5acf74',
    // 火星 at 辰 requires 丑、寅、卯 or 未 hour in the natal engine.
    palace: '命宫', bodySeats: ['福德', '官禄', '迁移'], star: '破军', branch: '子', linked: [['辰', ['贪狼', '火星']]],
  }],
  ['ziwei-v3-xingjue-049-p616-001', {
    hash: '4bf5855f96d12f45db0379c862c2cc6c172d8917da28b1782e8c5390bbf8ce2e',
    palace: '夫妻', star: '太阴', branch: '巳', attending: ['文曲'],
  }],
  ['ziwei-v3-xingjue-050-p644-001', {
    hash: '5814fa2970b7f94124efe15cf00fb21d56d9bdb0c79e346dd8edcdf98343a3fb',
    palace: '子女', star: '天同', branch: '辰', text: '辰地子宮天同單守者、天同主五子',
  }],
  ['ziwei-v3-xingjue-051-p657-001', {
    hash: 'aaed9e892b7ffc16c669e721570dbe800a482eaa4b75326fdd2cfd602820f8c3',
    palace: '财帛', star: '七杀', branch: '午', text: '午地財七殺單守者財富',
  }],
  ['ziwei-v3-xingjue-053-p695-001', {
    hash: '9b7ef9873030ded7b376d435e19f493ea30ed8bc924fd5a437a33bcc6a0a2451',
    palace: '迁移', star: '贪狼', levels: ['旺'],
  }],
  ['ziwei-v3-xingjue-055-p716-001', {
    hash: 'c96a68924dd099aa520438b8f0f80d107c0d5f2a6c315911fa10ce9cc7d36ccc',
    palace: '官禄', star: '天相', attending: ['紫微', '天府', '左辅', '右弼', '天魁', '天钺'],
  }],
  ['ziwei-v3-xingjue-056-p737-001', {
    hash: 'fc2cb4f76a91b28be3fbfec2501761472d3323df1d0f57a1af6293da9c6c9a54',
    palace: '田宅', star: '天府', text: '天府單守田宮最吉',
  }],
  ['ziwei-v3-xingjue-056-p744-001', {
    hash: 'e7593813279555aafd055e280d55f1e851fcfc306634af77807f7300ce4f985c',
    palace: '田宅', star: '天相', branch: '巳', linked: [['亥', ['武曲']], ['丑', ['天府']]],
    text: '巳田天相單守、與亥地武曲、丑地天府相會合、田宅旺盛',
  }],
  ['ziwei-v3-xingjue-056-p816-001', {
    hash: '9f4c0220ce9177b876eaa150d89d9de4099d26e34443c09b285093169b44784c',
    palace: '田宅', star: '贪狼', change: '忌',
  }],
  ['ziwei-v2-xingjue-004-p1063-001', {
    hash: 'aa839941a5d62c900d9700a2e1947907cb4f8bcba51b0936b2edab13e2434044',
    palace: '命宫', star: '天府', attending: ['武曲', '七杀', '天相', '天魁', '天钺'],
  }],
  ['ziwei-v2-xingjue-004-p1065-001', {
    hash: '3edb1e664f5b2914dc5336b3c4b1707fe7749c3ea068d4bedf23f44e0042155e',
    palace: '命宫', star: '紫微', excludeSupport: true, text: '紫微單守不得輔弼者為孤君、平生少助、親戚不和、出無朋友',
  }],
]);

export function compileZiweiSoloSources(claim, soloZiweiFacts, palaceSectors) {
  const spec = reviewed.get(claim.id);
  if (!spec) return undefined;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  if (digest !== spec.hash) return { reason: 'source_review_required', reviewNote: '独守、同宫及会曜所据原文或条件已变，须重新核对。' };

  const { palace, bodySeats, star, levels, branch, companion, change, attending = [], linked = [], excludeSupport, text } = spec;
  const placements = soloZiweiFacts(star, palace, levels, branch);
  // The 命宫 branch already covers 身宫 when both occupy the same seat.
  if (bodySeats) placements.push(...soloZiweiFacts(star, '身宫', levels, branch)
    .filter(([{ palace }]) => bodySeats.includes(palace)));
  const inputs = placements.map(facts => {
    const [{ palace }] = facts;
    const sectorStar = star => ({ kind: 'palace_sector_star', palace, star });
    const required = [...facts, ...attending.map(sectorStar)];
    if (companion) required.push({ kind: 'palace_star', palace, star: companion, scope: 'origin' });
    if (change) required.push({ kind: 'star_mutagen', palace, star, change, scope: 'origin' });
    for (const [position, stars] of linked) {
      const offset = earthlyBranches.indexOf(branch) - earthlyBranches.indexOf(position);
      const [target] = palaceSectors(palace, [offset]);
      const relation = Math.abs(offset) === 6 ? 'opposite' : 'trine';
      required.push({ kind: 'palace_branch', palace: target, branch: position }, { kind: 'palace_relation', anchor: palace, target, relation },
        ...stars.map(star => ({ kind: 'palace_star', palace: target, star, scope: 'origin' })));
    }
    const mustBeAbsent = excludeSupport ? ziweiSoloSectorExclusions.map(sectorStar) : [];
    return normalizeRuleInput('ziwei', { required, mustBeAbsent });
  });
  if (!text) return { compiler: ziweiSoloSourceProfile, inputs };
  return { reason: 'unmapped_condition', condition: '独守原句按已核分句匹配', branches: [{ text, conditionCompiler: ziweiSoloSourceProfile, inputs }] };
}
