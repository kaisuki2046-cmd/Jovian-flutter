import { baziInteractions, describeBaZiPillar } from './bazi-calculation';
import { civilClockEpoch } from './period-window';

const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
const natalLayers = ['year', 'month', 'day', 'hour'] as const;
const flowLayers = ['year', 'month', 'day'] as const;
const directionsByBranch = [['寅卯辰', '东'], ['巳午未', '南'], ['申酉戌', '西'], ['亥子丑', '北']] as const;
type Natal = Record<typeof natalLayers[number], string>;
type Flow = { layer: typeof flowLayers[number]; pillar: string };
type Stage = { index: number; start: number; end: number; pillar: { pillar: string } | null };
type Direction = { confirmed: boolean; direction: string; stages: Stage[] };
export const baziSourceContextPolicy = {
  version: 'fortune-bazi-source-context-v1',
  relationPolicy: 'one-candidate-one-actual-interval-no-successful-transformation-claim',
  transitionPolicy: 'smth-forward-corners-same-season-and-gui-jia-separate-v2',
  workTiming: 'adee-work-timing-shared-natal-column-v1',
  dailyBranchContacts: 'adee-daily-branch-contacts-v1',
  luTwist: 'lu-first-degree-twist-v1',
  luAnnualTwistCase: { birthDate: '1919-07-07', sourceDate: '1991-11-01', luck: '癸亥' },
  dayClock: 'beijing-civil-23-v1',
} as const;

const luAnnualTwistDayStart = Date.parse(baziSourceContextPolicy.luAnnualTwistCase.sourceDate + 'T00:00:00+08:00');

export function luPublishedDayRange(range: { start: number; end: number }, dayStart: number) {
  const start = Math.max(range.start, dayStart), end = Math.min(range.end, dayStart + 86_400_000);
  return start < end ? { start, end } : undefined;
}

export function luAnnualTwistDayRange(range: { start: number; end: number }) {
  return luPublishedDayRange(range, luAnnualTwistDayStart);
}

function validPillar(value: string) {
  return typeof value === 'string' && value.length === 2 && stems.includes(value[0]) && branches.includes(value[1])
    && stems.indexOf(value[0]) % 2 === branches.indexOf(value[1]) % 2;
}

export function baziDailyBranchContext(natal: Natal, timeKnown: boolean, day: string, month: string,
  shared?: ReturnType<typeof baziInteractions>, year?: string, luck?: string,
  workTiming?: Pick<ReturnType<typeof baziWorkTimingContext>, 'upperOfficerTargets' | 'repeatedByMonth'>) {
  const targets = [...natalLayers.filter(layer => layer !== 'hour' || timeKnown)
    .map(layer => ({ id: 'natal:' + layer, pillar: natal[layer] })), { id: 'flow:month', pillar: month }];
  const longerLayers = [{ layer: 'month', id: 'flow:month', pillar: month },
    ...(year ? [{ layer: 'year', id: 'flow:year', pillar: year }] : []),
    ...(luck ? [{ layer: 'decadal', id: 'decadal', pillar: luck }] : [])];
  const { pairs, groups } = shared ?? baziInteractions([{ id: 'flow:day', pillar: day }, ...targets, ...longerLayers.slice(1)]);
  const contacts = pairs.flatMap(({ kind, members: [first, second] }) => {
    if ((first !== 'flow:day' && second !== 'flow:day') || !['六合', '六冲', '相刑', '六害'].includes(kind)) return [];
    const targetId = first === 'flow:day' ? second : first;
    const target = targets.find(row => row.id === targetId);
    if (!target) return [];
    const mainQiTenGod = describeBaZiPillar(target.pillar, natal.day[0]).hiddenStems[0]?.tenGod;
    return [{ kind, target: target.id, targetPillar: target.pillar, targetBranch: target.pillar[1], mainQiTenGod }];
  });
  const repeatedContacts = contacts.filter(row => row.target.startsWith('natal:')).flatMap(({ kind, target, targetPillar }) => {
    const background = longerLayers.filter(({ id, pillar }) => pillar[1] === day[1] && pairs.some(pair =>
      pair.kind === kind && pair.members.includes(id) && pair.members.includes(target)))
      .map(({ layer, pillar }) => ({ layer, pillar }));
    return background.length ? [{ kind, target, targetPillar, background }] : [];
  });
  const permittedPositions = new Set(['flow:day', ...targets.map(target => target.id)]);
  const completedGroups = groups.flatMap(({ kind, values, byBranch }) => {
    if (!timeKnown || (kind !== '三合' && kind !== '三刑')) return [];
    const positions = byBranch.map(ids => ids.filter(id => permittedPositions.has(id)));
    const suppliesMissingBranch = positions.some(ids => ids.length === 1 && ids[0] === 'flow:day');
    return suppliesMissingBranch && positions.every(ids => ids.length > 0) ? [{ kind, branches: values, positions }] : [];
  });
  const workMonthContact = workTiming?.upperOfficerTargets.includes('month') && year && luck
    ? contacts.find(row => row.kind === '六冲' && row.target === 'natal:month') : undefined;
  const workMonthBranchWitness = workMonthContact && { ...workMonthContact, annualPillar: year, luckPillar: luck };
  const workRepeatedBranchWitnesses = year && luck && workTiming?.repeatedByMonth.length
    ? contacts.filter(row => workTiming.repeatedByMonth.some(column => row.target === 'natal:' + column))
    : [];
  return { profile: baziSourceContextPolicy.dailyBranchContacts, dayClock: baziSourceContextPolicy.dayClock,
    dayPillar: day, dayBranch: day[1], monthPillar: month, timeKnown, contacts, repeatedContacts, completedGroups, workMonthBranchWitness,
    workMonthBranchConfirmed: Boolean(workMonthBranchWitness),
    workRepeatedBranchWitnesses, workRepeatedBranchConfirmed: workRepeatedBranchWitnesses.length > 0,
    hasBranchContact: contacts.length || completedGroups.length ? true : timeKnown ? false : undefined };
}

