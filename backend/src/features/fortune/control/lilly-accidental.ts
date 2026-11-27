import { e_tilt, GeoMoonState, MakeTime, RotateState, RotateVector, Rotation_EQJ_ECT, SphereFromVector, Vector } from 'astronomy-engine';
import { lillyEssentialDignities, lillyEssentialPolicy, type ClassicalPlanet } from './lilly-essential';
import { lillyApplicationInterpositions, lillyApplicationPolicy, lillyApplicationSequence, lillyMajorAspects,
  lillyTranslationWitnesses } from './lilly-application';

export type LillyEpochPosition = { body: ClassicalPlanet; longitude: number; speed: number };
const arc = (n: number) => ((n + 540) % 360 + 360) % 360 - 180;
const mainOrbs: Record<ClassicalPlanet, number> = { Saturn: 10, Jupiter: 12, Mars: 7.5, Sun: 17, Venus: 8, Mercury: 7, Moon: 12.5 };
const alternateOrbs: Record<ClassicalPlanet, number> = { Saturn: 9, Jupiter: 9, Mars: 7, Sun: 15, Venus: 7, Mercury: 7, Moon: 12 };
const meanArcseconds: Record<ClassicalPlanet, number> = { Saturn: 121, Jupiter: 299, Mars: 1887, Sun: 3548, Venus: 3548, Mercury: 3548, Moon: 47436 };
export const lillyAccidentalPolicy = {
  profile: 'lilly-accidental-source-v1',
  solar: { cazimiArcminutes: 17, combustionDegrees: 8.5, beamsDegrees: 17, combustionRequiresSameSign: true },
  solarExampleConflict: 'p113-ten-degree-example-differs-from-eight-and-half-definition-not-used-to-expand-threshold',
  orbPolicy: 'both-printed-columns-separate-half-sum-of-each-body-orb-not-transit-product-orb',
  motion: 'signed-geocentric-longitude-speed-20-minute-central-difference',
  moonSlowArcminutes: 790,
  phase: 'instantaneous-error-rate-not-a-forecast-of-perfection-or-refranation',
  application: lillyApplicationPolicy,
  reception: 'lilly-1647-p112-reciprocal-dignities-v1',
  judgement: 'no-total-score-or-well-affected-flag',
} as const;

export function lillyAspectOrbs(first: ClassicalPlanet, second: ClassicalPlanet) {
  return { mainOrb: (mainOrbs[first] + mainOrbs[second]) / 2,
    alternateOrb: (alternateOrbs[first] + alternateOrbs[second]) / 2 };
}

export function lillyPrintedLongitudeMinute(longitude: number) {
  const sign = Math.floor(longitude / 30);
  return sign + ':' + Math.round((longitude - sign * 30) * 60);
}

function validPosition(p: LillyEpochPosition) {
  return p && lillyEssentialPolicy.planets.some(body => body === p.body) && Number.isFinite(p.longitude)
    && p.longitude >= 0 && p.longitude < 360 && Number.isFinite(p.speed);
}

export function lillySolarCondition(planet: LillyEpochPosition, sun: LillyEpochPosition) {
  if (!validPosition(planet) || !validPosition(sun) || sun.body !== 'Sun') throw new RangeError('Invalid Lilly solar positions');
  if (planet.body === 'Sun') return { condition: 'not_applicable', body: planet.body } as const;
  const signedDistance = arc(planet.longitude - sun.longitude), separation = Math.abs(signedDistance);
  const signDistance = (Math.floor(planet.longitude / 30) - Math.floor(sun.longitude / 30) + 12) % 12;
  const sameSign = signDistance === 0;
  const cazimiDistance = separation <= 17 / 60, combustionDistance = separation <= 8.5, beamDistance = separation < 17;
  // Cazimi is distinguished from combustion, even though its raw angular
  // distance is also inside the combustion and beam distances. Across a sign
  // boundary the source's same-sign requirement is not silently invented away.
  const condition = cazimiDistance ? sameSign ? 'cazimi' : 'cross_sign_cazimi_unresolved'
    : combustionDistance && sameSign ? 'combust' : beamDistance ? 'under_beams' : 'free_of_beams';
  const distanceRate = Math.sign(signedDistance) * (planet.speed - sun.speed);
  return { body: planet.body, condition, separation, sameSign, adjacentOrSameSign: [0, 1, 11].includes(signDistance),
    withinCazimiDistance: cazimiDistance,
    withinCombustionDistance: combustionDistance, withinBeamDistance: beamDistance,
    definitionExampleConflict: true,
    distanceRate, relativePhase: separation < 1e-9 || Math.abs(separation - 180) < 1e-9 ? 'at_angle'
      : distanceRate < -1e-9 ? 'closing' : distanceRate > 1e-9 ? 'opening' : 'instantaneous_rate_zero',
    solarSide: separation < 1e-9 || Math.abs(separation - 180) < 1e-9 ? 'boundary'
      : signedDistance < 0 ? 'oriental' : 'occidental' } as const;
}

