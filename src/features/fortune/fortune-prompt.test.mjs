import assert from 'node:assert/strict';
import test from 'node:test';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt, fortunePromptVersion } from './control/fortune-prompt.mjs';
import { createFortuneDeepSeek } from './server/deepseek-expression.mjs';

const start = '2026-11-01T16:00:00.000Z', endExclusive = '2026-11-02T16:00:00.000Z';
function context() {
  const finding = { method: 'bazi', knowledgeId: 'private-knowledge-id', title: '不发送的资料标题',
    conditions: ['日主已确认且月柱与日柱构成六冲'], originalText: '月令逢冲。', note: '原有安排可能需要调整。',
    source: { passage_id: 'private-passage', url: 'https://private-source.example' },
    uncertain: ['不发送的内部审查记录'], limitations: ['不发送的额外字段'], evidenceGroup: 'private-source-group',
    windows: [{ start, endExclusive }], factRefs: ['F1'], eventRefs: ['E1'] };
  return { period: 'day', window: { start, endExclusive, timezone: 'Asia/Shanghai', referenceAt: start },
    facts: [{ ref: 'F1', method: 'bazi', type: 'ten_god', scope: 'daily', start, endExclusive,
      data: { dayMaster: '甲', stem: '己', tenGod: '正财', raw: 'private-raw-payload' } }],
    events: [{ ref: 'E1', method: 'bazi', phase: 'trigger', start, endExclusive, factRefs: ['F1'],
      exactTimes: ['2026-11-02T02:30:00.000Z'], changes: [start], identityScope: 'native' }],
    methods: { bazi: { status: 'partial', warnings: ['起运口径待确认'], incompleteConditions: [{ missing: ['{"machine":"query"}'] }] } },
    sections: [{ id: 'overall', findings: [finding, { ...finding }] }, { id: 'wealth', findings: [] }, { id: 'romance', findings: [] }],
    natalChartSnapshotId: 'private-snapshot', calculationRunId: 'private-run', ownerId: 'private-owner' };
}

test('local audit renders the chart evidence, citations and shared sources in natural Chinese', () => {
  const input = context(), before = structuredClone(input);
  const result = formatFortuneFactAudit(input);
  assert.deepEqual(input, before);
  assert.throws(() => JSON.parse(result));
  for (const expected of ['日运势', 'Asia/Shanghai', '2026-11-02 00:00:00', '2026-11-03 00:00:00', '截止时刻不计入',
    'F1（八字，流日）', '日主为甲', '天干十神为正财', 'E1（八字）', '2026-11-02 10:30:00',
    '命中条件：日主已确认且月柱与日柱构成六冲', '原文：月令逢冲。', '现代释义：原有安排可能需要调整。',
    '1条资料的必要条件未核实', '财运参考资料', '桃花运参考资料']) assert.ok(result.includes(expected), expected);
  assert.equal(result.match(/同源第1组/gu).length, 2);
  for (const forbidden of ['private-', '不发送', 'machine', 'knowledgeId', 'factRefs', 'normalizedPayload', 'incompleteConditions',
    'dayMaster', 'tenGod', 'evidenceGroup', 'identityScope', 'https://']) assert.ok(!result.includes(forbidden), forbidden);
});