const workRoles: Record<string, string> = {
  正官: '官杀', 七杀: '官杀', 食神: '食伤', 伤官: '食伤', 正财: '财', 偏财: '财',
};

export function baziWorkTimingContext(natal: Natal, timeKnown: boolean, luck: string, year: string, month: string, day?: string) {
  const native = natalLayers.filter(layer => layer !== 'hour' || timeKnown).map(id => ({ id, pillar: natal[id] }));
  const lanes = [{ layer: 'luck', pillar: luck }, { layer: 'year', pillar: year }, { layer: 'month', pillar: month },
    ...(day ? [{ layer: 'day', pillar: day }] : [])];
  if (native.some(row => !validPillar(row.pillar)) || lanes.some(row => !validPillar(row.pillar))) {
    throw new RangeError('Invalid BaZi work timing pillars');
  }
  const evidence = lanes.map(row => {
    const detail = describeBaZiPillar(row.pillar, natal.day[0]);
    const { tenGod: stemGod, hiddenStems: hidden } = detail;
    const mainQiGod = hidden[0]?.tenGod;
    const rolesFor = (gods: (string | undefined)[]) => [...new Set(gods.flatMap(god => god && workRoles[god] ? [workRoles[god]] : []))];
    const { pairs } = baziInteractions([...native, { id: 'moving', pillar: row.pillar }]);
    const contacts = pairs.filter(pair => pair.members.includes('moving')).map(pair => {
      const actualGods = pair.kind === '同柱' ? [stemGod, mainQiGod] : [pair.kind.startsWith('天干') ? stemGod : mainQiGod];
      return { target: pair.members.find(id => id !== 'moving')!, kind: pair.kind, roles: rolesFor(actualGods) };
    });
    return { ...row, stemGod, mainQiGod, contacts };
  });
  const [decade, annual, monthly, daily] = evidence;
  const sharedTargets = (requiresOfficer: boolean) => native.filter(row => [decade, annual].every(lane =>
    lane.contacts.some(contact => contact.target === row.id && (requiresOfficer ? contact.roles.includes('官杀') : contact.roles.length))))
    .map(row => row.id);
  const upperWorkTargets = sharedTargets(false);
  const upperOfficerTargets = sharedTargets(true);
  const repeatedByMonth = upperWorkTargets.filter(target => monthly.contacts.some(contact => contact.target === target));
  const dayContacts = day ? baziInteractions([{ id: 'birth-month', pillar: natal.month }, { id: 'flow-month', pillar: month },
    { id: 'flow-day', pillar: day }]).pairs.filter(edge => edge.kind === '六冲' && edge.members.includes('flow-day')) : [];
  const dayClashesBirthMonth = day ? dayContacts.some(edge => edge.members.includes('birth-month')) : undefined;
  const dayClashesFlowMonth = day ? dayContacts.some(edge => edge.members.includes('flow-month')) : undefined;
  const dayOfficer = daily ? Boolean(daily.stemGod && workRoles[daily.stemGod] === '官杀') : undefined;
  return { profile: baziSourceContextPolicy.workTiming, timeKnown, evidence, upperWorkTargets, upperOfficerTargets, repeatedByMonth,
    monthlyCandidate: repeatedByMonth.length > 0,
    dayOfficer, dayOfficerGod: dayOfficer ? daily.stemGod : undefined, dayClashesBirthMonth, dayClashesFlowMonth,
    dailyCandidate: daily ? upperOfficerTargets.length > 0 && Boolean(dayOfficer || dayClashesBirthMonth || dayClashesFlowMonth) : undefined };
}

