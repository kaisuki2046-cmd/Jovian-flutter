import { westernFixedStarNames } from '../control/western-fixed-stars.mjs';
import { lillyEnemyTestimonies, lillyEnemyUsesOrbs } from './knowledge/lilly-enemies.mjs';
import { lillyNinthHouseTestimonies, lillyNinthHouseUsesOrbs } from './knowledge/lilly-ninth-house.mjs';
import { lillyMannersTestimonies, lillyMannersUsesOrbs } from './knowledge/lilly-manners.mjs';
import { lillyTemperamentWitnesses, lillyTemperamentUsesOrbs } from './knowledge/lilly-temperament.mjs';
import { lillyMerchantCaseFactText } from './knowledge/lilly-merchant-case.mjs';
import { lillyParentDerivedFactText } from './knowledge/lilly-parent-derived-role.mjs';

const names = {
  year: '年柱', month: '月柱', day: '日柱', hour: '时柱',
  Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星',
  Saturn: '土星', Uranus: '天王星', Neptune: '海王星', Pluto: '冥王星',
  ascendant: '上升点', descendant: '下降点', mc: '天顶', direct: '顺行', retrograde: '逆行', stationary: '留',
  early: '初段', middle: '中段', late: '末段',
  star: '星曜', number: '数理', occupies: '同宫',
  opposite: '对宫', trine: '三合', adjacent: '相邻', branch_opposition: '六冲',
  same_palace: '同宫', opposite_palace: '对宫', trine_palaces: '三合',
};
export const valueText = value => names[value] ?? String(value);
const travelPlace = value => ({ fortune: '福点', mc: '中天', ascendant: '上升点' })[value] ?? valueText(value);
const palaceName = value => value.endsWith('宫') ? value : value + '宫';
const branchNames = '子丑寅卯辰巳午未申酉戌亥';
const daylight = f => f.sect === 'day' ? '日盘' : '夜盘';
const period = f => `${f.startAge}至${f.endAge}虚岁`;
const aspect = f => `${valueText(f.first)}与${valueText(f.second)}形成${f.aspect}`;
const tenGod = f => `${valueText(f.position)}地支中有${f.tenGod}`;
const cycleStar = label => f => `${palaceName(f.palace)}的${label}为${f.star}`;
const lunarMonth = f => `农历${f.leap ? '闰' : ''}${f.month}月`;
const lillySelector = selector => /^house_(\d+)_ruler$/u.test(selector)
  ? `第${/^house_(\d+)_ruler$/u.exec(selector)[1]}宫主`
  : selector === 'fortune_ruler' ? '福点主'
  : ['sun_dispositor', 'moon_dispositor'].includes(selector) ? `${selector === 'sun_dispositor' ? '太阳' : '月亮'}所在星座的传统庙主`
  : valueText({ sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn' }[selector]);
const lillyContact = { conjunction: '合相', sextile: '六合', square: '刑相', trine: '拱相', opposition: '冲相', friendly: '六合或拱相', any: '一般相位关系（合相歧义另留待核）' };
const lillyPrefermentDignityText = {
  domicile: '入庙', exaltation: '擢升', mutual: '有本质尊贵互容', triplicity: '掌本昼夜三分主',
  term: '掌本界', face: '掌本面', peregrine: '漂泊且无本质接纳', detriment: '失势且无本质接纳', fall: '落陷且无本质接纳',
};
const signClassSelector = selector => /^house_(7|11)_cusp$/u.test(selector) ? `第${/^house_(7|11)_cusp$/u.exec(selector)[1]}宫头`
  : selector === 'venus_dispositor' ? '金星所在星座的传统庙主' : lillySelector(selector);
const cardanoDignityText = {
  cardano_1578: () => '采用卡尔达诺 1578 年译注的角位口径',
  sun_masculine: matches => `太阳在${matches ? '阳' : '阴'}性座`,
  moon_masculine: matches => `月亮在${matches ? '阳' : '阴'}性座`,
  sun_angular: matches => `太阳${matches ? '居角' : '离角'}`,
  moon_angular: matches => `月亮${matches ? '居角' : '离角'}`,
  one_angular: matches => matches ? '日月恰有一颗居角' : '日月同为居角或同为离角',
  fourth_state: matches => matches ? '符合原注所列第四档的日月组合' : '未符合原注所列第四档的日月组合',
};
const ptolemyParentText = {
  hubner_greek: '采用 Hübner 希腊校勘本的日月伴随条件',
  allacci_latin: '采用 Allacci 拉丁译本的日月伴随条件',
  'attendance.in_sect_beneficial': '日月各有一颗同派吉星在同座或后继一座',
  'active_parent.father': '核对父方优先指征',
  'active_parent.mother': '核对母方优先指征',
  'active_luminary_or_planet.sun': '本次优先观察太阳',
  'active_luminary_or_planet.saturn': '本次优先观察土星',
  'active_luminary_or_planet.venus': '本次优先观察金星',
  'active_luminary_or_planet.moon': '本次优先观察月亮',
};
function ptolemyParentFactText({ selector }) {
  if (Object.hasOwn(ptolemyParentText, selector)) return ptolemyParentText[selector];
  const [, light, attendance] = selector.split('.');
  const position = attendance.endsWith('same_sign') ? '同座' : '后继一座';
  return `${light === 'sun' ? '太阳' : '月亮'}${position}有${attendance.startsWith('benefic_') ? '吉星' : '同派星'}伴随`;
}
const lillyTravelText = {
  established: '已有莉莉所列的远行见证',
  moon_or_mercury_conj_or_received_by_ruler_1_or_9: '月亮或水星与第一、九宫主之一合相，或获该宫主接纳',
  moon_mercury_in_or_dignified_in_house_1_3_9: '月亮或水星在第一、三、九宫之一落宫或具尊贵',
  'relevant_significators_sign_mode.movable': '远行指征星均落活动座',
  'relevant_significators_sign_mode.fixed': '远行指征星均落固定座',
  'transport_branches.fire_or_earth': '多数远行指征星在火象或土象座',
  'transport_branches.water_or_air': '多数远行指征星在水象或风象座',
  'transport_branches.quadrupedal': '远行指征星均落原书的四足星座',
  'transport_branches.human': '远行指征星均落原书的人形星座',
  'motives.significator_in_house_1': '至少一颗远行指征星在第一宫',
  'motives.significator_in_house_2': '至少一颗远行指征星在第二宫',
  'motives.saturn.signifies': '土星本身是远行指征星',
  'motives.saturn.conjoins_a_significator': '土星与一颗远行指征星合相',
  'motives.saturn.has_essential_dignity_at_a_significator': '土星在一颗远行指征星的星位具本质尊贵',
  'motives.jupiter.applies': '木星本身是远行指征星，或与一颗指征星合相，或在该星位具本质尊贵',
  abenrodan: '采用莉莉所引阿本罗丹的方位取法',
  'direction.both_luminaries_abenrodan_quarter.east': '日月均落阿本罗丹所列的东区宫位',
  'direction.both_luminaries_abenrodan_quarter.west': '日月均落阿本罗丹所列的西区宫位',
  malefic_aspect: '火星或土星与一颗已核实的远行指征星成相',
  significators_in_malefic_domiciles: '远行指征所在星座的庙主是火星或土星，且庙主与指征是不同星体',
  'obstruction.travel_significator_selected': '已从实际远行见证中选定指征星',
  'obstruction.saturn_or_mars_selected': '火星或土星已与该远行指征建立阻碍关系',
  'obstruction.afflicts_travel_significator': '火星或土星与同一颗远行指征星合相、四分或对冲',
  'obstruction.lords_travel_significator_place': '火星或土星是同一颗远行指征星的落座庙主',
  'active_obstructing_malefic.mars': '火星实际构成本章所列的远行阻碍见证',
  'active_obstructing_malefic.saturn': '土星实际构成本章所列的远行阻碍见证',
  'obstructing_malefic_house.3': '实际构成远行阻碍的火星或土星落第三宫',
  'obstructing_malefic_house.12': '实际构成远行阻碍的火星或土星落第十二宫',
  'difficulty_sign_classes.moist': '受阻指征落原书湿性分类的风象或水象星座',
  'difficulty_sign_classes.fixed_except_scorpio': '受阻指征落金牛、狮子或水瓶座',
  'difficulty_sign_classes.movable': '受阻指征落活动星座',
  'difficulty_sign_classes.human': '受阻指征落原书的人形星座',
  'difficulty_sign_classes.bestial': '受阻指征落原书的四足星座',
};
function lillyTravelFactText({ table, selector }) {
  const [group, value] = selector.split('.');
  const element = { fire: '火象', earth: '土象', air: '风象', water: '水象' }[value];
  const detail = lillyTravelText[selector] ?? (group === 'active_significators'
    ? `${lillySelector(value)}是已核对的远行指征星` : `有远行方位指征星落${element}星座`);
  return `按莉莉${table === 'main' ? '首列' : '另一说'}容许度，${detail}`;
}
const lillySiblingSigns = {
  aries: '白羊座', taurus: '金牛座', gemini: '双子座', cancer: '巨蟹座', leo: '狮子座', virgo: '处女座',
  libra: '天秤座', scorpio: '天蝎座', sagittarius: '射手座', capricorn: '摩羯座', aquarius: '水瓶座', pisces: '双鱼座',
};
const lillySiblingCuspAndRuler = {
  house_3_cusp_prolific: '第三宫宫头在本篇所列多产座',
  house_3_ruler_prolific: '第三宫宫主落在本篇所列多产座',
  house_3_cusp_barren: '第三宫宫头在本篇所列少产座',
  house_3_ruler_barren: '第三宫宫主落在本篇所列少产座',
};
function lillySiblingsFactText({ selector }) {
  if (Object.hasOwn(lillySiblingCuspAndRuler, selector)) return lillySiblingCuspAndRuler[selector];
  const [group, value] = selector.split('.');
  if (group === 'sign') return `手足篇所核对的第三宫宫头或指征星见${lillySiblingSigns[value]}`;
  if (group === 'angular') return `按莉莉五度规则，${lillySelector(value)}在角宫`;
  if (value === 'south_node') return '按莉莉五度规则，南交点在第三宫';
  return `${lillySelector(value)}是本盘手足篇的指征星`;
}
const lillyWealthSourceText = {
  second_house_method: '采用莉莉卷三的第二宫财富取证法',
  complete: '财富指征所需的七曜黄经、宫头和福点均已确认',
  has_planet: '本盘已选出财富指征星',
  nearer_cusp: '第二宫观察区间内有两颗候选星，其中一颗距第二宫头更近',
  'role.second_house_ruler': '取第二宫宫主为财富指征',
  'role.intercepted_sign_ruler': '第二宫确有截夺座，取其传统庙主为财富指征',
  'role.fortune_lot': '已算出莉莉卷三取用的福点',
  'role.fortune_lot_ruler': '取福点所落星座的传统庙主为财富指征',
  'role.jupiter': '按原书取木星为一般财富指征',
  'role.second_house_window_planet': '有行星按五度规则落第二宫',
  'nature.benefic': '已选出的财富指征中有木星或金星',
  'nature.malefic': '已选出的财富指征中有土星或火星',
};
function lillyWealthSourceFactText({ selector }) {
  if (Object.hasOwn(lillyWealthSourceText, selector)) return lillyWealthSourceText[selector];
  const [group, value] = selector.split('.');
  if (group === 'planet') return `${lillySelector(value)}是本盘的财富指征星`;
  if (group === 'house') return `已选出的财富指征星中有星落第${value}宫`;
  return `已选出的财富指征星中有星落${{ fire: '火', earth: '土', air: '风', water: '水' }[value]}象星座`;
}
const lillyChildrenText = {
  fifth_outweighs_eleventh: '第五宫内有本篇的多产行星，第十一宫内有相反性质的行星',
  mixed_fecund_planet_barren_sign: '本篇选中的一颗多产行星落少产座',
  mixed_barren_planet_fecund_sign: '本篇选中的一颗少产行星落多产座',
  empty_children_houses: '七曜位置齐备，第一、第五、十一宫都无行星，取第五宫主',
  mercury_active: '水星属于本盘第五宫篇所选的指征',
  fifth_cusp_sign_fertile: '第五宫宫头在本篇所用多产座',
  fifth_ruler_sign_fertile: '第五宫宫主落在本篇所用多产座',
  ascending_sign_fertile: '上升星座在本篇所用多产座',
  venus_and_moon_fifth_fertile: '金星和月亮都在第五宫，且分别落多产座',
  all_planets_fertile_signs: '传统七曜均在本篇所用多产座',
  fifth_ruler_retrograde: '第五宫宫主逆行',
  active_malefic: '本篇所选的指征中有火星或土星',
  barren_planet_in_barren_sign: '本篇选中的一颗少产星体也落少产座',
  'quantity.common_only': '第五或十一宫的多产行星落在只具双体性质的星座',
  'quantity.fruitful_only': '第五或十一宫的多产行星落在不属双体的多产座',
};
function lillyChildrenFactText({ selector }) {
  if (Object.hasOwn(lillyChildrenText, selector)) return lillyChildrenText[selector];
  const [group, value] = selector.split('.');
  if (group === 'fruitful_occupant') return `第${value}宫有同属多产星体且落多产座的指征`;
  const body = { north_node: '北交点', south_node: '南交点' }[value] ?? lillySelector(value);
  return `${body}是本盘第五宫篇所选的指征`;
}
const signClassName = { movable: '活动座', fixed: '固定座', common: '变动座', fire: '火象', earth: '土象', air: '风象', water: '水象',
  fruitful: '多产座', fruitful_or_common: '多产座或双体座',
  tropic: '本书回归座（巨蟹、摩羯）', human: '本段人形星座', profession_quadrupedal: '职业段四足星座（白羊、狮子、射手）' };
const solarConditionName = { combust: '燃烧', under_beams: '日光束内', cazimi: '日心', free_of_beams: '距太阳已满17度', oriental: '相对太阳为东方', occidental: '相对太阳为西方' };

// Each supported fact has a sentence template; no machine keys or JSON fallback.
const sentences = {
  pillar: f => `${valueText(f.position)}为${f.ganZhi}`,
  stem: f => `${valueText(f.position)}天干为${f.stem}`,
  branch: f => `${valueText(f.position)}地支为${f.branch}`,
  stem_ten_god: f => `${valueText(f.position)}天干十神为${f.tenGod}`,
  hidden_ten_god: f => `${valueText(f.position)}藏干${f.stem}的十神为${f.tenGod}`,
  branch_ten_god: tenGod,
  branch_main_ten_god: f => `${valueText(f.position)}地支本气十神为${f.tenGod}`,
  shen_sha: f => `${valueText(f.position)}见${f.name}`,
  pillar_nayin: f => `${valueText(f.position)}纳音为${f.name}`,
  pillar_xun: f => `${valueText(f.position)}属于${f.head}旬`,
  day_stem_phase: f => `日干在${valueText(f.position)}处于${f.phase}`,
  day_master_strength: f => `日主${f.result}`,
  bazi_ten_god_structure: f => `具备${f.name}的十神结构条件`,
  bazi_branch_relation: f => `${valueText(f.first)}与${valueText(f.second)}地支${f.relation}`,
  bazi_stem_combination: f => `${valueText(f.first)}与${valueText(f.second)}天干相合`,
  bazi_stem_transformation: f => `${f.pair}合化${f.element}`,
  bazi_day_stem_transformation: f => `日干${f.stem}与${f.partner}满足合化${f.element}的排盘条件`,
  bazi_ten_god_count: f => `${f.tenGod}共${f.count}处`,
  bazi_stem_placement_count: f => `${f.stem}${{
    visible: '透干', hidden: '藏支', any: '在四柱出现', non_day: '在年、月、时出现',
  }[f.placement]}共${f.count}柱`,
  bazi_ten_god_strength: f => `${f.group}${f.strength}`,
  bazi_month_pattern: f => `月令格局为${f.name}，${f.result}`,
  bazi_nayin_phase: f => `${valueText(f.position)}纳音处于${f.phase}`,
  bazi_own_stem_phase: f => `${valueText(f.position)}天干在本柱处于${f.phase}`,
  bazi_hidden_god_phase: f => `${valueText(f.position)}藏干十神${f.tenGod}以${f.anchor === 'month' ? '月令' : '本柱'}论为${f.phase}`,
  bazi_natal_configuration: f => `本命具有“${f.name}”结构`,
  bazi_day_master_season: f => `日主在月令中为${f.season}`,
  bazi_element_balance: f => `五行${f.element}${f.band}`,
  bazi_natal_element: f => `本命五行中有${f.element}`,
  bazi_nayin_school: f => `${valueText(f.position)}为${f.school}`,
  bazi_element_temperament: f => `五行${f.element}的情性条件为${f.classification}`,
  bazi_solar_month_xun: f => `出生处于节气月的${valueText(f.band)}`,
  bazi_previous_qi: f => `出生前一个中气为${f.term}`,
  bazi_fetal_month: f => `胎元为${f.ganZhi}`,
  bazi_decadal_range: f => `${period(f)}行${f.ganZhi}大运`,
  palace_star: f => `${palaceName(f.palace)}有${f.star}`,
  palace_branch: f => `${palaceName(f.palace)}位于${f.branch}`,
  palace_sector_star: f => `${palaceName(f.palace)}三方四正会${f.star}`,
  palace_sector_mutagen: f => `${palaceName(f.palace)}三方四正会生年化${f.change}`,
  palace_trine_star: f => `${palaceName(f.palace)}三合宫见${f.star}`,
  palace_life_trines_without_auspicious_mutagens: () => '命宫、财帛宫及官禄宫均无生年化禄、化权、化科',
  palace_life_without_trine_auspicious_mutagens: () => '命宫的两处三合宫均无生年化禄、化权、化科',
  palace_life_without_natal_ji: () => '已确认生年化忌在命宫以外',
  palace_confirmed_body_seat: f => `实际身宫位于${palaceName(f.palace)}`,
  palace_sector_benefic_count: f => `${palaceName(f.palace)}三方四正有${f.count}颗吉星`,
  palace_opposite_benefic_count: f => `${palaceName(f.palace)}对宫有${f.count}颗六吉星`,
  palace_opposite_six_malefic_count: f => `${palaceName(f.palace)}对宫有${f.count}颗六煞星`,
  palace_sector_malefic_count: f => `${palaceName(f.palace)}三方四正有${f.count}颗煞星`,
  palace_sector_six_malefic_count: f => `${palaceName(f.palace)}三方四正的四煞与空劫合计${f.count}颗`,
  palace_sector_benefic_majority: f => `${palaceName(f.palace)}三方四正至少两颗六吉，且六吉多于六煞`,
  palace_sector_all_benefic: f => `${palaceName(f.palace)}三方四正全吉`,
  palace_major_state: f => `${palaceName(f.palace)}主星为${f.state}`,
  palace_body_star_group: f => `命身宫会${f.group}`,
  palace_mutagen: f => `${palaceName(f.palace)}有化${f.change}`,
  natal_ziwei_mutagen_branch: f => `生年化${f.change}落在${f.branch}位`,
  palace_mutagen_brightness: f => `${palaceName(f.palace)}化${f.change}之星亮度为${f.brightness}`,
  palace_brightness: f => `${palaceName(f.palace)}${f.star}亮度为${f.brightness}`,
  palace_source_brightness: f => `${palaceName(f.palace)}${f.star}位于${f.branch}，依《全书》卷二命宫表明度为${f.brightness}`,
  star_mutagen: f => `${palaceName(f.palace)}${f.star}化${f.change}`,
  body_palace: f => `身宫位于${palaceName(f.palace)}`,
  palace_main_count: f => `${palaceName(f.palace)}有${f.count}颗正曜`,
  palace_origin_star_count: f => `${palaceName(f.palace)}本命星共${f.count}颗`,
  palace_core_star_count: f => `${palaceName(f.palace)}核心星共${f.count}颗`,
  palace_boshi_star: cycleStar('博士十二神'),
  palace_suiqian_star: cycleStar('岁前十二神'),
  palace_jiangqian_star: cycleStar('将前十二神'),
  natal_gender: f => `性别为${f.gender}`,
  natal_year_stem: f => `生年天干为${f.stem}`,
  natal_year_branch: f => `生年地支为${f.branch}`,
  natal_daylight: daylight,
  natal_year_nayin_element: f => `年命纳音五行为${f.element}`,
  natal_ziwei_bureau: f => `五行局为${f.bureau}`,
  natal_ziwei_life_phase: f => `命宫长生阶段为${f.phase}`,
  natal_ziwei_hour_phase: f => `出生时支的长生十二神阶段为${f.phase}`,
  palace_changsheng_phase: f => `${palaceName(f.palace)}的长生十二神阶段为${f.phase}`,
  natal_ziwei_hour: f => `生于${f.branch}时`,
  natal_ziwei_time_band: f => `生于${f.branch}时${valueText(f.band)}`,
  ziwei_grade: f => `${valueText(f.dimension)}品级为${f.grade}`,
  ziwei_life_body_clash: () => '命宫与身宫对冲',
  ziwei_eight_seats: () => '具备八座结构',
  ziwei_confirmed_natal_layout: () => '本命十二宫地支布局已核实',
  natal_lunar_month: lunarMonth,
  palace_relation: f => `${palaceName(f.anchor)}与${palaceName(f.target)}${valueText(f.relation)}`,
  ziwei_decadal_range: f => `${period(f)}大限在${palaceName(f.palace)}`,
  natal_classical_region: f => `古籍分野为${f.zone}`,
  ziwei_daozang_input: f => `道藏排盘口径为${f.yearBranch}年、${lunarMonth(f)}${f.day}日、${branchNames[f.hour]}时`,
  daozang_star_branch: f => `道藏盘${f.star}位于${f.branch}`,
  daozang_palace_star: f => f.relation === 'occupies' ? `道藏盘${palaceName(f.palace)}有${f.star}`
    : `道藏盘${palaceName(f.palace)}与${f.star}${valueText(f.relation)}`,
  daozang_palace_star_count: f => `道藏盘${palaceName(f.palace)}有${f.count}颗星`,
  western_zodiac: () => '采用热带黄道',
  western_house_system: () => '采用整宫制',
  western_profile_system: () => '另以雷吉奥蒙塔努斯宫制独立核对指定该宫制的资料，落宫包含天体纬度',
  western_profile_house_sign: f => `雷吉奥蒙塔努斯宫制第${f.house}宫的宫头位于${f.sign}`,
  western_profile_cusp_longitude: f => `雷吉奥蒙塔努斯第${f.house}宫头黄经为${f.longitude.toFixed(6)}度`,
  planet_longitude: f => `${valueText(f.planet)}黄经为${f.longitude.toFixed(6)}度`,
  western_true_node_longitude: f => `瞬时月球北交点黄经为${f.longitude.toFixed(6)}度`,
  western_fixed_star_longitude: f => `${westernFixedStarNames[f.star]}在该时刻的热带视黄经为${f.longitude.toFixed(6)}度`,
  western_geometry_ascendant: f => `上升点的实算热带黄经为 ${f.longitude.toFixed(4)}°`,
  western_geometry_midheaven: f => `中天的实算热带黄经为 ${f.longitude.toFixed(4)}°`,
  western_geometry_obliquity: f => `出生时刻的真黄赤交角为${f.obliquity.toFixed(6)}度`,
  western_geometry_planet_latitude: f => `${valueText(f.planet)}在出生时刻的视黄纬为${f.latitude.toFixed(6)}度`,
  western_geometry_planet_latitude_motion: f => `${valueText(f.planet)}在出生时刻前后各半小时之间的有向视黄纬位移为${f.signedDegrees.toFixed(6)}度`,
  western_geometry_star_latitude: f => `${westernFixedStarNames[f.star]}在出生时刻的视黄纬为${f.latitude.toFixed(6)}度`,
  western_cardano_dignity: f => cardanoDignityText[f.selector](f.matches),
  western_ptolemy_parent: ptolemyParentFactText,
  western_lilly_travel: lillyTravelFactText,
  western_lilly_enemies: ({ table, selector }) => lillyEnemyTestimonies[selector]
    + (lillyEnemyUsesOrbs(selector) ? `（莉莉${table === 'main' ? '首列' : '另一说'}容许度）` : ''),
  western_lilly_ninth_house: ({ table, selector }) => lillyNinthHouseTestimonies[selector]
    + (lillyNinthHouseUsesOrbs(selector) ? `（莉莉${table === 'main' ? '首列' : '另一说'}容许度）` : ''),
  western_lilly_manners: ({ table, selector }) => lillyMannersTestimonies[selector]
    + (lillyMannersUsesOrbs(selector) ? `（莉莉${table === 'main' ? '首列' : '另一说'}容许度）` : ''),
  western_lilly_temperament: ({ table, selector }) => lillyTemperamentWitnesses[selector]
    + (lillyTemperamentUsesOrbs(selector) ? `（莉莉${table === 'main' ? '首列' : '另一说'}容许度）` : ''),
  western_lilly_merchant_case: lillyMerchantCaseFactText,
  western_lilly_parent_derived_role: lillyParentDerivedFactText,
  western_lilly_siblings: lillySiblingsFactText,
  western_lilly_wealth_source: lillyWealthSourceFactText,
  western_lilly_wealth_star_contact: f => `${westernFixedStarNames[f.star]}与${f.target === 'lot' ? '福点' : '福点主' + valueText(f.target)}的实际黄经同整度`,
  western_lilly_wealth_lot_pressure: f => `${valueText(f.planet)}向实际福点成对应整度的${lillyContact[f.aspect]}`,
  western_lilly_wealth_principal: f => `${valueText(f.planet)}为主指征星，${{
    sole_occupant: '实际独居第二宫', strongest_occupant: '在第二宫入宫星中积分区间独占优势',
    shared_ruler: '第二宫无七曜入宫，且该星兼任二宫主与福点主',
  }[f.basis]}`,
  western_lilly_wealth_strength: f => `${valueText(f.planet)}在卷一强弱表中${{
    powerful: '有力', weak: '偏弱', moderate: '已证加分与扣分平衡',
  }[f.strength]}`,
  western_lilly_wealth_score: f => `${valueText(f.planet)}的卷一强弱表积分${f.min === f.max ? `为 ${f.min}` : `为 ${f.min} 至 ${f.max}`}`,
  western_lilly_wealth_participant: f => `${valueText(f.planet)}参与本段财富取证，按莉莉宫制实际落第 ${f.house} 宫`,
  western_lilly_wealth_quarter: f => `${f.basis === 'strongest' ? '全组最有力的指征星' : '过半的财富指征星'}落在${['第十至十二宫', '第七至九宫', '第四至六宫', '第一至三宫'][f.quarter - 1]}`,
  western_lilly_wealth_timing_motion: f => `${valueText(f.planet)}${{
    oriental: '在太阳东方', occidental: '在太阳西方', retrograde: '实际逆行', direct_swift: '顺行且快于卷一平均日行量',
  }[f.motion]}`,
  western_lilly_wealth_saturn: f => `土星承担主指征，日月${f.luminaries === 'both' ? '均参与' : '均未参与'}同组财富取证`,
  western_lilly_children: lillyChildrenFactText,
  western_lilly_wit: f => ({
    mercury_at_ascendant_cusp: '水星与上升点在黄道同一度位',
    majority_air: '七颗古典星体中至少四颗在风象星座',
    moon_conjoins_node: '月亮与其中一个月交点在黄道同一度位',
    mercury_below_horizon: '水星黄道投影位于地平以下',
    mercury_above_horizon: '水星黄道投影位于地平以上',
    mercury_angular: '按莉莉宫头前五度规则，水星在角宫',
    mercury_cadent: '按莉莉宫头前五度规则，水星在果宫',
    mercury_partile_mars: '火星与水星同度合相、刑相或对冲',
    mercury_partile_saturn: '土星与水星同度合相、刑相或对冲',
  })[f.selector],
  planet_daily_motion: f => `${valueText(f.planet)}以本次时刻为中心的24小时黄经位移为${f.signedDegrees.toFixed(6)}度（负为逆向）`,
  planet_hourly_motion: f => `${valueText(f.planet)}在出生时刻前后各半小时之间的有向黄经位移为${f.signedDegrees.toFixed(6)}度`,
  western_lilly_ruleset: () => '莉莉本命宫位判读采用黄经，并把宫头前五度计入下一宫；宫主仅取传统庙主',
  western_lilly_house_ruler: f => `莉莉第${f.house}宫的传统宫主为${valueText(f.planet)}`,
  western_lilly_planet_house: f => `按莉莉宫头前五度规则，${valueText(f.planet)}判入第${f.house}宫`,
  western_lilly_friend_significator: f => {
    const house = `第${f.house}宫`, planet = valueText(f.planet);
    return {
      occupant: `按宫头前五度规则，${planet}落入${house}而成为友伴指征`,
      cusp_ruler: `${planet}是${house}宫头所在星座的庙主，为友伴指征`,
      intercepted_ruler: `${planet}是${house}截夺座的庙主，为友伴指征`,
    }[f.role];
  },
  western_lilly_friend_condition: f => {
    const planet = valueText(f.planet);
    return {
      dignified: `${planet}本质尊贵入庙或擢升`,
      fortified: `${planet}入庙或擢升，莉莉强弱表的最低可能总分仍为正`,
      weak: `${planet}失势或落陷，莉莉强弱表的最高可能总分仍为负`,
      afflicted: `按莉莉${f.table === 'main' ? '首列' : '另一说'}容许度，${planet}失势或落陷，并与土星或火星成刑相或对冲`,
    }[f.condition];
  },
  western_lilly_node_house: f => `按莉莉宫头前五度规则，${f.node === 'north_node' ? '北交点' : '南交点'}判入第${f.house}宫`,
  western_lilly_node_sign: f => `${f.node === 'north_node' ? '北交点' : '南交点'}位于${f.sign}`,
  western_lilly_profession_ruler: f => `按莉莉职业选星前两步，${valueText(f.planet)}${f.matches ? '满足' : '不满足'}${f.role === 'sole' ? '唯一职业指征' : '职业指征之一'}的条件`,
  western_lilly_profession_step: f => {
    if (f.step === 5) return `莉莉职业选星第5步，${valueText(f.planet)}是已确认唯一先于太阳升起的职业候选`;
    if (f.step === 4) {
      const decision = {
        qualifies: '的月亮相位在半容许度内，且已排除土星或火星的合、刑、冲',
        afflicted: '的月亮相位在半容许度内，但受土星或火星合、刑、冲，按此步排除',
        selected: '是按本步半容许度与凶相排除条件确认的唯一候选',
      }[f.state];
      return `莉莉职业选星第4步，${valueText(f.planet)}${decision}`;
    }
    const description = {
      qualifies: '满足该步职业指征条件',
      peregrine: '为十宫主但缺少本质尊贵',
      fall: '为十宫主但落陷',
      candidate: '以对应整度相位照月，进入候选',
      selected: '是已核的唯一照月候选',
    }[f.state];
    return `莉莉职业选星第${f.step}步，${valueText(f.planet)}${description}`;
  },
  western_lilly_profession_partile_comparison: () => '莉莉职业选星第三步有多颗照月候选，需比较强度和相位',
  western_lilly_profession_tenth_house: () => '已确认第十宫宫头星座，以及该座传统庙主的落座和落宫',
  western_lilly_profession_selected: f => `${valueText(f.planet)}是按莉莉职业选星步骤确认的指征`,
  western_lilly_family_role: f => `${valueText(f.planet)}是莉莉${f.parent === 'father' ? '父亲' : '母亲'}章的${f.role === 'sect' ? '昼夜指征' : '实际指征之一'}`,
  western_lilly_family_source: f => {
    const contact = ['Jupiter', 'Venus'].includes(f.planet) ? '以六合或三合照见' : '以形体合相、刑或冲触及';
    return `${valueText(f.planet)}按莉莉${f.table === 'main' ? '首列' : '另一说'}容许度${contact}${f.parent === 'father' ? '父亲' : '母亲'}章的一颗指征`;
  },
  western_lilly_family_configuration: f => ({
    sun_moon_masculine: '太阳和月亮落在同一个阳性星座',
    sun_south_node_bestial: '太阳落传统兽性座，并与南交点位于同一整度',
    sun_north_node: '太阳和北交点位于同一整度',
    father_mixed: '父亲章的实际指征中同时有强势与弱势行星',
    fourth_cadent_pressure: '两颗宫主及昼夜指征都落果宫，第四宫另有处于弱位的火星或土星',
    estate_fifth_unfortunate: '火星、土星与另一颗担任第五宫主的行星同落第四宫，第五宫主失势或落陷',
    estate_sun_mars_rays_second: '太阳与火星各自以同种整度刑相或冲相触及实际第二宫宫头',
  })[f.selector],
  western_lilly_family_assessment: f => `按莉莉${f.table === 'main' ? '首列' : '另一说'}容许度，${{
    father_all_impeded: '父亲章的实际指征均处弱位，并各自受到火星或土星的合、刑或冲',
    fourth_benefics_supported: '四宫吉星及其定位星均处角宫或续宫、有本质尊贵，并经核对无火星或土星接触',
    fourth_dispositor_afflicted: '一颗四宫吉星的定位星受到火星或土星的合、刑或冲',
    day_estate_unrestrained: '火星与昼盘太阳合、刑或冲，木星和金星均无合相、六合或三合介入',
    night_estate_unrestrained: '火星与夜盘土星合、刑或冲，木星和金星均无合相、六合或三合介入',
    mother_severely_afflicted: '母亲章的实际指征均处弱位且受凶星损伤，处弱位的月亮又同时受到火星和土星的合、刑或冲',
    venus_approaching_combustion: '昼盘金星处角宫或续宫且具庙旺，已排除火土合、刑、冲，短时相对运行指向同星座内进入燃烧范围',
    venus_retrograde_separating: '昼盘金星漂泊且失势、落陷或处果宫，正逆行并在同星座合相范围内离开太阳',
    moon_fortunate: '月亮处本庙或擢升且入角宫或续宫，已按实际坐标排除火土的合、刑、冲',
  }[f.selector]}`,
  western_lilly_family_stronger_parent: f => `按莉莉${f.table === 'main' ? '首列' : '另一说'}容许度，${f.parent === 'father' ? '父亲' : '母亲'}一侧独有的指征均明确有力，另一侧独有的指征均处弱位且受凶星损伤`,
  western_lilly_family_estate_pressure: f => `按莉莉${f.table === 'main' ? '首列' : '另一说'}容许度，${valueText(f.planet)}实际损及月亮，第二宫及宫主失利，并核到${f.path === 'second_ruler' ? '同一凶星也损及第二宫主' : '第四宫和第四宫主同时受损'}`,
  western_lilly_family_fourth_priority: f => `${valueText(f.planet)}在第四宫，占据本质尊贵比较中的唯一优先位`,
  western_lilly_family_estate_support: f => `按莉莉${f.table === 'main' ? '首列' : '另一说'}容许度，${valueText(f.planet)}参与${f.sect === 'day' ? '昼盘太阳' : '夜盘土月'}的祖产见证，且${{
    second_house: '落第二宫', fourth_house: '落第四宫', fourth_house_ruler: '为传统第四宫主',
  }[f.place]}`,
  western_lilly_family_mother_share: f => f.share === 'all'
    ? '母亲章的各颗独立指征均有佳宫或本质尊贵' : '母亲章的独立指征中已确认严格多数具有佳宫或本质尊贵',
  western_lilly_family_historical_aphorism: () => '已选择按古籍原文核对历史格言',
  western_lilly_family_birth_branch: f => `已选择古籍的${f.branch === 'male' ? '男性' : '女性'}分支`,
  western_lilly_family_birth_luminary: f => `${valueText(f.planet)}的实际黄经落在${f.sign}`,
  western_lilly_family_birth_ascendant: f => `雷吉奥蒙塔努斯第一宫头落在${f.sign}`,
  western_lilly_family_birth_ascendant_ray: f => `${valueText(f.planet)}与实际上升点按黄道整度成${lillyContact[f.aspect]}`,
  western_lilly_family_birth_motion: f => `${valueText(f.planet)}的实际每小时黄经变化符合${f.motion === 'stationary' ? '停驻' : '逆行'}`,
  western_lilly_profession_sole: f => `${valueText(f.planet)}是按莉莉职业选星步骤确认的唯一指征`,
  western_lilly_profession_condition: f => `${valueText(f.planet)}${
    {
      strong_angular: '具有庙或擢升的本质尊贵，并实际落入角宫',
      clear_partile_malefics: '已排除其他凶曜的对应整度合、刑、冲',
      with_north_node: '与北交点的黄经处于同一整度',
    }[f.condition]}`,
  western_lilly_profession_account: f => `按莉莉转述的职业取法，${valueText(f.planet)}${
    {
      both_lord: '晨间紧先太阳升起，兼任第十宫庙主且照月',
      both_placed: '晨间紧先太阳升起，并落第十宫且照月',
      morning_only: '晨间紧先太阳升起，仅取得晨出一路见证',
      midheaven_lord_only: '是照月的第十宫庙主，仅取得中天一路见证',
      midheaven_placed_only: '落第十宫且照月，仅取得中天一路见证',
    }[f.basis]}`,
  western_lilly_sign_class: f => f.classification === 'selected' ? `${signClassSelector(f.selector)}${f.matches ? '已按原盘确定' : '未被确定'}`
    : `按莉莉原列分类，${signClassSelector(f.selector)}所处星座${f.matches ? '属于' : '不属于'}${signClassName[f.classification]}`,
  western_lilly_solar_state: f => `按本次莉莉太阳关系口径，${lillySelector(f.selector)}${f.matches ? '满足' : '不满足'}${solarConditionName[f.condition]}`,
  western_lilly_speed_state: f => `按莉莉平均日行量，${lillySelector(f.selector)}本次24小时位移${f.matches ? '满足' : '不满足'}${f.condition === 'swift' ? '快行' : '慢行'}条件`,
  western_lilly_fortune_house: f => `按莉莉判宫，${f.selector === 'ruler' ? '福点主' : '福点'}在第${f.house}宫`,
  western_lilly_fortune_governor: f => `${valueText(f.planet)}是实算福点所在星座的传统庙主`,
  western_lilly_fortune_testimony: f => `${valueText(f.planet)}与福点主同属${f.sect === 'day' ? '昼派' : '夜派'}，并与${f.target === 'lot' ? '实算福点' : '福点主'}成整度${lillyContact[f.aspect]}`,
  western_lilly_fortune_malefic_dominion: f => `${valueText(f.planet)}同时主宰实算福点所在星座与该度位的界`,
  western_ptolemy_fortune_formula: () => '按《四书》财富章，福点由实际升度加日月有向弧得到，昼夜同式',
  western_ptolemy_fortune_assessment: () => '已核福点、座主所在位置的亲和、派别和其他六曜的见证',
  western_ptolemy_fortune_point: f => `实算福点的热带黄经为 ${f.longitude.toFixed(4)}°`,
  western_ptolemy_fortune_governor: f => `${valueText(f.planet)}是《四书》本章福点的星座庙主`,
  western_ptolemy_fortune_power: f => `${valueText(f.planet)}为福点主，在自身位置至少核实两项亲和`,
  western_ptolemy_fortune_affinity: f => `${valueText(f.planet)}在自身位置具有${{
    domicile: '庙位', exaltation: '擢升', triplicity: '当值三分主权', term: '托勒密手稿界主权',
  }[f.dignity]}`,
  western_ptolemy_fortune_witness: f => f.relation === 'opposite_superior'
    ? `${valueText(f.planet)}与福点主分属异派，位于主星之前三个星座而成右刑`
    : `${valueText(f.planet)}与福点主${f.relation === 'same_sect' ? '同派' : '分属异派'}，按星座成${lillyContact[f.aspect]}`,
  western_ptolemy_fortune_following: f => `${valueText(f.planet)}与福点主分属异派，位于主星之后紧接的星座`,
  western_ptolemy_fortune_inheritance: f => ({
    positions: '土星与木星满足所选版本的角位组合',
    bicorporeal: '土星与木星满足所选版本的角位组合，木星在双体星座',
    moon_applying: '土星与木星满足所选版本的角位组合，月亮正趋近木星射线',
    moon_separating: '土星与木星满足所选版本的角位组合，月亮正远离木星射线',
  })[f.evidence],
  western_ptolemy_fortune_angle: f => `${valueText(f.planet)}在实际${{ ascendant: '上升点', mc: '中天', descendant: '下降点' }[f.angle]}所在星座`,
  western_ptolemy_fortune_moon_ray: f => `月亮${f.phase === 'applying' ? '正趋近' : '正远离'}木星的${lillyContact[f.aspect]}射线，距精确相位不超过 3°`,
  western_cardano_fortune_conjunction: f => ({
    none: '木星、月亮与金星任意两者的黄经相距均不超过 3°',
    Moon: '北交点参与月亮替代支，与木星及金星任意两者的黄经相距均不超过 3°',
    Venus: '北交点参与金星替代支，与木星及月亮任意两者的黄经相距均不超过 3°',
    Jupiter: '北交点参与木星替代支，与月亮及金星任意两者的黄经相距均不超过 3°',
  })[f.replaced],
  western_cardano_fortune_angle: f => `${valueText(f.planet)}与实算${{ ascendant: '上升点', mc: '中天', descendant: '下降点' }[f.angle]}的黄经相距不超过 1°`,
  western_cardano_fortune_longitude: f => `${{
    north_node: '真北交点', ascendant: '上升点', mc: '中天', descendant: '下降点', ic: '天底', fortune: '福点', second_cusp: '第二宫宫头',
  }[f.body] ?? valueText(f.body)}的实算热带黄经为 ${f.longitude.toFixed(4)}°`,
  western_cardano_fortune_lot_condition: f => ({
    angular_house: '福点落在实算角宫', above_eleventh: '福点在地平上第十一宫', above_ninth: '福点在地平上第九宫',
    ruler_oriental: '福点庙主在太阳之前的半圆内', ruler_angle_center: '福点庙主距实算角点不超过 1°',
    ruler_own_dignity: '福点庙主在自身庙位或擢升座', ruler_with_sun: '福点庙主与太阳成近距友善射线',
    ruler_with_moon: '福点庙主与月亮成近距友善射线', strong_lot_under_sun: '福点居评注所列位置，且距太阳不超过 3°',
    lot_with_moon_sun_rising: '福点距月亮不超过 3°，太阳距上升点不超过 1°',
    strong_lot_moon_trine: '福点居评注所列位置，并与月亮成近距三分', strong_lot_moon_sextile: '福点居评注所列位置，并与月亮成近距六分',
    ruler_angle_and_dignity: '福点庙主同时靠近实算角点且在自身庙位或擢升座',
    case_jupiter_second: '福点居评注所列位置，水星主管福点，木星居第二宫且主管该宫，两星近合',
    case_lot_venus_mercury_angular: '福点、金星、水星实落同一角宫，三条两两黄经距离均不超过 3°',
    inheritance_eleventh: '土木符合评注的第十一宫替代配置',
    inheritance_ninth: '土木符合评注的第九宫替代配置',
    inheritance_eighth: '土木符合评注的第八宫替代配置',
  })[f.witness],
  western_cardano_fortune_lot_house: f => `福点在未作宫头偏移的第 ${f.house} 宫`,
  western_cardano_fortune_lot_ruler: f => `${valueText(f.planet)}为实算福点所在星座的传统庙主`,
  western_cardano_fortune_lot_dignity: f => `福点庙主所处位置有自身${f.dignity === 'domicile' ? '庙位' : '擢升'}`,
  western_cardano_fortune_lot_ray: f => `两者星座与黄经同时满足${lillyContact[f.aspect]}，距精确射线不超过 3°`,
  western_cardano_fortune_body_house: f => `${valueText(f.planet)}在雷吉奥蒙塔努斯三维盘中实落第 ${f.house} 宫`,
  western_cardano_fortune_jupiter_bicorporeal: () => '木星位于双体星座',
  western_ptolemy_book_one_selector: f => ({
    masculine_nature: '星体属于卷一第六章的本性阳类', feminine_nature: '星体属于卷一第六章的本性阴类',
    common_nature: '水星在卷一第六章兼有两类性质',
    morning: '星体在太阳前的黄道半圆内', evening: '星体在太阳后的黄道半圆内',
    asc_mc: '星体位于上升至上中天的地平象限', west_ic: '星体位于下降至下中天的地平象限',
    mc_west: '星体位于上中天至下降的地平象限', ic_asc: '星体位于下中天至上升的地平象限',
    mercury_day: '水星在晨方，按托勒密本章列入昼派', mercury_night: '水星在昏方，按托勒密本章列入夜派',
    saturn_day: '昼盘的土星符合原书调和见证', mars_night: '夜盘的火星符合原书调和见证',
    waxing_first: '月亮在新月至上弦之间', waxing_second: '月亮在上弦至满月之间',
    waning_first: '月亮在满月至下弦之间', waning_second: '月亮在下弦至下次新月之间',
    sextile: '两星所在星座成整座六分', square: '两星所在星座成整座四分',
    trine: '两星所在星座成整座三分', opposition: '两星所在星座成整座对分',
    equinox: '两星所在座分列同一分点座两侧，座数相同',
    commanding: '分点座对称中，配对列首位于夏半圆，按原书称指挥方',
    obeying: '分点座对称中，配对列首位于冬半圆，按原书称从属方',
    solstice: '两星所在座分列同一至点座两侧，座数相同',
    disjunct_one: '两星相隔一座且排除两类整座对称', disjunct_five: '两星相隔五座且排除两类整座对称',
    quality_sun: '取卷一第四章的太阳冷暖燥湿性质', quality_moon: '取卷一第四章的月亮冷暖燥湿性质',
    quality_saturn: '取卷一第四章的土星冷暖燥湿性质', quality_mars: '取卷一第四章的火星冷暖燥湿性质',
    quality_jupiter: '取卷一第四章的木星冷暖燥湿性质', quality_venus: '取卷一第四章的金星冷暖燥湿性质',
    quality_mercury: '取卷一第四章的水星冷暖燥湿性质', luminary_quality: '古典五星之一与太阳或月亮有整座相位',
    spring: '太阳落在原书划分的春季星座', summer: '太阳落在原书划分的夏季星座',
    autumn: '太阳落在原书划分的秋季星座', winter: '太阳落在原书划分的冬季星座',
    east: '有星体靠近原书东方对应的上升点', north: '有星体靠近原书北方对应的下中天',
    west: '有星体靠近原书西方对应的下降点', south: '有星体靠近原书南方对应的上中天',
    akin_quality: '行星优势性质与季节或近角性质同类', opposed_quality: '行星优势性质与季节或近角性质相反',
    rising_even: '按卷一第十二章的上升交替法，落座为阳类', rising_odd: '按卷一第十二章的上升交替法，落座为阴类',
    sign_asc_mc: '落座完整处于上升至上中天象限', sign_west_ic: '落座完整处于下降至下中天象限',
    sign_mc_west: '落座完整处于上中天至下降象限', sign_ic_asc: '落座完整处于下中天至上升象限',
    solar_half: '落座在狮子至摩羯的庙座太阳半圆', lunar_half: '落座在水瓶至巨蟹的庙座月亮半圆',
    winds_north: '落座属于卷一第十八章主北风的三分组', winds_south: '落座属于卷一第十八章主南风的三分组',
    winds_east: '落座属于卷一第十八章主东风的三分组', winds_west: '落座属于卷一第十八章主西风的三分组',
    solstice_sign: '实盘落座属于卷一第十一章所列的至点座',
    equinox_sign: '实盘落座属于卷一第十一章所列的分点座',
    solid_sign: '实盘落座属于卷一第十一章所列的固定座',
    bicorporeal_sign: '实盘落座属于卷一第十一章所列的双体座',
    proper_face_sun: '行星相对太阳保有庙座图对应的定向整座相位',
    proper_face_moon: '行星相对月亮保有庙座图对应的定向整座相位',
    proper_face_venus_both: '同一金星同时昏方六合太阳、晨方六合月亮',
    two_familiarities: '同一星体在其实盘落点至少具备两项托勒密尊贵',
    body_applying: '黄道同侧的两颗星体正趋近形体合相',
    body_separating: '黄道同侧的两颗星体正离开形体合相',
    ray_applying: '两颗星体正在趋近既成整座相位的精确黄经射线',
    ray_separating: '两颗星体正在离开既成整座相位的精确黄经射线',
    upper_culmination: '星体通过上中天的时刻与出生时刻相距不超过一恒星度',
    approaching_upper_culmination: '星体将在出生后的一至三恒星度内通过上中天',
    horizon: '星体的几何升起或落下距出生时刻不超过一恒星度',
    next_rising_sign: '星体位于实际上升座紧接的下一个完整热带星座',
    eastern_horizon: '星体的几何东升距出生时刻不超过一恒星度',
    lower_culmination: '星体通过下中天的时刻与出生时刻相距不超过一恒星度',
    ascendant_disjunct: '星体所在座与上升座按卷一第十六章离隔',
    ascendant_other_aspect: '星体与上升座有整座见证，同时处于本条所列的其他位置',
  })[f.witness],
  western_ptolemy_book_one_elongation: f => `${valueText(f.planet)}相对太阳的有向黄经差为 ${f.elongation.toFixed(4)}°`,
  western_ptolemy_book_one_pair: f => `${valueText(f.first)}在${f.firstSign}，${valueText(f.second)}在${f.secondSign}，两座最短相隔 ${f.steps} 步`,
  western_ptolemy_book_one_reflection: f => `${valueText(f.first)}与${valueText(f.second)}分列${f.axis === 'equinox' ? '分点座' : '至点座'}${f.anchorSign}两侧，各距 ${f.steps} 座`,
  western_ptolemy_book_one_region: f => `${valueText(f.planet)}距${{
    east: '上升点', north: '下中天', west: '下降点', south: '上中天',
  }[f.region]}（视黄经 ${f.longitude.toFixed(4)}°）相差 ${f.distance.toFixed(4)}°`,
  western_ptolemy_book_one_sign_offset: f => `${valueText(f.planet)}在${f.sign}，从上升座${f.anchorSign}顺数 ${f.steps} 步`,
  western_ptolemy_book_one_sign_quadrant: f => `${valueText(f.planet)}所在的${f.sign}全部落于黄经 ${f.start.toFixed(4)}° 至 ${f.end.toFixed(4)}° 的正向区间`,
  western_ptolemy_book_one_quality: f => {
    const quality = { heat: '热', cold: '冷', moisture: '湿', dryness: '燥' };
    const context = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季', east: '东角', north: '北角', west: '西角', south: '南角' };
    return `${valueText(f.planet)}的优势性质为${quality[f.quality]}，${context[f.context]}的对应性质为${quality[f.contextQuality]}`;
  },
  western_ptolemy_book_one_face: f => `${valueText(f.planet)}与${valueText(f.luminary)}成庙座图对应的整座${{
    2: '六分', 3: '四分', 4: '三分', 6: '对分',
  }[f.steps]}，符合卷一的本面取法`,
  western_ptolemy_book_one_familiarity: f => `${valueText(f.planet)}在本命落点具备${{
    domicile: '庙', exaltation: '擢升', triplicity: '所属昼夜三分', term: '托勒密手稿界',
  }[f.basis]}`,
  western_ptolemy_book_one_contact: f => `${valueText(f.first)}与${valueText(f.second)}正${f.phase === 'applying' ? '趋近' : '远离'}精确${lillyContact[f.aspect]}，偏差 ${f.distance.toFixed(4)}°`,
  western_ptolemy_book_one_angle: f => `${valueText(f.planet)}通过${{
    ascendant: '东地平', descendant: '西地平', mc: '上中天', ic: '下中天',
  }[f.angle]}距出生时刻 ${Math.abs(f.offset).toFixed(4)} 恒星度${f.offset === 0 ? '' : f.offset > 0 ? '（稍后）' : '（稍前）'}`,
  western_ptolemy_book_one_asc_aspect: f => `${valueText(f.planet)}所在座与实际上升座最短相隔 ${f.steps} 座`,
  western_ptolemy_fixed_star_selected: f => `本次核取《四书》所列的${westernFixedStarNames[f.star]}`,
  western_ptolemy_siblings_source: () => '按《四书》卷三兄弟姐妹篇核对',
  western_ptolemy_siblings_place: f => {
    const labels = { shared: '中天与当派母星同座', mc: '中天', venus: '昼金星', moon: '夜月亮' };
    return `${labels[f.basis]}的${f.following ? '后继座' : '起点座'}为${f.sign}`;
  },
  western_ptolemy_siblings_contact: f => {
    const target = { place: '所查手足位置', fortune: '实算福点' }[f.target] ?? valueText(f.target);
    const relation = { ...lillyContact, overcomes: '从前方三个星座成右刑', following: '处于紧接其后的星座', disjunct: '相隔一座或五座' };
    return `${valueText(f.planet)}与${target}（${f.sign}）${relation[f.relation]}`;
  },
  western_ptolemy_siblings_form: f => `${valueText(f.planet)}落在${f.form === 'bicorporeal' ? '双体座' : '单形座'}`,
  western_lilly_book_one_aspect_source: () => '按莉莉卷一第十九章核对',
  western_lilly_book_three_role: () => '按莉莉卷三核对本条指定的盘面见证',
  western_lilly_book_one_sign_steps: f => {
    const directions = { 2: '顺序六合', 3: '顺序四分', 4: '顺序三合', 6: '对分', 8: '逆序三合', 9: '逆序四分', 10: '逆序六合' };
    return `${valueText(f.first)}至${valueText(f.second)}沿黄道顺数 ${f.steps} 座，${directions[f.steps] ?? '两座不相见'}`;
  },
  western_lilly_book_one_rank: f => `${valueText(f.planet)}属于原书的${f.rank === 'superior' ? '上级' : '下级'}行星`,
  western_lilly_book_one_besieged: f => `${valueText(f.planet)}在同一星座内严格位于火星和土星之间`,
  western_ptolemy_fixed_star_contact: f => `${westernFixedStarNames[f.star]}与${{ ascendant: '上升点', mc: '中天' }[f.target] ?? valueText(f.target)}的热带视黄经相距 ${f.distance.toFixed(4)}°`,
  western_ptolemy_travel_selector: f => {
    const explicit = {
      robbins_moon_setting: '月亮实落第七宫', robbins_moon_declining: '月亮实落第三、六、九、十二宫之一',
      robbins_mars_setting: '火星实落第七宫，同时刑或冲日月之一', robbins_mars_declining: '火星实落第九宫，同时刑或冲日月之一',
      robbins_benefic_aspect: '木星或金星与已确认的远行位置成整座相位', robbins_benefic_following: '木星或金星在已确认的远行位置紧接的下一座',
      robbins_fortune: '福点落入已确认远行盘的指定宫头星座', robbins_malefic_aspect: '土星或火星与已确认的远行位置成整座相位',
      robbins_single_sign: '当用远行位置落在非双体星座', robbins_single_ruler: '当用远行位置的传统庙主落在非双体星座',
      robbins_bicorporeal: '当用远行位置本身落在双体星座',
      robbins_eastern_lower: '已确认远行指征，日月均在东方类的下部象限', robbins_western: '已确认远行指征，日月均在西方类象限或第七宫',
      robbins_jupiter_venus: '木星与金星各主一个光体，两星也均有已确认远行位置的主宰见证',
      robbins_mercury_with_benefics: '木星与金星同时具备光体和远行位置的主宰见证，水星与其中一星近合并联系另一星',
      robbins_saturn_mars: '已有远行指征，土星与火星分别为太阳和月亮的首要主星',
      robbins_saturn_mars_watery: '土火分别主日月，两星均在水生座',
      robbins_saturn_mars_solid: '土火分别主日月，两星均在固定座',
      robbins_saturn_mars_solstitial_or_equinoxial: '土火分别主日月，两星均在分点座或至点座',
      robbins_saturn_mars_human_form: '土火分别主日月，两星均在传统人形座',
      robbins_saturn_mars_terrestrial: '土火分别主日月，两星均在 Cardano 注明的陆生形星座',
      robbins_saturn_mars_opposed: '土火分别主日月，且两星彼此成整座冲相',
      robbins_mercury_with_malefics: '土火分别主日月，水星与其中一星近合并联系另一星',
      robbins_action_connection: '同一首要主星主管有效远行位置与实盘中天',
      robbins_property_connection: '远行位置的首要主星同时为福点庙主，且有至少两项自身尊贵',
      robbins_body_connection: '同一首要主星主管一处独立远行位置、实盘上升与月亮',
      robbins_dignity_connection: '同一首要主星主管有效远行位置与太阳所在位置',
      robbins_mixed_dominance: '同一远行位置有两类整座相位见证，并能从实盘比较优势',
      robbins_benefic_dominance: '同一远行位置的两类见证中，木星或金星占优',
      robbins_malefic_dominance: '同一远行位置的两类见证中，土星或火星占优',
      cardano_moon_well_placed: '第七宫的月亮同时在自身庙座或擢升座',
      cardano_mars_well_placed: '第七宫的火星刑或冲日月之一，同时在自身庙座或擢升座',
      cardano_sun_twelfth: '太阳实落第十二宫', cardano_moon_twelfth: '月亮实落第十二宫',
      cardano_following: '已确认远行位置的下一座有另一颗星',
      cardano_priority_aspect: '同一远行位置有多颗整座射线候选，其中一颗最接近精确相位',
      cardano_priority_dignity: '同一远行位置有多颗合格候选，其中一颗在该远行位置的尊贵项数领先',
    };
    if (Object.hasOwn(explicit, f.witness)) return explicit[f.witness];
    const names = { sun: '太阳', moon: '月亮', mars: '火星' };
    const [, subject, qualifier, detail] = f.witness.split('_');
    if (subject === 'lot') return `福点与${names[qualifier]}近合，且同在第 ${detail} 宫`;
    if (detail) return `火星实落第九宫，并与${names[qualifier]}成整座${lillyContact[detail]}`;
    return `${names[subject]}作为远行指征，${{
      north: '视黄纬为北', south: '视黄纬为南', ascending: '视黄纬朝北增加', descending: '视黄纬朝南减小',
    }[qualifier]}`;
  },
  western_ptolemy_travel_aspect: f => `${valueText(f.first)}与${travelPlace(f.second)}${f.aspect === 'conjunction' ? '同座且黄经相距不超过 3°' : `成整座${lillyContact[f.aspect]}`}`,
  western_ptolemy_travel_following: f => `${valueText(f.planet)}在${f.body === 'fortune' ? '福点' : valueText(f.body)}所在星座的下一座`,
  western_ptolemy_travel_ruler: f => `${valueText(f.planet)}为${f.body === 'fortune' ? '福点' : valueText(f.body)}所在座的传统庙主`,
  western_ptolemy_travel_fortune_contact: f => `福点距${valueText(f.body)}的实际黄经短弧为 ${f.distance.toFixed(4)}°`,
  western_ptolemy_travel_governance: f => `${valueText(f.planet)}在${travelPlace(f.body)}位置具备${{
    domicile: '庙', exaltation: '擢升', triplicity: '所属昼夜三分', term: '托勒密手稿界', aspect: '整座相位',
  }[f.basis]}见证`,
  western_ptolemy_travel_comparison: f => `${valueText(f.planet)}对${f.body === 'fortune' ? '福点' : valueText(f.body)}有 ${f.claims} 项主宰见证，自身有 ${f.own} 项尊贵，实落${['果宫', '续宫', '第四或第七宫', '第一或第十宫'][f.houseRank - 1]}`,
  western_ptolemy_travel_dominance: f => `${valueText(f.planet)}在${f.body === 'fortune' ? '福点' : valueText(f.body)}这一远行位置的相位见证中占优`,
  western_ptolemy_travel_domain: f => `${valueText(f.planet)}将${travelPlace(f.body)}的远行见证与${{
    action: '职业事务', body: '身体事务', dignity: '名位事务',
  }[f.domain]}相连`,
  western_ptolemy_travel_priority: f => `${valueText(f.planet)}对${travelPlace(f.body)}${f.method === 'aspect_precision'
    ? `距精确相位 ${f.value.toFixed(4)}°` : `有 ${f.value} 项尊贵`}${f.selected ? '，在此项比较中占先' : ''}`,
  western_lilly_empty_second_shared_ruler: () => '按莉莉判宫，传统七曜均不在第二宫，第二宫主与福点主是同一颗行星',
  western_lilly_ascendant_ruler_sign: f => `上升宫的传统庙主实际位于${f.sign}`,
  western_lilly_ruler_house: f => `按莉莉宫头前五度规则，第${f.house}宫主判入第${f.placedIn}宫`,
  western_lilly_ruler_house_class: f => `按莉莉判宫，第${f.house}宫主位于${({ angular: '角宫', succedent: '续宫', cadent: '果宫' })[f.houseClass]}`,
  western_lilly_aspect: f => `按莉莉${f.table === 'main' ? '首列' : '另一说'}容许度，${lillySelector(f.first)}与${lillySelector(f.second)}${f.matches ? '形成' : '不形成'}${lillyContact[f.aspect]}`,
  western_lilly_partile_aspect: f => `按莉莉对应整度，${lillySelector(f.first)}与${lillySelector(f.second)}形成精确${lillyContact[f.aspect]}`,
  western_lilly_preferment_cusp: f => `${valueText(f.planet)}与第${f.house}宫宫头处在同一黄经整度`,
  western_lilly_preferment_all_cadent: () => '按莉莉前五度判宫，日月与其余传统五曜均落果宫',
  western_lilly_preferment_node_mc: f => `真北交点与${valueText(f.planet)}同座并近一度，且同临实际第十宫头`,
  western_lilly_preferment_role: f => `${valueText(f.planet)}是名望篇所取的${({
    luminary: '光体', midheaven_ruler: '第十宫传统庙主', tenth_house_occupant: '十宫内星',
  })[f.role]}`,
  western_lilly_preferment_witness: f => `按莉莉${f.table === 'main' ? '首列' : '另一说'}容许度，${valueText(f.planet)}在两星半容许度合计范围内照见${valueText(f.light)}`,
  western_lilly_preferment_distribution: f => `按莉莉${f.table === 'main' ? '首列' : '另一说'}容许度入选的行星指征${({
    angular: '均在角宫', succedent: '均在第二、第五或第十一宫', eighth_or_cadent: '均在第八宫或果宫',
  })[f.group]}`,
  western_lilly_preferment_grade: f => `按莉莉${f.table === 'main' ? '首列' : '另一说'}取证的名望指征中，有行星${lillyPrefermentDignityText[f.dignity]}`,
  western_lilly_preferment_grade_body: f => `${valueText(f.planet)}是已选名望指征，且${lillyPrefermentDignityText[f.dignity]}`,
  western_lilly_preferment_royal_contact: f => `按莉莉${f.table === 'main' ? '首列' : '另一说'}取证，有名望指征与${westernFixedStarNames[f.star]}视黄经相距五度以内`,
  western_lilly_preferment_royal_contact_body: f => `${valueText(f.planet)}为名望指征，与${westernFixedStarNames[f.star]}相距五度以内`,
  western_lilly_preferment_royal_cusp: f => `${westernFixedStarNames[f.star]}的视黄经与第${f.house}宫宫头处于同一黄经整度`,
  western_lilly_preferment_coangle: f => `${westernFixedStarNames[f.star]}与${valueText(f.planet)}在出生时刻附近${f.angle === 'ascendant' ? '共同从东侧升起' : '共同通过上中天'}`,
  western_lilly_preferment_tenth_star: f => `${westernFixedStarNames[f.star]}与${valueText(f.planet)}视黄经同整度，且按莉莉口径同在第十宫`,
  western_lilly_preferment_friendly_support: f => `按莉莉${f.table === 'main' ? '首列' : '另一说'}容许度，${valueText(f.planet)}与至少两颗星曜成六合或拱相`,
  western_lilly_preferment_no_light_support: f => `日月都在角宫外且处阴性座，按莉莉${f.table === 'main' ? '首列' : '另一说'}容许度，均未与金星或木星合相`,
  western_lilly_preferment_sign: f => `${valueText(f.planet)}的实际黄经落在${f.sign}`,
  western_lilly_preferment_exaltation_degree: f => f.planet === 'Sun' ? '太阳在白羊十九度整度' : '月亮在金牛三度整度',
  western_lilly_aspect_phase: f => {
    const table = f.table === 'main' ? '首列' : '另一说';
    const first = lillySelector(f.first), second = lillySelector(f.second);
    const phase = {
      applying: `${first}向${second}入相`,
      applying_friendly_or_conjunction: `${first}向${second}入合相、六合或三合`,
      separating: `${first}与${second}离相`,
      retrograde_separating: `${first}逆行与${second}离相`,
    }[f.phase];
    return `按莉莉${table}容许度，${phase}`;
  },
  western_lilly_luminary_application: f => `按莉莉${f.table === 'main' ? '首列' : '另一说'}容许度，${lillySelector(f.luminary)}向位于${f.houseClass === 'angular' ? '角宫' : '果宫'}的行星入相`,
  western_lilly_dignity: f => `按莉莉原表，${valueText(f.planet)}${f.matches ? '符合' : '不符合'}${({ domicile: '入庙', exaltation: '擢升', triplicity: '本昼夜三分主', term: '本界主', face: '本面主', detriment: '失势', fall: '落陷', peregrine: '漂泊（五项本质尊贵均无）' })[f.dignity]}`,
  western_lilly_dignified_count: f => `按莉莉原表，传统七曜中恰有${f.count}颗各具至少一项本质尊贵（同星只计一次）`,
  western_lilly_reception: f => f.reception.startsWith('mutual')
    ? `按莉莉原表，${lillySelector(f.first)}与${lillySelector(f.second)}${f.matches ? '成立' : '不成立'}${f.reception === 'mutual_domicile' ? '双向庙位互容' : '双向本质尊贵互容'}`
    : `按莉莉原表，${lillySelector(f.first)}${f.matches ? '以' : '未以'}${({ domicile: '庙位', exaltation: '擢升', triplicity: '本昼夜三分主', term: '界', face: '面' })[f.reception]}接纳${lillySelector(f.second)}`,
  western_profile_planet_house: f => `雷吉奥蒙塔努斯宫制${valueText(f.planet)}三维落宫为第${f.house}宫`,
  western_sect: daylight,
  angle_sign: f => `${valueText(f.angle)}位于${f.sign}`,
  planet_sign: f => `${valueText(f.planet)}位于${f.sign}`,
  planet_house: f => `${valueText(f.planet)}落在第${f.house}宫`,
  planet_motion: f => `${valueText(f.planet)}${valueText(f.motion)}`,
  house_sign: f => `第${f.house}宫的宫头位于${f.sign}`,
  aspect,
  aspect_orb: f => `${aspect(f)}，容许度${Number(f.orb.toFixed(3))}°`,
};

export function factText(fact) {
  const sentence = sentences[fact.kind]?.(fact);
  if (!sentence) throw new TypeError('Missing Chinese fact description: ' + fact.kind);
  const scope = { decadal: '大限', yearly: '流年', monthly: '流月', daily: '流日', hourly: '流时' }[fact.scope];
  return scope ? `${scope}：${sentence}` : sentence;
}

export function relationText({ first, second, type }) {
  const subject = f => f.kind === 'palace_star' ? `${palaceName(f.palace)}的${f.star}`
    : `${valueText(f.position)}地支${f.branch}`;
  return `${subject(first)}与${subject(second)}${valueText(type)}`;
}

export function buildChartFactsText(queries = []) {
  const titles = { bazi: '八字', ziwei: '紫微斗数', western: '西方星盘' };
  return queries.flatMap(({ method, confirmedFacts, confirmedAbsentFacts = [] }) => {
    const mainFacts = confirmedFacts.filter(fact => !fact.kind.startsWith('western_profile_') && !fact.kind.startsWith('western_lilly_'));
    const profileFacts = confirmedFacts.filter(fact => fact.kind.startsWith('western_profile_'));
    const facts = [...new Set(mainFacts.map(factText))];
    const absent = [...new Set(confirmedAbsentFacts.map(factText))];
    if (absent.length) facts.push('已确认不见：' + absent.join('；'));
    const blocks = facts.length ? [`【${titles[method]}盘面事实】\n${facts.join('；')}。`] : [];
    if (profileFacts.length) blocks.push('【雷吉奥蒙塔努斯独立宫制事实】\n' + [...new Set(profileFacts.map(factText))].join('；') + '。');
    const lillyFacts = confirmedFacts.filter(fact => fact.kind.startsWith('western_lilly_'));
    if (lillyFacts.length) blocks.push('【莉莉本命宫位与宫主判读】\n' + [...new Set(lillyFacts.map(factText))].join('；') + '。');
    return blocks;
  }).join('\n\n');
}
