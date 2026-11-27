import { LunarUtil } from 'lunar-javascript';
import type { DestinyChartSnapshot } from '../../destiny';
import { lunarAtBeijing } from './fortune-calendar';
import { nextSolarBoundary, type NatalDay } from './fortune-preview';

const version = 'fortune-bazi-layers-beijing-sect2-v2';
const hourMs = 3_600_000;
const dayMs = 24 * hourMs;
const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';
const positions = ['year', 'month', 'day', 'hour'] as const;
type Layer = typeof positions[number];
type Pillars = Partial<Record<Layer, string>>;
type Natal = DestinyChartSnapshot['bazi']['rawResult'][number];
type Window = { start: number; end: number };
type Interval = Window & { pillar: string; boundary?: string };
type StageYear = {
  getYear(): number; getAge(): number; getGanZhi(): string;
  getLiuYue(): { getGanZhi(): string }[];
};
type Stage = {
  getIndex(): number; getGanZhi(): string; getStartYear(): number; getEndYear(): number;
  getStartAge(): number; getEndAge(): number; getLiuNian(): StageYear[];
};
type Yun = {
  isForward(): boolean; getStartYear(): number; getStartMonth(): number; getStartDay(): number; getStartHour(): number;
  getStartSolar(): { toYmdHms(): string; nextYear(year: number): { toYmdHms(): string } };
  getDaYun(count: number): Stage[];
};
const util = LunarUtil as typeof LunarUtil & {
  NAYIN: Record<string, string>; WU_XING_GAN: Record<string, string>; WU_XING_ZHI: Record<string, string>;
  JIA_ZI: string[]; CHANG_SHENG: string[]; CHANG_SHENG_OFFSET: Record<string, number>;
  getXun(pillar: string): string;
};