function describeFirstDegreeTwist(first: string, second: string) {
  if (!validPillar(first) || !validPillar(second)) throw new RangeError('Invalid twist pillars');
  const stemDifference = stems.indexOf(second[0]) - stems.indexOf(first[0]);
  const branchDifference = branches.indexOf(second[1]) - branches.indexOf(first[1]);
  const step = (difference: number, size: number) => {
    const offset = (difference + size) % size;
    return offset === 1 ? 1 : offset === size - 1 ? -1 : undefined;
  };
  const stemStep = step(stemDifference, stems.length), branchStep = step(branchDifference, branches.length);
  return { first, second, stemStep, branchStep, firstDegree: stemStep !== undefined && branchStep === -stemStep,
    stemWrap: Math.abs(stemDifference) === stems.length - 1, branchWrap: Math.abs(branchDifference) === branches.length - 1 };
}

export function firstDegreeTwist(first: string, second: string) {
  return describeFirstDegreeTwist(first, second).firstDegree;
}

export function luMonthDayTwist(month: string, day: string) {
  return { profile: baziSourceContextPolicy.luTwist, dayClock: baziSourceContextPolicy.dayClock,
    ...describeFirstDegreeTwist(month, day) };
}

export function luAnnualDailyTwist(natal: Natal, year: string, month: string, day: string, luck: string | undefined) {
  const base = { profile: baziSourceContextPolicy.luTwist, dayClock: baziSourceContextPolicy.dayClock };
  if (natal.year !== '己未' || natal.month !== '庚午' || natal.day !== '庚申' || natal.hour !== '丙戌'
    || year !== '辛未' || month !== '戊戌' || day !== '乙亥') return { ...base, matchesPublishedGeometry: false };

  const yearTwist = describeFirstDegreeTwist(natal.day, year);
  const dayTwist = describeFirstDegreeTwist(natal.hour, day);
  const pillars = [...natalLayers.map(layer => ({ id: 'natal:' + layer, pillar: natal[layer] })),
    { id: 'flow:year', pillar: year }, { id: 'flow:month', pillar: month }, { id: 'flow:day', pillar: day },
    ...(luck ? [{ id: 'decadal', pillar: luck }] : [])];
  const { pairs } = baziInteractions(pillars);
  const weiXu = pairs.filter(row => row.kind === '相刑' && ['未戌', '戌未'].includes(row.values));
  const haiShen = pairs.filter(row => row.kind === '六害' && ['亥申', '申亥'].includes(row.values));
  return { ...base, yearTwist, dayTwist, month, luck, weiXu, haiShen,
    matchesPublishedGeometry: yearTwist.firstDegree && dayTwist.firstDegree
      && weiXu.some(row => row.members.includes('flow:year') && row.members.includes('natal:hour'))
      && haiShen.some(row => row.members.includes('flow:day') && row.members.includes('natal:day')) };
}

export function luAnnualDailyTwistCase(natal: Natal & { utc: string }, birthTimeZone: string,
  year: string, month: string, day: string, luck: string | undefined, onPublishedDay: boolean) {
  const source = baziSourceContextPolicy.luAnnualTwistCase;
  const base = { profile: baziSourceContextPolicy.luTwist, dayClock: baziSourceContextPolicy.dayClock, sourceDate: source.sourceDate };
  if (!onPublishedDay) return { ...base, matchesPublishedGeometry: false };
  const geometry = luAnnualDailyTwist(natal, year, month, day, luck);
  const birthDate = new Date(civilClockEpoch(Date.parse(natal.utc), birthTimeZone)).toISOString().slice(0, 10);
  return { ...geometry, sourceDate: source.sourceDate,
    matchesPublishedGeometry: geometry.matchesPublishedGeometry && birthDate === source.birthDate,
    hasPublishedLuck: luck === undefined ? undefined : luck === source.luck };
}