test('all currently projected fact types have explicit translations rather than machine JSON fallbacks', () => {
  const cases = [
    ['western', 'lilly_return_context', { profile: 'lilly-return-source-pairs-v1', returnBody: 'Venus', natalTargetId: 'Mercury',
      returningLongitude: 200, natalLongitude: 201, longitudeSeparation: 1, returnAt: start, returnEnd: endExclusive, sameDegreeCell: false }, '不等于原书同度已经成立'],
    ['bazi', 'minor_luck_context', { profile: 'smth-minor-luck-alternatives-atomic-v1', variant: 'zuixing-hour-year-direction',
      direction: 'backward', annualPillar: '丙午', minorPillar: '己巳', ordinal: 37, birthYearLabel: 1990, yearLabel: 2026,
      calendarVerified: false, hasMajorLuck: false }, '该书计龄边界仍未核定'],
    ['bazi', 'school_context', { profile: 'smth-school-alternatives-atomic-v1', dayMaster: '甲', luckPillar: '丁亥',
      fourBirthAbsent: true, standardDayStartBranch: '亥', directSourceDayStart: '亥', directSourceDayStartAgrees: true,
      standardLuckPhase: '长生', entryCompletedCivilYears: 14 }, '原文五七岁的计龄仍待核'],
    ['bazi', 'school_exam_context', { profile: 'smth-school-exam-atomic-v1', natalMonth: '乙酉', annualPillar: '庚辰',
      monthHarmonyCandidate: true, birthNayin: '路旁土', sealPillar: '丙辰' }, '卷三取丙辰为正库印'],
    ['bazi', 'fateclear_bazi_context', { profile: 'fateclear-branch-and-example-v1', layer: 'month', movingPillar: '丁未',
      clashes: [{ id: 'day', branch: '丑', natalCombinations: [{ values: '子丑', members: ['year', 'day'] }] }] }, '六冲本命日支丑'],
    ['ziwei', 'quanshu_support_condition', { profile: 'quanshu-auxiliary-limits-atomic-v1', birthStem: '丙', birthMonth: 3,
      birthHour: '寅', branch: '辰', natalName: '官禄', noblePair: ['亥', '戌'], nobleArchiveState: 'different_pair',
      sourceLocalStars: ['文昌'], sourceOppositeStars: [], sourceTrineStars: ['左辅'], sourceAdjacentStars: ['右弼'] }, '魁钺无序支位组为亥、戌'],
    ['western', 'leo_lunar_house_context', { profile: 'leo-lunar-house-context-v2', house: 3, naturalSign: 2, cuspSign: 8,
      naturalSignBodies: ['Mercury'], natalHouseBodies: [], lunarAspects: [{ progressedBody: 'Moon', natalTargetId: 'Venus', aspectType: 'trine' }],
      solarAspects: [], mutualAspects: [] }, '本片段的月亮相位：次限月亮对本命金星形成三分相'],
    ['western', 'leo_mc_tenth_contact', { profile: 'leo-mc-tenth-linked-v1', inTenth: true, mcLongitude: 0,
      linkedMcInWindow: true, mcContacts: [{ at: start, motion: 'retrograde', role: 'leaving' }] }, '离开第十宫，不能写成新进入'],
    ['bazi', 'annual_luck_context', { profile: 'smth-annual-luck-atomic-v1', dayMaster: '丁', natalYear: '庚午', natalMonth: '乙酉',
      yearPillar: '丙午', luckPillar: '壬午', samePillar: false, sameBranch: true, confirmed: true,
      dayBasisBladeBranch: '未', yearBasisBladeBranch: '酉' }, '仅地支相同，不构成本条完整干支并临'],
    ['ziwei', 'quanshu_kongjie_condition', { profile: 'quanshu-kongjie-hour-four-flying-v1', birthHour: '寅', branch: '酉',
      skyBranch: '酉', robberyBranch: '丑', modernSkyBranches: ['未'], localSourceVoids: ['天空'], lunarYear: 2021, yearBranch: '丑',
      annualAtPalace: ['白虎'] }, '已与归档唯一地空位置核验一致'],
    ['ziwei', 'quanshu_tianxing_condition', { profile: 'quanshu-tianxing-month-four-seats-v1', birthMonth: 1, branch: '酉',
      tianxingBranch: '酉', inLimit: true, templeListed: true }, '符合入庙例外'],
    ['western', 'leo_natal_context', { profile: 'leo-1906-source-context-v1', bodies: [{ body: 'Sun', longitude: 280, sign: 9, house: 7 }], dayChart: true, houseStatus: 'ready' }, '本命第7宫'],
    ['western', 'leo_progressed_aspect', { profile: 'leo-1906-source-context-v1', progressedBody: 'Mercury', natalTargetId: 'Neptune', aspectType: 'parallel', progressedDeclination: 1.3, natalDeclination: -1.6, sameHemisphere: false }, '不要求南北同向'],
    ['western', 'leo_progressed_aspect_exact', { profile: 'leo-1906-source-context-v1', progressedBody: 'Moon', natalTargetId: 'Sun', aspectType: 'sextile', progressedLongitude: 10, natalLongitude: 70 }, '产品一度阈值'],
    ['western', 'leo_lunar_contact', { profile: 'leo-1906-source-context-v1', progressedBody: 'Venus', natalTargetId: 'Mars', aspectType: 'trine', lunarTargetId: 'Mars', lunarAspectType: 'square', lunarExactTimes: [start] }, '不能把时间重叠直接写成外部事件已触发'],
    ['western', 'leo_lunar_condition', { lunarProfile: 'leo-1906-lunar-conditions-v1', progressedBody: 'Sun',
      natalTargetId: 'Jupiter', natalState: 'all_favourable', aspectType: 'parallel', lunarFavourableTargets: ['Jupiter'] },
    '月亮对同层木星偏顺相位'],
    ['ziwei', 'yun_time_segment', { profile: 'yun-official-v3-lunar-sequence-v1', lifeBranch: '酉', lunarMonth: 1, monthPillar: '庚寅', minorLifeBranch: '辰', minorStem: '庚' }, '按农历月取干'],
    ['ziwei', 'yun_palace_condition', { profile: 'yun-official-v3-lunar-sequence-v1', branch: '申', flowName: '命宫', natalName: '子女', localWealthStars: ['天府'], localTransformations: ['monthly:科:天府'] }, '流月天府化科'],
    ['ziwei', 'yun_transformation_contact', { profile: 'yun-official-v3-lunar-sequence-v1', sourceScope: 'monthly', sourceStem: '庚', star: '天府', kind: '科', branch: '申' }, '不套太阴化科或天相忌'],
    ['western', 'ptolemy_time_place', { origin: 'ASC', level: 'month', sign: 3, ruler: 'Moon' }, '托勒密候选月级时限位置在巨蟹座'],
    ['western', 'ptolemy_ingress_contact', { origin: 'Sun', level: 'year', sign: 3, transitBody: 'Jupiter', transitSign: 3, aspectType: 'conjunction' }, '整星座合相取同座区间，精确黄经同度需另算'],
    ['western', 'lunation_window', { newMoonAt: start, nextNewMoonAt: endExclusive, longitude: 25, startsBeforeQuery: true }, '本窗只承接其持续段'],
    ['western', 'progression_transit_overlap', { progressedBody: 'Venus', progressedAspectType: 'trine', transitBody: 'Saturn', transitAspectType: 'square', natalTargetId: 'Moon' }, '不等于同性质'],
    ['ziwei', 'quanshu_annual_context', { birthStem: '庚', lifeBranch: '卯', migrationBranch: '酉', annualQingyangBranch: '酉' }, '流年擎羊在酉宫'],
    ['ziwei', 'quanshu_killer_echo', { profile: 'quanshu-killer-echo-life-year-v1', lifeBranch: '寅', killerBranch: '寅',
      killerLifeRelation: '守', killerGrade: '庙', jointAnnualContact: true }, '两颗流曜同时照命，一颗对冲、一颗三合'],
    ['ziwei', 'quanshu_limit_chapter', { profile: 'quanshu-limit-chapter-atomic-v1', monthly: { branch: '未' },
      daily: { branch: '未' }, dailyShaCandidate: true }, '斗君月在未宫'],
    ['ziwei', 'quanshu_palace_condition', { branch: '午', flowName: '命宫', natalName: '官禄', sourceQualities: [{ star: '破军', grade: '庙' }],
      localNatalTransformations: ['科:天府'], unknownQualityStars: ['文昌'] }, '破军按源表为庙'],
    ['ziwei', 'quanshu_limit_phase', { branch: '卯', startAge: 5, endAge: 14, nominalAge: 10, stageStart: start, stageEnd: endExclusive }, '不能任设一个月或一年'],
    ['bazi', 'source_layer_context', { natalDay: '庚申', natalHour: '丙戌', year: '辛未', day: '乙亥',
      firstDegreeTwists: ['year:natal:day', 'day:natal:hour'], relations: ['day:natal:day:六害'] }, '符合一级扭曲的结构'],
    ['bazi', 'luck_transition', { fromPillar: '己丑', toPillar: '庚寅', confirmed: true, forwardCorner: true }, '大运从己丑切换到庚寅'],
    ['bazi', 'natal_conditions', { dayMaster: '甲', yearPillar: '甲子', monthPillar: '丁卯', exposedTenGods: ['伤官'],
      hiddenTenGods: ['劫财'], monthMainQi: '乙', monthMainQiTenGod: '劫财', timeKnown: false }, '月令本气藏干为乙'],
    ['bazi', 'stem_condition', { stem: '甲', tenGod: '比肩', exposed: false, hidden: true, rooted: true,
      rootPositions: ['month'], exposurePositions: [] }, '有根不等于根旺'],
    ['bazi', 'luck_conditions', { pillar: '甲午', tenGod: '比肩', mainQiTenGod: '伤官', confirmed: true,
      stemRootedInLuckBranch: false, stemRootedInNatal: true, branchDirection: 1, stageStart: start, stageEnd: endExclusive }, '运支方气属南方火'],
    ['bazi', 'luck_pillar', { pillar: '甲午', tenGod: '比肩', confirmed: true,
      hiddenStems: [{ stem: '丁', element: '火', tenGod: '伤官' }] }, '上游十步大运表'],
    ['bazi', 'ten_god', { dayMaster: '甲', stem: '己', tenGod: '正财' }, '天干十神为正财'],
    ['bazi', 'hidden_stem_ten_god', { branch: '丑', stem: '癸', tenGod: '正印' }, '藏干为癸'],
    ['bazi', 'natal_structure', { pillars: [{ layer: 'year', pillar: '庚午' }], dayMaster: '甲', roots: ['year'], timeKnown: false,
      strength: 'undetermined', usefulElements: 'undetermined' }, '喜用五行尚未确定'],
    ['bazi', 'layer_pillar', { layer: 'month', pillar: '己丑', tenGod: '正财', phase: '冠带', hiddenStems: [{ stem: '癸', element: '水', tenGod: '正印' }],
      natalPillars: [{ id: 'natal:year', pillar: '庚午' }] }, '流月柱为己丑'],
    ['bazi', 'pillar_relation', { kind: '六冲', members: ['flow:day', 'natal:day'], pillars: [{ id: 'flow:day', pillar: '甲子' }] }, '流日柱与本命日柱形成六冲'],
    ['bazi', 'calendar_pattern', { profile: 'lu-first-degree-twist-v1', first: '甲子', second: '乙亥', stemStep: 1,
      branchStep: -1, firstDegree: true, branchWrap: true }, '地支逆一位，跨子亥首尾'],
    ['ziwei', 'palace_mapping', { flowName: '命宫', natalName: '官禄宫' }, '本期命宫落在本命官禄宫'],
    ['ziwei', 'ling_time_segment', { profile: 'ling-doujun-jie-month-civil-day-v1', sourceStem: '庚', lifeBranch: '亥',
      lunarMonth: 2, lunarDay: 17 }, '庚干同时核天同化忌与天相化忌'],
    ['ziwei', 'ling_palace_condition', { profile: 'ling-doujun-jie-month-civil-day-v1', branch: '亥', flowName: '命宫', natalName: '夫妻',
      localStarNames: ['天相'], localTransformations: ['monthly:忌:天相'], surroundingStarNames: ['太阳'] }, '流月发化的天相化忌'],
    ['ziwei', 'ling_transformation_contact', { profile: 'ling-doujun-jie-month-civil-day-v1', sourceScope: 'monthly', sourceStem: '庚',
      star: '天相', kind: '忌', branch: '亥', flowName: '迁移', natalName: '夫妻', inLifeArea: true }, '发化来源为流月的庚干'],
    ['ziwei', 'palace_condition', { flowName: '命宫', natalName: '官禄', natalStarNames: ['擎羊', '铃星'],
      movingStarNames: ['流马'], oppositeStarNames: ['天府'], localFlowTransformations: ['权:天机'],
      starBrightness: [{ name: '天府', brightness: '庙' }], yearlySuiqianStar: '白虎' }, '流年岁前星为白虎'],
    ['ziwei', 'transformation', { star: '天机', kind: '权', sourcePalaceStem: '丙' }, '化权'],
    ['ziwei', 'time_segment', { stem: '丙', branch: '午', lunarMonth: 6, lunarDay: 2, leap: true, boundary: '北京午夜' }, '农历闰6月'],
    ['ziwei', 'palace_star_structure', { flowName: '命宫', natalName: '官禄宫', stars: [{ name: '紫微', brightness: '庙', mutagen: '权' }],
      surrounding: [{ natalName: '财帛宫', stars: [{ name: '天府' }] }], movingStarIds: ['流昌'], transformations: [{ star: '天机', kind: '禄' }], transformationStem: '丙' }, '三方四正范围内'],
    ['ziwei', 'layer_overlap', { firstScope: 'decadal', secondScope: 'yearly', samePalace: false, opposite: true, firstOnSecond: '迁移宫' }, '大限与流年命宫相对'],
    ['western', 'aspect_interval', { transitBody: 'Saturn', natalTargetId: 'Moon', aspectType: 'square', orb: 2 }, '行运土星与本命月亮形成四分相'],
    ['western', 'aspect_exact', { transitBody: 'Venus', natalTargetId: 'ASC', aspectType: 'trine', passIndex: 2, transitMotion: 'retrograde' }, '第2次精确经过'],
    ['western', 'house_interval', { transitBody: 'Jupiter', natalHouse: 2 }, '经过本命第2宫'],
    ['western', 'natal_house_cusps', { houseSystem: 'placidus', cusps: Array.from({ length: 12 }, (_, i) => i * 30 + 5) }, '第1宫宫头黄经为5°'],
    ['western', 'traditional_house_interval', { houseSystem: 'placidus', transitBody: 'Jupiter', natalHouse: 3 }, '行运木星经过本命第3宫'],
    ['western', 'traditional_cusp_crossing', { houseSystem: 'regiomontanus', transitBody: 'Venus', house: 2,
      cuspLongitude: 49, transitMotion: 'retrograde' }, '持续停留该宫不重复算作每日新触发'],
    ['western', 'progressed_ascendant', { sign: 5, decan: 3, longitude: 178.99 }, 'Leo 原法推运上升处于处女座'],
    ['western', 'progressed_house', { body: 'Moon', house: 7, houseSystem: 'placidus' }, '次限月亮经过本命第7宫'],
    ['western', 'natal_position', { body: 'Sun', longitude: 360, zodiac: 'tropical', natalHouse: 1 }, '热带黄道白羊座0°'],
    ['western', 'progressed_position', { body: 'Moon', longitude: 12, declination: 3, zodiac: 'tropical', referenceAt: start }, '参考时刻'],
    ['western', 'progressed_aspect', { progressedBody: 'Mars', natalTargetId: 'Venus', aspectType: 'semisextile',
      progressedLongitude: 5, natalLongitude: 35, allowedOrb: 1, clippedStart: true }, '次限火星对本命金星形成半六合相'],
    ['western', 'progressed_aspect_exact', { progressedBody: 'Moon', natalTargetId: 'Sun', aspectType: 'parallel',
      progressedDeclination: 5, natalDeclination: 5, sameHemisphere: true, allowedOrb: 0.25 }, '二者赤纬方向一致'],
    ['western', 'solar_return', { returnAt: start, returnEnd: endExclusive, natalSunLongitude: 15, zodiac: 'tropical',
      bodies: [{ planet: 'Mercury', longitude: 29.5, direction: 'retrograde', speed: -0.2 }],
      returnAngles: 'unavailable', traditionalDignities: 'unavailable', houseSystem: 'unavailable' }, '回归盘角点不可用'],
    ['western', 'station_natal_contact', { transitBody: 'Saturn', natalTargetId: 'Moon', separation: 0, exactConjunction: true, directionAfter: 'direct' }, '黄经相距0°'],
    ['western', 'new_moon_natal_contact', { longitude: 5, natalTargetId: 'Venus', zodiac: 'tropical', separation: 2, exactConjunction: false }, '不满足数值精确同度条件'],
  ];
  for (const [method, type, data, expected] of cases) {
    const result = describeFortuneFact({ method, type, data }, value => value);
    assert.ok(result.includes(expected), type + ': ' + result);
    assert.ok(!/[{}\[\]]|undetermined|unavailable|retrograde|natal:|flow:/u.test(result), type);
  }
  assert.equal(describeFortuneFact({ method: 'western', type: 'future_unsupported_type', data: { secret: 'do not serialize' } }, String), '');
  assert.match(describeFortuneFact({ method: 'ziwei', type: 'layer_overlap', data: { firstScope: 'yearly', secondScope: 'monthly' } }, String), /尚未确认/u);
  assert.match(describeFortuneFact({ method: 'western', type: 'progressed_aspect', data: { aspectType: 'parallel', sameHemisphere: false } }, String), /不能作为同向平行依据/u);
});