const stemCombinations = ['甲己', '乙庚', '丙辛', '丁壬', '戊癸'];
const stemPairs = [
  { kind: '天干五合', pairs: stemCombinations },
  { kind: '天干四冲', pairs: ['甲庚', '乙辛', '丙壬', '丁癸'] },
];
const liuHeBranches = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'];
const branchPairs = [
  { kind: '六合', pairs: liuHeBranches },
  { kind: '六冲', pairs: ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'] },
  { kind: '六害', pairs: ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'] },
  { kind: '六破', pairs: ['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌'] },
  { kind: '相刑', pairs: ['子卯', '寅巳', '巳申', '申寅', '丑戌', '戌未', '未丑', '辰辰', '午午', '酉酉', '亥亥'] },
];
const branchGroups = [
  { kind: '三合', groups: ['申子辰', '亥卯未', '寅午戌', '巳酉丑'] },
  { kind: '三会', groups: ['亥子丑', '寅卯辰', '巳午未', '申酉戌'] },
  { kind: '三刑', groups: ['寅巳申', '丑戌未'] },
];
const stemStars = {
  天乙贵人: ['丑未', '子申', '亥酉', '亥酉', '丑未', '子申', '丑未', '寅午', '巳卯', '巳卯'],
  文昌贵人: [...'巳午申酉申酉亥子寅卯'],
};
const groupStars = [
  { branches: '申子辰', 驿马: '寅', 将星: '子', 华盖: '辰', 桃花: '酉' },
  { branches: '寅午戌', 驿马: '申', 将星: '午', 华盖: '戌', 桃花: '卯' },
  { branches: '巳酉丑', 驿马: '亥', 将星: '酉', 华盖: '丑', 桃花: '午' },
  { branches: '亥卯未', 驿马: '巳', 将星: '卯', 华盖: '未', 桃花: '子' },
];

export function smthHorseBranch(yearBranch: string) {
  return groupStars.find(group => group.branches.includes(yearBranch))?.驿马;
}

export function smthCanopyBranch(yearBranch: string) {
  return groupStars.find(group => group.branches.includes(yearBranch))?.华盖;
}

export function baziLiuHePartner(branch: string) {
  if (branch.length !== 1) return undefined;
  return liuHeBranches.find(pair => pair.includes(branch))?.replace(branch, '');
}

const luBranches = '寅卯巳午巳午申酉亥子';

export function smthLuNextBranch(stem: string) {
  if (typeof stem !== 'string' || stem.length !== 1 || !stems.includes(stem)) throw new RangeError('Invalid source stem');
  const luBranch = luBranches[stems.indexOf(stem)];
  return { luBranch, bladeBranch: branches[(branches.indexOf(luBranch) + 1) % 12] };
}

// 卷六〈二德扶身〉所列月德干、合干和使德合受阻的具名忌干。
const moonVirtueRules = [
  { branches: '寅午戌', stem: '丙', partner: '辛', taboo: '壬' },
  { branches: '亥卯未', stem: '甲', partner: '己', taboo: '庚' },
  { branches: '申子辰', stem: '壬', partner: '丁', taboo: '戊' },
  { branches: '巳酉丑', stem: '庚', partner: '乙', taboo: '丙' },
] as const;

export function smthMoonVirtueRule(monthBranch: string) {
  return moonVirtueRules.find(row => monthBranch.length === 1 && row.branches.includes(monthBranch));
}

export function smthMoonVirtueStem(monthBranch: string) {
  return smthMoonVirtueRule(monthBranch)?.stem;
}

const heavenVirtueStems: Record<string, string> = { 寅: '丁', 辰: '壬', 巳: '辛', 未: '甲', 申: '癸', 戌: '丙', 亥: '乙', 丑: '庚' };
// 卷六〈二德扶身〉从寅至丑，实干月列忌干，卦位月列忌支。
const heavenVirtueTaboos = '癸寅戊丁巳庚己申壬辛亥丙';
const heavenVirtueTrigrams: Record<string, { trigram: string; yuanhai: string; kaoyuan: string }> = {
  卯: { trigram: '坤', yuanhai: '申', kaoyuan: '未' }, 午: { trigram: '乾', yuanhai: '亥', kaoyuan: '戌' },
  酉: { trigram: '艮', yuanhai: '寅', kaoyuan: '丑' }, 子: { trigram: '巽', yuanhai: '巳', kaoyuan: '辰' },
};

export function smthHeavenVirtue(monthBranch: string) {
  const trigram = heavenVirtueTrigrams[monthBranch];
  const readings = trigram ? [
    { basis: 'yuanhai', value: trigram.yuanhai },
    { basis: 'kaoyuan', value: trigram.kaoyuan },
  ] as const : [{ basis: 'stem', value: heavenVirtueStems[monthBranch] }] as const;
  return { trigram: trigram?.trigram, readings };
}

export function smthHeavenVirtueTaboo(monthBranch: string) {
  return monthBranch.length === 1 ? heavenVirtueTaboos['寅卯辰巳午未申酉戌亥子丑'.indexOf(monthBranch)] : undefined;
}

export function smthHeavenVirtueStemRule(monthBranch: string) {
  const stem = heavenVirtueStems[monthBranch], taboo = smthHeavenVirtueTaboo(monthBranch);
  const partner = stem && stemCombinations.find(pair => pair.includes(stem))?.replace(stem, '');
  return stem && partner && taboo ? { stem, partner, taboo } : undefined;
}

function flowShenSha(pillars: Pillars, branch: string) {
  const found = new Map<string, ('year' | 'day')[]>();
  function match(name: string, source: 'year' | 'day', targets?: string) {
    if (targets?.includes(branch)) found.set(name, [...(found.get(name) ?? []), source]);
  }
  for (const source of ['year', 'day'] as const) {
    const pillar = pillars[source];
    if (!pillar) continue;
    const stem = stems.indexOf(pillar[0]);
    for (const [name, targets] of Object.entries(stemStars)) match(name, source, targets[stem]);
    match('空亡', source, util.getXunKong(pillar));
    const group = groupStars.find(item => item.branches.includes(pillar[1]));
    if (group) {
      const { branches: _, ...stars } = group;
      for (const [name, targets] of Object.entries(stars)) match(name, source, targets);
    }
    if (source === 'day') match('禄神', source, '寅卯巳午巳午申酉亥子'[stem]);
  }
  return [...found].map(([name, sources]) => ({ name, sources }));
}

export function describeBaZiStem(stem: string, dayStem?: string) {
  return { stem, stemElement: util.WU_XING_GAN[stem], tenGod: dayStem ? util.SHI_SHEN[dayStem + stem] : undefined };
}

const elementOrder = '木火土金水';
const elementalRelations = ['同五行', '前生后', '前克后', '后克前', '后生前'];
function elementDistance(from: string, to: string) {
  return from && to ? (elementOrder.indexOf(to) - elementOrder.indexOf(from) + 5) % 5 : undefined;
}

export function baziElementRelation(from: string, to: string) {
  const distance = elementDistance(from, to);
  return distance === undefined ? undefined : elementalRelations[distance];
}

export function baziStemControls(source: string, target: string) {
  return elementDistance(util.WU_XING_GAN[source], util.WU_XING_GAN[target]) === 2;
}

export function baziStemFeeds(source: string, target: string) {
  return elementDistance(util.WU_XING_GAN[source], util.WU_XING_GAN[target]) === 1;
}

export const smthNaYinBirthBranches: Readonly<Record<string, string>> = { 木: '亥', 火: '寅', 土: '申', 金: '巳', 水: '申' };

export function smthNaYinPhase(element: string, branch: string) {
  const birth = smthNaYinBirthBranches[element];
  const index = branches.indexOf(branch);
  return birth && branch.length === 1 && index >= 0
    ? util.CHANG_SHENG[(index - branches.indexOf(birth) + 12) % 12] : undefined;
}

export function describeBaZiPillar(pillar: string, dayStem?: string) {
  const [stem, branch] = pillar;
  const index = branches.indexOf(branch);
  const phase = dayStem === undefined ? undefined
    : util.CHANG_SHENG[(util.CHANG_SHENG_OFFSET[dayStem] + (stems.indexOf(dayStem) % 2 ? -index : index) + 12) % 12];
  return {
    pillar, ...describeBaZiStem(stem, dayStem), branch, branchElement: util.WU_XING_ZHI[branch],
    naYin: util.NAYIN[pillar], xun: util.getXun(pillar), voidBranches: util.getXunKong(pillar),
    phase,
    hiddenStems: (util.ZHI_HIDE_GAN[branch] ?? []).map(hidden => ({
      stem: hidden, element: util.WU_XING_GAN[hidden], tenGod: dayStem ? util.SHI_SHEN[dayStem + hidden] : undefined,
    })),
  };
}

export function baziNatalVoidSources(natal: { year: string; day: string }, branch: string) {
  return (['year', 'day'] as const).flatMap(basis => {
    const details = describeBaZiPillar(natal[basis]);
    return details.voidBranches.includes(branch) ? [{ basis, xun: details.xun }] : [];
  });
}

type RoleColumn = Layer | 'annual' | 'decadal';
export type BaziColumnRole = { column: RoleColumn; pillar: string; stem: string; element: string; god: string | undefined;
  placement: 'stem' | 'main_qi' | 'other_hidden' };

export function baziColumnRoles(column: RoleColumn, pillar: string, dayMaster: string): BaziColumnRole[] {
  const data = describeBaZiPillar(pillar, dayMaster);
  const coordinates = { column, pillar };
  const hidden = data.hiddenStems.map((row, index): BaziColumnRole => ({ ...coordinates, stem: row.stem, element: row.element,
    god: row.tenGod, placement: index === 0 ? 'main_qi' : 'other_hidden' }));
  if (column === 'day') return hidden;
  return [{ ...coordinates, stem: data.stem, element: data.stemElement, god: data.tenGod, placement: 'stem' }, ...hidden];
}

export function baziInteractions(pillars: { id: string; pillar: string }[]) {
  const pairs: { kind: string; members: string[]; values: string }[] = [];
  const elemental: { part: 'stem' | 'branch'; from: string; to: string; elements: string[]; kind: string }[] = [];
  pillars.forEach((first, index) => {
    for (const second of pillars.slice(index + 1)) {
      for (const [part, rules] of [stemPairs, branchPairs].entries()) {
        const values = first.pillar[part] + second.pillar[part];
        const reverse = second.pillar[part] + first.pillar[part];
        for (const rule of rules) {
          if (rule.pairs.includes(values) || rule.pairs.includes(reverse)) {
            pairs.push({ kind: rule.kind, members: [first.id, second.id], values });
          }
        }
        const elements = part === 0 ? util.WU_XING_GAN : util.WU_XING_ZHI;
        const from = elements[values[0]];
        const to = elements[values[1]];
        const kind = baziElementRelation(from, to);
        if (kind) elemental.push({
          part: part === 0 ? 'stem' : 'branch', from: first.id, to: second.id, elements: [from, to],
          kind,
        });
      }
      if (first.pillar === second.pillar) pairs.push({ kind: '同柱', members: [first.id, second.id], values: first.pillar });
    }
  });
  const groups = branchGroups.flatMap(rule => rule.groups.flatMap(values => {
    const byBranch = [...values].map(branch => pillars.filter(item => item.pillar[1] === branch).map(item => item.id));
    return byBranch.every(matches => matches.length) ? [{ kind: rule.kind, values, byBranch }] : [];
  }));
  return { pairs, groups, elemental };
}

function flowTimelines(window: Window) {
  const year: Interval[] = [];
  const month: Interval[] = [];
  const day: Interval[] = [];
  const hour: Interval[] = [];
  const append = (items: Interval[], start: number, end: number, pillar: string, boundary?: string) => {
    const previous = items.at(-1);
    if (previous?.pillar === pillar) previous.end = end;
    else items.push({ start, end, pillar, boundary });
  };
  let boundary: string | undefined;
  for (let start = window.start; start < window.end;) {
    const next = nextSolarBoundary(start);
    const end = Math.min(window.end, next.time);
    const lunar = lunarAtBeijing(start);
    append(year, start, end, lunar.getYearInGanZhiExact(), boundary);
    append(month, start, end, lunar.getMonthInGanZhiExact(), boundary);
    boundary = next.name;
    start = end;
  }

  const lateZiOffset = 9 * hourMs;
  const dayStart = Math.floor((window.start + lateZiOffset) / dayMs) * dayMs - lateZiOffset;
  for (let at = dayStart; at < window.end; at += dayMs) {
    const pillar = lunarAtBeijing(at).getDayInGanZhiExact();
    append(day, Math.max(at, window.start), Math.min(at + dayMs, window.end), pillar,
      at >= window.start ? '晚子换日' : undefined);
    const firstStem = stems.indexOf(pillar[0]) % 5 * 2;
    for (let branch = 0; branch < 12; branch += 1) {
      const start = Math.max(window.start, at + branch * 2 * hourMs);
      const end = Math.min(window.end, at + (branch + 1) * 2 * hourMs);
      if (start < end) append(hour, start, end, stems[(firstStem + branch) % 10] + branches[branch]);
    }
  }
  return { year, month, day, hour };
}

function buildLuckDirections(natal: Natal) {
  const birthAt = Date.parse(natal.utc);
  if (!Number.isFinite(birthAt)) return [];
  const lunar = lunarAtBeijing(birthAt);
  // The archive has UTC and natal pillars. Beijing provides the absolute Jie reference for this named policy.
  if (lunar.getYearInGanZhiExact() !== natal.year || lunar.getMonthInGanZhiExact() !== natal.month) return [];
  const yunCalculator = lunar as typeof lunar & { getEightChar(): { getYun(gender: number, sect: number): Yun } };
  const hourIndex = util.JIA_ZI.indexOf(natal.hour);
  const directions = ([0, 1] as const).map(gender => {
    const yun = yunCalculator.getEightChar().getYun(gender, 2);
    const forward = yun.isForward();
    const date = yun.getStartSolar();
    const parse = (solar: { toYmdHms(): string }) => Date.parse(solar.toYmdHms().replace(' ', 'T') + '+08:00');
    const stages = yun.getDaYun(13).map(stage => {
      const index = stage.getIndex();
      const pillar = stage.getGanZhi();
      return {
        index, pillar: pillar ? describeBaZiPillar(pillar, natal.day[0]) : null,
        start: index ? parse(date.nextYear((index - 1) * 10)) : birthAt,
        end: parse(date.nextYear(index * 10)),
        engineStartYear: stage.getStartYear(), engineEndYear: stage.getEndYear(),
        startAge: stage.getStartAge(), endAge: stage.getEndAge(),
        years: stage.getLiuNian().map(item => {
          const age = item.getAge();
          const minor = hourIndex < 0 ? undefined : util.JIA_ZI[(hourIndex + (forward ? age : -age) % 60 + 60) % 60];
          return { year: item.getYear(), age, pillar: item.getGanZhi(), minor,
            months: item.getLiuYue().map(month => month.getGanZhi()) };
        }),
      };
    });
    return {
      genderBasis: gender === 1 ? '男' : '女', direction: forward ? 'forward' : 'backward',
      start: parse(date), offset: { years: yun.getStartYear(), months: yun.getStartMonth(),
        days: yun.getStartDay(), hours: yun.getStartHour() }, stages,
    };
  });
  // The public archive contains the ten non-placeholder stages produced by
  // this exact engine/sect. Match every pillar AND age, rather than guessing a
  // sex from another method, trusting one matching pillar, or choosing forward.
  const archived = natal.luckPeriods;
  const stated = natal.luckContext;
  const matches = directions.filter(direction => {
    if (!Array.isArray(archived) || archived.length !== 10) return false;
    if (stated && (stated.profile !== 'lunar-javascript-beijing-jie-sect2-v1'
      || stated.gender !== (direction.genderBasis === '男' ? 'male' : 'female')
      || stated.direction !== direction.direction || !Array.isArray(stated.periods) || stated.periods.length !== archived.length)) return false;
    return archived.every((item, index) => {
      const stage = direction.stages[index + 1];
      const disclosed = stated?.periods[index];
      return item?.ganZhi === stage.pillar?.pillar && item.startAge === stage.startAge && item.endAge === stage.endAge
        && (!stated || (disclosed?.ganZhi === item.ganZhi && disclosed.startAge === item.startAge && disclosed.endAge === item.endAge
          && Date.parse(disclosed.start) === stage.start && Date.parse(disclosed.endExclusive) === stage.end));
    });
  });
  return directions.map(direction => ({ ...direction, confirmed: matches.length === 1 && matches[0] === direction,
    selectionPolicy: 'archived-table-recomputed-sect2-v1' }));
}

function currentFacts(at: number, current: Record<Layer, Interval | undefined>, pillars: Pillars,
  directions: ReturnType<typeof buildLuckDirections>) {
  const layers = Object.fromEntries(positions.map(layer => {
    const flow = current[layer];
    return [layer, flow && {
      ...flow, ...describeBaZiPillar(flow.pillar, pillars.day?.[0]),
      shenSha: flowShenSha(pillars, flow.pillar[1]),
    }] as const;
  }));
  const items = positions.flatMap(layer => {
    const native = pillars[layer];
    const flow = current[layer]?.pillar;
    return [...(native ? [{ id: 'natal:' + layer, pillar: native }] : []),
      ...(flow ? [{ id: 'flow:' + layer, pillar: flow }] : [])];
  });
  return { layers, interactions: baziInteractions(items), luck: directions.map(direction => {
    const stage = direction.stages.find(item => item.start <= at && at < item.end);
    return { direction: direction.direction, genderBasis: direction.genderBasis, stageIndex: stage?.index,
      confirmed: direction.confirmed, selectionPolicy: direction.selectionPolicy,
      interactions: stage?.pillar ? baziInteractions([...items, { id: 'luck', pillar: stage.pillar.pillar }]) : null };
  }) };
}

export function buildBaZiCalculation(window: Window, at: number, snapshot?: DestinyChartSnapshot, legacy?: NatalDay | null) {
  if (!Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end)
    || !(window.start <= at && at < window.end) || window.end - window.start > 368 * dayMs) {
    throw new RangeError('Invalid BaZi window or reference instant');
  }
  const chart = snapshot?.bazi;
  const compatible = chart?.engineName === 'lunar-javascript' && chart.engineVersion === '1.7.8'
    && chart.rulesetVersion === 'utc8-jie-local-civil-late-zi-next-v1';
  const timelines = flowTimelines(window);
  const current = Object.fromEntries(positions.map(layer => [
    layer, timelines[layer].find(interval => interval.start <= at && at < interval.end),
  ])) as Record<Layer, Interval | undefined>;
  const candidates = compatible ? chart.rawResult.map((natal, index) => {
    const directions = buildLuckDirections(natal).map(direction => ({ ...direction,
      confirmed: direction.confirmed && snapshot?.timeKnown === true && chart.rawResult.length === 1 }));
    const natalPillars = positions.map(layer => ({ layer, ...describeBaZiPillar(natal[layer], natal.day[0]) }));
    return { candidateId: index, natal, natalPillars, directions, current: currentFacts(at, current, natal, directions) };
  }) : [];
  const legacyDay = chart?.rawResult.length ? undefined : legacy?.pillar;
  const stableNatal = Object.fromEntries(positions.map(layer => [layer, candidates.length
    && candidates.every(item => item.natal[layer] === candidates[0].natal[layer]) ? candidates[0].natal[layer]
    : layer === 'day' ? legacyDay : undefined])) as Pillars;
  const dayMasters = [...new Set([
    ...candidates.map(candidate => candidate.natal.day[0]), ...(legacyDay ? [legacyDay[0]] : []),
  ])];
  // Reuse the same 60 reference entries across the hourly timeline, annual and luck tables.
  const pillarReference = util.JIA_ZI.map(pillar => ({
    ...describeBaZiPillar(pillar),
    byDayMaster: dayMasters.map(stem => {
      const { tenGod, phase, hiddenStems } = describeBaZiPillar(pillar, stem);
      return { stem, tenGod, phase, hiddenStems };
    }),
  }));
  return { version, engineVersion: '1.7.8', flowShenShaRules: 'fortune-flow-shensha-year-day-v1',
    natalRules: compatible ? chart.rulesetVersion : undefined, timeKnown: snapshot?.timeKnown ?? legacy?.timeKnown,
    window, at, timelines, pillarReference, candidates, stableNatal,
    current: currentFacts(at, current, stableNatal, []),
    natalStatus: candidates.length ? 'available' : chart?.rawResult.length ? 'unsupported' : legacyDay ? 'legacy-day' : 'missing',
  } as const;
}
