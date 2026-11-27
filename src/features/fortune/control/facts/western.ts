import { buildWesternCalculation, readTransitLongitude, readTransitStationTimes, slowTransitBodies } from '../solar-transits';
import { buildWesternProgressions, progressedAspects, progressionEpoch, progressionPolicy, readProgressionPosition } from '../western-progressions';
import { buildWesternSourceHouses, zodiacalHouse } from '../western-houses';
import { buildPtolemyTimes } from '../ptolemy-times';
import { buildLunationWindows, westernProgressionTransitOverlaps } from '../western-time-links';
import { buildSepharialLunationContexts } from '../sepharial-lunation';
import { buildLeoSourceContext, leoParallelDifference, readLeoAppendixDate, readLeoMovingPosition } from '../leo-source-context';
import { buildLeoSolarLunarPhases, buildLeoSolarPhases, leoSolarLunarPhasePolicy, leoSolarPhasePolicy } from '../leo-solar-phases';
import { buildLeoLunarConditions, leoLunarConditionPolicy } from '../leo-lunar-conditions';
import { buildLeoLunarHouses, leoAnnualHouseFrames, leoLunarHousePolicy, readLeoMonthlyLunarFrame } from '../leo-lunar-houses';
import { buildLeoJupiterHouseContexts, buildLeoSecondHouseContexts, buildLeoTransitNatal, leoJupiterHousePolicy,
  leoNatalTransitPolicy, leoSolarNatalContacts } from '../leo-transit-natal';
import { buildLeoAscendantContext } from '../leo-ascendant';
import { buildLillyLocatedReturn, buildLillyReturnContext, buildLillySolarReturnPositions, lillyReturnPolicy } from '../lilly-returns';
import { buildHeindelSourceContext, heindelStrongTransitWindows, heindelSourcePolicy, linkHeindelSaturnAngleTransits, linkHeindelTransits,
  readHeindelPosition, readHeindelTransitObservation } from '../heindel-source-context';
