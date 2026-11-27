import { chartVersions, isBaZiPillar, trueLunarNodeProfile, zodiacNames } from '../../control/charts.ts';
import { ziweiScopes } from './dictionaries.mjs';
import { quanshuMinggongProfile, quanshuMinggongStars } from './quanshu-minggong.mjs';
import { lillyDignityBodies, lillyDignityProfile, lillyDignityNames } from './lilly-dignities.mjs';
import { isLillyReceptionSelector, lillyReceptionNames } from './lilly-receptions.mjs';
import { lillyProfessionProfile, lillyProfessionBodies, lillyProfessionConditionPlanets, lillyProfessionStepStates } from './lilly-profession.mjs';
import { lillyProfessionAccountBases } from './lilly-profession-rising.mjs';
import { lillySignClassProfile, lillySignSelectors, lillySignClasses } from './lilly-sign-classes.mjs';
import { lillySolarProfile, lillyMotionProfile, lillySolarStates, lillyMotionStates, isLillySolarSelector, isLillyMotionSelector } from './lilly-solar-motion.mjs';
import { isLillyAspectSelector, lillyAspectPhases, lillyHouseClasses, lillyPartileAspects } from './lilly-aspects.mjs';
import { isLillyBookOneAspectSource } from './lilly-book-one-aspects.mjs';
import { isLillyBookThreeRole } from './lilly-book-three-roles.mjs';
import { lillyPrefermentDignities, lillyPrefermentDistributions, lillyPrefermentRoles, lillyPrefermentRoyalStars,
  lillyTenthHouseStars } from './lilly-preferment.mjs';
import { lillyFortuneProfile } from './lilly-fortune.mjs';
import { lunarNodes } from './lilly-nodes.mjs';
import { westernAngularPlanets, westernAngularStars, westernFixedStarNames, westernFixedStarProfile,
  westernGeometryPlanets } from '../../control/western-fixed-stars.mjs';
import { cardanoDignityProfile, cardanoDignitySelectors } from './cardano-dignity.mjs';
import { ptolemyParentSelectors } from './ptolemy-parents.mjs';
import { lillyTravelSelectors } from './lilly-travel.mjs';
import { lillySiblingsSelectors } from './lilly-siblings.mjs';
import { lillyWealthSourcesSelectors } from './lilly-wealth-sources.mjs';
import { isLillyWealthDurationFact } from './lilly-wealth-duration.mjs';
import { isLillyFortuneWitnessFact } from './lilly-fortune-witnesses.mjs';
import { isPtolemyFortuneFact } from './ptolemy-fortune.mjs';
import { isCardanoFortuneFact } from './cardano-fortune.mjs';
import { isPtolemyBookOneFact } from './ptolemy-book-one.mjs';
import { isPtolemyFixedStarFact } from './ptolemy-fixed-stars.mjs';
import { isPtolemyTravelFact } from './ptolemy-travel.mjs';
import { isPtolemySiblingsSourceNumber } from './ptolemy-siblings.mjs';
import { lillyChildrenSelectors } from './lilly-children.mjs';
import { lillyWitSelectors } from './lilly-wit.mjs';
import { lillyEnemyTestimonies, lillyEnemyUsesOrbs } from './lilly-enemies.mjs';
import { isLillyFriendCondition, lillyFriendHouses, lillyFriendRoles } from './lilly-friends.mjs';
import { lillyNinthHouseTestimonies, lillyNinthHouseUsesOrbs } from './lilly-ninth-house.mjs';
import { lillyMannersTestimonies, lillyMannersUsesOrbs } from './lilly-manners.mjs';
import { lillyTemperamentWitnesses, lillyTemperamentUsesOrbs } from './lilly-temperament.mjs';
import { isLillyMerchantCaseFact } from './lilly-merchant-case.mjs';
import { isLillyParentDerivedFact } from './lilly-parent-derived-role.mjs';
import { isLillyFamilyFact } from './lilly-family.mjs';

export const methods = Object.keys(chartVersions);
export { chartFacts, chartVersions } from '../../control/charts.ts';

