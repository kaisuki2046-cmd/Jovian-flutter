// This is the placement table in 卷二「一 命宫」, not the later poems
// (which sometimes give different levels), and not iztro's brightness table.
export const quanshuMinggongProfile = 'quanshu-v2-minggong-table-1963110';
export const quanshuMinggongSource = 'https://zh.wikisource.org/w/index.php?title=紫微斗數全書/卷二&oldid=1963110#一_命宫';
const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
const palaces = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
const rows = [
  ['紫微', '102', [['午', '庙'], ['寅申巳亥', '旺'], ['辰戌', '得'], ['丑未', '庙']]],
  ['天机', '110', [['子午', '庙'], ['卯酉', '旺'], ['寅申', '得'], ['巳亥', '平'], ['辰戌', '利'], ['丑未', '陷']]],
  ['太阳', '118', [['子丑亥戌', '陷'], ['午寅巳辰', '旺'], ['卯', '庙'], ['酉', '平'], ['申未', '得']]],
  ['武曲', '126', [['子午', '旺'], ['卯酉', '利'], ['寅申', '得'], ['巳亥', '平'], ['辰戌丑未', '庙']]],
  ['天同', '134', [['子申', '旺'], ['午', '陷'], ['卯酉辰戌', '平'], ['寅', '利'], ['巳亥', '庙'], ['丑未', '不']]],
  ['廉贞', '142', [['子午卯酉寅', '平'], ['申', '庙'], ['巳亥', '陷'], ['辰戌丑未', '利']]],
  ['天府', '150', [['卯寅辰戌丑未', '庙'], ['酉', '旺'], ['申巳亥', '得']]],
  ['太阴', '158', [['子丑寅酉戌亥', '庙'], ['卯辰巳午', '陷'], ['未申', '利']]],
  ['贪狼', '166', [['子午', '旺'], ['卯酉', '利'], ['寅申', '平'], ['巳亥', '陷'], ['辰戌丑未', '庙']]],
  ['巨门', '175', [['子午巳亥', '旺'], ['卯酉寅申', '庙'], ['辰戌', '平'], ['丑未', '不']]],
  ['天相', '184', [['子午丑寅申', '庙'], ['卯酉', '陷'], ['辰戌未巳亥', '得']]],
  ['天梁', '193', [['子午卯辰戌丑未寅', '庙'], ['酉', '得'], ['申', '陷']]],
  ['七杀', '199', [['子午卯酉', '旺'], ['辰戌丑未寅申', '庙'], ['巳亥', '平']]],
  ['破军', '207', [['子午', '庙'], ['卯酉', '陷'], ['辰戌丑未', '旺'], ['寅申', '得']]],
  ['文昌', '215', [['寅午戌申子辰', '得'], ['巳酉丑', '庙'], ['亥卯未', '利']]],
  ['文曲', '223', [['寅', '平'], ['午戌', '陷'], ['申子辰', '得'], ['巳酉丑', '庙'], ['亥卯未', '旺']]],
];
export const quanshuMinggongStars = Object.freeze(rows.map(([star]) => star));
const passageStars = new Map(rows.map(([star, page]) => [`ziwei-v2-minggong-p${page}000`, star]));
const table = new Map(rows.map(([star, , groups]) => {
  const cells = new Map();
  for (const [positions, brightness] of groups) for (const branch of positions) {
    if (cells.has(branch) || !branches.includes(branch)) throw new Error('Conflicting Quanshu brightness cell.');
    cells.set(branch, brightness);
  }
  return [star, cells];
}));

export function quanshuMinggongBrightness(star, branch) {
  // Nine cells are unspecified. Do not borrow values from another edition,
  // another chapter, the poems, or the current software table.
  return table.get(star)?.get(branch) ?? null;
}

export function quanshuMinggongStar(claim) {
  const source = claim.source;
  return source?.book === '紫微斗数全书' && source.volume === '卷二' && source.chapter === '一 命宫'
    && /[?&]oldid=1963110(?:&|#|$)/u.test(source.url ?? '') ? passageStars.get(source.passage_id) ?? null : null;
}

function sourceFact(star, branch, brightness) {
  return { kind: 'palace_source_brightness', palace: '命宫', star, branch, scope: 'origin', brightness, profile: quanshuMinggongProfile };
}

export function quanshuMinggongFacts(facts, scope = 'natal') {
  if (scope !== 'natal') return [];
  const locations = new Set(facts.filter(fact => fact.kind === 'palace_branch' && fact.palace === '命宫').map(fact => fact.branch));
  if (locations.size !== 1) return [];
  const [branch] = locations;
  if (!branches.includes(branch) || facts.some(fact => fact.kind === 'palace_branch'
    && palaces.includes(fact.palace) && fact.palace !== '命宫' && fact.branch === branch)) return [];
  const stars = new Map();
  for (const fact of facts) if (fact.kind === 'palace_star' && fact.scope === 'origin' && quanshuMinggongStars.includes(fact.star)) {
    if (!stars.has(fact.star)) stars.set(fact.star, new Set());
    stars.get(fact.star).add(fact.palace);
  }
  return [...stars].flatMap(([star, places]) => {
    const brightness = quanshuMinggongBrightness(star, branch);
    return brightness && places.size === 1 && places.has('命宫') ? [sourceFact(star, branch, brightness)] : [];
  });
}

export function quanshuMinggongRequirements(claim, facts, primaryOnly = false) {
  const star = quanshuMinggongStar(claim);
  if (!star || !facts.some(fact => fact.kind === 'palace_star' && fact.palace === '命宫' && fact.star === star && fact.scope === 'origin')) return facts;
  const locations = new Set(facts.filter(fact => fact.kind === 'palace_branch' && fact.palace === '命宫').map(fact => fact.branch));
  if (locations.size !== 1) return facts;
  const [branch] = locations;
  const brightness = quanshuMinggongBrightness(star, branch);
  if (!brightness) return facts;
  const declared = facts.filter(fact => fact.kind === 'palace_brightness' && fact.palace === '命宫' && fact.star === star && fact.scope === 'origin');
  const result = facts.filter(fact => !declared.includes(fact)
    && !(primaryOnly && declared.length && fact.kind === 'palace_brightness' && fact.star !== star && fact.palace === '命宫'));
  if (!result.some(fact => fact.kind === 'palace_source_brightness' && fact.star === star && fact.branch === branch)) {
    result.push(...(declared.length ? declared.map(fact => sourceFact(star, branch, fact.brightness)) : [sourceFact(star, branch, brightness)]));
  }
  return result;
}

export function quanshuMinggongQualifier(claim, text, anchors) {
  const star = quanshuMinggongStar(claim);
  const selected = /^按(?:本篇|原篇|本句)为(入庙|庙|旺|陷|不得地|得地|利益|和平)$/u.exec(text);
  if (!star || !selected) return null;
  const level = { 入庙: '庙', 庙: '庙', 旺: '旺', 陷: '陷', 不得地: '不', 得地: '得', 利益: '利', 和平: '平' }[selected[1]];
  return anchors.flatMap(facts => {
    const branch = facts.find(fact => fact.kind === 'palace_branch' && fact.palace === '命宫')?.branch;
    if (!facts.some(fact => fact.kind === 'palace_star' && fact.star === star && fact.palace === '命宫' && fact.scope === 'origin')
      || quanshuMinggongBrightness(star, branch) !== level) return [];
    return [[...quanshuMinggongRequirements(claim, facts), sourceFact(star, branch, level)]];
  });
}
