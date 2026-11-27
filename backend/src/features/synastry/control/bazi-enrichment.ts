import { LunarUtil } from 'lunar-javascript';
import type { ChartFacts, Evidence } from '../model/comparison';
import { branchOppositions, branchUnions, compareBaZiDetails, groups, knownHiddenStems, pillarLabels, stemPairs, strengthContext } from './bazi-facts';

const stems = '甲乙丙丁戊己庚辛壬癸';
const elements = ['木', '火', '土', '金', '水'];
const yearAnimals = [...'鼠牛虎兔龙蛇马羊猴鸡狗猪']; // 子至亥，与现有农历库生肖顺序一致。
type BaZi = Exclude<ChartFacts['bazi'], { status: 'unavailable' }>;

function natal(chart: BaZi, person: 'A' | 'B'): Evidence[] {
  const evidence: Evidence[] = [];
  const direction = person === 'A' ? 'self_a' : 'self_b';
  const context = strengthContext(chart);
  const confirmedHidden = chart.pillars.flatMap(knownHiddenStems);
  const dayStem = chart.pillars.find(({ position }) => position === 'day')?.stem;
  const year = chart.pillars.find(({ position }) => position === 'year');
  const nayin = year?.stem && year.branch ? LunarUtil.NAYIN[year.stem + year.branch] : undefined;
  if (year?.stem && year.branch && nayin) {
    const branchIndex = '子丑寅卯辰巳午未申酉戌亥'.indexOf(year.branch);
    if (year.branch.length === 1 && branchIndex >= 0) evidence.push({ rule: 'bazi-year-symbols', direction,
      sources: [`${person} 年柱 ${year.stem}${year.branch}`, `${person} 年柱查表`],
      observation: '年支生肖与年柱纳音分别查表，只作为年柱信息',
      facts: { person, yearStem: year.stem, yearBranch: year.branch, animal: yearAnimals[branchIndex],
        nayin, nayinElement: nayin.slice(-1), tableVersion: 'lunar-javascript-1.7.8-nayin' } });
  }
  for (const pillar of chart.pillars) {
    if (!pillar.stem || !pillar.branch) continue;
    const sources = [`${person} ${pillarLabels[pillar.position]} ${pillar.stem}${pillar.branch}`, `${person} 本命`] as const;
    const hidden = knownHiddenStems(pillar);
    evidence.push({ rule: 'bazi-natal-pillar', direction, sources, observation: '本人四柱与藏干',
      facts: { person, position: pillar.position, stem: pillar.stem, branch: pillar.branch,
        hiddenStems: hidden.map(({ stem }) => stem).join(''), ...(dayStem ? { dayStem } : {}) } });
    if (!dayStem) continue;
    const symbols = [{ observed: pillar.stem, layer: 'visible', rank: 0 },
      ...hidden.map(({ stem: observed, rank }) => ({ observed, layer: 'hidden', rank }))];
    for (const { observed, layer, rank } of symbols) {
      const label = LunarUtil.SHI_SHEN[dayStem + observed];
      if (label) evidence.push({ rule: 'bazi-natal-ten-god', direction, sources, observation: '本人日干参照十神',
        facts: { person, position: pillar.position, observed, reference: dayStem, label, layer, rank } });
    }
  }
  for (const [index, element] of elements.entries()) {
    const sameElement = (stem: string | null) => typeof stem === 'string' && stems.indexOf(stem) >= 0
      && Math.floor(stems.indexOf(stem) / 2) === index;
    evidence.push({ rule: 'bazi-natal-element-count', direction, sources: [`${person} 透干`, `${person} 藏干`],
      observation: `${element}的透干与藏干分开计数`,
      facts: { person, element, visibleCount: chart.pillars.filter(({ stem }) => sameElement(stem)).length,
        hiddenCount: confirmedHidden.filter(({ stem }) => sameElement(stem)).length,
        hiddenComplete: Number(context !== null) } });
  }
  const pillars = chart.pillars;
  for (let left = 0; left < pillars.length; left++) {
    for (let right = left + 1; right < pillars.length; right++) {
      const contacts = compareBaZiDetails({ ...chart, pillars: [pillars[left]] }, { ...chart, pillars: [pillars[right]] }).evidence;
      const aBranch = pillars[left].branch;
      const bBranch = pillars[right].branch;
      if (aBranch && bBranch && aBranch !== bBranch) {
        for (const [rule, pairs, observation] of [
          ['branch-union', branchUnions, '本人地支六合'],
          ['branch-opposition', branchOppositions, '本人地支六冲'],
        ] as const) {
          if (pairs.some((pair) => pair.includes(aBranch) && pair.includes(bBranch))) {
            contacts.push({ rule, direction: 'mutual', sources: ['', ''], observation,
              facts: { aPosition: pillars[left].position, bPosition: pillars[right].position, aBranch, bBranch } });
          }
        }
      }
      for (const item of contacts.filter(({ rule }) => rule.startsWith('stem-') || rule.startsWith('branch-'))) {
        evidence.push({ rule: 'bazi-natal-contact', direction,
          sources: [`${person} ${pillarLabels[pillars[left].position]}`, `${person} ${pillarLabels[pillars[right].position]}`],
          observation: item.observation, facts: { person, contactRule: item.rule, contactDirection: item.direction,
            detail: JSON.stringify(item.facts) } });
      }
    }
  }
  for (const { kind, branches } of groups) {
    if (![...branches].every((branch) => pillars.some((pillar) => pillar.branch === branch))) continue;
    const members = pillars.filter(({ branch }) => branch && branches.includes(branch));
    evidence.push({ rule: 'bazi-natal-contact', direction,
      sources: [`${person} ${members.map(({ position, branch }) => pillarLabels[position] + branch).join('、')}`, `${person} 原局`],
      observation: `本人原局${kind}成员齐全`,
      facts: { person, contactRule: 'branch-group', contactDirection: 'mutual',
        detail: JSON.stringify({ kind, combination: branches, members: members.map(({ position, branch }) => ({ position, branch })) }) } });
  }
  if (context) evidence.push({ rule: 'bazi-natal-strength-context', direction, sources: [`${person} 月令`, `${person} 根气与透干`],
    observation: '本人日主强弱观察条件', facts: { person, ...context } });
  return evidence;
}