const fieldsByMethod = {
  bazi: {
    natal_gender: ['gender'], natal_daylight: ['sect'],
    bazi_solar_month_xun: ['band'], bazi_previous_qi: ['term'], bazi_fetal_month: ['ganZhi'], natal_classical_region: ['zone'],
    bazi_decadal_range: ['ganZhi', 'startAge', 'endAge'],
    pillar: ['position', 'ganZhi'],
    stem: ['position', 'stem'],
    branch: ['position', 'branch'],
    stem_ten_god: ['position', 'tenGod'],
    hidden_ten_god: ['position', 'stem', 'tenGod'],
    branch_ten_god: ['position', 'tenGod'],
    branch_main_ten_god: ['position', 'tenGod'],
    bazi_ten_god_structure: ['name'],
    bazi_branch_relation: ['relation', 'first', 'second'],
    bazi_stem_transformation: ['pair', 'element'],
    bazi_day_stem_transformation: ['stem', 'partner', 'element'],
    bazi_stem_combination: ['first', 'second'],
    bazi_stem_placement_count: ['stem', 'placement', 'count'],
    bazi_ten_god_count: ['tenGod', 'count'],
    bazi_ten_god_strength: ['group', 'profile', 'strength'],
    bazi_month_pattern: ['name', 'result'],
    shen_sha: ['position', 'name'],
    pillar_nayin: ['position', 'name'],
    bazi_nayin_phase: ['position', 'phase'],
    bazi_own_stem_phase: ['position', 'phase'],
    bazi_hidden_god_phase: ['position', 'tenGod', 'phase', 'anchor'],
    bazi_natal_configuration: ['name'],
    bazi_day_master_season: ['season'],
    bazi_element_balance: ['element', 'band', 'profile'],
    bazi_natal_element: ['element'],
    bazi_nayin_school: ['position', 'school'],
    pillar_xun: ['position', 'head'],
    day_master_strength: ['result', 'profile'],
    bazi_element_temperament: ['element', 'classification', 'profile'],
    day_stem_phase: ['position', 'phase'],
  },
  ziwei: {
    natal_classical_region: ['zone'],
    palace_star: ['palace', 'star', 'scope'], palace_branch: ['palace', 'branch'],
    palace_sector_star: ['palace', 'star'], palace_trine_star: ['palace', 'star'],
    palace_sector_mutagen: ['palace', 'change'],
    palace_life_trines_without_auspicious_mutagens: [],
    palace_life_without_trine_auspicious_mutagens: [],
    palace_life_without_natal_ji: [],
    palace_confirmed_body_seat: ['palace'],
    palace_sector_benefic_count: ['palace', 'count'],
    palace_sector_malefic_count: ['palace', 'count'],
    palace_sector_six_malefic_count: ['palace', 'count'],
    palace_sector_benefic_majority: ['palace'],
    palace_opposite_benefic_count: ['palace', 'count'],
    palace_opposite_six_malefic_count: ['palace', 'count'],
    palace_sector_all_benefic: ['palace'],
    palace_major_state: ['palace', 'state'],
    palace_body_star_group: ['group'],
    palace_mutagen: ['palace', 'change', 'scope'],
    natal_ziwei_mutagen_branch: ['change', 'branch'],
    palace_mutagen_brightness: ['palace', 'change', 'brightness'],
    palace_brightness: ['palace', 'star', 'scope', 'brightness'],
    palace_source_brightness: ['palace', 'star', 'branch', 'scope', 'brightness', 'profile'],
    star_mutagen: ['palace', 'star', 'change', 'scope'],
    body_palace: ['palace'], palace_main_count: ['palace', 'count'],
    palace_origin_star_count: ['palace', 'count'], palace_core_star_count: ['palace', 'count'],
    palace_boshi_star: ['palace', 'star'],
    palace_suiqian_star: ['palace', 'star'], palace_jiangqian_star: ['palace', 'star'],
    natal_gender: ['gender'], natal_year_stem: ['stem'], natal_year_branch: ['branch'],
    natal_daylight: ['sect'], natal_ziwei_hour: ['branch'], natal_ziwei_time_band: ['branch', 'band'],
    natal_year_nayin_element: ['element'], natal_ziwei_bureau: ['bureau'],
    natal_ziwei_life_phase: ['phase'], natal_ziwei_hour_phase: ['phase'],
    palace_changsheng_phase: ['palace', 'phase'], ziwei_grade: ['dimension', 'grade'],
    ziwei_life_body_clash: [],
    ziwei_eight_seats: [],
    ziwei_confirmed_natal_layout: [],
    natal_lunar_month: ['month', 'leap'],
    palace_relation: ['anchor', 'target', 'relation'],
    ziwei_decadal_range: ['palace', 'startAge', 'endAge'],
    ziwei_daozang_input: ['yearBranch', 'month', 'day', 'hour', 'leap'],
    daozang_star_branch: ['star', 'branch'],
    daozang_palace_star: ['palace', 'star', 'relation'],
    daozang_palace_star_count: ['palace', 'count'],
  },
  western: {
    natal_gender: ['gender'],
    planet_longitude: ['planet', 'longitude'],
    planet_daily_motion: ['planet', 'signedDegrees'],
    planet_hourly_motion: ['planet', 'signedDegrees'],
    western_true_node_longitude: ['longitude', 'profile'],
    western_fixed_star_longitude: ['star', 'longitude', 'profile'],
    western_geometry_obliquity: ['obliquity'],
    western_geometry_ascendant: ['longitude'],
    western_geometry_midheaven: ['longitude'],
    western_geometry_planet_latitude: ['planet', 'latitude'],
    western_geometry_planet_latitude_motion: ['planet', 'signedDegrees'],
    western_geometry_star_latitude: ['star', 'latitude', 'profile'],
    western_cardano_dignity: ['profile', 'selector', 'matches'],
    western_ptolemy_parent: ['selector'],
    western_lilly_travel: ['table', 'selector'],
    western_lilly_siblings: ['selector'],
    western_lilly_family_role: ['parent', 'planet', 'role'],
    western_lilly_family_source: ['parent', 'planet', 'table'],
    western_lilly_family_configuration: ['selector'],
    western_lilly_family_mother_share: ['share'],
    western_lilly_family_assessment: ['selector', 'table'],
    western_lilly_family_stronger_parent: ['parent', 'table'],
    western_lilly_family_fourth_priority: ['planet'],
    western_lilly_family_estate_support: ['planet', 'place', 'sect', 'table'],
    western_lilly_family_estate_pressure: ['planet', 'path', 'table'],
    western_lilly_family_historical_aphorism: [],
    western_lilly_book_one_aspect_source: ['passage'],
    western_lilly_book_three_role: ['passage'],
    western_ptolemy_siblings_source: ['number'],
    western_lilly_family_birth_branch: ['branch'],
    western_lilly_family_birth_luminary: ['planet', 'sign'],
    western_lilly_family_birth_ascendant: ['sign'],
    western_lilly_family_birth_ascendant_ray: ['planet', 'aspect'],
    western_lilly_family_birth_motion: ['planet', 'motion'],
    western_lilly_wealth_source: ['selector'],
    western_lilly_wealth_star_contact: ['star', 'target'],
    western_lilly_wealth_lot_pressure: ['planet', 'aspect'],
    western_lilly_wealth_principal: ['planet', 'basis'],
    western_lilly_wealth_strength: ['planet', 'strength'],
    western_lilly_wealth_score: ['planet', 'min', 'max'],
    western_lilly_wealth_participant: ['planet', 'house'],
    western_lilly_wealth_quarter: ['quarter', 'basis'],
    western_lilly_wealth_timing_motion: ['planet', 'motion'],
    western_lilly_wealth_saturn: ['luminaries'],
    western_lilly_children: ['selector'],
    western_lilly_wit: ['selector'],
    western_lilly_enemies: ['table', 'selector'],
    western_lilly_ninth_house: ['table', 'selector'],
    western_lilly_manners: ['table', 'selector'],
    western_lilly_temperament: ['table', 'selector'],
    western_lilly_merchant_case: ['selector', 'value'],
    western_lilly_parent_derived_role: ['sect', 'parent', 'planet'],
    western_lilly_friend_significator: ['planet', 'house', 'role'],
    western_lilly_friend_condition: ['planet', 'condition', 'table'],
    western_lilly_node_house: ['node', 'house'],
    western_lilly_node_sign: ['node', 'sign'],
    western_lilly_ruleset: ['ruleset'],
    western_lilly_house_ruler: ['house', 'planet'],
    western_lilly_planet_house: ['planet', 'house'],
    western_lilly_ruler_house: ['house', 'placedIn'],
    western_lilly_ruler_house_class: ['house', 'houseClass'],
    western_lilly_aspect: ['table', 'first', 'second', 'aspect', 'matches'],
    western_lilly_partile_aspect: ['first', 'second', 'aspect'],
    western_lilly_preferment_cusp: ['planet', 'house'],
    western_lilly_preferment_all_cadent: [],
    western_lilly_preferment_node_mc: ['planet'],
    western_lilly_preferment_role: ['planet', 'role'],
    western_lilly_preferment_witness: ['table', 'planet', 'light'],
    western_lilly_preferment_distribution: ['table', 'group'],
    western_lilly_preferment_grade: ['table', 'dignity'],
    western_lilly_preferment_grade_body: ['table', 'dignity', 'planet'],
    western_lilly_preferment_royal_contact: ['table', 'star'],
    western_lilly_preferment_royal_contact_body: ['table', 'star', 'planet'],
    western_lilly_preferment_royal_cusp: ['star', 'house'],
    western_lilly_preferment_coangle: ['star', 'planet', 'angle'],
    western_lilly_preferment_tenth_star: ['star', 'planet'],
    western_lilly_preferment_friendly_support: ['table', 'planet'],
    western_lilly_preferment_no_light_support: ['table'],
    western_lilly_preferment_sign: ['planet', 'sign'],
    western_lilly_preferment_exaltation_degree: ['planet'],
    western_lilly_aspect_phase: ['table', 'first', 'second', 'phase'],
    western_lilly_luminary_application: ['table', 'luminary', 'houseClass'],
    western_lilly_dignity: ['planet', 'dignity', 'matches', 'profile'],
    western_lilly_dignified_count: ['count', 'profile'],
    western_lilly_reception: ['first', 'second', 'reception', 'matches', 'profile'],
    western_lilly_profession_ruler: ['planet', 'role', 'matches', 'profile'],
    western_lilly_profession_step: ['planet', 'step', 'state'],
    western_lilly_profession_partile_comparison: [],
    western_lilly_profession_tenth_house: [],
    western_lilly_profession_account: ['planet', 'basis'],
    western_lilly_profession_selected: ['planet'],
    western_lilly_profession_sole: ['planet'],
    western_lilly_profession_condition: ['planet', 'condition'],
    western_lilly_sign_class: ['selector', 'classification', 'matches', 'profile'],
    western_lilly_solar_state: ['selector', 'condition', 'matches', 'profile'],
    western_lilly_speed_state: ['selector', 'condition', 'matches', 'profile'],
    western_lilly_fortune_house: ['selector', 'house', 'profile'],
    western_lilly_fortune_governor: ['planet'],
    western_lilly_fortune_testimony: ['planet', 'sect', 'target', 'aspect'],
    western_lilly_fortune_malefic_dominion: ['planet'],
    western_ptolemy_fortune_formula: [],
    western_ptolemy_fortune_assessment: [],
    western_ptolemy_fortune_point: ['longitude'],
    western_ptolemy_fortune_governor: ['planet'],
    western_ptolemy_fortune_power: ['planet'],
    western_ptolemy_fortune_affinity: ['planet', 'dignity'],
    western_ptolemy_fortune_witness: ['planet', 'aspect', 'relation'],
    western_ptolemy_fortune_following: ['planet'],
    western_ptolemy_fortune_inheritance: ['configuration', 'evidence'],
    western_ptolemy_fortune_angle: ['planet', 'angle'],
    western_ptolemy_fortune_moon_ray: ['aspect', 'phase'],
    western_cardano_fortune_conjunction: ['replaced'],
    western_cardano_fortune_angle: ['planet', 'angle'],
    western_cardano_fortune_longitude: ['body', 'longitude'],
    western_cardano_fortune_lot_condition: ['witness'],
    western_cardano_fortune_lot_house: ['house'],
    western_cardano_fortune_lot_ruler: ['planet'],
    western_cardano_fortune_lot_dignity: ['dignity'],
    western_cardano_fortune_lot_ray: ['aspect'],
    western_cardano_fortune_body_house: ['planet', 'house'],
    western_cardano_fortune_jupiter_bicorporeal: [],
    western_ptolemy_book_one_selector: ['witness'],
    western_ptolemy_book_one_elongation: ['planet', 'elongation'],
    western_ptolemy_book_one_pair: ['first', 'second', 'firstSign', 'secondSign', 'steps'],
    western_ptolemy_book_one_reflection: ['first', 'second', 'axis', 'anchorSign', 'steps'],
    western_ptolemy_book_one_region: ['planet', 'region', 'longitude', 'distance'],
    western_ptolemy_book_one_sign_offset: ['planet', 'sign', 'anchorSign', 'steps'],
    western_ptolemy_book_one_sign_quadrant: ['planet', 'sign', 'quadrant', 'start', 'end'],
    western_ptolemy_book_one_quality: ['planet', 'quality', 'context', 'contextQuality'],
    western_ptolemy_book_one_face: ['planet', 'luminary', 'steps'],
    western_ptolemy_book_one_familiarity: ['planet', 'basis'],
    western_ptolemy_book_one_contact: ['first', 'second', 'aspect', 'phase', 'distance'],
    western_ptolemy_book_one_angle: ['planet', 'angle', 'offset'],
    western_ptolemy_book_one_asc_aspect: ['planet', 'steps'],
    western_ptolemy_fixed_star_selected: ['star'],
    western_ptolemy_fixed_star_contact: ['star', 'target', 'distance'],
    western_ptolemy_travel_selector: ['witness'],
    western_ptolemy_travel_aspect: ['first', 'second', 'aspect'],
    western_ptolemy_travel_following: ['planet', 'body'],
    western_ptolemy_travel_ruler: ['body', 'planet'],
    western_ptolemy_travel_fortune_contact: ['body', 'distance'],
    western_ptolemy_travel_governance: ['planet', 'body', 'basis'],
    western_ptolemy_travel_comparison: ['planet', 'body', 'claims', 'own', 'houseRank'],
    western_ptolemy_travel_dominance: ['planet', 'body'],
    western_ptolemy_travel_domain: ['planet', 'body', 'domain'],
    western_ptolemy_travel_priority: ['planet', 'body', 'method', 'value', 'selected'],
    western_lilly_empty_second_shared_ruler: [],
    western_lilly_ascendant_ruler_sign: ['sign'],
    western_zodiac: ['zodiac'],
    western_house_system: ['houseSystem'],
    western_profile_system: ['profile'],
    western_profile_house_sign: ['profile', 'house', 'sign'],
    western_profile_planet_house: ['profile', 'planet', 'house'],
    western_profile_cusp_longitude: ['profile', 'house', 'longitude'],
    western_sect: ['sect'],
    angle_sign: ['angle', 'sign'],
    planet_sign: ['planet', 'sign'],
    planet_house: ['planet', 'house'],
    planet_motion: ['planet', 'motion'],
    house_sign: ['house', 'sign'],
    aspect: ['first', 'second', 'aspect'],
    aspect_orb: ['first', 'second', 'aspect', 'orb'],
  },
};