function mutualReception(subject: LillyEpochPosition, other: LillyEpochPosition, sect?: 'day' | 'night') {
  const receivedByOther = lillyEssentialDignities(other.body, subject.longitude);
  const receivedBySubject = lillyEssentialDignities(subject.body, other.longitude);
  const mutualHouse = receivedByOther.domicile && receivedBySubject.domicile;
  const mutualExaltation = receivedByOther.exalted && receivedBySubject.exalted;
  const mutualFace = receivedByOther.inOwnFace && receivedBySubject.inOwnFace;
  const byDay = receivedByOther.triplicityDayLord === other.body && receivedBySubject.triplicityDayLord === subject.body;
  const byNight = receivedByOther.triplicityNightLord === other.body && receivedBySubject.triplicityNightLord === subject.body;
  const mutualTriplicity = sect ? (sect === 'day' ? byDay : byNight)
    : byDay === byNight ? byDay : undefined;
  const termSides = [receivedByOther.inOwnTerm, receivedBySubject.inOwnTerm];
  const mutualTerm = termSides.includes(false) ? false : termSides.includes(undefined) ? undefined : true;
  if (!(mutualHouse || mutualExaltation || mutualFace || mutualTriplicity !== false || mutualTerm !== false)) return [];
  return [{ otherBody: other.body, mutualHouse, mutualExaltation, mutualFace,
    mutualTriplicity, triplicityBySect: byDay || byNight ? { day: byDay, night: byNight } : undefined,
    mutualTerm, termVariantUnresolved: mutualTerm === undefined }];
}