import { buildLeoLuminaryNatal, linkLeoJupiterLuminaries } from '../leo-jupiter-luminaries';
import { createJupiterRepeatScanner, heindelJupiterRepeatPolicy } from '../heindel-jupiter-repeats';
import { isoUtc, utcRange } from '../fact-time-context';
import type { AuthorizedFortuneInput, FortuneReturnLocation } from '../../model/fortune-facts';
import { factPolicies, type Writer, type Context, type Status } from './context';
export function westernFacts(writer: Writer, time: Context, reference?: AuthorizedFortuneInput, returnLocation?: FortuneReturnLocation): Status {
  const { window, referenceAt } = time;
  const chart = reference?.chart;
  const result = buildWesternCalculation(window, referenceAt, chart?.western, undefined,
    { anglesReliable: chart?.timeKnown === true && chart.western.rawResult.length === 1, includeOppositeAxes: false });
  for (const candidate of result.candidates) {
    const raw = writer.raw({ natal: candidate.natal, targets: candidate.targets });
    for (const target of candidate.targets) writer.add(window, {
      scope: 'natal', factType: 'natal_position', subjectIds: ['western:candidate:' + candidate.candidateId, target.id],
      normalizedPayload: { body: target.id, longitude: target.longitude, zodiac: 'tropical',
        houseSystem: result.anglesReliable ? 'whole-sign' : undefined,
        natalHouse: result.anglesReliable
          ? (Math.floor(target.longitude / 30) - Math.floor(candidate.natal.ascendant / 30) + 12) % 12 + 1 : undefined },
    }, raw);
  }
  const solarReturns = buildLillySolarReturnPositions(window, result.natalStatus === 'ready' ? chart : undefined);
  const locatedReturn = time.displayWindow.periodType === 'year' ? buildLillyLocatedReturn(window, chart, solarReturns, returnLocation) : undefined;
  const seventhReturn = locatedReturn?.seventh;
  let locatedSource: string | undefined;
  for (const item of solarReturns) {
    const raw = writer.raw(item);
    const located = locatedReturn?.returnAt === item.returnAt;
    if (located) locatedSource = raw;
    writer.add(item, { scope: 'yearly', factType: 'solar_return',
      subjectIds: ['Sun', 'solar-return'],
      normalizedPayload: { ...item, returnAt: isoUtc(item.returnAt), returnEnd: isoUtc(item.returnEnd),
        zodiac: 'tropical', returnAngles: located ? 'regiomontanus_verified' : 'unavailable',
        traditionalDignities: 'unavailable',
        houseSystem: located ? 'regiomontanus' : 'unavailable',
        returnLocalFrame: located ? lillyReturnPolicy.localFrame : undefined,
        saturnMidheavenApproachStatus: located ? locatedReturn.saturnMidheavenApproachStatus : undefined },
    }, raw);
    if (seventhReturn?.returnAt === item.returnAt) {
      const { start, end, returnAt, returnEnd, ...comparison } = seventhReturn;
      writer.add({ start, end }, { scope: 'yearly', factType: 'lilly_return_seventh_context',
        subjectIds: ['western:candidate:0', 'lilly-return-ascendant', 'natal-seventh-cusp'],
        normalizedPayload: { ...comparison, returnAt: isoUtc(returnAt), returnEnd: isoUtc(returnEnd) },
      }, raw);
    }
  }
  const lilly = buildLillyReturnContext(window, chart, solarReturns, locatedReturn);
  for (const item of lilly.contexts) {
    const raw = writer.raw({ policy: lilly.policy, context: item });
    const sources = item.returnLocalFrame && locatedSource ? [raw, locatedSource] : [raw];
    writer.add(item, { scope: 'yearly', factType: 'lilly_return_context',
      subjectIds: ['western:candidate:0', 'lilly-return', item.pair],
      normalizedPayload: { ...item, birthAt: isoUtc(item.birthAt), returnAt: isoUtc(item.returnAt), returnEnd: isoUtc(item.returnEnd) },
    }, ...sources);
  }
  const premise = (ids: string[]) => ({ ...factPolicies.western, subjectIds: ids });
  const aspectTypes = { 0: 'conjunction', 60: 'sextile', 90: 'square', 120: 'trine', 180: 'opposition' } as const;
  const checkTransitObservations = time.displayWindow.periodType === 'year' && result.natalStatus === 'ready'
    && chart?.timeKnown === true && result.candidates.length === 1;
  for (const group of result.natalContacts) {
    const ids = [group.planet, group.target];
    const source = writer.raw(group);
    for (const aspect of group.aspects) {
      const identity = [group.planet, group.target, aspect.angle, aspect.offset].join(':');
      const data = { ...premise(ids), aspectType: aspectTypes[aspect.angle], exactAngle: aspect.angle,
        slowTransit: slowTransitBodies.has(group.planet),
        allowedOrb: aspect.allowedOrb, natalLongitude: group.natalLongitude, transitBody: group.planet,
        natalTargetId: group.target, natalTargetType: ['ASC', 'MC', 'DSC', 'IC'].includes(group.target) ? 'angle' : 'planet' };
      if (checkTransitObservations) {
        for (const pass of aspect.exact) {
          if (pass.at < window.start || pass.at >= window.end) continue;
          const observation = readHeindelTransitObservation(group.planet, group.target, data.aspectType, pass.direction);
          if (!observation) continue;
          writer.add({ start: pass.at, end: Math.min(pass.at + 1000, window.end) }, {
            scope: 'transit', factType: 'heindel_transit_observation', subjectIds: ids, exactInstant: isoUtc(pass.at), timePrecision: 'second',
            normalizedPayload: { profile: heindelSourcePolicy.transitObservationProfile, zodiac: 'tropical',
              transitBody: group.planet, natalTargetId: group.target, aspectType: data.aspectType,
              transitMotion: pass.direction, observation },
          }, source);
        }
      }
      const passes = new Set<number>();
      for (const band of aspect.orbWindows) {
        const anchor = band.episodeStart === undefined ? 'clipped:' + band.start : Math.round(band.episodeStart / 1000);
        const parentSignalId = 'western:' + identity + ':' + anchor;
        writer.add(band, { scope: 'transit', factType: 'aspect_interval', subjectIds: ids, parentSignalId,
          completeness: band.episodeStart === undefined ? 'partial' : 'complete',
          normalizedPayload: { ...data, ...band, sampleInstant: isoUtc(band.sampleAt),
            episodeStartInstant: band.episodeStart === undefined ? undefined : isoUtc(band.episodeStart),
            actualAngle: angleDistance(band.transitLongitude, group.natalLongitude),
            ingressInstant: band.enters ? isoUtc(band.start) : undefined, egressInstant: band.exits ? isoUtc(band.end) : undefined } }, source);
        const exact = aspect.exact.filter(item => band.start <= item.at && item.at < band.end);
        exact.forEach((pass, index) => {
          passes.add(pass.at);
          const retrogradeLoop = pass.retrogradeLoop && {
            turns: pass.retrogradeLoop.turns.map(turn => ({ ...turn, at: isoUtc(turn.at) })),
            passes: pass.retrogradeLoop.passes.map(point => ({ ...point, at: isoUtc(point.at) })),
          };
          writer.add(band, { scope: 'transit', factType: 'aspect_exact', subjectIds: ids, parentSignalId,
            exactInstant: isoUtc(pass.at), timePrecision: 'second', normalizedPayload: { ...data, ...pass, retrogradeLoop,
              transitMotion: pass.direction, applying: false, separating: false,
              actualAngle: angleDistance(pass.transitLongitude, group.natalLongitude),
              passIndex: band.episodeStart === undefined ? undefined : band.earlierPasses + index + 1 } }, source);
        });
      }
      for (const pass of aspect.exact) if (!passes.has(pass.at)) {
        writer.add(window, { scope: 'transit', factType: 'aspect_exact', subjectIds: ids,
          parentSignalId: 'western:' + identity + ':' + pass.at,
          exactInstant: isoUtc(pass.at), timePrecision: 'second',
          completeness: 'partial', warnings: ['精确点缺少已验证的相位有效区间'],
          normalizedPayload: { ...data, at: pass.at, direction: pass.direction, transitLongitude: pass.transitLongitude, orb: pass.orb,
            actualAngle: angleDistance(pass.transitLongitude, group.natalLongitude),
            transitMotion: pass.direction, applying: false, separating: false } }, source);
      }
    }
  }
  for (const candidate of result.candidates) for (const body of candidate.transits) {
    const ids = ['western:candidate:' + candidate.candidateId, body.planet];
    const source = writer.raw({ ...body, candidateId: candidate.candidateId, referenceAt, natal: candidate.targets });
    for (const aspect of body.aspects) {
      writer.add(window, { scope: 'transit', factType: 'aspect_reference', subjectIds: [...ids, aspect.target],
        completeness: result.anglesReliable ? 'complete' : 'partial',
        normalizedPayload: { ...aspect, at: isoUtc(referenceAt) } }, source);
    }
    if (body.houseAtStart === null) continue;
    const changes = [{ at: window.start, house: body.houseAtStart, initial: true },
      ...body.houseIngresses.map(item => ({ ...item, initial: false }))];
    changes.forEach(({ at, house, initial }, index) => {
      const end = changes[index + 1]?.at ?? window.end;
      if (at >= end) return;
      writer.add({ start: at, end }, { scope: 'transit', factType: 'house_interval', subjectIds: ids,
        normalizedPayload: { transitBody: body.planet, natalHouse: house, houseSystem: 'whole-sign',
          ingressInstant: initial ? undefined : isoUtc(at), egressInstant: end === window.end ? undefined : isoUtc(end) },
      }, source);
    });
  }
  for (const position of result.sky) writer.add(window, {
    scope: 'transit', factType: 'sky_position', subjectIds: [position.planet],
    normalizedPayload: { ...position, at: isoUtc(referenceAt) },
  }, writer.raw(position));
  for (const motion of result.motion) {
    const source = writer.raw(motion);
    for (const [type, events] of [['sign_ingress', motion.ingresses], ['station', motion.stations]] as const) {
      for (const event of events) writer.add(window, { scope: 'transit', factType: type,
        exactInstant: isoUtc(event.at), timePrecision: 'second', subjectIds: [motion.planet], normalizedPayload: event,
      }, source);
    }
    for (const station of motion.stations) for (const target of result.timelineTargets) {
      const separation = angleDistance(station.longitude, target.longitude);
      if (separation > 3) continue;
      writer.add(window, { scope: 'transit', factType: 'station_natal_contact',
        subjectIds: [motion.planet, target.id], exactInstant: isoUtc(station.at), timePrecision: 'second',
        normalizedPayload: { transitBody: motion.planet, natalTargetId: target.id, natalLongitude: target.longitude,
          stationLongitude: station.longitude, separation, exactConjunction: separation <= 0.000001,
          numericalTolerance: 0.000001, slowTransit: slowTransitBodies.has(motion.planet),
          directionAfter: station.directionAfter, zodiac: 'tropical' },
      }, source);
    }
  }
  const moon = writer.raw(result.moon);
  for (const phase of result.moon.phases) writer.add(window, { scope: 'transit', factType: 'moon_phase',
    exactInstant: isoUtc(phase.at), timePrecision: 'second', subjectIds: ['Moon', 'Sun'], normalizedPayload: phase }, moon);
  for (const phase of result.moon.phases.filter(phase => phase.angle === 0)) {
    const longitude = readTransitLongitude('Sun', phase.at);
    for (const target of result.timelineTargets) {
      const separation = angleDistance(longitude, target.longitude);
      writer.add(window, { scope: 'transit', factType: 'new_moon_natal_contact',
        subjectIds: ['Moon', 'Sun', target.id], exactInstant: isoUtc(phase.at), timePrecision: 'second',
        normalizedPayload: { longitude, natalTargetId: target.id, natalLongitude: target.longitude, separation,
          exactConjunction: separation <= 0.000001, numericalTolerance: 0.000001, zodiac: 'tropical' },
      }, moon);
    }
  }
  const lunations = result.natalStatus === 'ready' ? buildLunationWindows(window) : [];
  const lunationRawIds = new Map<string, string>();
  for (const row of lunations) {
    const newMoonAt = isoUtc(row.newMoonAt);
    const raw = writer.raw(row);
    lunationRawIds.set(newMoonAt, raw);
    writer.add(row, {
      scope: 'transit', factType: 'lunation_window', subjectIds: ['Sun', 'Moon'],
      exactInstant: window.start <= row.newMoonAt && row.newMoonAt < window.end ? newMoonAt : undefined,
      normalizedPayload: { ...row, newMoonAt, nextNewMoonAt: isoUtc(row.nextNewMoonAt) },
    }, raw);
  }
  for (const pair of result.skyAspects) {
    const source = writer.raw(pair);
    for (const aspect of pair.aspects) for (const band of aspect.orbWindows) writer.add(band, {
      scope: 'transit', factType: 'sky_aspect_interval', subjectIds: [pair.first, pair.second],
      normalizedPayload: { ...band, angle: aspect.angle, allowedOrb: aspect.allowedOrb,
        exactInstants: band.exact.map(isoUtc) },
    }, source);
  }
  const warnings = [...(result.natalStatus !== 'ready' ? ['缺少兼容西方本命盘，已保留公共天象'] : []),
    ...(!result.anglesReliable ? ['出生时刻或本命候选未确认，个人轴线和宫位不可用'] : []),
    ...(result.candidates.length > 1 ? ['个人相位周期扫描使用候选一致的本命黄经'] : []),
    ...(result.natalContacts.some(item => item.aspects.some(aspect => aspect.orbWindows.some(
      band => band.episodeStart === undefined))) ? ['部分行运在回查范围内找不到入相边界'] : [])];
  const progression = buildWesternProgressions(window, referenceAt, chart);
  if (progression.status === 'ready') {
    const source = writer.raw({ kind: 'secondary_progression', ...progression });
    for (const position of progression.positions) writer.add(window, { scope: 'progressed', factType: 'progressed_position',
      subjectIds: ['western:candidate:0', position.body], normalizedPayload: {
        ...position, progressionPolicy: progression.policy.version, zodiac: 'tropical',
        coordinateFrame: progression.policy.coordinateFrame, referenceAt: isoUtc(referenceAt),
      } }, source);
    for (const band of progression.intervals) {
      const subjects = ['western:candidate:0', band.progressedBody, band.natalTargetId];
      const parentSignalId = ['secondary', 'clipped', band.progressedBody, band.natalTargetId, band.aspectType, band.start].join(':');
      const payload = { ...band, progressionPolicy: progression.policy.version, zodiac: 'tropical',
        targetKind: 'natal', kind: 'secondary', coordinateFrame: progression.policy.coordinateFrame,
        sameHemisphere: band.aspectType === 'parallel' ? true : undefined };
      writer.add(band, { scope: 'progressed', factType: 'progressed_aspect', subjectIds: subjects, parentSignalId,
        normalizedPayload: payload }, source);
      for (const at of band.exactTimes) if (band.start <= at && at < band.end) {
        const exact = readProgressionPosition(band.progressedBody, progressionEpoch(progression.birthAt, at), progression.birthAt);
        const difference = band.natalLongitude === undefined ? undefined : Math.abs((exact.longitude - band.natalLongitude + 540) % 360 - 180);
        writer.add(band, { scope: 'progressed', factType: 'progressed_aspect_exact', subjectIds: subjects, parentSignalId,
          exactInstant: isoUtc(at), timePrecision: 'second', normalizedPayload: { ...payload,
            progressedLongitude: difference === undefined ? undefined : exact.longitude,
            progressedDeclination: band.natalDeclination === undefined ? undefined : exact.declination,
            separation: difference === undefined ? Math.abs(exact.declination - band.natalDeclination!) : Math.abs(difference - band.exactAngle!),
          },
        }, source);
      }
    }
  } else if (result.natalStatus === 'ready') warnings.push('次限推运所需出生时刻或本命一致性未确认，保留已有行运结果');
  const sourceHouses = buildWesternSourceHouses(window, chart, result.motion);
  if (sourceHouses.status === 'ready' || sourceHouses.status === 'partial') {
    const raw = writer.raw(sourceHouses);
    const sepharial = { houseSystem: 'placidus', houseProfile: sourceHouses.policy.sepharialHouseProfile,
      zodiac: sourceHouses.policy.zodiac };
    if (time.displayWindow.periodType === 'month') {
      for (const row of buildSepharialLunationContexts(lunations, sourceHouses, writer.facts)) {
        const { sourceFactIds, ...calculation } = row;
        const { start, end, newMoonAt, nextNewMoonAt, ...context } = calculation;
        const contacts = <T extends { at: number }>(rows: T[]) => rows.map(({ at, ...contact }) => ({ ...contact, at: isoUtc(at) }));
        const dated = { primaryDirections: contacts(row.primaryDirections), sphericalPrimaryDirections: contacts(row.sphericalPrimaryDirections),
          solarDirections: contacts(row.solarDirections), lunarDirections: contacts(row.lunarDirections),
          annualProgressedLunarDirections: row.annualProgressedLunarDirections.map(({ at, annualEphemerisAt, ...direction }) => ({
            ...direction, at: isoUtc(at), annualEphemerisAt: isoUtc(annualEphemerisAt),
          })),
          transits: contacts(row.transits), stationaryTransits: contacts(row.stationaryTransits) };
        writer.add({ start, end }, { scope: 'transit', factType: 'sepharial_lunation_context',
          subjectIds: ['western:candidate:0', ...new Set(['Sun', 'Moon', ...(row.natalTarget ? [row.natalTarget] : [])])],
          normalizedPayload: { ...context, ...dated, zodiac: 'tropical',
            newMoonAt: isoUtc(newMoonAt), nextNewMoonAt: isoUtc(nextNewMoonAt) },
        }, raw, writer.raw(calculation), ...sourceFactIds);
      }
    }
    const jupiter = result.timelineTargets.find(target => target.id === 'Jupiter');
    if (time.displayWindow.periodType === 'month' && sourceHouses.placidus.status === 'ready' && jupiter) {
      const natalHouse = zodiacalHouse(jupiter.longitude, sourceHouses.placidus.cusps);
      const numericalTolerance = sourceHouses.policy.sepharialLunationTolerance;
      for (const row of lunations) {
        const separation = angleDistance(row.longitude, jupiter.longitude);
        writer.add(row, { scope: 'transit', factType: 'sepharial_jupiter_lunation',
          subjectIds: ['western:candidate:0', 'Jupiter', 'Moon', 'Sun'],
          normalizedPayload: { ...sepharial, natalHouse, natalJupiterLongitude: jupiter.longitude,
            newMoonLongitude: row.longitude, separation, numericalTolerance, exactConjunction: separation <= numericalTolerance,
            newMoonAt: isoUtc(row.newMoonAt), nextNewMoonAt: isoUtc(row.nextNewMoonAt) },
        }, raw, writer.raw(row));
      }
    }
    for (const houses of [sourceHouses.placidus, sourceHouses.regio]) if (houses.status === 'ready') writer.add(window, {
      scope: 'natal', factType: 'natal_house_cusps', subjectIds: ['western:candidate:0', houses.system],
      normalizedPayload: { houseSystem: houses.system, zodiac: 'tropical', cusps: houses.cusps,
        geometryBasis: sourceHouses.policy.natalFrame, sourceHousePolicy: sourceHouses.policy.version },
    }, raw);
    for (const interval of sourceHouses.ascendant) writer.add(interval, {
      scope: 'progressed', factType: 'progressed_ascendant', subjectIds: ['western:candidate:0', 'ASC'],
      normalizedPayload: { ...interval, calculationProfile: 'leo-1906-original', zodiac: 'tropical',
        sourceHousePolicy: sourceHouses.policy.version, anglePolicy: sourceHouses.policy.progressedAngles },
    }, raw);
    for (const interval of sourceHouses.moon) writer.add(interval, {
      scope: 'progressed', factType: 'progressed_house', subjectIds: ['western:candidate:0', 'Moon'],
      normalizedPayload: { ...interval, house: interval.natalHouse, kind: 'secondary', targetKind: 'natal',
        houseProfile: 'leo-original-natal', houseSystem: 'placidus', zodiac: 'tropical',
        progressionPolicy: sourceHouses.progressionPolicy, sourceHousePolicy: sourceHouses.policy.version },
    }, raw);
    for (const transit of sourceHouses.transits) {
      const sepharialIngress = time.displayWindow.periodType === 'year' ? transit.sepharialSecondHouse : [];
      for (const { start, end, ...contact } of sepharialIngress) writer.add({ start, end }, {
        scope: 'transit', factType: 'sepharial_saturn_second_house',
        subjectIds: ['western:candidate:0', 'Saturn', 'cusp:2'],
        ...(contact.enteredThroughSecondCusp ? { exactInstant: isoUtc(start), timePrecision: 'second' as const } : {}),
        normalizedPayload: { ...sepharial, ...contact },
      }, raw);
      for (const contact of transit.leoMcTenth) {
        const { start, end, mcContacts, ...payload } = contact;
        const entry = mcContacts.find(c => c.role === 'entering'), exit = mcContacts.find(c => c.role === 'leaving');
        const exact = mcContacts.find(c => start <= c.at && c.at < end);
        writer.add({ start, end }, { scope: 'transit', factType: 'leo_mc_tenth_contact',
          subjectIds: ['western:candidate:0', transit.body, 'MC', 'cusp:10'],
          parentSignalId: ['leo-mc-tenth', 'clipped', transit.body, start, end].join(':'),
          ...(exact ? { exactInstant: isoUtc(exact.at), timePrecision: 'second' as const } : {}),
          normalizedPayload: { ...payload, transitBody: transit.body, houseProfile: 'leo-original-natal',
            mcContacts: mcContacts.map(c => ({ ...c, at: isoUtc(c.at) })),
            ingressInstant: entry ? isoUtc(entry.at) : undefined, egressInstant: exit ? isoUtc(exit.at) : undefined,
            sourceHousePolicy: sourceHouses.policy.version },
        }, raw);
      }
      for (const interval of transit.placidusIntervals) writer.add(interval, {
        scope: 'transit', factType: 'traditional_house_interval', subjectIds: ['western:candidate:0', transit.body],
        normalizedPayload: { transitBody: transit.body, natalHouse: interval.natalHouse, houseSystem: 'placidus', zodiac: 'tropical',
          houseProfile: 'leo-original-natal', sourceHousePolicy: sourceHouses.policy.version },
      }, raw);
      if (sourceHouses.regio.status === 'ready') for (const crossing of transit.regioSecondCusp) writer.add(window, {
        scope: 'transit', factType: 'traditional_cusp_crossing', subjectIds: ['western:candidate:0', transit.body, 'cusp:2'],
        exactInstant: isoUtc(crossing.at), timePrecision: 'second', normalizedPayload: { transitBody: transit.body,
          house: 2, cuspLongitude: sourceHouses.regio.cusps[1], transitMotion: crossing.direction,
          houseSystem: 'regiomontanus', zodiac: 'tropical', houseProfile: 'lilly-regiomontanus-v1',
          sourceHousePolicy: sourceHouses.policy.version },
      }, raw);
    }
  }
  if (sourceHouses.status !== 'ready' && result.natalStatus === 'ready') warnings.push('部分来源宫制或角点几何依据不可用，不以整宫制代替');
  const ptolemy = buildPtolemyTimes(window, time.displayWindow.periodType, chart, result.motion);
  if (ptolemy.status === 'ready') {
    const source = writer.raw({ policy: ptolemy.policy, calculation: ptolemy });
    for (const place of ptolemy.places) writer.add(place, { scope: 'progressed', factType: 'ptolemy_time_place',
      subjectIds: ['western:candidate:0', place.origin], normalizedPayload: { ...place,
        fullPeriodStart: isoUtc(place.fullPeriodStart), fullPeriodEnd: isoUtc(place.fullPeriodEnd),
        annualStart: isoUtc(place.annualStart), annualEnd: isoUtc(place.annualEnd) } }, source);
    for (const contact of ptolemy.contacts) writer.add(contact, { scope: 'transit', factType: 'ptolemy_ingress_contact',
      subjectIds: ['western:candidate:0', contact.origin, contact.transitBody],
      exactInstant: contact.physicalIngressAt === undefined ? undefined : isoUtc(contact.physicalIngressAt),
      timePrecision: contact.physicalIngressAt === undefined ? 'range' : 'second',
      normalizedPayload: { ...contact, physicalIngressAt: contact.physicalIngressAt === undefined ? undefined : isoUtc(contact.physicalIngressAt),
        timedPlaceIngressAt: contact.timedPlaceIngressAt === undefined ? undefined : isoUtc(contact.timedPlaceIngressAt),
        dayManuscriptIngressAt: contact.dayManuscriptIngressAt === undefined ? undefined : isoUtc(contact.dayManuscriptIngressAt),
        dayManuscriptPeriodStart: contact.dayManuscriptPeriodStart === undefined ? undefined : isoUtc(contact.dayManuscriptPeriodStart),
        dayManuscriptPeriodEnd: contact.dayManuscriptPeriodEnd === undefined ? undefined : isoUtc(contact.dayManuscriptPeriodEnd),
        fullPeriodStart: isoUtc(contact.fullPeriodStart), fullPeriodEnd: isoUtc(contact.fullPeriodEnd),
        annualStart: isoUtc(contact.annualStart), annualEnd: isoUtc(contact.annualEnd) } }, source);
    for (const { start, end, physicalIngressAt, profile, level, ...contact } of ptolemy.authorTermContacts) writer.add({ start, end }, {
      scope: 'transit', factType: 'ptolemy_ingress_contact', subjectIds: ['western:candidate:0', contact.origin, contact.transitBody],
      exactInstant: physicalIngressAt === undefined ? undefined : isoUtc(physicalIngressAt),
      timePrecision: physicalIngressAt === undefined ? 'range' : 'second', normalizedPayload: {
        ...contact, profile: ptolemy.policy.profile, natalGovernorProfile: ptolemy.policy.natalRulers.profile, level: 'authorTerm',
        authorTermProfile: profile, authorTermLevel: level, aspectType: 'conjunction',
        physicalIngressAt: physicalIngressAt === undefined ? undefined : isoUtc(physicalIngressAt),
      },
    }, source);
    for (const { start, end, ...phase } of ptolemy.lunarPhaseContacts) writer.add({ start, end }, {
      scope: 'transit', factType: 'ptolemy_lunar_phase_contact', subjectIds: ['western:candidate:0', phase.origin, phase.phase],
      exactInstant: isoUtc(start), timePrecision: 'second', normalizedPayload: phase,
    }, source);
  }
  for (const overlap of westernProgressionTransitOverlaps(writer.facts)) writer.add(overlap, {
    scope: 'transit', factType: 'progression_transit_overlap', subjectIds: ['western:candidate:0', String(overlap.natalTargetId)],
    normalizedPayload: overlap,
  }, writer.raw(overlap), ...overlap.sourceFactIds);
  const leo = buildLeoSourceContext(window, chart, progression, ['month', 'year'].includes(time.displayWindow.periodType));
  if (leo.status === 'ready') {
    const lunarMonthly = time.displayWindow.periodType === 'month';
    const annual = time.displayWindow.periodType === 'year';
    const lunarHouses = buildLeoLunarHouses(window, sourceHouses, leo, annual);
    if (annual) {
      const phases = buildLeoSolarPhases(window, leo.birthAt, leo.natalContext.bodies);
      const policy = { ...leoSolarPhasePolicy, progressionPolicy: leo.policy.timeKey, progressedBody: 'Sun' };
      const lunarPolicy = { ...policy, solarPhaseProfile: policy.profile, profile: leoSolarLunarPhasePolicy,
        lunarProfile: leoLunarConditionPolicy.profile };
      const lunarPhases = buildLeoSolarLunarPhases(phases, [...leo.intervals, ...leo.progressedPairs],
        lunarHouses.status === 'ready' ? lunarHouses.intervals : undefined);
      const witness = writer.raw({ policy, phases, lunarPolicy, lunarPhases });
      for (const { factType, factPolicy, rows } of [
        { factType: 'leo_solar_phase', factPolicy: policy, rows: phases },
        { factType: 'leo_solar_lunar_phase', factPolicy: lunarPolicy, rows: lunarPhases },
      ]) {
        for (const { start, end, formationAt, natalFormationAt, phaseStart, phaseEnd, ...phase } of rows) {
          const jupiterConjunction = phase.natalTargetId === 'Jupiter' && phase.aspectType === 'conjunction';
          const lunarQualification = 'lunarQualification' in phase ? phase.lunarQualification : undefined;
          const strengthenedJupiter = jupiterConjunction && lunarQualification === 'favourable-context'
            && leo.natalJupiterAfflictionContacts.length === 0;
          const neptuneConjunction = factType === 'leo_solar_phase' && phase.natalTargetId === 'Neptune' && phase.aspectType === 'conjunction';
          const solarNeptuneNatalEvidence = neptuneConjunction ? leo.solarNeptuneNatalEvidence : undefined;
          const neptuneTrine = factType === 'leo_solar_lunar_phase' && phase.natalTargetId === 'Neptune' && phase.aspectType === 'trine';
          const natalFinancialContext = neptuneTrine ? leo.natalFinancialContext : undefined;
          const natalNeptuneCreativeTestimonies = neptuneTrine ? leo.natalNeptuneCreativeTestimonies : undefined;
          const natalNeptuneDevotionalContacts = neptuneTrine ? leo.natalNeptuneDevotionalContacts : undefined;
          const natalMercuryVenusArtisticContacts = neptuneTrine ? leo.natalMercuryVenusArtisticContacts : undefined;
          const natalSunNeptuneCreativeContacts = neptuneTrine ? leo.natalSunNeptuneCreativeContacts : undefined;
          writer.add({ start, end }, {
            scope: 'progressed', factType, subjectIds: ['western:candidate:0', 'Sun', phase.natalTargetId],
            parentSignalId: ['leo-solar-phase', phase.targetKind, phase.natalTargetId, phase.aspectType, formationAt].join(':'),
            normalizedPayload: { ...factPolicy, ...phase, observed: true, formationAt: isoUtc(formationAt),
              natalFormationAt: natalFormationAt === undefined ? undefined : isoUtc(natalFormationAt),
              phaseStart: isoUtc(phaseStart), phaseEnd: isoUtc(phaseEnd),
              lunarQualification: strengthenedJupiter ? 'strengthened' : lunarQualification,
              ...solarNeptuneNatalEvidence,
              hasSolarNeptuneExact: neptuneConjunction ? window.start <= formationAt && formationAt < window.end : undefined,
              natalFinancialProfile: natalFinancialContext?.profile,
              natalFinancialState: natalFinancialContext?.natalFinancialState, natalFinancialContext,
              hasNatalFinancialRulerAffliction: natalFinancialContext && natalFinancialContext.rulerAfflictions.length > 0,
              hasNatalSecondRulerTwelfthHouseAffliction: natalFinancialContext
                && natalFinancialContext.secondRulerTwelfthHouseAfflictions.length > 0,
              natalAspectProfile: jupiterConjunction || neptuneTrine || neptuneConjunction ? leo.natalAspectProfile : undefined,
              natalNeptuneCreativeTestimonies,
              hasNatalNeptuneCreativeTestimony: natalNeptuneCreativeTestimonies && natalNeptuneCreativeTestimonies.length > 0,
              natalNeptuneDevotionalContacts,
              hasNatalNeptuneDevotionalContact: natalNeptuneDevotionalContacts && natalNeptuneDevotionalContacts.length > 0,
              natalMercuryVenusArtisticContacts,
              hasNatalMercuryVenusArtisticContact: natalMercuryVenusArtisticContacts && natalMercuryVenusArtisticContacts.length > 0,
              natalSunNeptuneCreativeContacts,
              hasNatalSunNeptuneCreativeContact: natalSunNeptuneCreativeContacts && natalSunNeptuneCreativeContacts.length > 0,
              natalJupiterAfflictionChecked: jupiterConjunction ? true : undefined,
              natalJupiterAfflictionContacts: jupiterConjunction ? leo.natalJupiterAfflictionContacts : undefined },
          }, witness);
        }
        if (!rows.length) writer.add(window, {
          scope: 'progressed', factType, subjectIds: ['western:candidate:0', 'Sun'],
          normalizedPayload: { ...factPolicy, observed: false },
        }, witness);
      }
    }
    const monthlyFrame = lunarMonthly && sourceHouses.placidus?.status === 'ready'
      && sourceHouses.frame?.birthAt === leo.birthAt
      ? { birthAt: leo.birthAt, natal: leo.natalContext, natalCusps: sourceHouses.placidus.cusps,
        annual: leoAnnualHouseFrames(window, sourceHouses.frame) }
      : undefined;
    const source = writer.raw({ policy: leo.policy, calculation: leo });
    const lunarObservation = { profile: leo.policy.lunarExactObservationProfile, progressionPolicy: leo.policy.timeKey,
      zodiac: leo.policy.zodiac, progressedBody: 'Moon', coordinate: 'ecliptic_longitude' };
    const mutualObservation = { profile: leo.policy.mutualExactObservationProfile, progressionPolicy: leo.policy.timeKey,
      zodiac: leo.policy.zodiac, coordinate: 'ecliptic_longitude', targetKind: 'natal' };
    let lunarExactObserved = false;
    let mutualExactObserved = false;
    writer.add(window, { scope: 'natal', factType: 'leo_natal_context', subjectIds: ['western:candidate:0'],
      normalizedPayload: leo.natalContext }, source);
    for (const [index, band] of [...leo.intervals, ...leo.progressedPairs].entries()) {
      const { start: _start, end: _end, exactTimes: _times, sourceBandStart, ...payload } = band;
      const parentSignalId = ['leo-source', band.targetKind, band.progressedBody, band.natalTargetId, band.aspectType, sourceBandStart ?? band.start].join(':');
      const subjects = ['western:candidate:0', band.progressedBody, band.natalTargetId];
      const creativeAspectHasExact = band.natalNeptuneCreativeTestimonies && band.exactTimes.length > 0;
      const marsNeptuneConjunction = band.targetKind === 'natal' && band.progressedBody === 'Mars'
        && band.natalTargetId === 'Neptune' && band.aspectType === 'conjunction';
      const venusNeptuneSemisextile = band.targetKind === 'natal' && band.progressedBody === 'Venus'
        && band.natalTargetId === 'Neptune' && band.aspectType === 'semisextile';
      const aspectFact = { scope: 'progressed' as const, factType: 'leo_progressed_aspect', subjectIds: subjects, parentSignalId,
        normalizedPayload: { ...payload, sourceBandIndex: index,
          hasMarsNeptuneConjunctionExact: band.progressedBody === 'Mars' ? creativeAspectHasExact : undefined,
          hasMercuryNeptuneSextileExact: band.progressedBody === 'Mercury' && band.aspectType === 'sextile'
            ? creativeAspectHasExact : undefined,
          hasVenusNeptuneSemisextileExact: venusNeptuneSemisextile ? band.exactTimes.length > 0 : undefined } };
      writer.add(band, aspectFact, source);
      for (const at of band.exactTimes) {
        const epoch = Math.round(progressionEpoch(leo.birthAt, at));
        const isParallel = band.coordinate === 'equatorial_declination_of_date';
        const position = readLeoMovingPosition(band.progressedBody, epoch);
        const target = band.targetKind === 'progressed' ? readLeoMovingPosition(band.natalTargetId, epoch) : undefined;
        const angle = progressedAspects.find(aspect => aspect.type === band.aspectType)?.angle;
        const targetLongitude = target?.longitude ?? band.natalLongitude;
        const targetDeclination = target?.declination ?? band.natalDeclination;
        const separation = isParallel ? leoParallelDifference(position.declination, targetDeclination!)
          : Math.abs(angleDistance(position.longitude, targetLongitude!) - angle!);
        writer.add(band, { scope: 'progressed', factType: 'leo_progressed_aspect_exact', subjectIds: subjects, parentSignalId,
          exactInstant: isoUtc(at), timePrecision: 'second', normalizedPayload: { ...payload, sourceBandIndex: index,
            progressedLongitude: isParallel ? undefined : position.longitude,
            progressedBodySign: band.progressedBodySign === undefined ? undefined : Math.floor(position.longitude / 30),
            progressedDeclination: isParallel ? position.declination : undefined,
            targetLongitude: isParallel ? undefined : target?.longitude,
            targetDeclination: isParallel ? target?.declination : undefined,
            separation } }, source);
        if (annual && marsNeptuneConjunction && targetLongitude !== undefined && separation <= 0.00001
          && Math.floor(position.longitude / 30) === Math.floor(targetLongitude / 30) && band.start <= at && at < band.end) {
          // Leo and Green, pp.28–29: a majority of the natal planets in one element.
          const natalBodies = leo.natalContext.bodies;
          const natalElementMajority = (['fire', 'earth', 'air', 'water'] as const).map((element, index) => ({
            element, totalBodies: natalBodies.length,
            bodies: natalBodies.filter(({ sign }) => sign % 4 === index).map(({ body }) => body),
          })).find(({ bodies, totalBodies }) => bodies.length > totalBodies / 2);
          writer.add({ start: at, end: Math.min(at + 1000, band.end) }, { ...aspectFact,
            exactInstant: isoUtc(at), timePrecision: 'second', normalizedPayload: { ...aspectFact.normalizedPayload,
              isMarsNeptuneConjunctionPoint: true, conjunctionSign: Math.floor(targetLongitude / 30),
              natalMarsNeptuneElementMajority: natalElementMajority?.element ?? 'none',
              natalMarsNeptuneElementMajorityWitness: natalElementMajority } }, source);
        }
        if (lunarMonthly && band.progressedBody === 'Moon' && !isParallel) {
          lunarExactObserved = true;
          writer.add({ start: at, end: Math.min(at + 1000, window.end) }, {
            scope: 'progressed', factType: 'leo_lunar_exact_observation', subjectIds: subjects, parentSignalId,
            exactInstant: isoUtc(at), timePrecision: 'second',
            normalizedPayload: { ...lunarObservation, observed: true, natalTargetId: band.natalTargetId,
              targetKind: band.targetKind, aspectType: band.aspectType,
              progressedLongitude: position.longitude, targetLongitude,
              natalAspectProfile: band.lunarNeptuneTestimonies && band.natalAspectProfile,
              lunarNeptuneTestimonies: band.lunarNeptuneTestimonies,
              hasLunarNeptuneTestimony: band.lunarNeptuneTestimonies && band.lunarNeptuneTestimonies.length > 0,
              lunarNeptuneDevotionalContacts: band.lunarNeptuneDevotionalContacts,
              hasLunarNeptuneDevotionalContact: band.lunarNeptuneDevotionalContacts && band.lunarNeptuneDevotionalContacts.length > 0,
              natalSunNeptuneCreativeContacts: band.natalSunNeptuneCreativeContacts,
              hasNatalSunNeptuneCreativeContact: band.natalSunNeptuneCreativeContacts && band.natalSunNeptuneCreativeContacts.length > 0,
              natalTargetHouse: band.natalTargetId === 'Neptune' && band.aspectType === 'quincunx'
                ? band.natalTargetHouse : undefined,
              natalNeptuneApproachingAscendant: band.natalNeptuneApproachingAscendant,
              natalNeptuneAscendantApproach: band.natalNeptuneAscendantApproach,
              natalSquareOppositionBodies: band.lunarNeptuneTestimonies && band.aspectType === 'sesquiquadrate'
                ? band.natalSquareOppositionBodies : undefined,
              appendixDate: readLeoAppendixDate(leo.birthAt, epoch) },
          }, source);
        }
        if (annual && !isParallel && band.targetKind === 'natal' && band.progressedBody !== 'Moon' && band.progressedBody !== 'Sun') {
          const mercuryNeptuneSextile = band.progressedBody === 'Mercury' && band.natalTargetId === 'Neptune' && band.aspectType === 'sextile';
          const mercuryNeptuneTrine = band.progressedBody === 'Mercury' && band.natalTargetId === 'Neptune' && band.aspectType === 'trine';
          const hasMercuryNeptuneArtisticBasis = band.hasNatalNeptuneCreativeTestimony || band.hasNatalMercuryVenusArtisticContact
            || band.natalTargetHouse === 1 || band.natalTargetHouse === 3;
          const marsNeptuneSemisquare = band.progressedBody === 'Mars' && band.natalTargetId === 'Neptune'
            && band.aspectType === 'semisquare';
          const natalAfflictedBodies = mercuryNeptuneTrine ? band.natalAfflictedBodies : undefined;
          const natalAfflictionsChecked = Array.isArray(natalAfflictedBodies) ? true : undefined;
          const natalPairAspects = marsNeptuneSemisquare || venusNeptuneSemisextile ? band.natalPairAspects : undefined;
          const natalPairAspectTypes = natalPairAspects && band.natalPairAspectTypes;
          const natalPairAspectsChecked = Array.isArray(natalPairAspects) ? true : undefined;
          const natalPairHarmonious = marsNeptuneSemisquare
            ? natalPairAspects?.some(({ aspect }) => ['semisextile', 'sextile', 'trine'].includes(aspect)) : undefined;
          mutualExactObserved = true;
          writer.add({ start: at, end: Math.min(at + 1000, window.end) }, {
            scope: 'progressed', factType: 'leo_mutual_exact_observation', subjectIds: subjects, parentSignalId,
            exactInstant: isoUtc(at), timePrecision: 'second',
            normalizedPayload: { ...mutualObservation, observed: true, progressedBody: band.progressedBody,
              natalTargetId: band.natalTargetId, aspectType: band.aspectType,
              progressedLongitude: position.longitude, targetLongitude,
              natalAspectProfile: mercuryNeptuneSextile || band.natalMercuryNeptuneTestimonies || natalAfflictionsChecked || natalPairAspectsChecked
                ? band.natalAspectProfile : undefined,
              natalMercuryNeptuneTestimonies: band.natalMercuryNeptuneTestimonies,
              hasNatalMercuryNeptuneTestimony: band.hasNatalMercuryNeptuneTestimony,
              natalMercuryContactBodies: band.natalMercuryContactBodies,
              hasSoleNatalMercuryNeptuneContact: band.hasSoleNatalMercuryNeptuneContact,
              natalAfflictionsChecked, natalAfflictedBodies, natalPairAspectsChecked, natalPairAspectTypes,
              natalPairHarmonious, natalPairAspects, natalVenusNeptuneAfflictionState: band.natalVenusNeptuneAfflictionState,
              natalVenusNeptuneVariableContact: band.natalVenusNeptuneVariableContact,
              natalVenusNeptuneLiteraryConjunction: band.natalVenusNeptuneLiteraryConjunction,
              mercuryNeptuneArtisticBasis: mercuryNeptuneSextile ? hasMercuryNeptuneArtisticBasis ? 'qualified' : 'unreviewed' : undefined,
              hasMercuryNeptuneDevotionalBasis: mercuryNeptuneSextile
                ? Boolean(band.natalNeptuneArtContacts?.some(row => row.other === 'Jupiter')) : undefined,
              natalTargetHouse: venusNeptuneSemisextile || mercuryNeptuneSextile ? band.natalTargetHouse : undefined },
          }, source);
        }
      }
    }
    if (lunarMonthly && !lunarExactObserved) writer.add(window, {
      scope: 'progressed', factType: 'leo_lunar_exact_observation', subjectIds: ['western:candidate:0', 'Moon'],
      normalizedPayload: { ...lunarObservation, observed: false },
    }, source);
    if (annual && !mutualExactObserved) writer.add(window, {
      scope: 'progressed', factType: 'leo_mutual_exact_observation', subjectIds: ['western:candidate:0'],
      normalizedPayload: { ...mutualObservation, observed: false },
    }, source);
    for (const link of leo.lunarContacts) writer.add(link, { scope: 'progressed', factType: 'leo_lunar_contact',
      subjectIds: ['western:candidate:0', link.progressedBody, link.natalTargetId, link.lunarTargetId],
      normalizedPayload: { ...link, profile: leo.policy.profile, lunarExactTimes: link.lunarExactTimes.map(isoUtc) } }, source);
    const lunarHouseRaw = lunarHouses.status === 'ready'
      ? writer.raw({ policy: lunarHouses.policy, calculation: lunarHouses }) : undefined;
    if (['month', 'year'].includes(time.displayWindow.periodType)) {
      for (const { start, end, base, contacts, natalState, progressedState, sameLayerLunarState, hasCleanLunarJupiterSupport,
        hasMarsSaturnReviewedMixedOrFavourableMoon, hasMarsSaturnTrineAtParallel,
        hasMarsSaturnAdverseLunarActivation, exactCleanMarsSaturnAdverseMoon, hasExactCleanMarsSaturnAdverseMoon,
        exactCleanMarsJupiterOtherAdverseMoon, hasExactCleanMarsJupiterOtherAdverseMoon,
        exactCleanNeptuneLunarSesquiquadrate, hasExactCleanNeptuneLunarSesquiquadrate,
        exactCleanNeptuneLunarSemisquare, hasExactCleanNeptuneLunarSemisquare,
        marsJupiterAdverseLunarParallelContacts, hasMarsJupiterAdverseLunarParallelActivation,
        hasMarsSaturnAdverseLunarParallelActivation, marsSaturnAdverseLunarParallelContacts,
        hasOtherSameLayerLunarContacts, monthlyThemeEvidence, monthlyLunarQualification,
        lunarFavourableTargets, lunarAdverseTargets, lunarLinkedBodies, exactLunarLinkedBodies, exactSolarLinkedBodies,
        exactSolarEndpointContacts, luminaryLinks, luminaryLinkedBodies,
        exactUranianSensitivityDirection, concurrentUranianSensitivityDirection, hasConcurrentUranianSensitivityDirection,
        venusNeptuneSensitivityDirection, hasExactVenusNeptuneSensitivityDirection, hasUranianMoonSolarActivation,
        progressedVenusNeptuneSensitivityDirection, hasExactProgressedVenusNeptuneSensitivityDirection,
        moonNeptuneSensitivityDirection, hasExactMoonNeptuneSensitivityDirection,
        hasVenusUranusParallelAtFormation,
        uranianLunarParallelActivation, hasUranianLunarParallelActivation,
        venusLunarParallelActivation, hasVenusLunarParallelActivation,
        favourableNatalNeptuneLunarContacts, hasFavourableNatalNeptuneLunarContact, mercuryNeptuneLunarSupportState,
        adverseSequence, hasSameLayerAdverseSequence, hasFavourableLunarLink, directionSupportState, supportingDirections,
        mutualSupportReviewProfile, unreviewedMutualMajorDirections, hasUnreviewedMutualMajorDirection, venusJupiterLunarLinkState,
        venusJupiterEffectState, venusJupiterSupportScope,
        speculationDirections, speculationLunarState, speculationMajorState, speculationDirectionState, travelDirections, travelDirectionState,
        correspondenceDirections, correspondenceDirectionState, friendshipDirections, friendshipDirectionState,
        studyDirections, studyDirectionState, disputeDirections, disputeDirectionState,
        metaphysicalDirections, metaphysicalDirectionState, sunUranusParallelBackgroundOnly,
        uranianMetaphysicalMinorMoonDirection, hasExactUranianMetaphysicalMinorMoonDirection,
        uranianMetaphysicalMutualDirections, hasUranianMetaphysicalMutualDirection,
        uranianMetaphysicalSolarDirection, hasExactUranianMetaphysicalSolarDirection,
        uranianMetaphysicalSolarLunarDirection, hasUranianMetaphysicalSolarLunarWitness,
        uranianMetaphysicalMercuryDirection, hasExactUranianMetaphysicalMercuryDirection,
        uranianMetaphysicalMoonDirection, hasExactUranianMetaphysicalMoonDirection,
        hasVerifiedUranianMetaphysicalMoonHouse, uranianMetaphysicalMoonHouse, uranianMetaphysicalMoonHouseProfile,
        uranianMetaphysicalMoonConjunction, hasExactUranianMetaphysicalMoonConjunction,
        uranianMetaphysicalMercuryLunarDirection, hasUranianMetaphysicalMercuryLunarWitness,
        uranianMetaphysicalVenusDirection, hasExactUranianMetaphysicalVenusDirection,
        exactAdverseMoonToNatalEndpoint, hasExactAdverseMoonToNatalEndpoint,
        exactAdverseMoonToProgressedEndpoint, hasExactAdverseMoonToProgressedEndpoint,
        hasCleanAdverseMoonNeptuneActivation,
        exactFavourableMoonToNatalEndpoint, hasExactFavourableMoonToNatalEndpoint,
        exactFavourableMoonToProgressedEndpoint, hasExactFavourableMoonToProgressedEndpoint,
        relocationDirections, relocationDirectionState,
        crossChartSupportState, crossChartDirections,
        hasOtherSameLayerDirection, otherDirection, hasAdverseSolarDirection, concurrentSolarJupiterSquare,
        sameLayerSolarDirectionState, lunarBridge, hasLunarBridge,
        progressedSolarContacts, hasProgressedSolarContact, progressedSolarDignity, contraryScope, contraryDirections,
        unreviewedContraryDirections, contraryReviewState, contraryDecisionReady, hasReviewedContraryDirection, exactNeptuneLunarContrary,
        natalOtherPlanetPairScope,
        progressedOtherPlanetPairScope, progressedOtherPlanetContraryReviewState, progressedOtherPlanetContraryDirections, progressedOtherPlanetUnreviewedDirections }
        of buildLeoLunarConditions([...leo.intervals, ...leo.progressedPairs], leo.progressedSolarDignities,
          leo.natalBridgeBands, leo.progressedPairs, leo.slowContraryPairs, leo.additionalNatalContraryPairs,
          lunarHouses.status === 'ready' ? lunarHouses.studyBands : undefined)) {
        const { progressedBody, natalTargetId, aspectType, profile, kind, zodiac, targetKind, progressionPolicy,
          coordinate, parallelComparison, allowedOrb, pairRulershipProfile, natalAspectProfile, natalPairAspects,
          natalPairAspectTypes, natalSquareOppositionBodies, natalSextileTrineBodies, natalMajorAspectContacts,
          mercuryNeptuneOffset, mercuryBehindNeptune, natalNeptuneElevation, natalNeptuneClosestToMidheaven,
          natalNeptuneBeforeAngularCusp, natalNeptuneSoleLuminaryContacts, hasNatalNeptuneSoleLuminaryContact,
          natalMercuryDomicileAngular, natalMarsJupiterProminence, natalMutualDomicileExchange, natalMutualDomicileSigns } = base;
        const isSolarJupiterConjunction = progressedBody === 'Sun' && natalTargetId === 'Jupiter' && aspectType === 'conjunction';
        const marsJupiterSquare = progressedBody === 'Mars' && natalTargetId === 'Jupiter'
          && aspectType === 'square' && targetKind === 'natal';
        const isMarsUranusSextile = progressedBody === 'Mars' && natalTargetId === 'Uranus' && aspectType === 'sextile';
        const lunarJupiterParallel = progressedBody === 'Moon' && natalTargetId === 'Jupiter' && aspectType === 'parallel';
        const lunarSolarQuincunx = lunarMonthly && progressedBody === 'Moon' && natalTargetId === 'Sun'
          && aspectType === 'quincunx' && targetKind === 'natal';
        const mercuryJupiterExact = annual && progressedBody === 'Mercury' && natalTargetId === 'Jupiter'
          && (aspectType === 'semisextile' || aspectType === 'quincunx') && targetKind === 'natal';
        const mercuryNeptuneSemisextile = annual && progressedBody === 'Mercury' && natalTargetId === 'Neptune'
          && aspectType === 'semisextile' && targetKind === 'natal';
        const mercuryUranusQuincunx = annual && progressedBody === 'Mercury' && natalTargetId === 'Uranus'
          && aspectType === 'quincunx' && targetKind === 'natal';
        const marsJupiterExact = annual && progressedBody === 'Mars' && natalTargetId === 'Jupiter'
          && (aspectType === 'quincunx' || aspectType === 'square' && targetKind === 'natal');
        const marsSaturnSemisquare = annual && progressedBody === 'Mars' && natalTargetId === 'Saturn'
          && aspectType === 'semisquare' && targetKind === 'natal';
        const marsSaturnTrine = annual && progressedBody === 'Mars' && natalTargetId === 'Saturn'
          && aspectType === 'trine' && targetKind === 'natal';
        const venusJupiterConjunction = annual && progressedBody === 'Venus' && natalTargetId === 'Jupiter'
          && aspectType === 'conjunction' && targetKind === 'natal';
        const venusNeptuneExact = annual && progressedBody === 'Venus' && natalTargetId === 'Neptune'
          && (aspectType === 'sextile' || aspectType === 'trine') && targetKind === 'natal';
        const venusUranusExact = annual && progressedBody === 'Venus' && natalTargetId === 'Uranus'
          && aspectType === 'quincunx';
        const mutualExactChecked = mercuryJupiterExact || mercuryNeptuneSemisextile || mercuryUranusQuincunx
          || marsJupiterExact || marsSaturnSemisquare || marsSaturnTrine || venusJupiterConjunction || venusNeptuneExact || venusUranusExact;
        const exactInSlice = (lunarSolarQuincunx || mutualExactChecked) && base.exactTimes.some(at => start <= at && at < end);
        const pairLuminaryLinksComplete = marsSaturnSemisquare && luminaryLinks
          ? luminaryLinks.some(link => link.body === 'Sun') && luminaryLinks.some(link => link.body === 'Moon')
          : undefined;
        const natalFinancialContext = lunarJupiterParallel
          || progressedBody === 'Sun' && natalTargetId === 'Neptune' && ['sextile', 'trine'].includes(aspectType)
          ? leo.natalFinancialContext : undefined;
        const natalSolarContacts = progressedSolarContacts && leo.natalSolarContacts;
        const natalSolarDignity = progressedSolarContacts && leo.natalSolarDignity;
        const exactFrameEvidence = monthlyThemeEvidence && monthlyFrame
          && readLeoMonthlyLunarFrame(base, monthlyThemeEvidence.lunarExactTimes, monthlyFrame);
        const moonSampleAt = Math.floor(start + (end - start) / 2);
        const moonPosition = progressedBody === 'Sun' && natalTargetId === 'Moon' && aspectType === 'quincunx'
          ? { targetKind, longitude: targetKind === 'progressed'
            ? readLeoMovingPosition('Moon', Math.round(progressionEpoch(leo.birthAt, moonSampleAt))).longitude
            : base.natalLongitude,
          sampleAt: targetKind === 'progressed' ? isoUtc(moonSampleAt) : undefined }
          : undefined;
        writer.add({ start, end }, { scope: 'progressed', factType: 'leo_lunar_condition',
          subjectIds: ['western:candidate:0', progressedBody, natalTargetId],
          parentSignalId: ['leo-source', targetKind, progressedBody, natalTargetId, aspectType, base.sourceBandStart ?? base.start].join(':'),
          normalizedPayload: { profile, kind, zodiac, targetKind, progressionPolicy, progressedBody, natalTargetId,
            aspectType, coordinate, parallelComparison, allowedOrb, pairRulershipProfile, natalAspectProfile, natalPairAspects, natalPairAspectTypes,
            natalAbilityContacts: base.natalAbilityContacts, natalAbilityTypes: base.natalAbilityTypes,
            natalMercuryImpulsivenessContacts: base.natalMercuryImpulsivenessContacts,
            hasNatalMercuryImpulsivenessTestimony: base.hasNatalMercuryImpulsivenessTestimony,
            natalMercuryBroadStudyContacts: base.natalMercuryBroadStudyContacts,
            hasNatalMercuryBroadStudyTestimony: base.hasNatalMercuryBroadStudyTestimony,
            natalMoonJupiterPromise: base.natalMoonJupiterPromise, hasNatalMoonJupiterPromise: base.hasNatalMoonJupiterPromise,
            hasCleanLunarJupiterSupport,
            natalMarsJupiterProminence, natalMarsJupiterProminentBody: natalMarsJupiterProminence?.candidate,
            natalMarsJupiterDominantBody: natalMarsJupiterProminence && (natalMarsJupiterProminence.dominant?.body ?? 'unselected'),
            natalMarsJupiterSquareRepeated: marsJupiterSquare ? natalPairAspects.some(row => row.aspect === 'square') : undefined,
            natalMutualDomicileExchange, natalMutualDomicileSigns,
            marsSaturnParallelBandObserved: base.marsSaturnParallelBandObserved, marsSaturnNatalBalanceBasis: base.marsSaturnNatalBalanceBasis,
            hasMarsSaturnReviewedMixedOrFavourableMoon, hasMarsSaturnTrineAtParallel,
            hasMarsSaturnAdverseLunarActivation,
            exactCleanMarsSaturnAdverseMoon, hasExactCleanMarsSaturnAdverseMoon,
            exactCleanMarsJupiterOtherAdverseMoon, hasExactCleanMarsJupiterOtherAdverseMoon,
            exactCleanNeptuneLunarSesquiquadrate, hasExactCleanNeptuneLunarSesquiquadrate,
            exactCleanNeptuneLunarSemisquare, hasExactCleanNeptuneLunarSemisquare,
            marsJupiterAdverseLunarParallelContacts, hasMarsJupiterAdverseLunarParallelActivation,
            hasMarsSaturnAdverseLunarParallelActivation, marsSaturnAdverseLunarParallelContacts,
            lunarProfile: leoLunarConditionPolicy.profile, natalState, progressedState, sameLayerLunarState,
            mutualExactInSlice: mutualExactChecked ? exactInSlice : undefined,
            pairLuminaryLinksComplete,
            monthlyLunarProfile: monthlyThemeEvidence && leoLunarConditionPolicy.monthlyTheme,
            monthlyLunarHasExact: lunarSolarQuincunx ? exactInSlice : monthlyThemeEvidence?.hasExact,
            monthlyLunarMajorState: monthlyThemeEvidence?.majorState,
            monthlyLunarHasUnopposedMajorSupport: monthlyThemeEvidence?.hasUnopposedMajorSupport,
            monthlyLunarQualification: lunarMonthly ? monthlyLunarQualification : undefined,
            monthlyLunarHasExactInOwnFrame: exactFrameEvidence?.length ? true
              : exactFrameEvidence && !monthlyThemeEvidence?.hasExact ? false : undefined,
            monthlyLunarFrameProfile: monthlyFrame && monthlyThemeEvidence && leoLunarHousePolicy.monthlyAspectFrame,
            monthlyThemeEvidence: monthlyThemeEvidence && {
              ...monthlyThemeEvidence, lunarExactTimes: monthlyThemeEvidence.lunarExactTimes.map(isoUtc),
              exactFrames: exactFrameEvidence?.map(({ exactAt, annualStart, annualEnd, ...frame }) => ({
                ...frame, exactAt: isoUtc(exactAt), annualStart: annualStart === undefined ? undefined : isoUtc(annualStart),
                annualEnd: annualEnd === undefined ? undefined : isoUtc(annualEnd),
              })),
            },
            mercuryNeptuneOffset, mercuryBehindNeptune,
            mercuryNeptuneNatalSensitivityState: base.mercuryNeptuneNatalSensitivityState, mercuryNeptuneLunarSupportState,
            natalTargetHouse: mercuryNeptuneOffset === undefined ? undefined : base.natalTargetHouse,
            natalBodyHouse: mercuryNeptuneOffset === undefined ? undefined : base.natalBodyHouse,
            natalBodySign: mercuryNeptuneOffset === undefined ? undefined : base.natalBodySign,
            natalNeptuneElevation: mercuryNeptuneOffset === undefined ? undefined : natalNeptuneElevation,
            natalNeptuneClosestToMidheaven: mercuryNeptuneOffset === undefined ? undefined : natalNeptuneClosestToMidheaven,
            natalNeptuneBeforeAngularCusp: mercuryNeptuneOffset === undefined ? undefined : natalNeptuneBeforeAngularCusp,
            natalNeptuneSoleLuminaryContacts: mercuryNeptuneOffset === undefined ? undefined : natalNeptuneSoleLuminaryContacts,
            hasNatalNeptuneSoleLuminaryContact: mercuryNeptuneOffset === undefined ? undefined : hasNatalNeptuneSoleLuminaryContact,
            natalNeptuneClosestComparableLuminaryContacts: mercuryNeptuneOffset === undefined
              ? undefined : base.natalNeptuneClosestComparableLuminaryContacts,
            natalMercuryDomicileAngular,
            natalMercuryAngularDominance: base.natalMercuryAngularDominance,
            natalMercuryDominantAngular: base.natalMercuryDominantAngular,
            favourableNatalNeptuneLunarContacts, hasFavourableNatalNeptuneLunarContact,
            natalAfflictedBodies: isSolarJupiterConjunction ? base.natalAfflictedBodies : undefined,
            natalAfflictionContacts: isSolarJupiterConjunction ? base.natalAfflictionContacts : undefined,
            natalFavourableBodies: isMarsUranusSextile ? base.natalFavourableBodies : undefined,
            natalFavourableContacts: isMarsUranusSextile ? base.natalFavourableContacts : undefined,
            natalFinancialProfile: natalFinancialContext?.profile,
            natalFinancialState: natalFinancialContext?.natalFinancialState, natalFinancialContext,
            hasNatalFinancialRulerAffliction: natalFinancialContext && natalFinancialContext.rulerAfflictions.length > 0,
            hasOtherSameLayerLunarContacts, moonPosition, moonPositionReady: moonPosition && Number.isFinite(moonPosition.longitude),
            lunarFavourableTargets, lunarAdverseTargets, lunarLinkedBodies, exactLunarLinkedBodies, exactSolarLinkedBodies,
            exactSolarEndpointContacts,
            exactUranianSensitivityDirection, concurrentUranianSensitivityDirection, hasConcurrentUranianSensitivityDirection,
            venusNeptuneSensitivityDirection, hasExactVenusNeptuneSensitivityDirection, hasUranianMoonSolarActivation,
            progressedVenusNeptuneSensitivityDirection, hasExactProgressedVenusNeptuneSensitivityDirection,
            moonNeptuneSensitivityDirection, hasExactMoonNeptuneSensitivityDirection,
            hasVenusUranusParallelAtFormation,
            uranianLunarParallelActivation, hasUranianLunarParallelActivation,
            venusLunarParallelActivation, hasVenusLunarParallelActivation,
            luminaryLinks, luminaryLinkedBodies, natalSquareOppositionBodies,
            hasSameLayerFavourableContact: lunarFavourableTargets.length > 0,
            hasSameLayerAdverseContact: lunarAdverseTargets.length > 0,
            hasSameLayerAdverseSequence, hasFavourableLunarLink, directionSupportState, supportingDirections, lunarBridge, hasLunarBridge,
            mutualSupportReviewProfile, unreviewedMutualMajorDirections, hasUnreviewedMutualMajorDirection, venusJupiterLunarLinkState,
            venusJupiterEffectState, venusJupiterSupportScope,
            speculationDirections, speculationLunarState, speculationMajorState, speculationDirectionState, travelDirections, travelDirectionState,
            correspondenceDirections, correspondenceDirectionState, friendshipDirections, friendshipDirectionState,
            uranianMetaphysicalMinorMoonDirection, hasExactUranianMetaphysicalMinorMoonDirection,
            studyDirections, studyDirectionState, disputeDirections, disputeDirectionState,
            metaphysicalDirections, metaphysicalDirectionState, sunUranusParallelBackgroundOnly,
            uranianMetaphysicalMutualDirections, hasUranianMetaphysicalMutualDirection,
            uranianMetaphysicalSolarDirection, hasExactUranianMetaphysicalSolarDirection,
            uranianMetaphysicalSolarLunarDirection, hasUranianMetaphysicalSolarLunarWitness,
            uranianMetaphysicalSolarPassage: uranianMetaphysicalSolarDirection?.passage,
            uranianMetaphysicalMercuryDirection, hasExactUranianMetaphysicalMercuryDirection,
            uranianMetaphysicalMoonDirection, hasExactUranianMetaphysicalMoonDirection,
            hasVerifiedUranianMetaphysicalMoonHouse, uranianMetaphysicalMoonHouse, uranianMetaphysicalMoonHouseProfile,
            uranianMetaphysicalMoonConjunction, hasExactUranianMetaphysicalMoonConjunction,
            uranianMetaphysicalMercuryLunarDirection, hasUranianMetaphysicalMercuryLunarWitness,
            uranianMetaphysicalVenusDirection, hasExactUranianMetaphysicalVenusDirection,
            exactAdverseMoonToNatalEndpoint, hasExactAdverseMoonToNatalEndpoint,
            exactAdverseMoonToProgressedEndpoint, hasExactAdverseMoonToProgressedEndpoint,
            hasCleanAdverseMoonNeptuneActivation,
            exactFavourableMoonToNatalEndpoint, hasExactFavourableMoonToNatalEndpoint,
            exactFavourableMoonToProgressedEndpoint, hasExactFavourableMoonToProgressedEndpoint,
            relocationDirections, relocationDirectionState,
            crossChartProfile: crossChartDirections && leoLunarConditionPolicy.crossChart, crossChartSupportState, crossChartDirections,
            hasOtherSameLayerDirection, otherDirection, hasAdverseSolarDirection, concurrentSolarJupiterSquare, sameLayerSolarDirectionState,
            contraryScope, contraryDirections, unreviewedContraryDirections, contraryReviewState, contraryDecisionReady, hasReviewedContraryDirection,
            exactNeptuneLunarContrary, natalOtherPlanetPairScope,
            progressedOtherPlanetPairScope, progressedOtherPlanetContraryReviewState, progressedOtherPlanetContraryDirections, progressedOtherPlanetUnreviewedDirections,
            progressedSolarContacts, hasProgressedSolarContact, progressedSolarDignity, natalSolarContacts, natalSolarDignity,
            hasNatalSolarTestimony: natalSolarContacts && (natalSolarContacts.length > 0 || Boolean(natalSolarDignity)),
            hasProgressedSolarTestimony: progressedSolarContacts && (Boolean(hasProgressedSolarContact) || Boolean(progressedSolarDignity)),
            natalSextileTrineBodies: isMarsUranusSextile ? natalSextileTrineBodies : undefined,
            adverseSequence: adverseSequence && {
              first: { ...adverseSequence.first, start: isoUtc(adverseSequence.first.start) },
              second: { ...adverseSequence.second, start: isoUtc(adverseSequence.second.start) },
              end: isoUtc(adverseSequence.end),
            },
            natalMajorAspectContacts: isSolarJupiterConjunction || isMarsUranusSextile ? natalMajorAspectContacts : undefined,
            contacts: contacts.map(({ exactTimes, ...contact }) => ({ ...contact, exactTimes: exactTimes.map(isoUtc) })),
          },
        }, source, ...(uranianMetaphysicalMoonHouse && lunarHouseRaw ? [lunarHouseRaw] : []));
      }
    }
    const ascendantContext = buildLeoAscendantContext(window, sourceHouses, leo);
    if (ascendantContext.status === 'ready') {
      const raw = writer.raw({ policy: ascendantContext.policy, calculation: ascendantContext });
      const houseSources = writer.facts.filter(fact => fact.factType === 'natal_house_cusps'
        && (fact.normalizedPayload as { houseSystem?: string }).houseSystem === 'placidus').flatMap(fact => fact.sourceFactIds);
      for (const { start, end, ...payload } of ascendantContext.intervals) writer.add({ start, end }, {
        scope: 'progressed', factType: 'leo_ascendant_context', subjectIds: ['western:candidate:0', 'ASC'],
        normalizedPayload: { ...payload, longitudeSampleAt: isoUtc(payload.longitudeSampleAt),
          directions: payload.directions.map(({ exactTimes, ...entry }) => ({ ...entry, exactTimes: exactTimes.map(isoUtc) })) },
      }, raw, source, ...new Set(houseSources));
    }
    if (lunarHouses.status === 'ready' && lunarHouseRaw) {
      const houseSources = writer.facts.filter(fact => fact.factType === 'natal_house_cusps'
        && (fact.normalizedPayload as { houseSystem?: string }).houseSystem === 'placidus').flatMap(fact => fact.sourceFactIds);
      for (const { start, end, annual, ...payload } of lunarHouses.ascendantCrossings) writer.add({ start, end }, {
        scope: 'progressed', factType: 'leo_lunar_ascendant_crossing',
        subjectIds: ['western:candidate:0', 'Moon', 'ASC', payload.targetKind],
        exactInstant: isoUtc(start), timePrecision: 'second',
        normalizedPayload: { ...payload, progressionPolicy: progressionPolicy.version,
          annualFrameStart: annual && isoUtc(annual.annualStart), annualFrameEnd: annual && isoUtc(annual.annualEnd) },
      }, lunarHouseRaw, source, ...new Set(houseSources));
      for (const band of lunarHouses.intervals) {
        const { start, end, annual, ...payload } = band;
        const contacts = (entries: typeof band.lunarAspects) => entries.map(({ exactTimes, ...entry }) => ({ ...entry, exactTimes: exactTimes.map(isoUtc) }));
        writer.add({ start, end }, { scope: 'progressed', factType: 'leo_lunar_house_context',
          subjectIds: ['western:candidate:0', 'Moon', band.targetKind, 'house:' + band.house],
          normalizedPayload: { ...payload, progressionPolicy: progressionPolicy.version,
            annualFrameStart: annual && isoUtc(annual.annualStart), annualFrameEnd: annual && isoUtc(annual.annualEnd),
            ninthRulers: band.ninthRulers && { ...band.ninthRulers,
              annualStart: isoUtc(band.ninthRulers.annualStart), annualEnd: isoUtc(band.ninthRulers.annualEnd) },
            lunarAspects: contacts(band.lunarAspects), solarAspects: contacts(band.solarAspects), mutualAspects: contacts(band.mutualAspects) },
        }, lunarHouseRaw, source, ...new Set(houseSources));
      }
    }
    const period = time.displayWindow.periodType;
    if (period !== 'month' && (sourceHouses.status === 'ready' || sourceHouses.status === 'partial')
      && sourceHouses.frame.birthAt === leo.birthAt) {
      const natal = buildLeoTransitNatal(leo.natalContext, sourceHouses);
      if (natal) {
        const profile = leoNatalTransitPolicy.profile;
        const raw = writer.raw({ policy: leoNatalTransitPolicy, natal, cusps: sourceHouses.placidus });
        if (period === 'day' || period === 'week') for (const link of leoSolarNatalContacts(natal, writer.facts)) {
          writer.add(link, { scope: 'transit', factType: 'leo_solar_natal_contact', subjectIds: link.fact.subjectIds,
            exactInstant: link.at, timePrecision: 'second', parentSignalId: link.fact.parentSignalId,
            normalizedPayload: { profile, zodiac: 'tropical', ...link.payload },
          }, raw, source, ...link.fact.sourceFactIds);
        }
        if (period === 'year') for (const interval of buildLeoSecondHouseContexts(natal, sourceHouses, leo.intervals, writer.facts)) {
          const { start, end, repeatingDirections, financialDirections, targetCrossings, ...fields } = interval;
          const serializeDirections = <T extends { exactTimes: number[] }>(directions: T[]) =>
            directions.map(({ exactTimes, ...direction }) => ({ ...direction, exactTimes: exactTimes.map(isoUtc) }));
          writer.add({ start, end }, {
            scope: 'transit', factType: 'leo_second_house_transit_context', subjectIds: ['western:candidate:0', interval.transitBody, 'house:2'],
            normalizedPayload: { profile, zodiac: 'tropical', natalHouse: 2, ...fields,
              financialTestimonyProfile: leoNatalTransitPolicy.financialTestimony,
              financialDirectionProfile: leoNatalTransitPolicy.financialDirectionProfile,
              financeBasis: natal.financeBasis, secondRuler: natal.secondRuler, tenthRuler: natal.tenthRuler,
              financialAnchors: natal.financialAnchors, generalFinancialPairs: natal.generalFinancialPairs,
              repeatingDirections: serializeDirections(repeatingDirections), financialDirections: serializeDirections(financialDirections),
              targetCrossings: targetCrossings.map(({ sourceFactIds: _ids, exactAt, ...crossing }) =>
                ({ ...crossing, exactAt: isoUtc(exactAt) })) },
          }, raw, source, ...new Set(targetCrossings.flatMap(row => row.sourceFactIds)));
        }
        if (period === 'year' && progression.status === 'ready') {
          const links = buildLeoJupiterHouseContexts(natal, sourceHouses, progression.intervals, lunarHouses.status === 'ready'
            ? { frames: lunarHouses.annual, directions: leo.progressedPairs } : undefined);
          const housePolicy = leoJupiterHousePolicy;
          for (const link of links) {
            const { start, end, activeDirections, annualRulers, ...fields } = link;
            const basis = writer.raw({ policy: housePolicy, link });
            writer.add({ start, end }, { scope: 'transit', factType: 'leo_jupiter_house_ruler_context',
              subjectIds: ['western:candidate:0', 'Jupiter', 'house:' + link.natalHouse],
              normalizedPayload: { profile: housePolicy.profile, zodiac: housePolicy.zodiac, houseSystem: housePolicy.houseSystem,
                houseProfile: housePolicy.houseProfile, transitBody: 'Jupiter', ...fields,
                annualRulers: annualRulers && { ...annualRulers,
                  annualStart: isoUtc(annualRulers.annualStart), annualEnd: isoUtc(annualRulers.annualEnd),
                  activeDirections: annualRulers.activeDirections?.map(({ exactTimes, ...direction }) =>
                    ({ ...direction, exactTimes: exactTimes.map(isoUtc) })) },
                activeDirections: activeDirections.map(({ exactTimes, ...direction }) => ({ ...direction, exactTimes: exactTimes.map(isoUtc) })) },
            }, raw, basis, source);
          }
        }
      }
    }
  }
  const luminaryNatal = buildLeoLuminaryNatal(chart, leo.status === 'ready' ? leo.natalContext.bodies : undefined);
  if (luminaryNatal.status === 'ready') {
    const raw = writer.raw({ policy: luminaryNatal.policy, natal: luminaryNatal });
    for (const link of linkLeoJupiterLuminaries(luminaryNatal, writer.facts)) {
      writer.add(link, {
        scope: 'transit', factType: 'leo_jupiter_luminary_context', subjectIds: link.subjectIds,
        parentSignalId: link.parentSignalId, normalizedPayload: link.payload,
      }, raw, ...link.sourceFactIds);
      const { profile, zodiac, birthVerified, birthAt, natalAspectProfile, luminary, transitBody, transitConjunction,
        natalLongitude } = link.payload;
      for (const { start, end, at, transit, hasReceivedNatalAspect, hasNatalJupiterAspect,
        hasExactNatalJupiterTrine, natalTrineDifference, hasNatalJupiterLongitudePriority, natalJupiterLongitudePriority,
        hasNatalAngularSameSignGroup, natalAngularSameSignGroup, repeatedMoonJupiterParallel, repeatedMoonJupiterLongitude,
        repeatedProgressedJupiterToLuminary, directionSourceFactIds } of link.verifiedPasses) {
        writer.add({ start, end }, {
          scope: 'transit', factType: 'leo_jupiter_luminary_context', subjectIds: link.subjectIds,
          parentSignalId: link.parentSignalId, exactInstant: at, timePrecision: 'second',
          normalizedPayload: { profile, zodiac, birthVerified, birthAt, natalAspectProfile, luminary, transitBody, transitConjunction,
            hasReceivedNatalAspect, natalLongitude, linkedTransitFactId: transit.factId, transitKind: 'exact_point',
            hasNatalJupiterAspect, hasExactNatalJupiterTrine, natalTrineDifference,
            hasNatalJupiterLongitudePriority, natalJupiterLongitudePriority, hasNatalAngularSameSignGroup, natalAngularSameSignGroup,
            ...(repeatedMoonJupiterParallel ? { hasRepeatedMoonJupiterParallelAtPass: true, repeatedMoonJupiterParallel } : {}),
            ...(repeatedMoonJupiterLongitude ? { hasRepeatedMoonJupiterLongitudeAtPass: true, repeatedMoonJupiterLongitude } : {}),
            ...(repeatedProgressedJupiterToLuminary
              ? { hasRepeatedProgressedJupiterToLuminaryAtPass: true, repeatedProgressedJupiterToLuminary } : {}),
          },
        }, raw, ...transit.sourceFactIds, ...directionSourceFactIds);
      }
      for (const { start, end, at, hasReceivedNatalAspect, hasNatalJupiterAspect, ...station } of link.verifiedStations) {
        writer.add({ start, end }, {
          scope: 'transit', factType: 'leo_jupiter_luminary_context', subjectIds: link.subjectIds,
          parentSignalId: link.parentSignalId, exactInstant: at, timePrecision: 'second',
          normalizedPayload: { profile, zodiac, birthVerified, birthAt, natalAspectProfile, luminary, transitBody, transitConjunction,
            hasReceivedNatalAspect, hasNatalJupiterAspect, natalLongitude, linkedTransitFactId: link.payload.linkedTransitFactId,
            transitKind: 'station_point', stationTimingProfile: luminaryNatal.policy.stationTimingProfile, natalStation: { at, ...station },
          },
        }, raw, ...link.sourceFactIds);
      }
    }
  }
  const heindel = buildHeindelSourceContext(window, chart);
  if (heindel.status === 'ready') {
    const scanJupiterRepeats = createJupiterRepeatScanner(referenceAt, heindel.clock.birthAt);
    const source = writer.raw({ policy: heindel.policy, calculation: heindel });
    const printedMinute = heindel.clock.printedMinuteComparison;
    writer.add(window, { scope: 'progressed', factType: 'heindel_progression_context', subjectIds: ['western:candidate:0'],
      normalizedPayload: { profile: heindel.policy.profile, dateBasis: heindel.clock.dateBasis, sourceClockVerified: false, geometryOnly: true,
        sampleAt: isoUtc(heindel.sampleAt), natal: heindel.natal, natalPairs: heindel.natalPairs, progressed: heindel.progressed,
        printedMinuteComparison: { residualMinutes: printedMinute.residualMinutes, includesPreciseDate: printedMinute.includesPreciseDate,
          dayOffsets: printedMinute.dates.map(({ adjustedAt }) => (adjustedAt - heindel.clock.adjustedAt) / 86_400_000) },
        solar: heindel.solar, lunar: heindel.lunar, lunations: heindel.lunations, activations: heindel.activations,
        lunationActivationProfile: heindel.policy.lunationActivationProfile, lunationActivations: heindel.lunationActivations },
    }, source);
    const links = linkHeindelTransits(heindel, writer.facts);
    const includeOverlap = time.displayWindow.periodType === 'year';
    const neptuneStations = result.motion.find(row => row.planet === 'Neptune')?.stations.map(row => row.at) ?? [];
    const jupiterStations = result.motion.find(row => row.planet === 'Jupiter')?.stations.map(row => row.at) ?? [];
    const saturnStations = result.motion.find(row => row.planet === 'Saturn')?.stations.map(row => row.at) ?? [];
    const uranusStations = result.motion.find(row => row.planet === 'Uranus')?.stations.map(row => row.at) ?? [];
    for (const link of links) {
      const { start, end, exactAt, sourceFactIds, transitFactId, directionContacts, transitLunationActivations, ...payload } = link;
      const jupiterRepeat = link.kind === 'exact' && exactAt !== undefined && link.transitBody === 'Jupiter'
        && ['Sun', 'Moon', 'Venus', 'Mercury'].includes(link.natalTargetId) && ['sextile', 'trine'].includes(String(link.aspectType))
        ? scanJupiterRepeats(exactAt, link.transitNatalLongitude, String(link.aspectType)) : undefined;
      const repeatRaw = jupiterRepeat ? writer.raw({ policy: heindelJupiterRepeatPolicy, calculation: jupiterRepeat }) : undefined;
      const transitContext = { scope: 'transit' as const, factType: 'heindel_transit_context',
        subjectIds: ['western:candidate:0', String(link.transitBody), link.natalTargetId],
        ...(exactAt === undefined ? {} : { exactInstant: isoUtc(exactAt), timePrecision: 'second' as const }),
        normalizedPayload: { ...payload, transitFactId, repeatProfile: jupiterRepeat?.profile, jupiterRepeat },
      };
      const transitSources = [source, ...sourceFactIds, ...(repeatRaw ? [repeatRaw] : [])];
      writer.add({ start, end }, transitContext, ...transitSources);
      const fellowshipBands = includeOverlap && link.kind === 'interval' && link.dateBasis === 'archive-local-birthday'
        && link.transitBody === 'Neptune' && ['Mercury', 'Moon'].includes(link.natalTargetId)
        && (link.aspectType === 'conjunction' || link.aspectType === 'sextile' || link.aspectType === 'trine')
        ? heindelStrongTransitWindows({ start, end }, 'Neptune', link.natalLongitude, link.aspectType, neptuneStations) : [];
      for (const band of fellowshipBands) {
        writer.add(band, { ...transitContext, normalizedPayload: { ...transitContext.normalizedPayload,
          fellowshipTransitBandProfile: heindel.policy.fellowshipTransitBandProfile,
          transitAllowedOrb: heindel.policy.fellowshipTransitOrb, transitNature: 'favourable',
        } }, ...transitSources);
      }
      const fellowshipNeptuneAdverseBands = includeOverlap && link.kind === 'interval' && link.dateBasis === 'archive-local-birthday'
        && link.transitBody === 'Neptune' && ['Mercury', 'Moon'].includes(link.natalTargetId)
        && link.natalTargetHasAffliction && (link.aspectType === 'square' || link.aspectType === 'opposition')
        ? heindelStrongTransitWindows({ start, end }, 'Neptune', link.transitNatalLongitude, link.aspectType, neptuneStations) : [];
      for (const band of fellowshipNeptuneAdverseBands) {
        writer.add(band, { ...transitContext, normalizedPayload: { ...transitContext.normalizedPayload,
          fellowshipNeptuneAdverseTransitBandProfile: heindel.policy.fellowshipNeptuneAdverseTransitBandProfile,
          transitAllowedOrb: heindel.policy.fellowshipTransitOrb, transitNature: 'adverse',
        } }, ...transitSources);
      }
      const fellowshipJupiterBands = includeOverlap && link.kind === 'interval' && link.dateBasis === 'archive-local-birthday'
        && link.transitBody === 'Jupiter' && ['Sun', 'Moon', 'Venus', 'Mercury'].includes(link.natalTargetId)
        && link.natalTargetHasSupport && !link.natalTargetHasAffliction
        && (link.aspectType === 'sextile' || link.aspectType === 'trine')
        ? heindelStrongTransitWindows({ start, end }, 'Jupiter', link.transitNatalLongitude, link.aspectType, jupiterStations) : [];
      const solarJupiterContrast = (direction: (typeof directionContacts)[number]) => direction.directionKind === 'solar_band'
        && direction.progressedBody === 'Sun' && direction.natalTargetId === 'Jupiter'
        && direction.transitNature === 'mild_adverse' && direction.natureRelation !== 'unclassified';
      const fellowshipJupiterMildBands = includeOverlap && link.kind === 'interval' && link.dateBasis === 'archive-local-birthday'
        && link.transitBody === 'Jupiter' && link.natalTargetId === 'Sun'
        && (link.aspectType === 'square' || link.aspectType === 'opposition') && directionContacts.some(solarJupiterContrast)
        ? heindelStrongTransitWindows({ start, end }, 'Jupiter', link.transitNatalLongitude, link.aspectType, jupiterStations) : [];
      const isSaturnMercuryContact = (direction: (typeof directionContacts)[number]) => link.natalTargetId === 'Mercury'
        && direction.directionKind === 'exact_point' && direction.natureRelation !== 'unclassified';
      const saturnAspect = link.aspectType;
      const saturnSoftAspect = saturnAspect === 'sextile' || saturnAspect === 'trine';
      const saturnHardAspect = saturnAspect === 'square' || saturnAspect === 'opposition';
      const saturnMercuryDirection = link.natalTargetId === 'Mercury' && saturnAspect !== 'conjunction'
        && directionContacts.some(isSaturnMercuryContact);
      const saturnSolarDirection = link.natalTargetId === 'Sun' && !saturnSoftAspect
        && directionContacts.some(direction => direction.progressedBody === 'Sun' && direction.natalTargetId === 'Saturn'
          && direction.natureRelation === 'akin' && (direction.aspectType === 'parallel'
            || direction.directionKind === 'solar_lunar_direction_activation' && direction.aspectType === 'square'));
      const fellowshipSaturnBands = includeOverlap && link.kind === 'interval' && link.dateBasis === 'archive-local-birthday'
        && link.transitBody === 'Saturn' && (saturnAspect === 'conjunction' || saturnSoftAspect || saturnHardAspect)
        && (saturnSolarDirection || saturnMercuryDirection)
        ? heindelStrongTransitWindows({ start, end }, 'Saturn', link.transitNatalLongitude, saturnAspect, saturnStations) : [];
      const exactVenusUranus = (direction: (typeof directionContacts)[number]) => direction.directionKind === 'exact_point'
        && direction.progressedBody === 'Venus' && direction.natalTargetId === 'Uranus';
      const fellowshipUranusBands = includeOverlap && link.kind === 'interval' && link.dateBasis === 'archive-local-birthday'
        && link.transitBody === 'Uranus' && link.natalTargetId === 'Venus'
        && (link.aspectType === 'square' || link.aspectType === 'opposition') && directionContacts.some(exactVenusUranus)
        ? heindelStrongTransitWindows({ start, end }, 'Uranus', link.transitNatalLongitude, link.aspectType, uranusStations) : [];
      for (const band of fellowshipJupiterBands) {
        const repeatAnchor = links.find(other => {
          const at = other.exactAt;
          if (other.kind !== 'exact' || at === undefined || at < band.start || at >= band.end
            || other.transitBody !== link.transitBody || other.natalTargetId !== link.natalTargetId || other.aspectType !== link.aspectType
            || other.transitNatalLongitude !== link.transitNatalLongitude) return false;
          const repeat = scanJupiterRepeats(at, other.transitNatalLongitude, String(link.aspectType));
          return repeat.status === 'repeated' && repeat.allPassesAfterBirth === true;
        });
        const adjacentRepeat = !repeatAnchor && (link.aspectType === 'sextile' || link.aspectType === 'trine')
          ? scanJupiterRepeats.findAdjacentBandRepeat(band, window, link.transitNatalLongitude, link.aspectType,
            heindel.policy.fellowshipTransitOrb) : undefined;
        const adjacentRaw = adjacentRepeat ? writer.raw({ policy: heindelJupiterRepeatPolicy, calculation: adjacentRepeat }) : undefined;
        writer.add(band, { ...transitContext, normalizedPayload: { ...transitContext.normalizedPayload,
          fellowshipJupiterTransitBandProfile: heindel.policy.fellowshipJupiterTransitBandProfile,
          transitAllowedOrb: heindel.policy.fellowshipTransitOrb,
          hasVerifiedJupiterRepeatBand: repeatAnchor !== undefined || adjacentRepeat !== undefined,
        } }, ...transitSources, ...(repeatAnchor?.sourceFactIds ?? []), ...(adjacentRaw ? [adjacentRaw] : []));
      }
      const lunationTransitBands = link.transitBody === 'Jupiter' ? fellowshipJupiterBands : fellowshipBands;
      for (const { at, nextNewMoonAt, ...witness } of transitLunationActivations) {
        const carried = at < window.start;
        const monthStart = Math.max(window.start, at);
        const band = lunationTransitBands.find(row => row.start <= monthStart && monthStart < row.end);
        const exactInstant = isoUtc(at);
        const lunationRaw = lunationRawIds.get(exactInstant);
        if (!band || !lunationRaw) continue;
        if (carried) {
          const body = link.transitBody === 'Jupiter' ? 'Jupiter' : 'Neptune';
          const aspect = link.aspectType;
          if (aspect !== 'conjunction' && aspect !== 'sextile' && aspect !== 'trine') continue;
          const earlier = { start: at, end: window.start + 1 };
          if (!heindelStrongTransitWindows(earlier, body, link.natalLongitude, aspect, readTransitStationTimes(earlier, body))
            .some(row => row.start === earlier.start && row.end === earlier.end)) continue;
        }
        const monthEnd = Math.min(nextNewMoonAt, band.end);
        const pointEnd = Math.min(at + 1000, monthEnd);
        const lunationPayload = { ...transitContext.normalizedPayload, transitLunationActivation: witness,
          transitAllowedOrb: heindel.policy.fellowshipTransitOrb, transitNature: 'favourable' };
        const monthEvidence = { fellowshipTransitLunationMonthProfile: heindel.policy.fellowshipTransitLunationMonthProfile,
          lunationStartsBeforeWindow: carried };
        writer.add({ start: monthStart, end: monthEnd }, {
          ...transitContext, normalizedPayload: { ...lunationPayload, ...monthEvidence },
        }, ...transitSources, lunationRaw);
        if (!carried) writer.add({ start: at, end: pointEnd }, {
          ...transitContext, exactInstant, timePrecision: 'second',
          normalizedPayload: { ...lunationPayload, fellowshipTransitLunationProfile: heindel.policy.fellowshipTransitLunationProfile },
        }, ...transitSources, lunationRaw);
        if (link.transitBody !== 'Jupiter' || link.natalTargetId !== 'Sun') continue;
        for (const direction of directionContacts) {
          if (direction.directionKind !== 'solar_band' || direction.progressedBody !== 'Sun' || direction.natalTargetId !== 'Jupiter'
            || direction.natureRelation !== 'akin' || (direction.aspectType !== 'sextile' && direction.aspectType !== 'trine')
            || monthStart < direction.start || monthStart >= direction.end) continue;
          if (carried) {
            const natalJupiter = heindel.natal.find(row => row.body === 'Jupiter')!;
            const phaseDirection = angleDistance(readHeindelPosition(heindel.clock, 'Sun', at), natalJupiter.longitude);
            if (Math.abs(phaseDirection - (direction.aspectType === 'trine' ? 120 : 60)) > heindel.policy.solarOrb) continue;
          }
          const overlap = {
            scope: 'transit' as const, factType: 'heindel_direction_transit_overlap', subjectIds: transitContext.subjectIds,
            normalizedPayload: { profile: heindel.policy.directionProfile, dateBasis: link.dateBasis, sourceClockVerified: false,
              natalAspectProfile: heindel.policy.natalAspectProfile, directionKind: 'solar_fellowship_transit_lunation',
              transitBody: 'Jupiter', natalTargetId: 'Sun', aspectType: link.aspectType, transitNature: direction.transitNature,
              progressedBody: 'Sun', directionNatalTargetId: 'Jupiter', directionAspectType: direction.aspectType,
              directionNature: direction.directionNature, natureRelation: direction.natureRelation, allowedOrb: direction.allowedOrb,
              transitLunationActivation: witness },
          };
          writer.add({ start: monthStart, end: Math.min(monthEnd, direction.end) }, {
            ...overlap, normalizedPayload: { ...overlap.normalizedPayload, ...monthEvidence, directionKind: 'solar_fellowship_transit_lunation_month' },
          }, ...transitSources, lunationRaw);
          if (!carried) writer.add({ start: at, end: Math.min(pointEnd, direction.end) }, {
            ...overlap, exactInstant, timePrecision: 'second',
            normalizedPayload: { ...overlap.normalizedPayload, fellowshipTransitLunationProfile: heindel.policy.fellowshipTransitLunationProfile },
          }, ...transitSources, lunationRaw);
        }
      }
      if (includeOverlap && exactAt !== undefined && link.kind === 'exact' && link.dateBasis === 'archive-local-birthday'
        && link.transitBody === 'Neptune' && ['Mercury', 'Moon'].includes(link.natalTargetId) && link.aspectType === 'conjunction') {
        writer.add({ start: exactAt, end: Math.min(end, exactAt + 1000) }, {
          ...transitContext, normalizedPayload: { ...transitContext.normalizedPayload, hasVerifiedNeptuneConjunctionPoint: true },
        }, ...transitSources);
      }
      if (includeOverlap && exactAt !== undefined && jupiterRepeat?.status === 'repeated' && jupiterRepeat.allPassesAfterBirth
        && link.natalTargetHasSupport && !link.natalTargetHasAffliction) {
        writer.add({ start: exactAt, end: Math.min(end, exactAt + 1000) }, {
          ...transitContext, normalizedPayload: { ...transitContext.normalizedPayload, hasVerifiedRepeatPoint: true },
        }, ...transitSources);
      }
      if (link.kind === 'interval' && includeOverlap) for (const direction of directionContacts) {
        const point = direction.directionKind !== 'solar_band';
        const lunarDirection = direction.lunarDirectionActivation;
        const withinFellowshipBand = direction.directionKind === 'exact_point'
          && fellowshipBands.some(band => band.start <= direction.start && direction.start < band.end);
        const withinFellowshipNeptuneAdverseBand = direction.directionKind === 'exact_point'
          && fellowshipNeptuneAdverseBands.some(band => band.start <= direction.start && direction.start < band.end);
        const withinFellowshipJupiterBand = (direction.directionKind === 'exact_point' || lunarDirection !== undefined)
          && fellowshipJupiterBands.some(band => band.start <= direction.start && direction.start < band.end);
        const withinFellowshipSaturnBand = (isSaturnMercuryContact(direction)
          || direction.directionKind === 'exact_point' && direction.aspectType === 'parallel' || lunarDirection !== undefined)
          && fellowshipSaturnBands.some(band => band.start <= direction.start && direction.start < band.end);
        const fellowshipUranusBand = exactVenusUranus(direction) ? fellowshipUranusBands.find(band =>
          band.start <= direction.start && direction.start < band.end) : undefined;
        const overlap = fellowshipUranusBand
          ? { start: direction.start, end: Math.min(direction.end, fellowshipUranusBand.end) } : direction;
        const overlapFact = { scope: 'transit' as const, factType: 'heindel_direction_transit_overlap',
          subjectIds: ['western:candidate:0', String(link.transitBody), link.natalTargetId],
          ...(point ? { exactInstant: isoUtc(direction.start), timePrecision: 'second' as const } : {}),
          normalizedPayload: { profile: heindel.policy.directionProfile, dateBasis: link.dateBasis, sourceClockVerified: false,
            natalAspectProfile: heindel.policy.natalAspectProfile,
            transitBody: link.transitBody, natalTargetId: link.natalTargetId, aspectType: link.aspectType,
            progressedBody: direction.progressedBody, directionNatalTargetId: direction.natalTargetId,
            directionAspectType: direction.aspectType, directionNature: direction.directionNature,
            transitNature: direction.transitNature, natureRelation: direction.natureRelation,
            ...(withinFellowshipBand ? { fellowshipTransitBandProfile: heindel.policy.fellowshipTransitBandProfile } : {}),
            ...(withinFellowshipNeptuneAdverseBand
              ? { fellowshipNeptuneAdverseTransitBandProfile: heindel.policy.fellowshipNeptuneAdverseTransitBandProfile } : {}),
            ...(withinFellowshipJupiterBand ? { fellowshipJupiterTransitBandProfile: heindel.policy.fellowshipJupiterTransitBandProfile } : {}),
            ...(withinFellowshipSaturnBand ? { fellowshipSaturnTransitBandProfile: heindel.policy.fellowshipSaturnTransitBandProfile } : {}),
            ...(fellowshipUranusBand ? { fellowshipUranusTransitBandProfile: heindel.policy.fellowshipUranusTransitBandProfile } : {}),
            directionKind: direction.directionKind, allowedOrb: direction.allowedOrb, exactTimes: direction.exactTimes.map(isoUtc),
            ...(direction.declination ? { directionCoordinate: direction.coordinate, directionDeclination: direction.declination } : {}),
            ...(lunarDirection ? {
              lunarDirectionActivationProfile: heindel.policy.lunarDirectionActivationProfile,
              lunarDirectionActivation: { ...lunarDirection, at: isoUtc(lunarDirection.at) },
            } : {}),
            ...(direction.lunationActivations ? {
              lunationActivationProfile: heindel.policy.lunationActivationProfile,
              hasLunationActivation: direction.lunationActivations.length > 0,
              lunationActivations: direction.lunationActivations.map(({ at, ...witness }) => ({ ...witness, at: isoUtc(at) })),
            } : {}) },
        };
        writer.add(overlap, overlapFact, source, ...sourceFactIds);
        if (!solarJupiterContrast(direction)) continue;
        for (const band of fellowshipJupiterMildBands) {
          const start = Math.max(direction.start, band.start), end = Math.min(direction.end, band.end);
          if (start >= end) continue;
          writer.add({ start, end }, { ...overlapFact, normalizedPayload: { ...overlapFact.normalizedPayload,
            fellowshipJupiterMildTransitBandProfile: heindel.policy.fellowshipJupiterMildTransitBandProfile,
            exactTimes: direction.exactTimes.filter(at => start <= at && at < end).map(isoUtc),
          } }, source, ...sourceFactIds);
        }
      }
    }
    if (includeOverlap) {
      const angleLinks = linkHeindelSaturnAngleTransits(heindel, writer.facts);
      for (const { start, end, band, sourceFactIds, exactPasses } of angleLinks) {
        const evidence = { scope: 'transit' as const, factType: 'heindel_direction_transit_overlap',
          subjectIds: ['western:candidate:0', 'Saturn', band.natalTargetId, 'Sun'] };
        const normalizedPayload = { profile: heindel.policy.directionProfile, dateBasis: heindel.clock.dateBasis,
          sourceClockVerified: false, natalAspectProfile: heindel.policy.natalAspectProfile,
          angleOverlapProfile: heindel.policy.angleOverlapProfile, directionKind: 'solar_angle_transit_overlap',
          transitBody: 'Saturn', natalTargetId: band.natalTargetId, natalLongitude: band.natalLongitude,
          aspectType: 'conjunction', transitNature: 'adverse',
          progressedBody: 'Sun', directionNatalTargetId: band.natalTargetId, directionAspectType: band.aspectType,
          directionNature: 'adverse', natureRelation: 'akin', allowedOrb: band.allowedOrb,
          exactTimes: band.exactTimes.filter(at => start <= at && at < end).map(isoUtc) };
        writer.add({ start, end }, { ...evidence, normalizedPayload }, source, ...sourceFactIds);
        for (const at of exactPasses) writer.add({ start: at, end: Math.min(at + 1000, end) }, {
          ...evidence, exactInstant: isoUtc(at), timePrecision: 'second',
          normalizedPayload: { ...normalizedPayload, exactSaturnPass: true },
        }, source, ...sourceFactIds);
      }
      const natalSaturnAfflicted = heindel.natalPairs.some(pair => pair.contacts.some(contact =>
        contact.band === 'standard' && contact.affected.includes('Saturn')));
      for (const { at, ...witness } of heindel.lunationActivations) {
        const direction = heindel.solar[witness.solarIndex];
        const instant = isoUtc(at);
        const lunationRaw = lunationRawIds.get(instant);
        if (!lunationRaw) continue;
        writer.add({ start: at, end: Math.min(at + 1000, direction.end) }, {
          scope: 'transit', factType: 'heindel_direction_transit_overlap',
          subjectIds: ['western:candidate:0', 'Moon', witness.natalTargetId, direction.natalTargetId],
          exactInstant: instant, timePrecision: 'second',
          normalizedPayload: { profile: heindel.policy.directionProfile, dateBasis: heindel.clock.dateBasis,
            sourceClockVerified: false, natalAspectProfile: heindel.policy.natalAspectProfile,
            transitBody: 'Moon', natalTargetId: witness.natalTargetId, aspectType: witness.aspectType,
            progressedBody: direction.progressedBody, directionNatalTargetId: direction.natalTargetId,
            directionAspectType: direction.aspectType, directionKind: 'solar_lunation_activation', allowedOrb: direction.allowedOrb,
            lunationActivationProfile: heindel.policy.lunationActivationProfile, hasLunationActivation: true,
            ...(direction.natalTargetId === 'Saturn' && witness.natalTargetId === 'Saturn' ? { natalSaturnAfflicted } : {}),
            lunationActivations: [{ ...witness, at: instant }] },
        }, source, lunationRaw);
      }
      const intervals = links.filter(link => link.kind === 'interval');
      if (angleLinks.length === 0 && heindel.lunationActivations.length === 0 && intervals.length
        && intervals.every(link => !link.directionContacts.length)) {
        const searched = [...new Set(intervals.flatMap(link => link.sourceFactIds))];
        writer.add(window, { scope: 'transit', factType: 'heindel_direction_transit_overlap', subjectIds: ['western:candidate:0'],
          normalizedPayload: { profile: heindel.policy.directionProfile, dateBasis: heindel.clock.dateBasis,
            sourceClockVerified: false, natalAspectProfile: heindel.policy.natalAspectProfile, directionKind: 'no_overlap' },
        }, source, ...searched);
      }
    }
  }
  return { status: warnings.length ? 'partial' : 'completed', warnings,
    nativeWindow: { ...utcRange(window.start, window.end), ...factPolicies.western,
      progression: { status: progression.status, policy: progression.policy,
        positionCount: progression.status === 'ready' ? progression.positions.length : 0,
        intervalCount: progression.status === 'ready' ? progression.intervals.length : 0 },
      sourceHouses: { status: sourceHouses.status, policy: sourceHouses.policy },
      sourceTimes: { status: ptolemy.status, policy: ptolemy.policy },
      leoContext: { status: leo.status, policy: leo.policy },
      luminaryContext: { status: luminaryNatal.status, policy: luminaryNatal.policy,
        contextCount: writer.facts.filter(fact => fact.factType === 'leo_jupiter_luminary_context').length },
      heindelContext: { status: heindel.status, policy: heindel.policy } } };
}

function angleDistance(first: number, second: number) {
  const distance = Math.abs(first - second);
  return Math.min(distance, 360 - distance);
}