export function normalizeFacts(method, facts) {
  if (!methods.includes(method) || !Array.isArray(facts)) throw new TypeError('Invalid interpretation facts.');
  return facts.map((fact) => {
    const kinds = fieldsByMethod[method];
    if (!fact || !Object.hasOwn(kinds, fact.kind)) throw new TypeError('Unknown fact kind for ' + method);
    const fields = kinds[fact.kind];
    if (Object.keys(fact).length !== fields.length + 1 || fields.some((field) => {
      const value = fact[field];
      if (field === 'node') return !lunarNodes.includes(value);
      if (fact.kind === 'western_true_node_longitude' && field === 'profile') return value !== trueLunarNodeProfile;
      if (fact.kind === 'western_fixed_star_longitude') {
        if (field === 'star') return typeof value !== 'string' || !Object.hasOwn(westernFixedStarNames, value);
        if (field === 'profile') return value !== westernFixedStarProfile;
      }
      if (fact.kind.startsWith('western_geometry_') || fact.kind === 'western_lilly_preferment_coangle') {
        if (fact.kind === 'western_geometry_planet_latitude_motion') {
          if (field === 'planet') return !['Moon', 'Mars'].includes(value);
          if (field === 'signedDegrees') return !Number.isFinite(value) || Math.abs(value) > 1;
        }
        if (field === 'latitude') return !Number.isFinite(value) || Math.abs(value) >= 90;
        if (field === 'obliquity') return !Number.isFinite(value) || value < 22 || value > 25;
        if (field === 'planet') return !(fact.kind === 'western_geometry_planet_latitude'
          ? westernGeometryPlanets : westernAngularPlanets).includes(value);
        if (field === 'star') return !westernAngularStars.includes(value);
        if (field === 'profile') return value !== westernFixedStarProfile;
        if (field === 'angle') return !['ascendant', 'mc'].includes(value);
      }
      if (fact.kind === 'western_cardano_dignity') {
        if (field === 'profile') return value !== cardanoDignityProfile;
        if (field === 'selector') return !cardanoDignitySelectors.includes(value);
        if (field === 'matches') return typeof value !== 'boolean';
      }
      if (fact.kind === 'western_ptolemy_parent') return !ptolemyParentSelectors.has(value);
      if (fact.kind.startsWith('western_ptolemy_fortune_')) return !isPtolemyFortuneFact(fact);
      if (fact.kind.startsWith('western_cardano_fortune_')) return !isCardanoFortuneFact(fact);
      if (fact.kind.startsWith('western_ptolemy_book_one_')) return !isPtolemyBookOneFact(fact);
      if (fact.kind.startsWith('western_ptolemy_fixed_star_')) return !isPtolemyFixedStarFact(fact);
      if (fact.kind.startsWith('western_ptolemy_travel_')) return !isPtolemyTravelFact(fact);
      if (fact.kind === 'western_ptolemy_siblings_source') return !isPtolemySiblingsSourceNumber(value);
      if (fact.kind === 'western_lilly_siblings') return !lillySiblingsSelectors.has(value);
      if (fact.kind === 'western_lilly_book_one_aspect_source') return !isLillyBookOneAspectSource(value);
      if (fact.kind === 'western_lilly_book_three_role') return !isLillyBookThreeRole(value);
      if (fact.kind.startsWith('western_lilly_family_')) return !isLillyFamilyFact(fact);
      if (fact.kind === 'western_lilly_wealth_source') return !lillyWealthSourcesSelectors.has(value);
      if (fact.kind.startsWith('western_lilly_wealth_')) return !isLillyWealthDurationFact(fact);
      if (fact.kind.startsWith('western_lilly_fortune_') && fact.kind !== 'western_lilly_fortune_house') return !isLillyFortuneWitnessFact(fact);
      if (fact.kind === 'western_lilly_children') return !lillyChildrenSelectors.has(value);
      if (fact.kind === 'western_lilly_wit') return !lillyWitSelectors.has(value);
      if (fact.kind === 'western_lilly_enemies') {
        if (field === 'selector') return !Object.hasOwn(lillyEnemyTestimonies, value);
        if (field === 'table') return value !== 'main' && !(value === 'other' && lillyEnemyUsesOrbs(fact.selector));
      }
      if (fact.kind === 'western_lilly_ninth_house') {
        if (field === 'selector') return !Object.hasOwn(lillyNinthHouseTestimonies, value);
        if (field === 'table') return value !== 'main' && !(value === 'other' && lillyNinthHouseUsesOrbs(fact.selector));
      }
      if (fact.kind === 'western_lilly_manners') {
        if (field === 'selector') return !Object.hasOwn(lillyMannersTestimonies, value);
        if (field === 'table') return value !== 'main' && !(value === 'other' && lillyMannersUsesOrbs(fact.selector));
      }
      if (fact.kind === 'western_lilly_temperament') {
        if (field === 'selector') return !Object.hasOwn(lillyTemperamentWitnesses, value);
        if (field === 'table') return value !== 'main' && !(value === 'other' && lillyTemperamentUsesOrbs(fact.selector));
      }
      if (fact.kind === 'western_lilly_merchant_case') return !isLillyMerchantCaseFact(fact.selector, fact.value);
      if (fact.kind === 'western_lilly_parent_derived_role') return !isLillyParentDerivedFact(fact.sect, fact.parent, fact.planet);
      if (fact.kind === 'western_lilly_friend_significator') {
        if (field === 'planet') return !lillyDignityBodies.includes(value);
        if (field === 'house') return !lillyFriendHouses.includes(value);
        if (field === 'role') return !lillyFriendRoles.includes(value);
      }
      if (fact.kind === 'western_lilly_friend_condition') return !isLillyFriendCondition(fact);
      if (fact.kind === 'western_lilly_travel') {
        if (field === 'table') return !['main', 'other'].includes(value);
        if (field === 'selector') return !lillyTravelSelectors.has(value);
      }
      if (fact.kind === 'western_lilly_node_sign' && field === 'sign') return !zodiacNames.includes(value);
      if (fact.kind === 'palace_source_brightness') {
        if (field === 'profile') return value !== quanshuMinggongProfile;
        if (field === 'palace') return value !== '命宫';
        if (field === 'star') return !quanshuMinggongStars.includes(value);
        if (field === 'branch') return typeof value !== 'string' || !/^[子丑寅卯辰巳午未申酉戌亥]$/u.test(value);
        if (field === 'scope') return value !== 'origin';
        if (field === 'brightness') return !['庙', '旺', '得', '利', '平', '不', '陷'].includes(value);
      }
      if (fact.kind === 'western_lilly_aspect') {
        if (field === 'matches') return typeof value !== 'boolean';
        if (field === 'table') return !['main', 'other'].includes(value);
        if (field === 'aspect') return !['conjunction', 'sextile', 'square', 'trine', 'opposition', 'friendly', 'any'].includes(value);
        if (['first', 'second'].includes(field)) return typeof value !== 'string' || !isLillyAspectSelector(value);
      }
      if (fact.kind === 'western_lilly_partile_aspect') {
        if (field === 'aspect') return !lillyPartileAspects.includes(value);
        if (field === 'first' || field === 'second') return !isLillyAspectSelector(value);
      }
      if (fact.kind === 'western_lilly_preferment_node_mc' && field === 'planet') return !['Moon', 'Jupiter'].includes(value);
      if (fact.kind === 'western_lilly_preferment_role' && field === 'role') return !lillyPrefermentRoles.includes(value);
      if (fact.kind === 'western_lilly_preferment_exaltation_degree' && field === 'planet') return !['Sun', 'Moon'].includes(value);
      if (fact.kind.startsWith('western_lilly_preferment_')) {
        if (field === 'table') return !['main', 'other'].includes(value);
        if (field === 'light') return !['Sun', 'Moon'].includes(value);
        if (field === 'group') return !lillyPrefermentDistributions.includes(value);
        if (field === 'dignity') return !lillyPrefermentDignities.includes(value);
        if (field === 'star') return !(fact.kind === 'western_lilly_preferment_tenth_star' ? lillyTenthHouseStars
          : lillyPrefermentRoyalStars).includes(value);
        if (fact.kind === 'western_lilly_preferment_tenth_star' && field === 'planet') return !westernAngularPlanets.includes(value);
        if (fact.kind === 'western_lilly_preferment_friendly_support' && field === 'planet') return !['Sun', 'Moon'].includes(value);
        if (fact.kind === 'western_lilly_preferment_royal_cusp' && field === 'house') return ![1, 10].includes(value);
      }
      if (fact.kind === 'western_lilly_fortune_house') {
        if (field === 'selector') return !['lot', 'ruler'].includes(value);
        if (field === 'profile') return value !== lillyFortuneProfile;
      }
      if (fact.kind === 'western_lilly_ruler_house_class' && field === 'houseClass') return !lillyHouseClasses.includes(value);
      if (fact.kind === 'western_lilly_aspect_phase' || fact.kind === 'western_lilly_luminary_application') {
        if (field === 'table') return !['main', 'other'].includes(value);
        if (field === 'phase') return !lillyAspectPhases.includes(value);
        if (field === 'first' || field === 'second') return !isLillyAspectSelector(value);
        if (field === 'luminary') return !['sun', 'moon'].includes(value);
        if (field === 'houseClass') return !['angular', 'cadent'].includes(value);
      }
      if (fact.kind === 'western_lilly_dignity') {
        if (field === 'matches') return typeof value !== 'boolean';
        if (field === 'dignity') return !lillyDignityNames.includes(value);
        if (field === 'profile') return value !== lillyDignityProfile;
      }
      if (fact.kind === 'western_lilly_dignified_count') {
        if (field === 'count') return !Number.isInteger(value) || value < 0 || value > 7;
        if (field === 'profile') return value !== lillyDignityProfile;
      }
      if (fact.kind === 'western_lilly_reception') {
        if (field === 'matches') return typeof value !== 'boolean';
        if (field === 'reception') return !lillyReceptionNames.includes(value);
        if (field === 'profile') return value !== lillyDignityProfile;
        if (['first', 'second'].includes(field)) return !isLillyReceptionSelector(value);
      }
      if (fact.kind === 'western_lilly_profession_ruler') {
        if (field === 'planet') return !lillyProfessionBodies.includes(value);
        if (field === 'role') return !['member', 'sole'].includes(value);
        if (field === 'matches') return typeof value !== 'boolean';
        if (field === 'profile') return value !== lillyProfessionProfile;
      }
      if (fact.kind === 'western_lilly_profession_step') {
        if (field === 'planet') return !lillyProfessionBodies.includes(value);
        if (field === 'step') return typeof value !== 'number' || !Object.hasOwn(lillyProfessionStepStates, value);
        if (field === 'state') return !lillyProfessionStepStates[fact.step]?.includes(value);
      }
      if (fact.kind === 'western_lilly_profession_account') {
        if (field === 'planet') return !lillyProfessionBodies.includes(value);
        if (field === 'basis') return !lillyProfessionAccountBases.includes(value);
      }
      if (['western_lilly_profession_selected', 'western_lilly_profession_sole'].includes(fact.kind)
        && field === 'planet') return !lillyProfessionBodies.includes(value);
      if (fact.kind === 'western_lilly_profession_condition') {
        if (field === 'planet') return !lillyProfessionConditionPlanets.includes(value);
        if (field === 'condition') {
          const allowed = fact.planet === 'Jupiter' ? ['strong_angular', 'with_north_node'] : ['strong_angular', 'clear_partile_malefics'];
          return !allowed.includes(value);
        }
      }
      if (fact.kind === 'western_lilly_sign_class') {
        if (field === 'selector') return !lillySignSelectors.includes(value);
        if (field === 'classification') return !lillySignClasses.includes(value);
        if (field === 'matches') return typeof value !== 'boolean';
        if (field === 'profile') return value !== lillySignClassProfile;
      }
      if (fact.kind === 'western_lilly_solar_state' || fact.kind === 'western_lilly_speed_state') {
        const solar = fact.kind === 'western_lilly_solar_state';
        if (field === 'selector') return !(solar ? isLillySolarSelector(value) : isLillyMotionSelector(value));
        if (field === 'condition') return !(solar ? lillySolarStates : lillyMotionStates).includes(value);
        if (field === 'matches') return typeof value !== 'boolean';
        if (field === 'profile') return value !== (solar ? lillySolarProfile : lillyMotionProfile);
      }
      if (field === 'signedDegrees') return !Number.isFinite(value) || Math.abs(value) > (fact.kind === 'planet_hourly_motion' ? 1 : 32);
      if (fact.kind === 'planet_hourly_motion' && field === 'planet') return !['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].includes(value);
      if (fact.kind === 'planet_daily_motion' && field === 'planet') return !['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].includes(value);
      if (field === 'profile' && fact.kind.startsWith('western_profile_')) return value !== 'regiomontanus';
      if (field === 'longitude') return !Number.isFinite(value) || value < 0 || value >= 360;
      if (field === 'ruleset' && fact.kind === 'western_lilly_ruleset') return value !== 'lilly-1647-longitude-five-degree-v1';
      if (field === 'planet' && fact.kind.startsWith('western_lilly_')) return !['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].includes(value);
      if (field === 'orb') return !Number.isFinite(value) || value < 0 || value > 6;
      if (field === 'scope') return !Object.hasOwn(ziweiScopes, value);
      if (field === 'change') return !['禄', '权', '科', '忌'].includes(value);
      if (field === 'brightness') return !(fact.kind === 'palace_mutagen_brightness'
        ? ['庙', '旺', '陷'] : ['庙', '旺', '得', '利', '平', '不', '闲', '陷']).includes(value);
      if (field === 'state' && fact.kind === 'palace_major_state') return !['庙旺化吉', '庙旺', '入庙', '陷地'].includes(value);
      if (field === 'group' && fact.kind === 'palace_body_star_group') return !['六吉', '四煞'].includes(value);
      if (fact.kind === 'bazi_stem_placement_count' && field === 'placement') {
        return !['visible', 'hidden', 'any', 'non_day'].includes(value);
      }
      if (fact.kind === 'bazi_stem_placement_count' && field === 'stem') {
        return typeof value !== 'string' || value.length !== 1 || !'甲乙丙丁戊己庚辛壬癸'.includes(value);
      }
      if (field === 'count') return !Number.isInteger(value) || value < 0
        || value > ({ bazi_ten_god_count: 4, palace_main_count: 14,
          bazi_stem_placement_count: ['visible', 'non_day'].includes(fact.placement) ? 3 : 4,
          palace_sector_benefic_count: 6, palace_sector_malefic_count: 4, palace_sector_six_malefic_count: 6,
          palace_opposite_benefic_count: 6, palace_opposite_six_malefic_count: 6 }[fact.kind] ?? 128);
      if (field === 'month') return !Number.isInteger(value) || value < 1 || value > 12;
      if (field === 'day') return !Number.isInteger(value) || value < 1 || value > 30;
      if (field === 'hour') return !Number.isInteger(value) || value < 0 || value > 11;
      if (field === 'ganZhi' && fact.kind === 'bazi_decadal_range') return !isBaZiPillar(value);
      if (field === 'startAge') return !Number.isInteger(value) || value < (method === 'ziwei' ? 2 : 1) || value > 116;
      if (field === 'endAge') return !Number.isInteger(value) || value !== fact.startAge + 9;
      if (field === 'yearBranch') return typeof value !== 'string' || value.length !== 1 || !'子丑寅卯辰巳午未申酉戌亥'.includes(value);
      if (field === 'leap') return typeof value !== 'boolean';
      if (field === 'gender') return !['男', '女'].includes(value);
      if (field === 'element') return !['木', '火', '土', '金', '水'].includes(value);
      if (field === 'classification') return !['旺相', '休囚', '太过', '不及'].includes(value);
      if (field === 'bureau') return !['水二局', '木三局', '金四局', '土五局', '火六局'].includes(value);
      if (field === 'zodiac') return value !== 'tropical';
      if (field === 'houseSystem') return value !== 'whole_sign';
      if (field === 'sect') return !['day', 'night'].includes(value);
      if (field === 'term') return !['大寒', '雨水', '春分', '谷雨', '小满', '夏至', '大暑', '处暑', '秋分', '霜降', '小雪', '冬至'].includes(value);
      if (field === 'zone') return !['豫', '冀', '扬', '徐', '雍'].includes(value);
      if (field === 'band') return !(fact.kind === 'bazi_element_balance' ? ['旺', '弱', '过盛', '少量']
        : fact.kind === 'bazi_solar_month_xun' ? ['early'] : ['early', 'middle', 'late']).includes(value);
      if (field === 'season') return !['旺', '相', '休', '囚', '死'].includes(value);
      if (field === 'angle') return !['ascendant', 'mc', 'descendant'].includes(value);
      if (field === 'motion') return !['direct', 'retrograde', 'stationary'].includes(value);
      if (field === 'profile' && fact.kind === 'bazi_ten_god_strength') return value !== (fact.strength === '少量'
        ? 'weighted-ten-god-share-v1' : 'anchored-weighted-ten-god-v1');
      if (field === 'profile') return value !== ({ bazi_element_temperament: 'element-weighted-temperament-v1',
        bazi_element_balance: 'weighted-element-balance-v1' }[fact.kind] ?? 'monthly-weighted-strength-v1');
      if (field === 'strength') return !(fact.kind === 'bazi_ten_god_strength'
        ? ['旺', '过盛', '少量'] : ['旺', '过盛']).includes(value);
      if (field === 'school') return !['真学堂', '真词馆'].includes(value);
      if (field === 'result') return !(fact.kind === 'bazi_month_pattern'
        ? ['见配合', '待配合', '见干扰'] : ['偏弱', '偏强', '相对均衡']).includes(value);
      if (field === 'head') return !['甲子', '甲戌', '甲申', '甲午', '甲辰', '甲寅'].includes(value);
      if (field === 'phase') return !['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'].includes(value);
      if (field === 'dimension') return !['star', 'number'].includes(value);
      if (field === 'grade') return !['上', '中', '下'].includes(value);
      if (field === 'relation') return !(fact.kind === 'bazi_branch_relation'
        ? ['六合', '六冲', '六害', '相破', '相刑', '自刑', '三刑', '三合', '互换空亡'] : fact.kind === 'daozang_palace_star'
          ? ['occupies', 'opposite', 'trine'] : ['opposite', 'trine', 'adjacent']).includes(value);
      return ['house', 'placedIn'].includes(field) ? !Number.isInteger(value) || value < 1 || value > 12
        : typeof value !== 'string' || !value.trim();
    })) {
      throw new TypeError('Invalid fields for ' + fact.kind);
    }
    const normalized = { kind: fact.kind, ...Object.fromEntries(fields.map((field) => [field, fact[field]])) };
    if (['aspect', 'aspect_orb', 'western_lilly_aspect', 'western_lilly_partile_aspect'].includes(normalized.kind)
      && normalized.first > normalized.second) {
      [normalized.first, normalized.second] = [normalized.second, normalized.first];
    }
    return normalized;
  });
}

export function chartKeywords(method, facts, absent = false) {
  return [...new Set(normalizeFacts(method, facts).map((fact) =>
    (absent ? '!' : '') + method + ':' + Object.values(fact).map((value) =>
      String(value).replaceAll('%', '%25').replaceAll(':', '%3A')).join(':')))].sort();
}