export function lillyPlanetConditions(body: string, positions: LillyEpochPosition[], house?: number,
  motion?: { at: number; read: Parameters<typeof lillyApplicationSequence>[4] }, sect?: 'day' | 'night') {
  if (!lillyEssentialPolicy.planets.some(p => p === body) || positions.length !== 7
    || positions.some(p => !validPosition(p)) || new Set(positions.map(p => p.body)).size !== 7
    || house !== undefined && (!Number.isInteger(house) || house < 1 || house > 12)) throw new RangeError('Invalid Lilly epoch');
  const subject = positions.find(p => p.body === body)!, sun = positions.find(p => p.body === 'Sun')!;
  const solar = lillySolarCondition(subject, sun), actualSign = Math.floor(subject.longitude / 30);
  const contacts = positions.filter(p => p.body !== body).flatMap(other => lillyMajorAspects.flatMap(aspect => {
    const delta = arc(other.longitude - subject.longitude), separation = Math.abs(delta), error = Math.abs(separation - aspect.angle);
    const { mainOrb, alternateOrb } = lillyAspectOrbs(subject.body, other.body);
    if (error > Math.max(mainOrb, alternateOrb)) return [];
    const residual = arc(delta - (delta < 0 ? -aspect.angle : aspect.angle));
    const errorRate = Math.sign(residual) * (other.speed - subject.speed);
    const signDifference = Math.abs(Math.floor(other.longitude / 30) - actualSign);
    const signAspectMatches = Math.min(signDifference, 12 - signDifference) * 30 === aspect.angle;
    const phase = error < 1e-9 ? 'at_angle' : errorRate < -1e-9 ? 'closing'
      : errorRate > 1e-9 ? 'opening' : 'instantaneous_rate_zero';
    const application = motion && signAspectMatches && phase === 'closing'
      ? lillyApplicationSequence(motion.at, subject, other, aspect.angle, motion.read) : undefined;
    const checksInterposition = aspect.type === 'conjunction'
      || (body === 'Saturn' || body === 'Moon') && (aspect.type === 'sextile' || aspect.type === 'trine');
    const interpositions = motion && application && checksInterposition
      ? lillyApplicationInterpositions(motion.at, subject, other, positions, motion.read, application, aspect.type) : undefined;
    return [{ otherBody: other.body, aspectType: aspect.type, angle: aspect.angle, separation, error,
      sameDegreeOfSign: Math.floor(other.longitude % 30) === Math.floor(subject.longitude % 30),
      mainOrb, alternateOrb, inMainOrb: error <= mainOrb, inAlternateOrb: error <= alternateOrb,
      orbAgreement: error <= Math.min(mainOrb, alternateOrb) ? 'both_columns' : 'column_dependent',
      signAspectMatches, phase, application, interpositions: interpositions?.length ? interpositions : undefined }];
  }));
  const receptions = positions.filter(p => p.body !== body).flatMap(other => mutualReception(subject, other, sect));
  // Book I pp.90–92 compares the reflected point with a planet in the same degree.
  const antiscionContacts = positions.filter(p => p.body !== body).flatMap(other => {
    const antiscion = (540 - other.longitude) % 360;
    const contraAntiscion = (antiscion + 180) % 360;
    return ([
      { kind: 'antiscion', longitude: antiscion },
      { kind: 'contra_antiscion', longitude: contraAntiscion },
    ] as const).flatMap(point => {
      if (Math.floor(subject.longitude) !== Math.floor(point.longitude)) return [];
      return [{ ...point, otherBody: other.body, distance: Math.abs(subject.longitude - point.longitude) }];
    });
  });
  const saturn = positions.find(p => p.body === 'Saturn')!, mars = positions.find(p => p.body === 'Mars')!;
  const maleficsSameSign = actualSign === Math.floor(saturn.longitude / 30) && actualSign === Math.floor(mars.longitude / 30);
  const besiegement = body === 'Saturn' || body === 'Mars' ? { status: 'not_applicable' }
    : maleficsSameSign ? { status: 'same_sign_body_example', between: subject.longitude > Math.min(saturn.longitude, mars.longitude)
      && subject.longitude < Math.max(saturn.longitude, mars.longitude), saturnLongitude: saturn.longitude, marsLongitude: mars.longitude }
      : { status: 'other_configurations_unresolved' };
  const meanSpeed = meanArcseconds[subject.body] / 3600, magnitude = Math.abs(subject.speed);
  const moonElongation = body === 'Moon' ? (subject.longitude - sun.longitude + 360) % 360 : undefined;
  const translations = motion && lillyTranslationWitnesses(motion.at, subject.body, positions, motion.read, lillyAspectOrbs);
  return { profile: lillyAccidentalPolicy.profile, body: subject.body, speed: subject.speed,
    directFortitudeApplicable: body !== 'Sun' && body !== 'Moon',
    motion: Math.abs(subject.speed) < 1e-9 ? 'instantaneous_rate_zero' : subject.speed < 0 ? 'retrograde' : 'direct',
    sourceMeanSpeed: meanSpeed, magnitudeComparedToMean: Math.abs(magnitude - meanSpeed) < 1e-9 ? 'equal'
      : magnitude > meanSpeed ? 'faster' : 'slower',
    moonBelowPrintedSlowThreshold: body === 'Moon' ? subject.speed < 790 / 60 : undefined,
    moonElongation, moonLight: moonElongation === undefined ? undefined : moonElongation < 1e-9 ? 'new_phase'
      : Math.abs(moonElongation - 180) < 1e-9 ? 'full_phase' : moonElongation < 180 ? 'increasing' : 'decreasing',
    solar, contacts, translations, antiscionContacts, receptionProfile: lillyAccidentalPolicy.reception, receptions, besiegement, house,
    houseKind: house === undefined ? undefined : [1, 4, 7, 10].includes(house) ? 'angular'
      : [2, 5, 8, 11].includes(house) ? 'succedent' : 'cadent',
    judgement: 'unresolved-overall-condition-fixed-stars-and-future-perfection' };
}

const housePoints: Record<number, number> = {
  1: 5, 2: 3, 3: 1, 4: 4, 5: 3, 6: -2, 7: 4, 8: -2, 9: 2, 10: 5, 11: 4, 12: -5,
};
const bookThreeEighthHouseExtraPenalty = 2;
const solarPoints = { cazimi: 5, combust: -5, under_beams: -4, free_of_beams: 5, not_applicable: 0,
  cross_sign_cazimi_unresolved: undefined };