// An atomic context binds every field to the same natal candidate and actual
// overlapping flow segment. Matching must not assemble a case from other dates.
export function baziSourceContext(natal: Natal, timeKnown: boolean, flows: Flow[]) {
  const present = natalLayers.filter(layer => layer !== 'hour' || timeKnown);
  if (present.some(layer => !validPillar(natal[layer])) || !flows.length
    || flows.some(flow => !flowLayers.includes(flow.layer) || !validPillar(flow.pillar))
    || new Set(flows.map(flow => flow.layer)).size !== flows.length) throw new RangeError('Invalid BaZi source context');
  const payload: Record<string, unknown> = {
    policyVersion: baziSourceContextPolicy.version, calendarPolicy: baziSourceContextPolicy.dayClock,
    timeKnown, dayMaster: natal.day[0], natalYear: natal.year, natalMonth: natal.month, natalDay: natal.day,
    ...(timeKnown ? { natalHour: natal.hour } : {}),
    natalMonthStem: natal.month[0], natalBranches: present.map(layer => natal[layer][1]),
  };
  const pillars = present.map(layer => ({ id: 'natal:' + layer, pillar: natal[layer] }));
  const relations: string[] = [], twists: string[] = [];
  for (const flow of flows) {
    const detail = describeBaZiPillar(flow.pillar, natal.day[0]);
    payload[flow.layer] = flow.pillar;
    payload[flow.layer + 'Available'] = true;
    payload[flow.layer + 'Stem'] = detail.stem;
    payload[flow.layer + 'Branch'] = detail.branch;
    payload[flow.layer + 'TenGod'] = detail.tenGod;
    payload[flow.layer + 'Element'] = detail.stemElement;
    payload[flow.layer + 'MainQiTenGod'] = detail.hiddenStems[0]?.tenGod;
    payload[flow.layer + 'StemMainQiSameElement'] = detail.stemElement === detail.hiddenStems[0]?.element;
    const compared = baziInteractions([...pillars, { id: 'flow', pillar: flow.pillar }]);
    for (const pair of compared.pairs.filter(pair => pair.members.includes('flow'))) {
      const target = pair.members.find(member => member !== 'flow')!;
      relations.push(flow.layer + ':' + target + ':' + pair.kind);
    }
    for (const pillar of pillars) if (firstDegreeTwist(pillar.pillar, flow.pillar)) twists.push(flow.layer + ':' + pillar.id);
  }
  for (const [first, second] of [['year', 'month'], ['year', 'day']] as const) {
    if (payload[first] && payload[second]) payload[first + (second === 'month' ? 'Month' : 'Day') + 'SameStemElement']
      = payload[first + 'Element'] === payload[second + 'Element'];
  }
  return { ...payload, relations, firstDegreeTwists: twists };
}

// Exclude the empty pre-luck placeholder, broken tables and a boundary at the
// query end. Reverse corner pairs are recorded but never promoted to the
// source's explicitly forward list. No arbitrary "near a change" buffer.
export function baziLuckTransitions(window: { start: number; end: number }, directions: Direction[]) {
  if (!Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end) || window.start >= window.end) {
    throw new RangeError('Invalid luck transition window');
  }
  const selected = directions.filter(direction => direction.confirmed);
  return (selected.length === 1 ? selected : directions).flatMap(direction => direction.stages.flatMap((next, index) => {
    const previous = direction.stages[index - 1];
    if (!previous?.pillar || !next.pillar || !validPillar(previous.pillar.pillar) || !validPillar(next.pillar.pillar)
      || previous.index + 1 !== next.index || previous.end !== next.start
      || !(previous.start < previous.end && next.start < next.end)
      || !(window.start <= next.start && next.start < window.end)) return [];
    const fromPillar = previous.pillar.pillar, toPillar = next.pillar.pillar;
    const step = direction.direction === 'forward' ? 1 : direction.direction === 'backward' ? -1 : 0;
    if (!step || stems[(stems.indexOf(fromPillar[0]) + step + 10) % 10] !== toPillar[0]
      || branches[(branches.indexOf(fromPillar[1]) + step + 12) % 12] !== toPillar[1]) return [];
    const forwardCorner = ['丑寅', '辰巳', '未申', '戌亥'].includes(fromPillar[1] + toPillar[1]);
    const reverseCorner = ['寅丑', '巳辰', '申未', '亥戌'].includes(fromPillar[1] + toPillar[1]);
    const fromSeason = directionsByBranch.find(([group]) => group.includes(fromPillar[1]))![1];
    const toSeason = directionsByBranch.find(([group]) => group.includes(toPillar[1]))![1];
    return [{ at: next.start, fromPillar, toPillar, forwardCorner, reverseCorner,
      fromSeason, toSeason, sameSeason: fromSeason === toSeason, transitionProfile: baziSourceContextPolicy.transitionPolicy,
      stemWrap: fromPillar[0] === '癸' && toPillar[0] === '甲',
      confirmed: selected.length === 1 && direction.confirmed, direction: direction.direction,
      policyVersion: baziSourceContextPolicy.version }];
  }));
}