export function enrichBaZi(a: ChartFacts['bazi'], b: ChartFacts['bazi']): Evidence[] {
  const evidence = [
    ...(a.status !== 'unavailable' ? natal(a, 'A') : []),
    ...(b.status !== 'unavailable' ? natal(b, 'B') : []),
  ];
  if (a.status === 'unavailable' || b.status === 'unavailable' || a.rulesetVersion !== b.rulesetVersion) return evidence;
  for (const [source, target, person] of [[a, b, 'A'], [b, a, 'B']] as const) {
    const day = source.pillars.find(({ position }) => position === 'day');
    const year = target.pillars.find(({ position }) => position === 'year');
    if (!day?.stem || !day.branch || !year?.stem || !year.branch) continue;
    const label = LunarUtil.SHI_SHEN[year.stem + day.stem];
    if (!label) continue;
    evidence.push({ rule: 'bazi-day-to-year', direction: person === 'A' ? 'a_to_b' : 'b_to_a',
      sources: [`${person} 日柱 ${day.stem}${day.branch}`, `${person === 'A' ? 'B' : 'A'} 年柱 ${year.stem}${year.branch}`],
      observation: '一方日柱对另一方年柱，明干十神以接收方年干为参照',
      facts: { observed: day.stem, reference: year.stem, sourceBranch: day.branch, targetBranch: year.branch,
        sourcePosition: 'day', targetPosition: 'year', label, sourceHiddenStems: knownHiddenStems(day).map(({ stem }) => stem).join(''),
        targetHiddenStems: knownHiddenStems(year).map(({ stem }) => stem).join('') } });
  }
  const nodes = ([['A', a], ['B', b]] as const).flatMap(([person, chart]) =>
    chart.pillars.map(({ position, stem, branch }) => ({ person, position, stem, branch })));
  const completeBranches = [a, b].every(({ pillars }) => pillars.length === 4 && pillars.every(({ branch }) => branch));
  for (const { branches: group, element } of groups.filter(({ kind }) => kind === '三合')) {
    if (!completeBranches) continue;
    const missingBranch = group[1];
    if (nodes.some(({ branch }) => branch === missingBranch)) continue;
    const members = nodes.filter(({ branch }) => branch && [group[0], group[2]].includes(branch));
    if (![group[0], group[2]].every((branch) => members.some((node) => node.branch === branch))
      || !['A', 'B'].every((person) => members.some((node) => node.person === person))) continue;
    const alsoNatal = ['A', 'B'].some((person) =>
      [group[0], group[2]].every((branch) => members.some((node) => node.person === person && node.branch === branch)));
    evidence.push({ rule: 'bazi-branch-arch', direction: 'mutual',
      sources: ['A ' + members.filter(({ person }) => person === 'A').map(({ position, branch }) => pillarLabels[position] + branch).join('、'),
        'B ' + members.filter(({ person }) => person === 'B').map(({ position, branch }) => pillarLabels[position] + branch).join('、')],
      observation: `缺${missingBranch}的拱合候选`,
      facts: { combination: group[0] + group[2], missingBranch, element,
        aBranches: members.filter(({ person }) => person === 'A').map(({ branch }) => branch).join(''),
        bBranches: members.filter(({ person }) => person === 'B').map(({ branch }) => branch).join(''),
        formation: alsoNatal ? 'also_natal' : 'cross_only' } });
  }
  for (const pair of stemPairs) {
    for (const stem of pair) {
      const partner = pair[0] === stem ? pair[1] : pair[0];
      const targets = nodes.filter((node) => node.stem === stem);
      const candidates = nodes.filter((node) => node.stem === partner);
      if (!targets.length || candidates.length < 2
        || !['A', 'B'].every((person) => [...targets, ...candidates].some((node) => node.person === person))) continue;
      evidence.push({ rule: 'bazi-stem-competition', direction: 'mutual', sources: [`五合对象 ${stem}`, `多个候选 ${partner}`],
        observation: '天干五合多个候选接触',
        facts: { stem, partner, candidateCount: candidates.length,
          members: [...targets, ...candidates].map((node) => `${node.person}:${node.position}:${node.stem}`).join('|') } });
    }
  }
  return evidence;
}