const helpfulPartilePoints: Record<string, number> = { conjunction: 5, trine: 4, sextile: 3 };
const difficultPartilePoints: Record<string, number> = { conjunction: -5, opposition: -4, square: -3 };
const fortunateFixedStarPoints = { Regulus: 6, Spica: 5 };
const degreesToRadians = Math.PI / 180;
const masPerRadian = 3_600_000 / degreesToRadians;

// J2000 ICRS positions and proper motions as catalogued for HIP 49669, 65474 and 14576.
// The right ascension component of proper motion includes cos(declination).
const p115FixedStars = [
  { star: 'Regulus', ra: 15 * (10 + 8 / 60 + 22.31099 / 3600), dec: 11 + 58 / 60 + 1.9516 / 3600,
    pmRa: -248.73, pmDec: 5.59 },
  { star: 'Spica', ra: 15 * (13 + 25 / 60 + 11.57937 / 3600), dec: -(11 + 9 / 60 + 40.7501 / 3600),
    pmRa: -42.35, pmDec: -30.67 },
  { star: 'Algol', ra: 15 * (3 + 8 / 60 + 10.132 / 3600), dec: 40 + 57 / 60 + 20.3 / 3600,
    pmRa: 2.39, pmDec: -1.44 },
] as const;

export function lillyFixedStarPositions(at: number) {
  const time = MakeTime(new Date(at));
  const years = time.tt / 365.25;
  const rotation = Rotation_EQJ_ECT(time);
  return p115FixedStars.map(star => {
    const ra = star.ra * degreesToRadians, dec = star.dec * degreesToRadians;
    const cosRa = Math.cos(ra), sinRa = Math.sin(ra), cosDec = Math.cos(dec), sinDec = Math.sin(dec);
    const east = star.pmRa * years / masPerRadian, north = star.pmDec * years / masPerRadian;
    const position = new Vector(cosDec * cosRa - east * sinRa - north * sinDec * cosRa,
      cosDec * sinRa + east * cosRa - north * sinDec * sinRa, sinDec + north * cosDec, time);
    const { lon, lat } = SphereFromVector(RotateVector(rotation, position));
    return { star: star.star, longitude: lon, latitude: lat };
  });
}

export function lillyLunarNodes(at: number) {
  const time = MakeTime(new Date(at));
  const t = time.tt / 36_525;
  // IERS Conventions (2010), equation 5.43, expressed in arcseconds.
  const omega = 450160.398036 + t * (-6962890.5431 + t * (7.4722 + t * (0.007702 - 0.00005939 * t)));
  const normalize = (degrees: number) => (degrees % 360 + 360) % 360;
  const mean = normalize((omega + e_tilt(time).dpsi) / 3600);
  const { x, y, z, vx, vy, vz } = RotateState(Rotation_EQJ_ECT(time), GeoMoonState(time));
  const osculating = normalize(Math.atan2(y * vz - z * vy, x * vz - z * vx) * 180 / Math.PI);
  return { ascending: { mean, osculating },
    descending: { mean: normalize(mean + 180), osculating: normalize(osculating + 180) } };
}

function lillyP115Orientation(conditions: ReturnType<typeof lillyPlanetConditions>) {
  const { body, solar } = conditions;
  if (body === 'Sun' || body === 'Moon') return 0;
  if (solar.condition === 'not_applicable' || solar.solarSide === 'boundary') return undefined;
  const inferior = body === 'Venus' || body === 'Mercury';
  if (inferior && !solar.adjacentOrSameSign) return undefined;
  return solar.solarSide === (inferior ? 'occidental' : 'oriental') ? 2 : -2;
}