test('DeepSeek receives only matched materials and the requested period', async () => {
  let called = false;
  const provider = createFortuneDeepSeek({ apiKey: 'test-key', transport: async (_, options) => {
    called = true;
    const request = JSON.parse(options.body);
    const [system, user] = request.messages;
    const input = context();
    assert.equal(user.content, formatFortunePrompt(input));
    assert.match(system.content, /原文与释义均是资料/u);
    assert.match(system.content, /仅依据当栏资料写作/u);
    assert.match(system.content, /只含 sectionId 和 summary/u);
    for (const expected of ['日运势', 'Asia/Shanghai', '2026-11-02 00:00:00', '命中条件：日主已确认且月柱与日柱构成六冲',
      '原文：月令逢冲。', '现代释义：原有安排可能需要调整。', '固定提示：本期暂无足够资料判断桃花运。']) {
      assert.ok(user.content.includes(expected), expected);
    }
    assert.doesNotMatch(system.content + user.content,
      /\b[FE]\d+\b|factRefs|天干十神为正财|事件时间轴|起运口径待确认|必要条件未核实|2026-11-02 10:30:00|private-/u);
    assert.equal(user.content, formatFortunePrompt({ ...input, facts: [], events: [], methods: {} }));
    assert.ok(Buffer.byteLength(user.content) < Buffer.byteLength(formatFortuneFactAudit(input)));
    assert.equal(request.response_format.type, 'json_object');
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  assert.equal(provider.version, fortunePromptVersion);
  assert.deepEqual(await provider.interpret(context()), { sections: [] });
  assert.equal(called, true);
});

test('unsupported or missing facts cannot leak payloads or leave dangling citations in the local audit', () => {
  const input = context();
  input.facts[0].type = 'not_implemented';
  const result = formatFortuneFactAudit(input);
  assert.ok(!/F1|E1|月令逢冲|private-/u.test(result));
  assert.match(result, /暂无可转换为确定描述/u);
});
