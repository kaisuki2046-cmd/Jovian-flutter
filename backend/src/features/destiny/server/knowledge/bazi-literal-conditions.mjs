import { LunarUtil } from 'lunar-javascript';

const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';
const positions = ['year', 'month', 'day', 'hour'];
const shownPositions = ['year', 'month', 'hour'];
const elementOfStem = stem => '木木火火土土金金水水'[stems.indexOf(stem)];
const stemList = value => {
  if (!/^[甲乙丙丁戊己庚辛壬癸、与和及]+$/u.test(value)) return null;
  const names = [...value.replace(/[、与和及]/gu, '')];
  return names.length && new Set(names).size === names.length ? names : null;
};
const empty = () => ({ required: [], mustBeAbsent: [] });
const conjunction = (left, right) => left && right ? left.flatMap(a => right.map(b => ({
  required: [...a.required, ...b.required], mustBeAbsent: [...a.mustBeAbsent, ...b.mustBeAbsent],
}))) : null;
const stemFact = (position, stem) => ({ kind: 'stem', position, stem });

// Supplemental literal grammar. It never drops unknown words, strength,
// control, success/failure, source qualifications or comparative conclusions.
// Kept separate from the established parser so existing compiled inputs retain
// their provenance and shape; the caller uses this only after an unmapped clause.
export function baziLiteralConditions(claim, { positive, absence }) {
  const text = claim.conditions.normalized.map(value => value.replace(/\s+/gu, ''));
  const shown = names => names?.length ? names.reduce((groups, stem) => groups.flatMap(group => shownPositions
    .filter(position => !group.required.some(fact => fact.kind === 'stem' && fact.position === position))
    .map(position => ({ ...group, required: [...group.required, stemFact(position, stem)] }))), [empty()]) : null;
  const hidden = stem => positions.flatMap(position => [...branches].filter(branch => LunarUtil.ZHI_HIDE_GAN[branch].includes(stem))
    .map(branch => ({ required: [{ kind: 'branch', position, branch }], mustBeAbsent: [] })));
  const subsets = (items, count) => count === 0 ? [[]] : items.flatMap((item, index) =>
    subsets(items.slice(index + 1), count - 1).map(rest => [item, ...rest]));
  const repeatedShown = (stem, count, exact) => subsets(shownPositions, count).map(selected => ({
    required: selected.map(position => stemFact(position, stem)),
    mustBeAbsent: exact ? shownPositions.filter(position => !selected.includes(position)).map(position => stemFact(position, stem)) : [],
  }));
  const absentEverywhere = names => [{ required: [], mustBeAbsent: names.flatMap(stem => [
    ...positions.map(position => stemFact(position, stem)),
    ...hidden(stem).flatMap(group => group.required),
  ]) }];
  const plain = value => {
    const absent = absence(value);
    if (absent) return [{ required: [], mustBeAbsent: absent }];
    const groups = positive(value);
    return groups ? groups.map(required => ({ required, mustBeAbsent: [] })) : null;
  };
  function parse(value) {
    const sharedMonth = /^若生([子丑寅卯辰巳午未申酉戌亥])或([子丑寅卯辰巳午未申酉戌亥])月$/u.exec(value);
    if (sharedMonth) return [...new Set(sharedMonth.slice(1))].flatMap(branch => plain(branch + '月'));
    const hourWealthAndRobbery = /^原局时上偏财遇劫财$/u.test(value);
    if (hourWealthAndRobbery) return conjunction(plain('时干透偏财'), plain('原局见劫财'));
    // The shared day in this exact source construction applies to both months;
    // a comma before "or" must not become a global AND of incompatible months.
    const monthOr = /^([甲乙丙丁戊己庚辛壬癸])日([子丑寅卯辰巳午未申酉戌亥])月([^，,]+)[，,]或([子丑寅卯辰巳午未申酉戌亥])月([^，,]+)$/u.exec(value);
    if (monthOr) {
      const a = parse(monthOr[1] + '日' + monthOr[2] + '月' + monthOr[3]);
      const b = parse(monthOr[1] + '日' + monthOr[4] + '月' + monthOr[5]);
      return a && b ? [...a, ...b] : null;
    }
    const clauses = value.split(/[,，；;]/u);
    if (clauses.length > 1) return clauses.map(parse).reduce(conjunction, [empty()]);
    const dayMonth = /^([甲乙丙丁戊己庚辛壬癸])日([子丑寅卯辰巳午未申酉戌亥])月(.+)$/u.exec(value);
    const monthDay = /^([子丑寅卯辰巳午未申酉戌亥])月([甲乙丙丁戊己庚辛壬癸])(日|[木火土金水])(.+)$/u.exec(value);
    if (dayMonth) return conjunction(plain(dayMonth[1] + '日' + dayMonth[2] + '月'), parse(dayMonth[3]));
    if (monthDay && (monthDay[3] === '日' || elementOfStem(monthDay[2]) === monthDay[3])) {
      return conjunction(plain(monthDay[1] + '月' + monthDay[2] + '日'), parse(monthDay[4]));
    }
    const seasonDay = /^([春夏秋冬])(?:月|令)([甲乙丙丁戊己庚辛壬癸])(日|[木火土金水])(.+)$/u.exec(value);
    if (seasonDay && (seasonDay[3] === '日' || elementOfStem(seasonDay[2]) === seasonDay[3])) {
      return conjunction(plain(seasonDay[1] + '月' + seasonDay[2] + '日'), parse(seasonDay[4]));
    }
    const sharedGods = /^([男女])命(比肩|劫财)或(比肩|劫财)在天干透出$/u.exec(value);
    if (sharedGods) return conjunction(plain(sharedGods[1] + '命'),
      [...plain('天干透' + sharedGods[2]), ...plain('天干透' + sharedGods[3])]);
    const gendered = /^([男女])命(.+)$/u.exec(value);
    if (gendered) return conjunction(plain(gendered[1] + '命'), parse(gendered[2]));
    const ors = value.split('或');
    if (ors.length > 1) { const groups = ors.map(parse); return groups.every(Boolean) ? groups.flat() : null; }
    const ands = value.split(/[且而但]/u);
    if (ands.length > 1) return ands.map(parse).reduce(conjunction, [empty()]);
    const oneBranch = /^地支恰有一([子丑寅卯辰巳午未申酉戌亥])$/u.exec(value);
    if (oneBranch) return positions.map(position => ({
      required: [{ kind: 'branch', position, branch: oneBranch[1] }],
      mustBeAbsent: positions.filter(other => other !== position).map(other => ({ kind: 'branch', position: other, branch: oneBranch[1] })),
    }));
    const coPresentBranches = /^地支(?:见([子丑寅卯辰巳午未申酉戌亥])|同见([子丑寅卯辰巳午未申酉戌亥]{2,4}))$/u.exec(value);
    if (coPresentBranches) {
      const names = [...(coPresentBranches[1] ?? coPresentBranches[2])];
      if (new Set(names).size !== names.length) return null;
      return names.reduce((groups, branch) => groups.flatMap(group => positions
        .filter(position => !group.required.some(fact => fact.position === position))
        .map(position => ({ ...group, required: [...group.required, { kind: 'branch', position, branch }] }))), [empty()]);
    }
    const incompleteBranches = /^地支不全([子丑寅卯辰巳午未申酉戌亥]{2,4})$/u.exec(value);
    if (incompleteBranches) {
      const names = [...incompleteBranches[1]];
      if (new Set(names).size !== names.length) return null;
      return names.map(branch => ({
        required: [], mustBeAbsent: positions.map(position => ({ kind: 'branch', position, branch })),
      }));
    }
    if (value === '四支皆阴') {
      const opposite = [...branches].filter((_, index) => index % 2 === 0);
      return [{ required: [], mustBeAbsent: positions.flatMap(position =>
        opposite.map(branch => ({ kind: 'branch', position, branch }))) }];
    }
    const maximumHidden = /^至多([零一二两三四])支藏([甲乙丙丁戊己庚辛壬癸])$/u.exec(value);
    if (maximumHidden) return subsets(positions, ({ 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4 })[maximumHidden[1]]).map(allowed => ({
      required: [], mustBeAbsent: positions.filter(position => !allowed.includes(position)).flatMap(position => [...branches]
        .filter(branch => LunarUtil.ZHI_HIDE_GAN[branch].includes(maximumHidden[2])).map(branch => ({ kind: 'branch', position, branch }))),
    }));
    const counted = /^(至少|仅|恰好)?([一二两三])([甲乙丙丁戊己庚辛壬癸])(?:透干|透|出干)$/u.exec(value);
    if (counted) return repeatedShown(counted[3], ({ 一: 1, 二: 2, 两: 2, 三: 3 })[counted[2]], ['仅', '恰好'].includes(counted[1]));
    const visibilityMix = /^([甲乙丙丁戊己庚辛壬癸、]+)恰([一二])透余藏$/u.exec(value);
    if (visibilityMix) {
      const names = stemList(visibilityMix[1]);
      const count = visibilityMix[2] === '一' ? 1 : 2;
      if (!names || names.length !== 3) return null;
      return subsets(names, count).flatMap(visible => {
        const concealed = names.filter(stem => !visible.includes(stem));
        const mustBeAbsent = concealed.flatMap(stem => shownPositions.map(position => stemFact(position, stem)));
        const roots = concealed.map(hidden).reduce(conjunction, [empty()]);
        return conjunction(shown(visible), roots).map(group => ({ ...group, mustBeAbsent }));
      });
    }
    const separated = /^([甲乙丙丁戊己庚辛壬癸])(?:与)?([甲乙丙丁戊己庚辛壬癸])隔位同透$/u.exec(value);
    if (separated && separated[1] !== separated[2]) return shownPositions.flatMap(first => shownPositions
      .filter(second => Math.abs(positions.indexOf(first) - positions.indexOf(second)) > 1)
      .map(second => ({ required: [stemFact(first, separated[1]), stemFact(second, separated[2])], mustBeAbsent: [] })));
    const referents = /^([甲乙丙丁戊己庚辛壬癸、与和及]+)([二两三])者(?:同透|俱透)$/u.exec(value);
    if (referents) {
      const names = stemList(referents[1]);
      return names?.length === ({ 二: 2, 两: 2, 三: 3 })[referents[2]] ? shown(names) : null;
    }
    const shownAndHidden = /^一([甲乙丙丁戊己庚辛壬癸])透一([甲乙丙丁戊己庚辛壬癸])藏$/u.exec(value);
    if (shownAndHidden) return conjunction(shown([shownAndHidden[1]]), hidden(shownAndHidden[2]));
    const explicitShown = /^(?:另有|有)?([甲乙丙丁戊己庚辛壬癸])出干$/u.exec(value);
    if (explicitShown) return shown([explicitShown[1]]);
    const columnShown = /^([年月时])([甲乙丙丁戊己庚辛壬癸])透$/u.exec(value);
    if (columnShown) return [{ required: [stemFact(({ 年: 'year', 月: 'month', 时: 'hour' })[columnShown[1]], columnShown[2])], mustBeAbsent: [] }];
    // Element exposure is existential (丙 OR 丁 for 火); non-exposure is
    // conjunctive (neither 壬 nor 癸 for 水). Neither refers to hidden stems.
    const elementShown = /^(?:有)?([木火土金水])透$/u.exec(value);
    if (elementShown) {
      const names = [...stems].filter(stem => elementOfStem(stem) === elementShown[1]);
      return names.flatMap(stem => shown([stem]));
    }
    const elementNotShown = /^([木火土金水])不透$/u.exec(value);
    if (elementNotShown) {
      const names = [...stems].filter(stem => elementOfStem(stem) === elementNotShown[1]);
      return [{ required: [], mustBeAbsent: names.flatMap(stem => shownPositions.map(position => stemFact(position, stem))) }];
    }
    // A named pair of columns is conjunctive, not an unspecified choice of
    // either column. Keep the general stem-list grammar separate from this.
    const monthAndHour = /^月时([甲乙丙丁戊己庚辛壬癸])均透$/u.exec(value);
    if (monthAndHour) return [{ required: [stemFact('month', monthAndHour[1]), stemFact('hour', monthAndHour[1])], mustBeAbsent: [] }];
    const explicitHidden = /^(?:支中(?:另)?藏([甲乙丙丁戊己庚辛壬癸])([木火土金水])?|一([甲乙丙丁戊己庚辛壬癸])藏)$/u.exec(value);
    if (explicitHidden && (!explicitHidden[2] || elementOfStem(explicitHidden[1]) === explicitHidden[2])) return hidden(explicitHidden[1] ?? explicitHidden[3]);
    const furtherShown = /^([甲乙丙丁戊己庚辛壬癸、与和及]+)透干又透([甲乙丙丁戊己庚辛壬癸、与和及]+)$/u.exec(value);
    if (furtherShown) {
      const first = stemList(furtherShown[1]), second = stemList(furtherShown[2]);
      const names = first && second ? [...first, ...second] : null;
      return names && new Set(names).size === names.length ? shown(names) : null;
    }
    const visible = /^(?:透([甲乙丙丁戊己庚辛壬癸、与和及]+)|([甲乙丙丁戊己庚辛壬癸、与和及]+)(?:(?:都|俱|同|并|齐)?透干|同透|并透|齐透|俱透|皆透|出干|透))$/u.exec(value);
    if (visible) return shown(stemList(visible[1] ?? visible[2]));
    const notShown = /^(?:([甲乙丙丁戊己庚辛壬癸、]+)(?:不透|未透)|不透([甲乙丙丁戊己庚辛壬癸、]+))$/u.exec(value);
    if (notShown) {
      const names = stemList(notShown[1] ?? notShown[2]);
      return names ? [{ required: [], mustBeAbsent: names.flatMap(stem => shownPositions.map(position => stemFact(position, stem))) }] : null;
    }
    const concealed = /^([甲乙丙丁戊己庚辛壬癸])藏(?:支|支下)?$/u.exec(value);
    if (concealed) return hidden(concealed[1]);
    const anywhere = /^四柱干支见([甲乙丙丁戊己庚辛壬癸])$/u.exec(value);
    if (anywhere) return [...positions.map(position => ({
      required: [stemFact(position, anywhere[1])], mustBeAbsent: [],
    })), ...hidden(anywhere[1])];
    const allConcealed = /^([甲乙丙丁戊己庚辛壬癸、与和及]+)都伏藏$/u.exec(value);
    if (allConcealed) {
      const names = stemList(allConcealed[1]);
      return names ? names.map(hidden).reduce(conjunction, [empty()]) : null;
    }
    // Naked 见/有 can mean visible or merely concealed in a particular source.
    // Do not make every 巳-month chart "see 庚" just because 巳 stores 庚.
    const missing = /^(?:(?:原局|四柱)?(?:无|不见)([甲乙丙丁戊己庚辛壬癸、]+)|([甲乙丙丁戊己庚辛壬癸、]+)不见)$/u.exec(value);
    if (missing) { const names = stemList(missing[1] ?? missing[2]); return names ? absentEverywhere(names) : null; }
    // Try enumerated clauses only after complete stem-list forms, so e.g.
    // 甲、乙同透 retains its shared predicate. Every clause must still parse.
    if (value.includes('、')) {
      const parts = value.split('、').map(parse);
      if (parts.every(Boolean)) return parts.reduce(conjunction, [empty()]);
    }
    return plain(value);
  }
  const groups = text.map(parse).reduce(conjunction, [empty()]);
  return groups?.some(group => group.required.length) ? groups : null;
}