// Book I p.115 lists these weights. Book III's worked example gives a
// different eighth-house deduction, so the profile identifies this table.
export function lillyP115Points(essential: ReturnType<typeof lillyEssentialDignities>,
  conditions: ReturnType<typeof lillyPlanetConditions>, lunarNodes?: ReturnType<typeof lillyLunarNodes>,
  fixedStars?: ReturnType<typeof lillyFixedStarPositions>) {
  const receivesDomicile = conditions.receptions.some(row => row.mutualHouse);
  const receivesExaltation = conditions.receptions.some(row => row.mutualExaltation);
  const ownOrReceivedDomicile = essential.domicile || receivesDomicile;
  const ownOrReceivedExaltation = essential.exalted || receivesExaltation;
  const peregrine = receivesDomicile || receivesExaltation ? false
    : essential.hasEssentialDignity === undefined ? undefined : !essential.hasEssentialDignity;
  const partileContacts = conditions.contacts.flatMap(contact => {
    if (!contact.signAspectMatches || !contact.sameDegreeOfSign) return [];
    const weights = ['Jupiter', 'Venus'].includes(contact.otherBody) ? helpfulPartilePoints
      : ['Saturn', 'Mars'].includes(contact.otherBody) ? difficultPartilePoints : undefined;
    const points = weights?.[contact.aspectType];
    return points === undefined ? [] : [{ body: contact.otherBody, aspect: contact.aspectType, points }];
  });
  const nodeContact = (node: NonNullable<typeof lunarNodes>['ascending'], points: number) => {
    const degree = Math.floor(essential.longitude);
    const meanConjunction = degree === Math.floor(node.mean);
    const osculatingConjunction = degree === Math.floor(node.osculating);
    return { ...node, meanConjunction, osculatingConjunction,
      points: meanConjunction === osculatingConjunction ? meanConjunction ? points : 0 : undefined };
  };
  const nodeContacts = lunarNodes && { ascending: nodeContact(lunarNodes.ascending, 4),
    descending: nodeContact(lunarNodes.descending, -4) };
  const fixedStarContacts = fixedStars?.map(star => {
    const separation = Math.abs(arc(star.longitude - essential.longitude));
    const samePrintedMinute = lillyPrintedLongitudeMinute(star.longitude) === lillyPrintedLongitudeMinute(essential.longitude);
    // The p.115 table names these stars. The p.106 conjunction definition
    // supplies a positive check without assigning a wider stellar orb.
    const points = star.star === 'Algol'
      ? separation <= 5 ? -5 : 0
      : samePrintedMinute ? fortunateFixedStarPoints[star.star] : undefined;
    return { ...star, separation, sameDegree: Math.floor(star.longitude) === Math.floor(essential.longitude),
      samePrintedMinute, points };
  });
  const points = {
    domicile: ownOrReceivedDomicile ? 5 : 0,
    exaltation: ownOrReceivedExaltation ? 4 : 0,
    triplicity: essential.inTriplicity === undefined ? undefined : essential.inTriplicity ? 3 : 0,
    term: essential.inOwnTerm === undefined ? undefined : essential.inOwnTerm ? 2 : 0,
    face: essential.inOwnFace ? 1 : 0,
    detriment: essential.detriment ? -5 : 0,
    fall: essential.fall ? -4 : 0,
    peregrine: peregrine === undefined ? undefined : peregrine ? -5 : 0,
    house: conditions.house === undefined ? undefined : housePoints[conditions.house],
    direction: !conditions.directFortitudeApplicable ? 0
      : { direct: 4, retrograde: -5, instantaneous_rate_zero: undefined }[conditions.motion],
    speed: { faster: 2, slower: -2, equal: 0 }[conditions.magnitudeComparedToMean],
    solar: solarPoints[conditions.solar.condition],
    orientation: lillyP115Orientation(conditions),
    moonLight: conditions.moonLight === 'increasing' ? 2 : conditions.moonLight === 'decreasing' ? -2
      : conditions.body === 'Moon' ? undefined : 0,
    besiegement: conditions.besiegement.status === 'same_sign_body_example' ? conditions.besiegement.between ? -5 : 0
      : conditions.besiegement.status === 'not_applicable' ? 0 : undefined,
  };
  const known = [...Object.values(points), ...partileContacts.map(contact => contact.points),
    ...(fixedStarContacts?.map(contact => contact.points) ?? []),
    nodeContacts?.ascending.points, nodeContacts?.descending.points].filter(value => value !== undefined);
  return { profile: 'lilly-book-one-p115-selected-points-v1', points, partileContacts, nodeContacts, fixedStarContacts,
    fortitudes: known.filter(value => value > 0).reduce((sum, value) => sum + value, 0),
    debilities: known.filter(value => value < 0).reduce((sum, value) => sum - value, 0) };
}

