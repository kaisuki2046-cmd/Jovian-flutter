import { chartVersions } from '../../control/charts.ts';

export const ziweiRelativeProfile = 'iztro-2.6.5-relative-palaces-v1';
export const ziweiRelativePalaces = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
const mod = n => (n % 12 + 12) % 12;
const purple = { 紫微: 0, 天机: -1, 太阳: -3, 武曲: -4, 天同: -5, 廉贞: -8 };
const treasury = { 天府: 0, 太阴: 1, 贪狼: 2, 巨门: 3, 天相: 4, 天梁: 5, 七杀: 6, 破军: 10 };

// Compiler feasibility check for the CURRENT default chart, not a new ancient
// star tradition. iztro 2.6.5 star/majorStar.js fixes two star-group offsets;
// star/location.js makes the Tianfu branch 4 - Ziwei branch (子 = 0).
// astro/palace.js has body - life = 2 * hour, so only six body palaces exist.
// Birth dates still supply the actual layout at query time. This finite check
// may disprove a conjunction but never creates a positive chart fact.
export function ziweiMajorLayout(purpleBranch) {
  if (!branches.includes(purpleBranch)) throw new TypeError('Invalid Ziwei branch.');
  const z = branches.indexOf(purpleBranch);
  return Object.fromEntries([...Object.entries(purple).map(([star, offset]) => [star, branches[mod(z + offset)]]),
    ...Object.entries(treasury).map(([star, offset]) => [star, branches[mod(4 - z + offset)]])]);
}

export function compatibleZiweiRelativeFacts(facts) {
  if (chartVersions.ziwei.engineVersion !== '2.6.5'
    || chartVersions.ziwei.rulesetVersion !== 'standard-new-year-leap-split-late-zi-current-v1') {
    throw new Error('Review Ziwei relative compatibility profile after an engine change.');
  }
  const bodySites = new Set(facts.filter(f => f.kind === 'body_palace').map(f => f.palace));
  if (bodySites.size > 1 || [...bodySites].some(palace => ziweiRelativePalaces.indexOf(palace) % 2 !== 0)) return false;
  return branches.some(purpleBranch => {
    const layout = ziweiMajorLayout(purpleBranch);
    return branches.some((_, life) => facts.every(fact => {
      const at = palace => branches[mod(life - ziweiRelativePalaces.indexOf(palace))];
      if (fact.kind === 'palace_branch') return ziweiRelativePalaces.includes(fact.palace) && at(fact.palace) === fact.branch;
      if (fact.kind === 'palace_star' && Object.hasOwn(layout, fact.star)) return ziweiRelativePalaces.includes(fact.palace) && layout[fact.star] === at(fact.palace);
      if (fact.kind === 'palace_relation') {
        const distance = mod(ziweiRelativePalaces.indexOf(fact.target) - ziweiRelativePalaces.indexOf(fact.anchor));
        return { adjacent: [1, 11], trine: [4, 8], opposite: [6] }[fact.relation]?.includes(distance) ?? false;
      }
      return true;
    }));
  });
}

export const hasZiweiRelativeSyntax = claim => claim.conditions.normalized.some(text =>
  /(?:身宫或命宫(?:逢|见|遇)|同宫或对宫|合于.+?宫|分夹.+?宫|构成.+?宫之夹|位在.+?前后相夹|夹(?:财帛|夫妻|子女|子息|官禄|迁移|田宅|福德|父母|兄弟|疾厄|仆役)宫)/u.test(text));