// Reject impossible literal assignments under the existing five-tiger / five-
// rat rules, as well as a pillar contradicting separately supplied stem/branch.
// This filters new supplemental alternatives only; it does not rewrite old rules.
export function compatibleBaZiLiteralFacts(facts, mustBeAbsent = []) {
  const known = new Map(positions.map(position => [position, {}]));
  const scalar = new Map();
  for (const fact of facts) {
    if (!known.has(fact.position)) continue;
    const body = known.get(fact.position);
    const values = fact.kind === 'pillar' ? { stem: fact.ganZhi[0], branch: fact.ganZhi[1] }
      : fact.kind === 'stem' ? { stem: fact.stem } : fact.kind === 'branch' ? { branch: fact.branch } : {};
    for (const [name, value] of Object.entries(values)) {
      if (body[name] && body[name] !== value) return false;
      body[name] = value;
    }
    if (['stem_ten_god', 'branch_main_ten_god'].includes(fact.kind)) {
      const key = fact.kind + ':' + fact.position;
      if (scalar.has(key) && scalar.get(key) !== fact.tenGod) return false;
      scalar.set(key, fact.tenGod);
    }
  }
  for (const { stem, branch } of known.values()) if (stem && branch && stems.indexOf(stem) % 2 !== branches.indexOf(branch) % 2) return false;
  const year = known.get('year'), month = known.get('month'), day = known.get('day'), hour = known.get('hour');
  if (year.stem && month.stem && month.branch
    && (stems.indexOf(year.stem) % 5 * 2 + 2 + (branches.indexOf(month.branch) + 10) % 12) % 10 !== stems.indexOf(month.stem)) return false;
  if (day.stem && hour.stem && hour.branch
    && (stems.indexOf(day.stem) % 5 * 2 + branches.indexOf(hour.branch)) % 10 !== stems.indexOf(hour.stem)) return false;
  const pillars = Array.from({ length: 60 }, (_, i) => stems[i % 10] + branches[i % 12]);
  const coordinateAndGodKinds = ['pillar', 'stem', 'branch', 'stem_ten_god', 'branch_ten_god', 'branch_main_ten_god', 'hidden_ten_god'];
  const satisfies = (pillar, dayStem, fact) => {
    if (fact.kind === 'pillar') return fact.ganZhi === pillar;
    if (fact.kind === 'stem') return fact.stem === pillar[0];
    if (fact.kind === 'branch') return fact.branch === pillar[1];
    const hidden = LunarUtil.ZHI_HIDE_GAN[pillar[1]];
    if (fact.kind === 'stem_ten_god') return fact.position === 'day' ? fact.tenGod === '日主'
      : LunarUtil.SHI_SHEN[dayStem + pillar[0]] === fact.tenGod;
    if (fact.kind === 'branch_main_ten_god') return LunarUtil.SHI_SHEN[dayStem + hidden[0]] === fact.tenGod;
    if (fact.kind === 'hidden_ten_god') return hidden.includes(fact.stem) && LunarUtil.SHI_SHEN[dayStem + fact.stem] === fact.tenGod;
    return hidden.some(stem => LunarUtil.SHI_SHEN[dayStem + stem] === fact.tenGod);
  };
  // Constraints can imply a forbidden stem even when it was not written in
  // required facts: e.g. a known year stem and month branch fix the month stem.
  // Check the finite legal domains before admitting a new literal alternative.
  for (const dayStem of day.stem ? [day.stem] : stems) {
    const domains = positions.map(position => {
      const present = facts.filter(fact => fact.position === position && coordinateAndGodKinds.includes(fact.kind));
      const absent = mustBeAbsent.filter(fact => fact.position === position && coordinateAndGodKinds.includes(fact.kind));
      return pillars.filter(pillar => (position !== 'day' || pillar[0] === dayStem)
        && present.every(fact => satisfies(pillar, dayStem, fact)) && !absent.some(fact => satisfies(pillar, dayStem, fact)));
    });
    if (domains.some(domain => !domain.length)) continue;
    if (!domains[0].some(year => domains[1].some(month =>
      (stems.indexOf(year[0]) % 5 * 2 + 2 + (branches.indexOf(month[1]) + 10) % 12) % 10 === stems.indexOf(month[0])))) continue;
    if (!domains[3].some(hour => (stems.indexOf(dayStem) % 5 * 2 + branches.indexOf(hour[1])) % 10 === stems.indexOf(hour[0]))) continue;
    return true;
  }
  return false;
}