export function lillyP745NatalMoonBalance(score: ReturnType<typeof lillyP115Points>, house: number) {
  // The Book III worked nativity subtracts its debilities from its fortitudes.
  // Its eighth-house deduction is four rather than the two on p.115.
  const { fortitudes } = score;
  const debilities = score.debilities + (house === 8 ? bookThreeEighthHouseExtraPenalty : 0);
  return { profile: 'lilly-book-three-p745-natal-moon-v1', fortitudes, debilities,
    net: fortitudes - debilities } as const;
}

function lillyNatalMoonUpperBalance(conditions: ReturnType<typeof lillyPlanetConditions>, score: ReturnType<typeof lillyP115Points>) {
  const { points } = score;
  // Count even the wider helpful contacts and the maximum named node and fixed-star bonuses.
  // Apply only established partile and Algol penalties, leaving uncertain debilities out.
  const knownPartileDebilities = score.partileContacts.reduce((sum, contact) => sum + Math.min(0, contact.points), 0);
  const algol = score.fixedStarContacts?.find(star => star.star === 'Algol')?.points ?? 0;
  const certainNet = Object.values(points).reduce<number>((sum, value) => sum + (value ?? 0), 0)
    + knownPartileDebilities + algol;
  const possibleDignities = (points.triplicity === undefined ? 3 : 0) + (points.term === undefined ? 2 : 0);
  const possibleHelpfulContacts = conditions.contacts.filter(contact => ['Jupiter', 'Venus'].includes(contact.otherBody))
    .reduce((sum, contact) => sum + (helpfulPartilePoints[contact.aspectType] ?? 0), 0);
  const possibleNodeAndStars = 4 + fortunateFixedStarPoints.Regulus + fortunateFixedStarPoints.Spica;
  const bookOneUpperNet = certainNet + possibleDignities + possibleHelpfulContacts + possibleNodeAndStars;
  const bookThreeUpperNet = bookOneUpperNet - (conditions.house === 8 ? bookThreeEighthHouseExtraPenalty : 0);
  return { bookOneUpperNet, bookThreeUpperNet };
}

export function lillyNatalMoonDebility(conditions: ReturnType<typeof lillyPlanetConditions>,
  score: ReturnType<typeof lillyP115Points>) {
  const { points } = score;
  if (conditions.body !== 'Moon' || conditions.house === undefined
    || points.detriment === 0 && points.fall === 0 || conditions.solar.condition !== 'combust'
    || conditions.moonLight !== 'decreasing') return;
  const balance = lillyNatalMoonUpperBalance(conditions, score);
  return { ...balance, weakInBoth: Math.max(balance.bookOneUpperNet, balance.bookThreeUpperNet) < 0 };
}

export function lillyNatalMoonWorkedDebility(conditions: ReturnType<typeof lillyPlanetConditions>,
  score: ReturnType<typeof lillyP115Points>) {
  if (conditions.body !== 'Moon' || conditions.house === undefined
    || conditions.solar.condition !== 'under_beams' || conditions.solar.withinCombustionDistance
    || conditions.moonLight !== 'decreasing') return;
  const balance = lillyNatalMoonUpperBalance(conditions, score);
  // Book III p.745 calls its net-minus-four Saturn weak. Use that demonstrated
  // balance for a conservative subset; the worked example gives no universal cutoff.
  return { ...balance, atMostWorkedExample: Math.max(balance.bookOneUpperNet, balance.bookThreeUpperNet) <= -4 };
}

function lillyP115ConfirmedNodeAndStarFortitudes(score: ReturnType<typeof lillyP115Points>) {
  return (score.nodeContacts?.ascending.points ?? 0)
    + (score.fixedStarContacts ?? []).reduce((sum, star) => sum + Math.max(star.points ?? 0, 0), 0);
}

export function lillyNatalMoonWorkedFortitude(conditions: ReturnType<typeof lillyPlanetConditions>,
  score: ReturnType<typeof lillyP115Points>) {
  if (conditions.body !== 'Moon' || conditions.house === undefined
    || conditions.solar.condition !== 'free_of_beams' || conditions.moonLight === undefined
    || conditions.contacts.some(({ otherBody, aspectType }) =>
      ['Mars', 'Saturn'].includes(otherBody) && difficultPartilePoints[aspectType] !== undefined)) return;

  const { points } = score;
  const conservativePoints = { ...points, peregrine: points.peregrine ?? -5,
    moonLight: points.moonLight ?? -2, besiegement: points.besiegement ?? -5 };
  const supportedNet = Object.values(conservativePoints).reduce<number>((sum, value) => sum + (value ?? 0), 0)
    + score.partileContacts.reduce((sum, row) => sum + row.points, 0);
  const descendingNode = score.nodeContacts?.descending.points ?? -4;
  const algol = score.fixedStarContacts?.find(star => star.star === 'Algol')?.points ?? -5;
  const bookOneLowerNet = supportedNet + descendingNode + algol + lillyP115ConfirmedNodeAndStarFortitudes(score);
  const bookThreeLowerNet = bookOneLowerNet - (conditions.house === 8 ? bookThreeEighthHouseExtraPenalty : 0);
  // Book III p.745 explicitly calls its net-three natal Moon strong.
  return { bookOneLowerNet, bookThreeLowerNet, atLeastWorkedExample: Math.min(bookOneLowerNet, bookThreeLowerNet) >= 3 };
}

export function lillyVenusFortitudeAtReturn(essential: ReturnType<typeof lillyEssentialDignities>,
  conditions: ReturnType<typeof lillyPlanetConditions>, score: ReturnType<typeof lillyP115Points>,
  eighthHouseWitness?: { marsLongitude: number; saturnLongitude: number }) {
  const { points } = score;
  // Book I p.115 assigns fortitude to every house with positive points.
  const workedEighthHouse = conditions.house === 8 && eighthHouseWitness !== undefined;
  const supportedHouse = (points.house ?? 0) > 0 || workedEighthHouse;
  // Books I and III distinguish the Sun's heart as fortitude, not combustion.
  const supportedSolarCondition = conditions.solar.condition === 'free_of_beams' || conditions.solar.condition === 'cazimi';
  // Book I p.115 gives verified mutual reception the same points as the planet's own dignity.
  // Book III's worked eighth-house example still requires her own domicile.
  const majorDignity = workedEighthHouse ? (essential.domicile ? 5 : 0) + (essential.exalted ? 4 : 0)
    : points.domicile + points.exaltation;
  if (conditions.body !== 'Venus' || !supportedHouse || !majorDignity
    || !supportedSolarCondition || conditions.motion !== 'direct'
    || conditions.contacts.some(contact => ['Mars', 'Saturn'].includes(contact.otherBody)
      && difficultPartilePoints[contact.aspectType] !== undefined)) return;
  if (workedEighthHouse) {
    const mars = arc(eighthHouseWitness.marsLongitude - essential.longitude);
    const saturn = arc(eighthHouseWitness.saturnLongitude - essential.longitude);
    // In the p.744 figure both malefic bodies lie on the same side of Venus.
    // This resolves the body-between condition only for this worked branch.
    if (!essential.domicile || !essential.inOwnTerm || essential.termStatus !== 'ready'
      || conditions.solar.condition !== 'cazimi' || conditions.solar.solarSide !== 'occidental'
      || conditions.magnitudeComparedToMean !== 'faster' || mars * saturn <= 0
      || Math.abs(mars) === 180 || Math.abs(saturn) === 180) return;
  }
  const house = workedEighthHouse ? -4 : points.house ?? 0;
  const besiegement = workedEighthHouse ? 0 : points.besiegement ?? -5;
  const certainNet = majorDignity + points.detriment + points.fall
    + (points.triplicity ?? 0) + (essential.termStatus === 'ready' ? points.term ?? 0 : 0) + points.face + house
    + (points.direction ?? 0) + (points.speed ?? -2) + (points.solar ?? 0) + (points.orientation ?? -2);
  const descendingNode = score.nodeContacts?.descending.points ?? -4;
  const algol = score.fixedStarContacts?.find(star => star.star === 'Algol')?.points ?? -5;
  const partileSupport = score.partileContacts.reduce((sum, contact) => sum + Math.max(contact.points, 0), 0);
  const lowerNet = certainNet + besiegement + descendingNode + algol + partileSupport
    + lillyP115ConfirmedNodeAndStarFortitudes(score);
  // Book III pp.744–745 calls Venus powerful at a net sixteen. Require at
  // least that much even with unresolved listed debilities counted.
  return { lowerNet, atLeastWorkedExample: lowerNet >= 16 };
}
